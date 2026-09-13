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

### Full receipt integration repair (2026-09-13, in progress)

The authenticated isolated full receipt run uses the immutable `81bf9794`
projection and is being allowed to complete despite failures. Root may repair
the source checkout while that independent projection continues; its result
remains evidence for `81bf9794`, never for the later fixes. File Map for this
repair: the existing receipt test and this progress ledger; no runtime guard,
P3 runner authority or production source changes so far.

- Three Task12 writer/publication tests used repository `data` instead of their
  fixture's authenticated workspace `data`. A focused RED reproduced all
  three workspace-escape refusals. Corrected the fixture paths, retained real
  no-replace/cleanup behavior, and repaired the bounded guard-close probe while
  preserving its actual `try/finally` cleanup. The adjacent hardlinked-lock
  test now also requires the real lock-member/topology refusal, avoiding a
  false pass from the unrelated path error. Focused result: 4/4, 10.090s.
- The phase-zero fixture now accepts exactly one of the original code-owned
  workspace literal or the authenticated runner's projected literal. It still
  installs a fixed disposable workspace; no environment authority is added.
- Launch-profile RED reproduced by unsetting `TMPDIR`: `/private/tmp` is a
  shared writable ancestor rejected by the actual production profile guard.
  Only this profile fixture now uses a private temporary child of the physical
  user home, matching an existing runtime-isolation test pattern. Production
  ancestry checks and the P3 environment remain unchanged.
- Two stale source-contract checks are reconciled with the already-tested
  historical P3 resolver's seventh C-durability occurrence and the shared
  prepared-record materializer. Existing semantic/durability tests remain.
  Phase-zero/profile/both contract focused tests passed 4/4 (6.999s) with
  `TMPDIR` absent. These narrow results are not a full receipt/P3 pass.
- The same stale repository-relative authority paths affected P5c-S E4/E5 and
  the effect-store fixture. Move only their production-observed paths into the
  disposable workspace's private data subtree; retain external test-only
  backup/input paths. The actual directory-owner, generation-swap,
  stale-writer and descriptor checks passed 4/4 (8.278s). All admitted effects,
  full content-shard ownership and E4/E5 response-loss integration passed 3/3
  (24.318s). No failed-case expectations were relaxed. TypeScript passed and
  independent fixture-diff review found no actionable issue; the reviewer did
  not run tests or certify the unfinished full gate.
- Composite status RED then exposed both its stale root and default-mode
  content parents. The corrected private tree passed 1/1 (6.251s). Six retained
  recovery AtRoot tests passed 6/6 (21.037s) after the same root repair,
  including their independent expected locators and crossed-release bait.
  The operation-directory leaf fixture is also relocated; its full workspace
  snapshot now covers both repository and authority siblings. That larger
  leaf test passed 1/1 (43.555s) on checkpoint `6dc57bc7`.
- H3/H4 had independently seeded terminal artifact parents at default modes;
  prepare only the actually-present artifact parents using the existing private
  publication helper. Missing-artifact cases stay missing. After this repair
  their remaining focused failure was the unchanged zero-FD-delta assertion.
  Temporary fstat/lsof diagnostics identified four handles to two tsx cache
  files, whose source maps name only copied `src/db-pg.ts` and
  `src/installer/run.ts`. No retained production authority file was implicated.
  The two probes now pre-import those declaration-only fixture modules and
  settle compilation before the FD baseline, with every controller/recovery
  call still inside the measured interval. No post-action wait or descriptor
  exclusion is allowed. Temporary diagnostics were removed; H3/H4 then passed
  2/2 (57.692s), including unchanged zero-descriptor-delta and all refusal cases.
- Physical Q classification and normalization fixtures shared the obsolete
  repository root/default-parent-mode setup. Three focused REDs confirmed the
  workspace escape. Their topology proofs and actual records now use the same
  private workspace roots, with explicit private parents before fixed/content
  writes. Their existing per-successor snapshots follow those roots. The combined
  Q rerun passed three tests; the fourth retained-status test passed all four
  mutation cases with the tsx cache disabled, identifying another pre-baseline
  compilation race. A pre-baseline settle, matching the existing normalization
  probe, then passed that test with the cache enabled (1/1, 13.786s). Its
  zero-descriptor-delta assertion and all mutation refusals remain unchanged;
  no normalization guard is changed. The subsequent TypeScript check passed.
- Full-run failure inventory, remaining causal fixes, independent review and
  the subsequent exact-snapshot rerun are still pending. Task 3's joined
  cold-to-prepared-to-direct-rebind proof and Task 6A order remain unchecked.

### Causal refinement: post-effect retained authority (2026-09-13)

The absent pre-schema resume fixture previously preseeded six status locators
without their causal materials. Correcting it to begin genuinely absent and
publish authentic terminal material only at the execute transport boundary
exposed a production refusal: `Task12 receipt endpoint missing directory
appeared`. The current-status CAS revalidates the old raw absence after the
owned effect legitimately creates those files. The same failure remains with
the complete terminal history, not merely a prepared-prefix simulation.

This blocks the existing Task 6A transition and is a systemic root fix under
the approved cold-recovery objective and standing owner protocol. File Map:
`src/internal-production/baseline-post-handoff-receipt-v1.ts`, its existing
test, and this plan. No new public API, source inventory member, runtime flag,
live mutation, or weaker raw validator is authorized.

Chosen design: retain the original selected owner and its predecessor pins;
after a genuinely executed prior-only effect, reopen a complete selected pass
under the same context/controller. Fence the original root, status/nested
authority and current-status CAS identity before and after that await. Require
the same predecessor row/pair/body, completed fresh raw evidence, and the exact
captured next pair before publishing candidate content or performing CAS.
Use the fresh owner for the existing complete CAS guards and close it on every
path, preserving primary failures. The original owner closes in its existing
outer finally. Already-completed catch-up keeps its existing owner path.

Refreshing only raw observations would require a second partial owner API;
the existing full selected-pass opener already authenticates filesystem and DB
evidence together. Dropping raw checks or precreating authority directories
would conceal the stale-observation bug and is explicitly rejected.

- [x] Reproduce the original malformed fixture, then the genuine absent to
  complete physical history refusal (focused 1/1 RED, 6.254s).
- [x] Add the private retained-predecessor fence and same-controller fresh-pass
  handoff; require `fresh.pass.raw.nextPairBytes.equals(candidate.pairBytes)`
  and exact old/fresh predecessor equality before the existing CAS path.
- [x] Prove positive adjacent advancement plus changed/missing completed
  history, equal-byte predecessor replacement, and fresh-owner cleanup failure
  refusals without extra dispatch or current-status advancement.
- [x] Run focused effect, retained catch-up, response-loss and zero-FD tests,
  TypeScript, manifests and contracts; obtain independent scoped review.
- [ ] Checkpoint and rerun the authenticated full receipt before P3 delivery.

Initial scoped evidence: the genuine absent-to-terminal-history test now passes
and still advances only to retained status-00. Five focused cases passed
(26.772s): success, missing authorization material, same-byte predecessor
replacement, fresh-owner close failure, and material refusal plus close failure.
Both owners close in reverse order, descriptor delta stays zero, failed
authority leaves the current pair unchanged, and a close failure after CAS
preserves its committed adjacent pair. Independent source review found no
must-fix; other prior-only effect arms and broader gates remain unverified.

The branch-routing fixture now models two independently closable selected
owners, a completed post-effect observation, and the same canonical predecessor
bytes. Its existing CAS transport is attached at the moved call site, not in
place of the new handoff. All effect ports, candidate construction and single
CAS counts remain exact; successful executed effects close fresh/original
owners in order `[2,1]`. The admitted effect-arm and E4/E5 response-loss tests
passed 2/2 (18.965s). This is routing/endpoint coverage; the genuine physical
five-case test above separately proves the actual reobservation and CAS path.

The remaining Q-A/Q-B fixture failures share one repository-local `.setfarm`
path producer. Its roots now use the private workspace data subtree; malformed
evidence snapshots include the whole workspace. A focused RED confirmed the
original workspace escape; sole PID-only Q1, wrong-mode, hardlinked evidence
and stale-writer Q1 recovery passed 4/4. Fault modes are still applied after
private directory setup. The two failing structural callers shared a stale
pinned-chain count (8, now 9 including the historical P3 resolver). Their
recursive effect audit now treats the already separately audited selected-pass
opener as a leaf while continuing to traverse the new handoff. Both structural
tests passed; full Q groups and the ongoing immutable run remain pending.

Expanded checkpoint gate passed 10/10 (83.385s): selected-controller failure
precedence, six adjacent retained catch-up resumes without another effect,
the five physical post-effect cases, and both structural callers. Latest
TypeScript, English (1469 files), path (848 files), migration digests, Mission
Control contracts (12 artifacts) and whitespace checks passed. Independent
re-review of the complete new test changes found no actionable issue. This is
an intermediate reviewed source/test checkpoint, not full receipt, full P3,
Task 3 completion, PR delivery, clean-main rollout or live acceptance. The
immutable `81bf9794` run continues to collect all failures before its own
runner-owned cleanup; the relocated row-tail leaf and full Q groups still need
their focused reruns, and every later full gate must name its new exact SHA.

Follow-up evidence on `6dc57bc7`: the complete Q-A/Q-B group passed 103/103
(177.494s); the physical row-tail SQL/operation-directory leaf passed 1/1
(43.555s). The manifest group passed 17/17 (6.089s). These close the focused
reruns above, not the authenticated full-suite requirement.

The immutable `81bf9794` receipt run finished with exit 1: 904 tests, 772
passed, 132 failed, zero cancelled/skipped/todo, 5356.605s. Both uniquely owned
test databases were dropped by the runner; its processes exited. The failures
consist of the 100 shared Q cases, 31 previously investigated integration
cases, and one final-verifier fixture failure discovered at the end. That last
case changes an embedded pre-mutation authority pair without recomputing its
body hashes, so it fails the strict inner parser before the intended
ready-status/entry-authority overlap edge. The current checkout reproduced
that RED (58.237s). A fixture-only repair changes one valid service hash and
recomputes census/projection/body hashes, keeping the exact overlap refusal.
The subsequent RED (76.314s) exposed the same stale projection hash plus an
old embedded body in the later operation-B negative. Rehash that projection
and embed the exact stored alternate body. The current status parser now
rejects this same operation-A/status versus operation-B/P3 relation before
the older final-graph check, so this case expects that precise earlier
operation-binding refusal, not the unrelated inner-hash error. No production
parser or guard changed. The complete final-verifier test then passed 1/1
(77.408s), retaining all zero-mutation/publication/current-locator assertions.

Latest read-only service checks returned HTTP 200 for Mission Control 3080
and dashboard 3333. No live service, database, schema or runtime-data mutation
was performed by this integration repair.

### Task 6A operator sequence repair

File Map: the existing main baseline handoff plan, the existing
`tests/internal-production/baseline-post-handoff-cli.test.ts`, and this ledger.
Execute the actual documented Step 1 shell in a disposable unrelated working
directory with strict Git/npm/isolated-runner adapters and real jq. Reject public
prerequisite publication before prepare. No live command or DB is invoked by
this regression. The existing production tests retain physical authentication;
the operator regression proves ordering and cross-command equality only.

- [x] Reproduce the old publish-before-prepare sequence with the executable
  shell test; expect an explicit adapter refusal before public publication.
- [x] Move prepare plus immediate operation/status equality ahead of public
  PBA/v31/pending/census observations. Remove guessed legacy content paths and
  manual inode snapshots; resolvers own authenticated physical paths.
- [x] Validate actual V1/V2 pre-mutation projection schema, then require the
  complete status/prerequisite/census equality and exact prepare/status replay.
  Keep all clean-main and isolated prerequisite gates unchanged.
- [x] Prove ordinary/cold prepared branches and refusal of source, prerequisite,
  census and replay drift; run CLI tests, contracts and TypeScript, then review.

Preparation may recover and launch a sealed cold predecessor under its existing
code-owned protocol; it is not a globally read-only operation. Public v31 and
pending observers may publish/adopt records after prepare. Step 1 must not call
resume, ordinary restart, migration apply or activation, and must leave the
dashboard and Mission Control generations unchanged. Do not describe this
sequence as mutation-free or promise cross-command inode equality.

The executable shell RED reached the explicit
PREPARE_REQUIRED_BEFORE_PUBLIC_OBSERVATION refusal (3.616s), after all five
isolated gate adapters. After the ordering/schema repair, seven scenarios
passed (40.255s). The complete CLI file then passed 12/12 (57.390s), adding
initial operation/phase refusal, malformed cold fields and unknown projection
schema, and retaining the existing exact zero-input CLI test. This is execution
of the actual documented shell with external command boundaries simulated; it
does not claim real cold launch or physical-record authentication.

The final-verifier fixture diff and Task 6A shell/test changes received
independent read-only review with no actionable findings. English (1469 files),
path (848 files), migration digests, Mission Control contracts (12 artifacts),
TypeScript and manifest tests (17/17, 5.702s) passed. No source manifest member
or public API was added. Exact full receipt/P3, joined real-process proof,
clean-main build/rollout and live Task 6A acceptance remain open.

## Task 1: Preserve exact authenticated historical prerequisites

**Consumes:** Existing fixed-root historical parsers, current overlay builder,
quarantine admission/publication fences, and post-visible pinned replay.
**Produces:** Separate authenticated historical inventory, strict history-bearing
V2 disposition, and refusal of new public prerequisite publication in the
unrecovered exact-poison store. Ordinary selection still returns current pairs.

- [x] Add a disposable two-generation fixture using the existing original-store
  and overlay helpers: settle the two admitted historical records, advance the
  fixture source, derive a different current pair, and invoke real admission.
  The behavioral assertion is `assert.equal(result.outcome, "returned")` plus
  independent assertions that successor pairs are the new current pair and
  original bytes/identities remain unchanged.
- [x] Run the narrow test before implementation:

  ```bash
  node --import tsx --test --test-name-pattern='historical prerequisite cold recovery' tests/internal-production/baseline-post-handoff-receipt-v1.test.ts
  ```

  Expected initial failure: foreign/unexpected historical shard, not a harness
  setup or Git error. Capture the failure in the local progress ledger.
- [x] Read only the two spec-authorized exact historical locators. Authenticate
  using existing canonical/schema/Git/migration parsers and strict stable
  content-path reads. Keep current descriptor count exactly two. Merge only the
  validated physical inventory for topology checks; never merge selection.
- [x] Bind positive historical records and parent/file identities in a separate
  hashed inventory in strict V2 disposition. Keep V1 zero-history resolver
  behavior. Direct-pin that inventory on cold replay and include it in every
  held-admission/publication stability fence.
- [x] Refuse public prerequisite publication into the unrecovered known-poison
  store before any prerequisite directory/file creation. Private no-write
  builders and selected successor publishers remain available.
- [x] Add genuine behavior negatives: valid but unallowlisted history, changed
  bytes/hash, missing file, file/parent replacement, symlink/hardlink/mode/device
  violation, crossed current/history equality and response-loss replay.
- [x] Run the focused history, existing overlay and committed replay groups;
  report exact command/results. Run `npx tsc --noEmit` and `git diff --check`.
- [x] Root reviews the two-file diff and obtains independent scoped review before
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
- [x] Obtain scoped review of the storage, finding-inventory and epoch-genesis
  prerequisite slices; focused RED/GREEN and type-check evidence is recorded
  below. Combined transport/full-P3 acceptance remains Task 4.

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

Direct-rebind refinement after preselection checkpoint `6c37dc4a`: preserve the
public restart pair/domain and common operation/authorization/startup-token,
stored predecessor/service/generation, target source and UID fields. V1 keeps
its exact launchctl fields. V2 replaces those fields with exact
`transport: direct-detached-node-v1`, `launchProfileHash`, `terminationSignal:
SIGTERM`, and separate maximum termination/spawn counts of one. The logical
action remains the same; schema plus exact transport fields distinguish actual
effects. First add pure strict schema discrimination without switching the
producer or enabling a V2 helper dispatch. Then connect the entire authenticated
transport and typed downstream chain before emitting V2 in ordinary execution.

