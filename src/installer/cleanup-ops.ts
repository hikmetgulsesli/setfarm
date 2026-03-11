/**
 * Cleanup Operations
 *
 * Extracted from step-ops.ts — abandoned step cleanup, progress archiving,
 * local branch cleanup, cron teardown scheduling.
 */

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { getDb } from "../db.js";
import type { LoopConfig } from "./types.js";
import { logger } from "../lib/logger.js";
import { emitEvent } from "./events.js";
import { teardownWorkflowCronsIfIdle } from "./agent-cron.js";
import {
  BASE_ABANDONED_THRESHOLD_MS,
  FAST_ABANDONED_THRESHOLD_MS,
  MAX_ABANDON_RESETS,
} from "./constants.js";
import { autoSaveWorktree } from "./worktree-ops.js";
import { getWorkflowId, getRunContext, failRun } from "./repo.js";
import { getAgentWorkspacePath } from "./worktree-ops.js";

// ── Helper ──────────────────────────────────────────────────────────

/**
 * Fire-and-forget cron teardown when a run ends.
 * Looks up the workflow_id for the run and tears down crons if no other active runs.
 */
export function scheduleRunCronTeardown(runId: string): void {
  try {
    const wfId = getWorkflowId(runId);
    if (wfId) {
      teardownWorkflowCronsIfIdle(wfId).catch((err) => {
        logger.error(`Cron teardown failed for workflow ${wfId}: ${String(err)}`, { runId });
      });
    }
  } catch {
    // best-effort
  }
}

// ── Abandoned Step Cleanup ──────────────────────────────────────────

/**
 * Find steps that have been "running" for too long and reset them to pending.
 * This catches cases where an agent claimed a step but never completed/failed it.
 * Exported so it can be called from medic/health-check crons independently of claimStep.
 *
 * Uses advancePipeline callback to avoid circular dependency with step-ops.ts.
 */
