---
name: finalize
description: Finalize the review session. Only succeeds if all blocking findings are resolved. Emits final verdict.
user-invocable: true
allowed-tools: Read, Glob, Bash
---

Finalize the review-by-opp session. This is the exit gate.

## What to do

1. **Load the ledger:**
   - Read `reviews/current.json`
   - If missing, tell user: "No active session. Run `/review-by-opp:start` first."

2. **Run the exit gate check:**
   Check ALL of these conditions:

   a. **No blocking findings open:**
      - Get all findings where `status === "open"` and severity is in `blockingSeverities`
      - If any exist: **BLOCK.** List them and say: "Cannot finalize. {N} blocking finding(s) still open."

   b. **No findings without resolution state:**
      - Every finding must have a status other than just existing with no decision
      - If any finding has `status === "open"` and is blocking: **BLOCK.**

   c. **No false completion claims:**
      - Any finding marked `fixed` MUST have a `resolution_note`
      - If any `fixed` finding lacks a note: **BLOCK.** "Finding {id} is marked fixed but has no resolution note."

3. **If blocked:**
   - List all blocking reasons
   - Tell user: "Use `/review-by-opp:fix` to resolve remaining findings."
   - Do NOT finalize.

4. **If clear to finalize:**
   - Determine the final verdict:
     - `clean` - no open findings at all
     - `clean_with_accepted_exceptions` - only non-blocking findings remain open
     - `max_rounds_reached` - max rounds hit (but no blocking findings)
   - Set `final_verdict` in the ledger
   - Write the final state to `reviews/current.json`

5. **Report final verdict:**
   Show a summary:
   ```
   ## Final Verdict: {VERDICT}

   - Rounds completed: {N}
   - Total findings: {N}
   - Fixed: {N}
   - Won't fix: {N}
   - Not reproducible: {N}
   - Needs context: {N}
   - Duplicate: {N}
   - Superseded: {N}
   - Still open (non-blocking): {N}
   ```

6. **Session is now closed.** Tell user: "Session finalized. To start a new session, run `/review-by-opp:start`."

**CRITICAL:** This is the stop gate. You MUST NOT bypass it. If blocking findings remain, finalization MUST fail. This is the entire point of review-by-opp.

$ARGUMENTS
