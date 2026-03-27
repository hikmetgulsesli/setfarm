/**
 * Cleanup Operations
 *
 * Extracted from step-ops.ts — abandoned step cleanup, progress archiving,
 * local branch cleanup, cron teardown scheduling.
 */

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { pgQuery, pgRun, pgGet, now } from "../db-pg.js";
import type { LoopConfig } from "./types.js";
import { logger } from "../lib/logger.js";
import { emitEvent } from "./events.js";
import { teardownWorkflowCronsIfIdle } from "./agent-cron.js";
import {
  BASE_ABANDONED_THRESHOLD_MS,
  FAST_ABANDONED_THRESHOLD_MS,
  SLOW_STEP_IDS,
  SLOW_ABANDONED_THRESHOLD_MS,
  SLOW_FAST_ABANDONED_THRESHOLD_MS,
  MAX_ABANDON_RESETS,
  STEP_STATUS,
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
  getWorkflowId(runId).then((wfId) => {
    if (wfId) {
      teardownWorkflowCronsIfIdle(wfId).catch((err) => {
        logger.error(`Cron teardown failed for workflow ${wfId}: ${String(err)}`, { runId });
      });
    }
  }).catch((e) => {
    logger.debug(`[cleanup] Cron teardown scheduling failed: ${e}`, { runId });
  });
}

// ── Abandoned Step Cleanup ──────────────────────────────────────────

/**
 * Find steps that have been "running" for too long and reset them to pending.
 * This catches cases where an agent claimed a step but never completed/failed it.
 * Exported so it can be called from medic/health-check crons independently of claimStep.
 *
 * Uses advancePipeline callback to avoid circular dependency with step-ops.ts.
 */
