"use client";

import { useCallback, useEffect, useState } from "react";
import {
	buildCommandPreview,
	type NewTaskFormState,
} from "@/lib/command-preview";

const defaultState: NewTaskFormState = {
	repoPath: "",
	mode: "single",
	task: "",
	engine: "cursor",
	runTests: true,
	runLint: true,
	fast: false,
	parallel: false,
	maxParallel: 3,
	sandbox: false,
	createPr: false,
};

interface RepoRecord {
	path: string;
	addedAt: string;
}

export function NewTaskModal() {
	const [open, setOpen] = useState(false);
	const [repos, setRepos] = useState<RepoRecord[]>([]);
	const [state, setState] = useState<NewTaskFormState>(defaultState);

	const loadRepos = useCallback(async () => {
		const res = await fetch("/api/repos");
		if (res.ok) {
			const data = await res.json();
			setRepos(Array.isArray(data) ? data : []);
		}
	}, []);

	useEffect(() => {
		if (open) loadRepos();
	}, [open, loadRepos]);

	useEffect(() => {
		if (!open) return;
		const onKeyDown = (e: KeyboardEvent) => {
			if (e.key === "Escape") close();
		};
		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, [open, close]);

	const update = useCallback((patch: Partial<NewTaskFormState>) => {
		setState((s) => ({ ...s, ...patch }));
	}, []);

	const close = useCallback(() => {
		setOpen(false);
		setState(defaultState);
	}, []);

	const handleBackdropClick = (e: React.MouseEvent) => {
		if (e.target === e.currentTarget) close();
	};

	const preview = buildCommandPreview(state);
	const canRun =
		state.repoPath.trim().length > 0 &&
		(state.mode === "prd" || state.task.trim().length > 0);

	return (
		<>
			<button
				type="button"
				onClick={() => setOpen(true)}
				className="rounded border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
			>
				New Task +
			</button>

			{open && (
				<div
					className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
					onClick={handleBackdropClick}
					role="dialog"
					aria-modal="true"
					aria-labelledby="new-task-title"
				>
					<div
						className="max-h-[90vh] w-full max-w-2xl overflow-auto rounded-lg border border-zinc-200 bg-white shadow-xl dark:border-zinc-700 dark:bg-zinc-900"
						onClick={(e) => e.stopPropagation()}
					>
						<div className="border-b border-zinc-200 px-4 py-3 dark:border-zinc-700">
							<h2
								id="new-task-title"
								className="text-lg font-semibold text-zinc-900 dark:text-zinc-100"
							>
								New Task
							</h2>
						</div>

						<form
							className="space-y-4 p-4"
							onSubmit={(e) => {
								e.preventDefault();
								if (canRun) {
									// TODO: wire to run creation
									close();
								}
							}}
						>
							{/* Repo path */}
							<div>
								<label
									htmlFor="repo-path"
									className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
								>
									Repo path
								</label>
								<input
									id="repo-path"
									type="text"
									list="repo-list"
									value={state.repoPath}
									onChange={(e) => update({ repoPath: e.target.value })}
									placeholder="/path/to/repo"
									className="w-full rounded border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder-zinc-500"
								/>
								<datalist id="repo-list">
									{repos.map((r) => (
										<option key={r.path} value={r.path} />
									))}
								</datalist>
							</div>

							{/* Mode */}
							<div>
								<span className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
									Mode
								</span>
								<div className="flex gap-4">
									<label className="flex cursor-pointer items-center gap-2">
										<input
											type="radio"
											name="mode"
											checked={state.mode === "single"}
											onChange={() => update({ mode: "single" })}
											className="border-zinc-300 text-zinc-900 focus:ring-zinc-500"
										/>
										<span className="text-sm text-zinc-700 dark:text-zinc-300">
											Single Task
										</span>
									</label>
									<label className="flex cursor-pointer items-center gap-2">
										<input
											type="radio"
											name="mode"
											checked={state.mode === "prd"}
											onChange={() => update({ mode: "prd" })}
											className="border-zinc-300 text-zinc-900 focus:ring-zinc-500"
										/>
										<span className="text-sm text-zinc-700 dark:text-zinc-300">
											PRD Markdown
										</span>
									</label>
								</div>
							</div>

							{/* Task / PRD content */}
							<div>
								<label
									htmlFor="task"
									className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
								>
									{state.mode === "single" ? "Task" : "PRD Markdown"}
								</label>
								<textarea
									id="task"
									rows={state.mode === "prd" ? 10 : 3}
									value={state.task}
									onChange={(e) => update({ task: e.target.value })}
									placeholder={
										state.mode === "single"
											? "Describe the task..."
											: "Paste or write PRD markdown..."
									}
									className="w-full rounded border border-zinc-300 bg-white px-3 py-2 font-mono text-sm text-zinc-900 placeholder-zinc-400 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder-zinc-500"
								/>
							</div>

							{/* Options */}
							<div className="space-y-3 rounded border border-zinc-200 bg-zinc-50/50 px-3 py-3 dark:border-zinc-700 dark:bg-zinc-800/50">
								<span className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
									Options
								</span>
								<div className="flex flex-wrap gap-x-6 gap-y-2">
									<div className="flex gap-2">
										<label className="flex cursor-pointer items-center gap-1.5 text-sm text-zinc-700 dark:text-zinc-300">
											<input
												type="radio"
												name="engine"
												checked={state.engine === "cursor"}
												onChange={() => update({ engine: "cursor" })}
												className="border-zinc-300 text-zinc-900 focus:ring-zinc-500"
											/>
											Cursor
										</label>
										<label className="flex cursor-pointer items-center gap-1.5 text-sm text-zinc-700 dark:text-zinc-300">
											<input
												type="radio"
												name="engine"
												checked={state.engine === "claude"}
												onChange={() => update({ engine: "claude" })}
												className="border-zinc-300 text-zinc-900 focus:ring-zinc-500"
											/>
											Claude
										</label>
									</div>
									<label className="flex cursor-pointer items-center gap-1.5 text-sm text-zinc-700 dark:text-zinc-300">
										<input
											type="checkbox"
											checked={state.runTests}
											onChange={(e) =>
												update({ runTests: e.target.checked, fast: false })
											}
											disabled={state.fast}
											className="rounded border-zinc-300 text-zinc-900 focus:ring-zinc-500"
										/>
										Run tests
									</label>
									<label className="flex cursor-pointer items-center gap-1.5 text-sm text-zinc-700 dark:text-zinc-300">
										<input
											type="checkbox"
											checked={state.runLint}
											onChange={(e) =>
												update({ runLint: e.target.checked, fast: false })
											}
											disabled={state.fast}
											className="rounded border-zinc-300 text-zinc-900 focus:ring-zinc-500"
										/>
										Run lint
									</label>
									<label className="flex cursor-pointer items-center gap-1.5 text-sm text-zinc-700 dark:text-zinc-300">
										<input
											type="checkbox"
											checked={state.fast}
											onChange={(e) =>
												update({
													fast: e.target.checked,
													runTests: !e.target.checked,
													runLint: !e.target.checked,
												})
											}
											className="rounded border-zinc-300 text-zinc-900 focus:ring-zinc-500"
										/>
										Fast
									</label>
									<label className="flex cursor-pointer items-center gap-1.5 text-sm text-zinc-700 dark:text-zinc-300">
										<input
											type="checkbox"
											checked={state.parallel}
											onChange={(e) => update({ parallel: e.target.checked })}
											className="rounded border-zinc-300 text-zinc-900 focus:ring-zinc-500"
										/>
										Parallel
									</label>
									{state.parallel && (
										<div className="flex items-center gap-1.5">
											<label
												htmlFor="max-parallel"
												className="text-sm text-zinc-700 dark:text-zinc-300"
											>
												Max
											</label>
											<input
												id="max-parallel"
												type="number"
												min={1}
												max={10}
												value={state.maxParallel}
												onChange={(e) =>
													update({
														maxParallel: Math.max(
															1,
															Math.min(10, Number(e.target.value) || 1),
														),
													})
												}
												className="w-14 rounded border border-zinc-300 bg-white px-2 py-1 text-sm dark:border-zinc-600 dark:bg-zinc-800"
											/>
										</div>
									)}
									<label className="flex cursor-pointer items-center gap-1.5 text-sm text-zinc-700 dark:text-zinc-300">
										<input
											type="checkbox"
											checked={state.sandbox}
											onChange={(e) => update({ sandbox: e.target.checked })}
											className="rounded border-zinc-300 text-zinc-900 focus:ring-zinc-500"
										/>
										Sandbox
									</label>
									<label className="flex cursor-pointer items-center gap-1.5 text-sm text-zinc-700 dark:text-zinc-300">
										<input
											type="checkbox"
											checked={state.createPr}
											onChange={(e) => update({ createPr: e.target.checked })}
											className="rounded border-zinc-300 text-zinc-900 focus:ring-zinc-500"
										/>
										Create PR
									</label>
								</div>
							</div>

							{/* Command preview */}
							<div>
								<label
									htmlFor="command-preview"
									className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
								>
									Command preview
								</label>
								<pre
									id="command-preview"
									className="rounded border border-zinc-200 bg-zinc-100 px-3 py-2 font-mono text-xs text-zinc-800 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
								>
									{preview || "ralphy (set repo and task)"}
								</pre>
							</div>

							<div className="flex justify-end gap-2 border-t border-zinc-200 pt-4 dark:border-zinc-700">
								<button
									type="button"
									onClick={close}
									className="rounded border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
								>
									Cancel
								</button>
								<button
									type="submit"
									disabled={!canRun}
									className="rounded border border-zinc-800 bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-600 dark:hover:bg-zinc-500"
								>
									Run
								</button>
							</div>
						</form>
					</div>
				</div>
			)}
		</>
	);
}
