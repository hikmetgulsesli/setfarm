import type postgres from "postgres";

import { pgBegin, pgGet, now } from "../db-pg.js";
import { readDatabaseWallClock } from "../db/database-wall-clock.js";
import {
  createV3PreDispatchFailureV1,
  decideV3PreDispatchDispositionV1,
  type V3PreDispatchDispositionV1,
} from "../execution/v3-pre-dispatch-failure.js";
import { isV3PreparationProducerFailureCode } from "../execution/v3-preparation-decision.js";
import type { V3PreparationClaimAuthorityV1 } from "../execution/v3-preparation-claim-authority.js";
import type { V3PreparationDependencyStateV1 } from "../execution/v3-preparation-decision.js";
import { requestRunTerminationInTransaction } from "../execution/run-termination.js";
import {
  normalizeOperationalFailureCodeV1,
  OperationalFailureCauseV1Schema,
  type OperationalFailureCauseV1,
} from "../execution/schemas/operational-failure-cause-v1.js";
import { withdrawPreDispatchClaimInTransaction } from "../execution/pre-dispatch-withdrawal-authority.js";
import { scheduleRunCronTeardown } from "./cleanup-ops.js";
import { emitEvent } from "./events.js";
import { recordObservation } from "./observations.js";
import { getWorkflowId } from "./repo.js";
import { removeStoryWorktree } from "./worktree-ops.js";

export type ReservedRuntimeOwnership = Readonly<{
  sessionId: string;
  ownerInstanceId: string;
}>;

export async function closeReservedClaimRuntimeInTransaction(
  sql: postgres.Sql | postgres.TransactionSql,
  input: Readonly<{
    claimId: number;
    runId: string;
    workflowStepId: string;
    storyId: string | null;
    claimAgentId: string;
    outcome: string;
    diagnostic: string;
    runtime?: ReservedRuntimeOwnership;
  }>,
): Promise<void> {
  const result = await withdrawPreDispatchClaimInTransaction(sql as postgres.TransactionSql, {
    identity: {
      claimId: input.claimId,
      runId: input.runId,
      workflowStepId: input.workflowStepId,
      storyId: input.storyId,
      claimAgentId: input.claimAgentId,
      ...(input.runtime ? { runtime: input.runtime } : {}),
    },
    outcome: input.outcome,
    diagnostic: input.diagnostic,
  });
  if (result.status !== "withdrawn") throw new Error(`UNSTARTED_CLAIM_WITHDRAWAL_${result.status.toUpperCase()}`);
}

function dependencyState(
  authority: V3PreparationClaimAuthorityV1,
): V3PreparationDependencyStateV1[] {
  return authority.dependencyAttempts.map((dependency) => ({
    storyId: dependency.storyId,
    state: "ready" as const,
    attemptId: dependency.attemptId,
    disposition: dependency.disposition,
    sourceAfterSha: dependency.sourceRevision.sha,
    sourceAfterTreeHash: dependency.sourceRevision.treeHash,
  }));
}

function preDispatchOperationalFailureCause(
  failure: ReturnType<typeof createV3PreDispatchFailureV1>,
  workflowStepId: string,
): OperationalFailureCauseV1 | undefined {
  if (!isV3PreparationProducerFailureCode(failure.decision.errorCode)) return undefined;
  // The terminal handler does not own the durable open-fingerprint comparison
  // that proves unchanged replay. Until it does, do not let the same producer
  // code choose a second retry_delta_missing identity.
  if (failure.decision.action === "unchanged_replay") return undefined;
  const failureClass = {
    dependency_wait: "platform_authority_invalid",
    packet_amendment: "contract_invalid",
    ownership_wait: "platform_authority_invalid",
    bounded_infra: "infrastructure_failure",
    invariant_failure: "platform_invariant_failed",
    ready: "platform_invariant_failed",
  }[failure.decision.action];
  const failureCode = normalizeOperationalFailureCodeV1(failure.decision.errorCode);
  if (!failureCode) return undefined;
  const candidate = {
    schema: "setfarm.operational-failure-cause.v1" as const,
    workflowStepId,
    boundary: `implementation.pre_dispatch.${failure.decision.phase}`,
    failureClass,
    failureCode,
  };
  const parsed = OperationalFailureCauseV1Schema.safeParse(candidate);
  return parsed.success ? parsed.data : undefined;
}

