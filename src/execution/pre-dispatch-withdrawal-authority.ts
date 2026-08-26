import type postgres from "postgres";

import { readDatabaseWallClock } from "../db/database-wall-clock.js";
import {
  closeInternalProductionOwnerReservationV1,
  resolveInternalProductionClaimTerminalAuthorityPairInTransactionV1,
  resolveInternalProductionExecutionAttemptTerminalAuthorityPairInTransactionV1,
  type PgTransactionSql,
} from "../db-pg.js";
import { acquireClaimMutationAuthorityInTransaction } from "./claim-mutation-authority.js";
import { releaseReservedRuntimeSessionInTransaction } from "./runtime-session-repository.js";

export type PreDispatchWithdrawalIdentity = Readonly<{
  claimId: number;
  runId: string;
  workflowStepId: string;
  storyId: string | null;
  claimAgentId: string;
  runtime?: Readonly<{ sessionId: string; ownerInstanceId: string }>;
}>;

export type PreDispatchWithdrawalResult =
  | Readonly<{ status: "withdrawn" }>
  | Readonly<{
      status: "fenced";
      attempt: { attemptId: string; generation: number; fenceToken: string };
    }>
  | Readonly<{ status: "blocked"; reason: string }>;

/**
 * Withdraw an exact claim that has not crossed the runtime-start boundary.
 * The common authority excludes completion, termination, quarantine and
 * recovery delivery owners before any claim/attempt/runtime mutation.
 */
