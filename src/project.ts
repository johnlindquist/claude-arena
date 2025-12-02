#!/usr/bin/env bun
// src/project.ts

import { spawn } from "bun";
import { runPreflight, cleanup } from "./preflight";
import { buildProjectTestPrompt, DEFAULT_PREFERENCES } from "./prompts";
import type { TestConfig } from "./types";

async function main() {
  const args = parseArgs(process.argv.slice(2));

  // Handle --help
  if (args.help || args.h) {
    console.log(`
claude-checker project - Test CLAUDE.md against an existing codebase

Usage: claude-checker-project [options]

Options:
  --project <path>        Project directory to test (default: current dir)
  --claude-md <path>      Path to CLAUDE.md (default: ~/.claude/CLAUDE.md)
  --source <user|project> Setting source to test (default: user)
  --model <model>         Judge model: opus, sonnet, haiku (default: opus)
  --preferences <file>    Custom preferences JSON file
  --help                  Show this help

Examples:
  claude-checker-project                        # Test current directory
  claude-checker-project --project ~/dev/myapp  # Test specific project
  claude-checker-project --source project       # Use project's CLAUDE.md
`);
    process.exit(0);
  }

  const projectPath = args.project || process.cwd();

  console.log("🧪 claude-checker - Project Compliance Tester");
  console.log("━".repeat(50));
  console.log(`Project:   ${projectPath}`);
  console.log("━".repeat(50));
  console.log("");

  // Run pre-flight checks
  console.log("Running pre-flight checks...\n");
  const preflight = await runPreflight(projectPath);

  if (!preflight.ok) {
    console.error(`❌ Pre-flight failed:\n\n${preflight.error}`);
    process.exit(1);
  }

  const config: TestConfig = {
    claudeMdPath: args.claudeMd || args.claudemd || `${process.env.HOME}/.claude/CLAUDE.md`,
    settingSource: (args.source as "user" | "project") || "user",
    model: args.model || "opus",
    tasksPerPreference: 1,
  };

  let preferences = DEFAULT_PREFERENCES;
  if (args.preferences) {
    const customPrefs = await Bun.file(args.preferences).json();
    preferences = customPrefs.preferences;
  }

  console.log(`CLAUDE.md:      ${config.claudeMdPath}`);
  console.log(`Setting source: ${config.settingSource}`);
  console.log(`Judge model:    ${config.model}`);
  console.log(`Worktree:       ${preflight.worktreePath}`);
  console.log("━".repeat(50));
  console.log("");
  console.log("Spawning ISOLATED judge...\n");

  const systemPrompt = buildProjectTestPrompt(
    preferences,
    config.claudeMdPath,
    config.settingSource,
    preflight.worktreePath!,
    projectPath
  );

  const proc = spawn({
    cmd: [
      "claude",
      "--model", config.model,
      "--setting-sources", "",
      "--strict-mcp-config",
      "--mcp-config", '{"mcpServers":{}}',
      "--system-prompt", systemPrompt,
      "--add-dir", preflight.worktreePath!,
    ],
    stdin: "inherit",
    stdout: "inherit",
    stderr: "inherit",
  });

  const exitCode = await proc.exited;

  // Cleanup
  await cleanup(preflight.worktreePath!, projectPath);

  process.exit(exitCode);
}

function parseArgs(args: string[]): Record<string, string> {
  const result: Record<string, string> = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith("--")) {
      const key = arg.slice(2).replace(/-/g, "");
      if (args[i + 1] && !args[i + 1].startsWith("--")) {
        result[key] = args[++i];
      } else {
        result[key] = "true";
      }
    } else if (arg.startsWith("-") && arg.length === 2) {
      result[arg.slice(1)] = "true";
    }
  }

  return result;
}

main().catch(console.error);
