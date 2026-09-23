import assert from "node:assert/strict";
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
