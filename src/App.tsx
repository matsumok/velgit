import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { useState } from "react";
import type { CommitInfo } from "./components/CommitTree";
import { CommitTree } from "./components/CommitTree";
import { PdfViewer } from "./components/PdfViewer";

interface RepoInfo {
	name: string;
	path: string;
	branch: string;
	head_sha: string;
	head_message: string;
}

function App() {
	const [repo, setRepo] = useState<RepoInfo | null>(null);
	const [commits, setCommits] = useState<CommitInfo[]>([]);
	const [error, setError] = useState<string | null>(null);
	const [pdfPath, setPdfPath] = useState<string | null>(null);
	const [selectedHash, setSelectedHash] = useState<string | null>(null);

	async function openPdf() {
		const selected = await open({
			multiple: false,
			filters: [{ name: "PDF", extensions: ["pdf"] }],
		});
		if (selected) setPdfPath(selected as string);
	}

	async function openRepo() {
		const selected = await open({ directory: true, multiple: false });
		if (!selected) return;

		try {
			const info = await invoke<RepoInfo>("open_repo", { path: selected });
			setRepo(info);
			setError(null);

			const log = await invoke<CommitInfo[]>("get_commits", {
				path: selected,
				maxCount: 100,
			});
			setCommits(log);
		} catch (e) {
			setError(e as string);
			setRepo(null);
			setCommits([]);
		}
	}

	return (
		<div className="dark flex h-screen w-screen bg-background text-foreground overflow-hidden">
			{/* 左ペイン: リポジトリ情報 */}
			<aside className="w-64 shrink-0 border-r border-border flex flex-col">
				<div className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground border-b border-border flex items-center justify-between">
					<span>リポジトリ</span>
					<button
						type="button"
						onClick={openRepo}
						className="text-xs px-2 py-1 bg-primary text-primary-foreground hover:bg-primary/90 rounded transition-colors"
					>
						開く
					</button>
				</div>
				<div className="flex-1 p-3 text-sm overflow-y-auto">
					{repo ? (
						<div className="space-y-2">
							<p className="font-semibold truncate">{repo.name}</p>
							<p className="text-muted-foreground text-xs truncate">
								{repo.path}
							</p>
							<div className="mt-3 space-y-1">
								<p className="text-xs text-muted-foreground">ブランチ</p>
								<p className="text-xs font-mono bg-muted px-2 py-1 rounded">
									{repo.branch}
								</p>
							</div>
							<div className="space-y-1">
								<p className="text-xs text-muted-foreground">HEAD</p>
								<p className="text-xs font-mono bg-muted px-2 py-1 rounded">
									{repo.head_sha}
								</p>
								<p className="text-xs text-muted-foreground truncate">
									{repo.head_message}
								</p>
							</div>
						</div>
					) : (
						<p className="text-muted-foreground italic text-xs">
							リポジトリを開いてください
						</p>
					)}
					{error && <p className="text-destructive text-xs mt-2">{error}</p>}
				</div>
			</aside>

			{/* 中央: コミットツリー */}
			<main className="flex-1 flex flex-col border-r border-border min-w-0">
				<div className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground border-b border-border">
					コミットツリー
					{commits.length > 0 && (
						<span className="ml-2 font-normal normal-case">
							{commits.length} 件
						</span>
					)}
				</div>
				<div className="flex-1 overflow-y-auto flex flex-col">
					{repo ? (
						<CommitTree
							commits={commits}
							selectedHash={selectedHash}
							onSelect={setSelectedHash}
						/>
					) : (
						<div className="flex items-center justify-center h-full">
							<p className="text-muted-foreground text-sm">
								リポジトリを開いてください
							</p>
						</div>
					)}
				</div>
			</main>

			{/* 右ペイン: PDFプレビュー + diff */}
			<aside className="w-96 shrink-0 flex flex-col">
				<div className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground border-b border-border flex items-center justify-between">
					<span>PDFプレビュー / Diff</span>
					<button
						type="button"
						onClick={openPdf}
						className="text-xs px-2 py-1 bg-muted hover:bg-muted/70 rounded transition-colors"
					>
						開く
					</button>
				</div>
				<div className="flex-1 overflow-hidden">
					{pdfPath ? (
						<PdfViewer filePath={pdfPath} />
					) : (
						<div className="flex items-center justify-center h-full text-muted-foreground text-sm italic">
							ファイルを選択してください
						</div>
					)}
				</div>
			</aside>
		</div>
	);
}

export default App;
