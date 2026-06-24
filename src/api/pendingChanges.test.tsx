import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { invoke } from "@tauri-apps/api/core";
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useCommitChanges } from "./pendingChanges";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn().mockResolvedValue(undefined),
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe("useCommitChanges", () => {
  beforeEach(() => {
    vi.mocked(invoke).mockClear();
  });

  it("commit_changesをcreatedByパラメータ付きで呼び出す", async () => {
    const { result } = renderHook(() => useCommitChanges(), {
      wrapper: createWrapper(),
    });
    await act(async () => {
      await result.current.mutateAsync({
        message: "テストコミット",
        includedFiles: [],
        createdBy: "山田太郎",
      });
    });
    expect(vi.mocked(invoke)).toHaveBeenCalledWith("commit_changes", {
      message: "テストコミット",
      includedFiles: [],
      predecessors: [],
      createdBy: "山田太郎",
    });
  });

  it("includedFilesを正しく渡す", async () => {
    const { result } = renderHook(() => useCommitChanges(), {
      wrapper: createWrapper(),
    });
    await act(async () => {
      await result.current.mutateAsync({
        message: "変更",
        includedFiles: ["図面A.pdf", "図面B.pdf"],
        createdBy: "鈴木花子",
      });
    });
    expect(vi.mocked(invoke)).toHaveBeenCalledWith("commit_changes", {
      message: "変更",
      includedFiles: ["図面A.pdf", "図面B.pdf"],
      predecessors: [],
      createdBy: "鈴木花子",
    });
  });

  it("predecessorsを指定するとinvokeに渡す", async () => {
    const { result } = renderHook(() => useCommitChanges(), {
      wrapper: createWrapper(),
    });
    await act(async () => {
      await result.current.mutateAsync({
        message: "図番改訂",
        includedFiles: ["201_AA.pdf"],
        predecessors: [{ successor: "201_AA.pdf", predecessor: "101_AA.pdf" }],
        createdBy: "山田太郎",
      });
    });
    expect(vi.mocked(invoke)).toHaveBeenCalledWith("commit_changes", {
      message: "図番改訂",
      includedFiles: ["201_AA.pdf"],
      predecessors: [{ successor: "201_AA.pdf", predecessor: "101_AA.pdf" }],
      createdBy: "山田太郎",
    });
  });

  it("predecessors未指定のとき空配列をinvokeに渡す", async () => {
    const { result } = renderHook(() => useCommitChanges(), {
      wrapper: createWrapper(),
    });
    await act(async () => {
      await result.current.mutateAsync({
        message: "通常コミット",
        includedFiles: ["A-001.pdf"],
        createdBy: "鈴木花子",
      });
    });
    expect(vi.mocked(invoke)).toHaveBeenCalledWith("commit_changes", {
      message: "通常コミット",
      includedFiles: ["A-001.pdf"],
      predecessors: [],
      createdBy: "鈴木花子",
    });
  });
});
