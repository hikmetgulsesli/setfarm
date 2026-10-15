# Task6A protected private source-entry bootstrap v2

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


### Ordinary native epoch omission test, preparation checkpoint (2026-10-15)

The first ordinary component has actual supported raw-region evidence: the
separately retained v8 original completed both traversals, all three original
processes naturally exited0, six streams reached EOF and24 known handles closed
once with independent liveness checks. Independent same-original audit
`a5a3a0a960c6c7bbe89d282670b883632220d309234e3727c747d345a6473f45`
reports2511 checks0,477 frames,225/226 positive96B rows plus normal ends and44384
native raw bytes. This is an ordinary capability result, not protected image,
Root, startup, V2, compiler-transitive or whole-project admission.

The next test invokes the genuine current parent consumer from a declaration-only
memory copy. The disk Source and its cold/main guards remain unchanged. The copy
removes exactly the cold prefix and final main call, injects one private zeroarg
test initializer for the same Perl-owned genuine Node and four pipe originals,
and adds passive acceptance observations at the unchanged READY/PONG/END branches.
It does not call the vendor/staged production publisher or install a Source gate.

The consumer is the sole reader of its Node pipes. Native BIND/SAMPLE waits pump
only the observer pipes while the consumer runs. Genuine CORE delegates retain
the real Node bytes, urandom32B reads, syscall return/errno/status, waits and closes
in the shared original ledger. Incoming errno/status are saved before a witness
and restored immediately before the genuine Source syswrite; actual postcall
state is retained before logging and restored on return. No synthetic wait0,
nonce, stat, FD, return, native packet or cached reap is supplied to Source.

Before forwarding the first actual CHALLENGE attempt, an oracle-only fence records
whether a Source-origin native epoch completed, then obtains genuine BIND/SAMPLE1
if absent. At the actual END attempt, after the third accepted genuine PONG, the
second fence similarly obtains SAMPLE2 if absent. These witnesses keep the real
Node alive and unreaped until both queries finish; they never count as Source
gates. Scope is bound to the actual complete48B FD3 command write, its phase and
first response sequence; the matching completed response inherits that command
record. It is never inferred from later parser time after a witness has ended or
from a test-provided success callback. The independent decoder compares all command
writes, raw responses, native identity, actual PONGs, ownership and natural waits.
Actual distinct64hex challenges come from the consumer's real urandom reads;
fixed v8 test nonces are not reused.

On witness failure, settle the original observer first. If it is active, unknown
or unsettled, Source wait/kill delegates throw before CORE::waitpid/kill, causing
Source uncertainty and preserving the unreaped original Node lease. No query is
made after a consuming Node reap. Failure, forced cleanup, partial raw capture,
unknown ownership, malformed material or an unsupported capability is ineligible
for the omission assertion. Every known close is once-intent with independent
liveness, shared between Source and harness; no retry/adoption of unknown FDs.

Only after the actual consumer accepts229 input/220 output bytes, three distinct
nonce/PONG pairs, closes its five originals, and both native phases plus all
custody/EOF/natural cleanup checks pass, the test asserts omissions equal[] against
the predicted current[1,2]. This is a new test preparation, not an already observed
RED. A missing export/initializer/artifact, setup error or unsupported native call
does not qualify as behavioral RED. Future GREEN must demonstrate genuine
Source-origin completed native phases outside witness scope, not a no-op injected
gate or a relabelled witness; production fork/publisher/Root composition remains
a separate requirement.

The maintained fixture uses only a test opt-in locator manifest. Unset means
explicit SKIP/UNRUN without native credit. A selected missing/malformed manifest
fails setup before any fork. Its strict canonical JSON may locate the exact
literal-pinned ordinary Node26/C2/header/observer cohort; it accepts no caller PID,
argv, command, provider or CODE. Current Source and entry are read only from fixed
maintained URLs and verified against their literal pins. Regular nofollow held and
named metadata, owner/mode/nlink/size and before/after pins are checked. Node's
observed file GID80 is retained separately from the ordinary process501:20 profile;
the test-owned material/observer are501:20. Fixed child environments exclude the
selection environment. Manifest and receipt DATA grant no Source/Root authority.

This causally adds one fixture helper to the former four-path integration map:

