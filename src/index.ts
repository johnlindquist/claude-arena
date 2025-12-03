#!/usr/bin/env bun
// src/index.ts

import { mkdir } from "node:fs/promises";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import ora from "ora";
import pc from "picocolors";
import { looksLikePath, parseArgs } from "./args-parser";
import { resolveImports } from "./import-resolver";
import { confirm, selectOption } from "./prompt-input";
import {
	type VariationInfo,
	type VariationResult,
	buildDesignPrompt,
	buildEvaluationPrompt,
	buildVariationsOnlyPrompt,
	getOutputDir,
} from "./prompts";
import {
	type StreamParserState,
	accumulateTextFromEvent,
	createStreamParserState,
	extractToolUses,
	extractUsageStats,
	formatToolUse,
	formatUsageStats,
	parseStreamLine,
	processStreamChunk,
} from "./stream-parser";
import { parseVariationInfo } from "./variation-parser";

/**
 * Parse stream-json output from Claude CLI.
 * Format: {"type":"assistant","message":{"content":[...]}} per line
 */
async function parseStreamJson(
	stream: ReadableStream,
	destination: NodeJS.WriteStream,
): Promise<string> {
	const reader = stream.getReader();
	const decoder = new TextDecoder();
	const state = createStreamParserState();
	const seenToolIds = new Set<string>();
	let shownModel = false;

	try {
		while (true) {
			const { done, value } = await reader.read();
			if (done) break;

			const chunk = decoder.decode(value, { stream: true });
			const lines = processStreamChunk(state, chunk);

			for (const line of lines) {
				const event = parseStreamLine(line);
				if (!event) continue;

				// Show system init info (model, tools available)
				if (event.type === "system" && event.subtype === "init") {
					const model = event.model || "unknown";
					const toolCount = event.tools?.length || 0;
					destination.write(`   🤖 Model: ${model} (${toolCount} tools)\n`);
				}

				// Handle assistant messages
				if (event.type === "assistant" && event.message?.content) {
					// Show model on first assistant message if not shown yet
					if (!shownModel && event.message?.model) {
						shownModel = true;
					}

					// Accumulate text content
					const newText = accumulateTextFromEvent(state, event);
					if (newText) {
						destination.write(newText);
					}

					// Show tool activity
					const toolUses = extractToolUses(event);
					for (const tool of toolUses) {
						if (!seenToolIds.has(tool.id)) {
							seenToolIds.add(tool.id);
							destination.write(`   ${formatToolUse(tool.name, tool.filePath)}\n`);
						}
					}

					// Show usage stats on end_turn
					const usage = extractUsageStats(event);
					if (usage) {
						destination.write(`\n   ${formatUsageStats(usage)}\n`);
					}
				}

				// Handle user messages with tool results
				if (event.type === "user" && event.toolUseResult) {
					const result = event.toolUseResult;
					if (result.filePath) {
						destination.write(`   ✅ Created: ${result.filePath}\n`);
					}
				}
			}
		}

		// Process remaining buffer
		if (state.buffer.trim()) {
			const event = parseStreamLine(state.buffer);
			if (event) {
				accumulateTextFromEvent(state, event);
			}
		}
	} finally {
		reader.releaseLock();
	}

	return state.fullContent;
}

/**
 * Parse stream-json output with a spinner instead of streaming all text.
 * Shows tool activity and file writes on the spinner, suppresses verbose text.
 */
async function parseStreamJsonWithSpinner(
	stream: ReadableStream,
	spinner: ReturnType<typeof ora>,
): Promise<string> {
	const reader = stream.getReader();
	const decoder = new TextDecoder();
	const state = createStreamParserState();
	const seenToolIds = new Set<string>();
	const writtenFiles: string[] = [];

	try {
		while (true) {
			const { done, value } = await reader.read();
			if (done) break;

			const chunk = decoder.decode(value, { stream: true });
			const lines = processStreamChunk(state, chunk);

			for (const line of lines) {
				const event = parseStreamLine(line);
				if (!event) continue;

				// Handle assistant messages
				if (event.type === "assistant" && event.message?.content) {
					// Accumulate text content (but don't display it)
					accumulateTextFromEvent(state, event);

					// Show tool activity on spinner
					const toolUses = extractToolUses(event);
					for (const tool of toolUses) {
						if (!seenToolIds.has(tool.id)) {
							seenToolIds.add(tool.id);
							const shortPath = tool.filePath?.split("/").pop() || "";
							if (tool.name === "Write" && shortPath) {
								spinner.text = `Writing ${pc.cyan(shortPath)}...`;
							} else if (shortPath) {
								spinner.text = `${tool.name}: ${pc.dim(shortPath)}`;
							} else {
								spinner.text = `${tool.name}...`;
							}
						}
					}
				}

				// Handle user messages with tool results (file created confirmations)
				if (event.type === "user" && event.toolUseResult) {
					const result = event.toolUseResult;
					if (result.filePath) {
						const shortPath = result.filePath.split("/").pop() || result.filePath;
						writtenFiles.push(shortPath);
						spinner.text = `${pc.green("✓")} Created ${pc.cyan(shortPath)} (${writtenFiles.length} files)`;
					}
				}
			}
		}

		// Process remaining buffer
		if (state.buffer.trim()) {
			const event = parseStreamLine(state.buffer);
			if (event && event.type === "assistant" && event.message?.content) {
				accumulateTextFromEvent(state, event);
			}
		}
	} finally {
		reader.releaseLock();
	}

	return state.fullContent;
}

