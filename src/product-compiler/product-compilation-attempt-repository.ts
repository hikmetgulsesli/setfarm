import { randomBytes } from "node:crypto";

import type postgres from "postgres";
import { z } from "zod";

import { readDatabaseWallClock } from "../db/database-wall-clock.js";
import { hashCanonicalJson } from "./canonical-json.js";
import { Sha256Schema } from "./schemas/common-v1.js";
import {
  ProductCompilationAttemptFailureV1Schema,
  ProductCompilationAttemptOutputRefsV1Schema,
  ProductCompilationAttemptV1Schema,
  ProductCompilationRetryAuthorityV1Schema,
  type ProductCompilationAttemptV1,
} from "./schemas/product-compilation-attempt-v1.js";

type Sql = postgres.Sql;
type TransactionSql = postgres.TransactionSql;

const TimestampSchema = z.string().datetime({ offset: true });
const BoundedIdentitySchema = z.string().min(1).max(500);

const ReservationSchema = z.object({
  runId: BoundedIdentitySchema,
  originClaimId: z.number().int().positive(),
  ownerClaimId: z.number().int().positive(),
  passKind: z.literal("design_source_generation"),
  authorityHash: Sha256Schema,
  requestHash: Sha256Schema,
  ordinal: z.union([z.literal(1), z.literal(2)]),
  retryAuthority: ProductCompilationRetryAuthorityV1Schema.nullable(),
  ownerInstanceId: BoundedIdentitySchema,
  leaseMs: z.number().int().min(5_000).max(30 * 60_000).default(5 * 60_000),
}).strict().superRefine((value, context) => {
  if ((value.ordinal === 1) !== (value.retryAuthority === null)) {
    context.addIssue({
      code: "custom",
      path: ["retryAuthority"],
      message: "Only ordinal two may carry retry authority",
    });
  }
});

const FenceSchema = z.object({
  attemptId: z.string().regex(/^PCA_[a-f0-9]{64}$/),
  generation: z.number().int().positive(),
  fenceToken: Sha256Schema,
  ownerInstanceId: BoundedIdentitySchema,
}).strict();

const DispatchSchema = FenceSchema.extend({
  externalOperationId: BoundedIdentitySchema.nullable().default(null),
}).strict();

const AcceptedSealSchema = FenceSchema.extend({
  outputRefs: ProductCompilationAttemptOutputRefsV1Schema,
}).strict();

const FailureSealSchema = FenceSchema.extend({
  disposition: z.enum(["rejected", "infrastructure_failure", "dispatch_ambiguous"]),
  failure: ProductCompilationAttemptFailureV1Schema,
}).strict();

type AttemptRow = {
  attempt_id: string;
  run_id: string;
  origin_claim_id: string | number;
  owner_claim_id: string | number;
  pass_kind: string;
  authority_hash: string;
  request_hash: string;
  ordinal: number;
  parent_attempt_id: string | null;
  parent_failure_artifact_hash: string | null;
  parent_failure_fingerprint: string | null;
  retry_delta_hash: string | null;
  generation: number;
  fence_token: string;
  state: string;
  disposition: string | null;
  owner_instance_id: string | null;
  lease_token: string | null;
  lease_acquired_at: Date | string | null;
  lease_expires_at: Date | string | null;
  heartbeat_at: Date | string | null;
  dispatch_intent_at: Date | string | null;
  dispatch_started_at: Date | string | null;
  dispatch_finished_at: Date | string | null;
  external_operation_id: string | null;
  output_refs: unknown | null;
  output_seal_hash: string | null;
  failure: unknown | null;
  failure_artifact_hash: string | null;
  failure_fingerprint: string | null;
  operational_cause_hash: string | null;
  attempt_locator: string;
  created_at: Date | string;
  updated_at: Date | string;
};

function iso(value: Date | string): string {
  return (value instanceof Date ? value : new Date(value)).toISOString();
}

