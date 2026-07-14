import { randomUUID } from "node:crypto";

import type postgres from "postgres";
import { z } from "zod";

import { hashCanonicalJson } from "../product-compiler/canonical-json.js";
import {
  CanonicalOperationalEventV1Schema,
  createCanonicalOperationalEventV1,
  operationalEventDeliveryId,
  type CanonicalOperationalEventV1,
  type OperationalEventDeliveryConsumerV1,
} from "./schemas/operational-event-v1.js";

type Sql = postgres.Sql;

const OutboxStateSchema = z.enum(["pending", "leased", "published", "quarantined"]);
const NonBlankStringSchema = z.string().min(1).refine((value) => value.trim().length > 0);

type OutboxRow = Readonly<{
  outbox_id: string;
  request_id: string | null;
  event_key: string;
  event_type: string;
  aggregate_type: string;
  aggregate_id: string;
  payload: unknown;
  state: string;
  owner_instance_id: string | null;
  lease_token: string | null;
  lease_expires_at: Date | string | null;
  attempt_count: number;
  published_at: Date | string | null;
  diagnostic: string | null;
  created_at: Date | string;
  updated_at: Date | string;
}>;

type CanonicalEventRow = Readonly<{
  event_key: string;
  outbox_id: string;
  request_id: string | null;
  event_type: string;
  aggregate_type: string;
  aggregate_id: string;
  run_id: string;
  payload: unknown;
  event_hash: string;
  source_created_at: Date | string;
  committed_at: Date | string;
}>;

type DeliveryIdentityRow = Readonly<{
  delivery_id: string;
  event_key: string;
  consumer: string;
  input_hash: string;
  idempotency_key: string;
}>;

export type OperationalOutboxState = z.infer<typeof OutboxStateSchema>;

export type OperationalOutboxEvent = Readonly<{
  outboxId: string;
  requestId?: string;
  eventKey: string;
  eventType: string;
  aggregateType: string;
  aggregateId: string;
  payload: Readonly<Record<string, unknown>>;
  state: OperationalOutboxState;
  ownerInstanceId?: string;
  leaseToken?: string;
  leaseExpiresAt?: string;
  attemptCount: number;
  publishedAt?: string;
  diagnostic?: string;
  createdAt: string;
  updatedAt: string;
}>;

export type EnqueueOperationalOutboxEvent = Readonly<{
  requestId?: string;
  eventKey: string;
  eventType: string;
  aggregateType: string;
  aggregateId: string;
  payload: unknown;
  now?: Date;
}>;

type JsonValue =
  | null
  | boolean
  | number
  | string
  | readonly JsonValue[]
  | { readonly [key: string]: JsonValue };

function timestamp(value: Date | string, code: string): string {
  const parsed = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(parsed.getTime())) throw new Error(code);
  return parsed.toISOString();
}

function optionalTimestamp(value: Date | string | null, code: string): string | undefined {
  return value === null ? undefined : timestamp(value, code);
}

function validTime(value?: Date): Date {
  const parsed = value ? new Date(value) : new Date();
  if (!Number.isFinite(parsed.getTime())) throw new Error("OPERATIONAL_OUTBOX_TIME_INVALID");
  return parsed;
}

function requiredString(value: string, code: string): string {
  const parsed = NonBlankStringSchema.safeParse(value);
  if (!parsed.success) throw new Error(code);
  return parsed.data;
}

function leaseDuration(value?: number): number {
  const candidate = value ?? 2 * 60_000;
  if (!Number.isFinite(candidate) || !Number.isInteger(candidate) || candidate <= 0) {
    throw new Error("OPERATIONAL_OUTBOX_LEASE_DURATION_INVALID");
  }
  return Math.max(1_000, Math.min(30 * 60_000, candidate));
}

function quarantineAttemptLimit(value: number): number {
  if (!Number.isInteger(value) || value < 1 || value > 100) {
    throw new Error("OPERATIONAL_OUTBOX_QUARANTINE_ATTEMPT_LIMIT_INVALID");
  }
  return value;
}

function diagnostic(value: string): string {
  const parsed = requiredString(value, "OPERATIONAL_OUTBOX_DIAGNOSTIC_INVALID").trim();
  return parsed.slice(0, 4_000);
}

