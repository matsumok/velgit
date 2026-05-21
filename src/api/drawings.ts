import { invoke } from "@tauri-apps/api/core";
import { useQuery } from "@tanstack/react-query";
import { useAppStore } from "../store/useAppStore";

export interface Drawing {
  filename: string;
  added_at: number;
}

export function useGetDrawings() {
  const selectedProject = useAppStore((s) => s.selectedProject);
  return useQuery<Drawing[]>({
    queryKey: ["drawings", selectedProject],
    queryFn: () => invoke<Drawing[]>("get_drawings"),
    enabled: selectedProject !== null,
  });
}
