import { invoke } from "@tauri-apps/api/core";
import { useQuery } from "@tanstack/react-query";

export interface Drawing {
  id: string;
  name: string;
  number: string;
}

export function useGetDrawings() {
  return useQuery<Drawing[]>({
    queryKey: ["drawings"],
    queryFn: () => invoke<Drawing[]>("get_drawings"),
  });
}
