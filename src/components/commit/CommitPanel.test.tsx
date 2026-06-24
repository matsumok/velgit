import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useAppStore } from "../../store/useAppStore";
import { CommitPanel } from "./CommitPanel";

const mockMutate = vi.fn();

vi.mock("../../api/pendingChanges", () => ({
  useCommitChanges: vi.fn(() => ({
    mutate: mockMutate,
    isPending: false,
    error: null,
  })),
}));

vi.mock("../../api/headFiles", () => ({
  useGetHeadFiles: vi.fn(() => ({
    data: ["101_AA.pdf", "101_BB.pdf", "102_CC.pdf"],
    isLoading: false,
  })),
}));

const DEFAULT_FILES = ["201_AA.pdf", "201_BB.pdf"];

function renderPanel(selectedFilenames = DEFAULT_FILES) {
  return render(<CommitPanel selectedFilenames={selectedFilenames} />);
}

beforeEach(() => {
  localStorage.clear();
  useAppStore.setState({ username: "山田太郎" });
  mockMutate.mockClear();
});

describe("CommitPanel — 引き継ぎ元設定", () => {
  it("コミット対象ファイルの各行に引き継ぎ元設定ボタンが表示される", () => {
    renderPanel();
    expect(
      screen.getByRole("button", { name: "201_AA.pdf の引き継ぎ元を設定" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "201_BB.pdf の引き継ぎ元を設定" }),
    ).toBeInTheDocument();
  });

  it("引き継ぎ元設定ボタンをクリックすると Dialog が開き HEAD ファイルが選択肢に表示される", async () => {
    const user = userEvent.setup();
    renderPanel(["201_AA.pdf"]);
    await user.click(
      screen.getByRole("button", { name: "201_AA.pdf の引き継ぎ元を設定" }),
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "101_AA.pdf" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "101_BB.pdf" }),
    ).toBeInTheDocument();
  });

  it("predecessor を選択するとボタンに旧ファイル名が表示される", async () => {
    const user = userEvent.setup();
    renderPanel(["201_AA.pdf"]);
    await user.click(
      screen.getByRole("button", { name: "201_AA.pdf の引き継ぎ元を設定" }),
    );
    await user.click(screen.getByRole("button", { name: "101_AA.pdf" }));
    expect(
      screen.getByRole("button", { name: "201_AA.pdf の引き継ぎ元を設定" }),
    ).toHaveTextContent("101_AA.pdf");
  });

  it("コミット時に設定した predecessors が渡される", async () => {
    const user = userEvent.setup();
    renderPanel(["201_AA.pdf"]);
    await user.click(
      screen.getByRole("button", { name: "201_AA.pdf の引き継ぎ元を設定" }),
    );
    await user.click(screen.getByRole("button", { name: "101_AA.pdf" }));
    await user.type(screen.getByRole("textbox"), "図番改訂");
    await user.click(screen.getByRole("button", { name: /コミット/ }));
    expect(mockMutate).toHaveBeenCalledWith(
      expect.objectContaining({
        predecessors: [{ successor: "201_AA.pdf", predecessor: "101_AA.pdf" }],
      }),
      expect.anything(),
    );
  });

  it("自ファイルと同名の HEAD ファイルは候補から除外される", async () => {
    const user = userEvent.setup();
    // HEAD に 201_AA.pdf が存在するケース
    const { useGetHeadFiles } = await import("../../api/headFiles");
    vi.mocked(useGetHeadFiles).mockReturnValueOnce({
      data: ["101_AA.pdf", "201_AA.pdf"],
      isLoading: false,
    } as ReturnType<typeof useGetHeadFiles>);
    renderPanel(["201_AA.pdf"]);
    await user.click(
      screen.getByRole("button", { name: "201_AA.pdf の引き継ぎ元を設定" }),
    );
    expect(
      screen.queryByRole("button", { name: "201_AA.pdf" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "101_AA.pdf" }),
    ).toBeInTheDocument();
  });

  it("すでに他のファイルで選択済みの predecessor は候補から除外される", async () => {
    const user = userEvent.setup();
    // 201_AA.pdf → 101_AA.pdf を先に設定
    renderPanel(["201_AA.pdf", "201_BB.pdf"]);
    await user.click(
      screen.getByRole("button", { name: "201_AA.pdf の引き継ぎ元を設定" }),
    );
    await user.click(screen.getByRole("button", { name: "101_AA.pdf" }));
    // 201_BB.pdf のダイアログを開く
    await user.click(
      screen.getByRole("button", { name: "201_BB.pdf の引き継ぎ元を設定" }),
    );
    // 101_AA.pdf はすでに使用済みなので表示されない
    expect(
      screen.queryByRole("button", { name: "101_AA.pdf" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "101_BB.pdf" }),
    ).toBeInTheDocument();
  });
});
