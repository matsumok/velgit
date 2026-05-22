import { describe, it, expect, beforeEach } from "vitest";
import { useAppStore } from "./useAppStore";

beforeEach(() => {
  localStorage.clear();
  useAppStore.setState({ username: null });
});

describe("useAppStore - username", () => {
  it("初期値はnull", () => {
    expect(useAppStore.getState().username).toBeNull();
  });

  it("setUsernameで名前が設定される", () => {
    useAppStore.getState().setUsername("山田太郎");
    expect(useAppStore.getState().username).toBe("山田太郎");
  });
});
