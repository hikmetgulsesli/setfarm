import type postgres from "postgres";
import { z } from "zod";

import {
  reserveAttemptInTransaction,
  createAttemptRepository,
  type AttemptReservationResult,
} from "../execution/attempt-repository.js";
import {
  defaultAttemptIdentityFactory,
  leaseWindow,
} from "../execution/lease-fence.js";
import {
  ExecutionAttemptReservationV1Schema,
  SourceRevisionV1Schema,
  type ExecutionAttemptV1,
  type TerminalAttemptDispositionV1,
} from "../execution/schemas/execution-attempt-v1.js";
import {
  EvidenceBundleV2Schema,
  computeEvidenceBundleHash,
  type EvidenceBundleV2,
} from "../evidence/evidence-bundle-v2.js";
import { FindingSetV1Schema, type FindingSetV1 } from "../findings/finding-set.js";
import { canonicalJsonStringify, hashCanonicalJson } from "../product-compiler/canonical-json.js";
import { Sha256Schema } from "../product-compiler/schemas/common-v1.js";

type Sql = postgres.Sql;
type TransactionSql = postgres.TransactionSql;

const BoundedIdentitySchema = z.string().min(1).max(500);
const DEFAULT_DOWNSTREAM_EVIDENCE_LEASE_MS = 30 * 60 * 1_000;

export const V3DownstreamEvidenceAuthorityV1Schema = z.object({
  schema: z.literal("setfarm.v3-downstream-evidence-authority.v1"),
  runId: BoundedIdentitySchema,
  stepDbId: BoundedIdentitySchema,
  workflowStepId: z.enum(["qa-test", "final-test"]),
  phase: z.enum(["qa", "final", "integration"]),
  parentClaimId: z.number().int().positive(),
  storyDbId: BoundedIdentitySchema,
  storyId: BoundedIdentitySchema,
  packetHash: Sha256Schema,
}).strict().superRefine((value, context) => {
  if (value.phase === "qa" && value.workflowStepId !== "qa-test") {
    context.addIssue({
      code: "custom",
      path: ["workflowStepId"],
      message: "QA evidence must be owned by the qa-test workflow step",
    });
  }
  if (["final", "integration"].includes(value.phase) && value.workflowStepId !== "final-test") {
    context.addIssue({
      code: "custom",
      path: ["workflowStepId"],
      message: "Final and integration evidence must be owned by the final-test workflow step",
    });
  }
});

export type V3DownstreamEvidenceAuthorityV1 = z.infer<typeof V3DownstreamEvidenceAuthorityV1Schema>;

export const V3DownstreamEvidencePreparedAttemptV1Schema = z.object({
  runId: BoundedIdentitySchema,
  stepId: z.enum(["qa-test", "final-test"]),
  storyId: BoundedIdentitySchema,
  attemptClass: z.literal("evidence_only"),
  packetHash: Sha256Schema,
  compilationReportHash: Sha256Schema,
  sliceHash: Sha256Schema,
  sourceBefore: SourceRevisionV1Schema,
  role: z.literal("downstream-evidence-orchestrator"),
  agentId: z.literal("setfarm-downstream-evidence-orchestrator"),
  branch: z.string().min(1).max(1_000).optional(),
  worktree: z.string().min(1).max(4_000),
  evidenceRefs: z.array(BoundedIdentitySchema).max(995),
}).strict();

export type V3DownstreamEvidencePreparedAttemptV1 = z.infer<typeof V3DownstreamEvidencePreparedAttemptV1Schema>;

type AuthorityRow = Readonly<{
  run_status: string;
  run_protocol: string;
  run_packet_hash: string | null;
  step_status: string;
  step_id: string;
  story_status: string;
  story_id: string;
  parent_claim_outcome: string | null;
  parent_claim_story_id: string | null;
  parent_claim_step_id: string;
}>;

