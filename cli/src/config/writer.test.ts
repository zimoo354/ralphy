import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { initConfig } from "./writer.ts";

let workDir: string;

beforeEach(() => {
	// Create a fresh temp directory for each test
	workDir = join(tmpdir(), `ralphy-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
	mkdirSync(workDir, { recursive: true });
});

afterEach(() => {
	// Cleanup is handled by the OS for temp dirs
});

describe("initConfig", () => {
	it("creates .ralphy directory", () => {
		initConfig(workDir);
		expect(existsSync(join(workDir, ".ralphy"))).toBe(true);
	});

	it("creates config.yaml", () => {
		initConfig(workDir);
		expect(existsSync(join(workDir, ".ralphy", "config.yaml"))).toBe(true);
	});

	it("creates progress.txt", () => {
		initConfig(workDir);
		expect(existsSync(join(workDir, ".ralphy", "progress.txt"))).toBe(true);
	});

	it("creates .ralphy/skills directory", () => {
		initConfig(workDir);
		expect(existsSync(join(workDir, ".ralphy", "skills"))).toBe(true);
	});

	it("creates .ralphy/skills/README.md", () => {
		initConfig(workDir);
		expect(existsSync(join(workDir, ".ralphy", "skills", "README.md"))).toBe(true);
	});

	it("README.md contains skills convention explanation", () => {
		initConfig(workDir);
		const content = readFileSync(join(workDir, ".ralphy", "skills", "README.md"), "utf-8");
		expect(content).toContain("Skills Directory");
		expect(content).toContain("Knowledge Base");
		expect(content).toContain("skills_dir");
	});

	it("does not overwrite existing README.md on re-init", () => {
		initConfig(workDir);
		const readmePath = join(workDir, ".ralphy", "skills", "README.md");
		const original = readFileSync(readmePath, "utf-8");

		// Re-run init
		initConfig(workDir);
		const after = readFileSync(readmePath, "utf-8");
		expect(after).toBe(original);
	});

	it("returns created: true and detected info", () => {
		const result = initConfig(workDir);
		expect(result.created).toBe(true);
		expect(result.detected).toBeDefined();
	});
});
