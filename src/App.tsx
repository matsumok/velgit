import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { open } from "@tauri-apps/plugin-dialog";
import { useCallback, useEffect, useState } from "react";
import type { CommitInfo } from "./components/CommitTree";
import { CommitTree } from "./components/CommitTree";
import type { FileEntry } from "./components/FileExplorer";
import { FileExplorer } from "./components/FileExplorer";
import { PdfViewer } from "./components/PdfViewer";
import {
	ResizableHandle,
	ResizablePanel,
	ResizablePanelGroup,
} from "@/components/ui/resizable";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FolderOpen, GitBranch } from "@phosphor-icons/react";

interface RepoInfo {
	name: string;
	path: string;
	branch: string;
	head_sha: string;
	head_message: string;
}

function App() {
	const [repoPath, setRepoPath] = useState<string | null>(null);
	const [repoInfo, setRepoInfo] = useState<RepoInfo | null>(null);
	const [commits, setCommits] = useState<CommitInfo[]>([]);
	const [files, setFiles] = useState<FileEntry[]>([]);
	const [selectedFile, setSelectedFile] = useState<string | null>(null);
	const [selectedCommit, setSelectedCommit] = useState<string | null>(null);
	const [isDragging, setIsDragging] = useState(false);

	const loadRepo = useCallback(async (path: string) => {
		const info = await invoke<RepoInfo>("open_repo", { path });
		setRepoInfo(info);
		setRepoPath(path);

		const log = await invoke<CommitInfo[]>("get_commits", {
			path,
			maxCount: 200,
		});
		setCommits(log);
		// Auto-select latest commit
		if (log.length > 0) setSelectedCommit(log[0].hash);
	}, []);

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
			})
			.catch(console.error);
	}, [repoPath, selectedCommit]);

	const handleOpenRepo = async () => {
		const selected = await open({ directory: true, multiple: false });
		if (typeof selected === "string") {
			await loadRepo(selected);
		}
	};

	// File drop from OS (Tauri v2 event API)
	useEffect(() => {
		type DropPayload = { paths?: string[] };
		const unlistens = Promise.all([
			listen("tauri://drag-enter", () => setIsDragging(true)),
			listen("tauri://drag-leave", () => setIsDragging(false)),
			listen<DropPayload>("tauri://drag-drop", (event) => {
				setIsDragging(false);
				if (!repoPath) return;
				const paths = event.payload.paths ?? [];
				const pdfs = paths.filter((p) => p.toLowerCase().endsWith(".pdf"));
				if (pdfs.length > 0) {
					// TODO: copy PDFs to repo dir and stage
					console.log("Dropped PDFs:", pdfs);
				}
			}),
		]);

		return () => {
			unlistens.then((fns) => fns.forEach((fn) => fn()));
		};
	}, [repoPath]);

	const selectedFilePath =
		selectedFile && repoPath ? `${repoPath}/${selectedFile}` : null;

	const selectedCommitInfo = commits.find((c) => c.hash === selectedCommit);

	return (
		<div className="dark h-screen flex flex-col bg-background text-foreground font-mono overflow-hidden">
			{/* Header */}
			<header className="flex items-center gap-2 px-3 h-10 border-b border-border shrink-0">
				<Button
					variant="ghost"
					size="sm"
					onClick={handleOpenRepo}
					className="gap-1.5 h-7 px-2 text-xs"
				>
					<FolderOpen size={14} />
					{repoInfo ? repoInfo.name : "リポジトリを開く"}
				</Button>
				{repoInfo && (
					<>
						<Badge variant="secondary" className="gap-1 text-xs h-5 px-1.5">
							<GitBranch size={11} />
							{repoInfo.branch}
						</Badge>
						<span className="text-xs text-muted-foreground truncate hidden sm:block">
							{repoInfo.head_message}
						</span>
					</>
				)}
			</header>

			{repoInfo ? (
				<ResizablePanelGroup orientation="horizontal" className="flex-1 min-h-0">
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

					{/* Center: files changed in selected commit */}
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
									isDragging={isDragging}
									selectedFile={selectedFile}
									onFileSelect={setSelectedFile}
								/>
							</div>
						</div>
					</ResizablePanel>

					<ResizableHandle withHandle />

					{/* Right: PDF preview */}
					<ResizablePanel defaultSize={580} minSize={200}>
						<div className="h-full flex flex-col">
							<div className="px-3 h-8 flex items-center text-xs text-muted-foreground border-b border-border shrink-0">
								プレビュー
							</div>
							<div className="flex-1 min-h-0 overflow-hidden">
								{selectedFilePath ? (
									<PdfViewer filePath={selectedFilePath} />
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
