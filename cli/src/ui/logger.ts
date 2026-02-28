import pc from "picocolors";

let verboseMode = false;

/**
 * Set verbose mode
 */
export function setVerbose(verbose: boolean): void {
	verboseMode = verbose;
}

/**
 * Log info message
 */
export function logInfo(...args: unknown[]): void {
	console.log(pc.blue("[INFO]"), ...args);
}

/**
 * Log success message
 */
export function logSuccess(...args: unknown[]): void {
	console.log(pc.green("[OK]"), ...args);
}

/**
 * Log warning message
 */
export function logWarn(...args: unknown[]): void {
	console.log(pc.yellow("[WARN]"), ...args);
}

/**
 * Log error message
 */
export function logError(...args: unknown[]): void {
	console.error(pc.red("[ERROR]"), ...args);
}

/**
 * Log debug message (only in verbose mode)
 */
export function logDebug(...args: unknown[]): void {
	if (verboseMode) {
		console.log(pc.dim("[DEBUG]"), ...args);
	}
}

/**
 * Format a task name for display (truncate if too long)
 */
export function formatTask(task: string, maxLen = 40): string {
	if (task.length <= maxLen) return task;
	return `${task.slice(0, maxLen - 3)}...`;
}

/**
 * Format duration in human readable format
 */
export function formatDuration(ms: number): string {
	if (ms < 1000) return `${ms}ms`;
	const secs = Math.floor(ms / 1000);
	const mins = Math.floor(secs / 60);
	const remainingSecs = secs % 60;
	if (mins === 0) return `${secs}s`;
	return `${mins}m ${remainingSecs}s`;
}

type FileOp = "read" | "write" | "edit";

const FILE_OP_COLORS: Record<FileOp, (s: string) => string> = {
	read: pc.cyan,
	write: pc.green,
	edit: pc.yellow,
};

const FILE_OP_LABELS: Record<FileOp, string> = {
	read: "[READ]",
	write: "[WRITE]",
	edit: "[EDIT]",
};

/**
 * Log a file operation (read, write, edit) with colored output
 */
export function logFileOp(op: FileOp, filePath: string): void {
	const color = FILE_OP_COLORS[op];
	const label = FILE_OP_LABELS[op];
	console.log(color(label), filePath);
}

/**
 * Format token count
 */
export function formatTokens(input: number, output: number): string {
	const total = input + output;
	if (total === 0) return "";
	return pc.dim(`(${input.toLocaleString()} in / ${output.toLocaleString()} out)`);
}
