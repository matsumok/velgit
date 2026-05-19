import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";

function App() {
  const [msg, setMsg] = useState("");

  async function testIpc() {
    const res = await invoke<string>("greet", { name: "Velgit" });
    setMsg(res);
  }

  return (
    <div className="dark flex h-screen w-screen bg-background text-foreground overflow-hidden">
      {/* 左ペイン: 図面ファイルリスト */}
      <aside className="w-64 shrink-0 border-r border-border flex flex-col">
        <div className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground border-b border-border">
          図面ファイル
        </div>
        <div className="flex-1 p-2 text-sm text-muted-foreground italic">ファイルなし</div>
      </aside>

      {/* 中央: コミットツリー */}
      <main className="flex-1 flex flex-col border-r border-border min-w-0">
        <div className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground border-b border-border">
          コミットツリー
        </div>
        <div className="flex-1 flex flex-col items-center justify-center gap-4 p-4">
          <p className="text-muted-foreground text-sm">リポジトリを開いてください</p>
          <button
            onClick={testIpc}
            className="px-4 py-2 bg-primary text-primary-foreground hover:bg-primary/90 rounded text-sm transition-colors"
          >
            Rust IPC テスト
          </button>
          {msg && <p className="text-sm">{msg}</p>}
        </div>
      </main>

      {/* 右ペイン: PDFプレビュー + diff */}
      <aside className="w-96 shrink-0 flex flex-col">
        <div className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground border-b border-border">
          PDFプレビュー / Diff
        </div>
        <div className="flex-1 p-4 text-sm text-muted-foreground italic">ファイルを選択してください</div>
      </aside>
    </div>
  );
}

export default App;
