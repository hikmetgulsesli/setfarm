import assert from "node:assert/strict";
import { test } from "node:test";

import { createLegacyFindingPublicationInventoryValueV1 } from "../../src/findings/legacy-finding-publication-inventory-v1.js";
import { hashCanonicalJson } from "../../src/product-compiler/canonical-json.js";
import { observePositiveWorktreePre32ResidualAbsenceAnnotationWithPortsV3 } from "../../src/internal-production/baseline-positive-worktree-pre32-residual-absence-annotation-v3.js";

const workflow = "/Users/setrox/.openclaw/workspaces/workflows/developer";
const nonGitRoots = [
  "/Users/setrox/ai/setrox/.worktrees/data",
  "/Users/setrox/ai/setrox/.worktrees/test-evidence-data",
  "/Users/setrox/projects/example-project/.worktrees/story-001",
  `${workflow}/story-worktrees/story-002`,
];
const missingAgents = `${workflow}/agents`;
const churn = "/Users/setrox/ai/setrox/.worktrees/selected-historical";
const prunableBase = "/Users/setrox/.openclaw/workspaces/workflows/feature-dev/agents/developer/story-worktrees";
const compareRoot = (left: { root: string }, right: { root: string }) =>
  Buffer.compare(Buffer.from(left.root), Buffer.from(right.root));

