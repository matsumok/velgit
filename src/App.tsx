import { useQueryClient } from "@tanstack/react-query";
import { listen } from "@tauri-apps/api/event";
import { useEffect, useMemo, useState } from "react";
import { useGetDrawings } from "./api/drawings";
import { useGetPendingChanges } from "./api/pendingChanges";
import { useInitProject } from "./api/project";
import { useGetDrawingsAtCommit } from "./api/projectCommits";
import { queryKeys } from "./api/queryKeys";
import { useGetReleaseDrawings } from "./api/releases";
import { CommitPanel } from "./components/commit/CommitPanel";
import { JobSelector } from "./components/JobSelector";
import { AppHeader } from "./components/layout/AppHeader";
import { CommitHistoryPanel } from "./components/layout/CommitHistoryPanel";
import { DrawingTable } from "./components/layout/DrawingTable";
import { ThreePaneLayout } from "./components/layout/ThreePaneLayout";
import { ProjectTimeline } from "./components/ProjectTimeline";
import { ReleaseDetailPanel } from "./components/ReleaseDetailPanel";
import { ReleasePanel } from "./components/ReleasePanel";
import { UsernameGate } from "./components/UsernameGate";
import { Button } from "./components/ui/button";
import { useAppMode } from "./hooks/useAppMode";
import { resolveDrawingStatuses } from "./lib/drawingStatus";
import { useAppStore } from "./store/useAppStore";

function LeftPaneSpinner() {
  const backgroundTask = useAppStore((s) => s.backgroundTask);
  if (!backgroundTask) return null;
  return (
    <div className="shrink-0 border-t px-3 py-2 flex items-center gap-2">
      <div className="size-3 rounded-full border-2 border-muted border-t-muted-foreground animate-spin shrink-0" />
      <p className="text-xs text-muted-foreground truncate">{backgroundTask}</p>
    </div>
  );
}

function LeftPane() {
  return (
    <div className="flex flex-col h-full">
      <div className="shrink-0 border-b">
        <JobSelector />
      </div>
      <ProjectTimeline />
      <LeftPaneSpinner />
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

  const appMode = useAppMode();
  const releaseId = appMode.mode === "release" ? appMode.releaseId : null;
  const { data: releaseDrawings = [] } = useGetReleaseDrawings(releaseId);

  const [selectedFilenames, setSelectedFilenames] = useState<string[]>([]);

  const tableMode =
    appMode.mode === "head-commit"
      ? "commit"
      : appMode.mode === "head-idle"
        ? "release"
        : "browse";

  const rows = useMemo(() => {
    if (appMode.mode === "release") {
      return releaseDrawings.map((filename) => ({
        filename,
        status: "unchanged" as const,
        isMinor: false,
      }));
    }
    if (appMode.mode === "browse") {
      return (pastDrawings ?? []).map((filename) => ({
        filename,
        status: "unchanged" as const,
        isMinor: false,
      }));
    }
    return resolveDrawingStatuses(headDrawings, changes);
  }, [appMode, releaseDrawings, pastDrawings, headDrawings, changes]);

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
        mode={tableMode}
        onPreviewChange={setSelectedDrawing}
        onSelectionChange={setSelectedFilenames}
      />
      {appMode.mode === "head-commit" && (
        <CommitPanel selectedFilenames={selectedFilenames} />
      )}
      {appMode.mode === "head-idle" && (
        <ReleasePanel selectedFilenames={selectedFilenames} />
      )}
      {appMode.mode === "release" && (
        <ReleaseDetailPanel releaseId={appMode.releaseId} />
      )}
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

function useCommitCreatedListener() {
  const queryClient = useQueryClient();
  const selectedProject = useAppStore((s) => s.selectedProject);
  const setBackgroundTask = useAppStore((s) => s.setBackgroundTask);
  useEffect(() => {
    const unlisten = listen("commit-created", () => {
      setBackgroundTask("画像処理中...");
      if (!selectedProject) return;
      queryClient.invalidateQueries({
        queryKey: queryKeys.pendingChanges(selectedProject),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.drawings(selectedProject),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.projectCommits(selectedProject),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.commitHistoryBase(selectedProject),
      });
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, [queryClient, selectedProject, setBackgroundTask]);
}

function useCommitClassifiedListener() {
  const setBackgroundTask = useAppStore((s) => s.setBackgroundTask);
  useEffect(() => {
    const unlisten = listen("commit-classified", () => {
      setBackgroundTask(null);
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, [setBackgroundTask]);
}

function useClassifyProgressListener() {
  const setBackgroundTask = useAppStore((s) => s.setBackgroundTask);
  useEffect(() => {
    const unlisten = listen<{
      current: number;
      total: number;
      filename: string;
    }>("commit-classify-progress", (e) => {
      const { current, total, filename } = e.payload;
      setBackgroundTask(`画像処理中 (${current}/${total}): ${filename}`);
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, [setBackgroundTask]);
}

function App() {
  usePdfChangedListener();
  useThemeSync();
  useCommitCreatedListener();
  useCommitClassifiedListener();
  useClassifyProgressListener();
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