The operation-bound transport requires separate intent, termination-dispatch,
private termination receipt, spawn-dispatch, child claim and controller
settlement domains. The spawn record must bind the private termination receipt,
not the public predecessor observation that is published only after helper
return. Intent binds the public launch profile, source, epoch, physical lease,
original stored predecessor and startup token; environment plaintext stays only
in inherited descriptor capability. Replacement enters normal operation-bound
startup-token admission, never the cold token/claim/context. Reuse strict
filesystem/runtime-profile/FD mechanics, not cold permission. Versioned public
predecessor/replacement evidence must bind the corresponding private history
through the existing final33 roots. Keep serialized writing and independent
read-only review. File Map paths remain the existing startup/retirement/helper,
spawner/receipt and their owning tests; amend the exact maps if that changes.

V2 schema foundation evidence: actual resolved-record parser initially rejected
the direct body at exact V1 keys; after strict discrimination it accepts exactly
the two unchanged-history/direct shapes and rejects 45 crossed/missing/unsafe
variants. The first full startup suite completed 11/12: an existing status
fixture wrote authoritative files with default permissions, violating the
unchanged 0600 production guard before reaching status validation. Set explicit
0700 fixture directories and 0600 records/pairs; the full unchanged production
guard suite then passed 12/12 (4.540s). Real detached watcher reproduction and
fixed historical helper action passed 2/2 (6.716s), exact145/64 manifest passed
17/17 (6.998s), TypeScript no-emit and whitespace checks passed. Independent
review confirmed V1 equivalence and that the unchanged helper rejects V2 before
journal creation. This is only schema foundation: producer remains V1 and no
direct effect is enabled until the coupled authenticated kernel is connected.

Transport-kernel inputs in progress: extract a shared *structural* historical
launch-profile validator owning exact keys/schema/hash, exact clean-main source
shape and all prior host/executable/environment ancestry rules. The cold wrapper
still binds its own observed source and absence entrypoint. A separate private
direct intent schema binds fixed operation/restart/startup/predecessor/epoch
pair domains, public launch profile, physical lock record/identity, nonce and
the exact direct/SIGTERM/one-termination/one-spawn constraints. Pure parsing is
not an owned capability and does not publish, signal, spawn or grant reuse of
cold authority. The later lease-owning controller must independently resolve
all those immutable relations and retain identities across every effect.

Historical predecessor binding refinement (same receipt source/test File Map):
the helper cannot use the selected current-status reader during a partial
pre-schema dispatch because selection re-enters live progress validation. Add
one operation-only, read-only historical pre-mutation resolver: authenticate
the fixed legacy operation or exact pinned committed successor, then read only
that root's immutable P3 locator and hash-derived V1/V2 record. Retain root,
operation, locator and record identities across awaited authentication, and
recheck the original cold settlement tuple. Never consult current status,
scan, try the opposite root or reconstruct a current service observation.
This explicitly amends the receipt runtime export surface from 57 to 58 (five
named additions); historical ordered53/type26, File Map145/64 and final33 remain
unchanged. P3 alone is historical evidence, not completed preparation or effect
permission. The direct intent must bind this original pre-mutation pair, with
startup/restart/lease authority authenticated separately before any effect.

Historical P3 checkpoint evidence: the missing public reader first failed the
actual legacy fixture. Legacy reading with a malformed current-status locator,
seven strict-successor/root/corruption cases and original cold/P3/operation/parent
identity checks passed. A genuine after-close response-loss injection exposed
one collateral FD leak; attempt-all cleanup then passed with zero descriptor
delta and a rejected result. No ambiguous OS close is retried; a persistent real
close failure can still leak that FD and must keep the future helper fenced.
Expanded historical routing/export/eleven-consumer checks passed23/23 (93.085s),
exact145/64 manifests17/17 (6.766s), TypeScript no-emit and whitespace checks
passed. Independent review found no remaining must-fix in this read-only slice.

Direct input-binding refinement (same startup/retirement source and owning test
File Map entries): V2 restart and private intent require the original P3 pair;
V1 fields remain unchanged. A private read-only resolver authenticates operation,
restart, startup, authorization, original legacy-zero and P3 under the actual
held physical lease, binds audit/source/service/process identities, pins the
stored process-authority and original epoch file across awaits, and checks the
public launch profile plus its hidden environment. Returned data grants no
dispatch authority; no journal, signal, spawn or lease release is reachable.
The future retained kernel must revalidate these original relations before
effects. Input errors keep the caller's lease held and environment plaintext
must remain non-enumerable through serialization.

Input-binding checkpoint evidence: required P3 fields first failed both actual
parsers; the missing under-lease resolver then failed its fixture. Review found
crossed audit/legacy-zero relations and same-byte epoch inode replacement;
both missing rejections were reproduced before fixing them. The actual physical
lease fixture now covers 24 crossed input relations, a cloned lease, process and
epoch inode replacement across awaits, hidden environment and no journal write.
Focused input/lease/V1 refusal checks passed5/5 (2.286s); historical helper and
database-free inert imports2/2 (7.298s); complete startup12/12 (6.176s), exact145/64
manifest17/17 (5.382s), and fresh TypeScript no-emit passed. Independent review
found no remaining must-fix. Direct producer/effects remain unwired until the
retained one-shot transport and runtime routing are connected.

Retained direct-intent preparation in progress (same retirement source/test
File Map): retain the original lease, nonce, resolved input chain and physical
root/epoch/intent ownership before the first publication attempt. Replay may
repair only this original owner's exact immutable intent. Refuse ordinary lease
release before its phase/FD cleanup path whenever direct preparation owns it;
the old V1 parser's rejection alone would leave the disk lock but discard the
held capability. A recognized direct intent also prevents dead-owner cleanup
and terminal helper census. No termination, spawn, claim or terminal-release
path is introduced by intent preparation, and no cold grant is reused.

Intent publication refinement: retain one original read/write descriptor and
one code-owned temporary name for the lifetime of preparation; do not recover
this capability through the shared bytes-only publisher. Complete temporary,
linked and final-only prefixes can resume from that descriptor. Partial writes,
lost creation identity, foreign inventory and replacement inodes retain the
fence. Fsync the original file and parent before/after owned temporary removal;
final-only retry must complete the missing parent sync. Committed replay still
checks the original descriptor and exact pending inventory, including after
opening the separate final pin. No repeated data write or secret publication.
Three missing rejections were reproduced before correction: final-only fsync
loss, equal-byte final replacement, and pending arrival after commitment.
The focused fixture covers twelve write/link/unlink/fsync/response-loss modes,
partial-write refusal and original-FD disturbance; independent review cleared
the intent-only milestone. The complete retirement run finished66/68 (434.814s):
both failures were the existing cold fixture's first-match root-sync injection
moving into the newly inserted publisher. Bind that injection to the unique
cold root-sync/own-prefix boundary; do not change production or expectations.
Fresh failed-two plus direct-intent checks then passed3/3 (4.389s), with exact
manifest17/17 (6.287s), no-emit/whitespace checks and historical helper/watcher2/2
(5.947s) passing. This is not a claim of a fresh complete68/68 rerun; the complete
coupled gate remains required before delivery.

Crash-scope precision: the live retained owner cannot release its physical
lease. If the controller dies with only a temporary and no published journal,
existing dead-owner rules may reclaim the stale physical lock. They leave the
temporary untouched, and a fresh direct owner refuses that foreign publication;
there is no signal/spawn prefix to adopt. Do not equate that durable publication
refusal with a guarantee that the old physical lock survives controller death.

Next executable refinement (same retirement source/test File Map): the retained
original controller performs the single SIGTERM under its physical lease;
the fixed helper remains responsible for the later direct spawn/FD handshake.
The spec requires an authenticated signalling actor, not helper-only signalling.
Bind the actual controller identity in the termination-dispatch, reobserve the
stored predecessor via fresh service census and immediate UID/start/command/
executable/cwd checks, and mark signal entry before the call. Retry never sends
a second signal or converts uncertain dispatch into permission. Only observed
termination admits the private receipt; it is not a helper settlement, spawn
grant by itself or lease-release authority. Keep ordinary V2 emission disabled
until replacement/claim/settlement and runtime routing are connected.

Controller termination kernel in progress (same File Map): private
`terminateDirectSpawnerRebindPredecessorV1(lease, input)` first authenticates the
existing retained preparation. Under that original lease it observes the full
service census and launch profile, checks the actual detached predecessor's
UID/PID/start/service hash, executable command and cwd, then publishes an
exclusive controller-attributed termination dispatch. Reobserve the original
profile/environment after that write and recheck the actual target immediately
before marking signal entry and calling SIGTERM. A lost or failed signal
response admits observation only; a still-present or reused PID cannot admit
replacement. Only positive `ps` absence publishes the private termination
receipt, with truthful `returned`/`response-unknown` signal-call outcome.
The receipt is neither helper settlement nor release/spawn permission.

Termination publication errors are deliberately conservative: original FDs and
lease stay owned, but a partial/unsynced dispatch or receipt is not repaired or
admitted. Do not claim resumable publication recovery for these records. A fully
published receipt replay checks original descriptors, bytes, inventory and
preparation again. All runtime functions remain private/unwired; external
history parsers and direct helper/child runtime routing must precede V2 emission.

Kernel test evidence so far: missing implementation first failed the genuine
detached-process fixture. The fixture now uses real signals, `ps`, `lsof`, cwd,
physical lease and stored predecessor bytes; only independently tested source/
receipt observation ports are controlled. A real output-file mutation after
dispatch write then reproduced a missing final-profile rejection before the
additional check. Ten fresh-census field crosses reject without any signal;
response loss sends exactly one SIGTERM; ignored SIGTERM preserves the fence
and retry remains observe-only. An explicit fixture-owned stop channel permits
test cleanup without adding a production signal fallback. Dispatch/receipt
write failures preserve exact original files and refuse retry; pre-effect
signal failure cannot become a second syscall. No live service was signalled.
Final focused kernel4/4 passed (24.127s), prior lease/V1/cold-boundary checks6/6
(3.161s), exact145/64 manifest17/17 (5.299s) and fresh no-emit/whitespace passed.
Independent scoped review found no remaining must-fix. Whole-branch/P3 gates
remain deferred until the direct helper/child/settlement chain is connected.

Configuration routing amendment (existing retirement/runtime-config and owning
retirement/owner-admission tests; paths remain145/64): add exactly one zeroarg
`resolveInternalProductionSpawnerInheritedRuntimeSnapshotV1` configuration port,
retirement exports26→27. It selects mandatory authentication from the exact
entrypoint and original bounded FD3 frame; preserve original bytes/descriptor
identity and fail permanently after unknown, crossed or revoked selection.
Cold helper/child APIs stay cold-only. Direct frame families remain refused
until their own authenticator is connected, never delegated to a cold grant.

Runtime configuration consumes that single role-discriminated snapshot and
requires exactly one matching code-owned marker: COLD_HELPER, COLD_CHILD,
DIRECT_HELPER or DIRECT_CHILD under the SETFARM_INTERNAL_PRODUCTION_ prefix.
Markers alone, mixed markers, unknown markers and markers introduced by ordinary
dotenv cannot choose authority. Authenticated modes retain the exact normalized
environment without dotenv reads; ordinary mode retains its existing precedence.
Use one private inherited-runtime configuration error family in place of the
two cold-only errors. Future direct helper runner/child lifecycle exports require
their own explicit contract amendment; they are not implicit in this27-name port.

Configuration checkpoint evidence: process/dotenv direct or unknown markers and
mixed markers alongside an authenticated cold helper reproduced acceptance
before the shared selector. Independent review then found selection refusal
could leave the underlying child grant live; a genuine child entry-restore test
reproduced that hole. Shared refusal now revokes the retained child authority
and closes any retained helper context, retaining failed cleanup for retry.
Real entry and original-FD3 restoration cannot revive the old cold ports;
helper entry restoration likewise leaves its original context closed. The
configuration-only snapshot hides environment from enumeration/serialization.
The late-output regression runs before independent environment-drift refusal,
so its dependency mutation actually exercises authentication rather than an
already-refused configuration cache. No production instrumentation was added.

Focused direct-frame refusal plus exact27-export/lease checks2/2 (1.870s), real
cold helper/child configuration3/3 (28.390s), then expanded helper and FD3/entry
restoration2/2 (8.839s), ordinary/output/frame/inert-negative checks19/19
(18.080s), manifest17/17 (5.712s), actual inert import1/1 (0.979s), gateway PATH
source check1/1 (1.851s), fresh no-emit and whitespace checks passed. Independent
re-review reports no remaining must-fix. This is scoped configuration evidence,
not a whole-branch/P3 pass or permission to emit the unfinished direct V2 path.
The genuine fixed cold helper → sealed main integration also passed1/1
(35.993s); no live service or database was involved.

Next private direct-helper input slice (same retirement source/test File Map,
no export/145/64 amendment): first strictly parse the actual retained termination
dispatch and receipt against the original direct intent and authenticated P3
predecessor. Then issue an unlinked FD3 frame carrying the original intent,
dispatch and receipt pairs plus full physical identity tuples, original lock
identity, nonce and environment. FD4 remains the borrowed physical lease;
FD5 is the read-only original intent. Frame preparation alone does not dispatch
or create a helper grant. The later exact-entry direct authenticator must
independently re-read history/profile, controller parent and all original pins
before the existing shared configuration port can expose a direct snapshot.
Keep direct roles refused until that authenticator is connected. Both dispatch
and receipt identities are necessary: the receipt hashes the dispatch pair,
not the dispatch inode. No cold context or launchctl permission is reused.

Private transport implemented: strict65KiB canonical dispatch/receipt parsing
binds actual controller, P3 target, intent, SIGTERM counts and truthful outcome.
Original intent/dispatch/receipt physical pins and the lease/epoch are checked
before producing the13-key frame. An actual inherited child proves FD3/FD5 are
read-only, FD3 is unlinked, and nonce/environment and both termination pairs
arrive intact. Original authority file bytes/metadata remain unchanged; only
the parent timestamps reflect the owned empty scratch create/unlink. Same-byte
replacement of each of the three authority files refuses before frame creation.

Review reproduced two transport holes: mutation at writer close escaped the
earlier final reader check, and lost-close response could cause numeric FD reuse
to be closed. Recheck frame metadata/bytes/EOF after writer close and authority
checks. Mark every close attempt before its syscall. EBADF proves the number
absent; a different inode is disowned without closing. Same-inode equality after
an uncertain close is NOT open-file-description identity: never close it again.
This deliberately retains a fence until absence/different-identity observation
or process exit. A test knows its injected pre-effect failure occurred before
close; production does not. Therefore the fixture owner explicitly closes that
known original handle before demonstrating cleanup completion. A separate real
same-inode reopen proves the foreign handle survives until its fixture owner
closes it. No retry guard or safety assertion was weakened. Unknown initial
descriptor identity likewise remains fenced, not guessed.

Both parser and issuer first failed for missing implementation. The expanded
actual termination/transport fixture covers self-rehashed relation crosses,
late mutation, before-write/short-write, before-close/persistent-close, lost-close
response, different-file reuse and same-inode reopen. Configuration still
refuses direct helper/child roles; no direct authenticator or grant is claimed.
Final scoped kernel/transport/lease/role checks7/7 passed (32.614s), exact manifest
17/17 (6.038s), actual startup-family inert import1/1 (1.215s), fresh no-emit and
whitespace checks passed. Independent final review reports no remaining must-fix
in this issuer, including the explicit ambiguous-close availability tradeoff.

