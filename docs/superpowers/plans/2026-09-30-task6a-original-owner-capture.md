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
- Modify `tests/internal-production/baseline-post-handoff-receipt-v1.test.ts`: add a scoped real lower-reader composition regression using its established local Git/strict-chain/physical-inventory fixtures and actual build producer. It must call the new public capture twice, retain literal bytes/metadata and zero FD delta, and prove the data tree unchanged and no durability calls. Only test fixture incident identities/output materialization are substituted; this is not literal production-host positive authority.

## Task 1: Retained capture and refusal

**Produces:** `observeInternalProductionTask6aOriginalOwnerReceiptCaptureNoWriteV1(): Promise<Readonly<Record<string, unknown>>>`, capture-only data, plus private held-member projection consumed only by it.

- [x] Write actual-body tests. Independently expected roles/locators/bytes are literal fixture data; removing original ownership or final stability checks must fail tests. Example assertion:
  ```ts
  assert.deepEqual(result.orderedMembers.map((member) => member.role), [
    'predecessor-operation', 'successor-edge', 'quarantine-disposition',
    'successor-operation', 'authority-v31', 'pending-migration',
    'activation-seal', 'activation-commit',
  ]);
  assert.equal(fixture.liveDescriptors.size, 0);
  ```
- [x] Run `env -u SETFARM_PG_URL -u SETFARM_TEST_PG_ADMIN_URL node --import tsx --test tests/internal-production/task6a-original-owner-source-capture-v1.test.ts`; intended missing-capture RED15/0pass15fail. Initial hand-entered digest typo was independently recomputed and corrected as fixture setup, not a production defect.
- [x] Implement no-write composition in the existing module, preserving private authentic lower readers. Minimal control skeleton:
  ```ts
  let primaryError: unknown | null = null;
  try { /* hold source/chain/originals; copy; recheck; return frozen data */ }
  catch (error) { primaryError = error; throw error; }
  finally { attemptTask6aReceiptOwnedCleanupV1(releases, primaryError); }
  ```
  Releases snapshot only acquired originals/chain/anchor and exhaust all once.
- [x] GREEN22 capture and all110 delivered resource tests. Source/actual-test strictTS passed. In-memory removal of relations/raw-cap/serialization-cap/null-history gates yielded22/16pass6intendedfail, no worktree changes. Original V1 durability callgraph unchanged. Pending latch burn refuses before original allocation and releases returned local chain plus anchor.

## Task 2: Regression and evidence-bound delivery

- [x] Existing selected real baseline14 (original10 plus3 actual durability and1 strict selector), anchored10, pure372 passed/zero skips/failures. Source/test strictTS and English1868/path947/version2.3.79/digests/12MC/diff passed. New actual lower-reader capture3 re-passed: twice complete capture with every field of all13-member metadata independently compared to actual stat, actual0644 original and malformed commit refusal, zeroFDdelta/no data mutation/no durability events. Final capture22 and cleanup110 re-passed before delivery.
- [x] Independent read-only review clears source/test retained ownership, immutable projection, zero-write transitive callgraph and FileMap. Its important coverage gap was addressed with seven additional protocol tests; synthetic bound cases explicitly cannot authenticate a V1 graph. Its minor sampled-metadata note was addressed with independent all13/full-field stat assertions.
- [ ] Explicit-path staging, bounded credential-pattern inspection, conventional commit and scoped push/PR. Audit exact-head cloud/security/thread evidence, then normal SHA-bound merge without branch deletion.
- [ ] Fetch/ff-only clean standby main, ordinary `npm run build`, full `dist/BUILD_INFO.json` SHA/main/dirtyfalse check. Preserve selected old deployment.
- [ ] Execute the zero-input capture as original user from reviewed main under a no-write diagnostic subprocess. Record literal success or exact error/cause; never replace rejected old physical identities or treat protocol fixtures as authentic positive proof.
- [ ] Continue the bounded Task6A prerequisite plan from the actual evidence. Protected capture/promotion/runtime-manifest/P3/native exclusion/guarded32+33/ownership admission/allHTTP/fresh run remain unproven by this slice.
