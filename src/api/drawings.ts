import { invoke } from "@tauri-apps/api/core";
import { useQuery } from "@tanstack/react-query";

export interface Drawing {
  filename: string;
  added_at: number;
}

export function useGetDrawings() {
  return useQuery<Drawing[]>({
    queryKey: ["drawings"],
    queryFn: () => invoke<Drawing[]>("get_drawings"),
  });
}
