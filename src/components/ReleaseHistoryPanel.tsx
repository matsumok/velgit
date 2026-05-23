import { save } from "@tauri-apps/plugin-dialog";
import { useState } from "react";
import {
  type ReleaseEntry,
  useGenerateBindPdf,
  useGetReleaseDrawings,
  useListReleases,
} from "../api/releases";
import { cn } from "../lib/utils";

function DrawingList({ releaseId }: { releaseId: number }) {
  const { data: filenames } = useGetReleaseDrawings(releaseId);
  return (
    <ul className="mt-2 ml-4 mb-2 space-y-0.5">
      {(filenames ?? []).map((f) => (
        <li key={f} className="text-xs text-muted-foreground">
          {f}
        </li>
      ))}
    </ul>
  );
}

function ReleaseRow({ entry }: { entry: ReleaseEntry }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { mutateAsync: generatePdf, isPending } = useGenerateBindPdf();
  const date = new Date(entry.createdAt * 1000).toLocaleDateString("ja-JP");

  async function handleGeneratePdf(e: React.MouseEvent) {
    e.stopPropagation();
    setError(null);
    const savePath = await save({
      defaultPath: `${entry.name}.pdf`,
      filters: [{ name: "PDF", extensions: ["pdf"] }],
    });
    if (!savePath) return;
    try {
      await generatePdf({ releaseId: entry.id, savePath });
    } catch (err) {
      setError(String(err));
    }
  }

  return (
    <div className="border-b last:border-b-0">
      <div className="flex items-center gap-2 px-3 py-2">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex-1 flex flex-wrap items-center gap-2 text-left text-xs min-w-0"
        >
          <span className="font-medium text-sm">{entry.name}</span>
          <span
            className={cn(
              "px-1.5 py-0.5 rounded text-xs shrink-0",
              entry.kind === "internal"
                ? "bg-muted text-muted-foreground"
                : "bg-blue-100 text-blue-700",
            )}
          >
            {entry.kind === "internal" ? "社内" : "社外"}
          </span>
          {entry.recipient && (
            <span className="text-muted-foreground">{entry.recipient}</span>
          )}
          <span className="text-muted-foreground ml-auto">{date}</span>
          <span className="text-muted-foreground">{entry.drawingCount}件</span>
        </button>
        <button
          type="button"
          disabled={isPending}
          onClick={handleGeneratePdf}
          className={cn(
            "shrink-0 px-2 py-1 rounded text-xs bg-secondary text-secondary-foreground hover:bg-secondary/80",
            isPending && "opacity-50 cursor-not-allowed",
          )}
        >
          {isPending ? "生成中..." : "バインドPDF生成"}
        </button>
      </div>
      {error && <p className="px-3 pb-2 text-xs text-destructive">{error}</p>}
      {open && <DrawingList releaseId={entry.id} />}
    </div>
  );
}

export function ReleaseHistoryPanel() {
  const { data: releases } = useListReleases();

  if (!releases || releases.length === 0) {
    return (
      <div className="p-4 border-t">
        <p className="text-xs text-muted-foreground mb-2">図渡し履歴</p>
        <p className="text-sm text-muted-foreground">図渡しがありません</p>
      </div>
    );
  }

  return (
    <div className="p-4 border-t">
      <p className="text-xs text-muted-foreground mb-2">図渡し履歴</p>
      <div className="border rounded">
        {releases.map((entry) => (
          <ReleaseRow key={entry.id} entry={entry} />
        ))}
      </div>
    </div>
  );
}
