import { randomBytes } from "node:crypto";

import type postgres from "postgres";
import { z } from "zod";

import { readDatabaseWallClock } from "../db/database-wall-clock.js";
import {
  closeInternalProductionOwnerReservationV1,
  resolveInternalProductionClaimTerminalAuthorityPairInTransactionV1,
  resolveInternalProductionExecutionAttemptTerminalAuthorityPairInTransactionV1,
  type PgTransactionSql,
} from "../db-pg.js";
import type { CanonicalEvidenceResultV1 } from "../evidence/canonical-evidence-runner.js";
import {
  EvidenceBundleV2Schema,
  computeEvidenceBundleHash,
  type EvidenceBundleV2,
} from "../evidence/evidence-bundle-v2.js";
import {
  EvidencePlanV1Schema,
  compileEvidencePlanV1,
  type EvidencePlanV1,
} from "../evidence/evidence-plan-v1.js";
import { createAttemptRepository } from "../execution/attempt-repository.js";
import type {
  ExecutionAttemptV1,
  SourceRevisionV1,
  TerminalAttemptDispositionV1,
} from "../execution/schemas/execution-attempt-v1.js";
import { createFindingSetFromEvidenceBundleV2 } from "../findings/evidence-finding-set.js";
import type { FindingSetV1 } from "../findings/finding-set.js";
import { canonicalJsonStringify, hashCanonicalJson } from "../product-compiler/canonical-json.js";
import { Sha256Schema } from "../product-compiler/schemas/common-v1.js";
import {
  ImplementationSliceV1Schema,
  type ImplementationSliceV1,
} from "../product-compiler/schemas/implementation-slice-v1.js";
import { createFindingRecoveryRepository } from "./finding-recovery-repository.js";
import { createRecoveryDeliveryRepository } from "./recovery-delivery-repository.js";
import {
  createV3EvidenceOnlyPublication,
  type V3EvidenceOnlyPublicationLeaseV1,
} from "./v3-evidence-only-publication.js";
import {
  classifyV3EvidenceFailure,
} from "./v3-recovery-effect.js";
import {
  createV3RecoveryCoordinator,
  type V3RecoveryCoordinatorResult,
} from "./v3-recovery-coordinator.js";
import { lockV3RecoveryRunMutationAuthorityInTransaction } from "./v3-recovery-run-mutation-authority.js";
import { createV3RecoveryOwnerLeaseRepository } from "./v3-recovery-owner-lease.js";

type Sql = postgres.Sql;
type TransactionSql = postgres.TransactionSql;

const BoundedIdentitySchema = z.string().min(1).max(500);
const AttemptIdSchema = z.string().regex(/^ATT_[A-Za-z0-9-]{16,160}$/);
const RecoveryCaseIdSchema = z.string().regex(/^RCV_[a-f0-9]{64}$/);
const RecoveryRevisionIdSchema = z.string().regex(/^RREV_[a-f0-9]{64}$/);
const RecoveryDispatchIdSchema = z.string().regex(/^RDISP_[a-f0-9]{64}$/);

const AcquireInputSchema = z.object({
  workflowId: BoundedIdentitySchema,
  ownerInstanceId: BoundedIdentitySchema,
  leaseMs: z.number().int().min(30_000).max(24 * 60 * 60 * 1_000).default(10 * 60 * 1_000),
}).strict();

type AcquireInput = z.infer<typeof AcquireInputSchema>;

const LeaseSchema = z.object({
  schema: z.literal("setfarm.v3-evidence-only-lease.v1"),
  mode: z.enum(["fresh_execution", "coordinator_replay"]),
  workflowId: BoundedIdentitySchema,
  runId: BoundedIdentitySchema,
  stepDbId: BoundedIdentitySchema,
  storyDbId: BoundedIdentitySchema,
  storyId: BoundedIdentitySchema,
  recoveryCaseId: RecoveryCaseIdSchema,
  revisionId: RecoveryRevisionIdSchema,
  dispatchId: RecoveryDispatchIdSchema,
  packetHash: Sha256Schema,
  contractSliceHash: Sha256Schema,
  findingSetHash: Sha256Schema,
  findingIds: z.array(z.string().regex(/^FIND_[a-f0-9]{64}$/)).min(1).max(5_000),
  sourceRevision: z.object({
    sha: z.string().regex(/^[a-f0-9]{40,64}$/),
    treeHash: z.string().regex(/^[a-f0-9]{40,64}$/),
  }).strict(),
  evidencePlan: z.array(z.string().min(1).max(160)).min(1).max(5_000),
  priorEvidencePlanArtifactHash: Sha256Schema.optional(),
  deliveryState: z.enum(["leased", "attempt_reserved", "running"]),
  ownerInstanceId: BoundedIdentitySchema,
  leaseToken: z.string().min(16).max(500),
  leaseExpiresAt: z.string().datetime({ offset: true }),
  attemptId: AttemptIdSchema.optional(),
}).strict().superRefine((value, context) => {
  if ((value.mode === "coordinator_replay") !== Boolean(value.attemptId)) {
    context.addIssue({
      code: "custom",
      path: ["attemptId"],
      message: "Coordinator replay requires exactly one already-terminal attempt",
    });
  }
  if (value.mode === "fresh_execution" && value.deliveryState !== "leased") {
    context.addIssue({
      code: "custom",
      path: ["deliveryState"],
      message: "Fresh evidence execution must own an unreserved delivery lease",
    });
  }
});

export type V3EvidenceOnlyLeaseV1 = z.infer<typeof LeaseSchema>;

export type V3EvidenceOnlyAttemptContext = Readonly<{
  attempt: ExecutionAttemptV1;
  workdir: string;
  slice: ImplementationSliceV1;
  sliceHash: string;
  evidencePlan: EvidencePlanV1;
  evidencePlanArtifactHash: string;
}>;

