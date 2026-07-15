import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createOperationalEventDeliveryConsumer } from "../../src/execution/operational-event-delivery-consumer.js";
import { createOperationalEventDeliveryRepository } from "../../src/execution/operational-event-delivery-repository.js";
import { createOperationalOutboxPublisher } from "../../src/execution/operational-outbox-publisher.js";
import { createOperationalOutboxRepository } from "../../src/execution/operational-outbox-repository.js";
import { createIsolatedTestDatabase } from "./test-database.js";

const START = new Date("2026-07-13T15:00:00.000Z");

function clock() {
  let offset = 0;
  return () => new Date(START.getTime() + offset++);
}

async function publishFixture(
  outbox: ReturnType<typeof createOperationalOutboxRepository>,
  eventKey: string,
): Promise<void> {
  await outbox.enqueue({
    eventKey,
    eventType: "run.lifecycle_changed",
    aggregateType: "run",
    aggregateId: `run-${eventKey}`,
    payload: { schema: "setfarm.operational-outbox-event.v1", status: "running" },
    now: START,
  });
  const publisher = createOperationalOutboxPublisher({
    repository: outbox,
    ownerInstanceId: `publisher-${eventKey}`,
    now: clock(),
  });
  assert.equal((await publisher.publishNext()).status, "published");
}

