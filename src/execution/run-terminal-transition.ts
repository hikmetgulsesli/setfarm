import type postgres from "postgres";

import {
  assertInternalProductionRecoverySourceBootstrapRunDeliveryPendingInTransactionV1,
  closeInternalProductionOwnerReservationV1,
  lockInternalProductionWorkflowRunInsertionFenceV1,
  resolveInternalProductionClaimTerminalAuthorityPairInTransactionV1,
  resolveInternalProductionCompletionOwnerTerminalAuthorityPairInTransactionV1,
  resolveInternalProductionExecutionAttemptTerminalAuthorityPairInTransactionV1,
  resolveInternalProductionMandatoryEffectTerminalAuthorityPairInTransactionV1,
  resolveInternalProductionOwnerReservationCloseInTransactionV1,
  resolveInternalProductionRuntimeSessionTerminalAuthorityPairInTransactionV1,
  resolveInternalProductionRecoverySourceBootstrapActualRunTerminalInTransactionV1,
  resolveInternalProductionTerminationTerminalAuthorityPairInTransactionV1,
  resolveInternalProductionWorkflowRunTerminalAuthorityPairInTransactionV1,
} from "../db-pg.js";
import { readDatabaseWallClock } from "../db/database-wall-clock.js";
import {
  lockV3TerminalRecoveryChainInTransaction,
  settleV3TerminalRecoveryChainInTransaction,
  type V3TerminalRecoverySnapshot,
} from "../recovery/v3-terminal-recovery-chain.js";
import {
  markRuntimeCompletionOwnerCommittedInTransaction,
  terminalizeRuntimeCompletionForRunInTransactionV1,
} from "./runtime-completion.js";
import { releaseRuntimeSessionForTerminalRunInTransactionV1 } from "./runtime-session-repository.js";
import { canonicalJsonStringify, hashCanonicalJson } from "../product-compiler/canonical-json.js";
import { AcceptedCandidateV1Schema } from "../evidence/accepted-candidate-v1.js";
import { enqueueOperationalOutboxEventInTransaction } from "./operational-outbox-repository.js";
import { createSingleEffectCompletionPlanDescriptorV1 } from "./schemas/runtime-completion-plan-v1.js";
import { assertRuntimeCompletionManifestInTransactionV1 } from "./runtime-completion-manifest-authority-v1.js";
import {
  createInternalProductionCompletionOwnerCanonicalOwnerIdentityV1,
  createInternalProductionMandatoryEffectCanonicalOwnerIdentityV1,
  type PgTransactionSql as InternalProductionPgTransactionSql,
} from "../internal-production/owner-admission-v1.js";

export type RunTerminalStatus = "completed" | "failed" | "cancelled";

type RunRow = {
  id: string;
  status: string;
  protocol: string;
  context: string | Record<string, unknown>;
  packet_hash: string | null;
  accepted_candidate_hash: string | null;
  meta: string | Record<string, unknown> | null;
};

type ClaimRow = {
  id: string;
  step_id: string;
  story_id: string | null;
  agent_id: string;
  outcome: string | null;
};

type AttemptRow = {
  attempt_id: string;
  claim_id: string | null;
  step_id: string;
  story_id: string;
  generation: number;
  fence_token: string;
  agent_id: string | null;
  disposition: string;
  evidence_refs: string;
  packet_hash: string | null;
  compilation_report_hash: string;
  slice_hash: string | null;
};

type RuntimeRow = Readonly<{
  session_id: string;
  state: string;
  claim_id: string | number;
}>;

type CompletionRow = Readonly<{
  request_id: string;
  state: string;
  apply_phase: string;
}>;

type EffectRow = Readonly<{
  request_id: string;
  effect_key: string;
  ordinal: number;
  mandatory: boolean;
  state: string;
}>;

type TerminationRow = Readonly<{
  request_id: string;
  target_status: string;
  state: string;
}>;

export type RunTerminalTransitionResult = Readonly<{
  status: RunTerminalStatus;
  previousStatus: string;
  closedClaims: number;
  closedAttempts: number;
  closedRecoveryDeliveries: number;
  closedRecoveryCases: number;
  changedSteps: number;
  changedStories: number;
}>;

function evidenceRefs(raw: string): string[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("RUN_TERMINAL_ATTEMPT_EVIDENCE_INVALID");
  }
  if (!Array.isArray(parsed) || parsed.some((item) => typeof item !== "string")) {
    throw new Error("RUN_TERMINAL_ATTEMPT_EVIDENCE_INVALID");
  }
  return parsed;
}

function metaObject(raw: RunRow["meta"]): Record<string, unknown> {
  if (!raw) return {};
  if (typeof raw !== "string") return Array.isArray(raw) ? {} : { ...raw };
  try {
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? { ...(parsed as Record<string, unknown>) }
      : {};
  } catch {
    throw new Error("RUN_TERMINAL_META_INVALID");
  }
}

async function terminalizeRunTerminationRequestInTransactionV1(
  sql: postgres.TransactionSql,
  input: Readonly<{ requestId: string; runId: string; transitionTime: Date }>,
): Promise<string> {
  const rows = await sql.unsafe<Array<{ request_id: string }>>(
    `UPDATE run_termination_requests
        SET state = 'terminalized',terminalized_at = $3,heartbeat_at = $3,updated_at = $3
      WHERE request_id = $1 AND run_id = $2 AND state = 'drained'
      RETURNING request_id`,
    [input.requestId, input.runId, input.transitionTime],
  );
  if (rows.length !== 1 || rows[0]?.request_id !== input.requestId) {
    throw new Error("RUN_TERMINAL_REQUEST_CAS_LOST");
  }
  const reread = await sql.unsafe<Array<{ request_id: string; run_id: string; state: string }>>(
    `SELECT request_id,run_id,state FROM run_termination_requests
      WHERE request_id = $1 FOR UPDATE`,
    [input.requestId],
  );
  if (
    reread.length !== 1
    || reread[0]?.run_id !== input.runId
    || reread[0]?.state !== "terminalized"
  ) throw new Error("RUN_TERMINAL_REQUEST_REREAD_INVALID");
  return input.requestId;
}

