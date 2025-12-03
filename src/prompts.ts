import { tmpDir, timestamp } from "./const";

const VARIATION_STRATEGIES = `
1. **PERSONA** - Role-based identity framing. Make the AI embody a specific expert.
   Example: "You are a battle-hardened TDD practitioner who has seen too many production bugs from untested code. You physically cannot write implementation before a failing test exists."

2. **EXEMPLAR** - Show, don't tell. Lead with concrete before/after code examples, minimal explanation.
   Example: "❌ BAD: function add(a,b) { return a+b; } // tests later... ✅ GOOD: test('adds numbers', () => { expect(add(2,3)).toBe(5); }); // NOW implement"

3. **CONSTRAINT** - Hard rules with tripwires. Use MUST/NEVER/ALWAYS with explicit violation callouts.
   Example: "INVARIANT: No function body may exist without a preceding test. VIOLATION CHECK: If you're writing logic before a test, STOP. Delete it. Write the test first."

4. **SOCRATIC** - Why-first philosophy. Explain the reasoning before the rule.
   Example: "Tests written after code are rationalizations. Tests written before are specifications. The test IS the design—it forces you to think about interface before implementation."

5. **CHECKLIST** - Gated process with verification steps before each action.
   Example: "Before ANY code: □ Written failing test? □ Seen RED? □ Writing MINIMUM to pass? □ After GREEN, what to refactor? If unchecked, STOP."
`;

/**
 * Step 1a: Variations-only prompt - when user provides their own task
 */
export function buildVariationsOnlyPrompt(systemPrompt: string, variations: number): string {
   const outputDir = `${tmpDir}/${timestamp}`;

   return `You are a SYSTEM PROMPT VARIATION DESIGNER.

Your job is to create ${variations} system prompt variations to test.

## 🚨 CRITICAL RESTRICTIONS 🚨

You are running inside the claude-arena tool directory. DO NOT:
- Read ANY .ts, .js, .json, or source files in this directory
- Explore or analyze the tool's own codebase
- Use Glob, Grep, or Read on any source files

You ONLY need to write files to: ${outputDir}

## The System Prompt to Evaluate

"${systemPrompt}"

## Your Task: Generate ${variations} System Prompt Variations

Create ${variations} different ways to express the system prompt as CLAUDE.md-style instructions.
Each variation should use a DIFFERENT STRATEGY:
${VARIATION_STRATEGIES}

Write each variation to a separate file:
- ${outputDir}/variation-1.md
- ${outputDir}/variation-2.md
- ... through variation-${variations}.md

## Output

After writing all files, output a JSON summary:

\`\`\`json
{
  "variations": [
    { "number": 1, "strategy": "PERSONA", "summary": "Brief description" },
    { "number": 2, "strategy": "EXEMPLAR", "summary": "Brief description" },
    ...
  ]
}
\`\`\`

Begin now - write all variation files.`;
}

/**
 * Step 1b: Design prompt - generates task.md and variation-*.md files
 */
export function buildDesignPrompt(systemPrompt: string, variations: number): string {
   const outputDir = `${tmpDir}/${timestamp}`;

   return `You are a SYSTEM PROMPT VARIATION DESIGNER.

Your job is to create a revealing task and ${variations} system prompt variations to test.

## 🚨 CRITICAL RESTRICTIONS 🚨

You are running inside the claude-arena tool directory. DO NOT:
- Read ANY .ts, .js, .json, or source files in this directory
- Explore or analyze the tool's own codebase
- Use Glob, Grep, or Read on any source files

You ONLY need to write files to: ${outputDir}

## The System Prompt to Evaluate

"${systemPrompt}"

## Your Tasks

### Task 1: Design a Revealing Coding Task

Create a coding task that would clearly reveal whether every aspect of the system prompt is being followed.

CRITICAL: The system prompt may have multiple aspects, so the task should reveal whether all aspects are being followed, implied or explicit.

The task should:
- Be specific enough to generate actual code
- Be complex enough to expose differences in approach
- Naturally surface violations of the system prompt

Example: If system prompt is "follow TDD", task might be "implement a URL shortener service"
Example: If system prompt is "avoid code smells", task might be "refactor this legacy function: [provide messy code]"

Write the task to: ${outputDir}/task.md

### Task 2: Generate ${variations} System Prompt Variations

Create ${variations} different ways to express the system prompt as CLAUDE.md-style instructions.
Each variation should use a DIFFERENT STRATEGY:
${VARIATION_STRATEGIES}

Write each variation to a separate file:
- ${outputDir}/variation-1.md
- ${outputDir}/variation-2.md
- ... through variation-${variations}.md

## Output

After writing all files, output a JSON summary:

\`\`\`json
{
  "task": "Brief description of the task",
  "variations": [
    { "number": 1, "strategy": "PERSONA", "summary": "Brief description" },
    { "number": 2, "strategy": "EXEMPLAR", "summary": "Brief description" },
    ...
  ]
}
\`\`\`

Begin now - write the task and all variation files.`;
}

