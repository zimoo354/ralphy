import { join } from "node:path";
import { describe, expect, it } from "bun:test";
import {
	buildCommand,
	buildCommandPreview,
	type NewTaskFormState,
} from "./command-preview";

const baseState: NewTaskFormState = {
	repoPath: "/home/user/repo",
	mode: "single",
	task: "add a feature",
	engine: "cursor",
	runTests: true,
	runLint: true,
	fast: false,
	parallel: false,
	maxParallel: 3,
	sandbox: false,
	createPr: false,
};

describe("buildCommand", () => {
	it("returns cwd from repoPath and argv with task for single mode", () => {
		const r = buildCommand(baseState);
		expect(r.cwd).toBe("/home/user/repo");
		expect(r.argv).toContain("ralphy");
		expect(r.argv).toContain("add a feature");
		expect(r.argv).toContain("--cursor");
		expect(r.prdFile).toBeUndefined();
	});

	it("single mode with empty task omits task from argv", () => {
		const r = buildCommand({ ...baseState, task: "  " });
		expect(r.argv).not.toContain("add a feature");
		expect(r.argv.filter((a) => a !== "ralphy" && !a.startsWith("--"))).toHaveLength(0);
	});

	it("PRD mode with runTasksPath sets prdFile and --prd in argv", () => {
		const state: NewTaskFormState = { ...baseState, mode: "prd", task: "# Tasks\n- one" };
		const runPath = "/tmp/run-1/tasks.md";
		const r = buildCommand(state, { runTasksPath: runPath });
		expect(r.prdFile).toEqual({ path: runPath, content: "# Tasks\n- one" });
		expect(r.argv).toContain("--prd");
		expect(r.argv[r.argv.indexOf("--prd") + 1]).toBe(runPath);
	});

	it("PRD mode without runTasksPath uses cwd/tasks.md and sets prdFile", () => {
		const state: NewTaskFormState = { ...baseState, mode: "prd", task: "## PRD" };
		const r = buildCommand(state);
		expect(r.prdFile).toEqual({
			path: join("/home/user/repo", "tasks.md"),
			content: "## PRD",
		});
		expect(r.argv[r.argv.indexOf("--prd") + 1]).toBe(join("/home/user/repo", "tasks.md"));
	});

	it("PRD mode with empty task has no prdFile and no --prd", () => {
		const r = buildCommand({ ...baseState, mode: "prd", task: "" });
		expect(r.prdFile).toBeUndefined();
		expect(r.argv).not.toContain("--prd");
	});

	it("adds engine flags", () => {
		expect(buildCommand({ ...baseState, engine: "claude" }).argv).toContain("--claude");
		expect(buildCommand({ ...baseState, engine: "cursor" }).argv).toContain("--cursor");
	});

	it("adds fast and no-tests/no-lint", () => {
		expect(buildCommand({ ...baseState, fast: true }).argv).toContain("--fast");
		expect(buildCommand({ ...baseState, runTests: false }).argv).toContain("--no-tests");
		expect(buildCommand({ ...baseState, runLint: false }).argv).toContain("--no-lint");
	});

	it("adds parallel and max-parallel", () => {
		const r = buildCommand({ ...baseState, parallel: true, maxParallel: 5 });
		expect(r.argv).toContain("--parallel");
		expect(r.argv).toContain("--max-parallel");
		expect(r.argv[r.argv.indexOf("--max-parallel") + 1]).toBe("5");
	});

	it("omits max-parallel when 3", () => {
		const r = buildCommand({ ...baseState, parallel: true, maxParallel: 3 });
		expect(r.argv).not.toContain("--max-parallel");
	});

	it("adds sandbox and create-pr when set", () => {
		const r = buildCommand({ ...baseState, sandbox: true, createPr: true });
		expect(r.argv).toContain("--sandbox");
		expect(r.argv).toContain("--create-pr");
	});

	it("trims cwd from repoPath", () => {
		const r = buildCommand({ ...baseState, repoPath: "  /home/user/repo  " });
		expect(r.cwd).toBe("/home/user/repo");
	});
});

describe("buildCommandPreview", () => {
	it("matches buildCommand argv for single task", () => {
		const preview = buildCommandPreview(baseState);
		const { argv } = buildCommand(baseState);
		expect(preview).toContain("ralphy");
		expect(preview).toContain("add a feature");
		expect(preview).toContain("--cursor");
		expect(argv.join(" ")).toContain("add a feature");
	});
});
