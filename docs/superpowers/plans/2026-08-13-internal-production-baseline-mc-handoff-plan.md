# Internal Production Baseline and Mission Control Handoff Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver the existing Mission Control Product Build Authority V2 work, remove the false active-project presentation, and establish a backed-up, audited, clean-main baseline for Setfarm and Mission Control before the first golden run.

**Architecture:** Mission Control continues to proxy and render Setfarm-owned authority without inventing a second authority model. A new read-only project execution projection separates catalog lifecycle, workflow execution, runtime health, and immutable V3 deployment-receipt state; it resolves only explicit run identifiers or exact run numbers from PostgreSQL. After the Mission Control changes merge, both repositories are rebuilt from clean `main`, the live services are restarted only with a zero-owner census, and a bounded baseline packet records exact code, contract, database, process, port, backup, and HTTP evidence.

**Tech Stack:** TypeScript ESM, Node.js 22+, React 19, Express 5, PostgreSQL, `node:test`, Playwright, GitHub CLI, macOS LaunchAgents.

**Spec:** `setfarm/docs/superpowers/specs/2026-08-13-setfarm-mission-control-internal-production-closure-design.md`

## Global Constraints

- This plan implements Subproject A only. No golden run starts until every acceptance item in this plan passes.
- External distribution remains out of scope. `setfarm platform-release preflight --json` must remain diagnostic-only with `productionAuthority:false` and `productionAdmission:"blocked"`.
- PostgreSQL rows, claim logs, completion/effect ledgers, observations, and exact GitHub state outrank Setfarm projections; Setfarm projections outrank Mission Control API/UI; agent prose is never authority.
- Historical failed, cancelled, and completed records remain visible. No history is deleted or hidden to improve metrics.
- A project registry record, runnable repository, open port, or immutable deployment receipt cannot by itself prove an active Setfarm execution.
- Mission Control must remain usable at `http://127.0.0.1:3080`; Setfarm dashboard remains at `http://127.0.0.1:3333`; OpenClaw remains at `http://127.0.0.1:18789`.
- Do not use `SETFARM_ALLOW_DIRTY_BUILD`, `SETFARM_SKIP_RUNTIME_GUARD`, or `--skip-runtime-guard`.
- No secret value, `.env`, LaunchAgent environment value, database dump, runtime artifact, screenshot cache, or local log is committed.
- Work in one writing branch per repository. Finish the Mission Control PR before creating the Setfarm evidence-packet branch.
- Implementation/review workers do not stage, commit, push, or open PRs. Every “Setfarm-owned handoff” step is executed by the owning Setfarm orchestrator only after the worker and reviewer gates pass.
- Every code task follows test-first development unless it is explicitly characterizing the already-committed `1709707` implementation.
- Stop and report if the same canonical systemic failure repeats three times after attempted fixes.
- Execute the source/contract dependency in this exact order: Task 0; Task 1; Task 5 Steps 1–3 to vendor the new producer artifacts; Tasks 2–4; Task 5 Steps 4–6 to cross and checkpoint the semantic consumer; then Task 6 and the live baseline tasks. Do not create the Mission Control adapter before its pinned producer bytes exist.
- Every `bash` fence starts with `set -euo pipefail`. Plan/source-boundary tests parse every shell fence and reject a service, database, run/workflow, or Git mutation unless the immediately preceding command obtains a fresh code-owned authority guard and the mutating command consumes that exact canonical ref/hash. They specifically ban raw `launchctl`, raw workflow-start commands, and `git switch|checkout|pull|fetch|merge|reset|add|commit|push` in worker fences. A's one finite `restart-service` wrapper is the only service mutator and must freshly resolve and one-use consume its zero-owner guard before fixed no-shell dispatch. The same tests reject a negative `rg` scan hidden in a pipeline, a match-then-exit expression followed by an unconditional-success fallback, or any other masked/bare fallback; transcript fixtures prove that a match status `0` fails, only status `1` with exactly empty captured output passes, status `1` with output and statuses `2`/`127` fail, and an upstream Git-diff failure stops before `rg` runs.

## Starting Evidence

- Mission Control `feat/product-build-authority-v2` is clean at `17097074da241ae8f285c00c77d6c972791b369c`, one commit ahead of `origin/main` at `4761ff3`.
- The branch changes exactly six files and has no open PR.
- The Product Build Authority focused tests currently pass 9/9.
- Mission Control's vendored Setfarm contract lock currently pins producer commit `9a66b954669be7f6661c53191628e6d84bffe958` and eight artifacts.
- The live `/api/projects` response contains 220 records: 112 raw `active`, 90 `failed`, and 18 `completed`.
- None of the 112 raw-active records has a live service observation: 104 are `inactive` and 8 are `unknown`.
- `/api/runs` returns an empty list, matching the zero-active-run database census.
- The false-active root cause is persisted legacy `status:"active"`, bounded latest-50 run enrichment, and UI precedence that renders `project.status` as execution state.
- `ActiveRun.pickActiveRun()` also falls back to the newest terminal run when no active run exists.

## File Map

### Mission Control Product Build Authority handoff

- Modify `mission-control/server/routes/setfarm-operational.test.ts` — characterize V2 success and fail-closed HTTP mappings at the proxy boundary.
- Review without broad rewrite:
  - `mission-control/server/routes/setfarm-operational.ts`
  - `mission-control/server/services/setfarm-product-build-authority.ts`
  - `mission-control/server/services/setfarm-product-build-authority.test.ts`
  - `mission-control/src/lib/product-build-authority.ts`
  - `mission-control/src/components/run-detail/ProductBuildAuthority.tsx`
  - `mission-control/tests/product-build-authority-render.test.tsx`

### Mission Control execution-state correction

- Create `setfarm/src/contracts/operational-active-run-status-v1.ts` — sole producer of the exact operational-active run status tuple/schema/predicate.
- Create `setfarm/src/contracts/operational-active-run-status-v1-cli.ts` — JSON-only contract projection for shell census use.
- Create `setfarm/tests/operational-active-run-status-v1.test.ts` — producer, API, and transition-consumer identity tests.
- Modify `setfarm/src/contracts/mission-control-contract-artifacts.ts` and `setfarm/tests/mission-control-contract-artifacts.test.ts` — generate and verify the exact new schema/compatibility pair in the existing deterministic artifact set.
- Modify `setfarm/src/server/dashboard.ts` — `/api/runs` active/default filtering and `operationalActive` projection use the contract.
- Modify `setfarm/src/server/index.html` — active-run selection uses the API's contract-derived `operationalActive` boolean rather than a local status list.
- Modify `setfarm/package.json` — add the code-owned `contract:operational-active-run-status` command.
- Generate `setfarm/contracts/generated/mission-control/operational-active-run-status.v1.schema.json` and `setfarm/contracts/generated/mission-control/operational-active-run-status.v1.compatibility.json` from the same producer.
- Vendor those two files under `mission-control/contracts/vendor/setfarm/` and update the Setfarm contract lock through the existing sync command; Mission Control defines no local active-status tuple.
- Modify `mission-control/scripts/sync-setfarm-contract.mjs` and `mission-control/scripts/check-setfarm-contract.mjs` — add the exact producer pair to sync/check inventory and cross it through the shared semantic predicate.
- Create `mission-control/shared/setfarm-operational-active-run-status-v1.ts` — import the vendored schema enum once and expose its exact typed predicate to server and browser consumers.
- Modify `mission-control/tests/setfarm-contract-vendor.test.ts` — require all ten artifacts and cross the operational-active compatibility fixture through the shared consumer.
- Create `mission-control/server/services/project-execution-state.ts` — pure explicit binding and execution-state derivation.
- Create `mission-control/server/services/project-execution-state.test.ts` — exact ID/number, conflict, terminal, and unbound regressions.
- Modify `mission-control/server/utils/setfarm-db.ts` — one bounded PostgreSQL read for explicit project run identities.
- Modify `mission-control/server/routes/projects.ts` — apply the read-only public projection without changing persisted V3 receipt records.
- Create `mission-control/server/routes/projects-projection.test.ts` — public-projection boundary regressions.
- Modify `mission-control/src/lib/types.ts` — shared project execution/runtime/receipt response types.
- Modify `mission-control/src/pages/Projects.tsx` — filters and sorting use the separated projection.
- Modify `mission-control/src/components/projects/ProjectCard.tsx` — render catalog, execution, runtime, and receipt independently.
- Modify `mission-control/src/components/projects/ProjectDetailPanel.tsx` — display the four independent meanings and their evidence sources.
- Modify `mission-control/src/lib/project-health.ts` — keep observed runtime freshness independent of workflow execution.
- Extend `mission-control/tests/project-health.test.ts` — render-source boundary checks.
- Create `mission-control/tests/project-execution-render.test.tsx` — SSR regressions for active, terminal, unbound, and V3 receipt cases.
- Modify `mission-control/src/pages/ActiveRun.tsx` — remove terminal fallback and export the pure selector.
- Create `mission-control/tests/active-run-selection.test.ts` — zero-active-run regression.
- Modify `mission-control/server/routes/overview.ts` — recent deploys mean observed runtime availability, not raw `status:"active"`.
- Create `mission-control/server/routes/overview.test.ts` — overview count and deploy-selection regressions.

### Contract and evidence delivery

- Create through one Setfarm-owned source claim before live mutation:
  - `setfarm/src/internal-production/baseline-post-handoff-receipt-v1.ts` — also owns the strict content-addressed baseline service-restart authority/store/resolver used by B P0.
  - `setfarm/src/internal-production/baseline-owner-producer-manifest-activation-controller-v1.ts` — A-only, import-inert, path-free controller that durably activates the exact eleven-row A manifest and seals the predecessor/successor activation-head wrapper receipt.
  - `setfarm/src/internal-production/baseline-post-handoff-cli.ts`
  - `setfarm/src/internal-production/baseline-service-restart-helper-v1.ts` — private fixed helper entry; no public argv surface.
  - `setfarm/src/internal-production/baseline-spawner-startup-admission-v1.ts` — A-operation-bound new-spawner startup capability/locator/claim.
  - `setfarm/src/internal-production/baseline-service-restart-sequence-v1.ts` — fixed `live-rebind|d-startup-hook-load|documentation-rollback` coordinator, journal, and resolver.
  - `setfarm/src/internal-production/baseline-restart-authority-retirement-v1.ts` — the one-way A-to-D physical-service restart-authority epoch, A-owned strict hook-readiness/activation/cutover contracts and stores, code-owned hook observer/recorder, global transition lock, durable retirement/cutover receipts, and pair-only resolvers.
  - `setfarm/src/internal-production/baseline-post-handoff-receipt-v1.ts`, `setfarm/src/spawner.ts`, `setfarm/src/execution/attempt-repository.ts`, `setfarm/src/execution/claim-runtime-publication.ts`, `setfarm/src/execution/runtime-completion.ts`, and `setfarm/src/execution/runtime-completion-effect-runner.ts` — exact call sites for the eleven A-owned rows of `INTERNAL_PRODUCTION_OWNER_PRODUCER_ROWS_A_V1`; each calls its fixed producer function before the first matching owner publication and closes against the terminal authority.
  - `setfarm/src/execution/runtime-completion.ts` — mint the opaque completion-owner bootstrap target guard only inside the authenticated current-owner context.
  - `setfarm/src/db/bootstrap-main-claim-handoff-v1-migration.ts` — sole immutable implementation, ordered statements, named migration identity, and schema projector for the bootstrap-main-claim handoff migration.
  - `setfarm/src/db/contract-spine-migrations.ts` and `setfarm/src/db/contract-spine-migration-digests.generated.ts` — append-only registration of that dedicated migration and its named digest entry before B Task P0; unrelated later entries may be appended without changing A's authority.
  - `setfarm/tests/internal-production/baseline-post-handoff-receipt-v1.test.ts`
  - `setfarm/tests/internal-production/baseline-owner-producer-manifest-activation-controller-v1.test.ts` — A controller receipt/status, interruption, replay, CLI, import-inertness, and no-producer-before-activation tests.
  - `setfarm/tests/internal-production/baseline-post-handoff-cli.test.ts`
  - `setfarm/tests/internal-production/baseline-service-restart-helper-v1.test.ts`
  - `setfarm/tests/internal-production/baseline-spawner-startup-admission-v1.test.ts`
  - `setfarm/tests/internal-production/baseline-service-restart-sequence-v1.test.ts`
  - `setfarm/tests/internal-production/baseline-restart-authority-retirement-v1.test.ts`
  - `setfarm/tests/execution-attempts/migrations.test.ts` and `setfarm/tests/execution-attempts/migration-source-digests.test.ts`
  - `setfarm/package.json` command table entry `acceptance:baseline-post-handoff`
- Update only when the producer pin changes:
  - `mission-control/contracts/vendor/setfarm/mission-control-contracts.v1.lock.json`
  - the eight existing files plus the two operational-active status artifacts under `mission-control/contracts/vendor/setfarm/`
- Create `setfarm/docs/review-packets/2026-08-13-internal-production-baseline.md` after all live checks have produced exact values.

---

### Task 0: Deliver the Setfarm baseline handoff authority before live mutation

**Files:** the baseline-authority/migration Setfarm source/test/integration/package paths listed above, including the six exact A producer call-site modules, the one-way restart-authority retirement module/test, the dedicated bootstrap-handoff migration module, and its registration/digest/tests, plus `src/contracts/operational-active-run-status-v1.ts`, `src/contracts/operational-active-run-status-v1-cli.ts`, `tests/operational-active-run-status-v1.test.ts`, `src/contracts/mission-control-contract-artifacts.ts`, `tests/mission-control-contract-artifacts.test.ts`, `src/server/dashboard.ts`, `src/server/index.html`, and the two generated Mission Control contract artifacts. The source-manifest test computes this set from the File Map; no hand-maintained path count is accepted.

**Interfaces:** `InternalProductionBaselinePostHandoffReceiptV1`, `InternalProductionBaselineBackupReceiptV1`, `InternalProductionBaselineZeroOwnerMutationGuardV1`, exact `InternalProductionBaselineBootstrapHandoffMigrationReceiptV1`, `applyInternalProductionBaselineBootstrapHandoffMigrationV1({zeroOwnerGuardRef,zeroOwnerGuardHash})`, `resolveInternalProductionBaselineBootstrapHandoffMigrationReceiptV1({migrationReceiptRef,migrationReceiptHash})`, exact B-purpose `InternalProductionBaselineGoldenLaunchMigrationZeroOwnerAuthorizationV1`/`InternalProductionBaselineGoldenLaunchMigrationZeroOwnerConsumptionV1` bind-consume seam and pair-only resolvers, exact `InternalProductionPhysicalServiceRestartAuthorityEpochV1`, `InternalProductionBaselineRestartAuthorityRetirementV1`, A-owned `InternalProductionServiceRestartStartupHooksReadyV1`, `InternalProductionServiceRestartAuthorityActivationV1`, `InternalProductionServiceRestartAuthorityCutoverV1`, `prepareInternalProductionPhysicalServiceRestartAuthorityCutoverToRecoveryDV1({zeroOwnerGuardRef,zeroOwnerGuardHash})`, zero-input `resumeActiveInternalProductionPhysicalServiceRestartAuthorityCutoverToRecoveryDV1()`, read-only `observeInternalProductionPhysicalServiceRestartAuthorityCutoverStatusV1()`, and their exact pair-only resolvers, `resolveInternalProductionBaselineRestartAuthorityRetirementV1({retirementRef,retirementHash})`, exact `InternalProductionBaselineRuntimeSourceProjectionV1Schema`/`InternalProductionBaselineRuntimeSourceProjectionV1`, exact discriminated `InternalProductionBaselineServiceRestartAuthorityV1Schema`/`InternalProductionBaselineServiceRestartAuthorityV1`, `resolveInternalProductionBaselineServiceRestartAuthorityV1({receiptRef,receiptHash})`, exact `InternalProductionBaselineSpawnerStartupAdmissionV1`, `resolveActiveInternalProductionBaselineSpawnerStartupAdmissionV1()`, `claimInternalProductionBaselineSpawnerStartupAdmissionV1({admission})`, `awaitInternalProductionBaselineSpawnerRestartAuthorityV1({admission,startupClaimHash})`, exact `InternalProductionBaselineCompletionOwnerBootstrapTargetGuardV1`, `InternalProductionBaselineCompletionOwnerBootstrapCleanBuildVerificationV1`, `createInternalProductionBaselineCompletionOwnerBootstrapCleanBuildVerificationV1()`, `continueInternalProductionBaselineCompletionOwnerBootstrapAfterCleanBuildV1({verification})`, `InternalProductionBaselineSpawnerBootstrapRestartOperationV1`, `InternalProductionBaselineSpawnerBootstrapContinuationGrantV1`, `InternalProductionBaselineSpawnerBootstrapRestartSequenceReceiptV1`, `prepareInternalProductionBaselineSpawnerBootstrapRestartV1({targetGuard,postSettlementContinuationKind:"setfarm-bootstrap-main-claim-allocation-v1"})`, `executeOrRecoverInternalProductionBaselineSpawnerBootstrapRestartV1({operationRef,operationHash})`, `resolveInternalProductionBaselineSpawnerBootstrapRestartOperationV1({operationRef,operationHash})`, `resolveInternalProductionBaselineSpawnerBootstrapContinuationGrantV1({continuationGrantRef,continuationGrantHash})`, `finalizeInternalProductionBaselineSpawnerBootstrapRestartSequenceV1({operationRef,operationHash})`, `resolveInternalProductionBaselineSpawnerBootstrapRestartSequenceV1({sequenceRef,sequenceHash})`, code-owned `observeCompleteInternalProductionZeroOwnerCensusV1()`, `observeInternalProductionRuntimeSourceV1()`, `createOrResumeInternalProductionBaselineBackupV1()`, `restartInternalProductionBaselineServiceV1()`, `recordBaselinePostHandoffReceiptV1()`, `verifyCurrentBaselinePostHandoffReceiptV1()`, `resolveHistoricalBaselinePostHandoffReceiptV1()`, the exact operational-active status ABI below, and the strict `zero-owner|apply-bootstrap-handoff-migration|resolve-bootstrap-handoff-migration|restart-service|resume-restart-sequence|restart-sequence-status|runtime-source|backup|record|verify-current|resolve-historical --json` CLI described in Tasks 7–8. Ordinary `zero-owner`/`restart-service` retains its exact pair-only global-zero contract while A owns the physical restart epoch; B can bind/consume a generic guard only through A's exact named golden-launch migration seam; the bootstrap path is in-process only and uses the fenced target guard plus prepared operation pair. `runtime-source` remains diagnostic and `backup --json` remains fixed-path/idempotent.

Task 0 also owns exact `InternalProductionBaselineRestartSequenceIntentKindV1`, `InternalProductionBaselineServiceRestartAuthorityPairV1`, `InternalProductionBaselineRestartSequenceReceiptV1`, `InternalProductionBaselineRestartSequenceStatusV1`, `resumeInternalProductionBaselineRestartSequenceV1({intentKind})`, `observeInternalProductionBaselineRestartSequenceStatusV1({intentKind})`, and `resolveInternalProductionBaselineRestartSequenceReceiptV1({sequenceRef,sequenceHash})`. The CLI surface adds only `resume-restart-sequence --intent live-rebind|d-startup-hook-load|documentation-rollback --json` and read-only `restart-sequence-status --intent live-rebind|d-startup-hook-load|documentation-rollback --json`; all other arguments fail before observation or mutation.

Task 0's exact A-owned cutover ABI additionally includes `InternalProductionGlobalOwnerAdmissionFencePurposeV1`, `InternalProductionGlobalOwnerAdmissionFenceV1`, narrow null-target `acquireInternalProductionGlobalOwnerAdmissionFenceV1(...)`, dedicated `acquireInternalProductionSourceRunLaunchOwnerAdmissionFenceV1(...)`, dedicated `acquireInternalProductionRecoveryRestartOwnerAdmissionFenceV1(...)`, `reobserveInternalProductionGlobalOwnerAdmissionFenceV1(...)`, `closeInternalProductionSourceRunLaunchTargetReservationsUnderFenceV1(...)`, `closeInternalProductionRecoveryRestartTargetsUnderFenceV1(...)`, `INTERNAL_PRODUCTION_OWNER_CATEGORY_REGISTRY_V1`, `InternalProductionCompleteZeroOwnerCensusV1`, the key-checked `INTERNAL_PRODUCTION_OWNER_CATEGORY_CENSUS_MAP_V1`, `InternalProductionOwnerProducerRowV1`, `InternalProductionOwnerProducerManifestV1`, the eleven-row `INTERNAL_PRODUCTION_OWNER_PRODUCER_ROWS_A_V1`, exact `INTERNAL_PRODUCTION_OWNER_PRODUCER_MANIFEST_A_V1`, `InternalProductionOwnerProducerManifestSetActivationPredecessorV1`, `InternalProductionOwnerProducerManifestSetActivationCurrentV1`, `InternalProductionOwnerProducerManifestSetActivationStoreV1`, `activateInternalProductionOwnerProducerManifestSetV1(...)`, `resolveInternalProductionOwnerProducerManifestSetActivationV1(...)`, zero-input `resolveCurrentInternalProductionOwnerProducerManifestSetActivationV1()`, `InternalProductionBaselineOwnerProducerManifestActivationReceiptV1`, `InternalProductionBaselineOwnerProducerManifestActivationStatusV1`, zero-input `activateInternalProductionBaselineOwnerProducerManifestV1()`, zero-input read-only `observeInternalProductionBaselineOwnerProducerManifestActivationStatusV1()`, `assembleInternalProductionOwnerProducerRegistryV1(...)`, `InternalProductionOwnerReservationV1`, `beginOrAdoptInternalProductionOwnerReservationV1(...)`, `closeInternalProductionOwnerReservationV1(...)`, and their pair-only resolvers. It also owns `InternalProductionPhysicalServiceRestartAuthorityCutoverOperationV1` and `resolveInternalProductionPhysicalServiceRestartAuthorityCutoverOperationV1({operationRef,operationHash})`, plus the finite recovery-source bootstrap ABI `InternalProductionRecoverySourceBootstrapOperationV1`, `prepareInternalProductionRecoverySourceBootstrapRunV1()`, zero-input `resumeActiveInternalProductionRecoverySourceBootstrapRunV1()`, and read-only `observeInternalProductionRecoverySourceBootstrapStatusV1()`. The immutable cutover operation is private/path-free and exists before its bound guard can be consumed; D receives no operation pair and imports no operation writer.

The existing `acceptance:baseline-post-handoff` package command owns the exact additional CLI verbs `prepare-recovery-source-bootstrap --json`, zero-input `resume-recovery-source-bootstrap --json`, read-only `recovery-source-bootstrap-status --json`, zero-input `activate-owner-producer-manifest --json`, and read-only zero-input `owner-producer-manifest-status --json`. Its command table is exactly:

```json
{
  "acceptance:baseline-post-handoff": "node --import tsx src/internal-production/baseline-post-handoff-cli.ts"
}
```

The new activation verbs accept no plan, manifest, predecessor, receipt, head, source/build, root, path, or override input. A's code-owned manifest fixes purpose `recovery-d-source-delivery-v1`, repository Setfarm, workflow `feature-dev`, protocol `v3`, and the exact Tasks 1–2 prompt; no caller supplies them. Prepare's first durable write is one fixed full `recovery-source-bootstrap-pending-input.json` record with an acyclic ref/hash; no guard, fence, reservation, intent, outbox, operation, or run precedes its reopen. It deterministically derives distinct `source-run` and `run` owner keys plus the exact run-launch composite from that pending identity, then `acquireInternalProductionSourceRunLaunchOwnerAdmissionFenceV1(...)` atomically installs the fence and both typed target reservations under one owner-admission-head CAS. The fence's `source-run-launch` target family binds both pairs and `targetRunLaunchCompositeHash`; every other reservation and owner must be zero. The subsequently reopened start intent, outbox, operation, and reciprocal unique run row reproduce the same composite, and the run row embeds the exact `run` reservation pair before it becomes visible. The target family binds only the exact pending input, two target reservations, launch intent/outbox/operation, and reciprocal operation/run identities. It categorically excludes claim, execution-attempt, runtime-session, completion/effect, termination/finding, process/listener, worktree, artifact, and delivery owners. No descendant may reuse or equality-reference either target reservation. Resume reopens only the fixed pending/intent/outbox/operation members, reobserves the exact target family plus exactly zero unrelated reservations/owners immediately before the reciprocal operation/run commit, and starts or adopts exactly one Setfarm-owned run; only the authenticated target run is excluded from the unrelated census.

Before any downstream owner may publish, A content-addresses and freshly resolves both `InternalProductionRecoverySourceRunTerminalAuthorityV1` and `InternalProductionRecoveryRunLaunchTerminalAuthorityV1`; their derived pairs are excluded from their own hash projections and the final bootstrap receipt binds both. `closeInternalProductionSourceRunLaunchTargetReservationsUnderFenceV1(...)` is the only dual close permitted while a fence is held: under the same owner-admission-head CAS it requires both reservation pairs and the run-launch composite to equal the fence target family, freshly resolves both terminal authorities, equality-checks the reciprocal run/operation binding and terminal owners, reobserves every unrelated reservation/category count as zero, removes both targets, preserves the same fence token/head relation, and publishes one strict compound close receipt. Generic close, a one-sided close, another reservation, a non-target pair/composite, a downstream owner, a nonzero unrelated census, or fence drift fails without advancing the head. A then releases the preserved fence, publishes the final bootstrap receipt/status, and only afterward may claim, execution-attempt, runtime, completion/effect, outbox, process/listener, worktree, artifact, and delivery call sites begin their own canonical producer reservations. Crash/race tests cover atomic dual acquire, run-row publication, both terminal authorities, compound close CAS, preserved-fence reopen, release, and each downstream begin; they prove no downstream byte appears under either target reservation, a partial one-target close is impossible, and no fence gap admits an unrelated producer.

A also predeclares the sole later D restart target-family seam without importing D source. `acquireInternalProductionRecoveryRestartOwnerAdmissionFenceV1(...)` is callable only from D's exact reviewed authority module after the current manifest-set activation freshly resolves phase `A+B+C+D` or later and contains every implementation ID in `INTERNAL_PRODUCTION_RECOVERY_RESTART_TARGET_FAMILY_ABI_V1`. It freshly resolves the durable immutable D authorization-operation pair and its exact named coordinator authority plus phase-valid active-target authority, equality-checks the operation's namespace/service/coordination tuple, and derives every target owner key only as `hashCanonicalJson({schema:"setfarm.internal-production-recovery-restart-target-owner-key.v1",role,authorizationOperationRef,authorizationOperationHash,coordinatorAuthorityRef,coordinatorAuthorityHash,activeTargetAuthorityRef,activeTargetAuthorityHash,namespace,service,coordinationHash})`. Under one owner-admission-head CAS it acquires the purpose fence and reserves the complete seven-member typed family: `restartReservation`, `serviceRestartOperationReservation`, `launchOutboxReservation`, `helperProcessReservation`, `dispatchChildProcessReservation`, `startupListenerReservation`, and `replacementProcessReservation`. The input has no pending-input override, owner-key hash, category, implementation ID, reservation array, identity array, or permitted-existing-owner array. Fence reobservation permits only the exact named coordinator/active-target authorities and those seven byte-identical reservations and requires every other canonical reservation/owner zero. The input, stored family, and return type correlate each namespace to the coordinator branch with the identical literal `kind`: `recovery-active-run` alone requires non-null active-target ref/hash, while `source-release-barrier`, `cold-rehearsal`, and `documentation-handoff` each require their own matching kind and null active-target fields. No union-wide kind or crossed namespace branch is assignable or accepted at runtime.

The seven target pairs are the only begin authority for every D owner byte born between target-family acquire and terminalization: D does not call ordinary `beginOrAdoptInternalProductionOwnerReservationV1(...)` for the immutable service-restart operation, launch outbox, helper, dispatch child, replacement process, or startup listener. The immutable D operation embeds the complete target-family pairs and hash before any outbox or helper byte; each later owner embeds its one exact named pair and the same operation/family chain. D then publishes and reopens one immutable `InternalProductionServiceRestartTerminalCoreV1` whose hash binds the authorization-operation pair, service-restart operation pair, authorization-consumption pair, the seven literal reservation pairs, the seven role-named terminal-owner authority pairs, exact namespace/service/coordination/family identity, and the strict complete-or-failed disposition. `resolveInternalProductionServiceRestartTerminalCoreV1({terminalCoreRef,terminalCoreHash})` reopens and authenticates every bound member and recomputes the canonical core ref/hash; its strict schema excludes the future target-set close, fence release, occurrence, namespace/service head, and final completion/failure envelope pairs. `closeInternalProductionRecoveryRestartTargetsUnderFenceV1({fenceRef,fenceHash,terminalCoreRef,terminalCoreHash})` freshly reopens that acyclic core and the exact fence family and, under one owner-admission-head CAS, closes all seven targets together while leaving the authenticated coordinator/active-target authorities unchanged and preserving the fence. A one-target or partial close, generic close, ordinary close, cyclic final-envelope input, missing/extra target, target-order substitution, or family/core mismatch fails without head movement. After D publishes and reopens the exact occurrence and namespace/service head, `releaseInternalProductionGlobalOwnerAdmissionFenceV1(...)` freshly resolves the same preserved fence and requires the byte-identical terminal-core pair, target-set-close pair, occurrence pair, and head pair; it proves core → close → occurrence/head equality before release. A close-only release, crossed core/close, stale/forked occurrence or head, or missing member fails without head movement. D may create its final envelope only after that bound release chain.

Crash/race tests cover the pre-existing exact coordinator/active-target authorities, atomic seven-reservation acquire, every fenced publication without ordinary begin, immutable operation and terminal-core publication, exact compound close, occurrence/head publication, fence release, coordinator continuation, and cross-namespace/service/coordination replay. They crash before and after every member publication and the acquire/close/release head CAS, prove a prefix or per-reservation close is impossible, prove no terminal core depends on the future close/occurrence/head/release/final envelope, and require release to bind the exact core → target-set close → occurrence/head chain under the same preserved fence. Tests reject close-only release, missing/swapped/cross-operation core, close, occurrence, or head, stale/forked head, and non-null terminal-core/occurrence/head fields in source-run-launch or either null-target purpose; they also prove an unrelated producer never wins inside the fence and an authenticated coordinator/active target is never falsely required to be zero.

Status visibility is controlled by one fixed, no-replace/CAS `recovery-source-bootstrap-visibility-head.json`, not by scanning member stores. The pending-input record publishes the `pending-input` head first. Atomic fence/two-reservation acquisition, intent, outbox, and operation may then be published and reopened privately, but status continues to return the prior `pending-input` projection with every later field null until one byte-exact `prepared` visibility successor is fsynced and reopened after all prepared members. Dispatch, reciprocal run binding, both terminal authorities, compound pair close, fence release, and terminal receipt similarly remain hidden behind the `prepared` projection until one byte-exact `terminal` visibility successor is fsynced and reopened after the complete receipt. Thus there is no public `starting` or `started` status. Zero-input resume may adopt a unique byte-exact intended suffix and advance the visibility head; it never trusts status to reconstruct it. Multiple candidates, a byte mismatch, an impossible removal, a one-reservation prefix, or a head/predecessor conflict returns the strict `recovery-required` branch with `RECOVERY_SOURCE_BOOTSTRAP_PREFIX_AMBIGUOUS`, the last visible head pair, and all hidden authority fields null; it performs no mutation. Every other strict branch carries every lifecycle pair with phase-exact nullability, and terminal status freshly resolves both terminal authorities, the compound close, and fence release before exposing the final source-run receipt pair. A crash before/after pending record, atomic fence+reservation-pair CAS, intent, outbox, operation, prepared visibility, start dispatch, reciprocal commit, either terminal authority, compound close, fence release, receipt, terminal visibility, or response uses zero-input resume and can adopt only the same operation/run. It never mints another reservation, operation, outbox, or run. D consumes and freshly resolves the returned exact source-run pair and its nested two-reservation/two-terminal/compound-close/fence chain before accepting its source delivery. Tests run prepare/resume/status in separate empty-environment processes, assert the exact last-visible projection after every crash boundary, exhaustively validate every branch's null relations and nested pair, force each ambiguity into the typed no-mutation branch, race every other owner producer, require zero second-start count, and reject any invocation through D's not-yet-delivered command. The source-bootstrap path has no separate owner guard: its only mutation authority is the authenticated dual target-reservation family held by the global admission fence.

```typescript
export const SetfarmOperationalActiveRunStatusV1Schema = z.enum([
  "running",
  "resuming",
  "cancelling",
  "failing",
]);

export type SetfarmOperationalActiveRunStatusV1 = z.infer<
  typeof SetfarmOperationalActiveRunStatusV1Schema
>;

export const SETFARM_OPERATIONAL_ACTIVE_RUN_STATUSES_V1 = [
  "running",
  "resuming",
  "cancelling",
  "failing",
] as const satisfies readonly SetfarmOperationalActiveRunStatusV1[];

export function isSetfarmOperationalActiveRunStatusV1(
  value: unknown,
): value is SetfarmOperationalActiveRunStatusV1;
```

The baseline receipt module also exports this exact composite restart authority; there is no bare restart receipt accepted by B:

