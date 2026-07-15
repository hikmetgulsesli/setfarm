import { randomBytes } from "node:crypto";
import type postgres from "postgres";
import { z } from "zod";

import { readDatabaseWallClock } from "../db/database-wall-clock.js";
import { FindingSetV1Schema, type FindingSetV1 } from "../findings/finding-set.js";
import { hashCanonicalJson } from "../product-compiler/canonical-json.js";
import {
  Sha256Schema,
  StoryIdSchema,
} from "../product-compiler/schemas/common-v1.js";
import {
  ExpectedDeltaV1Schema,
  RecoveryCaseV1Schema,
  RecoveryOwnerV1Schema,
  type RecoveryCaseV1,
} from "./recovery-case.js";
import {
  RecoveryCaseRevisionV1Schema,
  RecoveryDispatchDeliveryV1Schema,
  RecoveryRevisionDispatchV1Schema,
  type RecoveryCaseRevisionV1,
  type RecoveryDispatchDeliveryV1,
  type RecoveryRevisionDispatchV1,
} from "./recovery-delivery.js";

type Sql = postgres.Sql;
type TransactionSql = postgres.TransactionSql;

const BoundedIdentitySchema = z.string().min(1).max(500);
const RecoveryCaseIdSchema = z.string().regex(/^RCV_[a-f0-9]{64}$/);
const RecoveryRevisionIdSchema = z.string().regex(/^RREV_[a-f0-9]{64}$/);
const RecoveryDispatchIdSchema = z.string().regex(/^RDISP_[a-f0-9]{64}$/);
const AttemptIdSchema = z.string().regex(/^ATT_[A-Za-z0-9-]{16,160}$/);
const ModelDispatchClassSchema = z.enum(["product_implementation", "supervisor_repair"]);
const TimestampSchema = z.string().datetime({ offset: true });

const NormalAuthorityInputSchema = z.object({
  runId: BoundedIdentitySchema,
  storyId: StoryIdSchema,
}).strict();

const RecoveryAuthorityInputSchema = z.object({
  runId: BoundedIdentitySchema,
  storyId: StoryIdSchema,
  ownerInstanceId: BoundedIdentitySchema,
  leaseMs: z.number().int().positive().max(24 * 60 * 60 * 1_000).default(10 * 60 * 1_000),
  continuation: z.discriminatedUnion("kind", [
    z.object({
      kind: z.literal("unreserved_lease"),
      leaseToken: z.string().min(16).max(500),
    }).strict(),
    z.object({
      kind: z.literal("attempt"),
      attemptId: AttemptIdSchema,
    }).strict(),
  ]).optional(),
}).strict();

export const V3RecoveryClaimHandoffV1Schema = z.object({
  schema: z.literal("setfarm.v3-recovery-claim-handoff.v1"),
  status: z.enum(["lease_acquired", "lease_reissued", "attempt_bound_reissue"]),
  runId: BoundedIdentitySchema,
  storyId: StoryIdSchema,
  recoveryCaseId: RecoveryCaseIdSchema,
  revisionId: RecoveryRevisionIdSchema,
  dispatchId: RecoveryDispatchIdSchema,
  dispatchClass: ModelDispatchClassSchema,
  recoveryOwner: RecoveryOwnerV1Schema,
  lease: z.object({
    ownerInstanceId: BoundedIdentitySchema,
    leaseToken: z.string().min(16).max(500),
    expiresAt: TimestampSchema,
  }).strict(),
  directive: z.object({
    packetHash: Sha256Schema,
    contractSliceHash: Sha256Schema,
    sourceRevision: z.object({
      sha: z.string().regex(/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/),
      treeHash: z.string().regex(/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/),
    }).strict(),
    findingSetHash: Sha256Schema,
    findingIds: z.array(z.string().regex(/^FIND_[a-f0-9]{64}$/)).min(1).max(5_000),
    expectedDelta: ExpectedDeltaV1Schema,
    allowedPaths: z.array(z.string().min(1).max(1_024)).max(20_000),
    evidencePlan: z.array(z.string().min(1).max(160)).min(1).max(5_000),
    evidencePlanArtifactHash: Sha256Schema.optional(),
  }).strict(),
  attemptBinding: z.object({
    attemptId: AttemptIdSchema,
    claimId: z.number().int().positive(),
    executionSliceHash: Sha256Schema,
  }).strict().optional(),
  reservationBoundary: z.object({
    leaseAndAttemptAtomicInThisModule: z.literal(false),
    state: z.enum([
      "lease_acquired_attempt_not_reserved",
      "attempt_already_reserved_requires_exact_resume",
    ]),
    reconcileRequired: z.literal(true),
    requiredNextOperation: z.enum([
      "attempt_repository.reserve_exact_recovery_handoff",
      "resume_exact_attempt_only",
    ]),
  }).strict(),
}).strict().superRefine((value, context) => {
  const attemptBound = value.status === "attempt_bound_reissue";
  if (attemptBound !== Boolean(value.attemptBinding)) {
    context.addIssue({
      code: "custom",
      path: ["attemptBinding"],
      message: "Only an exact attempt-bound reissue may expose attempt identity",
    });
  }
  const expectedState = attemptBound
    ? "attempt_already_reserved_requires_exact_resume"
    : "lease_acquired_attempt_not_reserved";
  const expectedNext = attemptBound
    ? "resume_exact_attempt_only"
    : "attempt_repository.reserve_exact_recovery_handoff";
  if (
    value.reservationBoundary.state !== expectedState
    || value.reservationBoundary.requiredNextOperation !== expectedNext
  ) {
    context.addIssue({
      code: "custom",
      path: ["reservationBoundary"],
      message: "Reservation boundary must expose the exact crash-reconcile state",
    });
  }
});