export function cleanupAbandonedSteps(advancePipeline: (runId: string) => { advanced: boolean; runCompleted: boolean }): void {
  const db = getDb();
  // Use numeric comparison so mixed timestamp formats don't break ordering.
  // Find running steps that haven't been updated recently
  // Progressive threshold: first abandon uses base timeout, subsequent uses faster threshold
  const abandonedSteps = db.prepare(
    `SELECT id, step_id, run_id, retry_count, max_retries, type, current_story_id, loop_config, abandoned_count, agent_id FROM steps
     WHERE status = 'running' AND (
       (abandoned_count = 0 AND (julianday('now') - julianday(updated_at)) * 86400000 > ?)
       OR (abandoned_count > 0 AND (julianday('now') - julianday(updated_at)) * 86400000 > ?)
     )`
  ).all(BASE_ABANDONED_THRESHOLD_MS, FAST_ABANDONED_THRESHOLD_MS) as { id: string; step_id: string; run_id: string; retry_count: number; max_retries: number; type: string; current_story_id: string | null; loop_config: string | null; abandoned_count: number; agent_id: string }[];

  for (const step of abandonedSteps) {
    if (step.type === "loop" && !step.current_story_id && step.loop_config) {
      try {
        const loopConfig: LoopConfig = JSON.parse(step.loop_config);
        if (loopConfig.verifyEach && loopConfig.verifyStep) {
          const verifyStatus = db.prepare(
            "SELECT status FROM steps WHERE run_id = ? AND step_id = ? LIMIT 1"
          ).get(step.run_id, loopConfig.verifyStep) as { status: string } | undefined;
          if (verifyStatus?.status === "pending" || verifyStatus?.status === "running") {
            continue;
          }
        }
      } catch {
        // If loop config is malformed, fall through to abandonment handling.
      }
    }

    // Item 8: Loop steps — use abandoned_count, NOT retry_count (abandonment != agent failure)
    if (step.type === "loop" && step.current_story_id) {
      const story = db.prepare(
        "SELECT id, retry_count, max_retries, story_id, title, abandoned_count FROM stories WHERE id = ?"
      ).get(step.current_story_id) as { id: string; retry_count: number; max_retries: number; story_id: string; title: string; abandoned_count: number } | undefined;

      if (story) {
        // Auto-save uncommitted worktree changes before resetting story
        try {
          const ctx = getRunContext(step.run_id);
          const repo = ctx.repo || ctx.REPO;
          if (repo) autoSaveWorktree(repo, story.story_id, step.agent_id);
        } catch {
          // Best effort — don't block abandon handling
        }

        const newAbandonCount = (story.abandoned_count ?? 0) + 1;
        const wfId = getWorkflowId(step.run_id);
        if (newAbandonCount >= MAX_ABANDON_RESETS) {
          db.prepare("UPDATE stories SET status = 'failed', abandoned_count = ?, updated_at = ? WHERE id = ?").run(newAbandonCount, new Date().toISOString(), story.id);
          db.prepare("UPDATE steps SET status = 'failed', output = 'Story abandoned and abandon limit reached', current_story_id = NULL, updated_at = ? WHERE id = ?").run(new Date().toISOString(), step.id);
          failRun(step.run_id);
          emitEvent({ ts: new Date().toISOString(), event: "story.failed", runId: step.run_id, workflowId: wfId, stepId: step.step_id, storyId: story.story_id, storyTitle: story.title, detail: `Abandoned — abandon limit reached (${newAbandonCount}/${MAX_ABANDON_RESETS})` });
          emitEvent({ ts: new Date().toISOString(), event: "step.failed", runId: step.run_id, workflowId: wfId, stepId: step.step_id, detail: "Story abandoned and abandon limit reached" });
          emitEvent({ ts: new Date().toISOString(), event: "run.failed", runId: step.run_id, workflowId: wfId, detail: "Story abandoned and abandon limit reached" });
          scheduleRunCronTeardown(step.run_id);
        } else {
          db.prepare("UPDATE stories SET status = 'pending', abandoned_count = ?, updated_at = ? WHERE id = ?").run(newAbandonCount, new Date().toISOString(), story.id);
          db.prepare("UPDATE steps SET status = 'pending', current_story_id = NULL, abandoned_count = ?, updated_at = ? WHERE id = ?").run(newAbandonCount, new Date().toISOString(), step.id);
          emitEvent({ ts: new Date().toISOString(), event: "step.timeout", runId: step.run_id, workflowId: wfId, stepId: step.step_id, detail: `Story ${story.story_id} abandoned — reset to pending (abandon ${newAbandonCount}/${MAX_ABANDON_RESETS})` });
          logger.info(`Abandoned step reset to pending (story abandon ${newAbandonCount})`, { runId: step.run_id, stepId: step.step_id });
        }
        continue;
      }
    }

    // Single steps (or loop steps without a current story): use abandoned_count, not retry_count
    const newAbandonCount = (step.abandoned_count ?? 0) + 1;
    if (newAbandonCount >= MAX_ABANDON_RESETS) {
      // Too many abandons — fail the step and run
      db.prepare(
        "UPDATE steps SET status = 'failed', output = 'Agent abandoned step without completing (' || ? || ' times)', abandoned_count = ?, updated_at = ? WHERE id = ?"
      ).run(newAbandonCount, newAbandonCount, new Date().toISOString(), step.id);
      db.prepare(
        "UPDATE runs SET status = 'failed', updated_at = ? WHERE id = ?"
      ).run(new Date().toISOString(), step.run_id);
      const wfId = getWorkflowId(step.run_id);
      emitEvent({ ts: new Date().toISOString(), event: "step.timeout", runId: step.run_id, workflowId: wfId, stepId: step.step_id, detail: `Retries exhausted — step failed` });
      emitEvent({ ts: new Date().toISOString(), event: "step.failed", runId: step.run_id, workflowId: wfId, stepId: step.step_id, detail: "Agent abandoned step without completing" });
      emitEvent({ ts: new Date().toISOString(), event: "run.failed", runId: step.run_id, workflowId: wfId, detail: "Step abandoned and retries exhausted" });
      scheduleRunCronTeardown(step.run_id);
    } else {
      // Reset to pending for retry — do NOT increment retry_count (abandonment != explicit failure)
      db.prepare(
        "UPDATE steps SET status = 'pending', abandoned_count = ?, updated_at = ? WHERE id = ?"
      ).run(newAbandonCount, new Date().toISOString(), step.id);
      emitEvent({ ts: new Date().toISOString(), event: "step.timeout", runId: step.run_id, workflowId: getWorkflowId(step.run_id), stepId: step.step_id, detail: `Reset to pending (abandon ${newAbandonCount}/${MAX_ABANDON_RESETS})` });
    }
  }

  // Reset running stories that are abandoned — don't touch "done" stories
  const abandonedStories = db.prepare(
    "SELECT id, retry_count, max_retries, run_id FROM stories WHERE status = 'running' AND (julianday('now') - julianday(updated_at)) * 86400000 > ?"
  ).all(BASE_ABANDONED_THRESHOLD_MS) as { id: string; retry_count: number; max_retries: number; run_id: string }[];

  for (const story of abandonedStories) {
    db.prepare("UPDATE stories SET status = 'pending', abandoned_count = abandoned_count + 1, updated_at = ? WHERE id = ?").run(new Date().toISOString(), story.id);
  }

  // Recover stuck pipelines: loop step done but no subsequent step pending/running
  const stuckLoops = db.prepare(`
    SELECT s.id, s.run_id, s.step_index FROM steps s
    JOIN runs r ON r.id = s.run_id
    WHERE s.type = 'loop' AND s.status = 'done' AND r.status = 'running'
    AND NOT EXISTS (
      SELECT 1 FROM steps s2 WHERE s2.run_id = s.run_id
      AND s2.step_index > s.step_index
      AND s2.status IN ('pending', 'running')
    )
    AND EXISTS (
      SELECT 1 FROM steps s3 WHERE s3.run_id = s.run_id
      AND s3.step_index > s.step_index
      AND s3.status = 'waiting'
    )
  `).all() as { id: string; run_id: string; step_index: number }[];

  for (const stuck of stuckLoops) {
    logger.info(`Recovering stuck pipeline after loop completion`, { runId: stuck.run_id, stepId: stuck.id });
    advancePipeline(stuck.run_id);
  }

  // Recover stuck verify_each: verify step is 'waiting' but 'done' stories exist that need verification
  const stuckVerify = db.prepare(`
    SELECT s.id, s.run_id, s.step_id, ls.loop_config FROM steps s
    JOIN runs r ON r.id = s.run_id
    JOIN steps ls ON ls.run_id = s.run_id AND ls.type = 'loop'
    WHERE r.status = 'running'
    AND s.status = 'waiting'
    AND ls.loop_config IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM stories st WHERE st.run_id = s.run_id AND st.status = 'done'
    )
  `).all() as { id: string; run_id: string; step_id: string; loop_config: string }[];

  for (const sv of stuckVerify) {
    try {
      const lc = JSON.parse(sv.loop_config);
      if (lc.verifyEach && lc.verifyStep === sv.step_id) {
        db.prepare("UPDATE steps SET status = 'pending', updated_at = ? WHERE id = ?")
          .run(new Date().toISOString(), sv.id);
        logger.info(`[cleanup] Recovered stuck verify_each step ${sv.step_id} — done stories awaiting verification`, { runId: sv.run_id });
      }
    } catch { /* malformed loop_config */ }
  }
}

