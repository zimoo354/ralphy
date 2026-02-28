import { describe, expect, it } from "bun:test";
import { extractToolUseEvents } from "./claude.ts";

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
