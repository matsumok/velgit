import { invoke } from "@tauri-apps/api/core";
import { useQuery } from "@tanstack/react-query";
import { useAppStore } from "../store/useAppStore";

export interface CommitEntry {
  oid: string;
  message: string;
  author: string;
  timestamp: number;
}

export function useGetCommitHistory() {
  const selectedDrawing = useAppStore((s) => s.selectedDrawing);
  return useQuery<CommitEntry[]>({
    queryKey: ["commit_history", selectedDrawing],
    queryFn: () =>
      invoke<CommitEntry[]>("get_commit_history", {
        filename: selectedDrawing,
      }),
    enabled: selectedDrawing !== null,
  });
}