export async function handleV3PreDispatchFailure(input: Readonly<{
  step: Readonly<{ id: string; run_id: string; step_id: string }>;
  story: Readonly<{ id: string; story_id: string; title?: string | null }>;
  agentId: string;
  claimId: number;
  runtime?: ReservedRuntimeOwnership;
  authority: V3PreparationClaimAuthorityV1;
  phase: "source" | "reservation";
  error: unknown;
  operationalRetryRefused?: boolean;
  repo?: string;
  storyBranch?: string;
}>): Promise<V3PreDispatchDispositionV1> {
  const failure = createV3PreDispatchFailureV1({
    identity: {
      runId: input.step.run_id,
      stepId: input.step.step_id,
      storyId: input.story.story_id,
      packetHash: input.authority.packetHash,
      sourceSha: input.authority.baseRevision.sha,
      sourceTreeHash: input.authority.baseRevision.treeHash,
      phase: input.phase,
      dependencyState: dependencyState(input.authority),
    },
    error: input.error,
  });
  const previous = await pgGet<{ count: number }>(
    `SELECT COUNT(*)::integer AS count
       FROM claim_log
      WHERE run_id = $1
        AND step_id = $2
        AND story_id = $3
        AND LEFT(diagnostic, CHAR_LENGTH($4)) = $4`,
    [
      input.step.run_id,
      input.step.step_id,
      input.story.story_id,
      `${failure.diagnosticPrefix}:`,
    ],
  );
  const disposition = decideV3PreDispatchDispositionV1({
    failure,
    priorEquivalentFailures: previous?.count ?? 0,
    forceTerminal: input.operationalRetryRefused,
  });
  const operationalFailureCause = preDispatchOperationalFailureCause(
    failure,
    input.step.step_id,
  );
  await pgBegin(async (sql) => {
    await closeReservedClaimRuntimeInTransaction(sql, {
      claimId: input.claimId,
      runId: input.step.run_id,
      workflowStepId: input.step.step_id,
      storyId: input.story.story_id,
      claimAgentId: input.agentId,
      outcome: disposition.claimOutcome,
      diagnostic: disposition.diagnostic,
      runtime: input.runtime,
    });
    const transitionTime = await readDatabaseWallClock(
      sql,
      "V3_PRE_DISPATCH_DATABASE_TIME_UNAVAILABLE",
    );
    if (disposition.runTerminal) {
      const stories = await sql.unsafe<Array<{ id: string }>>(
        `UPDATE stories
            SET status = 'failed', output = $2, claimed_at = NULL,
                claimed_by = NULL, updated_at = $3
          WHERE id = $1 AND run_id = $4 AND story_id = $5 AND status = 'running'
          RETURNING id`,
        [input.story.id, disposition.diagnostic, transitionTime, input.step.run_id, input.story.story_id],
      );
      if (stories.length !== 1) throw new Error("V3_PRE_DISPATCH_STORY_TERMINAL_CAS_LOST");
      const steps = await sql.unsafe<Array<{ id: string }>>(
        `UPDATE steps
            SET status = 'failed', output = $2, current_story_id = NULL, updated_at = $3
          WHERE id = $1 AND run_id = $4 AND step_id = $5 AND status IN ('pending', 'running')
          RETURNING id`,
        [input.step.id, disposition.diagnostic, transitionTime, input.step.run_id, input.step.step_id],
      );
      if (steps.length !== 1) throw new Error("V3_PRE_DISPATCH_STEP_TERMINAL_CAS_LOST");
      await requestRunTerminationInTransaction(sql, {
        runId: input.step.run_id,
        targetStatus: "failed",
        requestedBy: "setfarm.v3-pre-dispatch",
        diagnostic: disposition.diagnostic,
        ...(operationalFailureCause ? { failureCause: operationalFailureCause } : {}),
        evidence: {
          source: "handleV3PreDispatchFailure",
          failureFingerprint: failure.decision.fingerprint,
          errorCode: failure.decision.errorCode,
        },
        now: transitionTime,
      });
    } else {
      const stories = await sql.unsafe<Array<{ id: string }>>(
        `UPDATE stories
            SET status = 'pending', output = $2, claimed_at = NULL,
                claimed_by = NULL, updated_at = $3
          WHERE id = $1 AND run_id = $4 AND story_id = $5 AND status = 'running'
          RETURNING id`,
        [input.story.id, disposition.diagnostic, transitionTime, input.step.run_id, input.story.story_id],
      );
      if (stories.length !== 1) throw new Error("V3_PRE_DISPATCH_STORY_RETRY_CAS_LOST");
      await sql.unsafe(
        `UPDATE steps
            SET status = CASE
                  WHEN EXISTS (
                    SELECT 1 FROM stories
                     WHERE run_id = $2 AND status = 'running' AND id <> $3
                  ) THEN 'running' ELSE 'pending' END,
                output = $4,
                current_story_id = CASE WHEN current_story_id = $3 THEN NULL ELSE current_story_id END,
                updated_at = $5
          WHERE id = $1`,
        [input.step.id, input.step.run_id, input.story.id, disposition.diagnostic, transitionTime],
      );
    }
  });
  if (input.repo && input.storyBranch) {
    removeStoryWorktree(input.repo, input.storyBranch, input.agentId);
  }
  await recordObservation({
    runId: input.step.run_id,
    stepId: input.step.step_id,
    storyId: input.story.story_id,
    phase: "v3-pre-dispatch",
    checkId: `v3_pre_dispatch.failure:${failure.decision.fingerprint}:${disposition.occurrence}`,
    label: "V3 implementation pre-dispatch authority",
    status: "blocked",
    summary: disposition.runTerminal
      ? "Typed pre-dispatch contract failure terminalized without model dispatch"
      : "Typed transient pre-dispatch failure retained a bounded retry owner",
    detail: disposition.diagnostic,
    evidence: disposition,
  });
  const workflowId = await getWorkflowId(input.step.run_id);
  if (disposition.runTerminal) {
    emitEvent({
      ts: now(), event: "story.failed", runId: input.step.run_id, workflowId,
      stepId: input.step.step_id, storyId: input.story.story_id, detail: disposition.diagnostic,
    });
    emitEvent({
      ts: now(), event: "step.failed", runId: input.step.run_id, workflowId,
      stepId: input.step.step_id, detail: disposition.diagnostic,
    });
    emitEvent({
      ts: now(), event: "run.failed", runId: input.step.run_id, workflowId,
      detail: disposition.diagnostic,
    });
    scheduleRunCronTeardown(input.step.run_id);
  } else {
    emitEvent({
      ts: now(), event: "story.retry", runId: input.step.run_id, workflowId,
      stepId: input.step.step_id, storyId: input.story.story_id,
      storyTitle: input.story.title ?? undefined, detail: disposition.diagnostic,
    });
  }
  return disposition;
}