/**
 * Step 3: Evaluation prompt - takes captured outputs and evaluates them
 */
export function buildEvaluationPrompt(
   systemPrompt: string,
   task: string,
   variations: VariationInfo[],
   results: VariationResult[],
   outputDir: string
): string {
   const variationSummaries = variations
      .map((v) => `${v.number}. **${v.strategy}**: ${v.summary}`)
      .join("\n");

   const resultBlocks = results
      .map((r) => {
         const varInfo = variations.find(v => v.number === r.variationNumber);
         return `
### Variation ${r.variationNumber}: ${varInfo?.strategy || "UNKNOWN"}

**Project Path**: \`${outputDir}/run-${r.variationNumber}\`

<output>
${r.output}
</output>

Exit code: ${r.exitCode}
`;
      })
      .join("\n");

   return `You are a SYSTEM PROMPT EFFECTIVENESS EVALUATOR.

Your job is to evaluate which system prompt variation best achieved the objective.

## Original System Prompt Being Tested

"${systemPrompt}"

## Task That Was Given

${task}

## Variations Tested

${variationSummaries}

## Results from Each Variation

${resultBlocks}

## Your Evaluation

For each output, score on:

| Criteria | Score (0-3) |
|----------|-------------|
| System Prompt Adherence | How well did the code follow the system prompt? |
| Natural Integration | Did it feel forced or natural? |
| Code Quality | Overall quality of the output |
| Consistency | Would this approach work for similar tasks? |

## Output Format

\`\`\`
## Results

### Variation 0: BASELINE (Original System Prompt)
**Project**: \`${outputDir}/run-0\`

[Code output analysis - this is the BASELINE to compare against]
Scores: Adherence=X, Integration=X, Quality=X, Consistency=X
Total: X/12

### Variation 1: ${variations.find(v => v.number === 1)?.strategy || "PERSONA"}
**Project**: \`${outputDir}/run-1\`

[Code output analysis]
Scores: Adherence=X, Integration=X, Quality=X, Consistency=X
Total: X/12
Improvement over baseline: +/- X points

### Variation 2: ${variations.find(v => v.number === 2)?.strategy || "EXEMPLAR"}
**Project**: \`${outputDir}/run-2\`

...
(continue for all variations)

## Recommendation

**Winner**: Variation N (STYLE)
**Score**: X/12
**Improvement over Baseline**: +/- X points

**Why it worked** (or why baseline was best):
- ...

**Optimized Version**:
\\\`\\\`\\\`markdown
[The best system prompt text to use - improved based on what worked]
\\\`\\\`\\\`
\`\`\`

## Important Notes

- Variation 0 (BASELINE) is the original system prompt - use it as the reference point
- If no variation beats the baseline, recommend keeping the original
- Be objective - don't favor verbose over terse just because it's more detailed
- The objective is EFFECTIVENESS, not length or style preference
- If multiple variations tie, prefer the simpler one
- Provide actionable feedback the user can immediately apply
- Focus on what actually worked in the outputs, not theoretical advantages

Begin your evaluation.`;
}

/**
 * Get the output directory path
 */
export function getOutputDir(): string {
   return `${tmpDir}/${timestamp}`;
}

/**
 * Build the claude command args for running a variation
 */
export function buildVariationArgs(
   taskPath: string,
   variationPath: string
): string[] {
   return [
      "claude",
      "--model", "haiku",
      "--print",
      `git init && complete this task in full: $(cat ${taskPath}) --- CRITICAL: Once complete, diff all of the changed files back to the user. NEVER SUMMARIZE!`,
      "--permission-mode", "bypassPermissions",
      "--append-system-prompt", `$(cat ${variationPath})`,
      "--setting-sources", "",
      "--mcp-config", JSON.stringify({ mcpServers: {} }),
   ];
}

// Types
export interface VariationInfo {
   number: number;
   strategy: string;
   summary: string;
}

export interface VariationResult {
   variationNumber: number;
   output: string;
   exitCode: number;
}

// Legacy exports for backwards compatibility
export const DEFAULT_PREFERENCES = [];
