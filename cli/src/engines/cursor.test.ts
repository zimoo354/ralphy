import { describe, expect, it } from "bun:test";
import { detectFileOpsFromLine } from "./cursor.ts";

describe("detectFileOpsFromLine", () => {
	it("returns empty array for empty line", () => {
		expect(detectFileOpsFromLine("")).toEqual([]);
	});

	it("returns empty array for unrelated text", () => {
		expect(detectFileOpsFromLine("Task completed successfully.")).toEqual([]);
	});

	// Read detection
	it("detects read operation from plain text", () => {
		expect(detectFileOpsFromLine("Reading src/index.ts")).toEqual([
			{ op: "read", value: "src/index.ts" },
		]);
	});

	it("detects read with 'file' keyword", () => {
		expect(detectFileOpsFromLine("Reading file src/utils.ts")).toEqual([
			{ op: "read", value: "src/utils.ts" },
		]);
	});

	it("detects opening a file", () => {
		expect(detectFileOpsFromLine("Opening file src/config.ts")).toEqual([
			{ op: "read", value: "src/config.ts" },
		]);
	});

	it("detects read with quoted path", () => {
		expect(detectFileOpsFromLine('Reading "src/components/Button.tsx"')).toEqual([
			{ op: "read", value: "src/components/Button.tsx" },
		]);
	});

	// Write detection
	it("detects write operation from plain text", () => {
		expect(detectFileOpsFromLine("Writing src/output.ts")).toEqual([
			{ op: "write", value: "src/output.ts" },
		]);
	});

	it("detects write to file", () => {
		expect(detectFileOpsFromLine("Writing to src/output.ts")).toEqual([
			{ op: "write", value: "src/output.ts" },
		]);
	});

	it("detects creating a file", () => {
		expect(detectFileOpsFromLine("Creating file src/new.ts")).toEqual([
			{ op: "write", value: "src/new.ts" },
		]);
	});

	it("detects saving to a file", () => {
		expect(detectFileOpsFromLine("Saving to src/data.json")).toEqual([
			{ op: "write", value: "src/data.json" },
		]);
	});

	// Edit detection
	it("detects edit operation from plain text", () => {
		expect(detectFileOpsFromLine("Editing src/helpers.ts")).toEqual([
			{ op: "edit", value: "src/helpers.ts" },
		]);
	});

	it("detects modifying a file", () => {
		expect(detectFileOpsFromLine("Modifying src/helpers.ts")).toEqual([
			{ op: "edit", value: "src/helpers.ts" },
		]);
	});

	it("detects updating a file", () => {
		expect(detectFileOpsFromLine("Updating file src/config.json")).toEqual([
			{ op: "edit", value: "src/config.json" },
		]);
	});

	// Bash detection
	it("detects running a command", () => {
		expect(detectFileOpsFromLine("Running npm run build")).toEqual([
			{ op: "bash", value: "npm run build" },
		]);
	});

	it("detects executing a command", () => {
		expect(detectFileOpsFromLine("Executing bun test")).toEqual([
			{ op: "bash", value: "bun test" },
		]);
	});

	// JSON assistant message extraction
	it("extracts text from assistant JSON and detects file op", () => {
		const line = JSON.stringify({
			type: "assistant",
			message: {
				content: [{ type: "text", text: "Reading src/index.ts to understand the structure." }],
			},
		});
		expect(detectFileOpsFromLine(line)).toEqual([{ op: "read", value: "src/index.ts" }]);
	});

	it("returns empty array for non-assistant JSON types", () => {
		const line = JSON.stringify({ type: "result", result: "done" });
		expect(detectFileOpsFromLine(line)).toEqual([]);
	});

	it("returns empty array for assistant JSON with no matching text", () => {
		const line = JSON.stringify({
			type: "assistant",
			message: { content: [{ type: "text", text: "I will analyze the codebase." }] },
		});
		expect(detectFileOpsFromLine(line)).toEqual([]);
	});

	it("handles non-JSON lines gracefully", () => {
		expect(detectFileOpsFromLine("{not json at all}")).toEqual([]);
	});

	// Case insensitivity
	it("is case-insensitive for operation keywords", () => {
		expect(detectFileOpsFromLine("READING src/index.ts")).toEqual([
			{ op: "read", value: "src/index.ts" },
		]);
	});
});
