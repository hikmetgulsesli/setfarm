import { randomUUID } from "node:crypto";

import type postgres from "postgres";
import { z } from "zod";

import {
  CanonicalOperationalEventV1Schema,
  OperationalEventDeliveryConsumerV1Schema,
  operationalEventDeliveryId,
  type CanonicalOperationalEventV1,
  type OperationalEventDeliveryConsumerV1,
} from "./schemas/operational-event-v1.js";

type Sql = postgres.Sql;

const DeliveryStateSchema = z.enum([
  "pending",
  "leased",
  "delivered",
  "skipped",
  "quarantined",
]);
const NonBlankStringSchema = z.string().min(1).refine((value) => value.trim().length > 0);

type DeliveryRow = Readonly<{
  event_key: string;
  consumer: string;
  delivery_id: string;
  input_hash: string;
  idempotency_key: string;
  state: string;
  owner_instance_id: string | null;
  lease_token: string | null;
  lease_expires_at: Date | string | null;
  attempt_count: number;
  delivered_at: Date | string | null;
  diagnostic: string | null;
  result: unknown;
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

export type OperationalEventDeliveryState = z.infer<typeof DeliveryStateSchema>;

export type OperationalEventDelivery = Readonly<{
  eventKey: string;
  consumer: OperationalEventDeliveryConsumerV1;
  deliveryId: string;
  inputHash: string;
  idempotencyKey: string;
  state: OperationalEventDeliveryState;
  ownerInstanceId?: string;
  leaseToken?: string;
  leaseExpiresAt?: string;
  attemptCount: number;
  deliveredAt?: string;
  diagnostic?: string;
  result: Readonly<Record<string, unknown>>;
  createdAt: string;
  updatedAt: string;
  event: CanonicalOperationalEventV1;
}>;

function requiredString(value: string, code: string): string {
  const parsed = NonBlankStringSchema.safeParse(value);
  if (!parsed.success) throw new Error(code);
  return parsed.data;
}

function validTime(value?: Date): Date {
  const parsed = value ? new Date(value) : new Date();
  if (!Number.isFinite(parsed.getTime())) throw new Error("OPERATIONAL_EVENT_DELIVERY_TIME_INVALID");
  return parsed;
}

function leaseDuration(value?: number): number {
  const candidate = value ?? 2 * 60_000;
  if (!Number.isInteger(candidate) || candidate < 1_000 || candidate > 30 * 60_000) {
    throw new Error("OPERATIONAL_EVENT_DELIVERY_LEASE_DURATION_INVALID");
  }
  return candidate;
}

function timestamp(value: Date | string, code: string): string {
  const parsed = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(parsed.getTime())) throw new Error(code);
  return parsed.toISOString();
}

function optionalTimestamp(value: Date | string | null, code: string): string | undefined {
  return value === null ? undefined : timestamp(value, code);
}

function objectValue(value: unknown, code: string): Readonly<Record<string, unknown>> {
  const decoded = typeof value === "string" ? (() => {
    try {
      return JSON.parse(value) as unknown;
    } catch {
      throw new Error(code);
    }
  })() : value;
  const parsed = z.record(z.string(), z.json()).safeParse(decoded);
  if (!parsed.success) throw new Error(code);
  return Object.freeze(parsed.data);
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
    payload: objectValue(row.payload, "OPERATIONAL_EVENT_PAYLOAD_INVALID"),
    eventHash: row.event_hash,
    sourceCreatedAt: timestamp(row.source_created_at, "OPERATIONAL_EVENT_SOURCE_TIMESTAMP_INVALID"),
    committedAt: timestamp(row.committed_at, "OPERATIONAL_EVENT_COMMITTED_TIMESTAMP_INVALID"),
  });
}

