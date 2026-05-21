import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";
import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "./lib/utils";
import { ThreePaneLayout } from "./components/layout/ThreePaneLayout";
import { useAppStore } from "./store/useAppStore";
import { useGetDrawings } from "./api/drawings";
import { CommitPanel } from "./components/commit/CommitPanel";

function ProjectList() {
  const { selectedProject } = useAppStore();
  const folderName = selectedProject
    ? (selectedProject.split(/[\\/]/).pop() ?? selectedProject)
    : null;

  return (
    <div className="p-4">
      <p className="text-xs text-muted-foreground mb-2">物件</p>
      {folderName ? (
        <div className="px-3 py-2 rounded text-sm bg-primary text-primary-foreground">
          {folderName}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">未選択</p>
      )}
    </div>
  );
}

function DrawingList() {
  const { selectedProject, setSelectedProject } = useAppStore();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { data: drawings } = useGetDrawings();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!selectedProject) return;
    invoke<boolean>("is_initialized", { path: selectedProject }).then(
      (initialized) => {
        if (!initialized) {
          setSelectedProject(null);
          return;
        }
        invoke("init_working_folder", { path: selectedProject })
          .then(() => queryClient.invalidateQueries({ queryKey: ["drawings"] }))
          .catch(() => setSelectedProject(null));
      },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleOpenFolder() {
    const path = await openDialog({ directory: true, multiple: false });
    if (!path || typeof path !== "string") return;

    setLoading(true);
    setError(null);
    try {
      await invoke("init_working_folder", { path });
      setSelectedProject(path);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  if (!selectedProject) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4">
        {error && (
          <p className="text-sm text-destructive px-4 text-center">{error}</p>
        )}
        <button
          type="button"
          onClick={handleOpenFolder}
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
    <div className="p-4">
      <p className="text-xs text-muted-foreground mb-2">図面一覧</p>
      {drawings && drawings.length > 0 ? (
        <ul className="space-y-1">
          {drawings.map((d) => (
            <li
              key={d.filename}
              className="text-sm px-2 py-1 rounded hover:bg-muted"
            >
              {d.filename}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">PDFファイルがありません</p>
      )}
    </div>
  );
}

function DrawingDetail() {
  return (
    <div className="p-4">
      <CommitPanel />
    </div>
  );
}

function App() {
  return (
    <ThreePaneLayout
      left={<ProjectList />}
      center={<DrawingList />}
      right={<DrawingDetail />}
    />
  );
}

export default App;
