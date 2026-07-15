import { randomBytes } from "node:crypto";
import type postgres from "postgres";
import { z } from "zod";

import { readDatabaseWallClock } from "../db/database-wall-clock.js";
import { FindingSetV1Schema } from "../findings/finding-set.js";
import { V3GithubReviewDispatchAuthorityV1Schema } from "../findings/github-review-routing-authority.js";
import { hashCanonicalJson } from "../product-compiler/canonical-json.js";
import { Sha256Schema } from "../product-compiler/schemas/common-v1.js";
import {
  ExpectedDeltaV1Schema,
  RecoveryDispatchClassV1Schema,
  RecoveryOwnerV1Schema,
  RecoveryStatusV1Schema,
} from "./recovery-case.js";
import {
  RecoveryCaseRevisionV1Schema,
  RecoveryRevisionDispatchV1Schema,
  computeRevisionDispatchDedupeKey,
  computeRevisionFindingDispatchKey,
  createRecoveryCaseRevisionV1,
  type RecoveryCaseRevisionV1,
  type RecoveryRevisionDispatchV1,
} from "./recovery-delivery.js";
import {
  parseRecoveryDispatchDeliveryRecord,
  type RecoveryDispatchDeliveryRecord,
} from "./recovery-delivery-terminal-v2.js";
import { lockV3RecoveryRunMutationAuthorityInTransaction } from "./v3-recovery-run-mutation-authority.js";
import { V3DownstreamEvidenceAuthorityV1Schema } from "./v3-downstream-evidence-publication.js";

type Sql = postgres.Sql;
type TransactionSql = postgres.TransactionSql;

type CaseRow = {
  recovery_case_id: string;
  dedupe_key: string;
  run_id: string;
  story_id: string;
  finding_set_hash: string;
  finding_ids: unknown;
  packet_hash: string;
  slice_hash: string;
  source_sha: string;
  source_tree_hash: string;
  current_revision_id: string | null;
  state_version: number;
  status: string;
  owner: string;
  expected_delta: unknown;
  allowed_paths: unknown;
  evidence_plan: unknown;
  max_implement: number;
  max_supervisor_repair: number;
  max_evidence_only: number;
  used_implement: number;
  used_supervisor_repair: number;
  used_evidence_only: number;
  created_at: Date | string;
};

type RevisionRow = {
  revision_id: string;
  recovery_case_id: string;
  revision_number: number;
  parent_revision_id: string | null;
  revision_identity_key: string;
  run_id: string;
  story_id: string;
  finding_set_hash: string;
  finding_ids: unknown;
  packet_hash: string;
  contract_slice_hash: string;
  source_sha: string;
  source_tree_hash: string;
  owner: string;
  expected_delta: unknown;
  allowed_paths: unknown;
  evidence_plan: unknown;
  evidence_plan_artifact_hash: string | null;
  created_at: Date | string;
};

type DispatchRow = {
  dispatch_id: string;
  recovery_case_id: string;
  revision_id: string;
  dispatch_class: string;
  dispatch_dedupe_key: string;
  run_id: string;
  story_id: string;
  source_sha: string;
  source_tree_hash: string;
  packet_hash: string;
  contract_slice_hash: string;
  finding_set_hash: string;
  finding_ids: unknown;
  evidence_plan: unknown;
  evidence_plan_artifact_hash: string | null;
  authorized_at: Date | string;
};

type DeliveryRow = {
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
  terminal_result: unknown;
  diagnostic: string | null;
  authorized_at: Date | string;
  started_at: Date | string | null;
  terminal_at: Date | string | null;
  created_at: Date | string;
  updated_at: Date | string;
};

const RevisionAdvanceInputSchema = z.object({
  recoveryCaseId: z.string().regex(/^RCV_[a-f0-9]{64}$/),
  expectedStateVersion: z.number().int().positive(),
  parentRevisionId: z.string().regex(/^RREV_[a-f0-9]{64}$/),
  findingSetHash: Sha256Schema,
  owner: RecoveryOwnerV1Schema,
  expectedDelta: ExpectedDeltaV1Schema,
  allowedPaths: z.array(z.string().min(1).max(1_024)).max(20_000),
  evidencePlan: z.array(z.string().min(1).max(160)).min(1).max(5_000),
  evidencePlanArtifactHash: Sha256Schema.optional(),
  decisionRef: Sha256Schema,
}).strict();

const AuthorizeInputSchema = z.object({
  recoveryCaseId: z.string().regex(/^RCV_[a-f0-9]{64}$/),
  revisionId: z.string().regex(/^RREV_[a-f0-9]{64}$/),
  expectedStateVersion: z.number().int().positive(),
  dispatchClass: RecoveryDispatchClassV1Schema,
  downstreamEvidence: z.object({
    authority: V3DownstreamEvidenceAuthorityV1Schema,
    attemptId: z.string().regex(/^ATT_[A-Za-z0-9-]{16,160}$/),
    evidenceBundleHash: Sha256Schema,
  }).strict().optional(),
  githubReview: V3GithubReviewDispatchAuthorityV1Schema.optional(),
}).strict().superRefine((value, context) => {
  if (value.downstreamEvidence && value.githubReview) {
    context.addIssue({
      code: "custom",
      path: ["githubReview"],
      message: "One recovery dispatch cannot have downstream and GitHub review authority",
    });
  }
  if (value.githubReview && value.dispatchClass !== "supervisor_repair") {
    context.addIssue({
      code: "custom",
      path: ["dispatchClass"],
      message: "GitHub review input can route only to bounded supervisor repair",
    });
  }
});

const LeaseInputSchema = z.object({
  ownerInstanceId: z.string().min(1).max(500),
  runId: z.string().min(1).max(500).optional(),
  storyId: z.string().min(1).max(500).optional(),
  leaseMs: z.number().int().positive().max(24 * 60 * 60 * 1_000).default(10 * 60 * 1_000),
}).strict();

const CompleteDeliveryInputSchema = z.object({
  dispatchId: z.string().regex(/^RDISP_[a-f0-9]{64}$/),
  revisionId: z.string().regex(/^RREV_[a-f0-9]{64}$/),
  attemptId: z.string().regex(/^ATT_[A-Za-z0-9-]{16,160}$/).optional(),
  state: z.enum(["succeeded", "failed", "blocked", "superseded"]),
  terminalResult: z.record(z.string(), z.unknown()),
  diagnostic: z.string().max(10_000).optional(),
}).strict();

function timestamp(value: Date | string): string {
  return (value instanceof Date ? value : new Date(value)).toISOString();
}

function strings(value: unknown): string[] {
  return z.array(z.string()).parse(value);
}

async function one<T>(
  sql: Pick<Sql, "unsafe"> | Pick<TransactionSql, "unsafe">,
  query: string,
  params: unknown[],
): Promise<T | undefined> {
  const rows = await sql.unsafe<T[]>(query, params as never[]);
  return rows[0];
}

function mapRevision(row: RevisionRow): RecoveryCaseRevisionV1 {
  return RecoveryCaseRevisionV1Schema.parse({
    schema: "setfarm.recovery-case-revision.v1",
    revisionId: row.revision_id,
    revisionIdentityKey: row.revision_identity_key,
    recoveryCaseId: row.recovery_case_id,
    revisionNumber: row.revision_number,
    ...(row.parent_revision_id ? { parentRevisionId: row.parent_revision_id } : {}),
    runId: row.run_id,
    storyId: row.story_id,
    findingSetHash: row.finding_set_hash,
    findingIds: strings(row.finding_ids),
    packetHash: row.packet_hash,
    contractSliceHash: row.contract_slice_hash,
    sourceRevision: { sha: row.source_sha, treeHash: row.source_tree_hash },
    owner: row.owner,
    expectedDelta: row.expected_delta,
    allowedPaths: strings(row.allowed_paths),
    evidencePlan: strings(row.evidence_plan),
    ...(row.evidence_plan_artifact_hash ? { evidencePlanArtifactHash: row.evidence_plan_artifact_hash } : {}),
    createdAt: timestamp(row.created_at),
  });
}

