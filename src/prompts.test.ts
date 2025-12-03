import { describe, expect, it } from "vitest";
import {
	type VariationInfo,
	type VariationResult,
	buildDesignPrompt,
	buildEvaluationPrompt,
	buildVariationArgs,
	getOutputDir,
} from "./prompts";

describe("buildDesignPrompt", () => {
	it("should include the system prompt in output", () => {
		const prompt = buildDesignPrompt("follow TDD practices", 3);

		expect(prompt).toContain("follow TDD practices");
	});

	it("should include the number of variations", () => {
		const prompt = buildDesignPrompt("test prompt", 5);

		expect(prompt).toContain("5 system prompt variations");
		expect(prompt).toContain("variation-5.md");
	});

	it("should include variation strategies", () => {
		const prompt = buildDesignPrompt("test", 3);

		expect(prompt).toContain("PERSONA");
		expect(prompt).toContain("EXEMPLAR");
		expect(prompt).toContain("CONSTRAINT");
		expect(prompt).toContain("SOCRATIC");
		expect(prompt).toContain("CHECKLIST");
	});

	it("should include output directory paths", () => {
		const prompt = buildDesignPrompt("test", 2);

		expect(prompt).toContain("task.md");
		expect(prompt).toContain("variation-1.md");
		expect(prompt).toContain("variation-2.md");
	});

	it("should include JSON output format instructions", () => {
		const prompt = buildDesignPrompt("test", 1);

		expect(prompt).toContain("```json");
		expect(prompt).toContain('"variations"');
	});

	it("should warn against reading source files", () => {
		const prompt = buildDesignPrompt("test", 1);

		expect(prompt).toContain("DO NOT");
		expect(prompt).toContain(".ts");
		expect(prompt).toContain("source files");
	});
});

describe("buildEvaluationPrompt", () => {
	const mockVariations: VariationInfo[] = [
		{ number: 1, strategy: "PERSONA", summary: "Expert role" },
		{ number: 2, strategy: "EXEMPLAR", summary: "Show by example" },
	];

	const mockResults: VariationResult[] = [
		{ variationNumber: 1, output: "Output from variation 1", exitCode: 0 },
		{ variationNumber: 2, output: "Output from variation 2", exitCode: 0 },
	];

	it("should include the original system prompt", () => {
		const prompt = buildEvaluationPrompt(
			"follow TDD",
			"Build a calculator",
			mockVariations,
			mockResults,
			"/tmp/output",
		);

		expect(prompt).toContain("follow TDD");
	});

	it("should include the task", () => {
		const prompt = buildEvaluationPrompt(
			"test",
			"Build a URL shortener",
			mockVariations,
			mockResults,
			"/tmp/output",
		);

		expect(prompt).toContain("Build a URL shortener");
	});

	it("should include variation summaries", () => {
		const prompt = buildEvaluationPrompt(
			"test",
			"task",
			mockVariations,
			mockResults,
			"/tmp/output",
		);

		expect(prompt).toContain("PERSONA");
		expect(prompt).toContain("Expert role");
		expect(prompt).toContain("EXEMPLAR");
		expect(prompt).toContain("Show by example");
	});

	it("should include results from each variation", () => {
		const prompt = buildEvaluationPrompt(
			"test",
			"task",
			mockVariations,
			mockResults,
			"/tmp/output",
		);

		expect(prompt).toContain("Output from variation 1");
		expect(prompt).toContain("Output from variation 2");
		expect(prompt).toContain("Exit code: 0");
	});

	it("should include output directory paths", () => {
		const prompt = buildEvaluationPrompt(
			"test",
			"task",
			mockVariations,
			mockResults,
			"/tmp/test-output",
		);

		expect(prompt).toContain("/tmp/test-output/run-1");
		expect(prompt).toContain("/tmp/test-output/run-2");
	});

	it("should include scoring criteria", () => {
		const prompt = buildEvaluationPrompt(
			"test",
			"task",
			mockVariations,
			mockResults,
			"/tmp/output",
		);

		expect(prompt).toContain("System Prompt Adherence");
		expect(prompt).toContain("Natural Integration");
		expect(prompt).toContain("Code Quality");
		expect(prompt).toContain("Consistency");
	});

	it("should include output format template", () => {
		const prompt = buildEvaluationPrompt(
			"test",
			"task",
			mockVariations,
			mockResults,
			"/tmp/output",
		);

		expect(prompt).toContain("## Results");
		expect(prompt).toContain("## Recommendation");
		expect(prompt).toContain("**Winner**");
		expect(prompt).toContain("Optimized Version");
	});
});

describe("getOutputDir", () => {
	it("should return a path in temp directory", () => {
		const dir = getOutputDir();

		// Should be in a temp directory
		expect(dir).toMatch(/tmp|temp|var\/folders/i);
	});

	it("should include timestamp-based identifier", () => {
		const dir = getOutputDir();

		expect(dir).toContain("claude-arena");
	});

	it("should be consistent within same process", () => {
		const dir1 = getOutputDir();
		const dir2 = getOutputDir();

		expect(dir1).toBe(dir2);
	});
});

describe("buildVariationArgs", () => {
	it("should build correct claude command args", () => {
		const args = buildVariationArgs("/tmp/task.md", "/tmp/variation-1.md");

		expect(args).toContain("claude");
		expect(args).toContain("--model");
		expect(args).toContain("haiku");
		expect(args).toContain("--print");
		expect(args).toContain("--permission-mode");
		expect(args).toContain("bypassPermissions");
	});

	it("should include task path reference", () => {
		const args = buildVariationArgs("/tmp/task.md", "/tmp/var.md");
		const taskArg = args.find((arg) => arg.includes("task.md"));

		expect(taskArg).toBeDefined();
	});

	it("should include variation path reference", () => {
		const args = buildVariationArgs("/tmp/task.md", "/tmp/variation-1.md");
		const varArg = args.find((arg) => arg.includes("variation-1.md"));

		expect(varArg).toBeDefined();
	});

	it("should include empty mcp config", () => {
		const args = buildVariationArgs("/tmp/task.md", "/tmp/var.md");
		const mcpArg = args.find((arg) => arg.includes("mcpServers"));

		expect(mcpArg).toBeDefined();
		expect(mcpArg).toContain("{}");
	});

	it("should include setting-sources flag", () => {
		const args = buildVariationArgs("/tmp/task.md", "/tmp/var.md");
		const settingsIdx = args.indexOf("--setting-sources");

		expect(settingsIdx).toBeGreaterThan(-1);
		expect(args[settingsIdx + 1]).toBe("");
	});
});
