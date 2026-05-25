import { useQuery } from "@tanstack/react-query";
import { useMutation } from "@tanstack/react-query";
import { invoke } from "@tauri-apps/api/core";

export function useGetPdfImage() {
  return useMutation({
    mutationFn: ({ filename, oid }: { filename: string; oid: string }) =>
      invoke<string>("get_pdf_image", { filename, oid }),
  });
}

export function useWorkingCopyPreview(filename: string | null) {
  return useQuery<string>({
    queryKey: ["wc_image", filename],
    queryFn: () => invoke<string>("get_working_copy_image", { filename }),
    enabled: !!filename,
    staleTime: 0,
  });
}

export function useDrawingPreview(
  filename: string | null,
  oid: string | null,
  size: "thumb" | "full" = "full",
) {
  return useQuery<string>({
    queryKey: ["pdf_image", filename, oid, size],
    queryFn: () => invoke<string>("get_pdf_image", { filename, oid, size }),
    enabled: !!filename && !!oid,
    staleTime: 5 * 60 * 1000,
  });
}
