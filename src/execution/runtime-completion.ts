import { createHash, randomUUID } from "node:crypto";

import type postgres from "postgres";
import { z } from "zod";

import { readDatabaseWallClock } from "../db/database-wall-clock.js";
import { assertClaimAuthority, parseClaimEnvelope } from "./claim-authority.js";
import type { ClaimEnvelopeV1 } from "./schemas/claim-envelope-v1.js";
import {
  createRuntimeCompletionPlanV1,
  RuntimeCompletionPlanDescriptorV1Schema,
  RuntimeCompletionPlanV1Schema,
  type RuntimeCompletionPlanDescriptorV1,
  type RuntimeCompletionPlanV1,
} from "./schemas/runtime-completion-plan-v1.js";
import {
  RuntimeCompletionSubmissionEvidenceV1Schema,
  type RuntimeCompletionSubmissionEvidenceV1,
} from "./schemas/runtime-completion-submission-evidence-v1.js";
import { canonicalJsonStringify, hashCanonicalJson } from "../product-compiler/canonical-json.js";
import { releaseDrainedRuntimeSessionInTransaction } from "./runtime-session-repository.js";
import { currentRuntimeCompletionOwnerCapability } from "./runtime-completion-owner-context.js";
import { compileV3ImplementationTransportProposalV1 } from "./v3-implementation-output.js";
import { compileV3ImplementationCompletionProposal } from "./v3-implementation-completion.js";
import { v3RecoveryStoryLockIdentity } from "../recovery/v3-recovery-claim-authority.js";

type Sql = postgres.Sql;
type TransactionSql = postgres.TransactionSql;

const RuntimeCompletionRequestIdSchema = z.string().regex(/^RCR_[A-Za-z0-9-]{16,160}$/);
const RuntimeCompletionStateSchema = z.enum([
  "requested",
  "draining",
  "processing",
  "accepted",
  "rejected",
  "quarantined",
]);
const RuntimeCompletionApplyPhaseSchema = z.enum([
  "proposed",
  "executing",
  "owner_committed",
  "effects_committed",
]);

export {
  RuntimeCompletionSubmissionEvidenceV1Schema,
  type RuntimeCompletionSubmissionEvidenceV1,
} from "./schemas/runtime-completion-submission-evidence-v1.js";

type RuntimeCompletionRow = Readonly<{
  request_id: string;
  runtime_session_id: string;
  claim_id: string;
  run_id: string;
  step_db_id: string;
  workflow_step_id: string;
  story_db_id: string | null;
  story_id: string | null;
  attempt_id: string | null;
  claim_envelope: unknown;
  output: string;
  output_hash: string;
  source_proposal: string | null;
  submission_evidence: unknown | null;
  apply_phase: string;
  claim_outcome: string | null;
  claim_committed_at: Date | string | null;
  effects_committed_at: Date | string | null;
  completion_plan: unknown | null;
  completion_plan_hash: string | null;
  prepared_at: Date | string | null;
  owner_attempt_count: number;
  state: string;
  requested_by: string;
  owner_instance_id: string | null;
  lease_expires_at: Date | string | null;
  requested_at: Date | string;
  drained_at: Date | string | null;
  processing_at: Date | string | null;
  accepted_at: Date | string | null;
  rejected_at: Date | string | null;
  diagnostic: string | null;
  result: unknown;
  created_at: Date | string;
  updated_at: Date | string;
}>;

export type RuntimeCompletionRequest = Readonly<{
  requestId: string;
  runtimeSessionId: string;
  claimId: number;
  runId: string;
  stepDbId: string;
  workflowStepId: string;
  storyDbId?: string;
  storyId?: string;
  attemptId?: string;
  claimEnvelope: ClaimEnvelopeV1;
  output: string;
  outputHash: string;
  submissionEvidence?: RuntimeCompletionSubmissionEvidenceV1;
  sourceProposalRef?: string;
  applyPhase: z.infer<typeof RuntimeCompletionApplyPhaseSchema>;
  claimOutcome?: string;
  claimCommittedAt?: string;
  effectsCommittedAt?: string;
  completionPlan?: RuntimeCompletionPlanV1;
  completionPlanHash?: string;
  preparedAt?: string;
  ownerAttemptCount: number;
  state: z.infer<typeof RuntimeCompletionStateSchema>;
  requestedBy: string;
  ownerInstanceId?: string;
  leaseExpiresAt?: string;
  requestedAt: string;
  drainedAt?: string;
  processingAt?: string;
  acceptedAt?: string;
  rejectedAt?: string;
  diagnostic?: string;
  result: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}>;

function timestamp(value: Date | string): string {
  return (value instanceof Date ? value : new Date(value)).toISOString();
}

function optionalTimestamp(value: Date | string | null): string | undefined {
  return value === null ? undefined : timestamp(value);
}

function validTime(value: Date | undefined): Date {
  const parsed = value ? new Date(value) : new Date();
  if (!Number.isFinite(parsed.getTime())) throw new Error("RUNTIME_COMPLETION_TIME_INVALID");
  return parsed;
}

function exactTimestamp(value: string, code: string): Date {
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) throw new Error(code);
  return parsed;
}

function claimId(value: string): number {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) throw new Error("RUNTIME_COMPLETION_CLAIM_ID_INVALID");
  return parsed;
}

function objectValue(value: unknown, code: string): Record<string, unknown> {
  const parsed = typeof value === "string" ? JSON.parse(value) as unknown : value;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error(code);
  return parsed as Record<string, unknown>;
}

function mapRequest(row: RuntimeCompletionRow): RuntimeCompletionRequest {
  const envelope = parseClaimEnvelope(
    typeof row.claim_envelope === "string" ? JSON.parse(row.claim_envelope) : row.claim_envelope,
  );
  const submissionEvidence = row.submission_evidence
    ? RuntimeCompletionSubmissionEvidenceV1Schema.parse(
        typeof row.submission_evidence === "string"
          ? JSON.parse(row.submission_evidence)
          : row.submission_evidence,
      )
    : undefined;
  if (submissionEvidence) {
    if (
      envelope.protocol !== "v3"
      || envelope.workflowStepId !== "implement"
      || submissionEvidence.canonicalOutputHash !== row.output_hash
      || !row.source_proposal
      || createHash("sha256").update(row.source_proposal, "utf8").digest("hex")
        !== submissionEvidence.sourceProposalHash
    ) {
      throw new Error("RUNTIME_COMPLETION_SUBMISSION_EVIDENCE_DB_BINDING_INVALID");
    }
  } else if (row.source_proposal !== null) {
    throw new Error("RUNTIME_COMPLETION_SOURCE_PROPOSAL_DB_BINDING_INVALID");
  }
  return Object.freeze({
    requestId: RuntimeCompletionRequestIdSchema.parse(row.request_id),
    runtimeSessionId: row.runtime_session_id,
    claimId: claimId(row.claim_id),
    runId: row.run_id,
    stepDbId: row.step_db_id,
    workflowStepId: row.workflow_step_id,
    ...(row.story_db_id ? { storyDbId: row.story_db_id } : {}),
    ...(row.story_id ? { storyId: row.story_id } : {}),
    ...(row.attempt_id ? { attemptId: row.attempt_id } : {}),
    claimEnvelope: envelope,
    output: row.output,
    outputHash: row.output_hash,
    ...(submissionEvidence
      ? {
          submissionEvidence,
          sourceProposalRef: `setfarm://runtime-completion/${row.request_id}/source-proposal/${submissionEvidence.sourceProposalHash}`,
        }
      : {}),
    applyPhase: RuntimeCompletionApplyPhaseSchema.parse(row.apply_phase),
    ...(row.claim_outcome ? { claimOutcome: row.claim_outcome } : {}),
    ...(optionalTimestamp(row.claim_committed_at) ? { claimCommittedAt: optionalTimestamp(row.claim_committed_at) } : {}),
    ...(optionalTimestamp(row.effects_committed_at) ? { effectsCommittedAt: optionalTimestamp(row.effects_committed_at) } : {}),
    ...(row.completion_plan ? {
      completionPlan: RuntimeCompletionPlanV1Schema.parse(
        typeof row.completion_plan === "string" ? JSON.parse(row.completion_plan) : row.completion_plan,
      ),
    } : {}),
    ...(row.completion_plan_hash ? { completionPlanHash: row.completion_plan_hash } : {}),
    ...(optionalTimestamp(row.prepared_at) ? { preparedAt: optionalTimestamp(row.prepared_at) } : {}),
    ownerAttemptCount: row.owner_attempt_count,
    state: RuntimeCompletionStateSchema.parse(row.state),
    requestedBy: row.requested_by,
    ...(row.owner_instance_id ? { ownerInstanceId: row.owner_instance_id } : {}),
    ...(optionalTimestamp(row.lease_expires_at) ? { leaseExpiresAt: optionalTimestamp(row.lease_expires_at) } : {}),
    requestedAt: timestamp(row.requested_at),
    ...(optionalTimestamp(row.drained_at) ? { drainedAt: optionalTimestamp(row.drained_at) } : {}),
    ...(optionalTimestamp(row.processing_at) ? { processingAt: optionalTimestamp(row.processing_at) } : {}),
    ...(optionalTimestamp(row.accepted_at) ? { acceptedAt: optionalTimestamp(row.accepted_at) } : {}),
    ...(optionalTimestamp(row.rejected_at) ? { rejectedAt: optionalTimestamp(row.rejected_at) } : {}),
    ...(row.diagnostic ? { diagnostic: row.diagnostic } : {}),
    result: Object.freeze({ ...objectValue(row.result, "RUNTIME_COMPLETION_RESULT_INVALID") }),
    createdAt: timestamp(row.created_at),
    updatedAt: timestamp(row.updated_at),
  });
}

