/**
 * Pipeline Advancement (step-advance.ts)
 *
 * Extracted from step-ops.ts — advancePipeline() finds the next waiting step
 * and activates it, or completes the run. checkLoopContinuation() manages
 * the story loop lifecycle.
 */

import { getDb } from "../db.js";
import { logger } from "../lib/logger.js";
import type { LoopConfig } from "./types.js";
import { emitEvent } from "./events.js";
import {
  getRunStatus, getWorkflowId, completeRun, failRun,
  findStoryByStatus, skipFailedStories, countAllStories,
  setStepStatus,
} from "./repo.js";
import { archiveRunProgress, scheduleRunCronTeardown, cleanupLocalBranches } from "./cleanup-ops.js";
import { cleanupWorktrees } from "./worktree-ops.js";
import { RUN_STATUS, STEP_STATUS, STORY_STATUS } from "./constants.js";

// ── advancePipeline ──────────────────────────────────────────────────

/**
 * Advance the pipeline: find the next waiting step and make it pending, or complete the run.
 * Respects terminal run states — a failed run cannot be advanced or completed.
 */
export function advancePipeline(runId: string): { advanced: boolean; runCompleted: boolean } {
  const db = getDb();

  // Guard: don't advance or complete a run that's already failed/cancelled
  const runSt = getRunStatus(runId);
  if (runSt === RUN_STATUS.FAILED || runSt === RUN_STATUS.CANCELLED) {
    return { advanced: false, runCompleted: false };
  }

  // BEGIN IMMEDIATE prevents concurrent crons from double-advancing
  db.exec("BEGIN IMMEDIATE");
  try {
    const next = db.prepare(
      "SELECT id, step_id, step_index FROM steps WHERE run_id = ? AND status = 'waiting' ORDER BY step_index ASC LIMIT 1"
    ).get(runId) as { id: string; step_id: string; step_index: number } | undefined;

    const incomplete = db.prepare(
      "SELECT id FROM steps WHERE run_id = ? AND status IN ('failed', 'pending', 'running') LIMIT 1"
    ).get(runId) as { id: string } | undefined;

    if (!next && incomplete) {
      db.exec("COMMIT");
      return { advanced: false, runCompleted: false };
    }

    const wfId = getWorkflowId(runId);
    if (next) {
      // Guard: don't advance past steps that are still running or pending
      const priorIncomplete = db.prepare(
        "SELECT id FROM steps WHERE run_id = ? AND step_index < ? AND status IN ('running', 'pending') LIMIT 1"
      ).get(runId, next.step_index) as { id: string } | undefined;
      if (priorIncomplete) {
        db.exec("COMMIT");
        return { advanced: false, runCompleted: false };
      }
      db.prepare(
        "UPDATE steps SET status = 'pending', updated_at = ? WHERE id = ?"
      ).run(new Date().toISOString(), next.id);
      db.exec("COMMIT");
      emitEvent({ ts: new Date().toISOString(), event: "pipeline.advanced", runId, workflowId: wfId, stepId: next.step_id });
      emitEvent({ ts: new Date().toISOString(), event: "step.pending", runId, workflowId: wfId, stepId: next.step_id });
      return { advanced: true, runCompleted: false };
    } else {
      completeRun(runId);
      db.exec("COMMIT");
      emitEvent({ ts: new Date().toISOString(), event: "run.completed", runId, workflowId: wfId });
      logger.info("Run completed", { runId, workflowId: wfId });
      archiveRunProgress(runId);
      cleanupWorktrees(runId);
      cleanupLocalBranches(runId);
      scheduleRunCronTeardown(runId);
      return { advanced: false, runCompleted: true };
    }
  } catch (err) {
    try { db.exec("ROLLBACK"); } catch (e) { logger.warn(`[step-advance] ROLLBACK failed: ${String(e)}`, {}); }
    throw err;
  }
}

// ── checkLoopContinuation ────────────────────────────────────────────

/**
 * Check if the loop has more stories; if so set loop step pending, otherwise done + advance.
 */
