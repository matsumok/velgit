import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { invoke } from "@tauri-apps/api/core";
import { useAppStore } from "../store/useAppStore";
import { queryKeys } from "./queryKeys";

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
  const isProjectReady = useAppStore((s) => s.isProjectReady);
  return useQuery<ReleaseEntry[]>({
    queryKey: selectedProject ? queryKeys.releases(selectedProject) : [],
    queryFn: () => invoke<ReleaseEntry[]>("list_releases"),
    enabled: isProjectReady && selectedProject !== null,
  });
}

export function useGetReleaseDrawings(releaseId: number | null) {
  return useQuery<string[]>({
    queryKey: releaseId !== null ? queryKeys.releaseDrawings(releaseId) : [],
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
  const selectedProject = useAppStore((s) => s.selectedProject);
  return useMutation({
    mutationFn: (params: CreateReleaseParams) =>
      invoke<number>(
        "create_release",
        params as unknown as Record<string, unknown>,
      ),
    onSuccess: () => {
      if (!selectedProject) return;
      queryClient.invalidateQueries({
        queryKey: queryKeys.releases(selectedProject),
      });
    },
  });
}
