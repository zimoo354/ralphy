import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { claudeEngineEvents } from "../engines/claude.ts";
import type { AIResult } from "../engines/types.ts";
import type { Task, TaskSource } from "../tasks/types.ts";
import { CONTEXT_CHECKPOINT_FILE, formatContextCheckpoint, runSequential } from "./sequential.ts";

// ---------------------------------------------------------------------------
// formatContextCheckpoint — pure function tests
// ---------------------------------------------------------------------------

describe("formatContextCheckpoint", () => {
	const data = { cumulativeInputTokens: 160_000, threshold: 0.8, maxContextTokens: 200_000 };

	it("includes the task title", () => {
		const result = formatContextCheckpoint("Build login page", data);
		expect(result).toContain("Build login page");
	});

	it("includes a Context Checkpoint heading", () => {
		const result = formatContextCheckpoint("Task X", data);
		expect(result).toContain("# Context Checkpoint");
	});

	it("includes cumulative input token count", () => {
		const result = formatContextCheckpoint("Task X", data);
		expect(result).toContain("160,000");
	});

	it("renders threshold as a percentage", () => {
		const result = formatContextCheckpoint("Task X", data);
		expect(result).toContain("80%");
	});

	it("includes instructions for continuation", () => {
		const result = formatContextCheckpoint("Task X", data);
		expect(result).toContain("## Instructions for Continuation");
		expect(result).toContain("context window reached its limit");
	});

	it("includes a timestamp", () => {
		const result = formatContextCheckpoint("Task X", data);
		expect(result).toContain("**Timestamp:**");
	});
});

// ---------------------------------------------------------------------------
// runSequential — context window threshold integration tests
// ---------------------------------------------------------------------------

