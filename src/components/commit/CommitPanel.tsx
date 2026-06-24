import { useEffect, useState } from "react";
import { useGetHeadFiles } from "../../api/headFiles";
import { useCommitChanges } from "../../api/pendingChanges";
import { useAppStore } from "../../store/useAppStore";
import { Button } from "../ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";
import { Textarea } from "../ui/textarea";

export function CommitPanel({
  selectedFilenames,
}: {
  selectedFilenames: string[];
}) {
  const { mutate: commitChanges, isPending, error } = useCommitChanges();
  const { data: headFiles = [] } = useGetHeadFiles();
  const username = useAppStore((s) => s.username);
  const setBackgroundTask = useAppStore((s) => s.setBackgroundTask);
  const [message, setMessage] = useState("");
  const [predecessors, setPredecessors] = useState<Map<string, string>>(
    new Map(),
  );
  const [dialogOpenFor, setDialogOpenFor] = useState<string | null>(null);

  useEffect(() => {
    if (isPending) setBackgroundTask("コミット中...");
  }, [isPending, setBackgroundTask]);

  useEffect(() => {
    if (error) setBackgroundTask(null);
  }, [error, setBackgroundTask]);

  const usedPredecessors = new Set(predecessors.values());

  function handleCommit() {
    if (!message.trim() || !username || selectedFilenames.length === 0) return;
    const predecessorPairs = Array.from(predecessors.entries()).map(
      ([successor, predecessor]) => ({ successor, predecessor }),
    );
    commitChanges(
      {
        message,
        includedFiles: selectedFilenames,
        predecessors: predecessorPairs,
        createdBy: username,
      },
      {
        onSuccess: () => {
          setMessage("");
          setPredecessors(new Map());
        },
      },
    );
  }

  function handleSelectPredecessor(predecessor: string) {
    if (!dialogOpenFor) return;
    setPredecessors((prev) => new Map(prev).set(dialogOpenFor, predecessor));
    setDialogOpenFor(null);
  }

  const candidates = headFiles.filter(
    (f) => f !== dialogOpenFor && !usedPredecessors.has(f),
  );

  return (
    <div className="p-4 border-t flex flex-col gap-3">
      {error && <p className="text-xs text-destructive">{String(error)}</p>}

      {selectedFilenames.map((filename) => {
        const predecessor = predecessors.get(filename);
        return (
          <div key={filename} className="flex items-center gap-2 text-xs">
            <span className="truncate flex-1">{filename}</span>
            <Button
              variant="ghost"
              size="sm"
              aria-label={`${filename} の引き継ぎ元を設定`}
              onClick={() => setDialogOpenFor(filename)}
            >
              {predecessor ?? "引き継ぎ元設定"}
            </Button>
          </div>
        );
      })}

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

      <Dialog
        open={dialogOpenFor !== null}
        onOpenChange={(open) => {
          if (!open) setDialogOpenFor(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>引き継ぎ元を選択</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-1">
            {candidates.map((f) => (
              <Button
                key={f}
                variant="ghost"
                size="sm"
                onClick={() => handleSelectPredecessor(f)}
              >
                {f}
              </Button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
