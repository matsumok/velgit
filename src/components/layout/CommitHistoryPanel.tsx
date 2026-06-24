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
  const isDiffMode = useAppStore((s) => s.isDiffMode);
  const setIsDiffMode = useAppStore((s) => s.setIsDiffMode);
  const { data: allCommits = [], isLoading: allLoading } =
    useGetProjectCommits();
  const { data: fileCommits = [], isLoading: fileLoading } =
    useGetCommitHistory();
  const { data: pendingChanges = [] } = useGetPendingChanges();
  const [selectedHistoryOid, setSelectedHistoryOid] = useState<string | null>(
    null,
  );

  // biome-ignore lint/correctness/useExhaustiveDependencies: selectedDrawing変更時のリセットが目的
  useEffect(() => {
    setSelectedHistoryOid(null);
  }, [selectedDrawing]);

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

  const canDiff = historyCommits.length > 0;

  // diff比較基点: 未コミット時は null（WD比較）、それ以外は最新コミットOID
  const diffBaseOid = hasUncommitted
    ? null
    : (topItem?.oid ?? resolvedPreviewOid);

  // diff mode ON 時: selectedHistoryOid が null またはリストにない場合は最新を自動選択
  // ファイル切り替え・コミット切り替え・トグル ON のいずれでも機能する
  useEffect(() => {
    if (!isDiffMode || historyCommits.length === 0) return;
    const valid =
      selectedHistoryOid !== null &&
      historyCommits.some((c) => c.oid === selectedHistoryOid);
    if (!valid) {
      setSelectedHistoryOid(historyCommits[0].oid);
    }
  }, [isDiffMode, selectedHistoryOid, historyCommits]);

  const handleDiffModeToggle = (checked: boolean) => {
    setIsDiffMode(checked);
    // effect が自動選択するが、即座にレンダリングに反映するため先行設定する
    if (checked && historyCommits.length > 0) {
      setSelectedHistoryOid(historyCommits[0].oid);
    }
  };

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
    isDiffMode && selectedHistoryOid !== null ? selectedDrawing : null,
    selectedHistoryOid,
    isDiffMode && selectedHistoryOid !== null ? diffBaseOid : null,
  );

  // diff結果が「意味なし（none / minor）」と確定している状態（ロード中は false）
  const diffKnownMeaningless =
    !diffLoading &&
    (diffResult?.changeType === "none" || diffResult?.changeType === "minor");

  // off mode または diff結果が意味なしのとき履歴コミットのプレビューを取得
  const needHistoryPreview =
    (!isDiffMode || diffKnownMeaningless) && selectedHistoryOid !== null;
  const { data: historyPreviewUrl, isLoading: historyPreviewLoading } =
    useDrawingPreview(
      needHistoryPreview ? selectedDrawing : null,
      needHistoryPreview ? selectedHistoryOid : null,
    );

  const setBackgroundTask = useAppStore((s) => s.setBackgroundTask);
  useEffect(() => {
    if (diffLoading) {
      setBackgroundTask("差分を生成中...");
    } else if (activePreviewLoading || historyPreviewLoading) {
      setBackgroundTask("プレビューを生成中...");
    }
    return () => setBackgroundTask(null);
  }, [
    diffLoading,
    activePreviewLoading,
    historyPreviewLoading,
    setBackgroundTask,
  ]);

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

      {/* diff mode トグル */}
      <div className="shrink-0 px-3 py-2 flex items-center justify-end gap-2">
        <span className="text-xs text-muted-foreground">差分表示</span>
        <button
          type="button"
          role="switch"
          aria-checked={isDiffMode}
          onClick={() => handleDiffModeToggle(!isDiffMode)}
          disabled={!canDiff}
          className={cn(
            "relative inline-flex h-5 w-9 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            isDiffMode ? "bg-primary" : "bg-input",
            !canDiff && "cursor-not-allowed opacity-50",
          )}
        >
          <span
            className={cn(
              "pointer-events-none inline-block size-4 rounded-full bg-background shadow-lg ring-0 transition-transform",
              isDiffMode ? "translate-x-4" : "translate-x-0",
            )}
          />
        </button>
      </div>
      <Separator />

      {/* 現在地 */}
      <div className="shrink-0 px-3 pt-2 pb-0.5">
        <p className="text-xs mb-1">現在</p>
      </div>
      <div className="shrink-0">
        {listLoading ? (
          <div className="flex h-8 items-center px-3 py-2">
            <Spinner className="size-3" />
          </div>
        ) : !hasUncommitted && !topItem ? null : isDiffMode ? (
          // on mode: 履歴選択中は青ハイライト（クリック不可）、サイズを履歴ボタンに合わせる
          <div
            className={cn(
              "w-full px-3 py-2",
              selectedHistoryOid !== null &&
                !diffKnownMeaningless &&
                "bg-blue-100 dark:bg-blue-950",
              selectedHistoryOid !== null && diffKnownMeaningless && "bg-muted",
            )}
          >
            {hasUncommitted ? (
              <p className="text-xs font-medium pl-2">未コミット</p>
            ) : topItem ? (
              <CommitRowContent
                message={topItem.message}
                author={topItem.author}
                timestamp={topItem.timestamp}
              />
            ) : null}
          </div>
        ) : (
          // off mode: クリックで現在プレビューに戻る
          <Button
            variant="ghost"
            onClick={() => setSelectedHistoryOid(null)}
            className={cn(
              "w-full justify-start h-auto px-3 py-2 font-normal",
              selectedHistoryOid === null && "bg-muted",
            )}
          >
            {hasUncommitted ? (
              <p className="text-xs font-medium pl-2">未コミット</p>
            ) : topItem ? (
              <CommitRowContent
                message={topItem.message}
                author={topItem.author}
                timestamp={topItem.timestamp}
              />
            ) : null}
          </Button>
        )}
      </div>

      <Separator />

      {/* 履歴リスト */}
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
                    onClick={() => setSelectedHistoryOid(commit.oid)}
                    className={cn(
                      "w-full justify-start h-auto px-3 py-2 font-normal",
                      selected &&
                        (!isDiffMode || diffKnownMeaningless) &&
                        "bg-muted",
                      selected &&
                        isDiffMode &&
                        !diffKnownMeaningless &&
                        "bg-red-100 dark:bg-red-950",
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

      {/* 下部: diff / 履歴プレビュー / 現在プレビュー */}
      <div className="flex-1 min-h-0 overflow-y-auto border-t">
        {isDiffMode && selectedHistoryOid !== null && !diffKnownMeaningless ? (
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
        ) : (!isDiffMode || diffKnownMeaningless) &&
          selectedHistoryOid !== null ? (
          historyPreviewLoading ? (
            <div className="flex h-20 items-center justify-center">
              <Spinner />
            </div>
          ) : historyPreviewUrl ? (
            <ImageDialog src={historyPreviewUrl} alt="図面プレビュー" />
          ) : null
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
