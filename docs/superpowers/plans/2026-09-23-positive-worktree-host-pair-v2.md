# Positive Worktree Host Pair V2 Implementation Plan

> **For agentic workers:** Root is the only writer and delivery owner. Execute inline with RED→GREEN cycles; research/review agents are read-only. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bind one held physical catalog observation and one active PostgreSQL row snapshot into a diagnostic same-interval pair without granting owner or cutover authority.

**Architecture:** A focused module accepts fixture ports for the existing physical observer and DB observer. The production zero-input entry point supplies the canonical home/workspace scope and existing code-owned DB reader. The database read occurs only in the physical observer's `betweenPasses` callback; the module rejects missing, duplicate, or unawaited callbacks.

**Tech Stack:** TypeScript ESM, Node `node:test`, canonical JSON hashing, existing held physical catalog and postgres.js DB observer.

**Spec:** `docs/superpowers/specs/2026-09-23-positive-worktree-host-pair-v2-design.md`

## Global Constraints

- Preserve all dirty files, worktrees, selected CLI/dist, services, database schema, and runtime data. No reset/revert/prune, DB writes, migrations, guard bypass, or cutover transition.
- `authority` is exactly `diagnostic-only`; `physicalIdentityProvenance` is exactly `unverified`; neither empty DB rows nor `catalog.status === "complete"` implies zero-owner.
- Keep the entire physical catalog, including unresolved blockers, and entire active-row snapshot visible. Do not change either producer's schema or predicates.
- One PostgreSQL snapshot must occur inside the catalog's held two-pass interval, not before or after it.

---

### Task 1: Same-interval diagnostic pair

**Files:**
- Create: `tests/internal-production/baseline-positive-worktree-host-pair-v2.test.ts`
- Create: `src/internal-production/baseline-positive-worktree-host-pair-v2.ts`
- Modify: `package.json` (`test:internal-production:pure`)

**Interfaces:**
- Produce `observePositiveWorktreeHostPairWithPortsV2(observePhysical, observeDatabase)` where `observePhysical` accepts one awaited `betweenPasses: () => Promise<void>` callback and returns the current catalog type, while `observeDatabase` returns the current active-row snapshot type.
- Produce a frozen `{ schema, authority, physicalIdentityProvenance, physicalCatalog, databaseSnapshot, pairHash }` response. The nested producer objects stay unchanged.

- [ ] Write a literal complete catalog fixture with one `prunable-git-worktree` blocker and a literal complete empty DB snapshot fixture. Compute each producer hash over its full fixed fixture body. Fake physical first/second phases around `await betweenPasses()`; assert the event sequence `physical-first, database, physical-second`, exact schema/labels, unchanged blocker and rows, one database call, frozen outer response, 64-hex hash, and a changed pair hash when a blocker **and its catalog hash** change together. Name the break: DB read outside the held callback or discarded unresolved evidence.
  ```ts
  const events: string[] = [];
  const pair = await observePositiveWorktreeHostPairWithPortsV2(async (betweenPasses) => {
    events.push("physical-first");
    await betweenPasses();
    events.push("physical-second");
    return catalog;
  }, async () => { events.push("database"); return database; });
  assert.deepEqual(events, ["physical-first", "database", "physical-second"]);
  assert.equal(pair.authority, "diagnostic-only");
  ```
- [ ] Run `node --import tsx --test tests/internal-production/baseline-positive-worktree-host-pair-v2.test.ts`; verify RED because the module is absent.
- [ ] Implement only the fixture port, fixed labels, full nested evidence, and canonical pair hash. Register the test in the pure suite.
- [ ] Run the focused test and `npx tsc --noEmit`; verify GREEN.

### Task 2: Refusals and zero-input code-owned entry point

**Files:**
- Modify: `tests/internal-production/baseline-positive-worktree-host-pair-v2.test.ts`
- Modify: `src/internal-production/baseline-positive-worktree-host-pair-v2.ts`

**Interfaces:**
- Produce `observeCodeOwnedPositiveWorktreeHostPairV2()` with zero inputs. It dynamically imports `../db-pg.js` before physical acquisition, then calls `observeHeldPositiveWorktreePhysicalCatalogV2({ ownerHomeRoot: userInfo().homedir, workspaceRoot: resolveInternalProductionBaselineWorkspaceRootV1() }, betweenPasses)` and calls the imported `observeCodeOwnedPositiveWorktreeActiveRowSnapshotV2()` only from that callback. Do not statically import `db-pg.ts` in this pure fixture module because its `runtime-config.ts` import loads `.env` at module evaluation.

- [ ] Add tests that reject no callback, two callbacks (including one whose error the observer catches), an observer resolving before the callback settles, malformed catalog schema/hash, malformed DB authority/hash, a valid-format wrong producer hash, mutable nested evidence/post-return mutation, physical failure, and DB failure. The exact-head PR #150 review found a causal early-return failure: a later DB rejection could become unhandled after the pair had refused. Add a RED late-rejection fixture and attach a rejection handler to the retained callback promise without converting the early return into success. Each refusal must reject without returning a pair or substituting empty evidence. Recompute both producer hashes from their complete bodies and require recursively frozen plain data; do not accept hash format alone. A fixture observer is justified because real Git/lsof/PostgreSQL are external and the existing producer suites test their own behavior. The fixture can detect early return, not an `await` keyword; the production catalog explicitly awaits the callback.
  ```ts
  await assert.rejects(observePositiveWorktreeHostPairWithPortsV2(async () => catalog,
    async () => database), /INTERNAL_PRODUCTION_POSITIVE_WORKTREE_HOST_PAIR_INVALID/);
  ```
- [ ] Run the focused test; verify RED for each missing guard, then add the minimal guard and verify GREEN.
- [ ] Add the zero-input production wrapper using only the existing code-owned producers. Add an import-inertness test for the pure fixture module and verify the DB dynamic import completes before physical acquisition. Do not introduce caller scope, SQL, or zero assertions.
- [ ] Run focused, `npm run test:internal-production:pure`, `npm run test:internal-production:cutover`, `npx tsc --noEmit`, contract checks, and `git diff --check`. Request independent read-only code review and fix every Critical/Important finding with RED→GREEN evidence.
- [ ] Commit conventionally, push the scoped branch, open PR, inspect exact-head GitGuardian and cloud review, and SHA-condition squash merge. Do not delete any worktree.
- [ ] Fast-forward the independent clean-main deployment clone and run normal `npm run build`; fast-forward only the selected source checkout while preserving historical dist/CLI identity. Run one read-only host pair probe. Report unresolved blockers or metadata drift without a cutover claim.
