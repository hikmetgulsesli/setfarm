import type postgres from "postgres";
import { z } from "zod";

import { computeEvidenceBundleHash, EvidenceBundleV2Schema, type EvidenceBundleV2 } from "../evidence/evidence-bundle-v2.js";
import { FindingSetV1Schema, type FindingSetV1 } from "../findings/finding-set.js";
import { hashCanonicalJson } from "../product-compiler/canonical-json.js";
import { Sha256Schema } from "../product-compiler/schemas/common-v1.js";
import { SourceRevisionV1Schema } from "../execution/schemas/execution-attempt-v1.js";
import {
  ExpectedDeltaV1Schema,
  RecoveryCaseV1Schema,
  RecoveryDispatchClassV1Schema,
  RecoveryOwnerV1Schema,
  RecoveryStatusV1Schema,
  RecoveryTerminalV1Schema,
  computeRecoveryDispatchDedupeKey,
  computeRecoveryFindingDispatchDedupeKey,
  createRecoveryCaseV1,
  type RecoveryCaseDraftV1,
  type RecoveryCaseV1,
  type RecoveryDispatchAuthorizationV1,
} from "./recovery-case.js";
import { createRecoveryCaseRevisionV1 } from "./recovery-delivery.js";
import { lockV3RecoveryRunMutationAuthorityInTransaction } from "./v3-recovery-run-mutation-authority.js";

type Sql = postgres.Sql;
type TransactionSql = postgres.TransactionSql;

type FindingSetRow = {
  finding_set_hash: string;
  payload: unknown;
};

type EvidenceBundleRow = {
  evidence_bundle_hash: string;
  payload: unknown;
};

type EvidenceAttemptIdentityRow = {
  run_id: string;
  story_id: string;
  packet_hash: string | null;
  slice_hash: string | null;
  source_before_sha: string;
  source_before_tree_hash: string;
  source_after_sha: string | null;
  source_after_tree_hash: string | null;
};

type RecoveryCaseRow = {
  recovery_case_id: string;
  current_revision_id: string | null;
  dedupe_key: string;
  run_id: string;
  story_id: string;
  finding_set_hash: string;
  finding_ids: unknown;
  packet_hash: string;
  slice_hash: string;
  source_sha: string;
  source_tree_hash: string;
  owner: string;
  expected_delta: unknown;
  allowed_paths: unknown;
  evidence_plan: unknown;
  prior_attempt_refs: unknown;
  max_implement: number;
  max_supervisor_repair: number;
  max_evidence_only: number;
  used_implement: number;
  used_supervisor_repair: number;
  used_evidence_only: number;
  status: string;
  terminal: unknown | null;
  decision_refs: unknown;
  state_version: number;
  created_at: Date | string;
  updated_at: Date | string;
};

type RecoveryDispatchRow = {
  dispatch_id: string;
  recovery_case_id: string;
  dispatch_class: string;
  dispatch_dedupe_key: string;
  source_sha: string;
  source_tree_hash: string;
  packet_hash: string;
  slice_hash: string;
  finding_set_hash: string;
  finding_ids: unknown;
  evidence_plan: unknown;
  authorized_at: Date | string;
};

type RecoveryTerminalEvidenceIdentityRow = {
  run_id: string;
  story_id: string;
  packet_hash: string;
  contract_slice_hash: string;
  evidence_plan: unknown;
  delivery_state: string;
  delivery_attempt_id: string | null;
  execution_slice_hash: string | null;
  attempt_disposition: string;
  attempt_source_after_sha: string | null;
  attempt_source_after_tree_hash: string | null;
  attempt_evidence_refs: string;
};

type RecoveryCurrentRevisionIdentityRow = {
  revision_id: string;
  parent_revision_id: string | null;
  run_id: string;
  story_id: string;
  packet_hash: string;
  contract_slice_hash: string;
  source_sha: string;
  source_tree_hash: string;
  evidence_plan: unknown;
};

const RecoveryTerminalEvidenceIdentityV1Schema = z.object({
  revisionId: z.string().regex(/^RREV_[a-f0-9]{64}$/),
  dispatchId: z.string().regex(/^RDISP_[a-f0-9]{64}$/),
  attemptId: z.string().regex(/^ATT_[A-Za-z0-9-]{16,160}$/),
}).strict();

const RecoveryTransitionInputSchema = z.object({
  recoveryCaseId: z.string().regex(/^RCV_[a-f0-9]{64}$/),
  expectedStateVersion: z.number().int().positive(),
  status: RecoveryStatusV1Schema,
  owner: RecoveryOwnerV1Schema.optional(),
  expectedDelta: ExpectedDeltaV1Schema.optional(),
  allowedPaths: z.array(z.string().min(1).max(1_024)).max(20_000).optional(),
  evidencePlan: z.array(z.string().min(1).max(160)).max(5_000).optional(),
  attemptRef: z.string().regex(/^ATT_[A-Za-z0-9-]{16,160}$/).optional(),
  recoveryEvidence: RecoveryTerminalEvidenceIdentityV1Schema.optional(),
  terminal: RecoveryTerminalV1Schema.optional(),
  decisionRef: Sha256Schema,
}).strict().superRefine((value, context) => {
  if (value.recoveryEvidence && !value.terminal?.evidenceBundleHashes.length) {
    context.addIssue({
      code: "custom",
      path: ["recoveryEvidence"],
      message: "Recovery evidence identity is valid only for an evidence-backed terminal transition",
    });
  }
  if (value.recoveryEvidence && value.attemptRef && value.attemptRef !== value.recoveryEvidence.attemptId) {
    context.addIssue({
      code: "custom",
      path: ["attemptRef"],
      message: "Terminal attempt ref must equal the exact recovery evidence attempt",
    });
  }
});