describe("operational event delivery ownership", () => {
  it("bounds a poison webhook transport and preserves one stable idempotency key", async () => {
    const database = await createIsolatedTestDatabase();
    try {
      const outbox = createOperationalOutboxRepository(database.sql);
      await publishFixture(outbox, "webhook-poison");
      const repository = createOperationalEventDeliveryRepository(database.sql);
      const attemptedKeys: string[] = [];
      const consumer = createOperationalEventDeliveryConsumer({
        repository,
        consumer: "webhook",
        ownerInstanceId: "webhook-owner",
        now: clock(),
        sink(delivery) {
          attemptedKeys.push(delivery.idempotencyKey);
          throw new Error("remote response carrying secret text");
        },
      });

      const result = await consumer.drain({ maxDeliveries: 10 });

      assert.deepEqual(result, {
        claimed: 3,
        delivered: 0,
        skipped: 0,
        retriesScheduled: 2,
        quarantined: 1,
        drained: true,
      });
      assert.deepEqual(attemptedKeys, ["webhook-poison", "webhook-poison", "webhook-poison"]);
      const stored = await repository.find("webhook-poison", "webhook");
      assert.equal(stored?.state, "quarantined");
      assert.equal(stored?.attemptCount, 3);
      assert.equal(stored?.diagnostic, "OPERATIONAL_EVENT_DELIVERY_SINK_FAILED");
      assert.equal(JSON.stringify(stored).includes("secret text"), false);
    } finally {
      await database.cleanup();
    }
  });

  it("retries an ambiguous post-webhook/pre-receipt crash under the same single owner key", async () => {
    const database = await createIsolatedTestDatabase();
    try {
      const outbox = createOperationalOutboxRepository(database.sql);
      await publishFixture(outbox, "webhook-ambiguous-ack");
      const repository = createOperationalEventDeliveryRepository(database.sql);
      const attemptedKeys: string[] = [];
      const crashBeforeReceipt = {
        ...repository,
        async settle() {
          throw new Error("FAULT_AFTER_WEBHOOK_BEFORE_DELIVERY_RECEIPT");
        },
      };
      const first = createOperationalEventDeliveryConsumer({
        repository: crashBeforeReceipt,
        consumer: "webhook",
        ownerInstanceId: "webhook-crashing-owner",
        now: clock(),
        sink(delivery) {
          attemptedKeys.push(delivery.idempotencyKey);
          return {
            outcome: "delivered",
            result: { schema: "setfarm.test-webhook-result.v1" },
          };
        },
      });
      assert.deepEqual(await first.drain({ maxDeliveries: 1 }), {
        claimed: 1,
        delivered: 0,
        skipped: 0,
        retriesScheduled: 1,
        quarantined: 0,
        drained: false,
      });

      const replay = createOperationalEventDeliveryConsumer({
        repository,
        consumer: "webhook",
        ownerInstanceId: "webhook-replay-owner",
        now: clock(),
        sink(delivery) {
          attemptedKeys.push(delivery.idempotencyKey);
          return {
            outcome: "delivered",
            result: {
              schema: "setfarm.test-webhook-result.v1",
              idempotencyKey: delivery.idempotencyKey,
            },
          };
        },
      });
      assert.deepEqual(await replay.drain({ maxDeliveries: 10 }), {
        claimed: 1,
        delivered: 1,
        skipped: 0,
        retriesScheduled: 0,
        quarantined: 0,
        drained: true,
      });
      assert.deepEqual(attemptedKeys, ["webhook-ambiguous-ack", "webhook-ambiguous-ack"]);
      const stored = await repository.find("webhook-ambiguous-ack", "webhook");
      assert.equal(stored?.state, "delivered");
      assert.equal(stored?.attemptCount, 2);
      const counts = await database.sql<Array<{ count: number }>>`
        SELECT COUNT(*)::integer AS count
          FROM operational_event_deliveries
         WHERE event_key = 'webhook-ambiguous-ack' AND consumer = 'webhook'
      `;
      assert.equal(counts[0]?.count, 1);
    } finally {
      await database.cleanup();
    }
  });

  it("quarantines an expired final lease instead of overflowing or orphaning its retry budget", async () => {
    const database = await createIsolatedTestDatabase();
    try {
      const outbox = createOperationalOutboxRepository(database.sql);
      await publishFixture(outbox, "webhook-final-lease-crash");
      const repository = createOperationalEventDeliveryRepository(database.sql);
      for (let attempt = 1; attempt <= 3; attempt += 1) {
        const claimed = await repository.claimNext({
          consumer: "webhook",
          ownerInstanceId: `owner-${attempt}`,
          leaseMs: 1_000,
          now: new Date(START.getTime() + attempt * 10),
        });
        assert.equal(claimed?.attemptCount, attempt);
        if (attempt < 3) {
          await repository.releaseForRetry({
            eventKey: claimed!.eventKey,
            consumer: "webhook",
            ownerInstanceId: claimed!.ownerInstanceId!,
            leaseToken: claimed!.leaseToken!,
            diagnostic: "test retry",
            now: new Date(START.getTime() + attempt * 10 + 1),
          });
        }
      }

      await database.sql`
        UPDATE operational_event_deliveries
           SET lease_expires_at = clock_timestamp() - interval '1 second'
         WHERE event_key = 'webhook-final-lease-crash' AND consumer = 'webhook'
      `;
      assert.equal(await repository.claimNext({
        consumer: "webhook",
        ownerInstanceId: "owner-after-final-crash",
        leaseMs: 1_000,
        now: new Date("1900-01-01T00:00:00.000Z"),
      }), undefined);
      const stored = await repository.find("webhook-final-lease-crash", "webhook");
      assert.equal(stored?.state, "quarantined");
      assert.equal(stored?.attemptCount, 3);
      assert.equal(stored?.diagnostic, "OPERATIONAL_EVENT_DELIVERY_FINAL_LEASE_EXPIRED");
    } finally {
      await database.cleanup();
    }
  });

  it("uses database time for lease ownership and never revives an expired stale owner", async () => {
    const database = await createIsolatedTestDatabase();
    try {
      const outbox = createOperationalOutboxRepository(database.sql);
      await publishFixture(outbox, "webhook-database-clock");
      const repository = createOperationalEventDeliveryRepository(database.sql);
      const first = await repository.claimNext({
        consumer: "webhook",
        ownerInstanceId: "clock-owner-one",
        leaseMs: 60_000,
        now: new Date("2999-01-01T00:00:00.000Z"),
      });
      assert.equal(first?.attemptCount, 1);

      assert.equal(await repository.claimNext({
        consumer: "webhook",
        ownerInstanceId: "clock-owner-two",
        leaseMs: 60_000,
        now: new Date("2999-01-01T00:00:00.000Z"),
      }), undefined);
      assert.equal(await repository.heartbeat({
        eventKey: first!.eventKey,
        consumer: "webhook",
        ownerInstanceId: first!.ownerInstanceId!,
        leaseToken: first!.leaseToken!,
        leaseMs: 60_000,
        now: new Date("1900-01-01T00:00:00.000Z"),
      }), true);

      await database.sql`
        UPDATE operational_event_deliveries
           SET lease_expires_at = clock_timestamp() - interval '1 second'
         WHERE event_key = 'webhook-database-clock' AND consumer = 'webhook'
      `;
      assert.equal(await repository.heartbeat({
        eventKey: first!.eventKey,
        consumer: "webhook",
        ownerInstanceId: first!.ownerInstanceId!,
        leaseToken: first!.leaseToken!,
        leaseMs: 60_000,
        now: new Date("1900-01-01T00:00:00.000Z"),
      }), false);

      const second = await repository.claimNext({
        consumer: "webhook",
        ownerInstanceId: "clock-owner-two",
        leaseMs: 60_000,
        now: new Date("1900-01-01T00:00:00.000Z"),
      });
      assert.equal(second?.attemptCount, 2);
      assert.equal(second?.ownerInstanceId, "clock-owner-two");
      await assert.rejects(
        repository.settle({
          eventKey: first!.eventKey,
          consumer: "webhook",
          ownerInstanceId: first!.ownerInstanceId!,
          leaseToken: first!.leaseToken!,
          outcome: "delivered",
          result: { schema: "setfarm.test-webhook-result.v1" },
          now: new Date("2999-01-01T00:00:00.000Z"),
        }),
        /OPERATIONAL_EVENT_DELIVERY_SETTLE_FENCE_LOST/,
      );
    } finally {
      await database.cleanup();
    }
  });
});
