import { useState } from "react";
import { cn } from "../lib/utils";
import { useAppStore } from "../store/useAppStore";

export function UsernameGate({ children }: { children: React.ReactNode }) {
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
          // biome-ignore lint/a11y/noAutofocus: modal dialog requires immediate focus
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