const DispatchInputSchema = z.object({
  recoveryCaseId: z.string().regex(/^RCV_[a-f0-9]{64}$/),
  expectedStateVersion: z.number().int().positive(),
  dispatchClass: RecoveryDispatchClassV1Schema,
  sourceRevision: SourceRevisionV1Schema,
}).strict();

function timestamp(value: Date | string): string {
  return (value instanceof Date ? value : new Date(value)).toISOString();
}

function stringArray(value: unknown): string[] {
  return z.array(z.string()).parse(value);
}

function mapRecoveryCase(row: RecoveryCaseRow): RecoveryCaseV1 {
  return RecoveryCaseV1Schema.parse({
    schema: "setfarm.recovery-case.v1",
    recoveryCaseId: row.recovery_case_id,
    dedupeKey: row.dedupe_key,
    runId: row.run_id,
    storyId: row.story_id,
    findingSetHash: row.finding_set_hash,
    findingIds: stringArray(row.finding_ids),
    packetHash: row.packet_hash,
    sliceHash: row.slice_hash,
    sourceRevision: { sha: row.source_sha, treeHash: row.source_tree_hash },
    owner: row.owner,
    expectedDelta: row.expected_delta,
    allowedPaths: stringArray(row.allowed_paths),
    evidencePlan: stringArray(row.evidence_plan),
    priorAttemptRefs: stringArray(row.prior_attempt_refs),
    budget: {
      limits: {
        implement: row.max_implement,
        supervisorRepair: row.max_supervisor_repair,
        evidenceOnly: row.max_evidence_only,
      },
      used: {
        implement: row.used_implement,
        supervisorRepair: row.used_supervisor_repair,
        evidenceOnly: row.used_evidence_only,
      },
    },
    status: row.status,
    ...(row.terminal === null ? {} : { terminal: row.terminal }),
    decisionRefs: stringArray(row.decision_refs),
    stateVersion: row.state_version,
    createdAt: timestamp(row.created_at),
    updatedAt: timestamp(row.updated_at),
  });
}

function mapDispatch(row: RecoveryDispatchRow): RecoveryDispatchAuthorizationV1 {
  return {
    schema: "setfarm.recovery-dispatch-authorization.v1",
    dispatchId: row.dispatch_id,
    recoveryCaseId: row.recovery_case_id,
    dispatchClass: RecoveryDispatchClassV1Schema.parse(row.dispatch_class),
    dispatchDedupeKey: Sha256Schema.parse(row.dispatch_dedupe_key),
    sourceRevision: SourceRevisionV1Schema.parse({
      sha: row.source_sha,
      treeHash: row.source_tree_hash,
    }),
    packetHash: Sha256Schema.parse(row.packet_hash),
    sliceHash: Sha256Schema.parse(row.slice_hash),
    findingSetHash: Sha256Schema.parse(row.finding_set_hash),
    findingIds: stringArray(row.finding_ids),
    evidencePlan: stringArray(row.evidence_plan),
    authorizedAt: timestamp(row.authorized_at),
  };
}

async function one<T>(
  sql: Pick<Sql, "unsafe"> | Pick<TransactionSql, "unsafe">,
  query: string,
  params: unknown[],
): Promise<T | undefined> {
  const rows = await sql.unsafe<T[]>(query, params as any[]);
  return rows[0];
}

function canonicalEqual(left: unknown, right: unknown): boolean {
  return hashCanonicalJson(left) === hashCanonicalJson(right);
}

function isTerminal(status: RecoveryCaseV1["status"]): boolean {
  return status === "resolved" || status === "blocked" || status === "superseded";
}

const validTransitions = new Map<RecoveryCaseV1["status"], ReadonlySet<RecoveryCaseV1["status"]>>([
  ["open", new Set(["repairing", "evidencing", "resolved", "blocked", "superseded"])],
  ["repairing", new Set(["evidencing", "resolved", "blocked", "superseded"])],
  ["evidencing", new Set(["repairing", "resolved", "blocked", "superseded"])],
  ["resolved", new Set()],
  ["blocked", new Set()],
  ["superseded", new Set()],
]);

function budgetColumn(dispatchClass: z.infer<typeof RecoveryDispatchClassV1Schema>): Readonly<{
  used: "used_implement" | "used_supervisor_repair" | "used_evidence_only";
  max: "max_implement" | "max_supervisor_repair" | "max_evidence_only";
}> {
  if (dispatchClass === "product_implementation") return { used: "used_implement", max: "max_implement" };
  if (dispatchClass === "supervisor_repair") {
    return { used: "used_supervisor_repair", max: "max_supervisor_repair" };
  }
  return { used: "used_evidence_only", max: "max_evidence_only" };
}

function dispatchOwnerIsValid(
  owner: RecoveryCaseV1["owner"],
  dispatchClass: z.infer<typeof RecoveryDispatchClassV1Schema>,
): boolean {
  if (dispatchClass === "product_implementation") return owner === "implement";
  if (dispatchClass === "supervisor_repair") return owner === "supervisor";
  return owner === "supervisor" || owner === "infrastructure";
}

export type PutImmutableResult<T> =
  | Readonly<{ status: "inserted"; value: T }>
  | Readonly<{ status: "duplicate"; value: T }>;

export type OpenRecoveryCaseResult =
  | Readonly<{ status: "opened"; recoveryCase: RecoveryCaseV1 }>
  | Readonly<{ status: "duplicate"; recoveryCase: RecoveryCaseV1 }>;

