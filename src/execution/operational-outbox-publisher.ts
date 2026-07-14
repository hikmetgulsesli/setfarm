import { z } from "zod";

import {
  createOperationalOutboxRepository,
  type OperationalOutboxEvent,
} from "./operational-outbox-repository.js";
import {
  OperationalEventKeyV1Schema,
  operationalEventRunId,
} from "./schemas/operational-event-v1.js";

const VersionedSchemaIdSchema = z.string().regex(
  /^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*\.v[1-9][0-9]*$/,
  "OPERATIONAL_OUTBOX_PAYLOAD_SCHEMA_VERSION_INVALID",
);

const VersionedPayloadSchema = z.object({
  schema: VersionedSchemaIdSchema,
}).passthrough();

const DELIVERY_ATTEMPT_LIMIT = 3;
const DEFAULT_LEASE_MS = 2 * 60_000;
const DEFAULT_MAX_EVENTS = 100;

type OperationalOutboxRepository = ReturnType<typeof createOperationalOutboxRepository>;

export type OperationalOutboxPublicEvent = Readonly<{
  /** Stable identity used by the canonical projection and all derived deliveries. */
  eventKey: string;
  eventType: string;
  aggregateType: string;
  aggregateId: string;
  requestId?: string;
  payload: Readonly<Record<string, unknown>>;
  createdAt: string;
}>;

export type OperationalOutboxPublishResult =
  | Readonly<{ status: "empty" }>
  | Readonly<{ status: "published"; eventKey: string; attemptCount: number }>
  | Readonly<{ status: "retry_scheduled"; eventKey: string; attemptCount: number }>
  | Readonly<{ status: "quarantined"; eventKey: string; attemptCount: number }>;

export type OperationalOutboxDrainResult = Readonly<{
  claimed: number;
  published: number;
  retriesScheduled: number;
  quarantined: number;
  drained: boolean;
}>;

export type OperationalOutboxPublisherOptions = Readonly<{
  repository: OperationalOutboxRepository;
  ownerInstanceId: string;
  leaseMs?: number;
  now?: () => Date;
}>;

function requiredString(value: string, code: string): string {
  if (typeof value !== "string" || value.trim().length === 0) throw new Error(code);
  return value;
}

function validLeaseMs(value?: number): number {
  const candidate = value ?? DEFAULT_LEASE_MS;
  if (!Number.isInteger(candidate) || candidate < 1_000 || candidate > 30 * 60_000) {
    throw new Error("OPERATIONAL_OUTBOX_PUBLISHER_LEASE_DURATION_INVALID");
  }
  return candidate;
}

function validMaxEvents(value?: number): number {
  const candidate = value ?? DEFAULT_MAX_EVENTS;
  if (!Number.isInteger(candidate) || candidate < 1 || candidate > 1_000) {
    throw new Error("OPERATIONAL_OUTBOX_PUBLISHER_MAX_EVENTS_INVALID");
  }
  return candidate;
}

function validNow(now: () => Date): Date {
  const value = new Date(now());
  if (!Number.isFinite(value.getTime())) throw new Error("OPERATIONAL_OUTBOX_PUBLISHER_TIME_INVALID");
  return value;
}

function publicEvent(event: OperationalOutboxEvent): OperationalOutboxPublicEvent {
  if (!VersionedPayloadSchema.safeParse(event.payload).success) {
    throw new Error("OPERATIONAL_OUTBOX_PUBLIC_EVENT_INVALID");
  }
  if (!OperationalEventKeyV1Schema.safeParse(event.eventKey).success) {
    throw new Error("OPERATIONAL_OUTBOX_PUBLIC_EVENT_INVALID");
  }
  operationalEventRunId({
    aggregateType: event.aggregateType,
    aggregateId: event.aggregateId,
    payload: event.payload,
  });
  return Object.freeze({
    eventKey: event.eventKey,
    eventType: event.eventType,
    aggregateType: event.aggregateType,
    aggregateId: event.aggregateId,
    ...(event.requestId ? { requestId: event.requestId } : {}),
    payload: event.payload,
    createdAt: event.createdAt,
  });
}

