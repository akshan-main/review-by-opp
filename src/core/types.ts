/**
 * Core type definitions for review-by-opp.
 * Finding schema, resolution states, verdicts, and configuration.
 */

// ── Finding severity ──
export type Severity = "critical" | "high" | "medium" | "low" | "info";

// ── Finding category ──
export type Category =
  | "bug"
  | "security"
  | "performance"
  | "style"
  | "logic"
  | "type-safety"
  | "test-coverage"
  | "documentation"
  | "maintainability"
  | "correctness"
  | "other";

// ── Resolution states ──
export type ResolutionStatus =
  | "open"
  | "fixed"
  | "not_reproducible"
  | "wont_fix"
  | "needs_context"
  | "duplicate"
  | "superseded";

// ── Finding confidence ──
export type Confidence = "high" | "medium" | "low";

// ── A single review finding ──
export interface Finding {
  id: string;
  round: number;
  source: string;
  severity: Severity;
  category: Category;
  title: string;
  description: string;
  file: string;
  line_start: number | null;
  line_end: number | null;
  suggested_fix: string | null;
  confidence: Confidence;
  status: ResolutionStatus;
  resolution_note: string | null;
  evidence: string | null;
  duplicate_of: string | null;
  superseded_by: string | null;
}

// ── Round summary ──
export interface RoundSummary {
  round: number;
  timestamp: string;
  total_findings: number;
  new_findings: number;
  resolved_this_round: number;
  still_open: number;
  blocking_open: number;
  verdict: RoundVerdict;
  codex_model: string | null;
  codex_reasoning_effort: string | null;
  review_scope: ReviewScope;
  duration_ms: number | null;
}

// ── Round verdict ──
export type RoundVerdict =
  | "needs_fixes"
  | "needs_review"
  | "converging"
  | "stalled"
  | "clean";

// ── Final verdict ──
export type FinalVerdict =
  | "clean"
  | "clean_with_accepted_exceptions"
  | "unresolved"
  | "max_rounds_reached";

// ── Review scope ──
export type ReviewScope = "diff" | "changed-files" | "changed-files-plus-tests";

// ── Codex model strategy ──
export type CodexModelStrategy = "best_available" | "fixed" | "inherit_if_possible";

// ── Codex audit mode ──
export type CodexAuditMode = "standard" | "deep";

// ── Ledger state ──
export interface LedgerState {
  session_id: string;
  started_at: string;
  updated_at: string;
  current_round: number;
  max_rounds: number;
  findings: Finding[];
  rounds: RoundSummary[];
  final_verdict: FinalVerdict | null;
  config: ResolvedConfig;
}

// ── Configuration ──
export interface ReviewLedgerConfig {
  maxRounds: number;
  reviewScope: ReviewScope;
  blockingSeverities: Severity[];
  rerunChecks: boolean;
  allowedUnresolvedCategories: Category[];
  stalledThreshold: number;
  debug: boolean;
}

export interface CodexConfig {
  role: "auditor_only";
  modelStrategy: CodexModelStrategy;
  model: string;
  reasoningEffort: string;
  deepAuditReasoningEffort: string;
  auditMode: CodexAuditMode;
  commandOverride: string;
  auditPromptPreset: string;
}

export interface ClaudeConfig {
  role: "builder";
  modelControl: "user_managed";
  effortControl: "user_managed";
}

export interface ResolvedConfig {
  reviewLedger: ReviewLedgerConfig;
  codex: CodexConfig;
  claude: ClaudeConfig;
}

// ── Status display ──
export interface StatusInfo {
  session_id: string;
  current_round: number;
  max_rounds: number;
  total_findings: number;
  open_findings: number;
  blocking_open: number;
  resolved_findings: number;
  final_verdict: FinalVerdict | null;
  codex_config_mode: "inherited" | "overridden";
  codex_effective_model: string | null;
  codex_reasoning_effort: string | null;
  claude_model: "user-controlled";
  claude_effort: "user-controlled";
  review_scope: ReviewScope;
  can_finalize: boolean;
  blocking_reasons: string[];
}

// ── Exit gate check result ──
export interface ExitGateResult {
  can_exit: boolean;
  blocking_reasons: string[];
  verdict: FinalVerdict;
}

// ── Codex review result ──
export interface CodexReviewResult {
  success: boolean;
  raw_output: string;
  findings: Finding[];
  model_used: string | null;
  duration_ms: number;
  error: string | null;
}
