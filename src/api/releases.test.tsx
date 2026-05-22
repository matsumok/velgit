import { renderHook, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { vi, describe, it, expect, beforeEach } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import { useCreateRelease } from "./releases";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn().mockResolvedValue(1),
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe("useCreateRelease", () => {
  beforeEach(() => {
    vi.mocked(invoke).mockClear();
  });

  it("create_releaseをすべてのパラメータ付きで呼び出す", async () => {
    const { result } = renderHook(() => useCreateRelease(), {
      wrapper: createWrapper(),
    });
    await act(async () => {
      await result.current.mutateAsync({
        name: "実施設計第1回",
        kind: "internal",
        recipient: null,
        drawingFilenames: ["A-001_平面図.pdf"],
        createdBy: "山田太郎",
      });
    });
    expect(vi.mocked(invoke)).toHaveBeenCalledWith("create_release", {
      name: "実施設計第1回",
      kind: "internal",
      recipient: null,
      drawingFilenames: ["A-001_平面図.pdf"],
      createdBy: "山田太郎",
    });
  });
});
