# Preserved dashboard cutover V2 design

## Causal correction and approved boundary

Implements September16 preserved-deployment-cutover steps1–5. Dashboard recovery
is an intermediate checkpoint, not Task6A readiness or whole-cutover completion.
The existing CLI/dashboard path does not invoke experimental S10 native code.
Its universal retained-terminal research is NOT a prerequisite for this ordinary
dashboard transition. The previous private master plan conflated these domains.

Use standing owner authorization and the already-approved preserved route.
Root alone writes; independent reviewers stay read-only. Preserve both original
dirty files, selected bootstrap source/build/CLI until a qualified transition,
all archives, candidate ae5 build and native fixtures. No runtime/test bypass,
secret/access change, erased source, archive disposal or direct main commit.

Alternatives: rebuild/copy into the frozen selected checkout violates preservation;
direct daemon start skips the required cutover ownership/journal; the selected
path is a complete, durable, capability-bound controller through dashboard step5.

## Scope / ordered operations

A new V2 history namespace records these exact operations in order:

1. bootout-spawner
2. bootout-dashboard
3. drain-old-dashboard
4. select-new-cli
5. restore-dashboard-launcher
6. authenticate-new-dashboard

Each operation has a durable intent before dispatch, at most one dispatch attempt
in the live controller, and completion only after authoritative post-observation.
A pending intent stops later steps. Do not retry a possibly completed operation.
Recovery authenticates a new current owner and the exact physical partial state;
unknown/alive/reused prior owner refuses takeover. A recovery completion may bind
a different current completion owner, but must retain the original dispatch owner
and exact intent hash. History is NEVER ownership, exclusion or dispatch authority.
Later intents may name a different owner after the prior completion; all intents
share one cutoverIntentHash. This grammar permits historical recovery linkage,
not takeover authority. The live adapter separately proves the new owner and
prior-owner death; a completion's original owner must equal its original intent.

Legal completed outcomes: operations1/2 launcher-unloaded; operation3
original-process-exited OR already-absent; operation4 selector-selected;
operation5 launcher-restored; operation6 dashboard-authenticated.
Already-absent is NOT a death certificate and is allowed only from a positively
qualified held absence profile, not a caller boolean.

## Units and interfaces

V2 records module exports create/encode intent, create/encode completion and
parse history. Intent input:
`{cutoverIntentHash, ownerClaimHash, ordinal, previousCompletionHash,
beforeObservationHash}`. It derives fixed action, maximumDispatchCount1, schema,
purpose, self hash/ref. Ordinal1 requires previousCompletionHash null;2..6 SHA256.
Completion input:
`{intent, completionOwnerClaimHash, afterObservationHash, outcome}`.
It retains the original ownerClaimHash and binds the completion owner separately.
Strict canonical UTF8 bytes, exact own data fields, no proxies/accessors/symbols,
no sparse/oversized arrays, self hashes/refs and ordered linked prefixes required.
Empty, settled-prefix, unsettled and dashboard-recorded history are distinct.
Dashboard-recorded remains history-only, never READY or cutover completion.

### Exact Task1 wire

Purpose literal for both records: preserved-dashboard-cutover.
Intent schema: setfarm.internal-production-dashboard-cutover-effect-intent.v2.
Intent body has exactly schema,purpose,cutoverIntentHash,ownerClaimHash,ordinal,
previousCompletionHash,beforeObservationHash,action,maximumDispatchCount.
Append only effectIntentHash and effectIntentRef. Ref prefix:
setfarm://internal-production/dashboard-cutover-effect-intent/sha256/.
Completion schema:
setfarm.internal-production-dashboard-cutover-effect-completion.v2.
Completion body has exactly schema,purpose,effectIntentHash,cutoverIntentHash,
ownerClaimHash,completionOwnerClaimHash,ordinal,action,afterObservationHash,outcome.
Append only effectCompletionHash and effectCompletionRef. Ref prefix:
setfarm://internal-production/dashboard-cutover-effect-completion/sha256/.
Every hash is64 lowercase hex; maximumDispatchCount is the literal number1.
Self hash is SHA256 of canonical UTF8 body WITHOUT newline and WITHOUT self pair.
Wire is canonical UTF8 entire record followed by exactly one LF;1..65536 bytes.
Use the existing canonical-json primitive's UTF16 key order and scalar semantics.
Input arrays are dense ordinary arrays of canonical Buffer records, length0..6;
copy Buffer bytes without invoking overridden methods. Reject proxies/accessors,
symbol/extra/nonenumerable fields and sparse arrays before consuming their values.
Those field rules apply to records and array containers. Byte containers must be
genuine nonproxy bounded Buffers; extra Buffer properties are ignored, never read
or invoked. Intrinsic TypedArray operations supply their length and owned copy.
Buffer ancestry is checked without invoking proxy traps, with at most128
nonproxy intermediate prototypes; unknown/proxy/unbounded ancestry refuses.
Parser output has exactly schema,authority,historicalState,intents,completions.
Schema: setfarm.internal-production-dashboard-cutover-history.v2.
Authority: history-only. State: empty for0/0; unsettled for one unmatched final
intent; recorded-prefix for1..5 complete pairs; dashboard-recorded for6 pairs.
No other unmatched/successor ordering is legal. Output records/arrays/tree frozen.

