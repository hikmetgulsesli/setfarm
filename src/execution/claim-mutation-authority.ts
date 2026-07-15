import type postgres from "postgres";

import { readDatabaseWallClock } from "../db/database-wall-clock.js";
import { v3RecoveryStoryLockIdentity } from "../recovery/v3-recovery-claim-authority.js";
import { currentRuntimeCompletionOwnerCapability } from "./runtime-completion-owner-context.js";

type TransactionSql = postgres.TransactionSql;

export type ClaimMutationIdentity = Readonly<{
  claimId: number;
  runId: string;
  workflowStepId: string;
  storyId: string | null;
  claimAgentId: string;
}>;

export type ClaimMutationAuthorityMode =
  | "claim_transition"
  | "orphan_recovery"
  | "pre_dispatch_withdrawal"
  | "compiler_duplicate_withdrawal";

export type DurableClaimOwnerType =
  | "runtime_completion"
  | "run_termination"
  | "runtime_quarantine"
  | "runtime_session"
  | "recovery_dispatch";

export class ClaimMutationAuthorityError extends Error {
  readonly code = "CLAIM_MUTATION_DURABLE_OWNER_ACTIVE";

  constructor(
    readonly ownerType: DurableClaimOwnerType,
    readonly ownerId: string,
    readonly ownerState: string,
  ) {
    super(`CLAIM_MUTATION_DURABLE_OWNER_ACTIVE:${ownerType}:${ownerState}:${ownerId}`);
    this.name = "ClaimMutationAuthorityError";
  }
}

export function isClaimMutationAuthorityError(error: unknown): error is ClaimMutationAuthorityError {
  return error instanceof ClaimMutationAuthorityError
    || (error instanceof Error && (
      error.message.startsWith("CLAIM_MUTATION_DURABLE_OWNER_ACTIVE:")
      || error.message === "CLAIM_MUTATION_CLAIM_TERMINAL"
      || error.message.startsWith("CLAIM_MUTATION_RUN_NOT_ACTIVE:")
      || error.message === "CLAIM_ORPHAN_RECOVERY_ENVELOPE_UNAVAILABLE"
      || error.message === "CLAIM_AUTHORITY_ALREADY_TERMINAL"
      || error.message === "CLAIM_AUTHORITY_RUN_NOT_ACTIVE"
      || error.message === "CLAIM_AUTHORITY_STEP_NOT_RUNNING"
    ));
}

function assertTransactionCapability(transaction: TransactionSql): void {
  const capability = transaction as unknown as { savepoint?: unknown; prepare?: unknown };
  if (typeof capability.savepoint !== "function" || typeof capability.prepare !== "function") {
    throw new Error("CLAIM_MUTATION_TRANSACTION_REQUIRED");
  }
}

/**
 * Linearizable durable-owner check performed by every exact claim failure
 * transition. Orphan recovery adds only the runtime state_version CAS fence;
 * the owner exclusions are invariant for normal worker failure as well.
 */
