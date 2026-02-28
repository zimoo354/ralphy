import { describe, expect, it } from "bun:test";
import { EventEmitter } from "node:events";
import { claudeEngineEvents, extractInputTokensFromLine, extractToolUseEvents } from "./claude.ts";

describe("extractToolUseEvents", () => {
	it("returns empty array for non-JSON lines", () => {
		expect(extractToolUseEvents("not json")).toEqual([]);
		expect(extractToolUseEvents("")).toEqual([]);
	});

	it("returns empty array for non-assistant type events", () => {
		const line = JSON.stringify({ type: "result", result: "done" });
		expect(extractToolUseEvents(line)).toEqual([]);
	});

	it("returns empty array when message.content is not an array", () => {
		const line = JSON.stringify({ type: "assistant", message: { content: "text" } });
		expect(extractToolUseEvents(line)).toEqual([]);
	});

	it("returns empty array when content has no tool_use items", () => {
		const line = JSON.stringify({
			type: "assistant",
			message: { content: [{ type: "text", text: "hello" }] },
		});
		expect(extractToolUseEvents(line)).toEqual([]);
	});

	it("extracts Read tool use with file_path", () => {
		const line = JSON.stringify({
			type: "assistant",
			message: {
				content: [
					{
						type: "tool_use",
						name: "Read",
						input: { file_path: "src/index.ts" },
					},
				],
			},
		});
		expect(extractToolUseEvents(line)).toEqual([{ tool: "Read", value: "src/index.ts" }]);
	});

	it("extracts Write tool use with file_path", () => {
		const line = JSON.stringify({
			type: "assistant",
			message: {
				content: [
					{
						type: "tool_use",
						name: "Write",
						input: { file_path: "src/output.ts" },
					},
				],
			},
		});
		expect(extractToolUseEvents(line)).toEqual([{ tool: "Write", value: "src/output.ts" }]);
	});

	it("extracts Edit tool use with file_path", () => {
		const line = JSON.stringify({
			type: "assistant",
			message: {
				content: [
					{
						type: "tool_use",
						name: "Edit",
						input: { file_path: "src/config.ts" },
					},
				],
			},
		});
		expect(extractToolUseEvents(line)).toEqual([{ tool: "Edit", value: "src/config.ts" }]);
	});

	it("extracts Bash tool use with command", () => {
		const line = JSON.stringify({
			type: "assistant",
			message: {
				content: [
					{
						type: "tool_use",
						name: "Bash",
						input: { command: "npm run build" },
					},
				],
			},
		});
		expect(extractToolUseEvents(line)).toEqual([{ tool: "Bash", value: "npm run build" }]);
	});

	it("skips Read tool use when file_path is missing", () => {
		const line = JSON.stringify({
			type: "assistant",
			message: {
				content: [{ type: "tool_use", name: "Read", input: {} }],
			},
		});
		expect(extractToolUseEvents(line)).toEqual([]);
	});

	it("skips Bash tool use when command is missing", () => {
		const line = JSON.stringify({
			type: "assistant",
			message: {
				content: [{ type: "tool_use", name: "Bash", input: {} }],
			},
		});
		expect(extractToolUseEvents(line)).toEqual([]);
	});

	it("ignores unknown tool names", () => {
		const line = JSON.stringify({
			type: "assistant",
			message: {
				content: [
					{
						type: "tool_use",
						name: "Glob",
						input: { pattern: "**/*.ts" },
					},
				],
			},
		});
		expect(extractToolUseEvents(line)).toEqual([]);
	});

	it("extracts multiple tool_use events from a single line", () => {
		const line = JSON.stringify({
			type: "assistant",
			message: {
				content: [
					{ type: "tool_use", name: "Read", input: { file_path: "a.ts" } },
					{ type: "text", text: "some text" },
					{ type: "tool_use", name: "Edit", input: { file_path: "b.ts" } },
				],
			},
		});
		expect(extractToolUseEvents(line)).toEqual([
			{ tool: "Read", value: "a.ts" },
			{ tool: "Edit", value: "b.ts" },
		]);
	});
});

