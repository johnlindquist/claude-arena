# claude-checker

**Evaluate and optimize instruction effectiveness** - find the best way to express your coding goals in CLAUDE.md.

## What It Does

Given a goal like "code should follow Python's Zen principles", claude-checker:

1. **Generates a revealing task** - Creates a coding task that would expose whether the goal is followed
2. **Creates 5 instruction variations** - Different styles of expressing the same goal:
   - **Terse** - Minimal bullet points
   - **Clear** - Reworded for clarity
   - **Exhaustive** - Comprehensive with examples
   - **Visual** - Diagrams, tables, structured format
   - **Reframed** - Flipped framing (negative→positive)
3. **Runs each variation** - Tests each against the task using Haiku
4. **Evaluates and recommends** - Scores each approach and suggests the best instruction text

## Installation

```bash
# Clone and install
git clone https://github.com/johnlindquist/claude-checker
cd claude-checker
bun install
```

## Usage

```bash
# Basic usage - evaluate a goal
bun run check "code should follow Python's Zen principles"

# Use Opus as judge (more thorough but slower)
bun run check --model opus "avoid code smells: feature envy, shotgun surgery"

# Test fewer variations
bun run check --variations 3 "use TDD: write tests before implementation"
```

## Examples

### Design Principles
```bash
bun run check "Beautiful is better than ugly. Explicit is better than implicit. Simple is better than complex."
```

### Code Smells
```bash
bun run check "avoid code smells: feature envy, shotgun surgery, primitive obsession, data clumps"
```

### TDD
```bash
bun run check "always write tests before implementation, follow red-green-refactor"
```

### TypeScript Strictness
```bash
bun run check "never use 'any' type, always define explicit return types"
```

## How It Works

The judge (Sonnet by default) orchestrates the entire experiment:

```
Your Goal
    ↓
Judge generates task + 10 variations
    ↓
Haiku runs task with each variation
    ↓
Judge scores and compares results
    ↓
Recommendation: best instruction style + optimized text
```

## Output

You'll get:
- Scores for each variation (0-12 scale)
- Side-by-side comparison of how each performed
- Winner with explanation
- **Optimized instruction text** ready to paste into your CLAUDE.md

## Requirements

- [Bun](https://bun.sh/) >= 1.0.0
- [Claude Code CLI](https://claude.ai/code) installed and authenticated
- API access (uses Haiku for tests, Sonnet/Opus for judging)

## License

MIT
