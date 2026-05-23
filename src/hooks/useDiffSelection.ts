import { useState } from "react";
import type { GenerateDiffResult } from "../api/generateDiff";
import { useGenerateDiff } from "../api/generateDiff";

type DiffState = {
  diffResult: GenerateDiffResult | undefined;
  isLoading: boolean;
  error: string | null;
};

export function useWorkingCopyDiff(): DiffState & {
  selectFile: (filename: string, headOid: string) => void;
} {
  const { mutate, isPending, error, data } = useGenerateDiff();

  function selectFile(filename: string, headOid: string) {
    mutate({ filename, oidA: headOid });
  }

  return {
    selectFile,
    diffResult: data,
    isLoading: isPending,
    error: error ? String(error) : null,
  };
}

export function useCommitPairDiff(filename: string): DiffState & {
  selectCommit: (oid: string) => void;
  isCommitSelected: (oid: string) => boolean;
} {
  const { mutate, isPending, error, data } = useGenerateDiff();
  const [selectedOids, setSelectedOids] = useState<[string, string] | null>(
    null,
  );

  function selectCommit(oid: string) {
    if (!selectedOids) {
      setSelectedOids([oid, oid]);
      return;
    }
    const [oidA] = selectedOids;
    const pair: [string, string] = [oidA, oid];
    setSelectedOids(pair);
    mutate({ filename, oidA: pair[0], oidB: pair[1] });
  }

  function isCommitSelected(oid: string) {
    return selectedOids?.[0] === oid || selectedOids?.[1] === oid;
  }

  return {
    selectCommit,
    isCommitSelected,
    diffResult: data,
    isLoading: isPending,
    error: error ? String(error) : null,
  };
}
