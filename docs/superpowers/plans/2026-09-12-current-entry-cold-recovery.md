# Current-entry Cold Recovery Implementation Plan

> Execute serial code-writing tasks on the existing isolated branch. Use
> independent investigators/reviewers in parallel. The root agent alone owns
> staging, commits, review handoff and delivery.

**Goal:** Recover Task 6A from the actual stopped-spawner/historical-record state
without weakening current-entry authority or runtime guards.

**Architecture:** Admit the exact authenticated historical pair separately from
the current pair; establish a one-shot real sealed cold spawner; replace the
watcher-only rebind with an authenticated direct-detached transport. Existing
ordinary four-service and final verifier contracts remain strict.

**Tech Stack:** TypeScript ESM, Node.js, PostgreSQL read-only observations,
Darwin process/file-descriptor controls, node:test.

**Spec:** `docs/superpowers/specs/2026-09-12-current-entry-cold-recovery-design.md`

## Global constraints

- One writing branch: `fix/current-entry-cold-recovery`, base `eef9f6c4`.
- No live data, service, schema, build-retention or generated-project mutation
  during implementation/tests.
- No runtime/dirty-build overrides, arbitrary process kills, fabricated process
  identity, force-push, direct-main commit or external signed distribution.
- Keep the frozen original quarantine inventory/hash and the current exact-two
  prerequisite selection separate from additional historical evidence.
- A historical schema never describes new effects. Version changed private
  authority shapes and preserve strict historical resolution.
- Every code change has a demonstrated failing behavior test before its fix.
- Focused checks precede broad gates; do not repeat full P3 between unfinished
  tightly coupled slices.

## File map

Task 1 modifies only `src/internal-production/baseline-post-handoff-receipt-v1.ts`
and `tests/internal-production/baseline-post-handoff-receipt-v1.test.ts`.
Task 2 adds the isolated cold/transport kernel and focused tests if existing
modules cannot contain it cleanly. Task 3 integrates it into existing
`baseline-spawner-startup-admission-v1.ts`, `baseline-service-restart-helper-v1.ts`,
`baseline-restart-authority-retirement-v1.ts`, `spawner.ts`, receipt authority and
their owning tests. Root updates the literal main-plan/closure-design File Maps
and projection/source-boundary contracts for every new runtime file. No source
outside that causally necessary boundary is included.

## Task 1: Preserve exact authenticated historical prerequisites

**Consumes:** Existing fixed-root historical parsers, current overlay builder,
quarantine admission/publication fences, and post-visible pinned replay.
**Produces:** Separate authenticated historical inventory, strict history-bearing
V2 disposition, and refusal of new public prerequisite publication in the
unrecovered exact-poison store. Ordinary selection still returns current pairs.

- [ ] Add a disposable two-generation fixture using the existing original-store
  and overlay helpers: settle the two admitted historical records, advance the
  fixture source, derive a different current pair, and invoke real admission.
  The behavioral assertion is `assert.equal(result.outcome, "returned")` plus
  independent assertions that successor pairs are the new current pair and
  original bytes/identities remain unchanged.
- [ ] Run the narrow test before implementation:

  ```bash
  node --import tsx --test --test-name-pattern='historical prerequisite cold recovery' tests/internal-production/baseline-post-handoff-receipt-v1.test.ts
  ```

  Expected initial failure: foreign/unexpected historical shard, not a harness
  setup or Git error. Capture the failure in the local progress ledger.
- [ ] Read only the two spec-authorized exact historical locators. Authenticate
  using existing canonical/schema/Git/migration parsers and strict stable
  content-path reads. Keep current descriptor count exactly two. Merge only the
  validated physical inventory for topology checks; never merge selection.
- [ ] Bind positive historical records and parent/file identities in a separate
  hashed inventory in strict V2 disposition. Keep V1 zero-history resolver
  behavior. Direct-pin that inventory on cold replay and include it in every
  held-admission/publication stability fence.
- [ ] Refuse public prerequisite publication into the unrecovered known-poison
  store before any prerequisite directory/file creation. Private no-write
  builders and selected successor publishers remain available.
- [ ] Add genuine behavior negatives: valid but unallowlisted history, changed
  bytes/hash, missing file, file/parent replacement, symlink/hardlink/mode/device
  violation, crossed current/history equality and response-loss replay.
- [ ] Run the focused history, existing overlay and committed replay groups;
  report exact command/results. Run `npx tsc --noEmit` and `git diff --check`.
- [ ] Root reviews the two-file diff and obtains independent scoped review before
  treating this slice as complete. Do not claim live recovery from this slice.

## Task 1B: Repair bootstrap authority prerequisites

**Causal relation:** Cold recovery cannot acquire its lease without epoch one,
the deployed linked-worktree producers/readers disagree on storage roots, and
the immutable published legacy finding set prevents the required zero-owner
observation. These are demonstrated blockers of the same Task 6A, not new
product features. Execute after Task 1, before transport integration.

**Files:** Existing receipt, retirement, startup admission, restart helper,
spawner and sequence modules and their owning tests; finding publication
repository, `src/db-pg.ts` and their owning tests; guarded migration-32
evidence only as required to bind the private inventory. Any extracted pure
locator/publication module must enter the owning literal File Maps and source
  projections before the combined gate.

- [x] Reproduce different authority locations with an executing linked-worktree
  fixture. Converge producers/readers/helper FD validation and private-directory
  anchors on a single fixed-workspace locator; retain the separate executing
  source identity. Refuse symlinks/foreign roots; no store migration or fallback.
- [x] Reproduce absent epoch head with the real lease acquisition path. Add a
  distinct genesis-specific acquisition of the existing physical lock, not an
  ENOENT-to-epoch-one fallback. Under that lock require exact incident/source,
  three-service/global-spawner absence, complete zero, 31 and no 32/33/A or
  conflicting restart history. Publish immutable genesis then no-replace bound
  head, fsync/reopen, then ordinary admission. Test response loss, competing
  genesis, epoch two, source drift and every partial publication prefix.
- [x] Reproduce terminal published findings incorrectly counted as owners with
  real immutable parent/child rows in the disposable PG harness. Extract shared
  pure canonical publication validation; preserve the terminal closure's same
  rules. Reject orphan/malformed/partial sets and active associated ownership.
- [x] Bind exact settled pre-32 membership and terminal relations in hashed
  versioned private evidence, replayed through guarded migration-32 authority.
  Post-32 accept a missing reservation only for that exact authenticated legacy
  membership. Test modern missing-sidecar refusal, crossed/missing members,
  pending/bound ownership and proper closed modern publication. Do not use
  timestamps or modify/backfill live finding/reservation rows.
- [ ] Obtain scoped review of each stable slice; capture focused RED/GREEN
  evidence and type checks before combined transport integration.

### Task 1B implementation map

Storage convergence creates
`src/internal-production/baseline-workspace-authority-path-v1.ts`, a pure
code-owned account-workspace locator. Keep repository derivation for source,
Git, build and executable checks. Converge these existing runtime families:

| Consumer | Runtime root / physical guard responsibilities |
| --- | --- |
| `baseline-spawner-startup-admission-v1.ts` | `root`, private directory creation |
| `baseline-restart-authority-retirement-v1.ts` | transition/epoch/journal root, read/create/release anchors, pre-schema/sequence/consumed-guard readers |
| `baseline-service-restart-helper-v1.ts` | descriptor lock/journal/settlement paths, restart-authority reader, all private-directory anchors |
| `baseline-service-restart-sequence-v1.ts` | sequence/bootstrap roots and guards; leave source/Git reads repository-bound |
| `src/spawner.ts` | startup/bootstrap roots and guards, pre-schema ready writer currently based on cwd |
| `src/execution/runtime-completion.ts` | completion-owner bootstrap root and guards |
| `baseline-post-handoff-receipt-v1.ts` | existing workspace helper plus remaining repository-local pre-schema readers |

The first six internal-production basenames above live under
`src/internal-production/` unless an explicit `src/` path is shown. Update
their owning tests. Move the existing exact P3 account-workspace substitution
in `scripts/run-isolated-postgres-tests.ts` to the shared locator, and update
copied-fixture substitutions together. Unprojected tests must never write the
actual account workspace. Include the new module in the literal Task 0/P3
source lists, `tests/internal-production/task-0-source-manifest.test.ts`, main
baseline plan and closure design.

For finding provenance, use the existing legacy-zero `observationRef/hash`.
First extract `src/findings/finding-publication-v1.ts` from the recovery
repository's exact parent/child checks. Its only dependencies are the finding
schema and canonical JSON. Reuse it in the existing finding terminal resolver
without changing its terminal hash; add focused behavior coverage to the
already-owned owner-admission test. Add the source to the literal manifests
and runner scope before the next checkpoint. Terminal-run eligibility belongs
only to the legacy inventory classifier, not ordinary publication validation.
Emit strict V2 bodies with `legacyFindingPublicationInventory` from both
quarantine and ordinary pre-32 observations. Compare fresh/post-termination
inventories before migration authorization. The migration-32 application in
`owner-admission-head-v1.ts` already binds authorization and consumption, which
bind those observations; retain its SQL/evidence schema and the 33-pair graph.
Post-32 SELECT-only census must validate head ancestry, reconstruct the exact
historical authorization/consumption evidence hash, then validate recorded
legacy membership and modern closed reservations. V1 observations remain
resolvable but grant no nonempty sidecar-free membership. Never call a
lock-taking terminal resolver from the read-only census.

## Task 2: Implement one-shot authenticated detached transport

**Consumes:** Spec's cold-absence versus real-predecessor discriminants, existing
physical transition lease, strict private record patterns, and current source
integrity authority.
**Produces:** A truthful versioned transport chain shared by cold bootstrap and
pre-schema rebind, with no caller-controlled PID/executable/argv.

- [ ] In a disposable real-child fixture reproduce that a watcher restart leaves
  the detached predecessor alive. Assert a replacement requires the old identity
  to be terminal and the new identity to be different; the old helper must fail
  this behavior test.
- [ ] Define strict cold/rebind intent, termination-dispatch, spawn-dispatch,
  child-claim and settlement records with separate hash domains. Each record
  binds the same source, host, lease and exact prior pair. Keep historical V1
  launchctl authority read-only; it cannot authorize direct effects.
- [ ] Implement the fixed helper's direct spawn and one-shot inherited descriptor
  handshake. Preserve runtime integrity independently of the ordinary CLI.
  Derive rebind target from authenticated stored process identity, never caller
  scalars. No SIGKILL fallback; nontermination prevents launch.
- [ ] Test wrong branch/fields, descriptor swaps, reused identities, source drift,
  duplicate intent/claim, process appearance, ignoring termination, and every
  pre/post-effect response-loss boundary. Lost spawn acknowledgement adopts only
  a real matching claim, otherwise retains a blocked fence without redispatch.
- [ ] Extend physical-lease release/dead-owner reclamation to the separate cold
  journal. Prove incomplete dispatch cannot become an unfenced zero-owner state.
- [ ] Independently review the kernel before integrating live authority producers.

## Task 3: Integrate real cold spawner and controlled rebind

**Consumes:** Tasks 1–2 and unchanged ordinary current-entry operation/status.
**Produces:** A zero-input recovery path from absent spawner to authenticated
sealed cold process, followed by genuine ordinary operation-bound rebind.

- [ ] Add a fixture with no spawner and prove old preparation fails at the
  four-service census. Keep the public four-service observer unchanged.
- [ ] Add private three-service absence/physical/phase/read-only DB observation,
  including all-root daemon-family and launcher/singleton checks. Repeat
  decisive observations under the shared physical lease before dispatch.
- [ ] Handle inherited cold capability after singleton acquisition but before
  any ordinary admission/poison lookup. Register stop handlers before claiming
  readiness. Prove no migration, initialization, listener, reconciliation or
  producer runs in that branch.
- [ ] Publish controller-observed cold settlement only after a real process
  claim and independent identity observation. Phase-zero must count incomplete
  cold work and authenticate settled work as the actual persistent spawner.
