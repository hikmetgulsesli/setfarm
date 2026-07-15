import type postgres from "postgres";
import { z } from "zod";

import {
  releaseDrainedRuntimeSessionInTransaction,
  releaseReservedRuntimeSessionInTransaction,
} from "../execution/runtime-session-repository.js";
import { hashCanonicalJson } from "../product-compiler/canonical-json.js";
import { v3RecoveryStoryLockIdentity } from "./v3-recovery-claim-authority.js";

type Sql = postgres.Sql;
type TransactionSql = postgres.TransactionSql;

const BoundedIdentitySchema = z.string().min(1).max(500);
const ActiveDeliveryStateSchema = z.enum([
  "authorized",
  "leased",
  "attempt_reserved",
  "running",
]);

const ReconcileActiveInputSchema = z.object({
  runId: BoundedIdentitySchema.optional(),
  dispatchId: z.string().regex(/^RDISP_[a-f0-9]{64}$/).optional(),
  limit: z.number().int().positive().max(500).default(100),
}).strict();

export const V3RecoveryLifecycleReconciliationEventV1Schema = z.object({
  schema: z.literal("setfarm.v3-recovery-lifecycle-reconciliation-event.v1"),
  action: z.enum([
    "reset_expired_lease",
    "rollback_unreserved_publication",
    "advance_delivery_running",
    "block_expired_evidence_attempt",
    "request_runtime_drain",
    "block_expired_model_attempt",
    "noop",
    "quarantine",
  ]),
  code: z.string().regex(/^V3_RECOVERY_LIFECYCLE_[A-Z0-9_]+$/),
  runId: BoundedIdentitySchema,
  storyId: BoundedIdentitySchema,
  dispatchId: z.string().regex(/^RDISP_[a-f0-9]{64}$/),
  revisionId: z.string().regex(/^RREV_[a-f0-9]{64}$/),
  runtimeSessionId: z.string().regex(/^RTS_[A-Za-z0-9-]{16,160}$/).optional(),
  observedState: ActiveDeliveryStateSchema,
  mutated: z.boolean(),
  observedAt: z.string().datetime({ offset: true }),
  detail: z.string().min(1).max(4_000),
}).strict();

export type V3RecoveryLifecycleReconciliationEventV1 = z.infer<
  typeof V3RecoveryLifecycleReconciliationEventV1Schema
>;

export const V3RecoveryLifecycleReconciliationReportV1Schema = z.object({
  schema: z.literal("setfarm.v3-recovery-lifecycle-reconciliation-report.v1"),
  observedAt: z.string().datetime({ offset: true }),
  counts: z.object({
    scanned: z.number().int().nonnegative(),
    repaired: z.number().int().nonnegative(),
    resetExpiredLeases: z.number().int().nonnegative(),
    rolledBackPublications: z.number().int().nonnegative(),
    advancedRunning: z.number().int().nonnegative(),
    blockedExpiredEvidenceAttempts: z.number().int().nonnegative(),
    requestedRuntimeDrains: z.number().int().nonnegative(),
    blockedExpiredModelAttempts: z.number().int().nonnegative(),
    noops: z.number().int().nonnegative(),
    quarantined: z.number().int().nonnegative(),
  }).strict(),
  events: z.array(V3RecoveryLifecycleReconciliationEventV1Schema).max(500),
}).strict();

export type V3RecoveryLifecycleReconciliationReportV1 = z.infer<
  typeof V3RecoveryLifecycleReconciliationReportV1Schema
>;

type CandidateRow = Readonly<{
  dispatch_id: string;
  revision_id: string;
  run_id: string;
  story_id: string;
  state: string;
  attempt_id: string | null;
  claim_id: string | number | null;
}>;

type DeliveryRow = Readonly<{
  dispatch_id: string;
  recovery_case_id: string;
  revision_id: string;
  run_id: string;
  story_id: string;
  state: string;
  owner_instance_id: string | null;
  lease_token: string | null;
  lease_expires_at: Date | string | null;
  attempt_id: string | null;
  claim_id: string | number | null;
  execution_slice_hash: string | null;
  attempt_count: number;
  diagnostic: string | null;
  started_at: Date | string | null;
  updated_at: Date | string;
}>;

type ChainRow = Readonly<{
  dispatch_class: string;
  recovery_owner: string;
  packet_hash: string;
  contract_slice_hash: string;
  finding_set_hash: string;
  source_sha: string;
  source_tree_hash: string;
  recovery_state_version: number;
}>;

type RuntimeRow = Readonly<{
  session_id: string;
  run_id: string;
  step_db_id: string;
  workflow_step_id: string;
  story_db_id: string | null;
  story_id: string | null;
  claim_id: string | number;
  attempt_id: string | null;
  claim_agent_id: string;
  owner_instance_id: string;
  state: string;
  created_at: Date | string;
  heartbeat_at: Date | string;
}>;

type ClaimRow = Readonly<{
  id: string | number;
  run_id: string;
  step_id: string;
  story_id: string | null;
  agent_id: string;
  claimed_at: Date | string;
  outcome: string | null;
}>;

type AttemptRow = Readonly<{
  attempt_id: string;
  claim_id: string | number | null;
  run_id: string;
  step_id: string;
  story_id: string;
  attempt_class: string;
  packet_hash: string | null;
  slice_hash: string | null;
  source_before_sha: string;
  source_before_tree_hash: string;
  finding_set_hash: string | null;
  recovery_case_revision_id: string | null;
  recovery_dispatch_id: string | null;
  agent_id: string | null;
  disposition: string;
  source_after_sha: string | null;
  source_after_tree_hash: string | null;
  lease_expires_at: Date | string;
  evidence_refs: string;
  output_hash: string | null;
}>;

type StepRow = Readonly<{
  id: string;
  run_id: string;
  step_id: string;
  type: string;
  status: string;
  current_story_id: string | null;
}>;

type StoryRow = Readonly<{
  id: string;
  run_id: string;
  story_id: string;
  status: string;
  claimed_by: string | null;
  claimed_at: Date | string | null;
  claim_generation: number;
}>;

class V3RecoveryLifecycleMutationError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(`${code}:${message}`);
    this.name = "V3RecoveryLifecycleMutationError";
    this.code = code;
  }
}

function mutationFail(code: string, message: string): never {
  throw new V3RecoveryLifecycleMutationError(code, message);
}

function validTime(value?: Date): Date {
  const now = value ? new Date(value) : new Date();
  if (!Number.isFinite(now.getTime())) throw new Error("V3_RECOVERY_LIFECYCLE_TIME_INVALID");
  return now;
}

function millis(value: Date | string | null): number {
  if (value === null) return Number.NaN;
  const result = value instanceof Date ? value.getTime() : Date.parse(value);
  return Number.isFinite(result) ? result : Number.NaN;
}

function claimId(value: string | number | null): number | undefined {
  if (value === null) return undefined;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : undefined;
}

function event(
  candidate: CandidateRow,
  observedState: string,
  now: Date,
  input: Readonly<{
    action: V3RecoveryLifecycleReconciliationEventV1["action"];
    code: string;
    mutated: boolean;
    detail: string;
    runtimeSessionId?: string;
  }>,
): V3RecoveryLifecycleReconciliationEventV1 {
  return V3RecoveryLifecycleReconciliationEventV1Schema.parse({
    schema: "setfarm.v3-recovery-lifecycle-reconciliation-event.v1",
    action: input.action,
    code: input.code,
    runId: candidate.run_id,
    storyId: candidate.story_id,
    dispatchId: candidate.dispatch_id,
    revisionId: candidate.revision_id,
    ...(input.runtimeSessionId ? { runtimeSessionId: input.runtimeSessionId } : {}),
    observedState: ActiveDeliveryStateSchema.parse(observedState),
    mutated: input.mutated,
    observedAt: now.toISOString(),
    detail: input.detail,
  });
}

function quarantine(
  candidate: CandidateRow,
  observedState: string,
  now: Date,
  code: string,
  detail: string,
): V3RecoveryLifecycleReconciliationEventV1 {
  // Quarantine is deliberately a report-only result. Changing an active
  // delivery to a terminal state here would remove the recovery claim fence
  // and could expose the failed story to ordinary work selection.
  return event(candidate, observedState, now, {
    action: "quarantine",
    code,
    mutated: false,
    detail,
  });
}

async function activeSnapshot(
  sql: TransactionSql,
  candidate: CandidateRow,
): Promise<DeliveryRow[]> {
  return sql.unsafe<DeliveryRow[]>(
    `SELECT dispatch_id, recovery_case_id, revision_id, run_id, story_id, state,
            owner_instance_id, lease_token, lease_expires_at, attempt_id, claim_id,
            execution_slice_hash, attempt_count, diagnostic, started_at, updated_at
       FROM recovery_dispatch_deliveries
      WHERE run_id = $1 AND story_id = $2
        AND state IN ('authorized', 'leased', 'attempt_reserved', 'running')
      ORDER BY authorized_at, dispatch_id
      LIMIT 2`,
    [candidate.run_id, candidate.story_id],
  );
}

async function lockActiveDeliveries(
  sql: TransactionSql,
  candidate: CandidateRow,
): Promise<DeliveryRow[]> {
  return sql.unsafe<DeliveryRow[]>(
    `SELECT dispatch_id, recovery_case_id, revision_id, run_id, story_id, state,
            owner_instance_id, lease_token, lease_expires_at, attempt_id, claim_id,
            execution_slice_hash, attempt_count, diagnostic, started_at, updated_at
       FROM recovery_dispatch_deliveries
      WHERE run_id = $1 AND story_id = $2
        AND state IN ('authorized', 'leased', 'attempt_reserved', 'running')
      ORDER BY authorized_at, dispatch_id
      LIMIT 2
      FOR UPDATE`,
    [candidate.run_id, candidate.story_id],
  );
}

