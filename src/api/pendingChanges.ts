import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { invoke } from "@tauri-apps/api/core";
import { useAppStore } from "../store/useAppStore";
import { queryKeys } from "./queryKeys";

export type ChangeStatus = "new" | "modified" | "deleted";
export type ChangeType = "none" | "minor" | "meaningful";

export interface PendingChange {
  filename: string;
  status: ChangeStatus;
  changeType: ChangeType;
}

export function useGetPendingChanges() {
  const selectedProject = useAppStore((s) => s.selectedProject);
  return useQuery<PendingChange[]>({
    queryKey: selectedProject ? queryKeys.pendingChanges(selectedProject) : [],
    queryFn: () => invoke<PendingChange[]>("get_pending_changes"),
    enabled: selectedProject !== null,
  });
}

export function useCommitChanges() {
  const queryClient = useQueryClient();
  const selectedProject = useAppStore((s) => s.selectedProject);
  return useMutation({
    mutationFn: ({
      message,
      includedFiles,
      createdBy,
    }: {
      message: string;
      includedFiles: string[];
      createdBy: string;
    }) => invoke<void>("commit_changes", { message, includedFiles, createdBy }),
    onSuccess: () => {
      if (!selectedProject) return;
      queryClient.invalidateQueries({
        queryKey: queryKeys.pendingChanges(selectedProject),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.drawings(selectedProject),
      });
    },
  });
}