Direct-helper authentication refinement (same source/test/runtime-config File
Map and27-export boundary): factor the existing immutable evidence body into a
private resolver accepting only input pairs, expected epoch and a code-owned
original-authority assertion. Controller wrapper retains its real held lease
and own-PID check; helper wrapper supplies inherited FD3/4/5, exact compiled entry,
controller-parent and original termination pins instead. Do not register helper
objects in the controller lease map. Keep all await brackets, stored process
pin, final P3 reread, hidden environment and local-reader cleanup. Only after
direct authentication succeeds may the existing shared configuration port return
the direct-helper role. Direct-child and process dispatch remain unavailable.

Direct-helper authentication now runs in a genuine compiled child of the retained
controller with original inherited FD3/4/5. It separately pins termination files
and epoch, resolves the original operation/startup/restart/legacy/P3/profile
chain, checks controller PID/start/UID and actual parent relation, and freshly
observes predecessor absence. No helper lease object is manufactured. Shared
evidence owns only its own fixed-root/process/epoch readers; its callback retains
the distinct controller or helper authority across every await.

Review-driven RED→GREEN corrections: after-acquire actual output mutation was
accepted by cached helper authentication; retain actual host identity tuples and
original Node descriptor/metadata/bounded initial byte hash, and verify the
complete real output manifest on subsequent snapshots. A late acquisition could
return after permanent revocation; recheck refusal flags after await and close
the late result. Both held and still-active authentication could fall through an
ordinary-entry/absent-FD3 path; include active/held/refused state in every ordinary
null predicate and revoke on rejection. The actual pending test removes its
mode marker, changes entry/FD3 and attempts a real runtime-config import with a
dotenv sentinel: ordinary configuration must not load. Parent UID mismatch also
reproduced a missing rejection before the fresh ownership check was added.

The helper fixture now compiles its static graph before intent preparation and
builds real BUILD_INFO/output-tree/release-manifest files and host/Node identity
tuples. Output verification is the real production leaf, not a mocked hash
acceptance. Independent immutable receipt ports remain controlled. Its28 cases
cover positive config, early/pending/revoked configuration, actual intermediary
parent, UID, argv/cwd/FD crossing, missing/mixed markers, immutable relation
crosses, late entry/frame restoration, actual output/host mutation, and same-byte
dispatch inode replacement during awaited profile observation. Borrowed lease
and intent descriptors survive; no signal/spawn/publication is emitted by helper
authentication. Context disposal and snapshot refusal remain permanent. The
eight earlier transport-close fault cases preserve their explicit conservative
unknown-close fence; helper-owned file readers use the same no-second-close
rule. Direct child and spawn/claim/settlement integration are still pending.
Final scoped combined retirement gate12/12 passed (112.568s), including the
genuine fixed cold helper→sealed main and original cold descriptor-chain cases.
Manifest17/17 (6.031s), ordinary/untrusted-mode/inert-import checks3/3 (2.670s),
fresh TypeScript and whitespace checks passed. Independent final review found
no remaining must-fix in this authentication delta. It does not approve the
still-unimplemented direct child or dispatch/settlement path and is not a full
receipt/P3 gate claim.

Next direct dispatch slice (same retirement source/test File Map,27 exports):
the authenticated helper exclusively publishes `spawn-dispatch.json` binding
original intent and termination receipt pairs and full physical tuples, actual
controller/helper identities and exact Node action. It creates a private unlinked
child frame; FD4 remains borrowed and FD5 now names the read-only spawn dispatch.
Use monotonic authenticated→publishing→dispatch-owned→handed-off phases; uncertain
publication/close permanently revokes, existing files never confer new ownership,
and handoff is consumed before returning. Authentication retains cleanup ownership
of newly created descriptors. Split original evidence pins from the one explicit
directory metadata transition, then retain the final three-file root snapshot.
Fault tests use genuine helper processes/disposable authority and must prove no
actual spawn, no ordinary/cold fallback, no second publication or handoff, and
preserved controller lease. Direct child authentication/claim and real process
dispatch remain the next coupled integration, not acceptance of Task6A.

Private dispatch/handoff is implemented. The real compiled helper publishes a
controller/termination/intent-bound dispatch with its actual identity, owns both
read-only child descriptors, and consumes the handoff before returning. No actual
replacement process is started. A fresh helper presented the original inherited
frame cannot adopt the existing dispatch. Eighteen scenarios cover success,
one-use handoff, exclusive collision, partial write, file/parent fsync, unknown
writer-close response, different-file/same-inode FD reuse, second publication,
same-byte dispatch/termination swaps, output drift, foreign scratch and frame
mutation at writer close. Cleanup retains uncertain same-inode close outcomes;
the fixture owner, never production, explicitly closes known injected handles.

Review reproduced a confidentiality failure: parent-fsync-boundary writer reuse
sent695 frame bytes into a foreign linked file before post-write rejection.
Both original empty unlinked FDs are now rechecked immediately before the first
secret write. A second RED showed final output checking could add/remove an
unrelated root member and have the changed metadata adopted. Capture the final
root tuple immediately after the last owned unlink, before fsync/observers, and
require it through publication and handoff. Both focused regressions are GREEN.
The same pre-write gap exists in three older cold/direct transport issuers;
address those as the next causal root fix in these same File Map members.

The expanded actual-process fixture also caught an APFS directory race: the
original fixture root had nlink10 at lstat and11 at fstat while the SIGTERM handler
created its signal file. Pre-create disposable signal/stop channels before
authority capture; subsequent writes change bytes, not directory membership.
Keep every production directory check unchanged. The final coupled focused gate
passed16/16 (178.193s), manifest17/17 (6.016s), ordinary/refused/inert imports3/3
(2.737s), no-emit and whitespace checks. Independent new-dispatch review reports
no remaining must-fix; this is not full receipt/P3 or Task6A live acceptance.

Shared-issuer causal refinement (same retirement/test File Map, no export change):
the new direct-child fault exposed the same unchecked first-secret-write window
in `openDirectSpawnerHelperFrameV1`, `openColdSpawnerHelperFrameV1`, and the cold
helper's child-frame publisher. Add one private original-empty-unlinked-FD
assertion after parent fsync/authority checks, immediately before each write.
Cold frame-only cleanup must retain original identities and mark close entry;
disown reused foreign FDs, fence uncertain same-inode closes, and never pass
these frame handles to blind generic cleanup. Leave unrelated descriptor cleanup
semantics unchanged. Regression scope includes both writer/reader reuse, empty
foreign-file preservation, original lease fencing and response-loss cleanup.

All four issuers now use the shared private empty-transport assertion. Before
fixing, cold-controller writer reuse put583 bytes in a linked foreign file, cold
child writer reuse likewise disclosed its frame, and direct-controller reuse
reached the first secret write. Writer/reader reuse now refuses before that write;
foreign descriptors remain open. Cold frame-only tracking registers unknown
identity before fstat and uses one conservative close function for normal and
cleanup paths. Same-inode reopen after a lost close response remains fenced until
the fixture owner closes its foreign handle. Other resource cleanup is unchanged.
The updated earlier pre-effect fault tests explicitly dispose their known original
handle before observing EBADF; production never assumes the close did not happen.

Focused transport/cleanup checks passed7/7 (22.241s); independent review found no
remaining must-fix. The full retirement file ran to completion:80/81 passed
(571.075s). Its one failure was an obsolete `COLD_CHILD_CONFIGURATION_INVALID`
test expectation left by the earlier shared runtime-code amendment, not accepted
startup drift. Correct both remaining expectations to the exact shared
`INTERNAL_PRODUCTION_INHERITED_RUNTIME_CONFIGURATION_INVALID`; the failing test
then passed all eight actual-child cases1/1 (15.682s). This is NOT a fresh81/81
whole-file claim. Manifest17/17 (7.148s), ordinary/refused/inert imports3/3
(2.828s), TypeScript no-emit and whitespace checks also passed. No live mutation,
DB action, direct child launch, full receipt/P3 acceptance or Task6A completion.

Next direct-child boundary (same retirement/test File Map,27 exports): keep
synchronous inherited configuration authentication separate from asynchronous
startup admission. FD3 binds the original spawn dispatch; FD4 is the controller
lease and FD5 its original read-only spawn dispatch. Pin fixed intent, termination
records, epoch, host/Node/output and actual helper/controller/child parent chain.
Split structural termination parsing from independent P3 binding; never synthesize
a P3 observation for the synchronous path. After configuration, resolve original
immutable P3/startup/source evidence under those original pins before any singleton,
PID, claim, readiness, DB or provider effect. A changed selected latest token must
not substitute for the original intent's content-addressed token. Keep the actual
spawner startup/claim implementation as the next coupled step; its eventual
zero-argument asynchronous context factory supplies the necessary admission seam,
not another configuration-only grant or cold authority exception.

The real launch-environment leaf exposed a causal input bug: its frozen
null-prototype dictionary was rejected by the direct evidence consumer's
Object.prototype-only check. Reproduce with the actual leaf (not structuredClone
of its result), accept only null/Object.prototype, and retain the arbitrary
prototype negative. RED reproduced `direct rebind environment is crossed`;
shared-kernel and genuine helper focused checks then passed2/2 (16.227s).
Same retirement/test File Map; no new file, public export or runtime override.

The private direct-child configuration/admission slice now retains original
FD3/4/5, exact three-member dispatch prefix, original intent/termination/epoch
readers, physical host/Node/output and the live parent chain. Async admission
resolves independent original P3 and token evidence before any startup effect.
The genuine three-process fixture begins without secret/PG environment values;
FD-only configuration and original admission passed1/1 (5.936s). An early refused
admission regression then proved a missing ordinary-fallback fence (RED: missing
expected exception); permanently failed direct-child state now refuses at the
shared configuration dispatcher before any ordinary selection. Negative gates
are in progress; do not count this as actual spawner-main/claim or full P3 proof.

Direct-child configuration/admission checkpoint: the full retirement file ran
to completion,83/84 passed (607.006s). Its sole failure expected the old disabled
direct-child branch's error text; the actual new authenticator correctly refused
the unauthenticated frame. Update only that expectation. The failed test plus
the three direct-child groups then passed4/4 (36.726s), including crossed P3/token,
same-byte intent replacement, concurrent admission, revocation during await,
early ordinary fallback refusal and borrowed FD4/5 survival. This is not a new
84/84 whole-file run. Manifest17/17 (5.609s), ordinary/refused/inert imports3/3
(2.601s), TypeScript no-emit and whitespace checks passed. Independent final
scoped review found no remaining must-fix. Runtime exports remain27.

Epoch authority here binds original content through its exact epoch pair, then
pins the child-observed inode. It does not claim the child inherited the
controller's epoch inode. Subsequent effect wiring must retain the parent's
original epoch checks through dispatch and completion. The next coupled slice
connects actual spawner startup/claim; helper execution, controller settlement,
downstream V2 production and complete release remain pending. No live mutation,
DB/schema action, full receipt/P3, clean-main rollout or Task6A acceptance occurred.

Ledger reconciliation at this checkpoint marks only previously proven scoped
work complete: Task1 (`cf34ae9a`), prerequisite reviews, startup ownership
(`fe137081`), exact cold PID residue (`fff4af81`), cold release/settlement and
V1/V2 predecessor binding (`49eaaccb`). Split mixed cold/direct requirements so
the unfinished direct lifecycle and every Task4 live/combined gate remain open.

Next coupled actual-main/claim slice (existing retirement, spawner and owning
retirement-test File Map): expose only the zero-argument asynchronous
`acquireInternalProductionDirectSpawnerChildStartupContextV1()`, returning the
admitted context's `publishClaim()` and `close()`. The private configuration
reader still cannot grant startup. Add the zero-argument main-owned
`observeInternalProductionDirectSpawnerStartupOwnershipV1()`; runtime namespaces
become retirement28/spawner18, with no new manifest path or historical ABI hash.

- [x] Extend the genuine direct fixture with copied actual main/owned-file
  functions and original FD3/4/5 plus readiness FD6. First reproduce absence of
  the direct startup branch; observe no ordinary admission/provider/DB effects.
- [x] Register direct stop handlers before awaiting admission. Create absent-only
  owned singleton/PID files after admission, never use cold residue or generic
  stale-file reclamation. Preserve original file ownership through cleanup.
- [x] Publish one exclusive canonical direct claim binding original intent,
  dispatch, operation/startup token, source/epoch, live child and startup-file
  ownership. Record attempt before publication, preserve uncertain history,
  retain original readers and recheck the full post-create directory tuple.
- [x] Permit helper-to-pid1 parent transition only after the owned claim and
  fresh original-helper absence. Send bounded canonical readiness only after
  claim and registered stop/owned-file checks; remain pre-database sealed.
- [x] Prove P3 refusal before files, stop during admission/claim, foreign startup
  residue, duplicate/uncertain claim, original-file replacement and helper
  departure. Update both actual-main extraction fixtures and exact exports;
  verify focused tests, type/source contracts and independent review.

Production helper spawning/claim observation and controller/downstream terminal
settlement are the following coupled work; this slice must not enable V2
authority emission or a live launch by itself.

Actual-main implementation evidence: the first real-main fixture refused at the
old cold-only branch. Three boundary regressions then reproduced retained
configuration after invalid readiness, root churn accepted before claim create,
and3321 claim bytes written through a reused foreign descriptor. The fixes admit
the cleanup-owning context before inspecting readiness, recheck the original
full directory immediately before exclusive create, and recheck the original
empty writer immediately before writing. Actual main plus the three regressions
passed4/4 (21.733s). P3 drift, stop during admission/claim, foreign PID residue,
and concurrent claims passed5/5 (26.080s); the residue fixture was then tightened
to the actual dead predecessor PID with0644 mode, preserving its inode and bytes.

Claim ownership is established only after durable reopen/close and the final
original-pin, output and startup-file checks. Helper departure before that point
fails closed; the helper must wait for authenticated readiness. Only the owned
claim allows fresh original-helper absence plus actual child PPID1. Independent
review accepted this conservative boundary. A later test review found two
fixture gaps: early parent assertions could orphan the real child, and generic
negative rejection could conceal forbidden ordinary calls. The helper now
records its actual child's process identity before readiness for outermost exact
cleanup, and admission/provider/database counters must remain zero in all modes.
The full retirement run started before those two test-only amendments and passed
93/93 (678.938s). The final amended actual-main groups then passed9/9 (46.189s).
Manifest17 plus gateway109 passed126/126 (7.202s); ordinary/refused configuration,
inert imports and both prior sealed-startup gates passed5/5 (47.675s). TypeScript
no-emit and whitespace checks passed. Independent final scoped review has no
remaining must-fix. This is a verified startup/claim checkpoint, not helper
transport completion, full receipt/P3 acceptance, a build or live Task6A proof.
Live Mission Control API and dashboard both returned HTTP200; no live mutation.

Following coupled helper slice (same retirement/helper/tests File Map): add a
strict private direct-claim parser, then let only the original one-shot helper's
retained ChildProcess and authenticated readiness adopt the fourth journal
member. Do not relax the ordinary three-member gate. Retain original frame,
intent, termination, dispatch, epoch, host/Node/output and controller pins;
authenticate the exact child, both owned startup files, claim bytes/inode and
the readiness-bound full journal identity before completion. A zero-argument
fixed direct-helper runner owns spawn/readiness/cleanup and permanent attempt
state. Route the compiled helper before historical V1 without changing V1
semantics. Unknown/mixed selectors, response loss, replaced records and a second
attempt refuse without redispatch. Controller settlement and downstream V2
emission remain disabled until their own original-history integration passes.

The actual fixed direct-helper fixture first reproduced the missing route:
its valid direct capability reached historical V1 and failed frame shape. The
new direct route and one-shot runner now authenticate configuration, publish
the original dispatch, hand off only fixed FDs3/4/5 with readiness FD6, retain
the actual ChildProcess, and validate the strict direct claim before completion.
The private parser rejects rehashed crossed top-level/process/startup-file
members and noncanonical bytes. Runtime exports become29; helper exports stay
zero. No new File Map path or frozen hash changes. The older cold wire fixture
now scopes its completion-write instrumentation to the cold branch explicitly.

