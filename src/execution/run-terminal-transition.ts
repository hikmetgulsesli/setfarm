import type postgres from "postgres";

import {
  closeInternalProductionOwnerReservationV1,
  resolveInternalProductionClaimTerminalAuthorityPairInTransactionV1,
  resolveInternalProductionExecutionAttemptTerminalAuthorityPairInTransactionV1,
  resolveInternalProductionOwnerReservationCloseInTransactionV1,
  resolveInternalProductionWorkflowRunTerminalAuthorityPairInTransactionV1,
} from "../db-pg.js";
import { readDatabaseWallClock } from "../db/database-wall-clock.js";
import {
  lockV3TerminalRecoveryChainInTransaction,
  settleV3TerminalRecoveryChainInTransaction,
  type V3TerminalRecoverySnapshot,
} from "../recovery/v3-terminal-recovery-chain.js";
import { rejectRuntimeCompletionsForTerminalRunInTransaction } from "./runtime-completion.js";
import { markRuntimeCompletionOwnerCommittedInTransaction } from "./runtime-completion.js";
import { createSingleEffectCompletionPlanDescriptorV1 } from "./schemas/runtime-completion-plan-v1.js";
import { hashCanonicalJson } from "../product-compiler/canonical-json.js";
import { AcceptedCandidateV1Schema } from "../evidence/accepted-candidate-v1.js";
import { enqueueOperationalOutboxEventInTransaction } from "./operational-outbox-repository.js";
import { assertRuntimeCompletionManifestInTransactionV1 } from "./runtime-completion-manifest-authority-v1.js";

export type RunTerminalStatus = "completed" | "failed" | "cancelled";

