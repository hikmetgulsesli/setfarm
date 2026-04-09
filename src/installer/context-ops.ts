/**
 * Context Operations
 *
 * Extracted from step-ops.ts — template resolution, output parsing, progress/memory files.
 */

import fs from "node:fs";
import { execFileSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { pgGet, pgQuery } from "../db-pg.js";
import { logger } from "../lib/logger.js";
import { OPTIONAL_TEMPLATE_VARS, PROTECTED_CONTEXT_KEYS, PROJECT_MEMORY_MAX_LINES, STEP_CONTEXT_ALLOWLIST, PROTECTED_OUTBOUND_KEYS } from "./constants.js";
import { getAgentWorkspacePath } from "./worktree-ops.js";

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
  // Work on a shallow copy to avoid mutating the input context
  const ctx = { ...context };
  // Auto-resolve prd from prd_path if prd is missing but prd_path exists
  if (!ctx["prd"] && ctx["prd_path"]) {
    try {
      const prdPath = ctx["prd_path"];
      if (fs.existsSync(prdPath)) {
        ctx["prd"] = fs.readFileSync(prdPath, "utf-8");
      }
    } catch {}
  }
  // Supports {{key}}, {{key|default_value}}, and {{key.sub}}
  return template.replace(/\{\{(\w+(?:\.\w+)*)(?:\|([^}]*))?\}\}/g, (_match, key: string, defaultVal?: string) => {
    if (key in ctx) return ctx[key];
    const lower = key.toLowerCase();
    if (lower in ctx) return ctx[lower];
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

/**
 * Wave 14 Bug K: prune context before template resolution.
 *
 * Wave 14.1 HOTFIX (run #348 postmortem): the original implementation used a
 * per-step allowlist from constants.STEP_CONTEXT_ALLOWLIST. Trouble is I did
 * NOT audit each step's real input_template to verify every required variable
 * was in the allowlist. setup-repo needs story_workdir + screen_map and both
 * were missing — MISSING_INPUT_GUARD tripped, retries exhausted, run failed,
 * cascade terminal fail. Every mid-complexity project run was broken by this.
 *
 * Revised behaviour: only strip PROTECTED_OUTBOUND_KEYS (DB credentials, API
 * keys). This preserves the Wave 14 security fix (no more db_password leaking
 * into verify/security-gate/qa-test agent prompts) but gives up the token-
 * economy/bloat-trim payoff until the allowlist can be properly audited
 * against every step template in a later wave.
 *
 * STEP_CONTEXT_ALLOWLIST is kept in constants.ts as a reference for future
 * reactivation once each step's template variables have been catalogued.
 *
 * Pruning is claim-scope only — runs.context in DB is untouched. Only the
 * agent prompt is trimmed.
 *
 * @param context the run context map
 * @param _stepId kept in signature for future per-step behaviour; ignored by
 *                the Wave 14.1 PROTECTED-only implementation
 */
export function pruneContextForStep(
  context: Record<string, string>,
  _stepId: string,
): Record<string, string> {
  // Touch the unused parameter to satisfy strict lint without changing callers.
  void _stepId;
  // Touch the allowlist import so TypeScript does not complain that it is unused
  // while still keeping the export in constants.ts available for the future
  // allowlist-based pruning implementation.
  void STEP_CONTEXT_ALLOWLIST;
  const pruned: Record<string, string> = {};
  for (const [key, value] of Object.entries(context)) {
    if (PROTECTED_OUTBOUND_KEYS.has(key) || PROTECTED_OUTBOUND_KEYS.has(key.toLowerCase())) {
      continue;
    }
    pruned[key] = value;
  }
  return pruned;
}

// ── Progress File ───────────────────────────────────────────────────

/**
 * Read progress.txt from the loop step's agent workspace.
 */
export async function readProgressFile(runId: string): Promise<string> {
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

// ── Smart Context Injection ─────────────────────────────────────────

/**
 * Layer 1: Project file tree (src/ or app/, max 100 lines).
 * Lets the agent know which files already exist — prevents recreating them.
 */
export function getProjectTree(workdir: string): string {
  try {
    const srcDir = path.join(workdir, "src");
    const appDir = path.join(workdir, "app");
    const targetDir = fs.existsSync(srcDir) ? srcDir : fs.existsSync(appDir) ? appDir : "";
    if (!targetDir) return "";
    const tree = execFileSync("find", [targetDir, "-type", "f",
      "-not", "-path", "*/node_modules/*",
      "-not", "-path", "*/.git/*",
      "-not", "-path", "*/stitch/*",
    ], { encoding: "utf-8", timeout: 5000 });
    return tree.trim().split("\n")
      .map(f => f.replace(workdir + "/", ""))
      .slice(0, 100)
      .join("\n");
  } catch { return ""; }
}

/**
 * Layer 2: Installed packages from package.json dependencies.
 * Prevents unnecessary npm install and module-not-found errors.
 */
export function getInstalledPackages(workdir: string): string {
  const pkgPath = path.join(workdir, "package.json");
  if (!fs.existsSync(pkgPath)) return "";
  try {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    return Object.entries(deps)
      .map(([name, ver]) => `${name}: ${ver}`)
      .join("\n");
  } catch { return ""; }
}

/**
 * Layer 3: Shared code — types, utils, config, entry points.
 * Agent sees type definitions and utility functions to import, not recreate.
 */
export function getSharedCode(workdir: string): string {
  const patterns = [
    "types.ts", "types.tsx", "interfaces.ts", "interfaces.tsx",
    "constants.ts", "constants.tsx", "config.ts", "config.tsx",
    "utils.ts", "utils.tsx", "lib/index.ts", "lib/index.tsx",
    "App.tsx", "App.jsx", "app/layout.tsx", "app/layout.jsx",
    "routes.tsx", "routes.jsx", "router.tsx", "router.jsx",
    "main.tsx", "main.jsx", "main.ts", "index.tsx", "index.jsx", "index.ts",
  ];

  let result = "";
  for (const pattern of patterns) {
    try {
      const searchPaths = [`*/src/${pattern}`];
      if (pattern.startsWith("app/")) searchPaths.push(`*/${pattern}`);
      for (const sp of searchPaths) {
        const found = execFileSync("find", [
          workdir, "-path", sp,
          "-not", "-path", "*/node_modules/*",
          "-not", "-path", "*/.git/*",
        ], { encoding: "utf-8", timeout: 3000 });
        const files = found.trim().split("\n").filter(Boolean).slice(0, 4);
        for (const f of files) {
          try {
            const code = fs.readFileSync(f, "utf-8");
            const truncated = code.length > 3000
              ? code.slice(0, 3000) + "\n// ...truncated"
              : code;
            result += `\n// === ${f.replace(workdir + "/", "")} ===\n${truncated}\n`;
          } catch { /* file read failed */ }
        }
      }
    } catch { /* find failed */ }
  }
  return result.slice(0, 40000); // Max ~10K token
}

/**
 * Layer 4: Code from recently completed stories in the same run.
 * Agent sees what patterns/components previous stories created.
 */
export async function getRecentStoryCode(
  runId: string, repoPath: string, currentStoryId: string
): Promise<string> {
  let stories: { story_id: string; story_branch: string; title: string }[];
  try {
    stories = await pgQuery<{ story_id: string; story_branch: string; title: string }>(
      `SELECT story_id, story_branch, title FROM stories
       WHERE run_id = $1 AND status IN ('done','verified') AND story_id != $2
       ORDER BY updated_at DESC LIMIT 3`, [runId, currentStoryId]);
  } catch { return ""; }

  let content = "";
  for (const s of stories) {
    if (!s.story_branch) continue;
    try {
      // Verify branch exists locally
      execFileSync("git", ["rev-parse", "--verify", s.story_branch],
        { cwd: repoPath, encoding: "utf-8", timeout: 5000, stdio: ["pipe", "pipe", "pipe"] });

      const changedFiles = execFileSync("git", [
        "diff", "--name-only", `main...${s.story_branch}`, "--", "src/", "app/"
      ], { cwd: repoPath, encoding: "utf-8", timeout: 5000, stdio: ["pipe", "pipe", "pipe"] })
        .trim().split("\n").filter(Boolean).slice(0, 5);

      let storyCode = `\n// ─── ${s.story_id}: ${s.title} ───\n`;
      for (const f of changedFiles) {
        try {
          const code = execFileSync("git", ["show", `${s.story_branch}:${f}`],
            { cwd: repoPath, encoding: "utf-8", timeout: 5000, stdio: ["pipe", "pipe", "pipe"] });
          const truncated = code.length > 3000
            ? code.slice(0, 3000) + "\n// ...truncated"
            : code;
          storyCode += `// --- ${f} ---\n${truncated}\n`;
        } catch { /* file not in branch */ }
      }
      content += storyCode;
    } catch { /* branch not found */ }
  }
  return content.slice(0, 60000); // Max ~15K token
}

/**
 * Layer 5: Component registry — export statements from all components.
 * Agent knows which components exist and can import them correctly.
 */
export function getComponentRegistry(workdir: string): string {
  try {
    const result = execFileSync("grep", [
      "-rl", "^export", path.join(workdir, "src"),
      "--include=*.tsx", "--include=*.jsx", "--include=*.ts",
    ], { encoding: "utf-8", timeout: 5000, stdio: ["pipe", "pipe", "pipe"] });

    const files = result.trim().split("\n").filter(Boolean).slice(0, 30);
    let registry = "";
    for (const f of files) {
      try {
        const exports = execFileSync("grep", ["-n", "^export", f],
          { encoding: "utf-8", timeout: 2000, stdio: ["pipe", "pipe", "pipe"] })
          .trim().split("\n").slice(0, 5).join("\n");
        registry += `${f.replace(workdir + "/", "")}:\n${exports}\n\n`;
      } catch { /* no exports */ }
    }
    return registry.slice(0, 12000); // Max ~3K token
  } catch { return ""; }
}

/**
 * Layer 6: API route definitions from backend code.
 * Frontend agent knows which endpoints exist and their methods.
 */
export function getApiRoutes(workdir: string): string {
  try {
    const result = execFileSync("grep", [
      "-rn", "-E",
      "router\\.(get|post|put|delete|patch)\\(|app\\.(get|post|put|delete)\\(",
      path.join(workdir, "src"),
      "--include=*.ts", "--include=*.tsx", "--include=*.js", "--include=*.py",
    ], { encoding: "utf-8", timeout: 5000, stdio: ["pipe", "pipe", "pipe"] });
    return result.slice(0, 8000); // Max ~2K token
  } catch { return ""; }
}
