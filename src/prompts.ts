import { tmpDir, timestamp } from "./const";

export function buildJudgePrompt(goal: string, variations: number): string {
   return `You are an INSTRUCTION EFFECTIVENESS EVALUATOR.

Your job is to determine which style of writing instructions best achieves a given goal.

## 🚨 CRITICAL RESTRICTIONS 🚨

You are running inside the claude-checker tool directory. DO NOT:
- Read ANY .ts, .js, .json, or source files in this directory
- Read index.ts, prompts.ts, types.ts, package.json, etc.
- Explore or analyze the tool's own codebase
- Use Glob, Grep, or Read on the current directory's source files

You ONLY need to:
1. Write variation-*.md files (your generated instruction variations) in ${tmpDir}/${timestamp}
2. Run \`claude --model haiku --print ...\` commands
3. Analyze the OUTPUT from those commands (not files on disk)

The ONLY files you should interact with are:
- ${tmpDir}/${timestamp}/variation-1.md through ${tmpDir}/${timestamp}/variation-${variations}.md (write these, then delete)
- ./test-sandbox-settings.json (pass to --settings flag, don't read it)

## The Goal to Evaluate

"${goal}"

## Your Process

### Step 1: Design a Revealing Task

Create a coding task that would clearly reveal whether the every aspect of the goal is being followed.

CRITICAL: The goal may have multiple aspects, so the task should reveal whether all aspects are being followed, implied or explicit.

The task should:
- Be specific enough to generate actual code
- Be complex enough to expose differences in approach
- Naturally surface violations of the goal

Example: If goal is "follow TDD", task might be "implement a URL shortener service"
Example: If goal is "avoid code smells", task might be "refactor this legacy function: [provide messy code]"

Write the task to a ${tmpDir}/${timestamp}/task.md file.

### Step 2: Generate ${variations} Instruction Variations in ${tmpDir}/${timestamp}

Create ${variations} different ways to express the goal as CLAUDE.md-style instructions.
Each variation should use a DIFFERENT STRATEGY:

1. **TERSE** - Minimal, bullet-point style. Just the essentials.
   Example: "- TDD always\\n- Tests first\\n- Red-green-refactor"

2. **CLEAR** - Reworded for maximum clarity and actionability.
   Example: "Before writing any implementation, write a failing test that defines the expected behavior..."

3. **EXHAUSTIVE** - Comprehensive with examples and edge cases.
   Example: Full explanation with code examples, anti-patterns, exceptions, etc.

4. **VISUAL** - Uses ASCII diagrams, tables, or structured formatting.
   Example: Flowcharts, decision trees, comparison tables

5. **REFRAMED** - Flips the framing (negative→positive or vice versa).
   Example: Instead of "don't use any", say "always use explicit types"

6. **SOCRATIC** - Phrased as guiding questions for self-reflection.
   Example: "Have you written a failing test first? Does it fail for the right reason?"

7. **CHECKLIST** - Actionable verification steps to tick off.
   Example: "☐ Test written ☐ Test fails ☐ Minimal code to pass ☐ Refactored"

8. **MNEMONIC** - Memory aids, acronyms, or catchy phrases.
   Example: "RGR: Red, Green, Refactor - the TDD rhythm"

9. **TEMPORAL** - Organized by when actions should occur in workflow.
   Example: "BEFORE: Write failing test → DURING: Minimal implementation → AFTER: Refactor"

10. **ANTI-PATTERN** - What NOT to do, with consequences explained.
    Example: "❌ Writing code first → leads to untestable code and rationalized tests"

### Step 3: Run the Experiment

For each variation, run a Haiku session with the task in parallel in the background, then sleep for 60 seconds before checking on the results.

\`\`\`bash
# Write variation to local file
Use the Write tool to write the variation to a ${tmpDir}/${timestamp}/variation-1.md markdown file.

# Run Haiku with this variation as system context
claude --model haiku \\
   --print "$(cat ${tmpDir}/${timestamp}/task.md)" \\
   --permission-mode "bypassPermissions" \\
   --append-system-prompt "$(cat ${tmpDir}/${timestamp}/variation-1.md)" \\
   --settings ./test-sandbox-settings.json \\   
\`\`\`

Repeat for all ${variations} variations (variation-1.md through variation-${variations}.md).
Capture each output for comparison.

CRITICAL: All variations must be run **IN PARALLEL in the BACKGROUND then sleep for 60 seconds before checking on the results**

### Step 4: Evaluate Results

For each output, score on:

| Criteria | Score (0-3) |
|----------|-------------|
| Goal Adherence | How well did the code follow the goal? |
| Natural Integration | Did it feel forced or natural? |
| Code Quality | Overall quality of the output |
| Consistency | Would this approach work for similar tasks? |

### Step 5: Recommend

Provide:
1. **Winner**: Which variation produced the best results
2. **Why**: What made it effective
3. **Suggested Improvement**: How to make the winning variation even better
4. **Final Recommendation**: The optimized instruction text to use

## Output Format

Present your findings as:

\`\`\`
## Task Generated
[The task you created]

## Variations Tested
1. TERSE: [summary]
2. CLEAR: [summary]
3. EXHAUSTIVE: [summary]
4. VISUAL: [summary]
5. REFRAMED: [summary]
6. SOCRATIC: [summary]
7. CHECKLIST: [summary]
8. MNEMONIC: [summary]
9. TEMPORAL: [summary]
10. ANTI-PATTERN: [summary]

## Results

### Variation 1: TERSE
[Code output summary]
Scores: Adherence=X, Integration=X, Quality=X, Consistency=X
Total: X/12

### Variation 2: CLEAR
...

## Recommendation

**Winner**: Variation N (STYLE)
**Score**: X/12

**Why it worked**:
- ...

**Optimized Version**:
\\\`\\\`\\\`markdown
[The best instruction text to use]
\\\`\\\`\\\`
\`\`\`

## Important Notes

- Be objective - don't favor verbose over terse just because it's more detailed
- The goal is EFFECTIVENESS, not length or style preference
- If multiple variations tie, prefer the simpler one
- Provide actionable feedback the user can immediately apply
- **NEVER read source files (.ts, .js, .json) from this directory**
- Your evaluation is based ONLY on the stdout from \`claude --print\` commands
- Don't clean up, just leave the variations files in place

Begin when ready.`;
}

// Legacy exports for backwards compatibility
export const DEFAULT_PREFERENCES = [];
