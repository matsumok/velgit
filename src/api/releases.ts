import { invoke } from "@tauri-apps/api/core";
import { useMutation, useQueryClient } from "@tanstack/react-query";

interface CreateReleaseParams {
  name: string;
  kind: string;
  recipient: string | null;
  drawingFilenames: string[];
  createdBy: string;
}

export function useCreateRelease() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: CreateReleaseParams) =>
      invoke<number>(
        "create_release",
        params as unknown as Record<string, unknown>,
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["releases"] });
    },
  });
}
