import type postgres from "postgres";
import { z } from "zod";

import { hashCanonicalJson } from "../product-compiler/canonical-json.js";
import { Sha256Schema } from "../product-compiler/schemas/common-v1.js";
import {
  DEFAULT_ATTEMPT_LEASE_MS,
  computeAttemptDedupeKey,
  defaultAttemptIdentityFactory,
  leaseWindow,
  parseAttemptReservation,
  type AttemptIdentityFactory,
} from "./lease-fence.js";
import {
  ExecutionAttemptV1Schema,
  SourceRevisionV1Schema,
  TerminalAttemptDispositionV1Schema,
  type ExecutionAttemptV1,
} from "./schemas/execution-attempt-v1.js";

type Sql = postgres.Sql;
type TransactionSql = postgres.TransactionSql;

type AttemptRow = {
  attempt_id: string;
  claim_id: string | null;
  run_id: string;
  step_id: string;
  story_id: string;
  generation: number;
  fence_token: string;
  attempt_class: string;
  packet_hash: string | null;
  compilation_report_hash: string;
  slice_hash: string | null;
  source_before_sha: string;
  source_before_tree_hash: string;
  source_after_sha: string | null;
  source_after_tree_hash: string | null;
  finding_set_hash: string | null;
  recovery_case_revision_id: string | null;
  recovery_dispatch_id: string | null;
  dedupe_key: string | null;
  role: string;
  agent_id: string | null;
  branch: string | null;
  worktree: string | null;
  lease_acquired_at: Date | string;
  lease_expires_at: Date | string;
  heartbeat_at: Date | string;
  disposition: string;
  output_hash: string | null;
  evidence_refs: string;
  created_at: Date | string;
  updated_at: Date | string;
};

type RecoveryDeliveryBindingRow = {
  state: string;
  owner_instance_id: string | null;
  lease_token: string | null;
  lease_expires_at: Date | string | null;
  attempt_id: string | null;
  run_id: string;
  story_id: string;
  dispatch_class: string;
  revision_id: string;
  packet_hash: string;
  finding_set_hash: string;
  source_sha: string;
  source_tree_hash: string;
};

const FenceIdentityV1Schema = z.object({
  attemptId: z.string().regex(/^ATT_[A-Za-z0-9-]{16,160}$/),
  generation: z.number().int().positive(),
  fenceToken: Sha256Schema,
}).strict();

const CompletionInputV1Schema = FenceIdentityV1Schema.extend({
  disposition: TerminalAttemptDispositionV1Schema,
  sourceAfter: SourceRevisionV1Schema.optional(),
  outputHash: Sha256Schema.optional(),
  evidenceRefs: z.array(z.string().min(1).max(500)).max(1_000),
}).strict().superRefine((value, context) => {
  if (value.disposition === "produced_delta" && !value.sourceAfter) {
    context.addIssue({ code: "custom", path: ["sourceAfter"], message: "Produced delta requires source-after" });
  }
});

const CandidateSourceInputV1Schema = FenceIdentityV1Schema.extend({
  sourceAfter: SourceRevisionV1Schema,
}).strict();

function timestamp(value: Date | string): string {
  const parsed = value instanceof Date ? value : new Date(value);
  return parsed.toISOString();
}

function optional<T>(value: T | null): T | undefined {
  return value === null ? undefined : value;
}

function evidenceRefs(raw: string): string[] {
  const parsed: unknown = JSON.parse(raw);
  return z.array(z.string().min(1).max(500)).max(1_000).parse(parsed);
}

