/**
 * Step Failure & Retry Logic (step-fail.ts)
 *
 * Extracted from step-ops.ts — handles step failures with per-story retry,
 * fallback model escalation, and single-step retry/fail logic.
 */

import { execFileSync } from "node:child_process";
import { pgGet, pgQuery, pgRun, pgExec, pgBegin, now } from "../db-pg.js";
import { logger } from "../lib/logger.js";
import { emitEvent } from "./events.js";
import { buildPollingPrompt } from "./agent-cron.js";
import {
  STORY_FALLBACK_RETRY_THRESHOLD,
  STORY_FALLBACK_MODEL,
  DEFAULT_DEVELOPER_AGENTS,
} from "./constants.js";
import {
  getRunContext, getWorkflowId, getStoryInfo,
  recordStepTransition,
} from "./repo.js";
import { removeStoryWorktree } from "./worktree-ops.js";
import { cleanupProjectEphemera, scheduleRunCronTeardown } from "./cleanup-ops.js";

// ── failStep ─────────────────────────────────────────────────────────

/**
 * Fail a step, with retry logic. For loop steps, applies per-story retry.
 */
export async function failStep(stepId: string, error: string): Promise<{ retrying: boolean; runFailed: boolean }> {
  type FailStepRow = { id: string; run_id: string; retry_count: number; max_retries: number; type: string; current_story_id: string | null; agent_id: string };
  let step = await pgGet<FailStepRow>(
    "SELECT id, run_id, retry_count, max_retries, type, current_story_id, agent_id FROM steps WHERE id = $1", [stepId]
  );

  if (!step) {
    const fallbackSteps = await pgQuery<FailStepRow>(
      `SELECT id, run_id, retry_count, max_retries, type, current_story_id, agent_id
       FROM steps
       WHERE run_id = $1 AND status IN ('running', 'pending')
       ORDER BY step_index ASC
       LIMIT 2`,
      [stepId],
    );
    if (fallbackSteps.length === 1) {
      stepId = fallbackSteps[0].id;
      step = fallbackSteps[0];
    } else if (fallbackSteps.length > 1) {
      throw new Error(`Ambiguous step id: "${stepId}" is a runId with multiple active steps. Agent must pass the exact stepId from claim JSON.`);
    } else {
      throw new Error(`Step not found: ${stepId}`);
    }
  }

  if (step.type === "loop" && step.current_story_id) {
    return handleLoopStepFailurePG(stepId, step, error);
  }
  return handleSingleStepFailurePG(stepId, step, error);
}

// ── Loop step failure (PG) ───────────────────────────────────────────

function isTransientAgentInfrastructureFailure(error: string): boolean {
  const normalized = error.toLowerCase();
  return (
    normalized.includes("llm request timed out") ||
    normalized.includes("fallbacksummaryerror: all models failed") ||
    normalized.includes("failovererror") ||
    normalized.includes("gatewayclientrequesterror") ||
    normalized.includes("gateway closed") ||
    normalized.includes("abnormal closure") ||
    normalized.includes("gateway not yet ready") ||
    normalized.includes("discarded invalid tool result middleware output") ||
    normalized.includes("openclaw agent exited") ||
    normalized.includes("agent_process_stuck") ||
    normalized.includes("agent_process_orphaned") ||
    normalized.includes("task is already terminal")
  );
}

