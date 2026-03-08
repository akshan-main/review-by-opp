# Architecture

## Overview

review-by-opp is a Claude Code plugin with a TypeScript core engine. The plugin uses SKILL.md files for Claude-facing commands, a shell-based stop gate hook, and a local JSON ledger for state.

## Plugin structure

```
.claude-plugin/plugin.json   → Plugin manifest (name, skills, hooks)
.claude-plugin/marketplace.json → Marketplace manifest for git-hosted distribution
skills/                       → 6 SKILL.md files (start, review, fix, status, resume, finalize)
hooks/hooks.json              → Hook definitions (Stop event)
scripts/stop-gate.sh          → Stop gate enforcement script
src/                          → TypeScript core engine
```

## Core modules

| Module | Purpose |
|--------|---------|
| `core/types.ts` | All type definitions (Finding, LedgerState, Config, etc.) |
| `core/config.ts` | Config loading from `.review-by-opp.json` with defaults |
| `core/ledger.ts` | Session management, finding CRUD, exit gate, persistence |
| `core/convergence.ts` | Convergence detection (stall, stability, max rounds) |
| `codex/detector.ts` | Codex CLI detection and capability probing |
| `codex/reviewer.ts` | Codex review invocation and output parsing |
| `utils/git.ts` | Git repo status and diff info |
| `utils/checks.ts` | Test/lint/typecheck runners |
| `utils/format.ts` | Status and finding formatters |

## Data flow

```
User writes code
    ↓
/review-by-opp:review  →  Codex CLI exec --sandbox read-only
    ↓
Raw Codex output  →  parseCodexOutput()  →  Finding[]
    ↓
addFindings()  →  deduplicateFindings()  →  LedgerState
    ↓
persist()  →  reviews/current.json
    ↓
/review-by-opp:fix  →  Claude addresses each finding  →  resolveFinding()
    ↓
checkConvergence()  →  should_stop? / continue?
    ↓
/review-by-opp:finalize  →  checkExitGate()  →  pass/fail
```

## Hook system

The `Stop` hook fires when Claude attempts to complete. The `stop-gate.sh` script:

1. Reads `reviews/current.json`
2. If no session exists or session is finalized → allow stop
3. Checks for blocking findings (open + blocking severity)
4. Checks for missing/invalid resolution states
5. Checks for fixed findings without resolution notes
6. Exits non-zero if blocked → Claude cannot stop

## Persistence

All state is JSON in `reviews/`:
- `current.json` - Full ledger state
- `rounds/round-N.json` - Per-round snapshots
- `summaries/summary-N.json` - Per-round summaries
- `artifacts/round-N-*.txt` - Raw review/check outputs for debugging

## Design principles

1. **No external runtime deps** - Only Node.js built-ins
2. **Skills are instructions, not code** - Claude interprets SKILL.md at runtime
3. **Stop gate is deterministic** - Shell script, not LLM judgment
4. **State is inspectable** - JSON files you can read, diff, and debug