export async function withdrawPreDispatchClaimInTransaction(
  transaction: postgres.TransactionSql,
  input: Readonly<{
    identity: PreDispatchWithdrawalIdentity;
    outcome: string;
    diagnostic: string;
    preserveExactAttempt?: boolean;
  }>,
): Promise<PreDispatchWithdrawalResult> {
  await acquireClaimMutationAuthorityInTransaction(
    transaction,
    input.identity,
    input.preserveExactAttempt
      ? "compiler_duplicate_withdrawal"
      : "pre_dispatch_withdrawal",
  );
  const attempts = await transaction.unsafe<Array<{
    attempt_id: string;
    claim_id: string | null;
    generation: number;
    fence_token: string;
    agent_id: string | null;
  }>>(
    `SELECT attempt_id, claim_id::text, generation, fence_token, agent_id
       FROM execution_attempts
      WHERE run_id = $1 AND step_id = $2 AND story_id = $3
        AND disposition IN ('claimed', 'running')
      ORDER BY attempt_id
      FOR UPDATE`,
    [input.identity.runId, input.identity.workflowStepId, input.identity.storyId],
  );
  if (attempts.length > 1) throw new Error("PRE_DISPATCH_ACTIVE_FENCE_AMBIGUOUS");
  const attempt = attempts[0];
  const exactAttempt = attempt
    && attempt.claim_id === String(input.identity.claimId)
    && (attempt.agent_id === null || attempt.agent_id === input.identity.claimAgentId);
  if (input.preserveExactAttempt && exactAttempt) {
    return {
      status: "fenced",
      attempt: {
        attemptId: attempt.attempt_id,
        generation: attempt.generation,
        fenceToken: attempt.fence_token,
      },
    };
  }
  if (attempt && !exactAttempt) throw new Error("PRE_DISPATCH_ATTEMPT_IDENTITY_MISMATCH");
  const blockedByDifferentAttempt = Boolean(input.preserveExactAttempt && attempt);
  const foreignDeliveries = input.preserveExactAttempt && input.identity.storyId
    ? await transaction.unsafe<Array<{
      dispatch_id: string;
      attempt_id: string | null;
      claim_id: string | number | null;
    }>>(
      `SELECT delivery.dispatch_id, delivery.attempt_id, delivery.claim_id
         FROM recovery_dispatch_deliveries delivery
        WHERE delivery.run_id = $1 AND delivery.story_id = $2
          AND delivery.state IN ('authorized', 'leased', 'attempt_reserved', 'running')
        ORDER BY delivery.authorized_at, delivery.dispatch_id
        LIMIT 1
        FOR UPDATE OF delivery`,
      [input.identity.runId, input.identity.storyId],
    )
    : [];
  if (foreignDeliveries.some((delivery) => (
    (delivery.attempt_id === null) !== (delivery.claim_id === null)
  ))) {
    throw new Error("PRE_DISPATCH_DELIVERY_CLAIM_ATTEMPT_PAIR_INVALID");
  }
  const foreignOwnerRetained = foreignDeliveries.some((delivery) => (
    delivery.claim_id === null
    || Number(delivery.claim_id) !== input.identity.claimId
  ));

  const runtimeRows = await transaction.unsafe<Array<{
    session_id: string;
    owner_instance_id: string;
    state: string;
  }>>(
    `SELECT session_id, owner_instance_id, state
       FROM runtime_sessions WHERE claim_id = $1
       ORDER BY session_id FOR UPDATE`,
    [input.identity.claimId],
  );
  if (runtimeRows.length > 1) throw new Error("PRE_DISPATCH_RUNTIME_AMBIGUOUS");
  const runtime = runtimeRows[0];
  if (input.identity.runtime && (
    !runtime
    || runtime.session_id !== input.identity.runtime.sessionId
    || runtime.owner_instance_id !== input.identity.runtime.ownerInstanceId
  )) throw new Error("PRE_DISPATCH_RUNTIME_IDENTITY_MISMATCH");
  if (runtime && !["reserved", "released"].includes(runtime.state)) {
    throw new Error(`PRE_DISPATCH_RUNTIME_STATE_INVALID:${runtime.state}`);
  }
  const wallClock = await readDatabaseWallClock(
    transaction,
    "PRE_DISPATCH_DATABASE_TIME_UNAVAILABLE",
  );

  const claims = await transaction.unsafe<Array<{ id: string }>>(
    `UPDATE claim_log
        SET outcome = $2, abandoned_at = $4,
            duration_ms = LEAST(
              CAST(EXTRACT(EPOCH FROM ($4::timestamptz - claimed_at::timestamptz)) * 1000 AS BIGINT),
              2147483647
            )::INTEGER,
            diagnostic = $3
      WHERE id = $1 AND outcome IS NULL
      RETURNING id::text`,
    [input.identity.claimId, input.outcome, input.diagnostic.slice(0, 1_000), wallClock],
  );
  if (claims.length !== 1) throw new Error("PRE_DISPATCH_CLAIM_CAS_LOST");
  const terminalAttempts = attempt
    ? await transaction.unsafe<Array<{ attempt_id: string }>>(
    `UPDATE execution_attempts
        SET disposition = 'inconclusive', updated_at = $2
      WHERE attempt_id = $1
        AND claim_id = $3
        AND generation = $4
        AND fence_token = $5
        AND disposition IN ('claimed', 'running')
      RETURNING attempt_id`,
    [attempt.attempt_id, wallClock, input.identity.claimId, attempt.generation, attempt.fence_token],
  )
    : [];
  if (attempt && terminalAttempts.length !== 1) {
    throw new Error("PRE_DISPATCH_ATTEMPT_CAS_LOST");
  }
  const attemptClose = attempt
    ? await resolveInternalProductionExecutionAttemptTerminalAuthorityPairInTransactionV1(
        transaction as PgTransactionSql,
        { attemptId: attempt.attempt_id },
      )
    : undefined;
  const claimClose = await resolveInternalProductionClaimTerminalAuthorityPairInTransactionV1(
    transaction as PgTransactionSql,
    { claimIdText: claims[0]!.id },
  );
  if (attemptClose) {
    await closeInternalProductionOwnerReservationV1(
      transaction as PgTransactionSql,
      attemptClose,
    );
  }
  await closeInternalProductionOwnerReservationV1(
    transaction as PgTransactionSql,
    claimClose,
  );
  if (runtime) {
    if (runtime.state === "reserved") {
      await releaseReservedRuntimeSessionInTransaction(transaction, {
        sessionId: runtime.session_id,
        claimId: input.identity.claimId,
        ownerInstanceId: runtime.owner_instance_id,
        diagnostic: input.diagnostic,
      });
    }
  }
  return foreignOwnerRetained
    ? { status: "blocked", reason: "COMPILER_CLAIM_FOREIGN_OWNER_RETAINED" }
    : blockedByDifferentAttempt
      ? { status: "blocked", reason: "COMPILER_CLAIM_DIFFERENT_ACTIVE_FENCE" }
    : { status: "withdrawn" };
}
