# Task6A protected private source-entry bootstrap v2

## Ordinary direct-parent task-port acquisition slice

Status: ordinary refusal and finite synthetic-request lifecycle checkpoints.
Actual own-child/thread/join/reap were observed in two synthetic cases; no
genuine task_for_pid capability experiment or protected admission. The delivered
ordinary NAME slice PR274 is complete at main
ae5a7b0e56e999255c4beb6937ea63e563f930e8. Its actual NAME support is not
CONTROL availability. This next causal P2 experiment asks whether one ordinary
direct parent can obtain a valid task_for_pid result for its actual own Node
child without changing host security, privilege, policy or production guards.

Four-file map: create scripts/task6a-origin-native-task-port-v2.c and
scripts/__tests__/task6a-origin-native-task-port-v2.test.js; refine only this
named spec and its named plan. Do not modify the delivered NAME diagnostic,
entry/bootstrap/map helpers, packages, live selectors, DB or old roots.
Root alone writes/delivers. All retained roots/builds/failed artifacts and the
original two dirty files remain visible and intact.

### Architecture choice and scope

Choose one ordinary fixed C owning process with one joinable request pthread.
Only the main thread owns child birth, pipes, failure ledger, signals and reap.
The request thread has one immutable locally captured PID and private result
slot; it makes at most one task_for_pid call. It never reaps, signals, runs a
protocol, publishes output or chooses another target.

Rejected alternatives: a Node owner cannot supply this exclusive native reap
contract; a separately spawned C worker can survive owner loss and use a PID
after reparent/reap; post-fork Mach/pthread/library work lacks an admitted
async-signal-safe closure. A synchronous call in the sole monitoring thread
could block its deadline observation. No private-PID transport or sibling-target
claim is carried forward from the earlier unadmitted CONTROL proposal.

The program takes no caller argv/PID/path/options/configuration. Refuse extra
arguments, root and real/effective UID mismatch before any pipe/thread/spawn.
Use the same fixed ordinary Node26.4.0 and adjacent delivered builtin entry as
the NAME diagnostic, literal scrubbed child environment, private standard pipes,
checked spawn actions and CLOEXEC_DEFAULT. No library import flags or public
test switch enter the C interface. Source-adjacent location is fixed by the
separately reviewed absolute compiler source placement, not a cwd lookup.

### Request admission, publication and lifetime

Use C11 atomic admission states READY, IN_FLIGHT, BURNED and BURNED_IN_FLIGHT.
Worker CAS READY->IN_FLIGHT competes with main's burn of READY->BURNED.
Once admitted, main may change IN_FLIGHT->BURNED_IN_FLIGHT; it cannot retract
that call or promise its kernel-entry instant preceded burn. The captured target
generation stays reserved through the admitted request and checked join.
Worker checks the original monotonic deadline before admission. Clock failure
or a failed admission yields no native call, and a separately tagged unavailable
result rather than a synthetic kernel return. Never retry after burn.

The immutable request contains captured child PID and self task port. Worker
alone writes attempted/status/returned-right fields. It initializes the right
slot to MACH_PORT_NULL, calls task_for_pid at most once, stores the actual return,
then release-publishes completion as its last result write and returns.
Main acquire-loads completion, then performs exactly one checked pthread_join
before inspecting result fields, reaping the target or returning from main.
A completion flag alone is not thread settlement. Creation failure means no
thread exists: consuming target reap is permitted only when no request thread
was ever created, or after successful checked join. This does not waive child
ownership/exit/EOF/disposition checks. Join failure/uncertainty preserves a failed owner, not detachment
or an invented joined state. No pthread_cancel, pthread_detach, pthread_exit of
the main owner, _exit, process kill or timeout handler substitutes for joining.

While request lifetime is pending, clear siginfo_t and use only exact
waitid(P_PID,captured_pid,...,WEXITED|WNOHANG|WNOWAIT) for child death observation.
Require matching PID and a genuine exit kind; zero PID means no returned event.
Observed death burns validity and forbids signals. Unexpected identity or wait
ownership failure is sticky uncertainty and forbids further PID operations.
Never use broad waits or a competing reaper. Consuming waitpid for the captured
target is allowed only when no request thread was ever created, or after checked
successful join; an attempted/failed join is not sufficient.
Never configure SIGCHLD ignore/SA_NOCLDWAIT or allow a competing child reaper.
The existing NAME observe_child/settle helpers therefore cannot be copied
unchanged into the pre-join phase.

Main keeps bounded nonblocking streams and a nonrenewable three-second validity
budget. Expiry burns qualification, closes input and contains only the known
original unconsumed child through separately bounded grace/TERM/KILL phases.
Do not signal an observed-dead or uncertain child. Continue draining without
consuming target status while the request is pending. A blocked request retains
the failed C owner, waitable child status and original resources indefinitely,
with bounded buffers/50ms backoff; no hard three-second return or reclamation
guarantee is claimed. Do not kill the owner to make a test finish.

After successful join, register every non-null/non-dead returned candidate name as an original
cleanup obligation before fallible result classification, even if the API
returned failure. A late/burned return allows once local disposal only: no PID,
audit or positive classification. Consume the disposition slot before one
mach_port_deallocate attempt; retain any disposition error separately from
capability denial. A dead/null name is not a valid acquired send right.

Only an on-time genuine successful return can continue to local right type,
pid_for_task and exact-count full opaque audit validation, three distinct nonce
exchanges, second live audit BEFORE END/input EOF, exact END/EOF/status/reap and
once original-right disposal. These post-join queries remain conditional on
ordinary kernel-call return, as in the delivered NAME diagnostic; continuous
deadline monitoring during those synchronous queries is NOT claimed. Sample
the unchanged deadline after completion, after join and before/after forward
calls. No query exports audit bytes, PID or a right as authority.

### What the result does and does not establish

Successful output names task-for-pid-right/unqualified, not usable CONTROL.
It records actual attempt/right binding/protocol/thread join/child reap/EOF/
disposition with productionAuthority:false, controlUsable:false,
completeNativeClosure:false and protectedOrigin:false. This slice performs no
CONTROL-consuming lockdown, suspend, VM operation or mapping query. A valid
returned task right and NAME-flavor audit query cannot prove a subsequent
CONTROL conversion would be allowed. Actual denial/null/dead/count/drift/
deadline/cleanup failures remain distinct and cannot turn nominal acceptance
into skip, fallback or policy changes.

Primary published XNU12377.121.6 kern_proc.c5865–6011 binds/retains the selected
task before the possible taskgated upcall at5960; NAME follows a separate route.
ipc_tt.c converts task_for_pid's result with CONTROL flavor, but its foreign
CONTROL conversion policy is a distinct constraint. kern_exit.c1761–1762 and
proc_exit2299/childdrain2527 support reasoning about last-thread termination and
later child cleanup. These are upstream source observations, NOT exact running
12377.121.10 teardown proof, external-owner-death containment or permission.
An externally killed owner cannot be called definitely settled merely from
topology or a source comment. Compiler/dyld/thread startup and full pre-import
Perl trust remain independently unqualified; P2 is not opened by this result.

Sources (inspected public raw source, not a third-party issue as authority):

- https://github.com/apple-oss-distributions/xnu/blob/xnu-12377.121.6/bsd/kern/kern_proc.c
- https://github.com/apple-oss-distributions/xnu/blob/xnu-12377.121.6/osfmk/kern/ipc_tt.c
- https://github.com/apple-oss-distributions/xnu/blob/xnu-12377.121.6/bsd/kern/kern_exit.c

### Verification and effect admission

First use behavior-driven refusal and pure lifecycle test copies with literal
oracles for no consuming reap before join, bounded pending cleanup, admission
versus burn, late returned-right disposal, join failure and primary/secondary
cause retention. An actual joined pthread with a deliberately delayed test
request is not a genuine blocked taskgated/kernel experiment; label it correctly.
Any mutation control must exercise the independent oracle, not source-string
certification. Never fabricate a genuine kernel acquisition or disposal.
Main burn must exhaustively arbitrate every admission state using strong CAS,
never a spurious/lost transition permitting expired READY work. A finite pure
lifecycle copy may test the join-failure state without creating an unknown live
thread. Any future nominated error after actual successful join is synthetic;
its fixture-only rescue requires separate literal review and independently
proven actual thread/target settlement, never production recovery credit.
Do not execute a genuinely uncertain join path and then kill its owner.

Keep new tests default-skipped with explicit test-process-only compile/native
opt-ins omitted from every child environment. Reuse reviewed ordinary custody,
fixed tool/SDK/resource/link recipes and natural exit+close/bothEOF helpers only
after exact adaptation review. pthread/atomic headers, real libSystem exports,
object/link recipes, all source/entry/input/output pins, retained directories
and fresh resource/preservation checks precede any compiler/native effect.
One genuine capability experiment is separately reviewed after source/tests:
denial must fail the nominal oracle and remain actual capability evidence, not
a software fix mandate. Unknown settlement retains original artifacts/owner.
Normal reviewed PR/clean-main build/host delivery is separate from native or
protected qualification. No frozen ALL/private-PG/build/test replay.

## Ordinary native NAME identity viability slice