```typescript
export type InternalProductionBaselineRuntimeSourceProjectionV1 = Readonly<{
  schema: "setfarm.internal-production-baseline-runtime-source-projection.v1";
  setfarmSha: string;
  missionControlSha: string;
  setfarmBuildInfoHash: string;
  spawnerBuildHash: string;
  spawnerServiceIdentityHash: string;
  dashboardBuildHash: string;
  dashboardServiceIdentityHash: string;
  missionControlBuildHash: string;
  missionControlServiceIdentityHash: string;
  projectionHash: string;
}>;

export declare const InternalProductionBaselineRuntimeSourceProjectionV1Schema:
  z.ZodType<InternalProductionBaselineRuntimeSourceProjectionV1>;

export type InternalProductionBaselineBootstrapHandoffMigrationReceiptV1 = Readonly<{
  schema: "setfarm.internal-production-baseline-bootstrap-handoff-migration-receipt.v1";
  migrationId: "contract-spine-bootstrap-main-claim-handoff-v1";
  migrationSourceSha: string;
  migrationImplementationBlobHash: string;
  orderedStatementsHash: string;
  namedMigrationDigestEntryHash: string;
  migrationDigest: string;
  schemaProjectionHash: string;
  zeroOwnerGuardRef: CanonicalRef;
  zeroOwnerGuardHash: string;
  guardConsumed: true;
  planStatus: "exact-pending-migration";
  applyStatus: "applied";
  verifyStatus: "verified";
  bootstrapHandoffOperationTablePresent: true;
  bootstrapHandoffOperationIdUnique: true;
  bootstrapHandoffClaimIdUnique: true;
  terminalReceiptPairColumnsPresent: true;
  migrationReceiptRef: CanonicalRef;
  migrationReceiptHash: string;
}>;

export function applyInternalProductionBaselineBootstrapHandoffMigrationV1(
  input: Readonly<{
    zeroOwnerGuardRef: CanonicalRef;
    zeroOwnerGuardHash: string;
  }>,
): Promise<Readonly<{
  migrationReceiptRef: CanonicalRef;
  migrationReceiptHash: string;
}>>;

export function resolveInternalProductionBaselineBootstrapHandoffMigrationReceiptV1(
  input: Readonly<{
    migrationReceiptRef: CanonicalRef;
    migrationReceiptHash: string;
  }>,
): Promise<InternalProductionBaselineBootstrapHandoffMigrationReceiptV1>;

export type InternalProductionBaselineGoldenLaunchMigrationZeroOwnerAuthorizationV1 = Readonly<{
  schema: "setfarm.internal-production-baseline-golden-launch-migration-zero-owner-authorization.v1";
  purpose: "golden-launch-operation-migration-release-v1";
  pendingInputRef: CanonicalRef;
  pendingInputHash: string;
  zeroOwnerGuardRef: CanonicalRef;
  zeroOwnerGuardHash: string;
  authorizationRef: CanonicalRef;
  authorizationHash: string;
}>;

export type InternalProductionBaselineGoldenLaunchMigrationZeroOwnerConsumptionV1 = Readonly<{
  schema: "setfarm.internal-production-baseline-golden-launch-migration-zero-owner-consumption.v1";
  purpose: "golden-launch-operation-migration-release-v1";
  authorizationRef: CanonicalRef;
  authorizationHash: string;
  pendingInputRef: CanonicalRef;
  pendingInputHash: string;
  operationRef: CanonicalRef;
  operationHash: string;
  guardConsumed: true;
  consumptionRef: CanonicalRef;
  consumptionHash: string;
}>;

export function bindInternalProductionBaselineGoldenLaunchMigrationZeroOwnerGuardV1(
  input: Readonly<{
    zeroOwnerGuardRef: CanonicalRef;
    zeroOwnerGuardHash: string;
    pendingInputRef: CanonicalRef;
    pendingInputHash: string;
  }>,
): Promise<Readonly<{ authorizationRef: CanonicalRef; authorizationHash: string }>>;

export function consumeInternalProductionBaselineGoldenLaunchMigrationZeroOwnerGuardV1(
  input: Readonly<{
    authorizationRef: CanonicalRef;
    authorizationHash: string;
    operationRef: CanonicalRef;
    operationHash: string;
  }>,
): Promise<Readonly<{ consumptionRef: CanonicalRef; consumptionHash: string }>>;

export function resolveInternalProductionBaselineGoldenLaunchMigrationZeroOwnerAuthorizationV1(
  input: Readonly<{ authorizationRef: CanonicalRef; authorizationHash: string }>,
): Promise<InternalProductionBaselineGoldenLaunchMigrationZeroOwnerAuthorizationV1>;

export function resolveInternalProductionBaselineGoldenLaunchMigrationZeroOwnerConsumptionV1(
  input: Readonly<{ consumptionRef: CanonicalRef; consumptionHash: string }>,
): Promise<InternalProductionBaselineGoldenLaunchMigrationZeroOwnerConsumptionV1>;

export type InternalProductionPhysicalServiceRestartAuthorityEpochV1 = Readonly<{
  schema: "setfarm.internal-production-physical-service-restart-authority-epoch.v1";
  epochOrdinal: 1 | 2;
  authorityOwner: "baseline-a" | "recovery-d";
  services: readonly ["setfarm-spawner", "setfarm-dashboard", "mission-control"];
  predecessorEpochRef: CanonicalRef | null;
  predecessorEpochHash: string | null;
  retirementRef: CanonicalRef | null;
  retirementHash: string | null;
  startupHooksReadyRef: CanonicalRef | null;
  startupHooksReadyHash: string | null;
  successorActivationRef: CanonicalRef | null;
  successorActivationHash: string | null;
  epochRef: CanonicalRef;
  epochHash: string;
}>;

export type InternalProductionBaselineRestartAuthorityRetirementV1 = Readonly<{
  schema: "setfarm.internal-production-baseline-restart-authority-retirement.v1";
  disposition: "retired-to-recovery-d";
  predecessorEpochRef: CanonicalRef;
  predecessorEpochHash: string;
  successorEpochOrdinal: 2;
  successorAuthorityOwner: "recovery-d";
  startupHooksReadyRef: CanonicalRef;
  startupHooksReadyHash: string;
  successorActivationRef: CanonicalRef;
  successorActivationHash: string;
  zeroOwnerGuardRef: CanonicalRef;
  zeroOwnerGuardHash: string;
  completeZeroOwnerCensusHash: string;
  services: readonly ["setfarm-spawner", "setfarm-dashboard", "mission-control"];
  pendingBaselineRestartCount: 0;
  liveBaselineRestartCount: 0;
  activeBaselineSequenceCount: 0;
  liveBaselineHelperCount: 0;
  retainedHistoricalAuthoritySetHash: string;
  retirementRef: CanonicalRef;
  retirementHash: string;
}>;

export type InternalProductionBaselineRestartRefusalCodeV1 =
  "BASELINE_RESTART_AUTHORITY_RETIRED";

export type InternalProductionGlobalOwnerAdmissionFencePurposeV1 =
  | "golden-launch-operation-migration-release-v1"
  | "recovery-d-physical-service-restart-authority-cutover-v1"
  | "recovery-d-source-delivery-v1"
  | "recovery-d-physical-service-restart-operation-v1";

export const INTERNAL_PRODUCTION_OWNER_CATEGORY_REGISTRY_V1 = [
  "run", "claim", "execution-attempt", "runtime-session", "completion-owner", "mandatory-effect",
  "ordinary-service-start", "restart-reservation", "service-restart-operation",
  "launch-preparation", "prepared-launch", "staged-case", "fixture-attempt",
  "artifact-reservation", "artifact-publication", "docs-session", "docs-lease",
  "fleet-stage", "fleet-inflight", "fleet-review", "matrix-inflight",
  "launch-outbox", "termination", "finding", "recovery", "operational-delivery",
  "source-run", "cold-rehearsal", "compilation-lease", "execution-lease",
  "process", "listener", "worktree", "dirty-worktree", "stale-child",
] as const;

export type InternalProductionOwnerCategoryV1 =
  typeof INTERNAL_PRODUCTION_OWNER_CATEGORY_REGISTRY_V1[number];

export type InternalProductionCompleteZeroOwnerCensusV1 = Readonly<{
  activeRunCount: number; openClaimCount: number; executionAttemptCount: number;
  activeRuntimeSessionCount: number;
  activeCompletionOwnerCount: number; unsettledMandatoryEffectCount: number;
  ordinaryStartingCount: number; restartReservationCount: number;
  serviceRestartOperationCount: number; launchPreparationCount: number;
  preparedLaunchCount: number; stagedCaseCount: number; fixtureAttemptCount: number;
  artifactReservationCount: number; publicationBatchCount: number;
  artifactPublicationCount: number; docsSessionCount: number; docsLeaseCount: number;
  fleetStageCount: number; fleetInflightCount: number; fleetPendingReviewCount: number;
  matrixInflightCount: number; launchOutboxCount: number; terminationOwnerCount: number;
  findingOwnerCount: number; recoveryOwnerCount: number; operationalDeliveryCount: number;
  sourceRunOwnerCount: number; coldRehearsalOwnerCount: number;
  compilationLeaseCount: number; executionLeaseCount: number; ownedProcessCount: number;
  ownedListenerCount: number; ownedWorktreeCount: number; dirtyWorktreeCount: number;
  staleChildCount: number;
}>;

export const INTERNAL_PRODUCTION_OWNER_CATEGORY_CENSUS_MAP_V1 = {
  run: ["activeRunCount"], claim: ["openClaimCount"],
  "execution-attempt": ["executionAttemptCount"],
  "runtime-session": ["activeRuntimeSessionCount"],
  "completion-owner": ["activeCompletionOwnerCount"],
  "mandatory-effect": ["unsettledMandatoryEffectCount"],
  "ordinary-service-start": ["ordinaryStartingCount"],
  "restart-reservation": ["restartReservationCount"],
  "service-restart-operation": ["serviceRestartOperationCount"],
  "launch-preparation": ["launchPreparationCount"],
  "prepared-launch": ["preparedLaunchCount"],
  "staged-case": ["stagedCaseCount"], "fixture-attempt": ["fixtureAttemptCount"],
  "artifact-reservation": ["artifactReservationCount"],
  "artifact-publication": ["publicationBatchCount", "artifactPublicationCount"],
  "docs-session": ["docsSessionCount"], "docs-lease": ["docsLeaseCount"],
  "fleet-stage": ["fleetStageCount"], "fleet-inflight": ["fleetInflightCount"],
  "fleet-review": ["fleetPendingReviewCount"],
  "matrix-inflight": ["matrixInflightCount"],
  "launch-outbox": ["launchOutboxCount"], termination: ["terminationOwnerCount"],
  finding: ["findingOwnerCount"], recovery: ["recoveryOwnerCount"],
  "operational-delivery": ["operationalDeliveryCount"],
  "source-run": ["sourceRunOwnerCount"], "cold-rehearsal": ["coldRehearsalOwnerCount"],
  "compilation-lease": ["compilationLeaseCount"],
  "execution-lease": ["executionLeaseCount"], process: ["ownedProcessCount"],
  listener: ["ownedListenerCount"], worktree: ["ownedWorktreeCount"],
  "dirty-worktree": ["dirtyWorktreeCount"], "stale-child": ["staleChildCount"],
} as const satisfies Record<
  InternalProductionOwnerCategoryV1,
  readonly (keyof InternalProductionCompleteZeroOwnerCensusV1)[]
>;

export type InternalProductionCompleteZeroOwnerCensusObservationV1 = Readonly<{
  schema: "setfarm.internal-production-complete-zero-owner-census-observation.v1";
  census: InternalProductionCompleteZeroOwnerCensusV1;
  ownerCategoryRegistryHash: string;
  ownerCategoryCensusMapHash: string;
  activeProducerManifestSetActivationRef: CanonicalRef;
  activeProducerManifestSetActivationHash: string;
  activeProducerManifestSetHash: string;
  reservationIdentitySetHash: string;
  ownerIdentitySetHash: string;
  observationHash: string;
}>;
export function observeCompleteInternalProductionZeroOwnerCensusV1():
  Promise<InternalProductionCompleteZeroOwnerCensusObservationV1>;

export type InternalProductionOwnerProducerRowV1 = Readonly<{
  plan: "A" | "B" | "C" | "D" | "E";
  module: string;
  function: string;
  implementationId: string;
  category: InternalProductionOwnerCategoryV1;
  ownerKeyDerivationId: string;
  censusKeys: readonly (keyof InternalProductionCompleteZeroOwnerCensusV1)[];
}>;

export const INTERNAL_PRODUCTION_OWNER_PRODUCER_ROWS_A_V1 = [
  { plan: "A", module: "src/spawner.ts", function: "reserveRuntimeRunOwnerV1", implementationId: "a-runtime-run-v1", category: "run", ownerKeyDerivationId: "run-id-generation-v1", censusKeys: ["activeRunCount"] },
  { plan: "A", module: "src/execution/claim-runtime-publication.ts", function: "reserveClaimOwnerV1", implementationId: "a-claim-v1", category: "claim", ownerKeyDerivationId: "claim-id-worktree-v1", censusKeys: ["openClaimCount"] },
  { plan: "A", module: "src/execution/attempt-repository.ts", function: "reserveExecutionAttemptOwnerV1", implementationId: "a-execution-attempt-v1", category: "execution-attempt", ownerKeyDerivationId: "execution-attempt-id-generation-v1", censusKeys: ["executionAttemptCount"] },
  { plan: "A", module: "src/spawner.ts", function: "reserveRuntimeSessionOwnerV1", implementationId: "a-runtime-session-v1", category: "runtime-session", ownerKeyDerivationId: "runtime-session-generation-v1", censusKeys: ["activeRuntimeSessionCount"] },
  { plan: "A", module: "src/execution/runtime-completion.ts", function: "reserveCompletionOwnerV1", implementationId: "a-completion-owner-v1", category: "completion-owner", ownerKeyDerivationId: "completion-request-owner-generation-v1", censusKeys: ["activeCompletionOwnerCount"] },
  { plan: "A", module: "src/execution/runtime-completion-effect-runner.ts", function: "reserveMandatoryEffectOwnerV1", implementationId: "a-mandatory-effect-v1", category: "mandatory-effect", ownerKeyDerivationId: "completion-effect-operation-v1", censusKeys: ["unsettledMandatoryEffectCount"] },
  { plan: "A", module: "src/spawner.ts", function: "reserveTerminationOwnerV1", implementationId: "a-termination-v1", category: "termination", ownerKeyDerivationId: "termination-operation-v1", censusKeys: ["terminationOwnerCount"] },
  { plan: "A", module: "src/execution/runtime-completion.ts", function: "reserveFindingOwnerV1", implementationId: "a-finding-v1", category: "finding", ownerKeyDerivationId: "finding-scope-v1", censusKeys: ["findingOwnerCount"] },
  { plan: "A", module: "src/execution/claim-runtime-publication.ts", function: "reserveOperationalDeliveryOwnerV1", implementationId: "a-operational-delivery-v1", category: "operational-delivery", ownerKeyDerivationId: "claim-delivery-operation-v1", censusKeys: ["operationalDeliveryCount"] },
  { plan: "A", module: "src/internal-production/baseline-post-handoff-receipt-v1.ts", function: "reserveRecoverySourceRunOwnerV1", implementationId: "a-recovery-source-run-v1", category: "source-run", ownerKeyDerivationId: "source-bootstrap-operation-run-v1", censusKeys: ["sourceRunOwnerCount"] },
  { plan: "A", module: "src/internal-production/baseline-post-handoff-receipt-v1.ts", function: "reserveRecoverySourceBootstrapRunOwnerV1", implementationId: "a-recovery-source-bootstrap-run-v1", category: "run", ownerKeyDerivationId: "source-bootstrap-reciprocal-run-v1", censusKeys: ["activeRunCount"] },
] as const satisfies readonly InternalProductionOwnerProducerRowV1[];

export type InternalProductionOwnerProducerManifestV1 = Readonly<{
  schema: "setfarm.internal-production-owner-producer-manifest.v1";
  plan: "A" | "B" | "C" | "D" | "E";
  rows: readonly InternalProductionOwnerProducerRowV1[];
  manifestHash: string;
}>;
export type InternalProductionOwnerProducerImplementationIdV1 = string;
export const INTERNAL_PRODUCTION_OWNER_PRODUCER_MANIFEST_A_V1 = {
  schema: "setfarm.internal-production-owner-producer-manifest.v1",
  plan: "A",
  rows: INTERNAL_PRODUCTION_OWNER_PRODUCER_ROWS_A_V1,
  manifestHash: hashCanonicalJson({
    schema: "setfarm.internal-production-owner-producer-manifest.v1",
    plan: "A",
    rows: INTERNAL_PRODUCTION_OWNER_PRODUCER_ROWS_A_V1,
  }),
} as const satisfies InternalProductionOwnerProducerManifestV1;

export type InternalProductionOwnerProducerManifestSetPhaseV1 =
  | "A" | "A+B" | "A+B+C" | "A+B+C+D" | "A+B+C+D+E";
export type InternalProductionOwnerProducerManifestSetActivationReceiptV1 = Readonly<{
  schema: "setfarm.internal-production-owner-producer-manifest-set-activation.v1";
  phase: InternalProductionOwnerProducerManifestSetPhaseV1;
  orderedPlans: readonly ("A" | "B" | "C" | "D" | "E")[];
  orderedManifestHashes: readonly string[];
  orderedSourceBuildAuthorities: readonly Readonly<{
    plan: "A" | "B" | "C" | "D" | "E";
    sourceBuildAuthorityRef: CanonicalRef;
    sourceBuildAuthorityHash: string;
  }>[];
  manifestSetHash: string;
  ownerCategoryRegistryHash: string;
  ownerCategoryCensusMapHash: string;
  predecessorActivationRef: CanonicalRef | null;
  predecessorActivationHash: string | null;
  predecessorHeadRef: CanonicalRef | null;
  predecessorHeadHash: string | null;
  activationRef: CanonicalRef;
  activationHash: string;
}>;
export type InternalProductionOwnerProducerManifestSetActivationHeadV1 = Readonly<{
  schema: "setfarm.internal-production-owner-producer-manifest-set-activation-head.v1";
  phase: InternalProductionOwnerProducerManifestSetPhaseV1;
  activationRef: CanonicalRef;
  activationHash: string;
  predecessorHeadRef: CanonicalRef | null;
  predecessorHeadHash: string | null;
  headRef: CanonicalRef;
  headHash: string;
}>;
export type InternalProductionOwnerProducerManifestSetActivationPredecessorV1 = Readonly<{
  activationRef: CanonicalRef;
  activationHash: string;
  headRef: CanonicalRef;
  headHash: string;
}>;
export type InternalProductionOwnerProducerManifestSetActivationCurrentV1 = Readonly<{
  head: InternalProductionOwnerProducerManifestSetActivationHeadV1;
  receipt: InternalProductionOwnerProducerManifestSetActivationReceiptV1;
}>;
export type InternalProductionBaselineOwnerProducerManifestActivationReceiptV1 = Readonly<{
  schema: "setfarm.internal-production-baseline-owner-producer-manifest-activation.v1";
  plan: "A";
  manifestHash: string;
  sourceBuildAuthorityRef: CanonicalRef;
  sourceBuildAuthorityHash: string;
  predecessorActivationRef: null;
  predecessorActivationHash: null;
  predecessorHeadRef: null;
  predecessorHeadHash: null;
  successorActivationRef: CanonicalRef;
  successorActivationHash: string;
  successorHeadRef: CanonicalRef;
  successorHeadHash: string;
  receiptRef: CanonicalRef;
  receiptHash: string;
}>;
export type InternalProductionBaselineOwnerProducerManifestActivationStatusV1 =
  | Readonly<{
      schema: "setfarm.internal-production-baseline-owner-producer-manifest-activation-status.v1";
      state: "absent";
      predecessorActivationRef: null; predecessorActivationHash: null;
      predecessorHeadRef: null; predecessorHeadHash: null;
      successorActivationRef: null; successorActivationHash: null;
      successorHeadRef: null; successorHeadHash: null;
      receiptRef: null; receiptHash: null; statusHash: string;
    }>
  | Readonly<{
      schema: "setfarm.internal-production-baseline-owner-producer-manifest-activation-status.v1";
      state: "activating" | "blocked";
      predecessorActivationRef: null; predecessorActivationHash: null;
      predecessorHeadRef: null; predecessorHeadHash: null;
      successorActivationRef: CanonicalRef | null; successorActivationHash: string | null;
      successorHeadRef: CanonicalRef | null; successorHeadHash: string | null;
      receiptRef: null; receiptHash: null; statusHash: string;
    }>
  | Readonly<{
      schema: "setfarm.internal-production-baseline-owner-producer-manifest-activation-status.v1";
      state: "active";
      predecessorActivationRef: null; predecessorActivationHash: null;
      predecessorHeadRef: null; predecessorHeadHash: null;
      successorActivationRef: CanonicalRef; successorActivationHash: string;
      successorHeadRef: CanonicalRef; successorHeadHash: string;
      receiptRef: CanonicalRef; receiptHash: string; statusHash: string;
    }>;
export function activateInternalProductionBaselineOwnerProducerManifestV1():
  Promise<InternalProductionBaselineOwnerProducerManifestActivationReceiptV1>;
export function observeInternalProductionBaselineOwnerProducerManifestActivationStatusV1():
  Promise<InternalProductionBaselineOwnerProducerManifestActivationStatusV1>;
export interface InternalProductionOwnerProducerManifestSetActivationStoreV1 {
  activate(input: Readonly<{
    expectedPredecessor: InternalProductionOwnerProducerManifestSetActivationPredecessorV1 | null;
    manifests: readonly InternalProductionOwnerProducerManifestV1[];
  }>): Promise<Readonly<{ activationRef: CanonicalRef; activationHash: string }>>;
  resolve(input: Readonly<{
    activationRef: CanonicalRef;
    activationHash: string;
  }>): Promise<InternalProductionOwnerProducerManifestSetActivationReceiptV1>;
  resolveCurrent(): Promise<InternalProductionOwnerProducerManifestSetActivationCurrentV1>;
}
export function activateInternalProductionOwnerProducerManifestSetV1(input: Readonly<{
  expectedPredecessor: InternalProductionOwnerProducerManifestSetActivationPredecessorV1 | null;
  manifests: readonly InternalProductionOwnerProducerManifestV1[];
}>): Promise<Readonly<{ activationRef: CanonicalRef; activationHash: string }>>;
export function resolveInternalProductionOwnerProducerManifestSetActivationV1(input: Readonly<{
  activationRef: CanonicalRef;
  activationHash: string;
}>): Promise<InternalProductionOwnerProducerManifestSetActivationReceiptV1>;
export function resolveCurrentInternalProductionOwnerProducerManifestSetActivationV1():
  Promise<InternalProductionOwnerProducerManifestSetActivationCurrentV1>;
export function assembleInternalProductionOwnerProducerRegistryV1(input: Readonly<{
  manifests: readonly [
    InternalProductionOwnerProducerManifestV1,
    InternalProductionOwnerProducerManifestV1,
    InternalProductionOwnerProducerManifestV1,
    InternalProductionOwnerProducerManifestV1,
    InternalProductionOwnerProducerManifestV1,
  ];
}>): Readonly<{ rows: readonly InternalProductionOwnerProducerRowV1[]; registryHash: string }>;

export type InternalProductionOwnerReservationV1 = Readonly<{
  schema: "setfarm.internal-production-owner-reservation.v1";
  category: InternalProductionOwnerCategoryV1;
  ownerKeyHash: string;
  producerPurposeHash: string;
  producerImplementationId: InternalProductionOwnerProducerImplementationIdV1;
  producerImplementationHash: string;
  ownerAdmissionHeadPredecessorHash: string;
  reservationRef: CanonicalRef;
  reservationHash: string;
}>;
export type InternalProductionOwnerReservationCloseV1 = Readonly<{
  schema: "setfarm.internal-production-owner-reservation-close.v1";
  closeKind: "ordinary" | "fence-target";
  reservationRef: CanonicalRef;
  reservationHash: string;
  terminalOwnerRef: CanonicalRef;
  terminalOwnerHash: string;
  ownerAdmissionHeadPredecessorHash: string;
  ownerAdmissionHeadSuccessorHash: string;
  preservedFenceRef: CanonicalRef | null;
  preservedFenceHash: string | null;
  closeRef: CanonicalRef;
  closeHash: string;
}>;

export function beginOrAdoptInternalProductionOwnerReservationV1(input: Readonly<{
  producerImplementationId: InternalProductionOwnerProducerImplementationIdV1;
  ownerKeyHash: string;
}>): Promise<InternalProductionOwnerReservationV1>;
export function closeInternalProductionOwnerReservationV1(input: Readonly<{
  reservationRef: CanonicalRef;
  reservationHash: string;
  terminalOwnerRef: CanonicalRef;
  terminalOwnerHash: string;
}>): Promise<InternalProductionOwnerReservationCloseV1>;
export function resolveInternalProductionOwnerReservationV1(input: Readonly<{
  reservationRef: CanonicalRef;
  reservationHash: string;
}>): Promise<InternalProductionOwnerReservationV1>;
export function resolveInternalProductionOwnerReservationCloseV1(input: Readonly<{
  closeRef: CanonicalRef;
  closeHash: string;
}>): Promise<InternalProductionOwnerReservationCloseV1>;

// The implementation looks up implementationId in the already activated,
// code-owned manifest for that producer's delivered plan and derives category,
// owner-key grammar, producer-purpose hash, and census keys. Callers cannot
// supply or override those values; an inactive/future-plan row is unavailable.

export type InternalProductionOwnerReservationIdentityV1 = Readonly<{
  category: InternalProductionOwnerCategoryV1;
  producerImplementationId: InternalProductionOwnerProducerImplementationIdV1;
  ownerKeyHash: string;
  reservationRef: CanonicalRef;
  reservationHash: string;
}>;

export type InternalProductionRecoveryRestartCoordinatorTargetAuthorityV1 =
  | Readonly<{
      kind: "recovery-active-run";
      coordinatorAuthorityRef: CanonicalRef;
      coordinatorAuthorityHash: string;
      activeTargetAuthorityRef: CanonicalRef;
      activeTargetAuthorityHash: string;
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

export const INTERNAL_PRODUCTION_RECOVERY_RESTART_TARGET_FAMILY_ABI_V1 = {
  schema: "setfarm.internal-production-recovery-restart-target-family-abi.v1",
  restartReservation: {
    role: "restart-reservation",
    category: "restart-reservation",
    producerImplementationId: "d-restart-reservation-v1",
  },
  serviceRestartOperationReservation: {
    role: "service-restart-operation",
    category: "service-restart-operation",
    producerImplementationId: "d-service-restart-operation-v1",
  },
  launchOutboxReservation: {
    role: "launch-outbox",
    category: "launch-outbox",
    producerImplementationId: "d-service-restart-launch-outbox-v1",
  },
  helperProcessReservation: {
    role: "helper-process",
    category: "process",
    producerImplementationId: "d-service-restart-helper-process-v1",
  },
  dispatchChildProcessReservation: {
    role: "dispatch-child-process",
    category: "process",
    producerImplementationId: "d-service-restart-child-process-v1",
  },
  startupListenerReservation: {
    role: "startup-listener",
    category: "listener",
    producerImplementationId: "d-service-restart-startup-listener-v1",
  },
  replacementProcessReservation: {
    role: "replacement-process",
    category: "process",
    producerImplementationId: "d-service-restart-replacement-process-v1",
  },
} as const;

export const INTERNAL_PRODUCTION_RECOVERY_RESTART_TARGET_FAMILY_ABI_HASH_V1 =
  "be60e0b9d36372e19f765b93f77f53fb6f1b8ec8a7421eab4f6f4a0f96faaf05" as const;
// Tests recompute hashCanonicalJson(INTERNAL_PRODUCTION_RECOVERY_RESTART_TARGET_FAMILY_ABI_V1)
// and require exact equality with this pinned ABI hash.

export type InternalProductionRecoveryRestartNamespaceV1 =
  InternalProductionRecoveryRestartCoordinatorTargetAuthorityV1["kind"];

type InternalProductionRecoveryRestartTargetFamilyCommonV1 = Readonly<{
  kind: "recovery-restart";
  authorizationOperationRef: CanonicalRef;
  authorizationOperationHash: string;
  service: "setfarm-spawner" | "setfarm-dashboard" | "mission-control";
  coordinationHash: string;
  restartReservation: InternalProductionOwnerReservationIdentityV1 & {
    category: "restart-reservation";
    producerImplementationId: "d-restart-reservation-v1";
  };
  serviceRestartOperationReservation: InternalProductionOwnerReservationIdentityV1 & {
    category: "service-restart-operation";
    producerImplementationId: "d-service-restart-operation-v1";
  };
  launchOutboxReservation: InternalProductionOwnerReservationIdentityV1 & {
    category: "launch-outbox";
    producerImplementationId: "d-service-restart-launch-outbox-v1";
  };
  helperProcessReservation: InternalProductionOwnerReservationIdentityV1 & {
    category: "process";
    producerImplementationId: "d-service-restart-helper-process-v1";
  };
  dispatchChildProcessReservation: InternalProductionOwnerReservationIdentityV1 & {
    category: "process";
    producerImplementationId: "d-service-restart-child-process-v1";
  };
  startupListenerReservation: InternalProductionOwnerReservationIdentityV1 & {
    category: "listener";
    producerImplementationId: "d-service-restart-startup-listener-v1";
  };
  replacementProcessReservation: InternalProductionOwnerReservationIdentityV1 & {
    category: "process";
    producerImplementationId: "d-service-restart-replacement-process-v1";
  };
  targetFamilyAbiHash:
    typeof INTERNAL_PRODUCTION_RECOVERY_RESTART_TARGET_FAMILY_ABI_HASH_V1;
  targetFamilyHash: string;
}>;

export type InternalProductionRecoveryRestartTargetFamilyV1 = {
  [Namespace in InternalProductionRecoveryRestartNamespaceV1]:
    InternalProductionRecoveryRestartTargetFamilyCommonV1 & Readonly<{
      namespace: Namespace;
      coordinatorTargetAuthority: Extract<
        InternalProductionRecoveryRestartCoordinatorTargetAuthorityV1,
        { kind: Namespace }
      >;
    }>;
}[InternalProductionRecoveryRestartNamespaceV1];

export type InternalProductionGlobalOwnerAdmissionFenceTargetFamilyV1 =
  | Readonly<{
      kind: "none";
      targetFamilyHash: null;
    }>
  | Readonly<{
      kind: "source-run-launch";
      sourceRunReservation: InternalProductionOwnerReservationIdentityV1 & {
        category: "source-run";
        producerImplementationId: "a-recovery-source-run-v1";
      };
      runReservation: InternalProductionOwnerReservationIdentityV1 & {
        category: "run";
        producerImplementationId: "a-recovery-source-bootstrap-run-v1";
      };
      targetRunLaunchCompositeHash: string;
      targetFamilyHash: string;
    }>
  | InternalProductionRecoveryRestartTargetFamilyV1;

export type InternalProductionGlobalOwnerAdmissionFenceV1 = Readonly<{
  schema: "setfarm.internal-production-global-owner-admission-fence.v1";
  purpose: InternalProductionGlobalOwnerAdmissionFencePurposeV1;
  pendingInputRef: CanonicalRef;
  pendingInputHash: string;
  ownerCategories: typeof INTERNAL_PRODUCTION_OWNER_CATEGORY_REGISTRY_V1;
  ownerCategoryRegistryHash: string;
  ownerCategoryCensusMapHash: string;
  targetFamily: InternalProductionGlobalOwnerAdmissionFenceTargetFamilyV1;
  observedUnrelatedReservationCount: 0;
  observedUnrelatedOwnerCount: 0;
  ownerIdentitySetHash: string;
  predecessorFenceHeadHash: string | null;
  ownerAdmissionHeadHash: string;
  fenceRef: CanonicalRef;
  fenceHash: string;
}>;

export type InternalProductionNullTargetGlobalOwnerAdmissionFenceInputV1 =
  | Readonly<{
      purpose: "golden-launch-operation-migration-release-v1";
      pendingInputRef: CanonicalRef;
      pendingInputHash: string;
      targetFamily: null;
    }>
  | Readonly<{
      purpose: "recovery-d-physical-service-restart-authority-cutover-v1";
      pendingInputRef: CanonicalRef;
      pendingInputHash: string;
      targetFamily: null;
    }>;

export function acquireInternalProductionGlobalOwnerAdmissionFenceV1(
  input: InternalProductionNullTargetGlobalOwnerAdmissionFenceInputV1,
): Promise<InternalProductionGlobalOwnerAdmissionFenceV1 & {
  targetFamily: Extract<
    InternalProductionGlobalOwnerAdmissionFenceTargetFamilyV1,
    { kind: "none" }
  >;
}>;

export function acquireInternalProductionSourceRunLaunchOwnerAdmissionFenceV1(
  input: Readonly<{
    purpose: "recovery-d-source-delivery-v1";
    pendingInputRef: CanonicalRef;
    pendingInputHash: string;
    sourceRunOwnerKeyHash: string;
    runOwnerKeyHash: string;
    targetRunLaunchCompositeHash: string;
  }>,
): Promise<Readonly<{
  fence: InternalProductionGlobalOwnerAdmissionFenceV1 & {
    targetFamily: Extract<
      InternalProductionGlobalOwnerAdmissionFenceTargetFamilyV1,
      { kind: "source-run-launch" }
    >;
  };
  sourceRunReservation: InternalProductionOwnerReservationV1;
  runReservation: InternalProductionOwnerReservationV1;
}>>;

export type InternalProductionRecoveryRestartOwnerAdmissionFenceInputV1 = {
  [Namespace in InternalProductionRecoveryRestartNamespaceV1]: Readonly<{
    purpose: "recovery-d-physical-service-restart-operation-v1";
    authorizationOperationRef: CanonicalRef;
    authorizationOperationHash: string;
    namespace: Namespace;
    service: "setfarm-spawner" | "setfarm-dashboard" | "mission-control";
    coordinationHash: string;
    coordinatorTargetAuthority: Extract<
      InternalProductionRecoveryRestartCoordinatorTargetAuthorityV1,
      { kind: Namespace }
    >;
  }>;
}[InternalProductionRecoveryRestartNamespaceV1];

export function acquireInternalProductionRecoveryRestartOwnerAdmissionFenceV1<
  Namespace extends InternalProductionRecoveryRestartNamespaceV1,
>(
  input: Extract<
    InternalProductionRecoveryRestartOwnerAdmissionFenceInputV1,
    { namespace: Namespace }
  >,
): Promise<Readonly<{
  fence: InternalProductionGlobalOwnerAdmissionFenceV1 & {
    targetFamily: Extract<
      InternalProductionGlobalOwnerAdmissionFenceTargetFamilyV1,
      { kind: "recovery-restart"; namespace: Namespace }
    >;
  };
  restartReservation: InternalProductionOwnerReservationV1 & {
    category: "restart-reservation";
    producerImplementationId: "d-restart-reservation-v1";
  };
  serviceRestartOperationReservation: InternalProductionOwnerReservationV1 & {
    category: "service-restart-operation";
    producerImplementationId: "d-service-restart-operation-v1";
  };
  launchOutboxReservation: InternalProductionOwnerReservationV1 & {
    category: "launch-outbox";
    producerImplementationId: "d-service-restart-launch-outbox-v1";
  };
  helperProcessReservation: InternalProductionOwnerReservationV1 & {
    category: "process";
    producerImplementationId: "d-service-restart-helper-process-v1";
  };
  dispatchChildProcessReservation: InternalProductionOwnerReservationV1 & {
    category: "process";
    producerImplementationId: "d-service-restart-child-process-v1";
  };
  startupListenerReservation: InternalProductionOwnerReservationV1 & {
    category: "listener";
    producerImplementationId: "d-service-restart-startup-listener-v1";
  };
  replacementProcessReservation: InternalProductionOwnerReservationV1 & {
    category: "process";
    producerImplementationId: "d-service-restart-replacement-process-v1";
  };
}>>;

export function reobserveInternalProductionGlobalOwnerAdmissionFenceV1(input: Readonly<{
  fenceRef: CanonicalRef;
  fenceHash: string;
}>): Promise<InternalProductionGlobalOwnerAdmissionFenceV1>;
export type InternalProductionGlobalOwnerAdmissionFenceReleaseAuthorityV1 =
  | Readonly<{
      purpose: "recovery-d-physical-service-restart-operation-v1";
      targetFamilyKind: "recovery-restart";
      terminalCoreRef: CanonicalRef;
      terminalCoreHash: string;
      targetSetCloseRef: CanonicalRef;
      targetSetCloseHash: string;
      occurrenceRef: CanonicalRef;
      occurrenceHash: string;
      headRef: CanonicalRef;
      headHash: string;
      targetReservationPairCloseRef: null;
      targetReservationPairCloseHash: null;
      purposeTerminalKind: null;
      purposeTerminalRef: null;
      purposeTerminalHash: null;
    }>
  | Readonly<{
      purpose: "recovery-d-source-delivery-v1";
      targetFamilyKind: "source-run-launch";
      terminalCoreRef: null;
      terminalCoreHash: null;
      targetSetCloseRef: null;
      targetSetCloseHash: null;
      occurrenceRef: null;
      occurrenceHash: null;
      headRef: null;
      headHash: null;
      targetReservationPairCloseRef: CanonicalRef;
      targetReservationPairCloseHash: string;
      purposeTerminalKind: null;
      purposeTerminalRef: null;
      purposeTerminalHash: null;
    }>
  | Readonly<{
      purpose: "golden-launch-operation-migration-release-v1";
      targetFamilyKind: "none";
      terminalCoreRef: null;
      terminalCoreHash: null;
      targetSetCloseRef: null;
      targetSetCloseHash: null;
      occurrenceRef: null;
      occurrenceHash: null;
      headRef: null;
      headHash: null;
      targetReservationPairCloseRef: null;
      targetReservationPairCloseHash: null;
      purposeTerminalKind: "golden-launch-operation-migration-release-terminal";
      purposeTerminalRef: CanonicalRef;
      purposeTerminalHash: string;
    }>
  | Readonly<{
      purpose: "recovery-d-physical-service-restart-authority-cutover-v1";
      targetFamilyKind: "none";
      terminalCoreRef: null;
      terminalCoreHash: null;
      targetSetCloseRef: null;
      targetSetCloseHash: null;
      occurrenceRef: null;
      occurrenceHash: null;
      headRef: null;
      headHash: null;
      targetReservationPairCloseRef: null;
      targetReservationPairCloseHash: null;
      purposeTerminalKind: "recovery-d-physical-service-restart-authority-cutover-terminal";
      purposeTerminalRef: CanonicalRef;
      purposeTerminalHash: string;
    }>;

export type InternalProductionGlobalOwnerAdmissionFenceReleaseInputV1 = Readonly<{
  fenceRef: CanonicalRef;
  fenceHash: string;
  releaseAuthority: InternalProductionGlobalOwnerAdmissionFenceReleaseAuthorityV1;
}>;

export type InternalProductionGlobalOwnerAdmissionFenceReleaseV1 = Readonly<{
  schema: "setfarm.internal-production-global-owner-admission-fence-release.v1";
  fenceRef: CanonicalRef;
  fenceHash: string;
  releaseAuthority: InternalProductionGlobalOwnerAdmissionFenceReleaseAuthorityV1;
  ownerAdmissionHeadPredecessorHash: string;
  ownerAdmissionHeadSuccessorHash: string;
  releaseRef: CanonicalRef;
  releaseHash: string;
}>;
export function releaseInternalProductionGlobalOwnerAdmissionFenceV1(
  input: InternalProductionGlobalOwnerAdmissionFenceReleaseInputV1,
): Promise<InternalProductionGlobalOwnerAdmissionFenceReleaseV1>;
export function resolveInternalProductionGlobalOwnerAdmissionFenceReleaseV1(input: Readonly<{
  releaseRef: CanonicalRef;
  releaseHash: string;
}>): Promise<InternalProductionGlobalOwnerAdmissionFenceReleaseV1>;

export type InternalProductionRecoverySourceBootstrapPendingInputV1 = Readonly<{
  schema: "setfarm.internal-production-recovery-source-bootstrap-pending-input.v1";
  purpose: "recovery-d-source-delivery-v1";
  repository: "setfarm";
  workflow: "feature-dev";
  protocol: "v3";
  promptManifestHash: string;
  pendingInputRef: CanonicalRef;
  pendingInputHash: string;
}>;

export type InternalProductionRecoverySourceBootstrapOperationV1 = Readonly<{
  schema: "setfarm.internal-production-recovery-source-bootstrap-operation.v1";
  purpose: "recovery-d-source-delivery-v1";
  repository: "setfarm";
  workflow: "feature-dev";
  protocol: "v3";
  promptManifestHash: string;
  pendingInputRef: CanonicalRef;
  pendingInputHash: string;
  baseSourceSha: string;
  baseSourceTreeHash: string;
  buildHash: string;
  targetSourceRunReservationRef: CanonicalRef;
  targetSourceRunReservationHash: string;
  targetRunReservationRef: CanonicalRef;
  targetRunReservationHash: string;
  targetRunLaunchCompositeHash: string;
  ownerAdmissionFenceRef: CanonicalRef;
  ownerAdmissionFenceHash: string;
  startIntentRef: CanonicalRef;
  startIntentHash: string;
  startOutboxRef: CanonicalRef;
  startOutboxHash: string;
  operationRef: CanonicalRef;
  operationHash: string;
}>;

export type InternalProductionRecoverySourceBootstrapRunReceiptV1 = Readonly<{
  schema: "setfarm.internal-production-recovery-source-bootstrap-run-receipt.v1";
  purpose: "recovery-d-source-delivery-v1";
  pendingInputRef: CanonicalRef;
  pendingInputHash: string;
  operationRef: CanonicalRef;
  operationHash: string;
  targetSourceRunReservationRef: CanonicalRef;
  targetSourceRunReservationHash: string;
  targetRunReservationRef: CanonicalRef;
  targetRunReservationHash: string;
  targetRunLaunchCompositeHash: string;
  ownerAdmissionFenceRef: CanonicalRef;
  ownerAdmissionFenceHash: string;
  startIntentRef: CanonicalRef;
  startIntentHash: string;
  startOutboxRef: CanonicalRef;
  startOutboxHash: string;
  runId: string;
  operationRunBindingHash: string;
  reciprocalRunOperationBindingHash: string;
  terminalOwnerRef: CanonicalRef;
  terminalOwnerHash: string;
  terminalSourceRunRef: CanonicalRef;
  terminalSourceRunHash: string;
  terminalRunLaunchRef: CanonicalRef;
  terminalRunLaunchHash: string;
  targetReservationPairCloseRef: CanonicalRef;
  targetReservationPairCloseHash: string;
  fenceReleaseRef: CanonicalRef;
  fenceReleaseHash: string;
  sourceRunRef: CanonicalRef;
  sourceRunHash: string;
}>;

export type InternalProductionRecoverySourceRunTerminalAuthorityV1 = Readonly<{
  schema: "setfarm.internal-production-recovery-source-run-terminal-authority.v1";
  operationRef: CanonicalRef;
  operationHash: string;
  targetSourceRunReservationRef: CanonicalRef;
  targetSourceRunReservationHash: string;
  targetRunLaunchCompositeHash: string;
  runId: string;
  operationRunBindingHash: string;
  reciprocalRunOperationBindingHash: string;
  unrelatedReservationCount: 0;
  unrelatedOwnerCount: 0;
  terminalOwnerRef: CanonicalRef;
  terminalOwnerHash: string;
  terminalSourceRunRef: CanonicalRef;
  terminalSourceRunHash: string;
}>;
export function resolveInternalProductionRecoverySourceRunTerminalAuthorityV1(
  input: Readonly<{
    terminalSourceRunRef: CanonicalRef;
    terminalSourceRunHash: string;
  }>,
): Promise<InternalProductionRecoverySourceRunTerminalAuthorityV1>;
export type InternalProductionRecoveryRunLaunchTerminalAuthorityV1 = Readonly<{
  schema: "setfarm.internal-production-recovery-run-launch-terminal-authority.v1";
  operationRef: CanonicalRef;
  operationHash: string;
  targetRunReservationRef: CanonicalRef;
  targetRunReservationHash: string;
  targetRunLaunchCompositeHash: string;
  runId: string;
  operationRunBindingHash: string;
  reciprocalRunOperationBindingHash: string;
  runReservationTerminalOwnerRef: CanonicalRef;
  runReservationTerminalOwnerHash: string;
  terminalRunLaunchRef: CanonicalRef;
  terminalRunLaunchHash: string;
}>;
export function resolveInternalProductionRecoveryRunLaunchTerminalAuthorityV1(
  input: Readonly<{
    terminalRunLaunchRef: CanonicalRef;
    terminalRunLaunchHash: string;
  }>,
): Promise<InternalProductionRecoveryRunLaunchTerminalAuthorityV1>;
export type InternalProductionSourceRunLaunchTargetReservationPairCloseV1 = Readonly<{
  schema: "setfarm.internal-production-source-run-launch-target-reservation-pair-close.v1";
  fenceRef: CanonicalRef;
  fenceHash: string;
  targetRunLaunchCompositeHash: string;
  sourceRunReservationRef: CanonicalRef;
  sourceRunReservationHash: string;
  runReservationRef: CanonicalRef;
  runReservationHash: string;
  terminalSourceRunRef: CanonicalRef;
  terminalSourceRunHash: string;
  terminalRunLaunchRef: CanonicalRef;
  terminalRunLaunchHash: string;
  ownerAdmissionHeadPredecessorHash: string;
  ownerAdmissionHeadSuccessorHash: string;
  preservedFenceRef: CanonicalRef;
  preservedFenceHash: string;
  targetReservationPairCloseRef: CanonicalRef;
  targetReservationPairCloseHash: string;
}>;
export function closeInternalProductionSourceRunLaunchTargetReservationsUnderFenceV1(
  input: Readonly<{
    fenceRef: CanonicalRef;
    fenceHash: string;
    sourceRunReservationRef: CanonicalRef;
    sourceRunReservationHash: string;
    runReservationRef: CanonicalRef;
    runReservationHash: string;
    terminalSourceRunRef: CanonicalRef;
    terminalSourceRunHash: string;
    terminalRunLaunchRef: CanonicalRef;
    terminalRunLaunchHash: string;
  }>,
): Promise<InternalProductionSourceRunLaunchTargetReservationPairCloseV1>;
export function resolveInternalProductionSourceRunLaunchTargetReservationPairCloseV1(
  input: Readonly<{
    targetReservationPairCloseRef: CanonicalRef;
    targetReservationPairCloseHash: string;
  }>,
): Promise<InternalProductionSourceRunLaunchTargetReservationPairCloseV1>;

export type InternalProductionServiceRestartTerminalOwnerAuthoritiesV1 = Readonly<{
  restartReservationTerminalOwnerRef: CanonicalRef;
  restartReservationTerminalOwnerHash: string;
  serviceRestartOperationTerminalOwnerRef: CanonicalRef;
  serviceRestartOperationTerminalOwnerHash: string;
  launchOutboxTerminalOwnerRef: CanonicalRef;
  launchOutboxTerminalOwnerHash: string;
  helperProcessTerminalOwnerRef: CanonicalRef;
  helperProcessTerminalOwnerHash: string;
  dispatchChildProcessTerminalOwnerRef: CanonicalRef;
  dispatchChildProcessTerminalOwnerHash: string;
  startupListenerTerminalOwnerRef: CanonicalRef;
  startupListenerTerminalOwnerHash: string;
  replacementProcessTerminalOwnerRef: CanonicalRef;
  replacementProcessTerminalOwnerHash: string;
}>;

export type InternalProductionServiceRestartTerminalCoreDispositionV1 =
  | Readonly<{
      kind: "complete";
      completionKind: "executed" | "adopted";
      afterGenerationHash: string;
      failureCode: null;
      exactProcessAbsenceAuthorityHash: null;
    }>
  | Readonly<{
      kind: "failed";
      completionKind: null;
      afterGenerationHash: null;
      failureCode:
        | "SERVICE_RESTART_DISPATCH_OUTCOME_UNCERTAIN"
        | "SERVICE_RESTART_EXPECTED_PROCESS_DIED"
        | "SERVICE_RESTART_IDENTITY_AMBIGUOUS";
      exactProcessAbsenceAuthorityHash: string;
    }>;

export type InternalProductionServiceRestartTerminalCoreV1 = Readonly<{
  schema: "setfarm.internal-production-service-restart-terminal-core.v1";
  namespace: InternalProductionRecoveryRestartNamespaceV1;
  service: "setfarm-spawner" | "setfarm-dashboard" | "mission-control";
  coordinationHash: string;
  authorizationOperationRef: CanonicalRef;
  authorizationOperationHash: string;
  operationRef: CanonicalRef;
  operationHash: string;
  authorizationConsumptionRef: CanonicalRef;
  authorizationConsumptionHash: string;
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
  terminalOwnerAuthorities: InternalProductionServiceRestartTerminalOwnerAuthoritiesV1;
  disposition: InternalProductionServiceRestartTerminalCoreDispositionV1;
  targetFamilyAbiHash:
    typeof INTERNAL_PRODUCTION_RECOVERY_RESTART_TARGET_FAMILY_ABI_HASH_V1;
  targetFamilyHash: string;
  terminalCoreRef: CanonicalRef;
  terminalCoreHash: string;
}>;

export function resolveInternalProductionServiceRestartTerminalCoreV1(
  input: Readonly<{
    terminalCoreRef: CanonicalRef;
    terminalCoreHash: string;
  }>,
): Promise<InternalProductionServiceRestartTerminalCoreV1>;

export type InternalProductionRecoveryRestartTargetSetCloseV1 = Readonly<{
  schema: "setfarm.internal-production-recovery-restart-target-set-close.v1";
  fenceRef: CanonicalRef;
  fenceHash: string;
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
  terminalCoreRef: CanonicalRef;
  terminalCoreHash: string;
  targetFamilyAbiHash:
    typeof INTERNAL_PRODUCTION_RECOVERY_RESTART_TARGET_FAMILY_ABI_HASH_V1;
  targetFamilyHash: string;
  ownerAdmissionHeadPredecessorHash: string;
  ownerAdmissionHeadSuccessorHash: string;
  preservedFenceRef: CanonicalRef;
  preservedFenceHash: string;
  targetSetCloseRef: CanonicalRef;
  targetSetCloseHash: string;
}>;
export function closeInternalProductionRecoveryRestartTargetsUnderFenceV1(
  input: Readonly<{
    fenceRef: CanonicalRef;
    fenceHash: string;
    terminalCoreRef: CanonicalRef;
    terminalCoreHash: string;
  }>,
): Promise<InternalProductionRecoveryRestartTargetSetCloseV1>;
export function resolveInternalProductionRecoveryRestartTargetSetCloseV1(
  input: Readonly<{
    targetSetCloseRef: CanonicalRef;
    targetSetCloseHash: string;
  }>,
): Promise<InternalProductionRecoveryRestartTargetSetCloseV1>;

export function prepareInternalProductionRecoverySourceBootstrapRunV1():
  Promise<Readonly<{ operationRef: CanonicalRef; operationHash: string }>>;
export function resumeActiveInternalProductionRecoverySourceBootstrapRunV1():
  Promise<Readonly<{ sourceRunRef: CanonicalRef; sourceRunHash: string }>>;
export function resolveInternalProductionRecoverySourceBootstrapRunReceiptV1(input: Readonly<{
  sourceRunRef: CanonicalRef;
  sourceRunHash: string;
}>): Promise<InternalProductionRecoverySourceBootstrapRunReceiptV1>;
export type InternalProductionRecoverySourceBootstrapStatusV1 =
  | Readonly<{
      state: "absent";
      pendingInputRef: null; pendingInputHash: null;
      targetSourceRunReservationRef: null; targetSourceRunReservationHash: null;
      targetRunReservationRef: null; targetRunReservationHash: null; targetRunLaunchCompositeHash: null;
      ownerAdmissionFenceRef: null; ownerAdmissionFenceHash: null;
      startIntentRef: null; startIntentHash: null; startOutboxRef: null; startOutboxHash: null;
      operationRef: null; operationHash: null; runId: null;
      operationRunBindingHash: null; reciprocalRunOperationBindingHash: null;
      terminalOwnerRef: null; terminalOwnerHash: null;
      terminalSourceRunRef: null; terminalSourceRunHash: null;
      terminalRunLaunchRef: null; terminalRunLaunchHash: null;
      targetReservationPairCloseRef: null; targetReservationPairCloseHash: null;
      fenceReleaseRef: null; fenceReleaseHash: null;
      sourceRunRef: null; sourceRunHash: null;
      visibilityHeadRef: null; visibilityHeadHash: null; statusHash: string;
    }>
  | Readonly<{
      state: "pending-input";
      pendingInputRef: CanonicalRef; pendingInputHash: string;
      targetSourceRunReservationRef: null; targetSourceRunReservationHash: null;
      targetRunReservationRef: null; targetRunReservationHash: null; targetRunLaunchCompositeHash: null;
      ownerAdmissionFenceRef: null; ownerAdmissionFenceHash: null;
      startIntentRef: null; startIntentHash: null; startOutboxRef: null; startOutboxHash: null;
      operationRef: null; operationHash: null; runId: null;
      operationRunBindingHash: null; reciprocalRunOperationBindingHash: null;
      terminalOwnerRef: null; terminalOwnerHash: null;
      terminalSourceRunRef: null; terminalSourceRunHash: null;
      terminalRunLaunchRef: null; terminalRunLaunchHash: null;
      targetReservationPairCloseRef: null; targetReservationPairCloseHash: null;
      fenceReleaseRef: null; fenceReleaseHash: null;
      sourceRunRef: null; sourceRunHash: null;
      visibilityHeadRef: CanonicalRef; visibilityHeadHash: string; statusHash: string;
    }>
  | Readonly<{
      state: "prepared";
      pendingInputRef: CanonicalRef; pendingInputHash: string;
      targetSourceRunReservationRef: CanonicalRef; targetSourceRunReservationHash: string;
      targetRunReservationRef: CanonicalRef; targetRunReservationHash: string; targetRunLaunchCompositeHash: string;
      ownerAdmissionFenceRef: CanonicalRef; ownerAdmissionFenceHash: string;
      startIntentRef: CanonicalRef; startIntentHash: string; startOutboxRef: CanonicalRef; startOutboxHash: string;
      operationRef: CanonicalRef; operationHash: string; runId: null;
      operationRunBindingHash: null; reciprocalRunOperationBindingHash: null;
      terminalOwnerRef: null; terminalOwnerHash: null;
      terminalSourceRunRef: null; terminalSourceRunHash: null;
      terminalRunLaunchRef: null; terminalRunLaunchHash: null;
      targetReservationPairCloseRef: null; targetReservationPairCloseHash: null;
      fenceReleaseRef: null; fenceReleaseHash: null;
      sourceRunRef: null; sourceRunHash: null;
      visibilityHeadRef: CanonicalRef; visibilityHeadHash: string; statusHash: string;
    }>
  | Readonly<{
      state: "recovery-required";
      refusalCode: "RECOVERY_SOURCE_BOOTSTRAP_PREFIX_AMBIGUOUS";
      lastVisibleState: "pending-input" | "prepared";
      pendingInputRef: CanonicalRef; pendingInputHash: string;
      targetSourceRunReservationRef: null; targetSourceRunReservationHash: null;
      targetRunReservationRef: null; targetRunReservationHash: null; targetRunLaunchCompositeHash: null;
      ownerAdmissionFenceRef: null; ownerAdmissionFenceHash: null;
      startIntentRef: null; startIntentHash: null; startOutboxRef: null; startOutboxHash: null;
      operationRef: null; operationHash: null; runId: null;
      operationRunBindingHash: null; reciprocalRunOperationBindingHash: null;
      terminalOwnerRef: null; terminalOwnerHash: null;
      terminalSourceRunRef: null; terminalSourceRunHash: null;
      terminalRunLaunchRef: null; terminalRunLaunchHash: null;
      targetReservationPairCloseRef: null; targetReservationPairCloseHash: null;
      fenceReleaseRef: null; fenceReleaseHash: null;
      sourceRunRef: null; sourceRunHash: null;
      visibilityHeadRef: CanonicalRef; visibilityHeadHash: string; statusHash: string;
    }>
  | Readonly<{
      state: "terminal";
      pendingInputRef: CanonicalRef; pendingInputHash: string;
      targetSourceRunReservationRef: CanonicalRef; targetSourceRunReservationHash: string;
      targetRunReservationRef: CanonicalRef; targetRunReservationHash: string; targetRunLaunchCompositeHash: string;
      ownerAdmissionFenceRef: CanonicalRef; ownerAdmissionFenceHash: string;
      startIntentRef: CanonicalRef; startIntentHash: string; startOutboxRef: CanonicalRef; startOutboxHash: string;
      operationRef: CanonicalRef; operationHash: string; runId: string;
      operationRunBindingHash: string; reciprocalRunOperationBindingHash: string;
      terminalOwnerRef: CanonicalRef; terminalOwnerHash: string;
      terminalSourceRunRef: CanonicalRef; terminalSourceRunHash: string;
      terminalRunLaunchRef: CanonicalRef; terminalRunLaunchHash: string;
      targetReservationPairCloseRef: CanonicalRef; targetReservationPairCloseHash: string;
      fenceReleaseRef: CanonicalRef; fenceReleaseHash: string;
      sourceRunRef: CanonicalRef; sourceRunHash: string;
      visibilityHeadRef: CanonicalRef; visibilityHeadHash: string; statusHash: string;
    }>;
export function observeInternalProductionRecoverySourceBootstrapStatusV1():
  Promise<InternalProductionRecoverySourceBootstrapStatusV1>;

export type InternalProductionPhysicalServiceRestartAuthorityCutoverPendingInputV1 = Readonly<{
  schema: "setfarm.internal-production-physical-service-restart-authority-cutover-pending-input.v1";
  purpose: "recovery-d-physical-service-restart-authority-cutover-v1";
  zeroOwnerGuardRef: CanonicalRef;
  zeroOwnerGuardHash: string;
  ownerAdmissionFenceRef: null;
  ownerAdmissionFenceHash: null;
  pendingInputRef: CanonicalRef;
  pendingInputHash: string;
}>;

export type InternalProductionPhysicalServiceRestartAuthorityCutoverOperationV1 = Readonly<{
  schema: "setfarm.internal-production-physical-service-restart-authority-cutover-operation.v1";
  pendingInputRef: CanonicalRef;
  pendingInputHash: string;
  ownerAdmissionFenceRef: CanonicalRef;
  ownerAdmissionFenceHash: string;
  predecessorPhysicalRestartEpochRef: CanonicalRef;
  predecessorPhysicalRestartEpochHash: string;
  predecessorPhysicalRestartEpochOrdinal: 1;
  zeroOwnerGuardRef: CanonicalRef;
  zeroOwnerGuardHash: string;
  codeOwnedHookObservationHash: string;
  startupHooksReadyRef: CanonicalRef;
  startupHooksReadyHash: string;
  baselineRetirementRef: CanonicalRef;
  baselineRetirementHash: string;
  activationRef: CanonicalRef;
  activationHash: string;
  successorPhysicalRestartEpochRef: CanonicalRef;
  successorPhysicalRestartEpochHash: string;
  cutoverRef: CanonicalRef;
  cutoverHash: string;
  operationRef: CanonicalRef;
  operationHash: string;
}>;

export type InternalProductionServiceRestartStartupHooksReadyV1 = Readonly<{
  schema: "setfarm.internal-production-service-restart-startup-hooks-ready.v1";
  setfarmSourceSha: string;
  missionControlSourceSha: string;
  setfarmBuildHash: string;
  missionControlBuildHash: string;
  migrationReceiptRef: CanonicalRef;
  migrationReceiptHash: string;
  migrationSourceSha: string;
  migrationImplementationBlobHash: string;
  orderedStatementsHash: string;
  namedMigrationDigestEntryHash: string;
  migrationDigest: string;
  schemaProjectionHash: string;
  physicalRestartEpochRef: CanonicalRef;
  physicalRestartEpochHash: string;
  physicalRestartEpochOrdinal: 1;
  physicalRestartAuthorityOwner: "baseline-a";
  spawnerHookImplementationId: "recovery-d-setfarm-spawner-startup-v1";
  spawnerHookImplementationHash: string;
  dashboardHookImplementationId: "recovery-d-setfarm-dashboard-startup-v1";
  dashboardHookImplementationHash: string;
  missionControlHookImplementationId: "recovery-d-mission-control-startup-v1";
  missionControlHookImplementationHash: string;
  runtimeSourceProjectionHash: string;
  recoveryPrepareState: "disabled-by-baseline-epoch-one";
  startupHooksReadyRef: CanonicalRef;
  startupHooksReadyHash: string;
}>;

export type InternalProductionServiceRestartAuthorityActivationV1 = Readonly<{
  schema: "setfarm.internal-production-service-restart-authority-activation.v1";
  startupHooksReadyRef: CanonicalRef;
  startupHooksReadyHash: string;
  predecessorPhysicalRestartEpochRef: CanonicalRef;
  predecessorPhysicalRestartEpochHash: string;
  predecessorPhysicalRestartEpochOrdinal: 1;
  predecessorPhysicalRestartAuthorityOwner: "baseline-a";
  successorPhysicalRestartEpochOrdinal: 2;
  successorPhysicalRestartAuthorityOwner: "recovery-d";
  services: readonly ["setfarm-spawner", "setfarm-dashboard", "mission-control"];
  activationRef: CanonicalRef;
  activationHash: string;
}>;

export type InternalProductionServiceRestartAuthorityCutoverV1 = Readonly<{
  schema: "setfarm.internal-production-service-restart-authority-cutover.v1";
  startupHooksReadyRef: CanonicalRef;
  startupHooksReadyHash: string;
  zeroOwnerGuardRef: CanonicalRef;
  zeroOwnerGuardHash: string;
  ownerAdmissionFenceRef: CanonicalRef;
  ownerAdmissionFenceHash: string;
  predecessorPhysicalRestartEpochRef: CanonicalRef;
  predecessorPhysicalRestartEpochHash: string;
  predecessorPhysicalRestartEpochOrdinal: 1;
  baselineRetirementRef: CanonicalRef;
  baselineRetirementHash: string;
  activationRef: CanonicalRef;
  activationHash: string;
  successorPhysicalRestartEpochRef: CanonicalRef;
  successorPhysicalRestartEpochHash: string;
  successorPhysicalRestartEpochOrdinal: 2;
  cutoverRef: CanonicalRef;
  cutoverHash: string;
}>;

export function prepareInternalProductionPhysicalServiceRestartAuthorityCutoverToRecoveryDV1(
  input: Readonly<{
    zeroOwnerGuardRef: CanonicalRef;
    zeroOwnerGuardHash: string;
  }>,
): Promise<Readonly<{ operationRef: CanonicalRef; operationHash: string }>>;

export function resumeActiveInternalProductionPhysicalServiceRestartAuthorityCutoverToRecoveryDV1(
): Promise<Readonly<{
  operationRef: CanonicalRef;
  operationHash: string;
  startupHooksReadyRef: CanonicalRef;
  startupHooksReadyHash: string;
  retirementRef: CanonicalRef;
  retirementHash: string;
  activationRef: CanonicalRef;
  activationHash: string;
  successorEpochRef: CanonicalRef;
  successorEpochHash: string;
  cutoverRef: CanonicalRef;
  cutoverHash: string;
}>>;

export type InternalProductionPhysicalServiceRestartAuthorityCutoverStatusV1 =
  | Readonly<{
      schema: "setfarm.internal-production-physical-service-restart-authority-cutover-status.v1";
      state: "baseline-a-active";
      pendingInputRef: null;
      pendingInputHash: null;
      ownerAdmissionFenceRef: null;
      ownerAdmissionFenceHash: null;
      ownerAdmissionFenceReleaseRef: null;
      ownerAdmissionFenceReleaseHash: null;
      operationRef: null;
      operationHash: null;
      guardConsumed: false;
      physicalRestartEpochOrdinal: 1;
      physicalRestartAuthorityOwner: "baseline-a";
      startupHooksReadyRef: null;
      startupHooksReadyHash: null;
      baselineRetirementRef: null;
      baselineRetirementHash: null;
      activationRef: null;
      activationHash: null;
      cutoverRef: null;
      cutoverHash: null;
      statusHash: string;
    }>
  | Readonly<{
      schema: "setfarm.internal-production-physical-service-restart-authority-cutover-status.v1";
      state: "pending-input";
      pendingInputRef: CanonicalRef;
      pendingInputHash: string;
      ownerAdmissionFenceRef: CanonicalRef | null;
      ownerAdmissionFenceHash: string | null;
      ownerAdmissionFenceReleaseRef: null;
      ownerAdmissionFenceReleaseHash: null;
      operationRef: null;
      operationHash: null;
      guardConsumed: false;
      physicalRestartEpochOrdinal: 1;
      physicalRestartAuthorityOwner: "baseline-a";
      startupHooksReadyRef: null;
      startupHooksReadyHash: null;
      baselineRetirementRef: null;
      baselineRetirementHash: null;
      activationRef: null;
      activationHash: null;
      cutoverRef: null;
      cutoverHash: null;
      statusHash: string;
    }>
  | Readonly<{
      schema: "setfarm.internal-production-physical-service-restart-authority-cutover-status.v1";
      state: "prepared";
      pendingInputRef: CanonicalRef;
      pendingInputHash: string;
      ownerAdmissionFenceRef: CanonicalRef;
      ownerAdmissionFenceHash: string;
      ownerAdmissionFenceReleaseRef: null;
      ownerAdmissionFenceReleaseHash: null;
      operationRef: CanonicalRef;
      operationHash: string;
      guardConsumed: false;
      physicalRestartEpochOrdinal: 1;
      physicalRestartAuthorityOwner: "baseline-a";
      startupHooksReadyRef: null;
      startupHooksReadyHash: null;
      baselineRetirementRef: null;
      baselineRetirementHash: null;
      activationRef: null;
      activationHash: null;
      cutoverRef: null;
      cutoverHash: null;
      statusHash: string;
    }>
  | Readonly<{
      schema: "setfarm.internal-production-physical-service-restart-authority-cutover-status.v1";
      state: "resuming";
      pendingInputRef: CanonicalRef;
      pendingInputHash: string;
      ownerAdmissionFenceRef: CanonicalRef;
      ownerAdmissionFenceHash: string;
      ownerAdmissionFenceReleaseRef: null;
      ownerAdmissionFenceReleaseHash: null;
      operationRef: CanonicalRef;
      operationHash: string;
      guardConsumed: true;
      physicalRestartEpochOrdinal: 1;
      physicalRestartAuthorityOwner: "baseline-a";
      startupHooksReadyRef: null;
      startupHooksReadyHash: null;
      baselineRetirementRef: null;
      baselineRetirementHash: null;
      activationRef: null;
      activationHash: null;
      cutoverRef: null;
      cutoverHash: null;
      statusHash: string;
    }>
  | Readonly<{
      schema: "setfarm.internal-production-physical-service-restart-authority-cutover-status.v1";
      state: "recovery-d-active";
      pendingInputRef: CanonicalRef;
      pendingInputHash: string;
      ownerAdmissionFenceRef: CanonicalRef;
      ownerAdmissionFenceHash: string;
      ownerAdmissionFenceReleaseRef: CanonicalRef;
      ownerAdmissionFenceReleaseHash: string;
      operationRef: CanonicalRef;
      operationHash: string;
      guardConsumed: true;
      physicalRestartEpochOrdinal: 2;
      physicalRestartAuthorityOwner: "recovery-d";
      startupHooksReadyRef: CanonicalRef;
      startupHooksReadyHash: string;
      baselineRetirementRef: CanonicalRef;
      baselineRetirementHash: string;
      activationRef: CanonicalRef;
      activationHash: string;
      cutoverRef: CanonicalRef;
      cutoverHash: string;
      statusHash: string;
    }>;

export function observeInternalProductionPhysicalServiceRestartAuthorityCutoverStatusV1(
): Promise<InternalProductionPhysicalServiceRestartAuthorityCutoverStatusV1>;

export function resolveInternalProductionPhysicalServiceRestartAuthorityCutoverOperationV1(
  input: Readonly<{ operationRef: CanonicalRef; operationHash: string }>,
): Promise<InternalProductionPhysicalServiceRestartAuthorityCutoverOperationV1>;

export function resolveInternalProductionServiceRestartAuthorityCutoverV1(
  input: Readonly<{ cutoverRef: CanonicalRef; cutoverHash: string }>,
): Promise<InternalProductionServiceRestartAuthorityCutoverV1>;

export function resolveInternalProductionServiceRestartStartupHooksReadyV1(
  input: Readonly<{
    startupHooksReadyRef: CanonicalRef;
    startupHooksReadyHash: string;
  }>,
): Promise<InternalProductionServiceRestartStartupHooksReadyV1>;

export function resolveInternalProductionServiceRestartAuthorityActivationV1(
  input: Readonly<{ activationRef: CanonicalRef; activationHash: string }>,
): Promise<InternalProductionServiceRestartAuthorityActivationV1>;

export function resolveInternalProductionBaselineRestartAuthorityRetirementV1(
  input: Readonly<{ retirementRef: CanonicalRef; retirementHash: string }>,
): Promise<InternalProductionBaselineRestartAuthorityRetirementV1>;

type InternalProductionBaselineServiceRestartAuthorityCommonV1 = Readonly<{
  schema: "setfarm.internal-production-baseline-service-restart-authority.v1";
  service: "setfarm-spawner" | "setfarm-dashboard" | "mission-control";
  actionId: "a-restart-service-setfarm-spawner-v1" |
    "a-restart-service-setfarm-dashboard-v1" |
    "a-restart-service-mission-control-v1";
  operationId: string;
  migrationReceiptRef: CanonicalRef;
  migrationReceiptHash: string;
  migrationSchemaProjectionHash: string;
  before: InternalProductionBaselineRuntimeSourceProjectionV1;
  after: InternalProductionBaselineRuntimeSourceProjectionV1;
  postRuntimeSourceProjectionHash: string;
  restart: Readonly<{
    disposition: "performed" | "adopted";
    reservationHash: string;
    operationHash: string;
    outboxHash: string;
    helperClaimHash: string;
    helperProcessIdentityHash: string;
    startupMarkerHash: string;
    completionSettlementHash: string;
    beforeGenerationHash: string;
    afterGenerationHash: string;
    beforeServiceAuthorityHash: string;
    afterServiceAuthorityHash: string;
    dispatchReceiptHash: string;
  }>;
  receiptRef: `setfarm://internal-production/baseline/service-restarts/${string}`;
  receiptHash: string;
}>;

