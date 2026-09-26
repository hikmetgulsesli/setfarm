import assert from "node:assert/strict";
import { test } from "node:test";

import { projectTask6aWriterTopologyPreflightV2 } from "../../src/internal-production/baseline-task6a-writer-topology-preflight-v2.js";

const currentHostShaped = {
  schema: "setfarm.internal-production-task6a-writer-topology-input.v2",
  databaseName: "setfarm",
  databaseOwnerRole: "setrox",
  controllerRole: "postgres",
  runtimeRole: {
    name: "setrox", login: true, superuser: true, bypassRls: true,
    createRole: true, createDatabase: true, activeSessionCount: 1,
  },
  launcherRoles: [
    { label: "com.setrox.setfarm-spawner", role: "setrox" },
    { label: "com.setrox.setfarm-dashboard", role: "setrox" },
    { label: "com.setrox.mission-control", role: "setrox" },
  ],
};

function leastPrivilegeShaped() {
  const value = structuredClone(currentHostShaped);
  value.runtimeRole.name = "setfarm_runtime";
  value.runtimeRole.superuser = false;
  value.runtimeRole.bypassRls = false;
  value.runtimeRole.createRole = false;
  value.runtimeRole.createDatabase = false;
  value.runtimeRole.activeSessionCount = 0;
  for (const launcher of value.launcherRoles) launcher.role = "setfarm_runtime";
  return value;
}

test("current superuser writer topology is blocked without granting cutover admission", () => {
  const result = projectTask6aWriterTopologyPreflightV2(currentHostShaped);
  assert.equal(result.schema, "setfarm.internal-production-task6a-writer-topology-preflight.v2");
  assert.equal(result.authority, "diagnostic-only");
  assert.equal(result.evidenceProvenance, "caller-supplied");
  assert.equal(result.cutoverAdmission, "not-granted");
  assert.equal(result.status, "blocked");
  assert.deepEqual(Object.keys(result), ["schema", "authority", "evidenceProvenance",
    "cutoverAdmission", "status", "blockers", "sourceSnapshotHash", "topologyHash"]);
  assert.deepEqual(result.blockers, [
    "runtime-bypass-rls", "runtime-can-create-database", "runtime-can-create-role",
    "runtime-database-owner", "runtime-session-present", "runtime-superuser",
  ]);
  assert.match(result.sourceSnapshotHash, /^[a-f0-9]{64}$/);
  assert.match(result.topologyHash, /^[a-f0-9]{64}$/);
  assert.ok(Object.isFrozen(result));
  assert.ok(Object.isFrozen(result.blockers));
  assert.equal(JSON.stringify(result).includes("password"), false);
});

test("least-privilege-shaped caller evidence remains unverified rather than ready", () => {
  const result = projectTask6aWriterTopologyPreflightV2(leastPrivilegeShaped());
  assert.equal(result.status, "unverified");
  assert.deepEqual(result.blockers, []);
  assert.equal(result.cutoverAdmission, "not-granted");
  assert.equal(result.evidenceProvenance, "caller-supplied");
  assert.equal(JSON.stringify(result).includes("ready"), false);
});

test("topology hash changes when a validated role identity changes", () => {
  const first = leastPrivilegeShaped();
  const second = structuredClone(first);
  second.controllerRole = "another_admin";
  const left = projectTask6aWriterTopologyPreflightV2(first);
  const right = projectTask6aWriterTopologyPreflightV2(second);
  assert.notEqual(left.sourceSnapshotHash, right.sourceSnapshotHash);
  assert.notEqual(left.topologyHash, right.topologyHash);
});

for (const [name, mutate, expected] of [
  ["launcher role mismatch", (value: any) => { value.launcherRoles[1].role = "other_runtime"; }, "launcher-role-mismatch"],
  ["same controller role", (value: any) => { value.controllerRole = "setfarm_runtime"; }, "runtime-matches-controller"],
  ["RLS bypass", (value: any) => { value.runtimeRole.bypassRls = true; }, "runtime-bypass-rls"],
  ["role creation", (value: any) => { value.runtimeRole.createRole = true; }, "runtime-can-create-role"],
  ["database creation", (value: any) => { value.runtimeRole.createDatabase = true; }, "runtime-can-create-database"],
  ["login absence", (value: any) => { value.runtimeRole.login = false; }, "runtime-no-login"],
] as const) {
  test(`${name} is a writer-fence blocker`, () => {
    const value = leastPrivilegeShaped();
    mutate(value);
    assert.deepEqual(projectTask6aWriterTopologyPreflightV2(value).blockers, [expected]);
  });
}

for (const [name, mutate] of [
  ["wrong database", (value: any) => { value.databaseName = "other"; }],
  ["wrong schema", (value: any) => { value.schema = "v1"; }],
  ["extra top-level field", (value: any) => { value.extra = true; }],
  ["extra runtime role field", (value: any) => { value.runtimeRole.extra = true; }],
  ["invalid role name", (value: any) => { value.runtimeRole.name = "Setrox!"; }],
  ["wrong launcher order", (value: any) => { value.launcherRoles.reverse(); }],
  ["duplicate launcher label", (value: any) => { value.launcherRoles[1].label = value.launcherRoles[0].label; }],
  ["negative session count", (value: any) => { value.runtimeRole.activeSessionCount = -1; }],
  ["fractional session count", (value: any) => { value.runtimeRole.activeSessionCount = 0.5; }],
  ["nonboolean superuser", (value: any) => { value.runtimeRole.superuser = "false"; }],
] as const) {
  test(`${name} refuses ambiguous topology input`, () => {
    const value = structuredClone(currentHostShaped);
    mutate(value);
    assert.throws(() => projectTask6aWriterTopologyPreflightV2(value),
      /^Error: INTERNAL_PRODUCTION_TASK6A_WRITER_TOPOLOGY_INVALID$/);
  });
}

test("proxy and accessor evidence refuse without invoking the getter", () => {
  const value = structuredClone(currentHostShaped);
  let called = false;
  Object.defineProperty(value.runtimeRole, "superuser", {
    enumerable: true,
    get() { called = true; throw new Error("getter evaluated"); },
  });
  assert.throws(() => projectTask6aWriterTopologyPreflightV2(value),
    /^Error: INTERNAL_PRODUCTION_TASK6A_WRITER_TOPOLOGY_INVALID$/);
  assert.equal(called, false);
  assert.throws(() => projectTask6aWriterTopologyPreflightV2(new Proxy(currentHostShaped, {})),
    /^Error: INTERNAL_PRODUCTION_TASK6A_WRITER_TOPOLOGY_INVALID$/);
});
