import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { test } from "node:test";

import { hashCanonicalJson } from "../../src/product-compiler/canonical-json.js";
import { observePositiveWorktreeHostPairWithPortsV2 } from "../../src/internal-production/baseline-positive-worktree-host-pair-v2.js";

function catalog(blockedRoot: string) {
  const body = Object.freeze({
    schema: "setfarm.internal-production-positive-worktree-physical-catalog.v2" as const,
    status: "unresolved" as const,
    observerPidExcluded: 1234,
    entries: Object.freeze([]),
    absentBases: Object.freeze([]),
    incidentalFiles: Object.freeze([]),
    blockers: Object.freeze([Object.freeze({ root: blockedRoot, reason: "prunable-git-worktree" })]),
  });
  return Object.freeze({ ...body, catalogHash: hashCanonicalJson(body) });
}

function database() {
  const body = Object.freeze({
    schema: "setfarm.internal-production-positive-worktree-active-rows.v2" as const,
    authority: "diagnostic-only" as const,
    physicalIdentityProvenance: "unverified" as const,
    activeRuns: Object.freeze([]),
    openClaims: Object.freeze([]),
    activeAttempts: Object.freeze([]),
    activeSessions: Object.freeze([]),
    counts: Object.freeze({ runCount: 0, claimCount: 0, attemptCount: 0, sessionCount: 0 }),
  });
  return Object.freeze({ ...body, snapshotHash: hashCanonicalJson(body) });
}

test("database evidence is captured inside the held physical interval without hiding unresolved blockers", async () => {
  const events: string[] = [];
  let databaseCalls = 0;
  const physical = catalog("/Users/setrox/projects/example/.worktrees/missing");
  const rows = database();
  const pair = await observePositiveWorktreeHostPairWithPortsV2(async (betweenPasses) => {
    events.push("physical-first");
    await betweenPasses();
    events.push("physical-second");
    return physical;
  }, async () => {
    databaseCalls += 1;
    events.push("database");
    return rows;
  });
  assert.deepEqual(events, ["physical-first", "database", "physical-second"]);
  assert.equal(databaseCalls, 1);
  assert.equal(pair.schema, "setfarm.internal-production-positive-worktree-host-pair.v2");
  assert.equal(pair.authority, "diagnostic-only");
  assert.equal(pair.physicalIdentityProvenance, "unverified");
  assert.equal(pair.physicalCatalog, physical);
  assert.equal(pair.databaseSnapshot, rows);
  assert.deepEqual(pair.physicalCatalog.blockers, [
    { root: "/Users/setrox/projects/example/.worktrees/missing", reason: "prunable-git-worktree" },
  ]);
  assert.deepEqual(pair.databaseSnapshot.counts, { runCount: 0, claimCount: 0, attemptCount: 0, sessionCount: 0 });
  assert.match(pair.pairHash, /^[a-f0-9]{64}$/);
  assert.equal(Object.isFrozen(pair), true);

  const changed = await observePositiveWorktreeHostPairWithPortsV2(async (betweenPasses) => {
    await betweenPasses();
    return catalog("/Users/setrox/projects/example/.worktrees/another-missing");
  }, async () => database());
  assert.notEqual(pair.pairHash, changed.pairHash);
});

test("a second callback cannot produce a pair with two database epochs", async () => {
  let calls = 0;
  await assert.rejects(observePositiveWorktreeHostPairWithPortsV2(async (betweenPasses) => {
    await betweenPasses();
    await betweenPasses();
    return catalog("/missing");
  }, async () => { calls += 1; return database(); }),
  /INTERNAL_PRODUCTION_POSITIVE_WORKTREE_HOST_PAIR_INVALID/);
  assert.equal(calls, 1);
});

test("a physical observer cannot swallow a duplicate callback error and return a pair", async () => {
  await assert.rejects(observePositiveWorktreeHostPairWithPortsV2(async (betweenPasses) => {
    await betweenPasses();
    try { await betweenPasses(); } catch { /* Simulate an observer swallowing a callback error. */ }
    return catalog("/missing");
  }, async () => database()), /INTERNAL_PRODUCTION_POSITIVE_WORKTREE_HOST_PAIR_INVALID/);
});

