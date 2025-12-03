#!/usr/bin/env bun
// src/index.ts

import { resolve, join } from "node:path";
import { mkdir } from "node:fs/promises";
import {
  buildDesignPrompt,
  buildEvaluationPrompt,
  getOutputDir,
  type VariationInfo,
  type VariationResult,
} from "./prompts";
import { parseArgs, looksLikePath } from "./args-parser";
import { parseVariationInfo } from "./variation-parser";
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

Usage: claude-arena <system-prompt|file.md> [options]

The judge will:
  1. Generate a task that reveals system prompt adherence
  2. Create variations of your system prompt (persona, exemplar, constraint, socratic, checklist)
  3. Run each variation against the task using Haiku (in parallel)
  4. Evaluate results and recommend the best approach

Arguments:
  system-prompt           The system prompt to evaluate (string or path to .md file)

Options:
  --model <model>         Judge model: opus, sonnet (default: opus)
  --variations <n>        Number of variations to test (default: 5)
  --help                  Show this help

Examples:
  claude-arena "code should follow Python's Zen principles"
  claude-arena ./goals/zen-principles.md
  claude-arena "avoid code smells: feature envy, shotgun surgery"
  claude-arena --model opus ./my-design-principles.md
`);
    process.exit(0);
  }

  // Get the system prompt from positional args
  const promptArg = positional.join(" ");
  if (!promptArg) {
    console.error("❌ Please provide a system prompt to evaluate");
    console.error("\nExample: claude-arena \"code should follow Python's Zen principles\"");
    console.error("         claude-arena ./my-system-prompt.md");
    process.exit(1);
  }

  // Check if it's a file path
  let systemPrompt: string;

  if (looksLikePath(promptArg)) {
    const resolvedPath = resolve(promptArg);
    const isFile = await Bun.file(resolvedPath).exists();
    if (!isFile) {
      console.error(`❌ File not found: ${promptArg}`);
      process.exit(1);
    }
    systemPrompt = await Bun.file(resolvedPath).text();
    console.log(`📄 Loaded system prompt from: ${promptArg}`);
  } else {
    systemPrompt = promptArg;
  }

  const model = flags.model || "opus";
  const variations = Number(flags.variations) || 5;
  const outputDir = getOutputDir();

  // Truncate system prompt for display
  const promptDisplay = systemPrompt.length > 60
    ? systemPrompt.slice(0, 60).replace(/\n/g, " ") + "..."
    : systemPrompt.replace(/\n/g, " ");

  console.log("🏟️  claude-arena - System Prompt Effectiveness Evaluator");
  console.log("━".repeat(55));
  console.log(`Prompt:     ${promptDisplay}`);
  console.log(`Judge:      ${model}. Adjust with --model <model>`);
  console.log(`Variations: ${variations}. Adjust with --variations <n>`);
  console.log("━".repeat(55));
  console.log("");
  console.log(`📁 Output directory: ${outputDir}`);

  // Create output directory
  await mkdir(outputDir, { recursive: true });

  // ============================================
  // STEP 1: Design Phase - Generate task and variations
  // ============================================
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

  // Parse the variation info from the design output (look for JSON block)
  const variationInfo = parseVariationInfo(designResult.output, variations);

  // Read the generated task
  const taskPath = join(outputDir, "task.md");
  const taskFile = Bun.file(taskPath);
  if (!(await taskFile.exists())) {
    console.error(`\n❌ Task file not found at ${taskPath}`);
    process.exit(1);
  }
  const task = await taskFile.text();

  console.log("\n✅ Design phase complete");
  console.log(`   Task: ${taskPath}`);
  console.log(`   Variations: ${variations} files generated`);

  // ============================================
  // STEP 2: Run all variations in parallel
  // ============================================
  console.log("\n🚀 Step 2: Running variations in parallel...\n");

  const variationPromises: Promise<VariationResult>[] = [];

  // Track latest status for each variation
  const variationStatus: Map<number, string> = new Map();

  const updateStatus = () => {
    // Clear line and print all statuses
    const statusLine = Array.from(variationStatus.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([num, status]) => `[${num}] ${status}`)
      .join("  ");
    process.stdout.write(`\r   ${statusLine}${"".padEnd(20)}`);
  };

  for (let i = 1; i <= variations; i++) {
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

    variationPromises.push(
      runVariation(i, task, variationContent, workDir, (status) => {
        variationStatus.set(i, status);
        updateStatus();
      })
    );
  }

  // Show initial status
  updateStatus();
  console.log(); // newline after status

  // Wait for all variations to complete (don't fail if some error out)
  const settled = await Promise.allSettled(variationPromises);

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

  process.exit(evalResult.exitCode);
}

/**
 * Run a single variation test
 * Uses stream-json format, captures stdout quietly to avoid interleaved parallel output
 */
async function runVariation(
  variationNumber: number,
  task: string,
  variationContent: string,
  workDir: string,
  onStatus?: (status: string) => void
): Promise<VariationResult> {
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

    const proc = Bun.spawn(
      [
        "claude",
        "--model", "haiku",
        "--print",
        "--output-format", "stream-json",
        "--verbose",
        `git init && complete this task in full:\n\n${task}\n\n--- CRITICAL: Once complete, diff all of the changed files. NEVER SUMMARIZE!`,
        "--permission-mode", "bypassPermissions",
        "--append-system-prompt", variationContent,
        "--setting-sources", "",
        "--settings", JSON.stringify(settings),
        "--mcp-config", JSON.stringify(mcpConfig),
      ],
      {
        cwd: workDir,
        stdout: "pipe",
        stderr: "pipe",
      }
    );

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
