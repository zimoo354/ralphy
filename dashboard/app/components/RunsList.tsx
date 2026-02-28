"use client";

import { useCallback, useEffect, useState } from "react";

type RunStatus =
	| "queued"
	| "running"
	| "succeeded"
	| "failed"
	| "stopped";

interface RunRecord {
	id: string;
	repoPath: string;
	status: RunStatus;
	createdAt: string;
	startedAt?: string;
	endedAt?: string;
	exitCode?: number;
	command?: string;
}

function groupByRepo(runs: RunRecord[]): Map<string, RunRecord[]> {
	const map = new Map<string, RunRecord[]>();
	for (const run of runs) {
		const list = map.get(run.repoPath) ?? [];
		list.push(run);
		map.set(run.repoPath, list);
	}
	for (const list of map.values()) {
		list.sort(
			(a, b) =>
				new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
		);
	}
	return map;
}

function formatTime(iso: string): string {
	const d = new Date(iso);
	const now = new Date();
	const sameDay =
		d.getDate() === now.getDate() &&
		d.getMonth() === now.getMonth() &&
		d.getFullYear() === now.getFullYear();
	if (sameDay) {
		return d.toLocaleTimeString(undefined, {
			hour: "2-digit",
			minute: "2-digit",
		});
	}
	return d.toLocaleDateString(undefined, {
		month: "short",
		day: "numeric",
		hour: "2-digit",
		minute: "2-digit",
	});
}

function statusLabel(status: RunStatus): string {
	return status.charAt(0).toUpperCase() + status.slice(1);
}

function repoShortPath(path: string): string {
	const parts = path.split(/[/\\]/).filter(Boolean);
	return parts.length > 0 ? parts[parts.length - 1] : path;
}

const statusClass: Record<RunStatus, string> = {
	queued: "bg-zinc-200 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-300",
	running:
		"bg-blue-200 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300",
	succeeded:
		"bg-emerald-200 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300",
	failed: "bg-red-200 text-red-800 dark:bg-red-900/50 dark:text-red-300",
	stopped:
		"bg-amber-200 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300",
};

interface RunsListProps {
	selectedRunId: string | null;
	onSelectRun: (id: string | null) => void;
	refreshTrigger?: number;
}

export function RunsList({
	selectedRunId,
	onSelectRun,
	refreshTrigger = 0,
}: RunsListProps) {
	const [runs, setRuns] = useState<RunRecord[]>([]);
	const [loading, setLoading] = useState(true);

	const loadRuns = useCallback(async () => {
		setLoading(true);
		try {
			const res = await fetch("/api/runs");
			if (res.ok) {
				const data = await res.json();
				setRuns(Array.isArray(data) ? data : []);
			}
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		loadRuns();
	}, [loadRuns, refreshTrigger]);

	const grouped = groupByRepo(runs);

	return (
		<div className="flex-1 overflow-auto p-3 font-mono text-sm text-zinc-700 dark:text-zinc-300">
			{loading ? (
				<p className="text-zinc-500 dark:text-zinc-400">Loading…</p>
			) : grouped.size === 0 ? (
				<p className="text-zinc-500 dark:text-zinc-400">No runs yet</p>
			) : (
				<div className="space-y-4">
					{Array.from(grouped.entries()).map(([repoPath, repoRuns]) => (
						<div key={repoPath} className="space-y-1.5">
							<p
								className="truncate text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400"
								title={repoPath}
							>
								{repoShortPath(repoPath)}
							</p>
							<ul className="space-y-1">
								{repoRuns.map((run) => (
									<li key={run.id}>
										<button
											type="button"
											onClick={() =>
												onSelectRun(selectedRunId === run.id ? null : run.id)
											}
											className={`flex w-full items-center justify-between gap-2 rounded px-2 py-1.5 text-left transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800 ${
												selectedRunId === run.id
													? "bg-zinc-100 dark:bg-zinc-800"
													: ""
											}`}
										>
											<span className="min-w-0 truncate" title={run.id}>
												{formatTime(run.createdAt)}
											</span>
											<span
												className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${statusClass[run.status]}`}
											>
												{statusLabel(run.status)}
											</span>
										</button>
									</li>
								))}
							</ul>
						</div>
					))}
				</div>
			)}
		</div>
	);
}
