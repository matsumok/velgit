import { useQuery } from "@tanstack/react-query";
import { invoke } from "@tauri-apps/api/core";
import { useEffect, useMemo, useState } from "react";
import { useGetCommitHistory } from "../../api/commitHistory";
import type { GenerateDiffResult } from "../../api/generateDiff";
import { useGetPendingChanges } from "../../api/pendingChanges";
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
  baseOid: string | null, // null = WD comparison
) {
  return useQuery<GenerateDiffResult>({
    queryKey: ["diff_at_commit", filename, historyOid, baseOid],
    queryFn: () =>
      invoke<GenerateDiffResult>("generate_diff", {
        filename,
        oidA: historyOid,
        oidB: baseOid,
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
  const { data: pendingChanges = [] } = useGetPendingChanges();
  const [selectedHistoryOid, setSelectedHistoryOid] = useState<string | null>(
    null,
  );

  useEffect(() => {
    setSelectedHistoryOid(null);
  }, [selectedDrawing, selectedCommitOid]);

  // Resolve HEAD to actual latest commit OID
  const resolvedPreviewOid =
    selectedCommitOid === "HEAD"
      ? (allCommits[0]?.oid ?? null)
      : selectedCommitOid;

  // Build set of OIDs at or before selectedCommitOid (for filtering fileCommits)
  const cutOidSet = useMemo(() => {
    if (selectedCommitOid === "HEAD") return null;
    const idx = allCommits.findIndex((c) => c.oid === selectedCommitOid);
    if (idx < 0) return new Set<string>();
    return new Set(allCommits.slice(idx).map((c) => c.oid));
  }, [allCommits, selectedCommitOid]);

  // visibleCommits: file's commits filtered by selected time point
  const visibleCommits = useMemo(() => {
    if (cutOidSet === null) return fileCommits;
    return fileCommits.filter((c) => cutOidSet.has(c.oid));
  }, [fileCommits, cutOidSet]);

  // HEAD選択時にこのファイルが未コミット状態かどうか
  const hasUncommitted = useMemo(
    () =>
      selectedCommitOid === "HEAD" &&
      pendingChanges.some((p) => p.filename === selectedDrawing),
    [selectedCommitOid, pendingChanges, selectedDrawing],
  );

  // topItem: 現在地として表示する非ボタンアイテム
  // 未コミット時は null（"未コミット"ラベルを表示）、それ以外は最新コミット
  const topItem = hasUncommitted ? null : (visibleCommits[0] ?? null);

  // historyCommits: diff用ボタンのリスト
  // 未コミット時は visibleCommits 全件（最新コミットもボタンになる）
  // それ以外は topItem を除いた残り
  const historyCommits = hasUncommitted
    ? visibleCommits
    : visibleCommits.slice(1);

  // diff比較基点: 未コミット時は null（WD比較）、それ以外は最新コミットOID
  const diffBaseOid = hasUncommitted
    ? null
    : (topItem?.oid ?? resolvedPreviewOid);

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
    selectedHistoryOid !== null ? diffBaseOid : null,
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
      {/* ファイル名 */}
      <div className="shrink-0 px-3 py-2 border-b">
        <p className="text-xs text-muted-foreground truncate">
          {selectedDrawing}
        </p>
      </div>

      {/* 現在地（非ボタン） */}
      <div className="shrink-0 px-3 py-2 border-b">
        {listLoading ? (
          <div className="flex h-8 items-center">
            <Spinner className="size-3" />
          </div>
        ) : hasUncommitted ? (
          <p className="text-xs font-medium">未コミット</p>
        ) : topItem ? (
          <>
            <p className="text-xs font-medium truncate">{topItem.message}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {topItem.author} · {formatDate(topItem.timestamp)}
            </p>
          </>
        ) : null}
      </div>

      {/* 履歴リスト（diff用ボタン） */}
      <ScrollArea className="flex-1 min-h-0">
        {listLoading ? (
          <div className="flex h-16 items-center justify-center">
            <Spinner />
          </div>
        ) : historyCommits.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">
            コミット履歴がありません
          </p>
        ) : (
          <ul className="py-1">
            {historyCommits.map((commit) => {
              const selected = selectedHistoryOid === commit.oid;
              const isFaded = commit.changeType !== "meaningful";
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
                      isFaded && !selected && "opacity-40",
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

      {/* 下部: diff or preview */}
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