function cloneJsonValue(
  value: unknown,
  seen: WeakSet<object>,
  code: string,
): JsonValue {
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error(code);
    return value;
  }
  if (typeof value !== "object") throw new Error(code);
  if (seen.has(value)) throw new Error(code);
  seen.add(value);
  try {
    if (Array.isArray(value)) return value.map((entry) => cloneJsonValue(entry, seen, code));
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) throw new Error(code);
    const result: Record<string, JsonValue> = {};
    for (const [key, entry] of Object.entries(value)) {
      result[key] = cloneJsonValue(entry, seen, code);
    }
    return result;
  } finally {
    seen.delete(value);
  }
}

function freezeJson(value: JsonValue): JsonValue {
  if (Array.isArray(value)) {
    for (const entry of value) freezeJson(entry);
    return Object.freeze(value);
  }
  if (value && typeof value === "object") {
    for (const entry of Object.values(value)) freezeJson(entry);
    return Object.freeze(value);
  }
  return value;
}

function payloadObject(value: unknown): Readonly<Record<string, unknown>> {
  const decoded = typeof value === "string"
    ? (() => {
        try {
          return JSON.parse(value) as unknown;
        } catch {
          throw new Error("OPERATIONAL_OUTBOX_PAYLOAD_INVALID");
        }
      })()
    : value;
  const cloned = cloneJsonValue(decoded, new WeakSet(), "OPERATIONAL_OUTBOX_PAYLOAD_INVALID");
  if (!cloned || typeof cloned !== "object" || Array.isArray(cloned)) {
    throw new Error("OPERATIONAL_OUTBOX_PAYLOAD_INVALID");
  }
  const objectPayload = cloned as { readonly [key: string]: JsonValue };
  if (typeof objectPayload.schema !== "string" || objectPayload.schema.trim().length === 0) {
    throw new Error("OPERATIONAL_OUTBOX_PAYLOAD_SCHEMA_REQUIRED");
  }
  return freezeJson(objectPayload) as Readonly<Record<string, unknown>>;
}

function mapEvent(row: OutboxRow): OperationalOutboxEvent {
  const state = OutboxStateSchema.parse(row.state);
  const leaseExpiresAt = optionalTimestamp(
    row.lease_expires_at,
    "OPERATIONAL_OUTBOX_LEASE_TIMESTAMP_INVALID",
  );
  const publishedAt = optionalTimestamp(
    row.published_at,
    "OPERATIONAL_OUTBOX_PUBLISHED_TIMESTAMP_INVALID",
  );
  if (state === "leased" && (!row.owner_instance_id || !row.lease_token || !leaseExpiresAt)) {
    throw new Error("OPERATIONAL_OUTBOX_LEASE_INVARIANT_BROKEN");
  }
  if (state !== "leased" && (row.lease_token || leaseExpiresAt)) {
    throw new Error("OPERATIONAL_OUTBOX_LEASE_INVARIANT_BROKEN");
  }
  if (state === "published" && !publishedAt) {
    throw new Error("OPERATIONAL_OUTBOX_PUBLISHED_INVARIANT_BROKEN");
  }
  if (state === "quarantined" && !row.diagnostic?.trim()) {
    throw new Error("OPERATIONAL_OUTBOX_QUARANTINE_INVARIANT_BROKEN");
  }
  return Object.freeze({
    outboxId: row.outbox_id,
    ...(row.request_id ? { requestId: row.request_id } : {}),
    eventKey: row.event_key,
    eventType: row.event_type,
    aggregateType: row.aggregate_type,
    aggregateId: row.aggregate_id,
    payload: payloadObject(row.payload),
    state,
    ...(row.owner_instance_id ? { ownerInstanceId: row.owner_instance_id } : {}),
    ...(row.lease_token ? { leaseToken: row.lease_token } : {}),
    ...(leaseExpiresAt ? { leaseExpiresAt } : {}),
    attemptCount: row.attempt_count,
    ...(publishedAt ? { publishedAt } : {}),
    ...(row.diagnostic ? { diagnostic: row.diagnostic } : {}),
    createdAt: timestamp(row.created_at, "OPERATIONAL_OUTBOX_CREATED_TIMESTAMP_INVALID"),
    updatedAt: timestamp(row.updated_at, "OPERATIONAL_OUTBOX_UPDATED_TIMESTAMP_INVALID"),
  });
}

