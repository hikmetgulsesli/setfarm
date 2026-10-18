import assert from "node:assert/strict";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import {
  computeContractSpineSemanticMigrationDigests,
  createContractSpineMigrationSourceReader,
} from "../../src/db/contract-spine-migration-source-integrity.js";

test("fresh current-origin checks and shared identity verifier are bound to migrations32 and33", () => {
  const read = createContractSpineMigrationSourceReader(fileURLToPath(new URL("../../", import.meta.url)));
  const baseline = computeContractSpineSemanticMigrationDigests(read);
  for (const statement of [
    "await verifyFreshApplicationOnConnectionV1(sql, current.migrationApplication, row.release_sha);",
    "await verifyFreshInstallationDatabaseIdentityV1(sql, application.origin);",
  ]) {
    const changed = computeContractSpineSemanticMigrationDigests(file => {
      const source = read(file);
      if (file !== "src/db/contract-spine-migrations.ts") return source;
      assert.equal(source.split(statement).length, 2, "mutation must remove exactly one operative check");
      return source.replace(statement, "/* removed by source-integrity regression */");
    });
    assert.notEqual(changed[32], baseline[32]);
    assert.notEqual(changed[33], baseline[33]);
    for (const version of [8, 11, 12, 23, 24, 25, 26, 27, 28, 29, 30, 31] as const) {
      assert.equal(changed[version], baseline[version]);
    }
  }
});
