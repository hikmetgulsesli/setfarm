import assert from "node:assert/strict";
import { test } from "node:test";

import {
  isOwnerBackedFindingSourceV1,
  verifyFindingPrivateClusterTargetV1,
  verifyFindingPrivateClusterIdentityV1,
} from "../finding-test-preflight.mjs";

const dataDirectory = "/tmp/setfarm-task6a-pg.enUGt1/data";
const adminUrl = "postgresql://setrox@127.0.0.1:55437/postgres";
const observed = Object.freeze({
  data_directory: dataDirectory,
  port: "55437",
  socket_directories: "/tmp/setfarm-task6a-pg.enUGt1",
});

test("all findings test-database imports require an owner-backed fixture", () => {
  assert.equal(isOwnerBackedFindingSourceV1(
    'import { createIsolatedMigration31TestDatabase } from "../execution-attempts/test-database.js";',
  ), true);
  assert.equal(isOwnerBackedFindingSourceV1(
    'import { createIsolatedTestDatabase } from "../execution-attempts/test-database.js";',
  ), true);
  assert.equal(isOwnerBackedFindingSourceV1(
    'import { createFindingSetV1 } from "../../src/findings/finding-set.js";',
  ), false);
});

test("findings owner fixture verifies the exact private cluster identity", () => {
  assert.doesNotThrow(() => verifyFindingPrivateClusterTargetV1(adminUrl, dataDirectory));
  assert.throws(
    () => verifyFindingPrivateClusterTargetV1("postgresql://setrox@127.0.0.1:5432/postgres", dataDirectory),
    /^Error: FINDING_OWNER_TEST_PRIVATE_CLUSTER_UNVERIFIED$/,
  );
  assert.doesNotThrow(() => verifyFindingPrivateClusterIdentityV1(adminUrl, dataDirectory, observed));
  const rejected = [
    [adminUrl, undefined, observed],
    ["postgresql://setrox@127.0.0.1:5432/postgres", dataDirectory, observed],
    ["postgresql://setrox@127.0.0.1:55437/setfarm", dataDirectory, observed],
    ["postgresql://setrox@192.0.2.5:55437/postgres", dataDirectory, observed],
    [adminUrl, "/tmp/setfarm-task6a-pg.other/data", observed],
    [adminUrl, dataDirectory, { ...observed, data_directory: "/tmp/other/data" }],
    [adminUrl, dataDirectory, { ...observed, port: "5432" }],
    [adminUrl, dataDirectory, { ...observed, socket_directories: "/tmp/other" }],
  ];
  for (const [url, expected, actual] of rejected) {
    assert.throws(
      () => verifyFindingPrivateClusterIdentityV1(url, expected, actual),
      /^Error: FINDING_OWNER_TEST_PRIVATE_CLUSTER_UNVERIFIED$/,
    );
  }
});