function recoveryRevisionDraftFromCase(
  row: CaseRow,
  lineage: Readonly<{ revisionNumber: number; parentRevisionId?: string }>,
) {
  return {
    recoveryCaseId: row.recovery_case_id,
    revisionNumber: lineage.revisionNumber,
    ...(lineage.parentRevisionId ? { parentRevisionId: lineage.parentRevisionId } : {}),
    runId: row.run_id,
    storyId: row.story_id,
    findingSetHash: row.finding_set_hash,
    findingIds: row.finding_ids,
    packetHash: row.packet_hash,
    contractSliceHash: row.slice_hash,
    sourceRevision: { sha: row.source_sha, treeHash: row.source_tree_hash },
    owner: row.owner,
    expectedDelta: row.expected_delta,
    allowedPaths: row.allowed_paths,
    evidencePlan: row.evidence_plan,
  } as Parameters<typeof createRecoveryCaseRevisionV1>[0];
}

function sameSemanticValue(left: unknown, right: unknown): boolean {
  return hashCanonicalJson(left) === hashCanonicalJson(right);
}

function isExactLegacyRevisionBackfill(
  recovery: CaseRow,
  row: RevisionRow,
  expected: RecoveryCaseRevisionV1,
): boolean {
  return row.revision_id === `RREV_${recovery.dedupe_key}`
    && row.revision_identity_key === recovery.dedupe_key
    && row.recovery_case_id === recovery.recovery_case_id
    && row.revision_number === 1
    && row.parent_revision_id === null
    && row.run_id === expected.runId
    && row.story_id === expected.storyId
    && row.finding_set_hash === expected.findingSetHash
    && sameSemanticValue(row.finding_ids, expected.findingIds)
    && row.packet_hash === expected.packetHash
    && row.contract_slice_hash === expected.contractSliceHash
    && row.source_sha === expected.sourceRevision.sha
    && row.source_tree_hash === expected.sourceRevision.treeHash
    && row.owner === expected.owner
    && sameSemanticValue(row.expected_delta, expected.expectedDelta)
    && sameSemanticValue(row.allowed_paths, expected.allowedPaths)
    && sameSemanticValue(row.evidence_plan, expected.evidencePlan)
    && row.evidence_plan_artifact_hash === null
    && timestamp(row.created_at) === expected.createdAt;
}

async function readOrRehydrateCurrentRevision(
  sql: TransactionSql,
  recoveryCaseId: string,
): Promise<RecoveryCaseRevisionV1 | undefined> {
  const recovery = await one<CaseRow>(
    sql,
    "SELECT * FROM recovery_cases WHERE recovery_case_id = $1 FOR UPDATE",
    [recoveryCaseId],
  );
  if (!recovery || !recovery.current_revision_id) return undefined;
  const row = await one<RevisionRow>(
    sql,
    "SELECT * FROM recovery_case_revisions WHERE revision_id = $1 FOR KEY SHARE",
    [recovery.current_revision_id],
  );
  if (!row) throw new Error(`RECOVERY_CURRENT_REVISION_MISSING:${recoveryCaseId}`);
  const exact = RecoveryCaseRevisionV1Schema.safeParse({
    schema: "setfarm.recovery-case-revision.v1",
    revisionId: row.revision_id,
    revisionIdentityKey: row.revision_identity_key,
    recoveryCaseId: row.recovery_case_id,
    revisionNumber: row.revision_number,
    ...(row.parent_revision_id ? { parentRevisionId: row.parent_revision_id } : {}),
    runId: row.run_id,
    storyId: row.story_id,
    findingSetHash: row.finding_set_hash,
    findingIds: strings(row.finding_ids),
    packetHash: row.packet_hash,
    contractSliceHash: row.contract_slice_hash,
    sourceRevision: { sha: row.source_sha, treeHash: row.source_tree_hash },
    owner: row.owner,
    expectedDelta: row.expected_delta,
    allowedPaths: strings(row.allowed_paths),
    evidencePlan: strings(row.evidence_plan),
    ...(row.evidence_plan_artifact_hash ? { evidencePlanArtifactHash: row.evidence_plan_artifact_hash } : {}),
    createdAt: timestamp(row.created_at),
  });
  if (exact.success) return exact.data;

  let initial: RecoveryCaseRevisionV1;
  try {
    initial = createRecoveryCaseRevisionV1(
      recoveryRevisionDraftFromCase(recovery, { revisionNumber: 1 }),
      { now: new Date(recovery.created_at) },
    );
  } catch (error) {
    throw new Error(`RECOVERY_LEGACY_REVISION_REHYDRATION_SOURCE_INVALID:${recoveryCaseId}`, { cause: error });
  }
  if (!isExactLegacyRevisionBackfill(recovery, row, initial)) {
    throw new Error(`RECOVERY_LEGACY_REVISION_REHYDRATION_IDENTITY_MISMATCH:${recoveryCaseId}`, {
      cause: exact.error,
    });
  }
  const dispatch = await one<{ dispatch_id: string }>(
    sql,
    "SELECT dispatch_id FROM recovery_revision_dispatches WHERE recovery_case_id = $1 LIMIT 1 FOR KEY SHARE",
    [recoveryCaseId],
  );
  if (dispatch) {
    throw new Error(`RECOVERY_LEGACY_REVISION_REHYDRATION_DISPATCH_UNSAFE:${recoveryCaseId}`);
  }
  const extra = await one<{ revision_id: string }>(
    sql,
    "SELECT revision_id FROM recovery_case_revisions WHERE recovery_case_id = $1 AND revision_number <> 1 LIMIT 1 FOR KEY SHARE",
    [recoveryCaseId],
  );
  if (extra) {
    throw new Error(`RECOVERY_LEGACY_REVISION_REHYDRATION_LINEAGE_UNSAFE:${recoveryCaseId}`);
  }
  const compatibility = createRecoveryCaseRevisionV1(
    recoveryRevisionDraftFromCase(recovery, {
      revisionNumber: 2,
      parentRevisionId: row.revision_id,
    }),
    { now: new Date(row.created_at) },
  );
  await sql.unsafe(
    `INSERT INTO recovery_case_revisions (
       revision_id, recovery_case_id, revision_number, parent_revision_id,
       revision_identity_key, run_id, story_id, finding_set_hash, finding_ids,
       packet_hash, contract_slice_hash, source_sha, source_tree_hash,
       owner, expected_delta, allowed_paths, evidence_plan,
       evidence_plan_artifact_hash, created_at
     ) VALUES (
       $1, $2, $3, $4, $5, $6, $7, $8, $9::text::jsonb,
       $10, $11, $12, $13, $14, $15::text::jsonb, $16::text::jsonb,
       $17::text::jsonb, NULL, $18
     )`,
    [
      compatibility.revisionId,
      compatibility.recoveryCaseId,
      compatibility.revisionNumber,
      compatibility.parentRevisionId!,
      compatibility.revisionIdentityKey,
      compatibility.runId,
      compatibility.storyId,
      compatibility.findingSetHash,
      JSON.stringify(compatibility.findingIds),
      compatibility.packetHash,
      compatibility.contractSliceHash,
      compatibility.sourceRevision.sha,
      compatibility.sourceRevision.treeHash,
      compatibility.owner,
      JSON.stringify(compatibility.expectedDelta),
      JSON.stringify(compatibility.allowedPaths),
      JSON.stringify(compatibility.evidencePlan),
      compatibility.createdAt,
    ],
  );
  const updated = await sql.unsafe<Array<{ current_revision_id: string }>>(
    `UPDATE recovery_cases
        SET current_revision_id = $3
      WHERE recovery_case_id = $1
        AND current_revision_id = $2
      RETURNING current_revision_id`,
    [recoveryCaseId, row.revision_id, compatibility.revisionId],
  );
  if (updated.length !== 1) {
    throw new Error(`RECOVERY_LEGACY_REVISION_REHYDRATION_CAS_FAILED:${recoveryCaseId}`);
  }
  return compatibility;
}

