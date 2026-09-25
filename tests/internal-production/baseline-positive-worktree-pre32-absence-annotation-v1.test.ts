import assert from "node:assert/strict";
import { test } from "node:test";

import { createLegacyFindingPublicationInventoryValueV1 } from "../../src/findings/legacy-finding-publication-inventory-v1.js";
import { hashCanonicalJson } from "../../src/product-compiler/canonical-json.js";
import { observePositiveWorktreePre32AbsenceAnnotationWithPortsV1 } from "../../src/internal-production/baseline-positive-worktree-pre32-absence-annotation-v1.js";

const base = "/Users/setrox/.openclaw/workspaces/workflows/feature-dev/agents/developer/story-worktrees";

function physical(blockers: readonly Readonly<{ root: string; reason: string }>[], absentBases = [base]) {
  const body = Object.freeze({
    schema: "setfarm.internal-production-positive-worktree-physical-catalog.v2" as const,
    status: "unresolved" as const, observerPidExcluded: 1234,
    entries: Object.freeze([]), absentBases: Object.freeze(absentBases),
    incidentalFiles: Object.freeze([]),
    blockers: Object.freeze(blockers.map((blocker) => Object.freeze({ ...blocker }))),
  });
  return Object.freeze({ ...body, catalogHash: hashCanonicalJson(body) });
}

function database() {
  const activeBody = Object.freeze({
    schema: "setfarm.internal-production-positive-worktree-active-rows.v2" as const,
    authority: "diagnostic-only" as const, physicalIdentityProvenance: "unverified" as const,
    activeRuns: Object.freeze([]), openClaims: Object.freeze([]),
    activeAttempts: Object.freeze([]), activeSessions: Object.freeze([]),
    counts: Object.freeze({ runCount: 0, claimCount: 0, attemptCount: 0, sessionCount: 0 }),
  });
  const activeRows = Object.freeze({ ...activeBody, snapshotHash: hashCanonicalJson(activeBody) });
  const bindingBody = Object.freeze({
    schema: "setfarm.internal-production-positive-worktree-binding-rows.v1" as const,
    authority: "diagnostic-only" as const, physicalIdentityProvenance: "unverified" as const,
    activeAttempts: Object.freeze([]), activeSessions: Object.freeze([]),
    counts: Object.freeze({ attemptCount: 0, sessionCount: 0 }),
  });
  const bindingRows = Object.freeze({ ...bindingBody, snapshotHash: hashCanonicalJson(bindingBody) });
  const legacyCensus = Object.freeze({ activeRunCount: 0, openClaimCount: 0,
    executionAttemptCount: 0, activeRuntimeSessionCount: 0, activeCompletionOwnerCount: 0,
    unsettledMandatoryEffectCount: 0, artifactReservationCount: 0, publicationBatchCount: 0,
    artifactPublicationCount: 0, terminationOwnerCount: 0, findingOwnerCount: 0,
    recoveryOwnerCount: 0, operationalDeliveryCount: 0,
    legacyFindingPublicationInventory: createLegacyFindingPublicationInventoryValueV1([]) });
  const body = Object.freeze({ schema: "setfarm.internal-production-pre32-active-binding-snapshot.v6" as const,
    authority: "diagnostic-only" as const, legacyCensus, activeRows, bindingRows,
    quarantinedRuntimeSessionCount: 0 });
  return Object.freeze({ ...body, snapshotHash: hashCanonicalJson(body) });
}

test("annotates only direct-child absent Git records in the exact V6 held interval", async () => {
  const events: string[] = [];
  const catalog = physical([
    { root: `${base}/a`, reason: "prunable-git-worktree" },
    { root: `${base}/nested/b`, reason: "prunable-git-worktree" },
    { root: `${base}/c`, reason: "non-git-worktree" },
  ]);
  const result = await observePositiveWorktreePre32AbsenceAnnotationWithPortsV1(
    async (betweenPasses) => { events.push("physical-first"); await betweenPasses();
      events.push("physical-second"); return catalog; },
    async () => { events.push("database"); return database(); },
  );
  assert.deepEqual(events, ["physical-first", "database", "physical-second"]);
  assert.equal(result.authority, "diagnostic-only");
  assert.deepEqual(result.witnessedBlockers, [catalog.blockers[0]]);
  assert.deepEqual(result.remainingBlockers, catalog.blockers.slice(1));
  assert.equal(result.sourcePair.heldPair.physicalCatalog, catalog);
  assert.equal(result.sourcePair.heldPair.physicalCatalog.blockers.length, 3);
  assert.equal(result.witness.hostPair, result.sourcePair.heldPair);
  assert.equal("zeroOwner" in result, false);
  assert.equal("cutoverReady" in result, false);
  assert.equal("receipt" in result, false);
  const { annotationHash, ...body } = result;
  assert.equal(annotationHash, hashCanonicalJson(body));
  assert.equal(Object.isFrozen(result), true);
  assert.equal(Object.isFrozen(result.witnessedBlockers), true);
  assert.equal(Object.isFrozen(result.remainingBlockers), true);
});