export function checkLoopContinuation(runId: string, loopStepId: string): { advanced: boolean; runCompleted: boolean } {
  const db = getDb();
  const pendingStory = findStoryByStatus(runId, "pending") as { id: string } | undefined;

  const loopStatus = db.prepare(
    "SELECT status FROM steps WHERE id = ?"
  ).get(loopStepId) as { status: string } | undefined;

  if (pendingStory) {
    if (loopStatus?.status === STEP_STATUS.FAILED) {
      return { advanced: false, runCompleted: false };
    }
    // More stories pending — keep step available for parallel claims
    // Only set to pending if not already running (don't interrupt parallel stories)
    if (loopStatus?.status !== STEP_STATUS.RUNNING) {
      db.prepare(
        "UPDATE steps SET status = 'pending', updated_at = ? WHERE id = ?"
      ).run(new Date().toISOString(), loopStepId);
    }
    return { advanced: false, runCompleted: false };
  }

  // No pending stories — check if any are still running (parallel execution)
  const runningStory = findStoryByStatus(runId, "running") as { id: string } | undefined;

  if (runningStory) {
    // Other stories still running in parallel — wait for them
    return { advanced: false, runCompleted: false };
  }

  // BUG FIX: Check for unverified 'done' stories — these still need verify_each processing.
  // Without this check, parallel story completion causes the loop to end prematurely,
  // leaving stories implemented but never verified/merged.
  const loopStepConfig = db.prepare("SELECT loop_config FROM steps WHERE id = ?").get(loopStepId) as { loop_config: string | null } | undefined;
  if (loopStepConfig?.loop_config) {
    const lcForCheck: LoopConfig = JSON.parse(loopStepConfig.loop_config);
    if (lcForCheck.verifyEach && lcForCheck.verifyStep) {
      const unverifiedStory = findStoryByStatus(runId, "done") as { id: string } | undefined;
      if (unverifiedStory) {
        // Stories need verification — set verify step to pending
        db.prepare(
          "UPDATE steps SET status = 'pending', updated_at = ? WHERE run_id = ? AND step_id = ? AND status IN ('waiting', 'done')"
        ).run(new Date().toISOString(), runId, lcForCheck.verifyStep);
        logger.info(`Loop has unverified stories — keeping verify active`, { runId });
        return { advanced: false, runCompleted: false };
      }
    }
  }

  const failedStory = findStoryByStatus(runId, "failed") as { id: string } | undefined;

  if (failedStory) {
    // v9.0: Skip failed stories instead of failing the loop — let remaining stories continue
    skipFailedStories(runId);
    const wfId = getWorkflowId(runId);
    emitEvent({ ts: new Date().toISOString(), event: "story.skipped", runId, workflowId: wfId, stepId: loopStepId, detail: "Failed stories skipped — loop continues" });
    // Fall through to mark loop done
  }

  // All stories verified/skipped — mark loop step done
  // Generate summary output for the loop step
  const loopSummaryStories = db.prepare(
    "SELECT story_id, status FROM stories WHERE run_id = ? ORDER BY story_index ASC"
  ).all(runId) as Array<{ story_id: string; status: string }>;
  const verifiedCount = loopSummaryStories.filter(s => s.status === STORY_STATUS.VERIFIED).length;
  const skippedCount = loopSummaryStories.filter(s => s.status === STORY_STATUS.SKIPPED).length;
  const failedCount = loopSummaryStories.filter(s => s.status === STORY_STATUS.FAILED).length;
  const totalCount = loopSummaryStories.length;
  const loopSummaryOutput = `STATUS: done
STORIES_TOTAL: ${totalCount}
STORIES_VERIFIED: ${verifiedCount}
STORIES_SKIPPED: ${skippedCount}
STORIES_FAILED: ${failedCount}
SUMMARY: ${verifiedCount}/${totalCount} stories verified, ${skippedCount} skipped, ${failedCount} failed`;

  // Early worktree cleanup: clean up .worktrees when implement loop finishes,
  // not just when the entire run completes. Prevents stale worktree accumulation.
  cleanupWorktrees(runId);
  db.prepare(
    "UPDATE steps SET status = 'done', output = ?, updated_at = ? WHERE id = ?"
  ).run(loopSummaryOutput, new Date().toISOString(), loopStepId);

  // Also mark verify step done if it exists (with summary output)
  const loopStep = db.prepare("SELECT loop_config, run_id FROM steps WHERE id = ?").get(loopStepId) as { loop_config: string | null; run_id: string } | undefined;
  if (loopStep?.loop_config) {
    const lc: LoopConfig = JSON.parse(loopStep.loop_config);
    if (lc.verifyEach && lc.verifyStep) {
      const verifySummary = `STATUS: done
VERIFICATION_SUMMARY: ${verifiedCount}/${totalCount} stories verified`;
      db.prepare(
        "UPDATE steps SET status = 'done', output = ?, updated_at = ? WHERE run_id = ? AND step_id = ?"
      ).run(verifySummary, new Date().toISOString(), runId, lc.verifyStep);
    }
  }

  return advancePipeline(runId);
}
