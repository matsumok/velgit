import { useState } from "react";
import { useCommitChanges } from "../../api/pendingChanges";
import { cn } from "../../lib/utils";
import { useAppStore } from "../../store/useAppStore";

export function CommitPanel({
  selectedFilenames,
  onCommitSuccess,
}: {
  selectedFilenames: string[];
  onCommitSuccess: () => void;
}) {
  const { mutate: commitChanges, isPending, error } = useCommitChanges();
  const username = useAppStore((s) => s.username);
  const [message, setMessage] = useState("");

  function handleCommit() {
    if (!message.trim() || !username || selectedFilenames.length === 0) return;
    commitChanges(
      { message, includedFiles: selectedFilenames, createdBy: username },
      {
        onSuccess: () => {
          setMessage("");
          onCommitSuccess();
        },
      },
    );
  }

  return (
    <div className="p-4 border-t flex flex-col gap-3">
      {error && <p className="text-xs text-destructive">{String(error)}</p>}
      <textarea
        className="w-full rounded border border-input bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-ring"
        rows={3}
        placeholder="変更内容を入力..."
        value={message}
        onChange={(e) => setMessage(e.target.value)}
      />
      <button
        type="button"
        onClick={handleCommit}
        disabled={
          !message.trim() ||
          isPending ||
          !username ||
          selectedFilenames.length === 0
        }
        className={cn(
          "px-4 py-2 rounded text-sm bg-primary text-primary-foreground",
          (!message.trim() ||
            isPending ||
            !username ||
            selectedFilenames.length === 0) &&
            "opacity-50 cursor-not-allowed",
        )}
      >
        {isPending ? "コミット中..." : `コミット (${selectedFilenames.length})`}
      </button>
    </div>
  );
}
