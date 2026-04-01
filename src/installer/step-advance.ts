/**
 * Pipeline Advancement (step-advance.ts)
 *
 * Extracted from step-ops.ts — advancePipeline() finds the next waiting step
 * and activates it, or completes the run. checkLoopContinuation() manages
 * the story loop lifecycle.
 */

import { pgGet, pgQuery, pgRun, pgExec, pgBegin, now } from "../db-pg.js";
import { logger } from "../lib/logger.js";
import type { LoopConfig } from "./types.js";
import { emitEvent } from "./events.js";
import {
  getRunStatus, getWorkflowId, completeRun,
  findStoryByStatus, skipFailedStories,
} from "./repo.js";
import { archiveRunProgress, scheduleRunCronTeardown, cleanupLocalBranches } from "./cleanup-ops.js";
import { cleanupWorktrees, cleanAgentWorkspace } from "./worktree-ops.js";
import { RUN_STATUS, STEP_STATUS, STORY_STATUS } from "./constants.js";
import { syncActiveCrons } from "./agent-cron.js";

// ── advancePipeline ──────────────────────────────────────────────────

/**
 * Advance the pipeline: find the next waiting step and make it pending, or complete the run.
 * Respects terminal run states — a failed run cannot be advanced or completed.
 */
export async function advancePipeline(runId: string): Promise<{ advanced: boolean; runCompleted: boolean }> {
  // Guard: don't advance or complete a run that's already failed/cancelled
  const runSt = await getRunStatus(runId);
  if (runSt === RUN_STATUS.FAILED || runSt === RUN_STATUS.CANCELLED) {
    return { advanced: false, runCompleted: false };
  }

  return await pgBegin(async (sql) => {
    const nextRows = await sql.unsafe(
      "SELECT id, step_id, step_index FROM steps WHERE run_id = $1 AND status = 'waiting' ORDER BY step_index ASC LIMIT 1",
      [runId]
    );
    const next = nextRows[0] as unknown as { id: string; step_id: string; step_index: number } | undefined;

    const incompleteRows = await sql.unsafe(
      "SELECT id FROM steps WHERE run_id = $1 AND status IN ('failed', 'pending', 'running') LIMIT 1",
      [runId]
    );
    const incomplete = incompleteRows[0] as unknown as { id: string } | undefined;

    if (!next && incomplete) {
      return { advanced: false, runCompleted: false };
    }

    const wfId = await getWorkflowId(runId);
    if (next) {
      // Guard: don't advance past steps that are still running or pending
      const priorRows = await sql.unsafe(
        "SELECT id FROM steps WHERE run_id = $1 AND step_index < $2 AND status IN ('running', 'pending') LIMIT 1",
        [runId, next.step_index]
      );
      if (priorRows[0]) {
        return { advanced: false, runCompleted: false };
      }
      await sql.unsafe(
        "UPDATE steps SET status = 'pending', updated_at = $1 WHERE id = $2",
        [now(), next.id]
      );
      emitEvent({ ts: now(), event: "pipeline.advanced", runId, workflowId: wfId, stepId: next.step_id });
      emitEvent({ ts: now(), event: "step.pending", runId, workflowId: wfId, stepId: next.step_id });
      // Demand-based crons + event-driven NOTIFY
      setTimeout(async () => {
        try {
          await syncActiveCrons(runId, wfId || "");
        } catch (e) {
          logger.warn(`[advance] syncActiveCrons failed: ${String(e)}`, {});
        }
        // NOTIFY spawner daemon about new pending step
        try {
          const { pgRun } = await import("../db-pg.js");
          await pgRun("SELECT pg_notify(step_pending, $1)", [JSON.stringify({ agentId: next.step_id, runId, stepId: next.step_id })]);
        } catch {}
      }, 2000);
      return { advanced: true, runCompleted: false };
    } else {
      await completeRun(runId);
      emitEvent({ ts: now(), event: "run.completed", runId, workflowId: wfId });
      logger.info("Run completed", { runId, workflowId: wfId });
      await archiveRunProgress(runId);
      await cleanupWorktrees(runId);
      await cleanupLocalBranches(runId);
      // Clean agent workspaces of project files from this run
      try {
        const agentRows = await sql.unsafe("SELECT DISTINCT agent_id FROM steps WHERE run_id = $1", [runId]);
        for (const row of agentRows) {
          cleanAgentWorkspace((row as any).agent_id);
        }
      } catch (e) { logger.warn(`[advance] Workspace cleanup failed: ${String(e)}`, {}); }
      scheduleRunCronTeardown(runId);
      return { advanced: false, runCompleted: true };
    }
  });
}

