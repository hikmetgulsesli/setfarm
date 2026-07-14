import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  createOperationalOutboxPublisher,
} from "../../src/execution/operational-outbox-publisher.js";
import { createOperationalEventDeliveryRepository } from "../../src/execution/operational-event-delivery-repository.js";
import { createOperationalOutboxRepository } from "../../src/execution/operational-outbox-repository.js";
import { createIsolatedTestDatabase } from "./test-database.js";

const START = new Date("2026-07-13T12:00:00.000Z");

function clock() {
  let offset = 0;
  return () => new Date(START.getTime() + offset++);
}

function eventInput(eventKey: string, schema = "setfarm.operational-outbox-event.v1") {
  return {
    eventKey,
    eventType: "run.lifecycle_changed",
    aggregateType: "run",
    aggregateId: `run-${eventKey}`,
    payload: { schema, status: "running", sequence: 1 },
    now: START,
  } as const;
}

describe("operational outbox publisher", () => {
  it("atomically publishes one immutable canonical event and both delivery owners", async () => {
    const database = await createIsolatedTestDatabase();
    try {
      const repository = createOperationalOutboxRepository(database.sql);
      await repository.enqueue(eventInput("normal"));
      const publisher = createOperationalOutboxPublisher({
        repository,
        ownerInstanceId: "publisher-normal",
        now: clock(),
      });

      const result = await publisher.drain({ maxEvents: 10 });

      assert.deepEqual(result, {
        claimed: 1,
        published: 1,
        retriesScheduled: 0,
        quarantined: 0,
        drained: true,
      });
      const stored = await repository.findByEventKey("normal");
      assert.equal(stored?.state, "published");
      assert.equal(stored?.attemptCount, 1);
      const canonical = await repository.findCanonicalByEventKey("normal");
      assert.equal(canonical?.eventKey, "normal");
      assert.equal(canonical?.runId, "run-normal");
      assert.equal(canonical?.eventHash.length, 64);
      const deliveries = createOperationalEventDeliveryRepository(database.sql);
      assert.equal((await deliveries.find("normal", "jsonl"))?.state, "pending");
      assert.equal((await deliveries.find("normal", "webhook"))?.state, "pending");
    } finally {
      await database.cleanup();
    }
  });

  it("replays after a crash immediately after DB commit without duplicating canonical effects", async () => {
    const database = await createIsolatedTestDatabase();
    try {
      const repository = createOperationalOutboxRepository(database.sql);
      await repository.enqueue(eventInput("crash-after-canonical-commit"));
      const crashAfterCommitRepository = {
        ...repository,
        async publish(input: Parameters<typeof repository.publish>[0]) {
          await repository.publish(input);
          throw new Error("FAULT_AFTER_CANONICAL_COMMIT_BEFORE_PUBLISHER_ACK");
        },
      };
      const first = createOperationalOutboxPublisher({
        repository: crashAfterCommitRepository,
        ownerInstanceId: "publisher-crashing",
        now: clock(),
      });
      await assert.rejects(
        first.publishNext(),
        /FAULT_AFTER_CANONICAL_COMMIT_BEFORE_PUBLISHER_ACK/,
      );
      const replay = createOperationalOutboxPublisher({
        repository,
        ownerInstanceId: "publisher-replay",
        now: clock(),
      });
      assert.deepEqual(await replay.drain({ maxEvents: 10 }), {
        claimed: 0,
        published: 0,
        retriesScheduled: 0,
        quarantined: 0,
        drained: true,
      });
      const stored = await repository.findByEventKey("crash-after-canonical-commit");
      assert.equal(stored?.state, "published");
      assert.equal(stored?.attemptCount, 1);
      const counts = await database.sql<Array<{
        canonical_count: number;
        delivery_count: number;
        webhook_count: number;
      }>>`
        SELECT
          (SELECT COUNT(*)::integer FROM operational_events
            WHERE event_key = 'crash-after-canonical-commit') AS canonical_count,
          (SELECT COUNT(*)::integer FROM operational_event_deliveries
            WHERE event_key = 'crash-after-canonical-commit') AS delivery_count,
          (SELECT COUNT(*)::integer FROM operational_event_deliveries
            WHERE event_key = 'crash-after-canonical-commit' AND consumer = 'webhook') AS webhook_count
      `;
      assert.deepEqual({ ...counts[0] }, {
        canonical_count: 1,
        delivery_count: 2,
        webhook_count: 1,
      });
    } finally {
      await database.cleanup();
    }
  });

  it("quarantines one poison payload after exactly three bounded attempts", async () => {
    const database = await createIsolatedTestDatabase();
    try {
      const repository = createOperationalOutboxRepository(database.sql);
      await repository.enqueue(eventInput("poison", "setfarm.operational-outbox-event"));
      const publisher = createOperationalOutboxPublisher({
        repository,
        ownerInstanceId: "publisher-poison",
        now: clock(),
      });

      const result = await publisher.drain({ maxEvents: 10 });

      assert.deepEqual(result, {
        claimed: 3,
        published: 0,
        retriesScheduled: 2,
        quarantined: 1,
        drained: true,
      });
      const stored = await repository.findByEventKey("poison");
      assert.equal(stored?.state, "quarantined");
      assert.equal(stored?.attemptCount, 3);
      assert.equal(stored?.diagnostic, "OPERATIONAL_OUTBOX_PUBLIC_EVENT_INVALID");
      assert.equal(await repository.claimNext({
        ownerInstanceId: "publisher-after-quarantine",
        now: new Date(START.getTime() + 60_000),
      }), undefined);
    } finally {
      await database.cleanup();
    }
  });

  it("isolates concurrent canonical publisher claims and bounds each drain by maxEvents", async () => {
    const database = await createIsolatedTestDatabase();
    try {
      const repository = createOperationalOutboxRepository(database.sql);
      await repository.enqueue(eventInput("concurrent"));
      const first = createOperationalOutboxPublisher({
        repository,
        ownerInstanceId: "publisher-concurrent-a",
        now: clock(),
      });
      const second = createOperationalOutboxPublisher({
        repository,
        ownerInstanceId: "publisher-concurrent-b",
        now: clock(),
      });

      const results = await Promise.all([
        first.drain({ maxEvents: 1 }),
        second.drain({ maxEvents: 1 }),
      ]);
      assert.equal(results.reduce((sum, result) => sum + result.claimed, 0), 1);
      assert.equal(results.reduce((sum, result) => sum + result.published, 0), 1);
      assert.equal((await repository.findByEventKey("concurrent"))?.state, "published");
    } finally {
      await database.cleanup();
    }
  });
});
