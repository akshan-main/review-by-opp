/**
 * Configuration loader with sensible defaults.
 * Reads from .review-by-opp.json in the project root if present.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import type {
  ResolvedConfig,
  ReviewLedgerConfig,
  CodexConfig,
  ClaudeConfig,
  ReviewScope,
  Severity,
  Category,
  CodexModelStrategy,
  CodexAuditMode,
} from "./types.js";

const DEFAULT_REVIEW_LEDGER: ReviewLedgerConfig = {
  maxRounds: 4,
  reviewScope: "diff",
  blockingSeverities: ["critical", "high", "medium"],
  rerunChecks: true,
  allowedUnresolvedCategories: [],
  stalledThreshold: 2,
  debug: false,
};

const DEFAULT_CODEX: CodexConfig = {
  role: "auditor_only",
  modelStrategy: "best_available",
  model: "",
  reasoningEffort: "",
  deepAuditReasoningEffort: "xhigh",
  auditMode: "standard",
  commandOverride: "",
  auditPromptPreset: "default",
};

const DEFAULT_CLAUDE: ClaudeConfig = {
  role: "builder",
  modelControl: "user_managed",
  effortControl: "user_managed",
};

export function getDefaultConfig(): ResolvedConfig {
  return {
    reviewLedger: { ...DEFAULT_REVIEW_LEDGER },
    codex: { ...DEFAULT_CODEX },
    claude: { ...DEFAULT_CLAUDE },
  };
}

export function loadConfig(projectRoot: string): ResolvedConfig {
  const configPath = path.join(projectRoot, ".review-by-opp.json");
  const defaults = getDefaultConfig();

  if (!fs.existsSync(configPath)) {
    return defaults;
  }

  try {
    const raw = fs.readFileSync(configPath, "utf-8");
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return mergeConfig(defaults, parsed);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to parse .review-by-opp.json: ${msg}`);
  }
}

function mergeConfig(
  defaults: ResolvedConfig,
  overrides: Record<string, unknown>
): ResolvedConfig {
  const result = structuredClone(defaults);

  if (overrides.reviewLedger && typeof overrides.reviewLedger === "object") {
    const rl = overrides.reviewLedger as Record<string, unknown>;
    if (typeof rl.maxRounds === "number" && rl.maxRounds > 0) {
      result.reviewLedger.maxRounds = rl.maxRounds;
    }
    if (isReviewScope(rl.reviewScope)) {
      result.reviewLedger.reviewScope = rl.reviewScope;
    }
    if (Array.isArray(rl.blockingSeverities)) {
      result.reviewLedger.blockingSeverities = rl.blockingSeverities.filter(isSeverity);
    }
    if (typeof rl.rerunChecks === "boolean") {
      result.reviewLedger.rerunChecks = rl.rerunChecks;
    }
    if (Array.isArray(rl.allowedUnresolvedCategories)) {
      result.reviewLedger.allowedUnresolvedCategories =
        rl.allowedUnresolvedCategories.filter(isCategory);
    }
    if (typeof rl.stalledThreshold === "number" && rl.stalledThreshold > 0) {
      result.reviewLedger.stalledThreshold = rl.stalledThreshold;
    }
    if (typeof rl.debug === "boolean") {
      result.reviewLedger.debug = rl.debug;
    }
  }

  if (overrides.codex && typeof overrides.codex === "object") {
    const cx = overrides.codex as Record<string, unknown>;
    if (isCodexModelStrategy(cx.modelStrategy)) {
      result.codex.modelStrategy = cx.modelStrategy;
    }
    if (typeof cx.model === "string") {
      result.codex.model = cx.model;
    }
    if (typeof cx.reasoningEffort === "string") {
      result.codex.reasoningEffort = cx.reasoningEffort;
    }
    if (typeof cx.deepAuditReasoningEffort === "string") {
      result.codex.deepAuditReasoningEffort = cx.deepAuditReasoningEffort;
    }
    if (isCodexAuditMode(cx.auditMode)) {
      result.codex.auditMode = cx.auditMode;
    }
    if (typeof cx.commandOverride === "string") {
      result.codex.commandOverride = cx.commandOverride;
    }
    if (typeof cx.auditPromptPreset === "string") {
      result.codex.auditPromptPreset = cx.auditPromptPreset;
    }
  }

  return result;
}

// ── Type guards ──

function isReviewScope(v: unknown): v is ReviewScope {
  return v === "diff" || v === "changed-files" || v === "changed-files-plus-tests";
}

function isSeverity(v: unknown): v is Severity {
  return (
    v === "critical" || v === "high" || v === "medium" || v === "low" || v === "info"
  );
}

function isCategory(v: unknown): v is Category {
  const valid = new Set([
    "bug", "security", "performance", "style", "logic", "type-safety",
    "test-coverage", "documentation", "maintainability", "correctness", "other",
  ]);
  return typeof v === "string" && valid.has(v);
}

function isCodexModelStrategy(v: unknown): v is CodexModelStrategy {
  return v === "best_available" || v === "fixed" || v === "inherit_if_possible";
}

function isCodexAuditMode(v: unknown): v is CodexAuditMode {
  return v === "standard" || v === "deep";
}
