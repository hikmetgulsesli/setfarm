# Stopped-spawner build retention design

Status: user-approved design; qualification in progress. No runtime authorization
record or maintenance-controller implementation.

## Objective and causal scope

PR #124 passed its exact P3 gate and was merged as `1c750547`.
Deployment remains blocked: eight retained generations prevent a build, existing
retention requires one authenticated live spawner, and the retained `eef9f6c4`
spawner cannot enter the new cold protocol against the newer source tree.

Add a separately versioned stopped-spawner retention path. Do not reinterpret
absence as a successful existing live-process proof. Keep the eight-generation
limit, candidate selection, existing historical parsers, and disposal checks.

The owner approved temporary suspension of only `com.setrox.setfarm-spawner`
automatic launching. Mission Control (3080) and dashboard (3333) stay running.
The sole approved disposal is ordinal 6, UUID
`fe73582c-5c6a-4cb8-9539-9546f0a169ba`, completion hash
`5838f5ee126247c7365794f694a722301cd09c96381065d1db24352c7a2b0097`,
19,336,294 regular-file bytes. Any candidate mismatch refuses this operation;
it must not silently substitute the next oldest generation.

## Alternatives

1. Recommended: authenticated launcher suspension plus a real controller-owned
   singleton reservation and new stopped-service evidence. This preserves old
   executable bytes and existing retention semantics, at the cost of a new
   maintenance lifecycle and crash tests.
2. Restore the retained executable through the current cold controller. Rejected
   for this state: both current and bundled old admission require source/build
   compatibility that the deployed pair does not possess.
3. Treat zero observed processes as sufficient, or raise the archive cap.
   Rejected: the former has a launch race; the latter bypasses the retention gate.

## Compatibility barrier

The old singleton implementation (`eef9f6c4:src/spawner.ts:453–480`) checks a
live PID but has unchecked stale-read/unlink windows. Merely stopping launchd,
holding a new maintenance lock, or observing zero processes is insufficient.

The maintenance controller must:

1. Authenticate the fixed launcher label, domain, plist, executable chain,
   retained build, current clean controller and exact approved candidate.
   Persist suspension intent before requesting bootout. Never edit the plist,
   launchd disabled overrides, executable permissions or environment.
2. Observe the launcher unloaded and drain its detached spawner/launcher
   families. Ambiguous identities refuse; do not kill by substring or broad PID
   enumeration. Any termination needs an exact authenticated target record.
3. Publish a fully populated singleton reservation without replacement. Use a
   prepared regular file and atomic no-replace publication, not an empty visible
   file followed by a PID write. The contents are the real controller PID, never
   a fabricated daemon PID; do not write `spawner.pid`. Bind descriptor, inode,
   parents, bytes, owner UID, PID and process start identity in separate evidence.
4. After publication, require a complete census of zero spawner contenders, then
   revalidate the reservation path/descriptor identity and bytes. A stale reader
   could have deleted the reservation and exited before census; this final
   identity check is mandatory. Failure permits no destructive work.
5. Keep this owner alive and the reservation held. Recheck the unloaded launcher,
   reservation, process families and candidate references at destructive edges.

After the successful bracket, a newly launched unchanged old spawner sees the
live owner PID and exits before writing its daemon PID or entering admission.
The source proof must cover early exceptions, duplicate exit, cleanup and signal
registration, and must be exercised against the retained executable contract.
The census must include alternate legitimate invocations of that same executable;
a single exact command-string match is not enough if aliases can evade it.

This excludes cooperative, unmodified platform entrypoints, not an arbitrary
same-user actor deliberately replacing files or modifying executable behavior.
Do not present periodic process observations alone as an atomic launch barrier.

## Evidence and disposal lifecycle

Introduce an explicit stopped-service operation version and a distinct tagged
zero-reference proof. Preserve V1/V2 validation and historical receipt handling.
The new proof binds current controller, retained build, launcher suspension,
reservation identity, owner lifetime, candidate inventory and existing reference
checks. Dashboard and Mission Control retain their actual loaded-process proofs;
do not manufacture a `loadedProcess` for the stopped spawner.

