# Task6A Original-Owner Receipt Capture Implementation Plan

> **For agentic workers:** Root implements inline as explicitly required by the owner; agents research/review read-only. Use TDD and verification-before-completion. Executing-plans is unavailable; do not delegate writing.

**Goal:** Capture the complete original-owner eight-member successor chain and five original physical receipt files without V1 durability writes.

**Architecture:** Separate zero-input diagnostic composition retains the existing workspace anchor, private chain and original inventory through immutable in-memory copying, source/physical rechecks and exhaustive cleanup. It grants no runtime authority.

**Tech Stack:** Node >=22, TypeScript ESM, macOS, node:test, existing receipt parsers and physical holders.

**Spec:** `docs/superpowers/specs/2026-09-30-task6a-original-owner-capture-design.md`

## Global Constraints

- Root sole writer; frozen startup work and all worktrees/branches retained.
- No paths/pairs/bodies/callbacks/URLs/env selectors accepted by capture.
- Existing V1 parser, home/current UID,0700/0600/link/device/inode/Git/build/durability rules unchanged.
- Capture-only diagnostic object, no V2/startup/DB/migration/ownership/admission authority.
- No filesystem writes/fsync, live services/identity/ACL/selector/DB changes in the source slice.
- Aggregate raw members <=16MiB; serialized diagnostic <=32MiB; existing per-member1MiB bound retained.
- No build guard override, direct-main commit, force push or worktree cleanup.

## File Map

- Modify `src/internal-production/baseline-post-handoff-receipt-v1.ts`: private immutable member projection, zero-input diagnostic composition, private original owner retained `records` view. Existing wrappers and semantic/durability regions stay intact.
- Create `tests/internal-production/task6a-original-owner-source-capture-v1.test.ts`: actual-body composition/projection with real private FDs and narrowly controlled authentication/source ports; no authentic-positive claim.
- Modify `package.json`: focused safe no-ambient-DB test command only.
- These spec/plan files: chosen boundaries, tests and evidence.
- Existing baseline copied-fixture test file changes only if an actual scoped compatibility regression requires an instrumentation update; record that relation before editing.

## Task 1: Retained capture and refusal

**Produces:** `observeInternalProductionTask6aOriginalOwnerReceiptCaptureNoWriteV1(): Promise<Readonly<Record<string, unknown>>>`, capture-only data, plus private held-member projection consumed only by it.

- [ ] Write actual-body tests. Independently expected roles/locators/bytes are literal fixture data; removing original ownership or final stability checks must fail tests. Example assertion:
  ```ts
  assert.deepEqual(result.orderedMembers.map((member) => member.role), [
    'predecessor-operation', 'successor-edge', 'quarantine-disposition',
    'successor-operation', 'authority-v31', 'pending-migration',
    'activation-seal', 'activation-commit',
  ]);
  assert.equal(fixture.liveDescriptors.size, 0);
  ```
- [ ] Run `env -u SETFARM_PG_URL -u SETFARM_TEST_PG_ADMIN_URL node --import tsx --test tests/internal-production/task6a-original-owner-source-capture-v1.test.ts`; require intended missing-capture/incorrect-lifetime RED, not malformed fixture setup.
- [ ] Implement no-write composition in the existing module, preserving private authentic lower readers. Minimal control skeleton:
  ```ts
  let primaryError: unknown | null = null;
  try { /* hold source/chain/originals; copy; recheck; return frozen data */ }
  catch (error) { primaryError = error; throw error; }
  finally { attemptTask6aReceiptOwnedCleanupV1(releases, primaryError); }
  ```
  Releases snapshot only acquired originals/chain/anchor and exhaust all once.
- [ ] GREEN the new tests and all110 delivered resource tests. Run strict source and actual-test TypeScript checks; verify no V1 fsync or semantic change.

## Task 2: Regression and evidence-bound delivery

- [ ] Run the existing selected real baseline ten regression cases, plus original durability call/count regression cases located by their current test names; existing pure suite, contracts/digests and diff check.
- [ ] Independent read-only review of source/test ownership, immutable projection, bounds, no-write callgraph and exact File Map. Fix important findings via RED/GREEN.
- [ ] Explicit-path staging, bounded credential-pattern inspection, conventional commit and scoped push/PR. Audit exact-head cloud/security/thread evidence, then normal SHA-bound merge without branch deletion.
- [ ] Fetch/ff-only clean standby main, ordinary `npm run build`, full `dist/BUILD_INFO.json` SHA/main/dirtyfalse check. Preserve selected old deployment.
- [ ] Execute the zero-input capture as original user from reviewed main under a no-write diagnostic subprocess. Record literal success or exact error/cause; never replace rejected old physical identities or treat protocol fixtures as authentic positive proof.
- [ ] Continue the bounded Task6A prerequisite plan from the actual evidence. Protected capture/promotion/runtime-manifest/P3/native exclusion/guarded32+33/ownership admission/allHTTP/fresh run remain unproven by this slice.
