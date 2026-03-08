---
name: review-by-opp:start
description: Start a guarded implementation + review session. Use when beginning work that should be reviewed by Codex before completion. Initializes the review ledger and configures the stop gate.
user-invocable: true
---

You are starting a review-by-opp session. This activates strict review tracking.

## What to do

1. **Check prerequisites:**
   - Verify this is a git repository. If not, tell the user: "review-by-opp requires a git repo. Run `git init` first."
   - Check if a session already exists by looking for `reviews/current.json`. If one exists, ask: "A session is already active. Use `/review-by-opp:resume` to continue or `/review-by-opp:finalize` to close it first."

2. **Initialize session:**
   - Create the `reviews/` directory structure: `reviews/current.json`, `reviews/rounds/`, `reviews/summaries/`
   - Load config from `.review-by-opp.json` if it exists, otherwise use defaults
   - Write initial `reviews/current.json` with:
     ```json
     {
       "session_id": "<uuid>",
       "started_at": "<iso-timestamp>",
       "updated_at": "<iso-timestamp>",
       "current_round": 0,
       "max_rounds": 4,
       "findings": [],
       "rounds": [],
       "final_verdict": null,
       "config": { ... }
     }
     ```

3. **Check for Codex:**
   - Run `npx @openai/codex --help` to verify Codex CLI is available
   - If not installed, tell user: "Install Codex: `npm install -g @openai/codex` then `npx @openai/codex login`"

4. **Report status:**
   - Show session ID, max rounds, review scope, and blocking severities
   - Show Codex detection status
   - Show Claude model/effort: "user-controlled (via Claude Code UI)"
   - Show Codex config: model strategy, reasoning effort

5. **Set the rules:**
   Tell the user:
   > Review ledger session started. Rules:
   > - After implementing changes, run `/review-by-opp:review` to get Codex feedback
   > - Use `/review-by-opp:fix` to address findings
   > - Use `/review-by-opp:status` to check progress
   > - You cannot finalize until all blocking findings are resolved
   > - Use `/review-by-opp:finalize` when ready to close

**CRITICAL:** You are the builder. Codex is the auditor. You must not claim work is complete while blocking findings remain open. The stop gate enforces this.

$ARGUMENTS