Review/REDs exposed two missing original-ownership checks: startup directory
replacement with a symlink to the original files, and same-byte PID inode
replacement during a final output verification. Retain the fixed runtime parent
identities before any dispatch and retain child/startup assertions with the
owned claim. A third executing RED placed the directory swap during the final
runner verification; directory checks now live in the original-pin bracket,
not only before output validation. Normal helper and all three regressions
passed4/4 (23.413s). The helper owns no cold residue permission and accepts the
fourth member only through its own retained child plus canonical readiness.

The 18-case actual-helper matrix passed1/1 (93.696s), covering fragmented/empty/
truncated/oversized/duplicate/extra/noncanonical/cold-crossed/hash-crossed wire,
journal ABA, same-byte claim/PID replacement, wrong child PID, spawn failure,
second invocation and mixed/invalid/missing selectors. Each actual effect entry
records its fixed executable/argv/cwd/environment/FD projection; second calls
never add an entry and selector refusal adds none. Separate no-EOF timeout,
child exit before EOF and interrupted cleanup passed1/1 (21.288s). The no-EOF
fixture shortens only its copied timer and proves that the timer actually fired;
cleanup uncertainty never yields success. Fresh coupled regression gates and
final independent review are still required before this helper checkpoint.

Final coupled gate completed10/12 (195.465s): all direct groups, original direct
authentication/handoff/admission and exact exports passed. Both failures were
old cold fixture transforms broadened by the added direct branch: a spawn-error
marker now matched twice, and the cold completion preamble was inserted into
the direct branch. Scope the transforms to the cold runner/branch with exact
single-target checks. A new direct-output assertion separately reproduced
noncanonical completion JSON; the fixed helper now writes the existing canonical
serialization plus one newline, leaving historical cold output unchanged.

The targeted rerun passed direct canonical completion and cold controller-wire
recovery2/3 (77.007s), but the old cold no-EOF test sometimes expired before its
fault even executed. Named sequential cold cases then passed20/20 (within a
26/26 diagnostic gate,42.604s). Do not dismiss the intermittent failure: an
isolated no-EOF test now deliberately delays the real child write1.5s. RED
reproduced the premature1s fixture timeout; a copied5s timer permits the write
and requires separate actual-wire and timer-fired witnesses. GREEN1/1 (7.368s).
The production30s timeout is unchanged. The table retains the other19 cases;
its new names make individual failures visible and allow later cases to run.

Source manifests17/17 (5.936s), historical helper/ordinary/refused/inert gates4/4
(10.458s), final TypeScript no-emit and whitespace checks passed. Independent
production review found no remaining material issue. Final timing refinement
records the helper's retained byte count at timeout in both direct and cold
fixtures and requires a safe integer in1..4096: a pre-write marker alone cannot
prove the no-EOF boundary. Both final timeout/exit/cleanup groups passed2/2
(29.307s), TypeScript no-emit and whitespace checks passed, and independent
test review found no remaining blocker. This is not a fresh12/12 aggregate
claim or a whole-file run. The subsequent final coupled rerun passed32/32
(224.180s): all direct helper groups, original direct authentication/handoff/
admission,19 named cold helper cases, delayed cold EOF, cold controller wire
faults and exact retirement exports. This completes the scoped helper checkpoint.
Controller invocation/settlement, downstream V2 emission and terminal physical
release still remain before full receipt/P3 or live Task6A acceptance.

Next coupled controller/downstream work (approved design, serialized root
writer; read-only inventory/review may run in parallel): keep the existing
two-argument public helper invocation and returned helper-settlement pair.
Discriminate restart authority internally: persisted V1 remains unchanged;
only fresh startup emits V2 after all direct lifecycle consumers pass.

File Map for this next slice is exactly the existing retirement, startup
admission and receipt modules, their three owning tests, and this plan. Keep
retirement30/startup11/receipt58 runtime exports, exact145/64 manifests and the
33-pair final graph. Helper/spawner/runtime-config need no planned new edit.

- [x] Add private direct controller completion capture. Test a disposable real
  ChildProcess.stdout, not a manufactured stream: canonical direct11-key output succeeds only
  after EOF and clean actual helper exit; fragmented output succeeds; empty,
  oversized, duplicate, noncanonical, crossed-schema, nonzero exit and missing
  EOF refuse. Bound capture and retire pipe/timer listeners on every outcome.
  The fixed35s timeout lives inside capture and uses its idempotent finish;
  account for both EOF/exit orders and already-observed clean/failed exit.
  Late events cannot alter a settled outcome. Capture closes no authority FD.
  This parser is transport evidence, never claim or dispatch authority.
- [x] Extend retained direct intent with monotonic intent-only,
  helper-may-have-run, claim-observed, settled and releasing phases. Retain
  original frame/intent descriptors immediately, borrow only the held lease
  descriptor, and mark possible effect before the single fixed helper spawn.
  Retry awaits that same ChildProcess/completion; no replacement invocation.
- [x] Independently authenticate the exact four-member direct journal and
  original top-level intent, termination records, spawn dispatch and claim.
  First extract a private strict spawn-dispatch history parser from the existing
  child checks: consume original intent and termination record bytes, require
  canonical bounded dispatch, original content pairs/identity tuples, fixed
  action and helper process identity. Test actual helper-produced bytes plus
  self-rehashed top-level/nested/identity mutations. Use it in the actual child
  without removing inherited-FD, frame, runtime or independent P3 checks; it
  confers neither filesystem ownership nor current process liveness.
  Bind completion inode tuples and the retained helper PID; require helper
  clean exit/absence and the exact claimed child at PPID1. Recheck original
  startup files, directories, P3, profile/output and physical lease around reads.
- [x] Publish a direct controller settlement in the existing content-addressed
  pre-schema-helper-settlements directory with the existing
  pre-schema-spawner-rebind-helper-settlement reference domain, outside the child's immutable journal.
  Bind the original history and two equal ordinary four-service observations;
  their spawner is the retained claim and other services equal original P3.
  Preserve no-replace publication/fsync/close progress across response loss.
- [x] Release only the same committed terminal owner. Retain per-resource close
  progress, authenticate original descriptors, then exact lock unlink/fsync and
  original lease close. Preserve history. Complete authenticated historical
  terminals may authorize dead-owner cleanup without claiming child liveness;
  partial/ambiguous history must preserve the fence and cannot redispatch.
- [x] Route strict V2 through the existing public invocation. Fresh-process
  partial direct history returns HELPER_DISPATCH_SETTLEMENT_UNKNOWN. Complete
  terminal history returns the same pair without process effects. Keep V1
  byte/behavior identity and cover both with existing adoption/reclaim tests.
- [x] Add the private read-only direct terminal history resolver before routing:
  exact original intent/four-member journal, historical operation P3, derived
  completion/census/CAS record and stable physical witness; no live child or
  current lease/epoch required. Public adoption stays unchecked above.
- [x] Emit fresh startup V2 from original operation P3 and authenticated launch
  profile; persisted V1 calls no new direct port. Persisted V2 reauthenticates
  exact original pairs, constants/source/startup/predecessor without downgrade.
  Startup-owning slice implemented: fresh V2 binds historical operation P3 and
  the authenticated profile hash; recovery preflight, held-lease replay and
  observed-material replay discriminate transport. V1 loads neither direct
  port and retains its exact record/pair bytes. The receipt-side physical,
  nested and final-graph consumers are now covered below. Helper census and
  whole-gate integration remain pending; live rollout remains prohibited.
  TDD first exposed V1 emission (session6077). Independent review then found
  two causally required prepublication fixes in the same File Map: reauthenticate
  P3 after the profile await (RED61114), and compare the restart/startup
  predecessor process pair before completing a recovery temporary (RED56533).
  Both now refuse with preserved publication boundaries. Final startup suite
  passed12/12 (session51518,5.831s), including13 evidence-drift variants in both
  recovery and observation, exact V2 pair reuse, the two review regressions,
  and two byte-preserving historical V1 replays with invalid direct evidence
  and zero calls to either new port. TypeScript no-emit passed(session37537).
  Independent localized re-review found no remaining substantive issue.
  Source manifests passed17/17(session71010,5.860s); whitespace passed.
  Receipt nested/physical follow-on: the typed nested reader admits exactly
  restart V1 or V2 in the same pair domain; retained and response-loss physical
  readers share one private transport validator. V2 joins original P3, derived
  predecessor/source and profile, with original physical-owner fences around
  P3/profile/P3 awaits. V1 returns before all new direct ports and fences.
  Actual nested-reader RED11149 became GREEN42931. Actual physical-reader
  RED87423 became GREEN90129. Independent review required non-confounded
  profile UID/source/hash tests and actual member/parent generation replacement
  at every new await; final owning cases passed2/2(session41738,18.670s), each
  exercising8 semantic cases and6 same-byte physical replacement cases, exact
  subsequent-call cutoffs, zero descriptor delta and no reader writes.
  The wider V1 matrix first exposed an added fence changing its original final
  refusal boundary(session80146); keep that extra entry fence V2-only rather
  than changing the fixture's expected count. Full scoped rerun passed5/5
  (session25676,259.775s), including the entire unchanged V1 physical matrix,
  nested V2/V3 discriminator, both tightened V2 physical matrices and structural
  contract. No test was stopped early and no V1 expected count was relaxed.
  Final no-emit passed(session7515), manifests17/17(session21912,7.527s),
  whitespace passed; localized independent re-review found no new issue.
  Final startup compatibility rerun passed12/12(session29777,5.399s).
  Final33-pair V2 integration first failed at the actual old transport relation
  (session31528,2/2 RED). It now authenticates the selected graph P3 against
  historical P3, profile and final P3 reread, retaining cold-history physical
  fences across every new await. Both ordinary and cold predecessors verify
  and replay the same pair. Four non-confounded evidence negatives refuse
  before publication and on published replay without writes; three actual
  same-byte cold-terminal inode replacements refuse at their await boundary.
  V1 ordinary/cold verification and replay call neither new evidence port.
  Independent review tightened profile-hash negatives to valid alternate
  self-hashed profiles, separately from invalid canonical-hash cases.
  Final combined physical/final-graph regression passed10/10
  (session16382,99.243s), final no-emit passed(session66618), manifests17/17
  (session72657,7.032s), and localized independent re-review found no issue.
  No public keys, runtime exports or graph pairs were added. These scoped
  checks do not constitute complete receipt/P3, clean-main or live acceptance.
- [x] Bracket phase-zero with stable helper census: absent or fully authenticated
  terminal only; partial, appearance/disappearance and ABA refuse. Require
  terminal explicitly at all cutover/zero-owner guard consumers. Preserve the
  exact ten census keys and existing final pair graph.
  Compatibility scope: cross-observation physical ABA protection here applies
  to new absent/direct witnesses. Legacy V1 retains its documented logical
  retained-set/census hashes, including fresh observation after valid same-byte
  replacement; the normal registry likewise retains its existing logical
  contract. Private legacy file identities fence each newly asynchronous census
  call without migrating stored guards. This slice does not claim a new
  cross-call physical identity contract for legacy settlements or the normal
  registry. No legacy hash migration or extra public witness key is introduced.
  Implementation: absence authenticates the nearest existing private ancestor,
  rejects journal temporaries/direct prefixes, and hashes physical generation.
  Strict schema discrimination routes direct terminals through the independent
  original-P3 history reader and its synchronous physical witness. Direct
  completion/termination/settlement identities enter the private retained-set
  projection. Registry traversal is bracketed by closure stability checks;
  legacy and direct histories cannot coexist under one pre-schema journal.
  RED absence failed at ENOENT; after correcting the fixture's preseeded epoch
  directory, absence and creation/deletion ABA passed. Real departed-child
  direct census first failed the legacy shape parser(session77822), then passed
  with exact ten keys, zero counts, stable replay, every crossed terminal field
  refusing, and changed witness for equal terminal replacement(session14912).
  Independent review found a new legacy await window; actual same-byte journal
  and settlement replacements reproduced acceptance before private identity
  fencing. Legacy/direct coexistence independently reproduced acceptance first.
  Final three-case initial regression passed(session88456,10.436s).
  Three retirement consumers independently reproduced acceptance of absent
  state with unchanged counts and bound guard hash(session32334,3/3 RED).
  Receipt guard producer/consumer similarly reached the publication sentinel
  before explicit state checks(session45986,2/2 RED); terminal positive controls
  reach the same boundary, while absent calls publish nothing. The executing
  phase-zero fixture first accepted partial helper history(session90210 RED),
  then covered late appearance and ABA with the cold census isolated so it
  cannot mask missing helper checks. Review found future authority appearance
  during the final helper await(session7128 RED); repeat its absence checks
  afterward, then compare cold/helper evidence and revalidate source.
  Receipt scoped regression passed4/4(session91782,2.754s); no-emit passed
  (session10081), manifest17/17(session55111,7.114s). Localized independent
  final review found no remaining substantive issue under the compatibility
  qualification above. Final retirement/cutover combined regression passed15/15
  (session55554,71.897s), including seven original-history fault cases and the
  unchanged one-way cutover matrix. Its initial run had14/15: the new prepare
  test incorrectly expected its lock parent's timestamps not to change during
  ordinary lock acquire/release. Permit only that exact parent's clock change;
  all file identities/bytes, directory inventory and other metadata still match.
  No production guard or preexisting expected count was relaxed. Whitespace
  passed; live Mission Control/dashboard HTTP200/200. No live mutation occurred.
- [ ] Run focused controller/history/release and startup/receipt regressions,
  manifest/no-emit, independent review, then complete receipt and P3 gates.
  Clean-main build/rollout and live A acceptance remain later required outcomes.

Controller completion boundary evidence: the actual-declaration fixture first
failed because capture was missing. The decoder then passed real pipe behavior,
while its first cleanup assertion incorrectly counted Node's pre-existing end
listener; tests now require removal of only newly owned listeners. Independent
review reproduced a genuine already-closed-child leak with a RED real-process
case. Install the temporary child error sink only while exit/signal remain
unobserved, retaining it until actual close. GREEN19/19 (3.797s) covers both
EOF/exit orders, closed child,17 transport cases and parent accounting. Five
separate natural-exit consumers use the original35s timer and a5s watchdog to
prove timer cancellation after success, nonzero exit, oversize, empty and
malformed output. Manifest17/17 (5.836s), TypeScript no-emit and whitespace
checks passed. Final independent scoped review has no remaining finding.
The final capture/actual-helper/exact-export coupled gate passed21/21 (10.014s).
Invocation/claim/settlement/release are still unchecked above; this private
decoder adds no export and cannot authorize any process or physical lease effect.

Strict direct spawn-history extraction: the actual helper fixture first failed
on the missing parser (6.882s). The pure parser now authenticates original intent
and termination bytes, exact bounded/canonical dispatch and hash/reference,
fixed action, controller/helper relations and ten-slot publication identities.
Review found overlapping publication inodes were not explicitly refused; a
self-rehashed actual-record mutation reproduced that acceptance (6.972s).
Require three distinct device/inode pairs. Final real child/main/helper and
exact-export gate passed4/4 (20.107s); prior negative selector/P3/admission gates
passed5/5 (34.007s). All tuple slots, constrained metadata, overlap pairs, direct
hash/reference corruption and wire defects are covered. TypeScript no-emit and
whitespace checks passed; final independent extraction review has no finding.
Child original FD/frame/epoch/profile/live-parent/P3 checks remain in place.
The parser may read terminated historical helper identities; only the future
controller's retained ChildProcess and original physical pins confer authority.
Live API/dashboard health rechecked HTTP200/200; no live mutation.

Direct controller invocation implementation (not yet a settlement): retain the
same physical owner, phase, real ChildProcess/completion, original frame and
intent reader before any awaited observation/effect. Reauthenticate original
inputs/profile/output and lease/epoch/intent/termination pins; consume only the
fixed helper entry and fixed FD3/4/5 projection. Close only the original frame
after spawn, preserving the intent reader and lease for independent observation.
Both successful wire replay and failed helper results retain their original
promise/process; phase remains helper-may-have-run and ordinary release refuses.