| Path | Role in this phase |
| --- | --- |
| scripts/task6a-protected-origin-bootstrap-v2.pl | Unchanged pinned DATA; future implementation only after eligible actual RED |
| scripts/__tests__/task6a-protected-origin-bootstrap-v2.test.js | Import/register the ordinary test inside its existing ordinary-host branch |
| scripts/__tests__/fixtures/task6a-consumer-epoch-native-v1.mjs | Complete fixed owner template, capture and independent decoder; no import-time child |
| docs/superpowers/specs/2026-09-30-task6a-protected-origin-bootstrap-v2-design.md | This bounded contract |
| docs/superpowers/plans/2026-09-30-task6a-protected-origin-bootstrap-v2.md | Test-first sequence, material and limits |

The extra helper keeps complete real custody code out of the existing456KB test.
No one-off logs path or test opt-in is added to production bootstrap. The fixture
has the v8 finite15s normal/45s parent total,50s+15s outer Perl capture,80s test,
fixed native schedules and existing raw/event/OS/IO/read/cleanup bounds. A separate
95s+15s known-original Node recorder retains full TAP streams and actual wait.
No privileged action, service change, compiler run, PM2 retry or V2 enabling occurs.


### Historical implementation-candidate checkpoint after the eligible RED

This section supersedes only the preparation-state statements in the preceding
consumer-test section. The original test preparation was delivered at
`0ebdb018247f2085c142bce891ee52cdc3f34355`. Root ran that original once with
bootstrap bdb52017 unchanged. Its sole final assertion demonstrated omissions
`[1,2]` after genuine native/custody eligibility. Independent same-original audit
`7c8a5f7248e73ded53a399013ec70b258222b5260e6a7a49b7724d96b158988e`
qualified2691 checks0:476 full frames,225 positive96B region rows and normal end
per epoch,452 attempts,20 native events, three genuine PONGs/96 entropy bytes,
26 once closes, two real reaps and six EOF observations. Setup/initializer,
capability, IO and cleanup failures did not count as the behavioral RED.

The five-path File Map remains exact. Bootstrap now receives the private native
owner and the three consumer joins; the dedicated test adapts its existing
modeled parent queues; the maintained helper records the real Source-owned
exchange; these paired documents record the causal contract and verification.
No additional production interface, binary publication or artifact selector is
introduced. Every old bootstrap byte outside the declared declarations, native
block, milestone/deadline/Node-poll/disposal joins remains unchanged. The existing
Source publisher is preserved rather than replaced or described as absent.

The private owner has zeroarg prepare, epoch1, epoch2, finish and disposal
operations. Its original fork PID, target PID, birth ordinal/start and four FH
records are private lexical state. The actual producer must supply those known
originals and call prepare immediately after its real mint. Ordinary fixture
initialization binds the same Perl-owned genuine Node/observer forks and FHs,
then invokes the real Source prepare; it supplies no CODE, phase, result or
success callback. This is a disclosed fixture constructor, not proof of the
future production fork/publisher or protected initial realm.

Prepare retains each eligible distinct original raw FH+IO before metadata and
independently marks all known cross-owner aliases before a semantic refusal can
enter cleanup. Unknown/aliased outputs are retained without another close lease.
Metadata/configuration operates on private kept originals. Failed raw tuples
remain diagnostics; a cleanup identity is published only after admission. The
borrowed FH scalar is guarded before FETCH even after close; sealed FD/identity
copies govern rechecks. PID refusal prevents wait/signal without losing safe
known-FH retention. A trusted finite cleanup deadline is sealed before fallible
metadata; cleanup does not coerce a rejected creation cell.

After accepted READY and Node setup EOF/close, Source alone reads observer setup
EOF, writes BIND then SAMPLE1 and consumes complete responses before the first
CHALLENGE. After the third matching PONG, it writes SAMPLE2 and consumes its full
response before END. No absent-owner fallback or no-op epoch exists. Source
owns command writes, raw capture, strict phase/sequence/API/native binding/
region parser and completion state. Scope comes from the actual complete48B
command write and corresponding response, never the later parser time.