- [ ] Integrate cold recovery before ordinary prepare; use the new truthful
  detached rebind transport for the genuine prepared predecessor. A cold token
  cannot authorize ordinary replacement or a second process.
- [ ] Update Task 6A order to prepare/recover before public current-prerequisite
  publication. Update owning File Maps and all impacted source projections.
- [ ] Run complete disposable cold → history recovery → prepared → sealed
  rebind tests and fault injections. Keep final 33-pair verifier graph exact and
  recursively bind new authority through its existing roots.

## Task 4: Verify, review, deliver, then resume A–E

- [ ] Root checkpoints scoped changes on the feature branch for clean-worktree
  projection/build verification. Run focused tests, type checks, contracts,
  clean build and then full exact P3 once the combined slices are stable.
- [ ] Obtain independent whole-branch review, fix material findings, push scoped
  branch, deliver reviewed PR and synchronize clean main under standing owner
  authorization. No source delta bypasses the review/gate.
- [ ] Perform code-owned live recovery only after fresh source, zero-owner,
  service and retention preconditions. Do not use ordinary spawner restart.
- [ ] Prove Task 6A ready, guarded 32 and ordinary 33 current, A activation and
  canary; execute Task 7 full rebind and Task 8 backup/acceptance.
- [ ] Continue B harness, C matrix, D recovery/MC reconciliation and E fleet
  using their owning plans. No total percentage inferred from P3 test counts.

## Preflight decisions

Task 1 and Task 3 share receipt source/tests: serialize their edits. Task 2 and
Task 3 share transport interfaces: finish/review the transport contract before
integration. Each test exercises behavior, not source-text presence alone.

Ruling: admit the two independently authenticated incident records, not arbitrary
history scans; prevent future legacy publication instead of growing a general
history exception. This preserves the narrow contamination boundary. If another
unrecognized record exists, it remains a visible refusal requiring investigation.

Ruling: keep ordinary four-service schemas and create a real sealed predecessor;
an absent-spawner union would spread through the entire authority graph. If the
cold process cannot satisfy real identity and zero-owner proofs, do not substitute
a placeholder or relax the ordinary census.

Ruling: fix watcher-only rebind in this branch because cold recovery otherwise
leads directly into a second nonterminating transition. The extra transport work
is causally required, not an unrelated CLI improvement.

Ruling: bootstrap prerequisites belong in this branch because live observations
proved all three prevent the chosen cold path. Preserve provenance and data;
do not convert absence into authority or immutable issue status into active
ownership. The added private evidence must remain transitively authenticated.

## Progress ledger — 2026-09-12

### Cold intent publication and retained controller lifetime

Next connected helper refresh/configuration slice (existing retirement, receipt,
runtime-config, launch-environment leaf and owning tests; no new File Map member):
the operator/helper entry remains zero-argument. Retirement will authenticate
FD3/4/5 once and retain one explicit WeakMap-backed context through full refresh
and eventual exclusive dispatch. The receipt's helper-only internal port accepts
only that opaque object, not caller source/PID/root/flags/evidence; private cold
bracket and phase functions thread it explicitly. No ambient census switch.
Only a distinct branded own-intent phase reader may recognize the exact prefix;
public census/ordinary phase/release/dead-reclaim remain strict. Retirement marks
the context ready only after its own call to the full receipt observer returns
and is checked against retained intent. Failure/closing immediately revoke use
while preserving unfinished cleanup ownership. Snapshot state is configuration
authority only, never an alternative to the explicit phase context.

Dependency evidence: the cold prerequisite audit dynamically imports db-pg before
the phase reader, and db-pg statically imports runtime-config. Therefore installing
plain environment keys is insufficient: ordinary dotenv reads can introduce new
unbound keys, and repeated loads reread files. A synchronous zero-argument
retirement resolver may expose only already-authenticated runtime snapshot state
to runtime-config; it must never reauthenticate/import receipt or accept a setter.
AST inspection found no static cycle: retirement's graph is only its workspace
locator, legacy finding validator and canonical JSON helper. Runtime-config will
skip dotenv for recognized authenticated helper configuration, reject missing or
changed state, and preserve ordinary loading behavior. Keep raw profile/snapshot
unchanged, extract the existing PATH normalization into one pure shared function,
then derive and enforce the deterministic effective map on first/repeated loads.
No secret snapshot/nonce travels in process launch argv/environment or journals.
A code-owned non-secret mode marker may select mandatory validation, never grant
configuration, phase or launch authority by itself.

Connected context/configuration evidence: the private issuer now retains one
FD-authenticated context, invokes the full cold observer, rechecks the launch
profile after the bracket, and transitions to ready only on exact retained
equality. Its separate own-intent phase observation reports one owned intent;
public zero census and ordinary release/reclaim remain unchanged. Runtime-config
uses the authenticated snapshot without dotenv reads, shares the ordinary PATH
normalizer, rejects repeated environment drift, and refuses even a selector-less
fixed helper that reaches configuration before authentication. That last case
first failed by reaching the fixture's forbidden dotenv existence read, then
passed after the fixed-entry guard and generic configuration refusal were added.

The compiled real-FD helper fixture now executes the actual phase-zero function
and its filesystem readers/absence guards with actual runtime-config. Only the
clean Git-source and full DB/service observation ports are controlled in this
composition; this is not a live cold-bootstrap acceptance claim. It covers ready,
cloned, public, revoked and interrupted contexts, bracket/post-profile refusal,
present/dangling future authority roots, missing/invalid selectors, unchanged
borrowed lock/intent descriptors, and unchanged authority bytes/inodes. The full
receipt bracket test separately proves the same explicit object reaches both
phase passes and the public helper port rejects forged contexts before any
observation port. Verification: retirement 43/43 (40.123s), receipt phase/bracket
3/3 (4.209s), receipt inert/export 1/1 (1.592s), environment/core-focused 4/4
(2.295s), exact manifest 17/17 (6.175s), and TypeScript no-emit passed. Both live
HTTP surfaces remained 200; no live DB/schema/service mutation occurred.

Next dispatch seam: keep the issuer private and spawning disabled while adding
an exclusive dispatch record plus child capability verification. Publishing a
dispatch necessarily changes the intent-only directory: preserve original
lock/intent/history pins and introduce an explicit one-way ready-to-dispatch
transition with exact new-prefix evidence, never a global predicate relaxation.
Only the invocation that newly publishes may later spawn; existing bytes or a
lost publication acknowledgement can never authorize redispatch. The child must
authenticate synchronously before spawner's static runtime-config consumption;
the helper's in-process WeakMap cannot authorize a different process.

Dispatch publication refinement: use one bounded 0600 O_EXCL final-file writer,
retaining its original descriptor through file/parent fsync and same-inode reopen.
Unlike recoverable evidence publishers, a dispatch must never repair a partial
write or adopt an EEXIST collision as permission. Mark publication uncertain
before opening; any failure preserves all journal evidence and revokes helper
authority while closing only owned descriptors/guards. No deletion, ordinary
lease release, retry, child spawn or public admission is introduced in this slice.
The new runtime path remains private; existing File Map members suffice.

Dispatch-only verification: the missing one-shot publisher first failed the new
test; the implemented publisher now preserves the original authority pins across
its explicit ready/publication/owned states and rejects a second call or a fresh
helper seeing the record. Actual APFS execution showed that creating a file also
changes the directory link count; the immutable root tuple remains fixed while
only the original or original-plus-one count is allowed during this publication,
with exact two-member inventory and full post-publication metadata required.
Nine real filesystem faults cover collision, partial write, file/parent sync,
extra member, same-byte dispatch replacement, root replacement and transient or
persistent writer-close failure. Persistent cleanup first left one completed
callback retained (RED); the self-removing cleanup closure fixes that without
restoring eligibility. Focused 2/2 (6.961s), full retirement 45/45 (51.329s),
TypeScript no-emit and diff whitespace checks passed. Independent review found
no material issue in this publication-only scope. Child spawn/claim/settlement
remain unimplemented and no live cold-journal record was published.

Next connected child-capability slice (same retirement/environment/runtime-config
and owning test files): share strict intent/dispatch/history parsing; issue a
distinct child-domain private unlinked FD3 and inherited lock FD4/dispatch FD5.
Create/unlink the empty child frame within the still-uncertain publication
transaction, before freezing the final dispatch-root metadata. Never refresh an
already-owned root merely to allow a later scratch write. The child synchronously
authenticates those fixed descriptors, original intent/history, exact live
helper/controller identities, actual host/Node/argv/cwd, environment commitment
and every compiled output dependency before runtime-config may consume it.
Configuration evidence cannot grant claim or another dispatch; retain a private
child context for the later singleton-protected claim. Use real compiled child
fixtures and preserve ordinary startup. No live helper/spawner execution until
the separate claim/sealed/settlement chain is complete and reviewed.

Selection review: at the exact compiled spawner entry, a regular FD3 selects
mandatory child authentication even if malformed; absent/nonregular FD3 alone
does not change ordinary configuration. Runtime-config requires the distinct
non-secret child selector together with an authenticated snapshot and rejects
both selectors. Missing both remains ordinary configuration, not cold authority.
The later startup integration must explicitly census the cold journal after
singleton acquisition but before ordinary startup-admission resolution: the
current code can reach admission claims/recovery before its later poison lookup.
Test that missing-both transport with an incomplete journal cannot claim or run
DB/provider/producer work; do not add a blanket ordinary pre-dotenv FS dependency.

Child refusal coverage exposed a causally shared reader cleanup defect: an
injected pre-close error in `readColdGenesisCandidateV1` lost its temporary FD,
just as the newly added Node reader did (both real-child probes reported one
open descriptor). Keep Node descriptors in the child cleanup owner and make the
shared bounded reader retain/retry its exact failed close without admitting the
failed read. This is an in-goal root fix in the existing retirement File Map,
not a relaxation of descriptor-count tests. Repeated child integrity refusal
also revokes cached authentication permanently; restored dependency bytes must
not revive it. Revalidate the retained output commitments at each later use.

Additional actual-child pre-close probes found the same lost-handle class in
the cold journal directory reader and the launch-output leaf's file/directory
readers (each reported one retained handle before its fix). Their idempotent
close callbacks now retain unfinished ownership, retry only that close and
still reject the original observation. This extends the same causal File Map
fix to the existing launch-environment leaf, with no new export or authority.
The compiled-child matrix now covers 24 transport/configuration/integrity and
cleanup cases; helper frame replacement immediately before unlink is checked
against the exact original empty inode, preserving a foreign replacement.

The full retirement run captured an unrelated intermittent all-process FD
count failure with actual `lsof` evidence: the added writable descriptor was
the installed tsx 4.22.4 cache's unawaited `FileCache.set()` write, not an owned
retirement handle. The abandoned-acquisition scenario now runs the same real
five-module compiled source in a plain Node child, without inherited loaders.
It retains the exact all-descriptor count and adds full identity equality; no
descriptor filtering, sleeps, retries or disabled cache. A second execution
withholds an actual owned-lock close and must fail that same census assertion.
Both isolation and leak-detection variants passed together (1.563s).
The cold-journal absence scenario exposed the same loader-sensitive measurement
boundary on the next full run (600 versus 599); it now uses the same plain-child
compiler and retains the exact count and all filesystem/inode/absence checks.
No identity attribution is claimed for that second uncaptured descriptor.

Grouped final review found three remaining newly reachable unreturned-cleanup
owners: parent-directory fsync, failed private-chain construction and failed
workspace-anchor construction. Real injected pre-close probes reproduced one,
ten and one leaked descriptors respectively. The existing retirement and
workspace-locator File Map members now retain and retry those exact cleanup
closures while propagating the original refusal. The focused acquisition,
existing interrupted-close and eleven dispatch-fault tests passed 3/3 (9.361s),
with TypeScript no-emit and whitespace checks clean. No live acceptance follows
from these fixture results; the claim/sealed/settlement chain is still pending.