type RunRow = {
  id: string;
  status: string;
  protocol: string;
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
  sql: postgres.TransactionSql,
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
  const runs = await sql.unsafe<RunRow[]>(
    `SELECT id, status, protocol, packet_hash, accepted_candidate_hash, meta
       FROM runs
      WHERE id = $1
      FOR UPDATE`,
    [input.runId],
  );
  const run = runs[0];
  if (!run) throw new Error("RUN_TERMINAL_NOT_FOUND");
  const openTerminations = await sql.unsafe<Array<{ request_id: string; target_status: string; state: string }>>(
    `SELECT request_id, target_status, state
       FROM run_termination_requests
      WHERE run_id = $1 AND state <> 'terminalized'
      ORDER BY requested_at, request_id
      FOR UPDATE`,
    [input.runId],
  );
  if (input.status === "completed" && openTerminations.length > 0) {
    throw new Error(`RUN_TERMINAL_TERMINATION_PENDING:${openTerminations[0]!.request_id}`);
  }
  const unclaimedBootstrapFailure = input.unclaimedBootstrapFailure === true;
  if (unclaimedBootstrapFailure && input.status !== "failed") {
    throw new Error("RUN_TERMINAL_BOOTSTRAP_STATUS_INVALID");
  }
  if (unclaimedBootstrapFailure && openTerminations.length > 0) {
    throw new Error(`RUN_TERMINAL_BOOTSTRAP_TERMINATION_PENDING:${openTerminations[0]!.request_id}`);
  }

  const previousStatus = run.status;
  const alreadyTerminal = ["completed", "failed", "cancelled"].includes(previousStatus);
  if (alreadyTerminal && previousStatus !== input.status) {
    throw new Error(`RUN_TERMINAL_STATUS_CONFLICT:${previousStatus}:${input.status}`);
  }
  const terminationTarget = input.status === "cancelled" || input.status === "failed"
    ? input.status
    : undefined;
  const expectedTerminationSource = input.status === "cancelled" ? "cancelling" : "failing";
  const requestBackedTermination = Boolean(terminationTarget)
    && previousStatus === expectedTerminationSource
    && Boolean(input.drainedTerminationRequestId);
  if (
    !alreadyTerminal
    && !["running", "resuming"].includes(previousStatus)
    && !requestBackedTermination
  ) {
    throw new Error(`RUN_TERMINAL_SOURCE_STATUS_INVALID:${previousStatus}`);
  }
  // Global owner order after run/termination is runtime -> attempt ->
  // recovery delivery/case -> claim. Every canonical writer acquires the run
  // row first, so this snapshot cannot gain a new downstream owner while the
  // terminal transition is deciding.
  const runtimes = await sql.unsafe<Array<{
    session_id: string;
    state: string;
    claim_id: string | number;
  }>>(
    `SELECT session_id, state, claim_id
       FROM runtime_sessions
      WHERE run_id = $1
      ORDER BY session_id
      FOR UPDATE`,
    [input.runId],
  );
  const attempts = await sql.unsafe<AttemptRow[]>(
    `SELECT attempt_id, claim_id::text, step_id, story_id, generation, fence_token,
            agent_id, disposition, evidence_refs, packet_hash,
            compilation_report_hash, slice_hash
       FROM execution_attempts
      WHERE run_id = $1
        AND disposition IN ('claimed', 'running')
      ORDER BY attempt_id
      FOR UPDATE`,
    [input.runId],
  );
  const recoverySnapshot: V3TerminalRecoverySnapshot = run.protocol === "v3"
    ? await lockV3TerminalRecoveryChainInTransaction(sql as postgres.TransactionSql, input.runId)
    : Object.freeze({ deliveries: [], cases: [] });
  const claims = await sql.unsafe<ClaimRow[]>(
    `SELECT id::text, step_id, story_id, agent_id, outcome
       FROM claim_log
      WHERE run_id = $1
      ORDER BY id
      FOR UPDATE`,
    [input.runId],
  );
  const openClaims = claims.filter((claim) => claim.outcome === null);
  const transitionTime = await readDatabaseWallClock(sql, "RUN_TERMINAL_DATABASE_TIME_UNAVAILABLE");
  const undrainedRuntimes = runtimes.filter((runtime) =>
    !["drained", "released"].includes(runtime.state));
  if (alreadyTerminal && undrainedRuntimes.length > 0) {
    throw new Error(`RUN_TERMINAL_REPLAY_RUNTIME_NOT_DRAINED:${undrainedRuntimes.length}`);
  }

  let terminationRequestId: string | undefined;
  if (terminationTarget && !alreadyTerminal && !unclaimedBootstrapFailure) {
    if (!requestBackedTermination) {
      throw new Error(input.status === "cancelled"
        ? "RUN_TERMINAL_CANCEL_DRAIN_PROOF_REQUIRED"
        : "RUN_TERMINAL_FAIL_DRAIN_PROOF_REQUIRED");
    }
    const requestId = input.drainedTerminationRequestId!;
    const requests = await sql.unsafe<Array<{
      request_id: string;
      target_status: string;
      state: string;
    }>>(
      `SELECT request_id, target_status, state
         FROM run_termination_requests
        WHERE request_id = $1 AND run_id = $2
        FOR UPDATE`,
      [requestId, input.runId],
    );
    const request = requests[0];
    if (!request || request.target_status !== terminationTarget || request.state !== "drained") {
      throw new Error(input.status === "cancelled"
        ? "RUN_TERMINAL_CANCEL_DRAIN_PROOF_INVALID"
        : "RUN_TERMINAL_FAIL_DRAIN_PROOF_INVALID");
    }
    if (undrainedRuntimes.length > 0) {
      throw new Error(`RUN_TERMINAL_RUNTIME_NOT_DRAINED:${undrainedRuntimes.length}`);
    }
    const runtimeClaimIds = new Set(runtimes.map((runtime) => String(runtime.claim_id)));
    const untrackedClaims = openClaims.filter((claim) => !runtimeClaimIds.has(claim.id));
    if (untrackedClaims.length > 0) {
      throw new Error(`RUN_TERMINAL_OPEN_CLAIM_SESSION_MISSING:${untrackedClaims.length}`);
    }
    terminationRequestId = requestId;
  }

  if (unclaimedBootstrapFailure) {
    const attemptCounts = await sql.unsafe<Array<{ count: number }>>(
      `SELECT COUNT(*)::integer AS count
         FROM execution_attempts
        WHERE run_id = $1`,
      [input.runId],
    );
    if (
      claims.length > 0
      || (attemptCounts[0]?.count ?? 0) > 0
      || runtimes.length > 0
    ) {
      throw new Error(
        `RUN_TERMINAL_BOOTSTRAP_OWNER_EXISTS:claims=${claims.length}:attempts=${attemptCounts[0]?.count ?? 0}:runtimes=${runtimes.length}`,
      );
    }
  }
  if (input.status === "completed" && (openClaims.length > 0 || attempts.length > 0)) {
    throw new Error(`RUN_TERMINAL_OPEN_OWNERS:claims=${openClaims.length}:attempts=${attempts.length}`);
  }
  if (run.protocol === "legacy" && attempts.length > 0) {
    throw new Error("RUN_TERMINAL_LEGACY_ACTIVE_ATTEMPT");
  }
  if (run.protocol === "v3" && input.status === "completed" && !run.packet_hash) {
    throw new Error("RUN_TERMINAL_V3_PACKET_REQUIRED");
  }
  if (run.protocol === "v3" && input.status === "completed" && !alreadyTerminal) {
    if (!run.accepted_candidate_hash) {
      throw new Error("RUN_TERMINAL_V3_ACCEPTED_CANDIDATE_REQUIRED");
    }
    const candidates = await sql.unsafe<Array<{ payload: unknown }>>(
      `SELECT payload
         FROM accepted_candidates
        WHERE candidate_hash = $1 AND run_id = $2
        LIMIT 1
        FOR SHARE`,
      [run.accepted_candidate_hash, input.runId],
    );
    const parsed = AcceptedCandidateV1Schema.safeParse(candidates[0]?.payload);
    if (
      !parsed.success
      || parsed.data.candidateHash !== run.accepted_candidate_hash
      || parsed.data.runId !== input.runId
      || parsed.data.packetHash !== run.packet_hash
    ) {
      throw new Error("RUN_TERMINAL_V3_ACCEPTED_CANDIDATE_INVALID");
    }
  }

  const recoverySettlement = run.protocol === "v3"
    ? await settleV3TerminalRecoveryChainInTransaction(
        sql as postgres.TransactionSql,
        {
          runId: input.runId,
          status: input.status,
          diagnostic: input.diagnostic,
          transitionTime,
          snapshot: recoverySnapshot,
        },
      )
    : Object.freeze({ closedDeliveries: 0, closedRecoveryCases: 0, decisionRefs: [] });

  let closedAttempts = 0;
  const terminalAttemptIds: string[] = [];
  if (run.protocol !== "legacy") {
    const claimsById = new Map(claims.map((claim) => [claim.id, claim]));
    for (const attempt of attempts) {
      const refs = evidenceRefs(attempt.evidence_refs);
      const claim = attempt.claim_id ? claimsById.get(attempt.claim_id) : undefined;
      if (
        !claim
        || claim.step_id !== attempt.step_id
        || (claim.story_id ?? "") !== attempt.story_id
        || (attempt.agent_id !== null && claim.agent_id !== attempt.agent_id)
      ) {
        throw new Error("RUN_TERMINAL_ATTEMPT_BINDING_MISMATCH");
      }
      if (
        run.protocol === "v3"
        && (
          !run.packet_hash
          || attempt.packet_hash !== run.packet_hash
          || !attempt.compilation_report_hash
          || !attempt.slice_hash
        )
      ) {
        throw new Error("RUN_TERMINAL_V3_ATTEMPT_CONTRACT_MISMATCH");
      }
      const nextRefs = [...new Set([
        ...refs,
        `setfarm://run-terminal/${input.status}`,
      ])].sort();
      const disposition = input.status === "failed" ? "failed" : "inconclusive";
      const updated = await sql.unsafe<Array<{ attempt_id: string }>>(
        `UPDATE execution_attempts
            SET disposition = $4,
                evidence_refs = $5,
                heartbeat_at = $6,
                updated_at = $6
          WHERE attempt_id = $1
            AND generation = $2
            AND fence_token = $3
            AND disposition IN ('claimed', 'running')
          RETURNING attempt_id`,
        [
          attempt.attempt_id,
          attempt.generation,
          attempt.fence_token,
          disposition,
          JSON.stringify(nextRefs),
          transitionTime,
        ],
      );
      if (updated.length !== 1) throw new Error("RUN_TERMINAL_ATTEMPT_FENCE_LOST");
      terminalAttemptIds.push(updated[0]!.attempt_id);
      closedAttempts += 1;
    }
  }

  let closedClaims = 0;
  let terminalClaimIds: string[] = [];
  if (input.status !== "completed" && openClaims.length > 0) {
    const claimOutcome = input.status === "cancelled" ? "cancelled" : "failed";
    const closed = await sql.unsafe<Array<{ id: string }>>(
      `UPDATE claim_log
          SET outcome = $2,
              abandoned_at = COALESCE(abandoned_at, $3),
              duration_ms = LEAST(
                CAST(EXTRACT(EPOCH FROM ($3::timestamptz - claimed_at::timestamptz)) * 1000 AS BIGINT),
                2147483647
              )::INTEGER,
              diagnostic = COALESCE(NULLIF(diagnostic, ''), $4)
        WHERE run_id = $1
          AND outcome IS NULL
        RETURNING id::text`,
      [input.runId, claimOutcome, transitionTime, input.diagnostic.slice(0, 1_000)],
    );
    closedClaims = closed.length;
    if (closedClaims !== openClaims.length) throw new Error("RUN_TERMINAL_CLAIM_CAS_LOST");
    terminalClaimIds = closed.map((claim) => claim.id);
  }

  const attemptCloses: Array<Awaited<ReturnType<
    typeof resolveInternalProductionExecutionAttemptTerminalAuthorityPairInTransactionV1
  >>> = [];
  for (const attemptId of terminalAttemptIds) {
    attemptCloses.push(
      await resolveInternalProductionExecutionAttemptTerminalAuthorityPairInTransactionV1(
        sql as Parameters<typeof resolveInternalProductionExecutionAttemptTerminalAuthorityPairInTransactionV1>[0],
        { attemptId },
      ),
    );
  }
  const claimCloses: Array<Awaited<ReturnType<
    typeof resolveInternalProductionClaimTerminalAuthorityPairInTransactionV1
  >>> = [];
  for (const claimIdText of terminalClaimIds) {
    claimCloses.push(
      await resolveInternalProductionClaimTerminalAuthorityPairInTransactionV1(
        sql as Parameters<typeof resolveInternalProductionClaimTerminalAuthorityPairInTransactionV1>[0],
        { claimIdText },
      ),
    );
  }
  for (const terminalClose of attemptCloses) {
    await closeInternalProductionOwnerReservationV1(
      sql as Parameters<typeof closeInternalProductionOwnerReservationV1>[0],
      terminalClose,
    );
  }
  for (const terminalClose of claimCloses) {
    await closeInternalProductionOwnerReservationV1(
      sql as Parameters<typeof closeInternalProductionOwnerReservationV1>[0],
      terminalClose,
    );
  }

  let changedStories = 0;
  let changedSteps = 0;
  let rejectedRuntimeCompletions = 0;
  if (input.status !== "completed") {
    const storyStatus = input.status === "cancelled" ? "skipped" : "failed";
    const storyOutput = input.status === "cancelled" ? "Cancelled by user" : input.diagnostic;
    const stories = await sql.unsafe<Array<{ id: string }>>(
      `UPDATE stories
          SET status = $2,
              claimed_by = NULL,
              claimed_at = NULL,
              output = COALESCE(NULLIF(output, ''), $3),
              updated_at = $4
        WHERE run_id = $1
          AND status IN ('pending', 'running')
        RETURNING id`,
      [input.runId, storyStatus, storyOutput.slice(0, 12_000), transitionTime],
    );
    changedStories = stories.length;

    const stepStatus = input.status === "cancelled" ? "cancelled" : "failed";
    const stepOutput = input.status === "cancelled" ? "Cancelled by user" : input.diagnostic;
    const steps = await sql.unsafe<Array<{ id: string }>>(
      `UPDATE steps
          SET status = $2,
              output = COALESCE(NULLIF(output, ''), $3),
              current_story_id = NULL,
              updated_at = $4
        WHERE run_id = $1
          AND status IN ('waiting', 'pending', 'running')
        RETURNING id`,
      [input.runId, stepStatus, stepOutput.slice(0, 12_000), transitionTime],
    );
    changedSteps = steps.length;
    rejectedRuntimeCompletions = await rejectRuntimeCompletionsForTerminalRunInTransaction(sql, {
      runId: input.runId,
      diagnostic: `Completion proposal preempted by canonical run ${input.status} transition: ${input.diagnostic}`,
    });
  } else {
    const activeSteps = await sql.unsafe<Array<{ count: number }>>(
      `SELECT COUNT(*)::integer AS count
         FROM steps
        WHERE run_id = $1
          AND status IN ('waiting', 'pending', 'running')`,
      [input.runId],
    );
    const activeStories = await sql.unsafe<Array<{ count: number }>>(
      `SELECT COUNT(*)::integer AS count
         FROM stories
        WHERE run_id = $1
          AND status IN ('pending', 'running')`,
      [input.runId],
    );
    if ((activeSteps[0]?.count ?? 0) > 0 || (activeStories[0]?.count ?? 0) > 0) {
      throw new Error(
        `RUN_TERMINAL_INCOMPLETE_STATE:steps=${activeSteps[0]?.count ?? 0}:stories=${activeStories[0]?.count ?? 0}`,
      );
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
        WHERE id = $1
        RETURNING id,status`,
      [input.runId, input.status, JSON.stringify(meta), transitionTime],
    );
    if (
      updatedRun.length !== 1
      || updatedRun[0]!.id !== input.runId
      || updatedRun[0]!.status !== input.status
    ) throw new Error("RUN_TERMINAL_RUN_CAS_LOST");
  }

  const ownerAdmissionSql = sql as unknown as Parameters<
    typeof resolveInternalProductionWorkflowRunTerminalAuthorityPairInTransactionV1
  >[0];
  const terminalPair = await resolveInternalProductionWorkflowRunTerminalAuthorityPairInTransactionV1(
    ownerAdmissionSql,
    { runId: input.runId },
  );
  const close = await closeInternalProductionOwnerReservationV1(ownerAdmissionSql, {
    reservationRef: terminalPair.runOwnerReservationRef,
    reservationHash: terminalPair.runOwnerReservationHash,
    terminalAuthorityRef: terminalPair.terminalAuthorityRef,
    terminalAuthorityHash: terminalPair.terminalAuthorityHash,
  });
  const reopenedClose = await resolveInternalProductionOwnerReservationCloseInTransactionV1(ownerAdmissionSql, {
    closeRef: close.closeRef,
    closeHash: close.closeHash,
  });
  if (
    reopenedClose.reservationRef !== terminalPair.runOwnerReservationRef
    || reopenedClose.reservationHash !== terminalPair.runOwnerReservationHash
  ) throw new Error("RUN_TERMINAL_OWNER_CLOSE_IDENTITY_INVALID");

  let committedRuntimeCompletions = 0;
  if (input.status !== "cancelled") {
    // A processing manager completion can legitimately decide that its
    // acceptance gates terminally fail (or complete) the run. The terminal
    // state transaction is the full mandatory continuation in that case, so
    // publish both owner/effect receipts atomically instead of rejecting the
    // request that produced the decision.
    const unplanned = await sql.unsafe<Array<{ request_id: string; claim_id: string; outcome: string }>>(
      `SELECT rcr.request_id, rcr.claim_id::text, cl.outcome
         FROM runtime_completion_requests rcr
         JOIN claim_log cl ON cl.id = rcr.claim_id
        WHERE rcr.run_id = $1
          AND rcr.state = 'processing'
          AND rcr.apply_phase = 'executing'
          AND cl.outcome IS NOT NULL
        FOR UPDATE OF rcr, cl`,
      [input.runId],
    );
    committedRuntimeCompletions = unplanned.length;
    for (const completion of unplanned) {
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
          effectPayload: { runStatus: input.status },
        }),
        now: transitionTime,
      });
      const result = {
        runStatus: input.status,
        advanced: false,
        runCompleted: input.status === "completed",
        runFailed: input.status === "failed",
      };
      const appliedEffects = await sql.unsafe<Array<{ effect_key: string }>>(
        `UPDATE runtime_completion_effects
            SET state = 'applied', applied_at = $2,
                result = $3::text::jsonb,
                evidence = $4::text::jsonb,
                updated_at = $2
          WHERE request_id = $1 AND mandatory AND state = 'pending'
          RETURNING effect_key`,
        [
          completion.request_id,
          transitionTime,
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
      await assertRuntimeCompletionManifestInTransactionV1(sql, {
        requestId: completion.request_id,
        requireSettledMandatoryEffects: true,
      });
      const committedEffects = await sql.unsafe<Array<{ request_id: string }>>(
        `UPDATE runtime_completion_requests
            SET apply_phase = 'effects_committed', effects_committed_at = $2,
                result = $3::text::jsonb, updated_at = $2
          WHERE request_id = $1 AND apply_phase = 'owner_committed'
          RETURNING request_id`,
        [completion.request_id, transitionTime, JSON.stringify(result)],
      );
      if (committedEffects.length !== 1) {
        throw new Error("RUN_TERMINAL_COMPLETION_COMMIT_CAS_LOST");
      }
    }
  }

  // Drained is the durable quiescence proof. Release it for both the initial
  // terminal transition and an already-terminal replay repairing historical
  // residue; an undrained replay was rejected before any owner mutation.
  const releasedRuntimes = await sql.unsafe<Array<{ session_id: string }>>(
    `UPDATE runtime_sessions
        SET state = 'released', released_at = COALESCE(released_at, $2),
            state_version = state_version + 1, updated_at = $2
      WHERE run_id = $1 AND state = 'drained'
      RETURNING session_id`,
    [input.runId, transitionTime],
  );

  const terminalEventPayload = {
    schema: "setfarm.run-terminal-event.v2",
    runId: input.runId,
    status: input.status,
    previousStatus,
    reasonCode: alreadyTerminal
      ? "historical_terminal_residue_reconciled"
      : "canonical_terminal_transition",
    ...(!alreadyTerminal ? { diagnostic: input.diagnostic } : {}),
    closedClaims,
    closedAttempts,
    closedRecoveryDeliveries: recoverySettlement.closedDeliveries,
    closedRecoveryCases: recoverySettlement.closedRecoveryCases,
    recoveryDecisionRefs: recoverySettlement.decisionRefs,
    changedSteps,
    changedStories,
    rejectedRuntimeCompletions,
    committedRuntimeCompletions,
    releasedRuntimes: releasedRuntimes.length,
    ...(terminationRequestId ? { terminationRequestId } : {}),
  };
  const reconciledMutations = closedClaims
    + closedAttempts
    + recoverySettlement.closedDeliveries
    + recoverySettlement.closedRecoveryCases
    + changedSteps
    + changedStories
    + rejectedRuntimeCompletions
    + committedRuntimeCompletions
    + releasedRuntimes.length;
  if (!alreadyTerminal || reconciledMutations > 0) {
    const terminalEventKey = alreadyTerminal
      ? `run/${input.runId}/terminal-reconciled/${hashCanonicalJson(terminalEventPayload)}`
      : `run/${input.runId}/terminal/v2/${input.status}`;
    await enqueueOperationalOutboxEventInTransaction(sql, {
      eventKey: terminalEventKey,
      eventType: "run.terminal",
      aggregateType: "run",
      aggregateId: input.runId,
      payload: terminalEventPayload,
      now: transitionTime,
    });
  }
  if (terminationRequestId) {
    const terminalized = await sql.unsafe<Array<{ request_id: string }>>(
      `UPDATE run_termination_requests
          SET state = 'terminalized', terminalized_at = $3,
              heartbeat_at = $3, updated_at = $3
        WHERE request_id = $1 AND run_id = $2 AND state = 'drained'
        RETURNING request_id`,
      [terminationRequestId, input.runId, transitionTime],
    );
    if (terminalized.length !== 1) throw new Error("RUN_TERMINAL_REQUEST_CAS_LOST");
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
  return sql.begin((transaction) => transitionRunToTerminalInTransaction(transaction, input)) as Promise<RunTerminalTransitionResult>;
}
