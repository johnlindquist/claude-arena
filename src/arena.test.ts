// src/arena.test.ts - Tests for the arena runner with mocked Claude interactions

import { mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	type ArenaConfig,
	type ArenaDependencies,
	type ClaudeResult,
	type RunClaudeOptions,
	type RunVariationOptions,
	buildFollowUpMessage,
	runArena,
} from "./arena";
import type { VariationResult } from "./prompts";

// Mock output directory for tests
const testOutputDir = join(tmpdir(), `arena-test-${Date.now()}`);

// Sample outputs that mock Claude responses
const MOCK_DESIGN_OUTPUT = `I'll analyze the system prompt and create variations.

Writing task.md...
Writing variation-1.md...
Writing variation-2.md...

\`\`\`json
{
  "task": "Build a simple calculator CLI",
  "variations": [
    { "number": 1, "strategy": "PERSONA", "summary": "Expert TDD practitioner role" },
    { "number": 2, "strategy": "EXEMPLAR", "summary": "Show test-first examples" }
  ]
}
\`\`\`
`;

const MOCK_VARIATION_OUTPUT = `I'll complete this task following the system prompt guidelines.

Created calculator.ts with proper tests.

## Summary
- Wrote failing tests first
- Implemented minimal code to pass
- Refactored for clarity
`;

const MOCK_EVALUATION_OUTPUT = `## Results

### Variation 0: BASELINE (Original System Prompt)
**Project**: \`${testOutputDir}/run-0\`

The baseline output followed TDD principles adequately.
Scores: Adherence=2, Integration=2, Quality=2, Consistency=2
Total: 8/12

### Variation 1: PERSONA
**Project**: \`${testOutputDir}/run-1\`

The persona variation showed stronger TDD adherence.
Scores: Adherence=3, Integration=3, Quality=2, Consistency=3
Total: 11/12
Improvement over baseline: +3 points

### Variation 2: EXEMPLAR
**Project**: \`${testOutputDir}/run-2\`

The exemplar variation was effective.
Scores: Adherence=3, Integration=2, Quality=3, Consistency=2
Total: 10/12
Improvement over baseline: +2 points

## Recommendation

**Winner**: Variation 1 (PERSONA)
**Score**: 11/12
**Improvement over Baseline**: +3 points

**Why it worked**:
- The expert persona framing created stronger commitment to TDD
- Natural language felt more authentic

**Optimized Version**:
\`\`\`markdown
You are a battle-hardened TDD practitioner who has seen too many production bugs.
You MUST write tests before any implementation code.
\`\`\`
`;

