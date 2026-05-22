import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, beforeEach } from "vitest";
import { useAppStore } from "../store/useAppStore";
import { UsernameGate } from "./UsernameGate";

beforeEach(() => {
  localStorage.clear();
  useAppStore.setState({ username: null });
});

describe("UsernameGate", () => {
  it("usernameがnullのときモーダルを表示して子要素をブロックする", () => {
    render(
      <UsernameGate>
        <div>メイン画面</div>
      </UsernameGate>,
    );
    expect(screen.queryByText("メイン画面")).not.toBeInTheDocument();
    expect(
      screen.getByText("ユーザー名を入力してください"),
    ).toBeInTheDocument();
  });

  it("usernameが設定済みのとき子要素を表示する", () => {
    useAppStore.setState({ username: "山田太郎" });
    render(
      <UsernameGate>
        <div>メイン画面</div>
      </UsernameGate>,
    );
    expect(screen.getByText("メイン画面")).toBeInTheDocument();
    expect(
      screen.queryByText("ユーザー名を入力してください"),
    ).not.toBeInTheDocument();
  });

  it("入力が空のとき決定ボタンがdisabled", () => {
    render(
      <UsernameGate>
        <div />
      </UsernameGate>,
    );
    expect(screen.getByRole("button", { name: "決定" })).toBeDisabled();
  });

  it("名前を入力してEnterキーで確定するとゲートが開く", async () => {
    const user = userEvent.setup();
    render(
      <UsernameGate>
        <div>メイン画面</div>
      </UsernameGate>,
    );
    await user.type(screen.getByRole("textbox"), "山田太郎{Enter}");
    expect(screen.getByText("メイン画面")).toBeInTheDocument();
  });

  it("名前を入力して決定ボタンで確定するとゲートが開く", async () => {
    const user = userEvent.setup();
    render(
      <UsernameGate>
        <div>メイン画面</div>
      </UsernameGate>,
    );
    await user.type(screen.getByRole("textbox"), "山田太郎");
    await user.click(screen.getByRole("button", { name: "決定" }));
    expect(screen.getByText("メイン画面")).toBeInTheDocument();
  });
});
