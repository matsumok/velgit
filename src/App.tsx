import { useQueryClient } from "@tanstack/react-query";
import { listen } from "@tauri-apps/api/event";
import { useEffect, useMemo, useState } from "react";
import { useGetDrawings } from "./api/drawings";
import { useGetPendingChanges } from "./api/pendingChanges";
import { useInitProject } from "./api/project";
import { useGetDrawingsAtCommit } from "./api/projectCommits";
import { queryKeys } from "./api/queryKeys";
import { CommitPanel } from "./components/commit/CommitPanel";
import { JobSelector } from "./components/JobSelector";
import { CommitHistoryPanel } from "./components/layout/CommitHistoryPanel";
import { AppHeader } from "./components/layout/AppHeader";
import { ThreePaneLayout } from "./components/layout/ThreePaneLayout";
import { ProjectTimeline } from "./components/ProjectTimeline";
import { ReleasePanel } from "./components/ReleasePanel";
import { UsernameGate } from "./components/UsernameGate";
import { Badge } from "./components/ui/badge";
import { resolveDrawingStatuses } from "./lib/drawingStatus";
import { useDrawingSelection } from "./lib/useDrawingSelection";
import { cn } from "./lib/utils";
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

const STATUS_COLOR = {
  new: "text-green-600",
  modified: "text-yellow-600",
  unchanged: "",
} as const;

function DrawingListContent({
  isSelected,
  onToggle,
  showCheckboxes,
}: {
  isSelected: (filename: string) => boolean;
  onToggle: (filename: string) => void;
  showCheckboxes: boolean;
}) {
  const { selectedCommitOid, setSelectedDrawing } = useAppStore();
  const { data: headDrawings = [] } = useGetDrawings();
  const { data: pastDrawings } = useGetDrawingsAtCommit(selectedCommitOid);
  const { data: pendingChanges = [] } = useGetPendingChanges();

  const items = useMemo(
    () =>
      selectedCommitOid === "HEAD"
        ? resolveDrawingStatuses(headDrawings, pendingChanges)
        : (pastDrawings ?? []).map((filename) => ({
            filename,
            status: "unchanged" as const,
            isMinor: false,
          })),
    [selectedCommitOid, headDrawings, pastDrawings, pendingChanges],
  );

  return (
    <div className="flex-1 overflow-y-auto p-4">
      <p className="text-xs text-muted-foreground mb-2">図面一覧</p>
      {items.length > 0 ? (
        <ul className="space-y-1">
          {items.map(({ filename, status, isMinor }) => (
            <li key={filename}>
              <div
                className={cn(
                  "flex items-center gap-2 text-sm px-2 py-1 rounded hover:bg-muted",
                  STATUS_COLOR[status],
                )}
              >
                {showCheckboxes && status !== "unchanged" && (
                  <input
                    type="checkbox"
                    checked={isSelected(filename)}
                    onChange={() => onToggle(filename)}
                    aria-label={filename}
                    className="shrink-0"
                  />
                )}
                <button
                  type="button"
                  className="flex-1 text-left truncate cursor-pointer"
                  onClick={() => setSelectedDrawing(filename)}
                >
                  {filename}
                </button>
                {isMinor && (
                  <Badge variant="secondary" className="shrink-0 text-xs">
                    ~
                  </Badge>
                )}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">PDFファイルがありません</p>
      )}
    </div>
  );
}

function CenterPane() {
  const { selectedProject, selectedCommitOid } = useAppStore();
  const { error, loading, openFolder } = useInitProject();
  const { data: changes = [] } = useGetPendingChanges();
  const { data: headDrawings = [] } = useGetDrawings();

  const isCommitMode = selectedCommitOid === "HEAD" && changes.length > 0;
  const isReleaseMode = selectedCommitOid === "HEAD" && changes.length === 0;

  const selectableFilenames = useMemo(
    () =>
      isCommitMode
        ? changes.map((c) => c.filename)
        : headDrawings.map((d) => d.filename),
    [isCommitMode, changes, headDrawings],
  );

  const selection = useDrawingSelection(selectableFilenames);

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
      <DrawingListContent
        isSelected={selection.isSelected}
        onToggle={selection.toggle}
        showCheckboxes={isCommitMode || isReleaseMode}
      />
      {selectedCommitOid === "HEAD" &&
        (isCommitMode ? (
          <CommitPanel
            selectedFilenames={selection.selectedFilenames}
            onCommitSuccess={selection.reset}
          />
        ) : (
          <ReleasePanel
            selectedFilenames={selection.selectedFilenames}
            onReleaseSuccess={selection.reset}
          />
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
  useEffect(() => {
    const unlisten = listen("commit-classified", () => {
      queryClient.invalidateQueries({ queryKey: ["commit_history"] });
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, [queryClient]);
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