// ── Progress Archiving ──────────────────────────────────────────────

export function archiveRunProgress(runId: string): void {
  const db = getDb();
  const loopStep = db.prepare(
    "SELECT agent_id FROM steps WHERE run_id = ? AND type = 'loop' LIMIT 1"
  ).get(runId) as { agent_id: string } | undefined;
  if (!loopStep) return;

  const workspace = getAgentWorkspacePath(loopStep.agent_id);
  if (!workspace) return;

  const scopedPath = path.join(workspace, `progress-${runId}.txt`);
  const progressPath = scopedPath;
  if (!fs.existsSync(progressPath)) return;

  const archiveDir = path.join(workspace, "archive", runId);
  fs.mkdirSync(archiveDir, { recursive: true });
  fs.copyFileSync(progressPath, path.join(archiveDir, "progress.txt"));
  fs.unlinkSync(progressPath); // clean up
}

// ── Local Branch Cleanup ────────────────────────────────────────────

/**
 * Clean up leftover local git branches when a run completes.
 * Switches to main and deletes all other branches.
 */
export function cleanupLocalBranches(runId: string): void {
  try {
    const context = getRunContext(runId);
    const repo = context.repo;
    if (!repo) return;

    // Switch to main first
    try {
      execFileSync("git", ["checkout", "main"], { cwd: repo, timeout: 10_000, stdio: "pipe" });
    } catch {
      logger.warn(`[branch-cleanup] Could not checkout main in ${repo}`, {});
      return;
    }

    // List all branches except main
    try {
      const result = execFileSync("git", ["branch", "--format=%(refname:short)"], { cwd: repo, timeout: 10_000, stdio: "pipe" });
      const branches = result.toString().trim().split("\n").filter(b => b && b !== "main");
      for (const branch of branches) {
        try {
          execFileSync("git", ["branch", "-D", branch.trim()], { cwd: repo, timeout: 5_000, stdio: "pipe" });
        } catch (err) { logger.warn(`[cleanup] ${String(err)}`, {}); }
      }
      if (branches.length > 0) {
        logger.info(`[branch-cleanup] Deleted ${branches.length} stale branches for run ${runId}`, {});
      }
    } catch (err) { logger.warn(`[cleanup] ${String(err)}`, {}); }

    // Prune remote tracking branches
    try {
      execFileSync("git", ["fetch", "--prune"], { cwd: repo, timeout: 15_000, stdio: "pipe" });
    } catch (err) { logger.warn(`[cleanup] ${String(err)}`, {}); }
  } catch (err) {
    logger.warn(`[branch-cleanup] Failed for run ${runId}: ${err}`, {});
  }
}