export async function cleanupAbandonedSteps(advancePipeline: (runId: string) => Promise<{ advanced: boolean; runCompleted: boolean }> | { advanced: boolean; runCompleted: boolean }): Promise<void> {
    const abandonedSteps = await pgQuery<{
      id: string; step_id: string; run_id: string; retry_count: number; max_retries: number;
      type: string; current_story_id: string | null; loop_config: string | null;
      abandoned_count: number; agent_id: string; updated_at: string;
    }>(
      `SELECT id, step_id, run_id, retry_count, max_retries, type, current_story_id, loop_config, abandoned_count, agent_id, updated_at FROM steps
       WHERE status = 'running' AND (
         (abandoned_count = 0 AND EXTRACT(EPOCH FROM NOW() - updated_at::timestamptz) * 1000 > $1)
         OR (abandoned_count > 0 AND EXTRACT(EPOCH FROM NOW() - updated_at::timestamptz) * 1000 > $2)
       )`,
      [BASE_ABANDONED_THRESHOLD_MS, FAST_ABANDONED_THRESHOLD_MS]
    );

    for (const step of abandonedSteps) {
      const isSlow = SLOW_STEP_IDS.has(step.step_id);
      const baseThreshold = isSlow ? SLOW_ABANDONED_THRESHOLD_MS : BASE_ABANDONED_THRESHOLD_MS;
      const fastThreshold = isSlow ? SLOW_FAST_ABANDONED_THRESHOLD_MS : FAST_ABANDONED_THRESHOLD_MS;
      const elapsedMs = (Date.now() - new Date(step.updated_at).getTime());
      const threshold = step.abandoned_count === 0 ? baseThreshold : fastThreshold;
      if (elapsedMs < threshold) continue;

      if (step.type === "loop" && !step.current_story_id && step.loop_config) {
        try {
          const loopConfig: LoopConfig = JSON.parse(step.loop_config);
          if (loopConfig.verifyEach && loopConfig.verifyStep) {
            const verifyStatus = await pgGet<{ status: string }>(
              "SELECT status FROM steps WHERE run_id = $1 AND step_id = $2 LIMIT 1",
              [step.run_id, loopConfig.verifyStep]
            );
            if (verifyStatus?.status === STEP_STATUS.PENDING || verifyStatus?.status === STEP_STATUS.RUNNING) {
              continue;
            }
          }
        } catch (e) {
          logger.debug(`[cleanup] Malformed loop_config, proceeding with abandonment: ${e}`, { runId: step.run_id });
        }
      }

      if (step.type === "loop" && step.current_story_id) {
        const story = await pgGet<{
          id: string; retry_count: number; max_retries: number; story_id: string;
          title: string; abandoned_count: number; claimed_at: string | null;
        }>(
          "SELECT id, retry_count, max_retries, story_id, title, abandoned_count, claimed_at FROM stories WHERE id = $1",
          [step.current_story_id]
        );

        if (story) {
          try {
            const ctx = await getRunContext(step.run_id);
            const repo = ctx.repo || ctx.REPO;
            if (repo) autoSaveWorktree(repo, story.story_id, step.agent_id);
          } catch (e) {
            logger.warn(`[cleanup] auto-save worktree failed: ${String(e)}`, { runId: step.run_id });
          }

          const newAbandonCount = (story.abandoned_count ?? 0) + 1;
          const wfId = await getWorkflowId(step.run_id);
          const claimedAt = story.claimed_at || step.updated_at;
          const abandonedAt = now();
          const durationMin = Math.round((Date.now() - new Date(claimedAt as string).getTime()) / 60000);

          if (newAbandonCount >= MAX_ABANDON_RESETS) {
            const diagnostic = `ABANDONED: Agent ${step.agent_id} claimed at ${claimedAt}, timed out after ~${durationMin}min. No output produced. Attempt ${newAbandonCount}/${MAX_ABANDON_RESETS}. Limit reached — story failed.`;
            await pgRun("UPDATE stories SET output = $1 WHERE id = $2 AND (output IS NULL OR output = '')", [diagnostic, story.id]);
            await pgRun("UPDATE stories SET status = 'failed', abandoned_count = $1, updated_at = $2 WHERE id = $3", [newAbandonCount, abandonedAt, story.id]);
            await pgRun("UPDATE steps SET status = 'failed', output = 'Story abandoned and abandon limit reached', current_story_id = NULL, updated_at = $1 WHERE id = $2", [abandonedAt, step.id]);
            try { await pgRun("UPDATE claim_log SET outcome = 'abandoned', abandoned_at = $1, duration_ms = $2, diagnostic = $3 WHERE story_id = $4 AND outcome IS NULL", [abandonedAt, durationMin * 60000, diagnostic, story.story_id]); } catch (e) { logger.warn("[cleanup] claim_log update failed: " + String(e), { runId: step.run_id }); }
            await failRun(step.run_id);
            emitEvent({ ts: now(), event: "story.failed", runId: step.run_id, workflowId: wfId, stepId: step.step_id, storyId: story.story_id, storyTitle: story.title, detail: `Abandoned — ${diagnostic}` });
            emitEvent({ ts: now(), event: "step.failed", runId: step.run_id, workflowId: wfId, stepId: step.step_id, detail: "Story abandoned and abandon limit reached" });
            emitEvent({ ts: now(), event: "run.failed", runId: step.run_id, workflowId: wfId, detail: "Story abandoned and abandon limit reached" });
            scheduleRunCronTeardown(step.run_id);
          } else {
            const diagnostic = `ABANDONED: Agent ${step.agent_id} claimed at ${claimedAt}, timed out after ~${durationMin}min. No output produced. Attempt ${newAbandonCount}/${MAX_ABANDON_RESETS}.`;
            await pgRun("UPDATE stories SET output = $1 WHERE id = $2 AND (output IS NULL OR output = '')", [diagnostic, story.id]);
            await pgRun("UPDATE stories SET status = 'pending', abandoned_count = $1, updated_at = $2 WHERE id = $3", [newAbandonCount, abandonedAt, story.id]);
            await pgRun("UPDATE steps SET status = 'pending', current_story_id = NULL, abandoned_count = $1, updated_at = $2 WHERE id = $3", [newAbandonCount, abandonedAt, step.id]);
            try { await pgRun("UPDATE claim_log SET outcome = 'abandoned', abandoned_at = $1, duration_ms = $2, diagnostic = $3 WHERE story_id = $4 AND outcome IS NULL", [abandonedAt, durationMin * 60000, diagnostic, story.story_id]); } catch (e) { logger.warn("[cleanup] claim_log update failed: " + String(e), { runId: step.run_id }); }
            emitEvent({ ts: now(), event: "step.timeout", runId: step.run_id, workflowId: wfId, stepId: step.step_id, detail: `Story ${story.story_id} abandoned — ${diagnostic}` });
            logger.info(`Abandoned step reset to pending (story abandon ${newAbandonCount})`, { runId: step.run_id, stepId: step.step_id });
          }
          continue;
        }
      }

      // Single steps
      const newAbandonCount = (step.abandoned_count ?? 0) + 1;
      const singleDiagnostic = `ABANDONED: Agent ${step.agent_id} timed out. No completion signal received. Attempt ${newAbandonCount}/${MAX_ABANDON_RESETS}.`;

      if (newAbandonCount >= MAX_ABANDON_RESETS) {
        await pgRun("UPDATE steps SET status = 'failed', output = $1, abandoned_count = $2, updated_at = $3 WHERE id = $4", [singleDiagnostic, newAbandonCount, now(), step.id]);
        await pgRun("UPDATE runs SET status = 'failed', updated_at = $1 WHERE id = $2", [now(), step.run_id]);
        try { await pgRun("UPDATE claim_log SET outcome = 'abandoned', abandoned_at = $1, diagnostic = $2 WHERE run_id = $3 AND step_id = $4 AND outcome IS NULL", [now(), singleDiagnostic, step.run_id, step.step_id]); } catch (e) { logger.warn("[cleanup] claim_log update failed: " + String(e), { runId: step.run_id }); }
        const wfId = await getWorkflowId(step.run_id);
        emitEvent({ ts: now(), event: "step.timeout", runId: step.run_id, workflowId: wfId, stepId: step.step_id, detail: `Retries exhausted — ${singleDiagnostic}` });
        emitEvent({ ts: now(), event: "step.failed", runId: step.run_id, workflowId: wfId, stepId: step.step_id, detail: singleDiagnostic });
        emitEvent({ ts: now(), event: "run.failed", runId: step.run_id, workflowId: wfId, detail: "Step abandoned and retries exhausted" });
        scheduleRunCronTeardown(step.run_id);
      } else {
        await pgRun("UPDATE steps SET status = 'pending', abandoned_count = $1, updated_at = $2 WHERE id = $3", [newAbandonCount, now(), step.id]);
        try { await pgRun("UPDATE claim_log SET outcome = 'abandoned', abandoned_at = $1, diagnostic = $2 WHERE run_id = $3 AND step_id = $4 AND outcome IS NULL", [now(), singleDiagnostic, step.run_id, step.step_id]); } catch (e) { logger.warn("[cleanup] claim_log update failed: " + String(e), { runId: step.run_id }); }
        emitEvent({ ts: now(), event: "step.timeout", runId: step.run_id, workflowId: await getWorkflowId(step.run_id), stepId: step.step_id, detail: `Reset to pending — ${singleDiagnostic}` });
      }
    }

    // Reset running stories that are abandoned
    const abandonedStories = await pgQuery<{ id: string; retry_count: number; max_retries: number; run_id: string }>(
      "SELECT id, retry_count, max_retries, run_id FROM stories WHERE status = 'running' AND EXTRACT(EPOCH FROM NOW() - updated_at::timestamptz) * 1000 > $1",
      [BASE_ABANDONED_THRESHOLD_MS]
    );

    for (const story of abandonedStories) {
      await pgRun("UPDATE stories SET status = 'pending', abandoned_count = abandoned_count + 1, updated_at = $1 WHERE id = $2", [now(), story.id]);
    }

    // Recover stuck pipelines
    const stuckLoops = await pgQuery<{ id: string; run_id: string; step_index: number }>(
      `SELECT s.id, s.run_id, s.step_index FROM steps s
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
       )`
    );

    for (const stuck of stuckLoops) {
      logger.info(`Recovering stuck pipeline after loop completion`, { runId: stuck.run_id, stepId: stuck.id });
      await advancePipeline(stuck.run_id);
    }

    // Recover stuck verify_each
    const stuckVerify = await pgQuery<{ id: string; run_id: string; step_id: string; loop_config: string }>(
      `SELECT s.id, s.run_id, s.step_id, ls.loop_config FROM steps s
       JOIN runs r ON r.id = s.run_id
       JOIN steps ls ON ls.run_id = s.run_id AND ls.type = 'loop'
       WHERE r.status = 'running'
       AND s.status = 'waiting'
       AND ls.loop_config IS NOT NULL
       AND EXISTS (
         SELECT 1 FROM stories st WHERE st.run_id = s.run_id AND st.status = 'done'
       )`
    );

    for (const sv of stuckVerify) {
      try {
        const lc = JSON.parse(sv.loop_config);
        if (lc.verifyEach && lc.verifyStep === sv.step_id) {
          await pgRun("UPDATE steps SET status = 'pending', updated_at = $1 WHERE id = $2", [now(), sv.id]);
          logger.info(`[cleanup] Recovered stuck verify_each step ${sv.step_id} — done stories awaiting verification`, { runId: sv.run_id });
        }
      } catch (e) { logger.debug(`[cleanup] Skipping stuck verify with malformed loop_config: ${e}`, { runId: sv.run_id }); }
    }
}

// ── Progress Archiving ──────────────────────────────────────────────

export async function archiveRunProgress(runId: string): Promise<void> {
  const loopStep = await pgGet<{ agent_id: string }>(
    "SELECT agent_id FROM steps WHERE run_id = $1 AND type = 'loop' LIMIT 1", [runId]
  );
  if (!loopStep) return;

  const workspace = getAgentWorkspacePath(loopStep.agent_id);
  if (!workspace) return;

  const scopedPath = path.join(workspace, `progress-${runId}.txt`);
  if (!fs.existsSync(scopedPath)) return;

  const archiveDir = path.join(workspace, "archive", runId);
  fs.mkdirSync(archiveDir, { recursive: true });
  fs.copyFileSync(scopedPath, path.join(archiveDir, "progress.txt"));
  fs.unlinkSync(scopedPath);
}

// ── Local Branch Cleanup ────────────────────────────────────────────

/**
 * Clean up leftover local git branches when a run completes.
 * Switches to main and deletes all other branches.
 */
export async function cleanupLocalBranches(runId: string): Promise<void> {
  try {
    const context = await getRunContext(runId);
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
