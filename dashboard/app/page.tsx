import { NewTaskModal } from "./components/NewTaskModal";

export default function Home() {
	return (
		<div className="flex h-screen flex-col bg-background">
			<header className="flex shrink-0 justify-end border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
				<NewTaskModal />
			</header>
			<main className="flex min-h-0 flex-1">
				<section className="flex w-1/3 flex-col border-r border-zinc-200 dark:border-zinc-800">
					<h2 className="border-b border-zinc-200 py-2 text-center text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
						Runs
					</h2>
					<div className="flex-1 overflow-auto p-3 font-mono text-sm text-zinc-700 dark:text-zinc-300">
						<div className="space-y-2">
							<p>Path:@/projects/Royal/app</p>
							<p>Run 20260228112015</p>
							<p className="pt-2">Path:@/projects/charlie/x</p>
							<p>Run 20260222181451</p>
						</div>
					</div>
				</section>
				<section className="flex flex-1 flex-col">
					<h2 className="border-b border-zinc-200 py-2 text-center text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
						Logs
					</h2>
					<div className="flex-1 overflow-auto p-3 font-mono text-sm text-zinc-700 dark:text-zinc-300">
						<pre className="whitespace-pre-wrap">
							{`$ ralphy "<TASK>" --cursor
[INFO] Running task with Cursor Agent...
[INFO] Browser automation enabled
(agent-browser)
:. Working [5s] <TASK>`}
						</pre>
					</div>
				</section>
			</main>
		</div>
	);
}
