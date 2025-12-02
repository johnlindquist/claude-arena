#!/usr/bin/env bun
// src/compare.ts

import { spawn } from "bun";
import { DEFAULT_PREFERENCES } from "./prompts";

const COMPARE_PROMPT = (preferences: string, pathA: string, pathB: string) => `
You are comparing two CLAUDE.md files to see which better enforces coding preferences.

## Preferences to Test
${preferences}

## Configurations
- Version A: ${pathA}
- Version B: ${pathB}

## Your Task

For each preference:
1. Generate a coding task
2. Run with Version A: --setting-sources "user" (assumes A is at ~/.claude)
3. Run with Version B: --setting-sources "project" (assumes B is at ./.claude)
4. Compare outputs on each evaluation criterion
5. Declare a winner with specific reasons

Show results like:

| Criterion | Version A | Version B | Winner |
|-----------|-----------|-----------|--------|
| Tests first | Partial | Full | B |
| Edge cases | None | Comprehensive | B |

Be specific about WHAT made one better.
At the end, recommend which version to use or suggest a merged version.
`;

async function main() {
  const args = process.argv.slice(2);

  // Handle --help
  if (args.includes("--help") || args.includes("-h")) {
    console.log(`
claude-checker compare - A/B test two CLAUDE.md files

Usage: claude-checker-compare <version-a.md> <version-b.md> [options]

Arguments:
  version-a.md    First CLAUDE.md to test (tested with --setting-sources "user")
  version-b.md    Second CLAUDE.md to test (tested with --setting-sources "project")

Options:
  --model <model>  Judge model: opus, sonnet, haiku (default: opus)
  --help           Show this help

Examples:
  claude-checker-compare ~/.claude/CLAUDE.md ./.claude/CLAUDE.md
  claude-checker-compare old-claude.md new-claude.md --model sonnet
`);
    process.exit(0);
  }

  const pathA = args[0];
  const pathB = args[1];

  if (!pathA || !pathB) {
    console.log("Usage: claude-checker-compare <version-a.md> <version-b.md>");
    console.log("Run with --help for more information.");
    process.exit(1);
  }

  const model = args.includes("--model")
    ? args[args.indexOf("--model") + 1]
    : "opus";

  console.log("🧪 claude-checker - A/B Comparison Mode");
  console.log("━".repeat(50));
  console.log(`Version A: ${pathA}`);
  console.log(`Version B: ${pathB}`);
  console.log(`Judge:     ${model}`);
  console.log("━".repeat(50));
  console.log("");

  const preferences = JSON.stringify(DEFAULT_PREFERENCES, null, 2);

  const proc = spawn({
    cmd: [
      "claude",
      "--model", model,
      "--setting-sources", "",
      "--strict-mcp-config",
      "--mcp-config", '{"mcpServers":{}}',
      "--system-prompt", COMPARE_PROMPT(preferences, pathA, pathB),
    ],
    stdin: "inherit",
    stdout: "inherit",
    stderr: "inherit",
  });

  await proc.exited;
}

main();
