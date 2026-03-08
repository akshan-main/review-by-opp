---
name: resume
description: Resume an existing review-by-opp session. Use when returning to a previous review session.
user-invocable: true
allowed-tools: Read, Glob, Bash
---

Resume an existing review-by-opp session.

## What to do

1. **Load the ledger:**
   - Read `reviews/current.json`
   - If missing, tell user: "No active session to resume. Run `/review-by-opp:start` first."
   - If the session has a `final_verdict` set, tell user: "This session is already finalized with verdict: {verdict}. Run `/review-by-opp:start` to begin a new session."

2. **Show session summary:**
   - Session ID, when it was started, current round
   - Number of open findings, blocking findings
   - Last round verdict if available

3. **Suggest next action based on state:**
   - If there are unresolved findings from the last review: "You have {N} open findings from round {R}. Use `/review-by-opp:fix` to address them."
   - If fixes were applied but no new review has run: "Fixes were applied. Run `/review-by-opp:review` for the next Codex review round."
   - If no review has been run yet: "Session initialized but no review yet. Run `/review-by-opp:review`."

4. **Restate the rules:**
   > Reminder: All blocking findings must be explicitly resolved before this session can be finalized. The stop gate enforces this.

$ARGUMENTS
