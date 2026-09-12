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

- [ ] Reproduce different authority locations with an executing linked-worktree
  fixture. Converge producers/readers/helper FD validation and private-directory
  anchors on a single fixed-workspace locator; retain the separate executing
  source identity. Refuse symlinks/foreign roots; no store migration or fallback.
- [ ] Reproduce absent epoch head with the real lease acquisition path. Add a
  distinct genesis-specific acquisition of the existing physical lock, not an
  ENOENT-to-epoch-one fallback. Under that lock require exact incident/source,
  three-service/global-spawner absence, complete zero, 31 and no 32/33/A or
  conflicting restart history. Publish immutable genesis then no-replace bound
  head, fsync/reopen, then ordinary admission. Test response loss, competing
  genesis, epoch two, source drift and every partial publication prefix.
- [ ] Reproduce terminal published findings incorrectly counted as owners with
  real immutable parent/child rows in the disposable PG harness. Extract shared
  pure canonical publication validation; preserve the terminal closure's same
  rules. Reject orphan/malformed/partial sets and active associated ownership.
- [ ] Bind exact settled pre-32 membership and terminal relations in hashed
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
