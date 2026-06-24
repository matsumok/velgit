import { DownloadSimpleIcon } from "@phosphor-icons/react";
import { save as saveDialog } from "@tauri-apps/plugin-dialog";
import { useGetProjectCommits } from "../api/projectCommits";
import { useGenerateCommitBindPdf } from "../api/releases";
import { Button } from "./ui/button";

function formatPdfName(timestamp: number, message: string): string {
  const d = new Date(timestamp * 1000);
  const yy = String(d.getFullYear()).slice(2);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const safe = message.replace(/[\\/:*?"<>|]/g, "_").slice(0, 40);
  return `${yy}${mm}${dd}_${safe}.pdf`;
}

export function CommitDetailPanel({ commitOid }: { commitOid: string }) {
  const { data: commits = [] } = useGetProjectCommits();
  const commit = commits.find((c) => c.oid === commitOid);

  const { mutateAsync: generatePdf, isPending } = useGenerateCommitBindPdf();

  async function handleDownload() {
    if (!commit) return;
    const defaultName = formatPdfName(commit.timestamp, commit.message);
    const savePath = await saveDialog({
      defaultPath: defaultName,
      filters: [{ name: "PDF", extensions: ["pdf"] }],
    });
    if (!savePath) return;
    await generatePdf({ commitOid, savePath });
  }

  return (
    <div className="border-t p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground truncate min-w-0">
          {commit?.message ?? commitOid.slice(0, 7)}
        </p>
        <Button
          size="sm"
          variant="outline"
          onClick={handleDownload}
          disabled={isPending || !commit}
          className="shrink-0"
        >
          <DownloadSimpleIcon className="mr-1.5 size-4" />
          {isPending ? "生成中…" : "一式PDF"}
        </Button>
      </div>
    </div>
  );
}
