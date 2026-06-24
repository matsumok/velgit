import { render, screen, within } from "@testing-library/react";
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
    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeInTheDocument();
    expect(within(dialog).getByText("101_AA.pdf")).toBeInTheDocument();
    expect(within(dialog).getByText("101_BB.pdf")).toBeInTheDocument();
    expect(within(dialog).getByText("設定しない")).toBeInTheDocument();
  });

  it("predecessor を選択するとアイコンボタンの title が更新される", async () => {
    const user = userEvent.setup();
    renderPanel(["201_AA.pdf"]);
    await user.click(
      screen.getByRole("button", { name: "201_AA.pdf の引き継ぎ元を設定" }),
    );
    await user.click(
      within(screen.getByRole("dialog")).getByText("101_AA.pdf"),
    );
    expect(
      screen.getByRole("button", { name: "201_AA.pdf の引き継ぎ元を設定" }),
    ).toHaveAttribute("title", "引き継ぎ元: 101_AA.pdf");
  });

  it("「設定しない」を選択すると predecessor がクリアされる", async () => {
    const user = userEvent.setup();
    renderPanel(["201_AA.pdf"]);
    // まず predecessor を設定
    await user.click(
      screen.getByRole("button", { name: "201_AA.pdf の引き継ぎ元を設定" }),
    );
    await user.click(
      within(screen.getByRole("dialog")).getByText("101_AA.pdf"),
    );
    expect(
      screen.getByRole("button", { name: "201_AA.pdf の引き継ぎ元を設定" }),
    ).toHaveAttribute("title", "引き継ぎ元: 101_AA.pdf");
    // クリア
    await user.click(
      screen.getByRole("button", { name: "201_AA.pdf の引き継ぎ元を設定" }),
    );
    await user.click(
      within(screen.getByRole("dialog")).getByText("設定しない"),
    );
    expect(
      screen.getByRole("button", { name: "201_AA.pdf の引き継ぎ元を設定" }),
    ).toHaveAttribute("title", "引き継ぎ元を設定");
  });

  it("コミット時に設定した predecessors が渡される", async () => {
    const user = userEvent.setup();
    renderPanel(["201_AA.pdf"]);
    await user.click(
      screen.getByRole("button", { name: "201_AA.pdf の引き継ぎ元を設定" }),
    );
    await user.click(
      within(screen.getByRole("dialog")).getByText("101_AA.pdf"),
    );
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
    const { useGetHeadFiles } = await import("../../api/headFiles");
    vi.mocked(useGetHeadFiles).mockReturnValueOnce({
      data: ["101_AA.pdf", "201_AA.pdf"],
      isLoading: false,
    } as ReturnType<typeof useGetHeadFiles>);
    renderPanel(["201_AA.pdf"]);
    await user.click(
      screen.getByRole("button", { name: "201_AA.pdf の引き継ぎ元を設定" }),
    );
    const dialog = screen.getByRole("dialog");
    // dialog ヘッダーに対象ファイル名が表示されるため、選択肢（role=option）に絞って確認
    const options = within(dialog).queryAllByRole("option");
    const optionTexts = options.map((el) => el.textContent?.trim());
    expect(optionTexts).not.toContain("201_AA.pdf");
    expect(optionTexts).toContain("101_AA.pdf");
  });

  it("すでに他のファイルで選択済みの predecessor は候補から除外される", async () => {
    const user = userEvent.setup();
    renderPanel(["201_AA.pdf", "201_BB.pdf"]);
    await user.click(
      screen.getByRole("button", { name: "201_AA.pdf の引き継ぎ元を設定" }),
    );
    await user.click(
      within(screen.getByRole("dialog")).getByText("101_AA.pdf"),
    );
    await user.click(
      screen.getByRole("button", { name: "201_BB.pdf の引き継ぎ元を設定" }),
    );
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).queryByText("101_AA.pdf")).not.toBeInTheDocument();
    expect(within(dialog).getByText("101_BB.pdf")).toBeInTheDocument();
  });
});
