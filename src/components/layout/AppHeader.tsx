import { GitBranchIcon, MoonIcon, SunIcon } from "@phosphor-icons/react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setInput(username ?? "");
            setOpen(true);
          }}
        >
          {username}
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          aria-label="テーマ切替"
        >
          {theme === "dark" ? (
            <SunIcon className="size-4" />
          ) : (
            <MoonIcon className="size-4" />
          )}
        </Button>
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>ユーザー名を変更</DialogTitle>
          </DialogHeader>
          <Input
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