export function newRuntimeCompletionRequestId(): string {
  return `RCR_${randomUUID()}`;
}

export type RequestRuntimeCompletionResult =
  | Readonly<{ status: "direct" }>
  | Readonly<{ status: "requested" | "existing"; request: RuntimeCompletionRequest }>;

function completionReplayOutputMatches(
  replay: RuntimeCompletionRequest,
  candidateOutputHash: string,
  rawOutput: string,
  nativeV3Implementation: boolean,
): boolean {
  if (replay.outputHash === candidateOutputHash) return true;
  if (!nativeV3Implementation || replay.submissionEvidence) return false;
  // Migration-v19 compatibility: historic native-v3 requests retained the
  // raw legacy transport object. Compare its canonical projection without
  // retroactively manufacturing a receipt or changing the stored owner.
  try {
    return compileV3ImplementationTransportProposalV1(replay.output)
      .canonicalOutputHash === candidateOutputHash;
  } catch {
    return replay.output === rawOutput;
  }
}

/**
 * Stamp the exact claim/product owner commit in the same transaction that
 * closes the claim. This is the durable crash boundary: claim outcome alone
 * is never used as a proxy for completion continuation/effect success.
 */
export async function markRuntimeCompletionOwnerCommittedInTransaction(
  sql: TransactionSql,
  input: Readonly<{
    claimId: number;
    claimOutcome: string;
    plan: RuntimeCompletionPlanDescriptorV1;
    now?: Date;
  }>,
): Promise<boolean> {
  if (!Number.isSafeInteger(input.claimId) || input.claimId <= 0) {
    throw new Error("RUNTIME_COMPLETION_OWNER_COMMIT_CLAIM_ID_INVALID");
  }
  if (!input.claimOutcome.trim()) throw new Error("RUNTIME_COMPLETION_OWNER_COMMIT_OUTCOME_INVALID");
  const descriptor = RuntimeCompletionPlanDescriptorV1Schema.parse(input.plan);
  validTime(input.now);
  const rows = await sql.unsafe<RuntimeCompletionRow[]>(
    `SELECT *
       FROM runtime_completion_requests
      WHERE claim_id = $1
      FOR UPDATE`,
    [input.claimId],
  );
  const current = rows[0];
  if (!current) return false;
  const wallClock = await readDatabaseWallClock(
    sql,
    "RUNTIME_COMPLETION_DATABASE_WALL_CLOCK_UNAVAILABLE",
  );
  if (current.state !== "processing") {
    if (
      current.apply_phase === "effects_committed"
      && current.claim_outcome === input.claimOutcome
    ) return true;
    throw new Error(`RUNTIME_COMPLETION_OWNER_COMMIT_STATE_INVALID:${current.state}`);
  }
  const capability = currentRuntimeCompletionOwnerCapability();
  if (
    !capability
    || current.request_id !== capability.requestId
    || current.owner_instance_id !== capability.ownerInstanceId
    || current.owner_attempt_count !== capability.ownerAttemptCount
    || !current.lease_expires_at
    || new Date(current.lease_expires_at).getTime() <= wallClock.getTime()
  ) {
    throw new Error("RUNTIME_COMPLETION_OWNER_COMMIT_CAPABILITY_STALE");
  }
  if (["owner_committed", "effects_committed"].includes(current.apply_phase)) {
    if (current.claim_outcome !== input.claimOutcome) {
      throw new Error("RUNTIME_COMPLETION_OWNER_COMMIT_OUTCOME_CONFLICT");
    }
    const storedPlan = current.completion_plan
      ? RuntimeCompletionPlanV1Schema.parse(
        typeof current.completion_plan === "string" ? JSON.parse(current.completion_plan) : current.completion_plan,
      )
      : undefined;
    if (!storedPlan || hashCanonicalJson({
      kind: storedPlan.kind,
      continuation: storedPlan.continuation,
      subject: storedPlan.subject,
      effects: storedPlan.effects,
    }) !== hashCanonicalJson(descriptor)) {
      throw new Error("RUNTIME_COMPLETION_OWNER_COMMIT_PLAN_CONFLICT");
    }
    return true;
  }
  if (current.apply_phase !== "executing") {
    throw new Error(`RUNTIME_COMPLETION_OWNER_COMMIT_PHASE_INVALID:${current.apply_phase}`);
  }
  const prepared = createRuntimeCompletionPlanV1({
    requestId: current.request_id,
    claimId: input.claimId,
    runId: current.run_id,
    stepDbId: current.step_db_id,
    workflowStepId: current.workflow_step_id,
    outputHash: current.output_hash,
    descriptor,
    preparedAt: wallClock,
  });
  const updated = await sql.unsafe<Array<{ request_id: string }>>(
    `UPDATE runtime_completion_requests
        SET apply_phase = 'owner_committed', claim_outcome = $2,
            claim_committed_at = $3,
            completion_plan = $4::text::jsonb,
            completion_plan_hash = $5,
            prepared_at = $3,
            updated_at = $3
      WHERE claim_id = $1
        AND request_id = $6
        AND state = 'processing'
        AND apply_phase = 'executing'
        AND owner_instance_id = $7
        AND owner_attempt_count = $8
        AND lease_expires_at > $9
      RETURNING request_id`,
    [
      input.claimId,
      input.claimOutcome.slice(0, 80),
      wallClock,
      JSON.stringify(prepared.plan),
      prepared.planHash,
      capability.requestId,
      capability.ownerInstanceId,
      capability.ownerAttemptCount,
      wallClock,
    ],
  );
  if (updated.length !== 1) throw new Error("RUNTIME_COMPLETION_OWNER_COMMIT_CAS_LOST");
  for (const effect of prepared.plan.effects) {
    const effectPayload = {
      schema: "setfarm.runtime-completion-effect-input.v1",
      planHash: prepared.planHash,
      plan: prepared.plan,
      effect: effect.payload,
    };
    await sql.unsafe(
      `INSERT INTO runtime_completion_effects (
         request_id, effect_key, ordinal, effect_type, input_hash,
         payload, mandatory, state, created_at, updated_at
       ) VALUES ($1, $2, $3, $4, $5, $6::text::jsonb, $7, 'pending', $8, $8)
       ON CONFLICT (request_id, effect_key) DO NOTHING`,
      [
        current.request_id,
        effect.effectKey,
        effect.ordinal,
        effect.effectType,
        hashCanonicalJson(effectPayload),
        JSON.stringify(effectPayload),
        effect.mandatory,
        wallClock,
      ],
    );
  }
  const outboxEventKey = `runtime-completion/${current.request_id}/owner-committed`;
  await sql.unsafe(
    `INSERT INTO operational_outbox (
       outbox_id, request_id, event_key, event_type, aggregate_type,
       aggregate_id, payload, state, created_at, updated_at
     ) VALUES ($1, $2, $3, 'runtime.completion_owner_committed',
       'run', $4, $5::text::jsonb, 'pending', $6, $6)
     ON CONFLICT (event_key) DO NOTHING`,
    [
      `OBX_${hashCanonicalJson(outboxEventKey).slice(0, 40)}`,
      current.request_id,
      outboxEventKey,
      current.run_id,
      JSON.stringify({
        schema: "setfarm.operational-outbox-event.v1",
        requestId: current.request_id,
        claimId: input.claimId,
        claimOutcome: input.claimOutcome,
        planHash: prepared.planHash,
      }),
      wallClock,
    ],
  );
  return true;
}

/**
 * Publish an agent's completion proposal without allowing that still-running
 * runtime to close its claim. The spawner is the only consumer allowed to
 * accept it, after durable drain evidence exists.
 */
