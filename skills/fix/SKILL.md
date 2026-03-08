---
name: review-by-opp:fix
description: Address Codex review findings from the ledger. Shows open findings and guides resolution. Each finding must get an explicit resolution state.
user-invocable: true
---

You are addressing Codex review findings. You are the builder - fix what needs fixing.

## What to do

1. **Load the ledger:**
   - Read `reviews/current.json`
   - If missing, tell user: "No active session. Run `/review-by-opp:start` first."

2. **Show open findings:**
   - List all findings with status `open`, grouped by severity (critical first)
   - For each, show: ID, severity, category, title, file, line, description, suggested_fix

3. **Address findings one by one:**
   For each finding, you MUST do one of these - no exceptions:

   a. **Fix it** → Make the code change, then update the finding:
      - Set `status` to `fixed`
      - Set `resolution_note` to a brief description of what you changed
      - The fix must be verifiable (actual file changes, not just claiming it's done)

   b. **Mark as won't_fix** → If the finding is intentional or acceptable:
      - Set `status` to `wont_fix`
      - Set `resolution_note` explaining why

   c. **Mark as not_reproducible** → If you cannot reproduce the issue:
      - Set `status` to `not_reproducible`
      - Set `resolution_note` with your investigation

   d. **Mark as needs_context** → If you need more information:
      - Set `status` to `needs_context`
      - Set `resolution_note` describing what context is needed

   e. **Mark as duplicate** → If this duplicates another finding:
      - Set `status` to `duplicate`
      - Set `duplicate_of` to the other finding's ID

4. **Update the ledger:**
   - Write updated findings back to `reviews/current.json`
   - Every finding must have a resolution state - you cannot skip any

5. **Report progress:**
   - Show how many findings were resolved this pass
   - Show remaining open findings
   - If blocking findings remain: "Run `/review-by-opp:fix` again or `/review-by-opp:review` for another Codex pass"
   - If no blocking findings: "Ready for another review round (`/review-by-opp:review`) or finalize (`/review-by-opp:finalize`)"

**CRITICAL:** You MUST NOT claim "all fixed" unless every finding has an explicit resolution state. The ledger enforces this - hand-waving is not allowed.

$ARGUMENTS