async function handleLoopStepFailurePG(
  stepId: string,
  step: { run_id: string; retry_count: number; max_retries: number; type: string; current_story_id: string | null; agent_id: string },
  error: string,
): Promise<{ retrying: boolean; runFailed: boolean }> {
  const story = await pgGet<{ id: string; retry_count: number; max_retries: number }>(
    "SELECT id, retry_count, max_retries FROM stories WHERE id = $1", [step.current_story_id!]
  );

  if (!story) return handleSingleStepFailurePG(stepId, step, error);

  const storyRow = await getStoryInfo(step.current_story_id!);
  if (isTransientAgentInfrastructureFailure(error)) {
    await pgBegin(async (sql) => {
      await sql`UPDATE stories SET status = 'pending', output = ${error}, claimed_by = NULL, updated_at = ${now()} WHERE id = ${story.id}`;
      await sql`UPDATE steps SET status = 'pending', current_story_id = NULL, output = ${error}, updated_at = ${now()} WHERE id = ${stepId}`;
      try { await sql`UPDATE claim_log SET outcome = 'infra_retry', duration_ms = CAST(EXTRACT(EPOCH FROM (NOW() - claimed_at)) * 1000 AS INTEGER), diagnostic = ${error} WHERE story_id = ${storyRow?.story_id || ""} AND outcome IS NULL`; } catch (e) { logger.warn("[claim-log] update failed: " + String(e), {}); }
    });
    await recordStepTransition(stepId, step.run_id, "running", "pending", step.agent_id, "failStep:loopInfraRetry", { storyId: storyRow?.story_id, error: error.slice(0, 300) });
    logger.warn(`[failStep] Transient agent/model failure for ${storyRow?.story_id}; requeued without consuming story retry`, { runId: step.run_id });
    return { retrying: true, runFailed: false };
  }

  const newRetry = story.retry_count + 1;

  if (storyRow?.story_id) {
    const ctx = await getRunContext(step.run_id);
    await cleanupProjectEphemera(step.run_id, `story-fail:${storyRow.story_id}`, ctx);
    if (ctx.repo) removeStoryWorktree(ctx.repo, storyRow.story_id, step.agent_id);
  }

  if (newRetry > story.max_retries) {
    // 2026-04-22 policy change: any story retry-exhaust fails the entire run immediately.
    // Previously loop continued with other stories, allowing pipeline to reach merge-queue
    // with partial work; downstream verify/qa/deploy then ran on a broken feature set.
    // Fail-fast at the first unrecoverable story is simpler and matches user intent.
    const runFailReason = `Story ${storyRow?.story_id} retries exhausted (${newRetry}/${story.max_retries}): ${error}`;
    await pgBegin(async (sql) => {
      await sql`UPDATE stories SET status = 'failed', retry_count = ${newRetry}, output = ${error}, updated_at = ${now()} WHERE id = ${story.id}`;
      await sql`UPDATE steps SET status = 'failed', output = ${runFailReason}, current_story_id = NULL, updated_at = ${now()} WHERE id = ${stepId}`;
      await sql`UPDATE runs SET status = 'failed', updated_at = ${now()} WHERE id = ${step.run_id}`;
      try { await sql`UPDATE claim_log SET outcome = 'failed', duration_ms = CAST(EXTRACT(EPOCH FROM (NOW() - claimed_at)) * 1000 AS INTEGER), diagnostic = ${error} WHERE story_id = ${storyRow?.story_id || ""} AND outcome IS NULL`; } catch (e) { logger.warn("[claim-log] update failed: " + String(e), {}); }
    });
    await recordStepTransition(stepId, step.run_id, "running", "failed", step.agent_id, "failStep:loopStoryExhausted", { storyId: storyRow?.story_id, retry: newRetry });
    const wfId = await getWorkflowId(step.run_id);
    emitEvent({ ts: now(), event: "story.failed", runId: step.run_id, workflowId: wfId, stepId: stepId, storyId: storyRow?.story_id, storyTitle: storyRow?.title, detail: `Story retries exhausted (${newRetry}/${story.max_retries}) — failing run` });
    emitEvent({ ts: now(), event: "step.failed", runId: step.run_id, workflowId: wfId, stepId: stepId, detail: runFailReason });
    emitEvent({ ts: now(), event: "run.failed", runId: step.run_id, workflowId: wfId, detail: runFailReason });
    scheduleRunCronTeardown(step.run_id);
    logger.warn(`[failStep] Story ${storyRow?.story_id} retries exhausted — failing run (policy: fail-fast on unrecoverable story)`, { runId: step.run_id });
    return { retrying: false, runFailed: true };
  }

  await pgBegin(async (sql) => {
    await sql`UPDATE stories SET status = 'pending', retry_count = ${newRetry}, output = ${error}, updated_at = ${now()} WHERE id = ${story.id}`;
    await sql`UPDATE steps SET status = 'pending', current_story_id = NULL, updated_at = ${now()} WHERE id = ${stepId}`;
    try { await sql`UPDATE claim_log SET outcome = 'failed', duration_ms = CAST(EXTRACT(EPOCH FROM (NOW() - claimed_at)) * 1000 AS INTEGER), diagnostic = ${error} WHERE story_id = ${storyRow?.story_id || ""} AND outcome IS NULL`; } catch (e) { logger.warn("[claim-log] update failed: " + String(e), {}); }
  });
  await recordStepTransition(stepId, step.run_id, "running", "pending", step.agent_id, "failStep:loopStoryRetry", { storyId: storyRow?.story_id, retry: newRetry });

  if (newRetry >= STORY_FALLBACK_RETRY_THRESHOLD) {
    fireFallbackRetryCron(step, storyRow, newRetry);
  }

  return { retrying: true, runFailed: false };
}

