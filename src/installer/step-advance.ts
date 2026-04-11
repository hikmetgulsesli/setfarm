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
  findStoryByStatus,
  recordStepTransition,
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

  const _txResult: any = await pgBegin(async (sql) => {
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

      // Wave 13 Bug J-1 (run #344 postmortem): belt-and-suspenders guard against
      // terminal failed prior steps. Even with failRun(terminal=true) + medic skip
      // there are narrow windows where a failed prior step can coexist with a
      // waiting next step — for example when a cron triggers advancePipeline
      // between the pgRun() that marks the step failed and the failRun() that
      // marks the run failed. If a prior step is failed AND out of retries, the
      // pipeline must NOT advance — instead fail the run here and bail.
      const terminalFailedRows = await sql.unsafe(
        "SELECT id, step_id FROM steps WHERE run_id = $1 AND step_index < $2 AND status = 'failed' AND retry_count >= max_retries LIMIT 1",
        [runId, next.step_index]
      );
      const terminalFailed = terminalFailedRows[0] as unknown as { id: string; step_id: string } | undefined;
      if (terminalFailed) {
        logger.error(`[advance] Refusing to advance run ${runId} — prior step ${terminalFailed.step_id} is terminally failed`);
        await sql.unsafe("UPDATE runs SET status = 'failed', updated_at = $1 WHERE id = $2", [now(), runId]);
        // Mark terminal so medic does not revive it
        try {
          const metaRow = await sql.unsafe("SELECT meta FROM runs WHERE id = $1", [runId]);
          const metaStr = (metaRow[0] as any)?.meta as string | null | undefined;
          const meta = metaStr ? JSON.parse(metaStr) : {};
          meta.terminal_failure = true;
          meta.terminal_marked_at = now();
          meta.terminal_reason = `advancePipeline detected prior step ${terminalFailed.step_id} failed terminally`;
          await sql.unsafe("UPDATE runs SET meta = $1 WHERE id = $2", [JSON.stringify(meta), runId]);
        } catch { /* meta persistence is best-effort */ }
        emitEvent({ ts: now(), event: "run.failed" as any, runId, workflowId: wfId, detail: `advancePipeline: prior step ${terminalFailed.step_id} terminally failed` });
        scheduleRunCronTeardown(runId);
        return { advanced: false, runCompleted: false };
      }
      await sql.unsafe(
        "UPDATE steps SET status = 'pending', updated_at = $1 WHERE id = $2",
        [now(), next.id]
      );
      await recordStepTransition(next.id, runId, "waiting", "pending", undefined, "advancePipeline");
      emitEvent({ ts: now(), event: "pipeline.advanced", runId, workflowId: wfId, stepId: next.step_id });
      emitEvent({ ts: now(), event: "step.pending", runId, workflowId: wfId, stepId: next.step_id });
      // cuddly-sleeping-quail (run #393 postmortem): syncActiveCrons and
      // pg_notify used to run INSIDE this transaction, but they read via
      // pgQuery on a separate connection that cannot see the uncommitted
      // UPDATE above. Return a flag and defer those calls until the outer
      // caller runs them AFTER the transaction commits.
      return { advanced: true, runCompleted: false, _postCommit: { kind: "sync", nextStepId: next.id, nextAgentId: next.step_id, wfId: wfId || "" } } as any;
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

  // cuddly-sleeping-quail: post-commit sync (outside transaction so reads see fresh state)
  if (_txResult && (_txResult as any)._postCommit) {
    const pc = (_txResult as any)._postCommit;
    if (pc.kind === "sync") {
      try {
        await syncActiveCrons(runId, pc.wfId);
      } catch (e) {
        logger.warn(`[advance] syncActiveCrons failed: ${String(e)}`, {});
      }
      try {
        const { pgRun: _pgRun } = await import("../db-pg.js");
        const stepAgent = await pgGet<{ agent_id: string }>("SELECT agent_id FROM steps WHERE id = $1", [pc.nextStepId]);
        await _pgRun("SELECT pg_notify('step_pending', $1)", [JSON.stringify({ agentId: stepAgent?.agent_id || pc.nextAgentId, runId, stepId: pc.nextAgentId })]);
      } catch {}
    }
    delete (_txResult as any)._postCommit;
  }
  return _txResult;
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
      await recordStepTransition(loopStepId, runId, loopStatus?.status || null, "pending", undefined, "checkLoopContinuation:moreStories");
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
          "UPDATE steps SET status = 'pending', updated_at = $1 WHERE run_id = $2 AND step_id = $3 AND status IN ('waiting', 'done', 'pending')",
          [now(), runId, lcForCheck.verifyStep]
        );
        logger.info(`Loop has unverified stories — keeping verify active`, { runId });
        return { advanced: false, runCompleted: false };
      }
    }
  }

  // Count failed stories BEFORE skip conversion (P1-05)
  const preSkipFailedRows = await pgQuery<{ cnt: string }>(
    "SELECT COUNT(*) as cnt FROM stories WHERE run_id = $1 AND status = 'failed'", [runId]
  );
  const originalFailedCount = parseInt(preSkipFailedRows[0]?.cnt || "0", 10);

  // CRITICAL (2026-04-07): If ANY story failed, FAIL the entire run.
  // Previously skipFailedStories converted failed → skipped and pipeline marched on,
  // deploying broken apps. Quality requires all stories to succeed.
  if (originalFailedCount > 0) {
    const failedStoryRows = await pgQuery<{ story_id: string; title: string }>(
      "SELECT story_id, title FROM stories WHERE run_id = $1 AND status = 'failed' ORDER BY story_index ASC",
      [runId]
    );
    const failedList = failedStoryRows.map(s => `${s.story_id} (${s.title})`).join(", ");
    const failReason = `Loop step failed — ${originalFailedCount} story/stories failed: ${failedList}`;
    logger.error(`[checkLoopContinuation] ${failReason}`, { runId });

    await pgRun(
      "UPDATE steps SET status = 'failed', output = $1, updated_at = $2 WHERE id = $3",
      [failReason, now(), loopStepId]
    );
    await pgRun(
      "UPDATE runs SET status = 'failed', updated_at = $1 WHERE id = $2",
      [now(), runId]
    );
    const wfId = await getWorkflowId(runId);
    emitEvent({ ts: now(), event: "step.failed" as any, runId, workflowId: wfId, stepId: loopStepId, detail: failReason });
    emitEvent({ ts: now(), event: "run.failed" as any, runId, workflowId: wfId, detail: failReason });
    return { advanced: false, runCompleted: false };
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
STORIES_FAILED: ${originalFailedCount}
SUMMARY: ${verifiedCount}/${totalCount} stories verified, ${skippedCount} skipped (${originalFailedCount} originally failed)`;

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

// ── autoVerifyAndAdvance (2026-04-06) ────────────────────────────────
// Medic calls this when verify step is stuck 3+ times.
// Force auto-verifies all done stories, completes verify step, and advances pipeline.

export async function autoVerifyAndAdvance(runId: string): Promise<boolean> {
  const { getPRState } = await import("./pr-state.js");
  const { verifyStory } = await import("./repo.js");

  // Find all done (but not verified) stories
  const doneStories = await pgQuery<{ id: string; story_id: string; pr_url: string | null }>(
    "SELECT id, story_id, pr_url FROM stories WHERE run_id = $1 AND status = 'done'",
    [runId]
  );

  if (doneStories.length === 0) return false;

  let verified = 0;
  let skipped = 0;
  for (const story of doneStories) {
    if (story.pr_url) {
      // NO auto-merge — PR review is mandatory (Gemini + Copilot comments must be addressed)
      const prState = getPRState(story.pr_url);
      if (prState !== "MERGED") {
        logger.warn("[medic-auto-verify] PR not merged for " + story.story_id + " (state: " + prState + ") — needs agent review", { runId });
        skipped++;
        continue;
      }
    }
    await verifyStory(story.id);
    verified++;
    const wfId = await getWorkflowId(runId);
    emitEvent({ ts: now(), event: "story.verified" as any, runId, workflowId: wfId, storyId: story.story_id, detail: "Medic: force auto-verified (PR merged)" });
    logger.info("[medic-auto-verify] Force verified story " + story.story_id + " (PR merged)", { runId });
  }

  if (skipped > 0) {
    logger.warn("[medic-auto-verify] " + skipped + " stories skipped (PR not merged) — verify step NOT completed", { runId });
  }

  if (verified === 0) return false;

  // Complete verify step
  const loopStep = await pgGet<{ loop_config: string | null }>(
    "SELECT loop_config FROM steps WHERE run_id = $1 AND type = 'loop' LIMIT 1",
    [runId]
  );
  if (loopStep?.loop_config) {
    try {
      const lc: LoopConfig = JSON.parse(loopStep.loop_config);
      if (lc.verifyStep) {
        const totalStories = await pgQuery<{ id: string }>("SELECT id FROM stories WHERE run_id = $1", [runId]);
        const verifiedStories = await pgQuery<{ id: string }>("SELECT id FROM stories WHERE run_id = $1 AND status = 'verified'", [runId]);
        const summary = "STATUS: done\nVERIFICATION_SUMMARY: " + verifiedStories.length + "/" + totalStories.length + " stories verified (medic force)";
        await pgRun(
          "UPDATE steps SET status = 'done', output = $1, updated_at = $2 WHERE run_id = $3 AND step_id = $4",
          [summary, now(), runId, lc.verifyStep]
        );
      }
    } catch {}
  }

  // Advance pipeline to next step
  const result = await advancePipeline(runId);
  return result.advanced || result.runCompleted;
}
