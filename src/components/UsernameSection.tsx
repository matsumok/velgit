import { useState } from "react";
import { useAppStore } from "../store/useAppStore";

export function UsernameSection() {
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
            // biome-ignore lint/a11y/noAutofocus: inline edit field requires immediate focus
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
