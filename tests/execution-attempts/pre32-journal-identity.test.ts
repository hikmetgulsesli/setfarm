import assert from "node:assert/strict";
import { test } from "node:test";

import {
  contractSpinePre32SourceJournalIdentitiesV1,
  verifyHeldPre32ContractSpineJournalIdentityV1,
} from "../../src/db/contract-spine-migrations.js";

const expected = contractSpinePre32SourceJournalIdentitiesV1();

test("pre32 identity derives an ordered frozen 1–31 chain from source", () => {
  assert.equal(expected.length, 31);
  assert.equal(Object.isFrozen(expected), true);
  assert.equal(Object.isFrozen(expected[0]), true);
  assert.deepEqual(expected.map(row => row.version), Array.from({ length: 31 }, (_, index) => index + 1));
  assert.equal(expected[0]?.name, "001_execution_attempts");
  assert.equal(expected[15]?.name, "016_v3_preparation_block_ledger");
  assert.equal(expected[30]?.name, "031_operational_failure_cause_authority_v3");
  assert.equal(expected[0]?.checksum, "a48083e6d48d0072a36f255f02d05708606053edc38aa140dea8a58c7b48a32e");
  assert.equal(expected[30]?.checksum, "7fba6cf62e2201dc12e64175611e3a77fe780bc5af98a62f5f353281e075ab8f");
});

test("held pre32 identity accepts exact applied/adopted chain on supplied connection", async () => {
  const rows = expected.map((row, index) => ({ ...row, state: index === 0 ? "adopted" : "applied" }));
  const queries: Array<{ statement: string; parameters: unknown }> = [];
  const query = async (statement: string, parameters: readonly unknown[]) => {
    queries.push({ statement, parameters });
    return rows;
  };
  await verifyHeldPre32ContractSpineJournalIdentityV1(query);
  assert.equal(queries.length, 1);
  assert.match(queries[0]!.statement, /SELECT version, name, checksum, state\s+FROM public\.setfarm_schema_migrations/);
  assert.match(queries[0]!.statement, /WHERE version <= \$1\s+ORDER BY version/);
  assert.deepEqual(queries[0]!.parameters, [31]);
});

for (const [scenario, mutate] of [
  ["early name", (rows: Record<string, unknown>[]) => { rows[0]!.name = "wrong"; }],
  ["middle checksum", (rows: Record<string, unknown>[]) => { rows[15]!.checksum = "0".repeat(64); }],
  ["missing row", (rows: Record<string, unknown>[]) => { rows.splice(12, 1); }],
  ["duplicate row", (rows: Record<string, unknown>[]) => { rows.splice(12, 0, { ...rows[12]! }); }],
  ["reordered row", (rows: Record<string, unknown>[]) => { [rows[12], rows[13]] = [rows[13]!, rows[12]!]; }],
  ["nonterminal state", (rows: Record<string, unknown>[]) => { rows[23]!.state = "pending"; }],
  ["extra property", (rows: Record<string, unknown>[]) => { rows[20]!.secret = "never accepted"; }],
] as const) {
  test(`held pre32 identity rejects ${scenario}`, async () => {
    const rows: Record<string, unknown>[] = expected.map(row => ({ ...row, state: "applied" }));
    mutate(rows);
    await assert.rejects(verifyHeldPre32ContractSpineJournalIdentityV1(async () => rows),
      { code: "MIGRATION_CHECKSUM_MISMATCH" });
  });
}
