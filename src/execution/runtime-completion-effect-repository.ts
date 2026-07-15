import { randomUUID } from "node:crypto";

import type postgres from "postgres";
import { z } from "zod";

import { readDatabaseWallClock } from "../db/database-wall-clock.js";

type Sql = postgres.Sql;
type TransactionSql = postgres.TransactionSql;

const EffectStateSchema = z.enum(["pending", "leased", "applied", "reconciled", "quarantined"]);

type EffectRow = Readonly<{
  request_id: string;
  effect_key: string;
  ordinal: number;
  effect_type: string;
  input_hash: string;
  payload: unknown;
  mandatory: boolean;
  state: string;
  owner_instance_id: string | null;
  lease_token: string | null;
  lease_expires_at: Date | string | null;
  attempt_count: number;
  result: unknown;
  evidence: unknown;
  applied_at: Date | string | null;
  reconciled_at: Date | string | null;
  created_at: Date | string;
  updated_at: Date | string;
}>;

export type RuntimeCompletionEffect = Readonly<{
  requestId: string;
  effectKey: string;
  ordinal: number;
  effectType: string;
  inputHash: string;
  payload: Record<string, unknown>;
  mandatory: boolean;
  state: z.infer<typeof EffectStateSchema>;
  ownerInstanceId?: string;
  leaseToken?: string;
  leaseExpiresAt?: string;
  attemptCount: number;
  result: Record<string, unknown>;
  evidence: Record<string, unknown>;
  appliedAt?: string;
  reconciledAt?: string;
  createdAt: string;
  updatedAt: string;
}>;

function timestamp(value: Date | string): string {
  return (value instanceof Date ? value : new Date(value)).toISOString();
}

function optionalTimestamp(value: Date | string | null): string | undefined {
  return value === null ? undefined : timestamp(value);
}

function objectValue(value: unknown, code: string): Record<string, unknown> {
  const parsed = typeof value === "string" ? JSON.parse(value) as unknown : value;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error(code);
  return parsed as Record<string, unknown>;
}

function mapEffect(row: EffectRow): RuntimeCompletionEffect {
  return Object.freeze({
    requestId: row.request_id,
    effectKey: row.effect_key,
    ordinal: row.ordinal,
    effectType: row.effect_type,
    inputHash: row.input_hash,
    payload: Object.freeze({ ...objectValue(row.payload, "RUNTIME_COMPLETION_EFFECT_PAYLOAD_INVALID") }),
    mandatory: row.mandatory,
    state: EffectStateSchema.parse(row.state),
    ...(row.owner_instance_id ? { ownerInstanceId: row.owner_instance_id } : {}),
    ...(row.lease_token ? { leaseToken: row.lease_token } : {}),
    ...(optionalTimestamp(row.lease_expires_at) ? { leaseExpiresAt: optionalTimestamp(row.lease_expires_at) } : {}),
    attemptCount: row.attempt_count,
    result: Object.freeze({ ...objectValue(row.result, "RUNTIME_COMPLETION_EFFECT_RESULT_INVALID") }),
    evidence: Object.freeze({ ...objectValue(row.evidence, "RUNTIME_COMPLETION_EFFECT_EVIDENCE_INVALID") }),
    ...(optionalTimestamp(row.applied_at) ? { appliedAt: optionalTimestamp(row.applied_at) } : {}),
    ...(optionalTimestamp(row.reconciled_at) ? { reconciledAt: optionalTimestamp(row.reconciled_at) } : {}),
    createdAt: timestamp(row.created_at),
    updatedAt: timestamp(row.updated_at),
  });
}

function validTime(value?: Date): Date {
  const parsed = value ? new Date(value) : new Date();
  if (!Number.isFinite(parsed.getTime())) throw new Error("RUNTIME_COMPLETION_EFFECT_TIME_INVALID");
  return parsed;
}

type LockedEffectAuthority = Readonly<{
  request?: Readonly<{ state: string; apply_phase: string }>;
  effect?: EffectRow;
  wallClock?: Date;
}>;

/**
 * Every effect writer uses the same owner order as runtime completion:
 * run -> completion request -> effect -> database wall clock. This makes run
 * terminalization and effect settlement mutually exclusive at the canonical
 * run owner, while caller clocks remain validation-only inputs.
 */
