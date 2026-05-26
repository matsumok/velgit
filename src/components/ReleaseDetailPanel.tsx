import { DownloadSimpleIcon, GitCommitIcon } from "@phosphor-icons/react";
import { save as saveDialog } from "@tauri-apps/plugin-dialog";
import { useGetProjectCommits } from "../api/projectCommits";
import { useGenerateBindPdf, useListReleases } from "../api/releases";
import { ReleaseKindBadge } from "./ReleaseKindBadge";
import { Button } from "./ui/button";

function formatPdfName(createdAt: number, name: string): string {
  const d = new Date(createdAt * 1000);
  const yy = String(d.getFullYear()).slice(2);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yy}${mm}${dd}_${name}.pdf`;
}

export function ReleaseDetailPanel({ releaseId }: { releaseId: number }) {
  const { data: releases = [] } = useListReleases();
  const release = releases.find((r) => r.id === releaseId);

  const { data: commits = [] } = useGetProjectCommits();
  const commit = commits.find((c) => c.oid === release?.commitOid);

  const { mutateAsync: generatePdf, isPending } = useGenerateBindPdf();

  async function handleDownload() {
    if (!release) return;
    const defaultName = formatPdfName(release.createdAt, release.name);
    const savePath = await saveDialog({
      defaultPath: defaultName,
      filters: [{ name: "PDF", extensions: ["pdf"] }],
    });
    if (!savePath) return;
    await generatePdf({ releaseId, savePath });
  }

  return (
    <div className="border-t p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1.5">
          <div className="flex items-center gap-2 flex-wrap">
            {release && <ReleaseKindBadge kind={release.kind} />}
            <span className="text-sm font-medium truncate">
              {release?.name ?? "…"}
            </span>
            {release?.recipient && (
              <span className="text-xs text-muted-foreground">
                · {release.recipient}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <GitCommitIcon className="size-3.5 shrink-0" />
            <code className="font-mono">
              {release?.commitOid.slice(0, 7) ?? "—"}
            </code>
            {commit && <span className="truncate">{commit.message}</span>}
          </div>
        </div>

        <Button
          size="sm"
          variant="outline"
          onClick={handleDownload}
          disabled={isPending || !release}
          className="shrink-0"
        >
          <DownloadSimpleIcon className="mr-1.5 size-4" />
          {isPending ? "生成中…" : "PDFダウンロード"}
        </Button>
      </div>
    </div>
  );
}