export type V3RecoveryClaimHandoffV1 = z.infer<typeof V3RecoveryClaimHandoffV1Schema>;

type RunRow = {
  protocol: string;
  status: string;
  packet_hash: string | null;
};

type CaseRow = {
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

type AttemptBindingRow = {
  attempt_id: string;
  claim_id: string | number | null;
  run_id: string;
  story_id: string;
  attempt_class: string;
  packet_hash: string | null;
  slice_hash: string | null;
  source_before_sha: string;
  source_before_tree_hash: string;
  finding_set_hash: string | null;
  recovery_case_revision_id: string | null;
  recovery_dispatch_id: string | null;
  disposition: string;
  lease_expires_at: Date | string;
};

export class V3RecoveryClaimAuthorityError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(`${code}:${message}`);
    this.name = "V3RecoveryClaimAuthorityError";
    this.code = code;
  }
}

function fail(code: string, message: string): never {
  throw new V3RecoveryClaimAuthorityError(code, message);
}

function timestamp(value: Date | string): string {
  const parsed = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(parsed.getTime())) fail("V3_RECOVERY_AUTHORITY_TIME_INVALID", "ledger timestamp is invalid");
  return parsed.toISOString();
}

function strings(value: unknown): string[] {
  return z.array(z.string()).parse(value);
}

function same(left: unknown, right: unknown): boolean {
  return hashCanonicalJson(left) === hashCanonicalJson(right);
}

async function one<T>(
  sql: Pick<Sql, "unsafe"> | Pick<TransactionSql, "unsafe">,
  query: string,
  params: unknown[],
): Promise<T | undefined> {
  const rows = await sql.unsafe<T[]>(query, params as never[]);
  return rows[0];
}