This separately reviewed ordinary diagnostic supplies the first actual native
process-object identity feasibility evidence needed by P2. It does not admit
CONTROL, an observer, protected origin, a compiler, complete native closure,
root invocation, continuous exclusion, VM changes or service/DB effects.
The existing bootstrap cold guard and final-main refusal stay unchanged.
The prior prospective CONTROL/Node-autoreaper design is not an admitted recipe.

Four-file map: create scripts/task6a-origin-native-name-v2.c and
scripts/__tests__/task6a-origin-native-name-v2.test.js; refine only this spec
and its existing named plan. No production selector, Node flag, helper module,
UID/group change, root install, access/DeveloperMode/entitlement change or
privileged invocation. Root is sole writer; independent agents read/review.

The fixed C parent is an ordinary non-root process. It accepts no caller
arguments, PID, source path, environment configuration or continuation.
Refuse argc!=1, root or mismatched real/effective UID before creating a child.
The nominated ordinary Node is the reviewed installed26.4.0 tool, not vendor
or root-admitted Node. Its only program is the existing adjacent fixed builtin
entry; the exact compile recipe supplies an absolute source filename so the
adjacent locator is fixed by that reviewed source placement. No current-directory
lookup, shell, caller flag, preload, Node options or inherited privileged FD.
The child uses a literal scrubbed environment and private standard pipes.
Compile/test fixture source placements are explicitly ordinary test-only.

The C parent owns exactly one actual direct spawn PID and its private pipes.
It is the exclusive reaper: no SIGCHLD ignore, SA_NOCLDWAIT, other wait/reaper
or status consumption may release that PID before final native operations.
A successful waitpid(WNOHANG) consumes status: permanently mark reaped and
forbid all later PID-native operations and signals. Exact birth plus retained
unreaped PID prevents reuse; PPID/path sampling alone would not supply that edge.

After actual READY, attempt task_name_for_pid exactly once. Require success and
a non-null/non-dead owned send right; do not treat success-with-null as support.
Use pid_for_task on that original NAME right and require the captured child PID.
Retrieve TASK_AUDIT_TOKEN via task_info on the same original right, requiring
success and the exact TASK_AUDIT_TOKEN_COUNT. Treat the complete initialized token
as opaque bytes; do not construct, decode, serialize or export an identity token.
Hold the original NAME right and first token through exactly three fresh distinct
challenge/PONG exchanges. Compare a second token after PONG3 while input remains
open, BEFORE writing END or closing input. An unreaped PID does not keep its
task active: do not require a successful query after the final END/exit.

After the live comparison, write END and close child input; capture final END,
complete stdout/stderr EOF, actual exit and definite exact reap. Retain the NAME
until this lifecycle closes; attempt its disposition once and preserve errors.
Failure/deadline/early exit burns further native operations. No task_for_pid,
CONTROL conversion, suspend, Mach VM query/protect/lockdown, signal-based identity
or authority substitution, or alternative target is permitted by this slice.
Any parent-only SIGPIPE handling or spawn signal mask/default setup requires
explicit review for checked IO and must preserve child behavior, visible errors
and exclusive reap discipline. Actual protocol/no-after-reap
cleanup behavior must be tested, not certified by source strings.

Ordinary test-copy instrumentation may wrap actual spawn/wait/NAME calls after
SDK declarations, preserving the real effects/results and exclusive reaper.
Latch genuine reap independently before returning to the source. Test-only
post-settlement attempt controls must be blocked before delegating with a
consumed PID/right. An independently literal event oracle requires real spawn,
NAME/type/PID/two audits, six original pipe closes, exact reap and one original
local NAME disposition. Trace only primitive events; keep a bounded in-memory
record and exclusively create a fixed adjacent trace after settlement. Check
every original trace write/close and retain artifacts. Instrumented-copy hashes
remain distinct from production source; no protected authority follows.

Burn separates observation from shutdown: after failure/expiry no further
NAME/PID/audit observation may qualify anything. Cleanup may signal ONLY the
original directly spawned, still-unreaped child; exclusive wait ownership
prevents that PID being reused. Reaped is permanent and forbids every later
target signal/native observation. Once-only disposition of the already held
original NAME right is local cleanup, not another target observation.
Cleanup budgets never renew validity. If a cleanup budget expires, retain the
failure and ownership while awaiting definite reap; never return success or
pretend an uncertain child is closed. No hard kernel-return guarantee is made.
Check observed cleanup expiry before a completed-loop break, so a late return
cannot erase the expired budget. Completed but late closure stays failed with
cleanup-deadline-unqualified; print UNSETTLED only while reap/EOF is incomplete.
An ordinary test may delay returning an already genuine reap, never fabricate
exit or keep a live child beyond SIGKILL. Such a witness proves attribution of
late observation, not late kernel exit or a hard scheduling/termination bound.

The protocol has a nonrenewable3s parent budget and bounded buffers. Cleanup has
separate nonrenewable graceful/TERM/KILL/wait budgets, never extending validity.
These bounds assume ordinary scheduling and kernel-call return: absence of the
inspected taskgated upcall is not proof of a hard3s syscall deadline.
Owner loss/timeout containment, inherited descriptor closure and definite
settlement require exact literal review before any compilation/native invocation.
The unchanged running entry's20s timer/EOF behavior depends on its event loop;
it is not a kernel fence or unconditional target-termination guarantee.
Unknown settlement preserves artifacts and remains failed/unqualified.

Successful output is only diagnostic supportedNAME/unqualified, with literal
productionAuthority:false, completeNativeClosure:false, protectedOrigin:false.
It exports no right, PID or audit bytes as authority. NAME support does not
establish CONTROL usability, map identity/MAX coverage or initial load trust.
Denial/invalid right/count/drift/protocol/cleanup outcomes stay distinct.
Published XNU12377.121.6 supports the inspected NAME/token routing; actual host
12377.121.10 differs; the first ordinary actual NAME/audit witness eb7047 passed
on that host on2026-10-05, without protected qualification. Never promote upstream source
inspection or an ordinary compile result into exact-host/P2 acceptance.

Before compiler effects, separately review the fixed ordinary CLT clang21,
explicit physical SDK26.5/resource/include roots, integrated assembler, fixed
linker/search paths, actual static dependency/config discovery and output custody.
No compiler shim, HOME/DEVELOPER_DIR/default config, caller flags/response files,
ambient include/deployment paths or existing cache/output reuse. Local ordinary
Apple Silicon linking may produce an automatic ad-hoc output signature; this is
not an external signing identity, notarization or distribution authorization.
Compiler/helper/native transitive closure remains unqualified for protected use.
Only fresh owned private outputs are created; retain unknown artifacts.


## Objective and trust boundary

Build a genuine protected private source-entry rehearsal prerequisite for the
owner-approved Task6A cutover. This is not production admission, a compiler
witness, continuous DB/OS writer exclusion, genesis or migration32/33. Preserve
all V1 stores, retained worktrees, dirty19 and unconditional V2 admission refusal.
Root is the sole writer and delivery owner; independent reviewers are read-only.

## Cold-entry refusal before candidate imports

Current ordinary delivery does not admit protected execution. The previous
final-main refusal still allowed the preceding `use` statements to execute B,
JSON, Encode and their transitive XS code. Move the negative boundary to the
first compile-time action: an unconditional `BEGIN` uses only `CORE::print`
to emit `TASK6A_ORIGIN_BOOTSTRAP_REFUSED` and one LF on STDERR, then
`CORE::exit(2)`. It precedes the existing ordered SIP-root assignment and every
module import. It does not call a later declaration or inspect UID, arguments,
environment, a receipt, a callback or a mutable admission. Failure to write
STDERR still cannot permit imports: exit remains unconditional.

This is a fail-closed root fix, not a new trust verifier or execution gate that
can be opened. No privileged invocation, native observer, protected installation,
source/vendor download, credential change or service cutover is authorized.
The existing final main refusal and all declaration policies remain unchanged.
An ordinary graph verifier after imports cannot establish initial interpreter
trust; full pre-interpreter owner/native admission remains an independent gate.
"Zero modules" here means no bootstrap module import under the fixed scrubbed
invocation. It does not authenticate interpreter/dyld startup or caller-preloaded
code.

Use the existing four-file map only: bootstrap, its test, this spec and its plan.
The ordinary `systemObject` harness checks that the exact cold block is the
source prefix, removes that unique block and the sole final main call ONLY in
memory, then applies the existing finite external ports. No on-disk opening,
production initializer, export, test argument or environment switch is added.
The historical "remove only final main" harness requirements below are amended
by this narrowly specified additional memory-only removal.

Regression evidence must execute the actual disk entry with system Perl under
the existing ordinary macOS/scrubbed-environment scope and require exit2, no
stdout and exact canonical stderr. A separate memory-copy probe changes only
the existing SIP-root assignment into an `@INC` resolution hook that records
`TEST_FORBIDDEN_IMPORT` and throws before loading a module. Keep the actual cold
block untouched. The real entry must exit before that hook is called. Removing
the cold block or moving it after the first `use strict` must reach the forbidden
hook in actual Perl evaluation; compile/anchor/transport failures are not
semantic evidence. The probe has no imports, file writes, child helper, signal,
native observation or positive origin output. Existing declaration tests still
compile and exercise the complete memory-only source after the two removals.
Actual `perl -c` on the disk entry is deliberately refused, not a syntax pass.
Separately feed the exact source with only the cold block removed to fixed
ordinary `/usr/bin/perl -f -c` on STDIN, require exit0 and exact syntax-success
stderr. Keep final main present: syntax mode does not execute it. This separate
ordinary compile-only invocation may load the fixed SIP modules; it supplies no
privileged trust or origin evidence.

