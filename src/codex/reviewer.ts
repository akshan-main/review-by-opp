/**
 * Codex review invocation and output parsing.
 * Invokes Codex CLI's non-interactive exec command and normalizes output into findings.
 */

import { execSync, type ExecSyncOptionsWithStringEncoding } from "node:child_process";
import * as crypto from "node:crypto";
import type {
  Finding,
  CodexReviewResult,
  CodexConfig,
  ReviewScope,
  Severity,
  Category,
  Confidence,
} from "../core/types.js";
import { checkGitRepo, getChangedTestFiles } from "../utils/git.js";
import { detectCodex } from "./detector.js";

export interface ReviewOptions {
  projectRoot: string;
  codexConfig: CodexConfig;
  reviewScope: ReviewScope;
  round: number;
  customPrompt?: string;
  dryRun?: boolean;
  debug?: boolean;
}

export function runCodexReview(options: ReviewOptions): CodexReviewResult {
  const startTime = Date.now();
  const runtime = resolveRuntimeCodexOptions(options.codexConfig);

  // Detect Codex
  const detection = detectCodex(options.codexConfig.commandOverride || undefined);
  if (!detection.installed) {
    return {
      success: false,
      raw_output: "",
      findings: [],
      model_used: null,
      duration_ms: Date.now() - startTime,
      error: detection.error ?? "Codex not installed",
    };
  }

  // Build the review command
  const cmd = buildReviewCommand(detection.command, options);

  if (options.dryRun) {
    return {
      success: true,
      raw_output: `[DRY RUN] Would execute: ${cmd}`,
      findings: [],
      model_used: null,
      duration_ms: Date.now() - startTime,
      error: null,
    };
  }

  if (options.debug) {
    process.stderr.write(`[review-by-opp:debug] Executing: ${cmd}\n`);
  }

  try {
    const execOptions: ExecSyncOptionsWithStringEncoding = {
      cwd: options.projectRoot,
      timeout: 300000, // 5 minute timeout
      encoding: "utf-8",
      maxBuffer: 10 * 1024 * 1024, // 10MB
      stdio: ["pipe", "pipe", "pipe"],
    };

    const output = execSync(cmd, execOptions);
    const findings = parseCodexOutput(output, options.round);

    return {
      success: true,
      raw_output: output,
      findings,
      model_used: runtime.model,
      duration_ms: Date.now() - startTime,
      error: null,
    };
  } catch (err: unknown) {
    const error = err as { stderr?: string; stdout?: string; message?: string };
    const stderr = error.stderr ?? "";
    const stdout = error.stdout ?? "";
    const combined = stdout + "\n" + stderr;

    // Check for auth issues
    if (
      combined.includes("not logged in") ||
      combined.includes("login status") ||
      combined.includes("not authenticated") ||
      combined.includes("authentication") ||
      combined.includes("401") ||
      combined.includes("codex login")
    ) {
      return {
        success: false,
        raw_output: combined,
        findings: [],
        model_used: null,
        duration_ms: Date.now() - startTime,
        error: [
          "Codex authentication failed.",
          "Sign in with: npx @openai/codex login",
          "This uses your ChatGPT account - no API key required.",
        ].join("\n"),
      };
    }

    // Try to parse findings from output even if exit code was non-zero
    const findings = parseCodexOutput(combined, options.round);
    if (findings.length > 0) {
      return {
        success: true,
        raw_output: combined,
        findings,
        model_used: runtime.model,
        duration_ms: Date.now() - startTime,
        error: null,
      };
    }

    return {
      success: false,
      raw_output: combined,
      findings: [],
      model_used: null,
      duration_ms: Date.now() - startTime,
      error:
        error.message ??
        "Codex review command failed. If authentication is required, run: npx @openai/codex login",
    };
  }
}

