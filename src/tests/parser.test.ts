import { describe, it } from "node:test";
import * as assert from "node:assert/strict";
import { parseCodexOutput } from "../codex/reviewer.js";

describe("Codex output parser", () => {
  it("parses FINDING: prefixed JSON lines", () => {
    const output = [
      "Some preamble text",
      'FINDING: {"severity":"high","category":"bug","title":"Null pointer","description":"Possible null dereference","file":"src/main.ts","line_start":42,"suggested_fix":"Add null check","confidence":"high"}',
      'FINDING: {"severity":"medium","category":"performance","title":"Slow loop","description":"O(n^2) loop","file":"src/util.ts","line_start":10,"confidence":"medium"}',
      "Some trailing text",
    ].join("\n");

    const findings = parseCodexOutput(output, 1);
    assert.equal(findings.length, 2);
    assert.equal(findings[0]!.severity, "high");
    assert.equal(findings[0]!.category, "bug");
    assert.equal(findings[0]!.title, "Null pointer");
    assert.equal(findings[0]!.file, "src/main.ts");
    assert.equal(findings[0]!.line_start, 42);
    assert.equal(findings[0]!.status, "open");
    assert.equal(findings[0]!.source, "codex");
    assert.equal(findings[1]!.severity, "medium");
    assert.equal(findings[1]!.category, "performance");
  });

  it("parses raw JSON lines with severity field", () => {
    const output = '{"severity":"low","category":"style","title":"Naming","description":"Bad name","file":"x.ts","line_start":1,"confidence":"low"}';
    const findings = parseCodexOutput(output, 2);
    assert.equal(findings.length, 1);
    assert.equal(findings[0]!.round, 2);
    assert.equal(findings[0]!.severity, "low");
  });

  it("normalizes unknown severity to medium", () => {
    const output = 'FINDING: {"severity":"EXTREME","category":"bug","title":"Test","description":"Test","file":"x.ts","line_start":1,"confidence":"high"}';
    const findings = parseCodexOutput(output, 1);
    assert.equal(findings.length, 1);
    assert.equal(findings[0]!.severity, "medium");
  });

  it("normalizes unknown category to other", () => {
    const output = 'FINDING: {"severity":"high","category":"unknown_cat","title":"Test","description":"Test","file":"x.ts","line_start":1,"confidence":"high"}';
    const findings = parseCodexOutput(output, 1);
    assert.equal(findings[0]!.category, "other");
  });

  it("handles empty output", () => {
    const findings = parseCodexOutput("", 1);
    assert.equal(findings.length, 0);
  });

  it("handles malformed JSON gracefully", () => {
    const output = "FINDING: {not valid json at all}";
    const findings = parseCodexOutput(output, 1);
    assert.equal(findings.length, 0);
  });

  it("assigns unique IDs to each finding", () => {
    const output = [
      'FINDING: {"severity":"high","category":"bug","title":"A","description":"A","file":"a.ts","line_start":1,"confidence":"high"}',
      'FINDING: {"severity":"high","category":"bug","title":"B","description":"B","file":"b.ts","line_start":2,"confidence":"high"}',
    ].join("\n");

    const findings = parseCodexOutput(output, 1);
    assert.notEqual(findings[0]!.id, findings[1]!.id);
    assert.ok(findings[0]!.id.startsWith("f-1-"));
  });

  it("parses file:line:message format as fallback", () => {
    const output = "src/main.ts:42: error: something is wrong\nsrc/util.ts:10: warning: could be better";
    const findings = parseCodexOutput(output, 1);
    assert.ok(findings.length >= 1);
  });

  it("sets null for missing optional fields", () => {
    const output = 'FINDING: {"severity":"high","category":"bug","title":"Test","description":"Desc","file":"x.ts"}';
    const findings = parseCodexOutput(output, 1);
    assert.equal(findings[0]!.line_start, null);
    assert.equal(findings[0]!.suggested_fix, null);
    assert.equal(findings[0]!.evidence, null);
  });
});
