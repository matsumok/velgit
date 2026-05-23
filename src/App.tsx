import { useQueryClient } from "@tanstack/react-query";
import { listen } from "@tauri-apps/api/event";
import { useEffect, useState } from "react";
import { useGetDrawings } from "./api/drawings";
import { useGetPendingChanges } from "./api/pendingChanges";
import { useInitProject } from "./api/project";
import { useGetDrawingsAtCommit } from "./api/projectCommits";
import { queryKeys } from "./api/queryKeys";
import { CommitPanel } from "./components/commit/CommitPanel";
import { CommitHistoryPanel } from "./components/layout/CommitHistoryPanel";
import { ThreePaneLayout } from "./components/layout/ThreePaneLayout";
import { ProjectTimeline } from "./components/ProjectTimeline";
import { ReleasePanel } from "./components/ReleasePanel";
import { UsernameGate } from "./components/UsernameGate";
import { UsernameSection } from "./components/UsernameSection";
import { cn } from "./lib/utils";
import { useAppStore } from "./store/useAppStore";

function LeftPane() {
  const { selectedProject } = useAppStore();
  const folderName = selectedProject
    ? (selectedProject.split(/[\\/]/).pop() ?? selectedProject)
    : null;

  return (
    <div className="flex flex-col h-full">
      <div className="shrink-0 border-b px-3 pt-3 pb-1">
        <p className="text-xs text-muted-foreground truncate">
          {folderName ?? "物件未選択"}
        </p>
        <UsernameSection />
      </div>
      <ProjectTimeline />
    </div>
  );
}

function DrawingListContent() {
  const { selectedCommitOid, setSelectedDrawing } = useAppStore();
  const { data: headDrawings } = useGetDrawings();
  const { data: pastDrawings } = useGetDrawingsAtCommit(selectedCommitOid);

  const filenames =
    selectedCommitOid === "HEAD"
      ? (headDrawings ?? []).map((d) => d.filename)
      : (pastDrawings ?? []);

  return (
    <div className="flex-1 overflow-y-auto p-4">
      <p className="text-xs text-muted-foreground mb-2">図面一覧</p>
      {filenames.length > 0 ? (
        <ul className="space-y-1">
          {filenames.map((filename) => (
            <li key={filename}>
              <button
                type="button"
                className="w-full text-left text-sm px-2 py-1 rounded hover:bg-muted cursor-pointer"
                onClick={() => setSelectedDrawing(filename)}
              >
                {filename}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">PDFファイルがありません</p>
      )}
    </div>
  );
}

function ActionArea() {
  const selectedCommitOid = useAppStore((s) => s.selectedCommitOid);
  const { data: changes } = useGetPendingChanges();

  if (selectedCommitOid !== "HEAD") return null;

  if (changes && changes.length > 0) return <CommitPanel />;
  return <ReleasePanel />;
}

function CenterPane() {
  const { selectedProject } = useAppStore();
  const { error, loading, openFolder } = useInitProject();

  if (!selectedProject) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4">
        {error && (
          <p className="text-sm text-destructive px-4 text-center">{error}</p>
        )}
        <button
          type="button"
          onClick={openFolder}
          disabled={loading}
          className={cn(
            "px-4 py-2 rounded text-sm bg-primary text-primary-foreground",
            loading && "opacity-50 cursor-not-allowed",
          )}
        >
          {loading ? "初期化中..." : "ワーキングフォルダを開く"}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <DrawingListContent />
      <ActionArea />
    </div>
  );
}

function DrawingDetail() {
  const selectedDrawing = useAppStore((s) => s.selectedDrawing);
  return (
    <div className="h-full overflow-y-auto">
      <CommitHistoryPanel key={selectedDrawing ?? ""} />
    </div>
  );
}

function usePdfChangedListener() {
  const queryClient = useQueryClient();
  const selectedProject = useAppStore((s) => s.selectedProject);
  useEffect(() => {
    const unlisten = listen("pdf-changed", () => {
      if (!selectedProject) return;
      queryClient.invalidateQueries({
        queryKey: queryKeys.pendingChanges(selectedProject),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.drawings(selectedProject),
      });
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, [queryClient, selectedProject]);
}

function useWatcherState() {
  const [isPolling, setIsPolling] = useState(false);
  useEffect(() => {
    const unlisten = listen<string>("watcher-state-changed", (e) => {
      setIsPolling(e.payload === "pollingFallback");
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);
  return isPolling;
}

function App() {
  usePdfChangedListener();
  const isPolling = useWatcherState();
  return (
    <UsernameGate>
      <div className="flex flex-col h-screen w-screen overflow-hidden">
        <div className="flex-1 overflow-hidden">
          <ThreePaneLayout
            left={<LeftPane />}
            center={<CenterPane />}
            right={<DrawingDetail />}
          />
        </div>
        {isPolling && (
          <div className="shrink-0 border-t px-3 py-1 text-xs text-muted-foreground bg-muted">
            ポーリングモードで監視中（ネイティブイベント利用不可）
          </div>
        )}
      </div>
    </UsernameGate>
  );
}

export default App;
