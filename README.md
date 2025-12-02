# claude-checker

Test your CLAUDE.md behavioral compliance. Verify that Claude Code actually follows your coding preferences.

## The Problem

Your CLAUDE.md contains instructions like "Always use TDD", "Add logging to every function", or "Never use `any` in TypeScript". But how do you know Claude actually follows these when writing code?

## The Solution

claude-checker spawns an **isolated AI judge** that:

1. Runs tests with **no CLAUDE.md** (baseline)
2. Runs the same tests **with your CLAUDE.md** (configured)
3. Compares the outputs to measure behavioral compliance
4. Suggests improvements to strengthen weak rules

## Installation

```bash
# Clone and install
git clone https://github.com/johnlindquist/claude-checker.git
cd claude-checker
bun install

# Or install globally
bun install -g
```

## Requirements

- [Bun](https://bun.sh) runtime
- [Claude Code CLI](https://claude.ai/code) installed and authenticated

## Usage

### Basic Check

Test your user CLAUDE.md (`~/.claude/CLAUDE.md`):

```bash
bun run check
# or
claude-checker
```

### Test Project CLAUDE.md

Test the project-level CLAUDE.md (`./.claude/CLAUDE.md`):

```bash
bun run check -- --source project
```

### Test Against Existing Codebase

Run compliance tests against a real project (uses git worktrees for safety):

```bash
bun run check:project
# or
claude-checker-project --project ~/dev/my-app
```

### A/B Compare Two CLAUDE.md Files

Compare which version better enforces your preferences:

```bash
bun run compare -- ~/.claude/CLAUDE.md.old ~/.claude/CLAUDE.md
```

### CI Mode

Get JSON output for CI pipelines:

```bash
bun run ci
# Returns JSON with pass/fail and exits 0/1
```

## How It Works

### Complete Isolation

The judge runs with special flags that ensure unbiased evaluation:

```bash
claude --model opus \
  --setting-sources ""           # NO CLAUDE.md loaded
  --strict-mcp-config            # NO MCP servers
  --mcp-config '{"mcpServers":{}}'
```

### Default Preferences Tested

1. **Rigorous TDD** - Tests written before implementation
2. **Observability & Logging** - Structured logging in every function
3. **Clean Modular TypeScript** - No `any`, small functions, explicit types

### Custom Preferences

Create your own preferences file:

```json
{
  "preferences": [
    {
      "name": "Error Handling",
      "description": "Use Result types instead of exceptions.",
      "evaluationCriteria": [
        "Returns Result<T, Error> instead of throwing",
        "Error types are specific and documented"
      ]
    }
  ]
}
```

Then run:

```bash
claude-checker --preferences ./my-preferences.json
```

## Project Testing Safety

When testing against existing projects, claude-checker:

1. **Requires git** - No git = no safety net
2. **Creates a worktree** - Isolated copy in `/tmp`
3. **Never commits** - Judge is instructed to avoid git writes
4. **Auto-cleans up** - Worktree removed after testing

## Options

| Flag | Description | Default |
|------|-------------|---------|
| `--claude-md <path>` | Path to CLAUDE.md | `~/.claude/CLAUDE.md` |
| `--source <user\|project>` | Setting source to test | `user` |
| `--model <model>` | Judge model (opus, sonnet, haiku) | `opus` |
| `--preferences <file>` | Custom preferences JSON | built-in |
| `--help` | Show help | - |

## Cost Considerations

| Role | Model | Cost | Purpose |
|------|-------|------|---------|
| Judge | Opus | ~$15-30/1M tokens | Nuanced evaluation |
| Test subject | Haiku | ~$0.25-0.50/1M tokens | Bulk testing |

For cost-sensitive testing, use `--model sonnet` for the judge.

## Example Output

```
🧪 claude-checker - CLAUDE.md Behavioral Compliance Tester
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CLAUDE.md:      /Users/you/.claude/CLAUDE.md
Setting source: user
Judge model:    opus
Preferences:    3
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## Evaluating: Rigorous TDD

| Aspect | Baseline | Configured | Δ |
|--------|----------|------------|---|
| Tests first | 0 | 3 | +3 |
| Coverage | 0 | 3 | +3 |

**Verdict:** Your CLAUDE.md successfully enforces TDD.
```

## License

MIT
