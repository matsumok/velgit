import { useQueryClient } from "@tanstack/react-query";
import { listen } from "@tauri-apps/api/event";
import { useEffect, useMemo, useState } from "react";
import { useGetDrawings } from "./api/drawings";
import { useGetPendingChanges } from "./api/pendingChanges";
import { useInitProject } from "./api/project";
import { useGetDrawingsAtCommit } from "./api/projectCommits";
import { queryKeys } from "./api/queryKeys";
import { Button } from "./components/ui/button";
import { CommitPanel } from "./components/commit/CommitPanel";
import { JobSelector } from "./components/JobSelector";
import { AppHeader } from "./components/layout/AppHeader";
import { CommitHistoryPanel } from "./components/layout/CommitHistoryPanel";
import { DrawingTable } from "./components/layout/DrawingTable";
import { ThreePaneLayout } from "./components/layout/ThreePaneLayout";
import { ProjectTimeline } from "./components/ProjectTimeline";
import { ReleasePanel } from "./components/ReleasePanel";
import { UsernameGate } from "./components/UsernameGate";
import { resolveDrawingStatuses } from "./lib/drawingStatus";
import { useAppStore } from "./store/useAppStore";

function LeftPane() {
  return (
    <div className="flex flex-col h-full">
      <div className="shrink-0 border-b">
        <JobSelector />
      </div>
      <ProjectTimeline />
    </div>
  );
}

function CenterPane() {
  const { selectedProject, selectedCommitOid, setSelectedDrawing } =
    useAppStore();
  const { error, loading, openFolder } = useInitProject();
  const { data: changes = [] } = useGetPendingChanges();
  const { data: headDrawings = [] } = useGetDrawings();
  const { data: pastDrawings } = useGetDrawingsAtCommit(selectedCommitOid);

  const [selectedFilenames, setSelectedFilenames] = useState<string[]>([]);

  const mode =
    selectedCommitOid !== "HEAD"
      ? "browse"
      : changes.length > 0
        ? "commit"
        : "release";

  const rows = useMemo(
    () =>
      selectedCommitOid === "HEAD"
        ? resolveDrawingStatuses(headDrawings, changes)
        : (pastDrawings ?? []).map((filename) => ({
            filename,
            status: "unchanged" as const,
            isMinor: false,
          })),
    [selectedCommitOid, headDrawings, pastDrawings, changes],
  );

  if (!selectedProject) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4">
        {error && (
          <p className="text-sm text-destructive px-4 text-center">{error}</p>
        )}
        <Button onClick={openFolder} disabled={loading}>
          {loading ? "初期化中..." : "ワーキングフォルダを開く"}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <DrawingTable
        rows={rows}
        mode={mode}
        onPreviewChange={setSelectedDrawing}
        onSelectionChange={setSelectedFilenames}
      />
      {selectedCommitOid === "HEAD" &&
        (mode === "commit" ? (
          <CommitPanel selectedFilenames={selectedFilenames} />
        ) : (
          <ReleasePanel selectedFilenames={selectedFilenames} />
        ))}
    </div>
  );
}

function DrawingDetail() {
  const selectedDrawing = useAppStore((s) => s.selectedDrawing);
  return (
    <div className="h-full overflow-hidden">
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

function useThemeSync() {
  const theme = useAppStore((s) => s.theme);
  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);
}

function useCommitClassifiedListener() {
  const queryClient = useQueryClient();
  const selectedProject = useAppStore((s) => s.selectedProject);
  useEffect(() => {
    const unlisten = listen("commit-classified", () => {
      if (!selectedProject) return;
      queryClient.invalidateQueries({
        queryKey: queryKeys.commitHistoryBase(selectedProject),
      });
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, [queryClient, selectedProject]);
}

function App() {
  usePdfChangedListener();
  useThemeSync();
  useCommitClassifiedListener();
  const isPolling = useWatcherState();
  return (
    <UsernameGate>
      <div className="flex flex-col h-screen w-screen overflow-hidden">
        <AppHeader />
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