function mapDelivery(row: DeliveryRow, event: CanonicalEventRow): OperationalEventDelivery {
  const consumer = OperationalEventDeliveryConsumerV1Schema.parse(row.consumer);
  const state = DeliveryStateSchema.parse(row.state);
  const leaseExpiresAt = optionalTimestamp(
    row.lease_expires_at,
    "OPERATIONAL_EVENT_DELIVERY_LEASE_TIMESTAMP_INVALID",
  );
  const deliveredAt = optionalTimestamp(
    row.delivered_at,
    "OPERATIONAL_EVENT_DELIVERY_SETTLED_TIMESTAMP_INVALID",
  );
  if (row.delivery_id !== operationalEventDeliveryId(row.event_key, consumer)) {
    throw new Error("OPERATIONAL_EVENT_DELIVERY_ID_MISMATCH");
  }
  if (row.input_hash !== event.event_hash || row.idempotency_key !== row.event_key) {
    throw new Error("OPERATIONAL_EVENT_DELIVERY_INPUT_IDENTITY_MISMATCH");
  }
  if (state === "leased" && (!row.owner_instance_id || !row.lease_token || !leaseExpiresAt)) {
    throw new Error("OPERATIONAL_EVENT_DELIVERY_LEASE_INVARIANT_BROKEN");
  }
  if (state !== "leased" && (row.lease_token || leaseExpiresAt)) {
    throw new Error("OPERATIONAL_EVENT_DELIVERY_LEASE_INVARIANT_BROKEN");
  }
  if (["delivered", "skipped"].includes(state) !== Boolean(deliveredAt)) {
    throw new Error("OPERATIONAL_EVENT_DELIVERY_SETTLEMENT_INVARIANT_BROKEN");
  }
  if (state === "quarantined" && !row.diagnostic?.trim()) {
    throw new Error("OPERATIONAL_EVENT_DELIVERY_QUARANTINE_INVARIANT_BROKEN");
  }
  return Object.freeze({
    eventKey: row.event_key,
    consumer,
    deliveryId: row.delivery_id,
    inputHash: row.input_hash,
    idempotencyKey: row.idempotency_key,
    state,
    ...(row.owner_instance_id ? { ownerInstanceId: row.owner_instance_id } : {}),
    ...(row.lease_token ? { leaseToken: row.lease_token } : {}),
    ...(leaseExpiresAt ? { leaseExpiresAt } : {}),
    attemptCount: row.attempt_count,
    ...(deliveredAt ? { deliveredAt } : {}),
    ...(row.diagnostic ? { diagnostic: row.diagnostic } : {}),
    result: objectValue(row.result, "OPERATIONAL_EVENT_DELIVERY_RESULT_INVALID"),
    createdAt: timestamp(row.created_at, "OPERATIONAL_EVENT_DELIVERY_CREATED_TIMESTAMP_INVALID"),
    updatedAt: timestamp(row.updated_at, "OPERATIONAL_EVENT_DELIVERY_UPDATED_TIMESTAMP_INVALID"),
    event: mapCanonicalEvent(event),
  });
}

async function loadDelivery(
  sql: postgres.Sql | postgres.TransactionSql,
  eventKey: string,
  consumer: OperationalEventDeliveryConsumerV1,
): Promise<OperationalEventDelivery | undefined> {
  const deliveries = await sql.unsafe<DeliveryRow[]>(
    `SELECT * FROM operational_event_deliveries
      WHERE event_key = $1 AND consumer = $2`,
    [eventKey, consumer],
  );
  if (!deliveries[0]) return undefined;
  const events = await sql.unsafe<CanonicalEventRow[]>(
    "SELECT * FROM operational_events WHERE event_key = $1",
    [eventKey],
  );
  if (!events[0]) throw new Error("OPERATIONAL_EVENT_DELIVERY_EVENT_MISSING");
  return mapDelivery(deliveries[0], events[0]);
}

function resultObject(value: Readonly<Record<string, unknown>>): string {
  return JSON.stringify(objectValue(value, "OPERATIONAL_EVENT_DELIVERY_RESULT_INVALID"));
}

function safeDiagnostic(value: string): string {
  return requiredString(value, "OPERATIONAL_EVENT_DELIVERY_DIAGNOSTIC_INVALID").trim().slice(0, 4_000);
}