The initial trust edge is an explicitly admitted trusted-owner invocation of
exact independently reviewed **delivered** bootstrap program bytes using fixed
Apple system tools and a scrubbed environment. It is not a sourcepath argument,
root-owned JSON, self-check or generic copy/chown. No privileged rehearsal before
fresh merged delivery and a separate exact pre-effect review of invocation,
source/native policy, UID/GID drop, child lifecycle and cleanup. Root administrators
are trusted; excluded ordinary/runtime actors cannot rewrite the protected tree.
Default Perl/helper/entry tests require macOS and an ordinary non-root UID. Other
hosts/root test invocation explicitly report unavailable/skipped coverage before
any local Perl/supervisor execution; no ambient Perl or module-root fallback.
Actual macOS gates require zero skips. Opt-in privileged rehearsal is separate.

## Chosen architecture

Use admitted Apple system `/usr/bin/perl` (runtime5.34.1, not a nonexistent
`/usr/bin/perl5.34.1` path) as the retained root bootstrap/supervisor.
Set its first `BEGIN` module search to exactly
`/System/Library/Perl/5.34/darwin-thread-multi-2level` and
`/System/Library/Perl/5.34`, before any module import; invoke through scrubbed
system environment with `-f`. Default Perl roots include non-SIP Library/Network/
Updates/Extras and are not admitted. Independently admit its real
executables/core Perl/XS closure, and never execute user-owned Node, Git, installers
or npm. This avoids root Node execution and a new compiled native supervisor.
Alternative root MJS supervision requires Node admission before its own root
execution; a compiled native helper adds compiler/helper provenance. No system
Perl module is assumed trusted merely because its name is a core module.

The zero-argument bootstrap owns fixed public GitHub and official Node HTTPS
routes, source member policy and private fixture creation. Source policy contains
literal Git blob identities for the reviewed entry and any helper closure. Compute
these from final reviewed file bytes before delivery; owner installation binds
the bootstrap's own actual delivered blob identity after merge. This ordering
avoids a circular own-merge hash. Ordinary actors cannot supply URLs, sourcepaths,
hashes, JSON receipts, SQL, runtime selectors or callback continuations.

Initial source authentication must join actual fixed TLS main, strict signed
merge object framing, complete selected tree framing and a real closed merged
same-repository main PR with exact second parent; selected blobs must match the
owner-admitted literal source policy and framed Git/SHA256 identities before any
Node execution. GitHub's TLS/signature-verdict trust is explicit, not independent
local GPG verification. Sampled main endpoint agreement cannot exclude ABA.
Use typed bounded authentic JSON parsing, no API-returned URL, sourcing or eval.

## Vendor and archive admission

Fix official `https://nodejs.org/dist/v22.23.1/` and
`node-v22.23.1-darwin-arm64.tar.gz`, independently observed SHA256
`ef28d8fab2c0e4314522d4bb1b7173270aa3937e93b92cb7de79c112ac1fa953`.
Actual HTTPS archive bytes and official checksum must agree with this admitted
policy. This is vendor HTTPS/checksum admission, not OpenPGP verification.
Bound compressed bytes128MiB, expanded bytes512MiB, members20000 and selected
Node bytes128MiB. No Node/npm/corepack/full archive installer is executed.

Prefer a bounded streaming gzip/tar member scanner using separately admitted
system core modules. Verify tar checksums, sizes, EOF/padding and path-affecting
PAX/GNU extension semantics before selecting exactly one regular
`node-v22.23.1-darwin-arm64/bin/node`. Reject duplicates, hardlink/symlink selected
members, malformed/truncated/overbound or unsupported effective paths. Do not
extract unrelated archive paths or turn human `tar -tv` text into authoritative
member typing. Stream only the exact selected bytes into a fresh protected file.
Actual archive topology is currently unknown; unsupported topology must refuse.

Before even Node version/entry execution, authenticate the exact Node bytes and
thin arm64 executable Mach-O header/load-command table; validate SDK command
structure sizes and bounded variable tails, reject unsupported
commands, non-system dylib references, search paths and external loader fallback.
This policy does not prove all segment/linkedit payloads are loadable; authentic
vendor identity and actual admitted execution/maps remain separate requirements.
Root-owned protected ACL-free one-link file/ancestry plus retained physical
identities must join vendor bytes. Static native admission is not loaded-image
evidence; actual parent-owned child maps are required separately while held.

## Composed system-Perl physical candidate

The retained file, ACL and ancestry fragments alone do not compose a held epoch:
file rechecks omit the leaf ACL, and caught standalone ACL refusal does not burn
file validity. Add a private fixed-policy composition as a prerequisite for the
same protected bootstrap. Main remains unconditional refusal. This ordinary
read-only slice supplies no staging, native, owner-install or execution authority.
Select composition rather than relying on callers to remember three fragments
or implementing all unresolved publisher/native/staging edges at once.

Three zero-argument declarations are admitted:
task6a_origin_hold_system_perl_physical(),
task6a_origin_recheck_system_perl_physical() and
task6a_origin_release_system_perl_physical(). Fix /usr/bin/perl, SHA256
abda2bfd23a6c9a8e57adf2291f0aea4abd8faf440558ee49fe4ced55e8d9ad0,
rootwheel0755/nlink1/max1048576 bytes; ancestry exactly /,/usr,/usr/bin.
Return only scope composed-system-perl-physical-candidate-diagnostic-only,
productionAuthority:false and descriptive counts. No path/hash/receipt/JSON/
callback/argv/environment selector can construct, recheck or revive authority.

Private one-use state is new -> starting -> active -> burned/released. Mark
starting before helper/FD effects. Acquire exclusive ledger ownership only if
both raw ledgers are initially empty and unburned/unreleased. Prior contamination
refuses without adopting or closing its descriptors; the original raw owner must
release them. Once composition owns the ledgers, generic raw captures/close are
refused before FD effects except its private internal capture/cleanup path.
Pin exact private record references/counts/paths; every composed validity check
rejects additions/replacements. Diagnostics never supply these records.

Capture ancestry first, require complete leaf ACL, retain/hash the fixed file,
then bracket repeated complete leaf ACL with held file and ancestry rechecks.
Rechecks repeat all components, helper settlement and fixed bootstrap deadline.
All metadata/ACL observations remain sampled: no directory-content census, ABA
proof or continuous kernel exclusion. Helper nonzero refusal burns even when
its definite reap leaves helpers_settled true. Unknown helper lifecycle denies.

Any composition arity/state/ACL/file/ancestry/helper/deadline failure burns the
same epoch. Partial capture failure burns and attempts owned closure once; a
caught failure/restored input cannot revive it. Cleanup bypasses validity,
deadline and helper checks, attempts every privately owned FD despite one
throwing/failing close, and refuses uncertainty. Seal each actual handle directly
after successful open, before binmode/fcntl/hash/ACL checks; partial-start handles
remain owned even before final record pins exist. Cleanup consumes only this
private handle ledger, never the mutable raw file/directory records. Removing or
replacing a raw record cannot leak the original or adopt/close a replacement.
Composed cleanup owns its release transition and per-handle loop; it does not
delegate to raw close_files (whose released guard would prevent that loop if
pre-set). Cleanup ownership and attempted state are separate from positive
validity. Bad-arity/repeated release
cannot double-close/reopen. Calling release after an already-cleaned failure is
refusal, not permission to close reused descriptor numbers.

Ordinary tests isolate exact leaf ACL faults with stable lstat/fstat/hash,
post-capture ancestry drift, prior contamination, generic additions, helper
failure, partial capture, irreversible restoration and exact close attempts.
Fault ports that close before injecting uncertainty prove complete attempts and
sticky denial, not native uncertain-close leak freedom. In-memory omitted ACL,
post-ancestry or sticky-state mutants must fail real consumer expectations.
Existing observed current33PM/9XS and futureGunzip50PM/12XS inventory is not
complete lazy/transitive loaded closure; no repeated supposedly missing inventory
or new native invocation follows from this composition.

## Ordinary declaration-only parent consumer

This separately reviewable P2a slice is an ordinary prerequisite, not the real
execution edge below. Modify exactly the existing bootstrap, bootstrap test,
this spec and its implementation plan. Keep main's unconditional refusal,
helper captor, entry, helpers, import policy, observer, launcher, source/vendor
staging and protected-effect gates unchanged. No dependency or package change.
The causal purpose is to make the parent's actual framing/lifetime decisions
testable before separately admitting protected execution.

