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
        overrides: [],
        createdBy: "山田太郎",
      });
    });
    expect(vi.mocked(invoke)).toHaveBeenCalledWith("commit_changes", {
      message: "テストコミット",
      overrides: [],
      createdBy: "山田太郎",
    });
  });

  it("overridesを正しく渡す", async () => {
    const { result } = renderHook(() => useCommitChanges(), {
      wrapper: createWrapper(),
    });
    await act(async () => {
      await result.current.mutateAsync({
        message: "変更",
        overrides: ["図面A.pdf", "図面B.pdf"],
        createdBy: "鈴木花子",
      });
    });
    expect(vi.mocked(invoke)).toHaveBeenCalledWith("commit_changes", {
      message: "変更",
      overrides: ["図面A.pdf", "図面B.pdf"],
      createdBy: "鈴木花子",
    });
  });
});
