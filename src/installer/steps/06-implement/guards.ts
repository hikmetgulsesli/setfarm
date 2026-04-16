/**
 * 06-implement guards — scope enforcement, design compliance, test runner.
 *
 * Extracted from step-ops.ts completeStep loop block (lines 2537-2872).
 * Called from step-ops.ts during loop story completion.
 */
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execFileSync } from "node:child_process";
import { pgGet, pgQuery, pgRun } from "../../../db-pg.js";
import { logger } from "../../../lib/logger.js";
import type { ParsedOutput, ValidationResult } from "../types.js";

// ── Module interface methods ────────────────────────────────────

export function normalize(parsed: ParsedOutput): void {
  // Trim STATUS to first word (multi-line leak fix from Wave 13+)
  if (parsed["status"]) {
    const raw = parsed["status"].trim();
    parsed["status"] = (raw.indexOf("\n") >= 0 ? raw.slice(0, raw.indexOf("\n")).trim() : raw).split(/\s/)[0].toLowerCase();
  }
}

export function validateOutput(parsed: ParsedOutput): ValidationResult {
  const errors: string[] = [];
  const status = (parsed["status"] || "").toLowerCase();
  if (!status) errors.push("Missing STATUS field");
  if (status === "done" && !parsed["changes"] && !parsed["story_branch"]) {
    errors.push("STATUS: done requires CHANGES or STORY_BRANCH field");
  }
  return { ok: errors.length === 0, errors };
}

// ── Scope enforcement (called from step-ops loop completion) ────

export interface ScopeCheckResult {
  passed: boolean;
  reason?: string;
  category?: string;
  suggestion?: string;
}

/**
 * Check scope_files declaration against actual worktree files.
 * Returns failure if declared files are missing (>40% absent).
 */
export async function checkScopeFilesGate(
  storyId: string,
  currentStoryDbId: string,
  storyTitle: string,
  workdir: string,
): Promise<ScopeCheckResult> {
  const declRow = await pgGet<{ scope_files: string | null }>(
    "SELECT scope_files FROM stories WHERE id = $1",
    [currentStoryDbId]
  );
  if (!declRow?.scope_files) return { passed: true };

  let declared: string[] = [];
  try {
    const parsed = JSON.parse(declRow.scope_files || "[]");
    if (Array.isArray(parsed)) declared = parsed.filter((f: any) => typeof f === "string");
  } catch { declared = []; }
  if (declared.length === 0) return { passed: true };

  const missing: string[] = [];
  const present: string[] = [];
  for (const rel of declared) {
    const abs = path.join(workdir, rel);
    try {
      const st = fs.statSync(abs);
      if (st.isFile() && st.size > 0) present.push(rel); else missing.push(rel);
    } catch { missing.push(rel); }
  }
  const required = Math.ceil(declared.length * 0.6);
  if (present.length < required) {
    return {
      passed: false,
      reason: `SCOPE_FILE_MISSING: Story ${storyId} (${storyTitle}) declared scope_files=${JSON.stringify(declared)} but only ${present.length}/${declared.length} exist as non-empty files. Missing: ${missing.join(", ") || "none"}. You reported STATUS: done but the files you promised to write do not exist.`,
      category: "NO_WORK",
      suggestion: "Write the files listed in your scope_files declaration",
    };
  }
  return { passed: true };
}

/**
 * Check for zero-work (Bug D), stub commits, scope bleed, scope overflow.
 */
