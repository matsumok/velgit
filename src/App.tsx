import { FolderOpen } from "@phosphor-icons/react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { open } from "@tauri-apps/plugin-dialog";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
	ResizableHandle,
	ResizablePanel,
	ResizablePanelGroup,
} from "@/components/ui/resizable";
import { BranchSheet } from "./components/BranchSheet";
import { CommitPanel } from "./components/CommitPanel";
import type { CommitInfo } from "./components/CommitTree";
import { CommitTree } from "./components/CommitTree";
import { DiffViewer } from "./components/DiffViewer";
import type { FileEntry } from "./components/FileExplorer";
import { FileExplorer } from "./components/FileExplorer";
import { PdfViewer } from "./components/PdfViewer";

interface RepoInfo {
	name: string;
	path: string;
	branch: string;
	head_sha: string;
	head_message: string;
}

interface WorkingFileEntry {
	name: string;
	relative_path: string;
	status: string;
}

function App() {
	const [repoPath, setRepoPath] = useState<string | null>(null);
	const [repoInfo, setRepoInfo] = useState<RepoInfo | null>(null);
	const [commits, setCommits] = useState<CommitInfo[]>([]);
	const [files, setFiles] = useState<FileEntry[]>([]);
	const [workingFiles, setWorkingFiles] = useState<FileEntry[]>([]);
	const [selectedFile, setSelectedFile] = useState<string | null>(null);
	const [selectedFileIsWorking, setSelectedFileIsWorking] = useState(false);
	const [selectedCommit, setSelectedCommit] = useState<string | null>(null);
	const [isDragging, setIsDragging] = useState(false);
	const [viewMode, setViewMode] = useState<"preview" | "diff">("preview");

	const refreshWorkingTree = useCallback(async (path: string) => {
		try {
			const entries = await invoke<WorkingFileEntry[]>(
				"get_working_tree_status",
				{
					repoPath: path,
				},
			);
			setWorkingFiles(entries as FileEntry[]);
		} catch {
			setWorkingFiles([]);
		}
	}, []);

	const loadRepo = useCallback(
		async (path: string) => {
			const info = await invoke<RepoInfo>("open_repo", { path });
			setRepoInfo(info);
			setRepoPath(path);

			const log = await invoke<CommitInfo[]>("get_commits", {
				path,
				maxCount: 200,
			});
			setCommits(log);
			if (log.length > 0) setSelectedCommit(log[0].hash);

			await refreshWorkingTree(path);
		},
		[refreshWorkingTree],
	);

	const refreshRepo = useCallback(async () => {
		if (!repoPath) return;
		const info = await invoke<RepoInfo>("open_repo", { path: repoPath });
		setRepoInfo(info);
		const log = await invoke<CommitInfo[]>("get_commits", {
			path: repoPath,
			maxCount: 200,
		});
		setCommits(log);
		if (log.length > 0) setSelectedCommit(log[0].hash);
		await refreshWorkingTree(repoPath);
	}, [repoPath, refreshWorkingTree]);

	// Load files changed in the selected commit
	useEffect(() => {
		if (!repoPath || !selectedCommit) {
			setFiles([]);
			setSelectedFile(null);
			return;
		}
		invoke<string[]>("get_changed_files", {
			repoPath,
			commitSha: selectedCommit,
		})
			.then((paths) => {
				const entries: FileEntry[] = paths.map((p) => ({
					name: p.split("/").pop() ?? p,
					relative_path: p,
					status: "committed",
				}));
				setFiles(entries);
				setSelectedFile(null);
				setSelectedFileIsWorking(false);
			})
			.catch(console.error);
	}, [repoPath, selectedCommit]);

	const handleOpenRepo = async () => {
		const selected = await open({ directory: true, multiple: false });
		if (typeof selected === "string") {
			await loadRepo(selected);
		}
	};

	const handleFileSelect = (relativePath: string, isWorking: boolean) => {
		setSelectedFile(relativePath);
		setSelectedFileIsWorking(isWorking);
		setViewMode("preview");
	};

	const handleStage = async (relativePath: string) => {
		if (!repoPath) return;
		try {
			await invoke("stage_file", { repoPath, relativePath });
			await refreshWorkingTree(repoPath);
		} catch (e) {
			console.error(e);
		}
	};

	const handleRename = async (
		oldRelativePath: string,
		newRelativePath: string,
	) => {
		if (!repoPath) return;
		try {
			await invoke("rename_file", {
				repoPath,
				oldRelativePath,
				newRelativePath,
			});
			await refreshWorkingTree(repoPath);
			if (selectedFile === oldRelativePath) {
				setSelectedFile(newRelativePath);
			}
		} catch (e) {
			console.error(e);
		}
	};

	// File drop from OS (Tauri v2 event API)
	useEffect(() => {
		type DropPayload = { paths?: string[] };
		const unlistens = Promise.all([
			listen("tauri://drag-enter", () => setIsDragging(true)),
			listen("tauri://drag-leave", () => setIsDragging(false)),
			listen<DropPayload>("tauri://drag-drop", async (event) => {
				setIsDragging(false);
				if (!repoPath) return;
				const paths = event.payload.paths ?? [];
				const pdfs = paths.filter((p) => p.toLowerCase().endsWith(".pdf"));
				for (const pdf of pdfs) {
					// Only stage if the file is already inside the repo
					const normalized = pdf.replace(/\\/g, "/");
					const repoNorm = repoPath.replace(/\\/g, "/");
					if (normalized.startsWith(repoNorm)) {
						const rel = normalized.slice(repoNorm.length).replace(/^\//, "");
						try {
							await invoke("stage_file", { repoPath, relativePath: rel });
						} catch {
							// file may not be tracked yet; ignore
						}
					}
				}
				await refreshWorkingTree(repoPath);
			}),
		]);

		return () => {
			unlistens.then((fns) => {
				for (const fn of fns) fn();
			});
		};
	}, [repoPath, refreshWorkingTree]);

	const selectedCommitInfo = commits.find((c) => c.hash === selectedCommit);
	const parentSha = selectedCommitInfo?.parents[0] ?? null;

	// Count staged files (added = INDEX_NEW, modified includes INDEX_MODIFIED)
	const stagedCount = workingFiles.filter(
		(f) =>
			f.status === "added" || f.status === "modified" || f.status === "deleted",
	).length;

	const previewCommitSha = selectedFileIsWorking
		? undefined
		: (selectedCommit ?? undefined);

	return (
		<div className="dark h-screen flex flex-col bg-background text-foreground font-mono overflow-hidden">
			{/* Header */}
			<header className="flex items-center gap-2 px-3 h-10 border-b border-border shrink-0">
				<Button
					variant="ghost"
					size="sm"
					onClick={handleOpenRepo}
					className="gap-2 h-7 px-2 text-xs"
				>
					<FolderOpen size={14} />
					{repoInfo ? repoInfo.name : "リポジトリを開く"}
				</Button>
				{repoPath && repoInfo && (
					<>
						<BranchSheet
							repoPath={repoPath}
							currentBranch={repoInfo.branch}
							onBranchChange={refreshRepo}
						/>
						<span className="text-xs text-muted-foreground truncate hidden sm:block">
							{repoInfo.head_message}
						</span>
					</>
				)}
			</header>

			{repoInfo ? (
				<ResizablePanelGroup
					orientation="horizontal"
					className="flex-1 min-h-0"
				>
					{/* Left: compact commit tree */}
					<ResizablePanel defaultSize={180} minSize={100}>
						<div className="h-full flex flex-col">
							<div className="px-3 h-8 flex items-center text-xs text-muted-foreground border-b border-border shrink-0">
								コミット履歴
							</div>
							<div className="flex-1 min-h-0">
								<CommitTree
									commits={commits}
									selectedHash={selectedCommit}
									onSelect={setSelectedCommit}
								/>
							</div>
						</div>
					</ResizablePanel>

					<ResizableHandle withHandle />

					{/* Center: files changed in selected commit + working tree */}
					<ResizablePanel defaultSize={580} minSize={150}>
						<div className="h-full flex flex-col">
							<div className="px-3 h-8 flex items-center gap-2 text-xs text-muted-foreground border-b border-border shrink-0 overflow-hidden">
								{selectedCommitInfo ? (
									<>
										<span className="font-mono text-foreground/50 shrink-0">
											{selectedCommitInfo.short_sha}
										</span>
										<span className="truncate">
											{selectedCommitInfo.subject}
										</span>
									</>
								) : (
									<span>ファイル一覧</span>
								)}
							</div>
							<div className="flex-1 min-h-0">
								<FileExplorer
									files={files}
									workingFiles={workingFiles}
									isDragging={isDragging}
									selectedFile={selectedFile}
									onFileSelect={(path) => {
										const isWorking = workingFiles.some(
											(f) => f.relative_path === path,
										);
										handleFileSelect(path, isWorking);
									}}
									onStage={handleStage}
									onRename={handleRename}
								/>
							</div>
							<CommitPanel
								repoPath={repoPath ?? ""}
								stagedCount={stagedCount}
								onSuccess={refreshRepo}
							/>
						</div>
					</ResizablePanel>

					<ResizableHandle withHandle />

					{/* Right: PDF preview / diff */}
					<ResizablePanel defaultSize={580} minSize={200}>
						<div className="h-full flex flex-col">
							<div className="flex items-center border-b border-border shrink-0 h-8">
								<button
									type="button"
									onClick={() => setViewMode("preview")}
									className={`px-3 h-full text-xs transition-colors ${
										viewMode === "preview"
											? "text-foreground border-b-2 border-primary"
											: "text-muted-foreground hover:text-foreground"
									}`}
								>
									プレビュー
								</button>
								<button
									type="button"
									onClick={() => setViewMode("diff")}
									disabled={
										!parentSha || !selectedFile || selectedFileIsWorking
									}
									className={`px-3 h-full text-xs transition-colors disabled:opacity-30 ${
										viewMode === "diff"
											? "text-foreground border-b-2 border-primary"
											: "text-muted-foreground hover:text-foreground"
									}`}
								>
									差分
								</button>
							</div>
							<div className="flex-1 min-h-0 overflow-hidden">
								{selectedFile && repoPath ? (
									viewMode === "diff" &&
									parentSha &&
									selectedCommit &&
									!selectedFileIsWorking ? (
										<DiffViewer
											repoPath={repoPath}
											commitA={parentSha}
											commitB={selectedCommit}
											filePath={selectedFile}
										/>
									) : (
										<PdfViewer
											repoPath={repoPath}
											filePath={selectedFile}
											commitSha={previewCommitSha}
										/>
									)
								) : (
									<div className="flex items-center justify-center h-full text-muted-foreground text-sm">
										ファイルを選択してください
									</div>
								)}
							</div>
						</div>
					</ResizablePanel>
				</ResizablePanelGroup>
			) : (
				<div className="flex-1 flex items-center justify-center text-muted-foreground">
					<div className="text-center">
						<FolderOpen size={48} className="mx-auto mb-3 opacity-25" />
						<p className="text-sm mb-3">リポジトリを開いてください</p>
						<Button variant="outline" size="sm" onClick={handleOpenRepo}>
							フォルダを選択
						</Button>
					</div>
				</div>
			)}
		</div>
	);
}

export default App;