function mapCanonicalEvent(row: CanonicalEventRow): CanonicalOperationalEventV1 {
  return CanonicalOperationalEventV1Schema.parse({
    schema: "setfarm.operational-event.v1",
    eventKey: row.event_key,
    outboxId: row.outbox_id,
    requestId: row.request_id,
    eventType: row.event_type,
    aggregateType: row.aggregate_type,
    aggregateId: row.aggregate_id,
    runId: row.run_id,
    payload: payloadObject(row.payload),
    eventHash: row.event_hash,
    sourceCreatedAt: timestamp(
      row.source_created_at,
      "OPERATIONAL_EVENT_SOURCE_TIMESTAMP_INVALID",
    ),
    committedAt: timestamp(row.committed_at, "OPERATIONAL_EVENT_COMMITTED_TIMESTAMP_INVALID"),
  });
}

function deliveryConsumers(): readonly OperationalEventDeliveryConsumerV1[] {
  return ["jsonl", "webhook"] as const;
}

export function operationalOutboxIdForEventKey(eventKey: string): string {
  const validated = requiredString(eventKey, "OPERATIONAL_OUTBOX_EVENT_KEY_INVALID");
  return `OBX_${hashCanonicalJson(validated).slice(0, 40)}`;
}

export function createOperationalOutboxRepository(sql: Sql) {
  return Object.freeze({
    async enqueue(input: EnqueueOperationalOutboxEvent): Promise<OperationalOutboxEvent> {
      const now = validTime(input.now);
      const eventKey = requiredString(input.eventKey, "OPERATIONAL_OUTBOX_EVENT_KEY_INVALID");
      const eventType = requiredString(input.eventType, "OPERATIONAL_OUTBOX_EVENT_TYPE_INVALID");
      const aggregateType = requiredString(
        input.aggregateType,
        "OPERATIONAL_OUTBOX_AGGREGATE_TYPE_INVALID",
      );
      const aggregateId = requiredString(input.aggregateId, "OPERATIONAL_OUTBOX_AGGREGATE_ID_INVALID");
      const requestId = input.requestId === undefined
        ? null
        : requiredString(input.requestId, "OPERATIONAL_OUTBOX_REQUEST_ID_INVALID");
      const payload = payloadObject(input.payload);
      const outboxId = operationalOutboxIdForEventKey(eventKey);
      const rows = await sql.unsafe<OutboxRow[]>(
        `INSERT INTO operational_outbox (
           outbox_id, request_id, event_key, event_type, aggregate_type,
           aggregate_id, payload, state, created_at, updated_at
         ) VALUES ($1, $2, $3, $4, $5, $6, $7::text::jsonb, 'pending', $8, $8)
         ON CONFLICT (event_key) DO UPDATE
           SET event_key = EXCLUDED.event_key
         WHERE operational_outbox.outbox_id = EXCLUDED.outbox_id
           AND operational_outbox.request_id IS NOT DISTINCT FROM EXCLUDED.request_id
           AND operational_outbox.event_type = EXCLUDED.event_type
           AND operational_outbox.aggregate_type = EXCLUDED.aggregate_type
           AND operational_outbox.aggregate_id = EXCLUDED.aggregate_id
           AND operational_outbox.payload = EXCLUDED.payload
         RETURNING operational_outbox.*`,
        [
          outboxId,
          requestId,
          eventKey,
          eventType,
          aggregateType,
          aggregateId,
          JSON.stringify(payload),
          now,
        ],
      );
      if (!rows[0]) throw new Error("OPERATIONAL_OUTBOX_EVENT_KEY_CONFLICT");
      return mapEvent(rows[0]);
    },

    async findByEventKey(eventKeyInput: string): Promise<OperationalOutboxEvent | undefined> {
      const eventKey = requiredString(eventKeyInput, "OPERATIONAL_OUTBOX_EVENT_KEY_INVALID");
      const rows = await sql.unsafe<OutboxRow[]>(
        "SELECT * FROM operational_outbox WHERE event_key = $1",
        [eventKey],
      );
      return rows[0] ? mapEvent(rows[0]) : undefined;
    },

    async list(input: Readonly<{
      state?: OperationalOutboxState;
      aggregateType?: string;
      aggregateId?: string;
      limit?: number;
    }> = {}): Promise<OperationalOutboxEvent[]> {
      const state = input.state === undefined ? null : OutboxStateSchema.parse(input.state);
      const aggregateType = input.aggregateType === undefined
        ? null
        : requiredString(input.aggregateType, "OPERATIONAL_OUTBOX_AGGREGATE_TYPE_INVALID");
      const aggregateId = input.aggregateId === undefined
        ? null
        : requiredString(input.aggregateId, "OPERATIONAL_OUTBOX_AGGREGATE_ID_INVALID");
      const limit = input.limit ?? 100;
      if (!Number.isInteger(limit) || limit < 1 || limit > 1_000) {
        throw new Error("OPERATIONAL_OUTBOX_LIST_LIMIT_INVALID");
      }
      const rows = await sql.unsafe<OutboxRow[]>(
        `SELECT * FROM operational_outbox
          WHERE ($1::text IS NULL OR state = $1)
            AND ($2::text IS NULL OR aggregate_type = $2)
            AND ($3::text IS NULL OR aggregate_id = $3)
          ORDER BY created_at, outbox_id
          LIMIT $4`,
        [state, aggregateType, aggregateId, limit],
      );
      return rows.map(mapEvent);
    },

    async claimNext(input: Readonly<{
      ownerInstanceId: string;
      leaseMs?: number;
      now?: Date;
    }>): Promise<OperationalOutboxEvent | undefined> {
      const ownerInstanceId = requiredString(
        input.ownerInstanceId,
        "OPERATIONAL_OUTBOX_OWNER_INSTANCE_ID_INVALID",
      );
      const now = validTime(input.now);
      const leaseMs = leaseDuration(input.leaseMs);
      return sql.begin(async (transaction) => {
        const candidates = await transaction.unsafe<OutboxRow[]>(
          `SELECT * FROM operational_outbox
            WHERE state = 'pending'
               OR (state = 'leased' AND lease_expires_at <= $1)
            ORDER BY created_at, outbox_id
            LIMIT 1
            FOR UPDATE SKIP LOCKED`,
          [now],
        );
        const candidate = candidates[0];
        if (!candidate) return undefined;
        const leaseToken = `OBL_${randomUUID()}`;
        const rows = await transaction.unsafe<OutboxRow[]>(
          `UPDATE operational_outbox
              SET state = 'leased', owner_instance_id = $2, lease_token = $3,
                  lease_expires_at = $4, attempt_count = attempt_count + 1,
                  updated_at = $1
            WHERE outbox_id = $5
            RETURNING *`,
          [
            now,
            ownerInstanceId,
            leaseToken,
            new Date(now.getTime() + leaseMs),
            candidate.outbox_id,
          ],
        );
        if (!rows[0]) throw new Error("OPERATIONAL_OUTBOX_CLAIM_CAS_LOST");
        return mapEvent(rows[0]);
      }) as Promise<OperationalOutboxEvent | undefined>;
    },

    async heartbeat(input: Readonly<{
      outboxId: string;
      ownerInstanceId: string;
      leaseToken: string;
      leaseMs?: number;
      now?: Date;
    }>): Promise<boolean> {
      const outboxId = requiredString(input.outboxId, "OPERATIONAL_OUTBOX_ID_INVALID");
      const ownerInstanceId = requiredString(
        input.ownerInstanceId,
        "OPERATIONAL_OUTBOX_OWNER_INSTANCE_ID_INVALID",
      );
      const leaseToken = requiredString(input.leaseToken, "OPERATIONAL_OUTBOX_LEASE_TOKEN_INVALID");
      const now = validTime(input.now);
      const leaseMs = leaseDuration(input.leaseMs);
      const rows = await sql.unsafe<Array<{ outbox_id: string }>>(
        `UPDATE operational_outbox
            SET lease_expires_at = $4, updated_at = $5
          WHERE outbox_id = $1 AND state = 'leased'
            AND owner_instance_id = $2 AND lease_token = $3
            AND lease_expires_at > $5
          RETURNING outbox_id`,
        [outboxId, ownerInstanceId, leaseToken, new Date(now.getTime() + leaseMs), now],
      );
      return rows.length === 1;
    },

    /**
     * Atomically makes the event authoritative. The immutable canonical event,
     * each derived-delivery owner, and the outbox settlement share one commit;
     * there is no sink-success/publisher-settle crash window.
     */
    async publish(input: Readonly<{
      outboxId: string;
      ownerInstanceId: string;
      leaseToken: string;
      now?: Date;
    }>): Promise<OperationalOutboxEvent> {
      const now = validTime(input.now);
      const outboxId = requiredString(input.outboxId, "OPERATIONAL_OUTBOX_ID_INVALID");
      const ownerInstanceId = requiredString(
        input.ownerInstanceId,
        "OPERATIONAL_OUTBOX_OWNER_INSTANCE_ID_INVALID",
      );
      const leaseToken = requiredString(input.leaseToken, "OPERATIONAL_OUTBOX_LEASE_TOKEN_INVALID");
      return sql.begin(async (transaction) => {
        const locked = await transaction.unsafe<OutboxRow[]>(
          "SELECT * FROM operational_outbox WHERE outbox_id = $1 FOR UPDATE",
          [outboxId],
        );
        const current = locked[0];
        if (
          !current
          || current.state !== "leased"
          || current.owner_instance_id !== ownerInstanceId
          || current.lease_token !== leaseToken
          || !current.lease_expires_at
          || new Date(current.lease_expires_at).getTime() <= now.getTime()
        ) throw new Error("OPERATIONAL_OUTBOX_PUBLISH_FENCE_LOST");

        const event = createCanonicalOperationalEventV1({
          eventKey: current.event_key,
          outboxId: current.outbox_id,
          requestId: current.request_id,
          eventType: current.event_type,
          aggregateType: current.aggregate_type,
          aggregateId: current.aggregate_id,
          payload: payloadObject(current.payload),
          sourceCreatedAt: timestamp(
            current.created_at,
            "OPERATIONAL_EVENT_SOURCE_TIMESTAMP_INVALID",
          ),
          committedAt: now.toISOString(),
        });
        await transaction.unsafe(
          `INSERT INTO operational_events (
             event_key, outbox_id, request_id, event_type, aggregate_type,
             aggregate_id, run_id, payload, event_hash, source_created_at, committed_at
           ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::text::jsonb, $9, $10, $11)
           ON CONFLICT (event_key) DO NOTHING`,
          [
            event.eventKey,
            event.outboxId,
            event.requestId,
            event.eventType,
            event.aggregateType,
            event.aggregateId,
            event.runId,
            JSON.stringify(event.payload),
            event.eventHash,
            event.sourceCreatedAt,
            event.committedAt,
          ],
        );
        const canonicalRows = await transaction.unsafe<CanonicalEventRow[]>(
          "SELECT * FROM operational_events WHERE event_key = $1",
          [event.eventKey],
        );
        const storedEvent = canonicalRows[0] ? mapCanonicalEvent(canonicalRows[0]) : undefined;
        if (
          !storedEvent
          || storedEvent.eventHash !== event.eventHash
          || storedEvent.outboxId !== event.outboxId
          || storedEvent.committedAt !== event.committedAt
        ) throw new Error("OPERATIONAL_EVENT_IDENTITY_CONFLICT");

        for (const consumer of deliveryConsumers()) {
          const deliveryId = operationalEventDeliveryId(event.eventKey, consumer);
          await transaction.unsafe(
            `INSERT INTO operational_event_deliveries (
               event_key, consumer, delivery_id, input_hash, idempotency_key,
               state, created_at, updated_at
             ) VALUES ($1, $2, $3, $4, $1, 'pending', $5, $5)
             ON CONFLICT (event_key, consumer) DO NOTHING`,
            [event.eventKey, consumer, deliveryId, event.eventHash, now],
          );
          const deliveryRows = await transaction.unsafe<DeliveryIdentityRow[]>(
            `SELECT delivery_id, event_key, consumer, input_hash, idempotency_key
               FROM operational_event_deliveries
              WHERE event_key = $1 AND consumer = $2`,
            [event.eventKey, consumer],
          );
          const delivery = deliveryRows[0];
          if (
            !delivery
            || delivery.delivery_id !== deliveryId
            || delivery.input_hash !== event.eventHash
            || delivery.idempotency_key !== event.eventKey
          ) throw new Error("OPERATIONAL_EVENT_DELIVERY_IDENTITY_CONFLICT");
        }

        const rows = await transaction.unsafe<OutboxRow[]>(
          `UPDATE operational_outbox
              SET state = 'published', owner_instance_id = NULL, lease_token = NULL,
                  lease_expires_at = NULL, published_at = $4, diagnostic = NULL,
                  updated_at = $4
            WHERE outbox_id = $1 AND state = 'leased'
              AND owner_instance_id = $2 AND lease_token = $3
              AND lease_expires_at > $4
            RETURNING *`,
          [outboxId, ownerInstanceId, leaseToken, now],
        );
        if (!rows[0]) throw new Error("OPERATIONAL_OUTBOX_PUBLISH_FENCE_LOST");
        return mapEvent(rows[0]);
      }) as Promise<OperationalOutboxEvent>;
    },

    async findCanonicalByEventKey(
      eventKeyInput: string,
    ): Promise<CanonicalOperationalEventV1 | undefined> {
      const eventKey = requiredString(eventKeyInput, "OPERATIONAL_OUTBOX_EVENT_KEY_INVALID");
      const rows = await sql.unsafe<CanonicalEventRow[]>(
        "SELECT * FROM operational_events WHERE event_key = $1",
        [eventKey],
      );
      return rows[0] ? mapCanonicalEvent(rows[0]) : undefined;
    },

    async releaseForRetry(input: Readonly<{
      outboxId: string;
      ownerInstanceId: string;
      leaseToken: string;
      diagnostic: string;
      now?: Date;
    }>): Promise<OperationalOutboxEvent> {
      const now = validTime(input.now);
      const rows = await sql.unsafe<OutboxRow[]>(
        `UPDATE operational_outbox
            SET state = 'pending', owner_instance_id = NULL, lease_token = NULL,
                lease_expires_at = NULL, diagnostic = $4, updated_at = $5
          WHERE outbox_id = $1 AND state = 'leased'
            AND owner_instance_id = $2 AND lease_token = $3
            AND lease_expires_at > $5
          RETURNING *`,
        [
          requiredString(input.outboxId, "OPERATIONAL_OUTBOX_ID_INVALID"),
          requiredString(input.ownerInstanceId, "OPERATIONAL_OUTBOX_OWNER_INSTANCE_ID_INVALID"),
          requiredString(input.leaseToken, "OPERATIONAL_OUTBOX_LEASE_TOKEN_INVALID"),
          diagnostic(input.diagnostic),
          now,
        ],
      );
      if (!rows[0]) throw new Error("OPERATIONAL_OUTBOX_RETRY_FENCE_LOST");
      return mapEvent(rows[0]);
    },

    async quarantine(input: Readonly<{
      outboxId: string;
      ownerInstanceId: string;
      leaseToken: string;
      maxAttempts: number;
      diagnostic: string;
      now?: Date;
    }>): Promise<OperationalOutboxEvent> {
      const now = validTime(input.now);
      const outboxId = requiredString(input.outboxId, "OPERATIONAL_OUTBOX_ID_INVALID");
      const ownerInstanceId = requiredString(
        input.ownerInstanceId,
        "OPERATIONAL_OUTBOX_OWNER_INSTANCE_ID_INVALID",
      );
      const leaseToken = requiredString(input.leaseToken, "OPERATIONAL_OUTBOX_LEASE_TOKEN_INVALID");
      const maxAttempts = quarantineAttemptLimit(input.maxAttempts);
      const quarantineDiagnostic = diagnostic(input.diagnostic);
      return sql.begin(async (transaction) => {
        const locked = await transaction.unsafe<OutboxRow[]>(
          "SELECT * FROM operational_outbox WHERE outbox_id = $1 FOR UPDATE",
          [outboxId],
        );
        const current = locked[0];
        if (
          !current
          || current.state !== "leased"
          || current.owner_instance_id !== ownerInstanceId
          || current.lease_token !== leaseToken
          || !current.lease_expires_at
          || new Date(current.lease_expires_at).getTime() <= now.getTime()
        ) throw new Error("OPERATIONAL_OUTBOX_QUARANTINE_FENCE_LOST");
        if (current.attempt_count < maxAttempts) {
          throw new Error("OPERATIONAL_OUTBOX_QUARANTINE_BUDGET_NOT_EXHAUSTED");
        }
        const rows = await transaction.unsafe<OutboxRow[]>(
          `UPDATE operational_outbox
              SET state = 'quarantined', owner_instance_id = NULL, lease_token = NULL,
                  lease_expires_at = NULL, diagnostic = $2, updated_at = $3
            WHERE outbox_id = $1 AND state = 'leased'
              AND owner_instance_id = $4 AND lease_token = $5
              AND lease_expires_at > $3 AND attempt_count >= $6
            RETURNING *`,
          [outboxId, quarantineDiagnostic, now, ownerInstanceId, leaseToken, maxAttempts],
        );
        if (!rows[0]) throw new Error("OPERATIONAL_OUTBOX_QUARANTINE_FENCE_LOST");
        return mapEvent(rows[0]);
      }) as Promise<OperationalOutboxEvent>;
    },
  });
}
