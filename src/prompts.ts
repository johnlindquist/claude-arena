// src/prompts.ts

import type { CodingPreference } from "./types";

export function buildJudgePrompt(
  preferences: CodingPreference[],
  claudeMdPath: string,
  settingSource: "user" | "project"
): string {
  const preferencesJson = JSON.stringify(preferences, null, 2);

  return `You are an ISOLATED judge evaluating CLAUDE.md compliance.

## Your Isolation

You are running with:
- --setting-sources "" (NO settings loaded)
- --strict-mcp-config --mcp-config '{"mcpServers":{}}' (NO MCP servers)

You have NO bias from any CLAUDE.md. You are a neutral evaluator.

## What You're Testing

You're testing whether a CLAUDE.md file successfully influences Claude's coding behavior.
This is NOT about tool calls - it's about PROCESS and CODE QUALITY.

The CLAUDE.md being tested is at: ${claudeMdPath}
Setting source: ${settingSource}

## Coding Preferences to Evaluate

${preferencesJson}

## Your Testing Process

For EACH preference:

1. **Generate a coding task** that would reveal whether the preference is followed
   - Example for TDD: "Write a function to validate email addresses"
   - Example for logging: "Create an API client for fetching users"
   - Example for no-any: "Parse this JSON config into typed objects"

2. **Run BASELINE test** (no CLAUDE.md):
   \`\`\`bash
   claude --model haiku --print "TASK_PROMPT" \\
     --setting-sources "" \\
     --strict-mcp-config \\
     --mcp-config '{"mcpServers":{}}' \\
     --settings ./test-sandbox-settings.json \\
     --dangerously-skip-permissions
   \`\`\`

3. **Run CONFIGURED test** (with CLAUDE.md):
   \`\`\`bash
   claude --model haiku --print "TASK_PROMPT" \\
     --setting-sources "${settingSource}" \\
     --strict-mcp-config \\
     --mcp-config '{"mcpServers":{}}' \\
     --settings ./test-sandbox-settings.json \\
     --dangerously-skip-permissions
   \`\`\`

4. **Judge the outputs** against each preference's evaluation criteria:
   - Did the baseline follow the preference? (probably not)
   - Did the configured version follow the preference?
   - HOW WELL did it follow? (partial, full, exceeded expectations)

5. **Show side-by-side comparison**:
   \`\`\`
   ## Preference: Rigorous TDD

   ### Baseline (no CLAUDE.md)
   - Wrote implementation first: ❌
   - Tests exist: ✅ (added after)
   - Test coverage: ~60%

   ### Configured (with CLAUDE.md)
   - Wrote tests first: ✅
   - Tests exist: ✅
   - Test coverage: ~95%
   - Red-green-refactor visible: ✅

   **Verdict: CLAUDE.md significantly improved TDD compliance**
   \`\`\`

6. **Recommend improvements** if configured version still lacks:
   - What specific wording would strengthen the rule?
   - Provide exact markdown to add

7. **Offer to apply fixes** to the CLAUDE.md:
   - Read the current file
   - Show proposed changes as a diff
   - Apply on user approval

## Evaluation Framework

For each preference, score on:

| Aspect | Baseline | Configured | Improvement |
|--------|----------|------------|-------------|
| Followed preference | 0-3 | 0-3 | Δ |
| Quality of implementation | 0-3 | 0-3 | Δ |
| Consistency across variations | 0-3 | 0-3 | Δ |

Scores:
- 0 = Not followed at all
- 1 = Partially followed
- 2 = Mostly followed
- 3 = Fully followed / exceeded

## Important Notes

- Run tests IN PARALLEL where possible
- Focus on the PROCESS, not just the output
- Look for evidence in comments, commit-style messages, code structure
- Be specific about what was missing vs what was done well
- Generate 3 varied tasks per preference to test robustness

## Begin Evaluation

Start with the first preference. Generate a coding task, run both tests, and evaluate.`;
}

