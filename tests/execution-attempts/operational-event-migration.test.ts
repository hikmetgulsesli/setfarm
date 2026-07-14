import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  ContractSpineMigrationError,
  applyContractSpineMigrations,
  planContractSpineMigrations,
  verifyContractSpineMigrations,
} from "../../src/db/contract-spine-migrations.js";
import { operationalEventDeliveryId } from "../../src/execution/schemas/operational-event-v1.js";
import { createIsolatedTestDatabase, type TestDatabase } from "./test-database.js";

async function downgradeToV11(database: TestDatabase): Promise<void> {
  await database.sql`DELETE FROM setfarm_schema_migrations WHERE version = 12`;
  await database.sql`DROP TABLE operational_event_deliveries`;
  await database.sql`DROP TABLE operational_events`;
  await database.sql`DROP FUNCTION setfarm_forbid_operational_event_mutation()`;
}

describe("canonical operational event migration", () => {
  it("backfills published v11 outbox rows with one event and bounded legacy delivery ownership", async () => {
    const database = await createIsolatedTestDatabase();
    try {
      await downgradeToV11(database);
      await database.sql.unsafe(
        `INSERT INTO operational_outbox (
           outbox_id, event_key, event_type, aggregate_type, aggregate_id,
           payload, state, attempt_count, published_at, created_at, updated_at
         ) VALUES (
           'OBX_legacy-published-v11', 'legacy-published-v11',
           'run.terminal', 'run', 'RUN_legacy-published-v11',
           $1::text::jsonb, 'published', 1,
           '2026-07-13T15:01:00.000Z'::timestamptz,
           '2026-07-13T15:00:00.000Z'::timestamptz,
           '2026-07-13T15:01:00.000Z'::timestamptz
         )`,
        [JSON.stringify({
          schema: "setfarm.operational-outbox-event.v1",
          runId: "RUN_legacy-published-v11",
          status: "failed",
        })],
      );

      const applied = await applyContractSpineMigrations(database.sql);

      assert.deepEqual(applied.applied, ["012_canonical_operational_event_projection"]);
      const events = await database.sql<Array<{
        event_key: string;
        event_hash: string;
        run_id: string;
      }>>`
        SELECT event_key, event_hash, run_id FROM operational_events
      `;
      assert.equal(events.length, 1);
      assert.equal(events[0]?.event_key, "legacy-published-v11");
      assert.equal(events[0]?.event_hash.length, 64);
      assert.equal(events[0]?.run_id, "RUN_legacy-published-v11");
      const deliveries = await database.sql<Array<{
        consumer: string;
        delivery_id: string;
        state: string;
        attempt_count: number;
        diagnostic: string | null;
      }>>`
        SELECT consumer, delivery_id, state, attempt_count, diagnostic
          FROM operational_event_deliveries
         ORDER BY consumer
      `;
      assert.deepEqual(deliveries.map((row) => ({ ...row })), [
        {
          consumer: "jsonl",
          delivery_id: operationalEventDeliveryId("legacy-published-v11", "jsonl"),
          state: "pending",
          attempt_count: 0,
          diagnostic: null,
        },
        {
          consumer: "webhook",
          delivery_id: operationalEventDeliveryId("legacy-published-v11", "webhook"),
          state: "quarantined",
          attempt_count: 3,
          diagnostic: "LEGACY_WEBHOOK_DELIVERY_STATE_UNKNOWN",
        },
      ]);
      assert.equal((await verifyContractSpineMigrations(database.sql)).status, "verified");
      const replay = await applyContractSpineMigrations(database.sql);
      assert.deepEqual(replay.applied, []);
      assert.equal(replay.alreadyApplied.includes("012_canonical_operational_event_projection"), true);
    } finally {
      await database.cleanup();
    }
  });

  it("adopts an exact additive v12 shape and reports a clean rollback boundary when absent", async () => {
    const database = await createIsolatedTestDatabase();
    try {
      await database.sql`DELETE FROM setfarm_schema_migrations WHERE version = 12`;
      const adoptionPlan = await planContractSpineMigrations(database.sql);
      assert.equal(adoptionPlan.migrations.find((item) => item.version === 12)?.state, "adoptable");
      const adopted = await applyContractSpineMigrations(database.sql);
      assert.deepEqual(adopted.adopted, ["012_canonical_operational_event_projection"]);

      await downgradeToV11(database);
      const rollbackPlan = await planContractSpineMigrations(database.sql);
      assert.equal(rollbackPlan.migrations.find((item) => item.version === 12)?.state, "pending");
      assert.equal(rollbackPlan.status, "pending");
    } finally {
      await database.cleanup();
    }
  });

  it("fails verification when the canonical event immutability boundary is disabled", async () => {
    const database = await createIsolatedTestDatabase();
    try {
      await database.sql`ALTER TABLE operational_events DISABLE TRIGGER trg_operational_events_immutable`;
      await assert.rejects(
        verifyContractSpineMigrations(database.sql),
        (error: unknown) => error instanceof ContractSpineMigrationError
          && error.code === "MIGRATION_ADOPTION_MISMATCH"
          && /immutability trigger/.test(error.message),
      );
    } finally {
      await database.cleanup();
    }
  });
});
