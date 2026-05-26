import { useEffect, useMemo, useState } from "react";
import { useGetCommitHistory } from "../../api/commitHistory";
import { useDiffAtCommit } from "../../api/generateDiff";
import { useDrawingPreview, useWorkingCopyPreview } from "../../api/pdfImage";
import { useGetPendingChanges } from "../../api/pendingChanges";
import { useGetProjectCommits } from "../../api/projectCommits";
import { cn } from "../../lib/utils";
import { useAppStore } from "../../store/useAppStore";
import { Button } from "../ui/button";
import { ScrollArea } from "../ui/scroll-area";
import { Separator } from "../ui/separator";
import { DiffView } from "./DiffView";
import { ImageDialog } from "./ImageDialog";

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

function CommitRowContent({
  message,
  author,
  timestamp,
}: {
  message: string;
  author: string;
  timestamp: number;
}) {
  return (
    <div className="flex flex-col gap-1 pl-2">
      <p className="text-left truncate text-xs font-medium">{message}</p>
      <p className="text-xs text-muted-foreground mt-0.5">
        {author} · {formatDate(timestamp)}
      </p>
    </div>
  );
}

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
  }, []);

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

  // 未コミットファイル: 作業コピーをディスクから直接表示
  const { data: wcPreviewUrl, isLoading: wcPreviewLoading } =
    useWorkingCopyPreview(
      hasUncommitted && selectedHistoryOid === null ? selectedDrawing : null,
    );

  // コミット済みファイル: 最新コミットの画像を表示
  const { data: previewUrl, isLoading: previewLoading } = useDrawingPreview(
    !hasUncommitted && selectedHistoryOid === null ? selectedDrawing : null,
    !hasUncommitted && selectedHistoryOid === null ? resolvedPreviewOid : null,
  );

  const activePreviewUrl = hasUncommitted ? wcPreviewUrl : previewUrl;
  const activePreviewLoading = hasUncommitted
    ? wcPreviewLoading
    : previewLoading;

  const {
    data: diffResult,
    isLoading: diffLoading,
    error: diffError,
  } = useDiffAtCommit(
    selectedHistoryOid !== null ? selectedDrawing : null,
    selectedHistoryOid,
    selectedHistoryOid !== null ? diffBaseOid : null,
  );

  const setBackgroundTask = useAppStore((s) => s.setBackgroundTask);
  useEffect(() => {
    if (diffLoading) {
      setBackgroundTask("差分を生成中...");
    } else if (activePreviewLoading) {
      setBackgroundTask("プレビューを生成中...");
    } else {
      setBackgroundTask(null);
    }
    return () => setBackgroundTask(null);
  }, [diffLoading, activePreviewLoading, setBackgroundTask]);

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
      <div className="shrink-0 px-3 py-2">
        <p className="text-sm truncate">{selectedDrawing}</p>
      </div>
      <Separator />

      {/* 現在地 */}
      <div className="shrink-0 px-3 pt-2 pb-0.5">
        <p className="text-xs mb-1">現在</p>
      </div>
      <div className="shrink-0 px-3 py-2">
        {listLoading ? (
          <div className="flex h-8 items-center px-3">
            <Spinner className="size-3" />
          </div>
        ) : hasUncommitted ? (
          <p className="text-xs font-medium pl-2">未コミット</p>
        ) : topItem ? (
          <CommitRowContent
            message={topItem.message}
            author={topItem.author}
            timestamp={topItem.timestamp}
          />
        ) : null}
      </div>

      <Separator />

      {/* 履歴リスト（diff用ボタン） */}
      <div className="shrink-0 px-3 pt-2">
        <p className="text-xs mb-1">履歴</p>
      </div>
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
            {historyCommits.map((commit, idx) => {
              const selected = selectedHistoryOid === commit.oid;
              const prevChangeType =
                idx === 0
                  ? topItem?.changeType
                  : historyCommits[idx - 1].changeType;
              const isFaded =
                prevChangeType === "none" || prevChangeType === "minor";
              return (
                <li key={commit.oid}>
                  <Button
                    variant="ghost"
                    onClick={() =>
                      setSelectedHistoryOid(selected ? null : commit.oid)
                    }
                    className={cn(
                      "w-full justify-start h-auto px-3 py-2 font-normal",
                      selected && "bg-muted",
                      isFaded && "opacity-40",
                    )}
                  >
                    <CommitRowContent
                      message={commit.message}
                      author={commit.author}
                      timestamp={commit.timestamp}
                    />
                  </Button>
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
        ) : activePreviewLoading ? (
          <div className="flex h-20 items-center justify-center">
            <Spinner />
          </div>
        ) : activePreviewUrl ? (
          <ImageDialog src={activePreviewUrl} alt="図面プレビュー" />
        ) : !hasUncommitted && resolvedPreviewOid === null ? (
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