After Node END, its existing five closes and actual natural0 wait, Source writes
STOP, reads native right settlement/CLOSED and full observer EOF, closes all four
observer endpoints once and consumes the actual observer natural0 wait. Five
Node/entropy closes and four observer closes are separate obligations. On
failure Source settles the original observer before any consuming Node wait or
signal. An unknown observer keeps the Node lease unreaped; no fake wait0, cached
reap, foreign PID or descendant is adopted. Stopped-query safety permits Node
settlement only after the observer is actually reaped; composite cleanup also
requires every one of the exact four known closes. A physical close failure
cannot become complete merely because queries have stopped.

The native lifetime is15s from the retained original observer creation, clipped
to the existing bootstrap and parent deadlines. Every Source-native phase is
also bounded (setup5s, BIND/SAMPLE3s, STOP1s). Disposal has a sealed finite total
limit within45s and independent reserved known-close attempts. Fixed bounds are
131072 normal OS actions,32768 IO actions,16384 read attempts,8322 frames,
2MiB total retained observer output,1MiB native raw bytes,64KiB stderr,16B setup,
192 FD3 input bytes, bounded193 write attempts,4076 cleanup actions plus20
reserved physical-close actions. These limits may refuse earlier; blocking
system calls are not claimed preemptible. Every consumed read and successful
write prefix is retained before semantic guards; partial/error histories cannot
qualify positive closure.

The disk target policy remains70:70. Only the ordinary declaration-copy fixture
uniquely projects the new native-owner literal to actual501:20 and binds the
same literal-pinned Node26/C2/header/observer material. The maintained manifest
is TEST-only locating DATA and grants no production authority. Source itself
reads no new environment, path, PID, argv, DTO or provider interface. Generic
unset selection is SKIP/UNRUN; selected malformed material fails before fork.
The genuine helper is a passive observer of Source's exact known IO/waits and
shares once ledgers. It no longer sends healthy STOP, reads the healthy observer
or reaps it after the consumer. Its fallback never counts as Source proof.

Two fixed negative controls substitute only the phase cell of a returned buffer
after the complete genuine BSD packet/outcome and original buffer were retained.
They separately cover before-first-challenge refusal and late SAMPLE2 observer-
first cleanup. The raw native original remains immutable; modeled delivery is
stored separately and cannot count as a genuine native result. Source must
refuse without the forbidden Node write and settle known originals. Negative
disposal can close known streams before EOF; that scope claims retained actual
bytes, known once close and actual wait, not invented full EOF or a successful
protocol.

Existing424242 fixtures remain explicitly modeled. They use distinct owned FIFO
roles/observer424243 and complete modeled raw packets through the real Source
parser, with separate native traces. Original Node refusal/lease/effect oracles
remain visible; additional genuine Node effects cannot be hidden as native.
One shared monotonic chronology governs native and parent deadlines. Tests for
44→46 renewal are causally projected around the earliest joint15s boundary.
The parent-only renewal mutation witnesses that its local predicate was reached
while the unchanged native15s deadline correctly prevents settlement; it no
longer claims the composed owner should accept an expired lifetime. The nonzero
status mutation covers all exact four composed zero-status predicates without
changing the native packet/deadline policy. Parent-ports-only fixtures retain
their independent original handle/call contracts and16 parent-clock leaves are
outside the adapted consumer queue family.

At this implementation-candidate checkpoint invocation was UNRUN. The required
GREEN was actual Source-origin completed native phases and Source-owned custody;
a test witness is never gate credit. The actual outcomes are recorded below.
C2/737624 remains an ordinary unpromoted artifact outside the fixed staged6/12
protected cohort. Mapped-image file identity, initial native/compiler trust,
Root staging, production constructor/publisher composition, PM2 owner-closed
UNRUN, V2, migration32/33 startup admission and whole-project completion remain
separate and fail closed. No runtime/guard waiver follows from this slice.


## 2026-10-15: genuine fixture fallback grouping correction

The first unsolicited-phase original failed mechanically in the test helper,
not at a Source refusal oracle. Original tool completion `ed6cc5` was exit1;
Node81366 was natural1 with complete outer TAP capture (1143 bytes), no capture
errors or forced ending. Perl81370 was natural60 with215 stderr bytes:
`Can't use string ("") as a HASH ref while "strict refs" in use` at emitted
`program.original.pl:707`. The unparenthesized `grep BLOCK LIST` allowed
`@children && stream_done()` to become its list, so a false stream predicate
supplied an empty string to the hash-reference block. This original is an
ineligible harness failure: it proves neither the negative Source behavior nor
complete inner Node/observer settlement. All original raw and terminal records
remain immutable.

