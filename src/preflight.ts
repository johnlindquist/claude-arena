// src/preflight.ts

import { $ } from "bun";

export interface PreflightResult {
  ok: boolean;
  projectPath: string;
  worktreePath?: string;
  error?: string;
}

export async function runPreflight(projectPath: string): Promise<PreflightResult> {
  // Check if git is initialized
  const gitCheck = await $`git -C ${projectPath} rev-parse --git-dir 2>/dev/null`.quiet();
  if (gitCheck.exitCode !== 0) {
    return {
      ok: false,
      projectPath,
      error: `Not a git repository: ${projectPath}\n\nFor safety, we only test git-tracked projects.\nRun 'git init' in your project first.`
    };
  }

  // Check for uncommitted changes
  const statusCheck = await $`git -C ${projectPath} status --porcelain`.quiet();
  const hasChanges = statusCheck.stdout.toString().trim().length > 0;

  if (hasChanges) {
    console.log("⚠️  Warning: You have uncommitted changes.");
    console.log("   The worktree will be created from HEAD.");
    console.log("   Uncommitted changes won't be tested.\n");
  }

  // Create a worktree for isolated testing
  const worktreeName = `claude-checker-${Date.now()}`;
  const worktreePath = `/tmp/${worktreeName}`;

  const worktreeCreate = await $`git -C ${projectPath} worktree add ${worktreePath} HEAD --detach`.quiet();
  if (worktreeCreate.exitCode !== 0) {
    return {
      ok: false,
      projectPath,
      error: `Failed to create worktree: ${worktreeCreate.stderr.toString()}`
    };
  }

  console.log(`✅ Created isolated worktree: ${worktreePath}`);

  return {
    ok: true,
    projectPath,
    worktreePath
  };
}

export async function cleanup(worktreePath: string, projectPath: string): Promise<void> {
  console.log(`\n🧹 Cleaning up worktree...`);
  await $`git -C ${projectPath} worktree remove ${worktreePath} --force`.quiet();
  console.log(`✅ Removed: ${worktreePath}`);
}
