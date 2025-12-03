import { describe, expect, it } from "vitest";
import { looksLikePath, parseArgs } from "./args-parser";

describe("parseArgs", () => {
	describe("flag parsing", () => {
		it("should parse --key value flags", () => {
			const result = parseArgs(["--model", "opus"]);
			expect(result.flags).toEqual({ model: "opus" });
			expect(result.positional).toEqual([]);
		});

		it("should parse multiple --key value flags", () => {
			const result = parseArgs(["--model", "opus", "--variations", "3"]);
			expect(result.flags).toEqual({ model: "opus", variations: "3" });
		});

		it("should parse boolean flags without values", () => {
			const result = parseArgs(["--help"]);
			expect(result.flags).toEqual({ help: "true" });
		});

		it("should parse short flags", () => {
			const result = parseArgs(["-h"]);
			expect(result.flags).toEqual({ h: "true" });
		});

		it("should handle flag key with dashes (converts to camelCase without dashes)", () => {
			const result = parseArgs(["--some-flag", "value"]);
			expect(result.flags).toEqual({ someflag: "value" });
		});

		it("should treat next arg as value unless it starts with --", () => {
			const result = parseArgs(["--flag", "--another"]);
			expect(result.flags).toEqual({ flag: "true", another: "true" });
		});
	});

	describe("positional argument parsing", () => {
		it("should capture positional arguments", () => {
			const result = parseArgs(["file.md"]);
			expect(result.positional).toEqual(["file.md"]);
		});

		it("should capture multiple positional arguments", () => {
			const result = parseArgs(["one", "two", "three"]);
			expect(result.positional).toEqual(["one", "two", "three"]);
		});

		it("should handle mixed flags and positional args", () => {
			const result = parseArgs(["--model", "opus", "my-prompt.md"]);
			expect(result.flags).toEqual({ model: "opus" });
			expect(result.positional).toEqual(["my-prompt.md"]);
		});

		it("should handle positional args before flags", () => {
			const result = parseArgs(["prompt.md", "--model", "sonnet"]);
			expect(result.flags).toEqual({ model: "sonnet" });
			expect(result.positional).toEqual(["prompt.md"]);
		});
	});

	describe("edge cases", () => {
		it("should handle empty args", () => {
			const result = parseArgs([]);
			expect(result.flags).toEqual({});
			expect(result.positional).toEqual([]);
		});

		it("should handle complex real-world example", () => {
			const result = parseArgs(["--model", "opus", "--variations", "5", "my system prompt here"]);
			expect(result.flags).toEqual({ model: "opus", variations: "5" });
			expect(result.positional).toEqual(["my system prompt here"]);
		});

		it("should handle flag at end without value", () => {
			const result = parseArgs(["file.md", "--verbose"]);
			expect(result.flags).toEqual({ verbose: "true" });
			expect(result.positional).toEqual(["file.md"]);
		});
	});
});

describe("looksLikePath", () => {
	describe("should return true for path-like strings", () => {
		it("returns true for .md files", () => {
			expect(looksLikePath("file.md")).toBe(true);
			expect(looksLikePath("my-prompt.md")).toBe(true);
			expect(looksLikePath("nested/path/file.md")).toBe(true);
		});

		it("returns true for relative paths starting with ./", () => {
			expect(looksLikePath("./file.txt")).toBe(true);
			expect(looksLikePath("./src/index.ts")).toBe(true);
		});

		it("returns true for absolute paths starting with /", () => {
			expect(looksLikePath("/usr/local/file")).toBe(true);
			expect(looksLikePath("/home/user/prompt.md")).toBe(true);
		});

		it("returns true for parent directory paths starting with ../", () => {
			expect(looksLikePath("../file.txt")).toBe(true);
			expect(looksLikePath("../../other/file")).toBe(true);
		});
	});

	describe("should return false for non-path strings", () => {
		it("returns false for plain strings", () => {
			expect(looksLikePath("hello world")).toBe(false);
			expect(looksLikePath("some text here")).toBe(false);
		});

		it("returns false for strings that look like commands", () => {
			expect(looksLikePath("npm install")).toBe(false);
			expect(looksLikePath("follow TDD practices")).toBe(false);
		});

		it("returns false for non-.md file extensions", () => {
			expect(looksLikePath("file.txt")).toBe(false);
			expect(looksLikePath("script.js")).toBe(false);
		});
	});
});
