import { EventEmitter } from "node:events";
import { logFileOp } from "../ui/logger.ts";
import {
	BaseAIEngine,
	checkForErrors,
	detectStepFromOutput,
	execCommand,
	execCommandStreaming,
	formatCommandError,
	parseStreamJsonResult,
} from "./base.ts";
import type { AIResult, EngineOptions, ProgressCallback } from "./types.ts";

/**
 * Shared event emitter for Claude engine lifecycle events.
 * Emits 'context-window-threshold' when cumulative input tokens cross the configured threshold.
 */
export const claudeEngineEvents = new EventEmitter();

type ToolUseEvent = { tool: "Read" | "Write" | "Edit" | "Bash"; value: string };

/**
 * Extract tool_use events from a Claude stream-json line.
 * Returns an array of tool use events found in the line.
 */
export function extractToolUseEvents(line: string): ToolUseEvent[] {
	const trimmed = line.trim();
	if (!trimmed.startsWith("{")) return [];

	try {
		const parsed = JSON.parse(trimmed);
		if (parsed.type !== "assistant" || !Array.isArray(parsed.message?.content)) return [];

		const events: ToolUseEvent[] = [];
		for (const item of parsed.message.content) {
			if (item.type !== "tool_use") continue;

			switch (item.name) {
				case "Read":
					if (item.input?.file_path) events.push({ tool: "Read", value: item.input.file_path });
					break;
				case "Write":
					if (item.input?.file_path) events.push({ tool: "Write", value: item.input.file_path });
					break;
				case "Edit":
					if (item.input?.file_path) events.push({ tool: "Edit", value: item.input.file_path });
					break;
				case "Bash":
					if (item.input?.command) events.push({ tool: "Bash", value: item.input.command });
					break;
			}
		}
		return events;
	} catch {
		return [];
	}
}

/**
 * Extract input_tokens from a Claude stream-json assistant message.
 * Returns the token count if present, null otherwise.
 */
export function extractInputTokensFromLine(line: string): number | null {
	const trimmed = line.trim();
	if (!trimmed.startsWith("{")) return null;

	try {
		const parsed = JSON.parse(trimmed);
		if (parsed.type === "assistant" && typeof parsed.message?.usage?.input_tokens === "number") {
			return parsed.message.usage.input_tokens;
		}
	} catch {
		// ignore non-JSON or malformed lines
	}
	return null;
}

const isWindows = process.platform === "win32";

/**
 * Claude Code AI Engine
 */
export class ClaudeEngine extends BaseAIEngine {
	name = "Claude Code";
	cliCommand = "claude";

	async execute(prompt: string, workDir: string, options?: EngineOptions): Promise<AIResult> {
		const args = ["--dangerously-skip-permissions", "--verbose", "--output-format", "stream-json"];
		if (options?.modelOverride) {
			args.push("--model", options.modelOverride);
		}
		// Add any additional engine-specific arguments
		if (options?.engineArgs && options.engineArgs.length > 0) {
			args.push(...options.engineArgs);
		}

		// On Windows, pass prompt via stdin to avoid cmd.exe argument parsing issues with multi-line content
		// On other platforms, pass as argument for compatibility
		let stdinContent: string | undefined;
		if (isWindows) {
			args.push("-p"); // Enable print mode, prompt comes from stdin
			stdinContent = prompt;
		} else {
			args.push("-p", prompt);
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

		// Parse result
		const { response, inputTokens, outputTokens } = parseStreamJsonResult(output);

		// If command failed with non-zero exit code, provide a meaningful error
		if (exitCode !== 0) {
			return {
				success: false,
				response,
				inputTokens,
				outputTokens,
				error: formatCommandError(exitCode, output),
			};
		}

		return {
			success: true,
			response,
			inputTokens,
			outputTokens,
		};
	}

	async executeStreaming(
		prompt: string,
		workDir: string,
		onProgress: ProgressCallback,
		options?: EngineOptions,
	): Promise<AIResult> {
		const args = ["--dangerously-skip-permissions", "--verbose", "--output-format", "stream-json"];
		if (options?.modelOverride) {
			args.push("--model", options.modelOverride);
		}
		// Add any additional engine-specific arguments
		if (options?.engineArgs && options.engineArgs.length > 0) {
			args.push(...options.engineArgs);
		}

		// On Windows, pass prompt via stdin to avoid cmd.exe argument parsing issues with multi-line content
		// On other platforms, pass as argument for compatibility
		let stdinContent: string | undefined;
		if (isWindows) {
			args.push("-p"); // Enable print mode, prompt comes from stdin
			stdinContent = prompt;
		} else {
			args.push("-p", prompt);
		}

		const outputLines: string[] = [];

		const contextThreshold = options?.contextWindowThreshold ?? 0;
		const maxContextTokens = options?.maxContextTokens ?? 0;
		let cumulativeInputTokens = 0;
		let thresholdEmitted = false;

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

				// Log file operations from tool_use events
				for (const { tool, value } of extractToolUseEvents(line)) {
					if (tool === "Read") logFileOp("read", value);
					else if (tool === "Write") logFileOp("write", value);
					else if (tool === "Edit") logFileOp("edit", value);
					else if (tool === "Bash") logFileOp("bash", value);
				}

				// Track cumulative input tokens and emit threshold event
				if (contextThreshold > 0 && maxContextTokens > 0 && !thresholdEmitted) {
					const lineTokens = extractInputTokensFromLine(line);
					if (lineTokens !== null) {
						cumulativeInputTokens += lineTokens;
						if (cumulativeInputTokens >= contextThreshold * maxContextTokens) {
							thresholdEmitted = true;
							claudeEngineEvents.emit("context-window-threshold", {
								cumulativeInputTokens,
								threshold: contextThreshold,
								maxContextTokens,
							});
						}
					}
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

		// Parse result
		const { response, inputTokens, outputTokens } = parseStreamJsonResult(output);

		// If command failed with non-zero exit code, provide a meaningful error
		if (exitCode !== 0) {
			return {
				success: false,
				response,
				inputTokens,
				outputTokens,
				error: formatCommandError(exitCode, output),
			};
		}

		return {
			success: true,
			response,
			inputTokens,
			outputTokens,
		};
	}
}