export function buildReviewCommand(codexCmd: string, options: ReviewOptions): string {
  const runtime = resolveRuntimeCodexOptions(options.codexConfig);
  const parts: string[] = [
    codexCmd,
    "exec",
    "--sandbox",
    "read-only",
  ];

  if (runtime.model) {
    parts.push("--model", shellQuote(runtime.model));
  }

  if (runtime.reasoningEffort) {
    parts.push("-c", shellQuote(`model_reasoning_effort=${runtime.reasoningEffort}`));
  }

  // Custom prompt
  const prompt = options.customPrompt ?? buildAuditPrompt(options);
  parts.push(shellQuote(prompt));

  return parts.join(" ");
}

function buildAuditPrompt(options: ReviewOptions): string {
  const scopeLines = buildScopeInstructions(options.projectRoot, options.reviewScope);

  const base = [
    "You are a strict code auditor. Review the changes for:",
    "- Bugs and logic errors",
    "- Security vulnerabilities",
    "- Performance issues",
    "- Type safety problems",
    "- Missing error handling",
    "- Test coverage gaps",
    "",
    "For each issue found, output a structured finding with:",
    "- severity: critical, high, medium, low, or info",
    "- category: bug, security, performance, style, logic, type-safety, test-coverage, documentation, maintainability, correctness, or other",
    "- title: brief summary",
    "- description: detailed explanation",
    "- file: the file path",
    "- line_start: starting line number (if applicable)",
    "- suggested_fix: how to fix it (if applicable)",
    "- confidence: high, medium, or low",
    "",
    "Format each finding as a JSON object on its own line, prefixed with FINDING:",
    'Example: FINDING: {"severity":"high","category":"bug","title":"Null pointer","description":"...","file":"src/main.ts","line_start":42,"suggested_fix":"Add null check","confidence":"high"}',
    "",
    "Do not edit files or propose applying patches directly.",
    "Audit only and report findings.",
    "",
    ...scopeLines,
  ];

  if (options.round > 1) {
    base.push(
      "",
      `This is review round ${options.round}. Focus on:`,
      "- Whether previous issues were actually fixed",
      "- Any regressions introduced by the fixes",
      "- Any new issues introduced"
    );
  }

  return base.join("\n");
}

export function parseCodexOutput(output: string, round: number): Finding[] {
  const findings: Finding[] = [];
  const lines = output.split("\n");

  for (const line of lines) {
    const trimmed = line.trim();

    // Look for FINDING: prefix
    if (trimmed.startsWith("FINDING:")) {
      const jsonStr = trimmed.slice("FINDING:".length).trim();
      const finding = tryParseFinding(jsonStr, round);
      if (finding) findings.push(finding);
      continue;
    }

    // Try to parse as raw JSON
    if (trimmed.startsWith("{") && trimmed.includes('"severity"')) {
      const finding = tryParseFinding(trimmed, round);
      if (finding) findings.push(finding);
    }
  }

  // If no structured findings found, try to extract from free-form text
  if (findings.length === 0 && output.trim().length > 0) {
    const extracted = extractFreeFormFindings(output, round);
    findings.push(...extracted);
  }

  return findings;
}

function tryParseFinding(jsonStr: string, round: number): Finding | null {
  try {
    const raw = JSON.parse(jsonStr) as Record<string, unknown>;
    return normalizeFinding(raw, round);
  } catch {
    return null;
  }
}

function normalizeFinding(
  raw: Record<string, unknown>,
  round: number
): Finding {
  return {
    id: `f-${round}-${crypto.randomUUID().slice(0, 8)}`,
    round,
    source: "codex",
    severity: normalizeSeverity(raw.severity),
    category: normalizeCategory(raw.category),
    title: String(raw.title ?? "Untitled finding"),
    description: String(raw.description ?? ""),
    file: String(raw.file ?? "unknown"),
    line_start: typeof raw.line_start === "number" ? raw.line_start : null,
    line_end: typeof raw.line_end === "number" ? raw.line_end : null,
    suggested_fix: raw.suggested_fix ? String(raw.suggested_fix) : null,
    confidence: normalizeConfidence(raw.confidence),
    status: "open",
    resolution_note: null,
    evidence: raw.evidence ? String(raw.evidence) : null,
    duplicate_of: null,
    superseded_by: null,
  };
}

