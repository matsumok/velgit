import {
	ArrowRight,
	Check,
	GitMerge,
	Plus,
	Trash,
} from "@phosphor-icons/react";
import { invoke } from "@tauri-apps/api/core";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

interface BranchInfo {
	name: string;
	is_head: boolean;
	upstream: string | null;
	tip_sha: string;
	tip_message: string;
}

interface Props {
	repoPath: string;
	currentBranch: string;
	onBranchChange: () => void;
}

export function BranchSheet({
	repoPath,
	currentBranch,
	onBranchChange,
}: Props) {
	const [open, setOpen] = useState(false);
	const [branches, setBranches] = useState<BranchInfo[]>([]);
	const [newName, setNewName] = useState("");
	const [creating, setCreating] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [busy, setBusy] = useState(false);
	const ref = useRef<HTMLDivElement>(null);

	const load = useCallback(async () => {
		try {
			const list = await invoke<BranchInfo[]>("list_branches", { repoPath });
			setBranches(list);
		} catch (e) {
			setError(String(e));
		}
	}, [repoPath]);

	useEffect(() => {
		if (open) load();
	}, [open, load]);

	useEffect(() => {
		if (!open) return;
		const handler = (e: MouseEvent) => {
			if (ref.current && !ref.current.contains(e.target as Node)) {
				setOpen(false);
			}
		};
		document.addEventListener("mousedown", handler);
		return () => document.removeEventListener("mousedown", handler);
	}, [open]);

	const run = async (fn: () => Promise<void>) => {
		setError(null);
		setBusy(true);
		try {
			await fn();
		} catch (e) {
			setError(String(e));
		} finally {
			setBusy(false);
		}
	};

	const handleCheckout = (name: string) =>
		run(async () => {
			await invoke("checkout_branch", { repoPath, branchName: name });
			onBranchChange();
			setOpen(false);
		});

	const handleMerge = (name: string) =>
		run(async () => {
			await invoke("merge_branch", { repoPath, branchName: name });
			onBranchChange();
		});

	const handleDelete = (name: string) =>
		run(async () => {
			await invoke("delete_branch", { repoPath, branchName: name });
			await load();
		});

	const handleCreate = () =>
		run(async () => {
			const trimmed = newName.trim();
			if (!trimmed) return;
			await invoke("create_branch", { repoPath, branchName: trimmed });
			setNewName("");
			setCreating(false);
			await load();
		});

	return (
		<div className="relative" ref={ref}>
			<button
				type="button"
				onClick={() => {
					setOpen((v) => !v);
					setError(null);
				}}
				className="flex items-center gap-1 text-xs h-5 px-2 rounded bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors font-mono"
			>
				<span className="text-xs">⎇</span>
				{currentBranch}
			</button>

			{open && (
				<div className="absolute top-full left-0 mt-1 z-50 w-72 bg-popover border border-border rounded-md shadow-xl overflow-hidden">
					<div className="flex items-center justify-between px-3 py-2 text-xs text-muted-foreground border-b border-border">
						<span>ブランチ</span>
						<button
							type="button"
							onClick={() => {
								setCreating((v) => !v);
								setNewName("");
							}}
							className="p-1 hover:text-foreground transition-colors rounded"
							title="新規ブランチ"
						>
							<Plus size={12} />
						</button>
					</div>

					{creating && (
						<div className="flex gap-1 p-2 border-b border-border">
							<input
								// biome-ignore lint/a11y/noAutofocus: ブランチ作成入力欄は意図的にフォーカス
								autoFocus
								type="text"
								value={newName}
								onChange={(e) => setNewName(e.target.value)}
								onKeyDown={(e) => {
									if (e.key === "Enter") handleCreate();
									if (e.key === "Escape") {
										setCreating(false);
										setNewName("");
									}
								}}
								placeholder="新しいブランチ名"
								className="flex-1 bg-background border border-border rounded px-2 py-1 text-xs outline-none focus:border-primary"
							/>
							<Button
								size="sm"
								className="h-6 px-2 text-xs"
								onClick={handleCreate}
								disabled={busy || !newName.trim()}
							>
								作成
							</Button>
						</div>
					)}

					{error && (
						<div className="px-3 py-2 text-xs text-destructive border-b border-border bg-destructive/5">
							{error}
						</div>
					)}

					<ScrollArea className="max-h-60">
						<div className="py-1">
							{branches.map((b) => (
								<div
									key={b.name}
									className="flex items-center gap-2 px-3 py-2 hover:bg-accent group"
								>
									<div className="flex-1 min-w-0">
										<div className="flex items-center gap-2">
											{b.is_head ? (
												<Check size={10} className="text-primary shrink-0" />
											) : (
												<span className="w-3 shrink-0" />
											)}
											<span
												className={`text-xs truncate ${
													b.is_head
														? "text-foreground font-medium"
														: "text-foreground/80"
												}`}
											>
												{b.name}
											</span>
										</div>
										<p className="text-2xs text-muted-foreground truncate pl-5">
											{b.tip_sha} · {b.tip_message}
										</p>
									</div>

									{!b.is_head && (
										<div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
											<button
												type="button"
												onClick={() => handleCheckout(b.name)}
												disabled={busy}
												className="p-1 hover:text-primary text-muted-foreground disabled:opacity-40"
												title="チェックアウト"
											>
												<ArrowRight size={11} />
											</button>
											<button
												type="button"
												onClick={() => handleMerge(b.name)}
												disabled={busy}
												className="p-1 hover:text-primary text-muted-foreground disabled:opacity-40"
												title="現在のブランチにマージ"
											>
												<GitMerge size={11} />
											</button>
											<button
												type="button"
												onClick={() => handleDelete(b.name)}
												disabled={busy}
												className="p-1 hover:text-destructive text-muted-foreground disabled:opacity-40"
												title="削除"
											>
												<Trash size={11} />
											</button>
										</div>
									)}
								</div>
							))}

							{branches.length === 0 && !error && (
								<p className="text-xs text-muted-foreground text-center py-4">
									読み込み中...
								</p>
							)}
						</div>
					</ScrollArea>
				</div>
			)}
		</div>
	);
}
