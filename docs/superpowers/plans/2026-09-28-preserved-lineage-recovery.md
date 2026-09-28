# Preserved-lineage recovery implementation plan

> Root is the only writer. Other agents may inspect and review read-only.

**Goal:** Restore Setfarm through a separately built, guarded deployment
lineage while retaining the old selected checkout and all eight archives.

**Spec:** `docs/superpowers/specs/2026-09-28-preserved-lineage-recovery-design.md`

## Global constraints

- No live archive, selected CLI link, LaunchAgent, database grant/credential,
  or service mutation during code-only implementation and private tests.
- Do not relax the eight-generation writer cap or strict old-ledger inspection.
- Before any service or link effect, prove continuous old-entrypoint and
  old-writer exclusion across intent publication and bootouts; the retained
  executable does not read the new intent, and its current BUILD_INFO failure
  is not an exclusion fence. Publish the durable intent before effects. After
  new CLI selection, verify the new ordinary-start refusal remains fail-closed
  until a matching Task6A ready-bound completion.
- Every code delivery uses a reviewed PR and exact-head checks; normal build
  only on clean delivered main in a separate physical checkout.
- A safe testable code slice does not imply host rollout authority.

## File map

- `docs/superpowers/specs/2026-09-16-preserved-deployment-cutover-design.md`:
  existing approved transition and rollback boundaries.
- `src/internal-production/baseline-deployment-cutover-records-v1.ts`:
  old/new build, CLI, launcher, owner and intent commitments.
- `src/internal-production/baseline-deployment-cutover-service-effect-{records,store}-v1.ts`:
  historical bootout prefix; never reinterpret as full completion.
- `src/internal-production/baseline-deployment-cutover-cli-observation-v1.ts`:
  fixed-link and old selected-target snapshot; its descriptors close before
  return, so an effect needs a separate held selected-build/CLI interval.
- `src/internal-production/baseline-deployment-cutover-launcher-observation-v1.ts`:
  unchanged launchers and loaded service/process evidence.
- `scripts/deployment-cutover.mjs`, `scripts/deployment-cutover-owner.mjs`:
  current diagnostic bootstrap and owner publication.
- `scripts/write-build-info.mjs`, `scripts/build-generation-retention.mjs`:
  unchanged old-lineage build/retention guards.
- Focused tests beside each new source and existing cutover, runtime-guard,
  retention and build-info suites.

## Task 1 — authenticated candidate, no effect

1. Write a RED private fixture with an old checkout containing eight authentic
   archives and a separate workspace-eligible clean-main checkout with terminal
   build. The `/private/tmp` clone is not an eligible selection target. Cross the
   old CLI link/target, new source/build, and unchanged launcher profiles.
   Require a fixed refusal for copied output, wrong root, dirty/non-main
   checkout, crossed build hash, changed old link, or hidden old archive.
2. Implement a one-use, read-only candidate relation using the existing held
   observations. Its only result is `authority:"diagnostic-only"`; it cannot
   publish intent, select a CLI, dispatch a service, or erase an archive.
3. Verify focused RED/GREEN, TypeScript, source manifest and applicable
   cutover/build tests. Obtain independent review before PR delivery.

## Task 2 — owner-held service quiescence

1. First prove an independently enforceable, continuous old-entrypoint/DB/OS
   writer fence in private fixtures, including the pre-link interval, crash,
   launchd retry, and already-loaded old modules. If the real mechanism needs
   live role/grant/credential/access-control changes, stop before activation
   and request the exact missing authority; this plan does not grant it.
2. Write RED private tests for an exclusive current owner, durable open intent,
   continuous old-entrypoint/old-writer exclusion, exact old launcher/process
   targets, and
   owner/death/drift rechecks around each of the two existing bootout records.
   Unknown PID, replacement, failed drain, stale claim, or partial record
   refuses without touching the other launcher. Cover the present host's
   already-exited dashboard through positive process/listener absence and
   exact loaded-launcher state; never invent an old PID or completion. Include
   launchd retry/reboot and already-loaded old modules; the current runtime
   guard refusal cannot stand in for a durable old-writer fence.
3. Implement a bounded, owner-held bootout controller/recovery path that uses
   the existing service-effect records/store as history, never as standalone
   dispatch authority. Prove crash safety before and after each publication
   and each exact side effect in private fixtures. A source snapshot with
   released descriptors cannot authorize a later async effect: use a one-use
   held selected-build/CLI interval or a separately reviewed held capability
   with rechecks. No live invocation until old-writer exclusion exists.

## Task 3 — versioned CLI selection history and controller

1. Write RED tests for a separate CLI-selection effect schema chained to the
   exact two completed owner-held service effects, fixed cutover intent, and
   owner claim. Cover duplicate/crossed hashes, wrong action/order, partial
   publication, ABA link or target, and same-root/old-target selection.
2. Implement history-only canonical records/store, then a controller that
   authenticates fresh held pre/post observations before a one-use atomic
   link effect. An unrecorded, ambiguous or reused effect refuses. Do not
   modify the old v1 service-effect grammar or give records standalone
   dispatch authority.
3. Add crash/recovery tests for all before/after publication windows. Repeat
   focused and broad gates and independent exact-head review.

## Task 4 — guarded service restoration and ready-bound completion

1. Test dashboard restoration on unchanged 3333 and spawner loaded-idle with
   ordinary starts still refused; reject wrong executable, PID reuse, old
   process family, listener drift, and failed cleanup.
2. Bind final completion to the existing sealed cold/Task6A ready authority.
   Add a separately versioned admission reader that recognizes only the exact
   matching authenticated completion; an open/malformed/partial intent still
   refuses. No completion from HTTP 200, elapsed time, zero DB rows, or the
   effect history alone. Verify durable refusal and crash recovery on every path.
3. Run broad private/serial genuine tests, clean-main build in the new
   physical checkout, independent review and PR delivery. Perform only a
   no-write real-host preflight until all guards prove ready.

## Rollout boundary

The current host does not pass these gates. The eight old archives and their
ledger remain visible even after a future new-lineage selection. Never use
retention prepare/resume to create capacity as part of this plan.
