import { useQuery } from "@tanstack/react-query";
import { invoke } from "@tauri-apps/api/core";

export interface GenerateDiffResult {
  changeType: "none" | "minor" | "meaningful";
  url: string | null;
}

export function useDiffAtCommit(
  filename: string | null,
  historyOid: string | null,
  baseOid: string | null,
) {
  return useQuery<GenerateDiffResult>({
    queryKey: ["diff_at_commit", filename, historyOid, baseOid],
    queryFn: () =>
      invoke<GenerateDiffResult>("generate_diff", {
        filename,
        oidA: historyOid,
        oidB: baseOid,
      }),
    enabled: !!filename && !!historyOid,
    staleTime: Number.POSITIVE_INFINITY,
  });
}
