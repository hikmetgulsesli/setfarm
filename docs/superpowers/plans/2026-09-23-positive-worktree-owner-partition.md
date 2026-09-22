# Positive Worktree Owner Partition V2 Implementation Plan

> **For agentic workers:** Root is the sole writer; read-only agents may research or review. Execute this plan task-by-task with RED/GREEN and independent review. Steps use checkbox (`- [ ]`) tracking.

**Goal:** Add a separate, diagnostic-only V2 partition of visible managed worktrees, recognizing only exact physical-plus-database execution bindings as worktree owners.

**Architecture:** A pure TypeScript leaf validates two identical bounded physical snapshots around one active database-owner snapshot, rejects all crossed or unjoined evidence, and returns a frozen hashed partition. It does not read the host, change V1 evidence or grant cutover authority. Future adapters and V2 cold consumers are outside this PR.

**Tech Stack:** TypeScript ESM, Node `node:test`, `node:crypto`, existing canonical JSON hash helper.

**Spec:** `docs/superpowers/specs/2026-09-23-positive-worktree-owner-partition-design.md`

## Global Constraints

- Do not edit historical V1 census/receipt/guard schemas, owner-category registry or migration hashes.
- No live DB, filesystem, service, CLI-link, retained dist or archive mutation.
- No pre-migration-32 schema change. Nullable database path text is never physical identity authority.
- Stage 1 is diagnostic only; keep all three default-context blockers.
- Preserve existing dirty files and all managed worktrees; root alone writes/delivers.

## File Map

- Create `src/internal-production/baseline-positive-worktree-owner-partition-v2.ts`: pure strict input validator, deterministic identity hash, one-to-one partition and frozen diagnostic output.
- Create `tests/internal-production/baseline-positive-worktree-owner-partition-v2.test.ts`: real leaf tests with independent literal expected classification/counts and adversarial malformed/crossed evidence.
- Update `package.json`: register the pure V2 test file in `test:internal-production:pure`, which is called by `npm test`.
- This plan and its spec document the staged authority boundary. No existing source is modified.

### Task 1: Visible retained and exact bound execution partition

**Files:** Create the source and test files above.

**Interfaces:** Export `createPositiveWorktreeIdentityHashV2(entry)` and `projectPositiveWorktreeOwnersV2(input)`. Input exact keys are `physicalBefore`, `database`, `physicalAfter`, `retainedGitPrimaries`. Physical entry exact keys are `root,namespace,kind,dev,ino,birthtimeNs,gitPrimaryRoot,dirty,referencingPids`. Database exact keys are `snapshotHash,activeOwners`; owner exact keys are `ownerKey,worktreeRoot,physicalIdentityHash`. Return exact body keys are `schema,state,inventory,ownedWorktreeCount,dirtyOwnedWorktreeCount,primaryProjectOwnerCount,physicalWitnessHash,databaseSnapshotHash,activeOwnerSetHash,retainedGitPrimariesHash,projectionHash`. The canonical input-set hashes bind row and primary-declaration identity independently of the caller's snapshot-hash claim.

- [ ] **Step 1: RED retained visibility.** Test one clean Setfarm Git worktree, one dirty Mission Control Git worktree and one non-Git artifact in retained-code namespace. Give two byte-identical physical passes, an empty active DB row set and two explicitly listed trusted primaries. Assert three visible classified entries, worktree counts zero, state `zero-candidate`, frozen result. The production change caught is wrongly counting retained entries as owners or hiding them.

```ts
const retained = [
  { root: "/code/.worktrees/mc", namespace: "retained-code", kind: "git-worktree", dev: "1", ino: "2", birthtimeNs: "3", gitPrimaryRoot: "/code/mission-control", dirty: true, referencingPids: [] },
  { root: "/code/.worktrees/setfarm", namespace: "retained-code", kind: "git-worktree", dev: "1", ino: "4", birthtimeNs: "5", gitPrimaryRoot: "/code/setfarm", dirty: false, referencingPids: [] },
  { root: "/code/.worktrees/test-data", namespace: "retained-code", kind: "artifact", dev: "1", ino: "6", birthtimeNs: "7", gitPrimaryRoot: null, dirty: false, referencingPids: [] },
] as const;
const result = projectPositiveWorktreeOwnersV2({
  physicalBefore: retained, physicalAfter: retained,
  retainedGitPrimaries: ["/code/mission-control", "/code/setfarm"],
  database: { snapshotHash: "a".repeat(64), activeOwners: [] },
});
assert.deepEqual(result.inventory.map((entry) => entry.classification), ["retained-code", "retained-code", "retained-artifact"]);
assert.equal(result.ownedWorktreeCount, 0);
assert.equal(result.state, "zero-candidate");
```
- [ ] **Step 2: Verify RED.** Run `node --import tsx --test tests/internal-production/baseline-positive-worktree-owner-partition-v2.test.ts`; expected failure is missing source module/export, not fixture syntax.
- [ ] **Step 3: GREEN core.** Implement strict exact-key plain-record/array capture (reject proxy/accessor/symbol/extra keys), bounded sorted unique inputs, normalized absolute paths, positive decimal identity fields, and canonical SHA-256 identity. Require retained Git entries to match one trusted primary and retained artifacts to have null primary; neither may have process references or DB bindings. Require runtime Git entries to have exactly one database row with the same root and identity hash; classify them `bound-execution`. Null root/hash DB pairs count as primary-project owners without requiring non-primary physical membership. Compute counts, `zero-candidate`/`occupied`, witness and projection hashes; recursively freeze the result. No I/O.