The real controller fixture initially reproduced the missing invocation; its
early rejecting test promise was given an immediate observer so RED has no
unhandled-rejection side effect. First real fixed-helper/child response-loss
test passed1/1 (7.951s). A pre-spawn journal-ABA RED (7.139s) showed immutable
directory fields alone were insufficient at that boundary. Add the original
full directory identity and exact two-member prefix, plus original predecessor
absence, immediately before effect. General post-spawn assertions still allow
owned journal growth; they cannot adopt a claim by themselves.

Final focused6/6 (28.411s) covers concurrency/response loss, journal ABA,
same-byte intent replacement, actual spawn failure and real helper no-EOF
failure. An independent controller-spawn witness proves exactly one fixed
helper call (separate from its one child dispatch), exact executable/argv/cwd/
environment/FD layout, and unchanged original helper PID/outcome on every
resume. TypeScript no-emit and whitespace checks passed. Final coupled capture,
invocation, real helper/child and exact-export gate passed28/28 (39.702s);
manifests17/17 (5.957s). Final independent scoped recheck found no remaining
issue. This completes the invocation kernel, not public V2 routing or
claim/settlement/release authority.

Independent direct controller claim observation now authenticates the original
four-member journal, completion-bound publication identities and actual retained
helper exit, then independently observes the exact detached child and original
startup files. Original runtime parents are retained before helper dispatch;
spawn-dispatch/claim readers are retained before their first read and reused,
never reopened as new authority on replay. Both awaited profile/output checks
are followed by complete original history/process/startup re-observation.

The first real-process observer test failed at the missing implementation
(7.045s). Initial observation/replacement gates passed8/8 (45.567s). Review
identified an async observation overlap after helper capture had completed;
the test now blocks the first observer at that exact post-kernel profile await.
RED accepted the second observer (7.325s); a separate whole-observation active
guard yields GREEN1/1 (7.107s), and resets on success/refusal without granting
redispatch. Extended focused gates passed15/15 (80.398s): original intent and
termination replacement, claim/dispatch/startup replacement, journal ABA,
original P3 drift, late PID/parent replacement, and successful-observation then
same-byte/new-inode claim/dispatch replacement on replay. Refusal preserves the
original invocation, physical lease and phase. No public settlement/release
authority is introduced. TypeScript no-emit and whitespace passed; independent
scoped review found no remaining production issue.
Final capture/helper/controller/observer coupled gate passed41/41 (110.375s);
the separate exact retirement export/lease check passed1/1 (0.818s), and
manifest17/17 (5.980s). Live API/dashboard remain HTTP200/200. This checkpoint
completes independent claim observation only; settlement and release remain
unchecked and no live recovery or full-P3 acceptance is claimed.

Next settlement implementation retains a distinct private record/publication
owner before any write. `settleDirectSpawnerRebindControllerV1(lease, input)`
consumes the same two existing pairs, independently observes the original claim,
then brackets two ordinary service censuses with original profile/history/child
checks. The actual spawner projection must match claim PID/start/source in the
ordinary service-hash domain; other services must equal original operation P3.
Its direct-controller schema binds completion, original termination pairs/full
identities, transition lock, action, one termination/one spawn and the equal
census. Publish only to the existing content-addressed settlement domain, never
inside the four-member child journal. Keep the original writer and later reader
as close-progress pins; same-inode link1/2/1, file/parent sync, writer close and
temporary unlink must finish before phase=settled. A partial write cannot rewrite;
response loss resumes only the original retained inode. Tests use real helper/
child effects and publication syscalls with disposable failure boundaries. No
public V2 routing or physical release is enabled by this private slice.

Direct controller settlement evidence: first real-process RED found the missing
private settlement function (7.181s). The initial happy path exposed an inadequate
test expectation during review: both producer and test used the wrong receipt
field name. Parsing the actual durable bytes reproduced invalid JSON (7.497s).
The record now binds the real terminationReceipt pair; tests require valid JSON,
canonical roundtrip, nonempty exact pair, self-hash/ref and literal effect counts.

Review-driven same-byte temp/FD replacement and late foreign temporary appearance
both reproduced erroneous acceptance (20.557s). The publisher now preserves its
original creation tuple across write, only updates permitted write metadata, and
rechecks its reserved sibling inventory at every publication assertion. The
reader-open boundary additionally reproduced loss of cleanup ownership (20.819s):
record the actually opened FD identity separately from acceptance, and never
allow a failed acquisition to become replay authority. Owned cleanup closes that
actual reader; a foreign reused writer is not closed by the publisher.

Final focused settlement gates passed21/21 (133.961s), including two equal ordinary
service observations, census-gated concurrent calls, exact ordinary spawner hash
domain and field mutations, writer/reader replacement, late sibling appearance,
partial/absent/completed write response loss, file/parent sync, link/unlink before
and after effects, conservative writer-close ambiguity, and first/second census
drift. An earlier15-case syscall run correctly refused an empty write-before
publication but one test expected only the direct error prefix; its assertion
now recognizes the existing shared cold-publication validator's exact refusal.
No production guard was weakened. TypeScript no-emit/whitespace passed, manifest
17/17 (6.076s), and final independent scoped review found no remaining material
issue. Generic physical release still refuses this retained owner; terminal
history and public V2 routing remain separately pending.
Final capture/helper/invocation/claim/settlement-positive/lease coupled gate
passed43/43 (120.449s), including the amended canonical record and exact receipt
reference/count assertions. This is a scoped private settlement checkpoint, not
full receipt/P3, clean-main rollout, or live A acceptance.

Next historical adoption uses only the existing historical-P3 receipt port, not
live service census or zero-owner prepare/consume. Its dependency is helper census
to direct terminal to original P3 to cold history; there is no helper-census
back-edge. Pin the top intent and exact four-member journal, parse the original
P3-bound termination chain, dispatch and claim, reconstruct completion/full
identities and the same expected CAS settlement before reading it. History may
authenticate after child departure, but cannot grant a new process effect or
replace retained lease ownership. The async historical-P3 port requires awaited
propagation through helper cleanup, dead-lock reclaim and raw-lock release before
those consumers can accept direct terminal history. Preserve V1 behavior and
test every existing raw/genesis/ordinary caller; do not fire-and-forget cleanup.

Next cleanup coupling (same existing retirement/test File Map): make the private
helper cleanup assertion, dead-lock reclaim and raw-lock release asynchronous;
await all three raw cleanup callers plus ordinary release/acquisition. Preserve
the existing V1 body. A recognized direct intent is a global cleanup fence even
when its original lock differs from the currently supplied lock: authenticate
the complete P3-bound terminal first, bind its journal/lock relation to that
intent, and recheck the original intent across the await. Missing/partial/crossed
history remains settlement-unknown. A valid old terminal only removes this
global fence; it never grants authority over a later lock, whose normal-journal
and physical-owner checks still apply. Reobserve dead owner state and exact lock
identity after awaited history. Retain exclusive per-raw cleanup progression
across the await; reject concurrent cleanup or promotion. Behavioral gates must
cover each awaited caller, original/new lock relations, awaited path replacement,
normal-journal refusal, and unchanged V1/genesis cleanup response-loss behavior.

Async prerequisite checkpoint: gated actual ordinary/dead/raw/genesis cleanup
first failed4/4 (2.091s): callers returned and advanced ownership while helper
history remained pending. All private callers now await validation/cleanup;
raw release retains an active progression owner and blocks promotion/abandon.
REDs then exposed same-byte foreign lock FD reuse, late owner reappearance and
parent-topology replacement (including dead reclaim replacing the original lock
before eventually rejecting). Recheck original parent, saved full lock identity,
raw map/phase and dead process absence after the await, before any mutation.
Ordinary/dead cleanup retains exact close ownership; a failed original guard
assertion is retained with assert-before-close rather than closing foreign FDs.
Unknown guard ownership is a conservative fence, not automatic recovery.

Focused await/FD/PID/parent/guard-reuse cases passed11/11 (4.785s). Combined existing
V1/genesis/dead-lock/lease ABI regression passed26/26 (25.530s), TypeScript
no-emit/whitespace passed, and independent review found no remaining material
issue in this async-only slice. The direct intent branch still rejects: complete
terminal adoption is deliberately not enabled until its separate behavioral
tests and global-fence binding are implemented. This advances the coupled File
Map prerequisite, not full P3 or live acceptance.
Final direct release/history positive regression passed2/2 (15.037s), source
manifest17/17 (5.747s). No public export or arity changed, no live mutation.

Direct terminal adoption checkpoint in progress: original/later ordinary cleanup
RED failed at unconditional direct-unsettled refusal (8.066s); independent
historical acceptance made that positive pass1/1 (7.993s). Review then exposed
post-resolver claim replacement and a new settlement temporary bypassing a
top-intent-only check (two explicit missing-rejection REDs,14.844s). The private
synchronous revalidator retains actual readers, binds all six full file tuples
and canonical graph bytes, the exact four-member directory tuple/inventory and
both publication-temp families. The first expanded gate passed10/10 (72.504s).

The actual cleanup caller has one further await: an end-to-end later ordinary
release RED replaced the claim immediately after helper validation returned and
still unlinked its lock (7.964s). Carry a private zero-argument witness assertion
to ordinary/raw/dead cleanup; execute it synchronously after the final await.
The direct witness brackets mandatory normal-journal closure with cold/direct
history checks. It captures frozen data, never live FDs or new process authority.
The previous V1 synchronous body runs exactly once in that caller continuation,
so a newly appeared journal is checked without duplicate settlement publication.
An additional late-V1-journal regression and crossed normal-registry case verify
that a valid old direct terminal cannot waive a later owner's requirements.
Public exports/arguments remain unchanged. Actual dead-original-controller
end-to-end recovery, public V2/startup/census and full gates are still pending.

Independent review found that the returned assertion can itself terminalize a
normal helper registration. The actual cleanup caller must authenticate physical
ownership before that assertion, not only before unlink. A real lock-bound
registration/journal/completed-settlement fixture proved three valid controls
and four RED refusals that incorrectly wrote terminals (5.281s): dead PID
reappearance and ordinary/raw/dead parent replacement. Original parent, full FD
identity, raw owner/phase and fresh dead-PID absence now bracket the callback.
The expanded 12-case await matrix passed (7.971s), including reused FD ownership,
late V1 journal and valid terminal publication; TypeScript no-emit passed.
The same existing source/test/plan File Map applies; no production test seam,
public API change, live effect or runtime guard exception was introduced.
Final direct-adoption/await/V1/genesis/lease ABI gate passed38/38 (101.511s),
source manifest17/17 (6.100s). A further leaf-only replacement hypothesis,
without numeric FD reuse, passed all three ordinary/raw/dead cases (2.230s)
without another production change: existing full physical witnesses reject it
before terminal publication. Retain those regressions. Independent review found
no further demonstrated material defect in this scoped acceptance checkpoint.
This is not a full P3, PR-delivery or live-goal completion claim.

Actual dead-original-controller E2E now runs a separate plain Node controller
against the real compiled retirement/helper/sealed-child implementation. It
acquires, invokes, independently settles and exits without releasing its lock.
The fresh parent proves that durable PID absent with real ps, retains the old
lock FD, acquires through production dead-owner reclaim (old nlink becomes zero,
new lock belongs to the parent), then releases. The original intent, four journal
files, terminal and physical history witnesses remain unchanged; actual signal
and helper/child spawn traces do not grow, and the exact replacement child stays
running until identity-bound fixture teardown. Aliases are compiled before
sealed output hashing; the runner and finalized observation file stay outside
dist. No death/process-effect double or production change is involved.
An initial fixture-only terminal-path typo was corrected before evaluating the
reclaim assertions. Positive passed1/1 (5.915s), coupled helper/controller/release/
ABI passed6/6 (36.440s), source manifest17/17 (5.750s), TypeScript and whitespace
passed. Independent review found no correctness/security blocker. Its minor
instrumentation-window/FD-finally/bigint improvements were incorporated, then
dead-owner plus retained-release regression passed2/2 (12.697s).
The composite terminal-release/dead-owner checkbox is now proven; public V2
routing, startup/census, full gates and live goal acceptance remain open.

Public V2 routing execution refinement (same retirement/test/plan File Map):
resolve the strict restart CAS discriminator before selected-operation lookup.
V1 retains its exact journal/settlement/action path and resolves each port once.
V2 retains original physical lease/root/epoch witnesses across awaits. Matching
unfinished retained state enters the existing settlement kernel; a settled or
fresh complete historical prefix returns only its original settlement pair.
Releasing/foreign/active ownership and partial/crossed prefixes refuse; positive
absence plus the existing startup-prefix guard alone permits fresh preparation.
Historical replay uses immutable original P3/intent fields, not a selected live
operation, launch profile or service census. Extend only the private history
result with those already-authenticated records for static binding. Recheck the
synchronous history witness and original current lease before return; never
require the later lease to equal the historical controller's old lock.
The real separate-process public-call RED currently rejects valid V2 at the
hard-coded V1 action discriminator (2.175s). It will require fresh one-shot
dispatch, original controller exit and repeat public adoption under a later lease.

The first public lifecycle GREEN passed (6.064s); fixture census refresh was
corrected to preserve the real predecessor observation before a child claim
exists. A final-await same-byte claim replacement then produced an explicit
missing-rejection RED (5.936s). Return a private pair-plus-synchronous-witness
from routing and revalidate in the public continuation. New settlement obtains
that same historical witness before returning. Retained settled replay has a
stricter ownership relation than fresh history: a separate terminal replacement
RED (5.502s) proved the need to bind its original committed record and accepted
reader full tuple/bytes before and after graph validation. Public tests passed
3/3 (17.690s); no public shape/export changes were introduced.

Expanded public tests cover empty direct directory and pending intent before
initial effects, a pending intent after acquiring a later lock, six crossed
original restart fields, cross-operation replay, original controller departure,
and both retained/fresh replay after real child departure. Replay observation
sentinels permit only the restart CAS and immutable historical P3, forbidding
selected-operation, profile/environment and live service census ports.
Public/V1/physical lease regression passed17/17 (35.812s), source manifest17/17
(6.052s), TypeScript and whitespace passed. Independent routing re-review clear.

Downstream startup's existing helper-blocked publisher recognizes only
HELPER_DISPATCH_SETTLEMENT_UNKNOWN. A real helper child-launch failure exposed
raw completion errors escaping the new public route (RED3.278s). Normalize only
errors for this lease's retained direct state to the existing unknown code;
pre-retention validation errors remain intact. The test invokes twice without
additional effects, lets the actual original controller exit, and proves fresh
acquisition refuses its unchanged partial authority tree (GREEN1/1,3.884s).
The test-owned spawn fault targets the child entry only, so the actual helper
runs and fails; it does not fake controller/helper execution. Narrow independent
review found no remaining issue. Fresh startup V2 emission remains disabled.
Final public/helper/V1/physical-lease regression passed19/19 (40.198s), shared
historical-reader/retained-release/ordinary-cleanup positives passed3/3
(25.294s), source manifest17/17 (6.110s), final TypeScript no-emit and whitespace
passed. Independent routing and error-contract reviews are clear. The public
route checkbox is now proven; no source exporter, arity, returned settlement
pair, V1 journal bytes or logical action changed. Live Mission Control and
dashboard health remain HTTP200. No live DB/service/process mutation occurred.

Private direct terminal-history RED first failed at the missing reader (8.159s).
The new resolver retains original file descriptors/metadata/bytes across both
historical-P3 reads, requires the original P3-bound termination chain, and derives
the exact completion/census/settlement hash and path before opening its terminal.
Shared private pure projections preserve existing settlement bytes; they never
grant process or filesystem ownership. Fresh-module resolution after actual
child departure passed1/1 (9.245s). Expanded history tests passed9/9 (59.851s),
covering every self-rehashed terminal field, canonical/size defects, replaced
intent/termination/spawn/claim records, original P3 drift and awaited journal
ABA. Replacing only an equal valid terminal produces a different physical
witness for future census bracketing, not an invented historical inode identity.

