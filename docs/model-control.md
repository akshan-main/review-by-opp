# Model and Reasoning Control

## Design principle

This plugin enforces review completeness, not agent settings. It does not try to dominate your model choices.

## Claude (builder)

Claude model and effort are **always user-controlled**.

- Change model: Use `/model` in Claude Code
- Change effort: Use Claude Code settings or `CLAUDE_CODE_EFFORT_LEVEL`
- The plugin respects whatever you choose
- Extended thinking is enabled by default in Claude Code

The plugin does not create a competing control surface for Claude settings.

## Codex (auditor-only)

Codex is the independent reviewer. It does not edit files - it only reviews, critiques, and identifies issues.

### Config precedence

1. Explicit plugin override for this run (via `.review-by-opp.json`)
2. User's existing Codex shared config (`~/.codex/config.toml`)
3. Codex built-in defaults

### Default behavior

By default, `modelStrategy: "best_available"` means the plugin does **not** force a Codex model. Codex uses its own configured defaults.

### Reasoning effort defaults

| Mode | Default | Why |
|------|---------|-----|
| Standard audit | inherited | Uses user Codex config/profile by default |
| Deep audit | `xhigh` | Maximum thoroughness for critical reviews |

### Why not xhigh everywhere?

OpenAI's docs recommend `medium` as the general default and reserve `high`/`xhigh` for the hardest tasks. Forcing `xhigh` for every trivial audit:
- Makes the loop slower
- Costs more compute
- Provides diminishing returns on simple changes

The default inherited mode keeps user control intact. `xhigh` is available in deep mode for when you need maximum thoroughness.

### Overriding Codex settings

```json
{
  "codex": {
    "modelStrategy": "fixed",
    "model": "o3",
    "reasoningEffort": "xhigh"
  }
}
```

### Status visibility

`/review-by-opp:status` shows current effective settings:

```
| Agent | Setting | Value |
|-------|---------|-------|
| Claude | Model | user-controlled |
| Claude | Effort | user-controlled |
| Codex | Config mode | inherited |
| Codex | Model | default |
| Codex | Reasoning | default |
```

## The plugin does not read Codex chat state

The plugin does **not** read transient state from the Codex chat pane. It uses Codex CLI's documented config and command-line interface. Session-local `/model` changes in a live Codex chat are not a reliable integration surface.
