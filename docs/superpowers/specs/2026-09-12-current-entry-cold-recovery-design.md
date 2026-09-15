# Current-entry cold recovery design

## Objective and authority

Finish Subproject A Task 6A despite an already stopped spawner and two
authenticated historical prerequisites remaining beside the exact known
contaminated operation. The owner approved this correction and continued
parallel execution on 2026-09-12. This is a causal refinement of the existing
internal-production closure goal, not permission to bypass runtime guards,
erase evidence, apply migrations early, or start golden runs before A passes.

The audit is `/Users/setrox/ai/setrox/logs/2026-09-12-goal-resumption-audit.md`.
The implementation base is reviewed merge `eef9f6c4` (PR #123). All code changes
are serialized on `fix/current-entry-cold-recovery`; investigation and review
may run in parallel. Live operations wait for reviewed, verified clean main.

## Findings driving the design

1. The frozen ten-directory/five-file inventory remains intact. Two additional
   valid prerequisites belong to reviewed main `c44f618f`, not the recovery's
   current source. The current two-candidate overlay cannot admit them.
2. A normal restart stopped the predecessor before preparation. Both recovery
   and pre-schema authorization require a real four-service census.
3. The fixed pre-schema helper restarts a launchd watcher. The real daemon is
   detached (`ppid=1`, `pgid=pid`); the watcher's `spawner start` adopts that
   existing daemon. Therefore watcher restart does not prove or request the
   required predecessor termination.
4. The transition lease requires an epoch-one head before acquiring its lock,
   but production has no genesis publisher. Fixtures manually seed the head.
   The deployed linked worktree has no such store. Several producers derive
   stores from the executing repository while receipt readers use the fixed
   workspace; those authorities cannot meet on the deployed topology.
5. The legacy census counts four immutable, published findings from a terminal
   July run as active owners. Publication closes finding ownership, not issue
   status. Post-32 must still reject publications missing admission provenance;
   filtering by terminal status alone cannot distinguish legacy publications.

## Chosen approach

Keep the ordinary four-service authority and all existing predecessor identity
relations. Start the real authenticated spawner in a separately authorized,
one-shot, pre-current-entry sealed mode. Its actual process becomes the genuine
predecessor. Then use the existing operation-bound current-entry progression,
with a correctly described direct-detached transport for its rebind.

An absence union through every public authority would change substantially more
contracts. A placeholder process, invented PID, generic restart, or runtime
override cannot establish authority and is forbidden.

### Historical prerequisites

Keep the recovery-current descriptor tuple exactly two. Separately admit only
the two historical content pairs authenticated during the audit:

- authority: `8d80ed98b713cb870b2743af9cdcf8edc11a2f7f0fd599553c1fe4a7be0308f6`
- pending: `b7ddaeba33704753b1387a98def676b6b2585fc9c13809a33f8cd94f02eaa7ab`

This is a finite incident-specific extension to an already exact-incident
quarantine, not a general scan accepting arbitrary self-hashed history. Read
only these content-addressed locators; authenticate canonical bytes, existing
strict historical schema/Git/migration validators, same UID/device, no-follow
one-link 0600 files and stable 0700 parents. No legacy-basename fallback.
Deduplicate a historical/current overlap only after complete equality. Preserve
the original inventory serialization and hash unchanged.

Positive historical observations must be durably bound in a separately hashed
inventory in a versioned private disposition. Keep V1 historical resolution;
new history-bearing dispositions use a strict V2 body. Record file and parent
identities and bytes, not just filenames or hashes. Reopen the same exact
historical inventory during cold replay and reject replacement, disappearance,
appearance, or crossed topology. Never select successor prerequisites from
history: only current private builders determine the current pair.

Prevent recurrence: public current-prerequisite publishers must refuse writing
into the unrecovered exact-poison legacy store and direct the operator to
`prepare-current-entry`. That controller already has private no-write builders.
After successor activation the ordinary publishers use the selected successor
store. Task 6A documentation must no longer publish more legacy generations
before recovery. Existing settled current-two prefixes remain readable.

### Real sealed cold bootstrap

A separate private cold lifecycle must prove, before launch:

- Exact recognized poison operation/fingerprint and authenticated clean source.
- Required migration-31 state; 32/33 and A activation absent.
- Stable remaining three services, complete physical/phase/database zero-owner
  observations, and global spawner-family absence across all roots.
- Consistent authenticated pidfile/singleton state, launch plist, launchd job,
  launcher symlink, executable, source and build identity.

Do not manufacture a spawner member to reuse the four-service type. Factor
private physical inventory collection over the actual persistent service set;
the public four-service observer retains its existing exact shape.

Use the existing physical transition lease. Add a distinct cold journal family
and account it in release and dead-owner reclamation. An uncertain dispatch
retains its fence and cannot be retried as a second launch. Store cold records
outside the frozen legacy current-entry root, but explicitly account them in
phase-zero observation: an incomplete intent/outbox is an owner, not an
invisible exception.

The durable chain is intent/absence evidence, one-shot dispatch journal, real
process claim, and controller-observed sealed-process receipt. Bind source,
poison, host, transition-lock identity and journal throughout. Publish and adopt
using the existing strict private filesystem patterns. No ambient token, PID,
root, executable, or argv input may authorize the launch.

The fixed helper directly launches the authenticated Node executable with only
the real `dist/spawner.js` argument, fixed cwd, authenticated environment and an
inherited descriptor capability. Direct launch independently enforces the
runtime-integrity checks normally supplied by the CLI. The helper settles and
exits so the detached process can be observed with `ppid=1`, `pgid=pid`.

The spawner acquires its actual singleton protection and handles the cold
capability before ordinary admission or poisoned current-entry status lookup.
Register stop handlers before publishing a claim/readiness signal. It remains
sealed before database initialization/migration, reconciliation, listeners and
every producer. Missing/crossed capability, replay, source drift, unrelated
ordinary startup or a second claimant fails closed. Later pre-schema replacement
uses its independent normal operation-bound token, never the cold claim.

### Correct detached rebind transport

Version or explicitly tag the private transport authority. Do not describe a
direct signal/spawn as `/bin/launchctl kickstart` in a V1 receipt. Retain strict
historical V1 resolvers; bind the new exact action and transport projection to
the authorization, journal, settlement and typed downstream relations.

Resolve the target solely from the prepared immutable process authority. Freshly
reobserve PID, UID, start time, command, build root and identity under the lease
immediately before signalling. Signal only that authenticated process. Prove
termination before direct replacement launch; no broad process-pattern kill or
normal `stopSpawner()` call. Response loss must adopt the same authenticated
termination/launch prefix, never send a signal to a reused PID or dispatch twice.

## File map and verification

Expected existing-file scope: receipt authority and its tests; spawner and
owner-admission tests; startup admission and its tests; restart retirement/helper
and their tests; baseline plan and closure design. A small dedicated cold module
and focused test may be added if needed to isolate the new lifecycle; then update
the literal Task 0/P3 File Maps, projection manifests and source-boundary tests
together. No unlisted runtime source may escape manifest/build authentication.

First reproduce the history-generation and absent-spawner failures in disposable
fixtures, plus a real detached child showing watcher restart does not replace
it. Cover malformed/crossed history, physical swaps, global spawner ambiguity,
owner/process appearance, descriptor swaps, duplicate dispatch/claim, PID reuse,
controller/helper/child death, response loss, and premature 32/33 refusal.

### Fixed storage and explicit epoch genesis

Use one code-owned fixed-workspace locator for the private authority stores,
including their physical-directory validation anchors. The executing linked
worktree remains the source/build authority, not a second runtime-data root.
No environment root, symlink, search fallback, or automatic store migration is
introduced. Update every producer, reader and helper descriptor-path check
together and reproduce the linked-worktree mismatch in disposable fixtures.
Authenticate the physical ancestors lazily, before the first directory
mutation, and retain their identities until the owning directory guard closes.
No import-time filesystem mutation or arbitrary symlink canonicalization is
allowed. Fixture projections use one disposable workspace for every consumer.

Epoch absence is not epoch one. Introduce a distinct cold-recovery genesis
branch that holds the same physical transition lock without pretending a head
already exists. Under that lock authenticate the exact incident, clean source,
complete cold absence/zero-owner census, migration 31 and absence of 32/33/A,
and absence of conflicting restart/cutover history. Publish a content-addressed
genesis receipt, then create the bound epoch-one head without replacement;
fsync and reopen both before ordinary lease admission. Strictly resume only
the same authenticated publication prefix. Existing epoch two, conflicting
history or an unrecognized partial store must refuse, never reset or resurrect.

### Published findings versus active finding owners

Keep all findings and their statuses unchanged. Extract the existing complete
publication validation into a pure shared projection, and observe through
SELECT-only reads before 32. Authenticate canonical parent/child payloads,
set hash, exact members/fingerprints, terminal parent-run relation and absence
of associated outstanding ownership. Malformed, orphaned or incomplete sets
refuse; global runtime/recovery/effect census checks remain in force.

Bind the exact settled legacy set membership in a separately hashed inventory
inside versioned pre-32 evidence. Carry it transitively through the existing
guarded migration-32 authority chain; do not add a caller-supplied exemption,
timestamp cutoff, SQL schema change or synthetic reservation backfill.

After 32, a pending/bound reservation is outstanding ownership. A closed
reservation must authenticate the exact publication. A publication without a
reservation is settled only when its exact content identity and terminal
relation belong to the authenticated pre-32 inventory; otherwise fail closed
for missing admission provenance. Historical count-only evidence cannot grant
nonempty membership. Re-read publications to detect missing/crossed members.
The final ordinary verifier retains its exact pair graph.

Focused gates precede the full P3 receipt. Keep the ordinary 33-pair verifier
graph exact; new cold/transport history must be transitively authenticated, not
silently accepted. Review before delivery. Only after clean-main rollout prove
current-entry ready, 32/33 current, activation, canary and fresh complete-zero,
then Task 7 rebind and Task 8 backup. The A–E goal remains open until all its
acceptance outcomes are proven; external signed distribution remains deferred.
