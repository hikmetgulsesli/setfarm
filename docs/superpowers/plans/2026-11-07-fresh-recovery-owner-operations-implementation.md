# Fresh Recovery Owner Operations Implementation Plan

> **For agentic workers:** Existing sole Source author executes task-by-task after independent design review and Root release. Root owns delivery and live effects; no new author/worktree.

**Goal:** Unblock the actually failed fresh recovery chain through fixed owner-mediated operations while keeping ordinary runtime authority restricted.

**Architecture:** One private Unix-peer executor owns a finite family of existing compiled repository/lifecycle operations. Opaque per-operation/transaction guards rejoin durable authority and perform genuine owner-role entry plus after-wait/precommit checks. No generic SQL/begin/callback proxy or new security/service framework.

**Tech Stack:** TypeScript ESM, existing postgres.js clients/repositories, Node unit runner, existing canonical SQL/lease/CAS helpers.

**Spec:** docs/superpowers/specs/2026-11-07-fresh-recovery-owner-operations-design.md

## Constraints

Base637a793a; branch fix/fresh-recovery-owner-operations-20261107. Root released implementation after independent design CLEAR. Preserve game2, all DB/history/generated files and stashed security draft92c87635. No grants/guard/schema/client retarget, admin URL env/worker data, new account/credential/IPC/kernel/service, model run or manual replay. Author uses Source-unit fixtures only; no stock build or staging/commit/push. Root performs bounded ROLLBACK-only real role/direct-denial checks on selected production state; no isolated deployment/cluster is required. Only exact spec File Map may change.

## Task 1: Fixed custody, private peer connection and authority

**Files:** New owner-operations/authority modules and owner-operations test; held service controls; selected spawner startup/close. Narrow bootstrap transport in existing fresh-installation-v1 + its listed unit test only.

**Interfaces:** `prepareFreshRecoveryOwnerOperationsV1(heldService)` returns the private fixed domain facade described in the spec, or refuses before pool use. `OwnerRecoveryOperationV1`/`OwnerRecoveryTransactionFenceV1` are private WeakMap-backed handles, not DTOs. Transaction helpers enter/assertLive/assertBeforeCommit on an actual tx/op/mutation; they accept no callback or SQL handle factory. Public facade returns domain results, never the writer. The actual held service gains zero-input assertCurrent over its original identity/pins.

- [ ] Read TDD and writing-good-tests. Preserve live RED evidence: game2 coordinate effect quarantined permission denied finding_sets. Add failing component regressions against actual existing repository calls; distinguish setup errors from behavioral RED.
- [ ] Test forged/cloned handles, missing actual compiled selection/service custody, socket/DB/role/source drift and shutdown before pool creation. Use existing Source-extraction component conventions only where operational imports require it; do not add production injection ports or turn test DATA into admission.
- [ ] Implement private peer options: fixed canonical socket, selected DB/port and actual OS user, explicit no inherited password/TCP fallback, max1 writer. Validate real session/cluster/owner role/catalog. Keep restricted read and heartbeat pools separate. Return bounded refusal codes without dumping options or secrets.
- [ ] Bind each actual child transaction to its op; genuine SET LOCAL ROLE then same-tx role/cluster/source checks. Existing repository lexical BEGIN callback is compiled implementation, not a supplied privileged callback. Add after-wait/precommit rechecks using actual DB clock; no noop owner branch.
- [ ] Add local-unix-peer transport alternative only to current provisioning controller, preserving URL compatibility/genesis. Test option construction and identity refusal without connecting or creating anything.
- [ ] Run `node --import tsx --test tests/findings/fresh-recovery-owner-operations-v1.test.ts tests/installation/fresh-installation-unix-peer-v1.test.ts`.

## Task 2: Actual completion coordination and child mutations

**Files:** runtime-completion narrow chain export; finding/delivery repositories; recovery coordinator/effect; GitHub resolution repository; spawner coordinate routing; same focused owner test.

