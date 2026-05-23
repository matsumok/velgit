import { useMutation } from "@tanstack/react-query";
import { invoke } from "@tauri-apps/api/core";

export interface GenerateDiffResult {
  changeType: "none" | "minor" | "meaningful";
  url: string | null;
}

export function useGenerateDiff() {
  return useMutation({
    mutationFn: ({
      filename,
      oidA,
      oidB,
    }: {
      filename: string;
      oidA: string;
      oidB?: string;
    }) =>
      invoke<GenerateDiffResult>("generate_diff", {
        filename,
        oidA,
        oidB: oidB ?? null,
      }),
  });
}
