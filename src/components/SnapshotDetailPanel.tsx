import {
  ArchiveIcon,
  DownloadSimpleIcon,
  GitCommitIcon,
} from "@phosphor-icons/react";
import { save as saveDialog } from "@tauri-apps/plugin-dialog";
import { useGetProjectCommits } from "../api/projectCommits";
import {
  useGenerateBindPdf,
  useGenerateCommitBindPdf,
  useGenerateCommitZip,
  useGenerateReleaseZip,
  useListReleases,
} from "../api/releases";
import { ReleaseKindBadge } from "./ReleaseKindBadge";
import { Button } from "./ui/button";

function formatFileName(timestamp: number, label: string, ext: string): string {
  const d = new Date(timestamp * 1000);
  const yy = String(d.getFullYear()).slice(2);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const safe = label.replace(/[\\/:*?"<>|]/g, "_").slice(0, 40);
  return `${yy}${mm}${dd}_${safe}.${ext}`;
}

interface ReleaseMode {
  mode: "release";
  releaseId: number;
}

interface BrowseMode {
  mode: "browse";
  commitOid: string;
  selectedFilenames: string[];
}

type SnapshotDetailPanelProps = ReleaseMode | BrowseMode;

export function SnapshotDetailPanel(props: SnapshotDetailPanelProps) {
  const { data: releases = [] } = useListReleases();
  const { data: commits = [] } = useGetProjectCommits();

  const { mutateAsync: generateBindPdf, isPending: bindPdfPending } =
    useGenerateBindPdf();
  const {
    mutateAsync: generateCommitBindPdf,
    isPending: commitBindPdfPending,
  } = useGenerateCommitBindPdf();
  const { mutateAsync: generateReleaseZip, isPending: releaseZipPending } =
    useGenerateReleaseZip();
  const { mutateAsync: generateCommitZip, isPending: commitZipPending } =
    useGenerateCommitZip();

  if (props.mode === "release") {
    const { releaseId } = props;
    const release = releases.find((r) => r.id === releaseId);
    const commit = commits.find((c) => c.oid === release?.commitOid);
    const isPdfPending = bindPdfPending;
    const isZipPending = releaseZipPending;

    async function handlePdf() {
      if (!release) return;
      const defaultName = formatFileName(
        release.createdAt,
        release.name,
        "pdf",
      );
      const savePath = await saveDialog({
        defaultPath: defaultName,
        filters: [{ name: "PDF", extensions: ["pdf"] }],
      });
      if (!savePath) return;
      await generateBindPdf({ releaseId, savePath });
    }

    async function handleZip() {
      if (!release) return;
      const defaultName = formatFileName(
        release.createdAt,
        release.name,
        "zip",
      );
      const savePath = await saveDialog({
        defaultPath: defaultName,
        filters: [{ name: "ZIP", extensions: ["zip"] }],
      });
      if (!savePath) return;
      await generateReleaseZip({ releaseId, savePath });
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
              <code className="font-mono shrink-0">
                {release?.commitOid.slice(0, 7) ?? "—"}
              </code>
              {commit && <span className="truncate">{commit.message}</span>}
            </div>
          </div>
          <div className="flex gap-1.5 shrink-0">
            <Button
              size="sm"
              variant="outline"
              onClick={handleZip}
              disabled={isZipPending || !release}
            >
              <ArchiveIcon className="mr-1.5 size-4" />
              {isZipPending ? "生成中…" : ".zip"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handlePdf}
              disabled={isPdfPending || !release}
            >
              <DownloadSimpleIcon className="mr-1.5 size-4" />
              {isPdfPending ? "生成中…" : "一式PDF"}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // browse mode（過去コミット）
  const { commitOid, selectedFilenames } = props;
  const commit = commits.find((c) => c.oid === commitOid);
  const isPdfPending = commitBindPdfPending;
  const isZipPending = commitZipPending;
  const disabled = selectedFilenames.length === 0;

  async function handlePdf() {
    if (!commit) return;
    const defaultName = formatFileName(commit.timestamp, commit.message, "pdf");
    const savePath = await saveDialog({
      defaultPath: defaultName,
      filters: [{ name: "PDF", extensions: ["pdf"] }],
    });
    if (!savePath) return;
    await generateCommitBindPdf({
      commitOid,
      filenames: selectedFilenames,
      savePath,
    });
  }

  async function handleZip() {
    if (!commit) return;
    const defaultName = formatFileName(commit.timestamp, commit.message, "zip");
    const savePath = await saveDialog({
      defaultPath: defaultName,
      filters: [{ name: "ZIP", extensions: ["zip"] }],
    });
    if (!savePath) return;
    await generateCommitZip({
      commitOid,
      filenames: selectedFilenames,
      savePath,
    });
  }

  return (
    <div className="border-t p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground min-w-0">
          <GitCommitIcon className="size-3.5 shrink-0" />
          <code className="font-mono shrink-0">{commitOid.slice(0, 7)}</code>
          {commit && <span className="truncate">{commit.message}</span>}
        </div>
        <div className="flex gap-1.5 shrink-0">
          <Button
            size="sm"
            variant="outline"
            onClick={handleZip}
            disabled={isZipPending || !commit || disabled}
          >
            <ArchiveIcon className="mr-1.5 size-4" />
            {isZipPending ? "生成中…" : ".zip"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={handlePdf}
            disabled={isPdfPending || !commit || disabled}
          >
            <DownloadSimpleIcon className="mr-1.5 size-4" />
            {isPdfPending ? "生成中…" : "一式PDF"}
          </Button>
        </div>
      </div>
    </div>
  );
}