async function lockEffectAuthorityInTransaction(
  sql: TransactionSql,
  input: Readonly<{ requestId: string; effectKey: string; now?: Date }>,
): Promise<LockedEffectAuthority> {
  validTime(input.now);
  const identities = await sql.unsafe<Array<{ run_id: string }>>(
    "SELECT run_id FROM runtime_completion_requests WHERE request_id = $1",
    [input.requestId],
  );
  if (!identities[0]) return {};
  await sql.unsafe("SELECT id FROM runs WHERE id = $1 FOR UPDATE", [identities[0].run_id]);
  const requests = await sql.unsafe<Array<{ state: string; apply_phase: string }>>(
    "SELECT state, apply_phase FROM runtime_completion_requests WHERE request_id = $1 FOR UPDATE",
    [input.requestId],
  );
  const effects = await sql.unsafe<EffectRow[]>(
    `SELECT * FROM runtime_completion_effects
      WHERE request_id = $1 AND effect_key = $2
      FOR UPDATE`,
    [input.requestId, input.effectKey],
  );
  const wallClock = await readDatabaseWallClock(
    sql,
    "RUNTIME_COMPLETION_EFFECT_DATABASE_TIME_UNAVAILABLE",
  );
  return {
    ...(requests[0] ? { request: requests[0] } : {}),
    ...(effects[0] ? { effect: effects[0] } : {}),
    wallClock,
  };
}

function hasLiveEffectLease(
  authority: LockedEffectAuthority,
  ownerInstanceId: string,
  leaseToken: string,
): authority is LockedEffectAuthority & Readonly<{ effect: EffectRow; wallClock: Date }> {
  return Boolean(
    authority.request?.state === "processing"
    && authority.request.apply_phase === "owner_committed"
    && authority.effect?.state === "leased"
    && authority.effect.owner_instance_id === ownerInstanceId
    && authority.effect.lease_token === leaseToken
    && authority.effect.lease_expires_at
    && authority.wallClock
    && new Date(authority.effect.lease_expires_at).getTime() > authority.wallClock.getTime(),
  );
}

export async function assertRuntimeCompletionEffectLeaseInTransaction(
  sql: TransactionSql,
  input: Readonly<{
    requestId: string;
    effectKey: string;
    ownerInstanceId: string;
    leaseToken: string;
    now?: Date;
  }>,
): Promise<RuntimeCompletionEffect> {
  const authority = await lockEffectAuthorityInTransaction(sql, input);
  if (!authority.request) throw new Error("RUNTIME_COMPLETION_EFFECT_REQUEST_NOT_FOUND");
  if (
    authority.request.state !== "processing"
    || authority.request.apply_phase !== "owner_committed"
  ) throw new Error("RUNTIME_COMPLETION_EFFECT_REQUEST_NOT_APPLYING");
  const effect = authority.effect;
  if (!effect) throw new Error("RUNTIME_COMPLETION_EFFECT_NOT_FOUND");
  if (!hasLiveEffectLease(authority, input.ownerInstanceId, input.leaseToken)) {
    throw new Error("RUNTIME_COMPLETION_EFFECT_LEASE_LOST");
  }
  return mapEffect(effect);
}

