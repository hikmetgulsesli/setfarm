import type postgres from "postgres";

import { readDatabaseWallClock } from "../db/database-wall-clock.js";
import type { TerminalAttemptDispositionV1 } from "./schemas/execution-attempt-v1.js";
import type { SourceRevisionV1 } from "./schemas/execution-attempt-v1.js";
import type { ClaimEnvelopeV1 } from "./schemas/claim-envelope-v1.js";
import { acquireClaimMutationAuthorityInTransaction } from "./claim-mutation-authority.js";
import { markRuntimeCompletionOwnerCommittedInTransaction } from "./runtime-completion.js";
import {
  createSingleEffectCompletionPlanDescriptorV1,
  type RuntimeCompletionPlanDescriptorV1,
} from "./schemas/runtime-completion-plan-v1.js";

type ClaimRow = Readonly<{
  id: string;
  run_id: string;
  step_id: string;
  story_id: string | null;
  agent_id: string;
  outcome: string | null;
  protocol: string;
  packet_hash?: string | null;
}>;

type AttemptRow = Readonly<{
  attempt_id: string;
  claim_id: string | null;
  generation: number;
  fence_token: string;
  agent_id: string | null;
  evidence_refs: string;
  step_id?: string;
  story_id?: string;
  packet_hash?: string | null;
  compilation_report_hash?: string | null;
  slice_hash?: string | null;
  lease_expires_at?: Date | string;
  recovery_case_revision_id?: string | null;
  recovery_dispatch_id?: string | null;
}>;

export type TerminalClaimTransitionResult = Readonly<{
  status: "closed" | "cas_lost";
  claimId: number;
  claimOutcome: string;
  attemptId?: string;
  attemptDisposition?: TerminalAttemptDispositionV1;
}>;

export type CompletedStoryClaimTransitionResult = Readonly<{
  status: "completed";
  claimId: number;
  attemptId?: string;
  attemptDisposition?: TerminalAttemptDispositionV1;
}>;

export type CompletedSingleStepClaimTransitionResult = Readonly<{
  status: "completed";
  claimId: number;
  stepStatus: "done" | "waiting" | "pending";
}>;

export type SingleStepClaimOutcome = "completed" | "infra_retry" | "failed" | "skipped";

export type BoundedSingleStepRecoveryResult = Readonly<{
  status: "closed" | "no_open_claim";
  protocol: "legacy" | "shadow" | "v3";
  claimId?: number;
  claimAgentId?: string;
}>;

function normalizedOutcome(value: string): string {
  const normalized = value.trim().toLowerCase().replace(/[^a-z0-9_-]+/g, "_");
  return normalized.slice(0, 80) || "unknown";
}

function fallbackDisposition(outcome: string): TerminalAttemptDispositionV1 {
  return normalizedOutcome(outcome) === "failed" ? "failed" : "inconclusive";
}

function parseEvidenceRefs(raw: string): string[] {
  const value: unknown = JSON.parse(raw);
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new Error("CLAIM_ATTEMPT_EVIDENCE_INVALID");
  }
  return value;
}

function assertV3AttemptContract(
  protocol: string,
  runPacketHash: string | null | undefined,
  attempt: AttemptRow,
  errorCode: string,
): void {
  if (protocol !== "v3") return;
  if (
    !runPacketHash
    || attempt.packet_hash !== runPacketHash
    || !attempt.compilation_report_hash
    || !attempt.slice_hash
  ) {
    throw new Error(errorCode);
  }
}

/**
 * Close one exact non-story claim inside the caller's state transaction.
 *
 * This deliberately does not mutate the step. Callers use the same
 * transaction to publish the next step/run/story state, so retryable work can
 * never become visible before the old immutable owner is terminal.
 */
