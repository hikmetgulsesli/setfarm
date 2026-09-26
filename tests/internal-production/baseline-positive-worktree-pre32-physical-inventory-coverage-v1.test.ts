import assert from "node:assert/strict";
import { test } from "node:test";

import { createLegacyFindingPublicationInventoryValueV1 } from "../../src/findings/legacy-finding-publication-inventory-v1.js";
import { hashCanonicalJson } from "../../src/product-compiler/canonical-json.js";
import { observePositiveWorktreePre32PhysicalInventoryCoverageWithPortsV1 } from "../../src/internal-production/baseline-positive-worktree-pre32-physical-inventory-coverage-v1.js";

const retainedDev = "/Users/setrox/ai/setrox/.worktrees/developer-worktree";
const retainedDeploy = "/Users/setrox/ai/setrox/deployments/setfarm-preserved";
const selectedChurn = "/Users/setrox/ai/setrox/.worktrees/selected-historical";
const retainedNonGit = "/Users/setrox/ai/setrox/.worktrees/data";
const runtimeGit = "/Users/setrox/projects/example-project/.worktrees/story-001";
const runtimeNonGit = "/Users/setrox/projects/example-project/.worktrees/story-002";
const missingAgents = "/Users/setrox/.openclaw/workspaces/workflows/developer/agents";
const prunableBase = "/Users/setrox/.openclaw/workspaces/workflows/feature-dev/agents/developer/story-worktrees";
const compareRoot = (left: { root: string }, right: { root: string }) =>
  Buffer.compare(Buffer.from(left.root), Buffer.from(right.root));

function physical(options: { pidAt?: string; noChurn?: boolean; forgedHash?: boolean;
  retainedPrimary?: string;
  malformed?: "crossed-zone" | "bad-stat" | "bad-dirty" | "bad-primary"
    | "foreign-primary" | "same-home-foreign-primary" | "extra-entry-field" } = {}) {
  const entry = (root: string, zone: "retained-zone" | "runtime-zone",
    kind: "linked-git" | "unresolved", ino: string, gitPrimaryRoot: string | null,
    dirty: boolean | null) => Object.freeze({ root, zone, kind, dev: "1", ino, birthtimeNs: "2",
      gitPrimaryRoot, dirty, sourceBuildProvenance: "unverified" as const,
      referencingPids: Object.freeze(root === options.pidAt ? [481] : [] as number[]) });
  const first = entry(retainedDev, "retained-zone", "linked-git", "10",
    options.retainedPrimary ?? "/Users/setrox/ai/setrox/setfarm", true);
  const malformedFirst = options.malformed === "crossed-zone"
    ? Object.freeze({ ...first, root: runtimeGit })
    : options.malformed === "bad-stat" ? Object.freeze({ ...first, dev: "0", ino: "x" })
    : options.malformed === "bad-dirty" ? Object.freeze({ ...first, dirty: "false" })
    : options.malformed === "bad-primary" ? Object.freeze({ ...first, gitPrimaryRoot: "/Users/setrox/ai/setrox/../setfarm" })
    : options.malformed === "foreign-primary" ? Object.freeze({ ...first, gitPrimaryRoot: "/Users/other/projects/foreign" })
    : options.malformed === "same-home-foreign-primary" ? Object.freeze({ ...first, gitPrimaryRoot: "/Users/setrox/projects/foreign" })
    : options.malformed === "extra-entry-field" ? Object.freeze({ ...first, owner: true })
    : first;
  const entries = Object.freeze([
    malformedFirst,
    entry(retainedDeploy, "retained-zone", "linked-git", "11", "/Users/setrox/ai/setrox/setfarm", false),
    entry(selectedChurn, "retained-zone", "linked-git", "12", "/Users/setrox/ai/setrox/setfarm", false),
    entry(retainedNonGit, "retained-zone", "unresolved", "13", null, null),
    ...options.malformed === "crossed-zone" ? [] : [entry(runtimeGit, "runtime-zone", "linked-git", "14", "/Users/setrox/projects/example-project", true)],
    entry(runtimeNonGit, "runtime-zone", "unresolved", "15", null, null),
  ].sort(compareRoot));
  const blockers = Object.freeze([
    { root: `${prunableBase}/old`, reason: "prunable-git-worktree" },
    { root: retainedNonGit, reason: "non-git-child" },
    { root: runtimeNonGit, reason: "non-git-child" },
    { root: missingAgents, reason: "absent-workflow-agents-discovery-parent" },
    ...options.noChurn ? [] : [{ root: selectedChurn, reason: "git-admin-entry-churn" }],
  ].sort(compareRoot).map(row => Object.freeze(row)));
  const body = Object.freeze({ schema: "setfarm.internal-production-positive-worktree-physical-catalog.v2" as const,
    status: "unresolved" as const, observerPidExcluded: 1234, entries,
    absentBases: Object.freeze([prunableBase]), incidentalFiles: Object.freeze([]), blockers });
  return Object.freeze({ ...body, catalogHash: options.forgedHash ? "f".repeat(64) : hashCanonicalJson(body) });
}

