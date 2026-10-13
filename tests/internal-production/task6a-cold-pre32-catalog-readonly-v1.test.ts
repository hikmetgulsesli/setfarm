import assert from "node:assert/strict";
import { test } from "node:test";
import type { ReadOnlyCatalogTransactionV1 } from "../../src/db/read-only-catalog-transaction-v1.js";
import { requireColdPre32CatalogAbsenceInTransactionV1 as cold }
  from "../../src/internal-production/task6a-cold-pre32-catalog-readonly-v1.js";

// Complete genuine leaf, modeled returned rows; not native PostgreSQL evidence.
const zero = { laterJournalCount: "0", relationCount: "0", functionCount: "0",
  typeCount: "0", triggerCount: "0" };
const refusal = /INTERNAL_PRODUCTION_CURRENT_ENTRY_INVALID:cold bootstrap migration32\/33 catalog or journal is not absent/;
function port(rows: unknown, seen: string[] = []): ReadOnlyCatalogTransactionV1 {
  return { unsafe: async (statement: string, parameters?: unknown) => {
    assert.equal(parameters, undefined); seen.push(statement); return rows;
  } } as ReadOnlyCatalogTransactionV1;
}
test("genuine cold leaf accepts only one exact zero row in one read-only query", async () => {
  const seen: string[] = [];
  assert.equal(await cold(port([{ ...zero }], seen)), undefined);
  assert.equal(seen.length, 1);
  assert.match(seen[0]!, /WHERE version >= 32/);
  assert.match(seen[0]!, /actual\.relnamespace = 'public'::regnamespace/);
  assert.match(seen[0]!, /actual\.tgname = left\(expected\.name, 63\)/);
  assert.equal(seen[0]!.includes("actual.tgrelid"), false);
});
for (const field of ["laterJournalCount", "relationCount", "functionCount", "typeCount", "triggerCount"] as const) {
  for (const value of ["1", "-1", "00", 0, null, undefined]) {
    test(`genuine cold leaf refuses ${field}=${String(value)}`, async () => {
      await assert.rejects(cold(port([{ ...zero, [field]: value }])), refusal);
    });
  }
  test(`genuine cold leaf refuses missing ${field}`, async () => {
    const row: Record<string, unknown> = { ...zero }; delete row[field];
    await assert.rejects(cold(port([row])), refusal);
  });
}
for (const [name, rows] of [
  ["empty", []], ["duplicate", [{ ...zero }, { ...zero }]],
  ["extra-field", [{ ...zero, extra: "0" }]], ["null-row", [null]],
  ["array-row", [Object.assign([], zero)]],
  ["foreign-prototype", [Object.assign(Object.create({ foreign: true }), zero)]],
] as const) {
  test(`genuine cold leaf refuses ${name} rows`, async () => {
    await assert.rejects(cold(port(rows)), refusal);
  });
}
test("genuine cold leaf preserves original undefined query rejection", async () => {
  let calls = 0;
  const transaction = { unsafe: async () => { calls++; throw undefined; } } as ReadOnlyCatalogTransactionV1;
  const original = cold(transaction);
  const [settled] = await Promise.allSettled([original]);
  assert.equal(settled!.status, "rejected");
  if (settled!.status === "rejected") assert.equal(settled!.reason, undefined);
  assert.equal(calls, 1);
});
test("wrong cardinality refuses without evaluating a private row accessor", async () => {
  let reads = 0;
  const rows = new Array(2);
  Object.defineProperty(rows, 0, { get() { reads++; throw Error("PRIVATE_QUERY_DETAIL"); } });
  await assert.rejects(cold(port(rows)), refusal);
  assert.equal(reads, 0);
});
