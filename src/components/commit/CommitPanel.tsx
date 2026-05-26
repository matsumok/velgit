import { useEffect, useState } from "react";
import { useCommitChanges } from "../../api/pendingChanges";
import { useAppStore } from "../../store/useAppStore";
import { Button } from "../ui/button";
import { Textarea } from "../ui/textarea";

export function CommitPanel({
  selectedFilenames,
}: {
  selectedFilenames: string[];
}) {
  const { mutate: commitChanges, isPending, error } = useCommitChanges();
  const username = useAppStore((s) => s.username);
  const setBackgroundTask = useAppStore((s) => s.setBackgroundTask);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (isPending) setBackgroundTask("コミット中...");
  }, [isPending, setBackgroundTask]);

  function handleCommit() {
    if (!message.trim() || !username || selectedFilenames.length === 0) return;
    commitChanges(
      { message, includedFiles: selectedFilenames, createdBy: username },
      { onSuccess: () => setMessage("") },
    );
  }

  return (
    <div className="p-4 border-t flex flex-col gap-3">
      {error && <p className="text-xs text-destructive">{String(error)}</p>}
      <Textarea
        rows={3}
        placeholder="変更内容を入力..."
        value={message}
        onChange={(e) => setMessage(e.target.value)}
      />
      <Button
        onClick={handleCommit}
        disabled={
          !message.trim() ||
          isPending ||
          !username ||
          selectedFilenames.length === 0
        }
      >
        {isPending ? "コミット中..." : `コミット (${selectedFilenames.length})`}
      </Button>
    </div>
  );
}
