import assert from "node:assert/strict";
import fs from "node:fs";
import { test } from "node:test";

import { hashCanonicalJson } from "../../src/product-compiler/canonical-json.js";
import { createLegacyFindingPublicationInventoryValueV1 } from "../../src/findings/legacy-finding-publication-inventory-v1.js";

function sealed<T extends object>(body: T, key: string): T & Record<string, string> {
  return Object.freeze({ ...body, [key]: hashCanonicalJson(body) });
}
function database() {
  const activeRows = sealed({ schema: "setfarm.internal-production-positive-worktree-active-rows.v2",
    authority: "diagnostic-only", physicalIdentityProvenance: "unverified", activeRuns: Object.freeze([]),
    openClaims: Object.freeze([]), activeAttempts: Object.freeze([]), activeSessions: Object.freeze([]),
    counts: Object.freeze({ runCount: 0, claimCount: 0, attemptCount: 0, sessionCount: 0 }) }, "snapshotHash");
  const bindingRows = sealed({ schema: "setfarm.internal-production-positive-worktree-binding-rows.v1",
    authority: "diagnostic-only", physicalIdentityProvenance: "unverified", activeAttempts: Object.freeze([]),
    activeSessions: Object.freeze([]), counts: Object.freeze({ attemptCount: 0, sessionCount: 0 }) }, "snapshotHash");
  const legacyCensus = Object.freeze({ activeRunCount: 0, openClaimCount: 0, executionAttemptCount: 0,
    activeRuntimeSessionCount: 0, activeCompletionOwnerCount: 0, unsettledMandatoryEffectCount: 0,
    artifactReservationCount: 0, publicationBatchCount: 0, artifactPublicationCount: 0,
    terminationOwnerCount: 0, findingOwnerCount: 0, recoveryOwnerCount: 0, operationalDeliveryCount: 0,
    legacyFindingPublicationInventory: createLegacyFindingPublicationInventoryValueV1([]) });
  return sealed({ schema: "setfarm.internal-production-pre32-active-binding-snapshot.v7", authority: "diagnostic-only",
    tableLockScope: "fixed-pre32-legacy-superset", journalIdentity: "source-ordinal-name-checksum-state-1-through-31",
    lockState: "released-at-return", legacyCensus, activeRows, bindingRows, quarantinedRuntimeSessionCount: 0 }, "snapshotHash");
}
function physical() {
  return sealed({ schema: "setfarm.internal-production-positive-worktree-physical-catalog.v2", status: "unresolved",
    observerPidExcluded: 1234, entries: Object.freeze([]), absentBases: Object.freeze([]), incidentalFiles: Object.freeze([]),
    blockers: Object.freeze([Object.freeze({ root: "/runtime/one", reason: "prunable-git-worktree" })]) }, "catalogHash");
}
function writer(role = "fixture") {
  return sealed({ schema: "setfarm.internal-production-task6a-writer-database-snapshot.v2", authority: "diagnostic-only",
    temporalScope: "catalog-snapshot-and-live-session-sample", cutoverAdmission: "not-granted",
    physicalIdentityProvenance: "unverified", database: Object.freeze({ databaseName: "setfarm", databaseOwnerRole: role,
      sessionRole: role, effectiveRole: role, login: true, superuser: true, bypassRls: true,
      createRole: true, createDatabase: true, otherSessionCount: 1 }) }, "snapshotHash");
}
function mission(role = "fixture") {
  return sealed({ schema: "setfarm.internal-production-task6a-mission-control-launcher.v2", authority: "diagnostic-only",
    cutoverAdmission: "not-granted", physicalIdentityProvenance: "unverified", label: "com.setrox.mission-control",
    state: "running", activeCount: 1, databaseRole: role }, "observationHash");
}
function inventory() {
  return sealed({ schema: "setfarm.internal-production-task6a-private-catalog-inventory.v3",
    authority: "diagnostic-only", cutoverAdmission: "not-granted", physicalIdentityProvenance: "unverified",
    catalogScope: "selected-explicit-acl-and-direct-membership-rows-not-permission-proof",
    databaseName: "setfarm", serverVersion: 170010,
    counts: Object.freeze({ object: 2, explicitAclObject: 1, defaultAcl: 0, directMembership: 1,
      publicAclObject: 1, publicDefaultAcl: 0 }), detailHash: "a".repeat(64) }, "diagnosticHash");
}
function harness(options: { inventoryFault?: "hash" | "private" | "count" | "database";
  callbackCount?: number; closeFault?: boolean; earlyPhysicalReturn?: boolean;
  lateCallback?: boolean; holdV3?: boolean } = {}) {
  const events: string[] = [];
  let releaseV3 = () => {};
  let markV3Started = () => {};
  const heldV3 = new Promise<void>(resolve => { releaseV3 = resolve; });
  const v3Started = new Promise<void>(resolve => { markV3Started = resolve; });
  let lateBetween: (() => Promise<void>) | undefined;
  const setfarm = { observation: Object.freeze({ launchers: Object.freeze([
      Object.freeze({ label: "com.setrox.setfarm-spawner" }), Object.freeze({ label: "com.setrox.setfarm-dashboard" })]) }),
    async qualifyPassiveHome() { events.push("qualify"); }, recheck() { events.push("setfarm-check"); },
    async censusAndBindingRowsV7() { events.push("v7"); return database(); },
    async observeTask6aWriterDatabaseSnapshotV2() { events.push("writer"); return writer(); },
    async observeTask6aPrivateCatalogInventoryV3() {
      events.push("v3"); markV3Started(); if (options.holdV3) await heldV3;
      const value = inventory();
      if (options.inventoryFault === "hash") return Object.freeze({ ...value, diagnosticHash: "0".repeat(64) });
      if (options.inventoryFault === "private") return Object.freeze({ ...value, aclText: "PRIVATE_ACL" });
      const { diagnosticHash: _ignored, ...body } = value;
      if (options.inventoryFault === "count") return sealed({ ...body, counts: Object.freeze({ ...value.counts,
        publicAclObject: 2 }) }, "diagnosticHash");
      if (options.inventoryFault === "database") return sealed({ ...body, databaseName: "other" }, "diagnosticHash");
      return value;
    },
    close() { events.push("setfarm-close"); } };
  const mc = { observation: mission(), recheck() { events.push("mc-check"); },
    close() { events.push("mc-close"); if (options.closeFault) throw Error("PRIVATE_CLOSE"); } };
  const observePhysical = async (between: () => Promise<void>) => {
    events.push("physical-first");
    if (options.lateCallback) {
      lateBetween = between;
      events.push("physical-second"); return physical();
    }
    if (options.earlyPhysicalReturn) {
      const pending = between(); void pending.catch(() => undefined);
      await v3Started;
      events.push("physical-second"); return physical();
    }
    for (let i = 0; i < (options.callbackCount ?? 1); i++) await between();
    events.push("physical-second"); return physical();
  };
  return { setfarm, mc, observePhysical, events, v3Started, releaseV3,
    invokeLateCallback: () => { if (!lateBetween) throw Error("CALLBACK_NOT_CAPTURED"); return lateBetween(); } };
}