async function loadExactChain(
  sql: TransactionSql,
  delivery: DeliveryRow,
): Promise<ChainRow | undefined> {
  const rows = await sql.unsafe<ChainRow[]>(
    `SELECT dispatch.dispatch_class,
            revision.owner AS recovery_owner,
            revision.packet_hash,
            revision.contract_slice_hash,
            revision.finding_set_hash,
            revision.source_sha,
            revision.source_tree_hash,
            recovery_case.state_version AS recovery_state_version
       FROM recovery_dispatch_deliveries delivery
       JOIN recovery_revision_dispatches dispatch
         ON dispatch.dispatch_id = delivery.dispatch_id
        AND dispatch.revision_id = delivery.revision_id
       JOIN recovery_case_revisions revision
         ON revision.revision_id = delivery.revision_id
        AND revision.recovery_case_id = delivery.recovery_case_id
       JOIN recovery_cases recovery_case
         ON recovery_case.recovery_case_id = delivery.recovery_case_id
       JOIN finding_sets finding_set
         ON finding_set.finding_set_hash = revision.finding_set_hash
       JOIN runs run_row
         ON run_row.id = delivery.run_id
      WHERE delivery.dispatch_id = $1
        AND delivery.recovery_case_id = $2
        AND delivery.revision_id = $3
        AND delivery.run_id = $4
        AND delivery.story_id = $5
        AND run_row.protocol = 'v3'
        AND run_row.status IN ('running', 'resuming')
        AND recovery_case.status IN ('open', 'repairing', 'evidencing')
        AND recovery_case.current_revision_id = revision.revision_id
        AND revision.run_id = delivery.run_id
        AND revision.story_id = delivery.story_id
        AND recovery_case.run_id = delivery.run_id
        AND recovery_case.story_id = delivery.story_id
        AND recovery_case.finding_set_hash = revision.finding_set_hash
        AND recovery_case.packet_hash = revision.packet_hash
        AND recovery_case.slice_hash = revision.contract_slice_hash
        AND recovery_case.source_sha = revision.source_sha
        AND recovery_case.source_tree_hash = revision.source_tree_hash
        AND recovery_case.owner = revision.owner
        AND recovery_case.finding_ids = revision.finding_ids
        AND recovery_case.expected_delta = revision.expected_delta
        AND recovery_case.allowed_paths = revision.allowed_paths
        AND recovery_case.evidence_plan = revision.evidence_plan
        AND dispatch.recovery_case_id = recovery_case.recovery_case_id
        AND dispatch.revision_id = revision.revision_id
        AND dispatch.packet_hash = revision.packet_hash
        AND dispatch.contract_slice_hash = revision.contract_slice_hash
        AND dispatch.finding_set_hash = revision.finding_set_hash
        AND dispatch.source_sha = revision.source_sha
        AND dispatch.source_tree_hash = revision.source_tree_hash
        AND dispatch.finding_ids = revision.finding_ids
        AND dispatch.evidence_plan = revision.evidence_plan
        AND dispatch.evidence_plan_artifact_hash IS NOT DISTINCT FROM revision.evidence_plan_artifact_hash
        AND delivery.authorized_at = dispatch.authorized_at
        AND finding_set.run_id = revision.run_id
        AND finding_set.story_id = revision.story_id
        AND finding_set.packet_hash = revision.packet_hash
        AND finding_set.slice_hash = revision.contract_slice_hash
        AND finding_set.source_sha = revision.source_sha
        AND finding_set.source_tree_hash = revision.source_tree_hash
        AND finding_set.finding_ids = revision.finding_ids
        AND run_row.packet_hash = revision.packet_hash
        AND (
          (dispatch.dispatch_class = 'product_implementation' AND revision.owner = 'implement')
          OR (dispatch.dispatch_class = 'supervisor_repair' AND revision.owner = 'supervisor')
          OR (dispatch.dispatch_class = 'evidence_only' AND revision.owner IN ('supervisor', 'infrastructure'))
        )
      FOR UPDATE OF recovery_case`,
    [
      delivery.dispatch_id,
      delivery.recovery_case_id,
      delivery.revision_id,
      delivery.run_id,
      delivery.story_id,
    ],
  );
  return rows.length === 1 ? rows[0] : undefined;
}

async function lockRuntimes(
  sql: TransactionSql,
  candidate: CandidateRow,
): Promise<RuntimeRow[]> {
  return sql.unsafe<RuntimeRow[]>(
    `SELECT session_id, run_id, step_db_id, workflow_step_id, story_db_id,
            story_id, claim_id, attempt_id, claim_agent_id, owner_instance_id,
            state, created_at, heartbeat_at
      FROM runtime_sessions
      WHERE run_id = $1
        AND story_id = $2
        AND state <> 'released'
      ORDER BY created_at, session_id
      LIMIT 3
      FOR UPDATE`,
    [candidate.run_id, candidate.story_id],
  );
}

async function lockOpenClaims(
  sql: TransactionSql,
  candidate: CandidateRow,
): Promise<ClaimRow[]> {
  return sql.unsafe<ClaimRow[]>(
    `SELECT id::text, run_id, step_id, story_id, agent_id, claimed_at, outcome
      FROM claim_log
      WHERE run_id = $1
        AND story_id = $2
        AND outcome IS NULL
      ORDER BY id
      LIMIT 3
      FOR UPDATE`,
    [candidate.run_id, candidate.story_id],
  );
}

async function lockBoundClaim(
  sql: TransactionSql,
  candidate: CandidateRow,
  delivery: DeliveryRow,
): Promise<ClaimRow | undefined> {
  const exactClaimId = claimId(delivery.claim_id);
  if (!exactClaimId) return undefined;
  const rows = await sql.unsafe<ClaimRow[]>(
    `SELECT id::text, run_id, step_id, story_id, agent_id, claimed_at, outcome
       FROM claim_log
      WHERE id = $1
        AND run_id = $2
        AND step_id = 'implement'
        AND story_id = $3
      FOR UPDATE`,
    [exactClaimId, candidate.run_id, candidate.story_id],
  );
  return rows.length === 1 ? rows[0] : undefined;
}

async function lockRelevantAttempts(
  sql: TransactionSql,
  candidate: CandidateRow,
): Promise<AttemptRow[]> {
  return sql.unsafe<AttemptRow[]>(
    `SELECT attempt_id, claim_id, run_id, step_id, story_id, attempt_class,
            packet_hash, slice_hash, source_before_sha, source_before_tree_hash,
            finding_set_hash, recovery_case_revision_id, recovery_dispatch_id,
            agent_id, disposition, source_after_sha, source_after_tree_hash,
            lease_expires_at, evidence_refs, output_hash
       FROM execution_attempts
      WHERE recovery_dispatch_id = $1
         OR (
           run_id = $2
           AND story_id = $3
           AND disposition IN ('claimed', 'running')
         )
      ORDER BY attempt_id
      LIMIT 3
      FOR UPDATE`,
    [candidate.dispatch_id, candidate.run_id, candidate.story_id],
  );
}

async function lockSteps(
  sql: TransactionSql,
  candidate: CandidateRow,
): Promise<StepRow[]> {
  return sql.unsafe<StepRow[]>(
    `SELECT id, run_id, step_id, type, status, current_story_id
       FROM steps
      WHERE run_id = $1 AND step_id = 'implement'
      ORDER BY id
      LIMIT 3
      FOR UPDATE`,
    [candidate.run_id],
  );
}

async function lockStories(
  sql: TransactionSql,
  candidate: CandidateRow,
): Promise<StoryRow[]> {
  return sql.unsafe<StoryRow[]>(
    `SELECT id, run_id, story_id, status, claimed_by, claimed_at, claim_generation
       FROM stories
      WHERE run_id = $1 AND story_id = $2
      ORDER BY id
      LIMIT 3
      FOR UPDATE`,
    [candidate.run_id, candidate.story_id],
  );
}

async function hasRuntimeCompletion(
  sql: TransactionSql,
  runtimes: readonly RuntimeRow[],
): Promise<boolean> {
  if (runtimes.length === 0) return false;
  const rows = await sql.unsafe<Array<{ request_id: string }>>(
    `SELECT request_id
       FROM runtime_completion_requests
      WHERE runtime_session_id = ANY($1::text[])
      ORDER BY request_id
      LIMIT 1
      FOR UPDATE`,
    [runtimes.map((runtime) => runtime.session_id)],
  );
  return rows.length > 0;
}

function exactStepAndStory(
  candidate: CandidateRow,
  steps: readonly StepRow[],
  stories: readonly StoryRow[],
): Readonly<{ step: StepRow; story: StoryRow }> | undefined {
  if (steps.length !== 1 || stories.length !== 1) return undefined;
  const step = steps[0]!;
  const story = stories[0]!;
  if (
    step.run_id !== candidate.run_id
    || step.step_id !== "implement"
    || step.type !== "loop"
    || story.run_id !== candidate.run_id
    || story.story_id !== candidate.story_id
  ) return undefined;
  return { step, story };
}

