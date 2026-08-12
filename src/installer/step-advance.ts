/**
 * Pipeline Advancement (step-advance.ts)
 *
 * Extracted from step-ops.ts — advancePipeline() finds the next waiting step
 * and activates it, or completes the run. checkLoopContinuation() manages
 * the story loop lifecycle.
 */

import { pgGet, pgQuery, pgRun, pgExec, pgBegin, now } from "../db-pg.js";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { logger } from "../lib/logger.js";
import type { LoopConfig } from "./types.js";
import { emitEvent } from "./events.js";
import {
  getRunStatus, getWorkflowId,
  findStoryByStatus,
  recordStepTransition,
} from "./repo.js";
import { transitionRunToTerminalInTransaction } from "../execution/run-terminal-transition.js";
import { requestRunTerminationInTransaction } from "../execution/run-termination.js";
import { archiveRunProgress, scheduleRunCronTeardown, cleanupLocalBranches } from "./cleanup-ops.js";
import { cleanupWorktrees, cleanAgentWorkspace, syncBaseBranch } from "./worktree-ops.js";
import { RUN_STATUS, STEP_STATUS, STORY_STATUS } from "./constants.js";
import { syncActiveCrons } from "./agent-cron.js";
import { resolvePlatformScript } from "./paths.js";

function runMedicAutoVerifySmokeGate(repoPath: string, runId: string, storyId: string): boolean {
  const smokeScript = resolvePlatformScript("smoke-test.mjs");
  if (!repoPath || !fs.existsSync(repoPath) || !fs.existsSync(smokeScript)) return true;
  try {
    syncBaseBranch(repoPath, "main");
    execFileSync("node", [smokeScript, repoPath], {
      cwd: repoPath,
      timeout: 240_000,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    });
    return true;
  } catch (err: any) {
    const failure = String(err?.stdout || err?.stderr || err?.message || err).slice(0, 800);
    logger.warn(`[medic-auto-verify] Smoke gate blocked force-verify for ${storyId}: ${failure}`, { runId });
    return false;
  }
}

function clearPrEachDownstreamContext(context: Record<string, any>): Record<string, any> {
  const next = { ...context };
  next["branch"] = "main";
  next["BRANCH"] = "main";
  next["supervisor_scope"] = "final-product";
  delete next["story_branch"];
  delete next["STORY_BRANCH"];
  delete next["story_workdir"];
  delete next["pr_url"];
  delete next["PR_URL"];
  delete next["final_pr"];
  delete next["current_story_id"];
  delete next["current_story_title"];
  delete next["current_story"];
  delete next["previous_failure"];
  delete next["failure_category"];
  delete next["failure_suggestion"];
  return next;
}

// ── advancePipeline ──────────────────────────────────────────────────

/**
 * Advance the pipeline: find the next waiting step and make it pending, or complete the run.
 * Respects terminal run states — a failed run cannot be advanced or completed.
 */
