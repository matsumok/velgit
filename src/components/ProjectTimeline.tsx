import { useMemo } from "react";
import { useGetProjectCommits } from "../api/projectCommits";
import { useListReleases } from "../api/releases";
import { mergeTimelineEntries, type TimelineEntry } from "../lib/timeline";
import { cn } from "../lib/utils";
import { useAppStore } from "../store/useAppStore";
import { Badge } from "./ui/badge";
import { ScrollArea } from "./ui/scroll-area";

function formatDate(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleDateString("ja-JP", {
    month: "2-digit",
    day: "2-digit",
  });
}

function TimelineDot({ selected }: { selected: boolean }) {
  return (
    <span
      className={cn(
        "absolute left-0 -translate-x-1/2 top-3 size-3 rounded-full border-2 shrink-0",
        selected
          ? "bg-primary border-primary"
          : "bg-background border-muted-foreground/50",
      )}
    />
  );
}

function HeadItem({
  selected,
  onClick,
}: {
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "relative w-full text-left pl-5 pr-3 py-2 hover:bg-muted/60 transition-colors",
        selected && "bg-muted",
      )}
    >
      <TimelineDot selected={selected} />
      <span className="text-xs font-semibold">HEAD</span>
      <span className="ml-2 text-xs text-muted-foreground">（作業コピー）</span>
    </button>
  );
}

function CommitItem({
  entry,
  selected,
  onClick,
}: {
  entry: Extract<TimelineEntry, { type: "commit" }>;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "relative w-full text-left pl-5 pr-3 py-2 hover:bg-muted/60 transition-colors",
        selected && "bg-muted",
      )}
    >
      <TimelineDot selected={selected} />
      <p className="text-xs truncate">{entry.message}</p>
      <p className="text-xs text-muted-foreground mt-1">
        {entry.author} · {formatDate(entry.timestamp)}
      </p>
    </button>
  );
}

function ReleaseItem({
  entry,
}: {
  entry: Extract<TimelineEntry, { type: "release" }>;
}) {
  return (
    <div className="relative pl-5 pr-3 py-2">
      <span className="absolute left-0 -translate-x-1/2 top-3 size-3 rounded-full bg-background border-2 border-muted-foreground/30 shrink-0" />
      <div className="flex items-center gap-2 flex-wrap">
        <Badge variant="secondary" className="text-xs">
          {entry.kind === "external" ? "社外" : "社内"}
        </Badge>
        <span className="text-xs truncate">{entry.name}</span>
      </div>
      <p className="text-xs text-muted-foreground mt-1">
        {formatDate(entry.timestamp)}
      </p>
    </div>
  );
}

export function ProjectTimeline() {
  const { data: commits = [] } = useGetProjectCommits();
  const { data: releases = [] } = useListReleases();
  const { selectedCommitOid, setSelectedCommitOid, selectedProject } =
    useAppStore();

  const entries = useMemo(
    () => mergeTimelineEntries(commits, releases),
    [commits, releases],
  );

  if (!selectedProject) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-xs text-muted-foreground px-4 text-center">
          ワーキングフォルダを選択してください
        </p>
      </div>
    );
  }

  return (
    <ScrollArea className="flex-1">
      <div className="relative ml-4 mr-1 py-1">
        <div className="absolute left-0 top-0 bottom-0 w-px bg-border" />
        {entries.map((entry) => {
          if (entry.type === "head") {
            return (
              <HeadItem
                key="head"
                selected={selectedCommitOid === "HEAD"}
                onClick={() => setSelectedCommitOid("HEAD")}
              />
            );
          }
          if (entry.type === "commit") {
            return (
              <CommitItem
                key={entry.oid}
                entry={entry}
                selected={selectedCommitOid === entry.oid}
                onClick={() => setSelectedCommitOid(entry.oid)}
              />
            );
          }
          return <ReleaseItem key={`release-${entry.id}`} entry={entry} />;
        })}
      </div>
    </ScrollArea>
  );
}