This correction has exactly three maintained paths:

- `scripts/__tests__/fixtures/task6a-consumer-epoch-native-v1.mjs`: group the
  existing `grep` result before testing `&& stream_done()` in the failure-only
  fallback. Preserve its child predicates, actual stream state, deadlines,
  signals, raw retention and eligibility rules.
- This paired specification: record the observed mechanical cause and scope.
- `docs/superpowers/plans/2026-09-30-task6a-protected-origin-bootstrap-v2.md`:
  record serialized review, application and fresh-negative verification.

Sourcec268 and dedicated modeled test01e82a remain byte exact. The earlier
UNRUN statements describe their preparation checkpoints; the separately retained
healthy Source-origin actual is qualified by its own original and independent
review `ec22d29f235c4ed6c38013f3bdd6e5923929078b1cefb21f188965fb06e6a146`.
This failure-only genuine fixture template is not executed by the closed
modeled4/6/676/ports34 routes; those keep their own original graphs and results.
This correction gives no new PASS, EOF, cleanup or runtime admission credit.
At that repair-preparation checkpoint the corrected negatives were UNRUN and
required fresh full-program, material and capture nominations after application.
The later corrected originals and their limits are recorded below. Existing gates,
ordinary-only artifact scope and all production/Root/V2 exclusions remain.


## 2026-10-15: actual ordinary consumer verification checkpoint

The implementation was committed at94b86702; the failure-only helper grouping
correction was committed at9d2b946b. Bootstrapc268 and modeled test01e82a are
unchanged between those graphs. The one healthy Source-origin original on94b
completed Source samples2, witness0 and omissions[], with26 once-closes and full
observed streams; its own same-original audit is
`ec22d29f235c4ed6c38013f3bdd6e5923929078b1cefb21f188965fb06e6a146`.

Four disjoint original modeled routes4/6/676/34 completed720 distinct callbacks
with zero test failures, skips, cancellations or todos on94b. The remaining676
recorder itself exited1 because five expected titles were ordered incorrectly;
its actual Node exited0 with676 PASS. That recorder failure stays recorded. The
source-order classification and aggregate in the paired plan preserve this
distinction without replay or overlap. This is modeled callback evidence only.

After the grouping correction, each fixed negative ran once on9d2: before-first-
CHALLENGE phase0 delivery and before-END phase2 delivery. Genuine original raw
was retained before changing only the four-byte delivered phase cell. Each outer
Node and Perl completed naturally0 with full capture EOF. Both original fork
children naturally exited2, not healthy0. The controls established canonical
Source refusal, the forbidden successor write's absence, observer-first waits
and26/27 known once-closes (8/9 by Source). Node stdout/stderr were early-closed
with actual EOF0/0; no full inner EOF is invented. No C2 NAME-deallocation or
CLOSED record was captured in either negative, so no native-right settlement
proof or healthy native-protocol result is claimed from those failure paths.

The paired plan links both actual terminals and the separate semantic/custody
audits. Captured before/after/copied input commitments remain unchanged: the
healthy/modeled graph used helper54b44; corrected negatives used helper0c0f with
speca4a2/plan52f9. This evidence-only reconciliation changes the two documents
after all originals ended; all three implementation/test code pins stay exact.
It does not relabel a captured document or claim the final five-file graph was
replayed. Ordinary501:20 metadata and an unpromoted C2 artifact do not establish
Root, mapped-image/initial TCB trust, protected staged6/12, a production fork
constructor, V2/startup admission, PG activation, PM2, family closure or overall
project completion. Existing guards stay closed.


## Source-owned constructor behavioral prerequisite — test preparation 2026-10-15

Current disk Source remains c2685642 and contains no actual launcher constructor. This checkpoint adds a selected ordinary test and extends the existing test-only helper; it does not implement or open the Source constructor. The existing zeroarg consumer is the behavior entry. The authentic official Node22 archive ef28d8fab2c0e4314522d4bb1b7173270aa3937e93b92cb7de79c112ac1fa953 and selected member 2e3f1286a7eb3736346ed1803e458a0ff909e2b2d5bc746144dcb76970e9b99d are same-original audited DATA, not executed runtime authority. The separately compiled protected-profile observer5374233d is also an audited future payload input, not a Root query or activated cohort.

