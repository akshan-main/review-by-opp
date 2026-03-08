/**
 * Ledger engine: manages review state, finding transitions, and persistence.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import * as crypto from "node:crypto";
import type {
  LedgerState,
  Finding,
  ResolutionStatus,
  RoundSummary,
  RoundVerdict,
  ResolvedConfig,
  StatusInfo,
  FinalVerdict,
} from "./types.js";

const REVIEWS_DIR = "reviews";

export function createSession(projectRoot: string, config: ResolvedConfig): LedgerState {
  const now = new Date().toISOString();
  const state: LedgerState = {
    session_id: crypto.randomUUID(),
    started_at: now,
    updated_at: now,
    current_round: 0,
    max_rounds: config.reviewLedger.maxRounds,
    findings: [],
    rounds: [],
    final_verdict: null,
    config,
  };
  persist(projectRoot, state);
  return state;
}

export function loadSession(projectRoot: string): LedgerState | null {
  const currentPath = path.join(projectRoot, REVIEWS_DIR, "current.json");
  if (!fs.existsSync(currentPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(currentPath, "utf-8")) as LedgerState;
  } catch {
    return null;
  }
}

export function persist(projectRoot: string, state: LedgerState): void {
  const reviewsDir = path.join(projectRoot, REVIEWS_DIR);
  const roundsDir = path.join(reviewsDir, "rounds");
  const summariesDir = path.join(reviewsDir, "summaries");
  const artifactsDir = path.join(reviewsDir, "artifacts");
  fs.mkdirSync(roundsDir, { recursive: true });
  fs.mkdirSync(summariesDir, { recursive: true });
  fs.mkdirSync(artifactsDir, { recursive: true });

  state.updated_at = new Date().toISOString();
  fs.writeFileSync(
    path.join(reviewsDir, "current.json"),
    JSON.stringify(state, null, 2),
    "utf-8"
  );
}

export function persistRound(projectRoot: string, state: LedgerState): void {
  const roundsDir = path.join(projectRoot, REVIEWS_DIR, "rounds");
  fs.mkdirSync(roundsDir, { recursive: true });
  const roundFile = path.join(roundsDir, `round-${state.current_round}.json`);
  fs.writeFileSync(
    roundFile,
    JSON.stringify(
      {
        round: state.current_round,
        findings: state.findings.filter((f) => f.round === state.current_round),
        summary: state.rounds[state.rounds.length - 1] ?? null,
      },
      null,
      2
    ),
    "utf-8"
  );
}

export function persistSummary(projectRoot: string, state: LedgerState): void {
  const summariesDir = path.join(projectRoot, REVIEWS_DIR, "summaries");
  fs.mkdirSync(summariesDir, { recursive: true });
  const summaryFile = path.join(summariesDir, `summary-${state.current_round}.json`);
  const latest = state.rounds[state.rounds.length - 1];
  if (latest) {
    fs.writeFileSync(summaryFile, JSON.stringify(latest, null, 2), "utf-8");
  }
}

export function persistArtifact(
  projectRoot: string,
  round: number,
  name: string,
  content: string
): string {
  const artifactsDir = path.join(projectRoot, REVIEWS_DIR, "artifacts");
  fs.mkdirSync(artifactsDir, { recursive: true });
  const safeName = name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const artifactPath = path.join(artifactsDir, `round-${round}-${safeName}`);
  fs.writeFileSync(artifactPath, content, "utf-8");
  return artifactPath;
}

// ── Finding management ──

export function addFindings(state: LedgerState, findings: Finding[]): LedgerState {
  const deduped = deduplicateFindings(state.findings, findings);
  return {
    ...state,
    findings: [...state.findings, ...deduped],
    updated_at: new Date().toISOString(),
  };
}

export function resolveFinding(
  state: LedgerState,
  findingId: string,
  status: ResolutionStatus,
  note: string | null
): LedgerState {
  const findings = state.findings.map((f) => {
    if (f.id === findingId) {
      return { ...f, status, resolution_note: note };
    }
    return f;
  });
  return { ...state, findings, updated_at: new Date().toISOString() };
}

export function bulkResolve(
  state: LedgerState,
  resolutions: Array<{ id: string; status: ResolutionStatus; note: string | null }>
): LedgerState {
  let current = state;
  for (const r of resolutions) {
    current = resolveFinding(current, r.id, r.status, r.note);
  }
  return current;
}

// ── Round tracking ──

export function startRound(state: LedgerState): LedgerState {
  return {
    ...state,
    current_round: state.current_round + 1,
    updated_at: new Date().toISOString(),
  };
}

export function closeRound(
  state: LedgerState,
  codexModel: string | null,
  codexReasoning: string | null,
  durationMs: number | null
): LedgerState {
  const roundFindings = state.findings.filter((f) => f.round === state.current_round);
  const openFindings = getOpenFindings(state);
  const blockingOpen = getBlockingFindings(state);
  const resolvedThisRound = state.findings.filter(
    (f) => f.status !== "open"
  );

  const verdict = computeRoundVerdict(state);

  const summary: RoundSummary = {
    round: state.current_round,
    timestamp: new Date().toISOString(),
    total_findings: state.findings.length,
    new_findings: roundFindings.length,
    resolved_this_round: resolvedThisRound.length,
    still_open: openFindings.length,
    blocking_open: blockingOpen.length,
    verdict,
    codex_model: codexModel,
    codex_reasoning_effort: codexReasoning,
    review_scope: state.config.reviewLedger.reviewScope,
    duration_ms: durationMs,
  };

  return {
    ...state,
    rounds: [...state.rounds, summary],
    updated_at: new Date().toISOString(),
  };
}

// ── Queries ──

export function getOpenFindings(state: LedgerState): Finding[] {
  return state.findings.filter((f) => f.status === "open");
}

export function getBlockingFindings(state: LedgerState): Finding[] {
  const blockingSeverities = new Set(state.config.reviewLedger.blockingSeverities);
  const allowedCategories = new Set(state.config.reviewLedger.allowedUnresolvedCategories);
  return state.findings.filter(
    (f) =>
      f.status === "open" &&
      blockingSeverities.has(f.severity) &&
      !allowedCategories.has(f.category)
  );
}

export function getFindingById(state: LedgerState, id: string): Finding | undefined {
  return state.findings.find((f) => f.id === id);
}

export function getUnresolvedFindings(state: LedgerState): Finding[] {
  return state.findings.filter(
    (f) => f.status === "open" || f.status === "needs_context"
  );
}

// ── Status ──

export function getStatus(state: LedgerState): StatusInfo {
  const open = getOpenFindings(state);
  const blocking = getBlockingFindings(state);
  const resolved = state.findings.filter((f) => f.status !== "open");
  const gate = checkExitGate(state);

  return {
    session_id: state.session_id,
    current_round: state.current_round,
    max_rounds: state.max_rounds,
    total_findings: state.findings.length,
    open_findings: open.length,
    blocking_open: blocking.length,
    resolved_findings: resolved.length,
    final_verdict: state.final_verdict,
    codex_config_mode: resolveCodexConfigMode(state),
    codex_effective_model: resolveEffectiveCodexModel(state),
    codex_reasoning_effort: resolveEffectiveCodexReasoningEffort(state),
    claude_model: "user-controlled",
    claude_effort: "user-controlled",
    review_scope: state.config.reviewLedger.reviewScope,
    can_finalize: gate.can_exit,
    blocking_reasons: gate.blocking_reasons,
  };
}

// ── Duplicate detection ──

export function deduplicateFindings(
  existing: Finding[],
  incoming: Finding[]
): Finding[] {
  const result: Finding[] = [];
  for (const finding of incoming) {
    const dup = existing.find(
      (e) =>
        e.file === finding.file &&
        e.title === finding.title &&
        e.category === finding.category &&
        Math.abs((e.line_start ?? 0) - (finding.line_start ?? 0)) <= 5
    );
    if (dup) {
      // Mark the incoming one as a duplicate
      result.push({
        ...finding,
        status: "duplicate",
        duplicate_of: dup.id,
      });
    } else {
      result.push(finding);
    }
  }
  return result;
}

// ── Exit gate ──

export function checkExitGate(state: LedgerState): {
  can_exit: boolean;
  blocking_reasons: string[];
  verdict: FinalVerdict;
} {
  const reasons: string[] = [];
  const validStatuses = new Set<ResolutionStatus>([
    "open",
    "fixed",
    "not_reproducible",
    "wont_fix",
    "needs_context",
    "duplicate",
    "superseded",
  ]);

  // Check for findings with no resolution state
  const unresolved = state.findings.filter((f) => f.status === "open");
  const blocking = getBlockingFindings(state);

  const missingStatus = state.findings.filter((f) => !f.status || !validStatuses.has(f.status));
  if (missingStatus.length > 0) {
    reasons.push(
      `${missingStatus.length} finding(s) have missing/invalid resolution state: ${missingStatus.map((f) => f.id).join(", ")}`
    );
  }

  if (blocking.length > 0) {
    reasons.push(
      `${blocking.length} blocking finding(s) still open: ${blocking.map((f) => f.id).join(", ")}`
    );
  }

  // Check for findings claimed fixed without evidence
  const claimedFixed = state.findings.filter(
    (f) => f.status === "fixed" && !f.resolution_note
  );
  if (claimedFixed.length > 0) {
    reasons.push(
      `${claimedFixed.length} finding(s) marked fixed without resolution note: ${claimedFixed.map((f) => f.id).join(", ")}`
    );
  }

  // Check max rounds
  if (state.current_round >= state.max_rounds) {
    if (blocking.length > 0) {
      reasons.push(`Max rounds (${state.max_rounds}) reached with blocking findings remaining`);
      return { can_exit: false, blocking_reasons: reasons, verdict: "max_rounds_reached" };
    }
    return {
      can_exit: true,
      blocking_reasons: [],
      verdict: unresolved.length > 0 ? "clean_with_accepted_exceptions" : "clean",
    };
  }

  if (reasons.length > 0) {
    return { can_exit: false, blocking_reasons: reasons, verdict: "unresolved" };
  }

  if (unresolved.length > 0) {
    // Non-blocking unresolved items
    return {
      can_exit: true,
      blocking_reasons: [],
      verdict: "clean_with_accepted_exceptions",
    };
  }

  return { can_exit: true, blocking_reasons: [], verdict: "clean" };
}

export function finalize(state: LedgerState): LedgerState {
  const gate = checkExitGate(state);
  if (!gate.can_exit) {
    throw new Error(
      `Cannot finalize: ${gate.blocking_reasons.join("; ")}`
    );
  }
  return {
    ...state,
    final_verdict: gate.verdict,
    updated_at: new Date().toISOString(),
  };
}

// ── Helpers ──

function computeRoundVerdict(state: LedgerState): RoundVerdict {
  const blocking = getBlockingFindings(state);
  const open = getOpenFindings(state);

  if (open.length === 0) return "clean";
  if (blocking.length === 0) return "converging";

  // Check for stalled - same blocking findings across rounds
  if (state.rounds.length >= state.config.reviewLedger.stalledThreshold) {
    const recentRounds = state.rounds.slice(-state.config.reviewLedger.stalledThreshold);
    const allSameBlockingCount = recentRounds.every(
      (r) => r.blocking_open === blocking.length
    );
    if (allSameBlockingCount && blocking.length > 0) {
      return "stalled";
    }
  }

  return "needs_fixes";
}

function resolveCodexConfigMode(state: LedgerState): "inherited" | "overridden" {
  return resolveEffectiveCodexModel(state) || resolveEffectiveCodexReasoningEffort(state)
    ? "overridden"
    : "inherited";
}

function resolveEffectiveCodexModel(state: LedgerState): string | null {
  const model = state.config.codex.model.trim();
  if (state.config.codex.modelStrategy === "fixed") {
    return model || null;
  }

  if (state.config.codex.modelStrategy === "inherit_if_possible") {
    return model || null;
  }

  return null;
}

function resolveEffectiveCodexReasoningEffort(state: LedgerState): string | null {
  const effort =
    state.config.codex.auditMode === "deep"
      ? state.config.codex.deepAuditReasoningEffort.trim()
      : state.config.codex.reasoningEffort.trim();
  return effort || null;
}
