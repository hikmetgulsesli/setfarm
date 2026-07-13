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

async function one(sql: Sql | TransactionSql, query: string, params: any[]): Promise<AttemptRow | undefined> {
  const rows = await sql.unsafe<AttemptRow[]>(query, params);
  return rows[0];
}

export type AttemptReservationResult =
  | Readonly<{ status: "reserved"; attempt: ExecutionAttemptV1 }>
  | Readonly<{ status: "duplicate"; attempt: ExecutionAttemptV1 }>
  | Readonly<{ status: "active_conflict"; attempt: ExecutionAttemptV1 }>;

export type FenceUpdateResult =
  | Readonly<{ status: "completed"; attempt: ExecutionAttemptV1 }>
  | Readonly<{ status: "heartbeat"; attempt: ExecutionAttemptV1 }>
  | Readonly<{ status: "running"; attempt: ExecutionAttemptV1 }>
  | Readonly<{ status: "stale_fence" }>;

export function createAttemptRepository(
  sql: Sql,
  identityFactory: AttemptIdentityFactory = defaultAttemptIdentityFactory,
) {
  return {
    async reserve(
      input: unknown,
      options: Readonly<{ now?: Date; leaseMs?: number }> = {},
    ): Promise<AttemptReservationResult> {
      const reservation = parseAttemptReservation(input);
      const dedupeKey = computeAttemptDedupeKey(reservation);
      const now = options.now ? new Date(options.now) : new Date();
      const lease = leaseWindow(now, options.leaseMs ?? DEFAULT_ATTEMPT_LEASE_MS);
      return sql.begin(async (transaction) => {
        const lockIdentity = hashCanonicalJson({
          schema: "setfarm.execution-attempt-lock.v1",
          runId: reservation.runId,
          stepId: reservation.stepId,
          storyId: reservation.storyId,
        });
        await transaction.unsafe("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [lockIdentity]);

        const runRows = await transaction.unsafe<{ exists: number }[]>(
          "SELECT 1 AS exists FROM runs WHERE id = $1 LIMIT 1 FOR KEY SHARE",
          [reservation.runId],
        );
        if (runRows.length !== 1) throw new Error("ATTEMPT_RUN_NOT_FOUND");

        await transaction.unsafe(
          `UPDATE execution_attempts
             SET disposition = 'superseded', updated_at = $4
           WHERE run_id = $1 AND step_id = $2 AND story_id = $3
             AND disposition IN ('claimed', 'running')
             AND lease_expires_at <= $4`,
          [reservation.runId, reservation.stepId, reservation.storyId, now],
        );
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
             attempt_id, run_id, step_id, story_id, generation, fence_token,
             attempt_class, packet_hash, compilation_report_hash, slice_hash,
             source_before_sha, source_before_tree_hash, finding_set_hash, dedupe_key,
             role, agent_id, branch, worktree,
             lease_acquired_at, lease_expires_at, heartbeat_at,
             disposition, evidence_refs, created_at, updated_at
           ) VALUES (
             $1, $2, $3, $4, $5, $6,
             $7, $8, $9, $10,
             $11, $12, $13, $14,
             $15, $16, $17, $18,
             $19, $20, $21,
             'claimed', $22, $19, $19
           ) RETURNING *`,
          [
            attemptId,
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
        return { status: "reserved" as const, attempt: mapAttempt(inserted) };
      }) as Promise<AttemptReservationResult>;
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

    async complete(input: unknown, options: Readonly<{ now?: Date }> = {}): Promise<FenceUpdateResult> {
      const completion = CompletionInputV1Schema.parse(input);
      const now = options.now ? new Date(options.now) : new Date();
      const row = await one(
        sql,
        `UPDATE execution_attempts
            SET disposition = $4,
                source_after_sha = $5,
                source_after_tree_hash = $6,
                output_hash = $7,
                evidence_refs = $8,
                heartbeat_at = $9,
                updated_at = $9
          WHERE attempt_id = $1 AND generation = $2 AND fence_token = $3
            AND disposition IN ('claimed', 'running')
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
