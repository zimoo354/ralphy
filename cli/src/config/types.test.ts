import { describe, expect, it } from "bun:test";
import { RalphyConfigSchema } from "./types.ts";

describe("RalphyConfigSchema", () => {
	describe("contextWindowThreshold", () => {
		it("defaults to 0.8", () => {
			const config = RalphyConfigSchema.parse({});
			expect(config.contextWindowThreshold).toBe(0.8);
		});

		it("accepts a custom value", () => {
			const config = RalphyConfigSchema.parse({ contextWindowThreshold: 0.9 });
			expect(config.contextWindowThreshold).toBe(0.9);
		});

		it("accepts 0", () => {
			const config = RalphyConfigSchema.parse({ contextWindowThreshold: 0 });
			expect(config.contextWindowThreshold).toBe(0);
		});

		it("accepts 1", () => {
			const config = RalphyConfigSchema.parse({ contextWindowThreshold: 1 });
			expect(config.contextWindowThreshold).toBe(1);
		});

		it("rejects non-numeric values", () => {
			expect(() => RalphyConfigSchema.parse({ contextWindowThreshold: "high" })).toThrow();
		});
	});

	describe("maxContextTokens", () => {
		it("defaults to 200000", () => {
			const config = RalphyConfigSchema.parse({});
			expect(config.maxContextTokens).toBe(200000);
		});

		it("accepts a custom value", () => {
			const config = RalphyConfigSchema.parse({ maxContextTokens: 100000 });
			expect(config.maxContextTokens).toBe(100000);
		});

		it("rejects non-integer values", () => {
			expect(() => RalphyConfigSchema.parse({ maxContextTokens: 1.5 })).toThrow();
		});

		it("rejects non-numeric values", () => {
			expect(() => RalphyConfigSchema.parse({ maxContextTokens: "large" })).toThrow();
		});
	});

	describe("full config parsing", () => {
		it("parses a complete config with both fields", () => {
			const config = RalphyConfigSchema.parse({
				contextWindowThreshold: 0.75,
				maxContextTokens: 150000,
			});
			expect(config.contextWindowThreshold).toBe(0.75);
			expect(config.maxContextTokens).toBe(150000);
		});

		it("existing fields are unaffected", () => {
			const config = RalphyConfigSchema.parse({});
			expect(config.project).toBeDefined();
			expect(config.commands).toBeDefined();
			expect(config.rules).toEqual([]);
			expect(config.boundaries).toBeDefined();
			expect(config.notifications).toBeDefined();
		});
	});
});