export type InternalProductionBaselineServiceRestartAuthorityV1 =
  | Readonly<InternalProductionBaselineServiceRestartAuthorityCommonV1 & {
      guardKind: "complete-zero-owner";
      zeroOwnerGuardRef: string;
      zeroOwnerGuardHash: string;
      cleanup: Readonly<{
        guardConsumed: true;
        restartSettled: true;
        observedGlobalZero: true;
        completeZeroOwnerCensusHash: string;
      }>;
    }>
  | Readonly<InternalProductionBaselineServiceRestartAuthorityCommonV1 & {
      guardKind: "fenced-completion-owner-bootstrap";
      targetGuardReceiptRef: string;
      targetGuardReceiptHash: string;
      requestIdHash: string;
      claimIdHash: string;
      runIdentityHash: string;
      ownerGenerationHash: string;
      ownerDrainedHash: string;
      ownerFencedHash: string;
      cleanup: Readonly<{
        targetGuardConsumed: true;
        restartSettled: true;
        observedUnrelatedZero: true;
        unrelatedOwnerCensusHash: string;
        retainedTargetOwnerHash: string;
      }>;
    }>;

export declare const InternalProductionBaselineServiceRestartAuthorityV1Schema:
  z.ZodType<InternalProductionBaselineServiceRestartAuthorityV1>;

