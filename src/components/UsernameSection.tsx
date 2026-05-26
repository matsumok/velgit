import { useState } from "react";
import { useAppStore } from "../store/useAppStore";
import { Button } from "./ui/button";
import { Input } from "./ui/input";

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
          <Input
            className="flex-1 min-w-0"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSave();
              if (e.key === "Escape") setEditing(false);
            }}
            // biome-ignore lint/a11y/noAutofocus: inline edit field requires immediate focus
            autoFocus
          />
          <Button size="xs" onClick={handleSave} disabled={!input.trim()}>
            保存
          </Button>
        </div>
      ) : (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setInput(username ?? "");
            setEditing(true);
          }}
          className="w-full justify-start truncate"
        >
          {username}
        </Button>
      )}
    </div>
  );
}
