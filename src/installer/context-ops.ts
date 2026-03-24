/**
 * Context Operations
 *
 * Extracted from step-ops.ts — template resolution, output parsing, progress/memory files.
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { getDb } from "../db.js";
import { pgGet } from "../db-pg.js";
import { logger } from "../lib/logger.js";
import { OPTIONAL_TEMPLATE_VARS, PROTECTED_CONTEXT_KEYS, PROJECT_MEMORY_MAX_LINES } from "./constants.js";
import { getAgentWorkspacePath } from "./worktree-ops.js";

const USE_PG = process.env.DB_BACKEND === "postgres";

// ── Path Utilities ────────────────────────────────────────────────

/**
 * Expand leading ~ to home directory. Node.js fs does not expand tilde.
 */
export function expandTilde(p: string): string {
  if (p.startsWith("~/")) return path.join(os.homedir(), p.slice(2));
  return p;
}

// ── Template Resolution ─────────────────────────────────────────────

/**
 * Resolve {{key}} placeholders in a template against a context object.
 */
export function resolveTemplate(template: string, context: Record<string, string>): string {
  // Supports {{key}}, {{key|default_value}}, and {{key.sub}}
  return template.replace(/\{\{(\w+(?:\.\w+)*)(?:\|([^}]*))?\}\}/g, (_match, key: string, defaultVal?: string) => {
    if (key in context) return context[key];
    const lower = key.toLowerCase();
    if (lower in context) return context[lower];
    // If a default was provided via {{key|default}}, use it instead of [missing:]
    if (defaultVal !== undefined) return defaultVal;
    return `[missing: ${key}]`;
  });
}

// ── Output Parsing ──────────────────────────────────────────────────

/**
 * Parse KEY: value lines from step output with support for multi-line values.
 * Accumulates continuation lines until the next KEY: boundary or end of output.
 * Returns a map of lowercase keys to their (trimmed) values.
 * Skips STORIES_JSON keys (handled separately).
 */
export function parseOutputKeyValues(output: string): Record<string, string> {
  const result: Record<string, string> = {};

  // Try JSON object format first: {"STATUS": "done", "KEY": "value", ...}
  const trimmed = output.trim();
  if (trimmed.startsWith("{")) {
    try {
      const obj = JSON.parse(trimmed);
      for (const [key, value] of Object.entries(obj)) {
        if (key === "STORIES_JSON" || key === "SCREEN_MAP") {
          // Complex values — store as JSON string for downstream parsing
          result[key.toLowerCase()] = typeof value === "string" ? value : JSON.stringify(value);
        } else {
          result[key.toLowerCase()] = String(value);
        }
      }
      return result;
    } catch (e) {
      logger.warn(`[parseOutputKeyValues] JSON parse failed — falling back to line-based parsing: ${String(e)}`, {});
    }
  }

  const lines = output.split("\n");
  let pendingKey: string | null = null;
  let pendingValue = "";

  function commitPending() {
    if (pendingKey && !pendingKey.startsWith("STORIES_JSON")) {
      result[pendingKey.toLowerCase()] = pendingValue.trim();
    }
    pendingKey = null;
    pendingValue = "";
  }

  for (const line of lines) {
    const match = line.match(/^([A-Z_]+):\s*(.*)$/);
    if (match) {
      // New KEY: line found — flush previous key
      commitPending();
      pendingKey = match[1];
      pendingValue = match[2];
    } else if (pendingKey) {
      // Continuation line — append to current key's value
      pendingValue += "\n" + line;
    }
  }
  // Flush any remaining pending value
  commitPending();

  return result;
}

// ── Context Merge ───────────────────────────────────────────────────

/**
 * Merge parsed output into run context, respecting protected keys.
 * Consolidates the 3x duplicate merge pattern from step-ops.ts.
 */
export function mergeContextSafe(
  context: Record<string, string>,
  parsed: Record<string, string>,
  opts?: { runId?: string }
): void {
  for (const [key, value] of Object.entries(parsed)) {
    if (PROTECTED_CONTEXT_KEYS.has(key) && context[key]) {
      logger.warn(`[context] Blocked overwrite of protected key "${key}" (current: "${context[key]}", attempted: "${value}")`, { runId: opts?.runId ?? "" });
      continue;
    }
    context[key] = value;
  }

  // Normalize tilde in path-like keys (Node.js fs does not expand ~)
  for (const pathKey of ["repo", "story_workdir"]) {
    if (context[pathKey]?.startsWith("~/")) {
      context[pathKey] = expandTilde(context[pathKey]);
    }
  }
}

/**
 * Apply default empty strings for optional template vars.
 * Prevents MISSING_INPUT_GUARD false positives.
 * Consolidates the 2x duplicate pattern from step-ops.ts.
 */