function mapAttempt(row: AttemptRow): ExecutionAttemptV1 {
  return ExecutionAttemptV1Schema.parse({
    schema: "setfarm.execution-attempt.v1",
    attemptId: row.attempt_id,
    claimId: optional(row.claim_id === null ? null : Number(row.claim_id)),
    runId: row.run_id,
    stepId: row.step_id,
    storyId: row.story_id,
    generation: row.generation,
    fenceToken: row.fence_token,
    attemptClass: row.attempt_class,
    packetHash: optional(row.packet_hash),
    compilationReportHash: row.compilation_report_hash,
    sliceHash: optional(row.slice_hash),
    sourceBefore: { sha: row.source_before_sha, treeHash: row.source_before_tree_hash },
    ...(row.source_after_sha && row.source_after_tree_hash
      ? { sourceAfter: { sha: row.source_after_sha, treeHash: row.source_after_tree_hash } }
      : {}),
    findingSetHash: optional(row.finding_set_hash),
    recoveryCaseRevisionId: optional(row.recovery_case_revision_id),
    recoveryDispatchId: optional(row.recovery_dispatch_id),
    dedupeKey: optional(row.dedupe_key),
    role: row.role,
    agentId: optional(row.agent_id),
    branch: optional(row.branch),
    worktree: optional(row.worktree),
    lease: {
      acquiredAt: timestamp(row.lease_acquired_at),
      expiresAt: timestamp(row.lease_expires_at),
      heartbeatAt: timestamp(row.heartbeat_at),
    },
    disposition: row.disposition,
    outputHash: optional(row.output_hash),
    evidenceRefs: evidenceRefs(row.evidence_refs),
    createdAt: timestamp(row.created_at),
    updatedAt: timestamp(row.updated_at),
  });
}

async function one(sql: Pick<Sql, "unsafe">, query: string, params: any[]): Promise<AttemptRow | undefined> {
  const rows = await sql.unsafe<AttemptRow[]>(query, params);
  return rows[0];
}

export type AttemptReservationResult =
  | Readonly<{ status: "reserved"; attempt: ExecutionAttemptV1 }>
  | Readonly<{ status: "duplicate"; attempt: ExecutionAttemptV1 }>
  | Readonly<{ status: "active_conflict"; attempt: ExecutionAttemptV1 }>;

export type FenceUpdateResult =
  | Readonly<{ status: "completed"; attempt: ExecutionAttemptV1 }>
  | Readonly<{ status: "candidate"; attempt: ExecutionAttemptV1 }>
  | Readonly<{ status: "heartbeat"; attempt: ExecutionAttemptV1 }>
  | Readonly<{ status: "running"; attempt: ExecutionAttemptV1 }>
  | Readonly<{ status: "stale_fence" }>;

/**
 * Reserve an attempt inside a caller-owned transaction. This is the single
 * insertion/binding implementation used by both ordinary claim publication
 * and non-model evidence-only publication, so claim + attempt + recovery
 * delivery can share one commit boundary.
 */