function mapDispatch(row: DispatchRow): RecoveryRevisionDispatchV1 {
  return RecoveryRevisionDispatchV1Schema.parse({
    schema: "setfarm.recovery-revision-dispatch.v1",
    dispatchId: row.dispatch_id,
    recoveryCaseId: row.recovery_case_id,
    revisionId: row.revision_id,
    dispatchClass: row.dispatch_class,
    dispatchDedupeKey: row.dispatch_dedupe_key,
    runId: row.run_id,
    storyId: row.story_id,
    sourceRevision: { sha: row.source_sha, treeHash: row.source_tree_hash },
    packetHash: row.packet_hash,
    contractSliceHash: row.contract_slice_hash,
    findingSetHash: row.finding_set_hash,
    findingIds: strings(row.finding_ids),
    evidencePlan: strings(row.evidence_plan),
    ...(row.evidence_plan_artifact_hash ? { evidencePlanArtifactHash: row.evidence_plan_artifact_hash } : {}),
    authorizedAt: timestamp(row.authorized_at),
  });
}

function mapDelivery(row: DeliveryRow): RecoveryDispatchDeliveryRecord {
  return parseRecoveryDispatchDeliveryRecord({
    dispatchId: row.dispatch_id,
    recoveryCaseId: row.recovery_case_id,
    revisionId: row.revision_id,
    runId: row.run_id,
    storyId: row.story_id,
    state: row.state,
    ...(row.owner_instance_id ? { ownerInstanceId: row.owner_instance_id } : {}),
    ...(row.lease_token ? { leaseToken: row.lease_token } : {}),
    ...(row.lease_expires_at ? { leaseExpiresAt: timestamp(row.lease_expires_at) } : {}),
    ...(row.attempt_id ? { attemptId: row.attempt_id } : {}),
    ...(row.claim_id === null ? {} : { claimId: Number(row.claim_id) }),
    ...(row.execution_slice_hash ? { executionSliceHash: row.execution_slice_hash } : {}),
    attemptCount: row.attempt_count,
    terminalResult: z.record(z.string(), z.unknown()).parse(row.terminal_result),
    ...(row.diagnostic ? { diagnostic: row.diagnostic } : {}),
    authorizedAt: timestamp(row.authorized_at),
    ...(row.started_at ? { startedAt: timestamp(row.started_at) } : {}),
    ...(row.terminal_at ? { terminalAt: timestamp(row.terminal_at) } : {}),
    createdAt: timestamp(row.created_at),
    updatedAt: timestamp(row.updated_at),
  });
}

type DownstreamAuthorizationRow = Readonly<{
  run_status: string;
  run_protocol: string;
  run_packet_hash: string | null;
  step_status: string;
  step_id: string;
  parent_claim_outcome: string | null;
  parent_claim_story_id: string | null;
  parent_claim_step_id: string;
  child_claim_outcome: string | null;
  child_claim_story_id: string | null;
  child_claim_step_id: string;
  attempt_id: string;
  attempt_class: string;
  attempt_packet_hash: string | null;
  attempt_slice_hash: string | null;
  attempt_source_before_sha: string;
  attempt_source_before_tree_hash: string;
  attempt_source_after_sha: string | null;
  attempt_source_after_tree_hash: string | null;
  attempt_disposition: string;
  attempt_output_hash: string | null;
  attempt_role: string;
  attempt_recovery_dispatch_id: string | null;
  attempt_recovery_revision_id: string | null;
  bundle_hash: string;
  bundle_attempt_id: string | null;
  bundle_verdict: string;
  bundle_packet_hash: string;
  bundle_slice_hash: string;
  bundle_source_sha: string;
  bundle_source_tree_hash: string;
  finding_packet_hash: string;
  finding_slice_hash: string;
  finding_source_sha: string;
  finding_source_tree_hash: string;
}>;

type GithubReviewAuthorizationRow = Readonly<{
  run_status: string;
  run_protocol: string;
  run_packet_hash: string | null;
  step_status: string;
  step_id: string;
  parent_claim_outcome: string | null;
  parent_claim_story_id: string | null;
  parent_claim_step_id: string;
  child_claim_outcome: string | null;
  child_claim_story_id: string | null;
  child_claim_step_id: string;
  attempt_id: string;
  attempt_step_id: string;
  attempt_story_id: string;
  attempt_class: string;
  attempt_packet_hash: string | null;
  attempt_slice_hash: string | null;
  attempt_source_after_sha: string | null;
  attempt_source_after_tree_hash: string | null;
  attempt_disposition: string;
  finding_payload: unknown;
}>;

