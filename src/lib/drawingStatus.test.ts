import { describe, expect, it } from "vitest";
import type { Drawing } from "../api/drawings";
import type { PendingChange } from "../api/pendingChanges";
import { resolveDrawingStatuses } from "./drawingStatus";

const drawing = (filename: string): Drawing => ({ filename, added_at: 0 });
const pending = (
  filename: string,
  status: PendingChange["status"],
): PendingChange => ({
  filename,
  status,
  changeType: "meaningful",
});

describe("resolveDrawingStatuses", () => {
  it("空入力は空配列を返す", () => {
    expect(resolveDrawingStatuses([], [])).toEqual([]);
  });

  it("pending changes がない図面は unchanged", () => {
    const result = resolveDrawingStatuses([drawing("A-001.pdf")], []);
    expect(result).toEqual([{ filename: "A-001.pdf", status: "unchanged" }]);
  });

  it("modified の pending change がある図面は modified", () => {
    const result = resolveDrawingStatuses(
      [drawing("A-001.pdf")],
      [pending("A-001.pdf", "modified")],
    );
    expect(result).toEqual([{ filename: "A-001.pdf", status: "modified" }]);
  });

  it("deleted の図面はリストから除外される", () => {
    const result = resolveDrawingStatuses(
      [drawing("A-001.pdf")],
      [pending("A-001.pdf", "deleted")],
    );
    expect(result).toEqual([]);
  });

  it("drawings にない new ファイルはリストに追加される", () => {
    const result = resolveDrawingStatuses([], [pending("A-001.pdf", "new")]);
    expect(result).toEqual([{ filename: "A-001.pdf", status: "new" }]);
  });

  it("ファイル名の昇順でソートされる", () => {
    const result = resolveDrawingStatuses(
      [drawing("S-001.pdf"), drawing("A-001.pdf")],
      [pending("Z-001.pdf", "new")],
    );
    expect(result.map((d) => d.filename)).toEqual([
      "A-001.pdf",
      "S-001.pdf",
      "Z-001.pdf",
    ]);
  });

  it("new/modified/deleted/unchanged が混在する場合", () => {
    const result = resolveDrawingStatuses(
      [drawing("A.pdf"), drawing("B.pdf"), drawing("C.pdf")],
      [
        pending("B.pdf", "modified"),
        pending("C.pdf", "deleted"),
        pending("D.pdf", "new"),
      ],
    );
    expect(result).toEqual([
      { filename: "A.pdf", status: "unchanged" },
      { filename: "B.pdf", status: "modified" },
      { filename: "D.pdf", status: "new" },
    ]);
  });
});