// ── checkLoopContinuation ────────────────────────────────────────────

/**
 * Check if the loop has more stories; if so set loop step pending, otherwise done + advance.
 */
export async function checkLoopContinuation(runId: string, loopStepId: string): Promise<{ advanced: boolean; runCompleted: boolean }> {
  const pendingStory = await findStoryByStatus(runId, "pending") as { id: string } | undefined;

  const loopStatus = await pgGet<{ status: string }>(
    "SELECT status FROM steps WHERE id = $1", [loopStepId]
  );

  if (pendingStory) {
    if (loopStatus?.status === STEP_STATUS.FAILED) {
      return { advanced: false, runCompleted: false };
    }
    if (loopStatus?.status !== STEP_STATUS.RUNNING) {
      await pgRun(
        "UPDATE steps SET status = 'pending', updated_at = $1 WHERE id = $2",
        [now(), loopStepId]
      );
    }
    return { advanced: false, runCompleted: false };
  }

  // No pending stories — check if any are still running (parallel execution)
  const runningStory = await findStoryByStatus(runId, "running") as { id: string } | undefined;
  if (runningStory) {
    return { advanced: false, runCompleted: false };
  }

  // BUG FIX: Check for unverified 'done' stories
  const loopStepConfig = await pgGet<{ loop_config: string | null }>(
    "SELECT loop_config FROM steps WHERE id = $1", [loopStepId]
  );
  if (loopStepConfig?.loop_config) {
    const lcForCheck: LoopConfig = JSON.parse(loopStepConfig.loop_config);
    if (lcForCheck.verifyEach && lcForCheck.verifyStep) {
      const unverifiedStory = await findStoryByStatus(runId, "done") as { id: string } | undefined;
      if (unverifiedStory) {
        await pgRun(
          "UPDATE steps SET status = 'pending', updated_at = $1 WHERE run_id = $2 AND step_id = $3 AND status IN ('waiting', 'done')",
          [now(), runId, lcForCheck.verifyStep]
        );
        logger.info(`Loop has unverified stories — keeping verify active`, { runId });
        return { advanced: false, runCompleted: false };
      }
    }
  }

  const failedStory = await findStoryByStatus(runId, "failed") as { id: string } | undefined;
  if (failedStory) {
    await skipFailedStories(runId);
    const wfId = await getWorkflowId(runId);
    emitEvent({ ts: now(), event: "story.skipped", runId, workflowId: wfId, stepId: loopStepId, detail: "Failed stories skipped — loop continues" });
  }

  // All stories verified/skipped — mark loop step done
  const loopSummaryStories = await pgQuery<{ story_id: string; status: string }>(
    "SELECT story_id, status FROM stories WHERE run_id = $1 ORDER BY story_index ASC", [runId]
  );
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

  // Early worktree cleanup
  await cleanupWorktrees(runId);

  // Atomic: mark loop done + verify done must happen together
  await pgBegin(async (sql) => {
    await sql.unsafe(
      "UPDATE steps SET status = 'done', output = $1, updated_at = $2 WHERE id = $3",
      [loopSummaryOutput, now(), loopStepId]
    );

    // Also mark verify step done if it exists
    const loopStepRow = await sql.unsafe(
      "SELECT loop_config, run_id FROM steps WHERE id = $1", [loopStepId]
    );
    const loopStep = loopStepRow[0] as unknown as { loop_config: string | null; run_id: string } | undefined;
    if (loopStep?.loop_config) {
      const lc: LoopConfig = JSON.parse(loopStep.loop_config);
      if (lc.verifyEach && lc.verifyStep) {
        const verifySummary = `STATUS: done
VERIFICATION_SUMMARY: ${verifiedCount}/${totalCount} stories verified`;
        await sql.unsafe(
          "UPDATE steps SET status = 'done', output = $1, updated_at = $2 WHERE run_id = $3 AND step_id = $4",
          [verifySummary, now(), runId, lc.verifyStep]
        );
      }
    }
  });

  // advancePipeline has its own transaction — must stay outside our tx
  return advancePipeline(runId);
}
