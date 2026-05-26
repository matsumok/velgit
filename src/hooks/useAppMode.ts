import { useGetPendingChanges } from "../api/pendingChanges";
import { useAppStore } from "../store/useAppStore";

export type AppMode =
  | { mode: "head-idle" }
  | { mode: "head-commit" }
  | { mode: "release"; releaseId: number }
  | { mode: "browse"; commitOid: string };

export function useAppMode(): AppMode {
  const selectedCommitOid = useAppStore((s) => s.selectedCommitOid);
  const selectedReleaseId = useAppStore((s) => s.selectedReleaseId);
  const { data: changes = [] } = useGetPendingChanges();

  if (selectedReleaseId !== null) {
    return { mode: "release", releaseId: selectedReleaseId };
  }
  if (selectedCommitOid !== "HEAD") {
    return { mode: "browse", commitOid: selectedCommitOid };
  }
  if (changes.length > 0) {
    return { mode: "head-commit" };
  }
  return { mode: "head-idle" };
}