export async function closeExactSingleStepClaimInTransaction(
  sql: postgres.TransactionSql,
  input: Readonly<{
    envelope: ClaimEnvelopeV1;
    outcome: SingleStepClaimOutcome;
    diagnostic: string;
    recoveryAuthority?: "orphan_recovery";
    now?: Date;
  }>,
): Promise<void> {
  const envelope = input.envelope;
  if (envelope.storyId || envelope.storyDbId || envelope.attempt) {
    throw new Error("SINGLE_STEP_CLAIM_STORY_IDENTITY_FORBIDDEN");
  }
  const callerTime = input.now ? new Date(input.now) : new Date();
  if (!Number.isFinite(callerTime.getTime())) throw new Error("SINGLE_STEP_CLAIM_TIME_INVALID");

  await acquireClaimMutationAuthorityInTransaction(sql as postgres.TransactionSql, {
    claimId: envelope.claimId,
    runId: envelope.runId,
    workflowStepId: envelope.workflowStepId,
    storyId: null,
    claimAgentId: envelope.claimAgentId,
  }, input.recoveryAuthority ?? "claim_transition");

  const runRows = await sql.unsafe<Array<{ status: string; protocol: string }>>(
    "SELECT status, protocol FROM runs WHERE id = $1 FOR UPDATE",
    [envelope.runId],
  );
  const lockedRun = runRows[0];
  if (!lockedRun) throw new Error("SINGLE_STEP_CLAIM_RUN_NOT_FOUND");
  if (!["running", "resuming"].includes(lockedRun.status)) {
    throw new Error("SINGLE_STEP_CLAIM_RUN_NOT_ACTIVE");
  }
  const terminationRequests = await sql.unsafe<Array<{ request_id: string }>>(
    `SELECT request_id FROM run_termination_requests
      WHERE run_id = $1 AND state <> 'terminalized'
      LIMIT 1 FOR UPDATE`,
    [envelope.runId],
  );
  if (terminationRequests.length > 0) throw new Error("SINGLE_STEP_COMPLETION_TERMINATION_PENDING");

  const claims = await sql.unsafe<Array<ClaimRow & {
    run_status: string;
    step_db_id: string;
    step_status: string;
  }>>(
    `SELECT cl.id::text, cl.run_id, cl.step_id, cl.story_id, cl.agent_id,
            cl.outcome, r.protocol, r.status AS run_status,
            s.id AS step_db_id, s.status AS step_status
       FROM claim_log cl
       JOIN runs r ON r.id = cl.run_id
       JOIN steps s ON s.id = $2 AND s.run_id = cl.run_id AND s.step_id = cl.step_id
      WHERE cl.id = $1
      FOR UPDATE OF cl, s`,
    [envelope.claimId, envelope.stepId],
  );
  const claim = claims[0];
  if (!claim) throw new Error("SINGLE_STEP_CLAIM_NOT_FOUND");
  if (
    claim.run_id !== envelope.runId
    || claim.step_id !== envelope.workflowStepId
    || claim.story_id !== null
    || claim.agent_id !== envelope.claimAgentId
    || claim.step_db_id !== envelope.stepId
  ) {
    throw new Error("SINGLE_STEP_CLAIM_IDENTITY_MISMATCH");
  }
  if (claim.outcome !== null) throw new Error("SINGLE_STEP_CLAIM_TERMINAL");
  if (claim.protocol !== envelope.protocol) throw new Error("SINGLE_STEP_CLAIM_PROTOCOL_MISMATCH");
  if (!["running", "resuming"].includes(claim.run_status)) throw new Error("SINGLE_STEP_CLAIM_RUN_NOT_ACTIVE");
  if (!["running", "pending"].includes(claim.step_status)) throw new Error("SINGLE_STEP_CLAIM_STEP_NOT_ACTIVE");
  const transitionTime = await readDatabaseWallClock(
    sql,
    "SINGLE_STEP_CLAIM_DATABASE_TIME_UNAVAILABLE",
  );

  const closed = await sql.unsafe<Array<{ id: string }>>(
    `UPDATE claim_log
        SET outcome = $2,
            abandoned_at = CASE WHEN $2 = 'infra_retry' THEN COALESCE(abandoned_at, $3) ELSE abandoned_at END,
            duration_ms = LEAST(
              CAST(EXTRACT(EPOCH FROM ($3::timestamptz - claimed_at::timestamptz)) * 1000 AS BIGINT),
              2147483647
            )::INTEGER,
            diagnostic = $4
      WHERE id = $1 AND outcome IS NULL
      RETURNING id::text`,
    [
      envelope.claimId,
      input.outcome,
      transitionTime,
      input.diagnostic.slice(0, envelope.protocol === "v3" ? 64_000 : 1_000),
    ],
  );
  if (closed.length !== 1) throw new Error("SINGLE_STEP_CLAIM_CAS_LOST");
}

/**
 * Reconstruct and close the one immutable non-story owner available to a
 * background recovery policy.
 *
 * Recovery callers do not possess the worker's serialized claim envelope.
 * They may therefore recover authority only when the run/step identity is
 * exact and exactly one open claim exists under the locked rows. A running
 * step without a claim and multiple open claims are both inconsistent state,
 * not permission to perform a broad update. Protocol v3 uses the same exact
 * immutable non-story capability; story recovery additionally requires its
 * packet-bound attempt fence.
 */
export async function closeUniqueSingleStepClaimForRecoveryInTransaction(
  sql: postgres.TransactionSql,
  input: Readonly<{
    runId: string;
    stepDbId: string;
    workflowStepId: string;
    outcome: SingleStepClaimOutcome;
    diagnostic: string;
    runtimeAgentId?: string;
    now?: Date;
  }>,
): Promise<BoundedSingleStepRecoveryResult> {
  const transitionTime = input.now ? new Date(input.now) : new Date();
  if (!Number.isFinite(transitionTime.getTime())) throw new Error("BOUNDED_RECOVERY_TIME_INVALID");

  const owners = await sql.unsafe<Array<{
    protocol: "legacy" | "shadow" | "v3";
    run_status: string;
    step_status: string;
    step_db_id: string;
    workflow_step_id: string;
  }>>(
    `SELECT r.protocol, r.status AS run_status, s.status AS step_status,
            s.id AS step_db_id, s.step_id AS workflow_step_id
       FROM runs r
       JOIN steps s ON s.run_id = r.id
      WHERE r.id = $1
        AND s.id = $2
        AND s.step_id = $3
      `,
    [input.runId, input.stepDbId, input.workflowStepId],
  );
  const owner = owners[0];
  if (!owner) throw new Error("BOUNDED_RECOVERY_STEP_NOT_FOUND");
  if (!["running", "resuming"].includes(owner.run_status)) {
    throw new Error("BOUNDED_RECOVERY_RUN_NOT_ACTIVE");
  }

  // Discovery is deliberately lockless. The exact recovery authority below
  // owns the canonical advisory -> run -> termination -> runtime -> attempt ->
  // delivery -> claim -> completion sequence, then revalidates the step and
  // claim identities under lock. A caller must not pre-lock step/story rows.
  const claims = await sql.unsafe<Array<{ id: string; agent_id: string }>>(
    `SELECT id::text, agent_id
       FROM claim_log
      WHERE run_id = $1
        AND step_id = $2
        AND story_id IS NULL
        AND outcome IS NULL
      ORDER BY id
      `,
    [input.runId, input.workflowStepId],
  );
  if (claims.length > 1) throw new Error("BOUNDED_RECOVERY_CLAIM_AMBIGUOUS");
  if (claims.length === 0) {
    if (owner.step_status === "running") throw new Error("BOUNDED_RECOVERY_RUNNING_OWNER_MISSING");
    return { status: "no_open_claim", protocol: owner.protocol };
  }

  const claim = claims[0]!;
  const claimId = Number(claim.id);
  if (!Number.isSafeInteger(claimId) || claimId <= 0) throw new Error("BOUNDED_RECOVERY_CLAIM_ID_INVALID");
  await closeExactSingleStepClaimInTransaction(sql, {
    envelope: {
      schema: "setfarm.claim-envelope.v1",
      protocol: owner.protocol,
      issuedAt: transitionTime.toISOString(),
      stepId: input.stepDbId,
      workflowStepId: input.workflowStepId,
      runId: input.runId,
      claimId,
      claimAgentId: claim.agent_id,
      runtimeAgentId: input.runtimeAgentId || "setfarm-bounded-recovery",
    },
    outcome: input.outcome,
    diagnostic: input.diagnostic,
    recoveryAuthority: "orphan_recovery",
    now: transitionTime,
  });
  const remaining = await sql.unsafe<Array<{ id: string }>>(
    `SELECT id::text
       FROM claim_log
      WHERE run_id = $1 AND step_id = $2 AND story_id IS NULL AND outcome IS NULL
      ORDER BY id
      FOR UPDATE`,
    [input.runId, input.workflowStepId],
  );
  if (remaining.length > 0) throw new Error("BOUNDED_RECOVERY_CLAIM_AMBIGUOUS");
  return {
    status: "closed",
    protocol: owner.protocol,
    claimId,
    claimAgentId: claim.agent_id,
  };
}

