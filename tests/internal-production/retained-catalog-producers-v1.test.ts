import assert from "node:assert/strict";
import { test } from "node:test";
import { verifyContractSpineRuntimeAccessInTransactionReadOnlyV1 as access }
  from "../../src/db/contract-spine-runtime-access-readonly-verifier-v1.js";
import { verifyOrdinaryBaseSchemaCatalogInTransactionReadOnlyV1 as base }
  from "../../src/db/base-schema-readonly-verifier-v1.js";
import { verifyExpectedPublicObjectOwnerInTransactionReadOnlyV1 as owner }
  from "../../src/db/public-object-owner-readonly-verifier-v1.js";

// Actual complete producers, modeled query rows; NOT native catalog evidence.
const safe = { sameRole: true, otherRoleMembership: false, unsafeRoleAttributes: false,
  databaseCreate: false, schemaCreate: false, journalSelect: true,
  journalWrite: false, journalColumnWrite: false };
const expectedOwner = { roleExists: true, ownerReachable: false, objectCount: 27, ownerMatches: true };
function port(rows: unknown[], seen: string[] = [], parameters: unknown[] = []) {
  return { unsafe: async (statement: string, values?: unknown[]) => {
    seen.push(statement); parameters.push(values); return rows;
  } } as never;
}
test("actual access leaf accepts restricted role without current-head journal query", async () => {
  const seen: string[] = [];
  await access(port([safe], seen));
  assert.equal(seen.length, 1);
  assert.ok(seen[0]!.includes("has_any_column_privilege"));
  assert.ok(seen[0]!.includes("'MAINTAIN'"));
  assert.ok(!seen[0]!.includes("SELECT version"));
});
for (const [field, value] of [["sameRole", false], ["otherRoleMembership", true],
  ["unsafeRoleAttributes", true], ["databaseCreate", true], ["schemaCreate", true],
  ["journalSelect", false], ["journalWrite", true], ["journalColumnWrite", true]] as const) {
  test(`actual access leaf refuses ${field}`, async () => {
    await assert.rejects(access(port([{ ...safe, [field]: value }])),
      /SETFARM_CURRENT_HEAD_JOURNAL_CATALOG_MISMATCH_V1/);
  });
}
test("access leaf refuses missing/duplicate rows and sanitizes undefined driver rejection", async () => {
  for (const rows of [[], [safe, safe]]) await assert.rejects(access(port(rows)),
    /SETFARM_CURRENT_HEAD_JOURNAL_CATALOG_MISMATCH_V1/);
  await assert.rejects(access({ unsafe: async () => { throw undefined; } } as never),
    /SETFARM_CURRENT_HEAD_JOURNAL_CATALOG_MISMATCH_V1/);
});
test("actual owner leaf binds caller owner and retains ordinary timeout setup", async () => {
  const seen: string[] = [], parameters: unknown[] = [];
  await owner(port([expectedOwner], seen, parameters), "setfarm_owner");
  assert.equal(seen.length, 3);
  assert.ok(seen[0]!.includes("lock_timeout")); assert.ok(seen[1]!.includes("statement_timeout"));
  assert.deepEqual(parameters[2], ["setfarm_owner"]);
  assert.ok(seen[2]!.includes("relowner IS DISTINCT FROM"));
});
for (const rows of [[], [expectedOwner, expectedOwner], [{ ...expectedOwner, roleExists: false }],
  [{ ...expectedOwner, ownerReachable: true }], [{ ...expectedOwner, ownerReachable: null }],
  [{ ...expectedOwner, objectCount: 0 }], [{ ...expectedOwner, ownerMatches: false }]]) {
  test(`actual owner leaf refuses ${JSON.stringify(rows)}`, async () => {
    await assert.rejects(owner(port(rows), "setfarm_owner"), /SETFARM_BASE_SCHEMA_OWNER_MISMATCH/);
  });
}
test("actual base body refuses empty catalog without owning a transaction or pool", async () => {
  const seen: string[] = [];
  const query = { unsafe: async (statement: string) => {
    seen.push(statement); return statement.includes("has_database_privilege")
      ? [{ database: true, schema: true }] : [];
  } } as never;
  await assert.rejects(base(query), /SETFARM_BASE_SCHEMA_CATALOG_MISMATCH_V1/);
  assert.ok(seen.some(sql => sql.includes("idle_in_transaction_session_timeout")));
  assert.ok(seen.every(sql => sql.trimStart().startsWith("SELECT")));
});