async function transitionExactGithubReviewStoryForDispatch(
  transaction: TransactionSql,
  input: z.infer<typeof AuthorizeInputSchema>,
  currentCase: CaseRow,
  revision: RecoveryCaseRevisionV1,
  story: Readonly<{ id: string; status: string }>,
  now: Date,
): Promise<void> {
  const authority = input.githubReview;
  if (!authority) throw new Error("RECOVERY_DISPATCH_GITHUB_AUTHORITY_REQUIRED");
  const rows = await transaction.unsafe<GithubReviewAuthorizationRow[]>(
    `SELECT run_row.status AS run_status,
            run_row.protocol AS run_protocol,
            run_row.packet_hash AS run_packet_hash,
            step_row.status AS step_status,
            step_row.step_id,
            parent_claim.outcome AS parent_claim_outcome,
            parent_claim.story_id AS parent_claim_story_id,
            parent_claim.step_id AS parent_claim_step_id,
            child_claim.outcome AS child_claim_outcome,
            child_claim.story_id AS child_claim_story_id,
            child_claim.step_id AS child_claim_step_id,
            attempt.attempt_id,
            attempt.step_id AS attempt_step_id,
            attempt.story_id AS attempt_story_id,
            attempt.attempt_class,
            attempt.packet_hash AS attempt_packet_hash,
            attempt.slice_hash AS attempt_slice_hash,
            attempt.source_after_sha AS attempt_source_after_sha,
            attempt.source_after_tree_hash AS attempt_source_after_tree_hash,
            attempt.disposition AS attempt_disposition,
            finding_set.payload AS finding_payload
       FROM runs run_row
       JOIN steps step_row
         ON step_row.id = $2 AND step_row.run_id = run_row.id AND step_row.step_id = $3
       JOIN claim_log parent_claim
         ON parent_claim.id = $4 AND parent_claim.run_id = run_row.id
       JOIN execution_attempts attempt
         ON attempt.attempt_id = $5 AND attempt.run_id = run_row.id
       JOIN claim_log child_claim ON child_claim.id = attempt.claim_id
       JOIN finding_sets finding_set
         ON finding_set.finding_set_hash = $6
        AND finding_set.run_id = run_row.id
        AND finding_set.story_id = $7
      WHERE run_row.id = $1
      FOR UPDATE OF run_row, step_row, parent_claim, attempt, child_claim`,
    [
      authority.runId,
      authority.verifyStepDbId,
      authority.workflowStepId,
      authority.parentClaimId,
      authority.implementationAttemptId,
      revision.findingSetHash,
      authority.storyId,
    ],
  );
  const row = rows[0];
  const artifactHashes = authority.reviews.map((review) => review.evidenceArtifactHash);
  const artifactRows = await transaction.unsafe<Array<{ artifact_hash: string; artifact_type: string }>>(
    `SELECT artifact.artifact_hash, artifact.artifact_type
       FROM semantic_artifacts artifact
      WHERE artifact.artifact_hash = ANY($1::text[])
        AND EXISTS (
          SELECT 1 FROM run_artifact_refs artifact_ref
           WHERE artifact_ref.run_id = $2
             AND artifact_ref.artifact_hash = artifact.artifact_hash
        )
      ORDER BY artifact.artifact_hash`,
    [artifactHashes, authority.runId],
  );
  const findingResult = row ? FindingSetV1Schema.safeParse(row.finding_payload) : undefined;
  const findingSet = findingResult?.success ? findingResult.data : undefined;
  const findingsByThread = new Map(
    (findingSet?.findings ?? []).flatMap((finding) =>
      finding.externalRef ? [[finding.externalRef.threadId, finding] as const] : []),
  );
  const reviewFindingsMatch = Boolean(findingSet)
    && findingSet!.findings.length === authority.reviews.length
    && authority.reviews.every((review) => {
      const finding = findingsByThread.get(review.threadId);
      const external = finding?.externalRef;
      const locator = finding?.sourceLocators.length === 1 ? finding.sourceLocators[0] : undefined;
      return Boolean(
        finding
        && external
        && locator
        && finding.origin === "review"
        && finding.classification === "unstructured_review"
        && finding.invariantRef === "INV_UNSTRUCTURED_REVIEW"
        && finding.status === "open"
        && finding.observedEvidenceRefs.length === 1
        && finding.observedEvidenceRefs[0] === review.evidenceArtifactHash
        && external.repositoryNodeId === review.repositoryNodeId
        && external.prNumber === review.prNumber
        && external.threadId === review.threadId
        && external.headSha === review.headSha
        && external.commentRevisionHash === review.bodyRevisionHash
        && (review.commentId === undefined || external.commentId === review.commentId)
        && locator.path === review.path
        && locator.contentHash === review.sourceContentHash
      );
    });
  if (
    rows.length !== 1
    || !row
    || !findingSet
    || !reviewFindingsMatch
    || artifactRows.length !== artifactHashes.length
    || artifactRows.some((artifact) => artifact.artifact_type !== "setfarm.github-review-thread-evidence.v1")
    || authority.runId !== currentCase.run_id
    || authority.storyId !== currentCase.story_id
    || authority.storyDbId !== story.id
    || authority.packetHash !== currentCase.packet_hash
    || authority.contractSliceHash !== currentCase.slice_hash
    || authority.sourceRevision.sha !== currentCase.source_sha
    || authority.sourceRevision.treeHash !== currentCase.source_tree_hash
    || revision.recoveryCaseId !== currentCase.recovery_case_id
    || revision.revisionId !== currentCase.current_revision_id
    || revision.packetHash !== authority.packetHash
    || revision.contractSliceHash !== authority.contractSliceHash
    || revision.sourceRevision.sha !== authority.sourceRevision.sha
    || revision.sourceRevision.treeHash !== authority.sourceRevision.treeHash
    || revision.findingSetHash !== findingSet.findingSetHash
    || row.run_protocol !== "v3"
    || !["running", "resuming"].includes(row.run_status)
    || row.run_packet_hash !== authority.packetHash
    || row.step_status !== "running"
    || row.step_id !== "verify"
    || row.parent_claim_outcome !== null
    || row.parent_claim_story_id !== null
    || row.parent_claim_step_id !== "verify"
    || row.child_claim_outcome !== "completed"
    || row.child_claim_story_id !== authority.storyId
    || row.child_claim_step_id !== "implement"
    || row.attempt_id !== authority.implementationAttemptId
    || row.attempt_step_id !== "implement"
    || row.attempt_story_id !== authority.storyId
    || !["product_implementation", "supervisor_repair"].includes(row.attempt_class)
    || row.attempt_packet_hash !== authority.packetHash
    || row.attempt_slice_hash !== authority.contractSliceHash
    || row.attempt_source_after_sha !== authority.sourceRevision.sha
    || row.attempt_source_after_tree_hash !== authority.sourceRevision.treeHash
    || !["produced_delta", "already_satisfied", "verified"].includes(row.attempt_disposition)
    || findingSet.runId !== authority.runId
    || findingSet.storyId !== authority.storyId
    || findingSet.packetHash !== authority.packetHash
    || findingSet.sliceHash !== authority.contractSliceHash
    || findingSet.sourceRevision.sha !== authority.sourceRevision.sha
    || findingSet.sourceRevision.treeHash !== authority.sourceRevision.treeHash
    || !["done", "failed"].includes(story.status)
  ) {
    throw new Error("RECOVERY_DISPATCH_GITHUB_AUTHORITY_MISMATCH");
  }
  if (story.status === "failed") {
    const dedupeKey = computeRevisionDispatchDedupeKey({
      dispatchClass: input.dispatchClass,
      runId: revision.runId,
      storyId: revision.storyId,
      findingIds: revision.findingIds,
      packetHash: revision.packetHash,
      sourceTreeHash: revision.sourceRevision.treeHash,
      evidencePlan: revision.evidencePlan,
    });
    const duplicate = await one<{ dispatch_id: string }>(
      transaction,
      "SELECT dispatch_id FROM recovery_revision_dispatches WHERE dispatch_dedupe_key = $1",
      [dedupeKey],
    );
    if (!duplicate) throw new Error("RECOVERY_DISPATCH_GITHUB_STORY_ALREADY_FAILED");
    return;
  }
  const transitioned = await transaction.unsafe<Array<{ id: string }>>(
    `UPDATE stories
        SET status = 'failed', claimed_by = NULL, claimed_at = NULL, updated_at = $4
      WHERE id = $1 AND run_id = $2 AND story_id = $3 AND status = 'done'
      RETURNING id`,
    [story.id, authority.runId, authority.storyId, now],
  );
  if (transitioned.length !== 1) throw new Error("RECOVERY_DISPATCH_GITHUB_STORY_CAS_LOST");
}

