import { useState } from "react";
import { cn } from "../lib/utils";
import {
  useListReleases,
  useGetReleaseDrawings,
  type ReleaseEntry,
} from "../api/releases";

function DrawingList({ releaseId }: { releaseId: number }) {
  const { data: filenames } = useGetReleaseDrawings(releaseId);
  return (
    <ul className="mt-2 ml-4 space-y-0.5">
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
  const date = new Date(entry.createdAt * 1000).toLocaleDateString("ja-JP");

  return (
    <div className="border-b last:border-b-0">
      <button
        type="button"
        aria-label={entry.name}
        onClick={() => setOpen((o) => !o)}
        className="w-full flex flex-wrap items-center gap-2 px-3 py-2 text-left hover:bg-muted text-xs"
      >
        <span className="font-medium text-sm">{entry.name}</span>
        <span
          className={cn(
            "px-1.5 py-0.5 rounded text-xs",
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
