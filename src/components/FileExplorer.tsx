import { FilePdf, FolderOpen, PencilSimple, Plus } from "@phosphor-icons/react";
import { useRef, useState } from "react";
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
	files: FileEntry[];           // files changed in selected commit
	workingFiles: FileEntry[];    // working tree status (live changes)
	isDragging: boolean;
	selectedFile: string | null;
	onFileSelect: (relativePath: string) => void;
	onStage?: (relativePath: string) => void;
	onRename?: (oldRelativePath: string, newRelativePath: string) => void;
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

function WorkingFileRow({
	file,
	isSelected,
	onClick,
	onStage,
	onRenameSubmit,
}: {
	file: FileEntry;
	isSelected: boolean;
	onClick: () => void;
	onStage?: () => void;
	onRenameSubmit?: (newRelativePath: string) => void;
}) {
	const badge = STATUS_BADGE[file.status];
	const [renaming, setRenaming] = useState(false);
	const [draft, setDraft] = useState(file.name);
	const inputRef = useRef<HTMLInputElement>(null);

	const commitRename = () => {
		const trimmed = draft.trim();
		if (trimmed && trimmed !== file.name && onRenameSubmit) {
			const dir = file.relative_path.includes("/")
				? file.relative_path.substring(0, file.relative_path.lastIndexOf("/") + 1)
				: "";
			onRenameSubmit(dir + trimmed);
		}
		setRenaming(false);
	};

	if (renaming) {
		return (
			<div className="flex items-center gap-2 px-3 py-1.5">
				<FilePdf size={15} className="shrink-0 text-red-400" weight="fill" />
				<input
					ref={inputRef}
					autoFocus
					value={draft}
					onChange={(e) => setDraft(e.target.value)}
					onKeyDown={(e) => {
						if (e.key === "Enter") commitRename();
						if (e.key === "Escape") { setRenaming(false); setDraft(file.name); }
					}}
					onBlur={commitRename}
					className="flex-1 text-sm bg-background border border-primary rounded px-1 py-0.5 outline-none"
				/>
			</div>
		);
	}

	return (
		<div
			className={cn(
				"flex items-center gap-2 px-3 py-1.5 hover:bg-accent transition-colors group",
				isSelected && "bg-accent",
			)}
		>
			<button
				type="button"
				className="flex items-center gap-2 flex-1 min-w-0 text-left"
				onClick={onClick}
			>
				<FilePdf size={15} className="shrink-0 text-red-400" weight="fill" />
				<span className="text-sm flex-1 truncate">{file.name}</span>
			</button>
			{badge && (
				<Badge
					variant="outline"
					className={cn("text-[10px] px-1 py-0 h-4 shrink-0", badge.className)}
				>
					{badge.label}
				</Badge>
			)}
			<div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
				{onStage && (file.status === "untracked" || file.status === "modified") && (
					<button
						type="button"
						onClick={(e) => { e.stopPropagation(); onStage(); }}
						className="p-0.5 hover:text-primary text-muted-foreground rounded"
						title="ステージ"
					>
						<Plus size={12} />
					</button>
				)}
				{onRenameSubmit && (
					<button
						type="button"
						onClick={(e) => { e.stopPropagation(); setRenaming(true); setDraft(file.name); }}
						className="p-0.5 hover:text-primary text-muted-foreground rounded"
						title="リネーム"
					>
						<PencilSimple size={12} />
					</button>
				)}
			</div>
		</div>
	);
}

function CommitFileRow({
	file,
	isSelected,
	onClick,
}: {
	file: FileEntry;
	isSelected: boolean;
	onClick: () => void;
}) {
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
		</button>
	);
}

export function FileExplorer({
	files,
	workingFiles,
	isDragging,
	selectedFile,
	onFileSelect,
	onStage,
	onRename,
}: FileExplorerProps) {
	return (
		<div className="relative h-full">
			<ScrollArea className="h-full">
				<div className="py-1">
					{workingFiles.length > 0 && (
						<>
							<div className="flex items-center gap-2 px-3 py-1 text-xs text-muted-foreground border-b border-border">
								<span>変更中 ({workingFiles.length})</span>
							</div>
							{workingFiles.map((file) => (
								<WorkingFileRow
									key={file.relative_path}
									file={file}
									isSelected={selectedFile === file.relative_path}
									onClick={() => onFileSelect(file.relative_path)}
									onStage={onStage ? () => onStage(file.relative_path) : undefined}
									onRenameSubmit={
										onRename
											? (newPath) => onRename(file.relative_path, newPath)
											: undefined
									}
								/>
							))}
							{files.length > 0 && <Separator className="my-1" />}
						</>
					)}

					{files.length > 0 && (
						<>
							{workingFiles.length > 0 && (
								<div className="flex items-center gap-2 px-3 py-1 text-xs text-muted-foreground border-b border-border">
									<span>このコミット ({files.length})</span>
								</div>
							)}
							{files.map((file) => (
								<CommitFileRow
									key={file.relative_path}
									file={file}
									isSelected={selectedFile === file.relative_path}
									onClick={() => onFileSelect(file.relative_path)}
								/>
							))}
						</>
					)}

					{files.length === 0 && workingFiles.length === 0 && (
						<div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2">
							<FolderOpen size={32} className="opacity-30" />
							<p className="text-sm">PDFファイルなし</p>
						</div>
					)}
				</div>
			</ScrollArea>

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