test("V3 private inventory is awaited inside held physical interval and never grants admission", async () => {
  const { observeTask6aPrivateCatalogHostWithPortsV3 } = await import(
    "../../src/internal-production/baseline-task6a-private-catalog-host-v3.js");
  const ports = harness();
  const result = await observeTask6aPrivateCatalogHostWithPortsV3(ports as any);
  assert.equal(result.authority, "diagnostic-only");
  assert.equal(result.cutoverAdmission, "not-granted");
  assert.equal(result.physicalIdentityProvenance, "unverified");
  assert.match(result.diagnosticHash, /^[a-f0-9]{64}$/);
  assert.ok(ports.events.indexOf("writer") < ports.events.indexOf("v3"));
  assert.ok(ports.events.indexOf("v3") < ports.events.indexOf("physical-second"));
  assert.deepEqual(ports.events.slice(-2), ["mc-close", "setfarm-close"]);
  assert.equal(JSON.stringify(result).includes("PRIVATE_ACL"), false);
});

for (const [name, options] of [["hash", { inventoryFault: "hash" }],
  ["private field", { inventoryFault: "private" }], ["impossible counts", { inventoryFault: "count" }],
  ["wrong database", { inventoryFault: "database" }], ["duplicate callback", { callbackCount: 2 }],
  ["close uncertainty", { closeFault: true }]] as const) {
  test(`V3 host refuses ${name} and closes holders`, async () => {
    const { observeTask6aPrivateCatalogHostWithPortsV3 } = await import(
      "../../src/internal-production/baseline-task6a-private-catalog-host-v3.js");
    const ports = harness(options);
    await assert.rejects(observeTask6aPrivateCatalogHostWithPortsV3(ports as any),
      /INTERNAL_PRODUCTION_TASK6A_PRIVATE_CATALOG_HOST_INVALID/);
    assert.deepEqual(ports.events.slice(-2), ["mc-close", "setfarm-close"]);
  });
}

test("held method binds private URL role before and after observation without publishing a V3 role", () => {
  const source = fs.readFileSync(new URL(
    "../../src/internal-production/baseline-deployment-cutover-launcher-observation-v1.ts", import.meta.url), "utf8");
  assert.match(source, /observeTask6aPrivateCatalogInventoryV3 = \(missionControl:/);
  assert.match(source, /decodeURIComponent\(new URL\(url\)\.username\)/);
  assert.match(source, /observePrivateV3\(url\)/);
  assert.match(source, /roleAfter !== roleBefore/);
});

test("faulty early physical return retains launcher holders until pending V3 read settles, then refuses", async () => {
  const { observeTask6aPrivateCatalogHostWithPortsV3 } = await import(
    "../../src/internal-production/baseline-task6a-private-catalog-host-v3.js");
  const ports = harness({ earlyPhysicalReturn: true, holdV3: true });
  const running = observeTask6aPrivateCatalogHostWithPortsV3(ports as any);
  const settled = running.then(() => ({ ok: true, error: null }), error => ({ ok: false, error }));
  await ports.v3Started;
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(ports.events.includes("mc-close"), false);
  assert.equal(ports.events.includes("setfarm-close"), false);
  ports.releaseV3();
  const outcome = await settled;
  assert.equal(outcome.ok, false);
  assert.match(String(outcome.error), /INTERNAL_PRODUCTION_TASK6A_PRIVATE_CATALOG_HOST_INVALID/);
  assert.deepEqual(ports.events.slice(-2), ["mc-close", "setfarm-close"]);
});

test("callback invoked after physical return cannot start V7, writer or V3 after holder closure", async () => {
  const { observeTask6aPrivateCatalogHostWithPortsV3 } = await import(
    "../../src/internal-production/baseline-task6a-private-catalog-host-v3.js");
  const ports = harness({ lateCallback: true });
  await assert.rejects(observeTask6aPrivateCatalogHostWithPortsV3(ports as any),
    /INTERNAL_PRODUCTION_TASK6A_PRIVATE_CATALOG_HOST_INVALID/);
  const before = [...ports.events];
  assert.deepEqual(before.slice(-2), ["mc-close", "setfarm-close"]);
  await assert.rejects(ports.invokeLateCallback(), /INTERNAL_PRODUCTION_TASK6A_PRIVATE_CATALOG_HOST_INVALID/);
  assert.deepEqual(ports.events, before);
});
