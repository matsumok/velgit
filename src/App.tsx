import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "./lib/utils";
import { ThreePaneLayout } from "./components/layout/ThreePaneLayout";
import { useAppStore } from "./store/useAppStore";
import { useGetDrawings } from "./api/drawings";
import { CommitPanel } from "./components/commit/CommitPanel";
import { CommitHistoryPanel } from "./components/layout/CommitHistoryPanel";

function UsernameGate({ children }: { children: React.ReactNode }) {
  const { username, setUsername } = useAppStore();
  const [input, setInput] = useState("");

  if (username !== null) return <>{children}</>;

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-background z-50">
      <div className="flex flex-col gap-4 p-6 rounded-lg border bg-card w-80 shadow-lg">
        <p className="text-sm font-medium">ユーザー名を入力してください</p>
        <p className="text-xs text-muted-foreground">
          コミットと図渡しに記録されます
        </p>
        <input
          type="text"
          className="w-full rounded border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          placeholder="例: 山田太郎"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && input.trim()) setUsername(input.trim());
          }}
          autoFocus
        />
        <button
          type="button"
          disabled={!input.trim()}
          onClick={() => setUsername(input.trim())}
          className={cn(
            "px-4 py-2 rounded text-sm bg-primary text-primary-foreground",
            !input.trim() && "opacity-50 cursor-not-allowed",
          )}
        >
          決定
        </button>
      </div>
    </div>
  );
}

function UsernameSection() {
  const { username, setUsername } = useAppStore();
  const [editing, setEditing] = useState(false);
  const [input, setInput] = useState(username ?? "");

  function handleSave() {
    if (!input.trim()) return;
    setUsername(input.trim());
    setEditing(false);
  }

  return (
    <div className="px-4 pt-4 pb-2">
      <p className="text-xs text-muted-foreground mb-1">ユーザー名</p>
      {editing ? (
        <div className="flex gap-1">
          <input
            type="text"
            className="flex-1 min-w-0 rounded border border-input bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSave();
              if (e.key === "Escape") setEditing(false);
            }}
            autoFocus
          />
          <button
            type="button"
            onClick={handleSave}
            disabled={!input.trim()}
            className="px-2 py-1 rounded text-xs bg-primary text-primary-foreground disabled:opacity-50"
          >
            保存
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => {
            setInput(username ?? "");
            setEditing(true);
          }}
          className="text-sm px-2 py-1 rounded hover:bg-muted w-full text-left truncate"
        >
          {username}
        </button>
      )}
    </div>
  );
}

function ProjectList() {
  const { selectedProject } = useAppStore();
  const folderName = selectedProject
    ? (selectedProject.split(/[\\/]/).pop() ?? selectedProject)
    : null;

  return (
    <div>
      <UsernameSection />
      <div className="p-4 pt-2">
        <p className="text-xs text-muted-foreground mb-2">物件</p>
        {folderName ? (
          <div className="px-3 py-2 rounded text-sm bg-primary text-primary-foreground">
            {folderName}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">未選択</p>
        )}
      </div>
    </div>
  );
}

function DrawingList() {
  const { selectedProject, setSelectedProject, setSelectedDrawing } =
    useAppStore();
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
              className="text-sm px-2 py-1 rounded hover:bg-muted cursor-pointer"
              onClick={() => setSelectedDrawing(d.filename)}
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
    <div className="h-full overflow-y-auto">
      <CommitPanel />
      <CommitHistoryPanel />
    </div>
  );
}

function usePdfChangedListener() {
  const queryClient = useQueryClient();
  useEffect(() => {
    const unlisten = listen("pdf-changed", () => {
      queryClient.invalidateQueries({ queryKey: ["pending_changes"] });
      queryClient.invalidateQueries({ queryKey: ["drawings"] });
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, [queryClient]);
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
            left={<ProjectList />}
            center={<DrawingList />}
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