describe("runArena", () => {
	let mockDeps: ArenaDependencies;
	let writtenFiles: Map<string, string>;
	let runClaudeCalls: RunClaudeOptions[];
	let runVariationCalls: RunVariationOptions[];

	beforeEach(async () => {
		// Create test output directory
		await mkdir(testOutputDir, { recursive: true });

		// Track written files
		writtenFiles = new Map();
		runClaudeCalls = [];
		runVariationCalls = [];

		// Create mock dependencies
		mockDeps = {
			runClaude: vi.fn(async (options: RunClaudeOptions): Promise<ClaudeResult> => {
				runClaudeCalls.push(options);

				// First call is design phase, second is evaluation
				if (options.sessionId && !options.resumeSessionId) {
					// Design phase - also write the task and variation files
					await mockDeps.writeFile(join(testOutputDir, "task.md"), "Build a simple calculator CLI");
					await mockDeps.writeFile(
						join(testOutputDir, "variation-1.md"),
						"You are an expert TDD practitioner...",
					);
					await mockDeps.writeFile(
						join(testOutputDir, "variation-2.md"),
						"Example: ❌ BAD: code first ✅ GOOD: test first",
					);
					return {
						output: MOCK_DESIGN_OUTPUT,
						exitCode: 0,
						sessionId: options.sessionId,
					};
				}
				if (options.resumeSessionId) {
					// Evaluation phase
					return {
						output: MOCK_EVALUATION_OUTPUT,
						exitCode: 0,
						sessionId: options.resumeSessionId,
					};
				}
				return { output: "", exitCode: 0 };
			}),

			runVariation: vi.fn(async (options: RunVariationOptions): Promise<VariationResult> => {
				runVariationCalls.push(options);
				return {
					variationNumber: options.variationNumber,
					output: MOCK_VARIATION_OUTPUT,
					exitCode: 0,
				};
			}),

			spawnInteractive: vi.fn(async () => 0),

			writeFile: vi.fn(async (path: string, content: string) => {
				writtenFiles.set(path, content);
				await Bun.write(path, content);
			}),

			readFile: vi.fn(async (path: string) => {
				const cached = writtenFiles.get(path);
				if (cached) return cached;
				return Bun.file(path).text();
			}),

			fileExists: vi.fn(async (path: string) => {
				if (writtenFiles.has(path)) return true;
				return Bun.file(path).exists();
			}),

			log: vi.fn(),
		};
	});

	afterEach(async () => {
		// Clean up test directory
		try {
			await rm(testOutputDir, { recursive: true, force: true });
		} catch {
			// Ignore cleanup errors
		}
	});

	it("should complete a full arena run with mocked Claude", async () => {
		const config: ArenaConfig = {
			systemPrompt: "Follow TDD practices strictly",
			model: "opus",
			testModel: "haiku",
			variations: 2,
			outputDir: testOutputDir,
			userMode: false,
		};

		const result = await runArena(config, mockDeps);

		expect(result.success).toBe(true);
		expect(result.judgeSessionId).toBeDefined();
		expect(result.task).toBe("Build a simple calculator CLI");
		expect(result.variationInfo).toHaveLength(3); // baseline + 2 variations
		expect(result.results).toHaveLength(3);
		expect(result.evaluationOutput).toContain("Variation 1 (PERSONA)");
	});

	it("should call design phase with correct session ID", async () => {
		const config: ArenaConfig = {
			systemPrompt: "Test prompt",
			model: "opus",
			testModel: "haiku",
			variations: 2,
			outputDir: testOutputDir,
			userMode: false,
		};

		await runArena(config, mockDeps);

		// First call should be design phase with sessionId
		const firstCall = runClaudeCalls[0];
		expect(firstCall).toBeDefined();
		expect(firstCall?.sessionId).toBeDefined();
		expect(firstCall?.systemPrompt).toContain("VARIATION DESIGNER");
	});

	it("should resume the same session for evaluation", async () => {
		const config: ArenaConfig = {
			systemPrompt: "Test prompt",
			model: "opus",
			testModel: "haiku",
			variations: 2,
			outputDir: testOutputDir,
			userMode: false,
		};

		await runArena(config, mockDeps);

		// Second call should resume the same session
		const firstCall = runClaudeCalls[0];
		const secondCall = runClaudeCalls[1];
		expect(firstCall).toBeDefined();
		expect(secondCall).toBeDefined();
		const designSessionId = firstCall?.sessionId;
		expect(secondCall?.resumeSessionId).toBe(designSessionId);
		expect(secondCall?.sessionId).toBeUndefined();
	});

	it("should run all variations in parallel", async () => {
		const config: ArenaConfig = {
			systemPrompt: "Test prompt",
			model: "opus",
			testModel: "haiku",
			variations: 2,
			outputDir: testOutputDir,
			userMode: false,
		};

		await runArena(config, mockDeps);

		// Should have called runVariation for baseline + 2 variations
		expect(runVariationCalls).toHaveLength(3);
		expect(runVariationCalls.map((c) => c.variationNumber)).toEqual([0, 1, 2]);
	});

	it("should use user-provided task when specified", async () => {
		// Override runClaude to NOT write task.md (since user provides it)
		mockDeps.runClaude = vi.fn(async (options: RunClaudeOptions): Promise<ClaudeResult> => {
			runClaudeCalls.push(options);

			if (options.sessionId && !options.resumeSessionId) {
				// Design phase with user task - only write variations, not task
				await mockDeps.writeFile(
					join(testOutputDir, "variation-1.md"),
					"You are an expert TDD practitioner...",
				);
				await mockDeps.writeFile(
					join(testOutputDir, "variation-2.md"),
					"Example: ❌ BAD: code first ✅ GOOD: test first",
				);
				return {
					output: MOCK_DESIGN_OUTPUT,
					exitCode: 0,
					sessionId: options.sessionId,
				};
			}
			if (options.resumeSessionId) {
				return {
					output: MOCK_EVALUATION_OUTPUT,
					exitCode: 0,
					sessionId: options.resumeSessionId,
				};
			}
			return { output: "", exitCode: 0 };
		});

		const config: ArenaConfig = {
			systemPrompt: "Test prompt",
			task: "Build a REST API",
			model: "opus",
			testModel: "haiku",
			variations: 2,
			outputDir: testOutputDir,
			userMode: false,
		};

		const result = await runArena(config, mockDeps);

		expect(result.task).toBe("Build a REST API");
		// Should write task.md with user-provided task (written by arena, not mock)
		expect(writtenFiles.get(join(testOutputDir, "task.md"))).toBe("Build a REST API");
	});

	it("should include baseline as variation 0", async () => {
		const config: ArenaConfig = {
			systemPrompt: "My system prompt",
			model: "opus",
			testModel: "haiku",
			variations: 2,
			outputDir: testOutputDir,
			userMode: false,
		};

		const result = await runArena(config, mockDeps);

		expect(result.variationInfo[0]).toEqual({
			number: 0,
			strategy: "BASELINE",
			summary: "Original system prompt without modifications",
		});

		// Baseline should be written to variation-0.md
		expect(writtenFiles.get(join(testOutputDir, "variation-0.md"))).toBe("My system prompt");
	});

	it("should handle userMode correctly for baseline", async () => {
		const config: ArenaConfig = {
			systemPrompt: "User config content",
			model: "opus",
			testModel: "haiku",
			variations: 2,
			outputDir: testOutputDir,
			userMode: true,
		};

		await runArena(config, mockDeps);

		// Baseline in user mode should use settingSources="user"
		const baselineCall = runVariationCalls.find((c) => c.variationNumber === 0);
		expect(baselineCall?.settingSources).toBe("user");
		expect(baselineCall?.variationContent).toBe(""); // Empty in user mode

		// Other variations should be isolated
		const var1Call = runVariationCalls.find((c) => c.variationNumber === 1);
		expect(var1Call?.settingSources).toBe("");
	});

	it("should write effective prompt to output directory", async () => {
		const config: ArenaConfig = {
			systemPrompt: "My effective prompt",
			model: "opus",
			testModel: "haiku",
			variations: 2,
			outputDir: testOutputDir,
			userMode: false,
		};

		await runArena(config, mockDeps);

		expect(writtenFiles.get(join(testOutputDir, "effective-prompt.md"))).toBe(
			"My effective prompt",
		);
	});

	it("should extract optimized version from evaluation", async () => {
		const config: ArenaConfig = {
			systemPrompt: "Test",
			model: "opus",
			testModel: "haiku",
			variations: 2,
			outputDir: testOutputDir,
			userMode: false,
		};

		const result = await runArena(config, mockDeps);

		expect(result.evaluationOutput).toContain("Optimized Version");
		expect(result.evaluationOutput).toContain("battle-hardened TDD practitioner");
	});
});