export async function requestRuntimeCompletion(
  sql: Sql,
  rawInput: Readonly<{
    envelope: ClaimEnvelopeV1;
    output: string;
    requestId?: string;
    now?: Date;
  }>,
): Promise<RequestRuntimeCompletionResult> {
  if (
    Object.hasOwn(rawInput, "submissionEvidence")
    || Object.hasOwn(rawInput, "sourceProposal")
  ) {
    throw new Error("RUNTIME_COMPLETION_CALLER_COMPILER_EVIDENCE_NOT_AUTHORIZED");
  }
  const envelope = parseClaimEnvelope(rawInput.envelope);
  const rawOutput = String(rawInput.output ?? "");
  const outputBytes = Buffer.byteLength(rawOutput, "utf8");
  if (outputBytes < 1 || outputBytes > 4 * 1024 * 1024) {
    throw new Error("RUNTIME_COMPLETION_OUTPUT_SIZE_INVALID");
  }
  validTime(rawInput.now);
  const nativeV3Implementation = envelope.protocol === "v3"
    && envelope.workflowStepId === "implement";
  const transportCompilation = nativeV3Implementation
    ? compileV3ImplementationTransportProposalV1(rawOutput)
    : undefined;
  let output = transportCompilation
    ? canonicalJsonStringify(transportCompilation.output)
    : rawOutput;
  let outputHash = createHash("sha256").update(output, "utf8").digest("hex");
  let submissionEvidence: RuntimeCompletionSubmissionEvidenceV1 | undefined;
  let sourceProposal: string | undefined;
  const requestId = rawInput.requestId
    ? RuntimeCompletionRequestIdSchema.parse(rawInput.requestId)
    : newRuntimeCompletionRequestId();

  // Lost-response retries must be answerable from durable identity even after
  // the claim/run has become terminal. Authority validation is intentionally
  // below this exact replay lookup; it protects new publications, while this
  // branch only returns the already-committed request for the same capability
  // and output hash.
  const replayRows = await sql.unsafe<RuntimeCompletionRow[]>(
    "SELECT * FROM runtime_completion_requests WHERE claim_id = $1 LIMIT 1",
    [envelope.claimId],
  );
  if (replayRows[0]) {
    const replay = mapRequest(replayRows[0]);
    if (
      !completionReplayOutputMatches(
        replay,
        outputHash,
        rawOutput,
        nativeV3Implementation,
      )
      || JSON.stringify(replay.claimEnvelope) !== JSON.stringify(envelope)
    ) {
      throw new Error("RUNTIME_COMPLETION_REQUEST_CONFLICT");
    }
    return { status: "existing", request: replay };
  }

  const runtimeRows = await sql.unsafe<Array<{ session_id: string }>>(
    "SELECT session_id FROM runtime_sessions WHERE claim_id = $1 LIMIT 1",
    [envelope.claimId],
  );
  if (runtimeRows.length === 0) {
    if (envelope.protocol !== "legacy") {
      throw new Error("RUNTIME_COMPLETION_MANAGED_RUNTIME_REQUIRED");
    }
    return { status: "direct" };
  }

  if (nativeV3Implementation) {
    const compiled = await compileV3ImplementationCompletionProposal({
      sql,
      envelope,
      rawProposal: rawOutput,
    });
    output = compiled.output;
    outputHash = compiled.submissionEvidence.canonicalOutputHash;
    submissionEvidence = compiled.submissionEvidence;
    sourceProposal = compiled.sourceProposal;
  }

  await assertClaimAuthority(sql, envelope, envelope.stepId);

  return sql.begin(async (transaction) => {
    if (envelope.storyId) {
      await transaction.unsafe("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [
        v3RecoveryStoryLockIdentity({ runId: envelope.runId, storyId: envelope.storyId }),
      ]);
    }
    const runs = await transaction.unsafe<Array<{ status: string }>>(
      "SELECT status FROM runs WHERE id = $1 FOR UPDATE",
      [envelope.runId],
    );
    if (!runs[0] || !["running", "resuming"].includes(runs[0].status)) {
      throw new Error(`RUNTIME_COMPLETION_RUN_NOT_ACTIVE:${runs[0]?.status ?? "missing"}`);
    }
    const terminations = await transaction.unsafe<Array<{ request_id: string }>>(
      `SELECT request_id FROM run_termination_requests
        WHERE run_id = $1 AND state <> 'terminalized'
        ORDER BY requested_at, request_id LIMIT 1 FOR UPDATE`,
      [envelope.runId],
    );
    if (terminations.length > 0) throw new Error("RUNTIME_COMPLETION_TERMINATION_PENDING");

    const runtimeOwners = await transaction.unsafe<Array<{
      runtime_session_id: string;
      runtime_state: string;
      runtime_owner_instance_id: string;
      runtime_attempt_id: string | null;
    }>>(
      `SELECT rs.session_id AS runtime_session_id,
              rs.state AS runtime_state,
              rs.owner_instance_id AS runtime_owner_instance_id,
              rs.attempt_id AS runtime_attempt_id
         FROM runtime_sessions rs
        WHERE rs.claim_id = $1 AND rs.run_id = $2
        ORDER BY rs.session_id
        FOR UPDATE`,
      [envelope.claimId, envelope.runId],
    );
    if (runtimeOwners.length !== 1) {
      throw new Error(`RUNTIME_COMPLETION_RUNTIME_OWNER_CARDINALITY_INVALID:${runtimeOwners.length}`);
    }
    const runtimeOwner = runtimeOwners[0];
    if (!runtimeOwner) throw new Error("RUNTIME_COMPLETION_OWNER_NOT_FOUND");

    let normalAttemptLeaseFence: Readonly<{
      attemptLeaseExpiresAt: Date | string;
    }> | undefined;
    let recoveryLeaseFence: Readonly<{
      attemptLeaseExpiresAt: Date | string;
      deliveryLeaseExpiresAt: Date | string;
    }> | undefined;
    if (nativeV3Implementation && envelope.attempt) {
      const attempts = await transaction.unsafe<Array<{
        attempt_id: string;
        claim_id: string | number | null;
        run_id: string;
        story_id: string;
        generation: number;
        fence_token: string;
        disposition: string;
        step_id: string;
        agent_id: string | null;
        recovery_case_revision_id: string | null;
        recovery_dispatch_id: string | null;
        lease_expires_at: Date | string;
      }>>(
        `SELECT attempt_id, claim_id, run_id, step_id, story_id, agent_id,
                generation, fence_token, disposition,
                recovery_case_revision_id, recovery_dispatch_id,
                lease_expires_at
           FROM execution_attempts
          WHERE attempt_id = $1
          FOR UPDATE`,
        [envelope.attempt.attemptId],
      );
      const attempt = attempts[0];
      const recoveryBound = Boolean(
        attempt?.recovery_case_revision_id && attempt.recovery_dispatch_id,
      );
      if ((attempt?.recovery_case_revision_id === null) !== (attempt?.recovery_dispatch_id === null)) {
        throw new Error("RUNTIME_COMPLETION_RECOVERY_ATTEMPT_IDENTITY_INCOMPLETE");
      }
      const exactAttempt = Boolean(
        attempt
        && Number(attempt.claim_id) === envelope.claimId
        && attempt.run_id === envelope.runId
        && attempt.step_id === envelope.workflowStepId
        && attempt.story_id === envelope.storyId
        && (attempt.agent_id === null || attempt.agent_id === envelope.claimAgentId)
        && attempt.generation === envelope.attempt.generation
        && attempt.fence_token === envelope.attempt.fenceToken
        && ["claimed", "running"].includes(attempt.disposition)
        && runtimeOwner.runtime_attempt_id === attempt.attempt_id
      );
      if (!exactAttempt) {
        throw new Error(
          recoveryBound
            ? "RUNTIME_COMPLETION_RECOVERY_ATTEMPT_FENCE_STALE"
            : "RUNTIME_COMPLETION_NORMAL_ATTEMPT_FENCE_STALE",
        );
      }
      if (recoveryBound) {
        const deliveries = await transaction.unsafe<Array<{
          dispatch_id: string;
          lease_expires_at: Date | string;
        }>>(
          `SELECT dispatch_id, lease_expires_at
             FROM recovery_dispatch_deliveries
            WHERE dispatch_id = $1
              AND revision_id = $2
              AND run_id = $3
              AND story_id = $4
              AND attempt_id = $5
              AND claim_id = $6
              AND state IN ('attempt_reserved', 'running')
            FOR UPDATE`,
          [
            attempt.recovery_dispatch_id!,
            attempt.recovery_case_revision_id!,
            envelope.runId,
            envelope.storyId!,
            attempt.attempt_id,
            envelope.claimId,
          ],
        );
        if (deliveries.length !== 1) {
          throw new Error("RUNTIME_COMPLETION_RECOVERY_DELIVERY_FENCE_STALE");
        }
        recoveryLeaseFence = {
          attemptLeaseExpiresAt: attempt.lease_expires_at,
          deliveryLeaseExpiresAt: deliveries[0]!.lease_expires_at,
        };
      } else {
        normalAttemptLeaseFence = { attemptLeaseExpiresAt: attempt!.lease_expires_at };
      }
    }

    const claimOwners = await transaction.unsafe<Array<{
      claim_outcome: string | null;
      claim_run_id: string;
      claim_step_id: string;
      claim_story_id: string | null;
      claim_agent_id: string;
    }>>(
      `SELECT cl.outcome AS claim_outcome, cl.run_id AS claim_run_id,
              cl.step_id AS claim_step_id, cl.story_id AS claim_story_id,
              cl.agent_id AS claim_agent_id
         FROM claim_log cl
        WHERE cl.id = $1
        FOR UPDATE`,
      [envelope.claimId],
    );
    const claimOwner = claimOwners[0];
    if (!claimOwner) throw new Error("RUNTIME_COMPLETION_OWNER_NOT_FOUND");
    if (
      claimOwner.claim_run_id !== envelope.runId
      || claimOwner.claim_step_id !== envelope.workflowStepId
      || (claimOwner.claim_story_id ?? undefined) !== envelope.storyId
      || claimOwner.claim_agent_id !== envelope.claimAgentId
    ) throw new Error("RUNTIME_COMPLETION_OWNER_IDENTITY_MISMATCH");
    if (claimOwner.claim_outcome !== null) throw new Error("RUNTIME_COMPLETION_OWNER_NOT_ACTIVE");
    const owner = { ...runtimeOwner, ...claimOwner };

    const existing = await transaction.unsafe<RuntimeCompletionRow[]>(
      "SELECT * FROM runtime_completion_requests WHERE claim_id = $1 LIMIT 1 FOR UPDATE",
      [envelope.claimId],
    );
    if (existing[0]) {
      const request = mapRequest(existing[0]);
      if (
        request.runtimeSessionId !== owner.runtime_session_id
        || !completionReplayOutputMatches(
          request,
          outputHash,
          rawOutput,
          nativeV3Implementation,
        )
        || JSON.stringify(request.claimEnvelope) !== JSON.stringify(envelope)
      ) {
        throw new Error("RUNTIME_COMPLETION_REQUEST_CONFLICT");
      }
      return { status: "existing" as const, request };
    }
    const steps = await transaction.unsafe<Array<{ status: string; current_story_id: string | null }>>(
      `SELECT status, current_story_id FROM steps
        WHERE id = $1 AND run_id = $2 AND step_id = $3 FOR UPDATE`,
      [envelope.stepId, envelope.runId, envelope.workflowStepId],
    );
    if (
      steps[0]?.status !== "running"
      || steps[0].current_story_id !== (envelope.storyDbId ?? null)
    ) throw new Error("RUNTIME_COMPLETION_OWNER_NOT_ACTIVE");
    // The step is the final lock in the publication chain. Read a volatile DB
    // wall clock only now: waiting on any earlier owner/step lock must be able
    // to expire the recovery lease before this publication becomes durable.
    const publicationTime = await readDatabaseWallClock(
      transaction,
      "RUNTIME_COMPLETION_DATABASE_WALL_CLOCK_UNAVAILABLE",
    );
    if (recoveryLeaseFence || normalAttemptLeaseFence) {
      const attemptLeaseExpiresAt = recoveryLeaseFence?.attemptLeaseExpiresAt
        ?? normalAttemptLeaseFence!.attemptLeaseExpiresAt;
      if (new Date(attemptLeaseExpiresAt).getTime() <= publicationTime.getTime()) {
        throw new Error(
          recoveryLeaseFence
            ? "RUNTIME_COMPLETION_RECOVERY_ATTEMPT_FENCE_STALE"
            : "RUNTIME_COMPLETION_NORMAL_ATTEMPT_FENCE_STALE",
        );
      }
      if (
        recoveryLeaseFence
        && new Date(recoveryLeaseFence.deliveryLeaseExpiresAt).getTime() <= publicationTime.getTime()
      ) {
        throw new Error("RUNTIME_COMPLETION_RECOVERY_DELIVERY_FENCE_STALE");
      }
    }
    if (!["reserved", "starting", "running", "drain_requested", "drained"].includes(owner.runtime_state)) {
      throw new Error(`RUNTIME_COMPLETION_RUNTIME_STATE_INVALID:${owner.runtime_state}`);
    }

    const inserted = await transaction.unsafe<RuntimeCompletionRow[]>(
      `INSERT INTO runtime_completion_requests (
         request_id, runtime_session_id, claim_id, run_id, step_db_id,
         workflow_step_id, story_db_id, story_id, attempt_id,
         claim_envelope, output, output_hash, source_proposal, submission_evidence,
         state, requested_by, requested_at, result, created_at, updated_at
       ) VALUES (
         $1, $2, $3, $4, $5,
         $6, $7, $8, $9,
         $10::text::jsonb, $11, $12, $13, $14::text::jsonb,
         'requested', $15, $16, '{}'::jsonb, $16, $16
       )
       RETURNING *`,
      [
        requestId,
        owner.runtime_session_id,
        envelope.claimId,
        envelope.runId,
        envelope.stepId,
        envelope.workflowStepId,
        envelope.storyDbId ?? null,
        envelope.storyId ?? null,
        envelope.attempt?.attemptId ?? null,
        JSON.stringify(envelope),
        output,
        outputHash,
        sourceProposal ?? null,
        submissionEvidence ? JSON.stringify(submissionEvidence) : null,
        envelope.runtimeAgentId,
        publicationTime,
      ],
    );
    if (inserted.length !== 1) throw new Error("RUNTIME_COMPLETION_REQUEST_INSERT_FAILED");
    if (["reserved", "starting", "running"].includes(owner.runtime_state)) {
      const drained = await transaction.unsafe<Array<{ session_id: string }>>(
        `UPDATE runtime_sessions
            SET state = 'drain_requested',
                drain_requested_at = COALESCE(drain_requested_at, $3),
                diagnostic = $4,
                state_version = state_version + 1,
                updated_at = $3
          WHERE session_id = $1
            AND owner_instance_id = $2
            AND state IN ('reserved', 'starting', 'running')
          RETURNING session_id`,
        [
          owner.runtime_session_id,
          owner.runtime_owner_instance_id,
          publicationTime,
          `Completion ${requestId} requested exact runtime drain`,
        ],
      );
      if (drained.length !== 1) throw new Error("RUNTIME_COMPLETION_DRAIN_REQUEST_CAS_LOST");
    }
    return { status: "requested" as const, request: mapRequest(inserted[0]!) };
  }) as Promise<RequestRuntimeCompletionResult>;
}