export type V3EvidenceOnlyWorkerDependencies = Readonly<{
  /**
   * Fresh mode must publish one non-model operational claim and reserve the
   * exact evidence_only attempt atomically. Replay mode must load the existing
   * terminal attempt and its immutable slice/plan; it must never reserve a
   * second attempt for the dispatch.
   */
  loadOrReserveAttempt(input: Readonly<{
    lease: V3EvidenceOnlyLeaseV1;
  }>): Promise<V3EvidenceOnlyAttemptContext>;
  captureSource(workdir: string): Promise<SourceRevisionV1>;
  executeEvidence(input: Readonly<{
    lease: V3EvidenceOnlyLeaseV1;
    context: V3EvidenceOnlyAttemptContext;
  }>): Promise<CanonicalEvidenceResultV1>;
  /** Close only the exact non-model claim bound to the terminal attempt. */
  completeClaim(input: Readonly<{
    lease: V3EvidenceOnlyLeaseV1;
    attempt: ExecutionAttemptV1;
    diagnostic: string;
  }>): Promise<void>;
}>;

export type V3EvidenceOnlyWorkerResult = Readonly<{
  lease: V3EvidenceOnlyLeaseV1;
  attemptId: string;
  evidenceBundleHash: string;
  execution: "executed" | "replayed";
  coordinator: V3RecoveryCoordinatorResult;
}>;

export type V3EvidenceOnlyWorkerOptions = Readonly<{
  ownerHeartbeatIntervalMs?: number;
  ownerLeaseMs?: number;
}>;

type CandidateRow = Readonly<{
  workflow_id: string;
  run_id: string;
  step_db_id: string;
  story_db_id: string;
  story_id: string;
  recovery_case_id: string;
  revision_id: string;
  dispatch_id: string;
  packet_hash: string;
  contract_slice_hash: string;
  finding_set_hash: string;
  finding_ids: unknown;
  source_sha: string;
  source_tree_hash: string;
  evidence_plan: unknown;
  evidence_plan_artifact_hash: string | null;
  delivery_state: string;
  owner_instance_id: string | null;
  lease_expires_at: Date | string | null;
  attempt_id: string | null;
  attempt_count: number;
  attempt_disposition: string | null;
  attempt_evidence_refs: string | null;
}>;

export class V3EvidenceOnlyWorkerError extends Error {
  readonly code: string;

  constructor(code: string, message: string, options: Readonly<{ cause?: unknown }> = {}) {
    super(`${code}:${message}`, options);
    this.name = "V3EvidenceOnlyWorkerError";
    this.code = code;
  }
}

function fail(code: string, message: string, cause?: unknown): never {
  throw new V3EvidenceOnlyWorkerError(code, message, { cause });
}

function validTime(value?: Date): Date {
  const parsed = new Date(value ?? new Date());
  if (!Number.isFinite(parsed.getTime())) fail("V3_EVIDENCE_ONLY_TIME_INVALID", "worker time is invalid");
  return parsed;
}

function strings(value: unknown, code: string): string[] {
  try {
    const parsed = typeof value === "string" ? JSON.parse(value) as unknown : value;
    return z.array(z.string()).parse(parsed);
  } catch (error) {
    fail(code, "canonical string array is invalid", error);
  }
}

