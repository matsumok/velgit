import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";

export interface CommitAuthor {
	name: string;
	email: string;
}

export interface CommitInfo {
	hash: string;
	short_sha: string;
	subject: string;
	author: CommitAuthor;
	timestamp: number;
	parents: string[];
	refs: string[];
}

interface GraphRow {
	commit: CommitInfo;
	lane: number;
	activeBefore: number[];
	activeAfter: number[];
}

const LANE_COLORS = [
	"#7aa2f7",
	"#9ece6a",
	"#e0af68",
	"#f7768e",
	"#bb9af7",
	"#7dcfff",
];

function getLaneColor(lane: number): string {
	return LANE_COLORS[lane % LANE_COLORS.length];
}

function computeGraph(commits: CommitInfo[]): GraphRow[] {
	const rows: GraphRow[] = [];
	let activeLanes: (string | null)[] = [];

	for (const commit of commits) {
		const activeBefore = activeLanes
			.map((h, i) => (h !== null ? i : -1))
			.filter((i) => i >= 0);

		let lane = activeLanes.indexOf(commit.hash);
		if (lane === -1) {
			const freeSlot = activeLanes.indexOf(null);
			if (freeSlot !== -1) {
				lane = freeSlot;
				activeLanes[lane] = commit.hash;
			} else {
				lane = activeLanes.length;
				activeLanes.push(commit.hash);
			}
		}

		activeLanes[lane] = commit.parents[0] ?? null;

		for (let i = 1; i < commit.parents.length; i++) {
			const parentHash = commit.parents[i];
			if (!activeLanes.includes(parentHash)) {
				const freeSlot = activeLanes.indexOf(null);
				if (freeSlot !== -1) {
					activeLanes[freeSlot] = parentHash;
				} else {
					activeLanes.push(parentHash);
				}
			}
		}

		while (
			activeLanes.length > 0 &&
			activeLanes[activeLanes.length - 1] === null
		) {
			activeLanes.pop();
		}

		const activeAfter = activeLanes
			.map((h, i) => (h !== null ? i : -1))
			.filter((i) => i >= 0);

		rows.push({ commit, lane, activeBefore, activeAfter });
	}

	return rows;
}

function formatRelativeTime(timestamp: number): string {
	const diff = Math.floor(Date.now() / 1000) - timestamp;
	if (diff < 60) return "たった今";
	if (diff < 3600) return `${Math.floor(diff / 60)}分前`;
	if (diff < 86400) return `${Math.floor(diff / 3600)}時間前`;
	if (diff < 86400 * 30) return `${Math.floor(diff / 86400)}日前`;
	if (diff < 86400 * 365) return `${Math.floor(diff / (86400 * 30))}ヶ月前`;
	return `${Math.floor(diff / (86400 * 365))}年前`;
}

const LANE_W = 14;
const ROW_H = 32;

function GraphCell({
	row,
	maxLanes,
}: {
	row: GraphRow;
	maxLanes: number;
}) {
	const width = maxLanes * LANE_W + 4;
	const cx = row.lane * LANE_W + LANE_W / 2;
	const cy = ROW_H / 2;

	return (
		<svg width={width} height={ROW_H} className="shrink-0">
			{row.activeBefore.map((i) => (
				<line
					key={`t${i}`}
					x1={i * LANE_W + LANE_W / 2}
					y1={0}
					x2={i * LANE_W + LANE_W / 2}
					y2={cy - 5}
					stroke={getLaneColor(i)}
					strokeWidth={1.5}
				/>
			))}
			{row.activeAfter.map((i) => (
				<line
					key={`b${i}`}
					x1={i * LANE_W + LANE_W / 2}
					y1={cy + 5}
					x2={i * LANE_W + LANE_W / 2}
					y2={ROW_H}
					stroke={getLaneColor(i)}
					strokeWidth={1.5}
				/>
			))}
			<circle cx={cx} cy={cy} r={4} fill={getLaneColor(row.lane)} />
		</svg>
	);
}

interface CommitTreeProps {
	commits: CommitInfo[];
	selectedHash: string | null;
	onSelect: (hash: string) => void;
}

export function CommitTree({
	commits,
	selectedHash,
	onSelect,
}: CommitTreeProps) {
	const rows = useMemo(() => computeGraph(commits), [commits]);
	const maxLanes = useMemo(() => {
		let max = 1;
		for (const row of rows) {
			max = Math.max(max, row.lane + 1);
			for (const i of row.activeBefore) max = Math.max(max, i + 1);
			for (const i of row.activeAfter) max = Math.max(max, i + 1);
		}
		return max;
	}, [rows]);

	if (commits.length === 0) {
		return (
			<div className="flex items-center justify-center h-full text-muted-foreground text-sm">
				コミットなし
			</div>
		);
	}

	return (
		<TooltipProvider delay={400}>
			<ScrollArea className="h-full">
				<div className="py-1">
					{rows.map((row) => (
						<Tooltip key={row.commit.hash}>
							<TooltipTrigger
								className={cn(
									"w-full flex items-center gap-1.5 px-2 cursor-pointer hover:bg-accent transition-colors",
									selectedHash === row.commit.hash && "bg-accent",
								)}
								style={{ height: ROW_H }}
								onClick={() => onSelect(row.commit.hash)}
							>
								<GraphCell row={row} maxLanes={maxLanes} />
								<div className="flex items-center gap-1 min-w-0 flex-1 overflow-hidden">
									{row.commit.refs.map((ref) => (
										<Badge
											key={ref}
											variant="secondary"
											className="text-[10px] px-1 h-4 shrink-0 max-w-24 truncate"
										>
											{ref}
										</Badge>
									))}
									<span className="text-xs text-muted-foreground shrink-0 ml-auto pl-1">
										{formatRelativeTime(row.commit.timestamp)}
									</span>
								</div>
							</TooltipTrigger>
							<TooltipContent side="right" className="max-w-72">
								<p className="font-medium">{row.commit.subject}</p>
								<p className="opacity-60 mt-0.5">
									{row.commit.author.name} · {row.commit.short_sha}
								</p>
							</TooltipContent>
						</Tooltip>
					))}
				</div>
			</ScrollArea>
		</TooltipProvider>
	);
}
