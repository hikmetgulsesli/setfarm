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
  it("serializes two delivery claimants to one exact live lease", async () => {
    const database = await createIsolatedTestDatabase();
    try {
      const outbox = createOperationalOutboxRepository(database.sql);
      await publishFixture(outbox, "webhook-concurrent-claim");
      const repository = createOperationalEventDeliveryRepository(database.sql);
      const claims = await Promise.all([
        repository.claimNext({ consumer: "webhook", ownerInstanceId: "claimant-a", leaseMs: 60_000 }),
        repository.claimNext({ consumer: "webhook", ownerInstanceId: "claimant-b", leaseMs: 60_000 }),
      ]);
      const winners = claims.filter((claim) => claim !== undefined);
      assert.equal(winners.length, 1);
      assert.equal(winners[0]?.attemptCount, 1);
      assert.ok(["claimant-a", "claimant-b"].includes(winners[0]!.ownerInstanceId!));
      assert.equal((await repository.find("webhook-concurrent-claim", "webhook"))?.state, "leased");
    } finally {
      await database.cleanup();
    }
  });

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
      const owner = await database.sql.unsafe<Array<{ state: string }>>(
        `SELECT state FROM internal_production_owner_reservations_v1
          WHERE category='operational-delivery'
            AND owner_key::jsonb->>'eventKey'=$1
            AND owner_key::jsonb->>'consumer'='webhook'`,
        [stored!.eventKey],
      );
      assert.deepEqual(owner.map((row) => row.state), ["closed"]);
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
          leaseMs: 60_000,
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
      const afterStaleSettle = await repository.find(first!.eventKey, "webhook");
      assert.equal(afterStaleSettle?.state, "leased");
      assert.equal(afterStaleSettle?.ownerInstanceId, second?.ownerInstanceId);
      assert.equal(afterStaleSettle?.leaseToken, second?.leaseToken);
      assert.deepEqual(afterStaleSettle?.result, {});
      const owner = await database.sql.unsafe<Array<{ state: string }>>(
        `SELECT state FROM internal_production_owner_reservations_v1
          WHERE category='operational-delivery'
            AND owner_key::jsonb->>'eventKey'='webhook-database-clock'
            AND owner_key::jsonb->>'consumer'='webhook'`,
      );
      assert.deepEqual(owner.map((row) => row.state), ["bound"]);
    } finally {
      await database.cleanup();
    }
  });

  it("exact-adopts terminal acknowledgement loss without lease identity or owner-head advance", async () => {
    const database = await createIsolatedTestDatabase();
    try {
      const outbox = createOperationalOutboxRepository(database.sql);
      await publishFixture(outbox, "webhook-terminal-ack-loss");
      const repository = createOperationalEventDeliveryRepository(database.sql);
      const claimed = await repository.claimNext({
        consumer: "webhook",
        ownerInstanceId: "ack-loss-owner",
        leaseMs: 60_000,
      });
      assert.ok(claimed);
      const terminalInput = {
        eventKey: claimed.eventKey,
        consumer: "webhook" as const,
        ownerInstanceId: claimed.ownerInstanceId!,
        leaseToken: claimed.leaseToken!,
        outcome: "delivered" as const,
        result: { schema: "setfarm.test-terminal-ack.v1", receipt: "stable" },
      };
      const settled = await repository.settle(terminalInput);
      const before = (await database.sql.unsafe<Array<{ head_version: string; state: string }>>(
        `SELECT head.head_version::text,owner.state
           FROM internal_production_owner_admission_head_v1 head
           JOIN internal_production_owner_reservations_v1 owner
             ON owner.category='operational-delivery'
            AND owner.owner_key::jsonb->>'eventKey'=$1
            AND owner.owner_key::jsonb->>'consumer'='webhook'`,
        [claimed.eventKey],
      ))[0]!;
      const replay = await repository.settle(terminalInput);
      const after = (await database.sql.unsafe<Array<{ head_version: string; state: string }>>(
        `SELECT head.head_version::text,owner.state
           FROM internal_production_owner_admission_head_v1 head
           JOIN internal_production_owner_reservations_v1 owner
             ON owner.category='operational-delivery'
            AND owner.owner_key::jsonb->>'eventKey'=$1
            AND owner.owner_key::jsonb->>'consumer'='webhook'`,
        [claimed.eventKey],
      ))[0]!;
      assert.equal(replay.state, "delivered");
      assert.equal(replay.updatedAt, settled.updatedAt);
      assert.deepEqual({ ...after }, { ...before, state: "closed" });
    } finally {
      await database.cleanup();
    }
  });

  it("serializes terminal settlement against release and heartbeat without a partial close", async () => {
    const database = await createIsolatedTestDatabase();
    try {
      const outbox = createOperationalOutboxRepository(database.sql);
      const repository = createOperationalEventDeliveryRepository(database.sql);
      for (const eventKey of ["delivery-release-race", "delivery-heartbeat-race"]) {
        await publishFixture(outbox, eventKey);
      }
      const releaseLease = await repository.claimNext({
        consumer: "webhook",
        ownerInstanceId: "release-race-owner",
        leaseMs: 60_000,
      });
      assert.equal(releaseLease?.eventKey, "delivery-release-race");
      const releaseRace = await Promise.allSettled([
        repository.settle({
          eventKey: releaseLease!.eventKey,
          consumer: "webhook",
          ownerInstanceId: releaseLease!.ownerInstanceId!,
          leaseToken: releaseLease!.leaseToken!,
          outcome: "delivered",
          result: { schema: "setfarm.test-release-race.v1" },
        }),
        repository.releaseForRetry({
          eventKey: releaseLease!.eventKey,
          consumer: "webhook",
          ownerInstanceId: releaseLease!.ownerInstanceId!,
          leaseToken: releaseLease!.leaseToken!,
          diagnostic: "release contender",
        }),
      ]);
      assert.equal(releaseRace.filter((result) => result.status === "fulfilled").length, 1);
      const afterRelease = await repository.find(releaseLease!.eventKey, "webhook");
      const releaseOwner = await database.sql.unsafe<Array<{ state: string }>>(
        `SELECT state FROM internal_production_owner_reservations_v1
          WHERE category='operational-delivery'
            AND owner_key::jsonb->>'eventKey'=$1
            AND owner_key::jsonb->>'consumer'='webhook'`,
        [releaseLease!.eventKey],
      );
      assert.ok(afterRelease?.state === "pending" || afterRelease?.state === "delivered");
      assert.deepEqual(releaseOwner.map((row) => row.state), [
        afterRelease?.state === "delivered" ? "closed" : "bound",
      ]);

      if (afterRelease?.state === "pending") {
        const replayLease = await repository.claimNext({
          consumer: "webhook",
          ownerInstanceId: "release-race-replay-owner",
          leaseMs: 60_000,
        });
        assert.equal(replayLease?.eventKey, "delivery-release-race");
        await repository.settle({
          eventKey: replayLease!.eventKey,
          consumer: "webhook",
          ownerInstanceId: replayLease!.ownerInstanceId!,
          leaseToken: replayLease!.leaseToken!,
          outcome: "delivered",
          result: { schema: "setfarm.test-release-race-replay.v1" },
        });
      }

      const heartbeatLease = await repository.claimNext({
        consumer: "webhook",
        ownerInstanceId: "heartbeat-race-owner",
        leaseMs: 60_000,
      });
      assert.equal(heartbeatLease?.eventKey, "delivery-heartbeat-race");
      const [settlement, heartbeat] = await Promise.allSettled([
        repository.settle({
          eventKey: heartbeatLease.eventKey,
          consumer: "webhook",
          ownerInstanceId: heartbeatLease.ownerInstanceId!,
          leaseToken: heartbeatLease.leaseToken!,
          outcome: "delivered",
          result: { schema: "setfarm.test-heartbeat-race.v1" },
        }),
        repository.heartbeat({
          eventKey: heartbeatLease.eventKey,
          consumer: "webhook",
          ownerInstanceId: heartbeatLease.ownerInstanceId!,
          leaseToken: heartbeatLease.leaseToken!,
          leaseMs: 60_000,
        }),
      ]);
      assert.equal(settlement.status, "fulfilled");
      if (heartbeat.status === "fulfilled") {
        assert.ok(heartbeat.value === true || heartbeat.value === false);
      } else {
        assert.match(String(heartbeat.reason), /OPERATIONAL_EVENT_DELIVERY_BOUND_OWNER_INVALID/);
      }
      assert.equal((await repository.find(heartbeatLease.eventKey, "webhook"))?.state, "delivered");
    } finally {
      await database.cleanup();
    }
  });

  it("refuses missing, crossed, pending, closed, or tampered delivery owner sidecars before nonterminal mutation", async () => {
    for (const corruption of ["missing", "crossed", "pending"] as const) {
      const database = await createIsolatedTestDatabase();
      try {
        const outbox = createOperationalOutboxRepository(database.sql);
        const eventKey = `delivery-owner-${corruption}`;
        await publishFixture(outbox, eventKey);
        if (corruption === "crossed") {
          await publishFixture(outbox, `${eventKey}-foreign`);
          await database.sql.unsafe(
            `UPDATE internal_production_owner_reservations_v1 target
                SET canonical_owner_identity=foreign_owner.canonical_owner_identity,
                    binding_hash=foreign_owner.binding_hash,
                    binding_payload=foreign_owner.binding_payload
               FROM internal_production_owner_reservations_v1 foreign_owner
              WHERE target.category='operational-delivery'
                AND target.owner_key::jsonb->>'eventKey'=$1
                AND target.owner_key::jsonb->>'consumer'='webhook'
                AND foreign_owner.category='operational-delivery'
                AND foreign_owner.owner_key::jsonb->>'eventKey'=$2
                AND foreign_owner.owner_key::jsonb->>'consumer'='webhook'`,
            [eventKey, `${eventKey}-foreign`],
          );
        } else if (corruption === "pending") {
          await database.sql.unsafe(
            `UPDATE internal_production_owner_reservations_v1
                SET state='pending',canonical_owner_identity=NULL,
                    binding_hash=NULL,binding_payload=NULL
              WHERE category='operational-delivery'
                AND owner_key::jsonb->>'eventKey'=$1
                AND owner_key::jsonb->>'consumer'='webhook'`,
            [eventKey],
          );
        } else {
          await database.sql.unsafe(
            `DELETE FROM internal_production_owner_reservations_v1
              WHERE category='operational-delivery'
                AND owner_key::jsonb->>'eventKey'=$1
                AND owner_key::jsonb->>'consumer'='webhook'`,
            [eventKey],
          );
        }
        const repository = createOperationalEventDeliveryRepository(database.sql);
        await assert.rejects(
          repository.claimNext({ consumer: "webhook", ownerInstanceId: "corruption-claimant" }),
          /OPERATIONAL_EVENT_DELIVERY_BOUND_OWNER_INVALID/,
          corruption,
        );
        const delivery = await repository.find(eventKey, "webhook");
        assert.equal(delivery?.state, "pending", corruption);
        assert.equal(delivery?.attemptCount, 0, corruption);
      } finally {
        await database.cleanup();
      }
    }

    const closedDatabase = await createIsolatedTestDatabase();
    try {
      const outbox = createOperationalOutboxRepository(closedDatabase.sql);
      await publishFixture(outbox, "delivery-owner-closed");
      const repository = createOperationalEventDeliveryRepository(closedDatabase.sql);
      const claimed = await repository.claimNext({
        consumer: "webhook",
        ownerInstanceId: "closed-owner",
        leaseMs: 60_000,
      });
      assert.ok(claimed);
      await repository.settle({
        eventKey: claimed.eventKey,
        consumer: "webhook",
        ownerInstanceId: claimed.ownerInstanceId!,
        leaseToken: claimed.leaseToken!,
        outcome: "delivered",
        result: { schema: "setfarm.test-closed-owner.v1" },
      });
      await closedDatabase.sql.unsafe(
        `UPDATE operational_event_deliveries
            SET state='leased',owner_instance_id=$2,lease_token=$3,
                lease_expires_at=clock_timestamp()+interval '1 minute',
                delivered_at=NULL,result='{}'::jsonb
          WHERE event_key=$1 AND consumer='webhook'`,
        [claimed.eventKey, claimed.ownerInstanceId, claimed.leaseToken],
      );
      await assert.rejects(repository.heartbeat({
        eventKey: claimed.eventKey,
        consumer: "webhook",
        ownerInstanceId: claimed.ownerInstanceId!,
        leaseToken: claimed.leaseToken!,
      }), /OPERATIONAL_EVENT_DELIVERY_BOUND_OWNER_INVALID/);
      const preserved = await repository.find(claimed.eventKey, "webhook");
      assert.equal(preserved?.leaseToken, claimed.leaseToken);
    } finally {
      await closedDatabase.cleanup();
    }

    const tamperedDatabase = await createIsolatedTestDatabase();
    try {
      const outbox = createOperationalOutboxRepository(tamperedDatabase.sql);
      await publishFixture(outbox, "delivery-owner-tampered");
      const repository = createOperationalEventDeliveryRepository(tamperedDatabase.sql);
      const claimed = await repository.claimNext({
        consumer: "webhook",
        ownerInstanceId: "tampered-owner",
        leaseMs: 60_000,
      });
      assert.ok(claimed);
      await tamperedDatabase.sql.unsafe(
        `UPDATE internal_production_owner_reservations_v1
            SET binding_payload=jsonb_set(
              binding_payload,'{bindingHash}',to_jsonb(repeat('0',64)::text)
            )
          WHERE category='operational-delivery'
            AND owner_key::jsonb->>'eventKey'=$1
            AND owner_key::jsonb->>'consumer'='webhook'`,
        [claimed.eventKey],
      );
      await assert.rejects(repository.releaseForRetry({
        eventKey: claimed.eventKey,
        consumer: "webhook",
        ownerInstanceId: claimed.ownerInstanceId!,
        leaseToken: claimed.leaseToken!,
        diagnostic: "must remain leased",
      }), /OPERATIONAL_EVENT_DELIVERY_BOUND_OWNER_INVALID/);
      const preserved = await repository.find(claimed.eventKey, "webhook");
      assert.equal(preserved?.state, "leased");
      assert.equal(preserved?.leaseToken, claimed.leaseToken);
    } finally {
      await tamperedDatabase.cleanup();
    }
  });

  it("rolls the complete final-expiry close set back before selecting new work", async () => {
    const database = await createIsolatedTestDatabase();
    try {
      const outbox = createOperationalOutboxRepository(database.sql);
      const repository = createOperationalEventDeliveryRepository(database.sql);
      for (const eventKey of ["expiry-set-a", "expiry-set-b", "expiry-set-work"]) {
        await publishFixture(outbox, eventKey);
      }
      for (const eventKey of ["expiry-set-a", "expiry-set-b"]) {
        for (let attempt = 1; attempt <= 3; attempt += 1) {
          const claimed = await repository.claimNext({
            consumer: "webhook",
            ownerInstanceId: `${eventKey}-${attempt}`,
            leaseMs: 60_000,
          });
          assert.equal(claimed?.eventKey, eventKey);
          if (attempt < 3) {
            await repository.releaseForRetry({
              eventKey,
              consumer: "webhook",
              ownerInstanceId: claimed!.ownerInstanceId!,
              leaseToken: claimed!.leaseToken!,
              diagnostic: "bounded retry",
            });
          }
        }
      }
      await database.sql.unsafe(
        `UPDATE operational_event_deliveries
            SET lease_expires_at=clock_timestamp()-interval '1 second'
          WHERE event_key=ANY($1::text[]) AND consumer='webhook'`,
        [["expiry-set-a", "expiry-set-b"]],
      );
      await database.sql.unsafe(`
        CREATE FUNCTION test_reject_expiry_set_close_v1() RETURNS trigger
        LANGUAGE plpgsql AS $$ BEGIN
          IF NEW.category='operational-delivery'
             AND NEW.owner_key::jsonb->>'eventKey'='expiry-set-b'
             AND NEW.owner_key::jsonb->>'consumer'='webhook'
             AND NEW.state='closed' THEN
            RAISE EXCEPTION 'TEST_REJECT_EXPIRY_SET_CLOSE';
          END IF;
          RETURN NEW;
        END $$
      `);
      await database.sql.unsafe(`
        CREATE TRIGGER test_reject_expiry_set_close_v1
        BEFORE UPDATE OF state ON internal_production_owner_reservations_v1
        FOR EACH ROW EXECUTE FUNCTION test_reject_expiry_set_close_v1()
      `);
      try {
        await assert.rejects(repository.claimNext({
          consumer: "webhook",
          ownerInstanceId: "post-expiry-worker",
        }), /TEST_REJECT_EXPIRY_SET_CLOSE/);
      } finally {
        await database.sql.unsafe(
          "DROP TRIGGER test_reject_expiry_set_close_v1 ON internal_production_owner_reservations_v1",
        );
        await database.sql.unsafe("DROP FUNCTION test_reject_expiry_set_close_v1()")
      }
      const rolledBack = await database.sql.unsafe<Array<{
        event_key: string;
        state: string;
        owner_state: string;
      }>>(
        `SELECT delivery.event_key,delivery.state,owner.state AS owner_state
           FROM operational_event_deliveries delivery
           JOIN internal_production_owner_reservations_v1 owner
             ON owner.category='operational-delivery'
            AND owner.owner_key::jsonb->>'eventKey'=delivery.event_key
            AND owner.owner_key::jsonb->>'consumer'=delivery.consumer
          WHERE delivery.consumer='webhook'
            AND delivery.event_key=ANY($1::text[])
          ORDER BY delivery.event_key`,
        [["expiry-set-a", "expiry-set-b", "expiry-set-work"]],
      );
      assert.deepEqual(rolledBack.map((row) => ({ ...row })), [
        { event_key: "expiry-set-a", state: "leased", owner_state: "bound" },
        { event_key: "expiry-set-b", state: "leased", owner_state: "bound" },
        { event_key: "expiry-set-work", state: "pending", owner_state: "bound" },
      ]);
      const claimed = await repository.claimNext({
        consumer: "webhook",
        ownerInstanceId: "post-expiry-worker",
      });
      assert.equal(claimed?.eventKey, "expiry-set-work");
      const terminalized = await database.sql.unsafe<Array<{ event_key: string; state: string; owner_state: string }>>(
        `SELECT delivery.event_key,delivery.state,owner.state AS owner_state
           FROM operational_event_deliveries delivery
           JOIN internal_production_owner_reservations_v1 owner
             ON owner.category='operational-delivery'
            AND owner.owner_key::jsonb->>'eventKey'=delivery.event_key
            AND owner.owner_key::jsonb->>'consumer'=delivery.consumer
          WHERE delivery.consumer='webhook' AND delivery.event_key=ANY($1::text[])
          ORDER BY delivery.event_key`,
        [["expiry-set-a", "expiry-set-b"]],
      );
      assert.deepEqual(terminalized.map((row) => ({ ...row })), [
        { event_key: "expiry-set-a", state: "quarantined", owner_state: "closed" },
        { event_key: "expiry-set-b", state: "quarantined", owner_state: "closed" },
      ]);
    } finally {
      await database.cleanup();
    }
  });
});