V2 store exports observe, publish intent and publish completion with mandatory
expected store-observation hash. Fixed account-derived workspace authority:
data/internal-production-baseline/deployment-dashboard-cutover-v2.
Hold/recheck nofollow ancestors/files; owner/mode/device/count/size constraints,
exclusive temporary publication, fsync file and containing directories, immutable
committed links, checked-once closes. Preserve stages; unknown sync/close burns
future access. V1 grammar/store and every historical receipt remain unchanged.

### Exact Task2 storage nomination

Export observeDashboardCutoverStoreV2(), publishDashboardCutoverIntentV2(record,
expectedObservationHash), publishDashboardCutoverCompletionV2(record,
expectedObservationHash). The expected hash is mandatory64 lowercase hex, never
an authority grant. Namespace is deployment-dashboard-cutover-v2 under the fixed
account-derived baseline root. Ordered names alternate intent-0001.json,
completion-0001.json through intent-0006.json,completion-0006.json; no gaps.
Committed bytes use Task1 encoders. Every committed inode retains exactly one
same-inode UUIDv4 temporary alias and nlink2. Stages use
.<fixed-name>.<lowercase-UUIDv4>.tmp; no stage unlink or replacement publication.
Unknown names, more than32 names or more than8 inert stages refuse. An inert
stage is observational needs-reconciliation and blocks every publication.

Return exact frozen observation fields: schema,authority,storageState,
rootIdentityHash,ancestorIdentityHash,pendingStageCount,files,history,
storeObservationHash. Schema: setfarm.internal-production-dashboard-cutover-store.v2;
authority history-only; storageState settled or needs-reconciliation. Missing
root is observed without creation and has rootIdentityHash null. History is the
Task1 frozen parser output. Sorted frozen file entries contain exactly name,
identityHash,bytesHash,byteLength,kind. Kind: committed for fixed names;
inert-stage for nlink1 temporaries; committed-alias for qualified nlink2 aliases.
Identity projections match the existing V1 store: directory dev,ino,mode,uid,gid,
birthtimeNs; file adds size,nlink,mtimeNs,ctimeNs. SHA256 bytesHash hashes raw bytes;
other hashes use canonical-json bodies without self hash. Ancestor hash binds
every held ancestor path/identity, including the baseline parent but not root.
Unknown sync/close makes access sticky-invalid in that module instance. A fresh
instance must reobserve exact physical evidence; no automatic physical-effect
retry. Exact existing record publication may durably resync without changing its
inode. Storage has no dispatch/exclusion/recovery-owner authority.
Reuse the existing baseline-deployment-cutover-service-effect-store-v1.ts entire
physical guard and bracket/recheck profile, except namespace, grammar, order and
counts: at most128 lexical ancestor segments; existing workspace/data/baseline
required, same owner UID/device and no group/other writable scope directories;
root0700, regular files0600, nofollow, bounded0..65536 byte stages and1..65536
canonical committed records; same original ancestor/file descriptors/identities
through publication and checked-once closes. Missing baseline is invalid, not an
instruction to create the workspace. A missing V2 root alone may be created only
for first intent with the matching observed missing-root hash.

Controller exports a run/reconcile operation consuming a LIVE opaque capability
from the qualified adapter, not inspection JSON or permission booleans. It owns
serial state, intent-before-dispatch, exact action selection, once-only attempts,
post-observation-before-completion and rechecks through all await boundaries.
No port/result/hash alone grants authority. Reentry/failed owner recheck burns
the controller and stops later operations while preserving journal evidence.
Its exact capability-authentication contract must be independently nominated
before Task3 production authoring. Fixture ports cannot supply that proof.

