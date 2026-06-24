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
  blobOid: string | null;
  sourceFilename: string | null;
}

export function useGetCommitHistory() {
  const selectedDrawing = useAppStore((s) => s.selectedDrawing);
  const selectedProject = useAppStore((s) => s.selectedProject);
  const isProjectReady = useAppStore((s) => s.isProjectReady);
  return useQuery<CommitEntry[]>({
    queryKey:
      selectedProject && selectedDrawing
        ? queryKeys.commitHistory(selectedProject, selectedDrawing)
        : [],
    queryFn: () =>
      invoke<CommitEntry[]>("get_commit_history", {
        filename: selectedDrawing,
      }),
    enabled:
      isProjectReady && selectedProject !== null && selectedDrawing !== null,
  });
}