Choose separate private custody, admission and lifecycle facts. One mutable
record would let altered admission entries change disposal targets; a public
factory/setter would add selection authority. Neither alternative is selected.
The sole public consumer is `task6a_origin_consume_entry_protocol()` with zero
arguments. Its private lexical admission starts absent and has no production
initializer, setter or callback. Therefore this slice cannot select/launch a
child; a production call without future authentic launcher custody refuses.
Only a uniquely anchored in-memory test initializer may populate those lexicals.
That initializer is not written into the production file or executed by main.

Independently retain the original admission HASH reference, copied original PID
scalar and five fixed original custody slots: input0, stdout1, stderr2, setup3,
entropy4. Each acquired slot owns its original handle reference, numeric FD and
complete stat identity, recorded before fallible configuration. Admission has
exactly pid/input/stdout/stderr/setup, copied PID value and original handle
references; it never aliases mutable custody slot objects or the sealed PID.
Check exact record identity/keys/PID/handle references, distinct live descriptors
and FIFO identities before protocol effects. Every epoch/settlement also rechecks
admission reference/keys/copied PID/role references. Both raw PID scalars require
public numeric flags/no POK before comparison, with finite integral domain
1..2147483647 (target signed32 pid_t). Valid authentication followed by a
pre-first-poll clock/deadline failure still permits one sealed-PID cleanup poll;
only its confirmed live result permits existing bounded shutdown. Absent,
bad-arity or mismatched admission never authorizes that poll. Rechecks compare original
dev/inode/type+mode/nlink/UID/GID/rdev (stat fields0..6), not changing pipe
timestamps/size. Complete13-field capture is retained, not a stable contents
snapshot. Recheck live original slots;
definitely closed slots stay historical. Entropy may reuse a definitely closed
setup FD, but never reset or share that slot's close obligation. A live alias
does not create a second ownership/close obligation. Replacements are not adopted:
never replace a custody record, select a new handle or use a changed binding for
protocol. After an externally rebound original FD is observed, disposal still
closes the retained original handle once; this necessarily closes its current
kernel binding, not a recoverable historic kernel object. This is not a promise
to close the historic object through an unavailable descriptor. An ordinary
test may retain a separate duplication of that old endpoint, but the consumer
must neither know nor close that fixture-owned preservation handle. Such a
test proves observed rebinding refusal and original-handle disposal, not native
origin, numeric-FD drift or continuous pre-observation race exclusion.
These five obligations never append to existing file/physical/helper ledgers.

Private lifecycle is absent -> starting -> active -> ending -> settled; any
failure irreversibly burns it. Store a separate permanent-invalid latch,
cleanup-started/complete, per-slot close-attempted/definite-close, original
start/deadline, exact reaped/uncertain/raw-status, pending bytes, input/output
totals, issued/matched nonces, three EOF facts and END-written/final-END facts.
`task6a_origin_parent_require_unburned()` is a zero-argument, no-effect internal
guard actually used by the consumer. Its latch check is the burn-mutation
witness; it does not initialize custody or admit execution.

Validate actual `task6a_origin_now()` before numeric coercion: zero arguments;
clock call return/throw captured independently; defined non-reference scalar;
public numeric IOK/NOK flag and no POK flag; finite, nonnegative, not backward,
at most1e12 inclusive. Zero, equal samples and fractions are allowed. Commit
last-clock history only after acceptance. Numeric NaN/Inf test factories must
produce actual POSIX numeric scalars and independently witness flags/classification
before the actual validator; JSON strings are not numeric NaN evidence.

Protocol order and literal bounds:

- Compute once `min(original bootstrap deadline, start+45)`. Never renew it.
- Configure original pipes binary/CLOEXEC/nonblocking, checking each call and
  original identity. Readiness waits are clamped to remaining time and at most
  0.01s; reads/writes are separate actual nonblocking operations. No retry of
  short/zero/undefined/throw/EINTR/EAGAIN write or entropy read.
- Reset `$!=0` before each readiness call: empty list with zero errno means
  timeout only; throw/nonzero errno/unknown or duplicate ready handles refuses.
  Installed IO::Select collapses select errors to an empty list, so empty alone
  is not a healthy timeout. Pipe sysread undefined/throw/EINTR/EAGAIN refuses
  without retry; zero is EOF only. Returned count must be an integer within the
  request and equal raw buffer length; no UTF8-flagged protocol buffers.
- Setup must have empty EOF and definite close before READY acceptance. READY
  can be buffered while setup remains open. Setup/stderr read requests at most1;
  any byte refuses. Stdout requests at most71, total at most220 bytes.
- Accept exactly READY6, then open literal `/dev/urandom` readonly/nofollow/
  nonblocking/CLOEXEC. Register successful acquisition immediately, validate
  actual character-device/rootwheel UID0/GID0 identity and flags. Binary/raw
  bytes only; compare pre/opened/post-read lstat/fstat dev/inode/rdev/type/mode/
  nlink/owner against original identity. Configuration/binmode/CLOEXEC/identity
  failures use the same original custody disposal. No alternate or borrowed FD.
- Read exactly32 bytes once per challenge, convert to64 lowercase hex in actual
  consumer and require request32, actual returned count32 and raw buffer length32,
  with no UTF8 flag, and three distinct nonces. Close entropy definitely before
  issuing challenge3. Each challenge is75 bytes; END is4; input total229.
- Accept only current PONG70. Parse an entire returned chunk in its current
  phase before issuing a successor; unsolicited future/coalesced frames refuse.
  Partial-frame limits READY5/PONG69/END3. Buffered complete READY6 while waiting
  for setup is a distinct fact, not an unbounded pending frame.
- Three matches -> full END write -> definite original input close -> ending,
  all before the next poll. Final END is accepted only in ending, after the
  definite input-close prerequisite. Extra bytes/frames and premature EOF refuse.
- Actual `task6a_origin_poll` uses only sealed original PID/raw wait status.
  Bracket every readiness, pipe/entropy read and nonterminal write with actual
  polling/deadline checks before and after, not just the outer loop. The one
  exception is compound END-write/input-close/enter-ending: check before END,
  perform full write+definite close+phase change without an intervening poll,
  then check after entering ending. Any observed exact reap before input close
  refuses. Polling is sampled and cannot date an unobserved kernel exit between
  checks; no continuous kernel lifetime proof is supplied by ordinary doubles.
  Reap before input close refuses. Ending allows exact zero reap before buffered
  final END drains, but still requires final END, every EOF, all five definite
  closes, no uncertainty and original deadline before settling.

Failure burns before disposal. Record each original close attempt BEFORE calling
close; false/throw is uncertainty and never retried, but disposal still attempts
every other genuinely retained original once. Cleanup does not trust mutable
admission. Bad initial arity or absent/mismatched admission permits no entropy,
read/write/readiness/poll/signal or closure of replacements; independently owned
originals still need once-only disposal. Shutdown is allowed only for an
authenticated sealed original known-live PID, and uses the existing exact-PID
5s/TERM2s/KILL2s discipline; reaped or uncertain PID excludes signals. Settled or
burned repetition produces no new events. Failed disposal stays burned/unsettled.

Set settled BEFORE returning exactly scope `parent-entry-protocol-diagnostic-only`,
productionAuthority:false, challengeCount3, inputBytes229, outputBytes220,
handlesClosed5 and reaped:true. No PID/FD/source/path/hash/nonce/token/callback
is returned. Synthetic wait/entropy/pipe ports prove actual consumer decisions,
not kernel captured-PID ownership, native entropy/protections or protected cleanup.

The ordinary trust assumption is that external operations return or throw and
the actual monotonic clock eventually advances. Returning operations plus equal
clock samples do NOT bound total polling attempts independently. Individual
request/wait sizes are bounded; no hard syscall cancellation or unconditional
wall-clock guarantee is claimed. Parent45/bootstrap180/child20 and separate
shutdown-only budgets remain unchanged; no renewed origin validity.

### Ordinary real-consumer harness and mutation requirements

Keep `systemObject` and remove the uniquely anchored cold-entry block and the
sole final main call only in memory, as specified above. Before
actual source eval install finite external clock/sysopen/stat/lstat/binmode/fcntl/
readiness/sysread/syswrite/close/waitpid/status/signal/sleep ports; preserve actual
clock validator, nonce/FSM/deadline/entropy checks, poll and shutdown. Synthetic
PID ports never delegate to CORE signal/wait. Harness-owned real ordinary pipe
ends and extra fixture ends have independent finalization, not production custody.

Use a sticky independently retained fixed nonempty harness-fault marker. Latch
BEFORE unexpected startup/runtime/factory/queue/argument errors. Check it after
EVERY eval/caught consumer/disposal/negative-guard call, before interpreting
refusal or JSON or invoking again. Capture eval success separately and `$@`
immediately. Nominated fault injection is only an exact expected primitive and
ordinal, and must be reached. Exhaustion cannot become a successful refusal.
Positive/trace diagnostics require exit0, empty stderr and exact JSON; plain
refusal requires exit64, empty stdout and exact bootstrap refusal stderr.

Independently witness new Perl override prototypes/caller alias contracts:
sysopen assigns the actual caller scalar; sysread changes actual caller buffer
and checks raw bytes/count/request/errno; syswrite checks actual bytes/length/
offset/full count; fcntl native-zero success is `0 but true`, not false0. Keep
primitive entry, completion, close attempt, definite close, EOF and reap distinct.
Trace sequence/roles come from independently sealed test originals, never consumer
results or mutable admission. Each fixture has literal finite queues/event bounds.

