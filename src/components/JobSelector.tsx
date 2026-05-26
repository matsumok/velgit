import { CaretDownIcon, FolderOpenIcon, PlusIcon } from "@phosphor-icons/react";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { type Job, useAppStore } from "@/store/useAppStore";

export function JobSelector() {
  const { jobs, selectedJobId, selectJob, addJob } = useAppStore();
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newJobName, setNewJobName] = useState("");
  const [newJobPath, setNewJobPath] = useState("");

  const selectedJob = jobs.find((j) => j.id === selectedJobId);

  async function handlePickFolder() {
    const path = await openDialog({ directory: true, multiple: false });
    if (!path || typeof path !== "string") return;
    const folderName = path.split(/[\\/]/).pop() ?? path;
    setNewJobPath(path);
    setNewJobName(folderName);
  }

  function handleAddJob() {
    if (!newJobName.trim() || !newJobPath) return;
    const job: Job = {
      id: crypto.randomUUID(),
      name: newJobName.trim(),
      path: newJobPath,
      createdAt: Date.now(),
    };
    addJob(job);
    selectJob(job.id);
    setDialogOpen(false);
    setPopoverOpen(false);
    setNewJobName("");
    setNewJobPath("");
  }

  return (
    <>
      <div className="relative px-2 py-2">
        <Button
          variant="ghost"
          onClick={() => setPopoverOpen((v) => !v)}
          className="w-full justify-between gap-1 font-medium"
        >
          <span className="truncate">{selectedJob?.name ?? "Job未選択"}</span>
          <CaretDownIcon className="size-3 shrink-0 text-muted-foreground" />
        </Button>

        {popoverOpen && (
          <>
            <Button
              variant="ghost"
              aria-label="閉じる"
              className="fixed inset-0 z-10 h-auto rounded-none p-0"
              onClick={() => setPopoverOpen(false)}
            />
            <div className="absolute left-2 right-2 top-full z-20 mt-0.5 rounded border bg-popover text-popover-foreground shadow-md p-1">
              {jobs.length === 0 ? (
                <p className="px-2 py-1.5 text-xs text-muted-foreground">
                  Jobが登録されていません
                </p>
              ) : (
                <ul>
                  {[...jobs]
                    .sort((a, b) => b.createdAt - a.createdAt)
                    .map((job) => (
                      <li key={job.id}>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="w-full justify-start truncate"
                          onClick={() => {
                            selectJob(job.id);
                            setPopoverOpen(false);
                          }}
                        >
                          {job.name}
                        </Button>
                      </li>
                    ))}
                </ul>
              )}
              <div className="border-t mt-1 pt-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setPopoverOpen(false);
                    setDialogOpen(true);
                  }}
                  className="w-full justify-start text-muted-foreground"
                >
                  <PlusIcon className="size-3" />
                  新規Job登録
                </Button>
              </div>
            </div>
          </>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新規Job登録</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <div>
              <p className="text-xs text-muted-foreground mb-1">フォルダ</p>
              <div className="flex gap-2">
                <span className="flex-1 text-xs px-2 py-1.5 rounded border border-input bg-muted truncate text-muted-foreground min-w-0">
                  {newJobPath || "未選択"}
                </span>
                <Button variant="outline" size="sm" onClick={handlePickFolder}>
                  <FolderOpenIcon className="size-3 mr-1" />
                  選択
                </Button>
              </div>
            </div>
            <div>
              <label
                htmlFor="new-job-name"
                className="text-xs text-muted-foreground mb-1 block"
              >
                Job名
              </label>
              <Input
                id="new-job-name"
                value={newJobName}
                onChange={(e) => setNewJobName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleAddJob();
                }}
                placeholder="例: 〇〇ビル新築工事"
              />
            </div>
          </div>
          <Button
            disabled={!newJobName.trim() || !newJobPath}
            onClick={handleAddJob}
          >
            登録
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}
