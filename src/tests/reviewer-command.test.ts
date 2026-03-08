import { describe, it, beforeEach, afterEach } from "node:test";
import * as assert from "node:assert/strict";
import { execSync } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { getDefaultConfig } from "../core/config.js";
import { buildReviewCommand } from "../codex/reviewer.js";

function makeTmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "review-by-opp-reviewer-"));
}

describe("Reviewer command builder", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = makeTmpDir();
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("uses inherited mode by default (no model/reasoning override)", () => {
    const config = getDefaultConfig();
    const cmd = buildReviewCommand("npx @openai/codex", {
      projectRoot: tmpDir,
      codexConfig: config.codex,
      reviewScope: "diff",
      round: 1,
      customPrompt: "audit this",
    });

    assert.match(cmd, /npx @openai\/codex exec --sandbox read-only/);
    assert.doesNotMatch(cmd, /--model/);
    assert.doesNotMatch(cmd, /model_reasoning_effort/);
    assert.match(cmd, /'audit this'$/);
  });

  it("applies fixed model and configured reasoning effort", () => {
    const config = getDefaultConfig();
    config.codex.modelStrategy = "fixed";
    config.codex.model = "gpt-5.3-codex";
    config.codex.reasoningEffort = "high";

    const cmd = buildReviewCommand("npx @openai/codex", {
      projectRoot: tmpDir,
      codexConfig: config.codex,
      reviewScope: "diff",
      round: 1,
      customPrompt: "audit this",
    });

    assert.match(cmd, /--model 'gpt-5\.3-codex'/);
    assert.match(cmd, /-c 'model_reasoning_effort=high'/);
  });

  it("uses deep audit effort when audit mode is deep", () => {
    const config = getDefaultConfig();
    config.codex.auditMode = "deep";
    config.codex.deepAuditReasoningEffort = "xhigh";

    const cmd = buildReviewCommand("codex", {
      projectRoot: tmpDir,
      codexConfig: config.codex,
      reviewScope: "diff",
      round: 1,
      customPrompt: "audit this",
    });

    assert.match(cmd, /-c 'model_reasoning_effort=xhigh'/);
  });

  it("injects changed file scope into the generated prompt", () => {
    execSync("git init", { cwd: tmpDir, stdio: "ignore" });
    fs.writeFileSync(path.join(tmpDir, "src.ts"), "export const x = 1;\n", "utf-8");

    const config = getDefaultConfig();
    const cmd = buildReviewCommand("codex", {
      projectRoot: tmpDir,
      codexConfig: config.codex,
      reviewScope: "changed-files",
      round: 1,
    });

    assert.match(cmd, /Review scope requested: changed-files\./);
    assert.match(cmd, /- src\.ts/);
  });
});