First RED asserts the missing consumer declaration before any initializer anchor,
then invokes the actual consumer. This missing-feature assertion is only initial
scaffolding RED, not later semantic/security evidence. Missing anchors, syntax,
queue failures or undefined functions never count as semantic mutant kills.
Require fragments at every frame boundary, setup/READY and reap/final-frame
permutations, each EOF/close, ownership/arity/restoration denial, finite typed
clock cases, entropy flags/device/drift/size/uniqueness and all partial writes.

Six coherent in-memory actual-source mutations need independent forbidden
witnesses: omitted current-nonce comparison -> otherwise valid wrong PONG
diagnostic; omitted permanent burn -> actual used guard accepts after refusal
and complete disposal with no new events; omitted raw-zero predicate -> nonzero
exact reap diagnostic; remove ALL and ONLY redundant reaped signal exclusions
in caller/shutdown -> post-reap synthetic signal attempt (uncertainty exclusions
remain); deadline renewal -> progress44s/response46s continuation; omitted
immediate definite-input-close prerequisite -> actual final-END acceptance.
For the last, inject a test-only observer immediately AFTER the actual acceptance
assignment in memory; receiving END bytes alone is not acceptance evidence.
Inventory/pin actual unique source anchors before injection; no production
callback or decision replacement. A later all-close refusal does not erase the
forbidden acceptance witness. Ordinary delivery remains separate from native P2.

## Ordinary declaration-only staged custody: design refinement

The delivered ordinary P2a parent protocol does not hold staged source/vendor
files. Its five pipe/entropy obligations and the composed Perl holder's exact
one-file/three-directory ledgers cannot be extended into staging authority.
This causal next prerequisite uses the same four existing files: bootstrap,
bootstrap test, this spec and its plan. Main remains unconditional refusal.
Before code or test effects, review the literal lower-port harness and executable
subplan. This section fixes the ownership contract, not execution readiness.

Choose one private all-or-refuse six-leaf composition with private per-leaf
acquisition. All-or-refuse concerns diagnostic publication, not an atomic
filesystem snapshot. Separate public per-leaf factories would leave complete
composition to callers; implementing the full publisher/launcher now would also
cross unresolved protected/native gates. Neither alternative is selected.

The production creator/admission record is initially absent, with no initializer,
setter, caller root/path/hash/receipt/callback or returned handle. A future,
separately admitted publisher must privately supply its actual exclusively created
root identity and authentic source/archive/selected-member byte joins. A copied
diagnostic cannot supply this record. Ordinary tests may initialize lexicals only
inside a uniquely anchored memory copy, removing the cold-entry block and the
sole final main call only in memory, as specified above.
No test initializer or effect selector is added to the production file.

Three zero-argument operations are proposed:
`task6a_origin_hold_staged_custody()`,
`task6a_origin_recheck_staged_custody()` and
`task6a_origin_release_staged_custody()`.
Hold/recheck return only `scope:staged-source-vendor-custody-diagnostic-only`,
`productionAuthority:false`, `fileCount:6` and `directoryCount:6`.
Release is original-handle disposal, not a validity/origin receipt; its descriptive
diagnostic adds only `handlesClosed:12` after all twelve definite closes. No
sourcepath, byte/hash identity, root, PID, FD, token or continuation is returned.

The fixed manifest below is relative to the future creator-owned fresh root;
these are proposed literals, not files claimed to exist on the host:

| Role | Relative path | Mode | Required authentic join |
| --- | --- | --- | --- |
| Archive helper | source/task6a-origin-archive-v2.pm | 0400 | Existing literal Git blob policy |
| Native helper | source/task6a-origin-native-v2.pm | 0400 | Existing literal Git blob policy |
| Map helper | source/task6a-origin-map-v2.pm | 0400 | Existing literal Git blob policy |
| Entry | source/task6a-protected-origin-entry-v2.mjs | 0444 | Existing literal Git blob policy |
| Official archive | vendor/node-v22.23.1-darwin-arm64.tar.gz | 0400 | Existing fixed official archive SHA256 |
| Selected Node | vendor/node | 0555 | Unique regular Node member from that same admitted archive and existing native byte policy |

Source leaves retain the existing 2MiB Git-blob bound; archive/selected Node each
retain 128MiB. Do not enlarge the generic Git metadata size validator to accept
vendor sizes. File records must join exact role/path/mode/size/SHA256 and the
actual independently authenticated byte derivation, never a caller-described
expected hash. Four source policy leaves are the existing reviewed helper/entry
pins; bootstrap and full system core/XS custody are explicitly outside this
six-leaf subset. The subset cannot qualify complete origin or tool admission.

Retain exactly six unique ancestry records: `/`, `/private`, `/private/tmp`, the
creator-owned fresh root, its `source` and its `vendor`. Capture shared ancestors
once. Root is final root:wheel0711, source/vendor root:wheel0555; existing ancestor
policy permits only the literal `/private/tmp`01777 exception. Every leaf is
root:wheel, regular, one-link, exact mode and ACL-free. Root physical identity
must join the creator's independently retained actual creation record, not merely
a matching pathname. Hold original record/FH/FD identities separately from
mutable admission; reject role/count/path/reference replacement and unowned live
aliases. All acquisitions belong to this new private owner, never old raw ledgers.
Check retained live FH/FD aliases before adding a distinct acquisition: an alias
creates no second or borrowed close obligation. Immediately register each
distinct successfully acquired original after that alias check, before any
configuration, metadata/hash/ACL check or later fallible acquisition.

Private state is absent -> capturing -> active -> burned/released; an invalid
latch, disposal-attempted and per-original close-attempted/definite-close facts
are separate. Keep the alias exception above distinct from original acquisition
ownership; every distinct success is immediately registered before other checks.
Capture six unique ancestors, then six leaves. Before active publication and on
every active recheck, bracket complete held leaf identity/hash/ACL joins with
complete held ancestry checks; require helper settlement and the unchanged
bootstrap deadline. These are sampled joins, not directory-content/ABA census,
hard syscall cancellation or continuous exclusion. Successful acquisition alone
is not custody acceptance. Any arity/admission/manifest/identity/ACL/helper/clock/
configuration/size/hash/state failure burns before disposal; input restoration
and repeated calls cannot revive the owner.

Reuse existing `task6a_origin_file_identity`, `task6a_origin_check_held_file`,
`task6a_origin_directory_identity` and `task6a_origin_check_directory` validators.
Do not use `hold_file`, `hold_ancestry`, raw recheck/close functions or the Perl
composition cleanup to acquire/dispose staged records: those functions consume
different ownership ledgers. Keep actual `acl_free` and `capture` decisions;
capture failure retains the existing shared bootstrap/Perl burn-and-cleanup
gate. The staged outer failure handler independently disposes its own originals
even when that shared gate already threw. Do not suppress shared invalidation or
adopt another owner's descriptors to obtain artificial isolation.

Release/disposal bypasses validity, deadline and helper checks. Permanently
consume the release transition before effects and attempt every original once
despite another false/throwing close. Mark attempt before calling close and require
true return plus undefined fileno for definite closure. Uncertainty never grants
a positive release, reopen, retry or protected-tree deletion. Mutable admission
or ledger contamination must not redirect cleanup. A test port that physically
closes before reporting false/throw proves once-only attempts and sticky denial,
not native uncertain-close leak freedom. No download/publication/staging writes,
credential change, child execution, native observation or protected filesystem
cleanup is permitted by this ordinary declaration-only slice.

Ordinary positive fixtures use actual owned seekable files/directories and real
descriptors, while explicitly projecting synthetic root:wheel/policy metadata.
The lower-captor foundation alone may uniquely map the memory-copy child effect
site `exec {$tool} $tool,@$args;` to
`CORE::GLOBAL::exec($tool,$tool,@$args);`, an unconditional denying port. This
external syntax exception is required because an ordinary-sub override cannot
parse Perl's native exec block form. It preserves both operands but proves no
child exec syntax, argv or dispatch equivalence; actual source stays unchanged,
and synthetic positive-PID parent cases never enter that branch. Declaration
compile/prototype/load failure is fatal before self-mode containment reporting,
never semantic refusal or cleanup proof.
Synthetic archive/policy substitutions must be disclosed as such, never official
vendor or protected origin. Preserve actual source composition, ACL/capture,
FD-enumeration, clock and cleanup decisions. Intercept only bounded external
ports; deny unknown execution/filesystem/signal/native effects before delegation.
Use independent fixture ownership, typed finite operation/role queues and a
sticky fault checked after source eval and every caught call, including disposal
and repeat. Missing declaration/anchor, syntax, exhausted queue or wrapper fault
is not semantic RED. First prove lower-port prototype/alias, acquisition,
FD-enumeration and actual captor lifecycle self-witnesses; only then test stage
acceptance, every partial acquisition/configuration/close, contamination/drift,
expiry/restoration/repetition and real forbidden-acceptance mutants. The literal
helper/clock/read/stat counts and trace cap belong to the reviewed subplan before
execution; the old parent harness's 512-event limit is not reused by assumption.