function database(active = false) {
  const activeRuns = Object.freeze(active ? [Object.freeze({ unexpected: true })] : []);
  const activeBody = Object.freeze({ schema: "setfarm.internal-production-positive-worktree-active-rows.v2" as const,
    authority: "diagnostic-only" as const, physicalIdentityProvenance: "unverified" as const,
    activeRuns, openClaims: Object.freeze([]), activeAttempts: Object.freeze([]), activeSessions: Object.freeze([]),
    counts: Object.freeze({ runCount: active ? 1 : 0, claimCount: 0, attemptCount: 0, sessionCount: 0 }) });
  const activeRows = Object.freeze({ ...activeBody, snapshotHash: hashCanonicalJson(activeBody) });
  const bindingBody = Object.freeze({ schema: "setfarm.internal-production-positive-worktree-binding-rows.v1" as const,
    authority: "diagnostic-only" as const, physicalIdentityProvenance: "unverified" as const,
    activeAttempts: Object.freeze([]), activeSessions: Object.freeze([]),
    counts: Object.freeze({ attemptCount: 0, sessionCount: 0 }) });
  const bindingRows = Object.freeze({ ...bindingBody, snapshotHash: hashCanonicalJson(bindingBody) });
  const legacyCensus = Object.freeze({ activeRunCount: active ? 1 : 0, openClaimCount: 0,
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

async function observe(catalog = physical(), snapshot = database()) {
  const order: string[] = [];
  const result = await observePositiveWorktreePre32PhysicalInventoryCoverageWithPortsV1(
    async betweenPasses => { order.push("physical-first"); await betweenPasses();
      order.push("physical-second"); return catalog; },
    async () => { order.push("database"); return snapshot; });
  assert.deepEqual(order, ["physical-first", "database", "physical-second"]);
  return result;
}

test("V1 covers every present root once without assigning ownership", async () => {
  const catalog = physical();
  const result = await observe(catalog);
  assert.equal(result.schema, "setfarm.internal-production-pre32-physical-inventory-coverage.v1");
  assert.equal(result.authority, "diagnostic-only");
  assert.equal(result.physicalIdentityProvenance, "unverified");
  assert.equal(result.temporalScope, "v7-held-two-pass");
  assert.deepEqual(result.retainedGitTopologyRoots, [retainedDev, retainedDeploy]);
  assert.deepEqual(result.unresolvedPresentRoots,
    [selectedChurn, retainedNonGit, runtimeGit, runtimeNonGit].sort((a, b) => Buffer.compare(Buffer.from(a), Buffer.from(b))));
  assert.deepEqual([...result.retainedGitTopologyRoots, ...result.unresolvedPresentRoots]
    .sort((a, b) => Buffer.compare(Buffer.from(a), Buffer.from(b))), catalog.entries.map(row => row.root));
  assert.deepEqual(result.sourceAnnotation.sourceAnnotation.sourcePair.heldPair.physicalCatalog.blockers,
    catalog.blockers);
  assert.equal(result.sourceAnnotation.sourceAnnotation.sourcePair.pre32Database.lockState, "released-at-return");
  for (const forbidden of ["owner", "nonowner", "zeroOwner", "eligible", "ready", "cutoverAdmission"])
    assert.equal(forbidden in result, false);
  const { coverageHash, ...body } = result;
  assert.equal(coverageHash, hashCanonicalJson(body));
  assert.equal(Object.isFrozen(result), true);
});

test("V1 keeps PID-bearing retained Git and every runtime root unresolved", async () => {
  const result = await observe(physical({ pidAt: retainedDev, noChurn: true }));
  assert.deepEqual(result.retainedGitTopologyRoots, [selectedChurn, retainedDeploy]);
  assert.ok(result.unresolvedPresentRoots.includes(retainedDev));
  assert.ok(result.unresolvedPresentRoots.includes(runtimeGit));
  assert.ok(result.unresolvedPresentRoots.includes(runtimeNonGit));
});

test("V1 accepts a producer-allowed retained primary under the preserved topology", async () => {
  const result = await observe(physical({ retainedPrimary: "/Users/setrox/ai/setrox/deployments/setfarm-primary" }));
  assert.ok(result.retainedGitTopologyRoots.includes(retainedDev));
  assert.equal(result.authority, "diagnostic-only");
});

test("V1 refuses active pre32 database rows rather than projecting a positive candidate", async () => {
  await assert.rejects(observe(physical(), database(true)), /INTERNAL_PRODUCTION_POSITIVE_WORKTREE_PRE32_HOST_PAIR_INVALID/);
});

test("V1 refuses forged catalog identity and physical drift without partial output", async () => {
  await assert.rejects(observe(physical({ forgedHash: true })),
    /INTERNAL_PRODUCTION_POSITIVE_WORKTREE_HOST_PAIR_INVALID/);
  await assert.rejects(observePositiveWorktreePre32PhysicalInventoryCoverageWithPortsV1(
    async betweenPasses => { await betweenPasses(); throw Error("physical-second-pass-drift"); },
    async () => database()), /physical-second-pass-drift/);
});

for (const malformed of ["crossed-zone", "bad-stat", "bad-dirty", "bad-primary",
  "foreign-primary", "same-home-foreign-primary", "extra-entry-field"] as const) {
  test(`V1 refuses self-hashed malformed physical entry ${malformed}`, async () => {
    await assert.rejects(observe(physical({ malformed })),
      /INTERNAL_PRODUCTION_PRE32_PHYSICAL_INVENTORY_COVERAGE_V1_INVALID/);
  });
}