function exactStrings(left: readonly string[], right: readonly string[]): boolean {
  const canonical = (values: readonly string[]) => [...new Set(values)].sort();
  const a = canonical(left);
  const b = canonical(right);
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

function sameRevision(
  left: Readonly<{ sha: string; treeHash: string }>,
  right: Readonly<{ sha: string; treeHash: string }>,
): boolean {
  return left.sha === right.sha && left.treeHash === right.treeHash;
}

function publicationLease(lease: V3EvidenceOnlyLeaseV1): V3EvidenceOnlyPublicationLeaseV1 {
  return {
    mode: "fresh_execution",
    runId: lease.runId,
    stepDbId: lease.stepDbId,
    storyDbId: lease.storyDbId,
    storyId: lease.storyId,
    recoveryCaseId: lease.recoveryCaseId,
    revisionId: lease.revisionId,
    dispatchId: lease.dispatchId,
    packetHash: lease.packetHash,
    contractSliceHash: lease.contractSliceHash,
    findingSetHash: lease.findingSetHash,
    sourceRevision: lease.sourceRevision,
    evidencePlan: lease.evidencePlan,
    ...(lease.priorEvidencePlanArtifactHash
      ? { priorEvidencePlanArtifactHash: lease.priorEvidencePlanArtifactHash }
      : {}),
    ownerInstanceId: lease.ownerInstanceId,
    leaseToken: lease.leaseToken,
    leaseExpiresAt: lease.leaseExpiresAt,
  };
}

function evidenceRefs(raw: string | null): string[] {
  if (!raw) return [];
  return strings(raw, "V3_EVIDENCE_ONLY_ATTEMPT_REFS_INVALID");
}

function terminalAttemptDisposition(value: string | null): boolean {
  return value !== null && !["claimed", "running", "superseded"].includes(value);
}

function bundleRefs(refs: readonly string[]): string[] {
  return refs.flatMap((ref) => {
    const match = ref.match(/^setfarm:\/\/evidence-bundle\/([a-f0-9]{64})$/);
    return match?.[1] ? [match[1]] : [];
  });
}

function findingSetRefs(refs: readonly string[]): string[] {
  return refs.flatMap((ref) => {
    const match = ref.match(/^setfarm:\/\/finding-set\/([a-f0-9]{64})$/);
    return match?.[1] ? [match[1]] : [];
  });
}

const EXACT_CHAIN_PREDICATE = `
  recovery_case.current_revision_id = revision.revision_id
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
  AND delivery.dispatch_id = dispatch.dispatch_id
  AND delivery.recovery_case_id = recovery_case.recovery_case_id
  AND delivery.revision_id = revision.revision_id
  AND delivery.run_id = revision.run_id
  AND delivery.story_id = revision.story_id
  AND delivery.authorized_at = dispatch.authorized_at
  AND finding_set.finding_set_hash = revision.finding_set_hash
  AND finding_set.run_id = revision.run_id
  AND finding_set.story_id = revision.story_id
  AND finding_set.packet_hash = revision.packet_hash
  AND finding_set.slice_hash = revision.contract_slice_hash
  AND finding_set.source_sha = revision.source_sha
  AND finding_set.source_tree_hash = revision.source_tree_hash
  AND finding_set.finding_ids = revision.finding_ids
  AND run_row.packet_hash = revision.packet_hash
`;

function exactJoins(): string {
  return `
    FROM recovery_dispatch_deliveries delivery
    JOIN recovery_revision_dispatches dispatch
      ON dispatch.dispatch_id = delivery.dispatch_id
    JOIN recovery_case_revisions revision
      ON revision.revision_id = dispatch.revision_id
     AND revision.recovery_case_id = dispatch.recovery_case_id
    JOIN recovery_cases recovery_case
      ON recovery_case.recovery_case_id = revision.recovery_case_id
    JOIN finding_sets finding_set
      ON finding_set.finding_set_hash = revision.finding_set_hash
    JOIN runs run_row
      ON run_row.id = delivery.run_id
    JOIN stories story_row
      ON story_row.run_id = run_row.id
     AND story_row.story_id = delivery.story_id
    JOIN steps step_row
      ON step_row.run_id = run_row.id
     AND step_row.step_id = 'implement'
     AND step_row.type = 'loop'
    LEFT JOIN execution_attempts attempt
      ON attempt.attempt_id = delivery.attempt_id
  `;
}

const CANDIDATE_COLUMNS = `
  run_row.workflow_id,
  run_row.id AS run_id,
  step_row.id AS step_db_id,
  story_row.id AS story_db_id,
  story_row.story_id,
  recovery_case.recovery_case_id,
  revision.revision_id,
  dispatch.dispatch_id,
  revision.packet_hash,
  revision.contract_slice_hash,
  revision.finding_set_hash,
  revision.finding_ids,
  revision.source_sha,
  revision.source_tree_hash,
  revision.evidence_plan,
  revision.evidence_plan_artifact_hash,
  delivery.state AS delivery_state,
  delivery.owner_instance_id,
  delivery.lease_expires_at,
  delivery.attempt_id,
  delivery.attempt_count,
  attempt.disposition AS attempt_disposition,
  attempt.evidence_refs AS attempt_evidence_refs
`;

function candidateEligibilityPredicate(): string {
  return `
    run_row.workflow_id = $1
    AND run_row.protocol = 'v3'
    AND run_row.status IN ('running', 'resuming')
    AND story_row.status = 'failed'
    AND step_row.status IN ('pending', 'running')
    AND recovery_case.status = 'evidencing'
    AND recovery_case.owner = 'infrastructure'
    AND revision.owner = 'infrastructure'
    AND revision.expected_delta->>'kind' = 'evidence_refresh'
    AND revision.allowed_paths = '[]'::jsonb
    AND dispatch.dispatch_class = 'evidence_only'
    AND recovery_case.used_evidence_only <= recovery_case.max_evidence_only
    AND NOT EXISTS (
      SELECT 1 FROM stories duplicate_story
       WHERE duplicate_story.run_id = story_row.run_id
         AND duplicate_story.story_id = story_row.story_id
         AND duplicate_story.status = 'failed'
         AND duplicate_story.id <> story_row.id
    )
    AND NOT EXISTS (
      SELECT 1 FROM steps duplicate_step
       WHERE duplicate_step.run_id = step_row.run_id
         AND duplicate_step.step_id = 'implement'
         AND duplicate_step.type = 'loop'
         AND duplicate_step.status IN ('pending', 'running')
         AND duplicate_step.id <> step_row.id
    )
    AND (
      (
        delivery.state IN ('authorized', 'leased')
        AND (delivery.state = 'authorized' OR delivery.lease_expires_at <= $2)
        AND delivery.attempt_count = 0
        AND delivery.attempt_id IS NULL
        AND attempt.attempt_id IS NULL
        AND NOT EXISTS (
          SELECT 1 FROM execution_attempts duplicate_attempt
           WHERE duplicate_attempt.recovery_dispatch_id = dispatch.dispatch_id
        )
        AND NOT EXISTS (
          SELECT 1 FROM claim_log open_claim
           WHERE open_claim.run_id = run_row.id
             AND open_claim.step_id = step_row.step_id
             AND open_claim.story_id = story_row.story_id
             AND open_claim.outcome IS NULL
        )
      )
      OR (
        delivery.state IN ('attempt_reserved', 'running')
        AND delivery.attempt_count = 1
        AND delivery.attempt_id IS NOT NULL
        AND attempt.recovery_dispatch_id = dispatch.dispatch_id
        AND attempt.recovery_case_revision_id = revision.revision_id
        AND attempt.attempt_class = 'evidence_only'
        AND attempt.run_id = run_row.id
        AND attempt.step_id = step_row.step_id
        AND attempt.story_id = story_row.story_id
        AND attempt.packet_hash = revision.packet_hash
        AND attempt.finding_set_hash = revision.finding_set_hash
        AND attempt.source_before_sha = revision.source_sha
        AND attempt.source_before_tree_hash = revision.source_tree_hash
        AND attempt.disposition NOT IN ('claimed', 'running', 'superseded')
        AND EXISTS (
          SELECT 1
            FROM jsonb_array_elements_text(attempt.evidence_refs::jsonb) AS evidence_ref(value)
           WHERE evidence_ref.value ~ '^setfarm://evidence-bundle/[a-f0-9]{64}$'
        )
        AND (delivery.owner_instance_id = $3 OR delivery.lease_expires_at <= $2)
      )
    )
    AND ${EXACT_CHAIN_PREDICATE}
  `;
}

async function discoverCandidate(
  sql: Sql,
  input: AcquireInput,
  now: Date,
  excludedDispatchIds: readonly string[],
): Promise<CandidateRow | undefined> {
  const rows = await sql.unsafe<CandidateRow[]>(
    `SELECT ${CANDIDATE_COLUMNS}
       ${exactJoins()}
      WHERE ${candidateEligibilityPredicate()}
        AND NOT (delivery.dispatch_id = ANY($4::text[]))
      ORDER BY delivery.authorized_at, delivery.dispatch_id
      LIMIT 1`,
    [input.workflowId, now, input.ownerInstanceId, excludedDispatchIds],
  );
  return rows[0];
}

function mapLease(
  row: CandidateRow,
  input: AcquireInput,
  leaseToken: string,
  leaseExpiresAt: Date,
): V3EvidenceOnlyLeaseV1 {
  const refs = evidenceRefs(row.attempt_evidence_refs);
  const replay = row.attempt_id !== null;
  if (replay && (!terminalAttemptDisposition(row.attempt_disposition) || bundleRefs(refs).length !== 1)) {
    fail("V3_EVIDENCE_ONLY_REPLAY_ATTEMPT_INVALID", "replay candidate lacks one terminal evidence-bound attempt");
  }
  return LeaseSchema.parse({
    schema: "setfarm.v3-evidence-only-lease.v1",
    mode: replay ? "coordinator_replay" : "fresh_execution",
    workflowId: row.workflow_id,
    runId: row.run_id,
    stepDbId: row.step_db_id,
    storyDbId: row.story_db_id,
    storyId: row.story_id,
    recoveryCaseId: row.recovery_case_id,
    revisionId: row.revision_id,
    dispatchId: row.dispatch_id,
    packetHash: row.packet_hash,
    contractSliceHash: row.contract_slice_hash,
    findingSetHash: row.finding_set_hash,
    findingIds: strings(row.finding_ids, "V3_EVIDENCE_ONLY_FINDING_IDS_INVALID"),
    sourceRevision: { sha: row.source_sha, treeHash: row.source_tree_hash },
    evidencePlan: strings(row.evidence_plan, "V3_EVIDENCE_ONLY_PLAN_REFS_INVALID"),
    ...(row.evidence_plan_artifact_hash
      ? { priorEvidencePlanArtifactHash: row.evidence_plan_artifact_hash }
      : {}),
    deliveryState: replay ? row.delivery_state : "leased",
    ownerInstanceId: input.ownerInstanceId,
    leaseToken,
    leaseExpiresAt: leaseExpiresAt.toISOString(),
    ...(row.attempt_id ? { attemptId: row.attempt_id } : {}),
  });
}

async function acquireCandidate(
  sql: Sql,
  input: AcquireInput,
  candidate: CandidateRow,
  discoveredAt: Date,
): Promise<V3EvidenceOnlyLeaseV1 | undefined> {
  return sql.begin(async (transaction: TransactionSql) => {
    try {
      await lockV3RecoveryRunMutationAuthorityInTransaction(transaction, {
        runId: candidate.run_id,
        storyId: candidate.story_id,
      });
    } catch (error) {
      if (/^V3_RECOVERY_(?:RUN_NOT_ACTIVE|TERMINATION_PENDING):/.test(
        String((error as Error)?.message ?? error),
      )) return undefined;
      throw error;
    }
    const rows = await transaction.unsafe<CandidateRow[]>(
      `SELECT ${CANDIDATE_COLUMNS}
         ${exactJoins()}
        WHERE ${candidateEligibilityPredicate()}
          AND delivery.dispatch_id = $4
        FOR UPDATE OF delivery, recovery_case`,
      [input.workflowId, discoveredAt, input.ownerInstanceId, candidate.dispatch_id],
    );
    if (rows.length !== 1) return undefined;
    const row = rows[0]!;
    // Candidate discovery is only an optimization. The durable lease instant
    // comes from PostgreSQL after the story/delivery owner locks are held, so a
    // caller clock or a lock wait can never publish an already-expired lease.
    const acquiredAt = await readDatabaseWallClock(
      transaction,
      "V3_EVIDENCE_ONLY_DB_TIME_UNAVAILABLE",
    );
    const leaseToken = randomBytes(32).toString("hex");
    const leaseExpiresAt = new Date(acquiredAt.getTime() + input.leaseMs);
    const updated = await transaction.unsafe<Array<{ dispatch_id: string }>>(
      `UPDATE recovery_dispatch_deliveries
          SET state = CASE WHEN attempt_id IS NULL THEN 'leased' ELSE state END,
              owner_instance_id = $2,
              lease_token = $3,
              lease_expires_at = $4,
              updated_at = $5
        WHERE dispatch_id = $1
          AND revision_id = $6
          AND state = $7
          AND attempt_id IS NOT DISTINCT FROM $8::text
        RETURNING dispatch_id`,
      [
        row.dispatch_id,
        input.ownerInstanceId,
        leaseToken,
        leaseExpiresAt,
        acquiredAt,
        row.revision_id,
        row.delivery_state,
        row.attempt_id,
      ],
    );
    if (updated.length !== 1) return undefined;
    return mapLease(row, input, leaseToken, leaseExpiresAt);
  }) as Promise<V3EvidenceOnlyLeaseV1 | undefined>;
}

function expectedEvidenceRefs(plan: EvidencePlanV1): string[] {
  return [
    ...plan.predicateRefs,
    ...plan.commands.map((command) => `EVID_COMMAND_${command.commandRef}`),
  ];
}

function assertAttemptContext(
  lease: V3EvidenceOnlyLeaseV1,
  raw: V3EvidenceOnlyAttemptContext,
): V3EvidenceOnlyAttemptContext {
  const slice = ImplementationSliceV1Schema.parse(raw.slice);
  const plan = EvidencePlanV1Schema.parse(raw.evidencePlan);
  const sliceHash = Sha256Schema.parse(raw.sliceHash);
  const planArtifactHash = Sha256Schema.parse(raw.evidencePlanArtifactHash);
  const attempt = raw.attempt;
  if (!raw.workdir.trim()) fail("V3_EVIDENCE_ONLY_WORKDIR_REQUIRED", "attempt context has no exact worktree");
  if (
    slice.recovery
    || slice.packetHash !== lease.packetHash
    || slice.storyId !== lease.storyId
    || slice.sourceRevision.baseSha !== lease.sourceRevision.sha
    || slice.sourceRevision.treeHash !== lease.sourceRevision.treeHash
    || plan.packetHash !== lease.packetHash
    || plan.storyId !== lease.storyId
    || plan.sliceHash !== sliceHash
    || !exactStrings(expectedEvidenceRefs(plan), lease.evidencePlan)
    || canonicalJsonStringify(plan) !== canonicalJsonStringify(compileEvidencePlanV1({ slice, sliceHash }))
  ) {
    fail(
      "V3_EVIDENCE_ONLY_SEALED_CONTEXT_MISMATCH",
      "slice and plan are not one clean exact-source evidence context for the dispatch",
    );
  }
  if (
    attempt.runId !== lease.runId
    || attempt.stepId !== "implement"
    || attempt.storyId !== lease.storyId
    || attempt.attemptClass !== "evidence_only"
    || attempt.packetHash !== lease.packetHash
    || attempt.sliceHash !== sliceHash
    || attempt.findingSetHash !== lease.findingSetHash
    || attempt.recoveryCaseRevisionId !== lease.revisionId
    || attempt.recoveryDispatchId !== lease.dispatchId
    || !sameRevision(attempt.sourceBefore, lease.sourceRevision)
    || !attempt.claimId
    || !attempt.evidenceRefs.includes(`setfarm://claim-log/${attempt.claimId}`)
    || !attempt.evidenceRefs.includes(`setfarm://artifact/${sliceHash}`)
    || !attempt.evidenceRefs.includes(`setfarm://artifact/${planArtifactHash}`)
  ) {
    fail("V3_EVIDENCE_ONLY_ATTEMPT_IDENTITY_MISMATCH", "attempt is not fenced by the exact evidence-only dispatch");
  }
  if (lease.mode === "fresh_execution") {
    if (lease.attemptId || !["claimed", "running"].includes(attempt.disposition)) {
      fail("V3_EVIDENCE_ONLY_FRESH_ATTEMPT_INVALID", "fresh execution did not reserve one active attempt");
    }
  } else if (
    attempt.attemptId !== lease.attemptId
    || !terminalAttemptDisposition(attempt.disposition)
    || !sameRevision(attempt.sourceAfter ?? { sha: "", treeHash: "" }, lease.sourceRevision)
  ) {
    fail("V3_EVIDENCE_ONLY_REPLAY_ATTEMPT_MISMATCH", "replay did not load the exact terminal unchanged-source attempt");
  }
  return Object.freeze({
    ...raw,
    attempt,
    slice,
    sliceHash,
    evidencePlan: plan,
    evidencePlanArtifactHash: planArtifactHash,
  });
}

function assertCanonicalEvidence(input: Readonly<{
  lease: V3EvidenceOnlyLeaseV1;
  context: V3EvidenceOnlyAttemptContext;
  result: CanonicalEvidenceResultV1;
}>): EvidenceBundleV2 {
  const bundle = EvidenceBundleV2Schema.parse(input.result.bundle);
  const computedHash = computeEvidenceBundleHash(bundle);
  if (
    input.result.bundleHash !== computedHash
    || bundle.runId !== input.lease.runId
    || bundle.storyId !== input.lease.storyId
    || bundle.packetHash !== input.lease.packetHash
    || bundle.sliceHash !== input.context.sliceHash
    || bundle.attemptId !== input.context.attempt.attemptId
    || !sameRevision(bundle.sourceRevision, input.lease.sourceRevision)
    || bundle.aggregateVerdict === "incomplete"
  ) {
    fail("V3_EVIDENCE_ONLY_BUNDLE_IDENTITY_MISMATCH", "runner output is not complete evidence for the exact attempt and source");
  }
  return bundle;
}

function disposition(bundle: EvidenceBundleV2): TerminalAttemptDispositionV1 {
  if (bundle.aggregateVerdict === "pass") return "verified";
  if (bundle.aggregateVerdict === "fail") return "no_progress";
  return "inconclusive";
}

function compactDiagnostic(error: unknown): string {
  return String((error as Error)?.message ?? error ?? "unknown evidence-only error")
    .replace(/\s+/g, " ")
    .slice(0, 3_000);
}

async function quarantineDelivery(input: Readonly<{
  sql: Sql;
  lease: V3EvidenceOnlyLeaseV1;
  phase: string;
  error: unknown;
}>): Promise<void> {
  const diagnostic = compactDiagnostic(input.error);
  const diagnosticHash = hashCanonicalJson({ phase: input.phase, diagnostic });
  const decisionRef = hashCanonicalJson({
    schema: "setfarm.v3-evidence-only-quarantine-decision.v1",
    dispatchId: input.lease.dispatchId,
    revisionId: input.lease.revisionId,
    phase: input.phase,
    diagnosticHash,
  });
  const result = {
    schema: "setfarm.v3-evidence-only-quarantine.v1",
    dispatchId: input.lease.dispatchId,
    revisionId: input.lease.revisionId,
    phase: input.phase,
    diagnosticHash,
    decisionRef,
  };
  await input.sql.begin(async (transaction: TransactionSql) => {
    await lockV3RecoveryRunMutationAuthorityInTransaction(transaction, {
      runId: input.lease.runId,
      storyId: input.lease.storyId,
    });
    const cases = await transaction.unsafe<Array<{
      current_revision_id: string;
      owner: string;
      state_version: number;
      status: string;
    }>>(
      `SELECT current_revision_id, owner, state_version, status
         FROM recovery_cases
        WHERE recovery_case_id = $1
        FOR UPDATE`,
      [input.lease.recoveryCaseId],
    );
    const recoveryCase = cases[0];
    if (
      !recoveryCase
      || recoveryCase.current_revision_id !== input.lease.revisionId
      || recoveryCase.owner !== "infrastructure"
      || recoveryCase.status !== "evidencing"
    ) {
      fail(
        "V3_EVIDENCE_ONLY_QUARANTINE_CASE_CONFLICT",
        "quarantine no longer owns the exact active infrastructure recovery case",
      );
    }
    const deliveryOwners = await transaction.unsafe<Array<{
      attempt_id: string | null;
      claim_id: string | number | null;
      lease_expires_at: Date | string | null;
    }>>(
      `SELECT attempt_id, claim_id, lease_expires_at
         FROM recovery_dispatch_deliveries
        WHERE dispatch_id = $1
          AND revision_id = $2
          AND owner_instance_id = $3
          AND lease_token = $4
          AND state IN ('leased', 'attempt_reserved', 'running')
        FOR UPDATE`,
      [
        input.lease.dispatchId,
        input.lease.revisionId,
        input.lease.ownerInstanceId,
        input.lease.leaseToken,
      ],
    );
    const deliveryOwner = deliveryOwners[0];
    if (!deliveryOwner) {
      fail("V3_EVIDENCE_ONLY_QUARANTINE_DELIVERY_CONFLICT", "quarantine lost the exact delivery lease");
    }
    if ((deliveryOwner.attempt_id === null) !== (deliveryOwner.claim_id === null)) {
      fail("V3_EVIDENCE_ONLY_QUARANTINE_DELIVERY_OWNER_PAIR_INVALID", "delivery claim and attempt identities must be bound as an exact pair");
    }
    const deliveryLeaseExpiresAt = deliveryOwner.lease_expires_at
      ? new Date(deliveryOwner.lease_expires_at).getTime()
      : Number.NaN;
    let mutationTime: Date | undefined;
    if (deliveryOwner.attempt_id) {
      const owners = await transaction.unsafe<Array<{
        attempt_id: string;
        claim_id: string | number | null;
        disposition: string;
        attempt_class: string;
        run_id: string;
        story_id: string;
        recovery_case_revision_id: string | null;
        recovery_dispatch_id: string | null;
        source_before_sha: string;
        source_before_tree_hash: string;
        lease_expires_at: Date | string;
        claim_outcome: string | null;
      }>>(
        `SELECT attempt.attempt_id, attempt.claim_id, attempt.disposition,
                attempt.attempt_class, attempt.run_id, attempt.story_id,
                attempt.recovery_case_revision_id, attempt.recovery_dispatch_id,
                attempt.source_before_sha, attempt.source_before_tree_hash,
                attempt.lease_expires_at,
                claim.outcome AS claim_outcome
          FROM execution_attempts attempt
           JOIN claim_log claim ON claim.id = attempt.claim_id
          WHERE attempt.attempt_id = $1
          FOR UPDATE OF attempt, claim`,
        [deliveryOwner.attempt_id],
      );
      const owner = owners[0];
      if (
        !owner
        || !Number.isSafeInteger(Number(owner.claim_id))
        || Number(deliveryOwner.claim_id) !== Number(owner.claim_id)
        || owner.attempt_class !== "evidence_only"
        || owner.run_id !== input.lease.runId
        || owner.story_id !== input.lease.storyId
        || owner.recovery_case_revision_id !== input.lease.revisionId
        || owner.recovery_dispatch_id !== input.lease.dispatchId
        || owner.source_before_sha !== input.lease.sourceRevision.sha
        || owner.source_before_tree_hash !== input.lease.sourceRevision.treeHash
      ) {
        fail("V3_EVIDENCE_ONLY_QUARANTINE_OWNER_MISMATCH", "attempt/claim owner differs from the exact evidence delivery");
      }
      if (terminalAttemptDisposition(owner.disposition)) {
        // The terminal publication transaction committed before the caller
        // observed its result. Leave it replayable; never block or rerun it.
        return;
      }
      if (!["claimed", "running"].includes(owner.disposition) || owner.claim_outcome !== null) {
        fail("V3_EVIDENCE_ONLY_QUARANTINE_OWNER_STATE_INVALID", "preterminal attempt/claim owner is not active and exact");
      }
      mutationTime = await readDatabaseWallClock(
        transaction,
        "V3_EVIDENCE_ONLY_DB_TIME_UNAVAILABLE",
      );
      const attemptLeaseExpiresAt = new Date(owner.lease_expires_at).getTime();
      if (
        !Number.isFinite(deliveryLeaseExpiresAt)
        || deliveryLeaseExpiresAt <= mutationTime.getTime()
        || !Number.isFinite(attemptLeaseExpiresAt)
        || attemptLeaseExpiresAt <= mutationTime.getTime()
      ) {
        fail("V3_EVIDENCE_ONLY_QUARANTINE_LEASE_LOST", "expired owner cannot quarantine canonical recovery state");
      }
      const attempts = await transaction.unsafe<Array<{ attempt_id: string }>>(
        `UPDATE execution_attempts
            SET disposition = 'inconclusive',
                heartbeat_at = $2,
                updated_at = $2
          WHERE attempt_id = $1
            AND disposition IN ('claimed', 'running')
            AND lease_expires_at > $2
          RETURNING attempt_id`,
        [owner.attempt_id, mutationTime],
      );
      if (attempts.length !== 1) {
        fail("V3_EVIDENCE_ONLY_QUARANTINE_ATTEMPT_CAS_LOST", "active evidence attempt changed before quarantine");
      }
      const closed = await transaction.unsafe<Array<{ id: string }>>(
        `UPDATE claim_log
            SET outcome = 'infra_retry',
                abandoned_at = COALESCE(abandoned_at, $2),
                duration_ms = LEAST(
                  CAST(EXTRACT(EPOCH FROM ($2::timestamptz - claimed_at::timestamptz)) * 1000 AS BIGINT),
                  2147483647
                )::INTEGER,
                diagnostic = $3
          WHERE id = $1
            AND outcome IS NULL
          RETURNING id::text`,
        [owner.claim_id, mutationTime, `V3_EVIDENCE_ONLY_QUARANTINED:${input.phase}:${diagnostic}`.slice(0, 10_000)],
      );
      if (closed.length !== 1) {
        fail("V3_EVIDENCE_ONLY_QUARANTINE_CLAIM_CAS_LOST", "active evidence claim changed before quarantine");
      }
      const attemptClose = await resolveInternalProductionExecutionAttemptTerminalAuthorityPairInTransactionV1(
        transaction as PgTransactionSql,
        { attemptId: attempts[0]!.attempt_id },
      );
      const claimClose = await resolveInternalProductionClaimTerminalAuthorityPairInTransactionV1(
        transaction as PgTransactionSql,
        { claimIdText: closed[0]!.id },
      );
      await closeInternalProductionOwnerReservationV1(
        transaction as PgTransactionSql,
        attemptClose,
      );
      await closeInternalProductionOwnerReservationV1(
        transaction as PgTransactionSql,
        claimClose,
      );
    }
    const now = mutationTime ?? await readDatabaseWallClock(
      transaction,
      "V3_EVIDENCE_ONLY_DB_TIME_UNAVAILABLE",
    );
    if (
      !Number.isFinite(deliveryLeaseExpiresAt)
      || deliveryLeaseExpiresAt <= now.getTime()
    ) {
      fail("V3_EVIDENCE_ONLY_QUARANTINE_LEASE_LOST", "expired owner cannot quarantine canonical recovery state");
    }
    const deliveries = await transaction.unsafe<Array<{ dispatch_id: string }>>(
      `UPDATE recovery_dispatch_deliveries
          SET state = 'blocked',
              terminal_result = $5::text::jsonb,
              diagnostic = $6,
              terminal_at = $7,
              updated_at = $7
        WHERE dispatch_id = $1
          AND revision_id = $2
          AND owner_instance_id = $3
          AND lease_token = $4
          AND state IN ('leased', 'attempt_reserved', 'running')
          AND lease_expires_at > $7
        RETURNING dispatch_id`,
      [
        input.lease.dispatchId,
        input.lease.revisionId,
        input.lease.ownerInstanceId,
        input.lease.leaseToken,
        JSON.stringify(result),
        `V3_EVIDENCE_ONLY_QUARANTINED:${input.phase}:${diagnostic}`.slice(0, 10_000),
        now,
      ],
    );
    if (deliveries.length !== 1) {
      fail(
        "V3_EVIDENCE_ONLY_QUARANTINE_DELIVERY_CONFLICT",
        "quarantine lost the exact delivery lease",
      );
    }
    const terminal = {
      owner: "infrastructure",
      outcome: "blocked",
      reasonCode: "operator_required",
      evidenceBundleHashes: [],
    };
    const blocked = await transaction.unsafe<Array<{ recovery_case_id: string }>>(
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
        input.lease.recoveryCaseId,
        input.lease.revisionId,
        recoveryCase.state_version,
        JSON.stringify(terminal),
        JSON.stringify([decisionRef]),
        now,
      ],
    );
    if (blocked.length !== 1) {
      fail(
        "V3_EVIDENCE_ONLY_QUARANTINE_CASE_CAS_LOST",
        "quarantine lost the exact recovery-case state fence",
      );
    }
  });
}

