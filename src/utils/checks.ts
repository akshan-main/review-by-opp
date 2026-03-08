/**
 * Rerun checks: tests, lint, typecheck.
 */

import { execSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";

export interface CheckResult {
  name: string;
  passed: boolean;
  output: string;
  skipped: boolean;
  skip_reason: string | null;
}

export function runChecks(projectRoot: string): CheckResult[] {
  const results: CheckResult[] = [];

  results.push(runTestCheck(projectRoot));
  results.push(runLintCheck(projectRoot));
  results.push(runTypecheckCheck(projectRoot));

  return results;
}

function runTestCheck(projectRoot: string): CheckResult {
  const pkg = loadPackageJson(projectRoot);
  if (!pkg?.scripts?.test) {
    return {
      name: "tests",
      passed: true,
      output: "",
      skipped: true,
      skip_reason: "No test script found in package.json",
    };
  }

  return runNpmScript(projectRoot, "test", "tests");
}

function runLintCheck(projectRoot: string): CheckResult {
  const pkg = loadPackageJson(projectRoot);
  if (!pkg?.scripts?.lint) {
    return {
      name: "lint",
      passed: true,
      output: "",
      skipped: true,
      skip_reason: "No lint script found in package.json",
    };
  }

  return runNpmScript(projectRoot, "lint", "lint");
}

function runTypecheckCheck(projectRoot: string): CheckResult {
  const pkg = loadPackageJson(projectRoot);

  // Check for typecheck, type-check, or tsc script
  const scriptName = ["typecheck", "type-check"].find(
    (s) => pkg?.scripts?.[s]
  );

  if (!scriptName) {
    // Try tsc --noEmit directly if tsconfig exists
    const tsconfigPath = path.join(projectRoot, "tsconfig.json");
    if (fs.existsSync(tsconfigPath)) {
      return runCommand(projectRoot, "npx tsc --noEmit", "typecheck");
    }
    return {
      name: "typecheck",
      passed: true,
      output: "",
      skipped: true,
      skip_reason: "No typecheck script or tsconfig.json found",
    };
  }

  return runNpmScript(projectRoot, scriptName, "typecheck");
}

function runNpmScript(
  projectRoot: string,
  script: string,
  name: string
): CheckResult {
  return runCommand(projectRoot, `npm run ${script}`, name);
}

function runCommand(
  projectRoot: string,
  command: string,
  name: string
): CheckResult {
  try {
    const output = execSync(command, {
      cwd: projectRoot,
      timeout: 120000,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    });
    return { name, passed: true, output, skipped: false, skip_reason: null };
  } catch (err: unknown) {
    const error = err as { stdout?: string; stderr?: string };
    return {
      name,
      passed: false,
      output: (error.stdout ?? "") + "\n" + (error.stderr ?? ""),
      skipped: false,
      skip_reason: null,
    };
  }
}

function loadPackageJson(
  projectRoot: string
): { scripts?: Record<string, string> } | null {
  const pkgPath = path.join(projectRoot, "package.json");
  if (!fs.existsSync(pkgPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
  } catch {
    return null;
  }
}
