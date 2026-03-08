# User Guide

## Prerequisites

- [Claude Code](https://claude.com/claude-code) installed and signed in
- [Codex CLI](https://www.npmjs.com/package/@openai/codex) installed and signed in (`npx @openai/codex login`)
- A git repository with changes to review
- macOS, Linux, or WSL

## Installation

```bash
# From marketplace
/plugin marketplace add review-by-opp/review-by-opp
/plugin install review-by-opp@review-by-opp

# From local clone
git clone https://github.com/review-by-opp/review-by-opp.git
claude --plugin-dir ./review-by-opp
```

## Workflow

### 1. Start a session

```
/review-by-opp:start
```

Initializes the ledger, checks for Codex, reports configuration.

### 2. Write code

Work with Claude as you normally would. Implement features, fix bugs, refactor.

### 3. Run Codex review

```
/review-by-opp:review
```

Invokes Codex CLI in read-only auditor mode (`codex exec --sandbox read-only`) to review your diff/changed files. Findings are parsed into the ledger with IDs and severities.

### 4. Fix findings

```
/review-by-opp:fix
```

Claude addresses each finding one by one. Every finding gets an explicit resolution state:

- `fixed` - with a resolution note explaining the change
- `wont_fix` - with justification
- `not_reproducible` - with investigation notes
- `needs_context` - with what's needed
- `duplicate` - linked to the original finding

### 5. Check status

```
/review-by-opp:status
```

Shows round count, open findings, blocking findings, agent configuration, and whether you can finalize.

### 6. Repeat

Run review/fix cycles until convergence. The system auto-detects:
- No blocking findings left → ready to finalize
- Same findings persist across rounds → stalled
- Max rounds reached → forced stop

### 7. Finalize

```
/review-by-opp:finalize
```

The exit gate checks:
- All blocking findings resolved
- All "fixed" findings have resolution notes
- Emits final verdict: `clean`, `clean_with_accepted_exceptions`, `unresolved`, or `max_rounds_reached`

### Resume a session

```
/review-by-opp:resume
```

Picks up where you left off if you close Claude and come back.

## Stop gate

If you try to end the Claude session while blocking findings remain, the stop gate hook will prevent it. This is the core feature - Claude cannot claim "all fixed" unless it's actually true.
