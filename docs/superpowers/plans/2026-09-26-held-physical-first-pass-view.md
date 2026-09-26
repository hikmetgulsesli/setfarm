# Held Physical First-Pass View V1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expose the existing held catalog's first-pass physical candidates to its same-interval callback without creating ownership authority.

**Architecture:** Freeze a copy of the collected V2 candidate array after the existing first-pass stability check, pass it to the callback, then retain every existing second-pass recheck. No new observer, receipt, database call, or live effect is introduced.

**Tech Stack:** TypeScript ESM, Node test runner, real temporary Git primary/linked worktrees.

**Spec:** `docs/superpowers/specs/2026-09-26-held-physical-first-pass-view-design.md`

## Global Constraints

- Root is the only writer; read-only agents may review.
- Preserve all historical/deployment worktrees, selected dist, CLI link, dirty files, V1/V2/V6 guards, service ports, and the frozen pre-32 census.
- The view and final catalog remain diagnostic-only with unverified source/physical binding provenance. Never infer owner or zero owner.
- Build only on a clean worktree; no dirty-build or runtime-guard bypass.

---

### Task 1: Add the held first-pass view

**Files:**
- Modify: `tests/internal-production/baseline-positive-worktree-physical-catalog-v2.test.ts`
- Modify: `src/internal-production/baseline-positive-worktree-physical-catalog-v2.ts`

**Interfaces:**
- Consumes: the existing `Candidate` array and `HeldDirectories.assertStable()` at the `between-passes` boundary.
- Produces: `betweenPasses: (firstPass: readonly Candidate[]) => Promise<void>`; the array and candidates are immutable, and the final V2 catalog is unchanged.

- [x] **Step 1: Write RED behavior tests.** Extend the real linked Git fixture with an independent filesystem expectation and assert the callback view before final return:

  ```ts
  const expected = lstatSync(linked, { bigint: true });
  const result = await observeHeldPositiveWorktreePhysicalCatalogV2(scope, async (firstPass) => {
    assert.equal(Object.isFrozen(firstPass), true);
    assert.equal(firstPass.length, 1);
    assert.equal(Object.isFrozen(firstPass[0]), true);
    assert.deepEqual([firstPass[0]!.root, firstPass[0]!.kind, firstPass[0]!.gitPrimaryRoot],
      [linked, "linked-git", primary]);
    assert.deepEqual([firstPass[0]!.dev, firstPass[0]!.ino, firstPass[0]!.birthtimeNs],
      [String(expected.dev), String(expected.ino), String(expected.birthtimeNs)]);
  });
  assert.equal(result.entries[0]!.ino, String(expected.ino));
  ```

  In the existing transient Git-admin churn fixture, assert the callback sees a linked candidate while the final catalog still reports `git-admin-entry-churn`.
- [x] **Step 2: Verify RED.** Run `node --import tsx --test tests/internal-production/baseline-positive-worktree-physical-catalog-v2.test.ts`; the new callback-view assertion must fail because the callback currently receives `undefined`, while existing fixture setup succeeds.
- [x] **Step 3: Implement minimal GREEN.** Change the callback type and invoke it immediately after the existing first-pass stability check:

  ```ts
  betweenPasses: (firstPass: readonly Candidate[]) => Promise<void> = async () => undefined,
  // After held.assertStable(), before post-database-stability:
  await betweenPasses(Object.freeze([...entries]));
  ```

  Do not alter final sorting/hash or recheck order.
- [x] **Step 4: Verify GREEN and invariants.** Run the focused file, `npm run test:internal-production:pure`, `npx tsc -p tsconfig.json --noEmit`, and `git diff --check`. Confirm no new authority fields or production call sites.
- [ ] **Step 5: Review and deliver.** Obtain independent read-only diff review; commit only the source, test, spec, and plan. Push a scoped branch, open a PR, address exact-head bot comments, and merge only after reviewed checks pass. On separate clean main, run normal guarded build and a no-write authenticated host annotation in a quiescent window. Preserve the old selected dist/link and report any host refusal as refusal.