test("a prunable record without its own bracketed absent base remains a blocker", async () => {
  const catalog = physical([{ root: `${base}/a`, reason: "prunable-git-worktree" }], []);
  const result = await observePositiveWorktreePre32AbsenceAnnotationWithPortsV1(
    async (betweenPasses) => { await betweenPasses(); return catalog; }, async () => database());
  assert.deepEqual(result.witnessedBlockers, []);
  assert.deepEqual(result.remainingBlockers, catalog.blockers);
  assert.equal(result.witness.unwitnessedPrunableCount, 1);
});

test("duplicate source records remain visible without multiplying unique absent roots", async () => {
  const root = `${base}/a`;
  const catalog = physical([
    { root, reason: "prunable-git-worktree" }, { root, reason: "prunable-git-worktree" },
  ]);
  const result = await observePositiveWorktreePre32AbsenceAnnotationWithPortsV1(
    async (betweenPasses) => { await betweenPasses(); return catalog; }, async () => database());
  assert.equal(result.witness.witnesses.length, 1);
  assert.equal(result.witnessedBlockers.length, 2);
  assert.equal(result.sourcePair.heldPair.physicalCatalog.blockers.length, 2);
});

test("invalid V6 snapshot, physical failure and DB failure refuse without an annotation", async () => {
  const catalog = physical([{ root: `${base}/a`, reason: "prunable-git-worktree" }]);
  const physicalPort = async (betweenPasses: () => Promise<void>) => {
    await betweenPasses(); return catalog;
  };
  const good = database();
  const wrongCensus = Object.freeze({ ...good.legacyCensus, activeRunCount: 1 });
  const badBody = Object.freeze({ schema: good.schema, authority: good.authority,
    legacyCensus: wrongCensus, activeRows: good.activeRows, bindingRows: good.bindingRows,
    quarantinedRuntimeSessionCount: 0 });
  const bad = Object.freeze({ ...badBody, snapshotHash: hashCanonicalJson(badBody) });
  await assert.rejects(observePositiveWorktreePre32AbsenceAnnotationWithPortsV1(
    physicalPort, async () => bad), /INTERNAL_PRODUCTION_POSITIVE_WORKTREE_PRE32_HOST_PAIR_INVALID/);
  const crossedBindingBody = Object.freeze({ ...good.bindingRows,
    counts: Object.freeze({ attemptCount: 1, sessionCount: 0 }) });
  const { snapshotHash: _oldBindingHash, ...crossedBindingWithoutHash } = crossedBindingBody;
  const crossedBinding = Object.freeze({ ...crossedBindingWithoutHash,
    snapshotHash: hashCanonicalJson(crossedBindingWithoutHash) });
  const crossedBody = Object.freeze({ schema: good.schema, authority: good.authority,
    legacyCensus: good.legacyCensus, activeRows: good.activeRows, bindingRows: crossedBinding,
    quarantinedRuntimeSessionCount: 0 });
  const crossed = Object.freeze({ ...crossedBody, snapshotHash: hashCanonicalJson(crossedBody) });
  await assert.rejects(observePositiveWorktreePre32AbsenceAnnotationWithPortsV1(
    physicalPort, async () => crossed), /INTERNAL_PRODUCTION_POSITIVE_WORKTREE_PRE32_HOST_PAIR_INVALID/);
  await assert.rejects(observePositiveWorktreePre32AbsenceAnnotationWithPortsV1(
    async () => { throw new Error("physical-failed"); }, async () => good),
  /physical-failed/);
  await assert.rejects(observePositiveWorktreePre32AbsenceAnnotationWithPortsV1(
    async (betweenPasses) => { await betweenPasses(); throw new Error("absent-base-drift"); },
    async () => good), /absent-base-drift/);
  await assert.rejects(observePositiveWorktreePre32AbsenceAnnotationWithPortsV1(
    physicalPort, async () => { throw new Error("database-failed"); }),
  /database-failed/);
});
