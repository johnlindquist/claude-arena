#!/usr/bin/env bun
// src/index.ts

import { spawn } from "bun";
import { resolve } from "node:path";
import { buildJudgePrompt } from "./prompts";

async function main() {
  const { flags, positional } = parseArgs(process.argv.slice(2));

  // Handle --help
  if (flags.help || flags.h) {
    console.log(`
claude-checker - Evaluate and optimize instruction effectiveness

Usage: claude-checker <goal|file.md> [options]

The judge will:
  1. Generate a task that reveals goal adherence
  2. Create 5 variations of your goal (terse, clear, exhaustive, visual, reframed)
  3. Run each variation against the task using Haiku
  4. Evaluate results and recommend the best approach

Arguments:
  goal                    The goal to evaluate (string or path to .md file)

Options:
  --model <model>         Judge model: opus, sonnet (default: sonnet)
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

  // Get the goal from positional args - can be a string or path to .md file
  const goalArg = positional.join(" ");
  if (!goalArg) {
    console.error("❌ Please provide a goal to evaluate");
    console.error("\nExample: claude-checker \"code should follow Python's Zen principles\"");
    console.error("         claude-checker ./my-goal.md");
    process.exit(1);
  }

  // Check if it's a file path
  let goal: string;
  const resolvedPath = resolve(goalArg);
  const isFile = await Bun.file(resolvedPath).exists();

  if (isFile || goalArg.endsWith(".md")) {
    if (!isFile) {
      console.error(`❌ File not found: ${goalArg}`);
      process.exit(1);
    }
    goal = await Bun.file(resolvedPath).text();
    console.log(`📄 Loaded goal from: ${goalArg}`);
  } else {
    goal = goalArg;
  }

  const model = flags.model || "sonnet";
  const variations = Number(flags.variations) || 5;

  // Truncate goal for display
  const goalDisplay = goal.length > 60
    ? goal.slice(0, 60).replace(/\n/g, " ") + "..."
    : goal.replace(/\n/g, " ");

  console.log("🧪 claude-checker - Instruction Effectiveness Evaluator");
  console.log("━".repeat(55));
  console.log(`Goal:       ${goalDisplay}`);
  console.log(`Judge:      ${model}. Adjust with --model <model>`);
  console.log(`Variations: ${variations}. Adjust with --variations <n>`);
  console.log("━".repeat(55));
  console.log("");
  console.log("Spawning judge to design experiment...\n");

  // Build the judge's system prompt
  const systemPrompt = buildJudgePrompt(goal, variations);

  // Get the sandbox settings path
  const settingsPath = resolve(import.meta.dir, "..", "test-sandbox-settings.json");

  // Spawn the judge in print mode for non-interactive execution
  const proc = Bun.spawn({
    cmd: [
      "claude",
      "--print", "Begin the evaluation. First, generate the task and variations, then run the tests.",
      "--model", model,
      "--setting-sources", "",
      "--strict-mcp-config",
      "--mcp-config", '{"mcpServers":{}}',
      "--system-prompt", systemPrompt,
      "--settings", settingsPath,
    ],
    stdout: "pipe",
    stderr: "pipe",
    stdin: "pipe",
  });

  const exitCode = await proc.exited;
  process.exit(exitCode);
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
    if (arg.startsWith("--")) {
      const key = arg.slice(2).replace(/-/g, "");
      if (args[i + 1] && !args[i + 1].startsWith("--")) {
        flags[key] = args[++i];
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
