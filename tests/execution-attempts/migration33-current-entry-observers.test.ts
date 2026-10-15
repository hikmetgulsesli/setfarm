import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";

import {
  applyContractSpineMigrations,
  verifyContractSpineMigrations,
} from "../../src/db/contract-spine-migrations.js";
import {
  authenticateP3ProjectedReadinessTestCapabilityV1,
  createIsolatedTestDatabase,
  type TestDatabase,
} from "./test-database.js";

const guardedMigrationId = "contract-spine-bootstrap-main-claim-handoff-v1";
const ordinaryMigrationId = "033_v3_recovery_claim_runtime_publication_v1";

describe("ordinary migration 33 current-entry observers", () => {
  let database: TestDatabase;

  before(async () => {
    // The maintained isolated wrapper owns FD3, the prepared operation and DB.
    // Authenticate before acquisition; no fallback to invented migration proof.
    authenticateP3ProjectedReadinessTestCapabilityV1();
    database = await createIsolatedTestDatabase({ migrate: false });
    assert.match(database.database, /^setfarm_p3_/);
  });

  after(async () => {
    if (database) await database.cleanup();
  });

  beforeEach(async () => {
    await database.sql.unsafe("DROP SCHEMA public CASCADE");
    await database.sql.unsafe("CREATE SCHEMA public");
  });

  async function journalIdentity(version: 32 | 33): Promise<string> {
    const rows = await database.sql<Array<{ identity: string }>>`
      SELECT to_jsonb(migration)::text AS identity
        FROM public.setfarm_schema_migrations migration
       WHERE version = ${version}
    `;
    assert.equal(rows.length, 1);
    return rows[0]!.identity;
  }

  async function prepareEngineAdopted33() {
    const predecessor = await applyContractSpineMigrations(database.sql);
    assert.deepEqual(predecessor.guardedPending, [guardedMigrationId]);
    const guarded = await database.applyBootstrapMainClaimHandoffGuardedMigration32ForTestV1();
    assert.equal(guarded.status, "applied");
    assert.equal(guarded.migrationOrdinal, 32);
    const installed = await applyContractSpineMigrations(database.sql);
    assert.equal(installed.applied.at(-1), ordinaryMigrationId);
    const migration32Identity = await journalIdentity(32);
    const migration32 = JSON.parse(migration32Identity) as { name: string; state: string };
    assert.equal(migration32.name, guardedMigrationId);
    assert.equal(migration32.state, "applied");

    // Same wholly installed ordinary-33 adoption setup as migrations.test.ts.
    // This is confined to the authenticated test-owned DB, never the live DB.
    await database.sql`DELETE FROM public.setfarm_schema_migrations WHERE version = 33`;
    const adopted = await applyContractSpineMigrations(database.sql);
    assert.equal(adopted.adopted.at(-1), ordinaryMigrationId);
    assert.equal((await verifyContractSpineMigrations(database.sql)).status, "verified");
    assert.equal(await journalIdentity(32), migration32Identity);
    const migration33Identity = await journalIdentity(33);
    const migration33 = JSON.parse(migration33Identity) as {
      name: string; checksum: string; state: string;
    };
    assert.equal(migration33.name, ordinaryMigrationId);
    assert.equal(migration33.state, "adopted");
    assert.match(migration33.checksum, /^[a-f0-9]{64}$/);
    return { migration32Identity, migration33Identity, checksum: migration33.checksum };
  }

  it("current-entry apply-or-adopt observes engine-adopted ordinary migration 33", async () => {
    const before = await prepareEngineAdopted33();
    const observed = await database.db.applyOrAdoptInternalProductionCurrentEntryOrdinaryMigration33V1();
    assert.equal(observed.migrationOrdinal, 33);
    assert.equal(observed.migrationName, ordinaryMigrationId);
    assert.equal(observed.migrationChecksum, before.checksum);
    assert.equal(observed.migrationState, "current");
    assert.equal(await journalIdentity(32), before.migration32Identity);
    assert.equal(await journalIdentity(33), before.migration33Identity);
  });

  it("current-entry read-only observes engine-adopted ordinary migration 33", async () => {
    const before = await prepareEngineAdopted33();
    const observed = await database.db.observeInternalProductionCurrentEntryMigration33ReadOnlyV1();
    assert.equal(observed.state, "current");
    assert.equal(observed.migrationName, ordinaryMigrationId);
    assert.deepEqual(observed.journal, { ordinal: 33, state: "current", checksum: before.checksum });
    assert.ok(observed.catalog);
    assert.equal(await journalIdentity(32), before.migration32Identity);
    assert.equal(await journalIdentity(33), before.migration33Identity);
  });
});
