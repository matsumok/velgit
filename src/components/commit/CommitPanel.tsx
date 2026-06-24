import { GitPullRequestIcon } from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import { useGetHeadFiles } from "../../api/headFiles";
import { useCommitChanges } from "../../api/pendingChanges";
import { cn } from "../../lib/utils";
import { useAppStore } from "../../store/useAppStore";
import { Button } from "../ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";
import { Table, TableBody, TableCell, TableRow } from "../ui/table";
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

  function handleSelectPredecessor(predecessor: string | null) {
    if (!dialogOpenFor) return;
    setPredecessors((prev) => {
      const next = new Map(prev);
      if (predecessor === null) {
        next.delete(dialogOpenFor);
      } else {
        next.set(dialogOpenFor, predecessor);
      }
      return next;
    });
    setDialogOpenFor(null);
  }

  // 現在開いているファイルの選択済み predecessor（他ファイルの除外対象だが自身は表示する）
  const currentPredecessor = dialogOpenFor
    ? predecessors.get(dialogOpenFor)
    : undefined;
  const candidates = headFiles.filter(
    (f) =>
      f !== dialogOpenFor &&
      (!usedPredecessors.has(f) || f === currentPredecessor),
  );

  return (
    <div className="border-t flex flex-col">
      {error && (
        <p className="text-xs text-destructive px-4 pt-2">{String(error)}</p>
      )}

      {/* ファイル一覧 — テーブルと同程度の行密度 */}
      <Table>
        <TableBody>
          {selectedFilenames.map((filename) => {
            const predecessor = predecessors.get(filename);
            return (
              <TableRow
                key={filename}
                className="border-0 hover:bg-transparent"
              >
                <TableCell className="py-1 text-xs pl-4 pr-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="truncate flex-1">{filename}</span>
                    {predecessor && (
                      <span className="text-muted-foreground shrink-0 truncate max-w-28">
                        ← {predecessor}
                      </span>
                    )}
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`${filename} の引き継ぎ元を設定`}
                      title={
                        predecessor
                          ? `引き継ぎ元: ${predecessor}`
                          : "引き継ぎ元を設定"
                      }
                      onClick={() => setDialogOpenFor(filename)}
                      className={cn(
                        "h-5 w-5 shrink-0",
                        predecessor && "text-primary",
                      )}
                    >
                      <GitPullRequestIcon size={12} />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      {/* テキストエリア・コミットボタン */}
      <div className="p-4 flex flex-col gap-3">
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
          {isPending
            ? "コミット中..."
            : `コミット (${selectedFilenames.length})`}
        </Button>
      </div>

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
          <div className="flex flex-col gap-0.5 p-1">
            {/* クリア選択肢 */}
            <button
              type="button"
              onClick={() => handleSelectPredecessor(null)}
              className={cn(
                "text-left text-xs py-2 px-3 rounded-md transition-colors",
                "text-muted-foreground hover:bg-primary/10 hover:text-foreground",
                !currentPredecessor &&
                  "bg-primary/10 text-foreground font-medium",
              )}
            >
              設定しない
            </button>
            <div className="h-px bg-border my-1" />
            {candidates.map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => handleSelectPredecessor(f)}
                className={cn(
                  "text-left text-xs py-2 px-3 rounded-md transition-colors",
                  "hover:bg-primary/10 hover:text-primary",
                  f === currentPredecessor &&
                    "bg-primary/15 text-primary font-medium",
                )}
              >
                {f}
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