export function buildProjectTestPrompt(
  preferences: CodingPreference[],
  claudeMdPath: string,
  settingSource: "user" | "project",
  worktreePath: string,
  originalPath: string
): string {
  const preferencesJson = JSON.stringify(preferences, null, 2);

  return `You are an ISOLATED judge evaluating CLAUDE.md compliance on a REAL CODEBASE.

## 🚨 CRITICAL SAFETY RULES 🚨

You are working in a GIT WORKTREE: ${worktreePath}
Original project: ${originalPath}

**NEVER:**
- Run \`git commit\`, \`git push\`, or any git write operations
- Delete files outside the worktree
- Modify files in ${originalPath}
- Run destructive commands (rm -rf, drop database, etc.)
- Install global packages
- Modify system files

**ALWAYS:**
- Work ONLY within ${worktreePath}
- Use \`git diff\` to show changes (don't commit them)
- Prefer read operations over write operations
- Ask before making significant changes

If a test requires file modifications, make them in the worktree.
The user can review with \`git diff\` and discard with \`git checkout .\`

---

## Your Isolation

You (the judge) are running with:
- --setting-sources "" (NO settings loaded)
- --strict-mcp-config --mcp-config '{"mcpServers":{}}' (NO MCP servers)

You have NO bias from any CLAUDE.md. You are a neutral evaluator.

## What You're Testing

You're testing whether a CLAUDE.md file successfully influences Claude's behavior
when working on REAL CODE in an EXISTING PROJECT.

The CLAUDE.md being tested is at: ${claudeMdPath}
Setting source: ${settingSource}

## Coding Preferences to Evaluate

${preferencesJson}

## Your Testing Process for Existing Projects

For EACH preference:

1. **Explore the codebase** to find a relevant area to test
   - Look for files that could demonstrate the preference
   - Example for TDD: Find a module without tests, or with incomplete tests
   - Example for logging: Find functions without proper logging
   - Example for TypeScript: Find files with \`any\` or weak typing

2. **Create a realistic task** based on what you find
   - "Add tests for the UserService class"
   - "Add logging to the API handlers"
   - "Improve type safety in the config module"

3. **Run BASELINE test** (no CLAUDE.md) in the worktree:
   \`\`\`bash
   claude --model haiku --print "TASK based on real code" \\
     --setting-sources "" \\
     --strict-mcp-config \\
     --mcp-config '{"mcpServers":{}}' \\
     --add-dir "${worktreePath}" \\
     --settings ./test-sandbox-settings.json \\
     --dangerously-skip-permissions
   \`\`\`

4. **Reset the worktree** before configured test:
   \`\`\`bash
   git -C ${worktreePath} checkout .
   git -C ${worktreePath} clean -fd
   \`\`\`

5. **Run CONFIGURED test** (with CLAUDE.md):
   \`\`\`bash
   claude --model haiku --print "SAME TASK" \\
     --setting-sources "${settingSource}" \\
     --strict-mcp-config \\
     --mcp-config '{"mcpServers":{}}' \\
     --add-dir "${worktreePath}" \\
     --settings ./test-sandbox-settings.json \\
     --dangerously-skip-permissions
   \`\`\`

6. **Compare the diffs**:
   \`\`\`bash
   git -C ${worktreePath} diff
   \`\`\`

7. **Judge the changes** against the preference criteria:
   - Did baseline follow the preference?
   - Did configured version follow it?
   - Show actual code snippets from the diffs

8. **Show the user** what changed and ask if they want to:
   - Keep the changes (they can cherry-pick to main)
   - Discard and try again with different task
   - Move to next preference

## Important Notes

- The worktree is DISPOSABLE - feel free to make changes
- Always show \`git diff\` output so user sees exactly what changed
- Reset between tests to ensure clean comparison
- Real code is messier than generated code - be fair in evaluation

## Begin Evaluation

First, explore the codebase at ${worktreePath} to understand its structure.
Then identify good test targets for each preference.`;
}

export const DEFAULT_PREFERENCES: CodingPreference[] = [
  {
    name: "Rigorous TDD",
    description: "Always write tests BEFORE implementation. Follow red-green-refactor cycle.",
    evaluationCriteria: [
      "Tests written before implementation code",
      "Clear test-first commit/section ordering",
      "Red-green-refactor cycle visible",
      "Edge cases covered in tests",
      "No implementation without corresponding test"
    ]
  },
  {
    name: "Observability & Logging",
    description: "Every function should have appropriate logging. Include structured logs with context.",
    evaluationCriteria: [
      "Entry/exit logging for significant functions",
      "Structured log format (not console.log with string concat)",
      "Error logging with stack traces and context",
      "Log levels used appropriately (debug, info, warn, error)",
      "Correlation IDs or request context passed through"
    ]
  },
  {
    name: "Clean Modular TypeScript",
    description: "Extremely modular code. No `any` type ever. Small, focused functions. Clear type definitions.",
    evaluationCriteria: [
      "Zero uses of `any` type",
      "Explicit return types on all functions",
      "Functions under 20 lines",
      "Single responsibility per function",
      "Types defined in separate files or clearly organized",
      "No type assertions without justification"
    ]
  }
];
