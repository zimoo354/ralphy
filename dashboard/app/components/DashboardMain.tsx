"use client";

import { useCallback, useState } from "react";
import { RunDetails } from "./RunDetails";
import { RunsList } from "./RunsList";

export function DashboardMain() {
	const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
	const [refreshTrigger, setRefreshTrigger] = useState(0);
	const onRunStopped = useCallback(() => setRefreshTrigger((n) => n + 1), []);

	return (
		<main className="flex min-h-0 flex-1">
			<section className="flex w-1/3 flex-col border-r border-zinc-200 dark:border-zinc-800">
				<h2 className="border-b border-zinc-200 py-2 text-center text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
					Runs
				</h2>
				<RunsList
					selectedRunId={selectedRunId}
					onSelectRun={setSelectedRunId}
					refreshTrigger={refreshTrigger}
				/>
			</section>
			<section className="flex flex-1 flex-col">
				<h2 className="border-b border-zinc-200 py-2 text-center text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
					Logs
				</h2>
				<RunDetails runId={selectedRunId} onRunStopped={onRunStopped} />
			</section>
		</main>
	);
}
