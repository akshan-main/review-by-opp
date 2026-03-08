import { describe, it, beforeEach, afterEach } from "node:test";
import * as assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import {
  createSession,
  loadSession,
  addFindings,
  resolveFinding,
  bulkResolve,
  startRound,
  closeRound,
  getOpenFindings,
  getBlockingFindings,
  checkExitGate,
  finalize,
  deduplicateFindings,
  persist,
} from "../core/ledger.js";
import { getDefaultConfig } from "../core/config.js";
import type { Finding, LedgerState } from "../core/types.js";

function makeTmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "review-by-opp-test-"));
}

function makeFinding(overrides: Partial<Finding> = {}): Finding {
  return {
    id: `f-1-${Math.random().toString(36).slice(2, 10)}`,
    round: 1,
    source: "codex",
    severity: "high",
    category: "bug",
    title: "Test finding",
    description: "A test finding",
    file: "src/main.ts",
    line_start: 42,
    line_end: null,
    suggested_fix: "Fix it",
    confidence: "high",
    status: "open",
    resolution_note: null,
    evidence: null,
    duplicate_of: null,
    superseded_by: null,
    ...overrides,
  };
}

describe("Ledger", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = makeTmpDir();
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe("createSession", () => {
    it("creates a new session with default config", () => {
      const config = getDefaultConfig();
      const state = createSession(tmpDir, config);

      assert.ok(state.session_id);
      assert.equal(state.current_round, 0);
      assert.equal(state.findings.length, 0);
      assert.equal(state.final_verdict, null);
      assert.equal(state.max_rounds, 4);
    });

    it("persists session to disk", () => {
      const config = getDefaultConfig();
      createSession(tmpDir, config);

      const currentPath = path.join(tmpDir, "reviews", "current.json");
      const artifactsDir = path.join(tmpDir, "reviews", "artifacts");
      assert.ok(fs.existsSync(currentPath));
      assert.ok(fs.existsSync(artifactsDir));
    });
  });

  describe("loadSession", () => {
    it("returns null when no session exists", () => {
      assert.equal(loadSession(tmpDir), null);
    });

    it("loads an existing session", () => {
      const config = getDefaultConfig();
      const created = createSession(tmpDir, config);
      const loaded = loadSession(tmpDir);

      assert.ok(loaded);
      assert.equal(loaded.session_id, created.session_id);
    });
  });

  describe("addFindings", () => {
    it("adds findings to the ledger", () => {
      const config = getDefaultConfig();
      let state = createSession(tmpDir, config);
      const finding = makeFinding();

      state = addFindings(state, [finding]);
      assert.equal(state.findings.length, 1);
      assert.equal(state.findings[0]!.title, "Test finding");
    });

    it("deduplicates findings with same file/title/category", () => {
      const config = getDefaultConfig();
      let state = createSession(tmpDir, config);
      const f1 = makeFinding({ id: "f-1-aaa" });
      const f2 = makeFinding({ id: "f-1-bbb", line_start: 43 }); // within 5 lines

      state = addFindings(state, [f1]);
      state = addFindings(state, [f2]);

      // Second should be marked duplicate
      const dupes = state.findings.filter((f) => f.status === "duplicate");
      assert.equal(dupes.length, 1);
    });
  });

  describe("resolveFinding", () => {
    it("resolves a finding with status and note", () => {
      const config = getDefaultConfig();
      let state = createSession(tmpDir, config);
      const finding = makeFinding({ id: "f-1-test" });
      state = addFindings(state, [finding]);

      state = resolveFinding(state, "f-1-test", "fixed", "Added null check");
      const resolved = state.findings.find((f) => f.id === "f-1-test");

      assert.equal(resolved?.status, "fixed");
      assert.equal(resolved?.resolution_note, "Added null check");
    });
  });

  describe("bulkResolve", () => {
    it("resolves multiple findings at once", () => {
      const config = getDefaultConfig();
      let state = createSession(tmpDir, config);
      const f1 = makeFinding({ id: "f-1-a" });
      const f2 = makeFinding({ id: "f-1-b", title: "Other finding", file: "other.ts" });
      state = addFindings(state, [f1, f2]);

      state = bulkResolve(state, [
        { id: "f-1-a", status: "fixed", note: "Fixed A" },
        { id: "f-1-b", status: "wont_fix", note: "Intentional" },
      ]);

      assert.equal(state.findings[0]!.status, "fixed");
      assert.equal(state.findings[1]!.status, "wont_fix");
    });
  });

  describe("getBlockingFindings", () => {
    it("returns only open findings with blocking severities", () => {
      const config = getDefaultConfig();
      let state = createSession(tmpDir, config);
      const high = makeFinding({ id: "f-high", severity: "high", file: "a.ts" });
      const low = makeFinding({ id: "f-low", severity: "low", title: "Low sev", file: "b.ts" });
      const info = makeFinding({ id: "f-info", severity: "info", title: "Info", file: "c.ts" });

      state = addFindings(state, [high, low, info]);
      const blocking = getBlockingFindings(state);

      assert.equal(blocking.length, 1);
      assert.equal(blocking[0]!.id, "f-high");
    });

    it("excludes allowed categories", () => {
      const config = getDefaultConfig();
      config.reviewLedger.allowedUnresolvedCategories = ["style"];
      let state = createSession(tmpDir, config);
      const finding = makeFinding({ id: "f-style", category: "style" });

      state = addFindings(state, [finding]);
      const blocking = getBlockingFindings(state);

      assert.equal(blocking.length, 0);
    });
  });

  describe("checkExitGate", () => {
    it("blocks when blocking findings are open", () => {
      const config = getDefaultConfig();
      let state = createSession(tmpDir, config);
      state = addFindings(state, [makeFinding({ severity: "critical" })]);

      const gate = checkExitGate(state);
      assert.equal(gate.can_exit, false);
      assert.ok(gate.blocking_reasons.length > 0);
    });

    it("blocks when fixed findings lack resolution notes", () => {
      const config = getDefaultConfig();
      let state = createSession(tmpDir, config);
      const f = makeFinding({ id: "f-nofix", severity: "high" });
      state = addFindings(state, [f]);
      state = resolveFinding(state, "f-nofix", "fixed", null); // no note!

      const gate = checkExitGate(state);
      assert.equal(gate.can_exit, false);
      assert.ok(gate.blocking_reasons.some((r) => r.includes("without resolution note")));
    });

    it("allows exit when all findings are properly resolved", () => {
      const config = getDefaultConfig();
      let state = createSession(tmpDir, config);
      const f = makeFinding({ id: "f-ok" });
      state = addFindings(state, [f]);
      state = resolveFinding(state, "f-ok", "fixed", "Added null check on line 42");

      const gate = checkExitGate(state);
      assert.equal(gate.can_exit, true);
      assert.equal(gate.verdict, "clean");
    });

    it("returns clean_with_accepted_exceptions for non-blocking open items", () => {
      const config = getDefaultConfig();
      let state = createSession(tmpDir, config);
      const f = makeFinding({ id: "f-info", severity: "info" });
      state = addFindings(state, [f]);

      const gate = checkExitGate(state);
      assert.equal(gate.can_exit, true);
      assert.equal(gate.verdict, "clean_with_accepted_exceptions");
    });

    it("blocks when a finding has an invalid resolution state", () => {
      const config = getDefaultConfig();
      let state = createSession(tmpDir, config);
      const f = makeFinding({ id: "f-bad-status" });
      (f as unknown as { status: string }).status = "unknown_state";
      state = addFindings(state, [f]);

      const gate = checkExitGate(state);
      assert.equal(gate.can_exit, false);
      assert.ok(gate.blocking_reasons.some((r) => r.includes("missing/invalid resolution state")));
    });
  });

  describe("finalize", () => {
    it("throws when exit gate blocks", () => {
      const config = getDefaultConfig();
      let state = createSession(tmpDir, config);
      state = addFindings(state, [makeFinding({ severity: "critical" })]);

      assert.throws(() => finalize(state), /Cannot finalize/);
    });

    it("sets final verdict when clear", () => {
      const config = getDefaultConfig();
      let state = createSession(tmpDir, config);
      const f = makeFinding({ id: "f-done" });
      state = addFindings(state, [f]);
      state = resolveFinding(state, "f-done", "fixed", "Done");

      const finalized = finalize(state);
      assert.equal(finalized.final_verdict, "clean");
    });
  });

  describe("deduplicateFindings", () => {
    it("marks duplicates by file/title/category within 5 lines", () => {
      const existing = [makeFinding({ id: "f-existing", line_start: 40 })];
      const incoming = [makeFinding({ id: "f-new", line_start: 44 })]; // within 5 lines

      const result = deduplicateFindings(existing, incoming);
      assert.equal(result.length, 1);
      assert.equal(result[0]!.status, "duplicate");
      assert.equal(result[0]!.duplicate_of, "f-existing");
    });

    it("does not mark as duplicate when lines differ by more than 5", () => {
      const existing = [makeFinding({ id: "f-existing", line_start: 10 })];
      const incoming = [makeFinding({ id: "f-new", line_start: 100 })];

      const result = deduplicateFindings(existing, incoming);
      assert.equal(result[0]!.status, "open");
    });

    it("does not mark as duplicate when category differs", () => {
      const existing = [makeFinding({ id: "f-existing", category: "bug" })];
      const incoming = [makeFinding({ id: "f-new", category: "security" })];

      const result = deduplicateFindings(existing, incoming);
      assert.equal(result[0]!.status, "open");
    });
  });

  describe("round tracking", () => {
    it("increments round number", () => {
      const config = getDefaultConfig();
      let state = createSession(tmpDir, config);
      state = startRound(state);
      assert.equal(state.current_round, 1);
      state = startRound(state);
      assert.equal(state.current_round, 2);
    });

    it("closes round with summary", () => {
      const config = getDefaultConfig();
      let state = createSession(tmpDir, config);
      state = startRound(state);
      state = addFindings(state, [makeFinding({ round: 1 })]);
      state = closeRound(state, "gpt-5.3-codex", "high", 1500);

      assert.equal(state.rounds.length, 1);
      assert.equal(state.rounds[0]!.round, 1);
      assert.equal(state.rounds[0]!.codex_model, "gpt-5.3-codex");
    });
  });
});