function exactPublicationOwner(input: Readonly<{
  candidate: CandidateRow;
  delivery: DeliveryRow;
  runtime: RuntimeRow;
  claim: ClaimRow;
  step: StepRow;
  story: StoryRow;
}>): boolean {
  const expectedClaimId = claimId(input.runtime.claim_id);
  const actualClaimId = claimId(input.claim.id);
  return expectedClaimId !== undefined
    && expectedClaimId === actualClaimId
    && input.delivery.owner_instance_id !== null
    && input.runtime.owner_instance_id === input.delivery.owner_instance_id
    && input.runtime.run_id === input.candidate.run_id
    && input.runtime.step_db_id === input.step.id
    && input.runtime.workflow_step_id === "implement"
    && input.runtime.story_db_id === input.story.id
    && input.runtime.story_id === input.candidate.story_id
    && input.runtime.attempt_id === null
    && input.runtime.claim_agent_id === input.claim.agent_id
    && input.claim.run_id === input.candidate.run_id
    && input.claim.step_id === "implement"
    && input.claim.story_id === input.candidate.story_id
    && input.claim.outcome === null
    && input.story.status === "running"
    && input.story.claimed_by === input.claim.agent_id
    && input.story.claimed_at !== null
    && millis(input.story.claimed_at) === millis(input.claim.claimed_at)
    && millis(input.runtime.created_at) === millis(input.claim.claimed_at)
    && millis(input.runtime.heartbeat_at) === millis(input.claim.claimed_at)
    && millis(input.claim.claimed_at) >= millis(input.delivery.updated_at)
    && millis(input.claim.claimed_at) <= millis(input.delivery.lease_expires_at)
    && input.story.claim_generation > 0
    && input.step.status === "running"
    && input.step.current_story_id === input.story.id;
}

function exactAttemptOwner(input: Readonly<{
  candidate: CandidateRow;
  delivery: DeliveryRow;
  chain: ChainRow;
  runtime: RuntimeRow;
  claim: ClaimRow;
  attempt: AttemptRow;
  step: StepRow;
  story: StoryRow;
}>): boolean {
  const deliveryClaimId = claimId(input.delivery.claim_id);
  const runtimeClaimId = claimId(input.runtime.claim_id);
  const claimRowId = claimId(input.claim.id);
  const attemptClaimId = claimId(input.attempt.claim_id);
  return deliveryClaimId !== undefined
    && deliveryClaimId === runtimeClaimId
    && deliveryClaimId === claimRowId
    && deliveryClaimId === attemptClaimId
    && input.delivery.attempt_id !== null
    && input.delivery.execution_slice_hash !== null
    && input.runtime.session_id.length > 0
    && input.runtime.run_id === input.candidate.run_id
    && input.runtime.step_db_id === input.step.id
    && input.runtime.workflow_step_id === "implement"
    && input.runtime.story_db_id === input.story.id
    && input.runtime.story_id === input.candidate.story_id
    && input.runtime.attempt_id === input.delivery.attempt_id
    && input.runtime.owner_instance_id === input.delivery.owner_instance_id
    && input.runtime.claim_agent_id === input.claim.agent_id
    && millis(input.runtime.created_at) === millis(input.claim.claimed_at)
    && input.claim.run_id === input.candidate.run_id
    && input.claim.step_id === "implement"
    && input.claim.story_id === input.candidate.story_id
    && input.claim.outcome === null
    && input.attempt.attempt_id === input.delivery.attempt_id
    && input.attempt.run_id === input.candidate.run_id
    && input.attempt.step_id === "implement"
    && input.attempt.story_id === input.candidate.story_id
    && input.attempt.attempt_class === input.chain.dispatch_class
    && input.attempt.packet_hash === input.chain.packet_hash
    && input.attempt.slice_hash === input.delivery.execution_slice_hash
    && input.attempt.finding_set_hash === input.chain.finding_set_hash
    && input.attempt.recovery_case_revision_id === input.delivery.revision_id
    && input.attempt.recovery_dispatch_id === input.delivery.dispatch_id
    && input.attempt.source_before_sha === input.chain.source_sha
    && input.attempt.source_before_tree_hash === input.chain.source_tree_hash
    && ["claimed", "running"].includes(input.attempt.disposition)
    && (input.attempt.agent_id === null || input.attempt.agent_id === input.claim.agent_id)
    && input.delivery.attempt_count === 1
    && input.delivery.started_at !== null
    && millis(input.claim.claimed_at) <= millis(input.delivery.started_at)
    && millis(input.delivery.started_at) <= millis(input.delivery.lease_expires_at)
    && input.story.status === "running"
    && input.story.claimed_by === input.claim.agent_id
    && input.story.claimed_at !== null
    && millis(input.story.claimed_at) === millis(input.claim.claimed_at)
    && input.step.status === "running"
    && input.step.current_story_id === input.story.id;
}

function exactEvidenceOnlyAttemptOwner(input: Readonly<{
  candidate: CandidateRow;
  delivery: DeliveryRow;
  chain: ChainRow;
  claim: ClaimRow;
  attempt: AttemptRow;
  step: StepRow;
  story: StoryRow;
}>): boolean {
  const deliveryClaimId = claimId(input.delivery.claim_id);
  const claimRowId = claimId(input.claim.id);
  const attemptClaimId = claimId(input.attempt.claim_id);
  return deliveryClaimId !== undefined
    && deliveryClaimId === claimRowId
    && deliveryClaimId === attemptClaimId
    && input.delivery.owner_instance_id !== null
    && input.delivery.lease_token !== null
    && input.delivery.attempt_id === input.attempt.attempt_id
    && input.delivery.execution_slice_hash === input.attempt.slice_hash
    && input.delivery.attempt_count === 1
    && input.delivery.started_at !== null
    && input.chain.dispatch_class === "evidence_only"
    && input.chain.recovery_owner === "infrastructure"
    && input.claim.run_id === input.candidate.run_id
    && input.claim.step_id === "implement"
    && input.claim.story_id === input.candidate.story_id
    && input.attempt.run_id === input.candidate.run_id
    && input.attempt.step_id === "implement"
    && input.attempt.story_id === input.candidate.story_id
    && input.attempt.attempt_class === "evidence_only"
    && input.attempt.packet_hash === input.chain.packet_hash
    && input.attempt.slice_hash === input.chain.contract_slice_hash
    && input.attempt.finding_set_hash === input.chain.finding_set_hash
    && input.attempt.recovery_case_revision_id === input.delivery.revision_id
    && input.attempt.recovery_dispatch_id === input.delivery.dispatch_id
    && input.attempt.source_before_sha === input.chain.source_sha
    && input.attempt.source_before_tree_hash === input.chain.source_tree_hash
    && input.attempt.agent_id !== null
    && input.attempt.agent_id === input.claim.agent_id
    && input.story.status === "failed"
    && input.story.claimed_by === null
    && input.story.claimed_at === null
    && input.step.type === "loop"
    && ["pending", "running"].includes(input.step.status)
    && input.step.current_story_id !== input.story.id;
}

function hasExactTerminalEvidence(attempt: AttemptRow, chain: ChainRow): boolean {
  if (
    !attempt.source_after_sha
    || !attempt.source_after_tree_hash
    || attempt.source_after_sha !== chain.source_sha
    || attempt.source_after_tree_hash !== chain.source_tree_hash
    || !attempt.output_hash
  ) return false;
  try {
    const refs = z.array(z.string()).parse(JSON.parse(attempt.evidence_refs));
    const bundles = refs.flatMap((ref) => {
      const match = ref.match(/^setfarm:\/\/evidence-bundle\/([a-f0-9]{64})$/);
      return match?.[1] ? [match[1]] : [];
    });
    return bundles.length === 1 && bundles[0] === attempt.output_hash;
  } catch {
    return false;
  }
}

async function resetExpiredLease(
  sql: TransactionSql,
  delivery: DeliveryRow,
  now: Date,
): Promise<void> {
  const rows = await sql.unsafe<Array<{ dispatch_id: string }>>(
    `UPDATE recovery_dispatch_deliveries
        SET state = 'authorized',
            owner_instance_id = NULL,
            lease_token = NULL,
            lease_expires_at = NULL,
            updated_at = $12
      WHERE dispatch_id = $1
        AND recovery_case_id = $2
        AND revision_id = $3
        AND run_id = $4
        AND story_id = $5
        AND state = 'leased'
        AND owner_instance_id = $6
        AND lease_token = $7
        AND lease_expires_at = $8
        AND lease_expires_at <= $12
        AND attempt_id IS NULL
        AND claim_id IS NULL
        AND execution_slice_hash IS NULL
        AND attempt_count = $9
        AND started_at IS NOT DISTINCT FROM $10::timestamptz
        AND updated_at = $11
      RETURNING dispatch_id`,
    [
      delivery.dispatch_id,
      delivery.recovery_case_id,
      delivery.revision_id,
      delivery.run_id,
      delivery.story_id,
      delivery.owner_instance_id,
      delivery.lease_token,
      delivery.lease_expires_at,
      delivery.attempt_count,
      delivery.started_at,
      delivery.updated_at,
      now,
    ],
  );
  if (rows.length !== 1) {
    mutationFail("V3_RECOVERY_LIFECYCLE_RESET_CAS_LOST", "expired lease changed before exact reset");
  }
}

