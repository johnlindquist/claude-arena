# claude-arena

[![npm version](https://img.shields.io/npm/v/claude-arena.svg)](https://www.npmjs.com/package/claude-arena)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

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

### Quick start (no install)

```bash
bunx claude-arena "code should follow Python's Zen principles"
```

### Global install

```bash
bun add -g claude-arena
# or
npm install -g claude-arena
```

### From source

```bash
git clone https://github.com/johnlindquist/claude-arena
cd claude-arena
bun install
bun link  # Makes 'claude-arena' available globally
```

## Usage

```bash
# Pass a system prompt directly
claude-arena "code should follow Python's Zen principles"

# Or pass a markdown file
claude-arena ./my-system-prompt.md

# Test your own CLAUDE.md configuration
claude-arena --user

# Test your CLAUDE.md with additional instructions
claude-arena --user "also enforce strict TypeScript"

# Provide your own task instead of AI-generated one
claude-arena --task "build a REST API with auth" "use TypeScript strictly"

# Change the model used for test runs (default: haiku)
claude-arena --test-model sonnet "complex prompt"

# Change the judge model (default: opus)
claude-arena --model sonnet "your prompt"

# Test fewer variations
claude-arena --variations 3 "your prompt"
```

### Running from source

```bash
# Run the tool directly
bun run start "your prompt"

# Or use the source file
bun run src/index.ts "your prompt"
```

## Output

Each run creates a timestamped directory in your system's temp folder with a complete paper trail:

```
/tmp/claude-arena-2024-01-15T10-30/
├── session-summary.md          # Overview with links to all files
├── effective-prompt.md         # The resolved system prompt being tested
├── task.md                     # The generated stress-test task
├── design-conversation.md      # Full design phase conversation
├── evaluation-conversation.md  # Full evaluation phase conversation
├── variation-0.md              # BASELINE (original prompt)
├── variation-1.md              # PERSONA variation
├── variation-2.md              # EXEMPLAR variation
├── variation-3.md              # CONSTRAINT variation
├── variation-4.md              # SOCRATIC variation
├── variation-5.md              # CHECKLIST variation
├── run-0/                      # Baseline output
│   └── output.md               # Full output transcript
├── run-1/                      # Variation 1 output
│   └── output.md
├── run-2/
│   └── output.md
└── ...
```

The final evaluation includes:
- Scores for each variation (0-12 scale: Adherence + Integration + Quality + Consistency)
- Winner with explanation
- **Optimized system prompt text** ready to paste into your CLAUDE.md

## Examples

```bash
# Design principles
claude-arena "Beautiful is better than ugly. Simple is better than complex."

# Code quality rules
claude-arena "avoid code smells: feature envy, shotgun surgery, primitive obsession"

# TDD workflow
claude-arena "always write tests before implementation, follow red-green-refactor"

# TypeScript strictness
claude-arena "never use 'any' type, always define explicit return types"

# From a file
claude-arena ./goals/zen-principles.md
```

## Development

```bash
# Install dependencies
bun install

# Run tests
bun test

# Type check
bun run typecheck

# Lint and format
bun run check
```

## Requirements

- [Bun](https://bun.sh/) >= 1.0.0
- [Claude Code CLI](https://docs.anthropic.com/en/docs/claude-code) installed and authenticated

## License

MIT