## Ordinary read-only seekable-file/directory port foundation

The actual captor foundation and its delivered throwing-cleanup repair do not
provide the file/seek/stat ports required by the proposed staged composition.
The next bounded prerequisite is test-only: independently prove a closed
read-only file/DIR bridge before evaluating any staged consumer. Production
bootstrap declarations, admission state, main and all existing owner ledgers
remain unchanged. The existing four-file map is retained; this slice changes
only the test and its existing spec/plan.

Select one existing reviewed map-helper file and its scripts directory as
ordinary backing data. Acquire fresh actual read-only handles, not old owner
handles. Read helper bytes as data only, never require/eval/import that helper.
No new fixture file/root, filesystem write/delete, chmod/ACL change, subprocess
other than the fixed ordinary test Perl, native inspection or SQL is needed.
The backing path and byte digest are private test fixture locators, not source,
vendor or protected-origin authentication. No synthetic root:wheel metadata
is needed for this foundation, and no six-leaf/six-ancestry acceptance is claimed.

The adapter's private original registry must record every distinct actual CORE
acquisition before fallible metadata/configuration/trace inspection. Aliases
nominate an already retained handle before new CORE acquisition and create no
second disposal obligation. Explicitly distinguish this fixture self-witness
from the still-unresolved future consumer's pending-raw-acquisition/alias contract.
Original disposal is independent of mutable diagnostics, queues and sticky
fault state; mark attempts before CORE close/closedir, contain each failure,
continue all remaining originals and never retry an uncertain original.
Consumer versus fixture closure remains separate: no production consumer is
invoked in this foundation, so all original closure credit is fixture-only.

Closed ports must verify their actual CORE prototypes before execution, match
the exact nominated file/DIR role and argument shapes before delegation, and use
finite typed operation queues. Real CORE seek/read/stat and definite original
closure supply IO evidence; nominated failures after an independently proven
close supply only fault-containment evidence. Unknown path/operation, queue
exhaustion, compile/prototype failure, caught sticky fault and trace overflow
cannot become semantic source refusal. Neither a missing future declaration
nor a harness setup failure counts as consumer RED.

Use a dedicated test-only kind instead of widening the captor's deny-all
filesystem port or adopting raw/Perl ledgers. No production initializer, public
factory, caller path/hash/receipt/callback, private handle or PID is exported.
Root must first save/review the complete literal adapter/test delta, mode
matrix, operation counts, trace bound and invocation in the executable subplan;
then commit the mapped design before effects. A genuine missing-adapter JS
assertion may precede implementation without spawning Perl. Only actual
post-implementation self-witness execution can clear this foundation. Complete
staged ownership, authentic creator record, H42 composition, shared holder
failure routing, protected/native and final service cutover remain separate.


## Ordinary directory-FH port continuation: design refinement

The delivered seekable-file/DIR-stream foundation does not cover the actual
ancestry acquisition port: bootstrap uses sysopen with O_DIRECTORY and close,
not opendir/closedir. This causal next prerequisite extends the existing private
test bridge only. File Map is the existing bootstrap test, this spec and its
plan; production bootstrap, main refusal, entry/helpers/map, package/lock,
creator/admission records and all runtime/native/service gates remain unchanged.

Select the same existing map-data leaf and scripts directory under ordinary
ownership. Retain real handles and real thirteen-field metadata, never synthetic
root:wheel policy. Keep existing stream cases distinct and unchanged in behavior.
A directory-FH profile acquires the existing map file first, then the directory
through exactly O_RDONLY|O_NOFOLLOW|O_DIRECTORY; it configures CLOEXEC, checks
actual held/path directory identity and definitely closes with CORE close.
The fixture order is not the future six-ancestry/six-leaf composition order.
No directory contents/read/seek census, filesystem creation/write/delete/chmod,
ACL alteration, external tool/native/SQL or production consumer is admitted.

Keep metadata kind (directory versus regular file) separate from immutable
original disposal kind (file handle versus DIR stream). Register each actual
distinct acquisition before fallible inspection, trace or configuration.
Use the existing sealed original registry, sticky fault and finite typed queues;
independent disposal consumes its attempt before effects, chooses only the
original disposal kind and continues all remaining originals. Mutable diagnostic
or admission data cannot redirect it. Existing DIR streams still use closedir;
directory file handles use close, never interchange these kernel resources.

Alias nomination must inspect an already retained original before any second
CORE acquisition, adding no duplicate/borrowed close obligation. This remains
fixture-only nomination, not proof of the future capsule's pending-success/
returned-alias ownership seam. Test partial acquisition, metadata/configuration
failure, wrong path/flags, caught sticky fault, bounded trace overflow and
false/throwing/post-close-inspection nominations with exact primary evidence.
False/throw nominations occur only after separate physical closure proof; they
prove containment, never uncertain-native-close leak freedom.

All resulting JSON is fixture-only: productionAuthority false, consumerInvoked
false and consumerClosed zero, with no FH/FD/PID/path/hash identity or private
owner record returned. The lower readonly bridge does not invoke acl_free or
capture, establish H42 or initialize staged ownership. Complete literal deltas,
closed modes, independently derived queues/counts/trace caps and exact commands
must be saved/reviewed in the executable subplan before any new test effect.
A missing new-adapter assertion may prove test-support RED before fixture IO;
setup/prototype/compile failure is never staged-consumer RED. Main stays refused.

## Parent-owned real execution edge

The trusted supervisor owns the actual fork PID and private pipes, drops all
supplementary groups then fixed existing unprivileged GID/UID in the child, and
directly execs admitted Node with exactly one fixed protected reviewed MJS entry.
No sudo/shell wrapper, `-e`, loader/preload/caller argv or inherited privileged FD.
Close every unrelated FD; only the private protocol and required standard pipes
survive. The parent captures exit/error/EOF/close itself; child messages never
supply PID, source identity, origin or cleanup authority.
Fix child UID70/GID70 (`_www`) and resulting supplementary group set exactly70;
actual host initially reports70,12,61,100,701, so inheriting its default groups
is not acceptable. Internal fresh fixture prefix is
`/private/tmp/setfarm-task6a-origin-v2.XXXXXX`, initial root:wheel0700, final
root:wheel0711 for runtime search; source/vendor directories0555, entry0444,
vendor Node0555, root-only Perl/helpers/archive0400. No existing path is reused.
Native/process observers initially proposed `/bin/ps`, `/usr/sbin/lsof` and
`/usr/bin/vmmap`; complete system/SIP/native/tool closure must be admitted before
root invocation. Fresh static evidence shows vmmap imports xcselect developer
selection and posix_spawn with a selected SharedFrameworks path. No fixed CLT
vmmap target exists. It is **unadmitted and refused before exec**, pending bounded
static control-flow review or a separately reviewed genuine fixed observer.
An Apple signature/system pathname alone cannot clear that edge. No protected
rehearsal may proceed without complete held native map/protection evidence.
The researched stricter candidate is a supervisor-literal vmmap-only environment
with `DT_NO_RESPAWN=1` and `DT_FORCE_RESPAWN` absent, plus the ordinary scrubbed
PATH/LANG/LC_ALL. This is not a caller environment override or Setfarm guard
bypass: it disables developer substitution. At exact system vmmap SHA256
`9e2b3e0653ca8c4bdde2ea17c01f6f8e1eecab3658aa470b5e6f511c55f59928`,
static5f24/5f34/5f38→607c proves the direct no-respawn branch; architecture
mismatch can exit, never fall back. `DT_NO_RESPAWN_TO_DT` is insufficient and
must not be used as an equivalent. This candidate remains UNADMITTED pending
the full pre-gate/framework/loaded-closure and target-effect review.
Unlike a pure reader, vmmap's analysis callback uses VMUTask/memoryCache peeking
and may suspend the target; analysis-task/corpse choice still needs exact proof.
Only the supervisor's captured private child may be such a target. Its lifecycle
must cover observer failure/timeout, any target suspension and exact definite
shutdown/reap before cleanup; never probe live services or arbitrary PIDs.
Any ordinary exploratory invocation must first have a separate exact reviewed
own-child/no-privilege lifecycle, and yields no protected-origin authority.
Candidate args are `-w -noCoalesce -interleaved` and the exact captured PID:
no partial-name/file/optional address, `-v`/allSplitLibs, output-file, caller flags
or unverified malloc/corpse modes. Require actual complete current/max RWX and
full paths. Footprint is rejected: simplified verbose output omits these
protections and may perform deferred reclaim. One exact reviewed ordinary
own-Perl-child exploration completed (265 regions/54 paths, definite both-close);
this did not admit the privileged observer, prove complete map grammar or
classify every executable region. The cache-only V1 parser ignores other rows
and assumes split sections, whereas the selected candidate is interleaved.
Always parse two complete maps even when no logging cache exists; current OR
maximum executable anonymous/JIT/trampoline rows must not be silently exempted.
Entry currently admits no execution flags; any runtime-mode change requires its
own reviewed behavior/source-policy refinement. Next ordinary exploration may
return the complete exact own-child map as an explicitly diagnostic `mapText`
field, after both definite closes, for in-memory analysis and a sanitized full
test fixture. No caller PID/file selection, live target or native authority.
The second exact ordinary exploration retained a complete interleaved map in
orchestration memory:265 rows (one kernel pseudo-row),47 current-executable,
63 current-or-maximum-executable,13 anonymous maximum-executable rows. This
already occurs in ordinary ApplePerl heap/stack/guard mappings, not merely V8
JIT. A pure full-format parser reports these separately with no admission;
label/maximum permission is neither loaded-code identity nor permission to
ignore a row. Strict held admission still refuses unexplained potential code.
ACL observation uses fixed `/bin/ls -lde` with bounded
complete output. No user-owned Apple developer shim is treated as a real tool.
Apple POSIX Perl has no native XS setgroups/getgroups binding; POSIX getgroups
is Perl-level emulation of the core group string, not an independent kernel
query. Use documented checked core
effective/supplementary GID assignment followed by checked setgid/setuid and
verify real/effective IDs and actual supplementary groups before exec. Its
behavior must be proven in the approved actual rehearsal, not assumed. `$^F`
does not close inherited FDs: explicit complete inherited FD closure and a
close-on-exec error pipe are mandatory. Parent uses exact
`waitpid(forkPID,WNOHANG)` before/after readiness/native samples; no global reaper,
PID reuse, kill-after-reap or child-provided cleanup identity. On parent EOF or
deadline the fixed child self-exits; parent uncertainty retains artifacts.
Shared bootstrap deadline180s bounds authentication/staging/helper work; metadata
GET10s/connect5s/body4MiB, archiveGET60s/128MiB. Held child phase has a separate
nonrenewable45s bound and child's fixed20s lifetime. Once burned, shutdown-only
budget30s never extends origin validity: EOF/graceful wait5s, TERM wait2s then
KILL wait2s only for the captured still-unreaped PID. Every helper requires its
own captured PID/complete output/definite reap. Filesystem cleanup30s is permitted
only after all definite termination and exact fresh-tree identity checks; expiry
or uncertainty preserves the tree. Never signal a reaped PID.