export function resolveInternalProductionBaselineServiceRestartAuthorityV1(
  input: Readonly<{ receiptRef: string; receiptHash: string }>,
): Promise<InternalProductionBaselineServiceRestartAuthorityV1>;

export type InternalProductionBaselineSpawnerStartupAdmissionV1 = Readonly<{
  kind: "authenticated-internal-production-baseline-spawner-startup-admission";
  service: "setfarm-spawner";
  actionId: "a-restart-service-setfarm-spawner-v1";
  operationId: string;
  bootstrapOperationRef: string | null;
  bootstrapOperationHash: string | null;
  restartStartupMarkerHash: string;
  expectedRuntimeSourceProjectionHash: string;
  expectedSetfarmSha: string;
  expectedSpawnerBuildHash: string;
  beforeGenerationHash: string;
  admissionHash: string;
}>;

export function resolveActiveInternalProductionBaselineSpawnerStartupAdmissionV1(
): Promise<InternalProductionBaselineSpawnerStartupAdmissionV1 | null>;

export function claimInternalProductionBaselineSpawnerStartupAdmissionV1(
  input: Readonly<{ admission: InternalProductionBaselineSpawnerStartupAdmissionV1 }>,
): Promise<Readonly<{
  operationId: string;
  currentGenerationHash: string;
  startupClaimHash: string;
}>>;

export function awaitInternalProductionBaselineSpawnerRestartAuthorityV1(
  input: Readonly<{
    admission: InternalProductionBaselineSpawnerStartupAdmissionV1;
    startupClaimHash: string;
  }>,
): Promise<Readonly<{ receiptRef: string; receiptHash: string }>>;

export type InternalProductionBaselineCompletionOwnerBootstrapTargetGuardV1 =
  Readonly<{
    kind: "authenticated-completion-owner-bootstrap-target";
    requestIdHash: string;
    claimIdHash: string;
    runIdentityHash: string;
    ownerGenerationHash: string;
    ownerFenced: true;
    ownerDrained: true;
    unrelatedOwnerCount: 0;
    unrelatedOwnerCensusHash: string;
    targetGuardReceiptRef: string;
    targetGuardReceiptHash: string;
    targetGuardHash: string;
  }>;

export type InternalProductionBaselineCompletionOwnerBootstrapCleanBuildVerificationV1 =
  Readonly<{
    kind: "authenticated-baseline-completion-owner-bootstrap-clean-build-verification";
    bootstrapMergeSha: string;
    bootstrapTreeHash: string;
    p0FileSetHash: string;
    buildInfoHash: string;
    focusedVerificationHash: string;
    baselineHistoricalReceiptRef: CanonicalRef;
    baselineHistoricalReceiptHash: string;
    bootstrapHandoffMigrationReceiptRef: CanonicalRef;
    bootstrapHandoffMigrationReceiptHash: string;
    requestIdHash: string;
    claimIdHash: string;
    runIdentityHash: string;
    ownerGenerationHash: string;
    verificationHash: string;
    capability: unknown;
  }>;

export function createInternalProductionBaselineCompletionOwnerBootstrapCleanBuildVerificationV1(
): Promise<InternalProductionBaselineCompletionOwnerBootstrapCleanBuildVerificationV1>;

export function continueInternalProductionBaselineCompletionOwnerBootstrapAfterCleanBuildV1(
  input: Readonly<{
    verification: InternalProductionBaselineCompletionOwnerBootstrapCleanBuildVerificationV1;
  }>,
): Promise<void>;

export type InternalProductionBaselineSpawnerBootstrapRestartSequenceReceiptV1 =
  Readonly<{
    schema: "setfarm.internal-production-baseline-spawner-bootstrap-restart-sequence.v1";
    kind: "completion-owner-bootstrap";
    targetGuardReceiptRef: string;
    targetGuardReceiptHash: string;
    targetGuardHash: string;
    operationId: string;
    operationRef: string;
    operationHash: string;
    targetRequestOperationBindingHash: string;
    continuationGrantRef: string;
    continuationGrantHash: string;
    startupAdmissionRef: string;
    startupAdmissionHash: string;
    restartAuthorityRef: string;
    restartAuthorityHash: string;
    recoveredOwnerGenerationHash: string;
    targetOwnerReleaseReceiptHash: string;
    terminalCompleteZeroOwnerCensusHash: string;
    sequenceRef: string;
    sequenceHash: string;
  }>;

export type InternalProductionBaselineSpawnerBootstrapRestartOperationV1 =
  Readonly<{
    schema: "setfarm.internal-production-baseline-spawner-bootstrap-restart-operation.v1";
    kind: "completion-owner-bootstrap";
    targetGuardReceiptRef: string;
    targetGuardReceiptHash: string;
    targetGuardHash: string;
    operationId: string;
    outboxHash: string;
    continuationGrantRef: string;
    continuationGrantHash: string;
    state: "prepared";
    operationRef: string;
    operationHash: string;
  }>;

export type InternalProductionBaselineSpawnerBootstrapContinuationGrantV1 =
  Readonly<{
    schema: "setfarm.internal-production-baseline-spawner-bootstrap-continuation-grant.v1";
    continuationKind: "setfarm-bootstrap-main-claim-allocation-v1";
    targetGuardReceiptRef: string;
    targetGuardReceiptHash: string;
    operationId: string;
    bootstrapSetfarmSha: string;
    bootstrapTreeHash: string;
    disposition: "authorized-no-claim";
    allocatedClaimId: null;
    allocatedWorktreeIdentityHash: null;
    continuationGrantRef: string;
    continuationGrantHash: string;
  }>;

export function prepareInternalProductionBaselineSpawnerBootstrapRestartV1(
  input: Readonly<{
    targetGuard: InternalProductionBaselineCompletionOwnerBootstrapTargetGuardV1;
    postSettlementContinuationKind:
      "setfarm-bootstrap-main-claim-allocation-v1";
  }>,
): Promise<Readonly<{ operationRef: string; operationHash: string }>>;

export function executeOrRecoverInternalProductionBaselineSpawnerBootstrapRestartV1(
  input: Readonly<{ operationRef: string; operationHash: string }>,
): Promise<Readonly<{ operationRef: string; operationHash: string }>>;

export function resolveInternalProductionBaselineSpawnerBootstrapRestartOperationV1(
  input: Readonly<{ operationRef: string; operationHash: string }>,
): Promise<InternalProductionBaselineSpawnerBootstrapRestartOperationV1>;

export function resolveInternalProductionBaselineSpawnerBootstrapContinuationGrantV1(
  input: Readonly<{
    continuationGrantRef: string;
    continuationGrantHash: string;
  }>,
): Promise<InternalProductionBaselineSpawnerBootstrapContinuationGrantV1>;

export function finalizeInternalProductionBaselineSpawnerBootstrapRestartSequenceV1(
  input: Readonly<{ operationRef: string; operationHash: string }>,
): Promise<Readonly<{ sequenceRef: string; sequenceHash: string }>>;

export function resolveInternalProductionBaselineSpawnerBootstrapRestartSequenceV1(
  input: Readonly<{ sequenceRef: string; sequenceHash: string }>,
): Promise<InternalProductionBaselineSpawnerBootstrapRestartSequenceReceiptV1>;

export type InternalProductionBaselineRestartSequenceIntentKindV1 =
  | "live-rebind"
  | "d-startup-hook-load"
  | "documentation-rollback";

export type InternalProductionBaselineServiceRestartAuthorityPairV1 = Readonly<{
  service: "setfarm-spawner" | "setfarm-dashboard" | "mission-control";
  actionId: "a-restart-service-setfarm-spawner-v1" |
    "a-restart-service-setfarm-dashboard-v1" |
    "a-restart-service-mission-control-v1";
  authorityRef: string;
  authorityHash: string;
}>;

export type InternalProductionBaselineRestartSequenceReceiptV1 = Readonly<{
  schema: "setfarm.internal-production-baseline-restart-sequence-receipt.v1";
  intentKind: InternalProductionBaselineRestartSequenceIntentKindV1;
  sequenceIntentHash: string;
  migrationReceiptRef: CanonicalRef;
  migrationReceiptHash: string;
  migrationSchemaProjectionHash: string;
  initialRuntimeSourceProjectionHash: string;
  orderedServices: readonly [
    "setfarm-spawner",
    "setfarm-dashboard",
    "mission-control"
  ];
  authorityPairs: readonly [
    InternalProductionBaselineServiceRestartAuthorityPairV1,
    InternalProductionBaselineServiceRestartAuthorityPairV1,
    InternalProductionBaselineServiceRestartAuthorityPairV1
  ];
  orderedAdvanceHashes: readonly [string, string, string];
  finalRuntimeSourceProjectionHash: string;
  finalCompleteZeroOwnerCensusHash: string;
  sequenceRef: `setfarm://internal-production/baseline/restart-sequences/${string}`;
  sequenceHash: string;
}>;

export type InternalProductionBaselineRestartSequenceStatusV1 =
  | Readonly<{
      schema: "setfarm.internal-production-baseline-restart-sequence-status.v1";
      state: "absent";
      intentKind: InternalProductionBaselineRestartSequenceIntentKindV1;
      sequenceIntentHash: null;
      migrationReceiptRef: null;
      migrationReceiptHash: null;
      migrationSchemaProjectionHash: null;
      activeOrdinal: null;
      refusalCode: null;
      statusRef: string;
      statusHash: string;
      sequenceRef: null;
      sequenceHash: null;
    }>
  | Readonly<{
      schema: "setfarm.internal-production-baseline-restart-sequence-status.v1";
      state: "in_progress" | "blocked";
      intentKind: InternalProductionBaselineRestartSequenceIntentKindV1;
      sequenceIntentHash: string;
      migrationReceiptRef: CanonicalRef;
      migrationReceiptHash: string;
      migrationSchemaProjectionHash: string;
      activeOrdinal: 0 | 1 | 2;
      refusalCode: null;
      statusRef: string;
      statusHash: string;
      sequenceRef: null;
      sequenceHash: null;
    }>
  | Readonly<{
      schema: "setfarm.internal-production-baseline-restart-sequence-status.v1";
      state: "retired";
      intentKind: InternalProductionBaselineRestartSequenceIntentKindV1;
      sequenceIntentHash: null;
      migrationReceiptRef: CanonicalRef;
      migrationReceiptHash: string;
      migrationSchemaProjectionHash: string;
      activeOrdinal: null;
      refusalCode: "BASELINE_RESTART_AUTHORITY_RETIRED";
      retirementRef: CanonicalRef;
      retirementHash: string;
      statusRef: string;
      statusHash: string;
      sequenceRef: null;
      sequenceHash: null;
    }>
  | Readonly<{
      schema: "setfarm.internal-production-baseline-restart-sequence-status.v1";
      state: "completed";
      intentKind: InternalProductionBaselineRestartSequenceIntentKindV1;
      sequenceIntentHash: string;
      migrationReceiptRef: CanonicalRef;
      migrationReceiptHash: string;
      migrationSchemaProjectionHash: string;
      activeOrdinal: null;
      refusalCode: null;
      statusRef: string;
      statusHash: string;
      sequenceRef: string;
      sequenceHash: string;
    }>;

export function resumeInternalProductionBaselineRestartSequenceV1(
  input: Readonly<{ intentKind: InternalProductionBaselineRestartSequenceIntentKindV1 }>,
): Promise<Readonly<{ sequenceRef: string; sequenceHash: string }>>;

export function observeInternalProductionBaselineRestartSequenceStatusV1(
  input: Readonly<{ intentKind: InternalProductionBaselineRestartSequenceIntentKindV1 }>,
): Promise<InternalProductionBaselineRestartSequenceStatusV1>;

export function resolveInternalProductionBaselineRestartSequenceReceiptV1(
  input: Readonly<{ sequenceRef: string; sequenceHash: string }>,
): Promise<InternalProductionBaselineRestartSequenceReceiptV1>;
```

For a `setfarm-spawner` operation only, A publishes and reopens one strict startup-admission record plus a fixed unique pending locator after operation/outbox/helper-startup durability and before authorization consumption or dispatch. Its bootstrap branch contains the exact `bootstrapOperationRef`/`bootstrapOperationHash`; ordinary A-managed restarts require both fields `null`. The new spawner calls the zero-argument resolver, which opens only that locator—no scan, environment, plist, PID argument, path, or newest selection—and remints a WeakMap-authenticated capability carrying the exact operation pair. Claiming derives current PID/start-time/executable, loaded Setfarm SHA/build/module, and generation through code-owned observers and requires exact equality to the admission and active A operation before one startup claim is published. The waiter uses only that authenticated capability plus its exact claim and returns the same operation's composite pair; it never follows a caller locator or reconstructs from `operationId`. A structural clone, pair omission/substitution, stale/completed unrelated operation, second claimant, wrong service/source/build/generation, or D capability/namespace fails. With no active A operation the resolver returns `null`; before D is implemented, B remains completion-poll-disabled with typed `activation-required`. A retains completed admission history until the next predecessor-CAS A operation archives it, so a crashing bootstrap generation resumes the same handshake.

The exact existing `runtime-completion.ts` owner controller may mint `InternalProductionBaselineCompletionOwnerBootstrapTargetGuardV1` only while it holds the current authenticated P0 completion request/claim/run owner. It derives the request, claim, run, and owner-generation hashes internally, first drains and fences that owner against new effects, and observes zero unrelated owners; the target owner itself is the sole nonzero census member. The opaque guard is WeakMap-authenticated and cannot be serialized, cloned, minted by a worker, or used outside the one fixed bootstrap action. `prepareInternalProductionBaselineSpawnerBootstrapRestartV1({targetGuard,postSettlementContinuationKind:"setfarm-bootstrap-main-claim-allocation-v1"})` authenticates it and, in the already-delivered A source, publishes/reopens the intent, operation, outbox, and one-use `InternalProductionBaselineSpawnerBootstrapContinuationGrantV1` before returning `{operationRef,operationHash}` and before dispatch or process replacement. The grant binds target guard, operation, bootstrap Setfarm source/tree, literal continuation kind, `authorized-no-claim`, and null claim/worktree fields; A accepts no other continuation kind and creates no claim or writer. The current completion request durably binds the operation pair before calling `executeOrRecoverInternalProductionBaselineSpawnerBootstrapRestartV1({operationRef,operationHash})`. Execute/recover may dispatch and terminate the caller; a crash immediately after dispatch but before response is recovered only by reopening the same operation pair. The A startup admission and its hidden authenticated waiter carry that exact pair into the replacement process and never reconstruct it from `operationId`, scan a locator, or accept caller fields. The operation and continuation-grant resolvers reopen only their exact pairs. After the replacement spawner activates, targeted recovery releases the exact owner, and global zero is freshly observed, `finalizeInternalProductionBaselineSpawnerBootstrapRestartSequenceV1({operationRef,operationHash})` publishes and returns `{sequenceRef,sequenceHash}`; the pair-only resolver reopens it. None of these bootstrap mutations has a public CLI. This already-delivered A operation is the sole mutation the pre-P0 owner prepares and starts after P0 merge/build; it never imports or calls B.

The old-generation owner crosses the P0 build-to-restart boundary only through A's already delivered `createInternalProductionBaselineCompletionOwnerBootstrapCleanBuildVerificationV1()` and `continueInternalProductionBaselineCompletionOwnerBootstrapAfterCleanBuildV1({verification})`. The first may mint its opaque capability only after the owner receives the successful clean-main P0 build/test result and itself reopens the P0 merge/tree/file-set/build verification plus A historical/migration pairs; it binds the current request/claim/run/owner generation and accepts no caller path/SHA/hash/test result. The continuation authenticates the same live owner, mints the target guard, calls A prepare, atomically persists the exact operation pair and fixed status locator in that request, reopens them, then calls A execute/recover. It may terminate its caller and therefore no one relies on its return. Response loss or reentry adopts the same request-bound pair/locator; no pre-P0 process imports or calls a P0/B function.

The same A source claim pre-delivers the exact bootstrap-main-claim handoff database schema that B P0 later consumes. `src/db/bootstrap-main-claim-handoff-v1-migration.ts` is the sole immutable owner of its migration ID, ordered statements, and schema projector; `contract-spine-migrations.ts` and `contract-spine-migration-digests.generated.ts` are append-only registries, not whole-file authority. After the reviewed A and Mission Control sources have been merged and both clean-main builds pass, but before Task 7 prepares the first service restart, `applyInternalProductionBaselineBootstrapHandoffMigrationV1(...)` accepts only a freshly resolved complete-zero guard pair, one-use consumes that guard, requires the clean merged A build, runs the fixed contract-spine plan/apply/verify path, requires the exact named digest entry, and publishes/reopens one content-addressed `InternalProductionBaselineBootstrapHandoffMigrationReceiptV1`. Initial application requires exact `currentSetfarmSourceSha === migrationSourceSha`; the receipt binds only the dedicated implementation Git blob, canonical `orderedStatementsHash`, canonical named `(migrationId,migrationDigest)` entry hash, the digest, and verified schema projection. It never hashes or pins the complete mutable registry or generated aggregate. The command is a direct database operation in the just-built CLI and depends on no newly loaded spawner, dashboard, Mission Control process, listener, or post-restart runtime module. A fixed terminal locator for this one migration permits only the zero-input read-only `resolve-bootstrap-handoff-migration --json` command to recover its exact pair and invoke the pair-only resolver; it never selects a newest migration or accepts an ID/ref/hash/path/SQL/database override. The receipt proves the operation table, unique operation/claim identities, and terminal canonical-pair columns; it accepts no SQL, migration ID, digest, database URL, or schema projection from the caller. Every later consumer resolves the current clean literal-`main` Setfarm source itself, requires `migrationSourceSha` to be an ancestor of that current SHA through a fixed bounded Git ancestry observer, and freshly requires the dedicated implementation blob, ordered statements, named digest entry, digest, and schema projection to equal the receipt byte-for-byte. Unrelated append-only registry/digest entries are allowed and do not change A's authority; modifying/removing/reordering A's named entry or implementation/projection blocks. A descendant source is therefore valid only when A's dedicated migration identity remains unchanged; equality with `migrationSourceSha` is required only at initial application. Restart authorization separately requires its complete before/after runtime-source projections to equal the exact current source/build authority, so descendant acceptance never relaxes runtime-source equality. Every subsequent A restart authorization and restart-sequence intent first resolves that exact terminal pair, binds its ref/hash/schema projection into the authority/sequence hash, and fails before reservation, outbox, helper, guard consumption, or dispatch when it is absent, corrupt, unverified, non-ancestral, or implementation/statements/named-entry/digest/schema mismatched. The baseline post-handoff receipt copies the same migration pair and schema projection hash, and both current and historical resolvers freshly reopen the migration receipt and repeat those exact relations rather than trusting copied hashes. B P0 may be claimed only from that resolved historical authority and may restart the spawner only after re-resolving the same migration pair against its descendant clean source; B never applies or mutates schema.

A also predeclares the only B-purpose guard seam in `baseline-post-handoff-receipt-v1.ts`. `bindInternalProductionBaselineGoldenLaunchMigrationZeroOwnerGuardV1()` accepts a fresh generic A zero-owner pair only after B has durably published and reopened its fixed `pendingInputRef`/`pendingInputHash`, validates the exact purpose and canonical pending-input namespace, and publishes the immutable authorization pair without consuming the guard. `consumeInternalProductionBaselineGoldenLaunchMigrationZeroOwnerGuardV1()` accepts only that authorization plus the equality-bound B operation pair, reopens both A records, and one-use consumes the underlying guard inside A before publishing the consumption pair. B never imports, authenticates, or mutates A's generic guard store directly. The authorization/consumption resolvers are read-only, pair-only, and reject another purpose, pending input, operation, replay, structural clone, or raw guard substitution.

`baseline-restart-authority-retirement-v1.ts` owns one fixed global physical-restart transition lock and one immutable two-epoch head for the ordered services `setfarm-spawner`, `setfarm-dashboard`, and `mission-control`. It also predeclares and solely owns the strict `InternalProductionServiceRestartStartupHooksReadyV1`, `InternalProductionServiceRestartAuthorityActivationV1`, and `InternalProductionServiceRestartAuthorityCutoverV1` schemas, content-addressed stores, fixed locators, code-owned runtime-hook observer/recorder, and pair-only resolvers; A imports no D schema, store, capability, callback, or body. The observer uses a fixed three-hook implementation-ID registry plus current code-owned service/runtime/source/build observations and accepts no caller service, SHA, build, generation, hook hash, verdict, or D object. Epoch one is `authorityOwner:"baseline-a"` and requires readiness/activation/retirement fields null; epoch two is `authorityOwner:"recovery-d"` and requires all three exact pairs non-null. A pre-delivers the sole two-step cutover mutation boundary: `prepareInternalProductionPhysicalServiceRestartAuthorityCutoverToRecoveryDV1({zeroOwnerGuardRef,zeroOwnerGuardHash})` and zero-input `resumeActiveInternalProductionPhysicalServiceRestartAuthorityCutoverToRecoveryDV1()`. Exactly D's reviewed cutover adapter may import those two mutations unaliased; every other D import from the A module is a type or read-only resolver/status observer, and no CLI/worker/other production module may call them. The former single-call commit, standalone retirement export, and every D-owned readiness/activation/cutover writer do not exist. Under the one transition lock, resume follows the exact operation-first durability order below, then performs one expected-predecessor visibility CAS from epoch one to the complete A-owned readiness/retirement/activation/cutover/epoch-two tuple. Before the CAS, A epoch one remains authoritative and D remains disabled even though exact invisible candidates may exist; after it, readers must freshly resolve the epoch's complete tuple from A's stores. D publishes no parallel candidate or summary. Every A ordinary restart, bootstrap prepare, and new sequence acquires the same lock before it reads epoch one or publishes any authorization/operation; after epoch two it fails before mutation with typed `BASELINE_RESTART_AUTHORITY_RETIRED`. A operations durably in flight before cutover remain recoverable and therefore make cutover refuse until terminal; completed A history remains resolvable forever. A partial/mismatched operation or candidate is ambiguous and never enables either owner.

Prepare's first and sole durable creation is the complete fixed `cutover-pending-input.json` record. It contains `InternalProductionPhysicalServiceRestartAuthorityCutoverPendingInputV1` directly; its constant canonical ref is derived from that fixed namespace and `pendingInputHash` hashes the strict body with only the derived ref/hash omitted, so no content-addressed member, guard authorization, operation, locator, or candidate can be orphaned before discoverability. Publication uses an unpredictable same-directory temporary, file fsync, atomic no-replace, parent fsync, and `O_NOFOLLOW` reopen. There is no separate content-addressed pending-input object or pending-input locator. Only after reopening this record does prepare acquire A's durable global owner-admission fence for the exact cutover purpose. One canonical owner-admission head serializes fence acquire/release and every producer reservation begin/close. Its exhaustive registry is exactly `INTERNAL_PRODUCTION_OWNER_CATEGORY_REGISTRY_V1`: run, claim, execution attempt, runtime session, completion owner, mandatory effect, ordinary start, restart reservation/operation, launch preparation, prepared/staged work, fixture attempt, artifact reservation/publication, docs session/lease, fleet stage/inflight/review, matrix inflight, launch outbox, termination, finding, recovery, operational delivery, source run, cold rehearsal, compilation/execution lease, process, listener, worktree, dirty worktree, and stale child. Fence acquire treats every open reservation and published live owner as nonzero. Outside a typed fence target family, a producer must begin or byte-identically adopt its category/owner-key reservation before its first durable owner byte, bind that pair into the owner record, and close it only against the exact terminal owner receipt. Inside `source-run-launch` or `recovery-restart`, the same atomic fence/head CAS creates the complete exact named target set, those target pairs are the only permitted begin authorities while the fence is held, and only the matching exact compound close may settle them. Reservation CAS refuses while a fence is held; fence CAS refuses while any non-target reservation or owner is live. A nonzero observation leaves the same fixed pending record in `pending-input`, publishes no operation, consumes no guard, and performs no epoch mutation; zero-input resume alone may retry acquisition.

Under the held owner-admission fence, resume observes/reopens epoch one, A's empty restart/sequence/helper census, and the fixed three-hook runtime identities; derives every immutable readiness/retirement/activation/epoch-two/cutover candidate hash in memory; publishes/reopens `InternalProductionPhysicalServiceRestartAuthorityCutoverOperationV1`; and CAS-publishes the fixed active-operation locator. Immediately before guard consumption and again immediately before the epoch-head CAS it calls `reobserveInternalProductionGlobalOwnerAdmissionFenceV1(...)` and requires exactly zero unrelated owners with the identical category/identity-set projection. Any nonzero or changed observation leaves the same operation pending and performs neither consumption nor CAS. The fence remains held through terminal cutover publication/reopen and is released only afterward; terminal visibility/status requires the exact release record. A crash before the fixed pending record is side-effect-free and the same caller input may repeat prepare; after it, a fresh process uses only zero-input resume, which reopens the fixed record and creates or adopts only the missing fence/operation/active-locator member in order—never a scan or caller guard. `observeInternalProductionPhysicalServiceRestartAuthorityCutoverStatusV1()` is strictly read-only and reports `baseline-a-active | pending-input | prepared | resuming | recovery-d-active`; `pending-input` permits a null fence only before acquisition and otherwise binds its exact pair, while all later states require the same fence. Crash tests use a wholly fresh empty-environment process at every pending-temp/fsync/publish/reopen, fence acquire/reobserve, operation, active-locator, guard-consumption, candidate, CAS, terminal, fence-release, and response boundary. Race B migration prepare, D cutover prepare, and every enumerated owner admission; at most one fence holder exists, no owner is admitted while held, and neither guarded mutation runs from a nonzero census.

The sequence coordinator owns three separate fixed intent domains, `live-rebind`, `d-startup-hook-load`, and `documentation-rollback`; none may adopt, supersede, or advance another. `d-startup-hook-load` is delivered by A but remains unavailable until code-owned observation proves the reviewed D Setfarm and Mission Control source handoff SHAs are both on clean built main; it exists solely to load the three D-capable hooks while A epoch one is still active and cannot enable D prepare. Before creating any intent the coordinator reopens the sole terminal bootstrap-handoff migration locator and pair, proves the current clean Setfarm source descends from `migrationSourceSha`, repeats the dedicated implementation blob, ordered-statements, named-digest-entry, digest, and schema verification while allowing unrelated append-only registry entries, and binds `migrationReceiptRef`, `migrationReceiptHash`, and `migrationSchemaProjectionHash` into `sequenceIntentHash` and the final sequence receipt. It derives the remainder of `sequenceIntentHash` from the literal kind plus the freshly observed clean source/build/runtime projection and code-owned ordered service/action tuple, publishes that intent before observing a first guard, and uses one fixed private locator per intent kind—never a scan or newest selection. For each ordinal it durably publishes the exact fresh guard pair before calling `restartInternalProductionBaselineServiceV1()`. Response-loss recovery may invoke only that same pending guard pair until it receives the composite pair, then durably publishes and freshly resolves the exact composite authority, validates its migration identity, service/action, prior/after generation, complete before/after source/build projection, consumed guard equality, successful settlement, and zero-owner cleanup, and advances one immutable predecessor-CAS journal head. It cannot observe or mint the next guard before the prior advance is durable. After ordinals `0,1,2` map exactly to spawner, dashboard, Mission Control, it publishes the final receipt and status; the receipt repeats the exact migration pair and three authority pairs in that order. The acyclic sequence/status hashes omit their ref/hash fields and their refs derive only afterward. A blocked/ambiguous step remains the only active ordinal and never rolls forward, retries with a new guard, or starts another intent. Once D delivery's atomic cutover publishes A's retirement, a new `live-rebind`, `d-startup-hook-load`, or `documentation-rollback` request returns the strict `state:"retired"` status and typed refusal without an intent/guard/operation. Any post-D rollback must use D's reviewed `source-release-barrier`/`documentation-handoff` authority or remain unavailable; no command, recovery path, or historical A pair can resurrect epoch one.

Both exported Zod schemas are strict objects and reject unknown, missing, nullable, or widened fields. The authority schema is a strict `guardKind` discriminated union. `complete-zero-owner` alone contains `zeroOwnerGuardRef`/`zeroOwnerGuardHash` and `cleanup.observedGlobalZero:true`; `fenced-completion-owner-bootstrap` alone contains the durable target-guard pair, request/claim/run/owner/drain/fence identities, and cleanup proving the retained exact target owner plus zero unrelated owners. A member containing fields from both branches fails. All source SHAs plus `migrationImplementationBlobHash` use `GitObjectHashSchema`; `orderedStatementsHash`, `namedMigrationDigestEntryHash`, and all other hashes—including `operationId`—use `Sha256Schema`; every ref uses A's bounded canonical `setfarm://` grammar. Each runtime projection hash covers its exact fields except `projectionHash`. `actionId` comes from the closed service-to-action table and `operationId` is the acyclic canonical hash of `schema`, `service`, `actionId`, exact discriminated authorization, and complete `before` projection. `postRuntimeSourceProjectionHash` equals `after.projectionHash`; the selected service's authority changes while every non-target relation remains exact. The acyclic `receiptHash` covers the complete discriminated body except its ref/hash, then derives the exact receipt ref. The resolver reopens every nested authorization/operation member and remints the exact union. B imports and narrows this type unaliased; all three three-service sequence kinds accept only ordinary global-zero members, while P0 bootstrap accepts only the fenced-target member and later terminal sequence evidence supplies global zero.

The tuple, Zod enum options, generated JSON Schema enum, CLI JSON array, dashboard API predicate, and authoritative census query must be byte/order-equal. The scalar compatibility fixture must be one schema-valid tuple member and its envelope must bind the exact generated schema hash. The tuple contains exactly those four values; `pending`, `queued`, `waiting`, and every terminal value are forbidden. The JSON CLI accepts only `--json`, emits one canonical object containing schema, the exact ordered tuple, and `contractHash`, emits no npm banner when consumed with `npm run --silent`, and performs no database/filesystem mutation.

`dashboard.ts` imports the predicate: default `GET /api/runs` contains exactly operational-active rows and marks each returned `DashboardRunInfo.operationalActive:true`; the explicit historical form may return inactive rows but marks them `false`. `index.html` selects only the server-produced boolean and contains no status literal list. The generated compatibility fixture binds the producer symbol/export names and exact enum. The Mission Control shared adapter imports the vendored JSON Schema, first proves at module initialization that it is the exact four-item, unique, frozen enum, and exports only its derived type and predicate; it must fail closed on artifact drift and must not maintain a second tuple.

```typescript
export interface InternalProductionBaselineBackupReceiptV1 {
  schema: "setfarm.internal-production-baseline-backup-receipt.v1";
  attemptHash: string;
  journalHash: string;
  dumpHash: string;
  listHash: string;
  checksumFileHash: string;
  targetPaths: readonly [
    "/Users/setrox/ai/setrox/data/backups/internal-production-baseline/setfarm.dump",
    "/Users/setrox/ai/setrox/data/backups/internal-production-baseline/setfarm.list.txt",
    "/Users/setrox/ai/setrox/data/backups/internal-production-baseline/setfarm.sha256"
  ];
  canonicalRef: "setfarm://internal-production/baseline/backup";
  receiptHash: string;
}
```

