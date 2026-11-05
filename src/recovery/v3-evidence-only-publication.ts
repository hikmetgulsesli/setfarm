import type postgres from "postgres";
import { createHash } from "node:crypto";
import { NativeEvidenceRefreshWitnessV1Schema } from "../execution/v3-preparation-runtime-authority-v1.js";
import { RuntimeCompletionPlanV1Schema } from "../execution/schemas/runtime-completion-plan-v1.js";
import { z } from "zod";

import { readDatabaseWallClock } from "../db/database-wall-clock.js";
import {
  beginOrAdoptInternalProductionOwnerReservationV1,
  bindInternalProductionOwnerReservationV1,
  closeInternalProductionOwnerReservationV1,
  resolveInternalProductionExecutionAttemptTerminalAuthorityPairInTransactionV1,
  resolveInternalProductionFindingTerminalAuthorityPairInTransactionV1,
  type PgTransactionSql,
} from "../db-pg.js";
import { createInternalProductionFindingCanonicalOwnerIdentityV1 } from "../internal-production/owner-admission-v1.js";
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

type FindingPublicationParentRow = Readonly<{
  finding_set_hash: string;
  finding_set_id: string;
  run_id: string;
  story_id: string;
  packet_hash: string;
  slice_hash: string;
  source_sha: string;
  source_tree_hash: string;
  finding_ids: unknown;
  payload: unknown;
}>;

