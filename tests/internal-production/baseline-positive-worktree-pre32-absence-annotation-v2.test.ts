import assert from "node:assert/strict";
import { test } from "node:test";

import { createLegacyFindingPublicationInventoryValueV1 } from "../../src/findings/legacy-finding-publication-inventory-v1.js";
import { hashCanonicalJson } from "../../src/product-compiler/canonical-json.js";
import { observePositiveWorktreePre32AbsenceAnnotationWithPortsV2 } from "../../src/internal-production/baseline-positive-worktree-pre32-absence-annotation-v2.js";

const base = "/Users/setrox/.openclaw/workspaces/workflows/feature-dev/agents/developer/story-worktrees";

function physical(blockers: readonly Readonly<{ root: string; reason: string }>[], absentBases = [base]) {
  const body = Object.freeze({ schema: "setfarm.internal-production-positive-worktree-physical-catalog.v2" as const,
    status: "unresolved" as const, observerPidExcluded: 1234, entries: Object.freeze([]),
    absentBases: Object.freeze(absentBases), incidentalFiles: Object.freeze([]),
    blockers: Object.freeze(blockers.map(row => Object.freeze({ ...row }))) });
  return Object.freeze({ ...body, catalogHash: hashCanonicalJson(body) });
}

function database() {
  const activeBody = Object.freeze({ schema: "setfarm.internal-production-positive-worktree-active-rows.v2" as const,
    authority: "diagnostic-only" as const, physicalIdentityProvenance: "unverified" as const,
    activeRuns: Object.freeze([]), openClaims: Object.freeze([]), activeAttempts: Object.freeze([]),
    activeSessions: Object.freeze([]),
    counts: Object.freeze({ runCount: 0, claimCount: 0, attemptCount: 0, sessionCount: 0 }) });
  const activeRows = Object.freeze({ ...activeBody, snapshotHash: hashCanonicalJson(activeBody) });
  const bindingBody = Object.freeze({ schema: "setfarm.internal-production-positive-worktree-binding-rows.v1" as const,
    authority: "diagnostic-only" as const, physicalIdentityProvenance: "unverified" as const,
    activeAttempts: Object.freeze([]), activeSessions: Object.freeze([]),
    counts: Object.freeze({ attemptCount: 0, sessionCount: 0 }) });
  const bindingRows = Object.freeze({ ...bindingBody, snapshotHash: hashCanonicalJson(bindingBody) });
  const legacyCensus = Object.freeze({ activeRunCount: 0, openClaimCount: 0,
    executionAttemptCount: 0, activeRuntimeSessionCount: 0, activeCompletionOwnerCount: 0,
    unsettledMandatoryEffectCount: 0, artifactReservationCount: 0, publicationBatchCount: 0,
    artifactPublicationCount: 0, terminationOwnerCount: 0, findingOwnerCount: 0,
    recoveryOwnerCount: 0, operationalDeliveryCount: 0,
    legacyFindingPublicationInventory: createLegacyFindingPublicationInventoryValueV1([]) });
  const body = Object.freeze({ schema: "setfarm.internal-production-pre32-active-binding-snapshot.v7" as const,
    authority: "diagnostic-only" as const, tableLockScope: "fixed-pre32-legacy-superset" as const,
    journalIdentity: "source-ordinal-name-checksum-state-1-through-31" as const,
    lockState: "released-at-return" as const, legacyCensus, activeRows, bindingRows,
    quarantinedRuntimeSessionCount: 0 });
  return Object.freeze({ ...body, snapshotHash: hashCanonicalJson(body) });
}

