import { useQuery } from "@tanstack/react-query";
import { invoke } from "@tauri-apps/api/core";
import { useAppStore } from "../store/useAppStore";
import type { CommitEntry } from "./commitHistory";
import { queryKeys } from "./queryKeys";

export function useGetProjectCommits() {
  const selectedProject = useAppStore((s) => s.selectedProject);
  const isProjectReady = useAppStore((s) => s.isProjectReady);
  return useQuery<CommitEntry[]>({
    queryKey: selectedProject ? queryKeys.projectCommits(selectedProject) : [],
    queryFn: () => invoke<CommitEntry[]>("get_project_commits"),
    enabled: isProjectReady && selectedProject !== null,
  });
}

export function useGetDrawingsAtCommit(oid: string) {
  const selectedProject = useAppStore((s) => s.selectedProject);
  const isProjectReady = useAppStore((s) => s.isProjectReady);
  return useQuery<string[]>({
    queryKey: selectedProject
      ? queryKeys.drawingsAtCommit(selectedProject, oid)
      : [],
    queryFn: () => invoke<string[]>("get_drawings_at_commit", { oid }),
    enabled: isProjectReady && selectedProject !== null && oid !== "HEAD",
  });
}
