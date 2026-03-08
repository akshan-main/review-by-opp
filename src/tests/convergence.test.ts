import { describe, it } from "node:test";
import * as assert from "node:assert/strict";
import { checkConvergence } from "../core/convergence.js";
import { getDefaultConfig } from "../core/config.js";
import type { LedgerState, Finding, RoundSummary } from "../core/types.js";

function makeState(overrides: Partial<LedgerState> = {}): LedgerState {
  const config = getDefaultConfig();
  return {
    session_id: "test-session",
    started_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    current_round: 1,
    max_rounds: 4,
    findings: [],
    rounds: [],
    final_verdict: null,
    config,
    ...overrides,
  };
}

function makeFinding(overrides: Partial<Finding> = {}): Finding {
  return {
    id: `f-${Math.random().toString(36).slice(2, 8)}`,
    round: 1,
    source: "codex",
    severity: "high",
    category: "bug",
    title: "Test",
    description: "Test finding",
    file: "test.ts",
    line_start: 1,
    line_end: null,
    suggested_fix: null,
    confidence: "high",
    status: "open",
    resolution_note: null,
    evidence: null,
    duplicate_of: null,
    superseded_by: null,
    ...overrides,
  };
}

function makeRoundSummary(overrides: Partial<RoundSummary> = {}): RoundSummary {
  return {
    round: 1,
    timestamp: new Date().toISOString(),
    total_findings: 1,
    new_findings: 1,
    resolved_this_round: 0,
    still_open: 1,
    blocking_open: 1,
    verdict: "needs_fixes",
    codex_model: null,
    codex_reasoning_effort: null,
    review_scope: "diff",
    duration_ms: null,
    ...overrides,
  };
}

describe("Convergence", () => {
  it("stops when no findings remain", () => {
    const state = makeState({ findings: [] });
    const result = checkConvergence(state);
    assert.equal(result.should_stop, true);
    assert.equal(result.verdict, "clean");
  });

  it("stops when only non-blocking findings remain", () => {
    const state = makeState({
      findings: [makeFinding({ severity: "info" })],
    });
    const result = checkConvergence(state);
    assert.equal(result.should_stop, true);
    assert.equal(result.verdict, "clean_with_accepted_exceptions");
  });

  it("continues when blocking findings exist and rounds remain", () => {
    const state = makeState({
      current_round: 1,
      max_rounds: 4,
      findings: [makeFinding({ severity: "critical" })],
    });
    const result = checkConvergence(state);
    assert.equal(result.should_stop, false);
  });

  it("stops when max rounds reached", () => {
    const state = makeState({
      current_round: 4,
      max_rounds: 4,
      findings: [makeFinding({ severity: "high" })],
    });
    const result = checkConvergence(state);
    assert.equal(result.should_stop, true);
    assert.equal(result.verdict, "max_rounds_reached");
  });

  it("stops when stalled (same blocking findings for N rounds)", () => {
    const f = makeFinding({ id: "f-stuck", severity: "high" });
    const state = makeState({
      current_round: 3,
      max_rounds: 10,
      findings: [f],
      rounds: [
        makeRoundSummary({ round: 1, blocking_open: 1 }),
        makeRoundSummary({ round: 2, blocking_open: 1 }),
        makeRoundSummary({ round: 3, blocking_open: 1 }),
      ],
    });
    // stalledThreshold defaults to 2
    const result = checkConvergence(state);
    assert.equal(result.should_stop, true);
    assert.equal(result.verdict, "unresolved");
  });

  it("stops when diff is stable (no new findings, same counts)", () => {
    const state = makeState({
      current_round: 3,
      max_rounds: 10,
      findings: [makeFinding({ severity: "high" })],
      rounds: [
        makeRoundSummary({ round: 1, new_findings: 1, still_open: 1, blocking_open: 1 }),
        makeRoundSummary({ round: 2, new_findings: 0, still_open: 1, blocking_open: 1 }),
        makeRoundSummary({ round: 3, new_findings: 0, still_open: 1, blocking_open: 1 }),
      ],
    });
    const result = checkConvergence(state);
    assert.equal(result.should_stop, true);
  });
});
