import assert from "node:assert/strict";
import { test } from "node:test";

import {
  getContractSpineCurrentHeadJournalIdentitiesV1,
  V3_RECOVERY_CLAIM_RUNTIME_PUBLICATION_V1_MIGRATION_JOURNAL_IDENTITY,
} from "../../src/db/contract-spine-migrations.js";

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
