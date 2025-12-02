#!/usr/bin/env bun
// src/index.ts

import { resolve } from "node:path";
import { buildJudgePrompt } from "./prompts";
import { tmpDir, timestamp } from "./const";

async function main() {
  const { flags, positional } = parseArgs(process.argv.slice(2));

  // Handle --help
  if (flags.help || flags.h) {
    console.log(`
claude-checker - Evaluate and optimize system prompt effectiveness

Usage: claude-checker <system-prompt|file.md> [options]

The judge will:
  1. Generate a task that reveals system prompt adherence
  2. Create 5 variations of your system prompt (terse, clear, exhaustive, visual, reframed, socratic, checklist, mnemonic, temporal, anti-pattern)
  3. Run each variation against the task using Haiku
  4. Evaluate results and recommend the best approach

Arguments:
  system-prompt           The system prompt to evaluate (string or path to .md file)

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

  // Get the system prompt from positional args - can be a string or path to .md file
  const promptArg = positional.join(" ");
  if (!promptArg) {
    console.error("❌ Please provide a system prompt to evaluate");
    console.error("\nExample: claude-checker \"code should follow Python's Zen principles\"");
    console.error("         claude-checker ./my-system-prompt.md");
    process.exit(1);
  }

  // Check if it's a file path (only if it looks like one)
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
  console.log("Writing variations to: " + tmpDir + "/" + timestamp);
  console.log("Spawning judge to design experiment...\n");

  // Build the judge's system prompt
  const judgeSystemPrompt = buildJudgePrompt(systemPrompt, variations);

  const mcpConfig = {
    "mcpServers": {}
  }


  const hook = `
input=$(cat)

# Check if this is a Bash tool and contains "claude --model haiku"
if echo "$input" | grep -q '"tool_name".*"Bash"' && echo "$input" | grep -q 'claude --model haiku'; then
  echo '{"decision": "approve"}'
  exit 0
fi

if echo "$input" | grep -q '${timestamp}'; then
  echo '{"decision": "approve"}'
  exit 0
fi

# For all other commands, let normal permission flow handle it
exit 0
`
  const settings = {
    "hooks": {
      "PreToolUse": [
        {
          "matcher": "*",
          "hooks": [
            {
              "type": "command",
              "command": hook
            }
          ]
        }
      ]
    }
  }

  // Spawn the judge in print mode for non-interactive execution
  const proc = Bun.spawn(
    [
      "claude",
      "--model", model,
      "--setting-sources", "",
      "--strict-mcp-config",
      "--mcp-config", JSON.stringify(mcpConfig),
      "--system-prompt", judgeSystemPrompt,
      "--settings", JSON.stringify(settings),
      "Begin the evaluation",
    ],
    {
      stdio: ['inherit', 'inherit', 'inherit']
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
