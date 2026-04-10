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

// ── Stitch Asset Copy ───────────────────────────────────────────────

/** Copy stitch/ design assets from main repo into worktree so developers can reference them */
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

export function createStoryWorktree(repo: string, storyId: string, baseBranch: string, agentId?: string): string {
  // P2-03: Prune orphaned worktrees before creating new ones
  try { execFileSync("git", ["worktree", "prune"], { cwd: repo, timeout: 5000, stdio: ["pipe", "pipe", "pipe"] }); } catch {}

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

  // Bug C fix (plan: reactive-frolicking-cupcake.md, run #342): caller may pass
  // a 40-char SHA instead of a branch name to PIN every story worktree in the
  // implement loop to the same parent commit. When we get a SHA, the fetch +
  // branch-sync dance below is wrong (you can't `git branch -f <sha> origin/<sha>`)
  // — skip it and go straight to creating the worktree from the explicit ref.
  const baseIsSha = /^[0-9a-f]{40}$/i.test(baseBranch);

  try {
    if (!baseIsSha) {
      // MERGE_CONFLICT FIX (run #338): Before creating a worktree, make sure the local
      // base branch contains everything pushed so far — including the latest setup-build
      // commit and any merged story PRs. Previously we used `git branch -f` which fails
      // when base is checked out in the main worktree, leaving it stale. Now we fetch,
      // then in the main repo do a hard reset of the base branch to origin so the new
      // worktree's branch starts from the correct parent.
      try {
        execFileSync("git", ["fetch", "origin", baseBranch], { cwd: repo, timeout: 15000, stdio: "pipe" });
        // What is the current branch in the main worktree?
        let mainCurrent = "";
        try {
          mainCurrent = execFileSync("git", ["rev-parse", "--abbrev-ref", "HEAD"], { cwd: repo, timeout: 5000, stdio: "pipe" }).toString().trim();
        } catch {}
        if (mainCurrent === baseBranch) {
          // Base branch IS checked out in main repo — sync forward via pull --ff-only.
          // If local has commits ahead of origin (e.g. setup-build just committed but
          // hasn't been pushed yet), this is a no-op and we keep the local commit.
          try {
            execFileSync("git", ["pull", "origin", baseBranch, "--ff-only"], { cwd: repo, timeout: 15000, stdio: "pipe" });
            logger.info(`[worktree] Pulled ${baseBranch} (ff-only) in main worktree before creating story worktree`, {});
          } catch (pullErr) {
            logger.warn(`[worktree] ff-only pull of ${baseBranch} failed (local may be ahead or diverged), continuing: ${String(pullErr).slice(0, 150)}`, {});
          }
        } else {
          // Base branch not checked out anywhere — safe to hard-sync via branch -f
          try {
            execFileSync("git", ["branch", "-f", baseBranch, "origin/" + baseBranch], { cwd: repo, timeout: 5000, stdio: "pipe" });
            logger.info(`[worktree] Synced ${baseBranch} to origin/${baseBranch} before creating worktree`, {});
          } catch (brErr) {
            logger.warn(`[worktree] branch -f ${baseBranch} failed: ${String(brErr).slice(0, 150)}`, {});
          }
        }
      } catch (fetchErr) {
        logger.warn(`[worktree] Could not sync base branch: ${String(fetchErr)}`, {});
      }
    } else {
      logger.info(`[worktree] Pinned base SHA ${baseBranch.slice(0, 8)} — skipping branch sync, creating worktree directly from commit`, {});
    }

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
          logger.info(`[worktree] Auto-saved + pushed ${fileCount} uncommitted file(s) for ${storyBranch}`, {});
        } catch (pushErr) {
          logger.warn(`[worktree] Auto-save committed but push failed for ${storyBranch}: ${String(pushErr).slice(0, 150)}`, {});
        }
      }
    }
  } catch (saveErr) {
    logger.warn(`[worktree] Auto-save failed for ${storyBranch}: ${String(saveErr).slice(0, 150)}`, {});
  }

  // 2. Remove node_modules symlink (git worktree remove can't handle symlinks)
  try { fs.unlinkSync(path.join(worktreeDir, "node_modules")); } catch {}

  // 3. Remove worktree + prune
  try { execFileSync("git", ["worktree", "remove", worktreeDir, "--force"], { cwd: repo, timeout: 10000, stdio: "pipe" }); } catch {}
  try { execFileSync("git", ["worktree", "prune"], { cwd: repo, timeout: 5000, stdio: "pipe" }); } catch {}
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
