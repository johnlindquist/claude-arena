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

async function main() {
  const { flags, positional } = parseArgs(process.argv.slice(2));

  // Handle --help
  if (flags.help || flags.h) {
    console.log(`
claude-checker - Evaluate and optimize system prompt effectiveness

Usage: claude-checker <system-prompt|file.md> [options]

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
  claude-checker "code should follow Python's Zen principles"
  claude-checker ./goals/zen-principles.md
  claude-checker "avoid code smells: feature envy, shotgun surgery"
  claude-checker --model opus ./my-design-principles.md
`);
    process.exit(0);
  }

  // Get the system prompt from positional args
  const promptArg = positional.join(" ");
  if (!promptArg) {
    console.error("❌ Please provide a system prompt to evaluate");
    console.error("\nExample: claude-checker \"code should follow Python's Zen principles\"");
    console.error("         claude-checker ./my-system-prompt.md");
    process.exit(1);
  }

  // Check if it's a file path
  let systemPrompt: string;
  const looksLikePath = promptArg.endsWith(".md") ||
    promptArg.startsWith("./") ||
    promptArg.startsWith("/") ||
    promptArg.startsWith("../");

  if (looksLikePath) {
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

  console.log("🧪 claude-checker - System Prompt Effectiveness Evaluator");
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

    console.log(`   Starting variation ${i}...`);

    variationPromises.push(
      runVariation(i, task, variationContent, workDir)
    );
  }

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
    results
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
 */
async function runVariation(
  variationNumber: number,
  task: string,
  variationContent: string,
  workDir: string
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

    const output = await new Response(proc.stdout).text();
    const stderr = await new Response(proc.stderr).text();
    const exitCode = await proc.exited;

    return {
      variationNumber,
      output: output + (stderr ? `\n\nSTDERR:\n${stderr}` : ""),
      exitCode,
    };
  } catch (error) {
    return {
      variationNumber,
      output: `ERROR: Failed to spawn claude process\n${error}`,
      exitCode: 1,
    };
  }
}

/**
 * Run claude with given parameters
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
if echo "$input" | grep -q 'claude-checker'; then
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
    "--verbose",
    "--model", options.model,
    "--setting-sources", "",
    "--strict-mcp-config",
    "--mcp-config", JSON.stringify(mcpConfig),
    "--system-prompt", options.systemPrompt,
    "--settings", JSON.stringify(settings),
    options.userMessage,
  ];

  if (options.streamOutput) {
    // Stream to console
    const proc = Bun.spawn(args, {
      stdio: ["inherit", "inherit", "inherit"],
    });
    const exitCode = await proc.exited;
    return { output: "", exitCode };
  } else {
    // Capture output
    const proc = Bun.spawn(args, {
      stdout: "pipe",
      stderr: "pipe",
    });
    const output = await new Response(proc.stdout).text();
    const exitCode = await proc.exited;
    return { output, exitCode };
  }
}

/**
 * Parse variation info from design phase output
 */
function parseVariationInfo(output: string, fallbackCount: number): VariationInfo[] {
  // Try to find JSON block in output
  const jsonMatch = output.match(/```json\s*([\s\S]*?)\s*```/);
  if (jsonMatch && jsonMatch[1]) {
    try {
      const parsed = JSON.parse(jsonMatch[1]);
      if (parsed.variations && Array.isArray(parsed.variations)) {
        return parsed.variations;
      }
    } catch {
      // Fall through to defaults
    }
  }

  // Default variation info
  const strategies = ["PERSONA", "EXEMPLAR", "CONSTRAINT", "SOCRATIC", "CHECKLIST"];
  return Array.from({ length: fallbackCount }, (_, i) => ({
    number: i + 1,
    strategy: strategies[i] || `VARIATION_${i + 1}`,
    summary: `Variation ${i + 1}`,
  }));
}

interface ParsedArgs {
  flags: Record<string, string>;
  positional: string[];
}

function parseArgs(args: string[]): ParsedArgs {
  const flags: Record<string, string> = {};
  const positional: string[] = [];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === undefined) continue;
    if (arg.startsWith("--")) {
      const key = arg.slice(2).replace(/-/g, "");
      const nextArg = args[i + 1];
      if (nextArg !== undefined && !nextArg.startsWith("--")) {
        flags[key] = nextArg;
        i++;
      } else {
        flags[key] = "true";
      }
    } else if (arg.startsWith("-") && arg.length === 2) {
      flags[arg.slice(1)] = "true";
    } else {
      positional.push(arg);
    }
  }

  return { flags, positional };
}

main().catch(console.error);
