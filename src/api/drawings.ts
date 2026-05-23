import { useQuery } from "@tanstack/react-query";
import { invoke } from "@tauri-apps/api/core";
import { useAppStore } from "../store/useAppStore";
import { queryKeys } from "./queryKeys";

export interface Drawing {
  filename: string;
  added_at: number;
}

export function useGetDrawings() {
  const selectedProject = useAppStore((s) => s.selectedProject);
  return useQuery<Drawing[]>({
    queryKey: selectedProject ? queryKeys.drawings(selectedProject) : [],
    queryFn: () => invoke<Drawing[]>("get_drawings"),
    enabled: selectedProject !== null,
  });
}
