import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  createOperationalOutboxRepository,
  operationalOutboxIdForEventKey,
} from "../../src/execution/operational-outbox-repository.js";
import { createIsolatedTestDatabase } from "./test-database.js";

const START = new Date("2026-07-13T12:00:00.000Z");

function eventInput(eventKey: string) {
  return {
    eventKey,
    eventType: "run.lifecycle_changed",
    aggregateType: "run",
    aggregateId: `run-${eventKey}`,
    payload: {
      schema: "setfarm.operational-outbox-event.v1",
      status: "running",
      sequence: 1,
    },
    now: START,
  } as const;
}

describe("operational outbox repository", () => {
  it("allows only one concurrent claimant through SKIP LOCKED", async () => {
    const database = await createIsolatedTestDatabase();
    try {
      const repository = createOperationalOutboxRepository(database.sql);
      const inserted = await repository.enqueue(eventInput("concurrent-claim"));
      const claims = await Promise.all([
        repository.claimNext({ ownerInstanceId: "publisher-a", leaseMs: 5_000, now: START }),
        repository.claimNext({ ownerInstanceId: "publisher-b", leaseMs: 5_000, now: START }),
      ]);
      const claimed = claims.filter((claim) => claim !== undefined);
      assert.equal(claimed.length, 1);
      assert.equal(claimed[0]?.outboxId, inserted.outboxId);
      assert.equal(claimed[0]?.state, "leased");
      assert.equal(claimed[0]?.attemptCount, 1);
      assert.equal(claims.filter((claim) => claim === undefined).length, 1);
      assert.equal(await repository.heartbeat({
        outboxId: claimed[0]!.outboxId,
        ownerInstanceId: claimed[0]!.ownerInstanceId!,
        leaseToken: claimed[0]!.leaseToken!,
        leaseMs: 10_000,
        now: new Date(START.getTime() + 1),
      }), true);
      assert.equal(
        (await repository.findByEventKey("concurrent-claim"))?.leaseExpiresAt,
        new Date(START.getTime() + 10_001).toISOString(),
      );
    } finally {
      await database.cleanup();
    }
  });

  it("adopts an expired lease with a new token and rejects the stale owner", async () => {
    const database = await createIsolatedTestDatabase();
    try {
      const repository = createOperationalOutboxRepository(database.sql);
      await repository.enqueue(eventInput("stale-adoption"));
      const first = await repository.claimNext({
        ownerInstanceId: "publisher-old",
        leaseMs: 5_000,
        now: START,
      });
      assert.ok(first?.leaseToken);
      const adoptionTime = new Date(START.getTime() + 5_001);
      const adopted = await repository.claimNext({
        ownerInstanceId: "publisher-new",
        leaseMs: 5_000,
        now: adoptionTime,
      });
      assert.equal(adopted?.outboxId, first.outboxId);
      assert.equal(adopted?.ownerInstanceId, "publisher-new");
      assert.notEqual(adopted?.leaseToken, first.leaseToken);
      assert.equal(adopted?.attemptCount, 2);
      assert.equal(await repository.heartbeat({
        outboxId: first.outboxId,
        ownerInstanceId: "publisher-old",
        leaseToken: first.leaseToken!,
        leaseMs: 5_000,
        now: adoptionTime,
      }), false);
      await assert.rejects(
        repository.publish({
          outboxId: first.outboxId,
          ownerInstanceId: "publisher-old",
          leaseToken: first.leaseToken!,
          now: adoptionTime,
        }),
        /OPERATIONAL_OUTBOX_PUBLISH_FENCE_LOST/,
      );
      const published = await repository.publish({
        outboxId: adopted.outboxId,
        ownerInstanceId: "publisher-new",
        leaseToken: adopted.leaseToken!,
        now: new Date(adoptionTime.getTime() + 1),
      });
      assert.equal(published.state, "published");
    } finally {
      await database.cleanup();
    }
  });

  it("fences retry and quarantine by exact live ownership and attempt budget", async () => {
    const database = await createIsolatedTestDatabase();
    try {
      const repository = createOperationalOutboxRepository(database.sql);
      await repository.enqueue(eventInput("bounded-quarantine"));
      const first = await repository.claimNext({
        ownerInstanceId: "publisher-a",
        leaseMs: 5_000,
        now: START,
      });
      assert.ok(first?.leaseToken);
      await assert.rejects(
        repository.releaseForRetry({
          outboxId: first.outboxId,
          ownerInstanceId: "publisher-wrong",
          leaseToken: first.leaseToken!,
          diagnostic: "transient sink failure",
          now: new Date(START.getTime() + 1),
        }),
        /OPERATIONAL_OUTBOX_RETRY_FENCE_LOST/,
      );
      await assert.rejects(
        repository.quarantine({
          outboxId: first.outboxId,
          ownerInstanceId: "publisher-a",
          leaseToken: first.leaseToken!,
          maxAttempts: 2,
          diagnostic: "not exhausted",
          now: new Date(START.getTime() + 1),
        }),
        /OPERATIONAL_OUTBOX_QUARANTINE_BUDGET_NOT_EXHAUSTED/,
      );
      const pending = await repository.releaseForRetry({
        outboxId: first.outboxId,
        ownerInstanceId: "publisher-a",
        leaseToken: first.leaseToken!,
        diagnostic: "transient sink failure",
        now: new Date(START.getTime() + 2),
      });
      assert.equal(pending.state, "pending");
      const second = await repository.claimNext({
        ownerInstanceId: "publisher-b",
        leaseMs: 5_000,
        now: new Date(START.getTime() + 3),
      });
      assert.equal(second?.attemptCount, 2);
      const quarantined = await repository.quarantine({
        outboxId: second!.outboxId,
        ownerInstanceId: "publisher-b",
        leaseToken: second!.leaseToken!,
        maxAttempts: 2,
        diagnostic: "sink contract rejected twice",
        now: new Date(START.getTime() + 4),
      });
      assert.equal(quarantined.state, "quarantined");
      assert.equal(quarantined.diagnostic, "sink contract rejected twice");
      assert.equal(await repository.claimNext({
        ownerInstanceId: "publisher-c",
        now: new Date(START.getTime() + 10_000),
      }), undefined);
    } finally {
      await database.cleanup();
    }
  });

  it("keeps one deterministic published identity for idempotent event-key replay", async () => {
    const database = await createIsolatedTestDatabase();
    try {
      const repository = createOperationalOutboxRepository(database.sql);
      const input = eventInput("idempotent-publication");
      const first = await repository.enqueue(input);
      const duplicate = await repository.enqueue({
        ...input,
        payload: {
          sequence: 1,
          status: "running",
          schema: "setfarm.operational-outbox-event.v1",
        },
        now: new Date(START.getTime() + 1),
      });
      assert.equal(first.outboxId, operationalOutboxIdForEventKey(input.eventKey));
      assert.equal(duplicate.outboxId, first.outboxId);
      assert.equal((await repository.list()).length, 1);

      const claimed = await repository.claimNext({
        ownerInstanceId: "publisher-a",
        leaseMs: 5_000,
        now: new Date(START.getTime() + 2),
      });
      const published = await repository.publish({
        outboxId: claimed!.outboxId,
        ownerInstanceId: "publisher-a",
        leaseToken: claimed!.leaseToken!,
        now: new Date(START.getTime() + 3),
      });
      const replayed = await repository.enqueue({ ...input, now: new Date(START.getTime() + 4) });
      assert.equal(replayed.outboxId, published.outboxId);
      assert.equal(replayed.eventKey, input.eventKey);
      assert.equal(replayed.state, "published");
      assert.equal((await repository.list({ state: "published" })).length, 1);
      assert.equal(await repository.claimNext({
        ownerInstanceId: "publisher-b",
        now: new Date(START.getTime() + 20_000),
      }), undefined);
      await assert.rejects(
        repository.publish({
          outboxId: claimed!.outboxId,
          ownerInstanceId: "publisher-a",
          leaseToken: claimed!.leaseToken!,
          now: new Date(START.getTime() + 4),
        }),
        /OPERATIONAL_OUTBOX_PUBLISH_FENCE_LOST/,
      );
    } finally {
      await database.cleanup();
    }
  });

  it("rejects unversioned or non-JSON payloads and event-key identity drift", async () => {
    const database = await createIsolatedTestDatabase();
    try {
      const repository = createOperationalOutboxRepository(database.sql);
      await assert.rejects(
        repository.enqueue({ ...eventInput("invalid-array"), payload: [] }),
        /OPERATIONAL_OUTBOX_PAYLOAD_INVALID/,
      );
      await assert.rejects(
        repository.enqueue({ ...eventInput("invalid-schema"), payload: { status: "running" } }),
        /OPERATIONAL_OUTBOX_PAYLOAD_SCHEMA_REQUIRED/,
      );
      await assert.rejects(
        repository.enqueue({
          ...eventInput("invalid-number"),
          payload: { schema: "setfarm.operational-outbox-event.v1", value: Number.NaN },
        }),
        /OPERATIONAL_OUTBOX_PAYLOAD_INVALID/,
      );
      const input = eventInput("identity-drift");
      await repository.enqueue(input);
      await assert.rejects(
        repository.enqueue({
          ...input,
          payload: { ...input.payload, status: "failed" },
          now: new Date(START.getTime() + 1),
        }),
        /OPERATIONAL_OUTBOX_EVENT_KEY_CONFLICT/,
      );
      assert.equal((await repository.list()).length, 1);
    } finally {
      await database.cleanup();
    }
  });
});