The exact causal File Map for this prerequisite and its later implementation is seven paths: `scripts/task6a-protected-origin-bootstrap-v2.pl`; `scripts/__tests__/task6a-protected-origin-bootstrap-v2.test.js`; `scripts/__tests__/fixtures/task6a-consumer-epoch-native-v1.mjs`; `scripts/native/task6a-origin-owned-child-observer-v2.c`; `scripts/native/observer-abi-guard.h`; this spec; and the paired plan. Test preparation applies only the dedicated test, helper, spec and plan (four paths). Bootstrap and native implementation paths remain unchanged/unapplied until an eligible actual behavioral RED and a separately reviewed implementation.

The new ordinary callback uses an explicit bounded TEST-only manifest as a locator for fixed pinned authentic material. The declaration-only memory copy retains all archive/member/selected-path/Git blob and source data policies. Its disclosed projection keeps the real process501:20 distinct from inherited Source files501:0 and genuine user:wheel ACL rows; system ancestors remain0:0. No producer/staged phase, held FH, child PID or native gate is injected. Source alone runs the existing genuine producer: thirteen creator originals must close before twelve staged originals are held over six directories and six files. Before the existing consumer, the test passively records that real state.

The eleven fixed Git-response occurrences plus two fixed vendor occurrences are modeled **transport**, not HTTPS or review authorization proof. A small fixed Perl emitter reads pinned file-backed bodies and emits the exact modeled footer through genuine Source capture. No archive/node bytes occur in argv, environment or program source. Every original helper fork and actual wait is retained separately from positive Source-consumer launcher creation-origin records; unknown stacks are ineligible and never counted as launcher originals. All actual Source-capture raw streams are retained before interpretation, with finite deadlines/caps and independent known closes. The producer's healthy old graph predicts55 helper originals (13 transport plus42 actual ACL captures); those do not satisfy the two launcher originals.

The proposed old-graph RED is solely the final assertion actual launcher count0 versus expected2 after all material, real producer, captured helper natural0/fullEOF and original known-close eligibility. Canonical current consumer refusal is retained. Missing exports/initializer/capsule, ARG_MAX, unrelated errors, resource/capture failure, forced or unknown child settlement do not qualify. No test-created launcher or observer exists in this case, and the former test-owned epoch initializer is not called. A later GREEN must be repinned to its changed Source and prove real Source fork ownership, heldexec and consumer/native custody; the present test-preparation graph is not a GREEN claim.

Execution remains serial and Root-only after complete current program/material/recorder review and clean test-preparation delivery. Inner new writes are capped at480MiB (448MiB Source/data capture plus32MiB Node fixture records), with the separately capped32MiB outer recorder composing a512MiB reservation and ongoing8GiB free-space observations. Root may not treat a resource refusal as behavioral RED. No large immutable input copy is required. The private helper captures and created Source tree are retained for diagnosis, not silently deleted or adopted. Ordinary C2 at-rest material does not promote protected0/70 execution, mapped-image identity, initial TCB, V2/cold/controller/DB/startup gates or PM2 closed-UNRUN.


## Historical Source-owned constructor preparation after the qualified baseline RED

Current implementation preparation follows the authentic Node22 design-only v3 and the existing zeroarg consumer. The baseline ran on clean test-preparation5b44ef7484bf53e7c2198d37d52801891e89fd94 with unchanged c268 bootstrap: genuine Source13 creator originals closed,12 staged originals held then released,55 actual helper originals settled, canonical consumer refusal, and the sole final assertion0 actual launcher originals versus2. Same-original audits1570 and1394 checks qualified this RED. It executed neither the staged Node22 nor the observer. The outer0 qualifies the failed-test capture, not feature success.

The causal File Map is exactly seven paths: bootstrap; dedicated bootstrap test; test-only consumer-epoch fixture helper; `scripts/native/task6a-origin-owned-child-observer-v2.c`; `scripts/native/observer-abi-guard.h`; this spec; and its paired plan. The native source152988344183715f960176e81e908c479ee891ff54cabc2712b0fb10de8ded2c and ABI2887a041912ca0fd25c83d50628e45c0bb10afd1dd637fde79cdcab21298a606 are copied exactly from the independently audited ordinary compilation. Its protected-profile35784-byte payload5374233d94f8bc8263fce1bd6711a1257cb747b5b67d994f0b3a177c02d3f8fa is literal private bootstrap DATA, not a tracked binary path, public release or runtime-build interface. It has not been invoked with observer0/target70.