async function assertClaimClosed(sql: Sql, lease: V3EvidenceOnlyLeaseV1, attempt: ExecutionAttemptV1): Promise<void> {
  const rows = await sql.unsafe<Array<{ outcome: string | null }>>(
    `SELECT outcome
       FROM claim_log
      WHERE id = $1
        AND run_id = $2
        AND step_id = 'implement'
        AND story_id = $3
        AND ($4::text IS NULL OR agent_id = $4)
      LIMIT 1`,
    [attempt.claimId!, lease.runId, lease.storyId, attempt.agentId ?? null],
  );
  if (!rows[0]?.outcome) {
    fail("V3_EVIDENCE_ONLY_CLAIM_NOT_CLOSED", "terminal evidence attempt still owns an open operational claim");
  }
}

export function createV3EvidenceOnlyRecoveryWorker(
  sql: Sql,
  dependencies: V3EvidenceOnlyWorkerDependencies,
  options: V3EvidenceOnlyWorkerOptions = {},
) {
  const attempts = createAttemptRepository(sql);
  const deliveries = createRecoveryDeliveryRepository(sql);
  const findings = createFindingRecoveryRepository(sql);
  const publication = createV3EvidenceOnlyPublication(sql);
  const coordinator = createV3RecoveryCoordinator(sql);
  const ownerLeases = createV3RecoveryOwnerLeaseRepository(sql);
  const ownerHeartbeatIntervalMs = z.number().int().min(5).max(10 * 60_000)
    .parse(options.ownerHeartbeatIntervalMs ?? 30_000);
  const ownerLeaseMs = Math.max(
    ownerHeartbeatIntervalMs * 3,
    z.number().int().min(30_000).max(24 * 60 * 60 * 1_000)
      .parse(options.ownerLeaseMs ?? 2 * 60_000),
  );

  async function withEvidenceOwnerHeartbeat<T>(
    lease: V3EvidenceOnlyLeaseV1,
    context: V3EvidenceOnlyAttemptContext,
    operation: () => Promise<T>,
  ): Promise<T> {
    const heartbeatInput = {
      kind: "evidence_only" as const,
      runId: lease.runId,
      storyId: lease.storyId,
      claimId: context.attempt.claimId!,
      claimAgentId: context.attempt.agentId!,
      revisionId: lease.revisionId,
      dispatchId: lease.dispatchId,
      ownerInstanceId: lease.ownerInstanceId,
      leaseToken: lease.leaseToken,
      attempt: {
        attemptId: context.attempt.attemptId,
        generation: context.attempt.generation,
        fenceToken: context.attempt.fenceToken,
      },
    };
    if (!context.attempt.claimId) {
      fail("V3_EVIDENCE_ONLY_HEARTBEAT_CLAIM_MISSING", "active evidence attempt has no claim fence");
    }
    const retain = async (): Promise<void> => {
      const retained = await ownerLeases.heartbeat(heartbeatInput, {
        leaseMs: ownerLeaseMs,
      });
      if (retained.status !== "retained") {
        fail("V3_EVIDENCE_ONLY_OWNER_LEASE_LOST", retained.reason);
      }
    };

    await retain();
    let timer: NodeJS.Timeout | undefined;
    let heartbeatInFlight = Promise.resolve();
    let heartbeatError: unknown;
    let stopped = false;
    const schedule = () => {
      timer = setTimeout(() => {
        heartbeatInFlight = retain().catch((error) => {
          heartbeatError = error;
        }).finally(() => {
          if (!stopped && !heartbeatError) schedule();
        });
      }, ownerHeartbeatIntervalMs);
      timer.unref();
    };
    schedule();
    let result: T;
    try {
      result = await operation();
    } finally {
      stopped = true;
      if (timer) clearTimeout(timer);
      await heartbeatInFlight;
    }
    if (heartbeatError) throw heartbeatError;
    return result;
  }

  async function acquireNext(raw: unknown, options: Readonly<{ now?: Date }> = {}) {
    const input = AcquireInputSchema.parse(raw);
    // `now` remains a validated compatibility input only. Evidence, lease, and
    // coordinator lifecycle authority all use PostgreSQL wall time.
    if (options.now) validTime(options.now);
    const excludedDispatchIds: string[] = [];
    for (;;) {
      const discoveredAt = await readDatabaseWallClock(
        sql,
        "V3_EVIDENCE_ONLY_DB_TIME_UNAVAILABLE",
      );
      const candidate = await discoverCandidate(sql, input, discoveredAt, excludedDispatchIds);
      if (!candidate) return undefined;
      excludedDispatchIds.push(candidate.dispatch_id);
      const lease = await acquireCandidate(sql, input, candidate, discoveredAt);
      if (lease) return lease;
    }
  }

  async function loadReplayEvidence(
    context: V3EvidenceOnlyAttemptContext,
  ): Promise<Readonly<{ bundle: EvidenceBundleV2; findingSet?: FindingSetV1 }>> {
    const bundleHashes = bundleRefs(context.attempt.evidenceRefs);
    const findingHashes = findingSetRefs(context.attempt.evidenceRefs);
    if (bundleHashes.length !== 1 || findingHashes.length > 1) {
      fail("V3_EVIDENCE_ONLY_REPLAY_REFS_AMBIGUOUS", "terminal attempt does not name one exact typed evidence result");
    }
    const bundle = await findings.findEvidenceBundle(bundleHashes[0]!);
    if (!bundle || computeEvidenceBundleHash(bundle) !== bundleHashes[0]) {
      fail("V3_EVIDENCE_ONLY_REPLAY_BUNDLE_MISSING", "terminal attempt evidence bundle is absent or corrupt");
    }
    const findingSet = findingHashes[0]
      ? await findings.findFindingSet(findingHashes[0])
      : undefined;
    if ((bundle.aggregateVerdict === "pass") !== !findingSet) {
      fail("V3_EVIDENCE_ONLY_REPLAY_FINDING_MISMATCH", "terminal bundle and finding-set references disagree");
    }
    return { bundle, ...(findingSet ? { findingSet } : {}) };
  }

  async function runLease(
    rawLease: unknown,
    options: Readonly<{ now?: Date }> = {},
  ): Promise<V3EvidenceOnlyWorkerResult> {
    const lease = LeaseSchema.parse(rawLease);
    if (options.now) validTime(options.now);
    let phase = "attempt_context";
    let terminal = lease.mode === "coordinator_replay";
    try {
      const context = assertAttemptContext(
        lease,
        await dependencies.loadOrReserveAttempt({ lease }),
      );
      let attempt = context.attempt;
      let bundle: EvidenceBundleV2;
      let findingSet: FindingSetV1 | undefined;
      let execution: "executed" | "replayed";

      if (lease.mode === "fresh_execution") {
        phase = "attempt_binding";
        const delivery = await deliveries.findDelivery(lease.dispatchId);
        if (
          !delivery
          || delivery.revisionId !== lease.revisionId
          || delivery.state !== "attempt_reserved"
          || delivery.attemptId !== context.attempt.attemptId
          || delivery.ownerInstanceId !== lease.ownerInstanceId
          || delivery.leaseToken !== lease.leaseToken
          || delivery.executionSliceHash !== context.sliceHash
        ) {
          fail("V3_EVIDENCE_ONLY_DELIVERY_BINDING_MISMATCH", "attempt reservation did not atomically bind the exact delivery");
        }
        const sourceBefore = await dependencies.captureSource(context.workdir);
        if (!sameRevision(sourceBefore, lease.sourceRevision)) {
          fail("V3_EVIDENCE_ONLY_SOURCE_BEFORE_MISMATCH", "evidence worktree differs from the dispatch source fence");
        }
        await publication.markRunning({
          lease: publicationLease(lease),
          attempt: context.attempt,
        });

        phase = "evidence_execution";
        const result = await withEvidenceOwnerHeartbeat(
          lease,
          context,
          () => dependencies.executeEvidence({ lease, context }),
        );
        const sourceAfter = await dependencies.captureSource(context.workdir);
        if (!sameRevision(sourceAfter, lease.sourceRevision)) {
          fail("V3_EVIDENCE_ONLY_SOURCE_MUTATED", "evidence-only execution changed product source");
        }
        bundle = assertCanonicalEvidence({ lease, context, result });
        findingSet = createFindingSetFromEvidenceBundleV2({
          workdir: context.workdir,
          slice: context.slice,
          sliceHash: context.sliceHash,
          bundle,
        });
        if ((bundle.aggregateVerdict === "pass") !== !findingSet) {
          fail("V3_EVIDENCE_ONLY_FINDING_SET_MISMATCH", "typed findings do not exactly match the evidence verdict");
        }

        phase = "evidence_terminal_publication";
        const bundleHash = computeEvidenceBundleHash(bundle);
        await publication.completeAttempt({
          lease: publicationLease(lease),
          attempt: context.attempt,
          disposition: disposition(bundle),
          bundle,
          ...(findingSet ? { findingSet } : {}),
        });
        const completed = await attempts.findById(context.attempt.attemptId);
        if (!completed || !terminalAttemptDisposition(completed.disposition) || completed.outputHash !== bundleHash) {
          fail("V3_EVIDENCE_ONLY_ATTEMPT_COMPLETION_MISSING", "atomic evidence terminalization is not durably readable");
        }
        attempt = completed;
        terminal = true;
        execution = "executed";
      } else {
        phase = "coordinator_replay_load";
        const replay = await loadReplayEvidence(context);
        bundle = replay.bundle;
        findingSet = replay.findingSet;
        execution = "replayed";
      }

      phase = "claim_completion";
      await dependencies.completeClaim({
        lease,
        attempt,
        diagnostic: `Canonical evidence-only attempt ${attempt.attemptId} is terminal.`,
      });
      await assertClaimClosed(sql, lease, attempt);

      phase = "recovery_coordination";
      const bundleHash = computeEvidenceBundleHash(bundle);
      const failureClass = classifyV3EvidenceFailure(bundle);
      const coordinated = await coordinator.coordinate({
        kind: "recovery_evidence",
        recoveryCaseId: lease.recoveryCaseId,
        revisionId: lease.revisionId,
        dispatchId: lease.dispatchId,
        attemptId: attempt.attemptId,
        slice: context.slice,
        sliceHash: context.sliceHash,
        evidencePlan: context.evidencePlan,
        evidencePlanArtifactHash: context.evidencePlanArtifactHash,
        evidenceBundle: bundle,
        ...(findingSet ? { findingSet } : {}),
        ...(failureClass ? { failureClass } : {}),
      });
      return {
        lease,
        attemptId: attempt.attemptId,
        evidenceBundleHash: bundleHash,
        execution,
        coordinator: coordinated,
      };
    } catch (error) {
      // Once an evidence result is terminal and durable, leave the exact
      // running delivery replayable. Before that boundary, any ambiguity is
      // quarantined as a blocked delivery; the worker never speculatively
      // repeats machine evidence on unchanged source.
      if (!terminal) {
        await quarantineDelivery({ sql, lease, phase, error }).catch(() => undefined);
      }
      if (error instanceof V3EvidenceOnlyWorkerError) throw error;
      fail("V3_EVIDENCE_ONLY_WORKER_FAILED", `${phase}:${compactDiagnostic(error)}`, error);
    }
  }

  return Object.freeze({
    acquireNext,
    runLease,
    async runNext(
      raw: unknown,
      options: Readonly<{ now?: Date }> = {},
    ): Promise<V3EvidenceOnlyWorkerResult | undefined> {
      const lease = await acquireNext(raw, options);
      return lease ? runLease(lease, options) : undefined;
    },
  });
}
