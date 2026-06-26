import { FolderOpenIcon } from "@phosphor-icons/react";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { type Job, useAppStore } from "@/store/useAppStore";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editJob?: Job;
}

export function JobFormDialog({ open, onOpenChange, editJob }: Props) {
  const { addJob, updateJob, selectJob } = useAppStore();
  const [name, setName] = useState("");
  const [path, setPath] = useState("");

  useEffect(() => {
    if (open) {
      setName(editJob?.name ?? "");
      setPath(editJob?.path ?? "");
    }
  }, [open, editJob]);

  async function handlePickFolder() {
    const result = await openDialog({
      directory: true,
      multiple: false,
      defaultPath: path || undefined,
    });
    if (!result || typeof result !== "string") return;
    setPath(result);
    if (!name) setName(result.split(/[\\/]/).pop() ?? result);
  }

  function handleSubmit() {
    if (!name.trim() || !path) return;
    if (editJob) {
      updateJob(editJob.id, { name: name.trim(), path });
    } else {
      const job: Job = {
        id: crypto.randomUUID(),
        name: name.trim(),
        path,
        createdAt: Date.now(),
      };
      addJob(job);
      selectJob(job.id);
    }
    onOpenChange(false);
  }

  const isEdit = !!editJob;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "プロジェクト編集" : "新規プロジェクト登録"}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3 min-w-0">
          <div>
            <p className="text-xs text-muted-foreground mb-1">フォルダ</p>
            <div className="flex gap-2">
              <span className="flex-1 text-xs px-2 py-1.5 rounded border border-input bg-muted truncate text-muted-foreground min-w-0">
                {path || "未選択"}
              </span>
              <Button variant="outline" size="sm" onClick={handlePickFolder}>
                <FolderOpenIcon className="size-3 mr-1" />
                選択
              </Button>
            </div>
          </div>
          <div>
            <label
              htmlFor="job-form-name"
              className="text-xs text-muted-foreground mb-1 block"
            >
              プロジェクト名
            </label>
            <Input
              id="job-form-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSubmit();
              }}
              placeholder="〇〇新築工事"
            />
          </div>
        </div>
        <Button disabled={!name.trim() || !path} onClick={handleSubmit}>
          {isEdit ? "更新" : "登録"}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