// ── Single step failure (PG) ─────────────────────────────────────────

const CRITICAL_STEPS = new Set(["deploy", "plan", "setup-repo", "setup-build", "stories", "final-test", "qa-test", "security-gate", "verify"]);

/** Quality gate steps get boosted max_retries so agents have more chances to fix issues */
const QUALITY_GATE_STEPS = new Set(["final-test", "qa-test", "security-gate", "verify"]);
const QUALITY_GATE_MIN_RETRIES = 4;

async function handleSingleStepFailurePG(
  stepId: string,
  step: { run_id: string; retry_count: number; max_retries: number; type: string; current_story_id: string | null; agent_id: string },
  error: string,
): Promise<{ retrying: boolean; runFailed: boolean }> {
  const newRetryCount = step.retry_count + 1;

  const stepRow = await pgGet<{ step_id: string }>("SELECT step_id FROM steps WHERE id = $1", [stepId]);
  const workflowStepId = stepRow?.step_id || "";

  // Boost max_retries for quality gate steps so agents get more chances to fix issues
  if (QUALITY_GATE_STEPS.has(workflowStepId) && step.max_retries < QUALITY_GATE_MIN_RETRIES) {
    step.max_retries = QUALITY_GATE_MIN_RETRIES;
    await pgRun("UPDATE steps SET max_retries = $1 WHERE id = $2", [QUALITY_GATE_MIN_RETRIES, stepId]);
    logger.info(`[failStep] Boosted max_retries to ${QUALITY_GATE_MIN_RETRIES} for quality gate step ${workflowStepId}`, { runId: step.run_id });
  }

  await pgBegin(async (sql) => {
    if (newRetryCount > step.max_retries) {
      const isCritical = CRITICAL_STEPS.has(workflowStepId);

      if (isCritical) {
        await sql`UPDATE steps SET status = 'failed', output = ${error}, retry_count = ${newRetryCount}, updated_at = ${now()} WHERE id = ${stepId}`;
        await sql`UPDATE runs SET status = 'failed', updated_at = ${now()} WHERE id = ${step.run_id}`;
        try { await sql`UPDATE claim_log SET outcome = 'failed', duration_ms = CAST(EXTRACT(EPOCH FROM (NOW() - claimed_at)) * 1000 AS INTEGER), diagnostic = ${error} WHERE run_id = ${step.run_id} AND step_id = ${stepId} AND story_id IS NULL AND outcome IS NULL`; } catch (e) { logger.warn("[claim-log] update failed: " + String(e), {}); }
      } else {
        await sql`UPDATE steps SET status = 'skipped', output = ${"SKIPPED: " + error}, retry_count = ${newRetryCount}, updated_at = ${now()} WHERE id = ${stepId}`;
        try { await sql`UPDATE claim_log SET outcome = 'skipped', duration_ms = CAST(EXTRACT(EPOCH FROM (NOW() - claimed_at)) * 1000 AS INTEGER), diagnostic = ${error} WHERE run_id = ${step.run_id} AND step_id = ${stepId} AND story_id IS NULL AND outcome IS NULL`; } catch (e) { logger.warn("[claim-log] update failed: " + String(e), {}); }
      }
    } else {
      await sql`UPDATE steps SET status = 'pending', retry_count = ${newRetryCount}, output = ${error}, updated_at = ${now()} WHERE id = ${stepId}`;
      try { await sql`UPDATE claim_log SET outcome = 'failed', duration_ms = CAST(EXTRACT(EPOCH FROM (NOW() - claimed_at)) * 1000 AS INTEGER), diagnostic = ${error} WHERE run_id = ${step.run_id} AND step_id = ${stepId} AND story_id IS NULL AND outcome IS NULL`; } catch (e) { logger.warn("[claim-log] update failed: " + String(e), {}); }
    }
  });

  await cleanupProjectEphemera(step.run_id, `step-fail:${workflowStepId || stepId}`);

  // Post-transaction side effects
  if (newRetryCount > step.max_retries) {
    const isCritical = CRITICAL_STEPS.has(workflowStepId);
    if (isCritical) {
      await recordStepTransition(stepId, step.run_id, "running", "failed", step.agent_id, "failStep:critical", { error, retry: newRetryCount });
      const wfId2 = await getWorkflowId(step.run_id);
      emitEvent({ ts: now(), event: "step.failed", runId: step.run_id, workflowId: wfId2, stepId: stepId, detail: error });
      emitEvent({ ts: now(), event: "run.failed", runId: step.run_id, workflowId: wfId2, detail: "Critical step retries exhausted" });
      scheduleRunCronTeardown(step.run_id);
      return { retrying: false, runFailed: true };
    } else {
      await recordStepTransition(stepId, step.run_id, "running", "skipped", step.agent_id, "failStep:nonCritical", { error, retry: newRetryCount });
      const wfId2 = await getWorkflowId(step.run_id);
      emitEvent({ ts: now(), event: "step.skipped", runId: step.run_id, workflowId: wfId2, stepId: workflowStepId, detail: `Retries exhausted — skipped: ${error}` });
      logger.warn(`[failStep] Non-critical step ${workflowStepId} skipped after ${newRetryCount} retries — pipeline continues`, { runId: step.run_id });
      const { advancePipeline } = await import("./step-advance.js");
      await advancePipeline(step.run_id);
      return { retrying: false, runFailed: false };
    }
  } else {
    await recordStepTransition(stepId, step.run_id, "running", "pending", step.agent_id, "failStep:retry", { error, retry: newRetryCount });
    return { retrying: true, runFailed: false };
  }
}

