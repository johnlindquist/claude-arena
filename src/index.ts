#!/usr/bin/env bun
// src/index.ts

import { resolve, join } from "node:path";
import { homedir } from "node:os";
import { mkdir } from "node:fs/promises";
import {
  buildDesignPrompt,
  buildVariationsOnlyPrompt,
  buildEvaluationPrompt,
  getOutputDir,
  type VariationInfo,
  type VariationResult,
} from "./prompts";
import { parseArgs, looksLikePath } from "./args-parser";
import { parseVariationInfo } from "./variation-parser";
import { resolveImports } from "./import-resolver";
import {
  parseStreamLine,
  accumulateTextFromEvent,
  extractToolUses,
  extractUsageStats,
  formatToolUse,
  formatUsageStats,
  createStreamParserState,
  processStreamChunk,
  type StreamParserState,
} from "./stream-parser";

/**
 * Parse stream-json output from Claude CLI.
 * Format: {"type":"assistant","message":{"content":[...]}} per line
 */
async function parseStreamJson(
  stream: ReadableStream,
  destination: NodeJS.WriteStream
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
 * Simple tee helper - reads a stream, writes to destination, captures content.
 * Used for stderr or non-stream-json output.
 */
async function teeStream(
  stream: ReadableStream,
  destination: NodeJS.WriteStream
): Promise<string> {
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
  onStatus?: (status: string) => void
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
              const filePath = block.input?.file_path || block.input?.path || block.input?.command || "";
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
      console.log(`   + Appending: "${promptArg.slice(0, 50)}${promptArg.length > 50 ? '...' : ''}"`);
    } else {
      systemPrompt = userConfig;
    }

    // Use user's settings when running variations
    settingSources = "user";
  } else {
    // Standard mode: require a prompt
    if (!promptArg) {
      console.error("❌ Please provide a system prompt to evaluate");
      console.error("\nExample: claude-arena \"code should follow Python's Zen principles\"");
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
  const promptDisplay = systemPrompt.length > 60
    ? systemPrompt.slice(0, 60).replace(/\n/g, " ") + "..."
    : systemPrompt.replace(/\n/g, " ");

  console.log("🏟️  claude-arena - System Prompt Effectiveness Evaluator");
  console.log("━".repeat(55));
  console.log(`Prompt:     ${promptDisplay}`);
  console.log(`Judge:      ${model}. Adjust with --model <model>`);
  console.log(`Test model: ${testModel}. Adjust with --test-model <model>`);
  console.log(`Variations: ${variations}. Adjust with --variations <n>`);
  if (userMode) {
    console.log(`Mode:       user (testing ~/.claude/CLAUDE.md)`);
  }
  if (userTask) {
    console.log(`Task:       user-provided`);
  }
  console.log("━".repeat(55));
  console.log("");
  console.log(`📁 Output directory: ${outputDir}`);

  // Create output directory
  await mkdir(outputDir, { recursive: true });

  // ============================================
  // STEP 1: Design Phase - Generate task and variations
  // ============================================
  let task: string;
  let variationInfo: VariationInfo[];
  const taskPath = join(outputDir, "task.md");

  if (userTask) {
    // User provided a task - just generate variations
    console.log("\n🎯 Step 1: Generating variations for user-provided task...\n");

    task = userTask;
    await Bun.write(taskPath, task);
    console.log(`   📝 Using user-provided task`);

    const designPrompt = buildVariationsOnlyPrompt(systemPrompt, variations);
    const designResult = await runClaude({
      model,
      systemPrompt: designPrompt,
      userMessage: "Begin now - write all variation files.",
      streamOutput: true,
    });

    if (designResult.exitCode !== 0) {
      console.error("\n❌ Design phase failed");
      process.exit(1);
    }

    variationInfo = parseVariationInfo(designResult.output, variations);
  } else {
    // AI generates both task and variations
    console.log("\n🎯 Step 1: Designing task and variations...\n");

    const designPrompt = buildDesignPrompt(systemPrompt, variations);
    const designResult = await runClaude({
      model,
      systemPrompt: designPrompt,
      userMessage: "Begin now - write the task and all variation files.",
      streamOutput: true,
    });

    if (designResult.exitCode !== 0) {
      console.error("\n❌ Design phase failed");
      process.exit(1);
    }

    variationInfo = parseVariationInfo(designResult.output, variations);

    // Read the generated task
    const taskFile = Bun.file(taskPath);
    if (!(await taskFile.exists())) {
      console.error(`\n❌ Task file not found at ${taskPath}`);
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

  console.log("\n✅ Design phase complete");
  console.log(`   Task: ${taskPath}`);
  console.log(`   Variations: ${variations} + baseline (variation 0) generated`);

  // ============================================
  // STEP 2: Run all variations in parallel
  // ============================================
  console.log("\n🚀 Step 2: Running variations in parallel...\n");

  const variationPromises: Promise<VariationResult>[] = [];

  // Track latest status for each variation
  const variationStatus: Map<number, string> = new Map();

  const updateStatus = () => {
    // Build status line with truncated status per variation
    const statusLine = Array.from(variationStatus.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([num, status]) => `[${num}] ${status.slice(0, 12)}`)
      .join(" ");

    // Truncate to terminal width to prevent wrapping
    const maxWidth = (process.stdout.columns || 80) - 4;
    const truncated = statusLine.slice(0, maxWidth);

    // Clear entire line with ANSI escape code, then write status
    process.stdout.write(`\x1b[2K\r   ${truncated}`);
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
      })
    );
  }

  // Show initial status (stays on same line, updated in place)
  updateStatus();

  // Wait for all variations to complete (don't fail if some error out)
  const settled = await Promise.allSettled(variationPromises);

  // Move to new line after all variations complete
  console.log();

  const results: VariationResult[] = [];
  let successCount = 0;
  let failCount = 0;

  console.log("\n✅ Variations complete");
  for (const [i, outcome] of settled.entries()) {
    if (outcome.status === "fulfilled") {
      const result = outcome.value;
      results.push(result);
      const status = result.exitCode === 0 ? "✓" : "⚠";
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
      console.log(`   ✗ Variation ${variationNumber}: FAILED - ${reason}`);
      failCount++;
    }
  }

  if (results.length === 0) {
    console.error("\n❌ No variations completed successfully");
    process.exit(1);
  }

  console.log(`\n   Summary: ${successCount} succeeded, ${failCount} failed`)

  // ============================================
  // STEP 3: Evaluate results
  // ============================================
  console.log("\n📊 Step 3: Evaluating results...\n");

  const evaluationPrompt = buildEvaluationPrompt(
    systemPrompt,
    task,
    variationInfo,
    results,
    outputDir
  );

  const evalResult = await runClaude({
    model,
    systemPrompt: evaluationPrompt,
    userMessage: "Begin your evaluation.",
    streamOutput: true,
  });

  console.log("\n" + "━".repeat(55));
  console.log("Want to refine the results or apply the optimized prompt?");
  console.log("Continue interactively with: claude --resume");
  console.log("━".repeat(55));

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
  const {
    variationNumber,
    task,
    variationContent,
    workDir,
    testModel,
    settingSources,
    onStatus,
  } = options;

  try {
    const mcpConfig = { mcpServers: {} };
    const settings = {
      "sandbox": {
        "enabled": true,
        "autoAllowBashIfSandboxed": true
      },
      "permissions": {
        "defaultMode": "acceptEdits"
      }
    }

    // Build args, conditionally including --append-system-prompt only if content is non-empty
    const args = [
      "claude",
      "--model", testModel,
      "--print",
      "--output-format", "stream-json",
      "--verbose",
      `git init && complete this task in full:\n\n${task}\n\n--- CRITICAL: Once complete, diff all of the changed files. NEVER SUMMARIZE!`,
      "--permission-mode", "bypassPermissions",
      "--setting-sources", settingSources,
      "--settings", JSON.stringify(settings),
      "--mcp-config", JSON.stringify(mcpConfig),
    ];

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
 */
async function runClaude(options: {
  model: string;
  systemPrompt: string;
  userMessage: string;
  streamOutput?: boolean;
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
    "--output-format", "stream-json",
    "--verbose",
    "--model", options.model,
    "--setting-sources", "",
    "--strict-mcp-config",
    "--mcp-config", JSON.stringify(mcpConfig),
    "--system-prompt", options.systemPrompt,
    "--settings", JSON.stringify(settings),
    options.userMessage,
  ];

  const proc = Bun.spawn(args, {
    stdout: "pipe",
    stderr: "pipe",
  });

  // Parse the stream-json output - extracts text and prints to console
  const stdoutPromise = parseStreamJson(proc.stdout, process.stdout);
  // Tee stderr to console (for error messages)
  const stderrPromise = teeStream(proc.stderr, process.stderr);

  // Wait for process to finish
  const exitCode = await proc.exited;

  // Wait for streams to finish flushing
  const [output] = await Promise.all([stdoutPromise, stderrPromise]);

  // Return the extracted text content
  return { output, exitCode };
}

main().catch(console.error);