test("a well-formed but false producer hash cannot be paired", async () => {
  const physical = catalog("/missing");
  await assert.rejects(observePositiveWorktreeHostPairWithPortsV2(async (betweenPasses) => {
    await betweenPasses();
    return Object.freeze({ ...physical, catalogHash: "a".repeat(64) });
  }, async () => database()), /INTERNAL_PRODUCTION_POSITIVE_WORKTREE_HOST_PAIR_INVALID/);
  const rows = database();
  await assert.rejects(observePositiveWorktreeHostPairWithPortsV2(async (betweenPasses) => {
    await betweenPasses();
    return physical;
  }, async () => Object.freeze({ ...rows, snapshotHash: "b".repeat(64) })),
  /INTERNAL_PRODUCTION_POSITIVE_WORKTREE_HOST_PAIR_INVALID/);
});

test("mutable nested producer evidence refuses before pairHash can become stale", async () => {
  const original = catalog("/missing");
  const mutableBlockers = [{ root: "/missing", reason: "prunable-git-worktree" }];
  const body = { schema: original.schema, status: original.status,
    observerPidExcluded: original.observerPidExcluded, entries: original.entries,
    absentBases: original.absentBases, incidentalFiles: original.incidentalFiles,
    blockers: mutableBlockers };
  const mutable = { ...body, catalogHash: hashCanonicalJson(body) };
  await assert.rejects(observePositiveWorktreeHostPairWithPortsV2(async (betweenPasses) => {
    await betweenPasses();
    return mutable;
  }, async () => database()), /INTERNAL_PRODUCTION_POSITIVE_WORKTREE_HOST_PAIR_INVALID/);
});

test("missing callback and early physical return refuse rather than pairing late database rows", async () => {
  await assert.rejects(observePositiveWorktreeHostPairWithPortsV2(async () => catalog("/missing"),
    async () => database()), /INTERNAL_PRODUCTION_POSITIVE_WORKTREE_HOST_PAIR_INVALID/);
  let release: ((value: ReturnType<typeof database>) => void) | undefined;
  const late = new Promise<ReturnType<typeof database>>((resolve) => { release = resolve; });
  await assert.rejects(observePositiveWorktreeHostPairWithPortsV2(async (betweenPasses) => {
    void betweenPasses();
    return catalog("/missing");
  }, async () => late), /INTERNAL_PRODUCTION_POSITIVE_WORKTREE_HOST_PAIR_INVALID/);
  release!(database());
});

test("malformed producer labels and observer errors never become empty evidence", async () => {
  const physical = catalog("/missing");
  await assert.rejects(observePositiveWorktreeHostPairWithPortsV2(async (betweenPasses) => {
    await betweenPasses();
    return Object.freeze({ ...physical, schema: "wrong-schema" as typeof physical.schema });
  }, async () => database()), /INTERNAL_PRODUCTION_POSITIVE_WORKTREE_HOST_PAIR_INVALID/);
  const rows = database();
  await assert.rejects(observePositiveWorktreeHostPairWithPortsV2(async (betweenPasses) => {
    await betweenPasses();
    return physical;
  }, async () => Object.freeze({ ...rows, authority: "cutover" as typeof rows.authority })),
  /INTERNAL_PRODUCTION_POSITIVE_WORKTREE_HOST_PAIR_INVALID/);
  await assert.rejects(observePositiveWorktreeHostPairWithPortsV2(async () => {
    throw new Error("physical-lost");
  }, async () => rows), /physical-lost/);
  await assert.rejects(observePositiveWorktreeHostPairWithPortsV2(async (betweenPasses) => {
    await betweenPasses();
    return physical;
  }, async () => { throw new Error("database-lost"); }), /database-lost/);
});

test("importing the fixture module does not load runtime environment configuration", () => {
  const script = `const before = JSON.stringify(Object.keys(process.env).sort().map(k => [k, process.env[k]]));
    await import("./src/internal-production/baseline-positive-worktree-host-pair-v2.js");
    const after = JSON.stringify(Object.keys(process.env).sort().map(k => [k, process.env[k]]));
    process.exitCode = before === after ? 0 : 91;`;
  const child = spawnSync(process.execPath, ["--import", "tsx", "--input-type=module", "-e", script], {
    cwd: process.cwd(), env: { ...process.env, PATH: "/usr/bin:/bin" }, encoding: "utf8", timeout: 10_000,
  });
  assert.equal(child.status, 0);
});