async function rollbackUnreservedPublication(
  sql: TransactionSql,
  input: Readonly<{
    delivery: DeliveryRow;
    runtime: RuntimeRow;
    claim: ClaimRow;
    step: StepRow;
    story: StoryRow;
    now: Date;
  }>,
): Promise<void> {
  const exactClaimId = claimId(input.claim.id);
  if (!exactClaimId) mutationFail("V3_RECOVERY_LIFECYCLE_CLAIM_ID_INVALID", "publication claim id is invalid");
  const diagnostic = "V3 recovery publication expired before attempt reservation; exact no-spawn owner rolled back";
  const closed = await sql.unsafe<Array<{ id: string }>>(
    `UPDATE claim_log
        SET outcome = 'infra_retry',
            abandoned_at = COALESCE(abandoned_at, $7),
            duration_ms = LEAST(
              CAST(EXTRACT(EPOCH FROM ($7::timestamptz - claimed_at::timestamptz)) * 1000 AS BIGINT),
              2147483647
            )::INTEGER,
            diagnostic = $8
      WHERE id = $1
        AND run_id = $2
        AND step_id = $3
        AND story_id = $4
        AND agent_id = $5
        AND claimed_at = $6
        AND outcome IS NULL
      RETURNING id::text`,
    [
      exactClaimId,
      input.claim.run_id,
      input.claim.step_id,
      input.claim.story_id,
      input.claim.agent_id,
      input.claim.claimed_at,
      input.now,
      diagnostic,
    ],
  );
  if (closed.length !== 1) {
    mutationFail("V3_RECOVERY_LIFECYCLE_CLAIM_CAS_LOST", "open publication claim changed before exact close");
  }

  try {
    await releaseReservedRuntimeSessionInTransaction(sql, {
      sessionId: input.runtime.session_id,
      claimId: exactClaimId,
      ownerInstanceId: input.runtime.owner_instance_id,
      diagnostic,
      now: input.now,
    });
  } catch (error) {
    mutationFail(
      "V3_RECOVERY_LIFECYCLE_RUNTIME_RELEASE_REJECTED",
      error instanceof Error ? error.message : String(error),
    );
  }

  const stories = await sql.unsafe<Array<{ id: string }>>(
    `UPDATE stories
        SET status = 'failed',
            claimed_by = NULL,
            claimed_at = NULL,
            updated_at = $7
      WHERE id = $1
        AND run_id = $2
        AND story_id = $3
        AND status = 'running'
        AND claimed_by = $4
        AND claimed_at = $5
        AND claim_generation = $6
      RETURNING id`,
    [
      input.story.id,
      input.story.run_id,
      input.story.story_id,
      input.story.claimed_by,
      input.story.claimed_at,
      input.story.claim_generation,
      input.now,
    ],
  );
  if (stories.length !== 1) {
    mutationFail("V3_RECOVERY_LIFECYCLE_STORY_CAS_LOST", "published story changed before exact rollback");
  }

  // Publication does not durably record whether the loop step was pending or
  // running before it claimed the failed story. Keep the proven running state;
  // only clear the exact story pointer instead of inventing a pending state.
  const steps = await sql.unsafe<Array<{ id: string }>>(
    `UPDATE steps
        SET current_story_id = NULL,
            updated_at = $4
      WHERE id = $1
        AND run_id = $2
        AND step_id = 'implement'
        AND type = 'loop'
        AND status = 'running'
        AND current_story_id = $3
      RETURNING id`,
    [input.step.id, input.step.run_id, input.story.id, input.now],
  );
  if (steps.length !== 1) {
    mutationFail("V3_RECOVERY_LIFECYCLE_STEP_CAS_LOST", "loop step changed before exact pointer clear");
  }

  await resetExpiredLease(sql, input.delivery, input.now);
}

async function advanceDeliveryRunning(
  sql: TransactionSql,
  delivery: DeliveryRow,
  now: Date,
): Promise<void> {
  const rows = await sql.unsafe<Array<{ dispatch_id: string }>>(
    `UPDATE recovery_dispatch_deliveries
        SET state = 'running', updated_at = $13
      WHERE dispatch_id = $1
        AND recovery_case_id = $2
        AND revision_id = $3
        AND run_id = $4
        AND story_id = $5
        AND state = 'attempt_reserved'
        AND owner_instance_id = $6
        AND lease_token = $7
        AND lease_expires_at = $8
        AND attempt_id = $9
        AND claim_id = $10
        AND execution_slice_hash = $11
        AND updated_at = $12
      RETURNING dispatch_id`,
    [
      delivery.dispatch_id,
      delivery.recovery_case_id,
      delivery.revision_id,
      delivery.run_id,
      delivery.story_id,
      delivery.owner_instance_id,
      delivery.lease_token,
      delivery.lease_expires_at,
      delivery.attempt_id,
      delivery.claim_id,
      delivery.execution_slice_hash,
      delivery.updated_at,
      now,
    ],
  );
  if (rows.length !== 1) {
    mutationFail("V3_RECOVERY_LIFECYCLE_RUNNING_CAS_LOST", "attempt-bound delivery changed before running advance");
  }
}

async function blockExpiredEvidenceAttempt(
  sql: TransactionSql,
  input: Readonly<{
    delivery: DeliveryRow;
    chain: ChainRow;
    claim: ClaimRow;
    attempt: AttemptRow;
    now: Date;
  }>,
): Promise<void> {
  if (
    Math.min(millis(input.delivery.lease_expires_at), millis(input.attempt.lease_expires_at))
      > input.now.getTime()
  ) {
    mutationFail("V3_RECOVERY_LIFECYCLE_EVIDENCE_OWNER_LIVE", "evidence owner still has both bounded leases");
  }
  const exactClaimId = claimId(input.claim.id);
  if (!exactClaimId) mutationFail("V3_RECOVERY_LIFECYCLE_EVIDENCE_CLAIM_INVALID", "evidence claim id is invalid");
  const diagnostic = "V3 evidence-only owner expired before terminal evidence publication; bounded lifecycle recovery blocked the case";
  const decisionRef = hashCanonicalJson({
    schema: "setfarm.v3-evidence-only-expired-owner-decision.v1",
    dispatchId: input.delivery.dispatch_id,
    revisionId: input.delivery.revision_id,
    attemptId: input.attempt.attempt_id,
    sourceRevision: {
      sha: input.chain.source_sha,
      treeHash: input.chain.source_tree_hash,
    },
  });
  const attempts = await sql.unsafe<Array<{ attempt_id: string }>>(
    `UPDATE execution_attempts
        SET disposition = 'inconclusive',
            heartbeat_at = $5,
            updated_at = $5
      WHERE attempt_id = $1
        AND claim_id = $2
        AND recovery_dispatch_id = $3
        AND recovery_case_revision_id = $4
        AND disposition IN ('claimed', 'running')
      RETURNING attempt_id`,
    [
      input.attempt.attempt_id,
      exactClaimId,
      input.delivery.dispatch_id,
      input.delivery.revision_id,
      input.now,
    ],
  );
  if (attempts.length !== 1) {
    mutationFail("V3_RECOVERY_LIFECYCLE_EVIDENCE_ATTEMPT_CAS_LOST", "expired evidence attempt changed before bounded terminalization");
  }
  const claims = await sql.unsafe<Array<{ id: string }>>(
    `UPDATE claim_log
        SET outcome = 'infra_retry',
            abandoned_at = COALESCE(abandoned_at, $6),
            duration_ms = LEAST(
              CAST(EXTRACT(EPOCH FROM ($6::timestamptz - claimed_at::timestamptz)) * 1000 AS BIGINT),
              2147483647
            )::INTEGER,
            diagnostic = $7
      WHERE id = $1
        AND run_id = $2
        AND step_id = 'implement'
        AND story_id = $3
        AND agent_id = $4
        AND claimed_at = $5
        AND outcome IS NULL
      RETURNING id::text`,
    [
      exactClaimId,
      input.claim.run_id,
      input.claim.story_id,
      input.claim.agent_id,
      input.claim.claimed_at,
      input.now,
      diagnostic,
    ],
  );
  if (claims.length !== 1) {
    mutationFail("V3_RECOVERY_LIFECYCLE_EVIDENCE_CLAIM_CAS_LOST", "expired evidence claim changed before bounded close");
  }
  const terminalResult = {
    schema: "setfarm.v3-evidence-only-expired-owner.v1",
    dispatchId: input.delivery.dispatch_id,
    revisionId: input.delivery.revision_id,
    attemptId: input.attempt.attempt_id,
    decisionRef,
  };
  const deliveries = await sql.unsafe<Array<{ dispatch_id: string }>>(
    `UPDATE recovery_dispatch_deliveries
        SET state = 'blocked',
            terminal_result = $13::text::jsonb,
            diagnostic = $14,
            terminal_at = $15,
            updated_at = $15
      WHERE dispatch_id = $1
        AND recovery_case_id = $2
        AND revision_id = $3
        AND run_id = $4
        AND story_id = $5
        AND state = $6
        AND owner_instance_id = $7
        AND lease_token = $8
        AND lease_expires_at = $9
        AND attempt_id = $10
        AND claim_id = $11
        AND execution_slice_hash = $12
      RETURNING dispatch_id`,
    [
      input.delivery.dispatch_id,
      input.delivery.recovery_case_id,
      input.delivery.revision_id,
      input.delivery.run_id,
      input.delivery.story_id,
      input.delivery.state,
      input.delivery.owner_instance_id,
      input.delivery.lease_token,
      input.delivery.lease_expires_at,
      input.attempt.attempt_id,
      exactClaimId,
      input.delivery.execution_slice_hash,
      JSON.stringify(terminalResult),
      diagnostic,
      input.now,
    ],
  );
  if (deliveries.length !== 1) {
    mutationFail("V3_RECOVERY_LIFECYCLE_EVIDENCE_DELIVERY_CAS_LOST", "expired evidence delivery changed before bounded block");
  }
  const terminal = {
    owner: "infrastructure",
    outcome: "blocked",
    reasonCode: "operator_required",
    evidenceBundleHashes: [],
  };
  const cases = await sql.unsafe<Array<{ recovery_case_id: string }>>(
    `UPDATE recovery_cases
        SET status = 'blocked',
            terminal = $4::text::jsonb,
            decision_refs = (
              SELECT jsonb_agg(value ORDER BY value)
                FROM (
                  SELECT DISTINCT value
                    FROM jsonb_array_elements_text(decision_refs || $5::text::jsonb) AS item(value)
                ) canonical
            ),
            state_version = state_version + 1,
            updated_at = $6
      WHERE recovery_case_id = $1
        AND current_revision_id = $2
        AND state_version = $3
        AND owner = 'infrastructure'
        AND status = 'evidencing'
      RETURNING recovery_case_id`,
    [
      input.delivery.recovery_case_id,
      input.delivery.revision_id,
      input.chain.recovery_state_version,
      JSON.stringify(terminal),
      JSON.stringify([decisionRef]),
      input.now,
    ],
  );
  if (cases.length !== 1) {
    mutationFail("V3_RECOVERY_LIFECYCLE_EVIDENCE_CASE_CAS_LOST", "expired evidence recovery case changed before bounded block");
  }
}

