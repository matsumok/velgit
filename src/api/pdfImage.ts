import { useQuery } from "@tanstack/react-query";
import { useMutation } from "@tanstack/react-query";
import { invoke } from "@tauri-apps/api/core";

export function useGetPdfImage() {
  return useMutation({
    mutationFn: ({ filename, oid }: { filename: string; oid: string }) =>
      invoke<string>("get_pdf_image", { filename, oid }),
  });
}

export function useDrawingPreview(filename: string | null, oid: string | null) {
  return useQuery<string>({
    queryKey: ["pdf_image", filename, oid],
    queryFn: () => invoke<string>("get_pdf_image", { filename, oid }),
    enabled: !!filename && !!oid,
    staleTime: Number.POSITIVE_INFINITY,
  });
}