The private constructor preclaims only this fresh parent/native occurrence and the genuine producer-held cohort. Wrong arity, prior parent/native ownership or an invalid held realm refuses before any new claim and without disposal of a prior realm. It retains genuine pipe/file originals and each positive fork role before metadata. Unknown creation outcomes remain quarantined without PID adoption. Source owns the separate fixed capsule, both actual forks, fixed directexec, setup EOF, Node IO, FD3 command/response parser, native samples and observer-first settlement. Material lifetime spans actual Node/observer settlement. Public held-owner APIs cannot burn/release staged12 through a live/unknown constructor lease; live checks use the private non-disposing epoch. All work shares the earlier sealed monotonic deadlines and finite quotas.

The Node path and entry are fixed views of the six-leaf/twelve-original holder. Their held/named identity is checked before fixed named-path exec and their known originals remain held until exec's CLOEXEC boundary. This does not claim an unverified atomic descriptor-exec primitive or loaded-image file identity. The observer capsule is Source-created, read back, ACL-checked, sealed and held. Both children close surplus inherited descriptors; observer accepts only private FD3/stdout/stderr/setup. Production Node70 credential transition remains separate from the explicit ordinary memory-copy projection (actual501/processGID20, inherited fresh-fileGID0 and audited ordinary737624 payload).

Protocol factoring preserves the existing consumer body as a private closure. Old queued424242 protocol units and the previous test-owned real Node26 epoch fixtures call that genuine body through explicitly named test-only adapters; they do not attest new construction and never inject a no-op constructor or native epoch. The public zeroarg entry always takes the real constructor path. Existing protocol refusal, original Node effects, native raw parsing and cleanup assertions remain effective.

Future ordinary GREEN is eligible only after all material/custody oracles, actual two Source creation origins, genuine Node22 READY/setup EOF, Source-origin complete FD3 writes and corresponding native responses, three actual64hex nonce/PONG pairs, Node0 before STOP, observer CLOSED/0/full healthy EOF and exact once-close evidence. The test records bytes and actual outcomes passively; no witness or helper sends native commands or supplies Source gate success. Two scoped physical failure controls retain genuine pipe outputs before modeled throw, and two already-enrolled genuine forks before modeled guard refusal. Unknown-fork, lease, FD-drift and deadline branches are finite modeled controls; no deliberately unowned real child is created to exercise uncertainty. No GREEN or negative result is claimed by this prepared implementation.

Cold BEGIN/main/controller, PM2 owner-closed UNRUN, initial Root/Perl/native/compiler TCB, protected cohort activation, complete mapped-image identity, OS/DB exclusion, migrations32/33, V2/current-entry and dashboard3333 startup remain closed/unqualified.

## Current ordinary constructor and staged-fixture disposition

The seven-path constructor was applied and normally delivered on a13f438113e0322639c623f739af424e99f06012. Root original39efa6→4c32dc completed natural outer0, direct Node6037/Perl6039 and Source-owned Node6155/observer6156 all natural0: one selected PASS, no other result,9.529s. The original retains222 frames, each phase98 positive96-byte region rows plus its actual0/EINVAL terminal,95 helper originals and42 stable material pins. Independent same-original whole3275 checks (8aaa16ad) and custody3368 checks (f23ef295) were C0/I0/M0. This is conditional ordinary constructor ownership/protocol evidence, not protected Root/loaded-image/TCB/cohort or functional-startup admission.

The separate adjacent-nine original9ef7c0 ended outer2/direct Node6828 natural1 with6 parent-protocol PASS and3 staged-custody failures. The three failed while compiling copied Source at eval3899 (`} $node_view`), before their custody assertions. Their fixture installs an ordinary-sub denied `CORE::GLOBAL::exec`; its legacy exact normalization covered only the `$tool` block form. The two newly declared constructor block forms require ordinary-sub syntax in copies with that denied override, even though these staged callbacks never invoke either constructor.