test("V2 annotates only absent direct-child records in its exact V7 held journal interval", async () => {
  const events: string[] = [];
  const catalog = physical([
    { root: `${base}/a`, reason: "prunable-git-worktree" },
    { root: `${base}/nested/b`, reason: "prunable-git-worktree" },
    { root: `${base}/c`, reason: "non-git-child" },
    { root: `${base}/d`, reason: "git-admin-entry-churn" },
  ]);
  const result = await observePositiveWorktreePre32AbsenceAnnotationWithPortsV2(
    async betweenPasses => { events.push("physical-first"); await betweenPasses();
      events.push("physical-second"); return catalog; },
    async () => { events.push("database"); return database(); });
  assert.deepEqual(events, ["physical-first", "database", "physical-second"]);
  assert.equal(result.schema, "setfarm.internal-production-pre32-absent-git-record-annotation.v2");
  assert.equal(result.authority, "diagnostic-only");
  assert.equal(result.physicalIdentityProvenance, "unverified");
  assert.equal(result.sourcePair.schema, "setfarm.internal-production-pre32-physical-database-pair.v7");
  assert.equal(result.sourcePair.pre32Database.journalIdentity,
    "source-ordinal-name-checksum-state-1-through-31");
  assert.deepEqual(result.witnessedBlockers, [catalog.blockers[0]]);
  assert.deepEqual(result.remainingBlockers, catalog.blockers.slice(1));
  assert.equal(result.witness.hostPair, result.sourcePair.heldPair);
  assert.equal(result.witness.sourceCatalogHash, catalog.catalogHash);
  assert.equal("zeroOwner" in result, false);
  assert.equal("cutoverReady" in result, false);
  const { annotationHash, ...body } = result;
  assert.equal(annotationHash, hashCanonicalJson(body));
  assert.equal(Object.isFrozen(result), true);
});

test("V2 leaves unwitnessed prunable records and duplicate source blockers visible", async () => {
  const root = `${base}/a`;
  const catalog = physical([{ root, reason: "prunable-git-worktree" },
    { root, reason: "prunable-git-worktree" }], []);
  const result = await observePositiveWorktreePre32AbsenceAnnotationWithPortsV2(
    async betweenPasses => { await betweenPasses(); return catalog; }, async () => database());
  assert.equal(result.witness.unwitnessedPrunableCount, 2);
  assert.deepEqual(result.witnessedBlockers, []);
  assert.deepEqual(result.remainingBlockers, catalog.blockers);
});

test("V2 refuses forged V7 journal, hash, physical drift and DB failure", async () => {
  const catalog = physical([{ root: `${base}/a`, reason: "prunable-git-worktree" }]);
  const physicalPort = async (betweenPasses: () => Promise<void>) => {
    await betweenPasses(); return catalog;
  };
  const good = database();
  const forgedJournalBody = Object.freeze({ ...good, journalIdentity: "unknown" as const });
  const { snapshotHash: _old, ...forgedWithoutHash } = forgedJournalBody;
  const forgedJournal = Object.freeze({ ...forgedWithoutHash, snapshotHash: hashCanonicalJson(forgedWithoutHash) });
  await assert.rejects(observePositiveWorktreePre32AbsenceAnnotationWithPortsV2(
    physicalPort, async () => forgedJournal), /INTERNAL_PRODUCTION_POSITIVE_WORKTREE_PRE32_HOST_PAIR_INVALID/);
  for (const change of [{ authority: "cutover" }, { lockState: "held-after-return" },
    { tableLockScope: "unlocked" }]) {
    const body = { ...good, ...change };
    const { snapshotHash: _ignored, ...withoutHash } = body;
    const forged = Object.freeze({ ...withoutHash, snapshotHash: hashCanonicalJson(withoutHash) });
    await assert.rejects(observePositiveWorktreePre32AbsenceAnnotationWithPortsV2(
      physicalPort, async () => forged as ReturnType<typeof database>),
    /INTERNAL_PRODUCTION_POSITIVE_WORKTREE_PRE32_HOST_PAIR_INVALID/);
  }
  const wrongHash = Object.freeze({ ...good, snapshotHash: "a".repeat(64) });
  await assert.rejects(observePositiveWorktreePre32AbsenceAnnotationWithPortsV2(
    physicalPort, async () => wrongHash), /INTERNAL_PRODUCTION_POSITIVE_WORKTREE_PRE32_HOST_PAIR_INVALID/);
  await assert.rejects(observePositiveWorktreePre32AbsenceAnnotationWithPortsV2(
    async betweenPasses => { await betweenPasses(); throw new Error("physical-second-pass-drift"); },
    async () => good), /physical-second-pass-drift/);
  await assert.rejects(observePositiveWorktreePre32AbsenceAnnotationWithPortsV2(
    physicalPort, async () => { throw new Error("database-failed"); }), /database-failed/);
});
