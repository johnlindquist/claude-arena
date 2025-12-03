# claude-arena

**Find the most effective way to write your CLAUDE.md system prompts.**

Give claude-arena a system prompt, and it will test 5 different ways of expressing it—then tell you which one works best.

## How It Works

```
Your System Prompt
       ↓
┌──────────────────────────────────────┐
│  1. DESIGN PHASE (Opus)              │
│     • Generates a revealing task     │
│     • Creates 5 prompt variations    │
└──────────────────────────────────────┘
       ↓
┌──────────────────────────────────────┐
│  2. TEST PHASE (Haiku × 5 parallel)  │
│     • Runs task with each variation  │
│     • Captures all outputs           │
└──────────────────────────────────────┘
       ↓
┌──────────────────────────────────────┐
│  3. EVALUATION PHASE (Opus)          │
│     • Scores each variation          │
│     • Recommends the winner          │
│     • Outputs optimized prompt       │
└──────────────────────────────────────┘
```

## The 5 Variation Strategies

| Strategy | Approach |
|----------|----------|
| **PERSONA** | Role-based identity framing. Make the AI embody a specific expert. |
| **EXEMPLAR** | Show, don't tell. Lead with concrete before/after code examples. |
| **CONSTRAINT** | Hard rules with tripwires. Use MUST/NEVER/ALWAYS with violation callouts. |
| **SOCRATIC** | Why-first philosophy. Explain reasoning before the rule. |
| **CHECKLIST** | Gated process with verification steps before each action. |

## Installation

```bash
git clone https://github.com/johnlindquist/claude-arena
cd claude-arena
bun install
```

## Usage

```bash
# Pass a system prompt directly
bun run check "code should follow Python's Zen principles"

# Or pass a markdown file
bun run check ./my-system-prompt.md

# Options
bun run check --model sonnet "your prompt"     # Use Sonnet as judge (default: opus)
bun run check --variations 3 "your prompt"     # Test fewer variations (default: 5)
```

## Output

Each run creates a timestamped directory in your system's temp folder:

```
/tmp/claude-arena-2024-01-15T10-30/
├── task.md           # The generated coding task
├── variation-1.md    # PERSONA variation
├── variation-2.md    # EXEMPLAR variation
├── variation-3.md    # CONSTRAINT variation
├── variation-4.md    # SOCRATIC variation
├── variation-5.md    # CHECKLIST variation
├── run-1/            # Haiku's output for variation 1
├── run-2/            # Haiku's output for variation 2
├── run-3/            # ...
├── run-4/
└── run-5/
```

The final evaluation includes:
- Scores for each variation (0-12 scale: Adherence + Integration + Quality + Consistency)
- Winner with explanation
- **Optimized system prompt text** ready to paste into your CLAUDE.md

## Examples

```bash
# Design principles
bun run check "Beautiful is better than ugly. Simple is better than complex."

# Code quality rules
bun run check "avoid code smells: feature envy, shotgun surgery, primitive obsession"

# TDD workflow
bun run check "always write tests before implementation, follow red-green-refactor"

# TypeScript strictness
bun run check "never use 'any' type, always define explicit return types"

# From a file
bun run check ./goals/zen-principles.md
```

## Requirements

- [Bun](https://bun.sh/) >= 1.0.0
- [Claude Code CLI](https://docs.anthropic.com/en/docs/claude-code) installed and authenticated

## License

MIT