/**
 * Quarantine an expired processing owner from the recovery lane. This is
 * deliberately separate from the live-owner repository API: the caller does
 * not own the expired lease, so it must present the exact owner, lease,
 * phase, and row-version timestamps it locked while proving expiry.
 */
export async function quarantineExpiredRuntimeCompletionForRecoveryInTransaction(
  sql: TransactionSql,
  input: Readonly<{
    requestId: string;
    expectedOwnerInstanceId: string;
    expectedLeaseExpiresAt: string;
    expectedUpdatedAt: string;
    expectedApplyPhase: z.infer<typeof RuntimeCompletionApplyPhaseSchema>;
    diagnostic: string;
    now?: Date;
  }>,
): Promise<RuntimeCompletionRequest> {
  if (!input.expectedOwnerInstanceId.trim()) {
    throw new Error("RUNTIME_COMPLETION_RECOVERY_QUARANTINE_OWNER_REQUIRED");
  }
  if (!input.diagnostic.trim()) {
    throw new Error("RUNTIME_COMPLETION_RECOVERY_QUARANTINE_DIAGNOSTIC_REQUIRED");
  }
  validTime(input.now);
  const expectedLeaseExpiresAt = exactTimestamp(
    input.expectedLeaseExpiresAt,
    "RUNTIME_COMPLETION_RECOVERY_QUARANTINE_LEASE_INVALID",
  );
  const expectedUpdatedAt = exactTimestamp(
    input.expectedUpdatedAt,
    "RUNTIME_COMPLETION_RECOVERY_QUARANTINE_VERSION_INVALID",
  );
  const identities = await sql.unsafe<Array<{ run_id: string }>>(
    "SELECT run_id FROM runtime_completion_requests WHERE request_id = $1",
    [RuntimeCompletionRequestIdSchema.parse(input.requestId)],
  );
  if (!identities[0]) throw new Error("RUNTIME_COMPLETION_RECOVERY_QUARANTINE_CAS_LOST");
  await sql.unsafe("SELECT id FROM runs WHERE id = $1 FOR UPDATE", [identities[0].run_id]);
  const locked = await sql.unsafe<RuntimeCompletionRow[]>(
    "SELECT * FROM runtime_completion_requests WHERE request_id = $1 FOR UPDATE",
    [input.requestId],
  );
  const current = locked[0];
  const now = await readDatabaseWallClock(
    sql,
    "RUNTIME_COMPLETION_DATABASE_WALL_CLOCK_UNAVAILABLE",
  );
  if (
    !current
    || current.state !== "processing"
    || current.owner_instance_id !== input.expectedOwnerInstanceId
    || !current.lease_expires_at
    || new Date(current.lease_expires_at).getTime() !== expectedLeaseExpiresAt.getTime()
    || new Date(current.updated_at).getTime() !== expectedUpdatedAt.getTime()
    || current.apply_phase !== input.expectedApplyPhase
  ) {
    throw new Error("RUNTIME_COMPLETION_RECOVERY_QUARANTINE_CAS_LOST");
  }
  if (expectedLeaseExpiresAt.getTime() > now.getTime()) {
    throw new Error("RUNTIME_COMPLETION_RECOVERY_QUARANTINE_LEASE_STILL_LIVE");
  }
  const rows = await sql.unsafe<RuntimeCompletionRow[]>(
    `UPDATE runtime_completion_requests
        SET state = 'quarantined', lease_expires_at = NULL,
            diagnostic = $2, updated_at = $3
      WHERE request_id = $1
        AND state = 'processing'
        AND owner_instance_id = $4
        AND lease_expires_at = $5
        AND lease_expires_at <= $3
        AND updated_at = $6
        AND apply_phase = $7
      RETURNING *`,
    [
      RuntimeCompletionRequestIdSchema.parse(input.requestId),
      input.diagnostic.slice(0, 4_000),
      now,
      input.expectedOwnerInstanceId,
      expectedLeaseExpiresAt,
      expectedUpdatedAt,
      RuntimeCompletionApplyPhaseSchema.parse(input.expectedApplyPhase),
    ],
  );
  if (rows.length !== 1) {
    throw new Error("RUNTIME_COMPLETION_RECOVERY_QUARANTINE_CAS_LOST");
  }
  return mapRequest(rows[0]!);
}