export function applyOptionalDefaults(context: Record<string, string>): void {
  for (const v of OPTIONAL_TEMPLATE_VARS) {
    if (!context[v]) context[v] = "";
  }
}

// ── Progress File ───────────────────────────────────────────────────

/**
 * Read progress.txt from the loop step's agent workspace.
 */
export async function readProgressFile(runId: string): Promise<string> {
  if (USE_PG) {
    const loopStep = await pgGet<{ agent_id: string }>(
      "SELECT agent_id FROM steps WHERE run_id = $1 AND type = 'loop' LIMIT 1", [runId]
    );
    if (!loopStep) return "(no progress file)";
    const workspace = getAgentWorkspacePath(loopStep.agent_id);
    if (!workspace) return "(no progress file)";
    try {
      const scopedPath = path.join(workspace, `progress-${runId}.txt`);
      if (!fs.existsSync(scopedPath)) return "(no progress yet)";
      return fs.readFileSync(scopedPath, "utf-8");
    } catch {
      return "(no progress yet)";
    }
  } else {
    const db = getDb();
    const loopStep = db.prepare(
      "SELECT agent_id FROM steps WHERE run_id = ? AND type = 'loop' LIMIT 1"
    ).get(runId) as { agent_id: string } | undefined;
    if (!loopStep) return "(no progress file)";
    const workspace = getAgentWorkspacePath(loopStep.agent_id);
    if (!workspace) return "(no progress file)";
    try {
      const scopedPath = path.join(workspace, `progress-${runId}.txt`);
      if (!fs.existsSync(scopedPath)) return "(no progress yet)";
      return fs.readFileSync(scopedPath, "utf-8");
    } catch {
      return "(no progress yet)";
    }
  }
}

// ── Project Memory ──────────────────────────────────────────────────

/**
 * Read PROJECT_MEMORY.md from the repo root.
 * Returns placeholder if file does not exist — non-breaking for existing workflows.
 */
export function readProjectMemory(context: Record<string, string>): string {
  const repo = expandTilde(context["repo"] || context["story_workdir"] || "");
  if (!repo) { logger.debug("[context-ops] readProjectMemory: no repo path in context"); return ""; }
  try {
    const memoryPath = path.join(repo, "PROJECT_MEMORY.md");
    if (!fs.existsSync(memoryPath)) return "(no project memory yet)";
    return fs.readFileSync(memoryPath, "utf-8");
  } catch {
    return "(no project memory yet)";
  }
}

/**
 * Update PROJECT_MEMORY.md after a story completes.
 * Appends/updates the story entry in the Completed Stories section.
 * Runs programmatically — does not depend on agent following instructions.
 */
export function updateProjectMemory(
  context: Record<string, string>,
  storyId: string,
  storyTitle: string,
  storyStatus: string,
  output: string
): void {
  const repo = expandTilde(context["repo"] || "");
  if (!repo) return;

  try {
    const memoryPath = path.join(repo, "PROJECT_MEMORY.md");
    let content = "";
    if (fs.existsSync(memoryPath)) {
      content = fs.readFileSync(memoryPath, "utf-8");
    } else {
      content = "# Project Memory\n\n## Completed Stories\n";
    }

    // Extract key info from agent output
    const parsed: Record<string, string> = {};
    for (const line of output.split("\n")) {
      const m = line.match(/^([A-Z_]+):\s*(.+)/);
      if (m) parsed[m[1]] = m[2].trim();
    }

    const files = parsed["FILES_CHANGED"] || parsed["CHANGES"] || "";
    const statusLabel = storyStatus === "skipped" ? "skipped" : storyStatus === "verified" ? "verified" : "done";
    const storyEntry = `### ${storyId}: ${storyTitle} [${statusLabel}]\n- Files: ${files || "(see PR)"}\n`;

    // Check if this story already exists in the memory
    const escapedId = storyId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const storyPattern = new RegExp(`### ${escapedId}:.*\\n(- .*\\n)*`, "g");
    if (storyPattern.test(content)) {
      // Update existing entry
      content = content.replace(storyPattern, storyEntry);
    } else {
      // Append to Completed Stories section
      if (content.includes("## Completed Stories")) {
        content = content.replace(
          /(## Completed Stories\n)/,
          `$1${storyEntry}\n`
        );
      } else {
        content += `\n## Completed Stories\n${storyEntry}\n`;
      }
    }

    // Trim to max lines
    const lines = content.split("\n");
    if (lines.length > PROJECT_MEMORY_MAX_LINES) {
      content = lines.slice(0, PROJECT_MEMORY_MAX_LINES).join("\n") + "\n";
    }

    fs.writeFileSync(memoryPath, content, "utf-8");
    logger.info(`Updated PROJECT_MEMORY.md for ${storyId} in ${repo}`);
  } catch (err) {
    logger.warn(`Failed to update PROJECT_MEMORY.md: ${err}`);
  }
}
