import type { CommitEntry } from "../api/commitHistory";
import type { ReleaseEntry } from "../api/releases";

export type TimelineEntry =
  | { type: "head" }
  | {
      type: "commit";
      oid: string;
      message: string;
      author: string;
      timestamp: number;
    }
  | {
      type: "release";
      id: number;
      name: string;
      kind: string;
      commitOid: string;
      timestamp: number;
    };

type TimestampedEntry = Extract<TimelineEntry, { timestamp: number }>;

export function mergeTimelineEntries(
  commits: CommitEntry[],
  releases: ReleaseEntry[],
): TimelineEntry[] {
  const commitEntries: TimestampedEntry[] = commits.map((c) => ({
    type: "commit",
    oid: c.oid,
    message: c.message,
    author: c.author,
    timestamp: c.timestamp,
  }));
  const releaseEntries: TimestampedEntry[] = releases.map((r) => ({
    type: "release",
    id: r.id,
    name: r.name,
    kind: r.kind,
    commitOid: r.commitOid,
    timestamp: r.createdAt,
  }));
  const merged = [...commitEntries, ...releaseEntries].sort((a, b) => {
    if (b.timestamp !== a.timestamp) return b.timestamp - a.timestamp;
    // 同一 timestamp では図渡しをコミットより前に表示
    return (a.type === "release" ? 0 : 1) - (b.type === "release" ? 0 : 1);
  });
  return [{ type: "head" }, ...merged];
}
