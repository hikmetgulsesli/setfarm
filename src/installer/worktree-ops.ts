/**
 * Git Worktree Operations
 *
 * Extracted from step-ops.ts — manages parallel story isolation via git worktrees.
 * Each story gets its own branch + working directory for conflict-free development.
 */

import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execFileSync } from "node:child_process";
import { pgGet } from "../db-pg.js";
import { logger } from "../lib/logger.js";

// ── Worktree Base Dir Resolution ────────────────────────────────────

/**
 * Get the workspace path for an OpenClaw agent by its id.
 */
export function getAgentWorkspacePath(agentId: string): string | null {
  try {
    const configPath = path.join(os.homedir(), ".openclaw", "openclaw.json");
    const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
    const agent = config.agents?.list?.find((a: any) => a.id === agentId);
    return agent?.workspace ?? null;
  } catch {
    return null;
  }
}

/**
 * Resolve worktree base directory: use agent workspace if available (sandbox-safe),
 * otherwise fall back to repo/.worktrees/ (may fail sandbox checks).
 */
export function resolveWorktreeBaseDir(repo: string, agentId?: string): string {
  if (agentId) {
    const ws = getAgentWorkspacePath(agentId);
    if (ws) {
      const base = path.join(ws, "story-worktrees");
      fs.mkdirSync(base, { recursive: true });
      return base;
    }
  }
  const base = path.join(repo, ".worktrees");
  fs.mkdirSync(base, { recursive: true });
  return base;
}

function stashDirtyMainRepo(repo: string, storyId: string): void {
  try {
    const status = execFileSync("git", ["status", "--porcelain"], {
      cwd: repo,
      encoding: "utf-8",
      timeout: 5000,
      stdio: ["pipe", "pipe", "pipe"],
    }).trimEnd();
    if (!status.trim()) return;
    const relevantStatus = status
      .split(/\r?\n/)
      .filter(line => !isPlatformInternalStatusLine(line))
      .join("\n")
      .trim();
    if (!relevantStatus) return;

    const branch = execFileSync("git", ["branch", "--show-current"], {
      cwd: repo,
      encoding: "utf-8",
      timeout: 5000,
      stdio: ["pipe", "pipe", "pipe"],
    }).trim() || "unknown";
    const summary = relevantStatus.split(/\r?\n/).slice(0, 12).join("; ");
    const stashName = `setfarm-auto-stash before ${storyId} on ${branch} ${new Date().toISOString()}`;

    execFileSync("git", ["stash", "push", "-u", "-m", stashName], {
      cwd: repo,
      timeout: 20000,
      stdio: ["pipe", "pipe", "pipe"],
    });
    logger.warn(`[worktree] Main repo was dirty before story ${storyId}; stashed to isolate next story: ${summary}`, {});
  } catch (e) {
    logger.warn(`[worktree] Failed dirty-main isolation before ${storyId}: ${String(e).slice(0, 160)}`, {});
  }
}

function statusPathFromPorcelainLine(line: string): string {
  const raw = line.slice(3).trim().replace(/^"|"$/g, "");
  const renamed = raw.split(" -> ");
  return renamed[renamed.length - 1] || raw;
}

function isPlatformInternalStatusLine(line: string): boolean {
  const file = statusPathFromPorcelainLine(line);
  return file === "SUPERVISOR_MEMORY.md"
    || file === "PROJECT_MEMORY.md"
    || file === "CLAUDE.md"
    || file === ".worktrees"
    || file.startsWith(".worktrees/")
    || file === ".setfarm"
    || file.startsWith(".setfarm/")
    || file === ".setfarm-bin"
    || file.startsWith(".setfarm-bin/")
    || file === "node_modules"
    || file.startsWith("node_modules/")
    || file === "references"
    || file.startsWith("references/");
}

function porcelainStatusPaths(output: string): string[] {
  return output
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter(Boolean)
    .map(statusPathFromPorcelainLine)
    .filter(Boolean);
}

function safeRetryPatchId(value: string): string {
  return String(value || "unknown")
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120) || "unknown";
}

function retryPatchDir(repo: string): string {
  return path.join(repo, ".setfarm", "retry-patches");
}

