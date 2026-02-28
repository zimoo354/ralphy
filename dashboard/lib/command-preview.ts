/**
 * Build a read-only ralphy command preview from New Task form state.
 * Used for display only; actual execution will use the Command Builder.
 */
export interface NewTaskFormState {
	repoPath: string;
	mode: "single" | "prd";
	task: string;
	engine: "cursor" | "claude";
	runTests: boolean;
	runLint: boolean;
	fast: boolean;
	parallel: boolean;
	maxParallel: number;
	sandbox: boolean;
	createPr: boolean;
}

export function buildCommandPreview(state: NewTaskFormState): string {
	const argv: string[] = ["ralphy"];

	if (state.mode === "single" && state.task.trim()) {
		argv.push(quoteArg(state.task.trim()));
	}

	if (state.engine === "claude") {
		argv.push("--claude");
	} else {
		argv.push("--cursor");
	}

	if (state.fast) {
		argv.push("--fast");
	} else {
		if (!state.runTests) argv.push("--no-tests");
		if (!state.runLint) argv.push("--no-lint");
	}

	if (state.parallel) {
		argv.push("--parallel");
		if (state.maxParallel !== 3) {
			argv.push(`--max-parallel`, String(state.maxParallel));
		}
	}
	if (state.sandbox) argv.push("--sandbox");
	if (state.createPr) argv.push("--create-pr");

	if (state.mode === "prd" && state.task.trim()) {
		argv.push("--prd", "tasks.md");
	}

	return argv.join(" ");
}

function quoteArg(s: string): string {
	if (/^[\w-/]+$/.test(s)) return s;
	return `"${s.replace(/"/g, '\\"')}"`;
}
