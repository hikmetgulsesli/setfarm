/**
 * Git Worktree Operations
 *
 * Extracted from step-ops.ts — manages parallel story isolation via git worktrees.
 * Each story gets its own branch + working directory for conflict-free development.
 */

import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execSync, execFileSync } from "node:child_process";
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
    fs.mkdirSync(stitchDst, { recursive: true });
    for (const file of fs.readdirSync(stitchSrc)) {
      const src = path.join(stitchSrc, file);
      const dst = path.join(stitchDst, file);
      if (fs.statSync(src).isFile()) {
        fs.copyFileSync(src, dst);
      }
    }
    logger.info(`[worktree] Copied stitch/ assets to ${worktreeDir}`, {});
  } catch {
    // Best effort — missing design files are non-fatal
  }
}

// ── Worktree CRUD ───────────────────────────────────────────────────

export function createStoryWorktree(repo: string, storyId: string, baseBranch: string, agentId?: string): string {
  const worktreeBase = resolveWorktreeBaseDir(repo, agentId);
  const worktreeDir = path.join(worktreeBase, storyId.toLowerCase());
  try {
    // Check if story branch already exists (may have WIP commits from previous session)
    let branchExists = false;
    try {
      execFileSync("git", ["rev-parse", "--verify", storyId.toLowerCase()], { cwd: repo, timeout: 5000, stdio: "pipe" });
      branchExists = true;
    } catch {}
    // Remove leftover worktree dir if exists (but branch is preserved above)
    try { execFileSync("git", ["worktree", "remove", worktreeDir, "--force"], { cwd: repo, timeout: 10000, stdio: "pipe" }); } catch {}
    try { execFileSync("git", ["worktree", "prune"], { cwd: repo, timeout: 5000, stdio: "pipe" }); } catch {}
    if (branchExists) {
      // Reuse existing branch (preserves WIP commits from abandoned sessions)
      execFileSync("git", ["worktree", "add", worktreeDir, storyId.toLowerCase()], { cwd: repo, timeout: 30000, stdio: "pipe" });
      logger.info(`[worktree] Resumed ${storyId} branch with existing commits`, {});
    } else {
      // Create fresh worktree with new branch from base
      execFileSync("git", ["worktree", "add", worktreeDir, "-b", storyId.toLowerCase(), baseBranch], { cwd: repo, timeout: 30000, stdio: "pipe" });
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
      execFileSync("git", ["worktree", "add", worktreeDir, storyId.toLowerCase()], { cwd: repo, timeout: 30000, stdio: "pipe" });
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
  } catch {
    // Best effort
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
    try { fs.unlinkSync(nmLink); } catch {}
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
  try {
    // Find all PIDs with cwd inside the target directory
    const result = execSync(
      `find /proc/[0-9]*/cwd -maxdepth 0 2>/dev/null | while read link; do pid=$(echo "$link" | cut -d/ -f3); target=$(readlink "$link" 2>/dev/null || true); if [ -n "$target" ] && echo "$target" | grep -q "^${dir}"; then echo "$pid"; fi; done`,
      { timeout: 10_000, stdio: ["pipe", "pipe", "pipe"], encoding: "utf-8" }
    ).trim();
    if (!result) return;

    const pids = result.split("\n").filter(Boolean);
    if (pids.length === 0) return;

    const myPid = String(process.pid);
    const parentPid = String(process.ppid);

    for (const pid of pids) {
      if (pid === myPid || pid === parentPid) continue;
      try { process.kill(Number(pid), "SIGTERM"); } catch {}
    }

    // Give processes 2s to exit gracefully, then SIGKILL survivors
    try { execSync("sleep 2", { timeout: 5_000, stdio: "pipe" }); } catch {}
    for (const pid of pids) {
      if (pid === myPid || pid === parentPid) continue;
      try {
        process.kill(Number(pid), 0); // Check if still alive
        process.kill(Number(pid), "SIGKILL");
      } catch {} // Already dead — good
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
    } catch {}

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
          try { fs.unlinkSync(nmLink); } catch {}
          execFileSync("git", ["worktree", "remove", entryPath, "--force"], { cwd: repo, timeout: 10_000, stdio: "pipe" });
        } catch {
          // If git worktree remove fails, try rm -rf
          try { fs.rmSync(entryPath, { recursive: true, force: true }); } catch {}
        }
      }
      // Prune again after removals
      try {
        execFileSync("git", ["worktree", "prune"], { cwd: repo, timeout: 5_000, stdio: "pipe" });
      } catch {}
      // Remove the .worktrees dir itself if now empty
      try {
        const remaining = fs.readdirSync(worktreesDir);
        if (remaining.length === 0) {
          fs.rmdirSync(worktreesDir);
        }
      } catch {}
    }

    logger.info(`[worktree] Cleanup completed for run ${runId} in ${repo}`, {});
  } catch (err) {
    logger.warn(`[worktree] Cleanup failed for run ${runId}: ${err}`, {});
  }
}