async function transitionExactDownstreamStoryForDispatch(
  transaction: TransactionSql,
  input: z.infer<typeof AuthorizeInputSchema>,
  currentCase: CaseRow,
  revision: RecoveryCaseRevisionV1,
  story: Readonly<{ id: string; status: string }>,
  now: Date,
): Promise<void> {
  if (input.githubReview) {
    await transitionExactGithubReviewStoryForDispatch(
      transaction,
      input,
      currentCase,
      revision,
      story,
      now,
    );
    return;
  }
  const downstream = input.downstreamEvidence;
  if (!downstream) {
    if (story.status !== "failed") throw new Error(`RECOVERY_DISPATCH_STORY_NOT_FAILED:${story.status}`);
    return;
  }
  const authority = downstream.authority;
  const rows = await transaction.unsafe<DownstreamAuthorizationRow[]>(
    `SELECT run_row.status AS run_status,
            run_row.protocol AS run_protocol,
            run_row.packet_hash AS run_packet_hash,
            step_row.status AS step_status,
            step_row.step_id,
            parent_claim.outcome AS parent_claim_outcome,
            parent_claim.story_id AS parent_claim_story_id,
            parent_claim.step_id AS parent_claim_step_id,
            child_claim.outcome AS child_claim_outcome,
            child_claim.story_id AS child_claim_story_id,
            child_claim.step_id AS child_claim_step_id,
            attempt.attempt_id,
            attempt.attempt_class,
            attempt.packet_hash AS attempt_packet_hash,
            attempt.slice_hash AS attempt_slice_hash,
            attempt.source_before_sha AS attempt_source_before_sha,
            attempt.source_before_tree_hash AS attempt_source_before_tree_hash,
            attempt.source_after_sha AS attempt_source_after_sha,
            attempt.source_after_tree_hash AS attempt_source_after_tree_hash,
            attempt.disposition AS attempt_disposition,
            attempt.output_hash AS attempt_output_hash,
            attempt.role AS attempt_role,
            attempt.recovery_dispatch_id AS attempt_recovery_dispatch_id,
            attempt.recovery_case_revision_id AS attempt_recovery_revision_id,
            bundle.evidence_bundle_hash AS bundle_hash,
            bundle.attempt_id AS bundle_attempt_id,
            bundle.aggregate_verdict AS bundle_verdict,
            bundle.packet_hash AS bundle_packet_hash,
            bundle.slice_hash AS bundle_slice_hash,
            bundle.source_sha AS bundle_source_sha,
            bundle.source_tree_hash AS bundle_source_tree_hash,
            finding_set.packet_hash AS finding_packet_hash,
            finding_set.slice_hash AS finding_slice_hash,
            finding_set.source_sha AS finding_source_sha,
            finding_set.source_tree_hash AS finding_source_tree_hash
       FROM runs run_row
       JOIN steps step_row
         ON step_row.id = $2 AND step_row.run_id = run_row.id AND step_row.step_id = $3
       JOIN claim_log parent_claim
         ON parent_claim.id = $4 AND parent_claim.run_id = run_row.id
       JOIN execution_attempts attempt
         ON attempt.attempt_id = $5 AND attempt.run_id = run_row.id AND attempt.story_id = $6
       JOIN claim_log child_claim ON child_claim.id = attempt.claim_id
       JOIN evidence_bundles bundle
         ON bundle.evidence_bundle_hash = $7 AND bundle.run_id = run_row.id AND bundle.story_id = $6
       JOIN finding_sets finding_set
         ON finding_set.finding_set_hash = $8 AND finding_set.run_id = run_row.id AND finding_set.story_id = $6
      WHERE run_row.id = $1
      FOR UPDATE OF run_row, step_row, parent_claim, attempt, child_claim`,
    [
      authority.runId,
      authority.stepDbId,
      authority.workflowStepId,
      authority.parentClaimId,
      downstream.attemptId,
      authority.storyId,
      downstream.evidenceBundleHash,
      revision.findingSetHash,
    ],
  );
  const row = rows[0];
  if (
    rows.length !== 1
    || !row
    || authority.runId !== currentCase.run_id
    || authority.storyId !== currentCase.story_id
    || authority.storyDbId !== story.id
    || authority.packetHash !== currentCase.packet_hash
    || revision.recoveryCaseId !== currentCase.recovery_case_id
    || revision.revisionId !== currentCase.current_revision_id
    || revision.packetHash !== currentCase.packet_hash
    || revision.contractSliceHash !== currentCase.slice_hash
    || revision.sourceRevision.sha !== currentCase.source_sha
    || revision.sourceRevision.treeHash !== currentCase.source_tree_hash
    || revision.findingSetHash !== currentCase.finding_set_hash
    || row.run_protocol !== "v3"
    || !["running", "resuming"].includes(row.run_status)
    || row.run_packet_hash !== authority.packetHash
    || row.step_status !== "running"
    || row.step_id !== authority.workflowStepId
    || row.parent_claim_outcome !== null
    || row.parent_claim_story_id !== null
    || row.parent_claim_step_id !== authority.workflowStepId
    || row.child_claim_outcome !== "completed"
    || row.child_claim_story_id !== authority.storyId
    || row.child_claim_step_id !== authority.workflowStepId
    || row.attempt_id !== downstream.attemptId
    || row.attempt_class !== "evidence_only"
    || row.attempt_packet_hash !== authority.packetHash
    || row.attempt_slice_hash !== revision.contractSliceHash
    || row.attempt_source_before_sha !== revision.sourceRevision.sha
    || row.attempt_source_before_tree_hash !== revision.sourceRevision.treeHash
    || row.attempt_source_after_sha !== revision.sourceRevision.sha
    || row.attempt_source_after_tree_hash !== revision.sourceRevision.treeHash
    || !["no_progress", "inconclusive"].includes(row.attempt_disposition)
    || row.attempt_output_hash !== downstream.evidenceBundleHash
    || row.attempt_role !== "downstream-evidence-orchestrator"
    || row.attempt_recovery_dispatch_id !== null
    || row.attempt_recovery_revision_id !== null
    || row.bundle_hash !== downstream.evidenceBundleHash
    || row.bundle_attempt_id !== downstream.attemptId
    || !["fail", "inconclusive"].includes(row.bundle_verdict)
    || row.bundle_packet_hash !== authority.packetHash
    || row.bundle_slice_hash !== revision.contractSliceHash
    || row.bundle_source_sha !== revision.sourceRevision.sha
    || row.bundle_source_tree_hash !== revision.sourceRevision.treeHash
    || row.finding_packet_hash !== authority.packetHash
    || row.finding_slice_hash !== revision.contractSliceHash
    || row.finding_source_sha !== revision.sourceRevision.sha
    || row.finding_source_tree_hash !== revision.sourceRevision.treeHash
    || !["done", "verified", "skipped", "failed"].includes(story.status)
  ) {
    throw new Error("RECOVERY_DISPATCH_DOWNSTREAM_AUTHORITY_MISMATCH");
  }
  if (story.status === "failed") return;
  const transitioned = await transaction.unsafe<Array<{ id: string }>>(
    `UPDATE stories
        SET status = 'failed', claimed_by = NULL, claimed_at = NULL, updated_at = $4
      WHERE id = $1 AND run_id = $2 AND story_id = $3
        AND status IN ('done', 'verified', 'skipped')
      RETURNING id`,
    [story.id, authority.runId, authority.storyId, now],
  );
  if (transitioned.length !== 1) throw new Error("RECOVERY_DISPATCH_DOWNSTREAM_STORY_CAS_LOST");
}

function ownerAllowsDispatch(owner: string, dispatchClass: string): boolean {
  if (dispatchClass === "product_implementation") return owner === "implement";
  if (dispatchClass === "supervisor_repair") return owner === "supervisor";
  return owner === "supervisor" || owner === "infrastructure";
}

function budgetColumns(dispatchClass: string) {
  if (dispatchClass === "product_implementation") {
    return { used: "used_implement", max: "max_implement" } as const;
  }
  if (dispatchClass === "supervisor_repair") {
    return { used: "used_supervisor_repair", max: "max_supervisor_repair" } as const;
  }
  return { used: "used_evidence_only", max: "max_evidence_only" } as const;
}

function caseTerminal(status: string): boolean {
  return ["resolved", "blocked", "superseded"].includes(status);
}

export type RevisionAdvanceResult =
  | Readonly<{ status: "advanced"; revision: RecoveryCaseRevisionV1; stateVersion: number }>
  | Readonly<{ status: "duplicate"; revision: RecoveryCaseRevisionV1; stateVersion: number }>
  | Readonly<{ status: "stale_version"; stateVersion: number }>;

export type RevisionDispatchResult =
  | Readonly<{
      status: "authorized";
      dispatch: RecoveryRevisionDispatchV1;
      delivery: RecoveryDispatchDeliveryRecord;
      stateVersion: number;
    }>
  | Readonly<{ status: "duplicate"; dispatch: RecoveryRevisionDispatchV1; delivery: RecoveryDispatchDeliveryRecord }>
  | Readonly<{ status: "finding_conflict"; findingIds: string[] }>
  | Readonly<{ status: "budget_exhausted"; stateVersion: number }>
  | Readonly<{ status: "stale_version"; stateVersion: number }>;