**Interfaces:** Fixed coordinateCurrentEffect consumes existing effect identifiers, actual ALS and lease fields, reloads payload/manifest/context from DB and returns existing V3RecoveryEffectCoordinateResult. Required opaque owner repository mode is private to this facade. Existing ordinary repository constructors remain unchanged for runtime callers.

- [ ] Regress exact current finding publication failure, then implement explicit owner entry/live/precommit placements in evidence/findings publication, case open/transition, revision advance/authorization and delivery completion. Preserve existing internal publication reservation writes, duplicates, CAS, terminal/native settlement and branch semantics. Every early result finalizes its fence.
- [ ] Reuse canonical completion chain/manifest/effect lease order, including actual owner generation and drained runtime; no authority locks held by outer coordinator across owner child BEGINs. Strict selected current-revision reader never rehydrates legacy state.
- [ ] Preserve real GitHub observation outside SQL. Bind actual observation hash/authority privately; fixed evidence put/resolve retain existing PR/head/thread/source and atomic case/delivery checks. No caller-supplied verdict or permanent review disable.
- [ ] Run owner-operation test; prove wrong effect token/generation/hash/source, wait-expiry/precommit expiry, takeover and lost reply leave existing durable replay result/budget intact. Keep heartbeat coexistence and ordinary-path refusal assertions.

## Task 3: Proven next delivery lifecycle, without an RCR fiction

**Files:** Exact claim/work-router, native/attempt/runtime-session, owner-lease, evidence-only worker/runtime/publication, lifecycle reconciler, terminal/refusal seams in the spec File Map; new lifecycle component test.

**Interfaces:** Named fixed facade operations are acquireNextRecoveryWork/acquireRecoveryClaim, reserveRecoveryAttempt, markRecoveryRuntimeRunning, heartbeatRecoveryOwner/relinquishRecoveryOwner, runEvidenceOnlyRecovery, reconcileRecoveryLifecycle, settleRefusalRecoveryLineage, transitionRunRecoveryTerminal. Consume existing schema-typed domain inputs/results. Each reloads its own real authority family; none borrows a settled completion-effect lease.

- [ ] Write failing components at actual acquireRecoveryClaim UPDATE, native reserve outer tx + delivery bind and runtime session/attempt/delivery running tx. Route the whole existing transaction to the owner implementation; never split atomic delivery DML from attempt/session birth.
- [ ] Route actual owner heartbeat/relinquish and terminal evidence heartbeat with current case/revision/dispatch, original runtime/attempt/claim, generation/fence and DB-clock lease checks. Preserve no-revival and stale-owner denial.
- [ ] Route evidence-only acquire/reserve/running/quarantine/native settlement and direct coordinator, including actual v3-evidence-only-publication.ts reservation BEGIN1514, running BEGIN1643 and native delivery DML1479/1678 through genuine delivery/terminal-child authority. Retain actual native Git/source/artifact/custody proofs. No invented model RCR.
- [ ] Route existing lifecycle candidate mutations, using its existing expiry/drain/completion observations and canonical locks; preserve quarantine/report outcomes. Do not expose unused delivery.leaseNext/markRunning or authorizeDispatch APIs just because they exist.
- [ ] Route exact refusal-lineage settlement and failed/cancelled full terminal-recovery transaction from the existing run-termination entry before BEGIN. Keep step-advance's existing outer BEGIN90/run lock94 -> terminal helper183 and completeRun's zero-recovery success path unchanged/restricted; do not call a new owner BEGIN while those callers hold run locks. Preserve successful-completion residue refusal. Terminal-close replay and lease takeover must not change another chain.
- [ ] Run `node --import tsx --test tests/findings/fresh-recovery-owner-operations-v1.test.ts`.

## Task 4: Proportional verification and freeze

- [ ] Run exact author unit lane:

