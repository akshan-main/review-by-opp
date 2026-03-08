# Troubleshooting

## Codex not installed

**Error:** "Codex CLI not found"

**Fix:**
```bash
npm install -g @openai/codex
```

Or use npx (no global install):
```bash
# The plugin uses npx @openai/codex by default
```

## Codex not signed in

**Error:** "Codex authentication failed"

**Fix:**
```bash
npx @openai/codex login
```

This uses your ChatGPT account - no API key required.

## Plugin not loaded

**Symptoms:** `/review-by-opp:start` not recognized

**Fix:**
```bash
# Load the plugin
claude --plugin-dir /path/to/review-by-opp

# Or install from marketplace
/plugin install review-by-opp@review-by-opp
```

## No git repository

**Error:** "Not a git repository"

**Fix:**
```bash
git init
git add .
git commit -m "Initial commit"
```

## No diff to review

**Error:** "No changes to review"

**Fix:** Make code changes first. The plugin reviews uncommitted changes (staged, unstaged, and untracked files).

## No tests configured

**Warning:** "No test script found in package.json"

This is non-blocking. Add a test script to `package.json` if you want automated test reruns:
```json
{
  "scripts": {
    "test": "your-test-command"
  }
}
```

## Codex command failure

**Error:** "Codex exec command failed"

**Possible causes:**
- Codex CLI version too old → Update: `npm install -g @openai/codex@latest`
- Network issue → Check internet connection
- Codex rate limit → Wait and retry

**Debug:** Set `"debug": true` in `.review-by-opp.json` to see the exact command being run.

## Malformed Codex output

**Symptoms:** Review completes but no findings are parsed

The parser tries multiple strategies:
1. `FINDING:` prefixed JSON lines
2. Raw JSON lines with `severity` field
3. `file:line:message` format

If Codex output doesn't match any format, check the raw output in `reviews/rounds/round-N.json`.

## Stop gate blocking unexpectedly

**Error:** "Cannot complete: N blocking finding(s) remain unresolved"

This is working as intended. Use:
```
/review-by-opp:status    # See what's blocking
/review-by-opp:fix       # Resolve findings
/review-by-opp:finalize  # Try again after resolving
```

## Finding marked fixed without resolution note

**Error:** "Finding(s) marked fixed without resolution note"

Every finding marked `fixed` must have a `resolution_note` explaining the change. This prevents false completion claims.

## Session already exists

**Error:** "A session is already active"

Use `/review-by-opp:resume` to continue or `/review-by-opp:finalize` to close the current session before starting a new one.

## Wrong Codex binary

If `codex` on your PATH is not OpenAI's Codex CLI (e.g., it's a comic book reader), set:

```json
{
  "codex": {
    "commandOverride": "npx @openai/codex"
  }
}
```
