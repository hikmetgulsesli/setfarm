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
