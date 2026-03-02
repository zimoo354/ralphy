"use client";

import { useState } from "react";
import { DashboardMain } from "./components/DashboardMain";
import { NewTaskModal } from "./components/NewTaskModal";

export default function Home() {
	const [refreshTrigger, setRefreshTrigger] = useState(0);
	const onRefresh = () => setRefreshTrigger((n) => n + 1);

	return (
		<div className="flex h-screen flex-col bg-background">
			<header className="flex shrink-0 justify-end border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
				<NewTaskModal onRunCreated={onRefresh} />
			</header>
			<DashboardMain
				refreshTrigger={refreshTrigger}
				onRunStopped={onRefresh}
				onRunDeleted={onRefresh}
			/>
		</div>
	);
}
