import type postgres from "postgres";

import {
  OperationalRetryDirectiveV1Schema,
  serializeOperationalRetryDirectiveV1,
  type OperationalRetryDirectiveV1,
} from "./operational-retry-directive.js";
import {
  closeClaimAndBoundAttemptInTransaction,
  type TerminalClaimTransitionResult,
} from "./claim-attempt-transition.js";

type TransactionSql = postgres.Sql | postgres.TransactionSql;

type OperationalRetryTransitionIdentity = Readonly<{
  claimId: number;
  attemptId: string;
  attemptGeneration: number;
  runId: string;
  stepId: string;
  stepDbId: string;
  storyId: string;
  storyDbId: string;
  agentId: string;
}>;

type BoundAttemptRow = Readonly<{
  attempt_id: string;
  generation: number;
  attempt_class: string;
  packet_hash: string | null;
  slice_hash: string | null;
  source_before_sha: string;
  source_before_tree_hash: string;
  disposition: string;
  evidence_refs: string;
}>;

async function loadClosedBoundAttempt(
  transaction: TransactionSql,
  input: OperationalRetryTransitionIdentity,
): Promise<BoundAttemptRow> {
  const rows = await transaction.unsafe<BoundAttemptRow[]>(
    `SELECT attempt_id, generation, attempt_class, packet_hash, slice_hash,
            source_before_sha, source_before_tree_hash, disposition, evidence_refs
       FROM execution_attempts
      WHERE attempt_id = $1
        AND claim_id = $2
        AND run_id = $3
        AND step_id = $4
        AND story_id = $5
        AND generation = $6
      LIMIT 1`,
    [
      input.attemptId,
      input.claimId,
      input.runId,
      input.stepId,
      input.storyId,
      input.attemptGeneration,
    ],
  );
  const attempt = rows[0];
  if (!attempt) throw new Error("OPERATIONAL_RETRY_ATTEMPT_BINDING_MISMATCH");
  return attempt;
}

function assertDirectiveIdentity(
  identity: OperationalRetryTransitionIdentity,
  directive: OperationalRetryDirectiveV1,
): void {
  if (
    directive.runId !== identity.runId
    || directive.stepId !== identity.stepId
    || directive.storyId !== identity.storyId
    || directive.priorAttempt.claimId !== identity.claimId
    || directive.priorAttempt.terminalDisposition !== "inconclusive"
  ) {
    throw new Error("OPERATIONAL_RETRY_TRANSITION_IDENTITY_MISMATCH");
  }
}

async function publishStoryAndStepState(
  transaction: TransactionSql,
  input: OperationalRetryTransitionIdentity & Readonly<{
    storyStatus: "pending" | "failed";
    stepStatus: "pending" | "waiting";
    output: string;
    now: Date;
  }>,
): Promise<void> {
  const storyRows = await transaction.unsafe<Array<{ id: string }>>(
    `UPDATE stories
        SET status = $5,
            claimed_at = NULL,
            claimed_by = NULL,
            output = $6,
            updated_at = $7
      WHERE id = $1
        AND run_id = $2
        AND story_id = $3
        AND status = 'running'
        AND claimed_by = $4
      RETURNING id`,
    [
      input.storyDbId,
      input.runId,
      input.storyId,
      input.agentId,
      input.storyStatus,
      input.output,
      input.now,
    ],
  );
  if (storyRows.length !== 1) {
    throw new Error("OPERATIONAL_RETRY_STORY_STATE_CAS_LOST");
  }
  const stepRows = await transaction.unsafe<Array<{ id: string }>>(
    `UPDATE steps
        SET status = $5,
            current_story_id = NULL,
            updated_at = $6
      WHERE id = $1
        AND run_id = $2
        AND step_id = $3
        AND current_story_id = $4
        AND status IN ('pending', 'running', 'waiting')
      RETURNING id`,
    [
      input.stepDbId,
      input.runId,
      input.stepId,
      input.storyDbId,
      input.stepStatus,
      input.now,
    ],
  );
  if (stepRows.length !== 1) {
    throw new Error("OPERATIONAL_RETRY_STEP_STATE_CAS_LOST");
  }
}

/**
 * Atomically closes the exact product attempt and publishes the sole typed
 * authority for its one bounded infrastructure retry. No observer can see a
 * retryable story while the previous immutable owner is still active.
 */
