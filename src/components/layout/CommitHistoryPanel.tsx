import { useGetCommitHistory } from "../../api/commitHistory";
import { useCommitPairDiff } from "../../hooks/useDiffSelection";
import { cn } from "../../lib/utils";
import { useAppStore } from "../../store/useAppStore";
import { DiffView } from "./DiffView";

function formatTimestamp(ts: number): string {
  return new Date(ts * 1000).toLocaleString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const CHANGE_TYPE_LABEL: Record<string, string> = {
  none: "変更なし",
  minor: "微小変更",
  meaningful: "意味的変更",
};

export function CommitHistoryPanel() {
  const selectedDrawing = useAppStore((s) => s.selectedDrawing);
  const { data: entries, isLoading } = useGetCommitHistory();
  const {
    selectCommit,
    isCommitSelected,
    diffResult,
    isLoading: isPending,
    error,
  } = useCommitPairDiff(selectedDrawing ?? "");

  if (!selectedDrawing) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-muted-foreground">図面を選択してください</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-muted-foreground">読み込み中...</p>
      </div>
    );
  }

  if (!entries || entries.length === 0) {
    return (
      <div className="p-4">
        <p className="text-xs text-muted-foreground mb-2">{selectedDrawing}</p>
        <p className="text-sm text-muted-foreground">
          コミット履歴がありません
        </p>
      </div>
    );
  }

  return (
    <div className="p-4">
      <p className="text-xs text-muted-foreground mb-1">{selectedDrawing}</p>
      <p className="text-xs text-muted-foreground mb-3">
        1クリック目: 旧版を選択 / 2クリック目: 新版を選択して差分を表示
      </p>
      <ul className="space-y-2 mb-4">
        {entries.map((entry) => (
          <li key={entry.oid}>
            <button
              type="button"
              className={cn(
                "w-full text-left rounded border p-3 text-sm cursor-pointer hover:bg-muted transition-colors",
                isCommitSelected(entry.oid)
                  ? "border-primary bg-primary/5"
                  : "border-border",
              )}
              onClick={() => selectCommit(entry.oid)}
            >
              <p className="font-medium">{entry.message}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {entry.author} · {formatTimestamp(entry.timestamp)}
              </p>
            </button>
          </li>
        ))}
      </ul>
      {diffResult && (
        <p className="text-xs text-muted-foreground mb-2">
          {CHANGE_TYPE_LABEL[diffResult.changeType] ?? diffResult.changeType}
        </p>
      )}
      <DiffView
        imageUrl={diffResult?.url ?? null}
        isLoading={isPending}
        error={error ? String(error) : null}
      />
    </div>
  );
}