/**
 * Simple tee helper - reads a stream, writes to destination, captures content.
 * Used for stderr or non-stream-json output.
 */
async function teeStream(stream: ReadableStream, destination: NodeJS.WriteStream): Promise<string> {
	const reader = stream.getReader();
	const decoder = new TextDecoder();
	let fullContent = "";

	try {
		while (true) {
			const { done, value } = await reader.read();
			if (done) break;

			const chunk = decoder.decode(value, { stream: true });
			fullContent += chunk;
			destination.write(chunk);
		}
	} finally {
		reader.releaseLock();
	}

	return fullContent;
}

/**
 * Parse stream-json output with status callback for progress display.
 * Reports tool names and text snippets via callback.
 */
async function parseStreamJsonWithStatus(
	stream: ReadableStream,
	onStatus?: (status: string) => void,
): Promise<string> {
	const reader = stream.getReader();
	const decoder = new TextDecoder();
	const state = createStreamParserState();
	const seenToolIds = new Set<string>();

	try {
		while (true) {
			const { done, value } = await reader.read();
			if (done) break;

			const chunk = decoder.decode(value, { stream: true });
			const lines = processStreamChunk(state, chunk);

			for (const line of lines) {
				const event = parseStreamLine(line);
				if (!event) continue;

				// Handle assistant messages
				if (event.type === "assistant" && event.message?.content) {
					const msgId = event.message.id || event.uuid || "";

					for (let i = 0; i < event.message.content.length; i++) {
						const block = event.message.content[i];
						if (!block) continue;

						// Capture text content
						if (block.type === "text" && block.text) {
							const textKey = `${msgId}-text-${i}`;
							if (!state.seenTextIds.has(textKey)) {
								state.seenTextIds.add(textKey);
								state.fullContent += block.text;
								// Report first 20 chars of text as status
								const preview = block.text.slice(0, 20).replace(/\n/g, " ").trim();
								if (preview) {
									onStatus?.(preview + (block.text.length > 20 ? "…" : ""));
								}
							}
						}

						// Report tool usage
						if (block.type === "tool_use" && block.id && !seenToolIds.has(block.id)) {
							seenToolIds.add(block.id);
							const toolName = block.name || "Tool";
							const filePath =
								block.input?.file_path || block.input?.path || block.input?.command || "";
							const shortPath = filePath.split("/").pop()?.slice(0, 15) || "";
							onStatus?.(shortPath ? `${toolName}:${shortPath}` : toolName);
						}
					}
				}
			}
		}

		// Process remaining buffer
		if (state.buffer.trim()) {
			const event = parseStreamLine(state.buffer);
			if (event && event.type === "assistant" && event.message?.content) {
				for (const block of event.message.content) {
					if (block.type === "text" && block.text) {
						state.fullContent += block.text;
					}
				}
			}
		}
	} finally {
		reader.releaseLock();
	}

	return state.fullContent;
}

