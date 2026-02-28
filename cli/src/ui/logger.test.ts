import { afterEach, beforeEach, describe, expect, it, mock, spyOn } from "bun:test";
import { logFileOp } from "./logger.ts";

describe("logFileOp", () => {
	let consoleSpy: ReturnType<typeof spyOn>;

	beforeEach(() => {
		consoleSpy = spyOn(console, "log").mockImplementation(() => {});
	});

	afterEach(() => {
		consoleSpy.mockRestore();
	});

	it("logs read operation with file path", () => {
		logFileOp("read", "src/index.ts");
		expect(consoleSpy).toHaveBeenCalledTimes(1);
		const [label, path] = consoleSpy.mock.calls[0];
		expect(label).toContain("READ");
		expect(path).toBe("src/index.ts");
	});

	it("logs write operation with file path", () => {
		logFileOp("write", "src/output.ts");
		expect(consoleSpy).toHaveBeenCalledTimes(1);
		const [label, path] = consoleSpy.mock.calls[0];
		expect(label).toContain("WRITE");
		expect(path).toBe("src/output.ts");
	});

	it("logs edit operation with file path", () => {
		logFileOp("edit", "src/config.ts");
		expect(consoleSpy).toHaveBeenCalledTimes(1);
		const [label, path] = consoleSpy.mock.calls[0];
		expect(label).toContain("EDIT");
		expect(path).toBe("src/config.ts");
	});

	it("logs bash operation with command", () => {
		logFileOp("bash", "npm run build");
		expect(consoleSpy).toHaveBeenCalledTimes(1);
		const [label, cmd] = consoleSpy.mock.calls[0];
		expect(label).toContain("BASH");
		expect(cmd).toBe("npm run build");
	});
});
