import { invoke } from "@tauri-apps/api/core";
import { useEffect, useState } from "react";

interface Props {
	filePath: string;
}

export function PdfViewer({ filePath }: Props) {
	const [numPages, setNumPages] = useState(0);
	const [currentPage, setCurrentPage] = useState(0);
	const [imgSrc, setImgSrc] = useState<string | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		let cancelled = false;
		setImgSrc(null);
		setNumPages(0);
		setCurrentPage(0);
		setError(null);
		setLoading(true);

		invoke<number>("get_pdf_page_count", { path: filePath })
			.then((count) => {
				if (cancelled) return;
				setNumPages(count);
				setCurrentPage(0);
			})
			.catch((e) => {
				if (!cancelled) setError(String(e));
			});

		return () => {
			cancelled = true;
		};
	}, [filePath]);

	useEffect(() => {
		if (numPages === 0) return;
		let cancelled = false;
		setLoading(true);

		invoke<ArrayBuffer>("render_pdf_page", {
			path: filePath,
			page: currentPage,
			scale: 1.5,
		})
			.then((buf) => {
				if (cancelled) return;
				const blob = new Blob([buf], { type: "image/png" });
				const url = URL.createObjectURL(blob);
				setImgSrc((prev) => {
					if (prev) URL.revokeObjectURL(prev);
					return url;
				});
				setLoading(false);
			})
			.catch((e) => {
				if (!cancelled) setError(String(e));
			});

		return () => {
			cancelled = true;
		};
	}, [filePath, currentPage, numPages]);

	if (error) {
		return (
			<div className="flex items-center justify-center h-full text-destructive text-sm p-4">
				{error}
			</div>
		);
	}

	if (numPages === 0) {
		return (
			<div className="flex items-center justify-center h-full text-muted-foreground text-sm italic">
				読み込み中...
			</div>
		);
	}

	return (
		<div className="flex flex-col h-full">
			{numPages > 1 && (
				<div className="flex items-center justify-center gap-3 py-2 border-b border-border text-xs shrink-0">
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
				</div>
			)}
			<div className="flex-1 overflow-auto p-2 relative">
				{loading && (
					<div className="absolute inset-0 flex items-center justify-center text-muted-foreground text-sm">
						レンダリング中...
					</div>
				)}
				{imgSrc && (
					<img
						src={imgSrc}
						alt={`ページ ${currentPage + 1}`}
						className="w-full"
					/>
				)}
			</div>
		</div>
	);
}
