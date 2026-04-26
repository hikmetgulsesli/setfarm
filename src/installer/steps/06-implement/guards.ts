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
  outOfScope?: string[];
}

const SCOPE_EXTS = /\.(tsx?|jsx?|vue|svelte|css|scss|html)$/i;
const SCOPE_IGNORE = /^(node_modules\/|dist\/|\.next\/|build\/|coverage\/|stitch\/|references\/|DESIGN\.md|PROJECT_MEMORY\.md|\.gitignore|package(-lock)?\.json|tsconfig|vite\.config|tailwind\.config|postcss\.config|eslint\.config|README|index\.html$)/;

function parseScopeFiles(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.filter((f: any) => typeof f === "string");
  } catch {}
  return [];
}

export function computeScopeFileLimits(hasDeps: boolean, declaredScopeFiles: string[]): { hardLimit: number; softLimit: number } {
  const baseHardLimit = hasDeps ? 30 : 12;
  const baseSoftLimit = hasDeps ? 20 : 8;
  const ceiling = hasDeps ? 50 : 30;
  const declaredSourceCount = declaredScopeFiles.filter(f => SCOPE_EXTS.test(f) && !SCOPE_IGNORE.test(f)).length;
  const dynamicHardLimit = declaredSourceCount > 0 ? Math.min(ceiling, declaredSourceCount + 6) : baseHardLimit;
  const hardLimit = Math.max(baseHardLimit, dynamicHardLimit);
  const softLimit = Math.max(baseSoftLimit, Math.ceil(hardLimit * 0.7));
  return { hardLimit, softLimit };
}

export function detectPackageBuildCommand(workdir: string): string[] | null {
  try {
    const pkgPath = path.join(workdir, "package.json");
    if (!fs.existsSync(pkgPath)) return null;
    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
    if (pkg?.scripts?.build) return ["npm", "run", "build"];
  } catch {}
  return null;
}

function summarizeBuildFailure(err: any): string {
  const raw = `${err?.stdout || ""}\n${err?.stderr || ""}\n${err?.message || ""}`;
  return raw
    .split("\n")
    .map((line: string) => line.trimEnd())
    .filter(Boolean)
    .slice(-40)
    .join("\n")
    .slice(0, 3000);
}

export function checkBuildGate(
  storyId: string,
  storyTitle: string,
  workdir: string,
  retryCount: number,
  maxRetries: number,
): ScopeCheckResult {
  if (!workdir || retryCount >= maxRetries) return { passed: true };
  const cmd = detectPackageBuildCommand(workdir);
  if (!cmd) return { passed: true };

  try {
    execFileSync(cmd[0], cmd.slice(1), {
      cwd: workdir,
      timeout: 120000,
      stdio: ["pipe", "pipe", "pipe"],
      encoding: "utf-8",
      env: { ...process.env, CI: "true" },
    });
    return { passed: true };
  } catch (err: any) {
    const summary = summarizeBuildFailure(err);
    return {
      passed: false,
      reason: `BUILD_FAILED: Story ${storyId} (${storyTitle}) reported STATUS: done but npm run build failed.\n${summary}`,
      category: "BUILD_FAILED",
      suggestion: "Fix TypeScript/build errors in the story worktree, then run npm run build before completing",
    };
  }
}