```sh
node --import tsx --test --test-concurrency=1 tests/findings/fresh-recovery-owner-operations-v1.test.ts tests/installation/fresh-installation-unix-peer-v1.test.ts tests/installation/fresh-installation-spawner-retention.test.ts
node --import tsx --test --test-concurrency=1 tests/execution-attempts/runtime-completion-effect-runner.test.ts
node node_modules/typescript/bin/tsc --noEmit
git diff --check
```

- [ ] Maintain real SQL contract cases in the listed terminal-recovery-locks component: actual current_user=selected NOLOGIN owner after SET LOCAL ROLE, ordinary restricted same SQL/direct semantic DML denied, commit/rollback reset and lease/precommit rollback. Author does not run DB checks or fabricate a pool/role as evidence. Root uses bounded ROLLBACK-only actual selected-production checks of owner current_user, role reset and direct runtime DML denial; no isolated deployment/database/cluster prerequisite is introduced.
- [ ] Inspect originals and freeze exact file hashes plus private0600 argv/PID/time/exit/raw captures. Report unit/integration/runtime limits separately. Root independently reviews the complete finite family; no full-host or full-suite tour.
- [ ] Stop author delivery. Root owns staging/commit/PR/merge, genuine clean-main stock build and guarded later qualification. Do not manually resume/rewrite old game2, raise retry budgets, grant runtime DML or call the system fixed before actual owner/direct-denial evidence and fresh run outcome.

## Design review gate

The design was independently CLEAR and Root released implementation. The author now freezes the Source candidate and exact original captures for whole-diff review. The peer bootstrap alternative is included solely because current TCP-only maintenanceUrl cannot use the already-hardened host transport for the next Source-bound installation; independent review may reject that narrow seam if Root has a supported existing alternative.

Review corrections applied: actual evidence-only-publication transaction seam added; step-advance successful zero-recovery transaction remains restricted with no nested owner BEGIN; real privilege verification is Root's bounded production ROLLBACK-only check, never an isolated environment prerequisite. Ordinary/nonlocking reads stay restricted; the executor owns private mutation writers and reuses existing canonical fences. Source48/run2 rollout limitations are explicit in the spec; no relabel/manual repair/stop bypass or new upgrade framework.

Root-approved causal seam: `src/execution/v3-implementation-attempt.ts` forwards the private optional owner access only through the selected native recovery/evidence reservation convenience calls. Existing artifact preparation and ordinary restricted defaults remain unchanged.

Final proportional author lane: two new unit files plus the existing pure runtime-completion-effect-runner regression, noEmit, semantic-digest check and diff check. The initially listed claim/lifecycle/evidence-worker suites create isolated databases and are excluded to honor the explicit no-isolated-environment constraint. Native reservation, lifecycle and terminal bindings are implemented through existing transaction bodies but not SQL-engine qualified by author fixtures. Actual role/direct-DML denial and full fresh-run acceptance remain Root-owned. The separate planned lifecycle unit file was not needed; bounded claim-entry and lease-expiry behavior lives in owner-operations tests.

Root-approved generated digest File Map addition: `src/db/contract-spine-migration-digests.generated.ts`, regenerated from the actual approved v33 closure with the existing updater; no guard bypass or existing database journal rewrite.

Final accepted review corrections use existing mapped authority/publication/startup bodies: original terminal-child lease deadlines (including pending native-success settlement), owner terminalize only, stable socket ancestor identity and pre-drain startup owner close. Additional approved File Map: `src/installation/fresh-installation-activation-v1.ts` and `tests/installation/fresh-installation-spawner-retention.test.ts`.

Exact author final lane: owner-operations + peer/create/activation unit + affected retention unit + existing runtime-completion-effect-runner; then noEmit, semantic-digest check, diff check. The excluded existing suites initialize databases in their before hooks: claim-authority.test.ts89–90, lifecycle-reconciler.test.ts611–612, evidence-only-worker.test.ts216–217. They remain unrun, and no native/lifecycle/terminal SQL-engine coverage is claimed. Root confirmed this exclusion and owns clean stock build plus real production canary.
