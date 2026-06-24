import { describe, expect, it } from "vitest";
import type { Drawing } from "../api/drawings";
import type { PendingChange } from "../api/pendingChanges";
import { resolveDrawingStatuses } from "./drawingStatus";

const drawing = (filename: string): Drawing => ({ filename, added_at: 0 });
const pending = (
  filename: string,
  status: PendingChange["status"],
  changeType: PendingChange["changeType"] = "meaningful",
): PendingChange => ({ filename, status, changeType });

describe("resolveDrawingStatuses", () => {
  it("空入力は空配列を返す", () => {
    expect(resolveDrawingStatuses([], [])).toEqual([]);
  });

  it("pending changes がない図面は unchanged・isMinor false", () => {
    const result = resolveDrawingStatuses([drawing("A-001.pdf")], []);
    expect(result).toEqual([
      { filename: "A-001.pdf", status: "unchanged", isMinor: false },
    ]);
  });

  it("meaningful modified は isMinor false", () => {
    const result = resolveDrawingStatuses(
      [drawing("A-001.pdf")],
      [pending("A-001.pdf", "modified", "meaningful")],
    );
    expect(result).toEqual([
      { filename: "A-001.pdf", status: "modified", isMinor: false },
    ]);
  });

  it("minor modified は isMinor true", () => {
    const result = resolveDrawingStatuses(
      [drawing("A-001.pdf")],
      [pending("A-001.pdf", "modified", "minor")],
    );
    expect(result).toEqual([
      { filename: "A-001.pdf", status: "modified", isMinor: true },
    ]);
  });

  it("deleted の図面は deleted ステータスで表示される", () => {
    const result = resolveDrawingStatuses(
      [drawing("A-001.pdf")],
      [pending("A-001.pdf", "deleted")],
    );
    expect(result).toEqual([
      { filename: "A-001.pdf", status: "deleted", isMinor: false },
    ]);
  });

  it("new ファイルは isMinor false", () => {
    const result = resolveDrawingStatuses([], [pending("A-001.pdf", "new")]);
    expect(result).toEqual([
      { filename: "A-001.pdf", status: "new", isMinor: false },
    ]);
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
        pending("B.pdf", "modified", "minor"),
        pending("C.pdf", "deleted"),
        pending("D.pdf", "new"),
      ],
    );
    expect(result).toEqual([
      { filename: "A.pdf", status: "unchanged", isMinor: false },
      { filename: "B.pdf", status: "modified", isMinor: true },
      { filename: "C.pdf", status: "deleted", isMinor: false },
      { filename: "D.pdf", status: "new", isMinor: false },
    ]);
  });
});
