import { useState } from "react";
import { useGetCommitHistory } from "../../api/commitHistory";
import { useGetPdfImage } from "../../api/pdfImage";
import { useAppStore } from "../../store/useAppStore";
import { cn } from "../../lib/utils";
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

export function CommitHistoryPanel() {
  const selectedDrawing = useAppStore((s) => s.selectedDrawing);
  const { data: entries, isLoading } = useGetCommitHistory();
  const {
    mutate: loadImage,
    isPending,
    error,
    data: imageUrl,
  } = useGetPdfImage();
  const [selectedOid, setSelectedOid] = useState<string | null>(null);

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

  function handleSelectCommit(oid: string) {
    setSelectedOid(oid);
    loadImage({ filename: selectedDrawing!, oid });
  }

  return (
    <div className="p-4">
      <p className="text-xs text-muted-foreground mb-3">{selectedDrawing}</p>
      <ul className="space-y-2 mb-4">
        {entries.map((entry) => (
          <li
            key={entry.oid}
            className={cn(
              "rounded border p-3 text-sm cursor-pointer hover:bg-muted transition-colors",
              selectedOid === entry.oid
                ? "border-primary bg-primary/5"
                : "border-border",
            )}
            onClick={() => handleSelectCommit(entry.oid)}
          >
            <p className="font-medium">{entry.message}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {entry.author} · {formatTimestamp(entry.timestamp)}
            </p>
          </li>
        ))}
      </ul>
      <DiffView
        imageUrl={imageUrl ?? null}
        isLoading={isPending}
        error={error ? String(error) : null}
      />
    </div>
  );
}