The entry is builtin-only and implements a bounded private fresh-challenge
exchange: `READY\n`, exactly three distinct `CHALLENGE <64 lowercase hex>\n`
requests with matching `PONG <nonce>\n`, then `END\n` plus definite input EOF
before its final `END\n` and exit0. It refuses extra args/exec flags/NODE_OPTIONS,
replays, excess messages, premature/partial EOF and input over229bytes. Its20s
monotonic deadline never renews; refusal exits2. Protocol tests use ordinary test
Node and prove no vendor/protected-origin facts. Parent-owned source/native/physical/child lifetime stays held throughout
the fixed continuation. Source/native pins, exact UID/start/process and actual
loaded executable images are rechecked before/after continuation. Process title,
argv and matching Node image cannot independently prove entry execution: the
admitted parent-issued direct exec supplies that edge. Reject replay/unrelated
PID/transcript, wrong entry, injection, drift, early close, timeout and uncertain
completion. Loss burns the holder permanently; copying or serializing output
cannot reconstruct it. Parent/source/runtime observations remain sampled where
specified; no continuous kernel exclusion is claimed.

## Outcome and cleanup

Private final evidence is explicitly `protected-private-entry-diagnostic-only`
and `productionAuthority:false`; it records actual delivered source/vendor,
retained PID/UID/native/physical/lifecycle proof. Protocol doubles alone cannot
produce that actual evidence. No persistent serialized positive origin token or
production selection is installed. Keep all old/failed fixtures untouched.
Only a newly created exact fixture may undergo separately reviewed code-owned
cleanup after definite child termination, complete root identity recheck and
bounded exact descendant validation; uncertainty retains it. No broad deletion.

After this rehearsal, design authentic compiler/npm/build recipe/full-controller
execution, then held full31+continuous native/DB writer fence, genuine V2 genesis,
outside-frozen guarded32, post32 authentic manifest/owner/source closure and
ordinary33 under the same fence, reviewed live MC/spawner/selector handoff and
all HTTP/authenticated host/fresh clean Setfarm run. None is implied here.

## File Map and review gates

- `scripts/task6a-protected-origin-bootstrap-v2.pl`: fixed authenticated system
  publisher, root-owned source/vendor staging, retained parent and direct child.
- `scripts/task6a-origin-archive-v2.pm`: bounded pure archive/member validation.
- `scripts/task6a-origin-native-v2.pm`: bounded pure native load-command policy.
- `scripts/task6a-origin-map-v2.pm`: bounded pure complete interleaved map parser,
  1MiB/8192lines/4096regions/64summarycategories/32malloczones. Bind actual
  captured PID, full headers/columns/region-table/legend/summary/footer, numeric
  ranges/metrics/current-max permissions and every row; report all potential
  executable/anonymous regions without admission. No process/privilege effects.
  Final literal blob policy must authenticate this helper before privileged use.
- `scripts/task6a-protected-origin-entry-v2.mjs`: exact builtin-only private child.
- `scripts/__tests__/task6a-protected-origin-bootstrap-v2.test.js`: actual system
  Perl/helper and MJS protocol tests, mandatory denial/default graph registration.
- `scripts/task6a-origin-observer-recon-v2.mjs`: ordinary macOS-only zero-argument
  owned-Perl-child map-format exploration. Exact pinned system vmmap with the
  reviewed no-developer-respawn environment; no root/source/vendor/fixture/DB
  effects or origin authority. Hold only captured child, helper bounded10s,
  target20s, output8MiB; EOF5s/TERM2s/KILL2s exact unreaped PIDs and definite
  close. Both helper and target must settle before diagnostic output. A target
  left suspended by observer failure is killed/reaped, never reused. No target
  PID/argv/env/path supplied by caller; no output-file/allProcesses/corpse flag.
  May return bounded complete own-child mapText only for diagnostic parser
  research after definite both-close; not a protection/native-origin receipt.
  Static default analysis options0 may inspect original or analysis copy: the
  ordinary diagnostic does not claim live-snapshot or no target effects.
  Full all-source read-only review BEFORE even ordinary observer execution.
- `scripts/__tests__/fixtures/task6a-origin-vmmap-interleaved-v2.txt`: sanitized
  complete actual ordinary own-child interleaved-format fixture for pure parser
  tests only; substitute process/parent identity labels, preserve region grammar,
  columns, section endings, legend and summary. Never a native-origin witness.
- `tests/execution-attempts/task6a-private-protected-origin.integration.test.ts`:
  separately opted-in exact trusted-owner admitted private actual rehearsal.
- This spec and implementation plan. Keep source changes confined to these mapped
  prerequisites; register only safe default tests and explicitly opted-in effects.

Before implementation, root must resolve actual protected system core/XS paths,
exact transport/deadline/process/credential-drop/FD/native-observer behavior and
write the detailed TDD implementation plan. This is the design contract, not an
implementation-complete or pre-effect review clearance claim.
The first narrow exception is the independently reviewed four-existing-file
ordinary declaration-only parent consumer above, after ordinary P1 and MC
delivery/serialization gates. After its ordinary Step9 delivery/build and fresh
serialization, the same four files may refine the staged-custody declaration-only
contract above. No staged implementation/test effect is admitted before its
literal harness/subplan review. Both slices use ordinary controlled ports only;
neither clears this protected gate or enables main, publisher, launcher or native
effects. No change to the source/vendor/import/native or privilege policy follows.
## Ordinary captor throwing-cleanup continuation

Delivered ordinary foundation exposes capture's final close loop escaping on a
close exception before shutdown, helper permanent-burn accounting and shared
physical-failure routing. This is causally necessary to trustworthy staged
custody, so fix only that continuation gap in bootstrap/test/spec/plan. Keep
production main refused and no staged initializer/native/SQL/service changes.

Each final fileno/close evaluation is independently exception-contained. A false
or throwing result permanently marks close failure; all remaining originals are
still considered, existing helper shutdown executes, no settled record is
published and existing lifecycle burn/physical-failure/refusal routing remains
active. A thrown close is never definite-closure proof or reason to retry an
uncertain original. The separate fds closedir exception is already caught by
capture and is not this skipped-continuation cause; defer any direct-enumerator
normalization change.

A single closed ordinary fixture mode nominates false after actual in-r CORE
closure, then a distinct exception after actual final in-w CORE closure. Fixture
closure remains independently verified and credited separately from consumer
closure. Literal clocks4/census15/owned9, synthetic PID/wait only, no readiness/
read samples or real tool/process/signal/native/DB effect. Historical
pre-execution predictions were old-source3 consumer/6 fixture closures and absent
helper burn. The later execution ledger records actual assertion RED exposing
only consumerClosed3; the other old predicted fields remain unobserved.
The repaired assertions require9/0,
one exact synthetic reap and permanent burn with unsettled helper record.

Only the nominated mode adds a uniquely anchored MEMORY-COPY zero-argument
read-only helper observer: registered/settled/unsettled counts and burned JSON
boolean. No private record, handle or PID escapes; no setter/initializer or
production declaration. Repeat observations before finalizer must agree.
Transparent actual capture observation preserves/rethrows its inner exception;
all unrelated foundation modes retain their previous observer path. Unused wait
on old-source RED is diagnostic only; repaired assertions require it consumed.
Any real sticky fixture fault remains fatal, not a source-refusal success.

