import {
  createOperationalEventDeliveryRepository,
  type OperationalEventDelivery,
} from "./operational-event-delivery-repository.js";
import type { OperationalEventDeliveryConsumerV1 } from "./schemas/operational-event-v1.js";

const DELIVERY_ATTEMPT_LIMIT = 3;
const DEFAULT_LEASE_MS = 2 * 60_000;
const DEFAULT_MAX_DELIVERIES = 100;

type Repository = ReturnType<typeof createOperationalEventDeliveryRepository>;

export type OperationalEventDeliverySinkResult = Readonly<{
  outcome: "delivered" | "skipped";
  result: Readonly<Record<string, unknown>>;
}>;

export type OperationalEventDeliverySink = (
  delivery: OperationalEventDelivery,
) => OperationalEventDeliverySinkResult | Promise<OperationalEventDeliverySinkResult>;

export type OperationalEventDeliveryConsumeResult =
  | Readonly<{ status: "empty" }>
  | Readonly<{ status: "delivered" | "skipped"; eventKey: string; attemptCount: number }>
  | Readonly<{ status: "retry_scheduled" | "quarantined"; eventKey: string; attemptCount: number }>;

function requiredString(value: string, code: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(code);
  return value;
}

function validLeaseMs(value?: number): number {
  const candidate = value ?? DEFAULT_LEASE_MS;
  if (!Number.isInteger(candidate) || candidate < 1_000 || candidate > 30 * 60_000) {
    throw new Error("OPERATIONAL_EVENT_CONSUMER_LEASE_DURATION_INVALID");
  }
  return candidate;
}

function validNow(now: () => Date): Date {
  const value = new Date(now());
  if (!Number.isFinite(value.getTime())) throw new Error("OPERATIONAL_EVENT_CONSUMER_TIME_INVALID");
  return value;
}

function leaseIdentity(delivery: OperationalEventDelivery) {
  if (delivery.state !== "leased" || !delivery.ownerInstanceId || !delivery.leaseToken) {
    throw new Error("OPERATIONAL_EVENT_CONSUMER_LEASE_IDENTITY_MISSING");
  }
  return {
    eventKey: delivery.eventKey,
    consumer: delivery.consumer,
    ownerInstanceId: delivery.ownerInstanceId,
    leaseToken: delivery.leaseToken,
  } as const;
}

export function createOperationalEventDeliveryConsumer(options: Readonly<{
  repository: Repository;
  consumer: OperationalEventDeliveryConsumerV1;
  ownerInstanceId: string;
  sink: OperationalEventDeliverySink;
  leaseMs?: number;
  now?: () => Date;
}>) {
  const repository = options.repository;
  const consumer = options.consumer;
  const ownerInstanceId = requiredString(
    options.ownerInstanceId,
    "OPERATIONAL_EVENT_CONSUMER_OWNER_INVALID",
  );
  if (typeof options.sink !== "function") throw new Error("OPERATIONAL_EVENT_CONSUMER_SINK_INVALID");
  const leaseMs = validLeaseMs(options.leaseMs);
  const now = options.now ?? (() => new Date());

  async function retain(delivery: OperationalEventDelivery): Promise<void> {
    if (!await repository.heartbeat({
      ...leaseIdentity(delivery),
      leaseMs,
      now: validNow(now),
    })) throw new Error("OPERATIONAL_EVENT_CONSUMER_LEASE_FENCE_LOST");
  }

  async function consumeNext(): Promise<OperationalEventDeliveryConsumeResult> {
    const delivery = await repository.claimNext({
      consumer,
      ownerInstanceId,
      leaseMs,
      now: validNow(now),
    });
    if (!delivery) return Object.freeze({ status: "empty" });
    await retain(delivery);
    try {
      const sinkResult = await options.sink(delivery);
      await retain(delivery);
      await repository.settle({
        ...leaseIdentity(delivery),
        outcome: sinkResult.outcome,
        result: sinkResult.result,
        now: validNow(now),
      });
      return Object.freeze({
        status: sinkResult.outcome,
        eventKey: delivery.eventKey,
        attemptCount: delivery.attemptCount,
      });
    } catch {
      // Arbitrary transport errors are never persisted because they may contain
      // URL credentials or response bodies.
      await retain(delivery);
      if (delivery.attemptCount >= DELIVERY_ATTEMPT_LIMIT) {
        await repository.quarantine({
          ...leaseIdentity(delivery),
          maxAttempts: DELIVERY_ATTEMPT_LIMIT,
          diagnostic: "OPERATIONAL_EVENT_DELIVERY_SINK_FAILED",
          now: validNow(now),
        });
        return Object.freeze({
          status: "quarantined",
          eventKey: delivery.eventKey,
          attemptCount: delivery.attemptCount,
        });
      }
      await repository.releaseForRetry({
        ...leaseIdentity(delivery),
        diagnostic: "OPERATIONAL_EVENT_DELIVERY_SINK_FAILED",
        now: validNow(now),
      });
      return Object.freeze({
        status: "retry_scheduled",
        eventKey: delivery.eventKey,
        attemptCount: delivery.attemptCount,
      });
    }
  }

  async function drain(input: Readonly<{ maxDeliveries?: number }> = {}) {
    const maxDeliveries = input.maxDeliveries ?? DEFAULT_MAX_DELIVERIES;
    if (!Number.isInteger(maxDeliveries) || maxDeliveries < 1 || maxDeliveries > 1_000) {
      throw new Error("OPERATIONAL_EVENT_CONSUMER_MAX_DELIVERIES_INVALID");
    }
    let claimed = 0;
    let delivered = 0;
    let skipped = 0;
    let retriesScheduled = 0;
    let quarantined = 0;
    let drained = false;
    while (claimed < maxDeliveries) {
      const result = await consumeNext();
      if (result.status === "empty") {
        drained = true;
        break;
      }
      claimed += 1;
      if (result.status === "delivered") delivered += 1;
      else if (result.status === "skipped") skipped += 1;
      else if (result.status === "retry_scheduled") retriesScheduled += 1;
      else quarantined += 1;
    }
    return Object.freeze({ claimed, delivered, skipped, retriesScheduled, quarantined, drained });
  }

  return Object.freeze({ consumeNext, drain });
}