async function main() {
	const { flags, positional } = parseArgs(process.argv.slice(2));

	// Handle --help
	if (flags.help || flags.h) {
		console.log(`
claude-arena - Evaluate and optimize system prompt effectiveness

Usage: claude-arena [system-prompt|file.md] [options]

The judge will:
  1. Generate a task that reveals system prompt adherence
  2. Create variations of your system prompt (persona, exemplar, constraint, socratic, checklist)
  3. Run baseline (original prompt) + all variations against the task (in parallel)
  4. Evaluate results and recommend the best approach vs baseline

Arguments:
  system-prompt           The system prompt to evaluate (string or path to .md file)
                          Optional if using --user mode

Options:
  --model <model>         Judge model: opus, sonnet (default: opus)
  --test-model <model>    Model for running variations (default: haiku)
  --variations <n>        Number of variations to test (default: 5)
  --user                  Test your ~/.claude/CLAUDE.md configuration
                          If combined with a prompt, appends to your config
  --task <task>           Provide a specific task instead of AI-generated one
  --debug                 Write resolved system prompt to output dir for inspection
  --help                  Show this help

Examples:
  claude-arena "code should follow Python's Zen principles"
  claude-arena ./goals/zen-principles.md
  claude-arena --user                              # Test your CLAUDE.md
  claude-arena --user "also enforce TDD"           # Append to your config
  claude-arena --task "build a REST API" "use TypeScript strictly"
  claude-arena --test-model sonnet "complex prompt"
`);
		process.exit(0);
	}

	// Parse flags
	const userMode = flags.user === "true";
	const userTask = flags.task || null;
	const testModel = flags.testmodel || "haiku";
	const model = flags.model || "opus";
	const variations = Number(flags.variations) || 5;
	const debugMode = flags.debug === "true";
	const outputDir = getOutputDir();

	// Get the system prompt from positional args
	const promptArg = positional.join(" ");

	// Build the system prompt based on mode
	let systemPrompt: string;
	let settingSources: string;

	if (userMode) {
		// User mode: read ~/.claude/CLAUDE.md
		const claudeMdPath = join(homedir(), ".claude", "CLAUDE.md");
		const claudeMdFile = Bun.file(claudeMdPath);

		if (!(await claudeMdFile.exists())) {
			console.error(`❌ CLAUDE.md not found at ${claudeMdPath}`);
			console.error("\nUser mode requires ~/.claude/CLAUDE.md to exist.");
			process.exit(1);
		}

		const rawConfig = await claudeMdFile.text();
		// Resolve @filepath imports (e.g., @~/.claude/preferences.md)
		const userConfig = await resolveImports(rawConfig, claudeMdPath);
		console.log(`📄 Loaded user config from: ${claudeMdPath}`);

		if (promptArg) {
			// Append additional prompt to user config
			systemPrompt = `${userConfig}\n\n---\n\n## Additional Instructions\n\n${promptArg}`;
			console.log(
				`   + Appending: "${promptArg.slice(0, 50)}${promptArg.length > 50 ? "..." : ""}"`,
			);
		} else {
			systemPrompt = userConfig;
		}

		// Use user's settings when running variations
		settingSources = "user";
	} else {
		// Standard mode: require a prompt
		if (!promptArg) {
			console.error("❌ Please provide a system prompt to evaluate");
			console.error('\nExample: claude-arena "code should follow Python\'s Zen principles"');
			console.error("         claude-arena ./my-system-prompt.md");
			console.error("         claude-arena --user  # to test your CLAUDE.md");
			process.exit(1);
		}

		// Check if it's a file path
		if (looksLikePath(promptArg)) {
			const resolvedPath = resolve(promptArg);
			const isFile = await Bun.file(resolvedPath).exists();
			if (!isFile) {
				console.error(`❌ File not found: ${promptArg}`);
				process.exit(1);
			}
			const rawContent = await Bun.file(resolvedPath).text();
			// Resolve @filepath imports if present
			systemPrompt = await resolveImports(rawContent, resolvedPath);
			console.log(`📄 Loaded system prompt from: ${promptArg}`);
		} else {
			systemPrompt = promptArg;
		}

		// Isolated settings for standard mode
		settingSources = "";
	}

	// Truncate system prompt for display
	const promptDisplay =
		systemPrompt.length > 60
			? `${systemPrompt.slice(0, 60).replace(/\n/g, " ")}...`
			: systemPrompt.replace(/\n/g, " ");

	console.log("");
	console.log(
		pc.bold(pc.cyan("🏟️  claude-arena")) + pc.dim(" - System Prompt Effectiveness Evaluator"),
	);
	console.log(pc.dim("━".repeat(60)));
	console.log(`${pc.bold("Prompt:")}     ${promptDisplay}`);
	console.log(`${pc.bold("Judge:")}      ${model}. ${pc.dim("Adjust with --model <model>")}`);
	console.log(
		`${pc.bold("Test model:")} ${testModel}. ${pc.dim("Adjust with --test-model <model>")}`,
	);
	console.log(`${pc.bold("Variations:")} ${variations}. ${pc.dim("Adjust with --variations <n>")}`);
	if (userMode) {
		console.log(`${pc.bold("Mode:")}       ${pc.green("user")} (testing ~/.claude/CLAUDE.md)`);
	}
	if (userTask) {
		console.log(`${pc.bold("Task:")}       ${pc.yellow("user-provided")}`);
	}
	console.log(pc.dim("━".repeat(60)));
	console.log("");
	console.log(`📁 ${pc.dim("Output directory:")} ${pc.underline(outputDir)}`);

	// Create output directory
	await mkdir(outputDir, { recursive: true });

	// Debug mode: write resolved system prompt to file for inspection
	if (debugMode) {
		const debugPromptPath = join(outputDir, "debug-resolved-prompt.md");
		await Bun.write(debugPromptPath, systemPrompt);
		console.log(`\n🔍 Debug: Resolved system prompt written to: ${debugPromptPath}`);
		console.log(`   Length: ${systemPrompt.length} characters`);
		console.log(
			`   Contains unresolved @imports: ${systemPrompt.includes("@~/") || systemPrompt.includes("@./")}`,
		);
	}

	// ============================================
	// Check for large system prompts
	// ============================================
	const LARGE_PROMPT_THRESHOLD = 15000; // characters

	if (systemPrompt.length > LARGE_PROMPT_THRESHOLD) {
		console.log("");
		console.log(
			pc.yellow(
				`⚠️  Large system prompt detected: ${pc.bold(systemPrompt.length.toLocaleString())} characters`,
			),
		);
		console.log("");
		console.log(pc.dim("   Context constraints may affect results. For better stress testing,"));
		console.log(pc.dim("   consider testing a specific section of your system prompt rather"));
		console.log(pc.dim("   than the entire configuration."));
		console.log("");

		const selection = await selectOption("How would you like to proceed?", [
			"Continue with the full system prompt",
			"Have the judge suggest a focused section to test",
			"Describe the section you want to test",
			"Cancel and provide a smaller prompt manually",
		]);

		if (selection === 3) {
			console.log("\n👋 Cancelled. Try running with a specific section of your prompt:");
			console.log('   claude-arena "your specific rules here"');
			console.log("   claude-arena ./path/to/focused-rules.md");
			process.exit(0);
		}

		if (selection === 2) {
			const { prompt } = await import("./prompt-input");
			console.log("");
			const userDescription = await prompt("Describe the section you want to test: ");

			if (!userDescription.trim()) {
				console.log("⚠️  No description provided, continuing with full prompt");
			} else {
				console.log(`\n🔍 Finding section matching: "${userDescription}"...\n`);

				const extractPrompt = `You are extracting a specific section from a large system prompt based on a user's description.

<system-prompt>
${systemPrompt}
</system-prompt>

The user wants to test this section: "${userDescription}"

Find and extract the relevant rules/instructions from the system prompt that match what the user described.
Include any related rules that are closely connected to the described section.
Keep the extraction focused but complete enough to be testable.

Format your response as:

## Matched Section

[Explain what you found and why it matches - 2-3 sentences]

## Extracted Rules

\`\`\`
[The extracted rules/instructions to test]
\`\`\`

## Related Rules Also Included

[Brief note on any related rules you included for completeness]`;

				const extractResult = await runClaude({
					model,
					systemPrompt: extractPrompt,
					userMessage: "Find and extract the described section.",
					streamOutput: true,
				});

				if (extractResult.exitCode !== 0) {
					console.error("\n❌ Failed to extract section");
				} else {
					const extractedMatch = extractResult.output.match(/```\n?([\s\S]*?)\n?```/);
					if (extractedMatch?.[1]) {
						const extractedPrompt = extractedMatch[1].trim();
						console.log(
							`\n📋 Extracted section: ${extractedPrompt.length.toLocaleString()} characters`,
						);

						const useExtracted = await confirm("\nUse this extracted section?", true);
						if (useExtracted) {
							systemPrompt = extractedPrompt;
							console.log("✅ Using extracted section");
						} else {
							console.log("📄 Continuing with full prompt");
						}
					} else {
						console.log("⚠️  Could not extract section, continuing with full prompt");
					}
				}
			}
		}

		if (selection === 1) {
			console.log("\n🔍 Asking judge to suggest a focused section to test...\n");

			const suggestionPrompt = `You are analyzing a large system prompt to suggest the most valuable section to stress test.

<system-prompt>
${systemPrompt}
</system-prompt>

Analyze this system prompt and identify:
1. The MOST UNIQUE/SPECIFIC rules (not generic best practices)
2. Rules that would benefit most from stress testing
3. Rules that have clear tool preferences or workflow requirements

Output a focused subset (under 5000 characters) that contains the highest-value rules to test.
Format your response as:

## Suggested Focus Area

[Explain why you selected this section - 2-3 sentences]

## Focused System Prompt

\`\`\`
[The focused subset of rules to test]
\`\`\`

## Rules Excluded

[Brief list of what was left out and why]`;

			const suggestionResult = await runClaude({
				model,
				systemPrompt: suggestionPrompt,
				userMessage: "Analyze and suggest a focused section.",
				streamOutput: true,
			});

			if (suggestionResult.exitCode !== 0) {
				console.error("\n❌ Failed to get suggestion");
				process.exit(1);
			}

			// Extract the focused prompt from the response
			const focusedMatch = suggestionResult.output.match(/```\n?([\s\S]*?)\n?```/);
			if (focusedMatch?.[1]) {
				const focusedPrompt = focusedMatch[1].trim();
				console.log(
					`\n📋 Suggested focused prompt: ${focusedPrompt.length.toLocaleString()} characters`,
				);

				const useFocused = await confirm("\nUse this focused prompt instead?", true);
				if (useFocused) {
					systemPrompt = focusedPrompt;
					console.log("✅ Using focused prompt");
				} else {
					console.log("📄 Continuing with full prompt");
				}
			} else {
				console.log("⚠️  Could not extract focused prompt, continuing with full prompt");
			}
		}

		// selection === 0 means continue with full prompt, no action needed
		if (selection === 0) {
			console.log("\n📄 Continuing with full system prompt...");
		}
	}

	// Save the effective prompt that will be tested (especially important if focused)
	const effectivePromptPath = join(outputDir, "effective-prompt.md");
	await Bun.write(effectivePromptPath, systemPrompt);

	// Show token estimate (rough: ~4 chars per token)
	const estimatedTokens = Math.ceil(systemPrompt.length / 4);
	console.log(
		`\n📊 ${pc.dim("Testing prompt:")} ${pc.bold(systemPrompt.length.toLocaleString())} chars ${pc.dim(`(~${estimatedTokens.toLocaleString()} tokens)`)}`,
	);
	console.log(`   ${pc.dim("Saved to:")} ${effectivePromptPath}`);

	// ============================================
	// STEP 1: Design Phase - Generate task and variations
	// ============================================
	let task: string;
	let variationInfo: VariationInfo[];
	const taskPath = join(outputDir, "task.md");

	if (userTask) {
		// User provided a task - just generate variations
		console.log("");
		console.log(pc.bgMagenta(pc.white(pc.bold(" STEP 1: DESIGN PHASE "))));
		console.log(pc.dim("Generating variations for user-provided task"));
		console.log("");
		console.log(pc.bgYellow(pc.black(" ⏳ Please be patient - this may take 3-5 minutes... ")));
		console.log(pc.dim("   The judge is analyzing your prompt and creating strategic variations."));
		console.log(pc.dim("─".repeat(60)));
		console.log("");

		task = userTask;
		await Bun.write(taskPath, task);
		console.log(`   📝 ${pc.dim("Using user-provided task")}`);

		const designPrompt = buildVariationsOnlyPrompt(systemPrompt, variations);
		const designResult = await runClaude({
			model,
			systemPrompt: designPrompt,
			userMessage: "Begin now - write all variation files.",
			useSpinner: true,
			spinnerText: "Analyzing prompt and generating variations...",
		});

		if (designResult.exitCode !== 0) {
			console.error(`\n${pc.red("❌ Design phase failed")}`);
			process.exit(1);
		}

		variationInfo = parseVariationInfo(designResult.output, variations);
	} else {
		// AI generates both task and variations
		console.log("");
		console.log(pc.bgMagenta(pc.white(pc.bold(" STEP 1: DESIGN PHASE "))));
		console.log(pc.dim("Designing task and variations to stress-test your prompt"));
		console.log("");
		console.log(pc.bgYellow(pc.black(" ⏳ Please be patient - this may take 3-5 minutes... ")));
		console.log(pc.dim("   The judge is analyzing your prompt, designing a revealing task,"));
		console.log(pc.dim("   and creating strategic variations to test different approaches."));
		console.log(pc.dim("─".repeat(60)));
		console.log("");

		const designPrompt = buildDesignPrompt(systemPrompt, variations);
		const designResult = await runClaude({
			model,
			systemPrompt: designPrompt,
			userMessage: "Begin now - write the task and all variation files.",
			useSpinner: true,
			spinnerText: "Analyzing prompt, designing task, and generating variations...",
		});

		if (designResult.exitCode !== 0) {
			console.error(`\n${pc.red("❌ Design phase failed")}`);
			process.exit(1);
		}

		variationInfo = parseVariationInfo(designResult.output, variations);

		// Read the generated task
		const taskFile = Bun.file(taskPath);
		if (!(await taskFile.exists())) {
			console.error(`\n${pc.red("❌ Task file not found at")} ${taskPath}`);
			process.exit(1);
		}
		task = await taskFile.text();
	}

	// Write the baseline (variation 0) - original system prompt as-is
	const baselinePath = join(outputDir, "variation-0.md");
	await Bun.write(baselinePath, systemPrompt);

	// Add baseline to variationInfo at the beginning
	variationInfo.unshift({
		number: 0,
		strategy: "BASELINE",
		summary: "Original system prompt without modifications",
	});

	console.log(`\n${pc.green("✅ Design phase complete")}`);
	console.log(`   ${pc.dim("Task:")} ${taskPath}`);
	console.log(`   ${pc.dim("Variations:")} ${variations} + baseline (variation 0) generated`);

	// ============================================
	// STEP 2: Run all variations in parallel
	// ============================================
	console.log("");
	console.log(pc.bgMagenta(pc.white(pc.bold(" STEP 2: TESTING VARIATIONS "))));
	console.log(pc.dim("Running all variations in parallel against the generated task"));
	console.log("");
	console.log(pc.bgYellow(pc.black(" ⏳ Please be patient - this may take 5-10 minutes... ")));
	console.log(pc.dim("   Each variation is executing the task in an isolated sandbox."));
	console.log(pc.dim("   Progress updates will appear below as variations complete."));
	console.log("");

	const variationPromises: Promise<VariationResult>[] = [];

	// Track latest status for each variation
	const variationStatus: Map<number, string> = new Map();
	const spinner = ora({
		text: "Starting variations...",
		color: "cyan",
	}).start();

	const updateStatus = () => {
		// Build status line with truncated status per variation
		const statusLine = Array.from(variationStatus.entries())
			.sort((a, b) => a[0] - b[0])
			.map(([num, status]) => {
				const icon = status.includes("done")
					? pc.green("✓")
					: status.includes("error")
						? pc.red("✗")
						: pc.cyan("◌");
				return `${icon} ${pc.dim(`[${num}]`)} ${status.slice(0, 10)}`;
			})
			.join("  ");

		// Truncate to terminal width to prevent wrapping
		const maxWidth = (process.stdout.columns || 80) - 10;
		const truncated = statusLine.slice(0, maxWidth);

		spinner.text = truncated;
	};

	// Start from 0 (baseline) through variations count
	for (let i = 0; i <= variations; i++) {
		const variationPath = join(outputDir, `variation-${i}.md`);
		const variationFile = Bun.file(variationPath);

		if (!(await variationFile.exists())) {
			console.error(`⚠️  Variation ${i} file not found, skipping`);
			continue;
		}

		const variationContent = await variationFile.text();
		const workDir = join(outputDir, `run-${i}`);
		await mkdir(workDir, { recursive: true });

		variationStatus.set(i, "starting...");

		// Baseline (i=0) in user mode: use settingSources="user", no append (Claude CLI loads CLAUDE.md)
		// Variations (i>0): use settingSources="" (isolated), append variation content
		// Standard mode: all variations use settingSources="" with their content appended
		const isBaseline = i === 0;
		const runSettingSources = isBaseline && userMode ? "user" : "";
		const runAppendContent = isBaseline && userMode ? "" : variationContent;

		variationPromises.push(
			runVariation({
				variationNumber: i,
				task,
				variationContent: runAppendContent,
				workDir,
				testModel,
				settingSources: runSettingSources,
				onStatus: (status) => {
					variationStatus.set(i, status);
					updateStatus();
				},
			}),
		);
	}

	// Show initial status (stays on same line, updated in place)
	updateStatus();

	// Wait for all variations to complete (don't fail if some error out)
	const settled = await Promise.allSettled(variationPromises);

	// Stop spinner when complete
	spinner.stop();

	const results: VariationResult[] = [];
	let successCount = 0;
	let failCount = 0;

	console.log(`\n${pc.green("✅ Variations complete")}`);
	for (const [i, outcome] of settled.entries()) {
		if (outcome.status === "fulfilled") {
			const result = outcome.value;
			results.push(result);
			const status = result.exitCode === 0 ? pc.green("✓") : pc.yellow("⚠");
			console.log(`   ${status} Variation ${result.variationNumber}: exit ${result.exitCode}`);
			if (result.exitCode === 0) successCount++;
		} else {
			// Promise rejected - create a failure result
			const variationNumber = i + 1;
			const reason = outcome.reason;
			results.push({
				variationNumber,
				output: `ERROR: Variation failed to run\n${reason}`,
				exitCode: 1,
			});
			console.log(
				`   ${pc.red("✗")} Variation ${variationNumber}: ${pc.red("FAILED")} - ${reason}`,
			);
			failCount++;
		}
	}

	if (results.length === 0) {
		console.error(`\n${pc.red("❌ No variations completed successfully")}`);
		process.exit(1);
	}

	console.log(
		`\n   ${pc.dim("Summary:")} ${pc.green(successCount.toString())} succeeded, ${failCount > 0 ? pc.red(failCount.toString()) : pc.dim(failCount.toString())} failed`,
	);

	// ============================================
	// STEP 3: Evaluate results
	// ============================================
	console.log("");
	console.log(pc.bgMagenta(pc.white(pc.bold(" STEP 3: EVALUATION "))));
	console.log(pc.dim("Analyzing all outputs to determine which variation performed best"));
	console.log("");
	console.log(pc.bgYellow(pc.black(" ⏳ Please be patient - this may take 2-3 minutes... ")));
	console.log(pc.dim("   The judge is comparing outputs against your original intent."));
	console.log(pc.dim("─".repeat(60)));
	console.log("");

	const evaluationPrompt = buildEvaluationPrompt(
		systemPrompt,
		task,
		variationInfo,
		results,
		outputDir,
	);

	const evalSpinner = ora({
		text: "Starting evaluation...",
		color: "cyan",
	}).start();

	// Small delay then stop spinner before streaming begins
	await new Promise((resolve) => setTimeout(resolve, 500));
	evalSpinner.stopAndPersist({ symbol: "📊", text: "Evaluating results..." });

	const evalResult = await runClaude({
		model,
		systemPrompt: evaluationPrompt,
		userMessage: "Begin your evaluation.",
		streamOutput: true,
	});

	// Write session summary
	const summaryPath = join(outputDir, "session-summary.md");
	const summary = `# Claude Arena Session Summary

**Date**: ${new Date().toISOString()}
**Mode**: ${userMode ? "user (~/.claude/CLAUDE.md)" : "standard"}
**Judge Model**: ${model}
**Test Model**: ${testModel}

## Prompt Tested

- **Characters**: ${systemPrompt.length.toLocaleString()}
- **Estimated Tokens**: ~${Math.ceil(systemPrompt.length / 4).toLocaleString()}
- **Full prompt**: [effective-prompt.md](./effective-prompt.md)

## Task

[task.md](./task.md)

## Variations Tested

| # | Strategy | Result |
|---|----------|--------|
${variationInfo
	.map((v) => {
		const result = results.find((r) => r.variationNumber === v.number);
		const status = result ? (result.exitCode === 0 ? "✅" : "⚠️") : "❌";
		return `| ${v.number} | ${v.strategy} | ${status} |`;
	})
	.join("\n")}

## Output Directories

${variationInfo.map((v) => `- [run-${v.number}/](./run-${v.number}/) - ${v.strategy}`).join("\n")}
`;

	await Bun.write(summaryPath, summary);
	console.log("");
	console.log(pc.bgGreen(pc.white(pc.bold(" ✅ COMPLETE "))));
	console.log(`📋 ${pc.dim("Session summary:")} ${summaryPath}`);

	// In user mode, offer to apply the optimized prompt to CLAUDE.md
	if (userMode && evalResult.exitCode === 0) {
		console.log(`\n${"━".repeat(55)}`);

		const applySelection = await selectOption(
			"The evaluation is complete. What would you like to do?",
			[
				"Apply the optimized prompt to ~/.claude/CLAUDE.md",
				"View the recommended changes first",
				"Exit without changes",
			],
		);

		if (applySelection === 0 || applySelection === 1) {
			// Extract the optimized prompt from the evaluation output
			const optimizedMatch = evalResult.output.match(
				/\*\*Optimized Version\*\*:?\s*\n```(?:markdown)?\n([\s\S]*?)\n```/i,
			);

			if (!optimizedMatch || !optimizedMatch[1]) {
				console.log("\n⚠️  Could not find optimized prompt in evaluation output.");
				console.log("   You can manually review the evaluation and update your CLAUDE.md.");
			} else {
				const optimizedPrompt = optimizedMatch[1].trim();

				if (applySelection === 1) {
					// Show the recommended changes
					console.log("\n📝 Recommended optimized prompt:\n");
					console.log("─".repeat(50));
					console.log(optimizedPrompt);
					console.log("─".repeat(50));
					console.log(`\n(${optimizedPrompt.length.toLocaleString()} characters)\n`);

					const confirmApply = await confirm("Apply this to your ~/.claude/CLAUDE.md?", false);
					if (!confirmApply) {
						console.log("\n👋 No changes made.");
						process.exit(evalResult.exitCode);
					}
				}

				// Ask how to apply
				const applyMethod = await selectOption("How should the optimized prompt be applied?", [
					"Replace the entire CLAUDE.md with the optimized version",
					"Have the judge intelligently merge changes into existing CLAUDE.md",
					"Append as a new section at the end",
					"Cancel - don't make changes",
				]);

				if (applyMethod === 3) {
					console.log("\n👋 No changes made.");
					process.exit(evalResult.exitCode);
				}

				const claudeMdPath = join(homedir(), ".claude", "CLAUDE.md");
				const currentContent = await Bun.file(claudeMdPath).text();

				if (applyMethod === 0) {
					// Full replacement
					const backupPath = join(homedir(), ".claude", `CLAUDE.md.backup.${Date.now()}`);
					await Bun.write(backupPath, currentContent);
					await Bun.write(claudeMdPath, optimizedPrompt);
					console.log("\n✅ Applied optimized prompt to ~/.claude/CLAUDE.md");
					console.log(`   Backup saved to: ${backupPath}`);
				} else if (applyMethod === 1) {
					// Intelligent merge
					console.log("\n🔍 Asking judge to merge changes intelligently...\n");

					const mergePrompt = `You are merging an optimized system prompt into an existing CLAUDE.md file.

## Current CLAUDE.md

<current>
${currentContent}
</current>

## Optimized Prompt (from stress testing)

<optimized>
${optimizedPrompt}
</optimized>

## Your Task

Intelligently merge the optimized prompt into the current CLAUDE.md:

1. **Preserve structure** - Keep the existing organization and imports (@~/.claude/...)
2. **Update relevant sections** - Replace or enhance sections that the optimized prompt improves
3. **Don't duplicate** - If the optimized prompt covers something already in current, pick the better version
4. **Keep unrelated content** - Don't remove sections that the optimized prompt doesn't address

Output ONLY the merged CLAUDE.md content, no explanations:

\`\`\`markdown
[merged content here]
\`\`\``;

					const mergeResult = await runClaude({
						model,
						systemPrompt: mergePrompt,
						userMessage: "Merge the optimized prompt into the existing CLAUDE.md.",
						streamOutput: true,
					});

					if (mergeResult.exitCode !== 0) {
						console.error("\n❌ Failed to merge changes");
					} else {
						const mergedMatch = mergeResult.output.match(/```(?:markdown)?\n([\s\S]*?)\n```/);
						if (mergedMatch?.[1]) {
							const mergedContent = mergedMatch[1].trim();
							const backupPath = join(homedir(), ".claude", `CLAUDE.md.backup.${Date.now()}`);
							await Bun.write(backupPath, currentContent);
							await Bun.write(claudeMdPath, mergedContent);
							console.log("\n✅ Merged changes into ~/.claude/CLAUDE.md");
							console.log(`   Backup saved to: ${backupPath}`);
						} else {
							console.log("\n⚠️  Could not extract merged content. No changes made.");
						}
					}
				} else if (applyMethod === 2) {
					// Append as new section
					const appendedContent = `${currentContent}\n\n---\n\n## Optimized Rules (from claude-arena ${new Date().toISOString().split("T")[0]})\n\n${optimizedPrompt}`;
					const backupPath = join(homedir(), ".claude", `CLAUDE.md.backup.${Date.now()}`);
					await Bun.write(backupPath, currentContent);
					await Bun.write(claudeMdPath, appendedContent);
					console.log("\n✅ Appended optimized prompt to ~/.claude/CLAUDE.md");
					console.log(`   Backup saved to: ${backupPath}`);
				}
			}
		} else {
			console.log("\n👋 No changes made.");
		}
	}

	console.log(`\n${pc.dim("━".repeat(60))}`);
	console.log(pc.dim("Want to refine the results or apply the optimized prompt?"));
	console.log(`Continue interactively with: ${pc.cyan("claude --resume")}`);
	console.log(pc.dim("━".repeat(60)));

	process.exit(evalResult.exitCode);
}