File Map3 is the dedicated bootstrap test and the paired spec/plan. The test adds two strict literal syntax mappings restricted to staged-custody/staged-captor-ports copies; argument order, denied exec behavior and all old assertions stay exact. Production Source7ff8, the real fixture helper, native C/header and already nominated physical materials remain unchanged. Proposed focused verification selects the three failed staged-custody callbacks plus one existing cheap staged-captor foundation callback. Its two fixed76/82-byte backing inputs are pinned explicitly. The previous6PASS are retained without replay. Focused4, physical controls, modeled controls, final delivery and functional startup are not claimed complete here.

## Historical modeled branch controls — v2 preparation checkpoint

The causal File Map stays3: dedicated bootstrap test and paired spec/plan. Source7ff8, helper e8f3 and native C/header are unchanged. Four closed ordinary model callbacks cover six fresh live/unknown material-lease cases, actual original FD enrollment before modeled mismatch, unknown observer fork acquisition without real process operations, and one shared normal30/cleanup45 chronology including the genuine shared-wait state join. All24 scenarios,13 explicit declaration-copy projections,9 predicate mutations and complete programs/inputs are nominated outside the repo. Genuine ordinary data-FH outcomes are retained separately from modeled UID/mode/ACL/PID/clock delivery and fixture backup cleanup. The actual Source holder, capsule, file predicates, captor, epochs and disposal code run through typed ports; no success-returning gate stub is installed.

Existing conditional ordinary constructor GREEN and both physical controls remain their same original results. The failed adjacent-nine retains6PASS/3syntaxFAIL; its later focused4 correction independently passed once. The immutable v1 modeled candidate remains UNRUN/HOLD after two complete reviews found only I1 material-retention and I2 native-close oracle gaps. This v2 corrects those oracles with passive sealed-shape views and adds one material-retention mutation; no production Source/helper/native byte changes. At that preparation checkpoint the four modeled controls and all24 inner scenarios were UNRUN. Protected Root/TCB/mapped-image/cohort/OSDB/V2/cold/main/startup admission and PM2 owner-closed UNRUN are unchanged.

## Modeled fixture correction after the original four-callback failure

Root applied and delivered modeled-v2 on clean4cf83231258349eaec2ce633974c71a01740fb78; Source7ff8/helper e8f3/native code are unchanged. Original06ed7a/session38742→d7db6b remains FAILED: outer2/direct Node14461 natural1,2PASS/2FAIL/0other, full outer Node EOF, no capture errors/forces/unknown. All24 inner scenario programs actually ran and supplied retained spawnSync status0/raw DATA. This does not invent separately captured inner PID/wait/EOF authority. Whole f7b9d7aa/781 and custody b660a904/10105 checks audited the same original. Controls1(material lease) and3(unknown observer/material retention) genuinely passed and are retained without replay.

Both failures are fixture-only. Descriptor CLOSE MUTANT15 performed genuine CORE close1 and independently observed fileno undef, then its still-armed modeled-fileno adapter wrongly rejected the Source post-close liveness probe; baseline close14 was clean. Only the same retained actual record with independently established attempted1/closed1 may now forward that genuine undef. Pre-close sealed-FD equality, wrong-FD delivery, raw event, unknown/unarmed refusal and actual close primitive are unchanged. Outcome-join23 produced the correct Source same-original reaped1/uncertain0/status0 and raw Perl false knownLive empty string; only the exact expected diagnostic scalar changes from numeric0 to empty string. Production Source boolean/wait logic is unchanged.

File Map stays3: dedicated test and paired spec/plan. V1/v2 artifacts and failed transcripts remain immutable. Full24 inventory/13 projections/9 mutations are reconstructed with the corrected shared program; proposed actual selection is ONLY failed callbacks2 and4, containing descriptor4 plus deadline/join5 inner scenarios. No healthy/native/physical or passed1/3 replay. New selected2 and inner9 remain UNRUN pending exact current reviews, Root clean application/delivery and one serial original. Observed cap maxima6603/8192 ports and798/1024 clocks refer only to the24 original reached scenarios, not a universal bound or future guarantee. No native/Root/TCB/image/cohort/DB/V2/startup/whole-goal or PM2 owner-closed UNRUN credit changes.

## Physical-owner lifetime: corrected v2 test-only RED preparation

