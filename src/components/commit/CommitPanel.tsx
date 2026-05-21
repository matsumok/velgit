import { useState } from "react";
import { cn } from "../../lib/utils";
import {
  useCommitChanges,
  useGetPendingChanges,
} from "../../api/pendingChanges";
import type { PendingChange } from "../../api/pendingChanges";

const STATUS_LABEL: Record<string, string> = {
  new: "新規",
  modified: "更新",
  deleted: "削除",
};

function ChangeGroup({
  status,
  changes,
}: {
  status: string;
  changes: PendingChange[];
}) {
  if (changes.length === 0) return null;
  return (
    <div className="mb-3">
      <p className="text-xs text-muted-foreground mb-1">
        {STATUS_LABEL[status] ?? status}
      </p>
      <ul className="space-y-0.5">
        {changes.map((c) => (
          <li key={c.filename} className="text-sm px-2 py-1 rounded bg-muted">
            {c.filename}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function CommitPanel() {
  const { data: changes } = useGetPendingChanges();
  const { mutate: commitChanges, isPending, error } = useCommitChanges();
  const [message, setMessage] = useState("");

  if (!changes || changes.length === 0) return null;

  const byStatus = (status: string) =>
    changes.filter((c) => c.status === status);

  function handleCommit() {
    if (!message.trim()) return;
    commitChanges(message, { onSuccess: () => setMessage("") });
  }

  return (
    <div className="p-4 flex flex-col gap-3">
      <p className="text-xs text-muted-foreground">変更あり</p>
      <ChangeGroup status="new" changes={byStatus("new")} />
      <ChangeGroup status="modified" changes={byStatus("modified")} />
      <ChangeGroup status="deleted" changes={byStatus("deleted")} />
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