export function createRecoveryDeliveryRepository(sql: Sql) {
  return {
    async findRevision(revisionId: string): Promise<RecoveryCaseRevisionV1 | undefined> {
      const row = await one<RevisionRow>(sql, "SELECT * FROM recovery_case_revisions WHERE revision_id = $1", [revisionId]);
      return row ? mapRevision(row) : undefined;
    },

    async findCurrentRevision(recoveryCaseId: string): Promise<RecoveryCaseRevisionV1 | undefined> {
      try {
        return await sql.begin((transaction) =>
          readOrRehydrateCurrentRevision(transaction, recoveryCaseId));
      } catch (error) {
        throw new Error(`RECOVERY_LEGACY_REVISION_REHYDRATION_REQUIRED:${recoveryCaseId}`, { cause: error });
      }
    },

    async advanceRevision(
      raw: unknown,
      options: Readonly<{ now?: Date }> = {},
    ): Promise<RevisionAdvanceResult> {
      const input = RevisionAdvanceInputSchema.parse(raw);
      const requestedTime = new Date(options.now ?? new Date());
      if (!Number.isFinite(requestedTime.getTime())) throw new Error("RECOVERY_REVISION_TIME_INVALID");
      const identity = await one<{ run_id: string; story_id: string }>(
        sql,
        "SELECT run_id, story_id FROM recovery_cases WHERE recovery_case_id = $1",
        [input.recoveryCaseId],
      );
      if (!identity) throw new Error("RECOVERY_CASE_NOT_FOUND");
      return sql.begin(async (transaction) => {
        const authority = await lockV3RecoveryRunMutationAuthorityInTransaction(transaction, {
          runId: identity.run_id,
          storyId: identity.story_id,
        });
        const now = authority.observedAt;
        const currentCase = await one<CaseRow>(
          transaction,
          "SELECT * FROM recovery_cases WHERE recovery_case_id = $1 FOR UPDATE",
          [input.recoveryCaseId],
        );
        if (!currentCase) throw new Error("RECOVERY_CASE_NOT_FOUND");
        if (currentCase.run_id !== identity.run_id || currentCase.story_id !== identity.story_id) {
          throw new Error("RECOVERY_CASE_STORY_IDENTITY_CHANGED");
        }
        if (currentCase.state_version !== input.expectedStateVersion) {
          return { status: "stale_version" as const, stateVersion: currentCase.state_version };
        }
        if (caseTerminal(currentCase.status)) throw new Error("RECOVERY_CASE_TERMINAL");
        if (currentCase.current_revision_id !== input.parentRevisionId) {
          throw new Error("RECOVERY_REVISION_PARENT_NOT_CURRENT");
        }
        const parentRow = await one<RevisionRow>(
          transaction,
          "SELECT * FROM recovery_case_revisions WHERE revision_id = $1 FOR KEY SHARE",
          [input.parentRevisionId],
        );
        if (!parentRow) throw new Error("RECOVERY_REVISION_PARENT_NOT_FOUND");
        const parent = mapRevision(parentRow);
        const active = await one<{ dispatch_id: string }>(
          transaction,
          `SELECT dispatch_id FROM recovery_dispatch_deliveries
            WHERE recovery_case_id = $1
              AND state IN ('authorized', 'leased', 'attempt_reserved', 'running')
            LIMIT 1 FOR UPDATE`,
          [input.recoveryCaseId],
        );
        if (active) throw new Error("RECOVERY_REVISION_ACTIVE_DELIVERY");
        const findingRow = await one<{ payload: unknown }>(
          transaction,
          "SELECT payload FROM finding_sets WHERE finding_set_hash = $1 FOR KEY SHARE",
          [input.findingSetHash],
        );
        if (!findingRow) throw new Error("RECOVERY_REVISION_FINDING_SET_NOT_FOUND");
        const findingSet = FindingSetV1Schema.parse(findingRow.payload);
        if (
          findingSet.runId !== parent.runId
          || findingSet.storyId !== parent.storyId
          || findingSet.packetHash !== parent.packetHash
        ) throw new Error("RECOVERY_REVISION_FINDING_IDENTITY_MISMATCH");
        const openFindings = findingSet.findings.filter((finding) => finding.status === "open");
        if (openFindings.length === 0) throw new Error("RECOVERY_REVISION_HAS_NO_OPEN_FINDINGS");
        const requiredPredicates = openFindings.flatMap((finding) =>
          finding.expectedPredicateRef ? [finding.expectedPredicateRef] : []);
        if (requiredPredicates.some((predicate) => !input.evidencePlan.includes(predicate))) {
          throw new Error("RECOVERY_REVISION_EVIDENCE_PLAN_INCOMPLETE");
        }
        const revision = createRecoveryCaseRevisionV1({
          recoveryCaseId: input.recoveryCaseId,
          revisionNumber: parent.revisionNumber + 1,
          parentRevisionId: parent.revisionId,
          runId: findingSet.runId,
          storyId: findingSet.storyId,
          findingSetHash: findingSet.findingSetHash,
          findingIds: openFindings.map((finding) => finding.findingId),
          packetHash: findingSet.packetHash,
          contractSliceHash: findingSet.sliceHash,
          sourceRevision: findingSet.sourceRevision,
          owner: input.owner,
          expectedDelta: input.expectedDelta,
          allowedPaths: input.allowedPaths,
          evidencePlan: input.evidencePlan,
          ...(input.evidencePlanArtifactHash ? { evidencePlanArtifactHash: input.evidencePlanArtifactHash } : {}),
        }, { now });
        const duplicate = await one<RevisionRow>(
          transaction,
          "SELECT * FROM recovery_case_revisions WHERE revision_identity_key = $1",
          [revision.revisionIdentityKey],
        );
        if (duplicate) {
          return { status: "duplicate" as const, revision: mapRevision(duplicate), stateVersion: currentCase.state_version };
        }
        await transaction.unsafe(
          `INSERT INTO recovery_case_revisions (
             revision_id, recovery_case_id, revision_number, parent_revision_id,
             revision_identity_key, run_id, story_id, finding_set_hash, finding_ids,
             packet_hash, contract_slice_hash, source_sha, source_tree_hash,
             owner, expected_delta, allowed_paths, evidence_plan,
             evidence_plan_artifact_hash, created_at
           ) VALUES (
             $1, $2, $3, $4, $5, $6, $7, $8, $9::text::jsonb,
             $10, $11, $12, $13, $14, $15::text::jsonb, $16::text::jsonb,
             $17::text::jsonb, $18, $19
           )`,
          [
            revision.revisionId, revision.recoveryCaseId, revision.revisionNumber,
            revision.parentRevisionId!, revision.revisionIdentityKey, revision.runId,
            revision.storyId, revision.findingSetHash, JSON.stringify(revision.findingIds),
            revision.packetHash, revision.contractSliceHash, revision.sourceRevision.sha,
            revision.sourceRevision.treeHash, revision.owner, JSON.stringify(revision.expectedDelta),
            JSON.stringify(revision.allowedPaths), JSON.stringify(revision.evidencePlan),
            revision.evidencePlanArtifactHash ?? null, revision.createdAt,
          ],
        );
        const update = await transaction.unsafe<Array<{ state_version: number }>>(
          `UPDATE recovery_cases
              SET current_revision_id = $3,
                  owner = $4,
                  expected_delta = $5::text::jsonb,
                  allowed_paths = $6::text::jsonb,
                  evidence_plan = $7::text::jsonb,
                  status = 'open',
                  terminal = NULL,
                  decision_refs = (
                    SELECT jsonb_agg(value ORDER BY value)
                      FROM (
                        SELECT DISTINCT value
                          FROM jsonb_array_elements_text(decision_refs || $8::text::jsonb) AS item(value)
                      ) canonical
                  ),
                  state_version = state_version + 1,
                  updated_at = $9
            WHERE recovery_case_id = $1
              AND state_version = $2
            RETURNING state_version`,
          [
            input.recoveryCaseId, input.expectedStateVersion, revision.revisionId,
            revision.owner, JSON.stringify(revision.expectedDelta), JSON.stringify(revision.allowedPaths),
            JSON.stringify(revision.evidencePlan), JSON.stringify([input.decisionRef]), now,
          ],
        );
        if (update.length !== 1) throw new Error("RECOVERY_REVISION_CAS_LOST");
        return { status: "advanced" as const, revision, stateVersion: update[0]!.state_version };
      }) as Promise<RevisionAdvanceResult>;
    },

    async authorizeCurrentRevision(
      raw: unknown,
      options: Readonly<{ now?: Date }> = {},
    ): Promise<RevisionDispatchResult> {
      const input = AuthorizeInputSchema.parse(raw);
      const requestedTime = new Date(options.now ?? new Date());
      if (!Number.isFinite(requestedTime.getTime())) throw new Error("RECOVERY_DISPATCH_TIME_INVALID");
      return sql.begin(async (transaction) => {
        const identity = await one<{ run_id: string; story_id: string }>(
          transaction,
          "SELECT run_id, story_id FROM recovery_cases WHERE recovery_case_id = $1",
          [input.recoveryCaseId],
        );
        if (!identity) throw new Error("RECOVERY_CASE_NOT_FOUND");
        const authority = await lockV3RecoveryRunMutationAuthorityInTransaction(transaction, {
          runId: identity.run_id,
          storyId: identity.story_id,
        });
        const now = authority.observedAt;
        const currentCase = await one<CaseRow>(
          transaction,
          "SELECT * FROM recovery_cases WHERE recovery_case_id = $1 FOR UPDATE",
          [input.recoveryCaseId],
        );
        if (!currentCase) throw new Error("RECOVERY_CASE_NOT_FOUND");
        if (currentCase.run_id !== identity.run_id || currentCase.story_id !== identity.story_id) {
          throw new Error("RECOVERY_CASE_STORY_IDENTITY_CHANGED");
        }
        const storyRows = await transaction.unsafe<Array<{ id: string; status: string }>>(
          `SELECT id, status
             FROM stories
            WHERE run_id = $1 AND story_id = $2
            ORDER BY id
            FOR UPDATE`,
          [currentCase.run_id, currentCase.story_id],
        );
        if (storyRows.length !== 1) {
          throw new Error(`RECOVERY_DISPATCH_STORY_CARDINALITY_INVALID:${storyRows.length}`);
        }
        if (currentCase.state_version !== input.expectedStateVersion) {
          return { status: "stale_version" as const, stateVersion: currentCase.state_version };
        }
        if (caseTerminal(currentCase.status)) throw new Error("RECOVERY_CASE_TERMINAL");
        if (currentCase.current_revision_id !== input.revisionId) {
          throw new Error("RECOVERY_DISPATCH_REVISION_NOT_CURRENT");
        }
        const revisionRow = await one<RevisionRow>(
          transaction,
          "SELECT * FROM recovery_case_revisions WHERE revision_id = $1 FOR KEY SHARE",
          [input.revisionId],
        );
        if (!revisionRow) throw new Error("RECOVERY_REVISION_NOT_FOUND");
        const revision = mapRevision(revisionRow);
        if (!ownerAllowsDispatch(revision.owner, input.dispatchClass)) {
          throw new Error("RECOVERY_DISPATCH_OWNER_MISMATCH");
        }
        await transitionExactDownstreamStoryForDispatch(
          transaction,
          input,
          currentCase,
          revision,
          storyRows[0]!,
          now,
        );
        const dispatchDedupeKey = computeRevisionDispatchDedupeKey({
          dispatchClass: input.dispatchClass,
          runId: revision.runId,
          storyId: revision.storyId,
          findingIds: revision.findingIds,
          packetHash: revision.packetHash,
          sourceTreeHash: revision.sourceRevision.treeHash,
          evidencePlan: revision.evidencePlan,
        });
        await transaction.unsafe("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [dispatchDedupeKey]);
        const duplicateRow = await one<DispatchRow>(
          transaction,
          "SELECT dispatch.*, revision.run_id, revision.story_id FROM recovery_revision_dispatches dispatch JOIN recovery_case_revisions revision USING (revision_id) WHERE dispatch.dispatch_dedupe_key = $1",
          [dispatchDedupeKey],
        );
        if (duplicateRow) {
          const duplicateDelivery = await one<DeliveryRow>(
            transaction,
            "SELECT * FROM recovery_dispatch_deliveries WHERE dispatch_id = $1",
            [duplicateRow.dispatch_id],
          );
          if (!duplicateDelivery) throw new Error("RECOVERY_DISPATCH_DELIVERY_MISSING");
          return { status: "duplicate" as const, dispatch: mapDispatch(duplicateRow), delivery: mapDelivery(duplicateDelivery) };
        }
        const findingKeys = revision.findingIds.map((findingId) => ({
          findingId,
          key: computeRevisionFindingDispatchKey({
            dispatchClass: input.dispatchClass,
            runId: revision.runId,
            storyId: revision.storyId,
            findingId,
            packetHash: revision.packetHash,
            sourceTreeHash: revision.sourceRevision.treeHash,
          }),
        })).sort((left, right) => left.key.localeCompare(right.key));
        for (const finding of findingKeys) {
          await transaction.unsafe("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [finding.key]);
        }
        const conflicts = await transaction.unsafe<Array<{ finding_id: string }>>(
          `SELECT finding_id FROM recovery_revision_dispatch_findings
            WHERE finding_dispatch_key = ANY($1::text[])
            ORDER BY finding_id`,
          [findingKeys.map((finding) => finding.key)],
        );
        if (conflicts.length > 0) {
          return { status: "finding_conflict" as const, findingIds: conflicts.map((row) => row.finding_id) };
        }
        const budget = budgetColumns(input.dispatchClass);
        if (Number(currentCase[budget.used]) >= Number(currentCase[budget.max])) {
          return { status: "budget_exhausted" as const, stateVersion: currentCase.state_version };
        }
        const dispatch = RecoveryRevisionDispatchV1Schema.parse({
          schema: "setfarm.recovery-revision-dispatch.v1",
          dispatchId: `RDISP_${dispatchDedupeKey}`,
          recoveryCaseId: revision.recoveryCaseId,
          revisionId: revision.revisionId,
          dispatchClass: input.dispatchClass,
          dispatchDedupeKey,
          runId: revision.runId,
          storyId: revision.storyId,
          sourceRevision: revision.sourceRevision,
          packetHash: revision.packetHash,
          contractSliceHash: revision.contractSliceHash,
          findingSetHash: revision.findingSetHash,
          findingIds: revision.findingIds,
          evidencePlan: revision.evidencePlan,
          ...(revision.evidencePlanArtifactHash ? { evidencePlanArtifactHash: revision.evidencePlanArtifactHash } : {}),
          authorizedAt: now.toISOString(),
        });
        await transaction.unsafe(
          `INSERT INTO recovery_revision_dispatches (
             dispatch_id, recovery_case_id, revision_id, dispatch_class, dispatch_dedupe_key,
             source_sha, source_tree_hash, packet_hash, contract_slice_hash, finding_set_hash,
             finding_ids, evidence_plan, evidence_plan_artifact_hash, authorized_at
           ) VALUES (
             $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
             $11::text::jsonb, $12::text::jsonb, $13, $14
           )`,
          [
            dispatch.dispatchId, dispatch.recoveryCaseId, dispatch.revisionId,
            dispatch.dispatchClass, dispatch.dispatchDedupeKey, dispatch.sourceRevision.sha,
            dispatch.sourceRevision.treeHash, dispatch.packetHash, dispatch.contractSliceHash,
            dispatch.findingSetHash, JSON.stringify(dispatch.findingIds),
            JSON.stringify(dispatch.evidencePlan), dispatch.evidencePlanArtifactHash ?? null,
            dispatch.authorizedAt,
          ],
        );
        for (const finding of findingKeys) {
          await transaction.unsafe(
            `INSERT INTO recovery_revision_dispatch_findings (
               dispatch_id, finding_id, finding_dispatch_key, run_id, story_id,
               dispatch_class, source_tree_hash, packet_hash, contract_slice_hash, authorized_at
             ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
            [
              dispatch.dispatchId, finding.findingId, finding.key, dispatch.runId,
              dispatch.storyId, dispatch.dispatchClass, dispatch.sourceRevision.treeHash,
              dispatch.packetHash, dispatch.contractSliceHash, dispatch.authorizedAt,
            ],
          );
        }
        const deliveryRow = await one<DeliveryRow>(
          transaction,
          `INSERT INTO recovery_dispatch_deliveries (
             dispatch_id, recovery_case_id, revision_id, run_id, story_id, state,
             attempt_count, terminal_result, authorized_at, created_at, updated_at
           ) VALUES ($1, $2, $3, $4, $5, 'authorized', 0, '{}'::jsonb, $6, $6, $6)
           RETURNING *`,
          [dispatch.dispatchId, dispatch.recoveryCaseId, dispatch.revisionId, dispatch.runId, dispatch.storyId, now],
        );
        if (!deliveryRow) throw new Error("RECOVERY_DELIVERY_INSERT_FAILED");
        const nextStatus = input.dispatchClass === "evidence_only" ? "evidencing" : "repairing";
        RecoveryStatusV1Schema.parse(nextStatus);
        const update = await transaction.unsafe<Array<{ state_version: number }>>(
          `UPDATE recovery_cases
              SET ${budget.used} = ${budget.used} + 1,
                  status = $3,
                  state_version = state_version + 1,
                  updated_at = $4
            WHERE recovery_case_id = $1 AND state_version = $2
            RETURNING state_version`,
          [input.recoveryCaseId, input.expectedStateVersion, nextStatus, now],
        );
        if (update.length !== 1) throw new Error("RECOVERY_DISPATCH_CAS_LOST");
        return {
          status: "authorized" as const,
          dispatch,
          delivery: mapDelivery(deliveryRow),
          stateVersion: update[0]!.state_version,
        };
      }) as Promise<RevisionDispatchResult>;
    },

    async findDispatch(dispatchId: string): Promise<RecoveryRevisionDispatchV1 | undefined> {
      const row = await one<DispatchRow>(
        sql,
        "SELECT dispatch.*, revision.run_id, revision.story_id FROM recovery_revision_dispatches dispatch JOIN recovery_case_revisions revision USING (revision_id) WHERE dispatch.dispatch_id = $1",
        [dispatchId],
      );
      return row ? mapDispatch(row) : undefined;
    },

    async findDelivery(dispatchId: string): Promise<RecoveryDispatchDeliveryRecord | undefined> {
      const row = await one<DeliveryRow>(sql, "SELECT * FROM recovery_dispatch_deliveries WHERE dispatch_id = $1", [dispatchId]);
      return row ? mapDelivery(row) : undefined;
    },

    async findActiveForStory(input: Readonly<{ runId: string; storyId: string }>): Promise<RecoveryDispatchDeliveryRecord | undefined> {
      const row = await one<DeliveryRow>(
        sql,
        `SELECT * FROM recovery_dispatch_deliveries
          WHERE run_id = $1 AND story_id = $2
            AND state IN ('authorized', 'leased', 'attempt_reserved', 'running')
          ORDER BY authorized_at
          LIMIT 1`,
        [input.runId, input.storyId],
      );
      return row ? mapDelivery(row) : undefined;
    },

    async leaseNext(raw: unknown, options: Readonly<{ now?: Date }> = {}): Promise<RecoveryDispatchDeliveryRecord | undefined> {
      const input = LeaseInputSchema.parse(raw);
      const requestedTime = new Date(options.now ?? new Date());
      if (!Number.isFinite(requestedTime.getTime())) throw new Error("RECOVERY_DELIVERY_LEASE_TIME_INVALID");
      const leaseToken = randomBytes(32).toString("hex");
      const discovered = await one<{ dispatch_id: string; run_id: string; story_id: string }>(
        sql,
        `SELECT dispatch_id, run_id, story_id
           FROM recovery_dispatch_deliveries
          WHERE (
                state = 'authorized'
                OR (state = 'leased' AND lease_expires_at <= clock_timestamp())
              )
            AND ($1::text IS NULL OR run_id = $1)
            AND ($2::text IS NULL OR story_id = $2)
          ORDER BY authorized_at, dispatch_id
          LIMIT 1`,
        [input.runId ?? null, input.storyId ?? null],
      );
      if (!discovered) return undefined;
      return sql.begin(async (transaction) => {
        await lockV3RecoveryRunMutationAuthorityInTransaction(transaction, {
          runId: discovered.run_id,
          storyId: discovered.story_id,
        });
        const candidate = await one<DeliveryRow>(
          transaction,
          `SELECT *
             FROM recovery_dispatch_deliveries
            WHERE dispatch_id = $1
              AND (
                    state = 'authorized'
                    OR (state = 'leased' AND lease_expires_at <= clock_timestamp())
                  )
              FOR UPDATE SKIP LOCKED`,
          [discovered.dispatch_id],
        );
        if (!candidate) return undefined;
        const now = await readDatabaseWallClock(
          transaction,
          "RECOVERY_DELIVERY_DATABASE_TIME_UNAVAILABLE",
        );
        if (
          candidate.state === "leased"
          && (!candidate.lease_expires_at || new Date(candidate.lease_expires_at).getTime() > now.getTime())
        ) return undefined;
        const expiresAt = new Date(now.getTime() + input.leaseMs);
        const row = await one<DeliveryRow>(
          transaction,
          `UPDATE recovery_dispatch_deliveries
              SET state = 'leased',
                  owner_instance_id = $2,
                  lease_token = $3,
                  lease_expires_at = $4,
                  updated_at = $1
             WHERE dispatch_id = $5
               AND state = $6
               AND owner_instance_id IS NOT DISTINCT FROM $7::text
               AND lease_token IS NOT DISTINCT FROM $8::text
               AND lease_expires_at IS NOT DISTINCT FROM $9::timestamptz
               AND (state = 'authorized' OR lease_expires_at <= $1)
             RETURNING *`,
          [
            now,
            input.ownerInstanceId,
            leaseToken,
            expiresAt,
            candidate.dispatch_id,
            candidate.state,
            candidate.owner_instance_id,
            candidate.lease_token,
            candidate.lease_expires_at,
          ],
        );
        return row ? mapDelivery(row) : undefined;
      }) as Promise<RecoveryDispatchDeliveryRecord | undefined>;
    },

    async markRunning(input: Readonly<{
      dispatchId: string;
      revisionId: string;
      attemptId: string;
    }>, options: Readonly<{ now?: Date }> = {}): Promise<RecoveryDispatchDeliveryRecord | undefined> {
      const requestedTime = new Date(options.now ?? new Date());
      if (!Number.isFinite(requestedTime.getTime())) throw new Error("RECOVERY_DELIVERY_RUNNING_TIME_INVALID");
      const identity = await one<{ run_id: string; story_id: string }>(
        sql,
        "SELECT run_id, story_id FROM recovery_dispatch_deliveries WHERE dispatch_id = $1",
        [input.dispatchId],
      );
      if (!identity) return undefined;
      return sql.begin(async (transaction) => {
        const authority = await lockV3RecoveryRunMutationAuthorityInTransaction(transaction, {
          runId: identity.run_id,
          storyId: identity.story_id,
        });
        const row = await one<DeliveryRow>(
          transaction,
          `UPDATE recovery_dispatch_deliveries
            SET state = 'running', updated_at = $4
          WHERE dispatch_id = $1 AND revision_id = $2 AND attempt_id = $3
            AND state IN ('attempt_reserved', 'running')
          RETURNING *`,
          [input.dispatchId, input.revisionId, input.attemptId, authority.observedAt],
        );
        return row ? mapDelivery(row) : undefined;
      }) as Promise<RecoveryDispatchDeliveryRecord | undefined>;
    },

    async completeDelivery(raw: unknown, options: Readonly<{ now?: Date }> = {}): Promise<RecoveryDispatchDeliveryRecord | undefined> {
      const input = CompleteDeliveryInputSchema.parse(raw);
      const requestedTime = new Date(options.now ?? new Date());
      if (!Number.isFinite(requestedTime.getTime())) throw new Error("RECOVERY_DELIVERY_COMPLETION_TIME_INVALID");
      const identity = await one<{ run_id: string; story_id: string }>(
        sql,
        "SELECT run_id, story_id FROM recovery_dispatch_deliveries WHERE dispatch_id = $1",
        [input.dispatchId],
      );
      if (!identity) return undefined;
      return sql.begin(async (transaction) => {
        const authority = await lockV3RecoveryRunMutationAuthorityInTransaction(transaction, {
          runId: identity.run_id,
          storyId: identity.story_id,
        });
        const now = authority.observedAt;
        const row = await one<DeliveryRow>(
          transaction,
          `UPDATE recovery_dispatch_deliveries
            SET state = $4,
                terminal_result = $5::text::jsonb,
                diagnostic = $6,
                terminal_at = $7,
                updated_at = $7
          WHERE dispatch_id = $1
            AND revision_id = $2
            AND ($3::text IS NULL OR attempt_id = $3)
            AND state NOT IN ('succeeded', 'failed', 'blocked', 'superseded')
          RETURNING *`,
          [
            input.dispatchId, input.revisionId, input.attemptId ?? null, input.state,
            JSON.stringify(input.terminalResult), input.diagnostic ?? null, now,
          ],
        );
        return row ? mapDelivery(row) : undefined;
      }) as Promise<RecoveryDispatchDeliveryRecord | undefined>;
    },
  };
}

export function recoveryDeliveryDecisionRef(value: unknown): string {
  return hashCanonicalJson({ schema: "setfarm.recovery-delivery-decision.v1", value });
}
