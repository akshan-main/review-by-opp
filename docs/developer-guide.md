# Developer Guide

## Prerequisites

- Node.js 20+
- npm

## Setup

```bash
git clone https://github.com/review-by-opp/review-by-opp.git
cd review-by-opp
npm install
```

## Build

```bash
npm run build    # Compile TypeScript
npm run lint     # Type check only (tsc --noEmit)
npm run clean    # Remove dist/
```

## Test

```bash
npm test         # Run compiled tests
npm run test:src # Run tests directly from source (uses tsx)
```

Tests use Node.js built-in `node:test` runner and `node:assert/strict`. No test framework dependency.

## Project structure

```
src/
  core/
    types.ts          # All type definitions
    config.ts         # Config loading and validation
    ledger.ts         # Ledger engine (session, findings, exit gate)
    convergence.ts    # Convergence detection
  codex/
    detector.ts       # Codex CLI detection
    reviewer.ts       # Codex review invocation and parsing
  utils/
    git.ts            # Git utilities
    checks.ts         # Test/lint/typecheck runners
    format.ts         # Output formatting
  tests/
    ledger.test.ts    # Ledger tests
    convergence.test.ts # Convergence tests
    config.test.ts    # Config tests
    parser.test.ts    # Parser tests
  index.ts            # Public API exports

skills/               # SKILL.md files (Claude instructions)
hooks/                # Hook definitions (JSON)
scripts/              # Hook scripts (shell)
```

## Adding a new skill

1. Create `skills/<name>/SKILL.md`
2. Add frontmatter:
   ```yaml
   ---
   name: my-skill
   description: When to use this skill
   user-invocable: true
   allowed-tools: Read, Grep, Glob, Bash
   ---
   ```
3. Write instructions for Claude below the frontmatter
4. Test: `claude --plugin-dir .` then `/review-by-opp:my-skill`

## Adding a new hook

1. Add the event to `hooks/hooks.json`
2. Create the script in `scripts/`
3. Make it executable: `chmod +x scripts/my-hook.sh`
4. Use `${CLAUDE_PLUGIN_ROOT}` for paths

## Key design constraints

- **No external runtime dependencies** - Only Node.js built-ins
- **Skills are instructions** - SKILL.md files tell Claude what to do; they don't contain executable code
- **Stop gate is a shell script** - Deterministic, not LLM-based
- **State is JSON** - Easy to inspect, diff, and debug
- **Codex is auditor-only** - Never edits files

## Testing locally

```bash
npm run build && claude --plugin-dir .
```

Then try:
```
/review-by-opp:start
/review-by-opp:status
```