function physical(options: { pids?: readonly number[]; missingEntry?: boolean;
  duplicateEntry?: boolean; duplicateBlocker?: boolean; parent?: string;
  wrongZone?: boolean; incidentalBelowParent?: boolean; absentBelowParent?: boolean;
  unsortedEntries?: boolean } = {}) {
  const nonGitEntries = nonGitRoots.filter((_, index) => !(options.missingEntry && index === 2)).map((root, index) =>
    Object.freeze({ root, zone: options.wrongZone && index === 2 ? "retained-zone" as const
      : index < 2 ? "retained-zone" as const : "runtime-zone" as const,
      kind: "unresolved" as const, dev: "1", ino: String(index + 10), birthtimeNs: "2",
      gitPrimaryRoot: null, dirty: null, sourceBuildProvenance: "unverified" as const,
      referencingPids: Object.freeze(index === 2 ? [...options.pids ?? []] : []) }));
  const entries = [...nonGitEntries, Object.freeze({ root: churn, zone: "retained-zone" as const,
    kind: "linked-git" as const, dev: "1", ino: "90", birthtimeNs: "2",
    gitPrimaryRoot: "/Users/setrox/ai/setrox/setfarm", dirty: false,
    sourceBuildProvenance: "unverified" as const, referencingPids: Object.freeze([]) })];
  if (options.duplicateEntry) entries.push(Object.freeze({ ...nonGitEntries[0]! }));
  if (!options.unsortedEntries) entries.sort(compareRoot);
  const blockers = [
    { root: `${prunableBase}/old`, reason: "prunable-git-worktree" },
    ...nonGitRoots.map(root => ({ root, reason: "non-git-child" })),
    { root: options.parent ?? missingAgents, reason: "absent-workflow-agents-discovery-parent" },
    { root: churn, reason: "git-admin-entry-churn" },
  ];
  if (options.duplicateBlocker) blockers.splice(2, 0, { root: nonGitRoots[0]!, reason: "non-git-child" });
  blockers.sort(compareRoot);
  const body = Object.freeze({ schema: "setfarm.internal-production-positive-worktree-physical-catalog.v2" as const,
    status: "unresolved" as const, observerPidExcluded: 1234, entries: Object.freeze(entries),
    absentBases: Object.freeze([prunableBase,
      ...(options.absentBelowParent ? [`${missingAgents}/developer/story-worktrees`] : [])].sort()),
    incidentalFiles: Object.freeze(options.incidentalBelowParent ? [`${missingAgents}/unexpected`] : []),
    blockers: Object.freeze(blockers.map(row => Object.freeze(row))) });
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

test("V3 exposes five bounded residual absences without losing any V7 blocker", async () => {
  const events: string[] = [];
  const catalog = physical();
  const result = await observePositiveWorktreePre32ResidualAbsenceAnnotationWithPortsV3(
    async betweenPasses => { events.push("physical-first"); await betweenPasses();
      events.push("physical-second"); return catalog; },
    async () => { events.push("database"); return database(); });
  assert.deepEqual(events, ["physical-first", "database", "physical-second"]);
  assert.equal(result.schema, "setfarm.internal-production-pre32-residual-absence-annotation.v3");
  assert.equal(result.authority, "diagnostic-only");
  assert.equal(result.physicalIdentityProvenance, "unverified");
  assert.equal(result.temporalScope, "v7-held-two-pass");
  assert.equal(result.sourceAnnotation.sourcePair.pre32Database.journalIdentity,
    "source-ordinal-name-checksum-state-1-through-31");
  assert.deepEqual(result.sourceAnnotation.sourcePair.heldPair.physicalCatalog.blockers, catalog.blockers);
  assert.deepEqual(result.boundedAbsenceBlockers,
    catalog.blockers.filter(blocker => blocker.reason === "non-git-child"
      || blocker.reason === "absent-workflow-agents-discovery-parent"));
  assert.deepEqual(result.otherResidualBlockers,
    catalog.blockers.filter(blocker => blocker.reason === "git-admin-entry-churn"));
  assert.equal("zeroOwner" in result, false);
  assert.equal("cutoverReady" in result, false);
  const { annotationHash, ...body } = result;
  assert.equal(annotationHash, hashCanonicalJson(body));
  assert.equal(Object.isFrozen(result), true);
});

test("V3 keeps a referenced non-Git child unresolved", async () => {
  const catalog = physical({ pids: [481] });
  const result = await observePositiveWorktreePre32ResidualAbsenceAnnotationWithPortsV3(
    async betweenPasses => { await betweenPasses(); return catalog; }, async () => database());
  assert.deepEqual(result.boundedAbsenceBlockers,
    catalog.blockers.filter(blocker => (blocker.reason === "non-git-child"
      && blocker.root !== nonGitRoots[2])
      || blocker.reason === "absent-workflow-agents-discovery-parent"));
  assert.deepEqual(result.otherResidualBlockers,
    catalog.blockers.filter(blocker => blocker.root === nonGitRoots[2]
      || blocker.reason === "git-admin-entry-churn"));
});

test("V3 refuses a rehashed non-Git candidate in the wrong discovery zone", async () => {
  const catalog = physical({ wrongZone: true });
  await assert.rejects(observePositiveWorktreePre32ResidualAbsenceAnnotationWithPortsV3(
    async betweenPasses => { await betweenPasses(); return catalog; }, async () => database()),
  /INTERNAL_PRODUCTION_PRE32_RESIDUAL_ABSENCE_ANNOTATION_V3_INVALID/);
});

test("V3 refuses physically impossible descendants of an absent discovery parent", async () => {
  for (const options of [{ incidentalBelowParent: true }, { absentBelowParent: true }]) {
    const catalog = physical(options);
    await assert.rejects(observePositiveWorktreePre32ResidualAbsenceAnnotationWithPortsV3(
      async betweenPasses => { await betweenPasses(); return catalog; }, async () => database()),
    /INTERNAL_PRODUCTION_PRE32_RESIDUAL_ABSENCE_ANNOTATION_V3_INVALID/);
  }
});

test("V3 refuses a rehashed catalog outside physical producer byte order", async () => {
  const catalog = physical({ unsortedEntries: true });
  await assert.rejects(observePositiveWorktreePre32ResidualAbsenceAnnotationWithPortsV3(
    async betweenPasses => { await betweenPasses(); return catalog; }, async () => database()),
  /INTERNAL_PRODUCTION_PRE32_RESIDUAL_ABSENCE_ANNOTATION_V3_INVALID/);
});

test("V3 refuses malformed process identity rather than annotating it", async () => {
  for (const pids of [[0], [-1], [41, 41], [42, 41]]) {
    const catalog = physical({ pids });
    await assert.rejects(observePositiveWorktreePre32ResidualAbsenceAnnotationWithPortsV3(
      async betweenPasses => { await betweenPasses(); return catalog; }, async () => database()),
    /INTERNAL_PRODUCTION_PRE32_RESIDUAL_ABSENCE_ANNOTATION_V3_INVALID/);
  }
});

test("V3 refuses missing or duplicate child entries and duplicate candidate blockers", async () => {
  for (const options of [{ missingEntry: true }, { duplicateEntry: true },
    { duplicateBlocker: true }]) {
    const catalog = physical(options);
    await assert.rejects(observePositiveWorktreePre32ResidualAbsenceAnnotationWithPortsV3(
      async betweenPasses => { await betweenPasses(); return catalog; }, async () => database()),
    /INTERNAL_PRODUCTION_(?:PRE32_RESIDUAL_ABSENCE_ANNOTATION_V3|POSITIVE_WORKTREE_HOST_PAIR)_INVALID/);
  }
});

test("V3 refuses a parent outside the workflow agents discovery shape", async () => {
  const catalog = physical({ parent: "/Users/setrox/ai/setrox/.worktrees/agents" });
  await assert.rejects(observePositiveWorktreePre32ResidualAbsenceAnnotationWithPortsV3(
    async betweenPasses => { await betweenPasses(); return catalog; }, async () => database()),
  /INTERNAL_PRODUCTION_PRE32_RESIDUAL_ABSENCE_ANNOTATION_V3_INVALID/);
});

test("V3 never repairs forged catalog, physical drift or failed database callback", async () => {
  const catalog = physical();
  await assert.rejects(observePositiveWorktreePre32ResidualAbsenceAnnotationWithPortsV3(
    async betweenPasses => { await betweenPasses();
      return Object.freeze({ ...catalog, catalogHash: "a".repeat(64) }); }, async () => database()),
  /INTERNAL_PRODUCTION_POSITIVE_WORKTREE_HOST_PAIR_INVALID/);
  await assert.rejects(observePositiveWorktreePre32ResidualAbsenceAnnotationWithPortsV3(
    async betweenPasses => { await betweenPasses(); throw new Error("physical-second-pass-drift"); },
    async () => database()), /physical-second-pass-drift/);
  await assert.rejects(observePositiveWorktreePre32ResidualAbsenceAnnotationWithPortsV3(
    async betweenPasses => { await betweenPasses(); return catalog; },
    async () => { throw new Error("database-failed"); }), /database-failed/);
});
