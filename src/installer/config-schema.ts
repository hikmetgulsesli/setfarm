/**
 * Config Schema Validation
 *
 * Codifies tribal knowledge rules that previously lived only in MEMORY.md.
 * Every rule here was learned through production incidents.
 */

import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { logger } from "../lib/logger.js";

// ── Types ────────────────────────────────────────────────────────────

export interface ConfigValidationError {
  path: string;
  expected: string;
  actual: string;
  severity: "error" | "warning";
}

// ── Validation Rules ────────────────────────────────────────────────

/**
 * Validate OpenClaw config against known production rules.
 *
 * Rules codified from MEMORY.md tribal knowledge:
 * - Sandbox MUST be OFF: agents can't write to worktree directories otherwise
 * - workspaceOnly MUST be false: same root cause
 * - exec.security MUST be "full": agents need build/test execution
 * - Model name must never be "default": causes silent fallback failures
 * - Anthropic custom provider MUST NOT exist: causes gateway crash
 */
export function validateConfig(raw: unknown): ConfigValidationError[] {
  const errors: ConfigValidationError[] = [];

  if (!raw || typeof raw !== "object") {
    errors.push({
      path: "(root)",
      expected: "object",
      actual: String(raw),
      severity: "error",
    });
    return errors;
  }

  const config = raw as Record<string, any>;

  // Rule 1: Sandbox must be OFF
  // Root cause: sandbox aktifken agent'lar worktree dizinine yazamıyor
  // ("Path escapes workspace root") → tüm story'ler abandon oluyor
  const sandboxMode = config?.agents?.defaults?.sandbox?.mode;
  if (sandboxMode !== undefined && sandboxMode !== "off") {
    errors.push({
      path: "agents.defaults.sandbox.mode",
      expected: '"off"',
      actual: JSON.stringify(sandboxMode),
      severity: "error",
    });
  }

  // Rule 2: workspaceOnly must be false
  // Same root cause as sandbox — worktree writes fail
  const workspaceOnly = config?.tools?.fs?.workspaceOnly;
  if (workspaceOnly !== undefined && workspaceOnly !== false) {
    errors.push({
      path: "tools.fs.workspaceOnly",
      expected: "false",
      actual: JSON.stringify(workspaceOnly),
      severity: "error",
    });
  }

  // Rule 3: exec.security must be "full"
  // Without this, agents can't run build/test commands
  const execSecurity = config?.tools?.exec?.security;
  if (execSecurity !== undefined && execSecurity !== "full") {
    errors.push({
      path: "tools.exec.security",
      expected: '"full"',
      actual: JSON.stringify(execSecurity),
      severity: "error",
    });
  }

  // Rule 4: No model may use "default" as its value
  // Causes silent fallback failures in gateway
  const agents = config?.agents?.list;
  if (Array.isArray(agents)) {
    for (const agent of agents) {
      if (agent?.model === "default") {
        errors.push({
          path: `agents.list[${agent.id ?? "?"}].model`,
          expected: "explicit model name (e.g. minimax/MiniMax-M2.5)",
          actual: '"default"',
          severity: "error",
        });
      }
    }
  }

  // Rule 5: Anthropic custom provider must not exist
  // Causes gateway crash with OAuth 3rd-party
  const providers = config?.providers;
  if (providers && typeof providers === "object") {
    for (const [name, _provider] of Object.entries(providers)) {
      if (name.toLowerCase().includes("anthropic")) {
        errors.push({
          path: `providers.${name}`,
          expected: "no Anthropic custom provider",
          actual: `provider "${name}" exists`,
          severity: "error",
        });
      }
    }
  }

  return errors;
}

/**
 * Log validation results. Returns true if there are errors.
 */
export function logValidationErrors(errors: ConfigValidationError[]): boolean {
  const criticalErrors = errors.filter(e => e.severity === "error");
  const warnings = errors.filter(e => e.severity === "warning");

  for (const w of warnings) {
    logger.warn(`[config-validate] WARNING: ${w.path} — expected ${w.expected}, got ${w.actual}`);
  }
  for (const e of criticalErrors) {
    logger.error(`[config-validate] ERROR: ${e.path} — expected ${e.expected}, got ${e.actual}`);
  }

  if (criticalErrors.length > 0) {
    logger.error(`[config-validate] ${criticalErrors.length} critical config error(s) detected. Pipeline may fail.`);
  }

  return criticalErrors.length > 0;
}

// ── Atomic Write ────────────────────────────────────────────────────

/**
 * Atomic write: write to temp file then rename.
 * Prevents partial writes on crash/power loss from corrupting config.
 */
export function atomicWriteSync(filePath: string, content: string): void {
  const dir = path.dirname(filePath);
  const tmpPath = path.join(dir, `.tmp-${path.basename(filePath)}-${Date.now()}`);
  fs.writeFileSync(tmpPath, content, "utf-8");
  fs.renameSync(tmpPath, filePath);
}