async function normalizeTask5TerminalCompletionContractInTransactionV1(
  sql: postgres.TransactionSql,
  input: Readonly<{
    runId: string;
    runStatus: RunTerminalStatus;
    transitionTime: Date;
  }>,
): Promise<void> {
  if (input.runStatus === "cancelled") return;
  const candidates = await sql.unsafe<Array<{
    request_id: string;
    claim_id: string;
    outcome: string;
  }>>(
    `SELECT request.request_id,request.claim_id::text,claim.outcome
       FROM runtime_completion_requests request
       JOIN claim_log claim ON claim.id=request.claim_id
      WHERE request.run_id=$1
        AND request.state='processing'
        AND request.apply_phase='executing'
        AND claim.outcome IS NOT NULL
      ORDER BY request.request_id
      FOR UPDATE OF request,claim`,
    [input.runId],
  );
  for (const completion of candidates) {
    const numericClaimId = Number(completion.claim_id);
    if (!Number.isSafeInteger(numericClaimId) || numericClaimId <= 0) {
      throw new Error("RUN_TERMINAL_COMPLETION_CLAIM_ID_INVALID");
    }
    await markRuntimeCompletionOwnerCommittedInTransaction(sql, {
      claimId: numericClaimId,
      claimOutcome: completion.outcome,
      plan: createSingleEffectCompletionPlanDescriptorV1({
        kind: "terminal_transition",
        continuation: { type: "terminal_finalize" },
        effectPayload: { runStatus: input.runStatus },
      }),
      now: input.transitionTime,
    });
    const result = {
      runStatus: input.runStatus,
      advanced: false,
      runCompleted: input.runStatus === "completed",
      runFailed: input.runStatus === "failed",
    };
    const appliedEffects = await sql.unsafe<Array<{ effect_key: string }>>(
      `UPDATE runtime_completion_effects
          SET state='applied',applied_at=$2,result=$3::text::jsonb,
              evidence=$4::text::jsonb,updated_at=$2
        WHERE request_id=$1 AND mandatory AND state='pending'
        RETURNING effect_key`,
      [
        completion.request_id,
        input.transitionTime,
        JSON.stringify(result),
        JSON.stringify({
          schema: "setfarm.runtime-completion-effect-evidence.v1",
          source: "run-terminal-transaction",
          runId: input.runId,
        }),
      ],
    );
    if (appliedEffects.length !== 1) {
      throw new Error("RUN_TERMINAL_COMPLETION_EFFECT_CAS_LOST");
    }
    for (const effect of appliedEffects) {
      const effectClose = await resolveInternalProductionMandatoryEffectTerminalAuthorityPairInTransactionV1(
        sql as Parameters<typeof resolveInternalProductionMandatoryEffectTerminalAuthorityPairInTransactionV1>[0],
        { requestId: completion.request_id, effectKey: effect.effect_key },
      );
      const closedEffect = await closeInternalProductionOwnerReservationV1(
        sql as Parameters<typeof closeInternalProductionOwnerReservationV1>[0],
        effectClose,
      );
      const reopenedEffect = await resolveInternalProductionOwnerReservationCloseInTransactionV1(
        sql as Parameters<typeof resolveInternalProductionOwnerReservationCloseInTransactionV1>[0],
        { closeRef: closedEffect.closeRef, closeHash: closedEffect.closeHash },
      );
      if (
        reopenedEffect.reservationRef !== effectClose.reservationRef
        || reopenedEffect.reservationHash !== effectClose.reservationHash
      ) throw new Error("RUN_TERMINAL_COMPLETION_EFFECT_CLOSE_IDENTITY_INVALID");
    }
    await assertRuntimeCompletionManifestInTransactionV1(sql, {
      requestId: completion.request_id,
      requireSettledMandatoryEffects: true,
    });
    const committedEffects = await sql.unsafe<Array<{ request_id: string }>>(
      `UPDATE runtime_completion_requests
          SET apply_phase='effects_committed',effects_committed_at=$2,
              result=$3::text::jsonb,updated_at=$2
        WHERE request_id=$1 AND apply_phase='owner_committed'
        RETURNING request_id`,
      [completion.request_id, input.transitionTime, JSON.stringify(result)],
    );
    if (committedEffects.length !== 1) {
      throw new Error("RUN_TERMINAL_COMPLETION_COMMIT_CAS_LOST");
    }
  }
}

async function authenticateTask5ClosedMandatoryEffectReplayInTransactionV1(
  sql: postgres.TransactionSql,
  input: Readonly<{
    requestId: string;
    effectKey: string;
    state: "applied" | "reconciled";
  }>,
): Promise<void> {
  const identity = createInternalProductionMandatoryEffectCanonicalOwnerIdentityV1({
    requestId: input.requestId,
    effectKey: input.effectKey,
  });
  const ownerKeyHash = hashCanonicalJson({
    schema: "setfarm.internal-production-owner-key.v1",
    ownerKeyDerivationId: "completion-request-id-effect-key-v1",
    ownerKey: identity.ownerKey,
  });
  const effects = await sql.unsafe<Array<{ state: string }>>(
    `SELECT state FROM runtime_completion_effects
      WHERE request_id=$1 AND effect_key=$2 AND mandatory FOR UPDATE`,
    [input.requestId, input.effectKey],
  );
  const owners = await sql.unsafe<Array<{
    reservation_ref: string;
    reservation_hash: string;
    producer_implementation_id: string;
    category: string;
    owner_key: string;
    owner_key_hash: string;
    canonical_owner_identity: unknown;
    state: string;
    close_ref: string | null;
    close_hash: string | null;
  }>>(
    `SELECT reservation_ref,reservation_hash,producer_implementation_id,category,
            owner_key,owner_key_hash,canonical_owner_identity,state,close_ref,close_hash
       FROM internal_production_owner_reservations_v1
      WHERE (
              (producer_implementation_id='a-mandatory-effect-v1' AND category='mandatory-effect')
              OR reservation_payload->>'producerImplementationId'='a-mandatory-effect-v1'
              OR binding_payload->>'producerImplementationId'='a-mandatory-effect-v1'
            )
        AND (
              owner_key=$1 OR owner_key_hash=$2
              OR reservation_payload->>'ownerKey'=$1
              OR reservation_payload->>'ownerKeyHash'=$2
              OR canonical_owner_identity->>'ownerKey'=$1
              OR binding_payload->>'ownerKey'=$1
              OR binding_payload->'canonicalOwnerIdentity'->>'ownerKey'=$1
            )
      FOR UPDATE`,
    [identity.ownerKey, ownerKeyHash],
  );
  const owner = owners[0];
  if (
    effects.length !== 1
    || effects[0]?.state !== input.state
    || owners.length !== 1
    || !owner
    || owner.producer_implementation_id !== "a-mandatory-effect-v1"
    || owner.category !== "mandatory-effect"
    || owner.owner_key !== identity.ownerKey
    || owner.owner_key_hash !== ownerKeyHash
    || canonicalJsonStringify(owner.canonical_owner_identity) !== canonicalJsonStringify(identity)
    || owner.state !== "closed"
    || !owner.close_ref
    || !owner.close_hash
  ) throw new Error("RUN_TERMINAL_MANDATORY_EFFECT_REPLAY_INVALID");
  const reopened = await resolveInternalProductionOwnerReservationCloseInTransactionV1(
    sql as Parameters<typeof resolveInternalProductionOwnerReservationCloseInTransactionV1>[0],
    { closeRef: owner.close_ref, closeHash: owner.close_hash },
  );
  if (
    reopened.reservationRef !== owner.reservation_ref
    || reopened.reservationHash !== owner.reservation_hash
  ) throw new Error("RUN_TERMINAL_MANDATORY_EFFECT_CLOSE_INVALID");
}

