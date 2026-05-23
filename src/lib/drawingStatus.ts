import type { Drawing } from "../api/drawings";
import type { PendingChange } from "../api/pendingChanges";

export type DrawingStatus = "new" | "modified" | "unchanged";

export interface DrawingWithStatus {
  filename: string;
  status: DrawingStatus;
}

export function resolveDrawingStatuses(
  drawings: Drawing[],
  pendingChanges: PendingChange[],
): DrawingWithStatus[] {
  const changeMap = new Map(pendingChanges.map((c) => [c.filename, c.status]));

  const fromDrawings: DrawingWithStatus[] = drawings
    .filter((d) => changeMap.get(d.filename) !== "deleted")
    .map((d) => ({
      filename: d.filename,
      status:
        (changeMap.get(d.filename) as DrawingStatus | undefined) ?? "unchanged",
    }));

  const newFiles: DrawingWithStatus[] = pendingChanges
    .filter((c) => c.status === "new")
    .map((c) => ({ filename: c.filename, status: "new" as const }));

  return [...fromDrawings, ...newFiles].sort((a, b) =>
    a.filename.localeCompare(b.filename),
  );
}
