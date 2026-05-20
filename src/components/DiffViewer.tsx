import { invoke } from "@tauri-apps/api/core";
import { useEffect, useState } from "react";

interface DiffResult {
	diff_png_b64: string;
	change_ratio: number;
	changed_pixels: number;
	total_pixels: number;
	width: number;
	height: number;
}

interface Props {
	repoPath: string;
	commitA: string; // 旧バージョン（親コミット）
	commitB: string; // 新バージョン（選択コミット）
	filePath: string;
}

export function DiffViewer({ repoPath, commitA, commitB, filePath }: Props) {
	const [numPages, setNumPages] = useState(0);
	const [currentPage, setCurrentPage] = useState(0);
	const [diff, setDiff] = useState<DiffResult | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	// ページ数取得（新バージョン基準）
	useEffect(() => {
		let cancelled = false;
		setDiff(null);
		setNumPages(0);
		setCurrentPage(0);
		setError(null);
		setLoading(true);

		invoke<number>("get_pdf_page_count_at_commit", {
			repoPath,
			commitSha: commitB,
			filePath,
		})
			.then((count) => {
				if (!cancelled) setNumPages(count);
			})
			.catch((e) => {
				if (!cancelled) setError(String(e));
			});

		return () => {
			cancelled = true;
		};
	}, [repoPath, commitB, filePath]);

	// diff 取得
	useEffect(() => {
		if (numPages === 0) return;
		let cancelled = false;
		setLoading(true);
		setDiff(null);

		invoke<DiffResult>("diff_pdf_pages_at_commits", {
			repoPath,
			commitA,
			commitB,
			filePath,
			page: currentPage,
			scale: 1.5,
		})
			.then((result) => {
				if (!cancelled) {
					setDiff(result);
					setLoading(false);
				}
			})
			.catch((e) => {
				if (!cancelled) setError(String(e));
			});

		return () => {
			cancelled = true;
		};
	}, [repoPath, commitA, commitB, filePath, currentPage, numPages]);

	if (error) {
		return (
			<div className="flex items-center justify-center h-full text-destructive text-sm p-4">
				{error}
			</div>
		);
	}

	if (numPages === 0) {
		return (
			<div className="flex items-center justify-center h-full text-muted-foreground text-sm">
				読み込み中...
			</div>
		);
	}

	const changePercent = diff ? (diff.change_ratio * 100).toFixed(1) : null;

	return (
		<div className="flex flex-col h-full">
			{/* ツールバー */}
			<div className="flex items-center gap-2 px-3 h-8 border-b border-border shrink-0 text-xs">
				{numPages > 1 && (
					<>
						<button
							type="button"
							disabled={currentPage <= 0}
							onClick={() => setCurrentPage((p) => p - 1)}
							className="px-2 py-1 bg-muted rounded disabled:opacity-40 hover:bg-muted/70"
						>
							‹
						</button>
						<span className="text-muted-foreground">
							{currentPage + 1} / {numPages}
						</span>
						<button
							type="button"
							disabled={currentPage >= numPages - 1}
							onClick={() => setCurrentPage((p) => p + 1)}
							className="px-2 py-1 bg-muted rounded disabled:opacity-40 hover:bg-muted/70"
						>
							›
						</button>
					</>
				)}
				{changePercent !== null && (
					<span
						className={`ml-auto font-mono ${
							diff?.change_ratio > 0.01
								? "text-red-400"
								: diff?.change_ratio > 0
									? "text-yellow-400"
									: "text-green-400"
						}`}
					>
						{diff?.change_ratio === 0 ? "変化なし" : `${changePercent}% 変化`}
					</span>
				)}
			</div>

			{/* diff 画像 */}
			<div className="flex-1 overflow-auto p-2 relative">
				{loading && (
					<div className="absolute inset-0 flex items-center justify-center text-muted-foreground text-sm">
						差分計算中...
					</div>
				)}
				{diff && (
					<img
						src={`data:image/png;base64,${diff.diff_png_b64}`}
						alt={`差分 ページ ${currentPage + 1}`}
						className="w-full"
					/>
				)}
			</div>
		</div>
	);
}
