import assert from "node:assert/strict";
import { test } from "node:test";

import { hashCanonicalJson } from "../../src/product-compiler/canonical-json.js";
import { createLegacyFindingPublicationInventoryValueV1 } from "../../src/findings/legacy-finding-publication-inventory-v1.js";
import { observeTask6aThreeLauncherHostWithPortsV2 } from "../../src/internal-production/baseline-task6a-three-launcher-host-v2.js";

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
function mission(role = "fixture") {
  return sealed({ schema: "setfarm.internal-production-task6a-mission-control-launcher.v2", authority: "diagnostic-only",
    cutoverAdmission: "not-granted", physicalIdentityProvenance: "unverified", label: "com.setrox.mission-control",
    state: "running", activeCount: 1, databaseRole: role }, "observationHash");
}
function harness(options: { role?: string; writerRole?: string; physicalCallbacks?: number; writerHashFault?: boolean;
  mcCloseFailure?: boolean; mcPostcheckFailure?: boolean } = {}) {
  const events: string[] = [];
  const setfarm = {
    observation: Object.freeze({ schema: "setfarm.internal-production-deployment-cutover-default-launcher.v1",
      launchers: Object.freeze([Object.freeze({ label: "com.setrox.setfarm-spawner" }),
        Object.freeze({ label: "com.setrox.setfarm-dashboard" })]) }),
    async qualifyPassiveHome() { events.push("qualify"); },
    recheck() { events.push("setfarm-check"); },
    async censusAndBindingRowsV7() { events.push("v7-database"); return database(); },
    async observeTask6aWriterDatabaseSnapshotV2(holder: { assertSameDatabaseUrl(url: string): string }) {
      events.push("writer-before");assert.equal(holder.assertSameDatabaseUrl("private-url"), options.role ?? "fixture");
      events.push("writer-database");const snapshot = writer(options.writerRole ?? "fixture");
      events.push("writer-after");assert.equal(holder.assertSameDatabaseUrl("private-url"), options.role ?? "fixture");
      return options.writerHashFault ? Object.freeze({ ...snapshot, snapshotHash: "0".repeat(64) }) : snapshot;
    },
    close() { events.push("setfarm-close"); },
  };
  const mc = { observation: mission(options.role), recheck() {
    events.push("mc-check");if (options.mcPostcheckFailure && events.filter(event => event === "mc-check").length === 2)
      throw Error("PRIVATE_MC_DRIFT");
  },
    assertSameDatabaseUrl(_url: string) { events.push("mc-url");return options.role ?? "fixture"; },
    close() { events.push("mc-close");if (options.mcCloseFailure) throw Error("PRIVATE_MC_CLOSE"); } };
  const observePhysical = async (between: () => Promise<void>) => {
    events.push("physical-first");
    for (let index = 0; index < (options.physicalCallbacks ?? 1); index++) await between();
    events.push("physical-second");return physical();
  };
  return { setfarm, mc, observePhysical, events };
}

test("three-launcher diagnostic holds one awaited physical interval and sequential database samples", async () => {
  const ports = harness();
  const result = await observeTask6aThreeLauncherHostWithPortsV2(ports as any);
  assert.equal(result.schema, "setfarm.internal-production-task6a-three-launcher-host.v2");
  assert.equal(result.authority, "diagnostic-only");
  assert.equal(result.cutoverAdmission, "not-granted");
  assert.equal(result.physicalIdentityProvenance, "unverified");
  assert.equal(result.temporalScope, "held-physical-two-pass-sequential-database-samples");
  assert.equal(result.roleAgreement, true);
  assert.equal(result.diagnosticHash, hashCanonicalJson(Object.fromEntries(
    Object.entries(result).filter(([key]) => key !== "diagnosticHash"))));
  assert.ok(ports.events.indexOf("physical-first") < ports.events.indexOf("v7-database"));
  assert.ok(ports.events.indexOf("v7-database") < ports.events.indexOf("writer-database"));
  assert.ok(ports.events.indexOf("writer-database") < ports.events.indexOf("physical-second"));
  assert.deepEqual(ports.events.slice(-2), ["mc-close", "setfarm-close"]);
  assert.doesNotMatch(JSON.stringify(result), /private-url/);
});

for (const [name, options] of [
  ["duplicate physical callback", { physicalCallbacks: 2 }],
  ["missing physical callback", { physicalCallbacks: 0 }],
  ["role disagreement", { writerRole: "other" }],
  ["writer hash fault", { writerHashFault: true }],
  ["Mission Control postcheck drift", { mcPostcheckFailure: true }],
  ["Mission Control uncertain cleanup", { mcCloseFailure: true }],
] as const) {
  test(`three-launcher diagnostic refuses ${name} and closes both holders`, async () => {
    const ports = harness(options);
    await assert.rejects(observeTask6aThreeLauncherHostWithPortsV2(ports as any),
      /INTERNAL_PRODUCTION_TASK6A_THREE_LAUNCHER_HOST_INVALID/);
    assert.deepEqual(ports.events.slice(-2), ["mc-close", "setfarm-close"]);
  });
}
