import assert from "node:assert/strict";
import { test } from "node:test";
import { hashCanonicalJson } from "../../src/product-compiler/canonical-json.js";
import { getContractSpineCurrentHeadJournalIdentitiesV1 } from "../../src/db/contract-spine-migrations.js";
import { validateOwnerAdmissionMigrationApplicationV1 } from "../../src/internal-production/owner-admission-head-v1.js";
import { parseFreshInstallationOriginV1 } from "../../src/installation/fresh-installation-origin-v1.js";

function application() {
  const origin = {
    schema: "setfarm.fresh-installation-origin.v1",
    installationId: "848c891f-8379-4d45-bb5a-687f7678db83",
    operationId: "94658131-486f-451e-b5b6-262b2c1763a1",
    systemIdentifier: "7580170739674923521",
    databaseOid: 16389,
    databaseName: "setfarm_install_848c891f83794d45bb5a687f7678db83",
    ownerRole: "sf_owner_848c891f83794d45bb5a687f7678db83",
    runtimeRole: "sf_runtime_848c891f83794d45bb5a687f7678db83",
    sourceSha: "1234567890abcdef1234567890abcdef12345678",
    migrations: getContractSpineCurrentHeadJournalIdentitiesV1(),
  };
  const body = {
    schema: "setfarm.fresh-installation-schema-application.v1",
    origin,
    evidenceHash: hashCanonicalJson(origin),
  };
  return { ...body, applicationHash: hashCanonicalJson(body) };
}

test("owner admission accepts independently identified fresh installation genesis", () => {
  const input = application();
  const actual = validateOwnerAdmissionMigrationApplicationV1(input, input.evidenceHash);
  assert.equal(actual.schema, "setfarm.fresh-installation-schema-application.v1");
  assert.deepEqual(actual, input);
  assert.notEqual(actual, input);
});

test("fresh genesis cannot replace its origin while retaining the protected evidence hash", () => {
  const input = application();
  input.origin.databaseOid += 1;
  assert.throws(() => validateOwnerAdmissionMigrationApplicationV1(input, input.evidenceHash));
});

test("fresh genesis rejects an internally rehashed legacy target or incomplete source chain", () => {
  for (const change of [
    (origin: ReturnType<typeof application>["origin"]) => { origin.databaseName = "setfarm"; },
    (origin: ReturnType<typeof application>["origin"]) => { origin.migrations = origin.migrations.slice(0, 32); },
    (origin: ReturnType<typeof application>["origin"]) => { origin.ownerRole = origin.runtimeRole; },
  ]) {
    const input = application();
    change(input.origin);
    input.evidenceHash = hashCanonicalJson(input.origin);
    input.applicationHash = hashCanonicalJson({ schema: input.schema, origin: input.origin, evidenceHash: input.evidenceHash });
    assert.throws(() => validateOwnerAdmissionMigrationApplicationV1(input, input.evidenceHash));
  }
});

test("fresh application discriminator accessors are refused without invocation", () => {
  let invoked = false;
  const input = application();
  Object.defineProperty(input, "schema", { enumerable: true, get() { invoked = true; return "setfarm.fresh-installation-schema-application.v1"; } });
  assert.throws(() => validateOwnerAdmissionMigrationApplicationV1(input, input.evidenceHash));
  assert.equal(invoked, false);
});

test("fresh origin requires a dense migration array of own data entries", () => {
  const input = application().origin;
  assert.throws(() => parseFreshInstallationOriginV1({ ...input, migrations: new Array(33) }));
  let invoked = false;
  const accessor = [...input.migrations];
  Object.defineProperty(accessor, "0", { enumerable: true, get() { invoked = true; return input.migrations[0]; } });
  assert.throws(() => parseFreshInstallationOriginV1({ ...input, migrations: accessor }));
  assert.equal(invoked, false);
  const overridden = [...input.migrations];
  Object.defineProperty(overridden, "map", { value() { invoked = true; return input.migrations; } });
  assert.throws(() => parseFreshInstallationOriginV1({ ...input, migrations: overridden }));
  assert.equal(invoked, false);
  const extra = [...input.migrations];
  Object.defineProperty(extra, Symbol("extra"), { value: true });
  assert.throws(() => parseFreshInstallationOriginV1({ ...input, migrations: extra }));
});

test("existing guarded32 application retains its exact schema and hash contract", () => {
  const body = {
    schema: "setfarm.bootstrap-main-claim-handoff-guarded-migration-32-application.v1",
    evidenceHash: "a".repeat(64),
    authorizationRef: "setfarm://internal-production/pre-manifest-authorization/sha256/" + "b".repeat(64),
    authorizationHash: "b".repeat(64),
    authorizationConsumptionRef: "setfarm://internal-production/pre-manifest-consumption/sha256/" + "c".repeat(64),
    authorizationConsumptionHash: "c".repeat(64),
  };
  const input = { ...body, applicationHash: hashCanonicalJson(body) };
  assert.deepEqual(validateOwnerAdmissionMigrationApplicationV1(input, input.evidenceHash), input);
  assert.throws(() => validateOwnerAdmissionMigrationApplicationV1({ ...input, schema: "setfarm.fresh-installation-schema-application.v1" }, input.evidenceHash));
});
