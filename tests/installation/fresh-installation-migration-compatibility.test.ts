import assert from "node:assert/strict";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import {
  computeContractSpineSemanticMigrationDigests,
  createContractSpineMigrationSourceReader,
} from "../../src/db/contract-spine-migration-source-integrity.js";
import { CONTRACT_SPINE_SEMANTIC_MIGRATION_DIGESTS } from "../../src/db/contract-spine-migration-digests.generated.js";
import { getContractSpineCurrentHeadJournalIdentitiesV1 } from "../../src/db/contract-spine-migrations.js";

// Published by main0010a430, before the fresh installation feature. An existing
// journal must retain these identities; fresh bootstrap has a distinct origin.
const published = {
  32: "8cbaab0c47bf3639033442d2df9a1c15d421eb34adbab72fa82951712cafe4e2",
  33: "eb75ce31cd8715590e31a9c64b6e701c84a947fbb1f2ff67b540d1b658dd1f79",
} as const;

test("fresh installation preserves the published migration32 and33 source identities", () => {
  const read = createContractSpineMigrationSourceReader(fileURLToPath(new URL("../../", import.meta.url)));
  const actual = computeContractSpineSemanticMigrationDigests(read);
  for (const version of [32, 33] as const) {
    assert.equal(actual[version], published[version], `published migration${version} semantics changed`);
    assert.equal(CONTRACT_SPINE_SEMANTIC_MIGRATION_DIGESTS[version], published[version]);
  }
});

test("fresh installation retains the published migration32 and33 journal checksums", () => {
  const identities = getContractSpineCurrentHeadJournalIdentitiesV1();
  assert.equal(identities.find(row => row.version === 32)?.checksum, "d152ec3d70de4221dc2a5bc79ccf46b4a6b89a3f5e8b966b8002a129d9e8c71d");
  assert.equal(identities.find(row => row.version === 33)?.checksum, "10009bdaccddfaea7252036384889db14c51332a3f8f239019224396545417be");
});