/**
 * Check scope_files declaration against actual worktree files.
 * scope_files is an ownership boundary, not a promise that every listed file
 * must be created. Fail only when too little of the declared scope exists,
 * which catches no-work/hallucinated-output without forcing optional sibling
 * CSS or test helper files into every story.
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
  const required = Math.max(1, Math.ceil(declared.length * 0.5));
  if (present.length < required) {
    return {
      passed: false,
      reason: `SCOPE_FILE_MISSING: Story ${storyId} (${storyTitle}) declared scope_files=${JSON.stringify(declared)} but only ${present.length}/${declared.length} exist as non-empty files (required at least ${required}). Missing: ${missing.join(", ") || "none"}. You reported STATUS: done but too little of the owned scope exists.`,
      category: "NO_WORK",
      suggestion: "Write meaningful code in at least the primary files listed in scope_files",
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
  const sourceFiles = allTouched.filter(f => SCOPE_EXTS.test(f) && !SCOPE_IGNORE.test(f));

  // Dependencies increase limits
  const depRow = await pgGet<{ depends_on: string | null }>("SELECT depends_on FROM stories WHERE id = $1", [currentStoryDbId]);
  const hasDeps = depRow?.depends_on && depRow.depends_on !== "[]" && depRow.depends_on !== "null";
  const scopeRow = await pgGet<{ scope_files: string | null }>(
    "SELECT scope_files FROM stories WHERE id = $1",
    [currentStoryDbId]
  );
  const declaredScopeFiles = parseScopeFiles(scopeRow?.scope_files);
  const { hardLimit: HARD_LIMIT, softLimit: SOFT_LIMIT } = computeScopeFileLimits(!!hasDeps, declaredScopeFiles);

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
    if (declaredScopeFiles.length > 0) {
      const allowed = new Set<string>();
      declaredScopeFiles.forEach(f => allowed.add(f));
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
            reason: `SCOPE_BLEED: Story ${storyId} modified ${outOfScope.length} file(s) outside its SCOPE_FILES list. Re-read your SCOPE_FILES in the claim input and modify ONLY those files. Revert all other changes. Integration files (App.tsx, main.tsx, routing) belong to the integration story, not yours.`,
            category: "SCOPE_BLEED",
            suggestion: "Only modify files declared in your SCOPE_FILES",
            outOfScope,
          };
        }
      }
    }
  }

  // Regression guard: implementation stories may add or adjust tests, but they
  // must not delete a large chunk of prior tests just to make a new story pass.
  // This catches the common App.tsx integration failure mode where the agent
  // removes accepted search/form/card tests while adding unrelated UI.
  const testFiles = sourceFiles.filter(f => /\.(test|spec)\.(tsx?|jsx?)$/i.test(f));
  if (testFiles.length > 0 && retryCount < maxRetries) {
    let storyText = storyTitle;
    try {
      const storyRow = await pgGet<{ description: string | null; acceptance_criteria: string | null }>(
        "SELECT description, acceptance_criteria FROM stories WHERE id = $1",
        [currentStoryDbId]
      );
      storyText += "\n" + (storyRow?.description || "") + "\n" + (storyRow?.acceptance_criteria || "");
    } catch {}

    const explicitDeletionStory = /\b(remove|delete|drop|cleanup|replace|rewrite|migrate|rename|sil|kaldir|temizle)\b/i.test(storyText);
    if (!explicitDeletionStory) {
      const heavyDeletes: string[] = [];
      try {
        const numstat = execFileSync("git", ["diff", "--numstat", baseBranch, "--", ...testFiles], {
          cwd: workdir, timeout: 5000, stdio: ["pipe", "pipe", "pipe"], encoding: "utf-8",
        }).trim();
        for (const line of numstat.split("\n").filter(Boolean)) {
          const [addedRaw, deletedRaw, file] = line.split("\t");
          const added = Number.parseInt(addedRaw || "0", 10) || 0;
          const deleted = Number.parseInt(deletedRaw || "0", 10) || 0;
          if (deleted >= 20 && deleted > Math.max(added * 2, added + 10)) {
            heavyDeletes.push(`${file}: -${deleted}/+${added}`);
          }
        }
      } catch {}
      if (heavyDeletes.length > 0) {
        return {
          passed: false,
          reason: `REGRESSION_RISK: Story ${storyId} deleted substantial existing test coverage without an explicit deletion/migration requirement. Deleted tests usually represent accepted previous-story behavior. Files: ${heavyDeletes.slice(0, 8).join(", ")}`,
          category: "REGRESSION_RISK",
          suggestion: "Restore prior tests and make the new implementation pass them; only change tests for this story's new acceptance criteria",
        };
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