type LockedRuntimeCompletionChain = Readonly<{
  request: RuntimeCompletionRow;
  runStatus: string;
  terminationRequestId?: string;
  runtimeState: string;
  claimOutcome: string | null;
}>;

async function lockRuntimeCompletionChainInTransaction(
  transaction: TransactionSql,
  rawRequestId: string,
): Promise<LockedRuntimeCompletionChain | undefined> {
  const requestId = RuntimeCompletionRequestIdSchema.parse(rawRequestId);
  const identities = await transaction.unsafe<RuntimeCompletionRow[]>(
    "SELECT * FROM runtime_completion_requests WHERE request_id = $1",
    [requestId],
  );
  const identity = identities[0];
  if (!identity) return undefined;
  if (identity.story_id) {
    await transaction.unsafe("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [
      v3RecoveryStoryLockIdentity({ runId: identity.run_id, storyId: identity.story_id }),
    ]);
  }
  const runs = await transaction.unsafe<Array<{ status: string }>>(
    "SELECT status FROM runs WHERE id = $1 FOR UPDATE",
    [identity.run_id],
  );
  if (!runs[0]) throw new Error("RUNTIME_COMPLETION_RUN_NOT_FOUND");
  const terminations = await transaction.unsafe<Array<{ request_id: string }>>(
    `SELECT request_id FROM run_termination_requests
      WHERE run_id = $1 AND state <> 'terminalized'
      ORDER BY requested_at, request_id LIMIT 1 FOR UPDATE`,
    [identity.run_id],
  );
  const runtimes = await transaction.unsafe<Array<{
    session_id: string;
    claim_id: string | number;
    attempt_id: string | null;
    state: string;
  }>>(
    `SELECT session_id, claim_id, attempt_id, state
       FROM runtime_sessions WHERE session_id = $1 FOR UPDATE`,
    [identity.runtime_session_id],
  );
  const runtime = runtimes[0];
  if (!runtime) throw new Error("RUNTIME_COMPLETION_RUNTIME_NOT_FOUND");
  if (identity.attempt_id) {
    const attempts = await transaction.unsafe<Array<{ attempt_id: string }>>(
      "SELECT attempt_id FROM execution_attempts WHERE attempt_id = $1 FOR UPDATE",
      [identity.attempt_id],
    );
    if (attempts.length !== 1) throw new Error("RUNTIME_COMPLETION_ATTEMPT_NOT_FOUND");
    await transaction.unsafe(
      `SELECT dispatch_id FROM recovery_dispatch_deliveries
        WHERE attempt_id = $1 AND claim_id = $2 FOR UPDATE`,
      [identity.attempt_id, identity.claim_id],
    );
  }
  const claims = await transaction.unsafe<Array<{ outcome: string | null }>>(
    "SELECT outcome FROM claim_log WHERE id = $1 FOR UPDATE",
    [identity.claim_id],
  );
  if (!claims[0]) throw new Error("RUNTIME_COMPLETION_CLAIM_NOT_FOUND");
  const requests = await transaction.unsafe<RuntimeCompletionRow[]>(
    "SELECT * FROM runtime_completion_requests WHERE request_id = $1 FOR UPDATE",
    [requestId],
  );
  const request = requests[0];
  if (
    !request
    || request.run_id !== identity.run_id
    || request.runtime_session_id !== identity.runtime_session_id
    || request.claim_id !== identity.claim_id
    || request.attempt_id !== identity.attempt_id
    || String(runtime.claim_id) !== String(identity.claim_id)
    || runtime.attempt_id !== identity.attempt_id
  ) throw new Error("RUNTIME_COMPLETION_CHAIN_IDENTITY_CHANGED");
  return {
    request,
    runStatus: runs[0].status,
    ...(terminations[0] ? { terminationRequestId: terminations[0].request_id } : {}),
    runtimeState: runtime.state,
    claimOutcome: claims[0].outcome,
  };
}

