import { invoke } from "@tauri-apps/api/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAppStore } from "../store/useAppStore";

export interface ReleaseEntry {
  id: number;
  name: string;
  kind: string;
  recipient: string | null;
  commitOid: string;
  createdAt: number;
  createdBy: string;
  drawingCount: number;
}

export function useListReleases() {
  const selectedProject = useAppStore((s) => s.selectedProject);
  return useQuery<ReleaseEntry[]>({
    queryKey: ["releases"],
    queryFn: () => invoke<ReleaseEntry[]>("list_releases"),
    enabled: selectedProject !== null,
  });
}

export function useGetReleaseDrawings(releaseId: number | null) {
  return useQuery<string[]>({
    queryKey: ["release_drawings", releaseId],
    queryFn: () => invoke<string[]>("get_release_drawings", { releaseId }),
    enabled: releaseId !== null,
  });
}

export function useGenerateBindPdf() {
  return useMutation({
    mutationFn: ({
      releaseId,
      savePath,
    }: {
      releaseId: number;
      savePath: string;
    }) =>
      invoke<void>("generate_bind_pdf", {
        releaseId,
        savePath,
      }),
  });
}

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