Production adapter composes existing authenticated source/build, selector,
launcher, passive process, helper/phase and positive physical+DB observations.
It must hold cross-process direct/cold producer serialization in addition to
ordinary-spawner refusal; ordinary refusal does not cover authenticated routes.
Drain every exact loaded old family and queued contender. Reboot requiesces and
reauthenticates launchers; bootout alone is not reboot-persistent exclusion.
The threat model is cooperative platform entrypoints, explicitly NOT a same-user
actor deliberately launching retired executables. Do not import the broader
archive-erasure adversary into this approved preserved route.

Phase V2 separately enumerates controller/fence/journal resources and permitted
exact dashboard targets; unrelated runtime owners stay zero. Authenticate
delivered producer presence; do not turn old absence profiles or total-owner-zero
claims into exceptions. A preflight snapshot is not the live exclusion capability.

### Task4a prospective serialization primitive (not complete effect admission)

Add scripts/deployment-dashboard-cutover-serialization-v2.mjs and matching
scripts/__tests__/deployment-dashboard-cutover-serialization-v2.test.js.
This primitive supplies only an authentic original-process-owned reservation
against FUTURE cooperating direct/cold acquisitions, never owner-claim, DB,
stale-contender quiescence, service-effect or READY authority. The complete adapter
must separately authenticate the existing owner handle, physical+DB inventory,
already-entered stale cleanup/helper/queued-contender drain and source/build.
Do not begin Task3 authoring or any live call from this component alone.

Proposed exports acquireDashboardCutoverSerializationV2(input),
assertDashboardCutoverSerializationV2(handle), releaseDashboardCutoverSerializationV2(handle).
Input exactly {cutoverIntentHash,ownerClaimHash}, both64 lowercase hex; those
labels alone grant nothing. Input is copied from a nonproxy Object.prototype
plain record with exactly those own enumerable data properties. Reject proxies,
accessors, symbols, nonenumerable/extra fields and malformed hashes before any
observer/FS work or acquisition-attempt consumption. Invalid idle input does not
consume the attempt. An already-active operation always detects and burns reentry
before further caller-input handling. Handle is a frozen empty null-prototype object in a
private WeakMap. Copy/proxy/foreign/released handles refuse without caller code.
At most one acquisition attempt per module instance; EEXIST always refuses,
including dead/malformed locks. No V1 repair/reclaim/genesis/epoch APIs are used.

Account-derived path is the existing data/internal-production-baseline/
restart-authority-retirement-v1/physical-service-restart-authority.transition.lock.
Existing workspace/data/baseline required; at most128 held nofollow ancestors,
same owner UID/device for scope directories, no group/other writable scope.
Retirement parent0700 may be exclusively created and parent-fsynced; existing
parent must authenticate. Do not create an epoch, genesis, helper or service.
Original lock is exclusively created nofollow0600/nlink1, held in an immediate
resource ledger, written/readback/fsynced with original ancestry brackets and
parent directory sync BEFORE minting a handle. Setup failure preserves the lock;
there is no repair unlink. Retained original-resource state must remain reachable
after unknown results; never retry uncertain close or begin another acquisition.

Wire body exactly schema,purpose,cutoverIntentHash,ownerClaimHash,owner;
schema setfarm.internal-production-dashboard-cutover-serialization-lock.v2;
purpose preserved-dashboard-cutover. Owner is the existing authentic maintenance
observer tuple uid,pid,processLstart,processGroupId,bootSessionHash,reservationNonce,
observed for the actual current process, with code-minted UUIDv4 nonce. Append
only lockHash = existing canonical-json-compatible SHA256 body without LF.
Wire canonical UTF8 entire record plus one LF, bounded1..65536 bytes. Reuse actual
build-generation-maintenance-owner-observer.mjs and its journal normalizer; both
belong to the eventual authenticated entry closure. No injected observer ports.

Assertion rechecks original owner live_match, same account, original ancestor
descriptors/paths and complete original lock bytes/identity. Any failed held
assertion permanently burns this handle/module. Release is a reservation-resource
operation only: live original owner and exact original lock must still match;
premark unlink, parent-sync and each close attempt, check original unlinked inode
transition, and never retry an unknown result. It grants no effect settlement;
the future complete adapter must not release it while any effect/owner remains
unsettled or stale cleanup is unqualified. No generic finally release in controller.