Current delivered11da1de2bee995c5c18e4017c3f7e66003f31fb0 retains Source7ff8/helper e8f3 before this additive fixture. The existing actual zeroarg producer13-closed→12-held, Source-owned two-child constructor/native/protocol and custody proof remain valid ordinary originals. Current four modeled branches have composed coverage: original controls1&3 PASS plus the focused2&4 original73c3b9/direct Node16507 natural0/2PASS/nine inner scenarios. Whole f248ebaa/709 and custody acdf69c2/712 checks qualified the latter; Root eb7ee2b1 records composition. The original full-four remains FAILED2PASS/2FAIL; it is not rewritten as a four-PASS run.

Approved physical design bbf182ff/12611B and scoped whole d55dace6/20 plus custody4d1728f6/40 checks require physical claim only after genuine13→12, non-disposing validity, pending-cell acquisition on false/throw, observer-first role/helper settlement, sticky unknown quarantine and exact independent known closes. No Source implementation is prepared here. The exact RED File Map is four paths: dedicated test, maintained test-only helper and paired spec/plan. Future implementation adds Source as the fifth path; C/header/payload/public interfaces stay unchanged.

One new closed ordinary-host callback preserves all existing callbacks. Its TEST-only literal manifest locates the existing authentic Node22 archive/selected material and qualified ordinary observer; no new material is acquired. The emitted declaration copy has45 exact traced projections: inherited37 ordinary/capture projections plus8 passive fixed physical-site/snapshot/quota projections. Component-specific raw opens at hold_file3913/hold_ancestry4006 and cleanup4025 retain exact actual output/return/errno/status, Source starting/owns/internal context and GV/IO/FD; generic creator/staged/capsule '/' opens never count as physical originals. Passive state/epoch/write observations supply no Source owner, initializer or gate. No physical hold is invoked by the harness.

Current genuine constructor eligibility must complete first: actual two Source launcher origins, Node22 READY/setup EOF, Source FD3/native bindings and two nonempty96B epochs, three fresh nonce/PONGs, Node0→STOP/CLOSED→observer0/full healthy EOF, exact once-close evidence, genuine creator13 closed/staged12 released, all95 helper originals settled, unchanged pins and complete capture. Root must independently join physical state new/0/empty and zero component acquisition events. Only then the strict final expected4 versus actual0 physical assertion can be eligible behavioral RED. Exports, missing setup/material, unrelated exceptions, forced/unknown cleanup, malformed capture or counter exhaustion never qualify. Publication remains provisional DATA with qualifiedBehaviorRED:false/qualifiedOrdinaryGREEN:false until actual natural TAP and independent original review.

Limits are retained195s normal/210s final inner capture, Source bootstrap180/constructor30/native15/cleanup45,448MiB Source+raw plus32MiB Node records and separately32MiB Root capture (512MiB),8GiB floor snapshots, helper cap127 plus two launchers129, clock observations65536, census calls129/entries65536, physical events256/acquisitions4, reads32768/raw256MiB/raw-writes65536, per-stream caps unchanged. Current RED predicts95 helpers. Future physical scheduling is four acquisition ACL plus the existing seven-ACL post-hold validator once, then three seven-ACL epochs:32 added logical captures,127 total; current preparation executes none and proves no future timing bound. Complete changed-Source/program review must rebind actual private validator taps, release/pending state and exact physical gates before any future GREEN or denial dispatch.

The immutable v1 preparation remains UNRUN after complete whole389/custody464 static reviews found only missing positive observation completeness (I1). V2 requires exactly two launcher markers joined to retained raw Source fork origins/PIDs/private role events/order and exactly eight before-write markers paired one-to-one immediately before independent actual Node4/FD3four writes. Three fixed DATA-only companions delete all markers, the first launcher marker, or the first write marker from BOTH traces while retaining every nonphysical event; each copied result must be rejected before the final physical assertion. They run no additional Source/native case and create no owner/gate. Source, all45 projections and the entire emitted Perl semantics remain exact, aside from fresh v2 fixture-path literals. Root v1 binding remains historical/incomplete; a new complete Root capture binding and both current reviews are required.

Cold/main, Root/TCB/mapped-image/cohort/OSDB/V2/32/33 and3333 startup remain closed/unqualified. PM2 remains owner-closed UNRUN. No prior healthy/physical/model run is replayed by this preparation.
