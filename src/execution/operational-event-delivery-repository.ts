import { randomUUID } from "node:crypto";

import type postgres from "postgres";
import { z } from "zod";

import { readDatabaseWallClock } from "../db/database-wall-clock.js";
import {
  beginOrAdoptInternalProductionOwnerReservationV1,
  closeInternalProductionOwnerReservationV1,
  resolveInternalProductionOperationalDeliveryTerminalAuthorityPairInTransactionV1,
  type PgTransactionSql,
} from "../db-pg.js";
import { createInternalProductionOperationalDeliveryCanonicalOwnerIdentityV1 } from "../internal-production/owner-admission-v1.js";
import { canonicalJsonStringify } from "../product-compiler/canonical-json.js";
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

async function lockExactDeliveryWithEventInTransactionV1(
  transaction: postgres.TransactionSql,
  eventKey: string,
  consumer: OperationalEventDeliveryConsumerV1,
): Promise<Readonly<{
  delivery: DeliveryRow;
  event: CanonicalEventRow;
  mapped: OperationalEventDelivery;
}>> {
  createInternalProductionOperationalDeliveryCanonicalOwnerIdentityV1({ eventKey, consumer });
  const events = await transaction.unsafe<CanonicalEventRow[]>(
    "SELECT * FROM operational_events WHERE event_key=$1 FOR UPDATE",
    [eventKey],
  );
  const deliveries = await transaction.unsafe<DeliveryRow[]>(
    `SELECT * FROM operational_event_deliveries
      WHERE event_key=$1 AND consumer=$2 FOR UPDATE`,
    [eventKey, consumer],
  );
  if (events.length !== 1 || !events[0] || deliveries.length !== 1 || !deliveries[0]) {
    throw new Error("OPERATIONAL_EVENT_DELIVERY_IDENTITY_UNAVAILABLE");
  }
  return Object.freeze({
    delivery: deliveries[0],
    event: events[0],
    mapped: mapDelivery(deliveries[0], events[0]),
  });
}

async function closeOperationalDeliveryInTransactionV1(
  transaction: postgres.TransactionSql,
  eventKey: string,
  consumer: OperationalEventDeliveryConsumerV1,
): Promise<void> {
  const closeInput = await resolveInternalProductionOperationalDeliveryTerminalAuthorityPairInTransactionV1(
    transaction as PgTransactionSql,
    { eventKey, consumer },
  );
  await closeInternalProductionOwnerReservationV1(
    transaction as PgTransactionSql,
    closeInput,
  );
}

async function authenticateBoundOperationalDeliveryOwnerInTransactionV1(
  transaction: postgres.TransactionSql,
  eventKey: string,
  consumer: OperationalEventDeliveryConsumerV1,
): Promise<void> {
  const identity = createInternalProductionOperationalDeliveryCanonicalOwnerIdentityV1({
    eventKey,
    consumer,
  });
  const owners = await transaction.unsafe<Array<{
    reservation_ref: string;
    reservation_hash: string;
    producer_implementation_id: string;
    state: string;
    canonical_owner_identity: unknown;
  }>>(
    `SELECT reservation_ref,reservation_hash,producer_implementation_id,
            state,canonical_owner_identity
       FROM internal_production_owner_reservations_v1
      WHERE category='operational-delivery' AND owner_key=$1
      FOR UPDATE`,
    [identity.ownerKey],
  );
  const owner = owners[0];
  if (
    owners.length !== 1
    || !owner
    || owner.producer_implementation_id !== "a-operational-delivery-v1"
    || owner.state !== "bound"
    || canonicalJsonStringify(owner.canonical_owner_identity)
      !== canonicalJsonStringify(identity)
  ) throw new Error("OPERATIONAL_EVENT_DELIVERY_BOUND_OWNER_INVALID");
  try {
    const reservation = await beginOrAdoptInternalProductionOwnerReservationV1(
      transaction as PgTransactionSql,
      {
        producerImplementationId: "a-operational-delivery-v1",
        ownerKey: identity.ownerKey,
      },
    );
    if (
      reservation.reservationRef !== owner.reservation_ref
      || reservation.reservationHash !== owner.reservation_hash
      || reservation.producerImplementationId !== owner.producer_implementation_id
      || reservation.ownerKey !== identity.ownerKey
      || reservation.category !== "operational-delivery"
    ) throw new Error();
  } catch {
    throw new Error("OPERATIONAL_EVENT_DELIVERY_BOUND_OWNER_INVALID");
  }
}

