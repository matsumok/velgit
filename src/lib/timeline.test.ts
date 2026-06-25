import { describe, expect, it } from "vitest";
import { mergeTimelineEntries } from "./timeline";

describe("mergeTimelineEntries", () => {
  it("空入力のときHEADエントリのみを返す", () => {
    const result = mergeTimelineEntries([], []);
    expect(result).toEqual([{ type: "head" }]);
  });

  it("コミット複数のとき新しい順に並ぶ", () => {
    const commits = [
      {
        oid: "old",
        message: "古い",
        author: "A",
        timestamp: 100,
        changeType: null,
        blobOid: null,
        sourceFilename: null,
      },
      {
        oid: "new",
        message: "新しい",
        author: "B",
        timestamp: 200,
        changeType: null,
        blobOid: null,
        sourceFilename: null,
      },
    ];
    const result = mergeTimelineEntries(commits, []);
    expect(result[0]).toEqual({ type: "head" });
    expect(result[1]).toMatchObject({ type: "commit", oid: "new" });
    expect(result[2]).toMatchObject({ type: "commit", oid: "old" });
  });

  it("図渡し1件のときHEADの後に図渡しが続く", () => {
    const releases = [
      {
        id: 1,
        name: "第1回",
        kind: "internal",
        recipient: null,
        commitOid: "abc",
        createdAt: 1000,
        createdBy: "山田",
        drawingCount: 2,
      },
    ];
    const result = mergeTimelineEntries([], releases);
    expect(result).toEqual([
      { type: "head" },
      {
        type: "release",
        id: 1,
        name: "第1回",
        kind: "internal",
        commitOid: "abc",
        timestamp: 1000,
      },
    ]);
  });

  it("コミットと図渡しがtimestamp降順でインターリーブされる", () => {
    const commits = [
      {
        oid: "c1",
        message: "コミット1",
        author: "A",
        timestamp: 300,
        changeType: null,
        blobOid: null,
        sourceFilename: null,
      },
      {
        oid: "c2",
        message: "コミット2",
        author: "B",
        timestamp: 100,
        changeType: null,
        blobOid: null,
        sourceFilename: null,
      },
    ];
    const releases = [
      {
        id: 1,
        name: "第1回",
        kind: "internal",
        recipient: null,
        commitOid: "c1",
        createdAt: 200,
        createdBy: "A",
        drawingCount: 1,
      },
    ];
    const result = mergeTimelineEntries(commits, releases);
    expect(result[0]).toEqual({ type: "head" });
    expect(result[1]).toMatchObject({
      type: "commit",
      oid: "c1",
      timestamp: 300,
    });
    expect(result[2]).toMatchObject({ type: "release", id: 1, timestamp: 200 });
    expect(result[3]).toMatchObject({
      type: "commit",
      oid: "c2",
      timestamp: 100,
    });
  });

  it("同じtimestampのとき図渡しがコミットより前に来る", () => {
    const commits = [
      {
        oid: "c1",
        message: "コミット",
        author: "A",
        timestamp: 500,
        changeType: null,
        blobOid: null,
        sourceFilename: null,
      },
    ];
    const releases = [
      {
        id: 1,
        name: "第1回",
        kind: "external",
        recipient: null,
        commitOid: "c1",
        createdAt: 500,
        createdBy: "A",
        drawingCount: 1,
      },
    ];
    const result = mergeTimelineEntries(commits, releases);
    expect(result[1]).toMatchObject({ type: "release" });
    expect(result[2]).toMatchObject({ type: "commit" });
  });

  it("コミット1件のときHEADの後にコミットが続く", () => {
    const commits = [
      {
        oid: "abc",
        message: "初回",
        author: "山田",
        timestamp: 1000,
        changeType: null,
        blobOid: null,
        sourceFilename: null,
      },
    ];
    const result = mergeTimelineEntries(commits, []);
    expect(result).toEqual([
      { type: "head" },
      {
        type: "commit",
        oid: "abc",
        message: "初回",
        author: "山田",
        timestamp: 1000,
      },
    ]);
  });
});
