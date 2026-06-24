import { invoke } from "@tauri-apps/api/core";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { useEffect, useState } from "react";
import { type Job, useAppStore } from "../store/useAppStore";

export function useInitProject() {
  const { selectedProject, jobs, addJob, selectJob, setProjectReady } =
    useAppStore();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [needsInit, setNeedsInit] = useState(false);

  useEffect(() => {
    if (!selectedProject) {
      setNeedsInit(false);
      return;
    }
    setNeedsInit(false);
    invoke<boolean>("is_initialized", { path: selectedProject }).then(
      (initialized) => {
        if (!initialized) {
          setNeedsInit(true);
          return;
        }
        invoke("init_working_folder", { path: selectedProject })
          .then(() => {
            setProjectReady(true);
          })
          .catch(() => selectJob(null));
      },
    );
  }, [selectedProject, selectJob, setProjectReady]);

  async function openFolder() {
    const path = await openDialog({ directory: true, multiple: false });
    if (!path || typeof path !== "string") return;

    setLoading(true);
    setError(null);
    try {
      await invoke("init_working_folder", { path });
      const existing = jobs.find((j) => j.path === path);
      if (existing) {
        selectJob(existing.id);
      } else {
        const folderName = path.split(/[\\/]/).pop() ?? path;
        const job: Job = {
          id: crypto.randomUUID(),
          name: folderName,
          path,
          createdAt: Date.now(),
        };
        addJob(job);
        selectJob(job.id);
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  async function initCurrentJob() {
    if (!selectedProject) return;
    setLoading(true);
    setError(null);
    try {
      await invoke("init_working_folder", { path: selectedProject });
      setNeedsInit(false);
      setProjectReady(true);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  return { error, loading, openFolder, needsInit, initCurrentJob };
}