type BoundAttemptRow = Readonly<{
  attempt_id: string;
  attempt_disposition: string;
  attempt_packet_hash: string | null;
  attempt_slice_hash: string | null;
  attempt_source_before_sha: string;
  attempt_source_before_tree_hash: string;
  attempt_source_after_sha: string | null;
  attempt_source_after_tree_hash: string | null;
  attempt_claim_id: string | number | null;
  claim_outcome: string | null;
  claim_story_id: string | null;
  claim_step_id: string;
  parent_claim_outcome: string | null;
  run_status: string;
  run_protocol: string;
  run_packet_hash: string | null;
  step_status: string;
  story_status: string;
}>;

export class V3DownstreamEvidencePublicationError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(`${code}:${message}`);
    this.name = "V3DownstreamEvidencePublicationError";
    this.code = code;
  }
}

function fail(code: string, message: string): never {
  throw new V3DownstreamEvidencePublicationError(code, message);
}

function validTime(value?: Date): Date {
  const parsed = new Date(value ?? new Date());
  if (!Number.isFinite(parsed.getTime())) {
    fail("V3_DOWNSTREAM_EVIDENCE_TIME_INVALID", "publication time is invalid");
  }
  return parsed;
}

function sameRevision(
  left: Readonly<{ sha: string; treeHash: string }>,
  right: Readonly<{ sha: string; treeHash: string }>,
): boolean {
  return left.sha === right.sha && left.treeHash === right.treeHash;
}

function storyLockIdentity(
  authority: V3DownstreamEvidenceAuthorityV1,
  source: Readonly<{ sha: string; treeHash: string }>,
): string {
  return hashCanonicalJson({
    schema: "setfarm.v3-downstream-evidence-story-lock.v1",
    runId: authority.runId,
    workflowStepId: authority.workflowStepId,
    storyId: authority.storyId,
    packetHash: authority.packetHash,
    sourceTreeHash: source.treeHash,
  });
}

async function lockStory(
  transaction: TransactionSql,
  authority: V3DownstreamEvidenceAuthorityV1,
  source: Readonly<{ sha: string; treeHash: string }>,
): Promise<void> {
  await transaction.unsafe("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [
    storyLockIdentity(authority, source),
  ]);
}

async function loadAuthority(
  transaction: TransactionSql,
  authority: V3DownstreamEvidenceAuthorityV1,
): Promise<AuthorityRow> {
  const rows = await transaction.unsafe<AuthorityRow[]>(
    `SELECT run_row.status AS run_status,
            run_row.protocol AS run_protocol,
            run_row.packet_hash AS run_packet_hash,
            step_row.status AS step_status,
            step_row.step_id,
            story_row.status AS story_status,
            story_row.story_id,
            parent_claim.outcome AS parent_claim_outcome,
            parent_claim.story_id AS parent_claim_story_id,
            parent_claim.step_id AS parent_claim_step_id
       FROM runs run_row
       JOIN steps step_row
         ON step_row.id = $2
        AND step_row.run_id = run_row.id
       JOIN stories story_row
         ON story_row.id = $5
        AND story_row.run_id = run_row.id
       JOIN claim_log parent_claim
         ON parent_claim.id = $4
        AND parent_claim.run_id = run_row.id
      WHERE run_row.id = $1
        AND step_row.step_id = $3
        AND story_row.story_id = $6
      FOR UPDATE OF run_row, step_row, story_row, parent_claim`,
    [
      authority.runId,
      authority.stepDbId,
      authority.workflowStepId,
      authority.parentClaimId,
      authority.storyDbId,
      authority.storyId,
    ],
  );
  if (rows.length !== 1) {
    fail("V3_DOWNSTREAM_EVIDENCE_AUTHORITY_NOT_FOUND", "run, step, story and parent claim do not form one exact identity");
  }
  return rows[0]!;
}

