import { useState } from "react";
import { useAppStore } from "../store/useAppStore";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";

export function UsernameGate({ children }: { children: React.ReactNode }) {
  const { username, setUsername } = useAppStore();
  const [input, setInput] = useState("");

  if (username !== null) return <>{children}</>;

  function handleConfirm() {
    if (input.trim()) setUsername(input.trim());
  }

  return (
    <Dialog open={true} onOpenChange={() => {}}>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>ユーザー名を入力してください</DialogTitle>
          <DialogDescription>コミットと図渡しに記録されます</DialogDescription>
        </DialogHeader>
        <input
          type="text"
          className="w-full rounded border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          placeholder="例: 山田太郎"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleConfirm();
          }}
          // biome-ignore lint/a11y/noAutofocus: modal dialog requires immediate focus
          autoFocus
        />
        <Button disabled={!input.trim()} onClick={handleConfirm}>
          決定
        </Button>
      </DialogContent>
    </Dialog>
  );
}
