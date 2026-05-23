import { beforeEach, describe, expect, it } from "vitest";
import { useAppStore } from "./useAppStore";

beforeEach(() => {
  localStorage.clear();
  useAppStore.setState({
    username: null,
    selectedCommitOid: "HEAD",
    selectedDrawing: null,
  });
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

describe("useAppStore - selectedCommitOid", () => {
  it('初期値は"HEAD"', () => {
    expect(useAppStore.getState().selectedCommitOid).toBe("HEAD");
  });

  it("setSelectedCommitOidで過去のOIDに切り替わる", () => {
    useAppStore.getState().setSelectedCommitOid("abc123def456");
    expect(useAppStore.getState().selectedCommitOid).toBe("abc123def456");
  });

  it('setSelectedCommitOid("HEAD")でHEADに戻る', () => {
    useAppStore.getState().setSelectedCommitOid("abc123def456");
    useAppStore.getState().setSelectedCommitOid("HEAD");
    expect(useAppStore.getState().selectedCommitOid).toBe("HEAD");
  });

  it("selectedCommitOidの変更はselectedDrawingに影響しない", () => {
    useAppStore.getState().setSelectedDrawing("A-001_平面図.pdf");
    useAppStore.getState().setSelectedCommitOid("abc123def456");
    expect(useAppStore.getState().selectedDrawing).toBe("A-001_平面図.pdf");
  });

  it("selectedDrawingの変更はselectedCommitOidに影響しない", () => {
    useAppStore.getState().setSelectedCommitOid("abc123def456");
    useAppStore.getState().setSelectedDrawing("S-001_伏図.pdf");
    expect(useAppStore.getState().selectedCommitOid).toBe("abc123def456");
  });
});
