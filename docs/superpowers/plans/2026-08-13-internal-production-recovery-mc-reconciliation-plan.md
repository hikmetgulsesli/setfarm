# Internal Production Recovery and Mission Control Reconciliation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete all ten controlled recovery scenarios and prove that PostgreSQL, Setfarm operational snapshots, Mission Control APIs, and the rendered Mission Control UI agree for the same campaign run identities before, during, and after supported restarts.

**Architecture:** Setfarm remains the only workflow and mutation authority. A Setfarm-owned, observation-only recovery evidence recorder captures canonical hashes and leak censuses around explicit actions; its pure parser verifies only self-contained structure and hashes, while a separate asynchronous authority verifier resolves golden results and action receipts from their content-addressed stores. A thin coordinator stages safe live service/GitHub scenarios through C's exact `GoldenAssertionEnabledCaseExecutorV1`, durably and exhaustively persists its staged, pre-run, or blocked outcome before any continuation, permits execution/recovery only for staged, and otherwise fails closed before scenario mutation; actual crash boundaries use an isolated-PostgreSQL, real-child-process fixture. The fixture synchronizes at owning source boundaries with a one-use run/generation-bound capability rather than polling live state. Mission Control removes its remaining completed-run re-derivation, adds a diagnostic-only reconciliation envelope assembled from the canonical Setfarm snapshot and direct PostgreSQL census, and renders exact authority states without becoming a second control plane. Every live receipt, browser sample, and private campaign file is written through fixed-root, no-follow stores below B's validated internal-production data root at `recovery/`; callers cannot choose an output path.

**Tech Stack:** TypeScript ESM, Node.js 22+, React 19, Express 5, PostgreSQL, `node:test`, Playwright, GitHub CLI, macOS LaunchAgents.

**Spec:** `docs/superpowers/specs/2026-08-13-setfarm-mission-control-internal-production-closure-design.md`

## 2026-08-16 Execution Rebaseline

Product Build Authority V2 and `setfarm.run-operational-snapshot.v3` are already delivered inputs. Recovery execution starts only from an execution-time exact clean synchronized Setfarm `main` descendant that retains reviewed Authority-V3 PR #86 merge `1d691c89760339ea905dfe17f8e9188e62603c1c` as an ancestor, after contract-spine migration 31 is independently verified current, services are rebound through the code-owned zero-owner path, and a fresh clean prerequisite canary proves its one terminal-preclaim lifecycle. The historical `865a7157`/migrations-1-through-29 baseline and polluted run 2075 remain evidence only.

Every D import, preflight, scenario guard, execution, recovery, status, reconciliation, acceptance, and finalization chain freshly resolves A's exact `InternalProductionPostRebindEntryAuthorityPairV1`, requires byte equality with the same pair carried B→C in the authenticated matrix authority, and equality-binds it to the same execution-time source pair. A missing, stale, copied, cross-paired, or source-drifted successor blocks before observation with acceptance effect or mutation.

### Exact C-to-D post-rebind binding

The D composition root, live inflight store, packet finalizer, and operational-acceptance recorder statically import without alias `InternalProductionPostRebindEntryAuthorityPairV1`, `resolveInternalProductionPostRebindEntryAuthorityV1`, and `verifyCurrentInternalProductionPostRebindEntryAuthorityV1` only from `./baseline-post-handoff-receipt-v1.js`. Before D's first campaign prepare/import/preflight/status seal/scenario guard or mutation, production zero-input verifies A's current successor, pair-only resolves it, resolves C's exact `GoldenMatrixReceiptV1`, and requires byte equality with C's carried pair. No D CLI, campaign, executor port, status resolver, or caller accepts either scalar locator.

`RecoveryLiveGoldenInflightStatusV1`, `RecoveryFinalizedPacketV1`, `RecoveryPacketIndependentReviewReceiptV1`, and `RecoveryOperationalAcceptanceV1` repeat non-null exact `postRebindEntryAuthorityRef`/`postRebindEntryAuthorityHash`; every scenario evidence/selection carries the same pair through its final epoch. A status before authenticated C import is absent and has both fields null; every persisted coordination or later D state has both non-null, with no half-null branch. Source-boundary/AST tests enforce the direct A imports and first-call order. Runtime/store tests reject caller fields, structural clones, stale-current A, A/C cross-pairs, null splits, pair drift across status/evidence/finalization/review/acceptance, nested predecessor tamper, status/store tamper, and source mismatch before any scenario effect. D status JSON exposes the exact pair for fresh A equality extraction only; it never accepts it back.

Every fence that invokes a Setfarm package command consumes authenticated read-only `SETFARM_ROOT` and `SETFARM_ROOT_EXPECTED_SHA` bindings supplied by the applicable receipt resolver. It independently verifies clean literal `main` and `HEAD === refs/remotes/origin/main === SETFARM_ROOT_EXPECTED_SHA` before invocation. A missing binding or workstation-path fallback fails before observation or mutation.

## Global Constraints

- This plan implements Subproject D. Tasks 1–6 source work begins only after Subproject A is accepted and Subprojects B/C source is reviewed and merged; it does not consume earlier live profile passes. D live execution/private finalization waits until E source has also merged. On that exact final operational Setfarm/Mission Control epoch, the order is `C full matrix -> D ten scenarios/reconciliation/private finalization/review -> D RecoveryOperationalAcceptanceV1 -> E fleet`; only one later E docs claim materializes C/D/E packets, after which E's one-way integration adapter resolves E handoff authority and calls D's separate `RecoveryDocsDeliveryAcceptancePortV1` metadata boundary.
- PostgreSQL rows, claims, runtime sessions, completion/effect ledgers, observations, and exact GitHub state outrank Setfarm projections; Setfarm projections outrank Mission Control API/UI; agent prose is never authority.
- Mission Control is a read-only projection for workflow state. Its mutation endpoints may call Setfarm-owned actions but may not update canonical run, claim, completion, or effect rows.
- The recovery evidence recorder is observation-only. It may hash, compare, and persist bounded evidence, but it may not restart services, kill processes, issue retries, write database state, or become a second workflow engine. The coordinator may invoke only the safe `RecoveryActionPort` operations, the authenticated `RecoveryAcceptedProductRuntimePort`, or the finite isolated `RecoveryProcessFixturePort` scenarios after their guards pass. The two service actions delegate their only side effect to D's shared `InternalProductionServiceRestartAuthorityV1` under namespace `recovery-active-run`; neither the recorder nor `RecoveryActionPort` contains a direct `launchctl` invocation.
- Fault injection uses an existing test or authenticated operational seam. Never kill an arbitrary process, edit PostgreSQL state, forge GitHub state, or inject a fault while an unrelated run is active.
- Each scenario's `before` checkpoint permits only the exact target/checkpoint-bound claim, runtime, completion/effect, lease, process, listener, and worktree identities enumerated in `targetOwnership` and asynchronously authenticated to its B lifecycle receipt, C post-PR action receipt, or D process/action receipt. Every unrelated ownership count is zero. The `after` checkpoint has no target ownership and its complete ownership census is all-zero.
- Each executed scenario ends as `accepted_continuation` or nonselectable `scenario_attempt_failure`; only scenario 5 (`provider_quota_failure`) and scenario 6 (`github_review_retry`) may instead end in their finite `typed_terminal`. A finite preflight refusal is stored separately and never fabricates run/checkpoint evidence.
- Failed, cancelled, and completed records remain visible. Do not delete history, rewrite an immutable V3 deployment receipt, or relabel a terminal run as active.
- Product Build Authority, failure owner, retryability, operational evidence, and typed terminal state are passed through from Setfarm contracts. Mission Control may report a mismatch but may not resolve one locally.
- Preserve live ports: Mission Control `3080`, Setfarm dashboard `3333`, OpenClaw gateway `18789`.
- Do not use `SETFARM_ALLOW_DIRTY_BUILD`, `SETFARM_SKIP_RUNTIME_GUARD`, or `--skip-runtime-guard`.
- No secret value, `.env`, LaunchAgent environment value, database dump, runtime artifact, screenshot cache, or local log is committed.
- B's `resolveInternalProductionDataRootV1()` derives the sole production-private root exactly as ``${runtimeConfig.setfarmDir}/internal-production`` from trusted runtime configuration and accepts no caller, CLI, environment, package-root, worktree, or `cwd` override. Every private recovery directory is a real mode-`0700` descendant below its `recovery/` child; every evidence, action, browser, control, finalization, and private packet file is a regular mode-`0600` file opened with `O_NOFOLLOW`. Resolve and re-check realpath containment at every directory component, reject symlinks/hardlinks, and expose canonical refs and hashes rather than absolute paths. The CLI accepts no output root or output path.
- Serialize cross-repository integration. Setfarm owns the single source run and its claims, worktrees, branch, commits, push, PR, review transition, merge, and cleanup; Mission Control uses one normal serialized PR branch only after that Setfarm merge is authoritative.
- Setfarm developer, reviewer, supervisor, QA, and final-test workers never create or switch branches, stage, commit, push, open/ready/merge a PR, or synchronize `main`. They may edit only their immutable claim scope, run claim-bound checks, inspect Git read-only, and submit the exact claim output through the claim-provided `setfarm step complete` command. The Setfarm completion owner performs every Git handoff after gates pass.
- Every behavior change is test-first. Stop and report after the same canonical systemic cause recurs three times after fixes.
- Every `bash` fence starts with `set -euo pipefail`. Any fence that invokes D's Setfarm package command first consumes the authenticated clean-main `SETFARM_ROOT`/`SETFARM_ROOT_EXPECTED_SHA` contract above, validates it independently, marks it readonly, and invokes exactly `npm --prefix "$SETFARM_ROOT" run --silent acceptance:recovery -- ...`; a bare `npm`, `cd`-dependent package lookup, inherited npm prefix, Mission Control `cwd`, or hard-coded checkout path is never authority. Plan/source-boundary tests execute every owner, claim, synchronization, delivery, cutover, campaign, scenario-verification, finalization, review, and materialization verb from an unrelated empty temporary `cwd` and prove exact identical dispatch; missing/wrong root and poisoned npm prefix fail before observation or mutation. They also parse every shell fence and reject a service, database, run/workflow, or Git mutation unless the immediately preceding command obtains a fresh code-owned authority guard and the mutating command consumes that exact canonical ref/hash. They specifically ban raw `launchctl`, raw `workflow run`, and worker-side `git switch|checkout|pull|fetch|merge|reset|add|commit|push`. Mission Control canonical status/clean/`HEAD === origin/main === owner-sync receipt SHA` is observed before any delivery-owner synchronization or claim creation; workers receive only an authenticated claim worktree/branch/base and never synchronize it themselves. The same tests reject a negative `rg` scan hidden in a pipeline, a match-then-exit expression followed by an unconditional-success fallback, `$(` anywhere in a `test`, `[`, or `[[` predicate, a `readonly`, `export`, `local`, or `declare` invocation, another outer command's argv, or a redirection, and any other masked/bare fallback; command substitution is allowed only in a standalone simple assignment or the enumerated status-aware `if VAR="$(negative scan)"` captures. Transcript fixtures prove that a match status `0` fails, only status `1` with exactly empty captured output passes, status `1` with output and statuses `2`/`127` fail, an upstream Git-diff failure stops before either diff or tree `rg` runs, every inner producer's injected nonzero status stops the fence before its consumer, both producers formerly embedded in every dual-substitution equality fail independently before the predicate, and nonempty tracked or untracked cleanliness output stops all later mutation and evidence publication.

## Exact Source and Evidence Delivery Sequence

1. Require Subproject A acceptance plus the reviewed Subproject B lifecycle checkpoint contract and Subproject C canonical bug-fix `post-pr-review` source merge on Setfarm `main`. No live Profile 1–3 prerequisite applies to Tasks 1–6. From clean synchronized Setfarm `main`, invoke only A's already-delivered `acceptance:baseline-post-handoff` recovery-source bootstrap prepare/zero-input-resume boundary to start one canonical V3 source run for Tasks 1–2. D's `acceptance:recovery` package command does not yet exist and cannot authorize its own source delivery. Setfarm creates every immutable claim and isolated worktree, owns the managed branch and Git/PR handoff, enforces review, merges, cleans up, and publishes the source merge receipt; workers only edit claim scope, run checks, inspect read-only state, and call their exact claim-provided `setfarm step complete` command.
   D accepts that bootstrap result only when A's final source receipt binds both exact target reservation pairs `targetSourceRunReservationRef`/`targetSourceRunReservationHash` and `targetRunReservationRef`/`targetRunReservationHash`, both terminal pairs `terminalSourceRunRef`/`terminalSourceRunHash` and `terminalRunLaunchRef`/`terminalRunLaunchHash`, the single compound `targetReservationPairCloseRef`/`targetReservationPairCloseHash`, and the later fence-release pair in that order. A singular target reservation/close, a source-run reservation reused by a claim/runtime/completion/effect/process/listener/worktree owner, a close before both terminals, or downstream owner admission before fence release is rejected.
2. With the Setfarm producer merge already on clean `main` and A physical-restart epoch one still authoritative, synchronize clean Mission Control `main`, create only `feat/internal-production-mc-reconciliation`, implement Tasks 3–5, review it, merge it, and return Mission Control to clean synchronized `main`. D generic restart preparation remains disabled throughout both source deliveries.
3. Build and verify both D source merges from clean synchronized `main`; activate and freshly resolve the exact reviewed `A+B+C+D` 43-producer manifest set before `d-startup-hook-load`, any D producer, or any service mutation. Then use A's exact migration-bound `d-startup-hook-load` sequence to load the reviewed spawner, dashboard, and Mission Control hooks while epoch one remains active, and let A's code-owned observer/recorder publish all-three-hook readiness and atomically expose the A-retirement/D-activation epoch-two cutover under fresh global zero through D's sole reviewed adapter. Only after that chain resolves may E source begin and merge. Record the later exact final operational Setfarm/Mission Control pair and create B's exact final-release epoch. Run C's full current-epoch Profiles 1–7 matrix; earlier epoch results remain history but do not qualify. Only then import/resolve the required identities, load the already reviewed D campaign that embeds C's immutable bug-fix template, and execute Tasks 7–9 without modifying tracked source. The first scenario-6 launch and every later retry/new epoch persist a new B intent before C provisions that intent's fresh repository/remote attempt. All execution evidence remains below B's global production-private data root, outside every package worktree.
4. After all ten current-epoch D scenarios and D reconciliation settle with asynchronous authority verification and zero global owners, privately finalize and independently review the D packet below B's global data root while both repositories remain clean. Record and export the canonical `RecoveryOperationalAcceptanceV1` ref/hash, which in turn binds the private finalization ref/hash; only then may E run its fleet against that authority. A repair or source drift repeats the exact current-epoch sequence `C full matrix -> D ten scenarios/reconciliation/private finalization/operational acceptance -> E fleet`. After E fleet finalization, E starts one separate Setfarm-owned final docs run that materializes C, D, and E packet targets; workers call only their claim-provided `setfarm step complete`, and Setfarm owns all Git/PR/review/merge work before clean-main verification repeats. Only E's post-handoff integration adapter may call D's `RecoveryDocsDeliveryAcceptancePortV1` after resolving the combined authority; it never feeds back into operational admission.

Never mix Setfarm producer work, Mission Control consumer work, live evidence collection, private packet finalization, or tracked packet materialization in one writing phase. A source PR is merged before its clean-main build identity can enter evidence; the later Setfarm-owned documentation handoff is never substituted for either verified source SHA.

## Entry Evidence and Stable Identities

Subproject D consumes Subproject B's exact result, content-addressed store, repository, and observer; it does not create a second golden-run harness, repository, or projection layer:

```ts
import type { GoldenRunResultStore } from "./golden-run-store.js";
import type {
  GoldenStartedRunResultV1,
  LoadedGoldenCampaignV1,
} from "./golden-run-contract-v1.js";
import type { GoldenRunRepositoryOptionsV1 } from "./golden-run-repository.js";
import { createPostgresGoldenRunRepository } from "./golden-run-repository.js";
import type {
  GoldenLaunchOperationMigrationCurrentVerificationV1,
} from "./golden-launch-operation-migration-release-v1.js";
import {
  verifyCurrentGoldenLaunchOperationMigrationV1,
} from "./golden-launch-operation-migration-release-v1.js";
import type {
  GoldenCaseExecutionOutcomeV1,
  GoldenExternalLifecycleCheckpointImplementationIdV1,
  GoldenExternalLifecycleCheckpointCapabilityV1,
  GoldenLifecycleCheckpointReceiptV1,
  GoldenRegisteredExternalLifecycleCheckpointV1,
  GoldenServiceRestartActionPortV1,
  GoldenServiceRestartActionReceiptV1,
} from "./golden-run-harness.js";
import {
  authenticateGoldenExternalLifecycleCheckpointCapabilityV1,
  createGoldenExternalLifecycleCheckpointCapabilityV1,
  createGoldenRegisteredExternalLifecycleCheckpointV1,
} from "./golden-run-harness.js";
import type {
  GoldenRepositoryWorkflowEvidenceResolverV1,
} from "./repository-workflow-integration-authority-v1.js";
import {
  createGoldenRepositoryWorkflowEvidenceResolverV1,
} from "./repository-workflow-integration-authority-v1.js";
import type {
  GoldenRepairReviewObserverV1,
  GoldenRepairReviewScenarioV1,
} from "./golden-repair-review-observer-v1.js";
import {
  createGoldenRepairReviewObserverV1,
} from "./golden-repair-review-observer-v1.js";
import type { GoldenMatrixReceiptV1 } from "./golden-matrix-runner.js";
import {
  createGoldenRecoveryAssertionEnabledCaseExecutorV1,
  resolveGoldenMatrixReceiptV1,
} from "./golden-matrix-runner.js";
import type {
  GoldenDocsMaterializationEntryCommitReceiptV1,
  GoldenDocsMaterializationSessionV1,
} from "./golden-run-report.js";
import {
  commitNextGoldenDocsMaterializationEntryV1,
} from "./golden-run-report.js";
export function createLiveGoldenProjectionObserver(): GoldenProjectionObserver;

// D imports B's exact outcome/result types only. It never imports or calls
// executeGoldenCaseV1; every live case stages, executes, and recovers solely
// through C's authenticated assertion-enabled staged gateway.

export interface RecoveryControlValueV1 {
  schema: "setfarm.internal-production-recovery-control-value.v1";
  name:
    | "golden-campaign-hash"
    | "recovery-campaign-hash"
    | "cli-result-hash"
    | "api-result-hash"
    | "web-result-hash"
    | "cli-run-id"
    | "api-run-id"
    | "web-run-id";
  value: string;
  controlReceiptHash: string;
}
```

`GoldenRunRepositoryOptionsV1` is B's one exact imported options identity, including its optional `artifactRoot`, `artifactLimits`, `publicationAuthorityMode`, and `workflowEvidence?: GoldenWorkflowEvidenceCollectorPort` members. D never declares an interface/type alias, partial pick, wrapper options object, or overload for it. Production D consumes C's already constructed repository by exact reference and does not call the factory again; the imported factory/options symbols pin compile-time compatibility and any focused test construction must pass an object checked as `GoldenRunRepositoryOptionsV1`. Omitting B's `workflowEvidence` member from a lookalike type or replacing C's collector in live composition is a contract failure.

`GoldenRunResultV1` is the strict Subproject B schema. It contains campaign/case/profile identity, exact run identity, classification, trusted cause, projection evidence, terminal census, and `resultHash`. Tasks 1–6 import no live status. At D live entry after E source merge, C's full current-epoch Profile 1–7 matrix receipt must be `decision:"accepted"` on the exact final operational SHA pair; D resolves only its required accepted Profile 1–3 identities from the ordered result hashes. Resolve each hash with `GoldenRunResultStore.get(resultHash)`; never treat a store ref or hash as a filesystem path. The pure recovery parser cannot make this claim: `verifyRecoveryScenarioEvidenceAuthority(...)` performs the asynchronous store resolution and exact identity comparison. Profile identities used below are `node-cli`, `node-express-api`, and `vite-react-web`. Do not hard-code generated run IDs in source. Missing, duplicate, non-V3, non-accepted slot, hash-invalid, or release-drifted results fail closed.

Task 2 installs the command and fixed store, but no entry status is imported here. Task 7 contains the sole import/resolve sequence, after Task 6's source barrier, E's source merge, and C's full current-epoch matrix rerun. `import-golden-status` must bind a schema-valid `decision:"accepted"` matrix receipt to B's exact `GoldenFinalReleaseEpochV1` whose Setfarm and Mission Control SHAs equal the final operational source pair, and resolve accepted ordinal-1 slots for Profiles 1–3. It rejects `ready`, `running`, `blocked`, an earlier epoch, or a missing/non-accepted required slot. Earlier-epoch results remain stored history and are rejected as D entry authority.

D imports C's exact `prepareGoldenExistingRepositoryTemplatesV1`; it does not redeclare the function or its return. The function's finite `campaignId` union is only `"setfarm-mc-internal-production-v1" | "internal-production-2026-08-13" | "internal-production-fleet-2026-08-14"` and it returns deeply frozen path-free templates plus their set hash. D supplies only `"internal-production-2026-08-13"`, embeds the returned bug-fix template in its raw B campaign, and leaves every repository/remote/fixture-attempt identity to C's sole per-intent provisioner after B has fsynced the exact launch intent.

## File Map

### Setfarm recovery evidence producer

- Create `setfarm/src/internal-production/recovery-evidence.ts` — strict evidence schema, canonical hashing, transition validation, and zero-leak acceptance.
- Consume without redeclaration `setfarm/src/contracts/operational-active-run-status-v1.ts` — A's sole `isSetfarmOperationalActiveRunStatusV1` producer used by D reconciliation.
- Create `setfarm/tests/internal-production/recovery-evidence.test.ts` — schema, hash, outcome, and leak regressions.
- Create `setfarm/scripts/internal-production-recovery-evidence.ts` — observation-only `capture-before`, `capture-after`, and `verify` CLI.
- Create `setfarm/tests/internal-production/recovery-evidence-script.test.ts` — CLI argument and no-mutation boundary tests.
- Create `setfarm/src/internal-production/recovery-scenario-runner.ts` — finite router between Subproject B live execution and isolated process-integration evidence.
- Create `setfarm/src/internal-production/recovery-scenario-execution-guard-v1.ts` — strict short-lived content-addressed scenario guard issuer/resolver/one-use consumer binding the complete command, epoch, build, and ownership authority.
- Create `setfarm/tests/internal-production/recovery-scenario-execution-guard-v1.test.ts` — issue/resolve/consume, adjacency, expiry, replay, response-loss recovery, and argument/source/build/ownership drift tests.
- Create `setfarm/src/internal-production/recovery-live-inflight-store-v1.ts` — strict coordination plus exact C staged/pre-run/blocked outcome status ref/hash store used before execution and by fresh-process recovery.
- Create `setfarm/tests/internal-production/recovery-live-inflight-store-v1.test.ts` — exhaustive stage-outcome persistence, staged-only side effects/recovery, terminal non-staged blockers, status CAS, crash, tamper, and no-dead-shell identity tests.
- Create `setfarm/tests/internal-production/recovery-scenario-runner.test.ts` — one-harness-call, guard, action, result, and settlement tests.
- Create `setfarm/src/internal-production/recovery-composition.ts` — sole production composition over C's fixed matrix ports and the scenario-specific lifecycle checkpoint selection.
- Create `setfarm/tests/internal-production/recovery-composition.test.ts` — exact object-identity wiring, narrow executor, and no-override tests.
- Create `setfarm/tests/internal-production/recovery-source-boundary.test.ts` — forbid alternate production factories, raw harness overrides, and D-owned GitHub review actions.
- Create `setfarm/src/internal-production/recovery-action-port.ts` — guarded implementations of only the two service restarts; scenario 6 consumes C's exact post-PR action/checkpoint implementation, scenario 10 uses its separate sealed-runtime port, and unsafe faults stay in the isolated process fixture.
- Create `setfarm/src/internal-production/internal-production-service-restart-authority-v1.ts` — the sole reusable, path-free Setfarm/MC restart operation plus A-acquired seven-target family, immutable authorization operation, shared per-service start-slot CAS, `ordinary-starting` claim/publication/settlement, acyclic terminal core/compound close/occurrence/head/release/final-envelope chain, helper, child, PID, startup-marker, and resolver authority for the exact `recovery-active-run`, `source-release-barrier`, `cold-rehearsal`, and `documentation-handoff` namespaces; it identity-re-exports A's readiness/activation/cutover contracts and the exact `InternalProductionServiceRestartTerminalCoreV1`, `InternalProductionRecoveryRestartTargetSetCloseV1`, `resolveInternalProductionServiceRestartTerminalCoreV1`, and `resolveInternalProductionRecoveryRestartTargetSetCloseV1` symbols required by E, and contains the sole reviewed adapter that imports A's exact prepare and zero-input resume cutover mutations unaliased.
- Create `setfarm/src/internal-production/recovery-owner-producer-manifest-activation-v1.ts` — the sole zero-input D manifest activation controller, strict content-addressed D activation receipt/resolver, and read-only fixed status over A's `A+B+C` predecessor and `A+B+C+D` successor.
- Create `setfarm/tests/internal-production/recovery-owner-producer-manifest-activation-v1.test.ts` — exact A11/B10/C6/D16 manifest parity, reviewed clean-source/build gate, strict predecessor and successor receipt/head CAS pairs, receipt/status, crash, response-loss, and activation-before-hook-load/before-cutover/before-producer tests.
- Create `setfarm/src/internal-production/internal-production-service-restart-startup-v1.ts` — the sole Setfarm startup claim/marker adapter used by both spawner and dashboard before ownership/listen and the sole two-phase ordinary owner/listener publication completion/recovery consumer.
- Modify `setfarm/src/internal-production/setfarm-completion-owner-receipt-activation-controller-v1.ts` — reviewed finite `d-ordinary-start` and `d-managed-restart` startup-admission successors; the managed branch consumes only D's freshly resolved successful setfarm-spawner operation/startup/terminal reservation/completion/occurrence/head authority for the four approved namespaces.
- Create `setfarm/scripts/support/internal-production-service-restart-helper-v1.ts` — the only fixed helper executable; it claims one named durable operation before spawning, captures, owns, terminates, and reaps its exact `launchctl kickstart -kp` child, and accepts no caller command, label, path, PID, or environment authority.
- Create `setfarm/tests/internal-production/internal-production-service-restart-authority-v1.test.ts` — predispatch durability, shared service-start-slot CAS, ordinary/restart linearization, helper/child fencing, PID/marker adoption, terminal settlement, namespace isolation, crash, and no-duplicate tests.
- Create `setfarm/tests/internal-production/internal-production-service-restart-source-boundary.test.ts` — AST ownership bans for direct `launchctl`, duplicate helpers/startup writers, shell execution, scans, aliases, and dynamic imports.
- Create `setfarm/tests/internal-production/internal-production-service-restart-startup-v1.test.ts` — spawner/dashboard startup ordering, reservation-backed exact operation claim/marker, two-phase ordinary launchd claim/owner-listener/settlement, login/reboot/crash relaunch without marker, all-namespace CAS races, non-launchd/wrong-parent refusal, crash recovery, and ambiguity tests.
- Modify `setfarm/tests/internal-production/setfarm-completion-owner-receipt-activation-controller-v1.test.ts` — strict D ordinary/managed branch identities and null relations, expected-predecessor CAS, four-namespace managed completion, crash/replay, fallback exclusion, and normal-poll barrier tests.
- Create `setfarm/src/internal-production/recovery-action-receipt.ts` — strict action-receipt union, canonical hashes/refs, and fixed-root content-addressed receipt resolver.
- Create `setfarm/src/internal-production/recovery-process-fixture-receipt.ts` — strict content-addressed process-fixture receipt/resolver with scenario-specific mutation and cleanup authority.
- Create `setfarm/src/internal-production/recovery-attempt-store.ts` — immutable evidence/attempt history, selected-attempt receipts, cumulative systemic-root stop, and repair-consumption admission.
- Create `setfarm/src/internal-production/recovery-repair-review.ts` — D-owned reviewed repair receipt/resolver/one-use consumer for actual-process evidence only.
- Create `setfarm/src/internal-production/recovery-accepted-product-repair-review.ts` — D-owned scenario-10 reviewed repair receipt keyed by failed evidence/root while preserving the accepted B source result.
- Create `setfarm/src/internal-production/recovery-browser-continuity.ts` — fixed Mission Control run-route Playwright poller used inside restart checkpoint actions.
- Create `setfarm/src/internal-production/recovery-packet-review.ts` — strict independent private-packet review observation, content-addressed receipt/store/resolver, and zero-unresolved admission.
- Create `setfarm/tests/internal-production/recovery-packet-review.test.ts` — receipt schema, packet/epoch/rerun binding, finding, content-address, tamper, and crash tests.
- Create `setfarm/src/internal-production/recovery-docs-delivery-acceptance.ts` — D-owned docs-delivery schema and one-way recording port with no E import.
- Create `setfarm/tests/internal-production/recovery-docs-delivery-acceptance.test.ts` — fake-port, store, content-address, and no-E-dependency tests.
- Create `setfarm/src/internal-production/recovery-accepted-product-runtime.ts` — authenticated sealed-runtime rehydration and durable API restart proof for scenario 10.
- Create `setfarm/tests/internal-production/recovery-action-port.test.ts` — service target identity, argv, timeout, checkpoint-bound ownership, and unrelated-owner refusal tests; it contains no GitHub mutation fake or implementation.
- Create `setfarm/tests/internal-production/recovery-action-receipt.test.ts` — union parsing, content-addressed resolution, no-follow containment, and tamper tests.
- Create `setfarm/tests/internal-production/recovery-process-fixture-receipt.test.ts` — receipt hashing, resolver, campaign/generation/checkpoint, scenario assertion, ownership, cleanup, and tamper tests.
- Create `setfarm/tests/internal-production/recovery-attempt-store.test.ts` — retained history, selection, repair admission, cumulative three-stop, collision, and restart tests.
- Create `setfarm/tests/internal-production/recovery-repair-review.test.ts` — reviewed PR/review/test/build authority and one-use process-repair consumption tests.
- Create `setfarm/tests/internal-production/recovery-browser-continuity.test.ts` — pre-action readiness, ordered polling, disconnect/reconnect, same-run, console, and closure tests.
- Create `setfarm/tests/internal-production/recovery-accepted-product-runtime.test.ts` — sealed contract/source/deployment binding, stop/start, persistence, duplicate listener, and cleanup tests.
- Create `mission-control/server/services/internal-production-service-restart-startup-v1.ts` and `mission-control/server/services/internal-production-service-restart-startup-v1.test.ts`, and modify `mission-control/server/index.ts` — the Mission Control consumer of D's fixed generic startup-claim protocol, awaited before any database/background/listener ownership.
- Create `setfarm/src/internal-production/recovery-checkpoint-port.ts` — finite dependency-injected checkpoint contract and default no-op implementation.
- Modify `setfarm/src/spawner.ts` — inject checkpoints after claim publication/before transfer, after owned runtime publication, and after typed provider failure/before fallback.
- Modify `setfarm/src/server/daemon.ts` — await D's generic dashboard startup claim before PID-file/listener ownership.
- Modify `setfarm/src/execution/runtime-completion.ts` — inject a checkpoint after owner/effect rows commit and before control returns to effect execution.
- Modify `setfarm/src/execution/runtime-completion-effect-runner.ts` — inject a checkpoint after a mandatory effect applies and before its exactly-once settlement.
- Modify `setfarm/src/execution/claim-runtime-publication.ts` — inject a checkpoint after authenticated supervisor directive validation and before generation-safe claim publication.
- Create `setfarm/scripts/support/internal-production-recovery-process-fixture.ts` — script-owned actual-PostgreSQL/child-process fixture implementation for unsafe boundaries.
- Create `setfarm/tests/internal-production/recovery-checkpoint-port.test.ts` — default-no-op and one-use run/generation capability tests.
- Create `setfarm/tests/internal-production/recovery-process-fixture.test.ts` — one-use capability, process restart, generation, and exactly-once integration tests.
- Create `setfarm/scripts/internal-production-recovery-scenario.ts` — guarded live scenario command.
- Create `setfarm/evals/suites/internal-production-recovery-v1.json` — nine immutable logical case specifications; the campaign builder embeds C's path-free immutable bug-fix template before any live start, and scenario 10 consumes the accepted API result.
- Create `setfarm/src/internal-production/recovery-campaign.ts` — fixed-root D campaign builder that calls C's finite-campaign template preparer, embeds the returned bug-fix template, and accepts no path, remote, fixture identity, or attempt authority.
- Create `setfarm/tests/internal-production/recovery-campaign.test.ts` — exact immutable template, no-precreated-attempt boundary, per-intent fresh provisioning, and loaded-campaign tests.
- Create `setfarm/src/internal-production/recovery-packet.ts` — deterministic two-file packet renderer, zero-owner private finalization receipt, and narrow verified tracked materializer.
- Create `setfarm/tests/internal-production/recovery-packet.test.ts` — private-finalization, source/build binding, docs-claim materialization, no-follow, collision, and tamper tests.
- Consume the exact Subproject C `post-pr-review` workflow/module/source changes, `GoldenPostPrReviewActionPortV1`, `GoldenPostPrReviewActionReceiptV1`, `createGoldenPostPrReviewLifecycleCheckpointV1(...)`, and their workflow/head/thread/routing/stage-context tests; D does not add a second post-PR gate, GitHub client, action body, receipt store, or mutation implementation.
- Consume the exact Subproject B discriminated lifecycle generation contract that represents either a V3 story generation or a canonical workflow-step claim generation; D does not redeclare or widen it.
- Modify `setfarm/package.json` — add the `acceptance:recovery` script.
- `setfarm/scripts/internal-production-recovery-evidence.ts` exports the sole canonical `RECOVERY_ACCEPTANCE_COMMAND_GRAMMAR_V1` readonly tuple. Each strict row is `{verb,handler,mutationKind,argvSchema,executionSurface}`; `verb` and `handler` are the exact strings in the table below, `mutationKind` is the finite `read-only | guarded-write`, `argvSchema` is the row's code-owned strict parser identity, and `executionSurface` is exactly `delivery-shell | runtime-workflow`. The CLI dispatch map, help/docs exact list, `package.json` route, source-boundary allowlist, and tests are derived only by iterating this tuple; no second switch, array, table, or fallback exists. The public registry intentionally has forty-two commands: the thirty-two unique verbs invoked by the plan's delivery Bash fences have `executionSurface:"delivery-shell"`; the ten retained runtime/owner workflow verbs `advance-campaign`, `attempt-history`, `capture-before`, `capture-after`, `internal-service-restart-startup-claim`, `recover-live-inflight`, `record-accepted-product-infrastructure-remediation`, `record-accepted-product-repair`, `record-live-repair`, and `record-process-repair` have `executionSurface:"runtime-workflow"` and are called only from the exact runtime/scenario owners named by their handlers. `setfarm/tests/internal-production/recovery-evidence-script.test.ts` imports the exported tuple, requires all forty-two distinct rows in tuple/table order, proves the exact thirty-two/ten partition, executes every delivery-shell row through the package script from an unrelated temporary `cwd`, exercises every runtime-workflow row through its named production call-site integration fixture, and rejects undocumented, unimplemented, duplicate, missing, reordered, misclassified, or fallthrough verbs. The exact generated documentation table is:

  | Verb | Exact handler owner |
  |---|---|
  | `advance-campaign` | `advanceRecoveryCampaignCommandV1` |
  | `activate-recovery-owner-producer-manifest` | `activateRecoveryOwnerProducerManifestCommandV1` |
  | `allocate-packet-review-observation` | `allocateRecoveryPacketReviewObservationCommandV1` |
  | `assert-zero-owners` | `assertRecoveryZeroOwnersCommandV1` |
  | `attempt-history` | `readRecoveryAttemptHistoryCommandV1` |
  | `authorize-mission-control-delivery` | `authorizeMissionControlDeliveryCommandV1` |
  | `browser-acceptance` | `recordRecoveryBrowserAcceptanceCommandV1` |
  | `capture-after` | `captureRecoveryAfterCommandV1` |
  | `capture-before` | `captureRecoveryBeforeCommandV1` |
  | `control-value` | `readRecoveryControlValueCommandV1` |
  | `finalize-packet` | `finalizeRecoveryPacketCommandV1` |
  | `handoff-mission-control-delivery` | `handoffMissionControlDeliveryCommandV1` |
  | `import-golden-status` | `importGoldenStatusCommandV1` |
  | `internal-service-restart-startup-claim` | `claimInternalServiceRestartStartupCommandV1` |
  | `link-source-golden` | `linkRecoverySourceGoldenCommandV1` |
  | `list-live-run-ids` | `listRecoveryLiveRunIdsCommandV1` |
  | `materialize-finalized-packet` | `materializeFinalizedRecoveryPacketCommandV1` |
  | `recovery-owner-producer-manifest-activation-status` | `observeRecoveryOwnerProducerManifestActivationStatusCommandV1` |
  | `prepare-campaign` | `prepareRecoveryCampaignCommandV1` |
  | `prepare-restart-authority-cutover` | `prepareRestartAuthorityCutoverCommandV1` |
  | `probe-service-restart-authority` | `probeServiceRestartAuthorityCommandV1` |
  | `reconcile-live-surfaces` | `reconcileRecoveryLiveSurfacesCommandV1` |
  | `recover-live-inflight` | `recoverRecoveryLiveInflightCommandV1` |
  | `record-accepted-product-infrastructure-remediation` | `recordAcceptedProductInfrastructureRemediationCommandV1` |
  | `record-accepted-product-repair` | `recordAcceptedProductRepairCommandV1` |
  | `record-live-repair` | `recordLiveRepairCommandV1` |
  | `record-process-repair` | `recordProcessRepairCommandV1` |
  | `resolve-golden` | `resolveRecoveryGoldenResultCommandV1` |
  | `resolve-mission-control-delivery` | `resolveMissionControlDeliveryCommandV1` |
  | `record-operational-acceptance` | `recordRecoveryOperationalAcceptanceCommandV1` |
  | `record-packet-review` | `recordRecoveryPacketReviewCommandV1` |
  | `restart-authority-cutover-status` | `observeRestartAuthorityCutoverStatusCommandV1` |
  | `resume-restart-authority-cutover` | `resumeRestartAuthorityCutoverCommandV1` |
  | `verify` | `verifyRecoveryScenarioCommandV1` |
  | `verify-browser-acceptance` | `verifyRecoveryBrowserAcceptanceCommandV1` |
  | `verify-campaign` | `verifyRecoveryCampaignCommandV1` |
  | `verify-docs-delivery-acceptance` | `verifyRecoveryDocsDeliveryAcceptanceCommandV1` |
  | `verify-materialization` | `verifyRecoveryMaterializationCommandV1` |
  | `verify-mission-control-claim-guard` | `verifyMissionControlClaimGuardCommandV1` |
  | `verify-mission-control-owner-sync` | `verifyMissionControlOwnerSyncCommandV1` |
  | `verify-operational-acceptance` | `verifyRecoveryOperationalAcceptanceCommandV1` |
  | `verify-packet-review` | `verifyRecoveryPacketReviewCommandV1` |

  The removed circular `authorize-source-run` and `start-source-run` verbs are neither package routes nor aliases; D Task 1 Step 0 calls A's already-delivered recovery-source bootstrap command instead. Each table handler is implemented, wired, and directly tested in the two named D CLI files before any operational fence may invoke it. `acceptance:recovery-scenario` remains a separate package script with its own exact `guard-scenario | execute | reuse` registry and cannot dispatch, alias, or import the forty-two-command registry's handlers.
- Create `setfarm/src/server/schemas/run-operational-model-v2.ts` — strict nested operational-model schema and canonical model hash.
- Modify `setfarm/src/server/run-operational-model.ts` — produce hash-bound V2 models.
- Modify `setfarm/src/contracts/mission-control-contract-artifacts.ts` — export the V2 schema and compatibility fixture.
- Add `setfarm/contracts/generated/mission-control/run-operational-model.v2.schema.json` and `run-operational-model.v2.compatibility.json` through the producer generator.
- Modify `setfarm/tests/run-operational-model.test.ts` — nested authority and hash-drift regressions.
- Modify `setfarm/tests/contracts/mission-control-contract-artifacts.test.ts` — require the V2 artifact pair.

### Mission Control canonical reconciliation

- Create `mission-control/server/services/setfarm-operational-model.ts` — fail-closed Setfarm operational-model fetch with exact payload pass-through.
- Create `mission-control/server/services/setfarm-operational-model.test.ts` — completed-failure and unavailable regressions.
- Modify `mission-control/server/routes/setfarm-activity.ts` — remove local completed-run clearing, consume the pass-through client, and use the shared active-state contract.
- Modify `mission-control/server/routes/runs.ts` — use the same shared active-state contract while preserving legacy diagnostics as non-authoritative.
- Modify `mission-control/package.json` and `mission-control/package-lock.json` — add direct `ajv` runtime dependency for the vendored JSON Schema boundary.
- Modify `mission-control/scripts/sync-setfarm-contract.mjs` — vendor the operational-model V2 schema/fixture.
- Modify `mission-control/scripts/check-setfarm-contract.mjs` — validate the exact fourteen-file inventory, retaining A's operational-active schema/fixture and adding D's operational-model pair, plus strict nested payload and canonical model hash.
- Consume without modification `mission-control/server/shared/setfarm-operational-active-run-status-v1.ts` and its vendored A schema — the sole Mission Control active-status predicate used by project execution and D reconciliation tests.
- Modify `mission-control/tests/setfarm-contract-vendor.test.ts` — lock exact fourteen ordered entries and cross both A's active-status pair and D's run-model pair through their semantic consumers.
- Add `mission-control/contracts/vendor/setfarm/run-operational-model.v2.schema.json` and `run-operational-model.v2.compatibility.json` through the sync script.
- Create `mission-control/server/services/run-reconciliation.ts` — diagnostic-only DB/snapshot reconciliation schema and pure comparison.
- Create `mission-control/server/services/run-reconciliation.test.ts` — matched, mismatch, unavailable, and hash regressions.
- Modify `mission-control/server/utils/setfarm-db.ts` — direct, bounded run census by exact run ID.
- Modify `mission-control/server/routes/setfarm-operational.ts` — add `GET /api/setfarm/runs/:id/reconciliation`.
- Modify `mission-control/server/routes/setfarm-operational.test.ts` — exact 200/409/404/503 mappings.
- Create `mission-control/src/lib/run-reconciliation.ts` — strict browser parser.
- Create `mission-control/src/hooks/useRunReconciliation.ts` — bounded polling and reconnect behavior.
- Create `mission-control/src/components/run-detail/ReconciliationPanel.tsx` — diagnostic-only evidence rendering.
- Modify `mission-control/src/pages/RunDetail.tsx` — render reconciliation next to canonical authority panels.
- Create `mission-control/tests/run-reconciliation-render.test.tsx` — matched/mismatch/unavailable SSR regressions.

### Mission Control failure and retry authority

- Modify `mission-control/server/routes/runs.ts` — label regex errors as legacy diagnostics with no retry authority.
- Modify `mission-control/src/components/pipeline/ErrorCard.tsx` — preserve the visible legacy-diagnostic label and disallow action inference.
- Modify `mission-control/src/components/run-detail/OperationalEvidence.tsx` — render exact Setfarm-owned owner, retryability, and operator actions.
- Modify `mission-control/src/lib/operational-snapshot.ts` — strict snapshot presentation mapping without local classification.
- Create `mission-control/tests/operational-authority-render.test.tsx` — exact owner/retry/refusal/terminal regressions.

### Durable review evidence

- Supply the reviewed recovery-matrix bytes to B's owner-mediated docs-session commit; B alone creates E's authenticated generation-owned `docs/review-packets/internal-production/epoch-<epochHash>-closure-<closureGenerationHash>/recovery-matrix.md`, while D never observes or validates that path.
- Supply the reviewed recovery-reconciliation bytes to B's owner-mediated docs-session commit; B alone creates E's authenticated generation-owned `docs/review-packets/internal-production/epoch-<epochHash>-closure-<closureGenerationHash>/recovery-reconciliation.md`, while D never observes or validates that path.

D's private finalization owns two immutable typed byte streams and their content hashes, not a tracked generation path or session basename. In the combined A–E delivery, E authenticates the generation inputs and exact six-entry tuple before asking B to begin; B alone derives/authenticates the generation-owned paths, basenames, absence, ordering, and registered content hashes. D supplies only freshly reopened finalization-owned bytes/content hashes through its two fixed owner selectors. This avoids a D→E phase dependency while ensuring no operational epoch can overwrite an older recovery packet.

Ownership and delivery order are part of the scope, not an implementation suggestion. D Task 2 alone creates the shared Setfarm restart authority for all four namespaces (`recovery-active-run`, `source-release-barrier`, `cold-rehearsal`, and `documentation-handoff`), the exact D owner-producer manifest activation controller/test, the Setfarm startup adapter, sole helper script, its authority/startup/source-boundary tests, both exact B activation-controller successor branches, and the spawner/dashboard startup call sites. Its complete source claim and handoff tree projection must include `src/internal-production/recovery-owner-producer-manifest-activation-v1.ts` and `tests/internal-production/recovery-owner-producer-manifest-activation-v1.test.ts` and prove exact `A+B+C` count 27 to `A+B+C+D` count 43 expected-predecessor activation. It imports/re-exports A's already merged readiness/activation/cutover identities but owns none of their schemas or stores. Those Setfarm files merge first, while A physical-restart epoch one remains authoritative and every D generic `prepare` remains typed unavailable. D Task 6 then allocates and delivers the sole serialized Mission Control branch/PR containing the generic startup consumer/test and `server/index.ts` ordering together with D's reconciliation changes. From both clean built merges, D first publishes and freshly resolves the exact reviewed 43-producer activation; failure blocks before `d-startup-hook-load` or any D producer. A's still-active sequence then loads all three reviewed D-capable startup hooks; ordinary-slot fencing may observe and settle those starts, but cannot enable a D generic restart. Only after all three current hook/source/build identities are observable and a fresh A cutover mutation guard resolves does D's reviewed adapter prepare A's cutover once and let a fresh process invoke its zero-input resume; A internally records readiness and atomically publishes its retirement/activation/cutover epoch-two chain. E may begin its source branch only after both D handoff receipts, the D manifest activation receipt, and the A-owned readiness/cutover/retirement/activation chain resolve against clean synchronized `main`; E owns no substitute helper, startup hook, MC branch, or those paths.

---

### Task 1: Implement a strict, observation-only Setfarm recovery evidence contract

**Files:**

- Create: `setfarm/src/internal-production/recovery-evidence.ts`
- Create: `setfarm/tests/internal-production/recovery-evidence.test.ts`

- [ ] **Step 0: Start the single canonical Setfarm-owned source run from clean synchronized main**

```bash
set -euo pipefail
require_authenticated_clean_main_setfarm_root_v1() {
  : "${SETFARM_ROOT:?authenticated clean-main Setfarm root is required}"
  : "${SETFARM_ROOT_EXPECTED_SHA:?authenticated clean-main Setfarm SHA is required}"
  case "$SETFARM_ROOT" in
    /*) ;;
    *) printf "SETFARM_ROOT must be absolute\n" >&2; return 1 ;;
  esac
  test -d "$SETFARM_ROOT"
  test ! -L "$SETFARM_ROOT"
  readonly SETFARM_ROOT SETFARM_ROOT_EXPECTED_SHA
  SETFARM_ROOT_TOP="$(git -C "$SETFARM_ROOT" rev-parse --show-toplevel)"
  SETFARM_ROOT_BRANCH="$(git -C "$SETFARM_ROOT" branch --show-current)"
  SETFARM_ROOT_HEAD="$(git -C "$SETFARM_ROOT" rev-parse HEAD)"
  SETFARM_ROOT_ORIGIN="$(git -C "$SETFARM_ROOT" rev-parse refs/remotes/origin/main)"
  SETFARM_ROOT_STATUS="$(git -C "$SETFARM_ROOT" status --porcelain=v1 --untracked-files=all)"
  test "$SETFARM_ROOT_TOP" = "$SETFARM_ROOT"
  test "$SETFARM_ROOT_BRANCH" = "main"
  test -z "$SETFARM_ROOT_STATUS"
  test "$SETFARM_ROOT_HEAD" = "$SETFARM_ROOT_ORIGIN"
  test "$SETFARM_ROOT_HEAD" = "$SETFARM_ROOT_EXPECTED_SHA"
}
cd "$SETFARM_ROOT"
D_SHELL_TEST_VALUE_001="$(git branch --show-current)"
test "$D_SHELL_TEST_VALUE_001" = "main"
D_SHELL_TEST_VALUE_002="$(git rev-parse HEAD)"
D_SHELL_TEST_VALUE_003="$(git rev-parse origin/main)"
test "$D_SHELL_TEST_VALUE_002" = "$D_SHELL_TEST_VALUE_003"
D_SHELL_GUARD_OUTPUT="$(git status --porcelain=v1 --untracked-files=all)"
test -z "$D_SHELL_GUARD_OUTPUT"
require_authenticated_clean_main_setfarm_root_v1
D_SOURCE_BOOTSTRAP_PREPARED="$(npm --prefix "$SETFARM_ROOT" run --silent acceptance:baseline-post-handoff -- prepare-recovery-source-bootstrap --json)"
readonly D_SOURCE_BOOTSTRAP_PREPARED
D_SOURCE_BOOTSTRAP_OPERATION_REF="$(printf '%s\n' "$D_SOURCE_BOOTSTRAP_PREPARED" | jq -er '.operationRef')"
readonly D_SOURCE_BOOTSTRAP_OPERATION_REF
D_SOURCE_BOOTSTRAP_OPERATION_HASH="$(printf '%s\n' "$D_SOURCE_BOOTSTRAP_PREPARED" | jq -er '.operationHash | select(test("^[0-9a-f]{64}$"))')"
readonly D_SOURCE_BOOTSTRAP_OPERATION_HASH
require_authenticated_clean_main_setfarm_root_v1
D_SOURCE_BOOTSTRAP_STARTED="$(env -i PATH="$PATH" HOME="$HOME" npm --prefix "$SETFARM_ROOT" run --silent acceptance:baseline-post-handoff -- resume-recovery-source-bootstrap --json)"
readonly D_SOURCE_BOOTSTRAP_STARTED
D_SOURCE_BOOTSTRAP_STARTED_REF="$(printf '%s\n' "$D_SOURCE_BOOTSTRAP_STARTED" | jq -er '.sourceRunRef')"
readonly D_SOURCE_BOOTSTRAP_STARTED_REF
D_SOURCE_BOOTSTRAP_STARTED_HASH="$(printf '%s\n' "$D_SOURCE_BOOTSTRAP_STARTED" | jq -er '.sourceRunHash | select(test("^[0-9a-f]{64}$"))')"
readonly D_SOURCE_BOOTSTRAP_STARTED_HASH
```

Expected: the reviewed B lifecycle generation and C `post-pr-review` gate are already on `main`, no other Setfarm writer owns the repository, and A's fixed prepare seals a one-use operation over exact clean `origin/main`, complete zero writer/active-run ownership, fixed workflow/prompt/protocol, and the current executable build. The fresh-shell zero-input resume reopens that operation and starts or adopts exactly one ordinary workflow run; no D command or raw `workflow run` is permitted before D source merges. Setfarm creates and owns all Tasks 1–2 claims, isolated worktrees, managed branch state, commits, push, PR, review transitions, merge, and cleanup. If any read-only precondition fails, the worker stops; only the owning orchestrator may synchronize or prepare `main`.

D treats `D_SOURCE_BOOTSTRAP_STARTED_REF/HASH` only as A's strict `InternalProductionRecoverySourceBootstrapRunReceiptV1` pair. Before accepting the source run or any returned claim, the A package command calls `resolveInternalProductionRecoverySourceBootstrapRunReceiptV1(...)`, freshly resolves its nested `InternalProductionRecoverySourceRunTerminalAuthorityV1`, reservation-close, and fence-release pairs, and equality-checks purpose, exact target `source-run` reservation/run-launch composite, intent/outbox, reciprocal unique operation/run binding, terminal owner, run ID, source SHA/tree/build, preserved/released fence, and exact outer pair. A missing/corrupt/cross-purpose/cross-run/swapped nested pair leaves D claim and owner counts zero.

**Interfaces:**

```ts
export const RECOVERY_SCENARIO_IDS = [
  "spawner_pre_transfer_restart",
  "completion_owner_pre_effect_restart",
  "mission_control_active_run_restart",
  "dashboard_active_run_restart",
  "provider_quota_failure",
  "github_review_retry",
  "runtime_crash_cleanup",
  "supervisor_generation_safe_retry",
  "post_owner_exactly_once_recovery",
  "api_durable_state_restart",
] as const;

export type RecoveryScenarioId = (typeof RECOVERY_SCENARIO_IDS)[number];
export type RecoveryResult =
  | "accepted_continuation"
  | "typed_terminal"
  | "scenario_attempt_failure";

export interface RecoveryScenarioPreflightRefusalV1 {
  schema: "setfarm.internal-production-recovery-preflight-refusal.v1";
  campaignHash: string;
  finalReleaseEpoch: GoldenFinalReleaseEpochV1;
  caseId: string;
  scenarioId: RecoveryScenarioId;
  code:
    | "execution_not_requested"
    | "campaign_authority_mismatch"
    | "release_epoch_mismatch"
    | "prior_attempt_requires_review"
    | "systemic_root_limit_reached"
    | "ownership_precondition_failed";
  authorityHash: string;
  refusalHash: string;
}

export interface RecoverySourceGoldenLinkReceiptV1 {
  schema: "setfarm.internal-production-recovery-source-golden-link.v1";
  recoveryCampaignHash: string;
  finalReleaseEpoch: GoldenFinalReleaseEpochV1;
  profileId: "node-express-api";
  sourceCampaignHash: string;
  sourceCaseId: string;
  sourceResultHash: string;
  sourceResultRunId: string;
  linkHash: string;
}

export interface RecoverySourceGoldenLinkResolverV1 {
  resolve(recoveryCampaignHash: string, epochHash: string): Promise<RecoverySourceGoldenLinkReceiptV1 | null>;
}

export interface RecoverySourceGoldenLinkStoreV1 extends RecoverySourceGoldenLinkResolverV1 {
  linkCurrentApiResult(recoveryCampaignHash: string): Promise<RecoverySourceGoldenLinkReceiptV1>;
}

export function createRecoverySourceGoldenLinkStoreV1(): RecoverySourceGoldenLinkStoreV1;

export type RecoveryTypedTerminalScenarioIdV1 = Extract<
  RecoveryScenarioId,
  "provider_quota_failure" | "github_review_retry"
>;

export const RECOVERY_TYPED_TERMINALS_V1 = {
  provider_quota_failure: [{ owner: "provider_or_quota", code: "provider_or_quota_terminal" }],
  github_review_retry: [{ owner: "generated_product_review", code: "post_pr_review_manual_blocker" }],
} as const satisfies Readonly<Partial<Record<RecoveryScenarioId,
  readonly Readonly<{ owner: string; code: string }>[]>>>;

export type RecoveryTypedTerminalV1 =
  (typeof RECOVERY_TYPED_TERMINALS_V1)[RecoveryTypedTerminalScenarioIdV1][number];

export interface RecoveryTypedTerminalByScenarioV1 {
  provider_quota_failure: Extract<
    RecoveryTypedTerminalV1,
    Readonly<{ owner: "provider_or_quota"; code: "provider_or_quota_terminal" }>
  >;
  github_review_retry: Extract<
    RecoveryTypedTerminalV1,
    Readonly<{ owner: "generated_product_review"; code: "post_pr_review_manual_blocker" }>
  >;
}

import type {
  InternalProductionCompleteZeroOwnerCensusObservationV1,
  InternalProductionCompleteZeroOwnerCensusV1,
} from "./baseline-post-handoff-receipt-v1.js";
import {
  observeCompleteInternalProductionZeroOwnerCensusV1,
} from "./baseline-post-handoff-receipt-v1.js";

export type RecoveryOwnershipCensusV1 =
  InternalProductionCompleteZeroOwnerCensusV1;

export interface RecoveryTargetOwnershipV1 {
  schema: "setfarm.internal-production-recovery-target-ownership.v1";
  runId: string;
  runNumber: number;
  checkpoint: string;
  generationIdentityHash: string;
  claimIds: readonly number[];
  runtimeSessionIds: readonly string[];
  attemptIdentityHashes: readonly string[];
  completionOwnerIds: readonly string[];
  mandatoryEffectIdentityHashes: readonly string[];
  leaseIdentityHashes: readonly string[];
  processIdentityHashes: readonly string[];
  listenerIdentityHashes: readonly string[];
  worktreeIdentityHashes: readonly string[];
  terminationIdentityHashes: readonly string[];
  outboxIdentityHashes: readonly string[];
  findingIdentityHashes: readonly string[];
  recoveryOwnerIdentityHashes: readonly string[];
  preparationOwnerIdentityHashes: readonly string[];
  artifactReservationIdentityHashes: readonly string[];
  publicationBatchIdentityHashes: readonly string[];
  operationalDeliveryIdentityHashes: readonly string[];
  compilationLeaseIdentityHashes: readonly string[];
  authorityReceipts: readonly Readonly<{
    kind:
      | "golden-lifecycle-checkpoint"
      | "golden-post-pr-review-action"
      | "recovery-process-checkpoint"
      | "recovery-action";
    receiptHash: string;
    receiptRef: string;
  }>[];
  targetOwnershipHash: string;
}

export interface RecoveryCheckpointV1 {
  phase: "before" | "after";
  capturedAt: string;
  campaignHash: string;
  runId: string;
  runStatus: string;
  snapshotHash: string;
  databaseCensusHash: string;
  missionControlReconciliationHash: string | null;
  processCensusHash: string;
  projectApiHash: string | null;
  targetOwnership: RecoveryTargetOwnershipV1 | null;
  unrelatedOwnership: RecoveryOwnershipCensusV1;
  totalOwnership: RecoveryOwnershipCensusV1;
}

export function observeRecoveryCompleteZeroOwnerCensusV1(): Promise<
  InternalProductionCompleteZeroOwnerCensusObservationV1
>;

export interface RecoveryScenarioEvidenceCommonV1 {
  schema: "setfarm.internal-production-recovery-evidence.v1";
  campaignId: "internal-production-2026-08-13";
  campaignHash: string;
  finalReleaseEpoch: GoldenFinalReleaseEpochV1;
  evidenceMode: "actual_postgres_process_integration" | "live_operational";
  runId: string;
  sourceGoldenAuthority: Readonly<{
    campaignHash: string;
    caseId: string;
    resultHash: string;
    finalReleaseEpoch: GoldenFinalReleaseEpochV1;
    linkageHash: string;
  }> | null;
  lifecycleCheckpointCapabilityHash: string | null;
  goldenResult: Readonly<{
    kind: GoldenStartedRunResultV1["kind"];
    schema: GoldenStartedRunResultV1["schema"];
    campaignHash: GoldenStartedRunResultV1["campaignHash"];
    caseId: GoldenStartedRunResultV1["caseId"];
    caseHash: GoldenStartedRunResultV1["caseHash"];
    profileId: GoldenStartedRunResultV1["profileId"];
    promptHash: GoldenStartedRunResultV1["promptHash"];
    repetition: GoldenStartedRunResultV1["repetition"];
    launchAttemptOrdinal: GoldenStartedRunResultV1["launchAttemptOrdinal"];
    subject: GoldenStartedRunResultV1["subject"];
    run: GoldenStartedRunResultV1["run"];
    finalReleaseEpoch: GoldenStartedRunResultV1["finalReleaseEpoch"];
    observationDisposition: GoldenStartedRunResultV1["observationDisposition"];
    classification: GoldenStartedRunResultV1["classification"];
    classificationReasonCode: GoldenStartedRunResultV1["classificationReasonCode"];
    rootCauseHash: GoldenStartedRunResultV1["rootCauseHash"];
    terminalEvidence: GoldenStartedRunResultV1["terminalEvidence"];
    resultHash: GoldenStartedRunResultV1["resultHash"];
  }> | null;
  processFixture:
    | Readonly<{
        schema: "setfarm.internal-production-recovery-process-fixture-evidence.v1";
        campaignHash: string;
        finalReleaseEpoch: GoldenFinalReleaseEpochV1;
        caseId: string;
        scenarioId: RecoveryScenarioId;
        runId: string;
        runNumber: number;
        generation: number;
        checkpoint: string;
        checkpointReceiptHash: string;
        checkpointReceiptRef: string;
        isolatedDatabaseEvidenceHash: string;
        outcome: "success";
        failure: null;
      }>
    | Readonly<{
        schema: "setfarm.internal-production-recovery-process-fixture-evidence.v1";
        campaignHash: string;
        finalReleaseEpoch: GoldenFinalReleaseEpochV1;
        caseId: string;
        scenarioId: RecoveryProcessTypedTerminalScenarioIdV1;
        runId: string;
        runNumber: number;
        generation: number;
        checkpointReceiptHash: string;
        checkpointReceiptRef: string;
        isolatedDatabaseEvidenceHash: string;
        outcome: "typed_terminal";
        typedTerminal: RecoveryProcessTypedTerminalV1;
        checkpoint: InternalProductionRecoveryCheckpointName;
        checkpointFrameHash: string;
        beforeCheckpointHash: string;
        afterCheckpointHash: string;
        targetOwnershipHash: string;
        terminalBoundary: InternalProductionRecoveryCheckpointName;
        observedAuthorityHash: string;
        cleanupCensusHash: string;
        cleanupHash: string;
      }>
    | Readonly<{
        schema: "setfarm.internal-production-recovery-process-fixture-evidence.v1";
        campaignHash: string;
        finalReleaseEpoch: GoldenFinalReleaseEpochV1;
        caseId: string;
        scenarioId: RecoveryScenarioId;
        runId: string;
        runNumber: number;
        generation: number;
        checkpoint: string;
        checkpointReceiptHash: string;
        checkpointReceiptRef: string;
        isolatedDatabaseEvidenceHash: string;
        outcome: "failure";
        failure: Readonly<{
          code: Extract<RecoveryProcessFixtureReceiptV1, { outcome: "failure" }>["failure"]["code"];
          boundary: InternalProductionRecoveryCheckpointName;
          observedAuthorityHash: string;
          cleanupCensusHash: string;
          cleanupHash: string;
        }>;
      }>
    | null;
  lifecycleCheckpoint: GoldenLifecycleCheckpointReceiptV1 | null;
  actionReceipt:
    | {
        owner: "d-recovery";
        actionId: "restart-mission-control" | "restart-setfarm-dashboard";
        actionReceiptHash: string;
        actionReceiptRef: string;
        serviceRestartOperationRef: CanonicalRef;
        serviceRestartOperationHash: string;
        serviceRestartReceiptRef: CanonicalRef;
        serviceRestartReceiptHash: string;
      }
    | {
        owner: "d-recovery";
        actionId: "restart-accepted-product";
        actionReceiptHash: string;
        actionReceiptRef: string;
        serviceRestartOperationRef: null;
        serviceRestartOperationHash: null;
        serviceRestartReceiptRef: null;
        serviceRestartReceiptHash: null;
      }
    | {
        owner: "c-golden-post-pr-review";
        actionId: GoldenPostPrReviewActionReceiptV1["actionId"];
        actionReceiptHash: string;
        actionReceiptRef: string;
      }
    | null;
  expectedCheckpoint: string;
  before: RecoveryCheckpointV1 | null;
  after: RecoveryCheckpointV1 | null;
  evidenceRefs: readonly string[];
  evidenceHash: string;
}

export type RecoveryScenarioTerminalDispositionForV1<
  Scenario extends RecoveryScenarioId,
> =
  | Readonly<{
      scenarioId: Scenario;
      result: "accepted_continuation";
      typedTerminal: null;
    }>
  | Readonly<{
      scenarioId: Scenario;
      result: "scenario_attempt_failure";
      typedTerminal: null;
    }>
  | (Scenario extends RecoveryTypedTerminalScenarioIdV1
      ? Readonly<{
          scenarioId: Scenario;
          result: "typed_terminal";
          typedTerminal: RecoveryTypedTerminalByScenarioV1[Scenario];
        }>
      : never);

export type RecoveryScenarioTerminalDispositionV1 = {
  [Scenario in RecoveryScenarioId]: RecoveryScenarioTerminalDispositionForV1<Scenario>;
}[RecoveryScenarioId];

export type RecoveryScenarioEvidenceV1 =
  RecoveryScenarioEvidenceCommonV1 & RecoveryScenarioTerminalDispositionV1;

export interface RecoveryScenarioAttemptV1 {
  schema: "setfarm.internal-production-recovery-scenario-attempt.v1";
  campaignHash: string;
  finalReleaseEpoch: GoldenFinalReleaseEpochV1;
  scenarioId: RecoveryScenarioId;
  attemptOrdinal: number;
  previousAttemptHash: string | null;
  evidenceHash: string;
  disposition: "selectable" | "failed" | "polluted";
  systemicRootHash: string | null;
  reviewedRepair:
    | Readonly<{ kind: "d-process-repair"; receiptHash: string; consumptionHash: string }>
    | Readonly<{ kind: "d-accepted-product-repair"; receiptHash: string; consumptionHash: string }>
    | Readonly<{ kind: "c-golden-repair"; receiptHash: string; consumptionHash: string }>
    | null;
  attemptHash: string;
}

export interface RecoveryRepairReviewReceiptV1 {
  schema: "setfarm.internal-production-recovery-repair-review.v1";
  campaignHash: string;
  scenarioId: RecoveryScenarioId;
  failedEvidenceHash: string;
  systemicRootHash: string;
  failedEpochHash: string;
  nextFinalReleaseEpoch: GoldenFinalReleaseEpochV1;
  repository: "setfarm" | "mission-control";
  pullRequestUrl: string;
  pullRequestNumber: number;
  pullRequestBaseSha: string;
  pullRequestHeadSha: string;
  mergedSourceSha: string;
  reviewThreadSetHash: string;
  independentReviewReceiptHash: string;
  focusedVerificationHash: string;
  broadVerificationHash: string;
  cleanBuildHash: string;
  reviewedAt: string;
  receiptHash: string;
}

export interface RecoveryRepairReviewReceiptResolverV1 {
  resolve(receiptHash: string): Promise<RecoveryRepairReviewReceiptV1 | null>;
}

export interface RecoveryVerificationAuthorityResolverV1 {
  resolve(authorityHash: string): Promise<GoldenVerificationAuthorityReceiptV1 | null>;
}

export interface RecoveryRepairReviewConsumptionPortV1 {
  consume(input: Readonly<{
    receiptHash: string;
    campaignHash: string;
    scenarioId: RecoveryScenarioId;
    failedEvidenceHash: string;
    systemicRootHash: string;
    failedEpochHash: string;
    nextEpochHash: string;
  }>): Promise<Readonly<{ consumptionHash: string; created: boolean }>>;
}

export interface RecoveryRepairReviewAuthorityV1 {
  observe(input: Readonly<{
    campaignHash: string;
    scenarioId: RecoveryScenarioId;
    failedEvidenceHash: string;
    repository: "setfarm" | "mission-control";
    pullRequestNumber: number;
  }>): Promise<RecoveryRepairReviewReceiptV1>;
  resolver: RecoveryRepairReviewReceiptResolverV1;
  consumptions: RecoveryRepairReviewConsumptionPortV1;
}

export function createRecoveryRepairReviewAuthorityV1(): RecoveryRepairReviewAuthorityV1;

export type RecoveryAcceptedProductSystemicComponentKindV1 =
  | "accepted-api-durable-state-runtime";

export type RecoveryAcceptedProductRepairReviewReceiptV1 = Readonly<{
  schema: "setfarm.internal-production-recovery-accepted-product-repair-review.v1";
  campaignHash: string;
  scenarioId: "api_durable_state_restart";
  failedEvidenceHash: string;
  systemicRootHash: string;
  systemicRootComponentKind: RecoveryAcceptedProductSystemicComponentKindV1;
  failureTupleHash: string;
  failedFinalReleaseEpoch: GoldenFinalReleaseEpochV1;
  failedSourceLinkHash: string;
  failedSourceResultHash: string;
  nextFinalReleaseEpoch: GoldenFinalReleaseEpochV1;
  nextSourceLinkHash: string;
  nextSourceResultHash: string;
  remediation:
    | Readonly<{
        kind: "source-repair";
        repository: "setfarm" | "mission-control";
        pullRequestUrl: string;
        pullRequestNumber: number;
        pullRequestBaseSha: string;
        pullRequestHeadSha: string;
        mergedSourceSha: string;
        nextProfileResultHashes: readonly [string, string, string];
        nextProfiles13AuthorityHash: string;
        successorMatrixReceiptRef: CanonicalRef;
        successorMatrixReceiptHash: string;
        successorMatrixFinalReleaseEpoch: GoldenFinalReleaseEpochV1;
        infrastructureRemediationRef: null;
        infrastructureRemediationHash: null;
      }>
    | Readonly<{
        kind: "infrastructure-remediation";
        repository: null;
        pullRequestUrl: null;
        pullRequestNumber: null;
        pullRequestBaseSha: null;
        pullRequestHeadSha: null;
        mergedSourceSha: null;
        nextProfileResultHashes: null;
        nextProfiles13AuthorityHash: null;
        successorMatrixReceiptRef: null;
        successorMatrixReceiptHash: null;
        successorMatrixFinalReleaseEpoch: null;
        infrastructureRemediationRef: CanonicalRef;
        infrastructureRemediationHash: string;
      }>;
  independentReviewReceiptHash: string;
  focusedVerificationHash: string;
  broadVerificationHash: string;
  cleanBuildHash: string;
  reviewedAt: string;
  receiptHash: string;
}>;

export interface RecoveryAcceptedProductRepairReviewResolverV1 {
  resolveByFailure(input: Readonly<{
    campaignHash: string;
    failedEvidenceHash: string;
    systemicRootHash: string;
  }>): Promise<RecoveryAcceptedProductRepairReviewReceiptV1 | null>;
}

export interface RecoveryAcceptedProductRepairReviewConsumptionPortV1 {
  consume(input: Readonly<{
    campaignHash: string;
    failedEvidenceHash: string;
    systemicRootHash: string;
    receiptHash: string;
    failedEpochHash: string;
    nextEpochHash: string;
    failedSourceLinkHash: string;
    failedSourceResultHash: string;
    nextSourceLinkHash: string;
    nextSourceResultHash: string;
    successorMatrixReceiptRef: CanonicalRef | null;
    successorMatrixReceiptHash: string | null;
    successorMatrixEpochHash: string | null;
  }>): Promise<Readonly<{ consumptionHash: string; created: boolean }>>;
}

export interface RecoveryAcceptedProductInfrastructureRemediationResolverV1 {
  resolveByFailure(input: Readonly<{
    campaignHash: string;
    failedEvidenceHash: string;
    failureTupleHash: string;
  }>): Promise<Readonly<{
    remediationRef: CanonicalRef;
    remediationHash: string;
    verdict: "remediated";
    failedEpochHash: string;
  }> | null>;
}

export function createRecoveryAcceptedProductInfrastructureRemediationResolverV1():
  RecoveryAcceptedProductInfrastructureRemediationResolverV1;

export interface RecoveryAcceptedProductRepairReviewAuthorityV1 {
  observeSourceRepair(input: Readonly<{
    campaignHash: string;
    failedEvidenceHash: string;
    repository: "setfarm" | "mission-control";
    pullRequestNumber: number;
  }>): Promise<RecoveryAcceptedProductRepairReviewReceiptV1>;
  observeInfrastructureRemediation(input: Readonly<{
    campaignHash: string;
    failedEvidenceHash: string;
  }>): Promise<RecoveryAcceptedProductRepairReviewReceiptV1>;
  resolver: RecoveryAcceptedProductRepairReviewResolverV1;
  consumptions: RecoveryAcceptedProductRepairReviewConsumptionPortV1;
}

export function createRecoveryAcceptedProductRepairReviewAuthorityV1():
  RecoveryAcceptedProductRepairReviewAuthorityV1;

export interface RecoveryLiveRepairReviewDependenciesV1 {
  goldenRepairReviews: GoldenRepairReviewObserverV1;
}

export function createRecoveryLiveRepairReviewDependenciesV1(): RecoveryLiveRepairReviewDependenciesV1;

export interface RecoveryScenarioSelectionCommonV1 {
  schema: "setfarm.internal-production-recovery-scenario-selection.v1";
  campaignHash: string;
  finalReleaseEpoch: GoldenFinalReleaseEpochV1;
  selectedAttemptHash: string;
  selectedEvidenceHash: string;
  selectionHash: string;
}

export type RecoveryScenarioSelectionV1 =
  | Readonly<RecoveryScenarioSelectionCommonV1 & {
      scenarioId: RecoveryTypedTerminalScenarioIdV1;
      selectedResult: "accepted_continuation" | "typed_terminal";
    }>
  | Readonly<RecoveryScenarioSelectionCommonV1 & {
      scenarioId: Exclude<RecoveryScenarioId, RecoveryTypedTerminalScenarioIdV1>;
      selectedResult: "accepted_continuation";
    }>;

export function canonicalRecoveryEvidenceHash(
  value: Omit<RecoveryScenarioEvidenceV1, "evidenceHash">,
): string;
export function parseRecoveryScenarioEvidence(value: unknown): RecoveryScenarioEvidenceV1;
export function parseRecoveryScenarioPreflightRefusal(value: unknown): RecoveryScenarioPreflightRefusalV1;
export function verifyRecoveryScenarioEvidence(value: RecoveryScenarioEvidenceV1): string[];
export interface RecoveryEvidenceAuthorityDependencies {
  loadedCampaign: LoadedGoldenCampaignV1;
  sourceGoldenCampaigns: Readonly<{
    resolve(campaignHash: string): Promise<LoadedGoldenCampaignV1>;
  }>;
  sourceGoldenLinks: RecoverySourceGoldenLinkResolverV1;
  goldenRunResultStore: GoldenRunResultStore;
  actionReceipts: RecoveryActionReceiptResolver;
  postPrReviewActionReceipts: GoldenPostPrReviewActionReceiptResolverV1;
  repositoryWorkflowEvidence: GoldenRepositoryWorkflowEvidenceResolverV1;
  processFixtureReceipts: RecoveryProcessFixtureReceiptResolverV1;
  acceptedProductRuntime: RecoveryAcceptedProductRuntimeResolverV1;
}
export async function verifyRecoveryScenarioEvidenceAuthority(
  value: RecoveryScenarioEvidenceV1,
  dependencies: RecoveryEvidenceAuthorityDependencies,
): Promise<string[]>;

export interface RecoveryEvidenceCliDependenciesV1 {
  evidenceAuthority: RecoveryEvidenceAuthorityDependencies;
  projectionObserver: GoldenProjectionObserver;
  attempts: RecoveryScenarioAttemptStoreV1;
}

export function createRecoveryEvidenceCliDependenciesV1(input: Readonly<{
  campaignHash: string;
}>): Promise<RecoveryEvidenceCliDependenciesV1>;

export function runRecoveryEvidenceCliV1(
  argv: readonly string[],
  dependencies: RecoveryEvidenceCliDependenciesV1,
): Promise<number>;

export interface RecoveryScenarioAttemptStoreV1 {
  append(input: Readonly<{
    evidence: RecoveryScenarioEvidenceV1;
    reviewedRepair: RecoveryScenarioAttemptV1["reviewedRepair"];
  }>): Promise<RecoveryScenarioAttemptV1>;
  list(campaignHash: string, epochHash: string, scenarioId: RecoveryScenarioId): Promise<readonly RecoveryScenarioAttemptV1[]>;
  listScenarioHistory(campaignHash: string, scenarioId: RecoveryScenarioId): Promise<readonly RecoveryScenarioAttemptV1[]>;
  select(attemptHash: string): Promise<RecoveryScenarioSelectionV1>;
  getSelection(campaignHash: string, epochHash: string, scenarioId: RecoveryScenarioId): Promise<RecoveryScenarioSelectionV1 | null>;
}

export function createRecoveryScenarioAttemptStoreV1(): RecoveryScenarioAttemptStoreV1;
```

`parseRecoveryScenarioEvidence()` and `verifyRecoveryScenarioEvidence()` are pure. They validate strict shape, canonical hashes, internal cross-field equality, scenario/action compatibility, transition rules, and ownership rules only; neither function claims that a hash exists in a store. `campaignHash` is the stable D recovery campaign/content identity and must equal `processFixture.campaignHash`, both checkpoints' campaign-bound receipt authorities, the store partition, the CLI `--campaign-hash`, and the loaded recovery campaign hash during asynchronous verification. Scenarios 3, 4, and 6 require a null `sourceGoldenAuthority` and a `goldenResult.campaignHash` equal to that D recovery campaign. Scenario 10 instead requires the exact non-null `RecoverySourceGoldenLinkReceiptV1` indexed by `(D campaignHash, finalReleaseEpoch.epochHash)`: its accepted API `goldenResult.campaignHash`, case/result/run identity, and result release epoch equal `sourceGoldenAuthority`, while evidence/checkpoints remain bound to the separate D recovery campaign and final epoch. After every fresh current-epoch full-matrix barrier and after `prepare-campaign`, the explicit code-owned `link-source-golden --recovery-campaign-hash ...` command content-addresses and atomically indexes this receipt at ``recovery/${campaignHash}/source-golden-links/${epochHash}.json``; the stable campaign/control receipt never embeds a forever-current API link. The verifier resolves the current-epoch receipt through `sourceGoldenLinks`, then resolves the linked source campaign through `sourceGoldenCampaigns`, validates its hash/case/result/epoch, and passes that loaded source—not the D recovery campaign—to `RecoveryAcceptedProductRuntimePort.resolve(...)`. An original-epoch link cannot authorize a later epoch; an arbitrary cross-campaign result, caller link, same hash with a different case/run, or unsealed linkage fails. Separately, `finalReleaseEpoch` is B's exact `GoldenFinalReleaseEpochV1`; its `epochHash`, Setfarm SHA, and Mission Control SHA must equal the resolved result/process receipt, action/lifecycle authority, source cleanliness/build receipts, and attempt/selection epoch. No fallback to `campaignId`, and no conflation of stable campaign hash, source-golden campaign hash, or epoch identity, is allowed. Both outer `RecoveryScenarioEvidenceV1.evidenceRefs` and nested lifecycle/action refs use B's exact `z.array(CanonicalRefSchema).max(64).refine(hasUniqueStrings)` boundary. They accept only bounded unique canonical refs and reject relative repository paths, absolute paths, `file:` refs, host paths, duplicates, and more than `64` values; refs remain opaque and are never opened as paths.

`verifyRecoveryScenarioEvidenceAuthority()` first runs the pure verifier, then awaits `GoldenRunResultStore.get(resultHash)` and, only for D-owned service/runtime actions, `RecoveryActionReceiptResolver.getByRef(actionReceiptRef)`. It recomputes content hashes and requires the resolved run, campaign, case, release, generation, predicate, action, operation, and receipt identities to equal the evidence. `RecoveryScenarioEvidenceV1.lifecycleCheckpoint` is B's exact imported `GoldenLifecycleCheckpointReceiptV1 | null`, not a D projection or structural redeclaration. For scenarios 3/4 its `actionOperationHash` is exactly null; for scenario 6 it is the exact non-null C operation hash. A non-null checkpoint requires a non-null `actionReceipt`; `owner:"d-recovery"` requires `actionOperationHash:null`, while `owner:"c-golden-post-pr-review"` requires the same non-null `GoldenPostPrReviewActionReceiptV1.actionOperationHash`; any inverse/null mismatch fails. Separately, every scenario-3/4 D action carries a non-null `serviceRestartOperationRef`/`serviceRestartOperationHash` and terminal `serviceRestartReceiptRef`/`serviceRestartReceiptHash`. The verifier resolves the operation and completion/failure only through `createInternalProductionServiceRestartAuthorityV1()`, requires namespace `recovery-active-run`, exact campaign/epoch/attempt/service/guard/generation/action-receipt equality, and rejects a lifecycle action-operation hash copied from the service-restart hash. Process scenarios require both lifecycle checkpoint and action receipt null. Scenario 10 also requires `lifecycleCheckpoint:null`, but its separately authenticated D admitted-product restart receipt remains non-null, has all four service-restart members null, and is explicitly not a B lifecycle or service-restart operation.

Scenario 6 does not rely on the original process's opaque workflow capability. The stored B result must carry one exact non-null `workflowEvidenceHash`. The asynchronous verifier calls the injected C `repositoryWorkflowEvidence.resolve({workflowEvidenceHash:result.workflowEvidenceHash})`, requires the returned reminted/authenticated `GoldenRepositoryWorkflowEvidenceV1.evidenceHash` to equal that result member, and equality-checks its integration campaign/case/run/attempt/PR/accepted-head authority. It separately calls C's `GoldenPostPrReviewActionReceiptResolverV1.resolve({campaignHash,caseId,runId,generationHash,actionReceiptHash})`, recomputes the exact action receipt, and requires the reminted workflow evidence's non-null `postPrReview` to bind that same generation, operation/action receipt, comment/thread, reviewed/accepted head, completed claim/released runtime, and settled thread authority. These two fresh resolutions must agree with the exact B lifecycle receipt and stored result hash; a hash-only match with a forged/copy-constructed capability, null/stale/cross-run evidence, missing action, or action/evidence mismatch fails. D creates no resolver implementation, workflow store, capability cache, or GitHub action. Every process scenario resolves `processFixture.checkpointReceiptRef` through `RecoveryProcessFixtureReceiptResolverV1.getByRef(...)` and recomputes `receiptHash`. A success member must match exact campaign/epoch/case/scenario/run/run-number/generation/checkpoint/frame/before/after/target/database/assertion authority and zero cleanup. A typed-terminal member must match the exact owner/code in `RECOVERY_TYPED_TERMINALS_V1[scenarioId]`, reached checkpoint/frame, before/after/target hashes, authenticated terminal boundary/authority, and both cleanup census hash and cleanup envelope hash byte-for-byte between evidence and receipt, and must omit success assertions; only then is it selectable. A failure member instead matches only its reachable common authority plus finite failure code/boundary/observed authority and complete cleanup census hash plus cleanup envelope hash; it must omit success-only fields and may retain authenticated nonzero cleanup as a polluted, nonselectable attempt. Scenario 10 resolves the current epoch source-link and both runtime/envelope receipts, compares the source/tree/packet/contract/deployment/transfer authority, and performs no runtime start. A missing/refused/tampered store object or authority returns a stable issue code and never throws a partial acceptance.

Live evidence requires one structurally validated `goldenResult`, a null `processFixture`, and asynchronous golden-result identity equality. Scenarios 3, 4, and 6 additionally require one B-owned lifecycle receipt whose run ID/number/generation and predicate/action/operation identities equal the golden run and exact action authority; scenario 3/4 lifecycle operation hashes are exactly null, their independent D service-restart operation/completion pairs are non-null, and scenario 6's non-null operation/action authority is exclusively C's `GoldenPostPrReviewActionReceiptV1`. Scenario 10 requires `lifecycleCheckpoint:null` but still requires the strict admitted-product restart receipt. Actual-PostgreSQL evidence requires a null `goldenResult`, a null lifecycle receipt, one strict process-fixture receipt with the same scenario/run/generation, and a valid checkpoint/database hash; `actionReceipt` is null.

The pure transition rule is outcome- and phase-specific. Selectable success/typed-terminal evidence requires `before.phase:"before"`, all-zero unrelated ownership, one exact non-null authenticated target, and `before.totalOwnership` equal to its enumerated target. Its `after` is all-zero with no target. An executed failure uses only checkpoints actually reached by its strict receipt: if a before checkpoint exists it obeys the same no-unrelated/uninventoried-owner rule; its final checkpoint/census must exactly equal the receipt's complete cleanup census but may be nonzero for `cleanup_incomplete`, making the attempt polluted and nonselectable. No failure fabricates a success after checkpoint. The asynchronous verifier authenticates every enumerated ownership class to the exact run/generation/checkpoint/receipt. The mapped terminal-disposition union gives every one of the ten scenarios `accepted_continuation` and `scenario_attempt_failure`; only the two registry keys additionally receive a scenario-indexed typed member. `accepted_continuation` requires `typedTerminal:null` plus strict positive scenario authority. Scenario 5's `typed_terminal` accepts only `{owner:"provider_or_quota",code:"provider_or_quota_terminal"}`; scenario 6 accepts only `{owner:"generated_product_review",code:"post_pr_review_manual_blocker"}`. `scenario_attempt_failure` remains available to both of those scenarios and all other scenarios and is always executed but nonselectable: live mode requires B's resolved non-accepted cause or D action failure, while process mode requires the exact finite process failure and cleanup census/hash; it always has `typedTerminal:null`. A `RecoveryScenarioPreflightRefusalV1` means no execution; it is not evidence, never enters the attempt store, and contains no run/checkpoint/ownership/action/process/golden fields. Scenarios 1–4 and 7–10 categorically reject `typed_terminal` at parsing, selection, campaign verification, and finalization; a service or accepted-product restart refusal is a nonselectable attempt failure, never a terminal success.

Evidence persistence is attempt-based, never `${scenarioId}.json`. First write immutable evidence bytes at ``recovery/${campaignHash}/evidence/sha256/${evidenceHash.slice(0, 2)}/${evidenceHash}.json``. Then the code-owned attempt classifier derives `disposition` and `systemicRootHash`; neither is accepted from a caller or CLI. Live scenarios 3, 4, and 6 use B's exact authenticated trusted-cause/classification identity from the resolved nonaccepted `GoldenRunResultV1`. Scenario 10 is different: its accepted B source result is never failure or root authority. For an `api_durable_state_restart` failure, D resolves and rehashes the exact `RecoveryAcceptedProductSourceRuntimeReceiptV1` plus `RecoveryAcceptedProductRestartReceiptV1`, requires their failure boundary/code/runtime/action/cleanup identities to agree, and derives `failureTupleHash = hashCanonicalJson({scenarioId,boundary,failureCode,sourceRuntimeReceiptHash,actionOperationHash,cleanupHash})` as attempt-specific evidence only. Code maps the authenticated boundary/code to the finite literal `componentKind:"accepted-api-durable-state-runtime"`, normalizes the finite semantic tuple, and derives the stable `systemicRootHash = hashCanonicalJson({scenarioId,boundary,failureCode,componentKind})`. The attempt-specific source-runtime/action/cleanup hashes remain equality-verified and immutable but are categorically excluded from the systemic root, so the same semantic defect has one root across attempts and release epochs. Boundary, failure code, component kind, source-runtime receipt hash, non-null D `actionOperationHash`, and cleanup hash all come from authenticated D receipts and the code-owned mapping, never the accepted B result, B trusted cause, caller, CLI, exception prose, or logs. Other process attempts hash the finite stored tuple `{scenarioId,checkpoint,failure.code,failure.boundary,failure.observedAuthorityHash}` from their resolved failure receipt. The store appends one hash-chained `RecoveryScenarioAttemptV1` at ``recovery/${campaignHash}/attempts/sha256/${attemptHash.slice(0, 2)}/${attemptHash}.json`` and advances the mode-safe epoch head at ``recovery/${campaignHash}/attempt-heads/${finalReleaseEpoch.epochHash}/${scenarioId}.json`` only when its previous hash and next one-based ordinal match. Failed and polluted attempts from old epochs remain immutable and visible; the third occurrence of the stable semantic scenario-10 root blocks before another retry even when every occurrence has different runtime/action/cleanup evidence hashes.

A failed/polluted live golden attempt may start again only after C's fixed `GoldenRepairReviewReceiptResolverV1` and `GoldenRepairReviewConsumptionPortV1` authenticate and consume their exact failed-result repair authority. An actual-PostgreSQL/process attempt never uses C's failed-result resolver: D's `RecoveryRepairReviewReceiptResolverV1` must resolve a strict receipt keyed by exact `campaignHash + scenarioId + failedEvidenceHash + systemicRootHash`. `createRecoveryRepairReviewAuthorityV1().observe(...)` is the sole process-repair receipt producer. It takes only campaign/scenario/failed-evidence identity plus repository and PR number, resolves the failed attempt to derive its stored systemic root and failed epoch, reads the merged PR and current review-thread set, then runs the code-owned focused, broad, and clean-main build command sets. It derives `nextFinalReleaseEpoch` only after both repositories are clean and synchronized: the repaired repository member must equal `mergedSourceSha`, and the unaffected repository member must equal the authorized predecessor member unless a separately authenticated repair receipt advances it. It accepts no caller root, epoch, source pair, command, cwd, environment, review verdict, unresolved-finding count, authority hash, source SHA, check conclusion, or build identity. Before writing the receipt, and again before consumption, `RecoveryVerificationAuthorityResolverV1` independently resolves and rehashes all four `GoldenVerificationAuthorityReceiptV1` records referenced by `independentReviewReceiptHash`, `focusedVerificationHash`, `broadVerificationHash`, and `cleanBuildHash`. Their kinds must be exact, all verdicts must be `pass`, the independent-review authority must prove zero unresolved Critical/High/Medium findings for the current thread set, and all source/owner identities must equal the merged repair SHA and repository. Only then may `RecoveryRepairReviewConsumptionPortV1.consume(...)` record the one-use identity bound to failed and next epoch hashes and permit the fresh process attempt at exactly that next epoch. Missing/duplicate consumption, a draft/unmerged/wrong-repository PR, SHA or source-pair drift, non-pass review, unresolved C/H/M finding, test/build mismatch, or cross-campaign/scenario/root/epoch evidence fails before fixture execution. The new attempt binds the discriminated review/consumption hashes. `listScenarioHistory(campaignHash, scenarioId)` resolves every per-epoch head through the append-only campaign epoch index and validates every content hash/previous link before root counting or `attempt-history` output. Count systemic roots over every validated historical attempt in the stable campaign, including failed/polluted attempts from every epoch and across fresh processes. The third occurrence of one exact non-null systemic root stops all further execution with the canonical three-repeat blocker; no repair-review kind can reset or hide that count.

Scenario 10 has its own exact two-way remediation contract. A source repair calls only `observeSourceRepair(...)`: it re-resolves the D failure tuple/stable semantic root and failed epoch/link/result, authenticates the reviewed source PR, then requires one complete C Profiles 1–7 matrix receipt with `decision:"accepted"` on a strictly different `nextFinalReleaseEpoch`. It receives the matrix receipt only as C's exact `matrixReceiptRef`/`matrixReceiptHash` pair, calls `resolveGoldenMatrixReceiptV1({matrixReceiptRef,matrixReceiptHash})` in a fresh process, rehashes the strict receipt, and requires its complete final epoch and all ordered current-epoch profile slots. The three separately recorded Profile 1–3 result hashes must be the exact accepted ordinal-one CLI/API/web members of that resolved full matrix; no partial three-result authority can replace the matrix. D creates and reopens the next epoch's `RecoverySourceGoldenLinkReceiptV1`, requires its accepted API member to equal `nextSourceResultHash`, and only then expected-predecessor-CAS advances the code-owned current source-link binding from the failed link to that exact successor while retaining the failed epoch's immutable link index. The repair receipt records both failed and next epochs, links, results, three ordered Profile 1–3 hashes, their combined authority hash, and the full successor matrix ref/hash/final epoch. The old accepted B result/link remain byte-identical immutable history and cannot fill the successor D epoch. Before scenario-10 `reuse`, consumption freshly resolves the named matrix pair again, requires byte equality with its receipt, `decision:"accepted"`, all Profiles 1–7, exact next epoch, exact three Profile 1–3 hashes, and the next source link/API result; only then may it consume once. D reruns all ten selections for that new epoch before operational acceptance. An unchanged-epoch retry is allowed only through `observeInfrastructureRemediation(...)`, which resolves a separately authenticated fixed-index `RecoveryAcceptedProductInfrastructureRemediationResolverV1` receipt for the exact D failure tuple. In that branch failed and next epoch hashes, source-link hashes, and source-result hashes must all be identical, every PR/Profile/matrix field is null, and no C matrix resolver is consulted. A source repair with an unchanged epoch/result/link, incomplete/nonaccepted/unresolved matrix authority, an infrastructure remediation with any source/epoch change, a stale original link, a caller root/epoch/result/link/matrix/remediation ref, or replacement/mutation of the historical accepted B result fails before retry.

Only a `disposition:"selectable"` attempt whose asynchronous authority verification passes and whose `after` census is fully zero may be selected. Scenarios 1–4 and 7–10 require exactly `accepted_continuation`, `typedTerminal:null`, and their positive scenario-specific continuation proof; scenarios 5 and 6 alone may select either `accepted_continuation` or an exact registry-backed `typed_terminal`. `select()`, `verify-campaign`, reconciliation, and both finalizers enforce this discrimination at parse time and runtime rather than casting the broad scenario ID. `select()` writes one immutable ``recovery/${campaignHash}/selected/${finalReleaseEpoch.epochHash}/${scenarioId}.json`` receipt; a different later selection for the same campaign/epoch/scenario collides and fails. `verify-campaign`, reconciliation, browser acceptance, and packet finalization receive or resolve one exact final epoch and read exactly ten selections from that epoch—one per scenario. They never infer the latest attempt, discard old-epoch/unselected history, or combine epochs. A typed-terminal attempt for scenarios 1–4 or 7–10, a missing positive continuation proof, scenario failure, preflight refusal, failed/polluted attempt, missing selection, duplicate selection, cross-campaign/epoch hash, selected hash absent from its exact epoch history, or mixed source pair blocks finalization.

`observeRecoveryCompleteZeroOwnerCensusV1()` lives in `src/internal-production/recovery-evidence.ts`, accepts zero arguments, and calls A's exact unaliased `observeCompleteInternalProductionZeroOwnerCensusV1()` directly on every invocation. It returns A's exact frozen `InternalProductionCompleteZeroOwnerCensusObservationV1` without a D alias, projection, body copy, durable guard, ref/hash wrapper, cache, or publication owner. D checks every key of `InternalProductionCompleteZeroOwnerCensusV1`—including `executionAttemptCount`—plus `ownerCategoryRegistryHash`, `ownerCategoryCensusMapHash`, the current phase-versioned `activeProducerManifestSetActivationRef`/`activeProducerManifestSetActivationHash`, `activeProducerManifestSetHash`, `reservationIdentitySetHash`, `ownerIdentitySetHash`, and `observationHash`. Initial/final read-only checkpoints require every census field to be zero and retain the exact observation hash in their enclosing evidence; they do not mint mutation authority. The only fake observer is an unexported test helper inside `recovery-evidence.test.ts`; no production factory, dependency object, CLI flag, function parameter, or E caller can inject or replace the A observer.

No generic restart accepts that read-only census observation. All four namespaces use the fixed-first, discoverable, operation-bound target-family authorization defined in Task 2. The coordinator persists its exact authority and pending input; D writes one globally fixed active-pending discovery/input locator plus one separately stored content-addressed immutable prepare snapshot. The snapshot is `preparedActivePendingRef`/`preparedActivePendingHash`; the mutable fixed locator's phase/head identity is `currentActivePendingRef`/`currentActivePendingHash`. Their refs and hashes must differ even at first publication. The latter changes at every expected-hash phase advance and is status/discovery evidence only; it never replaces the prepared snapshot or becomes historical authorization authority. Zero-input resume alone derives/publishes the distinct immutable content-addressed authorization operation, which binds the prepared snapshot. Resume invokes A's restart-specific fence acquisition, which atomically returns the held fence and exact seven-target family. D publishes one-use authorization bound to that immutable operation/fence/family. `recovery-active-run` nests its non-null target-owner guard only inside its matching coordinator authority; each other namespace has its matching coordinator kind and null active target. Missing, extra, terminal, crossed, replayed, ordinary-begun, or structurally supplied target reservations fail before authorization or dispatch. The authorization is not global-zero evidence and cannot be reused by another operation or phase.

- [ ] **Step 1: Write failing schema and transition tests**

Create `tests/internal-production/recovery-evidence.test.ts` with fixtures that assert:

```ts
assert.deepEqual(verifyRecoveryScenarioEvidence(validAcceptedContinuation), []);
assert.deepEqual(verifyRecoveryScenarioEvidence(validTypedTerminal), []);
assert.ok(verifyRecoveryScenarioEvidence(leakedClaim).includes("active_claim_leak"));
assert.ok(verifyRecoveryScenarioEvidence(unrelatedBeforeOwner).includes("before_unrelated_ownership_not_zero"));
assert.ok(verifyRecoveryScenarioEvidence(unboundTargetOwner).includes("before_target_ownership_unbound"));
assert.ok(verifyRecoveryScenarioEvidence(nonzeroAfterTarget).includes("after_ownership_not_zero"));
assert.ok(verifyRecoveryScenarioEvidence(duplicateEffect).includes("mandatory_effect_unsettled"));
assert.ok(verifyRecoveryScenarioEvidence(changedRun).includes("run_identity_changed"));
assert.ok(verifyRecoveryScenarioEvidence(changedCampaign).includes("campaign_hash_mismatch"));
assert.ok(verifyRecoveryScenarioEvidence(resultRunMismatch).includes("golden_result_run_mismatch"));
assert.ok(verifyRecoveryScenarioEvidence(missingLiveLifecycleReceipt).includes("lifecycle_checkpoint_missing"));
assert.ok(verifyRecoveryScenarioEvidence(crossGenerationLifecycleReceipt).includes("lifecycle_checkpoint_generation_mismatch"));
assert.deepEqual(parseRecoveryScenarioPreflightRefusal(validRefusal), validRefusal);
assert.throws(() => parseRecoveryScenarioEvidence(validRefusal));
assert.throws(() => parseRecoveryScenarioEvidence({ ...valid, unexpected: true }));
assert.throws(() => parseRecoveryScenarioEvidence({ ...valid, evidenceHash: "0".repeat(64) }));
assert.deepEqual(await verifyRecoveryScenarioEvidenceAuthority(valid, authorityDeps), []);
assert.ok((await verifyRecoveryScenarioEvidenceAuthority(resultHashDrift, authorityDeps)).includes("golden_result_hash_mismatch"));
assert.ok((await verifyRecoveryScenarioEvidenceAuthority(missingStoredResult, authorityDeps)).includes("golden_result_unresolved"));
assert.ok((await verifyRecoveryScenarioEvidenceAuthority(tamperedStoredAction, authorityDeps)).includes("action_receipt_hash_mismatch"));
assert.ok((await verifyRecoveryScenarioEvidenceAuthority(missingWorkflowEvidence, authorityDeps)).includes("workflow_evidence_unresolved"));
assert.ok((await verifyRecoveryScenarioEvidenceAuthority(crossRunWorkflowEvidence, authorityDeps)).includes("workflow_evidence_identity_mismatch"));
assert.ok((await verifyRecoveryScenarioEvidenceAuthority(workflowActionDrift, authorityDeps)).includes("workflow_action_authority_mismatch"));
```

- [ ] **Step 2: Run the focused test and observe the expected module failure**

```bash
set -euo pipefail
node --import tsx --test tests/internal-production/recovery-evidence.test.ts
```

Expected: FAIL because `src/internal-production/recovery-evidence.ts` does not exist.

- [ ] **Step 3: Implement strict parsing, canonical hashing, and acceptance validation**

Use the repository's canonical JSON and SHA-256 helpers. Reject unknown fields, non-UTC timestamps, non-UUID run IDs, non-64-character lowercase hashes, negative or fractional census values, unsupported scenario/result names, or a `campaignHash` mismatch at any nested boundary. Apply B's exact bounded unique canonical-ref schema to every outer/nested ref array and reject repository-relative paths as well as absolute/`file:`/host paths. Hash the complete object except `evidenceHash`; never hash prose or volatile log content. Keep every store call out of the pure parser/verifier module; tests must prove a synchronous parse cannot pass merely because a fake object claims a valid result, action, process-fixture, or repair receipt hash.

- [ ] **Step 4: Run focused and adjacent contract tests**

```bash
set -euo pipefail
node --import tsx --test tests/internal-production/recovery-evidence.test.ts
npm run check:english
npm run check:paths
```

Expected: all pass.

- [ ] **Step 5: Setfarm-owned handoff**

After the focused checks pass, submit the exact immutable claim output with the claim-provided `setfarm step complete` command and transport. Before submission the worker may run only read-only scope checks such as `git status --short --branch`, `git diff --check`, and `git diff --name-only`; it must not create/switch a branch, stage, commit, push, or call `gh`. The Setfarm completion owner accepts only the two Task 1 files, reruns claim-bound gates, records the durable handoff receipt, and owns the resulting Git transition.

---

### Task 2: Add the observation-only recorder and bounded recovery coordinator

**Files:**

- Create: `setfarm/scripts/internal-production-recovery-evidence.ts`
- Create: `setfarm/tests/internal-production/recovery-evidence-script.test.ts`
- Modify: `setfarm/src/internal-production/recovery-evidence.ts`
- Create: `setfarm/src/internal-production/recovery-scenario-runner.ts`
- Create: `setfarm/src/internal-production/recovery-scenario-execution-guard-v1.ts`
- Create: `setfarm/tests/internal-production/recovery-scenario-execution-guard-v1.test.ts`
- Create: `setfarm/src/internal-production/recovery-live-inflight-store-v1.ts`
- Create: `setfarm/tests/internal-production/recovery-live-inflight-store-v1.test.ts`
- Create: `setfarm/tests/internal-production/recovery-scenario-runner.test.ts`
- Create: `setfarm/src/internal-production/recovery-composition.ts`
- Create: `setfarm/tests/internal-production/recovery-composition.test.ts`
- Create: `setfarm/tests/internal-production/recovery-source-boundary.test.ts`
- Create: `setfarm/src/internal-production/recovery-action-port.ts`
- Create: `setfarm/src/internal-production/internal-production-service-restart-authority-v1.ts`
- Create: `setfarm/src/internal-production/recovery-owner-producer-manifest-activation-v1.ts`
- Create: `setfarm/src/internal-production/internal-production-service-restart-startup-v1.ts`
- Modify: `setfarm/src/internal-production/setfarm-completion-owner-receipt-activation-controller-v1.ts`
- Create: `setfarm/scripts/support/internal-production-service-restart-helper-v1.ts`
- Create: `setfarm/tests/internal-production/internal-production-service-restart-authority-v1.test.ts`
- Create: `setfarm/tests/internal-production/recovery-owner-producer-manifest-activation-v1.test.ts`
- Create: `setfarm/tests/internal-production/internal-production-service-restart-startup-v1.test.ts`
- Modify: `setfarm/tests/internal-production/setfarm-completion-owner-receipt-activation-controller-v1.test.ts`
- Create: `setfarm/tests/internal-production/internal-production-service-restart-source-boundary.test.ts`
- Create: `setfarm/src/internal-production/recovery-action-receipt.ts`
- Create: `setfarm/src/internal-production/recovery-process-fixture-receipt.ts`
- Create: `setfarm/src/internal-production/recovery-attempt-store.ts`
- Create: `setfarm/src/internal-production/recovery-repair-review.ts`
- Create: `setfarm/src/internal-production/recovery-accepted-product-repair-review.ts`
- Create: `setfarm/src/internal-production/recovery-browser-continuity.ts`
- Create: `setfarm/src/internal-production/recovery-packet-review.ts`
- Create: `setfarm/tests/internal-production/recovery-packet-review.test.ts`
- Create: `setfarm/src/internal-production/recovery-accepted-product-runtime.ts`
- Create: `setfarm/tests/internal-production/recovery-action-port.test.ts`
- Create: `setfarm/tests/internal-production/recovery-action-receipt.test.ts`
- Create: `setfarm/tests/internal-production/recovery-process-fixture-receipt.test.ts`
- Create: `setfarm/tests/internal-production/recovery-attempt-store.test.ts`
- Create: `setfarm/tests/internal-production/recovery-repair-review.test.ts`
- Create: `setfarm/tests/internal-production/recovery-accepted-product-repair-review.test.ts`
- Create: `setfarm/tests/internal-production/recovery-browser-continuity.test.ts`
- Create: `setfarm/tests/internal-production/recovery-accepted-product-runtime.test.ts`
- Create: `setfarm/src/internal-production/recovery-checkpoint-port.ts`
- Modify: `setfarm/src/spawner.ts`
- Modify: `setfarm/src/server/daemon.ts`
- Modify: `setfarm/src/execution/runtime-completion.ts`
- Modify: `setfarm/src/execution/runtime-completion-effect-runner.ts`
- Modify: `setfarm/src/execution/claim-runtime-publication.ts`
- Create: `setfarm/scripts/support/internal-production-recovery-process-fixture.ts`
- Create: `setfarm/tests/internal-production/recovery-checkpoint-port.test.ts`
- Create: `setfarm/tests/internal-production/recovery-process-fixture.test.ts`
- Create: `setfarm/scripts/internal-production-recovery-scenario.ts`
- Create: `setfarm/evals/suites/internal-production-recovery-v1.json`
- Create: `setfarm/src/internal-production/recovery-campaign.ts`
- Create: `setfarm/tests/internal-production/recovery-campaign.test.ts`
- Create: `setfarm/src/internal-production/recovery-packet.ts`
- Create: `setfarm/tests/internal-production/recovery-packet.test.ts`
- Create: `setfarm/src/internal-production/recovery-docs-delivery-acceptance.ts`
- Create: `setfarm/tests/internal-production/recovery-docs-delivery-acceptance.test.ts`
- Modify: `setfarm/package.json`

**Interfaces:**

Task 2 produces the sole `activateInternalProductionRecoveryOwnerProducerManifestSetV1()`, `resolveInternalProductionRecoveryOwnerProducerManifestActivationV1(...)`, and `observeInternalProductionRecoveryOwnerProducerManifestActivationStatusV1()` implementation/test pair. The source claim and handoff projection must contain both exact activation paths and prove `A+B+C` count `27` advances by the exact predecessor `{head,receipt}` pair to `A+B+C+D` count `43`, whose successor `{head,receipt}` pair is freshly reopened and byte-equal; omitting either path or either head pair makes the complete Task 2 claim invalid and prevents `d-startup-hook-load`, cutover, or any generic D producer.

The recorder has one authoritative entry point only: the earlier exact `createRecoveryEvidenceCliDependenciesV1({campaignHash})` production composition and `runRecoveryEvidenceCliV1(argv: readonly string[], dependencies: RecoveryEvidenceCliDependenciesV1)`. This task must not introduce an unversioned `RecoveryEvidenceDependencies`, `runRecoveryEvidenceCli`, alternate `goldenProjection`, direct `readRunCensus`, caller clock, repository, or execution-capable dependency surface.

```ts
export interface RecoveryCheckpointActionRequestV1 {
  campaignHash: string;
  caseId: string;
  scenarioId:
    | "mission_control_active_run_restart"
    | "dashboard_active_run_restart";
  runId: string;
  runNumber: number;
  generation: GoldenLifecycleGenerationV1;
  predicateHash: string;
}

export type RecoveryMissionControlRestartRequestV1 = RecoveryCheckpointActionRequestV1 & Readonly<{
  scenarioId: "mission_control_active_run_restart";
  generation: Extract<GoldenLifecycleGenerationV1, { kind: "story-claim-generation" }>;
}>;
export type RecoveryDashboardRestartRequestV1 = RecoveryCheckpointActionRequestV1 & Readonly<{
  scenarioId: "dashboard_active_run_restart";
  generation: Extract<GoldenLifecycleGenerationV1, { kind: "story-claim-generation" }>;
}>;

export interface RecoveryBrowserContinuityReceiptV1 {
  route: string;
  pollingStartedAt: string;
  pollingFinishedAt: string;
  pollIntervalMs: 1000;
  beforeVisibleStateHash: string;
  orderedVisibleStateHashes: readonly string[];
  disconnectCount: number;
  reconnectCount: number;
  afterVisibleStateHash: string;
  consoleErrorHashes: readonly string[];
  browserEvidenceHash: string;
  browserEvidenceRef: string;
}

export interface RecoveryBrowserContinuitySession {
  awaitInitialSameRunVisibleState(): Promise<Readonly<{ visibleStateHash: string }>>;
  awaitRecoveredSameRunVisibleState(input: Readonly<{
    afterHttpObservationHash: string;
  }>): Promise<RecoveryBrowserContinuityReceiptV1>;
  close(): Promise<void>;
}

export interface RecoveryBrowserContinuityPort {
  begin(input: Readonly<{
    campaignHash: string;
    scenarioId: "mission_control_active_run_restart" | "dashboard_active_run_restart";
    runId: string;
  }>): Promise<RecoveryBrowserContinuitySession>;
}

export function createPlaywrightRecoveryBrowserContinuityPort(): RecoveryBrowserContinuityPort;

export type InternalProductionServiceRestartNamespaceV1 =
  | "recovery-active-run"
  | "source-release-barrier"
  | "cold-rehearsal"
  | "documentation-handoff";

export type InternalProductionRestartServiceV1 =
  | Readonly<{ service: "setfarm-spawner"; label: "com.setrox.setfarm-spawner" }>
  | Readonly<{ service: "setfarm-dashboard"; label: "com.setrox.setfarm-dashboard" }>
  | Readonly<{ service: "mission-control"; label: "com.setrox.mission-control" }>;

export interface RecoveryActiveRunTargetOwnerGuardReceiptV1 {
  schema: "setfarm.internal-production-recovery-active-run-target-owner-guard.v1";
  namespace: "recovery-active-run";
  campaignHash: string;
  caseId: string;
  runId: string;
  runNumber: number;
  generationHash: string;
  predicateHash: string;
  target: InternalProductionRestartServiceV1;
  exactTargetOwnership: RecoveryTargetOwnershipV1;
  exactTargetOwnerSetHash: string;
  unrelatedOwnership: RecoveryOwnershipCensusV1;
  unrelatedOwnershipHash: string;
  guardRef: CanonicalRef;
  guardHash: string;
}

export type InternalProductionServiceRestartCoordinatorTargetAuthorityV1 =
  | Readonly<{
      kind: "recovery-active-run";
      coordinatorAuthorityRef: CanonicalRef;
      coordinatorAuthorityHash: string;
      activeTargetAuthorityRef: CanonicalRef;
      activeTargetAuthorityHash: string;
      activeRunTargetOwnerGuard: RecoveryActiveRunTargetOwnerGuardReceiptV1;
    }>
  | Readonly<{
      kind: "source-release-barrier";
      coordinatorAuthorityRef: CanonicalRef;
      coordinatorAuthorityHash: string;
      activeTargetAuthorityRef: null;
      activeTargetAuthorityHash: null;
    }>
  | Readonly<{
      kind: "cold-rehearsal";
      coordinatorAuthorityRef: CanonicalRef;
      coordinatorAuthorityHash: string;
      activeTargetAuthorityRef: null;
      activeTargetAuthorityHash: null;
    }>
  | Readonly<{
      kind: "documentation-handoff";
      coordinatorAuthorityRef: CanonicalRef;
      coordinatorAuthorityHash: string;
      activeTargetAuthorityRef: null;
      activeTargetAuthorityHash: null;
    }>;

export const RECOVERY_RESTART_TARGET_AUTHORIZATION_ACTIVE_PENDING_REF_V1 =
  "setfarm://internal-production/recovery-restart-target-authorization/active-pending" as const;

export const RECOVERY_RESTART_TARGET_AUTHORIZATION_PREPARED_SNAPSHOT_REF_PREFIX_V1 =
  "setfarm://internal-production/recovery-restart-target-authorization/prepared/sha256/" as const;

// A content-addressed, immutable prepare-time authority. It is deliberately
// separate from the fixed mutable active-pending locator below.
export interface RecoveryRestartTargetAuthorizationPreparedSnapshotV1 {
  schema: "setfarm.internal-production-recovery-restart-target-authorization-prepared-snapshot.v1";
  pendingInputRef: CanonicalRef;
  pendingInputHash: string;
  namespace: InternalProductionServiceRestartNamespaceV1;
  target: InternalProductionRestartServiceV1;
  coordinationHash: string;
  coordinatorTargetAuthority: InternalProductionServiceRestartCoordinatorTargetAuthorityV1;
  coordinatorTargetReservationSetHash: string;
  // Derived after hashing the complete strict snapshot body with exactly these
  // two self-identifying fields omitted; the ref uses the declared prefix and
  // the resolver recomputes both before accepting canonical bytes. Tests reject
  // either self field in the projection and any derived ref/hash drift.
  preparedActivePendingRef: CanonicalRef;
  preparedActivePendingHash: string;
}

type RecoveryRestartTargetAuthorizationActivePendingCommonV1 = Readonly<{
  schema: "setfarm.recovery-restart-target-authorization-active-pending.v1";
  pendingInputRef: CanonicalRef;
  pendingInputHash: string;
  namespace: InternalProductionServiceRestartNamespaceV1;
  target: InternalProductionRestartServiceV1;
  coordinationHash: string;
  coordinatorTargetAuthority: InternalProductionServiceRestartCoordinatorTargetAuthorityV1;
  coordinatorTargetReservationSetHash: string;
  // Immutable content-addressed prepare-time snapshot. It never changes after
  // publication and is the only pending identity an operation may bind.
  preparedActivePendingRef: CanonicalRef;
  preparedActivePendingHash: string;
  // Mutable fixed-locator head for the currently observed phase. Its hash is
  // deliberately distinct from the prepared snapshot once the phase advances.
  currentActivePendingRef:
    typeof RECOVERY_RESTART_TARGET_AUTHORIZATION_ACTIVE_PENDING_REF_V1;
  currentActivePendingHash: string;
}>;

export type RecoveryRestartTargetAuthorizationActivePendingV1 =
  RecoveryRestartTargetAuthorizationActivePendingCommonV1 & (
    | Readonly<{
        phase: "pending-input";
        authorizationOperationRef: null;
        authorizationOperationHash: null;
        authorizationRef: null;
        authorizationHash: null;
        finalEnvelopeRef: null;
        finalEnvelopeHash: null;
      }>
    | Readonly<{
        phase: "operation-published";
        authorizationOperationRef: CanonicalRef;
        authorizationOperationHash: string;
        authorizationRef: null;
        authorizationHash: null;
        finalEnvelopeRef: null;
        finalEnvelopeHash: null;
      }>
    | Readonly<{
        phase: "authorized";
        authorizationOperationRef: CanonicalRef;
        authorizationOperationHash: string;
        authorizationRef: CanonicalRef;
        authorizationHash: string;
        finalEnvelopeRef: null;
        finalEnvelopeHash: null;
      }>
    | Readonly<{
        phase: "terminal-finalized";
        authorizationOperationRef: CanonicalRef;
        authorizationOperationHash: string;
        authorizationRef: CanonicalRef;
        authorizationHash: string;
        finalEnvelopeRef: CanonicalRef;
        finalEnvelopeHash: string;
      }>
  );

export interface RecoveryRestartTargetAuthorizationOperationV1 {
  schema: "setfarm.internal-production-recovery-restart-target-authorization-operation.v1";
  pendingInputRef: CanonicalRef;
  pendingInputHash: string;
  namespace: InternalProductionServiceRestartNamespaceV1;
  target: InternalProductionRestartServiceV1;
  coordinationHash: string;
  coordinatorTargetAuthority: InternalProductionServiceRestartCoordinatorTargetAuthorityV1;
  coordinatorTargetReservationSetHash: string;
  preparedActivePendingRef: CanonicalRef;
  preparedActivePendingHash: string;
  authorizationOperationRef: CanonicalRef;
  authorizationOperationHash: string;
}

export interface RecoveryRestartTargetAuthorizationV1 {
  schema: "setfarm.internal-production-recovery-restart-target-authorization.v1";
  authorizationOperationRef: CanonicalRef;
  authorizationOperationHash: string;
  preparedActivePendingRef: CanonicalRef;
  preparedActivePendingHash: string;
  namespace: InternalProductionServiceRestartNamespaceV1;
  target: InternalProductionRestartServiceV1;
  coordinationHash: string;
  coordinatorTargetAuthority: InternalProductionServiceRestartCoordinatorTargetAuthorityV1;
  coordinatorTargetReservationSetHash: string;
  restartReservationRef: CanonicalRef;
  restartReservationHash: string;
  serviceRestartOperationReservationRef: CanonicalRef;
  serviceRestartOperationReservationHash: string;
  launchOutboxReservationRef: CanonicalRef;
  launchOutboxReservationHash: string;
  helperProcessReservationRef: CanonicalRef;
  helperProcessReservationHash: string;
  dispatchChildProcessReservationRef: CanonicalRef;
  dispatchChildProcessReservationHash: string;
  startupListenerReservationRef: CanonicalRef;
  startupListenerReservationHash: string;
  replacementProcessReservationRef: CanonicalRef;
  replacementProcessReservationHash: string;
  targetFamilyHash: string;
  ownerAdmissionFenceRef: CanonicalRef;
  ownerAdmissionFenceHash: string;
  ownerAdmissionFenceHeadHash: string;
  oneUseAuthorizationNonceHash: string;
  authorizationRef: CanonicalRef;
  authorizationHash: string;
}

export interface RecoveryRestartTargetAuthorizationConsumptionV1 {
  schema: "setfarm.internal-production-recovery-restart-target-authorization-consumption.v1";
  authorizationRef: CanonicalRef;
  authorizationHash: string;
  authorizationOperationRef: CanonicalRef;
  authorizationOperationHash: string;
  preparedActivePendingRef: CanonicalRef;
  preparedActivePendingHash: string;
  operationRef: CanonicalRef;
  operationHash: string;
  restartReservationRef: CanonicalRef;
  restartReservationHash: string;
  serviceRestartOperationReservationRef: CanonicalRef;
  serviceRestartOperationReservationHash: string;
  launchOutboxReservationRef: CanonicalRef;
  launchOutboxReservationHash: string;
  helperProcessReservationRef: CanonicalRef;
  helperProcessReservationHash: string;
  dispatchChildProcessReservationRef: CanonicalRef;
  dispatchChildProcessReservationHash: string;
  startupListenerReservationRef: CanonicalRef;
  startupListenerReservationHash: string;
  replacementProcessReservationRef: CanonicalRef;
  replacementProcessReservationHash: string;
  ownerAdmissionFenceRef: CanonicalRef;
  ownerAdmissionFenceHash: string;
  consumptionRef: CanonicalRef;
  consumptionHash: string;
}

export interface InternalProductionServiceRestartTerminalPredecessorV1 {
  finalEnvelopeRef: CanonicalRef;
  finalEnvelopeHash: string;
  occurrenceRef: CanonicalRef;
  occurrenceHash: string;
  headRef: CanonicalRef;
  headHash: string;
  operationRef: CanonicalRef;
  operationHash: string;
  terminalCoreRef: CanonicalRef;
  terminalCoreHash: string;
  targetSetCloseRef: CanonicalRef;
  targetSetCloseHash: string;
  ownerAdmissionFenceReleaseRef: CanonicalRef;
  ownerAdmissionFenceReleaseHash: string;
  helperSettlementRef: CanonicalRef;
  helperSettlementHash: string;
}

export interface InternalProductionServiceRestartOccurrenceV1 {
  schema: "setfarm.internal-production-service-restart-occurrence.v1";
  namespace: InternalProductionServiceRestartNamespaceV1;
  target: InternalProductionRestartServiceV1;
  occurrenceOrdinal: number;
  operationRef: CanonicalRef;
  operationHash: string;
  authorizationOperationRef: CanonicalRef;
  authorizationOperationHash: string;
  terminalCoreRef: CanonicalRef;
  terminalCoreHash: string;
  targetSetCloseRef: CanonicalRef;
  targetSetCloseHash: string;
  terminalDisposition: "complete" | "failed";
  helperSettlementRef: CanonicalRef;
  helperSettlementHash: string;
  predecessorOccurrenceRef: CanonicalRef | null;
  predecessorOccurrenceHash: string | null;
  occurrenceRef: CanonicalRef;
  occurrenceHash: string;
}

export interface InternalProductionServiceRestartHeadV1 {
  schema: "setfarm.internal-production-service-restart-head.v1";
  namespace: InternalProductionServiceRestartNamespaceV1;
  target: InternalProductionRestartServiceV1;
  occurrenceCount: number;
  currentOccurrenceRef: CanonicalRef;
  currentOccurrenceHash: string;
  currentTerminalCoreRef: CanonicalRef;
  currentTerminalCoreHash: string;
  currentTargetSetCloseRef: CanonicalRef;
  currentTargetSetCloseHash: string;
  appendOnlyIndexRootHash: string;
  headRef: CanonicalRef;
  headHash: string;
}

export interface InternalProductionServiceRestartDispatchReservationV1 {
  schema: "setfarm.internal-production-service-restart-dispatch-reservation.v1";
  target: InternalProductionRestartServiceV1;
  namespace: InternalProductionServiceRestartNamespaceV1;
  coordinationIdHash: string;
  expectedOperationIdHash: string;
  targetRestartReservationRef: CanonicalRef;
  targetRestartReservationHash: string;
  targetFamilyHash: string;
  serviceStartSlotOrdinal: number;
  predecessorServiceStartSlotHeadRef: CanonicalRef | null;
  predecessorServiceStartSlotHeadHash: string | null;
  state: "active" | "settled";
  predecessorReservationRef: CanonicalRef | null;
  predecessorReservationHash: string | null;
  terminalSettlementRef: CanonicalRef | null;
  terminalSettlementHash: string | null;
  reservationRef: CanonicalRef;
  reservationHash: string;
}

export type InternalProductionRestartConfiguredLabelV1 =
  | "com.setrox.setfarm-spawner"
  | "com.setrox.setfarm-dashboard"
  | "com.setrox.mission-control";

export interface InternalProductionServiceOrdinaryStartingClaimV1 {
  schema: "setfarm.internal-production-service-ordinary-starting-claim.v1";
  kind: "ordinary-starting";
  service: InternalProductionRestartServiceV1;
  configuredLabel: InternalProductionRestartConfiguredLabelV1;
  sourceSha: string;
  entrypointBuildIdentityHash: string;
  startupProcessIdentityHash: string;
  launchdParentAuthorityHash: string;
  serviceStartSlotOrdinal: number;
  predecessorServiceStartSlotHeadRef: CanonicalRef | null;
  predecessorServiceStartSlotHeadHash: string | null;
  claimRef: CanonicalRef;
  claimHash: string;
}

export interface InternalProductionServiceOrdinaryOwnerPublicationV1 {
  schema: "setfarm.internal-production-service-ordinary-owner-publication.v1";
  service: InternalProductionRestartServiceV1;
  ordinaryStartingClaimRef: CanonicalRef;
  ordinaryStartingClaimHash: string;
  activeServiceStartSlotHeadRef: CanonicalRef;
  activeServiceStartSlotHeadHash: string;
  startupProcessIdentityHash: string;
  ownerListenerAuthorityHash: string;
  publicationRef: CanonicalRef;
  publicationHash: string;
}

export type InternalProductionServiceOrdinaryStartSettlementV1 =
  | Readonly<{
      schema: "setfarm.internal-production-service-ordinary-start-settlement.v1";
      disposition: "owner-listener-published";
      service: InternalProductionRestartServiceV1;
      ordinaryStartingClaimRef: CanonicalRef;
      ordinaryStartingClaimHash: string;
      activeServiceStartSlotHeadRef: CanonicalRef;
      activeServiceStartSlotHeadHash: string;
      ownerPublicationRef: CanonicalRef;
      ownerPublicationHash: string;
      startupProcessAbsenceAuthorityHash: null;
      ownerListenerAbsenceAuthorityHash: null;
      settlementRef: CanonicalRef;
      settlementHash: string;
    }>
  | Readonly<{
      schema: "setfarm.internal-production-service-ordinary-start-settlement.v1";
      disposition: "failed-before-owner-listener-publication";
      service: InternalProductionRestartServiceV1;
      ordinaryStartingClaimRef: CanonicalRef;
      ordinaryStartingClaimHash: string;
      activeServiceStartSlotHeadRef: CanonicalRef;
      activeServiceStartSlotHeadHash: string;
      ownerPublicationRef: null;
      ownerPublicationHash: null;
      startupProcessAbsenceAuthorityHash: string;
      ownerListenerAbsenceAuthorityHash: string;
      settlementRef: CanonicalRef;
      settlementHash: string;
    }>;

export type InternalProductionServiceStartSlotHeadV1 = Readonly<{
  schema: "setfarm.internal-production-service-start-slot-head.v1";
  service: InternalProductionRestartServiceV1;
  slotOrdinal: number;
  predecessorHeadRef: CanonicalRef | null;
  predecessorHeadHash: string | null;
  state:
    | Readonly<{
        kind: "restart-reserved";
        dispatchReservationRef: CanonicalRef;
        dispatchReservationHash: string;
        ordinaryStartingClaimRef: null;
        ordinaryStartingClaimHash: null;
        terminalSettlementKind: null;
        terminalSettlementRef: null;
        terminalSettlementHash: null;
      }>
    | Readonly<{
        kind: "ordinary-starting";
        dispatchReservationRef: null;
        dispatchReservationHash: null;
        ordinaryStartingClaimRef: CanonicalRef;
        ordinaryStartingClaimHash: string;
        terminalSettlementKind: null;
        terminalSettlementRef: null;
        terminalSettlementHash: null;
      }>
    | Readonly<{
        kind: "settled";
        dispatchReservationRef: null;
        dispatchReservationHash: null;
        ordinaryStartingClaimRef: null;
        ordinaryStartingClaimHash: null;
        terminalSettlementKind: "restart" | "ordinary-start";
        terminalSettlementRef: CanonicalRef;
        terminalSettlementHash: string;
      }>;
  headRef: CanonicalRef;
  headHash: string;
}>;

export type InternalProductionServiceRestartPrepareRefusalCodeV1 =
  | "SERVICE_RESTART_AUTHORITY_NOT_ACTIVATED"
  | "SERVICE_START_SLOT_ORDINARY_STARTING"
  | "SERVICE_START_SLOT_RESTART_RESERVED_BY_OTHER_OPERATION"
  | "SERVICE_START_SLOT_AMBIGUOUS";

export interface InternalProductionServiceRestartOperationV1 {
  schema: "setfarm.internal-production-service-restart-operation.v1";
  namespace: InternalProductionServiceRestartNamespaceV1;
  scopeHash: string;
  finalReleaseEpoch: GoldenFinalReleaseEpochV1;
  attemptHash: string;
  coordinationRef: CanonicalRef;
  coordinationHash: string;
  coordinationIdHash: string;
  occurrenceOrdinal: number;
  target: InternalProductionRestartServiceV1;
  authorizationRef: CanonicalRef;
  authorizationHash: string;
  authorizationOperationRef: CanonicalRef;
  authorizationOperationHash: string;
  restartReservationRef: CanonicalRef;
  restartReservationHash: string;
  serviceRestartOperationReservationRef: CanonicalRef;
  serviceRestartOperationReservationHash: string;
  launchOutboxReservationRef: CanonicalRef;
  launchOutboxReservationHash: string;
  helperProcessReservationRef: CanonicalRef;
  helperProcessReservationHash: string;
  dispatchChildProcessReservationRef: CanonicalRef;
  dispatchChildProcessReservationHash: string;
  startupListenerReservationRef: CanonicalRef;
  startupListenerReservationHash: string;
  replacementProcessReservationRef: CanonicalRef;
  replacementProcessReservationHash: string;
  targetFamilyHash: string;
  beforeGenerationHash: string;
  entrypointBuildIdentityHash: string;
  terminalPredecessor: InternalProductionServiceRestartTerminalPredecessorV1 | null;
  dispatchReservationRef: CanonicalRef;
  dispatchReservationHash: string;
  operationIdHash: string;
  expectedGenerationProjectionHash: string;
  operationRef: CanonicalRef;
  operationHash: string;
}

export interface InternalProductionServiceRestartLaunchOutboxV1 {
  schema: "setfarm.internal-production-service-restart-launch-outbox.v1";
  operationRef: CanonicalRef;
  operationHash: string;
  launchOutboxReservationRef: CanonicalRef;
  launchOutboxReservationHash: string;
  targetFamilyHash: string;
  outboxRef: CanonicalRef;
  outboxHash: string;
}

export interface InternalProductionServiceRestartHelperClaimV1 {
  schema: "setfarm.internal-production-service-restart-helper-claim.v1";
  operationRef: CanonicalRef;
  operationHash: string;
  helperProcessReservationRef: CanonicalRef;
  helperProcessReservationHash: string;
  targetFamilyHash: string;
  helperPid: number;
  helperProcessIdentityHash: string;
  helperLaunchIdentityHash: string;
  claimedPredispatchHash: string;
  helperClaimRef: CanonicalRef;
  helperClaimHash: string;
}

export interface InternalProductionServiceRestartChildReceiptV1 {
  schema: "setfarm.internal-production-service-restart-child-receipt.v1";
  operationRef: CanonicalRef;
  operationHash: string;
  dispatchChildProcessReservationRef: CanonicalRef;
  dispatchChildProcessReservationHash: string;
  targetFamilyHash: string;
  helperClaimRef: CanonicalRef;
  helperClaimHash: string;
  childPid: number;
  childProcessIdentityHash: string;
  boundedStdoutHash: string;
  boundedStderrHash: string;
  exitCode: number | null;
  exitSignal: string | null;
  disposition: "reaped" | "terminated-and-reaped";
  childAbsenceAuthorityHash: string;
  childReceiptRef: CanonicalRef;
  childReceiptHash: string;
}

export interface InternalProductionServiceRestartPidReceiptV1 {
  schema: "setfarm.internal-production-service-restart-pid-receipt.v1";
  operationRef: CanonicalRef;
  operationHash: string;
  replacementProcessReservationRef: CanonicalRef;
  replacementProcessReservationHash: string;
  targetFamilyHash: string;
  helperClaimRef: CanonicalRef;
  helperClaimHash: string;
  childReceiptRef: CanonicalRef;
  childReceiptHash: string;
  launchedPid: number;
  proofKind: "preopened-helper-output" | "authenticated-startup-marker";
  processIdentityHash: string;
  pidReceiptRef: CanonicalRef;
  pidReceiptHash: string;
}

export interface InternalProductionServiceRestartProcessMarkerV1 {
  schema: "setfarm.internal-production-service-restart-process-marker.v1";
  namespace: InternalProductionServiceRestartNamespaceV1;
  target: InternalProductionRestartServiceV1;
  operationRef: CanonicalRef;
  operationHash: string;
  replacementProcessReservationRef: CanonicalRef;
  replacementProcessReservationHash: string;
  targetFamilyHash: string;
  actualPid: number;
  actualProcessIdentityHash: string;
  actualEntrypointBuildIdentityHash: string;
  loadedSourceSha: string;
  restartOperationIdHash: string;
  markerRef: CanonicalRef;
  markerHash: string;
}

export interface InternalProductionServiceRestartStartupListenerAuthorityV1 {
  schema: "setfarm.internal-production-service-restart-startup-listener-authority.v1";
  namespace: InternalProductionServiceRestartNamespaceV1;
  target: InternalProductionRestartServiceV1;
  operationRef: CanonicalRef;
  operationHash: string;
  startupListenerReservationRef: CanonicalRef;
  startupListenerReservationHash: string;
  targetFamilyHash: string;
  listenerOwnerRef: CanonicalRef;
  listenerOwnerHash: string;
  listenerTerminalRef: CanonicalRef;
  listenerTerminalHash: string;
}

export interface InternalProductionServiceRestartCompletionReceiptV1 {
  schema: "setfarm.internal-production-service-restart-completion.v1";
  operationRef: CanonicalRef;
  operationHash: string;
  authorizationRef: CanonicalRef;
  authorizationHash: string;
  authorizationConsumptionRef: CanonicalRef;
  authorizationConsumptionHash: string;
  authorizationOperationRef: CanonicalRef;
  authorizationOperationHash: string;
  dispatchReservationSettlementRef: CanonicalRef;
  dispatchReservationSettlementHash: string;
  helperClaimRef: CanonicalRef;
  helperClaimHash: string;
  childReceiptRef: CanonicalRef;
  childReceiptHash: string;
  pidReceiptRef: CanonicalRef;
  pidReceiptHash: string;
  markerRef: CanonicalRef;
  markerHash: string;
  helperSettlementRef: CanonicalRef;
  helperSettlementHash: string;
  terminalCoreRef: CanonicalRef;
  terminalCoreHash: string;
  targetSetCloseRef: CanonicalRef;
  targetSetCloseHash: string;
  occurrenceRef: CanonicalRef;
  occurrenceHash: string;
  namespaceServiceHeadRef: CanonicalRef;
  namespaceServiceHeadHash: string;
  ownerAdmissionFenceReleaseRef: CanonicalRef;
  ownerAdmissionFenceReleaseHash: string;
  afterGenerationHash: string;
  disposition: "executed" | "adopted";
  completionRef: CanonicalRef;
  completionHash: string;
}

export interface InternalProductionServiceRestartFailureReceiptV1 {
  schema: "setfarm.internal-production-service-restart-failure.v1";
  operationRef: CanonicalRef;
  operationHash: string;
  authorizationRef: CanonicalRef;
  authorizationHash: string;
  authorizationConsumptionRef: CanonicalRef;
  authorizationConsumptionHash: string;
  authorizationOperationRef: CanonicalRef;
  authorizationOperationHash: string;
  dispatchReservationSettlementRef: CanonicalRef;
  dispatchReservationSettlementHash: string;
  code:
    | "SERVICE_RESTART_DISPATCH_OUTCOME_UNCERTAIN"
    | "SERVICE_RESTART_EXPECTED_PROCESS_DIED"
    | "SERVICE_RESTART_IDENTITY_AMBIGUOUS";
  helperSettlementRef: CanonicalRef;
  helperSettlementHash: string;
  terminalCoreRef: CanonicalRef;
  terminalCoreHash: string;
  targetSetCloseRef: CanonicalRef;
  targetSetCloseHash: string;
  occurrenceRef: CanonicalRef;
  occurrenceHash: string;
  namespaceServiceHeadRef: CanonicalRef;
  namespaceServiceHeadHash: string;
  ownerAdmissionFenceReleaseRef: CanonicalRef;
  ownerAdmissionFenceReleaseHash: string;
  exactProcessAbsenceAuthorityHash: string;
  failureRef: CanonicalRef;
  failureHash: string;
}

export type InternalProductionServiceRestartExecutionResultV1 =
  | Readonly<{
      status: "in_progress";
      operationRef: CanonicalRef;
      operationHash: string;
      observationHash: string;
      remainingObservations: 1 | 2;
    }>
  | Readonly<{
      status: "complete";
      completion: InternalProductionServiceRestartCompletionReceiptV1;
      occurrence: InternalProductionServiceRestartOccurrenceV1;
      head: InternalProductionServiceRestartHeadV1;
    }>
  | Readonly<{
      status: "failed";
      failure: InternalProductionServiceRestartFailureReceiptV1;
      occurrence: InternalProductionServiceRestartOccurrenceV1;
      head: InternalProductionServiceRestartHeadV1;
    }>;

// A already owns these strict contracts, stores, and resolvers in the merged
// `./baseline-restart-authority-retirement-v1.js` module. D imports and
// identity-re-exports them; it declares no local readiness, activation,
// cutover, store, locator, observer, recorder, schema, or structural alias.
import type {
  InternalProductionPhysicalServiceRestartAuthorityEpochV1,
  InternalProductionBaselineRestartAuthorityRetirementV1,
  InternalProductionServiceRestartAuthorityActivationV1,
  InternalProductionServiceRestartStartupHooksReadyV1,
  InternalProductionServiceRestartAuthorityCutoverV1,
  InternalProductionPhysicalServiceRestartAuthorityCutoverOperationV1,
  InternalProductionPhysicalServiceRestartAuthorityCutoverStatusV1,
} from "./baseline-restart-authority-retirement-v1.js";
import type {
  InternalProductionGlobalOwnerAdmissionFenceReleaseV1,
  InternalProductionOwnerProducerManifestSetActivationHeadV1,
  InternalProductionOwnerProducerManifestSetActivationReceiptV1,
  InternalProductionOwnerProducerManifestV1,
  InternalProductionOwnerProducerRowV1,
  InternalProductionOwnerReservationV1,
  InternalProductionRecoveryRestartTargetSetCloseV1,
  InternalProductionServiceRestartTerminalCoreV1,
} from "./baseline-post-handoff-receipt-v1.js";
import {
  acquireInternalProductionRecoveryRestartOwnerAdmissionFenceV1,
  activateInternalProductionOwnerProducerManifestSetV1,
  beginOrAdoptInternalProductionOwnerReservationV1,
  closeInternalProductionRecoveryRestartTargetsUnderFenceV1,
  closeInternalProductionOwnerReservationV1,
  releaseInternalProductionGlobalOwnerAdmissionFenceV1,
  resolveCurrentInternalProductionOwnerProducerManifestSetActivationV1,
  resolveInternalProductionGlobalOwnerAdmissionFenceReleaseV1,
  resolveInternalProductionOwnerProducerManifestSetActivationV1,
  resolveInternalProductionRecoveryRestartTargetSetCloseV1,
  resolveInternalProductionServiceRestartTerminalCoreV1,
} from "./baseline-post-handoff-receipt-v1.js";
import {
  prepareInternalProductionPhysicalServiceRestartAuthorityCutoverToRecoveryDV1,
  resumeActiveInternalProductionPhysicalServiceRestartAuthorityCutoverToRecoveryDV1,
  observeInternalProductionPhysicalServiceRestartAuthorityCutoverStatusV1,
  resolveInternalProductionBaselineRestartAuthorityRetirementV1,
  resolveInternalProductionServiceRestartAuthorityActivationV1,
  resolveInternalProductionServiceRestartStartupHooksReadyV1,
  resolveInternalProductionServiceRestartAuthorityCutoverV1,
} from "./baseline-restart-authority-retirement-v1.js";
export type {
  InternalProductionServiceRestartAuthorityActivationV1,
  InternalProductionServiceRestartStartupHooksReadyV1,
  InternalProductionServiceRestartAuthorityCutoverV1,
} from "./baseline-restart-authority-retirement-v1.js";
export type {
  InternalProductionRecoveryRestartTargetSetCloseV1,
  InternalProductionServiceRestartTerminalCoreV1,
} from "./baseline-post-handoff-receipt-v1.js";
export {
  resolveInternalProductionRecoveryRestartTargetSetCloseV1,
  resolveInternalProductionServiceRestartTerminalCoreV1,
} from "./baseline-post-handoff-receipt-v1.js";
export {
  resolveInternalProductionServiceRestartAuthorityActivationV1,
  resolveInternalProductionServiceRestartStartupHooksReadyV1,
  resolveInternalProductionServiceRestartAuthorityCutoverV1,
} from "./baseline-restart-authority-retirement-v1.js";

export const INTERNAL_PRODUCTION_OWNER_PRODUCER_ROWS_D_V1 = [
  { plan: "D", module: "src/internal-production/internal-production-service-restart-startup-v1.ts", function: "reserveInternalProductionOrdinaryServiceStartOwnerV1", implementationId: "d-ordinary-service-start-v1", category: "ordinary-service-start", ownerKeyDerivationId: "service-start-slot-claim-v1", censusKeys: ["ordinaryStartingCount"] },
  { plan: "D", module: "src/internal-production/internal-production-service-restart-authority-v1.ts", function: "reserveInternalProductionServiceRestartDispatchOwnerV1", implementationId: "d-restart-reservation-v1", category: "restart-reservation", ownerKeyDerivationId: "restart-namespace-service-coordination-v1", censusKeys: ["restartReservationCount"] },
  { plan: "D", module: "src/internal-production/internal-production-service-restart-authority-v1.ts", function: "reserveInternalProductionServiceRestartOperationOwnerV1", implementationId: "d-service-restart-operation-v1", category: "service-restart-operation", ownerKeyDerivationId: "restart-operation-id-v1", censusKeys: ["serviceRestartOperationCount"] },
  { plan: "D", module: "src/internal-production/internal-production-service-restart-authority-v1.ts", function: "publishInternalProductionServiceRestartLaunchOutboxUnderFenceV1", implementationId: "d-service-restart-launch-outbox-v1", category: "launch-outbox", ownerKeyDerivationId: "recovery-restart-target-family-launch-outbox-v1", censusKeys: ["launchOutboxCount"] },
  { plan: "D", module: "src/internal-production/internal-production-service-restart-authority-v1.ts", function: "publishInternalProductionServiceRestartHelperProcessUnderFenceV1", implementationId: "d-service-restart-helper-process-v1", category: "process", ownerKeyDerivationId: "recovery-restart-target-family-helper-process-v1", censusKeys: ["ownedProcessCount"] },
  { plan: "D", module: "src/internal-production/internal-production-service-restart-authority-v1.ts", function: "publishInternalProductionServiceRestartDispatchChildProcessUnderFenceV1", implementationId: "d-service-restart-child-process-v1", category: "process", ownerKeyDerivationId: "recovery-restart-target-family-dispatch-child-process-v1", censusKeys: ["ownedProcessCount"] },
  { plan: "D", module: "src/internal-production/internal-production-service-restart-authority-v1.ts", function: "publishInternalProductionServiceRestartStartupListenerUnderFenceV1", implementationId: "d-service-restart-startup-listener-v1", category: "listener", ownerKeyDerivationId: "recovery-restart-target-family-startup-listener-v1", censusKeys: ["ownedListenerCount"] },
  { plan: "D", module: "src/internal-production/internal-production-service-restart-authority-v1.ts", function: "publishInternalProductionServiceRestartReplacementProcessUnderFenceV1", implementationId: "d-service-restart-replacement-process-v1", category: "process", ownerKeyDerivationId: "recovery-restart-target-family-replacement-process-v1", censusKeys: ["ownedProcessCount"] },
  { plan: "D", module: "src/internal-production/recovery-scenario-runner.ts", function: "reserveRecoveryScenarioOwnerV1", implementationId: "d-recovery-v1", category: "recovery", ownerKeyDerivationId: "recovery-campaign-scenario-attempt-v1", censusKeys: ["recoveryOwnerCount"] },
  { plan: "D", module: "src/internal-production/recovery-process-fixture-receipt.ts", function: "reserveRecoveryProcessOwnerV1", implementationId: "d-process-v1", category: "process", ownerKeyDerivationId: "recovery-process-fixture-generation-v1", censusKeys: ["ownedProcessCount"] },
  { plan: "D", module: "src/internal-production/recovery-action-port.ts", function: "reserveRecoveryListenerOwnerV1", implementationId: "d-listener-v1", category: "listener", ownerKeyDerivationId: "recovery-service-listener-generation-v1", censusKeys: ["ownedListenerCount"] },
  { plan: "D", module: "src/internal-production/recovery-scenario-runner.ts", function: "reserveRecoveryWorktreeOwnerV1", implementationId: "d-worktree-v1", category: "worktree", ownerKeyDerivationId: "recovery-campaign-worktree-claim-v1", censusKeys: ["ownedWorktreeCount"] },
  { plan: "D", module: "src/internal-production/recovery-scenario-runner.ts", function: "reserveRecoveryDirtyWorktreeOwnerV1", implementationId: "d-dirty-worktree-v1", category: "dirty-worktree", ownerKeyDerivationId: "recovery-worktree-dirt-generation-v1", censusKeys: ["dirtyWorktreeCount"] },
  { plan: "D", module: "src/internal-production/recovery-process-fixture-receipt.ts", function: "reserveRecoveryStaleChildOwnerV1", implementationId: "d-stale-child-v1", category: "stale-child", ownerKeyDerivationId: "recovery-child-absence-generation-v1", censusKeys: ["staleChildCount"] },
  { plan: "D", module: "src/internal-production/recovery-packet.ts", function: "reserveRecoveryPacketPublicationOwnerV1", implementationId: "d-recovery-packet-publication-v1", category: "artifact-publication", ownerKeyDerivationId: "recovery-finalization-publication-v1", censusKeys: ["publicationBatchCount", "artifactPublicationCount"] },
  { plan: "D", module: "src/internal-production/recovery-docs-delivery-acceptance.ts", function: "reserveRecoveryDocsDeliveryOwnerV1", implementationId: "d-recovery-docs-delivery-v1", category: "operational-delivery", ownerKeyDerivationId: "recovery-docs-delivery-operation-v1", censusKeys: ["operationalDeliveryCount"] },
] as const satisfies readonly InternalProductionOwnerProducerRowV1[];

export const INTERNAL_PRODUCTION_OWNER_PRODUCER_MANIFEST_D_V1 = {
  schema: "setfarm.internal-production-owner-producer-manifest.v1",
  plan: "D",
  rows: INTERNAL_PRODUCTION_OWNER_PRODUCER_ROWS_D_V1,
  manifestHash: hashCanonicalJson({
    schema: "setfarm.internal-production-owner-producer-manifest.v1",
    plan: "D",
    rows: INTERNAL_PRODUCTION_OWNER_PRODUCER_ROWS_D_V1,
  }),
} as const satisfies InternalProductionOwnerProducerManifestV1;

export interface InternalProductionRecoveryOwnerProducerManifestActivationReceiptV1 {
  schema: "setfarm.internal-production-recovery-owner-producer-manifest-activation.v1";
  phase: "A+B+C+D";
  postRebindEntryAuthorityRef: CanonicalRef;
  postRebindEntryAuthorityHash: string;
  reviewedSetfarmSourceRef: CanonicalRef;
  reviewedSetfarmSourceHash: string;
  cleanSetfarmBuildRef: CanonicalRef;
  cleanSetfarmBuildHash: string;
  predecessorActivationRef: CanonicalRef;
  predecessorActivationHash: string;
  predecessorHeadRef: CanonicalRef;
  predecessorHeadHash: string;
  predecessorPhase: "A+B+C";
  predecessorProducerCount: 27;
  orderedPlans: readonly ["A", "B", "C", "D"];
  orderedManifestHashes: readonly [string, string, string, string];
  planProducerCounts: readonly [11, 10, 6, 16];
  producerCount: 43;
  activationRef: CanonicalRef;
  activationHash: string;
  activationHeadRef: CanonicalRef;
  activationHeadHash: string;
  receiptRef: CanonicalRef;
  receiptHash: string;
}

export type InternalProductionRecoveryOwnerProducerManifestActivationStatusV1 =
  | Readonly<{
      status: "absent";
      postRebindEntryAuthorityRef: null;
      postRebindEntryAuthorityHash: null;
      receiptRef: null;
      receiptHash: null;
      activationRef: null;
      activationHash: null;
      activationHeadRef: null;
      activationHeadHash: null;
    }>
  | Readonly<{
      status: "activated";
      postRebindEntryAuthorityRef: CanonicalRef;
      postRebindEntryAuthorityHash: string;
      receiptRef: CanonicalRef;
      receiptHash: string;
      activationRef: CanonicalRef;
      activationHash: string;
      activationHeadRef: CanonicalRef;
      activationHeadHash: string;
    }>;

export function activateInternalProductionRecoveryOwnerProducerManifestSetV1():
  Promise<InternalProductionRecoveryOwnerProducerManifestActivationReceiptV1>;
export function resolveInternalProductionRecoveryOwnerProducerManifestActivationV1(
  input: Readonly<{ receiptRef: CanonicalRef; receiptHash: string }>,
): Promise<InternalProductionRecoveryOwnerProducerManifestActivationReceiptV1>;
export function observeInternalProductionRecoveryOwnerProducerManifestActivationStatusV1():
  Promise<InternalProductionRecoveryOwnerProducerManifestActivationStatusV1>;

// The D activation controller imports the exact A, B, and C manifest constants
// from their owning modules only after D's reviewed clean merge and build. It
// freshly resolves current A+B+C as the exact `{head,receipt}` pair with
// 11+10+6=27 rows, calls A's activation function once with both expected
// predecessor identities and manifests [A,B,C,D], then freshly resolves
// A+B+C+D as `{head,receipt}` with 11+10+6+16=43 rows and byte-exact equality.
// D content-addresses only its strict path-free activation receipt/status; it
// owns no A activation store, pointer, phase calculator, or replacement.

export function prepareInternalProductionServiceRestartAuthorityCutoverV1(
  input: Readonly<{
    zeroOwnerGuardRef: CanonicalRef;
    zeroOwnerGuardHash: string;
  }>,
): ReturnType<
  typeof prepareInternalProductionPhysicalServiceRestartAuthorityCutoverToRecoveryDV1
>;

export function resumeActiveInternalProductionServiceRestartAuthorityCutoverV1():
  ReturnType<typeof resumeActiveInternalProductionPhysicalServiceRestartAuthorityCutoverToRecoveryDV1>;

export function observeInternalProductionServiceRestartAuthorityCutoverStatusV1():
  ReturnType<typeof observeInternalProductionPhysicalServiceRestartAuthorityCutoverStatusV1>;

// This reviewed D adapter is the sole allowed mutation importer from A. Prepare
// passes the exact zero-owner pair once and returns only the durable operation
// pair. A zero-input resume in any fresh process reopens that active operation,
// code-observes/records readiness, consumes the bound guard, performs the sole
// epoch CAS, and returns the complete terminal pair set. Status is read-only.
// D publishes none of those bytes and never retains the raw guard for recovery.
// Before enabling or invoking any generic D prepare, it extracts the terminal
// status's release pair, calls the exact unaliased A resolver above, and requires
// release.fenceRef/hash and release.terminalAuthorityRef/hash to equal the
// status/cutover chain. Missing/corrupt/cross-paired release yields zero D
// reservation, operation, outbox, helper, or dispatch writes.

export interface InternalProductionServiceRestartAuthorityV1 {
  prepare(input: Readonly<{
    namespace: InternalProductionServiceRestartNamespaceV1;
    scopeHash: string;
    finalReleaseEpoch: GoldenFinalReleaseEpochV1;
    attemptHash: string;
    coordinationRef: CanonicalRef;
    coordinationHash: string;
    coordinationIdHash: string;
    target: InternalProductionRestartServiceV1;
    authorizationRef: CanonicalRef;
    authorizationHash: string;
    authorizationOperationRef: CanonicalRef;
    authorizationOperationHash: string;
    beforeGenerationHash: string;
    entrypointBuildIdentityHash: string;
    terminalPredecessor: InternalProductionServiceRestartTerminalPredecessorV1 | null;
  }>): Promise<InternalProductionServiceRestartOperationV1>;
  executeOrRecover(input: Readonly<{
    operationRef: CanonicalRef;
    operationHash: string;
    authorizationRef: CanonicalRef;
    authorizationHash: string;
  }>): Promise<InternalProductionServiceRestartExecutionResultV1>;
  resolveOperation(input: Readonly<{
    operationRef: CanonicalRef;
    operationHash: string;
  }>): Promise<InternalProductionServiceRestartOperationV1>;
  resolveCompletion(input: Readonly<{
    completionRef: CanonicalRef;
    completionHash: string;
  }>): Promise<InternalProductionServiceRestartCompletionReceiptV1>;
  resolveFailure(input: Readonly<{
    failureRef: CanonicalRef;
    failureHash: string;
  }>): Promise<InternalProductionServiceRestartFailureReceiptV1>;
  resolveOccurrence(input: Readonly<{
    occurrenceRef: CanonicalRef;
    occurrenceHash: string;
  }>): Promise<InternalProductionServiceRestartOccurrenceV1>;
  resolveHead(input: Readonly<{
    namespace: InternalProductionServiceRestartNamespaceV1;
    target: InternalProductionRestartServiceV1;
  }>): Promise<InternalProductionServiceRestartHeadV1 | null>;
  resolveDispatchReservation(input: Readonly<{
    reservationRef: CanonicalRef;
    reservationHash: string;
  }>): Promise<InternalProductionServiceRestartDispatchReservationV1>;
  resolveTargetAuthorization(input: Readonly<{
    authorizationRef: CanonicalRef;
    authorizationHash: string;
  }>): Promise<RecoveryRestartTargetAuthorizationV1>;
  resolveTargetAuthorizationOperation(input: Readonly<{
    authorizationOperationRef: CanonicalRef;
    authorizationOperationHash: string;
  }>): Promise<RecoveryRestartTargetAuthorizationOperationV1>;
  resolveTargetAuthorizationConsumption(input: Readonly<{
    consumptionRef: CanonicalRef;
    consumptionHash: string;
  }>): Promise<RecoveryRestartTargetAuthorizationConsumptionV1>;
  resolveTerminalCore(input: Readonly<{
    terminalCoreRef: CanonicalRef;
    terminalCoreHash: string;
  }>): Promise<InternalProductionServiceRestartTerminalCoreV1>;
  resolveTargetSetClose(input: Readonly<{
    targetSetCloseRef: CanonicalRef;
    targetSetCloseHash: string;
  }>): Promise<InternalProductionRecoveryRestartTargetSetCloseV1>;
  resolveServiceStartSlotHead(input: Readonly<{
    service: InternalProductionRestartServiceV1;
  }>): Promise<InternalProductionServiceStartSlotHeadV1 | null>;
}

export function deriveInternalProductionServiceRestartOperationIdV1(input: Readonly<{
  namespace: InternalProductionServiceRestartNamespaceV1;
  scopeHash: string;
  finalReleaseEpoch: GoldenFinalReleaseEpochV1;
  attemptHash: string;
  coordinationRef: CanonicalRef;
  coordinationHash: string;
  coordinationIdHash: string;
  target: InternalProductionRestartServiceV1;
  authorizationRef: CanonicalRef;
  authorizationHash: string;
  authorizationOperationRef: CanonicalRef;
  authorizationOperationHash: string;
  beforeGenerationHash: string;
  entrypointBuildIdentityHash: string;
  terminalPredecessor: InternalProductionServiceRestartTerminalPredecessorV1 | null;
}>): string;

export function createInternalProductionServiceRestartAuthorityV1():
  InternalProductionServiceRestartAuthorityV1;

export type RecoveryRestartTargetAuthorizationStatusV1 =
  | Readonly<{ status: "absent" }>
  | Readonly<{
      status: "pending-input";
      preparedActivePendingRef: CanonicalRef;
      preparedActivePendingHash: string;
      currentActivePendingRef:
        typeof RECOVERY_RESTART_TARGET_AUTHORIZATION_ACTIVE_PENDING_REF_V1;
      currentActivePendingHash: string;
      authorizationOperationRef: null;
      authorizationOperationHash: null;
    }>
  | Readonly<{
      status: "operation-published";
      preparedActivePendingRef: CanonicalRef;
      preparedActivePendingHash: string;
      currentActivePendingRef:
        typeof RECOVERY_RESTART_TARGET_AUTHORIZATION_ACTIVE_PENDING_REF_V1;
      currentActivePendingHash: string;
      authorizationOperationRef: CanonicalRef;
      authorizationOperationHash: string;
    }>
  | Readonly<{
      status: "authorized";
      preparedActivePendingRef: CanonicalRef;
      preparedActivePendingHash: string;
      currentActivePendingRef:
        typeof RECOVERY_RESTART_TARGET_AUTHORIZATION_ACTIVE_PENDING_REF_V1;
      currentActivePendingHash: string;
      authorizationOperationRef: CanonicalRef;
      authorizationOperationHash: string;
      authorizationRef: CanonicalRef;
      authorizationHash: string;
    }>
  | Readonly<{
      status: "terminal-finalized";
      preparedActivePendingRef: CanonicalRef;
      preparedActivePendingHash: string;
      currentActivePendingRef:
        typeof RECOVERY_RESTART_TARGET_AUTHORIZATION_ACTIVE_PENDING_REF_V1;
      currentActivePendingHash: string;
      authorizationOperationRef: CanonicalRef;
      authorizationOperationHash: string;
      authorizationRef: CanonicalRef;
      authorizationHash: string;
      finalEnvelopeRef: CanonicalRef;
      finalEnvelopeHash: string;
      ownerAdmissionFenceReleaseRef: CanonicalRef;
      ownerAdmissionFenceReleaseHash: string;
    }>;

export function prepareRecoveryRestartTargetAuthorizationV1(input: Readonly<{
  pendingInputRef: CanonicalRef;
  pendingInputHash: string;
  namespace: InternalProductionServiceRestartNamespaceV1;
  target: InternalProductionRestartServiceV1;
  coordinationHash: string;
  coordinatorTargetAuthority: InternalProductionServiceRestartCoordinatorTargetAuthorityV1;
}>): Promise<Readonly<{
  preparedActivePendingRef: CanonicalRef;
  preparedActivePendingHash: string;
  currentActivePendingRef:
    typeof RECOVERY_RESTART_TARGET_AUTHORIZATION_ACTIVE_PENDING_REF_V1;
  currentActivePendingHash: string;
}>>;
export function resumeActiveRecoveryRestartTargetAuthorizationV1():
  Promise<Readonly<{
    authorizationOperationRef: CanonicalRef;
    authorizationOperationHash: string;
    authorizationRef: CanonicalRef;
    authorizationHash: string;
  }>>;
export function observeRecoveryRestartTargetAuthorizationStatusV1():
  Promise<RecoveryRestartTargetAuthorizationStatusV1>;
export function resolveRecoveryRestartTargetAuthorizationActivePendingV1(input: Readonly<{
  currentActivePendingRef:
    typeof RECOVERY_RESTART_TARGET_AUTHORIZATION_ACTIVE_PENDING_REF_V1;
  currentActivePendingHash: string;
}>): Promise<RecoveryRestartTargetAuthorizationActivePendingV1>;
export function resolveRecoveryRestartTargetAuthorizationPreparedSnapshotV1(input: Readonly<{
  preparedActivePendingRef: CanonicalRef;
  preparedActivePendingHash: string;
}>): Promise<RecoveryRestartTargetAuthorizationPreparedSnapshotV1>;
export function resolveRecoveryRestartTargetAuthorizationOperationV1(input: Readonly<{
  authorizationOperationRef: CanonicalRef;
  authorizationOperationHash: string;
}>): Promise<RecoveryRestartTargetAuthorizationOperationV1>;
export function resolveRecoveryRestartTargetAuthorizationV1(input: Readonly<{
  authorizationRef: CanonicalRef;
  authorizationHash: string;
}>): Promise<RecoveryRestartTargetAuthorizationV1>;

export type InternalProductionServiceRestartStartupRefusalCodeV1 =
  | "RESTART_RESERVATION_AMBIGUOUS"
  | "RESTART_OPERATION_CLAIM_MISSING"
  | "RESTART_OPERATION_IDENTITY_MISMATCH"
  | "ORDINARY_START_CLAIM_CONFLICT"
  | "SERVICE_START_SLOT_AMBIGUOUS"
  | "ORDINARY_START_PARENT_NOT_LAUNCHD"
  | "ORDINARY_START_CONFIGURATION_MISMATCH";

export type InternalProductionServiceRestartStartupAdmissionV1 =
  | Readonly<{
      schema: "setfarm.internal-production-service-restart-startup-admission.v1";
      kind: "restart-operation";
      service: InternalProductionRestartServiceV1;
      configuredLabel: InternalProductionRestartConfiguredLabelV1;
      sourceSha: string;
      entrypointBuildIdentityHash: string;
      serviceStartSlotHeadRef: CanonicalRef;
      serviceStartSlotHeadHash: string;
      dispatchReservationRef: CanonicalRef;
      dispatchReservationHash: string;
      operationRef: CanonicalRef;
      operationHash: string;
      operationClaimRef: CanonicalRef;
      operationClaimHash: string;
      restartMarkerRef: CanonicalRef;
      restartMarkerHash: string;
      restartMarkerPublished: true;
      admissionHash: string;
    }>
  | Readonly<{
      schema: "setfarm.internal-production-service-restart-startup-admission.v1";
      kind: "ordinary-launchd-start";
      service: InternalProductionRestartServiceV1;
      configuredLabel: InternalProductionRestartConfiguredLabelV1;
      sourceSha: string;
      entrypointBuildIdentityHash: string;
      launchdParentAuthorityHash: string;
      serviceStartSlotHeadRef: CanonicalRef;
      serviceStartSlotHeadHash: string;
      ordinaryStartingClaimRef: CanonicalRef;
      ordinaryStartingClaimHash: string;
      dispatchReservationRef: null;
      dispatchReservationHash: null;
      operationRef: null;
      operationHash: null;
      operationClaimRef: null;
      operationClaimHash: null;
      restartMarkerRef: null;
      restartMarkerHash: null;
      restartMarkerPublished: false;
      admissionHash: string;
    }>;

export type InternalProductionServiceOrdinaryStartRecoveryResultV1 =
  | Readonly<{
      status: "in_progress";
      claim: InternalProductionServiceOrdinaryStartingClaimV1;
      activeHead: InternalProductionServiceStartSlotHeadV1;
      observationHash: string;
      remainingObservations: 1 | 2;
    }>
  | Readonly<{
      status: "settled";
      settlement: InternalProductionServiceOrdinaryStartSettlementV1;
      settledHead: InternalProductionServiceStartSlotHeadV1;
    }>;

export interface InternalProductionServiceRestartStartupAuthorityV1 {
  claimOrAdmitOrdinary(input: Readonly<{
    service: InternalProductionRestartServiceV1;
  }>): Promise<InternalProductionServiceRestartStartupAdmissionV1>;
  completeOrdinaryStart(input: Readonly<{
    admission: Extract<
      InternalProductionServiceRestartStartupAdmissionV1,
      { kind: "ordinary-launchd-start" }
    >;
  }>): Promise<InternalProductionServiceOrdinaryStartSettlementV1>;
  recoverOrdinaryStart(input: Readonly<{
    ordinaryStartingClaimRef: CanonicalRef;
    ordinaryStartingClaimHash: string;
  }>): Promise<InternalProductionServiceOrdinaryStartRecoveryResultV1>;
  resolveOrdinaryStartingClaim(input: Readonly<{
    ordinaryStartingClaimRef: CanonicalRef;
    ordinaryStartingClaimHash: string;
  }>): Promise<InternalProductionServiceOrdinaryStartingClaimV1>;
  resolveOrdinaryOwnerPublication(input: Readonly<{
    publicationRef: CanonicalRef;
    publicationHash: string;
  }>): Promise<InternalProductionServiceOrdinaryOwnerPublicationV1>;
  resolveOrdinaryStartSettlement(input: Readonly<{
    settlementRef: CanonicalRef;
    settlementHash: string;
  }>): Promise<InternalProductionServiceOrdinaryStartSettlementV1>;
  resolveServiceStartSlotHead(input: Readonly<{
    service: InternalProductionRestartServiceV1;
  }>): Promise<InternalProductionServiceStartSlotHeadV1 | null>;
}

export function createInternalProductionServiceRestartStartupAuthorityV1():
  InternalProductionServiceRestartStartupAuthorityV1;

// D's reviewed claim modifies B's existing
// `./setfarm-completion-owner-receipt-activation-controller-v1.js` and imports
// every D symbol below without an alias. The final exported B union is exact.
export type SetfarmCompletionOwnerReceiptProducerStartupAdmissionV1 =
  | Readonly<{
      schema: "setfarm.completion-owner-receipt-producer-startup-admission.v1";
      branch: "bootstrap-a-restart" | "a-managed-restart";
      activationReceiptRef: CanonicalRef;
      activationReceiptHash: string;
      generationHash: string;
      registrationHash: string;
      setfarmSha: string;
      spawnerBuildHash: string;
      producerModuleHash: string;
      predecessorAdmissionHash: string | null;
      aRestartAuthorityRef: CanonicalRef;
      aRestartAuthorityHash: string;
      admissionRef: CanonicalRef;
      admissionHash: string;
    }>
  | Readonly<{
      schema: "setfarm.completion-owner-receipt-producer-startup-admission.v1";
      branch: "d-ordinary-start";
      activationReceiptRef: CanonicalRef;
      activationReceiptHash: string;
      generationHash: string;
      registrationHash: string;
      setfarmSha: string;
      spawnerBuildHash: string;
      producerModuleHash: string;
      predecessorAdmissionHash: string | null;
      aRestartAuthorityRef: null;
      aRestartAuthorityHash: null;
      dOrdinaryStartSettlementRef: CanonicalRef;
      dOrdinaryStartSettlementHash: string;
      dOrdinaryOwnerPublicationRef: CanonicalRef;
      dOrdinaryOwnerPublicationHash: string;
      admissionRef: CanonicalRef;
      admissionHash: string;
    }>
  | Readonly<{
      schema: "setfarm.completion-owner-receipt-producer-startup-admission.v1";
      branch: "d-managed-restart";
      activationReceiptRef: CanonicalRef;
      activationReceiptHash: string;
      generationHash: string;
      registrationHash: string;
      setfarmSha: string;
      spawnerBuildHash: string;
      producerModuleHash: string;
      predecessorAdmissionHash: string | null;
      aRestartAuthorityRef: null;
      aRestartAuthorityHash: null;
      dRestartNamespace: InternalProductionServiceRestartNamespaceV1;
      dRestartOperationRef: CanonicalRef;
      dRestartOperationHash: string;
      dRestartStartupAdmissionHash: string;
      dRestartTerminalReservationRef: CanonicalRef;
      dRestartTerminalReservationHash: string;
      dRestartCompletionRef: CanonicalRef;
      dRestartCompletionHash: string;
      dRestartOccurrenceRef: CanonicalRef;
      dRestartOccurrenceHash: string;
      dRestartNamespaceHeadRef: CanonicalRef;
      dRestartNamespaceHeadHash: string;
      dRestartServiceStartSlotHeadRef: CanonicalRef;
      dRestartServiceStartSlotHeadHash: string;
      dRestartTerminalPredecessor: InternalProductionServiceRestartTerminalPredecessorV1 | null;
      dRestartTerminalPredecessorHash: string | null;
      beforeGenerationHash: string;
      afterGenerationHash: string;
      admissionRef: CanonicalRef;
      admissionHash: string;
    }>;

export function createOrResumeSetfarmCompletionOwnerReceiptProducerDOrdinaryStartAdmissionV1(
  input: Readonly<{
    settlement: Extract<
      InternalProductionServiceOrdinaryStartSettlementV1,
      { disposition: "owner-listener-published" }
    >;
    ownerPublication: InternalProductionServiceOrdinaryOwnerPublicationV1;
  }>,
): Promise<Readonly<{ admissionRef: CanonicalRef; admissionHash: string }>>;

export function createOrResumeSetfarmCompletionOwnerReceiptProducerDManagedRestartAdmissionV1(
  input: Readonly<{
    operation: InternalProductionServiceRestartOperationV1;
    startupAdmission: Extract<
      InternalProductionServiceRestartStartupAdmissionV1,
      { kind: "restart-operation" }
    >;
    terminalReservation: Readonly<
      InternalProductionServiceRestartDispatchReservationV1 & {
        state: "settled";
        terminalSettlementRef: CanonicalRef;
        terminalSettlementHash: string;
      }
    >;
    completion: InternalProductionServiceRestartCompletionReceiptV1;
    occurrence: Readonly<
      InternalProductionServiceRestartOccurrenceV1 & {
        terminal: Readonly<{
          kind: "complete";
          terminalRef: CanonicalRef;
          terminalHash: string;
        }>;
      }
    >;
    namespaceHead: InternalProductionServiceRestartHeadV1;
    serviceStartSlotHead: Readonly<
      Omit<InternalProductionServiceStartSlotHeadV1, "state"> & {
        state: Readonly<{
          kind: "settled";
          dispatchReservationRef: null;
          dispatchReservationHash: null;
          ordinaryStartingClaimRef: null;
          ordinaryStartingClaimHash: null;
          terminalSettlementKind: "restart";
          terminalSettlementRef: CanonicalRef;
          terminalSettlementHash: string;
        }>;
      }
    >;
  }>,
): Promise<Readonly<{ admissionRef: CanonicalRef; admissionHash: string }>>;

export function resolveSetfarmCompletionOwnerReceiptProducerStartupAdmissionV1(
  input: Readonly<{ admissionRef: CanonicalRef; admissionHash: string }>,
): Promise<SetfarmCompletionOwnerReceiptProducerStartupAdmissionV1>;

export type RecoveryMissionControlRestartAuthorityV1 = Readonly<{
  schema: "setfarm.internal-production-recovery-action-receipt.v1";
  actionId: "restart-mission-control";
  campaignHash: string;
  finalReleaseEpoch: GoldenFinalReleaseEpochV1;
  caseId: string;
  scenarioId: "mission_control_active_run_restart";
  runId: string;
  runNumber: number;
  generation: Extract<GoldenLifecycleGenerationV1, { kind: "story-claim-generation" }>;
  predicateHash: string;
  serviceLabel: "com.setrox.mission-control";
  serviceRestartOperationRef: CanonicalRef;
  serviceRestartOperationHash: string;
  serviceRestartReceiptRef: CanonicalRef;
  serviceRestartReceiptHash: string;
}>;

export type RecoveryDashboardRestartAuthorityV1 = Readonly<{
  schema: "setfarm.internal-production-recovery-action-receipt.v1";
  actionId: "restart-setfarm-dashboard";
  campaignHash: string;
  finalReleaseEpoch: GoldenFinalReleaseEpochV1;
  caseId: string;
  scenarioId: "dashboard_active_run_restart";
  runId: string;
  runNumber: number;
  generation: Extract<GoldenLifecycleGenerationV1, { kind: "story-claim-generation" }>;
  predicateHash: string;
  serviceLabel: "com.setrox.setfarm-dashboard";
  serviceRestartOperationRef: CanonicalRef;
  serviceRestartOperationHash: string;
  serviceRestartReceiptRef: CanonicalRef;
  serviceRestartReceiptHash: string;
}>;

export type RecoveryAcceptedProductRestartAuthorityV1 = Readonly<{
  schema: "setfarm.internal-production-recovery-action-receipt.v1";
  actionId: "restart-accepted-product";
  recoveryCampaignHash: string;
  finalReleaseEpoch: GoldenFinalReleaseEpochV1;
  sourceLinkageHash: string;
  sourceRuntimeReceiptHash: string;
  actionOperationHash: string;
  caseId: string;
  scenarioId: "api_durable_state_restart";
  runId: string;
  runNumber: number;
  projectId: string;
}>;

type RecoveryActionNonSuccessEvidenceV1 = Readonly<{
  observedAuthorityHash: string;
  finalCleanupCensus: RecoveryOwnershipCensusV1;
  finalCleanupHash: string;
  evidenceRefs: readonly CanonicalRef[];
  actionReceiptHash: string;
}>;

export type RecoveryMissionControlRestartReceiptV1 =
  | Readonly<RecoveryMissionControlRestartAuthorityV1 & {
      outcome: "success";
      beforeProcessIdentityHash: string;
      afterProcessIdentityHash: string;
      beforeHttpObservationHash: string;
      afterHttpObservationHash: string;
      browserContinuity: RecoveryBrowserContinuityReceiptV1;
      finalCleanupHash: string;
      evidenceRefs: readonly CanonicalRef[];
      actionReceiptHash: string;
    }>
  | Readonly<RecoveryMissionControlRestartAuthorityV1 & RecoveryActionNonSuccessEvidenceV1 & {
      outcome: "refusal";
      code: "mission_control_restart_unavailable";
      failedBoundary: "mission-control-restart-admission";
    }>
  | Readonly<RecoveryMissionControlRestartAuthorityV1 & RecoveryActionNonSuccessEvidenceV1 & (
      | Readonly<{ outcome: "failure"; code: "action_authority_rejected"; failedBoundary: "mission-control-action-authority" }>
      | Readonly<{ outcome: "failure"; code: "mutation_failed"; failedBoundary: "mission-control-restart-mutation" }>
      | Readonly<{ outcome: "failure"; code: "reconnect_failed"; failedBoundary: "mission-control-same-run-reconnect" }>
      | Readonly<{ outcome: "failure"; code: "cleanup_incomplete"; failedBoundary: "mission-control-final-cleanup" }>
    )>;

export type RecoveryDashboardRestartReceiptV1 =
  | Readonly<RecoveryDashboardRestartAuthorityV1 & {
      outcome: "success";
      beforeProcessIdentityHash: string;
      afterProcessIdentityHash: string;
      beforeHttpObservationHash: string;
      afterHttpObservationHash: string;
      browserContinuity: RecoveryBrowserContinuityReceiptV1;
      finalCleanupHash: string;
      evidenceRefs: readonly CanonicalRef[];
      actionReceiptHash: string;
    }>
  | Readonly<RecoveryDashboardRestartAuthorityV1 & RecoveryActionNonSuccessEvidenceV1 & {
      outcome: "refusal";
      code: "dashboard_restart_unavailable";
      failedBoundary: "dashboard-restart-admission";
    }>
  | Readonly<RecoveryDashboardRestartAuthorityV1 & RecoveryActionNonSuccessEvidenceV1 & (
      | Readonly<{ outcome: "failure"; code: "action_authority_rejected"; failedBoundary: "dashboard-action-authority" }>
      | Readonly<{ outcome: "failure"; code: "mutation_failed"; failedBoundary: "dashboard-restart-mutation" }>
      | Readonly<{ outcome: "failure"; code: "reconnect_failed"; failedBoundary: "dashboard-same-run-reconnect" }>
      | Readonly<{ outcome: "failure"; code: "cleanup_incomplete"; failedBoundary: "dashboard-final-cleanup" }>
    )>;

export type RecoveryAcceptedProductRestartReceiptV1 =
  | Readonly<RecoveryAcceptedProductRestartAuthorityV1 & {
      outcome: "success";
      sourceAuthorityHash: string;
      sourceCleanlinessHash: string;
      beforeRuntimeIdentityHash: string;
      afterRuntimeIdentityHash: string;
      writeHttpObservationHash: string;
      beforeReadHttpObservationHash: string;
      afterReadHttpObservationHash: string;
      durableRecordHash: string;
      sessionACleanupHash: string;
      finalCleanupHash: string;
      evidenceRefs: readonly CanonicalRef[];
      actionReceiptHash: string;
    }>
  | Readonly<RecoveryAcceptedProductRestartAuthorityV1 & RecoveryActionNonSuccessEvidenceV1 & {
      outcome: "refusal";
      code: "accepted_product_restart_unavailable";
      failedBoundary: "accepted-product-runtime-admission";
    }>
  | Readonly<RecoveryAcceptedProductRestartAuthorityV1 & RecoveryActionNonSuccessEvidenceV1 & (
      | Readonly<{ outcome: "failure"; code: "action_authority_rejected"; failedBoundary: "accepted-product-source-authority" }>
      | Readonly<{ outcome: "failure"; code: "mutation_failed"; failedBoundary: "accepted-product-session-a-mutation" }>
      | Readonly<{ outcome: "failure"; code: "durable_state_verification_failed"; failedBoundary: "accepted-product-session-b-durable-read" }>
      | Readonly<{ outcome: "failure"; code: "cleanup_incomplete"; failedBoundary: "accepted-product-final-cleanup" }>
    )>;

export type RecoveryActionReceiptV1 =
  | RecoveryMissionControlRestartReceiptV1
  | RecoveryDashboardRestartReceiptV1
  | RecoveryAcceptedProductRestartReceiptV1;

export interface RecoveryActionReceiptResolver {
  getByRef(actionReceiptRef: CanonicalRef): Promise<RecoveryActionReceiptV1>;
}

export interface RecoveryActionReceiptStore extends RecoveryActionReceiptResolver {
  put(receipt: RecoveryActionReceiptV1): Promise<Readonly<{
    hash: string;
    ref: string;
    created: boolean;
  }>>;
}

export interface RecoveryAcceptedProductRuntimeAuthorityV1 {
  schema: "setfarm.internal-production-accepted-product-runtime-authority.v1";
  sourceGoldenCampaignHash: string;
  caseId: string;
  resultHash: string;
  runId: string;
  runNumber: number;
  projectId: string;
  repositoryRef: string;
  acceptedSourceSha: string;
  acceptedSourceTreeHash: string;
  acceptedSourceRef: string;
  sealedPacketHash: string;
  sealedPacketRef: string;
  runtimeEvidenceContractHash: string;
  deploymentReceiptHash: string;
  deploymentReceiptRef: string;
  projectTransferAcknowledgementHash: string;
  projectTransferAcknowledgementRef: string;
  authorityHash: string;
}

export type RecoveryAcceptedProductFailureBoundaryV1 =
  | "runtime-start"
  | "durable-state-write"
  | "runtime-stop"
  | "runtime-restart"
  | "durable-state-read"
  | "runtime-cleanup";

export type RecoveryAcceptedProductFailureCodeV1 =
  | "accepted_product_restart_unavailable"
  | "action_authority_rejected"
  | "mutation_failed"
  | "durable_state_verification_failed"
  | "cleanup_incomplete";

export const RECOVERY_ACCEPTED_PRODUCT_DURABLE_READ_FAILURE_V1 = {
  actionReceiptBoundary: "accepted-product-session-b-durable-read",
  sourceRuntimeBoundary: "durable-state-read",
  failureCode: "durable_state_verification_failed",
} as const satisfies Readonly<{
  actionReceiptBoundary: "accepted-product-session-b-durable-read";
  sourceRuntimeBoundary: "durable-state-read";
  failureCode: "durable_state_verification_failed";
}>;

export function deriveRecoveryAcceptedProductSystemicRootV1(input: Readonly<{
  scenarioId: "api_durable_state_restart";
  boundary: RecoveryAcceptedProductFailureBoundaryV1;
  failureCode: RecoveryAcceptedProductFailureCodeV1;
}>): Readonly<{
  componentKind: RecoveryAcceptedProductSystemicComponentKindV1;
  systemicRootHash: string;
}>;

export interface RecoveryAcceptedProductSourceRuntimeReceiptV1 {
  schema: "setfarm.internal-production-accepted-product-source-runtime-receipt.v1";
  sourceGoldenCampaignHash: string;
  sourceResultHash: string;
  sourceRunId: string;
  outcome:
    | Readonly<{ kind: "success"; observedAuthorityHash: string; finalCleanupHash: string }>
    | Readonly<{
        kind: "refusal";
        code: "accepted_product_restart_unavailable";
        failedBoundary: RecoveryAcceptedProductFailureBoundaryV1;
        observedAuthorityHash: string;
        finalCleanupHash: string;
      }>
    | Readonly<{
        kind: "failure";
        code: "action_authority_rejected" | "mutation_failed" | "cleanup_incomplete";
        failedBoundary: RecoveryAcceptedProductFailureBoundaryV1;
        observedAuthorityHash: string;
        finalCleanupHash: string;
      }>
    | Readonly<{
        kind: "failure";
        code: "durable_state_verification_failed";
        failedBoundary: "durable-state-read";
        observedAuthorityHash: string;
        finalCleanupHash: string;
      }>;
  sourceAuthorityHash: string;
  runtimeObservationHash: string;
  finalCleanupHash: string;
  sourceRuntimeReceiptHash: string;
}

export interface RecoveryAcceptedProductRuntimeResolverV1 {
  resolve(input: Readonly<{
    loaded: LoadedGoldenCampaignV1;
    caseId: string;
    sourceResultHash: string;
  }>): Promise<RecoveryAcceptedProductRuntimeAuthorityV1>;
}

export interface RecoveryAcceptedProductRuntimePort extends RecoveryAcceptedProductRuntimeResolverV1 {
  restartAndVerify(input: Readonly<{
    authority: RecoveryAcceptedProductRuntimeAuthorityV1;
    recordTitle: "internal-production-durable-state-01";
  }>): Promise<RecoveryAcceptedProductSourceRuntimeReceiptV1>;
}

export function createRecoveryAcceptedProductRuntimePort(input: Readonly<{
  sql: postgres.Sql;
  goldenRunResultStore: GoldenRunResultStore;
  goldenRunRepository: GoldenRunRepository;
}>): RecoveryAcceptedProductRuntimePort;

export interface RecoveryActionPort {
  restartMissionControl(input: RecoveryMissionControlRestartRequestV1): Promise<RecoveryMissionControlRestartReceiptV1>;
  restartDashboard(input: RecoveryDashboardRestartRequestV1): Promise<RecoveryDashboardRestartReceiptV1>;
}

export function createRecoveryGoldenServiceRestartActionPortV1(input: Readonly<{
  recoveryActions: RecoveryActionPort;
}>): GoldenServiceRestartActionPortV1;

export interface RecoveryEvidencePort {
  capture(input:
    | Readonly<{
        mode: "live_operational";
        campaignHash: string;
        scenarioId: RecoveryScenarioId;
        phase: "before" | "after";
        runId: string;
        expectedGeneration: GoldenLifecycleGenerationV1 | null;
      }>
    | Readonly<{
        mode: "actual_postgres_process_integration";
        campaignHash: string;
        scenarioId: RecoveryScenarioId;
        phase: "before" | "after";
        runId: string;
        expectedGeneration: number;
      }>): Promise<RecoveryCheckpointV1>;
  persist(input: Readonly<{
    campaignHash: string;
    scenarioId: RecoveryScenarioId;
    evidence: RecoveryScenarioEvidenceV1;
  }>): Promise<Readonly<{ hash: string; ref: string; created: boolean }>>;
}

export interface RecoveryProcessFixturePort {
  execute(input: Readonly<{
    campaignHash: string;
    scenarioId:
      | "spawner_pre_transfer_restart"
      | "completion_owner_pre_effect_restart"
      | "provider_quota_failure"
      | "runtime_crash_cleanup"
      | "supervisor_generation_safe_retry"
      | "post_owner_exactly_once_recovery";
    caseId: string;
    releaseSha: string;
  }>): Promise<Readonly<{
    before: RecoveryCheckpointV1;
    after: RecoveryCheckpointV1;
    receipt: RecoveryProcessFixtureReceiptV1;
    receiptRef: string;
  }>>;
}

export type RecoveryProcessScenarioAssertionsV1 =
  | Readonly<{
      scenarioId: "spawner_pre_transfer_restart";
      claimPublishedHash: string;
      untransferredReleaseCount: 1;
      transferredClaimCount: 1;
    }>
  | Readonly<{
      scenarioId: "completion_owner_pre_effect_restart";
      ownerCommittedHash: string;
      resumedOwnerHash: string;
      mandatoryEffectApplyCount: 1;
    }>
  | Readonly<{
      scenarioId: "provider_quota_failure";
      failureCode: "provider_rate_limited";
      failureCount: 1;
      admittedFallbackCount: 1;
    }>
  | Readonly<{
      scenarioId: "runtime_crash_cleanup";
      signal: "SIGTERM";
      targetProcessGroupIdentityHash: string;
      listenerReleased: true;
    }>
  | Readonly<{
      scenarioId: "supervisor_generation_safe_retry";
      directiveAuthorityHash: string;
      staleGenerationRejected: true;
      successorGeneration: number;
    }>
  | Readonly<{
      scenarioId: "post_owner_exactly_once_recovery";
      effectIdentityHash: string;
      mutationCount: 1;
      effectsCommitted: true;
    }>;

export type RecoveryProcessTypedTerminalScenarioIdV1 = Extract<
  RecoveryProcessScenarioAssertionsV1["scenarioId"],
  RecoveryTypedTerminalScenarioIdV1
>;

export type RecoveryProcessTypedTerminalV1 =
  RecoveryTypedTerminalByScenarioV1[RecoveryProcessTypedTerminalScenarioIdV1];

export interface RecoveryProcessFixtureReceiptBaseV1 {
  schema: "setfarm.internal-production-recovery-process-fixture-receipt.v1";
  campaignHash: string;
  finalReleaseEpoch: GoldenFinalReleaseEpochV1;
  caseId: string;
  scenarioId: RecoveryProcessScenarioAssertionsV1["scenarioId"];
  runId: string;
  runNumber: number;
  generation: number;
  isolatedDatabaseEvidenceHash: string;
}

export type RecoveryProcessFixtureReceiptV1 =
  | Readonly<RecoveryProcessFixtureReceiptBaseV1 & {
      outcome: "success";
      checkpoint: InternalProductionRecoveryCheckpointName;
      checkpointFrameHash: string;
      beforeCheckpointHash: string;
      afterCheckpointHash: string;
      targetOwnershipHash: string;
      scenarioAssertions: RecoveryProcessScenarioAssertionsV1;
      failure: null;
      cleanupHash: string;
      receiptHash: string;
    }>
  | Readonly<RecoveryProcessFixtureReceiptBaseV1 & {
      outcome: "typed_terminal";
      scenarioId: RecoveryProcessTypedTerminalScenarioIdV1;
      scenarioAssertions: null;
      typedTerminal: RecoveryProcessTypedTerminalV1;
      checkpoint: InternalProductionRecoveryCheckpointName;
      checkpointFrameHash: string;
      beforeCheckpointHash: string;
      afterCheckpointHash: string;
      targetOwnershipHash: string;
      terminalBoundary: InternalProductionRecoveryCheckpointName;
      observedAuthorityHash: string;
      cleanupCensus: RecoveryOwnershipCensusV1;
      cleanupCensusHash: string;
      cleanupHash: string;
      receiptHash: string;
    }>
  | Readonly<RecoveryProcessFixtureReceiptBaseV1 & {
      outcome: "failure";
      scenarioAssertions: null;
      failure: Readonly<{
        code:
          | "checkpoint_authority_rejected"
          | "target_mutation_not_observed"
          | "recovery_invariant_failed"
          | "cleanup_incomplete";
        boundary: InternalProductionRecoveryCheckpointName;
        observedAuthorityHash: string;
        cleanupCensus: RecoveryOwnershipCensusV1;
        cleanupCensusHash: string;
      }>;
      cleanupHash: string;
      receiptHash: string;
    }>;

export interface RecoveryProcessFixtureReceiptResolverV1 {
  getByRef(receiptRef: string): Promise<RecoveryProcessFixtureReceiptV1>;
}

export function createRecoveryProcessFixtureReceiptResolverV1(): RecoveryProcessFixtureReceiptResolverV1;

export interface RecoveryProcessCheckpointFrameV1 {
  schema: "setfarm.internal-production-recovery-process-checkpoint.v1";
  scenarioId: RecoveryScenarioId;
  runId: string;
  runNumber: number;
  generation: number;
  claimId: number | null;
  runtimeSessionId: string | null;
  completionRequestId: string | null;
  childProcessIdentityHash: string;
  capabilityHash: string;
  checkpoint: string;
  expiresAt: string;
  frameHash: string;
}

export interface RecoveryProcessCheckpointController {
  accept(input: Readonly<{
    expectedScenarioId: RecoveryScenarioId;
    expectedRunId: string;
    expectedGeneration: number;
    frame: RecoveryProcessCheckpointFrameV1;
    presentedCapability: Uint8Array;
  }>): Promise<Readonly<{ leaseId: string; frameHash: string }>>;
  release(input: Readonly<{
    leaseId: string;
    runId: string;
    generation: number;
    presentedCapability: Uint8Array;
  }>): Promise<void>;
}

export type InternalProductionRecoveryCheckpointName =
  | "spawner.claim_published_before_transfer"
  | "spawner.runtime_owned_before_fault"
  | "spawner.provider_failure_before_fallback"
  | "completion.owner_committed_before_effects"
  | "completion.effect_applied_before_settlement"
  | "supervisor.directive_authenticated_before_generation_claim";

export interface InternalProductionRecoveryCheckpointPort {
  reach(input: Readonly<{
    checkpoint: InternalProductionRecoveryCheckpointName;
    runId: string;
    runNumber: number;
    generation: number;
    claimId: number | null;
    runtimeSessionId: string | null;
    completionRequestId: string | null;
    effectKey: string | null;
    ownerInstanceId: string | null;
    sourceIdentityHash: string;
  }>): Promise<void>;
}

export const NOOP_INTERNAL_PRODUCTION_RECOVERY_CHECKPOINT_PORT:
  InternalProductionRecoveryCheckpointPort;

// Consume these exports from Subproject B unchanged. B supplies a discriminated
// lifecycle generation for V3 stories or a canonical workflow-step claim. D
// does not redeclare the predicate, generation, poll, port, or receipt types.
import type {
  GoldenLifecycleCheckpointPort,
  GoldenLifecycleCheckpointPredicateV1,
  GoldenLifecycleCheckpointReceiptV1,
  GoldenLifecycleGenerationV1,
  GoldenRunPollV1,
} from "./golden-run-harness.js";

export interface SpawnerRuntimeDependencies {
  recoveryCheckpoint?: InternalProductionRecoveryCheckpointPort;
}

export interface RuntimeCompletionRepositoryOptions {
  recoveryCheckpoint?: InternalProductionRecoveryCheckpointPort;
}

export interface ClaimRuntimePublicationDependencies {
  recoveryCheckpoint?: InternalProductionRecoveryCheckpointPort;
}

export type RunOperationalModelV2 = Readonly<
  Omit<RunOperationalModel, "schema"> & {
    schema: "setfarm.run-operational-model.v2";
    modelHash: string;
  }
>;

export const RunOperationalModelV2Schema: z.ZodType<RunOperationalModelV2>;
export function parseRunOperationalModelV2(value: unknown): RunOperationalModelV2;
export function computeRunOperationalModelHashV2(
  value: Omit<RunOperationalModelV2, "modelHash">,
): string;

// Imported without alias from C's
// `./golden-stage-coordination-v1.js`:
// GoldenStageCoordinationV1,
// prepareGoldenStageCoordinationV1, and
// resolveGoldenStageCoordinationV1.
// Imported without alias from C's `./golden-matrix-runner.js`:
// GoldenAssertionEnabledStagedCaseV1 and
// GoldenAssertionEnabledStageOutcomeV1.
// Imported without alias from B's `./golden-run-harness.js`:
// GoldenBlockedPreflightResultV1, GoldenCaseExecutionOutcomeV1,
// GoldenExternalLifecycleCheckpointCapabilityV1,
// createGoldenExternalLifecycleCheckpointCapabilityV1, and
// authenticateGoldenExternalLifecycleCheckpointCapabilityV1.
// Imported without alias from B's `./golden-run-contract-v1.js`:
// GoldenStartedRunResultV1 and LoadedGoldenCampaignV1.
// Imported without alias from B's `./golden-run-store.js`:
// GoldenRunResultStore.
// Imported without alias from C's `./golden-matrix-runner.js`:
// createGoldenRecoveryAssertionEnabledCaseExecutorV1.

export type RecoveryLiveGoldenScenarioIdV1 = Extract<
  RecoveryScenarioId,
  | "mission_control_active_run_restart"
  | "dashboard_active_run_restart"
  | "github_review_retry"
>;

export type RecoveryLiveGoldenInflightStatusV1 =
  | Readonly<{
      schema: "setfarm.internal-production-recovery-live-golden-inflight-status.v1";
      state: "coordination-persisted";
      campaignHash: string;
      scenarioId: RecoveryLiveGoldenScenarioIdV1;
      lifecycleCheckpointCapabilityHash: string | null;
      finalReleaseEpoch: GoldenFinalReleaseEpochV1;
      postRebindEntryAuthorityRef: CanonicalRef;
      postRebindEntryAuthorityHash: string;
      coordination: GoldenStageCoordinationV1;
      staged: null;
      resultRef: null;
      resultHash: null;
      previousStatusHash: string | null;
      statusRef: CanonicalRef;
      statusHash: string;
    }>
  | Readonly<{
      schema: "setfarm.internal-production-recovery-live-golden-inflight-status.v1";
      state: "staged";
      campaignHash: string;
      scenarioId: RecoveryLiveGoldenScenarioIdV1;
      lifecycleCheckpointCapabilityHash: string | null;
      finalReleaseEpoch: GoldenFinalReleaseEpochV1;
      postRebindEntryAuthorityRef: CanonicalRef;
      postRebindEntryAuthorityHash: string;
      coordination: GoldenStageCoordinationV1;
      staged: GoldenAssertionEnabledStagedCaseV1;
      resultRef: null;
      resultHash: null;
      previousStatusHash: string | null;
      statusRef: CanonicalRef;
      statusHash: string;
    }>
  | Readonly<{
      schema: "setfarm.internal-production-recovery-live-golden-inflight-status.v1";
      state: "pre-run-result";
      campaignHash: string;
      scenarioId: RecoveryLiveGoldenScenarioIdV1;
      lifecycleCheckpointCapabilityHash: string | null;
      finalReleaseEpoch: GoldenFinalReleaseEpochV1;
      postRebindEntryAuthorityRef: CanonicalRef;
      postRebindEntryAuthorityHash: string;
      coordination: GoldenStageCoordinationV1;
      staged: null;
      resultRef: CanonicalRef;
      resultHash: string;
      blockerCode: "RECOVERY_LIVE_GOLDEN_PRE_RUN_CONFIGURATION_FAILURE";
      previousStatusHash: string;
      statusRef: CanonicalRef;
      statusHash: string;
    }>
  | Readonly<{
      schema: "setfarm.internal-production-recovery-live-golden-inflight-status.v1";
      state: "blocked";
      campaignHash: string;
      scenarioId: RecoveryLiveGoldenScenarioIdV1;
      lifecycleCheckpointCapabilityHash: string | null;
      finalReleaseEpoch: GoldenFinalReleaseEpochV1;
      postRebindEntryAuthorityRef: CanonicalRef;
      postRebindEntryAuthorityHash: string;
      coordination: GoldenStageCoordinationV1;
      staged: null;
      resultRef: null;
      resultHash: null;
      preflight: GoldenBlockedPreflightResultV1;
      blockerCode: "RECOVERY_LIVE_GOLDEN_STAGE_BLOCKED";
      previousStatusHash: string;
      statusRef: CanonicalRef;
      statusHash: string;
    }>
  | Readonly<{
      schema: "setfarm.internal-production-recovery-live-golden-inflight-status.v1";
      state: "result-bound";
      campaignHash: string;
      scenarioId: RecoveryLiveGoldenScenarioIdV1;
      lifecycleCheckpointCapabilityHash: string | null;
      finalReleaseEpoch: GoldenFinalReleaseEpochV1;
      postRebindEntryAuthorityRef: CanonicalRef;
      postRebindEntryAuthorityHash: string;
      coordination: GoldenStageCoordinationV1;
      staged: GoldenAssertionEnabledStagedCaseV1;
      resultRef: CanonicalRef;
      resultHash: string;
      previousStatusHash: string;
      statusRef: CanonicalRef;
      statusHash: string;
    }>;

export interface RecoveryLiveGoldenInflightStoreV1 {
  persistCoordination(input: Readonly<{
    campaignHash: string;
    scenarioId: RecoveryLiveGoldenInflightStatusV1["scenarioId"];
    lifecycleCheckpointCapabilityHash: string | null;
    coordination: GoldenStageCoordinationV1;
  }>): Promise<Extract<RecoveryLiveGoldenInflightStatusV1, { state: "coordination-persisted" }>>;
  persistStageOutcome(input: Readonly<{
    coordinationStatusRef: CanonicalRef;
    coordinationStatusHash: string;
    outcome: GoldenAssertionEnabledStageOutcomeV1;
  }>): Promise<Extract<
    RecoveryLiveGoldenInflightStatusV1,
    { state: "staged" | "pre-run-result" | "blocked" }
  >>;
  bindResult(input: Readonly<{
    stagedStatusRef: CanonicalRef;
    stagedStatusHash: string;
    resultRef: CanonicalRef;
    resultHash: string;
  }>): Promise<Extract<RecoveryLiveGoldenInflightStatusV1, { state: "result-bound" }>>;
  resolve(input: Readonly<{
    statusRef: CanonicalRef;
    statusHash: string;
  }>): Promise<RecoveryLiveGoldenInflightStatusV1>;
}

export interface RecoveryScenarioExecutionGuardV1 {
  schema: "setfarm.internal-production-recovery-scenario-execution-guard.v1";
  command: "execute" | "reuse";
  campaignHash: string;
  caseId: string;
  scenarioId: RecoveryScenarioId;
  sourceResultHash: string | null;
  mode: "actual_postgres_process_integration" | "live_operational";
  checkpoint: string;
  action:
    | "restartMissionControl"
    | "restartDashboard"
    | "publish-golden-actionable-post-pr-review"
    | "restartAcceptedProduct"
    | null;
  releaseSha: string;
  finalReleaseEpoch: GoldenFinalReleaseEpochV1;
  repairReviewReceiptHash: string | null;
  loadedCampaignHash: string;
  executableBuildIdentityHash: string;
  authorityObservationHash: string;
  observedAt: string;
  expiresAt: string;
  oneUseNonceHash: string;
  guardRef: CanonicalRef;
  guardHash: string;
}

export interface RecoveryScenarioExecutionGuardAuthorityV1 {
  issue(input:
    | Readonly<{
        command: "execute";
        campaignHash: string;
        caseId: string;
        scenarioId: Exclude<RecoveryScenarioId, "api_durable_state_restart">;
        sourceResultHash: null;
        mode: "actual_postgres_process_integration" | "live_operational";
        checkpoint: string;
        action:
          | "restartMissionControl"
          | "restartDashboard"
          | "publish-golden-actionable-post-pr-review"
          | null;
        releaseSha: string;
        repairReviewReceiptHash: string | null;
      }>
    | Readonly<{
        command: "reuse";
        campaignHash: string;
        caseId: null;
        scenarioId: "api_durable_state_restart";
        sourceResultHash: string;
        mode: "live_operational";
        checkpoint: "accepted_product_durable_state_written";
        action: "restartAcceptedProduct";
        releaseSha: null;
        repairReviewReceiptHash: string | null;
      }>
  ): Promise<RecoveryScenarioExecutionGuardV1>;
  resolve(input: Readonly<{
    guardRef: CanonicalRef;
    guardHash: string;
  }>): Promise<RecoveryScenarioExecutionGuardV1>;
  consume(input: Readonly<{
    guardRef: CanonicalRef;
    guardHash: string;
  }>): Promise<RecoveryScenarioExecutionGuardV1>;
}

export function createRecoveryScenarioExecutionGuardAuthorityV1():
  RecoveryScenarioExecutionGuardAuthorityV1;

export interface RecoveryScenarioExecutorV1 {
  run(input: Readonly<{
    loaded: LoadedGoldenCampaignV1;
    caseId: string;
    scenarioId: RecoveryScenarioId;
    releaseSha: string;
    execute: boolean;
    sourceResultHash: string | null;
    mode: "actual_postgres_process_integration" | "live_operational";
    repairReviewReceiptHash: string | null;
    checkpoint: string;
    action:
      | "restartMissionControl"
      | "restartDashboard"
      | "publish-golden-actionable-post-pr-review"
      | "restartAcceptedProduct"
      | null;
    executionGuardRef: CanonicalRef;
    executionGuardHash: string;
  }>): Promise<RecoveryScenarioEvidenceV1 | RecoveryScenarioPreflightRefusalV1>;
}

export function createInternalProductionRecoveryCompositionV1(): RecoveryScenarioExecutorV1;

export interface RecoveryFinalizedPacketV1 {
  schema: "setfarm.internal-production-recovery-finalized-packet.v1";
  campaignId: "internal-production-2026-08-13";
  campaignHash: string;
  postRebindEntryAuthorityRef: CanonicalRef;
  postRebindEntryAuthorityHash: string;
  finalReleaseEpoch: GoldenFinalReleaseEpochV1;
  orderedEvidenceHashes: readonly string[];
  zeroOwnerReceiptHash: string;
  reconciliationReceiptHash: string;
  browserAcceptanceReceiptHash: string;
  setfarmSourceSha: string;
  missionControlSourceSha: string;
  setfarmBuildArtifactHash: string;
  missionControlBuildArtifactHash: string;
  recoveryMatrixMarkdownHash: string;
  recoveryMatrixMarkdownSizeBytes: number;
  recoveryMatrixMarkdownPrivateRef: CanonicalRef;
  recoveryReconciliationMarkdownHash: string;
  recoveryReconciliationMarkdownSizeBytes: number;
  recoveryReconciliationMarkdownPrivateRef: CanonicalRef;
  finalizationHash: string;
  finalizationRef: CanonicalRef;
}

export interface RecoveryFinalizedPacketResolverV1 {
  resolveByRef(finalizationRef: CanonicalRef): Promise<RecoveryFinalizedPacketV1>;
}

export function createRecoveryFinalizedPacketResolverV1(): RecoveryFinalizedPacketResolverV1;

export interface RecoveryPacketIndependentReviewReceiptV1 {
  schema: "setfarm.internal-production-recovery-packet-independent-review-receipt.v1";
  campaignHash: string;
  postRebindEntryAuthorityRef: CanonicalRef;
  postRebindEntryAuthorityHash: string;
  finalReleaseEpoch: GoldenFinalReleaseEpochV1;
  finalizationRef: CanonicalRef;
  finalizationHash: string;
  recoveryMatrixMarkdownHash: string;
  recoveryReconciliationMarkdownHash: string;
  reviewerKind: "independent-agent";
  findings: readonly Readonly<{
    findingId: string;
    severity: "critical" | "high" | "medium" | "low" | "info";
    disposition: "resolved" | "informational";
    location: string;
    evidenceRefs: readonly CanonicalRef[];
    resolutionRef: CanonicalRef | null;
    resolutionHash: string | null;
  }>[];
  rerun: Readonly<{
    verifyCampaignHash: string;
    authorityVerificationHash: string;
    refinalizationHash: string;
    recoveryMatrixMarkdownHash: string;
    recoveryReconciliationMarkdownHash: string;
  }>;
  verdict: "clear";
  unresolved: Readonly<{ critical: 0; high: 0; medium: 0 }>;
  reviewedAt: string;
  reviewRef: CanonicalRef;
  reviewHash: string;
}

export const RecoveryPacketIndependentReviewReceiptV1Schema:
  z.ZodType<RecoveryPacketIndependentReviewReceiptV1>;
export function parseRecoveryPacketIndependentReviewReceiptV1(
  value: unknown,
): RecoveryPacketIndependentReviewReceiptV1;

interface RecoveryVerifiedPacketReviewCapabilityV1 {
  readonly kind: "authenticated-recovery-verified-packet-review";
  readonly capability: unknown;
}

export interface RecoveryPacketIndependentReviewResolverV1 {
  resolve(input: Readonly<{
    reviewRef: CanonicalRef;
    reviewHash: string;
  }>): Promise<RecoveryPacketIndependentReviewReceiptV1>;
  resolveByFinalization(input: Readonly<{
    campaignHash: string;
    finalizationHash: string;
  }>): Promise<RecoveryPacketIndependentReviewReceiptV1>;
}

export function createRecoveryPacketIndependentReviewResolverV1():
  RecoveryPacketIndependentReviewResolverV1;

export function recordRecoveryPacketIndependentReviewV1(input: Readonly<{
  campaignHash: string;
  observationRef: CanonicalRef;
}>): Promise<Readonly<{
  reviewRef: CanonicalRef;
  reviewHash: string;
}>>;

export interface RecoveryOperationalAcceptanceV1 {
  schema: "setfarm.internal-production-recovery-operational-acceptance.v1";
  campaignHash: string;
  postRebindEntryAuthorityRef: CanonicalRef;
  postRebindEntryAuthorityHash: string;
  finalReleaseEpoch: GoldenFinalReleaseEpochV1;
  orderedSelectionHashes: readonly string[];
  reconciliationReceiptHash: string;
  browserAcceptanceReceiptHash: string;
  zeroOwnerReceiptHash: string;
  independentReviewRef: CanonicalRef;
  independentReviewHash: string;
  finalizationRef: CanonicalRef;
  finalizationHash: string;
  recoveryMatrixMarkdownHash: string;
  recoveryReconciliationMarkdownHash: string;
  acceptanceRef: CanonicalRef;
  acceptanceHash: string;
}

export interface RecoveryOperationalAcceptanceResolverV1 {
  resolveByRef(acceptanceRef: CanonicalRef): Promise<RecoveryOperationalAcceptanceV1>;
}

export function createRecoveryOperationalAcceptanceResolverV1(): RecoveryOperationalAcceptanceResolverV1;

export interface RecoveryDocsDeliveryAcceptanceV1 {
  schema: "setfarm.internal-production-recovery-docs-delivery-acceptance.v1";
  campaignHash: string;
  operationalAcceptanceRef: CanonicalRef;
  operationalAcceptanceHash: string;
  postHandoffRef: CanonicalRef;
  postHandoffHash: string;
  docsSessionReceiptRef: CanonicalRef;
  docsSessionReceiptHash: string;
  docsSessionHash: string;
  documentationSha: string;
  recoveryMatrixMarkdownHash: string;
  recoveryReconciliationMarkdownHash: string;
  deliveryRef: CanonicalRef;
  deliveryHash: string;
}

export const RecoveryDocsDeliveryAcceptanceV1Schema:
  z.ZodType<RecoveryDocsDeliveryAcceptanceV1>;

export interface RecoveryDocsDeliveryAcceptanceInputV1 {
  campaignHash: string;
  operationalAcceptanceRef: CanonicalRef;
  operationalAcceptanceHash: string;
  postHandoffRef: CanonicalRef;
  postHandoffHash: string;
  docsSessionReceiptRef: CanonicalRef;
  docsSessionReceiptHash: string;
  docsSessionHash: string;
  documentationSha: string;
}

export interface RecoveryDocsDeliveryAcceptancePortV1 {
  record(input: RecoveryDocsDeliveryAcceptanceInputV1):
    Promise<RecoveryDocsDeliveryAcceptanceV1>;
  resolveByRef(deliveryRef: CanonicalRef): Promise<RecoveryDocsDeliveryAcceptanceV1>;
}

export function createRecoveryDocsDeliveryAcceptancePortV1():
  RecoveryDocsDeliveryAcceptancePortV1;

export interface RecoveryMaterializationAuthorityV1 {
  schema: "setfarm.internal-production-recovery-materialization-authority.v1";
  campaignHash: string;
  finalizationHash: string;
  finalizationRef: CanonicalRef;
  recoveryMatrixMarkdownHash: string;
  recoveryReconciliationMarkdownHash: string;
  setfarmSourceSha: string;
  missionControlSourceSha: string;
  recoveryDeliveryGenerationHash: string;
  recoveryMatrixMarkdownTargetPath: string;
  recoveryReconciliationMarkdownTargetPath: string;
  materializationHash: string;
  authorityHash: string;
}

export interface RecoveryMaterializationAuthorityResolverV1 {
  resolveByCampaignHash(campaignHash: string): Promise<RecoveryMaterializationAuthorityV1 | null>;
}

export function createRecoveryMaterializationAuthorityResolverV1(): RecoveryMaterializationAuthorityResolverV1;

export async function finalizeRecoveryPacketV1(input: Readonly<{
  campaignHash: string;
  setfarmSourceSha: string;
  missionControlSourceSha: string;
}>): Promise<RecoveryFinalizedPacketV1>;

export async function materializeFinalizedRecoveryPacketV1(
  finalizationHash: string,
): Promise<Readonly<{
  schema: "setfarm.internal-production-recovery-packet-materialization.v1";
  recoveryDeliveryGenerationHash: string;
  recoveryMatrixMarkdownPath: string;
  recoveryReconciliationMarkdownPath: string;
  recoveryMatrixMarkdownHash: string;
  recoveryReconciliationMarkdownHash: string;
  materializationHash: string;
}>>;

export async function materializeFinalizedRecoveryPacketInSessionV1(input: Readonly<{
  finalizationRef: CanonicalRef;
  session: GoldenDocsMaterializationSessionV1;
}>): Promise<Readonly<{
  matrix: GoldenDocsMaterializationEntryCommitReceiptV1;
  reconciliation: GoldenDocsMaterializationEntryCommitReceiptV1;
}>>;
```

The standalone D-only materializer derives `recoveryDeliveryGenerationHash = hashCanonicalJson({schema:"setfarm.internal-production-recovery-delivery-generation.v1",epochHash,finalizationHash})` and writes below `docs/review-packets/internal-production/epoch-${epochHash}-recovery-${recoveryDeliveryGenerationHash}/`; its two target strings are code-derived and accept no caller path. The combined session materializer does not reuse or inspect that standalone directory. It supplies D's two freshly reopened private content hashes only through B's owner-mediated commit API. B authenticates the live session and its exact next registered owner/kind/content hash and alone owns the combined generation directory, paths, basenames, absence, order, write, reopen, and session advance. D never resolves a registered entry or path, imports E's generation type, computes E's closure hash, or reads B's hidden session controller.

Before `createInternalProductionServiceRestartAuthorityV1()` permits any generic `prepare`, both D source PRs must be merged and built while A's physical-restart epoch remains exactly ordinal one/owner `baseline-a`. D first activates and freshly resolves its exact reviewed 43-producer manifest set; a missing or mismatched activation blocks before any D startup owner can be published. A's exact migration-bound `d-startup-hook-load` sequence then restarts spawner, dashboard, and Mission Control in order, loading the reviewed D startup hooks without using D restart authority. The sequence proves the current clean Setfarm source descends from A's original migration application SHA while A's dedicated immutable bootstrap-migration implementation blob, ordered-statements hash, named digest entry, digest, and schema projection remain byte-identical; unrelated append-only aggregate registry/digest entries are permitted, but any change to that A-owned named projection blocks before the first restart. The hooks' ordinary-slot paths may observe, claim, publish owner/listener evidence, and settle the common slot under epoch one; every D generic-prepare probe must still return typed `SERVICE_RESTART_AUTHORITY_NOT_ACTIVATED` before reservation/outbox/helper mutation. Once all three new generations are healthy and the code-owned runtime-source observation equals the exact two D handoff SHAs, A's cutover module can internally observe and record its strict readiness candidate; D has no readiness writer or caller-authored readiness input.

The D delivery owner next obtains one fresh A `InternalProductionBaselineZeroOwnerMutationGuardV1` pair from `acceptance:baseline-post-handoff -- zero-owner --json` and calls `prepareInternalProductionServiceRestartAuthorityCutoverV1({zeroOwnerGuardRef,zeroOwnerGuardHash})` exactly once. A first writes/reopens A's one fixed full cutover pending record, then acquires the shared durable `recovery-d-physical-service-restart-authority-cutover-v1` global owner-admission fence before deriving the operation; prepare returns only after both are discoverable. A later fresh process calls only zero-input `resumeActiveInternalProductionServiceRestartAuthorityCutoverV1()`; it reopens or acquires that same fence and operation and never accepts or reconstructs a guard. `observeInternalProductionServiceRestartAuthorityCutoverStatusV1()` is read-only. D's `observeRecoveryCompleteZeroOwnerCensusV1()` result is observation only and is not accepted at this mutation boundary. The reviewed D adapter makes the only two allowed unaliased A mutation imports, `prepareInternalProductionPhysicalServiceRestartAuthorityCutoverToRecoveryDV1` and `resumeActiveInternalProductionPhysicalServiceRestartAuthorityCutoverToRecoveryDV1`; every other D import from the A module is a type, pair-only resolver, or read-only status observer. Under A's fence and sole physical-restart transition lock, A reobserves exactly zero run/claim/preparation/artifact/matrix/fleet/docs/process owners immediately before guard consumption and again before the epoch CAS, proves every A restart/sequence/helper census zero, code-observes all three fixed hook/source/build identities, records/reopens readiness, derives and publishes/reopens retirement/activation/epoch-two/cutover candidates, and performs one expected-predecessor visibility CAS to the complete epoch-two head. Nonzero ownership keeps the same pending operation, consumes no guard, and performs no CAS. The fence remains held through terminal cutover reopen and is released only afterward. Before that CAS every reader sees A epoch one and D disabled; after it every reader freshly resolves the exact A-owned cutover, retirement, activation, readiness, epoch-two, and fence-release chain. The strict `recovery-d-active` status/output carries non-null `ownerAdmissionFenceReleaseRef/ownerAdmissionFenceReleaseHash`; D invokes A's pair-only `resolveInternalProductionGlobalOwnerAdmissionFenceReleaseV1(...)` and equality-checks its fence and terminal-cutover pairs before enabling any generic D preparation. All earlier status branches require both release fields null. A crash before visibility leaves epoch one active and zero-input recovery adopts only byte-identical A-owned state; a crash after visibility adopts the same terminal pair. There is no D-owned candidate/store, no observable retired-without-activation or activated-without-retirement state, and the former direct two-call retirement/activation sequence is forbidden.

The activation/cutover resolvers are exact identity re-exports of A's pair-only resolvers from `./baseline-restart-authority-retirement-v1.js`. They freshly resolve the complete cutover and exact epoch-two head, require owner `recovery-d`, ordinal `2`, the exact ordered three-service tuple, zero A pending/live restart/sequence/helper state, and expected predecessor epoch one, then remint A's strict objects. Before the cutover resolves, every D `prepare` returns typed `SERVICE_RESTART_AUTHORITY_NOT_ACTIVATED` before reservation; after it resolves, A's shared epoch guard makes every new A restart/sequence return `BASELINE_RESTART_AUTHORITY_RETIRED`. The transition is one-way: D's exact cutover adapter imports only A's named prepare and zero-input resume mutations, D never imports an A restart capability or any third A mutation, A never imports D, and pre-retirement A history remains read-only/recoverable without authorizing a new dispatch.

`createInternalProductionServiceRestartAuthorityV1()` is D's sole generic restart authority and must merge before any E source that imports it. The coordinator first persists and reopens one strict pending input containing namespace/scope/epoch/attempt, exact service label, before-generation and entrypoint/build identity, durable `coordinationRef`/`coordinationHash`/`coordinationIdHash`, terminal predecessor, and its already-open exact coordinator authority. `prepareRecoveryRestartTargetAuthorizationV1(...)` recomputes that identity, content-addresses/reopens one immutable `RecoveryRestartTargetAuthorizationPreparedSnapshotV1` below `RECOVERY_RESTART_TARGET_AUTHORIZATION_PREPARED_SNAPSHOT_REF_PREFIX_V1`, then publishes `RecoveryRestartTargetAuthorizationActivePendingV1` at the one globally fixed `RECOVERY_RESTART_TARGET_AUTHORIZATION_ACTIVE_PENDING_REF_V1`. Expected absence returns the snapshot's `preparedActivePendingRef`/`preparedActivePendingHash` and the distinct fixed-locator `currentActivePendingRef`/`currentActivePendingHash` at phase `pending-input`; either same ref or same hash is invalid. The current record repeats and must equal the freshly resolved snapshot's pending-input, namespace, target, coordination, coordinator, and reservation-set identity. Every later expected-hash phase CAS preserves the prepared pair but publishes a different `currentActivePendingHash`; current is the fixed locator's phase/head identity, never an authorization-operation identity. Namespace and service are authenticated body members only and never select a path, partition, locator, or one of twelve slots. An equal retry adopts both exact records, and a distinct concurrent body returns `RECOVERY_RESTART_TARGET_AUTHORIZATION_BUSY`. No immutable authorization operation, fence, reservation, or authorization exists before the locator and snapshot are reopened. With no restart head only a null predecessor is valid; otherwise preparation freshly resolves the prior final envelope plus its immutable operation/core/close/occurrence/head/release chain and derives exactly `head.occurrenceCount + 1`. A caller supplies no ordinal or head.

`resumeActiveRecoveryRestartTargetAuthorizationV1()` accepts zero arguments and never scans. A fresh process opens only the fixed current locator, authenticates its `currentActivePendingRef`/`currentActivePendingHash` phase record, then freshly resolves the separate content-addressed `preparedActivePendingRef`/`preparedActivePendingHash` snapshot before resolving the named pending input and exact coordinator authority. It rejects a pair-equal or ref-equal snapshot/locator, an unreadable/tampered snapshot, or any repeated context field that differs between the current record and snapshot. From those reopened immutable snapshot bytes it derives one acyclic immutable `RecoveryRestartTargetAuthorizationOperationV1` binding that snapshot pair, content-addresses and reopens that operation, then expected-hash advances only the locator to `operation-published`; a crash before locator advance adopts the unique derived content address without a scan. Every authorization, consumption, restart operation, terminal core, compound close, occurrence/history, and final envelope uses this immutable operation ref/hash and its separately resolved prepared snapshot, never a mutable locator hash. Resume calls A's exact unaliased `acquireInternalProductionRecoveryRestartOwnerAdmissionFenceV1(...)`; A derives and atomically returns the fence plus the seven exact named target reservations. D publishes one authorization binding all seven pairs, the immutable operation and prepared snapshot, target-family hash, fence/head, coordinator authority, and one-use nonce, then advances the locator to `authorized` with a new current hash. Only after freshly resolving both immutable records does resume return the strict four-field `{authorizationOperationRef,authorizationOperationHash,authorizationRef,authorizationHash}` result; it never returns either locator pair. Response loss at snapshot, operation, authorization, or locator publication/replacement reopens the same immutable snapshot/operation/authorization and returns the identical quartet, never an authorization-only pair. Missing/corrupt/terminal locator state, a second candidate, census/observer input, mismatched namespace/coordinator kind, empty/extra/closed/cross-operation target, stale A head, or family mismatch publishes no authorization or restart operation. Status separately opens the fixed current locator, reports both prepared and current pairs, resolves every non-null content-addressed pair, and the `authorized`/`terminal-finalized` JSON projection repeats all four resume fields byte-for-byte; the `operation-published` projection exposes only the operation pair and zero-input resume completes the authorization before returning. After the final completion/failure envelope is durable and reopened, D advances the locator to `terminal-finalized` with another new current hash and only then expected-hash clears it. Old immutable snapshots, operations, and all history remain resolvable forever; a later restart reuses only the cleared locator with a distinct immutable snapshot and operation pair.

Only after that pair resolves may `InternalProductionServiceRestartAuthorityV1.prepare(...)` derive and publish the actual restart operation. Its input requires both `authorizationOperationRef`/`authorizationOperationHash` and `authorizationRef`/`authorizationHash`, never a guard, observer, snapshot, or locator pair. Before consuming anything it freshly resolves the immutable operation, authorization, and their separately content-addressed prepared snapshot; it verifies the operation/authorization reciprocal operation pair, their identical prepared pair, the snapshot's canonical hash/ref, and namespace, target service, coordination hash, coordinator authority, reservation-set hash, and target family across all three records. It then resolves current status and predecessor chain, requiring the status's prepared pair to equal the immutable snapshot and its current locator pair to be distinct, without requiring any old/new `currentActivePendingHash` equality. It consumes only that verified authorization once while the A fence remains held, and binds the immutable authorization-operation plus all seven exact A-returned reservation pairs. The service-start-slot restart reservation is the exact `restartReservation`; the service-restart operation, launch outbox, helper process, dispatch child, startup listener, and replacement process may publish only after authenticating their respective named target pair and common target-family hash. None calls `beginOrAdoptInternalProductionOwnerReservationV1(...)`; that ordinary begin remains available only to non-target D producers outside the held fence. `deriveInternalProductionServiceRestartOperationIdV1(...)` hashes both immutable authorization pairs with the complete prepare tuple but no future generation/PID/marker value. Response-loss recovery adopts only that operation and exact target-backed suffix; replay, cross-role reservation use, a missing/eighth/renamed pair, locator-hash substitution, snapshot/locator pair equality, or ordinary-begin fallback fails before owner publication.

Before `d-startup-hook-load`, cutover, or any generic D producer begin/publication, `recovery-owner-producer-manifest-activation-v1.ts` requires D's reviewed clean source merge/build, calls A's zero-input current resolver, and freshly authenticates its exact `{head,receipt}` result for `A+B+C` with counts `11/10/6 = 27`. It calls `activateInternalProductionOwnerProducerManifestSetV1(...)` once with both predecessor pairs and ordered manifests `[A,B,C,D]`, then freshly resolves the A-owned successor `{head,receipt}` with exact counts `11/10/6/16 = 43` and byte-equal `headRef`/`headHash`, and only then content-addresses and reopens `InternalProductionRecoveryOwnerProducerManifestActivationReceiptV1`. That D receipt binds predecessor activation and head pairs plus successor activation and head pairs. Equal crash/response-loss retry adopts the same A activation and D receipt; a fork, stale/mismatched predecessor receipt or head, dirty/unreviewed source, wrong build, count/order/hash drift, or already different successor fails closed. The fixed read-only status follows the complete D receipt binding and returns `absent|activated`, with all activation/head fields null together or non-null together; D owns no A activation store or pointer. The two exact package verbs are `activate-recovery-owner-producer-manifest --json` and `recovery-owner-producer-manifest-activation-status --json`, backed only by `activateRecoveryOwnerProducerManifestCommandV1` and `observeRecoveryOwnerProducerManifestActivationStatusCommandV1` in the canonical forty-two-row registry.

`recovery-evidence.ts` exports the literal sixteen-row, seven-field `INTERNAL_PRODUCTION_OWNER_PRODUCER_ROWS_D_V1` and exact manifest shown above. Its prior eleven rows remain unchanged and the five additions are exactly `d-service-restart-launch-outbox-v1`, `d-service-restart-helper-process-v1`, `d-service-restart-child-process-v1`, `d-service-restart-startup-listener-v1`, and `d-service-restart-replacement-process-v1` with their five named `publish...UnderFenceV1` call sites. There is no D global-zero guard producer. AST tests require each of all seven target-backed call sites to authenticate its exact field/implementation ID/category/owner-key derivation from A's returned family before its first durable byte and forbid ordinary begin/close for those roles. They also compile-pin the `InternalProductionServiceRestartAuthorityV1.prepare` operation-pair input, `RecoveryRestartTargetAuthorizationPreparedSnapshotV1`, and its resolver; reject legacy unsplit fixed-locator fields, any mutable-locator argument or historical resolver, a prepared snapshot stored at the fixed locator ref, and any equal prepared/current ref or hash; and require only the initial prepare response and read-only status—not zero-input resume or historical authority—to carry `currentActivePendingRef`/`currentActivePendingHash`. The one compound A close settles all seven. Non-target D rows retain ordinary reservation begin/terminal close. `recovery-source-boundary.test.ts` validates exactly sixteen D rows, exact `A+B+C+D` count 43, seven literal fields, named call sites, activation controller/CLI ownership, and no E/final aggregate scan.

Before publishing the namespace operation or outbox, `prepare` must acquire D's fixed service-global start-slot CAS keyed solely by the exact LaunchAgent service (`setfarm-spawner`, `setfarm-dashboard`, or `mission-control`), never by namespace. This is one physical pointer, one expected-predecessor CAS implementation, and one append-only head chain for both `restart-reserved` and `ordinary-starting`; a reservation store and a separately checked ordinary-start store are forbidden. A restart reservation binds service, namespace, coordination ID, expected operation ID, exact predecessor reservation settlement, and the exact predecessor service-start-slot head. It remains the active slot across operation/outbox publication and every helper/child/PID/marker boundary until terminal helper/child/marker settlement advances the same slot to `settled`. Another namespace targeting the same service cannot reserve, prepare, or dispatch during that interval, while different services may proceed. An equal coordination/operation retry adopts the active reservation and exact operation. If an `ordinary-starting` claim is active, `prepare` returns only typed `SERVICE_START_SLOT_ORDINARY_STARTING` before publishing a reservation, namespace operation, or outbox; a different active restart identity returns `SERVICE_START_SLOT_RESTART_RESERVED_BY_OTHER_OPERATION`, and corrupt/multiple/unreadable head authority returns `SERVICE_START_SLOT_AMBIGUOUS`. No retry may convert any of those states by scanning or guessing.

The fixed startup path reads and changes only that same service-start-slot CAS and never chooses among namespace histories. If the active head is `restart-reserved`, the startup hook may return `restart-operation` only after resolving the exact reservation, operation/outbox, atomically claiming that operation, and publishing the operation-bound restart marker before ownership/listen; a missing/mismatched claim, ambiguous head, unrelated process identity, or attempt to fall through to ordinary startup is refused. If the head is absent or `settled`, an authenticated ordinary LaunchAgent process must first CAS-publish one immutable `InternalProductionServiceOrdinaryStartingClaimV1` and an `ordinary-starting` head before database/PID/listener ownership. The claim binds its authenticated process and launchd parent, exact configured service label, entrypoint, build identity, source SHA, code-derived slot ordinal, and exact predecessor head. `claimOrAdmitOrdinary(...)` adopts only the byte-identical live claim for the same authenticated startup process; a second process or identity mismatch returns `ORDINARY_START_CLAIM_CONFLICT`. It never returns an ordinary admission from an unprotected no-reservation observation.

The ordinary claim remains the active service-global slot while the service publishes its exact process owner and service-specific listener authority. `completeOrdinaryStart(...)` accepts only the authenticated ordinary admission, observes those authorities itself, durably publishes `InternalProductionServiceOrdinaryOwnerPublicationV1`, reopens it by exact ref/hash, then writes `InternalProductionServiceOrdinaryStartSettlementV1` and CAS-advances that same head to `settled`. Only the successful disposition binds the owner-publication pair and requires both absence hashes null. If the startup process exits before publication, fresh-process `recoverOrdinaryStart(...)` may settle the failure only with exact authenticated startup-process and owner/listener absence hashes; a live, partial, or ambiguous publication remains `in_progress` and continues to block restart preparation. A crash after owner/listener publication but before its receipt or slot settlement recovers from the named claim, authenticates the already published exact authorities, adopts/writes the one fixed claim-to-publication and claim-to-settlement entries, and advances the expected head once. Recovery never scans a process, directory, reservation history, or newest candidate. A normal login start, reboot start, or launchd crash relaunch therefore remains operational without fabricating a restart operation, but is linearized against every restart namespace from claim CAS through terminal settlement. Its admission has the exact claim and active-head pairs, every reservation/operation/operation-claim/marker member null, and `restartMarkerPublished:false`.

For `setfarm-spawner`, the same reviewed D source claim extends B's P0 activation-controller module/test with exactly two finite successors and replaces B's exported startup-admission alias with the strict three-branch union shown above. `d-ordinary-start` is created only by `createOrResumeSetfarmCompletionOwnerReceiptProducerDOrdinaryStartAdmissionV1({settlement,ownerPublication})` after D freshly resolves the unique successful ordinary settlement and exact owner/listener publication. It requires service/label/entrypoint/source/build/process/generation plus owner/listener equality, no active A or D restart reservation, exact B activation/current registration/predecessor head, and appends through B's expected-predecessor admission CAS. Its A fields are exactly null and its D settlement/publication refs/hashes are non-null.

`d-managed-restart` is created only by `createOrResumeSetfarmCompletionOwnerReceiptProducerDManagedRestartAdmissionV1({operation,startupAdmission,terminalReservation,completion,occurrence,namespaceHead,serviceStartSlotHead})`. The spawner startup hook retains its exact D `restart-operation` admission before ownership/listen, publishes its D marker/owner authority, and after D terminalizes the operation freshly resolves every input through D's fixed resolvers. The B extension requires `service:"setfarm-spawner"`, label `com.setrox.setfarm-spawner`, one exact namespace in `recovery-active-run|source-release-barrier|cold-rehearsal|documentation-handoff`, successful completion only, settled matching restart reservation and service-global slot head, occurrence disposition `complete`, occurrence/head core and target-set-close pairs equal to the completion envelope, namespace head current occurrence equal to that occurrence, and operation/startup/reservation/core/close/occurrence/head/release/completion ref/hash equality. It recomputes the operation's terminal-predecessor hash and exact null/non-null first-versus-later occurrence relation; requires namespace-head predecessor/count and B admission-head expected-predecessor CAS relations; binds source SHA/build, `beforeGenerationHash` from the operation, `afterGenerationHash` from completion, and requires the generations differ. Its A fields are exactly null. A failure, `in_progress`, failed occurrence, active reservation, ordinary settlement, namespace/service/source/build/generation/predecessor/core/close/release/head drift, missing final envelope, or structural clone cannot append an admission and cannot fall back to `d-ordinary-start`, either A branch, or a no-op.

Both functions return only `{admissionRef,admissionHash}` and the unchanged pair-only `resolveSetfarmCompletionOwnerReceiptProducerStartupAdmissionV1(...)` reopens/re-hashes the complete discriminated member and all named D authorities. The B controller accepts no raw parent hash, caller namespace, generic port, structural body, route, or fallback. Crashes before/after D startup claim/marker, owner publication, terminal reservation/completion/occurrence/head publication, B admission candidate, B head CAS, barrier release, and response reopen the same chain. A duplicate process/generation, stale activation/registration, wrong predecessor, or concurrent restart blocks. Until this reviewed D extension merges, B's non-A startup remains typed `activation-required`; afterward only the exact D ordinary or successful managed chain is eligible. Any launchd-parented process with the exact configured label/entrypoint/source/build is observationally one ordinary start regardless of login, reboot, crash relaunch, or an out-of-plan operator kickstart; the safety boundary is that no plan/worker/raw CLI issues such a kickstart and wrong parent/build/source, duplicate start, or active restart reservation still fails.

A manual `node` invocation, wrong parent/label/entrypoint/build/source, ambiguous/unreadable slot state, or an operation-backed start that loses any operation identity fails before database/PID/listener ownership. Terminal restart settlement first proves helper/child/process absence or the exact accepted live generation, then settles/releases its reservation through the same service-start-slot head and advances the append-only service reservation history. Namespace occurrence histories remain separate. The authority then durably publishes the immutable operation plus fixed predispatch outbox before a side effect. Its fixed helper launcher accepts only the operation pair, records an operation-specific helper claim, launches only `internal-production-service-restart-helper-v1.ts`, and never invokes `launchctl` itself. The helper claims first, owns the exact no-shell `launchctl kickstart -kp` child and all capture/termination/reaping, and the already merged spawner/dashboard/MC hooks use this two-branch startup authority before ownership/listen without plist or environment mutation.

D's scenario-3/4 action adapter likewise publishes and reopens its deterministic action-attempt coordination ref/hash/ID before calling `prepare`; response loss reuses that key. The source-release, cold, and documentation callers follow their separately specified durable pre-prepare records. No caller may synthesize a coordination only in memory at the `prepare` call boundary.

`executeOrRecover(...)` is reconciliation-only after the predispatch write and requires the exact service-restart operation plus immutable authorization-operation/authorization pair. It freshly resolves the one-use consumption and every target-backed outbox/helper/child/PID/marker/listener/replacement authority and returns only `in_progress|complete|failed`; it never issues a replacement operation, launches a second helper/child, scans, selects newest state, or repeats `kickstart`. The A fence and all seven target reservations remain unchanged and open throughout every `in_progress` result. At terminal disposition D first publishes and reopens A's exact imported `InternalProductionServiceRestartTerminalCoreV1`; that acyclic core binds the immutable authorization operation, restart operation, consumption, seven reservations, seven role-named terminal-owner authorities, namespace/service/coordination/family identity, and complete-or-failed disposition, and contains no target-set-close, release, occurrence/head, or final-envelope ref/hash.

D then calls A's exact unaliased `closeInternalProductionRecoveryRestartTargetsUnderFenceV1({fenceRef,fenceHash,terminalCoreRef,terminalCoreHash})`. A's pair-only core resolver reauthenticates every member and one owner-admission-head CAS closes all seven target reservations together while preserving the same fence and coordinator/active-target authority. A returns `InternalProductionRecoveryRestartTargetSetCloseV1`; D freshly resolves it and rejects a partial/per-target/generic/ordinary close, wrong role/order/implementation ID, missing/eighth target, coordinator close, or core/family/fence mismatch. D next content-addresses `InternalProductionServiceRestartOccurrenceV1` binding the immutable authorization operation, terminal core, target-set close, disposition, helper settlement, and predecessor; expected-predecessor CAS advances/reopens the fixed namespace/service head, which repeats the current core/close pair and append-only root.

Only after occurrence and head reopen does D call `releaseInternalProductionGlobalOwnerAdmissionFenceV1(...)` with A's strict recovery branch containing the exact terminal-core, target-set-close, occurrence, and head pairs. A freshly resolves core → close → occurrence/head under the same preserved fence; close-only release, stale/forked head, crossed operation, or any missing pair fails without release. Only after the release reopens does D publish the final `InternalProductionServiceRestartCompletionReceiptV1` or `InternalProductionServiceRestartFailureReceiptV1` envelope binding authorization operation, authorization/consumption, terminal core, compound close, occurrence/head, release, and disposition-specific evidence. The core/occurrence/head never reference that future envelope, so no hash projection is cyclic. History/predecessor resolution requires the prior final envelope and its entire immutable chain. After final-envelope publication/reopen, D advances/clears the active locator; coordinator reservations remain open until their owner closes them after release. Crashes at every core/close/occurrence/head/release/final-envelope/locator-clear boundary adopt the same bytes. Two sequential restarts reuse only the cleared fixed locator, produce distinct immutable operation/core/final pairs, and keep both histories resolvable. `recovery-active-run` alone nests its target-owner guard inside its matching coordinator authority; the other three namespaces use their own matching kind with null active target and never a global-zero authorization.

The D source delivery order is strict: one reviewed Setfarm claim merges the shared authority/helper, spawner/dashboard hooks, exact B activation-controller/test `d-ordinary-start|d-managed-restart` extension, and D's exact A-cutover adapter together while A epoch one remains active and D prepare remains disabled. Then serialize and merge the Mission Control branch that adds only its generic startup consumer/test and `server/index.ts` ordering. Build both clean mains, activate and freshly resolve the exact reviewed `A+B+C+D` manifest receipt/head, and only then use A's still-authoritative migration-bound `d-startup-hook-load` sequence to load all three D-capable hooks and prove the replacement spawner, dashboard, and Mission Control generations expose the exact merged source/build/hook identities. The current clean Setfarm SHA may be a descendant of A's migration application SHA only with A's dedicated immutable bootstrap-migration implementation blob, ordered statements, named digest entry, digest, and schema projection exact; unrelated append-only aggregate registry/digest entries remain valid. Ordinary-slot observation/settlement is permitted throughout this load; a D generic prepare is not. Only then obtain a fresh global-zero guard, prepare the cutover operation once, and let a fresh process call the zero-input resume adapter; A records readiness and executes the one-CAS atomic cutover that exposes A retirement and D activation together. Crash recovery around hook load/readiness/cutover adopts the same A sequence and A-owned pair chain; it never enables D early or clears epoch two. Only after both merges, clean-main builds, all-three-hook readiness, and cutover/retirement/activation resolve may D's live source barrier run or E compile an operational import from `./internal-production-service-restart-authority-v1.js`. The Setfarm source tree/hash and PR receipt must include both B paths and prove both finite branch functions plus the exact two-phase A mutation adapter; an omitted managed extension cannot release B's polling barrier after a D spawner restart. E must not create another helper, startup writer, readiness/cutover store, B admission branch, or direct `launchctl` seam.

The exact `acceptance:recovery` supported-command help is generated from `RECOVERY_ACCEPTANCE_COMMAND_GRAMMAR_V1` and its row `argvSchema` identities; this plan contains no second command list. The scenario CLI commands are exact:

```text
guard-scenario --command execute --campaign-hash SHA256 --case-id CASE --scenario SCENARIO --mode actual_postgres_process_integration --checkpoint NAME --release-sha SHA [--repair-review-receipt-hash SHA256] --json
guard-scenario --command execute --campaign-hash SHA256 --case-id CASE --scenario SCENARIO --mode live_operational --checkpoint NAME --live-action ACTION --release-sha SHA [--repair-review-receipt-hash SHA256] --json
guard-scenario --command reuse --campaign-hash SHA256 --source-result-hash SHA256 --scenario api_durable_state_restart --mode live_operational --checkpoint accepted_product_durable_state_written --runtime-action restartAcceptedProduct [--repair-review-receipt-hash SHA256] --json
execute --campaign-hash SHA256 --case-id CASE --scenario SCENARIO --mode actual_postgres_process_integration --checkpoint NAME --release-sha SHA [--repair-review-receipt-hash SHA256] --guard-ref CANONICAL_REF --guard-hash SHA256
execute --campaign-hash SHA256 --case-id CASE --scenario SCENARIO --mode live_operational --checkpoint NAME --live-action ACTION --release-sha SHA [--repair-review-receipt-hash SHA256] --guard-ref CANONICAL_REF --guard-hash SHA256
reuse   --campaign-hash SHA256 --source-result-hash SHA256 --scenario api_durable_state_restart --mode live_operational --checkpoint accepted_product_durable_state_written --runtime-action restartAcceptedProduct [--repair-review-receipt-hash SHA256] --guard-ref CANONICAL_REF --guard-hash SHA256
```

`guard-scenario` is read-only until it exclusively publishes the short-lived content-addressed guard. It derives the stored loaded campaign and current full final epoch, validates the exact code-owned case/scenario/mode/checkpoint/action tuple, repair eligibility, source-result linkage where applicable, clean executable build, and fresh target/unrelated-owner authority, then binds every subsequent command argument plus one-use nonce and expiry. The immediately following `execute` or `reuse` must receive that exact canonical pair, freshly resolve and rehash it, require byte equality with its parsed argv/current epoch/build/authority, and atomically consume it immediately before the first C stage, child process, service/runtime action, or workflow mutation. A response loss after consumption recovers only the already persisted coordination/inflight/action authority; it never reuses or remints the guard. Expired, replayed, copied, cross-case, cross-command, argument-drifted, source/build/epoch/owner-drifted, or concurrently consumed guards fail before mutation. CLI and source-boundary tests require the adjacent `guard-scenario -> execute|reuse` pair and reject an unguarded executor call, a guard supplied after staging, or any optional/bypass/default guard path.

The observation-only recorder CLI starts only through `createRecoveryEvidenceCliDependenciesV1({campaignHash})` and `runRecoveryEvidenceCliV1(argv,dependencies)`. The dependency object contains one complete exact `RecoveryEvidenceAuthorityDependencies` under `evidenceAuthority`: authenticated D `loadedCampaign`; fixed source-golden campaign resolver; fixed source-link resolver; B result store; D action-receipt resolver; C post-PR action-receipt resolver; C repository-workflow-evidence resolver; process-fixture receipt resolver; and a read-only `RecoveryAcceptedProductRuntimeResolverV1`. Production composition wraps the accepted-product port as a frozen resolve-only object and exposes no `restartAndVerify`. The remaining CLI members are the projection observer, attempt store, and ownership observer. It does not contain or construct `RecoveryScenarioExecutorV1`, `RecoveryActionPort`, `RecoveryProcessFixturePort`, `RecoveryAcceptedProductRuntimePort`, `GoldenHarnessPorts`, assertion dispatcher, lifecycle checkpoint, starter/admission, GitHub mutation port, or service/process restart seam.

`verify` and `verify-campaign` always pass the exact `dependencies.evidenceAuthority` to `verifyRecoveryScenarioEvidenceAuthority(...)` for every selected attempt, not only the simple live scenarios. Scenario 6 must therefore fresh-resolve C workflow evidence and post-PR action authority. Scenario 10 must fresh-resolve the `(D campaign,epoch)` source link, linked source campaign, B result, and accepted-product source authority through the resolve-only runtime member. A partial dependency object, a direct store-only shortcut, a pure-verifier-only path, or a scenario-specific omission fails closed. `capture-before` accepts the newly started run ID because a terminal `GoldenRunResultV1` does not exist yet, captures the exact checkpoint-bound target identities plus all-zero unrelated ownership, and later requires those target identities to authenticate to the enclosing lifecycle/process/action receipts. `capture-after` resolves and validates `--golden-result-hash` through the exact authority composition, requires the resolved run ID to match the evidence/before checkpoint and requires campaign/epoch to match either D directly for scenarios 3/4/6 or the current authenticated source link for scenario 10, resolves the applicable D or C action receipt, and only then finalizes the attempt evidence. For `typed_terminal`, the CLI first narrows `--scenario` to `provider_quota_failure | github_review_retry`, accepts one exact code, and derives its owner from `RECOVERY_TYPED_TERMINALS_V1[scenarioId]`; it rejects a caller owner, any typed-terminal flag for scenarios 1–4/7–10, or a code not in that finite scenario set. It uses `health(service)`, `syncProject(runId)`, `snapshots(runId)`, and `renderRun(runId, timeoutMs)` on the existing projection observer. It also queries direct PostgreSQL state and exact process/port/worktree ownership readers. It writes immutable evidence and attempt-chain receipts at the content-addressed paths above; it never overwrites a scenario file. `attempt-history` performs a read-only chronological resolution and emits failed/polluted history plus the selected attempt without inferring latest. `resolve-golden` calls only `listCampaign()` and `get()` and writes a bounded control receipt.

`link-source-golden` runs only after `prepare-campaign` has produced the stable D hash. It accepts only that hash, resolves the current accepted C matrix receipt and stored `api-result-hash` control internally, verifies the exact final epoch/source campaign/case/result/run, and calls `createRecoverySourceGoldenLinkStoreV1().linkCurrentApiResult(...)`. It content-addresses one immutable receipt and atomically creates the `(recoveryCampaignHash, epochHash)` index. It accepts no source campaign/result/case/run/epoch/link body or path; equal authority is idempotent and a different link for the same index collides.

`record-process-repair` calls only `createRecoveryRepairReviewAuthorityV1().observe(...)`. It derives the failed attempt's stored `systemicRootHash`, resolves the merged PR and independent review, runs the fixed repository-specific focused/broad/build commands, and stores the content-addressed receipt plus the unique ``recovery/${campaignHash}/repair-review-index/${scenarioId}/${failedEvidenceHash}/${systemicRootHash}.json`` index. It accepts no root hash, command, cwd, environment, review/check/build result, source SHA, evidence body, or output path. Before a retried actual-process `execute`, the narrow executor derives the previous stored failure/root, resolves this D receipt, atomically consumes it, and binds the receipt/consumption hashes to the new attempt. It rejects scenario 10, a repair flag on a first attempt, an unnecessary repair after selectable evidence, the wrong repair family for the mode, and any start whose cumulative derived root has already occurred three times.

`record-live-repair` is D's path-free adapter only for scenarios 3, 4, and 6 when the exact stored B result is itself nonaccepted. Its sole production dependency factory is `createRecoveryLiveRepairReviewDependenciesV1()`, which calls C's exact `createGoldenRepairReviewObserverV1()` once and returns that same `GoldenRepairReviewObserverV1` by reference; D declares no lookalike observer or scenario union. It resolves the authenticated private `LoadedGoldenCampaignV1` from `--campaign-hash`, resolves the failed evidence/result/root and current epoch from fixed stores, rejects B `classification:"accepted"`, and resolves the merged owning PR into its canonical URL and merge SHA. It calls exactly `goldenRepairReviews.observeAndRecord({loaded,failedResultHash,scenario:{kind:"repository-repair",owningRepository,repairPullRequestUrl,repairMergeSha}})`. C authenticates loader-owned `loaded`, derives campaign scope/case/result/root/epoch internally, delegates its fixed observer/store, and returns `GoldenRepairReviewReceiptV1`. D never passes a caller case or coordination scope. The CLI accepts no campaign file/path, C matrix flag, trusted cause, root, disposition, merge SHA/URL, command, cwd, environment, verification-authority hash, receipt bytes, or output path. C writes/indexes its normal content-addressed repair receipt; D stores no copy. The next qualifying live `execute` resolves and consumes that C receipt once before starting. Tests cover each eligible live scenario and prove scenario 10 or any accepted B result is rejected before the C observer call.

`record-accepted-product-repair` is the source-repair surface for scenario 10. It resolves the stored failed `api_durable_state_restart` evidence and derives the exact D failure tuple plus stable semantic root from authenticated runtime/action receipts, never from the accepted B result. It reopens the failed epoch/link/result, authenticates the merged PR and verification authorities, resolves C's complete accepted Profiles 1–7 matrix receipt by its code-located canonical ref/hash on the distinct receipt-derived `nextFinalReleaseEpoch`, derives the exact accepted Profile 1–3 result tuple from that receipt, creates/reopens that epoch's source link, and calls only `createRecoveryAcceptedProductRepairReviewAuthorityV1().observeSourceRepair(...)`. The D-owned receipt and fixed unique index remain keyed by `(campaignHash,failedEvidenceHash,systemicRootHash)` but bind both exact epochs, links, accepted source-result hashes, and the full successor matrix ref/hash/final epoch. The old accepted result is never replaced, mutated, or reclassified; the next result is a separately stored accepted B result and must be the API member of the next link. `record-accepted-product-infrastructure-remediation` is the only unchanged-epoch surface. It accepts no remediation identity, calls `observeInfrastructureRemediation(...)`, and succeeds only when the fixed resolver authenticates the exact failure tuple and failed/next epoch, link, and result are all byte-identical. Before scenario-10 `reuse`, D resolves the repair through `resolveByFailure(...)`, freshly calls C's exact matrix resolver for a source-repair member, revalidates its accepted full matrix/epoch/Profile 1–3/source-link/API relations, atomically consumes the complete failed/next transition plus matrix identity, and records `kind:"d-accepted-product-repair"`; source repair retries with `nextSourceResultHash`, while infrastructure remediation retries with the unchanged source result and null matrix fields. Both commands accept no root, epoch, source result/link, matrix pair, receipt, check, remediation ref, path, command, or authority override, and neither calls C's nonaccepted-result repair observer.

`advance-campaign` is the only orchestration surface Subproject E may call after E changes either source SHA. It validates the supplied pair as the current clean synchronized B epoch, requires C's full Profile 1–7 matrix accepted for that epoch, constructs the sole `RecoveryScenarioExecutorV1`, consults the immutable attempt/repair indices, and advances at most one missing D scenario attempt per invocation. It accepts no case, scenario, action, checkpoint, result, disposition, root, receipt, port, or dependency override. Its bounded JSON reports only campaign hash, epoch hash, prior/next state, executed scenario or preflight-refusal hash, and whether another invocation is required. Repeated calls finish ten same-epoch selections; any source drift invalidates that epoch and restarts the full C matrix plus ten-slot D progression while retaining all prior evidence and cumulative root history.

All production fixed-root stores begin at B's `resolveInternalProductionDataRootV1()` result, never at package-local runtime state, a source package directory, current worktree, or `cwd`. They create mode-`0700` descendants one component at a time, lstat and realpath each component, open files with `O_CREAT|O_EXCL|O_NOFOLLOW` at mode `0600`, reject link counts other than one, fsync before rename, and re-check containment after rename. No CLI flag, environment value, dependency interface, or public factory accepts a root, filename, absolute path, or `file://` ref. Tests inject only B's unexported fresh temporary data-root port and prove two simulated Setfarm worktrees resolve the same production-private identity.

`assert-zero-owners` invokes only zero-input `observeRecoveryCompleteZeroOwnerCensusV1()`, requires every exact A census field to be zero, emits the exact path-free `InternalProductionCompleteZeroOwnerCensusObservationV1`, and performs no lifecycle mutation or durable publication. It accepts no observer, body, ref, hash, root, or dependency override. D may use this command as read-only delivery evidence; E imports and calls A's observer directly for its own initial/final checkpoints and never consumes D CLI output.

`list-live-run-ids` asynchronously verifies all scenario receipts and emits the sorted unique golden plus live-operational run IDs only. `reconcile-live-surfaces` performs the Task 9 exact PostgreSQL/API identity-set and count comparisons and, for every verified live run ID, captures the Setfarm operational-snapshot hash, Mission Control reconciliation hash/result, Product Build Authority response hash/disposition, and exact run-ID bindings. It stores bounded response hashes plus ordered ID sets below the B-rooted fixed ``recovery/${campaignHash}/reconciliation/live-surfaces.json`` child and emits only its canonical receipt. `browser-acceptance` owns the fixed route list, captures only bounded state/screenshot/console hashes below the campaign browser directory, and includes the stored scenario-3/4 browser receipt hashes plus active/failed/cancelled/completed terminal-page hashes. `verify-browser-acceptance` re-resolves all refs/hashes and rejects a missing terminal class, run-ID drift, absent restart continuity receipt, console error, or accessibility failure.

`finalize-packet` is the zero-owner private finalization phase and never writes a tracked file. Immediately before publication it calls zero-input `observeRecoveryCompleteZeroOwnerCensusV1()` and refuses unless every exact A census value is zero and the returned registry/map/phase-activation/reservation/owner identity hashes are current. It mints no guard and stores only that observation hash in the finalization. It also requires exactly ten immutable selections to resolve to ten selectable attempt/evidence authorities—one per scenario—while every failed/polluted historical attempt remains retained and every action/browser/reconciliation ref, supplied source SHA, clean source observation, and built artifact hash passes asynchronous verification. It deterministically renders two distinct UTF-8 Markdown documents once: `renderRecoveryMatrixMarkdownV1(...)` produces the exact bytes later registered as `recovery-matrix.md`, while `renderRecoveryReconciliationMarkdownV1(...)` produces the exact bytes later registered as `recovery-reconciliation.md`. Neither renderer serializes JSON or places JSON object bytes inside a `.md` authority. Matrix Markdown bytes live only at ``${resolveInternalProductionDataRootV1()}/recovery/finalizations/packet-bytes/recovery-matrix-markdown/sha256/${recoveryMatrixMarkdownHash.slice(0, 2)}/${recoveryMatrixMarkdownHash}.md`` and reconciliation Markdown bytes only at ``${resolveInternalProductionDataRootV1()}/recovery/finalizations/packet-bytes/recovery-reconciliation-markdown/sha256/${recoveryReconciliationMarkdownHash.slice(0, 2)}/${recoveryReconciliationMarkdownHash}.md``. Their refs are exactly `setfarm://internal-production/recovery/finalized-packets/recovery-matrix-markdown/sha256/${recoveryMatrixMarkdownHash}` and `setfarm://internal-production/recovery/finalized-packets/recovery-reconciliation-markdown/sha256/${recoveryReconciliationMarkdownHash}`. The receipt remains at its fixed content address; `finalizationHash` omits only derived `finalizationHash`/`finalizationRef`, and the strict parser/resolver reopens both `.md` byte streams, parses each exact Markdown grammar, recomputes both hashes/sizes/refs and receipt identity, and rejects JSON-first bytes, a leading `{`/`[`, wrong heading/table/section order, invalid escaping/newline, cross-swapped ref/hash, unknown field, collision, or tamper. Equal bytes are idempotent. The JSON CLI output reports the strict receipt metadata only, never either Markdown body, and accepts no path, bytes, root, target, or owner override.

`allocate-packet-review-observation` creates one unpredictable mode-`0600` inbox member below the fixed B-rooted `recovery/${campaignHash}/packet-reviews/inbox/` directory and returns its local path once plus a canonical observation ref; no command accepts a local path. The independent reviewer writes the strict bounded observation there. `record-packet-review` accepts only the campaign hash and canonical observation ref. It reopens the current immutable `RecoveryFinalizedPacketV1`, requires the observation to bind that exact campaign, complete final epoch, finalization ref/hash, both exact Markdown hashes/refs, and a bounded unique finding set, then independently reruns `verify-campaign`, the asynchronous authority verifier for all ten selections, reconciliation/browser verification, both Markdown parser/render round trips, and deterministic private `finalize-packet`. The code derives the rerun hashes; none is accepted from the observation or CLI. Critical/High/Medium findings must be resolved by exact canonical ref/hash, informational findings may omit resolution, and final `verdict:"clear"` requires zero unresolved Critical/High/Medium.

Only the recorder can mutate packet-review authority. After reopening the allocator-owned observation and independently deriving every rerun hash, its private verifier mints one deeply frozen `RecoveryVerifiedPacketReviewCapabilityV1`; an unexported `WeakMap` binds that exact object identity to the verified campaign/finalization/epoch/findings/rerun payload. The unexported store writer authenticates that capability, consumes it once, runs `parseRecoveryPacketIndependentReviewReceiptV1(...)`, derives `reviewHash` by omitting only `reviewHash`/`reviewRef`, derives the sole canonical ref `setfarm://internal-production/recovery/packet-reviews/sha256/${reviewHash}`, and publishes canonical bytes at `packet-reviews/sha256/${reviewHash.slice(0,2)}/${reviewHash}.json` using unpredictable temp, file fsync, atomic no-replace publication, parent fsync, and `O_RDONLY|O_NOFOLLOW` reopen/fstat/re-hash. No exported store, `put`, writer factory, receipt-body input, or capability mint exists; `recordRecoveryPacketIndependentReviewV1({campaignHash,observationRef})` is the only public mutation function. A structural clone, serialized capability, caller-authored clear receipt, or direct forged `verdict:"clear"` cannot reach publication. It then consumes the observation.

The public surface after recording is only `createRecoveryPacketIndependentReviewResolverV1()`. Its read-only `resolve({reviewRef,reviewHash})` opens exactly that content address, never scans, and reruns every packet/epoch/finding/resolution/rerun relation; `resolveByFinalization(...)` opens only the exact fixed campaign/finalization binding and then the named content address. Crash tests cover every capability-consumption/publication/index/unlink boundary. A console transcript, reviewer prose, deleted inbox observation, or forged in-memory receipt is never review authority.

`record-operational-acceptance` is D's named phase boundary. It runs only after all ten same-epoch selections, asynchronous reconciliation/browser verification, a fresh zero-input `observeRecoveryCompleteZeroOwnerCensusV1()` all-zero observation, private finalization, and the strict independent packet-review receipt are complete. It resolves those authorities from the fixed campaign stores, writes one immutable content-addressed `RecoveryOperationalAcceptanceV1`, and returns only its canonical ref/hash. The receipt repeats the exact final epoch, ten ordered selection hashes, reconciliation/browser hashes, exact A zero-owner observation hash plus registry/map/phase-activation/reservation/owner identity hashes, `RecoveryPacketIndependentReviewReceiptV1.reviewRef`/`reviewHash`, private finalization ref/hash, and both exact Markdown hashes. Its identity hash omits only derived `acceptanceHash`/`acceptanceRef`, then derives the one canonical ref; `createRecoveryOperationalAcceptanceResolverV1().resolveByRef(...)` recomputes both and reopens/rehashes every dependency, including both Markdown parsers and a fresh call to the packet-review resolver. It contains no D zero-owner guard pair, documentation SHA, docs-session identity, materialization identity, or E final-closure identity, so E can consume it before any tracked docs exist and no phase cycle is possible.

`RecoveryDocsDeliveryAcceptancePortV1` is D's one-way future-consumer boundary for the distinct later gate. D source exports only its strict input/receipt schema, the port, and `createRecoveryDocsDeliveryAcceptancePortV1()`; its concrete content-addressed store is private. D imports no E module, post-handoff receipt type, resolver, final-closure type, or command. Production `record(...)` accepts a D-owned `RecoveryDocsDeliveryAcceptanceInputV1` only after the future E adapter has resolved its own handoff authority. D then independently resolves the named operational acceptance and B docs-session completion receipt, derives D's recovery-matrix and recovery-reconciliation Markdown hashes from its own finalization, requires their exact B owner-kind/content relations plus operational/documentation/session relations, and records `RecoveryDocsDeliveryAcceptanceV1`. Its identity hash omits only derived `deliveryHash`/`deliveryRef`; `resolveByRef(...)` recomputes both. It cannot authorize D operational evidence, private finalization, E fleet admission, or a new epoch. The operational receipt remains the sole D authority consumed by E; the docs-delivery receipt is only the final delivery acknowledgement. Unit tests inject a fake `RecoveryDocsDeliveryAcceptancePortV1` without importing E and source-boundary tests fail any D import whose module or symbol contains `final-closure`, `post-handoff`, or an E-owned resolver.

`verify-materialization` is read-only and is valid only after the final docs claim materializes the private packet. `createRecoveryMaterializationAuthorityResolverV1().resolveByCampaignHash(...)` follows the fixed campaign pointer, resolves the private receipt through its exact `finalizationRef`, rehashes that receipt and both tracked Markdown targets, parses each exact Markdown grammar, and requires the recovery-matrix/recovery-reconciliation hashes, recorded source pair, and literal target/basename mapping. A missing/corrupt pointer, cross-campaign receipt, ref/hash drift, JSON-first content, cross-swapped document, source drift, wrong target, or tracked-byte mismatch fails. Before final docs materialization, D returns its private `finalizationHash` and `finalizationRef` controls only; it must not fabricate a materialization authority. In the full A–E program, D defers `materialize-finalized-packet` until E's final Setfarm-owned docs claim so there is one final-source materialization.

`materialize-finalized-packet --finalization-hash HASH` remains the narrow standalone Setfarm-docs-claim surface and sole standalone tracked writer. It accepts only one validated SHA-256 plus optional `--json`; it derives and resolves the exact canonical finalization ref and constructs no run, scenario, action, browser, PostgreSQL, global-owner, settlement, or build runner dependency. It reopens the private receipt and both Markdown streams with `O_NOFOLLOW`, parses their distinct grammars, recomputes the receipt/ref/finalization/hash/size relations, requires the active clean docs-claim base SHA to equal the recorded Setfarm source SHA, requires current clean Mission Control to equal the recorded Mission Control source SHA, and read-only rehashes the two recorded build artifacts. It then derives its isolated D-only generation directory and writes the recovery-matrix bytes only as `recovery-matrix.md` and reconciliation bytes only as `recovery-reconciliation.md` by mode-safe sibling temporary files plus fsync/atomic rename, refusing JSON-first or cross-swapped bytes, an existing different file, or any other basename and accepting identical bytes idempotently.

For the full A–E final claim, `materializeFinalizedRecoveryPacketInSessionV1({finalizationRef,session})` instead resolves the authenticated finalization ref and calls B's exact `commitNextGoldenDocsMaterializationEntryV1(...)` twice, in order. The first call is exactly `{ownerId:"d-recovery-reports-v1",expectedKind:"recovery-matrix",session,reopenOwnerContent}` and the second differs only by `expectedKind:"recovery-reconciliation"`. Each zero-argument callback freshly resolves the named D private finalization receipt and its corresponding immutable private byte stream, recomputes that stream's content hash, and returns exactly `{bytes:Uint8Array,contentHash}`. It performs no session-path, generation, suffix, basename, absence, prefix, ordinal, or expected-hash validation. B authenticates the live WeakMap session and exact next registered owner/kind/content hash, requires an exact ordinary-`ArrayBuffer`-backed `Uint8Array`, synchronously copies it immediately after the callback resolves and before another await or side effect, hashes/writes only that copy, and owns its private mutex plus expected-session-hash/ordinal CAS. A Buffer, subclass, `SharedArrayBuffer`-backed view, extra callback key, reentrant call, or changed callback bytes fails inside B. B returns the exact path-free `GoldenDocsMaterializationEntryCommitReceiptV1`; D returns those receipts as `{matrix,reconciliation}`. D never reads, authenticates, exposes, or mutates B's private session controller, never constructs or receives a session entry path, never calls a raw entry writer, and never advances after a callback/hash/kind/owner mismatch. It cannot accept a bare hash in session mode, begin or complete the session, reorder entries, write another target, or run standalone beside the session. E begins the session; the exact composition is C's registered entry, D's two entries, B's registered fleet entry, then E's two entries, after which E completes the session. Neither mode reruns builds or zero-owner verification because the docs claim owns the worktree. Execute, capture, verify, reconciliation, browser, and private-finalization code never imports or calls a materializer; Setfarm owns its resulting Git/PR handoff.

Public `capture-before`/`capture-after` accepts only `mission_control_active_run_restart`, `dashboard_active_run_restart`, `github_review_retry`, and `api_durable_state_restart`. Every narrow crash/owner/provider/supervisor scenario fails with `RECOVERY_PROCESS_FIXTURE_REQUIRED`; it cannot be approximated by polling.

`createInternalProductionRecoveryCompositionV1()` is the sole production recovery composition factory and the only production caller that can execute B's harness. It calls C's `createGoldenMatrixPortsV1()` exactly once and consumes that returned object by reference: C's fixed harness/repository and workflow-evidence collector, profile assertion dispatcher, result-store history, clock, `postPrReviewActions`, repair-review resolver, and repair-consumption port cannot be replaced, wrapped by caller input, or reconstructed by D. It constructs C's read-only `createGoldenPostPrReviewActionReceiptResolverV1()` and exact `createGoldenRepositoryWorkflowEvidenceResolverV1()` once for asynchronous scenario-6 verification and injects both into `RecoveryEvidenceAuthorityDependencies`; callers cannot inject, replace, or wrap either resolver.

For scenarios 3 and 4 only, D constructs one narrow `GoldenServiceRestartActionPortV1` adapter over its existing guarded `RecoveryActionPort`; D never constructs, brands, casts, or structurally declares a lifecycle checkpoint. The adapter's sole `restart({implementationId,campaignHash,caseId,runId,runNumber,finalReleaseEpoch,generation})` method accepts only the scenario-matching implementation ID, begins the already required browser continuity observation, delegates the one side effect through D's shared restart authority, and returns B's exact `GoldenServiceRestartActionReceiptV1`: schema, implementation/campaign/case/run identities, full epoch, generation hash, D restart operation hash, distinct `beforeServiceAuthorityHash`/`afterServiceAuthorityHash`, literal `restartCompleted:true`, bounded canonical evidence refs, and receipt hash. It accepts no raw checkpoint, label, command, service, port, path, action hash, or caller receipt body.

D passes that exact adapter and the scenario literal to B `createGoldenRegisteredExternalLifecycleCheckpointV1({implementationId,actions})` and receives B's opaque branded `GoldenRegisteredExternalLifecycleCheckpointV1` by exact object identity. Its only public members are `kind:"registered-external-lifecycle-checkpoint"`, `implementationId`, and `registrationHash`; B retains its controller in a private WeakMap. The object neither extends nor exposes `GoldenLifecycleCheckpointPort`, and D cannot call a predicate or `tryAction`. D supplies only that returned object to `createGoldenExternalLifecycleCheckpointCapabilityV1({campaignHash,caseId,namespace:"recovery-active-run",finalReleaseEpoch,checkpoint})`. The caller supplies no epoch hash, implementation hash, predicate hash, checkpoint body, or capability hash. B authenticates the registered checkpoint and derives the exact full epoch/`epochHash`, implementation identity (`mission-control-active-run-restart-v1` for scenario 3 or `setfarm-dashboard-active-run-restart-v1` for scenario 4), implementation hash, predicate hash, and capability hash from its finite registry; D authenticates the returned opaque object and calls C `createGoldenRecoveryAssertionEnabledCaseExecutorV1({ports:matrixPorts,lifecycleCheckpointCapability})`. C validates campaign/case/namespace, full epoch, implementation identity/hash, and predicate hash before stage and again before prepared continuation and receives no raw checkpoint. Scenario 6 uses C's ordinary assertion-enabled executor and its fixed `createGoldenPostPrReviewLifecycleCheckpointV1({actions:matrixPorts.postPrReviewActions})`; D does not inspect, proxy, store, or implement that action. Every other C harness/assertion/history/clock/workflow-evidence member remains the identical object. Actual-process scenarios use only the process fixture plus D's process receipt/repair authorities; scenario 10 uses only the accepted-product runtime and stored B result.

The recovery scenario CLI receives one narrow `RecoveryScenarioExecutorV1` from this production factory. It accepts no `GoldenHarnessPorts`, `GoldenMatrixPorts`, assertion port, history/store replacement, clock, lifecycle checkpoint, lifecycle capability, capability hash, GitHub/action port, workflow-evidence collector/resolver, repository, starter, or raw dependency override. Tests may use one unexported fixture constructor. Source-boundary tests require B's exact `GoldenExternalLifecycleCheckpointImplementationIdV1`, `GoldenServiceRestartActionPortV1`, `GoldenServiceRestartActionReceiptV1`, `GoldenRegisteredExternalLifecycleCheckpointV1`, `GoldenExternalLifecycleCheckpointCapabilityV1`, `createGoldenRegisteredExternalLifecycleCheckpointV1`, `createGoldenExternalLifecycleCheckpointCapabilityV1`, and authenticator only from `./golden-run-harness.js`, and C's exact `createGoldenRecoveryAssertionEnabledCaseExecutorV1` only from `./golden-matrix-runner.js`. They require the sequence `create exact D action adapter -> call B registered-checkpoint factory once -> retain exact branded object -> create B capability with full finalReleaseEpoch -> authenticate same object -> assert derived epoch/implementation/predicate identities -> call C recovery factory -> persist capabilityHash before stage` only in scenarios 3/4. Compile/runtime fixtures pin the exact restart method input and complete B receipt fields, require strict adapter/checkpoint/capability object identity, and prove D cannot construct a checkpoint itself. They allow `createGoldenPostPrReviewLifecycleCheckpointV1(...)` only inside C's scenario-6 executor and reject a D-local registered-checkpoint type/factory/wrapper, cast/structural clone, raw `lifecycleCheckpoint` override, structural capability, direct B harness assembly, caller epoch hash/implementation ID/implementation hash/predicate hash/capability hash, wrong campaign/case/run/run-number/namespace/epoch/generation/registry implementation, incomplete action receipt, or C factory use for another scenario. They retain the unaliased `GoldenRepositoryWorkflowEvidenceResolverV1`/factory import requirements, forbid a D-local resolver/cache or GitHub mutation client/`GoldenPostPrReviewActionPortV1`, and prove object identity for every inherited C member.

The scenarios 3/4 capability hash is non-null in `coordination-persisted`, is copied unchanged through `staged` and `result-bound`, and is repeated by `RecoveryScenarioEvidenceV1.lifecycleCheckpointCapabilityHash`; every resolver recomputes/equality-checks it against the freshly authenticated capability before selection, verification, and finalization. The authenticated capability's `finalReleaseEpoch` and `epochHash` must equal the status/evidence epoch; implementation ID must equal the scenario-specific registry literal above; and implementation hash/predicate hash must equal B's reminted registered-checkpoint identity. Scenario 6 and every process/source-only scenario require null. On any crash, a fresh process recreates the exact D action adapter, calls B's registered factory with the stored implementation ID, requires the returned brand/registration hash, remints the B capability through the exact factory with the stored full epoch, authenticates that object, requires every public identity plus its hash to match status/scenario authority, and only then reconstructs C's recovery executor around the stored staged authority. It never calls or reconstructs a checkpoint predicate/action controller, accepts a caller capability/hash/derived member, structural clone, different checkpoint, or new coordination.

The composed executor has two explicit modes. `live_operational` calls C's exact `prepareGoldenStageCoordinationV1({loaded,caseId,setfarmSha,missionControlSha})`, persists and reopens that strict `GoldenStageCoordinationV1` plus its local canonical status ref/hash, and only then calls C's idempotent `stage({loaded,caseId,setfarmSha,missionControlSha,coordinationRef,coordinationHash})`. It exhaustively switches on the exact imported `GoldenAssertionEnabledStageOutcomeV1` and passes the unchanged union member to `persistStageOutcome(...)` before any next call. Only `kind:"staged"` expected-predecessor advances status with `outcome.staged`, reopens it, verifies its `coordinationHash`, and calls `executeStaged({staged:outcome.staged})`; C remains the sole delegate to B's execution. C in turn uses B's exact `executePreparedGoldenCaseV1({prepared,ports})` for a fresh prepared continuation and `recoverPreparedGoldenCaseV1({prepared,ports})` for lookup-only recovery; both return B's exact `GoldenPreparedExecutionOutcomeV1 = Extract<GoldenCaseExecutionOutcomeV1,{kind:"pre_run"|"run"}>` and neither reruns preflight or capacity. D never imports or calls either prepared continuation directly. `kind:"pre_run"` first resolves C/B's already immutable `resultRef`/`resultHash` through the exact B result store, requires strict `kind:"pre_run"` plus matching campaign/case/repetition/launch ordinal/epoch, persists `state:"pre-run-result"`, and returns the finite configuration-failure status without a run, launch, lifecycle action, service restart, `executeStaged`, or `recoverStaged`. `kind:"blocked"` persists `state:"blocked"` with C's exact `GoldenBlockedPreflightResultV1`, stores no result, and returns `RECOVERY_LIVE_GOLDEN_STAGE_BLOCKED` without intent/outbox/run/action mutation. D live scenarios require the staged branch for selectable execution and fail closed before any scenario mutation on either other branch.

Whenever D consumes B's public execute boundary in contract/composition coverage, it types the value as the exact imported `GoldenCaseExecutionOutcomeV1` and exhaustively narrows its outer discriminant: `kind:"pre_run"` and either blocked-preflight kind fail before live evidence or scenario mutation, while only `kind:"run"` narrows to the exact imported `GoldenStartedRunResultV1`. The live evidence projection copies only real B fields: `subject`, `run`, `classification`, `classificationReasonCode`, `rootCauseHash`, `terminalEvidence`, their campaign/case/profile/prompt/repetition/attempt/final-epoch identity, observation disposition, and result hash. It invents no `runIdentity`, `trustedFailure`, or structural `Pick` over keys absent from B.

A crash after C's stage-operation outcome is durable but before D's outcome-status CAS repeats `stage` with the same stored coordination and adopts the byte-identical discriminated outcome: the same staged object, the same pre-run result pair, or the same blocked preflight. It never prepares another coordination or B intent/outbox. Scenario 3 supplies `{kind:"active-run-generation",actionId:"restart-mission-control",requiredRunStatuses:["running","resuming"]}`; scenario 4 changes only `actionId` to `restart-setfarm-dashboard`. Scenario 6 consumes C's checkpoint predicate `{kind:"actionable-post-pr-review-generation",actionId:"publish-golden-actionable-post-pr-review",requiredRunStatuses:["running","resuming"],requiredWorkflowStepId:"post-pr-review",requiredGenerationKind:"workflow-step-claim-generation"}` unchanged. B calls the selected checkpoint only while its exact generation is non-terminal and accepts one receipt with exact run/run-number/generation/predicate/action/operation identity and bounded canonical refs. D records the returned lifecycle fields including exact `actionOperationHash`, and records C's action receipt hash/ref as C-owned authority, but creates no second receipt or store. The initial shell never calls `collect` by case/run. `actual_postgres_process_integration` never polls a live run hoping to catch a narrow boundary. It invokes the isolated-PostgreSQL child-process fixture described below, which reaches the owning source boundary synchronously, emits one authenticated campaign/run/generation-bound checkpoint receipt, stops, is restarted or faulted, and then proves canonical recovery. Scenario 10 consumes the accepted API result through `sourceResultHash` and starts no workflow.

The imported coordination's exact strict body includes campaign/case/repetition/full epoch, C's code-owned bounded `launchAttemptOrdinal:number`, and canonical ref/hash. D never accepts, derives, or rewrites the ordinal. Response-loss recovery reuses the same pair and therefore the same ordinal; a separately admitted reviewed retry calls C prepare again and must receive a distinct C-owned ordinal/address rather than reusing prior coordination.

If the process dies after outcome-status publication, the exact recovery form is `recover-live-inflight --campaign-hash SHA256 --status-ref CANONICAL_REF --status-hash SHA256 --json`. A fresh process resolves and rehashes that status and exhaustively dispatches its state. Only `staged` authenticates the campaign/full epoch and embedded C staged object, calls C `recoverStaged({staged:status.staged})`, then expected-predecessor-binds the returned result ref/hash. `pre-run-result` freshly reopens its exact immutable B configuration result and returns the same finite failure status; `blocked` revalidates and returns the same exact preflight/blocker; neither calls C/B execute, recover, collect, result put, or any scenario action. A `result-bound` retry reopens the same pair byte-identically. The command accepts no case, scenario, run ID/number, release SHA, Mission Control SHA, C inflight/outcome body, result, path, or environment fallback; it never calls C/B `collect` with a case/run remembered by the dead shell, starts a replacement, or infers a current status. Missing/tampered status, wrong campaign/epoch, outcome/state/null-relation drift, staged/status ref/hash drift, a second result, direct `executeStaged` during recovery, or caller case/run flags fail closed.

Use these exact realizable seams:

| Scenario | Mode | Owning source/test seam |
|---|---|---|
| `spawner_pre_transfer_restart` | actual PostgreSQL/process | `src/spawner.ts`: immediately after `claimStep(...)` and before `postClaimOwnershipTransferred = true`; fixture exercises `releaseUntransferredPostClaimOwnership(...)` and a fresh child process. |
| `completion_owner_pre_effect_restart` | actual PostgreSQL/process | `src/execution/runtime-completion.ts`: durable `apply_phase='owner_committed'`; fresh child resumes through `src/execution/runtime-completion-effect-runner.ts`. |
| `mission_control_active_run_restart` | live operational | Subproject B one-shot lifecycle checkpoint opens the exact Mission Control run route, begins one-second browser polling, then restarts only `com.setrox.mission-control`; the action returns only after reconnect and a valid same-run visible-state sample. |
| `dashboard_active_run_restart` | live operational | Subproject B one-shot lifecycle checkpoint opens the exact Mission Control run route, begins one-second browser polling, then restarts only `com.setrox.setfarm-dashboard`; the action returns only after dashboard HTTP recovery and a valid same-run visible-state sample. |
| `provider_quota_failure` | actual PostgreSQL/process | One-shot injected provider adapter modeled on `tests/spawner-gateway-recovery.test.ts`; first call returns typed 429/quota, second uses the admitted fallback. |
| `github_review_retry` | live operational | The real bug-fix `post-pr-review` fixer step runs after `pr`; its claim and runtime are published before the C module's bounded pre-claim poll. B observes that exact generation and C's `createGoldenPostPrReviewLifecycleCheckpointV1(...)` calls C's `GoldenPostPrReviewActionPortV1` once. The same claimed step edits allowed scope and submits its exact claim output through `setfarm step complete`; Setfarm's completion owner validates the correction, pushes the same managed PR branch, and revalidates the new head/thread/test authority. |
| `runtime_crash_cleanup` | actual process | Exact process-group identity and SIGTERM behavior from `tests/execution-attempts/v3-darwin-runtime-isolation.test.ts`; no arbitrary PID input. |
| `supervisor_generation_safe_retry` | actual PostgreSQL/process | Exact directive/binding from `src/execution/v3-supervisor-retry-directive.ts`, `tests/execution-attempts/v3-implementation-handoff.test.ts`, and claim-runtime publication. |
| `post_owner_exactly_once_recovery` | actual PostgreSQL/process | Existing owner/effect sequence in `tests/execution-attempts/claim-step-v3-recovery.integration.test.ts`; restart before `markEffectsCommitted(...)`, then replay once. |
| `api_durable_state_restart` | live operational | Accepted API product's admitted runtime driver and exact deployment receipt; no workflow checkpoint. |

#### Canonical bug-fix post-PR review gate required by scenario 6

Subproject C must already have changed the prior bug-fix workflow, which ended at `pr`, by adding the genuine production step `post-pr-review`; D must not pretend that a step named `review` exists or add a parallel gate. The C producer changes `workflows/bug-fix/workflow.yml`, its dedicated step module/completion routing source, `src/execution/v3-stage-execution-context.ts`, and focused workflow/head/thread/routing tests. Before D starts, inspect the merged files and require exactly: `post-pr-review` follows `pr`, uses the fixer/source-scoped capability, binds the recorded PR URL/head and full declared test command, and owns the bounded actionable review correction on the same claim/runtime and PR branch.

The claim remains a normal production claim. Subproject B exposes exactly the discriminated type shown above. Its workflow-step variant is accepted only when the B repository proves one open story-null claim for workflow `bug-fix`, step ID `post-pr-review`, plus exactly one non-released runtime. `claimGeneration` is the stable one-based claim ordinal for the run/step; `generationHash` binds `runId` and every variant member, including step DB ID, claim ID, runtime session ID, step ID, and ordinal. All feature-development predicates continue to require `story-claim-generation`. More than one candidate claim/runtime, any other story-null step, a stale/released runtime, or a step/head mismatch fails closed. D rejects a scenario-6 receipt unless `generation.kind === "workflow-step-claim-generation"` and `workflowStepId === "post-pr-review"`.

The C-owned module publishes the normal `post-pr-review` claim and runtime before `preClaim`, derives the gate generation from exact `claim_log.claimed_at` plus the one-based run/step ordinal, and polls exact GitHub authority for at most `120 seconds` while that same claim/runtime remains open. The gate reads workflow ID, exact step DB ID/claim/runtime generation, repository URL, PR number, recorded PR head, and exact thread set. When C's action port creates the comment, C persists exact ingestion/finding evidence and supplies the bounded thread contract to the same fixer step. That claimed step edits only manifest-allowed `src/slug.ts` and `tests/slug.test.ts`, runs the declared tests, and submits the exact claim output through `setfarm step complete`; Setfarm's completion owner validates and pushes the same managed PR branch. Completion re-reads the new head and exact thread set and accepts only when the source delta/test authority is valid and the thread is resolved or outdated at that head. No-comment expiry returns typed `no_actionable_review` through the same claimed step. The gate must not classify formatted prose, resolve a thread, forge a database comment, route to the earlier `fix` step, or accept a head without exact re-read. D's entry tests re-run C's source-boundary/integration tests for order `verify -> pr -> post-pr-review`, open claim/runtime during the bounded poll, wrong/stale generation/head rejection, same-step scoped correction, claim-bound step completion, completion-owner same-branch push, test revalidation, and final resolution/outdating at the accepted head.

Scenario 6 owns a distinct immutable campaign template while every execution owns a fresh intent-bound fixture attempt. `prepare-campaign` calls only C `prepareGoldenExistingRepositoryTemplatesV1({campaignId:"internal-production-2026-08-13"})`, selects the returned template whose `seedKind === "bug-fix"`, and embeds that complete path-free `GoldenExistingRepositoryFixtureTemplateV1` into case `recovery-06-bugfix-review`. The checked-in seed remains exactly `tests/fixtures/internal-production/bug-fix/` and the reviewed source path remains exactly `src/slug.ts`, but catalog preparation creates no destination, Git repository, remote, baseline commit, fixture identity, attempt receipt, or workflow capability. The builder validates the complete B `LoadedGoldenCampaignV1`, stores it below the B-rooted fixed `recovery/${campaignHash}/campaign.json` child, and atomically writes the `recovery-campaign-hash` control receipt. `campaignHash` is stable campaign/spec/template identity: `--release-sha` validates the currently requested epoch but is not inserted into the campaign bytes/hash. On execute, B first fsyncs its exact path-free launch intent and then calls C's sole `GoldenExistingRepositoryAttemptProvisioningPortV1.provision({persistedIntent,template})`; only that call creates a fresh private repository/remote and returns the attempt identity consumed by B's launch and workflow inspector. Reopening one persisted intent is idempotent; a separately authorized later intent, retry, repetition, or epoch receives a distinct attempt key, local destination, remote, fixture identity, and provision hash. D accepts no caller path, remote, fixture identity, attempt receipt, or provisioning adapter, and never reuses a C matrix attempt.

C's production action port owns the sole fixed inline body exactly: `Please add a regression that preserves non-ASCII word separation before slug normalization, then update src/slug.ts so the regression passes.` It resolves the immutable seeded failing line in `src/slug.ts`, reauthenticates campaign fixture/open claim/runtime/current PR head, posts literal action ID `publish-golden-actionable-post-pr-review`, re-reads comment/thread authority, and stores `GoldenPostPrReviewActionReceiptV1` in C's existing B-rooted `golden-results/post-pr-review-actions/sha256` store. D accepts no review body, repository, PR, path, line, token, command, HTTP adapter, receipt bytes, or storage override and creates no second action receipt.

#### Strict live action and browser continuity receipts

For scenarios 3 and 4, call `createPlaywrightRecoveryBrowserContinuityPort().begin(...)` inside `tryAction(...)` before the service command, await `awaitInitialSameRunVisibleState()`, then perform the exact argument-array LaunchAgent restart while the session's one-second poll remains active. After target HTTP recovery, call `awaitRecoveredSameRunVisibleState(...)` and close the session in `finally`. The poller uses only `http://127.0.0.1:3080/setfarm/runs/:runId`, verifies the visible canonical run ID on every accepted sample, retains ordered hashes rather than DOM text/screenshots, and keeps sampling across transport failure. `RecoveryActionReceiptV1` is the outer union of three separately discriminated receipt families; it never intersects a generic action authority with an outcome. Each Mission Control, dashboard, and accepted-product member fixes its own action/scenario/service identity and maps every refusal/failure code to exactly one literal boundary. Mission Control and dashboard success alone carry browser continuity; accepted-product success alone carries source/session/durable-read authority. A finite refusal or failure receipt carries only its action-specific authority, exact code/boundary, observed authority, bounded refs, and complete final cleanup census/hash; it never fabricates an after PID/HTTP/browser/session/read sample and always becomes a nonselectable scenario-attempt failure. Scenario 3 success must observe at least one disconnect and one reconnect; scenario 4 success may remain connected but must observe dashboard HTTP unavailability/recovery. The action never owns terminal collection; B resumes its normal poll only after the receipt is returned. Compile/runtime/schema tests cross every outcome and reject a Mission Control code/boundary on dashboard or accepted-product authority, a dashboard service/scenario on Mission Control, `failedBoundary:string`, a generic code union, extra success-only fields on non-success, or any unenumerated code/boundary pair.

For scenario 6, D consumes C's exact `GoldenPostPrReviewActionReceiptV1`: campaign/case/run/run-number, generation/predicate hashes, repository/PR/head, fixed `src/slug.ts` path/line, C body hash, comment/thread identities, literal action ID, bounded canonical refs, and `actionReceiptHash`. The B lifecycle receipt must carry identical run/generation/predicate/action/hash/refs, and the stored golden result's C-authenticated workflow evidence must bind that same receipt and settled post-review authority. D neither adds fields nor re-stores it. For scenario 10, the runtime port produces a source-only receipt keyed by `sourceGoldenCampaignHash`; the D executor wraps its hash in a separate recovery action envelope keyed by D `recoveryCampaignHash`, final epoch, and current `sourceLinkageHash`. Success carries both fresh runtime/read/durable hashes. Typed refusal or failure carries only its finite code/boundary/observed source authority plus complete cleanup; it never fabricates sessions or reads. The strict action-receipt and source-runtime schemas both enumerate `durable_state_verification_failed`. They use the one code-owned mapping `accepted-product-session-b-durable-read` on `RecoveryAcceptedProductRestartReceiptV1` if and only if the matched `RecoveryAcceptedProductSourceRuntimeReceiptV1` uses `durable-state-read`; either boundary with another code, the code with another boundary, or one-sided presence is invalid. `deriveRecoveryAcceptedProductSystemicRootV1(...)` accepts this exact source tuple, normalizes it to the finite accepted-API runtime component, and includes its code/boundary in the stable semantic root while retaining the action boundary only as equality-verified evidence. The asynchronous verifier resolves and rehashes both layers. D-owned service/runtime action receipts are parsed, canonically hashed, stored by hash/ref, resolved again, and matched byte-for-byte; the C-owned scenario-6 receipt is resolved only through C/B's existing authority chain.

#### Authenticated accepted-API runtime rehydration required by scenario 10

`RecoveryAcceptedProductRuntimeAuthorityV1` is an opaque, deeply frozen capability minted by `createRecoveryAcceptedProductRuntimePort()`. The module owns a private `WeakMap` from that exact object identity to the verified checkout path, strict `http-service` `RuntimeEvidenceContractV1`, accepted ProductSpec/API-route projection, and canonical deployment/process/listener records; copying or reconstructing the public identity object does not authenticate it. `resolve(...)` loads `sourceResultHash` through `GoldenRunResultStore.get()`, requires the matrix case/profile to be the accepted `node-express-api` case, and re-collects the same run through `GoldenRunRepository`. It then uses `createRuntimeArtifactReader()` at the code-owned fixed artifact root to audit the exact terminal packet and reconstruct the sealed runtime evidence contract. It resolves the immutable V3 deployment receipt and project-transfer acknowledgement through their canonical repositories. The result, collector, packet, ProductSpec, runtime contract, deployment receipt, transfer acknowledgement, checkout HEAD/tree, and clean worktree must all agree on campaign/case/run/run-number, accepted source SHA/tree, packet hash, runtime-contract hash, deployment ref/hash, project ID, and loopback-only network policy.

`resolve(...)` accepts no path, command, environment, host, port, origin, artifact root, packet object, contract object, or deployment object from its caller. It returns no checkout path or runtime command. Missing, unsealed, non-HTTP, non-loopback, dirty, hash-drifted, released-source, duplicate-listener, or mismatched authority fails before a process or HTTP request exists. The production factory derives the runtime artifact root internally and constructs `createStackRuntimeEvidenceDriver(sealedContract)`; no caller injects an executable. Isolated tests may substitute only repository/driver ports through a non-exported fixture constructor in the test module.

`restartAndVerify(...)` first authenticates the exact capability object and proves no existing live process/listener still owns the deployment receipt. If the original canonical deployed process remains, it may stop only the exact process identity and loopback listener named by that receipt and must observe their release before continuing. It validates that the product-declared durable-state target is a regular non-symlink path contained in the accepted checkout, Git-ignored and untracked; neither the caller nor the recovery CLI supplies that filename. It creates session A with the sealed driver, awaits readiness, POSTs only the profile-declared `/items` route with fixed title `internal-production-durable-state-01`, and GETs only the returned canonical item ID through the declared item-read route. It hashes bounded request/status/body evidence, stops session A in `finally`, verifies that exact process/listener/port lease disappeared, then creates a fresh session B from the same authenticated source and sealed contract. Session B must bind a newly observed process identity, may receive a newly allocated loopback port, reads the same item without rewriting it, and returns the exact same canonical record hash. It stops session B in `finally`, proves zero process/listener/port lease, and re-verifies the original HEAD/tree plus an empty Git status. The receipt binds both session identities, both loopback HTTP observations, source/tree/packet/contract/deployment authority, the durable record hash, and cleanup hashes; it publishes no origin, port, PID, path, response body, or SQLite filename.

For unsafe scenarios `scripts/support/internal-production-recovery-process-fixture.ts` creates a random 32-byte capability and passes it to the child over an inherited pipe, never argv/env. A checkpoint frame is accepted only once and binds `{scenarioId, runId, runNumber, claimId, runtimeSessionId, completionRequestId, generation, childProcessIdentityHash, capabilityHash}`. The parent acknowledges a frame only after a direct PostgreSQL read proves its advertised boundary durable, then pauses or terminates only that owned child. Release requires the matching capability over the pipe; a wrong, expired, replayed, cross-run, or cross-generation capability fails closed. The fixture uses the repository's isolated PostgreSQL runner and real child processes; it exports no production HTTP endpoint, environment flag, or database mutation escape hatch.

The owning production paths receive the port through optional dependencies whose default is `NOOP_INTERNAL_PRODUCTION_RECOVERY_CHECKPOINT_PORT`; no environment variable enables them. `main(dependencies?: SpawnerRuntimeDependencies)` threads the port into `spawnAgentNow(...)`. In `src/spawner.ts`, reach `spawner.claim_published_before_transfer` immediately after the validated `claimStep(...)` result and before child/runtime ownership transfer; reach `spawner.runtime_owned_before_fault` after `runtimeSessions.markRunning(...)` and `activeProcesses.set(...)` agree; and reach `spawner.provider_failure_before_fallback` after typed provider/quota classification and before fallback authorization. `createRuntimeCompletionRepository(sql, options?: RuntimeCompletionRepositoryOptions)` reaches `completion.owner_committed_before_effects` only after the owner/effect transaction has resolved durably and before returning control to effect execution. `runRuntimeCompletionEffectLedger(...)` accepts an optional port and reaches `completion.effect_applied_before_settlement` after `reconcile/apply` returns and before `repository.settle(...)`. `publishLoopClaimRuntime(sql, rawInput, dependencies?: ClaimRuntimePublicationDependencies)` reaches `supervisor.directive_authenticated_before_generation_claim` after the authenticated directive/source-generation checks and immediately before its real publication transaction. The script fixture injects the pausing implementation explicitly and invokes these production paths against isolated PostgreSQL; ordinary services always receive the no-op.

- [ ] **Step 1: Write failing dependency-boundary tests**

Add a compile/AST boundary that requires the exact unaliased static imports of `prepareInternalProductionPhysicalServiceRestartAuthorityCutoverToRecoveryDV1` and `resumeActiveInternalProductionPhysicalServiceRestartAuthorityCutoverToRecoveryDV1` only inside D's reviewed cutover adapter and exact identity imports/re-exports of A's readiness/activation/cutover types, pair-only resolvers, and read-only status observer. Reject a third A mutation import, any A import of D, and every D-local readiness/activation/cutover declaration, schema, store, locator, observer, recorder, writer, structural alias, or publication.

For live stage-outcome coverage, add the three exact C union members to `recovery-scenario-runner.test.ts`, `recovery-evidence-script.test.ts`, and `recovery-live-inflight-store-v1.test.ts`. Also import B's exact `GoldenCaseExecutionOutcomeV1` and `GoldenStartedRunResultV1` in the contract fixture and exercise all three outer B outcomes. `staged` persists/reopens only its exact staged member before one execute and uses only `recoverStaged` after a process loss. A B/C `pre_run` resolves one strict immutable B configuration result, persists its exact ref/hash and finite D blocker, exits `2` with that status, creates no selectable D attempt/evidence, and leaves run/launch/recover/lifecycle/action/restart counters zero. A bare blocked preflight persists the exact `GoldenBlockedPreflightResultV1`, has null result/staged members, exits `2`, and leaves result-store put plus every intent/outbox/run/action counter zero. Only `kind:"run"` is assignable to `GoldenStartedRunResultV1` and may project its actual `subject`, `run`, `classification`, `rootCauseHash`, and `terminalEvidence` into live evidence. Kill after C seals each outcome but before D's CAS; retry the same coordination and require identical outcome/status bytes with no second coordination/result/intent/outbox. Pass each terminal D status to `recover-live-inflight` and prove read-only byte-identical output. Reject a non-exhaustive switch/default fallthrough, treating pre-run as staged/run evidence, selecting either non-staged branch, a local/redeclared execute signature, absent-key `Pick` members `runIdentity`/`trustedFailure`, or calling execute/recover/collect/action after a non-run result.

Test exact argument parsing, content-addressed result resolution, campaign/result/run mismatch, failure when unrelated pre-fault ownership exists, finite scenario-specific `typed_terminal` code/derived-owner requirements, unavailable Mission Control capture as `null`, hash verification, and exclusive fixed-root containment. Assert `RECOVERY_TYPED_TERMINALS_V1` has exactly the two keys `provider_quota_failure` and `github_review_retry`; compile fixtures prove all ten mapped members admit accepted continuation plus attempt failure, scenario 5 admits only its provider terminal, scenario 6 only its review terminal, and every crossed owner/code/scenario or process scenario other than 5 is unassignable. Runtime parsers repeat those checks, reject typed-terminal evidence/selection/matrix/finalization for scenarios 1–4/7–10, and require their exact positive continuation proof. Prove scenarios 3/4 persist the non-null authenticated lifecycle capability hash before C stage, retain exact equality across coordination/staged/result/evidence/restart, and reject a null, structural-clone, changed, cross-case, or cross-campaign capability; every other scenario requires null. Prove the pure verifier performs zero store calls and cannot assert stored authority; prove the asynchronous verifier calls `GoldenRunResultStore.get()` and exactly the applicable D-owned, C post-PR, workflow-evidence, process-fixture, source-link/source-campaign, or accepted-product resolver, rejects missing/tampered objects, and emits stable issue codes. Build `RecoveryEvidenceCliDependenciesV1` in a fresh production composition and assert its `evidenceAuthority` contains all nine exact read-only members with strict object identity. Run `verify` and `verify-campaign` across mixed selections and prove scenario 6 invokes both C workflow/action resolvers while scenario 10 invokes source link, source campaign, result, and resolve-only accepted runtime. Reject a missing member or replacement wrapper. AST tests forbid the recorder CLI/composition from importing or receiving `RecoveryScenarioExecutorV1`, `RecoveryActionPort`, `RecoveryProcessFixturePort`, `restartAndVerify`, B starter/admission/harness, service restart, child process, or GitHub mutation symbols. Prove selectable evidence has only enumerated exact target owners and fully zero after ownership; prove authenticated nonselectable failure round-trips with only reached checkpoints and may retain a nonzero cleanup census without being selected. Assert the four existing observer methods are used and the recorder CLI never calls `executeGoldenCaseV1(...)`. Inject spies and assert no recorder method can execute SQL mutation, process signals, service commands, GitHub mutations, or Setfarm action endpoints. Apply B's exact bounded-unique `CanonicalRefSchema` array to outer and nested refs; reject relative repository paths, absolute paths, `file:` refs, host paths, duplicates, and the 65th ref. Reject caller-supplied terminal owners, disposition values, systemic-root hashes, source-link members, commands, and every `--output`, `--input`, `--root`, or arbitrary filename flag; test mode-`0700` directories, mode-`0600` regular files, `O_NOFOLLOW`, hardlink/symlink rejection, realpath escape, collision, and idempotent same-byte writes. Spawn fresh CLI processes against the same injected private data-root identity: after `prepare-campaign`, require `control-value --name recovery-campaign-hash` to print exactly one lowercase 64-character scalar plus newline and `control-value --name recovery-campaign-hash --json` to print only `{schema,name:"recovery-campaign-hash",value,controlReceiptHash}` plus newline. Then run `link-source-golden` and prove it derives the stored API result/current epoch, persists one exact `(D campaign,epoch)` link, reopens across processes, is idempotent for equal authority, and rejects execution before prepare, a stale-epoch/original-epoch link, arbitrary cross-campaign result, and same-index collision. Fresh processes must reject absent, conflicting, corrupt, wrong-campaign, wrong-name, duplicate-flag, and extra-argument control receipts without printing a value.

In `recovery-scenario-runner.test.ts`, assert: `execute:false` starts nothing; the three new-run live scenarios call C `prepareGoldenStageCoordinationV1` exactly once, persist/reopen that pair before `stage`, and exhaustively dispatch C's exact `GoldenAssertionEnabledStageOutcomeV1`. Only `kind:"staged"` persists/reopens its exact staged object before one `executeStaged`, and C alone delegates to B. Both non-staged branches exit with their durable finite blocker before scenario mutation. Kill after C outcome durability/return but before D outcome CAS; a fresh process resolves the coordination status, repeats `stage` with the same pair, receives the same discriminated outcome bytes, and creates no second result/intent/outbox. Scenarios 3/4 use B's registered service-restart checkpoints built once from D's exact `GoldenServiceRestartActionPortV1`, while scenario 6 receives C's exact `actionable-post-pr-review-generation`, literal action ID `publish-golden-actionable-post-pr-review`, `requiredWorkflowStepId:"post-pr-review"`, and `requiredGenerationKind:"workflow-step-claim-generation"`. The B checkpoint rejects a wrong campaign/case/run/run-number/generation/predicate, returns `null` before its predicate, calls the exact D adapter once, returns a strict `GoldenServiceRestartActionReceiptV1`, and produces one B-owned lifecycle receipt with `actionOperationHash:null` during a non-terminal poll; it never runs twice or first fires after terminal collection. D supplies only the narrow action adapter and cannot instantiate/brand/cast a registered checkpoint or access its hidden controller. Each scenario-3/4 adapter call uses the shared restart authority exactly once with namespace `recovery-active-run`, persists the operation before mutation, reconciles only that ref/hash after a crash, and maps its terminal completion plus distinct before/after service authority hashes into the exact B receipt without copying the restart hash into the lifecycle action-operation member. Fresh-process interruption recovery resolves only the exact stored staged status pair and calls `recoverStaged` once; terminal pre-run/blocked status recovery is read-only. Reject `collect`, caller case/run/release flags, a missing coordination or outcome-status CAS, direct recovery `executeStaged`, another coordination, or a second result binding. Scenario 6 neither calls `RecoveryActionPort` nor writes `RecoveryActionReceiptStore`; it accepts C's exact lifecycle/action receipt chain and requires the same non-null `actionOperationHash` from both B and C. Reject a missing projection member, a null C operation hash, equal before/after service authority hashes, a non-null D lifecycle operation hash, a null/wrong service-restart operation or receipt for scenarios 3/4, a service-restart member on scenario 10, a changed operation hash with an unchanged receipt hash, a lifecycle/action owner mismatch, or a non-null action receipt beside a null checkpoint except scenario 10's exact separately authenticated admitted-product restart receipt. Process-integration scenarios call only `processFixture.execute(...)` with exact `campaignHash`; scenario 10 calls neither `executeGoldenCaseV1(...)` nor the process fixture, but calls `acceptedProductRuntime.resolve(...)` and `restartAndVerify(...)` exactly once and stores their receipt. The CLI rejects raw port/dependency flags, `--live-action` for scenario 10, and `--runtime-action` for every other scenario. Wrong campaign/mode/release, unrelated active work, unbound target ownership, result hash/run mismatch, or an unenumerated action prevents mutation; post-action ownership must be fully zero.

In `recovery-action-port.test.ts` and `recovery-action-receipt.test.ts`, use fake shared-restart/runtime/browser ports only. Prove service actions never import or execute `launchctl`; the injected D authority receives the exact Mission Control/dashboard target, namespace `recovery-active-run`, epoch/attempt/target-owner-set guard/before-generation authority, and browser polling begins before its durable `prepare`. Each `prepare` input includes both immutable `authorizationOperationRef`/`authorizationOperationHash` and `authorizationRef`/`authorizationHash`; it must not accept a locator pair. For scenarios 3/4 the action first resolves D's durable namespace/service head: only an absent first-ever head admits null, while every later action freshly resolves and passes the exact terminal predecessor and lets D derive the next occurrence ordinal. Reopen after every predispatch/helper/child/PID/marker/reap/completion/occurrence/index/head boundary and prove recovery calls only `executeOrRecover` with the same operation ref/hash, while polling continues through reconnect. Mission Control requires disconnect/reconnect while dashboard requires HTTP loss/recovery; all same-run visible-state/process/HTTP hashes validate; the exact target process/listener identities are enumerated in `before.targetOwnership`; and every action rejects unrelated or unbound active ownership before operation preparation. Round-trip each outer-discriminated success, finite refusal, and finite failure member. Require success-only after/browser/session fields only on success; refusal must carry exact failed boundary/observed authority plus fully zero cleanup, while failure carries complete authenticated cleanup that may be nonzero only for nonselectable `cleanup_incomplete`; both reject fabricated success fields and both are nonselectable. Re-resolve each D-owned action receipt plus its separate service-restart operation/terminal/occurrence/head authority and reject any hash/ref/namespace/epoch/attempt/service/guard/generation/predecessor mismatch. The D production action port must expose no GitHub/review method, arbitrary command, caller occurrence ordinal, PID, port, review body, provider error, filesystem root, database mutation, helper launcher, or child-process seam.

In `internal-production-service-restart-authority-v1.test.ts` and `internal-production-service-restart-startup-v1.test.ts`, exercise all four namespaces and all three exact labels. Crash immediately before/after service-global start-slot read/CAS, ordinary-claim publication/reopen, owner/listener publication, owner-publication receipt/reopen, ordinary settlement publication, settlement-head CAS, restart reservation CAS, immutable authorization-operation publication/reopen, every current-locator phase CAS, authorization publication, operation/outbox publication, helper reservation/spawn/claim, child spawn/PID/output/exit/terminate/reap, PID receipt/reconstruction, startup admission/marker, completion/failure, restart settlement-head CAS, and namespace pointer CAS. An ordinary claim remains the exact active head through authenticated owner/listener publication and its terminal settlement; response loss or a fresh process adopts only the named claim/publication/settlement bytes. If the process dies before publication, only exact startup-process plus owner/listener absence may produce the failure settlement. If the process, owner, listener, or publication state is live/partial/ambiguous, recovery stays `in_progress` and restart preparation remains blocked. Prove no crash window releases the slot early, publishes two owners/listeners, fabricates an absence, or strands an exact already published owner/listener after recovery.

One service-global restart reservation and predispatch operation permit at most one helper and one child; the helper claim exists before `kickstart`, the helper owns/reaps the exact child, a live marker plus lost output may reconstruct one PID receipt, and a dead marker requires authenticated death/absence without a fabricated live PID receipt. With one restart head, require the exact operation claim and marker and prove no branch can return `ordinary-launchd-start`. From an absent or settled head, simulate login, reboot, and launchd crash relaunch for spawner/dashboard/Mission Control; require the exact launchd-parent/configured-label/entrypoint/build/source/process authority, the exact ordinary claim and active-head pairs, all restart identity fields null, `restartMarkerPublished:false`, no marker-store write, one authenticated owner/listener publication, and one terminal slot-head transition. The same process retry adopts its claim; a different process is refused before ownership. Refuse manual invocation, wrong/non-launchd parent, wrong label/entrypoint/build/source, multiple/unreadable slot candidates, missing operation/outbox/claim, or a restart identity that attempts ordinary fallback before database/PID/listener ownership. Reconciliation never repeats a mutation, and finite uncertainty settles only after exact helper/child or ordinary-process/owner/listener absence.

Race every ordinary-start boundary—before claim CAS, after claim CAS, before/after owner/listener publication, before/after publication receipt, and before/after settlement-head CAS—against `recovery-active-run`, `source-release-barrier`, `cold-rehearsal`, and `documentation-handoff` reservation acquisition for the same service. At every boundary exactly one expected-predecessor CAS wins: an active ordinary claim makes `prepare` return `SERVICE_START_SLOT_ORDINARY_STARTING` with no reservation/operation/outbox, while an active restart reservation admits only its exact operation-backed startup and makes an unrelated ordinary process fail without a claim or owner/listener. After the ordinary settlement, a new restart may reserve with that exact settled head as predecessor; after restart settlement, an ordinary process may claim with that exact settled head as predecessor. Also race every pair of restart namespaces and require one same-service reservation winner, and race different services and permit one winner per service. Repeat the same coordination/expected-operation pair after response loss and adopt the exact reservation/operation. Reject check-then-act across separate stores, an ordinary claim and restart reservation at one slot ordinal, a skipped/mismatched predecessor head, a caller label/command/path/PID/environment, shell execution, dynamic args, wrong namespace/scope/epoch/attempt/coordination/derived operation/occurrence/guard/generation/build, same-operation rollover, unsettled service slot or terminal predecessor, duplicate operation at one namespace/service occurrence, cross-namespace adoption, startup selection from namespace history, process/directory scans, newest-candidate selection, and any ref/hash drift. Source-boundary tests require the unaliased static named D exports above, make the helper script the only `launchctl kickstart -kp` site, make the shared authority the only service-start-slot/reservation/ordinary-claim/publication/settlement/helper/child/PID/marker/reap writer, and require the spawner/dashboard/MC startup hooks to claim before ownership/listen and complete the ordinary branch immediately after exact owner/listener publication. They reject a parallel ordinary-start store, a restart marker in the ordinary branch, an operation-backed ordinary branch, a direct action-port or E launchctl call, and a duplicate cold/docs helper schema or factory.

The same restart tests begin with D disabled and require every generic prepare to return `SERVICE_RESTART_AUTHORITY_NOT_ACTIVATED` with zero reservation/outbox/helper writes. Merge/build the Setfarm spawner/dashboard hooks and Mission Control consumer while the observed physical epoch remains one; require the exact D manifest receipt/head activation before the first hook-load command, use A's exact `d-startup-hook-load` sequence to load each service, and at every pre-load, mid-load, post-load, ordinary-claim, owner/listener-publication, slot-settlement, and A-owned readiness boundary prove D prepare is still disabled. Prove the later D source SHA is accepted as a descendant of A's exact migration application SHA only while A's dedicated immutable bootstrap-migration implementation blob, ordered statements, named digest entry, digest, and schema projection remain unchanged; allow unrelated append-only registry/digest entries, and reject a changed A named entry/module/projection even on a descendant. Crash or relaunch spawner, dashboard, and Mission Control independently on both sides of readiness: recovery must settle/adopt the same ordinary slot and A may record readiness only when all three current code-owned hook/source/build identities equal the two delivery receipts. Reject a partial/two-hook, stale generation/source/build, wrong epoch, nonsettled slot, caller-authored hook identity, D-local readiness writer/store, or readiness observed after epoch two.

Then race A ordinary/bootstrap/sequence preparation against the one-CAS cutover for each physical service: either A holds the shared epoch-one lock and cutover refuses until its exact operation is terminal, or the cutover visibility CAS atomically exposes the complete readiness/retirement/activation/epoch-two chain and the A attempt returns `BASELINE_RESTART_AUTHORITY_RETIRED`; no interleaving produces two dispatches. Crash before/after the fixed full pending-record temporary, fsync, no-replace publication, parent fsync, `O_NOFOLLOW` reopen, owner-fence acquire/reobserve, operation publication, active-operation visibility, prepare response, zero-input fresh-process resume, guard consumption, readiness publication, lock acquisition, each invisible retirement/activation/cutover candidate, sole visibility CAS, fence release, resume response, and first D reservation. The D read-only status command returns the exact `pending-input` branch while that sole fixed full record exists and the operation is absent; a fresh zero-input resume advances that same record. Before the active operation exists, retry adopts or completes from the fixed record; after it exists, only zero-input resume may proceed and no caller may supply the old guard. Before the CAS recovery retains epoch one/D-disabled; after it adopts exact bytes and D-enabled. Relaunch all three services on each side; reject structural/wrong-service/nonzero/pending-A readiness, forked epoch two, absent/cross-paired cutover or fence release, second transition, A resurrection, or post-D A rollback. Preserve exact pre-retirement history only.

In `setfarm-completion-owner-receipt-activation-controller-v1.test.ts`, compile-pin the unaliased B `SetfarmCompletionOwnerReceiptProducerStartupAdmissionV1` and resolver plus both exact D successor functions. For `d-ordinary-start`, require successful settlement/publication refs/hashes and literal-null A fields. For `d-managed-restart`, run `setfarm-spawner` through all four namespaces and require the full successful operation/startup/settled-reservation/completion/occurrence/namespace-head/service-start-slot-head chain, exact source/build, differing before/after generation, terminal-predecessor null relation on first occurrence and complete non-null equality later, and B expected-predecessor admission-head CAS. Crash at every D authority publication/reopen and B candidate/head/response boundary; fresh recovery returns the same admission pair and releases normal polling once. Reject `in_progress`/failed completion, active reservation, failed occurrence, another service, namespace/source/build/generation/predecessor/head drift, unknown/extra fields, non-null A fields, missing D fields, structural clones, or any fallback to ordinary/A/no-op. Race two same-generation calls and two different restart namespaces: one exact successor wins, the other resolves the same identity or blocks before barrier advance; never append two generation admissions.

The same test pins the complete four-namespace authorization table, not a global-zero table. `recovery-active-run` requires coordinator kind `recovery-active-run`, its non-null nested `RecoveryActiveRunTargetOwnerGuardReceiptV1`, and exact active-target ref/hash; global zero, a top-level/free guard, missing/extra target PID/listener/lease, or run/generation/predicate/service drift fails. `source-release-barrier`, `cold-rehearsal`, and `documentation-handoff` each require a coordinator authority with the identical literal kind and null active-target fields; none accepts a census/global-zero receipt or the active-run guard. For all twelve namespace/service combinations, prepare writes/reopens a separate content-addressed `RecoveryRestartTargetAuthorizationPreparedSnapshotV1` and the fixed current locator, then returns their immutable `preparedActivePendingRef`/`preparedActivePendingHash` and distinct initial current pair. Zero-input resume must use `resolveRecoveryRestartTargetAuthorizationPreparedSnapshotV1(...)` before deriving one immutable authorization operation bound to that snapshot, and A returns the same seven literal target roles. Each `operation-published`, `authorized`, and `terminal-finalized` status preserves the prepared pair yet exposes a distinct current locator hash for its phase; the snapshot ref/hash can never equal the fixed current ref/hash. The resume compiled return and JSON adapter output remain exactly the four required fields `authorizationOperationRef`, `authorizationOperationHash`, `authorizationRef`, and `authorizationHash`; no locator pair appears there. Status at `authorized|terminal-finalized` separately repeats that quartet plus both prepared/current pairs, `operation-published` exposes no fabricated authorization pair, and every caller resolves/persists the operation before the authorization. Before authorization consumption, `prepare` must resolve operation, authorization, and the prepared snapshot, then reject a nonreciprocal operation pair, snapshot/locator ref or hash equality, prepared-snapshot mismatch, namespace/service/coordination/coordinator/reservation-set/family mismatch, stale current status, or predecessor-chain drift; it verifies the operation's prepared snapshot against status but never requires the old prepared hash to equal a later current locator hash. Every target-backed publication authenticates only its named pair without ordinary begin, and one compound close settles the full set. Reject omitted/extra fields, a legacy locator or authorization-only response, reversed persistence, status/return drift, an operation pair omitted from `prepare`, or historical authorization derived from a mutable locator. Start with an absent head and prove only ordinal one/null predecessor is admitted; after the final envelope and locator clear, reopen the complete immutable snapshot/operation/core/close/occurrence/head/release/final chain and require it as the exact predecessor for the next derived ordinal. Crash before/after snapshot content-address/reopen, initial locator publication, every immutable-operation/current-locator phase/core/close/occurrence/index/head/release/final-envelope/clear boundary; an equal retry adopts the same snapshot and operation bytes and returns the same quartet, while a crash/response-loss path that reconstructs a snapshot from a mutable locator, skipped ordinal, stale/forked head, null later predecessor, non-null first predecessor, swapped disposition/core/close/release/final envelope, duplicate operation, deletion, index reset, caller ordinal, operation/authorization pair crossing, or old/current locator-hash equality requirement fails. Execute two sequential restarts through scenarios 3/4 and each source-release, cold, and documentation caller; prove the fixed locator is reusable only after finalization while both old content-addressed snapshot/operation histories resolve forever and no consumer owns a parallel occurrence store.

In `recovery-process-fixture-receipt.test.ts`, persist every success, scenario-5 finite typed-terminal, and finite failure union member content-addressed, resolve it through `RecoveryProcessFixtureReceiptResolverV1`, and recompute its hash. A success matches exact campaign/epoch/case/scenario/run/run-number/generation/checkpoint/frame/before/after/target-ownership/database identities and its scenario-specific literal mutation fields. A typed-terminal is accepted only for `provider_quota_failure`, carries that scenario's exact finite owner/code, reached checkpoint/frame plus before/after/target hashes, authenticated boundary/observed authority, and fully zero cleanup without fabricated continuation assertions; scenario 6's terminal is live-only, and every scenario 1–4/7–10 process terminal, wrong cross-scenario terminal, or nonzero cleanup is rejected and never selected. A failure contains only the reachable common authority plus finite code/boundary/observed authority and complete cleanup census/hash; it rejects fabricated checkpoint frame/before/after/target/assertion fields when authority failed before those boundaries. Reject a wrong campaign/epoch, cross-scenario assertion member, changed generation/checkpoint/frame, mismatched before/after hash, unbound target owner, mutation count other than one, nonreleased listener, stale-generation acceptance, missing `effectsCommitted`, invalid cleanup, collision, symlink/hardlink, or receipt-ref/hash drift.

In `recovery-attempt-store.test.ts` and `recovery-repair-review.test.ts`, feed multiple authenticated failed/polluted receipts plus one selectable receipt to the code-owned classifier and prove all content-addressed history survives fresh-process reopening. Reject a caller-authored disposition/root, an ordinal/previous-hash/campaign/scenario/evidence mismatch, infer-latest selection, second different selection, or selection of a non-authoritative/nonzero-cleanup attempt. Prove scenarios 3/4/6 live roots derive only from B's resolved nonaccepted trusted-cause identity and ordinary process roots derive only from the finite stored fixture boundary/code/authority tuple. For scenario 10, derive attempt-specific evidence exactly as `hashCanonicalJson({scenarioId,boundary,failureCode,sourceRuntimeReceiptHash,actionOperationHash,cleanupHash})`, then derive the stable systemic root only as `hashCanonicalJson({scenarioId,boundary,failureCode,componentKind})` with the finite code-owned component literal. Include a strict schema/root fixture whose action receipt is `{code:"durable_state_verification_failed",failedBoundary:"accepted-product-session-b-durable-read"}` and whose source-runtime receipt is `{code:"durable_state_verification_failed",failedBoundary:"durable-state-read"}`; require one accepted normalized root. Cross either boundary or code, omit the code from either schema, or pair the durable-read boundary with any other code and require rejection before root derivation. Vary source-runtime/action/cleanup hashes and final epochs across three attempts while holding the normalized semantic tuple fixed and require one identical root whose third occurrence blocks; change boundary/code/component and require a different root. Reject an accepted B result hash/root, B trusted-cause identity, null/wrong D operation hash, mismatched runtime/action boundary/code/cleanup, caller tuple/component/root, or prose/log input. Count identical systemic roots cumulatively across every disposition and fresh process; occurrence three blocks before execution and no review type resets it. For actual-process attempts, prove `record-process-repair` derives the root from failed stored evidence and writes the unique index, and only a `RecoveryRepairReviewReceiptV1` with exact campaign/scenario/failed-evidence/systemic-root, merged PR SHA, independently resolved review pass with zero unresolved Critical/High/Medium findings, three independently resolved fixed verification/build authorities, and one-use consumption permits a new attempt. Reject C's golden failed-result receipt on this path. For live golden attempts, prove only C's fixed repair resolver/consumer is used and D's process repair port remains untouched. Reopen the production store in fresh processes for retry one, retry two, and retry three; the third equal derived root must stop before execution even when a reviewed repair receipt is present.

In `recovery-composition.test.ts` and `recovery-source-boundary.test.ts`, require the exact unaliased type/value imports `GoldenLaunchOperationMigrationCurrentVerificationV1` and `verifyCurrentGoldenLaunchOperationMigrationV1` only from `./golden-launch-operation-migration-release-v1.js`, with the zero-input verifier called before D's first golden preflight/workflow mutation; then inject one unexported fake C composition and require `createGoldenMatrixPortsV1()` once. Assert strict reference equality for C's harness/repository/workflow-evidence collector, assertion dispatcher, history/result store, clock, post-PR actions, existing-repository attempt provisioner, repair-review resolver, and repair-consumption port. Compile an exact options-identity fixture that imports `GoldenRunRepositoryOptionsV1` and `createPostgresGoldenRunRepository` only by their unaliased named exports from `./golden-run-repository.js`, proves `GoldenRunRepositoryOptionsV1["workflowEvidence"]` is B's exact `GoldenWorkflowEvidenceCollectorPort | undefined`, and proves the C factory's already constructed repository retains the collector by reference without D reconstructing it. Require an unaliased static type import of `GoldenLifecycleCheckpointReceiptV1` only from `./golden-run-harness.js`, and require `RecoveryScenarioEvidenceV1.lifecycleCheckpoint` to be typed directly as `GoldenLifecycleCheckpointReceiptV1 | null`; reject every D-owned structural projection, alias, wrapper, `Pick`/`Omit`, or local redeclaration. Require the exact unaliased C type/value imports `GoldenRepositoryWorkflowEvidenceResolverV1` and `createGoldenRepositoryWorkflowEvidenceResolverV1` only from `./repository-workflow-integration-authority-v1.js`; the factory is called only in the composition root and the injected resolver's exact `resolve({workflowEvidenceHash})` is called only by the asynchronous authority verifier. Also require unaliased static imports of `GoldenRepairReviewObserverV1`, `GoldenRepairReviewScenarioV1`, and `createGoldenRepairReviewObserverV1` only from `./golden-repair-review-observer-v1.js`; the factory is called once only in production live-repair composition, and D calls only the exact `observeAndRecord({loaded,failedResultHash,scenario})` method with C's repository-repair union member for scenarios 3/4/6 whose stored B result is nonaccepted. Reject any C observer call for scenario 10 or a B accepted result, a local observer/scenario type, wrapper/facade, caller case/scope/root/epoch, or caller verification/hash/merge identity. Require scenario 10 to use only D's `RecoveryAcceptedProductRepairReviewAuthorityV1`, fixed `(campaignHash,failedEvidenceHash,systemicRootHash)` resolver/index, and one-use consumer. It must statically import `GoldenMatrixReceiptV1` and `resolveGoldenMatrixReceiptV1` unaliased only from `./golden-matrix-runner.js`; only source-repair review and consumption may call the resolver with the receipt's exact canonical pair. Source-repair consumption must bind distinct failed/next epochs and source links/results, one full accepted current-epoch Profiles 1–7 matrix receipt, and the exact three Profile 1–3 result hashes selected from it; infrastructure-remediation consumption must bind identical epochs/links/results, null matrix fields, and the fixed authenticated remediation ref/hash. Reject a local matrix type/resolver/store/cache, direct matrix file/index read, dynamic/namespace import, aliases, dependency-object indirection, a caller matrix pair/resolver override, a hash-only/in-memory capability check, or either unversioned `RecoveryEvidenceDependencies`/`runRecoveryEvidenceCli` declaration. Test unresolved workflow evidence, result/evidence hash mismatch, workflow/run/attempt/PR/head mismatch, and workflow/action/lifecycle authority mismatch. Fail if D uses a local interface/type alias, `Pick`/`Omit`, wrapper/overload, namespace/dynamic import, `require`, wrong module, or incomplete lookalike options object. Only D scenarios 3/4 replace `lifecycleCheckpoint`; scenario 6 uses exactly C's generalized `createGoldenPostPrReviewLifecycleCheckpointV1({actions: matrixPorts.postPrReviewActions})`, whose code-owned identity table accepts the approved tuple `campaignId:"internal-production-2026-08-13"` plus `caseId:"recovery-06-bugfix-review"`; all other members retain identity. Fail the source scan if any other production module calls the C factory, if the CLI accepts/constructs raw `GoldenHarnessPorts` or an assertion/action/history/clock/workflow-evidence/provisioning override, if D imports or defines any legacy one-shot fixture materializer, if any D campaign byte contains a pre-created fixture/attempt/repository identity, or if D defines/imports a GitHub mutation adapter, reimplements `GoldenPostPrReviewActionPortV1`, contains a second review body, or persists a second scenario-6 action receipt.

The same source-boundary test requires unaliased static named imports of C `GoldenAssertionEnabledCaseExecutorV1`, `GoldenAssertionEnabledStagedCaseV1`, and `GoldenAssertionEnabledStageOutcomeV1` only from `./golden-matrix-runner.js`; B `GoldenBlockedPreflightResultV1` and `GoldenCaseExecutionOutcomeV1` only from `./golden-run-harness.js`; B `GoldenStartedRunResultV1` and `LoadedGoldenCampaignV1` only from `./golden-run-contract-v1.js`; B `GoldenRunResultStore` only from `./golden-run-store.js`; plus `GoldenStageCoordinationV1`, `prepareGoldenStageCoordinationV1`, and `resolveGoldenStageCoordinationV1` only from `./golden-stage-coordination-v1.js`. D never declares, aliases, wraps, re-exports, or structurally restates any of those B types and never calls an obsolete result or timeout writer. The live runner's AST order is exact: `prepare coordination -> persist/reopen coordination status -> stage with exact ref/hash -> exhaustive kind switch -> persist/reopen exact outcome status`; only `staged` continues `executeStaged`, `pre_run` resolves/stores the immutable result pair and stops, and `blocked` stores only the exact preflight/blocker and stops. Any B public-execute outcome is first typed as `GoldenCaseExecutionOutcomeV1`; only an exhaustive `kind:"run"` guard narrows it to `GoldenStartedRunResultV1` and constructs the exact live projection. The response-loss branch is `resolve coordination status -> stage same ref/hash -> persist/adopt same discriminated outcome`; the fresh-process branch calls `recoverStaged` only from a resolved `state:"staged"` status, while both terminal non-staged states are read-only. Runtime tests require the persisted coordination to retain C's exact code-owned `launchAttemptOrdinal`, require response loss to reuse it, and require a legitimately reviewed new launch to obtain a distinct C-owned ordinal/ref/hash. They also require every inflight store/CLI/source member to use the shared `RecoveryLiveGoldenScenarioIdV1 = Extract<RecoveryScenarioId,"mission_control_active_run_restart"|"dashboard_active_run_restart"|"github_review_retry">`. Reject a local coordination/outcome/staged/blocked-preflight/executor or execute-function signature, absent-key `Pick`, `runIdentity`, `trustedFailure`, any noncanonical review-continuation scenario alias, wrapper/facade, non-exhaustive/default dispatch, direct B `executeGoldenCaseV1` call outside C, direct B prepared-continuation call, `collect` in any D live branch, dynamic/namespace import, caller case/run/result/epoch/launch-ordinal recovery identity, raw C inflight/outcome path read, status inference, a second coordination on response loss, reused coordination on reviewed retry, treating `pre_run` as started/selectable/capacity authority, storing a result for `blocked`, or any execute/recover/action before the exact staged-status publication.

In `recovery-accepted-product-repair-review.test.ts`, persist a failed nonselectable scenario-10 evidence record, derive its exact attempt tuple and stable semantic root only from D's authenticated source-runtime/action receipts plus the finite component mapping, and require `record-accepted-product-repair` to publish one content-addressed source-repair receipt plus the fixed failure/root index. Its failed epoch/link/result must equal the failed attempt. Require a newly accepted complete C Profiles 1–7 `GoldenMatrixReceiptV1` on a distinct next epoch, its exact canonical receipt ref/hash and final epoch, the three exact accepted Profile 1–3 result hashes selected from its ordered slots, a newly indexed next source link whose API result equals `nextSourceResultHash`, one exact current-link expected-predecessor transition to that successor, and one-use consumption that freshly resolves the matrix and admits `reuse` only with that matrix/result/link/epoch chain. Reopen both B results, the C matrix receipt, and the failed epoch's source-link index and prove the original bytes/classification/index are unchanged historical evidence. Separately require `record-accepted-product-infrastructure-remediation` to resolve a fixed authenticated remediation ref/hash, keep failed/next epoch-link-result identities exactly equal, keep all successor-matrix fields null, consume once, and retry the unchanged accepted result. Reject an accepted/selectable or wrong-scenario evidence hash, root derived from either B result or attempt-specific hashes, caller tuple/root/component/epoch/result/link/matrix/remediation, null/wrong D operation hash, cross-campaign/epoch/link/matrix index, a ready/running/blocked/incomplete/tampered matrix, fewer/reordered/wrong-epoch Profiles 1–7 or Profile 1–3 results, stale current-link predecessor, matrix drift between review and consumption, a source repair with unchanged authority, infrastructure remediation with changed authority, unmerged/unreviewed PR, replacement/reclassified historical B result, replay, third same root, C nonaccepted-result observer invocation, and any path/command/check override.

In `recovery-accepted-product-runtime.test.ts`, use isolated PostgreSQL, a real checked temporary accepted API checkout, the real runtime-artifact reader, a sealed `http-service` `RuntimeEvidenceContractV1`, and real child processes. Prove `resolve(...)` accepts the exact stored B source result/packet/source/tree/deployment/transfer chain and returns an authenticated path-free capability keyed by `sourceGoldenCampaignHash`. Reject a copied capability, wrong result/case/profile/run/source/tree/packet/contract/deployment/transfer ref or hash, dirty checkout, unsealed contract, caller path/command/origin/port, non-loopback binding, ambiguous original listener, a durable-state path that escapes/is tracked/is not ignored/is a link, and a second resolver with drifted bytes before spawn. Prove `restartAndVerify(...)` stops only an exact still-live receipt runtime or accepts a cryptographically proven already-released disposition; starts session A; writes and reads the fixed record; stops it and releases its port; starts a distinct session B from the same sealed contract/source; reads identical state without a write; stops it; retains the original clean HEAD/tree; and leaves zero process/listener/lease. Inject crashes before readiness, after write, during stop, and before second read and require `finally` cleanup plus finite nonaccepting source-runtime receipts. A failed session-B read must seal only `code:"durable_state_verification_failed"` with source boundary `durable-state-read`; the recovery envelope must seal the same code with action boundary `accepted-product-session-b-durable-read`. Schema tests accept that pair and reject either literal on any other boundary. The executor must wrap the exact source receipt hash in a separate D recovery envelope bound to recovery campaign, current epoch, and current `RecoverySourceGoldenLinkReceiptV1`; reject swapped source/recovery campaign hashes, stale epoch links, or an envelope/runtime hash mismatch. Reject a duplicate listener, reused process identity, wrong HTTP route/status/body, changed durable record, stale receipt, and any leftover port. Re-resolve both receipts and require exact authority, runtime/HTTP/record, source-cleanliness, and cleanup hashes without forcing success-only fields on refusal/failure.

In `recovery-campaign.test.ts`, require `prepareGoldenExistingRepositoryTemplatesV1({campaignId:"internal-production-2026-08-13"})` exactly once, select its immutable `bug-fix` template, and embed that complete path-free template only into case `recovery-06-bugfix-review`. Assert the resulting campaign parses through B's schema and is stable in the fixed recovery store. The builder must perform zero filesystem copy, Git initialization, GitHub remote creation, fixture inspection, or attempt provisioning. Reject a caller path/remote/fixture identity/attempt receipt, another campaign's template, a reused C matrix attempt, template/seed/hash drift, or campaign hash drift. In the scenario runner, use only `matrixPorts.existingRepositoryAttempts`: B must fsync the scenario's exact persisted launch intent before calling C's sole `GoldenExistingRepositoryAttemptProvisioningPortV1`, and the returned fresh attempt must bind that intent, case, template, ordinal, and final epoch. Same-intent crash recovery reopens that exact attempt; a later authorized intent/retry/epoch creates a distinct repository, remote, fixture identity, and provision hash.

In `recovery-packet.test.ts`, require deterministic bounded recovery-matrix Markdown and recovery-reconciliation Markdown from exactly ten same-epoch asynchronously verified selected scenario records, the scenario-3/4 continuity hashes, all four terminal-page class hashes, reconciliation authority, and a fresh zero-input `observeRecoveryCompleteZeroOwnerCensusV1()` result whose complete A census is zero. Prove no production function accepts an observer and the only fake is an unexported module-local test helper. `finalizeRecoveryPacketV1(...)` refuses any active/unavailable owner, stale registry/map/manifest-set activation/reservation/owner identity, dirty or drifted source, wrong build artifact, duplicate/missing/mixed-epoch scenario, unresolved mismatch, console error, secret-like key, absolute path, oversized output, changed evidence hash, JSON-first renderer output, or swapped document kind; on success it writes only the two distinct content-addressed `.md` byte streams and one receipt below B's global private root and leaves `docs/review-packets` unchanged. Require the strict receipt JSON to contain the exact canonical `finalizationRef` plus both Markdown hashes/refs/sizes and A observation hash, resolve it through `createRecoveryFinalizedPacketResolverV1()`, parse/re-render both streams byte-identically, recompute the identity hash with both derived fields omitted, and reject a wrong scheme/path/hash, relative/absolute/file ref, ref/hash drift, malformed canonical ref, missing receipt, tampered bytes, or `.json` storage suffix. After independent private review, require `record-operational-acceptance` to resolve the same ten selections, reconciliation/browser/A-observation authority, both Markdown authorities, and finalization ref/hash and to produce one immutable `RecoveryOperationalAcceptanceV1`; reject a D guard pair or an operational acceptance containing a docs-session, documentation SHA, materialization, E finalization, or post-handoff field. Prove E can resolve that operational receipt before any docs session exists.

In `recovery-docs-delivery-acceptance.test.ts`, pin the strict D input/receipt schema and exercise an injected fake `RecoveryDocsDeliveryAcceptancePortV1` without any E import. The production port resolves D operational acceptance and B completion authority, derives the two D tracked hashes, stores/resolves one exact content address, and rejects wrong operational/session/documentation/D-byte relations or use as fleet/final-epoch authority. AST tests reject every D import of E final-closure/post-handoff symbols, an E receipt lookalike, or a D-owned production record CLI. E integration is tested only in E; this one-way `E adapter -> D port` arrangement must fail any D-operational → E-docs → D-operational cycle.

In `recovery-packet-review.test.ts`, allocate an unpredictable fixed-root observation, write a bounded strict review, and require `record-packet-review` to derive the exact packet/epoch/recovery-matrix-Markdown/recovery-reconciliation-Markdown identities and all rerun hashes itself. Pin `RecoveryPacketIndependentReviewReceiptV1Schema`, both Markdown parsers/renderers, and the read-only resolver at compile time; AST tests forbid an exported store/writer/`put` method, an exported `RecoveryVerifiedPacketReviewCapabilityV1` type, or any public capability mint. The private fixture proves only an allocator-owned observation plus successful reruns mints one exact WeakMap-authenticated capability and that it is consumed once. Resolve the stored receipt in a fresh process and recompute its hash/ref, both Markdown hashes/refs/grammars, and every finding evidence/resolution relation. Reject JSON bytes under either Markdown identity, a cross-swapped owner kind, a structural/serialized/foreign capability, caller-authored clear receipt, caller-supplied rerun hashes, packet/ref/hash/epoch drift, duplicate/oversized finding IDs, a 65th finding or evidence ref, Critical/High/Medium without exact resolution authority, nonzero unresolved counts, non-clear verdict, raw log/runtime payload, path-bearing ref, unknown key, symlink/hardlink/mode drift, collision, scan/newest selection, or observation deletion before receipt fsync/reopen. Crash at observation open, capability mint/consume, each content-addressed publication boundary, fixed-index publication, and observation unlink; retry adopts only exact bytes. `record-operational-acceptance` must resolve this exact review ref/hash and fail if it is absent, tampered, cross-campaign/epoch, forged, or prose-only.

Prove a simulated active docs claim causes private finalization to fail its owner gate but allows `materializeFinalizedRecoveryPacketV1(finalizationHash)` only in an authenticated distinct Setfarm docs-claim worktree/non-`main` branch at the exact owner-provided merge base; reject the canonical `main` checkout, caller-selected worktree/branch/base, wrong HEAD/base, dirty claim worktree, or unowned branch. In a fresh worktree with no dependencies, require fixed `npm ci` to succeed, produce only the repository-ignored `node_modules/` tree, and leave `git status --porcelain=v1 --untracked-files=all` empty before materialization; reject install failure, lockfile drift, or any tracked/unignored output. The standalone materializer makes no owner query or build call, accepts no caller path/body/source/root override, revalidates Mission Control SHA, stored build artifacts, receipt, hashes, sizes, and derived D-only generation paths, and writes exactly those two tracked files.

For combined delivery, pass only B's authenticated `GoldenDocsMaterializationSessionV1` plus D's authenticated finalization ref to `materializeFinalizedRecoveryPacketInSessionV1(...)`; D must not validate the prior prefix or any hidden session entry/path. Require D to import `GoldenDocsMaterializationSessionV1`, `GoldenDocsMaterializationEntryCommitReceiptV1`, and `commitNextGoldenDocsMaterializationEntryV1` unaliased only from `./golden-run-report.js`, make exactly the `d-recovery-reports-v1/recovery-matrix` call followed by `d-recovery-reports-v1/recovery-reconciliation`, and return the two exact path-free commit receipts. Each callback freshly reopens only the immutable D private finalization receipt and selected byte stream, recomputes `contentHash`, and returns exactly an ordinary-`ArrayBuffer`-backed exact `Uint8Array` plus that hash. D tests reject callback extra keys, mutable-after-return bytes, Buffer/subclass/SharedArrayBuffer-backed views, structural session clones, private controller/path access, raw writer/advance, caller bytes/path, a third selector, standalone/session mixing, begin, or completion. B contract fakes prove wrong owner/kind/hash/order is rejected and that D cannot inspect why. At the physical-write-before-CAS boundary the file is uncommitted and is never returned/accepted by D; same-live-session B recovery may adopt it and complete the matching CAS, while process loss discards the isolated docs claim. No D test asserts a generation hash, directory, suffix, basename, target absence, prefix, or registered expected hash; those are exclusively E pre-begin and B begin/commit responsibilities. Prove the full A–E composition exposes only session mode and cannot invoke the standalone CLI. `createRecoveryMaterializationAuthorityResolverV1()` remains the read-only resolver for D's separate standalone delivery, returns the identical canonical finalization ref/hash, rehashes its named tracked files, and rejects a missing/corrupt/cross-campaign pointer, embedded campaign mismatch, wrong recorded source pair/D-only generation target, or tracked-byte drift. Reject a corrupt receipt, wrong hash, missing/different standalone bytes, symlink/hardlink path, unsafe target, source/build drift, or a third standalone D tracked change.

Re-run B's contract/repository/harness tests proving `workflow-step-claim-generation` requires one open story-null claim plus one non-released runtime, carries exact step DB/claim/runtime identities and one-based ordinal, and hashes the run plus every member. Reject every other workflow/step, multiple candidates, stale/released runtime, wrong step, wrong hash, or a scenario-6 predicate missing `requiredGenerationKind:"workflow-step-claim-generation"`. Re-run C's workflow/step tests proving `post-pr-review` follows `pr`, claim/runtime publication precedes its bounded `120-second` pre-claim poll, the same fixer step receives a current actionable thread, stale generation/head/thread evidence refuses, a real allowed-scope source/test delta is submitted through claim-bound `setfarm step complete`, Setfarm's completion owner pushes it to the same managed PR branch before acceptance, completion re-runs exact tests/head/thread checks, and exact resolution/outdating is observed at the accepted head. Also prove no-comment expiry returns typed `no_actionable_review` without creating another claim or generation.

In `recovery-checkpoint-port.test.ts`, import the real production entry points and prove omitted dependencies are non-blocking no-ops. Inject a one-use fixture port and assert each source hook carries the exact run, run number, generation, owner/claim/runtime/completion/effect identity, and canonical source hash; a hook for another run or generation fails before any action.

In `recovery-process-fixture.test.ts`, use the script-owned fixture, actual isolated PostgreSQL, and real child processes to prove each unsafe boundary. Scenario 1 must commit a real claim through `spawnAgentNow(...)`, stop before transfer, restart a child, and exercise `releaseUntransferredPostClaimOwnership(...)`. Scenario 2 must persist the real `owner_committed` transaction, restart, and resume through `runRuntimeCompletionEffectLedger(...)`. Scenario 5 must traverse the real spawner provider classification/fallback branch with one typed failure and one admitted fallback. Scenario 7 must publish and terminate only the exact real runtime process group. Scenario 8 must publish the authenticated directive through the real `publishLoopClaimRuntime(...)` transaction, restart, and reject the stale generation. Scenario 9 must let the real effect handler apply once, stop before `repository.settle(...)`, restart, reconcile the same effect identity, and prove its mutation count remains one. Assert one capability, one checkpoint frame, durable PostgreSQL state before parent acknowledgement, wrong/replayed release rejection, a real child exit/restart, canonical owner continuity, and zero process/port/owner leak. This is acceptance evidence for scenarios 1, 2, 5, 7, 8, and 9; no live operational pause API is added.

In `run-operational-model.test.ts` and `mission-control-contract-artifacts.test.ts`, first require the strict `setfarm.run-operational-model.v2` producer. Reject missing/extra nested keys, invalid failure owner/action/retryable/recovery policy, terminal/status disagreement, and a changed nested value with the old `modelHash`. Require deterministic canonical hashing that omits only `modelHash`, plus exactly one generated V2 schema/compatibility pair in the Mission Control artifact manifest.

- [ ] **Step 2: Run the focused test and observe failure**

```bash
set -euo pipefail
node --import tsx --test \
  tests/internal-production/recovery-evidence-script.test.ts \
  tests/internal-production/recovery-scenario-runner.test.ts \
  tests/internal-production/recovery-scenario-execution-guard-v1.test.ts \
  tests/internal-production/recovery-live-inflight-store-v1.test.ts \
  tests/internal-production/recovery-composition.test.ts \
  tests/internal-production/recovery-source-boundary.test.ts \
  tests/internal-production/recovery-action-receipt.test.ts \
  tests/internal-production/recovery-process-fixture-receipt.test.ts \
  tests/internal-production/recovery-attempt-store.test.ts \
  tests/internal-production/recovery-repair-review.test.ts \
  tests/internal-production/recovery-accepted-product-repair-review.test.ts \
  tests/internal-production/recovery-browser-continuity.test.ts \
  tests/internal-production/recovery-accepted-product-runtime.test.ts \
  tests/internal-production/recovery-action-port.test.ts \
  tests/internal-production/internal-production-service-restart-authority-v1.test.ts \
  tests/internal-production/internal-production-service-restart-startup-v1.test.ts \
  tests/internal-production/setfarm-completion-owner-receipt-activation-controller-v1.test.ts \
  tests/internal-production/internal-production-service-restart-source-boundary.test.ts \
  tests/internal-production/recovery-campaign.test.ts \
  tests/internal-production/recovery-packet.test.ts \
  tests/internal-production/recovery-packet-review.test.ts \
  tests/internal-production/recovery-docs-delivery-acceptance.test.ts \
  tests/internal-production/recovery-checkpoint-port.test.ts \
  tests/internal-production/golden-run-contract-v1.test.ts \
  tests/internal-production/golden-run-harness.test.ts \
  tests/bug-fix-polling.test.ts \
  tests/claim-log-lifecycle.test.ts \
  tests/findings/v3-github-review-step-routing.test.ts \
  tests/execution-attempts/v3-stage-execution-context.test.ts \
  tests/run-operational-model.test.ts \
  tests/contracts/mission-control-contract-artifacts.test.ts
```

Expected: FAIL because the coordinator, injected production checkpoints, and operational-model V2 artifacts do not exist.

- [ ] **Step 3: Implement the CLI and package script**

Add exactly this script to `package.json`:

```json
"acceptance:recovery": "node --import tsx scripts/internal-production-recovery-evidence.ts",
"acceptance:recovery-scenario": "node --import tsx scripts/internal-production-recovery-scenario.ts"
```

Use parameterized `SELECT` statements and existing Setfarm read helpers. The checkpoint query must include the target run plus global unrelated-run and ownership censuses. Normalize and hash bounded rows; never embed agent transcripts, environment values, database URLs, or full log bodies. Implement the nine-case logical suite with IDs `recovery-01-cli-spawner-pre-transfer`, `recovery-02-api-completion-owner-pre-effect`, `recovery-03-web-mc-active`, `recovery-04-web-dashboard-active`, `recovery-05-cli-provider-quota`, `recovery-06-bugfix-review`, `recovery-07-web-runtime-crash`, `recovery-08-web-supervisor-block`, and `recovery-09-api-post-owner`. Each strict case reuses its approved golden profile contract and has one bounded recovery intent in its task; evidence mode, checkpoint, and safe live action stay outside the golden schema as explicit scenario-runner arguments. `prepare-campaign` calls C `prepareGoldenExistingRepositoryTemplatesV1({campaignId:"internal-production-2026-08-13"})`, embeds only its immutable bug-fix template into the bug-fix case, validates `LoadedGoldenCampaignV1`, stores the private campaign by hash, and emits only campaign identity. It creates no repository, remote, fixture attempt, or workflow capability. During execute, B persists the exact launch intent first and calls the fixed C attempt provisioner through the inherited matrix ports; D never provisions directly.

Implement `finalizeRecoveryPacketV1(...)`, standalone `materializeFinalizedRecoveryPacketV1(...)`, and session-bound `materializeFinalizedRecoveryPacketInSessionV1(...)` in the dedicated packet module, reusing B's `resolveInternalProductionDataRootV1()`/contained-child primitives and two-phase private-finalization/materialization rules. The standalone renderer owns its D-only paths/basenames and accepts no content or target input. The combined writer owns only the two typed private byte streams/content hashes and delegates both commits through B's owner selectors; B alone owns its hidden session registry, combined paths, basenames, writes, and advances. Private finalization performs complete asynchronous evidence, reconciliation, browser, zero-owner, clean-source, and build-artifact verification before sealing bytes; either materialization form consumes only authenticated finalization/session authority and deliberately performs no live owner query or build while the docs claim is active.

Before scenario coordination, re-run and inspect the merged C real bug-fix `post-pr-review` workflow/source boundary and B discriminated workflow-step generation contract. The new step is not a test-only seam: ordinary bug-fix runs use it. Its C-owned bounded poll and completion guard perform exact GitHub authority reads plus same-step scoped correction; D merely supplies one authenticated real inline comment at the B polling checkpoint. Keep the action receipt store and evidence store independent: the coordinator persists the action receipt first, B returns its hash/ref in the lifecycle receipt, and the asynchronous verifier re-resolves both after terminal collection.

Implement `RunOperationalModelV2Schema` as a strict schema over the complete existing nested `run`, `stack`, `pipeline`, `stories`, `failure`, and `evidence` authority. The one code-owned finite terminal-status tuple is exactly `['completed','done','failed','cancelled','canceled','error'] as const`; the Zod producer imports that same tuple and requires `run.terminal === tuple.includes(run.status)`. `computeRunOperationalModelHashV2()` uses Setfarm's canonical JSON hash over the entire V2 object with only `modelHash` omitted.

The generated `run-operational-model.v2.schema.json` must encode the relation itself, not merely type `status` as string and `terminal` as boolean. Under the strict `run` object it emits an exact `oneOf` with two mutually exclusive `if`/`then` branches: the terminal branch's `if.properties.status.enum` is the exact six-member tuple in producer order and its `then.properties.terminal.const` is `true`; the nonterminal branch's `if.properties.status.not.enum` repeats those same six bytes and its `then.properties.terminal.const` is `false`. Each branch requires both fields and uses `else:false`; the enclosing run schema remains `additionalProperties:false`. The artifact generator derives both enums from the one tuple, and a generator/schema test rejects missing/reordered/extra terminal values, equal branches, absent `if`/`then`/`else:false`, or a schema that accepts either terminal/status disagreement through AJV.

Produce V2 from `buildRunOperationalModel(...)`, and add `setfarm.run-operational-model.v2` plus its compatibility fixture to `mission-control-contract-artifacts.ts`. The existing run-model schema/fixture pair is sufficient; no third artifact is added. The current producer manifest has ten artifacts before the operational-active pair. A appends `operational-active-run-status.v1.schema.json` and `.compatibility.json` to make twelve; D retains those exact two active-status bytes and appends only its run-model pair, so the generated/vendored manifest, lock, checker, sync inventory, and tests all require exactly fourteen ordered artifacts. Eight-to-ten and ten-to-twelve arithmetic are stale and forbidden.

- [ ] **Step 4: Run focused, adjacent, and type verification**

```bash
set -euo pipefail
node --import tsx --test \
  tests/internal-production/recovery-evidence.test.ts \
  tests/internal-production/recovery-evidence-script.test.ts \
  tests/internal-production/recovery-scenario-runner.test.ts \
  tests/internal-production/recovery-live-inflight-store-v1.test.ts \
  tests/internal-production/recovery-composition.test.ts \
  tests/internal-production/recovery-source-boundary.test.ts \
  tests/internal-production/recovery-action-port.test.ts \
  tests/internal-production/recovery-action-receipt.test.ts \
  tests/internal-production/internal-production-service-restart-authority-v1.test.ts \
  tests/internal-production/internal-production-service-restart-source-boundary.test.ts \
  tests/internal-production/recovery-process-fixture-receipt.test.ts \
  tests/internal-production/recovery-attempt-store.test.ts \
  tests/internal-production/recovery-repair-review.test.ts \
  tests/internal-production/recovery-accepted-product-repair-review.test.ts \
  tests/internal-production/recovery-browser-continuity.test.ts \
  tests/internal-production/recovery-campaign.test.ts \
  tests/internal-production/recovery-packet.test.ts \
  tests/internal-production/recovery-packet-review.test.ts \
  tests/internal-production/recovery-docs-delivery-acceptance.test.ts \
  tests/internal-production/recovery-checkpoint-port.test.ts \
  tests/internal-production/golden-run-contract-v1.test.ts \
  tests/internal-production/golden-run-harness.test.ts \
  tests/bug-fix-polling.test.ts \
  tests/claim-log-lifecycle.test.ts \
  tests/findings/v3-github-review-step-routing.test.ts \
  tests/execution-attempts/v3-stage-execution-context.test.ts \
  tests/run-operational-model.test.ts \
  tests/contracts/mission-control-contract-artifacts.test.ts
node --import tsx scripts/run-isolated-postgres-tests.ts -- node --import tsx --test \
  tests/internal-production/recovery-process-fixture.test.ts \
  tests/internal-production/recovery-accepted-product-runtime.test.ts
node --import tsx scripts/mission-control-contract-artifacts.ts --check
npx tsc -p tsconfig.json --noEmit
```

Expected: all pass and `git diff --check` is clean.

- [ ] **Step 5: Submit the source claims to Setfarm's completion owner and require the reviewed merge receipt**

After the claim-bound checks pass, every Tasks 1–2 worker uses only its immutable claim's exact `setfarm step complete` command and output transport. Workers may inspect `git status --short --branch`, `git diff --check`, and `git diff --name-only` read-only to prove scope; they never create/switch branches, stage, commit, push, invoke `gh`, or synchronize `main`.

Setfarm's completion owner must validate each claim's declared file scope and check receipts, including the two exact B activation-controller extension paths plus `src/internal-production/recovery-owner-producer-manifest-activation-v1.ts` and `tests/internal-production/recovery-owner-producer-manifest-activation-v1.test.ts`, create the managed commits, push the one managed source branch, open/update the PR, enforce independent review, route all Critical/High/Medium findings through new scoped claims, rerun focused tests plus full `npm test`, contract/migration checks, and `npm run build` from clean managed worktrees, then merge and clean every claim/worktree. The source run is successful only when its durable handoff receipt binds the final Setfarm merge/tree, the complete ordered D file/mode/blob manifest including both B paths and both activation paths, exact `A+B+C` count 27 to `A+B+C+D` count 43 projection, reviewed PR identity/head, required checks, zero unresolved findings, and zero residual worktree/claim owner.

Record that Setfarm-owned producer merge SHA from the handoff receipt. Do not prepare the Mission Control consumer branch or collect live recovery evidence until the owning orchestrator supplies a separate clean `main` checkout whose read-only `HEAD`, `origin/main`, and receipt SHA agree.

---

### Task 3: Remove Mission Control's local operational-state re-derivation

**Files:**

- Create: `mission-control/server/services/internal-production-service-restart-startup-v1.ts`
- Create: `mission-control/server/services/internal-production-service-restart-startup-v1.test.ts`
- Modify: `mission-control/server/index.ts` — await the D generic startup consumer before database/background/listener ownership.
- Create: `mission-control/server/services/setfarm-operational-model.ts`
- Create: `mission-control/server/services/setfarm-operational-model.test.ts`
- Modify: `mission-control/server/routes/setfarm-activity.ts`
- Modify: `mission-control/server/routes/runs.ts`
- Modify: `mission-control/package.json`
- Modify: `mission-control/package-lock.json`
- Modify: `mission-control/scripts/sync-setfarm-contract.mjs`
- Modify: `mission-control/scripts/check-setfarm-contract.mjs`
- Modify: `mission-control/tests/setfarm-contract-vendor.test.ts`
- Retain through sync byte-for-byte: `mission-control/contracts/vendor/setfarm/operational-active-run-status.v1.schema.json`
- Retain through sync byte-for-byte: `mission-control/contracts/vendor/setfarm/operational-active-run-status.v1.compatibility.json`
- Add through sync: `mission-control/contracts/vendor/setfarm/run-operational-model.v2.schema.json`
- Add through sync: `mission-control/contracts/vendor/setfarm/run-operational-model.v2.compatibility.json`
- Modify through sync: `mission-control/contracts/vendor/setfarm/mission-control-contracts.v1.lock.json`

The sync/check inventory is a fixed ordered list of fourteen paths: the ten current entries, A's two reviewed active-status schema/fixture entries, and D's run-model schema/fixture. The lock must contain exactly fourteen distinct entries and the exact producer commit. Directory scans, globs, replacing A's active pair, a twelve-entry lock, or accepting an extra fifteenth artifact fail the checker and vendor test.

- [ ] **Step 0: Synchronize both merged producers and create the single Mission Control branch**

```bash
set -euo pipefail
require_authenticated_clean_main_setfarm_root_v1() {
  : "${SETFARM_ROOT:?authenticated clean-main Setfarm root is required}"
  : "${SETFARM_ROOT_EXPECTED_SHA:?authenticated clean-main Setfarm SHA is required}"
  case "$SETFARM_ROOT" in
    /*) ;;
    *) printf "SETFARM_ROOT must be absolute\n" >&2; return 1 ;;
  esac
  test -d "$SETFARM_ROOT"
  test ! -L "$SETFARM_ROOT"
  readonly SETFARM_ROOT SETFARM_ROOT_EXPECTED_SHA
  SETFARM_ROOT_TOP="$(git -C "$SETFARM_ROOT" rev-parse --show-toplevel)"
  SETFARM_ROOT_BRANCH="$(git -C "$SETFARM_ROOT" branch --show-current)"
  SETFARM_ROOT_HEAD="$(git -C "$SETFARM_ROOT" rev-parse HEAD)"
  SETFARM_ROOT_ORIGIN="$(git -C "$SETFARM_ROOT" rev-parse refs/remotes/origin/main)"
  SETFARM_ROOT_STATUS="$(git -C "$SETFARM_ROOT" status --porcelain=v1 --untracked-files=all)"
  test "$SETFARM_ROOT_TOP" = "$SETFARM_ROOT"
  test "$SETFARM_ROOT_BRANCH" = "main"
  test -z "$SETFARM_ROOT_STATUS"
  test "$SETFARM_ROOT_HEAD" = "$SETFARM_ROOT_ORIGIN"
  test "$SETFARM_ROOT_HEAD" = "$SETFARM_ROOT_EXPECTED_SHA"
}
cd "$SETFARM_ROOT"
D_SHELL_TEST_VALUE_004="$(git branch --show-current)"
test "$D_SHELL_TEST_VALUE_004" = "main"
D_SHELL_TEST_VALUE_005="$(git rev-parse HEAD)"
D_SHELL_TEST_VALUE_006="$(git rev-parse origin/main)"
test "$D_SHELL_TEST_VALUE_005" = "$D_SHELL_TEST_VALUE_006"
D_SHELL_GUARD_OUTPUT="$(git status --porcelain=v1 --untracked-files=all)"
test -z "$D_SHELL_GUARD_OUTPUT"
require_authenticated_clean_main_setfarm_root_v1
node --import tsx scripts/mission-control-contract-artifacts.ts --check
require_authenticated_clean_main_setfarm_root_v1
D_MC_OWNER_SYNC_JSON="$(npm --prefix "$SETFARM_ROOT" run --silent acceptance:recovery -- verify-mission-control-owner-sync --json)"
readonly D_MC_OWNER_SYNC_JSON
D_MC_OWNER_SYNC_SHA="$(printf '%s\n' "$D_MC_OWNER_SYNC_JSON" | jq -er '.missionControlSha | select(test("^[0-9a-f]{40}$"))')"
readonly D_MC_OWNER_SYNC_SHA
D_MC_OWNER_SYNC_REF="$(printf '%s\n' "$D_MC_OWNER_SYNC_JSON" | jq -er '.syncRef')"
readonly D_MC_OWNER_SYNC_REF
D_MC_OWNER_SYNC_HASH="$(printf '%s\n' "$D_MC_OWNER_SYNC_JSON" | jq -er '.syncHash | select(test("^[0-9a-f]{64}$"))')"
readonly D_MC_OWNER_SYNC_HASH

cd /Users/setrox/ai/setrox/mission-control
git status --short --branch
D_SHELL_TEST_VALUE_007="$(git branch --show-current)"
test "$D_SHELL_TEST_VALUE_007" = "main"
D_SHELL_GUARD_OUTPUT="$(git status --porcelain=v1 --untracked-files=all)"
test -z "$D_SHELL_GUARD_OUTPUT"
D_SHELL_TEST_VALUE_008="$(git rev-parse HEAD)"
D_SHELL_TEST_VALUE_009="$(git rev-parse origin/main)"
test "$D_SHELL_TEST_VALUE_008" = "$D_SHELL_TEST_VALUE_009"
D_SHELL_TEST_VALUE_010="$(git rev-parse HEAD)"
test "$D_SHELL_TEST_VALUE_010" = "$D_MC_OWNER_SYNC_SHA"
test -n "$D_MC_OWNER_SYNC_REF"
test -n "$D_MC_OWNER_SYNC_HASH"

test -n "$D_MC_CLAIM_WORKTREE"
test -n "$D_MC_CLAIM_BRANCH"
test -n "$D_MC_CLAIM_BASE_SHA"
cd "$D_MC_CLAIM_WORKTREE"
D_SHELL_TEST_VALUE_011="$(git branch --show-current)"
test "$D_SHELL_TEST_VALUE_011" = "$D_MC_CLAIM_BRANCH"
test "$D_MC_CLAIM_BRANCH" = "feat/internal-production-mc-reconciliation"
D_SHELL_TEST_VALUE_012="$(git rev-parse HEAD)"
test "$D_SHELL_TEST_VALUE_012" = "$D_MC_OWNER_SYNC_SHA"
test "$D_MC_CLAIM_BASE_SHA" = "$D_MC_OWNER_SYNC_SHA"
D_SHELL_GUARD_OUTPUT="$(git status --porcelain=v1 --untracked-files=all)"
test -z "$D_SHELL_GUARD_OUTPUT"
```

Expected: the Setfarm-owned source handoff receipt, clean Setfarm `main`, and `origin/main` identify the same reviewed producer merge. Before any `switch`, `pull`, or other Mission Control mutation could occur, the canonical Mission Control checkout is observed on clean synchronized `main` and must equal the fresh code-owned owner-sync receipt; this worker never runs such a mutation. The Mission Control delivery owner alone synchronizes canonical `main`, creates exactly one authenticated branch/worktree claim for Tasks 3–5, and returns its worktree/branch/base triple. The worker changes directory only to that claimed worktree and proves the exact base before writing. A source-boundary test rejects `git switch|checkout|pull|fetch|merge|reset` in this step or before the sync receipt/read-only equality sequence.

- [ ] **Step 1: Add the generic Mission Control startup consumer before any other Task 3 write**

First write and run only `server/services/internal-production-service-restart-startup-v1.test.ts`. It must prove fixed `execFile`/`shell:false` invocation of the already merged exact verb `internal-service-restart-startup-claim --service mission-control --json`, a replace-not-merge bounded nonsecret environment, and strict path-free output. With one service-global restart head it requires the exact operation claim/marker branch and refuses missing, ambiguous, cross-service, or mismatched operation authority before database/background/listener ownership. From an absent or settled head it accepts only authenticated launchd parentage plus the configured Mission Control label/entrypoint/build/source/process identity, atomically publishes the shared-CAS `ordinary-starting` claim before ownership, returns `ordinary-launchd-start`, and proves no restart marker is published. `server/index.ts` must then publish its exact owner/listener and invoke the fixed completion mode with that admission so D authenticates the publication and terminally settles the same slot; fresh-process recovery accepts only the exact claim ref/hash and adopts that fixed suffix. Cover ordinary login, reboot, launchd crash relaunch, crashes at every claim/publication/settlement boundary, and every ordinary-versus-four-namespace reservation CAS ordering; reject a manual/wrong-parent start, an unrelated ordinary process adopting a live claim, and any operation-backed start falling through to ordinary. Implement only `internal-production-service-restart-startup-v1.ts` and await its claim mode at the first line of `server/index.ts` before any owner, then await its completion mode immediately after exact owner/listener publication and before background work. Run that focused test and `git diff --check`, then report exactly those three paths, the still-current claim/ref/hash/base, and authorized subject `feat: consume shared restart startup claim` to the Mission Control delivery owner. Only that owner validates the fresh claim guard, stages and commits the paths, then returns the commit receipt; only after that receipt resolves may the same branch modify the operational-model/vendor paths below. Task 6 verifies this already implemented consumer and must not create, move, or recommit it.

```bash
set -euo pipefail
require_authenticated_clean_main_setfarm_root_v1() {
  : "${SETFARM_ROOT:?authenticated clean-main Setfarm root is required}"
  : "${SETFARM_ROOT_EXPECTED_SHA:?authenticated clean-main Setfarm SHA is required}"
  case "$SETFARM_ROOT" in
    /*) ;;
    *) printf "SETFARM_ROOT must be absolute\n" >&2; return 1 ;;
  esac
  test -d "$SETFARM_ROOT"
  test ! -L "$SETFARM_ROOT"
  readonly SETFARM_ROOT SETFARM_ROOT_EXPECTED_SHA
  SETFARM_ROOT_TOP="$(git -C "$SETFARM_ROOT" rev-parse --show-toplevel)"
  SETFARM_ROOT_BRANCH="$(git -C "$SETFARM_ROOT" branch --show-current)"
  SETFARM_ROOT_HEAD="$(git -C "$SETFARM_ROOT" rev-parse HEAD)"
  SETFARM_ROOT_ORIGIN="$(git -C "$SETFARM_ROOT" rev-parse refs/remotes/origin/main)"
  SETFARM_ROOT_STATUS="$(git -C "$SETFARM_ROOT" status --porcelain=v1 --untracked-files=all)"
  test "$SETFARM_ROOT_TOP" = "$SETFARM_ROOT"
  test "$SETFARM_ROOT_BRANCH" = "main"
  test -z "$SETFARM_ROOT_STATUS"
  test "$SETFARM_ROOT_HEAD" = "$SETFARM_ROOT_ORIGIN"
  test "$SETFARM_ROOT_HEAD" = "$SETFARM_ROOT_EXPECTED_SHA"
}
node --import tsx --test server/services/internal-production-service-restart-startup-v1.test.ts
git diff --check -- server/services/internal-production-service-restart-startup-v1.ts server/services/internal-production-service-restart-startup-v1.test.ts server/index.ts
require_authenticated_clean_main_setfarm_root_v1
npm --prefix "$SETFARM_ROOT" run --silent acceptance:recovery -- verify-mission-control-claim-guard --json
```

**Interfaces:**

```ts
export type SetfarmOperationalModelFetchResult =
  | { status: "ok"; model: RunOperationalModelV2 }
  | { status: "not_found" }
  | { status: "unavailable"; reason: "timeout" | "connection_refused" | "invalid_payload" }
  | { status: "upstream_error"; statusCode: number };

export interface SetfarmOperationalModelClient {
  get(runId: string): Promise<SetfarmOperationalModelFetchResult>;
}

export function createSetfarmOperationalModelClient(options: {
  baseUrl: string;
  timeoutMs: number;
  fetchImpl?: typeof fetch;
}): SetfarmOperationalModelClient;
```

The client compiles the exact vendored `run-operational-model.v2.schema.json` with direct runtime dependency `ajv`, configured with `removeAdditional:false`, `useDefaults:false`, and `coerceTypes:false`. AJV validation of that vendored schema is Mission Control's sole terminal/status predicate: Mission Control defines/imports no terminal tuple, set, helper, switch, regex, or second post-schema equality check. After AJV it checks only the exact schema literal, every nested authority field/no unknown field through the schema, `model.run.id === requestedRunId`, and `model.modelHash === sha256(canonicalJson(modelWithoutOnlyModelHash))`. Only after all checks pass does it return the exact parsed object reference unchanged. A completed run with canonical `failure.present:true`, owner, action, retryability, and recovery policy remains unchanged. Any schema, nested authority, terminal invariant, run binding, or canonical-hash drift returns `{status:"unavailable",reason:"invalid_payload"}`. Delete the route's `clearedOperationalFailure`, repository-contract, locally synthesized progress clearing logic, and every Mission Control local terminal-status list/predicate for this model.

- [ ] **Step 2: Write the failing exact-pass-through tests**

Assert `strictEqual(result.model, upstreamObject)` for a valid completed V2 model containing canonical `failure.present:true`, owner, action, retryability, and recovery policy. Compile the real vendored JSON Schema with the production AJV configuration and cross every exact terminal status with `terminal:true`, representative nonterminal/unknown strings with `terminal:false`, and both inverse values as rejection. Mutate each nested authority group (`run`, `stack`, `pipeline`, `stories`, `failure`, and `evidence`) while retaining the prior `modelHash`, and assert `invalid_payload`; also cover extra/missing nested fields, wrong schema, terminal/status disagreement, run-ID mismatch, hash mismatch, non-object JSON, exact 404, timeout, connection-refused, and upstream-500 classifications. Assert validation neither adds defaults nor coerces or removes values. Source scans reject a Mission Control terminal enum/array/set/helper, `.includes(model.run.status)`, or post-AJV terminal comparison; replacing the vendored `oneOf` with a permissive boolean schema must make these tests fail.

- [ ] **Step 3: Run the focused test and observe failure**

```bash
set -euo pipefail
node --import tsx --test server/services/setfarm-operational-model.test.ts
```

Expected: FAIL because the service does not exist.

- [ ] **Step 4: Implement the client and replace the route-local derivation**

Install Ajv as a direct runtime dependency with `npm install --save ajv@^8.17.1`. Use a three-second `AbortSignal.timeout(3_000)` and return typed availability states. Import the vendored JSON schema with the repository's JSON-module convention, compile it once, and recompute the hash with the same canonical key ordering used by the Setfarm producer. The route may add transport metadata outside the Setfarm payload, but it may not edit any nested Setfarm field.

- [ ] **Step 5: Run focused and adjacent API tests**

```bash
set -euo pipefail
node --import tsx --test \
  server/services/setfarm-operational-model.test.ts \
  server/routes/setfarm-activity.test.ts \
  server/routes/setfarm-operational.test.ts
npm run check:setfarm-contract
```

Expected: all pass; no test expects local failure clearing.

- [ ] **Step 6: Hand the scoped change to the serialized Mission Control delivery owner**

```bash
set -euo pipefail
require_authenticated_clean_main_setfarm_root_v1() {
  : "${SETFARM_ROOT:?authenticated clean-main Setfarm root is required}"
  : "${SETFARM_ROOT_EXPECTED_SHA:?authenticated clean-main Setfarm SHA is required}"
  case "$SETFARM_ROOT" in
    /*) ;;
    *) printf "SETFARM_ROOT must be absolute\n" >&2; return 1 ;;
  esac
  test -d "$SETFARM_ROOT"
  test ! -L "$SETFARM_ROOT"
  readonly SETFARM_ROOT SETFARM_ROOT_EXPECTED_SHA
  SETFARM_ROOT_TOP="$(git -C "$SETFARM_ROOT" rev-parse --show-toplevel)"
  SETFARM_ROOT_BRANCH="$(git -C "$SETFARM_ROOT" branch --show-current)"
  SETFARM_ROOT_HEAD="$(git -C "$SETFARM_ROOT" rev-parse HEAD)"
  SETFARM_ROOT_ORIGIN="$(git -C "$SETFARM_ROOT" rev-parse refs/remotes/origin/main)"
  SETFARM_ROOT_STATUS="$(git -C "$SETFARM_ROOT" status --porcelain=v1 --untracked-files=all)"
  test "$SETFARM_ROOT_TOP" = "$SETFARM_ROOT"
  test "$SETFARM_ROOT_BRANCH" = "main"
  test -z "$SETFARM_ROOT_STATUS"
  test "$SETFARM_ROOT_HEAD" = "$SETFARM_ROOT_ORIGIN"
  test "$SETFARM_ROOT_HEAD" = "$SETFARM_ROOT_EXPECTED_SHA"
}
git diff --check -- package.json package-lock.json scripts/sync-setfarm-contract.mjs scripts/check-setfarm-contract.mjs tests/setfarm-contract-vendor.test.ts contracts/vendor/setfarm/mission-control-contracts.v1.lock.json contracts/vendor/setfarm/run-operational-model.v2.schema.json contracts/vendor/setfarm/run-operational-model.v2.compatibility.json server/services/setfarm-operational-model.ts server/services/setfarm-operational-model.test.ts server/routes/setfarm-activity.ts server/routes/runs.ts
require_authenticated_clean_main_setfarm_root_v1
npm --prefix "$SETFARM_ROOT" run --silent acceptance:recovery -- verify-mission-control-claim-guard --json
```

Expected: the read-only guard binds exactly those paths, current branch/base, predecessor receipt, and successful checks. The delivery owner alone resolves that fresh guard, stages and commits the exact path set, and returns the immutable commit receipt before Task 4 writes begin; this worker has no `git add|commit` authority.

---

### Task 4: Add a diagnostic-only DB and snapshot reconciliation endpoint

**Files:**

- Create: `mission-control/server/services/run-reconciliation.ts`
- Create: `mission-control/server/services/run-reconciliation.test.ts`
- Modify: `mission-control/server/utils/setfarm-db.ts`
- Modify: `mission-control/server/routes/setfarm-operational.ts`
- Modify: `mission-control/server/routes/setfarm-operational.test.ts`

**Interfaces:**

```ts
export interface CanonicalRunCensusRow {
  id: string;
  runNumber: number;
  protocol: string | null;
  status: string;
  currentStep: string | null;
  activeClaims: number;
  activeRuntimeSessions: number;
  openCompletionOwners: number;
  mandatoryUnsettledEffects: number;
  updatedAt: string | null;
}

export interface RunReconciliationV1 {
  schema: "mission-control.run-reconciliation.v1";
  authorityState: "diagnostic_reconciliation_only";
  productionAuthority: false;
  runId: string;
  result: "matched" | "mismatch" | "unavailable";
  database: CanonicalRunCensusRow | null;
  setfarm: {
    schema: string;
    runId: string;
    protocol: string | null;
    runStatus: string;
    currentStep: string | null;
    snapshotHash: string;
  } | null;
  mismatchCodes: string[];
  observedAt: string;
  reconciliationHash: string;
}

export async function readCanonicalRunCensus(runId: string): Promise<CanonicalRunCensusRow | null>;
export function reconcileCanonicalRun(input: {
  database: CanonicalRunCensusRow | null;
  snapshot: Record<string, unknown> | null;
  observedAt: string;
}): RunReconciliationV1;
```

The DB read is parameterized by exact UUID and returns one row. It counts only open ownership according to the final Setfarm schema. Reconciliation compares identity, protocol, status, current step, claim/runtime ownership, completion ownership, and mandatory unsettled effects. It reports mismatch codes such as `run_status_mismatch`; it never chooses a winner or changes state.

- [ ] **Step 1: Write failing pure reconciliation tests**

Cover exact match, missing DB row, missing snapshot, run-ID mismatch, protocol mismatch, status mismatch, step mismatch, ownership mismatch, stable code ordering, unknown fields rejected, and canonical hash drift.

- [ ] **Step 2: Run the focused test and observe failure**

```bash
set -euo pipefail
node --import tsx --test server/services/run-reconciliation.test.ts
```

Expected: FAIL because the service does not exist.

- [ ] **Step 3: Implement the service and bounded DB reader**

Reuse Mission Control's PostgreSQL pool and Setfarm operational-snapshot parser. Do not query a bounded “recent runs” list and do not match by project title, repository path, or timestamp. Normalize `canceled` to the public spelling `cancelled` only at a named contract boundary; retain the raw DB value in diagnostic evidence when needed.

- [ ] **Step 4: Write the failing route mappings**

Add tests for:

```text
200 matched
409 mismatch
404 database row absent
503 Setfarm snapshot unavailable
400 malformed UUID
```

Every body remains a strict `mission-control.run-reconciliation.v1` diagnostic envelope except malformed UUID, which uses the existing route error contract.

- [ ] **Step 5: Add the route and run focused API tests**

Register `GET /api/setfarm/runs/:id/reconciliation`. Fetch the DB row and canonical snapshot concurrently, then call the pure reconciler.

```bash
set -euo pipefail
node --import tsx --test \
  server/services/run-reconciliation.test.ts \
  server/routes/setfarm-operational.test.ts
```

Expected: all pass.

- [ ] **Step 6: Hand the scoped change to the serialized Mission Control delivery owner**

```bash
set -euo pipefail
require_authenticated_clean_main_setfarm_root_v1() {
  : "${SETFARM_ROOT:?authenticated clean-main Setfarm root is required}"
  : "${SETFARM_ROOT_EXPECTED_SHA:?authenticated clean-main Setfarm SHA is required}"
  case "$SETFARM_ROOT" in
    /*) ;;
    *) printf "SETFARM_ROOT must be absolute\n" >&2; return 1 ;;
  esac
  test -d "$SETFARM_ROOT"
  test ! -L "$SETFARM_ROOT"
  readonly SETFARM_ROOT SETFARM_ROOT_EXPECTED_SHA
  SETFARM_ROOT_TOP="$(git -C "$SETFARM_ROOT" rev-parse --show-toplevel)"
  SETFARM_ROOT_BRANCH="$(git -C "$SETFARM_ROOT" branch --show-current)"
  SETFARM_ROOT_HEAD="$(git -C "$SETFARM_ROOT" rev-parse HEAD)"
  SETFARM_ROOT_ORIGIN="$(git -C "$SETFARM_ROOT" rev-parse refs/remotes/origin/main)"
  SETFARM_ROOT_STATUS="$(git -C "$SETFARM_ROOT" status --porcelain=v1 --untracked-files=all)"
  test "$SETFARM_ROOT_TOP" = "$SETFARM_ROOT"
  test "$SETFARM_ROOT_BRANCH" = "main"
  test -z "$SETFARM_ROOT_STATUS"
  test "$SETFARM_ROOT_HEAD" = "$SETFARM_ROOT_ORIGIN"
  test "$SETFARM_ROOT_HEAD" = "$SETFARM_ROOT_EXPECTED_SHA"
}
git diff --check -- server/services/run-reconciliation.ts server/services/run-reconciliation.test.ts server/utils/setfarm-db.ts server/routes/setfarm-operational.ts server/routes/setfarm-operational.test.ts
require_authenticated_clean_main_setfarm_root_v1
npm --prefix "$SETFARM_ROOT" run --silent acceptance:recovery -- verify-mission-control-claim-guard --json
```

Expected: the read-only guard binds only Task 4's paths and predecessor commit receipt. The delivery owner alone consumes it, stages/commits that exact delta, and returns the next immutable commit receipt.

---

### Task 5: Render exact reconciliation, owner, and retry authority

**Files:**

- Create: `mission-control/src/lib/run-reconciliation.ts`
- Create: `mission-control/src/hooks/useRunReconciliation.ts`
- Create: `mission-control/src/components/run-detail/ReconciliationPanel.tsx`
- Modify: `mission-control/src/pages/RunDetail.tsx`
- Modify: `mission-control/src/lib/operational-snapshot.ts`
- Modify: `mission-control/src/components/run-detail/OperationalEvidence.tsx`
- Modify: `mission-control/server/routes/runs.ts`
- Modify: `mission-control/src/components/pipeline/ErrorCard.tsx`
- Create: `mission-control/tests/run-reconciliation-render.test.tsx`
- Create: `mission-control/tests/operational-authority-render.test.tsx`

**Interfaces:**

```ts
export function parseRunReconciliationResponse(
  statusCode: number,
  value: unknown,
  expectedRunId: string,
): RunReconciliationV1;

export function useRunReconciliation(runId: string, intervalMs?: number): {
  state: "loading" | "matched" | "mismatch" | "unavailable";
  value: RunReconciliationV1 | null;
  error: string | null;
};

export interface OperationalAuthorityPresentation {
  failureOwner: string | null;
  retryability: "retryable" | "not_retryable" | "not_applicable" | "unknown";
  operatorActions: Array<{ actionId: string; label: string; authority: "setfarm" }>;
  productBuildDisposition: "sealed_packet" | "refused_before_packet" | "legacy" | null;
  terminalState: string | null;
}

export function toOperationalAuthorityPresentation(snapshot: unknown): OperationalAuthorityPresentation;
```

`toOperationalAuthorityPresentation()` performs strict structural extraction only. It does not infer an owner from message text, convert a regex error into a retry, clear a failure because a run is completed, or choose an action not present in the Setfarm payload.

- [ ] **Step 1: Write failing parser and SSR render tests**

Test matched, mismatch, unavailable, run-ID mismatch, schema mismatch, hash mismatch, Product Build Authority refused-before-packet, canonical non-retryable owner, canonical retryable owner, typed terminal state, and absent actions. Render mismatches with `DIAGNOSTIC MISMATCH — SETFARM/DB INVESTIGATION REQUIRED`; never render `retry` from a mismatch alone.

- [ ] **Step 2: Run the focused tests and observe failure**

```bash
set -euo pipefail
node --import tsx --test \
  tests/run-reconciliation-render.test.tsx \
  tests/operational-authority-render.test.tsx
```

Expected: FAIL because the parser, hook, and panel do not exist.

- [ ] **Step 3: Implement strict parsing, polling, and rendering**

Poll every five seconds while the run is active and once after a terminal transition. On network loss, preserve the last canonical value with a visible stale timestamp; after reconnection replace it only with a valid envelope for the same run. Add an `aria-live="polite"` reconciliation summary and keyboard-reachable Setfarm-owned action controls.

- [ ] **Step 4: Downgrade the legacy regex classifier to explicit diagnostics**

The existing `GET /api/runs/:id/errors` response must add:

```json
{
  "authorityState": "legacy_diagnostic_only",
  "productionAuthority": false,
  "retryAuthority": false
}
```

Keep historical error cards visible and labeled `LEGACY DIAGNOSTIC`. They may help investigation but must not supply owner, retryability, or mutation controls.

- [ ] **Step 5: Run focused and adjacent UI tests**

```bash
set -euo pipefail
node --import tsx --test \
  tests/run-reconciliation-render.test.tsx \
  tests/operational-authority-render.test.tsx \
  tests/product-build-authority-render.test.tsx \
  tests/active-run-selection.test.ts \
  tests/project-execution-render.test.tsx
```

Expected: all pass; failed and cancelled fixtures remain discoverable.

- [ ] **Step 6: Hand the scoped change to the serialized Mission Control delivery owner**

```bash
set -euo pipefail
require_authenticated_clean_main_setfarm_root_v1() {
  : "${SETFARM_ROOT:?authenticated clean-main Setfarm root is required}"
  : "${SETFARM_ROOT_EXPECTED_SHA:?authenticated clean-main Setfarm SHA is required}"
  case "$SETFARM_ROOT" in
    /*) ;;
    *) printf "SETFARM_ROOT must be absolute\n" >&2; return 1 ;;
  esac
  test -d "$SETFARM_ROOT"
  test ! -L "$SETFARM_ROOT"
  readonly SETFARM_ROOT SETFARM_ROOT_EXPECTED_SHA
  SETFARM_ROOT_TOP="$(git -C "$SETFARM_ROOT" rev-parse --show-toplevel)"
  SETFARM_ROOT_BRANCH="$(git -C "$SETFARM_ROOT" branch --show-current)"
  SETFARM_ROOT_HEAD="$(git -C "$SETFARM_ROOT" rev-parse HEAD)"
  SETFARM_ROOT_ORIGIN="$(git -C "$SETFARM_ROOT" rev-parse refs/remotes/origin/main)"
  SETFARM_ROOT_STATUS="$(git -C "$SETFARM_ROOT" status --porcelain=v1 --untracked-files=all)"
  test "$SETFARM_ROOT_TOP" = "$SETFARM_ROOT"
  test "$SETFARM_ROOT_BRANCH" = "main"
  test -z "$SETFARM_ROOT_STATUS"
  test "$SETFARM_ROOT_HEAD" = "$SETFARM_ROOT_ORIGIN"
  test "$SETFARM_ROOT_HEAD" = "$SETFARM_ROOT_EXPECTED_SHA"
}
git diff --check -- src/lib/run-reconciliation.ts src/hooks/useRunReconciliation.ts src/components/run-detail/ReconciliationPanel.tsx src/pages/RunDetail.tsx src/lib/operational-snapshot.ts src/components/run-detail/OperationalEvidence.tsx server/routes/runs.ts server/routes/setfarm-activity.ts src/components/pipeline/ErrorCard.tsx tests/run-reconciliation-render.test.tsx tests/operational-authority-render.test.tsx
require_authenticated_clean_main_setfarm_root_v1
npm --prefix "$SETFARM_ROOT" run --silent acceptance:recovery -- verify-mission-control-claim-guard --json
```

Expected: the read-only guard binds only Task 5's paths and predecessor commit receipt. The delivery owner alone consumes it, stages/commits the exact delta, and returns the final branch-head receipt.

---

### Task 6: Verify and deliver the Mission Control reconciliation PR

**Files:**

- Verify all Mission Control files changed by Tasks 3–5.
- Verify only: `mission-control/server/services/internal-production-service-restart-startup-v1.ts`, `mission-control/server/services/internal-production-service-restart-startup-v1.test.ts`, and `mission-control/server/index.ts`, all created/modified first in Task 3.
- Update only if Setfarm producer contracts changed:
  - `mission-control/contracts/vendor/setfarm/mission-control-contracts.v1.lock.json`
  - the fourteen declared files under `mission-control/contracts/vendor/setfarm/`: the ten current entries, A's retained operational-active schema/fixture pair, plus D's new operational-model V2 pair

**Interfaces:**

- Consumes: both reviewed source handoff receipts, A's exact current `A+B+C` `{head,receipt}` activation pair, A's still-active physical restart epoch one, A's migration-bound `d-startup-hook-load` sequence only after D's 43-producer successor activation resolves, and one fresh A `InternalProductionBaselineZeroOwnerMutationGuardV1` pair from A's exact `zero-owner --json` producer; D imports A's cutover mutation only inside its exact reviewed adapter and otherwise imports only A types/pair-only resolvers. D's zero-input `observeRecoveryCompleteZeroOwnerCensusV1()` remains read-only evidence and cannot cross this A cutover mutation boundary.
- Produces: the exact A-owned `InternalProductionServiceRestartStartupHooksReadyV1` and `InternalProductionServiceRestartAuthorityCutoverV1` pairs plus their nested A retirement/activation/epoch-two authorities. D publishes no readiness, activation, or cutover bytes. No live scenario may start before this task's cutover resolves.

- [ ] **Step 1: Synchronize the Setfarm contract pin**

From clean Setfarm `main`, verify the committed producer artifacts, then use Mission Control's actual sync command:

```bash
set -euo pipefail
require_authenticated_clean_main_setfarm_root_v1() {
  : "${SETFARM_ROOT:?authenticated clean-main Setfarm root is required}"
  : "${SETFARM_ROOT_EXPECTED_SHA:?authenticated clean-main Setfarm SHA is required}"
  case "$SETFARM_ROOT" in
    /*) ;;
    *) printf "SETFARM_ROOT must be absolute\n" >&2; return 1 ;;
  esac
  test -d "$SETFARM_ROOT"
  test ! -L "$SETFARM_ROOT"
  readonly SETFARM_ROOT SETFARM_ROOT_EXPECTED_SHA
  SETFARM_ROOT_TOP="$(git -C "$SETFARM_ROOT" rev-parse --show-toplevel)"
  SETFARM_ROOT_BRANCH="$(git -C "$SETFARM_ROOT" branch --show-current)"
  SETFARM_ROOT_HEAD="$(git -C "$SETFARM_ROOT" rev-parse HEAD)"
  SETFARM_ROOT_ORIGIN="$(git -C "$SETFARM_ROOT" rev-parse refs/remotes/origin/main)"
  SETFARM_ROOT_STATUS="$(git -C "$SETFARM_ROOT" status --porcelain=v1 --untracked-files=all)"
  test "$SETFARM_ROOT_TOP" = "$SETFARM_ROOT"
  test "$SETFARM_ROOT_BRANCH" = "main"
  test -z "$SETFARM_ROOT_STATUS"
  test "$SETFARM_ROOT_HEAD" = "$SETFARM_ROOT_ORIGIN"
  test "$SETFARM_ROOT_HEAD" = "$SETFARM_ROOT_EXPECTED_SHA"
}
readonly D_SETFARM_VERIFY_ROOT="$SETFARM_ROOT"
require_authenticated_clean_main_setfarm_root_v1
cd "$D_SETFARM_VERIFY_ROOT"
git status --short --branch
require_authenticated_clean_main_setfarm_root_v1
node --import tsx scripts/mission-control-contract-artifacts.ts --check
D_MC_VERIFY_ROOT="$(cd "$D_MC_CLAIM_WORKTREE" && pwd -P)"
readonly D_MC_VERIFY_ROOT
D_SHELL_TEST_VALUE_015="$(git -C "$D_MC_VERIFY_ROOT" rev-parse --show-toplevel)"
test "$D_SHELL_TEST_VALUE_015" = "$D_MC_VERIFY_ROOT"
D_SHELL_GUARD_OUTPUT="$(git -C "$D_MC_VERIFY_ROOT" status --porcelain=v1 --untracked-files=all)"
test -z "$D_SHELL_GUARD_OUTPUT"
cd "$D_MC_VERIFY_ROOT"
require_authenticated_clean_main_setfarm_root_v1
npm run sync:setfarm-contract -- --source "$D_SETFARM_VERIFY_ROOT"
git diff --name-only -- contracts/vendor/setfarm
D_MC_POST_SYNC_PORCELAIN="$(git -C "$D_MC_VERIFY_ROOT" status --porcelain=v1 --untracked-files=all)"
if test -n "$D_MC_POST_SYNC_PORCELAIN"; then
  git -C "$D_MC_VERIFY_ROOT" status --short --untracked-files=all -- contracts/vendor/setfarm
  printf 'Mission Control vendor sync requires the authorized owner commit before verification\n' >&2
  exit 1
fi
npm run check:setfarm-contract
```

Expected: producer artifacts are current; sync changes only the vendored lock and its exact fourteen declared artifacts when the final Setfarm commit differs; A's operational-active schema/fixture remain present and byte-authenticated, and D's operational-model compatibility fixture passes exact schema, nested-authority, and canonical-hash validation. The checker and `tests/setfarm-contract-vendor.test.ts` reject 10, 11, 12, 13, 15, duplicate, reordered, missing-active-pair, or extra entries. If sync produces any tracked or untracked byte, this worker stops before `check:setfarm-contract`, Step 2, scans, or delivery. It reports the already displayed exact vendor paths to the existing Mission Control delivery owner, who alone validates the claim, commits through the authorized flow, and returns a fresh clean claim receipt; the worker then restarts Step 1 from empty full porcelain. A dirty sync result is never verification evidence.

Task 6 creates no startup source and allocates no branch. It verifies that Task 3 initialized the sole serialized branch with the fixed `internal-service-restart-startup-claim --service mission-control --json` consumer/test and `server/index.ts` ordering before every later Task 3–5 diff. No E branch owns or edits these three startup paths.

- [ ] **Step 2: Run Mission Control verification in increasing scope**

```bash
set -euo pipefail
D_MC_VERIFY_ROOT="$(cd "$D_MC_CLAIM_WORKTREE" && pwd -P)"
readonly D_MC_VERIFY_ROOT
D_SHELL_TEST_VALUE_016="$(git -C "$D_MC_VERIFY_ROOT" rev-parse --show-toplevel)"
test "$D_SHELL_TEST_VALUE_016" = "$D_MC_VERIFY_ROOT"
D_SHELL_GUARD_OUTPUT="$(git -C "$D_MC_VERIFY_ROOT" status --porcelain=v1 --untracked-files=all)"
test -z "$D_SHELL_GUARD_OUTPUT"
cd "$D_MC_VERIFY_ROOT"
node --import tsx --test \
  server/services/internal-production-service-restart-startup-v1.test.ts \
  server/services/setfarm-operational-model.test.ts \
  server/services/run-reconciliation.test.ts \
  server/services/setfarm-product-build-authority.test.ts \
  server/routes/setfarm-operational.test.ts \
  tests/run-reconciliation-render.test.tsx \
  tests/operational-authority-render.test.tsx \
  tests/product-build-authority-render.test.tsx \
  tests/active-run-selection.test.ts \
  tests/project-execution-render.test.tsx \
  tests/setfarm-contract-vendor.test.ts
npm run check:setfarm-contract
npm test
npm run build
MC_RENDER_ROUTES="/,/setfarm,/setfarm/active,/projects,/setfarm/runs/fixture-no-current-run" npm run render:smoke
git diff --check
```

Expected: all pass from the exact authenticated claim root only after owner commit/vendor synchronization is complete and full tracked/untracked porcelain is empty. Before the current D epoch has any live profile identity, render smoke uses the fixed no-current-run fixture route; it does not depend on `$D_WEB_RUN_ID` or stale golden status. Transcript/source tests inject dirty tracked and untracked states independently and prove the focused test command is never invoked.

- [ ] **Step 3: Run secret, scope, and authority scans**

```bash
set -euo pipefail
D_MC_SCAN_ROOT="$(cd "$D_MC_CLAIM_WORKTREE" && pwd -P)"
readonly D_MC_SCAN_ROOT
D_SHELL_TEST_VALUE_017="$(pwd -P)"
test "$D_SHELL_TEST_VALUE_017" = "$D_MC_SCAN_ROOT"
D_SHELL_TEST_VALUE_018="$(git -C "$D_MC_SCAN_ROOT" rev-parse --show-toplevel)"
test "$D_SHELL_TEST_VALUE_018" = "$D_MC_SCAN_ROOT"
git -C "$D_MC_SCAN_ROOT" diff --name-only origin/main...HEAD

D_MC_DIFF_CAPTURE="$(mktemp "${TMPDIR:-/tmp}/d-mc-source-diff.XXXXXX")"
readonly D_MC_DIFF_CAPTURE
D_MC_DIFF_DIAGNOSTICS="$(mktemp "${TMPDIR:-/tmp}/d-mc-source-diff-diagnostics.XXXXXX")"
readonly D_MC_DIFF_DIAGNOSTICS
trap 'rm -f -- "$D_MC_DIFF_CAPTURE" "$D_MC_DIFF_DIAGNOSTICS"' EXIT
D_SHELL_GUARD_OUTPUT="$(git -C "$D_MC_SCAN_ROOT" status --porcelain=v1 --untracked-files=all)"
test -z "$D_SHELL_GUARD_OUTPUT"
if git -C "$D_MC_SCAN_ROOT" diff --no-ext-diff origin/main...HEAD >"$D_MC_DIFF_CAPTURE" 2>"$D_MC_DIFF_DIAGNOSTICS"; then
  D_MC_DIFF_STATUS=0
else
  D_MC_DIFF_STATUS=$?
fi
if test "$D_MC_DIFF_STATUS" -ne 0 || test -s "$D_MC_DIFF_DIAGNOSTICS"; then
  printf 'Mission Control reconciliation diff capture failed closed\n' >&2
  exit 1
fi

if D_MC_SECRET_SCAN_OUTPUT="$(rg --no-heading --color never -n 'DATABASE_URL=|OPENAI_API_KEY=|GITHUB_TOKEN=|Authorization: Bearer|SETFARM_ALLOW_DIRTY_BUILD|SETFARM_SKIP_RUNTIME_GUARD' -- "$D_MC_DIFF_CAPTURE" 2>&1)"; then
  D_MC_SECRET_SCAN_STATUS=0
else
  D_MC_SECRET_SCAN_STATUS=$?
fi
case "$D_MC_SECRET_SCAN_STATUS" in
  0)
    printf 'Mission Control reconciliation secret scan matched forbidden bytes\n' >&2
    exit 1
    ;;
  1)
    if test -n "$D_MC_SECRET_SCAN_OUTPUT"; then
      printf 'Mission Control reconciliation secret scan returned output with no-match status\n' >&2
      exit 1
    fi
    ;;
  *)
    printf 'Mission Control reconciliation secret scan failed with status %s\n' "$D_MC_SECRET_SCAN_STATUS" >&2
    exit "$D_MC_SECRET_SCAN_STATUS"
    ;;
esac

if D_MC_AUTHORITY_SCAN_OUTPUT="$(rg --no-heading --color never -n 'clearedOperationalFailure|retryAuthority: true|productionAuthority: true' -- "$D_MC_SCAN_ROOT/server" "$D_MC_SCAN_ROOT/src" "$D_MC_SCAN_ROOT/tests" 2>&1)"; then
  D_MC_AUTHORITY_SCAN_STATUS=0
else
  D_MC_AUTHORITY_SCAN_STATUS=$?
fi
case "$D_MC_AUTHORITY_SCAN_STATUS" in
  0)
    printf 'Mission Control reconciliation authority scan matched forbidden source\n' >&2
    exit 1
    ;;
  1)
    if test -n "$D_MC_AUTHORITY_SCAN_OUTPUT"; then
      printf 'Mission Control reconciliation authority scan returned output with no-match status\n' >&2
      exit 1
    fi
    ;;
  *)
    printf 'Mission Control reconciliation authority scan failed with status %s\n' "$D_MC_AUTHORITY_SCAN_STATUS" >&2
    exit "$D_MC_AUTHORITY_SCAN_STATUS"
    ;;
esac
```

Expected: only planned files; no secret/bypass pattern; no local authority promotion. Immediately before diff capture, the exact authenticated claim root must again have empty full tracked/untracked porcelain; dirty tracked or untracked bytes fail before capture, either scan, or delivery authorization. The exact-root diff capture must return status `0` with empty diagnostics before either independent `rg` runs. Each secret/tree scan accepts only status `1` with empty captured output. Transcript/source tests independently inject `rg` statuses `0`, `1`, `2`, and `127`, status-`1` nonempty output, an unreadable tree root, upstream `git diff` failure, and dirty tracked/untracked states at the post-owner/pre-test and immediate pre-capture gates; every condition except status-`1` empty output fails closed, the upstream failure proves neither scan executes, and either dirty state proves no test, scan, or delivery command is reached.

- [ ] **Step 4: Authorize the delivery owner to deliver the serialized Mission Control PR**

```bash
set -euo pipefail
require_authenticated_clean_main_setfarm_root_v1() {
  : "${SETFARM_ROOT:?authenticated clean-main Setfarm root is required}"
  : "${SETFARM_ROOT_EXPECTED_SHA:?authenticated clean-main Setfarm SHA is required}"
  case "$SETFARM_ROOT" in
    /*) ;;
    *) printf "SETFARM_ROOT must be absolute\n" >&2; return 1 ;;
  esac
  test -d "$SETFARM_ROOT"
  test ! -L "$SETFARM_ROOT"
  readonly SETFARM_ROOT SETFARM_ROOT_EXPECTED_SHA
  SETFARM_ROOT_TOP="$(git -C "$SETFARM_ROOT" rev-parse --show-toplevel)"
  SETFARM_ROOT_BRANCH="$(git -C "$SETFARM_ROOT" branch --show-current)"
  SETFARM_ROOT_HEAD="$(git -C "$SETFARM_ROOT" rev-parse HEAD)"
  SETFARM_ROOT_ORIGIN="$(git -C "$SETFARM_ROOT" rev-parse refs/remotes/origin/main)"
  SETFARM_ROOT_STATUS="$(git -C "$SETFARM_ROOT" status --porcelain=v1 --untracked-files=all)"
  test "$SETFARM_ROOT_TOP" = "$SETFARM_ROOT"
  test "$SETFARM_ROOT_BRANCH" = "main"
  test -z "$SETFARM_ROOT_STATUS"
  test "$SETFARM_ROOT_HEAD" = "$SETFARM_ROOT_ORIGIN"
  test "$SETFARM_ROOT_HEAD" = "$SETFARM_ROOT_EXPECTED_SHA"
}
require_authenticated_clean_main_setfarm_root_v1
D_MC_DELIVERY_GUARD="$(npm --prefix "$SETFARM_ROOT" run --silent acceptance:recovery -- authorize-mission-control-delivery --json)"
readonly D_MC_DELIVERY_GUARD
D_MC_DELIVERY_GUARD_REF="$(printf '%s\n' "$D_MC_DELIVERY_GUARD" | jq -er '.guardRef')"
D_MC_DELIVERY_GUARD_HASH="$(printf '%s\n' "$D_MC_DELIVERY_GUARD" | jq -er '.guardHash')"
require_authenticated_clean_main_setfarm_root_v1
npm --prefix "$SETFARM_ROOT" run --silent acceptance:recovery -- handoff-mission-control-delivery \
  --guard-ref "$D_MC_DELIVERY_GUARD_REF" \
  --guard-hash "$D_MC_DELIVERY_GUARD_HASH" \
  --json
```

The authorization guard binds repository `hikmetgulsesli/mission-control`, base `main`, exact branch/head, the fixed title/body, path scope, all check receipts, and zero unresolved Critical/High/Medium findings. The handoff consumes the pair exactly once and grants no shell Git authority. The Mission Control delivery owner alone pushes, creates/updates the PR, requests independent review, resolves findings through fresh claims, marks ready, merges, synchronizes its canonical checkout, rebuilds, and returns a clean-main delivery receipt.

```bash
set -euo pipefail
require_authenticated_clean_main_setfarm_root_v1() {
  : "${SETFARM_ROOT:?authenticated clean-main Setfarm root is required}"
  : "${SETFARM_ROOT_EXPECTED_SHA:?authenticated clean-main Setfarm SHA is required}"
  case "$SETFARM_ROOT" in
    /*) ;;
    *) printf "SETFARM_ROOT must be absolute\n" >&2; return 1 ;;
  esac
  test -d "$SETFARM_ROOT"
  test ! -L "$SETFARM_ROOT"
  readonly SETFARM_ROOT SETFARM_ROOT_EXPECTED_SHA
  SETFARM_ROOT_TOP="$(git -C "$SETFARM_ROOT" rev-parse --show-toplevel)"
  SETFARM_ROOT_BRANCH="$(git -C "$SETFARM_ROOT" branch --show-current)"
  SETFARM_ROOT_HEAD="$(git -C "$SETFARM_ROOT" rev-parse HEAD)"
  SETFARM_ROOT_ORIGIN="$(git -C "$SETFARM_ROOT" rev-parse refs/remotes/origin/main)"
  SETFARM_ROOT_STATUS="$(git -C "$SETFARM_ROOT" status --porcelain=v1 --untracked-files=all)"
  test "$SETFARM_ROOT_TOP" = "$SETFARM_ROOT"
  test "$SETFARM_ROOT_BRANCH" = "main"
  test -z "$SETFARM_ROOT_STATUS"
  test "$SETFARM_ROOT_HEAD" = "$SETFARM_ROOT_ORIGIN"
  test "$SETFARM_ROOT_HEAD" = "$SETFARM_ROOT_EXPECTED_SHA"
}
require_authenticated_clean_main_setfarm_root_v1
D_MC_DELIVERY_RECEIPT="$(npm --prefix "$SETFARM_ROOT" run --silent acceptance:recovery -- resolve-mission-control-delivery --json)"
readonly D_MC_DELIVERY_RECEIPT
D_SHELL_TEST_VALUE_019="$(printf '%s\n' "$D_MC_DELIVERY_RECEIPT" | jq -er '.baseBranch')"
test "$D_SHELL_TEST_VALUE_019" = "main"
D_SHELL_TEST_VALUE_020="$(printf '%s\n' "$D_MC_DELIVERY_RECEIPT" | jq -er '.merged')"
test "$D_SHELL_TEST_VALUE_020" = "true"
D_SHELL_TEST_VALUE_021="$(printf '%s\n' "$D_MC_DELIVERY_RECEIPT" | jq -er '.unresolvedCriticalHighMedium')"
test "$D_SHELL_TEST_VALUE_021" = "0"
D_SHELL_TEST_VALUE_022="$(git branch --show-current)"
test "$D_SHELL_TEST_VALUE_022" = "main"
D_SHELL_TEST_VALUE_023="$(git rev-parse HEAD)"
D_SHELL_TEST_VALUE_024="$(git rev-parse origin/main)"
test "$D_SHELL_TEST_VALUE_023" = "$D_SHELL_TEST_VALUE_024"
D_SHELL_TEST_VALUE_025="$(git rev-parse HEAD)"
D_SHELL_TEST_VALUE_026="$(printf '%s\n' "$D_MC_DELIVERY_RECEIPT" | jq -er '.mergeSha')"
test "$D_SHELL_TEST_VALUE_025" = "$D_SHELL_TEST_VALUE_026"
D_SHELL_GUARD_OUTPUT="$(git status --porcelain=v1 --untracked-files=all)"
test -z "$D_SHELL_GUARD_OUTPUT"
require_authenticated_clean_main_setfarm_root_v1
npm run check:setfarm-contract
require_authenticated_clean_main_setfarm_root_v1
npm test
require_authenticated_clean_main_setfarm_root_v1
npm run build
D_SHELL_GUARD_OUTPUT="$(git status --porcelain=v1 --untracked-files=all)"
test -z "$D_SHELL_GUARD_OUTPUT"
```

- [ ] **Step 5: Establish the clean D source-merge barrier**

```bash
set -euo pipefail
require_authenticated_clean_main_setfarm_root_v1() {
  : "${SETFARM_ROOT:?authenticated clean-main Setfarm root is required}"
  : "${SETFARM_ROOT_EXPECTED_SHA:?authenticated clean-main Setfarm SHA is required}"
  case "$SETFARM_ROOT" in
    /*) ;;
    *) printf "SETFARM_ROOT must be absolute\n" >&2; return 1 ;;
  esac
  test -d "$SETFARM_ROOT"
  test ! -L "$SETFARM_ROOT"
  readonly SETFARM_ROOT SETFARM_ROOT_EXPECTED_SHA
  SETFARM_ROOT_TOP="$(git -C "$SETFARM_ROOT" rev-parse --show-toplevel)"
  SETFARM_ROOT_BRANCH="$(git -C "$SETFARM_ROOT" branch --show-current)"
  SETFARM_ROOT_HEAD="$(git -C "$SETFARM_ROOT" rev-parse HEAD)"
  SETFARM_ROOT_ORIGIN="$(git -C "$SETFARM_ROOT" rev-parse refs/remotes/origin/main)"
  SETFARM_ROOT_STATUS="$(git -C "$SETFARM_ROOT" status --porcelain=v1 --untracked-files=all)"
  test "$SETFARM_ROOT_TOP" = "$SETFARM_ROOT"
  test "$SETFARM_ROOT_BRANCH" = "main"
  test -z "$SETFARM_ROOT_STATUS"
  test "$SETFARM_ROOT_HEAD" = "$SETFARM_ROOT_ORIGIN"
  test "$SETFARM_ROOT_HEAD" = "$SETFARM_ROOT_EXPECTED_SHA"
}
cd "$SETFARM_ROOT"
D_SHELL_TEST_VALUE_027="$(git branch --show-current)"
test "$D_SHELL_TEST_VALUE_027" = "main"
D_SHELL_TEST_VALUE_028="$(git rev-parse HEAD)"
D_SHELL_TEST_VALUE_029="$(git rev-parse origin/main)"
test "$D_SHELL_TEST_VALUE_028" = "$D_SHELL_TEST_VALUE_029"
D_SHELL_GUARD_OUTPUT="$(git status --porcelain=v1 --untracked-files=all)"
test -z "$D_SHELL_GUARD_OUTPUT"
npm test
npm run build
D_SETFARM_SOURCE_MERGE_SHA="$(git rev-parse HEAD)"
export D_SETFARM_SOURCE_MERGE_SHA

cd /Users/setrox/ai/setrox/mission-control
D_SHELL_TEST_VALUE_030="$(git branch --show-current)"
test "$D_SHELL_TEST_VALUE_030" = "main"
D_SHELL_TEST_VALUE_031="$(git rev-parse HEAD)"
D_SHELL_TEST_VALUE_032="$(git rev-parse origin/main)"
test "$D_SHELL_TEST_VALUE_031" = "$D_SHELL_TEST_VALUE_032"
D_SHELL_GUARD_OUTPUT="$(git status --porcelain=v1 --untracked-files=all)"
test -z "$D_SHELL_GUARD_OUTPUT"
npm run check:setfarm-contract
npm test
npm run build
D_MC_SOURCE_MERGE_SHA="$(git rev-parse HEAD)"
export D_MC_SOURCE_MERGE_SHA
```

This step proves only D's source merges; it creates no live epoch and imports no status. After E source merges, Task 7 records the new clean operational pair as `D_FINAL_SETFARM_SOURCE_SHA`/`D_FINAL_MC_SOURCE_SHA`, creates B's exact final-release epoch, and requires C's full Profile 1–7 matrix on it. A later source change invalidates that live barrier and requires a new epoch, fresh full C matrix, and all ten fresh D selections before E fleet resumes.

The D Setfarm handoff receipt must enumerate the shared authority/startup/helper/tests, both Setfarm hook call sites, `src/internal-production/setfarm-completion-owner-receipt-activation-controller-v1.ts`, `tests/internal-production/setfarm-completion-owner-receipt-activation-controller-v1.test.ts`, `src/internal-production/recovery-owner-producer-manifest-activation-v1.ts`, and `tests/internal-production/recovery-owner-producer-manifest-activation-v1.test.ts`; its tree projection proves both strict D union members/functions plus exact `A+B+C` count 27 to `A+B+C+D` count 43 activation are present. It proves `d-ordinary-start` imports/freshly resolves D settlement/publication and advances B's admission CAS only after owner/listener settlement, while `d-managed-restart` imports/freshly resolves the exact operation/startup/settled-reservation/completion/occurrence/namespace-head/service-slot-head chain and advances only after successful D terminal completion. The D Mission Control handoff receipt must enumerate the generic consumer/test plus `server/index.ts` and prove the startup claim precedes ownership. Neither source handoff claims A retirement, physical restart authority activation, or epoch two: those remain absent while source is merged/built. Step 6 first publishes D's distinct producer-manifest activation, then loads all three hooks, and only afterward publishes the A-owned physical readiness/cutover/retirement/activation chain. E's source owner rejects its branch allocation until both exact source receipts, merge SHAs, file scopes, reviews, checks, clean-main builds, D manifest activation receipt, and the readiness/cutover/retirement/activation authority resolve. No later E task reopens a Mission Control writer for this protocol.

- [ ] **Step 6: Activate D ownership, load all three D-capable hooks under A epoch one, then atomically cut over**

Run only after Step 5's two clean builds. First activate and freshly resolve D's reviewed manifest set while no D producer exists. Only then may the first A sequence replace all three service processes; resume by the same fixed intent until it returns its terminal pair:

```bash
set -euo pipefail
require_authenticated_clean_main_setfarm_root_v1() {
  : "${SETFARM_ROOT:?authenticated clean-main Setfarm root is required}"
  : "${SETFARM_ROOT_EXPECTED_SHA:?authenticated clean-main Setfarm SHA is required}"
  case "$SETFARM_ROOT" in
    /*) ;;
    *) printf "SETFARM_ROOT must be absolute\n" >&2; return 1 ;;
  esac
  test -d "$SETFARM_ROOT"
  test ! -L "$SETFARM_ROOT"
  readonly SETFARM_ROOT SETFARM_ROOT_EXPECTED_SHA
  SETFARM_ROOT_TOP="$(git -C "$SETFARM_ROOT" rev-parse --show-toplevel)"
  SETFARM_ROOT_BRANCH="$(git -C "$SETFARM_ROOT" branch --show-current)"
  SETFARM_ROOT_HEAD="$(git -C "$SETFARM_ROOT" rev-parse HEAD)"
  SETFARM_ROOT_ORIGIN="$(git -C "$SETFARM_ROOT" rev-parse refs/remotes/origin/main)"
  SETFARM_ROOT_STATUS="$(git -C "$SETFARM_ROOT" status --porcelain=v1 --untracked-files=all)"
  test "$SETFARM_ROOT_TOP" = "$SETFARM_ROOT"
  test "$SETFARM_ROOT_BRANCH" = "main"
  test -z "$SETFARM_ROOT_STATUS"
  test "$SETFARM_ROOT_HEAD" = "$SETFARM_ROOT_ORIGIN"
  test "$SETFARM_ROOT_HEAD" = "$SETFARM_ROOT_EXPECTED_SHA"
}
readonly D_CUTOVER_SETFARM_ROOT="$SETFARM_ROOT"
readonly D_CUTOVER_MC_ROOT=/Users/setrox/ai/setrox/mission-control
cd "$D_CUTOVER_SETFARM_ROOT"
D_CUTOVER_SF_BRANCH="$(git branch --show-current)"
test "$D_CUTOVER_SF_BRANCH" = "main"
D_CUTOVER_SF_STATUS="$(git status --porcelain=v1 --untracked-files=all)"
test -z "$D_CUTOVER_SF_STATUS"
D_CUTOVER_SF_HEAD="$(git rev-parse HEAD)"
D_CUTOVER_SF_ORIGIN="$(git rev-parse refs/remotes/origin/main)"
test "$D_CUTOVER_SF_HEAD" = "$D_CUTOVER_SF_ORIGIN"
test "$D_CUTOVER_SF_HEAD" = "$D_SETFARM_SOURCE_MERGE_SHA"
D_CUTOVER_MC_BRANCH="$(git -C "$D_CUTOVER_MC_ROOT" branch --show-current)"
test "$D_CUTOVER_MC_BRANCH" = "main"
D_CUTOVER_MC_STATUS="$(git -C "$D_CUTOVER_MC_ROOT" status --porcelain=v1 --untracked-files=all)"
test -z "$D_CUTOVER_MC_STATUS"
D_CUTOVER_MC_HEAD="$(git -C "$D_CUTOVER_MC_ROOT" rev-parse HEAD)"
D_CUTOVER_MC_ORIGIN="$(git -C "$D_CUTOVER_MC_ROOT" rev-parse refs/remotes/origin/main)"
test "$D_CUTOVER_MC_HEAD" = "$D_CUTOVER_MC_ORIGIN"
test "$D_CUTOVER_MC_HEAD" = "$D_MC_SOURCE_MERGE_SHA"
require_authenticated_clean_main_setfarm_root_v1
D_PRE_CUTOVER_STATUS="$(npm --prefix "$SETFARM_ROOT" run --silent acceptance:recovery -- restart-authority-cutover-status --json)"
printf '%s\n' "$D_PRE_CUTOVER_STATUS" | jq -e '
  .state == "baseline-a-active" and
  .physicalRestartEpochOrdinal == 1 and
  .physicalRestartAuthorityOwner == "baseline-a" and
  .activationRef == null and .activationHash == null
' >/dev/null
require_authenticated_clean_main_setfarm_root_v1
D_DISABLED_PROBE="$(npm --prefix "$SETFARM_ROOT" run --silent acceptance:recovery -- probe-service-restart-authority --json)"
printf '%s\n' "$D_DISABLED_PROBE" | jq -e '
  .code == "SERVICE_RESTART_AUTHORITY_NOT_ACTIVATED" and
  .reservationCreated == false and .outboxCreated == false and .helperStarted == false
' >/dev/null
require_authenticated_clean_main_setfarm_root_v1
D_MANIFEST_ACTIVATION="$(npm --prefix "$SETFARM_ROOT" run --silent acceptance:recovery -- activate-recovery-owner-producer-manifest --json)"
D_MANIFEST_ACTIVATION_REF="$(printf '%s\n' "$D_MANIFEST_ACTIVATION" | jq -er '.receiptRef')"
D_MANIFEST_ACTIVATION_HASH="$(printf '%s\n' "$D_MANIFEST_ACTIVATION" | jq -er '.receiptHash')"
D_MANIFEST_ACTIVATION_HEAD_REF="$(printf '%s\n' "$D_MANIFEST_ACTIVATION" | jq -er '.activationHeadRef')"
D_MANIFEST_ACTIVATION_HEAD_HASH="$(printf '%s\n' "$D_MANIFEST_ACTIVATION" | jq -er '.activationHeadHash')"
printf '%s\n' "$D_MANIFEST_ACTIVATION" | jq -e '
  .phase == "A+B+C+D" and
  .predecessorPhase == "A+B+C" and
  .predecessorProducerCount == 27 and
  (.predecessorHeadRef | startswith("setfarm://internal-production/")) and
  (.predecessorHeadHash | test("^[0-9a-f]{64}$")) and
  .planProducerCounts == [11,10,6,16] and
  .producerCount == 43 and
  (.activationHeadRef | startswith("setfarm://internal-production/")) and
  (.activationHeadHash | test("^[0-9a-f]{64}$"))
' >/dev/null
require_authenticated_clean_main_setfarm_root_v1
D_MANIFEST_ACTIVATION_STATUS="$(npm --prefix "$SETFARM_ROOT" run --silent acceptance:recovery -- recovery-owner-producer-manifest-activation-status --json)"
printf '%s\n' "$D_MANIFEST_ACTIVATION_STATUS" | jq -e \
  --arg receiptRef "$D_MANIFEST_ACTIVATION_REF" \
  --arg receiptHash "$D_MANIFEST_ACTIVATION_HASH" \
  --arg headRef "$D_MANIFEST_ACTIVATION_HEAD_REF" \
  --arg headHash "$D_MANIFEST_ACTIVATION_HEAD_HASH" '
  .status == "activated" and
  .receiptRef == $receiptRef and .receiptHash == $receiptHash and
  (.activationRef | type == "string") and
  (.activationHash | test("^[0-9a-f]{64}$")) and
  .activationHeadRef == $headRef and .activationHeadHash == $headHash
' >/dev/null
require_authenticated_clean_main_setfarm_root_v1
D_HOOK_LOAD_SEQUENCE="$(npm run --silent acceptance:baseline-post-handoff -- resume-restart-sequence --intent d-startup-hook-load --json)"
D_HOOK_LOAD_SEQUENCE_REF="$(printf '%s\n' "$D_HOOK_LOAD_SEQUENCE" | jq -er '.sequenceRef')"
D_HOOK_LOAD_SEQUENCE_HASH="$(printf '%s\n' "$D_HOOK_LOAD_SEQUENCE" | jq -er '.sequenceHash')"
require_authenticated_clean_main_setfarm_root_v1
D_HOOK_LOAD_STATUS="$(npm run --silent acceptance:baseline-post-handoff -- restart-sequence-status --intent d-startup-hook-load --json)"
printf '%s\n' "$D_HOOK_LOAD_STATUS" | jq -e \
  --arg sequenceRef "$D_HOOK_LOAD_SEQUENCE_REF" \
  --arg sequenceHash "$D_HOOK_LOAD_SEQUENCE_HASH" '
  .state == "completed" and
  .sequenceRef == $sequenceRef and .sequenceHash == $sequenceHash and
  (.migrationReceiptRef | type == "string") and
  (.migrationReceiptHash | test("^[0-9a-f]{64}$"))
' >/dev/null
require_authenticated_clean_main_setfarm_root_v1
D_HOOK_RUNTIME_SOURCE="$(npm run --silent acceptance:baseline-post-handoff -- runtime-source --setfarm-sha "$D_CUTOVER_SF_HEAD" --mission-control-sha "$D_CUTOVER_MC_HEAD" --json)"
printf '%s\n' "$D_HOOK_RUNTIME_SOURCE" | jq -e \
  --arg sf "$D_CUTOVER_SF_HEAD" --arg mc "$D_CUTOVER_MC_HEAD" '
  .setfarmSha == $sf and .missionControlSha == $mc and
  (.spawnerServiceIdentityHash | test("^[0-9a-f]{64}$")) and
  (.dashboardServiceIdentityHash | test("^[0-9a-f]{64}$")) and
  (.missionControlServiceIdentityHash | test("^[0-9a-f]{64}$"))
' >/dev/null
require_authenticated_clean_main_setfarm_root_v1
D_STILL_DISABLED_PROBE="$(npm --prefix "$SETFARM_ROOT" run --silent acceptance:recovery -- probe-service-restart-authority --json)"
printf '%s\n' "$D_STILL_DISABLED_PROBE" | jq -e '.code == "SERVICE_RESTART_AUTHORITY_NOT_ACTIVATED"' >/dev/null
require_authenticated_clean_main_setfarm_root_v1
D_CUTOVER_ZERO="$(npm run --silent acceptance:baseline-post-handoff -- zero-owner --json)"
D_CUTOVER_ZERO_REF="$(printf '%s\n' "$D_CUTOVER_ZERO" | jq -er '.guardRef')"
D_CUTOVER_ZERO_HASH="$(printf '%s\n' "$D_CUTOVER_ZERO" | jq -er '.guardHash')"
require_authenticated_clean_main_setfarm_root_v1
D_CUTOVER_PREPARED="$(npm --prefix "$SETFARM_ROOT" run --silent acceptance:recovery -- prepare-restart-authority-cutover --guard-ref "$D_CUTOVER_ZERO_REF" --guard-hash "$D_CUTOVER_ZERO_HASH" --json)"
D_CUTOVER_OPERATION_REF="$(printf '%s\n' "$D_CUTOVER_PREPARED" | jq -er '.operationRef')"
D_CUTOVER_OPERATION_HASH="$(printf '%s\n' "$D_CUTOVER_PREPARED" | jq -er '.operationHash')"
require_authenticated_clean_main_setfarm_root_v1
D_PREPARED_STATUS="$(npm --prefix "$SETFARM_ROOT" run --silent acceptance:recovery -- restart-authority-cutover-status --json)"
printf '%s\n' "$D_PREPARED_STATUS" | jq -e \
  --arg operationRef "$D_CUTOVER_OPERATION_REF" --arg operationHash "$D_CUTOVER_OPERATION_HASH" '
  .state == "prepared" and
  .operationRef == $operationRef and .operationHash == $operationHash and
  .physicalRestartEpochOrdinal == 1 and
  .physicalRestartAuthorityOwner == "baseline-a" and
  .cutoverRef == null and .cutoverHash == null
' >/dev/null
D_PREPARED_SF_STATUS="$(git status --porcelain=v1 --untracked-files=all)"
test -z "$D_PREPARED_SF_STATUS"
D_PREPARED_MC_STATUS="$(git -C "$D_CUTOVER_MC_ROOT" status --porcelain=v1 --untracked-files=all)"
test -z "$D_PREPARED_MC_STATUS"
```

After the prepare response and its exact operation pair are durable, discard that shell. A fresh process resumes only the fixed active locator and receives no guard or operation selector:

```bash
set -euo pipefail
require_authenticated_clean_main_setfarm_root_v1() {
  : "${SETFARM_ROOT:?authenticated clean-main Setfarm root is required}"
  : "${SETFARM_ROOT_EXPECTED_SHA:?authenticated clean-main Setfarm SHA is required}"
  case "$SETFARM_ROOT" in
    /*) ;;
    *) printf "SETFARM_ROOT must be absolute\n" >&2; return 1 ;;
  esac
  test -d "$SETFARM_ROOT"
  test ! -L "$SETFARM_ROOT"
  readonly SETFARM_ROOT SETFARM_ROOT_EXPECTED_SHA
  SETFARM_ROOT_TOP="$(git -C "$SETFARM_ROOT" rev-parse --show-toplevel)"
  SETFARM_ROOT_BRANCH="$(git -C "$SETFARM_ROOT" branch --show-current)"
  SETFARM_ROOT_HEAD="$(git -C "$SETFARM_ROOT" rev-parse HEAD)"
  SETFARM_ROOT_ORIGIN="$(git -C "$SETFARM_ROOT" rev-parse refs/remotes/origin/main)"
  SETFARM_ROOT_STATUS="$(git -C "$SETFARM_ROOT" status --porcelain=v1 --untracked-files=all)"
  test "$SETFARM_ROOT_TOP" = "$SETFARM_ROOT"
  test "$SETFARM_ROOT_BRANCH" = "main"
  test -z "$SETFARM_ROOT_STATUS"
  test "$SETFARM_ROOT_HEAD" = "$SETFARM_ROOT_ORIGIN"
  test "$SETFARM_ROOT_HEAD" = "$SETFARM_ROOT_EXPECTED_SHA"
}
readonly D_RESUME_SETFARM_ROOT="$SETFARM_ROOT"
readonly D_RESUME_MC_ROOT=/Users/setrox/ai/setrox/mission-control
cd "$D_RESUME_SETFARM_ROOT"
D_RESUME_SF_BRANCH="$(git branch --show-current)"
test "$D_RESUME_SF_BRANCH" = "main"
D_RESUME_SF_STATUS="$(git status --porcelain=v1 --untracked-files=all)"
test -z "$D_RESUME_SF_STATUS"
D_RESUME_SF_HEAD="$(git rev-parse HEAD)"
D_RESUME_SF_ORIGIN="$(git rev-parse refs/remotes/origin/main)"
test "$D_RESUME_SF_HEAD" = "$D_RESUME_SF_ORIGIN"
D_RESUME_MC_BRANCH="$(git -C "$D_RESUME_MC_ROOT" branch --show-current)"
test "$D_RESUME_MC_BRANCH" = "main"
D_RESUME_MC_STATUS="$(git -C "$D_RESUME_MC_ROOT" status --porcelain=v1 --untracked-files=all)"
test -z "$D_RESUME_MC_STATUS"
D_RESUME_MC_HEAD="$(git -C "$D_RESUME_MC_ROOT" rev-parse HEAD)"
D_RESUME_MC_ORIGIN="$(git -C "$D_RESUME_MC_ROOT" rev-parse refs/remotes/origin/main)"
test "$D_RESUME_MC_HEAD" = "$D_RESUME_MC_ORIGIN"
require_authenticated_clean_main_setfarm_root_v1
D_CUTOVER_RESULT="$(npm --prefix "$SETFARM_ROOT" run --silent acceptance:recovery -- resume-restart-authority-cutover --json)"
D_HOOKS_READY_REF="$(printf '%s\n' "$D_CUTOVER_RESULT" | jq -er '.startupHooksReadyRef')"
D_HOOKS_READY_HASH="$(printf '%s\n' "$D_CUTOVER_RESULT" | jq -er '.startupHooksReadyHash')"
D_CUTOVER_REF="$(printf '%s\n' "$D_CUTOVER_RESULT" | jq -er '.cutoverRef')"
D_CUTOVER_HASH="$(printf '%s\n' "$D_CUTOVER_RESULT" | jq -er '.cutoverHash')"
require_authenticated_clean_main_setfarm_root_v1
D_POST_CUTOVER_STATUS="$(npm --prefix "$SETFARM_ROOT" run --silent acceptance:recovery -- restart-authority-cutover-status --json)"
printf '%s\n' "$D_POST_CUTOVER_STATUS" | jq -e \
  --arg cutoverRef "$D_CUTOVER_REF" --arg cutoverHash "$D_CUTOVER_HASH" \
  --arg readyRef "$D_HOOKS_READY_REF" --arg readyHash "$D_HOOKS_READY_HASH" '
  .state == "recovery-d-active" and
  .physicalRestartEpochOrdinal == 2 and
  .physicalRestartAuthorityOwner == "recovery-d" and
  .cutoverRef == $cutoverRef and .cutoverHash == $cutoverHash and
  .startupHooksReadyRef == $readyRef and .startupHooksReadyHash == $readyHash and
  (.baselineRetirementRef | type == "string") and
  (.baselineRetirementHash | test("^[0-9a-f]{64}$")) and
  (.activationRef | type == "string") and
  (.activationHash | test("^[0-9a-f]{64}$"))
' >/dev/null
D_POST_CUTOVER_SF_STATUS="$(git status --porcelain=v1 --untracked-files=all)"
test -z "$D_POST_CUTOVER_SF_STATUS"
D_POST_CUTOVER_MC_STATUS="$(git -C "$D_RESUME_MC_ROOT" status --porcelain=v1 --untracked-files=all)"
test -z "$D_POST_CUTOVER_MC_STATUS"
```

Expected: the exact D manifest receipt/head activation is durable immediately after both clean builds and before the first `d-startup-hook-load` command or any D producer byte. Transcript tests inject every predecessor/successor receipt/head failure and prove no hook load, readiness, cutover, reservation, helper, or D publication follows. The only later pre-cutover service mutations are A's exact migration-bound hook-load sequence. Its status proves the later D source is a descendant of A's migration source while A's dedicated immutable migration implementation, ordered statements, named digest entry, digest, and schema projection remain exact; unrelated append-only aggregate entries are allowed. All three D-capable hooks are live at the reviewed source pair while D prepare remains disabled. The first cutover command persists the guard-bound operation and active locator; a separate fresh shell then calls the zero-input A resume through D's reviewed adapter and returns one indivisible A-owned readiness/cutover/retirement/activation/epoch-two chain; no intermediate retired-only or activation-only state is observable. Source/transcript tests kill or relaunch each of spawner, dashboard, and Mission Control before hook claim, after owner/listener publication, after ordinary-slot settlement, immediately before/after A's readiness recording, and immediately before/after the visibility CAS. Recovery adopts the same sequence/readiness/cutover chain; before the CAS A remains active/D disabled, after it A is retired/D active, and max physical dispatch remains one. A non-descendant source, changed A migration implementation/ordered statements/named entry/digest/schema projection, stale source/build/generation, missing hook, unsettled ordinary slot, nonzero guard, D-local readiness/cutover publication, or any failed predicate prevents the cutover and E source-claim allocation.

---

### Task 7: Execute recovery scenarios 1–4 at exact realizable checkpoints

**Files:**

- Write local evidence only through B's fixed `resolveInternalProductionDataRootV1()/recovery` store.
- Later supply accepted evidence bytes to B's combined session for its generation-owned `docs/review-packets/internal-production/epoch-<epochHash>-closure-<closureGenerationHash>/recovery-matrix.md`; D does not receive that path.

**After E source merges, satisfy C's full exact final-operational-epoch Profile 1–7 barrier; then run this merged-source preflight once before the sequence. Before each live-operational scenario repeat DB authority, health, and zero-input `observeRecoveryCompleteZeroOwnerCensusV1()`; process-integration scenarios instead require a fresh isolated database and no inherited service process:**

- [ ] **Step 0: Run current-epoch Profiles 1–7 and import the Profile 1–3 identities D consumes**

```bash
set -euo pipefail
require_authenticated_clean_main_setfarm_root_v1() {
  : "${SETFARM_ROOT:?authenticated clean-main Setfarm root is required}"
  : "${SETFARM_ROOT_EXPECTED_SHA:?authenticated clean-main Setfarm SHA is required}"
  case "$SETFARM_ROOT" in
    /*) ;;
    *) printf "SETFARM_ROOT must be absolute\n" >&2; return 1 ;;
  esac
  test -d "$SETFARM_ROOT"
  test ! -L "$SETFARM_ROOT"
  readonly SETFARM_ROOT SETFARM_ROOT_EXPECTED_SHA
  SETFARM_ROOT_TOP="$(git -C "$SETFARM_ROOT" rev-parse --show-toplevel)"
  SETFARM_ROOT_BRANCH="$(git -C "$SETFARM_ROOT" branch --show-current)"
  SETFARM_ROOT_HEAD="$(git -C "$SETFARM_ROOT" rev-parse HEAD)"
  SETFARM_ROOT_ORIGIN="$(git -C "$SETFARM_ROOT" rev-parse refs/remotes/origin/main)"
  SETFARM_ROOT_STATUS="$(git -C "$SETFARM_ROOT" status --porcelain=v1 --untracked-files=all)"
  test "$SETFARM_ROOT_TOP" = "$SETFARM_ROOT"
  test "$SETFARM_ROOT_BRANCH" = "main"
  test -z "$SETFARM_ROOT_STATUS"
  test "$SETFARM_ROOT_HEAD" = "$SETFARM_ROOT_ORIGIN"
  test "$SETFARM_ROOT_HEAD" = "$SETFARM_ROOT_EXPECTED_SHA"
}
require_authenticated_clean_main_setfarm_root_v1
cd "$SETFARM_ROOT"
readonly D_FINAL_SETFARM_SOURCE_SHA="$SETFARM_ROOT_HEAD"
export D_FINAL_SETFARM_SOURCE_SHA
readonly D_MC_ROOT=/Users/setrox/ai/setrox/mission-control
D_FINAL_MC_SOURCE_SHA="$(git -C "$D_MC_ROOT" rev-parse HEAD)"
export D_FINAL_MC_SOURCE_SHA
D_SHELL_TEST_VALUE_035="$(git -C "$D_MC_ROOT" rev-parse origin/main)"
test "$D_FINAL_MC_SOURCE_SHA" = "$D_SHELL_TEST_VALUE_035"
require_authenticated_clean_main_setfarm_root_v1
D_LAUNCH_MIGRATION_VERIFICATION="$(node dist/internal-production/golden-run-cli.js \
  verify-launch-operation-migration --json)"
printf '%s\n' "$D_LAUNCH_MIGRATION_VERIFICATION" | jq -e \
  --arg currentSha "$D_FINAL_SETFARM_SOURCE_SHA" '
  .schema == "setfarm.internal-production-golden-launch-operation-migration-current-verification.v1" and
  .currentSourceSha == $currentSha and
  (.applicationSourceSha | test("^[0-9a-f]{40}([0-9a-f]{24})?$")) and
  (.receiptRef | type == "string") and
  (.receiptHash | test("^[0-9a-f]{64}$")) and
  (.migrationModuleBlobHash | test("^[0-9a-f]{40}([0-9a-f]{24})?$")) and
  (.migrationStatementsHash | test("^[0-9a-f]{64}$")) and
  (.namedMigrationDigestEntryHash | test("^[0-9a-f]{64}$")) and
  (.schemaProjectionHash | test("^[0-9a-f]{64}$")) and
  (.verificationHash | test("^[0-9a-f]{64}$"))
' >/dev/null
export C_MATRIX_FILE="evals/suites/internal-production-golden-matrix-v1.json"
require_authenticated_clean_main_setfarm_root_v1
D_A_POST_REBIND_JSON="$(npm run --silent acceptance:baseline-post-handoff -- verify-post-rebind-entry --json)"
require_authenticated_clean_main_setfarm_root_v1
D_C_MATRIX_PREFLIGHT_JSON="$(npm run --silent internal:golden-matrix -- preflight \
  --matrix "$C_MATRIX_FILE" \
  --release-sha "$D_FINAL_SETFARM_SOURCE_SHA" \
  --mission-control-sha "$D_FINAL_MC_SOURCE_SHA" \
  --json)"
test "$(printf '%s\n' "$D_C_MATRIX_PREFLIGHT_JSON" | jq -er '.postRebindEntryAuthorityRef')" = \
  "$(printf '%s\n' "$D_A_POST_REBIND_JSON" | jq -er '.postRebindEntryAuthorityRef')"
test "$(printf '%s\n' "$D_C_MATRIX_PREFLIGHT_JSON" | jq -er '.postRebindEntryAuthorityHash')" = \
  "$(printf '%s\n' "$D_A_POST_REBIND_JSON" | jq -er '.postRebindEntryAuthorityHash')"
```

Use C's exact one-successor workflow: invoke `internal:golden-matrix -- execute-next` with those same matrix/release/MC arguments, persist the returned C status ref/hash before execution; when interrupted, invoke C's exact `recover-inflight` with only that status pair, then inspect `status` after the bound result. Repeat serially until Profiles 1–7 satisfy the full current-epoch matrix and its receipt is `decision:"accepted"` in the exact `GoldenFinalReleaseEpochV1(D_FINAL_SETFARM_SOURCE_SHA,D_FINAL_MC_SOURCE_SHA)`. D imports only the accepted Profile 1–3 identities it consumes. No operator command retains or supplies a dead shell's case ID, run ID, or run number, and no recovery branch calls `collect` from those values. Earlier-epoch results remain stored and count toward cumulative systemic history but never satisfy these slots. A non-accepted result freezes starts and follows C's reviewed repair flow before a fresh attempt; a third identical systemic root stops D. Any repair/source drift creates a new epoch and restarts the full C matrix before all ten D scenarios rerun.

Only after that status is authoritative, import and resolve it in fresh processes:

```bash
set -euo pipefail
require_authenticated_clean_main_setfarm_root_v1() {
  : "${SETFARM_ROOT:?authenticated clean-main Setfarm root is required}"
  : "${SETFARM_ROOT_EXPECTED_SHA:?authenticated clean-main Setfarm SHA is required}"
  case "$SETFARM_ROOT" in
    /*) ;;
    *) printf "SETFARM_ROOT must be absolute\n" >&2; return 1 ;;
  esac
  test -d "$SETFARM_ROOT"
  test ! -L "$SETFARM_ROOT"
  readonly SETFARM_ROOT SETFARM_ROOT_EXPECTED_SHA
  SETFARM_ROOT_TOP="$(git -C "$SETFARM_ROOT" rev-parse --show-toplevel)"
  SETFARM_ROOT_BRANCH="$(git -C "$SETFARM_ROOT" branch --show-current)"
  SETFARM_ROOT_HEAD="$(git -C "$SETFARM_ROOT" rev-parse HEAD)"
  SETFARM_ROOT_ORIGIN="$(git -C "$SETFARM_ROOT" rev-parse refs/remotes/origin/main)"
  SETFARM_ROOT_STATUS="$(git -C "$SETFARM_ROOT" status --porcelain=v1 --untracked-files=all)"
  test "$SETFARM_ROOT_TOP" = "$SETFARM_ROOT"
  test "$SETFARM_ROOT_BRANCH" = "main"
  test -z "$SETFARM_ROOT_STATUS"
  test "$SETFARM_ROOT_HEAD" = "$SETFARM_ROOT_ORIGIN"
  test "$SETFARM_ROOT_HEAD" = "$SETFARM_ROOT_EXPECTED_SHA"
}
require_authenticated_clean_main_setfarm_root_v1
npm --prefix "$SETFARM_ROOT" run --silent acceptance:recovery -- import-golden-status --json
require_authenticated_clean_main_setfarm_root_v1
D_CAMPAIGN_HASH="$(npm --prefix "$SETFARM_ROOT" run --silent acceptance:recovery -- control-value --name golden-campaign-hash)"
export D_CAMPAIGN_HASH
require_authenticated_clean_main_setfarm_root_v1
npm --prefix "$SETFARM_ROOT" run --silent acceptance:recovery -- resolve-golden --campaign-hash "$D_CAMPAIGN_HASH" --profile node-cli --accepted-ordinal 1 --store-control cli
require_authenticated_clean_main_setfarm_root_v1
npm --prefix "$SETFARM_ROOT" run --silent acceptance:recovery -- resolve-golden --campaign-hash "$D_CAMPAIGN_HASH" --profile node-express-api --accepted-ordinal 1 --store-control api
require_authenticated_clean_main_setfarm_root_v1
npm --prefix "$SETFARM_ROOT" run --silent acceptance:recovery -- resolve-golden --campaign-hash "$D_CAMPAIGN_HASH" --profile vite-react-web --accepted-ordinal 1 --store-control web
require_authenticated_clean_main_setfarm_root_v1
D_CLI_RESULT_HASH="$(npm --prefix "$SETFARM_ROOT" run --silent acceptance:recovery -- control-value --name cli-result-hash)"
export D_CLI_RESULT_HASH
require_authenticated_clean_main_setfarm_root_v1
D_API_RESULT_HASH="$(npm --prefix "$SETFARM_ROOT" run --silent acceptance:recovery -- control-value --name api-result-hash)"
export D_API_RESULT_HASH
require_authenticated_clean_main_setfarm_root_v1
D_WEB_RESULT_HASH="$(npm --prefix "$SETFARM_ROOT" run --silent acceptance:recovery -- control-value --name web-result-hash)"
export D_WEB_RESULT_HASH
require_authenticated_clean_main_setfarm_root_v1
D_CLI_RUN_ID="$(npm --prefix "$SETFARM_ROOT" run --silent acceptance:recovery -- control-value --name cli-run-id)"
export D_CLI_RUN_ID
require_authenticated_clean_main_setfarm_root_v1
D_API_RUN_ID="$(npm --prefix "$SETFARM_ROOT" run --silent acceptance:recovery -- control-value --name api-run-id)"
export D_API_RUN_ID
require_authenticated_clean_main_setfarm_root_v1
D_WEB_RUN_ID="$(npm --prefix "$SETFARM_ROOT" run --silent acceptance:recovery -- control-value --name web-run-id)"
export D_WEB_RUN_ID
printf '%s\n' "$D_CLI_RESULT_HASH" "$D_API_RESULT_HASH" "$D_WEB_RESULT_HASH"

require_authenticated_clean_main_setfarm_root_v1
npm test
require_authenticated_clean_main_setfarm_root_v1
npm run build
require_authenticated_clean_main_setfarm_root_v1
npm run db:contract-spine:plan
require_authenticated_clean_main_setfarm_root_v1
npm run db:contract-spine:verify
require_authenticated_clean_main_setfarm_root_v1
npm run db:contract-spine:audit-current-authority-ledgers
require_authenticated_clean_main_setfarm_root_v1
npm --prefix "$SETFARM_ROOT" run --silent acceptance:recovery -- assert-zero-owners --json
curl -fsS http://127.0.0.1:3080/api/health | jq -e '.status == "healthy"'
curl -fsS http://127.0.0.1:3333/ >/dev/null
D_RECOVERY_RELEASE_SHA="$(git rev-parse HEAD)"
require_authenticated_clean_main_setfarm_root_v1
npm --prefix "$SETFARM_ROOT" run --silent acceptance:recovery -- prepare-campaign --campaign-id internal-production-2026-08-13 --release-sha "$D_RECOVERY_RELEASE_SHA" --json
require_authenticated_clean_main_setfarm_root_v1
D_RECOVERY_CAMPAIGN_HASH="$(npm --prefix "$SETFARM_ROOT" run --silent acceptance:recovery -- control-value --name recovery-campaign-hash)"
export D_RECOVERY_CAMPAIGN_HASH
D_SHELL_TEST_VALUE_036="$(printf '%s' "$D_RECOVERY_CAMPAIGN_HASH" | wc -c | tr -d ' ')"
test "$D_SHELL_TEST_VALUE_036" = "64"
require_authenticated_clean_main_setfarm_root_v1
npm --prefix "$SETFARM_ROOT" run --silent acceptance:recovery -- link-source-golden --recovery-campaign-hash "$D_RECOVERY_CAMPAIGN_HASH" --json
require_authenticated_clean_main_setfarm_root_v1
D_RECOVERY_CAMPAIGN_CONTROL_JSON="$(npm --prefix "$SETFARM_ROOT" run --silent acceptance:recovery -- control-value --name recovery-campaign-hash --json)"
export D_RECOVERY_CAMPAIGN_CONTROL_JSON
D_SHELL_TEST_VALUE_037="$(printf '%s' "$D_RECOVERY_CAMPAIGN_CONTROL_JSON" | jq -er '.schema == "setfarm.internal-production-recovery-control-value.v1" and .name == "recovery-campaign-hash" and .value == env.D_RECOVERY_CAMPAIGN_HASH and (.controlReceiptHash | test("^[0-9a-f]{64}$")) and (keys | sort == ["controlReceiptHash","name","schema","value"])')"
test "$D_SHELL_TEST_VALUE_037" = "true"
```

Expected: the imported golden status is schema-valid `decision:"accepted"` for C's full Profile 1–7 matrix, its required Profile 1–3 identities and all three resolved results bind the exact final operational Setfarm/MC epoch, and clean synchronized `main`, full Setfarm tests/build, no migration/authority failure, healthy services, and one schema-valid D campaign whose case 6 embeds C's exact immutable bug-fix template are proven. Before the first C preflight or workflow mutation, B's exact zero-input current verifier freshly resolves the immutable terminal application receipt, proves `D_FINAL_SETFARM_SOURCE_SHA` is a clean canonical descendant, and equality-checks the dedicated B migration module, ordered statements, named digest entry, digest, and schema projection. A strict D descendant passes and unrelated append-only aggregate registry entries remain valid; a nonancestor, changed B named module/entry/projection, corrupt terminal pair, or absent verification blocks with zero matrix/preflight/workflow mutation. `import-golden-status` parses the C receipt's `.finalReleaseEpoch`, requires schema `setfarm.internal-production-final-release-epoch.v1`, recomputes and matches `epochHash`, and then requires `.finalReleaseEpoch.setfarmSha`/`.missionControlSha` to equal the two operational SHAs; it rejects root-level release fields, `ready`, `running`, `blocked`, a missing/non-accepted required slot, or any final-release epoch differing by either SHA. Scalar and JSON `control-value` calls are separate fresh Node processes reading the same stored receipt; their values agree exactly and neither output contains a path or payload. Run the full tests/build once before the scenario sequence, not before every row. Live scenarios prove all-zero unrelated ownership immediately before their external action; exact target ownership is authenticated separately. Process-integration scenarios use a fresh isolated PostgreSQL database and own every child process they signal.

- [ ] **Step 1: Scenario 1 — restart the spawner after claim publication and before transfer**

Execute the exact recovery case through the actual-PostgreSQL process fixture; it stops the owned child synchronously after claim publication and before transfer, then starts a fresh child:

```bash
set -euo pipefail
require_authenticated_clean_main_setfarm_root_v1() {
  : "${SETFARM_ROOT:?authenticated clean-main Setfarm root is required}"
  : "${SETFARM_ROOT_EXPECTED_SHA:?authenticated clean-main Setfarm SHA is required}"
  case "$SETFARM_ROOT" in
    /*) ;;
    *) printf "SETFARM_ROOT must be absolute\n" >&2; return 1 ;;
  esac
  test -d "$SETFARM_ROOT"
  test ! -L "$SETFARM_ROOT"
  readonly SETFARM_ROOT SETFARM_ROOT_EXPECTED_SHA
  SETFARM_ROOT_TOP="$(git -C "$SETFARM_ROOT" rev-parse --show-toplevel)"
  SETFARM_ROOT_BRANCH="$(git -C "$SETFARM_ROOT" branch --show-current)"
  SETFARM_ROOT_HEAD="$(git -C "$SETFARM_ROOT" rev-parse HEAD)"
  SETFARM_ROOT_ORIGIN="$(git -C "$SETFARM_ROOT" rev-parse refs/remotes/origin/main)"
  SETFARM_ROOT_STATUS="$(git -C "$SETFARM_ROOT" status --porcelain=v1 --untracked-files=all)"
  test "$SETFARM_ROOT_TOP" = "$SETFARM_ROOT"
  test "$SETFARM_ROOT_BRANCH" = "main"
  test -z "$SETFARM_ROOT_STATUS"
  test "$SETFARM_ROOT_HEAD" = "$SETFARM_ROOT_ORIGIN"
  test "$SETFARM_ROOT_HEAD" = "$SETFARM_ROOT_EXPECTED_SHA"
}
D_SCENARIO_01_RELEASE_SHA="$(git rev-parse HEAD)"
require_authenticated_clean_main_setfarm_root_v1
D_SCENARIO_01_GUARD="$(npm --prefix "$SETFARM_ROOT" run --silent acceptance:recovery-scenario -- guard-scenario --command execute --campaign-hash "$D_RECOVERY_CAMPAIGN_HASH" --case-id recovery-01-cli-spawner-pre-transfer --scenario spawner_pre_transfer_restart --mode actual_postgres_process_integration --checkpoint spawner.claim_published_before_transfer --release-sha "$D_SCENARIO_01_RELEASE_SHA" --json)"
D_SCENARIO_01_GUARD_REF="$(printf '%s\n' "$D_SCENARIO_01_GUARD" | jq -er '.guardRef')"
D_SCENARIO_01_GUARD_HASH="$(printf '%s\n' "$D_SCENARIO_01_GUARD" | jq -er '.guardHash')"
require_authenticated_clean_main_setfarm_root_v1
npm --prefix "$SETFARM_ROOT" run --silent acceptance:recovery-scenario -- execute --campaign-hash "$D_RECOVERY_CAMPAIGN_HASH" --case-id recovery-01-cli-spawner-pre-transfer --scenario spawner_pre_transfer_restart --mode actual_postgres_process_integration --checkpoint spawner.claim_published_before_transfer --release-sha "$D_SCENARIO_01_RELEASE_SHA" --guard-ref "$D_SCENARIO_01_GUARD_REF" --guard-hash "$D_SCENARIO_01_GUARD_HASH"
require_authenticated_clean_main_setfarm_root_v1
npm --prefix "$SETFARM_ROOT" run --silent acceptance:recovery -- verify --campaign-hash "$D_RECOVERY_CAMPAIGN_HASH" --scenario spawner_pre_transfer_restart
```

Expected: the same claim generation transfers once after restart; no duplicate claim/runtime owner exists.

- [ ] **Step 2: Scenario 2 — restart the spawner after owner commit and before effect settlement**

```bash
set -euo pipefail
require_authenticated_clean_main_setfarm_root_v1() {
  : "${SETFARM_ROOT:?authenticated clean-main Setfarm root is required}"
  : "${SETFARM_ROOT_EXPECTED_SHA:?authenticated clean-main Setfarm SHA is required}"
  case "$SETFARM_ROOT" in
    /*) ;;
    *) printf "SETFARM_ROOT must be absolute\n" >&2; return 1 ;;
  esac
  test -d "$SETFARM_ROOT"
  test ! -L "$SETFARM_ROOT"
  readonly SETFARM_ROOT SETFARM_ROOT_EXPECTED_SHA
  SETFARM_ROOT_TOP="$(git -C "$SETFARM_ROOT" rev-parse --show-toplevel)"
  SETFARM_ROOT_BRANCH="$(git -C "$SETFARM_ROOT" branch --show-current)"
  SETFARM_ROOT_HEAD="$(git -C "$SETFARM_ROOT" rev-parse HEAD)"
  SETFARM_ROOT_ORIGIN="$(git -C "$SETFARM_ROOT" rev-parse refs/remotes/origin/main)"
  SETFARM_ROOT_STATUS="$(git -C "$SETFARM_ROOT" status --porcelain=v1 --untracked-files=all)"
  test "$SETFARM_ROOT_TOP" = "$SETFARM_ROOT"
  test "$SETFARM_ROOT_BRANCH" = "main"
  test -z "$SETFARM_ROOT_STATUS"
  test "$SETFARM_ROOT_HEAD" = "$SETFARM_ROOT_ORIGIN"
  test "$SETFARM_ROOT_HEAD" = "$SETFARM_ROOT_EXPECTED_SHA"
}
D_SCENARIO_02_RELEASE_SHA="$(git rev-parse HEAD)"
require_authenticated_clean_main_setfarm_root_v1
D_SCENARIO_02_GUARD="$(npm --prefix "$SETFARM_ROOT" run --silent acceptance:recovery-scenario -- guard-scenario --command execute --campaign-hash "$D_RECOVERY_CAMPAIGN_HASH" --case-id recovery-02-api-completion-owner-pre-effect --scenario completion_owner_pre_effect_restart --mode actual_postgres_process_integration --checkpoint completion.owner_committed_before_effects --release-sha "$D_SCENARIO_02_RELEASE_SHA" --json)"
D_SCENARIO_02_GUARD_REF="$(printf '%s\n' "$D_SCENARIO_02_GUARD" | jq -er '.guardRef')"
D_SCENARIO_02_GUARD_HASH="$(printf '%s\n' "$D_SCENARIO_02_GUARD" | jq -er '.guardHash')"
require_authenticated_clean_main_setfarm_root_v1
npm --prefix "$SETFARM_ROOT" run --silent acceptance:recovery-scenario -- execute --campaign-hash "$D_RECOVERY_CAMPAIGN_HASH" --case-id recovery-02-api-completion-owner-pre-effect --scenario completion_owner_pre_effect_restart --mode actual_postgres_process_integration --checkpoint completion.owner_committed_before_effects --release-sha "$D_SCENARIO_02_RELEASE_SHA" --guard-ref "$D_SCENARIO_02_GUARD_REF" --guard-hash "$D_SCENARIO_02_GUARD_HASH"
require_authenticated_clean_main_setfarm_root_v1
npm --prefix "$SETFARM_ROOT" run --silent acceptance:recovery -- verify --campaign-hash "$D_RECOVERY_CAMPAIGN_HASH" --scenario completion_owner_pre_effect_restart
```

Expected: the original completion owner resumes or is recovered canonically, each mandatory effect settles once, and no new owner identity is invented.

- [ ] **Step 3: Scenario 3 — restart Mission Control during an active run**

```bash
set -euo pipefail
require_authenticated_clean_main_setfarm_root_v1() {
  : "${SETFARM_ROOT:?authenticated clean-main Setfarm root is required}"
  : "${SETFARM_ROOT_EXPECTED_SHA:?authenticated clean-main Setfarm SHA is required}"
  case "$SETFARM_ROOT" in
    /*) ;;
    *) printf "SETFARM_ROOT must be absolute\n" >&2; return 1 ;;
  esac
  test -d "$SETFARM_ROOT"
  test ! -L "$SETFARM_ROOT"
  readonly SETFARM_ROOT SETFARM_ROOT_EXPECTED_SHA
  SETFARM_ROOT_TOP="$(git -C "$SETFARM_ROOT" rev-parse --show-toplevel)"
  SETFARM_ROOT_BRANCH="$(git -C "$SETFARM_ROOT" branch --show-current)"
  SETFARM_ROOT_HEAD="$(git -C "$SETFARM_ROOT" rev-parse HEAD)"
  SETFARM_ROOT_ORIGIN="$(git -C "$SETFARM_ROOT" rev-parse refs/remotes/origin/main)"
  SETFARM_ROOT_STATUS="$(git -C "$SETFARM_ROOT" status --porcelain=v1 --untracked-files=all)"
  test "$SETFARM_ROOT_TOP" = "$SETFARM_ROOT"
  test "$SETFARM_ROOT_BRANCH" = "main"
  test -z "$SETFARM_ROOT_STATUS"
  test "$SETFARM_ROOT_HEAD" = "$SETFARM_ROOT_ORIGIN"
  test "$SETFARM_ROOT_HEAD" = "$SETFARM_ROOT_EXPECTED_SHA"
}
D_SCENARIO_03_RELEASE_SHA="$(git rev-parse HEAD)"
require_authenticated_clean_main_setfarm_root_v1
D_SCENARIO_03_GUARD="$(npm --prefix "$SETFARM_ROOT" run --silent acceptance:recovery-scenario -- guard-scenario --command execute --campaign-hash "$D_RECOVERY_CAMPAIGN_HASH" --case-id recovery-03-web-mc-active --scenario mission_control_active_run_restart --mode live_operational --checkpoint active-run-generation --live-action restartMissionControl --release-sha "$D_SCENARIO_03_RELEASE_SHA" --json)"
D_SCENARIO_03_GUARD_REF="$(printf '%s\n' "$D_SCENARIO_03_GUARD" | jq -er '.guardRef')"
D_SCENARIO_03_GUARD_HASH="$(printf '%s\n' "$D_SCENARIO_03_GUARD" | jq -er '.guardHash')"
require_authenticated_clean_main_setfarm_root_v1
npm --prefix "$SETFARM_ROOT" run --silent acceptance:recovery-scenario -- execute --campaign-hash "$D_RECOVERY_CAMPAIGN_HASH" --case-id recovery-03-web-mc-active --scenario mission_control_active_run_restart --mode live_operational --checkpoint active-run-generation --live-action restartMissionControl --release-sha "$D_SCENARIO_03_RELEASE_SHA" --guard-ref "$D_SCENARIO_03_GUARD_REF" --guard-hash "$D_SCENARIO_03_GUARD_HASH"
require_authenticated_clean_main_setfarm_root_v1
npm --prefix "$SETFARM_ROOT" run --silent acceptance:recovery -- verify --campaign-hash "$D_RECOVERY_CAMPAIGN_HASH" --scenario mission_control_active_run_restart
```

Subproject B calls `tryAction(...)` during polling and records the one-shot receipt before terminal collection. Inside that checkpoint action, the browser observer is already polling the exact run page before the Mission Control LaunchAgent restart, records the disconnect/reconnect sequence, and returns only after a valid same-run visible state. The coordinator records pre/post reconciliation and snapshot hashes around the restart. If the run advances, it requires a monotonic later canonical snapshot for the same run rather than forcing equal volatile reconciliation hashes.

- [ ] **Step 4: Scenario 4 — restart the Setfarm dashboard without run mutation**

```bash
set -euo pipefail
require_authenticated_clean_main_setfarm_root_v1() {
  : "${SETFARM_ROOT:?authenticated clean-main Setfarm root is required}"
  : "${SETFARM_ROOT_EXPECTED_SHA:?authenticated clean-main Setfarm SHA is required}"
  case "$SETFARM_ROOT" in
    /*) ;;
    *) printf "SETFARM_ROOT must be absolute\n" >&2; return 1 ;;
  esac
  test -d "$SETFARM_ROOT"
  test ! -L "$SETFARM_ROOT"
  readonly SETFARM_ROOT SETFARM_ROOT_EXPECTED_SHA
  SETFARM_ROOT_TOP="$(git -C "$SETFARM_ROOT" rev-parse --show-toplevel)"
  SETFARM_ROOT_BRANCH="$(git -C "$SETFARM_ROOT" branch --show-current)"
  SETFARM_ROOT_HEAD="$(git -C "$SETFARM_ROOT" rev-parse HEAD)"
  SETFARM_ROOT_ORIGIN="$(git -C "$SETFARM_ROOT" rev-parse refs/remotes/origin/main)"
  SETFARM_ROOT_STATUS="$(git -C "$SETFARM_ROOT" status --porcelain=v1 --untracked-files=all)"
  test "$SETFARM_ROOT_TOP" = "$SETFARM_ROOT"
  test "$SETFARM_ROOT_BRANCH" = "main"
  test -z "$SETFARM_ROOT_STATUS"
  test "$SETFARM_ROOT_HEAD" = "$SETFARM_ROOT_ORIGIN"
  test "$SETFARM_ROOT_HEAD" = "$SETFARM_ROOT_EXPECTED_SHA"
}
D_SCENARIO_04_RELEASE_SHA="$(git rev-parse HEAD)"
require_authenticated_clean_main_setfarm_root_v1
D_SCENARIO_04_GUARD="$(npm --prefix "$SETFARM_ROOT" run --silent acceptance:recovery-scenario -- guard-scenario --command execute --campaign-hash "$D_RECOVERY_CAMPAIGN_HASH" --case-id recovery-04-web-dashboard-active --scenario dashboard_active_run_restart --mode live_operational --checkpoint active-run-generation --live-action restartDashboard --release-sha "$D_SCENARIO_04_RELEASE_SHA" --json)"
D_SCENARIO_04_GUARD_REF="$(printf '%s\n' "$D_SCENARIO_04_GUARD" | jq -er '.guardRef')"
D_SCENARIO_04_GUARD_HASH="$(printf '%s\n' "$D_SCENARIO_04_GUARD" | jq -er '.guardHash')"
require_authenticated_clean_main_setfarm_root_v1
npm --prefix "$SETFARM_ROOT" run --silent acceptance:recovery-scenario -- execute --campaign-hash "$D_RECOVERY_CAMPAIGN_HASH" --case-id recovery-04-web-dashboard-active --scenario dashboard_active_run_restart --mode live_operational --checkpoint active-run-generation --live-action restartDashboard --release-sha "$D_SCENARIO_04_RELEASE_SHA" --guard-ref "$D_SCENARIO_04_GUARD_REF" --guard-hash "$D_SCENARIO_04_GUARD_HASH"
require_authenticated_clean_main_setfarm_root_v1
npm --prefix "$SETFARM_ROOT" run --silent acceptance:recovery -- verify --campaign-hash "$D_RECOVERY_CAMPAIGN_HASH" --scenario dashboard_active_run_restart
```

Expected: browser polling began before restart, dashboard HTTP loss/recovery and post-recovery same-run visible-state hashes are stored, dashboard availability recovers, and the run row, claims, runtimes, completion/effect ownership, and snapshot remain unchanged except for legitimate agent progress independent of the dashboard. Capture after and verify.

- [ ] **Step 5: Settle and leak-check the scenario canaries**

Wait for canonical settlement; do not manually repair generated repositories. Query the exact target run IDs and verify zero open owner/effect/process/port/worktree leak. Scenarios 3 and 4 are not typed-terminal eligible: if either target cannot prove its positive accepted continuation, record a nonselectable `scenario_attempt_failure`, run the required review/remediation protocol, and execute a fresh coordinated attempt.

---

### Task 8: Execute recovery scenarios 5–10 through authenticated campaign seams

**Files:**

- Write local evidence only through B's fixed `resolveInternalProductionDataRootV1()/recovery` store.
- Update no source file during scenario execution.

- [ ] **Step 1: Scenario 5 — transient provider or quota failure**

Run the actual-PostgreSQL process fixture with its one-shot injected provider adapter configured to return typed `provider_rate_limited` once, followed by the admitted fallback. Capture `provider_quota_failure` after typed classification and before fallback at `spawner.provider_failure_before_fallback`; the store writes immutable evidence/attempt hashes and selects only a verified selectable attempt.

```bash
set -euo pipefail
require_authenticated_clean_main_setfarm_root_v1() {
  : "${SETFARM_ROOT:?authenticated clean-main Setfarm root is required}"
  : "${SETFARM_ROOT_EXPECTED_SHA:?authenticated clean-main Setfarm SHA is required}"
  case "$SETFARM_ROOT" in
    /*) ;;
    *) printf "SETFARM_ROOT must be absolute\n" >&2; return 1 ;;
  esac
  test -d "$SETFARM_ROOT"
  test ! -L "$SETFARM_ROOT"
  readonly SETFARM_ROOT SETFARM_ROOT_EXPECTED_SHA
  SETFARM_ROOT_TOP="$(git -C "$SETFARM_ROOT" rev-parse --show-toplevel)"
  SETFARM_ROOT_BRANCH="$(git -C "$SETFARM_ROOT" branch --show-current)"
  SETFARM_ROOT_HEAD="$(git -C "$SETFARM_ROOT" rev-parse HEAD)"
  SETFARM_ROOT_ORIGIN="$(git -C "$SETFARM_ROOT" rev-parse refs/remotes/origin/main)"
  SETFARM_ROOT_STATUS="$(git -C "$SETFARM_ROOT" status --porcelain=v1 --untracked-files=all)"
  test "$SETFARM_ROOT_TOP" = "$SETFARM_ROOT"
  test "$SETFARM_ROOT_BRANCH" = "main"
  test -z "$SETFARM_ROOT_STATUS"
  test "$SETFARM_ROOT_HEAD" = "$SETFARM_ROOT_ORIGIN"
  test "$SETFARM_ROOT_HEAD" = "$SETFARM_ROOT_EXPECTED_SHA"
}
D_SCENARIO_05_RELEASE_SHA="$(git rev-parse HEAD)"
require_authenticated_clean_main_setfarm_root_v1
D_SCENARIO_05_GUARD="$(npm --prefix "$SETFARM_ROOT" run --silent acceptance:recovery-scenario -- guard-scenario --command execute --campaign-hash "$D_RECOVERY_CAMPAIGN_HASH" --case-id recovery-05-cli-provider-quota --scenario provider_quota_failure --mode actual_postgres_process_integration --checkpoint spawner.provider_failure_before_fallback --release-sha "$D_SCENARIO_05_RELEASE_SHA" --json)"
D_SCENARIO_05_GUARD_REF="$(printf '%s\n' "$D_SCENARIO_05_GUARD" | jq -er '.guardRef')"
D_SCENARIO_05_GUARD_HASH="$(printf '%s\n' "$D_SCENARIO_05_GUARD" | jq -er '.guardHash')"
require_authenticated_clean_main_setfarm_root_v1
npm --prefix "$SETFARM_ROOT" run --silent acceptance:recovery-scenario -- execute --campaign-hash "$D_RECOVERY_CAMPAIGN_HASH" --case-id recovery-05-cli-provider-quota --scenario provider_quota_failure --mode actual_postgres_process_integration --checkpoint spawner.provider_failure_before_fallback --release-sha "$D_SCENARIO_05_RELEASE_SHA" --guard-ref "$D_SCENARIO_05_GUARD_REF" --guard-hash "$D_SCENARIO_05_GUARD_HASH"
require_authenticated_clean_main_setfarm_root_v1
npm --prefix "$SETFARM_ROOT" run --silent acceptance:recovery -- verify --campaign-hash "$D_RECOVERY_CAMPAIGN_HASH" --scenario provider_quota_failure
```

Expected: the observation is classified as provider/quota infrastructure, bounded retry/fallback count stays within the admitted policy, the same logical step resumes without duplicate claim ownership, and the run either continues or ends with an exact typed provider owner. A generic product failure or unlimited retry fails the scenario.

- [ ] **Step 2: Scenario 6 — actionable GitHub review comment**

Use the campaign's dedicated immutable `recovery-06-bugfix-review` template from C's checked seed `tests/fixtures/internal-production/bug-fix/`. B's durable scenario intent causes C to provision that intent's fresh fixture attempt before start; the campaign itself contains no pre-created repository identity. Its generated PR changes `src/slug.ts` and reaches the real C-owned `post-pr-review` step after `pr`. Once B observes the exact `workflow-step-claim-generation` and Setfarm-recorded PR head, its `actionable-post-pr-review-generation` predicate calls `tryAction(...)` from the non-terminal polling loop. Re-read the exact head, resolve the first changed `src/slug.ts` line, post the fixed authenticated inline body, and persist the strict receipt before returning the B one-shot receipt. Do not synthesize a database comment or invoke a test-only gate.

```bash
set -euo pipefail
require_authenticated_clean_main_setfarm_root_v1() {
  : "${SETFARM_ROOT:?authenticated clean-main Setfarm root is required}"
  : "${SETFARM_ROOT_EXPECTED_SHA:?authenticated clean-main Setfarm SHA is required}"
  case "$SETFARM_ROOT" in
    /*) ;;
    *) printf "SETFARM_ROOT must be absolute\n" >&2; return 1 ;;
  esac
  test -d "$SETFARM_ROOT"
  test ! -L "$SETFARM_ROOT"
  readonly SETFARM_ROOT SETFARM_ROOT_EXPECTED_SHA
  SETFARM_ROOT_TOP="$(git -C "$SETFARM_ROOT" rev-parse --show-toplevel)"
  SETFARM_ROOT_BRANCH="$(git -C "$SETFARM_ROOT" branch --show-current)"
  SETFARM_ROOT_HEAD="$(git -C "$SETFARM_ROOT" rev-parse HEAD)"
  SETFARM_ROOT_ORIGIN="$(git -C "$SETFARM_ROOT" rev-parse refs/remotes/origin/main)"
  SETFARM_ROOT_STATUS="$(git -C "$SETFARM_ROOT" status --porcelain=v1 --untracked-files=all)"
  test "$SETFARM_ROOT_TOP" = "$SETFARM_ROOT"
  test "$SETFARM_ROOT_BRANCH" = "main"
  test -z "$SETFARM_ROOT_STATUS"
  test "$SETFARM_ROOT_HEAD" = "$SETFARM_ROOT_ORIGIN"
  test "$SETFARM_ROOT_HEAD" = "$SETFARM_ROOT_EXPECTED_SHA"
}
D_SCENARIO_06_RELEASE_SHA="$(git rev-parse HEAD)"
require_authenticated_clean_main_setfarm_root_v1
D_SCENARIO_06_GUARD="$(npm --prefix "$SETFARM_ROOT" run --silent acceptance:recovery-scenario -- guard-scenario --command execute --campaign-hash "$D_RECOVERY_CAMPAIGN_HASH" --case-id recovery-06-bugfix-review --scenario github_review_retry --mode live_operational --checkpoint actionable-post-pr-review-generation --live-action publish-golden-actionable-post-pr-review --release-sha "$D_SCENARIO_06_RELEASE_SHA" --json)"
D_SCENARIO_06_GUARD_REF="$(printf '%s\n' "$D_SCENARIO_06_GUARD" | jq -er '.guardRef')"
D_SCENARIO_06_GUARD_HASH="$(printf '%s\n' "$D_SCENARIO_06_GUARD" | jq -er '.guardHash')"
require_authenticated_clean_main_setfarm_root_v1
npm --prefix "$SETFARM_ROOT" run --silent acceptance:recovery-scenario -- execute --campaign-hash "$D_RECOVERY_CAMPAIGN_HASH" --case-id recovery-06-bugfix-review --scenario github_review_retry --mode live_operational --checkpoint actionable-post-pr-review-generation --live-action publish-golden-actionable-post-pr-review --release-sha "$D_SCENARIO_06_RELEASE_SHA" --guard-ref "$D_SCENARIO_06_GUARD_REF" --guard-hash "$D_SCENARIO_06_GUARD_HASH"
require_authenticated_clean_main_setfarm_root_v1
npm --prefix "$SETFARM_ROOT" run --silent acceptance:recovery -- verify --campaign-hash "$D_RECOVERY_CAMPAIGN_HASH" --scenario github_review_retry
```

Expected: the C-owned production step binds the exact comment identity and authenticated body to the same open `post-pr-review` claim/runtime generation, performs one manifest-scoped fixer correction, pushes the same PR branch, records resolution evidence, re-runs declared tests and exact completion head/thread checks, and observes the thread resolved or outdated at the accepted head SHA. Prose-only evidence, a stale generation/head, the old nonexistent `review` step, a route to the earlier `fix` step, or a different campaign fixture fails.

- [ ] **Step 3: Scenario 7 — runtime crash**

Run the actual process fixture derived from `v3-darwin-runtime-isolation.test.ts`. It resolves the target PID, process group, and listener from its owned runtime receipt, proves command, port, run ID, and generation, then sends `SIGTERM` to that exact process group. Capture `runtime_crash_cleanup` at `spawner.runtime_owned_before_fault`; the store writes immutable evidence/attempt hashes and selects only a verified selectable attempt.

```bash
set -euo pipefail
require_authenticated_clean_main_setfarm_root_v1() {
  : "${SETFARM_ROOT:?authenticated clean-main Setfarm root is required}"
  : "${SETFARM_ROOT_EXPECTED_SHA:?authenticated clean-main Setfarm SHA is required}"
  case "$SETFARM_ROOT" in
    /*) ;;
    *) printf "SETFARM_ROOT must be absolute\n" >&2; return 1 ;;
  esac
  test -d "$SETFARM_ROOT"
  test ! -L "$SETFARM_ROOT"
  readonly SETFARM_ROOT SETFARM_ROOT_EXPECTED_SHA
  SETFARM_ROOT_TOP="$(git -C "$SETFARM_ROOT" rev-parse --show-toplevel)"
  SETFARM_ROOT_BRANCH="$(git -C "$SETFARM_ROOT" branch --show-current)"
  SETFARM_ROOT_HEAD="$(git -C "$SETFARM_ROOT" rev-parse HEAD)"
  SETFARM_ROOT_ORIGIN="$(git -C "$SETFARM_ROOT" rev-parse refs/remotes/origin/main)"
  SETFARM_ROOT_STATUS="$(git -C "$SETFARM_ROOT" status --porcelain=v1 --untracked-files=all)"
  test "$SETFARM_ROOT_TOP" = "$SETFARM_ROOT"
  test "$SETFARM_ROOT_BRANCH" = "main"
  test -z "$SETFARM_ROOT_STATUS"
  test "$SETFARM_ROOT_HEAD" = "$SETFARM_ROOT_ORIGIN"
  test "$SETFARM_ROOT_HEAD" = "$SETFARM_ROOT_EXPECTED_SHA"
}
D_SCENARIO_07_RELEASE_SHA="$(git rev-parse HEAD)"
require_authenticated_clean_main_setfarm_root_v1
D_SCENARIO_07_GUARD="$(npm --prefix "$SETFARM_ROOT" run --silent acceptance:recovery-scenario -- guard-scenario --command execute --campaign-hash "$D_RECOVERY_CAMPAIGN_HASH" --case-id recovery-07-web-runtime-crash --scenario runtime_crash_cleanup --mode actual_postgres_process_integration --checkpoint spawner.runtime_owned_before_fault --release-sha "$D_SCENARIO_07_RELEASE_SHA" --json)"
D_SCENARIO_07_GUARD_REF="$(printf '%s\n' "$D_SCENARIO_07_GUARD" | jq -er '.guardRef')"
D_SCENARIO_07_GUARD_HASH="$(printf '%s\n' "$D_SCENARIO_07_GUARD" | jq -er '.guardHash')"
require_authenticated_clean_main_setfarm_root_v1
npm --prefix "$SETFARM_ROOT" run --silent acceptance:recovery-scenario -- execute --campaign-hash "$D_RECOVERY_CAMPAIGN_HASH" --case-id recovery-07-web-runtime-crash --scenario runtime_crash_cleanup --mode actual_postgres_process_integration --checkpoint spawner.runtime_owned_before_fault --release-sha "$D_SCENARIO_07_RELEASE_SHA" --guard-ref "$D_SCENARIO_07_GUARD_REF" --guard-hash "$D_SCENARIO_07_GUARD_HASH"
require_authenticated_clean_main_setfarm_root_v1
npm --prefix "$SETFARM_ROOT" run --silent acceptance:recovery -- verify --campaign-hash "$D_RECOVERY_CAMPAIGN_HASH" --scenario runtime_crash_cleanup
```

Expected: the runtime session becomes released, the exact listener disappears, ownership is retried only when canonical policy allows, and the positive crash-cleanup assertions prove an accepted continuation with no surviving process/port owner. A terminal or refusal is a nonselectable attempt failure for scenario 7, not a typed-terminal success. Never run `kill`, `pkill`, or `killall` manually.

- [ ] **Step 4: Scenario 8 — supervisor block and generation-safe implementation retry**

Use the actual-PostgreSQL controlled fixture with one deterministic authenticated supervisor assertion failure. Capture `supervisor_generation_safe_retry` after the exact directive is durable and before the generation-safe claim is published; the store writes immutable evidence/attempt hashes and selects only a verified selectable attempt.

```bash
set -euo pipefail
require_authenticated_clean_main_setfarm_root_v1() {
  : "${SETFARM_ROOT:?authenticated clean-main Setfarm root is required}"
  : "${SETFARM_ROOT_EXPECTED_SHA:?authenticated clean-main Setfarm SHA is required}"
  case "$SETFARM_ROOT" in
    /*) ;;
    *) printf "SETFARM_ROOT must be absolute\n" >&2; return 1 ;;
  esac
  test -d "$SETFARM_ROOT"
  test ! -L "$SETFARM_ROOT"
  readonly SETFARM_ROOT SETFARM_ROOT_EXPECTED_SHA
  SETFARM_ROOT_TOP="$(git -C "$SETFARM_ROOT" rev-parse --show-toplevel)"
  SETFARM_ROOT_BRANCH="$(git -C "$SETFARM_ROOT" branch --show-current)"
  SETFARM_ROOT_HEAD="$(git -C "$SETFARM_ROOT" rev-parse HEAD)"
  SETFARM_ROOT_ORIGIN="$(git -C "$SETFARM_ROOT" rev-parse refs/remotes/origin/main)"
  SETFARM_ROOT_STATUS="$(git -C "$SETFARM_ROOT" status --porcelain=v1 --untracked-files=all)"
  test "$SETFARM_ROOT_TOP" = "$SETFARM_ROOT"
  test "$SETFARM_ROOT_BRANCH" = "main"
  test -z "$SETFARM_ROOT_STATUS"
  test "$SETFARM_ROOT_HEAD" = "$SETFARM_ROOT_ORIGIN"
  test "$SETFARM_ROOT_HEAD" = "$SETFARM_ROOT_EXPECTED_SHA"
}
D_SCENARIO_08_RELEASE_SHA="$(git rev-parse HEAD)"
require_authenticated_clean_main_setfarm_root_v1
D_SCENARIO_08_GUARD="$(npm --prefix "$SETFARM_ROOT" run --silent acceptance:recovery-scenario -- guard-scenario --command execute --campaign-hash "$D_RECOVERY_CAMPAIGN_HASH" --case-id recovery-08-web-supervisor-block --scenario supervisor_generation_safe_retry --mode actual_postgres_process_integration --checkpoint supervisor.directive_authenticated_before_generation_claim --release-sha "$D_SCENARIO_08_RELEASE_SHA" --json)"
D_SCENARIO_08_GUARD_REF="$(printf '%s\n' "$D_SCENARIO_08_GUARD" | jq -er '.guardRef')"
D_SCENARIO_08_GUARD_HASH="$(printf '%s\n' "$D_SCENARIO_08_GUARD" | jq -er '.guardHash')"
require_authenticated_clean_main_setfarm_root_v1
npm --prefix "$SETFARM_ROOT" run --silent acceptance:recovery-scenario -- execute --campaign-hash "$D_RECOVERY_CAMPAIGN_HASH" --case-id recovery-08-web-supervisor-block --scenario supervisor_generation_safe_retry --mode actual_postgres_process_integration --checkpoint supervisor.directive_authenticated_before_generation_claim --release-sha "$D_SCENARIO_08_RELEASE_SHA" --guard-ref "$D_SCENARIO_08_GUARD_REF" --guard-hash "$D_SCENARIO_08_GUARD_HASH"
require_authenticated_clean_main_setfarm_root_v1
npm --prefix "$SETFARM_ROOT" run --silent acceptance:recovery -- verify --campaign-hash "$D_RECOVERY_CAMPAIGN_HASH" --scenario supervisor_generation_safe_retry
```

Expected: the retry carries the exact authenticated supervisor feedback identity and source revision, increments the execution generation, invalidates stale completion attempts, and re-verifies the corrected source. Direct repository edits by the operator fail the scenario.

- [ ] **Step 5: Scenario 9 — post-owner completion recovery exactly once**

Use the actual-PostgreSQL child fixture to commit the runtime-completion owner, apply one mandatory effect through the real handler, emit the one-use checkpoint frame before settlement, terminate that owned child, and start a fresh recovery child. Capture `post_owner_exactly_once_recovery` at `completion.effect_applied_before_settlement`; the store writes immutable evidence/attempt hashes and selects only a verified selectable attempt.

```bash
set -euo pipefail
require_authenticated_clean_main_setfarm_root_v1() {
  : "${SETFARM_ROOT:?authenticated clean-main Setfarm root is required}"
  : "${SETFARM_ROOT_EXPECTED_SHA:?authenticated clean-main Setfarm SHA is required}"
  case "$SETFARM_ROOT" in
    /*) ;;
    *) printf "SETFARM_ROOT must be absolute\n" >&2; return 1 ;;
  esac
  test -d "$SETFARM_ROOT"
  test ! -L "$SETFARM_ROOT"
  readonly SETFARM_ROOT SETFARM_ROOT_EXPECTED_SHA
  SETFARM_ROOT_TOP="$(git -C "$SETFARM_ROOT" rev-parse --show-toplevel)"
  SETFARM_ROOT_BRANCH="$(git -C "$SETFARM_ROOT" branch --show-current)"
  SETFARM_ROOT_HEAD="$(git -C "$SETFARM_ROOT" rev-parse HEAD)"
  SETFARM_ROOT_ORIGIN="$(git -C "$SETFARM_ROOT" rev-parse refs/remotes/origin/main)"
  SETFARM_ROOT_STATUS="$(git -C "$SETFARM_ROOT" status --porcelain=v1 --untracked-files=all)"
  test "$SETFARM_ROOT_TOP" = "$SETFARM_ROOT"
  test "$SETFARM_ROOT_BRANCH" = "main"
  test -z "$SETFARM_ROOT_STATUS"
  test "$SETFARM_ROOT_HEAD" = "$SETFARM_ROOT_ORIGIN"
  test "$SETFARM_ROOT_HEAD" = "$SETFARM_ROOT_EXPECTED_SHA"
}
D_SCENARIO_09_RELEASE_SHA="$(git rev-parse HEAD)"
require_authenticated_clean_main_setfarm_root_v1
D_SCENARIO_09_GUARD="$(npm --prefix "$SETFARM_ROOT" run --silent acceptance:recovery-scenario -- guard-scenario --command execute --campaign-hash "$D_RECOVERY_CAMPAIGN_HASH" --case-id recovery-09-api-post-owner --scenario post_owner_exactly_once_recovery --mode actual_postgres_process_integration --checkpoint completion.effect_applied_before_settlement --release-sha "$D_SCENARIO_09_RELEASE_SHA" --json)"
D_SCENARIO_09_GUARD_REF="$(printf '%s\n' "$D_SCENARIO_09_GUARD" | jq -er '.guardRef')"
D_SCENARIO_09_GUARD_HASH="$(printf '%s\n' "$D_SCENARIO_09_GUARD" | jq -er '.guardHash')"
require_authenticated_clean_main_setfarm_root_v1
npm --prefix "$SETFARM_ROOT" run --silent acceptance:recovery-scenario -- execute --campaign-hash "$D_RECOVERY_CAMPAIGN_HASH" --case-id recovery-09-api-post-owner --scenario post_owner_exactly_once_recovery --mode actual_postgres_process_integration --checkpoint completion.effect_applied_before_settlement --release-sha "$D_SCENARIO_09_RELEASE_SHA" --guard-ref "$D_SCENARIO_09_GUARD_REF" --guard-hash "$D_SCENARIO_09_GUARD_HASH"
require_authenticated_clean_main_setfarm_root_v1
npm --prefix "$SETFARM_ROOT" run --silent acceptance:recovery -- verify --campaign-hash "$D_RECOVERY_CAMPAIGN_HASH" --scenario post_owner_exactly_once_recovery
```

Expected: recovery observes the committed owner, applies each mandatory effect once, records `effects_committed`, and leaves no retryable/processing/quarantined mandatory effect. Compare effect identity and mutation count before/after; two applications fail even if final values look correct.

- [ ] **Step 6: Scenario 10 — restart an accepted API product and retain durable state**

Resolve the accepted Node API product contract from `$D_API_RESULT_HASH` through `RecoveryAcceptedProductRuntimePort.resolve(...)`; no prior verifier lease or live origin is assumed. The port rehydrates only the exact sealed `http-service` runtime and accepted clean source, handles an exact still-live deployment receipt runtime or proven already-released disposition, starts session A, creates and reads the fixed acceptance record `internal-production-durable-state-01`, stops it, starts fresh session B from the same sealed authority, and reads the same record again without rewriting it. Capture `api_durable_state_restart` for `$D_API_RUN_ID`, checkpoint `accepted_product_durable_state_written`, and action `admitted_product_restart`; the store writes immutable evidence/attempt hashes and selects only a verified selectable attempt.

```bash
set -euo pipefail
require_authenticated_clean_main_setfarm_root_v1() {
  : "${SETFARM_ROOT:?authenticated clean-main Setfarm root is required}"
  : "${SETFARM_ROOT_EXPECTED_SHA:?authenticated clean-main Setfarm SHA is required}"
  case "$SETFARM_ROOT" in
    /*) ;;
    *) printf "SETFARM_ROOT must be absolute\n" >&2; return 1 ;;
  esac
  test -d "$SETFARM_ROOT"
  test ! -L "$SETFARM_ROOT"
  readonly SETFARM_ROOT SETFARM_ROOT_EXPECTED_SHA
  SETFARM_ROOT_TOP="$(git -C "$SETFARM_ROOT" rev-parse --show-toplevel)"
  SETFARM_ROOT_BRANCH="$(git -C "$SETFARM_ROOT" branch --show-current)"
  SETFARM_ROOT_HEAD="$(git -C "$SETFARM_ROOT" rev-parse HEAD)"
  SETFARM_ROOT_ORIGIN="$(git -C "$SETFARM_ROOT" rev-parse refs/remotes/origin/main)"
  SETFARM_ROOT_STATUS="$(git -C "$SETFARM_ROOT" status --porcelain=v1 --untracked-files=all)"
  test "$SETFARM_ROOT_TOP" = "$SETFARM_ROOT"
  test "$SETFARM_ROOT_BRANCH" = "main"
  test -z "$SETFARM_ROOT_STATUS"
  test "$SETFARM_ROOT_HEAD" = "$SETFARM_ROOT_ORIGIN"
  test "$SETFARM_ROOT_HEAD" = "$SETFARM_ROOT_EXPECTED_SHA"
}
require_authenticated_clean_main_setfarm_root_v1
D_SCENARIO_10_GUARD="$(npm --prefix "$SETFARM_ROOT" run --silent acceptance:recovery-scenario -- guard-scenario --command reuse --campaign-hash "$D_RECOVERY_CAMPAIGN_HASH" --source-result-hash "$D_API_RESULT_HASH" --scenario api_durable_state_restart --mode live_operational --checkpoint accepted_product_durable_state_written --runtime-action restartAcceptedProduct --json)"
D_SCENARIO_10_GUARD_REF="$(printf '%s\n' "$D_SCENARIO_10_GUARD" | jq -er '.guardRef')"
D_SCENARIO_10_GUARD_HASH="$(printf '%s\n' "$D_SCENARIO_10_GUARD" | jq -er '.guardHash')"
require_authenticated_clean_main_setfarm_root_v1
npm --prefix "$SETFARM_ROOT" run --silent acceptance:recovery-scenario -- reuse --campaign-hash "$D_RECOVERY_CAMPAIGN_HASH" --source-result-hash "$D_API_RESULT_HASH" --scenario api_durable_state_restart --mode live_operational --checkpoint accepted_product_durable_state_written --runtime-action restartAcceptedProduct --guard-ref "$D_SCENARIO_10_GUARD_REF" --guard-hash "$D_SCENARIO_10_GUARD_HASH"
require_authenticated_clean_main_setfarm_root_v1
npm --prefix "$SETFARM_ROOT" run --silent acceptance:recovery -- verify --campaign-hash "$D_RECOVERY_CAMPAIGN_HASH" --scenario api_durable_state_restart
```

Expected: the asynchronous verifier resolves the stored result, packet, runtime contract, deployment receipt, transfer acknowledgement, and action receipt; both HTTP observations match the fixed profile contract; session B reads the same durable record after session A is gone; the accepted source/tree remains exact and clean; and no original/session-A/session-B process, listener, or port lease remains.

- [ ] **Step 7: Verify all ten local evidence records**

```bash
set -euo pipefail
require_authenticated_clean_main_setfarm_root_v1() {
  : "${SETFARM_ROOT:?authenticated clean-main Setfarm root is required}"
  : "${SETFARM_ROOT_EXPECTED_SHA:?authenticated clean-main Setfarm SHA is required}"
  case "$SETFARM_ROOT" in
    /*) ;;
    *) printf "SETFARM_ROOT must be absolute\n" >&2; return 1 ;;
  esac
  test -d "$SETFARM_ROOT"
  test ! -L "$SETFARM_ROOT"
  readonly SETFARM_ROOT SETFARM_ROOT_EXPECTED_SHA
  SETFARM_ROOT_TOP="$(git -C "$SETFARM_ROOT" rev-parse --show-toplevel)"
  SETFARM_ROOT_BRANCH="$(git -C "$SETFARM_ROOT" branch --show-current)"
  SETFARM_ROOT_HEAD="$(git -C "$SETFARM_ROOT" rev-parse HEAD)"
  SETFARM_ROOT_ORIGIN="$(git -C "$SETFARM_ROOT" rev-parse refs/remotes/origin/main)"
  SETFARM_ROOT_STATUS="$(git -C "$SETFARM_ROOT" status --porcelain=v1 --untracked-files=all)"
  test "$SETFARM_ROOT_TOP" = "$SETFARM_ROOT"
  test "$SETFARM_ROOT_BRANCH" = "main"
  test -z "$SETFARM_ROOT_STATUS"
  test "$SETFARM_ROOT_HEAD" = "$SETFARM_ROOT_ORIGIN"
  test "$SETFARM_ROOT_HEAD" = "$SETFARM_ROOT_EXPECTED_SHA"
}
require_authenticated_clean_main_setfarm_root_v1
npm --prefix "$SETFARM_ROOT" run --silent acceptance:recovery -- verify-campaign --campaign-hash "$D_RECOVERY_CAMPAIGN_HASH"
```

Expected: exactly ten selections resolve to ten content-addressed selectable attempts/evidence records that pass pure and asynchronous verification; every failed/polluted historical attempt and preflight refusal remains queryable, every golden result and action receipt resolves by hash/ref, scenarios 1–4/7–10 are accepted continuations with positive scenario proof, only scenarios 5/6 may carry their exact finite typed terminal, and no ownership issue remains.

---

### Task 9: Reconcile live PostgreSQL, Setfarm, Mission Control API, and UI

**Files:**

- Verify final merged source only; write bounded screenshot/trace hashes through B's global private recovery browser store outside every worktree.

- [ ] **Step 1: Reconcile exact campaign run IDs through the API**

```bash
set -euo pipefail
require_authenticated_clean_main_setfarm_root_v1() {
  : "${SETFARM_ROOT:?authenticated clean-main Setfarm root is required}"
  : "${SETFARM_ROOT_EXPECTED_SHA:?authenticated clean-main Setfarm SHA is required}"
  case "$SETFARM_ROOT" in
    /*) ;;
    *) printf "SETFARM_ROOT must be absolute\n" >&2; return 1 ;;
  esac
  test -d "$SETFARM_ROOT"
  test ! -L "$SETFARM_ROOT"
  readonly SETFARM_ROOT SETFARM_ROOT_EXPECTED_SHA
  SETFARM_ROOT_TOP="$(git -C "$SETFARM_ROOT" rev-parse --show-toplevel)"
  SETFARM_ROOT_BRANCH="$(git -C "$SETFARM_ROOT" branch --show-current)"
  SETFARM_ROOT_HEAD="$(git -C "$SETFARM_ROOT" rev-parse HEAD)"
  SETFARM_ROOT_ORIGIN="$(git -C "$SETFARM_ROOT" rev-parse refs/remotes/origin/main)"
  SETFARM_ROOT_STATUS="$(git -C "$SETFARM_ROOT" status --porcelain=v1 --untracked-files=all)"
  test "$SETFARM_ROOT_TOP" = "$SETFARM_ROOT"
  test "$SETFARM_ROOT_BRANCH" = "main"
  test -z "$SETFARM_ROOT_STATUS"
  test "$SETFARM_ROOT_HEAD" = "$SETFARM_ROOT_ORIGIN"
  test "$SETFARM_ROOT_HEAD" = "$SETFARM_ROOT_EXPECTED_SHA"
}
D_CAMPAIGN_RUN_IDS="$(
  require_authenticated_clean_main_setfarm_root_v1
  npm --prefix "$SETFARM_ROOT" run --silent acceptance:recovery -- list-live-run-ids --campaign-hash "$D_RECOVERY_CAMPAIGN_HASH"
)"
export D_CAMPAIGN_RUN_IDS
while IFS= read -r D_RUN_ID; do
  curl -fsS "http://127.0.0.1:3333/api/runs/$D_RUN_ID/operational-snapshot" | jq -e --arg id "$D_RUN_ID" '
    .run.id == $id
    and (.run.status | type == "string")
    and (.run.terminal | type == "boolean")'
  curl -fsS "http://127.0.0.1:3080/api/setfarm/runs/$D_RUN_ID/reconciliation" | jq -e --arg id "$D_RUN_ID" '
    .runId == $id
    and .result == "matched"
    and .productionAuthority == false
    and .database.id == $id
    and .setfarm.runId == $id
    and .database.status == .setfarm.runStatus'
done <<< "$D_CAMPAIGN_RUN_IDS"
```

Expected: every golden or live-operational recovery run has exact identity and a matched diagnostic envelope. Isolated-PostgreSQL process-fixture run IDs are intentionally excluded from live Mission Control queries and are reconciled against their own direct DB/checkpoint evidence. The fixed `reconcile-live-surfaces` command in Step 2 captures Product Build Authority with its HTTP status and typed body: unavailable/refused is valid only when its canonical disposition says so and is never promoted to sealed.

- [ ] **Step 2: Reconcile project and overview counts**

```bash
set -euo pipefail
require_authenticated_clean_main_setfarm_root_v1() {
  : "${SETFARM_ROOT:?authenticated clean-main Setfarm root is required}"
  : "${SETFARM_ROOT_EXPECTED_SHA:?authenticated clean-main Setfarm SHA is required}"
  case "$SETFARM_ROOT" in
    /*) ;;
    *) printf "SETFARM_ROOT must be absolute\n" >&2; return 1 ;;
  esac
  test -d "$SETFARM_ROOT"
  test ! -L "$SETFARM_ROOT"
  readonly SETFARM_ROOT SETFARM_ROOT_EXPECTED_SHA
  SETFARM_ROOT_TOP="$(git -C "$SETFARM_ROOT" rev-parse --show-toplevel)"
  SETFARM_ROOT_BRANCH="$(git -C "$SETFARM_ROOT" branch --show-current)"
  SETFARM_ROOT_HEAD="$(git -C "$SETFARM_ROOT" rev-parse HEAD)"
  SETFARM_ROOT_ORIGIN="$(git -C "$SETFARM_ROOT" rev-parse refs/remotes/origin/main)"
  SETFARM_ROOT_STATUS="$(git -C "$SETFARM_ROOT" status --porcelain=v1 --untracked-files=all)"
  test "$SETFARM_ROOT_TOP" = "$SETFARM_ROOT"
  test "$SETFARM_ROOT_BRANCH" = "main"
  test -z "$SETFARM_ROOT_STATUS"
  test "$SETFARM_ROOT_HEAD" = "$SETFARM_ROOT_ORIGIN"
  test "$SETFARM_ROOT_HEAD" = "$SETFARM_ROOT_EXPECTED_SHA"
}
require_authenticated_clean_main_setfarm_root_v1
npm --prefix "$SETFARM_ROOT" run --silent acceptance:recovery -- reconcile-live-surfaces --campaign-hash "$D_RECOVERY_CAMPAIGN_HASH"
require_authenticated_clean_main_setfarm_root_v1
npm --prefix "$SETFARM_ROOT" run --silent acceptance:recovery -- verify-campaign --campaign-hash "$D_RECOVERY_CAMPAIGN_HASH"
```

`reconcile-live-surfaces` performs parameterized exact-UUID and global active-set reads, GETs `/api/projects`, `/api/runs`, and `/api/overview`, and verifies the same predicates formerly shown as shell pipelines. D imports A's exact Setfarm producer `isSetfarmOperationalActiveRunStatusV1` unaliased only from `../contracts/operational-active-run-status-v1.js`; Mission Control's project producer imports only A's vendored-schema-backed `server/shared/setfarm-operational-active-run-status-v1.ts`. For every project the equality is exact: `execution.active === (execution.runStatus !== null && isSetfarmOperationalActiveRunStatusV1(execution.runStatus))`; whenever active, `execution.state === execution.runStatus` byte-for-byte. All four active counts are numerically identical; DB, run-API and project ordered active-ID sets are byte-identical; project bindings are one-to-one with distinct nonempty `execution.runId`; and every terminal execution has terminal public status. It stores only counts, ordered UUIDs, response hashes, predicate results, and a receipt hash below the global private ``resolveInternalProductionDataRootV1()/recovery/${campaignHash}/reconciliation`` child. Expected: the historical 112 raw `status:"active"` registry values do not appear as 112 active executions, and failed/cancelled history remains visible.

`recovery-source-boundary.test.ts`, Mission Control `tests/setfarm-contract-vendor.test.ts`, and the reconciliation/render tests require both exact A imports and the fourteen-entry lock. They exercise `running`, `resuming`, `cancelling`, `failing`, `pending`, `completed`, `failed`, `cancelled`, null, and unknown status values; reject `active === runStatus`, truthiness, a local tuple/set/predicate, stale ten- or twelve-artifact vendor locks, active `state` drift, and any second normalization rule.

- [ ] **Step 3: Run a live browser acceptance smoke**

Run the fixed browser command. It re-resolves the active-run route/state hashes captured inside scenario 3 and 4 checkpoints, then visits `/`, `/projects`, `/setfarm`, `/setfarm/active`, and current failed, cancelled, and completed run pages at the supported desktop viewport. It does not pretend a settled campaign still has a live active run:

```bash
set -euo pipefail
require_authenticated_clean_main_setfarm_root_v1() {
  : "${SETFARM_ROOT:?authenticated clean-main Setfarm root is required}"
  : "${SETFARM_ROOT_EXPECTED_SHA:?authenticated clean-main Setfarm SHA is required}"
  case "$SETFARM_ROOT" in
    /*) ;;
    *) printf "SETFARM_ROOT must be absolute\n" >&2; return 1 ;;
  esac
  test -d "$SETFARM_ROOT"
  test ! -L "$SETFARM_ROOT"
  readonly SETFARM_ROOT SETFARM_ROOT_EXPECTED_SHA
  SETFARM_ROOT_TOP="$(git -C "$SETFARM_ROOT" rev-parse --show-toplevel)"
  SETFARM_ROOT_BRANCH="$(git -C "$SETFARM_ROOT" branch --show-current)"
  SETFARM_ROOT_HEAD="$(git -C "$SETFARM_ROOT" rev-parse HEAD)"
  SETFARM_ROOT_ORIGIN="$(git -C "$SETFARM_ROOT" rev-parse refs/remotes/origin/main)"
  SETFARM_ROOT_STATUS="$(git -C "$SETFARM_ROOT" status --porcelain=v1 --untracked-files=all)"
  test "$SETFARM_ROOT_TOP" = "$SETFARM_ROOT"
  test "$SETFARM_ROOT_BRANCH" = "main"
  test -z "$SETFARM_ROOT_STATUS"
  test "$SETFARM_ROOT_HEAD" = "$SETFARM_ROOT_ORIGIN"
  test "$SETFARM_ROOT_HEAD" = "$SETFARM_ROOT_EXPECTED_SHA"
}
require_authenticated_clean_main_setfarm_root_v1
npm --prefix "$SETFARM_ROOT" run --silent acceptance:recovery -- browser-acceptance --campaign-hash "$D_RECOVERY_CAMPAIGN_HASH"
require_authenticated_clean_main_setfarm_root_v1
npm --prefix "$SETFARM_ROOT" run --silent acceptance:recovery -- verify-browser-acceptance --campaign-hash "$D_RECOVERY_CAMPAIGN_HASH"
```

Verify:

- counts equal the API and DB census;
- the active page shows no terminal fallback when there is no active run;
- protocol, step/story progress, claims/runtimes, Product Build Authority, operational evidence, retryability, failure owner, and terminal state match the same Setfarm snapshots;
- the reconciliation panel says matched or shows an explicit non-authoritative mismatch;
- state updates without a full browser reload during one active run;
- scenario 3's stored browser receipt proves polling began before the Mission Control restart, observed disconnect/reconnect, and recovered the same run; scenario 4's receipt proves polling began before dashboard restart, observed dashboard HTTP loss/recovery, and retained the same run;
- browser console has no uncaught application error;
- Tab, Shift+Tab, Enter, and Space reach and operate primary controls with a visible focus indicator.

The command stores bounded trace/screenshot hashes and route/result summaries only below B's fixed ``resolveInternalProductionDataRootV1()/recovery/${D_RECOVERY_CAMPAIGN_HASH}/browser/`` child through the no-follow store. It must include and revalidate the scenario-3/4 action browser hashes and exact active/failed/cancelled/completed terminal-page hashes. No caller path or screenshot byte enters tracked evidence.

- [ ] **Step 4: Verify service ownership and post-campaign zero leaks**

Use exact listener ownership commands and canonical Setfarm census readers. Expected: one intended Mission Control listener on `3080`, one Setfarm dashboard listener on `3333`, one OpenClaw gateway owner on `18789`, no duplicate daemon, and zero active claim/runtime/completion/effect/process/port/lease/worktree owner after all targets settle.

---

### Task 10: Privately finalize the recovery matrix and hand it to the final E docs claim

**Files:**

- Create through B's authenticated combined session: `docs/review-packets/internal-production/epoch-<epochHash>-closure-<closureGenerationHash>/recovery-matrix.md` without exposing the path to D.
- Create through B's authenticated combined session: `docs/review-packets/internal-production/epoch-<epochHash>-closure-<closureGenerationHash>/recovery-reconciliation.md` without exposing the path to D.

**Interfaces:**

The two committed Markdown authorities have distinct bounded render models:

```ts
interface RecoveryMatrixMarkdownModelV1 {
  schema: "setfarm.internal-production-recovery-matrix-markdown-model.v1";
  campaignId: "internal-production-2026-08-13";
  finalReleaseEpoch: GoldenFinalReleaseEpochV1;
  setfarmCommit: string;
  missionControlCommit: string;
  scenarios: readonly RecoveryMatrixScenarioSummaryV1[];
}

interface RecoveryReconciliationMarkdownModelV1 {
  schema: "setfarm.internal-production-recovery-reconciliation-markdown-model.v1";
  campaignId: "internal-production-2026-08-13";
  finalReleaseEpoch: GoldenFinalReleaseEpochV1;
  reconciliationReceiptHash: string;
  browserAcceptanceReceiptHash: string;
  zeroOwnerReceiptHash: string;
  checkedLiveRunIds: readonly string[];
  unresolvedMismatchCount: 0;
  browserConsoleErrorCount: 0;
  remainingOwnerCount: 0;
}

type RecoveryMatrixScenarioSummaryCommonV1 = Readonly<{
  evidenceMode: "actual_postgres_process_integration" | "live_operational";
  runId: string;
  beforeHash: string;
  afterHash: string;
  evidenceHash: string;
  leakIssues: [];
}>;

type RecoveryMatrixScenarioSummaryV1 =
  | Readonly<RecoveryMatrixScenarioSummaryCommonV1 & {
      scenarioId: RecoveryTypedTerminalScenarioIdV1;
      result: "accepted_continuation" | "typed_terminal";
    }>
  | Readonly<RecoveryMatrixScenarioSummaryCommonV1 & {
      scenarioId: Exclude<RecoveryScenarioId, RecoveryTypedTerminalScenarioIdV1>;
      result: "accepted_continuation";
    }>;

export function renderRecoveryMatrixMarkdownV1(
  model: RecoveryMatrixMarkdownModelV1,
): Uint8Array;

export function renderRecoveryReconciliationMarkdownV1(
  model: RecoveryReconciliationMarkdownModelV1,
): Uint8Array;

export function parseRecoveryMatrixMarkdownV1(
  bytes: Uint8Array,
): RecoveryMatrixMarkdownModelV1;

export function parseRecoveryReconciliationMarkdownV1(
  bytes: Uint8Array,
): RecoveryReconciliationMarkdownModelV1;
```

The first renderer emits exactly one `# Internal Production Recovery Matrix` heading, a fixed source/epoch section, and one ten-row scenario table in canonical scenario order. The second emits exactly one `# Internal Production Recovery Reconciliation` heading, fixed receipt/census sections, sorted checked-run IDs, and the three literal zero conclusions. Both escape Markdown cells with one shared code-owned escaper, normalize LF, end with one newline, reject control characters or secret-like fields, and accept no pre-rendered text. The two exported parsers accept only exact `Uint8Array` UTF-8 bytes for their own grammar and return their own strict model; renderer/parser round trips must be byte-identical. Parser tests require the exact grammar and section/table counts and explicitly reject `JSON.stringify(model)`, a leading JSON token, cross-feeding one renderer's bytes to the other parser, or registering either private stream under the opposite B owner kind.

- [ ] **Step 1: Verify source and builds from clean main before private finalization**

```bash
set -euo pipefail
require_authenticated_clean_main_setfarm_root_v1() {
  : "${SETFARM_ROOT:?authenticated clean-main Setfarm root is required}"
  : "${SETFARM_ROOT_EXPECTED_SHA:?authenticated clean-main Setfarm SHA is required}"
  case "$SETFARM_ROOT" in
    /*) ;;
    *) printf "SETFARM_ROOT must be absolute\n" >&2; return 1 ;;
  esac
  test -d "$SETFARM_ROOT"
  test ! -L "$SETFARM_ROOT"
  readonly SETFARM_ROOT SETFARM_ROOT_EXPECTED_SHA
  SETFARM_ROOT_TOP="$(git -C "$SETFARM_ROOT" rev-parse --show-toplevel)"
  SETFARM_ROOT_BRANCH="$(git -C "$SETFARM_ROOT" branch --show-current)"
  SETFARM_ROOT_HEAD="$(git -C "$SETFARM_ROOT" rev-parse HEAD)"
  SETFARM_ROOT_ORIGIN="$(git -C "$SETFARM_ROOT" rev-parse refs/remotes/origin/main)"
  SETFARM_ROOT_STATUS="$(git -C "$SETFARM_ROOT" status --porcelain=v1 --untracked-files=all)"
  test "$SETFARM_ROOT_TOP" = "$SETFARM_ROOT"
  test "$SETFARM_ROOT_BRANCH" = "main"
  test -z "$SETFARM_ROOT_STATUS"
  test "$SETFARM_ROOT_HEAD" = "$SETFARM_ROOT_ORIGIN"
  test "$SETFARM_ROOT_HEAD" = "$SETFARM_ROOT_EXPECTED_SHA"
}
cd "$SETFARM_ROOT"
D_SHELL_TEST_VALUE_038="$(git branch --show-current)"
test "$D_SHELL_TEST_VALUE_038" = "main"
D_SHELL_GUARD_OUTPUT="$(git status --porcelain=v1 --untracked-files=all)"
test -z "$D_SHELL_GUARD_OUTPUT"
require_authenticated_clean_main_setfarm_root_v1
npm test
require_authenticated_clean_main_setfarm_root_v1
npm run build
require_authenticated_clean_main_setfarm_root_v1
npm run db:contract-spine:plan
require_authenticated_clean_main_setfarm_root_v1
npm run db:contract-spine:verify
require_authenticated_clean_main_setfarm_root_v1
npm run db:contract-spine:audit-current-authority-ledgers
require_authenticated_clean_main_setfarm_root_v1
node --import tsx scripts/mission-control-contract-artifacts.ts --check
D_VERIFIED_SETFARM_SOURCE_SHA="$(git rev-parse HEAD)"
export D_VERIFIED_SETFARM_SOURCE_SHA
D_SHELL_GUARD_OUTPUT="$(git status --porcelain=v1 --untracked-files=all)"
test -z "$D_SHELL_GUARD_OUTPUT"

cd /Users/setrox/ai/setrox/mission-control
D_SHELL_TEST_VALUE_039="$(git branch --show-current)"
test "$D_SHELL_TEST_VALUE_039" = "main"
D_SHELL_GUARD_OUTPUT="$(git status --porcelain=v1 --untracked-files=all)"
test -z "$D_SHELL_GUARD_OUTPUT"
require_authenticated_clean_main_setfarm_root_v1
npm run check:setfarm-contract
require_authenticated_clean_main_setfarm_root_v1
npm test
require_authenticated_clean_main_setfarm_root_v1
npm run build
require_authenticated_clean_main_setfarm_root_v1
MC_RENDER_ROUTES="/,/setfarm,/setfarm/active,/projects,/setfarm/runs/$D_API_RUN_ID" npm run render:smoke
D_VERIFIED_MC_SOURCE_SHA="$(git rev-parse HEAD)"
export D_VERIFIED_MC_SOURCE_SHA
D_SHELL_GUARD_OUTPUT="$(git status --porcelain=v1 --untracked-files=all)"
test -z "$D_SHELL_GUARD_OUTPUT"
```

Expected: both repositories are clean `main` before and after verification; every command passes. These two exported SHAs, not a later documentation-only commit, are the matrix's verified source identities.

- [ ] **Step 2: Privately finalize and verify the bounded packet with zero owners**

Only after Step 1 passes, remain on the same clean source trees, prove the global zero-owner condition, and seal the canonical packet bytes below B's global private data root:

```bash
set -euo pipefail
require_authenticated_clean_main_setfarm_root_v1() {
  : "${SETFARM_ROOT:?authenticated clean-main Setfarm root is required}"
  : "${SETFARM_ROOT_EXPECTED_SHA:?authenticated clean-main Setfarm SHA is required}"
  case "$SETFARM_ROOT" in
    /*) ;;
    *) printf "SETFARM_ROOT must be absolute\n" >&2; return 1 ;;
  esac
  test -d "$SETFARM_ROOT"
  test ! -L "$SETFARM_ROOT"
  readonly SETFARM_ROOT SETFARM_ROOT_EXPECTED_SHA
  SETFARM_ROOT_TOP="$(git -C "$SETFARM_ROOT" rev-parse --show-toplevel)"
  SETFARM_ROOT_BRANCH="$(git -C "$SETFARM_ROOT" branch --show-current)"
  SETFARM_ROOT_HEAD="$(git -C "$SETFARM_ROOT" rev-parse HEAD)"
  SETFARM_ROOT_ORIGIN="$(git -C "$SETFARM_ROOT" rev-parse refs/remotes/origin/main)"
  SETFARM_ROOT_STATUS="$(git -C "$SETFARM_ROOT" status --porcelain=v1 --untracked-files=all)"
  test "$SETFARM_ROOT_TOP" = "$SETFARM_ROOT"
  test "$SETFARM_ROOT_BRANCH" = "main"
  test -z "$SETFARM_ROOT_STATUS"
  test "$SETFARM_ROOT_HEAD" = "$SETFARM_ROOT_ORIGIN"
  test "$SETFARM_ROOT_HEAD" = "$SETFARM_ROOT_EXPECTED_SHA"
}
cd "$SETFARM_ROOT"
require_authenticated_clean_main_setfarm_root_v1
npm --prefix "$SETFARM_ROOT" run --silent acceptance:recovery -- assert-zero-owners --json
require_authenticated_clean_main_setfarm_root_v1
D_PACKET_FINALIZATION_JSON="$(npm --prefix "$SETFARM_ROOT" run --silent acceptance:recovery -- finalize-packet \
  --campaign-hash "$D_RECOVERY_CAMPAIGN_HASH" \
  --setfarm-source-sha "$D_VERIFIED_SETFARM_SOURCE_SHA" \
  --mission-control-source-sha "$D_VERIFIED_MC_SOURCE_SHA" \
  --json)"
export D_PACKET_FINALIZATION_JSON
D_PACKET_FINALIZATION_HASH="$(printf '%s' "$D_PACKET_FINALIZATION_JSON" | jq -er '.finalizationHash | select(test("^[0-9a-f]{64}$"))')"
export D_PACKET_FINALIZATION_HASH
D_PACKET_FINALIZATION_REF="$(printf '%s' "$D_PACKET_FINALIZATION_JSON" | jq -er --arg hash "$D_PACKET_FINALIZATION_HASH" '.finalizationRef | select(. == ("setfarm://internal-production/recovery/finalizations/receipts/sha256/" + $hash))')"
export D_PACKET_FINALIZATION_REF
D_RECOVERY_MATRIX_MARKDOWN_HASH="$(printf '%s' "$D_PACKET_FINALIZATION_JSON" | jq -er '.recoveryMatrixMarkdownHash | select(test("^[0-9a-f]{64}$"))')"
export D_RECOVERY_MATRIX_MARKDOWN_HASH
D_RECOVERY_RECONCILIATION_MARKDOWN_HASH="$(printf '%s' "$D_PACKET_FINALIZATION_JSON" | jq -er '.recoveryReconciliationMarkdownHash | select(test("^[0-9a-f]{64}$"))')"
export D_RECOVERY_RECONCILIATION_MARKDOWN_HASH
D_SHELL_GUARD_OUTPUT="$(git status --porcelain=v1 -- docs/review-packets)"
test -z "$D_SHELL_GUARD_OUTPUT"
D_SHELL_GUARD_OUTPUT="$(git status --porcelain=v1 --untracked-files=all)"
test -z "$D_SHELL_GUARD_OUTPUT"
```

Generate from the ten asynchronously verified selected attempt/evidence records. Require ten unique scenario IDs, retain all unselected failed/polluted history, `setfarmCommit === $D_VERIFIED_SETFARM_SOURCE_SHA`, `missionControlCommit === $D_VERIFIED_MC_SOURCE_SHA`, zero ownership issues, zero unresolved DB/API/UI mismatch, verified scenario-3/4 browser continuity hashes, all four terminal-page class hashes, and stable matrix, Markdown, source/build, and finalization hashes. Reject secret-like keys, absolute paths, caller-selected content/targets, or any tracked write. The private finalization receipt and both byte streams must remain accessible across Setfarm worktrees through `resolveInternalProductionDataRootV1()`.

- [ ] **Step 3: Independently review the sealed private packet**

An independent reviewer resolves the sealed packet, inspects the exact source merge SHAs, build identities, contract lock hash, scenario/run mappings, checkpoint/action names, B-owned lifecycle receipt hashes, evidence hashes, finite typed-terminal owner/code pairs, retained failed/polluted attempt counts, API/UI reconciliation counts, Mission Control restart result, service owner census, browser/accessibility result, and every finding/resolution. Allocate the strict observation first; the path is one-way reviewer transport and is never passed to the recorder:

```bash
set -euo pipefail
require_authenticated_clean_main_setfarm_root_v1() {
  : "${SETFARM_ROOT:?authenticated clean-main Setfarm root is required}"
  : "${SETFARM_ROOT_EXPECTED_SHA:?authenticated clean-main Setfarm SHA is required}"
  case "$SETFARM_ROOT" in
    /*) ;;
    *) printf "SETFARM_ROOT must be absolute\n" >&2; return 1 ;;
  esac
  test -d "$SETFARM_ROOT"
  test ! -L "$SETFARM_ROOT"
  readonly SETFARM_ROOT SETFARM_ROOT_EXPECTED_SHA
  SETFARM_ROOT_TOP="$(git -C "$SETFARM_ROOT" rev-parse --show-toplevel)"
  SETFARM_ROOT_BRANCH="$(git -C "$SETFARM_ROOT" branch --show-current)"
  SETFARM_ROOT_HEAD="$(git -C "$SETFARM_ROOT" rev-parse HEAD)"
  SETFARM_ROOT_ORIGIN="$(git -C "$SETFARM_ROOT" rev-parse refs/remotes/origin/main)"
  SETFARM_ROOT_STATUS="$(git -C "$SETFARM_ROOT" status --porcelain=v1 --untracked-files=all)"
  test "$SETFARM_ROOT_TOP" = "$SETFARM_ROOT"
  test "$SETFARM_ROOT_BRANCH" = "main"
  test -z "$SETFARM_ROOT_STATUS"
  test "$SETFARM_ROOT_HEAD" = "$SETFARM_ROOT_ORIGIN"
  test "$SETFARM_ROOT_HEAD" = "$SETFARM_ROOT_EXPECTED_SHA"
}
require_authenticated_clean_main_setfarm_root_v1
D_PACKET_REVIEW_ALLOCATION="$(npm --prefix "$SETFARM_ROOT" run --silent acceptance:recovery -- \
  allocate-packet-review-observation --campaign-hash "$D_RECOVERY_CAMPAIGN_HASH" --json)"
export D_PACKET_REVIEW_ALLOCATION
D_PACKET_REVIEW_LOCAL_PATH="$(printf '%s' "$D_PACKET_REVIEW_ALLOCATION" | jq -er '.localPath')"
export D_PACKET_REVIEW_LOCAL_PATH
D_PACKET_REVIEW_OBSERVATION_REF="$(printf '%s' "$D_PACKET_REVIEW_ALLOCATION" | jq -er '.observationRef')"
export D_PACKET_REVIEW_OBSERVATION_REF
# The independent reviewer writes the strict observation only to the allocated local path.
require_authenticated_clean_main_setfarm_root_v1
D_PACKET_REVIEW_JSON="$(npm --prefix "$SETFARM_ROOT" run --silent acceptance:recovery -- \
  record-packet-review --campaign-hash "$D_RECOVERY_CAMPAIGN_HASH" \
  --observation-ref "$D_PACKET_REVIEW_OBSERVATION_REF" --json)"
export D_PACKET_REVIEW_JSON
D_PACKET_REVIEW_HASH="$(printf '%s' "$D_PACKET_REVIEW_JSON" | \
  jq -er '.reviewHash | select(test("^[0-9a-f]{64}$"))')"
export D_PACKET_REVIEW_HASH
D_PACKET_REVIEW_REF="$(printf '%s' "$D_PACKET_REVIEW_JSON" | \
  jq -er '.reviewRef | select(startswith("setfarm://internal-production/recovery/packet-reviews/sha256/"))')"
export D_PACKET_REVIEW_REF
require_authenticated_clean_main_setfarm_root_v1
npm --prefix "$SETFARM_ROOT" run --silent acceptance:recovery -- verify-packet-review \
  --review-ref "$D_PACKET_REVIEW_REF" --review-hash "$D_PACKET_REVIEW_HASH" --json
```

`record-packet-review` itself reruns `verify-campaign`, asynchronous authority verification, browser/reconciliation checks, both strict Markdown parsers/renderers, and deterministic private finalization in a fresh process. It must reproduce `D_PACKET_FINALIZATION_HASH`, `D_PACKET_FINALIZATION_REF`, `D_RECOVERY_MATRIX_MARKDOWN_HASH`, and `D_RECOVERY_RECONCILIATION_MARKDOWN_HASH`, resolve the canonical ref back to both byte-identical Markdown authorities, and create no tracked file. It rejects raw runtime payloads/logs, JSON bytes registered as Markdown, a path-bearing noncanonical ref, ref/hash drift, cross-swapped documents, any unresolved Critical/High/Medium finding, or any mismatch between the sealed packet and the approved design. The deleted observation and reviewer prose are not authority; the strict content-addressed review receipt is.

Only after that review is clear, record D's non-circular operational gate:

```bash
set -euo pipefail
require_authenticated_clean_main_setfarm_root_v1() {
  : "${SETFARM_ROOT:?authenticated clean-main Setfarm root is required}"
  : "${SETFARM_ROOT_EXPECTED_SHA:?authenticated clean-main Setfarm SHA is required}"
  case "$SETFARM_ROOT" in
    /*) ;;
    *) printf "SETFARM_ROOT must be absolute\n" >&2; return 1 ;;
  esac
  test -d "$SETFARM_ROOT"
  test ! -L "$SETFARM_ROOT"
  readonly SETFARM_ROOT SETFARM_ROOT_EXPECTED_SHA
  SETFARM_ROOT_TOP="$(git -C "$SETFARM_ROOT" rev-parse --show-toplevel)"
  SETFARM_ROOT_BRANCH="$(git -C "$SETFARM_ROOT" branch --show-current)"
  SETFARM_ROOT_HEAD="$(git -C "$SETFARM_ROOT" rev-parse HEAD)"
  SETFARM_ROOT_ORIGIN="$(git -C "$SETFARM_ROOT" rev-parse refs/remotes/origin/main)"
  SETFARM_ROOT_STATUS="$(git -C "$SETFARM_ROOT" status --porcelain=v1 --untracked-files=all)"
  test "$SETFARM_ROOT_TOP" = "$SETFARM_ROOT"
  test "$SETFARM_ROOT_BRANCH" = "main"
  test -z "$SETFARM_ROOT_STATUS"
  test "$SETFARM_ROOT_HEAD" = "$SETFARM_ROOT_ORIGIN"
  test "$SETFARM_ROOT_HEAD" = "$SETFARM_ROOT_EXPECTED_SHA"
}
require_authenticated_clean_main_setfarm_root_v1
D_OPERATIONAL_ACCEPTANCE_JSON="$(npm --prefix "$SETFARM_ROOT" run --silent acceptance:recovery -- \
  record-operational-acceptance --campaign-hash "$D_RECOVERY_CAMPAIGN_HASH" --json)"
export D_OPERATIONAL_ACCEPTANCE_JSON
D_OPERATIONAL_ACCEPTANCE_HASH="$(printf '%s' "$D_OPERATIONAL_ACCEPTANCE_JSON" | \
  jq -er '.acceptanceHash | select(test("^[0-9a-f]{64}$"))')"
export D_OPERATIONAL_ACCEPTANCE_HASH
D_OPERATIONAL_ACCEPTANCE_REF="$(printf '%s' "$D_OPERATIONAL_ACCEPTANCE_JSON" | \
  jq -er '.acceptanceRef | select(startswith("setfarm://internal-production/recovery/operational-acceptances/sha256/"))')"
export D_OPERATIONAL_ACCEPTANCE_REF
require_authenticated_clean_main_setfarm_root_v1
npm --prefix "$SETFARM_ROOT" run --silent acceptance:recovery -- verify-operational-acceptance \
  --acceptance-ref "$D_OPERATIONAL_ACCEPTANCE_REF" \
  --acceptance-hash "$D_OPERATIONAL_ACCEPTANCE_HASH" --json
```

Expected: the resolver rehashes the exact private finalization and all operational dependencies; no docs-session, materialization, documentation-commit, E input/finalization, or post-handoff authority is read or required.

- [ ] **Step 4: Defer tracked materialization to E's single final Setfarm-owned docs run**

Standalone D operational completion stops after the stable private finalization and exports `D_OPERATIONAL_ACCEPTANCE_HASH`, canonical `D_OPERATIONAL_ACCEPTANCE_REF`, `D_PACKET_FINALIZATION_HASH`, canonical `D_PACKET_FINALIZATION_REF`, `D_RECOVERY_MATRIX_MARKDOWN_HASH`, and `D_RECOVERY_RECONCILIATION_MARKDOWN_HASH` to E. E must first resolve the operational-acceptance ref/hash and then resolve the exact private finalization and both named Markdown streams; a hash alone is insufficient. This is the D authority E consumes for fleet admission. Do not start a D-only docs run in the full A–E program: that program uses only `materializeFinalizedRecoveryPacketInSessionV1({finalizationRef,session})` inside E's one final six-entry docs session after E fleet finalization. The standalone CLI below is allowed only for isolated D delivery, and even there it runs in a distinct Setfarm-owner-assigned docs claim worktree, non-`main` managed branch, and exact merge base—never in the canonical Setfarm `main` checkout. `D_DOCS_CLAIM_WORKTREE`, `D_DOCS_CLAIM_BRANCH`, and `D_DOCS_CLAIM_MERGE_BASE_SHA` are authenticated claim-transport values; the worker neither chooses nor changes them:

```bash
set -euo pipefail
require_authenticated_clean_main_setfarm_root_v1() {
  : "${SETFARM_ROOT:?authenticated clean-main Setfarm root is required}"
  : "${SETFARM_ROOT_EXPECTED_SHA:?authenticated clean-main Setfarm SHA is required}"
  case "$SETFARM_ROOT" in
    /*) ;;
    *) printf "SETFARM_ROOT must be absolute\n" >&2; return 1 ;;
  esac
  test -d "$SETFARM_ROOT"
  test ! -L "$SETFARM_ROOT"
  readonly SETFARM_ROOT SETFARM_ROOT_EXPECTED_SHA
  SETFARM_ROOT_TOP="$(git -C "$SETFARM_ROOT" rev-parse --show-toplevel)"
  SETFARM_ROOT_BRANCH="$(git -C "$SETFARM_ROOT" branch --show-current)"
  SETFARM_ROOT_HEAD="$(git -C "$SETFARM_ROOT" rev-parse HEAD)"
  SETFARM_ROOT_ORIGIN="$(git -C "$SETFARM_ROOT" rev-parse refs/remotes/origin/main)"
  SETFARM_ROOT_STATUS="$(git -C "$SETFARM_ROOT" status --porcelain=v1 --untracked-files=all)"
  test "$SETFARM_ROOT_TOP" = "$SETFARM_ROOT"
  test "$SETFARM_ROOT_BRANCH" = "main"
  test -z "$SETFARM_ROOT_STATUS"
  test "$SETFARM_ROOT_HEAD" = "$SETFARM_ROOT_ORIGIN"
  test "$SETFARM_ROOT_HEAD" = "$SETFARM_ROOT_EXPECTED_SHA"
}
test -n "$D_DOCS_CLAIM_WORKTREE"
test -n "$D_DOCS_CLAIM_BRANCH"
test -n "$D_DOCS_CLAIM_MERGE_BASE_SHA"
cd "$D_DOCS_CLAIM_WORKTREE"
D_SHELL_TEST_VALUE_040="$(pwd -P)"
D_SHELL_TEST_VALUE_041="$(git rev-parse --show-toplevel)"
test "$D_SHELL_TEST_VALUE_040" = "$D_SHELL_TEST_VALUE_041"
D_SHELL_TEST_VALUE_042="$(pwd -P)"
test "$D_SHELL_TEST_VALUE_042" != "$SETFARM_ROOT"
D_SHELL_TEST_VALUE_043="$(git branch --show-current)"
test "$D_SHELL_TEST_VALUE_043" = "$D_DOCS_CLAIM_BRANCH"
test "$D_DOCS_CLAIM_BRANCH" != "main"
D_SHELL_TEST_VALUE_044="$(git rev-parse HEAD)"
test "$D_SHELL_TEST_VALUE_044" = "$D_DOCS_CLAIM_MERGE_BASE_SHA"
test "$D_DOCS_CLAIM_MERGE_BASE_SHA" = "$D_VERIFIED_SETFARM_SOURCE_SHA"
D_SHELL_TEST_VALUE_045="$(git merge-base HEAD "$D_DOCS_CLAIM_MERGE_BASE_SHA")"
test "$D_SHELL_TEST_VALUE_045" = "$D_DOCS_CLAIM_MERGE_BASE_SHA"
D_SHELL_GUARD_OUTPUT="$(git status --porcelain=v1 --untracked-files=all)"
test -z "$D_SHELL_GUARD_OUTPUT"
require_authenticated_clean_main_setfarm_root_v1
npm ci
# `node_modules/` is the repository-declared ignored dependency tree; no tracked
# or unignored file may appear during installation.
D_SHELL_GUARD_OUTPUT="$(git status --porcelain=v1 --untracked-files=all)"
test -z "$D_SHELL_GUARD_OUTPUT"
require_authenticated_clean_main_setfarm_root_v1
npm --prefix "$SETFARM_ROOT" run --silent acceptance:recovery -- materialize-finalized-packet \
  --finalization-hash "$D_PACKET_FINALIZATION_HASH" --json
```

For isolated D delivery, the docs claim runs the standalone materializer only in that authenticated Setfarm-managed worktree. For full A–E delivery, E's final docs claim calls only the in-session materializer and the standalone CLI is forbidden. Both forms perform read-only receipt/source/build/byte verification and write only the two versioned tracked Markdown files assigned to D. The docs worker inspects scope with read-only `git status`, `git diff --check`, and `git diff --name-only`, then submits the exact immutable claim output with the claim-provided `setfarm step complete` command. Setfarm alone owns the docs worktree/branch, commit, push, PR, review routing, merge, cleanup, and durable handoff receipt. The completion owner accepts only the registered current-generation targets and requires their hashes to equal `D_RECOVERY_MATRIX_MARKDOWN_HASH` and `D_RECOVERY_RECONCILIATION_MARKDOWN_HASH`; prior-generation files remain unchanged, and no worker creates/switches a branch, stages, commits, pushes, or calls `gh`.

- [ ] **Step 5: After E's final docs merge, verify D materialization read-only**

```bash
set -euo pipefail
require_authenticated_clean_main_setfarm_root_v1() {
  : "${SETFARM_ROOT:?authenticated clean-main Setfarm root is required}"
  : "${SETFARM_ROOT_EXPECTED_SHA:?authenticated clean-main Setfarm SHA is required}"
  case "$SETFARM_ROOT" in
    /*) ;;
    *) printf "SETFARM_ROOT must be absolute\n" >&2; return 1 ;;
  esac
  test -d "$SETFARM_ROOT"
  test ! -L "$SETFARM_ROOT"
  readonly SETFARM_ROOT SETFARM_ROOT_EXPECTED_SHA
  SETFARM_ROOT_TOP="$(git -C "$SETFARM_ROOT" rev-parse --show-toplevel)"
  SETFARM_ROOT_BRANCH="$(git -C "$SETFARM_ROOT" branch --show-current)"
  SETFARM_ROOT_HEAD="$(git -C "$SETFARM_ROOT" rev-parse HEAD)"
  SETFARM_ROOT_ORIGIN="$(git -C "$SETFARM_ROOT" rev-parse refs/remotes/origin/main)"
  SETFARM_ROOT_STATUS="$(git -C "$SETFARM_ROOT" status --porcelain=v1 --untracked-files=all)"
  test "$SETFARM_ROOT_TOP" = "$SETFARM_ROOT"
  test "$SETFARM_ROOT_BRANCH" = "main"
  test -z "$SETFARM_ROOT_STATUS"
  test "$SETFARM_ROOT_HEAD" = "$SETFARM_ROOT_ORIGIN"
  test "$SETFARM_ROOT_HEAD" = "$SETFARM_ROOT_EXPECTED_SHA"
}
cd "$SETFARM_ROOT"
require_authenticated_clean_main_setfarm_root_v1
D_POST_DOCS_OWNER_SYNC_JSON="$(npm run --silent acceptance:final-closure-packet -- verify-final-acceptance --json)"
readonly D_POST_DOCS_OWNER_SYNC_JSON
D_POST_DOCS_SYNC_REF="$(printf '%s' "$D_POST_DOCS_OWNER_SYNC_JSON" | jq -er '.canonicalRef')"
readonly D_POST_DOCS_SYNC_REF
D_POST_DOCS_SYNC_HASH="$(printf '%s' "$D_POST_DOCS_OWNER_SYNC_JSON" | jq -er '.receiptHash | select(test("^[0-9a-f]{64}$"))')"
readonly D_POST_DOCS_SYNC_HASH
D_POST_DOCS_SETFARM_SHA="$(printf '%s' "$D_POST_DOCS_OWNER_SYNC_JSON" | jq -er '.documentationSha | select(test("^[0-9a-f]{40}$"))')"
readonly D_POST_DOCS_SETFARM_SHA
D_POST_DOCS_MC_SHA="$(printf '%s' "$D_POST_DOCS_OWNER_SYNC_JSON" | jq -er '.missionControlSha | select(test("^[0-9a-f]{40}$"))')"
readonly D_POST_DOCS_MC_SHA
D_POST_DOCS_EPOCH_HASH="$(printf '%s' "$D_POST_DOCS_OWNER_SYNC_JSON" | jq -er '.finalReleaseEpoch.epochHash | select(test("^[0-9a-f]{64}$"))')"
readonly D_POST_DOCS_EPOCH_HASH
D_POST_DOCS_GENERATION_HASH="$(printf '%s' "$D_POST_DOCS_OWNER_SYNC_JSON" | jq -er '.closureGenerationHash | select(test("^[0-9a-f]{64}$"))')"
readonly D_POST_DOCS_GENERATION_HASH
D_POST_DOCS_GENERATION_DIRECTORY="$(printf '%s' "$D_POST_DOCS_OWNER_SYNC_JSON" | jq -er '.closureGenerationDirectory')"
readonly D_POST_DOCS_GENERATION_DIRECTORY
D_POST_DOCS_RECOVERY_MATRIX_PATH="$(printf '%s' "$D_POST_DOCS_OWNER_SYNC_JSON" | jq -er '.orderedTargetPaths[1]')"
readonly D_POST_DOCS_RECOVERY_MATRIX_PATH
D_POST_DOCS_RECOVERY_RECONCILIATION_PATH="$(printf '%s' "$D_POST_DOCS_OWNER_SYNC_JSON" | jq -er '.orderedTargetPaths[2]')"
readonly D_POST_DOCS_RECOVERY_RECONCILIATION_PATH
readonly D_POST_DOCS_EXPECTED_DIRECTORY="epoch-${D_POST_DOCS_EPOCH_HASH}-closure-${D_POST_DOCS_GENERATION_HASH}"
readonly D_POST_DOCS_EXPECTED_PREFIX="docs/review-packets/internal-production/${D_POST_DOCS_EXPECTED_DIRECTORY}"
test "$D_POST_DOCS_SYNC_REF" = "setfarm://internal-production/final-closure/post-handoff"
test "$D_POST_DOCS_GENERATION_DIRECTORY" = "$D_POST_DOCS_EXPECTED_DIRECTORY"
test "$D_POST_DOCS_RECOVERY_MATRIX_PATH" = "${D_POST_DOCS_EXPECTED_PREFIX}/recovery-matrix.md"
test "$D_POST_DOCS_RECOVERY_RECONCILIATION_PATH" = "${D_POST_DOCS_EXPECTED_PREFIX}/recovery-reconciliation.md"
D_SHELL_TEST_VALUE_046="$(git branch --show-current)"
test "$D_SHELL_TEST_VALUE_046" = "main"
D_SHELL_GUARD_OUTPUT="$(git status --porcelain=v1 --untracked-files=all)"
test -z "$D_SHELL_GUARD_OUTPUT"
D_SHELL_TEST_VALUE_047="$(git rev-parse HEAD)"
D_SHELL_TEST_VALUE_048="$(git rev-parse origin/main)"
test "$D_SHELL_TEST_VALUE_047" = "$D_SHELL_TEST_VALUE_048"
D_SHELL_TEST_VALUE_049="$(git rev-parse HEAD)"
test "$D_SHELL_TEST_VALUE_049" = "$D_POST_DOCS_SETFARM_SHA"
require_authenticated_clean_main_setfarm_root_v1
npm --prefix "$SETFARM_ROOT" run --silent acceptance:recovery -- verify-materialization --campaign-hash "$D_RECOVERY_CAMPAIGN_HASH" --json
require_authenticated_clean_main_setfarm_root_v1
D_DOCS_DELIVERY_ACCEPTANCE_JSON="$(npm run --silent acceptance:final-closure-packet -- \
  record-recovery-docs-delivery --campaign-hash "$D_RECOVERY_CAMPAIGN_HASH" --json)"
export D_DOCS_DELIVERY_ACCEPTANCE_JSON
D_DOCS_DELIVERY_ACCEPTANCE_HASH="$(printf '%s' "$D_DOCS_DELIVERY_ACCEPTANCE_JSON" | \
  jq -er '.deliveryHash | select(test("^[0-9a-f]{64}$"))')"
export D_DOCS_DELIVERY_ACCEPTANCE_HASH
D_DOCS_DELIVERY_ACCEPTANCE_REF="$(printf '%s' "$D_DOCS_DELIVERY_ACCEPTANCE_JSON" | \
  jq -er '.deliveryRef | select(startswith("setfarm://internal-production/recovery/docs-delivery-acceptances/sha256/"))')"
export D_DOCS_DELIVERY_ACCEPTANCE_REF
require_authenticated_clean_main_setfarm_root_v1
npm --prefix "$SETFARM_ROOT" run --silent acceptance:recovery -- verify-docs-delivery-acceptance \
  --delivery-ref "$D_DOCS_DELIVERY_ACCEPTANCE_REF" \
  --delivery-hash "$D_DOCS_DELIVERY_ACCEPTANCE_HASH" --json
D_SHELL_TEST_VALUE_050="$(shasum -a 256 "$D_POST_DOCS_RECOVERY_MATRIX_PATH" | awk '{print $1}')"
test "$D_SHELL_TEST_VALUE_050" = "$D_RECOVERY_MATRIX_MARKDOWN_HASH"
D_SHELL_TEST_VALUE_051="$(shasum -a 256 "$D_POST_DOCS_RECOVERY_RECONCILIATION_PATH" | awk '{print $1}')"
test "$D_SHELL_TEST_VALUE_051" = "$D_RECOVERY_RECONCILIATION_MARKDOWN_HASH"
require_authenticated_clean_main_setfarm_root_v1
npm test
require_authenticated_clean_main_setfarm_root_v1
npm run build
require_authenticated_clean_main_setfarm_root_v1
npm run db:contract-spine:plan
require_authenticated_clean_main_setfarm_root_v1
npm run db:contract-spine:verify
require_authenticated_clean_main_setfarm_root_v1
npm run db:contract-spine:audit-current-authority-ledgers
require_authenticated_clean_main_setfarm_root_v1
node --import tsx scripts/mission-control-contract-artifacts.ts --check
D_SHELL_GUARD_OUTPUT="$(git status --porcelain=v1 --untracked-files=all)"
test -z "$D_SHELL_GUARD_OUTPUT"

cd /Users/setrox/ai/setrox/mission-control
D_SHELL_TEST_VALUE_052="$(git branch --show-current)"
test "$D_SHELL_TEST_VALUE_052" = "main"
D_SHELL_GUARD_OUTPUT="$(git status --porcelain=v1 --untracked-files=all)"
test -z "$D_SHELL_GUARD_OUTPUT"
D_SHELL_TEST_VALUE_053="$(git rev-parse HEAD)"
D_SHELL_TEST_VALUE_054="$(git rev-parse origin/main)"
test "$D_SHELL_TEST_VALUE_053" = "$D_SHELL_TEST_VALUE_054"
D_SHELL_TEST_VALUE_055="$(git rev-parse HEAD)"
test "$D_SHELL_TEST_VALUE_055" = "$D_POST_DOCS_MC_SHA"
require_authenticated_clean_main_setfarm_root_v1
npm run check:setfarm-contract
require_authenticated_clean_main_setfarm_root_v1
npm test
require_authenticated_clean_main_setfarm_root_v1
npm run build
require_authenticated_clean_main_setfarm_root_v1
MC_RENDER_ROUTES="/,/setfarm,/setfarm/active,/projects,/setfarm/runs/$D_API_RUN_ID" npm run render:smoke
D_SHELL_GUARD_OUTPUT="$(git status --porcelain=v1 --untracked-files=all)"
test -z "$D_SHELL_GUARD_OUTPUT"
```

This post-doc step is read-only with respect to both repositories. The owning Setfarm/Mission Control orchestrators must synchronize and hand off the current final-acceptance receipt before the worker starts. The worker resolves that owner receipt first, rederives the single combined directory exactly as `epoch-${finalReleaseEpoch.epochHash}-closure-${closureGenerationHash}`, requires the receipt's `closureGenerationDirectory` to equal it, and requires both D paths to be the fixed `recovery-matrix.md` and `recovery-reconciliation.md` children of that same directory before hashing either file. Mixed nested/combined layouts, different generation receipts, wildcard-only admission, or a basename under another directory fail. It then only asserts branch/clean/`HEAD === origin/main` and the receipt's exact documentation/operational-Mission-Control SHAs. It never runs `git switch`, `git checkout`, `git pull`, `git fetch`, merge, reset, or any other Git mutation here.

`record-recovery-docs-delivery` is E's integration command, not a D command. It first resolves E's exact post-handoff receipt through E's current final-acceptance resolver, which requires clean synchronized main and exact current Setfarm documentation/Mission Control operational HEADs, then resolves B's bound docs-session receipt and maps only the strict `RecoveryDocsDeliveryAcceptanceInputV1` fields into D's `RecoveryDocsDeliveryAcceptancePortV1.record(...)`. E's archival historical resolver is not acceptance and cannot be used here. D source never imports either E resolver or command.

Expected: E's single Setfarm-owned docs handoff receipt identifies the reviewed merge, the two D tracked files are byte-identical to the final-epoch sealed private packet, `verify-materialization` resolves the same campaign/finalization/source pair and tracked hashes, and D's separate docs-delivery acceptance binds that metadata handoff back to the already accepted operational receipt. Both repositories remain clean and synchronized after full verification. The documentation merge SHA never replaces the recorded operational source epoch or create a second operational acceptance.

## Final Acceptance Gate

Subproject D operational acceptance is complete before E fleet only when the operational items below are simultaneously true. The later `RecoveryDocsDeliveryAcceptanceV1` closes tracked delivery only when E's integration adapter calls D's one-way port after the combined docs handoff and is deliberately not a prerequisite for E:

- [ ] C's full Profiles 1–7 matrix is accepted on the final operational epoch before D execution; D's consumed Profiles 1–3 each resolve exactly once for that epoch.
- [ ] Any scenario-10 source repair derives one stable semantic systemic root, binds and freshly resolves a distinct full accepted C Profiles 1–7 successor matrix ref/hash/final epoch plus its exact Profile 1–3/source-link/API members before reuse, preserves attempt-specific failure receipts as evidence, and blocks the third recurrence of the same semantic root across epochs.
- [ ] All ten recovery scenarios have unique verified evidence; scenarios 1–4 and 7–10 end only as accepted continuation with their positive scenario proof, while scenarios 5 and 6 may instead use their exact finite typed-terminal outcome.
- [ ] Every scenario has zero unrelated active work and zero ownership/process/port/lease/worktree leak after settlement.
- [ ] Owner-commit recovery and post-owner completion recovery each prove mandatory effects were applied exactly once.
- [ ] Mission Control passes through Product Build Authority, operational evidence, retryability, failure owner, and terminal state without local re-derivation.
- [ ] PostgreSQL, Setfarm snapshot, Mission Control API, project/overview API, and rendered UI have zero unresolved mismatch for the same recorded live-operational run IDs; isolated-process scenarios have zero mismatch against their own exact PostgreSQL/checkpoint receipts.
- [ ] Database, `/api/runs`, project, and overview active counts and run-ID sets agree exactly; every active project binds one distinct active `execution.runId` and duplicate active bindings are rejected.
- [ ] The historical 112 raw-active registry records are no longer presented as 112 active executions, while failed and cancelled history remains discoverable.
- [ ] Mission Control and dashboard restarts preserve run authority; the accepted API product restart preserves declared durable state.
- [ ] Automated route/render tests, live browser smoke, console checks, keyboard checks, full tests, clean-main builds, contract verification, migrations, and authority audits pass.
- [ ] The Setfarm-owned recovery source handoff and Mission Control reconciliation PR are reviewed and merged; the strict content-addressed `RecoveryPacketIndependentReviewReceiptV1` reruns and binds the same packet/matrix/epoch with zero unresolved Critical, High, or Medium findings; and the exact `RecoveryOperationalAcceptanceV1` resolves that review plus the ten selections, reconciliation/browser/zero-owner authorities, and private finalization without depending on E docs.
- [ ] Before E, both repositories are clean and synchronized with `origin/main` at the recorded operational SHAs.
- [ ] After E's combined six-file docs handoff, the Setfarm docs handoff is reviewed and merged, E's current final-acceptance resolver proves exact current Setfarm documentation and Mission Control operational HEADs plus B completion authority, and its adapter calls D's `RecoveryDocsDeliveryAcceptancePortV1` to bind the exact D tracked hashes; E's historical resolver remains archival-only, D has no E import, and this later metadata gate cannot authorize or replace the operational epoch.