async function requestExpiredModelRuntimeDrain(
  sql: TransactionSql,
  input: Readonly<{
    delivery: DeliveryRow;
    runtime: RuntimeRow;
    attempt: AttemptRow;
    now: Date;
  }>,
): Promise<boolean> {
  if (
    Math.min(millis(input.delivery.lease_expires_at), millis(input.attempt.lease_expires_at))
      > input.now.getTime()
  ) {
    mutationFail("V3_RECOVERY_LIFECYCLE_MODEL_OWNER_LIVE", "model owner still has both bounded leases");
  }
  if (input.runtime.state === "drain_requested") return false;
  if (!["starting", "running"].includes(input.runtime.state)) {
    mutationFail(
      "V3_RECOVERY_LIFECYCLE_RUNTIME_DRAIN_STATE_INVALID",
      `runtime ${input.runtime.session_id} cannot request drain from ${input.runtime.state}`,
    );
  }
  const diagnostic = "V3 recovery model owner lease expired; exact runtime drain is required before terminalization";
  const rows = await sql.unsafe<Array<{ session_id: string }>>(
    `UPDATE runtime_sessions
        SET state = 'drain_requested',
            drain_requested_at = COALESCE(drain_requested_at, $9),
            diagnostic = $10,
            state_version = state_version + 1,
            updated_at = $9
      WHERE session_id = $1
        AND run_id = $2
        AND story_id = $3
        AND claim_id = $4
        AND attempt_id = $5
        AND owner_instance_id = $6
        AND state = $7
        AND heartbeat_at = $8
      RETURNING session_id`,
    [
      input.runtime.session_id,
      input.runtime.run_id,
      input.runtime.story_id,
      input.runtime.claim_id,
      input.runtime.attempt_id,
      input.runtime.owner_instance_id,
      input.runtime.state,
      input.runtime.heartbeat_at,
      input.now,
      diagnostic,
    ],
  );
  if (rows.length !== 1) {
    mutationFail("V3_RECOVERY_LIFECYCLE_RUNTIME_DRAIN_CAS_LOST", "expired runtime changed before exact drain request");
  }
  return true;
}

async function blockExpiredModelAttempt(
  sql: TransactionSql,
  input: Readonly<{
    delivery: DeliveryRow;
    chain: ChainRow;
    runtime: RuntimeRow;
    claim: ClaimRow;
    attempt: AttemptRow;
    step: StepRow;
    story: StoryRow;
    now: Date;
  }>,
): Promise<void> {
  const exactClaimId = claimId(input.claim.id);
  if (!exactClaimId) mutationFail("V3_RECOVERY_LIFECYCLE_MODEL_CLAIM_INVALID", "model claim id is invalid");
  if (
    Math.min(millis(input.delivery.lease_expires_at), millis(input.attempt.lease_expires_at))
      > input.now.getTime()
  ) {
    mutationFail("V3_RECOVERY_LIFECYCLE_MODEL_OWNER_LIVE", "model owner still has both bounded leases");
  }
  if (!["reserved", "drained", "quarantined"].includes(input.runtime.state)) {
    mutationFail(
      "V3_RECOVERY_LIFECYCLE_MODEL_RUNTIME_NOT_DRAINED",
      `runtime ${input.runtime.session_id} is still ${input.runtime.state}`,
    );
  }

  const diagnostic = input.runtime.state === "quarantined"
    ? "V3 recovery model owner expired and exact runtime drain could not be proven; owner chain blocked on quarantined runtime"
    : "V3 recovery model owner expired without canonical completion; drained owner chain blocked because source delta is unknown";
  const decisionRef = hashCanonicalJson({
    schema: "setfarm.v3-model-recovery-expired-owner-decision.v1",
    dispatchId: input.delivery.dispatch_id,
    revisionId: input.delivery.revision_id,
    attemptId: input.attempt.attempt_id,
    runtimeSessionId: input.runtime.session_id,
    runtimeState: input.runtime.state,
    sourceRevision: {
      sha: input.chain.source_sha,
      treeHash: input.chain.source_tree_hash,
    },
  });

  const attempts = await sql.unsafe<Array<{ attempt_id: string }>>(
    `UPDATE execution_attempts
        SET disposition = 'inconclusive',
            heartbeat_at = $6,
            updated_at = $6
      WHERE attempt_id = $1
        AND claim_id = $2
        AND recovery_dispatch_id = $3
        AND recovery_case_revision_id = $4
        AND lease_expires_at = $5
        AND disposition IN ('claimed', 'running')
      RETURNING attempt_id`,
    [
      input.attempt.attempt_id,
      exactClaimId,
      input.delivery.dispatch_id,
      input.delivery.revision_id,
      input.attempt.lease_expires_at,
      input.now,
    ],
  );
  if (attempts.length !== 1) {
    mutationFail("V3_RECOVERY_LIFECYCLE_MODEL_ATTEMPT_CAS_LOST", "expired model attempt changed before bounded terminalization");
  }

  const claims = await sql.unsafe<Array<{ id: string }>>(
    `UPDATE claim_log
        SET outcome = 'infra_retry',
            abandoned_at = COALESCE(abandoned_at, $6),
            duration_ms = LEAST(
              CAST(EXTRACT(EPOCH FROM ($6::timestamptz - claimed_at::timestamptz)) * 1000 AS BIGINT),
              2147483647
            )::INTEGER,
            diagnostic = $7
      WHERE id = $1
        AND run_id = $2
        AND step_id = 'implement'
        AND story_id = $3
        AND agent_id = $4
        AND claimed_at = $5
        AND outcome IS NULL
      RETURNING id::text`,
    [
      exactClaimId,
      input.claim.run_id,
      input.claim.story_id,
      input.claim.agent_id,
      input.claim.claimed_at,
      input.now,
      diagnostic,
    ],
  );
  if (claims.length !== 1) {
    mutationFail("V3_RECOVERY_LIFECYCLE_MODEL_CLAIM_CAS_LOST", "expired model claim changed before bounded close");
  }

  try {
    if (input.runtime.state === "reserved") {
      await releaseReservedRuntimeSessionInTransaction(sql, {
        sessionId: input.runtime.session_id,
        claimId: exactClaimId,
        ownerInstanceId: input.runtime.owner_instance_id,
        diagnostic,
        now: input.now,
      });
    } else if (input.runtime.state === "drained") {
      await releaseDrainedRuntimeSessionInTransaction(sql, {
        sessionId: input.runtime.session_id,
        claimId: exactClaimId,
        ownerInstanceId: input.runtime.owner_instance_id,
        now: input.now,
      });
    }
  } catch (error) {
    mutationFail(
      "V3_RECOVERY_LIFECYCLE_MODEL_RUNTIME_RELEASE_REJECTED",
      error instanceof Error ? error.message : String(error),
    );
  }

  const stories = await sql.unsafe<Array<{ id: string }>>(
    `UPDATE stories
        SET status = 'failed',
            claimed_by = NULL,
            claimed_at = NULL,
            updated_at = $7
      WHERE id = $1
        AND run_id = $2
        AND story_id = $3
        AND status = 'running'
        AND claimed_by = $4
        AND claimed_at = $5
        AND claim_generation = $6
      RETURNING id`,
    [
      input.story.id,
      input.story.run_id,
      input.story.story_id,
      input.story.claimed_by,
      input.story.claimed_at,
      input.story.claim_generation,
      input.now,
    ],
  );
  if (stories.length !== 1) {
    mutationFail("V3_RECOVERY_LIFECYCLE_MODEL_STORY_CAS_LOST", "expired model story changed before bounded failure");
  }
  const steps = await sql.unsafe<Array<{ id: string }>>(
    `UPDATE steps
        SET current_story_id = NULL,
            updated_at = $4
      WHERE id = $1
        AND run_id = $2
        AND step_id = 'implement'
        AND type = 'loop'
        AND status = 'running'
        AND current_story_id = $3
      RETURNING id`,
    [input.step.id, input.step.run_id, input.story.id, input.now],
  );
  if (steps.length !== 1) {
    mutationFail("V3_RECOVERY_LIFECYCLE_MODEL_STEP_CAS_LOST", "expired model loop step changed before pointer clear");
  }

  const terminalResult = {
    schema: "setfarm.v3-model-recovery-expired-owner.v1",
    dispatchId: input.delivery.dispatch_id,
    revisionId: input.delivery.revision_id,
    attemptId: input.attempt.attempt_id,
    runtimeSessionId: input.runtime.session_id,
    runtimeState: input.runtime.state,
    decisionRef,
  };
  const deliveries = await sql.unsafe<Array<{ dispatch_id: string }>>(
    `UPDATE recovery_dispatch_deliveries
        SET state = 'blocked',
            terminal_result = $13::text::jsonb,
            diagnostic = $14,
            terminal_at = $15,
            updated_at = $15
      WHERE dispatch_id = $1
        AND recovery_case_id = $2
        AND revision_id = $3
        AND run_id = $4
        AND story_id = $5
        AND state = $6
        AND owner_instance_id = $7
        AND lease_token = $8
        AND lease_expires_at = $9
        AND attempt_id = $10
        AND claim_id = $11
        AND execution_slice_hash = $12
      RETURNING dispatch_id`,
    [
      input.delivery.dispatch_id,
      input.delivery.recovery_case_id,
      input.delivery.revision_id,
      input.delivery.run_id,
      input.delivery.story_id,
      input.delivery.state,
      input.delivery.owner_instance_id,
      input.delivery.lease_token,
      input.delivery.lease_expires_at,
      input.attempt.attempt_id,
      exactClaimId,
      input.delivery.execution_slice_hash,
      JSON.stringify(terminalResult),
      diagnostic,
      input.now,
    ],
  );
  if (deliveries.length !== 1) {
    mutationFail("V3_RECOVERY_LIFECYCLE_MODEL_DELIVERY_CAS_LOST", "expired model delivery changed before bounded block");
  }

  const terminal = {
    owner: input.chain.recovery_owner,
    outcome: "blocked",
    reasonCode: "operator_required",
    evidenceBundleHashes: [],
  };
  const cases = await sql.unsafe<Array<{ recovery_case_id: string }>>(
    `UPDATE recovery_cases
        SET status = 'blocked',
            terminal = $5::text::jsonb,
            decision_refs = (
              SELECT jsonb_agg(value ORDER BY value)
                FROM (
                  SELECT DISTINCT value
                    FROM jsonb_array_elements_text(decision_refs || $6::text::jsonb) AS item(value)
                ) canonical
            ),
            state_version = state_version + 1,
            updated_at = $7
      WHERE recovery_case_id = $1
        AND current_revision_id = $2
        AND state_version = $3
        AND owner = $4
        AND status = 'repairing'
      RETURNING recovery_case_id`,
    [
      input.delivery.recovery_case_id,
      input.delivery.revision_id,
      input.chain.recovery_state_version,
      input.chain.recovery_owner,
      JSON.stringify(terminal),
      JSON.stringify([decisionRef]),
      input.now,
    ],
  );
  if (cases.length !== 1) {
    mutationFail("V3_RECOVERY_LIFECYCLE_MODEL_CASE_CAS_LOST", "expired model recovery case changed before bounded block");
  }
}