function mapAttempt(row: AttemptRow): ProductCompilationAttemptV1 {
  const retryAuthority = row.ordinal === 2
    ? {
        parentAttemptRef: row.parent_attempt_id,
        parentFailureArtifactHash: row.parent_failure_artifact_hash,
        parentFailureFingerprint: row.parent_failure_fingerprint,
        retryDeltaHash: row.retry_delta_hash,
      }
    : null;
  return ProductCompilationAttemptV1Schema.parse({
    schema: "setfarm.product-compilation-attempt.v1",
    attemptId: row.attempt_id,
    runId: row.run_id,
    originClaimId: Number(row.origin_claim_id),
    ownerClaimId: Number(row.owner_claim_id),
    passKind: row.pass_kind,
    authorityHash: row.authority_hash,
    requestHash: row.request_hash,
    ordinal: row.ordinal,
    retryAuthority,
    generation: row.generation,
    fenceToken: row.fence_token,
    state: row.state,
    disposition: row.disposition,
    lease: row.owner_instance_id && row.lease_acquired_at && row.lease_expires_at && row.heartbeat_at
      ? {
          ownerInstanceId: row.owner_instance_id,
          acquiredAt: iso(row.lease_acquired_at),
          expiresAt: iso(row.lease_expires_at),
          heartbeatAt: iso(row.heartbeat_at),
        }
      : null,
    dispatch: row.dispatch_intent_at
      ? {
          intentCommittedAt: iso(row.dispatch_intent_at),
          startedAt: row.dispatch_started_at ? iso(row.dispatch_started_at) : null,
          finishedAt: row.dispatch_finished_at ? iso(row.dispatch_finished_at) : null,
          externalOperationId: row.external_operation_id,
        }
      : null,
    outputRefs: row.output_refs,
    outputSealHash: row.output_seal_hash,
    failure: row.failure,
    attemptLocator: row.attempt_locator,
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
  });
}

async function first(
  sql: Pick<Sql, "unsafe"> | Pick<TransactionSql, "unsafe">,
  query: string,
  params: any[],
): Promise<AttemptRow | undefined> {
  return (await sql.unsafe<AttemptRow[]>(query, params))[0];
}

function attemptId(input: z.infer<typeof ReservationSchema>): string {
  return `PCA_${hashCanonicalJson({
    schema: "setfarm.product-compilation-attempt-identity.v1",
    runId: input.runId,
    passKind: input.passKind,
    authorityHash: input.authorityHash,
    requestHash: input.requestHash,
    ordinal: input.ordinal,
  })}`;
}

function randomHash(): string {
  return randomBytes(32).toString("hex");
}

export type ProductCompilationAttemptReservationResult =
  | Readonly<{ status: "reserved"; attempt: ProductCompilationAttemptV1 }>
  | Readonly<{ status: "duplicate"; attempt: ProductCompilationAttemptV1 }>
  | Readonly<{ status: "active_conflict"; attempt: ProductCompilationAttemptV1 }>
  | Readonly<{ status: "already_accepted"; attempt: ProductCompilationAttemptV1 }>;

export class ProductCompilationAttemptRepository {
  constructor(private readonly sql: Sql) {}