// ── Fallback Model Cron ──────────────────────────────────────────────

async function fireFallbackRetryCron(
  step: { run_id: string; agent_id: string },
  storyRow: { story_id: string; title: string } | undefined,
  newRetry: number,
): Promise<void> {
  try {
    const wfId2 = (await getWorkflowId(step.run_id)) || "feature-dev";
    const agentRole = step.agent_id.includes("_") ? step.agent_id.split("_").pop()! : step.agent_id;
    const mappedAgents = [...DEFAULT_DEVELOPER_AGENTS];
    const fallbackAgent = mappedAgents[newRetry % mappedAgents.length];
    const cronName = `setfarm/fallback-retry/${Date.now()}-${storyRow?.story_id || "unknown"}-r${newRetry}`;
    const pollingPrompt = buildPollingPrompt(wfId2, agentRole, fallbackAgent);
    execFileSync(process.env.OPENCLAW_CLI || "/home/setrox/.local/bin/openclaw", [
      "cron", "add",
      "--name", cronName,
      "--agent", fallbackAgent,
      "--model", STORY_FALLBACK_MODEL,
      "--at", "+10s",
      "--delete-after-run",
      "--exact",
      "--session", "isolated",
      "--payload", JSON.stringify({
        kind: "agentTurn",
        message: pollingPrompt,
        timeoutSeconds: 1800,
      }),
    ], { timeout: 15000, stdio: "pipe" });
    logger.info(`[failStep] Fired fallback retry with model ${STORY_FALLBACK_MODEL} for story ${storyRow?.story_id} (retry ${newRetry}, agent ${fallbackAgent})`, { runId: step.run_id });
  } catch (fallbackErr) {
    logger.warn(`[failStep] Fallback cron creation failed: ${String(fallbackErr)} — normal retry will still work`, { runId: step.run_id });
  }
}
