import { useGetCommitHistory } from "../../api/commitHistory";
import { useAppStore } from "../../store/useAppStore";

function formatTimestamp(ts: number): string {
  return new Date(ts * 1000).toLocaleString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function CommitHistoryPanel() {
  const selectedDrawing = useAppStore((s) => s.selectedDrawing);
  const { data: entries, isLoading } = useGetCommitHistory();

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
      <p className="text-xs text-muted-foreground mb-3">{selectedDrawing}</p>
      <ul className="space-y-2">
        {entries.map((entry) => (
          <li
            key={entry.oid}
            className="rounded border border-border p-3 text-sm"
          >
            <p className="font-medium">{entry.message}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {entry.author} · {formatTimestamp(entry.timestamp)}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