/**
 * Canonical run-terminal owner used inside the caller's transaction.
 *
 * A terminal run is never published while an exact claim or compiler fence is
 * still active. Failure/cancellation require one exact durable termination
 * request plus runtime-drain proof before owners are closed; the only direct
 * failure path is an explicitly proven pre-claim bootstrap failure. Successful
 * completion rejects leaked owners. Compiler v3 attempts are accepted only
 * when their immutable packet/slice contract matches the run.
 */
export async function transitionRunToTerminalInTransaction(
  sql: InternalProductionPgTransactionSql,
  input: Readonly<{
    runId: string;
    status: RunTerminalStatus;
    diagnostic: string;
    terminalFailure?: boolean;
    unclaimedBootstrapFailure?: boolean;
    drainedTerminationRequestId?: string;
    now?: Date;
  }>,
): Promise<RunTerminalTransitionResult> {
  if (input.now && !Number.isFinite(new Date(input.now).getTime())) {
    throw new Error("RUN_TERMINAL_TIME_INVALID");
  }
  await lockInternalProductionWorkflowRunInsertionFenceV1(sql);
  const ownerAdmissionMigrationRows = await sql<Array<{ state: string }>>`
    SELECT state
      FROM public.setfarm_schema_migrations
     WHERE version=32
  `;
  if (
    ownerAdmissionMigrationRows.length > 1
    || (ownerAdmissionMigrationRows.length === 1
      && ownerAdmissionMigrationRows[0]?.state !== "applied"
      && ownerAdmissionMigrationRows[0]?.state !== "adopted")
  ) throw new Error("RUN_TERMINAL_OWNER_ADMISSION_MIGRATION32_JOURNAL_INVALID");
  const ownerAdmissionAvailable = ownerAdmissionMigrationRows.length === 1;
  const runs = await sql.unsafe<RunRow[]>(
    `SELECT id, status, protocol, context, packet_hash, accepted_candidate_hash, meta
       FROM runs WHERE id = $1 FOR UPDATE`,
    [input.runId],
  );
  const run = runs[0];
  if (!run) throw new Error("RUN_TERMINAL_NOT_FOUND");
  await assertInternalProductionRecoverySourceBootstrapRunDeliveryPendingInTransactionV1(
    sql,
    {
      runId: run.id,
      workflowState: run.status,
      protocol: run.protocol,
      runContext: run.context,
    },
  );
  const terminations = await sql.unsafe<TerminationRow[]>(
    `SELECT request_id,target_status,state FROM run_termination_requests
      WHERE run_id = $1 ORDER BY requested_at,request_id FOR UPDATE`,
    [input.runId],
  );
  const previousStatus = run.status;
  const alreadyTerminal = ["completed", "failed", "cancelled"].includes(previousStatus);
  if (alreadyTerminal && previousStatus !== input.status) {
    throw new Error(`RUN_TERMINAL_STATUS_CONFLICT:${previousStatus}:${input.status}`);
  }
  const unclaimedBootstrapFailure = input.unclaimedBootstrapFailure === true;
  if (unclaimedBootstrapFailure && input.status !== "failed") {
    throw new Error("RUN_TERMINAL_BOOTSTRAP_STATUS_INVALID");
  }
  const openTerminations = terminations.filter((request) => request.state !== "terminalized");
  if (alreadyTerminal && openTerminations.length > 0) {
    throw new Error(`RUN_TERMINAL_REPLAY_TERMINATION_OPEN:${openTerminations[0]!.request_id}`);
  }
  if (input.status === "completed" && openTerminations.length > 0) {
    throw new Error(`RUN_TERMINAL_TERMINATION_PENDING:${openTerminations[0]!.request_id}`);
  }
  if (!alreadyTerminal && input.status === "completed" && terminations.length > 0) {
    throw new Error("RUN_TERMINAL_TERMINATION_INVENTORY_INVALID");
  }
  if (unclaimedBootstrapFailure && openTerminations.length > 0) {
    throw new Error(`RUN_TERMINAL_BOOTSTRAP_TERMINATION_PENDING:${openTerminations[0]!.request_id}`);
  }
  const terminationTarget = input.status === "cancelled" || input.status === "failed"
    ? input.status
    : undefined;
  if (alreadyTerminal && terminations.length > 1) {
    throw new Error("RUN_TERMINAL_REPLAY_TERMINATION_INVENTORY_INVALID");
  }
  const termination = input.drainedTerminationRequestId
    ? terminations.find((request) => request.request_id === input.drainedTerminationRequestId)
    : alreadyTerminal
      ? terminations[0]
      : undefined;
  if (input.drainedTerminationRequestId && !termination) {
    throw new Error("RUN_TERMINAL_REPLAY_TERMINATION_INVALID");
  }
  if (
    alreadyTerminal
    && termination
    && (termination.state !== "terminalized" || termination.target_status !== input.status)
  ) throw new Error("RUN_TERMINAL_REPLAY_TERMINATION_INVALID");
  const requestBackedTermination = Boolean(
    terminationTarget
    && termination
    && termination.target_status === terminationTarget
    && (termination.state === "drained" || (alreadyTerminal && termination.state === "terminalized")),
  );
  if (
    !alreadyTerminal
    && !["running", "resuming", "failing", "cancelling"].includes(previousStatus)
  ) throw new Error(`RUN_TERMINAL_SOURCE_STATUS_INVALID:${previousStatus}`);
  if (terminationTarget && !alreadyTerminal && !unclaimedBootstrapFailure && !requestBackedTermination) {
    throw new Error(input.status === "cancelled"
      ? "RUN_TERMINAL_CANCEL_DRAIN_PROOF_REQUIRED"
      : "RUN_TERMINAL_FAIL_DRAIN_PROOF_REQUIRED");
  }

  // Frozen acquisition order: run -> termination -> runtime -> attempt ->
  // recovery -> claim -> completion -> mandatory effect.
  const runtimes = await sql.unsafe<RuntimeRow[]>(
    `SELECT session_id,state,claim_id FROM runtime_sessions
      WHERE run_id = $1 ORDER BY session_id FOR UPDATE`,
    [input.runId],
  );
  const attempts = await sql.unsafe<AttemptRow[]>(
    `SELECT attempt_id,claim_id::text,step_id,story_id,generation,fence_token,
            agent_id,disposition,evidence_refs,packet_hash,
            compilation_report_hash,slice_hash
       FROM execution_attempts WHERE run_id = $1
      ORDER BY attempt_id FOR UPDATE`,
    [input.runId],
  );
  const recoverySnapshot: V3TerminalRecoverySnapshot = run.protocol === "v3"
    ? await lockV3TerminalRecoveryChainInTransaction(sql, input.runId)
    : Object.freeze({ deliveries: [], cases: [] });
  const claims = await sql.unsafe<ClaimRow[]>(
    `SELECT id::text,step_id,story_id,agent_id,outcome FROM claim_log
      WHERE run_id = $1 ORDER BY id FOR UPDATE`,
    [input.runId],
  );
  let completions = await sql.unsafe<CompletionRow[]>(
    `SELECT request_id,state,apply_phase FROM runtime_completion_requests
      WHERE run_id = $1 ORDER BY request_id FOR UPDATE`,
    [input.runId],
  );
  let effects = await sql.unsafe<EffectRow[]>(
    `SELECT effect.request_id,effect.effect_key,effect.ordinal,effect.mandatory,effect.state
       FROM runtime_completion_effects effect
       JOIN runtime_completion_requests request ON request.request_id=effect.request_id
      WHERE request.run_id = $1 AND effect.mandatory
      ORDER BY effect.request_id,effect.ordinal,effect.effect_key
      FOR UPDATE OF effect`,
    [input.runId],
  );
  const transitionTime = await readDatabaseWallClock(sql, "RUN_TERMINAL_DATABASE_TIME_UNAVAILABLE");
  await normalizeTask5TerminalCompletionContractInTransactionV1(sql, {
    runId: input.runId,
    runStatus: input.status,
    transitionTime,
  });
  completions = await sql.unsafe<CompletionRow[]>(
    `SELECT request_id,state,apply_phase FROM runtime_completion_requests
      WHERE run_id=$1 ORDER BY request_id FOR UPDATE`,
    [input.runId],
  );
  effects = await sql.unsafe<EffectRow[]>(
    `SELECT effect.request_id,effect.effect_key,effect.ordinal,effect.mandatory,effect.state
       FROM runtime_completion_effects effect
       JOIN runtime_completion_requests request ON request.request_id=effect.request_id
      WHERE request.run_id=$1 AND effect.mandatory
      ORDER BY effect.request_id,effect.ordinal,effect.effect_key
      FOR UPDATE OF effect`,
    [input.runId],
  );
  const completionOwnerIdentities = completions.map((completion) => {
    const identity = createInternalProductionCompletionOwnerCanonicalOwnerIdentityV1({
      requestId: completion.request_id,
    });
    return Object.freeze({
      requestId: completion.request_id,
      identity,
      ownerKeyHash: hashCanonicalJson({
        schema: "setfarm.internal-production-owner-key.v1",
        ownerKeyDerivationId: "completion-request-id-v1",
        ownerKey: identity.ownerKey,
      }),
    });
  });
  const completionOwnerRows = completions.length === 0
    ? []
    : await sql.unsafe<Array<{
        producer_implementation_id: string;
        category: string;
        owner_key: string;
        owner_key_hash: string;
        reservation_owner_key: string | null;
        reservation_owner_key_hash: string | null;
        canonical_owner_key: string | null;
        binding_owner_key: string | null;
        binding_identity_owner_key: string | null;
        state: string;
      }>>(
        `SELECT producer_implementation_id,category,owner_key,owner_key_hash,
                reservation_payload->>'ownerKey' AS reservation_owner_key,
                reservation_payload->>'ownerKeyHash' AS reservation_owner_key_hash,
                canonical_owner_identity->>'ownerKey' AS canonical_owner_key,
                binding_payload->>'ownerKey' AS binding_owner_key,
                binding_payload->'canonicalOwnerIdentity'->>'ownerKey' AS binding_identity_owner_key,
                state
           FROM internal_production_owner_reservations_v1
          WHERE (
                  producer_implementation_id='a-completion-owner-v1'
                  OR reservation_payload->>'producerImplementationId'='a-completion-owner-v1'
                  OR binding_payload->>'producerImplementationId'='a-completion-owner-v1'
                )
            AND (
                  owner_key=ANY($1::text[]) OR owner_key_hash=ANY($2::text[])
                  OR reservation_payload->>'ownerKey'=ANY($1::text[])
                  OR reservation_payload->>'ownerKeyHash'=ANY($2::text[])
                  OR canonical_owner_identity->>'ownerKey'=ANY($1::text[])
                  OR binding_payload->>'ownerKey'=ANY($1::text[])
                  OR binding_payload->'canonicalOwnerIdentity'->>'ownerKey'=ANY($1::text[])
                )
          ORDER BY reservation_ref FOR UPDATE`,
        [
          completionOwnerIdentities.map((item) => item.requestId),
          completionOwnerIdentities.map((item) => item.ownerKeyHash),
        ],
      );

  const openClaims = claims.filter((claim) => claim.outcome === null);
  const activeAttempts = attempts.filter((attempt) => ["claimed", "running"].includes(attempt.disposition));
  const terminalClaimOutcomes = new Set([
    "completed", "infra_retry", "failed", "skipped", "abandoned", "cancelled",
  ]);
  const terminalAttemptDispositions = new Set([
    "produced_delta", "already_satisfied", "no_progress", "inconclusive", "failed", "verified",
  ]);
  if (claims.some((claim) => claim.outcome !== null && !terminalClaimOutcomes.has(claim.outcome))) {
    throw new Error("RUN_TERMINAL_CLAIM_STATE_INVALID");
  }
  if (attempts.some((attempt) => (
    !["claimed", "running"].includes(attempt.disposition)
    && !terminalAttemptDispositions.has(attempt.disposition)
  ))) throw new Error("RUN_TERMINAL_ATTEMPT_STATE_INVALID");
  if (input.status === "completed" && (openClaims.length > 0 || activeAttempts.length > 0)) {
    throw new Error(`RUN_TERMINAL_OPEN_OWNERS:claims=${openClaims.length}:attempts=${activeAttempts.length}`);
  }
  if (run.protocol === "legacy" && activeAttempts.length > 0) {
    throw new Error("RUN_TERMINAL_LEGACY_ACTIVE_ATTEMPT");
  }
  const nonterminalRuntimes = runtimes.filter((runtime) =>
    !["drained", "released", "quarantined"].includes(runtime.state));
  if (nonterminalRuntimes.length > 0) {
    throw new Error(alreadyTerminal
      ? `RUN_TERMINAL_REPLAY_RUNTIME_NOT_DRAINED:${nonterminalRuntimes.length}`
      : `RUN_TERMINAL_RUNTIME_NOT_DRAINED:${nonterminalRuntimes.length}`);
  }
  if (terminationTarget && !alreadyTerminal && !unclaimedBootstrapFailure) {
    if (!termination || termination.state !== "drained" || termination.target_status !== terminationTarget) {
      throw new Error(input.status === "cancelled"
        ? "RUN_TERMINAL_CANCEL_DRAIN_PROOF_INVALID"
        : "RUN_TERMINAL_FAIL_DRAIN_PROOF_INVALID");
    }
    if (
      terminations.length !== 1
      || openTerminations.length !== 1
      || openTerminations[0]?.request_id !== termination.request_id
    ) {
      throw new Error("RUN_TERMINAL_TERMINATION_INVENTORY_INVALID");
    }
    const runtimeClaimIds = new Set(runtimes.map((runtime) => String(runtime.claim_id)));
    const untrackedClaims = openClaims.filter((claim) => !runtimeClaimIds.has(claim.id));
    if (untrackedClaims.length > 0) {
      throw new Error(`RUN_TERMINAL_OPEN_CLAIM_SESSION_MISSING:${untrackedClaims.length}`);
    }
  }
  if (unclaimedBootstrapFailure && (claims.length > 0 || attempts.length > 0 || runtimes.length > 0)) {
    throw new Error(
      `RUN_TERMINAL_BOOTSTRAP_OWNER_EXISTS:claims=${claims.length}:attempts=${attempts.length}:runtimes=${runtimes.length}`,
    );
  }

  const claimsById = new Map(claims.map((claim) => [claim.id, claim]));
  for (const attempt of activeAttempts) {
    const claim = attempt.claim_id ? claimsById.get(attempt.claim_id) : undefined;
    if (
      !claim
      || claim.step_id !== attempt.step_id
      || (claim.story_id ?? "") !== attempt.story_id
      || (attempt.agent_id !== null && claim.agent_id !== attempt.agent_id)
    ) throw new Error("RUN_TERMINAL_ATTEMPT_BINDING_MISMATCH");
    if (
      run.protocol === "v3"
      && (
        !run.packet_hash
        || attempt.packet_hash !== run.packet_hash
        || !attempt.compilation_report_hash
        || !attempt.slice_hash
      )
    ) throw new Error("RUN_TERMINAL_V3_ATTEMPT_CONTRACT_MISMATCH");
  }
  if (run.protocol === "v3" && input.status === "completed" && !run.packet_hash) {
    throw new Error("RUN_TERMINAL_V3_PACKET_REQUIRED");
  }
  if (run.protocol === "v3" && input.status === "completed" && !alreadyTerminal) {
    if (!run.accepted_candidate_hash) throw new Error("RUN_TERMINAL_V3_ACCEPTED_CANDIDATE_REQUIRED");
    const candidates = await sql.unsafe<Array<{ payload: unknown }>>(
      `SELECT payload FROM accepted_candidates
        WHERE candidate_hash = $1 AND run_id = $2 LIMIT 1 FOR SHARE`,
      [run.accepted_candidate_hash, input.runId],
    );
    const parsed = AcceptedCandidateV1Schema.safeParse(candidates[0]?.payload);
    if (
      !parsed.success
      || parsed.data.candidateHash !== run.accepted_candidate_hash
      || parsed.data.runId !== input.runId
      || parsed.data.packetHash !== run.packet_hash
    ) throw new Error("RUN_TERMINAL_V3_ACCEPTED_CANDIDATE_INVALID");
  }

  const effectsByRequest = new Map<string, EffectRow[]>();
  for (const effect of effects) {
    const grouped = effectsByRequest.get(effect.request_id) ?? [];
    grouped.push(effect);
    effectsByRequest.set(effect.request_id, grouped);
  }
  const completionMutations: Array<Readonly<{
    row: CompletionRow;
    resolution: "accepted" | "rejected";
  }>> = [];
  const completionOwnerIds: string[] = [];
  const completionOwnerStates = new Map<string, string>();
  for (const owner of completionOwnerRows) {
    const matches = completionOwnerIdentities.filter((item) => (
      owner.owner_key === item.requestId
      || owner.owner_key_hash === item.ownerKeyHash
      || owner.reservation_owner_key === item.requestId
      || owner.reservation_owner_key_hash === item.ownerKeyHash
      || owner.canonical_owner_key === item.requestId
      || owner.binding_owner_key === item.requestId
      || owner.binding_identity_owner_key === item.requestId
    ));
    const match = matches[0];
    if (
      matches.length !== 1
      || !match
      || owner.producer_implementation_id !== "a-completion-owner-v1"
      || owner.category !== "completion-owner"
      || owner.owner_key !== match.requestId
      || owner.owner_key_hash !== match.ownerKeyHash
      || owner.reservation_owner_key !== match.requestId
      || owner.reservation_owner_key_hash !== match.ownerKeyHash
    ) throw new Error("RUN_TERMINAL_COMPLETION_OWNER_INVALID");
    if (completionOwnerStates.has(match.requestId)) {
      throw new Error("RUN_TERMINAL_COMPLETION_OWNER_AMBIGUOUS");
    }
    completionOwnerStates.set(match.requestId, owner.state);
  }
  for (const completion of completions) {
    const completionOwnerState = completionOwnerStates.get(completion.request_id);
    const mandatory = (effectsByRequest.get(completion.request_id) ?? [])
      .filter((effect) => effect.mandatory);
    const settledMandatory = mandatory.every((effect) =>
      ["applied", "reconciled"].includes(effect.state));
    if (completion.apply_phase === "effects_committed") {
      await assertRuntimeCompletionManifestInTransactionV1(sql, {
        requestId: completion.request_id,
        requireSettledMandatoryEffects: true,
      });
    }
    if (completion.state === "requested" && completion.apply_phase === "proposed") {
      if (completionOwnerState !== undefined) {
        throw new Error("RUN_TERMINAL_COMPLETION_PREBIRTH_OWNER_INVALID");
      }
      completionMutations.push({ row: completion, resolution: "rejected" });
      continue;
    }
    if (completion.state === "draining" && completion.apply_phase === "proposed") {
      if (completionOwnerState !== "bound") {
        throw new Error("RUN_TERMINAL_COMPLETION_OWNER_NOT_BOUND");
      }
      completionMutations.push({ row: completion, resolution: "rejected" });
      completionOwnerIds.push(completion.request_id);
      continue;
    }
    if (completion.state === "processing" && completion.apply_phase === "effects_committed") {
      if (completionOwnerState !== "bound") {
        throw new Error("RUN_TERMINAL_COMPLETION_OWNER_NOT_BOUND");
      }
      if (!settledMandatory) throw new Error("RUN_TERMINAL_COMPLETION_EFFECTS_OPEN");
      completionMutations.push({ row: completion, resolution: "accepted" });
      completionOwnerIds.push(completion.request_id);
      continue;
    }
    if (
      (completion.state === "accepted" && completion.apply_phase === "effects_committed")
      || (["rejected", "quarantined"].includes(completion.state)
        && ["proposed", "executing"].includes(completion.apply_phase))
    ) {
      if (completionOwnerState === undefined) {
        if (!(completion.state === "rejected" && completion.apply_phase === "proposed")) {
          throw new Error("RUN_TERMINAL_COMPLETION_OWNER_MISSING");
        }
      } else {
        if (completionOwnerState !== "closed") {
          throw new Error("RUN_TERMINAL_COMPLETION_OWNER_NOT_CLOSED");
        }
        completionOwnerIds.push(completion.request_id);
      }
      continue;
    }
    throw new Error(`RUN_TERMINAL_COMPLETION_STATE_OPEN:${completion.state}:${completion.apply_phase}`);
  }
  const authenticatedMandatoryEffectFacts = new Set<string>();
  const mandatoryEffectFact = (effect: Readonly<{
    request_id: string;
    effect_key: string;
    state: string;
  }>) => canonicalJsonStringify({
    requestId: effect.request_id,
    effectKey: effect.effect_key,
    state: effect.state,
  });
  for (const effect of effects) {
    if (!effect.mandatory) continue;
    if (["applied", "reconciled"].includes(effect.state)) {
      const mandatoryEffect = {
        requestId: effect.request_id,
        effectKey: effect.effect_key,
        state: effect.state as "applied" | "reconciled",
      } as const;
      await authenticateTask5ClosedMandatoryEffectReplayInTransactionV1(sql, mandatoryEffect);
      authenticatedMandatoryEffectFacts.add(mandatoryEffectFact(effect));
      continue;
    }
    if (effect.state === "quarantined") throw new Error("RUN_TERMINAL_EFFECT_QUARANTINED_OPEN");
    if (["pending", "leased"].includes(effect.state)) {
      throw new Error(`RUN_TERMINAL_EFFECT_OPEN:${effect.request_id}:${effect.effect_key}`);
    }
    throw new Error("RUN_TERMINAL_EFFECT_STATE_INVALID");
  }

  const recoverySettlement = run.protocol === "v3"
    ? await settleV3TerminalRecoveryChainInTransaction(sql, {
        runId: input.runId,
        status: input.status,
        diagnostic: input.diagnostic,
        transitionTime,
        snapshot: recoverySnapshot,
      })
    : Object.freeze({ closedDeliveries: 0, closedRecoveryCases: 0, decisionRefs: [] });

  // Mutate all in fixed category order.
  let closedClaims = 0;
  if (input.status !== "completed" && openClaims.length > 0) {
    const claimOutcome = input.status === "cancelled" ? "cancelled" : "failed";
    const rows = await sql.unsafe<Array<{ id: string }>>(
      `UPDATE claim_log
          SET outcome = $2, abandoned_at = COALESCE(abandoned_at, $3),
              duration_ms = LEAST(
                CAST(EXTRACT(EPOCH FROM ($3::timestamptz - claimed_at::timestamptz)) * 1000 AS BIGINT),
                2147483647
              )::INTEGER,
              diagnostic = COALESCE(NULLIF(diagnostic, ''), $4)
        WHERE run_id = $1 AND outcome IS NULL RETURNING id::text`,
      [input.runId, claimOutcome, transitionTime, input.diagnostic.slice(0, 1_000)],
    );
    closedClaims = rows.length;
    if (closedClaims !== openClaims.length) throw new Error("RUN_TERMINAL_CLAIM_CAS_LOST");
  }
  let closedAttempts = 0;
  for (const attempt of activeAttempts) {
    const nextRefs = [...new Set([
      ...evidenceRefs(attempt.evidence_refs),
      `setfarm://run-terminal/${input.status}`,
    ])].sort();
    const disposition = input.status === "failed" ? "failed" : "inconclusive";
    const updated = await sql.unsafe<Array<{ attempt_id: string }>>(
      `UPDATE execution_attempts
          SET disposition = $4,evidence_refs = $5,heartbeat_at = $6,updated_at = $6
        WHERE attempt_id = $1 AND generation = $2 AND fence_token = $3
          AND disposition IN ('claimed','running') RETURNING attempt_id`,
      [attempt.attempt_id, attempt.generation, attempt.fence_token, disposition, JSON.stringify(nextRefs), transitionTime],
    );
    if (updated.length !== 1) throw new Error("RUN_TERMINAL_ATTEMPT_FENCE_LOST");
    closedAttempts += 1;
  }
  const releasedRuntimeIds: string[] = [];
  for (const runtime of runtimes.filter((row) => row.state === "drained")) {
    releasedRuntimeIds.push(await releaseRuntimeSessionForTerminalRunInTransactionV1(sql, {
      sessionId: runtime.session_id,
      runId: input.runId,
      transitionTime,
    }));
  }
  for (const completion of completionMutations) {
    await terminalizeRuntimeCompletionForRunInTransactionV1(sql, {
      requestId: completion.row.request_id,
      runId: input.runId,
      terminalRunStatus: input.status,
      transitionTime,
    });
  }
  // Mandatory-effect is an explicit Task-6 mutation no-op. Phase 0 or Task 5
  // already settled it; Task 6 authenticates its persisted close below.
  let terminationRequestId: string | undefined;
  if (termination?.state === "drained") {
    terminationRequestId = await terminalizeRunTerminationRequestInTransactionV1(sql, {
      requestId: termination.request_id,
      runId: input.runId,
      transitionTime,
    });
  } else if (termination?.state === "terminalized") {
    terminationRequestId = termination.request_id;
  }

  let changedStories = 0;
  let changedSteps = 0;
  if (input.status !== "completed") {
    const storyStatus = input.status === "cancelled" ? "skipped" : "failed";
    const stories = await sql.unsafe<Array<{ id: string }>>(
      `UPDATE stories SET status = $2,claimed_by = NULL,claimed_at = NULL,
              output = COALESCE(NULLIF(output, ''), $3),updated_at = $4
        WHERE run_id = $1 AND status IN ('pending','running') RETURNING id`,
      [input.runId, storyStatus, (input.status === "cancelled" ? "Cancelled by user" : input.diagnostic).slice(0, 12_000), transitionTime],
    );
    changedStories = stories.length;
    const stepStatus = input.status === "cancelled" ? "cancelled" : "failed";
    const steps = await sql.unsafe<Array<{ id: string }>>(
      `UPDATE steps SET status = $2,output = COALESCE(NULLIF(output, ''), $3),
              current_story_id = NULL,updated_at = $4
        WHERE run_id = $1 AND status IN ('waiting','pending','running') RETURNING id`,
      [input.runId, stepStatus, (input.status === "cancelled" ? "Cancelled by user" : input.diagnostic).slice(0, 12_000), transitionTime],
    );
    changedSteps = steps.length;
  } else {
    const active = await sql.unsafe<Array<{ steps: number; stories: number }>>(
      `SELECT
         (SELECT COUNT(*)::integer FROM steps WHERE run_id=$1 AND status IN ('waiting','pending','running')) AS steps,
         (SELECT COUNT(*)::integer FROM stories WHERE run_id=$1 AND status IN ('pending','running')) AS stories`,
      [input.runId],
    );
    if ((active[0]?.steps ?? 0) > 0 || (active[0]?.stories ?? 0) > 0) {
      throw new Error(`RUN_TERMINAL_INCOMPLETE_STATE:steps=${active[0]?.steps ?? 0}:stories=${active[0]?.stories ?? 0}`);
    }
  }
  const meta = metaObject(run.meta);
  if (!alreadyTerminal && input.status === "failed" && (input.terminalFailure ?? true)) {
    meta.terminal_failure = true;
    meta.terminal_marked_at = transitionTime.toISOString();
    meta.terminal_reason = input.diagnostic.slice(0, 1_000);
  }
  if (!alreadyTerminal) {
    const updatedRun = await sql.unsafe<Array<{ id: string; status: string }>>(
      `UPDATE runs
          SET status = $2,
              meta = $3,
              updated_at = $4
        WHERE id = $1 RETURNING id,status`,
      [input.runId, input.status, JSON.stringify(meta), transitionTime],
    );
    if (
      updatedRun.length !== 1
      || updatedRun[0]?.id !== input.runId
      || updatedRun[0]?.status !== input.status
    ) {
      throw new Error("RUN_TERMINAL_RUN_CAS_LOST");
    }
  }

  // Resolve all only after every terminal mutation.
  const ownerSql = sql as unknown as Parameters<typeof closeInternalProductionOwnerReservationV1>[0];
  const claimCloses = [];
  if (ownerAdmissionAvailable) {
    for (const claim of claims) {
      claimCloses.push(await resolveInternalProductionClaimTerminalAuthorityPairInTransactionV1(ownerSql, {
        claimIdText: claim.id,
      }));
    }
  }
  const attemptCloses = [];
  if (ownerAdmissionAvailable) {
    for (const attempt of attempts) {
      attemptCloses.push(await resolveInternalProductionExecutionAttemptTerminalAuthorityPairInTransactionV1(ownerSql, {
        attemptId: attempt.attempt_id,
      }));
    }
  }
  const runtimeCloses = [];
  if (ownerAdmissionAvailable) {
    for (const runtime of runtimes) {
      runtimeCloses.push(await resolveInternalProductionRuntimeSessionTerminalAuthorityPairInTransactionV1(ownerSql, {
        sessionId: runtime.session_id,
      }));
    }
  }
  const completionCloses = [];
  if (ownerAdmissionAvailable) {
    for (const requestId of completionOwnerIds) {
      completionCloses.push(await resolveInternalProductionCompletionOwnerTerminalAuthorityPairInTransactionV1(ownerSql, {
        requestId,
      }));
    }
  }
  // Consume every exact read-only preflight fact in the mandatory-effect
  // resolve slot. Task 6 still performs no effect resolver, mutation, or close.
  for (const effect of effects.filter((row) => row.mandatory)) {
    if (!authenticatedMandatoryEffectFacts.delete(mandatoryEffectFact(effect))) {
      throw new Error("RUN_TERMINAL_EFFECT_PREFLIGHT_FACT_MISSING");
    }
  }
  if (authenticatedMandatoryEffectFacts.size !== 0) {
    throw new Error("RUN_TERMINAL_EFFECT_PREFLIGHT_FACT_AMBIGUOUS");
  }
  const terminationCloses = [];
  if (ownerAdmissionAvailable && terminationRequestId) {
    terminationCloses.push(await resolveInternalProductionTerminationTerminalAuthorityPairInTransactionV1(ownerSql, {
      requestId: terminationRequestId,
    }));
  }
  const recoverySourceBootstrapTerminal = ownerAdmissionAvailable
    ? await resolveInternalProductionRecoverySourceBootstrapActualRunTerminalInTransactionV1(
        ownerSql,
        { runId: input.runId },
      )
    : null;
  const terminalPair = ownerAdmissionAvailable && recoverySourceBootstrapTerminal === null
    ? await resolveInternalProductionWorkflowRunTerminalAuthorityPairInTransactionV1(
        ownerSql,
        { runId: input.runId },
      )
    : null;

  // Close all in the identical category order; P2 is mapped explicitly last.
  for (const closeInput of [
    ...claimCloses,
    ...attemptCloses,
    ...runtimeCloses,
    ...completionCloses,
    ...terminationCloses,
  ]) {
    const close = await closeInternalProductionOwnerReservationV1(ownerSql, closeInput);
    const reopened = await resolveInternalProductionOwnerReservationCloseInTransactionV1(ownerSql, {
      closeRef: close.closeRef,
      closeHash: close.closeHash,
    });
    if (
      reopened.reservationRef !== closeInput.reservationRef
      || reopened.reservationHash !== closeInput.reservationHash
    ) throw new Error("RUN_TERMINAL_P3_OWNER_CLOSE_IDENTITY_INVALID");
  }
  if (terminalPair !== null) {
    const runClose = await closeInternalProductionOwnerReservationV1(ownerSql, {
      reservationRef: terminalPair.runOwnerReservationRef,
      reservationHash: terminalPair.runOwnerReservationHash,
      terminalAuthorityRef: terminalPair.terminalAuthorityRef,
      terminalAuthorityHash: terminalPair.terminalAuthorityHash,
    });
    const reopenedRunClose = await resolveInternalProductionOwnerReservationCloseInTransactionV1(ownerSql, {
      closeRef: runClose.closeRef,
      closeHash: runClose.closeHash,
    });
    if (
      reopenedRunClose.reservationRef !== terminalPair.runOwnerReservationRef
      || reopenedRunClose.reservationHash !== terminalPair.runOwnerReservationHash
    ) throw new Error("RUN_TERMINAL_OWNER_CLOSE_IDENTITY_INVALID");
  }

  const terminalEventPayload = {
    schema: "setfarm.run-terminal-event.v2",
    runId: input.runId,
    status: input.status,
    previousStatus,
    reasonCode: alreadyTerminal ? "historical_terminal_residue_reconciled" : "canonical_terminal_transition",
    ...(!alreadyTerminal ? { diagnostic: input.diagnostic } : {}),
    closedClaims,
    closedAttempts,
    closedRecoveryDeliveries: recoverySettlement.closedDeliveries,
    closedRecoveryCases: recoverySettlement.closedRecoveryCases,
    recoveryDecisionRefs: recoverySettlement.decisionRefs,
    changedSteps,
    changedStories,
    rejectedRuntimeCompletions: completionMutations.filter((item) => item.resolution === "rejected").length,
    committedRuntimeCompletions: completionMutations.filter((item) => item.resolution === "accepted").length,
    releasedRuntimes: releasedRuntimeIds.length,
    ...(terminationRequestId ? { terminationRequestId } : {}),
  };
  const reconciledMutations = closedClaims
    + closedAttempts
    + recoverySettlement.closedDeliveries
    + recoverySettlement.closedRecoveryCases
    + changedSteps
    + changedStories
    + completionMutations.length
    + releasedRuntimeIds.length;
  if (!alreadyTerminal) {
    await enqueueOperationalOutboxEventInTransaction(sql, {
      eventKey: `run/${input.runId}/terminal/v2/${input.status}`,
      eventType: "run.terminal",
      aggregateType: "run",
      aggregateId: input.runId,
      payload: terminalEventPayload,
      now: transitionTime,
    });
  } else if (reconciledMutations > 0) {
    await enqueueOperationalOutboxEventInTransaction(sql, {
      eventKey: `run/${input.runId}/terminal-reconciled/${hashCanonicalJson(terminalEventPayload)}`,
      eventType: "run.terminal",
      aggregateType: "run",
      aggregateId: input.runId,
      payload: terminalEventPayload,
      now: transitionTime,
    });
  }
  return {
    status: input.status,
    previousStatus,
    closedClaims,
    closedAttempts,
    closedRecoveryDeliveries: recoverySettlement.closedDeliveries,
    closedRecoveryCases: recoverySettlement.closedRecoveryCases,
    changedSteps,
    changedStories,
  };
}

export async function transitionRunToTerminal(
  sql: postgres.Sql,
  input: Readonly<{
    runId: string;
    status: RunTerminalStatus;
    diagnostic: string;
    terminalFailure?: boolean;
    unclaimedBootstrapFailure?: boolean;
    drainedTerminationRequestId?: string;
    now?: Date;
  }>,
): Promise<RunTerminalTransitionResult> {
  return sql.begin((transaction) => transitionRunToTerminalInTransaction(transaction as InternalProductionPgTransactionSql, input)) as Promise<RunTerminalTransitionResult>;
}
