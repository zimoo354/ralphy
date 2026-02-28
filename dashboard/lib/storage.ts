import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { isAbsolute, join, resolve, sep } from "node:path";

const RALPHY_UI_DIR = ".ralphy-ui";
const RUNS_FILE = "runs.json";
const REPOS_FILE = "repos.json";
const RUNS_SUBDIR = "runs";

export type RunStatus =
	| "queued"
	| "running"
	| "succeeded"
	| "failed"
	| "stopped";

export interface RunRecord {
	id: string;
	repoPath: string;
	status: RunStatus;
	createdAt: string;
	startedAt?: string;
	endedAt?: string;
	exitCode?: number;
	command?: string;
}

export interface RepoRecord {
	path: string;
	addedAt: string;
}

/**
 * Resolve the ralphy-ui persistence directory (e.g. ~/.ralphy-ui).
 */
export function getStorageDir(): string {
	return join(homedir(), RALPHY_UI_DIR);
}

/**
 * Ensure the storage directory and optional subpaths exist.
 */
export function ensureStorageDir(...subpaths: string[]): string {
	const base = getStorageDir();
	const full = subpaths.length ? join(base, ...subpaths) : base;
	if (!existsSync(full)) {
		mkdirSync(full, { recursive: true });
	}
	return full;
}

/**
 * Get path to runs.json.
 */
export function getRunsPath(): string {
	return join(getStorageDir(), RUNS_FILE);
}

/**
 * Get path to repos.json.
 */
export function getReposPath(): string {
	return join(getStorageDir(), REPOS_FILE);
}

/**
 * Read runs index. Returns empty array if file missing or invalid.
 */
export function readRuns(): RunRecord[] {
	const path = getRunsPath();
	if (!existsSync(path)) return [];
	try {
		const raw = readFileSync(path, "utf-8");
		const data = JSON.parse(raw);
		return Array.isArray(data) ? data : [];
	} catch {
		return [];
	}
}

/**
 * Write runs index.
 */
export function writeRuns(runs: RunRecord[]): void {
	ensureStorageDir();
	writeFileSync(getRunsPath(), JSON.stringify(runs, null, 2), "utf-8");
}

/**
 * Read known repos. Returns empty array if file missing or invalid.
 */
export function readRepos(): RepoRecord[] {
	const path = getReposPath();
	if (!existsSync(path)) return [];
	try {
		const raw = readFileSync(path, "utf-8");
		const data = JSON.parse(raw);
		return Array.isArray(data) ? data : [];
	} catch {
		return [];
	}
}

/**
 * Write known repos.
 */
export function writeRepos(repos: RepoRecord[]): void {
	ensureStorageDir();
	writeFileSync(getReposPath(), JSON.stringify(repos, null, 2), "utf-8");
}

/**
 * Validate repo path: must be absolute and under the user's home directory.
 * Returns normalized path if valid, or an error message.
 */
export function validateRepoPath(
	input: string,
): { ok: true; path: string } | { ok: false; error: string } {
	const trimmed = input.trim();
	if (!trimmed) {
		return { ok: false, error: "Repo path is required" };
	}
	const normalized = resolve(trimmed);
	if (!isAbsolute(normalized)) {
		return { ok: false, error: "Repo path must be absolute" };
	}
	const home = homedir();
	const homePrefix = home.endsWith(sep) ? home : home + sep;
	if (normalized !== home && !normalized.startsWith(homePrefix)) {
		return { ok: false, error: "Repo path must be under your home directory" };
	}
	return { ok: true, path: normalized };
}

/**
 * Get the per-run directory path for a run id. Does not create it.
 */
export function getRunDir(runId: string): string {
	return join(getStorageDir(), RUNS_SUBDIR, runId);
}

/**
 * Ensure the per-run directory exists and return its path.
 */
export function ensureRunDir(runId: string): string {
	return ensureStorageDir(RUNS_SUBDIR, runId);
}

const RUN_LOG_FILE = "log.txt";
const RUN_ARGS_FILE = "args.json";
const RUN_TASKS_FILE = "tasks.md";

/**
 * Get path to the run's combined log file.
 */
export function getRunLogPath(runId: string): string {
	return join(getRunDir(runId), RUN_LOG_FILE);
}

/**
 * Append content to the run's log file. Creates run dir and file if needed.
 */
export function appendRunLog(runId: string, content: string): void {
	ensureRunDir(runId);
	const path = getRunLogPath(runId);
	const existing = existsSync(path) ? readFileSync(path, "utf-8") : "";
	writeFileSync(path, existing + content, "utf-8");
}

/**
 * Read the run's log file. Returns empty string if missing.
 */
export function readRunLog(runId: string): string {
	const path = getRunLogPath(runId);
	if (!existsSync(path)) return "";
	return readFileSync(path, "utf-8");
}

/**
 * Get path to the run's args file (JSON).
 */
export function getRunArgsPath(runId: string): string {
	return join(getRunDir(runId), RUN_ARGS_FILE);
}

/**
 * Write run args (e.g. argv or structured options) as JSON.
 */
export function writeRunArgs(runId: string, args: unknown): void {
	ensureRunDir(runId);
	writeFileSync(getRunArgsPath(runId), JSON.stringify(args, null, 2), "utf-8");
}

/**
 * Read run args. Returns null if missing or invalid.
 */
export function readRunArgs(runId: string): unknown {
	const path = getRunArgsPath(runId);
	if (!existsSync(path)) return null;
	try {
		return JSON.parse(readFileSync(path, "utf-8"));
	} catch {
		return null;
	}
}

/**
 * Get path to the run's tasks.md (for PRD mode).
 */
export function getRunTasksPath(runId: string): string {
	return join(getRunDir(runId), RUN_TASKS_FILE);
}

/**
 * Write tasks markdown for the run (e.g. PRD content).
 */
export function writeRunTasks(runId: string, markdown: string): void {
	ensureRunDir(runId);
	writeFileSync(getRunTasksPath(runId), markdown, "utf-8");
}

/**
 * Read run tasks markdown. Returns empty string if missing.
 */
export function readRunTasks(runId: string): string {
	const path = getRunTasksPath(runId);
	if (!existsSync(path)) return "";
	return readFileSync(path, "utf-8");
}