async function reconcileUnbound(
  sql: TransactionSql,
  candidate: CandidateRow,
  expectedState: "authorized" | "leased",
  now: Date,
): Promise<V3RecoveryLifecycleReconciliationEventV1> {
  // Runtime -> claim -> delivery follows the strongest existing owner order.
  // The run row is already locked, so attempt reservation cannot hold claim
  // authority while waiting on the delivery row and deadlock this recovery.
  const runtimes = await lockRuntimes(sql, candidate);
  const claims = await lockOpenClaims(sql, candidate);
  const deliveries = await lockActiveDeliveries(sql, candidate);
  if (deliveries.length === 0) {
    return event(candidate, expectedState, now, {
      action: "noop",
      code: "V3_RECOVERY_LIFECYCLE_CANDIDATE_SETTLED",
      mutated: false,
      detail: "Candidate became terminal before reconciliation acquired exact row ownership",
    });
  }
  if (deliveries.length !== 1) {
    return quarantine(candidate, expectedState, now,
      "V3_RECOVERY_LIFECYCLE_MULTIPLE_ACTIVE_DELIVERIES",
      "More than one active recovery delivery names the same run and story");
  }
  const delivery = deliveries[0]!;
  if (delivery.dispatch_id !== candidate.dispatch_id || delivery.revision_id !== candidate.revision_id) {
    return event(candidate, expectedState, now, {
      action: "noop",
      code: "V3_RECOVERY_LIFECYCLE_CANDIDATE_CHANGED",
      mutated: false,
      detail: "A different active delivery became current after candidate discovery",
    });
  }
  if (delivery.state !== expectedState) {
    return event(candidate, ActiveDeliveryStateSchema.parse(delivery.state), now, {
      action: "noop",
      code: "V3_RECOVERY_LIFECYCLE_CANDIDATE_CHANGED",
      mutated: false,
      detail: `Delivery advanced from ${expectedState} to ${delivery.state} before exact reconciliation`,
    });
  }

  const attempts = await lockRelevantAttempts(sql, candidate);
  const steps = await lockSteps(sql, candidate);
  const stories = await lockStories(sql, candidate);
  const chain = await loadExactChain(sql, delivery);
  const owner = exactStepAndStory(candidate, steps, stories);
  if (!chain) {
    return quarantine(candidate, delivery.state, now,
      "V3_RECOVERY_LIFECYCLE_CHAIN_MISMATCH",
      "Run, case, current revision, dispatch, finding set, packet or source identity is not exact");
  }
  if (!owner || !["pending", "running"].includes(owner.step.status)) {
    return quarantine(candidate, delivery.state, now,
      "V3_RECOVERY_LIFECYCLE_STEP_STORY_AMBIGUOUS",
      "Recovery requires exactly one implement loop step and one exact story");
  }
  if (
    delivery.attempt_id !== null
    || delivery.claim_id !== null
    || delivery.execution_slice_hash !== null
    || delivery.attempt_count !== 0
    || delivery.started_at !== null
  ) {
    return quarantine(candidate, delivery.state, now,
      "V3_RECOVERY_LIFECYCLE_UNBOUND_DELIVERY_MISMATCH",
      "Authorized or leased delivery contains attempt lifecycle fields");
  }
  if (expectedState === "authorized") {
    const clean = delivery.owner_instance_id === null
      && delivery.lease_token === null
      && delivery.lease_expires_at === null
      && runtimes.length === 0
      && claims.length === 0
      && attempts.length === 0
      && owner.story.status === "failed"
      && owner.story.claimed_by === null
      && owner.story.claimed_at === null
      && owner.step.current_story_id !== owner.story.id;
    return clean
      ? event(candidate, delivery.state, now, {
          action: "noop",
          code: "V3_RECOVERY_LIFECYCLE_AUTHORIZED_CONSISTENT",
          mutated: false,
          detail: "Authorized delivery retains the failed-story recovery fence without an execution owner",
        })
      : quarantine(candidate, delivery.state, now,
          "V3_RECOVERY_LIFECYCLE_AUTHORIZED_OWNER_AMBIGUOUS",
          "Authorized delivery has claim, attempt, runtime, lease or story ownership residue");
  }

  const leaseExpiresAt = millis(delivery.lease_expires_at);
  if (
    !delivery.owner_instance_id
    || !delivery.lease_token
    || !Number.isFinite(leaseExpiresAt)
  ) {
    return quarantine(candidate, delivery.state, now,
      "V3_RECOVERY_LIFECYCLE_LEASE_IDENTITY_MISSING",
      "Leased delivery lacks its exact owner, token or expiry identity");
  }
  if (leaseExpiresAt > now.getTime()) {
    return quarantine(candidate, delivery.state, now,
      "V3_RECOVERY_LIFECYCLE_LEASE_NOT_EXPIRED",
      "A nonexpired owner may still publish or reserve its exact attempt; reconciler made no mutation");
  }
  if (await hasRuntimeCompletion(sql, runtimes)) {
    return quarantine(candidate, delivery.state, now,
      "V3_RECOVERY_LIFECYCLE_COMPLETION_PRESENT",
      "A runtime completion ledger exists, so pre-attempt rollback is not mechanically provable");
  }

  const cleanExpiredLease = runtimes.length === 0
    && claims.length === 0
    && attempts.length === 0
    && owner.story.status === "failed"
    && owner.story.claimed_by === null
    && owner.story.claimed_at === null
    && owner.step.current_story_id !== owner.story.id;
  if (cleanExpiredLease) {
    // This also closes the acquire-then-post-lease-validation crash/race seam:
    // no claim, runtime or attempt was ever published, so only lease identity
    // is discarded and the active recovery fence remains authorized.
    await resetExpiredLease(sql, delivery, now);
    return event(candidate, delivery.state, now, {
      action: "reset_expired_lease",
      code: "V3_RECOVERY_LIFECYCLE_EXPIRED_LEASE_RESET",
      mutated: true,
      detail: "Expired unstarted delivery lease reset to authorized by exact compare-and-set",
    });
  }

  if (runtimes.some((runtime) => ["starting", "running", "drain_requested", "drained", "quarantined"].includes(runtime.state))) {
    return quarantine(candidate, delivery.state, now,
      "V3_RECOVERY_LIFECYCLE_UNRELEASED_RUNTIME_UNSAFE",
      "Runtime crossed or may have crossed the spawn boundary; no lease, claim, story or runtime state was changed");
  }

  if (
    chain.dispatch_class !== "evidence_only"
    && runtimes.length === 1
    && runtimes[0]!.state === "reserved"
    && claims.length === 1
    && attempts.length === 0
    && exactPublicationOwner({
      candidate,
      delivery,
      runtime: runtimes[0]!,
      claim: claims[0]!,
      step: owner.step,
      story: owner.story,
    })
  ) {
    await rollbackUnreservedPublication(sql, {
      delivery,
      runtime: runtimes[0]!,
      claim: claims[0]!,
      step: owner.step,
      story: owner.story,
      now,
    });
    return event(candidate, delivery.state, now, {
      action: "rollback_unreserved_publication",
      code: "V3_RECOVERY_LIFECYCLE_PUBLICATION_ROLLED_BACK",
      mutated: true,
      detail: "Exact reserved no-spawn runtime released, claim closed infra_retry, failed story restored and delivery reauthorized",
    });
  }

  return quarantine(candidate, delivery.state, now,
    "V3_RECOVERY_LIFECYCLE_UNBOUND_OWNER_AMBIGUOUS",
    "Expired lease does not match either the clean-unstarted or exact reserved-publication recovery proof");
}

