import type { Drawing } from "../api/drawings";
import type { PendingChange } from "../api/pendingChanges";

export type DrawingStatus = "new" | "modified" | "unchanged";

export interface DrawingWithStatus {
  filename: string;
  status: DrawingStatus;
  isMinor: boolean;
}

export function resolveDrawingStatuses(
  drawings: Drawing[],
  pendingChanges: PendingChange[],
): DrawingWithStatus[] {
  const changeMap = new Map(pendingChanges.map((c) => [c.filename, c]));

  const fromDrawings: DrawingWithStatus[] = drawings
    .filter((d) => changeMap.get(d.filename)?.status !== "deleted")
    .map((d) => {
      const change = changeMap.get(d.filename);
      return {
        filename: d.filename,
        status: (change?.status as DrawingStatus | undefined) ?? "unchanged",
        isMinor: change?.changeType === "minor",
      };
    });

  const newFiles: DrawingWithStatus[] = pendingChanges
    .filter((c) => c.status === "new")
    .map((c) => ({
      filename: c.filename,
      status: "new" as const,
      isMinor: false,
    }));

  return [...fromDrawings, ...newFiles].sort((a, b) =>
    a.filename.localeCompare(b.filename),
  );
}