```ts
const physical = capturePhysicalEntries(input.physicalBefore);
const after = capturePhysicalEntries(input.physicalAfter);
if (hashCanonicalJson(physical) !== hashCanonicalJson(after)) fail();
const database = captureDatabase(input.database);
const byRoot = new Map(physical.map((entry) => [entry.root, entry]));
for (const owner of database.activeOwners) {
  if (owner.worktreeRoot === null) continue;
  const entry = byRoot.get(owner.worktreeRoot);
  if (!entry || entry.namespace !== "runtime"
    || createPositiveWorktreeIdentityHashV2(entry) !== owner.physicalIdentityHash) fail();
}
```
- [ ] **Step 4: GREEN verification.** Run the same focused test; require zero failures. Add a matched runtime entry and a primary-project row test with hand-derived expected counts, not output computed by the leaf.
- [ ] **Step 5: Commit the reviewed core.** Run focused test, `npx tsc --noEmit`, `git diff --check`, then a conventional scoped commit. Do not build on a feature branch by bypassing clean-main guards.

### Task 2: Refusal matrix and stable bracket

**Files:** Extend the same test/source pair; do not add new production dependencies.

- [ ] **Step 1: RED adversarial tests.** Starting from independent literal fixtures, mutate one field per case: runtime root missing DB owner; active DB owner missing physical root; duplicate owner key or root; reused path with changed `ino` or `birthtimeNs`; matching path with wrong physical hash; retained Git root with active DB row or process PID; unlisted Git primary; non-Git runtime entry; physical A/B membership, dirty or process drift; unsorted or duplicate snapshots/primaries/PIDs; relative, traversal, non-NFC or aliased path; malformed decimal/hash; proxy/accessor/extra-key input. Each must throw `INTERNAL_PRODUCTION_POSITIVE_WORKTREE_PARTITION_INVALID`. These tests catch a wrong accept branch, not source text.

```ts
const crossed: any = structuredClone(validBoundInput);
crossed.physicalAfter[0].ino = "999";
assert.throws(() => projectPositiveWorktreeOwnersV2(crossed),
  /^Error: INTERNAL_PRODUCTION_POSITIVE_WORKTREE_PARTITION_INVALID$/);
const orphan: any = structuredClone(validBoundInput);
orphan.database.activeOwners = [];
assert.throws(() => projectPositiveWorktreeOwnersV2(orphan),
  /^Error: INTERNAL_PRODUCTION_POSITIVE_WORKTREE_PARTITION_INVALID$/);
```
- [ ] **Step 2: Verify RED.** Run the focused test and observe the new cases fail because the current leaf accepts their crossed evidence.
- [ ] **Step 3: GREEN refusal.** Add only the missing validation branches. Preserve the expected core output. Do not silently discard unknown entries or use path equality in place of identity hash.

```ts
if (new Set(physical.map((entry) => entry.root)).size !== physical.length) fail();
if (new Set(physical.map((entry) => `${entry.dev}:${entry.ino}:${entry.birthtimeNs}`)).size !== physical.length) fail();
if (new Set(database.activeOwners.map((owner) => owner.ownerKey)).size !== database.activeOwners.length) fail();
if (new Set(database.activeOwners.filter((owner) => owner.worktreeRoot !== null)
  .map((owner) => owner.worktreeRoot)).size !== database.activeOwners.filter((owner) => owner.worktreeRoot !== null).length) fail();
```
- [ ] **Step 4: Reverify.** Run focused tests, `npx tsc --noEmit`, `git diff --check` and the existing held-phase physical suite `node --import tsx --test tests/internal-production/baseline-deployment-cutover-phase-observation-v1.test.ts`. Verify V1 source files are absent from the diff.
- [ ] **Step 5: Independent read-only review.** Provide base/head SHA, spec and File Map to a review agent. Fix critical/important findings and rerun affected tests. Agent cannot write or deliver.
- [ ] **Step 6: Deliver.** Commit conventionally, push the scoped branch, open PR, verify exact-head GitGuardian/cloud review and inline findings, SHA-conditioned merge, then fast-forward the independent clean-main clone and run its normal build. Do not alter the selected historical dist/CLI. A host observation may confirm the three blockers remain, but this diagnostic leaf alone cannot authorize cutover.

## Self-review and acceptance

The first slice covers every Stage-1 rule in the spec; physical collection, PostgreSQL snapshot provenance, V2 cold/guard consumption, controller/journal and live effects are explicitly deferred to separate reviewed slices. No placeholder API, caller-supplied zero-owner authority or V1 reinterpretation belongs in this plan. The deliverable is complete only when the focused RED/GREEN, static checks, independent review, clean-main build and PR evidence are recorded.