Review reproduced a pending-reader cleanup gap: a second call returned valid
history while the first original close remained ambiguous (RED8.204s). Drain the
existing retained cleanup set before any new acquisition. The actual reader
fault test now requires zero new opens on retry and recovery only after the
fixture closes its injected pre-close failure. Final cleanup/positive/ABI gate
passed3/3 (17.988s); prior shared settlement/history/ABI gate31/31 (190.580s),
manifest17/17 (6.161s), TypeScript no-emit and whitespace passed. Final independent
scoped review found no remaining material issue. API/dashboard remain200/200,
canonical Setfarm and Mission Control worktrees unchanged. This checkpoint does
not wire public V2, helper census, dead-owner reclaim, or retained physical release.

Retained direct release implementation keeps its own progress object, distinct
from historical acceptance and ordinary V1 cleanup. Before any resource close,
authenticate the retained terminal against the independent historical reader and
its original accepted settlement-reader tuple. Revoke the retained effect phase,
then drain original helper/history readers, termination/intent writers, opaque
intent/epoch pins, settlement reader and subordinate guards. Opaque closes carry
entered/completed flags because their existing close callbacks cannot prove a
lost response; ambiguous closes cannot be retried as silent no-ops. Concrete
descriptors retain actual identities and use the conservative close helper.
Reauthenticate terminal before unlink. Retain a separate original parent-sync FD
and original lock FD/identity, mark unlink entered before its syscall, reconcile
only the original inode becoming unlinked, fsync that original parent, then close
parent/root/lock owners before clearing retained state. Never unlink a later
foreign pathname, delete history, or require live helper/child/epoch observations
after committed terminal. The positive test invokes the public release; fixture
cleanup is not accepted as production semantics.

Retained release RED initially refused the completed owner (7.992s). Independent
review then reproduced two material boundaries: successful unlink followed by
failed fstat could not reconcile on replay; an opaque epoch FD reused during the
historical await was closed as if it were original (explicit missing-rejection
RED8.407s). Reconcile only the retained unlinked inode before any later pathname
lookup. Add a private descriptor-only cleanup assertion to the existing pin,
and assert each opaque resource immediately before its first close; retain the
entered/completed ambiguity fence. No current epoch pathname becomes cleanup
authority. The fixes passed3/3 (24.404s).

Expanded release gate passed14/14 (98.882s): preserved original history, unlink
fstat response loss with a later lock owner, foreign epoch FD reuse, actual child
departure/current epoch replacement, gated concurrent release/invoke/observe/
settle, and before/after parent-sync plus parent/lock/reader/epoch-close faults.
Test teardown retains exact injected pre-close ownership through finally and
attempts all remaining cleanup even after an earlier assertion fails. Manifest
17/17 (6.029s), TypeScript no-emit and whitespace passed. API/dashboard200/200;
no live service, DB, epoch, or history was changed. Final shared-history/cold-release/
exact lease ABI regression passed12/12 (102.546s), including the existing fourteen
cold release fault modes; independent re-review found no remaining material
issue in this retained-release slice. Dead-owner acceptance, public V2/startup/census,
full receipt/P3, clean-main rollout and live A remain pending.

Crash-prefix audit for the direct kernel: durable dispatch is not proof that an
effect happened. Retain separate monotonic publication/effect-entered/result
facts in the original owner, marking entry before `kill` or `spawn`. An existing
termination dispatch permits only observation of the stored original identity,
never a second signal; an existing spawn dispatch permits only authentication
of its original child claim, never another launch. Intent-only repair requires
the original retained owner. Helper/controller loss after dispatch without
authenticated completion keeps the lease/journal fenced. Final settlement is
history/cleanup authority, not child liveness or redispatch permission.

The operation-bound inherited frame also requires coordinated runtime routing:
current cold snapshot readers treat a regular FD3 as a cold capability. New
direct helper/child contexts must be distinct, authenticate before runtime
environment use, and reject unknown/mixed selectors without ordinary fallback.
`src/runtime-config.ts` and its owning tests are therefore causally required
existing File Map consumers, alongside the spawner/helper/retirement changes.
Do not weaken the cold reader simply to make a new frame pass. Preserve the
ordinary operation-bound sealed startup gate and all pre-database boundaries.

Kernel-input checkpoint evidence: both the shared-profile and direct-intent
tests first failed at missing actual production declarations. The final pure
test covers 28 self-rehashed profile mutations, stale profile hash, valid but
cold-crossed source, 15 missing intent fields, 22 intent mutations and five
malformed/oversized byte cases. Independent review found no remaining must-fix.
The unchanged production tree then passed the complete retirement suite 68/68
(424.897s), including all genuine helper/child, historical corruption, response
loss and retained cleanup cases. Exact145/64 manifests passed 17/17 (6.054s),
receipt routing/nested original-history lifetime/final V2 replay passed 3/3
(13.300s), and no-emit/whitespace checks passed. No direct transport effects or
live recovery were enabled; private record parsing is not an owned capability.

**Consumes:** Spec's cold-absence versus real-predecessor discriminants, existing
physical transition lease, strict private record patterns, and current source
integrity authority.
**Produces:** A truthful versioned transport chain shared by cold bootstrap and
pre-schema rebind, with no caller-controlled PID/executable/argv.

Cold and direct kernel implementation is complete at its recorded scoped
checkpoints, including fixed-helper launch, controller settlement and terminal
release/dead-owner reclamation. The historical kernel boxes below are reconciled
with those later checkpoints; downstream final graph/helper census, coupled
receipt/P3 gates, clean-main and live acceptance remain explicitly open above.
Evidence includes113964d5(watcher reproduction),8bfd2490/c39abadc/2f1ca08c/
107066f8/3597c936/4fd7bba8(strict direct chain),42291d46/81be2fc5/9649b289
(fixed helper),fcab5354/ff0e80b2/a65a488e/a0653ac4(terminal release/reclamation),
their owning tests and independent reviews recorded in the checkpoint ledger.
This reconciliation does not claim a new whole-kernel run or live acceptance.

- [x] In a disposable real-child fixture reproduce that a watcher restart leaves
  the detached predecessor alive. Assert a replacement requires the old identity
  to be terminal and the new identity to be different; the old helper must fail
  this behavior test.
- [x] Define strict cold/rebind intent, termination-dispatch, spawn-dispatch,
  child-claim and settlement records with separate hash domains. Each record
  binds the same source, host, lease and exact prior pair. Keep historical V1
  launchctl authority read-only; it cannot authorize direct effects.
- [x] Implement the fixed helper's direct spawn and one-shot inherited descriptor
  handshake. Preserve runtime integrity independently of the ordinary CLI.
  Derive rebind target from authenticated stored process identity, never caller
  scalars. No SIGKILL fallback; nontermination prevents launch.
- [x] Test wrong branch/fields, descriptor swaps, reused identities, source drift,
  duplicate intent/claim, process appearance, ignoring termination, and every
  pre/post-effect response-loss boundary. Lost spawn acknowledgement adopts only
  a real matching claim, otherwise retains a blocked fence without redispatch.
- [x] Extend physical-lease release/dead-owner reclamation to the separate cold
  journal. Prove incomplete dispatch cannot become an unfenced zero-owner state.
- [x] Complete the distinct direct-rebind terminal release/dead-owner relation;
  a partial direct dispatch must retain its original fence without redispatch.
- [x] Independently review the kernel before integrating live authority producers.

## Task 3: Integrate real cold spawner and controlled rebind

**Consumes:** Tasks 1–2 and unchanged ordinary current-entry operation/status.
**Produces:** A zero-input recovery path from absent spawner to authenticated
sealed cold process, followed by genuine ordinary operation-bound rebind.

Joined-proof implementation refinement (2026-09-13): keep the receipt fixture's
disposable Git/build and imported v31/pending/PBA boundaries, but restore the
production receipt, startup, retirement, helper and spawner startup graph.
Existing turnkey helpers replace one another's receipt/startup modules and
therefore cannot prove this joined path by simple composition. Use a fixed
per-module transform map before committing fixture sources, compile those
copied sources after build preparation, and finalize output hashes last. No
source/output rewrite is allowed between cold launch, prepare and direct rebind.
Do not copy future producer modules merely to satisfy an eager import closure.

File Map remains this plan and the existing receipt test; private test helpers
may be factored there. Preserve the actual cold/ordinary/phase/physical/legacy
observers, their parsers and shared retirement module. Only raw OS, HTTP and
SQL transports and fixed disposable home/workspace anchors are simulated.
Real child identity, termination, launch, singleton/descriptor ownership and
cleanup are never simulated. A copied actual runtime-config must handle the
inherited startup snapshot; a phase-only runtime stub is not sufficient for
the joined child.

The first shared fixture dependency is the legacy SQL transport. Its ordinary
six-query sequence did not handle the cold pre-32 catalog query: focused RED
failed at MISSING_CATALOG_CONTRACT_pg_catalog.pg_attribute (2.077s). Extract
only that SQL transport into a reusable test-source helper, preserving the
production DB observer and pure finding-publication validator. Cold mode must
execute statement timeout, lock timeout, catalog absence, aggregate and three
finding queries in order (seven); ordinary mode retains six. Each observation
owns a new counter/connection, with repeatable-read/read-only begin and awaited
end. Do not substitute the high-level census or manufacture a production zero.
The initial cold/ordinary regression group passed 3/3 (20.429s); expanded
repeat-observation and all-five-catalog-owner refusal checks passed 4/4
(24.452s). Independent review found that fixture connection cleanup masked
the original cold aggregate refusal at query four. A new empty/malformed
aggregate regression reproduced WRONG_DATABASE_QUERY_COUNT (RED, 1.982s).
The transport now accepts the catalog-refusal, aggregate-refusal and complete
query frontiers without changing any production observer. Expanded checks
passed 5/5 (29.739s); tightening the malformed case to catalogViolationCount
also exercises query four, and the final rerun passed 5/5 (27.832s).
TypeScript noEmit and diff checks passed, and read-only
re-review found no remaining actionable defect. Live Mission Control and
dashboard HTTP checks returned 200/200. These are focused prerequisite checks,
not a joined lifecycle proof or a full P3 passing receipt.

Joined controller fixture implementation now lives in the same receipt test
File Map entry. It restores production receipt, retirement, startup, helper,
launch-environment and runtime-config modules; copies their static closure and
explicit dynamic finding-publication dependency; commits those fixture inputs
before prepare; emits real compiled outputs after ancillary output setup and
before finalize. One extracted production spawner entry retains both cold and
direct startup branches, plus an explicit runtime-config side-effect import.
Without that import, TypeScript erased the unused named binding and the new
unauthenticated-child test reached the ordinary-admission refusal instead of
the configuration guard. The fixture now preserves the production loading
effect. No production source was changed.

The private fixture home is created under the actual owner's home so launch
ancestor checks remain real. Only raw launchctl, HTTP, process/listener outputs
for three stable external services, and the legacy SQL transport are simulated.
Real observer/controller/helper and spawner process identities are read from
the OS; no spawner PID or termination is synthesized. The full cold observation
passed without publishing or creating startup files (1/1, 11.317s). Source/build
verification and unauthenticated cold/direct-child refusal passed together
(2/2, 9.214s); launch-profile pinning passed (1/1, 6.006s).

The new joined test invokes actual prepare, requires settled cold history and
the operation_prepared status, authorizes and executes actual direct rebind,
requires pre_manifest_bootstrap_sealed and a different genuine PID, compares
the other three service generations and historical settlement, then replays
without changing the replacement census. Its first full execution and
independent review are in progress. Cleanup reobserves exact UID/PID/PPID/PGID,
start time and command before signaling only fixture-owned children, and
requires their disappearance before removing the private fixture home.
Review found that helpers inherit the controller's process group instead of
being detached: cleanup now requires PID=PGID only for spawners, and binds
helpers to the captured controller group and current/orphaned controller
parent. The running first joined fixture has produced a real child claim and
controller settlement; later prepare/rebind/replay outcomes remain pending.

First joined execution reached the test-only 300s limit; the owned controller,
spawner and private home were removed. With a measured 900s test bound, the
second run reached recovery-chain parsing and refused in 327.988s because the
generic PBA fixture contained only a marker, not currentSource. This is a
fixture defect, not authority to relax requireSource. The joined installer now
copies the real PBA observation module and parser, replacing only its execFile
transport for fixed launchctl/plutil/source-CLI responses. Its real filesystem
locator observations stay intact. The response preserves the complete frozen
PBA contract with a fresh MC source triple and rehashed vendor/evidence records.
A focused regression reproduced the missing source (RED, 5.293s), then passed
through the real compiled locator/observer/parser (GREEN, 5.294s). The fixture
also validates the PBA response before constructing a costly joined run.
An actual inherited-group helper plus detached spawner cleanup test passed
(1/1, 1.383s). Full joined acceptance, including the new explicit one-effect,
old-PID-absence, descriptor and immutable replay checks, remains pending.
The combined six prerequisite tests passed 6/6 (29.829s), followed by clean
TypeScript noEmit and diff checks. Attempt three runs the full joined test with
the strict PBA transport and strengthened acceptance assertions. No full P3
receipt, PR delivery, rollout or live acceptance is claimed by these results.

Attempt three failed after 378.989s: the actual post-visible progress database
transaction still imported the network SQL driver and reached fixture.invalid.
The ordinary legacy census transport did not cover that separate observation.
Its SQL import now receives fixed migration31-current/32-and-33-absent rows;
the actual phase, journal and catalog validators remain intact. Independent
review identified a second fixture-only gap before the next full result: the
generic V31 catalog export was still throw-only. The joined closure now retains
the actual V31 catalog verifier and migration predicate dependencies. Its two
raw catalog responses were captured with that real verifier in a read-only,
repeatable-read PostgreSQL 17 transaction; frozen test literals require no live
database access. Each snapshot checks six queries, exact catalog SQL/arguments,
read-only transaction mode, connection options and one close. The actual
compiled V31 verifier accepted the fixed rows and refused expression drift
(1/1, 4.552s). Attempt four uses the earlier immutable four-query projection;
it is still pending, not evidence for this subsequent six-query correction.
Attempt four finished after 385.745s with exactly the predicted V31 throw-only
export failure, confirming the newly isolated DB path was reached. Its owned
home and both controller/spawner processes were removed. Attempt five now
runs the corrected real V31/six-query projection end to end.
The combined prerequisite run then exposed replacement-string expansion of
SQL `$` tokens in the copied-source transform (three import-time failures).
Both nested replacements now use callbacks, preserving catalog bytes exactly.
The same seven prerequisites passed 7/7 (32.305s). The expanded compiled V31
negative additionally rejects a disabled immutability seal (1/1, 5.329s).
Latest TypeScript noEmit and diff checks passed. No production source or
runtime guard was changed by these fixture corrections.
The current exact source manifest passed 17/17 (5.961s): Task0 remains exact145,
P3 exact64. English (1469 files), path (848 files), and migration-digest checks
also passed. These are scoped prerequisites; joined acceptance and full P3
remain outstanding.
Attempt five reached real prepare, repeated prepare, authorization and direct
rebind, then failed after 430.643s with HELPER_DISPATCH_SETTLEMENT_UNKNOWN.
This supersedes the fixture DB failures but does not prove a completed rebind.
Its owned processes/home were cleaned. Attempt six adds fixture-only stderr
diagnostics at the masking direct-route/setup catches and forwards helper/child
stderr; original exceptions, decisions and capability FDs are unchanged. The
compiled fixture remains immutable throughout each attempt. Root is locating
the underlying refusal before deciding whether a fixture or production fix is
needed; no guard relaxation or successful joined/P3 claim is justified yet.

### Joined direct resolver boundary correction (2026-09-14)

