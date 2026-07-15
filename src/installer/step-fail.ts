/**
 * Step Failure & Retry Logic (step-fail.ts)
 *
 * Extracted from step-ops.ts — handles step failures with per-story retry,
 * fallback model escalation, and single-step retry/fail logic.
 */

import { execFileSync } from "node:child_process";
import { homedir } from "node:os";
import path from "node:path";
import type postgres from "postgres";
import { getSql, pgGet, pgQuery, pgRun, pgExec, pgBegin, now } from "../db-pg.js";
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
import { refreshRunContractSafe } from "./contract-ledger.js";
import { maybeRunPlatformSelfHeal } from "./platform-self-heal/runner.js";
import { preserveActionableStoryRetryOutput } from "./retry-output.js";
import {
  finalizeShadowAttemptFailure,
  prepareShadowAttemptFailure,
  type ShadowFailurePreparation,
} from "../execution/shadow-attempt-recorder.js";
import {
  closeClaimAndBoundAttemptInTransaction,
  closeExactSingleStepClaimInTransaction,
  type SingleStepClaimOutcome,
} from "../execution/claim-attempt-transition.js";
import { markRuntimeCompletionOwnerCommittedInTransaction } from "../execution/runtime-completion.js";
import { assertClaimAuthority } from "../execution/claim-authority.js";
import type { ClaimEnvelopeV1 } from "../execution/schemas/claim-envelope-v1.js";
import { createSingleEffectCompletionPlanDescriptorV1 } from "../execution/schemas/runtime-completion-plan-v1.js";
import { requestRunTerminationInTransaction } from "../execution/run-termination.js";

// ── failStep ─────────────────────────────────────────────────────────

export type FailStepOptions = Readonly<{
  singleStepMode?: "bounded_stage_retry" | "terminal_platform_preclaim";
}>;

/**
 * Fail a step, with retry logic. For loop steps, applies per-story retry.
 */