export function createRuntimeCompletionRepository(sql: Sql) {
  const findById = async (requestId: string): Promise<RuntimeCompletionRequest | undefined> => {
    const rows = await sql.unsafe<RuntimeCompletionRow[]>(
      "SELECT * FROM runtime_completion_requests WHERE request_id = $1 LIMIT 1",
      [RuntimeCompletionRequestIdSchema.parse(requestId)],
    );
    return rows[0] ? mapRequest(rows[0]) : undefined;
  };

  return Object.freeze({
    findById,
    async findByClaimId(rawClaimId: number): Promise<RuntimeCompletionRequest | undefined> {
      if (!Number.isSafeInteger(rawClaimId) || rawClaimId <= 0) throw new Error("RUNTIME_COMPLETION_CLAIM_ID_INVALID");
      const rows = await sql.unsafe<RuntimeCompletionRow[]>(
        "SELECT * FROM runtime_completion_requests WHERE claim_id = $1 LIMIT 1",
        [rawClaimId],
      );
      return rows[0] ? mapRequest(rows[0]) : undefined;
    },
    async listPending(limit = 100): Promise<RuntimeCompletionRequest[]> {
      const bounded = Math.max(1, Math.min(500, Math.trunc(limit)));
      const rows = await sql.unsafe<RuntimeCompletionRow[]>(
        `SELECT * FROM runtime_completion_requests
          WHERE state IN ('requested', 'draining', 'processing')
          ORDER BY requested_at, request_id LIMIT $1`,
        [bounded],
      );
      return rows.map(mapRequest);
    },
    async claim(input: Readonly<{
      requestId?: string;
      ownerInstanceId: string;
      leaseMs?: number;
      now?: Date;
    }>): Promise<RuntimeCompletionRequest | undefined> {
      validTime(input.now);
      const leaseMs = Math.max(30_000, Math.min(30 * 60_000, Math.trunc(input.leaseMs ?? 10 * 60_000)));
      return sql.begin(async (transaction) => {
        const candidates = await transaction.unsafe<Array<{ request_id: string; run_id: string }>>(
          `SELECT request_id, run_id FROM runtime_completion_requests
            WHERE ($1::text IS NULL OR request_id = $1)
              AND (
                state = 'requested'
                OR (state = 'draining' AND lease_expires_at <= clock_timestamp())
              )
            ORDER BY requested_at, request_id
            LIMIT 1`,
          [input.requestId ?? null],
        );
        const candidate = candidates[0];
        if (!candidate) return undefined;

        const chain = await lockRuntimeCompletionChainInTransaction(transaction, candidate.request_id);
        const request = chain?.request;
        const wallClock = await readDatabaseWallClock(
          transaction,
          "RUNTIME_COMPLETION_DATABASE_WALL_CLOCK_UNAVAILABLE",
        );
        if (
          !request
          || !(
            request.state === "requested"
            || (request.state === "draining" && request.lease_expires_at
              && new Date(request.lease_expires_at).getTime() <= wallClock.getTime())
          )
        ) return undefined;
        // A cancellation published before this completion acquired ownership
        // wins immediately. If this request was already draining and its lease
        // expired, however, it must be recoverable solely to finish/reuse the
        // exact drain proof; markProcessing will then observe cancellation and
        // reject the completion before product state can change.
        if (chain.terminationRequestId && request.state === "requested") return undefined;
        const leaseExpiresAt = new Date(wallClock.getTime() + leaseMs);
        const updated = await transaction.unsafe<RuntimeCompletionRow[]>(
          `UPDATE runtime_completion_requests
              SET state = 'draining', owner_instance_id = $2,
                  lease_expires_at = $3, updated_at = $4
            WHERE request_id = $1
              AND (state = 'requested' OR (state = 'draining' AND lease_expires_at <= $5))
            RETURNING *`,
          [request.request_id, input.ownerInstanceId, leaseExpiresAt, wallClock, wallClock],
        );
        return updated[0] ? mapRequest(updated[0]) : undefined;
      }) as Promise<RuntimeCompletionRequest | undefined>;
    },
    async recoverExpiredProcessing(input: Readonly<{
      ownerInstanceId: string;
      leaseMs?: number;
      now?: Date;
    }>): Promise<Readonly<{
      status: "none" | "resume_owner" | "resume_effects" | "finalize" | "preempted" | "quarantined";
      request?: RuntimeCompletionRequest;
    }>> {
      validTime(input.now);
      const leaseMs = Math.max(60_000, Math.min(60 * 60_000, Math.trunc(input.leaseMs ?? 10 * 60_000)));
      return sql.begin(async (transaction) => {
        const candidates = await transaction.unsafe<Array<{ request_id: string; run_id: string }>>(
          `SELECT request_id, run_id
             FROM runtime_completion_requests
            WHERE state = 'processing' AND lease_expires_at <= clock_timestamp()
            ORDER BY requested_at, request_id
            LIMIT 1`,
          [],
        );
        const candidate = candidates[0];
        if (!candidate) return { status: "none" as const };
        const chain = await lockRuntimeCompletionChainInTransaction(transaction, candidate.request_id);
        const request = chain?.request;
        const wallClock = await readDatabaseWallClock(
          transaction,
          "RUNTIME_COMPLETION_DATABASE_WALL_CLOCK_UNAVAILABLE",
        );
        if (
          !request
          || request.state !== "processing"
          || !request.lease_expires_at
          || new Date(request.lease_expires_at).getTime() > wallClock.getTime()
        ) return { status: "none" as const };
        const runtimeState = chain.runtimeState;
        const claimOutcome = chain.claimOutcome;
        const quarantineExpiredOwner = async (diagnostic: string): Promise<RuntimeCompletionRequest> => {
          if (!request.owner_instance_id || !request.lease_expires_at) {
            throw new Error("RUNTIME_COMPLETION_RECOVERY_QUARANTINE_PROOF_INCOMPLETE");
          }
          return quarantineExpiredRuntimeCompletionForRecoveryInTransaction(transaction, {
            requestId: request.request_id,
            expectedOwnerInstanceId: request.owner_instance_id,
            expectedLeaseExpiresAt: timestamp(request.lease_expires_at),
            expectedUpdatedAt: timestamp(request.updated_at),
            expectedApplyPhase: RuntimeCompletionApplyPhaseSchema.parse(request.apply_phase),
            diagnostic,
            now: wallClock,
          });
        };
        if (
          chain.terminationRequestId
          && request.apply_phase === "executing"
          && claimOutcome === null
        ) {
          const rejected = await transaction.unsafe<RuntimeCompletionRow[]>(
            `UPDATE runtime_completion_requests
                SET state = 'rejected', rejected_at = $2, lease_expires_at = NULL,
                    diagnostic = $3, updated_at = $2
              WHERE request_id = $1 AND state = 'processing'
              RETURNING *`,
            [
              request.request_id,
              wallClock,
              `Completion preempted before owner commit by ${chain.terminationRequestId}`,
            ],
          );
          if (rejected.length !== 1) throw new Error("RUNTIME_COMPLETION_RECOVERY_PREEMPT_CAS_LOST");
          return { status: "preempted" as const, request: mapRequest(rejected[0]!) };
        }
        if (
          runtimeState === "drained"
          && claimOutcome === null
          && request.apply_phase === "executing"
        ) {
          if (request.owner_attempt_count >= 3) {
            const quarantined = await quarantineExpiredOwner(
              "RUNTIME_COMPLETION_OWNER_ATTEMPT_BUDGET_EXHAUSTED: exact completion owner failed three times without a durable owner commit",
            );
            return { status: "quarantined" as const, request: quarantined };
          }
          const adopted = await transaction.unsafe<RuntimeCompletionRow[]>(
            `UPDATE runtime_completion_requests
                SET owner_instance_id = $2, lease_expires_at = $3,
                    owner_attempt_count = owner_attempt_count + 1, updated_at = $1
              WHERE request_id = $4 AND state = 'processing'
              RETURNING *`,
            [wallClock, input.ownerInstanceId, new Date(wallClock.getTime() + leaseMs), request.request_id],
          );
          if (adopted.length !== 1) throw new Error("RUNTIME_COMPLETION_RECOVERY_CAS_LOST");
          return { status: "resume_owner" as const, request: mapRequest(adopted[0]!) };
        }
        if (
          runtimeState === "drained"
          && claimOutcome !== null
          && ["owner_committed", "effects_committed"].includes(request.apply_phase)
        ) {
          const adopted = await transaction.unsafe<RuntimeCompletionRow[]>(
            `UPDATE runtime_completion_requests
                SET owner_instance_id = $2, lease_expires_at = $3,
                    owner_attempt_count = owner_attempt_count + 1, updated_at = $1
              WHERE request_id = $4 AND state = 'processing'
              RETURNING *`,
            [wallClock, input.ownerInstanceId, new Date(wallClock.getTime() + leaseMs), request.request_id],
          );
          if (adopted.length !== 1) throw new Error("RUNTIME_COMPLETION_RECOVERY_CAS_LOST");
          return {
            status: request.apply_phase === "effects_committed" ? "finalize" as const : "resume_effects" as const,
            request: mapRequest(adopted[0]!),
          };
        }
        const diagnostic = claimOutcome === null
          ? "EXPIRED_COMPLETION_PROCESSING_WITH_ACTIVE_CLAIM: owner commit absent; bounded recovery required"
          : `EXPIRED_COMPLETION_PROCESSING_RECEIPT_INVALID:phase=${request.apply_phase}:runtime=${runtimeState}`;
        const quarantined = await quarantineExpiredOwner(diagnostic);
        return { status: "quarantined" as const, request: quarantined };
      }) as Promise<Readonly<{
        status: "none" | "resume_owner" | "resume_effects" | "finalize" | "preempted" | "quarantined";
        request?: RuntimeCompletionRequest;
      }>>;
    },
    async heartbeatProcessing(input: Readonly<{
      requestId: string;
      ownerInstanceId: string;
      ownerAttemptCount: number;
      leaseMs?: number;
      now?: Date;
    }>): Promise<boolean> {
      validTime(input.now);
      const leaseMs = Math.max(60_000, Math.min(60 * 60_000, Math.trunc(input.leaseMs ?? 10 * 60_000)));
      return sql.begin(async (transaction) => {
        const chain = await lockRuntimeCompletionChainInTransaction(transaction, input.requestId);
        const request = chain?.request;
        if (!request) return false;
        const wallClock = await readDatabaseWallClock(
          transaction,
          "RUNTIME_COMPLETION_DATABASE_WALL_CLOCK_UNAVAILABLE",
        );
        const ownerAttemptCount = z.number().int().positive().parse(input.ownerAttemptCount);
        if (
          request.state !== "processing"
          || request.owner_instance_id !== input.ownerInstanceId
          || request.owner_attempt_count !== ownerAttemptCount
          || !request.lease_expires_at
          || new Date(request.lease_expires_at).getTime() <= wallClock.getTime()
        ) return false;
        const rows = await transaction.unsafe<Array<{ request_id: string }>>(
          `UPDATE runtime_completion_requests
              SET lease_expires_at = $3, updated_at = $4
            WHERE request_id = $1
              AND owner_instance_id = $2
              AND owner_attempt_count = $5
              AND state = 'processing'
              AND lease_expires_at > $6
            RETURNING request_id`,
          [
            request.request_id,
            input.ownerInstanceId,
            new Date(wallClock.getTime() + leaseMs),
            wallClock,
            ownerAttemptCount,
            wallClock,
          ],
        );
        return rows.length === 1;
      }) as Promise<boolean>;
    },
    async markProcessing(input: Readonly<{
      requestId: string;
      ownerInstanceId: string;
      leaseMs?: number;
      now?: Date;
    }>): Promise<RuntimeCompletionRequest> {
      validTime(input.now);
      const leaseMs = Math.max(60_000, Math.min(60 * 60_000, Math.trunc(input.leaseMs ?? 30 * 60_000)));
      return sql.begin(async (transaction) => {
        const chain = await lockRuntimeCompletionChainInTransaction(transaction, input.requestId);
        const request = chain?.request;
        if (!request) throw new Error("RUNTIME_COMPLETION_REQUEST_NOT_FOUND");
        const wallClock = await readDatabaseWallClock(
          transaction,
          "RUNTIME_COMPLETION_DATABASE_WALL_CLOCK_UNAVAILABLE",
        );
        if (request.state !== "draining" || request.owner_instance_id !== input.ownerInstanceId) {
          throw new Error("RUNTIME_COMPLETION_DRAIN_OWNER_MISMATCH");
        }
        if (
          !request.lease_expires_at
          || new Date(request.lease_expires_at).getTime() <= wallClock.getTime()
        ) throw new Error("RUNTIME_COMPLETION_DRAIN_OWNER_LEASE_STALE");
        if (chain.runtimeState !== "drained") throw new Error("RUNTIME_COMPLETION_RUNTIME_NOT_DRAINED");
        if (chain.claimOutcome !== null) throw new Error("RUNTIME_COMPLETION_CLAIM_ALREADY_TERMINAL");
        if (!["running", "resuming"].includes(chain.runStatus)) {
          throw new Error(`RUNTIME_COMPLETION_RUN_NOT_ACTIVE:${chain.runStatus}`);
        }
        if (chain.terminationRequestId) throw new Error("RUNTIME_COMPLETION_TERMINATION_PENDING");
        const updated = await transaction.unsafe<RuntimeCompletionRow[]>(
          `UPDATE runtime_completion_requests
              SET state = 'processing', processing_at = $3,
                  apply_phase = 'executing',
                  owner_attempt_count = owner_attempt_count + 1,
                  drained_at = COALESCE(drained_at, $3),
                  lease_expires_at = $4, updated_at = $3
            WHERE request_id = $1 AND owner_instance_id = $2 AND state = 'draining'
              AND owner_attempt_count < 3
            RETURNING *`,
          [
            request.request_id,
            input.ownerInstanceId,
            wallClock,
            new Date(wallClock.getTime() + leaseMs),
          ],
        );
        if (updated.length !== 1) throw new Error("RUNTIME_COMPLETION_PROCESSING_CAS_LOST");
        return mapRequest(updated[0]!);
      }) as Promise<RuntimeCompletionRequest>;
    },
    async markEffectsCommitted(input: Readonly<{
      requestId: string;
      ownerInstanceId: string;
      ownerAttemptCount: number;
      result: Record<string, unknown>;
      now?: Date;
    }>): Promise<RuntimeCompletionRequest> {
      if (input.now) validTime(input.now);
      return sql.begin(async (transaction) => {
        const chain = await lockRuntimeCompletionChainInTransaction(
          transaction,
          input.requestId,
        );
        const current = chain?.request;
        if (!current) throw new Error("RUNTIME_COMPLETION_REQUEST_NOT_FOUND");
        const ownerAttemptCount = z.number().int().positive().parse(input.ownerAttemptCount);
        const canonicalResult = hashCanonicalJson(input.result);
        if (current.state === "accepted") {
          if (
            current.apply_phase === "effects_committed"
            && hashCanonicalJson(objectValue(current.result, "RUNTIME_COMPLETION_RESULT_INVALID")) === canonicalResult
          ) return mapRequest(current);
          throw new Error("RUNTIME_COMPLETION_EFFECTS_COMMIT_TERMINAL_CONFLICT");
        }
        const wallClock = await readDatabaseWallClock(
          transaction,
          "RUNTIME_COMPLETION_DATABASE_WALL_CLOCK_UNAVAILABLE",
        );
        const exactOwner = current.state === "processing"
          && current.owner_instance_id === input.ownerInstanceId
          && current.owner_attempt_count === ownerAttemptCount
          && current.lease_expires_at !== null
          && new Date(current.lease_expires_at).getTime() > wallClock.getTime();
        if (
          exactOwner
          && current.apply_phase === "effects_committed"
        ) {
          if (hashCanonicalJson(objectValue(current.result, "RUNTIME_COMPLETION_RESULT_INVALID")) !== canonicalResult) {
            throw new Error("RUNTIME_COMPLETION_EFFECTS_COMMIT_RESULT_CONFLICT");
          }
          return mapRequest(current);
        }
        if (
          !exactOwner
          || current.apply_phase !== "owner_committed"
        ) throw new Error("RUNTIME_COMPLETION_EFFECTS_COMMIT_OWNER_MISMATCH");
        const effectCounts = await transaction.unsafe<Array<{ total: number; unsettled: number }>>(
          `SELECT COUNT(*) FILTER (WHERE mandatory)::integer AS total,
                  COUNT(*) FILTER (
                    WHERE mandatory AND state NOT IN ('applied', 'reconciled')
                  )::integer AS unsettled
             FROM runtime_completion_effects
            WHERE request_id = $1`,
          [current.request_id],
        );
        if ((effectCounts[0]?.total ?? 0) === 0) {
          throw new Error("RUNTIME_COMPLETION_MANDATORY_EFFECT_MANIFEST_MISSING");
        }
        if ((effectCounts[0]?.unsettled ?? 0) > 0) {
          throw new Error(`RUNTIME_COMPLETION_MANDATORY_EFFECTS_PENDING:${effectCounts[0]!.unsettled}`);
        }
        const rows = await transaction.unsafe<RuntimeCompletionRow[]>(
          `UPDATE runtime_completion_requests
              SET apply_phase = 'effects_committed', effects_committed_at = $3,
                  result = $4::text::jsonb, updated_at = $3
            WHERE request_id = $1 AND owner_instance_id = $2
              AND owner_attempt_count = $5
              AND lease_expires_at > $3
              AND state = 'processing' AND apply_phase = 'owner_committed'
            RETURNING *`,
          [
            current.request_id,
            input.ownerInstanceId,
            wallClock,
            JSON.stringify(input.result),
            ownerAttemptCount,
          ],
        );
        if (rows.length !== 1) throw new Error("RUNTIME_COMPLETION_EFFECTS_COMMIT_CAS_LOST");
        return mapRequest(rows[0]!);
      }) as Promise<RuntimeCompletionRequest>;
    },
    async acceptAndRelease(input: Readonly<{
      requestId: string;
      ownerInstanceId: string;
      ownerAttemptCount: number;
      result: Record<string, unknown>;
      now?: Date;
    }>): Promise<RuntimeCompletionRequest> {
      if (input.now) validTime(input.now);
      return sql.begin(async (transaction) => {
        const chain = await lockRuntimeCompletionChainInTransaction(transaction, input.requestId);
        const request = chain?.request;
        if (!request) throw new Error("RUNTIME_COMPLETION_REQUEST_NOT_FOUND");
        const ownerAttemptCount = z.number().int().positive().parse(input.ownerAttemptCount);
        const canonicalResult = hashCanonicalJson(input.result);
        if (request.state === "accepted") {
          if (hashCanonicalJson(objectValue(request.result, "RUNTIME_COMPLETION_RESULT_INVALID")) === canonicalResult) {
            return mapRequest(request);
          }
          throw new Error("RUNTIME_COMPLETION_ACCEPT_TERMINAL_CONFLICT");
        }
        const wallClock = await readDatabaseWallClock(
          transaction,
          "RUNTIME_COMPLETION_DATABASE_WALL_CLOCK_UNAVAILABLE",
        );
        if (
          request.state !== "processing"
          || request.owner_instance_id !== input.ownerInstanceId
          || request.owner_attempt_count !== ownerAttemptCount
          || !request.lease_expires_at
          || new Date(request.lease_expires_at).getTime() <= wallClock.getTime()
        ) {
          throw new Error("RUNTIME_COMPLETION_PROCESSING_OWNER_MISMATCH");
        }
        if (chain.claimOutcome === null) throw new Error("RUNTIME_COMPLETION_CLAIM_REMAINED_ACTIVE");
        if (request.apply_phase !== "effects_committed" || request.effects_committed_at === null) {
          throw new Error("RUNTIME_COMPLETION_EFFECTS_NOT_COMMITTED");
        }
        await releaseDrainedRuntimeSessionInTransaction(transaction, {
          sessionId: request.runtime_session_id,
          claimId: claimId(request.claim_id),
          now: wallClock,
        });
        const updated = await transaction.unsafe<RuntimeCompletionRow[]>(
          `UPDATE runtime_completion_requests
              SET state = 'accepted', accepted_at = $3,
                  lease_expires_at = NULL,
                  result = $4::text::jsonb,
                  diagnostic = 'Completion accepted after proven runtime drain',
                  updated_at = $3
            WHERE request_id = $1 AND owner_instance_id = $2 AND state = 'processing'
              AND owner_attempt_count = $5
              AND lease_expires_at > $3
            RETURNING *`,
          [
            request.request_id,
            input.ownerInstanceId,
            wallClock,
            JSON.stringify(input.result),
            ownerAttemptCount,
          ],
        );
        if (updated.length !== 1) throw new Error("RUNTIME_COMPLETION_ACCEPT_CAS_LOST");
        return mapRequest(updated[0]!);
      }) as Promise<RuntimeCompletionRequest>;
    },
    async preemptForRunTermination(input: Readonly<{
      requestId: string;
      diagnostic: string;
      result?: Record<string, unknown>;
      now?: Date;
    }>): Promise<Readonly<{
      status: "preempted" | "resume_effects" | "finalize" | "not_pending" | "not_preemptible";
      request: RuntimeCompletionRequest;
    }>> {
      if (!input.diagnostic.trim()) throw new Error("RUNTIME_COMPLETION_REJECTION_DIAGNOSTIC_REQUIRED");
      if (input.now) validTime(input.now);
      return sql.begin(async (transaction) => {
        const chain = await lockRuntimeCompletionChainInTransaction(transaction, input.requestId);
        const current = chain?.request;
        if (!current) throw new Error("RUNTIME_COMPLETION_REQUEST_NOT_FOUND");
        if (current.state === "rejected") {
          return { status: "preempted" as const, request: mapRequest(current) };
        }
        if (current.state === "processing" && current.apply_phase === "owner_committed") {
          return { status: "resume_effects" as const, request: mapRequest(current) };
        }
        if (current.state === "processing" && current.apply_phase === "effects_committed") {
          return { status: "finalize" as const, request: mapRequest(current) };
        }
        if (!chain.terminationRequestId) {
          return { status: "not_pending" as const, request: mapRequest(current) };
        }
        const preemptible = current.state === "requested"
          || current.state === "draining"
          || (
            current.state === "processing"
            && current.apply_phase === "executing"
            && chain.claimOutcome === null
          );
        if (!preemptible) {
          return { status: "not_preemptible" as const, request: mapRequest(current) };
        }
        const wallClock = await readDatabaseWallClock(
          transaction,
          "RUNTIME_COMPLETION_DATABASE_WALL_CLOCK_UNAVAILABLE",
        );
        const rows = await transaction.unsafe<RuntimeCompletionRow[]>(
          `UPDATE runtime_completion_requests
              SET state = 'rejected', rejected_at = $2,
                  lease_expires_at = NULL, diagnostic = $3,
                  result = (result || $4::text::jsonb), updated_at = $2
            WHERE request_id = $1
              AND state = $5
              AND apply_phase = $6
            RETURNING *`,
          [
            current.request_id,
            wallClock,
            input.diagnostic.slice(0, 4_000),
            JSON.stringify({
              ...(input.result ?? {}),
              preemptedByRunTermination: true,
              terminationRequestId: chain.terminationRequestId,
            }),
            current.state,
            current.apply_phase,
          ],
        );
        if (rows.length !== 1) throw new Error("RUNTIME_COMPLETION_REJECT_CAS_LOST");
        return { status: "preempted" as const, request: mapRequest(rows[0]!) };
      }) as Promise<Readonly<{
        status: "preempted" | "resume_effects" | "finalize" | "not_pending" | "not_preemptible";
        request: RuntimeCompletionRequest;
      }>>;
    },
    async quarantine(input: Readonly<{
      requestId: string;
      ownerInstanceId: string;
      expectedState: "draining" | "processing";
      expectedLeaseExpiresAt: string;
      expectedUpdatedAt: string;
      diagnostic: string;
      result?: Record<string, unknown>;
      now?: Date;
    }>): Promise<RuntimeCompletionRequest> {
      if (!input.diagnostic.trim()) throw new Error("RUNTIME_COMPLETION_QUARANTINE_DIAGNOSTIC_REQUIRED");
      if (!input.ownerInstanceId.trim()) throw new Error("RUNTIME_COMPLETION_QUARANTINE_OWNER_REQUIRED");
      if (input.now) validTime(input.now);
      const expectedLeaseExpiresAt = exactTimestamp(
        input.expectedLeaseExpiresAt,
        "RUNTIME_COMPLETION_QUARANTINE_LEASE_INVALID",
      );
      const expectedUpdatedAt = exactTimestamp(
        input.expectedUpdatedAt,
        "RUNTIME_COMPLETION_QUARANTINE_VERSION_INVALID",
      );
      return sql.begin(async (transaction) => {
        const chain = await lockRuntimeCompletionChainInTransaction(transaction, input.requestId);
        const current = chain?.request;
        if (!current) throw new Error("RUNTIME_COMPLETION_REQUEST_NOT_FOUND");
        if (current.state === "quarantined") return mapRequest(current);
        const wallClock = await readDatabaseWallClock(
          transaction,
          "RUNTIME_COMPLETION_DATABASE_WALL_CLOCK_UNAVAILABLE",
        );
        if (
          current.owner_instance_id !== input.ownerInstanceId
          || current.state !== input.expectedState
          || !current.lease_expires_at
          || new Date(current.lease_expires_at).getTime() !== expectedLeaseExpiresAt.getTime()
          || new Date(current.lease_expires_at).getTime() <= wallClock.getTime()
          || new Date(current.updated_at).getTime() !== expectedUpdatedAt.getTime()
        ) throw new Error("RUNTIME_COMPLETION_QUARANTINE_AUTHORITY_LOST");
        if (
          current.state === "processing"
          && current.apply_phase !== "executing"
        ) throw new Error("RUNTIME_COMPLETION_QUARANTINE_CANONICAL_CONTINUATION_REQUIRED");
        const rows = await transaction.unsafe<RuntimeCompletionRow[]>(
          `UPDATE runtime_completion_requests
              SET state = 'quarantined', lease_expires_at = NULL,
                  diagnostic = $2, result = (result || $3::text::jsonb), updated_at = $4
            WHERE request_id = $1
              AND owner_instance_id = $5
              AND state = $6
              AND (state = 'draining' OR apply_phase = 'executing')
              AND lease_expires_at = $7
              AND lease_expires_at > $4
              AND updated_at = $8
            RETURNING *`,
          [
            current.request_id,
            input.diagnostic.slice(0, 4_000),
            JSON.stringify(input.result ?? {}),
            wallClock,
            input.ownerInstanceId,
            input.expectedState,
            expectedLeaseExpiresAt,
            expectedUpdatedAt,
          ],
        );
        if (rows.length !== 1) throw new Error("RUNTIME_COMPLETION_QUARANTINE_AUTHORITY_LOST");
        return mapRequest(rows[0]!);
      }) as Promise<RuntimeCompletionRequest>;
    },
  });
}

/** Canonical run terminalization rejects any completion proposal it preempted. */
export async function rejectRuntimeCompletionsForTerminalRunInTransaction(
  sql: TransactionSql,
  input: Readonly<{ runId: string; diagnostic: string }>,
): Promise<number> {
  const wallClock = await readDatabaseWallClock(
    sql,
    "RUNTIME_COMPLETION_DATABASE_WALL_CLOCK_UNAVAILABLE",
  );
  const rows = await sql.unsafe<Array<{ request_id: string }>>(
    `UPDATE runtime_completion_requests
        SET state = 'rejected', rejected_at = $2,
            lease_expires_at = NULL, diagnostic = $3, updated_at = $2
      WHERE run_id = $1
        AND state IN ('requested', 'draining')
      RETURNING request_id`,
    [input.runId, wallClock, input.diagnostic.slice(0, 4_000)],
  );
  return rows.length;
}