- [ ] **Step 1: Write failing schema, census, store, and CLI tests**

`baseline-spawner-startup-admission-v1.test.ts` proves the admission/locator is durable before A dispatch, resolves only the unique active spawner operation, derives current process/generation/source/build internally, permits one exact claim, waits for and returns the same operation's final composite pair, and survives crashes before/after locator, claim, authority visibility, and response. It also drives the `completion-owner-bootstrap` branch from the exact authenticated runtime-completion owner context: the target guard binds request/claim/run/owner generation, drained/fenced state, and zero unrelated census; the restart may proceed while only that target owner remains; the replacement generation recovers the same completion request, records its successor owner generation, releases that owner exactly once, and only then may A publish the global-zero terminal sequence. Inject crashes before/after target-guard mint, sequence intent, dispatch, new-spawner admission/claim, activation barrier release, owner recovery, owner release, global-zero observation, final receipt, and response; every retry adopts the same sequence/request/owner and never reports zero early. Reject a worker/caller/clone guard, a different request/claim/run/generation, an unfenced or undrained target, any unrelated owner, target release before recovery, a different recovered request, missing/duplicate release, and terminal nonzero census. Reject scans, caller paths/PIDs/env/plist/labels, clones, stale locators, wrong generation/source/build/service, duplicate/manual starts, a second operation, or D restart/checkpoint capabilities. A normal authenticated LaunchAgent startup with no active A operation returns `null` without mutation.

Post-handoff current/historical resolver regressions delete or corrupt the sequence member and each composite store member in turn, swap/duplicate ordered pairs, forge an outer copied hash, break service/action/projection/advance/final-census relations, and move a valid authority to the wrong locator. Every case blocks; a fresh process with intact nested stores reopens the same receipt, while historical descendant-source verification succeeds without skipping nested authentication.

A static operational-fence test rejects `$(` anywhere in a `test`, `[`, or `[[` predicate, a modifier invocation (`readonly`, `export`, `local`, or `declare`), another outer command's argv, or a redirection. Command substitution is allowed only in a standalone simple assignment or the enumerated status-aware `if VAR="$(negative scan)"` captures. Transcript tests inject a nonzero exit into every inner producer and separately return nonempty dirt; both cases must stop before the modifier, predicate, outer command, build, restart, record, or later acceptance command.

Sequence-chain tests require pair `0.before.projectionHash === initialRuntimeSourceProjectionHash`, each later pair's `before` projection to be canonically identical to the preceding pair's `after`, and `finalRuntimeSourceProjectionHash` to equal pair `2.after.projectionHash`. Setfarm SHA/build and Mission Control SHA/build identities remain identical across every before/after projection; only the code-owned target service generation/authority may change at each step. Each `orderedAdvanceHashes[i]` is recomputed over the exact predecessor projection hash, successor projection hash, ordinal, service/action, composite pair, and prior advance hash or `null`. Source/build or non-target service drift observed between steps blocks before the next guard is minted. Receipt and fresh resolver tests reject a broken projection link, swapped pair, forged advance, or final-projection shortcut.

In `baseline-service-restart-sequence-v1.test.ts`, first prove absent/corrupt/unverified/non-ancestral or migration-blob/digest/schema-drifted authority prevents intent, reservation, guard, outbox, helper, and dispatch creation. Prove the original application SHA and later clean-main descendant SHAs both succeed only while `src/db/bootstrap-main-claim-handoff-v1-migration.ts`, its ordered statements, named digest entry, digest, and observed schema projection remain byte-identical; appending an unrelated registry/digest entry remains valid, while a sibling/ancestor source or a descendant changing A's module, named entry, or projection fails before mutation. Then inject a crash immediately before and after migration-locator/pair reopen, sequence-intent publication, each guard-pair publication/reopen, each restart invocation/response, composite-pair publication/fresh resolve, every validation, each predecessor-CAS advance, final receipt/status publication, and response return for all three exact three-service intent kinds. Every recovery must reopen the one fixed migration and same-kind sequence intent/pending pair, never mint the next or a replacement guard, never repeat a settled restart, and return the byte-identical migration-bound final three-pair receipt. Race two resumptions at every ordinal and require one winner, one adopted result, exact spawner-to-dashboard-to-Mission-Control order, and no fourth step. `d-startup-hook-load` additionally rejects use before both reviewed D source handoffs/clean builds or after A retirement and never changes D's disabled activation state. Separately exercise the one-service `completion-owner-bootstrap` sequence and require its target-owner discriminant, same migration identity, same-request recovery/release, and terminal global-zero relations; it cannot be parsed or adopted as a three-service receipt. Reject cross-intent adoption, swapped migration/service/action/pair, source/blob/digest/schema/build/generation/cleanup drift, missing or bare structural composite evidence, predecessor fork, scan/newest behavior, or a final record missing any required pair. CLI tests require `resume-restart-sequence --intent live-rebind|d-startup-hook-load|documentation-rollback --json` to emit only final `{sequenceRef,sequenceHash}`, `restart-sequence-status --intent ... --json` to emit one bounded strict status including the exact migration identity once an intent exists, and `resolve-bootstrap-handoff-migration --json` to reopen only the fixed terminal locator and emit the exact strict receipt; the bootstrap begin/resume functions have no public CLI, and no service, target guard, migration ID/ref/hash, path, command, PID, hash override, or arbitrary intent is accepted.

In `baseline-service-restart-helper-v1.test.ts`, crash or kill the helper at every boundary around claim, child identity, startup marker, guard consumption, dispatch-issued evidence, launchctl-child identity, and settlement. A dead helper with a startup marker may gain one immutable generation-abandonment successor and CAS takeover only when code-owned process observation proves that exact helper dead, the original guard remains unconsumed, and no dispatch-issued record, launchctl child, completion, or failure settlement exists. Preserve and hash the abandoned generation and marker forever. Race two takeover attempts and require one successor. Once guard consumption exists, require only live-helper adoption, exact terminal-settlement adoption, or durable ambiguity; a new helper generation or redispatch is forbidden.

Parse restart evidence with both exact exported schemas and require the finite mapping `setfarm-spawner -> a-restart-service-setfarm-spawner-v1`, `setfarm-dashboard -> a-restart-service-setfarm-dashboard-v1`, and `mission-control -> a-restart-service-mission-control-v1`; swapped, widened, or caller-supplied action IDs fail before reservation.

Require the complete owner census used later by B/D/E: active runs; open claims; execution attempts; runtimes/completion requests/mandatory effects; outbox; termination/findings/recovery owners; preparation owners; artifact reservations/publication batches/deliveries; compilation and execution leases; owned processes/listeners/worktrees; dirty worktrees; and stale test/agent children. Require deterministic sorted identities, exact aggregate hash, fixed canonical ref, fixed private target, and no caller-authored count/hash/path. RED must also prove the Task 8 parser rejects a missing/duplicate/malformed operational-source marker and the CLI cannot record before final docs `main` is clean and loaded services match it.

For every service, construct one strict `InternalProductionBaselineServiceRestartAuthorityV1` from exactly one authenticated authorization branch plus code-owned before/after observers. Ordinary `restart-service` and both three-service sequences require `complete-zero-owner` and complete global zero after settlement. Only the fixed P0 operation may use `fenced-completion-owner-bootstrap`; it requires the exact retained fenced target owner and zero unrelated owners after restart, while its later terminal sequence requires recovery/release of that target and a new complete global-zero census. Recompute nested projection, authorization, reservation, operation, outbox, helper claim/process/startup, completion settlement, dispatch, cleanup, receipt, and ref hashes; require the target service generation to change while every projection retains exact Setfarm/Mission Control source/build authority. Reject a caller source/build/observation, branch substitution/mixing, unconsumed/expired/replayed/wrong-service authorization, same generation, changed non-target authority, relation-invalid cleanup, structural clone, missing/extra field, forged pair, corrupt store member, or receipt-ref drift. Inject crashes before/after every authorization, reservation, operation, continuation grant, outbox, helper, guard consumption, dispatch, settlement, source, cleanup, publication, and response boundary. A retry with the exact operation pair adopts the same state; another authorization or dispatch is forbidden. Spawn a fresh resolver and reopen only the returned pair. CLI tests for ordinary `restart-service` remain pair-only; bootstrap preparation/execution/finalization has no public CLI. Source-boundary tests keep A and D namespaces/capabilities disjoint.

In `baseline-restart-authority-retirement-v1.test.ts`, start from exact epoch one and race D's unaliased prepare followed by fresh-process zero-input resume against B migration prepare, A ordinary restart preparation, bootstrap preparation, every sequence-intent publication, and every enumerated owner producer for all three services. Prove A's internal fixed observer/recorder—not D or caller input—derives the exact current three-hook/source/build readiness; reject a missing, stale, partial, caller-authored, or structurally cloned readiness/activation/cutover object and every A import from D. If another owner or fence wins, cutover remains on the same pending record without guard consumption or epoch successor; if cutover wins, all owner admissions block until its sole visibility CAS exposes the complete A-owned readiness/retirement/activation/cutover/epoch-two tuple and terminal fence release, and every A restart path returns `BASELINE_RESTART_AUTHORITY_RETIRED` before mutation. Then let D import the exact A pair-only resolvers, open the complete chain, and prove one D reservation may proceed, while no A authorization may coexist; max physical dispatch count is one in every interleaving. Crash before/after fixed pending-record temp/fsync/publication/reopen, owner-fence acquisition/reobservation, transition lock, code-owned hook observation, operation publication/active locator, guard consumption, each candidate, epoch-head CAS, terminal reopen, fence release, status, and response; restart the whole shell after prepare and require zero-input resume without the old guard pair. Before-CAS retry keeps epoch one/D-disabled, after-CAS retry adopts only the same complete pair, and partial/forked/missing/cross-paired state never enables D. Reject nonzero ownership, any pending/live A operation/sequence/helper, wrong predecessor epoch, stale/partial hook readiness, service tuple/order drift, a second cutover, D before visibility, A after visibility, and epoch-one resurrection. Preserve and resolve pre-retirement completed/in-flight history; only exact pre-retirement in-flight recovery may finish. Post-D rollback tests require D authority or typed unavailability and forbid an A restart mutation. Parse every status branch strictly: baseline has null pending/fence/operation/cutover authority at epoch one; pending-input has the exact pending pair, a null-or-exact not-yet-acquired/acquired fence pair, null operation/successor authority, and unconsumed guard; prepared/resuming require the same exact fence and operation, and recovery-active binds those plus non-null readiness/retirement/activation/cutover authorities at epoch two and the terminal fence-release relation; cross-state fields or caller guard input are rejected.

In `baseline-spawner-startup-admission-v1.test.ts` and `runtime-completion.test.ts`, model the old-generation completion owner after the P0 merge/build. A failed or dirty build result cannot mint `InternalProductionBaselineCompletionOwnerBootstrapCleanBuildVerificationV1`. A successful code-owned result binds the exact merge/tree/P0 file-set/build/test and historical/migration identities plus current request/claim/run/owner hashes. Crash before/after capability mint, target-guard mint, A prepare, request operation/status-locator persistence/reopen, execute, and process replacement; reentry must use the same pair/locator and never import or call a P0/B function. Reject a structural verification, caller SHA/hash/result, another owner/request, changed migration pair, or continuation after retirement before any restart mutation.

In `migrations.test.ts` and `migration-source-digests.test.ts`, require the exact bootstrap-handoff operation/claim/terminal-pair dedicated migration and named digest entry to be present in A's source claim. Exercise clean fixed database plan/apply/verify with a one-use complete-zero guard after both clean builds and before the first restart authorization; require exact application-source equality, content-address and freshly resolve `InternalProductionBaselineBootstrapHandoffMigrationReceiptV1`, and bind only the dedicated implementation blob, ordered statements, named digest entry, digest, and schema projection. Then make the first and every later restart authority, all three sequence kinds, B P0, D hook load, and both baseline post-handoff resolvers reopen that exact pair; later clean source may differ only when it is a proven descendant and those A-specific identities remain exact. Append unrelated migration and digest registry entries and require the same authority to remain valid; changing/removing/reordering A's named entry or implementation/projection fails. A CLI integration fixture runs the built pending-migration command with all three old service generations still loaded and proves it makes no HTTP, listener, spawner, dashboard, Mission Control, runtime-module, or restart call before completing. Reject a restart intent/authorization before terminal verified migration, apply before clean merged A source/build, apply after any first-rebind operation exists, missing/replayed/wrong guard, caller SQL/ID/digest/database/ref/hash, partial table/index/column state, non-descendant current source, changed dedicated implementation, ordered statements, or named digest entry, digest/schema drift, response-loss duplication, a B P0 attempt to apply schema, or Task 8 attempting to apply again. Crash before/after plan, guard consumption, each migration transaction boundary, verification, receipt publication/reopen, first-restart consumption, and baseline-receipt binding; retry returns the same pair or fails closed without a second schema mutation.

In `baseline-post-handoff-receipt-v1.test.ts`, exercise the B-purpose guard seam without importing B: bind only the literal `golden-launch-operation-migration-release-v1` purpose to a canonical pending-input ref/hash, reopen the authorization, bind one canonical operation ref/hash, and consume the underlying generic guard exactly once through A's named consumer. Crash before/after authorization publication, operation binding, guard consumption, consumption-receipt publication, and response; fresh-process recovery adopts the same authorization/consumption pairs. Reject another purpose/namespace, missing pending input, structural clone, changed operation, direct generic-store access, replay, and a second consumer before any guarded side effect.

In `operational-active-run-status-v1.test.ts`, require the source tuple, Zod enum options, generated JSON Schema enum, CLI JSON, dashboard filter, and existing authoritative DB census predicate to contain the same ordered four values: `running`, `resuming`, `cancelling`, `failing`; require the compatibility fixture to be a schema-valid member bound to that exact schema. Exercise the transition sequence `running -> resuming -> cancelling -> failing` and prove every state remains operational-active without being collapsed; transitions from any of those states to `completed`, `failed`, or `cancelled` become inactive. Reject `pending`, every terminal status, a reordered/extended artifact, duplicate value, or locally maintained dashboard/UI list. Spawn the JSON CLI through `npm run --silent`, feed its stdout directly to the parser, and prove the stream contains exactly one JSON document with no npm banner.

For backup recovery, use a temporary fixed-root test harness and an injected crash hook around every `dump-linked`, `list-linked`, and `checksum-linked` hard-link operation: immediately before the link, immediately after the link but before directory fsync, after fsync but before the immutable phase record is published, and immediately after that record is published. Every rerun must authenticate and adopt only the exact contiguous prefix, complete the remaining links, and return the byte-identical receipt. Add crashes before/after `artifacts-sealed`, `published`, every source-name unlink, and `sources-released`. For each of the seven journal phases, crash before/after unpredictable temporary-record creation, full write, file fsync, no-replace publication, journal-directory fsync, temporary-name unlink, and final `O_NOFOLLOW` reopen; every recovery either authenticates the same whole record and continues or sees no committed phase. Reject a partial/truncated record, a later record without its predecessor, a forged/reordered/hash-chain-broken record, an unknown fixed record, a symlink/hardlink/mode-drifted record, an unequal pre-existing phase target, a temporary-file poisoning attempt, any use of append/`O_APPEND` against journal authority, a gap such as dump plus checksum without list, a target with different device/inode while its sealed source exists, any artifact hash/size/mode/symlink/hardlink mismatch, a foreign pre-existing target without the durable attempt, or a second attempt. Prove the final three targets are regular non-symlink mode-`0600`, link-count-one files and that rerunning `backup --json` only reopens the same receipt.

- [ ] **Step 2: Implement the smallest fixed authority**

`baseline-spawner-startup-admission-v1.ts` owns the exact target-guard, bootstrap operation, continuation grant, bootstrap sequence, strict startup-admission record, fixed operation-keyed locator, WeakMap remint, current-process claim, same-operation authority waiter, and every prepare/execute-or-recover/resolve/finalize export shown above. `baseline-service-restart-helper-v1.ts` publishes the admission before the spawner dispatch and never imports P0/B. Admission completion is observational: B may use the capability, but A's final restart authority and cleanup do not depend on B activation. A and D retain disjoint operation schemas, roots, locators, authenticators, and action tables; D's exact reviewed cutover adapter is the sole exception that imports A's two named prepare/resume cutover mutations unaliased; every other D consumer imports only A types, pair-only resolvers, status observers, and the physical epoch. Source tests reject any D capability imported into A, any A restart capability reused by D, any D mutation import other than the exact prepare/resume adapter pair, or any A mutation after epoch two.

Before each guard observation, the coordinator freshly reopens the prior resolved `after` projection and current runtime projection and requires canonical equality. Pair zero's `before` equals the sealed initial projection; pair `i.before` equals pair `i-1.after`; the final projection equals pair two's `after`. It holds Setfarm/Mission Control source and build identities invariant throughout the sequence and permits only the ordinal's target service authority/generation transition. It derives each `orderedAdvanceHashes[i]` from the exact predecessor/successor projection pair, ordinal, service/action, composite pair, and prior advance hash, then the final receipt/resolver recomputes the complete three-link chain.

`baseline-service-restart-sequence-v1.ts` is the sole sequence-intent, guard-pair, composite-pair, CAS-journal, final-receipt, and status owner. It calls the existing code-owned zero-owner observer and `restartInternalProductionBaselineServiceV1()` directly; it does not spawn the public CLI or duplicate restart logic. Every record uses the existing fixed private root and unpredictable-temporary/file-fsync/no-replace/parent-fsync/`O_NOFOLLOW` reopen protocol. `baseline-post-handoff-cli.ts` validates exactly the three finite intent literals `live-rebind|d-startup-hook-load|documentation-rollback` and delegates `resume-restart-sequence` or read-only `restart-sequence-status`; the mutating command returns only a completed final pair and status never repairs or advances. A fresh process resolves every returned pair before use.

`baseline-restart-authority-retirement-v1.ts` is the sole fixed transition lock/epoch/readiness/activation/retirement/cutover writer. The helper, bootstrap preparer, and sequence coordinator all call its internal A-active guard while holding the same lock before their first durable mutation. D's exact reviewed cutover adapter alone imports A's two cutover mutations unaliased; every other D consumer imports only types/resolvers/status, while A imports nothing from D. `baseline-post-handoff-receipt-v1.ts` owns the guarded migration receipt, B-purpose guard seam, the four-purpose global fence, canonical 35-category/census schema, plan-manifest schema/assembler, producer reservation/head/store/resolvers, fixed recovery-source operation/run receipt/status/resolver, and the sole phase-versioned manifest-set activation store/head/resolvers. `baseline-post-handoff-cli.ts` and `package.json` own its three bootstrap verbs. The six A call-site files named in the File Map implement exactly the eleven literal seven-field rows of `INTERNAL_PRODUCTION_OWNER_PRODUCER_ROWS_A_V1`, including `execution-attempt` separately from `fixture-attempt` and the source bootstrap's `run` reservation separately from the ordinary spawner `run` producer; `INTERNAL_PRODUCTION_OWNER_PRODUCER_MANIFEST_A_V1.manifestHash` hashes exactly its schema, plan, and ordered rows. The new target-family ABI changes no A-owned producer call site and therefore leaves manifest A at exactly eleven rows. A imports no B–E source and does not assert a future module exists. `baseline-post-handoff-receipt-v1.test.ts` requires exactly 35 unique categories, exactly 35 key-checked census-map entries, the exact eleven A rows, unique implementation ID/module-function/owner-key tuples, and census keys equal to each row's category map. Its AST fixtures open only `plan:"A"` modules and require their named functions to begin before the first owner byte and close only with the terminal pair.

After A's reviewed source is merged, clean, and source/build-authenticated, `activateInternalProductionOwnerProducerManifestSetV1({expectedPredecessor:null,manifests:[INTERNAL_PRODUCTION_OWNER_PRODUCER_MANIFEST_A_V1]})` publishes the first strict content-addressed activation receipt and CAS-installs the fixed current head. The initial receipt has all four predecessor fields null; every append instead supplies and persists one exact predecessor quartet `{activationRef,activationHash,headRef,headHash}`. Each receipt binds exact phase, ordered plans/manifests and their fresh source/build authority pairs, canonical registry/map hashes, that predecessor activation pair, that predecessor head pair, and its derived ref/hash. `manifestSetHash` is exactly `hashCanonicalJson({schema:"setfarm.internal-production-owner-producer-manifest-set.v1",phase,orderedPlans,orderedManifestHashes,orderedSourceBuildAuthorities,ownerCategoryRegistryHash,ownerCategoryCensusMapHash})`; the activation hash includes that complete projection plus both predecessor pairs and omits only its own derived `activationRef`/`activationHash`. The strict head is a separate content-addressed record: its canonical hash projection is exactly `{schema,phase,activationRef,activationHash,predecessorHeadRef,predecessorHeadHash}`, then it derives `headRef` and `headHash`; neither derived head member appears in that projection. The implementation rejects an absent, half-null, mixed, non-current, or receipt/head-inconsistent predecessor before publishing either successor. Immutable receipts and heads use unpredictable same-directory temp, file fsync, no-replace publication, parent fsync, and `O_NOFOLLOW` reopen; the sole mutable current-head locator uses expected-predecessor CAS, atomic replacement, parent fsync, and exact reopen. A later plan may append only its exact next manifest after that plan's reviewed merge/source/build authority exists and after freshly resolving the current `{head,receipt}` predecessor; phase skips, reorder/removal, stale predecessor, future import, structural manifest, source/build drift, or a duplicate/conflicting row fails without head movement. There is no void activation, import-time side effect, process-local active set, caller row, CLI row injection, or source import order as authority. `resolveCurrentInternalProductionOwnerProducerManifestSetActivationV1()` opens only the fixed current-head locator, reopens and re-hashes the named head and receipt, proves their phase/current/pair/predecessor-chain relations, and returns the strict `{head,receipt}` tuple. `observeCompleteInternalProductionZeroOwnerCensusV1()` freshly resolves that same tuple and equality-binds both pairs, its exact `manifestSetHash`, registry/map hashes, and all reservation/owner identities into the observation. Missing/corrupt/forked/unknown activation state makes the census unavailable rather than zero.

`baseline-owner-producer-manifest-activation-controller-v1.ts` is A's sole executable wrapper around that generic initial activation. Its public mutator is zero-input: it code-owns only `INTERNAL_PRODUCTION_OWNER_PRODUCER_MANIFEST_A_V1`, phase `A`, and the freshly resolved clean A source/build authority; it accepts no manifest/plan/row, predecessor, receipt/head pair, source/build body, root, path, environment, or test port. Before calling the generic store it publishes and reopens one fixed-private, content-addressed activation operation binding A's manifest/source-build pair and the all-null predecessor quartet. It then calls the generic activator, freshly resolves both the returned activation receipt and `resolveCurrent...()` tuple, requires phase `A`, exactly eleven rows, exact A manifest/source-build hashes, and equality of both successor pairs, and only then publishes/reopens `InternalProductionBaselineOwnerProducerManifestActivationReceiptV1`. That wrapper receipt canonically binds the all-null predecessor activation/head quartet, successor activation/head quartet, manifest/source-build pair, and only omits its own `receiptRef`/`receiptHash`; the fixed status locator is updated last. Its zero-input status reader never repairs: it reopens the operation, wrapper receipt, status locator, successor head, and successor activation receipt and returns only the strict path-free status union. A crash before generic activation leaves the one operation resumable; a crash after generic activation but before wrapper receipt can adopt only that exact current successor; a crash after wrapper receipt but before status publication completes only the matching fixed locator. A fork, changed source/build/manifest, non-null predecessor, missing/mixed successor pair, stale current head, duplicate wrapper receipt, unknown temporary, or any mismatch becomes `blocked` without retrying another activation. The module has no top-level controller construction or `void` call: importing its manifest or controller is inert.

`baseline-owner-producer-manifest-activation-controller-v1.test.ts` requires the exact A File Map paths and CLI table; strict schema/hash/ref/nullability; no exported input-bearing mutation; `activate-owner-producer-manifest --json` and read-only `owner-producer-manifest-status --json` only; and no import-time store call. It injects a crash before/after operation, generic activation, receipt, locator, and response, races two activations, and restarts in a fresh process. Every successful recovery returns the one byte-identical wrapper receipt/status and re-hashes both successor records; each malformed operation/receipt/locator, ref/hash swap, stale/replaced head, changed clean source/build authority, or second A activation fails before another generic store call. Source/transcript fixtures prove activation is the fail-fast gate immediately after the reviewed clean build and before every A producer call site, migration, guard, restart, source-bootstrap, or owner byte.

B, C, D, and E each own and test only their later literal table/manifest and append exactly one phase after their source exists. Only E's final source task imports the five exact manifest exports, invokes `assembleInternalProductionOwnerProducerRegistryV1(...)`, verifies final category coverage and all-row File Map/AST relations, and publishes the aggregate registry hash in the `A+B+C+D+E` activation; no earlier task performs an all-row scan. Tests crash before/after receipt/head temp/fsync/publish/reopen and current-head CAS/reopen, adopt only a unique byte-identical `{head,receipt}` tuple, and reject same-phase forks, an activation receipt whose predecessor quartet is not the prior current tuple, or a current head whose source/build authority no longer resolves. Compile-time fixtures prove generic `acquireInternalProductionGlobalOwnerAdmissionFenceV1(...)` accepts only the exact migration or cutover purpose with `targetFamily:null` and rejects source-run/restart purposes; the two dedicated acquire seams accept only their discriminated exact inputs. Target-family schema tests assert the seven exact named descriptor fields, categories, implementation IDs, canonical ABI hash, target-family hash, and return members; reject a missing/eighth/renamed field, arbitrary reservation or identity array, caller owner-key hash, mismatched coordinator/active-target discriminant, and any derivation input beyond the immutable authorization-operation pair plus exact authority and namespace/service/coordination tuple. Runtime tests hold the shared owner-admission head at every A reservation/fence CAS boundary and prove either one reservation/owner or one fence wins, never both. Recovery-restart tests publish the immutable operation, outbox, helper, child, replacement process, and startup listener under their already acquired exact target pairs without ordinary begin; then publish the acyclic immutable terminal core and prove the pair-only compound close removes all seven targets in one successor while preserving the fence and exact coordinator/active-target authority. They reject an ordinary begin under the fence, a partial/per-target/generic close, a final-envelope close input, a terminal core containing the future close/release/envelope pair, a core/operation/family mismatch, and release before compound close. Counters prove no durable owner publication precedes reservation, no fence becomes visible with a pending non-target reservation, and no target remains after the compound close.

Helper recovery records every generation as immutable history. If a helper dies after its startup marker but before guard consumption, the coordinator may publish one `setfarm.internal-production-baseline-restart-helper-generation-abandonment.v1` record binding the operation/outbox, abandoned generation/claim/process/startup hashes, a fresh code-owned dead-process observation hash, `guardConsumed:false`, and exact absence hashes for dispatch-issued, launchctl-child, and settlement evidence. Only after reopening that record may an expected-predecessor CAS publish the next helper generation. A concurrent successor loses the CAS and adopts the winner. The old marker is never deleted or rewritten. Guard consumption permanently closes this branch: from then on recovery may only authenticate the same live helper, adopt its completion/failure settlement, or record ambiguity; no abandonment successor, claim takeover, or dispatch is legal.

`baseline-service-restart-helper-v1.ts` is the sole fixed child entry. The controller launches `process.execPath` plus that compiled module path through `execFile`/`shell:false`, with no user arguments and a replacement environment, and passes one unforgeable operation capability through a private inherited descriptor. The helper authenticates that capability against the durable A-only reservation/operation/outbox before claiming it; direct execution, a caller descriptor/body, an inherited ambient variable, a second claim, or any D capability/namespace fails before guard consumption. Its public module surface is empty.

Implement `operational-active-run-status-v1.ts` as the sole runtime producer of the declared tuple, Zod schema, type, and predicate. Register it in `mission-control-contract-artifacts.ts` so the existing generator derives the JSON Schema and compatibility fixture from that module; do not hand-maintain their enum. Update the artifact test from eight to ten exact ordered paths and cross the new fixture through the producer schema. The code-owned zero-owner observer and dashboard import the predicate directly. The contract CLI serializes the same frozen tuple and hashes the canonical object excluding `contractHash`; `package.json` exposes it as `contract:operational-active-run-status`. In `dashboard.ts`, replace exclude-terminal/current-state guesses with the imported predicate for default `/api/runs` selection and the `operationalActive` field. In `index.html`, consume only `operationalActive === true`. Keep historical-run retrieval explicit and preserve the raw status string without reclassifying it. The regression also reads the authoritative census migration and requires its literal set to remain identical to the producer; changing either side without regenerating/reconciling the other fails.

After the producer and failing artifact expectations are implemented, run the existing code-owned writer once: `node --import tsx scripts/mission-control-contract-artifacts.ts --write`. Only the two declared generated files may be new; every pre-existing generated artifact must remain byte-identical.

Use existing Setfarm database/process/worktree observers; do not create a second run classifier or lifecycle controller. `observeCompleteInternalProductionZeroOwnerCensusV1()` is zero-input/read-only and returns the strict path-free `InternalProductionCompleteZeroOwnerCensusObservationV1`: all 35 category-backed counts including `executionAttemptCount`, the freshly resolved current manifest-set activation ref/hash, active manifest-set hash, category-registry hash, census-map hash, reservation/owner identity-set hashes, and observation hash. Production accepts no injected observer, census, activation, root, store, or row; tests may use a private non-exported fake helper that cannot be imported by D/E. The receipt module owns the fixed backup path, durable attempt/journal, and no-follow/no-replace protocol. The only service mutation in this subproject is the finite `restart-service` command: it consumes one exact fresh zero-owner guard and maps the closed service enum to code-owned labels before fixed `execFile`/`shell:false`; no other A module or shell fence may contain `launchctl`. Source observers reject an injected root, connection string, command, service label, PID, or receipt body. The `runtime-source` CLI alone accepts exactly two comparison SHA arguments, validates them as Git object hashes, and passes them only as expected identities to the code-owned observer; neither value selects a root/build/process.

`restartInternalProductionBaselineServiceV1()` first reopens the exact discriminated authorization, the sole verified bootstrap-handoff migration receipt, and the code-owned complete `before` runtime-source projection; requires the current clean source in `before` to descend from the original `migrationSourceSha`, requires the dedicated migration implementation blob, ordered statements, named digest entry, digest, and schema projection to equal the receipt while ignoring unrelated append-only registry entries, and separately requires the complete runtime source/build projection to equal the current clean build; binds that pair into `operationId`; and only then durably publishes/reopens a fixed A-only chain `reservation -> operation -> outbox` before authorization consumption, process creation, or dispatch. A private code-owned helper atomically claims only that outbox, publishes its bounded child PID/start-time/executable/process-identity hash and startup marker, and only then consumes the authorization inside the already prepared operation. No public API accepts the helper, PID, process, label, command, namespace, or migration authority. The helper executes the one fixed no-shell service dispatch at most once and publishes exactly one immutable completion or failure settlement; the successful authority binds the migration pair, reservation, operation, outbox, claim, child identity, startup marker, and completion-settlement hashes. Recovery before consumption may reclaim only a provably dead pre-dispatch helper for the same operation; recovery after consumption is lookup/adoption only. After authentic completion it waits for the exact changed target generation/service authority and derives the complete `after` projection from code-owned observers. It then reobserves either complete global zero for `complete-zero-owner` or the exact fenced target plus zero unrelated owners for `fenced-completion-owner-bootstrap`, and creates only that matching authority branch. Bootstrap terminal global zero is never claimed here; it exists only in the later terminal bootstrap sequence.

Store the reservation, operation, outbox, helper claim, child-process identity, startup marker, immutable helper-generation abandonment successor, completion/failure settlement, dispatch receipt, runtime projections, cleanup observation, and final authority below A's fixed private baseline-restart root with the same unpredictable-temporary, file/parent-fsync, no-replace, `O_NOFOLLOW` reopen, bounded canonical-byte protocol. The helper claim is an expected-predecessor CAS over the one operation and its generation. A stale helper may be superseded while the guard remains unconsumed when no dispatch-issued record, launchctl child, or settlement exists: absence of a startup marker permits the ordinary pre-start successor, while presence of an authentic retained startup marker requires the exact dead-process observation plus immutable generation-abandonment successor defined above. Publish one guard/operation-keyed final locator only after every member is durable; a retry locates/reopens that exact authority without scanning. The resolver takes only `{receiptRef,receiptHash}`, reopens that final locator and all members, proves exact canonical equality and hash/ref relations, remints the recursively frozen strict authority, and exposes no private path. `restart-service --json` prints only the returned pair. A consumed guard with absent/partial/ambiguous operation state blocks; it never mints a replacement guard, selects a newest receipt, or repeats `launchctl`. These types, file prefixes, operation IDs, helper executable, and root are finite to A's three baseline services and are disjoint from D's generic recovery lifecycle namespace.

`createOrResumeInternalProductionBaselineBackupV1()` owns the fixed real mode-`0700` directory and fixed `.attempt-v1` child. The attempt contains three sealed mode-`0600` source files, a canonical manifest binding each target basename/device/inode/size/content hash, and a real mode-`0700` `journal` child containing exactly seven possible immutable mode-`0600` records named `0001-issued.json` through `0007-sources-released.json`. Each strict canonical record binds `attemptHash`, ordinal, phase, the prior record hash or `null`, and the manifest hash or its phase-valid `null`; its record hash covers every member except itself. The only valid chain prefix is `issued -> artifacts-sealed -> dump-linked -> list-linked -> checksum-linked -> published -> sources-released`; recovery resolves those seven exact names in order and never treats an arbitrary directory member or partial bytes as a record.

