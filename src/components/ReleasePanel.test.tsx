import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi, describe, it, expect, beforeEach } from "vitest";
import { useAppStore } from "../store/useAppStore";
import { ReleasePanel } from "./ReleasePanel";

const MOCK_DRAWINGS = [
  { filename: "A-001_平面図.pdf", added_at: 1000 },
  { filename: "S-001_伏図.pdf", added_at: 2000 },
];

const mockMutateAsync = vi.fn().mockResolvedValue(1);

vi.mock("../api/drawings", () => ({
  useGetDrawings: vi.fn(() => ({ data: MOCK_DRAWINGS })),
}));

vi.mock("../api/releases", () => ({
  useCreateRelease: vi.fn(() => ({
    mutateAsync: mockMutateAsync,
    isPending: false,
  })),
}));

beforeEach(() => {
  localStorage.clear();
  useAppStore.setState({ username: "山田太郎" });
  mockMutateAsync.mockClear();
});

describe("ReleasePanel", () => {
  it("図面リストを全チェック済みで表示する", () => {
    render(<ReleasePanel />);
    expect(
      screen.getByRole("checkbox", { name: "A-001_平面図.pdf" }),
    ).toBeChecked();
    expect(
      screen.getByRole("checkbox", { name: "S-001_伏図.pdf" }),
    ).toBeChecked();
  });

  it("チェックを外すと部分選択になる", async () => {
    const user = userEvent.setup();
    render(<ReleasePanel />);
    await user.click(
      screen.getByRole("checkbox", { name: "A-001_平面図.pdf" }),
    );
    expect(
      screen.getByRole("checkbox", { name: "A-001_平面図.pdf" }),
    ).not.toBeChecked();
    expect(
      screen.getByRole("checkbox", { name: "S-001_伏図.pdf" }),
    ).toBeChecked();
  });

  it("名称が空のとき送信ボタンがdisabled", () => {
    render(<ReleasePanel />);
    expect(screen.getByRole("button", { name: "図渡しを作成" })).toBeDisabled();
  });

  it("図面が0件選択のとき送信ボタンがdisabled", async () => {
    const user = userEvent.setup();
    render(<ReleasePanel />);
    await user.click(
      screen.getByRole("checkbox", { name: "A-001_平面図.pdf" }),
    );
    await user.click(screen.getByRole("checkbox", { name: "S-001_伏図.pdf" }));
    await user.type(
      screen.getByRole("textbox", { name: "図渡し名称" }),
      "第1回",
    );
    expect(screen.getByRole("button", { name: "図渡しを作成" })).toBeDisabled();
  });

  it("デフォルト種別が「社内図渡し」", () => {
    render(<ReleasePanel />);
    expect(screen.getByRole("radio", { name: "社内図渡し" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "社外図渡し" })).not.toBeChecked();
  });

  it("送信成功後にフォームがリセットされる", async () => {
    const user = userEvent.setup();
    render(<ReleasePanel />);
    await user.type(
      screen.getByRole("textbox", { name: "図渡し名称" }),
      "第1回",
    );
    await user.click(screen.getByRole("button", { name: "図渡しを作成" }));
    expect(screen.getByRole("textbox", { name: "図渡し名称" })).toHaveValue("");
    expect(
      screen.getByRole("checkbox", { name: "A-001_平面図.pdf" }),
    ).toBeChecked();
  });

  it("送信時にusernameをcreatedByとして渡す", async () => {
    const user = userEvent.setup();
    render(<ReleasePanel />);
    await user.type(
      screen.getByRole("textbox", { name: "図渡し名称" }),
      "第1回",
    );
    await user.click(screen.getByRole("button", { name: "図渡しを作成" }));
    expect(mockMutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({ createdBy: "山田太郎" }),
    );
  });
});