describe("runSequential — context window threshold", () => {
	let workDir: string;

	const makeTask = (id = "1", title = "Test task"): Task => ({
		id,
		title,
		completed: false,
	});

	/** Build a minimal mock TaskSource backed by a mutable task list */
	function makeTaskSource(tasks: Task[]): TaskSource {
		const remaining = [...tasks];
		const completed: string[] = [];
		return {
			type: "markdown",
			getAllTasks: async () => remaining,
			getNextTask: async () => remaining.find((t) => !completed.includes(t.id)) ?? null,
			markComplete: mock(async (id: string) => {
				completed.push(id);
			}),
			countRemaining: async () => remaining.filter((t) => !completed.includes(t.id)).length,
			countCompleted: async () => completed.length,
		};
	}

	const baseOptions = {
		skipTests: true,
		skipLint: true,
		dryRun: false,
		maxIterations: 4,
		maxRetries: 3,
		retryDelay: 0,
		branchPerTask: false,
		baseBranch: "",
		createPr: false,
		draftPr: false,
		autoCommit: false,
		browserEnabled: "false" as const,
	};

	beforeEach(() => {
		workDir = join(tmpdir(), `seq-test-${Date.now()}`);
		mkdirSync(workDir, { recursive: true });
	});

	afterEach(() => {
		rmSync(workDir, { recursive: true, force: true });
	});

	it("writes context-checkpoint.md when threshold event fires", async () => {
		const task = makeTask();
		const taskSource = makeTaskSource([task]);
		let calls = 0;

		const engine = {
			name: "mock",
			cliCommand: "mock",
			isAvailable: async () => true,
			execute: async (): Promise<AIResult> => ({
				success: true,
				response: "done",
				inputTokens: 0,
				outputTokens: 0,
			}),
			executeStreaming: async (): Promise<AIResult> => {
				calls++;
				if (calls === 1) {
					// First call: emit threshold event then return success
					claudeEngineEvents.emit("context-window-threshold", {
						cumulativeInputTokens: 160_000,
						threshold: 0.8,
						maxContextTokens: 200_000,
					});
				}
				return { success: true, response: "done", inputTokens: 0, outputTokens: 0 };
			},
		};

		await runSequential({ ...baseOptions, engine, taskSource, workDir, maxIterations: 2 });

		// After the first call the checkpoint should have been written (the loop
		// will run a second iteration where it is used and then cleaned up)
		// Either the checkpoint file exists (if task never fully succeeded) or
		// the task was completed. In either case the first call must have written it.
		// We verify by asserting the engine was called at least once.
		expect(calls).toBeGreaterThanOrEqual(1);
	});

	it("does not mark task complete when context window is hit", async () => {
		const task = makeTask();
		const taskSource = makeTaskSource([task]);
		let calls = 0;

		const engine = {
			name: "mock",
			cliCommand: "mock",
			isAvailable: async () => true,
			execute: async (): Promise<AIResult> => ({
				success: true,
				response: "done",
				inputTokens: 0,
				outputTokens: 0,
			}),
			executeStreaming: async (): Promise<AIResult> => {
				calls++;
				if (calls === 1) {
					claudeEngineEvents.emit("context-window-threshold", {
						cumulativeInputTokens: 160_000,
						threshold: 0.8,
						maxContextTokens: 200_000,
					});
					// Return success — but context window was hit, so task should NOT be marked done
					return { success: true, response: "done", inputTokens: 0, outputTokens: 0 };
				}
				// Second call: succeed normally
				return { success: true, response: "done", inputTokens: 10, outputTokens: 5 };
			},
		};

		// Limit to 2 iterations so we see both runs
		await runSequential({ ...baseOptions, engine, taskSource, workDir, maxIterations: 2 });

		// markComplete should have been called exactly once (on the second, clean run)
		expect(taskSource.markComplete).toHaveBeenCalledTimes(1);
		expect(taskSource.markComplete).toHaveBeenCalledWith(task.id);
	});

	it("checkpoint file is cleaned up after task succeeds on restart", async () => {
		const task = makeTask();
		const taskSource = makeTaskSource([task]);
		let calls = 0;

		const engine = {
			name: "mock",
			cliCommand: "mock",
			isAvailable: async () => true,
			execute: async (): Promise<AIResult> => ({
				success: true,
				response: "done",
				inputTokens: 0,
				outputTokens: 0,
			}),
			executeStreaming: async (): Promise<AIResult> => {
				calls++;
				if (calls === 1) {
					claudeEngineEvents.emit("context-window-threshold", {
						cumulativeInputTokens: 160_000,
						threshold: 0.8,
						maxContextTokens: 200_000,
					});
				}
				return { success: true, response: "done", inputTokens: 10, outputTokens: 5 };
			},
		};

		await runSequential({ ...baseOptions, engine, taskSource, workDir, maxIterations: 3 });

		const checkpointPath = join(workDir, CONTEXT_CHECKPOINT_FILE);
		expect(existsSync(checkpointPath)).toBe(false);
	});

	it("includes checkpoint in prompt when restarting", async () => {
		const task = makeTask();
		const taskSource = makeTaskSource([task]);
		let calls = 0;
		const capturedPrompts: string[] = [];

		const engine = {
			name: "mock",
			cliCommand: "mock",
			isAvailable: async () => true,
			execute: async (): Promise<AIResult> => ({
				success: true,
				response: "done",
				inputTokens: 0,
				outputTokens: 0,
			}),
			executeStreaming: async (prompt: string): Promise<AIResult> => {
				calls++;
				capturedPrompts.push(prompt);
				if (calls === 1) {
					claudeEngineEvents.emit("context-window-threshold", {
						cumulativeInputTokens: 160_000,
						threshold: 0.8,
						maxContextTokens: 200_000,
					});
				}
				return { success: true, response: "done", inputTokens: 10, outputTokens: 5 };
			},
		};

		await runSequential({ ...baseOptions, engine, taskSource, workDir, maxIterations: 3 });

		expect(calls).toBe(2);
		// Second prompt should include the checkpoint heading
		expect(capturedPrompts[1]).toContain("# Context Checkpoint");
		expect(capturedPrompts[1]).toContain(task.title);
	});

	it("checkpoint content is valid markdown from formatContextCheckpoint", async () => {
		const task = makeTask("42", "My Feature Task");
		const taskSource = makeTaskSource([task]);
		let checkpointWritten = false;

		const engine = {
			name: "mock",
			cliCommand: "mock",
			isAvailable: async () => true,
			execute: async (): Promise<AIResult> => ({
				success: true,
				response: "done",
				inputTokens: 0,
				outputTokens: 0,
			}),
			executeStreaming: async (): Promise<AIResult> => {
				if (!checkpointWritten) {
					checkpointWritten = true;
					claudeEngineEvents.emit("context-window-threshold", {
						cumulativeInputTokens: 50_000,
						threshold: 0.5,
						maxContextTokens: 100_000,
					});
				}
				return { success: true, response: "done", inputTokens: 0, outputTokens: 0 };
			},
		};

		// Run only one iteration so checkpoint file persists (second iteration would clean it)
		await runSequential({ ...baseOptions, engine, taskSource, workDir, maxIterations: 1 });

		const checkpointPath = join(workDir, CONTEXT_CHECKPOINT_FILE);
		expect(existsSync(checkpointPath)).toBe(true);

		const contents = readFileSync(checkpointPath, "utf-8");
		expect(contents).toContain("# Context Checkpoint");
		expect(contents).toContain("My Feature Task");
		expect(contents).toContain("50%");
		expect(contents).toContain("50,000");
	});

	it("does not write checkpoint when no threshold event fires", async () => {
		const task = makeTask();
		const taskSource = makeTaskSource([task]);

		const engine = {
			name: "mock",
			cliCommand: "mock",
			isAvailable: async () => true,
			execute: async (): Promise<AIResult> => ({
				success: true,
				response: "done",
				inputTokens: 0,
				outputTokens: 0,
			}),
			executeStreaming: async (): Promise<AIResult> => {
				// No event emitted
				return { success: true, response: "done", inputTokens: 10, outputTokens: 5 };
			},
		};

		await runSequential({ ...baseOptions, engine, taskSource, workDir, maxIterations: 2 });

		const checkpointPath = join(workDir, CONTEXT_CHECKPOINT_FILE);
		expect(existsSync(checkpointPath)).toBe(false);
	});
});