type FindingPublicationChildRow = Readonly<{
  finding_id: string;
  origin: string;
  classification: string;
  invariant_ref: string;
  status: string;
  source_fingerprint: string;
  payload: unknown;
}>;

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
  const identity = createInternalProductionFindingCanonicalOwnerIdentityV1({
    findingSetHash: findingSet.findingSetHash,
  });
  await transaction.unsafe("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [
    findingSet.findingSetHash,
  ]);
  const expectedIds = findingSet.findings.map((finding) => finding.findingId);
  const readParent = () => transaction.unsafe<FindingPublicationParentRow[]>(
    "SELECT * FROM finding_sets WHERE finding_set_hash=$1 FOR UPDATE",
    [findingSet.findingSetHash],
  );
  const readChildren = () => transaction.unsafe<FindingPublicationChildRow[]>(
    `SELECT finding_id,origin,classification,invariant_ref,status,source_fingerprint,payload
       FROM findings WHERE finding_set_hash=$1
      ORDER BY array_position($2::text[],finding_id),finding_id FOR UPDATE`,
    [findingSet.findingSetHash, expectedIds],
  );
  const parentMatches = (row: FindingPublicationParentRow | undefined) => Boolean(row
    && row.finding_set_hash === findingSet.findingSetHash
    && row.finding_set_id === findingSet.findingSetId
    && row.run_id === findingSet.runId
    && row.story_id === findingSet.storyId
    && row.packet_hash === findingSet.packetHash
    && row.slice_hash === findingSet.sliceHash
    && row.source_sha === findingSet.sourceRevision.sha
    && row.source_tree_hash === findingSet.sourceRevision.treeHash
    && canonicalJsonStringify(row.finding_ids) === canonicalJsonStringify(expectedIds)
    && canonicalJsonStringify(FindingSetV1Schema.parse(row.payload)) === canonicalJsonStringify(findingSet));
  const childrenMatch = (rows: readonly FindingPublicationChildRow[]) => rows.length === findingSet.findings.length
    && rows.every((row, index) => {
      const finding = findingSet.findings[index];
      return finding !== undefined
        && row.finding_id === finding.findingId
        && row.origin === finding.origin
        && row.classification === finding.classification
        && row.invariant_ref === finding.invariantRef
        && row.status === finding.status
        && row.source_fingerprint === hashCanonicalJson(finding.sourceLocators)
        && canonicalJsonStringify(row.payload) === canonicalJsonStringify(finding);
    });
  const beforeParent = await readParent();
  const beforeChildren = await readChildren();
  const beforeOwners = await transaction.unsafe<Array<{ producer_implementation_id: string; state: string }>>(
    `SELECT producer_implementation_id,state FROM internal_production_owner_reservations_v1
      WHERE category='finding' AND owner_key=$1`,
    [findingSet.findingSetHash],
  );
  const adopting = beforeParent.length !== 0 || beforeChildren.length !== 0 || beforeOwners.length !== 0;
  const allowedProducer = [
    "a-finding-recovery-repository-v1",
    "a-finding-v3-downstream-evidence-v1",
    "a-finding-v3-evidence-only-v1",
  ].includes(beforeOwners[0]?.producer_implementation_id ?? "");
  if (adopting && (
    beforeParent.length !== 1
    || !parentMatches(beforeParent[0])
    || !childrenMatch(beforeChildren)
    || beforeOwners.length !== 1
    || !allowedProducer
    || !["bound", "closed"].includes(beforeOwners[0]?.state ?? "")
  )) fail("V3_EVIDENCE_ONLY_FINDING_OWNER_ADOPTION_INVALID", "stored finding publication is incomplete or crossed");
  if (
    adopting
    && beforeOwners[0]?.producer_implementation_id !== "a-finding-v3-evidence-only-v1"
  ) {
    if (beforeOwners[0]?.state !== "closed") {
      fail("V3_EVIDENCE_ONLY_FINDING_OWNER_ADOPTION_INVALID", "cross-producer finding owner is not terminal");
    }
    const closeInput = await resolveInternalProductionFindingTerminalAuthorityPairInTransactionV1(
      transaction as PgTransactionSql,
      { findingSetHash: findingSet.findingSetHash },
    );
    await closeInternalProductionOwnerReservationV1(transaction as PgTransactionSql, closeInput);
    return;
  }
  const reservation = await beginOrAdoptInternalProductionOwnerReservationV1(
    transaction as PgTransactionSql,
    { producerImplementationId: "a-finding-v3-evidence-only-v1", ownerKey: identity.ownerKey },
  );
  if (!adopting) {
    await transaction.unsafe(
      `INSERT INTO finding_sets (
         finding_set_hash,finding_set_id,run_id,story_id,packet_hash,slice_hash,
         source_sha,source_tree_hash,finding_ids,payload
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::text::jsonb,$10::text::jsonb)`,
      [
        findingSet.findingSetHash, findingSet.findingSetId, findingSet.runId,
        findingSet.storyId, findingSet.packetHash, findingSet.sliceHash,
        findingSet.sourceRevision.sha, findingSet.sourceRevision.treeHash,
        JSON.stringify(expectedIds), JSON.stringify(findingSet),
      ],
    );
    for (const finding of findingSet.findings) {
      await transaction.unsafe(
        `INSERT INTO findings (
           finding_set_hash,finding_id,origin,classification,invariant_ref,status,source_fingerprint,payload
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8::text::jsonb)`,
        [
          findingSet.findingSetHash, finding.findingId, finding.origin, finding.classification,
          finding.invariantRef, finding.status, hashCanonicalJson(finding.sourceLocators),
          JSON.stringify(finding),
        ],
      );
    }
  }
  const parent = await readParent();
  const children = await readChildren();
  if (parent.length !== 1 || !parentMatches(parent[0]) || !childrenMatch(children)) {
    fail("V3_EVIDENCE_ONLY_FINDING_OWNER_REREAD_INVALID", "stored finding publication is not byte exact");
  }
  await bindInternalProductionOwnerReservationV1(transaction as PgTransactionSql, {
    reservationRef: reservation.reservationRef,
    reservationHash: reservation.reservationHash,
    canonicalOwnerIdentity: identity,
  });
  const closeInput = await resolveInternalProductionFindingTerminalAuthorityPairInTransactionV1(
    transaction as PgTransactionSql,
    { findingSetHash: findingSet.findingSetHash },
  );
  await closeInternalProductionOwnerReservationV1(transaction as PgTransactionSql, closeInput);
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
        AND revision.run_id = delivery.run_id
        AND revision.story_id = delivery.story_id
        AND EXISTS (
          SELECT 1 FROM recovery_case_revisions opening_revision
           WHERE opening_revision.recovery_case_id = recovery_case.recovery_case_id
             AND opening_revision.revision_number = 1
             AND opening_revision.parent_revision_id IS NULL
             AND opening_revision.run_id = recovery_case.run_id
             AND opening_revision.story_id = recovery_case.story_id
             AND opening_revision.packet_hash = recovery_case.packet_hash
             AND opening_revision.finding_set_hash = recovery_case.finding_set_hash
             AND opening_revision.finding_ids = recovery_case.finding_ids
             AND opening_revision.contract_slice_hash = recovery_case.slice_hash
             AND opening_revision.source_sha = recovery_case.source_sha
             AND opening_revision.source_tree_hash = recovery_case.source_tree_hash
        )
        AND recovery_case.packet_hash = revision.packet_hash
        AND recovery_case.owner = revision.owner
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
      FOR UPDATE OF delivery, recovery_case, revision, dispatch, step_row, story_row`,
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
    || Number(row.delivery_claim_id) !== attempt.claimId
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
    || !((rows[0]!.slice_type === "setfarm.implementation-slice.v1" && rows[0]!.plan_type === "setfarm.evidence-plan.v1")
      || (rows[0]!.slice_type === "setfarm.implementation-slice.v2" && rows[0]!.plan_type === "setfarm.evidence-plan.v2"))
    || rows[0]!.slice_ref_hash !== prepared.sliceHash
    || rows[0]!.plan_ref_hash !== prepared.evidencePlanArtifactHash
  ) {
    fail("V3_EVIDENCE_ONLY_PUBLICATION_ARTIFACT_INDEX_MISMATCH", "clean slice and evidence plan must be durable CAS/index run references before attempt publication");
  }
}

async function assertNoModelPublicationForEvidenceOnlyClaimInTransaction(
  transaction: TransactionSql,
  input: Readonly<{
    claimId: number;
    runId: string;
    storyId: string;
    dispatchId: string;
  }>,
): Promise<void> {
  const rows = await transaction.unsafe<Array<{
    runtime_count: number;
    publication_count: number;
  }>>(
    `SELECT
       (SELECT COUNT(*)::integer
          FROM runtime_sessions runtime
         WHERE runtime.claim_id = $1::bigint
           AND runtime.run_id = $2
           AND runtime.story_id = $3) AS runtime_count,
       (SELECT COUNT(*)::integer
          FROM internal_production_v3_recovery_claim_publications_v1 publication
         WHERE publication.claim_id = $1::bigint
            OR publication.dispatch_id = $4) AS publication_count`,
    [input.claimId, input.runId, input.storyId, input.dispatchId],
  );
  if (
    rows.length !== 1
    || rows[0]!.runtime_count !== 0
    || rows[0]!.publication_count !== 0
  ) {
    fail(
      "V3_EVIDENCE_ONLY_PUBLICATION_MODEL_AUTHORITY_FORBIDDEN",
      "evidence-only claim/dispatch identity must have no runtime session or migration-33 publication",
    );
  }
}

/** Native clean-origin evidence refresh: SQL-only source/contract custody.
 * The current candidate is the accepted terminal source owner; the slice and
 * plan remain its immutable original base contracts. No caller-provided proof. */
export async function readNativeEvidenceOnlySourceAuthority(
  sql: Pick<Sql, "unsafe">,
  lease: Pick<V3EvidenceOnlyPublicationLeaseV1, "runId" | "storyId" | "recoveryCaseId" | "revisionId" | "dispatchId"
    | "packetHash" | "contractSliceHash" | "findingSetHash" | "sourceRevision" | "priorEvidencePlanArtifactHash">,
) {
  const rows = await sql.unsafe<Array<{ attempt_id: string; generation: number; authority_hash: string;
    compilation_report_hash: string; branch: string; worktree: string; evidence_refs: string;
    evidence_plan_artifact_hash: string }>>(`
    SELECT a.attempt_id,a.generation,b.authority_hash,a.compilation_report_hash,a.branch,a.worktree,a.evidence_refs,
      revision.evidence_plan_artifact_hash
    FROM recovery_cases c JOIN recovery_case_revisions revision ON revision.recovery_case_id=c.recovery_case_id
      AND revision.revision_id=c.current_revision_id
    JOIN recovery_revision_dispatches d ON d.revision_id=revision.revision_id AND d.recovery_case_id=c.recovery_case_id
    JOIN execution_attempts a ON a.run_id=c.run_id AND a.story_id=c.story_id AND c.prior_attempt_refs::jsonb ? a.attempt_id
    JOIN v3_preparation_authority_attempts_v2 b ON b.attempt_id=a.attempt_id AND b.claim_id=a.claim_id AND b.slice_hash=a.slice_hash
    JOIN v3_preparation_authorities_v2 origin ON origin.authority_hash=b.authority_hash
      AND origin.run_id=a.run_id AND origin.story_id=a.story_id AND origin.packet_hash=a.packet_hash
    JOIN runtime_completion_requests q ON q.attempt_id=a.attempt_id AND q.claim_id=a.claim_id AND q.run_id=a.run_id
      AND q.story_id=a.story_id AND q.workflow_step_id=a.step_id AND q.output_hash=a.output_hash
    JOIN runtime_sessions runtime ON runtime.session_id=q.runtime_session_id AND runtime.claim_id=a.claim_id
      AND runtime.attempt_id=a.attempt_id AND runtime.run_id=a.run_id AND runtime.story_id=a.story_id
      AND runtime.step_db_id=q.step_db_id AND runtime.workflow_step_id=a.step_id
    JOIN claim_log claim ON claim.id=a.claim_id AND claim.run_id=a.run_id AND claim.step_id=a.step_id
      AND claim.story_id=a.story_id AND claim.outcome=q.claim_outcome
    WHERE c.recovery_case_id=$1 AND revision.revision_id=$2 AND d.dispatch_id=$3
      AND c.run_id=$4 AND c.story_id=$5 AND c.owner='infrastructure' AND revision.owner='infrastructure'
      AND revision.revision_number=1 AND revision.parent_revision_id IS NULL
      AND revision.packet_hash=$6 AND d.packet_hash=$6 AND a.packet_hash=$6
      AND revision.contract_slice_hash=$7 AND d.contract_slice_hash=$7 AND a.slice_hash=$7
      AND revision.finding_set_hash=$8 AND d.finding_set_hash=$8
      AND revision.source_sha=$9 AND revision.source_tree_hash=$10
      AND d.source_sha=$9 AND d.source_tree_hash=$10 AND a.source_after_sha=$9 AND a.source_after_tree_hash=$10
      AND d.dispatch_class='evidence_only' AND revision.expected_delta->>'kind'='evidence_refresh'
      AND revision.allowed_paths='[]'::jsonb
      AND a.step_id='implement' AND a.attempt_class='product_implementation' AND a.role='developer'
      AND a.recovery_dispatch_id IS NULL AND a.recovery_case_revision_id IS NULL
      AND a.disposition NOT IN ('claimed','running','superseded')
      AND q.state='accepted' AND q.apply_phase='effects_committed' AND q.claim_outcome IN ('completed','failed')
      AND runtime.state='released' AND a.branch IS NOT NULL AND a.worktree IS NOT NULL`,
    [lease.recoveryCaseId,lease.revisionId,lease.dispatchId,lease.runId,lease.storyId,lease.packetHash,
      lease.contractSliceHash,lease.findingSetHash,lease.sourceRevision.sha,lease.sourceRevision.treeHash]);
  if (rows.length !== 1 || !rows[0]!.evidence_plan_artifact_hash
    || rows[0]!.evidence_plan_artifact_hash !== lease.priorEvidencePlanArtifactHash) {
    fail("V3_NATIVE_EVIDENCE_ONLY_SOURCE_AUTHORITY_MISMATCH", "clean native evidence must retain its accepted original source owner and exact plan");
  }
  return rows[0]!;
}


/**
 * Read-only SQL authority for the clean initial native evidence-refresh branch.
 * Original inconclusive evidence and its actual accepted claim outcome are
 * preserved; the original runtime is released and the verifier has no RCR.
 * IDs locate rows, never supply evidence. The same query is used inside the
 * caller's existing transaction for exact DB recheck after immutable CAS/Git
 * authentication. No filesystem work, lease acquisition or row mutation here.
 */
export async function readNativeEvidenceOnlyTerminalAuthority(
  query: Pick<Sql, "unsafe">,
  input: Readonly<{ runId: string; stepId: string; storyId: string; packetHash: string; attemptId: string }>,
) {
  const rows = await query.unsafe<Array<{
    attempt_id: string; claim_id: string; generation: number; slice_hash: string; output_hash: string;
    delivery_state: string; case_status: string; fence_token: string;
    compilation_report_hash: string; branch: string; worktree: string; evidence_refs: string;
    source_sha: string; source_tree_hash: string; recovery_case_id: string; revision_id: string;
    dispatch_id: string; finding_set_hash: string; evidence_plan_artifact_hash: string;
    evidence_plan: unknown; bundle_payload: unknown; terminal_result: unknown; case_terminal: unknown;
    decision_refs: unknown; source_owner_attempt_id: string; source_owner_claim_id: string;
    source_owner_generation: number; source_owner_output_hash: string; source_owner_output: string;
    source_owner_claim_outcome: string; source_owner_plan: unknown; source_owner_plan_hash: string;
    source_owner_request_id: string; source_owner_step_db_id: string;
    original_bundle_hash: string; original_bundle_payload: unknown; original_finding_payload: unknown;
    source_owner_before_sha: string; source_owner_before_tree_hash: string;
    source_owner_evidence_refs: string; authority_hash: string;
    story_db_id: string; story_status: string; story_output: string|null; story_claim_generation: number;
  }>>(`
    SELECT a.attempt_id,a.claim_id::text,a.generation,a.slice_hash,a.output_hash,
      delivery.state AS delivery_state,rc.status AS case_status,a.fence_token,
      a.compilation_report_hash,a.branch,a.worktree,a.evidence_refs,
      a.source_after_sha AS source_sha,a.source_after_tree_hash AS source_tree_hash,
      rc.recovery_case_id,rev.revision_id,d.dispatch_id,d.finding_set_hash,
      rev.evidence_plan_artifact_hash,rev.evidence_plan,bundle.payload AS bundle_payload,
      delivery.terminal_result,rc.terminal AS case_terminal,rc.decision_refs,
      original.attempt_id AS source_owner_attempt_id,original.claim_id::text AS source_owner_claim_id,
      original.generation AS source_owner_generation,original.output_hash AS source_owner_output_hash,
      q.output AS source_owner_output,q.claim_outcome AS source_owner_claim_outcome,
      q.completion_plan AS source_owner_plan,q.completion_plan_hash AS source_owner_plan_hash,
      q.request_id AS source_owner_request_id,q.step_db_id AS source_owner_step_db_id,
      original_bundle.evidence_bundle_hash AS original_bundle_hash,original_bundle.payload AS original_bundle_payload,
      original_findings.payload AS original_finding_payload,original.source_before_sha AS source_owner_before_sha,
      original.source_before_tree_hash AS source_owner_before_tree_hash,
      original.evidence_refs AS source_owner_evidence_refs,initial.authority_hash,
      story.id AS story_db_id,story.status AS story_status,story.output AS story_output,story.claim_generation AS story_claim_generation
    FROM execution_attempts a
    JOIN claim_log claim ON claim.id=a.claim_id AND claim.run_id=a.run_id
      AND claim.step_id=a.step_id AND claim.story_id=a.story_id AND claim.agent_id=a.agent_id
      AND claim.outcome='completed'
    JOIN recovery_dispatch_deliveries delivery ON delivery.attempt_id=a.attempt_id
      AND delivery.claim_id=a.claim_id AND delivery.dispatch_id=a.recovery_dispatch_id
      AND delivery.revision_id=a.recovery_case_revision_id AND delivery.run_id=a.run_id
      AND delivery.story_id=a.story_id AND delivery.execution_slice_hash=a.slice_hash
      AND delivery.state IN ('attempt_reserved','running','succeeded') AND delivery.attempt_count=1
    JOIN recovery_revision_dispatches d ON d.dispatch_id=delivery.dispatch_id
      AND d.revision_id=delivery.revision_id AND d.recovery_case_id=delivery.recovery_case_id
      AND d.dispatch_class='evidence_only'
      AND d.packet_hash=a.packet_hash AND d.contract_slice_hash=a.slice_hash
      AND d.finding_set_hash=a.finding_set_hash AND d.source_sha=a.source_before_sha
      AND d.source_tree_hash=a.source_before_tree_hash
    JOIN recovery_case_revisions rev ON rev.revision_id=d.revision_id
      AND rev.recovery_case_id=d.recovery_case_id AND rev.run_id=a.run_id AND rev.story_id=a.story_id
      AND rev.revision_number=1 AND rev.parent_revision_id IS NULL AND rev.owner='infrastructure'
      AND rev.packet_hash=d.packet_hash AND rev.contract_slice_hash=d.contract_slice_hash
      AND rev.finding_set_hash=d.finding_set_hash AND rev.finding_ids=d.finding_ids
      AND rev.source_sha=d.source_sha AND rev.source_tree_hash=d.source_tree_hash
      AND rev.evidence_plan=d.evidence_plan AND rev.evidence_plan_artifact_hash=d.evidence_plan_artifact_hash
      AND rev.expected_delta->>'kind'='evidence_refresh' AND rev.allowed_paths='[]'::jsonb
    JOIN recovery_cases rc ON rc.recovery_case_id=rev.recovery_case_id
      AND rc.current_revision_id=rev.revision_id AND rc.run_id=a.run_id AND rc.story_id=a.story_id
      AND rc.packet_hash=rev.packet_hash AND rc.slice_hash=rev.contract_slice_hash
      AND rc.source_sha=rev.source_sha AND rc.source_tree_hash=rev.source_tree_hash
      AND rc.finding_set_hash=rev.finding_set_hash AND rc.finding_ids=rev.finding_ids
      AND rc.owner='infrastructure'
      AND ((rc.status='resolved' AND delivery.state='succeeded')
        OR (rc.status='evidencing' AND delivery.state IN ('attempt_reserved','running')
          AND delivery.terminal_result='{}'::jsonb AND delivery.terminal_at IS NULL AND rc.terminal IS NULL))
      AND rc.expected_delta=rev.expected_delta AND rc.allowed_paths=rev.allowed_paths
      AND rc.evidence_plan=rev.evidence_plan
      AND (rc.status='evidencing' OR rc.prior_attempt_refs::jsonb ? a.attempt_id)
    JOIN execution_attempts original ON original.run_id=a.run_id AND original.step_id=a.step_id
      AND original.story_id=a.story_id AND original.packet_hash=a.packet_hash
      AND original.compilation_report_hash=a.compilation_report_hash AND original.slice_hash=a.slice_hash
      AND original.generation+1=a.generation AND original.source_after_sha=a.source_before_sha
      AND original.source_after_tree_hash=a.source_before_tree_hash
      AND original.branch=a.branch AND original.worktree=a.worktree
      AND original.attempt_class='product_implementation' AND original.role='developer'
      AND original.disposition='inconclusive' AND original.recovery_dispatch_id IS NULL
      AND original.recovery_case_revision_id IS NULL AND rc.prior_attempt_refs::jsonb ? original.attempt_id
    JOIN v3_preparation_authority_attempts_v2 initial ON initial.attempt_id=original.attempt_id
      AND initial.claim_id=original.claim_id AND initial.slice_hash=original.slice_hash
    JOIN v3_preparation_authorities_v2 authority ON authority.authority_hash=initial.authority_hash
      AND authority.run_id=a.run_id AND authority.step_id=a.step_id AND authority.story_id=a.story_id
      AND authority.packet_hash=a.packet_hash AND authority.compilation_report_hash=a.compilation_report_hash
      AND authority.base_source_sha=original.source_before_sha
      AND authority.base_source_tree_hash=original.source_before_tree_hash
    JOIN runtime_completion_requests q ON q.attempt_id=original.attempt_id AND q.claim_id=original.claim_id
      AND q.run_id=original.run_id AND q.story_id=original.story_id AND q.workflow_step_id=original.step_id
      AND q.output_hash=original.output_hash AND q.state='accepted' AND q.apply_phase='effects_committed'
      AND q.claim_outcome IN ('completed','failed')
    JOIN runtime_sessions runtime ON runtime.session_id=q.runtime_session_id
      AND runtime.claim_id=original.claim_id AND runtime.attempt_id=original.attempt_id
      AND runtime.run_id=original.run_id AND runtime.story_id=original.story_id
      AND runtime.step_db_id=q.step_db_id AND runtime.workflow_step_id=original.step_id AND runtime.state='released'
    JOIN claim_log original_claim ON original_claim.id=original.claim_id
      AND original_claim.run_id=original.run_id AND original_claim.step_id=original.step_id
      AND original_claim.story_id=original.story_id AND original_claim.outcome=q.claim_outcome
      AND original_claim.agent_id=runtime.claim_agent_id
    JOIN evidence_bundles original_bundle ON original_bundle.run_id=original.run_id
      AND original_bundle.story_id=original.story_id AND original_bundle.attempt_id=original.attempt_id
      AND original_bundle.packet_hash=original.packet_hash AND original_bundle.slice_hash=original.slice_hash
      AND original_bundle.source_sha=original.source_after_sha AND original_bundle.source_tree_hash=original.source_after_tree_hash
      AND original_bundle.aggregate_verdict='inconclusive'
      AND original.evidence_refs::jsonb ? ('setfarm://evidence-bundle/' || original_bundle.evidence_bundle_hash)
    JOIN finding_sets original_findings ON original_findings.finding_set_hash=rev.finding_set_hash
      AND original_findings.run_id=original.run_id AND original_findings.story_id=original.story_id
      AND original_findings.packet_hash=original.packet_hash AND original_findings.slice_hash=original.slice_hash
      AND original_findings.source_sha=original.source_after_sha AND original_findings.source_tree_hash=original.source_after_tree_hash
      AND original_findings.finding_ids=rev.finding_ids
    JOIN v3_story_claim_runtime_bindings_v1 original_binding ON original_binding.claim_id=original.claim_id
      AND original_binding.runtime_session_id=runtime.session_id AND original_binding.run_id=a.run_id
      AND original_binding.step_db_id=q.step_db_id AND original_binding.workflow_step_id='implement'
      AND original_binding.subject_kind='story_member' AND original_binding.story_id=a.story_id
    JOIN stories story ON story.id=original_binding.story_db_id AND story.run_id=a.run_id
      AND story.story_id=a.story_id AND story.story_index=original_binding.story_index
      AND story.claim_generation=original_binding.story_claim_generation
      AND story.status IN ('failed','done','verified') AND story.claimed_by IS NULL AND story.claimed_at IS NULL
    JOIN runs run ON run.id=a.run_id AND run.protocol='v3' AND run.packet_hash=a.packet_hash
      AND run.status IN ('running','resuming')
    JOIN semantic_artifacts packet ON packet.artifact_hash=a.packet_hash AND packet.artifact_type='setfarm.product-build-packet.v3'
    JOIN semantic_artifacts slice ON slice.artifact_hash=a.slice_hash AND slice.artifact_type='setfarm.implementation-slice.v2'
    JOIN semantic_artifacts plan ON plan.artifact_hash=rev.evidence_plan_artifact_hash AND plan.artifact_type='setfarm.evidence-plan.v2'
    JOIN evidence_bundles bundle ON bundle.evidence_bundle_hash=a.output_hash AND bundle.attempt_id=a.attempt_id
      AND bundle.run_id=a.run_id AND bundle.story_id=a.story_id AND bundle.packet_hash=a.packet_hash
      AND bundle.slice_hash=a.slice_hash AND bundle.source_sha=a.source_after_sha
      AND bundle.source_tree_hash=a.source_after_tree_hash AND bundle.aggregate_verdict='pass'
    WHERE a.attempt_id=$1 AND a.run_id=$2 AND a.step_id=$3 AND a.story_id=$4 AND a.packet_hash=$5
      AND a.step_id='implement' AND a.attempt_class='evidence_only' AND a.role='evidence-orchestrator'
      AND a.agent_id='setfarm-evidence-orchestrator' AND a.disposition='verified'
      AND a.source_before_sha=a.source_after_sha AND a.source_before_tree_hash=a.source_after_tree_hash
      AND NOT EXISTS (SELECT 1 FROM runtime_sessions absent WHERE absent.claim_id=a.claim_id OR absent.attempt_id=a.attempt_id)
      AND NOT EXISTS (SELECT 1 FROM runtime_completion_requests absent WHERE absent.claim_id=a.claim_id OR absent.attempt_id=a.attempt_id)
      AND NOT EXISTS (SELECT 1 FROM v3_preparation_authority_attempts_v2 absent
        WHERE absent.claim_id=a.claim_id OR absent.attempt_id=a.attempt_id)
      AND NOT EXISTS (SELECT 1 FROM execution_attempts newer WHERE newer.run_id=a.run_id
        AND newer.step_id=a.step_id AND newer.story_id=a.story_id AND newer.generation>a.generation)
  `, [input.attemptId,input.runId,input.stepId,input.storyId,input.packetHash]);
  const row=rows[0];
  if(rows.length!==1||!row) fail("V3_NATIVE_EVIDENCE_SUCCESS_MISSING","one exact canonical terminal native nonmodel child is required");
  const bundle=EvidenceBundleV2Schema.parse(row.bundle_payload);
  const originalBundle=EvidenceBundleV2Schema.parse(row.original_bundle_payload);
  const originalFindings=FindingSetV1Schema.parse(row.original_finding_payload);
  const originalPlan=RuntimeCompletionPlanV1Schema.parse(row.source_owner_plan);
  const plan=z.array(z.string()).min(1).parse(row.evidence_plan);
  const refs=z.array(z.string()).parse(JSON.parse(row.evidence_refs));
  const originalRefs=z.array(z.string()).parse(JSON.parse(row.source_owner_evidence_refs));
  const custody=originalRefs.filter(ref=>ref.startsWith("setfarm://native-git-custody-v1/"));
  const authorityRef=`setfarm://preparation-authority-v2/${row.authority_hash}`;
  const eventHash=hashCanonicalJson({schema:"setfarm.v3-recovery-coordinator-event.v1",value:{
    kind:"recovery_evidence",recoveryCaseId:row.recovery_case_id,revisionId:row.revision_id,
    dispatchId:row.dispatch_id,attemptId:row.attempt_id,evidenceBundleHash:row.output_hash,
  }});
  const terminalResult={schema:"setfarm.v3-recovery-coordinator-result.v1",eventHash,
    evidenceBundleHash:row.output_hash,attemptId:row.attempt_id,verdict:"pass"};
  const decisionRef=hashCanonicalJson({schema:"setfarm.recovery-delivery-decision.v1",
    value:{kind:"recovery_evidence_satisfied",coordinatorEventHash:eventHash}});
  const passed=new Set(bundle.predicates.filter(predicate=>predicate.verdict==="pass").map(predicate=>predicate.predicateRef));
  if(computeEvidenceBundleHash(originalBundle)!==row.original_bundle_hash
    ||originalBundle.aggregateVerdict!=="inconclusive"||originalBundle.attemptId!==row.source_owner_attempt_id
    ||originalBundle.runId!==input.runId||originalBundle.storyId!==input.storyId
    ||originalBundle.packetHash!==input.packetHash||originalBundle.sliceHash!==row.slice_hash
    ||originalBundle.sourceRevision.sha!==row.source_sha||originalBundle.sourceRevision.treeHash!==row.source_tree_hash
    ||originalFindings.findingSetHash!==row.finding_set_hash
    ||originalFindings.findings.some(finding=>!finding.observedEvidenceRefs.includes(row.original_bundle_hash))
    ||hashCanonicalJson(originalPlan)!==row.source_owner_plan_hash
    ||originalPlan.requestId!==row.source_owner_request_id||originalPlan.claimId!==Number(row.source_owner_claim_id)
    ||originalPlan.runId!==input.runId||originalPlan.stepDbId!==row.source_owner_step_db_id
    ||originalPlan.workflowStepId!=="implement"||originalPlan.outputHash!==row.source_owner_output_hash
    ||originalPlan.kind!=="story_completion"||originalPlan.subject?.storyDbId!==row.story_db_id
    ||originalPlan.subject?.storyId!==input.storyId||originalPlan.subject?.sourceSha!==row.source_sha
    ||computeEvidenceBundleHash(bundle)!==row.output_hash||bundle.aggregateVerdict!=="pass"
    ||bundle.attemptId!==row.attempt_id||bundle.runId!==input.runId||bundle.storyId!==input.storyId
    ||bundle.packetHash!==input.packetHash||bundle.sliceHash!==row.slice_hash
    ||bundle.sourceRevision.sha!==row.source_sha||bundle.sourceRevision.treeHash!==row.source_tree_hash
    ||!bundle.predicates.length||bundle.predicates.some(predicate=>predicate.required&&predicate.verdict!=="pass")
    ||plan.some(predicate=>!passed.has(predicate))
    ||(row.delivery_state==='succeeded' && (
      !jsonEquals(row.terminal_result,terminalResult)
      ||!jsonEquals(row.case_terminal,{owner:"infrastructure",outcome:"resolved",reasonCode:"evidence_satisfied",evidenceBundleHashes:[row.output_hash]})
      ||!z.array(z.string()).parse(row.decision_refs).includes(decisionRef)))
    ||createHash("sha256").update(row.source_owner_output,"utf8").digest("hex")!==row.source_owner_output_hash
    ||custody.length!==1||!refs.includes(custody[0]!)||!originalRefs.includes(authorityRef)
    ||!jsonEquals(refs.filter(ref=>ref.startsWith("setfarm://preparation-authority-v2/")),[authorityRef])
    ||!refs.includes(`setfarm://artifact/${row.slice_hash}`)
    ||!refs.includes(`setfarm://artifact/${row.evidence_plan_artifact_hash}`)
    ||!refs.includes(`setfarm://evidence-bundle/${row.output_hash}`)) {
    fail("V3_NATIVE_EVIDENCE_SUCCESS_WITNESS_MISMATCH","terminal rows do not reproduce canonical native verification authority");
  }
  const claimId=Number(row.claim_id), sourceClaimId=Number(row.source_owner_claim_id);
  if(!Number.isSafeInteger(claimId)||claimId<1||!Number.isSafeInteger(sourceClaimId)||sourceClaimId<1)
    fail("V3_NATIVE_EVIDENCE_SUCCESS_CLAIM_INVALID","source and verifier require exact claim IDs");
  const evidenceRefresh=Object.freeze(NativeEvidenceRefreshWitnessV1Schema.parse({
    kind:"native_evidence_refresh",sourceOwnerAttemptId:row.source_owner_attempt_id,
    sourceOwnerGeneration:row.source_owner_generation,sourceOwnerOutputHash:row.source_owner_output_hash,
    sourceOwnerClaimOutcome:row.source_owner_claim_outcome,
    initialAuthorityHash:row.authority_hash,recoveryCaseId:row.recovery_case_id,
    revisionId:row.revision_id,dispatchId:row.dispatch_id,evidencePlanArtifactHash:row.evidence_plan_artifact_hash,
    evidenceBundleHash:row.output_hash,
  }));
  // This is a bounded witness in the existing story output, never a new RCR.
  const acceptanceOutput=canonicalJsonStringify({
    schema:"setfarm.v3-story-acceptance-record.v1",kind:"native_evidence_refresh",
    storyId:input.storyId,attemptId:row.attempt_id,packetHash:input.packetHash,sliceHash:row.slice_hash,
    sourceRevision:{sha:row.source_sha,treeHash:row.source_tree_hash},
    evidenceBundleRef:`setfarm://evidence-bundle/${row.output_hash}`,
    aggregateVerdict:"pass",findingSetRef:null,failureClass:null,
    sourceOwnerAttemptId:row.source_owner_attempt_id,agentOutputHash:row.source_owner_output_hash,evidenceRefresh,
  });
  const stage: "pending_acceptance" | "settled" = row.delivery_state==='succeeded' ? "settled" : "pending_acceptance";
  return Object.freeze({
    stage, fenceToken: row.fence_token,
    attemptId:row.attempt_id,claimId,generation:row.generation,sliceHash:row.slice_hash,
    outputHash:row.output_hash,compilationReportHash:row.compilation_report_hash,
    sourceAfter:Object.freeze({sha:row.source_sha,treeHash:row.source_tree_hash}),
    worktree:row.worktree,branch:row.branch,storyDbId:row.story_db_id,
    storyStatus:row.story_status,storyClaimGeneration:row.story_claim_generation,
    sourceOwner:Object.freeze({attemptId:row.source_owner_attempt_id,claimId:sourceClaimId,
      generation:row.source_owner_generation,outputHash:row.source_owner_output_hash,output:row.source_owner_output,
      claimOutcome:row.source_owner_claim_outcome,completionPlan:originalPlan,
      sourceBefore:Object.freeze({sha:row.source_owner_before_sha,treeHash:row.source_owner_before_tree_hash})}),
    evidenceRefresh,acceptanceOutput,storyOutput:row.story_output,
  });
}