export async function acquireClaimMutationAuthorityInTransaction(
  transaction: TransactionSql,
  input: ClaimMutationIdentity,
  mode: ClaimMutationAuthorityMode = "claim_transition",
): Promise<void> {
  assertTransactionCapability(transaction);
  if (!Number.isSafeInteger(input.claimId) || input.claimId <= 0) {
    throw new Error("CLAIM_MUTATION_CLAIM_ID_INVALID");
  }
  if (input.storyId) {
    await transaction.unsafe("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [
      v3RecoveryStoryLockIdentity({ runId: input.runId, storyId: input.storyId }),
    ]);
  }

  const runs = await transaction.unsafe<Array<{ status: string }>>(
    "SELECT status FROM runs WHERE id = $1 FOR UPDATE",
    [input.runId],
  );
  const run = runs[0];
  if (!run) throw new Error("CLAIM_MUTATION_RUN_NOT_FOUND");

  const terminations = await transaction.unsafe<Array<{ request_id: string; state: string }>>(
    `SELECT request_id, state
       FROM run_termination_requests
      WHERE run_id = $1 AND state <> 'terminalized'
      ORDER BY requested_at, request_id
      LIMIT 1
      FOR UPDATE`,
    [input.runId],
  );
  if (terminations[0]) {
    throw new ClaimMutationAuthorityError(
      "run_termination",
      terminations[0].request_id,
      terminations[0].state,
    );
  }
  if (!["running", "resuming"].includes(run.status)) {
    throw new Error(`CLAIM_MUTATION_RUN_NOT_ACTIVE:${run.status}`);
  }

  // Global mutation order: advisory -> run -> termination -> runtime ->
  // attempt -> delivery -> claim -> completion. Recovery lifecycle and runtime
  // publication use the same order, preventing cross-owner deadlocks.
  const runtimeSessions = await transaction.unsafe<Array<{
    session_id: string;
    state: string;
    attempt_id: string | null;
  }>>(
    `SELECT session_id, state, attempt_id
       FROM runtime_sessions
      WHERE claim_id = $1
      ORDER BY session_id
      FOR UPDATE`,
    [input.claimId],
  );
  const attempts = await transaction.unsafe<Array<{
    attempt_id: string;
    recovery_dispatch_id: string | null;
    recovery_case_revision_id: string | null;
  }>>(
    `SELECT attempt_id, recovery_dispatch_id, recovery_case_revision_id
       FROM execution_attempts
      WHERE (($2::text IS NOT NULL AND run_id = $3 AND step_id = $4 AND story_id = $2)
          OR ($2::text IS NULL AND claim_id = $1))
        AND disposition IN ('claimed', 'running')
      ORDER BY attempt_id
      FOR UPDATE`,
    [input.claimId, input.storyId, input.runId, input.workflowStepId],
  );
  const deliveries = input.storyId
    ? await transaction.unsafe<Array<{
        dispatch_id: string;
        state: string;
        claim_id: string | number | null;
        attempt_id: string | null;
        revision_id: string;
      }>>(
        `SELECT dispatch_id, state, claim_id, attempt_id, revision_id
           FROM recovery_dispatch_deliveries
          WHERE run_id = $1 AND story_id = $2
            AND state IN ('authorized', 'leased', 'attempt_reserved', 'running')
          ORDER BY authorized_at, dispatch_id
          LIMIT 1
          FOR UPDATE`,
        [input.runId, input.storyId],
      )
    : [];

  const claims = await transaction.unsafe<Array<{
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
  const claim = claims[0];
  if (!claim) throw new Error("CLAIM_MUTATION_CLAIM_NOT_FOUND");
  if (
    claim.run_id !== input.runId
    || claim.step_id !== input.workflowStepId
    || (claim.story_id ?? null) !== input.storyId
    || claim.agent_id !== input.claimAgentId
  ) throw new Error("CLAIM_MUTATION_IDENTITY_MISMATCH");
  if (claim.outcome !== null) throw new Error("CLAIM_MUTATION_CLAIM_TERMINAL");

  const completions = await transaction.unsafe<Array<{
    request_id: string;
    state: string;
    apply_phase: string;
    owner_instance_id: string | null;
    lease_expires_at: Date | null;
    owner_attempt_count: number;
    runtime_session_id: string;
    attempt_id: string | null;
  }>>(
    `SELECT request_id, state, apply_phase, owner_instance_id,
            lease_expires_at, owner_attempt_count, runtime_session_id, attempt_id
       FROM runtime_completion_requests
      WHERE claim_id = $1
        AND state NOT IN ('accepted', 'rejected')
      ORDER BY requested_at, request_id
      FOR UPDATE`,
    [input.claimId],
  );
  const wallClock = await readDatabaseWallClock(
    transaction,
    "CLAIM_MUTATION_DATABASE_WALL_CLOCK_UNAVAILABLE",
  );
  const completionCapability = currentRuntimeCompletionOwnerCapability();
  const exactCompletion = completions.find((completion) => (
    completion.request_id === completionCapability?.requestId
    && completion.state === "processing"
    && completion.apply_phase === "executing"
    && completion.owner_instance_id === completionCapability.ownerInstanceId
    && completion.owner_attempt_count === completionCapability.ownerAttemptCount
    && completion.lease_expires_at !== null
    && new Date(completion.lease_expires_at).getTime() > wallClock.getTime()
    && runtimeSessions.some((runtime) => (
      runtime.session_id === completion.runtime_session_id
      && runtime.state === "drained"
    ))
  ));
  const foreignCompletion = completions.find((completion) => completion !== exactCompletion);
  if (foreignCompletion) {
    throw new ClaimMutationAuthorityError(
      "runtime_completion",
      foreignCompletion.request_id,
      foreignCompletion.state,
    );
  }

  const quarantinedRuntime = runtimeSessions.find((runtime) => runtime.state === "quarantined");
  if (quarantinedRuntime) {
    throw new ClaimMutationAuthorityError(
      "runtime_quarantine",
      quarantinedRuntime.session_id,
      quarantinedRuntime.state,
    );
  }
  if (
    ["claim_transition", "orphan_recovery"].includes(mode)
    && runtimeSessions.some((runtime) => !["reserved", "drained", "released"].includes(runtime.state))
  ) {
    const runtime = runtimeSessions.find(
      (item) => !["reserved", "drained", "released"].includes(item.state),
    )!;
    throw new ClaimMutationAuthorityError("runtime_session", runtime.session_id, runtime.state);
  }
  if (
    ["pre_dispatch_withdrawal", "compiler_duplicate_withdrawal"].includes(mode)
    && runtimeSessions.some((runtime) => !["reserved", "released"].includes(runtime.state))
  ) {
    const runtime = runtimeSessions.find((item) => !["reserved", "released"].includes(item.state))!;
    throw new ClaimMutationAuthorityError("runtime_session", runtime.session_id, runtime.state);
  }

  if (input.storyId) {
    const delivery = deliveries[0];
    const attempt = attempts.find((candidate) => candidate.attempt_id === delivery?.attempt_id);
    const runtime = runtimeSessions.find((candidate) => candidate.attempt_id === delivery?.attempt_id);
    const exactRecoveryCompletion = delivery
      && exactCompletion
      && Number(delivery.claim_id) === input.claimId
      && delivery.attempt_id === exactCompletion.attempt_id
      && runtime?.session_id === exactCompletion.runtime_session_id
      && attempt?.recovery_dispatch_id === delivery.dispatch_id
      && attempt.recovery_case_revision_id === delivery.revision_id;
    const foreignPreDispatchOwner = mode === "compiler_duplicate_withdrawal"
      && delivery
      && Number(delivery.claim_id) !== input.claimId;
    if (delivery && !exactRecoveryCompletion && !foreignPreDispatchOwner) {
      throw new ClaimMutationAuthorityError(
        "recovery_dispatch",
        delivery.dispatch_id,
        delivery.state,
      );
    }
  }

  if (mode === "orphan_recovery" && runtimeSessions.length > 0) {
    const fencedRuntimes = await transaction.unsafe<Array<{ session_id: string }>>(
      `UPDATE runtime_sessions
          SET state_version = state_version + 1,
              updated_at = $2
        WHERE claim_id = $1
        RETURNING session_id`,
      [input.claimId, wallClock],
    );
    if (fencedRuntimes.length !== runtimeSessions.length) {
      throw new Error("CLAIM_MUTATION_RUNTIME_FENCE_CAS_LOST");
    }
  }
}