export async function reserveAttemptInTransaction(
  transaction: TransactionSql,
  input: unknown,
  options: Readonly<{
    now?: Date;
    leaseMs?: number;
    identityFactory?: AttemptIdentityFactory;
  }> = {},
): Promise<AttemptReservationResult> {
  const reservation = parseAttemptReservation(input);
  const dedupeKey = computeAttemptDedupeKey(reservation);
  const now = options.now ? new Date(options.now) : new Date();
  const lease = leaseWindow(now, options.leaseMs ?? DEFAULT_ATTEMPT_LEASE_MS);
  const identityFactory = options.identityFactory ?? defaultAttemptIdentityFactory;
  const lockIdentity = hashCanonicalJson({
    schema: "setfarm.execution-attempt-lock.v1",
    runId: reservation.runId,
    stepId: reservation.stepId,
    storyId: reservation.storyId,
  });
  await transaction.unsafe("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [lockIdentity]);

  const runRows = await transaction.unsafe<{ status: string; protocol: string }[]>(
    "SELECT status, protocol FROM runs WHERE id = $1 LIMIT 1 FOR KEY SHARE",
    [reservation.runId],
  );
  if (runRows.length !== 1) throw new Error("ATTEMPT_RUN_NOT_FOUND");
  if (
    !["running", "resuming"].includes(runRows[0]!.status)
    || !["shadow", "v3"].includes(runRows[0]!.protocol)
  ) {
    throw new Error("ATTEMPT_RUN_NOT_ACTIVE_COMPILER_OWNER");
  }
  if (reservation.claimId === undefined) throw new Error("ATTEMPT_CLAIM_ID_REQUIRED");
  const boundClaims = await transaction.unsafe<Array<{ id: string }>>(
    `SELECT id::text
       FROM claim_log
      WHERE id = $1
        AND run_id = $2
        AND step_id = $3
        AND COALESCE(story_id, '') = $4
        AND outcome IS NULL
        AND ($5::text IS NULL OR agent_id = $5)
      FOR KEY SHARE`,
    [
      reservation.claimId,
      reservation.runId,
      reservation.stepId,
      reservation.storyId,
      reservation.agentId ?? null,
    ],
  );
  if (boundClaims.length !== 1) throw new Error("ATTEMPT_CLAIM_BINDING_INVALID");

  if (reservation.recoveryDispatchId) {
    const existingRecoveryAttempt = await one(
      transaction,
      "SELECT * FROM execution_attempts WHERE recovery_dispatch_id = $1 LIMIT 1",
      [reservation.recoveryDispatchId],
    );
    if (existingRecoveryAttempt) {
      return { status: "duplicate" as const, attempt: mapAttempt(existingRecoveryAttempt) };
    }
    const deliveryRows = await transaction.unsafe<RecoveryDeliveryBindingRow[]>(
      `SELECT delivery.state, delivery.owner_instance_id, delivery.lease_token,
              delivery.lease_expires_at, delivery.attempt_id,
              delivery.run_id, delivery.story_id,
              dispatch.dispatch_class, dispatch.revision_id,
              dispatch.packet_hash, dispatch.finding_set_hash,
              dispatch.source_sha, dispatch.source_tree_hash
         FROM recovery_dispatch_deliveries delivery
         JOIN recovery_revision_dispatches dispatch
           ON dispatch.dispatch_id = delivery.dispatch_id
        WHERE delivery.dispatch_id = $1
          AND delivery.revision_id = $2
        FOR UPDATE OF delivery`,
      [reservation.recoveryDispatchId, reservation.recoveryCaseRevisionId!],
    );
    const delivery = deliveryRows[0];
    const leaseIdentity = reservation.recoveryDeliveryLease!;
    if (!delivery) throw new Error("RECOVERY_DELIVERY_NOT_FOUND");
    if (
      delivery.state !== "leased"
      || delivery.owner_instance_id !== leaseIdentity.ownerInstanceId
      || delivery.lease_token !== leaseIdentity.leaseToken
      || !delivery.lease_expires_at
      || new Date(delivery.lease_expires_at).getTime() <= now.getTime()
    ) {
      throw new Error("RECOVERY_DELIVERY_LEASE_INVALID");
    }
    if (
      delivery.attempt_id !== null
      || delivery.run_id !== reservation.runId
      || delivery.story_id !== reservation.storyId
      || delivery.dispatch_class !== reservation.attemptClass
      || delivery.revision_id !== reservation.recoveryCaseRevisionId
      || delivery.packet_hash !== reservation.packetHash
      || delivery.finding_set_hash !== reservation.findingSetHash
      || delivery.source_sha !== reservation.sourceBefore.sha
      || delivery.source_tree_hash !== reservation.sourceBefore.treeHash
    ) {
      throw new Error("RECOVERY_DELIVERY_ATTEMPT_IDENTITY_MISMATCH");
    }
  }

  if (dedupeKey) {
    const duplicate = await one(
      transaction,
      "SELECT * FROM execution_attempts WHERE dedupe_key = $1 LIMIT 1",
      [dedupeKey],
    );
    if (duplicate) return { status: "duplicate" as const, attempt: mapAttempt(duplicate) };
  }
  const active = await one(
    transaction,
    `SELECT * FROM execution_attempts
      WHERE run_id = $1 AND step_id = $2 AND story_id = $3
        AND disposition IN ('claimed', 'running')
      LIMIT 1`,
    [reservation.runId, reservation.stepId, reservation.storyId],
  );
  if (active) return { status: "active_conflict" as const, attempt: mapAttempt(active) };

  const generations = await transaction.unsafe<{ generation: number }[]>(
    "SELECT COALESCE(MAX(generation), 0)::integer + 1 AS generation FROM execution_attempts WHERE run_id = $1 AND step_id = $2 AND story_id = $3",
    [reservation.runId, reservation.stepId, reservation.storyId],
  );
  const generation = generations[0]?.generation ?? 1;
  const attemptId = identityFactory.attemptId();
  const fenceToken = identityFactory.fenceToken();
  const inserted = await one(
    transaction,
    `INSERT INTO execution_attempts (
       attempt_id, claim_id, run_id, step_id, story_id, generation, fence_token,
       attempt_class, packet_hash, compilation_report_hash, slice_hash,
       source_before_sha, source_before_tree_hash, finding_set_hash, dedupe_key,
       recovery_case_revision_id, recovery_dispatch_id,
       role, agent_id, branch, worktree,
       lease_acquired_at, lease_expires_at, heartbeat_at,
       disposition, evidence_refs, created_at, updated_at
     ) VALUES (
       $1, $2, $3, $4, $5, $6, $7,
       $8, $9, $10, $11,
       $12, $13, $14, $15,
       $16, $17,
       $18, $19, $20, $21,
       $22, $23, $24,
       'claimed', $25, $22, $22
     ) RETURNING *`,
    [
      attemptId,
      reservation.claimId,
      reservation.runId,
      reservation.stepId,
      reservation.storyId,
      generation,
      fenceToken,
      reservation.attemptClass,
      reservation.packetHash ?? null,
      reservation.compilationReportHash,
      reservation.sliceHash ?? null,
      reservation.sourceBefore.sha,
      reservation.sourceBefore.treeHash,
      reservation.findingSetHash ?? null,
      dedupeKey,
      reservation.recoveryCaseRevisionId ?? null,
      reservation.recoveryDispatchId ?? null,
      reservation.role,
      reservation.agentId ?? null,
      reservation.branch ?? null,
      reservation.worktree ?? null,
      lease.acquiredAt,
      lease.expiresAt,
      lease.heartbeatAt,
      JSON.stringify(reservation.evidenceRefs),
    ],
  );
  if (!inserted) throw new Error("ATTEMPT_INSERT_FAILED");
  if (reservation.recoveryDispatchId) {
    const deliveryRows = await transaction.unsafe<Array<{ dispatch_id: string }>>(
      `UPDATE recovery_dispatch_deliveries
          SET state = 'attempt_reserved',
              attempt_id = $4,
              claim_id = $5,
              execution_slice_hash = $6,
              attempt_count = attempt_count + 1,
              started_at = COALESCE(started_at, $7),
              updated_at = $7
        WHERE dispatch_id = $1
          AND revision_id = $2
          AND state = 'leased'
          AND lease_token = $3
        RETURNING dispatch_id`,
      [
        reservation.recoveryDispatchId,
        reservation.recoveryCaseRevisionId!,
        reservation.recoveryDeliveryLease!.leaseToken,
        inserted.attempt_id,
        reservation.claimId,
        reservation.sliceHash!,
        now,
      ],
    );
    if (deliveryRows.length !== 1) throw new Error("RECOVERY_DELIVERY_BIND_CAS_LOST");
  }
  return { status: "reserved" as const, attempt: mapAttempt(inserted) };
}

export function createAttemptRepository(
  sql: Sql,
  identityFactory: AttemptIdentityFactory = defaultAttemptIdentityFactory,
) {
  return {
    async reserve(
      input: unknown,
      options: Readonly<{ now?: Date; leaseMs?: number }> = {},
    ): Promise<AttemptReservationResult> {
      const now = options.now ? new Date(options.now) : new Date();
      return sql.begin((transaction) => reserveAttemptInTransaction(transaction, input, {
        now,
        ...(options.leaseMs === undefined ? {} : { leaseMs: options.leaseMs }),
        identityFactory,
      })) as Promise<AttemptReservationResult>;
    },

    async findById(attemptId: string): Promise<ExecutionAttemptV1 | undefined> {
      const row = await one(sql, "SELECT * FROM execution_attempts WHERE attempt_id = $1", [attemptId]);
      return row ? mapAttempt(row) : undefined;
    },

    async findActive(identity: Readonly<{
      runId: string;
      stepId: string;
      storyId: string;
    }>): Promise<ExecutionAttemptV1 | undefined> {
      const row = await one(
        sql,
        `SELECT * FROM execution_attempts
          WHERE run_id = $1 AND step_id = $2 AND story_id = $3
            AND disposition IN ('claimed', 'running')
          LIMIT 1`,
        [identity.runId, identity.stepId, identity.storyId],
      );
      return row ? mapAttempt(row) : undefined;
    },

    async heartbeat(
      input: unknown,
      options: Readonly<{ now?: Date; leaseMs?: number }> = {},
    ): Promise<FenceUpdateResult> {
      const identity = FenceIdentityV1Schema.parse(input);
      const now = options.now ? new Date(options.now) : new Date();
      const lease = leaseWindow(now, options.leaseMs ?? DEFAULT_ATTEMPT_LEASE_MS);
      const row = await one(
        sql,
        `UPDATE execution_attempts
            SET heartbeat_at = $4, lease_expires_at = $5, updated_at = $4
          WHERE attempt_id = $1 AND generation = $2 AND fence_token = $3
            AND disposition IN ('claimed', 'running')
          RETURNING *`,
        [identity.attemptId, identity.generation, identity.fenceToken, now, lease.expiresAt],
      );
      return row ? { status: "heartbeat", attempt: mapAttempt(row) } : { status: "stale_fence" };
    },

    async markRunning(input: unknown, options: Readonly<{ now?: Date }> = {}): Promise<FenceUpdateResult> {
      const identity = FenceIdentityV1Schema.parse(input);
      const now = options.now ? new Date(options.now) : new Date();
      const row = await one(
        sql,
        `UPDATE execution_attempts
            SET disposition = 'running', heartbeat_at = $4, updated_at = $4
          WHERE attempt_id = $1 AND generation = $2 AND fence_token = $3
            AND disposition IN ('claimed', 'running')
          RETURNING *`,
        [identity.attemptId, identity.generation, identity.fenceToken, now],
      );
      return row ? { status: "running", attempt: mapAttempt(row) } : { status: "stale_fence" };
    },

    /**
     * Attest the exact platform-owned candidate commit while the attempt fence
     * is still active. Canonical evidence is only valid after this succeeds.
     * Replays of the same source are idempotent; a different source can never
     * replace an already-attested candidate under the same attempt.
     */
    async recordCandidateSource(
      input: unknown,
      options: Readonly<{ now?: Date }> = {},
    ): Promise<FenceUpdateResult> {
      const candidate = CandidateSourceInputV1Schema.parse(input);
      const now = options.now ? new Date(options.now) : new Date();
      const row = await one(
        sql,
        `UPDATE execution_attempts
            SET source_after_sha = $4,
                source_after_tree_hash = $5,
                heartbeat_at = $6,
                updated_at = $6
          WHERE attempt_id = $1 AND generation = $2 AND fence_token = $3
            AND disposition IN ('claimed', 'running')
            AND (
              source_after_sha IS NULL
              OR (source_after_sha = $4 AND source_after_tree_hash = $5)
            )
          RETURNING *`,
        [
          candidate.attemptId,
          candidate.generation,
          candidate.fenceToken,
          candidate.sourceAfter.sha,
          candidate.sourceAfter.treeHash,
          now,
        ],
      );
      return row ? { status: "candidate", attempt: mapAttempt(row) } : { status: "stale_fence" };
    },

    async complete(input: unknown, options: Readonly<{ now?: Date }> = {}): Promise<FenceUpdateResult> {
      const completion = CompletionInputV1Schema.parse(input);
      const now = options.now ? new Date(options.now) : new Date();
      const row = await one(
        sql,
        `UPDATE execution_attempts
            SET disposition = $4,
                source_after_sha = COALESCE(execution_attempts.source_after_sha, $5),
                source_after_tree_hash = COALESCE(execution_attempts.source_after_tree_hash, $6),
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
              OR ($5::text IS NOT NULL AND source_after_sha = $5 AND source_after_tree_hash = $6)
            )
          RETURNING *`,
        [
          completion.attemptId,
          completion.generation,
          completion.fenceToken,
          completion.disposition,
          completion.sourceAfter?.sha ?? null,
          completion.sourceAfter?.treeHash ?? null,
          completion.outputHash ?? null,
          JSON.stringify(completion.evidenceRefs),
          now,
        ],
      );
      return row ? { status: "completed", attempt: mapAttempt(row) } : { status: "stale_fence" };
    },
  };
}
