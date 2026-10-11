import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import cp from "node:child_process";
import { syncBuiltinESMExports } from "node:module";

// Real source consumer, no caller-port substitute or native/job authority.
// A foreign scope must never start command/FS work or inspect proxy properties.
test("launcher quiet foreign scopes refuse before commands or caller traps", async () => {
  const module = await import("../../src/internal-production/baseline-deployment-cutover-launcher-observation-v1.js");
  const names = ["observeHeldDashboardCutoverApprovedDefinitionQuietV4",
    "bootoutHeldDashboardCutoverApprovedDefinitionSpawnerV4",
    "bootoutHeldDashboardCutoverApprovedDefinitionDashboardV4"] as const;
  const exports = module as unknown as Record<string, (...args: unknown[]) => Promise<unknown>>;
  assert.deepEqual(names.map(name => typeof exports[name]), ["function", "function", "function"],
    "MISSING_LAUNCHER_QUIET_INTERFACES");
  let traps = 0, ports = 0;
  const proxy = new Proxy({}, { get() { traps++; throw Error("TRAP"); },
    getPrototypeOf() { traps++; throw Error("TRAP"); }, ownKeys() { traps++; throw Error("TRAP"); } });
  const spawn = cp.spawn, spawnSync = cp.spawnSync, open = fs.openSync;
  try {
    cp.spawn = (() => { ports++; throw Error("FORBIDDEN_QUIET_COMMAND"); }) as typeof cp.spawn;
    cp.spawnSync = (() => { ports++; throw Error("FORBIDDEN_QUIET_COMMAND"); }) as typeof cp.spawnSync;
    fs.openSync = (() => { ports++; throw Error("FORBIDDEN_QUIET_FS"); }) as typeof fs.openSync;
    syncBuiltinESMExports();
    for (const name of names) for (const args of [[], [{}], [proxy], [proxy, {}]])
      await assert.rejects(() => exports[name]!(...args));
    assert.equal(traps, 0);assert.equal(ports, 0);
  } finally {
    cp.spawn = spawn;cp.spawnSync = spawnSync;fs.openSync = open;syncBuiltinESMExports();
  }
});
