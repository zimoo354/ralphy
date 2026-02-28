import { describe, expect, it } from "bun:test";
import { parseArgs } from "./args.ts";

describe("parseArgs", () => {
	describe("--skills-dir flag", () => {
		it("should set skillsDir when --skills-dir is provided", () => {
			const { options } = parseArgs(["node", "ralphy", "--skills-dir", "my/skills"]);
			expect(options.skillsDir).toBe("my/skills");
		});

		it("should set skillsDir to undefined when --skills-dir is not provided", () => {
			const { options } = parseArgs(["node", "ralphy"]);
			expect(options.skillsDir).toBeUndefined();
		});

		it("should accept an absolute path for --skills-dir", () => {
			const { options } = parseArgs(["node", "ralphy", "--skills-dir", "/absolute/path/skills"]);
			expect(options.skillsDir).toBe("/absolute/path/skills");
		});

		it("should accept a relative path for --skills-dir", () => {
			const { options } = parseArgs(["node", "ralphy", "--skills-dir", "./relative/skills"]);
			expect(options.skillsDir).toBe("./relative/skills");
		});

		it("should be combinable with other flags", () => {
			const { options } = parseArgs([
				"node",
				"ralphy",
				"--skills-dir",
				"custom-skills",
				"--dry-run",
				"--claude",
			]);
			expect(options.skillsDir).toBe("custom-skills");
			expect(options.dryRun).toBe(true);
			expect(options.aiEngine).toBe("claude");
		});
	});
});
