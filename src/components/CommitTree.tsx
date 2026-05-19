import { Gitgraph, TemplateName, templateExtend } from "@gitgraph/react";

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

const darkTemplate = templateExtend(TemplateName.Metro, {
	colors: ["#818cf8", "#f472b6", "#fb923c", "#34d399", "#60a5fa", "#a78bfa"],
	branch: {
		lineWidth: 2,
		spacing: 20,
		label: {
			display: true,
			bgColor: "#1e1b4b",
			color: "#c7d2fe",
			strokeColor: "#3730a3",
			font: "normal 10px 'JetBrains Mono', monospace",
			borderRadius: 3,
		},
	},
	commit: {
		spacing: 40,
		dot: { size: 5 },
		message: {
			displayAuthor: false,
			displayHash: true,
			color: "#d1d5db",
			font: "normal 11px 'JetBrains Mono', monospace",
		},
	},
});

interface Props {
	commits: CommitInfo[];
}

export function CommitTree({ commits }: Props) {
	if (commits.length === 0) {
		return (
			<div className="flex items-center justify-center h-full text-muted-foreground text-sm italic">
				コミットがありません
			</div>
		);
	}

	return (
		<div className="overflow-auto flex-1 p-2">
			<Gitgraph options={{ template: darkTemplate }}>
				{(gitgraph) => {
					gitgraph.import(commits);
				}}
			</Gitgraph>
		</div>
	);
}