Child-capability slice final verification: retirement 47/47 (73.500s), including
24 actual compiled-child cases and eleven dispatch publication faults;
ordinary environment/output/import-inert plus real sealed spawner main 7/7
(8.913s); exact source manifest 17/17 (6.168s); receipt cold/history/workspace
and import-inert boundaries 6/6 (8.595s); TypeScript no-emit and diff checks
passed. Independent review re-probed persistent cleanup failures and found no
remaining material issue in this slice. Mission Control and dashboard returned
HTTP 200. No live bootstrap, database change, guarded build, full P3 receipt,
or Task 6A acceptance is claimed. Next: actual singleton/PID ownership, cold
claim and sealed stop lifecycle, then helper/controller settlement integration.

### Connected startup-file ownership and ordinary cold fence

**Files:** `src/spawner.ts`, `tests/internal-production/owner-admission-v1.test.ts`,
`tests/spawner-gateway-recovery.test.ts`, this plan. All are existing File Map
members. Root remains the only writer; read-only review runs in parallel.

**Causal need:** the current singleton release may remove another dead PID's
lock, PID publication overwrites an existing file, and sealed/error cleanup
unconditionally unlinks PID paths. A cold claim cannot safely own those effects.
Separate creation/stale-reclamation authority from exact-own cleanup before
connecting the cold claim. Retain the existing byte formats: lock `pid + "\n"`,
PID `String(pid)`, and the real fixed `.openclaw/setfarm` paths.

- [ ] Add a real copied-main failure test with an incomplete cold journal and
  forbidden ordinary-admission/provider/DB sentinels. Assert no journal or
  foreign startup-file change. Add exact-owned cleanup tests with same-byte
  replacement inodes, symlinks, foreign dead PIDs, partial writes and repeated
  cleanup. The real created descriptor count must return to zero.
- [ ] Introduce a private `OwnedSpawnerStartupFileV1` carrying the created FD,
  fixed path, original inode/owner/mode and exact bytes, plus unlink/close phase.
  `createOwnedSpawnerStartupFileV1` uses exclusive no-follow creation and retains
  the FD immediately. `closeOwnedSpawnerStartupFileV1` may unlink only the exact
  owned inode/bytes, records unlink before close, and retains failed closes.
  Foreign replacements are preserved; cleanup never invokes stale reclamation.
- [ ] Ordinary acquisition may reclaim only a bounded no-follow regular
  single-link owner file containing a canonical nonself PID, with fresh explicit
  `ESRCH` and original inode/bytes rechecked immediately before unlink. `EPERM`,
  ambiguous liveness, malformed bytes and replaced paths refuse. Cold lock
  acquisition will never reclaim a predecessor lock.
- [ ] Route sealed, normal, error and fatal cleanup through exact-own state.
  Perform the mandatory strict cold-journal census after actual singleton/PID
  publication and before `resolveActiveInternalProductionBaselineSpawnerStartupAdmissionV1`.
  A refusal-only preflight before ordinary file mutation must also preserve an
  already known unsettled journal's startup evidence; it grants no admission and
  cannot replace the post-protection census. The later authenticated cold branch
  is separate and cannot be selected by an environment marker alone.
- [ ] Run the actual-main and ownership negatives, gateway recovery tests,
  TypeScript no-emit, exact source inventory and whitespace checks; obtain
  independent review before committing. No live launch follows from this slice.

Compatibility to preserve in the subsequent cold claim: the authenticated cold
absence observation permits one exact stale-dead PID residue, unlike the lock,
which must be absent. Consume only that bound residue after fresh identity/bytes
and `ESRCH` checks; unconditional PID absence must not silently replace this
approved contract. Controller/helper/child claim and settlement remain separate
connected work after startup ownership is verified.

Startup ownership implementation evidence: the real main first returned a
successful duplicate exit for an existing cold journal, then left its PID on
late-journal refusal. Refusal-only preflight and the mandatory post-PID census
now fence ordinary admission. Created lock/PID FDs are registered immediately,
validated against their original path/bytes and retained through exact-own
cleanup. Same-byte foreign replacements remain untouched; partial/unverified
publication files stay fenced while their FDs close. Ordinary stale PID restart
first failed with EEXIST, then passed the bounded definite-death reclamation.
The twelve-case real-FS matrix covers non-ASCII/double-newline PID bytes, EPERM,
PID reappearance, file replacement, symlinks/hardlinks, unsafe mode, live owner,
interrupted close and a cold journal appearing immediately before deletion.
Non-ASCII bytes first incorrectly granted deletion because ASCII decoding masks
high bits; UTF-8 decoding plus the exact decimal grammar fixed that RED.

Independent review reproduced a fatal cleanup interruption exiting zero. The
fatal callback now establishes exit one before retrying/containing cleanup;
real-FD callback tests confirm unsuccessful termination and completed transient
cleanup. A final real-main parent rename/symlink regression also failed: leaf
inode equality alone followed changed ancestry. Capture and recheck each direct
ancestor's immutable identity around open/publication and before unlink, with
only the existing fixed Darwin /var alias. Directory timestamps/link counts are
not authority because legitimate file publication changes them. These checks
are observation fences, not atomic exclusion of a malicious privileged racer.

Startup slice final gates: seven real-main modes plus actual stale-reclamation,
publication and fatal-cleanup probes passed 4/4 (34.002s); the added ordinary
admission sentinel confirms both cold refusals precede that boundary. Gateway
recovery 109/109 (2.395s), exact File Map 17/17 (5.839s), TypeScript no-emit and
diff checks passed. Independent review accepted the final ancestor checks and
cleanup ownership. The ordinary startup compatibility fix does not yet grant
genuine cold-child startup, publish a claim, or enable helper/controller settling.

### Connected cold child claim and sealed main

**Files:** existing retirement, spawner, their owning internal-production tests
and this plan. The helper main/controller settlement remain separately connected
work; no new File Map member or ordinary final-verifier pair is introduced.

**Interfaces:** a zero-argument spawner ownership observer reads only private
main lifecycle state and the two retained created-file objects. It grants no
authority from PID text alone, caller arguments or an environment marker.
The zero-argument retirement claim entry uses its already-authenticated child
context and dynamically imports that observer only after runtime configuration.
Spawner invokes async main without a top-level await, so this deferred query
does not create an ESM initialization deadlock.

- [x] Compile the actual main/startup ownership functions into the existing real
  FD child fixture. Ordinary admission/provider/DB ports must throw if reached.
  Require a durable claim while both actual startup files remain owned, a live
  sealed child after its helper exits, and exact-own cleanup on SIGTERM.
- [x] Select cold startup solely from authenticated child state before the
  ordinary refusal-only preflight. Acquire the actual singleton/PID exclusively;
  install named SIGTERM/SIGINT handlers before entering claim publication. A
  private main state makes the ownership observer refuse before handlers, after
  stop begins, after replacement of either file, and after cleanup.
- [x] Add private child phases `authenticated -> claiming -> claimed`; enter
  claiming synchronously before the first await. Repeated/concurrent calls and
  every uncertain publication revoke eligibility permanently. Split original
  immutable pins from explicit phase-specific journal-root/membership checks.
  Never refresh the original intent/dispatch/history/frame/host commitments.
- [x] Publish one bounded exclusive `claim.json` binding intent/dispatch/epoch/
  genesis/source/profile/controller-lock identities, actual child process and
  both held startup files. Retain the created FD, fsync file/parent, reopen the
  exact inode and bytes; retain only the exact owned third journal member and
  its post-publication root metadata. Partial/existing/foreign records remain
  fenced; no adoption can authorize another spawn.
- [x] After claim, allow only the original live helper parent or authenticated
  helper departure with actual ppid one/pgid pid; pre-claim still requires the
  live original helper/controller. Keep the child sealed and stoppable without
  depending on incidental imported-module event-loop handles. Test signal
  during the awaited observer import, replay, crossed startup-file ownership,
  publication faults and real detached lifetime.
- [ ] Preserve the admitted stale-dead-PID compatibility case: its eventual
  consumption must bind the exact retained cold absence evidence under the
  actual singleton. An absent-only first connected fixture is not full cold
  case coverage and cannot remove that remaining requirement from acceptance.
- [x] Run focused real child/main/retirement gates, exact manifests, TypeScript
  and independent review before this slice is committed. No helper-main launch,
  controller settlement, ordinary census exemption or live acceptance is implied.

**Connected-slice causal corrections and evidence:** the first real main test
refused with `COLD_BOOTSTRAP_UNSETTLED`, proving the missing cold branch. Its
initial claim then serialized `source: undefined`; the strict producer/parser
now binds the authenticated launch-profile source. An actual renamed/replaced
runtime directory was accepted before the original absence-ancestor FD pins
were connected; it now refuses, retaining the original identity rather than
rebaselining the new directory. A helper exiting at the durable claim boundary
exposed both the pre-owned-claim parent check and a death between two `ps`
probes. Departure is now eligible only after exact owned bytes/fsync/reopen/
writer-close; a crossed probe can select only fresh exact helper absence plus
the genuine child's ppid-one/pgid-pid transition. No generic process retry or
claimStarted-only departure grant is added.

Post-claim same-byte PID/lock replacement originally escaped repeated runtime
configuration validation. The cached claim now retains and invokes the real
main ownership observer. A separate demonstrated false refusal came from
unrelated entries changing in the shared OS temporary ancestor: the launch
profile commits physical directory identities, not lifetime ownership of every
sibling entry. Independent review confirmed the minimal correction: retain
direct-directory/no-symlink and dev/ino/UID/GID/mode/birthtime checks for host
ancestors. Keep the issuer's bounded full-metadata observation bracket, exact
journal-root metadata/membership, all regular-file pins and hashes, Node
identity, and full output-tree verification unchanged. A deterministic
unrelated sibling write reproduces the old refusal; replacement inode,
symlink and mode changes must still refuse. No File Map or final pair-graph
expansion is needed: these are lifetime fixes in the same mapped claim owners.

Focused connected gate: 4/4 (30.964s), including eight real main lifecycle/
identity modes, 43 self-hashed crossed claim bodies, original runtime-parent
replacement, and eleven publication/lifecycle faults. Existing ordinary/stale/
fatal/real sealed-main gate: 4/4 (34.943s); exact source inventory 17/17 (5.771s);
TypeScript no-emit passed. Final review found no remaining must-fix issue in
this absent-file slice. Full retirement passed 51/51 (100.425s), including the
strengthened actual-SIGTERM-at-await, malformed-frame and fresh-helper retry
checks. No failures were hidden or stopped early. This is not live acceptance.
Final gateway regression also passed 109/109 (3.247s), followed by a fresh
TypeScript no-emit and clean diff check. Guarded clean-main build remains part
of the reviewed combined rollout, never bypassed on this feature branch.

### Fixed cold helper entry and actual one-shot transport

**Files:** existing retirement/helper sources, retirement/helper tests and this
plan; all are already File Map members. Continue after `0c9b8f71`. Root is the
only writer; helper integration review/inventory stays read-only in parallel.

- [x] Replace the synthetic helper program in the real FD/main fixture with
  the actual compiled fixed helper entry. It must launch once, authenticate a
  genuine child's claim, close owned descriptors and exit while that exact
  detached sealed child survives. Preserve both legacy helper routes.
- [x] The helper's nonsecret selector chooses mandatory cold authentication,
  never grants authority. Invalid selector or capability cannot fall through
  to launchctl. Retirement exposes one zero-argument runner; all context,
  descriptor, executable, argv, cwd, environment and child-process handles are
  private and derived from retained authenticated evidence.
- [x] Enter `child-launch-handed-off` before the sole asynchronous spawn. Retain
  the actual returned ChildProcess/PID; never adopt arbitrary PID text as spawn
  evidence. No retry, broad signal, borrowed-FD close or transition-lease release.
