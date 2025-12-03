import { timestamp, tmpDir } from "./const";

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

<system-prompt>
${systemPrompt}
</system-prompt>

## Task 0: FIRST - Analyze the System Prompt

Before designing variations, carefully read the ENTIRE system prompt and identify the KEY aspects:
1. **Explicit rules** - Things to ALWAYS or NEVER do
2. **Tool preferences** - Specific tools to use or avoid
3. **Workflow requirements** - Required sequences or processes
4. **Style/approach preferences** - How work should be done

Each variation must preserve ALL these key aspects while expressing them differently.

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

<system-prompt>
${systemPrompt}
</system-prompt>

## Your Tasks

### Task 0: FIRST - Analyze the System Prompt

Before designing anything, carefully read the ENTIRE system prompt above and identify:
1. **Explicit rules** - Things the AI is told to ALWAYS or NEVER do
2. **Tool preferences** - Specific tools to use or avoid (e.g., "use beads not TodoWrite", "use gemini_research not WebSearch")
3. **Workflow requirements** - Required sequences or processes
4. **Style/approach preferences** - How code should be written or structured

Write these key aspects as a numbered list in your thinking, as you'll need to ensure the task tests ALL of them.

### Task 1: Design a STRESS TEST Task

Your goal is to create a task that STRESS TESTS every rule in the system prompt. The task should push each rule to its breaking point to see when and how it kicks in.

**STRESS TEST DESIGN PRINCIPLES:**

1. **Every rule gets a scenario** - For EACH rule you identified in Task 0, the task MUST include a specific scenario that triggers that rule. Don't leave any rule untested.

2. **Maximum temptation** - Design scenarios where the EASY/DEFAULT path would violate the rule:
   - If rule says "use X not Y", create a situation where Y is the obvious first choice
   - If rule says "always do Z first", create urgency that tempts skipping Z
   - If rule says "never do W", create a situation where W seems helpful

3. **Visible decision points** - The task should force the AI to make visible choices at each rule. The output should clearly show which path was taken.

4. **Compound pressure** - Layer multiple rules in single scenarios. Example: "Research the topic, track your findings as tasks, then implement" tests research tools + task tracking + implementation approach simultaneously.

5. **Edge cases** - Include ambiguous situations where rules might conflict or where it's unclear if a rule applies.

**TASK STRUCTURE:**

The task should be a realistic coding project that naturally incorporates:
- A research/information gathering phase (tests research tool preferences)
- A planning/tracking phase (tests task management preferences)
- An implementation phase (tests coding style preferences)
- Multiple decision points where rules MUST kick in to pass

