---
name: review-by-opp:status
description: Show current review ledger status including round count, open findings, blocking items, agent configuration, and whether the session can be finalized.
user-invocable: true
---

Show the current review-by-opp session status.

## What to do

1. **Load the ledger:**
   - Read `reviews/current.json`
   - If missing, tell user: "No active session. Run `/review-by-opp:start` first."

2. **Display status table:**

   | Field | Value |
   |-------|-------|
   | Session | `{session_id short}` |
   | Round | {current_round} / {max_rounds} |
   | Total findings | {count} |
   | Open | {open count} |
   | Blocking open | {blocking count} |
   | Resolved | {resolved count} |
   | Review scope | {scope} |
   | Can finalize | Yes/No |
   | Verdict | {verdict or "in progress"} |

3. **Display agent configuration:**

   | Agent | Setting | Value |
   |-------|---------|-------|
   | Claude | Model | user-controlled |
   | Claude | Effort | user-controlled |
   | Codex | Config mode | inherited/overridden |
   | Codex | Model | {effective model or "default"} |
   | Codex | Reasoning | {reasoning effort or "default"} |

4. **If there are blocking reasons, list them.**

5. **Show open findings in compact format:**
   - `[open] f-1-abc123 high/bug: Null pointer (src/main.ts:42)`

6. **Show next actions:**
   - If can finalize: "Ready to finalize. Run `/review-by-opp:finalize`"
   - If blocking findings exist: "Resolve blocking findings with `/review-by-opp:fix`"
   - If no review has been run yet: "Run `/review-by-opp:review` to start the first review"

$ARGUMENTS
