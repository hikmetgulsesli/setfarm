# Build-generation device-drift diagnostic implementation plan

> **For agentic workers:** Root is the only writer. Review agents are read-only.
> Execute the test-first steps below in the existing isolated worktree.

**Goal:** Add a pure device-drift classifier that cannot authorize retention
or live deployment.

**Architecture:** A standalone ESM module compares two already-produced
inventory bodies and returns a frozen, non-authoritative classification.
Production retention code is not modified by this slice.

**Tech Stack:** Node.js ESM, `node:test`.

**Spec:** `docs/superpowers/specs/2026-09-28-build-generation-device-drift-diagnostic-design.md`

## Global constraints

- Preserve all existing worktrees and immutable rotation/retention records.
- No live archive, service, selected CLI, PostgreSQL or access-control change.
- No build/retention guard bypass, no archive deletion, no `prepare`/`resume`.
- Every result has `authority:false`; caller-supplied inventories are not
  authenticated historical authority.
- Branch build is prohibited by the current Setfarm main-only build guard;
  run focused tests on branch and official build only on clean merged main.

## File map

- `scripts/build-generation-device-drift-diagnostic.mjs`: pure classifier.
- `scripts/__tests__/build-generation-device-drift-diagnostic.test.js`:
  literal RED/GREEN contract and negative cases.
- This spec and plan: boundary and proof limits.

## Task 1: Strict, non-authoritative classification

- [x] Add a test with two literal one-file inventories that differ only by
  uniform decimal device `16777230` to `16777231`. It must require
  `{schema:"setfarm.build-generation-device-drift-diagnostic.v1",
  classification:"uniform-device-only-drift",authority:false,
  recordedDevice:"16777230",observedDevice:"16777231",entryCount:1,
  regularFileByteCount:3}`. Run the focused test and observe RED because
  the classifier is absent.

  ```js
  import { classifyBuildGenerationDeviceDriftV1 } from "../build-generation-device-drift-diagnostic.mjs";
  // Use literal inventory objects with one `public/a.txt` regular file:
  // recorded root and entry devDecimal "16777230", observed "16777231";
  // every other field byte-equal, physical hashes different, content hash equal.
  assert.deepEqual(classifyBuildGenerationDeviceDriftV1(recorded, observed), {
    schema: "setfarm.build-generation-device-drift-diagnostic.v1",
    classification: "uniform-device-only-drift", authority: false,
    recordedDevice: "16777230", observedDevice: "16777231",
    entryCount: 1, regularFileByteCount: 3,
  });
  ```

  Run: `node --test scripts/__tests__/build-generation-device-drift-diagnostic.test.js`
  Expected: module import failure until the classifier exists.
- [x] Implement `classifyBuildGenerationDeviceDriftV1(recorded, observed)`
  minimally and run the focused test GREEN. Use literal field-by-field
  validation; do not call the retention inspector or change its accepted
  inventory semantics.

  ```js
  export function classifyBuildGenerationDeviceDriftV1(recorded, observed) {
    // Validate exact inventory keys, canonical decimal/string/hash members,
    // root identity, counts, and strict entry ordering before comparison.
    // Compare all fields except devDecimal and physicalInventoryHash.
    // Require one consistent old and one consistent new devDecimal throughout.
    // Return a frozen result with authority: false, or throw a fixed error.
  }
  ```

  Run: `node --test scripts/__tests__/build-generation-device-drift-diagnostic.test.js`
  Expected: one passing positive test.
- [x] Add table-driven negative cases for changed inode, mode, link count,
  kind, locator/order, count, size, SHA-256, content hash, mixed devices,
  malformed decimal and unchanged device. Observe each RED before adding
  the corresponding refusal; keep refusal output fixed and non-secret.

  ```js
  for (const [label, change] of negativeCases) {
    test(`refuses ${label}`, () => {
      assert.throws(() => classifyBuildGenerationDeviceDriftV1(recorded,
        change(structuredClone(observed))), /BUILD_DEVICE_DRIFT_DIAGNOSTIC_REFUSED/);
    });
  }
  ```
- [x] Run focused tests, `npm run check:english`, `git diff --check`.
- [ ] Commit only after all pass. Obtain independent read-only exact-head
  review before PR delivery.

## Task 2: Delivery boundary

- [ ] State in the PR body that this is advisory only and cannot unlock the
  eight-generation build or deploy the selected CLI. Review GitHub comments
  and address concrete findings on the same branch.
- [ ] Merge only reviewed exact head; fast-forward existing clean main.
  Run official clean-main build only if retention authority is separately
  repaired. Otherwise record the exact guard failure without bypassing it.
