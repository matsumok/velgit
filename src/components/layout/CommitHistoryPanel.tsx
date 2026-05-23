import { useQuery } from "@tanstack/react-query";
import { invoke } from "@tauri-apps/api/core";
import { useEffect, useState } from "react";
import { useGetCommitHistory } from "../../api/commitHistory";
import type { GenerateDiffResult } from "../../api/generateDiff";
import { useDrawingPreview } from "../../api/pdfImage";
import { useGetProjectCommits } from "../../api/projectCommits";
import { cn } from "../../lib/utils";
import { useAppStore } from "../../store/useAppStore";
import { ScrollArea } from "../ui/scroll-area";
import { DiffView } from "./DiffView";

function formatDate(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleDateString("ja-JP", {
    month: "2-digit",
    day: "2-digit",
  });
}

const CHANGE_TYPE_LABEL: Record<string, string> = {
  none: "変更なし",
  minor: "微小変更",
  meaningful: "意味的変更",
};

function Spinner({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "size-5 rounded-full border-2 border-muted border-t-muted-foreground animate-spin",
        className,
      )}
    />
  );
}

function useDiffAtCommit(
  filename: string | null,
  historyOid: string | null,
  contextOid: string | null,
) {
  return useQuery<GenerateDiffResult>({
    queryKey: ["diff_at_commit", filename, historyOid, contextOid],
    queryFn: () =>
      invoke<GenerateDiffResult>("generate_diff", {
        filename,
        oidA: historyOid,
        oidB: contextOid,
      }),
    enabled: !!filename && !!historyOid,
    staleTime: Number.POSITIVE_INFINITY,
  });
}

export function CommitHistoryPanel() {
  const selectedDrawing = useAppStore((s) => s.selectedDrawing);
  const selectedCommitOid = useAppStore((s) => s.selectedCommitOid);
  const { data: allCommits = [], isLoading: allLoading } =
    useGetProjectCommits();
  const { data: fileCommits = [], isLoading: fileLoading } =
    useGetCommitHistory();
  const [selectedHistoryOid, setSelectedHistoryOid] = useState<string | null>(
    null,
  );

  useEffect(() => {
    setSelectedHistoryOid(null);
  }, [selectedDrawing, selectedCommitOid]);

  const fileOidSet = new Set(fileCommits.map((c) => c.oid));

  // Commits at or before selectedCommitOid (newest-first list, so slice from that index)
  const cutCommits =
    selectedCommitOid === "HEAD"
      ? allCommits
      : (() => {
          const idx = allCommits.findIndex(
            (c) => c.oid === selectedCommitOid,
          );
          return idx >= 0 ? allCommits.slice(idx) : allCommits;
        })();

  // Only file-relevant commits
  const visibleCommits = cutCommits.filter((c) => fileOidSet.has(c.oid));

  // Resolve HEAD to the latest commit OID for preview
  const resolvedPreviewOid =
    selectedCommitOid === "HEAD"
      ? (allCommits[0]?.oid ?? null)
      : selectedCommitOid;

  // For diff: oidB is null when viewing HEAD (= compare to working copy)
  const diffContextOid =
    selectedCommitOid === "HEAD" ? null : selectedCommitOid;

  const { data: previewUrl, isLoading: previewLoading } = useDrawingPreview(
    selectedHistoryOid === null ? selectedDrawing : null,
    selectedHistoryOid === null ? resolvedPreviewOid : null,
  );

  const {
    data: diffResult,
    isLoading: diffLoading,
    error: diffError,
  } = useDiffAtCommit(
    selectedHistoryOid !== null ? selectedDrawing : null,
    selectedHistoryOid,
    diffContextOid,
  );

  if (!selectedDrawing) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-muted-foreground">図面を選択してください</p>
      </div>
    );
  }

  const listLoading = allLoading || fileLoading;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="shrink-0 px-3 py-2 border-b">
        <p className="text-xs text-muted-foreground truncate">
          {selectedDrawing}
        </p>
      </div>

      <ScrollArea className="flex-1 min-h-0">
        {listLoading ? (
          <div className="flex h-16 items-center justify-center">
            <Spinner />
          </div>
        ) : visibleCommits.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">
            コミット履歴がありません
          </p>
        ) : (
          <ul className="py-1">
            {visibleCommits.map((commit) => {
              const selected = selectedHistoryOid === commit.oid;
              return (
                <li key={commit.oid}>
                  <button
                    type="button"
                    onClick={() =>
                      setSelectedHistoryOid(selected ? null : commit.oid)
                    }
                    className={cn(
                      "w-full text-left px-3 py-2 text-xs hover:bg-muted/60 transition-colors",
                      selected && "bg-muted",
                    )}
                  >
                    <p className="truncate font-medium">{commit.message}</p>
                    <p className="text-muted-foreground mt-1">
                      {commit.author} · {formatDate(commit.timestamp)}
                    </p>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </ScrollArea>

      <div className="flex-1 min-h-0 overflow-y-auto border-t">
        {selectedHistoryOid !== null ? (
          <div className="p-2">
            {diffResult && (
              <p className="text-xs text-muted-foreground mb-2 px-1">
                {CHANGE_TYPE_LABEL[diffResult.changeType] ??
                  diffResult.changeType}
              </p>
            )}
            <DiffView
              imageUrl={diffResult?.url ?? null}
              isLoading={diffLoading}
              error={
                diffError instanceof Error
                  ? diffError.message
                  : diffError
                    ? String(diffError)
                    : null
              }
            />
          </div>
        ) : previewLoading ? (
          <div className="flex h-20 items-center justify-center">
            <Spinner />
          </div>
        ) : previewUrl ? (
          <img
            src={previewUrl}
            alt="図面プレビュー"
            className="w-full"
            draggable={false}
          />
        ) : resolvedPreviewOid === null ? (
          <div className="flex h-20 items-center justify-center">
            <p className="text-xs text-muted-foreground">
              コミット履歴がありません
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