Publish every phase record as one atomic whole-file transaction, never by append. Create an unpredictable same-directory sibling with exclusive create and mode `0600`, write the complete canonical bytes, fsync and close it, then install it at the fixed phase name without replacement by same-filesystem `link(2)` followed by journal-directory fsync (or an equivalently proven no-replace rename primitive), unlink the temporary name, fsync the directory again, and reopen the fixed name with `O_RDONLY|O_NOFOLLOW`. Require a regular one-link mode-`0600` file, bounded canonical bytes, the expected phase/ordinal/prior hash/manifest relation, and a recomputed record hash before the phase becomes usable. If a crash leaves both the fixed link and exactly one matching unpredictable sibling, recovery may adopt only after `O_NOFOLLOW` opening both names proves identical device/inode, bytes, mode, phase, and hash; it then unlinks only that sibling, fsyncs the journal directory, and reopens the fixed name at link count one. If the fixed record already exists, never replace it: reopen and adopt only byte-identical authority after all checks; unequal, malformed, noncontiguous, or other mode/link/type-drifted authority fails closed. An uncommitted unpredictable sibling with no fixed link carries no authority and may be removed only after its own no-follow regular-file/mode/name/phase validation; an unknown extra hardlink or second matching sibling fails closed. Thus a crash cannot expose a torn record or poison a future append, because the implementation forbids `appendFile`, append-mode streams, `O_APPEND`, in-place truncation, and writes through a published record descriptor.

With `shell:false` and bounded/redacted failure output, the backup runs exact argv `pg_dump --format=custom --no-owner --no-privileges --file <attempt-dump-partial>` using the existing validated `SETFARM_PG_URL` only as child `PGDATABASE`, then exact `pg_restore --list <sealed-attempt-dump>` into the list partial, and writes exact `<dumpHash>  setfarm.dump\n` checksum bytes. Before `artifacts-sealed`, recovery may regenerate only its own incomplete sources while no fixed target exists. After sealing, source bytes are immutable. For each artifact publication phase, validate all prior fixed targets and require every later target absent. If the next target already appeared after a crash but its phase record is absent, adopt it only when `O_NOFOLLOW` reopen proves the same sealed-source device/inode plus exact manifest bytes, size, mode, and hash; then fsync the artifact parent and atomically publish the missing immutable phase record. Any noncontiguous prefix or mismatched existing target fails closed.

Keep all three sealed source names until `published` and its immutable record are fsynced, so every link-window crash has an authenticated hard-link identity to reopen. After `published`, unlink source names idempotently; a crash during release may leave link count one or two only when the remaining source name is the same manifest-bound inode. Publish `sources-released` only after all fixed targets reopen as regular non-symlink mode-`0600`, link-count-one files with exact hashes, `pg_restore --list` succeeds, and the checksum file equals `<dumpHash>  setfarm.dump\n`. Store/reopen the strict content-addressed receipt and return it without exposing the database URL or subprocess output. A valid completed attempt is idempotent; an existing fixed target without the authenticated journal, another attempt, a gap, or drift is never adopted or overwritten.

- [ ] **Step 3: Run focused and adjacent verification**

```bash
set -euo pipefail
node --import tsx --test \
  tests/operational-active-run-status-v1.test.ts \
  tests/mission-control-contract-artifacts.test.ts \
  tests/internal-production/baseline-post-handoff-receipt-v1.test.ts \
  tests/internal-production/baseline-service-restart-helper-v1.test.ts \
  tests/internal-production/baseline-spawner-startup-admission-v1.test.ts \
  tests/internal-production/baseline-service-restart-sequence-v1.test.ts \
  tests/internal-production/baseline-restart-authority-retirement-v1.test.ts \
  tests/execution-attempts/migrations.test.ts \
  tests/execution-attempts/migration-source-digests.test.ts \
  tests/internal-production/baseline-post-handoff-cli.test.ts
node --import tsx scripts/mission-control-contract-artifacts.ts --check
npx tsc -p tsconfig.json --noEmit
npm run check:english
npm run check:paths
npm run check:migration-digests
git diff --check
```

- [ ] **Step 4: Deliver through one canonical Setfarm V3 source claim**

The Setfarm owner allocates the isolated source worktree from clean `main`; the implementation/review agents edit/test only the declared Task 0 Setfarm paths and submit the claim output. Setfarm alone commits, pushes, opens, reviews, merges, cleans up, and returns clean synchronized `main`. No live service restart, backup, baseline Markdown, or receipt write occurs in this task. Task 7/8 cannot begin until the exact command is present in clean built `main` and the source PR has independent zero-Critical/High/Medium review.

---

### Task 1: Complete the Product Build Authority V2 proxy and render review gate

**Files:**

- Modify: `mission-control/server/routes/setfarm-operational.test.ts`
- Review: `mission-control/server/routes/setfarm-operational.ts`
- Review: `mission-control/server/services/setfarm-product-build-authority.ts`
- Review: `mission-control/server/services/setfarm-product-build-authority.test.ts`
- Review: `mission-control/src/lib/product-build-authority.ts`
- Review: `mission-control/src/components/run-detail/ProductBuildAuthority.tsx`
- Review: `mission-control/tests/product-build-authority-render.test.tsx`

**Interfaces:**

- Consumes: Setfarm `GET /api/runs/:runId/product-build-authority` responses using `setfarm.product-build-authority.v1` or `setfarm.product-build-authority.v2`.
- Produces: `ProductBuildAuthority = ProductBuildAuthorityV1 | ProductBuildAuthorityV2`.
- Produces: `parseProductBuildAuthority(value: unknown, expectedRunId?: string): ProductBuildAuthority`.
- Produces: `SetfarmProductBuildAuthorityClient.get(runId: string): Promise<ProductBuildAuthorityFetchResult>`.
- Produces: `parseProductBuildAuthorityResponse(statusCode: number, body: unknown, expectedRunId: string)` for the browser boundary.
- Produces: a UI that labels V2 `sealed_packet` as `SEALED`, V2 `refused_before_packet` as `REFUSED`, and never falls back to agent prose.

- [ ] **Step 1: Reconfirm the exact pre-existing branch scope**

Run from `mission-control`:

```bash
set -euo pipefail
git status --short --branch
git rev-list --left-right --count origin/main...HEAD
git diff --name-status origin/main...HEAD
git diff --check origin/main...HEAD
```

Expected: clean worktree; `0 1`; exactly the six starting files; no whitespace errors.

- [ ] **Step 2: Add HTTP-boundary characterization for both V2 dispositions**

Append this test shape to `server/routes/setfarm-operational.test.ts`, importing `ProductBuildAuthority` from the service:

```ts
test("Product Build authority v2 success is passed through without reinterpretation", () => {
  const sealed = {
    schema: "setfarm.product-build-authority.v2",
    runId: "run-sealed",
    disposition: "sealed_packet",
    packetAuthority: {} as never,
    refusal: null,
    authorityHash: "a".repeat(64),
  } as ProductBuildAuthority;
  const refused = {
    schema: "setfarm.product-build-authority.v2",
    runId: "run-refused",
    disposition: "refused_before_packet",
    packetAuthority: null,
    refusal: {} as never,
    authorityHash: "b".repeat(64),
  } as ProductBuildAuthority;

  assert.deepEqual(
    toProductBuildAuthorityHttpResult({ status: "ok", authority: sealed }),
    { statusCode: 200, body: sealed },
  );
  assert.deepEqual(
    toProductBuildAuthorityHttpResult({ status: "ok", authority: refused }),
    { statusCode: 200, body: refused },
  );
});
```

This is a characterization test for already-committed behavior, so it is expected to pass immediately. It does not pretend the existing implementation was developed after this plan.

- [ ] **Step 3: Run the focused authority suite**

```bash
set -euo pipefail
node --import tsx --test \
  server/routes/setfarm-operational.test.ts \
  server/services/setfarm-product-build-authority.test.ts \
  tests/product-build-authority-render.test.tsx
```

Expected: all tests pass; V1 remains readable; V2 sealed/refused payloads pass strict server validation; run mismatch, extra fields, hash drift, artifact drift, and unsupported schema fail closed.

- [ ] **Step 4: Review the implementation against the Setfarm producer**

```bash
set -euo pipefail
git -C ../setfarm show HEAD:src/server/schemas/product-build-authority-v2.ts | sed -n '1,220p'
git -C ../setfarm show HEAD:src/server/product-build-authority.ts | sed -n '300,430p'
git diff --unified=80 origin/main...HEAD -- \
  server/routes/setfarm-operational.ts \
  server/services/setfarm-product-build-authority.ts \
  src/lib/product-build-authority.ts \
  src/components/run-detail/ProductBuildAuthority.tsx
```

Expected: exact disposition names and refusal identities match; the server recomputes canonical hashes; the UI never treats a refusal as a sealed packet; no prose fallback exists.

- [ ] **Step 5: Report the scoped Setfarm-owned handoff checkpoint**

```bash
set -euo pipefail
git diff --check -- server/routes/setfarm-operational.test.ts
git diff --name-only -- server/routes/setfarm-operational.test.ts
git status --short --branch
```

Expected: only the route test is reported. The worker returns the exact path, focused-test result, and authorized handoff subject `test: cover Product Build authority v2 route` to the Setfarm completion owner. Only that owner, after validating the active claim and canonical writing worktree, may stage and commit it. The worker does not stage, commit, push, or open a PR.

---

### Task 2: Add an exact project-to-run execution projection

**Files:**

- Create: `mission-control/shared/setfarm-operational-active-run-status-v1.ts`
- Consume: `mission-control/contracts/vendor/setfarm/operational-active-run-status.v1.schema.json`
- Create: `mission-control/server/services/project-execution-state.ts`
- Create: `mission-control/server/services/project-execution-state.test.ts`
- Modify: `mission-control/server/utils/setfarm-db.ts`

**Interfaces:**

- Consumes: persisted project identity fields and bounded PostgreSQL `runs` rows.
- Produces:

```ts
declare const setfarmOperationalActiveRunStatusV1Brand: unique symbol;
export type SetfarmOperationalActiveRunStatusV1 = string & Readonly<{
  [setfarmOperationalActiveRunStatusV1Brand]: true;
}>;

export function isSetfarmOperationalActiveRunStatusV1(
  value: unknown,
): value is SetfarmOperationalActiveRunStatusV1;

export interface ProjectRunRow {
  id: string;
  runNumber: number;
  protocol: "legacy" | "shadow" | "v3" | null;
  status: string;
  updatedAt: string | null;
}

export interface ProjectRunBindingHints {
  projectId: string;
  latestRunId: string | null;
  workflowRunId: string | null;
  setfarmRunIds: string[];
  latestRunNumber: number | null;
  runNumber: number | null;
}

export type ProjectRunBinding =
  | { status: "bound"; row: ProjectRunRow; source: "latest_run_id" | "workflow_run_id" | "setfarm_run_ids" | "latest_run_number" | "run_number" }
  | { status: "unbound"; reasonCode: "PROJECT_RUN_IDENTITY_ABSENT" | "PROJECT_RUN_NOT_FOUND" }
  | { status: "conflict"; reasonCode: "PROJECT_RUN_IDENTITY_CONFLICT" };

export interface ProjectExecutionState {
  schema: "mission-control.project-execution.v1";
  state: SetfarmOperationalActiveRunStatusV1 | "terminal" | "unbound" | "unavailable";
  active: boolean;
  runId: string | null;
  runStatus: string | null;
  protocol: "legacy" | "shadow" | "v3" | null;
  source: "setfarm_postgres_run" | "none";
  reasonCode: string;
}

export function projectRunBindingHints(project: Record<string, unknown>): ProjectRunBindingHints;
export function bindProjectRun(hints: ProjectRunBindingHints, rows: readonly ProjectRunRow[]): ProjectRunBinding;
export function deriveProjectExecutionState(binding: ProjectRunBinding): ProjectExecutionState;
export async function getProjectRunRows(hints: readonly ProjectRunBindingHints[]): Promise<ProjectRunRow[]>;
```

- [ ] **Step 1: Write failing pure binding tests**

Cover these exact cases in `project-execution-state.test.ts`:

```ts
test("binds an agreed singular identity before historical collections", () => {
  const rows: ProjectRunRow[] = [
    { id: "run-old", runNumber: 41, protocol: "legacy", status: "failed", updatedAt: null },
    { id: "run-new", runNumber: 42, protocol: "v3", status: "running", updatedAt: null },
  ];
  const binding = bindProjectRun({
    projectId: "ledger",
    latestRunId: "run-new",
    workflowRunId: "run-new",
    setfarmRunIds: ["run-old", "run-new"],
    latestRunNumber: 42,
    runNumber: 42,
  }, rows);
  assert.equal(binding.status, "bound");
  if (binding.status === "bound") {
    assert.equal(binding.source, "latest_run_id");
    assert.equal(binding.row.id, "run-new");
  }
});

test("fails closed when singular run identities conflict", () => {
  const rows: ProjectRunRow[] = [
    { id: "run-old", runNumber: 41, protocol: "legacy", status: "failed", updatedAt: null },
    { id: "run-new", runNumber: 42, protocol: "v3", status: "running", updatedAt: null },
  ];
  assert.deepEqual(bindProjectRun({
    projectId: "ledger",
    latestRunId: "run-new",
    workflowRunId: "run-old",
    setfarmRunIds: ["run-old", "run-new"],
    latestRunNumber: 42,
    runNumber: 41,
  }, rows), {
    status: "conflict",
    reasonCode: "PROJECT_RUN_IDENTITY_CONFLICT",
  });
});

test("never upgrades an unbound historical record to active", () => {
  assert.deepEqual(deriveProjectExecutionState({
    status: "unbound",
    reasonCode: "PROJECT_RUN_NOT_FOUND",
  }), {
    schema: "mission-control.project-execution.v1",
    state: "unbound",
    active: false,
    runId: null,
    runStatus: null,
    protocol: null,
    source: "none",
    reasonCode: "PROJECT_RUN_NOT_FOUND",
  });
});
```

Also assert:

- two present singular string IDs (`latestRunId`, `workflowRunId`) must be identical after trim or fail closed with `PROJECT_RUN_IDENTITY_CONFLICT` before any row lookup;
- two present singular numeric IDs (`latestRunNumber`, `runNumber`) must be equal or fail closed with the same reason;
- one singular string ID binds only that exact row; a missing row is `PROJECT_RUN_NOT_FOUND` and never falls back to collection or numeric hints;
- when both singular string IDs agree, report source `latest_run_id`; when only one exists, report its exact source;
- explicit `setfarmRunIds` select the greatest exact `runNumber` only when no singular ID exists;
- duplicate `setfarmRunIds` are de-duplicated; two different rows with the same greatest `runNumber` fail closed with `PROJECT_RUN_IDENTITY_CONFLICT`;
- exact numeric binding is considered only when no singular string ID and no `setfarmRunIds` exist; agreed numeric hints bind that exact run number;
- a numeric hint resolving to zero rows is `PROJECT_RUN_NOT_FOUND`; resolving to more than one row is `PROJECT_RUN_IDENTITY_CONFLICT`;
- historical `setfarmRunIds` or numeric hints may contain older identities and do not conflict with one agreed singular string identity because they are never consulted in that branch;
- each of `running`, `resuming`, `cancelling`, and `failing` preserves its exact state and is active through the imported Setfarm predicate;
- the transition sequence `running -> resuming -> cancelling -> failing` remains active at every step, while transition to `completed`, `failed`, or `cancelled` is terminal and inactive;
- `pending` is unavailable and inactive; no Mission Control consumer may extend the Setfarm tuple;
- `completed`, `done`, `failed`, `cancelled`, and `canceled` are terminal;
- an unknown run status is unavailable and inactive;
- no test or implementation accepts name, task, repository, substring, or regex matching.

- [ ] **Step 2: Run the focused test and observe RED**

```bash
set -euo pipefail
node --import tsx --test server/services/project-execution-state.test.ts
```

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement the pure projection**

Implement the declared interfaces. The shared adapter builds one frozen membership set directly from the strictly validated vendored JSON Schema enum and returns a nominal branded string only through `isSetfarmOperationalActiveRunStatusV1`; it declares no local literal union or tuple. Import that type and predicate into the projection. Normalize string IDs with trim-only semantics; do not slugify them. Normalize numeric hints only when they are positive safe integers. Apply the rule in this order: reject unequal present singular string IDs; bind one agreed/present singular string ID without fallback; otherwise use `setfarmRunIds`; otherwise reject unequal present singular numeric IDs and bind the agreed/present exact run number; otherwise return unbound. Conflict is based on contradictory supplied identity, not on which rows happen to exist. Preserve the database status string as `runStatus`; if the imported predicate accepts it, preserve that exact state and set `active:true`, otherwise derive only `terminal|unbound|unavailable` and `active:false`.

- [ ] **Step 4: Run the pure test and observe GREEN**

```bash
set -euo pipefail
node --import tsx --test server/services/project-execution-state.test.ts
```

Expected: PASS.

- [ ] **Step 5: Add the bounded PostgreSQL reader**

Implement `getProjectRunRows()` in `server/utils/setfarm-db.ts`. Build de-duplicated ID and run-number arrays in memory, cap the combined requested identity count at 2,000, and use one parameterized query:

```ts
const rows = await sql`
  SELECT id, run_number, protocol, status, updated_at
  FROM runs
  WHERE id = ANY(${ids}) OR run_number = ANY(${runNumbers})
  ORDER BY run_number DESC, id ASC
`;
```

Map rows to `ProjectRunRow`; never interpolate identifiers into SQL. Return `[]` when both bounded arrays are empty.

- [ ] **Step 6: Add DB-reader source-boundary assertions**

In the service test, read `server/utils/setfarm-db.ts` and assert the query contains both exact predicates and no task/name/repo comparison:

```ts
const source = readFileSync(new URL("../utils/setfarm-db.ts", import.meta.url), "utf8");
assert.match(source, /WHERE id = ANY\(\$\{ids\}\) OR run_number = ANY\(\$\{runNumbers\}\)/);
assert.doesNotMatch(source, /task\s+(?:LIKE|ILIKE)|repo.*LIKE|name.*LIKE/i);
```

- [ ] **Step 7: Run focused and adjacent server tests**

```bash
set -euo pipefail
node --import tsx --test \
  server/services/project-execution-state.test.ts \
  server/services/projects-json-repository.test.ts \
  server/services/v3-project-transfer.test.ts
```

Expected: PASS.

- [ ] **Step 8: Report the scoped Setfarm-owned handoff checkpoint**

```bash
set -euo pipefail
git diff --check -- \
  shared/setfarm-operational-active-run-status-v1.ts \
  server/services/project-execution-state.ts \
  server/services/project-execution-state.test.ts \
  server/utils/setfarm-db.ts
git diff --name-only -- \
  shared/setfarm-operational-active-run-status-v1.ts \
  server/services/project-execution-state.ts \
  server/services/project-execution-state.test.ts \
  server/utils/setfarm-db.ts
```

Expected: the worker reports these exact paths, test evidence, and authorized handoff subject `fix(projects): derive exact execution state` to the owning Setfarm completion claim. Only its owner mutates Git.

---

### Task 3: Separate project catalog, execution, runtime, and receipt state in the API

**Files:**

- Modify: `mission-control/server/routes/projects.ts`
- Create: `mission-control/server/routes/projects-projection.test.ts`
- Consume: `mission-control/server/services/project-execution-state.ts`, its Setfarm-derived execution state, and `mission-control/shared/setfarm-operational-active-run-status-v1.ts`; the route defines no active-status list.

**Interfaces:**

- Consumes: `ProjectExecutionState` and existing `projectRuntimeObservation` inputs.
- Produces:

```ts
export interface ProjectApiProjection {
  status: "registered" | "building" | "completed" | "failed" | "cancelled";
  execution: ProjectExecutionState;
  runtime: {
    state: "active" | "inactive" | "unknown";
    checkedAt: string | null;
    reasonCode: string;
  };
  receipt: null | {
    status: string;
    serviceStatus: string;
    projectionHash: string;
    projectRecordHash: string;
  };
}

export function toProjectApiProjection(
  persisted: Record<string, unknown>,
  execution: ProjectExecutionState,
): Record<string, unknown> & ProjectApiProjection;
```

- [ ] **Step 1: Write failing public-projection tests**

Cover the following:

```ts
test("legacy registry active is registered when no Setfarm execution is bound", () => {
  const projected = toProjectApiProjection({
    id: "old-card",
    status: "active",
    serviceStatus: "inactive",
    createdBy: "setfarm-workflow",
  }, {
    schema: "mission-control.project-execution.v1",
    state: "unbound",
    active: false,
    runId: null,
    runStatus: null,
    protocol: null,
    source: "none",
    reasonCode: "PROJECT_RUN_NOT_FOUND",
  });
  assert.equal(projected.status, "registered");
  assert.equal(projected.execution.active, false);
  assert.equal(projected.runtime.state, "inactive");
  assert.equal(projected.receipt, null);
});
```

For a canonical V3 stored record, assert the output copies the immutable stored `status`, `serviceStatus`, `canonicalProjectionHash`, and `canonicalProjectRecordHash` into `receipt`, exposes terminal execution separately, and does not mutate the input object. For a running explicit run, assert public `status:"building"` and `execution.active:true`. For failed/cancelled rows, assert they remain visible and retain terminal public status.

- [ ] **Step 2: Run the route-projection test and observe RED**

```bash
set -euo pipefail
node --import tsx --test server/routes/projects-projection.test.ts
```

Expected: FAIL because `toProjectApiProjection` is absent.

- [ ] **Step 3: Implement read-time projection without persistence mutation**

In `GET /projects`:

1. Load and de-duplicate persisted records.
2. Extract all bounded `ProjectRunBindingHints`.
3. Read exact run rows once with `getProjectRunRows()`.
4. Bind and derive execution for each project.
5. Perform existing live port/deployment observation.
6. Return a cloned `toProjectApiProjection()` result.

Keep `ProjectsJsonRepository.save()`, canonical transfer ACK hashing, patch guards, deletion guards, and V3 persisted record shapes unchanged. Remove name/task/repository matching only from execution-state assignment; legacy descriptive enrichment may remain advisory but cannot change `execution`, public `status`, or action authority. The route imports the shared predicate and fail-closed equality-checks `execution.active === (execution.runStatus !== null && isSetfarmOperationalActiveRunStatusV1(execution.runStatus))` before emitting a project. It copies the exact active transition state from `ProjectExecutionState`; it never imports a second tuple or treats `pending` as active.

- [ ] **Step 4: Make terminal filtering explicit**

Update `isHiddenTerminalProject()` to use `execution.state === "terminal"` plus public `status` in `failed|cancelled`; default `/api/projects` continues to include all records. `hideTerminal=1` remains the only API request that hides terminal projects.

- [ ] **Step 5: Run focused server tests**

```bash
set -euo pipefail
node --import tsx --test \
  server/routes/projects-projection.test.ts \
  server/routes/run-mutation-boundary.test.ts \
  server/services/project-execution-state.test.ts \
  server/services/projects-json-repository.test.ts \
  server/services/v3-project-transfer.test.ts \
  server/services/setfarm-deployment-observation.test.ts
```

Expected: PASS; no canonical V3 write or acknowledgement hash changes.

- [ ] **Step 6: Report the scoped Setfarm-owned handoff checkpoint**

```bash
set -euo pipefail
git diff --check -- server/routes/projects.ts server/routes/projects-projection.test.ts
git diff --name-only -- server/routes/projects.ts server/routes/projects-projection.test.ts
```

Expected: the worker reports the two paths, focused gates, and authorized subject `fix(projects): separate execution from catalog state`; the owning Setfarm completion claim alone stages/commits.

---

### Task 4: Render the separated state and fix the Active Run empty state

**Files:**

- Modify: `mission-control/src/lib/types.ts`
- Consume: `mission-control/shared/setfarm-operational-active-run-status-v1.ts`
- Modify: `mission-control/src/lib/project-health.ts`
- Modify: `mission-control/src/pages/Projects.tsx`
- Modify: `mission-control/src/components/projects/ProjectCard.tsx`
- Modify: `mission-control/src/components/projects/ProjectDetailPanel.tsx`
- Modify: `mission-control/src/pages/ActiveRun.tsx`
- Modify: `mission-control/tests/project-health.test.ts`
- Create: `mission-control/tests/project-execution-render.test.tsx`
- Create: `mission-control/tests/active-run-selection.test.ts`
- Modify: `mission-control/server/routes/overview.ts`
- Create: `mission-control/server/routes/overview.test.ts`

**Interfaces:**

- Consumes: `ProjectApiProjection` from Task 3.
- Consumes: the exact `SetfarmOperationalActiveRunStatusV1` type and `isSetfarmOperationalActiveRunStatusV1()` predicate from the shared vendored-contract adapter.
- Produces: `pickActiveRun(runs: readonly PipelineRunSummary[]): PipelineRunSummary | null`.
- Produces: four independently labeled UI concepts: `PROJECT`, `EXECUTION`, `RUNTIME`, and `RECEIPT`.

- [ ] **Step 1: Write the Active Run selector regression**

Export `PipelineRunSummary` and `pickActiveRun` from `ActiveRun.tsx`, then create:

```ts
test("Active Run never falls back to a terminal run", () => {
  assert.equal(pickActiveRun([
    { id: "failed", workflow: "feature-dev", task: "failed", status: "failed", runNumber: 9 },
    { id: "done", workflow: "feature-dev", task: "done", status: "completed", runNumber: 10 },
  ]), null);
});

test("Active Run accepts every exact operational-active transition and selects newest", () => {
  for (const status of ["running", "resuming", "cancelling", "failing"] as const) {
    assert.equal(pickActiveRun([
      { id: `old-${status}`, workflow: "feature-dev", task: status, status, runNumber: 10 },
      { id: `new-${status}`, workflow: "feature-dev", task: status, status, runNumber: 11 },
    ])?.id, `new-${status}`);
  }
  assert.equal(pickActiveRun([
    { id: "invented", workflow: "feature-dev", task: "invented", status: "pending", runNumber: 12 },
    { id: "resuming", workflow: "feature-dev", task: "resuming", status: "resuming", runNumber: 11 },
  ])?.id, "resuming");
});
```

Also drive one identity through `running -> resuming -> cancelling -> failing -> completed` and assert the selector preserves each of the first four exact states as active, then returns `null`. Import the shared predicate in the test and assert its accepted values are byte/order-equal to the vendored schema enum; `pending`, terminal values, and unknown strings must never be selected.

- [ ] **Step 2: Write SSR tests for the four status meanings**

In `project-execution-render.test.tsx`, render `ProjectCard` and `ProjectDetailPanel` with:

- an unbound historical record whose runtime is inactive;
- a bound running execution;
- a failed terminal run;
- a canonical V3 completed run whose immutable receipt says `active` but whose observed runtime is inactive.

Assert the V3 HTML contains `RECEIPT ACTIVE`, `EXECUTION TERMINAL`, and `RUNTIME INACTIVE`, but does not contain an execution label of `ACTIVE`. Assert the unbound card says `REGISTERED` and `EXECUTION UNBOUND`.

- [ ] **Step 3: Run the UI tests and observe RED**

```bash
set -euo pipefail
node --import tsx --test \
  tests/active-run-selection.test.ts \
  tests/project-execution-render.test.tsx \
  tests/project-health.test.ts
```

Expected: FAIL because the separated types/labels and strict active selector are absent.

- [ ] **Step 4: Implement types and rendering**

Add these fields to `ProjectData` and the local project view interfaces:

```ts
export interface ProjectData {
  execution: ProjectExecutionState;
  runtime: {
    state: "active" | "inactive" | "unknown";
    checkedAt: string | null;
    reasonCode: string;
  };
  receipt: null | {
    status: string;
    serviceStatus: string;
    projectionHash: string;
    projectRecordHash: string;
  };
}
```

Use `project.execution.active` for workflow-active styling/filtering. Use `project.runtime.state` for start/stop/runtime health styling. Use `project.receipt` only under an immutable receipt label. Do not use `project.status || project.serviceStatus` as a combined status.

- [ ] **Step 5: Remove the terminal fallback**

Import the shared contract predicate and implement `pickActiveRun()` as:

```ts
export function pickActiveRun(runs: readonly PipelineRunSummary[]): PipelineRunSummary | null {
  const ordered = [...runs].sort(newestFirst);
  return ordered.find((run) => isSetfarmOperationalActiveRunStatusV1(run.status)) ?? null;
}
```

When it returns `null`, render “No active Setfarm run.” rather than “No Setfarm runs found.”

- [ ] **Step 6: Correct Overview recent-deploy semantics**

Export a pure `selectRecentRuntimeProjects(projects)` helper from `server/routes/overview.ts`. It may select projects with a declared frontend port, but it must not filter on raw `project.status === "active"`. It returns candidates whose ports are then checked, and `online` remains the result of the live HTTP probe.

The route imports the shared predicate and obtains active-workflow counts only from a Task 3 `ProjectApiProjection.execution` whose `active`, `state`, and `runStatus` satisfy the same equality relation; it must not inspect a raw project status or duplicate the four-value tuple. Test that an inactive historical raw-active project is not described as an active workflow, that each exact operational-active state contributes once, that a `pending` or terminal run contributes zero, and that a completed project with a live port can appear as an online recent deployment.

- [ ] **Step 7: Run focused and adjacent UI/API tests**

```bash
set -euo pipefail
node --import tsx --test \
  server/routes/overview.test.ts \
  server/routes/projects-projection.test.ts \
  tests/active-run-selection.test.ts \
  tests/project-execution-render.test.tsx \
  tests/project-health.test.ts \
  tests/operational-evidence-render.test.tsx
```

Expected: PASS.

- [ ] **Step 8: Report the scoped Setfarm-owned handoff checkpoint**

```bash
set -euo pipefail
git diff --check -- \
  src/lib/types.ts \
  src/lib/project-health.ts \
  src/pages/Projects.tsx \
  src/components/projects/ProjectCard.tsx \
  src/components/projects/ProjectDetailPanel.tsx \
  src/pages/ActiveRun.tsx \
  tests/project-health.test.ts \
  tests/project-execution-render.test.tsx \
  tests/active-run-selection.test.ts \
  server/routes/overview.ts \
  server/routes/overview.test.ts
```

Expected: the worker reports this exact scope, UI/API gate evidence, and authorized subject `fix(ui): distinguish project execution state`; the Setfarm completion owner alone stages/commits.

---

### Task 5: Pin Mission Control to the final Setfarm producer contracts

**Files:**

- Modify when changed: `mission-control/contracts/vendor/setfarm/mission-control-contracts.v1.lock.json`
- Modify when changed: the ten producer artifacts under `mission-control/contracts/vendor/setfarm/`
- Modify: `mission-control/scripts/sync-setfarm-contract.mjs`
- Modify: `mission-control/scripts/check-setfarm-contract.mjs`
- Modify: `mission-control/tests/setfarm-contract-vendor.test.ts`

**Interfaces:**

- Consumes: committed Setfarm artifacts under `setfarm/contracts/generated/mission-control/` from final clean Setfarm `main`.
- Produces: one lock whose `producerCommit` equals the exact Setfarm baseline SHA and whose ten SHA-256 values bind byte-identical vendored artifacts.

- [ ] **Step 1: Require clean synchronized Setfarm main**

```bash
set -euo pipefail
git -C ../setfarm status --short --branch
A_MC_SYNC_SETFARM_BRANCH="$(git -C ../setfarm branch --show-current)"
test "$A_MC_SYNC_SETFARM_BRANCH" = "main"
A_MC_SYNC_SETFARM_HEAD="$(git -C ../setfarm rev-parse HEAD)"
A_MC_SYNC_SETFARM_ORIGIN_MAIN="$(git -C ../setfarm rev-parse origin/main)"
test "$A_MC_SYNC_SETFARM_HEAD" = "$A_MC_SYNC_SETFARM_ORIGIN_MAIN"
```

Expected: clean `main`; exact local/remote equality. Do not sync from a feature/spec branch.

- [ ] **Step 2: Verify the producer artifacts before copying**

```bash
set -euo pipefail
npm --prefix ../setfarm run check:mission-control-contracts
```

Expected: PASS.

- [ ] **Step 3: Sync from the committed producer**

First add a source-boundary test in `setfarm-contract-vendor.test.ts` that reads `scripts/sync-setfarm-contract.mjs` and requires exactly the two new ordered producer/vendored path pairs in addition to the existing eight; observe RED. Extend only the sync inventory, rerun that named test, then use the sync command. Do not add a directory scan, glob, caller artifact, or alternate repository selection.

```bash
set -euo pipefail
npm run sync:setfarm-contract -- --source ../setfarm
```

Expected: the sync either updates only the lock plus the ten known vendor files or produces no diff because the byte pin is already current.

- [ ] **Step 4: Cross the semantic consumer after Tasks 2–4**

Update `setfarm-contract-vendor.test.ts` to require exactly ten distinct lock entries and add `setfarm.operational-active-run-status.v1` to the compatibility descriptor table. The JSON Schema enum must cross `isSetfarmOperationalActiveRunStatusV1()` for all four members in producer order and the schema-valid positive scalar fixture must cross the same predicate. A rehashed fixture containing `pending`, or an enum with a missing/reordered/extra member, must be rejected by the semantic consumer. The test imports the shared adapter and its type; it does not declare another active tuple.

Extend `check-setfarm-contract.mjs` with the same exact contract/stem descriptor. It imports the shared predicate, parses the pinned compatibility envelope, invokes the predicate for its scalar fixture, and requires every ordered generated-schema enum member to pass that predicate; unknown or drifted members fail. The checker never defines another tuple and continues to validate the exact ordered ten-entry lock.

```bash
set -euo pipefail
npm run check:setfarm-contract
node --import tsx --test tests/setfarm-contract-vendor.test.ts
```

Expected: PASS only after the shared consumer exists and all ten pinned artifact hashes validate.

- [ ] **Step 5: Review exact contract scope**

```bash
set -euo pipefail
git status --short
git diff --name-only -- scripts/sync-setfarm-contract.mjs scripts/check-setfarm-contract.mjs contracts/vendor/setfarm tests/setfarm-contract-vendor.test.ts
git diff --check
```

Expected: this task changes only the two sync/check scripts, vendored artifacts/lock, and `tests/setfarm-contract-vendor.test.ts`; the shared adapter and its API/UI consumers belong to Tasks 2–4.

- [ ] **Step 6: Report the contract-pin handoff when it changed**

```bash
set -euo pipefail
if ! git diff --quiet -- scripts/sync-setfarm-contract.mjs scripts/check-setfarm-contract.mjs contracts/vendor/setfarm tests/setfarm-contract-vendor.test.ts; then
  git diff --check -- scripts/sync-setfarm-contract.mjs scripts/check-setfarm-contract.mjs contracts/vendor/setfarm tests/setfarm-contract-vendor.test.ts
  git diff --name-only -- scripts/sync-setfarm-contract.mjs scripts/check-setfarm-contract.mjs contracts/vendor/setfarm tests/setfarm-contract-vendor.test.ts
fi
```

