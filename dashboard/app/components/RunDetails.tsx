"use client";

import { useCallback, useEffect, useState } from "react";
import { LogsViewer } from "./LogsViewer";

interface RunArgs {
	engine?: string;
	runTests?: boolean;
	runLint?: boolean;
	fast?: boolean;
	parallel?: boolean;
	maxParallel?: number;
	sandbox?: boolean;
	createPr?: boolean;
}

interface RunDetailsData {
	id: string;
	repoPath: string;
	status: string;
	createdAt: string;
	startedAt?: string;
	endedAt?: string;
	exitCode?: number;
	log?: string;
	args?: RunArgs;
}

interface RunDetailsProps {
	runId: string | null;
	onRunStopped?: () => void;
	onRunDeleted?: () => void;
}

function formatDuration(startedAt?: string, endedAt?: string): string | null {
	if (!startedAt || !endedAt) return null;
	const start = new Date(startedAt).getTime();
	const end = new Date(endedAt).getTime();
	const ms = Math.max(0, end - start);
	if (ms < 1000) return `${ms}ms`;
	const sec = Math.floor(ms / 1000) % 60;
	const min = Math.floor(ms / 60000) % 60;
	const h = Math.floor(ms / 3600000);
	const parts = [];
	if (h > 0) parts.push(`${h}h`);
	if (min > 0) parts.push(`${min}m`);
	parts.push(`${sec}s`);
	return parts.join(" ");
}

function formatOptions(args?: RunArgs): string {
	if (!args) return "—";
	const opts: string[] = [];
	if (args.runTests !== false) opts.push("tests");
	else opts.push("no-tests");
	if (args.runLint !== false) opts.push("lint");
	else opts.push("no-lint");
	if (args.fast) opts.push("fast");
	if (args.parallel) opts.push(`parallel${args.maxParallel !== 3 ? ` (max ${args.maxParallel})` : ""}`);
	if (args.sandbox) opts.push("sandbox");
	if (args.createPr) opts.push("create-pr");
	return opts.length ? opts.join(", ") : "—";
}

export function RunDetails({
	runId,
	onRunStopped,
	onRunDeleted,
}: RunDetailsProps) {
	const [details, setDetails] = useState<RunDetailsData | null>(null);
	const [loading, setLoading] = useState(false);
	const [stopping, setStopping] = useState(false);
	const [deleting, setDeleting] = useState(false);

	const load = useCallback(async (id: string) => {
		setLoading(true);
		try {
			const res = await fetch(`/api/runs/${id}`);
			if (res.ok) {
				const data = await res.json();
				setDetails(data);
			} else {
				setDetails(null);
			}
		} catch {
			setDetails(null);
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		if (runId) {
			load(runId);
		} else {
			setDetails(null);
		}
	}, [runId, load]);

	const handleStop = useCallback(async () => {
		if (!runId || details?.status !== "running") return;
		setStopping(true);
		try {
			const res = await fetch(`/api/runs/${runId}`, { method: "POST" });
			if (res.ok) {
				onRunStopped?.();
				await load(runId);
			}
		} finally {
			setStopping(false);
		}
	}, [runId, details?.status, load, onRunStopped]);

	const handleDelete = useCallback(async () => {
		if (!runId || !confirm("Delete this run?")) return;
		setDeleting(true);
		try {
			const res = await fetch(`/api/runs/${runId}`, { method: "DELETE" });
			if (res.ok) {
				onRunDeleted?.();
			}
		} finally {
			setDeleting(false);
		}
	}, [runId, onRunDeleted]);

	if (!runId) {
		return (
			<div className="flex flex-1 items-center justify-center p-6 text-zinc-500 dark:text-zinc-400">
				Select a run to view details
			</div>
		);
	}

	if (loading) {
		return (
			<div className="flex flex-1 items-center justify-center p-6 text-zinc-500 dark:text-zinc-400">
				Loading…
			</div>
		);
	}

	if (!details) {
		return (
			<div className="flex flex-1 items-center justify-center p-6 text-zinc-500 dark:text-zinc-400">
				Run not found
			</div>
		);
	}

	const duration = formatDuration(details.startedAt, details.endedAt);
	const isTerminalFailure =
		(details.status === "failed" || details.status === "stopped") &&
		(details.log?.trim().length ?? 0) > 0;
	const lastErrorLines = isTerminalFailure
		? details.log!.trim().split("\n").slice(-15).join("\n")
		: "";

	return (
		<div className="flex flex-1 min-h-0 flex-col overflow-hidden p-3">
			{isTerminalFailure && (
				<div
					className="mb-3 shrink-0 rounded border border-red-200 bg-red-50 px-3 py-2 dark:border-red-800 dark:bg-red-950/50"
					role="alert"
				>
					<p className="mb-1.5 text-xs font-semibold text-red-800 dark:text-red-200">
						Last lines from run
					</p>
					<pre className="max-h-32 overflow-auto whitespace-pre-wrap break-words font-mono text-xs text-red-700 dark:text-red-300">
						{lastErrorLines}
					</pre>
				</div>
			)}
			<div className="mb-3 flex shrink-0 items-start justify-between gap-2">
				<span className="text-xs font-medium text-zinc-600 dark:text-zinc-300">
					{details.status}
				</span>
				<div className="flex shrink-0 gap-2">
					{details.status === "running" && (
						<button
							type="button"
							onClick={handleStop}
							disabled={stopping}
							className="rounded bg-red-600 px-2 py-1 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50 dark:bg-red-700 dark:hover:bg-red-800"
						>
							{stopping ? "Stopping…" : "Stop"}
						</button>
					)}
					<button
						type="button"
						onClick={handleDelete}
						disabled={deleting}
						className="rounded border border-zinc-300 px-2 py-1 text-xs font-medium text-zinc-600 hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-600 dark:text-zinc-400 dark:hover:bg-zinc-800"
					>
						{deleting ? "Deleting…" : "Delete"}
					</button>
				</div>
			</div>
			<div className="mb-3 shrink-0 rounded border border-zinc-200 bg-zinc-50/50 px-3 py-2 text-xs text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900/50 dark:text-zinc-400">
				<div className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-1">
					<span className="font-medium">Repo</span>
					<span className="truncate font-mono" title={details.repoPath}>
						{details.repoPath}
					</span>
					<span className="font-medium">Engine</span>
					<span>{details.args?.engine ?? "—"}</span>
					<span className="font-medium">Options</span>
					<span className="min-w-0 break-words">{formatOptions(details.args)}</span>
					<span className="font-medium">Duration</span>
					<span>{duration ?? "—"}</span>
					<span className="font-medium">Exit code</span>
					<span>{details.exitCode !== undefined ? details.exitCode : "—"}</span>
				</div>
			</div>
			<LogsViewer
				content={details.log ?? ""}
				className="rounded border border-zinc-200 dark:border-zinc-800"
			/>
		</div>
	);
}