function assertAuthority(row: AuthorityRow, authority: V3DownstreamEvidenceAuthorityV1): void {
  if (
    row.run_protocol !== "v3"
    || !["running", "resuming"].includes(row.run_status)
    || row.run_packet_hash !== authority.packetHash
    || row.step_id !== authority.workflowStepId
    || row.step_status !== "running"
    || row.story_id !== authority.storyId
    || !["done", "verified", "skipped", "failed"].includes(row.story_status)
    || row.parent_claim_outcome !== null
    || row.parent_claim_story_id !== null
    || row.parent_claim_step_id !== authority.workflowStepId
  ) {
    fail(
      "V3_DOWNSTREAM_EVIDENCE_AUTHORITY_MISMATCH",
      "only the exact active QA/final single-step owner may publish final-source story evidence",
    );
  }
}

async function loadBoundAttempt(
  transaction: TransactionSql,
  authority: V3DownstreamEvidenceAuthorityV1,
  attempt: ExecutionAttemptV1,
): Promise<BoundAttemptRow> {
  const rows = await transaction.unsafe<BoundAttemptRow[]>(
    `SELECT attempt.attempt_id,
            attempt.disposition AS attempt_disposition,
            attempt.packet_hash AS attempt_packet_hash,
            attempt.slice_hash AS attempt_slice_hash,
            attempt.source_before_sha AS attempt_source_before_sha,
            attempt.source_before_tree_hash AS attempt_source_before_tree_hash,
            attempt.source_after_sha AS attempt_source_after_sha,
            attempt.source_after_tree_hash AS attempt_source_after_tree_hash,
            attempt.claim_id AS attempt_claim_id,
            child_claim.outcome AS claim_outcome,
            child_claim.story_id AS claim_story_id,
            child_claim.step_id AS claim_step_id,
            parent_claim.outcome AS parent_claim_outcome,
            run_row.status AS run_status,
            run_row.protocol AS run_protocol,
            run_row.packet_hash AS run_packet_hash,
            step_row.status AS step_status,
            story_row.status AS story_status
       FROM execution_attempts attempt
       JOIN claim_log child_claim ON child_claim.id = attempt.claim_id
       JOIN claim_log parent_claim
         ON parent_claim.id = $2
        AND parent_claim.run_id = attempt.run_id
       JOIN runs run_row ON run_row.id = attempt.run_id
       JOIN steps step_row
         ON step_row.id = $3
        AND step_row.run_id = attempt.run_id
        AND step_row.step_id = attempt.step_id
       JOIN stories story_row
         ON story_row.id = $4
        AND story_row.run_id = attempt.run_id
        AND story_row.story_id = attempt.story_id
      WHERE attempt.attempt_id = $1
        AND attempt.run_id = $5
        AND attempt.step_id = $6
        AND attempt.story_id = $7
        AND attempt.attempt_class = 'evidence_only'
        AND attempt.recovery_dispatch_id IS NULL
        AND attempt.recovery_case_revision_id IS NULL
      FOR UPDATE OF attempt, child_claim, parent_claim, run_row, step_row, story_row`,
    [
      attempt.attemptId,
      authority.parentClaimId,
      authority.stepDbId,
      authority.storyDbId,
      authority.runId,
      authority.workflowStepId,
      authority.storyId,
    ],
  );
  if (rows.length !== 1) {
    fail("V3_DOWNSTREAM_EVIDENCE_ATTEMPT_NOT_FOUND", "attempt is not the exact story-bound downstream evidence owner");
  }
  return rows[0]!;
}

function assertBoundAttempt(
  row: BoundAttemptRow,
  authority: V3DownstreamEvidenceAuthorityV1,
  attempt: ExecutionAttemptV1,
): void {
  if (
    row.attempt_id !== attempt.attemptId
    || Number(row.attempt_claim_id) !== attempt.claimId
    || row.attempt_packet_hash !== authority.packetHash
    || row.attempt_slice_hash !== attempt.sliceHash
    || row.attempt_source_before_sha !== attempt.sourceBefore.sha
    || row.attempt_source_before_tree_hash !== attempt.sourceBefore.treeHash
    || row.claim_story_id !== authority.storyId
    || row.claim_step_id !== authority.workflowStepId
    || row.parent_claim_outcome !== null
    || row.run_protocol !== "v3"
    || !["running", "resuming"].includes(row.run_status)
    || row.run_packet_hash !== authority.packetHash
    || row.step_status !== "running"
    || !["done", "verified", "skipped"].includes(row.story_status)
  ) {
    fail("V3_DOWNSTREAM_EVIDENCE_ATTEMPT_MISMATCH", "claim, attempt, source or parent owner is no longer exact");
  }
}

