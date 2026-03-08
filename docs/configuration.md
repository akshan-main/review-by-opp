# Configuration Reference

Create `.review-by-opp.json` in your project root. All fields are optional - defaults are used for missing fields.

## reviewLedger

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `maxRounds` | number | `4` | Maximum review rounds before forced stop |
| `reviewScope` | string | `"diff"` | What to review: `"diff"`, `"changed-files"`, `"changed-files-plus-tests"` |
| `blockingSeverities` | string[] | `["critical","high","medium"]` | Severities that block finalization |
| `rerunChecks` | boolean | `true` | Run tests/lint/typecheck after fixes |
| `allowedUnresolvedCategories` | string[] | `[]` | Categories that don't block even if open |
| `stalledThreshold` | number | `2` | Consecutive rounds with same blocking findings before declaring stalled |
| `debug` | boolean | `false` | Enable debug output |

### reviewScope options

- `"diff"` - Review the current git diff (default, fastest)
- `"changed-files"` - Review all changed files
- `"changed-files-plus-tests"` - Review changed files plus associated test files

### Severity levels

`critical` > `high` > `medium` > `low` > `info`

By default, `critical`, `high`, and `medium` block finalization. `low` and `info` do not.

## codex

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `role` | string | `"auditor_only"` | Always `"auditor_only"` in v1 |
| `modelStrategy` | string | `"best_available"` | How to select the Codex model |
| `model` | string | `""` | Explicit model when `modelStrategy` is `"fixed"` |
| `reasoningEffort` | string | `""` | Optional reasoning override for standard audits (empty = inherit Codex defaults) |
| `deepAuditReasoningEffort` | string | `"xhigh"` | Reasoning effort for deep audit mode |
| `auditMode` | string | `"standard"` | `"standard"` or `"deep"` |
| `commandOverride` | string | `""` | Custom Codex CLI command path |
| `auditPromptPreset` | string | `"default"` | Audit prompt preset name |

### modelStrategy options

- `"best_available"` - Let Codex use its own configured defaults (recommended)
- `"fixed"` - Use the exact model specified in `model`
- `"inherit_if_possible"` - Attempt to use Codex's configured profile

### Why not xhigh everywhere?

OpenAI recommends `medium` as the general default and reserves `high`/`xhigh` for hard tasks. This plugin inherits Codex defaults by default and only applies explicit overrides when configured. `xhigh` remains available for deep mode.

## claude

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `role` | string | `"builder"` | Always `"builder"` |
| `modelControl` | string | `"user_managed"` | Claude model is controlled by the user via Claude Code UI |
| `effortControl` | string | `"user_managed"` | Claude effort is controlled by the user via Claude Code UI |

Claude settings are **always user-managed**. The plugin does not override your Claude model or effort level. Change them through Claude Code's `/model`, `/config`, or settings.

## Example config

```json
{
  "reviewLedger": {
    "maxRounds": 6,
    "reviewScope": "changed-files",
    "blockingSeverities": ["critical", "high"],
    "rerunChecks": true,
    "stalledThreshold": 3
  },
  "codex": {
    "modelStrategy": "fixed",
    "model": "o3",
    "reasoningEffort": "high"
  }
}
```