function leaseIdentity(event: OperationalOutboxEvent): Readonly<{
  outboxId: string;
  ownerInstanceId: string;
  leaseToken: string;
}> {
  if (!event.ownerInstanceId || !event.leaseToken || event.state !== "leased") {
    throw new Error("OPERATIONAL_OUTBOX_PUBLISHER_LEASE_IDENTITY_MISSING");
  }
  return Object.freeze({
    outboxId: event.outboxId,
    ownerInstanceId: event.ownerInstanceId,
    leaseToken: event.leaseToken,
  });
}

export function createOperationalOutboxPublisher(options: OperationalOutboxPublisherOptions) {
  const repository = options.repository;
  const ownerInstanceId = requiredString(
    options.ownerInstanceId,
    "OPERATIONAL_OUTBOX_PUBLISHER_OWNER_INSTANCE_ID_INVALID",
  );
  const leaseMs = validLeaseMs(options.leaseMs);
  const now = options.now ?? (() => new Date());

  async function assertLease(event: OperationalOutboxEvent): Promise<void> {
    const identity = leaseIdentity(event);
    const retained = await repository.heartbeat({
      ...identity,
      leaseMs,
      now: validNow(now),
    });
    if (!retained) throw new Error("OPERATIONAL_OUTBOX_PUBLISHER_LEASE_FENCE_LOST");
  }

  async function settleFailure(
    event: OperationalOutboxEvent,
    diagnostic: "OPERATIONAL_OUTBOX_PUBLIC_EVENT_INVALID",
  ): Promise<OperationalOutboxPublishResult> {
    await assertLease(event);
    const identity = leaseIdentity(event);
    if (event.attemptCount >= DELIVERY_ATTEMPT_LIMIT) {
      await repository.quarantine({
        ...identity,
        maxAttempts: DELIVERY_ATTEMPT_LIMIT,
        diagnostic,
        now: validNow(now),
      });
      return Object.freeze({
        status: "quarantined",
        eventKey: event.eventKey,
        attemptCount: event.attemptCount,
      });
    }
    await repository.releaseForRetry({
      ...identity,
      diagnostic,
      now: validNow(now),
    });
    return Object.freeze({
      status: "retry_scheduled",
      eventKey: event.eventKey,
      attemptCount: event.attemptCount,
    });
  }

  async function publishNext(): Promise<OperationalOutboxPublishResult> {
    const event = await repository.claimNext({
      ownerInstanceId,
      leaseMs,
      now: validNow(now),
    });
    if (!event) return Object.freeze({ status: "empty" });

    try {
      publicEvent(event);
    } catch {
      return settleFailure(event, "OPERATIONAL_OUTBOX_PUBLIC_EVENT_INVALID");
    }

    await assertLease(event);
    const identity = leaseIdentity(event);
    // The repository commits the canonical event, derived-delivery ownership,
    // and this outbox settlement atomically. External I/O is a separate durable
    // consumer and cannot create a sink-success/settle crash window here.
    await repository.publish({
      ...identity,
      now: validNow(now),
    });
    return Object.freeze({
      status: "published",
      eventKey: event.eventKey,
      attemptCount: event.attemptCount,
    });
  }

  async function drain(input: Readonly<{ maxEvents?: number }> = {}): Promise<OperationalOutboxDrainResult> {
    const maxEvents = validMaxEvents(input.maxEvents);
    let claimed = 0;
    let published = 0;
    let retriesScheduled = 0;
    let quarantined = 0;
    let drained = false;

    while (claimed < maxEvents) {
      const result = await publishNext();
      if (result.status === "empty") {
        drained = true;
        break;
      }
      claimed += 1;
      if (result.status === "published") published += 1;
      else if (result.status === "retry_scheduled") retriesScheduled += 1;
      else quarantined += 1;
    }

    return Object.freeze({ claimed, published, retriesScheduled, quarantined, drained });
  }

  return Object.freeze({ publishNext, drain });
}
