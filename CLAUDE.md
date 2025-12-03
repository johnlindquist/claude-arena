# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

claude-arena is a CLI tool that evaluates and optimizes system prompt effectiveness. It takes a system prompt, generates variations using different strategies (PERSONA, EXEMPLAR, CONSTRAINT, SOCRATIC, CHECKLIST), runs them against a test task, and recommends the most effective version.

## Commands

```bash
# Development
bun run start "your prompt"     # Run the tool
bun run src/index.ts "prompt"   # Alternative: run directly
bun test                        # Run tests (vitest)
bun run typecheck               # Type check (tsc --noEmit)
bun run check                   # Lint and format (biome check --write .)
bun run ci                      # CI checks (biome check . && tsc --noEmit)

# Run single test file
bun test src/args-parser.test.ts
```

## Architecture

The tool runs in three phases using Claude CLI:

1. **Design Phase** (Opus) - Generates a stress-test task and 5 prompt variations
2. **Test Phase** (Haiku × 6 parallel) - Runs baseline + variations in sandboxed environments
3. **Evaluation Phase** (Opus) - Scores outputs and recommends the best approach

### Key Files

- `src/index.ts` - Main entry point, orchestrates the three phases, handles CLI args and user interaction
- `src/prompts.ts` - Prompt builders for design/evaluation phases, defines the 5 variation strategies
- `src/stream-parser.ts` - Parses Claude CLI's stream-json output format, extracts text/tool usage
- `src/import-resolver.ts` - Resolves `@~/path.md` imports in CLAUDE.md files recursively
- `src/variation-parser.ts` - Extracts variation metadata from design phase JSON output
- `src/args-parser.ts` - CLI argument parsing (--model, --user, --task, etc.)
- `src/prompt-input.ts` - Interactive prompts (selectOption, confirm)
- `src/const.ts` - Shared constants (tmpDir, timestamp)
- `src/types.ts` - TypeScript interfaces (mostly legacy, main types in prompts.ts)

### Data Flow

```
User prompt → resolveImports() → buildDesignPrompt()
    ↓
runClaude() spawns claude CLI → parseStreamJson() captures output
    ↓
task.md + variation-{1-5}.md written to temp dir
    ↓
runVariation() × 6 parallel (baseline + variations) in sandboxed workdirs
    ↓
buildEvaluationPrompt() with all outputs → final recommendation
```

### Claude CLI Integration

The tool spawns `claude` CLI processes with specific flags:
- `--output-format stream-json` for real-time streaming
- `--permission-mode bypassPermissions` for automated runs
- `--setting-sources ""` for isolated variations (no user config)
- `--append-system-prompt` to inject variation content
- `--sandbox` enabled with auto-allow for file operations

## Code Style

- Uses Biome for linting/formatting
- TypeScript strict mode with `noUncheckedIndexedAccess`
- Bun runtime (not Node.js)
- ESM modules with `.ts` extensions in imports
