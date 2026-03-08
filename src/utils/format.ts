/**
 * Formatting utilities for status output and finding display.
 */

import type {
  Finding,
  LedgerState,
  StatusInfo,
  RoundSummary,
} from "../core/types.js";
import type { CheckResult as CheckRes } from "./checks.js";

export function formatStatus(status: StatusInfo): string {
  const lines: string[] = [
    `## review-by-opp Status`,
    ``,
    `| Field | Value |`,
    `|-------|-------|`,
    `| Session | \`${status.session_id.slice(0, 8)}...\` |`,
    `| Round | ${status.current_round} / ${status.max_rounds} |`,
    `| Total findings | ${status.total_findings} |`,
    `| Open | ${status.open_findings} |`,
    `| Blocking open | ${status.blocking_open} |`,
    `| Resolved | ${status.resolved_findings} |`,
    `| Review scope | ${status.review_scope} |`,
    `| Can finalize | ${status.can_finalize ? "Yes" : "**No**"} |`,
    `| Verdict | ${status.final_verdict ?? "in progress"} |`,
    ``,
    `### Agent Configuration`,
    `| Agent | Setting | Value |`,
    `|-------|---------|-------|`,
    `| Claude | Model | ${status.claude_model} |`,
    `| Claude | Effort | ${status.claude_effort} |`,
    `| Codex | Config mode | ${status.codex_config_mode} |`,
    `| Codex | Model | ${status.codex_effective_model ?? "default"} |`,
    `| Codex | Reasoning | ${status.codex_reasoning_effort ?? "default"} |`,
  ];

  if (status.blocking_reasons.length > 0) {
    lines.push(``, `### Blocking Reasons`);
    for (const reason of status.blocking_reasons) {
      lines.push(`- ${reason}`);
    }
  }

  return lines.join("\n");
}

export function formatFindings(findings: Finding[]): string {
  if (findings.length === 0) return "No findings.";

  const lines: string[] = [`## Findings (${findings.length})\n`];

  for (const f of findings) {
    const loc = f.line_start ? `:${f.line_start}` : "";
    lines.push(
      `### [${f.status.toUpperCase()}] ${f.title}`,
      `- **ID:** \`${f.id}\``,
      `- **Severity:** ${f.severity} | **Category:** ${f.category} | **Confidence:** ${f.confidence}`,
      `- **File:** ${f.file}${loc}`,
      `- **Description:** ${f.description}`,
    );
    if (f.suggested_fix) {
      lines.push(`- **Suggested fix:** ${f.suggested_fix}`);
    }
    if (f.resolution_note) {
      lines.push(`- **Resolution note:** ${f.resolution_note}`);
    }
    if (f.duplicate_of) {
      lines.push(`- **Duplicate of:** \`${f.duplicate_of}\``);
    }
    lines.push("");
  }

  return lines.join("\n");
}

export function formatFindingsCompact(findings: Finding[]): string {
  if (findings.length === 0) return "No findings.";

  const lines: string[] = [];
  for (const f of findings) {
    const loc = f.line_start ? `:${f.line_start}` : "";
    lines.push(
      `- [${f.status}] \`${f.id}\` ${f.severity}/${f.category}: ${f.title} (${f.file}${loc})`
    );
  }
  return lines.join("\n");
}

export function formatExitGate(gate: { can_exit: boolean; blocking_reasons: string[]; verdict: string }): string {
  const lines: string[] = [
    `## Exit Gate`,
    ``,
    `**Can exit:** ${gate.can_exit ? "Yes" : "**No**"}`,
    `**Verdict:** ${gate.verdict}`,
  ];

  if (gate.blocking_reasons.length > 0) {
    lines.push(``, `**Blocking reasons:**`);
    for (const r of gate.blocking_reasons) {
      lines.push(`- ${r}`);
    }
  }

  return lines.join("\n");
}

export function formatChecks(checks: CheckRes[]): string {
  const lines: string[] = [`## Verification Checks\n`];

  for (const c of checks) {
    const icon = c.skipped ? "⏭" : c.passed ? "✓" : "✗";
    const status = c.skipped
      ? `skipped (${c.skip_reason})`
      : c.passed
        ? "passed"
        : "**FAILED**";
    lines.push(`- ${icon} **${c.name}**: ${status}`);
    if (!c.passed && !c.skipped && c.output) {
      const truncated = c.output.slice(0, 500);
      lines.push("```", truncated, "```");
    }
  }

  return lines.join("\n");
}

export function formatRoundSummary(summary: RoundSummary): string {
  return [
    `## Round ${summary.round} Summary`,
    ``,
    `| Metric | Value |`,
    `|--------|-------|`,
    `| Total findings | ${summary.total_findings} |`,
    `| New this round | ${summary.new_findings} |`,
    `| Resolved this round | ${summary.resolved_this_round} |`,
    `| Still open | ${summary.still_open} |`,
    `| Blocking open | ${summary.blocking_open} |`,
    `| Verdict | ${summary.verdict} |`,
    `| Duration | ${summary.duration_ms ? `${(summary.duration_ms / 1000).toFixed(1)}s` : "n/a"} |`,
  ].join("\n");
}

export function formatFinalVerdict(state: LedgerState): string {
  const lines: string[] = [
    `## Final Verdict: ${state.final_verdict?.toUpperCase() ?? "UNKNOWN"}`,
    ``,
    `- Rounds completed: ${state.current_round}`,
    `- Total findings: ${state.findings.length}`,
    `- Open: ${state.findings.filter((f) => f.status === "open").length}`,
    `- Fixed: ${state.findings.filter((f) => f.status === "fixed").length}`,
    `- Won't fix: ${state.findings.filter((f) => f.status === "wont_fix").length}`,
    `- Not reproducible: ${state.findings.filter((f) => f.status === "not_reproducible").length}`,
    `- Needs context: ${state.findings.filter((f) => f.status === "needs_context").length}`,
    `- Duplicate: ${state.findings.filter((f) => f.status === "duplicate").length}`,
    `- Superseded: ${state.findings.filter((f) => f.status === "superseded").length}`,
  ];

  return lines.join("\n");
}
