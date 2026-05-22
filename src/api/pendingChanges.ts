import { invoke } from "@tauri-apps/api/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAppStore } from "../store/useAppStore";

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
    queryKey: ["pending_changes", selectedProject],
    queryFn: () => invoke<PendingChange[]>("get_pending_changes"),
    enabled: selectedProject !== null,
  });
}

export function useCommitChanges() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      message,
      overrides,
      createdBy,
    }: {
      message: string;
      overrides: string[];
      createdBy: string;
    }) => invoke<void>("commit_changes", { message, overrides, createdBy }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pending_changes"] });
      queryClient.invalidateQueries({ queryKey: ["drawings"] });
    },
  });
}