async function authenticateClosedOperationalDeliveryOwnerInTransactionV1(
  transaction: postgres.TransactionSql,
  eventKey: string,
  consumer: OperationalEventDeliveryConsumerV1,
): Promise<void> {
  const identity = createInternalProductionOperationalDeliveryCanonicalOwnerIdentityV1({
    eventKey,
    consumer,
  });
  const owners = await transaction.unsafe<Array<{ producer_implementation_id: string; state: string }>>(
    `SELECT producer_implementation_id,state
       FROM internal_production_owner_reservations_v1
      WHERE category='operational-delivery' AND owner_key=$1
      FOR UPDATE`,
    [identity.ownerKey],
  );
  if (
    owners.length !== 1
    || owners[0]?.producer_implementation_id !== "a-operational-delivery-v1"
    || owners[0]?.state !== "closed"
  ) throw new Error("OPERATIONAL_EVENT_DELIVERY_TERMINAL_OWNER_INVALID");
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
      validTime(input.now);
      const leaseMs = leaseDuration(input.leaseMs);
      return sql.begin(async (transaction) => {
        const expiredEvents = await transaction.unsafe<CanonicalEventRow[]>(
          `SELECT event.*
             FROM operational_events event
            WHERE EXISTS (
              SELECT 1 FROM operational_event_deliveries delivery
               WHERE delivery.event_key=event.event_key
                 AND delivery.consumer=$1
                 AND delivery.state='leased'
                 AND delivery.lease_expires_at<=clock_timestamp()
                 AND delivery.attempt_count>=3
            )
            ORDER BY event.event_key
            FOR UPDATE OF event SKIP LOCKED`,
          [consumer],
        );
        const eventByKey = new Map(expiredEvents.map((event) => [event.event_key, event]));
        const expired = expiredEvents.length === 0
          ? []
          : await transaction.unsafe<DeliveryRow[]>(
              `SELECT * FROM operational_event_deliveries
                WHERE event_key=ANY($1::text[]) AND consumer=$2
                  AND state='leased' AND lease_expires_at<=clock_timestamp()
                  AND attempt_count>=3
                ORDER BY event_key
                FOR UPDATE SKIP LOCKED`,
              [expiredEvents.map((event) => event.event_key), consumer],
            );
        const now = await readDatabaseWallClock(
          transaction,
          "OPERATIONAL_EVENT_DELIVERY_DATABASE_TIME_UNAVAILABLE",
        );
        for (const delivery of expired) {
          const event = eventByKey.get(delivery.event_key);
          if (!event) throw new Error("OPERATIONAL_EVENT_DELIVERY_EXPIRY_EVENT_MISSING");
          mapDelivery(delivery, event);
          await authenticateBoundOperationalDeliveryOwnerInTransactionV1(
            transaction,
            delivery.event_key,
            consumer,
          );
          const terminalRows = await transaction.unsafe<DeliveryRow[]>(
            `UPDATE operational_event_deliveries
                SET state='quarantined',owner_instance_id=NULL,lease_token=NULL,
                    lease_expires_at=NULL,
                    diagnostic='OPERATIONAL_EVENT_DELIVERY_FINAL_LEASE_EXPIRED',
                    updated_at=$3
              WHERE event_key=$1 AND consumer=$2 AND state='leased'
                AND lease_expires_at<=$3 AND attempt_count>=3
              RETURNING *`,
            [delivery.event_key, consumer, now],
          );
          if (terminalRows.length !== 1 || !terminalRows[0]) {
            throw new Error("OPERATIONAL_EVENT_DELIVERY_EXPIRY_CAS_LOST");
          }
          mapDelivery(terminalRows[0], event);
          await closeOperationalDeliveryInTransactionV1(transaction, delivery.event_key, consumer);
        }
        const candidateKeys = await transaction.unsafe<Array<{ event_key: string }>>(
          `SELECT event_key FROM operational_event_deliveries
            WHERE consumer=$1 AND attempt_count<3
              AND (state='pending' OR (state='leased' AND lease_expires_at<=clock_timestamp()))
            ORDER BY created_at,event_key LIMIT 1`,
          [consumer],
        );
        const candidateKey = candidateKeys[0]?.event_key;
        if (!candidateKey) return undefined;
        const locked = await lockExactDeliveryWithEventInTransactionV1(
          transaction,
          candidateKey,
          consumer,
        );
        const candidate = locked.delivery;
        await authenticateBoundOperationalDeliveryOwnerInTransactionV1(
          transaction,
          candidate.event_key,
          consumer,
        );
        if (
          candidate.attempt_count >= 3
          || !["pending", "leased"].includes(candidate.state)
          || (candidate.state === "leased" && (
            !candidate.lease_expires_at
            || new Date(candidate.lease_expires_at).getTime() > now.getTime()
          ))
        ) return undefined;
        const leaseToken = `OEL_${randomUUID()}`;
        const rows = await transaction.unsafe<DeliveryRow[]>(
          `UPDATE operational_event_deliveries
              SET state = 'leased', owner_instance_id = $3, lease_token = $4,
                  lease_expires_at = $5, attempt_count = attempt_count + 1,
                  updated_at = $2
            WHERE event_key = $1 AND consumer = $6
              AND attempt_count < 3
              AND (state = 'pending'
                OR (state = 'leased' AND lease_expires_at <= $2))
            RETURNING *`,
          [
            candidate.event_key,
            now,
            ownerInstanceId,
            leaseToken,
            new Date(now.getTime() + leaseMs),
            consumer,
          ],
        );
        if (rows.length !== 1 || !rows[0]) throw new Error("OPERATIONAL_EVENT_DELIVERY_CLAIM_CAS_LOST");
        return mapDelivery(rows[0], locked.event);
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
      validTime(input.now);
      const eventKey = requiredString(input.eventKey, "OPERATIONAL_EVENT_KEY_INVALID");
      const consumer = OperationalEventDeliveryConsumerV1Schema.parse(input.consumer);
      const ownerInstanceId = requiredString(
        input.ownerInstanceId,
        "OPERATIONAL_EVENT_DELIVERY_OWNER_INVALID",
      );
      const leaseToken = requiredString(
        input.leaseToken,
        "OPERATIONAL_EVENT_DELIVERY_LEASE_TOKEN_INVALID",
      );
      const leaseMs = leaseDuration(input.leaseMs);
      return sql.begin(async (transaction) => {
        const locked = await lockExactDeliveryWithEventInTransactionV1(transaction, eventKey, consumer);
        const current = locked.delivery;
        await authenticateBoundOperationalDeliveryOwnerInTransactionV1(
          transaction,
          eventKey,
          consumer,
        );
        const now = await readDatabaseWallClock(
          transaction,
          "OPERATIONAL_EVENT_DELIVERY_DATABASE_TIME_UNAVAILABLE",
        );
        if (
          !current
          || current.state !== "leased"
          || current.owner_instance_id !== ownerInstanceId
          || current.lease_token !== leaseToken
          || !current.lease_expires_at
          || new Date(current.lease_expires_at).getTime() <= now.getTime()
        ) return false;
        const rows = await transaction.unsafe<Array<{ event_key: string }>>(
          `UPDATE operational_event_deliveries
              SET lease_expires_at = $5, updated_at = $6
            WHERE event_key = $1 AND consumer = $2 AND state = 'leased'
              AND owner_instance_id = $3 AND lease_token = $4
              AND lease_expires_at > $6
            RETURNING event_key`,
          [
            eventKey,
            consumer,
            ownerInstanceId,
            leaseToken,
            new Date(now.getTime() + leaseMs),
            now,
          ],
        );
        return rows.length === 1;
      }) as Promise<boolean>;
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
      validTime(input.now);
      const eventKey = requiredString(input.eventKey, "OPERATIONAL_EVENT_KEY_INVALID");
      const consumer = OperationalEventDeliveryConsumerV1Schema.parse(input.consumer);
      const ownerInstanceId = requiredString(
        input.ownerInstanceId,
        "OPERATIONAL_EVENT_DELIVERY_OWNER_INVALID",
      );
      const leaseToken = requiredString(
        input.leaseToken,
        "OPERATIONAL_EVENT_DELIVERY_LEASE_TOKEN_INVALID",
      );
      const result = resultObject(input.result);
      return sql.begin(async (transaction) => {
        const locked = await lockExactDeliveryWithEventInTransactionV1(transaction, eventKey, consumer);
        const current = locked.delivery;
        if (["delivered", "skipped", "quarantined"].includes(current.state)) {
          if (
            current.state !== input.outcome
            || current.owner_instance_id !== null
            || current.lease_token !== null
            || current.lease_expires_at !== null
            || current.delivered_at === null
            || current.diagnostic !== null
            || canonicalJsonStringify(objectValue(current.result, "OPERATIONAL_EVENT_DELIVERY_RESULT_INVALID"))
              !== canonicalJsonStringify(objectValue(result, "OPERATIONAL_EVENT_DELIVERY_RESULT_INVALID"))
          ) throw new Error("OPERATIONAL_EVENT_DELIVERY_SETTLE_FENCE_LOST");
          await authenticateClosedOperationalDeliveryOwnerInTransactionV1(transaction, eventKey, consumer);
          await closeOperationalDeliveryInTransactionV1(transaction, eventKey, consumer);
          return locked.mapped;
        }
        await authenticateBoundOperationalDeliveryOwnerInTransactionV1(
          transaction,
          eventKey,
          consumer,
        );
        const now = await readDatabaseWallClock(
          transaction,
          "OPERATIONAL_EVENT_DELIVERY_DATABASE_TIME_UNAVAILABLE",
        );
        if (
          current.state !== "leased"
          || current.owner_instance_id !== ownerInstanceId
          || current.lease_token !== leaseToken
          || !current.lease_expires_at
          || new Date(current.lease_expires_at).getTime() <= now.getTime()
        ) throw new Error("OPERATIONAL_EVENT_DELIVERY_SETTLE_FENCE_LOST");
        const rows = await transaction.unsafe<DeliveryRow[]>(
          `UPDATE operational_event_deliveries
              SET state = $5, owner_instance_id = NULL, lease_token = NULL,
                  lease_expires_at = NULL, delivered_at = $6, diagnostic = NULL,
                  result = $7::text::jsonb, updated_at = $6
            WHERE event_key = $1 AND consumer = $2 AND state = 'leased'
              AND owner_instance_id = $3 AND lease_token = $4
              AND lease_expires_at > $6
            RETURNING *`,
          [eventKey, consumer, ownerInstanceId, leaseToken, input.outcome, now, result],
        );
        if (rows.length !== 1 || !rows[0]) throw new Error("OPERATIONAL_EVENT_DELIVERY_SETTLE_FENCE_LOST");
        const mapped = mapDelivery(rows[0], locked.event);
        await closeOperationalDeliveryInTransactionV1(transaction, eventKey, consumer);
        return mapped;
      }) as Promise<OperationalEventDelivery>;
    },

    async releaseForRetry(input: Readonly<{
      eventKey: string;
      consumer: OperationalEventDeliveryConsumerV1;
      ownerInstanceId: string;
      leaseToken: string;
      diagnostic: string;
      now?: Date;
    }>): Promise<OperationalEventDelivery> {
      validTime(input.now);
      const eventKey = requiredString(input.eventKey, "OPERATIONAL_EVENT_KEY_INVALID");
      const consumer = OperationalEventDeliveryConsumerV1Schema.parse(input.consumer);
      const ownerInstanceId = requiredString(
        input.ownerInstanceId,
        "OPERATIONAL_EVENT_DELIVERY_OWNER_INVALID",
      );
      const leaseToken = requiredString(
        input.leaseToken,
        "OPERATIONAL_EVENT_DELIVERY_LEASE_TOKEN_INVALID",
      );
      const diagnostic = safeDiagnostic(input.diagnostic);
      return sql.begin(async (transaction) => {
        const locked = await lockExactDeliveryWithEventInTransactionV1(transaction, eventKey, consumer);
        const current = locked.delivery;
        await authenticateBoundOperationalDeliveryOwnerInTransactionV1(
          transaction,
          eventKey,
          consumer,
        );
        const now = await readDatabaseWallClock(
          transaction,
          "OPERATIONAL_EVENT_DELIVERY_DATABASE_TIME_UNAVAILABLE",
        );
        if (
          current.state !== "leased"
          || current.owner_instance_id !== ownerInstanceId
          || current.lease_token !== leaseToken
          || !current.lease_expires_at
          || new Date(current.lease_expires_at).getTime() <= now.getTime()
        ) throw new Error("OPERATIONAL_EVENT_DELIVERY_RETRY_FENCE_LOST");
        const rows = await transaction.unsafe<DeliveryRow[]>(
          `UPDATE operational_event_deliveries
              SET state = 'pending', owner_instance_id = NULL, lease_token = NULL,
                  lease_expires_at = NULL, diagnostic = $5, updated_at = $6
            WHERE event_key = $1 AND consumer = $2 AND state = 'leased'
              AND owner_instance_id = $3 AND lease_token = $4
              AND lease_expires_at > $6
            RETURNING *`,
          [eventKey, consumer, ownerInstanceId, leaseToken, diagnostic, now],
        );
        if (rows.length !== 1 || !rows[0]) throw new Error("OPERATIONAL_EVENT_DELIVERY_RETRY_FENCE_LOST");
        return mapDelivery(rows[0], locked.event);
      }) as Promise<OperationalEventDelivery>;
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
      validTime(input.now);
      const eventKey = requiredString(input.eventKey, "OPERATIONAL_EVENT_KEY_INVALID");
      const consumer = OperationalEventDeliveryConsumerV1Schema.parse(input.consumer);
      const ownerInstanceId = requiredString(
        input.ownerInstanceId,
        "OPERATIONAL_EVENT_DELIVERY_OWNER_INVALID",
      );
      const leaseToken = requiredString(
        input.leaseToken,
        "OPERATIONAL_EVENT_DELIVERY_LEASE_TOKEN_INVALID",
      );
      const diagnostic = safeDiagnostic(input.diagnostic);
      return sql.begin(async (transaction) => {
        const locked = await lockExactDeliveryWithEventInTransactionV1(transaction, eventKey, consumer);
        const current = locked.delivery;
        if (["delivered", "skipped", "quarantined"].includes(current.state)) {
          if (
            current.state !== "quarantined"
            || current.owner_instance_id !== null
            || current.lease_token !== null
            || current.lease_expires_at !== null
            || current.delivered_at !== null
            || current.diagnostic !== diagnostic
            || current.attempt_count < input.maxAttempts
          ) throw new Error("OPERATIONAL_EVENT_DELIVERY_QUARANTINE_FENCE_LOST");
          await authenticateClosedOperationalDeliveryOwnerInTransactionV1(transaction, eventKey, consumer);
          await closeOperationalDeliveryInTransactionV1(transaction, eventKey, consumer);
          return locked.mapped;
        }
        await authenticateBoundOperationalDeliveryOwnerInTransactionV1(
          transaction,
          eventKey,
          consumer,
        );
        const now = await readDatabaseWallClock(
          transaction,
          "OPERATIONAL_EVENT_DELIVERY_DATABASE_TIME_UNAVAILABLE",
        );
        if (
          current.state !== "leased"
          || current.owner_instance_id !== ownerInstanceId
          || current.lease_token !== leaseToken
          || !current.lease_expires_at
          || new Date(current.lease_expires_at).getTime() <= now.getTime()
          || current.attempt_count < input.maxAttempts
        ) throw new Error("OPERATIONAL_EVENT_DELIVERY_QUARANTINE_FENCE_LOST");
        const rows = await transaction.unsafe<DeliveryRow[]>(
          `UPDATE operational_event_deliveries
              SET state = 'quarantined', owner_instance_id = NULL, lease_token = NULL,
                  lease_expires_at = NULL, diagnostic = $6, updated_at = $7
            WHERE event_key = $1 AND consumer = $2 AND state = 'leased'
              AND owner_instance_id = $3 AND lease_token = $4
              AND lease_expires_at > $7 AND attempt_count >= $5
            RETURNING *`,
          [
            eventKey,
            consumer,
            ownerInstanceId,
            leaseToken,
            input.maxAttempts,
            diagnostic,
            now,
          ],
        );
        if (rows.length !== 1 || !rows[0]) throw new Error("OPERATIONAL_EVENT_DELIVERY_QUARANTINE_FENCE_LOST");
        const mapped = mapDelivery(rows[0], locked.event);
        await closeOperationalDeliveryInTransactionV1(transaction, eventKey, consumer);
        return mapped;
      }) as Promise<OperationalEventDelivery>;
    },
  });
}
