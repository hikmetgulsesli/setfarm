import assert from "node:assert/strict";
import { test } from "node:test";

import {
  getContractSpineCurrentHeadJournalIdentitiesV1,
  V3_RECOVERY_CLAIM_RUNTIME_PUBLICATION_V1_MIGRATION_JOURNAL_IDENTITY,
} from "../../src/db/contract-spine-migrations.js";
import { verifyContractSpineCurrentHeadJournalReadOnlyV1 } from "../../src/db/contract-spine-readonly-verifier-v1.js";

test("current-head source identities expose only frozen data for versions 1 through 33", () => {
  const identities = getContractSpineCurrentHeadJournalIdentitiesV1();
  assert.equal(identities.length, 33);
  assert.equal(Object.isFrozen(identities), true);
  identities.forEach((identity, index) => {
    assert.equal(Object.isFrozen(identity), true);
    assert.deepEqual(Reflect.ownKeys(identity), ["version", "name", "checksum", "migrationClass"]);
    assert.equal(identity.version, index + 1);
    assert.ok(identity.name.length > 0);
    assert.match(identity.checksum, /^[a-f0-9]{64}$/);
    assert.equal(identity.migrationClass, index === 31 ? "guarded" : "automatic");
  });
  assert.deepEqual(identities[32], {
    version: V3_RECOVERY_CLAIM_RUNTIME_PUBLICATION_V1_MIGRATION_JOURNAL_IDENTITY.ordinal,
    name: V3_RECOVERY_CLAIM_RUNTIME_PUBLICATION_V1_MIGRATION_JOURNAL_IDENTITY.name,
    checksum: V3_RECOVERY_CLAIM_RUNTIME_PUBLICATION_V1_MIGRATION_JOURNAL_IDENTITY.checksum,
    migrationClass: "automatic",
  });
});

test("current-head journal refuses an empty catalog after bounded read-only setup", async () => {
  const statements: string[] = [];
  const sql = {
    begin: async (mode: string, operation: (transaction: unknown) => Promise<void>) => {
      assert.equal(mode, "isolation level repeatable read read only");
      return operation({ unsafe: async (statement: string) => {
        statements.push(statement);
        return [];
      } });
    },
  };
  await assert.rejects(verifyContractSpineCurrentHeadJournalReadOnlyV1(sql as never),
    /SETFARM_CURRENT_HEAD_JOURNAL_CATALOG_MISMATCH_V1/);
  assert.equal(statements[0],
    "SELECT pg_catalog.set_config('search_path', 'pg_catalog, public, pg_temp', true)");
  assert.equal(statements[1],
    "SELECT pg_catalog.set_config('quote_all_identifiers', 'off', true)");
  assert.ok(statements.some((statement) => statement.includes("lock_timeout")));
  assert.ok(statements.some((statement) => statement.includes("statement_timeout")));
  assert.ok(statements.some((statement) => statement.includes("idle_in_transaction_session_timeout")));
  assert.ok(statements.every((statement) => statement.trimStart().startsWith("SELECT")));
  assert.ok(statements.every((statement) => !/pg_advisory|LOCK TABLE|FOR UPDATE/i.test(statement)));
});

test("current-head journal reduces driver errors to a fixed private-data-free code", async () => {
  const sql = { begin: async () => { throw new Error("postgresql://secret@example.invalid/private"); } };
  await assert.rejects(verifyContractSpineCurrentHeadJournalReadOnlyV1(sql as never),
    (error: unknown) => error instanceof Error
      && error.message === "SETFARM_CURRENT_HEAD_JOURNAL_CATALOG_MISMATCH_V1"
      && !String(error).includes("secret"));
});
