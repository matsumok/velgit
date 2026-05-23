import { useQuery } from "@tanstack/react-query";
import { invoke } from "@tauri-apps/api/core";
import { useAppStore } from "../store/useAppStore";
import { queryKeys } from "./queryKeys";

export interface CommitEntry {
  oid: string;
  message: string;
  author: string;
  timestamp: number;
  changeType: string | null;
}

export function useGetCommitHistory() {
  const selectedDrawing = useAppStore((s) => s.selectedDrawing);
  return useQuery<CommitEntry[]>({
    queryKey: selectedDrawing ? queryKeys.commitHistory(selectedDrawing) : [],
    queryFn: () =>
      invoke<CommitEntry[]>("get_commit_history", {
        filename: selectedDrawing,
      }),
    enabled: selectedDrawing !== null,
  });
}