/** Public accepted-reader contract stays strict. Pending terminal children are
 * available only to the separate live-delivery continuation authenticator. */
export async function readNativeEvidenceOnlySuccessAuthority(
  query: Pick<Sql, "unsafe">,
  input: Readonly<{runId:string;stepId:string;storyId:string;packetHash:string;attemptId:string}>,
) {
  const terminal=await readNativeEvidenceOnlyTerminalAuthority(query,input);
  if(terminal.stage!=="settled") fail("V3_NATIVE_EVIDENCE_SUCCESS_MISSING","nonmodel delivery/case is not settled");
  const {stage:_stage,fenceToken:_fenceToken,...success}=terminal;
  return Object.freeze(success);
}


/**
 * Atomically accept a verified native story in the existing
 * loop or publish its authentic frozen per-story route. Delivery, case, story
 * and route commit together. Last-story external merge remains unsupported;
 * refusal rolls back delivery settlement too, preserving terminal-child replay.
 */
export async function projectNativeEvidenceOnlyStorySuccessInTransaction(
  transaction: TransactionSql,
  input: Readonly<{runId:string;stepId:string;storyId:string;packetHash:string;attemptId:string}>,
  preparedMerge?:PreparedNativeEvidenceMerge,
): Promise<void> {
  const fence=await lockV3RecoveryRunMutationAuthorityInTransaction(transaction,input);
  const success=await readNativeEvidenceOnlySuccessAuthority(transaction,input);
  const rows=await transaction.unsafe<Array<{step_db_id:string;step_status:string;current_story_id:string|null;
    loop_config:unknown;story_status:string;story_output:string|null;story_branch:string|null;
    claim_generation:number;pending_siblings:number;story_title:string;story_pr_url:string|null}>>(`
    SELECT step.id AS step_db_id,step.status AS step_status,step.current_story_id,
      CASE WHEN octet_length(COALESCE(step.loop_config,'{}'))<=65536 THEN step.loop_config ELSE NULL END AS loop_config,
      story.status AS story_status,story.output AS story_output,story.story_branch,story.claim_generation,
      story.title AS story_title,story.pr_url AS story_pr_url,
      (SELECT count(*)::integer FROM stories sibling
        WHERE sibling.run_id=story.run_id AND sibling.id<>story.id AND sibling.status='pending') AS pending_siblings
    FROM stories story JOIN steps step ON step.run_id=story.run_id AND step.step_id='implement' AND step.type='loop'
    WHERE story.id=$1 AND story.run_id=$2 AND story.story_id=$3
      AND story.claimed_by IS NULL AND story.claimed_at IS NULL
    FOR UPDATE OF step,story
  `,[success.storyDbId,input.runId,input.storyId]);
  const row=rows[0];
  if(rows.length!==1||!row||row.claim_generation!==success.storyClaimGeneration||row.story_branch!==success.branch
    ||row.step_db_id!==success.sourceOwner.completionPlan.stepDbId) {
    fail("V3_NATIVE_EVIDENCE_STORY_PROJECTION_IDENTITY","story/loop identity changed before nonmodel acceptance");
  }
  if(["done","verified"].includes(row.story_status)) {
    if(row.story_output!==success.acceptanceOutput) fail("V3_NATIVE_EVIDENCE_STORY_PROJECTION_CONFLICT","story has another acceptance");
    return;
  }
  const loop=z.object({mergeStrategy:z.string().optional(),superviseEach:z.boolean().optional(),
    verifyEach:z.boolean().optional(),superviseStep:z.string().optional(),verifyStep:z.string().optional()})
    .passthrough().parse(typeof row.loop_config==="string"?JSON.parse(row.loop_config):row.loop_config);
  const route=success.sourceOwner.completionPlan.continuation;
  const direct=route.type==="story_direct_merge";
  const routed=route.type==="story_route_supervise"||route.type==="story_route_verify";
  if(direct ? (loop.mergeStrategy!=="direct-merge"||loop.superviseEach===true||loop.verifyEach===true||!preparedMerge)
    : !routed) {
    fail("V3_NATIVE_EVIDENCE_STORY_CONTINUATION_UNQUALIFIED",
      "last-story external merge requires an authentic recoverable continuation owner; no original model success is implied");
  }
  // A frozen route is derived from the accepted ORIGINAL completion plan. The
  // distinct nonmodel success authorizes publication; no original RCR is replayed.
  if(routed) {
    if(!route.targetStepDbId||!route.targetStepId
      ||(route.type==="story_route_supervise"&&(route.targetStepId!=="supervise"||loop.superviseEach!==true))
      ||(route.type==="story_route_verify"&&(loop.verifyEach!==true||route.targetStepId!==(loop.verifyStep||"verify")))) {
      fail("V3_NATIVE_EVIDENCE_STORY_ROUTE_DRIFT","frozen per-story route no longer matches the actual loop");
    }
    const targets=await transaction.unsafe<Array<{id:string}>>(`SELECT target.id FROM steps target
      WHERE target.id=$1 AND target.run_id=$2 AND target.step_id=$3 AND target.type='single'
        AND target.status IN ('waiting','done','pending')
        AND (target.current_story_id IS NULL OR target.current_story_id=$4)
        AND NOT EXISTS(SELECT 1 FROM claim_log c WHERE c.run_id=target.run_id AND c.step_id=target.step_id AND c.outcome IS NULL)
        AND NOT EXISTS(SELECT 1 FROM runtime_sessions r WHERE r.run_id=target.run_id AND r.step_db_id=target.id AND r.state<>'released')
      FOR UPDATE OF target`,[route.targetStepDbId,input.runId,route.targetStepId,success.storyDbId]);
    if(targets.length!==1) fail("V3_NATIVE_EVIDENCE_STORY_ROUTE_OWNER_CHANGED","frozen target is missing or has another owner");
  }
  const lastDirect=direct&&row.pending_siblings===0;
  if(direct) {
    if(!preparedMerge) fail("V3_NATIVE_EVIDENCE_MERGE_RECEIPT_REQUIRED","every direct merge position requires its actual canonical producer");
    await recheckPreparedNativeEvidenceMerge(transaction,preparedMerge,success,fence.observedAt);
  }
  if(lastDirect) {
    const siblings=await transaction.unsafe<Array<{count:number}>>(`SELECT count(*)::integer AS count FROM stories
      WHERE run_id=$1 AND id<>$2 AND status NOT IN ('done','verified','skipped')`,[input.runId,success.storyDbId]);
    if(siblings[0]?.count!==0) fail("V3_NATIVE_EVIDENCE_MERGE_SIBLING_CHANGED","another unfinished story appeared before acceptance");
  } else if(!direct&&preparedMerge) fail("V3_NATIVE_EVIDENCE_MERGE_ROUTE_CHANGED","prepared merge no longer matches the frozen route");
  const owners=await transaction.unsafe<Array<{blocked:boolean}>>(`
    SELECT EXISTS(SELECT 1 FROM claim_log c WHERE c.run_id=$1 AND c.step_id='implement' AND c.outcome IS NULL)
      OR EXISTS(SELECT 1 FROM runtime_sessions r WHERE r.run_id=$1 AND r.workflow_step_id='implement' AND r.state<>'released')
      OR EXISTS(SELECT 1 FROM stories s WHERE s.run_id=$1 AND s.status='running')
      OR EXISTS(SELECT 1 FROM recovery_dispatch_deliveries d WHERE d.run_id=$1 AND d.story_id=$2
        AND d.state IN ('authorized','leased','attempt_reserved','running')) AS blocked
  `,[input.runId,input.storyId]);
  if(owners[0]?.blocked!==false||row.story_status!=="failed"||!["pending","running"].includes(row.step_status)
    ||(row.current_story_id!==null&&row.current_story_id!==success.storyDbId)) {
    fail("V3_NATIVE_EVIDENCE_STORY_PROJECTION_OWNER_CHANGED","another owner or story state prevents acceptance");
  }
  const output=success.acceptanceOutput;
  const stories=await transaction.unsafe<Array<{id:string}>>(`
    UPDATE stories SET status=$7,merge_status=CASE WHEN $7='verified' THEN 'merged' ELSE merge_status END,output=$4,updated_at=$5
    WHERE id=$1 AND run_id=$2 AND story_id=$3 AND status='failed'
      AND claim_generation=$6 AND claimed_by IS NULL AND claimed_at IS NULL RETURNING id
  `,[success.storyDbId,input.runId,input.storyId,output,fence.observedAt,success.storyClaimGeneration,direct?"verified":"done"]);
  const steps=await transaction.unsafe<Array<{id:string}>>(`
    UPDATE steps SET status=$6,current_story_id=NULL,output=$3,updated_at=$4
    WHERE id=$1 AND run_id=$2 AND step_id='implement' AND type='loop'
      AND status IN ('pending','running') AND (current_story_id IS NULL OR current_story_id=$5)
    RETURNING id
  `,[row.step_db_id,input.runId,direct?nativeEvidenceMergeOutput(preparedMerge!.receipt):output,
    fence.observedAt,success.storyDbId,lastDirect?"done":direct?"pending":"running"]);
  if(stories.length!==1||steps.length!==1) fail("V3_NATIVE_EVIDENCE_STORY_PROJECTION_CAS_LOST","case/story acceptance must commit together");
  const runs=await transaction.unsafe<Array<{context:string}>>("SELECT context FROM runs WHERE id=$1 FOR UPDATE",[input.runId]);
  if(runs.length!==1) fail("V3_NATIVE_EVIDENCE_STORY_ROUTE_CONTEXT_MISSING","actual run context is missing");
  const context=z.record(z.string(),z.string()).parse(JSON.parse(runs[0]!.context));
  const current=context.current_story_id;
  if(current&&current!==input.storyId&&current!==success.storyDbId)
    fail("V3_NATIVE_EVIDENCE_STORY_ROUTE_CONTEXT_CONFLICT","another story owns the current context");
  for(const key of ["pr_url","story_branch","current_story_id","current_story_title","current_story","story_base_ref","verify_feedback","previous_failure"])
    delete context[key];
  if(routed) {
    const target=await transaction.unsafe<Array<{id:string}>>(`UPDATE steps
      SET status='pending',current_story_id=$4,updated_at=$5
      WHERE id=$1 AND run_id=$2 AND step_id=$3 AND status IN ('waiting','done','pending') RETURNING id`,
      [route.targetStepDbId!,input.runId,route.targetStepId!,route.type==="story_route_supervise"?success.storyDbId:null,fence.observedAt]);
    if(target.length!==1) fail("V3_NATIVE_EVIDENCE_STORY_ROUTE_CAS_LOST","frozen route changed during acceptance");
    if(route.type==="story_route_supervise") {
      context.supervisor_scope="story";
      context.current_story_id=input.storyId;
      context.current_story_title=row.story_title;
      if(row.story_branch) context.story_branch=row.story_branch;
      if(row.story_pr_url) context.pr_url=row.story_pr_url;
      context.supervised_story_ids=[...new Set((context.supervised_story_ids||"").split(",").map(value=>value.trim())
        .filter(value=>value&&value!==input.storyId))].sort().join(",");
    }
  }
  if(lastDirect&&preparedMerge?.receipt.prUrl) context.final_pr=preparedMerge.receipt.prUrl;
  await transaction.unsafe("UPDATE runs SET context=$2,updated_at=$3 WHERE id=$1",[input.runId,JSON.stringify(context),fence.observedAt]);
}

