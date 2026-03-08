# Changelog

## [1.0.0] - 2026-03-08

### Added

- Structured finding schema with 7 resolution states
- Ledger engine with round-by-round state tracking
- Convergence detection (stall, stability, max rounds)
- Deterministic stop gate that blocks false completion claims
- Codex CLI integration with auto-detection and output parsing
- 6 plugin skills: start, review, fix, status, resume, finalize
- Hook-based stop gate (fires on Claude Stop event)
- Configurable review settings via `.review-by-opp.json`
- Duplicate finding detection
- Verification checks (test, lint, typecheck)
- Full test suite (42 tests)
- Documentation (architecture, user guide, configuration, troubleshooting, security)
- Marketplace packaging for Git-hosted distribution
- CI/CD workflows