async function reconcileEvidenceOnlyAttemptBound(
  sql: TransactionSql,
  candidate: CandidateRow,
  delivery: DeliveryRow,
  chain: ChainRow,
  runtimes: readonly RuntimeRow[],
  attempts: readonly AttemptRow[],
  openClaims: readonly ClaimRow[],
  step: StepRow,
  story: StoryRow,
  now: Date,
): Promise<V3RecoveryLifecycleReconciliationEventV1> {
  const boundClaim = await lockBoundClaim(sql, candidate, delivery);
  const attempt = attempts.length === 1 ? attempts[0] : undefined;
  if (
    runtimes.length !== 0
    || !attempt
    || !boundClaim
    || openClaims.some((claim) => claimId(claim.id) !== claimId(boundClaim.id))
    || !exactEvidenceOnlyAttemptOwner({
      candidate,
      delivery,
      chain,
      claim: boundClaim,
      attempt,
      step,
      story,
    })
  ) {
    return quarantine(candidate, delivery.state, now,
      "V3_RECOVERY_LIFECYCLE_EVIDENCE_OWNER_MISMATCH",
      "Evidence-only recovery requires one exact non-model claim/attempt owner, no runtime, and an unchanged failed story");
  }

  const terminal = !["claimed", "running", "superseded"].includes(attempt.disposition);
  if (terminal) {
    if (
      ![null, "completed"].includes(boundClaim.outcome)
      || !hasExactTerminalEvidence(attempt, chain)
    ) {
      return quarantine(candidate, delivery.state, now,
        "V3_RECOVERY_LIFECYCLE_EVIDENCE_TERMINAL_INVALID",
        "Terminal evidence attempt lacks its unchanged-source bundle or exact claim outcome");
    }
    return event(candidate, delivery.state, now, {
      action: "noop",
      code: "V3_RECOVERY_LIFECYCLE_EVIDENCE_REPLAY_PENDING",
      mutated: false,
      detail: "Exact terminal evidence and unchanged source are durable; coordinator replay owns the next transition without rerunning evidence",
    });
  }
  if (boundClaim.outcome !== null) {
    return quarantine(candidate, delivery.state, now,
      "V3_RECOVERY_LIFECYCLE_EVIDENCE_ACTIVE_CLAIM_CLOSED",
      "Active evidence attempt no longer owns an open operational claim");
  }
  const deliveryExpiry = millis(delivery.lease_expires_at);
  const attemptExpiry = millis(attempt.lease_expires_at);
  if (!Number.isFinite(deliveryExpiry) || !Number.isFinite(attemptExpiry)) {
    return quarantine(candidate, delivery.state, now,
      "V3_RECOVERY_LIFECYCLE_EVIDENCE_LEASE_INVALID",
      "Evidence attempt or delivery has no finite bounded lease");
  }
  if (Math.min(deliveryExpiry, attemptExpiry) <= now.getTime()) {
    await blockExpiredEvidenceAttempt(sql, {
      delivery,
      chain,
      claim: boundClaim,
      attempt,
      now,
    });
    return event(candidate, delivery.state, now, {
      action: "block_expired_evidence_attempt",
      code: "V3_RECOVERY_LIFECYCLE_EVIDENCE_OWNER_EXPIRED",
      mutated: true,
      detail: "Expired non-model evidence owner terminalized inconclusive, closed its claim, and blocked the case without changing story state",
    });
  }
  if (delivery.state === "attempt_reserved" && attempt.disposition === "running") {
    await advanceDeliveryRunning(sql, delivery, now);
    return event(candidate, delivery.state, now, {
      action: "advance_delivery_running",
      code: "V3_RECOVERY_LIFECYCLE_EVIDENCE_RUNNING_ADVANCED",
      mutated: true,
      detail: "Historical exact evidence attempt-running/delivery-reserved crash seam advanced without rerunning evidence",
    });
  }
  if (
    (delivery.state === "attempt_reserved" && attempt.disposition === "claimed")
    || (delivery.state === "running" && attempt.disposition === "running")
  ) {
    return event(candidate, delivery.state, now, {
      action: "noop",
      code: "V3_RECOVERY_LIFECYCLE_EVIDENCE_OWNER_LIVE",
      mutated: false,
      detail: "Exact non-model evidence owner retains its bounded live lease",
    });
  }
  return quarantine(candidate, delivery.state, now,
    "V3_RECOVERY_LIFECYCLE_EVIDENCE_STATE_UNSAFE",
    `Delivery ${delivery.state} and evidence attempt ${attempt.disposition} do not form a recoverable lifecycle state`);
}

async function reconcileAttemptBound(
  sql: TransactionSql,
  candidate: CandidateRow,
  snapshot: DeliveryRow,
  now: Date,
): Promise<V3RecoveryLifecycleReconciliationEventV1> {
  if (!snapshot.attempt_id || !claimId(snapshot.claim_id)) {
    return quarantine(candidate, snapshot.state, now,
      "V3_RECOVERY_LIFECYCLE_ATTEMPT_BINDING_MISSING",
      "Attempt-bound delivery lacks its exact attempt or claim identity");
  }

  // markRunning owns runtime -> attempt -> delivery. Use the same order so a
  // live worker and this reconciler serialize instead of deadlocking.
  const runtimes = await lockRuntimes(sql, candidate);
  const attempts = await lockRelevantAttempts(sql, candidate);
  const deliveries = await lockActiveDeliveries(sql, candidate);
  if (deliveries.length === 0) {
    return event(candidate, snapshot.state, now, {
      action: "noop",
      code: "V3_RECOVERY_LIFECYCLE_CANDIDATE_SETTLED",
      mutated: false,
      detail: "Attempt-bound candidate became terminal before exact reconciliation",
    });
  }
  if (deliveries.length !== 1) {
    return quarantine(candidate, snapshot.state, now,
      "V3_RECOVERY_LIFECYCLE_MULTIPLE_ACTIVE_DELIVERIES",
      "More than one active recovery delivery names the same run and story");
  }
  const delivery = deliveries[0]!;
  if (delivery.dispatch_id !== candidate.dispatch_id || delivery.revision_id !== candidate.revision_id) {
    return event(candidate, snapshot.state, now, {
      action: "noop",
      code: "V3_RECOVERY_LIFECYCLE_CANDIDATE_CHANGED",
      mutated: false,
      detail: "A different active delivery became current after candidate discovery",
    });
  }
  if (!["attempt_reserved", "running"].includes(delivery.state)) {
    return event(candidate, ActiveDeliveryStateSchema.parse(delivery.state), now, {
      action: "noop",
      code: "V3_RECOVERY_LIFECYCLE_CANDIDATE_CHANGED",
      mutated: false,
      detail: `Attempt-bound candidate changed to ${delivery.state} before exact reconciliation`,
    });
  }

  const claims = await lockOpenClaims(sql, candidate);
  const steps = await lockSteps(sql, candidate);
  const stories = await lockStories(sql, candidate);
  const chain = await loadExactChain(sql, delivery);
  const owner = exactStepAndStory(candidate, steps, stories);
  if (!chain) {
    return quarantine(candidate, delivery.state, now,
      "V3_RECOVERY_LIFECYCLE_CHAIN_MISMATCH",
      "Attempt delivery does not match the current case, revision, packet, finding set and source identity");
  }
  if (!owner) {
    return quarantine(candidate, delivery.state, now,
      "V3_RECOVERY_LIFECYCLE_STEP_STORY_AMBIGUOUS",
      "Attempt recovery requires exactly one implement loop step and one exact story");
  }
  if (chain.dispatch_class === "evidence_only") {
    return reconcileEvidenceOnlyAttemptBound(
      sql,
      candidate,
      delivery,
      chain,
      runtimes,
      attempts,
      claims,
      owner.step,
      owner.story,
      now,
    );
  }
  if (await hasRuntimeCompletion(sql, runtimes)) {
    return quarantine(candidate, delivery.state, now,
      "V3_RECOVERY_LIFECYCLE_COMPLETION_PRESENT",
      "Runtime completion owns the next lifecycle transition");
  }
  if (
    runtimes.length !== 1
    || attempts.length !== 1
    || claims.length !== 1
    || !exactAttemptOwner({
      candidate,
      delivery,
      chain,
      runtime: runtimes[0]!,
      claim: claims[0]!,
      attempt: attempts[0]!,
      step: owner.step,
      story: owner.story,
    })
  ) {
    return quarantine(candidate, delivery.state, now,
      "V3_RECOVERY_LIFECYCLE_ATTEMPT_OWNER_MISMATCH",
      "Claim, runtime, active attempt, story, step, revision, source or delivery identity is not exact");
  }

  const runtime = runtimes[0]!;
  const attempt = attempts[0]!;
  const deliveryExpiry = millis(delivery.lease_expires_at);
  const attemptExpiry = millis(attempt.lease_expires_at);
  if (!Number.isFinite(deliveryExpiry) || !Number.isFinite(attemptExpiry)) {
    return quarantine(candidate, delivery.state, now,
      "V3_RECOVERY_LIFECYCLE_MODEL_LEASE_INVALID",
      "Model attempt or delivery has no finite bounded lease");
  }
  if (Math.min(deliveryExpiry, attemptExpiry) <= now.getTime()) {
    if (["starting", "running", "drain_requested"].includes(runtime.state)) {
      const mutated = await requestExpiredModelRuntimeDrain(sql, {
        delivery,
        runtime,
        attempt,
        now,
      });
      return event(candidate, delivery.state, now, {
        action: "request_runtime_drain",
        code: mutated
          ? "V3_RECOVERY_LIFECYCLE_MODEL_OWNER_DRAIN_REQUESTED"
          : "V3_RECOVERY_LIFECYCLE_MODEL_OWNER_DRAIN_PENDING",
        mutated,
        runtimeSessionId: runtime.session_id,
        detail: mutated
          ? "Expired exact model owner moved to drain_requested; physical process/task/workspace absence must be proven before terminalization"
          : "Expired exact model owner is already drain_requested; durable drain execution must resume after the prior reconciler stopped",
      });
    }
    if (["reserved", "drained", "quarantined"].includes(runtime.state)) {
      await blockExpiredModelAttempt(sql, {
        delivery,
        chain,
        runtime,
        claim: claims[0]!,
        attempt,
        step: owner.step,
        story: owner.story,
        now,
      });
      return event(candidate, delivery.state, now, {
        action: "block_expired_model_attempt",
        code: runtime.state === "quarantined"
          ? "V3_RECOVERY_LIFECYCLE_MODEL_OWNER_QUARANTINED"
          : "V3_RECOVERY_LIFECYCLE_MODEL_OWNER_BLOCKED",
        mutated: true,
        runtimeSessionId: runtime.session_id,
        detail: runtime.state === "quarantined"
          ? "Expired model attempt, claim, delivery and case were terminalized blocked while the runtime remains quarantined"
          : "Expired model attempt, claim, story, delivery and case were terminalized blocked after canonical no-spawn or drain proof",
      });
    }
    return quarantine(candidate, delivery.state, now,
      "V3_RECOVERY_LIFECYCLE_MODEL_EXPIRED_RUNTIME_STATE_UNSAFE",
      `Expired model owner cannot converge from runtime state ${runtime.state}`);
  }
  if (delivery.state === "attempt_reserved" && runtime.state === "running") {
    await advanceDeliveryRunning(sql, delivery, now);
    return event(candidate, delivery.state, now, {
      action: "advance_delivery_running",
      code: "V3_RECOVERY_LIFECYCLE_DELIVERY_RUNNING_ADVANCED",
      mutated: true,
      detail: "Exact running runtime and active attempt advanced the lagging delivery to running",
    });
  }
  if (delivery.state === "attempt_reserved" && ["reserved", "starting"].includes(runtime.state)) {
    return event(candidate, delivery.state, now, {
      action: "noop",
      code: "V3_RECOVERY_LIFECYCLE_ATTEMPT_PROGRESS_CONSISTENT",
      mutated: false,
      detail: `Exact attempt-bound runtime is still ${runtime.state}; its live owner retains transition authority`,
    });
  }
  if (delivery.state === "running" && runtime.state === "running") {
    return event(candidate, delivery.state, now, {
      action: "noop",
      code: "V3_RECOVERY_LIFECYCLE_RUNNING_CONSISTENT",
      mutated: false,
      detail: "Delivery, runtime, claim and active attempt already agree on running ownership",
    });
  }
  return quarantine(candidate, delivery.state, now,
    "V3_RECOVERY_LIFECYCLE_ATTEMPT_RUNTIME_STATE_UNSAFE",
    `Delivery ${delivery.state} cannot be repaired from runtime state ${runtime.state}`);
}

