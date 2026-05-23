import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useAppStore } from "../store/useAppStore";
import { ReleasePanel } from "./ReleasePanel";

const mockMutateAsync = vi.fn().mockResolvedValue(1);
const mockOnReleaseSuccess = vi.fn();

vi.mock("../api/releases", () => ({
  useCreateRelease: vi.fn(() => ({
    mutateAsync: mockMutateAsync,
    isPending: false,
  })),
}));

const DEFAULT_FILENAMES = ["A-001_平面図.pdf", "S-001_伏図.pdf"];

function renderPanel(selectedFilenames = DEFAULT_FILENAMES) {
  return render(
    <ReleasePanel
      selectedFilenames={selectedFilenames}
      onReleaseSuccess={mockOnReleaseSuccess}
    />,
  );
}

beforeEach(() => {
  localStorage.clear();
  useAppStore.setState({ username: "山田太郎" });
  mockMutateAsync.mockClear();
  mockOnReleaseSuccess.mockClear();
});

describe("ReleasePanel", () => {
  it("選択図面数を表示する", () => {
    renderPanel();
    expect(screen.getByText("対象図面: 2枚")).toBeInTheDocument();
  });

  it("名称が空のとき送信ボタンがdisabled", () => {
    renderPanel();
    expect(screen.getByRole("button", { name: "図渡しを作成" })).toBeDisabled();
  });

  it("図面が0件のとき送信ボタンがdisabled", async () => {
    const user = userEvent.setup();
    renderPanel([]);
    await user.type(
      screen.getByRole("textbox", { name: "図渡し名称" }),
      "第1回",
    );
    expect(screen.getByRole("button", { name: "図渡しを作成" })).toBeDisabled();
  });

  it("デフォルト種別が「社内図渡し」", () => {
    renderPanel();
    expect(screen.getByRole("radio", { name: "社内図渡し" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "社外図渡し" })).not.toBeChecked();
  });

  it("送信成功後にフォームがリセットされonReleaseSuccessが呼ばれる", async () => {
    const user = userEvent.setup();
    renderPanel();
    await user.type(
      screen.getByRole("textbox", { name: "図渡し名称" }),
      "第1回",
    );
    await user.click(screen.getByRole("button", { name: "図渡しを作成" }));
    expect(screen.getByRole("textbox", { name: "図渡し名称" })).toHaveValue("");
    expect(mockOnReleaseSuccess).toHaveBeenCalledOnce();
  });

  it("送信時にusernameをcreatedByとして渡す", async () => {
    const user = userEvent.setup();
    renderPanel();
    await user.type(
      screen.getByRole("textbox", { name: "図渡し名称" }),
      "第1回",
    );
    await user.click(screen.getByRole("button", { name: "図渡しを作成" }));
    expect(mockMutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        createdBy: "山田太郎",
        drawingFilenames: DEFAULT_FILENAMES,
      }),
    );
  });
});