export function createRuntimeCompletionEffectRepository(sql: Sql) {
  return Object.freeze({
    async listForRequest(requestId: string): Promise<RuntimeCompletionEffect[]> {
      const rows = await sql.unsafe<EffectRow[]>(
        "SELECT * FROM runtime_completion_effects WHERE request_id = $1 ORDER BY ordinal, effect_key",
        [requestId],
      );
      return rows.map(mapEffect);
    },

    async claimNext(input: Readonly<{
      requestId: string;
      ownerInstanceId: string;
      leaseMs?: number;
      now?: Date;
    }>): Promise<RuntimeCompletionEffect | undefined> {
      validTime(input.now);
      const leaseMs = Math.max(30_000, Math.min(30 * 60_000, Math.trunc(input.leaseMs ?? 2 * 60_000)));
      return sql.begin(async (transaction) => {
        const requestRows = await transaction.unsafe<Array<{ run_id: string }>>(
          "SELECT run_id FROM runtime_completion_requests WHERE request_id = $1",
          [input.requestId],
        );
        if (!requestRows[0]) throw new Error("RUNTIME_COMPLETION_EFFECT_REQUEST_NOT_FOUND");
        await transaction.unsafe("SELECT id FROM runs WHERE id = $1 FOR UPDATE", [requestRows[0].run_id]);
        const locked = await transaction.unsafe<Array<{ state: string; apply_phase: string }>>(
          "SELECT state, apply_phase FROM runtime_completion_requests WHERE request_id = $1 FOR UPDATE",
          [input.requestId],
        );
        if (locked[0]?.state !== "processing" || locked[0]?.apply_phase !== "owner_committed") return undefined;
        const candidates = await transaction.unsafe<EffectRow[]>(
          `SELECT effect.* FROM runtime_completion_effects effect
            WHERE effect.request_id = $1
              AND (effect.state = 'pending'
                OR (effect.state = 'leased' AND effect.lease_expires_at <= clock_timestamp()))
              AND NOT EXISTS (
                SELECT 1 FROM runtime_completion_effects prior
                 WHERE prior.request_id = effect.request_id
                   AND prior.ordinal < effect.ordinal
                   AND prior.mandatory
                   AND prior.state NOT IN ('applied', 'reconciled')
              )
            ORDER BY effect.ordinal, effect.effect_key
            LIMIT 1 FOR UPDATE SKIP LOCKED`,
          [input.requestId],
        );
        const candidate = candidates[0];
        if (!candidate) return undefined;
        const now = await readDatabaseWallClock(
          transaction,
          "RUNTIME_COMPLETION_EFFECT_DATABASE_TIME_UNAVAILABLE",
        );
        if (
          candidate.state === "leased"
          && (
            !candidate.lease_expires_at
            || new Date(candidate.lease_expires_at).getTime() > now.getTime()
          )
        ) return undefined;
        const leaseToken = `RCE_${randomUUID()}`;
        const rows = await transaction.unsafe<EffectRow[]>(
          `UPDATE runtime_completion_effects
              SET state = 'leased', owner_instance_id = $3, lease_token = $4,
                  lease_expires_at = $5, attempt_count = attempt_count + 1,
                  updated_at = $2
            WHERE request_id = $1 AND effect_key = $6
              AND (state = 'pending' OR (state = 'leased' AND lease_expires_at <= $2))
            RETURNING *`,
          [
            input.requestId,
            now,
            input.ownerInstanceId,
            leaseToken,
            new Date(now.getTime() + leaseMs),
            candidate.effect_key,
          ],
        );
        return rows[0] ? mapEffect(rows[0]) : undefined;
      }) as Promise<RuntimeCompletionEffect | undefined>;
    },

    async heartbeat(input: Readonly<{
      requestId: string;
      effectKey: string;
      ownerInstanceId: string;
      leaseToken: string;
      leaseMs?: number;
      now?: Date;
    }>): Promise<boolean> {
      validTime(input.now);
      const leaseMs = Math.max(30_000, Math.min(30 * 60_000, Math.trunc(input.leaseMs ?? 2 * 60_000)));
      return sql.begin(async (transaction) => {
        const authority = await lockEffectAuthorityInTransaction(transaction, input);
        if (!hasLiveEffectLease(authority, input.ownerInstanceId, input.leaseToken)) return false;
        const rows = await transaction.unsafe<Array<{ effect_key: string }>>(
          `UPDATE runtime_completion_effects
              SET lease_expires_at = $5, updated_at = $6
            WHERE request_id = $1 AND effect_key = $2 AND state = 'leased'
              AND owner_instance_id = $3 AND lease_token = $4
              AND lease_expires_at > $6
            RETURNING effect_key`,
          [
            input.requestId,
            input.effectKey,
            input.ownerInstanceId,
            input.leaseToken,
            new Date(authority.wallClock.getTime() + leaseMs),
            authority.wallClock,
          ],
        );
        return rows.length === 1;
      }) as Promise<boolean>;
    },

    async assertLease(input: Readonly<{
      requestId: string;
      effectKey: string;
      ownerInstanceId: string;
      leaseToken: string;
      now?: Date;
    }>): Promise<RuntimeCompletionEffect> {
      return sql.begin((transaction) => assertRuntimeCompletionEffectLeaseInTransaction(
        transaction,
        input,
      )) as Promise<RuntimeCompletionEffect>;
    },

    async releaseForRetry(input: Readonly<{
      requestId: string;
      effectKey: string;
      ownerInstanceId: string;
      leaseToken: string;
      diagnostic: string;
      now?: Date;
    }>): Promise<void> {
      validTime(input.now);
      await sql.begin(async (transaction) => {
        const authority = await lockEffectAuthorityInTransaction(transaction, input);
        if (!hasLiveEffectLease(authority, input.ownerInstanceId, input.leaseToken)) {
          throw new Error("RUNTIME_COMPLETION_EFFECT_RETRY_FENCE_LOST");
        }
        const rows = await transaction.unsafe<Array<{ effect_key: string }>>(
          `UPDATE runtime_completion_effects
              SET state = 'pending', owner_instance_id = NULL, lease_token = NULL,
                  lease_expires_at = NULL,
                  result = jsonb_build_object('lastDiagnostic', $5),
                  updated_at = $6
            WHERE request_id = $1 AND effect_key = $2 AND state = 'leased'
              AND owner_instance_id = $3 AND lease_token = $4
              AND lease_expires_at > $6
            RETURNING effect_key`,
          [
            input.requestId,
            input.effectKey,
            input.ownerInstanceId,
            input.leaseToken,
            input.diagnostic.slice(0, 4_000),
            authority.wallClock,
          ],
        );
        if (rows.length !== 1) throw new Error("RUNTIME_COMPLETION_EFFECT_RETRY_FENCE_LOST");
      });
    },

    async quarantine(input: Readonly<{
      requestId: string;
      effectKey: string;
      ownerInstanceId: string;
      leaseToken: string;
      diagnostic: string;
      evidence?: Record<string, unknown>;
      now?: Date;
    }>): Promise<RuntimeCompletionEffect> {
      validTime(input.now);
      return sql.begin(async (transaction) => {
        const authority = await lockEffectAuthorityInTransaction(transaction, input);
        if (!hasLiveEffectLease(authority, input.ownerInstanceId, input.leaseToken)) {
          throw new Error("RUNTIME_COMPLETION_EFFECT_QUARANTINE_FENCE_LOST");
        }
        const rows = await transaction.unsafe<EffectRow[]>(
          `UPDATE runtime_completion_effects
              SET state = 'quarantined', owner_instance_id = NULL, lease_token = NULL,
                  lease_expires_at = NULL,
                  result = jsonb_build_object('diagnostic', $5),
                  evidence = $6::text::jsonb,
                  updated_at = $7
            WHERE request_id = $1 AND effect_key = $2 AND state = 'leased'
              AND owner_instance_id = $3 AND lease_token = $4
              AND lease_expires_at > $7
            RETURNING *`,
          [
            input.requestId,
            input.effectKey,
            input.ownerInstanceId,
            input.leaseToken,
            input.diagnostic.slice(0, 4_000),
            JSON.stringify(input.evidence ?? {}),
            authority.wallClock,
          ],
        );
        if (rows.length !== 1) throw new Error("RUNTIME_COMPLETION_EFFECT_QUARANTINE_FENCE_LOST");
        return mapEffect(rows[0]!);
      }) as Promise<RuntimeCompletionEffect>;
    },

    async settle(input: Readonly<{
      requestId: string;
      effectKey: string;
      ownerInstanceId: string;
      leaseToken: string;
      resolution: "applied" | "reconciled";
      result: Record<string, unknown>;
      evidence: Record<string, unknown>;
      now?: Date;
    }>): Promise<RuntimeCompletionEffect> {
      validTime(input.now);
      return sql.begin(async (transaction) => {
        const authority = await lockEffectAuthorityInTransaction(transaction, input);
        if (!hasLiveEffectLease(authority, input.ownerInstanceId, input.leaseToken)) {
          throw new Error("RUNTIME_COMPLETION_EFFECT_SETTLE_FENCE_LOST");
        }
        const rows = await transaction.unsafe<EffectRow[]>(
          `UPDATE runtime_completion_effects
              SET state = $5, owner_instance_id = NULL, lease_token = NULL,
                  lease_expires_at = NULL, result = $6::text::jsonb,
                  evidence = $7::text::jsonb,
                  applied_at = CASE WHEN $5 = 'applied' THEN $8 ELSE applied_at END,
                  reconciled_at = CASE WHEN $5 = 'reconciled' THEN $8 ELSE reconciled_at END,
                  updated_at = $8
            WHERE request_id = $1 AND effect_key = $2 AND state = 'leased'
              AND owner_instance_id = $3 AND lease_token = $4
              AND lease_expires_at > $8
            RETURNING *`,
          [
            input.requestId,
            input.effectKey,
            input.ownerInstanceId,
            input.leaseToken,
            input.resolution,
            JSON.stringify(input.result),
            JSON.stringify(input.evidence),
            authority.wallClock,
          ],
        );
        if (rows.length !== 1) throw new Error("RUNTIME_COMPLETION_EFFECT_SETTLE_FENCE_LOST");
        return mapEffect(rows[0]!);
      }) as Promise<RuntimeCompletionEffect>;
    },

    async allMandatorySettled(requestId: string): Promise<boolean> {
      const rows = await sql.unsafe<Array<{ count: number }>>(
        `SELECT COUNT(*)::integer AS count
           FROM runtime_completion_effects
          WHERE request_id = $1 AND mandatory
            AND state NOT IN ('applied', 'reconciled')`,
        [requestId],
      );
      return (rows[0]?.count ?? 0) === 0;
    },
  });
}