Keep existing no-replace operation/index publication, physical inventory checks,
candidate-specific quarantine authorization, rename/fsync, ordered per-file
deletion intent/completion and final disposition receipt. No manual deletion or
ledger adjustment is part of this design. Execute destructive filesystem work
in the reservation-owning process, never a detached cleanup child.

Suspension, reservation acquisition, quarantine and disposal each need durable
intent and completion evidence. A receipt proves history, not current exclusion.
On restart, authenticate the journal and physical partial state, then establish
a fresh reservation/census/revalidation bracket before any further deletion.
Never reclaim a live or ambiguously reused PID. A stale operation alone cannot
authorize removal of another owner's lock or a newly running spawner.

## Build and restoration boundary

Disposal completion does not mean ordinary spawner activation is safe. Do not
bootstrap the launcher in a generic `finally` block. Record maintenance as still
open until the guarded current build and the existing sealed cold-start handoff
can be completed under authenticated ownership.

Before any live disposal, an integration test must prove the complete transition:
archive slot freed → guarded current build → durable current-ABI sealed startup
authority → reservation release to the authorized cold-start controller → valid
sealed successor → restoration of the original automatic launcher. Ordinary
admission remains governed by Task 6A; retention cannot authorize it.

Before reservation release, prove that durable admission authority rejects every
unauthorized ordinary startup, including death between release and child lock
acquisition. Cover processes that loaded old modules before build publication:
new files do not upgrade an already-loaded process. Authenticate and drain those
contenders while the reservation remains held, and repeat the bracket afterwards.

If build or handoff fails, keep automatic launching suspended and preserve the
maintenance journal; report the exact recovery phase. This suspension is only
valid for the observed boot session: bootout does not persist across reboot.
Resumption must reobserve live state, freshly suspend any reloaded launcher and
reestablish exclusion before disposal; never replay an old lock or blindly reload
launchd. Reboot and controller death invalidate prior exclusion evidence.

An additional preflight prerequisite is durable ordinary-admission refusal that
is understood by the retained executable as well as the new build and survives
reboot. Observe and authenticate that refusal before suspension; test it across
all unfinished build/handoff phases. The retained gate explicitly allows normal
startup for an absent status (`eef9f6c4:src/spawner.ts:9890–9894`), so an absent
store cannot satisfy this prerequisite. Do not fabricate an admission record to
make preflight pass. Whether the current live history supplies this authority
remains to be verified; until proven, the design is not executable on this host.
If the existing protocol cannot supply it, report the missing invariant and
revise the design before implementation or live mutation. Restoring the launcher must
verify the original authenticated configuration and record its observed result.

## File map for the implementation plan

- `scripts/build-generation-retention.mjs`: version dispatch and integration with
  unchanged candidate/quarantine/disposal machinery.
- New focused script module: launcher maintenance lifecycle, singleton barrier,
  owner identity and journal validation; keep it independent of archive deletion.
- `tests/scripts/`: deterministic interleaving, journal and controller tests.
- Existing retention integration tests: stopped/live tagged proof compatibility,
  crash recovery and exact approved-candidate refusal.
- Baseline implementation plan: causal relation, File Map, maintenance/build/
  sealed-handoff sequence and evidence requirements. No weakened OA18 rule.

## Required verification before live execution

- Existing live proof still rejects zero/multiple daemons and crossed identities.
- Launch before publication, stale-read/unlink before and after publication,
  empty-file visibility, contender exit before census, replaced reservation,
  alternate invocation, duplicate exit, and signal/exception cleanup.
- Controller death at every durable edge, PID reuse, surviving child prohibition,
  crash after rename or one unlink, and exact partial-operation adoption.
- Launcher configuration drift, failed/ambiguous bootout, reboot, refused restore,
  candidate drift, unexpected references, symlink/parent replacement and ambiguity.
- No writes to daemon PID, MC/dashboard configuration, secrets, disabled overrides
  or retained executable bytes. No cap increase, fabricated process or override.
- Focused tests, proportional integration coverage, clean build and independent
  review. Docs-only preparation does not rerun the seven-hour P3 gate.
- Full build/sealed-successor/restoration integration passes before authorizing
  the first real archive mutation; if it cannot, retain this as an unimplemented
  design and report the specific missing invariant.
