import { FilePdf, FolderOpen } from "@phosphor-icons/react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

export interface FileEntry {
	name: string;
	relative_path: string;
	status: string; // "committed" | "modified" | "added" | "deleted" | "untracked"
}

interface FileExplorerProps {
	files: FileEntry[];
	isDragging: boolean;
	selectedFile: string | null;
	onFileSelect: (relativePath: string) => void;
}

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
	modified: {
		label: "M",
		className:
			"bg-yellow-500/20 text-yellow-400 border-yellow-500/30 font-mono",
	},
	added: {
		label: "A",
		className: "bg-green-500/20 text-green-400 border-green-500/30 font-mono",
	},
	deleted: {
		label: "D",
		className: "bg-red-500/20 text-red-400 border-red-500/30 font-mono",
	},
	untracked: {
		label: "U",
		className: "bg-blue-500/20 text-blue-400 border-blue-500/30 font-mono",
	},
};

function FileRow({
	file,
	isSelected,
	onClick,
}: {
	file: FileEntry;
	isSelected: boolean;
	onClick: () => void;
}) {
	const badge = STATUS_BADGE[file.status];

	return (
		<button
			type="button"
			className={cn(
				"w-full flex items-center gap-2 px-3 py-1.5 text-left hover:bg-accent transition-colors",
				isSelected && "bg-accent",
			)}
			onClick={onClick}
		>
			<FilePdf size={15} className="shrink-0 text-red-400" weight="fill" />
			<span className="text-sm flex-1 truncate">{file.name}</span>
			{badge && (
				<Badge
					variant="outline"
					className={cn("text-[10px] px-1 py-0 h-4 shrink-0", badge.className)}
				>
					{badge.label}
				</Badge>
			)}
		</button>
	);
}

export function FileExplorer({
	files,
	isDragging,
	selectedFile,
	onFileSelect,
}: FileExplorerProps) {
	const committedFiles = files.filter((f) => f.status === "committed");
	const changedFiles = files.filter((f) => f.status !== "committed");

	return (
		<div className="relative h-full">
			<ScrollArea className="h-full">
				<div className="py-1">
					{/* Column header */}
					<div className="flex items-center gap-2 px-3 py-1 text-xs text-muted-foreground border-b border-border">
						<span className="flex-1">ファイル名</span>
					</div>

					{committedFiles.map((file) => (
						<FileRow
							key={file.relative_path}
							file={file}
							isSelected={selectedFile === file.relative_path}
							onClick={() => onFileSelect(file.relative_path)}
						/>
					))}

					{changedFiles.length > 0 && (
						<>
							<Separator className="my-1" />
							<div className="px-3 py-1 text-xs text-muted-foreground">
								変更中 ({changedFiles.length})
							</div>
							{changedFiles.map((file) => (
								<FileRow
									key={file.relative_path}
									file={file}
									isSelected={selectedFile === file.relative_path}
									onClick={() => onFileSelect(file.relative_path)}
								/>
							))}
						</>
					)}

					{files.length === 0 && (
						<div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2">
							<FolderOpen size={32} className="opacity-30" />
							<p className="text-sm">PDFファイルなし</p>
						</div>
					)}
				</div>
			</ScrollArea>

			{/* DnD overlay — shown when dragging from OS */}
			{isDragging && (
				<div className="absolute inset-0 z-20 flex items-center justify-center bg-background/85 border-2 border-dashed border-primary rounded backdrop-blur-sm pointer-events-none">
					<div className="text-center">
						<FilePdf size={40} className="mx-auto mb-2 text-primary" />
						<p className="text-sm font-medium">PDFをドロップして追加</p>
					</div>
				</div>
			)}
		</div>
	);
}