The Task2b.2 plan contains complete literal test/source deltas and exact scoped
RED/GREEN recipe. Two pre-effect exact reviews and actual source assertion RED
precede the production edit. Adjacent suite/normal reviewed PR/own clean-main
build and preservation proof are separate delivery gates; none establishes
staged ownership, protected/native origin or final host cutover.

## Actual staged-custody capsule: pending-original refinement

The next deliverable is the three real declaration-only staged operations, not
another standalone adapter. The File Map stays bootstrap, its existing test,
this spec and its existing plan. Production main remains unconditional refusal;
no production creator initializer, publisher, loader, privilege, native, SQL or
service effect is added. Delivered Task2b.4 directory-FH evidence is a prerequisite
only; it does not establish creator custody or this consumer's cleanup.

Select a private absent creator/authentication admission and separately retained
original-cleanup closures. A future independently admitted creator must join its
actual exclusively created root to authentic four-policy-source bytes, official
archive bytes and the unique selected native member before privately initializing
this record. Neither an observer diagnostic nor a copied transport receipt is an
initializer. No caller supplies paths, hashes, setters, continuation callbacks or
handles to the three zero-argument declarations. All authentic creator/publisher
and complete system-core/native admission work remains a subsequent gate.

The private admission shape is exactly `{creator,sources,vendor,selected}`:
creator has `{rootPath,creationIdentity}` with a retained thirteen-field actual
creation identity; sources is the fixed ordered four-record array, each with
`{role,relativePath,gitBlobSha,bytes}`; vendor has `{filename,bytes}`; selected has
`{archiveRef,memberName,bytes}`. The selected archiveRef is the exact vendor record
reference, not an equivalent copy. MemberName is the existing literal
`node-v22.23.1-darwin-arm64/bin/node`. Retain original object/array/row references
and exact keys/order/scalar values separately from independently copied expected
byte strings and derived size/hash commitments. Derived expectations do not read
mutable admission after capture. Four source blob framing/pins and the official
archive pin stay unchanged. The selected-member byte derivation must belong to the
private future authentic producer, never merely to an asserted member label.
These declarations do not implement or certify that future producer.

RootPath is a bounded canonical immediate child of `/private/tmp`, without dot
components, separators inside its final component, NUL/newline or Unicode
ambiguity. The final root:wheel0711 root must match retained creation dev/inode/
UID/GID, while creation-time and final directory modes remain distinct facts.
Source/vendor are the fixed root-relative directories, not caller selections.
Keep the six-leaf modes, one-link/ACL/deadline/size policy and six unique ancestry
records specified above. Validate references, key sets, ordered roles and retained
scalar joins before acceptance and on every recheck; restoration never revives
a consumed or invalid owner. Source/vendor/entry/native authenticity is not
inferred from ordinary synthetic metadata projection.

Before every open, allocate one private pending slot with a fresh initially
undefined lexical output cell. Catch the open separately, preserving its return
and exception before any trace, clock, metadata, configuration or helper callback.
Classify every exposed filled output cell even when the adapter returns false or
throws after assignment; a distinct exposed FH is still sealed for cleanup, but
the failed invocation burns and never becomes successful acquisition acceptance.
Before reading or comparing an output-cell value, establish callback-free native
scalar/GV/IO shape through the already loaded B introspection primitives. Pending
and sealed inputs must be actual native FH references, not indirect names, tied
handles, magical output cells or overloaded bindings. Mere ref equality or use of
CORE::fileno is insufficient: Perl 5.34 permits a tied handle FILENO method.
Reject unknown shapes as permanently uncertain without calling their comparison,
fileno or close methods. The exact non-callback type/flag/magic guard and native
positive/tied/magical/overload denial witnesses belong to the literal subplan;
this prose is not a proven guard. The narrow owned native-shape diagnostic is
fact gathering only, not acceptance of an arbitrary returned foreign handle.
Known original-reference aliases create no second disposal obligation. Only after
that shape gate, select a narrowly trusted builtin `CORE::fileno` step on both
the pending FH and sealed still-live originals; synthetic observers cannot
provide this ownership fact. Verify each sealed live FD against its original
captured FD; refuse a known live FD alias without independently closing it.
Immediately transfer each classified distinct returned original into a sealed
cleanup closure before any other fallible work. Disposal kind is lexically
captured: all twelve staged objects are FHs and use close, not closedir.
Mutable admission or staged metadata never chooses the cleanup FH or primitive.

If pending ownership cannot be classified, burn permanently, retain that
uncertainty, attempt every already sealed original and publish no positive release
or leak-freedom claim. Do not independently close a possibly borrowed alias.
This is an explicit uncertain boundary, not a successful custody state. A real
fresh native sysopen success yields its returned live FH; lower-port corruptions
must not silently strengthen that native guarantee. No validity retry or tree
deletion is admitted by uncertainty.

The combined test dispatcher must distinguish exposed distinct success, exposed
known live alias and raw CORE success hidden by an adapter before output-cell
assignment. Exposed distinct originals are consumer obligations. Aliases remain
the already owned obligation. Hidden raw originals belong to an independent
fixture rescue registry; they are excluded from consumerClosed even if the final
actual descriptor census is zero. No hidden-original rescue is consumer cleanup
proof. Fault/false/throw nominations after definite physical close prove attempts
and sticky refusal only, not native uncertain-close leak freedom.

Select acquisition order: acquire/configure/check each of the six ancestors in
order, then acquire/configure/hash-check each of the six leaves. Each complete
hold/recheck epoch checks all six ancestors, checks each leaf before and after its
actual ACL/captor sample, then checks all six ancestors again. Initial six
ancestor ACL samples plus hold epoch eighteen give twenty-four samples; recheck
adds eighteen. Release performs no ACL/helper/clock validity operation. Shared
capture invalidation and Perl-owner failure routing remain intact; staged failure
cleanup independently attempts its sealed originals even after shared failure.
Consume state and mark each original attempt before effects, continue all sealed
originals despite false/throw, and require true close plus actual undefined fileno
before any positive twelve-handle release diagnostic.

Ordinary fixtures disclose synthetic creator/protected policy/vendor/native
projections. They keep actual owned seekable files, actual FHs, actual reads and
seeks, actual pipe reads, IO::Select membership and actual ACL/capture decisions.
One bounded combined dispatcher owns staged FHs, captor pipes and census DIR
streams; nested competing CORE hooks are forbidden. Each helper gets fresh finite
queues and roles; its synthetic census includes only currently live originals,
not closed historical records. Closed FD-number reuse is not a live alias.
No child is executed; synthetic positive PIDs never enter the child branch.
Unknown effects are denied before delegation and the sticky harness fault remains
fatal across caught calls and cleanup.

Source-derived healthy helper counts are six clocks, four synthetic waits,
two readiness samples, four actual reads, four pipes/eight binmodes/one setup
fcntl, one synthetic fork, eight pipe closes and one census closedir. Startup
adds one clock once. Forty-two helpers add 336 pipe FHs and 42 census DIR streams;
with twelve staged FHs this is 390 originals. With the selected immediate ancestor
checks, helper census reads total 1083 when no additional retained owner is
initialized. Existing directory validators add sixty clocks; five checks per
leaf add `5*sum(ceil(bytes/65536)+2)` clocks for nonempty leaves. New capsule entry/
epoch guards and exact fixture bytes must be added explicitly to the literal
plan; 402 is not a whole-program count. Counts are source-only derivations here,
not observed tests or execution admission. Full literal source/test/queue/trace
and negative-prefix recipe plus two independent pre-effect reviews must precede
any new declaration or test execution.

Primary references for the callback/indirect-name distinction are the fixed
[Perl 5.34 tied-handle contract](https://perldoc.perl.org/5.34.0/perltie#Tying-FileHandles)
and [Perl 5.34 fileno contract](https://perldoc.perl.org/5.34.0/functions/fileno).
They establish the risk, not the installed native FH shape or a complete guard.

The separately reviewed one-FH native shape diagnostic naturally closed0 and
definitely closed its original. It observed cell B::IV FLAGS2049, glob B::GV
FLAGS32777 with no MAGIC and IO B::IO FLAGS1048591 with no MAGIC. These are
ordinary native-shape facts, not a callback-denial or staged-custody test.
Select the following pre-value guard for the forthcoming literal implementation:
inspect the original output cell by reference with B before defined/ref/string/
numeric comparison of its value; require native B::IV reference shape and ROK,
reject blessed/magical scalar cells; inspect its RV as B::GV, reject a blessed
or magical GV; require its IO slot to be B::IO with no magic flags or MAGIC.
Use the installed flag distinction: cell/GV exclude SVs_OBJECT and all three
SVs_GMG/SMG/RMG flags (mask0x00f00000); IO excludes the magic-only mask0x00e00000.
The native IO slot's ordinary SVs_OBJECT bit alone is not an overloaded FH
binding and is not rejected. No IO object conversion, tied object lookup,
method invocation on the candidate or caller-provided classification callback.
Only after this gate may actual CORE::fileno and native reference/FD comparisons
run. B operations and exact negative witnesses still require the complete
literal two-reviewed recipe; this selection is not already proven execution.