- [x] Use fixed inherited socket/FIFO FD6 for a canonical readiness envelope
  capped at 4096 bytes plus EOF, emitted only
  after the child finishes publication, enters sealed state and rechecks its
  actual handlers/files. Independently reviewed necessity: readable claim bytes
  alone precede the final publication checks. The initially proposed single
  byte proved insufficient: a same-byte claim replacement before the helper's
  first read was accepted in a real test. Bind the envelope to the child's
  **original retained** claimRef/hash and ten-field physical metadata tuples
  for both the claim and its private journal root,
  never a fresh path observation. FD6 selects no path and grants no authority
  outside the independently authenticated context/process/files. Pin its
  endpoint identity, refuse regular-file/reused endpoints, and
  retain interrupted close ownership. Bound helper wait by error/exit/timeout;
  always authenticate the claim/process/files after the hint. The child runtime
  snapshot carries a non-enumerable revoke-only close so pre-claim failures also
  release its owned descriptors without granting another authentication.
- [x] Add a private phase-checked claim observation that does not first require
  the obsolete two-member prefix. Recheck every original pin and admit only the
  exact third bounded/canonical claim with its actual spawned child UID/start/
  command/parent/group and both startup-file identities/bytes. Retain its exact
  inode and bytes; do not refresh earlier authority. File existence alone is
  not acceptance; partial/publication-in-flight bytes remain unaccepted.
- [x] Refuse spawn/error/early-exit/timeout/foreign-claim or root/file replacement
  without dispatching again. Track timers, subprocess handles and resumable
  descriptor cleanup. A successful helper closes its own handles and unrefs the
  genuine child; response loss remains a controller observation/adoption case.
- [x] Verify real helper positive/negative cases, historical helper regression,
  retirement regression, exact manifests, TypeScript and independent review.
  Controller settlement, stale-dead-PID consumption and rebind remain next work;
  no ordinary cold census exception or live acceptance is introduced here.

**Actual transport causal corrections:** three post-ready changes were accepted
before the receiver used child-origin identities: same-byte claim replacement,
and same-inode PID/lock writes followed by restoration of the original bytes.
The real helper now binds the original claim tuple and each startup file's
full-metadata identity hash. Two further real RED cases demonstrated private
journal add/remove ABA and changed manifest-listed dependency bytes after the
child's final validation. The readiness envelope carries the child's retained
post-claim journal tuple; the helper compares the fixed root around reads and
retains only matching metadata. The existing full output verifier runs around
claim observation against the original authenticated profile, with its exact
three-field root-identity projection. No fresh profile or shared-host metadata
baseline is introduced.

A real helper exit between the child's own process-row read and its parent
check produced a false refusal. Only an already claimed original-helper to
actual PID-one transition gets one fresh own-row observation; all original
controller, helper-absence, UID and process-group checks remain mandatory.
No generic retry or new-owner adoption is added. The regular-file FD6 case
also proves pre-claim authentication cleanup without touching that file.

The unchanged historical helper route initially failed one regression because
its test created authority parents with default 0755 permissions. That single
fixture now explicitly creates 0700 parents, as the existing guard requires;
production permission checks are unchanged. Its focused case passed, followed
by the full historical helper suite, 19/19 (28.726s). File Map counts remain
145/64 and the final ordinary verifier remains exactly 33 pairs. This slice is
local compiled-fixture evidence, not Task 6A or live production acceptance.

Fresh combined verification: retirement 52/52 (143.678s), including all twenty
actual-helper transport modes (29.431s), 45 self-hashed claim mutants and twelve
claim/publication fault modes; historical helper 19/19 (28.726s); ordinary
configuration/stale-PID/fatal/sealed-main 4/4 (39.449s); exact File Maps 17/17
(6.239s); gateway 109/109 (2.486s). TypeScript no-emit and `git diff --check`
passed. The full retirement run completed without early failure termination.
Guarded build/full P3/live closure still wait for the connected controller and
rebind work and reviewed clean main; no guard override is used.
Independent final review found no remaining must-fix issue in this six-file
absent-file transport slice and confirmed it is ready for a scoped commit.

### Exact cold PID-residue consumption

**Files:** `src/spawner.ts` owns the singleton phase and startup-file observer;
`src/internal-production/baseline-restart-authority-retirement-v1.ts` owns the
authenticated residue consumer; its existing test owns the real helper/main
fixtures. Update this plan and the existing exact export assertion, without a
new File Map member. This implements the already approved stale-dead-PID union,
not generic dead-file reclamation or a new launch/retry authority.

**Interfaces:** the zero-argument
`consumeInternalProductionColdSpawnerPidResidueV1(): Promise<void>` consumes
only the cached child capability's original absence record. It calls the
zero-argument main-owned
`observeInternalProductionColdSpawnerSingletonOwnershipV1()` while phase is
`singleton-held`; the existing two-file claim observer stays strict.

- [x] Seed a real exited fixture predecessor and a canonical 0644 PID file
  before the cold observation is hashed. Exercise the actual fixed helper and
  real sealed main, expecting one dispatch, new owned PID/lock, readiness and
  survival after helper exit. Verify RED from the current exclusive PID create.
- [x] Extract the existing per-file retained ownership check; retain the
  two-file observer's phase/cardinality checks. Create the actual singleton,
  register both stop handlers and enter `singleton-held` before awaiting the
  one-shot residue consumer. Only after consumption create the new PID:

  ```ts
  spawnerColdStartupPhaseV1 = "singleton-held";
  await consumeInternalProductionColdSpawnerPidResidueV1();
  observeInternalProductionColdSpawnerSingletonOwnershipV1();
  createOwnedSpawnerStartupFileV1(PID_FILE, Buffer.from(String(process.pid)));
  spawnerColdStartupPhaseV1 = "claim-ready";
  ```

- [x] The consumer enters attempted synchronously, authenticates output and
  original ancestor pins across the main-module await, and rejects replay.
  For recorded absence require continuing ENOENT. For the recorded residue
  open only the fixed no-follow/nonblocking PID path, register the reader
  immediately, and compare all eight recorded metadata fields, full retained
  FD/path metadata, exact bounded decimal bytes/hash and fresh `ESRCH` twice.
  Recheck the actual held singleton immediately before unlink, fsync the
  parent, verify absence and close the reader. Any uncertainty permanently
  revokes child authority; a removed residue is never reconstructed.
- [x] Add real boundary negatives: foreign same-byte inode, same-inode
  write/restore, different dead PID, live/ambiguous PID, symlink/ancestor or
  singleton replacement, unexpected disappearance, unlink/fsync/close faults,
  concurrent/replayed consumption and signal during the awaited lookup.
  Foreign evidence survives; no uncertain claim/readiness or second dispatch.
- [x] Run the focused real residue group, full retirement, the four ordinary
  startup regressions, exact manifests, TypeScript and independent review.
  Commit only the verified slice. Controller settlement/rebind/live rollout
  remain subsequent required work.

Focused command:
```sh
env -u SETFARM_PG_URL -u SETFARM_TEST_PG_ADMIN_URL node --import tsx --test --test-name-pattern='actual fixed cold helper consumes only its authenticated PID residue' tests/internal-production/baseline-restart-authority-retirement-v1.test.ts
```

**Evidence:** the actual helper/child first refused with `EEXIST` on the exact
recorded 0644 PID residue. The connected consumer passed the positive case
(3.089s), then sixteen lifecycle/fault modes (22.685s). Four additional tests
mutate the PID/lock or report PID reuse only at the second liveness probe,
proving the final checks rather than merely initial parsing. All twenty passed
in the full run (28.933s); every refusal preserves unconsumed/foreign evidence,
publishes no claim/readiness, dispatches once and drains actual owned readers.
An already unlinked residue is not reconstructed after sync/close uncertainty.

Full retirement 53/53 (190.107s), actual helper transport twenty modes
(44.891s), historical helper 19/19 (33.288s), ordinary startup four tests
(39.875s), exact manifests 17/17 (6.614s), gateway 109/109 (3.786s), TypeScript
no-emit and diff whitespace checks passed. Independent production review found
no must-fix issue. This closes the local cold absent/stale-PID compatibility
slice, not controller settlement, rebind, Task 6A or live A–E acceptance.

### Retained controller-to-helper handoff

**Files:** existing retirement/helper sources and their existing tests, plus
this plan. No new File Map member or final verifier pair is introduced.
The private zero-argument `invokeColdSpawnerBootstrapHelperV1()` advances only
to `claim-observed`; durable settlement/release and public prepare/resume
integration remain separate required transitions.

- [x] Make the actual cold helper return a canonical, nonsecret completion
  envelope through its existing stdout pipe, capped at 4096 bytes. It contains
  exact intent/dispatch/claim pairs and the helper's original held physical
  tuples for those files and the final journal root. Copy the evidence before
  closing pins; emit only after successful owned cleanup. Await stdout write
  completion; legacy branches keep their existing stdout behavior. Exit zero
  alone is not completion authority.
- [x] Add a connected actual-controller fixture. Its first successful call
  must retain the real helper object, parsed completion and independently
  observed detached child; inject caller-response loss after retention, then
  retry and assert one helper/child invocation and the same original claim.
- [x] The retained intent owns helper invocation, bounded capture and cleanup.
  Before the sole spawn set `helper-may-have-run`. On every subsequent call
  observe only that retained invocation; never prepare another frame or spawn
  again. A fresh controller must inspect/refuse existing cold history before
  any absence/genesis path. No lease release on unsettled paths.
- [x] Require bounded canonical stdout plus EOF and the actual retained
  helper's exit zero/no signal. Independently recheck original lease/source,
  fixed journal membership/file tuples and claim relations, exact helper
  departure and child PID/UID/start/command with ppid one and pgid PID. Retain
  original evidence rather than refreshing post-await expectations.
- [x] Cover malformed/missing/truncated/duplicate/oversized completion, valid
  output followed by nonzero exit, actual spawn error, concurrent/repeated
  invocation, response loss, and post-completion journal/file/child drift.
  Failure keeps the physical fence and cannot redispatch.
- [x] Run focused connected gates, retirement/helper regressions, exact
  manifests, TypeScript and independent review before scoped delivery.

Core ordering:
```ts
state.phase = "helper-may-have-run";
state.helperInvocation = captureActualFixedHelper(state, handles);
const completion = await state.helperInvocation.completion;
const claim = independentlyObserveColdChild(state, completion);
state.phase = "claim-observed";
return claim;
```

The actual caller-response-loss fixture first failed with the missing private
controller entry; the connected implementation now retains one actual helper
and child across repeated calls. The controller fixture delegates only the
location-bound output-verifier port to the real compiled verifier: accepting a
tsx/source-root verifier would weaken the production build-root check.

Independent review exposed two causally necessary root fixes. Failed frame
acquisition plus an interrupted close lost an unreturned reader (real RED:
one owned descriptor instead of zero). Remaining exact cleanup is now retained,
retried once and fences further acquisition if still unfinished. Eight
reader/writer/intent/guard transient/persistent cases pass. Changed helper code
also initially executed before controller rejection; launch profile/output are
now checked before frame creation and at the final awaited observation. A late
same-byte intent write demonstrated that checking only output after that await
was insufficient (real RED: a child launched). Original authority FD/path
metadata, bytes, directory guards and lease are now bracketed immediately
before spawn and reused after completion. Six prelaunch drift modes pass.

The first complete retirement run finished 56/57, exposing a test transform
that matched both controller-to-helper and helper-to-child spawn. The actual
spawn-error negative now targets the complete child-entrypoint launch line
and asserts exactly one source match. The full twenty-mode real helper group
then passed (39.169s); the six prelaunch modes passed (3.562s). Sixteen outer
completion/observation fault modes also passed (28.733s). Independent final
review found no remaining must-fix in this scoped handoff. Final full owning
retirement passed 57/57 (221.464s), historical helper 19/19 (29.319s), exact
manifests 17/17 (7.051s), gateway 109/109 (2.965s), ordinary stale reclamation
1/1 (1.455s), and the remaining three actual startup/cleanup cases 3/3
(39.683s). TypeScript no-emit and diff whitespace checks passed. This proves
the retained local handoff, not durable settlement, release, rebind or live
Task 6A/A–E acceptance. Guarded clean-main build remains a delivery gate.