export type RecoveryTransitionResult =
  | Readonly<{ status: "transitioned"; recoveryCase: RecoveryCaseV1 }>
  | Readonly<{ status: "stale_version"; recoveryCase: RecoveryCaseV1 }>;

export type RecoveryDispatchResult =
  | Readonly<{
      status: "authorized";
      authorization: RecoveryDispatchAuthorizationV1;
      recoveryCase: RecoveryCaseV1;
    }>
  | Readonly<{ status: "duplicate"; authorization: RecoveryDispatchAuthorizationV1 }>
  | Readonly<{ status: "finding_conflict"; conflictingFindingIds: string[] }>
  | Readonly<{ status: "stale_version"; recoveryCase: RecoveryCaseV1 }>
  | Readonly<{ status: "budget_exhausted"; recoveryCase: RecoveryCaseV1 }>;

export function createFindingRecoveryRepository(sql: Sql) {
  return {
    async putFindingSet(input: unknown): Promise<PutImmutableResult<FindingSetV1>> {
      const findingSet = FindingSetV1Schema.parse(input);
      return sql.begin(async (transaction) => {
        await transaction.unsafe("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [
          findingSet.findingSetHash,
        ]);
        const existing = await one<FindingSetRow>(
          transaction,
          "SELECT finding_set_hash, payload FROM finding_sets WHERE finding_set_hash = $1",
          [findingSet.findingSetHash],
        );
        if (existing) {
          const value = FindingSetV1Schema.parse(existing.payload);
          if (!canonicalEqual(value, findingSet)) throw new Error("FINDING_SET_HASH_COLLISION");
          return { status: "duplicate" as const, value };
        }
        await transaction.unsafe(
          `INSERT INTO finding_sets (
             finding_set_hash, finding_set_id, run_id, story_id, packet_hash, slice_hash,
             source_sha, source_tree_hash, finding_ids, payload
           ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::text::jsonb, $10::text::jsonb)`,
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
        return { status: "inserted" as const, value: findingSet };
      }) as Promise<PutImmutableResult<FindingSetV1>>;
    },

    async findFindingSet(findingSetHash: string): Promise<FindingSetV1 | undefined> {
      const hash = Sha256Schema.parse(findingSetHash);
      const row = await one<FindingSetRow>(
        sql,
        "SELECT finding_set_hash, payload FROM finding_sets WHERE finding_set_hash = $1",
        [hash],
      );
      return row ? FindingSetV1Schema.parse(row.payload) : undefined;
    },

    async putEvidenceBundle(input: unknown): Promise<PutImmutableResult<EvidenceBundleV2> & { bundleHash: string }> {
      const bundle = EvidenceBundleV2Schema.parse(input);
      const bundleHash = computeEvidenceBundleHash(bundle);
      return sql.begin(async (transaction) => {
        await transaction.unsafe("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [bundleHash]);
        if (bundle.attemptId) {
          const attempt = await one<EvidenceAttemptIdentityRow>(
            transaction,
            `SELECT run_id, story_id, packet_hash, slice_hash,
                    source_before_sha, source_before_tree_hash,
                    source_after_sha, source_after_tree_hash
               FROM execution_attempts
              WHERE attempt_id = $1
              FOR KEY SHARE`,
            [bundle.attemptId],
          );
          if (
            !attempt
            || !attempt.source_after_sha
            || !attempt.source_after_tree_hash
            || attempt.run_id !== bundle.runId
            || attempt.story_id !== bundle.storyId
            || attempt.packet_hash !== bundle.packetHash
            || attempt.slice_hash !== bundle.sliceHash
            || attempt.source_after_sha !== bundle.sourceRevision.sha
            || attempt.source_after_tree_hash !== bundle.sourceRevision.treeHash
          ) {
            throw new Error("EVIDENCE_ATTEMPT_IDENTITY_MISMATCH");
          }
        }
        const existing = await one<EvidenceBundleRow>(
          transaction,
          "SELECT evidence_bundle_hash, payload FROM evidence_bundles WHERE evidence_bundle_hash = $1",
          [bundleHash],
        );
        if (existing) {
          const value = EvidenceBundleV2Schema.parse(existing.payload);
          if (!canonicalEqual(value, bundle)) throw new Error("EVIDENCE_BUNDLE_HASH_COLLISION");
          return { status: "duplicate" as const, value, bundleHash };
        }
        await transaction.unsafe(
          `INSERT INTO evidence_bundles (
             evidence_bundle_hash, evidence_id, run_id, story_id, packet_hash, slice_hash,
             source_sha, source_tree_hash, attempt_id, aggregate_verdict, payload
           ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::text::jsonb)`,
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
        return { status: "inserted" as const, value: bundle, bundleHash };
      }) as Promise<PutImmutableResult<EvidenceBundleV2> & { bundleHash: string }>;
    },

    async findEvidenceBundle(bundleHash: string): Promise<EvidenceBundleV2 | undefined> {
      const hash = Sha256Schema.parse(bundleHash);
      const row = await one<EvidenceBundleRow>(
        sql,
        "SELECT evidence_bundle_hash, payload FROM evidence_bundles WHERE evidence_bundle_hash = $1",
        [hash],
      );
      return row ? EvidenceBundleV2Schema.parse(row.payload) : undefined;
    },

    async openRecoveryCase(
      input: RecoveryCaseDraftV1,
      options: Readonly<{ now?: Date; evidencePlanArtifactHash?: string }> = {},
    ): Promise<OpenRecoveryCaseResult> {
      if (options.now && !Number.isFinite(new Date(options.now).getTime())) {
        throw new Error("RECOVERY_CASE_TIME_INVALID");
      }
      // Validate the complete draft before touching operational authority;
      // the DB clock below is the only timestamp that can be persisted.
      const validated = createRecoveryCaseV1(input, options);
      return sql.begin(async (transaction) => {
        const authority = await lockV3RecoveryRunMutationAuthorityInTransaction(transaction, {
          runId: validated.runId,
          storyId: validated.storyId,
        });
        const recoveryCase = createRecoveryCaseV1(input, {
          ...options,
          now: authority.observedAt,
        });
        await transaction.unsafe("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [
          recoveryCase.dedupeKey,
        ]);
        const existing = await one<RecoveryCaseRow>(
          transaction,
          "SELECT * FROM recovery_cases WHERE dedupe_key = $1",
          [recoveryCase.dedupeKey],
        );
        if (existing) return { status: "duplicate" as const, recoveryCase: mapRecoveryCase(existing) };

        const findingRow = await one<FindingSetRow>(
          transaction,
          "SELECT finding_set_hash, payload FROM finding_sets WHERE finding_set_hash = $1 FOR KEY SHARE",
          [recoveryCase.findingSetHash],
        );
        if (!findingRow) throw new Error("RECOVERY_FINDING_SET_NOT_FOUND");
        const findingSet = FindingSetV1Schema.parse(findingRow.payload);
        if (
          findingSet.runId !== recoveryCase.runId
          || findingSet.storyId !== recoveryCase.storyId
          || findingSet.packetHash !== recoveryCase.packetHash
          || findingSet.sliceHash !== recoveryCase.sliceHash
          || findingSet.sourceRevision.sha !== recoveryCase.sourceRevision.sha
          || findingSet.sourceRevision.treeHash !== recoveryCase.sourceRevision.treeHash
        ) {
          throw new Error("RECOVERY_FINDING_IDENTITY_MISMATCH");
        }
        const availableFindings = new Map(findingSet.findings.map((finding) => [finding.findingId, finding]));
        const selectedFindings = recoveryCase.findingIds.map((findingId) => availableFindings.get(findingId));
        if (selectedFindings.some((finding) => finding === undefined)) {
          throw new Error("RECOVERY_FINDING_IDENTITY_MISMATCH");
        }
        if (selectedFindings.some((finding) => finding!.status !== "open")) {
          throw new Error("RECOVERY_FINDING_NOT_OPEN");
        }
        const expectedPredicates = selectedFindings.flatMap((finding) =>
          finding!.expectedPredicateRef ? [finding!.expectedPredicateRef] : []);
        if (expectedPredicates.some((reference) => !recoveryCase.evidencePlan.includes(reference))) {
          throw new Error("RECOVERY_EVIDENCE_PLAN_INCOMPLETE");
        }
        if (selectedFindings.some((finding) => finding!.classification === "unstructured_review")) {
          if (recoveryCase.owner !== "supervisor") {
            throw new Error("UNSTRUCTURED_REVIEW_REQUIRES_SUPERVISOR_EVIDENCE_OWNER");
          }
          if (recoveryCase.expectedDelta.kind === "source_change") {
            const exactPaths = [...new Set(selectedFindings.flatMap((finding) =>
              finding!.sourceLocators.map((locator) => locator.path)))].sort();
            const requiredPaths = [...recoveryCase.expectedDelta.requiredPaths].sort();
            const allowedPaths = [...recoveryCase.allowedPaths].sort();
            if (
              recoveryCase.expectedDelta.invariantRefs.length !== 1
              || recoveryCase.expectedDelta.invariantRefs[0] !== "INV_UNSTRUCTURED_REVIEW"
              || requiredPaths.length !== exactPaths.length
              || requiredPaths.some((path, index) => path !== exactPaths[index])
              || allowedPaths.length !== exactPaths.length
              || allowedPaths.some((path, index) => path !== exactPaths[index])
            ) {
              throw new Error("UNSTRUCTURED_REVIEW_SOURCE_AUTHORITY_MISMATCH");
            }
          }
        }
        const row = await one<RecoveryCaseRow>(
          transaction,
          `INSERT INTO recovery_cases (
             recovery_case_id, dedupe_key, run_id, story_id, finding_set_hash, finding_ids,
             packet_hash, slice_hash, source_sha, source_tree_hash, owner, expected_delta,
             allowed_paths, evidence_plan, prior_attempt_refs,
             max_implement, max_supervisor_repair, max_evidence_only,
             used_implement, used_supervisor_repair, used_evidence_only,
             status, terminal, decision_refs, state_version, created_at, updated_at
           ) VALUES (
             $1, $2, $3, $4, $5, $6::text::jsonb,
             $7, $8, $9, $10, $11, $12::text::jsonb,
             $13::text::jsonb, $14::text::jsonb, $15::text::jsonb,
             $16, $17, $18, $19, $20, $21,
             $22, $23::text::jsonb, $24::text::jsonb, $25, $26, $26
           ) RETURNING *`,
          [
            recoveryCase.recoveryCaseId,
            recoveryCase.dedupeKey,
            recoveryCase.runId,
            recoveryCase.storyId,
            recoveryCase.findingSetHash,
            JSON.stringify(recoveryCase.findingIds),
            recoveryCase.packetHash,
            recoveryCase.sliceHash,
            recoveryCase.sourceRevision.sha,
            recoveryCase.sourceRevision.treeHash,
            recoveryCase.owner,
            JSON.stringify(recoveryCase.expectedDelta),
            JSON.stringify(recoveryCase.allowedPaths),
            JSON.stringify(recoveryCase.evidencePlan),
            JSON.stringify(recoveryCase.priorAttemptRefs),
            recoveryCase.budget.limits.implement,
            recoveryCase.budget.limits.supervisorRepair,
            recoveryCase.budget.limits.evidenceOnly,
            recoveryCase.budget.used.implement,
            recoveryCase.budget.used.supervisorRepair,
            recoveryCase.budget.used.evidenceOnly,
            recoveryCase.status,
            recoveryCase.terminal ? JSON.stringify(recoveryCase.terminal) : null,
            JSON.stringify(recoveryCase.decisionRefs),
            recoveryCase.stateVersion,
            recoveryCase.createdAt,
          ],
        );
        if (!row) throw new Error("RECOVERY_CASE_INSERT_FAILED");
        const revision = createRecoveryCaseRevisionV1({
          recoveryCaseId: recoveryCase.recoveryCaseId,
          revisionNumber: 1,
          runId: recoveryCase.runId,
          storyId: recoveryCase.storyId,
          findingSetHash: recoveryCase.findingSetHash,
          findingIds: recoveryCase.findingIds,
          packetHash: recoveryCase.packetHash,
          contractSliceHash: recoveryCase.sliceHash,
          sourceRevision: recoveryCase.sourceRevision,
          owner: recoveryCase.owner,
          expectedDelta: recoveryCase.expectedDelta,
          allowedPaths: recoveryCase.allowedPaths,
          evidencePlan: recoveryCase.evidencePlan,
          ...(options.evidencePlanArtifactHash
            ? { evidencePlanArtifactHash: options.evidencePlanArtifactHash }
            : {}),
        }, { now: new Date(recoveryCase.createdAt) });
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
            revision.revisionId,
            revision.recoveryCaseId,
            revision.revisionNumber,
            revision.parentRevisionId ?? null,
            revision.revisionIdentityKey,
            revision.runId,
            revision.storyId,
            revision.findingSetHash,
            JSON.stringify(revision.findingIds),
            revision.packetHash,
            revision.contractSliceHash,
            revision.sourceRevision.sha,
            revision.sourceRevision.treeHash,
            revision.owner,
            JSON.stringify(revision.expectedDelta),
            JSON.stringify(revision.allowedPaths),
            JSON.stringify(revision.evidencePlan),
            revision.evidencePlanArtifactHash ?? null,
            revision.createdAt,
          ],
        );
        await transaction.unsafe(
          `UPDATE recovery_cases
              SET current_revision_id = $2
            WHERE recovery_case_id = $1`,
          [recoveryCase.recoveryCaseId, revision.revisionId],
        );
        return { status: "opened" as const, recoveryCase: mapRecoveryCase(row) };
      }) as Promise<OpenRecoveryCaseResult>;
    },

    async findRecoveryCase(recoveryCaseId: string): Promise<RecoveryCaseV1 | undefined> {
      const row = await one<RecoveryCaseRow>(
        sql,
        "SELECT * FROM recovery_cases WHERE recovery_case_id = $1",
        [recoveryCaseId],
      );
      return row ? mapRecoveryCase(row) : undefined;
    },

    async transitionRecoveryCase(
      input: unknown,
      options: Readonly<{ now?: Date }> = {},
    ): Promise<RecoveryTransitionResult> {
      const transition = RecoveryTransitionInputSchema.parse(input);
      const requestedTime = new Date(options.now ?? new Date());
      if (!Number.isFinite(requestedTime.getTime())) throw new Error("RECOVERY_TRANSITION_TIME_INVALID");
      return sql.begin(async (transaction) => {
        const identity = await one<{ run_id: string; story_id: string }>(
          transaction,
          "SELECT run_id, story_id FROM recovery_cases WHERE recovery_case_id = $1",
          [transition.recoveryCaseId],
        );
        if (!identity) throw new Error("RECOVERY_CASE_NOT_FOUND");
        const authority = await lockV3RecoveryRunMutationAuthorityInTransaction(transaction, {
          runId: identity.run_id,
          storyId: identity.story_id,
        });
        const now = authority.observedAt;
        const currentRow = await one<RecoveryCaseRow>(
          transaction,
          "SELECT * FROM recovery_cases WHERE recovery_case_id = $1 FOR UPDATE",
          [transition.recoveryCaseId],
        );
        if (!currentRow) throw new Error("RECOVERY_CASE_NOT_FOUND");
        if (currentRow.run_id !== identity.run_id || currentRow.story_id !== identity.story_id) {
          throw new Error("RECOVERY_CASE_STORY_IDENTITY_CHANGED");
        }
        const current = mapRecoveryCase(currentRow);
        if (current.stateVersion !== transition.expectedStateVersion) {
          return { status: "stale_version" as const, recoveryCase: current };
        }
        if (!validTransitions.get(current.status)?.has(transition.status)) {
          throw new Error("RECOVERY_TRANSITION_INVALID");
        }
        if (transition.terminal?.evidenceBundleHashes.length) {
          const evidenceRows = await transaction.unsafe<EvidenceBundleRow[]>(
            `SELECT evidence_bundle_hash, payload
               FROM evidence_bundles
              WHERE evidence_bundle_hash = ANY($1::text[])
              FOR KEY SHARE`,
            [transition.terminal.evidenceBundleHashes],
          );
          if (evidenceRows.length !== new Set(transition.terminal.evidenceBundleHashes).size) {
            throw new Error("RECOVERY_TERMINAL_EVIDENCE_NOT_FOUND");
          }
          const bundles = evidenceRows.map((row) => EvidenceBundleV2Schema.parse(row.payload));
          let requiredEvidencePlan = current.evidencePlan;
          if (transition.recoveryEvidence) {
            const identity = await one<RecoveryTerminalEvidenceIdentityRow>(
              transaction,
              `SELECT revision.run_id,
                      revision.story_id,
                      dispatch.packet_hash,
                      dispatch.contract_slice_hash,
                      dispatch.evidence_plan,
                      delivery.state AS delivery_state,
                      delivery.attempt_id AS delivery_attempt_id,
                      delivery.execution_slice_hash,
                      attempt.disposition AS attempt_disposition,
                      attempt.source_after_sha AS attempt_source_after_sha,
                      attempt.source_after_tree_hash AS attempt_source_after_tree_hash,
                      attempt.evidence_refs AS attempt_evidence_refs
                 FROM recovery_revision_dispatches dispatch
                 JOIN recovery_case_revisions revision
                   ON revision.revision_id = dispatch.revision_id
                  AND revision.recovery_case_id = dispatch.recovery_case_id
                 JOIN recovery_dispatch_deliveries delivery
                   ON delivery.dispatch_id = dispatch.dispatch_id
                  AND delivery.revision_id = dispatch.revision_id
                 JOIN execution_attempts attempt
                   ON attempt.attempt_id = delivery.attempt_id
                  AND attempt.recovery_dispatch_id = dispatch.dispatch_id
                  AND attempt.recovery_case_revision_id = dispatch.revision_id
                WHERE dispatch.dispatch_id = $1
                  AND dispatch.revision_id = $2
                  AND dispatch.recovery_case_id = $3
                  AND delivery.attempt_id = $4
                FOR KEY SHARE OF dispatch, revision, delivery, attempt`,
              [
                transition.recoveryEvidence.dispatchId,
                transition.recoveryEvidence.revisionId,
                current.recoveryCaseId,
                transition.recoveryEvidence.attemptId,
              ],
            );
            if (!identity) throw new Error("RECOVERY_TERMINAL_ATTEMPT_IDENTITY_MISMATCH");
            const currentRevision = currentRow.current_revision_id
              ? await one<RecoveryCurrentRevisionIdentityRow>(
                  transaction,
                  `SELECT revision_id, parent_revision_id, run_id, story_id, packet_hash,
                          contract_slice_hash, source_sha, source_tree_hash, evidence_plan
                     FROM recovery_case_revisions
                    WHERE revision_id = $1 AND recovery_case_id = $2
                    FOR KEY SHARE`,
                  [currentRow.current_revision_id, current.recoveryCaseId],
                )
              : undefined;
            if (
              !currentRevision
              || (
                currentRevision.revision_id !== transition.recoveryEvidence.revisionId
                && currentRevision.parent_revision_id !== transition.recoveryEvidence.revisionId
              )
            ) {
              throw new Error("RECOVERY_TERMINAL_REVISION_NOT_CURRENT");
            }
            const expectedDeliveryState = transition.status === "resolved" ? "succeeded" : undefined;
            if (
              identity.delivery_attempt_id !== transition.recoveryEvidence.attemptId
              || !identity.execution_slice_hash
              || !identity.attempt_source_after_sha
              || !identity.attempt_source_after_tree_hash
              || ["claimed", "running", "superseded"].includes(identity.attempt_disposition)
              || (expectedDeliveryState && identity.delivery_state !== expectedDeliveryState)
              || (!expectedDeliveryState && !["failed", "blocked", "superseded"].includes(identity.delivery_state))
            ) {
              throw new Error("RECOVERY_TERMINAL_ATTEMPT_IDENTITY_MISMATCH");
            }
            const attemptEvidenceRefs = z.array(z.string()).parse(JSON.parse(identity.attempt_evidence_refs));
            if (transition.terminal.evidenceBundleHashes.some((hash) =>
              !attemptEvidenceRefs.includes(hash)
              && !attemptEvidenceRefs.includes(`setfarm://evidence-bundle/${hash}`))) {
              throw new Error("RECOVERY_TERMINAL_ATTEMPT_EVIDENCE_MISSING");
            }
            if (bundles.some((bundle) =>
              bundle.runId !== identity.run_id
              || bundle.storyId !== identity.story_id
              || bundle.packetHash !== identity.packet_hash
              || bundle.sliceHash !== identity.execution_slice_hash
              || bundle.attemptId !== transition.recoveryEvidence!.attemptId
              || bundle.sourceRevision.sha !== identity.attempt_source_after_sha
              || bundle.sourceRevision.treeHash !== identity.attempt_source_after_tree_hash)) {
              throw new Error("RECOVERY_TERMINAL_EVIDENCE_IDENTITY_MISMATCH");
            }
            requiredEvidencePlan = stringArray(identity.evidence_plan);
          } else {
            const currentRevision = currentRow.current_revision_id
              ? await one<RecoveryCurrentRevisionIdentityRow>(
                  transaction,
                  `SELECT revision_id, parent_revision_id, run_id, story_id, packet_hash,
                          contract_slice_hash, source_sha, source_tree_hash, evidence_plan
                     FROM recovery_case_revisions
                    WHERE revision_id = $1 AND recovery_case_id = $2
                    FOR KEY SHARE`,
                  [currentRow.current_revision_id, current.recoveryCaseId],
                )
              : undefined;
            if (bundles.some((bundle) =>
              bundle.runId !== (currentRevision?.run_id ?? current.runId)
              || bundle.storyId !== (currentRevision?.story_id ?? current.storyId)
              || bundle.packetHash !== (currentRevision?.packet_hash ?? current.packetHash)
              || bundle.sliceHash !== (currentRevision?.contract_slice_hash ?? current.sliceHash)
              || bundle.sourceRevision.sha !== (currentRevision?.source_sha ?? current.sourceRevision.sha)
              || bundle.sourceRevision.treeHash !== (currentRevision?.source_tree_hash ?? current.sourceRevision.treeHash))) {
              throw new Error("RECOVERY_TERMINAL_EVIDENCE_IDENTITY_MISMATCH");
            }
            requiredEvidencePlan = currentRevision
              ? stringArray(currentRevision.evidence_plan)
              : current.evidencePlan;
          }
          if (transition.status === "resolved") {
            const evidenceSources = new Set(bundles.map((bundle) =>
              `${bundle.sourceRevision.sha}:${bundle.sourceRevision.treeHash}`));
            if (evidenceSources.size !== 1) {
              throw new Error("RECOVERY_RESOLUTION_EVIDENCE_SOURCE_MISMATCH");
            }
            if (bundles.some((bundle) => bundle.aggregateVerdict !== "pass")) {
              throw new Error("RECOVERY_RESOLUTION_EVIDENCE_NOT_PASSING");
            }
            const passedPredicates = new Set(bundles.flatMap((bundle) =>
              bundle.predicates
                .filter((predicate) => predicate.verdict === "pass")
                .map((predicate) => predicate.predicateRef)));
            if (requiredEvidencePlan.some((reference) => !passedPredicates.has(reference))) {
              throw new Error("RECOVERY_RESOLUTION_EVIDENCE_INCOMPLETE");
            }
          }
        }
        const next = RecoveryCaseV1Schema.parse({
          ...current,
          owner: transition.owner ?? current.owner,
          expectedDelta: transition.expectedDelta ?? current.expectedDelta,
          allowedPaths: [...new Set(transition.allowedPaths ?? current.allowedPaths)].sort(),
          evidencePlan: [...new Set(transition.evidencePlan ?? current.evidencePlan)].sort(),
          priorAttemptRefs: [...new Set([
            ...current.priorAttemptRefs,
            ...(transition.attemptRef ? [transition.attemptRef] : []),
          ])].sort(),
          status: transition.status,
          ...(transition.terminal ? { terminal: transition.terminal } : { terminal: undefined }),
          decisionRefs: [...new Set([...current.decisionRefs, transition.decisionRef])].sort(),
          stateVersion: current.stateVersion + 1,
          updatedAt: now.toISOString(),
        });
        const row = await one<RecoveryCaseRow>(
          transaction,
          `UPDATE recovery_cases
              SET owner = $3,
                  expected_delta = $4::text::jsonb,
                  allowed_paths = $5::text::jsonb,
                  evidence_plan = $6::text::jsonb,
                  prior_attempt_refs = $7::text::jsonb,
                  status = $8,
                  terminal = $9::text::jsonb,
                  decision_refs = $10::text::jsonb,
                  state_version = state_version + 1,
                  updated_at = $11
            WHERE recovery_case_id = $1 AND state_version = $2
            RETURNING *`,
          [
            current.recoveryCaseId,
            current.stateVersion,
            next.owner,
            JSON.stringify(next.expectedDelta),
            JSON.stringify(next.allowedPaths),
            JSON.stringify(next.evidencePlan),
            JSON.stringify(next.priorAttemptRefs),
            next.status,
            next.terminal ? JSON.stringify(next.terminal) : null,
            JSON.stringify(next.decisionRefs),
            next.updatedAt,
          ],
        );
        if (!row) return { status: "stale_version" as const, recoveryCase: current };
        return { status: "transitioned" as const, recoveryCase: mapRecoveryCase(row) };
      }) as Promise<RecoveryTransitionResult>;
    },

    async authorizeDispatch(
      input: unknown,
      options: Readonly<{ now?: Date }> = {},
    ): Promise<RecoveryDispatchResult> {
      const request = DispatchInputSchema.parse(input);
      const requestedTime = new Date(options.now ?? new Date());
      if (!Number.isFinite(requestedTime.getTime())) throw new Error("RECOVERY_DISPATCH_TIME_INVALID");
      return sql.begin(async (transaction) => {
        const identity = await one<{ run_id: string; story_id: string }>(
          transaction,
          "SELECT run_id, story_id FROM recovery_cases WHERE recovery_case_id = $1",
          [request.recoveryCaseId],
        );
        if (!identity) throw new Error("RECOVERY_CASE_NOT_FOUND");
        const authority = await lockV3RecoveryRunMutationAuthorityInTransaction(transaction, {
          runId: identity.run_id,
          storyId: identity.story_id,
        });
        const now = authority.observedAt;
        const currentRow = await one<RecoveryCaseRow>(
          transaction,
          "SELECT * FROM recovery_cases WHERE recovery_case_id = $1 FOR UPDATE",
          [request.recoveryCaseId],
        );
        if (!currentRow) throw new Error("RECOVERY_CASE_NOT_FOUND");
        if (currentRow.run_id !== identity.run_id || currentRow.story_id !== identity.story_id) {
          throw new Error("RECOVERY_CASE_STORY_IDENTITY_CHANGED");
        }
        const current = mapRecoveryCase(currentRow);
        if (current.stateVersion !== request.expectedStateVersion) {
          return { status: "stale_version" as const, recoveryCase: current };
        }
        if (isTerminal(current.status)) throw new Error("RECOVERY_CASE_TERMINAL");
        if (!dispatchOwnerIsValid(current.owner, request.dispatchClass)) {
          throw new Error("RECOVERY_DISPATCH_OWNER_MISMATCH");
        }
        if (
          request.dispatchClass !== "evidence_only"
          && (
            request.sourceRevision.sha !== current.sourceRevision.sha
            || request.sourceRevision.treeHash !== current.sourceRevision.treeHash
          )
        ) {
          throw new Error("RECOVERY_REPAIR_SOURCE_MISMATCH");
        }
        const dispatchDedupeKey = computeRecoveryDispatchDedupeKey({
          dispatchClass: request.dispatchClass,
          runId: current.runId,
          storyId: current.storyId,
          findingIds: current.findingIds,
          packetHash: current.packetHash,
          sliceHash: current.sliceHash,
          sourceRevision: request.sourceRevision,
          evidencePlan: current.evidencePlan,
        });
        const findingDispatchKeys = current.findingIds.map((findingId) => ({
          findingId,
          key: computeRecoveryFindingDispatchDedupeKey({
            dispatchClass: request.dispatchClass,
            runId: current.runId,
            storyId: current.storyId,
            findingId,
            packetHash: current.packetHash,
            sliceHash: current.sliceHash,
            sourceTreeHash: request.sourceRevision.treeHash,
          }),
        })).sort((left, right) => left.key.localeCompare(right.key));
        for (const finding of findingDispatchKeys) {
          await transaction.unsafe("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [finding.key]);
        }
        await transaction.unsafe("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [dispatchDedupeKey]);
        const duplicate = await one<RecoveryDispatchRow>(
          transaction,
          "SELECT * FROM recovery_dispatches WHERE dispatch_dedupe_key = $1",
          [dispatchDedupeKey],
        );
        if (duplicate) return { status: "duplicate" as const, authorization: mapDispatch(duplicate) };
        const conflictingFindings = await transaction.unsafe<Array<{ finding_id: string }>>(
          `SELECT finding_id
             FROM recovery_dispatch_findings
            WHERE finding_dispatch_key = ANY($1::text[])
            ORDER BY finding_id`,
          [findingDispatchKeys.map((finding) => finding.key)],
        );
        if (conflictingFindings.length) {
          return {
            status: "finding_conflict" as const,
            conflictingFindingIds: conflictingFindings.map((finding) => finding.finding_id),
          };
        }
        const budget = budgetColumn(request.dispatchClass);
        if (Number(currentRow[budget.used]) >= Number(currentRow[budget.max])) {
          return { status: "budget_exhausted" as const, recoveryCase: current };
        }
        const dispatchId = `RDISP_${dispatchDedupeKey}`;
        const authorization = {
          schema: "setfarm.recovery-dispatch-authorization.v1" as const,
          dispatchId,
          recoveryCaseId: current.recoveryCaseId,
          dispatchClass: request.dispatchClass,
          dispatchDedupeKey,
          sourceRevision: request.sourceRevision,
          packetHash: current.packetHash,
          sliceHash: current.sliceHash,
          findingSetHash: current.findingSetHash,
          findingIds: current.findingIds,
          evidencePlan: current.evidencePlan,
          authorizedAt: now.toISOString(),
        } satisfies RecoveryDispatchAuthorizationV1;
        await transaction.unsafe(
          `INSERT INTO recovery_dispatches (
             dispatch_id, recovery_case_id, dispatch_class, dispatch_dedupe_key,
             source_sha, source_tree_hash, packet_hash, slice_hash, finding_set_hash,
             finding_ids, evidence_plan, authorized_at
           ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::text::jsonb, $11::text::jsonb, $12)`,
          [
            authorization.dispatchId,
            authorization.recoveryCaseId,
            authorization.dispatchClass,
            authorization.dispatchDedupeKey,
            authorization.sourceRevision.sha,
            authorization.sourceRevision.treeHash,
            authorization.packetHash,
            authorization.sliceHash,
            authorization.findingSetHash,
            JSON.stringify(authorization.findingIds),
            JSON.stringify(authorization.evidencePlan),
            authorization.authorizedAt,
          ],
        );
        for (const finding of findingDispatchKeys) {
          await transaction.unsafe(
            `INSERT INTO recovery_dispatch_findings (
               dispatch_id, finding_id, finding_dispatch_key, run_id, story_id,
               dispatch_class, source_tree_hash, packet_hash, slice_hash, authorized_at
             ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
            [
              authorization.dispatchId,
              finding.findingId,
              finding.key,
              current.runId,
              current.storyId,
              authorization.dispatchClass,
              authorization.sourceRevision.treeHash,
              authorization.packetHash,
              authorization.sliceHash,
              authorization.authorizedAt,
            ],
          );
        }
        const nextStatus = request.dispatchClass === "evidence_only" ? "evidencing" : "repairing";
        const updatedRow = await one<RecoveryCaseRow>(
          transaction,
          `UPDATE recovery_cases
              SET ${budget.used} = ${budget.used} + 1,
                  status = $3,
                  state_version = state_version + 1,
                  updated_at = $4
            WHERE recovery_case_id = $1 AND state_version = $2
            RETURNING *`,
          [current.recoveryCaseId, current.stateVersion, nextStatus, now],
        );
        if (!updatedRow) throw new Error("RECOVERY_DISPATCH_CAS_LOST");
        return {
          status: "authorized" as const,
          authorization,
          recoveryCase: mapRecoveryCase(updatedRow),
        };
      }) as Promise<RecoveryDispatchResult>;
    },
  };
}
