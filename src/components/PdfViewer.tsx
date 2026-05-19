import { convertFileSrc } from "@tauri-apps/api/core";
import * as pdfjsLib from "pdfjs-dist";
import workerSrc from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { useEffect, useRef, useState } from "react";

pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;

interface Props {
	filePath: string;
}

export function PdfViewer({ filePath }: Props) {
	const [pdf, setPdf] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
	const [numPages, setNumPages] = useState(0);
	const [currentPage, setCurrentPage] = useState(1);
	const canvasRef = useRef<HTMLCanvasElement>(null);

	useEffect(() => {
		let cancelled = false;
		setPdf(null);
		setCurrentPage(1);

		const url = convertFileSrc(filePath);
		const task = pdfjsLib.getDocument(url);

		task.promise
			.then((doc) => {
				if (cancelled) {
					doc.destroy();
					return;
				}
				setPdf(doc);
				setNumPages(doc.numPages);
			})
			.catch(console.error);

		return () => {
			cancelled = true;
			task.destroy();
		};
	}, [filePath]);

	useEffect(() => {
		if (!pdf || !canvasRef.current) return;
		let cancelled = false;

		pdf
			.getPage(currentPage)
			.then((page) => {
				if (cancelled || !canvasRef.current) return;
				const canvas = canvasRef.current;
				const ctx = canvas.getContext("2d");
				if (!ctx) return;
				const containerWidth = canvas.parentElement?.clientWidth ?? 400;
				const baseVp = page.getViewport({ scale: 1 });
				const scale = containerWidth / baseVp.width;
				const viewport = page.getViewport({ scale });
				canvas.width = viewport.width;
				canvas.height = viewport.height;
				page
					.render({ canvasContext: ctx, canvas, viewport })
					.promise.catch(console.error);
			})
			.catch(console.error);

		return () => {
			cancelled = true;
		};
	}, [pdf, currentPage]);

	if (!pdf) {
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
						disabled={currentPage <= 1}
						onClick={() => setCurrentPage((p) => p - 1)}
						className="px-2 py-1 bg-muted rounded disabled:opacity-40 hover:bg-muted/70"
					>
						‹
					</button>
					<span className="text-muted-foreground">
						{currentPage} / {numPages}
					</span>
					<button
						type="button"
						disabled={currentPage >= numPages}
						onClick={() => setCurrentPage((p) => p + 1)}
						className="px-2 py-1 bg-muted rounded disabled:opacity-40 hover:bg-muted/70"
					>
						›
					</button>
				</div>
			)}
			<div className="flex-1 overflow-auto p-2">
				<canvas ref={canvasRef} className="w-full" />
			</div>
		</div>
	);
}
