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
import { Input } from "./ui/input";

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
          <DialogDescription>コミットに記録されます</DialogDescription>
        </DialogHeader>
        <Input
          placeholder="Username"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleConfirm();
          }}
          autoFocus
        />
        <Button disabled={!input.trim()} onClick={handleConfirm}>
          決定
        </Button>
      </DialogContent>
    </Dialog>
  );
}
