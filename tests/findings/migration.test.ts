import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

import {
  ContractSpineMigrationError,
  applyContractSpineMigrations,
  auditAuthorityV3ContractSpineThroughMigration31V1,
  planContractSpineMigrations,
} from "../../src/db/contract-spine-migrations.js";
import { createIsolatedTestDatabase, type TestDatabase } from "../execution-attempts/test-database.js";

describe("finding/recovery ledger migration", () => {
  let database: TestDatabase;

  before(async () => {
    database = await createIsolatedTestDatabase({ migrate: false });
  });

  after(async () => database.cleanup());

  it("applies v10 additively and detects partial ledger drift", async () => {
    const applied = await applyContractSpineMigrations(database.sql);
    assert.equal(applied.applied.includes("010_finding_recovery_evidence_ledger"), true);
    const verified = await auditAuthorityV3ContractSpineThroughMigration31V1(database.sql);
    const v10 = verified.migrations.find((migration) => migration.version === 10);
    assert.equal(v10?.name, "010_finding_recovery_evidence_ledger");
    assert.equal(v10?.state, "applied");

    const relations = await database.sql<Array<{ name: string }>>`
      SELECT tablename AS name
        FROM pg_tables
       WHERE schemaname = 'public'
         AND tablename IN (
           'finding_sets', 'findings', 'evidence_bundles',
           'recovery_cases', 'recovery_dispatches', 'recovery_dispatch_findings'
         )
       ORDER BY tablename
    `;
    assert.deepEqual(relations.map((row) => row.name), [
      "evidence_bundles",
      "finding_sets",
      "findings",
      "recovery_cases",
      "recovery_dispatch_findings",
      "recovery_dispatches",
    ]);

    await database.sql`DELETE FROM setfarm_schema_migrations WHERE version = 10`;
    await database.sql`DROP INDEX idx_recovery_dispatches_case_created`;
    const plan = await planContractSpineMigrations(database.sql);
    assert.equal(plan.status, "drift");
    assert.equal(plan.migrations.find((migration) => migration.version === 10)?.state, "adoption_mismatch");
    await assert.rejects(
      applyContractSpineMigrations(database.sql),
      (error: unknown) => error instanceof ContractSpineMigrationError
        && error.code === "MIGRATION_ADOPTION_MISMATCH",
    );
  });
});