Attempt six failed after 439.561s. Read-only prefix monitoring proved the
original predecessor terminated (termination dispatch and receipt present),
with no spawn dispatch or replacement claim. Diagnostic stderr identified
`restartAuthorityRef pair shape is invalid` during the post-termination launch
profile revalidation, not a helper deadline. Canonical stored intent JSON orders
nested pairs hash/ref; the direct evidence reader forwarded that order to the
real startup resolver, whose public contract is exact ref/hash. Earlier direct
fixtures ignored resolver arguments and therefore missed this composition bug.

Causal File Map addition to this in-goal root fix: existing
`src/internal-production/baseline-restart-authority-retirement-v1.ts` and
`tests/internal-production/baseline-restart-authority-retirement-v1.test.ts`,
alongside the joined receipt test and this ledger. All are already in the
owning File Maps; no new runtime path, export or guard exception is introduced.
Preserve canonical intent bytes and strict resolver semantics. Remint only the
already-validated operation and restart pairs in their public field order at
the direct evidence call boundary. Tighten the direct fixture's restart resolver
to enforce the real pair shape and values. Its previously passing public V2
single-dispatch/replay test now reproduces the failure (RED, 1.931s).
With the source remint it passed (GREEN, 5.813s). Expanded real direct
controller/public replay/terminal-history checks passed 13/13 (90.115s),
including replaced original records/P3, awaited journal churn and interrupted
reader cleanup. TypeScript noEmit and diff checks passed; independent source
and regression review found no actionable issue. Attempt seven now runs the
complete joined fixture with this source fix. No full joined/P3 or live
acceptance is inferred from the fast results.
Attempt seven reached actual predecessor termination, replacement dispatch and
claim, durable controller settlement, sealed status, zero descriptor delta and
released lease. It then failed in the test's own historical termination resolver
call: a status-derived canonical pair was passed without reminting public key
order. The test now explicitly remints that termination pair and startup-token
pair. Separately, diagnostic stderr inheritance into the long-lived child kept
spawnSync's pipe open after its controller exited. Root verified controller
absence and the child's exact UID/PID/PPID/PGID/start/command twice, signalled
only that fixture child, and the test's normal cleanup removed its home. The
observed 666.749s includes this diagnostic drain, not solely controller runtime.
Long-lived child stderr remains ignored again; only short-lived helper stderr
is forwarded. Attempt eight reruns the full acceptance with those test-only
corrections; replay/final joined success is still pending.
Final-delta prerequisite rerun passed 7/7 (32.302s); English/path/migration
contracts and noEmit/diff checks remained clean. Independent review found no
remaining assertion or stderr-lifecycle issue. Live HTTP smoke remained
200/200; this is observation only, not rollout acceptance.
Attempt eight passed the complete joined test (1/1, 479.745s; total 480.934s).
It proves real prepare and repeated prepare, authorization, one actual
predecessor termination, one replacement dispatch/claim, two service
observations, durable settlement, sealed status, zero descriptor delta,
released lease, unchanged other services/cold history, and immutable direct
history on replay with no second process. Normal owned-child/home cleanup
completed. This closes the joined positive proof, not the full P3/live goal.

- [x] Reproduce the composed failure and identify the exact retained boundary.
- [x] Add strict resolver-argument behavior to the owning fast regression.
- [x] Remint validated pairs at the two resolver calls; preserve stored bytes.
- [x] Verify fast direct behavior, independent review and the complete joined
  lifecycle before checkpoint/full P3.

Checkpoint 27f68a8e's CLI file also passed through the authenticated isolated
P3 runner: 12/12 (58.020s), with both runner-owned databases dropped. Node 26
emitted a module.register deprecation warning from the test loader; there was
no test failure. This is only the CLI file, not the full P3 gate. The earlier
81bf9794 diagnostic output is retained outside the repo at
logs/2026-09-13-receipt-81bf9794-console-capture.log in the canonical workspace;
its header explicitly notes the missing early all-passing chunk and preserves
the failing final result.

- [x] Add a fixture with no spawner and prove old preparation fails at the
  four-service census. Keep the public four-service observer unchanged.
  The compiled old-control-edge fixture removes only the preselection cold
  recovery invocation before source commit/materialization/finalization. The
  actual public prepare fails at the unchanged four-service daemon-family
  census, creates no cold journal, settlement, PID or lock, and preserves all
  source/output bytes. Focused regression passed 1/1 (7.464s, total8.569s).

### Post-recovery ordinary startup refinement (2026-09-14)

Independent delivery review found that main's unconditional cold-journal
absence guards permanently reject ordinary startup even after genuine cold
settlement and normal Task0 readiness. Historical settlement must be preserved,
so deletion or unconditional acceptance of settled history is not a fix.
This is causally required for the approved recovery-to-normal-operation goal.
File Map: existing `src/spawner.ts`, its owning
`tests/internal-production/owner-admission-v1.test.ts`, existing retirement
module/owning test, and this ledger; no new file, runtime flag or frozen
pair-graph change. Retirement runtime exports intentionally rise29 to30 for
one input-bound, read-only terminal-history observer. The aggregate existing
helper census cannot bind terminal operation/restart pairs and therefore is
insufficient here; reusing a mutating helper invocation would be unsafe.

Before startup-file publication, require the actual deep pre-schema observer's
normal-ready V2 chain, resolved readiness, authenticated terminal direct
transport history, and unchanged cold settlement. After owned PID publication,
revalidate those witnesses around the real four-service census, bind its PID
to this process and generation to readiness, then retain existing ordinary
admission and producer gates. The two stale-file reclamation absence checks
remain unchanged: settled history never authorizes deleting stale evidence.
Canonical stored pairs must be reminted ref-first at strict resolver calls;
public pair validation remains strict. First reproduce the normal-ready denial
through actual main before implementing the guarded exception.

- [x] Reproduce ready-history ordinary startup refusal in actual main.
  Actual main failed with COLD_BOOTSTRAP_NOT_ABSENT (3.237s). The sealed
  canonical-pair regression also failed on Hash/Ref versus Ref/Hash (3.602s),
  and the historical-child-departed test failed on the missing read-only
  terminal observer (5.314s). After the initial fix, the latter passed1/1
  (5.777s) and sealed-gate/actual-main passed2/2 (total41.146s).
- [x] Implement authenticated pre/post publication fences and ordered pairs.
  The read-only terminal wrapper snapshots exact validated pairs before awaits,
  authenticates historical termination/spawn/claim/settlement, binds both intent
  and settlement, and reopens the physical witness. Main brackets that proof,
  cold settlement and normal-ready V2 authority before/after owned PID
  publication and around current-PID/current-generation census. Stale reclaim
  remains absent-only. The final gate and ready/sealed transition calls remint
  stored pairs without weakening the strict public parsers.
- [x] Verify positive, crossed/incomplete/history-change negatives, cleanup,
  independent review and source contracts before the complete P3 checkpoint.
  Focused startup/transition/publication/cleanup passed7/7 (1.538s); the exact
  retirement export/epoch contract passed1/1 (0.900s). Expanded direct terminal,
  public replay, departed-child and lock cleanup passed8/8 (47.422s). The
  admission matrix additionally exercises valid alternate operation/restart
  pairs, incomplete cold state and settled/nonzero-owner refusal. Final
  transition/admission retest passed4/4 (1.468s). Independent production review
  found no new actionable issue. Test review caught and corrected the missing
  alternate-pair cases and copied-main closure dependencies. Exact File Map
  tests passed17/17 (6.899s); no-emit, English1469, paths848, semantic migration
  digests and diff whitespace checks passed. After completing the copied-main
  closure, compiled cold/cleanup/old-prepare tests passed8/8 again (38.034s).
  Final transition source/fixture review found no actionable issue. Full P3 is
  not yet started; the next clean reviewed checkpoint is its immutable input.
- [x] Add private three-service absence/physical/phase/read-only DB observation,
  including all-root daemon-family and launcher/singleton checks. Repeat
  decisive observations under the shared physical lease before dispatch.
- [x] Authenticate inherited cold configuration, then acquire the singleton and
  enter cold startup before any ordinary admission/poison lookup. Register stop handlers before claiming
  readiness. Prove no migration, initialization, listener, reconciliation or
  producer runs in that branch.
- [x] Publish controller-observed cold settlement only after a real process
  claim and independent identity observation. Phase-zero must count incomplete
  cold work and authenticate settled work as the actual persistent spawner.
- [x] Route exact-poison prepare/resume preselection through authenticated cold
  recovery before ordinary preparation (`6c37dc4a`).
- [x] Connect the complete direct-detached rebind for the genuine prepared
  predecessor after recovery. A cold token
  cannot authorize ordinary replacement or a second process.
- [x] Update Task 6A order to prepare/recover before public current-prerequisite
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

Historical checkpoint notes follow. Later entries supersede contemporaneous
"pending" or "unfinished" statements; scoped historical passes do not prove
combined P3, clean-main rollout or live Task 6A acceptance.

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

- [x] Add a real copied-main failure test with an incomplete cold journal and
  forbidden ordinary-admission/provider/DB sentinels. Assert no journal or
  foreign startup-file change. Add exact-owned cleanup tests with same-byte
  replacement inodes, symlinks, foreign dead PIDs, partial writes and repeated
  cleanup. The real created descriptor count must return to zero.
- [x] Introduce a private `OwnedSpawnerStartupFileV1` carrying the created FD,
  fixed path, original inode/owner/mode and exact bytes, plus unlink/close phase.
  `createOwnedSpawnerStartupFileV1` uses exclusive no-follow creation and retains
  the FD immediately. `closeOwnedSpawnerStartupFileV1` may unlink only the exact
  owned inode/bytes, records unlink before close, and retains failed closes.
  Foreign replacements are preserved; cleanup never invokes stale reclamation.
- [x] Ordinary acquisition may reclaim only a bounded no-follow regular
  single-link owner file containing a canonical nonself PID, with fresh explicit
  `ESRCH` and original inode/bytes rechecked immediately before unlink. `EPERM`,
  ambiguous liveness, malformed bytes and replaced paths refuse. Cold lock
  acquisition will never reclaim a predecessor lock.
- [x] Route sealed, normal, error and fatal cleanup through exact-own state.
  Perform the mandatory strict cold-journal census after actual singleton/PID
  publication and before `resolveActiveInternalProductionBaselineSpawnerStartupAdmissionV1`.
  A refusal-only preflight before ordinary file mutation must also preserve an
  already known unsettled journal's startup evidence; it grants no admission and
  cannot replace the post-protection census. The later authenticated cold branch
  is separate and cannot be selected by an environment marker alone.
- [x] Run the actual-main and ownership negatives, gateway recovery tests,
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
- [x] Preserve the admitted stale-dead-PID compatibility case: its eventual
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

**Files:** existing retirement source/test, receipt source/test, `src/spawner.ts`
and `tests/internal-production/owner-admission-v1.test.ts`, plus this plan.
Keep the fixed 145/64 File Maps and ordinary 33-pair final graph intact.
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
- [x] Authenticate the immutable terminal chain in the public cold census.
  Both final paths absent is absence; an orphan terminal, reserved publication
  temporary or any incomplete/crossed chain remains unsettled. Historical
  validation reopens immutable intent/dispatch/claim/genesis and embedded
  epoch-one evidence; it does not demand the old live lock, controller, child,
  output or mutable epoch head forever. Current admission separately checks
  the genuine process/startup files and current source.
- [x] Prove exact publication faults, crossed ordinary identity/source/service
  projections, drift across await, same-controller response-loss adoption,
  release only after authenticated terminal, and historical resolution after
  the exact disposable child exits while live admission refuses it.
- [x] Bind the settlement through a strict versioned cold-predecessor variant
  of existing `preMutationLoadedRuntimeServiceAuthority`, preserving historical
  V1 resolution (`49eaaccb`, final predecessor-integration ledger below).
- [ ] Run unchanged phase/DB/physical gates after settlement in the combined
  cold-to-direct-rebind acceptance; no
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

Historical census and retained release evidence (owning gate complete):

- Both ordinary stale reclamation and actual ordinary spawner main initially
  accepted a successful non-absent census. Their real RED tests proved stale
  deletion and startup effects; four call sites now explicitly require absent.
  Both targeted tests passed (46.341s), including history appearing at the
  second census. This is not a generic cold-history launch permission.
- The actual controller terminal initially failed the public census; orphan
  sibling final files incorrectly returned absence. Public observation now
  authenticates exact intent/dispatch/claim file and journal tuples, immutable
  genesis and embedded epoch-one evidence, strict historical launch profile,
  ordinary service projection and the final publication tuple. Both final
  paths absent retains the existing absence witness. Reserved pending names,
  orphan final and any incomplete/crossed chain refuse without writes.
- Historical observation survives exact child exit, startup cleanup, mutable
  epoch change and disposable current-output change. Same-byte terminal inode
  replacement changes the census hash, preserving the phase A/B identity
  bracket. Historical acceptance does not claim current process liveness.
- A fresh-controller test proved it reached preparation on settled history;
  it now refuses before preparation. An independently rehashed profile with
  an extra authority key initially passed; strict profile/nested environment
  inventory now refuses it without current-source/environment observation.
- Independent review found pending reader cleanup was not drained on census
  reentry. A persistent close fault reproduced successful reentry with an old
  leaked FD. Public entry now drains exact retained cleanup before acquisition.
  The 26-mode history matrix passed (66.893s), including persistent reader and
  guard closes, relative executable/plaintext environment additions, pending
  arrival, mid-read intent write, same-byte file/directory replacements,
  rehashed completion/epoch/service crosses and noncanonical terminal bytes.
  The actual process/history, absence and old prefix tests also passed;
  combined focused run 4/4 (73.340s).
- Actual public release initially left 27 managed FDs open; premature release
  also revoked the only usable unsettled lease. The cold-only release branch
  now requires the exact retained committed terminal and original physical
  lock, then revokes effectful use before draining owned resources. Alias pins
  are not a second close inventory. Mutable epoch and old child lifetime are
  not teardown requirements. Keep the original lock/root until all ancillary
  cleanup succeeds; record own unlink before durability cleanup and retain
  explicit close progress until every resource is closed.
- The post-owned-unlink checkpoint test first failed to resume because its
  stored metadata still had one link. Only recorded own unlink now permits
  the original FD's one-to-zero link transition. The 13-mode release matrix
  passed (34.509s): owned FD/guard/lock reader failures, unlink and parent-sync
  faults, post-unlink response loss, final root/physical close, foreign lock,
  external disappearance, terminal replacement, pending owner and success.
  Reused-FD sentinel stays open; pre-unlink failures retain the physical fence;
  post-unlink cleanup never recreates it. Assertions precede fixture teardown.
- Further independent review found that a new owner at the lock pathname
  after recorded own unlink prevented the old owner from finishing cleanup.
  The new-owner test reproduced that refusal. Once own unlink is recorded,
  require the original unlinked FD and ancestry, sync the parent and drain
  only that original capability; never inspect/remove the new pathname owner.
  The expanded 14-mode release matrix passed (44.690s), including preservation
  of the new owner's full file metadata and bytes. A separately rehashed
  writable-host profile reproduced a historical semantic-validator omission;
  static issuer mode/root-ownership rules now apply, with only its existing
  Darwin Node-only admin-group exception. Expanded history rerun is pending.
- The broad owning run found a public-error-contract regression: draining a
  persistently failed helper writer emitted the raw close error. Keep the
  pending resource retained, acquire nothing, and classify the census as
  `COLD_BOOTSTRAP_UNSETTLED`. The unchanged dispatch-fault test passed (8.592s).
  The same broad run also reported a PID-residue fixture failure; its focused
  20-mode rerun passed (39.641s), but that is not closure evidence until the
  original complete failure output is reviewed and the owning gate finishes.
