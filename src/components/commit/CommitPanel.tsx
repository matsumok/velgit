import { GitPullRequestIcon } from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import { useGetHeadFiles } from "../../api/headFiles";
import {
  useCommitChanges,
  useGetPendingChanges,
} from "../../api/pendingChanges";
import { cn } from "../../lib/utils";
import { useAppStore } from "../../store/useAppStore";
import { Button } from "../ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "../ui/command";
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
  const { data: pendingChanges = [] } = useGetPendingChanges();
  const statusMap = new Map(pendingChanges.map((c) => [c.filename, c.status]));
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
      selectedFilenames.includes(f) &&
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
            const status = statusMap.get(filename);
            const isDeleted = status === "deleted";
            return (
              <TableRow
                key={filename}
                className="border-0 hover:bg-transparent"
              >
                <TableCell className="py-1 text-xs pl-4 pr-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    {status === "new" && (
                      <span className="shrink-0 px-1 rounded text-xs bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
                        新規
                      </span>
                    )}
                    <span
                      className={cn(
                        "truncate flex-1",
                        isDeleted && "line-through opacity-50",
                      )}
                    >
                      {filename}
                    </span>
                    {predecessor && !isDeleted && (
                      <span className="text-muted-foreground shrink-0 truncate max-w-28">
                        ← {predecessor}
                      </span>
                    )}
                    {!isDeleted && (
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
                    )}
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
        <DialogContent
          showCloseButton={false}
          className="p-0 gap-0 overflow-hidden"
        >
          <DialogHeader className="px-4 pt-4 pb-2">
            <DialogTitle>引き継ぎ元を選択</DialogTitle>
            {dialogOpenFor && (
              <p className="text-xs text-muted-foreground truncate">
                {dialogOpenFor}
              </p>
            )}
          </DialogHeader>
          <Command>
            <CommandInput placeholder="ファイル名で絞り込み..." />
            <CommandList>
              <CommandEmpty>候補がありません</CommandEmpty>
              {/* クリア選択肢は検索対象外として常に表示 */}
              <CommandGroup>
                <CommandItem
                  value="__none__"
                  keywords={[]}
                  onSelect={() => handleSelectPredecessor(null)}
                  className={cn(
                    "text-muted-foreground",
                    !currentPredecessor && "font-medium text-foreground",
                  )}
                >
                  設定しない
                </CommandItem>
              </CommandGroup>
              <CommandSeparator />
              <CommandGroup>
                {candidates.map((f) => (
                  <CommandItem
                    key={f}
                    value={f}
                    onSelect={() => handleSelectPredecessor(f)}
                    className={cn(
                      f === currentPredecessor && "font-medium text-primary",
                    )}
                  >
                    {f}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </DialogContent>
      </Dialog>
    </div>
  );
}