describe("buildFollowUpMessage", () => {
	it("should return user-mode message when userMode is true", () => {
		const message = buildFollowUpMessage(true);

		expect(message).toContain("~/.claude/CLAUDE.md");
		expect(message).toContain("apply these suggestions");
		expect(message).toContain("backup");
	});

	it("should return generic message when userMode is false", () => {
		const message = buildFollowUpMessage(false);

		expect(message).toContain("What would you like me to do");
		expect(message).toContain("explain the reasoning");
		expect(message).not.toContain("CLAUDE.md");
	});
});

describe("Arena error handling", () => {
	let mockDeps: ArenaDependencies;

	beforeEach(async () => {
		await mkdir(testOutputDir, { recursive: true });

		mockDeps = {
			runClaude: vi.fn(async () => ({ output: "", exitCode: 1 })),
			runVariation: vi.fn(async () => ({ variationNumber: 0, output: "", exitCode: 0 })),
			spawnInteractive: vi.fn(async () => 0),
			writeFile: vi.fn(async () => {}),
			readFile: vi.fn(async () => ""),
			fileExists: vi.fn(async () => true),
			log: vi.fn(),
		};
	});

	afterEach(async () => {
		try {
			await rm(testOutputDir, { recursive: true, force: true });
		} catch {
			// Ignore
		}
	});

	it("should throw when design phase fails", async () => {
		const config: ArenaConfig = {
			systemPrompt: "Test",
			model: "opus",
			testModel: "haiku",
			variations: 2,
			outputDir: testOutputDir,
			userMode: false,
		};

		await expect(runArena(config, mockDeps)).rejects.toThrow("Design phase failed");
	});

	it("should handle variation failures gracefully", async () => {
		// Make design phase succeed
		let callCount = 0;
		mockDeps.runClaude = vi.fn(async (options) => {
			callCount++;
			if (callCount === 1) {
				// Design phase
				await mockDeps.writeFile(join(testOutputDir, "task.md"), "Test task");
				await mockDeps.writeFile(join(testOutputDir, "variation-1.md"), "Var 1");
				await mockDeps.writeFile(join(testOutputDir, "variation-2.md"), "Var 2");
				return {
					output: MOCK_DESIGN_OUTPUT,
					exitCode: 0,
					sessionId: options.sessionId,
				};
			}
			// Evaluation phase
			return { output: "Evaluation complete", exitCode: 0 };
		});

		// Make variations fail - simulate async rejection
		mockDeps.runVariation = vi.fn(async (options): Promise<VariationResult> => {
			// Small delay to ensure promise is collected before rejection
			await new Promise((resolve) => setTimeout(resolve, 1));
			if (options.variationNumber === 1) {
				throw new Error("Variation 1 crashed");
			}
			return {
				variationNumber: options.variationNumber,
				output: "Success",
				exitCode: 0,
			};
		});

		mockDeps.writeFile = vi.fn(async (path, content) => {
			await Bun.write(path, content);
		});
		mockDeps.readFile = vi.fn(async (path) => Bun.file(path).text());
		mockDeps.fileExists = vi.fn(async (path) => Bun.file(path).exists());

		const config: ArenaConfig = {
			systemPrompt: "Test",
			model: "opus",
			testModel: "haiku",
			variations: 2,
			outputDir: testOutputDir,
			userMode: false,
		};

		const result = await runArena(config, mockDeps);

		// Should still complete with partial results
		expect(result.success).toBe(true);
		expect(result.results).toHaveLength(3);

		// Failed variation should have error output
		const failedResult = result.results.find((r) => r.variationNumber === 1);
		expect(failedResult?.output).toContain("ERROR");
		expect(failedResult?.exitCode).toBe(1);
	});
});