/** Delivery settlement belongs to the SAME transaction as case/story acceptance.
 * No lease is invented: only an already completed canonical nonmodel child can
 * reach this path, and a conflict rolls back all three projections. */
export async function settleNativeEvidenceOnlySuccessInTransaction(
  transaction: TransactionSql,
  input: Readonly<{runId:string;storyId:string;attemptId:string;revisionId:string;dispatchId:string;recoveryCaseId:string}>,
): Promise<boolean> {
  const rows=await transaction.unsafe<Array<{packet_hash:string;slice_hash:string;finding_set_hash:string;
    source_sha:string;source_tree_hash:string;output_hash:string;plan_hash:string;bundle:unknown;
    evidence_plan:unknown;delivery_state:string;terminal_result:unknown}>>(`
    SELECT a.packet_hash,a.slice_hash,a.finding_set_hash,a.source_after_sha AS source_sha,
      a.source_after_tree_hash AS source_tree_hash,a.output_hash,revision.evidence_plan_artifact_hash AS plan_hash,
      bundle.payload AS bundle,revision.evidence_plan,delivery.state AS delivery_state,delivery.terminal_result
    FROM execution_attempts a
    JOIN semantic_artifacts packet ON packet.artifact_hash=a.packet_hash AND packet.artifact_type='setfarm.product-build-packet.v3'
    JOIN recovery_dispatch_deliveries delivery ON delivery.attempt_id=a.attempt_id AND delivery.claim_id=a.claim_id
      AND delivery.run_id=a.run_id AND delivery.story_id=a.story_id AND delivery.execution_slice_hash=a.slice_hash
      AND delivery.dispatch_id=a.recovery_dispatch_id AND delivery.revision_id=a.recovery_case_revision_id
    JOIN recovery_revision_dispatches dispatch ON dispatch.dispatch_id=delivery.dispatch_id AND dispatch.revision_id=delivery.revision_id
      AND dispatch.recovery_case_id=delivery.recovery_case_id AND dispatch.dispatch_class='evidence_only'
      AND dispatch.packet_hash=a.packet_hash AND dispatch.contract_slice_hash=a.slice_hash
      AND dispatch.finding_set_hash=a.finding_set_hash AND dispatch.source_sha=a.source_before_sha
      AND dispatch.source_tree_hash=a.source_before_tree_hash
    JOIN recovery_case_revisions revision ON revision.revision_id=dispatch.revision_id
      AND revision.recovery_case_id=dispatch.recovery_case_id AND revision.evidence_plan=dispatch.evidence_plan
      AND revision.evidence_plan_artifact_hash=dispatch.evidence_plan_artifact_hash
    JOIN recovery_cases recovery ON recovery.recovery_case_id=revision.recovery_case_id
      AND recovery.current_revision_id=revision.revision_id AND recovery.run_id=a.run_id AND recovery.story_id=a.story_id
      AND recovery.owner='infrastructure' AND recovery.status='evidencing'
    JOIN claim_log claim ON claim.id=a.claim_id AND claim.run_id=a.run_id AND claim.story_id=a.story_id
      AND claim.step_id=a.step_id AND claim.agent_id=a.agent_id AND claim.outcome='completed'
    JOIN evidence_bundles bundle ON bundle.evidence_bundle_hash=a.output_hash AND bundle.attempt_id=a.attempt_id
      AND bundle.run_id=a.run_id AND bundle.story_id=a.story_id AND bundle.packet_hash=a.packet_hash
      AND bundle.slice_hash=a.slice_hash AND bundle.source_sha=a.source_after_sha
      AND bundle.source_tree_hash=a.source_after_tree_hash AND bundle.aggregate_verdict='pass'
    WHERE a.attempt_id=$1 AND a.run_id=$2 AND a.story_id=$3 AND a.step_id='implement'
      AND delivery.revision_id=$4 AND delivery.dispatch_id=$5 AND delivery.recovery_case_id=$6
      AND a.attempt_class='evidence_only' AND a.role='evidence-orchestrator' AND a.agent_id='setfarm-evidence-orchestrator'
      AND a.disposition='verified' AND a.source_after_sha=a.source_before_sha AND a.source_after_tree_hash=a.source_before_tree_hash
      AND delivery.attempt_count=1 AND delivery.state IN ('attempt_reserved','running','succeeded')
      AND a.evidence_refs::jsonb ? ('setfarm://evidence-bundle/' || a.output_hash)
      AND a.evidence_refs::jsonb ? ('setfarm://artifact/' || revision.evidence_plan_artifact_hash)
      AND NOT EXISTS(SELECT 1 FROM runtime_sessions r WHERE r.claim_id=a.claim_id OR r.attempt_id=a.attempt_id)
      AND NOT EXISTS(SELECT 1 FROM runtime_completion_requests q WHERE q.claim_id=a.claim_id OR q.attempt_id=a.attempt_id)
    FOR UPDATE OF delivery
  `,[input.attemptId,input.runId,input.storyId,input.revisionId,input.dispatchId,input.recoveryCaseId]);
  if(rows.length!==1) fail("V3_NATIVE_EVIDENCE_SUCCESS_SETTLEMENT_IDENTITY","native verified child/dispatch identity is missing");
  const row=rows[0]!;
  await readNativeEvidenceOnlySourceAuthority(transaction,{...input,packetHash:row.packet_hash,
    contractSliceHash:row.slice_hash,findingSetHash:row.finding_set_hash,
    sourceRevision:{sha:row.source_sha,treeHash:row.source_tree_hash},priorEvidencePlanArtifactHash:row.plan_hash});
  const bundle=EvidenceBundleV2Schema.parse(row.bundle);
  const required=z.array(z.string()).min(1).parse(row.evidence_plan);
  const passed=new Set(bundle.predicates.filter(predicate=>predicate.verdict==='pass').map(predicate=>predicate.predicateRef));
  if(computeEvidenceBundleHash(bundle)!==row.output_hash||bundle.aggregateVerdict!=='pass'
    ||!bundle.predicates.length||bundle.predicates.some(predicate=>predicate.required&&predicate.verdict!=='pass')
    ||required.some(predicate=>!passed.has(predicate)))
    fail("V3_NATIVE_EVIDENCE_SUCCESS_SETTLEMENT_EVIDENCE","canonical unchanged-source evidence does not satisfy its real revision");
  const eventHash=hashCanonicalJson({schema:"setfarm.v3-recovery-coordinator-event.v1",value:{
    kind:"recovery_evidence",recoveryCaseId:input.recoveryCaseId,revisionId:input.revisionId,
    dispatchId:input.dispatchId,attemptId:input.attemptId,evidenceBundleHash:row.output_hash}});
  const result={schema:"setfarm.v3-recovery-coordinator-result.v1",eventHash,
    evidenceBundleHash:row.output_hash,attemptId:input.attemptId,verdict:"pass"};
  if(row.delivery_state==='succeeded'){
    if(!jsonEquals(row.terminal_result,result)) fail("V3_NATIVE_EVIDENCE_SUCCESS_SETTLEMENT_CONFLICT","terminal delivery has another tuple");
    return false;
  }
  const now=await readDatabaseWallClock(transaction,"V3_EVIDENCE_ONLY_PUBLICATION_DATABASE_TIME_UNAVAILABLE");
  const updated=await transaction.unsafe<Array<{dispatch_id:string}>>(`UPDATE recovery_dispatch_deliveries
    SET state='succeeded',terminal_result=$4::text::jsonb,terminal_at=$5,updated_at=$5
    WHERE dispatch_id=$1 AND revision_id=$2 AND attempt_id=$3 AND state=$6 RETURNING dispatch_id`,
    [input.dispatchId,input.revisionId,input.attemptId,JSON.stringify(result),now,row.delivery_state]);
  if(updated.length!==1) fail("V3_NATIVE_EVIDENCE_SUCCESS_SETTLEMENT_CAS_LOST","native delivery changed before atomic acceptance");
  return true;
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
        await assertIndexedArtifacts(transaction, lease, prepared);
        const indexed = await transaction.unsafe<Array<{ artifact_type: string }>>(
          "SELECT artifact_type FROM semantic_artifacts WHERE artifact_hash=$1", [prepared.sliceHash]);
        const native = indexed[0]?.artifact_type === "setfarm.implementation-slice.v2"
          ? await readNativeEvidenceOnlySourceAuthority(transaction, lease) : undefined;
        if (native) {
          const refs = z.array(BoundedIdentitySchema).parse(JSON.parse(native.evidence_refs));
          const origin = `setfarm://preparation-authority-v2/${native.authority_hash}`;
          const custody = refs.filter(ref => ref.startsWith("setfarm://native-git-custody-v1/"));
          if (custody.length !== 1 || !prepared.evidenceRefs.includes(custody[0]!)
            || canonicalJsonStringify(prepared.evidenceRefs.filter(ref => ref.startsWith("setfarm://preparation-authority-v2/"))) !== canonicalJsonStringify([origin])
            || prepared.compilationReportHash !== native.compilation_report_hash
            || prepared.worktree !== native.worktree || prepared.branch !== native.branch
            || prepared.role !== "evidence-orchestrator" || prepared.agentId !== "setfarm-evidence-orchestrator") {
            fail("V3_NATIVE_EVIDENCE_ONLY_ORIGIN_MISMATCH", "non-model publication must inherit the exact accepted native origin");
          }
        }
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
        await assertNoModelPublicationForEvidenceOnlyClaimInTransaction(transaction, {
          claimId,
          runId: lease.runId,
          storyId: lease.storyId,
          dispatchId: lease.dispatchId,
        });
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
          || (native !== undefined && reserved.attempt.generation !== native.generation + 1)
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
        const terminalClose = await resolveInternalProductionExecutionAttemptTerminalAuthorityPairInTransactionV1(
          transaction as PgTransactionSql,
          { attemptId: completed[0]!.attempt_id },
        );
        await closeInternalProductionOwnerReservationV1(
          transaction as PgTransactionSql,
          terminalClose,
        );
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
          || Number(row.delivery_claim_id) !== input.attempt.claimId
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


export type NativeEvidenceContinuationOwner = Readonly<{
  runId:string;storyId:string;packetHash:string;attemptId:string;claimId:number;generation:number;fenceToken:string;
  revisionId:string;dispatchId:string;ownerInstanceId:string;leaseToken:string;
}>;
export async function authenticateNativeEvidenceContinuationOwner(sql:Sql,input:NativeEvidenceContinuationOwner) {
  const {createV3RecoveryOwnerLeaseRepository}=await import("./v3-recovery-owner-lease.js");
  const retained=await createV3RecoveryOwnerLeaseRepository(sql).heartbeatNativeTerminalEvidenceOnly({
    kind:"evidence_only",runId:input.runId,storyId:input.storyId,claimId:input.claimId,claimAgentId:"setfarm-evidence-orchestrator",
    revisionId:input.revisionId,dispatchId:input.dispatchId,ownerInstanceId:input.ownerInstanceId,leaseToken:input.leaseToken,
    attempt:{attemptId:input.attemptId,generation:input.generation,fenceToken:input.fenceToken},
  });
  if(retained.status!=="retained") fail("V3_NATIVE_EVIDENCE_CONTINUATION_LEASE_STALE",retained.reason);
  const terminal=await readNativeEvidenceOnlyTerminalAuthority(sql,{...input,stepId:"implement"});
  if(terminal.stage!=="pending_acceptance"||terminal.storyStatus!=="failed")
    fail("V3_NATIVE_EVIDENCE_CONTINUATION_NOT_PENDING","real pending terminal child required");
  return terminal;
}

const NativeEvidenceMergeReceiptSchema=z.object({
  schema:z.literal("setfarm.v3-native-evidence-continuation.v1"),attemptId:z.string().min(1).max(500),
  generation:z.number().int().positive(),sourceSha:z.string().regex(/^[a-f0-9]{40,64}$/),
  sourceTreeHash:z.string().regex(/^[a-f0-9]{40,64}$/),evidenceBundleHash:Sha256Schema,planHash:Sha256Schema,
  merged:z.array(z.string().min(1).max(500)).min(1).max(5000),conflicted:z.array(z.string()).max(0),
  prUrl:z.string().min(1).max(4000).nullable(),
}).strict();
type NativeEvidenceMergeReceipt=z.infer<typeof NativeEvidenceMergeReceiptSchema>;
export type PreparedNativeEvidenceMerge=Readonly<{
  owner:NativeEvidenceContinuationOwner;stepDbId:string;repo:string;branch:string;
  receipt:NativeEvidenceMergeReceipt;
}>;
const preparedNativeEvidenceMerges=new WeakMap<object,string>();
function nativeEvidenceMergeOutput(receipt:NativeEvidenceMergeReceipt):string {
  return `STATUS: done\nMERGED: ${receipt.merged.join(", ")}\nCONFLICTS: ${receipt.conflicted.join(", ")}\nFINAL_PR: ${receipt.prUrl||"none"}`
    +`\nNATIVE_EVIDENCE_OWNER: ${canonicalJsonStringify(receipt)}`;
}

/** All external merge/PR effects occur while the actual delivery is active,
 * before the acceptance transaction. Crashes replay the same exact candidate
 * through the existing merge reconciliation; they do not rerun evidence. */
export async function prepareNativeEvidenceOnlyContinuation(sql:Sql,owner:NativeEvidenceContinuationOwner)
  :Promise<PreparedNativeEvidenceMerge|undefined> {
  const terminal=await authenticateNativeEvidenceContinuationOwner(sql,owner);
  if(terminal.sourceOwner.completionPlan.continuation.type!=="story_direct_merge") return undefined;
  const rows=await sql.unsafe<Array<{context:string;id:string;active:number;failed:number}>>(`
    SELECT run.context,step.id,
      (SELECT count(*)::integer FROM stories s WHERE s.run_id=run.id AND s.id<>$3 AND s.status IN ('pending','running')) AS active,
      (SELECT count(*)::integer FROM stories s WHERE s.run_id=run.id AND s.id<>$3 AND s.status='failed') AS failed
    FROM runs run JOIN steps step ON step.run_id=run.id AND step.id=$2 AND step.step_id='implement'
      AND step.type='loop' AND step.status IN ('pending','running')
    WHERE run.id=$1 AND run.protocol='v3' AND run.status IN ('running','resuming')`,
    [owner.runId,terminal.sourceOwner.completionPlan.stepDbId,terminal.storyDbId]);
  if(rows.length!==1) fail("V3_NATIVE_EVIDENCE_CONTINUATION_STEP_MISSING","authentic original loop is missing");
  if(rows[0]!.failed!==0) fail("V3_NATIVE_EVIDENCE_CONTINUATION_OTHER_FAILURE","another failed story requires its actual canonical owner");
  const context=z.record(z.string(),z.string()).parse(JSON.parse(rows[0]!.context));
  if(!context.repo||!context.branch) fail("V3_NATIVE_EVIDENCE_CONTINUATION_CONTEXT_MISSING","real repo/feature branch required");
  const {runMergeQueue}=await import("../installer/merge-queue-ops.js");
  const merged=await runMergeQueue(owner.runId,context.repo,context.branch,owner);
  await authenticateNativeEvidenceContinuationOwner(sql,owner);
  if(merged.conflicted.length||!merged.merged.includes(owner.storyId))
    fail("V3_NATIVE_EVIDENCE_CONTINUATION_MERGE_FAILED","actual direct-merge candidate did not succeed");
  const receipt=NativeEvidenceMergeReceiptSchema.parse({schema:"setfarm.v3-native-evidence-continuation.v1",
    attemptId:terminal.attemptId,generation:terminal.generation,sourceSha:terminal.sourceAfter.sha,
    sourceTreeHash:terminal.sourceAfter.treeHash,evidenceBundleHash:terminal.outputHash,
    planHash:hashCanonicalJson(terminal.sourceOwner.completionPlan),merged:merged.merged,conflicted:merged.conflicted,prUrl:merged.prUrl});
  const prepared=Object.freeze({owner:Object.freeze({...owner}),stepDbId:rows[0]!.id,
    repo:context.repo,branch:context.branch,receipt:Object.freeze({...receipt,merged:Object.freeze([...receipt.merged]),conflicted:Object.freeze([...receipt.conflicted])})});
  // Store immutable canonical snapshot; no caller-supplied object can mint it.
  const snapshot:PreparedNativeEvidenceMerge={...prepared,receipt:NativeEvidenceMergeReceiptSchema.parse(prepared.receipt)};
  Object.freeze(snapshot.receipt.merged);Object.freeze(snapshot.receipt.conflicted);Object.freeze(snapshot.receipt);Object.freeze(snapshot);
  preparedNativeEvidenceMerges.set(snapshot,canonicalJsonStringify(snapshot));
  return snapshot;
}

async function recheckPreparedNativeEvidenceMerge(transaction:TransactionSql,prepared:PreparedNativeEvidenceMerge,
  success:Awaited<ReturnType<typeof readNativeEvidenceOnlySuccessAuthority>>,observedAt:Date) {
  if(preparedNativeEvidenceMerges.get(prepared)!==canonicalJsonStringify(prepared)
    ||prepared.owner.attemptId!==success.attemptId||prepared.owner.claimId!==success.claimId
    ||prepared.owner.generation!==success.generation||prepared.stepDbId!==success.sourceOwner.completionPlan.stepDbId
    ||prepared.receipt.sourceSha!==success.sourceAfter.sha||prepared.receipt.sourceTreeHash!==success.sourceAfter.treeHash
    ||prepared.receipt.evidenceBundleHash!==success.outputHash
    ||prepared.receipt.planHash!==hashCanonicalJson(success.sourceOwner.completionPlan))
    fail("V3_NATIVE_EVIDENCE_MERGE_SNAPSHOT_INVALID","actual prepared merge/source owner snapshot is required");
  const rows=await transaction.unsafe<Array<{dispatch_id:string}>>(`SELECT d.dispatch_id
    FROM recovery_dispatch_deliveries d JOIN runs run ON run.id=d.run_id
    WHERE d.dispatch_id=$1 AND d.revision_id=$2 AND d.run_id=$3 AND d.story_id=$4
      AND d.attempt_id=$5 AND d.claim_id=$6 AND d.owner_instance_id=$7 AND d.lease_token=$8
      AND d.state='succeeded' AND d.lease_expires_at>$9
      AND run.context::jsonb->>'repo'=$10 AND run.context::jsonb->>'branch'=$11`,
    [prepared.owner.dispatchId,prepared.owner.revisionId,prepared.owner.runId,prepared.owner.storyId,
      prepared.owner.attemptId,prepared.owner.claimId,prepared.owner.ownerInstanceId,prepared.owner.leaseToken,observedAt,prepared.repo,prepared.branch]);
  if(rows.length!==1) fail("V3_NATIVE_EVIDENCE_MERGE_OWNER_CHANGED","live delivery/repo identity changed before atomic receipt");
}

/** Same-tuple settled receipt replay: no lease acquisition or evidence execution.
 * Existing advancePipeline owns the next SQL mutation/termination guards. */
export async function resumeNativeEvidenceOnlySettledContinuations(sql:Sql,input:Readonly<{workflowId:string;runId?:string}>):Promise<number> {
  const candidates=await sql.unsafe<Array<{run_id:string;story_id:string;attempt_id:string;packet_hash:string;output:string}>>(`
    SELECT a.run_id,a.story_id,a.attempt_id,a.packet_hash,step.output FROM execution_attempts a
    JOIN recovery_dispatch_deliveries d ON d.attempt_id=a.attempt_id AND d.claim_id=a.claim_id AND d.state='succeeded'
    JOIN recovery_cases c ON c.recovery_case_id=d.recovery_case_id AND c.current_revision_id=d.revision_id AND c.status='resolved'
    JOIN runs run ON run.id=a.run_id AND run.protocol='v3' AND run.status IN ('running','resuming')
    JOIN steps step ON step.run_id=a.run_id AND step.step_id='implement' AND step.type='loop' AND step.status='done'
    WHERE run.workflow_id=$1 AND ($2::text IS NULL OR run.id=$2) AND a.attempt_class='evidence_only' AND a.disposition='verified'
      AND step.output LIKE '%NATIVE_EVIDENCE_OWNER: %'
      AND position(('"attemptId":"' || a.attempt_id || '"') in step.output)>0
      AND EXISTS(SELECT 1 FROM steps next WHERE next.run_id=run.id AND next.step_index>step.step_index AND next.status='waiting')
      AND NOT EXISTS(SELECT 1 FROM steps active WHERE active.run_id=run.id AND active.status IN ('pending','running'))
    ORDER BY run.id,a.attempt_id`,[input.workflowId,input.runId??null]);
  let resumed=0;
  for(const candidate of candidates) {
    const success=await readNativeEvidenceOnlySuccessAuthority(sql,{runId:candidate.run_id,stepId:"implement",
      storyId:candidate.story_id,packetHash:candidate.packet_hash,attemptId:candidate.attempt_id});
    const parts=candidate.output.split("\nNATIVE_EVIDENCE_OWNER: ");
    if(parts.length!==2) fail("V3_NATIVE_EVIDENCE_MERGE_RECEIPT_INVALID","one exact stored receipt is required");
    const receipt=NativeEvidenceMergeReceiptSchema.parse(JSON.parse(parts[1]!));
    if(success.storyStatus!=="verified"||success.storyOutput!==success.acceptanceOutput
      ||receipt.attemptId!==success.attemptId||receipt.generation!==success.generation
      ||receipt.sourceSha!==success.sourceAfter.sha||receipt.sourceTreeHash!==success.sourceAfter.treeHash
      ||receipt.evidenceBundleHash!==success.outputHash||receipt.planHash!==hashCanonicalJson(success.sourceOwner.completionPlan)
      ||candidate.output!==nativeEvidenceMergeOutput(receipt)||!receipt.merged.includes(candidate.story_id))
      fail("V3_NATIVE_EVIDENCE_MERGE_RECEIPT_INVALID","stored continuation does not reproduce the actual terminal owner");
    const {advancePipeline}=await import("../installer/step-advance.js");
    await advancePipeline(candidate.run_id);
    resumed+=1;
  }
  return resumed;
}