export function createOperationalEventDeliveryRepository(sql: Sql) {
  return Object.freeze({
    async find(
      eventKeyInput: string,
      consumerInput: OperationalEventDeliveryConsumerV1,
    ): Promise<OperationalEventDelivery | undefined> {
      const eventKey = requiredString(eventKeyInput, "OPERATIONAL_EVENT_KEY_INVALID");
      const consumer = OperationalEventDeliveryConsumerV1Schema.parse(consumerInput);
      return loadDelivery(sql, eventKey, consumer);
    },

    async claimNext(input: Readonly<{
      consumer: OperationalEventDeliveryConsumerV1;
      ownerInstanceId: string;
      leaseMs?: number;
      now?: Date;
    }>): Promise<OperationalEventDelivery | undefined> {
      const consumer = OperationalEventDeliveryConsumerV1Schema.parse(input.consumer);
      const ownerInstanceId = requiredString(
        input.ownerInstanceId,
        "OPERATIONAL_EVENT_DELIVERY_OWNER_INVALID",
      );
      const now = validTime(input.now);
      const leaseMs = leaseDuration(input.leaseMs);
      return sql.begin(async (transaction) => {
        // A process may die after taking its final bounded attempt. Converge that
        // expired owner to quarantine before selecting new work; never increment
        // the database-bounded attempt counter past three.
        await transaction.unsafe(
          `UPDATE operational_event_deliveries
              SET state = 'quarantined', owner_instance_id = NULL,
                  lease_token = NULL, lease_expires_at = NULL,
                  diagnostic = 'OPERATIONAL_EVENT_DELIVERY_FINAL_LEASE_EXPIRED',
                  updated_at = $2
            WHERE consumer = $1 AND state = 'leased'
              AND lease_expires_at <= $2 AND attempt_count >= 3`,
          [consumer, now],
        );
        const candidates = await transaction.unsafe<Array<{ event_key: string }>>(
          `SELECT event_key
             FROM operational_event_deliveries
            WHERE consumer = $1
              AND attempt_count < 3
              AND (state = 'pending' OR (state = 'leased' AND lease_expires_at <= $2))
            ORDER BY created_at, event_key
            LIMIT 1
            FOR UPDATE SKIP LOCKED`,
          [consumer, now],
        );
        const candidate = candidates[0];
        if (!candidate) return undefined;
        const leaseToken = `OEL_${randomUUID()}`;
        await transaction.unsafe(
          `UPDATE operational_event_deliveries
              SET state = 'leased', owner_instance_id = $3, lease_token = $4,
                  lease_expires_at = $5, attempt_count = attempt_count + 1,
                  updated_at = $2
            WHERE event_key = $1 AND consumer = $6`,
          [
            candidate.event_key,
            now,
            ownerInstanceId,
            leaseToken,
            new Date(now.getTime() + leaseMs),
            consumer,
          ],
        );
        return loadDelivery(transaction, candidate.event_key, consumer);
      }) as Promise<OperationalEventDelivery | undefined>;
    },

    async heartbeat(input: Readonly<{
      eventKey: string;
      consumer: OperationalEventDeliveryConsumerV1;
      ownerInstanceId: string;
      leaseToken: string;
      leaseMs?: number;
      now?: Date;
    }>): Promise<boolean> {
      const now = validTime(input.now);
      const rows = await sql.unsafe<Array<{ event_key: string }>>(
        `UPDATE operational_event_deliveries
            SET lease_expires_at = $6, updated_at = $5
          WHERE event_key = $1 AND consumer = $2 AND state = 'leased'
            AND owner_instance_id = $3 AND lease_token = $4
            AND lease_expires_at > $5
          RETURNING event_key`,
        [
          requiredString(input.eventKey, "OPERATIONAL_EVENT_KEY_INVALID"),
          OperationalEventDeliveryConsumerV1Schema.parse(input.consumer),
          requiredString(input.ownerInstanceId, "OPERATIONAL_EVENT_DELIVERY_OWNER_INVALID"),
          requiredString(input.leaseToken, "OPERATIONAL_EVENT_DELIVERY_LEASE_TOKEN_INVALID"),
          now,
          new Date(now.getTime() + leaseDuration(input.leaseMs)),
        ],
      );
      return rows.length === 1;
    },

    async settle(input: Readonly<{
      eventKey: string;
      consumer: OperationalEventDeliveryConsumerV1;
      ownerInstanceId: string;
      leaseToken: string;
      outcome: "delivered" | "skipped";
      result: Readonly<Record<string, unknown>>;
      now?: Date;
    }>): Promise<OperationalEventDelivery> {
      const now = validTime(input.now);
      const eventKey = requiredString(input.eventKey, "OPERATIONAL_EVENT_KEY_INVALID");
      const consumer = OperationalEventDeliveryConsumerV1Schema.parse(input.consumer);
      const rows = await sql.unsafe<Array<{ event_key: string }>>(
        `UPDATE operational_event_deliveries
            SET state = $5, owner_instance_id = NULL, lease_token = NULL,
                lease_expires_at = NULL, delivered_at = $6, diagnostic = NULL,
                result = $7::text::jsonb, updated_at = $6
          WHERE event_key = $1 AND consumer = $2 AND state = 'leased'
            AND owner_instance_id = $3 AND lease_token = $4
            AND lease_expires_at > $6
          RETURNING event_key`,
        [
          eventKey,
          consumer,
          requiredString(input.ownerInstanceId, "OPERATIONAL_EVENT_DELIVERY_OWNER_INVALID"),
          requiredString(input.leaseToken, "OPERATIONAL_EVENT_DELIVERY_LEASE_TOKEN_INVALID"),
          input.outcome,
          now,
          resultObject(input.result),
        ],
      );
      if (!rows[0]) throw new Error("OPERATIONAL_EVENT_DELIVERY_SETTLE_FENCE_LOST");
      return (await loadDelivery(sql, eventKey, consumer))!;
    },

    async releaseForRetry(input: Readonly<{
      eventKey: string;
      consumer: OperationalEventDeliveryConsumerV1;
      ownerInstanceId: string;
      leaseToken: string;
      diagnostic: string;
      now?: Date;
    }>): Promise<OperationalEventDelivery> {
      const now = validTime(input.now);
      const eventKey = requiredString(input.eventKey, "OPERATIONAL_EVENT_KEY_INVALID");
      const consumer = OperationalEventDeliveryConsumerV1Schema.parse(input.consumer);
      const rows = await sql.unsafe<Array<{ event_key: string }>>(
        `UPDATE operational_event_deliveries
            SET state = 'pending', owner_instance_id = NULL, lease_token = NULL,
                lease_expires_at = NULL, diagnostic = $5, updated_at = $6
          WHERE event_key = $1 AND consumer = $2 AND state = 'leased'
            AND owner_instance_id = $3 AND lease_token = $4
            AND lease_expires_at > $6
          RETURNING event_key`,
        [
          eventKey,
          consumer,
          requiredString(input.ownerInstanceId, "OPERATIONAL_EVENT_DELIVERY_OWNER_INVALID"),
          requiredString(input.leaseToken, "OPERATIONAL_EVENT_DELIVERY_LEASE_TOKEN_INVALID"),
          safeDiagnostic(input.diagnostic),
          now,
        ],
      );
      if (!rows[0]) throw new Error("OPERATIONAL_EVENT_DELIVERY_RETRY_FENCE_LOST");
      return (await loadDelivery(sql, eventKey, consumer))!;
    },

    async quarantine(input: Readonly<{
      eventKey: string;
      consumer: OperationalEventDeliveryConsumerV1;
      ownerInstanceId: string;
      leaseToken: string;
      maxAttempts: number;
      diagnostic: string;
      now?: Date;
    }>): Promise<OperationalEventDelivery> {
      if (!Number.isInteger(input.maxAttempts) || input.maxAttempts < 1 || input.maxAttempts > 3) {
        throw new Error("OPERATIONAL_EVENT_DELIVERY_ATTEMPT_LIMIT_INVALID");
      }
      const now = validTime(input.now);
      const eventKey = requiredString(input.eventKey, "OPERATIONAL_EVENT_KEY_INVALID");
      const consumer = OperationalEventDeliveryConsumerV1Schema.parse(input.consumer);
      const rows = await sql.unsafe<Array<{ event_key: string }>>(
        `UPDATE operational_event_deliveries
            SET state = 'quarantined', owner_instance_id = NULL, lease_token = NULL,
                lease_expires_at = NULL, diagnostic = $6, updated_at = $7
          WHERE event_key = $1 AND consumer = $2 AND state = 'leased'
            AND owner_instance_id = $3 AND lease_token = $4
            AND lease_expires_at > $7 AND attempt_count >= $5
          RETURNING event_key`,
        [
          eventKey,
          consumer,
          requiredString(input.ownerInstanceId, "OPERATIONAL_EVENT_DELIVERY_OWNER_INVALID"),
          requiredString(input.leaseToken, "OPERATIONAL_EVENT_DELIVERY_LEASE_TOKEN_INVALID"),
          input.maxAttempts,
          safeDiagnostic(input.diagnostic),
          now,
        ],
      );
      if (!rows[0]) throw new Error("OPERATIONAL_EVENT_DELIVERY_QUARANTINE_FENCE_LOST");
      return (await loadDelivery(sql, eventKey, consumer))!;
    },
  });
}