/**
 * Atomically closes one exact legacy claim and its bound active compiler fence.
 *
 * Retryable story/step state is intentionally outside this primitive. Callers
 * must prove runtime quiescence first, invoke this CAS, clean the old worktree,
 * and only then expose pending state. A crash therefore leaves work hidden
 * rather than allowing a second attempt to race a live fence.
 */
export type CloseClaimAndBoundAttemptInput = Readonly<{
  claimId: number;
  runId: string;
  stepId: string;
  storyId: string | null;
  agentId: string;
  outcome: string;
  diagnostic: string;
  recoveryAuthority?: "orphan_recovery";
  attemptDisposition?: "inconclusive" | "failed";
  attemptFailureEvidence?: Readonly<{
    attemptId: string;
    generation: number;
    fenceToken: string;
    runId: string;
    stepId: string;
    storyId: string;
    sourceAtFailure: SourceRevisionV1;
    legacyClaimId?: number;
    evidenceRefs: readonly string[];
  }>;
  abandoned?: boolean;
  now?: Date;
}>;

export async function closeClaimAndBoundAttemptInTransaction(
  transaction: postgres.TransactionSql,
  input: CloseClaimAndBoundAttemptInput,
): Promise<TerminalClaimTransitionResult> {
  if (!Number.isSafeInteger(input.claimId) || input.claimId <= 0) {
    throw new Error("CLAIM_LIFECYCLE_ID_INVALID");
  }
  if (!input.outcome.trim()) throw new Error("CLAIM_LIFECYCLE_OUTCOME_INVALID");
  const callerTime = input.now ? new Date(input.now) : new Date();
  if (!Number.isFinite(callerTime.getTime())) throw new Error("CLAIM_LIFECYCLE_TIME_INVALID");

  try {
    await acquireClaimMutationAuthorityInTransaction(transaction as postgres.TransactionSql, {
      claimId: input.claimId,
      runId: input.runId,
      workflowStepId: input.stepId,
      storyId: input.storyId,
      claimAgentId: input.agentId,
    }, input.recoveryAuthority ?? "claim_transition");
  } catch (error) {
    if (!(error instanceof Error) || error.message !== "CLAIM_MUTATION_CLAIM_TERMINAL") throw error;
    const terminal = await transaction.unsafe<Array<{
      run_id: string;
      step_id: string;
      story_id: string | null;
      agent_id: string;
      outcome: string | null;
    }>>(
      `SELECT run_id, step_id, story_id, agent_id, outcome
         FROM claim_log
        WHERE id = $1
        FOR UPDATE`,
      [input.claimId],
    );
    const claim = terminal[0];
    if (
      !claim
      || claim.run_id !== input.runId
      || claim.step_id !== input.stepId
      || (claim.story_id ?? null) !== input.storyId
      || claim.agent_id !== input.agentId
      || claim.outcome === null
    ) throw error;
    return {
      status: "cas_lost" as const,
      claimId: input.claimId,
      claimOutcome: claim.outcome,
    };
  }

  const runRows = await transaction.unsafe<Array<{ status: string; protocol: string }>>(
      "SELECT status, protocol FROM runs WHERE id = $1 FOR UPDATE",
      [input.runId],
    );
    const lockedRun = runRows[0];
    if (!lockedRun) throw new Error("CLAIM_LIFECYCLE_RUN_NOT_FOUND");
    if (!["running", "resuming"].includes(lockedRun.status)) {
      throw new Error("CLAIM_LIFECYCLE_RUN_NOT_ACTIVE");
    }
    const terminationRequests = await transaction.unsafe<Array<{ request_id: string }>>(
      `SELECT request_id FROM run_termination_requests
        WHERE run_id = $1 AND state <> 'terminalized'
        LIMIT 1 FOR UPDATE`,
      [input.runId],
    );
    if (terminationRequests.length > 0) throw new Error("CLAIM_LIFECYCLE_TERMINATION_PENDING");
    const claims = await transaction.unsafe<ClaimRow[]>(
      `SELECT cl.id::text, cl.run_id, cl.step_id, cl.story_id, cl.agent_id,
              cl.outcome, r.protocol, r.packet_hash
         FROM claim_log cl
         JOIN runs r ON r.id = cl.run_id
        WHERE cl.id = $1
        FOR UPDATE OF cl`,
      [input.claimId],
    );
    const claim = claims[0];
    if (!claim) throw new Error("CLAIM_LIFECYCLE_NOT_FOUND");
    if (
      claim.run_id !== input.runId
      || claim.step_id !== input.stepId
      || (claim.story_id ?? null) !== input.storyId
      || claim.agent_id !== input.agentId
    ) {
      throw new Error("CLAIM_LIFECYCLE_IDENTITY_MISMATCH");
    }
    if (claim.outcome !== null) {
      return {
        status: "cas_lost" as const,
        claimId: input.claimId,
        claimOutcome: claim.outcome,
      };
    }
    const attempts = claim.protocol !== "legacy"
      ? await transaction.unsafe<AttemptRow[]>(
        `SELECT attempt_id, claim_id::text, generation, fence_token, agent_id, evidence_refs,
                step_id, story_id, packet_hash, compilation_report_hash, slice_hash,
                lease_expires_at, recovery_case_revision_id, recovery_dispatch_id
           FROM execution_attempts
          WHERE run_id = $1
            AND step_id = $2
            AND story_id = COALESCE($3, '')
            AND claim_id = $4
            AND disposition IN ('claimed', 'running')
          FOR UPDATE`,
        [claim.run_id, claim.step_id, claim.story_id, input.claimId],
      )
      : [];
    if (attempts.length > 1) throw new Error("CLAIM_ATTEMPT_ACTIVE_FENCE_AMBIGUOUS");
    if (claim.protocol !== "legacy" && claim.story_id !== null && attempts.length !== 1) {
      const identityAttempts = await transaction.unsafe<Array<{ count: number }>>(
        `SELECT COUNT(*)::integer AS count
           FROM execution_attempts
          WHERE run_id = $1
            AND step_id = $2
            AND story_id = $3
            AND disposition IN ('claimed', 'running')`,
        [claim.run_id, claim.step_id, claim.story_id],
      );
      if ((identityAttempts[0]?.count ?? 0) > 0) throw new Error("CLAIM_ATTEMPT_BINDING_MISMATCH");
      throw new Error("CLAIM_ATTEMPT_ACTIVE_FENCE_REQUIRED");
    }

    const attempt = attempts[0];
    let recoveryDelivery: Readonly<{
      state: string;
      attempt_id: string | null;
      claim_id: string | number | null;
      lease_expires_at: Date | string | null;
    }> | undefined;
    if (attempt?.recovery_dispatch_id || attempt?.recovery_case_revision_id) {
      if (!attempt.recovery_dispatch_id || !attempt.recovery_case_revision_id) {
        throw new Error("CLAIM_ATTEMPT_RECOVERY_IDENTITY_INCOMPLETE");
      }
      const deliveries = await transaction.unsafe<Array<{
        state: string;
        attempt_id: string | null;
        claim_id: string | number | null;
        lease_expires_at: Date | string | null;
      }>>(
        `SELECT state, attempt_id, claim_id, lease_expires_at
           FROM recovery_dispatch_deliveries
          WHERE dispatch_id = $1 AND revision_id = $2
          FOR UPDATE`,
        [attempt.recovery_dispatch_id, attempt.recovery_case_revision_id],
      );
      recoveryDelivery = deliveries[0];
    }
    const now = await readDatabaseWallClock(
      transaction as postgres.TransactionSql,
      "CLAIM_LIFECYCLE_DATABASE_TIME_UNAVAILABLE",
    );
    let attemptDisposition: TerminalAttemptDispositionV1 | undefined;
    if (attempt) {
      const refs = parseEvidenceRefs(attempt.evidence_refs);
      const failureEvidence = input.attemptFailureEvidence;
      if (
        attempt.claim_id !== String(input.claimId)
        || attempt.step_id !== claim.step_id
        || attempt.story_id !== (claim.story_id ?? "")
        || (attempt.agent_id !== null && attempt.agent_id !== claim.agent_id)
      ) {
        throw new Error("CLAIM_ATTEMPT_BINDING_MISMATCH");
      }
      if (
        input.recoveryAuthority !== "orphan_recovery"
        && (
          !attempt.lease_expires_at
          || new Date(attempt.lease_expires_at).getTime() <= now.getTime()
        )
      ) {
        throw new Error("CLAIM_ATTEMPT_LEASE_EXPIRED");
      }
      if (
        input.recoveryAuthority !== "orphan_recovery"
        && attempt.recovery_dispatch_id
        && (
          !recoveryDelivery
          || !["attempt_reserved", "running"].includes(recoveryDelivery.state)
          || recoveryDelivery.attempt_id !== attempt.attempt_id
          || Number(recoveryDelivery.claim_id) !== input.claimId
          || !recoveryDelivery.lease_expires_at
          || new Date(recoveryDelivery.lease_expires_at).getTime() <= now.getTime()
        )
      ) {
        throw new Error("CLAIM_ATTEMPT_RECOVERY_LEASE_EXPIRED");
      }
      if (
        failureEvidence
        && (
          failureEvidence.runId !== input.runId
          || failureEvidence.stepId !== input.stepId
          || failureEvidence.storyId !== (input.storyId ?? "")
          || (
            failureEvidence.legacyClaimId !== undefined
            && failureEvidence.legacyClaimId !== input.claimId
          )
        )
      ) {
        throw new Error("CLAIM_ATTEMPT_FAILURE_EVIDENCE_IDENTITY_MISMATCH");
      }
      if (
        failureEvidence
        && (
          failureEvidence.attemptId !== attempt.attempt_id
          || failureEvidence.generation !== attempt.generation
          || failureEvidence.fenceToken !== attempt.fence_token
        )
      ) {
        throw new Error("CLAIM_ATTEMPT_FAILURE_EVIDENCE_FENCE_MISMATCH");
      }
      assertV3AttemptContract(
        claim.protocol,
        claim.packet_hash,
        attempt,
        "CLAIM_ATTEMPT_V3_CONTRACT_MISMATCH",
      );
      attemptDisposition = input.attemptDisposition ?? fallbackDisposition(input.outcome);
      const evidenceRefs = [...new Set([
        ...refs,
        ...(failureEvidence?.evidenceRefs ?? []),
        `setfarm://attempt-reconciler/claim-terminal/${normalizedOutcome(input.outcome)}`,
      ])].sort();
      const updated = await transaction.unsafe<Array<{ attempt_id: string }>>(
        `UPDATE execution_attempts
            SET disposition = $4,
                evidence_refs = $5,
                source_after_sha = COALESCE(source_after_sha, $6),
                source_after_tree_hash = COALESCE(source_after_tree_hash, $7),
                heartbeat_at = $8,
                updated_at = $8
          WHERE attempt_id = $1
            AND generation = $2
            AND fence_token = $3
            AND disposition IN ('claimed', 'running')
            AND ($9::boolean OR lease_expires_at > $8)
            AND (
              $6::text IS NULL
              OR source_after_sha IS NULL
              OR (
                source_after_sha = $6
                AND source_after_tree_hash = $7
              )
            )
          RETURNING attempt_id`,
        [
          attempt.attempt_id,
          attempt.generation,
          attempt.fence_token,
          attemptDisposition,
          JSON.stringify(evidenceRefs),
          failureEvidence?.sourceAtFailure.sha ?? null,
          failureEvidence?.sourceAtFailure.treeHash ?? null,
          now,
          input.recoveryAuthority === "orphan_recovery",
        ],
      );
      if (updated.length !== 1) throw new Error("CLAIM_ATTEMPT_FENCE_LOST");
    }

    const closed = await transaction.unsafe<Array<{ id: string }>>(
      `UPDATE claim_log
          SET outcome = $2,
              abandoned_at = CASE WHEN $3 THEN COALESCE(abandoned_at, $4) ELSE abandoned_at END,
              duration_ms = LEAST(
                CAST(EXTRACT(EPOCH FROM ($4::timestamptz - claimed_at::timestamptz)) * 1000 AS BIGINT),
                2147483647
              )::INTEGER,
              diagnostic = $5
        WHERE id = $1
          AND outcome IS NULL
        RETURNING id::text`,
      [input.claimId, input.outcome, input.abandoned ?? true, now, input.diagnostic],
    );
    if (closed.length !== 1) throw new Error("CLAIM_LIFECYCLE_CAS_LOST");

  return {
    status: "closed" as const,
    claimId: input.claimId,
    claimOutcome: input.outcome,
    ...(attempt ? { attemptId: attempt.attempt_id, attemptDisposition } : {}),
  };
}

