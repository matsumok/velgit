import { useMutation } from "@tanstack/react-query";
import { invoke } from "@tauri-apps/api/core";

export function useGetPdfImage() {
  return useMutation({
    mutationFn: ({ filename, oid }: { filename: string; oid: string }) =>
      invoke<string>("get_pdf_image", { filename, oid }),
  });
}