Operation FSM: idle -> acquiring -> held -> releasing -> released; any uncertain
operation or held-assertion drift -> burned. active is set before all external
observations/ports; nested acquire/assert/release burns the current operation,
even when a test fault boundary swallows the nested exception. Every resumed
operation checks the original FSM/active owner before its next port. Foreign
idle handle lookup refuses without touching caller fields or burning an unrelated
valid held handle. Burned/unsealed handles cannot enter normal release.

Acquisition brackets actual owner observation with full physical rechecks once
originals exist. Immediately before handle mint, repeat actual owner live_match
and original physical checks; no pending sync/close may remain. Release similarly
performs owner+physical+owner+physical checks before its FIRST unlink. After an
owned unlink, only the retained original inode may explain nlink1 -> nlink0;
never authenticate or remove a later pathname owner as cleanup.

Resource slots are registered immediately upon each returned FD, BEFORE first
fallible fstat. States unsealed -> sealed -> close-attempted -> close-settled;
throwing close consumes its attempt and remains close-unknown. Store original
identity, returned FD and close-state in a retained module-owned vault even when
no handle was minted. Unsealed identity cannot authorize unlink or close. On
setup failure preserve every created pathname and prohibit repair unlink; once-
close only definitely owned sealed untouched FD slots, checking retained-original
descriptor identity, not mutable pathname. Unknown/unsealed slots remain reachable.

Release ordering: premark unlink -> unlink -> original inode transition check ->
premark parent-sync -> fsync parent -> once-close lock then ancestors in reverse.
An unlink/sync/close error marks its attempt unknown, stops later release ports,
burns the module and never publishes released state. A separate bounded failure
cleanup may once-close OTHER definitely-owned sealed untouched originals only;
it never repeats an attempted/unknown slot, unlinks, syncs or reacquires. A failed
cleanup identity check preserves that original without a close. Continue checking
other distinct owned originals; never convert uncertainty into release authority.
Normal successful release retires WeakMap custody only after ALL original slots
are definitely settled. No unknown result reopens release/acquisition admission.

The V2 schema blocks newly entered V1 reclaim before owner observation/unlink,
including after V2 owner death/reboot. It cannot stop an already-entered V1
reclaimer paused after final lstat and before unlink. Fixture tests must preserve
that interleaving as a negative admission case; O_EXCL/schema alone never proves
the complete frozen-owner contract. Separately authenticated old-family drain is
still a prerequisite for live adapter admission and release.

The bootstrap authenticates the complete delivered source/build/loader closure
before constructing the adapter. Closed explicit modes; no ambient opt-in that
grants authority. Existing inspection entry remains diagnostic. A new real
activation command requires all adapter and crash qualifications first.

## Verification / delivery / deployment

TDD covers real record parsing, real private filesystem publication, actual
controller ordering and preserved unknown states. Mock only OS/launchd effect
boundaries for finite unit tests; they cannot qualify a live adapter. Qualification
uses owned fixtures, never invokes live launchers through tests and never replays
accepted native recipes. Compile/noemit, old affected suites, source inventories,
English/path/version and independent review precede delivery.

New deployment for a NEW delivered controller revision may follow approved
September16 step1 after separate preservation/budget review. This is not another
build of accepted eight-cap ae5 candidate and not a failed-build retry shortcut.
All old deployments/archives remain intact. No build/candidate rotation is
authorized merely by this development document.

Live step5 requires actual new process birth/executable/source/build, listener3333
and HTTP identity. Preserve MC3080/gateway18789. Leave durable ordinary-spawner
refusal open; do NOT publish final completion or claim Task6A/P2/full recovery.

## File Map

Create paired spec/plan2026-10-07-preserved-dashboard-cutover-v2.
Create src/internal-production/baseline-dashboard-cutover-records-v2.ts and test.
Create baseline-dashboard-cutover-store-v2.ts and test in those same directories.
Create baseline-dashboard-cutover-controller-v2.ts and test.
Create scripts/deployment-dashboard-cutover-adapter-v2.mjs and builtin script test.
Create scripts/deployment-dashboard-cutover-serialization-v2.mjs and builtin test
as the separately reviewed Task4a reservation primitive; include both existing
maintenance observer/normalizer scripts in the eventual authenticated closure.
Create scripts/deployment-dashboard-cutover-v2.mjs and builtin entry test.
Update applicable approved source inventories/manifest tests and affected package
test commands only when adding the actual consuming production unit. Record those
exact updates before that task; do not weaken source authentication.
No changes to PR275, native modules or existing accepted recipes.