interface RunVariationOptions {
	variationNumber: number;
	task: string;
	variationContent: string;
	workDir: string;
	testModel: string;
	settingSources: string;
	onStatus?: (status: string) => void;
}

/**
 * Run a single variation test
 * Uses stream-json format, captures stdout quietly to avoid interleaved parallel output
 */
async function runVariation(options: RunVariationOptions): Promise<VariationResult> {
	const { variationNumber, task, variationContent, workDir, testModel, settingSources, onStatus } =
		options;

	try {
		const settings = {
			sandbox: {
				enabled: true,
				autoAllowBashIfSandboxed: true,
			},
			permissions: {
				defaultMode: "bypassPermissions",
			},
		};

		// Build args, conditionally including --append-system-prompt only if content is non-empty
		const args = [
			"claude",
			"--model",
			testModel,
			"--print",
			"--output-format",
			"stream-json",
			"--verbose",
			`git init && complete this task in full:\n\n${task}\n\n--- CRITICAL: Once complete, diff all of the changed files. NEVER SUMMARIZE!`,
			"--permission-mode",
			"bypassPermissions",
			"--setting-sources",
			settingSources,
			"--settings",
			JSON.stringify(settings),
		];

		// Only override MCP config for isolated (non-user) variations
		// In user mode, let Claude CLI load from default locations
		if (settingSources !== "user") {
			args.push("--mcp-config", JSON.stringify({ mcpServers: {} }));
		}

		// Only append system prompt if there's content to append
		if (variationContent) {
			args.splice(args.indexOf("--setting-sources"), 0, "--append-system-prompt", variationContent);
		}

		const proc = Bun.spawn(args, {
			cwd: workDir,
			stdout: "pipe",
			stderr: "pipe",
		});

		// Ignore stderr for variations (too noisy)
		new Response(proc.stderr).text();

		// Parse stream-json quietly with status callback
		const output = await parseStreamJsonWithStatus(proc.stdout, onStatus);
		const exitCode = await proc.exited;

		onStatus?.("✓ done");

		return {
			variationNumber,
			output,
			exitCode,
		};
	} catch (error) {
		onStatus?.("✗ error");
		return {
			variationNumber,
			output: `ERROR: Failed to spawn claude process\n${error}`,
			exitCode: 1,
		};
	}
}