export async function closeClaimAndBoundAttempt(
  sql: postgres.Sql,
  input: CloseClaimAndBoundAttemptInput,
): Promise<TerminalClaimTransitionResult> {
  return sql.begin(
    (transaction) => closeClaimAndBoundAttemptInTransaction(transaction, input),
  ) as Promise<TerminalClaimTransitionResult>;
}

/**
 * Atomically publishes one exact story completion.
 *
 * All slow gates, git work, and source capture happen before this call. Under
 * row locks the owner revalidates the immutable claim/attempt capability, then
 * closes the fence and publishes story/step state together. A crash cannot
 * therefore leave a terminal claim paired with a still-running story, nor can
 * a stale worker complete whichever story currently occupies the shared step.
 */
export async function completeStoryClaimAndBoundAttempt(
  sql: postgres.Sql,
  input: Readonly<{
    envelope: ClaimEnvelopeV1;
    sourceAfter?: SourceRevisionV1;
    outputHash?: string;
    evidenceRefs?: readonly string[];
    attemptDisposition?: TerminalAttemptDispositionV1;
    storyStatus: "done" | "verified" | "skipped" | "pending" | "failed";
    storyOutput: string;
    storyPrUrl?: string;
    storyBranch?: string;
    storyMergeStatus?: string | null;
    stepStatus: "running" | "pending" | "waiting";
    stepOutput: string;
    runContextJson?: string;
    completionPlan?: RuntimeCompletionPlanDescriptorV1;
    diagnostic?: string;
    now?: Date;
  }>,
): Promise<CompletedStoryClaimTransitionResult> {
  const envelope = input.envelope;
  if (!envelope.storyId || !envelope.storyDbId) throw new Error("STORY_COMPLETION_IDENTITY_REQUIRED");
  const callerTime = input.now ? new Date(input.now) : new Date();
  if (!Number.isFinite(callerTime.getTime())) throw new Error("STORY_COMPLETION_TIME_INVALID");

  return sql.begin(async (transaction) => {
    await acquireClaimMutationAuthorityInTransaction(transaction, {
      claimId: envelope.claimId,
      runId: envelope.runId,
      workflowStepId: envelope.workflowStepId,
      storyId: envelope.storyId!,
      claimAgentId: envelope.claimAgentId,
    });
    const runRows = await transaction.unsafe<Array<{ status: string; protocol: string }>>(
      "SELECT status, protocol FROM runs WHERE id = $1 FOR UPDATE",
      [envelope.runId],
    );
    const lockedRun = runRows[0];
    if (!lockedRun) throw new Error("STORY_COMPLETION_RUN_NOT_FOUND");
    if (!["running", "resuming"].includes(lockedRun.status)) {
      throw new Error("STORY_COMPLETION_RUN_NOT_ACTIVE");
    }
    const terminationRequests = await transaction.unsafe<Array<{ request_id: string }>>(
      `SELECT request_id FROM run_termination_requests
        WHERE run_id = $1 AND state <> 'terminalized'
        LIMIT 1 FOR UPDATE`,
      [envelope.runId],
    );
    if (terminationRequests.length > 0) throw new Error("STORY_COMPLETION_TERMINATION_PENDING");
    const claims = await transaction.unsafe<Array<ClaimRow & {
      step_db_id: string;
      step_status: string;
      current_story_id: string | null;
      story_db_id: string | null;
      story_status: string | null;
      story_claimed_by: string | null;
      story_claim_generation: number | null;
      run_status: string;
    }>>(
      `SELECT cl.id::text, cl.run_id, cl.step_id, cl.story_id, cl.agent_id,
              cl.outcome, r.protocol, r.packet_hash, r.status AS run_status,
              s.id AS step_db_id, s.status AS step_status, s.current_story_id,
              st.id AS story_db_id, st.status AS story_status,
              st.claimed_by AS story_claimed_by,
              st.claim_generation AS story_claim_generation
         FROM claim_log cl
         JOIN runs r ON r.id = cl.run_id
         JOIN steps s ON s.id = $2 AND s.run_id = cl.run_id AND s.step_id = cl.step_id
         JOIN stories st ON st.run_id = cl.run_id AND st.story_id = cl.story_id
        WHERE cl.id = $1
        FOR UPDATE OF cl, s, st`,
      [envelope.claimId, envelope.stepId],
    );
    const claim = claims[0];
    if (!claim) throw new Error("STORY_COMPLETION_CLAIM_NOT_FOUND");
    if (
      claim.run_id !== envelope.runId
      || claim.step_id !== envelope.workflowStepId
      || claim.story_id !== envelope.storyId
      || claim.agent_id !== envelope.claimAgentId
      || claim.step_db_id !== envelope.stepId
      || claim.story_db_id !== envelope.storyDbId
    ) {
      throw new Error("STORY_COMPLETION_IDENTITY_MISMATCH");
    }
    if (claim.outcome !== null) throw new Error("STORY_COMPLETION_CLAIM_TERMINAL");
    if (claim.protocol !== envelope.protocol) throw new Error("STORY_COMPLETION_PROTOCOL_MISMATCH");
    if (!["running", "resuming"].includes(claim.run_status)) throw new Error("STORY_COMPLETION_RUN_NOT_ACTIVE");
    if (
      claim.step_status !== "running"
      || claim.current_story_id !== envelope.storyDbId
      || claim.story_status !== "running"
      || (claim.story_claimed_by !== null && claim.story_claimed_by !== envelope.claimAgentId)
      || (
        envelope.claimGeneration !== undefined
        && claim.story_claim_generation !== envelope.claimGeneration
      )
    ) {
      throw new Error("STORY_COMPLETION_OWNERSHIP_CHANGED");
    }

    let attemptDisposition: TerminalAttemptDispositionV1 | undefined;
    let ownerClock: Date | undefined;
    if (claim.protocol !== "legacy") {
      const expected = envelope.attempt;
      if (!expected || !input.sourceAfter) throw new Error("STORY_COMPLETION_ATTEMPT_EVIDENCE_REQUIRED");
      const attempts = await transaction.unsafe<Array<AttemptRow & {
        source_before_sha: string;
        source_before_tree_hash: string;
        source_after_sha: string | null;
        source_after_tree_hash: string | null;
      }>>(
        `SELECT attempt_id, claim_id::text, generation, fence_token, agent_id, evidence_refs,
                step_id, story_id, packet_hash, compilation_report_hash, slice_hash,
                source_before_sha, source_before_tree_hash,
                source_after_sha, source_after_tree_hash,
                lease_expires_at, recovery_case_revision_id, recovery_dispatch_id
           FROM execution_attempts
          WHERE attempt_id = $1
          FOR UPDATE`,
        [expected.attemptId],
      );
      const attempt = attempts[0];
      if (
        !attempt
        || attempt.attempt_id !== expected.attemptId
        || attempt.claim_id !== String(envelope.claimId)
        || attempt.generation !== expected.generation
        || attempt.fence_token !== expected.fenceToken
        || (attempt.agent_id !== null && attempt.agent_id !== envelope.claimAgentId)
      ) {
        throw new Error("STORY_COMPLETION_ATTEMPT_FENCE_MISMATCH");
      }
      if (
        attempt.step_id !== claim.step_id
        || attempt.story_id !== claim.story_id
      ) {
        throw new Error("STORY_COMPLETION_ATTEMPT_BINDING_MISMATCH");
      }
      assertV3AttemptContract(
        claim.protocol,
        claim.packet_hash,
        attempt,
        "STORY_COMPLETION_V3_ATTEMPT_CONTRACT_MISMATCH",
      );
      let recoveryDelivery: Readonly<{
        state: string;
        attempt_id: string | null;
        claim_id: string | number | null;
        lease_expires_at: Date | string | null;
      }> | undefined;
      if (attempt.recovery_dispatch_id || attempt.recovery_case_revision_id) {
        if (!attempt.recovery_dispatch_id || !attempt.recovery_case_revision_id) {
          throw new Error("STORY_COMPLETION_RECOVERY_IDENTITY_INCOMPLETE");
        }
        const deliveries = await transaction.unsafe<Array<{
          state: string;
          attempt_id: string | null;
          claim_id: string | number | null;
          lease_expires_at: Date | string | null;
        }>>(
          `SELECT state, attempt_id, claim_id, lease_expires_at
             FROM recovery_dispatch_deliveries
            WHERE dispatch_id = $1 AND revision_id = $2
            FOR UPDATE`,
          [attempt.recovery_dispatch_id, attempt.recovery_case_revision_id],
        );
        recoveryDelivery = deliveries[0];
      }
      ownerClock = await readDatabaseWallClock(
        transaction,
        "STORY_COMPLETION_DATABASE_TIME_UNAVAILABLE",
      );
      if (
        !attempt.lease_expires_at
        || new Date(attempt.lease_expires_at).getTime() <= ownerClock.getTime()
      ) {
        throw new Error("STORY_COMPLETION_ATTEMPT_LEASE_EXPIRED");
      }
      if (
        attempt.recovery_dispatch_id
        && (
          !recoveryDelivery
          || !["attempt_reserved", "running"].includes(recoveryDelivery.state)
          || recoveryDelivery.attempt_id !== attempt.attempt_id
          || Number(recoveryDelivery.claim_id) !== envelope.claimId
          || !recoveryDelivery.lease_expires_at
          || new Date(recoveryDelivery.lease_expires_at).getTime() <= ownerClock.getTime()
        )
      ) {
        throw new Error("STORY_COMPLETION_RECOVERY_LEASE_EXPIRED");
      }
      if (
        claim.protocol === "v3"
        && (
          attempt.source_after_sha !== input.sourceAfter.sha
          || attempt.source_after_tree_hash !== input.sourceAfter.treeHash
        )
      ) {
        throw new Error("STORY_COMPLETION_V3_CANDIDATE_SOURCE_MISMATCH");
      }
      const refs = parseEvidenceRefs(attempt.evidence_refs);
      if (input.attemptDisposition && claim.protocol !== "v3") {
        throw new Error("STORY_COMPLETION_EXPLICIT_DISPOSITION_REQUIRES_V3");
      }
      if (
        input.attemptDisposition === "verified"
        && !["done", "verified"].includes(input.storyStatus)
      ) {
        throw new Error("STORY_COMPLETION_VERIFIED_DISPOSITION_STATE_MISMATCH");
      }
      if (
        input.attemptDisposition
        && ["failed", "inconclusive", "no_progress"].includes(input.attemptDisposition)
        && input.storyStatus !== "failed"
      ) {
        throw new Error("STORY_COMPLETION_FAILURE_DISPOSITION_STATE_MISMATCH");
      }
      attemptDisposition = input.attemptDisposition ?? ((
        attempt.source_before_sha !== input.sourceAfter.sha
        || attempt.source_before_tree_hash !== input.sourceAfter.treeHash
      ) ? "produced_delta" : "already_satisfied");
      const evidenceRefs = [...new Set([
        ...refs,
        ...(input.evidenceRefs ?? []),
        `setfarm://claim-completion/${envelope.claimId}`,
      ])].sort();
      const completed = await transaction.unsafe<Array<{ attempt_id: string }>>(
        `UPDATE execution_attempts
            SET disposition = $4,
                source_after_sha = $5,
                source_after_tree_hash = $6,
                output_hash = $7,
                evidence_refs = $8,
                heartbeat_at = $9,
                updated_at = $9
          WHERE attempt_id = $1
            AND generation = $2
            AND fence_token = $3
            AND disposition IN ('claimed', 'running')
            AND lease_expires_at > $9
            AND (
              source_after_sha IS NULL
              OR (source_after_sha = $5 AND source_after_tree_hash = $6)
            )
          RETURNING attempt_id`,
        [
          expected.attemptId,
          expected.generation,
          expected.fenceToken,
          attemptDisposition,
          input.sourceAfter.sha,
          input.sourceAfter.treeHash,
          input.outputHash ?? null,
          JSON.stringify(evidenceRefs),
          ownerClock,
        ],
      );
      if (completed.length !== 1) throw new Error("STORY_COMPLETION_ATTEMPT_CAS_LOST");
    }

    const now = ownerClock ?? await readDatabaseWallClock(
      transaction,
      "STORY_COMPLETION_DATABASE_TIME_UNAVAILABLE",
    );
    const closed = await transaction.unsafe<Array<{ id: string }>>(
      `UPDATE claim_log
          SET outcome = 'completed',
              duration_ms = LEAST(
                CAST(EXTRACT(EPOCH FROM ($2::timestamptz - claimed_at::timestamptz)) * 1000 AS BIGINT),
                2147483647
              )::INTEGER,
              diagnostic = $3
        WHERE id = $1 AND outcome IS NULL
        RETURNING id::text`,
      [envelope.claimId, now, (input.diagnostic || "Exact story claim completed").slice(0, 1_000)],
    );
    if (closed.length !== 1) throw new Error("STORY_COMPLETION_CLAIM_CAS_LOST");

    if (input.runContextJson !== undefined) {
      let parsedContext: unknown;
      try {
        parsedContext = JSON.parse(input.runContextJson);
      } catch {
        throw new Error("STORY_COMPLETION_RUN_CONTEXT_INVALID");
      }
      if (!parsedContext || typeof parsedContext !== "object" || Array.isArray(parsedContext)) {
        throw new Error("STORY_COMPLETION_RUN_CONTEXT_INVALID");
      }
      const runUpdated = await transaction.unsafe<Array<{ id: string }>>(
        `UPDATE runs
            SET context = $2, updated_at = $3
          WHERE id = $1
            AND status IN ('running', 'resuming')
          RETURNING id`,
        [envelope.runId, input.runContextJson, now],
      );
      if (runUpdated.length !== 1) throw new Error("STORY_COMPLETION_RUN_CONTEXT_CAS_LOST");
    }

    const storyUpdated = await transaction.unsafe<Array<{ id: string }>>(
      `UPDATE stories
          SET status = $2,
              output = $3,
              pr_url = $4,
              story_branch = $5,
              merge_status = COALESCE($6, merge_status),
              claimed_by = NULL,
              claimed_at = NULL,
              updated_at = $7
        WHERE id = $1
          AND run_id = $8
          AND story_id = $9
          AND status = 'running'
        RETURNING id`,
      [
        envelope.storyDbId,
        input.storyStatus,
        input.storyOutput,
        input.storyPrUrl ?? "",
        input.storyBranch ?? "",
        input.storyMergeStatus ?? null,
        now,
        envelope.runId,
        envelope.storyId,
      ],
    );
    if (storyUpdated.length !== 1) throw new Error("STORY_COMPLETION_STORY_CAS_LOST");

    const stepUpdated = await transaction.unsafe<Array<{ id: string }>>(
      `UPDATE steps
          SET status = $2,
              current_story_id = NULL,
              output = $3,
              updated_at = $4
        WHERE id = $1
          AND status = 'running'
          AND current_story_id = $5
        RETURNING id`,
      [envelope.stepId, input.stepStatus, input.stepOutput, now, envelope.storyDbId],
    );
    if (stepUpdated.length !== 1) throw new Error("STORY_COMPLETION_STEP_CAS_LOST");
    await markRuntimeCompletionOwnerCommittedInTransaction(transaction, {
      claimId: envelope.claimId,
      claimOutcome: "completed",
      plan: input.completionPlan ?? createSingleEffectCompletionPlanDescriptorV1({
        kind: "story_completion",
        continuation: { type: "story_loop_continue" },
        subject: { storyDbId: envelope.storyDbId, storyId: envelope.storyId },
      }),
      now,
    });

    return {
      status: "completed" as const,
      claimId: envelope.claimId,
      ...(envelope.attempt ? { attemptId: envelope.attempt.attemptId, attemptDisposition } : {}),
    };
  }) as Promise<CompletedStoryClaimTransitionResult>;
}