### Controller settlement and ordinary process bridge

**Files:** existing retirement source/test and receipt source/test, plus this
plan. Keep the fixed 145/64 File Maps and ordinary 33-pair final graph intact.
This is the next causal step: the genuine sealed child must become an
authenticated predecessor, without fabricating a four-service census member.

- [x] Extend the actual-controller fixture with the production detached
  spawner observer. Use actual global `ps`, executable `comm`, `lsof`, regular
  file readers and plist parsing; project only the disposable home/root,
  clean-source observation and launchctl job text. Create its launcher/plist
  before finalizing launch authority. The other three service ports remain
  isolated fixture observations, not claimed live evidence.
- [x] Introduce private zero-argument `settleColdSpawnerBootstrapV1()` from
  the retained invocation. Bracket two ordinary four-service observations with
  original claim/authority checks. Bind the spawner PID/start/command to the
  genuine child and keep the original remaining-three service projections.
  The ordinary process hash is `sha256(pid + "\n" + lstart + "\n")`, not the
  claim's transition-lock-domain hash; retain ordinary generation formulas.
- [x] Retain one expected terminal body before its first publication. Include
  original helper completion, original epoch-one bytes/identity and immutable
  genesis identity, plus the actually observed ordinary service census.
  Publish only the fixed sibling
  `cold-spawner-bootstrap-controller-settlement-v1.json` beside the three-file
  cold journal. Never mutate that journal or refresh its original full tuple.
  The fixed owned temporary is
  `.cold-spawner-bootstrap-controller-settlement-v1.json.pending` in the same
  parent. Strict no-replace publication fsyncs its complete body, links the
  final name, closes owned publication descriptors, fsyncs the final link,
  rechecks the exact claim/files, removes only that pending link, then fsyncs
  the parent again. Refuse temp-only and final-plus-temp states publicly.
  Adopt only the same retained expected inode/prefix after response loss;
  never dispatch a replacement or overwrite a foreign final. The mandatory
  final-link fsync also runs when interrupted-link recovery has no writer FD.
  Partial/throwing writes retain the pending file and lease, but close their
  nonresumable writer via retained retryable cleanup. Every live durability
  retry reobserves both ordinary service passes against the original record.
- [ ] Authenticate the immutable terminal chain in the public cold census.
  Both final paths absent is absence; an orphan terminal, reserved publication
  temporary or any incomplete/crossed chain remains unsettled. Historical
  validation reopens immutable intent/dispatch/claim/genesis and embedded
  epoch-one evidence; it does not demand the old live lock, controller, child,
  output or mutable epoch head forever. Current admission separately checks
  the genuine process/startup files and current source.
- [ ] Prove exact publication faults, crossed ordinary identity/source/service
  projections, drift across await, same-controller response-loss adoption,
  release only after authenticated terminal, and historical resolution after
  the exact disposable child exits while live admission refuses it.
- [ ] Bind the settlement through a strict versioned cold-predecessor variant
  of existing `preMutationLoadedRuntimeServiceAuthority`, preserving historical
  V1 resolution. Run unchanged phase/DB/physical gates after settlement; no
  synthetic zero-owner assertion is part of the transport terminal itself.

Core ordering:
```ts
const claim = await invokeColdSpawnerBootstrapHelperV1();
const first = await observeInternalProductionServiceCensusV1();
recheckRetainedClaimAndOriginalPins();
const second = await observeInternalProductionServiceCensusV1();
requireSameCensusAndExactClaimProcess(first, second, claim);
retainExpectedSettlementBeforeWriting();
publishOrAdoptOnlyRetainedExpectedSettlement();
fsyncAndReopenExactTerminal();
```

Publisher evidence and causal corrections:

- The connected ordinary-observer test first reached the real PID/start/hash
  and no-listener assertions, then failed because the private settlement entry
  was absent. It now observes the real child through production `ps`, `comm`,
  `lsof`, plist parsing and strict file readers before publishing its terminal.
  The fixture CLI retains the production-required 0755 mode; all other ordinary
  output files remain 0644. No output-verifier exception was added.
- A real post-readiness helper departure after `settledOwn` reproduced
  `cold child live parent chain is crossed`. Three independent `process.ppid`
  reads selected incompatible instants. Capture the parent PID once for both
  allowed branches; retain the exact helper-to-PID-one reobservation rule.
  The real late-departure case passes (2.999s), without sleeping in production.
- Partial-write ownership first failed because its writer stayed open; retained
  cleanup now closes only that owned descriptor, preserving file and lease.
  A sync-fault retry with a changed remaining service first incorrectly passed;
  every live retry now compares fresh census passes to the retained original.
- Direct final-file publication left no distinguishable pending owner. The
  pending-prefix regression first failed, then drove the owned two-link commit
  protocol. A real link-then-throw followed by a **before-syscall** parent-fsync
  fault demonstrated pending removal before final-link durability. The mandatory
  parent fsync now also runs on replay with no writer descriptor. A foreign
  pending file reappearing after commit also first passed incorrectly; committed
  prefix validation now requires its continued absence and preserves foreigners.
- Twenty actual publication/census modes pass (69.816s): pending reappearance,
  pre/post link, pre/post unlink, final sync, partial write, service drift during
  durability retry, caller response loss, file/parent sync, writer close,
  pending-path replacement, same-byte write, foreign final, crossed process hash,
  crossed generation, changed remaining service, second-pass drift and late
  intent mutation. Connected positive passes (3.830s). Independent final review
  reports no remaining must-fix in this publisher. Final full retirement passes
  60/60 (285.194s), including all twenty new fault modes (63.174s). Ordinary
  startup/cleanup passes 4/4 (39.874s); gateway passes 109/109 (2.621s).
  Public census/release integration still refuses: this is the durable private
  publisher milestone, not historical admission, rebind or live Task 6A.
- Full historical-helper testing exposed an empty readiness PID in its watcher
  fixture before production `startSpawner()` was called (18/19). Readiness now
  renames a closed complete PID file atomically; the exact PID/adoption assertions
  remain. Final historical helper passes 19/19 (30.922s), exact manifests 17/17
  (7.250s), and TypeScript/diff checks pass. This is test-fixture publication
  correctness, not a change to the production watcher or a relaxed assertion.

Historical-census integration must preserve the authority split: authenticated
settled history removes cold transport ownership but grants no spawner launch
permission. Require `state === "absent"` explicitly at all four ordinary
spawner preflight/reclamation calls and fresh cold-controller invocation.
Receipt phase-zero may accept an authenticated stable settled census; ordinary
startup may not. The future operation-bound replacement gets its independently
authenticated branch rather than interpreting settlement as a launch token.

The next read-only slice is private `authenticateColdSpawnerHelperIntentV1`
in the existing retirement File Map member. The future helper can independently
authenticate its real inherited FD3/4/5 without duplicating weaker genesis or
incident validators in the helper module. It binds canonical intent/frame,
nonce, exact lock/intent inodes, live controller parent/start/command identity,
full existing cold observation and bound V2 epoch-one/genesis, then independently
observes and compares the exact launch profile and runtime-only environment.
Its own compiled module, fixed helper argv, empty Node execArgv, cwd and actual
Node path must agree. Original directory/file metadata and bytes are rechecked
across the awaited profile observation; only the final intent-only prefix is
recognized. Public census/release/reclaim behavior is unchanged and still refuses
that prefix. No public export, helper main entry, dispatch or live process effect
is enabled. Full fresh cold/zero-owner observation under a distinct opaque
owned-intent context remains the next integration step, not a property of this
inherited-state authenticator alone.

The owning retirement test now compiles the real retirement, locator, environment
leaf and legacy validators into an actual disposable child at the fixed helper
path. Only its profile-observation port is controlled independently of FD3.
Physical macOS temporary paths are canonicalized in the fixture, not production.
Tests cover same-byte foreign FD4/5, linked FD3, nonce/environment/profile crosses,
wrong entry and real intermediate parent, same-byte intent/epoch replacement,
ancestor replacement, cold-root create/delete ABA, extra dispatch, oversized
intent and secret-bearing observer exceptions. Real same-inode lock/intent
growth consumes at most the original size plus one EOF byte, in64KiB chunks.

Independent review found a refusal-path cleanup ownership loss: a pre-close
failure left11 directory descriptors unreachable. The regression first failed
11 versus0. Cleanup now retries a transient failure and retains persistently
unfinished cleanup in a private set; subsequent authentication must drain it
before acquiring more pins. Borrowed FD3/4/5 and the controller lease are never
closed/released. Successful returned guards remain explicitly closeable. This
retains the existing pre-close-failure model; it does not claim recovery from
arbitrary post-success close exceptions or descriptor reuse.

Scoped verification: retirement42/42 (37.374s), TypeScript and whitespace
passed. Final persistent-cleanup and growth cases passed2/2 (3.192s); independent
re-review found no remaining material issue within this inherited-state slice.
Receipt import-inert1/1 (1.113s), exact source manifest17/17 (5.830s), and live
Mission Control API3080/dashboard3333 HTTP200 checks also passed.
No full P3 or live cold acceptance has run.

Completed causally required collector correction, same receipt/test File Map members:
read-only real Darwin evidence showed the current physical collector compares
the entire two ps arrays, including its own different probe PIDs and unrelated
scheduler-state churn. Exact production parser/comparator refused two530-row
snapshots on this unstable global evidence. The collector now performs two
complete bounded collection passes and compares all authority-bearing ownership,
root/worktree, reference, persistent-process and listener evidence. Full parser
validation is unchanged. There is no process-name/PID exemption, zero-owner
shortcut or dropped service check. Private process witnesses normalize scheduler
state but preserve zombie status and every identity/command/cwd field. Published
inventory shape and its actual owner counts remain unchanged. Physical reference
root metadata is authenticated before/after each pass and across the pair.

Review found the first version could miss a descendant born during the second
pass's listener sampling. A real collector regression returned success when it
had to refuse. Each pass now also closes with a full parsed process snapshot,
comparing normalized persistent/descendant/reference/orphan/story-path membership.
This is four bounded ps probes total, two full port collections, no retries.
The closing fence proves relevant process identity/membership stability, not
atomicity of all OS files/listeners/cwds against arbitrary subsequent changes.

The collector harness now uses the actual process parser, witness comparator,
root filesystem identity observer and OpenClaw byte bindings; discovery/reference,
cwd and broad-listener ports remain explicit controlled boundaries. Four stable
cases include harmless probe/scheduler churn and retained nonzero descendant or
reference ownership. Twenty drift cases include late descendant appearance,
new/departing/grandchild owners, late/deleted references, owned cwd/zombie changes,
persistent identity/cwd/zombie changes, worktree/root/project/dirty transitions,
same-path root replacement, listener drift and malformed process records. Success
asserts all four ps probes and both calls through each complete collector port.
Focused parser, command-fence, OpenClaw, real-poison cold-bracket and collector
tests passed7/7 (35.495s). TypeScript/whitespace, import-inert1/1 (1.616s) and
exact source manifest17/17 (5.817s) passed; independent final re-review found no
remaining material issue in this scoped collector correction.

The next private transport slice is `openColdSpawnerHelperFrameV1` in the same
retirement module. It opens the exact intent read-only for FD5 and creates an
empty private0600 scratch inode, separately opens it read-only, unlinks and
fsyncs its parent, then writes snapshot/nonce through the retained writer.
Only after data verification and writer/guard cleanup are RO frame/intent
descriptors transferred; the original lease remains FD4 and stays retained.
No secret byte is written while linked. This sender still has no helper spawn
or public live entry point and does not change the intent-only phase.

Its actual disposable child uses the real fixed-FD3 reader and proves0600,
nlink0, RO write refusal, correct secret/nonce commitment and exact FD4/5
identities. Real-filesystem hooks prove unlink plus parent fsync precede the
first secret write. Faults cover reader open, parent/data fsync, partial write,
writer/guard close and foreign scratch replacement. Review-driven REDs showed
premature writer/return-descriptor ownership transfer and deletion of a replaced
empty path. Handles now remain owned through successful cleanup, and exact
writer/reader/path identity is rechecked after guard callbacks before unlink.