/**
 * Run claude with given parameters
 * Uses stream-json format for real-time output while capturing content
 *
 * @param options.useSpinner - If true, use a spinner instead of streaming text output
 * @param options.spinnerText - Initial text for the spinner (only used if useSpinner is true)
 */
async function runClaude(options: {
	model: string;
	systemPrompt: string;
	userMessage: string;
	streamOutput?: boolean;
	useSpinner?: boolean;
	spinnerText?: string;
}): Promise<{ output: string; exitCode: number }> {
	const mcpConfig = { mcpServers: {} };

	const hook = `
input=$(cat)
# Auto-approve file operations in the output directory
if echo "$input" | grep -q 'claude-arena'; then
  echo '{"decision": "approve"}'
  exit 0
fi
exit 0
`;

	const settings = {
		hooks: {
			PreToolUse: [
				{
					matcher: "*",
					hooks: [{ type: "command", command: hook }],
				},
			],
		},
	};

	const args = [
		"claude",
		"--print",
		"--output-format",
		"stream-json",
		"--verbose",
		"--model",
		options.model,
		"--setting-sources",
		"",
		"--strict-mcp-config",
		"--mcp-config",
		JSON.stringify(mcpConfig),
		"--system-prompt",
		options.systemPrompt,
		"--settings",
		JSON.stringify(settings),
		options.userMessage,
	];

	const proc = Bun.spawn(args, {
		stdout: "pipe",
		stderr: "pipe",
	});

	let stdoutPromise: Promise<string>;
	let spinner: ReturnType<typeof ora> | null = null;

	if (options.useSpinner) {
		// Use spinner mode - show progress without streaming all text
		spinner = ora({
			text: options.spinnerText || "Working...",
			color: "cyan",
		}).start();
		stdoutPromise = parseStreamJsonWithSpinner(proc.stdout, spinner);
		// Silently consume stderr in spinner mode
		new Response(proc.stderr).text();
	} else {
		// Stream mode - show all output
		stdoutPromise = parseStreamJson(proc.stdout, process.stdout);
		// Tee stderr to console (for error messages)
		teeStream(proc.stderr, process.stderr);
	}

	// Wait for process to finish
	const exitCode = await proc.exited;

	// Wait for stdout to finish
	const output = await stdoutPromise;

	// Stop spinner if used
	if (spinner) {
		if (exitCode === 0) {
			spinner.succeed("Done");
		} else {
			spinner.fail("Failed");
		}
	}

	// Return the extracted text content
	return { output, exitCode };
}

main().catch(console.error);
