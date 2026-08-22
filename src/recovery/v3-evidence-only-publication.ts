import type postgres from "postgres";
import { z } from "zod";

import { readDatabaseWallClock } from "../db/database-wall-clock.js";
import type { PgTransactionSql } from "../db-pg.js";
import {
  reserveAttemptInTransaction,
  type AttemptReservationResult,
} from "../execution/attempt-repository.js";
import type {
  ExecutionAttemptV1,
  TerminalAttemptDispositionV1,
} from "../execution/schemas/execution-attempt-v1.js";
import {
  EvidenceBundleV2Schema,
  computeEvidenceBundleHash,
  type EvidenceBundleV2,
} from "../evidence/evidence-bundle-v2.js";
import { FindingSetV1Schema, type FindingSetV1 } from "../findings/finding-set.js";
import { canonicalJsonStringify, hashCanonicalJson } from "../product-compiler/canonical-json.js";
import { Sha256Schema } from "../product-compiler/schemas/common-v1.js";
import { lockV3RecoveryRunMutationAuthorityInTransaction } from "./v3-recovery-run-mutation-authority.js";

type Sql = postgres.Sql;
type TransactionSql = postgres.TransactionSql;

const BoundedIdentitySchema = z.string().min(1).max(500);
const RefKeySchema = z.string().min(1).max(160).regex(/^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)*$/);

const PreparedPublicationSchema = z.object({
  compilationReportHash: Sha256Schema,
  sliceHash: Sha256Schema,
  sliceRefKey: RefKeySchema,
  evidencePlanArtifactHash: Sha256Schema,
  evidencePlanRefKey: RefKeySchema,
  worktree: z.string().min(1).max(4_000),
  branch: z.string().min(1).max(1_000).optional(),
  role: BoundedIdentitySchema.default("evidence-orchestrator"),
  agentId: BoundedIdentitySchema,
  evidenceRefs: z.array(BoundedIdentitySchema).max(995),
}).strict();

export type V3EvidenceOnlyPreparedPublicationV1 = z.infer<typeof PreparedPublicationSchema>;

export type V3EvidenceOnlyPublicationLeaseV1 = Readonly<{
  mode: "fresh_execution";
  runId: string;
  stepDbId: string;
  storyDbId: string;
  storyId: string;
  recoveryCaseId: string;
  revisionId: string;
  dispatchId: string;
  packetHash: string;
  contractSliceHash: string;
  findingSetHash: string;
  sourceRevision: Readonly<{ sha: string; treeHash: string }>;
  evidencePlan: readonly string[];
  priorEvidencePlanArtifactHash?: string;
  ownerInstanceId: string;
  leaseToken: string;
  leaseExpiresAt: string;
}>;

type ExactPublicationRow = Readonly<{
  run_status: string;
  run_protocol: string;
  run_packet_hash: string | null;
  step_db_id: string;
  step_status: string;
  step_type: string;
  story_db_id: string;
  story_status: string;
  story_claimed_by: string | null;
  story_claimed_at: Date | string | null;
  case_status: string;
  case_owner: string;
  current_revision_id: string | null;
  revision_owner: string;
  revision_packet_hash: string;
  revision_contract_slice_hash: string;
  revision_finding_set_hash: string;
  revision_source_sha: string;
  revision_source_tree_hash: string;
  revision_expected_delta: unknown;
  revision_allowed_paths: unknown;
  dispatch_class: string;
  delivery_state: string;
  delivery_owner_instance_id: string | null;
  delivery_lease_token: string | null;
  delivery_lease_expires_at: Date | string | null;
  delivery_attempt_id: string | null;
  delivery_claim_id: string | number | null;
  delivery_execution_slice_hash: string | null;
  delivery_attempt_count: number;
}>;

type BoundEvidenceAttemptRow = Readonly<{
  attempt_id: string;
  attempt_claim_id: string | number | null;
  attempt_generation: number;
  attempt_fence_token: string;
  attempt_disposition: string;
  attempt_agent_id: string | null;
  attempt_packet_hash: string | null;
  attempt_slice_hash: string | null;
  attempt_finding_set_hash: string | null;
  attempt_source_before_sha: string;
  attempt_source_before_tree_hash: string;
  attempt_source_after_sha: string | null;
  attempt_source_after_tree_hash: string | null;
  attempt_lease_expires_at: Date | string;
  delivery_state: string;
  delivery_owner_instance_id: string | null;
  delivery_lease_token: string | null;
  delivery_lease_expires_at: Date | string | null;
  delivery_attempt_id: string | null;
  delivery_claim_id: string | number | null;
  delivery_execution_slice_hash: string | null;
  delivery_attempt_count: number;
  claim_agent_id: string;
  claim_outcome: string | null;
  run_status: string;
  run_protocol: string;
  run_packet_hash: string | null;
  story_status: string;
  story_claimed_by: string | null;
  story_claimed_at: Date | string | null;
  step_status: string;
  step_type: string;
  recovery_status: string;
  recovery_owner: string;
  current_revision_id: string | null;
  dispatch_class: string;
  dispatch_packet_hash: string;
  dispatch_finding_set_hash: string;
  dispatch_source_sha: string;
  dispatch_source_tree_hash: string;
}>;

export class V3EvidenceOnlyPublicationError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(`${code}:${message}`);
    this.name = "V3EvidenceOnlyPublicationError";
    this.code = code;
  }
}

function fail(code: string, message: string): never {
  throw new V3EvidenceOnlyPublicationError(code, message);
}

