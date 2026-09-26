import assert from "node:assert/strict";
import { test } from "node:test";

import { hashCanonicalJson } from "../../src/product-compiler/canonical-json.js";
import { createLegacyFindingPublicationInventoryValueV1 } from "../../src/findings/legacy-finding-publication-inventory-v1.js";
import { observeTask6aWriterCatalogHostWithPortsV2 } from "../../src/internal-production/baseline-task6a-writer-catalog-host-v2.js";

function sealed<T extends object>(body: T, key: string): T & Record<string, string> {
  return Object.freeze({ ...body, [key]: hashCanonicalJson(body) });
}
function database() {
  const activeRows = sealed({ schema: "setfarm.internal-production-positive-worktree-active-rows.v2",
    authority: "diagnostic-only", physicalIdentityProvenance: "unverified",
    activeRuns: Object.freeze([]), openClaims: Object.freeze([]), activeAttempts: Object.freeze([]),
    activeSessions: Object.freeze([]), counts: Object.freeze({ runCount: 0, claimCount: 0, attemptCount: 0, sessionCount: 0 }) }, "snapshotHash");
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
    observerPidExcluded: 1234, entries: Object.freeze([]), absentBases: Object.freeze([]),
    incidentalFiles: Object.freeze([]), blockers: Object.freeze([Object.freeze({ root: "/runtime/one", reason: "prunable-git-worktree" })]) }, "catalogHash");
}
function writer(role = "fixture") {
  return sealed({ schema: "setfarm.internal-production-task6a-writer-database-snapshot.v2", authority: "diagnostic-only",
    temporalScope: "catalog-snapshot-and-live-session-sample", cutoverAdmission: "not-granted",
    physicalIdentityProvenance: "unverified", database: Object.freeze({ databaseName: "setfarm", databaseOwnerRole: role,
      sessionRole: role, effectiveRole: role, login: true, superuser: true, bypassRls: true,
      createRole: true, createDatabase: true, otherSessionCount: 1 }) }, "snapshotHash");
}
function catalog(role = "fixture") {
  const counts = Object.freeze(Object.fromEntries(["directMembership", "directInherit", "directSet", "directAdmin",
    "schema", "ownedSchema", "relation", "ownedRelation", "sequence", "ownedSequence", "routine", "ownedRoutine",
    "securityDefinerRoutine", "selectedExplicitAclRow", "defaultAcl", "ownedDefaultAcl"].map(key => [key, 0])));
  return sealed({ schema: "setfarm.internal-production-task6a-writer-catalog-topology.v2", authority: "diagnostic-only",
    cutoverAdmission: "not-granted", physicalIdentityProvenance: "unverified", temporalScope: "catalog-transaction-snapshot",
    membershipScope: "direct-only-non-transitive", catalogScope: "coarse-selected-catalog-row-counts-not-permission-proof",
    databaseName: "setfarm", sessionRole: role, serverVersion: 170006, counts }, "topologyHash");
}
function mission(role = "fixture") {
  return sealed({ schema: "setfarm.internal-production-task6a-mission-control-launcher.v2", authority: "diagnostic-only",
    cutoverAdmission: "not-granted", physicalIdentityProvenance: "unverified", label: "com.setrox.mission-control",
    state: "running", activeCount: 1, databaseRole: role }, "observationHash");
}
function harness(options: { catalogRole?: string; catalogHashFault?: boolean; callbackCount?: number; closeFault?: boolean } = {}) {
  const events: string[] = [];
  const setfarm = { observation: Object.freeze({ launchers: Object.freeze([
      Object.freeze({ label: "com.setrox.setfarm-spawner" }), Object.freeze({ label: "com.setrox.setfarm-dashboard" })]) }),
    async qualifyPassiveHome() { events.push("qualify"); }, recheck() { events.push("setfarm-check"); },
    async censusAndBindingRowsV7() { events.push("v7"); return database(); },
    async observeTask6aWriterDatabaseSnapshotV2() { events.push("writer"); return writer(); },
    async observeTask6aWriterCatalogTopologyV2() {
      events.push("catalog");const value = catalog(options.catalogRole);
      return options.catalogHashFault ? Object.freeze({ ...value, topologyHash: "0".repeat(64) }) : value;
    },
    close() { events.push("setfarm-close"); } };
  const mc = { observation: mission(), recheck() { events.push("mc-check"); },
    close() { events.push("mc-close");if (options.closeFault) throw Error("PRIVATE_CLOSE"); } };
  const observePhysical = async (between: () => Promise<void>) => {
    events.push("physical-first");for (let i = 0; i < (options.callbackCount ?? 1); i++) await between();
    events.push("physical-second");return physical();
  };
  return { setfarm, mc, observePhysical, events };
}

test("catalog observation is awaited inside held physical interval and never grants cutover", async () => {
  const ports = harness();
  const result = await observeTask6aWriterCatalogHostWithPortsV2(ports as any);
  assert.equal(result.authority, "diagnostic-only");
  assert.equal(result.cutoverAdmission, "not-granted");
  assert.equal(result.writerCatalogTopologyV2.sessionRole, "fixture");
  assert.match(result.diagnosticHash, /^[a-f0-9]{64}$/);
  assert.ok(ports.events.indexOf("writer") < ports.events.indexOf("catalog"));
  assert.ok(ports.events.indexOf("catalog") < ports.events.indexOf("physical-second"));
  assert.deepEqual(ports.events.slice(-2), ["mc-close", "setfarm-close"]);
});

for (const [name, options] of [["crossed role", { catalogRole: "other" }],
  ["hash fault", { catalogHashFault: true }], ["duplicate callback", { callbackCount: 2 }],
  ["uncertain cleanup", { closeFault: true }]] as const) {
  test(`catalog host refuses ${name} and closes holders`, async () => {
    const ports = harness(options);
    await assert.rejects(observeTask6aWriterCatalogHostWithPortsV2(ports as any),
      /INTERNAL_PRODUCTION_TASK6A_WRITER_CATALOG_HOST_INVALID/);
    assert.deepEqual(ports.events.slice(-2), ["mc-close", "setfarm-close"]);
  });
}