function mapRecoveryCase(row: CaseRow): RecoveryCaseV1 {
  return RecoveryCaseV1Schema.parse({
    schema: "setfarm.recovery-case.v1",
    recoveryCaseId: row.recovery_case_id,
    dedupeKey: row.dedupe_key,
    runId: row.run_id,
    storyId: row.story_id,
    findingSetHash: row.finding_set_hash,
    findingIds: strings(row.finding_ids),
    packetHash: row.packet_hash,
    sliceHash: row.slice_hash,
    sourceRevision: { sha: row.source_sha, treeHash: row.source_tree_hash },
    owner: row.owner,
    expectedDelta: row.expected_delta,
    allowedPaths: strings(row.allowed_paths),
    evidencePlan: strings(row.evidence_plan),
    priorAttemptRefs: strings(row.prior_attempt_refs),
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
    ...(row.terminal ? { terminal: row.terminal } : {}),
    decisionRefs: strings(row.decision_refs),
    stateVersion: row.state_version,
    createdAt: timestamp(row.created_at),
    updatedAt: timestamp(row.updated_at),
  });
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

function mapDispatch(row: DispatchRow, revision: RecoveryCaseRevisionV1): RecoveryRevisionDispatchV1 {
  return RecoveryRevisionDispatchV1Schema.parse({
    schema: "setfarm.recovery-revision-dispatch.v1",
    dispatchId: row.dispatch_id,
    recoveryCaseId: row.recovery_case_id,
    revisionId: row.revision_id,
    dispatchClass: row.dispatch_class,
    dispatchDedupeKey: row.dispatch_dedupe_key,
    runId: revision.runId,
    storyId: revision.storyId,
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

function mapDelivery(row: DeliveryRow): RecoveryDispatchDeliveryV1 {
  return RecoveryDispatchDeliveryV1Schema.parse({
    schema: "setfarm.recovery-dispatch-delivery.v1",
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

export function v3RecoveryStoryLockIdentity(input: Readonly<{ runId: string; storyId: string }>): string {
  return `setfarm:v3-recovery-story-lock:v1:${hashCanonicalJson({
    schema: "setfarm.v3-recovery-story-lock.v1",
    runId: input.runId,
    storyId: input.storyId,
  })}`;
}

async function lockStory(sql: TransactionSql, input: Readonly<{ runId: string; storyId: string }>): Promise<void> {
  await sql.unsafe("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [v3RecoveryStoryLockIdentity(input)]);
}

async function assertV3Run(
  sql: TransactionSql,
  input: Readonly<{ runId: string; storyId: string }>,
): Promise<RunRow> {
  const run = await one<RunRow>(
    sql,
    "SELECT protocol, status, packet_hash FROM runs WHERE id = $1 FOR UPDATE",
    [input.runId],
  );
  if (!run) fail("V3_RECOVERY_AUTHORITY_RUN_NOT_FOUND", `run ${input.runId} does not exist`);
  if (run.protocol !== "v3") {
    fail("V3_RECOVERY_AUTHORITY_RUN_NOT_ACTIVE_V3", `run ${input.runId} is not active v3`);
  }
  const terminations = await sql.unsafe<Array<{ request_id: string }>>(
    `SELECT request_id FROM run_termination_requests
      WHERE run_id = $1 AND state <> 'terminalized'
      ORDER BY requested_at, request_id
      LIMIT 1 FOR UPDATE`,
    [input.runId],
  );
  if (terminations[0]) {
    fail(
      "V3_RECOVERY_AUTHORITY_TERMINATION_PENDING",
      `run termination ${terminations[0].request_id} owns the lifecycle`,
    );
  }
  if (!["running", "resuming"].includes(run.status)) {
    fail("V3_RECOVERY_AUTHORITY_RUN_NOT_ACTIVE_V3", `run ${input.runId} is not active v3`);
  }
  return run;
}

async function activeDeliveryRows(
  sql: TransactionSql,
  input: Readonly<{ runId: string; storyId: string }>,
): Promise<DeliveryRow[]> {
  return sql.unsafe<DeliveryRow[]>(
    `SELECT * FROM recovery_dispatch_deliveries
      WHERE run_id = $1 AND story_id = $2
        AND state IN ('authorized', 'leased', 'attempt_reserved', 'running')
      ORDER BY authorized_at, dispatch_id
      LIMIT 2
      FOR UPDATE`,
    [input.runId, input.storyId],
  );
}

async function loadExactChain(
  sql: TransactionSql,
  run: RunRow,
  deliveryRow: DeliveryRow,
): Promise<Readonly<{
  recoveryCase: RecoveryCaseV1;
  revision: RecoveryCaseRevisionV1;
  dispatch: RecoveryRevisionDispatchV1;
  delivery: RecoveryDispatchDeliveryV1;
  findingSet: FindingSetV1;
}>> {
  const caseRow = await one<CaseRow>(
    sql,
    "SELECT * FROM recovery_cases WHERE recovery_case_id = $1 FOR UPDATE",
    [deliveryRow.recovery_case_id],
  );
  const revisionRow = await one<RevisionRow>(
    sql,
    "SELECT * FROM recovery_case_revisions WHERE revision_id = $1 FOR KEY SHARE",
    [deliveryRow.revision_id],
  );
  const dispatchRow = await one<DispatchRow>(
    sql,
    "SELECT * FROM recovery_revision_dispatches WHERE dispatch_id = $1 FOR KEY SHARE",
    [deliveryRow.dispatch_id],
  );
  const findingRow = await one<{ payload: unknown }>(
    sql,
    "SELECT payload FROM finding_sets WHERE finding_set_hash = (SELECT finding_set_hash FROM recovery_revision_dispatches WHERE dispatch_id = $1) FOR KEY SHARE",
    [deliveryRow.dispatch_id],
  );
  if (!caseRow || !revisionRow || !dispatchRow || !findingRow) {
    fail("V3_RECOVERY_AUTHORITY_CHAIN_MISSING", "delivery identity chain is incomplete");
  }
  const recoveryCase = mapRecoveryCase(caseRow);
  const revision = mapRevision(revisionRow);
  const dispatch = mapDispatch(dispatchRow, revision);
  const delivery = mapDelivery(deliveryRow);
  const findingSet = FindingSetV1Schema.parse(findingRow.payload);
  const activeCase = !["resolved", "blocked", "superseded"].includes(recoveryCase.status);
  if (
    !activeCase
    || caseRow.current_revision_id !== revision.revisionId
    || recoveryCase.runId !== delivery.runId
    || recoveryCase.storyId !== delivery.storyId
    || recoveryCase.findingSetHash !== revision.findingSetHash
    || recoveryCase.packetHash !== revision.packetHash
    || recoveryCase.sliceHash !== revision.contractSliceHash
    || !same(recoveryCase.sourceRevision, revision.sourceRevision)
    || recoveryCase.owner !== revision.owner
    || !same(recoveryCase.findingIds, revision.findingIds)
    || !same(recoveryCase.expectedDelta, revision.expectedDelta)
    || !same(recoveryCase.allowedPaths, revision.allowedPaths)
    || !same(recoveryCase.evidencePlan, revision.evidencePlan)
    || dispatch.recoveryCaseId !== recoveryCase.recoveryCaseId
    || dispatch.revisionId !== revision.revisionId
    || dispatch.packetHash !== revision.packetHash
    || dispatch.contractSliceHash !== revision.contractSliceHash
    || dispatch.findingSetHash !== revision.findingSetHash
    || !same(dispatch.sourceRevision, revision.sourceRevision)
    || !same(dispatch.findingIds, revision.findingIds)
    || !same(dispatch.evidencePlan, revision.evidencePlan)
    || dispatch.evidencePlanArtifactHash !== revision.evidencePlanArtifactHash
    || delivery.recoveryCaseId !== recoveryCase.recoveryCaseId
    || delivery.revisionId !== revision.revisionId
    || delivery.dispatchId !== dispatch.dispatchId
    || findingSet.runId !== revision.runId
    || findingSet.storyId !== revision.storyId
    || findingSet.findingSetHash !== revision.findingSetHash
    || findingSet.packetHash !== revision.packetHash
    || findingSet.sliceHash !== revision.contractSliceHash
    || !same(findingSet.sourceRevision, revision.sourceRevision)
    || !same(findingSet.findings.map((finding) => finding.findingId), revision.findingIds)
    || run.packet_hash !== revision.packetHash
  ) {
    fail("V3_RECOVERY_AUTHORITY_IDENTITY_MISMATCH", "case, revision, dispatch, finding set and delivery do not form one current identity");
  }
  if (
    (dispatch.dispatchClass === "product_implementation" && revision.owner !== "implement")
    || (dispatch.dispatchClass === "supervisor_repair" && revision.owner !== "supervisor")
  ) {
    fail("V3_RECOVERY_AUTHORITY_OWNER_MISMATCH", "dispatch class is not owned by the current recovery revision");
  }
  return { recoveryCase, revision, dispatch, delivery, findingSet };
}

function handoff(input: Readonly<{
  status: V3RecoveryClaimHandoffV1["status"];
  recoveryCase: RecoveryCaseV1;
  revision: RecoveryCaseRevisionV1;
  dispatch: RecoveryRevisionDispatchV1 & { dispatchClass: "product_implementation" | "supervisor_repair" };
  delivery: RecoveryDispatchDeliveryV1;
  attemptBinding?: V3RecoveryClaimHandoffV1["attemptBinding"];
}>): V3RecoveryClaimHandoffV1 {
  if (!input.delivery.ownerInstanceId || !input.delivery.leaseToken || !input.delivery.leaseExpiresAt) {
    fail("V3_RECOVERY_AUTHORITY_LEASE_MISSING", "leased delivery lacks durable identity");
  }
  const attemptBound = input.status === "attempt_bound_reissue";
  return V3RecoveryClaimHandoffV1Schema.parse({
    schema: "setfarm.v3-recovery-claim-handoff.v1",
    status: input.status,
    runId: input.revision.runId,
    storyId: input.revision.storyId,
    recoveryCaseId: input.recoveryCase.recoveryCaseId,
    revisionId: input.revision.revisionId,
    dispatchId: input.dispatch.dispatchId,
    dispatchClass: input.dispatch.dispatchClass,
    recoveryOwner: input.revision.owner,
    lease: {
      ownerInstanceId: input.delivery.ownerInstanceId,
      leaseToken: input.delivery.leaseToken,
      expiresAt: input.delivery.leaseExpiresAt,
    },
    directive: {
      packetHash: input.revision.packetHash,
      contractSliceHash: input.revision.contractSliceHash,
      sourceRevision: input.revision.sourceRevision,
      findingSetHash: input.revision.findingSetHash,
      findingIds: input.revision.findingIds,
      expectedDelta: input.revision.expectedDelta,
      allowedPaths: input.revision.allowedPaths,
      evidencePlan: input.revision.evidencePlan,
      ...(input.revision.evidencePlanArtifactHash
        ? { evidencePlanArtifactHash: input.revision.evidencePlanArtifactHash }
        : {}),
    },
    ...(input.attemptBinding ? { attemptBinding: input.attemptBinding } : {}),
    reservationBoundary: {
      leaseAndAttemptAtomicInThisModule: false,
      state: attemptBound
        ? "attempt_already_reserved_requires_exact_resume"
        : "lease_acquired_attempt_not_reserved",
      reconcileRequired: true,
      requiredNextOperation: attemptBound
        ? "resume_exact_attempt_only"
        : "attempt_repository.reserve_exact_recovery_handoff",
    },
  });
}

export function createV3RecoveryClaimAuthority(sql: Sql) {
  return {
    async withNormalClaimAuthority<T>(
      raw: unknown,
      operation: (transaction: TransactionSql) => Promise<T>,
    ): Promise<T> {
      const input = NormalAuthorityInputSchema.parse(raw);
      return sql.begin(async (transaction) => {
        await lockStory(transaction, input);
        await assertV3Run(transaction, input);
        const active = await activeDeliveryRows(transaction, input);
        if (active.length > 0) {
          fail("V3_NORMAL_CLAIM_BLOCKED_BY_RECOVERY", `active recovery delivery ${active[0]!.dispatch_id} owns the story`);
        }
        return operation(transaction);
      }) as Promise<T>;
    },

    async acquireRecoveryClaim(
      raw: unknown,
      options: Readonly<{ now?: Date }> = {},
    ): Promise<V3RecoveryClaimHandoffV1> {
      const input = RecoveryAuthorityInputSchema.parse(raw);
      if (options.now && !Number.isFinite(new Date(options.now).getTime())) {
        fail("V3_RECOVERY_AUTHORITY_TIME_INVALID", "claim time is invalid");
      }
      return sql.begin(async (transaction) => {
        await lockStory(transaction, input);
        const run = await assertV3Run(transaction, input);
        const active = await activeDeliveryRows(transaction, input);
        if (active.length === 0) fail("V3_RECOVERY_AUTHORITY_DELIVERY_NOT_FOUND", "story has no active recovery delivery");
        if (active.length !== 1) fail("V3_RECOVERY_AUTHORITY_MULTIPLE_ACTIVE", "story has multiple active recovery deliveries");
        const chain = await loadExactChain(transaction, run, active[0]!);
        const now = await readDatabaseWallClock(
          transaction,
          "V3_RECOVERY_AUTHORITY_DATABASE_TIME_UNAVAILABLE",
        );
        if (chain.dispatch.dispatchClass === "evidence_only") {
          fail("V3_RECOVERY_EVIDENCE_ONLY_NO_MODEL_CLAIM", "evidence-only delivery cannot create a model claim");
        }
        const dispatch = chain.dispatch as RecoveryRevisionDispatchV1 & {
          dispatchClass: "product_implementation" | "supervisor_repair";
        };
        let delivery = chain.delivery;
        if (delivery.state === "attempt_reserved" || delivery.state === "running") {
          if (
            input.continuation?.kind !== "attempt"
            || input.continuation.attemptId !== delivery.attemptId
            || input.ownerInstanceId !== delivery.ownerInstanceId
          ) {
            fail("V3_RECOVERY_ATTEMPT_BOUND_CONFLICT", "attempt-bound delivery belongs to another exact continuation");
          }
          const attempt = await one<AttemptBindingRow>(
            transaction,
            "SELECT * FROM execution_attempts WHERE attempt_id = $1 FOR KEY SHARE",
            [delivery.attemptId!],
          );
          if (
            !attempt
            || attempt.claim_id === null
            || Number(attempt.claim_id) !== delivery.claimId
            || attempt.run_id !== input.runId
            || attempt.story_id !== input.storyId
            || attempt.attempt_class !== dispatch.dispatchClass
            || attempt.packet_hash !== dispatch.packetHash
            || attempt.slice_hash !== delivery.executionSliceHash
            || attempt.finding_set_hash !== dispatch.findingSetHash
            || attempt.recovery_case_revision_id !== dispatch.revisionId
            || attempt.recovery_dispatch_id !== dispatch.dispatchId
            || attempt.source_before_sha !== dispatch.sourceRevision.sha
            || attempt.source_before_tree_hash !== dispatch.sourceRevision.treeHash
            || !["claimed", "running"].includes(attempt.disposition)
            || !delivery.leaseExpiresAt
            || !Number.isFinite(Date.parse(delivery.leaseExpiresAt))
            || Date.parse(delivery.leaseExpiresAt) <= now.getTime()
            || !Number.isFinite(new Date(attempt.lease_expires_at).getTime())
            || new Date(attempt.lease_expires_at).getTime() <= now.getTime()
          ) {
            fail("V3_RECOVERY_ATTEMPT_BOUND_IDENTITY_MISMATCH", "delivery attempt binding is not exact");
          }
          return handoff({
            status: "attempt_bound_reissue",
            ...chain,
            dispatch,
            attemptBinding: {
              attemptId: attempt.attempt_id,
              claimId: Number(attempt.claim_id),
              executionSliceHash: delivery.executionSliceHash!,
            },
          });
        }
        if (delivery.state === "leased" && delivery.leaseExpiresAt && Date.parse(delivery.leaseExpiresAt) > now.getTime()) {
          if (
            input.continuation?.kind !== "unreserved_lease"
            || input.ownerInstanceId !== delivery.ownerInstanceId
            || input.continuation.leaseToken !== delivery.leaseToken
          ) {
            fail("V3_RECOVERY_LEASE_HELD", "unexpired delivery lease belongs to another exact continuation");
          }
          return handoff({ status: "lease_reissued", ...chain, dispatch });
        }
        if (input.continuation) {
          fail("V3_RECOVERY_CONTINUATION_STALE", "continuation identity does not match the claimable delivery state");
        }
        if (delivery.state !== "authorized" && delivery.state !== "leased") {
          fail("V3_RECOVERY_DELIVERY_NOT_CLAIMABLE", `delivery state ${delivery.state} is not claimable`);
        }
        const expiresAt = new Date(now.getTime() + input.leaseMs);
        const leaseToken = randomBytes(32).toString("hex");
        const updated = await one<DeliveryRow>(
          transaction,
          `UPDATE recovery_dispatch_deliveries
              SET state = 'leased',
                  owner_instance_id = $4,
                  lease_token = $5,
                  lease_expires_at = $6,
                  updated_at = $3
            WHERE dispatch_id = $1
              AND revision_id = $2
              AND (
                state = 'authorized'
                OR (state = 'leased' AND lease_expires_at <= $3)
              )
            RETURNING *`,
          [dispatch.dispatchId, dispatch.revisionId, now, input.ownerInstanceId, leaseToken, expiresAt],
        );
        if (!updated) fail("V3_RECOVERY_LEASE_CAS_LOST", "delivery lease transition did not converge");
        delivery = mapDelivery(updated);
        return handoff({ status: "lease_acquired", ...chain, dispatch, delivery });
      }) as Promise<V3RecoveryClaimHandoffV1>;
    },
  };
}
