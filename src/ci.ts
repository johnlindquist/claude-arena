#!/usr/bin/env bun
// src/ci.ts

import { spawn } from "bun";
import { DEFAULT_PREFERENCES } from "./prompts";

const CI_PROMPT = (preferences: string, claudeMdPath: string, source: string) => `
You are running CLAUDE.md compliance tests in CI mode.

## Preferences
${preferences}

## CLAUDE.md
Path: ${claudeMdPath}
Source: ${source}

## CI Requirements

1. For each preference, run ONE coding task
2. Score baseline vs configured (0-3 scale)
3. Output ONLY this JSON when done:

{
  "passed": boolean,
  "preferences": [
    {
      "name": "Preference Name",
      "baseline": 0,
      "configured": 2,
      "improvement": 2,
      "status": "pass"
    }
  ],
  "overallImprovement": 1.5,
  "summary": "Brief description"
}

Pass threshold: Each preference must score >= 2/3 configured.
Exit 0 if passed, 1 if failed.

Run silently. Output ONLY the final JSON.
`;

async function main() {
  const args = process.argv.slice(2);

  // Handle --help
  if (args.includes("--help") || args.includes("-h")) {
    console.log(`
claude-checker ci - Run compliance tests in CI mode (JSON output)

Usage: claude-checker-ci [claude-md-path] [source] [options]

Arguments:
  claude-md-path   Path to CLAUDE.md (default: ~/.claude/CLAUDE.md)
  source           Setting source: user, project (default: user)

Options:
  --help           Show this help

Output:
  JSON with pass/fail status and scores for each preference.
  Exit code 0 = passed, 1 = failed.

Examples:
  claude-checker-ci                              # Test user CLAUDE.md
  claude-checker-ci ~/.claude/CLAUDE.md user     # Explicit path
  claude-checker-ci ./.claude/CLAUDE.md project  # Project CLAUDE.md
`);
    process.exit(0);
  }

  const claudeMdPath = args[0] || `${process.env.HOME}/.claude/CLAUDE.md`;
  const source = args[1] || "user";

  const preferences = JSON.stringify(DEFAULT_PREFERENCES, null, 2);

  const proc = spawn({
    cmd: [
      "claude",
      "--model", "haiku",
      "--print", CI_PROMPT(preferences, claudeMdPath, source),
      "--setting-sources", "",
      "--strict-mcp-config",
      "--mcp-config", '{"mcpServers":{}}',
      "--dangerously-skip-permissions",
    ],
    stdout: "pipe",
    stderr: "pipe",
  });

  const output = await new Response(proc.stdout).text();

  const jsonMatch = output.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      const result = JSON.parse(jsonMatch[0]);
      console.log(JSON.stringify(result, null, 2));
      process.exit(result.passed ? 0 : 1);
    } catch {
      console.error("Failed to parse JSON from output");
      console.error(output);
      process.exit(1);
    }
  } else {
    console.error("Failed to extract CI output");
    console.error(output);
    process.exit(1);
  }
}

main();
