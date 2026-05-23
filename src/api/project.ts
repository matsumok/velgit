import { useQueryClient } from "@tanstack/react-query";
import { invoke } from "@tauri-apps/api/core";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { useEffect, useState } from "react";
import { useAppStore } from "../store/useAppStore";
import { queryKeys } from "./queryKeys";

export function useInitProject() {
  const { selectedProject, setSelectedProject } = useAppStore();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // biome-ignore lint/correctness/useExhaustiveDependencies: runs once on mount to validate persisted project
  useEffect(() => {
    if (!selectedProject) return;
    invoke<boolean>("is_initialized", { path: selectedProject }).then(
      (initialized) => {
        if (!initialized) {
          setSelectedProject(null);
          return;
        }
        invoke("init_working_folder", { path: selectedProject })
          .then(() => {
            queryClient.invalidateQueries({
              queryKey: queryKeys.drawings(selectedProject),
            });
            queryClient.invalidateQueries({
              queryKey: queryKeys.projectCommits(selectedProject),
            });
            queryClient.invalidateQueries({
              queryKey: queryKeys.releases(selectedProject),
            });
          })
          .catch(() => setSelectedProject(null));
      },
    );
  }, []);

  async function openFolder() {
    const path = await openDialog({ directory: true, multiple: false });
    if (!path || typeof path !== "string") return;

    setLoading(true);
    setError(null);
    try {
      await invoke("init_working_folder", { path });
      setSelectedProject(path);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  return { error, loading, openFolder };
}