Expected: the worker reports only the sync/check/lock/ten-vendor/test scope and authorized subject `chore: pin Setfarm baseline contracts` when bytes changed. The owning Setfarm completion claim stages/commits when required; otherwise it records a no-change checkpoint and creates no empty commit.

---

### Task 6: Verify and deliver the Mission Control branch through a reviewed PR

**Files:**

- Verify all Mission Control files changed by Tasks 1–5.
- Do not add build output, screenshots, logs, `.env`, or runtime data.

**Interfaces:**

- Consumes: all prior Mission Control task commits.
- Produces: one reviewed, merged Mission Control PR and a clean local `main` equal to `origin/main`.

- [ ] **Step 1: Run static and focused checks**

```bash
set -euo pipefail
readonly A_MC_VERIFY_ROOT=/Users/setrox/ai/setrox/mission-control
A_MC_VERIFY_PWD="$(pwd -P)"
test "$A_MC_VERIFY_PWD" = "$A_MC_VERIFY_ROOT"
A_MC_VERIFY_TOPLEVEL="$(git -C "$A_MC_VERIFY_ROOT" rev-parse --show-toplevel)"
test "$A_MC_VERIFY_TOPLEVEL" = "$A_MC_VERIFY_ROOT"
A_MC_VERIFY_STATUS="$(git -C "$A_MC_VERIFY_ROOT" status --porcelain=v1 --untracked-files=all)"
test -z "$A_MC_VERIFY_STATUS"
npm run check:version
npm run check:prompts
npm run check:paths
npm run check:setfarm-contract
node --import tsx --test \
  server/routes/setfarm-operational.test.ts \
  server/services/setfarm-product-build-authority.test.ts \
  server/services/project-execution-state.test.ts \
  server/routes/projects-projection.test.ts \
  server/routes/overview.test.ts \
  tests/product-build-authority-render.test.tsx \
  tests/project-execution-render.test.tsx \
  tests/active-run-selection.test.ts \
  tests/project-health.test.ts
```

Expected: PASS only from the exact Mission Control root after all prior owner commits are complete and the full tracked/untracked porcelain is empty. Transcript/source tests inject one dirty tracked path and one untracked path independently and prove the first positive check is never invoked.

- [ ] **Step 2: Run the full Mission Control suite and build**

```bash
set -euo pipefail
npm test
npm run build
```

Expected: both commands exit 0.

- [ ] **Step 3: Run render smoke including Projects and one durable run detail**

```bash
set -euo pipefail
MC_RENDER_ROUTES="/,/setfarm,/setfarm/active,/projects,/setfarm/runs/ac8cea43-7686-4d27-8092-1e3dd9207ca4" npm run render:smoke
```

Expected: every route renders, no fatal console error appears, and no unexpected failed request occurs. Screenshots remain non-committable under `artifacts/render-smoke/`; the bounded render owner/harness must dispose them before Step 4. The worker never treats ignored or untracked render output as reviewed source and cannot continue while any artifact remains in full porcelain.

- [ ] **Step 4: Confirm exact clean delivery scope and scan for secrets**

```bash
set -euo pipefail
readonly A_MC_SCAN_ROOT=/Users/setrox/ai/setrox/mission-control
A_MC_SCAN_PWD="$(pwd -P)"
test "$A_MC_SCAN_PWD" = "$A_MC_SCAN_ROOT"
A_MC_SCAN_TOPLEVEL="$(git -C "$A_MC_SCAN_ROOT" rev-parse --show-toplevel)"
test "$A_MC_SCAN_TOPLEVEL" = "$A_MC_SCAN_ROOT"
git -C "$A_MC_SCAN_ROOT" diff --check origin/main...HEAD
git -C "$A_MC_SCAN_ROOT" status --short
git -C "$A_MC_SCAN_ROOT" diff --name-only origin/main...HEAD

A_SOURCE_DIFF_CAPTURE="$(mktemp "${TMPDIR:-/tmp}/a-mc-source-diff.XXXXXX")"
readonly A_SOURCE_DIFF_CAPTURE
A_SOURCE_DIFF_DIAGNOSTICS="$(mktemp "${TMPDIR:-/tmp}/a-mc-source-diff-diagnostics.XXXXXX")"
readonly A_SOURCE_DIFF_DIAGNOSTICS
trap 'rm -f -- "$A_SOURCE_DIFF_CAPTURE" "$A_SOURCE_DIFF_DIAGNOSTICS"' EXIT
A_MC_SCAN_STATUS="$(git -C "$A_MC_SCAN_ROOT" status --porcelain=v1 --untracked-files=all)"
test -z "$A_MC_SCAN_STATUS"
if git -C "$A_MC_SCAN_ROOT" diff --no-ext-diff origin/main...HEAD >"$A_SOURCE_DIFF_CAPTURE" 2>"$A_SOURCE_DIFF_DIAGNOSTICS"; then
  A_SOURCE_DIFF_STATUS=0
else
  A_SOURCE_DIFF_STATUS=$?
fi
if test "$A_SOURCE_DIFF_STATUS" -ne 0 || test -s "$A_SOURCE_DIFF_DIAGNOSTICS"; then
  printf 'Mission Control source diff capture failed closed\n' >&2
  exit 1
fi

if A_SOURCE_SECRET_SCAN_OUTPUT="$(rg --no-heading --color never -n -e 'BEGIN (RSA|OPENSSH|EC) PRIVATE KEY' -e 'sk-[A-Za-z0-9_-]{20,}' -e 'gh[pousr]_[A-Za-z0-9]{20,}' -e 'postgres(?:ql)?://[^[:space:]]+:[^[:space:]@]+@' -- "$A_SOURCE_DIFF_CAPTURE" 2>&1)"; then
  A_SOURCE_SECRET_SCAN_STATUS=0
else
  A_SOURCE_SECRET_SCAN_STATUS=$?
fi
case "$A_SOURCE_SECRET_SCAN_STATUS" in
  0)
    printf 'Mission Control source secret scan matched forbidden bytes\n' >&2
    exit 1
    ;;
  1)
    if test -n "$A_SOURCE_SECRET_SCAN_OUTPUT"; then
      printf 'Mission Control source secret scan returned output with no-match status\n' >&2
      exit 1
    fi
    ;;
  *)
    printf 'Mission Control source secret scan failed with status %s\n' "$A_SOURCE_SECRET_SCAN_STATUS" >&2
    exit "$A_SOURCE_SECRET_SCAN_STATUS"
    ;;
esac
```

Expected: only reviewed source/tests/contracts. Immediately before diff capture, the exact root must again have empty full tracked/untracked porcelain; a dirty tracked byte, ignored-assumption shortcut, or untracked byte fails before capture, scan, or delivery handoff. The exact-root diff capture succeeds with status `0` and empty diagnostics before the separate secret scan runs. The secret scan succeeds only with no-match status `1` and empty captured output. Its transcript/source tests cover `rg` statuses `0`, `1`, `2`, and `127`, a synthetic status-`1` nonempty output, an upstream `git diff` failure, and independently injected dirty tracked/untracked states at both clean gates; all but status-`1` empty output fail, the upstream failure proves `rg` is never invoked, and either dirty state proves no test, scan, or delivery command is reached.

- [ ] **Step 5: Hand the verified branch to the Setfarm delivery owner**

Return the exact diff paths, commit-subject checkpoints from Tasks 1–5, full verification evidence, secret-scan result, and this bounded PR metadata to the owning Setfarm delivery claim:

```text
repository: hikmetgulsesli/mission-control
base: main
head: feat/product-build-authority-v2
title: fix: reconcile Mission Control project authority
body:
## Summary

- consume and render Product Build Authority V2 sealed/refused dispositions
- separate project catalog, execution, runtime, and immutable receipt state
- remove the false Active Run terminal fallback
- pin and verify the final Setfarm Mission Control contracts

## Verification

- `npm test`
- `npm run build`
- `npm run check:setfarm-contract`
- render smoke for overview, pipeline, active run, projects, and run detail

## Authority boundary

Mission Control does not promote project registry state, runtime reachability, receipt state, or agent prose into Setfarm execution authority.
```

Expected: the Setfarm delivery owner revalidates the active claim/canonical worktree and alone stages any remaining approved path, commits, pushes, opens the draft PR, and marks it ready. The implementation/review worker performs none of those Git mutations. The owner returns the canonical PR URL and head SHA for read-only review.

- [ ] **Step 6: Complete independent review and checks**

Use the `requesting-code-review` skill. Inspect review threads and checks with:

```bash
set -euo pipefail
gh pr view --repo hikmetgulsesli/mission-control --json url,state,isDraft,mergeable,reviewDecision,statusCheckRollup
gh pr checks --repo hikmetgulsesli/mission-control --watch
```

For every actionable comment, use `github:gh-address-comments`, add a failing regression first, apply the smallest fix, and rerun focused plus full verification. Report the exact repair scope and gates to the same Setfarm delivery owner; only it commits/pushes the repair. Obtain a fresh clear review. Do not broadly rewrite code for vague comments.

- [ ] **Step 7: Authorize the Setfarm delivery owner to merge after clear review**

```bash
set -euo pipefail
gh pr view --repo hikmetgulsesli/mission-control --json url,state,isDraft,mergeable,reviewDecision,statusCheckRollup
```

Expected: read-only evidence is non-draft, mergeable, clear, and green. Report that gate to the Setfarm delivery owner. Only that owner merges/deletes the branch, synchronizes its claimed canonical worktree to `main`, and returns the merged SHA. The worker then read-only verifies the reported worktree is clean `main` and equals `origin/main` before Task 7.

---

### Task 7: Rebuild clean main, apply the guarded migration, and rebind all internal services safely

**Files:**

- No source edits.
- Runtime build output remains ignored/untracked.

**Interfaces:**

- Consumes: merged Mission Control `main`, merged Setfarm `main`, zero active ownership, and the reviewed pending bootstrap-handoff migration/digest delivered by Task 0.
- Produces: one guarded, verified, content-addressed bootstrap-handoff migration receipt before any restart plus clean-main builds loaded by the Setfarm spawner, Setfarm dashboard, and Mission Control processes, with healthy HTTP endpoints and exact process/build identity evidence.

- [ ] **Step 1: Prove there is no active ownership before restart**

Run with `SETFARM_PG_URL` already present in the operator shell:

```bash
set -euo pipefail
cd /Users/setrox/ai/setrox/setfarm
npm run acceptance:baseline-post-handoff -- zero-owner --json
```

Expected: the complete code-owned census is zero. If not, stop; do not restart or mutate rows/processes/worktrees.

- [ ] **Step 2: Rebuild Setfarm from clean main**

```bash
set -euo pipefail
cd /Users/setrox/ai/setrox/setfarm
A_SETFARM_BUILD_BRANCH="$(git branch --show-current)"
test "$A_SETFARM_BUILD_BRANCH" = "main"
A_SETFARM_BUILD_STATUS="$(git status --porcelain=v1 --untracked-files=all)"
test -z "$A_SETFARM_BUILD_STATUS"
npm ci
npm test
npm run build
node --test dist/cli/cli.test.js
A_SETFARM_POST_BUILD_STATUS="$(git status --porcelain=v1 --untracked-files=all)"
test -z "$A_SETFARM_POST_BUILD_STATUS"
```

Expected: all checks pass and the final status is empty.

- [ ] **Step 3: Rebuild Mission Control from clean main**

```bash
set -euo pipefail
cd /Users/setrox/ai/setrox/mission-control
A_MC_BUILD_BRANCH="$(git branch --show-current)"
test "$A_MC_BUILD_BRANCH" = "main"
A_MC_BUILD_STATUS="$(git status --porcelain=v1 --untracked-files=all)"
test -z "$A_MC_BUILD_STATUS"
npm ci
npm test
npm run build
A_MC_POST_BUILD_STATUS="$(git status --porcelain=v1 --untracked-files=all)"
test -z "$A_MC_POST_BUILD_STATUS"
```

Expected: PASS and clean status.

- [ ] **Step 3a: Fail fast by activating the exact A11 manifest before any A producer or migration**

```bash
set -euo pipefail
cd /Users/setrox/ai/setrox/setfarm
A_MANIFEST_ACTIVATION_JSON="$(npm run --silent acceptance:baseline-post-handoff -- \
  activate-owner-producer-manifest --json)"
A_MANIFEST_RECEIPT_REF="$(printf '%s\n' "$A_MANIFEST_ACTIVATION_JSON" | jq -er '.receiptRef')"
A_MANIFEST_RECEIPT_HASH="$(printf '%s\n' "$A_MANIFEST_ACTIVATION_JSON" | jq -er '.receiptHash')"
A_MANIFEST_SUCCESSOR_ACTIVATION_REF="$(printf '%s\n' "$A_MANIFEST_ACTIVATION_JSON" | jq -er '.successorActivationRef')"
A_MANIFEST_SUCCESSOR_ACTIVATION_HASH="$(printf '%s\n' "$A_MANIFEST_ACTIVATION_JSON" | jq -er '.successorActivationHash')"
A_MANIFEST_SUCCESSOR_HEAD_REF="$(printf '%s\n' "$A_MANIFEST_ACTIVATION_JSON" | jq -er '.successorHeadRef')"
A_MANIFEST_SUCCESSOR_HEAD_HASH="$(printf '%s\n' "$A_MANIFEST_ACTIVATION_JSON" | jq -er '.successorHeadHash')"
printf '%s\n' "$A_MANIFEST_ACTIVATION_JSON" | jq -e '
  .schema == "setfarm.internal-production-baseline-owner-producer-manifest-activation.v1" and
  .plan == "A" and
  .predecessorActivationRef == null and .predecessorActivationHash == null and
  .predecessorHeadRef == null and .predecessorHeadHash == null and
  (.manifestHash | test("^[0-9a-f]{64}$")) and
  (.sourceBuildAuthorityRef | type == "string") and
  (.sourceBuildAuthorityHash | test("^[0-9a-f]{64}$"))
' >/dev/null
A_MANIFEST_STATUS_JSON="$(npm run --silent acceptance:baseline-post-handoff -- \
  owner-producer-manifest-status --json)"
A_MANIFEST_STATUS_RECEIPT_REF="$(printf '%s\n' "$A_MANIFEST_STATUS_JSON" | jq -er '.receiptRef')"
A_MANIFEST_STATUS_RECEIPT_HASH="$(printf '%s\n' "$A_MANIFEST_STATUS_JSON" | jq -er '.receiptHash')"
A_MANIFEST_STATUS_SUCCESSOR_ACTIVATION_REF="$(printf '%s\n' "$A_MANIFEST_STATUS_JSON" | jq -er '.successorActivationRef')"
A_MANIFEST_STATUS_SUCCESSOR_ACTIVATION_HASH="$(printf '%s\n' "$A_MANIFEST_STATUS_JSON" | jq -er '.successorActivationHash')"
A_MANIFEST_STATUS_SUCCESSOR_HEAD_REF="$(printf '%s\n' "$A_MANIFEST_STATUS_JSON" | jq -er '.successorHeadRef')"
A_MANIFEST_STATUS_SUCCESSOR_HEAD_HASH="$(printf '%s\n' "$A_MANIFEST_STATUS_JSON" | jq -er '.successorHeadHash')"
test "$A_MANIFEST_STATUS_RECEIPT_REF" = "$A_MANIFEST_RECEIPT_REF"
test "$A_MANIFEST_STATUS_RECEIPT_HASH" = "$A_MANIFEST_RECEIPT_HASH"
test "$A_MANIFEST_STATUS_SUCCESSOR_ACTIVATION_REF" = "$A_MANIFEST_SUCCESSOR_ACTIVATION_REF"
test "$A_MANIFEST_STATUS_SUCCESSOR_ACTIVATION_HASH" = "$A_MANIFEST_SUCCESSOR_ACTIVATION_HASH"
test "$A_MANIFEST_STATUS_SUCCESSOR_HEAD_REF" = "$A_MANIFEST_SUCCESSOR_HEAD_REF"
test "$A_MANIFEST_STATUS_SUCCESSOR_HEAD_HASH" = "$A_MANIFEST_SUCCESSOR_HEAD_HASH"
printf '%s\n' "$A_MANIFEST_STATUS_JSON" | jq -e '
  .schema == "setfarm.internal-production-baseline-owner-producer-manifest-activation-status.v1" and
  .state == "active" and
  .predecessorActivationRef == null and .predecessorActivationHash == null and
  .predecessorHeadRef == null and .predecessorHeadHash == null and
  (.statusHash | test("^[0-9a-f]{64}$"))
' >/dev/null
```

Expected: the controller has freshly re-hashed exactly one A11 successor receipt/head tuple and one A wrapper receipt/status. A second identical invocation adopts those bytes. Any status other than `active`, unequal extracted pair, non-null predecessor, dirty/wrong-source-build authority, or generic-store ambiguity exits here; no migration guard, restart, source bootstrap, or A producer call is reached.

- [ ] **Step 4: Apply and freshly verify the migration before any restart**

Run the just-built CLI directly from clean Setfarm `main` while all three services still run their pre-rebind generations:

```bash
set -euo pipefail
cd /Users/setrox/ai/setrox/setfarm
A_PRE_MIGRATION_BRANCH="$(git branch --show-current)"
test "$A_PRE_MIGRATION_BRANCH" = "main"
A_PRE_MIGRATION_STATUS="$(git status --porcelain=v1 --untracked-files=all)"
test -z "$A_PRE_MIGRATION_STATUS"
A_PRE_MIGRATION_HEAD="$(git rev-parse HEAD)"
A_PRE_MIGRATION_ORIGIN="$(git rev-parse refs/remotes/origin/main)"
test "$A_PRE_MIGRATION_HEAD" = "$A_PRE_MIGRATION_ORIGIN"
A_PRE_MIGRATION_BUILD_SHA="$(jq -er '.sha' dist/BUILD_INFO.json)"
test "$A_PRE_MIGRATION_BUILD_SHA" = "$A_PRE_MIGRATION_HEAD"
npm run db:contract-spine:plan
npm run check:migration-digests
A_MIGRATION_GUARD_JSON="$(npm run --silent acceptance:baseline-post-handoff -- zero-owner --json)"
A_MIGRATION_GUARD_REF="$(printf '%s\n' "$A_MIGRATION_GUARD_JSON" | jq -er '.guardRef')"
A_MIGRATION_GUARD_HASH="$(printf '%s\n' "$A_MIGRATION_GUARD_JSON" | jq -er '.guardHash')"
A_MIGRATION_RECEIPT_JSON="$(npm run --silent acceptance:baseline-post-handoff -- \
  apply-bootstrap-handoff-migration \
  --guard-ref "$A_MIGRATION_GUARD_REF" \
  --guard-hash "$A_MIGRATION_GUARD_HASH" \
  --json)"
A_MIGRATION_RECEIPT_REF="$(printf '%s\n' "$A_MIGRATION_RECEIPT_JSON" | jq -er '.migrationReceiptRef')"
A_MIGRATION_RECEIPT_HASH="$(printf '%s\n' "$A_MIGRATION_RECEIPT_JSON" | jq -er '.migrationReceiptHash')"
printf '%s\n' "$A_MIGRATION_RECEIPT_JSON" | jq -e '
  .schema == "setfarm.internal-production-baseline-bootstrap-handoff-migration-receipt.v1" and
  .migrationId == "contract-spine-bootstrap-main-claim-handoff-v1" and
  .migrationSourceSha == $sourceSha and
  (.migrationImplementationBlobHash | test("^[0-9a-f]{40}([0-9a-f]{24})?$")) and
  (.orderedStatementsHash | test("^[0-9a-f]{64}$")) and
  (.namedMigrationDigestEntryHash | test("^[0-9a-f]{64}$")) and
  (.migrationDigest | test("^[0-9a-f]{64}$")) and
  (.schemaProjectionHash | test("^[0-9a-f]{64}$")) and
  .planStatus == "exact-pending-migration" and
  .applyStatus == "applied" and
  .verifyStatus == "verified" and
  .bootstrapHandoffOperationTablePresent == true and
  .bootstrapHandoffOperationIdUnique == true and
  .bootstrapHandoffClaimIdUnique == true and
  .terminalReceiptPairColumnsPresent == true
' --arg sourceSha "$A_PRE_MIGRATION_HEAD" >/dev/null
A_MIGRATION_REOPENED_JSON="$(npm run --silent acceptance:baseline-post-handoff -- resolve-bootstrap-handoff-migration --json)"
printf '%s\n' "$A_MIGRATION_REOPENED_JSON" | jq -e \
  --arg receiptRef "$A_MIGRATION_RECEIPT_REF" \
  --arg receiptHash "$A_MIGRATION_RECEIPT_HASH" \
  '.migrationReceiptRef == $receiptRef and .migrationReceiptHash == $receiptHash and .verifyStatus == "verified"' \
  >/dev/null
npm run db:contract-spine:verify
A_POST_MIGRATION_STATUS="$(git status --porcelain=v1 --untracked-files=all)"
test -z "$A_POST_MIGRATION_STATUS"
A_POST_MIGRATION_HEAD="$(git rev-parse HEAD)"
test "$A_POST_MIGRATION_HEAD" = "$A_PRE_MIGRATION_HEAD"
```

Expected: the pending migration is applied exactly once at the exact `migrationSourceSha` and freshly reopened before any service restart, while every old service generation remains untouched. The command uses the new clean build as a database client only; it does not require a newly loaded daemon, endpoint, listener, or runtime module. The receipt binds only the dedicated immutable bootstrap-migration implementation Git blob, ordered-statements hash, named digest-entry hash/digest, and verified schema projection; unrelated append-only aggregate registry/digest entries remain valid. Every restart/sequence entry point now resolves and hash-binds this exact pair internally; later descendant sources must prove ancestry and byte-identical blob/digest/schema identities. A missing/corrupt/unverified, non-ancestral, or blob/digest/schema-mismatched receipt blocks before a restart reservation or side effect.

- [ ] **Step 5: Rebind the spawner, dashboard, and Mission Control to the verified builds**

```bash
set -euo pipefail
readonly A_SETFARM_ROOT=/Users/setrox/ai/setrox/setfarm
readonly A_MC_ROOT=/Users/setrox/ai/setrox/mission-control
A_UID="$(id -u)"
readonly A_UID
cd "$A_SETFARM_ROOT"

A_REBIND_MIGRATION_JSON="$(npm run --silent acceptance:baseline-post-handoff -- resolve-bootstrap-handoff-migration --json)"
A_REBIND_MIGRATION_REF="$(printf '%s\n' "$A_REBIND_MIGRATION_JSON" | jq -er '.migrationReceiptRef')"
A_REBIND_MIGRATION_HASH="$(printf '%s\n' "$A_REBIND_MIGRATION_JSON" | jq -er '.migrationReceiptHash')"
A_REBIND_MIGRATION_SCHEMA_HASH="$(printf '%s\n' "$A_REBIND_MIGRATION_JSON" | jq -er '.schemaProjectionHash')"

A_SETFARM_SHA="$(git -C "$A_SETFARM_ROOT" rev-parse HEAD)"
readonly A_SETFARM_SHA
A_MC_SHA="$(git -C "$A_MC_ROOT" rev-parse HEAD)"
readonly A_MC_SHA
A_SETFARM_BUILD_INFO_SHA="$(jq -er '.sha' "$A_SETFARM_ROOT/dist/BUILD_INFO.json")"
test "$A_SETFARM_BUILD_INFO_SHA" = "$A_SETFARM_SHA"
A_SETFARM_BUILD_INFO_BRANCH="$(jq -er '.branch' "$A_SETFARM_ROOT/dist/BUILD_INFO.json")"
test "$A_SETFARM_BUILD_INFO_BRANCH" = "main"
A_SETFARM_BUILD_INFO_DIRTY="$(jq -er '.dirty' "$A_SETFARM_ROOT/dist/BUILD_INFO.json")"
test "$A_SETFARM_BUILD_INFO_DIRTY" = "false"
A_SPAWNER_BUILD_HASH="$(shasum -a 256 "$A_SETFARM_ROOT/dist/spawner.js" | awk '{print $1}')"
readonly A_SPAWNER_BUILD_HASH
A_DASHBOARD_BUILD_HASH="$(shasum -a 256 "$A_SETFARM_ROOT/dist/server/daemon.js" | awk '{print $1}')"
readonly A_DASHBOARD_BUILD_HASH
A_MC_BUILD_HASH="$(shasum -a 256 "$A_MC_ROOT/dist-server/index.js" | awk '{print $1}')"
readonly A_MC_BUILD_HASH
A_SETFARM_INSTALL_LINK="$(readlink /Users/setrox/.local/bin/setfarm)"
test "$A_SETFARM_INSTALL_LINK" = "$A_SETFARM_ROOT/dist/cli/cli.js"

A_OLD_SPAWNER_PID="$(pgrep -f "$A_SETFARM_ROOT/dist/spawner\\.js" | sort -u)"
readonly A_OLD_SPAWNER_PID
A_OLD_DASHBOARD_PID="$(lsof -nP -iTCP:3333 -sTCP:LISTEN -t | sort -u)"
readonly A_OLD_DASHBOARD_PID
A_OLD_MC_PID="$(lsof -nP -iTCP:3080 -sTCP:LISTEN -t | sort -u)"
readonly A_OLD_MC_PID
A_OLD_SPAWNER_PID_COUNT="$(printf '%s\n' "$A_OLD_SPAWNER_PID" | sed '/^$/d' | wc -l | tr -d ' ')"
test "$A_OLD_SPAWNER_PID_COUNT" = "1"
A_OLD_DASHBOARD_PID_COUNT="$(printf '%s\n' "$A_OLD_DASHBOARD_PID" | sed '/^$/d' | wc -l | tr -d ' ')"
test "$A_OLD_DASHBOARD_PID_COUNT" = "1"
A_OLD_MC_PID_COUNT="$(printf '%s\n' "$A_OLD_MC_PID" | sed '/^$/d' | wc -l | tr -d ' ')"
test "$A_OLD_MC_PID_COUNT" = "1"

A_LIVE_RESTART_SEQUENCE="$(
  npm run --silent acceptance:baseline-post-handoff -- \
    resume-restart-sequence --intent live-rebind --json
)"
readonly A_LIVE_RESTART_SEQUENCE
A_LIVE_RESTART_SEQUENCE_KEYS="$(printf '%s\n' "$A_LIVE_RESTART_SEQUENCE" | jq -cer 'keys')"
test "$A_LIVE_RESTART_SEQUENCE_KEYS" = '["sequenceHash","sequenceRef"]'
A_LIVE_RESTART_SEQUENCE_REF="$(printf '%s\n' "$A_LIVE_RESTART_SEQUENCE" | jq -er '.sequenceRef')"
readonly A_LIVE_RESTART_SEQUENCE_REF
A_LIVE_RESTART_SEQUENCE_HASH="$(printf '%s\n' "$A_LIVE_RESTART_SEQUENCE" | jq -er '.sequenceHash')"
readonly A_LIVE_RESTART_SEQUENCE_HASH
A_LIVE_RESTART_STATUS="$(
  npm run --silent acceptance:baseline-post-handoff -- \
    restart-sequence-status --intent live-rebind --json
)"
readonly A_LIVE_RESTART_STATUS
A_LIVE_RESTART_STATUS_STATE="$(printf '%s\n' "$A_LIVE_RESTART_STATUS" | jq -er '.state')"
test "$A_LIVE_RESTART_STATUS_STATE" = "completed"
A_LIVE_RESTART_STATUS_SEQUENCE_REF="$(printf '%s\n' "$A_LIVE_RESTART_STATUS" | jq -er '.sequenceRef')"
test "$A_LIVE_RESTART_STATUS_SEQUENCE_REF" = "$A_LIVE_RESTART_SEQUENCE_REF"
A_LIVE_RESTART_STATUS_SEQUENCE_HASH="$(printf '%s\n' "$A_LIVE_RESTART_STATUS" | jq -er '.sequenceHash')"
test "$A_LIVE_RESTART_STATUS_SEQUENCE_HASH" = "$A_LIVE_RESTART_SEQUENCE_HASH"
A_LIVE_RESTART_STATUS_MIGRATION_REF="$(printf '%s\n' "$A_LIVE_RESTART_STATUS" | jq -er '.migrationReceiptRef')"
test "$A_LIVE_RESTART_STATUS_MIGRATION_REF" = "$A_REBIND_MIGRATION_REF"
A_LIVE_RESTART_STATUS_MIGRATION_HASH="$(printf '%s\n' "$A_LIVE_RESTART_STATUS" | jq -er '.migrationReceiptHash')"
test "$A_LIVE_RESTART_STATUS_MIGRATION_HASH" = "$A_REBIND_MIGRATION_HASH"
A_LIVE_RESTART_STATUS_MIGRATION_SCHEMA_HASH="$(printf '%s\n' "$A_LIVE_RESTART_STATUS" | jq -er '.migrationSchemaProjectionHash')"
test "$A_LIVE_RESTART_STATUS_MIGRATION_SCHEMA_HASH" = "$A_REBIND_MIGRATION_SCHEMA_HASH"
curl -fsS --retry 20 --retry-delay 1 http://127.0.0.1:3080/api/health | jq -e '.status == "healthy"'
curl -fsS --max-time 30 http://127.0.0.1:3080/api/projects | jq -e 'type == "array"'
curl -fsS --retry 20 --retry-delay 1 http://127.0.0.1:3333/ >/dev/null

A_NEW_SPAWNER_PID="$(pgrep -f "$A_SETFARM_ROOT/dist/spawner\\.js" | sort -u)"
readonly A_NEW_SPAWNER_PID
A_NEW_DASHBOARD_PID="$(lsof -nP -iTCP:3333 -sTCP:LISTEN -t | sort -u)"
readonly A_NEW_DASHBOARD_PID
A_NEW_MC_PID="$(lsof -nP -iTCP:3080 -sTCP:LISTEN -t | sort -u)"
readonly A_NEW_MC_PID
A_NEW_SPAWNER_PID_COUNT="$(printf '%s\n' "$A_NEW_SPAWNER_PID" | sed '/^$/d' | wc -l | tr -d ' ')"
test "$A_NEW_SPAWNER_PID_COUNT" = "1"
A_NEW_DASHBOARD_PID_COUNT="$(printf '%s\n' "$A_NEW_DASHBOARD_PID" | sed '/^$/d' | wc -l | tr -d ' ')"
test "$A_NEW_DASHBOARD_PID_COUNT" = "1"
A_NEW_MC_PID_COUNT="$(printf '%s\n' "$A_NEW_MC_PID" | sed '/^$/d' | wc -l | tr -d ' ')"
test "$A_NEW_MC_PID_COUNT" = "1"
test "$A_NEW_SPAWNER_PID" != "$A_OLD_SPAWNER_PID"
test "$A_NEW_DASHBOARD_PID" != "$A_OLD_DASHBOARD_PID"
test "$A_NEW_MC_PID" != "$A_OLD_MC_PID"
ps -p "$A_NEW_SPAWNER_PID" -o command= | rg -x ".*$A_SETFARM_ROOT/dist/spawner\\.js.*"
ps -p "$A_NEW_DASHBOARD_PID" -o command= | rg -x ".*$A_SETFARM_ROOT/dist/server/daemon\\.js 3333"
ps -p "$A_NEW_MC_PID" -o command= | rg -x ".*$A_MC_ROOT/dist-server/index\\.js"
A_OBSERVED_SPAWNER_BUILD_HASH="$(shasum -a 256 "$A_SETFARM_ROOT/dist/spawner.js" | awk '{print $1}')"
test "$A_OBSERVED_SPAWNER_BUILD_HASH" = "$A_SPAWNER_BUILD_HASH"
A_OBSERVED_DASHBOARD_BUILD_HASH="$(shasum -a 256 "$A_SETFARM_ROOT/dist/server/daemon.js" | awk '{print $1}')"
test "$A_OBSERVED_DASHBOARD_BUILD_HASH" = "$A_DASHBOARD_BUILD_HASH"
A_OBSERVED_MC_BUILD_HASH="$(shasum -a 256 "$A_MC_ROOT/dist-server/index.js" | awk '{print $1}')"
test "$A_OBSERVED_MC_BUILD_HASH" = "$A_MC_BUILD_HASH"
npm run acceptance:baseline-post-handoff -- zero-owner --json
npm run acceptance:baseline-post-handoff -- runtime-source \
  --setfarm-sha "$A_SETFARM_SHA" \
  --mission-control-sha "$A_MC_SHA" \
  --json
printf '%s\n' \
  "setfarmSha=$A_SETFARM_SHA spawnerPid=$A_NEW_SPAWNER_PID spawnerBuildHash=$A_SPAWNER_BUILD_HASH" \
  "setfarmSha=$A_SETFARM_SHA dashboardPid=$A_NEW_DASHBOARD_PID dashboardBuildHash=$A_DASHBOARD_BUILD_HASH" \
  "missionControlSha=$A_MC_SHA missionControlPid=$A_NEW_MC_PID missionControlBuildHash=$A_MC_BUILD_HASH"
```

Expected: before its first reservation, the resolved `live-rebind` sequence freshly reopens and binds the exact Task 7 migration ref/hash/schema projection. It then proves each exact fresh zero-owner guard was durably retained before its restart, each migration-bound composite pair was freshly resolved and predecessor-CAS advanced in spawner-to-dashboard-to-Mission-Control order, and the final zero-owner census settled before completion. The review packet/private live handoff binds `A_LIVE_RESTART_SEQUENCE_REF`, `A_LIVE_RESTART_SEQUENCE_HASH`, the migration identity, and the resolved receipt's exact three ordered authority pairs. Every daemon PID changes, every new command names the canonical built entrypoint, the entrypoint hashes remain those measured from clean `main`, and both HTTP services recover. Only the bounded sequence/status evidence and three identity lines are retained; no guard capability, raw restart body, or LaunchAgent environment dictionary is captured.

- [ ] **Step 6: Prove the active count is reconciled**

