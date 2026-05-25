import { GitBranchIcon, MoonIcon, SunIcon } from "@phosphor-icons/react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/store/useAppStore";

export function AppHeader() {
  const { username, setUsername, theme, setTheme } = useAppStore();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");

  function handleSave() {
    if (!input.trim()) return;
    setUsername(input.trim());
    setOpen(false);
  }

  return (
    <header className="shrink-0 flex items-center justify-between px-4 h-10 border-b bg-background">
      <div className="flex items-center gap-2">
        <GitBranchIcon className="size-4 text-primary" />
        <span className="text-sm font-semibold tracking-tight">velgit</span>
      </div>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => {
            setInput(username ?? "");
            setOpen(true);
          }}
          className="text-xs px-2 py-1 rounded hover:bg-muted"
        >
          {username}
        </button>
        <button
          type="button"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          className="p-1.5 rounded hover:bg-muted"
          aria-label="テーマ切替"
        >
          {theme === "dark" ? (
            <SunIcon className="size-4" />
          ) : (
            <MoonIcon className="size-4" />
          )}
        </button>
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>ユーザー名を変更</DialogTitle>
          </DialogHeader>
          <input
            type="text"
            className={cn(
              "w-full rounded border border-input bg-background px-3 py-2 text-sm",
              "focus:outline-none focus:ring-1 focus:ring-ring",
            )}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSave();
              if (e.key === "Escape") setOpen(false);
            }}
            autoFocus
          />
          <Button disabled={!input.trim()} onClick={handleSave}>
            保存
          </Button>
        </DialogContent>
      </Dialog>
    </header>
  );
}
