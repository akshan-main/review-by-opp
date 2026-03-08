# review-by-opp

**A Claude Code plugin that uses your signed-in Codex account as an independent reviewer and keeps a strict issue ledger, so Claude cannot claim "all fixed" until every review finding is actually closed.**

---

## Why this exists

I use Claude Code for heavy coding and Codex CLI to review the output. In my experience, Claude Code is better at building and Codex is better at catching issues. Using both together has worked really well for me.

But the workflow was painful. Copy-paste findings from Codex into Claude. Watch Claude fix some of them and claim "all done" when half are still open. Manually track what was actually resolved. Repeat. I got fed up.

So I built review-by-opp. It automates the Claude + Codex review loop and enforces **item-by-item closure tracking** with a **stop gate** that blocks completion while findings remain unresolved. Claude builds. Codex audits. The plugin prevents fake completion.

This is not a generic AI review loop. This is a strict review and exit-gate system.

## How it works

```mermaid
flowchart TD
  A[Claude builds changes] --> B[/review-by-opp:review]
  B --> C[Codex exec --sandbox read-only]
  C --> D[Findings normalized into reviews/current.json]
  D --> E{Blocking findings open?}
  E -- Yes --> F[/review-by-opp:fix]
  F --> B
  E -- No --> G[/review-by-opp:finalize]
  G --> H[Stop gate checks ledger state]
  H --> I[Final verdict]
```

**Key principle:** Claude builds. Codex audits. The plugin prevents fake completion.

## Quick start

### Prerequisites

- [Claude Code](https://claude.com/claude-code) installed and signed in
- [Codex CLI](https://www.npmjs.com/package/@openai/codex) installed and signed in
- A git repository
- macOS, Linux, or WSL

### Install

```bash
# Option 1: Install from marketplace
/plugin marketplace add review-by-opp/review-by-opp
/plugin install review-by-opp@review-by-opp

# Option 2: Install from local clone
git clone https://github.com/review-by-opp/review-by-opp.git
claude --plugin-dir ./review-by-opp

# Option 3: Development / test
cd review-by-opp
npm install && npm run build
claude --plugin-dir .
```

### Usage

```
/review-by-opp:start       Start a guarded implementation + review session
/review-by-opp:review      Run Codex review against current diff
/review-by-opp:fix         Address findings from the ledger
/review-by-opp:status      Show round count, findings, and exit gate status
/review-by-opp:resume      Resume an existing session
/review-by-opp:finalize    Close the session (blocked if findings remain)
```

### Demo walkthrough

```bash
# 1. Start working on your feature
claude
> /review-by-opp:start

# 2. Write your code as usual with Claude
> Implement the user authentication module

# 3. When ready, run the Codex review
> /review-by-opp:review

# 4. Claude receives structured findings - fix them
> /review-by-opp:fix

# 5. Check progress
> /review-by-opp:status

# 6. Repeat review/fix until clean
> /review-by-opp:review
> /review-by-opp:fix

# 7. Finalize when all findings are resolved
> /review-by-opp:finalize
```

## Configuration

Create `.review-by-opp.json` in your project root:

```json
{
  "reviewLedger": {
    "maxRounds": 4,
    "reviewScope": "diff",
    "blockingSeverities": ["critical", "high", "medium"],
    "rerunChecks": true,
    "allowedUnresolvedCategories": [],
    "stalledThreshold": 2,
    "debug": false
  },
  "codex": {
    "role": "auditor_only",
    "modelStrategy": "best_available",
    "model": "",
    "reasoningEffort": "",
    "deepAuditReasoningEffort": "xhigh",
    "auditMode": "standard",
    "commandOverride": ""
  },
  "claude": {
    "role": "builder",
    "modelControl": "user_managed",
    "effortControl": "user_managed"
  }
}
```

### Key config fields

| Field | Default | Description |
|-------|---------|-------------|
| `maxRounds` | `4` | Maximum review rounds before forced stop |
| `reviewScope` | `"diff"` | What to review: `diff`, `changed-files`, `changed-files-plus-tests` |
| `blockingSeverities` | `["critical","high","medium"]` | Severities that block finalization |
| `codex.modelStrategy` | `"best_available"` | `best_available`, `fixed`, `inherit_if_possible` |
| `codex.reasoningEffort` | `""` (inherit) | Optional Codex reasoning effort override for standard audits |
| `codex.deepAuditReasoningEffort` | `"xhigh"` | Reasoning effort for deep audit mode |
| `claude.modelControl` | `"user_managed"` | Claude model is always user-controlled |

## Model and reasoning control

- **Claude** model and effort are **always user-controlled** through Claude Code's own UI and config. This plugin does not override your Claude settings.
- **Codex** defaults to inherited user config (model/profile/reasoning) and is fully configurable. Deep audits can opt into `xhigh`.
- The plugin does not hardcode both agents aggressively - it enforces review completeness, not agent settings.

## How it differs from a generic review loop

| Feature | Generic loop | review-by-opp |
|---------|-------------|---------------|
| Finding tracking | None or ad-hoc | Structured ledger with IDs and states |
| Resolution states | Pass/fail | 7 explicit states per finding |
| Exit gate | None | Deterministic stop gate |
| False completion | Possible | Blocked by the plugin |
| Duplicate detection | No | Automatic deduplication |
| Convergence detection | No | Stall and stability detection |
| Audit trail | No | Full round-by-round history |

## Resolution states

Every finding ends in exactly one state:

| State | Meaning |
|-------|---------|
| `open` | Not yet addressed |
| `fixed` | Fixed with code changes (requires resolution note) |
| `not_reproducible` | Cannot reproduce the issue |
| `wont_fix` | Intentional or acceptable |
| `needs_context` | More information needed |
| `duplicate` | Duplicates another finding |
| `superseded` | Replaced by a newer finding |

## Final verdicts

| Verdict | Meaning |
|---------|---------|
| `clean` | All findings resolved |
| `clean_with_accepted_exceptions` | Only non-blocking findings remain |
| `unresolved` | Blocking findings remain (stalled or stable) |
| `max_rounds_reached` | Hit the round limit |

## Local data model

All state is stored locally in `reviews/`:

```
reviews/
  current.json       # Active session state
  rounds/
    round-1.json     # Round snapshots
    round-2.json
  summaries/
    summary-1.json   # Round summaries
    summary-2.json
  artifacts/
    round-1-*.txt    # Raw command/check artifacts
```

All files are JSON, easy to inspect and diff.

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Codex not installed | `npm install -g @openai/codex` |
| Codex not signed in | `npx @openai/codex login` (uses ChatGPT account, no API key needed) |
| Plugin not loaded | `claude --plugin-dir /path/to/review-by-opp` |
| No git repo | `git init` in your project |
| No diff to review | Make code changes first |
| No tests configured | Add a `test` script to `package.json` |

## Security and privacy

- **Local-first.** All data stays in your repo's `reviews/` directory.
- **No cloud backend.** No data is transmitted anywhere except through Claude and Codex, which the user explicitly invokes.
- **No API keys required.** Users bring their own signed-in Claude and Codex accounts.
- **No UI scraping.** The plugin uses Codex CLI's documented non-interactive `exec` command.
- **Trust model:** You trust Claude (Anthropic) and Codex (OpenAI) as much as you already do by having them installed and signed in. This plugin adds no new trust requirements.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

MIT - see [LICENSE](LICENSE).