function retryPatchTimestamp(): string {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function captureDirtyStoryWorktreePatch(repo: string, worktreeDir: string, storyId: string, status: string): string {
  try {
    // Include untracked files in the diff without staging their content.
    try {
      execFileSync("git", ["add", "-N", "--", "."], {
        cwd: worktreeDir,
        timeout: 10000,
        stdio: ["pipe", "pipe", "pipe"],
      });
    } catch {
      // Best effort: tracked-file diffs are still useful.
    }
    const patch = execFileSync("git", ["diff", "--binary", "--no-ext-diff", "HEAD", "--"], {
      cwd: worktreeDir,
      encoding: "utf-8",
      timeout: 20000,
      maxBuffer: 10 * 1024 * 1024,
      stdio: ["pipe", "pipe", "pipe"],
    });
    try {
      execFileSync("git", ["reset", "-q", "--", "."], {
        cwd: worktreeDir,
        timeout: 10000,
        stdio: ["pipe", "pipe", "pipe"],
      });
    } catch {
      // Leave normal cleanup/stash handling to the caller.
    }
    if (!patch.trim()) return "";

    const dir = retryPatchDir(repo);
    fs.mkdirSync(dir, { recursive: true });
    const id = safeRetryPatchId(storyId);
    const patchPath = path.join(dir, `${id}-${retryPatchTimestamp()}.patch`);
    const header = [
      `# setfarm.retry-worktree-patch.v1`,
      `# story_id=${storyId}`,
      `# worktree=${worktreeDir}`,
      `# captured_at=${new Date().toISOString()}`,
      `# status=${status.split(/\r?\n/).slice(0, 20).join(" | ")}`,
      "",
    ].join("\n");
    fs.writeFileSync(patchPath, header + patch);
    logger.warn(`[worktree] Captured dirty retry patch for ${storyId}: ${path.relative(repo, patchPath)}`, {});
    return patchPath;
  } catch (e) {
    logger.warn(`[worktree] Failed to capture dirty retry patch for ${storyId}: ${String(e).slice(0, 160)}`, {});
    return "";
  }
}

export function latestRetryPatchForStory(repo: string, storyId: string): string {
  try {
    const dir = retryPatchDir(repo);
    if (!fs.existsSync(dir)) return "";
    const id = safeRetryPatchId(storyId);
    const files = fs.readdirSync(dir)
      .filter((file) => file.endsWith(".patch") && (file.startsWith(`${id}-`) || file.includes(`-${id}-`)))
      .map((file) => path.join(dir, file))
      .filter((file) => {
        try { return fs.statSync(file).isFile(); } catch { return false; }
      })
      .sort((a, b) => {
        try { return fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs; } catch { return 0; }
      });
    return files[0] || "";
  } catch {
    return "";
  }
}

export function latestRetryStashPatchForStory(worktreeDir: string, storyId: string): string {
  if (!worktreeDir || !fs.existsSync(worktreeDir)) return "";
  try {
    const needle = `setfarm-auto-stash dirty story worktree before ${storyId}`.toLowerCase();
    const list = execFileSync("git", ["stash", "list", "--format=%gd%x00%s"], {
      cwd: worktreeDir,
      encoding: "utf-8",
      timeout: 5000,
      stdio: ["pipe", "pipe", "pipe"],
    });
    const ref = list.split(/\r?\n/)
      .map((line) => {
        const [stashRef, subject] = line.split("\0");
        return { stashRef, subject };
      })
      .find((item) => String(item.subject || "").toLowerCase().includes(needle))
      ?.stashRef;
    if (!ref) return "";
    return execFileSync("git", ["stash", "show", "--patch", "--binary", ref], {
      cwd: worktreeDir,
      encoding: "utf-8",
      timeout: 20000,
      maxBuffer: 10 * 1024 * 1024,
      stdio: ["pipe", "pipe", "pipe"],
    });
  } catch {
    return "";
  }
}

export interface RetryPatchRestoreResult {
  applied: boolean;
  reason: string;
  patchPath?: string;
  touchedFiles?: string[];
}

function stripRetryPatchHeader(patch: string): string {
  const index = patch.indexOf("diff --git ");
  return index >= 0 ? patch.slice(index) : patch;
}

export function retryPatchTouchedFiles(patch: string): string[] {
  const files = new Set<string>();
  for (const line of stripRetryPatchHeader(patch).split(/\r?\n/)) {
    let match = line.match(/^diff --git a\/(.+?) b\/(.+)$/);
    if (match) {
      const left = normalizePatchPath(match[1]);
      const right = normalizePatchPath(match[2]);
      if (left && left !== "/dev/null") files.add(left);
      if (right && right !== "/dev/null") files.add(right);
      continue;
    }
    match = line.match(/^(?:---|\+\+\+) (?:a|b)\/(.+)$/);
    if (match) {
      const file = normalizePatchPath(match[1]);
      if (file && file !== "/dev/null") files.add(file);
    }
  }
  return [...files].sort();
}

function normalizePatchPath(raw: string): string {
  const file = String(raw || "").trim().replace(/^"|"$/g, "").replace(/\\/g, "/").replace(/^\.\//, "");
  if (!file || file === "/dev/null") return file;
  if (file.startsWith("/") || file.includes("../") || file === "..") return "";
  return file;
}

function normalizeScopePath(raw: string): string {
  return normalizePatchPath(String(raw || "").trim());
}

function scopeAllowsRetryPatchPath(file: string, allowed: Set<string>): boolean {
  if (!file) return false;
  if (allowed.has(file)) return true;
  return allowed.has("*");
}

export function applyScopedRetryPatchForStory(repo: string, worktreeDir: string, storyId: string, scopeFiles: string[], runId = ""): RetryPatchRestoreResult {
  if (!repo || !worktreeDir || !storyId || !fs.existsSync(worktreeDir)) {
    return { applied: false, reason: "missing_inputs" };
  }
  const patchPath = latestRetryPatchForStory(repo, storyId);
  if (!patchPath) return { applied: false, reason: "no_retry_patch" };

  let patch = "";
  try {
    patch = fs.readFileSync(patchPath, "utf-8");
  } catch {
    return { applied: false, reason: "patch_read_failed", patchPath };
  }
  const patchBody = stripRetryPatchHeader(patch);
  if (!patchBody.trim()) return { applied: false, reason: "empty_patch", patchPath };

  const touchedFiles = retryPatchTouchedFiles(patchBody);
  if (touchedFiles.length === 0) return { applied: false, reason: "no_touched_files", patchPath };

  const allowed = new Set(scopeFiles.map(normalizeScopePath).filter(Boolean));
  const outOfScope = touchedFiles.filter((file) => !scopeAllowsRetryPatchPath(file, allowed));
  if (outOfScope.length > 0) {
    logger.warn(`[worktree] Retry patch for ${storyId} not restored; out-of-scope files: ${outOfScope.slice(0, 12).join(", ")}`, { runId });
    return { applied: false, reason: "out_of_scope", patchPath, touchedFiles };
  }

  try {
    const status = execFileSync("git", ["status", "--porcelain"], {
      cwd: worktreeDir,
      encoding: "utf-8",
      timeout: 5000,
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();
    if (status) return { applied: false, reason: "worktree_not_clean", patchPath, touchedFiles };
  } catch {
    return { applied: false, reason: "status_failed", patchPath, touchedFiles };
  }

  try {
    execFileSync("git", ["apply", "--3way", "--whitespace=nowarn"], {
      cwd: worktreeDir,
      input: patchBody,
      encoding: "utf-8",
      timeout: 20000,
      maxBuffer: 10 * 1024 * 1024,
      stdio: ["pipe", "pipe", "pipe"],
    });
    logger.warn(`[worktree] Restored scoped retry patch for ${storyId}: ${touchedFiles.slice(0, 12).join(", ")}`, { runId });
    return { applied: true, reason: "applied", patchPath, touchedFiles };
  } catch (e) {
    logger.warn(`[worktree] Failed to restore retry patch for ${storyId}: ${String(e).slice(0, 160)}`, { runId });
    return { applied: false, reason: "apply_failed", patchPath, touchedFiles };
  }
}

/**
 * Guard retries must not inherit dirty files from the failed attempt. The
 * retry output is the artifact; the next worker should start from the committed
 * story branch plus that feedback, not from an unreviewed working tree.
 */
export function discardDirtyRetryWorktreeState(worktreeDir: string, storyId: string, runId = ""): string[] {
  if (!worktreeDir || !fs.existsSync(worktreeDir)) return [];
  const gitPath = path.join(worktreeDir, ".git");
  if (!fs.existsSync(gitPath)) return [];

  let status = "";
  try {
    clearUnexpectedWorktreeIndexFlags(worktreeDir);
    status = execFileSync("git", ["status", "--porcelain"], {
      cwd: worktreeDir,
      encoding: "utf-8",
      timeout: 5000,
      stdio: ["pipe", "pipe", "pipe"],
    }).trimEnd();
  } catch (e) {
    logger.warn(`[worktree] Could not inspect retry worktree ${storyId}: ${String(e).slice(0, 140)}`, { runId });
    return [];
  }
  if (!status) return [];

  const dirtyFiles = porcelainStatusPaths(status).filter((file) => !isPlatformInternalStatusLine(`?? ${file}`));
  if (dirtyFiles.length === 0) return [];

  try {
    execFileSync("git", ["reset", "--hard", "HEAD"], {
      cwd: worktreeDir,
      timeout: 10000,
      stdio: ["pipe", "pipe", "pipe"],
    });
    execFileSync("git", ["clean", "-fd"], {
      cwd: worktreeDir,
      timeout: 10000,
      stdio: ["pipe", "pipe", "pipe"],
    });
    logger.warn(`[worktree] Discarded dirty retry state for ${storyId} before claim: ${dirtyFiles.slice(0, 12).join(", ")}`, { runId });
    return dirtyFiles;
  } catch (e) {
    logger.warn(`[worktree] Failed to discard dirty retry state for ${storyId}: ${String(e).slice(0, 160)}`, { runId });
    return [];
  }
}

function sameFilesystemPath(a: string, b: string): boolean {
  try {
    return fs.realpathSync.native(a) === fs.realpathSync.native(b);
  } catch {
    return path.resolve(a) === path.resolve(b);
  }
}

function isManagedWorktreePath(candidate: string): boolean {
  const normalized = path.resolve(candidate);
  return normalized.includes(`${path.sep}story-worktrees${path.sep}`) || normalized.includes(`${path.sep}.worktrees${path.sep}`);
}

export function releaseManagedStoryBranchOccupancy(repo: string, storyBranch: string, exceptPath = ""): boolean {
  const branch = safeManagedStoryBranch(storyBranch);
  if (!repo || !branch) return true;

  let output = "";
  try {
    output = execFileSync("git", ["worktree", "list", "--porcelain"], {
      cwd: repo,
      encoding: "utf-8",
      timeout: 5000,
      stdio: ["pipe", "pipe", "pipe"],
    });
  } catch {
    return true;
  }

  const exceptResolved = exceptPath ? path.resolve(exceptPath) : "";
  let currentPath = "";
  let released = true;
  const releaseCurrent = () => {
    if (!currentPath || !fs.existsSync(currentPath)) return;
    const resolved = path.resolve(currentPath);
    if (exceptResolved && resolved === exceptResolved) return;
    if (!isManagedWorktreePath(resolved)) {
      logger.warn(`[worktree] Refusing to release non-managed worktree holding ${branch}: ${resolved}`, {});
      released = false;
      return;
    }
    try { fs.unlinkSync(path.join(resolved, "node_modules")); } catch {}
    try {
      execFileSync("git", ["worktree", "remove", resolved, "--force"], {
        cwd: repo,
        timeout: 15000,
        stdio: ["pipe", "pipe", "pipe"],
      });
      logger.warn(`[worktree] Released stale managed worktree holding ${branch}: ${resolved}`, {});
    } catch (removeErr) {
      try { fs.rmSync(resolved, { recursive: true, force: true }); } catch {}
      logger.warn(`[worktree] Force-removed stale managed worktree holding ${branch}: ${String(removeErr).slice(0, 150)}`, {});
    }
  };

  for (const line of output.split(/\r?\n/)) {
    if (line.startsWith("worktree ")) {
      currentPath = line.slice("worktree ".length).trim();
    } else if (line === `branch refs/heads/${branch}`) {
      releaseCurrent();
    }
  }

  try { execFileSync("git", ["worktree", "prune"], { cwd: repo, timeout: 5000, stdio: ["pipe", "pipe", "pipe"] }); } catch {}
  return released;
}

function checkoutRefInMainWorktree(repo: string, ref: string, reason: string): boolean {
  if (!ref) return false;
  const refIsSha = /^[0-9a-f]{40}$/i.test(ref);
  try {
    if (refIsSha) {
      execFileSync("git", ["checkout", "--detach", ref], {
        cwd: repo, timeout: 15000, stdio: "pipe",
      });
      logger.warn(`[worktree] Detached main worktree at ${ref.slice(0, 8)} to ${reason}`, {});
      return true;
    }

    execFileSync("git", ["checkout", ref], {
      cwd: repo, timeout: 15000, stdio: "pipe",
    });
    logger.info(`[worktree] Checked out ${ref} in main worktree to ${reason}`, {});
    return true;
  } catch (checkoutErr) {
    try {
      const fallbackRef = refIsSha ? ref : `origin/${ref}`;
      const resolved = execFileSync("git", ["rev-parse", fallbackRef], {
        cwd: repo, timeout: 5000, stdio: "pipe",
      }).toString().trim();
      execFileSync("git", ["checkout", "--detach", resolved], {
        cwd: repo, timeout: 15000, stdio: "pipe",
      });
      logger.warn(`[worktree] Could not checkout ${ref}; detached main worktree at ${resolved.slice(0, 8)} to ${reason}`, {});
      return true;
    } catch (detachErr) {
      logger.warn(`[worktree] Could not move main worktree to ${ref} for ${reason}: ${String(checkoutErr).slice(0, 120)}; detach failed: ${String(detachErr).slice(0, 120)}`, {});
      return false;
    }
  }
}

function releaseMainWorktreeBranch(repo: string, branchName: string, fallbackRef: string): boolean {
  if (!branchName) return true;
  let current = "";
  try {
    current = execFileSync("git", ["branch", "--show-current"], {
      cwd: repo, timeout: 5000, stdio: "pipe",
    }).toString().trim();
  } catch {}
  if (current.toLowerCase() !== branchName.toLowerCase()) return true;

  try { stashDirtyMainRepo(repo, `release-${branchName}`); } catch {}
  logger.warn(`[worktree] Main repo is currently on story branch ${branchName}; moving away before creating isolated worktree`, {});
  return checkoutRefInMainWorktree(repo, fallbackRef, `release story branch ${branchName}`);
}

/**
 * Bring a local base branch up to date with origin before creating the next
 * story worktree or after a PR merge. This keeps the project repo's local main
 * aligned with the branch future stories will use as their parent.
 */
export function syncBaseBranch(repo: string, baseBranch = "main"): boolean {
  if (!repo || !baseBranch || /^[0-9a-f]{40}$/i.test(baseBranch)) return true;
  if (baseBranch === "main") {
    try {
      const authoritative = execFileSync("git", ["config", "--bool", "--get", "setfarm.localMainAuthoritative"], {
        cwd: repo, timeout: 5000, stdio: "pipe",
      }).toString().trim();
      if (authoritative === "true") {
        execFileSync("git", ["show-ref", "--verify", "--quiet", "refs/heads/main"], {
          cwd: repo, timeout: 5000, stdio: "pipe",
        });
        try {
          execFileSync("git", ["fetch", "origin", "main"], {
            cwd: repo, timeout: 15000, stdio: "pipe",
          });
          execFileSync("git", ["merge-base", "--is-ancestor", "main", "origin/main"], {
            cwd: repo, timeout: 5000, stdio: "pipe",
          });
          try {
            execFileSync("git", ["config", "--unset", "setfarm.localMainAuthoritative"], {
              cwd: repo, timeout: 5000, stdio: "pipe",
            });
          } catch {}
          logger.info(`[worktree] origin/main contains local setup baseline; returning to normal main sync`, {});
        } catch {
          logger.warn(`[worktree] Using local main as authoritative setup baseline; origin/main has not caught up`, {});
          return true;
        }
      }
    } catch {}
  }
  try { stashDirtyMainRepo(repo, `sync-${baseBranch}`); } catch {}

  try {
    execFileSync("git", ["fetch", "origin", baseBranch], {
      cwd: repo, timeout: 15000, stdio: "pipe",
    });
  } catch (fetchErr) {
    logger.warn(`[worktree] Could not fetch origin/${baseBranch}: ${String(fetchErr).slice(0, 150)}`, {});
    return false;
  }

  let current = "";
  try {
    current = execFileSync("git", ["rev-parse", "--abbrev-ref", "HEAD"], {
      cwd: repo, timeout: 5000, stdio: "pipe",
    }).toString().trim();
  } catch {}

  try {
    if (current === baseBranch) {
      let localOnly = 0;
      let originOnly = 0;
      try {
        const counts = execFileSync("git", ["rev-list", "--left-right", "--count", `origin/${baseBranch}...${baseBranch}`], {
          cwd: repo, timeout: 5000, stdio: "pipe",
        }).toString().trim().split(/\s+/);
        originOnly = parseInt(counts[0] || "0", 10) || 0;
        localOnly = parseInt(counts[1] || "0", 10) || 0;
      } catch {}
      if (localOnly > 0) {
        execFileSync("git", ["reset", "--hard", `origin/${baseBranch}`], {
          cwd: repo, timeout: 15000, stdio: "pipe",
        });
        logger.warn(`[worktree] Hard-synced ${baseBranch} to origin/${baseBranch}; dropped ${localOnly} local-only commit(s) from managed base`, {});
      } else {
        execFileSync("git", ["pull", "origin", baseBranch, "--ff-only"], {
          cwd: repo, timeout: 15000, stdio: "pipe",
        });
        logger.info(`[worktree] Pulled ${baseBranch} (ff-only) in main worktree`, {});
      }
      if (originOnly > 0) {
        logger.info(`[worktree] ${baseBranch} received ${originOnly} origin commit(s) during sync`, {});
      }
    } else {
      execFileSync("git", ["branch", "-f", baseBranch, `origin/${baseBranch}`], {
        cwd: repo, timeout: 5000, stdio: "pipe",
      });
      checkoutRefInMainWorktree(repo, baseBranch, `sync ${baseBranch}`);
      logger.info(`[worktree] Synced ${baseBranch} to origin/${baseBranch}`, {});
    }
    return true;
  } catch (syncErr) {
    logger.warn(`[worktree] Could not sync ${baseBranch} to origin/${baseBranch}: ${String(syncErr).slice(0, 150)}`, {});
    return false;
  }
}

// ── Stitch Asset Copy ───────────────────────────────────────────────

type StoryWorktreeAssetMode = "full" | "implement";

const IMPLEMENT_REFERENCE_README = [
  "# Setfarm Implement Reference Policy",
  "",
  "Full reference manuals are intentionally not mounted in implement worktrees.",
  "Use the injected Design Rules, Stack Rules, UI Behavior Contract,",
  "Supervisor Memory, previous-failure feedback, and claim summary instead.",
  "",
  "If a missing rule is blocking implementation, report STATUS: fail/retry with",
  "the exact missing contract instead of loading broad reference context.",
  "",
].join("\n");

/** Copy stitch/ design assets from main repo into worktree so agents can reference them */
function ensureReferencesLink(repo: string, worktreeDir: string): void {
  const refsSrc = path.join(repo, "references");
  const refsDst = path.join(worktreeDir, "references");
  if (!fs.existsSync(refsSrc) || fs.existsSync(refsDst)) return;
  try {
    fs.symlinkSync(refsSrc, refsDst, "dir");
    logger.info(`[worktree] Linked references/ into worktree`, {});
  } catch (e) {
    logger.warn(`[worktree] Failed to link references/: ${String(e).slice(0, 100)}`, {});
  }
}

function gitTrackedPath(worktreeDir: string, relativePath: string): boolean {
  try {
    execFileSync("git", ["ls-files", "--error-unmatch", "--", relativePath], {
      cwd: worktreeDir,
      timeout: 5000,
      stdio: ["pipe", "pipe", "pipe"],
    });
    return true;
  } catch {
    return false;
  }
}

function hideTrackedPathForImplement(worktreeDir: string, relativePath: string): void {
  const abs = path.join(worktreeDir, relativePath);
  try {
    if (gitTrackedPath(worktreeDir, relativePath)) {
      execFileSync("git", ["update-index", "--skip-worktree", "--", relativePath], {
        cwd: worktreeDir,
        timeout: 5000,
        stdio: ["pipe", "pipe", "pipe"],
      });
    }
    if (fs.existsSync(abs)) fs.rmSync(abs, { recursive: true, force: true });
  } catch (e) {
    logger.warn(`[worktree] Failed to hide implement-only path ${relativePath}: ${String(e).slice(0, 120)}`, {});
  }
}

function isIntentionalHiddenWorktreePath(relativePath: string): boolean {
  const file = relativePath.replace(/\\/g, "/");
  return file === "references"
    || file.startsWith("references/")
    || file === "stitch"
    || file.startsWith("stitch/")
    || /^\.stitch-screens.*\.json$/i.test(file)
    || file === "node_modules"
    || file.startsWith("node_modules/")
    || file === ".setfarm"
    || file.startsWith(".setfarm/")
    || file === ".setfarm-bin"
    || file.startsWith(".setfarm-bin/");
}

function chunked<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
}

export function clearUnexpectedWorktreeIndexFlags(worktreeDir: string): string[] {
  if (!worktreeDir || !fs.existsSync(worktreeDir)) return [];

  let output = "";
  try {
    output = execFileSync("git", ["ls-files", "-v"], {
      cwd: worktreeDir,
      encoding: "utf-8",
      timeout: 10_000,
      stdio: ["pipe", "pipe", "pipe"],
    });
  } catch {
    return [];
  }

  const flagged = output
    .split(/\r?\n/)
    .map((line) => {
      const flag = line.slice(0, 1);
      const file = line.slice(2).trim();
      return { flag, file };
    })
    .filter(({ flag, file }) => {
      if (!flag || !file || isIntentionalHiddenWorktreePath(file)) return false;
      return flag === flag.toLowerCase() || flag === "S";
    })
    .map(({ file }) => file);

  if (flagged.length === 0) return [];

  for (const files of chunked(flagged, 80)) {
    try {
      execFileSync("git", ["update-index", "--no-assume-unchanged", "--no-skip-worktree", "--", ...files], {
        cwd: worktreeDir,
        timeout: 10_000,
        stdio: ["pipe", "pipe", "pipe"],
      });
    } catch {
      try {
        execFileSync("git", ["update-index", "--no-assume-unchanged", "--", ...files], {
          cwd: worktreeDir,
          timeout: 10_000,
          stdio: ["pipe", "pipe", "pipe"],
        });
      } catch (e) {
        logger.warn(`[worktree] Failed to clear hidden index flags in ${worktreeDir}: ${String(e).slice(0, 140)}`, {});
      }
    }
  }

  logger.warn(`[worktree] Cleared hidden git index flags for ${flagged.length} tracked file(s): ${flagged.slice(0, 8).join(", ")}`, {});
  return flagged;
}

function listStitchCorpusPaths(worktreeDir: string): string[] {
  const stitchDir = path.join(worktreeDir, "stitch");
  const paths: string[] = [];
  try {
    if (fs.existsSync(stitchDir)) {
      for (const entry of fs.readdirSync(stitchDir)) {
        const rel = path.join("stitch", entry).replace(/\\/g, "/");
        if (/\.html$/i.test(entry)
          || /\.png$/i.test(entry)
          || entry === "DESIGN_DOM.json"
          || entry === ".generate-prompt.txt"
          || /^\.stitch-screens.*\.json$/i.test(entry)) {
          paths.push(rel);
        }
      }
    }
    for (const entry of fs.readdirSync(worktreeDir)) {
      if (/^\.stitch-screens.*\.json$/i.test(entry)) paths.push(entry);
    }
  } catch {
    // Missing stitch assets are valid for non-UI projects.
  }
  return [...new Set(paths)];
}

function hardenImplementStoryAssets(worktreeDir: string): void {
  for (const rel of listStitchCorpusPaths(worktreeDir)) {
    hideTrackedPathForImplement(worktreeDir, rel);
  }

  hideTrackedPathForImplement(worktreeDir, "references");
  const refsDir = path.join(worktreeDir, "references");
  try {
    fs.mkdirSync(refsDir, { recursive: true });
    fs.writeFileSync(path.join(refsDir, "README.md"), IMPLEMENT_REFERENCE_README);
    fs.writeFileSync(path.join(refsDir, ".setfarm-reference-policy.md"), IMPLEMENT_REFERENCE_README);
    logger.info(`[worktree] Hardened implement assets in ${worktreeDir}`, {});
  } catch (e) {
    logger.warn(`[worktree] Failed to write implement reference policy: ${String(e).slice(0, 120)}`, {});
  }
}

export function copyStitchToWorktree(repo: string, worktreeDir: string): void {
  try {
    const stitchDst = path.join(worktreeDir, "stitch");
    if (fs.existsSync(stitchDst) && fs.readdirSync(stitchDst).some(f => f.endsWith(".html"))) {
      logger.info(`[worktree] stitch/ already present in worktree, skipping copy`, {});
      return;
    }

    // Source 1: repo working directory
    const stitchSrc = path.join(repo, "stitch");
    if (fs.existsSync(stitchSrc) && fs.readdirSync(stitchSrc).some(f => f.endsWith(".html"))) {
      fs.cpSync(stitchSrc, stitchDst, { recursive: true });
      logger.info(`[worktree] Copied stitch/ from repo working dir`, {});
      return;
    }

    // Source 2: git history — scaffold tools may have deleted stitch/ from working dir
    // Find the design commit that added stitch files and restore from there
    try {
      const { execFileSync } = require("child_process");
      // Find the commit that last had stitch/ files
      const commitHash = execFileSync("git", ["log", "--all", "--diff-filter=A", "--format=%H", "--", "stitch/"], { cwd: repo, timeout: 10000, stdio: "pipe" }).toString().trim().split("\n")[0];
      if (commitHash) {
        // List stitch files in that commit
        const files = execFileSync("git", ["ls-tree", "-r", "--name-only", commitHash, "stitch/"], { cwd: repo, timeout: 10000, stdio: "pipe" }).toString().trim().split("\n").filter(Boolean);
        if (files.length > 0) {
          fs.mkdirSync(stitchDst, { recursive: true });
          for (const file of files) {
            const destFile = path.join(worktreeDir, file);
            fs.mkdirSync(path.dirname(destFile), { recursive: true });
            const blob = execFileSync("git", ["show", `${commitHash}:${file}`], { cwd: repo, timeout: 10000, stdio: "pipe", maxBuffer: 10 * 1024 * 1024 });
            fs.writeFileSync(destFile, blob);
          }
          logger.info(`[worktree] Restored stitch/ from git history (commit ${commitHash.slice(0, 8)}), ${files.length} files`, {});
          return;
        }
      }
    } catch (gitErr: any) {
      logger.warn(`[worktree] git stitch restore failed: ${gitErr.message}`, {});
    }

    logger.warn(`[worktree] No stitch/ source found for worktree`, {});
  } catch (e: any) {
    logger.warn(`[worktree] copyStitchToWorktree failed: ${e.message}`, {});
  }
}

// ── Worktree CRUD ───────────────────────────────────────────────────

function installScopeHook(worktreeDir: string, storyId: string): void {
  // 5-model consensus: git pre-commit hook that blocks commits touching files
  // outside scope_files. The .story-scope-files file is written by step-ops.ts
  // at claim time with the story's writable scope + test/config exceptions.
  const hookScript = `#!/bin/bash
# Scope enforcement pre-commit hook (5-model consensus)
SCOPE_FILE=".story-scope-files"
BRANCH_FILE=".story-branch"
if [ -f "$BRANCH_FILE" ]; then
  EXPECTED_BRANCH="$(cat "$BRANCH_FILE" | tr -d '[:space:]')"
  ACTUAL_BRANCH="$(git branch --show-current)"
  if [ -n "$EXPECTED_BRANCH" ] && [ "$ACTUAL_BRANCH" != "$EXPECTED_BRANCH" ]; then
    echo ""
    echo "BRANCH_HOOK: Commit REJECTED — wrong branch"
    echo "Expected: $EXPECTED_BRANCH"
    echo "Actual:   $ACTUAL_BRANCH"
    echo "Fix: git checkout $EXPECTED_BRANCH"
    echo ""
    exit 1
  fi
fi
if [ ! -f "$SCOPE_FILE" ]; then exit 0; fi
BLOCKED=""
for file in $(git diff --cached --name-only); do
  case "$file" in
    *.test.ts|*.test.tsx|*.spec.ts|*.spec.tsx|src/test/*|src/setupTests.ts|vitest.config.ts|vitest.config.js|jest.config.ts|jest.config.js)
      continue
      ;;
    .story-scope-files|.story-branch|pre-commit|references|node_modules|.setfarm-bin)
      continue
      ;;
  esac
  if ! grep -qxF "$file" "$SCOPE_FILE"; then
    BLOCKED="$BLOCKED  BLOCKED: $file\n"
  fi
done
if [ -n "$BLOCKED" ]; then
  echo ""
  echo "SCOPE_HOOK: Commit REJECTED — files outside scope_files:"
  echo -e "$BLOCKED"
  echo "Allowed: $(cat $SCOPE_FILE | tr '\n' ', ')"
  echo "Fix: git reset HEAD <file> to unstage out-of-scope files"
  echo ""
  exit 1
fi
`;
  try {
    // Write hook to worktree root as pre-commit, set core.hooksPath
    const hookPath = path.join(worktreeDir, "pre-commit");
    fs.writeFileSync(path.join(worktreeDir, ".story-branch"), storyId.toLowerCase() + "\n");
    fs.writeFileSync(hookPath, hookScript, { mode: 0o755 });
    execFileSync("git", ["config", "core.hooksPath", worktreeDir], {
      cwd: worktreeDir, timeout: 5000, stdio: "pipe"
    });
    try {
      const excludePath = execFileSync("git", ["rev-parse", "--git-path", "info/exclude"], {
        cwd: worktreeDir, encoding: "utf-8", timeout: 5000, stdio: ["pipe", "pipe", "pipe"],
      }).trim();
      const ignoreLines = [".story-scope-files", ".story-branch", "pre-commit", "references", "node_modules", ".setfarm-bin"];
      let existing = "";
      try { existing = fs.existsSync(excludePath) ? fs.readFileSync(excludePath, "utf-8") : ""; } catch {}
      const missing = ignoreLines.filter(line => !existing.split(/\r?\n/).includes(line));
      if (missing.length > 0) {
        fs.mkdirSync(path.dirname(excludePath), { recursive: true });
        fs.appendFileSync(excludePath, (existing.endsWith("\n") || existing.length === 0 ? "" : "\n") + missing.join("\n") + "\n");
      }
    } catch (excludeErr) {
      logger.warn(`[scope-hook] Failed to update git exclude: ${String(excludeErr).slice(0, 100)}`, {});
    }
    logger.info(`[scope-hook] Installed pre-commit hook in ${worktreeDir}`, {});
  } catch (hookErr) {
    logger.warn(`[scope-hook] Failed to install: ${String(hookErr).slice(0, 100)}`, {});
  }
}

export function createStoryWorktree(repo: string, storyId: string, baseBranch: string, agentId?: string): string {
  // P2-03: Prune orphaned worktrees before creating new ones
  try { execFileSync("git", ["worktree", "prune"], { cwd: repo, timeout: 5000, stdio: ["pipe", "pipe", "pipe"] }); } catch {}
  stashDirtyMainRepo(repo, storyId);
  const baseIsSha = /^[0-9a-f]{40}$/i.test(baseBranch);

  const worktreeBase = resolveWorktreeBaseDir(repo, agentId);
  const worktreeDir = path.join(worktreeBase, storyId.toLowerCase());

  // Cross-project collision guard: if worktreeDir exists but belongs to a different repo, remove it.
  // Worktree .git files contain: "gitdir: /path/to/original-repo/.git/worktrees/xxx"
  // Extract the original repo path and compare with current repo.
  if (fs.existsSync(worktreeDir)) {
    let shouldRemove = false;
    const gitFile = path.join(worktreeDir, ".git");
    if (fs.existsSync(gitFile)) {
      try {
        const gitContent = fs.readFileSync(gitFile, "utf-8").trim();
        // Parse gitdir entries that point back to the source repository worktree metadata.
        const m = gitContent.match(/gitdir:\s*(.+?)\/.git\/worktrees\//);
        if (m) {
          const worktreeRepo = m[1];
          if (!sameFilesystemPath(worktreeRepo, repo)) {
            shouldRemove = true;
            logger.info(`[worktree] Stale cross-project worktree: ${worktreeDir} belongs to ${worktreeRepo}, current repo is ${repo}`, {});
          }
        }
      } catch (e) { logger.warn(`[worktree] Failed to read .git file in ${worktreeDir}: ${String(e)}`, {}); }
    } else {
      // No .git file — orphaned directory
      shouldRemove = true;
    }
    if (shouldRemove) {
      try { fs.rmSync(worktreeDir, { recursive: true, force: true }); } catch (e) { logger.warn(`[worktree] Failed to remove stale worktree ${worktreeDir}: ${String(e)}`, {}); }
    } else {
      try {
        const branch = execFileSync("git", ["branch", "--show-current"], {
          cwd: worktreeDir, encoding: "utf-8", timeout: 5000, stdio: ["pipe", "pipe", "pipe"],
        }).trim().toLowerCase();
        const expected = storyId.toLowerCase();
        if (branch === expected) {
          clearUnexpectedWorktreeIndexFlags(worktreeDir);
          const status = execFileSync("git", ["status", "--porcelain"], {
            cwd: worktreeDir, encoding: "utf-8", timeout: 5000, stdio: ["pipe", "pipe", "pipe"],
          }).trim();
          if (status) {
            const summary = status.split(/\r?\n/).slice(0, 12).join("; ");
            const stashName = `setfarm-auto-stash dirty story worktree before ${storyId} ${new Date().toISOString()}`;
            try {
              captureDirtyStoryWorktreePatch(repo, worktreeDir, storyId, status);
              execFileSync("git", ["stash", "push", "-u", "-m", stashName], {
                cwd: worktreeDir, timeout: 20000, stdio: ["pipe", "pipe", "pipe"],
              });
              execFileSync("git", ["reset", "--hard", "HEAD"], {
                cwd: worktreeDir, timeout: 10000, stdio: ["pipe", "pipe", "pipe"],
              });
              execFileSync("git", ["clean", "-fd"], {
                cwd: worktreeDir, timeout: 10000, stdio: ["pipe", "pipe", "pipe"],
              });
              logger.warn(`[worktree] Existing worktree ${worktreeDir} for ${storyId} was dirty; stashed and cleaned before claim: ${summary}`, {});
            } catch (cleanErr) {
              logger.warn(`[worktree] Dirty worktree clean failed for ${storyId}: ${String(cleanErr).slice(0, 150)}; recreating`, {});
              saveAndRemoveWorktree(repo, worktreeDir, expected);
            }
          }
          if (fs.existsSync(worktreeDir) && storyBranchHasContaminatedHistory(repo, expected, baseBranch)) {
            logger.warn(`[worktree] Existing worktree ${worktreeDir} has WIP/auto-save retry history; discarding before claim`, {});
            discardStoryWorktreeAndResetBranch(repo, expected, baseBranch, agentId);
          }
          if (fs.existsSync(worktreeDir) && !baseIsSha) {
            try {
              execFileSync("git", ["merge-base", "--is-ancestor", baseBranch, "HEAD"], {
                cwd: worktreeDir,
                timeout: 5000,
                stdio: ["pipe", "pipe", "pipe"],
              });
            } catch {
              logger.warn(`[worktree] Existing worktree ${worktreeDir} is behind ${baseBranch}; discarding before claim`, {});
              saveAndRemoveWorktree(repo, worktreeDir, expected);
            }
          }
          if (fs.existsSync(worktreeDir)) {
            clearUnexpectedWorktreeIndexFlags(worktreeDir);
            prepareStoryWorktreeAssets(repo, worktreeDir, storyId, "implement");
            logger.info(`[worktree] Reusing existing worktree ${worktreeDir} for ${storyId}`, {});
            return worktreeDir;
          }
          logger.warn(`[worktree] Existing worktree ${worktreeDir} disappeared while cleaning ${storyId}; recreating`, {});
        } else {
          logger.warn(`[worktree] Existing directory ${worktreeDir} is on branch ${branch || "(detached)"}, expected ${expected}; recreating`, {});
          saveAndRemoveWorktree(repo, worktreeDir, storyId.toLowerCase());
        }
      } catch (e) {
        logger.warn(`[worktree] Existing worktree ${worktreeDir} could not be validated: ${String(e).slice(0, 150)}; recreating`, {});
        saveAndRemoveWorktree(repo, worktreeDir, storyId.toLowerCase());
      }
    }
  }

  // Bug C fix (plan: reactive-frolicking-cupcake.md, run #342): caller may pass
  // a 40-char SHA instead of a branch name to PIN every story worktree in the
  // implement loop to the same parent commit. When we get a SHA, the fetch +
  // branch-sync dance below is wrong (you can't `git branch -f <sha> origin/<sha>`)
  // — skip it and go straight to creating the worktree from the explicit ref.
  try {
    if (!baseIsSha) {
      // MERGE_CONFLICT FIX (run #338): Before creating a worktree, make sure the local
      // base branch contains everything pushed so far — including the latest setup-build
      // commit and any merged story PRs. Previously we used `git branch -f` which fails
      // when base is checked out in the main worktree, leaving it stale. Now we fetch,
      // then in the main repo do a hard reset of the base branch to origin so the new
      // worktree's branch starts from the correct parent.
      syncBaseBranch(repo, baseBranch);
    } else {
      logger.info(`[worktree] Pinned base SHA ${baseBranch.slice(0, 8)} — skipping branch sync, creating worktree directly from commit`, {});
    }

    releaseMainWorktreeBranch(repo, storyId.toLowerCase(), baseBranch);
    releaseManagedStoryBranchOccupancy(repo, storyId.toLowerCase(), worktreeDir);

    // Check if story branch already exists (may have WIP commits from previous session)
    let branchExists = false;
    try {
      execFileSync("git", ["rev-parse", "--verify", storyId.toLowerCase()], { cwd: repo, timeout: 5000, stdio: "pipe" });
      branchExists = true;
    } catch (e) { /* branch not found — expected */ }
    // Wave 13b: safe removal (auto-save + push + remove) via single function
    saveAndRemoveWorktree(repo, worktreeDir, storyId.toLowerCase());

    if (branchExists) {
      // Prefer origin (includes auto-saved WIP from timed-out agents).
      // If no remote branch, reset to base (clean slate for first claim).
      let resetTarget = baseBranch;
      try {
        execFileSync("git", ["fetch", "origin", storyId.toLowerCase()], {
          cwd: repo, timeout: 10000, stdio: "pipe",
        });
        resetTarget = "origin/" + storyId.toLowerCase();
      } catch { /* no remote branch — clean slate */ }
      try {
        execFileSync("git", ["branch", "-f", storyId.toLowerCase(), resetTarget], {
          cwd: repo, timeout: 5000, stdio: "pipe",
        });
        logger.info(`[worktree] Reset story branch ${storyId} to ${resetTarget}`, {});
      } catch (resetErr) {
        logger.warn(`[worktree] Could not reset story branch: ${String(resetErr).slice(0, 150)}`, {});
      }
      if (storyBranchHasContaminatedHistory(repo, storyId.toLowerCase(), baseBranch)) {
        logger.warn(`[worktree] Story branch ${storyId} has WIP/auto-save retry history; resetting to clean base ${baseBranch}`, {});
        discardStoryWorktreeAndResetBranch(repo, storyId.toLowerCase(), baseBranch, agentId);
      }
      try {
        execFileSync("git", ["worktree", "add", worktreeDir, storyId.toLowerCase()], { cwd: repo, timeout: 30000, stdio: "pipe" });
      } catch (reuse_err: any) {
        // Branch may be locked by another worktree — detach and recreate
        if (String(reuse_err).includes("already used by worktree") || String(reuse_err).includes("already checked out")) {
          execFileSync("git", ["worktree", "add", "--detach", worktreeDir, baseBranch], { cwd: repo, timeout: 30000, stdio: "pipe" });
          execFileSync("git", ["checkout", storyId.toLowerCase()], { cwd: worktreeDir, timeout: 10000, stdio: "pipe" });
        } else {
          throw reuse_err;
        }
      }
      // Rebase onto latest base branch to incorporate merged PRs.
      // Bug C fix: skip rebase when base is a pinned SHA — we want every story
      // worktree in the loop to STAY at that SHA, not drift forward as siblings
      // get merged. The rebase here is for the case where the base is a moving
      // branch reference that may have advanced between abandon and resume.
      if (!baseIsSha) {
        try {
          execFileSync("git", ["rebase", baseBranch], { cwd: worktreeDir, timeout: 30000, stdio: "pipe" });
          logger.info(`[worktree] Rebased ${storyId} onto ${baseBranch}`, {});
        } catch (rebaseErr) {
          try { execFileSync("git", ["rebase", "--abort"], { cwd: worktreeDir, timeout: 5000, stdio: "pipe" }); } catch {}
          logger.warn(`[worktree] Rebase failed for ${storyId}, continuing with stale branch`, {});
        }
      } else {
        logger.info(`[worktree] Pinned SHA base — skipping rebase for ${storyId}`, {});
      }
      logger.info(`[worktree] Resumed ${storyId} branch with existing commits`, {});
    } else {
      // Create fresh worktree with new branch from base
      try {
        execFileSync("git", ["worktree", "add", worktreeDir, "-b", storyId.toLowerCase(), baseBranch], { cwd: repo, timeout: 30000, stdio: "pipe" });
      } catch (create_err: any) {
        // baseBranch may be locked by main worktree — detach first, then create branch
        if (String(create_err).includes("already used by worktree") || String(create_err).includes("already checked out")) {
          const baseRef = execFileSync("git", ["rev-parse", baseBranch], { cwd: repo, timeout: 5000, stdio: "pipe" }).toString().trim();
          execFileSync("git", ["worktree", "add", "--detach", worktreeDir, baseRef], { cwd: repo, timeout: 30000, stdio: "pipe" });
          execFileSync("git", ["checkout", "-b", storyId.toLowerCase()], { cwd: worktreeDir, timeout: 10000, stdio: "pipe" });
        } else {
          throw create_err;
        }
      }
    }
    clearUnexpectedWorktreeIndexFlags(worktreeDir);
    prepareStoryWorktreeAssets(repo, worktreeDir, storyId, "implement");

    logger.info(`[worktree] Created ${worktreeDir} from ${baseBranch}`, {});
    return worktreeDir;
  } catch (err: any) {
    // Branch might already exist — try without -b
    try {
      try {
        execFileSync("git", ["worktree", "add", worktreeDir, storyId.toLowerCase()], { cwd: repo, timeout: 30000, stdio: "pipe" });
      } catch (fallback_err: any) {
        if (String(fallback_err).includes("already used by worktree") || String(fallback_err).includes("already checked out")) {
          const baseRef2 = execFileSync("git", ["rev-parse", "HEAD"], { cwd: repo, timeout: 5000, stdio: "pipe" }).toString().trim();
          execFileSync("git", ["worktree", "add", "--detach", worktreeDir, baseRef2], { cwd: repo, timeout: 30000, stdio: "pipe" });
          execFileSync("git", ["checkout", storyId.toLowerCase()], { cwd: worktreeDir, timeout: 10000, stdio: "pipe" });
        } else {
          throw fallback_err;
        }
      }
      clearUnexpectedWorktreeIndexFlags(worktreeDir);
      prepareStoryWorktreeAssets(repo, worktreeDir, storyId, "implement");
      logger.info(`[worktree] Created ${worktreeDir} (existing branch)`, {});
      return worktreeDir;
    } catch (err2: any) {
      logger.warn(`[worktree] Failed to create worktree: ${(err2.message || "").slice(0, 100)}`, {});
      return "";
    }
  }
}

/** Find worktree directory — checks agent workspace first, then repo/.worktrees */
export function findWorktreeDir(repo: string, storyId: string, agentId?: string): string | null {
  const lower = storyId.toLowerCase();
  // Check agent workspace location first
  if (agentId) {
    const ws = getAgentWorkspacePath(agentId);
    if (ws) {
      const candidate = path.join(ws, "story-worktrees", lower);
      if (fs.existsSync(candidate)) return candidate;
    }
  }
  // Fall back to repo/.worktrees/
  const candidate = path.join(repo, ".worktrees", lower);
  if (fs.existsSync(candidate)) return candidate;
  return null;
}

function gitWorktreePathForBranch(repo: string, branch: string): string {
  try {
    const output = execFileSync("git", ["worktree", "list", "--porcelain"], {
      cwd: repo,
      encoding: "utf-8",
      timeout: 5000,
      stdio: ["pipe", "pipe", "pipe"],
    });
    let currentPath = "";
    for (const line of output.split(/\r?\n/)) {
      if (line.startsWith("worktree ")) {
        currentPath = line.slice("worktree ".length).trim();
      } else if (line === `branch refs/heads/${branch}` && currentPath && fs.existsSync(currentPath)) {
        return currentPath;
      }
    }
  } catch {
    // No git worktree metadata available.
  }
  return "";
}

function prepareStoryWorktreeAssets(repo: string, worktreeDir: string, storyBranch: string, mode: StoryWorktreeAssetMode = "full"): void {
  const nmSrc = path.join(repo, "node_modules");
  const nmDst = path.join(worktreeDir, "node_modules");
  if (fs.existsSync(nmSrc)) {
    try {
      const stat = fs.lstatSync(nmDst);
      if (!stat.isSymbolicLink()) {
        fs.rmSync(nmDst, { recursive: true, force: true });
        fs.symlinkSync(nmSrc, nmDst);
      }
    } catch {
      try { fs.symlinkSync(nmSrc, nmDst); } catch {}
    }
  }
  copyStitchToWorktree(repo, worktreeDir);
  if (mode === "implement") {
    hardenImplementStoryAssets(worktreeDir);
  } else {
    ensureReferencesLink(repo, worktreeDir);
  }
  installScopeHook(worktreeDir, storyBranch);
}

/**
 * Ensure reviewer/supervisor agents audit the committed story branch, even
 * after the developer worktree was removed at story completion. This differs
 * from createStoryWorktree: it never resets the branch to main/base, because
 * review must see the exact completed implementation that was just pushed.
 */
export function ensureStoryBranchWorktree(repo: string, storyBranch: string, agentId?: string): string {
  const branch = safeManagedStoryBranch(storyBranch);
  if (!repo || !fs.existsSync(repo) || !branch) return "";

  try { execFileSync("git", ["worktree", "prune"], { cwd: repo, timeout: 5000, stdio: ["pipe", "pipe", "pipe"] }); } catch {}

  const existing = findWorktreeDir(repo, branch, agentId) || gitWorktreePathForBranch(repo, branch);
  if (existing && fs.existsSync(existing)) {
    try {
      const current = execFileSync("git", ["branch", "--show-current"], {
        cwd: existing,
        encoding: "utf-8",
        timeout: 5000,
        stdio: ["pipe", "pipe", "pipe"],
      }).trim().toLowerCase();
      if (current === branch) {
        clearUnexpectedWorktreeIndexFlags(existing);
        prepareStoryWorktreeAssets(repo, existing, branch);
        return existing;
      }
    } catch {
      // Fall through to re-creation below.
    }
  }

  try {
    execFileSync("git", ["fetch", "origin", branch], {
      cwd: repo,
      timeout: 15000,
      stdio: ["pipe", "pipe", "pipe"],
    });
  } catch {
    // Local-only story branches are still valid before the first push.
  }

  let ref = branch;
  try {
    execFileSync("git", ["rev-parse", "--verify", branch], {
      cwd: repo,
      timeout: 5000,
      stdio: ["pipe", "pipe", "pipe"],
    });
  } catch {
    try {
      execFileSync("git", ["rev-parse", "--verify", `origin/${branch}`], {
        cwd: repo,
        timeout: 5000,
        stdio: ["pipe", "pipe", "pipe"],
      });
      execFileSync("git", ["branch", branch, `origin/${branch}`], {
        cwd: repo,
        timeout: 10000,
        stdio: ["pipe", "pipe", "pipe"],
      });
    } catch (err) {
      logger.warn(`[worktree] Cannot resolve story branch ${branch} for review worktree: ${String(err).slice(0, 150)}`, {});
      return "";
    }
  }

  releaseMainWorktreeBranch(repo, branch, "main");
  const worktreeBase = resolveWorktreeBaseDir(repo, agentId);
  const worktreeDir = path.join(worktreeBase, branch);
  if (fs.existsSync(worktreeDir)) {
    const normalized = path.resolve(worktreeDir);
    if (normalized.includes(`${path.sep}story-worktrees${path.sep}`) || normalized.includes(`${path.sep}.worktrees${path.sep}`)) {
      try { fs.rmSync(normalized, { recursive: true, force: true }); } catch {}
    } else {
      logger.warn(`[worktree] Refusing to recreate non-managed review worktree path ${worktreeDir}`, {});
      return "";
    }
  }

  try {
    fs.mkdirSync(path.dirname(worktreeDir), { recursive: true });
    execFileSync("git", ["worktree", "add", worktreeDir, ref], {
      cwd: repo,
      timeout: 30000,
      stdio: "pipe",
    });
  } catch (err: any) {
    const occupied = gitWorktreePathForBranch(repo, branch);
    if (occupied && fs.existsSync(occupied)) {
      clearUnexpectedWorktreeIndexFlags(occupied);
      prepareStoryWorktreeAssets(repo, occupied, branch);
      return occupied;
    }
    logger.warn(`[worktree] Failed to create review worktree for ${branch}: ${String(err).slice(0, 180)}`, {});
    return "";
  }

  clearUnexpectedWorktreeIndexFlags(worktreeDir);
  prepareStoryWorktreeAssets(repo, worktreeDir, branch);
  logger.info(`[worktree] Created review worktree ${worktreeDir} for ${branch}`, {});
  return worktreeDir;
}

/**
 * Wave 13b: Single source of truth for worktree removal.
 * ALWAYS auto-saves uncommitted work (commit + push) before destroying anything.
 * Every code path that removes a worktree MUST call this function.
 *
 * Why push: agent timeout kills the process before it commits. Uncommitted files
 * stay in the worktree dir. If we only commit (no push), the next createStoryWorktree
 * resets the branch to origin (which has no commit) → work lost. Push ensures the
 * next claim's `git fetch origin storyBranch` finds the saved work.
 */
export function saveAndRemoveWorktree(repo: string, worktreeDir: string, storyBranch: string): void {
  if (!fs.existsSync(worktreeDir)) return;

  // 1. Auto-save uncommitted work (commit + push)
  let pushed = false;
  try {
    const gitFile = path.join(worktreeDir, ".git");
    if (fs.existsSync(gitFile)) {
      const status = execFileSync("git", ["status", "--porcelain"], {
        cwd: worktreeDir, timeout: 5000, stdio: "pipe",
      }).toString().trim();
      if (status) {
        const fileCount = status.split("\n").length;
        execFileSync("git", ["add", "-A"], { cwd: worktreeDir, timeout: 5000, stdio: "pipe" });
        execFileSync("git", ["commit", "-m", `wip: auto-save ${fileCount} file(s) before worktree removal`], {
          cwd: worktreeDir, timeout: 10000, stdio: "pipe",
        });
        try {
          execFileSync("git", ["push", "-u", "origin", storyBranch.toLowerCase()], {
            cwd: worktreeDir, timeout: 15000, stdio: "pipe",
          });
          pushed = true;
          logger.info(`[worktree] Auto-saved + pushed ${fileCount} uncommitted file(s) for ${storyBranch}`, {});
        } catch (pushErr) {
          logger.warn(`[worktree] Auto-save committed but push failed for ${storyBranch}: ${String(pushErr).slice(0, 150)}`, {});
        }
      }
    }
  } catch (saveErr) {
    logger.warn(`[worktree] Auto-save failed for ${storyBranch}: ${String(saveErr).slice(0, 150)}`, {});
  }

  // Preserve already-committed local WIP too. A killed agent can leave a clean
  // worktree with commits that were never pushed; removing the worktree without
  // this push loses useful retry context.
  if (!pushed) {
    try {
      const branch = execFileSync("git", ["branch", "--show-current"], {
        cwd: worktreeDir, timeout: 5000, stdio: "pipe",
      }).toString().trim();
      if (branch && branch.toLowerCase() === storyBranch.toLowerCase()) {
        execFileSync("git", ["push", "-u", "origin", storyBranch.toLowerCase()], {
          cwd: worktreeDir, timeout: 15000, stdio: "pipe",
        });
        logger.info(`[worktree] Pushed existing local commits for ${storyBranch} before worktree removal`, {});
      }
    } catch (pushErr) {
      logger.warn(`[worktree] Existing-commit push skipped/failed for ${storyBranch}: ${String(pushErr).slice(0, 150)}`, {});
    }
  }

  // 2. Remove node_modules symlink (git worktree remove can't handle symlinks)
  try { fs.unlinkSync(path.join(worktreeDir, "node_modules")); } catch {}

  // 3. Remove worktree + prune
  try { execFileSync("git", ["worktree", "remove", worktreeDir, "--force"], { cwd: repo, timeout: 10000, stdio: "pipe" }); } catch {}
  try { execFileSync("git", ["worktree", "prune"], { cwd: repo, timeout: 5000, stdio: "pipe" }); } catch {}
}

function safeManagedStoryBranch(storyBranch: string): string {
  const branch = storyBranch.toLowerCase().trim();
  if (
    !branch ||
    branch.startsWith("-") ||
    branch.includes("..") ||
    branch.includes("@{") ||
    !/^[a-z0-9._/-]+$/.test(branch)
  ) {
    return "";
  }
  return branch;
}

function storyBranchHasContaminatedHistory(repo: string, storyBranch: string, baseRef: string): boolean {
  const branch = safeManagedStoryBranch(storyBranch);
  if (!repo || !branch || !baseRef) return false;
  try {
    execFileSync("git", ["rev-parse", "--verify", branch], {
      cwd: repo, timeout: 5000, stdio: "pipe",
    });
    execFileSync("git", ["rev-parse", "--verify", baseRef], {
      cwd: repo, timeout: 5000, stdio: "pipe",
    });
    const subjects = execFileSync("git", ["log", "--format=%s", `${baseRef}..${branch}`], {
      cwd: repo, encoding: "utf-8", timeout: 10000, stdio: ["pipe", "pipe", "pipe"],
    });
    return subjects
      .split(/\r?\n/)
      .some((subject) => /^(wip\b|work in progress\b)|auto-save/i.test(subject.trim()));
  } catch {
    return false;
  }
}

/**
 * Runtime guard retries are different from timeouts/abandon paths: the worker
 * produced contaminated context or git history, so preserving WIP is harmful.
 * Discard the worktree and reset the story branch back to the clean base.
 */
export function discardStoryWorktreeAndResetBranch(repo: string, storyBranch: string, baseRef: string, agentId?: string): void {
  const branch = safeManagedStoryBranch(storyBranch);
  if (!repo || !branch || !baseRef) return;

  const worktreeDir = findWorktreeDir(repo, branch, agentId) || path.join(repo, ".worktrees", branch);
  try { if (fs.existsSync(worktreeDir)) killWorktreeProcesses(worktreeDir); } catch {}
  try { fs.unlinkSync(path.join(worktreeDir, "node_modules")); } catch {}

  if (fs.existsSync(worktreeDir)) {
    try {
      execFileSync("git", ["worktree", "remove", worktreeDir, "--force"], {
        cwd: repo, timeout: 15000, stdio: "pipe",
      });
    } catch (removeErr) {
      const normalized = path.resolve(worktreeDir);
      if (normalized.includes(`${path.sep}story-worktrees${path.sep}`) || normalized.includes(`${path.sep}.worktrees${path.sep}`)) {
        try { fs.rmSync(normalized, { recursive: true, force: true }); } catch {}
      } else {
        logger.warn(`[worktree] Refusing fallback rm for non-managed worktree path ${worktreeDir}: ${String(removeErr).slice(0, 120)}`, {});
      }
    }
  }
  try { execFileSync("git", ["worktree", "prune"], { cwd: repo, timeout: 5000, stdio: "pipe" }); } catch {}

  try { releaseMainWorktreeBranch(repo, branch, baseRef); } catch {}
  try {
    execFileSync("git", ["branch", "-f", branch, baseRef], {
      cwd: repo, timeout: 10000, stdio: "pipe",
    });
  } catch (resetErr) {
    logger.warn(`[worktree] Could not reset contaminated story branch ${branch} to ${baseRef}: ${String(resetErr).slice(0, 160)}`, {});
  }

  try {
    execFileSync("git", ["push", "origin", "--delete", branch], {
      cwd: repo, timeout: 15000, stdio: "pipe",
    });
    logger.warn(`[worktree] Deleted remote contaminated story branch origin/${branch}`, {});
  } catch {
    // No remote branch is the desired state after a guard discard.
  }

  logger.warn(`[worktree] Discarded guarded retry worktree for ${branch}; reset local branch to ${baseRef}`, {});
}

/** Auto-save uncommitted changes in a worktree without removing it (used on abandon) */
export function autoSaveWorktree(repo: string, storyId: string, agentId?: string): void {
  const worktreeDir = findWorktreeDir(repo, storyId, agentId) || path.join(repo, ".worktrees", storyId.toLowerCase());
  try {
    if (!fs.existsSync(worktreeDir)) return;
    const status = execFileSync("git", ["status", "--porcelain"], { cwd: worktreeDir, timeout: 5000, stdio: "pipe" }).toString().trim();
    if (status) {
      const fileCount = status.split("\n").length;
      execFileSync("git", ["add", "-A"], { cwd: worktreeDir, timeout: 10000, stdio: "pipe" });
      execFileSync("git", ["commit", "-m", `wip: auto-save ${fileCount} file(s) on abandon (${storyId})`], { cwd: worktreeDir, timeout: 10000, stdio: "pipe" });
      try {
        execFileSync("git", ["push", "-u", "origin", storyId.toLowerCase()], { cwd: worktreeDir, timeout: 15000, stdio: "pipe" });
        logger.info(`[worktree] Auto-saved + pushed ${fileCount} file(s) on abandon for ${storyId}`, {});
      } catch (pushErr) {
        logger.warn(`[worktree] Auto-save committed but push failed on abandon for ${storyId}: ${String(pushErr).slice(0, 100)}`, {});
      }
    }
  } catch (err) {
    logger.warn(`[worktree] Auto-save failed for ${storyId}: ${String(err).slice(0, 150)}`, {});
  }
}

export function removeStoryWorktree(repo: string, storyId: string, agentId?: string): void {
  const worktreeDir = findWorktreeDir(repo, storyId, agentId) || path.join(repo, ".worktrees", storyId.toLowerCase());
  try {
    saveAndRemoveWorktree(repo, worktreeDir, storyId);
    logger.info(`[worktree] Removed ${worktreeDir}`, {});
  } catch (err: any) {
    logger.error(`[worktree] Failed to remove ${worktreeDir}: ${(err.message || "").slice(0, 200)}`, {});
  }
}

// ── Process Cleanup (v1.5.15) ───────────────────────────────────────

/**
 * Kill all processes whose working directory is inside the given directory.
 * This prevents orphaned vitest/esbuild/node processes from consuming CPU
 * after a step completes. Uses /proc/<pid>/cwd to detect CWD on Linux.
 */
export function killWorktreeProcesses(dir: string): void {
  // Validate dir is within a known worktree location (safety guard against accidental kills)
  if (!dir.includes(".worktrees") && !dir.includes("story-worktrees")) {
    logger.warn(`[worktree] Refusing to kill processes in non-worktree dir: ${dir}`, {});
    return;
  }
  try {
    if (process.platform === "darwin") {
      let out = "";
      try {
        out = execFileSync("lsof", ["-t", "+D", dir], {
          encoding: "utf-8",
          stdio: ["ignore", "pipe", "ignore"],
          timeout: 5000,
        }).trim();
      } catch {
        return;
      }

      const pids = [...new Set(out.split(/\s+/).map((value) => Number(value)).filter((pid) => Number.isFinite(pid)))]
        .filter((pid) => pid !== process.pid && pid !== process.ppid);
      if (pids.length === 0) return;

      for (const pid of pids) {
        try { process.kill(pid, "SIGTERM"); } catch { /* already dead */ }
      }
      try { const _b = new SharedArrayBuffer(4); Atomics.wait(new Int32Array(_b), 0, 0, 2000); } catch { /* wait OK */ }
      for (const pid of pids) {
        try {
          process.kill(pid, 0);
          process.kill(pid, "SIGKILL");
        } catch { /* already dead */ }
      }
      logger.info(`[worktree] Killed ${pids.length} orphaned process(es) in ${dir}`, {});
      return;
    }

    if (process.platform !== "linux") return;

    // Node.js native /proc scanning — no shell, no injection risk
    const procDir = "/proc";
    let entries: string[];
    try { entries = fs.readdirSync(procDir); } catch { return; }

    const pids: number[] = [];
    const myPid = process.pid;
    const parentPid = process.ppid;

    for (const entry of entries) {
      if (!/^\d+$/.test(entry)) continue;
      const pid = parseInt(entry, 10);
      if (pid === myPid || pid === parentPid) continue;
      try {
        const cwd = fs.readlinkSync(path.join(procDir, entry, "cwd"));
        if (cwd.startsWith(dir)) pids.push(pid);
      } catch { /* process gone or no permission */ }
    }

    if (pids.length === 0) return;

    for (const pid of pids) {
      try { process.kill(pid, "SIGTERM"); } catch { /* already dead */ }
    }

    // 2s grace period then SIGKILL survivors
    try { const _b = new SharedArrayBuffer(4); Atomics.wait(new Int32Array(_b), 0, 0, 2000); } catch { /* wait OK */ }
    for (const pid of pids) {
      try {
        process.kill(pid, 0);
        process.kill(pid, "SIGKILL");
      } catch { /* already dead */ }
    }

    logger.info(`[worktree] Killed ${pids.length} orphaned process(es) in ${dir}`, {});
  } catch (err) {
    logger.warn(`[worktree] Process cleanup failed for ${dir}: ${err}`, {});
  }
}

// ── Worktree Cleanup (v1.5.4) ───────────────────────────────────────

/**
 * Clean up leftover git worktrees when a run completes.
 * Prunes stale worktree refs and removes the .worktrees/ directory.
 */
export async function cleanupWorktrees(runId: string): Promise<void> {
  try {
    const run = await pgGet<{ context: string }>("SELECT context FROM runs WHERE id = $1", [runId]);
    if (!run) return;
    let context: Record<string, string>;
    try {
      context = JSON.parse(run.context);
    } catch (parseErr) {
      logger.warn(`[worktree] Corrupt context JSON for run ${runId}, skipping cleanup`, {});
      return;
    }
    const repo = context.repo;
    if (!repo) return;

    // Prune stale worktree references
    try {
      execFileSync("git", ["worktree", "prune"], { cwd: repo, timeout: 10_000, stdio: "pipe" });
    } catch (e) { logger.warn(`[worktree] stale prune failed: ${String(e)}`, {}); }

    // Remove .worktrees/ directory if empty or contains only leftover dirs
    const worktreesDir = path.join(repo, ".worktrees");
    if (fs.existsSync(worktreesDir)) {
      const entries = fs.readdirSync(worktreesDir);
      for (const entry of entries) {
        const entryPath = path.join(worktreesDir, entry);
        // Kill orphaned processes (vitest, esbuild, etc.) before removing worktree
        killWorktreeProcesses(entryPath);
        try {
          // Remove node_modules symlink first
          const nmLink = path.join(entryPath, "node_modules");
          try { fs.unlinkSync(nmLink); } catch (e) { logger.warn(`[worktree] cleanup symlink unlink failed: ${String(e)}`, {}); }
          execFileSync("git", ["worktree", "remove", entryPath, "--force"], { cwd: repo, timeout: 10_000, stdio: "pipe" });
        } catch {
          // If git worktree remove fails, try rm -rf
          try { fs.rmSync(entryPath, { recursive: true, force: true }); } catch (e) { logger.warn(`[worktree] rm fallback failed: ${String(e)}`, {}); }
        }
      }
      // Prune again after removals
      try {
        execFileSync("git", ["worktree", "prune"], { cwd: repo, timeout: 5_000, stdio: "pipe" });
      } catch (e) { logger.warn(`[worktree] post-cleanup prune failed: ${String(e)}`, {}); }
      // Remove the .worktrees dir itself if now empty
      try {
        const remaining = fs.readdirSync(worktreesDir);
        if (remaining.length === 0) {
          fs.rmdirSync(worktreesDir);
        }
      } catch (e) { logger.warn(`[worktree] .worktrees dir removal failed: ${String(e)}`, {}); }
    }

    logger.info(`[worktree] Cleanup completed for run ${runId} in ${repo}`, {});
  } catch (err) {
    logger.warn(`[worktree] Cleanup failed for run ${runId}: ${err}`, {});
  }
}

// ── Agent Workspace Cleanup ─────────────────────────────────────────

/**
 * Preserved files/dirs in agent workspace (OpenClaw system files).
 * Everything else is leftover from a previous run and must be removed.
 */
const WORKSPACE_PRESERVED = new Set([
  '.openclaw',
  'SOUL.md',
  'AGENTS.md',
  'IDENTITY.md',
  'HEARTBEAT.md',
  'TOOLS.md',
  'USER.md',
  'BOOTSTRAP.md',
  'README.md',
  '.git',
]);

/**
 * Clean an agent's workspace of all project files from previous runs.
 * Preserves OpenClaw system files (SOUL.md, AGENTS.md, .openclaw/, etc.)
 * Call this before a new run claims a step for the agent.
 */
export function cleanAgentWorkspace(agentId: string): void {
  const ws = getAgentWorkspacePath(agentId);
  if (!ws || !fs.existsSync(ws)) return;

  // Also clean stale setfarm output files (prevents "Step not found" errors)
  for (const staleFile of ['.setfarm-step-output.txt', 'setfarm-output.txt']) {
    const stale = path.join(ws, staleFile);
    try { if (fs.existsSync(stale)) { fs.unlinkSync(stale); logger.info(`[workspace-clean] Removed stale ${staleFile} from ${agentId}`, {}); } } catch {}
  }

  try {
    const entries = fs.readdirSync(ws);
    let removed = 0;

    for (const entry of entries) {
      // Skip preserved system files
      if (WORKSPACE_PRESERVED.has(entry)) continue;
      // Skip hidden dirs other than .git (e.g. .openclaw)
      if (entry.startsWith('.') && entry !== '.git') continue;

      const fullPath = path.join(ws, entry);
      try {
        const stat = fs.lstatSync(fullPath);
        if (stat.isDirectory()) {
          // Kill any orphaned processes in the directory first
          killWorktreeProcesses(fullPath);
          fs.rmSync(fullPath, { recursive: true, force: true });
        } else {
          fs.unlinkSync(fullPath);
        }
        removed++;
      } catch (e) {
        logger.warn(`[workspace-clean] Failed to remove ${entry} in ${agentId} workspace: ${String(e)}`, {});
      }
    }

    if (removed > 0) {
      logger.info(`[workspace-clean] Cleaned ${removed} stale entries from ${agentId} workspace`, {});
    }
  } catch (err) {
    logger.warn(`[workspace-clean] Failed for ${agentId}: ${String(err)}`, {});
  }
}
