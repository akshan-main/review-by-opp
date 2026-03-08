/**
 * Convergence engine: determines when the review loop should stop.
 */

import type { LedgerState, FinalVerdict, Finding } from "./types.js";
import { getBlockingFindings, getOpenFindings } from "./ledger.js";

export interface ConvergenceResult {
  should_stop: boolean;
  reason: string;
  verdict: FinalVerdict;
}

export function checkConvergence(state: LedgerState): ConvergenceResult {
  const blocking = getBlockingFindings(state);
  const open = getOpenFindings(state);
  const config = state.config.reviewLedger;

  // 1. No blocking findings remain
  if (blocking.length === 0 && open.length === 0) {
    return {
      should_stop: true,
      reason: "All findings resolved. Clean exit.",
      verdict: "clean",
    };
  }

  // 2. Only non-blocking findings remain
  if (blocking.length === 0 && open.length > 0) {
    return {
      should_stop: true,
      reason: `No blocking findings remain. ${open.length} non-blocking finding(s) accepted.`,
      verdict: "clean_with_accepted_exceptions",
    };
  }

  // 3. Max rounds reached
  if (state.current_round >= state.max_rounds) {
    return {
      should_stop: true,
      reason: `Max rounds (${state.max_rounds}) reached with ${blocking.length} blocking finding(s) remaining.`,
      verdict: "max_rounds_reached",
    };
  }

  // 4. Stalled - same blocking issues persist
  if (isStalled(state)) {
    return {
      should_stop: true,
      reason: `Same unresolved blocking findings persisted for ${config.stalledThreshold} consecutive rounds. Stopping.`,
      verdict: "unresolved",
    };
  }

  // 5. Diff no longer materially changes
  if (isDiffStable(state)) {
    return {
      should_stop: true,
      reason: "Diff has not materially changed between rounds. Stopping to avoid infinite loop.",
      verdict: "unresolved",
    };
  }

  // Continue
  return {
    should_stop: false,
    reason: `${blocking.length} blocking finding(s) remain. Round ${state.current_round}/${state.max_rounds}.`,
    verdict: "unresolved",
  };
}

function isStalled(state: LedgerState): boolean {
  const threshold = state.config.reviewLedger.stalledThreshold;
  if (state.rounds.length < threshold) return false;

  const recentRounds = state.rounds.slice(-threshold);

  // Get blocking finding IDs from each recent round
  const blockingSets: Set<string>[] = [];
  for (const round of recentRounds) {
    const blockingAtRound = state.findings.filter(
      (f) =>
        f.status === "open" &&
        f.round <= round.round &&
        state.config.reviewLedger.blockingSeverities.includes(f.severity)
    );
    blockingSets.push(new Set(blockingAtRound.map((f) => f.id)));
  }

  // Check if all sets are identical
  if (blockingSets.length < 2) return false;
  const first = blockingSets[0]!;
  if (first.size === 0) return false;

  return blockingSets.every(
    (s) => s.size === first.size && [...first].every((id) => s.has(id))
  );
}

function isDiffStable(state: LedgerState): boolean {
  // Compare last two rounds for identical finding counts and same findings
  if (state.rounds.length < 2) return false;
  const last = state.rounds[state.rounds.length - 1]!;
  const prev = state.rounds[state.rounds.length - 2]!;

  return (
    last.new_findings === 0 &&
    prev.new_findings === last.new_findings &&
    last.still_open === prev.still_open &&
    last.blocking_open === prev.blocking_open
  );
}

export function formatConvergenceReport(result: ConvergenceResult): string {
  const lines: string[] = [
    `## Convergence Check`,
    ``,
    `**Should stop:** ${result.should_stop ? "Yes" : "No"}`,
    `**Reason:** ${result.reason}`,
    `**Verdict:** ${result.verdict}`,
  ];
  return lines.join("\n");
}