Causally required File Map refinement: also modify the already-listed shared
`src/internal-production/baseline-workspace-authority-path-v1.ts`, with regression
coverage in the already-listed retirement test. Both its anchor guard and the
retirement directory guard marked themselves closed before descriptor cleanup
finished. Actual pre-close fault tests demonstrated5/7 retained descriptors.
Both now enter a permanently non-authenticating closing phase and pop each
descriptor only after successful close, so a retained guard can drain the
remaining handles without re-closing completed entries. The locator preserves
its prior idempotent fully-closed behavior. No path, owner, permission or runtime
admission rule changed, and no File Map member was added.

Final scoped verification: retirement38/38 (28.562s), both real startup workspace
cases2/2 (1.056s), source manifest17/17 (7.020s), TypeScript and whitespace passed;
independent frame/guard re-review found no remaining material issue. The prior
retirement run had37/38 solely from another raw global FD count469 versus468 in
the raw-lock test. Five isolated diagnostic trials and the latest full run
passed; no failing FD identity was captured. Its strict count assertion now
also emits live identity/bounded-lsof diagnostics. Keep the unexplained global
measurement intermittency open; no filtering, settling, retry acceptance or
production guard change was used to turn a failed assertion into success.

The retirement module now contains private `prepareColdSpawnerBootstrapIntentV1`
for the future fixed controller. It acquires real bound genesis/epoch-one and
the physical lease, observes the launch profile and fresh cold prerequisites,
and binds the exact genesis pair, stable prerequisite identity, profile, lock,
one-dispatch limit and nonce commitment in a durable intent. The nonce and
plaintext environment remain in private retained process state only. Before
the first cold-root mutation, that state owns the lease and independent physical
ancestor guard. No public live entry point, helper invocation or child launch
is enabled by this slice.

Intent-only repair uses the same lease, nonce and exact bytes. It permits only
its own empty-root, complete temporary, linked temporary/final or final prefix;
foreign members, crossed bytes and new-controller attempts refuse without
cleanup. Dispatch/claim phases cannot return to preparation. Ordinary public
census still rejects every unsettled cold prefix. Preparation replay is only
durability repair, never fresh launch admission; the future helper must refresh
the scoped prerequisites independently before its exclusive dispatch marker.

Behavioral RED first proved the producer absent. Review-driven REDs then proved
ancestor replacement with unchanged lock/prefix inodes, fresh prerequisites
crossed from genesis, a valid alternate genesis temporarily substituted at the
bound content path, and final-intent disappearance after publication. The fixes
retain the original directory guard, require exact genesis ref/hash plus stable
identity, and require the final intent on the post-publication pass. Four focused
tests pass, including concurrent-call refusal, acknowledgment loss, root-sync
interruption, linked-temporary repair and no secret persistence. Independent
re-review found no remaining material issue in this bounded stage.

The full retirement file passed35/35 on the latest run (23.268s), and also
passed35/35 on the preceding diagnostic run (23.271s). An earlier run had34/35:
the old abandoned-acquisition test saw process-global FD count442 versus441;
its immediate isolated run passed. Cause remains unproven. Keep its strict raw
zero-delta assertion unchanged and add live inode/device/mode delta plus bounded
`lsof` diagnostics for a recurrence; do not claim the intermittent issue fixed
or assume it is the previously proven receipt-fixture loader-cache race.

### Detached launch environment refinement

The real zero-argument launch-profile candidate now brackets the existing full
six-field clean-source observer, fixed plist/loaded job, Node executable, three
build authority files and the two fixed scripts environment files. All paths
are physically directory-FD pinned; full within-observation metadata catches
absent-file create/delete ABA. Positional file reads bound allocation (256KiB
per env file, 1MiB plist, existing32MiB build authority cap, separate256MiB Node
cap). Publishable data contains commitments only; the immutable plaintext
environment is a non-enumerable runtime-only property. This observation neither
publishes authority nor launches a process. Its third read-only export expands
the current surface to56 while the ordered historical53/type26 hashes remain
unchanged. The previously stale active-source boundary fixture now uses that
same additive contract instead of directly requiring53.

Actual host evidence: Node is UID501/GID80 mode0555, while its Homebrew Cellar
ancestor is UID501/GID80 mode0775. No permissions were changed. The evidence-only
Node ancestry policy trusts Darwin's administrative group80, rejecting world
write and foreign directory ownership; all private/source/env ancestors retain
no022. Every ancestor and executable commitment includes dev/ino/uid/gid/mode.
Helper/child must match the original commitment, not rebaseline drift. This is
an explicit administrative-host trust dependency, not protection against a
malicious administrator racing pathname execution or an authority-root exception.

The missing producer first failed its new behavior test. Profile negatives
cover source drift, environment appearance/create-delete ABA/same-inode writes,
symlinks, forbidden loader variables and crossed loaded/plist configuration;
JSON/spread does not expose fixture secrets. Independent review found that the
existing plist reader could read beyond its cap after same-inode growth. The
real-filesystem regression reproduced1048577 bytes read against a1MiB cap;
the profile now supplies bounded positional bytes to the unchanged plist parser.
Focused profile/ordinary service/cold absence/import/source-boundary6/6 passed
(22.505s), TypeScript passed. No live service or database mutation occurred.

Static imports consume runtime configuration before `spawner.main`, so the
authenticated detached transport needs a cycle-free environment leaf, not a
late replacement of `process.env`. Add
`src/internal-production/baseline-spawner-launch-environment-v1.ts` and modify
`src/runtime-config.ts`. The first slice extracts the unchanged dotenv
application rules and adds a bounded pure launch-environment candidate builder;
it grants no process or filesystem authority. Existing owner-admission tests
own candidate/ordinary-loader behavior. Later helper/journal integration must
authenticate exact source/host/lease/profile and inherited snapshot descriptors
before this candidate can be consumed as a cold environment. Never persist
plaintext environment values or fall back to ordinary files on a crossed cold
capability. Add both paths to exact Task0/P3 manifests, runner and owning plan
and design amendments before checkpointing. No child launch in this slice.

The pure candidate and ordinary-loader slice is implemented. The ordinary
copied-loader characterization passed before and after parser extraction;
the new candidate first failed because the projection was absent. Candidate
coverage includes exact process/file/local precedence, missing versus empty
files, immutable output, no ambient environment mutation, malformed UTF-8/NUL,
forbidden loader/guard/test keys, fixed-selector overrides, file/value/key-count
and total serialized-size limits. Only fixture values appear in assertions;
ambient-environment stability is compared by digest, not a secret-bearing diff.
New source-membership RED proved both paths absent from the old manifests.
The additive amendment now binds exact145/64 in plan/design/checker/runner;
crossed or missing amendment rows refuse. Focused environment2/2 (0.970s),
source17/17 (5.821s), real sealed main1/1 (4.485s body), inert imports1/1
(1.834s), gateway109/109 (2.139s), TypeScript and whitespace passed. Candidate
review found no material issue. This is not yet authenticated cold consumption
or a live bootstrap; helper/journal/claim integration remains required.

The leaf's fixed FD3 untrusted-frame reader now rejects nonregular, linked,
foreign-owner, non-0600, empty or over-1MiB descriptors before reading. Positional
64KiB reads ignore inherited offsets and compare full relevant metadata before
and after. Every error is secret-free. Its actual-child fixture covers private
EOF-offset success, linked/mode/empty/oversized/pipe/missing descriptors and a
same-inode write during reading. Focused frame/environment/sealed4/4 (7.463s),
inert imports1/1 (1.120s), TypeScript and whitespace passed; independent review
found no material issue. Returned bytes remain untrusted and repeatable: only
the future durable dispatch/claim protocol supplies authentication and one-use
semantics. No cold loader hook or launch has been enabled.

Early-authentication ruling: keep full clean-source/Git/DB/three-service/genesis
semantics in the controller and independently checking helper. The child must
synchronously authenticate fixed FD4 lock and FD5 dispatch plus exact intent,
live helper parent and controller identities, physical host/root, bound epoch
one/genesis and snapshot commitments. It also verifies authenticated finalized
output-tree entries and metadata—not only spawner.js/BUILD_INFO—before static
configuration consumes the snapshot. This avoids a runtime-config/receipt cycle
without weakening executing-byte freshness. Helper remains alive until the
actual child claim; controller settles only after helper exit and observed
PPID1/PGID=PID. Missing claim after dispatch remains fenced, never redispatched.

Real disposable PG verification at source `5fe0f2c1` passed the existing
post-claim finalizer integration1/1 (71.305s test phase; setup separate), proving
terminal reserved and pre-transfer starting ownership settles normally after
the parser/provider changes. Its clone, primary and template databases were
all dropped by the owning harness. No live schema or data was changed.

The child-output candidate verifier now derives its own executing dist root,
checks root identity/owner, exact metadata-file commitments, output-tree
source/self-hash and every ordinary output's mode/size/content. Required
spawner/config/leaf entries and exact file/directory topology are checked;
physical metadata is compared after the observation. It grants no authority
until integrated with the authenticated dispatch. An executing compiled-dist
fixture covers changed dependencies, wrong roots/source/hash/modes, symlinks,
extra files/empty directories and malformed/crossed entry lists. Empty-directory
RED exposed a missing directory-set check. Review then found eager `readdirSync`
allocation before the cap; a real-filesystem enumeration counter reproduced
that RED, and streaming `opendirSync` with bufferSize1 plus finally-close fixes
it. Focused environment/output/frame/sealed5/5 (8.382s), inert imports1/1
(1.150s), source17/17 (6.698s), TypeScript and whitespace passed. Independent
re-review found no remaining material issue. Actual cold loader/dispatch/claim
integration remains unfinished; no live spawner was launched.

Task 1: complete — scoped implementation and independent spec/quality review
passed. Whole-branch delivery and live recovery remain pending.

- Existing focused startup groups: 2 passed, 0 failed (2.629s).
- Existing helper groups: 3 passed, 0 failed (6.330s) with the normal P3
  `umask 077`. The first local invocation without that fixture prerequisite
  failed the strict directory-mode test; no production guard was changed.
- Task 1 implementer reproduced history admission RED (unexpected v31 shard),
  V2 publication RED (V1 emitted), and public-publisher guard RED (returned).
  Three initial new groups passed; seven existing overlay/replay groups passed.
  Expanded negatives are still running; independent review remains pending.
- Main remains unchanged; no live recovery, migrations or new full P3 run yet.
- Task 1 final five history tests: 5 passed, 0 failed (131.848s), including
  both-present and one-absent durable replay, inode replacement through public
  resolvers, exact current/history overlap and legacy publisher refusal. The
  overlap fixture initially transported Darwin presentation paths; corrected
  the fixture to derive physical targets through the existing private resolver.
  Source SHA256 `d37b1e3ba3dd3433f14d8c2ac602a3040d671b61926a6e21cbc87ad1ef40ffbf`;
  test SHA256 `65eef6477c867b384f2cb13cf1155c8be4952186adf74a15b8601acad99d1380`.
- Task 1B root reproduced repository/workspace mismatch with the real startup
  writer/reader from a nested checkout: RED at wrong root, then GREEN with the
  shared locator and matching directory anchor. Startup suite: 10 passed,
  0 failed (4.784s) at this initial slice. Remaining consumer/fixture/P3
  convergence is in progress; no combined gate or completion claim yet.
- Task 1B storage review found and reproduced ancestor redirection before the
  first sequence directory mutation and a helper error-path descriptor leak.
  The shared lazy physical-ancestor guard now pins `/` through the workspace;
  all seven consumer guards retain it, the first sequence mkdir authenticates
  before mutation, and helper descriptor failures release all acquired guards.
  Both dedicated regressions demonstrated RED, then passed. Independent scoped
  source re-review reports no remaining findings; combined delivery is pending.
