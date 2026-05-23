import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { useAppStore } from "../store/useAppStore";
import { UsernameSection } from "./UsernameSection";

beforeEach(() => {
  localStorage.clear();
  useAppStore.setState({ username: "山田太郎" });
});

describe("UsernameSection", () => {
  it("現在のユーザー名を表示する", () => {
    render(<UsernameSection />);
    expect(
      screen.getByRole("button", { name: "山田太郎" }),
    ).toBeInTheDocument();
  });

  it("名前をクリックすると編集モードになる", async () => {
    const user = userEvent.setup();
    render(<UsernameSection />);
    await user.click(screen.getByRole("button", { name: "山田太郎" }));
    expect(screen.getByRole("textbox")).toBeInTheDocument();
  });

  it("新しい名前を入力して保存するとユーザー名が更新される", async () => {
    const user = userEvent.setup();
    render(<UsernameSection />);
    await user.click(screen.getByRole("button", { name: "山田太郎" }));
    const input = screen.getByRole("textbox");
    await user.clear(input);
    await user.type(input, "鈴木花子");
    await user.click(screen.getByRole("button", { name: "保存" }));
    expect(useAppStore.getState().username).toBe("鈴木花子");
  });

  it("Escapeキーで編集をキャンセルできる", async () => {
    const user = userEvent.setup();
    render(<UsernameSection />);
    await user.click(screen.getByRole("button", { name: "山田太郎" }));
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(useAppStore.getState().username).toBe("山田太郎");
  });
});
