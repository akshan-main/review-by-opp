import { describe, it, beforeEach, afterEach } from "node:test";
import * as assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { loadConfig, getDefaultConfig } from "../core/config.js";

function makeTmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "review-by-opp-cfg-"));
}

describe("Config", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = makeTmpDir();
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("returns defaults when no config file exists", () => {
    const config = loadConfig(tmpDir);
    assert.equal(config.reviewLedger.maxRounds, 4);
    assert.equal(config.reviewLedger.reviewScope, "diff");
    assert.deepEqual(config.reviewLedger.blockingSeverities, ["critical", "high", "medium"]);
    assert.equal(config.codex.role, "auditor_only");
    assert.equal(config.codex.modelStrategy, "best_available");
    assert.equal(config.codex.reasoningEffort, "");
    assert.equal(config.claude.role, "builder");
    assert.equal(config.claude.modelControl, "user_managed");
  });

  it("merges overrides from config file", () => {
    const configData = {
      reviewLedger: {
        maxRounds: 8,
        reviewScope: "changed-files",
        blockingSeverities: ["critical", "high"],
      },
      codex: {
        modelStrategy: "fixed",
        model: "o3",
        reasoningEffort: "xhigh",
      },
    };
    fs.writeFileSync(
      path.join(tmpDir, ".review-by-opp.json"),
      JSON.stringify(configData),
      "utf-8"
    );

    const config = loadConfig(tmpDir);
    assert.equal(config.reviewLedger.maxRounds, 8);
    assert.equal(config.reviewLedger.reviewScope, "changed-files");
    assert.deepEqual(config.reviewLedger.blockingSeverities, ["critical", "high"]);
    assert.equal(config.codex.modelStrategy, "fixed");
    assert.equal(config.codex.model, "o3");
    assert.equal(config.codex.reasoningEffort, "xhigh");
    // Unchanged defaults
    assert.equal(config.reviewLedger.rerunChecks, true);
    assert.equal(config.claude.role, "builder");
  });

  it("ignores invalid severity values", () => {
    const configData = {
      reviewLedger: {
        blockingSeverities: ["critical", "invalid", "low"],
      },
    };
    fs.writeFileSync(
      path.join(tmpDir, ".review-by-opp.json"),
      JSON.stringify(configData),
      "utf-8"
    );

    const config = loadConfig(tmpDir);
    assert.deepEqual(config.reviewLedger.blockingSeverities, ["critical", "low"]);
  });

  it("ignores invalid maxRounds values", () => {
    const configData = {
      reviewLedger: { maxRounds: -1 },
    };
    fs.writeFileSync(
      path.join(tmpDir, ".review-by-opp.json"),
      JSON.stringify(configData),
      "utf-8"
    );

    const config = loadConfig(tmpDir);
    assert.equal(config.reviewLedger.maxRounds, 4); // default
  });

  it("throws on malformed JSON", () => {
    fs.writeFileSync(
      path.join(tmpDir, ".review-by-opp.json"),
      "not json {{{",
      "utf-8"
    );

    assert.throws(() => loadConfig(tmpDir), /Failed to parse/);
  });

  it("getDefaultConfig returns fresh copies", () => {
    const a = getDefaultConfig();
    const b = getDefaultConfig();
    a.reviewLedger.maxRounds = 99;
    assert.equal(b.reviewLedger.maxRounds, 4);
  });
});
