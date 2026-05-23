import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useGenerateBindPdf, useListReleases } from "../api/releases";
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

const mockGeneratePdf = vi.fn().mockResolvedValue(undefined);

vi.mock("../api/releases", () => ({
  useListReleases: vi.fn(() => ({ data: MOCK_RELEASES })),
  useGetReleaseDrawings: vi.fn(() => ({
    data: ["A-001_平面図.pdf", "S-001_伏図.pdf"],
  })),
  useCreateRelease: vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false })),
  useGenerateBindPdf: vi.fn(() => ({
    mutateAsync: mockGeneratePdf,
    isPending: false,
  })),
}));

vi.mock("@tauri-apps/plugin-dialog", () => ({
  save: vi.fn().mockResolvedValue("/path/to/output.pdf"),
  open: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useListReleases).mockReturnValue({
    data: MOCK_RELEASES,
  } as unknown as ReturnType<typeof useListReleases>);
  vi.mocked(useGenerateBindPdf).mockReturnValue({
    mutateAsync: mockGeneratePdf,
    isPending: false,
  } as unknown as ReturnType<typeof useGenerateBindPdf>);
  mockGeneratePdf.mockResolvedValue(undefined);
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

  it("各エントリに「バインドPDF生成」ボタンが表示される", () => {
    render(<ReleaseHistoryPanel />);
    expect(
      screen.getAllByRole("button", { name: "バインドPDF生成" }),
    ).toHaveLength(2);
  });

  it("バインドPDF生成ボタンクリックでsaveダイアログが開き生成コマンドを呼ぶ", async () => {
    const user = userEvent.setup();
    render(<ReleaseHistoryPanel />);
    const buttons = screen.getAllByRole("button", { name: "バインドPDF生成" });
    await user.click(buttons[0]);
    expect(mockGeneratePdf).toHaveBeenCalledWith({
      releaseId: 1,
      savePath: "/path/to/output.pdf",
    });
  });

  it("isPendingのときボタンがローディング状態になる", () => {
    vi.mocked(useGenerateBindPdf).mockReturnValue({
      mutateAsync: mockGeneratePdf,
      isPending: true,
    } as unknown as ReturnType<typeof useGenerateBindPdf>);
    render(<ReleaseHistoryPanel />);
    expect(screen.getAllByRole("button", { name: "生成中..." })).toHaveLength(
      2,
    );
  });
});