export async function checkScopeEnforcement(
  storyId: string,
  currentStoryDbId: string,
  storyTitle: string,
  workdir: string,
  baseBranch: string,
  retryCount: number,
  maxRetries: number,
): Promise<ScopeCheckResult> {
  if (!workdir || !baseBranch || !fs.existsSync(workdir)) return { passed: true };

  // Collect changed files (committed + uncommitted)
  let changedFiles: string[] = [];
  try {
    const diffOut = execFileSync("git", ["diff", "--name-only", `${baseBranch}...HEAD`], {
      cwd: workdir, timeout: 10000, stdio: ["pipe", "pipe", "pipe"], encoding: "utf-8",
    }).trim();
    changedFiles = diffOut ? diffOut.split("\n").filter(Boolean) : [];
  } catch { return { passed: true }; }

  let dirtyFiles: string[] = [];
  try {
    const statusOut = execFileSync("git", ["status", "--porcelain"], {
      cwd: workdir, timeout: 5000, stdio: ["pipe", "pipe", "pipe"], encoding: "utf-8",
    }).trim();
    dirtyFiles = statusOut ? statusOut.split("\n").map(l => l.slice(3).trim()).filter(Boolean) : [];
  } catch {}

  const allTouched = Array.from(new Set([...changedFiles, ...dirtyFiles]));
  const SCOPE_EXTS = /\.(tsx?|jsx?|vue|svelte|css|scss|html)$/i;
  const SCOPE_IGNORE = /^(node_modules\/|dist\/|\.next\/|build\/|coverage\/|stitch\/|references\/|DESIGN\.md|PROJECT_MEMORY\.md|\.gitignore|package(-lock)?\.json|tsconfig|vite\.config|tailwind\.config|postcss\.config|eslint\.config|README|index\.html$)/;
  const sourceFiles = allTouched.filter(f => SCOPE_EXTS.test(f) && !SCOPE_IGNORE.test(f));

  // Dependencies increase limits
  const depRow = await pgGet<{ depends_on: string | null }>("SELECT depends_on FROM stories WHERE id = $1", [currentStoryDbId]);
  const hasDeps = depRow?.depends_on && depRow.depends_on !== "[]" && depRow.depends_on !== "null";
  const HARD_LIMIT = hasDeps ? 30 : 12;
  const SOFT_LIMIT = hasDeps ? 20 : 8;

  // Zero-work floor
  if (sourceFiles.length === 0 && retryCount < maxRetries) {
    return {
      passed: false,
      reason: `NO WORK DETECTED: Story ${storyId} (${storyTitle}) reported STATUS: done but the worktree has ZERO source-file changes vs ${baseBranch}. The agent appears to have shortcut the task.`,
      category: "NO_WORK",
      suggestion: "Actually implement the story — write files and commit them",
    };
  }

  // Minimum insertion count (anti-stub)
  const MIN_INSERTS = 10;
  if (sourceFiles.length > 0 && retryCount < maxRetries) {
    let inserts = 0;
    try {
      const shortstat = execFileSync("git", ["diff", "--shortstat", `${baseBranch}...HEAD`, "--", ...sourceFiles], {
        cwd: workdir, timeout: 5000, stdio: "pipe",
      }).toString().trim();
      const mInserts = shortstat.match(/(\d+)\s+insertion/);
      inserts = mInserts ? parseInt(mInserts[1], 10) : 0;
    } catch {}
    if (inserts > 0 && inserts < MIN_INSERTS) {
      return {
        passed: false,
        reason: `INSUFFICIENT_WORK: Story ${storyId} (${storyTitle}) changed ${sourceFiles.length} source file(s) but only added ${inserts} line(s) — minimum is ${MIN_INSERTS}. This looks like a stub commit.`,
        category: "INSUFFICIENT_WORK",
        suggestion: "Write substantive code — stubs are rejected",
      };
    }
  }

  // Scope bleed detection
  if (sourceFiles.length > 0 && retryCount < maxRetries) {
    const scopeRow = await pgGet<{ scope_files: string | null; shared_files: string | null }>(
      "SELECT scope_files, shared_files FROM stories WHERE id = $1",
      [currentStoryDbId]
    );
    if (scopeRow?.scope_files) {
      const allowed = new Set<string>();
      try {
        const scope = JSON.parse(scopeRow.scope_files || "[]");
        const shared = JSON.parse(scopeRow.shared_files || "[]");
        if (Array.isArray(scope)) scope.forEach((f: any) => typeof f === "string" && allowed.add(f));
        if (Array.isArray(shared)) shared.forEach((f: any) => typeof f === "string" && allowed.add(f));
      } catch {}
      if (allowed.size > 0) {
        const IMPLICIT_SHARED = [
          /^src\/types(\.(tsx?|d\.ts))?$/,
          /^src\/types\/.*\.(tsx?|d\.ts)$/,
          /\.test\.(tsx?|jsx?)$/,
          /\.spec\.(tsx?|jsx?)$/,
          /^src\/setupTests\.(tsx?|js)$/,
          /\.d\.ts$/,
          /^vitest\.config\.(ts|js|mts|mjs)$/,
          /^jest\.config\.(ts|js|mts|mjs)$/,
          /^src\/test\/setup\.(ts|js)$/,
          /^src\/test\/utils\.(ts|js)$/,
        ];
        const isImplicitShared = (f: string) => IMPLICIT_SHARED.some(p => p.test(f));
        const outOfScope = sourceFiles.filter(f => !allowed.has(f) && !isImplicitShared(f));
        if (outOfScope.length > 0) {
          const allowedList = [...allowed].slice(0, 15).join(", ");
          const oosList = outOfScope.slice(0, 10).join(", ");
          return {
            passed: false,
            reason: `SCOPE_BLEED: Story ${storyId} (${storyTitle}) modified ${outOfScope.length} file(s) outside declared SCOPE_FILES. Out-of-scope: ${oosList}. Allowed: ${allowedList}. Each story must stay within its own file scope.`,
            category: "SCOPE_BLEED",
            suggestion: "Only modify files declared in your SCOPE_FILES",
          };
        }
      }
    }
  }

  // Hard overflow
  if (sourceFiles.length > HARD_LIMIT && retryCount < maxRetries) {
    return {
      passed: false,
      reason: `SCOPE OVERFLOW: Story ${storyId} (${storyTitle}) modified ${sourceFiles.length} source files — hard limit is ${HARD_LIMIT}. Files: ${sourceFiles.slice(0, 15).join(", ")}`,
      category: "SCOPE_OVERFLOW",
      suggestion: "Reset worktree and re-implement with only the files this story owns",
    };
  }

  // Soft warning (no failure)
  if (sourceFiles.length > SOFT_LIMIT) {
    logger.warn(`[scope-check] Story ${storyId} touched ${sourceFiles.length} files (soft limit ${SOFT_LIMIT})`, {});
  }

  return { passed: true, reason: sourceFiles.length > SOFT_LIMIT ? `Story ${storyId} touched ${sourceFiles.length} files — above typical scope` : undefined };
}

/**
 * Resolve worktree path for scope check (fixes parallel story context overwrite bug).
 */
export async function resolveStoryWorktree(currentStoryDbId: string, contextWorkdir: string): Promise<string> {
  const storyBranchRow = await pgGet<{ story_branch: string | null }>(
    "SELECT story_branch FROM stories WHERE id = $1", [currentStoryDbId]
  );
  const storyBranch = storyBranchRow?.story_branch || "";
  if (storyBranch) {
    const worktreeBase = path.join(os.homedir(), ".openclaw", "workspaces", "workflows", "feature-dev", "agents", "developer", "story-worktrees");
    const candidateWd = path.join(worktreeBase, storyBranch);
    if (fs.existsSync(candidateWd)) return candidateWd;
  }
  return contextWorkdir || "";
}
