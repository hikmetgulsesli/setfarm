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
import { getDb } from "../db.js";
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

// ── Stitch Asset Copy ───────────────────────────────────────────────

/** Copy stitch/ design assets from main repo into worktree so developers can reference them */
export function copyStitchToWorktree(repo: string, worktreeDir: string): void {
  try {
    const stitchSrc = path.join(repo, "stitch");
    if (!fs.existsSync(stitchSrc)) return;
    const stitchDst = path.join(worktreeDir, "stitch");
    fs.cpSync(stitchSrc, stitchDst, { recursive: true });
    logger.info(`[worktree] Copied stitch/ to worktree`, {});
  } catch (e: any) {
    logger.warn(`[worktree] copyStitchToWorktree failed: ${e.message}`, {});
  }
}

// ── Worktree CRUD ───────────────────────────────────────────────────

export function createStoryWorktree(repo: string, storyId: string, baseBranch: string, agentId?: string): string {
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
        // Parse: "gitdir: /home/setrox/projects/sudoku/.git/worktrees/us-001"
        const m = gitContent.match(/gitdir:\s*(.+?)\/.git\/worktrees\//);
        if (m) {
          const worktreeRepo = m[1];
          if (path.resolve(worktreeRepo) !== path.resolve(repo)) {
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
    }
  }

  try {
    // MERGE_CONFLICT FIX: Fetch latest base branch before creating worktree.
    // Without this, worktree is created from stale local base branch that
    // doesn't include recently merged PRs from other stories.
    try {
      execFileSync("git", ["fetch", "origin", baseBranch], { cwd: repo, timeout: 15000, stdio: "pipe" });
      // Fast-forward local base branch to include merged PRs
      execFileSync("git", ["branch", "-f", baseBranch, "origin/" + baseBranch], { cwd: repo, timeout: 5000, stdio: "pipe" });
      logger.info(`[worktree] Synced ${baseBranch} to origin/${baseBranch} before creating worktree`, {});
    } catch (fetchErr) {
      logger.warn(`[worktree] Could not sync base branch: ${String(fetchErr)}`, {});
    }

    // Check if story branch already exists (may have WIP commits from previous session)
    let branchExists = false;
    try {
      execFileSync("git", ["rev-parse", "--verify", storyId.toLowerCase()], { cwd: repo, timeout: 5000, stdio: "pipe" });
      branchExists = true;
    } catch (e) { /* branch not found — expected */ }
    // Remove leftover worktree dir if exists (but branch is preserved above)
    try { execFileSync("git", ["worktree", "remove", worktreeDir, "--force"], { cwd: repo, timeout: 10000, stdio: "pipe" }); } catch (e) { logger.warn(`[worktree] leftover remove failed: ${String(e)}`, {}); }
    try { execFileSync("git", ["worktree", "prune"], { cwd: repo, timeout: 5000, stdio: "pipe" }); } catch (e) { logger.warn(`[worktree] prune failed: ${String(e)}`, {}); }
    if (branchExists) {
      // Reuse existing branch (preserves WIP commits from abandoned sessions)
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
    // Symlink node_modules to avoid reinstall per story
    const nmSrc = path.join(repo, "node_modules");
    const nmDst = path.join(worktreeDir, "node_modules");
    if (fs.existsSync(nmSrc) && !fs.existsSync(nmDst)) {
      fs.symlinkSync(nmSrc, nmDst);
    }
    // Copy stitch design assets into worktree so developer agents can read them
    copyStitchToWorktree(repo, worktreeDir);
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
      const nmSrc = path.join(repo, "node_modules");
      const nmDst = path.join(worktreeDir, "node_modules");
      if (fs.existsSync(nmSrc) && !fs.existsSync(nmDst)) {
        fs.symlinkSync(nmSrc, nmDst);
      }
      copyStitchToWorktree(repo, worktreeDir);
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

/** Auto-save uncommitted changes in a worktree without removing it (used on abandon) */
export function autoSaveWorktree(repo: string, storyId: string, agentId?: string): void {
  const worktreeDir = findWorktreeDir(repo, storyId, agentId) || path.join(repo, ".worktrees", storyId.toLowerCase());
  try {
    if (!fs.existsSync(worktreeDir)) return;
    const status = execFileSync("git", ["status", "--porcelain"], { cwd: worktreeDir, timeout: 5000, stdio: "pipe" }).toString().trim();
    if (status) {
      execFileSync("git", ["add", "-A"], { cwd: worktreeDir, timeout: 10000, stdio: "pipe" });
      execFileSync("git", ["commit", "-m", `wip: auto-save on abandon (${storyId})`], { cwd: worktreeDir, timeout: 10000, stdio: "pipe" });
      logger.info(`[worktree] Auto-saved uncommitted changes on abandon for ${storyId}`, {});
    }
  } catch (err) {
    logger.warn(`[worktree] Auto-save failed for ${storyId}: ${String(err)}`, {});
  }
}

export function removeStoryWorktree(repo: string, storyId: string, agentId?: string): void {
  const worktreeDir = findWorktreeDir(repo, storyId, agentId) || path.join(repo, ".worktrees", storyId.toLowerCase());
  try {
    // Rescue uncommitted changes before removing worktree
    if (fs.existsSync(worktreeDir)) {
      try {
        const status = execFileSync("git", ["status", "--porcelain"], { cwd: worktreeDir, timeout: 5000, stdio: "pipe" }).toString().trim();
        if (status) {
          // Uncommitted work exists — commit it as WIP so next session can continue
          execFileSync("git", ["add", "-A"], { cwd: worktreeDir, timeout: 10000, stdio: "pipe" });
          execFileSync("git", ["commit", "-m", `wip: auto-save before session end (${storyId})`], { cwd: worktreeDir, timeout: 10000, stdio: "pipe" });
          logger.info(`[worktree] Auto-saved uncommitted changes in ${storyId}`, {});
        }
      } catch {
        // Best effort — if commit fails, we still remove the worktree
      }
    }
    // Remove node_modules symlink first (git worktree remove doesn't handle symlinks well)
    const nmLink = path.join(worktreeDir, "node_modules");
    try { fs.unlinkSync(nmLink); } catch (e) { logger.warn(`[worktree] symlink unlink failed: ${String(e)}`, {}); }
    execFileSync("git", ["worktree", "remove", worktreeDir, "--force"], { cwd: repo, timeout: 10000, stdio: "pipe" });
    execFileSync("git", ["worktree", "prune"], { cwd: repo, timeout: 5000, stdio: "pipe" });
    logger.info(`[worktree] Removed ${worktreeDir}`, {});
  } catch (err: any) {
    // Item 12: Log worktree cleanup errors instead of silently swallowing
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
  if (process.platform !== "linux") return;
  // Validate dir is within a known worktree location (safety guard against accidental kills)
  if (!dir.includes(".worktrees") && !dir.includes("story-worktrees")) {
    logger.warn(`[worktree] Refusing to kill processes in non-worktree dir: ${dir}`, {});
    return;
  }
  try {
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
export function cleanupWorktrees(runId: string): void {
  try {
    const db = getDb();
    const run = db.prepare("SELECT context FROM runs WHERE id = ?").get(runId) as { context: string } | undefined;
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