export type CompleteSingleStepClaimAndStateInput = Readonly<{
  envelope: ClaimEnvelopeV1;
  stepStatus: "done" | "waiting" | "pending";
  stepOutput: string;
  clearCurrentStory?: boolean;
  completionPlan?: RuntimeCompletionPlanDescriptorV1;
  diagnostic?: string;
  now?: Date;
}>;

/**
 * Close one exact non-story claim and publish its step state inside a caller's
 * transaction. Evidence ledgers whose publication is part of completion may
 * use this primitive without opening a second transaction.
 */
export async function completeSingleStepClaimAndStateInTransaction(
  transaction: postgres.TransactionSql,
  input: CompleteSingleStepClaimAndStateInput,
): Promise<CompletedSingleStepClaimTransitionResult> {
  const envelope = input.envelope;
  if (envelope.storyId || envelope.storyDbId || envelope.attempt) {
    throw new Error("SINGLE_STEP_COMPLETION_STORY_IDENTITY_FORBIDDEN");
  }
  const callerTime = input.now ? new Date(input.now) : new Date();
  if (!Number.isFinite(callerTime.getTime())) throw new Error("SINGLE_STEP_COMPLETION_TIME_INVALID");

  await closeExactSingleStepClaimInTransaction(transaction, {
    envelope,
    outcome: "completed",
    diagnostic: input.diagnostic || "Exact single-step claim completed",
    now: callerTime,
  });

  const now = await readDatabaseWallClock(
    transaction,
    "SINGLE_STEP_COMPLETION_DATABASE_TIME_UNAVAILABLE",
  );

  const updated = await transaction.unsafe<Array<{ id: string }>>(
    `UPDATE steps
        SET status = $2,
            output = $3,
            current_story_id = CASE WHEN $4 THEN NULL ELSE current_story_id END,
            updated_at = $5
      WHERE id = $1
        AND status IN ('running', 'pending')
      RETURNING id`,
    [envelope.stepId, input.stepStatus, input.stepOutput, input.clearCurrentStory ?? false, now],
  );
  if (updated.length !== 1) throw new Error("SINGLE_STEP_COMPLETION_STEP_CAS_LOST");
  await markRuntimeCompletionOwnerCommittedInTransaction(transaction, {
    claimId: envelope.claimId,
    claimOutcome: "completed",
    plan: input.completionPlan ?? createSingleEffectCompletionPlanDescriptorV1({
      kind: "single_completion",
      continuation: { type: "single_pipeline_advance" },
    }),
    now,
  });
  return { status: "completed" as const, claimId: envelope.claimId, stepStatus: input.stepStatus };
}

/** Close one exact non-story claim and publish its step state atomically. */
export async function completeSingleStepClaimAndState(
  sql: postgres.Sql,
  input: Readonly<{
    envelope: ClaimEnvelopeV1;
    stepStatus: "done" | "waiting" | "pending";
    stepOutput: string;
    clearCurrentStory?: boolean;
    completionPlan?: RuntimeCompletionPlanDescriptorV1;
    diagnostic?: string;
    now?: Date;
  }>,
): Promise<CompletedSingleStepClaimTransitionResult> {
  return sql.begin(async (transaction) => completeSingleStepClaimAndStateInTransaction(
    transaction,
    input,
  )) as Promise<CompletedSingleStepClaimTransitionResult>;
}
