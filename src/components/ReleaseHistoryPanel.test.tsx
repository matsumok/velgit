import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi, describe, it, expect, beforeEach } from "vitest";
import { useListReleases } from "../api/releases";
import { ReleaseHistoryPanel } from "./ReleaseHistoryPanel";

const MOCK_RELEASES = [
  {
    id: 1,
    name: "実施設計第2回",
    kind: "external",
    recipient: "〇〇建設",
    commitOid: "abc123",
    createdAt: 1700000100,
    createdBy: "山田太郎",
    drawingCount: 2,
  },
  {
    id: 2,
    name: "実施設計第1回",
    kind: "internal",
    recipient: null,
    commitOid: "def456",
    createdAt: 1700000000,
    createdBy: "山田太郎",
    drawingCount: 1,
  },
];

vi.mock("../api/releases", () => ({
  useListReleases: vi.fn(() => ({ data: MOCK_RELEASES })),
  useGetReleaseDrawings: vi.fn(() => ({
    data: ["A-001_平面図.pdf", "S-001_伏図.pdf"],
  })),
  useCreateRelease: vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false })),
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useListReleases).mockReturnValue({
    data: MOCK_RELEASES,
  } as unknown as ReturnType<typeof useListReleases>);
});

describe("ReleaseHistoryPanel", () => {
  it("図渡しが0件のとき「図渡しがありません」を表示する", () => {
    vi.mocked(useListReleases).mockReturnValueOnce({
      data: [],
    } as unknown as ReturnType<typeof useListReleases>);
    render(<ReleaseHistoryPanel />);
    expect(screen.getByText("図渡しがありません")).toBeInTheDocument();
  });

  it("各エントリに名称・図面数が表示される", () => {
    render(<ReleaseHistoryPanel />);
    expect(screen.getByText("実施設計第2回")).toBeInTheDocument();
    expect(screen.getByText("実施設計第1回")).toBeInTheDocument();
    expect(screen.getByText("2件")).toBeInTheDocument();
    expect(screen.getByText("1件")).toBeInTheDocument();
  });

  it("種別バッジが正しく表示される", () => {
    render(<ReleaseHistoryPanel />);
    expect(screen.getByText("社外")).toBeInTheDocument();
    expect(screen.getByText("社内")).toBeInTheDocument();
  });

  it("相手先がある場合に表示される", () => {
    render(<ReleaseHistoryPanel />);
    expect(screen.getByText("〇〇建設")).toBeInTheDocument();
  });

  it("エントリをクリックすると図面ファイル名一覧が展開される", async () => {
    const user = userEvent.setup();
    render(<ReleaseHistoryPanel />);
    await user.click(screen.getByRole("button", { name: /実施設計第2回/ }));
    expect(screen.getByText("A-001_平面図.pdf")).toBeInTheDocument();
    expect(screen.getByText("S-001_伏図.pdf")).toBeInTheDocument();
  });

  it("展開済みエントリを再クリックすると折りたたまれる", async () => {
    const user = userEvent.setup();
    render(<ReleaseHistoryPanel />);
    await user.click(screen.getByRole("button", { name: /実施設計第2回/ }));
    await user.click(screen.getByRole("button", { name: /実施設計第2回/ }));
    expect(screen.queryByText("A-001_平面図.pdf")).not.toBeInTheDocument();
  });
});
