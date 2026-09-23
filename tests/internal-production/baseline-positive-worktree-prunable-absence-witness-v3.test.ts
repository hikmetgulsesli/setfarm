import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { test } from "node:test";

import { hashCanonicalJson } from "../../src/product-compiler/canonical-json.js";
import { projectPositiveWorktreePrunableAbsenceWitnessV3 } from "../../src/internal-production/baseline-positive-worktree-prunable-absence-witness-v3.js";

const base = "/Users/setrox/.openclaw/workspaces/workflows/feature-dev/agents/developer/story-worktrees";
type Blocker = Readonly<{ root: string; reason: string }>;

function makeCatalog(blockers: readonly Blocker[], absentBases: readonly string[] = [base]) {
  const body = Object.freeze({
    schema: "setfarm.internal-production-positive-worktree-physical-catalog.v2" as const,
    status: "unresolved" as const,
    observerPidExcluded: 1234,
    entries: Object.freeze([]),
    absentBases: Object.freeze([...absentBases]),
    incidentalFiles: Object.freeze([]),
    blockers: Object.freeze(blockers.map((blocker) => Object.freeze({ ...blocker }))),
  });
  return Object.freeze({ ...body, catalogHash: hashCanonicalJson(body) });
}

function makeDatabase() {
  const body = Object.freeze({
    schema: "setfarm.internal-production-positive-worktree-active-rows.v2" as const,
    authority: "diagnostic-only" as const,
    physicalIdentityProvenance: "unverified" as const,
    activeRuns: Object.freeze([]), openClaims: Object.freeze([]),
    activeAttempts: Object.freeze([]), activeSessions: Object.freeze([]),
    counts: Object.freeze({ runCount: 0, claimCount: 0, attemptCount: 0, sessionCount: 0 }),
  });
  return Object.freeze({ ...body, snapshotHash: hashCanonicalJson(body) });
}

function makePair(blockers: readonly Blocker[], absentBases?: readonly string[]) {
  const body = Object.freeze({
    schema: "setfarm.internal-production-positive-worktree-host-pair.v2" as const,
    authority: "diagnostic-only" as const,
    physicalIdentityProvenance: "unverified" as const,
    physicalCatalog: makeCatalog(blockers, absentBases),
    databaseSnapshot: makeDatabase(),
  });
  return Object.freeze({ ...body, pairHash: hashCanonicalJson(body) });
}

function blocker(root: string, reason = "prunable-git-worktree"): Blocker { return { root, reason }; }

test("witnesses only direct children in held absent bases, preserving every V2 blocker", () => {
  const pair = makePair([
    blocker(`${base}/z`), blocker(`${base}/a`), blocker(`${base}/a`),
    blocker(`${base}/nested/deeper`), blocker(`${base}-sibling/x`),
    blocker(`${base}/wrong`, "listed-outside-scope"),
  ]);
  const result = projectPositiveWorktreePrunableAbsenceWitnessV3(pair);
  assert.equal(result.schema, "setfarm.internal-production-prunable-absence-witness.v3");
  assert.equal(result.authority, "diagnostic-only");
  assert.equal(result.temporalScope, "v2-bracketed-two-pass");
  assert.equal(result.hostPair, pair);
  assert.equal(result.sourcePairHash, pair.pairHash);
  assert.equal(result.sourceCatalogHash, pair.physicalCatalog.catalogHash);
  assert.deepEqual(result.witnesses, [
    { root: `${base}/a`, absentBase: base },
    { root: `${base}/z`, absentBase: base },
  ]);
  assert.equal(result.unwitnessedPrunableCount, 2);
  assert.equal(result.hostPair.physicalCatalog.status, "unresolved");
  assert.equal(result.hostPair.physicalCatalog.blockers.length, 6);
  assert.equal(Object.isFrozen(result), true);
  assert.equal(Object.isFrozen(result.witnesses), true);
  assert.equal(Object.isFrozen(result.witnesses[0]), true);
  const { witnessHash, ...body } = result;
  assert.equal(witnessHash, hashCanonicalJson(body));
  assert.notEqual(projectPositiveWorktreePrunableAbsenceWitnessV3(makePair([
    blocker(`${base}/different`),
  ])).witnessHash, result.witnessHash);
});

test("an absent base never implies descendants outside that base or a current-time claim", () => {
  const result = projectPositiveWorktreePrunableAbsenceWitnessV3(makePair([
    blocker(`${base}/nested/deeper`), blocker(`${base}-sibling/x`),
  ]));
  assert.deepEqual(result.witnesses, []);
  assert.equal(result.unwitnessedPrunableCount, 2);
  assert.equal("zeroOwner" in result, false);
  assert.equal("cutoverReady" in result, false);
  assert.equal("currentlyAbsent" in result, false);
});