**BAD EXAMPLES:**
- "Build a todo app" ❌ (generic, doesn't stress specific rules)
- "Write a function to sort numbers" ❌ (too simple, no decision points)

**GOOD EXAMPLE:**
"Build a CLI tool that helps users find and compare npm packages. Requirements:
1. First, research current best practices for CLI argument parsing in Node.js
2. Track your implementation plan as you work
3. Implement search functionality that queries the npm registry
4. Add comparison features
5. Include tests
This should be done incrementally with progress tracking."

This example STRESS TESTS: research tool choice, task tracking tool choice, coding patterns, testing approach - all in one realistic task.

**REQUIRED: At the end of the task file, include a "Rules Coverage" section:**

\`\`\`
## Rules Coverage

This task stress tests the following rules from the system prompt:

| Rule | Scenario in Task | How It's Stressed |
|------|------------------|-------------------|
| Use beads not TodoWrite | Planning phase | Task requires tracking work progress |
| Use gemini_research not WebSearch | Research phase | Must look up current best practices |
| ... | ... | ... |
\`\`\`

If any rule from Task 0 is NOT covered, you MUST revise the task to include it.

Write the task to: ${outputDir}/task.md

### Task 2: Generate ${variations} System Prompt Variations

Create ${variations} different ways to express the system prompt as CLAUDE.md-style instructions.

**IMPORTANT: Keep variations CONCISE** - Each variation should be under 3000 characters.
Focus on the KEY rules identified in Task 0, not every detail.
A shorter, focused variation is better than a long, verbose one.

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
	outputDir: string,
): string {
	const variationSummaries = variations
		.map((v) => `${v.number}. **${v.strategy}**: ${v.summary}`)
		.join("\n");

	// Truncate long outputs to avoid context overflow
	const MAX_OUTPUT_LENGTH = 8000;
	const truncateOutput = (output: string): string => {
		if (output.length <= MAX_OUTPUT_LENGTH) return output;
		const half = Math.floor(MAX_OUTPUT_LENGTH / 2);
		return `${output.slice(0, half)}\n\n[... ${(output.length - MAX_OUTPUT_LENGTH).toLocaleString()} characters truncated ...]\n\n${output.slice(-half)}`;
	};

	const resultBlocks = results
		.map((r) => {
			const varInfo = variations.find((v) => v.number === r.variationNumber);
			const outputDisplay = truncateOutput(r.output);
			const wasTruncated = r.output.length > MAX_OUTPUT_LENGTH;
			return `
### Variation ${r.variationNumber}: ${varInfo?.strategy || "UNKNOWN"}

**Project Path**: \`${outputDir}/run-${r.variationNumber}\`
${wasTruncated ? `**Note**: Output truncated from ${r.output.length.toLocaleString()} chars for evaluation. Full output in project path.` : ""}

<output>
${outputDisplay}
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

### Variation 1: ${variations.find((v) => v.number === 1)?.strategy || "PERSONA"}
**Project**: \`${outputDir}/run-1\`

[Code output analysis]
Scores: Adherence=X, Integration=X, Quality=X, Consistency=X
Total: X/12
Improvement over baseline: +/- X points

### Variation 2: ${variations.find((v) => v.number === 2)?.strategy || "EXEMPLAR"}
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
export function buildVariationArgs(taskPath: string, variationPath: string): string[] {
	return [
		"claude",
		"--model",
		"haiku",
		"--print",
		`git init && complete this task in full: $(cat ${taskPath}) --- CRITICAL: Once complete, diff all of the changed files back to the user. NEVER SUMMARIZE!`,
		"--permission-mode",
		"bypassPermissions",
		"--append-system-prompt",
		`$(cat ${variationPath})`,
		"--setting-sources",
		"",
		"--mcp-config",
		JSON.stringify({ mcpServers: {} }),
	];
}

/**
 * Step 3: Evaluation continuation message - sent to the same session that did design
 * Since we're resuming the session, we don't need to repeat context - the judge remembers
 */
export function buildEvaluationMessage(
	task: string,
	variations: VariationInfo[],
	results: VariationResult[],
	outputDir: string,
): string {
	// Truncate long outputs to avoid context overflow
	const MAX_OUTPUT_LENGTH = 8000;
	const truncateOutput = (output: string): string => {
		if (output.length <= MAX_OUTPUT_LENGTH) return output;
		const half = Math.floor(MAX_OUTPUT_LENGTH / 2);
		return `${output.slice(0, half)}\n\n[... ${(output.length - MAX_OUTPUT_LENGTH).toLocaleString()} characters truncated ...]\n\n${output.slice(-half)}`;
	};

	const resultBlocks = results
		.map((r) => {
			const varInfo = variations.find((v) => v.number === r.variationNumber);
			const outputDisplay = truncateOutput(r.output);
			const wasTruncated = r.output.length > MAX_OUTPUT_LENGTH;
			return `
### Variation ${r.variationNumber}: ${varInfo?.strategy || "UNKNOWN"}

**Project Path**: \`${outputDir}/run-${r.variationNumber}\`
${wasTruncated ? `**Note**: Output truncated from ${r.output.length.toLocaleString()} chars. Full output in project path.` : ""}

<output>
${outputDisplay}
</output>

Exit code: ${r.exitCode}
`;
		})
		.join("\n");

	return `## Test Results Are In!

The variations you designed have been executed. Here are the results:

**Task that was executed:**
${task}

**Results from each variation:**
${resultBlocks}

## Your Evaluation

Now evaluate which variation performed best. You already know:
- The original system prompt being tested
- The variations you designed and why

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

### Variation 1: [STRATEGY]
**Project**: \`${outputDir}/run-1\`

[Code output analysis]
Scores: Adherence=X, Integration=X, Quality=X, Consistency=X
Total: X/12
Improvement over baseline: +/- X points

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
- Focus on what actually worked in the outputs, not theoretical advantages

Begin your evaluation.`;
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
