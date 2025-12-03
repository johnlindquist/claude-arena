// src/arena.ts - Core arena runner logic, extracted for testability

import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import type { VariationInfo, VariationResult } from "./prompts";

/**
 * Configuration for running the arena
 */
export interface ArenaConfig {
	systemPrompt: string;
	task?: string; // User-provided task, or null to auto-generate
	model: string;
	testModel: string;
	variations: number;
	outputDir: string;
	userMode: boolean;
}

/**
 * Result from running a Claude session
 */
export interface ClaudeResult {
	output: string;
	exitCode: number;
	sessionId?: string;
}

/**
 * Dependencies that can be injected for testing
 */
export interface ArenaDependencies {
	runClaude: (options: RunClaudeOptions) => Promise<ClaudeResult>;
	runVariation: (options: RunVariationOptions) => Promise<VariationResult>;
	spawnInteractive: (args: string[]) => Promise<number>;
	writeFile: (path: string, content: string) => Promise<void>;
	readFile: (path: string) => Promise<string>;
	fileExists: (path: string) => Promise<boolean>;
	log: (message: string) => void;
}

export interface RunClaudeOptions {
	model: string;
	systemPrompt?: string;
	userMessage: string;
	sessionId?: string;
	resumeSessionId?: string;
}

export interface RunVariationOptions {
	variationNumber: number;
	task: string;
	variationContent: string;
	workDir: string;
	testModel: string;
	settingSources: string;
}

/**
 * Result from the complete arena run
 */
export interface ArenaResult {
	success: boolean;
	judgeSessionId: string;
	task: string;
	variationInfo: VariationInfo[];
	results: VariationResult[];
	evaluationOutput: string;
	outputDir: string;
}

/**
 * Run the arena evaluation
 */
export async function runArena(config: ArenaConfig, deps: ArenaDependencies): Promise<ArenaResult> {
	const { systemPrompt, model, testModel, variations, outputDir, userMode } = config;

	// Generate session ID for the judge
	const judgeSessionId = crypto.randomUUID();

	// Create output directory
	await mkdir(outputDir, { recursive: true });

	// Save the effective prompt
	await deps.writeFile(join(outputDir, "effective-prompt.md"), systemPrompt);

	// ============================================
	// STEP 1: Design Phase
	// ============================================
	let task: string;
	let variationInfo: VariationInfo[];
	const taskPath = join(outputDir, "task.md");

	if (config.task) {
		// User provided a task - just generate variations
		task = config.task;
		await deps.writeFile(taskPath, task);

		const { buildVariationsOnlyPrompt } = await import("./prompts");
		const designPrompt = buildVariationsOnlyPrompt(systemPrompt, variations);
		const designResult = await deps.runClaude({
			model,
			systemPrompt: designPrompt,
			userMessage: "Begin now - write all variation files.",
			sessionId: judgeSessionId,
		});

		if (designResult.exitCode !== 0) {
			throw new Error("Design phase failed");
		}

		const { parseVariationInfo } = await import("./variation-parser");
		variationInfo = parseVariationInfo(designResult.output, variations);
	} else {
		// AI generates both task and variations
		const { buildDesignPrompt } = await import("./prompts");
		const designPrompt = buildDesignPrompt(systemPrompt, variations);
		const designResult = await deps.runClaude({
			model,
			systemPrompt: designPrompt,
			userMessage: "Begin now - write the task and all variation files.",
			sessionId: judgeSessionId,
		});

		if (designResult.exitCode !== 0) {
			throw new Error("Design phase failed");
		}

		const { parseVariationInfo } = await import("./variation-parser");
		variationInfo = parseVariationInfo(designResult.output, variations);

		// Read the generated task
		if (!(await deps.fileExists(taskPath))) {
			throw new Error(`Task file not found at ${taskPath}`);
		}
		task = await deps.readFile(taskPath);
	}

	// Write the baseline (variation 0)
	const baselinePath = join(outputDir, "variation-0.md");
	await deps.writeFile(baselinePath, systemPrompt);

	// Add baseline to variationInfo
	variationInfo.unshift({
		number: 0,
		strategy: "BASELINE",
		summary: "Original system prompt without modifications",
	});

	// ============================================
	// STEP 2: Run all variations in parallel
	// ============================================
	const variationPromises: Promise<VariationResult>[] = [];

	for (let i = 0; i <= variations; i++) {
		const variationPath = join(outputDir, `variation-${i}.md`);

		if (!(await deps.fileExists(variationPath))) {
			deps.log(`⚠️  Variation ${i} file not found, skipping`);
			continue;
		}

		const variationContent = await deps.readFile(variationPath);
		const workDir = join(outputDir, `run-${i}`);
		await mkdir(workDir, { recursive: true });

		const isBaseline = i === 0;
		// In user mode, ALL variations use settingSources="user" to inherit MCP config
		// Only the baseline gets empty content (uses CLI's CLAUDE.md); variations get their content appended
		const runSettingSources = userMode ? "user" : "";
		const runAppendContent = isBaseline && userMode ? "" : variationContent;

		variationPromises.push(
			deps.runVariation({
				variationNumber: i,
				task,
				variationContent: runAppendContent,
				workDir,
				testModel,
				settingSources: runSettingSources,
			}),
		);
	}

	// Wait for all variations
	const settled = await Promise.allSettled(variationPromises);

	const results: VariationResult[] = [];
	for (const [i, outcome] of settled.entries()) {
		if (outcome.status === "fulfilled") {
			results.push(outcome.value);
		} else {
			results.push({
				variationNumber: i,
				output: `ERROR: Variation failed to run\n${outcome.reason}`,
				exitCode: 1,
			});
		}
	}

	if (results.length === 0) {
		throw new Error("No variations completed successfully");
	}

	// ============================================
	// STEP 3: Evaluate results (resume judge session)
	// ============================================
	const { buildEvaluationMessage } = await import("./prompts");
	const evaluationMessage = buildEvaluationMessage(task, variationInfo, results, outputDir);

	const evalResult = await deps.runClaude({
		model,
		userMessage: evaluationMessage,
		resumeSessionId: judgeSessionId,
	});

	return {
		success: evalResult.exitCode === 0,
		judgeSessionId,
		task,
		variationInfo,
		results,
		evaluationOutput: evalResult.output,
		outputDir,
	};
}

/**
 * Build the follow-up message for interactive session
 */
export function buildFollowUpMessage(userMode: boolean): string {
	return userMode
		? "Would you like me to apply these suggestions to ~/.claude/CLAUDE.md? I can show you a diff first, make a backup, and apply the changes."
		: "What would you like me to do with these suggestions? I can help you apply them to your system prompt, explain the reasoning further, or make adjustments.";
}
