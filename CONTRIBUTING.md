# Contributing to review-by-opp

## Setup

```bash
git clone https://github.com/review-by-opp/review-by-opp.git
cd review-by-opp
npm install
npm run build
npm test
```

## Development

```bash
# Build
npm run build

# Run tests
npm test

# Type check only
npm run lint

# Test with Claude Code
claude --plugin-dir .
```

## Project structure

```
src/
  core/         # Types, config, ledger engine, convergence
  codex/        # Codex CLI detection and review invocation
  utils/        # Git, checks, formatting
  tests/        # All tests
skills/         # Plugin skills (SKILL.md files)
hooks/          # Plugin hooks
scripts/        # Hook scripts (stop gate)
```

## Adding a skill

1. Create `skills/<name>/SKILL.md`
2. Add frontmatter with `name`, `description`, `user-invocable: true`
3. Write instructions for Claude
4. Test with `claude --plugin-dir .`

## Pull request process

1. Fork and create a feature branch
2. Make changes and add tests
3. Ensure `npm run build && npm test` passes
4. Submit a PR with a clear description

## Code style

- TypeScript strict mode
- Node.js built-in modules only (no external runtime deps)
- Tests use `node:test` and `node:assert/strict`
- Keep it simple - no over-engineering

## Reporting issues

Use GitHub Issues with the provided templates.