async function reconcileCandidate(
  sql: Sql,
  candidate: CandidateRow,
  now: Date,
): Promise<V3RecoveryLifecycleReconciliationEventV1> {
  try {
    return await (sql.begin(async (transaction) => {
      await transaction.unsafe("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [
        v3RecoveryStoryLockIdentity({ runId: candidate.run_id, storyId: candidate.story_id }),
      ]);

      // The run owner is acquired before runtime/claim/delivery rows, matching
      // runtime completion and preventing termination from racing a repair.
      const runs = await transaction.unsafe<Array<{ protocol: string; status: string }>>(
        "SELECT protocol, status FROM runs WHERE id = $1 FOR UPDATE",
        [candidate.run_id],
      );
      const run = runs[0];
      if (!run || run.protocol !== "v3" || !["running", "resuming"].includes(run.status)) {
        return quarantine(candidate, candidate.state, now,
          "V3_RECOVERY_LIFECYCLE_RUN_NOT_ACTIVE",
          "Active delivery belongs to a missing, non-v3 or non-active run");
      }
      const terminations = await transaction.unsafe<Array<{ request_id: string }>>(
        `SELECT request_id FROM run_termination_requests
          WHERE run_id = $1 AND state <> 'terminalized'
          LIMIT 1 FOR UPDATE`,
        [candidate.run_id],
      );
      if (terminations.length > 0) {
        return quarantine(candidate, candidate.state, now,
          "V3_RECOVERY_LIFECYCLE_TERMINATION_PENDING",
          "Run termination owns lifecycle recovery; delivery fence was left unchanged");
      }

      const current = await activeSnapshot(transaction, candidate);
      if (current.length === 0) {
        return event(candidate, candidate.state, now, {
          action: "noop",
          code: "V3_RECOVERY_LIFECYCLE_CANDIDATE_SETTLED",
          mutated: false,
          detail: "Candidate was already terminalized by another lifecycle owner",
        });
      }
      if (current.length !== 1) {
        return quarantine(candidate, candidate.state, now,
          "V3_RECOVERY_LIFECYCLE_MULTIPLE_ACTIVE_DELIVERIES",
          "More than one active recovery delivery names the same run and story");
      }
      const snapshot = current[0]!;
      if (snapshot.dispatch_id !== candidate.dispatch_id || snapshot.revision_id !== candidate.revision_id) {
        return event(candidate, candidate.state, now, {
          action: "noop",
          code: "V3_RECOVERY_LIFECYCLE_CANDIDATE_CHANGED",
          mutated: false,
          detail: "Candidate discovery became stale before story-lock acquisition",
        });
      }
      const state = ActiveDeliveryStateSchema.parse(snapshot.state);
      if (state === "attempt_reserved" || state === "running") {
        return reconcileAttemptBound(transaction, candidate, snapshot, now);
      }
      return reconcileUnbound(transaction, candidate, state, now);
    }) as Promise<V3RecoveryLifecycleReconciliationEventV1>);
  } catch (error) {
    if (error instanceof V3RecoveryLifecycleMutationError) {
      return quarantine(
        candidate,
        candidate.state,
        now,
        "V3_RECOVERY_LIFECYCLE_MUTATION_REJECTED",
        `${error.code}: exact transaction rolled back without exposing normal pending work`,
      );
    }
    throw error;
  }
}

export function createV3RecoveryLifecycleReconciler(sql: Sql) {
  return Object.freeze({
    async reconcileActive(
      raw: unknown = {},
      options: Readonly<{ now?: Date }> = {},
    ): Promise<V3RecoveryLifecycleReconciliationReportV1> {
      const input = ReconcileActiveInputSchema.parse(raw);
      const now = validTime(options.now);
      const candidates = await sql.unsafe<CandidateRow[]>(
        `SELECT delivery.dispatch_id, delivery.revision_id, delivery.run_id,
                delivery.story_id, delivery.state, delivery.attempt_id, delivery.claim_id
           FROM recovery_dispatch_deliveries delivery
           JOIN runs run_row ON run_row.id = delivery.run_id
          WHERE run_row.protocol = 'v3'
            AND delivery.state IN ('authorized', 'leased', 'attempt_reserved', 'running')
            AND ($1::text IS NULL OR delivery.run_id = $1)
            AND ($2::text IS NULL OR delivery.dispatch_id = $2)
          ORDER BY delivery.authorized_at, delivery.dispatch_id
          LIMIT $3`,
        [input.runId ?? null, input.dispatchId ?? null, input.limit],
      );

      const events: V3RecoveryLifecycleReconciliationEventV1[] = [];
      for (const candidate of candidates) {
        ActiveDeliveryStateSchema.parse(candidate.state);
        events.push(await reconcileCandidate(sql, candidate, now));
      }
      const resetExpiredLeases = events.filter((item) => item.action === "reset_expired_lease").length;
      const rolledBackPublications = events.filter((item) => item.action === "rollback_unreserved_publication").length;
      const advancedRunning = events.filter((item) => item.action === "advance_delivery_running").length;
      const blockedExpiredEvidenceAttempts = events.filter(
        (item) => item.action === "block_expired_evidence_attempt",
      ).length;
      const requestedRuntimeDrains = events.filter((item) => item.action === "request_runtime_drain").length;
      const blockedExpiredModelAttempts = events.filter(
        (item) => item.action === "block_expired_model_attempt",
      ).length;
      const noops = events.filter((item) => item.action === "noop").length;
      const quarantined = events.filter((item) => item.action === "quarantine").length;
      return V3RecoveryLifecycleReconciliationReportV1Schema.parse({
        schema: "setfarm.v3-recovery-lifecycle-reconciliation-report.v1",
        observedAt: now.toISOString(),
        counts: {
          scanned: events.length,
          repaired: resetExpiredLeases + rolledBackPublications + advancedRunning
            + blockedExpiredEvidenceAttempts + blockedExpiredModelAttempts
            + events.filter((item) => item.action === "request_runtime_drain" && item.mutated).length,
          resetExpiredLeases,
          rolledBackPublications,
          advancedRunning,
          blockedExpiredEvidenceAttempts,
          requestedRuntimeDrains,
          blockedExpiredModelAttempts,
          noops,
          quarantined,
        },
        events,
      });
    },
  });
}
