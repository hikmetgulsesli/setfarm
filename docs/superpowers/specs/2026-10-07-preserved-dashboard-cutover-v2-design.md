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

The existing synchronous maintenance-observer call is one read-only component
port: its internal four OS queries finish as a bracket; this primitive checks
burn on its return, not between those trusted helper queries. No later component
port or mutation is allowed after a swallowed reentry. Per-query helper abort is
not claimed by these tests or this reservation contract.

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

### Task4a.1 held empty-retirement-history assertion

The old absent-helper holder rejects the retirement root itself; it cannot
coexist with our original reservation. For the initially empty-history route,
add assertDashboardCutoverEmptyRetirementHistoryV2(handle) to the same V2 module.
It consumes ONLY its authentic privately held serialization handle and returns
void. No caller paths, labels, ports, snapshot object or separate authority token.
It reuses original root/lock/ancestry custody; no additional component-owned
returned FD is acquired. Read-only observer/readdir provider internals may own
encapsulated resources; this leaf adds no fs.openSync acquisition or ledger slot.

Operation sequence: authentic lookup/active entry; actual owner + physical;
capture original-held and named root FULL metadata (CORE plus size,nlink,mtimeNs,
ctimeNs); root readdir; exact single member physical-service-restart-authority.transition.lock;
physical + actual owner; second exact readdir + physical; require original-held
and named root FULL metadata still equal that same first witness. No repinning
across the owner/metadata bracket. Existing directory CORE checks alone do not
prove membership continuity. Enumeration must be an exact nonproxy dense plain
array with only its one string element and length; no accessor/proxy traps.
Each component port
uses the same post-return burn check. Success leaves the original handle held;
any unknown/malformed/drifting member result or observer/physical fault burns
and once-drains only known original sealed descriptors, preserving path evidence.
Reentry and foreign handles have the existing strict disposition.

Any other retirement-root child, including symlinks, unheaded registry artifacts,
partial stages, cold/direct history or epoch metadata, refuses without parsing,
following, deleting or repairing it. This route does NOT accept settled history:
a later retained settled-history graph requires its own nomination. The exact
one-member graph proves only absent subordinate helper/retirement history at
these live assertion boundaries, not process absence or freedom from a paused
old unlinker. Already-entered stale helpers/no-FD queued callers, physical+DB
owners, delivered source/phase graph and effect admission remain separate gates.
Do not call the old census or introduce a wrapper around its absent-root guard.

Owned real-FS tests must assert successful void/no-new-FD behavior and continued
held reservation, refusal/preservation for unheaded registry/cold/direct/staging/
unknown/symlink entries, actual owner-boundary member drift, swallowed readdir
reentry, transient add/remove detected by FULL metadata, malformed enumeration,
and foreign-handle no-burn. Genuine missing-export RED precedes source.
This is a causal refinement of Task4a, not the complete Task4b contender holder.

### Task4b.0 direct per-process root-FD diagnostic provider

Create scripts/deployment-dashboard-cutover-root-fds-v2.py and matching builtin
script test. This is a bounded read-only provider, NOT the complete contender
holder, process enumeration, quiescence, alias/fileport census or permission to
operate services. Do not add a live entry or Task3 capability from this unit.

The Apple published proc_listpidspath wrapper skips per-process errors as well
as nonmatches; parent/self positive witnesses cannot cure that omission. Avoid
that wrapper. Use direct typed libproc proc_pidinfo/PROC_PIDLISTFDS and
proc_pidfdinfo/PROC_PIDFDVNODEINFO, propagating EVERY query error or short result.
Reference: https://github.com/apple-oss-distributions/xnu/blob/f6217f891ac0bb64f3d375211650a4c1ff8ca1ea/libsyscall/wrappers/libproc/proc_listpidspath.c
Published source is not a verified version match to this installed26.5.2 host.
Installed SDK labels these private/version-sensitive APIs; fixture qualification
does not confer account-wide completeness or atomicity.

Fresh provider runs only via trusted /usr/bin/python3 -I -S -B, cwd/, sanitized
environment, no compile/build/deployment or library substitution. Maximum wire
size65536 bytes; read at most65537 bytes for overflow detection and require EOF
before ANY native query. Require exact canonical JSON+LF; request exactly schema,rootDev,
rootIno,pids. Schema setfarm.dashboard-cutover-root-fd-request.v2. Device/inode
are canonical positive decimal strings fitting uint32/uint64. PIDs are a dense
sorted unique list1..64 of positive int32 PIDs, including the ACTUAL parent PID.
Account UID/GID, observer/parent PIDs are OS-derived, never requested labels.
Root labels grant nothing; parent must itself supply at least one matching
directory FD as an actual positive fixture/provider witness.