export async function failStep(
  stepId: string,
  error: string,
  claimEnvelope?: ClaimEnvelopeV1,
  options: FailStepOptions = {},
): Promise<{ retrying: boolean; runFailed: boolean }> {
  type FailStepRow = { id: string; run_id: string; step_id: string; step_index: number; retry_count: number; max_retries: number; type: string; current_story_id: string | null; agent_id: string };
  let step = await pgGet<FailStepRow>(
    "SELECT id, run_id, step_id, step_index, retry_count, max_retries, type, current_story_id, agent_id FROM steps WHERE id = $1", [stepId]
  );

  if (!step) {
    const fallbackSteps = await pgQuery<FailStepRow>(
      `SELECT id, run_id, step_id, step_index, retry_count, max_retries, type, current_story_id, agent_id
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

  const failureAuthority = claimEnvelope
    ? await assertClaimAuthority(getSql(), claimEnvelope, step.id)
    : undefined;
  const runProtocol = await pgGet<{ protocol: string }>("SELECT protocol FROM runs WHERE id = $1", [step.run_id]);
  if (runProtocol?.protocol !== "legacy" && !failureAuthority) {
    throw new Error("CLAIM_ENVELOPE_REQUIRED");
  }
  if (failureAuthority?.storyDbId) step.current_story_id = failureAuthority.storyDbId;

  if (step.type === "loop" && step.current_story_id) {
    if (options.singleStepMode === "terminal_platform_preclaim") {
      throw new Error("PLATFORM_PRECLAIM_FAILURE_MODE_REQUIRES_SINGLE_STEP");
    }
    return handleLoopStepFailurePG(stepId, step, error, failureAuthority?.envelope);
  }
  return handleSingleStepFailurePG(
    stepId,
    step,
    error,
    failureAuthority?.envelope,
    options.singleStepMode ?? "bounded_stage_retry",
  );
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
    normalized.includes("agent exited code=") ||
    normalized.includes("agent exited:") ||
    normalized.includes("openclaw agent exited") ||
    normalized.includes("agent_process_stuck") ||
    normalized.includes("agent_process_orphaned") ||
    normalized.includes("agent_model_turn_stalled") ||
    normalized.includes("agent_startup_silent") ||
    normalized.includes("setfarm_infra_retry") ||
    normalized.includes("masked_check_command") ||
    normalized.includes("browser_infra_failure") ||
    normalized.includes("native_infra_failure") ||
    normalized.includes("stack_tooling_infra_failure") ||
    normalized.includes("task is already terminal")
  );
}

function isProductManualReviewTerminalFailure(error: string): boolean {
  return /\bPR_REVIEW_COMMENTS_OPEN\b|actionable PR review comments|Story .* retries exhausted/i.test(error) &&
    !/\bDESIGN_IMPORT|stitch-to-jsx|generated-screen-validator|SCOPE_BLEED|VERIFY_MERGE_BLOCKER|MERGE_CONFLICT|SYSTEM_SMOKE_FAILURE|VERIFY_SYSTEM_SMOKE_FAILURE|AGENT_RUNTIME_AUTH_FAILED|CLAIM_PARSE_LOOP\b/i.test(error);
}

export type LoopClaimStateTransition = Readonly<{
  storyStatus: "pending" | "failed";
  storyOutput: string;
  storyRetryCount?: number;
  clearStoryClaim: boolean;
  stepStatus: "pending" | "failed";
  stepOutput: string;
  runFailureDiagnostic?: string;
}>;

export async function terminalizeLoopClaimAndState(input: Readonly<{
  runId: string;
  stepDbId: string;
  stepId: string;
  storyId: string;
  storyDbId: string;
  agentId: string;
  error: string;
  outcome: "infra_retry" | "failed";
  shadowFailure?: ShadowFailurePreparation;
  attemptDisposition: "inconclusive" | "failed";
  claimEnvelope?: ClaimEnvelopeV1;
  state: LoopClaimStateTransition;
}>): Promise<void> {
  // Preserve the source-at-failure observation when its exact fence still
  // owns the attempt. The transactional owner below is the fail-safe: if this
  // hook missed or raced, it closes the active bound fence as inconclusive or
  // failed in the same transaction as the exact claim CAS.
  const shadowFailure = input.shadowFailure ?? await prepareShadowAttemptFailure({
    runId: input.runId,
    stepId: input.stepId,
    storyDbId: input.storyDbId,
    agentId: input.agentId,
  });
  await finalizeShadowAttemptFailure(shadowFailure, input.attemptDisposition);
  const claim = await pgGet<{ id: string; run_id: string; step_id: string; story_id: string; agent_id: string; outcome: string | null }>(
    `SELECT id::text, run_id, step_id, story_id, agent_id, outcome
       FROM claim_log
      WHERE (
          $5::bigint IS NOT NULL
          AND id = $5
        ) OR (
          $5::bigint IS NULL
          AND run_id = $1
          AND step_id = $2
          AND story_id = $3
          AND agent_id = $4
        )
      ORDER BY id DESC
      LIMIT 1`,
    [input.runId, input.stepId, input.storyId, input.agentId, input.claimEnvelope?.claimId ?? null],
  );
  if (!claim) throw new Error("LOOP_CLAIM_LIFECYCLE_NOT_FOUND");
  if (
    input.claimEnvelope
    && (
      Number(claim.id) !== input.claimEnvelope.claimId
      || claim.run_id !== input.runId
      || claim.step_id !== input.stepId
      || claim.story_id !== input.storyId
      || claim.agent_id !== input.agentId
    )
  ) {
    throw new Error("LOOP_CLAIM_LIFECYCLE_IDENTITY_MISMATCH");
  }
  if (claim.outcome !== null) {
    const active = await pgGet<{ count: string }>(
      `SELECT COUNT(*)::text AS count
         FROM execution_attempts
        WHERE run_id = $1
          AND step_id = $2
          AND story_id = $3
          AND disposition IN ('claimed', 'running')`,
      [input.runId, input.stepId, input.storyId],
    );
    if (active?.count !== "0") throw new Error("LOOP_CLAIM_TERMINAL_ATTEMPT_ACTIVE");
    return;
  }
  const claimId = Number(claim.id);
  if (!Number.isSafeInteger(claimId) || claimId <= 0) {
    throw new Error("LOOP_CLAIM_LIFECYCLE_ID_INVALID");
  }
  const transitionTime = now();
  await pgBegin(async (sql) => {
    const closed = await closeClaimAndBoundAttemptInTransaction(sql, {
      claimId,
      runId: input.runId,
      stepId: input.stepId,
      storyId: input.storyId,
      agentId: claim.agent_id,
      outcome: input.outcome,
      diagnostic: input.error,
    });
    if (closed.status !== "closed") throw new Error("LOOP_CLAIM_LIFECYCLE_CAS_LOST");

    const storyUpdated = await sql.unsafe<Array<{ id: string }>>(
      `UPDATE stories
          SET status = $2,
              output = $3,
              retry_count = COALESCE($4, retry_count),
              claimed_by = CASE WHEN $5 THEN NULL ELSE claimed_by END,
              claimed_at = CASE WHEN $5 THEN NULL ELSE claimed_at END,
              updated_at = $6
        WHERE id = $1 AND run_id = $7 AND story_id = $8
        RETURNING id`,
      [
        input.storyDbId,
        input.state.storyStatus,
        input.state.storyOutput,
        input.state.storyRetryCount ?? null,
        input.state.clearStoryClaim,
        transitionTime,
        input.runId,
        input.storyId,
      ],
    );
    if (storyUpdated.length !== 1) throw new Error("LOOP_CLAIM_STORY_STATE_CAS_LOST");

    const stepUpdated = await sql.unsafe<Array<{ id: string }>>(
      `UPDATE steps
          SET status = $2, output = $3, current_story_id = NULL, updated_at = $4
        WHERE id = $1 AND run_id = $5 AND step_id = $6
        RETURNING id`,
      [
        input.stepDbId,
        input.state.stepStatus,
        input.state.stepOutput,
        transitionTime,
        input.runId,
        input.stepId,
      ],
    );
    if (stepUpdated.length !== 1) throw new Error("LOOP_CLAIM_STEP_STATE_CAS_LOST");

    await markRuntimeCompletionOwnerCommittedInTransaction(sql, {
      claimId,
      claimOutcome: input.outcome,
      plan: createSingleEffectCompletionPlanDescriptorV1({
        kind: "loop_failure",
        continuation: { type: "failure_finalize" },
        subject: { storyDbId: input.storyDbId, storyId: input.storyId },
        effectPayload: {
          storyStatus: input.state.storyStatus,
          stepStatus: input.state.stepStatus,
          runTerminal: Boolean(input.state.runFailureDiagnostic),
        },
      }),
      now: new Date(transitionTime),
    });
    if (input.state.runFailureDiagnostic) {
      await requestRunTerminationInTransaction(sql, {
        runId: input.runId,
        targetStatus: "failed",
        requestedBy: "setfarm.step-fail.loop",
        diagnostic: input.state.runFailureDiagnostic,
        evidence: { source: "terminalizeLoopClaimAndState" },
        now: new Date(transitionTime),
      });
    }
  });
}

async function handleLoopStepFailurePG(
  stepId: string,
  step: { run_id: string; step_id?: string; step_index: number; retry_count: number; max_retries: number; type: string; current_story_id: string | null; agent_id: string },
  error: string,
  claimEnvelope?: ClaimEnvelopeV1,
): Promise<{ retrying: boolean; runFailed: boolean }> {
  const workflowStepId = step.step_id || stepId;
  const shadowFailure = await prepareShadowAttemptFailure({
    runId: step.run_id,
    stepId: workflowStepId,
    storyDbId: step.current_story_id!,
    agentId: step.agent_id,
  });
  const story = await pgGet<{ id: string; retry_count: number; max_retries: number; output: string | null }>(
    "SELECT id, retry_count, max_retries, output FROM stories WHERE id = $1", [step.current_story_id!]
  );

  if (!story) return handleSingleStepFailurePG(stepId, step, error, claimEnvelope);

  const storyRow = await getStoryInfo(step.current_story_id!);
  if (isTransientAgentInfrastructureFailure(error)) {
    const storyOutput = preserveActionableStoryRetryOutput(story.output, error);
    if (!storyRow?.story_id) throw new Error("LOOP_STORY_ID_MISSING");
    await terminalizeLoopClaimAndState({
      runId: step.run_id,
      stepDbId: stepId,
      stepId: workflowStepId,
      storyId: storyRow.story_id,
      storyDbId: story.id,
      agentId: step.agent_id,
      error,
      outcome: "infra_retry",
      shadowFailure,
      attemptDisposition: "inconclusive",
      ...(claimEnvelope ? { claimEnvelope } : {}),
      state: {
        storyStatus: "pending",
        storyOutput,
        clearStoryClaim: true,
        stepStatus: "pending",
        stepOutput: error,
      },
    });
    await recordStepTransition(stepId, step.run_id, "running", "pending", step.agent_id, "failStep:loopInfraRetry", { storyId: storyRow?.story_id, error: error.slice(0, 300) });
    logger.warn(`[failStep] Transient agent/model failure for ${storyRow?.story_id}; requeued without consuming story retry`, { runId: step.run_id });
    await refreshRunContractSafe(step.run_id, "story.infra_retry");
    return { retrying: true, runFailed: false };
  }

  const newRetry = story.retry_count + 1;

  // Runtime cleanup is deferred to the spawner's quiescence owner. Removing a
  // story worktree here can race a still-live OpenClaw embedded fallback.

  if (newRetry > story.max_retries) {
    // 2026-04-22 policy change: any story retry-exhaust fails the entire run immediately.
    // Previously loop continued with other stories, allowing pipeline to reach merge-queue
    // with partial work; downstream verify/qa/deploy then ran on a broken feature set.
    // Fail-fast at the first unrecoverable story is simpler and matches user intent.
    const terminalRetry = Math.max(0, story.max_retries || 0);
    const storyOutput = preserveActionableStoryRetryOutput(story.output, error);
    const runFailReason = `Story ${storyRow?.story_id} retries exhausted (${terminalRetry}/${story.max_retries}): ${storyOutput}`;
    if (!storyRow?.story_id) throw new Error("LOOP_STORY_ID_MISSING");
    await terminalizeLoopClaimAndState({
      runId: step.run_id,
      stepDbId: stepId,
      stepId: workflowStepId,
      storyId: storyRow.story_id,
      storyDbId: story.id,
      agentId: step.agent_id,
      error,
      outcome: "failed",
      shadowFailure,
      attemptDisposition: "failed",
      ...(claimEnvelope ? { claimEnvelope } : {}),
      state: {
        storyStatus: "failed",
        storyOutput,
        storyRetryCount: terminalRetry,
        clearStoryClaim: false,
        stepStatus: "failed",
        stepOutput: runFailReason,
        runFailureDiagnostic: runFailReason,
      },
    });
    await recordStepTransition(stepId, step.run_id, "running", "failed", step.agent_id, "failStep:loopStoryExhausted", { storyId: storyRow?.story_id, retry: terminalRetry });
    const wfId = await getWorkflowId(step.run_id);
    emitEvent({ ts: now(), event: "story.failed", runId: step.run_id, workflowId: wfId, stepId: workflowStepId, storyId: storyRow?.story_id, storyTitle: storyRow?.title, detail: `Story retries exhausted (${terminalRetry}/${story.max_retries}) — failing run` });
    emitEvent({ ts: now(), event: "step.failed", runId: step.run_id, workflowId: wfId, stepId: workflowStepId, detail: runFailReason });
    emitEvent({ ts: now(), event: "run.failed", runId: step.run_id, workflowId: wfId, detail: runFailReason });
    if (!isProductManualReviewTerminalFailure(runFailReason)) {
      await recordTerminalPlatformSelfHealPlan({ runId: step.run_id, stepId: workflowStepId, agentId: step.agent_id, error: runFailReason });
    }
    scheduleRunCronTeardown(step.run_id);
    logger.warn(`[failStep] Story ${storyRow?.story_id} retries exhausted — failing run (policy: fail-fast on unrecoverable story)`, { runId: step.run_id });
    await refreshRunContractSafe(step.run_id, "story.failed");
    return { retrying: false, runFailed: true };
  }

  const storyOutput = preserveActionableStoryRetryOutput(story.output, error);
  if (!storyRow?.story_id) throw new Error("LOOP_STORY_ID_MISSING");
  await terminalizeLoopClaimAndState({
    runId: step.run_id,
    stepDbId: stepId,
    stepId: workflowStepId,
    storyId: storyRow.story_id,
    storyDbId: story.id,
    agentId: step.agent_id,
    error,
    outcome: "failed",
    shadowFailure,
    attemptDisposition: "failed",
    ...(claimEnvelope ? { claimEnvelope } : {}),
    state: {
      storyStatus: "pending",
      storyOutput,
      storyRetryCount: newRetry,
      clearStoryClaim: true,
      stepStatus: "pending",
      stepOutput: error,
    },
  });
  await recordStepTransition(stepId, step.run_id, "running", "pending", step.agent_id, "failStep:loopStoryRetry", { storyId: storyRow?.story_id, retry: newRetry });

  if (newRetry >= STORY_FALLBACK_RETRY_THRESHOLD) {
    fireFallbackRetryCron(step, storyRow, newRetry);
  }

  await refreshRunContractSafe(step.run_id, "story.retry");
  return { retrying: true, runFailed: false };
}

// ── Single step failure (PG) ─────────────────────────────────────────

const CRITICAL_STEPS = new Set(["deploy", "plan", "design", "setup-repo", "setup-build", "stories", "supervise", "final-test", "qa-test", "security-gate", "verify"]);

/** Quality gate steps get boosted max_retries so agents have more chances to fix issues */
const QUALITY_GATE_STEPS = new Set(["supervise", "final-test", "qa-test", "security-gate", "verify"]);
const QUALITY_GATE_MIN_RETRIES = 4;

async function recordTerminalPlatformSelfHealPlan(params: {
  runId: string;
  stepId: string;
  agentId?: string | null;
  error: string;
}): Promise<void> {
  try {
    await maybeRunPlatformSelfHeal(params);
  } catch (error) {
    logger.warn(`[platform-self-heal] terminal failure hook failed: ${String(error).slice(0, 220)}`, { runId: params.runId, stepId: params.stepId });
  }
}

function formatVerifyFailureAsRetryOutput(error: string): string {
  const trimmed = error.trim() || "Verify requested retry without details.";
  if (/^\s*STATUS\s*:\s*retry\b/i.test(trimmed) || /^SYSTEM_SMOKE_FAILURE:/i.test(trimmed)) {
    return trimmed;
  }
  const bullets = trimmed
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => `- ${line}`)
    .join("\n");
  return `STATUS: retry\nFEEDBACK:\n${bullets || `- ${trimmed}`}`;
}

async function routeVerifyEachFailureToImplement(
  stepId: string,
  step: { run_id: string; step_index: number; agent_id: string },
  workflowStepId: string,
  error: string,
  claimEnvelope?: ClaimEnvelopeV1,
): Promise<boolean> {
  if (workflowStepId !== "verify") return false;
  if (isTransientAgentInfrastructureFailure(error)) return false;

  const loopStep = await pgGet<{ loop_config: string | null }>(
    "SELECT loop_config FROM steps WHERE run_id = $1 AND type = 'loop' AND step_id = 'implement' LIMIT 1",
    [step.run_id],
  );
  if (!loopStep?.loop_config) return false;

  let loopConfig: { verifyEach?: boolean; verifyStep?: string } = {};
  try { loopConfig = JSON.parse(loopStep.loop_config); } catch { return false; }
  if (!loopConfig.verifyEach || (loopConfig.verifyStep || "verify") !== workflowStepId) return false;

  const doneStory = await pgGet<{ id: string }>(
    "SELECT id FROM stories WHERE run_id = $1 AND status = 'done' ORDER BY story_index ASC LIMIT 1",
    [step.run_id],
  );
  if (!doneStory) return false;

  const context = await getRunContext(step.run_id);
  const retryOutput = formatVerifyFailureAsRetryOutput(error);
  const { routeQualityFailureToImplement } = await import("./step-ops.js");
  return routeQualityFailureToImplement(
    { id: stepId, run_id: step.run_id, step_id: workflowStepId, step_index: step.step_index, agent_id: step.agent_id },
    retryOutput,
    context,
    claimEnvelope,
  );
}

async function closeSingleStepClaimForFailure(
  sql: postgres.Sql | postgres.TransactionSql,
  input: Readonly<{
    runId: string;
    stepId: string;
    workflowStepId: string;
    outcome: SingleStepClaimOutcome;
    diagnostic: string;
    claimEnvelope?: ClaimEnvelopeV1;
  }>,
): Promise<void> {
  if (input.claimEnvelope) {
    await closeExactSingleStepClaimInTransaction(sql, {
      envelope: input.claimEnvelope,
      outcome: input.outcome,
      diagnostic: input.diagnostic,
    });
    return;
  }

  // Compatibility is deliberately restricted to legacy runs. Shadow/v3 must
  // carry an immutable claim capability and can never broad-close by run/step.
  await sql.unsafe(
    `UPDATE claim_log AS cl
        SET outcome = $1,
            abandoned_at = CASE WHEN $1 = 'infra_retry' THEN COALESCE(cl.abandoned_at, NOW()) ELSE cl.abandoned_at END,
            duration_ms = LEAST(
              CAST(EXTRACT(EPOCH FROM (NOW() - cl.claimed_at::timestamptz)) * 1000 AS BIGINT),
              2147483647
            )::INTEGER,
            diagnostic = $2
       FROM runs r
      WHERE r.id = cl.run_id
        AND r.protocol = 'legacy'
        AND cl.run_id = $3
        AND cl.step_id = $4
        AND cl.story_id IS NULL
        AND cl.outcome IS NULL`,
    [input.outcome, input.diagnostic.slice(0, 1_000), input.runId, input.workflowStepId],
  );
}

async function handleSingleStepFailurePG(
  stepId: string,
  step: { run_id: string; step_id?: string; step_index: number; retry_count: number; max_retries: number; type: string; current_story_id: string | null; agent_id: string },
  error: string,
  claimEnvelope?: ClaimEnvelopeV1,
  failureMode: "bounded_stage_retry" | "terminal_platform_preclaim" = "bounded_stage_retry",
): Promise<{ retrying: boolean; runFailed: boolean }> {
  const terminalPlatformPreclaim = failureMode === "terminal_platform_preclaim";
  if (terminalPlatformPreclaim) {
    step.max_retries = step.retry_count;
    if (!error.startsWith("PLATFORM_PRECLAIM_TERMINAL")) {
      error = `PLATFORM_PRECLAIM_TERMINAL [${step.step_id || stepId}]: ${error}`;
    }
    error = error.slice(0, 8_000);
  }
  const newRetryCount = step.retry_count + 1;

  const workflowStepId = step.step_id || "";

  if (!terminalPlatformPreclaim && await routeVerifyEachFailureToImplement(stepId, step, workflowStepId, error, claimEnvelope)) {
    return { retrying: true, runFailed: false };
  }

  if (!terminalPlatformPreclaim && isTransientAgentInfrastructureFailure(error)) {
    await pgBegin(async (sql) => {
      await closeSingleStepClaimForFailure(sql, {
        runId: step.run_id,
        stepId,
        workflowStepId,
        outcome: "infra_retry",
        diagnostic: error,
        ...(claimEnvelope ? { claimEnvelope } : {}),
      });
      await sql`UPDATE steps SET status = 'pending', output = ${error}, updated_at = ${now()} WHERE id = ${stepId}`;
      if (claimEnvelope) {
        await markRuntimeCompletionOwnerCommittedInTransaction(sql, {
          claimId: claimEnvelope.claimId,
          claimOutcome: "infra_retry",
          plan: createSingleEffectCompletionPlanDescriptorV1({
            kind: "single_failure",
            continuation: { type: "failure_finalize" },
            effectPayload: { stepStatus: "pending", outcome: "infra_retry" },
          }),
        });
      }
    });
    await recordStepTransition(stepId, step.run_id, "running", "pending", step.agent_id, "failStep:singleInfraRetry", { error: error.slice(0, 300) });
    logger.warn(`[failStep] Transient agent/model failure for single step ${workflowStepId || stepId}; requeued without consuming step retry`, { runId: step.run_id });
    await refreshRunContractSafe(step.run_id, "step.infra_retry");
    return { retrying: true, runFailed: false };
  }

  // Boost max_retries for quality gate steps so agents get more chances to fix issues
  if (!terminalPlatformPreclaim && QUALITY_GATE_STEPS.has(workflowStepId) && step.max_retries < QUALITY_GATE_MIN_RETRIES) {
    step.max_retries = QUALITY_GATE_MIN_RETRIES;
    await pgRun("UPDATE steps SET max_retries = $1 WHERE id = $2", [QUALITY_GATE_MIN_RETRIES, stepId]);
    logger.info(`[failStep] Boosted max_retries to ${QUALITY_GATE_MIN_RETRIES} for quality gate step ${workflowStepId}`, { runId: step.run_id });
  }

  await pgBegin(async (sql) => {
    let claimOutcome: SingleStepClaimOutcome;
    if (newRetryCount > step.max_retries) {
      const isCritical = CRITICAL_STEPS.has(workflowStepId);
      const terminalRetry = Math.max(0, step.max_retries || 0);

      if (isCritical) {
        claimOutcome = "failed";
        await closeSingleStepClaimForFailure(sql, {
          runId: step.run_id,
          stepId,
          workflowStepId,
          outcome: "failed",
          diagnostic: error,
          ...(claimEnvelope ? { claimEnvelope } : {}),
        });
        await sql`UPDATE steps SET status = 'failed', output = ${error}, retry_count = ${terminalRetry}, updated_at = ${now()} WHERE id = ${stepId}`;
        await requestRunTerminationInTransaction(sql, {
          runId: step.run_id,
          targetStatus: "failed",
          requestedBy: "setfarm.step-fail.single",
          diagnostic: error,
          evidence: {
            source: "handleSingleStepFailurePG",
            failureOwner: terminalPlatformPreclaim ? "platform_preclaim" : "stage_agent",
            retryPolicy: terminalPlatformPreclaim ? "terminal" : "bounded_stage_retry",
          },
        });
      } else {
        claimOutcome = "skipped";
        await closeSingleStepClaimForFailure(sql, {
          runId: step.run_id,
          stepId,
          workflowStepId,
          outcome: "skipped",
          diagnostic: error,
          ...(claimEnvelope ? { claimEnvelope } : {}),
        });
        await sql`UPDATE steps SET status = 'skipped', output = ${"SKIPPED: " + error}, retry_count = ${terminalRetry}, updated_at = ${now()} WHERE id = ${stepId}`;
      }
    } else {
      claimOutcome = "failed";
      await closeSingleStepClaimForFailure(sql, {
        runId: step.run_id,
        stepId,
        workflowStepId,
        outcome: "failed",
        diagnostic: error,
        ...(claimEnvelope ? { claimEnvelope } : {}),
      });
      await sql`UPDATE steps SET status = 'pending', retry_count = ${newRetryCount}, output = ${error}, updated_at = ${now()} WHERE id = ${stepId}`;
    }
    if (claimEnvelope) {
      await markRuntimeCompletionOwnerCommittedInTransaction(sql, {
        claimId: claimEnvelope.claimId,
        claimOutcome,
        plan: createSingleEffectCompletionPlanDescriptorV1({
          kind: "single_failure",
          continuation: { type: "failure_finalize" },
          effectPayload: {
            stepStatus: newRetryCount > step.max_retries
              ? (CRITICAL_STEPS.has(workflowStepId) ? "failed" : "skipped")
              : "pending",
            outcome: claimOutcome,
          },
        }),
      });
    }
  });

  await cleanupProjectEphemera(step.run_id, `step-fail:${workflowStepId || stepId}`);

  // Post-transaction side effects
  if (newRetryCount > step.max_retries) {
    const isCritical = CRITICAL_STEPS.has(workflowStepId);
    const terminalRetry = Math.max(0, step.max_retries || 0);
    if (isCritical) {
      await recordStepTransition(stepId, step.run_id, "running", "failed", step.agent_id, "failStep:critical", { error, retry: terminalRetry });
      const wfId2 = await getWorkflowId(step.run_id);
      emitEvent({ ts: now(), event: "step.failed", runId: step.run_id, workflowId: wfId2, stepId: workflowStepId || stepId, detail: error });
      emitEvent({ ts: now(), event: "run.failed", runId: step.run_id, workflowId: wfId2, detail: "Critical step retries exhausted" });
      await recordTerminalPlatformSelfHealPlan({ runId: step.run_id, stepId: workflowStepId || stepId, agentId: step.agent_id, error });
      scheduleRunCronTeardown(step.run_id);
      await refreshRunContractSafe(step.run_id, "step.failed");
      return { retrying: false, runFailed: true };
    } else {
      await recordStepTransition(stepId, step.run_id, "running", "skipped", step.agent_id, "failStep:nonCritical", { error, retry: terminalRetry });
      const wfId2 = await getWorkflowId(step.run_id);
      emitEvent({ ts: now(), event: "step.skipped", runId: step.run_id, workflowId: wfId2, stepId: workflowStepId, detail: `Retries exhausted — skipped: ${error}` });
      logger.warn(`[failStep] Non-critical step ${workflowStepId} skipped after ${terminalRetry} retries — pipeline continues`, { runId: step.run_id });
      const { advancePipeline } = await import("./step-advance.js");
      await refreshRunContractSafe(step.run_id, "step.skipped");
      await advancePipeline(step.run_id);
      return { retrying: false, runFailed: false };
    }
  } else {
    await recordStepTransition(stepId, step.run_id, "running", "pending", step.agent_id, "failStep:retry", { error, retry: newRetryCount });
    await refreshRunContractSafe(step.run_id, "step.retry");
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
    execFileSync(process.env.OPENCLAW_CLI || path.join(homedir(), ".local/bin/openclaw"), [
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
