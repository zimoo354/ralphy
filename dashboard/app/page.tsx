import { DashboardMain } from "./components/DashboardMain";
import { NewTaskModal } from "./components/NewTaskModal";

export default function Home() {
	return (
		<div className="flex h-screen flex-col bg-background">
			<header className="flex shrink-0 justify-end border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
				<NewTaskModal />
			</header>
			<DashboardMain />
		</div>
	);
}
