import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";

interface RepoInfo {
  name: string;
  path: string;
  branch: string;
  head_sha: string;
  head_message: string;
}

function App() {
  const [repo, setRepo] = useState<RepoInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function openRepo() {
    const selected = await open({ directory: true, multiple: false });
    if (!selected) return;

    try {
      const info = await invoke<RepoInfo>("open_repo", { path: selected });
      setRepo(info);
      setError(null);
    } catch (e) {
      setError(e as string);
      setRepo(null);
    }
  }

  return (
    <div className="dark flex h-screen w-screen bg-background text-foreground overflow-hidden">
      {/* 左ペイン: 図面ファイルリスト */}
      <aside className="w-64 shrink-0 border-r border-border flex flex-col">
        <div className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground border-b border-border flex items-center justify-between">
          <span>リポジトリ</span>
          <button
            onClick={openRepo}
            className="text-xs px-2 py-1 bg-primary text-primary-foreground hover:bg-primary/90 rounded transition-colors"
          >
            開く
          </button>
        </div>
        <div className="flex-1 p-3 text-sm">
          {repo ? (
            <div className="space-y-2">
              <p className="font-semibold truncate">{repo.name}</p>
              <p className="text-muted-foreground text-xs truncate">{repo.path}</p>
              <div className="mt-3 space-y-1">
                <p className="text-xs text-muted-foreground">ブランチ</p>
                <p className="text-xs font-mono bg-muted px-2 py-1 rounded">{repo.branch}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">HEAD</p>
                <p className="text-xs font-mono bg-muted px-2 py-1 rounded">{repo.head_sha}</p>
                <p className="text-xs text-muted-foreground truncate">{repo.head_message}</p>
              </div>
            </div>
          ) : (
            <p className="text-muted-foreground italic text-xs">リポジトリを開いてください</p>
          )}
          {error && (
            <p className="text-destructive text-xs mt-2">{error}</p>
          )}
        </div>
      </aside>

      {/* 中央: コミットツリー */}
      <main className="flex-1 flex flex-col border-r border-border min-w-0">
        <div className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground border-b border-border">
          コミットツリー
        </div>
        <div className="flex-1 flex flex-col items-center justify-center p-4">
          <p className="text-muted-foreground text-sm">
            {repo ? `${repo.name} を開いています` : "リポジトリを開いてください"}
          </p>
        </div>
      </main>

      {/* 右ペイン: PDFプレビュー + diff */}
      <aside className="w-96 shrink-0 flex flex-col">
        <div className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground border-b border-border">
          PDFプレビュー / Diff
        </div>
        <div className="flex-1 p-4 text-sm text-muted-foreground italic">
          ファイルを選択してください
        </div>
      </aside>
    </div>
  );
}

export default App;
