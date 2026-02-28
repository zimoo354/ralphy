import { logFileOp } from "../ui/logger.ts";
import {
	BaseAIEngine,
	checkForErrors,
	detectStepFromOutput,
	execCommand,
	execCommandStreaming,
	formatCommandError,
} from "./base.ts";
import type { AIResult, EngineOptions, ProgressCallback } from "./types.ts";

type FileOpDetection = { op: "read" | "write" | "edit" | "bash"; value: string };

// File path: something with an extension or containing a slash
const FILE_PATH_RE = /['"]?([^\s'"]+(?:\.[a-zA-Z0-9]{1,10}|(?:\/[^\s'"\/]+)+))['"]?/;

const READ_RE = /\b(?:read(?:ing)?(?:\s+file)?|open(?:ing)?(?:\s+file)?)\s+(.+)/i;
const WRITE_RE =
	/\b(?:writ(?:ing|e)(?:\s+(?:to\s+)?(?:file\s+)?)?|creat(?:ing|e)(?:\s+file\s+)?|sav(?:ing|e)(?:\s+(?:to\s+)?)?)(.+)/i;
const EDIT_RE =
	/\b(?:edit(?:ing)?(?:\s+file\s+)?|modif(?:ying|y)(?:\s+file\s+)?|updat(?:ing|e)(?:\s+file\s+)?)(.+)/i;
const BASH_RE = /\b(?:running|executing)\s+(?:command\s+)?(.+)/i;

/**
 * Extract plain text from a Cursor stream-json assistant line.
 * Returns the raw line if it is not a JSON assistant message.
 */
function extractTextFromLine(line: string): string {
	const trimmed = line.trim();
	if (!trimmed.startsWith("{")) return trimmed;
	try {
		const parsed = JSON.parse(trimmed);
		if (parsed.type === "assistant" && Array.isArray(parsed.message?.content)) {
			return parsed.message.content
				.filter((item: { type: string; text?: string }) => item.type === "text" && item.text)
				.map((item: { text: string }) => item.text)
				.join("\n");
		}
	} catch {
		// fall through
	}
	return trimmed;
}

/**
 * Detect file operations from a Cursor agent stdout line using regex patterns.
 * Returns an array of detected operations and their values (file paths or commands).
 */
export function detectFileOpsFromLine(line: string): FileOpDetection[] {
	const text = extractTextFromLine(line);
	if (!text) return [];

	const results: FileOpDetection[] = [];

	const readMatch = text.match(READ_RE);
	if (readMatch) {
		const pathMatch = readMatch[1].match(FILE_PATH_RE);
		if (pathMatch) results.push({ op: "read", value: pathMatch[1] });
	}

	const writeMatch = text.match(WRITE_RE);
	if (writeMatch) {
		const pathMatch = writeMatch[1].match(FILE_PATH_RE);
		if (pathMatch) results.push({ op: "write", value: pathMatch[1] });
	}

	const editMatch = text.match(EDIT_RE);
	if (editMatch) {
		const pathMatch = editMatch[1].match(FILE_PATH_RE);
		if (pathMatch) results.push({ op: "edit", value: pathMatch[1] });
	}

	const bashMatch = text.match(BASH_RE);
	if (bashMatch) {
		results.push({ op: "bash", value: bashMatch[1].trim() });
	}

	return results;
}

const isWindows = process.platform === "win32";

/**
 * Cursor Agent AI Engine
 */
export class CursorEngine extends BaseAIEngine {
	name = "Cursor Agent";
	cliCommand = "agent";

	async execute(prompt: string, workDir: string, options?: EngineOptions): Promise<AIResult> {
		const args = ["--print", "--force", "--output-format", "stream-json"];
		if (options?.modelOverride) {
			args.push("--model", options.modelOverride);
		}
		// Add any additional engine-specific arguments
		if (options?.engineArgs && options.engineArgs.length > 0) {
			args.push(...options.engineArgs);
		}

		// On Windows, pass prompt via stdin to avoid cmd.exe argument parsing issues
		let stdinContent: string | undefined;
		if (isWindows) {
			stdinContent = prompt;
		} else {
			args.push(prompt);
		}

		const { stdout, stderr, exitCode } = await execCommand(
			this.cliCommand,
			args,
			workDir,
			undefined,
			stdinContent,
		);

		const output = stdout + stderr;

		// Check for errors
		const error = checkForErrors(output);
		if (error) {
			return {
				success: false,
				response: "",
				inputTokens: 0,
				outputTokens: 0,
				error,
			};
		}

		// Parse Cursor output
		const { response, durationMs } = this.parseOutput(output);

		// If command failed with non-zero exit code, provide a meaningful error
		if (exitCode !== 0) {
			return {
				success: false,
				response,
				inputTokens: 0,
				outputTokens: 0,
				error: formatCommandError(exitCode, output),
			};
		}

		return {
			success: true,
			response,
			inputTokens: 0, // Cursor doesn't provide token counts
			outputTokens: 0,
			cost: durationMs > 0 ? `duration:${durationMs}` : undefined,
		};
	}

	private parseOutput(output: string): { response: string; durationMs: number } {
		const lines = output.split("\n").filter(Boolean);
		let response = "";
		let durationMs = 0;

		for (const line of lines) {
			try {
				const parsed = JSON.parse(line);

				// Check result line
				if (parsed.type === "result") {
					response = parsed.result || "Task completed";
					if (typeof parsed.duration_ms === "number") {
						durationMs = parsed.duration_ms;
					}
				}

				// Check assistant message as fallback
				if (parsed.type === "assistant" && !response) {
					const content = parsed.message?.content;
					if (Array.isArray(content) && content[0]?.text) {
						response = content[0].text;
					} else if (typeof content === "string") {
						response = content;
					}
				}
			} catch {
				// Ignore non-JSON lines
			}
		}

		return { response: response || "Task completed", durationMs };
	}

	async executeStreaming(
		prompt: string,
		workDir: string,
		onProgress: ProgressCallback,
		options?: EngineOptions,
	): Promise<AIResult> {
		const args = ["--print", "--force", "--output-format", "stream-json"];
		if (options?.modelOverride) {
			args.push("--model", options.modelOverride);
		}
		// Add any additional engine-specific arguments
		if (options?.engineArgs && options.engineArgs.length > 0) {
			args.push(...options.engineArgs);
		}

		// On Windows, pass prompt via stdin to avoid cmd.exe argument parsing issues
		let stdinContent: string | undefined;
		if (isWindows) {
			stdinContent = prompt;
		} else {
			args.push(prompt);
		}

		const outputLines: string[] = [];

		const { exitCode } = await execCommandStreaming(
			this.cliCommand,
			args,
			workDir,
			(line) => {
				outputLines.push(line);

				// Detect and report step changes
				const step = detectStepFromOutput(line);
				if (step) {
					onProgress(step);
				}

				// Log file operations detected via regex
				for (const { op, value } of detectFileOpsFromLine(line)) {
					logFileOp(op, value);
				}
			},
			undefined,
			stdinContent,
		);

		const output = outputLines.join("\n");

		// Check for errors
		const error = checkForErrors(output);
		if (error) {
			return {
				success: false,
				response: "",
				inputTokens: 0,
				outputTokens: 0,
				error,
			};
		}

		// Parse Cursor output
		const { response, durationMs } = this.parseOutput(output);

		// If command failed with non-zero exit code, provide a meaningful error
		if (exitCode !== 0) {
			return {
				success: false,
				response,
				inputTokens: 0,
				outputTokens: 0,
				error: formatCommandError(exitCode, output),
			};
		}

		return {
			success: true,
			response,
			inputTokens: 0,
			outputTokens: 0,
			cost: durationMs > 0 ? `duration:${durationMs}` : undefined,
		};
	}
}
