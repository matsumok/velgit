import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useDrawingSelection } from "./useDrawingSelection";

describe("useDrawingSelection", () => {
  it("全ファイルがデフォルト選択済み", () => {
    const { result } = renderHook(() =>
      useDrawingSelection(["A.pdf", "B.pdf", "C.pdf"]),
    );
    expect(result.current.selectedFilenames).toEqual([
      "A.pdf",
      "B.pdf",
      "C.pdf",
    ]);
  });

  it("toggle で選択解除される", () => {
    const { result } = renderHook(() =>
      useDrawingSelection(["A.pdf", "B.pdf"]),
    );
    act(() => result.current.toggle("A.pdf"));
    expect(result.current.selectedFilenames).toEqual(["B.pdf"]);
  });

  it("toggle で再選択できる", () => {
    const { result } = renderHook(() =>
      useDrawingSelection(["A.pdf", "B.pdf"]),
    );
    act(() => result.current.toggle("A.pdf"));
    act(() => result.current.toggle("A.pdf"));
    expect(result.current.selectedFilenames).toEqual(["A.pdf", "B.pdf"]);
  });

  it("isSelected が正しい真偽値を返す", () => {
    const { result } = renderHook(() =>
      useDrawingSelection(["A.pdf", "B.pdf"]),
    );
    act(() => result.current.toggle("A.pdf"));
    expect(result.current.isSelected("A.pdf")).toBe(false);
    expect(result.current.isSelected("B.pdf")).toBe(true);
  });

  it("reset で全ファイルが再選択される", () => {
    const { result } = renderHook(() =>
      useDrawingSelection(["A.pdf", "B.pdf", "C.pdf"]),
    );
    act(() => result.current.toggle("A.pdf"));
    act(() => result.current.toggle("C.pdf"));
    act(() => result.current.reset());
    expect(result.current.selectedFilenames).toEqual([
      "A.pdf",
      "B.pdf",
      "C.pdf",
    ]);
  });

  it("空リストでも動作する", () => {
    const { result } = renderHook(() => useDrawingSelection([]));
    expect(result.current.selectedFilenames).toEqual([]);
  });

  it("新しいファイルが追加されると自動で選択済みになる", () => {
    let filenames = ["A.pdf"];
    const { result, rerender } = renderHook(() =>
      useDrawingSelection(filenames),
    );
    act(() => result.current.toggle("A.pdf"));

    filenames = ["A.pdf", "B.pdf"];
    rerender();

    expect(result.current.selectedFilenames).toEqual(["B.pdf"]);
    expect(result.current.isSelected("B.pdf")).toBe(true);
  });
});