- That initial full owning run completed 60/62 (404.778s); no tests were
  stopped early. Its second failure was `fixture-residue-owned` ENOENT, not
  a failed ownership assertion. The real spawner closes readiness FD6 in its
  cold `finally`, before its outer fatal handler writes the fixture diagnostic.
  Helper EOF therefore does not prove child diagnostic completion. A new
  explicit child diagnostic barrier reproduced the exact ENOENT (2.137s).
  The fixture now releases that barrier and boundedly observes the exact child
  exiting before reading the unchanged child-measured owned-count of zero.
  Actual `ps` status, signal/error, stderr and single-row output are checked;
  teardown releases the barrier. No production sleep/retry or guard change.
  Expanded 21-mode residue run passed (34.648s). Independent read-only review
  confirmed the lifecycle ordering. Final coherent full-module rerun follows.
- Expanded 28-mode historical matrix passed (86.854s), alongside the actual
  ordinary process/history case (7.648s). Exact manifest and gateway groups
  passed 126/126 (9.114s); historical helper 19/19 (36.331s); ordinary startup,
  stale cleanup and fatal-cleanup tests 3/3 (59.959s), plus startup publication
  refusal 1/1 (0.843s). TypeScript no-emit and whitespace checks passed.
- The next full owning run completed 61/62 (375.335s). Both previous failures
  passed. The remaining release-group failure occurred before release fault
  injection, during controller claim process observation (`cold process
  ownership is ambiguous`), not descriptor teardown. Its isolated 14-mode
  rerun passed (40.069s); this alone does not establish a root cause. Fixture
  diagnostics now preserve the exact failed `ps` status/error/stdout/stderr
  and child fatal report instead of losing them during teardown. No process
  probe timeout, retry policy or production refusal was relaxed.
- Final static-profile review required issuer coverage of `repository/dist`
  and `home/Library/LaunchAgents`, including their ancestors. A rehashed
  missing-dist profile reproduced acceptance (3.623s). The four UID-owned
  roots remain distinct from all six ordinary-mode/ancestry paths; only
  Node-only ancestors outside that union may use the existing Darwin admin80
  exception. The real fixture records those originally required directories
  without changing them. Expanded 33-mode history passed (85.198s), actual
  ordinary/history case 4.023s, and diagnostic 14-mode release 37.619s.
  A fresh full owning run uses TAP to expose any failure details immediately.
- The final unchanged owning run passed 62/62 (409.192s), including release
  (36.068s), all 33 historical corruption modes (84.392s), and all publisher
  fault modes (61.115s). TypeScript no-emit and whitespace checks passed.
  The earlier isolated ambiguous-process observation remains unexplained;
  retained diagnostics are not a claim that its root cause is fixed. No
  production process guard was relaxed. Read-only live checks at 02:48 TRT
  returned HTTP200 for both services, with clean canonical/deployed/MC trees.
  This closes this historical/release implementation slice only, not Task 6A,
  the complete P3 gate, live recovery, or the overall internal-production goal.

Historical-census integration must preserve the authority split: authenticated
settled history removes cold transport ownership but grants no spawner launch
permission. Require `state === "absent"` explicitly at all four ordinary
spawner preflight/reclamation calls and fresh cold-controller invocation.
Receipt phase-zero may accept an authenticated stable settled census; ordinary
startup may not. The future operation-bound replacement gets its independently
authenticated branch rather than interpreting settlement as a launch token.

Next coupled integration (not implemented by the historical/release slice):

Preselection routing refinement (same receipt source/test File Map entries;
root remains sole writer): only the incomplete exact-poison dispatch branch
enters the private cold router, before the existing publisher. Authenticated
complete chains remain probe-free. Prepare and public resume call this prehook
before selection. An absent fixed cold census plus a positively observed global
zero spawner-family census selects the existing strict zero-argument facade;
all family rows, including foreign UID and zombies, retain the ordinary path.
A fixed census error selects only the facade's retained-owner authentication,
never grants fresh launch authority. Keep that catch scoped to the census read.
Settled history selects the facade but must retain its original identity, then
match a fresh actual ordinary census and a final exact fixed history census.
Factor the existing global process observer/predicate without relaxing it.
Copied-module fixtures explicitly project their process port; isolated actual
router tests cover cold/ordinary/error ordering and late identity/liveness
refusals. No new export, live mutation, or direct-detached transport is implied.

Independent review exposed a causally required refinement: cold journal absence
does not count a retained pre-intent physical transition lease, and quarantine
acquires its writer before later admission. Therefore the ordinary shortcut also
requires authenticated absence of the fixed physical transition lock, then a
stable cold census and a second authenticated lock absence check. Presence or
uncertainty selects only the strict facade, including after process restart.
A private router ownership-suspicion bit is set before invoking the facade and
survives rejection; only its complete ordinary/history bracket clears it. This
covers router-owned cleanup after its own lock unlink, when a descriptor can
still be retained. Do not broaden the retirement census or invent a self-owner
exemption. The actual router and both copied public-entry tests cover these
cases before quarantine writer acquisition. Same existing File Map entries.

Preselection checkpoint evidence (2026-09-13, no live dispatch): initial actual
router test failed because the helper was absent; actual public-entry test then
failed with publisher/selection occurring without the required cold bracket.
The lock refinement likewise failed its ordinary ordering assertion before the
new lock checks. Final actual-router coverage has 22 cases plus a four-attempt
retained cleanup/release sequence. Both actual prepare/resume entries cover
seven states each, including physical retained/unsafe lock fixtures and a fully
authenticated complete chain whose cold ports remain untouched. The 6-test
routing/absence/API group passed (59.837s); 7 source/publisher/complete-chain
checks passed (16.772s); exact145/64 manifests and pure activation checks passed
35/35 (6.861s; not a claim of a new real-DB run); shared builder/progress and
actual final V1/V2 verification/replay passed 6/6 (22.389s). TypeScript no-emit
and whitespace checks passed. Independent final review found no remaining
must-fix in this scoped slice. At 04:26 TRT both live HTTP checks were 200,
canonical/deployed/MC trees clean, live spawner PID/lock absent. Direct-detached
rebind, full receipt/P3, clean-main rollout and live Task 6A remain unproven.

1. Keep `preMutationLoadedRuntimeServiceAuthority` in its existing pair prefix,
   record kind and final 33-pair position. Preserve exact V1 history; new V2
   adds required `coldSpawnerPredecessor` containing settlement ref/hash and
   the full final publication identity. Include that field in both projection
   and authority hashes. Derive it from the fixed authenticated cold census,
   never caller-provided authority. Creation compares the actual ordinary
   service census with settlement; historical resolution does not demand the
   old child remain alive. Do not silently emit V1 for a cold predecessor.
2. Update prepared-publication builder, nested progress parser, predecessor
   pair resolver and final projection/hash reconstruction together. Connect
   pre-mutation spawner PID/start/ordinary hash to the operation's separately
   authenticated predecessor process and service/generation. The cold intent
   names original poison; the outer record names the selected successor—those
   operation pairs must not be incorrectly equated.
3. Add one zero-argument retirement controller facade. Retained releasing state
   finishes exact cleanup first; retained settled state releases without
   revalidating old child liveness; other retained phases use their sole
   helper invocation and settlement. Existing authenticated terminal history
   is read-only. Fresh absence may enter full cold genesis; unretained partial
   history never redispatches. Reobserve original terminal before returning.
4. Connect preparation/resume before exact-poison quarantine's four-service
   gates, not after selection. Preserve the already-valid ordinary four-service
   path. If that path is unavailable, cold fallback must independently prove
   all strict cold absence/source/three-service/zero-owner conditions; never
   treat failure of an ordinary census as sufficient cold authority. Existing
   settled cold history does not itself prove current ordinary liveness.
5. Prove genuine prepared V2 creation, immutable V1 compatibility, downgrade
   refusal, crossed settlement/predecessor relations, facade response loss,
   retained release retry, and preselection ordering. Keep receipt exports57,
   File Maps145/64 and final33 exact; update the retirement export contract
   only for the actual zero-argument facade. Direct-detached rebind remains a
   separate required coupled transport slice before full P3/live delivery.

Controller-facade integration in progress (existing retirement module and owning
test; no new File Map path):

- Added one zero-argument `ensureInternalProductionColdSpawnerBootstrapSettledV1`
  export. Serialize entry, resume only retained ownership, require authenticated
  historical settlement after exact release, and preserve its original final
  identity across release. Unretained partial journals refuse before any new
  preparation; settled/releasing states do not require the departed child or
  advanced mutable epoch. The actual eight-mode helper/controller fixture
  passed (23.223s), including concurrency, response loss, historical replay,
  post-release same-byte final replacement and cleanup-only retry.
- Retained intent-only prefixes must re-enter their strict existing publisher
  before helper invocation. The real root-sync and linked-temporary fixtures
  prove same descriptor/nonce/intent and repaired one-link final before entering
  settlement; fresh absence reaches the strict preparation path, not caller
  authority. Three boundary modes passed (0.875s).
- Read-only review found a causally required pre-intent ownership gap: the
  promoted lease was local while awaited profile/cold observations ran, and
  failing cleanup could lose it. The new refusal test reproduced dropped
  ownership. Retain preparation before guard acquisition/awaits, bracket exact
  FD/path metadata and epoch, and transfer synchronously to intent. Refusal now
  keeps the original fence for strict retry rather than ordinary lease release.
  Seven modes passed (2.374s): profile/cold failure, persistent close fault,
  guard acquisition failure, and lock/root/epoch drift. Existing crossed-genesis
  refusal still preserves history and now explicitly asserts retained ownership.
- Facade review also exposed raw-lock release deleting its owner on a real
  pre-close fault. The new physical-close test reproduced a live FD with no
  retained raw owner. Raw cleanup now retains per-resource unlink/sync/guard/FD
  progress, and recorded own unlink drains only the old unlinked capability,
  without inspecting a new pathname owner. Shared exact-lock reader cleanup
  retains its failed close as well. Focused raw fault and broad owning checks
  are pending; this is not yet a delivered facade milestone.
- Predecessor integration audit found a required creation/replay split. Both
  selected and pinned progress origins rebuild prepared candidates while the
  outer status can still be `operation_prepared` after predecessor termination
  or replacement. Fresh builder equality with cold settlement is required for
  creation, but replay must reconstruct the authenticated original status/P2
  bytes without requiring that departed child to remain live. Preserve existing
  rebind-effect guards separately. V2 history must also be rechecked after
  downstream pair/complete-zero/live-observation awaits before final returns;
  a single early terminal read is insufficient. Add status-lag replay and late
  terminal-replacement tests to the coupled predecessor work before delivery.
- The first complete facade owning run finished 65/66 (441.642s). All runtime,
  ownership, publication and historical cases passed; its sole failure was the
  exact export inventory still expecting the old 25-name surface. The reviewed
  zero-argument facade is now explicitly the 26th name, with no optional or
  wildcard exception; focused export test passed (0.344s). A final complete
  rerun is in progress. The expanded actual facade fixture also now starts from
  genuine absence (no pre-created epoch, intent, lock or transport copies): all
  nine modes passed (24.035s). Helper19/19 (29.932s), manifests17/17 (6.824s),
  phase-zero2/2 (1.941s), TypeScript and whitespace checks passed.
- The next complete run finished 65/66 (416.940s), with export/runtime/raw
  lifecycle cases passing. Its PID-residue completion fixture rejected an
  unexpected command row; the original row was not captured, so its exact
  cause is not asserted. An independent bounded Darwin child experiment and
  new deterministic test reproduced the same assertion when the same original
  PID/UID/PGID/start time became `Z` with command `<defunct>` (RED 0.070s).
  The helper fixture now records the child's initial live identity immediately
  after its actual spawn. Each completion probe checks that identity once;
  only the same bound zombie may remain waiting, never count as complete.
  Explicit status1/empty-output absence remains mandatory. Crossed identities
  and a non-zombie `<defunct>` row still refuse. Original retirement-owned zero
  count and residue preservation assertions remain. No production timeout,
  process observation or runtime guard changed. Final owning rerun follows.
- That rerun captured the previously missing row: the bound child had `?Es`
  and command `(node)`; a focused teardown captured `Rs` with the same fallback.
  Therefore zombie-only handling was incomplete. Local Darwin `ps(1)` documents
  unreliable argument-memory reporting and stable `ucomm` accounting names.
  The fixture now includes `ucomm` in its one-row original/current identity.
  Exact accounting-name fallback is waiting only (including a pre-exit status
  snapshot), never permission to signal or report absence. Teardown also keeps
  the original UID/PGID/start/name binding instead of a path-only signal check.
  Unknown commands/identities still fail, and explicit absence remains required.
  The original production process-ownership ambiguity remains a separate
  unexplained observation; this test-only diagnosis does not claim to fix it.
- The Z-only complete rerun finished 66/67 (414.800s); its captured accounting
  fallback identified the missing test-only case. The final ucomm-bound waiter
  passed the 21-mode actual helper plus unreaped-child focused pair (37.783s).
  Final complete retirement file: **67/67, 446.913s**, no skips or failures.
  This includes actual nine-mode facade, seven-mode preparation retention,
  four-mode raw cleanup, historical settlement and all ordinary retirement
  cases. TypeScript and whitespace passed. A fresh independent review of the
  two-file diff against `115df146` found no Critical/Important issue. Commit
  only this facade/ownership milestone and its plan; the receipt predecessor
  integration remains separate unfinished work. No live acceptance is claimed.

Predecessor integration in progress (existing receipt source/test File Map only):

- Fresh creation brackets ordinary census and all candidate serialization with
  the fixed cold census. Settled history produces strict pre-mutation V2 with
  exact terminal pair/full physical tuple in both hashes; absent history keeps
  V1 bytes unchanged. Pure nested/status validators share the strict versioned
  validator. REDs reproduced V2 schema rejection and status acceptance of a
  self-hashed malformed embedded predecessor; focused corrections passed.
- Historical creation is a separate private constructor reached from both
  selected and pinned progress origins with their borrowed status owner. It
  preserves original P2–P5 bytes and stored census after predecessor departure;
  neither current service observation nor a new status is synthesized. One
  shared materializer preserves exact path/publisher policy. Actual pinned
  routing RED reached the departed process observer; routed GREEN preserved
  historical bytes and refused target/history crossing through serialization.
- Actual file-backed nested ownership now retains the V2 history assertion
  through its final fences. Same-byte terminal replacement previously returned
  (RED); replacement/absence now refuse, V1 remains independent, and all actual
  owned FDs close. Test compilation is warmed before its FD baseline because
  independent diagnostics identified two first-import tsx cache handles, not
  authority leaks. No FD filtering, count adjustment or production hook added.
- Focused builder/selected-origin/nested-owner group passed3/3 (8.362s); all
  twelve actual raw arms passed (6.597s); existing complete nested root-route
  cases passed (44.466s). Exact source inventories were updated for the private
  creation/replay split and previously committed prerequisite-publication fence.
  Fixture roots now match the physical workspace baseline subtree, and copied
  launch-environment source/dist ownership remains explicit. Final graph,
  late-observation/serialization fences and preselection routing are unfinished;
  do not run full P3 or claim live Task 6A acceptance from this checkpoint.
- Final graph now shares strict V1/V2 validation, retains the fixed history
  closure through remaining graph resolution, complete-zero and final live
  observations, and rechecks before fresh/verification publication. REDs:
  immediate same-byte terminal replacement was accepted; four late boundaries
  also returned; fresh serialization drift wrote a rejected candidate (not a
  successful authority). Those paths now refuse at their original-history
  fences, with no known-crossed fresh/verification publication.
- V2 pre-mutation spawner PID/start/process hash and service/generation must
  equal the independently resolved predecessor/startup commitments. All five
  individually self-hashed crosses were accepted in RED; each now refuses.
  Existing V1 historical semantics remain unchanged. No additional ordered pair,
  locator family or public receipt export was introduced.
- Final focused graph/cross/lifetime group passed11/11 (102.397s). Independent
  V1 compatibility plus creation/nested/static group passed6/6 (17.113s).
  Inert API/phase-zero group passed3/3 (2.011s), exact source manifests17/17
  (5.763s), TypeScript and diff whitespace passed. Independent scoped review
  found no remaining must-fix. Checkpoint this prerequisite only; preselection
  routing, direct-detached transport, full P3 and live Task 6A remain pending.

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
