---
name: review-by-opp:review
description: Run Codex as an independent reviewer against the current diff or changed files. Parses findings into the ledger. Use after making code changes.
user-invocable: true
allowed-tools: Read, Grep, Glob, Bash
---

You are running a Codex review round. Codex is the auditor - it reviews, you do not edit during this step.

## What to do

1. **Verify session exists:**
   - Read `reviews/current.json`. If missing, tell user: "No active session. Run `/review-by-opp:start` first."

2. **Determine review scope:**
   - Check `reviewScope` in config (from `reviews/current.json` or `.review-by-opp.json`):
     - `"diff"` - include the git diff in the audit prompt for context
     - `"changed-files"` - include full content of changed files
     - `"changed-files-plus-tests"` - changed files plus related test files
     - `"full-repo"` - review the entire repository (Codex reads all files via sandbox)
   - For `diff`, `changed-files`, and `changed-files-plus-tests`: check `git diff --name-only` first. If no changes, tell user: "No changes to review. Make code changes first."
   - For `full-repo`: skip the diff check - Codex reviews everything

3. **Increment round:**
   - Update `current_round` in the ledger

4. **Build the audit prompt:**
   - Base prompt: instruct Codex to review the code for bugs, security issues, performance problems, and code quality
   - For `diff` scope: include the git diff output in the prompt
   - For `changed-files` scope: include the full file contents of changed files
   - For `full-repo` scope: instruct Codex to read and review all source files in the repository
   - If the user provided arguments (e.g. `/review-by-opp:review focus on auth and SQL injection`), append them as additional review focus areas
   - Always instruct Codex to output findings in the format: `FINDING: {"title":"...","severity":"...","category":"...","file":"...","line":...,"description":"...","suggested_fix":"..."}`

5. **Run Codex review:**
   - Execute Codex in auditor-only mode with a read-only sandbox:
     - Base form: `npx @openai/codex exec --sandbox read-only "<audit prompt>"`
     - If model override is configured, include `--model <model>`
     - If reasoning override is configured, include `-c model_reasoning_effort=<effort>`
   - Keep default behavior inherited when overrides are not configured.
   - Capture the full output

6. **Parse findings:**
   - Extract lines starting with `FINDING:` and parse the JSON
   - For each finding, assign an ID like `f-{round}-{short-uuid}`
   - Set status to `open`
   - Deduplicate against existing findings (same file + title + category within 5 lines = duplicate)

7. **Update ledger:**
   - Add new findings to `reviews/current.json`
   - Write round snapshot to `reviews/rounds/round-{N}.json`
   - Write summary to `reviews/summaries/summary-{N}.json`

8. **Run verification checks (if configured):**
   - If `rerunChecks` is true in config, run available checks (test, lint, typecheck)
   - Report results

9. **Report results:**
   - Show number of new findings, total open, blocking open
   - List each new finding with severity, category, title, file, and line
   - Show the round verdict: needs_fixes, converging, stalled, or clean
   - If blocking findings exist, remind: "You must resolve these before finalizing. Use `/review-by-opp:fix`."

10. **Check convergence:**
   - If no blocking findings remain: "Ready to finalize. Run `/review-by-opp:finalize`."
   - If max rounds reached: warn the user
   - If stalled (same blocking findings for N rounds): warn the user

**CRITICAL:** Do NOT edit any files during the review step. You are only gathering and recording Codex's findings.

$ARGUMENTS