- Storage regression command (`umask 077`; `node --import tsx --test` over
  startup-admission, restart-sequence, restart-helper, restart-retirement and
  task-0-source-manifest): 66 passed, 0 failed (32.133s). Real sealed spawner
  gate/main focused tests: 2 passed, 0 failed (9.903s). `npx tsc --noEmit` and
  `git diff --check` exited zero before the final receipt fixture cleanup.
- Receipt physical pre-schema fixtures now seed the same workspace authority
  as production; obsolete repository/workspace mirror writes are removed.
  Retained pre-schema/migration reader passed. Remaining physical-history
  regressions are still running. One raw descriptor-count mismatch is under
  investigation; do not treat this slice as fully verified yet.
- Epoch-genesis dependency audit: public complete-zero requires A activation,
  public legacy-zero requires prepared current entry, and quarantine admission
  requires four services. Therefore extract the spec's private raw cold
  three-service/zero observer before genesis; do not bypass these public guards
  or use fabricated prepared/activated authority to satisfy prerequisites.
- The physical pre-schema history/inventory/ABA group and absent/sealed/ready
  endpoints passed: 4 passed, 0 failed (234.926s). The descriptor mismatch was
  independently traced by inode/device to a pending `tsx` compilation-cache
  write, with no unclosed synchronous authority descriptors. The fixture now
  settles the loader before its baseline, counts only live descriptors, and
  retains immediate strict zero-delta checking plus identity diagnostics.
  This is test measurement isolation, not a production guard relaxation.
- Post-measurement-fix absent/sealed/ready/retained reader rerun: 4 passed,
  0 failed (13.142s); final `npx tsc --noEmit` and `git diff --check` exited
  zero. Next gate is the disposable P3 template/projection plus manifest test,
  not a new full 45-file receipt or a live rollout.
- Final checkpoint review caught a Darwin fixture-only `/var` versus
  `/private/var` workspace alias. An executing copied locator reproduced the
  mismatch; projecting the fixture's authenticated `realpathSync` root fixed
  it. That regression and both sealed spawner tests passed (3/3, 9.093s).
- Storage checkpoint `a8027782` passed disposable P3 template setup, primary
  readiness authentication and all 13 manifest tests (6.444s test phase).
  Both generated test databases were dropped by the harness. No live rollout.
- Finding terminal validation RED: executing the current private SQL projection
  with canonical parent/children returned `published` after a child fingerprint
  was crossed while member IDs stayed equal. The new regression fails with
  `Missing expected rejection`; valid open-issue publication and its unchanged
  terminal hash pass. This establishes the extraction/consumer correction.
- Pure finding extraction is integrated into repository publication and terminal
  resolution. Complete parent/child content, fingerprints and cross-parent
  membership are checked; ordinary publication does not require terminal runs.
  The existing terminal hash is unchanged. Independent review found no source
  defect; its partial-publication fixture finding was repaired with a canonical
  two-member parent and exactly one authentic child.
- Pure projection/mutation regression passed; existing finding contracts passed
  8/8. Current exact142/61 source inventories, additive amendments and their
  negative checks passed 15/15 (5.633s); `npx tsc --noEmit` and diff check exited
  zero. Real PostgreSQL owning suites are the next verification step. Legacy
  zero-owner inventory/provenance and epoch genesis remain unimplemented.
- Checkpoint `2890f11c` real PostgreSQL verification completed: finding
  repository 12/12 (101.048s), owner-admission 85/85 (1538.344s), zero failures.
  Both isolated prefixes and their template/primary/clone databases were
  removed by the harness. This proves the publication/storage checkpoint,
  not the subsequently edited inventory or live Task 6A.
- `npm run build` on the clean scoped branch refused before building because
  HEAD does not equal origin/main. No runtime/build guard was bypassed and
  no origin reference was rewritten. TypeScript and disposable tests remain
  available; the full guarded build belongs after reviewed integration.
- Legacy schema31 RED used a real disposable migrated database containing a
  terminal failed run and complete immutable open-issue publication. It failed
  exactly with `findingOwnerCount is nonzero`; all 12 existing repository
  tests passed and snapshots proved no stored issue/run/publication mutation.
- Added `src/findings/legacy-finding-publication-inventory-v1.ts` to this File
  Map and the additive owning exact143/exact62 manifests. This pure evidence
  schema is causally required by Task 1B; it grants no admission itself.
  The schema31 read-only repeatable-read census authenticates complete bounded
  parent/child publications and terminal run relations before reporting zero
  publication owners. New observation V2 binds the inventory outside the
  unchanged 36 counters; strict historical V1 grants no memberships.
- V2 public/nested parsers, no-write quarantine builder, dynamic pre-dispatch
  and post-termination checks, and migration/final-graph inventory continuity
  are wired. Independent review found conflicting statuses for a shared run;
  an executing RED demonstrated it and the validator now rejects that case.
  Pure/parser/census focused checks passed 5/5 (20.253s); amended manifest
  checks passed 16/16 (5.637s), TypeScript and diff check passed.
- Remaining in this inventory slice: real PostgreSQL GREEN and extended
  quarantine/history regression verification. Post32 authenticated provenance
  lookup and complete-census classification remain unimplemented; do not grant
  exemptions or claim live zero-owner from this checkpoint. Cold three-service
  observation, epoch genesis, direct transport and live A acceptance remain
  later coupled work; B–E and final delivery are still pending.
- Extended quarantine/history checks completed 4/4 (249.571s), including the
  real physical pre-schema causal history and generation/inventory negatives.
  Review then found the stored prepared/consumed migration-32 resume path
  needed its own exact post-termination inventory reobservation. Both modes
  reached staging in the demonstrated RED; after the correction both refuse
  before consumption publication, evidence minting or staging, while equal
  inventory still reaches staging. Combined parser/apply behavior passed,
  along with TypeScript and diff check. No migration was applied live.
- Inventory checkpoint `ef0a542a` first isolated verification stopped before
  tests: P3 template's copied private data directory had mode0755, not0700.
  Disposable Node26.4.0 microprobe and the executing actual helper-copy block
  reproduced source0700 to destination0755 under umask0022. The filtered copy
  preserves source directory modes, file0600 and bytes without relaxing the
  production guard, overwrite policy or source authentication. The regression
  passed after RED; TypeScript and independent two-file review passed.
  Owning files already in the File Map are `tests/execution-attempts/test-database.ts`
  and `tests/internal-production/owner-admission-v1.test.ts`. The failed prefix
  was confirmed absent from pg_database. Prior success's umask is unknown.
- With that fixture correction, isolated setup passed and the real schema31
  immutable-publication regression passed (5.103s). A newly added modern post32
  closed-publication census regression is running with the remaining owning
  repository suite; classify its exact failure before implementing post32.
- Modern post32 RED completed: 14 tests, 13 pass, exact closed-publication
  census assertion failed `1 !== 0`; schema31 regression and all 12 existing
  repository tests passed. All disposable databases were dropped.
- `src/db-pg.ts` now authenticates bounded complete finding publications and
  bidirectional modern sidecars within the existing read-only snapshot. It
  validates reservation/binding/close history without lock-taking terminal
  resolvers, compares the unchanged published terminal-owner pair, and requires
  the close edge in authenticated current-head ancestry. Global pending/bound
  refusal remains. Unreserved publication still fails closed until the separate
  legacy migration-provenance reader is implemented.
- The additional negative fixture initially attempted an immutable update and
  was correctly refused by `ARTIFACT_IDENTITY_IMMUTABLE`; no guard was disabled.
  It now seeds a distinct malformed publication at birth. A valid older head
  also fails census adoption of the later close, then restores exact head row values.
  Final real PostgreSQL suite passed 14/14 (122.512s), including unchanged
  issue/publication/sidecar/head snapshots; all test DBs were dropped.
  Actual private-function orphan-sidecar and pure boundary checks passed 4/4;
  source manifest passed 16/16 (5.980s), TypeScript passed, diff check passed.
  This modern-classification slice does not yet grant legacy post32 exemptions.
- Added the read-only historical migration inventory resolver in the existing
  receipt File Map entry. The executing fixed-file test first failed because
  the port was absent. It now resolves authentic authorization/consumption and
  legacy observation files, preserves the exact 22-field evidence projection,
  binds source/audit/operation/sealed pairs, and returns V1 empty or exact V2
  membership. No current-entry selection, evidence minting or mutation occurs.
  Expanded fixed-file regression passed (13.142s), including source/evidence/
  consumption/audit crossing, generation/inventory drift, missing exact record,
  and unchanged filesystem snapshots. TypeScript and diff check passed.
  DB integration must authenticate current head plus exact journal32 and compare
  the entire retained inventory even when all legacy rows are missing or owned
  by modern sidecars. The existing empty P3 template must gain authentic fixed
  migration evidence before application, not a fallback or head rewrite.
- The DB census now authenticates the exact applied journal32 and current-head
  application in the existing read-only snapshot, resolves historical inventory,
  and compares it against the entire freshly validated unreserved subset plus
  terminal runs. The executing RED exposed the old empty shortcut; focused
  GREEN includes all missing, all modern, added unreserved, terminal drift,
  missing/duplicate/crossed journal and missing provenance cases. Both head
  validation ports and modern reservation resolution retain the same SQL handle.
- First real-PG integration completed 14 tests, 13 passed; the empty template
  failed the new fixed-record resolver because its old authorization reference
  was synthetic. All disposable databases were dropped. The test-only fixture
  now publishes and authenticates historical V1-empty legacy/auth/consumption
  files before copying the private data and applying32. Empty P3 fixtures reuse
  these exact template-bound pairs behind the existing capability check.
  No applied head is rewritten and production has no empty fallback. Independent
  DB and fixture reviews found no actionable issues; TypeScript, focused checks
  and all 16 source-manifest tests passed. Real-PG rerun passed 14/14 (129.446s),
  including the public modern census through authentic V1-empty migration
  provenance. All disposable databases were dropped. A genuine pre32-to-post32
  nonempty legacy integration test remains next.
- Genuine nonempty pre32-to-post32 integration now passed with real immutable
  run/parent/children rows, actual guarded32 application and real current-head
  ancestry plus fixed-file V2 provenance. The test-only exact-URL adapter exposes
  the existing private SELECT leaf; it grants no runtime export or A activation.
  It proves a later complete unreserved publication is refused, with unchanged
  rows/head/journal after both observations. Initial fixture assertion incorrectly
  expected a pending journal32 row; actual pending exists in the migration plan,
  not the stored journal. The corrected fixture checks exact pending plan and
  no journal32/33 rows before application. Full owning PG suite passed 15/15
  (139.198s); all disposable databases were dropped. TypeScript, 16 source
  manifest checks and independent test-adapter review passed.
- Read-only live recheck remains migration31 applied, four open findings, no
  owner-reservation sidecar and only terminal runs (83 cancelled,18 completed,
  196 failed). No live migration, issue mutation or service restart occurred.
- Cold physical foundation: executing RED proved the three-service leaf was
  absent. The ordinary wrapper still supplies exactly four persistent services;
  the new private collection leaf supplies the actual three, sharing the same
  process, ownership, listener-binding and repeat-scan implementation. It grants
  no cold admission by itself. Review improved the negative to retain the
  four-service input while removing its spawner from the real process fixture;
  it now proves the intended persistent-service drift refusal, not a TypeError.
  Cold/ordinary and OpenClaw focused tests passed 2/2 (7.978s); TypeScript and
  all16 source-manifest checks passed. Global all-root daemon/launcher absence,
  stable singleton/PID residue, complete observation bracket and epoch genesis
  remain next; no public four-service ABI or verifier pair changed.