describe("extractInputTokensFromLine", () => {
	it("returns null for non-JSON lines", () => {
		expect(extractInputTokensFromLine("not json")).toBeNull();
		expect(extractInputTokensFromLine("")).toBeNull();
	});

	it("returns null for lines not starting with {", () => {
		expect(extractInputTokensFromLine("[1,2,3]")).toBeNull();
	});

	it("returns null for non-assistant type events", () => {
		const line = JSON.stringify({ type: "result", usage: { input_tokens: 100 } });
		expect(extractInputTokensFromLine(line)).toBeNull();
	});

	it("returns null when message.usage is missing", () => {
		const line = JSON.stringify({ type: "assistant", message: { content: [] } });
		expect(extractInputTokensFromLine(line)).toBeNull();
	});

	it("returns null when input_tokens is not a number", () => {
		const line = JSON.stringify({
			type: "assistant",
			message: { usage: { input_tokens: "100" } },
		});
		expect(extractInputTokensFromLine(line)).toBeNull();
	});

	it("extracts input_tokens from an assistant message", () => {
		const line = JSON.stringify({
			type: "assistant",
			message: { usage: { input_tokens: 1234, output_tokens: 56 } },
		});
		expect(extractInputTokensFromLine(line)).toBe(1234);
	});

	it("returns null for malformed JSON", () => {
		expect(extractInputTokensFromLine("{invalid json")).toBeNull();
	});
});

describe("claudeEngineEvents", () => {
	it("is an EventEmitter instance", () => {
		expect(claudeEngineEvents).toBeInstanceOf(EventEmitter);
	});

	it("emits and receives context-window-threshold events", () => {
		const received: unknown[] = [];
		const handler = (payload: unknown) => received.push(payload);

		claudeEngineEvents.on("context-window-threshold", handler);
		claudeEngineEvents.emit("context-window-threshold", {
			cumulativeInputTokens: 160000,
			threshold: 0.8,
			maxContextTokens: 200000,
		});
		claudeEngineEvents.off("context-window-threshold", handler);

		expect(received).toHaveLength(1);
		expect(received[0]).toEqual({
			cumulativeInputTokens: 160000,
			threshold: 0.8,
			maxContextTokens: 200000,
		});
	});

	it("emits context-window-threshold once when cumulative tokens cross threshold", () => {
		const emitted: unknown[] = [];
		const handler = (payload: unknown) => emitted.push(payload);
		claudeEngineEvents.on("context-window-threshold", handler);

		// Simulate the threshold logic: accumulate tokens across two turns
		const threshold = 0.8;
		const maxContextTokens = 10000;
		let cumulativeInputTokens = 0;
		let thresholdEmitted = false;

		const lines = [
			JSON.stringify({ type: "assistant", message: { usage: { input_tokens: 5000 } } }),
			JSON.stringify({ type: "assistant", message: { usage: { input_tokens: 4000 } } }),
		];

		for (const line of lines) {
			if (!thresholdEmitted) {
				const lineTokens = extractInputTokensFromLine(line);
				if (lineTokens !== null) {
					cumulativeInputTokens += lineTokens;
					if (cumulativeInputTokens >= threshold * maxContextTokens) {
						thresholdEmitted = true;
						claudeEngineEvents.emit("context-window-threshold", {
							cumulativeInputTokens,
							threshold,
							maxContextTokens,
						});
					}
				}
			}
		}

		claudeEngineEvents.off("context-window-threshold", handler);

		expect(emitted).toHaveLength(1);
		expect(emitted[0]).toMatchObject({
			cumulativeInputTokens: 9000,
			threshold: 0.8,
			maxContextTokens: 10000,
		});
	});

	it("does not emit when tokens stay below threshold", () => {
		const emitted: unknown[] = [];
		const handler = (payload: unknown) => emitted.push(payload);
		claudeEngineEvents.on("context-window-threshold", handler);

		const threshold = 0.8;
		const maxContextTokens = 10000;
		let cumulativeInputTokens = 0;
		let thresholdEmitted = false;

		const line = JSON.stringify({
			type: "assistant",
			message: { usage: { input_tokens: 1000 } },
		});

		if (!thresholdEmitted) {
			const lineTokens = extractInputTokensFromLine(line);
			if (lineTokens !== null) {
				cumulativeInputTokens += lineTokens;
				if (cumulativeInputTokens >= threshold * maxContextTokens) {
					thresholdEmitted = true;
					claudeEngineEvents.emit("context-window-threshold", {
						cumulativeInputTokens,
						threshold,
						maxContextTokens,
					});
				}
			}
		}

		claudeEngineEvents.off("context-window-threshold", handler);

		expect(emitted).toHaveLength(0);
	});
});