Fixed-width SDK-derived ctypes structures: BSD136 (start offset120), FD8,
fileinfo24, vinfo_stat136, vnode_info152, vnode_fdinfo176. Assert sizes/alignment/
critical offsets before querying. Load ONLY /usr/lib/libSystem.B.dylib using
ctypes.CDLL(use_errno=True). proc_pidinfo argtypes are c_int,c_int,c_uint64,
c_void_p,c_int; proc_pidfdinfo argtypes c_int,c_int,c_int,c_void_p,c_int;
both restype c_int. Flavors: BSD3, FD list1, vnode FD1. BSD UID/GID offsets20/24,
PGID100/start120; FD type4; stat dev0/mode4/nlink6/ino8/uid16/gid20;
vnode type136/fsid144; vnode_fdinfo pvi24. Alignment BSD/stat/vnode/fileinfo8,
FD4. Clear/read errno at every typed call. Max4096
FD slots per requested PID; reject zero/short/misaligned/saturated results,
duplicate/negative FD numbers, unsupported descriptor types and ambiguous/dead/
foreign-account process metadata. Accept only BSD status2/3/4 (runnable,
sleeping/stopped), no INEXIT flag4, positive PID/PPID/PGID/startSeconds,
startMicroseconds<1000000; effective/real/saved UID and GID must all equal actual
observer UID/GID. BSD xstatus must be0. Descriptor types exactly vnode1 or
known nonvnode {0,2,3,4,5,6,7,9,10,11}; unknown8/other refuse. Max16384 aggregate
FD entries across requested PIDs, canonical output at most1048576 bytes, checked
before stdout. Known nonvnode FD types are outside this
explicit FD-only report; fileports/CWD/mappings/deleted-path coverage is NOT
claimed. Vnode records must be exact-sized; used dev/ino must be positive,
vnode types1..7 must agree with stat file-kind bits (regular,directory,block,
character,symlink,socket,FIFO respectively). Unused reserved fields confer no
proof. Never silently
drop a revoked/vanished/inaccessible vnode or process.

For each requested PID: actual BSD identity -> FD list -> every vnode detail ->
repeat all matched-root vnode details -> second FD list -> second BSD identity.
Repeated matches must retain exactly {fd,dev,ino,mode,uid,gid,nlink}; no union of
historical matches. Require unchanged PID/account/parent/group/
start tuple and unchanged FD-number/type vector. Root matches bind dev/inode and
directory mode from those actual vnode records, including directory vnode type2
and actual account UID. This supplies two bracketed samples, not mutation-free global
continuity. No signal, close of another process's FD, repair, acquire or service
call. The provider owns no extra returned root FD; requested processes keep their
originals. Fresh child must exit naturally with exact stdout/stderr dispositions.

Return exact canonical JSON+LF with schema,authority,coverage,uid,gid,observerPid,
parentPid,rootDev,rootIno,processes. Schema setfarm.dashboard-cutover-root-fd-diagnostic.v2;
authority diagnostic-only; coverage requested-process-vnode-fds. Process entries
exactly pid,ppid,uid,gid,pgid,startSeconds,startMicroseconds,fds,rootFds. fds is the
sorted list of {fd,type}; rootFds sorted {fd,dev,ino,mode,uid,gid,nlink}, dev/ino
decimal strings. No zero-owner, complete, permission or authority-derived flag.
On any input/query/validation uncertainty stdout empty/nonzero natural exit and
fixed refusal stderr. Publication/transport failure may leave bytes but must
refuse; a parent may accept ONLY full canonical bounded stdout, empty stderr,
zero natural exit and both error-free EOFs. Never accept a partial usable report.
Parent transport/future capability remains
separately nominated and must deeply freeze/recheck this diagnostic.

Real owned fixtures qualify actual parent/root FD, foreign child root FD,
inherited/duplicated FD, neighbour inode, renamed-but-held original and natural
holder exit. Include strict wire/field/count refusal and actual exited-PID query
refusal. No backend/OS policy stubs or live authority roots. Missing-provider
RED precedes production; native read-only recipe is new, not a replay of any S10
sample. Unsupported platform/provider behavior refuses; platform skips outside
Darwin are not host qualification. Keep all private fixtures/evidence retained.

Exact new fixture recipe: env-i PATH=/usr/bin:/bin LANG=C LC_ALL=C fixed installed
Node26.4.0 --test scripts/__tests__/deployment-dashboard-cutover-root-fds-v2.test.js.
Nine sequential retained private mkdtemp roots, one parent original/root; six
actual holders across cases (five Node, one isolated Python), at most one
concurrently. One case inherits FD3 and uses actual os.dup(3) as a second
descriptor; a failed /dev/fd/3 setup attempt is retained, not qualified as RED.
Use bigint inode/device witnesses.
Each Python query receives closed bounded stdin; capture at most1MiB total output
and require natural process close, explicit stdout/stderr EOF and no stream
errors within10s. No signal/retry on timeout; preserve unknown original custody.
Each holder receives stdin EOF once, memoized natural close/EOF settlement;
parent original closes checked-once only after all holder observations settle.
Incremental holder output parsing is bounded before buffering complete lines.
Register every returned original before first fallible fstat; failed sealing
retains it. Root/fixture paths remain intact. RED has source absent, hence zero
libproc calls; separately review exact source bytes before native-query GREEN.

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
Create scripts/deployment-dashboard-cutover-root-fds-v2.py and matching builtin
script test as a separately qualified diagnostic-only provider; not an entry gate.
Create scripts/deployment-dashboard-cutover-v2.mjs and builtin entry test.
Update applicable approved source inventories/manifest tests and affected package
test commands only when adding the actual consuming production unit. Record those
exact updates before that task; do not weaken source authentication.
No changes to PR275, native modules or existing accepted recipes.
