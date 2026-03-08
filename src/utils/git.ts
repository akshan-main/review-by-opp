/**
 * Git utilities for detecting repo state and gathering diff info.
 */

import { execSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";

export interface GitStatus {
  isRepo: boolean;
  hasDiff: boolean;
  changedFiles: string[];
  error: string | null;
  guidance: string | null;
}

export function checkGitRepo(projectRoot: string): GitStatus {
  try {
    execSync("git rev-parse --git-dir", {
      cwd: projectRoot,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    });
  } catch {
    return {
      isRepo: false,
      hasDiff: false,
      changedFiles: [],
      error: "Not a git repository.",
      guidance: [
        "review-by-opp requires a git repository.",
        "Initialize one with: git init",
        "Then make some changes and try again.",
      ].join("\n"),
    };
  }

  try {
    const diff = execSync("git diff --name-only", {
      cwd: projectRoot,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();

    const staged = execSync("git diff --cached --name-only", {
      cwd: projectRoot,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();

    const untracked = execSync("git ls-files --others --exclude-standard", {
      cwd: projectRoot,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();

    const allFiles = [
      ...new Set([
        ...(diff ? diff.split("\n") : []),
        ...(staged ? staged.split("\n") : []),
        ...(untracked ? untracked.split("\n") : []),
      ]),
    ].filter(Boolean);

    return {
      isRepo: true,
      hasDiff: allFiles.length > 0,
      changedFiles: allFiles,
      error: allFiles.length === 0 ? "No changes detected." : null,
      guidance:
        allFiles.length === 0
          ? "Make some code changes first, then run review-by-opp."
          : null,
    };
  } catch (err) {
    return {
      isRepo: true,
      hasDiff: false,
      changedFiles: [],
      error: `Failed to check git status: ${err instanceof Error ? err.message : String(err)}`,
      guidance: null,
    };
  }
}

export function getDiffStat(projectRoot: string): string {
  try {
    return execSync("git diff --stat", {
      cwd: projectRoot,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();
  } catch {
    return "(unable to get diff stat)";
  }
}

export function getChangedTestFiles(projectRoot: string): string[] {
  try {
    const diff = execSync("git diff --name-only", {
      cwd: projectRoot,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();

    const staged = execSync("git diff --cached --name-only", {
      cwd: projectRoot,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();

    const allFiles = [
      ...(diff ? diff.split("\n") : []),
      ...(staged ? staged.split("\n") : []),
    ];

    return allFiles.filter(
      (f) =>
        f.includes(".test.") ||
        f.includes(".spec.") ||
        f.includes("__tests__") ||
        f.startsWith("test/") ||
        f.startsWith("tests/")
    );
  } catch {
    return [];
  }
}