test("false hashes and malformed V2 labels refuse, including internally rehashed malformed paths", () => {
  const pair = makePair([blocker(`${base}/ok`)]);
  assert.throws(() => projectPositiveWorktreePrunableAbsenceWitnessV3(Object.freeze({ ...pair,
    pairHash: "a".repeat(64) })), /PRUNABLE_ABSENCE_WITNESS_INVALID/);
  const falseCatalog = Object.freeze({ ...pair.physicalCatalog, catalogHash: "b".repeat(64) });
  const falseBody = Object.freeze({ schema: pair.schema, authority: pair.authority,
    physicalIdentityProvenance: pair.physicalIdentityProvenance,
    physicalCatalog: falseCatalog, databaseSnapshot: pair.databaseSnapshot });
  assert.throws(() => projectPositiveWorktreePrunableAbsenceWitnessV3(Object.freeze({ ...falseBody,
    pairHash: hashCanonicalJson(falseBody) })), /PRUNABLE_ABSENCE_WITNESS_INVALID/);
  const badPair = makePair([blocker(`${base}/../alias`)]);
  assert.throws(() => projectPositiveWorktreePrunableAbsenceWitnessV3(badPair), /PRUNABLE_ABSENCE_WITNESS_INVALID/);
  const badLabelBody = Object.freeze({ schema: pair.schema, authority: "cutover" as const,
    physicalIdentityProvenance: pair.physicalIdentityProvenance,
    physicalCatalog: pair.physicalCatalog, databaseSnapshot: pair.databaseSnapshot });
  assert.throws(() => projectPositiveWorktreePrunableAbsenceWitnessV3(Object.freeze({ ...badLabelBody,
    pairHash: hashCanonicalJson(badLabelBody) })), /PRUNABLE_ABSENCE_WITNESS_INVALID/);
});

test("mutable, accessor, proxy, and duplicate absent bases refuse", () => {
  const pair = makePair([blocker(`${base}/ok`)]);
  const mutable = { ...pair, physicalCatalog: { ...pair.physicalCatalog } };
  assert.throws(() => projectPositiveWorktreePrunableAbsenceWitnessV3(mutable), /PRUNABLE_ABSENCE_WITNESS_INVALID/);
  const accessor = Object.freeze(Object.defineProperty({ ...pair }, "pairHash", {
    enumerable: true, get() { throw new Error("accessor evaluated"); },
  }));
  assert.throws(() => projectPositiveWorktreePrunableAbsenceWitnessV3(accessor), /PRUNABLE_ABSENCE_WITNESS_INVALID/);
  assert.throws(() => projectPositiveWorktreePrunableAbsenceWitnessV3(new Proxy(pair, {})), /PRUNABLE_ABSENCE_WITNESS_INVALID/);
  assert.throws(() => projectPositiveWorktreePrunableAbsenceWitnessV3(makePair([
    blocker(`${base}/ok`),
  ], [base, base])), /PRUNABLE_ABSENCE_WITNESS_INVALID/);
});

test("1,024 blockers are retained; 1,025 refuse instead of truncating", () => {
  const blockers = Array.from({ length: 1025 }, (_, index) => blocker(`${base}/item-${index}`));
  const result = projectPositiveWorktreePrunableAbsenceWitnessV3(makePair(blockers.slice(0, 1024)));
  assert.equal(result.witnesses.length, 1024);
  assert.equal(result.hostPair.physicalCatalog.blockers.length, 1024);
  assert.throws(() => projectPositiveWorktreePrunableAbsenceWitnessV3(makePair(blockers)),
    /PRUNABLE_ABSENCE_WITNESS_INVALID/);
});

test("pure projector import does not load runtime configuration", () => {
  const script = `const before = JSON.stringify(Object.keys(process.env).sort().map(k => [k, process.env[k]]));
    await import("./src/internal-production/baseline-positive-worktree-prunable-absence-witness-v3.js");
    const after = JSON.stringify(Object.keys(process.env).sort().map(k => [k, process.env[k]]));
    process.exitCode = before === after ? 0 : 91;`;
  const result = spawnSync(process.execPath, ["--import", "tsx", "--input-type=module", "-e",
    script],
  { cwd: process.cwd(), env: { ...process.env, PATH: "/usr/bin:/bin" }, encoding: "utf8", timeout: 10_000 });
  assert.equal(result.status, 0, result.stderr);
});
