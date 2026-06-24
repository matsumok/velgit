import { useQuery } from "@tanstack/react-query";
import { invoke } from "@tauri-apps/api/core";
import { useAppStore } from "../store/useAppStore";
import { queryKeys } from "./queryKeys";

export function useGetHeadFiles() {
  const selectedProject = useAppStore((s) => s.selectedProject);
  const isProjectReady = useAppStore((s) => s.isProjectReady);
  return useQuery<string[]>({
    queryKey: selectedProject ? queryKeys.headFiles(selectedProject) : [],
    queryFn: () => invoke<string[]>("get_head_files"),
    enabled: isProjectReady && selectedProject !== null,
  });
}
