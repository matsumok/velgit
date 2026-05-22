import { useState } from "react";
import { cn } from "../../lib/utils";
import {
  useCommitChanges,
  useGetPendingChanges,
} from "../../api/pendingChanges";
import type { PendingChange, ChangeType } from "../../api/pendingChanges";
import { useGenerateDiff } from "../../api/generateDiff";
import { DiffView } from "../layout/DiffView";
import { useGetCommitHistory } from "../../api/commitHistory";

const STATUS_LABEL: Record<string, string> = {
  new: "新規",
  modified: "更新",
  deleted: "削除",
};

const CHANGE_BADGE: Record<ChangeType, string | null> = {
  none: null,
  minor: "~",
  meaningful: "M",
};

function ChangeBadge({ changeType }: { changeType: ChangeType }) {
  const label = CHANGE_BADGE[changeType];
  if (!label) return null;
  return (
    <span
      className={cn(
        "ml-2 inline-flex items-center rounded px-1 text-xs font-mono",
        changeType === "meaningful"
          ? "bg-destructive/15 text-destructive"
          : "bg-muted-foreground/15 text-muted-foreground",
      )}
    >
      {label}
    </span>
  );
}

function PendingChangeItem({
  change,
  onSelect,
  isSelected,
}: {
  change: PendingChange;
  onSelect: (c: PendingChange) => void;
  isSelected: boolean;
}) {
  return (
    <li
      className={cn(
        "flex items-center text-sm px-2 py-1 rounded cursor-pointer hover:bg-muted/70",
        isSelected ? "bg-muted" : "bg-muted/40",
      )}
      onClick={() => onSelect(change)}
    >
      <span className="flex-1 truncate">{change.filename}</span>
      <ChangeBadge changeType={change.changeType} />
    </li>
  );
}

function ChangeGroup({
  status,
  changes,
  onSelect,
  selectedFilename,
}: {
  status: string;
  changes: PendingChange[];
  onSelect: (c: PendingChange) => void;
  selectedFilename: string | null;
}) {
  if (changes.length === 0) return null;
  return (
    <div className="mb-3">
      <p className="text-xs text-muted-foreground mb-1">
        {STATUS_LABEL[status] ?? status}
      </p>
      <ul className="space-y-0.5">
        {changes.map((c) => (
          <PendingChangeItem
            key={c.filename}
            change={c}
            onSelect={onSelect}
            isSelected={selectedFilename === c.filename}
          />
        ))}
      </ul>
    </div>
  );
}

export function CommitPanel() {
  const { data: changes } = useGetPendingChanges();
  const { mutate: commitChanges, isPending, error } = useCommitChanges();
  const [message, setMessage] = useState("");
  const [selectedChange, setSelectedChange] = useState<PendingChange | null>(
    null,
  );
  const {
    mutate: generateDiff,
    isPending: isDiffLoading,
    error: diffError,
    data: diffResult,
  } = useGenerateDiff();

  const { data: history } = useGetCommitHistory();
  const headOid = history?.[0]?.oid ?? null;

  if (!changes || changes.length === 0) return null;

  const byStatus = (status: string) =>
    changes.filter((c) => c.status === status);

  function handleCommit() {
    if (!message.trim()) return;
    commitChanges(message, { onSuccess: () => setMessage("") });
  }

  function handleSelectChange(c: PendingChange) {
    setSelectedChange(c);
    if (!headOid) return; // 初回コミット前
    generateDiff({ filename: c.filename, oidA: headOid });
  }

  return (
    <div className="p-4 flex flex-col gap-3">
      <p className="text-xs text-muted-foreground">変更あり</p>
      <ChangeGroup
        status="new"
        changes={byStatus("new")}
        onSelect={handleSelectChange}
        selectedFilename={selectedChange?.filename ?? null}
      />
      <ChangeGroup
        status="modified"
        changes={byStatus("modified")}
        onSelect={handleSelectChange}
        selectedFilename={selectedChange?.filename ?? null}
      />
      <ChangeGroup
        status="deleted"
        changes={byStatus("deleted")}
        onSelect={handleSelectChange}
        selectedFilename={selectedChange?.filename ?? null}
      />
      <DiffView
        imageUrl={diffResult?.url ?? null}
        isLoading={isDiffLoading}
        error={diffError ? String(diffError) : null}
      />
      {error && <p className="text-xs text-destructive">{String(error)}</p>}
      <textarea
        className="w-full rounded border border-input bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-ring"
        rows={3}
        placeholder="変更内容を入力..."
        value={message}
        onChange={(e) => setMessage(e.target.value)}
      />
      <button
        type="button"
        onClick={handleCommit}
        disabled={!message.trim() || isPending}
        className={cn(
          "px-4 py-2 rounded text-sm bg-primary text-primary-foreground",
          (!message.trim() || isPending) && "opacity-50 cursor-not-allowed",
        )}
      >
        {isPending ? "コミット中..." : "コミット"}
      </button>
    </div>
  );
}
