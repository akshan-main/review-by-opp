/**
 * Codex CLI detection and capability probing.
 */

import { execSync } from "node:child_process";

export interface CodexDetectionResult {
  installed: boolean;
  command: string;
  version: string | null;
  hasExecCommand: boolean;
  hasJsonOutput: boolean;
  error: string | null;
  guidance: string | null;
}

export function detectCodex(commandOverride?: string): CodexDetectionResult {
  const commands = commandOverride
    ? [commandOverride]
    : ["npx @openai/codex", "codex-cli", "codex"];

  for (const cmd of commands) {
    const result = tryDetect(cmd);
    if (result.installed) return result;
  }

  return {
    installed: false,
    command: "",
    version: null,
    hasExecCommand: false,
    hasJsonOutput: false,
    error: "Codex CLI not found.",
    guidance: [
      "Install the Codex CLI:",
      "  npm install -g @openai/codex",
      "",
      "Then sign in:",
      "  npx @openai/codex login",
      "",
      "Or set codex.commandOverride in .review-by-opp.json to point to your Codex binary.",
    ].join("\n"),
  };
}

function tryDetect(command: string): CodexDetectionResult {
  try {
    // Check if the command exists and get help output
    const helpOutput = execSync(`${command} --help 2>&1`, {
      timeout: 10000,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    });

    // Verify this is actually OpenAI's Codex CLI
    const isCodexCli =
      helpOutput.includes("Codex CLI") ||
      helpOutput.includes("codex exec") ||
      helpOutput.includes("codex review");

    if (!isCodexCli) {
      return {
        installed: false,
        command,
        version: null,
        hasExecCommand: false,
        hasJsonOutput: false,
        error: `${command} exists but does not appear to be OpenAI's Codex CLI.`,
        guidance: "Install the correct Codex CLI: npm install -g @openai/codex",
      };
    }

    // Check version
    let version: string | null = null;
    try {
      const versionOutput = execSync(`${command} --version 2>&1`, {
        timeout: 5000,
        encoding: "utf-8",
      }).trim();
      version = versionOutput;
    } catch {
      // Version check is optional
    }

    // Check for exec command
    const hasExecCommand = helpOutput.includes("exec");

    // Check for --json flag support
    const hasJsonOutput = helpOutput.includes("--json");

    return {
      installed: true,
      command,
      version,
      hasExecCommand,
      hasJsonOutput,
      error: null,
      guidance: null,
    };
  } catch {
    return {
      installed: false,
      command,
      version: null,
      hasExecCommand: false,
      hasJsonOutput: false,
      error: `Command '${command}' not found or failed.`,
      guidance: null,
    };
  }
}

export function checkCodexAuth(command: string): {
  authenticated: boolean;
  error: string | null;
  guidance: string | null;
} {
  try {
    // login status returns non-zero when auth is missing.
    execSync(`${command} login status 2>&1`, {
      timeout: 5000,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    });
    return { authenticated: true, error: null, guidance: null };
  } catch {
    return {
      authenticated: false,
      error: "Could not verify Codex authentication.",
      guidance: [
        "Sign in to Codex:",
        "  npx @openai/codex login",
        "",
        "This uses your ChatGPT account - no API key required.",
      ].join("\n"),
    };
  }
}