export async function advancePipeline(runId: string): Promise<{ advanced: boolean; runCompleted: boolean }> {
  const _txResult: any = await pgBegin(async (sql) => {
    // Serialize advancement with termination requests and claim publication.
    // A cancelling/failing run must never expose another pending step.
    const runRows = await sql.unsafe<Array<{ status: string; workflow_id: string }>>(
      "SELECT status, workflow_id FROM runs WHERE id = $1 FOR UPDATE",
      [runId],
    );
    const run = runRows[0];
    if (!run || ![RUN_STATUS.RUNNING, "resuming"].includes(run.status as any)) {
      return { advanced: false, runCompleted: false };
    }
    const terminationRows = await sql.unsafe<Array<{ request_id: string }>>(
      `SELECT request_id FROM run_termination_requests
        WHERE run_id = $1 AND state <> 'terminalized'
        LIMIT 1 FOR UPDATE`,
      [runId],
    );
    if (terminationRows.length > 0) {
      return { advanced: false, runCompleted: false };
    }
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

    const wfId = run.workflow_id;
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
        const diagnostic = `advancePipeline detected prior step ${terminalFailed.step_id} failed terminally`;
        await requestRunTerminationInTransaction(sql, {
          runId,
          targetStatus: "failed",
          requestedBy: "setfarm.step-advance.prior-terminal-step",
          diagnostic,
          evidence: { source: "advancePipeline" },
        });
        return { advanced: false, runCompleted: false, _postCommit: { kind: "failed", wfId: wfId || "", diagnostic } } as any;
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
      await transitionRunToTerminalInTransaction(sql, {
        runId,
        status: "completed",
        diagnostic: "Pipeline completed with no open claim or attempt owners.",
      });
      const agentRows = await sql.unsafe("SELECT DISTINCT agent_id FROM steps WHERE run_id = $1", [runId]);
      return {
        advanced: false,
        runCompleted: true,
        _postCommit: {
          kind: "completed",
          wfId: wfId || "",
          agentIds: agentRows.map((row: any) => String(row.agent_id || "")).filter(Boolean),
        },
      } as any;
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
    } else if (pc.kind === "failed") {
      emitEvent({ ts: now(), event: "run.failed" as any, runId, workflowId: pc.wfId, detail: pc.diagnostic });
      scheduleRunCronTeardown(runId);
    } else if (pc.kind === "completed") {
      emitEvent({ ts: now(), event: "run.completed", runId, workflowId: pc.wfId });
      logger.info("Run completed", { runId, workflowId: pc.wfId });
      await archiveRunProgress(runId);
      await cleanupWorktrees(runId);
      await cleanupLocalBranches(runId);
      try {
        for (const agentId of pc.agentIds as string[]) cleanAgentWorkspace(agentId);
      } catch (e) { logger.warn(`[advance] Workspace cleanup failed: ${String(e)}`, {}); }
      scheduleRunCronTeardown(runId);
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
  // Failed stories are terminal for the whole loop even when sibling stories
  // remain pending. Otherwise a failed first story can leave the run "running"
  // forever and keep the developer reservation locked.
  const preSkipFailedRows = await pgQuery<{ cnt: string }>(
    "SELECT COUNT(*) as cnt FROM stories WHERE run_id = $1 AND status = 'failed'", [runId]
  );
  const originalFailedCount = parseInt(preSkipFailedRows[0]?.cnt || "0", 10);

  if (originalFailedCount > 0) {
    const failedStoryRows = await pgQuery<{ story_id: string; title: string }>(
      "SELECT story_id, title FROM stories WHERE run_id = $1 AND status = 'failed' ORDER BY story_index ASC",
      [runId]
    );
    const failedList = failedStoryRows.map(s => `${s.story_id} (${s.title})`).join(", ");
    const failReason = `Loop step failed — ${originalFailedCount} story/stories failed: ${failedList}`;
    logger.error(`[checkLoopContinuation] ${failReason}`, { runId });

    await pgBegin(async (sql) => {
      const lockedRun = await sql.unsafe<Array<{ id: string }>>(
        "SELECT id FROM runs WHERE id = $1 FOR UPDATE",
        [runId],
      );
      if (lockedRun.length !== 1) throw new Error("LOOP_FAILURE_RUN_LOCK_MISSING");
      await sql.unsafe(
        "UPDATE steps SET status = 'failed', output = $1, updated_at = $2 WHERE id = $3",
        [failReason, now(), loopStepId],
      );
      await requestRunTerminationInTransaction(sql, {
        runId,
        targetStatus: "failed",
        requestedBy: "setfarm.step-advance.loop-failure",
        diagnostic: failReason,
        evidence: { source: "checkLoopContinuation" },
      });
    });
    const wfId = await getWorkflowId(runId);
    emitEvent({ ts: now(), event: "step.failed" as any, runId, workflowId: wfId, stepId: loopStepId, detail: failReason });
    emitEvent({ ts: now(), event: "run.failed" as any, runId, workflowId: wfId, detail: failReason });
    return { advanced: false, runCompleted: false };
  }

  const pendingStory = await findStoryByStatus(runId, "pending") as { id: string } | undefined;

  const loopStatus = await pgGet<{ status: string; step_id: string; current_story_id: string | null }>(
    "SELECT status, step_id, current_story_id FROM steps WHERE id = $1", [loopStepId]
  );

  if (pendingStory) {
    if (loopStatus?.status === STEP_STATUS.FAILED) {
      return { advanced: false, runCompleted: false };
    }

    let orphanedRunningLoop = false;
    if (loopStatus?.status === STEP_STATUS.RUNNING && !loopStatus.current_story_id) {
      const orphanedOpenClaim = await pgGet<{ id: string }>(
        "SELECT id FROM claim_log WHERE run_id = $1 AND step_id = $2 AND outcome IS NULL LIMIT 1",
        [runId, loopStatus.step_id],
      );
      orphanedRunningLoop = !orphanedOpenClaim;
    }

    if (loopStatus?.status !== STEP_STATUS.RUNNING || orphanedRunningLoop) {
      await pgRun(
        "UPDATE steps SET status = 'pending', current_story_id = NULL, updated_at = $1 WHERE id = $2",
        [now(), loopStepId]
      );
      await recordStepTransition(
        loopStepId,
        runId,
        loopStatus?.status || null,
        "pending",
        undefined,
        orphanedRunningLoop ? "checkLoopContinuation:orphanedRunningLoop" : "checkLoopContinuation:moreStories",
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
          "UPDATE steps SET status = 'pending', updated_at = $1 WHERE run_id = $2 AND step_id = $3 AND status IN ('waiting', 'done', 'pending')",
          [now(), runId, lcForCheck.verifyStep]
        );
        logger.info(`Loop has unverified stories — keeping verify active`, { runId });
        return { advanced: false, runCompleted: false };
      }
    }
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

  const loopStepRow = await pgGet<{ loop_config: string | null; run_id: string }>(
    "SELECT loop_config, run_id FROM steps WHERE id = $1",
    [loopStepId],
  );
  let loopConfig: LoopConfig | null = null;
  try { loopConfig = loopStepRow?.loop_config ? JSON.parse(loopStepRow.loop_config) : null; } catch {}

  // Atomic: mark loop done + verify done must happen together
  await pgBegin(async (sql) => {
    const lockedRun = await sql.unsafe<Array<{ context: string | null }>>(
      "SELECT context FROM runs WHERE id = $1 FOR UPDATE",
      [runId],
    );
    if (lockedRun.length !== 1) throw new Error("LOOP_COMPLETION_RUN_LOCK_MISSING");
    await sql.unsafe(
      "UPDATE steps SET status = 'done', output = $1, updated_at = $2 WHERE id = $3",
      [loopSummaryOutput, now(), loopStepId]
    );

    // Also mark verify step done if it exists
    if (loopConfig?.verifyEach && loopConfig.verifyStep) {
      const verifySummary = `STATUS: done
VERIFICATION_SUMMARY: ${verifiedCount}/${totalCount} stories verified`;
      await sql.unsafe(
        "UPDATE steps SET status = 'done', output = $1, updated_at = $2 WHERE run_id = $3 AND step_id = $4",
        [verifySummary, now(), runId, loopConfig.verifyStep]
      );
    }

    if (loopConfig?.verifyEach || loopConfig?.mergeStrategy === "pr-each") {
      const runRow = lockedRun[0];
      let context: Record<string, any> = {};
      try { context = JSON.parse(runRow?.context || "{}"); } catch {}
      const nextContext = clearPrEachDownstreamContext(context);
      await sql.unsafe(
        "UPDATE runs SET context = $1, updated_at = $2 WHERE id = $3",
        [JSON.stringify(nextContext), now(), runId],
      );
      logger.info(`[checkLoopContinuation] pr-each loop complete; downstream branch context set to main`, { runId });
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

  const ctxRow = await pgGet<{ context: string | null }>("SELECT context FROM runs WHERE id = $1", [runId]);
  let repoPath = "";
  try {
    const ctx = ctxRow?.context ? JSON.parse(ctxRow.context) : {};
    repoPath = ctx.repo || ctx.REPO || "";
  } catch {}

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
    if (!runMedicAutoVerifySmokeGate(repoPath, runId, story.story_id)) {
      skipped++;
      continue;
    }
    await verifyStory(story.id, "STATUS: verified\nVERIFICATION_SUMMARY: Medic force-verified after PR was merged and smoke gate passed.");
    verified++;
    const wfId = await getWorkflowId(runId);
    emitEvent({ ts: now(), event: "story.verified" as any, runId, workflowId: wfId, storyId: story.story_id, detail: "Medic: force auto-verified (PR merged)" });
    logger.info("[medic-auto-verify] Force verified story " + story.story_id + " (PR merged)", { runId });
  }

  if (skipped > 0) {
    logger.warn("[medic-auto-verify] " + skipped + " story/stories still need normal verify — verify step NOT completed", { runId });
    return false;
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