  async reserve(input: unknown): Promise<ProductCompilationAttemptReservationResult> {
    const reservation = ReservationSchema.parse(input);
    return this.sql.begin(async (transaction) => {
      const lock = hashCanonicalJson({
        schema: "setfarm.product-compilation-attempt-lock.v1",
        runId: reservation.runId,
        passKind: reservation.passKind,
        authorityHash: reservation.authorityHash,
      });
      await transaction.unsafe("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [lock]);
      const runRows = await transaction.unsafe<Array<{ status: string; protocol: string }>>(
        "SELECT status, protocol FROM runs WHERE id = $1 FOR KEY SHARE",
        [reservation.runId],
      );
      if (
        runRows.length !== 1
        || !["running", "resuming"].includes(runRows[0]!.status)
        || runRows[0]!.protocol !== "v3"
      ) {
        throw new Error("PRODUCT_COMPILATION_RUN_NOT_ACTIVE_V3_OWNER");
      }
      const claimRows = await transaction.unsafe<Array<{ id: string }>>(
        `SELECT id::text FROM claim_log
          WHERE id = ANY($1::bigint[]) AND run_id = $2 AND outcome IS NULL
          FOR KEY SHARE`,
        [[reservation.originClaimId, reservation.ownerClaimId], reservation.runId],
      );
      if (new Set(claimRows.map((row) => Number(row.id))).size !== new Set([
        reservation.originClaimId,
        reservation.ownerClaimId,
      ]).size) {
        throw new Error("PRODUCT_COMPILATION_CLAIM_BINDING_INVALID");
      }

      const existingAccepted = await first(
        transaction,
        `SELECT * FROM product_compilation_attempts
          WHERE run_id = $1 AND pass_kind = $2 AND authority_hash = $3
            AND disposition = 'accepted' LIMIT 1`,
        [reservation.runId, reservation.passKind, reservation.authorityHash],
      );
      if (existingAccepted) return { status: "already_accepted" as const, attempt: mapAttempt(existingAccepted) };

      const id = attemptId(reservation);
      const duplicate = await first(
        transaction,
        "SELECT * FROM product_compilation_attempts WHERE attempt_id = $1",
        [id],
      );
      if (duplicate) return { status: "duplicate" as const, attempt: mapAttempt(duplicate) };

      const active = await first(
        transaction,
        `SELECT * FROM product_compilation_attempts
          WHERE run_id = $1 AND pass_kind = $2 AND authority_hash = $3
            AND state IN ('reserved', 'dispatching') LIMIT 1`,
        [reservation.runId, reservation.passKind, reservation.authorityHash],
      );
      if (active) return { status: "active_conflict" as const, attempt: mapAttempt(active) };

      if (reservation.ordinal === 2) {
        const retry = reservation.retryAuthority!;
        const parent = await first(
          transaction,
          "SELECT * FROM product_compilation_attempts WHERE attempt_id = $1 FOR KEY SHARE",
          [retry.parentAttemptRef],
        );
        if (
          !parent
          || parent.run_id !== reservation.runId
          || parent.pass_kind !== reservation.passKind
          || parent.authority_hash !== reservation.authorityHash
          || parent.ordinal !== 1
          || parent.state !== "sealed"
          || parent.disposition === "accepted"
          || parent.failure_artifact_hash !== retry.parentFailureArtifactHash
          || parent.failure_fingerprint !== retry.parentFailureFingerprint
        ) {
          throw new Error("PRODUCT_COMPILATION_RETRY_AUTHORITY_INVALID");
        }
      }

      const now = await readDatabaseWallClock(transaction, "PRODUCT_COMPILATION_DATABASE_TIME_UNAVAILABLE");
      const expiresAt = new Date(now.getTime() + reservation.leaseMs);
      const fenceToken = randomHash();
      const leaseToken = randomHash();
      const retry = reservation.retryAuthority;
      const inserted = await first(
        transaction,
        `INSERT INTO product_compilation_attempts (
           attempt_id, run_id, origin_claim_id, owner_claim_id, pass_kind,
           authority_hash, request_hash, ordinal, parent_attempt_id,
           parent_failure_artifact_hash, parent_failure_fingerprint, retry_delta_hash,
           generation, fence_token, state, owner_instance_id, lease_token,
           lease_acquired_at, lease_expires_at, heartbeat_at, attempt_locator,
           created_at, updated_at
         ) VALUES (
           $1, $2, $3, $4, $5,
           $6, $7, $8, $9,
           $10, $11, $12,
           $8, $13, 'reserved', $14, $15,
           $16, $17, $16, $18,
           $16, $16
         ) RETURNING *`,
        [
          id,
          reservation.runId,
          reservation.originClaimId,
          reservation.ownerClaimId,
          reservation.passKind,
          reservation.authorityHash,
          reservation.requestHash,
          reservation.ordinal,
          retry?.parentAttemptRef ?? null,
          retry?.parentFailureArtifactHash ?? null,
          retry?.parentFailureFingerprint ?? null,
          retry?.retryDeltaHash ?? null,
          fenceToken,
          reservation.ownerInstanceId,
          leaseToken,
          now,
          expiresAt,
          `.setfarm/product-compilation-attempts/${id}`,
        ],
      );
      if (!inserted) throw new Error("PRODUCT_COMPILATION_ATTEMPT_INSERT_FAILED");
      return { status: "reserved" as const, attempt: mapAttempt(inserted) };
    }) as Promise<ProductCompilationAttemptReservationResult>;
  }

  async commitDispatchIntent(input: unknown): Promise<ProductCompilationAttemptV1> {
    const identity = DispatchSchema.parse(input);
    return this.withLiveFence(identity, async (transaction, current, now) => {
      if (current.state !== "reserved") throw new Error("PRODUCT_COMPILATION_DISPATCH_STATE_INVALID");
      return first(
        transaction,
        `UPDATE product_compilation_attempts
            SET state = 'dispatching', dispatch_intent_at = $5,
                dispatch_started_at = $5, external_operation_id = $6,
                heartbeat_at = $5, updated_at = $5
          WHERE attempt_id = $1 AND generation = $2 AND fence_token = $3
            AND owner_instance_id = $4 AND state = 'reserved'
          RETURNING *`,
        [identity.attemptId, identity.generation, identity.fenceToken, identity.ownerInstanceId, now, identity.externalOperationId],
      );
    });
  }

  async sealAccepted(input: unknown): Promise<ProductCompilationAttemptV1> {
    const seal = AcceptedSealSchema.parse(input);
    return this.withLiveFence(seal, async (transaction, current, now) => {
      if (current.state !== "dispatching") throw new Error("PRODUCT_COMPILATION_SEAL_STATE_INVALID");
      const outputSealHash = hashCanonicalJson({
        schema: "setfarm.product-compilation-output-seal.v1",
        attemptRef: seal.attemptId,
        disposition: "accepted",
        outputRefs: seal.outputRefs,
      });
      return first(
        transaction,
        `UPDATE product_compilation_attempts
            SET state = 'sealed', disposition = 'accepted', output_refs = $5::text::jsonb,
                output_seal_hash = $6, dispatch_finished_at = $7,
                owner_instance_id = NULL, lease_token = NULL, lease_acquired_at = NULL,
                lease_expires_at = NULL, heartbeat_at = NULL, updated_at = $7
          WHERE attempt_id = $1 AND generation = $2 AND fence_token = $3
            AND owner_instance_id = $4 AND state = 'dispatching'
          RETURNING *`,
        [seal.attemptId, seal.generation, seal.fenceToken, seal.ownerInstanceId, JSON.stringify(seal.outputRefs), outputSealHash, now],
      );
    });
  }

  async sealFailure(input: unknown): Promise<ProductCompilationAttemptV1> {
    const seal = FailureSealSchema.parse(input);
    return this.withLiveFence(seal, async (transaction, current, now) => {
      if (current.state !== "dispatching") throw new Error("PRODUCT_COMPILATION_SEAL_STATE_INVALID");
      const state = seal.disposition === "dispatch_ambiguous" ? "quarantined" : "sealed";
      const outputSealHash = hashCanonicalJson({
        schema: "setfarm.product-compilation-output-seal.v1",
        attemptRef: seal.attemptId,
        disposition: seal.disposition,
        failure: seal.failure,
      });
      return first(
        transaction,
        `UPDATE product_compilation_attempts
            SET state = $5, disposition = $6, failure = $7::text::jsonb,
                failure_artifact_hash = $8, failure_fingerprint = $9,
                operational_cause_hash = $10, output_seal_hash = $11,
                dispatch_finished_at = $12,
                owner_instance_id = NULL, lease_token = NULL, lease_acquired_at = NULL,
                lease_expires_at = NULL, heartbeat_at = NULL, updated_at = $12
          WHERE attempt_id = $1 AND generation = $2 AND fence_token = $3
            AND owner_instance_id = $4 AND state = 'dispatching'
          RETURNING *`,
        [
          seal.attemptId,
          seal.generation,
          seal.fenceToken,
          seal.ownerInstanceId,
          state,
          seal.disposition,
          JSON.stringify(seal.failure),
          seal.failure.failureArtifactHash,
          seal.failure.failureFingerprint,
          seal.failure.operationalCauseHash,
          outputSealHash,
          now,
        ],
      );
    });
  }

  async heartbeat(input: unknown, leaseMs = 5 * 60_000): Promise<ProductCompilationAttemptV1> {
    const identity = FenceSchema.parse(input);
    return this.withLiveFence(identity, async (transaction, current, now) => {
      if (!["reserved", "dispatching"].includes(current.state)) {
        throw new Error("PRODUCT_COMPILATION_HEARTBEAT_STATE_INVALID");
      }
      const expiresAt = new Date(now.getTime() + Math.max(5_000, Math.min(leaseMs, 30 * 60_000)));
      return first(
        transaction,
        `UPDATE product_compilation_attempts
            SET heartbeat_at = $5, lease_expires_at = $6, updated_at = $5
          WHERE attempt_id = $1 AND generation = $2 AND fence_token = $3
            AND owner_instance_id = $4 AND state IN ('reserved', 'dispatching')
          RETURNING *`,
        [identity.attemptId, identity.generation, identity.fenceToken, identity.ownerInstanceId, now, expiresAt],
      );
    });
  }

  async get(attemptIdInput: string): Promise<ProductCompilationAttemptV1 | undefined> {
    const parsed = z.string().regex(/^PCA_[a-f0-9]{64}$/).parse(attemptIdInput);
    const row = await first(this.sql, "SELECT * FROM product_compilation_attempts WHERE attempt_id = $1", [parsed]);
    return row ? mapAttempt(row) : undefined;
  }

  private async withLiveFence<T extends z.infer<typeof FenceSchema>>(
    identity: T,
    operation: (
      transaction: TransactionSql,
      current: AttemptRow,
      now: Date,
    ) => Promise<AttemptRow | undefined>,
  ): Promise<ProductCompilationAttemptV1> {
    const row = await this.sql.begin(async (transaction) => {
      const current = await first(
        transaction,
        `SELECT * FROM product_compilation_attempts
          WHERE attempt_id = $1 AND generation = $2 AND fence_token = $3
            AND owner_instance_id = $4
          FOR UPDATE`,
        [identity.attemptId, identity.generation, identity.fenceToken, identity.ownerInstanceId],
      );
      if (!current) throw new Error("PRODUCT_COMPILATION_STALE_FENCE");
      const now = await readDatabaseWallClock(transaction, "PRODUCT_COMPILATION_DATABASE_TIME_UNAVAILABLE");
      if (!current.lease_expires_at || new Date(current.lease_expires_at).getTime() <= now.getTime()) {
        throw new Error("PRODUCT_COMPILATION_LEASE_EXPIRED");
      }
      const updated = await operation(transaction, current, now);
      if (!updated) throw new Error("PRODUCT_COMPILATION_FENCE_CAS_LOST");
      return updated;
    });
    return mapAttempt(row as AttemptRow);
  }
}

export const ProductCompilationAttemptReservationSchema = ReservationSchema;
export const ProductCompilationAttemptFenceSchema = FenceSchema;
export const ProductCompilationAttemptDispatchSchema = DispatchSchema;
export const ProductCompilationAttemptAcceptedSealSchema = AcceptedSealSchema;
export const ProductCompilationAttemptFailureSealSchema = FailureSealSchema;
export const ProductCompilationAttemptTimestampSchema = TimestampSchema;