export async function publishOperationalRetryDirectiveInTransaction(
  transaction: TransactionSql,
  input: OperationalRetryTransitionIdentity & Readonly<{
    diagnostic: string;
    directive: OperationalRetryDirectiveV1;
    now?: Date;
  }>,
): Promise<TerminalClaimTransitionResult> {
  const directive = OperationalRetryDirectiveV1Schema.parse(input.directive);
  assertDirectiveIdentity(input, directive);
  const now = input.now ? new Date(input.now) : new Date();
  const closed = await closeClaimAndBoundAttemptInTransaction(transaction, {
    claimId: input.claimId,
    runId: input.runId,
    stepId: input.stepId,
    storyId: input.storyId,
    agentId: input.agentId,
    outcome: "infra_retry",
    diagnostic: input.diagnostic,
    now,
  });
  if (closed.status !== "closed") return closed;
  const attempt = await loadClosedBoundAttempt(transaction, input);
  if (
    closed.attemptId !== input.attemptId
    || input.attemptId !== directive.priorAttempt.attemptId
    || input.attemptGeneration !== directive.priorAttempt.generation
    || attempt.attempt_class !== "product_implementation"
    || attempt.packet_hash !== directive.priorAttempt.packetHash
    || attempt.slice_hash !== directive.priorAttempt.sliceHash
    || attempt.source_before_sha !== directive.priorAttempt.sourceBefore.sha
    || attempt.source_before_tree_hash !== directive.priorAttempt.sourceBefore.treeHash
    || attempt.disposition !== directive.priorAttempt.terminalDisposition
    || closed.attemptDisposition !== directive.priorAttempt.terminalDisposition
  ) {
    throw new Error("OPERATIONAL_RETRY_TERMINAL_ATTEMPT_MISMATCH");
  }
  await publishStoryAndStepState(transaction, {
    ...input,
    storyStatus: "pending",
    stepStatus: "pending",
    output: serializeOperationalRetryDirectiveV1(directive),
    now,
  });
  return closed;
}

/**
 * Atomically terminalizes the one fallback and its visible story/step state.
 * This is a platform-owned terminal outcome, not another model dispatch.
 */
export async function terminalizeOperationalRetryExhaustionInTransaction(
  transaction: TransactionSql,
  input: OperationalRetryTransitionIdentity & Readonly<{
    diagnostic: string;
    directive: OperationalRetryDirectiveV1;
    now?: Date;
  }>,
): Promise<TerminalClaimTransitionResult> {
  const directive = OperationalRetryDirectiveV1Schema.parse(input.directive);
  if (
    directive.runId !== input.runId
    || directive.stepId !== input.stepId
    || directive.storyId !== input.storyId
  ) {
    throw new Error("OPERATIONAL_RETRY_EXHAUSTION_IDENTITY_MISMATCH");
  }
  const now = input.now ? new Date(input.now) : new Date();
  const closed = await closeClaimAndBoundAttemptInTransaction(transaction, {
    claimId: input.claimId,
    runId: input.runId,
    stepId: input.stepId,
    storyId: input.storyId,
    agentId: input.agentId,
    outcome: "failed",
    diagnostic: input.diagnostic,
    now,
  });
  if (closed.status !== "closed") return closed;
  const attempt = await loadClosedBoundAttempt(transaction, input);
  let evidenceRefs: unknown;
  try {
    evidenceRefs = JSON.parse(attempt.evidence_refs);
  } catch {
    throw new Error("OPERATIONAL_RETRY_EXHAUSTION_EVIDENCE_INVALID");
  }
  if (
    closed.attemptId !== input.attemptId
    || attempt.attempt_class !== "infrastructure_retry"
    || attempt.generation !== directive.priorAttempt.generation + 1
    || attempt.packet_hash !== directive.priorAttempt.packetHash
    || attempt.slice_hash !== directive.priorAttempt.sliceHash
    || attempt.source_before_sha !== directive.nextSourceRevision.sha
    || attempt.source_before_tree_hash !== directive.nextSourceRevision.treeHash
    || attempt.disposition !== "failed"
    || !Array.isArray(evidenceRefs)
    || !evidenceRefs.includes(`setfarm://operational-retry/${directive.directiveHash}`)
  ) {
    throw new Error("OPERATIONAL_RETRY_EXHAUSTION_ATTEMPT_MISMATCH");
  }
  await publishStoryAndStepState(transaction, {
    ...input,
    storyStatus: "failed",
    stepStatus: "waiting",
    output: input.diagnostic,
    now,
  });
  return closed;
}
