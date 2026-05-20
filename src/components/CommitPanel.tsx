import { invoke } from "@tauri-apps/api/core";
import { useState } from "react";
import { Button } from "@/components/ui/button";

interface Props {
	repoPath: string;
	stagedCount: number;
	onSuccess: () => void;
}

export function CommitPanel({ repoPath, stagedCount, onSuccess }: Props) {
	const [message, setMessage] = useState("");
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const canCommit = stagedCount > 0 && message.trim().length > 0 && !loading;

	const handleCommit = async () => {
		if (!canCommit) return;
		setError(null);
		setLoading(true);
		try {
			await invoke("create_commit", { repoPath, message: message.trim() });
			setMessage("");
			onSuccess();
		} catch (e) {
			setError(String(e));
		} finally {
			setLoading(false);
		}
	};

	return (
		<div className="border-t border-border shrink-0 p-2 flex flex-col gap-2">
			{error && (
				<p className="text-xs text-destructive px-1">{error}</p>
			)}
			<textarea
				value={message}
				onChange={(e) => setMessage(e.target.value)}
				onKeyDown={(e) => {
					if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleCommit();
				}}
				placeholder={
					stagedCount > 0
						? `コミットメッセージ（${stagedCount}ファイル）`
						: "ステージされたファイルなし"
				}
				disabled={stagedCount === 0}
				rows={2}
				className="w-full bg-background border border-border rounded px-2 py-2 text-xs resize-none outline-none focus:border-primary disabled:opacity-40 font-mono placeholder:font-sans"
			/>
			<Button
				size="sm"
				className="h-6 text-xs w-full"
				disabled={!canCommit}
				onClick={handleCommit}
			>
				{loading ? "コミット中..." : "コミット"}
			</Button>
		</div>
	);
}