async function putEvidenceBundle(
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
    const existing = await transaction.unsafe<Array<{ payload: unknown }>>(
      "SELECT payload FROM evidence_bundles WHERE evidence_bundle_hash = $1 FOR KEY SHARE",
      [bundleHash],
    );
    if (
      existing.length !== 1
      || canonicalJsonStringify(EvidenceBundleV2Schema.parse(existing[0]!.payload)) !== canonicalJsonStringify(bundle)
    ) {
      fail("V3_DOWNSTREAM_EVIDENCE_BUNDLE_COLLISION", "stored evidence differs from its content hash");
    }
  }
  return bundleHash;
}

async function putFindingSet(
  transaction: TransactionSql,
  findingSet: FindingSetV1,
): Promise<void> {
  await transaction.unsafe("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [findingSet.findingSetHash]);
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
    const existing = await transaction.unsafe<Array<{ payload: unknown }>>(
      "SELECT payload FROM finding_sets WHERE finding_set_hash = $1 FOR KEY SHARE",
      [findingSet.findingSetHash],
    );
    if (
      existing.length !== 1
      || canonicalJsonStringify(FindingSetV1Schema.parse(existing[0]!.payload)) !== canonicalJsonStringify(findingSet)
    ) {
      fail("V3_DOWNSTREAM_EVIDENCE_FINDING_COLLISION", "stored finding set differs from its content hash");
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

function assertTerminalEvidence(input: Readonly<{
  authority: V3DownstreamEvidenceAuthorityV1;
  attempt: ExecutionAttemptV1;
  bundle: EvidenceBundleV2;
  findingSet?: FindingSetV1;
  disposition: TerminalAttemptDispositionV1;
}>): void {
  const { authority, attempt, bundle, findingSet, disposition } = input;
  if (
    bundle.attemptId !== attempt.attemptId
    || bundle.runId !== authority.runId
    || bundle.storyId !== authority.storyId
    || bundle.packetHash !== authority.packetHash
    || bundle.sliceHash !== attempt.sliceHash
    || !sameRevision(bundle.sourceRevision, attempt.sourceBefore)
    || bundle.aggregateVerdict === "incomplete"
    || (bundle.aggregateVerdict === "pass") !== (findingSet === undefined)
    || (bundle.aggregateVerdict === "pass" && disposition !== "verified")
    || (bundle.aggregateVerdict === "fail" && disposition !== "no_progress")
    || (bundle.aggregateVerdict === "inconclusive" && disposition !== "inconclusive")
  ) {
    fail("V3_DOWNSTREAM_EVIDENCE_TERMINAL_MISMATCH", "terminal evidence and exact final-source attempt disagree");
  }
  if (findingSet && (
    findingSet.runId !== bundle.runId
    || findingSet.storyId !== bundle.storyId
    || findingSet.packetHash !== bundle.packetHash
    || findingSet.sliceHash !== bundle.sliceHash
    || !sameRevision(findingSet.sourceRevision, bundle.sourceRevision)
  )) {
    fail("V3_DOWNSTREAM_EVIDENCE_FINDING_MISMATCH", "finding set is not bound to the exact final-source bundle");
  }
}

export function createV3DownstreamEvidencePublication(sql: Sql) {
  const attempts = createAttemptRepository(sql);

  return Object.freeze({
    async reserve(
      rawAuthority: unknown,
      rawPrepared: unknown,
      options: Readonly<{ now?: Date; leaseMs?: number }> = {},
    ): Promise<AttemptReservationResult> {
      const authority = V3DownstreamEvidenceAuthorityV1Schema.parse(rawAuthority);
      const prepared = V3DownstreamEvidencePreparedAttemptV1Schema.parse(rawPrepared);
      const now = validTime(options.now);
      if (
        prepared.runId !== authority.runId
        || prepared.stepId !== authority.workflowStepId
        || prepared.storyId !== authority.storyId
        || prepared.packetHash !== authority.packetHash
      ) {
        fail("V3_DOWNSTREAM_EVIDENCE_PREPARED_IDENTITY_MISMATCH", "compiled slice differs from downstream authority");
      }

      const result = await sql.begin(async (transaction) => {
        await lockStory(transaction, authority, prepared.sourceBefore);
        const authorityRow = await loadAuthority(transaction, authority);
        assertAuthority(authorityRow, authority);
        const terminations = await transaction.unsafe<Array<{ request_id: string }>>(
          "SELECT request_id FROM run_termination_requests WHERE run_id = $1 AND state <> 'terminalized' LIMIT 1 FOR UPDATE",
          [authority.runId],
        );
        if (terminations.length > 0) {
          fail("V3_DOWNSTREAM_EVIDENCE_TERMINATION_PENDING", "run termination owns the next lifecycle transition");
        }
        const prior = await transaction.unsafe<Array<{
          attempt_id: string;
          disposition: string;
          generation: number;
          fence_token: string;
          claim_id: string;
          lease_expires_at: Date | string;
        }>>(
          `SELECT attempt_id, disposition, generation, fence_token,
                  claim_id::text, lease_expires_at
             FROM execution_attempts
            WHERE run_id = $1
              AND step_id = $2
              AND story_id = $3
              AND attempt_class = 'evidence_only'
              AND packet_hash = $4
              AND slice_hash = $5
              AND source_before_sha = $6
              AND source_before_tree_hash = $7
              AND recovery_dispatch_id IS NULL
              AND recovery_case_revision_id IS NULL
              AND role = 'downstream-evidence-orchestrator'
            ORDER BY generation DESC
            LIMIT 1 FOR UPDATE`,
          [
            authority.runId,
            authority.workflowStepId,
            authority.storyId,
            authority.packetHash,
            prepared.sliceHash,
            prepared.sourceBefore.sha,
            prepared.sourceBefore.treeHash,
          ],
        );
        if (prior[0]) {
          if (authorityRow.story_status === "failed" && ["claimed", "running"].includes(prior[0].disposition)) {
            fail("V3_DOWNSTREAM_EVIDENCE_FAILED_STORY_ACTIVE_ATTEMPT", "failed story replay requires terminal canonical evidence");
          }
          if (
            ["claimed", "running"].includes(prior[0].disposition)
            && new Date(prior[0].lease_expires_at).getTime() <= now.getTime()
          ) {
            const lease = leaseWindow(now, options.leaseMs ?? DEFAULT_DOWNSTREAM_EVIDENCE_LEASE_MS);
            const fenceToken = defaultAttemptIdentityFactory.fenceToken();
            const adopted = await transaction.unsafe<Array<{ attempt_id: string }>>(
              `UPDATE execution_attempts
                  SET generation = generation + 1,
                      fence_token = $2,
                      disposition = 'claimed',
                      lease_acquired_at = $3,
                      lease_expires_at = $4,
                      heartbeat_at = $3,
                      updated_at = $3
                WHERE attempt_id = $1
                  AND generation = $5
                  AND fence_token = $6
                  AND claim_id = $7
                  AND disposition IN ('claimed', 'running')
                  AND lease_expires_at <= $3
                  AND source_after_sha IS NULL
                  AND source_after_tree_hash IS NULL
                  AND output_hash IS NULL
                RETURNING attempt_id`,
              [
                prior[0].attempt_id,
                fenceToken,
                lease.acquiredAt,
                lease.expiresAt,
                prior[0].generation,
                prior[0].fence_token,
                prior[0].claim_id,
              ],
            );
            if (adopted.length !== 1) {
              fail("V3_DOWNSTREAM_EVIDENCE_ADOPTION_CAS_LOST", "expired downstream evidence owner changed before fenced adoption");
            }
            return { status: "reserved" as const, attemptId: prior[0].attempt_id };
          }
          return {
            status: ["claimed", "running"].includes(prior[0].disposition) ? "active_conflict" as const : "duplicate" as const,
            attemptId: prior[0].attempt_id,
          };
        }
        if (authorityRow.story_status === "failed") {
          fail("V3_DOWNSTREAM_EVIDENCE_FAILED_STORY_REPLAY_MISSING", "failed story cannot allocate new downstream evidence work");
        }
        const openChildren = await transaction.unsafe<Array<{ id: string }>>(
          `SELECT id::text
             FROM claim_log
            WHERE run_id = $1 AND step_id = $2 AND story_id = $3 AND outcome IS NULL
            FOR UPDATE`,
          [authority.runId, authority.workflowStepId, authority.storyId],
        );
        if (openChildren.length > 0) {
          fail("V3_DOWNSTREAM_EVIDENCE_CHILD_CLAIM_CONFLICT", "story already has an active downstream evidence owner");
        }
        const claimRows = await transaction.unsafe<Array<{ id: string }>>(
          `INSERT INTO claim_log (run_id, step_id, story_id, agent_id, claimed_at)
           VALUES ($1, $2, $3, $4, $5)
           RETURNING id::text`,
          [
            authority.runId,
            authority.workflowStepId,
            authority.storyId,
            prepared.agentId,
            now,
          ],
        );
        const claimId = Number(claimRows[0]?.id);
        if (!Number.isSafeInteger(claimId) || claimId <= 0) {
          fail("V3_DOWNSTREAM_EVIDENCE_CHILD_CLAIM_INVALID", "story evidence claim was not allocated");
        }
        const reservation = ExecutionAttemptReservationV1Schema.parse({
          ...prepared,
          claimId,
          evidenceRefs: [`setfarm://claim-log/${claimId}`, ...prepared.evidenceRefs],
        });
        const reserved = await reserveAttemptInTransaction(transaction, reservation, {
          now,
          leaseMs: options.leaseMs ?? DEFAULT_DOWNSTREAM_EVIDENCE_LEASE_MS,
        });
        if (reserved.status !== "reserved") {
          fail("V3_DOWNSTREAM_EVIDENCE_ATTEMPT_CONFLICT", `exact reservation returned ${reserved.status}`);
        }
        return { status: "reserved" as const, attemptId: reserved.attempt.attemptId };
      });
      const attempt = await attempts.findById(result.attemptId);
      if (!attempt) {
        fail("V3_DOWNSTREAM_EVIDENCE_ATTEMPT_MISSING", "reserved or replay attempt is not durably readable");
      }
      return { status: result.status, attempt } as AttemptReservationResult;
    },

    async markRunning(input: Readonly<{
      authority: V3DownstreamEvidenceAuthorityV1;
      attempt: ExecutionAttemptV1;
      now?: Date;
    }>): Promise<ExecutionAttemptV1> {
      const authority = V3DownstreamEvidenceAuthorityV1Schema.parse(input.authority);
      const now = validTime(input.now);
      await sql.begin(async (transaction) => {
        await lockStory(transaction, authority, input.attempt.sourceBefore);
        const row = await loadBoundAttempt(transaction, authority, input.attempt);
        assertBoundAttempt(row, authority, input.attempt);
        if (row.claim_outcome !== null || !["claimed", "running"].includes(row.attempt_disposition)) {
          fail("V3_DOWNSTREAM_EVIDENCE_RUNNING_OWNER_INVALID", "only the exact open child claim may enter running");
        }
        const updated = await transaction.unsafe<Array<{ attempt_id: string }>>(
          `UPDATE execution_attempts
              SET disposition = 'running', heartbeat_at = $4, updated_at = $4
            WHERE attempt_id = $1 AND generation = $2 AND fence_token = $3
              AND disposition IN ('claimed', 'running')
            RETURNING attempt_id`,
          [input.attempt.attemptId, input.attempt.generation, input.attempt.fenceToken, now],
        );
        if (updated.length !== 1) {
          fail("V3_DOWNSTREAM_EVIDENCE_RUNNING_CAS_LOST", "attempt changed before running publication");
        }
      });
      const attempt = await attempts.findById(input.attempt.attemptId);
      if (!attempt) fail("V3_DOWNSTREAM_EVIDENCE_ATTEMPT_MISSING", "running attempt disappeared");
      return attempt;
    },

    async complete(input: Readonly<{
      authority: V3DownstreamEvidenceAuthorityV1;
      attempt: ExecutionAttemptV1;
      disposition: TerminalAttemptDispositionV1;
      bundle: EvidenceBundleV2;
      findingSet?: FindingSetV1;
      now?: Date;
    }>): Promise<ExecutionAttemptV1> {
      const authority = V3DownstreamEvidenceAuthorityV1Schema.parse(input.authority);
      const bundle = EvidenceBundleV2Schema.parse(input.bundle);
      const findingSet = input.findingSet ? FindingSetV1Schema.parse(input.findingSet) : undefined;
      const now = validTime(input.now);
      assertTerminalEvidence({
        authority,
        attempt: input.attempt,
        bundle,
        ...(findingSet ? { findingSet } : {}),
        disposition: input.disposition,
      });
      const bundleHash = computeEvidenceBundleHash(bundle);
      await sql.begin(async (transaction) => {
        await lockStory(transaction, authority, input.attempt.sourceBefore);
        const row = await loadBoundAttempt(transaction, authority, input.attempt);
        assertBoundAttempt(row, authority, input.attempt);
        if (
          row.claim_outcome !== null
          || !["claimed", "running"].includes(row.attempt_disposition)
          || (row.attempt_source_after_sha !== null && (
            row.attempt_source_after_sha !== input.attempt.sourceBefore.sha
            || row.attempt_source_after_tree_hash !== input.attempt.sourceBefore.treeHash
          ))
        ) {
          fail("V3_DOWNSTREAM_EVIDENCE_TERMINAL_OWNER_INVALID", "only the exact unchanged-source child owner may publish evidence");
        }
        await putEvidenceBundle(transaction, bundle);
        if (findingSet) await putFindingSet(transaction, findingSet);
        const refs = [
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
            WHERE attempt_id = $1 AND generation = $2 AND fence_token = $3
              AND disposition IN ('claimed', 'running')
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
            input.attempt.sourceBefore.sha,
            input.attempt.sourceBefore.treeHash,
            bundleHash,
            JSON.stringify(refs),
            now,
          ],
        );
        if (completed.length !== 1) {
          fail("V3_DOWNSTREAM_EVIDENCE_TERMINAL_CAS_LOST", "attempt changed before terminal publication");
        }
        const claims = await transaction.unsafe<Array<{ id: string }>>(
          `UPDATE claim_log
              SET outcome = 'completed',
                  duration_ms = LEAST(
                    CAST(EXTRACT(EPOCH FROM ($2::timestamptz - claimed_at::timestamptz)) * 1000 AS BIGINT),
                    2147483647
                  )::INTEGER,
                  diagnostic = $3
            WHERE id = $1 AND outcome IS NULL
            RETURNING id::text`,
          [
            input.attempt.claimId!,
            now,
            `Canonical ${authority.phase} evidence ${bundleHash} published for ${authority.storyId}`,
          ],
        );
        if (claims.length !== 1) {
          fail("V3_DOWNSTREAM_EVIDENCE_CHILD_CLAIM_CAS_LOST", "child evidence claim changed before completion");
        }
      });
      const attempt = await attempts.findById(input.attempt.attemptId);
      if (!attempt || attempt.outputHash !== bundleHash) {
        fail("V3_DOWNSTREAM_EVIDENCE_TERMINAL_ATTEMPT_MISSING", "terminal evidence attempt is not durably readable");
      }
      return attempt;
    },
  });
}