- Added the private read-only cold-spawner absence leaf, still not admission.
  It pins account-home/singleton ancestors, checks fixed launcher/build/plist/job,
  performs bounded wide global process scans across roots, and preserves PID
  residue. A canonical stale PID is accepted only after census absence and
  explicit ESRCH; live/reused/ambiguous PID or any lock presence refuses without
  deletion/reclamation. PID writers' historical0644 mode remains accepted.
  Review found empty successful process output could falsely prove absence;
  actual-parser RED reproduced it, then own-PID/UID/non-zombie witness checks
  fixed it. Raw-byte harness also asserts exact ps argv. Focused ordinary/cold/
  physical tests passed3/3 (14.419s), TypeScript and source manifests16/16 passed;
  independent rereview found no remaining issue. Actual live paths are account-
  owned directories (.openclaw0700, setfarm0755), both PID and lock absent.
  Complete cold incident/source/three-service/zero-owner bracket, retirement
  history absence, bound genesis and transport still remain; no launch occurred.
- Added a private evidence-only cold bootstrap bracket in the existing receipt
  File Map entry. The real fixed-poison fixture first failed because this port
  was absent; the implementation now binds exact incident bytes/fingerprint,
  source, no-write31/pending32 prerequisite records, actual three services,
  global absence, physical/phase/database zeros and retained legacy inventory.
  Both complete passes must agree; no synthetic spawner or legacy-zero record
  is manufactured. Fixed successor-edge absence and operation identity are
  rechecked, with held directory descriptors across the bracket.
- Parallel review identified catalog gaps causally necessary for this same cold
  admission objective: pending32 alone does not inspect unjournaled33 or orphan
  objects. Cold DB mode now independently checks journal>=32, all39 declared
  table/index names, nine row-type names, four routine names across overloads,
  and nine trigger names in the same read-only repeatable-read census. Identifier
  matching respects PostgreSQL63-byte truncation. Ordinary mode is unchanged.
  Review also strengthened successor-parent pins to full path/FD metadata so
  transient create/delete cannot disappear between passes; writer guards were
  not changed. Added source-executing drift/race negatives and real-PG cases in
  the existing findings repository test File Map entry. Focused checks passed4/4
  (7.529s); the expanded bracket including unknown-incident rejection passed
  (1.360s). Typecheck, source manifests16/16 (5.463s), diff check and independent
  rereview passed. The complete owning real-PG run remains pending.
  This is not genesis or launch admission: retirement/cutover history under the
  physical transition lock, bound epoch genesis and cold transport remain next.
- First complete owning PG run at0f936e41 finished16 tests:15 passed, one new
  test-adapter failure (`canonicalComparable` absent from its copied helper
  closure), not a catalog acceptance failure. All f89f79065753b9ddb025b392
  disposable databases were dropped. The adapter now copies both actual
  transitive helpers and exercises exact-zero/malformed aggregate responses
  before allocating a DB, preventing this setup defect from wasting a PG run.
- Corrected owning PG rerun at326860d2 passed16/16 (136.046s), including real
  catalog-only journal, view, index, type, overloaded function and disabled
  misattached trigger negatives with unchanged snapshots. All a25c672a4d3165b24be43b4c
  disposable DBs were dropped. Live MC/API and dashboard remain HTTP200 and the
  deployed main worktree is clean; no live migration or restart occurred.
- Before changing epoch acquisition, baseline retirement suite exposed two
  fixture-only failures (17/19): test-created settlement shards used default
  0755 despite the shared workspace guard requiring0700. The two failing sites
  and one latent equivalent site now explicitly request0700; production guards
  remain unchanged. This restores the existing recovery cases needed to verify
  the same-descriptor genesis lease work rather than hiding those failures.
- After those fixture corrections, the unchanged retirement suite passed19/19
  (8.148s). A new executing absent-head/raw-lock test then failed because the
  separate raw acquisition did not exist. Factored the existing physical lock
  into a private frozen WeakMap capability, with separate same-FD promotion and
  release; ordinary admission keeps both epoch checks and unchanged exports.
  Raw handles cannot serve as ordinary leases or be cloned/re-promoted.
  The fixture FD baseline now starts after loader initialization, and the old
  second-epoch fault hook follows its moved but unchanged semantic boundary.
  Complete retirement suite passed20/20 (8.405s), source manifests16/16
  (5.086s), TypeScript and independent review passed. No bound genesis/head or
  cold dispatch exists yet. The abandonment path remains acquisition-only;
  future published cold ownership needs explicit journal retention rules.
- Next coherent genesis slice (same receipt/retirement File Map): export only
  a zero-argument read-only wrapper around the private cold bracket; retirement
  dynamically invokes that fixed port itself. A new zero-argument genesis lease
  entry accepts no proof/callback/root from callers. Embed the complete cold
  observation in a strict content-addressed epoch-genesis receipt, then create a
  V2 epoch-one head bound to its pair. Keep historical V1 and epoch-two parsing
  unchanged. Discover at most one exact receipt/temp candidate under
  `epoch-genesis/sha256`; reject unknown retirement and sibling restart history
  before dead-owner reclamation and again under the retained raw lock. Resume
  the original receipt bytes only when fresh cold evidence agrees on incident,
  source, prerequisites, synthetic Git absence and finding inventory. Volatile
  service observations must pass freshly but do not redefine retained genesis.
  Reopen durable receipt/head and promote the same lock; no launch is included.
- Genesis implementation now owns a strict full-observation receipt and bound
  V2 epoch-one head. Initial behavior RED was the missing zero-input genesis
  entry. Review-derived REDs reproduced missing ancestor/data fsync, same-byte
  receipt/head/shard replacement across the awaited observation, and stale raw
  retention after owned unlink. Fixes preserve strict historical V1/epoch-two
  readers, use the same physical FD, and retain only authenticated retry state.
  Own unlink has an explicit phase recorded before directory fsync; external
  unlink and a foreign replacement never authorize reacquisition or deletion.
  No live genesis was published and no child was launched.
- Tests cover nineteen crossed-evidence/history refusals; eight recognized or
  forbidden publication prefixes; same-byte receipt/head/shard replacement;
  ancestor and retained-data durability; prerequisite drift; pre/post-unlink
  and post-close failures; external deletion/foreign locks; competing receipts,
  unsafe members, incomplete bytes and epoch-two refusal. Empty hash shards
  without a valid candidate deliberately remain fail-closed, not auto-repaired.
- The broader receipt check exposed pre-existing coupled-slice contract drift:
  the historical migration-inventory resolver plus the new cold observer add
  exactly two read-only runtime ports. The old ordered53 export hash is retained
  unchanged and those two additions are named explicitly. Seventeen context
  calls plus one definition are now consistently counted. Exact pre-schema
  locator assertions follow the reviewed shared-workspace producer root, not
  the executing source worktree. No runtime guard or negative test was removed.
  Receipt focused checks passed6/6 (9.321s), source manifests16/16 (5.288s),
  retirement suite28/28 (21.002s), plus the additional seven-case competing and
  unsafe-prefix test1/1 (1.649s); TypeScript and diff whitespace passed.
  Independent final five-file review found no material issue.
  Final complete retirement rerun including all new cases passed29/29 (19.555s).
- Next transport integration stays in the existing five runtime families and
  their owning tests: startup admission coordinates cold intent/dispatch/claim/
  settlement; retirement owns the same-FD journal and cleanup fencing; the
  helper authenticates and dispatches direct detached effects; spawner handles
  inherited cold authority immediately after singleton acquisition and before
  ordinary admission; receipt phase zero accounts for unfinished cold work.
  Resume must inspect an existing dispatch/claim before choosing genesis:
  genesis always requires absence and cannot be blindly reacquired after a real
  child appears. New direct rebind effects require a separately versioned
  transport authority; historical V1 launchctl receipts remain read-only.
- Next bounded transport prerequisite: add one zero-argument filesystem-only
  cold-journal census in retirement and invoke it before every cleanup/reclaim
  early return and both ends of phase-zero observation. For this initial slice
  every present `restart-authority-retirement-v1/cold-spawner-bootstrap-v1`
  prefix refuses; no complete-looking caller record grants a terminal exception.
  Authenticate the nearest existing ancestor across absent-root reads. No
  publisher or launch entrypoint is reachable until the real child/controller
  settlement validator replaces this conservative refusal. File Map: existing
  retirement/receipt modules and both owning tests. REDs: ordinary release and
  dead-owner reclamation currently ignore that future family; phase-zero must
  not report zeros when it exists.
- Executing the whole phase-zero function exposed another causal prerequisite:
  its own 1.59MB source was incorrectly read with the 1MiB authority-record cap.
  Use the existing `MAX_BUILD_FILE_BYTES_V1` for this authenticated source/build
  file, as the source/build and spawner entrypoint observers already do. Keep
  `CURRENT_ENTRY_MAX_BYTES` and every record-size guard unchanged. The test
  copies and executes the real full-sized source rather than shrinking it.
- Cold journal refusal gates implemented with no launch/publisher. RED ordinary
  release incorrectly removed its physical lock; it now preserves the exact
  lock for every empty/intent/dispatch/claim/unbound-settlement/unknown prefix.
  Dead-controller reclaim also refuses those prefixes. Ordinary release retains
  its historical handle-revocation behavior; the physical fence remains, not a
  reusable ordinary lease. Future cold coordination must retain its held lease
  while settlement is unknown rather than invoking ordinary cleanup.
- Executing phase-zero RED then demonstrated a present cold owner returning
  literal zeros. The fixed filesystem-only census now brackets the whole phase.
  Independent review additionally reproduced cross-call create/delete ABA;
  a hashed nearest-ancestor/full-metadata witness and exact before/after equality
  close it. Absence creates no directories; dangling links, same-call ABA and
  transient phase-owner appearance refuse without synthesizing settlement.
  Final retirement31/31 (23.419s), receipt focused5/5 (9.429s) plus final ABA
  regression1/1 (0.623s), source16/16 (5.002s), inert imports1/1 (1.310s),
  TypeScript and whitespace passed. Independent review has no remaining finding.
- Added an existing-helper-test File Map diagnostic using an actual disposable
  detached Node daemon and the production `spawnerctl.startSpawner` body with
  only fixed fixture PID/log paths. Two watcher starts return the same PID,
  start time, PPID1 and PGID=PID; no replacement dispatch occurs. Test passed1/1
  (0.141s), then terminated only that exact disposable process with SIGTERM.
  This proves the watcher mismatch; direct transport is still unimplemented.
  Live Mission Control/API and Setfarm dashboard remain HTTP200; no live data,
  service, schema or build-retention change was made.
- Before the cold child gate is added, review found provider discovery already
  runs at spawner module evaluation (four CLI searches/version probes and an
  optional Mission Control quota curl). Merely placing a gate in `main` cannot
  seal that activity. Defer those four CLI resolutions, runtime selection and
  both runtime-derived concurrency/startup-silence defaults together until
  after the sealed startup return and before ordinary runtime availability.
  Preserve resolution order, fallback policy and environment override parsing.
  File Map refinement: `src/spawner.ts`, owning `owner-admission-v1.test.ts`,
  and `tests/spawner-gateway-recovery.test.ts` source/default contracts. Add
  provider-subprocess sentinels to the existing real-main sealed fixture;
  current normal-startup markers do not observe import-time discovery.
- The same real-main fixture also projects scratch/transcript/attempt paths
  into its disposable root. It demonstrates those three ordinary directories
  are created before sealed admission. Move their existing initialization and
  agent-CWD assertion after sealed return alongside deferred provider discovery;
  keep actual singleton/PID acquisition before the child gate. No live path is
  used by these new side-effect probes.
- Independent review found an exported-finalizer compatibility regression:
  `releaseUntransferredPostClaimOwnership` can drain an OpenClaw session without
  running `main`. Initialize only after its exact runtime/owner identity check
  and only for the OpenClaw branch, before requesting drain. A source-executing
  imported finalizer → actual drain → actual cancel regression reproduced zero
  cancellation commands (RED), then proved cancellation of the exact lookup and
  task (GREEN). External DB/provider boundaries are disposable doubles; the
  probe stops before absence observation and does not claim durable settlement.
  Final gateway109/109 (1.997s), real sealed main1/1 (5.429s), TypeScript and
  whitespace passed. Independent re-review reports no remaining material
  finding. Provider order/defaults/overrides remain covered by eight cases.
  No live provider, service, DB or ordinary directory was touched.
