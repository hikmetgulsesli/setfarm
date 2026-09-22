# Held phase closure implementation plan

Root executes inline as sole writer; agents perform read-only research/review.

**Goal:** Retain fixed source/runtime phase-closure evidence across the default
owner's qualification and census, without claiming complete physical zero owners.
**Architecture:** Zero-input synchronous holder derives current checkout from its
module, selected checkout from the fixed CLI observer, and runtime authority from
the account home. Pin physical absence witnesses and receipt files; cross-bind
them to the authenticated bootstrap and selected-build holders in the owner.
**Tech stack:** TypeScript ESM, Node physical filesystem descriptors, node:test.
**Spec:** `docs/superpowers/specs/2026-09-16-preserved-deployment-cutover-design.md`

## Constraints and remaining program

Keep ports3080/3333/18789, historical selected dist/archives and CLI unchanged.
No ambient HOME/SETFARM_DIR, caller roots, import of runtime-config/receipt,
service effects, source execution, synthetic census, or removal of blockers.
Source/build authenticity belongs to existing bootstrap/selected holders; this
new leaf reports phase evidence only and retains explicit authentication blockers.

Project completion still needs: physical-owner contract, controller/effect journal,
ready-bound completion and crash qualification; live baseline Task6A/7/8;
B harness, C product matrix, D recovery/reconciliation, E fleet/cold rehearsal;
then real matrix/recovery/fleet campaigns and immutable final acceptance packet.
These are implementation programs, not three small remaining bug fixes.

Read-only audit found legacy cold proof counts every managed Git worktree as an
execution owner. Preserving deployment/development trees conflicts with unchanged
zero-count semantics. No exclusion or legacy change belongs to this phase slice;
the user has been asked about an explicit evidence-bound contract refinement.

## File map / interface

- Create `src/internal-production/baseline-deployment-cutover-phase-observation-v1.ts`:
  `holdDeploymentCutoverPhaseClosedPreflightV1()` returns frozen
  `{ observation, recheck(): void, close(): void }`. Reject every argument.
  Keep the receipt's18 producer/13 module inventory; check src.ts and dist.js in
  both current and selected checkouts. Hold four receipt files and reject the
  complete recovery-producer literal even inside comments. Require account-fixed
  `.openclaw/setfarm/internal-production` absent (covering its four child roots).
  Bound file reads to4MiB each and physical directory pins to128/depth48. Retain
  dev/ino/UID/GID/mode/birth and account-ancestry modification timestamps; files
  additionally retain nlink/size/mtime/ctime. Only ENOENT establishes absence.
  Consume descriptors before close; drift invalidates, close failure poisons
  acquisition with literal cleanupFailed=true. Opaque nested CLI failure remains
  unknown/null and fences reacquisition. Hash the complete public observation.
- Create matching physical test file: fixture-owned checkouts, CLI and runtime;
  no real host mutations. Present source/compiled modules, runtime authority,
  receipt literal/bytes/ancestor drift, missing/unsafe receipt, access ambiguity,
  argument override, lifecycle and descriptor response-loss cases.
- Modify default owner and unit tests: acquire phase after helper, recheck across
  both awaits, cross-bind account/current/selected/CLI fields; publish phase
  observation and retain all three default blockers. Reverse drain.
- Modify bootstrap finite diagnostic allowlists/tests for acquire-phase/phase.
- Modify composed fixture/integration to compile the leaf, provide receipt bytes
  in both fixture checkouts, and prove phase drift refuses before DB effects.

## TDD execution

- [x] RED fixture: `assert.equal(result.observation.scope, 'phase-closure-only')`;
  existing runtime/producer files and recovery literal must refuse, not execute.
  Run `node --import tsx --test tests/internal-production/baseline-deployment-cutover-phase-observation-v1.test.ts`.
- [x] GREEN physical holder; add across-await appearance/removal and restored
  ancestor ABA cases, consumed-close and foreign reused-fd preservation.
- [x] RED/GREEN owner binding and bootstrap diagnostics; real composed success
  and late-phase appearance/ABA cases before census.
- [x] Verify focused suites, cutover suite, serial genuine, noemit/contracts.
- [ ] Independent read-only review, conventional commit, scoped PR/exact-head
  cloud review, SHA-bound merge. Do not fetch shared main merely for branch setup.
- [ ] Normal clean-main build with retention capacity intact. If independent v2
  has reached its generation cap, use a fresh physical deployment clone; never
  delete retained generations or raise the guard limit. Preserve selected dist.
- [ ] One evidence-driven host qualification, accounting for the observed MC
  scheduler's30s directory mutation. Record success or exact refusal honestly.
