# Deployment Cutover Startup Refusal Implementation Plan

> **Execution:** Primary-owner serialized implementation and independent read-only
> review in the existing isolated worktree; approved execution choice retained.

**Goal:** Refuse ordinary spawner effects while fixed cutover authority is open
or invalid, without granting or weakening either sealed startup route.

**Architecture:** A synchronous zero-argument assertion consumes the existing
fixed-root physical observer. Call it before ordinary effects and again after
awaited observations, including inside the stale-file deletion authority callback.
Completion remains unsupported and therefore refuses until separately qualified.

**Tech Stack:** TypeScript ESM, real copied-source child fixtures, Node filesystem.

**Spec:** `docs/superpowers/specs/2026-09-16-preserved-deployment-cutover-design.md`.

## Constraints and file map

- Modify `src/internal-production/baseline-deployment-cutover-v1.ts`: export
  `assertOrdinarySpawnerDeploymentCutoverAdmissionV1(): void`, no arguments,
  no environment override, no supplied observation or permission boolean.
- Modify `src/spawner.ts`: static import; ordinary startup/reclamation checks.
  Preserve direct/cold sealed authentication and their early returns.
- Extend `tests/internal-production/baseline-deployment-cutover-observer-v1.test.ts`
  with fresh-child assertion tests against physical absent/open/partial roots.
- Extend executable copied-source main and stale-reclamation fixtures in
  `tests/internal-production/owner-admission-v1.test.ts`; retain all existing modes.
- Create `tests/internal-production/baseline-deployment-cutover-admission-effects-v1.test.ts`:
  execute original claim/await AST bodies with their real capability map and the
  physical cutover assertion; inject publication at census/import await boundaries.
- Extend extracted sealed-main fixtures in
  `tests/internal-production/baseline-restart-authority-retirement-v1.test.ts`
  with a forbidden ordinary assertion trap. Preserve registration inventory.
- No live journal publication, link replacement, service operation, completion
  claim, archive mutation or startup guard bypass belongs to this task.

## Task: refusal at ordinary effect boundaries

- [x] Add physical assertion and real-main modes before production changes.
  Open/empty/staging/malformed roots must retain bytes/inodes and prevent PID,
  singleton, ordinary admission, provider, database, listener and scratch effects.

```ts
assert.match(child.error, /DEPLOYMENT_CUTOVER/);
assert.equal(existsSync(pidFile), false);
assert.equal(existsSync(lockFile), false);
assert.equal(existsSync(providerMarker), false);
assert.equal(existsSync(admissionMarker), false);
assert.deepEqual(readFileSync(intentPath), originalIntentBytes);
```

- [x] Run new selected cases RED. Keep the production observer and actual main;
  replace only fixture-owned external authority/provider boundaries.
- [x] Implement the synchronous assertion after three physical cases failed RED:

```ts
export function assertOrdinarySpawnerDeploymentCutoverAdmissionV1(): void {
  if (observeDeploymentCutoverIntentV1().state !== "absent") {
    throw Error("DEPLOYMENT_CUTOVER_ORDINARY_START_REFUSED");
  }
}
```

- [x] Call after both sealed-route early returns, after ordinary cold observation,
  after post-recovery reclamation and before singleton/PID publication. Add the
  same check inside post-recovery `assertAuthority` and default ordinary stale
  deletion authority before unlink. Revalidate after admission awaits before
  claim/release/finalization effects and immediately before producer initialization.
- [x] Add late publication tests at cold observation, reclamation, post-PID and
  admission awaits. Assert the next effect never happens; stale/foreign files
  survive and fatal cleanup removes only files owned by that exact startup.
- [x] Prove persisted open intent refuses in another fresh process. Prove absent
  intent preserves existing ordinary behavior. Prove actual authenticated direct
  and cold paths never call the ordinary assertion, including forged-selector
  refusal cases already covered by their complete fixtures.
- [ ] Run focused cases GREEN, complete affected executable fixture tests,
  observer/codec tests, no-emit and repository contracts. Obtain independent
  review before checkpoint; clean-main build remains a later delivery gate.

## Scope self-review

This task implements only the approved refusal wiring requirement. It deliberately
does not accept completion records or claim live readiness. Durable publisher,
ready-bound completion, controller ownership/recovery and full crash/reboot/service
handoff qualification remain required before changing the selected executable.
The shared-directory cleanup suite must finish before changing its source or
fixtures, so its current exact-source result stays interpretable.

Checkpoint: physical assertion/observer/codec plus admission effect boundaries
41/41 pass, zero skips,5326.554709ms. English1496, paths861 and no-emit exit0.
Actual copied-source main has open/partial/after-cold-observation/after-PID modes
and a completed-recovery case where intent arrives during the reclaimer await.
Initial open case failed RED (exit0 instead of1). Late reclaim failed RED by
deleting retained startup files; checking its synchronous authority callback
corrected this. Full main matrix passed184395.051334ms. Its late-reclaim error
assertion was subsequently tightened and remains due for the next complete run.
Default stale reclaimer and foreign-close fixture2/2 pass; genuine direct/cold
sealed main fixtures2/2 pass24120.978291ms with forbidden ordinary-guard traps.
Claim and bootstrap entry/await cases failed RED before the four local checks;
all11 real-physical effect fixtures pass, including capability-clone/extra-key/
crossed-hash refusals and absent controls. No caller-supplied bypass was added.

Independent review found no must-fix for this bounded slice. Dispatch checks do
not certify downstream asynchronous restart/release/finalization effects; the
approved controller exclusion and crash/handoff qualification must still prove
those boundaries before live use. Later main release/finalization awaits are
checked in source but not individually injected by this slice's main fixtures.

The first combined owner-admission/helper/sequence/startup file run was launched
directly. Owner-admission includes a P3 projection-marker witness and therefore
requires `scripts/run-isolated-postgres-tests.ts`; its direct-run marker failure
is not a product fix target. Preserve that failure and rerun through the actual
isolated runner after the reviewed checkpoint is tracked/clean. Do not create
a fake marker, skip the witness or weaken the runner's scope guard.

Independent readiness audit: normal-task0-admission-ready is not itself complete
Task6A acceptance. Future completion must bind current prepared-operation status,
pair-only ready resolution and fresh receipt/database/service authority, not an
arbitrary historical ready pair. The exported readiness writer must remain usable
from the receipt controller while the sealed process is present and cutover open;
gating that writer or module initialization would create a deadlock. Never require
an ordinary successor before completion publication, because completion is what
permits ordinary startup. Avoid new static receipt/startup imports in the lightweight
observer; they introduce a spawner/receipt dependency cycle.

Fresh checkpoint verification: physical codec/observer/effect tests41/41,
zero skips,5725.547459ms; no-emit exit0; English1496 and paths861 pass;
diff whitespace check passes. This is a reviewed source checkpoint, not P3
completion or authorization to perform live cutover. The complete isolated
owner-admission rerun and complete retirement rerun remain pending.

Superseding full verification: retirement at8845d2df passed169/169 registered
parents and246 child tests,zero failures/skips. Solitary isolated owner-admission
at22b93b61 passed105/105,zero failures/skips1703344.576708ms, and cleaned its owned
primary/template databases. These qualify the bounded startup/source changes;
controller integration and actual cutover/Task6A completion remain unproven.
