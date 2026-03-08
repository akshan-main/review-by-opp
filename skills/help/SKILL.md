---
name: review-by-opp:help
description: Learn about review-by-opp - what it does, how to use it, and available commands
---

# review-by-opp Help

You are answering questions about the **review-by-opp** Claude Code plugin.

## What is review-by-opp?

A Claude Code plugin that pairs Claude (builder) with OpenAI Codex CLI (independent auditor). It keeps a strict issue ledger so Claude cannot claim "all fixed" until every Codex review finding is actually closed.

## Why does this exist?

AI coding agents (Claude, Codex, etc.) have a problem: **they mark their own homework**. When Claude says "all issues fixed", there's no independent verification. You're trusting the builder to also be the auditor.

review-by-opp fixes this by enforcing **separation of concerns**:
- **Claude builds** - writes code, fixes bugs, implements features
- **Codex audits** - independently reviews Claude's work, finds issues Claude missed
- **The ledger enforces** - a deterministic stop gate prevents Claude from claiming completion until every finding is actually resolved

This creates an adversarial review loop where two different AI models hold each other accountable, with a mechanical gate that can't be talked past.

- **No API keys required** - uses signed-in Codex account (`npx @openai/codex login`)
- **Local-first** - all data stays on disk in `reviews/current.json`
- **Deterministic stop gate** - a shell hook blocks Claude from stopping if blocking findings remain

## Available Commands

| Command | What it does |
|---|---|
| `/review-by-opp:start` | Initialize a new review session. Checks git, Codex, and config. |
| `/review-by-opp:review` | Run Codex audit on your code. Parses findings into the ledger. |
| `/review-by-opp:fix` | Address findings one by one. Each fix requires an explicit resolution. |
| `/review-by-opp:status` | Show session status - open findings, rounds, agent config. |
| `/review-by-opp:resume` | Resume an existing session from `reviews/current.json`. |
| `/review-by-opp:finalize` | Run exit gate. Blocks if findings remain. Emits final verdict. |
| `/review-by-opp:help` | This help page. |

## Typical Workflow

1. `/start` - initialize session
2. `/review` - Codex audits your code, findings appear in the ledger
3. `/fix` - Claude fixes issues, marks each with a resolution state
4. `/review` - re-audit to verify fixes (repeat until clean)
5. `/finalize` - exit gate checks all findings are resolved

## Configuration

Create `.review-by-opp.json` in your project root:

```json
{
  "reviewLedger": {
    "maxRounds": 4,
    "reviewScope": "diff",
    "blockingSeverities": ["critical", "high", "medium"]
  },
  "codex": {
    "modelStrategy": "best_available",
    "model": "",
    "reasoningEffort": "",
    "auditMode": "standard",
    "deepAuditReasoningEffort": "xhigh"
  }
}
```

## Prerequisites

1. **Codex CLI signed in**: `npx @openai/codex login` (one-time, uses ChatGPT account)
2. **Plugin loaded**: `/plugins` → Add from local path, or `claude --plugin-dir /path/to/review-by-opp`

## Resolution States

Each finding must be resolved with one of: `fixed`, `wont_fix`, `false_positive`, `accepted_risk`, `deferred`, `duplicate`.

- `fixed` requires a `resolution_note` explaining the fix
- The exit gate blocks if any blocking finding is still `open` or `fixed` without a note

Answer the user's question about review-by-opp based on this information. If they ask something not covered here, check the project's `docs/` directory for more details.
