"use client";

import { useCallback, useEffect, useState } from "react";
import { LogsViewer } from "./LogsViewer";

interface RunDetailsData {
	id: string;
	repoPath: string;
	status: string;
	createdAt: string;
	startedAt?: string;
	endedAt?: string;
	exitCode?: number;
	log?: string;
}

interface RunDetailsProps {
	runId: string | null;
	onRunStopped?: () => void;
}

export function RunDetails({ runId, onRunStopped }: RunDetailsProps) {
	const [details, setDetails] = useState<RunDetailsData | null>(null);
	const [loading, setLoading] = useState(false);
	const [stopping, setStopping] = useState(false);

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

	return (
		<div className="flex flex-1 min-h-0 flex-col overflow-hidden p-3">
			<div className="mb-3 flex shrink-0 items-start justify-between gap-2">
				<div className="min-w-0 space-y-1 text-xs text-zinc-500 dark:text-zinc-400">
					<p>
						<strong>Repo:</strong> {details.repoPath}
					</p>
					<p>
						<strong>Status:</strong> {details.status}
					</p>
				</div>
				{details.status === "running" && (
					<button
						type="button"
						onClick={handleStop}
						disabled={stopping}
						className="shrink-0 rounded bg-red-600 px-2 py-1 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50 dark:bg-red-700 dark:hover:bg-red-800"
					>
						{stopping ? "Stopping…" : "Stop"}
					</button>
				)}
			</div>
			<div className="mb-3 shrink-0 space-y-1 text-xs text-zinc-500 dark:text-zinc-400">
				<p>
					<strong>Created:</strong>{" "}
					{new Date(details.createdAt).toLocaleString()}
				</p>
				{details.startedAt && (
					<p>
						<strong>Started:</strong>{" "}
						{new Date(details.startedAt).toLocaleString()}
					</p>
				)}
				{details.endedAt && (
					<p>
						<strong>Ended:</strong>{" "}
						{new Date(details.endedAt).toLocaleString()}
					</p>
				)}
				{details.exitCode !== undefined && (
					<p>
						<strong>Exit code:</strong> {details.exitCode}
					</p>
				)}
			</div>
			<LogsViewer
				content={details.log ?? ""}
				className="rounded border border-zinc-200 dark:border-zinc-800"
			/>
		</div>
	);
}
