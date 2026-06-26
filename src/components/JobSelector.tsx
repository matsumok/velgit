import {
  CaretDownIcon,
  FolderOpenIcon,
  PencilSimpleIcon,
  PlusIcon,
  TrashIcon,
} from "@phosphor-icons/react";
import { openPath } from "@tauri-apps/plugin-opener";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { type Job, useAppStore } from "@/store/useAppStore";
import { JobFormDialog } from "./JobFormDialog";

export function JobSelector() {
  const { jobs, selectedJobId, selectJob, removeJob } = useAppStore();
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [formDialog, setFormDialog] = useState<{
    open: boolean;
    editJob?: Job;
  }>({
    open: false,
  });
  const [deleteTarget, setDeleteTarget] = useState<Job | null>(null);

  const selectedJob = jobs.find((j) => j.id === selectedJobId);

  function openAdd() {
    setPopoverOpen(false);
    setFormDialog({ open: true });
  }

  function openEdit(job: Job) {
    setPopoverOpen(false);
    setFormDialog({ open: true, editJob: job });
  }

  function handleDelete() {
    if (!deleteTarget) return;
    removeJob(deleteTarget.id);
    setDeleteTarget(null);
  }

  return (
    <>
      <div className="relative px-2 py-2 flex items-center gap-1">
        <Button
          variant="ghost"
          onClick={() => setPopoverOpen((v) => !v)}
          className="flex-1 justify-between gap-1 font-medium min-w-0"
        >
          <span className="truncate">{selectedJob?.name ?? "プロジェクト未選択"}</span>
          <CaretDownIcon className="size-3 shrink-0 text-muted-foreground" />
        </Button>
        {selectedJob && (
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label="フォルダをエクスプローラーで開く"
            onClick={() => openPath(selectedJob.path)}
          >
            <FolderOpenIcon className="size-3" />
          </Button>
        )}

        {popoverOpen && (
          <>
            <button
              type="button"
              tabIndex={-1}
              aria-label="閉じる"
              className="fixed inset-0 z-10 cursor-default bg-transparent p-0 border-0"
              onClick={() => setPopoverOpen(false)}
            />
            <div className="absolute left-2 right-2 top-full z-20 mt-0.5 rounded border bg-popover text-popover-foreground shadow-md p-1">
              {jobs.length === 0 ? (
                <p className="px-2 py-1.5 text-xs text-muted-foreground">
                  プロジェクトが登録されていません
                </p>
              ) : (
                <ul>
                  {[...jobs]
                    .sort((a, b) => b.createdAt - a.createdAt)
                    .map((job) => (
                      <li key={job.id} className="flex items-center">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="flex-1 justify-start truncate min-w-0"
                          onClick={() => {
                            selectJob(job.id);
                            setPopoverOpen(false);
                          }}
                        >
                          {job.name}
                        </Button>
                        <div className="flex gap-0.5 pr-1 shrink-0">
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            aria-label="編集"
                            onClick={(e) => {
                              e.stopPropagation();
                              openEdit(job);
                            }}
                          >
                            <PencilSimpleIcon className="size-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            aria-label="削除"
                            className="hover:bg-destructive/10 hover:text-destructive"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteTarget(job);
                            }}
                          >
                            <TrashIcon className="size-3" />
                          </Button>
                        </div>
                      </li>
                    ))}
                </ul>
              )}
              <div className="border-t mt-1 pt-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={openAdd}
                  className="w-full justify-start text-muted-foreground"
                >
                  <PlusIcon className="size-3" />
                  新規プロジェクト登録
                </Button>
              </div>
            </div>
          </>
        )}
      </div>

      <JobFormDialog
        open={formDialog.open}
        onOpenChange={(open) => setFormDialog((prev) => ({ ...prev, open }))}
        editJob={formDialog.editJob}
      />

      <Dialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>プロジェクトを削除しますか？</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            「{deleteTarget?.name}」を削除します。この操作は取り消せません。
          </p>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              キャンセル
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              削除
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
