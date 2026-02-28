import { spawn, type ChildProcess } from "node:child_process";
import {
	readRuns,
	writeRuns,
	appendRunLog,
	ensureRunDir,
	type RunStatus,
} from "@/lib/storage";

export interface StartRunOptions {
	cwd: string;
	argv: string[];
}

const processes = new Map<string, ChildProcess>();

function updateRunStatus(
	runId: string,
	updates: {
		status: RunStatus;
		startedAt?: string;
		endedAt?: string;
		exitCode?: number;
		command?: string;
	},
): void {
	const runs = readRuns();
	const idx = runs.findIndex((r) => r.id === runId);
	if (idx === -1) return;
	runs[idx] = { ...runs[idx], ...updates };
	writeRuns(runs);
}

/**
 * Start a run: spawn ralphy, capture stdout/stderr to per-run log, update status.
 * Run must exist with status "queued". Caller must have written prdFile if needed.
 */
export function startRun(runId: string, options: StartRunOptions): void {
	const { cwd, argv } = options;
	const runs = readRuns();
	const run = runs.find((r) => r.id === runId);
	if (!run || run.status !== "queued") {
		throw new Error(`Run ${runId} not found or not queued`);
	}

	const [command, ...args] = argv;
	const now = new Date().toISOString();
	updateRunStatus(runId, {
		status: "running",
		startedAt: now,
		command: argv.join(" "),
	});

	ensureRunDir(runId);
	const proc = spawn(command, args, {
		cwd,
		env: process.env,
		stdio: ["ignore", "pipe", "pipe"],
		shell: process.platform === "win32",
	});

	processes.set(runId, proc);

	const append = (stream: "stdout" | "stderr", data: Buffer | string): void => {
		const text = typeof data === "string" ? data : data.toString();
		appendRunLog(runId, text);
	};

	proc.stdout?.on("data", (chunk) => append("stdout", chunk));
	proc.stderr?.on("data", (chunk) => append("stderr", chunk));

	proc.on("close", (code, signal) => {
		processes.delete(runId);
		const status: RunStatus =
			signal != null ? "stopped" : code === 0 ? "succeeded" : "failed";
		updateRunStatus(runId, {
			status,
			endedAt: new Date().toISOString(),
			exitCode: code ?? undefined,
		});
	});

	proc.on("error", (err) => {
		processes.delete(runId);
		appendRunLog(runId, `\nSpawn error: ${err.message}\n`);
		updateRunStatus(runId, {
			status: "failed",
			endedAt: new Date().toISOString(),
			exitCode: 1,
		});
	});
}

/**
 * Stop a running run. Returns true if the run was running and was stopped.
 */
export function stopRun(runId: string): boolean {
	const proc = processes.get(runId);
	if (!proc || proc.killed) return false;
	proc.kill("SIGTERM");
	processes.delete(runId);
	updateRunStatus(runId, {
		status: "stopped",
		endedAt: new Date().toISOString(),
	});
	return true;
}

/**
 * Return whether the run is currently running (has an active process).
 */
export function isRunActive(runId: string): boolean {
	const proc = processes.get(runId);
	return proc != null && !proc.killed;
}