function normalizeSeverity(v: unknown): Severity {
  const valid = new Set(["critical", "high", "medium", "low", "info"]);
  if (typeof v === "string" && valid.has(v.toLowerCase())) {
    return v.toLowerCase() as Severity;
  }
  return "medium";
}

function normalizeCategory(v: unknown): Category {
  const valid = new Set([
    "bug", "security", "performance", "style", "logic", "type-safety",
    "test-coverage", "documentation", "maintainability", "correctness", "other",
  ]);
  if (typeof v === "string" && valid.has(v.toLowerCase())) {
    return v.toLowerCase() as Category;
  }
  return "other";
}

function normalizeConfidence(v: unknown): Confidence {
  const valid = new Set(["high", "medium", "low"]);
  if (typeof v === "string" && valid.has(v.toLowerCase())) {
    return v.toLowerCase() as Confidence;
  }
  return "medium";
}

function extractFreeFormFindings(output: string, round: number): Finding[] {
  // Attempt basic pattern matching for common review output formats
  const findings: Finding[] = [];
  const patterns = [
    // "filename:line: message" format
    /^([^\s:]+):(\d+):\s*(?:warning|error|note)?:?\s*(.+)$/gm,
    // "- [ ] description (file)" format
    /^[-*]\s*\[?\s*\]?\s*(.+?)\s*\(([^)]+)\)/gm,
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(output)) !== null) {
      if (patterns.indexOf(pattern) === 0) {
        findings.push(
          normalizeFinding(
            {
              file: match[1],
              line_start: parseInt(match[2]!, 10),
              title: match[3],
              severity: "medium",
              category: "other",
              confidence: "low",
            },
            round
          )
        );
      }
    }
  }

  return findings;
}

function buildScopeInstructions(projectRoot: string, reviewScope: ReviewScope): string[] {
  if (reviewScope === "diff") {
    return [
      "Review scope: current uncommitted git diff (staged + unstaged).",
      "Focus findings on lines changed in this working tree.",
    ];
  }

  const git = checkGitRepo(projectRoot);
  if (!git.isRepo || git.changedFiles.length === 0) {
    return [
      `Review scope requested: ${reviewScope}.`,
      "No changed file list was available. Fall back to inspecting uncommitted changes.",
    ];
  }

  const files =
    reviewScope === "changed-files-plus-tests"
      ? [...new Set([...git.changedFiles, ...getChangedTestFiles(projectRoot)])]
      : git.changedFiles;

  const lines = [
    `Review scope requested: ${reviewScope}.`,
    "Prioritize these files:",
  ];

  for (const file of files) {
    lines.push(`- ${file}`);
  }

  return lines;
}

function resolveModel(config: CodexConfig): string | null {
  const configuredModel = config.model.trim();
  if (config.modelStrategy === "fixed") {
    return configuredModel || null;
  }

  // inherit_if_possible lets users supply an explicit fallback model while
  // still allowing Codex defaults when unset.
  if (config.modelStrategy === "inherit_if_possible") {
    return configuredModel || null;
  }

  // For best_available, let Codex resolve from user config/profile.
  return null;
}

function resolveReasoningEffort(config: CodexConfig): string | null {
  const effort =
    config.auditMode === "deep"
      ? config.deepAuditReasoningEffort.trim()
      : config.reasoningEffort.trim();
  return effort || null;
}

function resolveRuntimeCodexOptions(config: CodexConfig): {
  model: string | null;
  reasoningEffort: string | null;
} {
  return {
    model: resolveModel(config),
    reasoningEffort: resolveReasoningEffort(config),
  };
}

function shellQuote(arg: string): string {
  return `'${arg.replace(/'/g, `'\\''`)}'`;
}