function millis(value: Date | string | null): number {
  if (value === null) return Number.NaN;
  const parsed = value instanceof Date ? value.getTime() : Date.parse(value);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function validTime(value?: Date): Date {
  const parsed = new Date(value ?? new Date());
  if (!Number.isFinite(parsed.getTime())) fail("V3_EVIDENCE_ONLY_PUBLICATION_TIME_INVALID", "publication time is invalid");
  return parsed;
}

function jsonEquals(raw: unknown, expected: unknown): boolean {
  const parsed = typeof raw === "string" ? JSON.parse(raw) as unknown : raw;
  return canonicalJsonStringify(parsed) === canonicalJsonStringify(expected);
}

async function putEvidenceBundleInTransaction(
  transaction: TransactionSql,
  bundle: EvidenceBundleV2,
): Promise<string> {
  const bundleHash = computeEvidenceBundleHash(bundle);
  await transaction.unsafe("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [bundleHash]);
  const inserted = await transaction.unsafe<Array<{ evidence_bundle_hash: string }>>(
    `INSERT INTO evidence_bundles (
       evidence_bundle_hash, evidence_id, run_id, story_id, packet_hash, slice_hash,
       source_sha, source_tree_hash, attempt_id, aggregate_verdict, payload
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::text::jsonb)
     ON CONFLICT (evidence_bundle_hash) DO NOTHING
     RETURNING evidence_bundle_hash`,
    [
      bundleHash,
      bundle.evidenceId,
      bundle.runId,
      bundle.storyId,
      bundle.packetHash,
      bundle.sliceHash,
      bundle.sourceRevision.sha,
      bundle.sourceRevision.treeHash,
      bundle.attemptId ?? null,
      bundle.aggregateVerdict,
      JSON.stringify(bundle),
    ],
  );
  if (inserted.length === 0) {
    const rows = await transaction.unsafe<Array<{ payload: unknown }>>(
      "SELECT payload FROM evidence_bundles WHERE evidence_bundle_hash = $1 FOR KEY SHARE",
      [bundleHash],
    );
    if (
      rows.length !== 1
      || canonicalJsonStringify(EvidenceBundleV2Schema.parse(rows[0]!.payload)) !== canonicalJsonStringify(bundle)
    ) {
      fail("V3_EVIDENCE_ONLY_BUNDLE_HASH_COLLISION", "existing evidence bundle differs from the canonical payload");
    }
  }
  return bundleHash;
}

async function putFindingSetInTransaction(
  transaction: TransactionSql,
  findingSet: FindingSetV1,
): Promise<void> {
  await transaction.unsafe("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [
    findingSet.findingSetHash,
  ]);
  const inserted = await transaction.unsafe<Array<{ finding_set_hash: string }>>(
    `INSERT INTO finding_sets (
       finding_set_hash, finding_set_id, run_id, story_id, packet_hash, slice_hash,
       source_sha, source_tree_hash, finding_ids, payload
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::text::jsonb, $10::text::jsonb)
     ON CONFLICT (finding_set_hash) DO NOTHING
     RETURNING finding_set_hash`,
    [
      findingSet.findingSetHash,
      findingSet.findingSetId,
      findingSet.runId,
      findingSet.storyId,
      findingSet.packetHash,
      findingSet.sliceHash,
      findingSet.sourceRevision.sha,
      findingSet.sourceRevision.treeHash,
      JSON.stringify(findingSet.findings.map((finding) => finding.findingId)),
      JSON.stringify(findingSet),
    ],
  );
  if (inserted.length === 0) {
    const rows = await transaction.unsafe<Array<{ payload: unknown }>>(
      "SELECT payload FROM finding_sets WHERE finding_set_hash = $1 FOR KEY SHARE",
      [findingSet.findingSetHash],
    );
    if (
      rows.length !== 1
      || canonicalJsonStringify(FindingSetV1Schema.parse(rows[0]!.payload)) !== canonicalJsonStringify(findingSet)
    ) {
      fail("V3_EVIDENCE_ONLY_FINDING_HASH_COLLISION", "existing finding set differs from the canonical payload");
    }
    return;
  }
  for (const finding of findingSet.findings) {
    await transaction.unsafe(
      `INSERT INTO findings (
         finding_set_hash, finding_id, origin, classification, invariant_ref,
         status, source_fingerprint, payload
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::text::jsonb)`,
      [
        findingSet.findingSetHash,
        finding.findingId,
        finding.origin,
        finding.classification,
        finding.invariantRef,
        finding.status,
        hashCanonicalJson(finding.sourceLocators),
        JSON.stringify(finding),
      ],
    );
  }
}

async function lockStory(
  transaction: TransactionSql,
  lease: V3EvidenceOnlyPublicationLeaseV1,
): Promise<void> {
  try {
    await lockV3RecoveryRunMutationAuthorityInTransaction(transaction, {
      runId: lease.runId,
      storyId: lease.storyId,
    });
  } catch (error) {
    const message = String((error as Error)?.message ?? error);
    if (/^V3_RECOVERY_(?:RUN_NOT_ACTIVE|TERMINATION_PENDING):/.test(message)) {
      fail(
        "V3_EVIDENCE_ONLY_PUBLICATION_RUN_NOT_ACTIVE",
        `run or termination owns publication: ${message}`,
      );
    }
    throw error;
  }
}

async function loadExactPublication(
  transaction: TransactionSql,
  lease: V3EvidenceOnlyPublicationLeaseV1,
): Promise<ExactPublicationRow> {
  const rows = await transaction.unsafe<ExactPublicationRow[]>(
    `SELECT run_row.status AS run_status,
            run_row.protocol AS run_protocol,
            run_row.packet_hash AS run_packet_hash,
            step_row.id AS step_db_id,
            step_row.status AS step_status,
            step_row.type AS step_type,
            story_row.id AS story_db_id,
            story_row.status AS story_status,
            story_row.claimed_by AS story_claimed_by,
            story_row.claimed_at AS story_claimed_at,
            recovery_case.status AS case_status,
            recovery_case.owner AS case_owner,
            recovery_case.current_revision_id,
            revision.owner AS revision_owner,
            revision.packet_hash AS revision_packet_hash,
            revision.contract_slice_hash AS revision_contract_slice_hash,
            revision.finding_set_hash AS revision_finding_set_hash,
            revision.source_sha AS revision_source_sha,
            revision.source_tree_hash AS revision_source_tree_hash,
            revision.expected_delta AS revision_expected_delta,
            revision.allowed_paths AS revision_allowed_paths,
            dispatch.dispatch_class,
            delivery.state AS delivery_state,
            delivery.owner_instance_id AS delivery_owner_instance_id,
            delivery.lease_token AS delivery_lease_token,
            delivery.lease_expires_at AS delivery_lease_expires_at,
            delivery.attempt_id AS delivery_attempt_id,
            delivery.claim_id AS delivery_claim_id,
            delivery.execution_slice_hash AS delivery_execution_slice_hash,
            delivery.attempt_count AS delivery_attempt_count
       FROM recovery_dispatch_deliveries delivery
       JOIN recovery_revision_dispatches dispatch
         ON dispatch.dispatch_id = delivery.dispatch_id
        AND dispatch.revision_id = delivery.revision_id
        AND dispatch.recovery_case_id = delivery.recovery_case_id
       JOIN recovery_case_revisions revision
         ON revision.revision_id = delivery.revision_id
        AND revision.recovery_case_id = delivery.recovery_case_id
       JOIN recovery_cases recovery_case
         ON recovery_case.recovery_case_id = delivery.recovery_case_id
        AND recovery_case.current_revision_id = delivery.revision_id
       JOIN finding_sets finding_set
         ON finding_set.finding_set_hash = revision.finding_set_hash
       JOIN runs run_row
         ON run_row.id = delivery.run_id
       JOIN steps step_row
         ON step_row.id = $4
        AND step_row.run_id = delivery.run_id
        AND step_row.step_id = 'implement'
       JOIN stories story_row
         ON story_row.id = $5
        AND story_row.run_id = delivery.run_id
        AND story_row.story_id = delivery.story_id
      WHERE delivery.dispatch_id = $1
        AND delivery.revision_id = $2
        AND delivery.recovery_case_id = $3
        AND delivery.run_id = $6
        AND delivery.story_id = $7
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
      FOR UPDATE OF delivery, recovery_case, step_row, story_row`,
    [
      lease.dispatchId,
      lease.revisionId,
      lease.recoveryCaseId,
      lease.stepDbId,
      lease.storyDbId,
      lease.runId,
      lease.storyId,
    ],
  );
  if (rows.length !== 1) {
    fail("V3_EVIDENCE_ONLY_PUBLICATION_CHAIN_MISMATCH", "delivery is not the exact current run/story/case/revision/finding chain");
  }
  return rows[0]!;
}

async function loadBoundEvidenceAttempt(
  transaction: TransactionSql,
  lease: V3EvidenceOnlyPublicationLeaseV1,
  attempt: ExecutionAttemptV1,
): Promise<BoundEvidenceAttemptRow> {
  const rows = await transaction.unsafe<BoundEvidenceAttemptRow[]>(
    `SELECT attempt.attempt_id,
            attempt.claim_id AS attempt_claim_id,
            attempt.generation AS attempt_generation,
            attempt.fence_token AS attempt_fence_token,
            attempt.disposition AS attempt_disposition,
            attempt.agent_id AS attempt_agent_id,
            attempt.packet_hash AS attempt_packet_hash,
            attempt.slice_hash AS attempt_slice_hash,
            attempt.finding_set_hash AS attempt_finding_set_hash,
            attempt.source_before_sha AS attempt_source_before_sha,
            attempt.source_before_tree_hash AS attempt_source_before_tree_hash,
            attempt.source_after_sha AS attempt_source_after_sha,
            attempt.source_after_tree_hash AS attempt_source_after_tree_hash,
            attempt.lease_expires_at AS attempt_lease_expires_at,
            delivery.state AS delivery_state,
            delivery.owner_instance_id AS delivery_owner_instance_id,
            delivery.lease_token AS delivery_lease_token,
            delivery.lease_expires_at AS delivery_lease_expires_at,
            delivery.attempt_id AS delivery_attempt_id,
            delivery.claim_id AS delivery_claim_id,
            delivery.execution_slice_hash AS delivery_execution_slice_hash,
            delivery.attempt_count AS delivery_attempt_count,
            claim.agent_id AS claim_agent_id,
            claim.outcome AS claim_outcome,
            run_row.status AS run_status,
            run_row.protocol AS run_protocol,
            run_row.packet_hash AS run_packet_hash,
            story.status AS story_status,
            story.claimed_by AS story_claimed_by,
            story.claimed_at AS story_claimed_at,
            step.status AS step_status,
            step.type AS step_type,
            recovery_case.status AS recovery_status,
            recovery_case.owner AS recovery_owner,
            recovery_case.current_revision_id,
            dispatch.dispatch_class,
            dispatch.packet_hash AS dispatch_packet_hash,
            dispatch.finding_set_hash AS dispatch_finding_set_hash,
            dispatch.source_sha AS dispatch_source_sha,
            dispatch.source_tree_hash AS dispatch_source_tree_hash
       FROM execution_attempts attempt
       JOIN recovery_dispatch_deliveries delivery
         ON delivery.attempt_id = attempt.attempt_id
        AND delivery.dispatch_id = attempt.recovery_dispatch_id
        AND delivery.revision_id = attempt.recovery_case_revision_id
       JOIN recovery_revision_dispatches dispatch
         ON dispatch.dispatch_id = delivery.dispatch_id
        AND dispatch.revision_id = delivery.revision_id
       JOIN recovery_cases recovery_case
         ON recovery_case.recovery_case_id = delivery.recovery_case_id
       JOIN claim_log claim
         ON claim.id = attempt.claim_id
       JOIN runs run_row
         ON run_row.id = attempt.run_id
       JOIN stories story
         ON story.id = $6
        AND story.run_id = attempt.run_id
        AND story.story_id = attempt.story_id
       JOIN steps step
         ON step.id = $7
        AND step.run_id = attempt.run_id
        AND step.step_id = attempt.step_id
      WHERE attempt.attempt_id = $1
        AND attempt.run_id = $2
        AND attempt.step_id = 'implement'
        AND attempt.story_id = $3
        AND attempt.recovery_dispatch_id = $4
        AND attempt.recovery_case_revision_id = $5
        AND delivery.recovery_case_id = $8
        AND claim.run_id = attempt.run_id
        AND claim.step_id = attempt.step_id
        AND claim.story_id = attempt.story_id
        AND recovery_case.current_revision_id = delivery.revision_id
      FOR UPDATE OF attempt, delivery, claim, story, step, recovery_case`,
    [
      attempt.attemptId,
      lease.runId,
      lease.storyId,
      lease.dispatchId,
      lease.revisionId,
      lease.storyDbId,
      lease.stepDbId,
      lease.recoveryCaseId,
    ],
  );
  if (rows.length !== 1) {
    fail("V3_EVIDENCE_ONLY_BOUND_ATTEMPT_MISSING", "attempt is not the exact bound non-model recovery owner");
  }
  return rows[0]!;
}

function assertBoundEvidenceAttempt(
  row: BoundEvidenceAttemptRow,
  lease: V3EvidenceOnlyPublicationLeaseV1,
  attempt: ExecutionAttemptV1,
): void {
  const claim = Number(row.attempt_claim_id);
  if (
    !attempt.claimId
    || !Number.isSafeInteger(claim)
    || claim !== attempt.claimId
    || Number(row.delivery_claim_id) !== claim
    || row.delivery_attempt_id !== attempt.attemptId
    || row.delivery_execution_slice_hash !== attempt.sliceHash
    || row.delivery_attempt_count !== 1
    || row.delivery_owner_instance_id !== lease.ownerInstanceId
    || row.delivery_lease_token !== lease.leaseToken
    || row.attempt_generation !== attempt.generation
    || row.attempt_fence_token !== attempt.fenceToken
    || row.attempt_agent_id !== attempt.agentId
    || row.claim_agent_id !== attempt.agentId
    || row.run_status !== "running" && row.run_status !== "resuming"
    || row.run_protocol !== "v3"
    || row.run_packet_hash !== lease.packetHash
    || row.attempt_packet_hash !== lease.packetHash
    || row.attempt_slice_hash !== lease.contractSliceHash
    || row.attempt_finding_set_hash !== lease.findingSetHash
    || row.attempt_source_before_sha !== lease.sourceRevision.sha
    || row.attempt_source_before_tree_hash !== lease.sourceRevision.treeHash
    || row.story_status !== "failed"
    || row.story_claimed_by !== null
    || row.story_claimed_at !== null
    || row.step_type !== "loop"
    || !["pending", "running"].includes(row.step_status)
    || row.recovery_status !== "evidencing"
    || row.recovery_owner !== "infrastructure"
    || row.current_revision_id !== lease.revisionId
    || row.dispatch_class !== "evidence_only"
    || row.dispatch_packet_hash !== lease.packetHash
    || row.dispatch_finding_set_hash !== lease.findingSetHash
    || row.dispatch_source_sha !== lease.sourceRevision.sha
    || row.dispatch_source_tree_hash !== lease.sourceRevision.treeHash
  ) {
    fail("V3_EVIDENCE_ONLY_BOUND_ATTEMPT_MISMATCH", "claim, attempt, delivery, story, revision or source fence is no longer exact");
  }
}

function assertExactLease(
  row: ExactPublicationRow,
  lease: V3EvidenceOnlyPublicationLeaseV1,
  now: Date,
): void {
  if (
    row.run_protocol !== "v3"
    || !["running", "resuming"].includes(row.run_status)
    || row.run_packet_hash !== lease.packetHash
    || row.step_db_id !== lease.stepDbId
    || row.step_type !== "loop"
    || !["pending", "running"].includes(row.step_status)
    || row.story_db_id !== lease.storyDbId
    || row.story_status !== "failed"
    || row.case_status !== "evidencing"
    || row.case_owner !== "infrastructure"
    || row.current_revision_id !== lease.revisionId
    || row.revision_owner !== "infrastructure"
    || row.revision_packet_hash !== lease.packetHash
    || row.revision_contract_slice_hash !== lease.contractSliceHash
    || row.revision_finding_set_hash !== lease.findingSetHash
    || row.revision_source_sha !== lease.sourceRevision.sha
    || row.revision_source_tree_hash !== lease.sourceRevision.treeHash
    || !jsonEquals(row.revision_expected_delta, {
      kind: "evidence_refresh",
      predicateRefs: lease.evidencePlan,
    })
    || !jsonEquals(row.revision_allowed_paths, [])
    || row.dispatch_class !== "evidence_only"
  ) {
    fail("V3_EVIDENCE_ONLY_PUBLICATION_AUTHORITY_MISMATCH", "only the exact infrastructure-owned evidence refresh may publish a non-model attempt");
  }
  if (
    row.delivery_state !== "leased"
    || row.delivery_owner_instance_id !== lease.ownerInstanceId
    || row.delivery_lease_token !== lease.leaseToken
    || millis(row.delivery_lease_expires_at) !== Date.parse(lease.leaseExpiresAt)
    || millis(row.delivery_lease_expires_at) <= now.getTime()
    || row.delivery_attempt_id !== null
    || row.delivery_claim_id !== null
    || row.delivery_execution_slice_hash !== null
    || row.delivery_attempt_count !== 0
  ) {
    fail("V3_EVIDENCE_ONLY_PUBLICATION_LEASE_INVALID", "publication does not own the exact unreserved evidence-only lease");
  }
}

async function assertIndexedArtifacts(
  transaction: TransactionSql,
  lease: V3EvidenceOnlyPublicationLeaseV1,
  prepared: V3EvidenceOnlyPreparedPublicationV1,
): Promise<void> {
  const rows = await transaction.unsafe<Array<{
    slice_type: string;
    plan_type: string;
    slice_ref_hash: string;
    plan_ref_hash: string;
  }>>(
    `SELECT slice_artifact.artifact_type AS slice_type,
            plan_artifact.artifact_type AS plan_type,
            slice_ref.artifact_hash AS slice_ref_hash,
            plan_ref.artifact_hash AS plan_ref_hash
       FROM semantic_artifacts slice_artifact
       JOIN semantic_artifacts plan_artifact
         ON plan_artifact.artifact_hash = $2
       JOIN run_artifact_refs slice_ref
         ON slice_ref.run_id = $3
        AND slice_ref.ref_key = $4
        AND slice_ref.artifact_hash = slice_artifact.artifact_hash
       JOIN run_artifact_refs plan_ref
         ON plan_ref.run_id = $3
        AND plan_ref.ref_key = $5
        AND plan_ref.artifact_hash = plan_artifact.artifact_hash
      WHERE slice_artifact.artifact_hash = $1`,
    [
      prepared.sliceHash,
      prepared.evidencePlanArtifactHash,
      lease.runId,
      prepared.sliceRefKey,
      prepared.evidencePlanRefKey,
    ],
  );
  if (
    rows.length !== 1
    || rows[0]!.slice_type !== "setfarm.implementation-slice.v1"
    || rows[0]!.plan_type !== "setfarm.evidence-plan.v1"
    || rows[0]!.slice_ref_hash !== prepared.sliceHash
    || rows[0]!.plan_ref_hash !== prepared.evidencePlanArtifactHash
  ) {
    fail("V3_EVIDENCE_ONLY_PUBLICATION_ARTIFACT_INDEX_MISMATCH", "clean slice and evidence plan must be durable CAS/index run references before attempt publication");
  }
}

export function createV3EvidenceOnlyPublication(sql: Sql) {
  return Object.freeze({
    async reserve(
      lease: V3EvidenceOnlyPublicationLeaseV1,
      rawPrepared: unknown,
      options: Readonly<{ now?: Date; attemptLeaseMs?: number }> = {},
    ): Promise<ExecutionAttemptV1> {
      if (lease.mode !== "fresh_execution") {
        fail("V3_EVIDENCE_ONLY_PUBLICATION_FRESH_REQUIRED", "terminal replay must load its existing attempt instead of publishing another claim");
      }
      const prepared = PreparedPublicationSchema.parse(rawPrepared);
      validTime(options.now);
      if (
        prepared.sliceHash !== lease.contractSliceHash
        || (lease.priorEvidencePlanArtifactHash !== undefined
          && prepared.evidencePlanArtifactHash !== lease.priorEvidencePlanArtifactHash)
      ) {
        fail(
          "V3_EVIDENCE_ONLY_PUBLICATION_SEALED_ARTIFACT_MISMATCH",
          "evidence refresh must republish the exact clean contract slice and its exact derived evidence plan",
        );
      }
      return sql.begin(async (transaction) => {
        await lockStory(transaction, lease);
        const row = await loadExactPublication(transaction, lease);
        const terminations = await transaction.unsafe<Array<{ request_id: string }>>(
          `SELECT request_id
             FROM run_termination_requests
            WHERE run_id = $1 AND state <> 'terminalized'
            LIMIT 1 FOR UPDATE`,
          [lease.runId],
        );
        if (terminations.length > 0) {
          fail("V3_EVIDENCE_ONLY_PUBLICATION_TERMINATION_PENDING", "run termination owns the next lifecycle transition");
        }
        const openClaims = await transaction.unsafe<Array<{ id: string }>>(
          `SELECT id::text
             FROM claim_log
            WHERE run_id = $1
              AND step_id = 'implement'
              AND story_id = $2
              AND outcome IS NULL
            FOR UPDATE`,
          [lease.runId, lease.storyId],
        );
        if (openClaims.length > 0) {
          fail("V3_EVIDENCE_ONLY_PUBLICATION_OPEN_CLAIM_CONFLICT", "failed story already has an operational claim owner");
        }
        const runtimes = await transaction.unsafe<Array<{ session_id: string }>>(
          `SELECT session_id
             FROM runtime_sessions
            WHERE run_id = $1
              AND story_id = $2
              AND state <> 'released'
            LIMIT 1 FOR UPDATE`,
          [lease.runId, lease.storyId],
        );
        if (runtimes.length > 0) {
          fail("V3_EVIDENCE_ONLY_PUBLICATION_RUNTIME_FORBIDDEN", "evidence-only publication never owns a model runtime session");
        }
        await assertIndexedArtifacts(transaction, lease, prepared);
        const now = await readDatabaseWallClock(
          transaction,
          "V3_EVIDENCE_ONLY_PUBLICATION_DATABASE_TIME_UNAVAILABLE",
        );
        assertExactLease(row, lease, now);

        const claimIdRows = await (transaction as PgTransactionSql)<Array<{ id: unknown }>>`
          SELECT nextval(pg_get_serial_sequence('claim_log','id'))::bigint::text AS id
        `;
        const claimBirthPorts = await import("../execution/claim-runtime-publication.js");
        const claimBirth = await claimBirthPorts.prepareInternalProductionClaimBirthV1(
          transaction as PgTransactionSql,
          "a-claim-v3-evidence-only-v1",
          claimIdRows,
        );
        const claimId = await claimBirthPorts.insertAndBindInternalProductionClaimBirthV1(
          transaction as PgTransactionSql,
          claimBirth,
          {
            runId: lease.runId,
            workflowStepId: "implement",
            storyId: lease.storyId,
            claimAgentId: prepared.agentId,
            claimedAt: now,
          },
        );
        const reserved: AttemptReservationResult = await reserveAttemptInTransaction(transaction, {
          claimId,
          runId: lease.runId,
          stepId: "implement",
          storyId: lease.storyId,
          attemptClass: "evidence_only",
          packetHash: lease.packetHash,
          compilationReportHash: prepared.compilationReportHash,
          sliceHash: prepared.sliceHash,
          sourceBefore: lease.sourceRevision,
          findingSetHash: lease.findingSetHash,
          recoveryCaseRevisionId: lease.revisionId,
          recoveryDispatchId: lease.dispatchId,
          recoveryDeliveryLease: {
            ownerInstanceId: lease.ownerInstanceId,
            leaseToken: lease.leaseToken,
          },
          role: prepared.role,
          agentId: prepared.agentId,
          ...(prepared.branch ? { branch: prepared.branch } : {}),
          worktree: prepared.worktree,
          evidenceRefs: [
            `setfarm://claim-log/${claimBirth.claimIdText}`,
            ...prepared.evidenceRefs,
          ],
        }, {
          now,
          leaseMs: options.attemptLeaseMs
            ?? Math.max(1, Date.parse(lease.leaseExpiresAt) - now.getTime()),
        });
        if (reserved.status !== "reserved") {
          fail("V3_EVIDENCE_ONLY_PUBLICATION_ATTEMPT_CONFLICT", `exact evidence-only reservation returned ${reserved.status}`);
        }
        if (
          reserved.attempt.claimId !== claimId
          || reserved.attempt.attemptClass !== "evidence_only"
          || reserved.attempt.recoveryDispatchId !== lease.dispatchId
          || reserved.attempt.recoveryCaseRevisionId !== lease.revisionId
          || reserved.attempt.sliceHash !== prepared.sliceHash
          || reserved.attempt.worktree !== prepared.worktree
        ) {
          fail("V3_EVIDENCE_ONLY_PUBLICATION_BINDING_MISMATCH", "claim, attempt and delivery did not bind the exact prepared evidence identity");
        }
        return reserved.attempt;
      }) as Promise<ExecutionAttemptV1>;
    },

    async markRunning(input: Readonly<{
      lease: V3EvidenceOnlyPublicationLeaseV1;
      attempt: ExecutionAttemptV1;
      now?: Date;
    }>): Promise<void> {
      validTime(input.now);
      await sql.begin(async (transaction) => {
        await lockStory(transaction, input.lease);
        const row = await loadBoundEvidenceAttempt(transaction, input.lease, input.attempt);
        assertBoundEvidenceAttempt(row, input.lease, input.attempt);
        const now = await readDatabaseWallClock(
          transaction,
          "V3_EVIDENCE_ONLY_PUBLICATION_DATABASE_TIME_UNAVAILABLE",
        );
        if (
          row.claim_outcome !== null
          || millis(row.delivery_lease_expires_at) <= now.getTime()
          || millis(row.attempt_lease_expires_at) <= now.getTime()
          || !["attempt_reserved", "running"].includes(row.delivery_state)
          || !["claimed", "running"].includes(row.attempt_disposition)
        ) {
          fail("V3_EVIDENCE_ONLY_RUNNING_OWNER_INVALID", "only one live exact claim/attempt/delivery owner may enter running");
        }
        if (row.attempt_disposition === "claimed") {
          const attempts = await transaction.unsafe<Array<{ attempt_id: string }>>(
            `UPDATE execution_attempts
                SET disposition = 'running', heartbeat_at = $4, updated_at = $4
              WHERE attempt_id = $1
                AND generation = $2
                AND fence_token = $3
                AND disposition = 'claimed'
                AND lease_expires_at > $4
              RETURNING attempt_id`,
            [input.attempt.attemptId, input.attempt.generation, input.attempt.fenceToken, now],
          );
          if (attempts.length !== 1) {
            fail("V3_EVIDENCE_ONLY_RUNNING_ATTEMPT_CAS_LOST", "attempt changed before atomic running publication");
          }
        }
        if (row.delivery_state === "attempt_reserved") {
          const deliveries = await transaction.unsafe<Array<{ dispatch_id: string }>>(
            `UPDATE recovery_dispatch_deliveries
                SET state = 'running', updated_at = $6
              WHERE dispatch_id = $1
                AND revision_id = $2
                AND attempt_id = $3
                AND owner_instance_id = $4
                AND lease_token = $5
                AND state = 'attempt_reserved'
                AND lease_expires_at > $6
              RETURNING dispatch_id`,
            [
              input.lease.dispatchId,
              input.lease.revisionId,
              input.attempt.attemptId,
              input.lease.ownerInstanceId,
              input.lease.leaseToken,
              now,
            ],
          );
          if (deliveries.length !== 1) {
            fail("V3_EVIDENCE_ONLY_RUNNING_DELIVERY_CAS_LOST", "delivery changed before atomic running publication");
          }
        }
      });
    },

    async completeAttempt(input: Readonly<{
      lease: V3EvidenceOnlyPublicationLeaseV1;
      attempt: ExecutionAttemptV1;
      disposition: TerminalAttemptDispositionV1;
      bundle: EvidenceBundleV2;
      findingSet?: FindingSetV1;
      now?: Date;
    }>): Promise<void> {
      validTime(input.now);
      const bundle = EvidenceBundleV2Schema.parse(input.bundle);
      const findingSet = input.findingSet === undefined
        ? undefined
        : FindingSetV1Schema.parse(input.findingSet);
      const bundleHash = computeEvidenceBundleHash(bundle);
      if (
        bundle.attemptId !== input.attempt.attemptId
        || bundle.runId !== input.lease.runId
        || bundle.storyId !== input.lease.storyId
        || bundle.packetHash !== input.lease.packetHash
        || bundle.sliceHash !== input.attempt.sliceHash
        || bundle.sourceRevision.sha !== input.lease.sourceRevision.sha
        || bundle.sourceRevision.treeHash !== input.lease.sourceRevision.treeHash
        || bundle.aggregateVerdict === "incomplete"
        || (bundle.aggregateVerdict === "pass") !== (findingSet === undefined)
        || (bundle.aggregateVerdict === "pass" && input.disposition !== "verified")
        || (bundle.aggregateVerdict === "fail" && input.disposition !== "no_progress")
      ) {
        fail("V3_EVIDENCE_ONLY_TERMINAL_EVIDENCE_MISMATCH", "terminal disposition, evidence bundle and exact source identity disagree");
      }
      if (findingSet && (
        findingSet.runId !== bundle.runId
        || findingSet.storyId !== bundle.storyId
        || findingSet.packetHash !== bundle.packetHash
        || findingSet.sliceHash !== bundle.sliceHash
        || findingSet.sourceRevision.sha !== bundle.sourceRevision.sha
        || findingSet.sourceRevision.treeHash !== bundle.sourceRevision.treeHash
      )) {
        fail("V3_EVIDENCE_ONLY_TERMINAL_FINDING_MISMATCH", "typed finding set differs from its canonical evidence bundle fence");
      }
      await sql.begin(async (transaction) => {
        await lockStory(transaction, input.lease);
        const row = await loadBoundEvidenceAttempt(transaction, input.lease, input.attempt);
        assertBoundEvidenceAttempt(row, input.lease, input.attempt);
        const now = await readDatabaseWallClock(
          transaction,
          "V3_EVIDENCE_ONLY_PUBLICATION_DATABASE_TIME_UNAVAILABLE",
        );
        if (
          row.delivery_state !== "running"
          || row.claim_outcome !== null
          || !["claimed", "running"].includes(row.attempt_disposition)
          || millis(row.delivery_lease_expires_at) <= now.getTime()
          || millis(row.attempt_lease_expires_at) <= now.getTime()
          || (
            row.attempt_source_after_sha !== null
            && (
              row.attempt_source_after_sha !== input.lease.sourceRevision.sha
              || row.attempt_source_after_tree_hash !== input.lease.sourceRevision.treeHash
            )
          )
        ) {
          fail("V3_EVIDENCE_ONLY_TERMINAL_OWNER_INVALID", "only the exact active unchanged-source owner may publish terminal evidence");
        }
        await putEvidenceBundleInTransaction(transaction, bundle);
        if (findingSet) await putFindingSetInTransaction(transaction, findingSet);
        const evidenceRefs = [
          `setfarm://evidence-bundle/${bundleHash}`,
          ...(findingSet ? [`setfarm://finding-set/${findingSet.findingSetHash}`] : []),
        ];
        const completed = await transaction.unsafe<Array<{ attempt_id: string }>>(
          `UPDATE execution_attempts
              SET disposition = $4,
                  source_after_sha = $5,
                  source_after_tree_hash = $6,
                  output_hash = $7,
                  evidence_refs = (
                    SELECT jsonb_agg(ref.value ORDER BY ref.value)::text
                      FROM (
                        SELECT DISTINCT value
                          FROM jsonb_array_elements_text(
                            execution_attempts.evidence_refs::jsonb || $8::text::jsonb
                          ) AS item(value)
                      ) AS ref
                  ),
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
            input.attempt.attemptId,
            input.attempt.generation,
            input.attempt.fenceToken,
            input.disposition,
            input.lease.sourceRevision.sha,
            input.lease.sourceRevision.treeHash,
            bundleHash,
            JSON.stringify(evidenceRefs),
            now,
          ],
        );
        if (completed.length !== 1) {
          fail("V3_EVIDENCE_ONLY_TERMINAL_ATTEMPT_CAS_LOST", "attempt changed before atomic evidence terminalization");
        }
      });
    },

    async completeClaim(input: Readonly<{
      lease: V3EvidenceOnlyPublicationLeaseV1;
      attempt: ExecutionAttemptV1;
      diagnostic: string;
      now?: Date;
    }>): Promise<void> {
      validTime(input.now);
      const attemptAgentId = input.attempt.agentId;
      if (!input.attempt.claimId) {
        fail("V3_EVIDENCE_ONLY_CLAIM_ID_MISSING", "terminal evidence attempt has no operational claim identity");
      }
      if (!attemptAgentId) {
        fail("V3_EVIDENCE_ONLY_CLAIM_AGENT_MISSING", "terminal evidence attempt has no operational claim agent identity");
      }
      await sql.begin(async (transaction) => {
        await lockStory(transaction, input.lease);
        const rows = await transaction.unsafe<Array<{
          disposition: string;
          claim_id: string | number | null;
          delivery_attempt_id: string | null;
          delivery_claim_id: string | number | null;
          delivery_lease_expires_at: Date | string | null;
          outcome: string | null;
          run_status: string;
          run_protocol: string;
          run_packet_hash: string | null;
        }>>(
          `SELECT attempt.disposition,
                  attempt.claim_id,
                  delivery.attempt_id AS delivery_attempt_id,
                  delivery.claim_id AS delivery_claim_id,
                  delivery.lease_expires_at AS delivery_lease_expires_at,
                  claim.outcome,
                  run_row.status AS run_status,
                  run_row.protocol AS run_protocol,
                  run_row.packet_hash AS run_packet_hash
             FROM execution_attempts attempt
             JOIN runs run_row
               ON run_row.id = attempt.run_id
             JOIN recovery_dispatch_deliveries delivery
               ON delivery.dispatch_id = attempt.recovery_dispatch_id
              AND delivery.revision_id = attempt.recovery_case_revision_id
             JOIN recovery_cases recovery_case
               ON recovery_case.recovery_case_id = delivery.recovery_case_id
              AND recovery_case.current_revision_id = delivery.revision_id
             JOIN claim_log claim
               ON claim.id = attempt.claim_id
              AND claim.run_id = attempt.run_id
              AND claim.step_id = attempt.step_id
              AND claim.story_id = attempt.story_id
            WHERE attempt.attempt_id = $1
              AND attempt.run_id = $2
              AND attempt.step_id = 'implement'
              AND attempt.story_id = $3
              AND attempt.attempt_class = 'evidence_only'
              AND attempt.recovery_dispatch_id = $4
              AND attempt.recovery_case_revision_id = $5
              AND delivery.recovery_case_id = $6
              AND delivery.owner_instance_id = $7
              AND delivery.lease_token = $8
              AND delivery.state IN ('attempt_reserved', 'running')
              AND recovery_case.status = 'evidencing'
              AND recovery_case.owner = 'infrastructure'
            FOR UPDATE OF attempt, claim, delivery, recovery_case`,
          [
            input.attempt.attemptId,
            input.lease.runId,
            input.lease.storyId,
            input.lease.dispatchId,
            input.lease.revisionId,
            input.lease.recoveryCaseId,
            input.lease.ownerInstanceId,
            input.lease.leaseToken,
          ],
        );
        const row = rows[0];
        const now = await readDatabaseWallClock(
          transaction,
          "V3_EVIDENCE_ONLY_PUBLICATION_DATABASE_TIME_UNAVAILABLE",
        );
        const exactClaimId = Number(row?.claim_id);
        if (
          !row
          || !Number.isSafeInteger(exactClaimId)
          || exactClaimId !== input.attempt.claimId
          || Number(row.delivery_claim_id) !== exactClaimId
          || row.delivery_attempt_id !== input.attempt.attemptId
          || millis(row.delivery_lease_expires_at) <= now.getTime()
          || !["running", "resuming"].includes(row.run_status)
          || row.run_protocol !== "v3"
          || row.run_packet_hash !== input.lease.packetHash
          || ["claimed", "running", "superseded"].includes(row.disposition)
        ) {
          fail("V3_EVIDENCE_ONLY_CLAIM_COMPLETION_MISMATCH", "claim close requires the exact terminal evidence-only attempt and delivery binding");
        }
        if (row.outcome !== null) {
          if (row.outcome !== "completed") {
            fail("V3_EVIDENCE_ONLY_CLAIM_OUTCOME_CONFLICT", `operational claim is already ${row.outcome}`);
          }
          return;
        }
        const closed = await transaction.unsafe<Array<{ id: string }>>(
          `UPDATE claim_log
              SET outcome = 'completed',
                  duration_ms = LEAST(
                    CAST(EXTRACT(EPOCH FROM ($3::timestamptz - claimed_at::timestamptz)) * 1000 AS BIGINT),
                    2147483647
                  )::INTEGER,
                  diagnostic = $4
            WHERE id = $1
              AND outcome IS NULL
              AND agent_id = $2
            RETURNING id::text`,
          [exactClaimId, attemptAgentId, now, input.diagnostic.slice(0, 10_000)],
        );
        if (closed.length !== 1) {
          fail("V3_EVIDENCE_ONLY_CLAIM_COMPLETION_CAS_LOST", "terminal claim changed before exact close");
        }
        const claimClosePorts = await import("../db-pg.js");
        const terminalClose = await claimClosePorts.resolveInternalProductionClaimTerminalAuthorityPairInTransactionV1(transaction as PgTransactionSql, { claimIdText: closed[0]!.id });
        await claimClosePorts.closeInternalProductionOwnerReservationV1(transaction as PgTransactionSql, terminalClose);
      });
    },
  });
}