```bash
set -euo pipefail
umask 077
A_CENSUS_TMP="$(mktemp -d)"
chmod 0700 "$A_CENSUS_TMP"
test -d "$A_CENSUS_TMP" && test ! -L "$A_CENSUS_TMP"
test -n "$A_CENSUS_TMP" && test "$A_CENSUS_TMP" != "/"
trap 'rm -rf -- "$A_CENSUS_TMP"' EXIT
readonly A_RUNS_JSON="$A_CENSUS_TMP/runs.json"
readonly A_PROJECTS_JSON="$A_CENSUS_TMP/projects.json"
readonly A_ACTIVE_STATUSES_JSON="$A_CENSUS_TMP/operational-active-statuses.json"
readonly A_DB_IDS="$A_CENSUS_TMP/db-active-run-ids.txt"
readonly A_API_IDS="$A_CENSUS_TMP/api-active-run-ids.txt"
readonly A_PROJECT_IDS="$A_CENSUS_TMP/project-active-run-ids.txt"
npm run --silent contract:operational-active-run-status -- --json > "$A_ACTIVE_STATUSES_JSON"
curl -fsS http://127.0.0.1:3080/api/runs > "$A_RUNS_JSON"
curl -fsS --max-time 30 http://127.0.0.1:3080/api/projects > "$A_PROJECTS_JSON"
chmod 0600 "$A_ACTIVE_STATUSES_JSON" "$A_RUNS_JSON" "$A_PROJECTS_JSON"
test ! -L "$A_ACTIVE_STATUSES_JSON"
A_ACTIVE_STATUSES_LINK_COUNT="$(stat -f '%l' "$A_ACTIVE_STATUSES_JSON")"
test "$A_ACTIVE_STATUSES_LINK_COUNT" = "1"
test ! -L "$A_RUNS_JSON"
A_RUNS_LINK_COUNT="$(stat -f '%l' "$A_RUNS_JSON")"
test "$A_RUNS_LINK_COUNT" = "1"
test ! -L "$A_PROJECTS_JSON"
A_PROJECTS_LINK_COUNT="$(stat -f '%l' "$A_PROJECTS_JSON")"
test "$A_PROJECTS_LINK_COUNT" = "1"
jq -e '
  .schema == "setfarm.operational-active-run-status.v1" and
  .statuses == ["running", "resuming", "cancelling", "failing"] and
  (.contractHash | test("^[0-9a-f]{64}$"))
' "$A_ACTIVE_STATUSES_JSON" >/dev/null
A_ACTIVE_STATUSES="$(jq -cer '.statuses' "$A_ACTIVE_STATUSES_JSON")"
readonly A_ACTIVE_STATUSES
jq -e 'type == "array"' "$A_RUNS_JSON" >/dev/null
jq -e 'type == "array"' "$A_PROJECTS_JSON" >/dev/null
jq -e --argjson activeStatuses "$A_ACTIVE_STATUSES" '
  all(.[];
    (.status as $status |
      (($activeStatuses | index($status)) != null) and
      .operationalActive == true and
      (.id | type == "string" and length > 0)))
' \
  "$A_RUNS_JSON" >/dev/null
jq -e --argjson activeStatuses "$A_ACTIVE_STATUSES" '
  all(.[];
    (.execution.active != true) or
    (.execution.runStatus as $status |
      ($activeStatuses | index($status)) != null and
      .execution.state == $status and
      (.execution.runId | type == "string" and length > 0)))
' \
  "$A_PROJECTS_JSON" >/dev/null
PGDATABASE="$SETFARM_PG_URL" psql -X -v ON_ERROR_STOP=1 -v active_statuses="$A_ACTIVE_STATUSES" -Atc \
  "SELECT id FROM runs WHERE status IN (SELECT jsonb_array_elements_text(:'active_statuses'::jsonb)) ORDER BY id" \
  > "$A_DB_IDS"
jq -r --argjson activeStatuses "$A_ACTIVE_STATUSES" \
  '.[] | select(.status as $status | ($activeStatuses | index($status)) != null) | .id' \
  "$A_RUNS_JSON" | sort > "$A_API_IDS"
jq -r '.[] | select(.execution.active == true) | .execution.runId' \
  "$A_PROJECTS_JSON" | sort > "$A_PROJECT_IDS"
chmod 0600 "$A_DB_IDS" "$A_API_IDS" "$A_PROJECT_IDS"
A_PROJECT_ID_COUNT="$(wc -l < "$A_PROJECT_IDS" | tr -d ' ')"
A_UNIQUE_PROJECT_ID_COUNT="$(sort -u "$A_PROJECT_IDS" | wc -l | tr -d ' ')"
test "$A_PROJECT_ID_COUNT" = "$A_UNIQUE_PROJECT_ID_COUNT"
cmp -s "$A_DB_IDS" "$A_API_IDS"
cmp -s "$A_DB_IDS" "$A_PROJECT_IDS"
A_DB_ID_COUNT="$(wc -l < "$A_DB_IDS" | tr -d ' ')"
test "$A_DB_ID_COUNT" = "0"
rm -rf -- "$A_CENSUS_TMP"
trap - EXIT
```

Expected: the code-owned contract JSON, database, `/api/runs`, and project projection use the same exact operational-active tuple and expose the same empty set of active run IDs. Every API row preserves its exact current transition state and carries `operationalActive:true`; every active project has equal `execution.state` and `execution.runStatus`. Active project bindings are one-to-one: two active projects may not carry the same `execution.runId`, even when their raw registry records differ. A targeted shell regression executes every npm JSON producer that feeds a redirection or `jq` through `npm run --silent` and fails if an npm banner precedes the JSON.

- [ ] **Step 7: Verify one intended listener/daemon owner per service**

```bash
set -euo pipefail
A_MC_LISTENER_COUNT="$(lsof -nP -iTCP:3080 -sTCP:LISTEN -t | sort -u | wc -l | tr -d ' ')"
test "$A_MC_LISTENER_COUNT" = "1"
A_DASHBOARD_LISTENER_COUNT="$(lsof -nP -iTCP:3333 -sTCP:LISTEN -t | sort -u | wc -l | tr -d ' ')"
test "$A_DASHBOARD_LISTENER_COUNT" = "1"
A_GATEWAY_LISTENER_COUNT="$(lsof -nP -iTCP:18789 -sTCP:LISTEN -t | sort -u | wc -l | tr -d ' ')"
test "$A_GATEWAY_LISTENER_COUNT" = "1"
A_SPAWNER_PROCESS_COUNT="$(pgrep -f '/setfarm/dist/spawner\.js' | sort -u | wc -l | tr -d ' ')"
test "$A_SPAWNER_PROCESS_COUNT" = "1"
setfarm dashboard status
setfarm spawner status
```

Expected: one unique listener owner for each port, one spawner process, and both Setfarm status commands report running. The transient LaunchAgent watchdog command is not counted as a second daemon.

---

### Task 8: Take the baseline backup and record the acceptance packet

**Files:**

- Create: `setfarm/docs/review-packets/2026-08-13-internal-production-baseline.md`
- Create outside Git: `/Users/setrox/ai/setrox/data/backups/internal-production-baseline/setfarm.dump`
- Create outside Git: `/Users/setrox/ai/setrox/data/backups/internal-production-baseline/setfarm.list.txt`
- Create outside Git: `/Users/setrox/ai/setrox/data/backups/internal-production-baseline/setfarm.sha256`

**Interfaces:**

- Consumes: clean-main repositories, healthy services, matching active censuses, Task 7's already applied and restart-bound exact bootstrap-handoff migration receipt, and the current PostgreSQL schema.
- Produces: one crash-resumable authenticated backup receipt and a bounded Markdown summary that binds, but does not reapply, the already verified migration and does not embed the dump or secrets.

- [ ] **Step 1: Freshly resolve the applied migration and run read-only authority audits**

```bash
set -euo pipefail
cd /Users/setrox/ai/setrox/setfarm
npm run db:contract-spine:plan
npm run check:migration-digests
A_MIGRATION_RECEIPT_JSON="$(npm run --silent acceptance:baseline-post-handoff -- resolve-bootstrap-handoff-migration --json)"
printf '%s\n' "$A_MIGRATION_RECEIPT_JSON" | jq -e '
  .schema == "setfarm.internal-production-baseline-bootstrap-handoff-migration-receipt.v1" and
  .migrationId == "contract-spine-bootstrap-main-claim-handoff-v1" and
  (.migrationImplementationBlobHash | test("^[0-9a-f]{40}([0-9a-f]{24})?$")) and
  (.orderedStatementsHash | test("^[0-9a-f]{64}$")) and
  (.namedMigrationDigestEntryHash | test("^[0-9a-f]{64}$")) and
  (.migrationDigest | test("^[0-9a-f]{64}$")) and
  (.schemaProjectionHash | test("^[0-9a-f]{64}$")) and
  .planStatus == "exact-pending-migration" and
  .applyStatus == "applied" and
  .verifyStatus == "verified" and
  .bootstrapHandoffOperationTablePresent == true and
  .bootstrapHandoffOperationIdUnique == true and
  .bootstrapHandoffClaimIdUnique == true and
  .terminalReceiptPairColumnsPresent == true and
  (.migrationReceiptRef | startswith("setfarm://internal-production/")) and
  (.migrationReceiptHash | test("^[0-9a-f]{64}$"))
' >/dev/null
npm run db:contract-spine:verify
npm run db:contract-spine:audit-current-authority-ledgers
npm run db:contract-spine:audit-artifact-batches
npm run db:contract-spine:audit-artifact-store-authority-ledger
npm run db:contract-spine:audit-platform-release-store-records
```

Expected: Task 8 performs no migration or other schema mutation. The zero-input command follows only the fixed one-migration terminal locator, freshly reopens Task 7's strict receipt, repeats its digest/schema/apply/verify relations, and returns the exact pair already bound by the `live-rebind` sequence and three restart authorities. The schema and every applicable authority audit pass. Missing/corrupt/drifted authority fails closed; no guard is minted and no rollback or second migration transaction occurs.

- [ ] **Step 2: Create and inspect a custom-format PostgreSQL backup**

```bash
set -euo pipefail
A_BACKUP_RESULT="$(npm run --silent acceptance:baseline-post-handoff -- backup --json)"
printf '%s\n' "$A_BACKUP_RESULT" | jq -e '
  .schema == "setfarm.internal-production-baseline-backup-receipt.v1" and
  (.attemptHash | test("^[0-9a-f]{64}$")) and
  (.journalHash | test("^[0-9a-f]{64}$")) and
  (.dumpHash | test("^[0-9a-f]{64}$")) and
  (.listHash | test("^[0-9a-f]{64}$")) and
  (.checksumFileHash | test("^[0-9a-f]{64}$")) and
  (.targetPaths == [
    "/Users/setrox/ai/setrox/data/backups/internal-production-baseline/setfarm.dump",
    "/Users/setrox/ai/setrox/data/backups/internal-production-baseline/setfarm.list.txt",
    "/Users/setrox/ai/setrox/data/backups/internal-production-baseline/setfarm.sha256"
  ]) and
  .canonicalRef == "setfarm://internal-production/baseline/backup" and
  (.receiptHash | test("^[0-9a-f]{64}$"))
' >/dev/null
A_BACKUP_RECEIPT_HASH="$(printf '%s\n' "$A_BACKUP_RESULT" | jq -er '.receiptHash')"
npm run --silent acceptance:baseline-post-handoff -- backup --json | jq -e \
  --arg hash "$A_BACKUP_RECEIPT_HASH" \
  '.receiptHash == $hash' >/dev/null
```

Expected: the code-owned command creates or resumes one journaled attempt, `pg_restore --list` has authenticated the custom archive, all three fixed targets are exact regular mode-`0600` link-count-one files, and a fresh invocation returns the byte-identical receipt. A crash in any hard-link window adopts only the authenticated contiguous prefix and completes; a gap, journal drift, missing durable attempt, or mismatched/racing target fails closed without overwrite. Do not add the targets, attempt journal, manifest, or receipt to Git.

- [ ] **Step 3: Capture exact bounded evidence for the packet**

Capture these commands without exposing environment values:

```bash
set -euo pipefail
git -C /Users/setrox/ai/setrox/setfarm rev-parse HEAD
git -C /Users/setrox/ai/setrox/mission-control rev-parse HEAD
jq -r '.name + " " + .version' /Users/setrox/ai/setrox/setfarm/package.json
jq -r '.name + " " + .version' /Users/setrox/ai/setrox/mission-control/package.json
jq -r '.sha, .branch, .dirty' /Users/setrox/ai/setrox/setfarm/dist/BUILD_INFO.json
A_PACKET_SETFARM_SHA="$(git -C /Users/setrox/ai/setrox/setfarm rev-parse HEAD)"
jq -e --arg sha "$A_PACKET_SETFARM_SHA" \
  '.sha == $sha and .branch == "main" and .dirty == false' \
  /Users/setrox/ai/setrox/setfarm/dist/BUILD_INFO.json
shasum -a 256 /Users/setrox/ai/setrox/setfarm/dist/spawner.js
shasum -a 256 /Users/setrox/ai/setrox/setfarm/dist/server/daemon.js
shasum -a 256 /Users/setrox/ai/setrox/mission-control/dist-server/index.js
A_PACKET_SPAWNER_PID="$(pgrep -f '/Users/setrox/ai/setrox/setfarm/dist/spawner\.js')"
ps -p "$A_PACKET_SPAWNER_PID" -o pid=,command=
A_PACKET_DASHBOARD_PID="$(lsof -nP -iTCP:3333 -sTCP:LISTEN -t)"
ps -p "$A_PACKET_DASHBOARD_PID" -o pid=,command=
A_PACKET_MC_PID="$(lsof -nP -iTCP:3080 -sTCP:LISTEN -t)"
ps -p "$A_PACKET_MC_PID" -o pid=,command=
jq -r '.producerCommit, (.artifacts[] | [.vendoredPath,.sha256] | @tsv)' /Users/setrox/ai/setrox/mission-control/contracts/vendor/setfarm/mission-control-contracts.v1.lock.json
pg_dump --version
pg_restore --version
lsof -nP -iTCP:3080 -sTCP:LISTEN
lsof -nP -iTCP:3333 -sTCP:LISTEN
lsof -nP -iTCP:18789 -sTCP:LISTEN
curl -fsS http://127.0.0.1:3080/api/health | jq -e '.status == "healthy"'
curl -fsS http://127.0.0.1:3333/ >/dev/null
curl -fsS http://127.0.0.1:18789/ >/dev/null
```

- [ ] **Step 4: Obtain the Setfarm-owned documentation worktree and write the bounded packet**

First report the exact requested branch `docs/internal-production-baseline`, base SHA, one intended output path, and completed live gates to the owning Setfarm documentation claim. Only that owner creates/reserves the branch and canonical writing worktree. The worker receives that worktree path and validates it without switching or creating a branch:

```bash
set -euo pipefail
readonly A_SETFARM_ROOT=/Users/setrox/ai/setrox/setfarm
readonly A_MC_ROOT=/Users/setrox/ai/setrox/mission-control
A_DOCS_WORKTREE="$(git rev-parse --show-toplevel)"
readonly A_DOCS_WORKTREE
test "$A_DOCS_WORKTREE" != "$A_SETFARM_ROOT"
A_DOCS_SETFARM_BRANCH="$(git -C "$A_SETFARM_ROOT" branch --show-current)"
test "$A_DOCS_SETFARM_BRANCH" = "main"
A_SETFARM_DOCS_STATUS="$(git -C "$A_SETFARM_ROOT" status --porcelain=v1 --untracked-files=all)"
test -z "$A_SETFARM_DOCS_STATUS"
A_DOCS_SETFARM_HEAD="$(git -C "$A_SETFARM_ROOT" rev-parse HEAD)"
A_DOCS_SETFARM_ORIGIN_MAIN="$(git -C "$A_SETFARM_ROOT" rev-parse origin/main)"
test "$A_DOCS_SETFARM_HEAD" = "$A_DOCS_SETFARM_ORIGIN_MAIN"
A_DOCS_MC_BRANCH="$(git -C "$A_MC_ROOT" branch --show-current)"
test "$A_DOCS_MC_BRANCH" = "main"
A_MC_DOCS_STATUS="$(git -C "$A_MC_ROOT" status --porcelain=v1 --untracked-files=all)"
test -z "$A_MC_DOCS_STATUS"
cd "$A_DOCS_WORKTREE"
A_DOCS_CLAIM_BRANCH="$(git branch --show-current)"
test "$A_DOCS_CLAIM_BRANCH" = "docs/internal-production-baseline"
A_DOCS_CLAIM_MERGE_BASE="$(git merge-base HEAD origin/main)"
A_DOCS_CANONICAL_ORIGIN_MAIN="$(git -C "$A_SETFARM_ROOT" rev-parse origin/main)"
test "$A_DOCS_CLAIM_MERGE_BASE" = "$A_DOCS_CANONICAL_ORIGIN_MAIN"
```

Then use `apply_patch` to create the review packet with these concrete sections populated from Step 3 outputs:

1. `Repository identities`
2. `Package and build identities`
3. `Setfarm contract vendor lock`
4. `Migration and authority audit results`
5. `PostgreSQL backup canonical receipt ref/hash, fixed paths, SHA-256, archive-list result, pg_dump version, pg_restore version`
6. `Active run/claim/runtime/completion/effect/outbox census`
7. `Mission Control project reconciliation census`
8. `Service PIDs and listening ports`
9. `HTTP health results`
10. `External distribution explicitly deferred`

Do not paste a database URL, token, LaunchAgent environment dictionary, raw database row payload, or complete log.

- [ ] **Step 5: Review the packet and report the Setfarm-owned handoff**

The documentation branch already exists from Step 4 and was created only after the Mission Control PR was merged:

```bash
set -euo pipefail
readonly A_SETFARM_ROOT=/Users/setrox/ai/setrox/setfarm
A_DOCS_WORKTREE="$(git rev-parse --show-toplevel)"
readonly A_DOCS_WORKTREE
readonly A_PACKET_PATH=docs/review-packets/2026-08-13-internal-production-baseline.md
test "$A_DOCS_WORKTREE" != "$A_SETFARM_ROOT"
cd "$A_DOCS_WORKTREE"
A_PACKET_CLAIM_BRANCH="$(git branch --show-current)"
test "$A_PACKET_CLAIM_BRANCH" = "docs/internal-production-baseline"
A_PACKET_PATH_STATUS="$(git status --porcelain=v1 --untracked-files=all -- "$A_PACKET_PATH")"
test "$A_PACKET_PATH_STATUS" = "?? $A_PACKET_PATH"
if A_PACKET_DIFF_CHECK="$(git diff --no-index --check /dev/null "$A_PACKET_PATH" 2>&1)"; then
  A_PACKET_DIFF_CHECK_STATUS=0
else
  A_PACKET_DIFF_CHECK_STATUS=$?
fi
test "$A_PACKET_DIFF_CHECK_STATUS" = "1"
test -z "$A_PACKET_DIFF_CHECK"
if A_PACKET_SECRET_SCAN="$(rg -n -e 'postgres(?:ql)?://' -e 'SETFARM_OPERATIONAL_WRITE_TOKEN' -e 'BEGIN (RSA|OPENSSH|EC) PRIVATE KEY' -- "$A_PACKET_PATH" 2>&1)"; then
  A_PACKET_SECRET_SCAN_STATUS=0
else
  A_PACKET_SECRET_SCAN_STATUS=$?
fi
test "$A_PACKET_SECRET_SCAN_STATUS" = "1"
test -z "$A_PACKET_SECRET_SCAN"
git status --short -- "$A_PACKET_PATH"
```

Expected: the exact untracked documentation path is reported; the explicit no-index whitespace check emits nothing and returns the expected diff status `1`; the separate exact-file secret scan emits nothing and returns its expected no-match status `1`. The secret result is never masked by `git diff --no-index` under `pipefail`, and the empty tracked `git diff` is not treated as evidence. Use authorized subject/title `docs(ops): record internal production baseline` and the bounded PR body already specified by this plan. The owning Setfarm documentation claim alone stages, commits, pushes, and opens the documentation-only PR; it returns the PR URL for independent read-only review.

- [ ] **Step 6: Review and authorize the Setfarm owner to merge**

Use `requesting-code-review`, resolve every Critical/High/Medium finding, then:

```bash
set -euo pipefail
gh pr checks --repo hikmetgulsesli/setfarm --watch
gh pr view --repo hikmetgulsesli/setfarm --json url,state,isDraft,mergeable,reviewDecision,statusCheckRollup
```

Expected: checks and independent review are clear. The worker reports merge authorization to the Setfarm documentation owner. Only that owner merges/deletes the branch and synchronizes the canonical worktree; after it returns the merged SHA, read-only checks must prove both repositories are clean `main` equal to `origin/main`. Backup files remain outside Git.

- [ ] **Step 7: Rebuild and rebind the final documentation SHA**

Both `verifyCurrentBaselinePostHandoffReceiptV1()` and `resolveHistoricalBaselinePostHandoffReceiptV1()` treat copied restart fields as identity snapshots only. Each freshly resolves the exact migration pair, sequence ref/hash, and then each of its three ordered composite authority pairs from the fixed stores, authenticates every nested schema/hash/ref, and rechecks migration-source ancestry plus dedicated implementation/ordered-statements/named-entry/digest/schema/apply/verify while ignoring unrelated appended registry entries, `documentation-rollback`, spawner/dashboard/Mission-Control service/action order, full projection-chain continuity, ordered advance hashes, final projection/census, and Setfarm/Mission Control source/build equality to the outer receipt. Current verification additionally requires live equality; historical verification permits legitimate descendant HEADs but still requires every persisted nested authority and recorded ancestry. Missing, corrupt, swapped, duplicated, structurally cloned, unindexed, or store-position-drifted migration/sequence/composite evidence blocks; neither resolver trusts copied hashes or scans for replacements.

The tracked packet cannot contain the SHA of the commit that contains itself. After the owner returns the merged documentation SHA, record the pre-packet operational source SHA and the final docs merge SHA as distinct private handoff fields, then rebuild/rebind Setfarm so runtime guards observe the actual final `main` SHA. This A-owned `documentation-rollback` step is valid only before D's one-way retirement transition. If epoch two already exists, the A sequence returns `BASELINE_RESTART_AUTHORITY_RETIRED`; the operator must use D's reviewed `documentation-handoff` authority or stop, never clear/rewrite retirement or replay an A historical sequence:

The A source change delivered before this documentation handoff must include `src/internal-production/baseline-post-handoff-receipt-v1.ts`, private `src/internal-production/baseline-service-restart-helper-v1.ts`, `src/internal-production/baseline-spawner-startup-admission-v1.ts`, `src/internal-production/baseline-service-restart-sequence-v1.ts`, `src/internal-production/baseline-restart-authority-retirement-v1.ts`, `src/internal-production/baseline-post-handoff-cli.ts`, the exact target-guard mint/bind call site in `src/execution/runtime-completion.ts`, the dedicated bootstrap-handoff migration plus append-only registry/digest sources, their six exact focused authority tests, both migration tests, and package command `acceptance:baseline-post-handoff`. The owner inventory/tree/hash gate checks all nineteen Task 0 paths and rejects an omitted target-guard call site, coordinator, startup admission, retirement epoch, migration/digest, helper, test, or package wiring before delivery. The post-handoff writer accepts no sequence or migration field/pair from the shell: it takes the retained `documentation-rollback` final pair from the code-owned coordinator, freshly resolves `InternalProductionBaselineRestartSequenceReceiptV1` and the already applied `InternalProductionBaselineBootstrapHandoffMigrationReceiptV1`, requires their source/build/final-census/schema identities to equal the current record inputs, and copies their exact pairs plus all three ordered restart composite pairs. A missing, in-progress, blocked, live-rebind, structurally cloned, swapped, or drifted sequence or migration prevents `record`; the final baseline receipt hash covers every copied pair. Define the strict receipt as:

```typescript
export interface InternalProductionBaselinePostHandoffReceiptV1 {
  schema: "setfarm.internal-production-baseline-post-handoff-receipt.v1";
  bootstrapHandoffMigrationReceiptRef: CanonicalRef;
  bootstrapHandoffMigrationReceiptHash: string;
  bootstrapHandoffMigrationSchemaProjectionHash: string;
  operationalSourceSha: string;
  finalDocumentationSha: string;
  missionControlSourceSha: string;
  buildInfoHash: string;
  spawnerServiceIdentityHash: string;
  dashboardServiceIdentityHash: string;
  missionControlBuildHash: string;
  missionControlServiceIdentityHash: string;
  restartSequenceIntentKind: "documentation-rollback";
  restartSequenceRef: string;
  restartSequenceHash: string;
  restartAuthorityPairs: readonly [
    InternalProductionBaselineServiceRestartAuthorityPairV1,
    InternalProductionBaselineServiceRestartAuthorityPairV1,
    InternalProductionBaselineServiceRestartAuthorityPairV1
  ];
  authorityAuditHash: string;
  completeZeroOwnerCensusHash: string;
  canonicalRef: "setfarm://internal-production/baseline/post-handoff";
  recordedAt: string;
  receiptHash: string;
}
```

The tracked baseline Markdown contains one parser-owned bounded line `Operational Setfarm source SHA: <40-lowercase-hex>` whose value is the clean docs-claim base SHA returned by the Setfarm owner; the writer rejects a second marker or any mismatch to the claim base. `record --json` accepts no identity flag. It parses that exact marker from the fixed tracked packet, derives the final documentation SHA from current clean synchronized `main`, freshly resolves the guarded bootstrap-handoff migration receipt, proves current-source ancestry plus exact dedicated implementation/ordered-statements/named-entry/digest/schema while allowing unrelated append-only registry entries, and derives exact `dist/BUILD_INFO.json`, all three authenticated LaunchAgent/process/entrypoint/build identities, the full A zero-owner census, and current authority audit internally. It accepts no caller hash, PID, path, command, root, service output, timestamp, migration pair/body, or receipt body. It writes exactly `/Users/setrox/ai/setrox/data/backups/internal-production-baseline/post-handoff-receipt.json` through a real mode-`0700` ancestor, exclusive unpredictable sibling temporary file, mode `0600`, fsync, no-replace publication, then `O_RDONLY|O_NOFOLLOW` reopen/fstat/recompute. `verify-current --json` reopens that fixed file and freshly resolves/rechecks the nested migration pair before requiring current Git/build/service/census/audit identity to remain exactly equal; use it only immediately after A's rebind. `resolve-historical --json` is the later B/E resolver: it reopens and rehashes the strict receipt and tracked baseline marker, freshly resolves the nested `InternalProductionBaselineBootstrapHandoffMigrationReceiptV1`, rechecks ancestry plus dedicated implementation/ordered-statements/named-entry/digest/schema/apply/verify, verifies the recorded final docs commit remains an ancestor of current clean Setfarm `main`, verifies the recorded Mission Control commit remains an ancestor of current clean Mission Control `main`, and resolves the recorded content-addressed build/service/census/audit authority receipts without requiring current HEAD or loaded services to equal the historical pair. It returns only the immutable strict A receipt. Focused tests cover fresh-process record/current/historical verification, legitimate descendant-source advance with byte-identical migration identities, divergent/nonancestor history, changed dedicated implementation/ordered statements/named digest entry, missing/corrupt/swapped migration authority, duplicate/malformed/source-drift packet markers, collision, symlink/hardlink/mode drift, current source/build/service/census/audit drift, nonzero ownership, timestamp/hash forgery, and a missing or already-different file. No shell snippet constructs the receipt.

```bash
set -euo pipefail
readonly A_SETFARM_ROOT=/Users/setrox/ai/setrox/setfarm
A_UID="$(id -u)"
readonly A_UID
cd "$A_SETFARM_ROOT"
A_ROLLBACK_BRANCH="$(git branch --show-current)"
test "$A_ROLLBACK_BRANCH" = "main"
A_ROLLBACK_PRE_BUILD_STATUS="$(git status --porcelain=v1 --untracked-files=all)"
test -z "$A_ROLLBACK_PRE_BUILD_STATUS"
A_ROLLBACK_HEAD="$(git rev-parse HEAD)"
A_ROLLBACK_ORIGIN_MAIN="$(git rev-parse origin/main)"
test "$A_ROLLBACK_HEAD" = "$A_ROLLBACK_ORIGIN_MAIN"
npm run db:contract-spine:audit-current-authority-ledgers
npm run acceptance:baseline-post-handoff -- zero-owner --json
npm ci
npm test
npm run build
A_ROLLBACK_BUILD_INFO_SHA="$(jq -er '.sha' dist/BUILD_INFO.json)"
A_ROLLBACK_BUILD_HEAD="$(git rev-parse HEAD)"
test "$A_ROLLBACK_BUILD_INFO_SHA" = "$A_ROLLBACK_BUILD_HEAD"
npm run db:contract-spine:audit-current-authority-ledgers
npm run acceptance:baseline-post-handoff -- zero-owner --json >/dev/null
A_ROLLBACK_RESTART_SEQUENCE="$(
  npm run --silent acceptance:baseline-post-handoff -- \
    resume-restart-sequence --intent documentation-rollback --json
)"
readonly A_ROLLBACK_RESTART_SEQUENCE
A_ROLLBACK_RESTART_SEQUENCE_KEYS="$(printf '%s\n' "$A_ROLLBACK_RESTART_SEQUENCE" | jq -cer 'keys')"
test "$A_ROLLBACK_RESTART_SEQUENCE_KEYS" = '["sequenceHash","sequenceRef"]'
A_ROLLBACK_RESTART_SEQUENCE_REF="$(printf '%s\n' "$A_ROLLBACK_RESTART_SEQUENCE" | jq -er '.sequenceRef')"
readonly A_ROLLBACK_RESTART_SEQUENCE_REF
A_ROLLBACK_RESTART_SEQUENCE_HASH="$(printf '%s\n' "$A_ROLLBACK_RESTART_SEQUENCE" | jq -er '.sequenceHash')"
readonly A_ROLLBACK_RESTART_SEQUENCE_HASH
A_ROLLBACK_RESTART_STATUS="$(
  npm run --silent acceptance:baseline-post-handoff -- \
    restart-sequence-status --intent documentation-rollback --json
)"
readonly A_ROLLBACK_RESTART_STATUS
A_ROLLBACK_RESTART_STATUS_STATE="$(printf '%s\n' "$A_ROLLBACK_RESTART_STATUS" | jq -er '.state')"
test "$A_ROLLBACK_RESTART_STATUS_STATE" = "completed"
A_ROLLBACK_RESTART_STATUS_SEQUENCE_REF="$(printf '%s\n' "$A_ROLLBACK_RESTART_STATUS" | jq -er '.sequenceRef')"
test "$A_ROLLBACK_RESTART_STATUS_SEQUENCE_REF" = "$A_ROLLBACK_RESTART_SEQUENCE_REF"
A_ROLLBACK_RESTART_STATUS_SEQUENCE_HASH="$(printf '%s\n' "$A_ROLLBACK_RESTART_STATUS" | jq -er '.sequenceHash')"
test "$A_ROLLBACK_RESTART_STATUS_SEQUENCE_HASH" = "$A_ROLLBACK_RESTART_SEQUENCE_HASH"
npm run db:contract-spine:audit-current-authority-ledgers
npm run acceptance:baseline-post-handoff -- zero-owner --json
curl -fsS --retry 20 --retry-delay 1 http://127.0.0.1:3080/api/health | jq -e '.status == "healthy"'
curl -fsS --retry 20 --retry-delay 1 http://127.0.0.1:3333/ >/dev/null
A_ROLLBACK_FINAL_BUILD_INFO_SHA="$(jq -er '.sha' dist/BUILD_INFO.json)"
A_ROLLBACK_FINAL_HEAD="$(git rev-parse HEAD)"
test "$A_ROLLBACK_FINAL_BUILD_INFO_SHA" = "$A_ROLLBACK_FINAL_HEAD"
A_ROLLBACK_FINAL_STATUS="$(git status --porcelain=v1 --untracked-files=all)"
test -z "$A_ROLLBACK_FINAL_STATUS"
npm run acceptance:baseline-post-handoff -- record --json
npm run acceptance:baseline-post-handoff -- verify-current --json
```

The receipt is never tracked. Subprojects B/E call only `resolve-historical --json`, rehash the strict result, require ancestor continuity to the final operational pair, and carry only its canonical ref/hash and recorded historical identities in closure evidence. Final operational source/build/service authority is proven separately by the B/E epoch observers and must not be confused with A's historical pair. A stale Setfarm or Mission Control build at A time, nonzero owner, dirty tree, service-entrypoint drift, a docs SHA unequal to `origin/main`, broken history, or an unavailable private receipt fails.

## Final Acceptance Gate

Subproject A passes only when all of the following are simultaneously true:

- Product Build Authority V2 is delivered through a reviewed Mission Control PR.
- Setfarm and Mission Control contract artifacts are byte-compatible and pinned to the accepted Setfarm producer SHA.
- DB active run count, `/api/runs`, and `/api/projects[].execution.active` agree exactly.
- Every active project has one non-empty `execution.runId`, and active project-to-run bindings are one-to-one with no duplicate run ID.
- Historical failed/cancelled/completed projects remain discoverable.
- No raw registry or V3 receipt `active` value is presented as active Setfarm execution.
- Active Run shows an empty state when no run is in the canonical `running|resuming|cancelling|failing` operational-active set.
- Mission Control full tests, build, and render smoke pass.
- Setfarm full tests and guarded clean-main build pass.
- Final loaded Setfarm `BUILD_INFO.sha` equals the post-packet documentation merge at clean `origin/main`; the private post-handoff receipt binds the earlier operational SHA without circular tracked evidence.
- Migration plan/verify and current authority audits pass.
- The custom-format PostgreSQL backup has one authenticated completed attempt/journal receipt; all three fixed files exist with recorded hashes, the checksum matches, and the archive is listable by matching PostgreSQL tooling.
- Exactly one intended Mission Control listener, Setfarm dashboard listener, OpenClaw listener owner, and Setfarm spawner process exists.
- Both repositories are clean and equal to `origin/main`.
- The baseline packet contains no secret, dump, runtime payload, log, or screenshot.
- Production admission remains honestly blocked for the deferred external-distribution authorities.
