"use client";

import { useCallback, useEffect, useState } from "react";

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
}

export function RunDetails({ runId }: RunDetailsProps) {
	const [details, setDetails] = useState<RunDetailsData | null>(null);
	const [loading, setLoading] = useState(false);

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
		<div className="flex flex-1 flex-col overflow-auto p-3">
			<div className="mb-3 space-y-1 text-xs text-zinc-500 dark:text-zinc-400">
				<p>
					<strong>Repo:</strong> {details.repoPath}
				</p>
				<p>
					<strong>Status:</strong> {details.status}
				</p>
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
			{details.log !== undefined && (
				<pre className="min-h-0 flex-1 whitespace-pre-wrap rounded bg-zinc-100 p-3 font-mono text-sm text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
					{details.log || "(no output yet)"}
				</pre>
			)}
		</div>
	);
}
