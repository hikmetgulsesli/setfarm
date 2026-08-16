# Internal Production Baseline and Mission Control Handoff Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reopen the already delivered Mission Control Product Build Authority V2 and operational-snapshot-v3 receipts, remove any remaining false active-project presentation, and establish the Authority-V3/migration-31-verified clean-main baseline for Setfarm and Mission Control before the first golden run.

**Architecture:** Mission Control continues to proxy and render Setfarm-owned authority without inventing a second authority model. A new read-only project execution projection separates catalog lifecycle, workflow execution, runtime health, and immutable V3 deployment-receipt state; it resolves only explicit run identifiers or exact run numbers from PostgreSQL. After the Mission Control changes merge, both repositories are rebuilt from clean `main`, the live services are restarted only with a zero-owner census, and a bounded baseline packet records exact code, contract, database, process, port, backup, and HTTP evidence.

**Tech Stack:** TypeScript ESM, Node.js 22+, React 19, Express 5, PostgreSQL, `node:test`, Playwright, GitHub CLI, macOS LaunchAgents.

**Spec:** `docs/superpowers/specs/2026-08-13-setfarm-mission-control-internal-production-closure-design.md`

## 2026-08-16 Execution Rebaseline

Product Build Authority V2 behavior and `setfarm.run-operational-snapshot.v3` are already delivered acceptance inputs. Repository truth exposes only per-run Product Build Authority `authorityHash`; it does not contain a global PBA V2 receipt pair. Task 0 first delivers Setfarm's local strict `ProductBuildAuthorityV2DeliveryEvidenceResponseV1` wire parser/schema and canonical fixtures without importing Mission Control source. Task 1 then implements the exact read-only Mission Control `ProductBuildAuthorityV2DeliveryEvidenceV1` producer/endpoint against that response contract without changing the delivered PBA parser/server/UI behavior. The reconciliation feature branch may exercise injected fixtures and compute expected deterministic hashes only as non-authoritative test data: its production observer, pair resolver, CLI, and endpoint owner fail closed before pair publication because the branch is not clean synchronized `main`. Task 6 Step 8 is the first point that creates and reopens the authoritative current pair, after the reviewed merge and a clean synchronized Mission Control main/build. The observations and branch identities in “Starting Evidence” are historical. Current execution starts only from an execution-time exact clean synchronized Setfarm `main` descendant that retains reviewed Authority-V3 PR #86 merge `1d691c89760339ea905dfe17f8e9188e62603c1c` as an ancestor, with migrations 1 through 31 independently verified applied/current, exactly one Task 6A bootstrap successor registered pending, and one fresh clean canary proving its one terminal-preclaim lifecycle. Run 2075 remains polluted historical evidence and is not resumed. The local delivery-evidence response contract is not a generated or vendored Setfarm contract artifact: the ten-artifact vendored set that exists before the operational-active pair expands to twelve when that pair is added, and the later run-operational-model-v2 pair expands it to fourteen.

Task 6A first performs the one disjoint pre-schema spawner rebind into `pre-manifest-bootstrap-sealed`, applies guarded migration 32 through its sealed-status-bound pre-manifest authorization, activates A, transitions that same spawner generation once to normal Task 0 admission without another restart, and seals those pre-full-rebind facts as the strict `InternalProductionCurrentEntryAuthorityPairV1`. Task 7 consumes that predecessor and, after read-only schema validation plus its authorized rebuild/restart/rebind, seals the strict `InternalProductionPostRebindEntryAuthorityPairV1`. Task 8 and every B/C/D/E descendant consume only the post-rebind successor as current authority; no descendant requires the predecessor to remain current or reconstructs either pair from prose, a SHA alone, or the historical run.

Operational shell fences do not select a workstation checkout. The owning controller first resolves the applicable clean-main/merge receipt, then exports one indivisible read-only `SETFARM_ROOT` and `SETFARM_ROOT_EXPECTED_SHA` binding. Before any package command, the fence independently requires both variables, verifies that the root is a clean literal `main`, and proves `HEAD === refs/remotes/origin/main === SETFARM_ROOT_EXPECTED_SHA`. A missing variable, absolute-path fallback, dirty tree, detached/wrong branch, stale tracking ref, or SHA mismatch fails before observation or mutation.

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
- Every remaining code task follows test-first development. Task 1 preserves the delivered `240e779d78804843a1202cbf0440fe423b806b1a` Product Build Authority V2 behavior byte-for-byte and adds only its read-only delivery-evidence producer/endpoint/tests on the fresh reconciliation branch. Branch tests use injected contract fixtures and non-authoritative expected hashes; no production current pair is published, resolved, or handed off before Task 6 Step 8.
- Stop and report if the same canonical systemic failure repeats three times after attempted fixes.
- Execute the source/contract dependency in this exact order: Task 0 source-only delivery of the local Setfarm response parser/schema and operational-active producer artifacts; Task 1 branch creation and Mission Control delivery-evidence implementation against canonical fixtures; Task 5 Steps 1–3 to vendor the operational-active producer artifacts; Tasks 2–4; Task 5 Steps 4–6 to cross and checkpoint the semantic consumer with fixture-only delivery-evidence expectations; Task 6 reviewed Mission Control delivery; Task 6 Step 8 authoritative clean-main pair creation/reopen; Task 6A pre-rebind entry; then Task 7. No Mission Control module is imported to make Task 0 constructible, no reconciliation-branch stage publishes or consumes a production current pair, and the canary does not run before Task 6 Step 8 has returned the exact clean-main pair.
- Every `bash` fence starts with `set -euo pipefail`. Plan/source-boundary tests parse every shell fence and reject a service, database, run/workflow, or Git mutation unless the immediately preceding evidence block freshly resolves the exact code-owned purpose authority and the mutating command consumes that authority. They specifically ban raw `launchctl`, raw workflow-start commands, and `git switch|checkout|pull|fetch|merge|reset|add|commit|push` in worker fences. Task 6A's shell exposes only zero-input `prepare-current-entry` before mutation and the one named zero-input `resume-current-entry` afterward. Immediately before resume, a read-only `current-entry-status` evidence block must reopen the same fixed operation in a valid resumable prefix (or its byte-identical ready terminal); resume then internally pair-resolves and consumes that fixed operation and alone calls the purpose-bound pre-schema spawner and migration ports. This is the sole pairless-argv mutation exception; tests reject any other zero-input mutation, an absent/blocked/cross-operation status, or a resume without the adjacent status proof. The internal ports are fixed to `setfarm-spawner`, use strict legacy/pre-manifest observations, and have no public production argv. After A activation, `prepare-restart-service` accepts only the closed service enum, internally resolves the current migration receipt and fresh manifest-backed complete-zero-owner guard, and returns only an authorization pair; `restart-service` accepts only that pair and derives the service internally. The same tests reject a negative `rg` scan hidden in a pipeline, a match-then-exit expression followed by an unconditional-success fallback, or any other masked/bare fallback; transcript fixtures prove that a match status `0` fails, only status `1` with exactly empty captured output passes, status `1` with output and statuses `2`/`127` fail, and an upstream Git-diff failure stops before `rg` runs.

## Starting Evidence

- Historical observation: Mission Control once held the undelivered `feat/product-build-authority-v2` commit `17097074da241ae8f285c00c77d6c972791b369c` above `4761ff3`.
- Current fact: reviewed PR #19 delivered Product Build Authority V2 as merge `240e779d78804843a1202cbf0440fe423b806b1a`; current execution verifies that merge as an ancestor of clean synchronized Mission Control `main` and never recreates its branch or delivery PR.
- The Product Build Authority focused tests are rerun from current clean Mission Control `main` as read-only acceptance evidence.
- Historical observation: Mission Control's vendored Setfarm contract lock pinned producer commit `9a66b954669be7f6661c53191628e6d84bffe958` and eight artifacts. The current pre-active-status inventory has ten artifacts; the active-status pair makes twelve.
- The live `/api/projects` response contains 220 records: 112 raw `active`, 90 `failed`, and 18 `completed`.
- None of the 112 raw-active records has a live service observation: 104 are `inactive` and 8 are `unknown`.
- `/api/runs` returns an empty list, matching the zero-active-run database census.
- The false-active root cause is persisted legacy `status:"active"`, bounded latest-50 run enrichment, and UI precedence that renders `project.status` as execution state.
- `ActiveRun.pickActiveRun()` also falls back to the newest terminal run when no active run exists.

## File Map

### Delivered Mission Control Product Build Authority and delivery evidence

- Preserve and verify without behavioral modification:
  - `mission-control/server/routes/setfarm-operational.test.ts`
  - `mission-control/server/routes/setfarm-operational.ts`
  - `mission-control/server/services/setfarm-product-build-authority.ts`
  - `mission-control/server/services/setfarm-product-build-authority.test.ts`
  - `mission-control/src/lib/product-build-authority.ts`
  - `mission-control/src/components/run-detail/ProductBuildAuthority.tsx`
  - `mission-control/tests/product-build-authority-render.test.tsx`
- Create `mission-control/server/services/product-build-authority-v2-delivery-evidence-v1.ts` — sole read-only owner of the strict projection, deterministic pair, clean-main-only current-source observer, focused-test receipt, and pair-only resolver; its production observer/resolver publishes nothing off clean synchronized `main` with a matching build SHA.
- Create `mission-control/server/services/product-build-authority-v2-delivery-evidence-v1.test.ts` — merge/path/blob/lock/test/source/status/pair tamper and missing-evidence tests, canonical fixture/hash tests, and feature-branch fail-closed/no-publication tests.
- Modify `mission-control/server/routes/setfarm-operational.ts` — expose only fixed `GET /api/internal-production/product-build-authority-v2-delivery-evidence` from the owner module.
- Modify `mission-control/server/routes/setfarm-operational.test.ts` — exact zero-input endpoint contract under injected canonical fixtures representing eventual post-merge clean-main bytes, feature-branch refusal with no production resolver call/publication, no per-run/global-pair confusion, and unavailable/tamper regressions.
- Modify `mission-control/package.json` — add the zero-input non-listening `internal:product-build-authority-v2-delivery-evidence` source-observer CLI; it first returns an authoritative pair only from Task 6 Step 8's clean synchronized post-merge main/build and is reused before Task 7 loads the endpoint in the Mission Control service.

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
- Modify `mission-control/tests/setfarm-contract-vendor.test.ts` — require all twelve artifacts and cross the operational-active compatibility fixture through the shared consumer.
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
  - `setfarm/src/internal-production/owner-admission-v1.ts` — import-inert one-way core for the pure category/census/manifest/reservation/fence ABI and the injected PostgreSQL sidecar port; every receipt/restart/sequence/controller consumer imports this core, and this core imports none of them.
  - `setfarm/tests/internal-production/owner-admission-v1.test.ts` — exact 35-category/35-map-key/36-scalar coverage, repository reservation/close pair resolution, same-transaction sidecar idempotency, fixed production composition/no caller registry-factory, test-private fake, fence, import-direction, and import-inertness tests.
  - `setfarm/src/internal-production/baseline-post-handoff-receipt-v1.ts` — also owns the strict content-addressed baseline service-restart authority/store/resolver used by B P0 and the disjoint one-use pre-manifest migration-32 authorization/legacy-census observer.
  - `setfarm/src/internal-production/product-build-authority-v2-delivery-evidence-v1.ts` — sole local owner of the strict response constants/schema/parser and canonical field/null relations plus fixed code-owned source/HTTP observer and pair-only resolver; accepts no root, URL, ref, hash, body, transport override, or import from sibling Mission Control source.
  - `setfarm/tests/internal-production/product-build-authority-v2-delivery-evidence-v1.test.ts` — canonical positive/negative response fixtures, exact canonical bytes/hash/fields, source-boundary no-sibling-import checks, source/HTTP equality, pre-rebind source CLI, post-rebind endpoint, and tamper/status tests.
  - `setfarm/src/internal-production/baseline-owner-producer-manifest-activation-controller-v1.ts` — A-only, import-inert, path-free controller that durably activates the exact eleven-row A manifest and seals the predecessor/successor activation-head wrapper receipt.
  - `setfarm/src/internal-production/baseline-post-handoff-cli.ts`
  - `setfarm/src/internal-production/baseline-service-restart-helper-v1.ts` — private fixed no-shell helper entry for disjoint pre-schema-spawner and normal post-activation actions; no public argv surface.
  - `setfarm/src/internal-production/baseline-spawner-startup-admission-v1.ts` — A-operation-bound new-spawner startup capability/locator/claim plus the fixed pre-schema spawner authorization, sealed admission, and same-generation normal-admission transition.
  - `setfarm/src/internal-production/baseline-service-restart-sequence-v1.ts` — fixed `live-rebind|d-startup-hook-load|documentation-rollback` coordinator, journal, and resolver.
  - `setfarm/src/internal-production/baseline-restart-authority-retirement-v1.ts` — the one-way A-to-D physical-service restart-authority epoch, A-owned strict hook-readiness/activation/cutover contracts and stores, code-owned hook observer/recorder, global transition lock, durable retirement/cutover receipts, and pair-only resolvers.
  - `setfarm/src/internal-production/baseline-post-handoff-receipt-v1.ts`, `setfarm/src/spawner.ts`, `setfarm/src/execution/attempt-repository.ts`, `setfarm/src/execution/claim-runtime-publication.ts`, `setfarm/src/execution/runtime-completion.ts`, and `setfarm/src/execution/runtime-completion-effect-runner.ts` — exact call sites for the eleven A-owned rows of `INTERNAL_PRODUCTION_OWNER_PRODUCER_ROWS_A_V1`; each calls its fixed producer function before the first matching owner publication and closes against the terminal authority. `spawner.ts` additionally accepts only the operation-bound pre-schema startup admission, exposes no owner/listener/normal loop while sealed, and enables producers only after same-generation admission-ready.
  - `setfarm/src/execution/runtime-completion.ts` — mint the opaque completion-owner bootstrap target guard only inside the authenticated current-owner context.
  - `setfarm/src/db/bootstrap-main-claim-handoff-v1-migration.ts` — sole immutable implementation, ordered statements, named migration identity, and schema projector for the bootstrap-main-claim handoff migration.
  - `setfarm/src/db/contract-spine-migrations.ts`, `setfarm/src/db/contract-spine-migration-source-integrity.ts`, and `setfarm/src/db/contract-spine-migration-digests.generated.ts` — guarded registration of exact ordinal 32, its source-integrity manifest, and generated named digest entry before B Task P0; unrelated later entries may be appended without changing A's authority.
  - `setfarm/src/db-pg.ts` — sole production composition for the injected owner repository/controller and fixed non-exported category resolver table; its operation-bound sealed startup branch permits only a minimal read-only v31/pending-32 connection and cannot report normal DB ready, while ordinary startup still fails generic full verify until 32 is applied.
  - `setfarm/scripts/run-isolated-postgres-tests.ts` — after automatic apply, invokes only the fixed test-private migration-32 authority before full verify or child tests.
  - `setfarm/tests/internal-production/baseline-post-handoff-receipt-v1.test.ts`
  - `setfarm/tests/internal-production/baseline-owner-producer-manifest-activation-controller-v1.test.ts` — A controller receipt/status, interruption, replay, CLI, import-inertness, and no-producer-before-activation tests.
  - `setfarm/tests/internal-production/baseline-post-handoff-cli.test.ts`
  - `setfarm/tests/internal-production/baseline-service-restart-helper-v1.test.ts`
  - `setfarm/tests/internal-production/baseline-spawner-startup-admission-v1.test.ts` — also proves pre-schema prepare/dispatch/startup-seal/replay, total owner-producer refusal while sealed, old-spawner terminality, and the no-restart transition to normal admission.
  - `setfarm/tests/internal-production/baseline-service-restart-sequence-v1.test.ts`
  - `setfarm/tests/internal-production/baseline-restart-authority-retirement-v1.test.ts`
  - `setfarm/tests/internal-production/task-0-source-manifest.test.ts` — owns the reviewed literal exact Task 0 path tuple and rejects an omitted, extra, duplicated, reordered, or Markdown-derived path fixture.
  - `setfarm/tests/execution-attempts/migrations.test.ts` and `setfarm/tests/execution-attempts/migration-source-digests.test.ts`
  - `setfarm/tests/execution-attempts/test-database.ts` — keeps automatic isolated-test migration setup as the default and exposes only the private exact migration-32 test helper; there is no caller-selected guarded ID or production mode.
  - the twenty direct `applyContractSpineMigrations`/`verifyContractSpineMigrations` caller tests enumerated in `TASK_0_EXACT_SOURCE_PATHS_V1` — assert the pending failure boundary and invoke only the fixed test capability where a fully migrated fixture is required.
  - `setfarm/tests/execution-attempts/runtime-completion.test.ts` — covers the completion-owner bootstrap target-guard mint/bind call site.
  - `setfarm/tests/mission-control-terminal-filter.test.ts` — replaces the obsolete local terminal-list source assertion with the shared `operationalActive` contract assertion.
  - `setfarm/package.json` command table entry `acceptance:baseline-post-handoff`
- Update only when the producer pin changes:
  - `mission-control/contracts/vendor/setfarm/mission-control-contracts.v1.lock.json`
  - the ten current files plus the two operational-active status artifacts under `mission-control/contracts/vendor/setfarm/`
- Create `docs/review-packets/2026-08-13-internal-production-baseline.md` after all live checks have produced exact values.

---

### Task 0: Deliver the Setfarm baseline handoff authority before live mutation

Contract-freeze rule: every Task 0 package command, internal-production module, guarded migration facility, owner-admission facility, restart/bootstrap/clean-build bridge, fixture, and focused test named below is missing work on the starting branch and is a Task 0 postcondition. Words such as “existing,” “delivered,” or “reused” refer only to explicitly named pre-Task0 foundations (Authority V3/PR #86, migrations 1–31, current generic helpers, and delivered PBA behavior); they never authorize skipping a RED test or treating a missing Task 0 export as a precondition.

**Files:** exactly the 64 repository-relative paths in `TASK_0_EXACT_SOURCE_PATHS_V1` below. This is the complete Task 0 source/test/generated/package surface, including the six A producer call-site modules, one-way owner-admission core/test and PostgreSQL wiring, restart-authority retirement module/test, guarded bootstrap-handoff migration module/registry/source-integrity/generated digest/tests/private isolated-test lifecycle, every direct apply/verify caller test, adjacent runtime-completion and dashboard-filter tests, strict local Product Build Authority V2 response parser/fixtures, operational-active producer/artifacts, and the literal source-manifest test. No production module parses this Markdown. `tests/internal-production/task-0-source-manifest.test.ts` owns a byte-for-byte literal copy of this tuple and exercises a private exact-set validator with the tuple, then with one omission, one extra path, one duplicate, and one reorder; a count-only assertion is forbidden.

```typescript
export const TASK_0_EXACT_SOURCE_PATHS_V1 = [
  "contracts/generated/mission-control/operational-active-run-status.v1.compatibility.json",
  "contracts/generated/mission-control/operational-active-run-status.v1.schema.json",
  "package.json",
  "scripts/run-isolated-postgres-tests.ts",
  "src/contracts/mission-control-contract-artifacts.ts",
  "src/contracts/operational-active-run-status-v1-cli.ts",
  "src/contracts/operational-active-run-status-v1.ts",
  "src/db-pg.ts",
  "src/db/bootstrap-main-claim-handoff-v1-migration.ts",
  "src/db/contract-spine-migration-digests.generated.ts",
  "src/db/contract-spine-migration-source-integrity.ts",
  "src/db/contract-spine-migrations.ts",
  "src/execution/attempt-repository.ts",
  "src/execution/claim-runtime-publication.ts",
  "src/execution/runtime-completion-effect-runner.ts",
  "src/execution/runtime-completion.ts",
  "src/internal-production/baseline-owner-producer-manifest-activation-controller-v1.ts",
  "src/internal-production/baseline-post-handoff-cli.ts",
  "src/internal-production/baseline-post-handoff-receipt-v1.ts",
  "src/internal-production/baseline-restart-authority-retirement-v1.ts",
  "src/internal-production/baseline-service-restart-helper-v1.ts",
  "src/internal-production/baseline-service-restart-sequence-v1.ts",
  "src/internal-production/baseline-spawner-startup-admission-v1.ts",
  "src/internal-production/owner-admission-v1.ts",
  "src/internal-production/product-build-authority-v2-delivery-evidence-v1.ts",
  "src/server/dashboard.ts",
  "src/server/index.html",
  "src/spawner.ts",
  "tests/execution-attempts/activation-preflight.test.ts",
  "tests/execution-attempts/artifact-publication-batch-migration.test.ts",
  "tests/execution-attempts/artifact-publication-batch-plan-migration.test.ts",
  "tests/execution-attempts/artifact-store-authority-migration.test.ts",
  "tests/execution-attempts/attempt-reconciler.test.ts",
  "tests/execution-attempts/migration-source-digests.test.ts",
  "tests/execution-attempts/migrations.test.ts",
  "tests/execution-attempts/operational-event-migration.test.ts",
  "tests/execution-attempts/operational-failure-cause-migration.test.ts",
  "tests/execution-attempts/platform-release-store-record-ledger-v3-contract-integration.test.ts",
  "tests/execution-attempts/preparation-authority-v2-migration.test.ts",
  "tests/execution-attempts/product-compilation-attempt-migration.test.ts",
  "tests/execution-attempts/run-terminal-transition.test.ts",
  "tests/execution-attempts/runtime-completion-manifest-authority-migration.test.ts",
  "tests/execution-attempts/runtime-completion.test.ts",
  "tests/execution-attempts/test-database.ts",
  "tests/execution-attempts/v3-preparation-block-repository.test.ts",
  "tests/execution-attempts/v3-release-admission.test.ts",
  "tests/execution-attempts/v3-story-claim-runtime-binding-v1-migration.test.ts",
  "tests/findings/migration-recovery-compatibility.test.ts",
  "tests/findings/migration.test.ts",
  "tests/internal-production/baseline-owner-producer-manifest-activation-controller-v1.test.ts",
  "tests/internal-production/baseline-post-handoff-cli.test.ts",
  "tests/internal-production/baseline-post-handoff-receipt-v1.test.ts",
  "tests/internal-production/baseline-restart-authority-retirement-v1.test.ts",
  "tests/internal-production/baseline-service-restart-helper-v1.test.ts",
  "tests/internal-production/baseline-service-restart-sequence-v1.test.ts",
  "tests/internal-production/baseline-spawner-startup-admission-v1.test.ts",
  "tests/internal-production/owner-admission-v1.test.ts",
  "tests/internal-production/product-build-authority-v2-delivery-evidence-v1.test.ts",
  "tests/internal-production/task-0-source-manifest.test.ts",
  "tests/mission-control-contract-artifacts.test.ts",
  "tests/mission-control-terminal-filter.test.ts",
  "tests/operational-active-run-status-v1.test.ts",
  "tests/product-compiler/artifact-store-authority.test.ts",
  "tests/product-compiler/artifact-store-staging.test.ts",
] as const;
```

**Interfaces:** `InternalProductionBaselinePostHandoffReceiptV1`, `InternalProductionBaselineBackupReceiptV1`, `InternalProductionBaselineZeroOwnerMutationGuardV1`; exact `InternalProductionLegacyPreManifestZeroOwnerObservationV1`; exact `InternalProductionPreSchemaSpawnerRebindAuthorizationV1`/pair/status/store/resolver, zero-input prepare and pair-only execute/recover internal ports; exact pre-dispatch `InternalProductionPreSchemaSpawnerStartupTokenV1`, post-dispatch `InternalProductionPreSchemaSpawnerSealedAdmissionV1`, and same-generation `InternalProductionTask0SpawnerAdmissionReadyV1`; exact `InternalProductionPreManifestMigration32AuthorizationV1`/pair/status/store/resolver and zero-input prepare internal port; exact `InternalProductionBaselineBootstrapHandoffMigrationReceiptV1`, pair-only internal `applyInternalProductionBaselineBootstrapHandoffMigrationV1({authorizationRef,authorizationHash})`, and receipt resolver; exact normal post-activation `InternalProductionBaselineServiceRestartAuthorizationV1`/pair/status/store/resolver, `prepareInternalProductionBaselineServiceRestartV1({service})`, and pair-only `restartInternalProductionBaselineServiceV1({authorizationRef,authorizationHash})`; exact B-purpose guard seam; exact physical restart epoch/retirement/readiness/activation/cutover APIs; exact runtime-source/restart-authority/startup-admission/bootstrap-restart/backup/post-handoff APIs listed below. Task 6A exposes only `prepare-current-entry|resume-current-entry|current-entry-status|verify-current-entry --json`; pre-schema restart and migration apply are controller-only ports with no public production argv. Existing normal `zero-owner|prepare-restart-service|restart-service|resume-restart-sequence|restart-sequence-status|runtime-source|backup|record|verify-current|resolve-historical --json` remains unavailable before A-manifest activation where applicable. B can bind/consume a generic guard only through A's exact named golden-launch migration seam; the P0 bootstrap path remains in-process only and uses its fenced target guard plus prepared operation pair. `runtime-source` remains diagnostic and `backup --json` remains fixed-path/idempotent.

Task 0 also owns the Task 6A entry ABI: strict `InternalProductionCurrentEntryAuthorityV1`, `InternalProductionCurrentEntryAuthorityPairV1`, `InternalProductionCurrentEntryAuthorityStatusV1`, their pair-only resolver/current verifier, the fixed `prepare-current-entry|resume-current-entry|current-entry-status|verify-current-entry --json` CLI, and read-only `service-census --json`. `prepare-current-entry` is zero-input and must durably publish/reopen the fixed operation after the read-only PBA/v31/pending/source-build prerequisites but before the first service or database mutation. `resume-current-entry` is the only production coordinator allowed to invoke the internal pre-schema restart and guarded-apply ports; every retry reopens the same operation head and resumes its exact prefix. It additionally owns strict read-only `InternalProductionAuthorityV3Migration31AuditV1` with pair `{authorityV3Migration31AuditRef,authorityV3Migration31AuditHash}` and `InternalProductionPendingBootstrapHandoffMigrationProjectionV1` with pair `{pendingBootstrapHandoffMigrationRef,pendingBootstrapHandoffMigrationHash}`. The zero-input `audit-authority-v3-migration31 --json` proves migrations 1 through 31 are applied/current and binds the delivered Authority-V3 receipt, PR #86 ancestry, migration-31 source/tree/build/schema/current-authority identities; it deliberately ignores later registered-but-unapplied migrations. The zero-input `inspect-pending-bootstrap-handoff-successor --json` separately proves the registry/digest has exactly one pending entry, literal `contract-spine-bootstrap-main-claim-handoff-v1`, whose implementation blob, ordered statements, named digest entry/digest, schema projection, and `migrationSourceSha` are byte/hash-bound to Task 0's current controller source, with no other pending or drifted entry. Both pairs have fixed content-derived refs, pair-only resolvers, no store scan, and no mutation.

Migration 32 is the sole `migrationClass:"guarded"` member of the ordered registry; ordinals 1–31 are `migrationClass:"automatic"`. The exact framework contract is:

- `planContractSpineMigrations(sql)` enumerates both classes in ordinal order, includes `migrationClass` on every row, and reports guarded 32 as `state:"pending"`/plan `status:"pending"` until its exact dedicated apply succeeds.
- `applyContractSpineMigrations(sql, options?)` applies or adopts only `automatic` entries. It never executes, adopts, journals, or verifies a missing guarded entry; its strict result adds `guardedPending:["contract-spine-bootstrap-main-claim-handoff-v1"]` before Task 6A's purpose-bound apply and `guardedPending:[]` afterward. There is no option, migration ID, callback, environment variable, or cast that makes generic apply consume a guarded entry.
- `verifyContractSpineMigrations(sql, options?)` continues to use the complete registered plan and fails with `MIGRATION_INCOMPLETE` naming guarded ordinal 32 while it is pending. It returns `status:"verified"` only after the exact dedicated apply has journaled and verified 32. Therefore generic `db:contract-spine:verify` is prohibited before Task 6A's purpose-bound apply, not weakened to ignore the successor.
- `auditAuthorityV3ContractSpineThroughMigration31V1(sql)` is the only targeted predecessor audit. It verifies exact applied/current ordinals 1–31 and their source/current-authority relations, deliberately makes no claim about a later registered-unapplied row, and produces the A v31 audit pair.
- `inspectPendingBootstrapMainClaimHandoffGuardedSuccessorV1(sql)` is the only guarded-successor inspector. It accepts no ID/version/digest/projection input and succeeds only for exactly one registry successor, ordinal `32`, name `contract-spine-bootstrap-main-claim-handoff-v1`, class `guarded`, absent journal row/absent schema, with no other pending, unexpected, partial, adoptable, or drifted entry.
- The registry exposes no generic guarded apply. Its sole production execution port is `applyBootstrapMainClaimHandoffGuardedMigration32V1(sql, evidence)`, where `evidence` is constructed only inside the already prepared Task 6A current-entry controller after it reopens the exact v31 audit, pending successor, clean build, terminal `pre-manifest-bootstrap-sealed` spawner admission, that admission's post-predecessor-termination complete legacy/pre-manifest zero-owner observation, one later fresh equality reobservation, and one-use `InternalProductionPreManifestMigration32AuthorizationV1`. It never asks for or accepts the normal manifest-backed complete-zero guard. The port fixes ordinal/name/class/statements and rejects a caller SQL body, ID, digest, projection, database selector, normal restart authorization, owner-manifest authority, or capability clone. It is an internal controller port with no production CLI/export for arbitrary callers; Task 7 has no apply port.

`CONTRACT_SPINE_SEMANTIC_MIGRATION_SOURCE_MANIFEST[32]` binds the dedicated module's exact implementation/ordered-statement/schema-projector regions and the registry's guarded-class/registration/dispatch regions. `CONTRACT_SPINE_SEMANTIC_MIGRATION_DIGESTS[32]` is produced only by `scripts/check-contract-spine-migration-digests.ts --write`; the generated map, source-integrity manifest, checksum, named `(32,migrationId,migrationDigest)` entry hash, pending projection, and later receipt must all agree. Tests mutate each region/dependency and prove only entry 32 changes; hand-editing the generated digest or omitting the source-integrity entry fails `check:migration-digests`.

The isolated lifecycle is exact. `createIsolatedTestDatabase()` and `reset()` first call generic automatic apply and assert its sole guarded-pending result, then internally invoke the test-only zero-argument `database.applyBootstrapMainClaimHandoffGuardedMigration32ForTestV1()` capability, and only then call generic full verify. `scripts/run-isolated-postgres-tests.ts` performs the same automatic-apply → fixed test-capability → full-verify order before spawning its child. The capability is defined only in `tests/execution-attempts/test-database.ts`, fixes migration ID/ordinal/body/projector and deterministic test evidence, accepts no production connection, environment switch, caller ID/body/evidence, or generic capability, and is absent from `src`, `package.json`, and production exports. A `{migrate:false}` fixture remains pending until its test explicitly invokes that zero-argument member; direct-caller tests prove generic verify fails beforehand and succeeds afterward. All twenty direct test callers are in the literal File Map and adjacent command. The audited non-test callers are `src/db-pg.ts`, `src/evals/convergence-runner.ts`, `src/execution/activation-preflight.ts`, `scripts/contract-spine-migrate.ts`, and `scripts/product-artifact-index.ts`: none receives the test capability or a generic guarded mode, and each keeps the intended fail-closed behavior while 32 is pending. Task 0 never applies 32 to the live/canonical database.

The entry ABI separates `controllerSourceAuthority` from `loadedRuntimeServiceAuthority`. The controller authority binds the exact clean Task 0 descendant `controllerSourceSha`, `controllerTreeHash`, and `controllerBuildHash`. Before the canary, the already prepared Task 6A operation first performs one controlled pre-schema spawner-only rebind to that Task 0 source/build. The replacement starts in strict `pre-manifest-bootstrap-sealed` admission, publishes no run/claim/execution-attempt/runtime-session/completion-owner/mandatory-effect or any other owner-producer byte, opens no normal listener/loop, and waits fail-closed. After authentic old-spawner termination and while the replacement is already sealed, the controller obtains a new complete legacy/pre-manifest observation proving all 36 counters—including process, listener, worktree, dirty-worktree, and stale-child ownership—are zero; this post-termination pair is part of the sealed admission. A pre-dispatch snapshot alone is never migration authority. Only after reopening that pair and a later fresh equal reobservation may the controller apply migration 32, verify it current, activate A's manifest, and let that same spawner generation resolve both pairs and transition once to `normal-task0-admission-ready`; there is no second spawner restart. If any owner or child appears between initial observation, dispatch, predecessor termination, sealing, or migration authorization, the replacement remains sealed and migration is unavailable. The loaded-runtime authority therefore binds the Task 0 spawner plus the still-delivered dashboard, Mission Control, and OpenClaw process/listener/source/build identities. Each member is independently reopened; equality with the controller is required only for the spawner and is expressly not required for dashboard, Mission Control, or OpenClaw. Only the admission-ready spawner containing the Task 0 owner-reservation hooks may process the canary. Task 7 later rebuilds/rebinds the full spawner/dashboard/Mission-Control set and performs no schema mutation.

Its canary path internally uses Task 0's dedicated `current-entry-canary-source-run-launch-v1` owner-admission fence with exact typed `source-run` and `run` target reservations, the compound target-close authority, and the fence-release authority. The strict service census has schema `setfarm.internal-production-service-census.v1`; it emits exactly one code-owned `spawner`, `dashboard`, `missionControl`, and `openClaw` observation with integer `pid`, exact `processOwnerCount`, and, where applicable, exact `listenerOwnerCount`, plus a recomputed `censusHash`. The entry recorder accepts no caller root/SHA/run/failure code/test result/service identity/migration body/receipt body; it obtains every identity through fixed code-owned observers and stores the focused three-code test receipt separately from the one-code live-canary settlement.

Task 0's `product-build-authority-v2-delivery-evidence-v1.ts` locally owns `PRODUCT_BUILD_AUTHORITY_V2_DELIVERY_EVIDENCE_RESPONSE_SCHEMA_V1`, `PRODUCT_BUILD_AUTHORITY_V2_DELIVERY_EVIDENCE_CURRENT_STATUS_V1`, strict `ProductBuildAuthorityV2DeliveryEvidenceResponseV1Schema`/`ProductBuildAuthorityV2DeliveryEvidenceResponseV1`, and `parseProductBuildAuthorityV2DeliveryEvidenceResponseV1(value:unknown)`. The accepted success envelope is exactly `{schema:"mission-control.product-build-authority-v2-delivery-evidence-response.v1",currentStatus:"current",deliveryEvidenceRef,deliveryEvidenceHash,evidence}`: the ref, hash, and strict evidence body are non-null together, their canonical hashes/fields must agree, and absent, half-null, mixed, extra-field, or null success members are rejected. Unavailable source, non-200 HTTP, non-clean-main CLI refusal, or parse failure returns no pair and cannot be represented as a partial `current` envelope. Canonical positive/negative fixtures and their expected canonical bytes/hashes are owned in the Task 0 Setfarm test; the production module and test contain no relative, absolute, package, dynamic, or type-only import of Mission Control source. A source-boundary test enumerates imports and fails on `mission-control`, sibling-root traversal, runtime source loading, or an injected parser/schema export. This local response contract is not registered in `mission-control-contract-artifacts.ts`, does not create generated/vendor files, and leaves the explicit inventory progression at ten, then twelve after the operational-active pair, then fourteen after the later run-operational-model-v2 pair.

The nested wire ABI is frozen exactly as follows; every object is strict and every shown member is required and non-null. `GitObjectHashV1` alone accepts lowercase 40- or 64-hex. `Sha256V1` accepts exactly lowercase 64-hex. Tuple order is wire authority, not a sortable convenience:

```typescript
export const GIT_OBJECT_HASH_V1_PATTERN = /^[0-9a-f]{40}(?:[0-9a-f]{24})?$/;
export const SHA256_V1_PATTERN = /^[0-9a-f]{64}$/;
export type GitObjectHashV1 = string & { readonly __gitObjectHashV1: unique symbol };
export type Sha256V1 = string & { readonly __sha256V1: unique symbol };

type ProductBuildAuthorityV2PathBlobIdentityV1 = Readonly<{
  path: string;
  blobHash: Sha256V1;
}>;

type ProductBuildAuthorityV2VendorArtifactIdentityV1 = Readonly<{
  producerPath: string;
  vendoredPath: string;
  sha256: Sha256V1;
}>;

export type ProductBuildAuthorityV2FocusedTestReceiptV1 = Readonly<{
  schema: "mission-control.product-build-authority-v2-focused-test-receipt.v1";
  argv: readonly [
    "node", "--import", "tsx", "--test",
    "server/routes/setfarm-operational.test.ts",
    "server/services/setfarm-product-build-authority.test.ts",
    "tests/product-build-authority-render.test.tsx",
  ];
  commandContractHash: Sha256V1;
  testPathBlobs: readonly [
    ProductBuildAuthorityV2PathBlobIdentityV1,
    ProductBuildAuthorityV2PathBlobIdentityV1,
    ProductBuildAuthorityV2PathBlobIdentityV1,
  ];
  exitCode: 0;
  passed: true;
  focusedTestReceiptRef: CanonicalRef;
  focusedTestReceiptHash: Sha256V1;
}>;

export type ProductBuildAuthorityV2VendorLockProjectionV1 = Readonly<{
  schema: "mission-control.product-build-authority-v2-vendor-lock-projection.v1";
  lockPath: "contracts/vendor/setfarm/mission-control-contracts.v1.lock.json";
  producerRepository: "https://github.com/hikmetgulsesli/setfarm.git";
  producerCommit: GitObjectHashV1;
  lockContentHash: Sha256V1;
  artifacts: readonly [
    ProductBuildAuthorityV2VendorArtifactIdentityV1,
    ProductBuildAuthorityV2VendorArtifactIdentityV1,
    ProductBuildAuthorityV2VendorArtifactIdentityV1,
    ProductBuildAuthorityV2VendorArtifactIdentityV1,
    ProductBuildAuthorityV2VendorArtifactIdentityV1,
    ProductBuildAuthorityV2VendorArtifactIdentityV1,
    ProductBuildAuthorityV2VendorArtifactIdentityV1,
    ProductBuildAuthorityV2VendorArtifactIdentityV1,
    ProductBuildAuthorityV2VendorArtifactIdentityV1,
    ProductBuildAuthorityV2VendorArtifactIdentityV1,
    ProductBuildAuthorityV2VendorArtifactIdentityV1,
    ProductBuildAuthorityV2VendorArtifactIdentityV1,
  ];
  compatibilitySetHash: Sha256V1;
  vendorLockProjectionHash: Sha256V1;
}>;

export type ProductBuildAuthorityV2DeliveryEvidenceV1 = Readonly<{
  schema: "mission-control.product-build-authority-v2-delivery-evidence.v1";
  currentStatus: "current";
  deliveryPrNumber: 19;
  deliveryMergeSha: "240e779d78804843a1202cbf0440fe423b806b1a";
  deliveryMergeAncestorOfCurrentSource: true;
  currentSource: Readonly<{
    branch: "main";
    clean: true;
    sha: GitObjectHashV1;
    treeHash: GitObjectHashV1;
    buildHash: Sha256V1;
    originMainSha: GitObjectHashV1;
  }>;
  deliveredPathBlobs: readonly [
    ProductBuildAuthorityV2PathBlobIdentityV1,
    ProductBuildAuthorityV2PathBlobIdentityV1,
    ProductBuildAuthorityV2PathBlobIdentityV1,
    ProductBuildAuthorityV2PathBlobIdentityV1,
    ProductBuildAuthorityV2PathBlobIdentityV1,
    ProductBuildAuthorityV2PathBlobIdentityV1,
    ProductBuildAuthorityV2PathBlobIdentityV1,
    ProductBuildAuthorityV2PathBlobIdentityV1,
  ];
  focusedTests: ProductBuildAuthorityV2FocusedTestReceiptV1;
  vendorLock: ProductBuildAuthorityV2VendorLockProjectionV1;
  deliveryEvidenceRef: CanonicalRef;
  deliveryEvidenceHash: Sha256V1;
}>;

export type ProductBuildAuthorityV2DeliveryEvidenceResponseV1 = Readonly<{
  schema: "mission-control.product-build-authority-v2-delivery-evidence-response.v1";
  currentStatus: "current";
  deliveryEvidenceRef: CanonicalRef;
  deliveryEvidenceHash: Sha256V1;
  evidence: ProductBuildAuthorityV2DeliveryEvidenceV1;
}>;
```

The eight `deliveredPathBlobs[].path` values are, in order: `server/routes/setfarm-operational.test.ts`, `server/routes/setfarm-operational.ts`, `server/services/setfarm-product-build-authority.ts`, `server/services/setfarm-product-build-authority.test.ts`, `src/lib/product-build-authority.ts`, `src/components/run-detail/ProductBuildAuthority.tsx`, `tests/product-build-authority-render.test.tsx`, and `contracts/vendor/setfarm/mission-control-contracts.v1.lock.json`. `focusedTests.testPathBlobs` uses exactly the three test paths in `argv`, in the same order. The exact ordered `{producerPath,vendoredPath,sha256}` identities in `vendorLock.artifacts` are:

1. `contracts/generated/mission-control/run-operational-snapshot.v1.compatibility.json` → `contracts/vendor/setfarm/run-operational-snapshot.v1.compatibility.json`
2. `contracts/generated/mission-control/run-operational-snapshot.v1.schema.json` → `contracts/vendor/setfarm/run-operational-snapshot.v1.schema.json`
3. `contracts/generated/mission-control/run-operational-snapshot.v2.compatibility.json` → `contracts/vendor/setfarm/run-operational-snapshot.v2.compatibility.json`
4. `contracts/generated/mission-control/run-operational-snapshot.v2.schema.json` → `contracts/vendor/setfarm/run-operational-snapshot.v2.schema.json`
5. `contracts/generated/mission-control/run-operational-snapshot.v3.compatibility.json` → `contracts/vendor/setfarm/run-operational-snapshot.v3.compatibility.json`
6. `contracts/generated/mission-control/run-operational-snapshot.v3.schema.json` → `contracts/vendor/setfarm/run-operational-snapshot.v3.schema.json`
7. `contracts/generated/mission-control/deployment-observation.v1.compatibility.json` → `contracts/vendor/setfarm/deployment-observation.v1.compatibility.json`
8. `contracts/generated/mission-control/deployment-observation.v1.schema.json` → `contracts/vendor/setfarm/deployment-observation.v1.schema.json`
9. `contracts/generated/mission-control/project-transfer-ack.v1.compatibility.json` → `contracts/vendor/setfarm/project-transfer-ack.v1.compatibility.json`
10. `contracts/generated/mission-control/project-transfer-ack.v1.schema.json` → `contracts/vendor/setfarm/project-transfer-ack.v1.schema.json`
11. `contracts/generated/mission-control/operational-active-run-status.v1.compatibility.json` → `contracts/vendor/setfarm/operational-active-run-status.v1.compatibility.json`
12. `contracts/generated/mission-control/operational-active-run-status.v1.schema.json` → `contracts/vendor/setfarm/operational-active-run-status.v1.schema.json`

The later run-operational-model-v2 pair appends positions 13–14 and never reorders these twelve.

`producerCommit`, fixed `deliveryMergeSha`, `currentSource.sha`, `currentSource.treeHash`, and `currentSource.originMainSha` are parsed with `GIT_OBJECT_HASH_V1_PATTERN`; no content hash uses that grammar. Every path `blobHash`, build hash, command/receipt hash, artifact `sha256`, lock hash, compatibility/projection hash, and evidence hash is parsed with `SHA256_V1_PATTERN`. `commandContractHash = hashCanonicalJson({argv})`; `focusedTestReceiptHash` hashes the focused-test receipt excluding its two derived pair members, and its ref is `mission-control://internal-production/product-build-authority-v2-focused-test-receipt/sha256/<hash>`. `lockContentHash` is SHA-256 of the exact checked-in lock-file bytes; `compatibilitySetHash = hashCanonicalJson({schema:"mission-control.setfarm-contract-compatibility-set.v1",artifacts})`; `vendorLockProjectionHash` hashes that strict projection excluding only itself. `deliveryEvidenceHash` hashes the strict evidence object excluding only `deliveryEvidenceRef` and `deliveryEvidenceHash`, and its ref is exactly `mission-control://internal-production/product-build-authority-v2-delivery-evidence/sha256/<hash>`. The response duplicates the same pair and requires `response.deliveryEvidenceRef/hash === response.evidence.deliveryEvidenceRef/hash`. JSON emitters write properties in the declaration order above; canonical hashes use repository canonical JSON. There are no optional fields and no nullable success fields at any depth. Boundary fixtures accept lowercase Git-object lengths 40 and 64, reject lengths 39/41/63/65, uppercase and non-hex for every Git field, and prove every SHA-256 field rejects 40-hex as well as 63/65, uppercase, and non-hex. Unavailability is a non-200/failed zero-output observation, never a JSON object with null evidence or a partial pair.

The same Task 0 module provides zero-input `observeCurrentProductBuildAuthorityV2DeliveryEvidenceV1()` as a required Task 0 postcondition. It obtains the Mission Control executable/source identity only from A's code-owned `observeInternalProductionRuntimeSourceV1()` projection plus Task 6 Step 8's freshly resolved clean-main/build identity; it never resolves a sibling checkout or accepts a path. Before Task 7, the observer starts only Mission Control's fixed non-listening source CLI from that authenticated clean-main build; after Task 7 loads the new Mission Control service, it uses only fixed loopback `GET /api/internal-production/product-build-authority-v2-delivery-evidence`. The returned `observationTransport` is strictly `source-cli | http`; current-entry requires `source-cli`, post-rebind requires `http`, and both must parse through the local schema and resolve to the identical delivery-evidence pair. No caller chooses transport, URL, root, command, ref, hash, response, parser, schema, fixture, or fallback. `resolveProductBuildAuthorityV2DeliveryEvidenceV1({deliveryEvidenceRef,deliveryEvidenceHash})` is pair-only and reobserves/recomputes the named projection rather than treating any per-run `authorityHash` as a global pair. Task 0 unit tests are source-constructible before Task 1 because they use only the local canonical fixtures and private injected transports; the later Task 6 Step 8/Task 7 integration exercises the real CLI/HTTP wire bytes without importing either repository's implementation into the other.

Task 0 also owns Task 7's strict successor ABI in `src/internal-production/baseline-post-handoff-receipt-v1.ts`: `InternalProductionPostRebindEntryAuthorityV1`, exact pair `InternalProductionPostRebindEntryAuthorityPairV1`, discriminated `InternalProductionPostRebindEntryAuthorityStatusV1`, fixed private content-addressed store, `resolveInternalProductionPostRebindEntryAuthorityV1({postRebindEntryAuthorityRef,postRebindEntryAuthorityHash})`, zero-input `resumeInternalProductionPostRebindEntryAuthorityV1()`, `observeInternalProductionPostRebindEntryAuthorityStatusV1()`, and `verifyCurrentInternalProductionPostRebindEntryAuthorityV1()`. The CLI adds only `resume-post-rebind-entry|post-rebind-entry-status|verify-post-rebind-entry --json`; none accepts predecessor, root, SHA, migration, restart, service, schema, owner, receipt body, or locator input.

Task 0 also owns exact `InternalProductionBaselineRestartSequenceIntentKindV1`, `InternalProductionBaselineServiceRestartAuthorityPairV1`, `InternalProductionBaselineRestartSequenceReceiptV1`, `InternalProductionBaselineRestartSequenceStatusV1`, `resumeInternalProductionBaselineRestartSequenceV1({intentKind})`, `observeInternalProductionBaselineRestartSequenceStatusV1({intentKind})`, and `resolveInternalProductionBaselineRestartSequenceReceiptV1({sequenceRef,sequenceHash})`. The CLI surface adds only `resume-restart-sequence --intent live-rebind|d-startup-hook-load|documentation-rollback --json` and read-only `restart-sequence-status --intent live-rebind|d-startup-hook-load|documentation-rollback --json`; all other arguments fail before observation or mutation.

Task 0's exact A-owned cutover ABI additionally includes `InternalProductionGlobalOwnerAdmissionFencePurposeV1`, `InternalProductionGlobalOwnerAdmissionFenceV1`, narrow null-target `acquireInternalProductionGlobalOwnerAdmissionFenceV1(...)`, dedicated `acquireInternalProductionSourceRunLaunchOwnerAdmissionFenceV1(...)`, dedicated `acquireInternalProductionRecoveryRestartOwnerAdmissionFenceV1(...)`, `reobserveInternalProductionGlobalOwnerAdmissionFenceV1(...)`, `closeInternalProductionSourceRunLaunchTargetReservationsUnderFenceV1(...)`, `closeInternalProductionRecoveryRestartTargetsUnderFenceV1(...)`, `INTERNAL_PRODUCTION_OWNER_CATEGORY_REGISTRY_V1`, `InternalProductionCompleteZeroOwnerCensusV1`, the key-checked `INTERNAL_PRODUCTION_OWNER_CATEGORY_CENSUS_MAP_V1`, `InternalProductionOwnerProducerRowV1`, `InternalProductionOwnerProducerManifestV1`, the eleven-row `INTERNAL_PRODUCTION_OWNER_PRODUCER_ROWS_A_V1`, exact `INTERNAL_PRODUCTION_OWNER_PRODUCER_MANIFEST_A_V1`, `InternalProductionOwnerProducerManifestSetActivationPredecessorV1`, `InternalProductionOwnerProducerManifestSetActivationCurrentV1`, `InternalProductionOwnerProducerManifestSetActivationStoreV1`, `activateInternalProductionOwnerProducerManifestSetV1(...)`, `resolveInternalProductionOwnerProducerManifestSetActivationV1(...)`, zero-input `resolveCurrentInternalProductionOwnerProducerManifestSetActivationV1()`, `InternalProductionBaselineOwnerProducerManifestActivationReceiptV1`, `InternalProductionBaselineOwnerProducerManifestActivationStatusV1`, zero-input `activateInternalProductionBaselineOwnerProducerManifestV1()`, zero-input read-only `observeInternalProductionBaselineOwnerProducerManifestActivationStatusV1()`, `assembleInternalProductionOwnerProducerRegistryV1(...)`, `InternalProductionOwnerReservationV1`, `beginOrAdoptInternalProductionOwnerReservationV1(...)`, `closeInternalProductionOwnerReservationV1(...)`, and their pair-only resolvers. It also owns `InternalProductionPhysicalServiceRestartAuthorityCutoverOperationV1` and `resolveInternalProductionPhysicalServiceRestartAuthorityCutoverOperationV1({operationRef,operationHash})`, plus the finite recovery-source bootstrap ABI `InternalProductionRecoverySourceBootstrapOperationV1`, `prepareInternalProductionRecoverySourceBootstrapRunV1()`, zero-input `resumeActiveInternalProductionRecoverySourceBootstrapRunV1()`, and read-only `observeInternalProductionRecoverySourceBootstrapStatusV1()`. The immutable cutover operation is private/path-free and exists before its bound guard can be consumed; D receives no operation pair and imports no operation writer.

Task 0 creates the `acceptance:baseline-post-handoff` package command as a required postcondition; it owns the exact additional CLI verbs `prepare-recovery-source-bootstrap --json`, zero-input `resume-recovery-source-bootstrap --json`, read-only `recovery-source-bootstrap-status --json`, read-only zero-input `owner-producer-manifest-status --json`, read-only zero-input `observe-product-build-authority-v2-delivery-evidence --json`, `audit-authority-v3-migration31 --json`, `inspect-pending-bootstrap-handoff-successor --json`, and `verify-bootstrap-handoff-migration-current --json`. A-manifest activation and pre-schema restart/migration operations are current-entry-controller-only ports with no standalone production command. Its command table is exactly:

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

export type InternalProductionLegacyPreManifestZeroOwnerObservationV1 = Readonly<{
  schema: "setfarm.internal-production-legacy-pre-manifest-zero-owner-observation.v1";
  observationKind: "legacy-pre-manifest-existing-live-truth";
  authorityV3Migration31AuditRef: CanonicalRef;
  authorityV3Migration31AuditHash: string;
  cleanSetfarmSourceSha: GitObjectHashV1;
  cleanSetfarmTreeHash: GitObjectHashV1;
  cleanSetfarmBuildHash: Sha256V1;
  observedSpawnerGenerationHash: Sha256V1;
  census: InternalProductionCompleteZeroOwnerCensusV1;
  allThirtySixScalarCountsZero: true;
  ownerReservationSidecarState: "absent-before-migration-32";
  ownerAdmissionHeadState: "absent-before-migration-32";
  manifestActivationState: "absent-before-initial-a-activation";
  observationRef: CanonicalRef;
  observationHash: Sha256V1;
}>;

export type InternalProductionPreSchemaSpawnerRebindAuthorizationPairV1 = Readonly<{
  authorizationRef: CanonicalRef;
  authorizationHash: Sha256V1;
}>;
export type InternalProductionPreSchemaSpawnerRebindAuthorizationV1 = Readonly<{
  schema: "setfarm.internal-production-pre-schema-spawner-rebind-authorization.v1";
  purpose: "task6a-pre-schema-setfarm-spawner-rebind-v1";
  service: "setfarm-spawner";
  authorityV3Migration31AuditRef: CanonicalRef;
  authorityV3Migration31AuditHash: Sha256V1;
  legacyZeroOwnerObservationRef: CanonicalRef;
  legacyZeroOwnerObservationHash: Sha256V1;
  cleanSetfarmSourceSha: GitObjectHashV1;
  cleanSetfarmTreeHash: GitObjectHashV1;
  cleanSetfarmBuildHash: Sha256V1;
  predecessorSpawnerServiceIdentityHash: Sha256V1;
  predecessorSpawnerGenerationHash: Sha256V1;
  authorizationRef: CanonicalRef;
  authorizationHash: Sha256V1;
}>;
export type InternalProductionPreSchemaSpawnerStartupTokenV1 = Readonly<{
  schema: "setfarm.internal-production-pre-schema-spawner-startup-token.v1";
  startupMode: "pre-manifest-bootstrap-sealed";
  currentEntryOperationRef: CanonicalRef;
  currentEntryOperationHash: Sha256V1;
  preSchemaSpawnerRebindAuthorizationRef: CanonicalRef;
  preSchemaSpawnerRebindAuthorizationHash: Sha256V1;
  task0SpawnerSourceSha: GitObjectHashV1;
  task0SpawnerBuildHash: Sha256V1;
  predecessorSpawnerGenerationHash: Sha256V1;
  expectedNextSpawnerGenerationHash: Sha256V1;
  startupTokenRef: CanonicalRef;
  startupTokenHash: Sha256V1;
}>;
export type InternalProductionPreSchemaSpawnerSealedAdmissionV1 = Readonly<{
  schema: "setfarm.internal-production-pre-schema-spawner-sealed-admission.v1";
  state: "pre-manifest-bootstrap-sealed";
  startupTokenRef: CanonicalRef;
  startupTokenHash: Sha256V1;
  preSchemaSpawnerRestartAuthorityRef: CanonicalRef;
  preSchemaSpawnerRestartAuthorityHash: Sha256V1;
  predecessorSpawnerTerminatedHash: Sha256V1;
  currentSpawnerGenerationHash: Sha256V1;
  postPredecessorTerminationLegacyZeroOwnerObservationRef: CanonicalRef;
  postPredecessorTerminationLegacyZeroOwnerObservationHash: Sha256V1;
  allOwnerProducerEntrypointsBlocked: true;
  sealedAdmissionRef: CanonicalRef;
  sealedAdmissionHash: Sha256V1;
}>;
export type InternalProductionTask0SpawnerAdmissionReadyV1 = Readonly<{
  schema: "setfarm.internal-production-task0-spawner-admission-ready.v1";
  state: "normal-task0-admission-ready";
  sealedAdmissionRef: CanonicalRef;
  sealedAdmissionHash: Sha256V1;
  migrationReceiptRef: CanonicalRef;
  migrationReceiptHash: Sha256V1;
  migrationCurrentAuditRef: CanonicalRef;
  migrationCurrentAuditHash: Sha256V1;
  manifestActivationRef: CanonicalRef;
  manifestActivationHash: Sha256V1;
  manifestHeadRef: CanonicalRef;
  manifestHeadHash: Sha256V1;
  unchangedSpawnerGenerationHash: Sha256V1;
  genericFullVerifyStatus: "verified";
  normalDatabaseInitializationStatus: "ready";
  admissionReadyRef: CanonicalRef;
  admissionReadyHash: Sha256V1;
}>;
export type InternalProductionPreSchemaSpawnerRebindStatusV1 = Readonly<{
  schema: "setfarm.internal-production-pre-schema-spawner-rebind-status.v1";
  state: "absent" | "prepared" | "dispatching" | "pre-manifest-bootstrap-sealed" |
    "normal-task0-admission-ready" | "blocked";
  authorizationRef: CanonicalRef | null;
  authorizationHash: Sha256V1 | null;
  startupTokenRef: CanonicalRef | null;
  startupTokenHash: Sha256V1 | null;
  restartAuthorityRef: CanonicalRef | null;
  restartAuthorityHash: Sha256V1 | null;
  sealedAdmissionRef: CanonicalRef | null;
  sealedAdmissionHash: Sha256V1 | null;
  admissionReadyRef: CanonicalRef | null;
  admissionReadyHash: Sha256V1 | null;
  refusalCode: string | null;
  statusHash: Sha256V1;
}>;
export interface InternalProductionPreSchemaSpawnerRebindAuthorizationStoreV1 {
  prepare(input: InternalProductionPreSchemaSpawnerRebindAuthorizationV1):
    Promise<InternalProductionPreSchemaSpawnerRebindAuthorizationPairV1>;
  resolve(input: InternalProductionPreSchemaSpawnerRebindAuthorizationPairV1):
    Promise<InternalProductionPreSchemaSpawnerRebindAuthorizationV1>;
  observeFixedStatus(): Promise<InternalProductionPreSchemaSpawnerRebindStatusV1>;
}
export function prepareInternalProductionPreSchemaSpawnerRebindAuthorizationV1():
  Promise<InternalProductionPreSchemaSpawnerRebindAuthorizationPairV1>;
export function executeOrRecoverInternalProductionPreSchemaSpawnerRebindV1(
  input: InternalProductionPreSchemaSpawnerRebindAuthorizationPairV1,
): Promise<Readonly<{ restartAuthorityRef: CanonicalRef; restartAuthorityHash: Sha256V1 }>>;
export function resolveInternalProductionPreSchemaSpawnerRebindAuthorizationV1(
  input: InternalProductionPreSchemaSpawnerRebindAuthorizationPairV1,
): Promise<InternalProductionPreSchemaSpawnerRebindAuthorizationV1>;
export function observeInternalProductionPreSchemaSpawnerRebindStatusV1():
  Promise<InternalProductionPreSchemaSpawnerRebindStatusV1>;

export type InternalProductionPreManifestMigration32AuthorizationPairV1 = Readonly<{
  authorizationRef: CanonicalRef;
  authorizationHash: Sha256V1;
}>;
export type InternalProductionPreManifestMigration32AuthorizationV1 = Readonly<{
  schema: "setfarm.internal-production-pre-manifest-migration-32-authorization.v1";
  purpose: "task6a-guarded-migration-32-after-sealed-spawner-v1";
  sealedSpawnerAdmissionRef: CanonicalRef;
  sealedSpawnerAdmissionHash: Sha256V1;
  postPredecessorTerminationLegacyZeroOwnerObservationRef: CanonicalRef;
  postPredecessorTerminationLegacyZeroOwnerObservationHash: Sha256V1;
  authorityV3Migration31AuditRef: CanonicalRef;
  authorityV3Migration31AuditHash: Sha256V1;
  pendingBootstrapHandoffMigrationRef: CanonicalRef;
  pendingBootstrapHandoffMigrationHash: Sha256V1;
  cleanSetfarmSourceSha: GitObjectHashV1;
  cleanSetfarmTreeHash: GitObjectHashV1;
  cleanSetfarmBuildHash: Sha256V1;
  freshLegacyZeroOwnerObservationRef: CanonicalRef;
  freshLegacyZeroOwnerObservationHash: Sha256V1;
  authorizationRef: CanonicalRef;
  authorizationHash: Sha256V1;
}>;
export type InternalProductionPreManifestMigration32AuthorizationStatusV1 = Readonly<{
  schema: "setfarm.internal-production-pre-manifest-migration-32-authorization-status.v1";
  state: "absent" | "prepared" | "consumed" | "blocked";
  authorizationRef: CanonicalRef | null;
  authorizationHash: Sha256V1 | null;
  migrationReceiptRef: CanonicalRef | null;
  migrationReceiptHash: Sha256V1 | null;
  refusalCode: string | null;
  statusHash: Sha256V1;
}>;
export interface InternalProductionPreManifestMigration32AuthorizationStoreV1 {
  prepare(input: InternalProductionPreManifestMigration32AuthorizationV1):
    Promise<InternalProductionPreManifestMigration32AuthorizationPairV1>;
  resolve(input: InternalProductionPreManifestMigration32AuthorizationPairV1):
    Promise<InternalProductionPreManifestMigration32AuthorizationV1>;
  observeFixedStatus(): Promise<InternalProductionPreManifestMigration32AuthorizationStatusV1>;
}
export function prepareInternalProductionPreManifestMigration32AuthorizationV1():
  Promise<InternalProductionPreManifestMigration32AuthorizationPairV1>;
export function resolveInternalProductionPreManifestMigration32AuthorizationV1(
  input: InternalProductionPreManifestMigration32AuthorizationPairV1,
): Promise<InternalProductionPreManifestMigration32AuthorizationV1>;
export function observeInternalProductionPreManifestMigration32AuthorizationStatusV1():
  Promise<InternalProductionPreManifestMigration32AuthorizationStatusV1>;

export type InternalProductionBaselineRestartServiceV1 =
  | "setfarm-spawner"
  | "setfarm-dashboard"
  | "mission-control";
export type InternalProductionBaselineServiceRestartAuthorizationPairV1 = Readonly<{
  authorizationRef: CanonicalRef;
  authorizationHash: string;
}>;
export type InternalProductionBaselineServiceRestartAuthorizationV1 = Readonly<{
  schema: "setfarm.internal-production-baseline-service-restart-authorization.v1";
  service: InternalProductionBaselineRestartServiceV1;
  migrationReceiptRef: CanonicalRef;
  migrationReceiptHash: string;
  zeroOwnerGuardRef: CanonicalRef;
  zeroOwnerGuardHash: string;
  completeZeroOwnerCensusHash: string;
  preparedRuntimeSourceProjectionHash: string;
  authorizationRef: CanonicalRef;
  authorizationHash: string;
}>;
export type InternalProductionBaselineServiceRestartAuthorizationStatusV1 =
  | Readonly<{
      schema: "setfarm.internal-production-baseline-service-restart-authorization-status.v1";
      state: "absent";
      authorizationRef: null; authorizationHash: null;
      consumptionRef: null; consumptionHash: null; statusHash: string;
    }>
  | Readonly<{
      schema: "setfarm.internal-production-baseline-service-restart-authorization-status.v1";
      state: "prepared";
      authorizationRef: CanonicalRef; authorizationHash: string;
      consumptionRef: null; consumptionHash: null; statusHash: string;
    }>
  | Readonly<{
      schema: "setfarm.internal-production-baseline-service-restart-authorization-status.v1";
      state: "consumed";
      authorizationRef: CanonicalRef; authorizationHash: string;
      consumptionRef: CanonicalRef; consumptionHash: string; statusHash: string;
    }>
  | Readonly<{
      schema: "setfarm.internal-production-baseline-service-restart-authorization-status.v1";
      state: "blocked";
      authorizationRef: CanonicalRef; authorizationHash: string;
      consumptionRef: CanonicalRef | null; consumptionHash: string | null;
      refusalCode: string; statusHash: string;
    }>;
export interface InternalProductionBaselineServiceRestartAuthorizationStoreV1 {
  prepare(input: InternalProductionBaselineServiceRestartAuthorizationV1):
    Promise<InternalProductionBaselineServiceRestartAuthorizationPairV1>;
  resolve(input: InternalProductionBaselineServiceRestartAuthorizationPairV1):
    Promise<InternalProductionBaselineServiceRestartAuthorizationV1>;
  observeStatus(input: InternalProductionBaselineServiceRestartAuthorizationPairV1):
    Promise<InternalProductionBaselineServiceRestartAuthorizationStatusV1>;
}
export function prepareInternalProductionBaselineServiceRestartV1(input: Readonly<{
  service: InternalProductionBaselineRestartServiceV1;
}>): Promise<InternalProductionBaselineServiceRestartAuthorizationPairV1>;
export function resolveInternalProductionBaselineServiceRestartAuthorizationV1(
  input: InternalProductionBaselineServiceRestartAuthorizationPairV1,
): Promise<InternalProductionBaselineServiceRestartAuthorizationV1>;
export function observeInternalProductionBaselineServiceRestartAuthorizationStatusV1(
  input: InternalProductionBaselineServiceRestartAuthorizationPairV1,
): Promise<InternalProductionBaselineServiceRestartAuthorizationStatusV1>;
export function restartInternalProductionBaselineServiceV1(
  input: InternalProductionBaselineServiceRestartAuthorizationPairV1,
): Promise<Readonly<{ receiptRef: CanonicalRef; receiptHash: string }>>;

export type InternalProductionBaselineBootstrapHandoffMigrationReceiptV1 = Readonly<{
  schema: "setfarm.internal-production-baseline-bootstrap-handoff-migration-receipt.v1";
  migrationId: "contract-spine-bootstrap-main-claim-handoff-v1";
  predecessorAuthorityV3Migration31AuditRef: CanonicalRef;
  predecessorAuthorityV3Migration31AuditHash: string;
  pendingBootstrapHandoffMigrationRef: CanonicalRef;
  pendingBootstrapHandoffMigrationHash: string;
  migrationSourceSha: string;
  migrationImplementationBlobHash: string;
  orderedStatementsHash: string;
  namedMigrationDigestEntryHash: string;
  migrationDigest: string;
  schemaProjectionHash: string;
  preSchemaSpawnerRebindAuthorizationRef: CanonicalRef;
  preSchemaSpawnerRebindAuthorizationHash: string;
  preSchemaSpawnerStartupTokenRef: CanonicalRef;
  preSchemaSpawnerStartupTokenHash: string;
  preSchemaSpawnerSealedAdmissionRef: CanonicalRef;
  preSchemaSpawnerSealedAdmissionHash: string;
  preManifestLegacyZeroOwnerObservationRef: CanonicalRef;
  preManifestLegacyZeroOwnerObservationHash: string;
  preManifestMigration32AuthorizationRef: CanonicalRef;
  preManifestMigration32AuthorizationHash: string;
  preManifestMigration32AuthorizationConsumed: true;
  planStatus: "exact-pending-migration";
  applyStatus: "applied";
  verifyStatus: "verified";
  bootstrapHandoffOperationTablePresent: true;
  bootstrapHandoffOperationIdUnique: true;
  bootstrapHandoffClaimIdUnique: true;
  terminalReceiptPairColumnsPresent: true;
  ownerReservationSidecarPresent: true;
  ownerAdmissionHeadPresent: true;
  migrationReceiptRef: CanonicalRef;
  migrationReceiptHash: string;
}>;

export function applyInternalProductionBaselineBootstrapHandoffMigrationV1(
  input: Readonly<{
    authorizationRef: CanonicalRef;
    authorizationHash: string;
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

// migrationReceiptHash covers every field above except the two derived
// migrationReceiptRef/migrationReceiptHash members, including both exact
// causal predecessor pairs.

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
  ownerKey: string;
  ownerKeyHash: string;
  producerPurposeHash: string;
  producerImplementationId: InternalProductionOwnerProducerImplementationIdV1;
  producerImplementationHash: string;
  canonicalOwnerIdentity: null;
  state: "pending";
  ownerAdmissionHeadPredecessorHash: string;
  reservationRef: CanonicalRef;
  reservationHash: string;
}>;
export type InternalProductionCanonicalOwnerIdentityV1<
  Category extends InternalProductionOwnerCategoryV1 = InternalProductionOwnerCategoryV1,
> = Readonly<{
  schema: "setfarm.internal-production-canonical-owner-identity.v1";
  category: Category;
  ownerKey: string;
  ownerRef: CanonicalRef;
  ownerHash: string;
}>;
export type InternalProductionBoundOwnerReservationV1<
  Category extends InternalProductionOwnerCategoryV1 = InternalProductionOwnerCategoryV1,
> = Readonly<{
  schema: "setfarm.internal-production-bound-owner-reservation.v1";
  category: Category;
  producerImplementationId: InternalProductionOwnerProducerImplementationIdV1;
  ownerKey: string;
  reservationRef: CanonicalRef;
  reservationHash: string;
  canonicalOwnerIdentity: InternalProductionCanonicalOwnerIdentityV1<Category>;
  state: "bound";
  bindingHash: string;
}>;
export type InternalProductionTerminalOwnerAuthorityV1<
  Category extends InternalProductionOwnerCategoryV1 = InternalProductionOwnerCategoryV1,
> = Readonly<{
  schema: "setfarm.internal-production-terminal-owner-authority.v1";
  category: Category;
  ownerKey: string;
  ownerRef: CanonicalRef;
  ownerHash: string;
  terminalOwnerRef: CanonicalRef;
  terminalOwnerHash: string;
}>;
export type InternalProductionTerminalOwnerAuthorityPairV1 = Readonly<{
  terminalAuthorityRef: CanonicalRef;
  terminalAuthorityHash: string;
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

export type PgTransactionSql = postgres.TransactionSql;
export interface InternalProductionOwnerAdmissionRepositoryV1 {
  withTransaction<Result>(operation: (sql: PgTransactionSql) => Promise<Result>): Promise<Result>;
  resolveReservation(sql: PgTransactionSql, input: Readonly<{
    reservationRef: CanonicalRef;
    reservationHash: string;
  }>): Promise<InternalProductionOwnerReservationV1>;
  resolveClose(sql: PgTransactionSql, input: Readonly<{
    closeRef: CanonicalRef;
    closeHash: string;
  }>): Promise<InternalProductionOwnerReservationCloseV1>;
  beginOrAdoptInTransactionV1(sql: PgTransactionSql, input: Readonly<{
    producerImplementationId: InternalProductionOwnerProducerImplementationIdV1;
    ownerKey: string;
  }>): Promise<InternalProductionOwnerReservationV1>;
  bindInTransactionV1<Category extends InternalProductionOwnerCategoryV1>(
    sql: PgTransactionSql,
    input: Readonly<{
      reservationRef: CanonicalRef;
      reservationHash: string;
      canonicalOwnerIdentity: InternalProductionCanonicalOwnerIdentityV1<Category>;
    }>,
  ): Promise<InternalProductionBoundOwnerReservationV1<Category>>;
  closeInTransactionV1<Category extends InternalProductionOwnerCategoryV1>(
    sql: PgTransactionSql,
    input: Readonly<{
      reservationRef: CanonicalRef;
      reservationHash: string;
      resolvedTerminalAuthority: InternalProductionTerminalOwnerAuthorityV1<Category>;
    }>,
  ): Promise<InternalProductionOwnerReservationCloseV1>;
}
export interface InternalProductionOwnerAdmissionControllerV1 {
  resolveInternalProductionOwnerReservationV1(
    sql: PgTransactionSql,
    input: Readonly<{ reservationRef: CanonicalRef; reservationHash: string }>,
  ): Promise<InternalProductionOwnerReservationV1>;
  resolveInternalProductionOwnerReservationCloseV1(
    sql: PgTransactionSql,
    input: Readonly<{ closeRef: CanonicalRef; closeHash: string }>,
  ): Promise<InternalProductionOwnerReservationCloseV1>;
  beginOrAdoptInternalProductionOwnerReservationV1(
    sql: PgTransactionSql,
    input: Readonly<{
      producerImplementationId: InternalProductionOwnerProducerImplementationIdV1;
      ownerKey: string;
    }>,
  ): Promise<InternalProductionOwnerReservationV1>;
  bindInternalProductionOwnerReservationV1<Category extends InternalProductionOwnerCategoryV1>(
    sql: PgTransactionSql,
    input: Readonly<{
      reservationRef: CanonicalRef;
      reservationHash: string;
      canonicalOwnerIdentity: InternalProductionCanonicalOwnerIdentityV1<Category>;
    }>,
  ): Promise<InternalProductionBoundOwnerReservationV1<Category>>;
  closeInternalProductionOwnerReservationV1(
    sql: PgTransactionSql,
    input: Readonly<{
      reservationRef: CanonicalRef;
      reservationHash: string;
      terminalAuthorityRef: CanonicalRef;
      terminalAuthorityHash: string;
    }>,
  ): Promise<InternalProductionOwnerReservationCloseV1>;
}
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

// Guarded migration 32 creates the PostgreSQL reservation sidecar and its
// singleton owner-admission-head CAS relation. The producer passes one
// PgTransactionSql through reservation resolution, begin/adopt, canonical
// owner insert, bind, terminal resolution, close, and close resolution.
// Production composition and the fixed category resolver table live only in
// src/db-pg.ts; callers cannot supply a repository, resolver, or factory.
// Close accepts only two pairs. No filesystem atomicity is claimed.

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
    expectedModuleRelativePath: "src/internal-production/internal-production-service-restart-authority-v1.ts",
    expectedExportName: "reserveInternalProductionServiceRestartDispatchOwnerV1",
  },
  serviceRestartOperationReservation: {
    role: "service-restart-operation",
    category: "service-restart-operation",
    producerImplementationId: "d-service-restart-operation-v1",
    expectedModuleRelativePath: "src/internal-production/internal-production-service-restart-authority-v1.ts",
    expectedExportName: "reserveInternalProductionServiceRestartOperationOwnerV1",
  },
  launchOutboxReservation: {
    role: "launch-outbox",
    category: "launch-outbox",
    producerImplementationId: "d-service-restart-launch-outbox-v1",
    expectedModuleRelativePath: "src/internal-production/internal-production-service-restart-authority-v1.ts",
    expectedExportName: "publishInternalProductionServiceRestartLaunchOutboxUnderFenceV1",
  },
  helperProcessReservation: {
    role: "helper-process",
    category: "process",
    producerImplementationId: "d-service-restart-helper-process-v1",
    expectedModuleRelativePath: "src/internal-production/internal-production-service-restart-authority-v1.ts",
    expectedExportName: "publishInternalProductionServiceRestartHelperProcessUnderFenceV1",
  },
  dispatchChildProcessReservation: {
    role: "dispatch-child-process",
    category: "process",
    producerImplementationId: "d-service-restart-child-process-v1",
    expectedModuleRelativePath: "src/internal-production/internal-production-service-restart-authority-v1.ts",
    expectedExportName: "publishInternalProductionServiceRestartDispatchChildProcessUnderFenceV1",
  },
  startupListenerReservation: {
    role: "startup-listener",
    category: "listener",
    producerImplementationId: "d-service-restart-startup-listener-v1",
    expectedModuleRelativePath: "src/internal-production/internal-production-service-restart-authority-v1.ts",
    expectedExportName: "publishInternalProductionServiceRestartStartupListenerUnderFenceV1",
  },
  replacementProcessReservation: {
    role: "replacement-process",
    category: "process",
    producerImplementationId: "d-service-restart-replacement-process-v1",
    expectedModuleRelativePath: "src/internal-production/internal-production-service-restart-authority-v1.ts",
    expectedExportName: "publishInternalProductionServiceRestartReplacementProcessUnderFenceV1",
  },
} as const;

export const INTERNAL_PRODUCTION_RECOVERY_RESTART_TARGET_FAMILY_ABI_HASH_V1 =
  "c3d88ba2dc7d9e70d773d0056d2fdeaced399f63adc7fd1c37eb423fa22d08d5" as const;
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

type InternalProductionRecoveryDForwardRegistryKeyV1 = Exclude<
  keyof typeof INTERNAL_PRODUCTION_RECOVERY_RESTART_TARGET_FAMILY_ABI_V1,
  "schema"
>;
export type InternalProductionRecoveryDForwardImplementationIdentityV1<
  Key extends InternalProductionRecoveryDForwardRegistryKeyV1,
> = Readonly<
  (typeof INTERNAL_PRODUCTION_RECOVERY_RESTART_TARGET_FAMILY_ABI_V1)[Key] & {
  moduleBlobHash: string;
  sourceSha: string;
  buildHash: string;
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
  dForwardIdentityRegistryHash:
    typeof INTERNAL_PRODUCTION_RECOVERY_RESTART_TARGET_FAMILY_ABI_HASH_V1;
  dForwardImplementationIdentities: readonly [
    InternalProductionRecoveryDForwardImplementationIdentityV1<"restartReservation">,
    InternalProductionRecoveryDForwardImplementationIdentityV1<"serviceRestartOperationReservation">,
    InternalProductionRecoveryDForwardImplementationIdentityV1<"launchOutboxReservation">,
    InternalProductionRecoveryDForwardImplementationIdentityV1<"helperProcessReservation">,
    InternalProductionRecoveryDForwardImplementationIdentityV1<"dispatchChildProcessReservation">,
    InternalProductionRecoveryDForwardImplementationIdentityV1<"startupListenerReservation">,
    InternalProductionRecoveryDForwardImplementationIdentityV1<"replacementProcessReservation">,
  ];
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
  admissionMode: "ordinary-manifest-backed";
  service: "setfarm-spawner";
  actionId: "a-restart-service-setfarm-spawner-v1";
  operationId: string;
  bootstrapOperationRef: string | null;
  bootstrapOperationHash: string | null;
  restartStartupMarkerHash: string;
  expectedRuntimeSourceProjectionHash: string;
  expectedSetfarmSha: string;
  expectedSpawnerBuildHash: string;
  migrationReceiptRef: string;
  migrationReceiptHash: string;
  manifestActivationRef: string;
  manifestActivationHash: string;
  genericFullVerifyRequired: true;
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

Task 0 must extend the existing `runtime-completion.ts` owner controller so it may mint `InternalProductionBaselineCompletionOwnerBootstrapTargetGuardV1` only while it holds the current authenticated P0 completion request/claim/run owner. It derives the request, claim, run, and owner-generation hashes internally, first drains and fences that owner against new effects, and observes zero unrelated owners; the target owner itself is the sole nonzero census member. The opaque guard is WeakMap-authenticated and cannot be serialized, cloned, minted by a worker, or used outside the one fixed bootstrap action. As a Task 0 postcondition, `prepareInternalProductionBaselineSpawnerBootstrapRestartV1({targetGuard,postSettlementContinuationKind:"setfarm-bootstrap-main-claim-allocation-v1"})` authenticates it and publishes/reopens the intent, operation, outbox, and one-use `InternalProductionBaselineSpawnerBootstrapContinuationGrantV1` before returning `{operationRef,operationHash}` and before dispatch or process replacement. The grant binds target guard, operation, bootstrap Setfarm source/tree, literal continuation kind, `authorized-no-claim`, and null claim/worktree fields; A accepts no other continuation kind and creates no claim or writer. The current completion request durably binds the operation pair before calling `executeOrRecoverInternalProductionBaselineSpawnerBootstrapRestartV1({operationRef,operationHash})`. Execute/recover may dispatch and terminate the caller; a crash immediately after dispatch but before response is recovered only by reopening the same operation pair. The A startup admission and its hidden authenticated waiter carry that exact pair into the replacement process and never reconstruct it from `operationId`, scan a locator, or accept caller fields. The operation and continuation-grant resolvers reopen only their exact pairs. After the replacement spawner activates, targeted recovery releases the exact owner, and global zero is freshly observed, `finalizeInternalProductionBaselineSpawnerBootstrapRestartSequenceV1({operationRef,operationHash})` publishes and returns `{sequenceRef,sequenceHash}`; the pair-only resolver reopens it. None of these bootstrap mutations has a public CLI. This Task 0-delivered A operation is the sole mutation the pre-P0 owner prepares and starts after P0 merge/build; it never imports or calls B.

The old-generation owner crosses the P0 build-to-restart boundary only through Task 0's required `createInternalProductionBaselineCompletionOwnerBootstrapCleanBuildVerificationV1()` and `continueInternalProductionBaselineCompletionOwnerBootstrapAfterCleanBuildV1({verification})` postconditions. The first may mint its opaque capability only after the owner receives the successful clean-main P0 build/test result and itself reopens the P0 merge/tree/file-set/build verification plus A historical/migration pairs; it binds the current request/claim/run/owner generation and accepts no caller path/SHA/hash/test result. The continuation authenticates the same live owner, mints the target guard, calls A prepare, atomically persists the exact operation pair and fixed status locator in that request, reopens them, then calls A execute/recover. It may terminate its caller and therefore no one relies on its return. Response loss or reentry adopts the same request-bound pair/locator; no pre-P0 process imports or calls a P0/B function.

The same A source claim pre-delivers one exact guarded migration containing both the owner-admission sidecar/head and bootstrap-main-claim handoff schema B P0 later consumes. `src/db/bootstrap-main-claim-handoff-v1-migration.ts` is the sole immutable owner of its migration ID, ordered statements, and schema projector; the registry/digest files remain append-only, not whole-file authority. After the reviewed A and Mission Control sources are merged and clean, Task 6A first prepares the immutable current-entry operation, then that operation's zero-input resume performs the sole pre-schema spawner restart and proves the Task 0 generation is terminally `pre-manifest-bootstrap-sealed`. Only then may the controller prepare `InternalProductionPreManifestMigration32AuthorizationV1`, which binds the sealed admission, fresh v31 audit/pending projection, clean A source/build, and a newly reobserved complete legacy/pre-manifest zero-owner observation. The controller passes only that authorization pair to the internal `applyInternalProductionBaselineBootstrapHandoffMigrationV1(...)`; no normal complete-zero guard, public migration CLI, or caller body exists. Apply consumes the authorization once, invokes the dedicated guarded port, verifies both schema families, and publishes/reopens one receipt. Initial application requires `currentSetfarmSourceSha === migrationSourceSha`; the receipt binds the causal quartet, pre-schema/sealed/legacy-census/migration-authorization chain, implementation Git blob, ordered statements, named digest entry/digest, and verified schema projection without pinning the mutable aggregate. The fixed terminal locator/resolver accepts no ID/ref/hash/path/SQL/database override. Every later consumer, including Task 7, is read-only and repeats bounded ancestry plus dedicated blob/statements/digest/schema verification. Unrelated append-only entries remain allowed. Normal restart authorization binds the same applied pair only after A activation. Current/post-rebind and baseline current/historical resolvers reopen it; B never applies schema.

For migration 32 specifically, generic plan observes pending, generic apply skips, and generic verify fails `MIGRATION_INCOMPLETE` until Task 6A's dedicated purpose-bound operation calls `applyBootstrapMainClaimHandoffGuardedMigration32V1`. Its ordered statements atomically create the bootstrap operation/claim/terminal-pair schema, `internal_production_owner_reservations_v1`, and singleton `internal_production_owner_admission_head_v1`; its projector verifies all three. The receipt hashes the exact v31 audit and pre-apply pending pairs alongside the pre-schema spawner authorization, sealed admission, fresh legacy/pre-manifest census, one-use migration authorization, apply, and schema facts. There is no generic guarded mode, pre-schema normal manifest/complete-zero authority, Task 0 live application, direct production apply CLI, or Task 7 apply path.

A also predeclares the only B-purpose guard seam in `baseline-post-handoff-receipt-v1.ts`. `bindInternalProductionBaselineGoldenLaunchMigrationZeroOwnerGuardV1()` accepts a fresh generic A zero-owner pair only after B has durably published and reopened its fixed `pendingInputRef`/`pendingInputHash`, validates the exact purpose and canonical pending-input namespace, and publishes the immutable authorization pair without consuming the guard. `consumeInternalProductionBaselineGoldenLaunchMigrationZeroOwnerGuardV1()` accepts only that authorization plus the equality-bound B operation pair, reopens both A records, and one-use consumes the underlying guard inside A before publishing the consumption pair. B never imports, authenticates, or mutates A's generic guard store directly. The authorization/consumption resolvers are read-only, pair-only, and reject another purpose, pending input, operation, replay, structural clone, or raw guard substitution.

`baseline-restart-authority-retirement-v1.ts` owns one fixed global physical-restart transition lock and one immutable two-epoch head for the ordered services `setfarm-spawner`, `setfarm-dashboard`, and `mission-control`. It also predeclares and solely owns the strict `InternalProductionServiceRestartStartupHooksReadyV1`, `InternalProductionServiceRestartAuthorityActivationV1`, and `InternalProductionServiceRestartAuthorityCutoverV1` schemas, content-addressed stores, fixed locators, code-owned runtime-hook observer/recorder, and pair-only resolvers; A imports no D schema, store, capability, callback, or body. A's `INTERNAL_PRODUCTION_RECOVERY_RESTART_TARGET_FAMILY_ABI_V1` is the physical forward-identity registry: its seven ordered records fix implementation ID, module-relative path, and export name. Readiness repeats those records in the same order and adds the observed module blob hash, clean D source SHA, and D build hash for each; all seven must agree on the reviewed D source/build and exact module blob. A reads and hashes the registered source/build identities through code-owned observers and never imports or evaluates the future D module. The separate three service startup-hook IDs remain exact runtime hook observations. No caller supplies a service, path, export, SHA, build, blob hash, generation, hook hash, verdict, or D object. Epoch one is `authorityOwner:"baseline-a"` and requires readiness/activation/retirement fields null; epoch two is `authorityOwner:"recovery-d"` and requires all three exact pairs non-null. A delivers as a Task 0 postcondition the sole two-step cutover mutation boundary: `prepareInternalProductionPhysicalServiceRestartAuthorityCutoverToRecoveryDV1({zeroOwnerGuardRef,zeroOwnerGuardHash})` and zero-input `resumeActiveInternalProductionPhysicalServiceRestartAuthorityCutoverToRecoveryDV1()`. Exactly D's reviewed cutover adapter may import those two mutations unaliased; every other D import from the A module is a type or read-only resolver/status observer, and no CLI/worker/other production module may call them. The former single-call commit, standalone retirement export, and every D-owned readiness/activation/cutover writer do not exist. Under the one transition lock, resume follows the exact operation-first durability order below, then performs one expected-predecessor visibility CAS from epoch one to the complete A-owned readiness/retirement/activation/cutover/epoch-two tuple. Before the CAS, A epoch one remains authoritative and D remains disabled even though exact invisible candidates may exist; after it, readers must freshly resolve the epoch's complete tuple from A's stores. D publishes no parallel candidate or summary. Every A ordinary restart, bootstrap prepare, and new sequence acquires the same lock before it reads epoch one or publishes any authorization/operation; after epoch two it fails before mutation with typed `BASELINE_RESTART_AUTHORITY_RETIRED`. A operations durably in flight before cutover remain recoverable and therefore make cutover refuse until terminal; completed A history remains resolvable forever. A partial/mismatched operation or candidate is ambiguous and never enables either owner.

Prepare's first and sole durable creation is the complete fixed `cutover-pending-input.json` record. It contains `InternalProductionPhysicalServiceRestartAuthorityCutoverPendingInputV1` directly; its constant canonical ref is derived from that fixed namespace and `pendingInputHash` hashes the strict body with only the derived ref/hash omitted, so no content-addressed member, guard authorization, operation, locator, or candidate can be orphaned before discoverability. Publication uses an unpredictable same-directory temporary, file fsync, atomic no-replace, parent fsync, and `O_NOFOLLOW` reopen. There is no separate content-addressed pending-input object or pending-input locator. Only after reopening this record does prepare acquire A's durable global owner-admission fence for the exact cutover purpose. One canonical owner-admission head serializes fence acquire/release and every producer reservation begin/close. Its exhaustive registry is exactly `INTERNAL_PRODUCTION_OWNER_CATEGORY_REGISTRY_V1`: run, claim, execution attempt, runtime session, completion owner, mandatory effect, ordinary start, restart reservation/operation, launch preparation, prepared/staged work, fixture attempt, artifact reservation/publication, docs session/lease, fleet stage/inflight/review, matrix inflight, launch outbox, termination, finding, recovery, operational delivery, source run, cold rehearsal, compilation/execution lease, process, listener, worktree, dirty worktree, and stale child. Fence acquire treats every open reservation and published live owner as nonzero. Outside a typed fence target family, a producer must begin or byte-identically adopt its category/owner-key reservation before its first durable owner byte; its canonical PostgreSQL owner insert and sidecar bind then occur in the same transaction, and it closes only through the exact category-typed terminal authority. Inside `source-run-launch` or `recovery-restart`, the same atomic fence/head CAS creates the complete exact named target set, those target pairs are the only permitted begin authorities while the fence is held, and only the matching exact compound close may settle them. Reservation CAS refuses while a fence is held; fence CAS refuses while any non-target reservation or owner is live. A nonzero observation leaves the same fixed pending record in `pending-input`, publishes no operation, consumes no guard, and performs no epoch mutation; zero-input resume alone may retry acquisition.

Guarded migration 32 creates the permanent PostgreSQL sidecar `internal_production_owner_reservations_v1` plus the singleton `internal_production_owner_admission_head_v1` relation. `owner-admission-v1.ts` is pure and import-inert: it imports only canonical pure helpers plus the type-only `PgTransactionSql` shape, opens no connection, imports no `db-pg`, and exports only types, ports, and pure primitives. It exports no caller-constructible repository/controller factory, terminal-resolver registry, production capability, or database singleton. `src/db-pg.ts` owns the sole production repository implementation, the fixed non-exported category-to-authenticated-terminal-resolver table, and the code-owned composed controller after an explicit configured SQL connection exists. Production entrypoints and the top-level pair-only reservation/close resolvers obtain only that composed controller/repository; no caller supplies a repository, resolver table, or factory. A test-private fake is defined only in the focused test and cannot be imported by production.

The caller passes the same `PgTransactionSql` to repository `resolveReservation(...)`, controller begin/adopt, its canonical owner insert, controller bind, authenticated terminal resolution, controller close, and repository `resolveClose(...)` as applicable. The repository locks the singleton head and reservation key, verifies the active manifest row/category/owner-key derivation, inserts or byte-identically adopts the pending sidecar row, permits the caller's canonical owner insert, binds its exact owner pair, and CAS-advances the head before that one PostgreSQL transaction commits. A crash/throw/deadlock before commit exposes neither reservation nor owner; a lost response after commit is recovered through the same injected repository and returns the byte-identical bound row without a second owner. A conflicting producer/category/key/pair, partially visible row, stale head, or second owner fails and rolls back the whole transaction. Concrete owner tables receive no duplicate reservation columns; the sidecar is the authoritative binding.

Close's public input is exactly `{reservationRef,reservationHash,terminalAuthorityRef,terminalAuthorityHash}`. The code-owned composed controller uses repository `resolveReservation(sql,pair)` to obtain the category, selects only the corresponding non-exported resolver from `src/db-pg.ts`, authenticates the terminal pair inside that same repository transaction, and passes the resulting non-caller-constructible terminal authority to `closeInTransactionV1`. The repository re-locks the row/head, checks the exact bound owner/category/key/pair, CAS-publishes one close, and `resolveClose(sql,pair)` reopens it through the same port. Top-level production pair-only resolvers use this composition; the pure core never opens a connection. A lost close response adopts only the identical close; a structural terminal body/clone, crossed category, different terminal pair, stale head, or partial transition fails without mutation. No public close accepts a category, terminal object, resolver registry, repository, or factory. This is PostgreSQL atomicity only: filesystem, process, listener, dispatch, and service effects begin only after the bound transaction is durable and remain governed by their own outbox/receipt protocol. Reservation activation begins in Task 6A only after migration 32, A-manifest activation, and normal admission readiness.

Under the held owner-admission fence, resume observes/reopens epoch one, A's empty restart/sequence/helper census, and the fixed three-hook runtime identities; derives every immutable readiness/retirement/activation/epoch-two/cutover candidate hash in memory; publishes/reopens `InternalProductionPhysicalServiceRestartAuthorityCutoverOperationV1`; and CAS-publishes the fixed active-operation locator. Immediately before guard consumption and again immediately before the epoch-head CAS it calls `reobserveInternalProductionGlobalOwnerAdmissionFenceV1(...)` and requires exactly zero unrelated owners with the identical category/identity-set projection. Any nonzero or changed observation leaves the same operation pending and performs neither consumption nor CAS. The fence remains held through terminal cutover publication/reopen and is released only afterward; terminal visibility/status requires the exact release record. A crash before the fixed pending record is side-effect-free and the same caller input may repeat prepare; after it, a fresh process uses only zero-input resume, which reopens the fixed record and creates or adopts only the missing fence/operation/active-locator member in order—never a scan or caller guard. `observeInternalProductionPhysicalServiceRestartAuthorityCutoverStatusV1()` is strictly read-only and reports `baseline-a-active | pending-input | prepared | resuming | recovery-d-active`; `pending-input` permits a null fence only before acquisition and otherwise binds its exact pair, while all later states require the same fence. Crash tests use a wholly fresh empty-environment process at every pending-temp/fsync/publish/reopen, fence acquire/reobserve, operation, active-locator, guard-consumption, candidate, CAS, terminal, fence-release, and response boundary. Race B migration prepare, D cutover prepare, and every enumerated owner admission; at most one fence holder exists, no owner is admitted while held, and neither guarded mutation runs from a nonzero census.

The sequence coordinator owns three separate fixed intent domains, `live-rebind`, `d-startup-hook-load`, and `documentation-rollback`; none may adopt, supersede, or advance another. `d-startup-hook-load` is delivered by A but remains unavailable until code-owned observation proves the reviewed D Setfarm and Mission Control source handoff SHAs are both on clean built main; it exists solely to load the three D-capable hooks while A epoch one is still active and cannot enable D prepare. Before creating any intent the coordinator reopens the sole terminal bootstrap-handoff migration locator and pair, proves the current clean Setfarm source descends from `migrationSourceSha`, repeats the dedicated implementation blob, ordered-statements, named-digest-entry, digest, and schema verification while allowing unrelated append-only registry entries, and binds `migrationReceiptRef`, `migrationReceiptHash`, and `migrationSchemaProjectionHash` into `sequenceIntentHash` and the final sequence receipt. It derives the remainder of `sequenceIntentHash` from the literal kind plus the freshly observed clean source/build/runtime projection and code-owned ordered service/action tuple, publishes that intent before preparing a first restart authorization, and uses one fixed private locator per intent kind—never a scan or newest selection. For each ordinal it calls `prepareInternalProductionBaselineServiceRestartV1({service})`, durably retains that exact authorization pair, then calls pair-only `restartInternalProductionBaselineServiceV1(...)`. Response-loss recovery may invoke only that same pending authorization pair until it receives the composite pair, then durably publishes and freshly resolves the exact composite authority, validates its migration identity, derived service/action, prior/after generation, complete before/after source/build projection, consumed authorization/guard equality, successful settlement, and zero-owner cleanup, and advances one immutable predecessor-CAS journal head. It cannot prepare the next authorization before the prior advance is durable. After ordinals `0,1,2` map exactly to spawner, dashboard, Mission Control, it publishes the final receipt and status; the receipt repeats the exact migration pair and three authority pairs in that order. The acyclic sequence/status hashes omit their ref/hash fields and their refs derive only afterward. A blocked/ambiguous step remains the only active ordinal and never rolls forward, retries with a new authorization, or starts another intent. Once D delivery's atomic cutover publishes A's retirement, a new `live-rebind`, `d-startup-hook-load`, or `documentation-rollback` request returns the strict `state:"retired"` status and typed refusal without an intent/authorization/operation. Any post-D rollback must use D's reviewed `source-release-barrier`/`documentation-handoff` authority or remain unavailable; no command, recovery path, or historical A pair can resurrect epoch one.

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

In `migrations.test.ts` and `migration-source-digests.test.ts`, require one guarded ordinal 32 whose exact ordered statements/projector contain both owner-admission sidecar/head and bootstrap operation/claim/terminal-pair schema. Before application, the targeted v31 audit proves 1–31 current and the sole pending inspector proves exactly guarded 32. Generic apply reports it skipped and generic full verify fails `MIGRATION_INCOMPLETE`. The already prepared Task 6A controller alone reopens both pairs, terminally resolves the operation-bound sealed Task 0 spawner, reobserves the complete legacy/pre-manifest owner census, consumes the one-use `InternalProductionPreManifestMigration32AuthorizationV1`, applies once, seals `InternalProductionBaselineBootstrapHandoffMigrationReceiptV1`, and produces the current audit with zero pending/drift. It never calls normal complete-zero before activation. Current-entry stores the applied pair/current audit, not a pending-current pair; its receipt preserves the causal quartet plus pre-schema/sealed/legacy-census authorization chain. Task 7, every normal restart/sequence, B P0, D hook load, and both baseline resolvers reopen the applied chain and have no apply seam.

The shared isolated lifecycle and every direct caller are executable acceptance scope. `test-database.ts` and `run-isolated-postgres-tests.ts` prove automatic apply → exact test-only migration-32 capability → full verify. Each of the twenty literal direct-caller tests is audited: a test requiring pending semantics asserts generic verify failure before the capability; a test requiring a complete fixture invokes the zero-argument fixed capability before verify. Tests reject a production/env/caller-selected test mode, arbitrary migration ID/body/evidence, capability import from `src`, generic guarded apply, zero/two pending entries, production apply before the Task0 spawner is sealed or after normal admission/canary, a normal complete-zero/manifest guard substituted for the pre-manifest authorization, manifest before schema, wrong/replayed authorization, partial schema state, changed implementation/statements/digest/projection, response-loss duplication, or any Task 7/B/Task 8 apply. Crash tests cover current-entry operation publication, first legacy census, pre-schema authorization/dispatch/startup seal, second legacy census, migration authorization/transaction, both schema projections, receipt/current audit, manifest activation, same-generation admission-ready transition, and first canary reservation; retry returns the same pairs or fails closed without a second restart/schema mutation.

In `baseline-post-handoff-receipt-v1.test.ts`, exercise the B-purpose guard seam without importing B: bind only the literal `golden-launch-operation-migration-release-v1` purpose to a canonical pending-input ref/hash, reopen the authorization, bind one canonical operation ref/hash, and consume the underlying generic guard exactly once through A's named consumer. Crash before/after authorization publication, operation binding, guard consumption, consumption-receipt publication, and response; fresh-process recovery adopts the same authorization/consumption pairs. Reject another purpose/namespace, missing pending input, structural clone, changed operation, direct generic-store access, replay, and a second consumer before any guarded side effect.

In that same focused file, exercise Task 6A current-entry and Task 7 post-rebind ordering separately. Current-entry tests require the fixed PBA source pair; an immutable operation prepared before any mutation; the acyclic pre-schema authorization/startup-token/restart/termination/postzero/sealed-admission chain; applied migration receipt/current audit with its causal v31/pending and sealed/legacy-census authorization chains; A-manifest activation; same-generation `normal-task0-admission-ready`; current Task 0 controller; and mixed runtime authority. They require spawner/controller source-build equality, require dashboard/MC generations unchanged from delivered observations, and reject canary admission before schema/manifest/full-verify/normal DB initialization/admission-ready. Crash/race/replay every prefix and assert the exact twelve-state nullability, one migration, one spawner restart, one token-to-sealed-to-ready chain, one canary start/claim/termination, zero redispatch, and zero unrelated owner. Tests invoke no standalone production restart/apply mutation argv. PBA fixtures additionally enforce `GitObjectHashV1` 40/64 boundaries for `producerCommit`, `deliveryMergeSha`, `currentSource.sha`, `currentSource.treeHash`, and `currentSource.originMainSha` versus exact 64-hex content/build/receipt/lock/evidence hashes. Post-Task6 wire integration compares source CLI and later HTTP bytes. Post-rebind tests consume the already applied predecessor, simulate only Task 7 build/restart/service/source/zero-owner receipts, and assert `absent -> predecessor_ready -> rebuilding -> restarting -> verifying -> ready`; there is no migration-applying state or schema write. Reject a Task 7 apply attempt, stale predecessor, mixed receipt/restart pairs, caller locator/body, structural clone, source/build/schema/service/evidence drift, nonzero owner, fork, or a repeated settled restart.

In `operational-active-run-status-v1.test.ts`, require the source tuple, Zod enum options, generated JSON Schema enum, CLI JSON, dashboard filter, and existing authoritative DB census predicate to contain the same ordered four values: `running`, `resuming`, `cancelling`, `failing`; require the compatibility fixture to be a schema-valid member bound to that exact schema. Exercise the transition sequence `running -> resuming -> cancelling -> failing` and prove every state remains operational-active without being collapsed; transitions from any of those states to `completed`, `failed`, or `cancelled` become inactive. Reject `pending`, every terminal status, a reordered/extended artifact, duplicate value, or locally maintained dashboard/UI list. Spawn the JSON CLI through `npm run --silent`, feed its stdout directly to the parser, and prove the stream contains exactly one JSON document with no npm banner.

For backup recovery, use a temporary fixed-root test harness and an injected crash hook around every `dump-linked`, `list-linked`, and `checksum-linked` hard-link operation: immediately before the link, immediately after the link but before directory fsync, after fsync but before the immutable phase record is published, and immediately after that record is published. Every rerun must authenticate and adopt only the exact contiguous prefix, complete the remaining links, and return the byte-identical receipt. Add crashes before/after `artifacts-sealed`, `published`, every source-name unlink, and `sources-released`. For each of the seven journal phases, crash before/after unpredictable temporary-record creation, full write, file fsync, no-replace publication, journal-directory fsync, temporary-name unlink, and final `O_NOFOLLOW` reopen; every recovery either authenticates the same whole record and continues or sees no committed phase. Reject a partial/truncated record, a later record without its predecessor, a forged/reordered/hash-chain-broken record, an unknown fixed record, a symlink/hardlink/mode-drifted record, an unequal pre-existing phase target, a temporary-file poisoning attempt, any use of append/`O_APPEND` against journal authority, a gap such as dump plus checksum without list, a target with different device/inode while its sealed source exists, any artifact hash/size/mode/symlink/hardlink mismatch, a foreign pre-existing target without the durable attempt, or a second attempt. Prove the final three targets are regular non-symlink mode-`0600`, link-count-one files and that rerunning `backup --json` only reopens the same receipt.

- [ ] **Step 2: Implement the smallest fixed authority**

`baseline-spawner-startup-admission-v1.ts` owns the exact target-guard/P0 bootstrap records plus the disjoint `InternalProductionPreSchemaSpawnerRebindAuthorizationV1` operation/status/store/resolver, acyclic pre-dispatch `InternalProductionPreSchemaSpawnerStartupTokenV1`, post-dispatch `InternalProductionPreSchemaSpawnerSealedAdmissionV1`, and same-generation normal-admission transition. `baseline-service-restart-helper-v1.ts` alone performs both fixed no-shell dispatch families, distinguished by closed operation schema/action ID; the pre-schema family is literal `setfarm-spawner` and cannot accept or adopt a normal restart authorization. Before dispatch it publishes only the immutable startup token, which binds the current-entry operation/authorization, target source/build, predecessor generation, and expected next generation; it contains no restart authority, termination fact, actual generation, post-termination census, or sealed-admission pair. Only that operation-bound token and fixed locator—not environment, argv, a caller mode, service, label, path, body, or structural clone—may boot `src/spawner.ts` into its no-producer `pre-manifest-bootstrap-sealed` loop. After dispatch/replacement boot, authentic predecessor termination, actual-generation equality, and the post-termination all-36-zero observation, the controller publishes the separate sealed admission binding the token and those later facts. This token → dispatch → replacement boot → termination/postzero → sealed hash/ref chain is acyclic; migration authorization requires the sealed admission and never accepts the token. In the sealed branch `src/db-pg.ts` opens only the minimal read-only connection needed for the targeted v31 audit and pending-32 inspector; it neither skips nor weakens generic verification, never reports normal DB ready, creates no owner/listener/claim, and exposes no normal spawner loop. Default startup still runs ordinary generic full verify and therefore fails closed while 32 is pending. An owner/process/listener/worktree/stale-child race at any observation/dispatch/termination/seal boundary leaves status nonterminal and migration authorization unavailable. After migration/current audit and A activation, the same sealed process reopens those exact pairs, runs ordinary generic full verify plus normal DB initialization, atomically publishes `normal-task0-admission-ready`, and only then enables producer entrypoints. Wrong/missing/replayed token/admission, a changed generation, or full-verify/initialization failure exits or blocks. There is no environment flag or generic pending-32 bypass. A and D retain disjoint operation schemas, roots, locators, authenticators, and action tables; source tests enforce those boundaries.

Before each guard observation, the coordinator freshly reopens the prior resolved `after` projection and current runtime projection and requires canonical equality. Pair zero's `before` equals the sealed initial projection; pair `i.before` equals pair `i-1.after`; the final projection equals pair two's `after`. It holds Setfarm/Mission Control source and build identities invariant throughout the sequence and permits only the ordinal's target service authority/generation transition. It derives each `orderedAdvanceHashes[i]` from the exact predecessor/successor projection pair, ordinal, service/action, composite pair, and prior advance hash, then the final receipt/resolver recomputes the complete three-link chain.

`baseline-service-restart-sequence-v1.ts` is a required Task 0 postcondition and the sole sequence-intent, guard-pair, composite-pair, CAS-journal, final-receipt, and status owner. It calls Task 0's code-owned zero-owner observer and `restartInternalProductionBaselineServiceV1()` directly; it does not spawn the public CLI or duplicate restart logic. Every record uses the Task 0-owned fixed private root and unpredictable-temporary/file-fsync/no-replace/parent-fsync/`O_NOFOLLOW` reopen protocol. `baseline-post-handoff-cli.ts` validates exactly the three finite intent literals `live-rebind|d-startup-hook-load|documentation-rollback` and delegates `resume-restart-sequence` or read-only `restart-sequence-status`; the mutating command returns only a completed final pair and status never repairs or advances. A fresh process resolves every returned pair before use.

`baseline-restart-authority-retirement-v1.ts` is the sole fixed transition lock/epoch/readiness/activation/retirement/cutover writer. The helper, bootstrap preparer, and sequence coordinator all call its internal A-active guard while holding the same lock before their first durable mutation. D's exact reviewed cutover adapter alone imports A's two cutover mutations unaliased; every other D consumer imports only types/resolvers/status, while A imports nothing from D. `owner-admission-v1.ts` owns the pure guarded fence, canonical 35-category/35-key/36-scalar census mapping, plan-manifest, typed reservation/sidecar-port, bind, close, and repository/controller port ABI. It may import only pure canonical helpers and type-only PostgreSQL interfaces; it never imports the receipt, activation controller, restart retirement/helper/sequence, startup admission, CLI, spawner, execution call sites, or a database singleton, and it exports no production composition factory or resolver table. `baseline-post-handoff-receipt-v1.ts`, the activation controller, retirement/helper/sequence/startup modules, `src/db-pg.ts`, and the six producer call-site modules depend one way on `owner-admission-v1.ts`. `src/db-pg.ts` alone constructs the production repository/controller and fixed category-specific authenticated terminal resolver table after an explicit configured connection exists; coordinators and top-level pair-only resolvers obtain that code-owned composition, never caller ports/capabilities. Runtime observation, DB connection, store opening, process inspection, controller construction, and `void` execution at module scope are forbidden in every other new Task 0 module. Type-only reverse edges are also forbidden when they would load a runtime module; shared types live in the core.

`baseline-post-handoff-receipt-v1.ts` owns the guarded migration receipt, B-purpose guard seam, fixed recovery-source operation/run receipt/status/resolver, and the sole phase-versioned manifest-set activation store/head/resolvers while consuming the owner-admission core. `baseline-post-handoff-cli.ts` and `package.json` own its three bootstrap verbs. The six A call-site files named in the File Map implement exactly the eleven literal seven-field rows of `INTERNAL_PRODUCTION_OWNER_PRODUCER_ROWS_A_V1`, including `execution-attempt` separately from `fixture-attempt` and the source bootstrap's `run` reservation separately from the ordinary spawner `run` producer; `INTERNAL_PRODUCTION_OWNER_PRODUCER_MANIFEST_A_V1.manifestHash` hashes exactly its schema, plan, and ordered rows. The new target-family ABI changes no A-owned producer call site and therefore leaves manifest A at exactly eleven rows. A imports no B–E source and does not assert a future module exists. `owner-admission-v1.test.ts` and `baseline-post-handoff-receipt-v1.test.ts` require exactly 35 unique categories, exactly 35 key-checked census-map entries, complete coverage of all 36 scalar counters, the intentional two-scalar `artifact-publication` mapping, the exact eleven A rows, unique implementation ID/module-function/owner-key tuples, and census keys equal to each row's category map. Their AST/import fixtures enforce the one-way graph and import-inertness; the exact repository `resolveReservation`/`resolveClose` ports; one passed `PgTransactionSql` across resolution, begin/adopt, owner insert, bind, authenticated terminal resolution, close, and close resolution; pair-only public close/top-level resolvers through the fixed `src/db-pg.ts` composition; typed compare-and-swap/replay semantics; no public registry/factory/repository capability; a test-private fake with no production import; and no producer byte before the pending reservation.

After A's reviewed source is merged, clean, and source/build-authenticated, `activateInternalProductionOwnerProducerManifestSetV1({expectedPredecessor:null,manifests:[INTERNAL_PRODUCTION_OWNER_PRODUCER_MANIFEST_A_V1]})` publishes the first strict content-addressed activation receipt and CAS-installs the fixed current head. The initial receipt has all four predecessor fields null; every append instead supplies and persists one exact predecessor quartet `{activationRef,activationHash,headRef,headHash}`. Each receipt binds exact phase, ordered plans/manifests and their fresh source/build authority pairs, canonical registry/map hashes, that predecessor activation pair, that predecessor head pair, and its derived ref/hash. `manifestSetHash` is exactly `hashCanonicalJson({schema:"setfarm.internal-production-owner-producer-manifest-set.v1",phase,orderedPlans,orderedManifestHashes,orderedSourceBuildAuthorities,ownerCategoryRegistryHash,ownerCategoryCensusMapHash})`; the activation hash includes that complete projection plus both predecessor pairs and omits only its own derived `activationRef`/`activationHash`. The strict head is a separate content-addressed record: its canonical hash projection is exactly `{schema,phase,activationRef,activationHash,predecessorHeadRef,predecessorHeadHash}`, then it derives `headRef` and `headHash`; neither derived head member appears in that projection. The implementation rejects an absent, half-null, mixed, non-current, or receipt/head-inconsistent predecessor before publishing either successor. Immutable receipts and heads use unpredictable same-directory temp, file fsync, no-replace publication, parent fsync, and `O_NOFOLLOW` reopen; the sole mutable current-head locator uses expected-predecessor CAS, atomic replacement, parent fsync, and exact reopen. A later plan may append only its exact next manifest after that plan's reviewed merge/source/build authority exists and after freshly resolving the current `{head,receipt}` predecessor; phase skips, reorder/removal, stale predecessor, future import, structural manifest, source/build drift, or a duplicate/conflicting row fails without head movement. There is no void activation, import-time side effect, process-local active set, caller row, CLI row injection, or source import order as authority. `resolveCurrentInternalProductionOwnerProducerManifestSetActivationV1()` opens only the fixed current-head locator, reopens and re-hashes the named head and receipt, proves their phase/current/pair/predecessor-chain relations, and returns the strict `{head,receipt}` tuple. `observeCompleteInternalProductionZeroOwnerCensusV1()` freshly resolves that same tuple and equality-binds both pairs, its exact `manifestSetHash`, registry/map hashes, and all reservation/owner identities into the observation. Missing/corrupt/forked/unknown activation state makes the census unavailable rather than zero.

`baseline-owner-producer-manifest-activation-controller-v1.ts` is A's sole executable wrapper around that generic initial activation. Its public mutator is zero-input: it code-owns only `INTERNAL_PRODUCTION_OWNER_PRODUCER_MANIFEST_A_V1`, phase `A`, and the freshly resolved clean A source/build authority; it accepts no manifest/plan/row, predecessor, receipt/head pair, source/build body, root, path, environment, or test port. Before calling the generic store it publishes and reopens one fixed-private, content-addressed activation operation binding A's manifest/source-build pair and the all-null predecessor quartet. It then calls the generic activator, freshly resolves both the returned activation receipt and `resolveCurrent...()` tuple, requires phase `A`, exactly eleven rows, exact A manifest/source-build hashes, and equality of both successor pairs, and only then publishes/reopens `InternalProductionBaselineOwnerProducerManifestActivationReceiptV1`. That wrapper receipt canonically binds the all-null predecessor activation/head quartet, successor activation/head quartet, manifest/source-build pair, and only omits its own `receiptRef`/`receiptHash`; the fixed status locator is updated last. Its zero-input status reader never repairs: it reopens the operation, wrapper receipt, status locator, successor head, and successor activation receipt and returns only the strict path-free status union. A crash before generic activation leaves the one operation resumable; a crash after generic activation but before wrapper receipt can adopt only that exact current successor; a crash after wrapper receipt but before status publication completes only the matching fixed locator. A fork, changed source/build/manifest, non-null predecessor, missing/mixed successor pair, stale current head, duplicate wrapper receipt, unknown temporary, or any mismatch becomes `blocked` without retrying another activation. The module has no top-level controller construction or `void` call: importing its manifest or controller is inert.

`baseline-owner-producer-manifest-activation-controller-v1.test.ts` requires the exact A File Map paths and CLI table; strict schema/hash/ref/nullability; no exported input-bearing mutation; controller-internal activation only during Task 6A plus read-only `owner-producer-manifest-status --json`; and no import-time store call. It injects a crash before/after operation, generic activation, receipt, locator, and response, races two activations, and restarts in a fresh process. Every successful recovery returns the one byte-identical wrapper receipt/status and re-hashes both successor records; each malformed operation/receipt/locator, ref/hash swap, stale/replaced head, changed clean source/build authority, or second A activation fails before another generic store call. Source/transcript fixtures prove the current-entry operation exists before the pre-schema spawner restart, that restart is the first production mutation, guarded migration follows sealed status, A-manifest activation follows the applied/current receipt, and admission-ready is the fail-fast gate before the source-run fence, canary, or any producer owner byte.

B, C, D, and E each own and test only their later literal table/manifest and append exactly one phase after their source exists. Only E's final source task imports the five exact manifest exports, invokes `assembleInternalProductionOwnerProducerRegistryV1(...)`, verifies final category coverage and all-row File Map/AST relations, and publishes the aggregate registry hash in the `A+B+C+D+E` activation; no earlier task performs an all-row scan. Tests crash before/after receipt/head temp/fsync/publish/reopen and current-head CAS/reopen, adopt only a unique byte-identical `{head,receipt}` tuple, and reject same-phase forks, an activation receipt whose predecessor quartet is not the prior current tuple, or a current head whose source/build authority no longer resolves. Compile-time fixtures prove generic `acquireInternalProductionGlobalOwnerAdmissionFenceV1(...)` accepts only the exact migration or cutover purpose with `targetFamily:null` and rejects source-run/restart purposes; the two dedicated acquire seams accept only their discriminated exact inputs. Target-family schema tests assert the seven exact named descriptor fields, categories, implementation IDs, canonical ABI hash, target-family hash, and return members; reject a missing/eighth/renamed field, arbitrary reservation or identity array, caller owner-key hash, mismatched coordinator/active-target discriminant, and any derivation input beyond the immutable authorization-operation pair plus exact authority and namespace/service/coordination tuple. Runtime tests hold the shared owner-admission head at every A reservation/fence CAS boundary and prove either one reservation/owner or one fence wins, never both. Recovery-restart tests publish the immutable operation, outbox, helper, child, replacement process, and startup listener under their already acquired exact target pairs without ordinary begin; then publish the acyclic immutable terminal core and prove the pair-only compound close removes all seven targets in one successor while preserving the fence and exact coordinator/active-target authority. They reject an ordinary begin under the fence, a partial/per-target/generic close, a final-envelope close input, a terminal core containing the future close/release/envelope pair, a core/operation/family mismatch, and release before compound close. Counters prove no durable owner publication precedes reservation, no fence becomes visible with a pending non-target reservation, and no target remains after the compound close.

Helper recovery records every generation as immutable history. If a helper dies after its startup marker but before guard consumption, the coordinator may publish one `setfarm.internal-production-baseline-restart-helper-generation-abandonment.v1` record binding the operation/outbox, abandoned generation/claim/process/startup hashes, a fresh code-owned dead-process observation hash, `guardConsumed:false`, and exact absence hashes for dispatch-issued, launchctl-child, and settlement evidence. Only after reopening that record may an expected-predecessor CAS publish the next helper generation. A concurrent successor loses the CAS and adopts the winner. The old marker is never deleted or rewritten. Guard consumption permanently closes this branch: from then on recovery may only authenticate the same live helper, adopt its completion/failure settlement, or record ambiguity; no abandonment successor, claim takeover, or dispatch is legal.

`baseline-service-restart-helper-v1.ts` is the sole fixed child entry. The controller launches `process.execPath` plus that compiled module path through `execFile`/`shell:false`, with no user arguments and a replacement environment, and passes one unforgeable operation capability through a private inherited descriptor. The helper authenticates that capability against the durable A-only reservation/operation/outbox before claiming it; direct execution, a caller descriptor/body, an inherited ambient variable, a second claim, or any D capability/namespace fails before guard consumption. Its public module surface is empty.

Implement `operational-active-run-status-v1.ts` as the sole runtime producer of the declared tuple, Zod schema, type, and predicate. Register it in `mission-control-contract-artifacts.ts` so the existing generator derives the JSON Schema and compatibility fixture from that module; do not hand-maintain their enum. Update the artifact test from the current ten to twelve exact ordered paths and cross the new fixture through the producer schema. The code-owned zero-owner observer and dashboard import the predicate directly. The contract CLI serializes the same frozen tuple and hashes the canonical object excluding `contractHash`; `package.json` exposes it as `contract:operational-active-run-status`. In `dashboard.ts`, replace exclude-terminal/current-state guesses with the imported predicate for default `/api/runs` selection and the `operationalActive` field. In `index.html`, consume only `operationalActive === true`. Keep historical-run retrieval explicit and preserve the raw status string without reclassifying it. The regression also reads the authoritative census migration and requires its literal set to remain identical to the producer; changing either side without regenerating/reconciling the other fails.

After the producer and failing artifact expectations are implemented, run the existing code-owned writer once: `node --import tsx scripts/mission-control-contract-artifacts.ts --write`. Only the two declared generated files may be new; every pre-existing generated artifact must remain byte-identical.

Use existing Setfarm database/process/worktree observers; do not create a second run classifier or lifecycle controller. `observeCompleteInternalProductionZeroOwnerCensusV1()` is zero-input/read-only and returns the strict path-free `InternalProductionCompleteZeroOwnerCensusObservationV1`: exactly 35 ordered category registry entries, exactly 35 census-map keys, and complete coverage of exactly 36 scalar counters including `executionAttemptCount`. `artifact-publication` alone maps to both `publicationBatchCount` and `artifactPublicationCount`; every other category maps to exactly one scalar, and no scalar is unmapped or multiply owned. The observation also binds the freshly resolved current manifest-set activation ref/hash, active manifest-set hash, category-registry hash, census-map hash, reservation/owner identity-set hashes, and observation hash. Production accepts no injected observer, census, activation, root, store, or row; tests may use a private non-exported fake helper that cannot be imported by D/E. The receipt module owns the fixed backup path, durable attempt/journal, and no-follow/no-replace protocol. Source observers reject an injected root, connection string, command, service label, PID, or receipt body. The `runtime-source` CLI alone accepts exactly two comparison SHA arguments, validates them as Git object hashes, and passes them only as expected identities to the code-owned observer; neither value selects a root/build/process.

A has one disjoint pre-schema spawner mutation owned only by the prepared current-entry controller; every other service mutation uses the normal finite authorization/consume surface. `prepareInternalProductionBaselineServiceRestartV1({service})` is unavailable until migration 32 is applied/current, A's manifest is active, and normal admission is ready. Thereafter it accepts only `setfarm-spawner | setfarm-dashboard | mission-control`, internally reopens the current applied migration receipt and manifest activation, observes a fresh manifest-backed complete-zero-owner census, mints and retains the one-use guard, binds the current runtime-source projection, publishes through the fixed `InternalProductionBaselineServiceRestartAuthorizationStoreV1`, and returns only `{authorizationRef,authorizationHash}`. Its exact CLI is `prepare-restart-service --service <closed-service> --json`. `restart-service --authorization-ref <CanonicalRef> --authorization-hash <64-hex> --json` accepts only that pair, pair-resolves the strict authorization, derives the service from it, and consumes it once. It has no `--service` flag. Neither normal command accepts a label, command, executable, argv, UID, domain, PID, path, root, environment, guard, migration pair, or receipt body. The strict status is `absent | prepared | consumed | blocked`; its pair/status/store resolver never scans newest authority, and a retry adopts only the byte-identical authorization/consumption. The private helper has no public argv. The pre-schema controller calls a separate operation/action namespace fixed to `setfarm-spawner`; it cannot present that authorization to this normal API. Both closed paths derive `uid` only from code-owned `process.getuid()` (and fail closed if unavailable/non-integer), then dispatch the matching fixed label through the same no-shell helper:

```typescript
export const INTERNAL_PRODUCTION_BASELINE_LAUNCHD_SERVICE_REGISTRY_V1 = {
  "setfarm-spawner": "com.setrox.setfarm-spawner",
  "setfarm-dashboard": "com.setrox.setfarm-dashboard",
  "mission-control": "com.setrox.mission-control",
} as const;

execFile(
  "/bin/launchctl",
  ["kickstart", "-k", `gui/${uid}/${INTERNAL_PRODUCTION_BASELINE_LAUNCHD_SERVICE_REGISTRY_V1[service]}`],
  { shell: false, env: replacementEnvironment },
);
```

The executable is literal `/bin/launchctl`; argv positions 0–2 are literal `kickstart`, `-k`, and the code-derived `gui/<uid>/<label>`. No other A module or shell fence may contain a launchd dispatch. Any host whose installed labels differ fails closed and requires a reviewed registry change.

`restartInternalProductionBaselineServiceV1({authorizationRef,authorizationHash})` first reopens the exact strict authorization, its sole verified bootstrap-handoff migration receipt, retained one-use guard, and code-owned complete `before` runtime-source projection; requires the current clean source in `before` to descend from the original `migrationSourceSha`, requires the dedicated migration implementation blob, ordered statements, named digest entry, digest, and schema projection to equal the receipt while ignoring unrelated append-only registry entries, and separately requires the complete runtime source/build projection to equal the current clean build. It derives `service` and `operationId` only from those bytes, then durably publishes/reopens the fixed A-only `reservation -> operation -> outbox` chain before guard consumption, process creation, or dispatch. A private code-owned helper atomically claims only that outbox, publishes its bounded child PID/start-time/executable/process-identity hash and startup marker, and only then consumes the authorization's retained guard inside the prepared operation. No public API accepts the helper, PID, process, service, label, command, namespace, guard, or migration authority. The helper executes the one fixed no-shell service dispatch at most once and publishes exactly one immutable completion or failure settlement; the successful authority binds the authorization, migration pair, reservation, operation, outbox, claim, child identity, startup marker, and completion-settlement hashes. Recovery before consumption may reclaim only a provably dead pre-dispatch helper for the same authorization/operation; recovery after consumption is lookup/adoption only. After authentic completion it waits for the exact changed target generation/service authority and derives the complete `after` projection from code-owned observers. It then reobserves either complete global zero for `complete-zero-owner` or the exact fenced target plus zero unrelated owners for `fenced-completion-owner-bootstrap`, and creates only that matching authority branch. Bootstrap terminal global zero is never claimed here; it exists only in the later terminal bootstrap sequence.

Store the authorization, status, reservation, operation, outbox, helper claim, child-process identity, startup marker, immutable helper-generation abandonment successor, completion/failure settlement, dispatch receipt, runtime projections, cleanup observation, and final authority below A's fixed private baseline-restart root with the same unpredictable-temporary, file/parent-fsync, no-replace, `O_NOFOLLOW` reopen, bounded canonical-byte protocol. The helper claim is an expected-predecessor CAS over the one operation and its generation. A stale helper may be superseded while the guard remains unconsumed when no dispatch-issued record, launchctl child, or settlement exists: absence of a startup marker permits the ordinary pre-start successor, while presence of an authentic retained startup marker requires the exact dead-process observation plus immutable generation-abandonment successor defined above. Publish one authorization/operation-keyed final locator only after every member is durable; a retry locates/reopens that exact authority without scanning. The resolver takes only `{receiptRef,receiptHash}`, reopens that final locator and all members, proves exact canonical equality and hash/ref relations, remints the recursively frozen strict authority, and exposes no private path. `prepare-restart-service --json` and `restart-service --json` each print only their returned pair. A consumed guard with absent/partial/ambiguous operation state blocks; it never mints a replacement guard, selects a newest receipt, or repeats `launchctl`. Tests reject a direct restart without prepare, a service on consume, a service/pair cross, caller guard/migration/label/PID/path, status repair, response-loss duplicate, and every unknown flag. These types, file prefixes, operation IDs, helper executable, and root are finite to A's three baseline services and are disjoint from D's generic recovery lifecycle namespace.

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
  tests/mission-control-terminal-filter.test.ts \
  tests/internal-production/product-build-authority-v2-delivery-evidence-v1.test.ts \
  tests/internal-production/owner-admission-v1.test.ts \
  tests/internal-production/baseline-owner-producer-manifest-activation-controller-v1.test.ts \
  tests/internal-production/baseline-post-handoff-receipt-v1.test.ts \
  tests/internal-production/baseline-service-restart-helper-v1.test.ts \
  tests/internal-production/baseline-spawner-startup-admission-v1.test.ts \
  tests/internal-production/baseline-service-restart-sequence-v1.test.ts \
  tests/internal-production/baseline-restart-authority-retirement-v1.test.ts \
  tests/internal-production/task-0-source-manifest.test.ts \
  tests/execution-attempts/migrations.test.ts \
  tests/execution-attempts/migration-source-digests.test.ts \
  tests/execution-attempts/runtime-completion.test.ts \
  tests/internal-production/baseline-post-handoff-cli.test.ts
node --import tsx --test \
  tests/execution-attempts/activation-preflight.test.ts \
  tests/execution-attempts/artifact-publication-batch-migration.test.ts \
  tests/execution-attempts/artifact-publication-batch-plan-migration.test.ts \
  tests/execution-attempts/artifact-store-authority-migration.test.ts \
  tests/execution-attempts/attempt-reconciler.test.ts \
  tests/execution-attempts/migrations.test.ts \
  tests/execution-attempts/operational-event-migration.test.ts \
  tests/execution-attempts/operational-failure-cause-migration.test.ts \
  tests/execution-attempts/platform-release-store-record-ledger-v3-contract-integration.test.ts \
  tests/execution-attempts/preparation-authority-v2-migration.test.ts \
  tests/execution-attempts/product-compilation-attempt-migration.test.ts \
  tests/execution-attempts/run-terminal-transition.test.ts \
  tests/execution-attempts/runtime-completion-manifest-authority-migration.test.ts \
  tests/execution-attempts/v3-preparation-block-repository.test.ts \
  tests/execution-attempts/v3-release-admission.test.ts \
  tests/execution-attempts/v3-story-claim-runtime-binding-v1-migration.test.ts \
  tests/findings/migration-recovery-compatibility.test.ts \
  tests/findings/migration.test.ts \
  tests/product-compiler/artifact-store-authority.test.ts \
  tests/product-compiler/artifact-store-staging.test.ts
node --import tsx scripts/mission-control-contract-artifacts.ts --check
npx tsc -p tsconfig.json --noEmit
npm run check:english
npm run check:paths
npm run check:migration-digests
git diff --check
```

- [ ] **Step 4: Deliver through one canonical Setfarm V3 source claim**

The Setfarm owner allocates the isolated source worktree from clean `main`; the implementation/review agents edit/test only the 64 declared Task 0 paths and submit the claim output. Setfarm alone commits, pushes, opens, reviews, merges, cleans up, and returns clean synchronized `main`. Task 0 may generate only the two checked-in operational-active artifacts and the checked-in migration-32 digest through their deterministic writers. It may create/drop isolated test databases and apply guarded 32 only through the literal test-only capability after generic automatic apply and before full verify; it must not connect that capability to the live/canonical database. No live migration/schema change, owner/reservation/manifest activation, current/post-rebind authority, canary/run, service restart/rebind, runtime/store/receipt, backup, baseline Markdown, or generated-project mutation occurs in this task. Task 6A is the first production apply/activation/rebind phase; Task 7/8 cannot begin until Task 6A's current-entry pair is ready.

---

### Task 1: Implement the delivered Product Build Authority V2 evidence producer for post-merge authority

**Files:** preserve and verify the seven delivered Product Build Authority paths; create the delivery-evidence owner/test; modify only the fixed route/test and package command named in the File Map on `fix/internal-production-baseline-reconciliation`. Task 0's already delivered Setfarm response parser remains repository-local and is never imported, copied as source, or reached through sibling traversal.

**Interfaces:**

- Consumes: Setfarm `GET /api/runs/:runId/product-build-authority` responses using `setfarm.product-build-authority.v1` or `setfarm.product-build-authority.v2`.
- Produces: `ProductBuildAuthority = ProductBuildAuthorityV1 | ProductBuildAuthorityV2`.
- Produces: `parseProductBuildAuthority(value: unknown, expectedRunId?: string): ProductBuildAuthority`.
- Produces: `SetfarmProductBuildAuthorityClient.get(runId: string): Promise<ProductBuildAuthorityFetchResult>`.
- Produces: `parseProductBuildAuthorityResponse(statusCode: number, body: unknown, expectedRunId: string)` for the browser boundary.
- Verifies: the delivered UI labels V2 `sealed_packet` as `SEALED`, V2 `refused_before_packet` as `REFUSED`, and never falls back to agent prose.
- Implements for post-merge use: strict read-only `ProductBuildAuthorityV2DeliveryEvidenceV1`, exact `ProductBuildAuthorityV2DeliveryEvidencePairV1 = {deliveryEvidenceRef,deliveryEvidenceHash}`, zero-input `observeCurrentProductBuildAuthorityV2DeliveryEvidenceV1()`, pair-only `resolveProductBuildAuthorityV2DeliveryEvidenceV1({deliveryEvidenceRef,deliveryEvidenceHash})`, fixed endpoint `GET /api/internal-production/product-build-authority-v2-delivery-evidence`, and the zero-input non-listening source CLI. The production observer/resolver/CLI/endpoint owner requires clean synchronized Mission Control `main` with `HEAD === refs/remotes/origin/main === build SHA`; therefore the reconciliation branch cannot produce or consume this pair.

`ProductBuildAuthorityV2DeliveryEvidenceV1` has schema `mission-control.product-build-authority-v2-delivery-evidence.v1`, `currentStatus:"current"`, fixed `deliveryPrNumber:19`, and fixed `deliveryMergeSha:"240e779d78804843a1202cbf0440fe423b806b1a"`. It binds that merge's ancestry to current clean Mission Control `main`; current Mission Control source SHA, tree hash, and build hash; the exact ordered blob hashes for the seven delivered schema/parser/server/UI/test paths plus `contracts/vendor/setfarm/mission-control-contracts.v1.lock.json`; the strict focused-test receipt ref/hash; and the lock's producer commit, lock-content hash, exact ordered twelve artifact path/hash identities, and compatibility-set hash. `deliveryEvidenceHash` is `hashCanonicalJson` of every field except its two derived pair fields; `deliveryEvidenceRef` is exactly `mission-control://internal-production/product-build-authority-v2-delivery-evidence/sha256/${deliveryEvidenceHash}`. There is no mutable store, current pointer, caller body, per-run authority ref, or claimed global PBA authority pair. A private test-only injected contract evaluator may compute candidate canonical bytes and expected hashes from frozen fixtures, but those values are explicitly non-authoritative: it cannot call the production observer/resolver, publish a pair, populate a current pointer, or escape the test module.

The owner module derives its repository root only from its own authenticated module/build location, requires literal clean `main` and `HEAD === refs/remotes/origin/main === build SHA` before evidence construction or pair resolution, invokes one fixed no-shell focused-test command over the three delivered test files, and emits a deterministic `ProductBuildAuthorityV2FocusedTestReceiptV1`. That receipt binds the fixed command-contract hash, ordered test-path/blob hashes, `passed:true`, and exit status 0; its content hash/ref exclude volatile duration, PID, path, stdout, and timestamp. The pair-only resolver reruns those fixed observers and accepts only byte-identical current evidence. The endpoint and source CLI call the same zero-input resolver and return exactly `{schema,currentStatus,deliveryEvidenceRef,deliveryEvidenceHash,evidence}` with no query, run ID, root, ref, hash, body, or transport argument. On a feature branch, detached head, dirty tree, stale `origin/main`, or build-SHA mismatch they fail before focused tests, hashing, resolver access, response serialization, stdout, or any publication side effect. Mission Control implements the wire producer independently against Task 0's canonical schema/status/ref/hash/evidence/null relations; neither repository imports the other. Source-boundary and later wire-integration tests compare the exact canonical response bytes, hash fields, field set, and rejection cases while proving the delivery-evidence response is not added to the ten/twelve/fourteen generated-vendor inventories.

Task 1 implements byte-for-byte the exact nested PBA delivery evidence, focused-test receipt, vendor-lock projection, response property order, tuple order, hash exclusions/ref derivations, and all-required/non-null rules frozen in Task 0; it may not rename, flatten, add, omit, reorder, or make optional any member.

- [ ] **Step 1: Reopen the delivered merge and create the one reconciliation branch**

Run from `mission-control`:

```bash
set -euo pipefail
readonly A_PBA_V2_MERGE_SHA=240e779d78804843a1202cbf0440fe423b806b1a
A_PBA_CURRENT_BRANCH="$(git branch --show-current)"
test "$A_PBA_CURRENT_BRANCH" = "main"
A_PBA_CURRENT_STATUS="$(git status --porcelain=v1 --untracked-files=all)"
test -z "$A_PBA_CURRENT_STATUS"
A_PBA_CURRENT_HEAD="$(git rev-parse HEAD)"
A_PBA_CURRENT_ORIGIN="$(git rev-parse refs/remotes/origin/main)"
test "$A_PBA_CURRENT_HEAD" = "$A_PBA_CURRENT_ORIGIN"
git merge-base --is-ancestor "$A_PBA_V2_MERGE_SHA" "$A_PBA_CURRENT_HEAD"
gh pr view 19 --repo hikmetgulsesli/mission-control --json state,mergedAt,mergeCommit,url
```

Expected: PR #19 is merged at the fixed merge SHA and remains an ancestor of current clean synchronized `main`. The Mission Control delivery owner then creates the single fresh `fix/internal-production-baseline-reconciliation` branch used by Tasks 1–5; the historical `feat/product-build-authority-v2` branch and a second PBA delivery PR are never recreated.

- [ ] **Step 2: Write the failing delivery-evidence projection and branch-refusal tests**

Add exact tests for PR/merge ancestry, all eight ordered path/blob members, current source/tree/build, focused-test receipt, twelve lock identities, deterministic candidate bytes/hash under injected frozen fixtures, and endpoint/CLI-shaped canonical fixture equality without invoking the production observer or pair-only resolver. Observe RED because the owner module and endpoint do not exist. Tests delete or tamper each path blob, vendor-lock identity, test result, source/tree/build value, current status, ref, and hash in turn; simulate missing merge ancestry, dirty/non-main source, unsupported query/body/run ID, a per-run `authorityHash` substituted as the evidence pair, and source/HTTP cross-pairs. A production CLI invocation from `fix/internal-production-baseline-reconciliation` must exit nonzero with empty stdout before focused-test execution, hashing, or resolver access, and publication/store/pointer spies remain at zero. The production endpoint owner and pair resolver have the same branch refusal. No branch test publishes or resolves a production pair; it only compares non-authoritative candidate canonical bytes/hash inside private fixtures. Every case fails closed, and no test or runtime API accepts a root, URL, ref/hash override, evidence body, parser/schema injection, or structural clone.

- [ ] **Step 3: Implement the read-only owner, endpoint, resolver, and non-listening CLI**

The source CLI exists because the pre-Task7 Mission Control service has not loaded Task 1 bytes. Its production path loads only the reviewed post-merge current Mission Control build in a one-shot process, opens no listener, performs no restart, and calls the same zero-input owner used by the endpoint. During Tasks 1–6 Step 7, only private injected-fixture tests may evaluate the contract; direct production CLI, endpoint-owner, observer, and resolver calls on the reconciliation branch must refuse with no pair. After Task 6 Step 8 has built clean synchronized `main`, Task 6A's fixed Setfarm observer may invoke only this CLI before rebind. Task 7 later requires the loaded endpoint to return the byte-identical post-merge pair before it seals post-rebind authority.

- [ ] **Step 4: Run the focused authority and delivery-evidence suite**

```bash
set -euo pipefail
node --import tsx --test \
  server/routes/setfarm-operational.test.ts \
  server/services/setfarm-product-build-authority.test.ts \
  server/services/product-build-authority-v2-delivery-evidence-v1.test.ts \
  tests/product-build-authority-render.test.tsx
```

Expected: all tests pass; V1 remains readable; V2 sealed/refused payloads retain strict server behavior; injected canonical fixtures produce deterministic non-authoritative candidate bytes/hashes; feature-branch production invocation publishes no pair; and every missing/tampered path/blob/lock/test/source/status/cross-pair case fails closed.

- [ ] **Step 5: Review the delivered implementation against the current Setfarm producer**

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
git -C "$SETFARM_ROOT" show "$SETFARM_ROOT_EXPECTED_SHA":src/server/schemas/product-build-authority-v2.ts | sed -n '1,220p'
require_authenticated_clean_main_setfarm_root_v1
git -C "$SETFARM_ROOT" show "$SETFARM_ROOT_EXPECTED_SHA":src/server/product-build-authority.ts | sed -n '300,430p'
git show --stat --oneline 240e779d78804843a1202cbf0440fe423b806b1a
git diff --unified=80 240e779d78804843a1202cbf0440fe423b806b1a..HEAD -- \
  server/routes/setfarm-operational.ts \
  server/services/setfarm-product-build-authority.ts \
  src/lib/product-build-authority.ts \
  src/components/run-detail/ProductBuildAuthority.tsx
```

Expected: any later change is inspected as current descendant history, exact disposition names and refusal identities still match, the server recomputes canonical hashes, the UI never treats a refusal as a sealed packet, and no prose fallback exists. This is evidence collection, not a requirement that current `main` remain byte-equal to the old merge.

- [ ] **Step 6: Prove the branch changes only the evidence surface and cannot emit a current pair**

```bash
set -euo pipefail
A_PBA_BRANCH_STATUS="$(git status --porcelain=v1 --untracked-files=all)"
test -z "$A_PBA_BRANCH_STATUS"
A_PBA_BRANCH_NAME="$(git branch --show-current)"
test "$A_PBA_BRANCH_NAME" = "fix/internal-production-baseline-reconciliation"
A_PBA_BRANCH_STDOUT="$(mktemp "${TMPDIR:-/tmp}/a-pba-branch-stdout.XXXXXX")"
A_PBA_BRANCH_STDERR="$(mktemp "${TMPDIR:-/tmp}/a-pba-branch-stderr.XXXXXX")"
readonly A_PBA_BRANCH_STDOUT A_PBA_BRANCH_STDERR
trap 'rm -f -- "$A_PBA_BRANCH_STDOUT" "$A_PBA_BRANCH_STDERR"' EXIT
if npm run --silent internal:product-build-authority-v2-delivery-evidence -- --json >"$A_PBA_BRANCH_STDOUT" 2>"$A_PBA_BRANCH_STDERR"; then
  A_PBA_BRANCH_CLI_STATUS=0
else
  A_PBA_BRANCH_CLI_STATUS=$?
fi
test "$A_PBA_BRANCH_CLI_STATUS" -ne 0
test ! -s "$A_PBA_BRANCH_STDOUT"
```

Expected: the only source changes are the File Map's owner/test/route/test/package paths on the one reconciliation branch. The production command fails before emitting a response or publishing/resolving evidence. Focused tests separately prove zero publication/store/pointer/resolver calls and may retain only non-authoritative candidate bytes/hashes inside their injected fixture scope. No branch status, shell, checkpoint, review handoff, or commit metadata contains a production current pair.

---

### Task 2: Add an exact project-to-run execution projection

Task 2 continues on Task 1's single `fix/internal-production-baseline-reconciliation` branch after Task 1's focused fixture and feature-branch no-publication tests pass. It does not resolve or consume a production delivery-evidence pair. Tasks 1–5 alone write to that branch. The seven delivered Product Build Authority V2 behavior paths remain verified inputs and are not behaviorally changed unless a newly failing current regression identifies an independently reviewed root fix.

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
- Modify when changed: the twelve producer artifacts under `mission-control/contracts/vendor/setfarm/`
- Modify: `mission-control/scripts/sync-setfarm-contract.mjs`
- Modify: `mission-control/scripts/check-setfarm-contract.mjs`
- Modify: `mission-control/tests/setfarm-contract-vendor.test.ts`

**Interfaces:**

- Consumes: committed Setfarm artifacts under `setfarm/contracts/generated/mission-control/` from final clean Setfarm `main`.
- Produces: one lock whose `producerCommit` equals the exact Setfarm baseline SHA and whose twelve SHA-256 values bind byte-identical vendored artifacts.
- Verifies in private injected fixtures: the eventual `ProductBuildAuthorityV2DeliveryEvidenceV1` canonical evidence bytes/hash include that final twelve-entry lock. These branch-only expected values are non-authoritative test data; Task 5 does not call the production observer/resolver, publish or consume a current pair, add a thirteenth artifact, or write evidence into the vendor lock.

- [ ] **Step 1: Require clean synchronized Setfarm main**

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
git -C "$SETFARM_ROOT" status --short --branch
```

Expected: clean `main`; exact local/remote equality. Do not sync from a feature/spec branch.

- [ ] **Step 2: Verify the producer artifacts before copying**

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
npm --prefix "$SETFARM_ROOT" run check:mission-control-contracts
```

Expected: PASS.

- [ ] **Step 3: Sync from the committed producer**

First add a source-boundary test in `setfarm-contract-vendor.test.ts` that reads `scripts/sync-setfarm-contract.mjs` and requires exactly the two new ordered producer/vendored path pairs in addition to the existing ten; observe RED. Extend only the sync inventory, rerun that named test, then use the sync command. Do not add a directory scan, glob, caller artifact, or alternate repository selection.

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
npm run sync:setfarm-contract -- --source "$SETFARM_ROOT"
```

Expected: the sync either updates only the lock plus the twelve declared vendor files or produces no diff because the byte pin is already current.

- [ ] **Step 4: Cross the semantic consumer after Tasks 2–4**

Update `setfarm-contract-vendor.test.ts` to require exactly twelve distinct lock entries and add `setfarm.operational-active-run-status.v1` to the compatibility descriptor table. The JSON Schema enum must cross `isSetfarmOperationalActiveRunStatusV1()` for all four members in producer order and the schema-valid positive scalar fixture must cross the same predicate. A rehashed fixture containing `pending`, or an enum with a missing/reordered/extra member, must be rejected by the semantic consumer. The test imports the shared adapter and its type; it does not declare another active tuple.

Extend `check-setfarm-contract.mjs` with the same exact contract/stem descriptor. It imports the shared predicate, parses the pinned compatibility envelope, invokes the predicate for its scalar fixture, and requires every ordered generated-schema enum member to pass that predicate; unknown or drifted members fail. The checker never defines another tuple and validates the exact ordered twelve-entry lock.

After the lock check, use only the delivery-evidence test module's private injected contract evaluator to require that the non-authoritative candidate canonical bytes/hash cover the exact lock content hash, producer commit, and twelve ordered artifact identities. The source-boundary test proves the evaluator cannot reach the production observer/resolver/CLI/endpoint owner and that direct production invocation on the reconciliation branch fails before publication. The delivery-evidence response contract is not vendored, stored, registered with the artifact generator, or added to the twelve-artifact inventory; the established inventory remains ten before the operational-active pair, twelve here, and fourteen only when the later run-operational-model-v2 pair is explicitly added.

```bash
set -euo pipefail
npm run check:setfarm-contract
node --import tsx --test \
  server/services/product-build-authority-v2-delivery-evidence-v1.test.ts \
  tests/setfarm-contract-vendor.test.ts
```

Expected: PASS only after the shared consumer exists, all twelve pinned artifact hashes validate, injected fixture expectations cover that exact lock, and branch-refusal tests prove no production current pair can be returned or handed off.

- [ ] **Step 5: Review exact contract scope**

```bash
set -euo pipefail
git status --short
git diff --name-only -- scripts/sync-setfarm-contract.mjs scripts/check-setfarm-contract.mjs contracts/vendor/setfarm tests/setfarm-contract-vendor.test.ts
git diff --check
```

Expected: this task changes only the two sync/check scripts, vendored artifacts/lock, and `tests/setfarm-contract-vendor.test.ts`; Task 1's delivery-evidence contract is evaluated only under private fixtures and changes no source or artifact inventory.

- [ ] **Step 6: Report the contract-pin handoff when it changed**

```bash
set -euo pipefail
if ! git diff --quiet -- scripts/sync-setfarm-contract.mjs scripts/check-setfarm-contract.mjs contracts/vendor/setfarm tests/setfarm-contract-vendor.test.ts; then
  git diff --check -- scripts/sync-setfarm-contract.mjs scripts/check-setfarm-contract.mjs contracts/vendor/setfarm tests/setfarm-contract-vendor.test.ts
  git diff --name-only -- scripts/sync-setfarm-contract.mjs scripts/check-setfarm-contract.mjs contracts/vendor/setfarm tests/setfarm-contract-vendor.test.ts
fi
```

Expected: the worker reports only the sync/check/lock/twelve-vendor/test scope and authorized subject `chore: pin Setfarm baseline contracts` when bytes changed. The owning Setfarm completion claim stages/commits when required; otherwise it records a no-change checkpoint and creates no empty commit.

---

### Task 6: Verify and deliver the remaining Mission Control reconciliation branch through a reviewed PR

**Files:**

- Verify all Mission Control files changed by Tasks 1–5, including the strict delivery-evidence owner/endpoint/resolver, while retaining the delivered per-run Product Build Authority behavior.
- Do not add build output, screenshots, logs, `.env`, or runtime data.

**Interfaces:**

- Consumes before merge: Tasks 1–5 commits, injected-fixture evidence expectations, and feature-branch fail-closed/no-publication results on fresh branch `fix/internal-production-baseline-reconciliation`; it consumes no production `ProductBuildAuthorityV2DeliveryEvidencePairV1`.
- Produces: one reviewed, merged reconciliation PR and a clean local `main` equal to `origin/main`; only Step 8 then builds that merged main and creates/reopens the first authoritative current delivery-evidence pair over the merged source/build/lock. It does not redeliver or invent a global authority pair for per-run Product Build Authority V2.

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
  server/services/product-build-authority-v2-delivery-evidence-v1.test.ts \
  server/services/project-execution-state.test.ts \
  server/routes/projects-projection.test.ts \
  server/routes/overview.test.ts \
  tests/product-build-authority-render.test.tsx \
  tests/project-execution-render.test.tsx \
  tests/active-run-selection.test.ts \
  tests/project-health.test.ts
```

Expected: PASS only from the exact Mission Control root after all prior owner commits are complete and the full tracked/untracked porcelain is empty. Delivery-evidence tests in this feature-branch stage use only injected fixtures and prove direct production observer/resolver/CLI/endpoint-owner invocation fails before pair publication. Transcript/source tests inject one dirty tracked path and one untracked path independently and prove the first positive check is never invoked.

- [ ] **Step 2: Run the full Mission Control suite and build**

```bash
set -euo pipefail
npm test
npm run build
```

Expected: the suite and build exit 0. The feature-branch build is verification input only: it does not make the branch authoritative, and no production source CLI, endpoint owner, observer, resolver, shell status, or handoff consumes or returns a current delivery-evidence pair.

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

Return the exact diff paths and commit-subject checkpoints from Tasks 1–5, the fixture/hash and feature-branch no-publication test results, full verification evidence, secret-scan result, and this bounded PR metadata to the owning Setfarm delivery claim. Do not include or require a production delivery-evidence pair before merge:

```text
repository: hikmetgulsesli/mission-control
base: main
head: fix/internal-production-baseline-reconciliation
title: fix: reconcile Mission Control project authority
body:
## Summary

- retain the delivered per-run Product Build Authority V2 sealed/refused projection unchanged and add its clean-main-only read-only delivery-evidence endpoint
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

Expected: read-only evidence is non-draft, mergeable, clear, and green. Report that gate to the Setfarm delivery owner. Only that owner merges/deletes the branch, synchronizes its claimed canonical worktree to `main`, and returns the merged SHA. The worker then read-only verifies the reported worktree is clean `main` and equals `origin/main` before Task 6A.

- [ ] **Step 8: Build merged clean Mission Control main and create/reopen the first authoritative pair**

```bash
set -euo pipefail
cd /Users/setrox/ai/setrox/mission-control
A_PBA_DELIVERY_BRANCH="$(git branch --show-current)"
test "$A_PBA_DELIVERY_BRANCH" = "main"
A_PBA_DELIVERY_STATUS="$(git status --porcelain=v1 --untracked-files=all)"
test -z "$A_PBA_DELIVERY_STATUS"
A_PBA_DELIVERY_HEAD="$(git rev-parse HEAD)"
A_PBA_DELIVERY_ORIGIN="$(git rev-parse refs/remotes/origin/main)"
test "$A_PBA_DELIVERY_HEAD" = "$A_PBA_DELIVERY_ORIGIN"
npm run build
A_PBA_POST_BUILD_STATUS="$(git status --porcelain=v1 --untracked-files=all)"
test -z "$A_PBA_POST_BUILD_STATUS"
A_PBA_DELIVERY_EVIDENCE_FIRST_JSON="$(npm run --silent internal:product-build-authority-v2-delivery-evidence -- --json)"
A_PBA_DELIVERY_EVIDENCE_SECOND_JSON="$(npm run --silent internal:product-build-authority-v2-delivery-evidence -- --json)"
test "$A_PBA_DELIVERY_EVIDENCE_FIRST_JSON" = "$A_PBA_DELIVERY_EVIDENCE_SECOND_JSON"
printf '%s\n' "$A_PBA_DELIVERY_EVIDENCE_FIRST_JSON" | jq -e '
  .schema == "mission-control.product-build-authority-v2-delivery-evidence-response.v1" and
  .currentStatus == "current" and
  (.deliveryEvidenceRef | startswith("mission-control://internal-production/product-build-authority-v2-delivery-evidence/sha256/")) and
  (.deliveryEvidenceHash | test("^[0-9a-f]{64}$")) and
  .evidence.currentSource.sha == $sourceSha and
  (.evidence.deliveredPathBlobs | length == 8) and
  (.evidence.vendorLock.artifacts | length == 12) and
  .evidence.focusedTests.passed == true
' --arg sourceSha "$A_PBA_DELIVERY_HEAD" >/dev/null
```

Expected: the merge and build gates are the first production call site allowed to construct an authoritative `current` response. Two fresh zero-input non-listening CLI processes call the same code-owned clean-main owner/resolver used by the endpoint and return byte-identical canonical responses; Task 6A's fixed source observer consumes that exact ref/hash. The currently loaded Mission Control service may still be the delivered pre-Task1 build, so no loaded-endpoint availability or source equality is claimed until Task 7 rebinds it; Task 7 then reopens the same pair through the zero-input endpoint. A changed branch, dirty tree, `HEAD`/`origin/main` mismatch, stale/absent build, or build-SHA mismatch fails before either pair is returned.

---

### Task 6A: Prepare one current-entry operation, seal/release the Task 0 spawner, and seal current authority

**Files:** no source edits. Task 0's reviewed clean-main current-entry controller, guarded migration, owner-admission, pre-schema startup admission, fixed restart helper, CLI, and tests own every operation used here.

**Interfaces:**

- `InternalProductionCurrentEntryAuthorityV1` has schema `setfarm.internal-production-current-entry-authority.v1`. It binds reviewed PR #86 merge `1d691c89760339ea905dfe17f8e9188e62603c1c` as an ancestor; exact `controllerSourceAuthority:{controllerSourceSha,controllerTreeHash,controllerBuildHash}` for current clean Task 0 Setfarm main; the current-entry operation pair created before mutation; the pre-schema spawner authorization/restart authority, sealed admission, post-predecessor-termination legacy-zero pair, and same-generation normal-admission-ready pair; exact applied `bootstrapHandoffMigrationReceiptRef/Hash` and `bootstrapHandoffCurrentAuditRef/Hash`; the A-manifest activation/head pairs; separate `loadedRuntimeServiceAuthority` with the spawner equal to the Task 0 controller build while dashboard/Mission-Control/OpenClaw remain on their independently authenticated delivered builds; current clean Mission Control SHA; exact PBA delivery-evidence pair; focused Authority-V3 test receipt; one fresh canary settlement and its fence/typed-target/compound-close/release pairs; and the final complete zero-unrelated-owner census. It has no top-level pending-migration pair or pending-current assertion. The migration receipt preserves the exact v31 predecessor/pre-apply pending quartet plus the pre-schema/sealed/legacy-census/migration-authorization chain as immutable causal history.
- `InternalProductionCurrentEntryAuthorityPairV1` is exactly `{entryAuthorityRef,entryAuthorityHash}`. `InternalProductionCurrentEntryAuthorityStatusV1` is the strict twelve-state union `absent | operation_prepared | pre_schema_spawner_rebinding | pre_manifest_bootstrap_sealed | migration_applying | manifest_activating | spawner_admission_transitioning | prepared | canary_running | settled | ready | blocked` with one immutable operation/head chain. `absent` has every operation/migration/manifest/restart/admission/runtime/PBA/canary/entry field null. `operation_prepared` has only the fixed operation plus read-only PBA/v31/pending/source-build prerequisites. `pre_schema_spawner_rebinding` adds the special authorization and may add its dispatch prefix, but no sealed/migration/manifest/canary field. `pre_manifest_bootstrap_sealed` requires authentic old-spawner terminality, the Task 0 sealed generation, and its post-termination all-36-zero legacy observation. `migration_applying` adds the later equal legacy reobservation and pre-manifest migration authorization/consumption prefix but exposes no receipt until terminal. `manifest_activating` requires the applied receipt/current audit and null activation/admission-ready/runtime/canary suffix. `spawner_admission_transitioning` adds the exact A activation/head while the same generation remains sealed and normal DB readiness is null. `prepared` requires the unchanged-generation `normal-task0-admission-ready` pair after ordinary generic full verify/normal DB initialization, mixed loaded-runtime authority, PBA pair, applied migration/current audit, and manifest pairs while every canary/entry field is null. `canary_running` adds the fence and both typed targets; `settled` adds terminal canary settlement and compound close; only `ready` adds fence release and entry pair. `blocked` preserves exactly the last valid durable prefix with later fields null and one finite reason code.
- The focused-test receipt proves the exact mutually exclusive tuple `SETUP_PACKET_DESIGN_SOURCE_ATTEMPT_REJECTED`, `SETUP_PACKET_DESIGN_SOURCE_CLOSURE_REJECTED`, and `SETUP_PACKET_IMPLEMENTATION_SOURCE_MAP_REJECTED` across source mapping, migration 31, rollback refusal, and terminal-preclaim regressions. The single live canary proves only the one exact failure code it actually observed. It never claims that one run emitted all three mutually exclusive codes.
- The canary settlement requires a new disposable run, one observed tuple member, exactly one terminal claim, exactly one termination request, zero redispatch after terminalization, zero open claim/runtime/completion/effect ownership, and no reuse or continuation of run 2075.
- `prepare-current-entry --json` accepts no root/SHA/run/code/path/receipt override. After it internally reopens Task 6 Step 8's PBA pair plus clean source/build and the read-only v31/pending authorities, it creates or adopts the fixed operation before any service/database mutation and returns only its pair. `resume-current-entry --json` accepts no identity and is the sole production mutation controller: it resumes that fixed operation through pre-schema authorization/dispatch/old-spawner termination/startup seal/post-termination legacy zero, fresh legacy equality reobservation, pre-manifest migration authorization/apply/current audit, A-manifest activation, same-generation generic full verify/normal DB initialization/admission-ready, mixed runtime observation, canary fence/targets/start/settlement/close/release, and ready publication. It never invokes the public normal restart API and exposes no apply/restart/activation mutation argv. `current-entry-status --json` is read-only. `verify-current-entry --json` reopens the ready pair and freshly revalidates the complete operation prefix, applied/current migration, activation, sealed-to-ready same-generation transition, runtime split, PBA, canary chain, and zero owners without starting a run; Task 7 calls it before its first restart and never applies schema.
- Crash/race/replay tests interrupt before and after operation publication, first legacy observation, pre-schema authorization, helper/outbox/dispatch, old-spawner terminal observation, sealed-process startup, post-termination all-36-zero observation, fresh migration-time reobservation, migration authorization/transaction/receipt/current audit, manifest activation, generic full verify/normal DB initialization/admission-ready CAS, mixed runtime observation, PBA resolution, canary fence/targets/start/settlement/close/release, ready publication, and response. Retry adopts only the same operation/head prefix. Race an owner/child at every observation-to-dispatch/termination/seal/apply boundary and require the replacement to stay sealed with migration unavailable. Tests reject default startup success while 32 is pending, any env/argv/caller sealed mode, generic early apply, Task 7 apply, normal complete-zero/restart before activation, missing/second pending migration, causal-pair drift, manifest before schema, canary before admission-ready, dashboard/MC pre-canary rebind, old-spawner production after terminal restart, PBA tamper, fork, second run, unrelated owner, one-sided close, release-before-close, caller scalar, or structural clone.

- [ ] **Step 1: Verify read-only prerequisites, prepare before mutation, and resume to admission-ready**

The operator shell receives `SETFARM_ROOT` and `SETFARM_ROOT_EXPECTED_SHA` from the freshly resolved clean-main controller authority and runs the validator before every command. It records only read-only PBA/v31/pending/service prerequisites, then calls zero-input `prepare-current-entry` before any live mutation and zero-input `resume-current-entry` as the sole mutation controller. The transcript contains no restart, migration-apply, activation, guard, service, label, command, path, or authority-body argv. Dashboard and Mission Control must remain on their delivered generations.

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
git -C "$SETFARM_ROOT" merge-base --is-ancestor 1d691c89760339ea905dfe17f8e9188e62603c1c "$SETFARM_ROOT_EXPECTED_SHA"
require_authenticated_clean_main_setfarm_root_v1
npm --prefix "$SETFARM_ROOT" run check:migration-digests
require_authenticated_clean_main_setfarm_root_v1
node --import tsx --test \
  "$SETFARM_ROOT/tests/execution-attempts/operational-failure-cause-v3.test.ts" \
  "$SETFARM_ROOT/tests/execution-attempts/operational-failure-cause-migration.test.ts" \
  "$SETFARM_ROOT/tests/execution-attempts/v3-setup-build-failure-cause.integration.test.ts" \
  "$SETFARM_ROOT/tests/execution-attempts/v3-platform-preclaim-terminal.integration.test.ts" \
  "$SETFARM_ROOT/tests/execution-attempts/v3-platform-preclaim-termination-race.integration.test.ts"
require_authenticated_clean_main_setfarm_root_v1
A_PBA_DELIVERY_EVIDENCE_JSON="$(npm --prefix "$SETFARM_ROOT" run --silent acceptance:baseline-post-handoff -- observe-product-build-authority-v2-delivery-evidence --json)"
A_PBA_DELIVERY_EVIDENCE_REF="$(printf '%s\n' "$A_PBA_DELIVERY_EVIDENCE_JSON" | jq -er '.deliveryEvidenceRef')"
A_PBA_DELIVERY_EVIDENCE_HASH="$(printf '%s\n' "$A_PBA_DELIVERY_EVIDENCE_JSON" | jq -er '.deliveryEvidenceHash')"
printf '%s\n' "$A_PBA_DELIVERY_EVIDENCE_JSON" | jq -e '
  .currentStatus == "current" and .observationTransport == "source-cli" and
  (.deliveryEvidenceRef | startswith("mission-control://internal-production/product-build-authority-v2-delivery-evidence/sha256/")) and
  (.deliveryEvidenceHash | test("^[0-9a-f]{64}$")) and
  .evidence.deliveryMergeSha == "240e779d78804843a1202cbf0440fe423b806b1a" and
  (.evidence.deliveredPathBlobs | length == 8) and
  (.evidence.vendorLock.artifacts | length == 12) and
  .evidence.focusedTests.passed == true
' >/dev/null
require_authenticated_clean_main_setfarm_root_v1
A_AUTHORITY_V3_V31_JSON="$(npm --prefix "$SETFARM_ROOT" run --silent acceptance:baseline-post-handoff -- audit-authority-v3-migration31 --json)"
A_AUTHORITY_V3_V31_REF="$(printf '%s\n' "$A_AUTHORITY_V3_V31_JSON" | jq -er '.authorityV3Migration31AuditRef')"
A_AUTHORITY_V3_V31_HASH="$(printf '%s\n' "$A_AUTHORITY_V3_V31_JSON" | jq -er '.authorityV3Migration31AuditHash')"
printf '%s\n' "$A_AUTHORITY_V3_V31_JSON" | jq -e '
  .schema == "setfarm.internal-production-authority-v3-migration31-audit.v1" and
  .authorityV3Status == "current" and
  .appliedMigrationOrdinalMax == 31 and
  .appliedMigrationOrdinals == [range(1; 32)] and
  .migration31ApplyStatus == "applied" and .migration31VerifyStatus == "verified" and
  (.authorityV3Migration31AuditRef | startswith("setfarm://internal-production/")) and
  (.authorityV3Migration31AuditHash | test("^[0-9a-f]{64}$"))
' >/dev/null
require_authenticated_clean_main_setfarm_root_v1
A_PENDING_SUCCESSOR_JSON="$(npm --prefix "$SETFARM_ROOT" run --silent acceptance:baseline-post-handoff -- inspect-pending-bootstrap-handoff-successor --json)"
A_PENDING_SUCCESSOR_REF="$(printf '%s\n' "$A_PENDING_SUCCESSOR_JSON" | jq -er '.pendingBootstrapHandoffMigrationRef')"
A_PENDING_SUCCESSOR_HASH="$(printf '%s\n' "$A_PENDING_SUCCESSOR_JSON" | jq -er '.pendingBootstrapHandoffMigrationHash')"
printf '%s\n' "$A_PENDING_SUCCESSOR_JSON" | jq -e '
  .schema == "setfarm.internal-production-pending-bootstrap-handoff-migration-projection.v1" and
  .pendingMigrationCount == 1 and .otherPendingMigrationCount == 0 and .driftedMigrationCount == 0 and
  .migrationId == "contract-spine-bootstrap-main-claim-handoff-v1" and
  .applyStatus == "pending" and .migrationSourceSha == $controllerSha and
  (.migrationImplementationBlobHash | test("^[0-9a-f]{40}([0-9a-f]{24})?$")) and
  (.orderedStatementsHash | test("^[0-9a-f]{64}$")) and
  (.namedMigrationDigestEntryHash | test("^[0-9a-f]{64}$")) and
  (.migrationDigest | test("^[0-9a-f]{64}$")) and
  (.schemaProjectionHash | test("^[0-9a-f]{64}$")) and
  (.pendingBootstrapHandoffMigrationRef | startswith("setfarm://internal-production/")) and
  (.pendingBootstrapHandoffMigrationHash | test("^[0-9a-f]{64}$"))
' --arg controllerSha "$SETFARM_ROOT_EXPECTED_SHA" >/dev/null
require_authenticated_clean_main_setfarm_root_v1
A_PRE_ENTRY_SERVICES_JSON="$(npm --prefix "$SETFARM_ROOT" run --silent acceptance:baseline-post-handoff -- service-census --json)"
A_PRE_ENTRY_DASHBOARD_PID="$(printf '%s\n' "$A_PRE_ENTRY_SERVICES_JSON" | jq -er '.services[] | select(.service == "dashboard") | .pid')"
A_PRE_ENTRY_MC_PID="$(printf '%s\n' "$A_PRE_ENTRY_SERVICES_JSON" | jq -er '.services[] | select(.service == "missionControl") | .pid')"
require_authenticated_clean_main_setfarm_root_v1
A_CURRENT_ENTRY_PREPARE_JSON="$(npm --prefix "$SETFARM_ROOT" run --silent acceptance:baseline-post-handoff -- prepare-current-entry --json)"
A_CURRENT_ENTRY_OPERATION_REF="$(printf '%s\n' "$A_CURRENT_ENTRY_PREPARE_JSON" | jq -er '.operationRef')"
A_CURRENT_ENTRY_OPERATION_HASH="$(printf '%s\n' "$A_CURRENT_ENTRY_PREPARE_JSON" | jq -er '.operationHash')"
printf '%s\n' "$A_CURRENT_ENTRY_PREPARE_JSON" | jq -e '
  (keys == ["operationHash","operationRef"]) and
  (.operationRef | startswith("setfarm://internal-production/")) and
  (.operationHash | test("^[0-9a-f]{64}$"))
' >/dev/null
require_authenticated_clean_main_setfarm_root_v1
A_CURRENT_ENTRY_OPERATION_STATUS="$(npm --prefix "$SETFARM_ROOT" run --silent acceptance:baseline-post-handoff -- current-entry-status --json)"
printf '%s\n' "$A_CURRENT_ENTRY_OPERATION_STATUS" | jq -e \
  --arg operationRef "$A_CURRENT_ENTRY_OPERATION_REF" --arg operationHash "$A_CURRENT_ENTRY_OPERATION_HASH" \
  --arg pbaRef "$A_PBA_DELIVERY_EVIDENCE_REF" --arg pbaHash "$A_PBA_DELIVERY_EVIDENCE_HASH" \
  --arg v31Ref "$A_AUTHORITY_V3_V31_REF" --arg v31Hash "$A_AUTHORITY_V3_V31_HASH" \
  --arg pendingRef "$A_PENDING_SUCCESSOR_REF" --arg pendingHash "$A_PENDING_SUCCESSOR_HASH" '
  .state == "operation_prepared" and
  .operationRef == $operationRef and .operationHash == $operationHash and
  .productBuildAuthorityV2DeliveryEvidenceRef == $pbaRef and
  .productBuildAuthorityV2DeliveryEvidenceHash == $pbaHash and
  .authorityV3Migration31AuditRef == $v31Ref and .authorityV3Migration31AuditHash == $v31Hash and
  .pendingBootstrapHandoffMigrationRef == $pendingRef and .pendingBootstrapHandoffMigrationHash == $pendingHash and
  .preSchemaSpawnerRebindAuthorizationRef == null and
  .bootstrapHandoffMigrationReceiptRef == null and
  .ownerProducerManifestActivationRef == null and
  .spawnerAdmissionReadyRef == null and .canary == null and .entryAuthorityRef == null
' >/dev/null
```

Expected: read-only PBA/v31/pending/source/service prerequisites are captured before `prepare-current-entry`, and the durable `operation_prepared` pair/head exists before the first live mutation. Every later status field is null. This step invokes no resume, restart, migration, activation, guard, run, or other live mutation.

- [ ] **Step 2: Resume the one operation to ready, then verify it read-only**

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
A_CURRENT_ENTRY_PRE_RESUME_STATUS_JSON="$(npm --prefix "$SETFARM_ROOT" run --silent acceptance:baseline-post-handoff -- current-entry-status --json)"
printf '%s\n' "$A_CURRENT_ENTRY_PRE_RESUME_STATUS_JSON" | jq -e '
  .schema == "setfarm.internal-production-current-entry-authority-status.v1" and
  (.operationRef | startswith("setfarm://internal-production/")) and
  (.operationHash | test("^[0-9a-f]{64}$")) and
  (.state == "operation_prepared" or
   .state == "pre_schema_spawner_rebinding" or
   .state == "pre_manifest_bootstrap_sealed" or
   .state == "migration_applying" or
   .state == "manifest_activating" or
   .state == "spawner_admission_transitioning" or
   .state == "prepared" or
   .state == "canary_running" or
   .state == "settled" or
   .state == "ready") and
  .state != "blocked"
' >/dev/null
npm --prefix "$SETFARM_ROOT" run --silent acceptance:baseline-post-handoff -- resume-current-entry --json >/dev/null
require_authenticated_clean_main_setfarm_root_v1
A_READY_PBA_JSON="$(npm --prefix "$SETFARM_ROOT" run --silent acceptance:baseline-post-handoff -- observe-product-build-authority-v2-delivery-evidence --json)"
A_READY_PBA_REF="$(printf '%s\n' "$A_READY_PBA_JSON" | jq -er '.deliveryEvidenceRef')"
A_READY_PBA_HASH="$(printf '%s\n' "$A_READY_PBA_JSON" | jq -er '.deliveryEvidenceHash')"
require_authenticated_clean_main_setfarm_root_v1
A_READY_MIGRATION_JSON="$(npm --prefix "$SETFARM_ROOT" run --silent acceptance:baseline-post-handoff -- resolve-bootstrap-handoff-migration --json)"
A_READY_MIGRATION_REF="$(printf '%s\n' "$A_READY_MIGRATION_JSON" | jq -er '.migrationReceiptRef')"
A_READY_MIGRATION_HASH="$(printf '%s\n' "$A_READY_MIGRATION_JSON" | jq -er '.migrationReceiptHash')"
require_authenticated_clean_main_setfarm_root_v1
A_CURRENT_ENTRY_STATUS_JSON="$(npm --prefix "$SETFARM_ROOT" run --silent acceptance:baseline-post-handoff -- current-entry-status --json)"
printf '%s\n' "$A_CURRENT_ENTRY_STATUS_JSON" | jq -e \
  --arg pbaRef "$A_READY_PBA_REF" --arg pbaHash "$A_READY_PBA_HASH" \
  --arg migrationRef "$A_READY_MIGRATION_REF" --arg migrationHash "$A_READY_MIGRATION_HASH" \
  --arg controllerSha "$SETFARM_ROOT_EXPECTED_SHA" '
  .state == "ready" and
  (.operationRef | startswith("setfarm://internal-production/")) and
  (.operationHash | test("^[0-9a-f]{64}$")) and
  .controllerSourceAuthority.controllerSourceSha == $controllerSha and
  (.controllerSourceAuthority.controllerTreeHash | test("^[0-9a-f]{40}([0-9a-f]{24})?$")) and
  (.controllerSourceAuthority.controllerBuildHash | test("^[0-9a-f]{64}$")) and
  (.loadedRuntimeServiceAuthority.authorityHash | test("^[0-9a-f]{64}$")) and
  .productBuildAuthorityV2DeliveryEvidenceRef == $pbaRef and .productBuildAuthorityV2DeliveryEvidenceHash == $pbaHash and
  (.preSchemaSpawnerRebindAuthorizationRef | startswith("setfarm://internal-production/")) and
  (.preSchemaSpawnerRebindAuthorizationHash | test("^[0-9a-f]{64}$")) and
  (.preSchemaSpawnerStartupTokenRef | startswith("setfarm://internal-production/")) and
  (.preSchemaSpawnerStartupTokenHash | test("^[0-9a-f]{64}$")) and
  (.preSchemaSpawnerRestartAuthorityRef | startswith("setfarm://internal-production/")) and
  (.preSchemaSpawnerRestartAuthorityHash | test("^[0-9a-f]{64}$")) and
  (.preSchemaSpawnerSealedAdmissionRef | startswith("setfarm://internal-production/")) and
  (.preSchemaSpawnerSealedAdmissionHash | test("^[0-9a-f]{64}$")) and
  (.postPredecessorTerminationLegacyZeroOwnerObservationRef | startswith("setfarm://internal-production/")) and
  (.postPredecessorTerminationLegacyZeroOwnerObservationHash | test("^[0-9a-f]{64}$")) and
  (.preManifestMigration32AuthorizationRef | startswith("setfarm://internal-production/")) and
  (.preManifestMigration32AuthorizationHash | test("^[0-9a-f]{64}$")) and
  .bootstrapHandoffMigrationReceiptRef == $migrationRef and .bootstrapHandoffMigrationReceiptHash == $migrationHash and
  (.bootstrapHandoffCurrentAuditRef | startswith("setfarm://internal-production/")) and
  (.bootstrapHandoffCurrentAuditHash | test("^[0-9a-f]{64}$")) and
  (.ownerProducerManifestActivationRef | startswith("setfarm://internal-production/")) and
  (.ownerProducerManifestActivationHash | test("^[0-9a-f]{64}$")) and
  (.ownerProducerManifestHeadRef | startswith("setfarm://internal-production/")) and
  (.ownerProducerManifestHeadHash | test("^[0-9a-f]{64}$")) and
  (.spawnerAdmissionReadyRef | startswith("setfarm://internal-production/")) and
  (.spawnerAdmissionReadyHash | test("^[0-9a-f]{64}$")) and
  .preManifestBootstrapSealedSpawnerGenerationHash == .normalTask0AdmissionSpawnerGenerationHash and
  (has("pendingBootstrapHandoffMigrationRef") | not) and
  (.entryAuthorityRef | startswith("setfarm://internal-production/")) and
  (.entryAuthorityHash | test("^[0-9a-f]{64}$")) and
  (.canary.observedFailureCode == "SETUP_PACKET_DESIGN_SOURCE_ATTEMPT_REJECTED" or
   .canary.observedFailureCode == "SETUP_PACKET_DESIGN_SOURCE_CLOSURE_REJECTED" or
   .canary.observedFailureCode == "SETUP_PACKET_IMPLEMENTATION_SOURCE_MAP_REJECTED") and
  .canary.claimCount == 1 and
  .canary.terminationRequestCount == 1 and
  .canary.redispatchCount == 0 and
  .canary.finalOwnershipCount == 0 and
  (.canary.ownerAdmissionFenceRef | startswith("setfarm://internal-production/")) and
  (.canary.ownerAdmissionFenceHash | test("^[0-9a-f]{64}$")) and
  (.canary.sourceRunTargetReservationRef | startswith("setfarm://internal-production/")) and
  (.canary.sourceRunTargetReservationHash | test("^[0-9a-f]{64}$")) and
  (.canary.runTargetReservationRef | startswith("setfarm://internal-production/")) and
  (.canary.runTargetReservationHash | test("^[0-9a-f]{64}$")) and
  (.canary.targetCloseRef | startswith("setfarm://internal-production/")) and
  (.canary.targetCloseHash | test("^[0-9a-f]{64}$")) and
  (.canary.ownerAdmissionFenceReleaseRef | startswith("setfarm://internal-production/")) and
  (.canary.ownerAdmissionFenceReleaseHash | test("^[0-9a-f]{64}$"))
' >/dev/null
require_authenticated_clean_main_setfarm_root_v1
A_PRE_MUTATION_DASHBOARD_PID="$(printf '%s\n' "$A_CURRENT_ENTRY_STATUS_JSON" | jq -er '.preMutationLoadedRuntimeServiceAuthority.services[] | select(.service == "dashboard") | .pid')"
A_PRE_MUTATION_MC_PID="$(printf '%s\n' "$A_CURRENT_ENTRY_STATUS_JSON" | jq -er '.preMutationLoadedRuntimeServiceAuthority.services[] | select(.service == "missionControl") | .pid')"
A_READY_SERVICE_CENSUS_JSON="$(npm --prefix "$SETFARM_ROOT" run --silent acceptance:baseline-post-handoff -- service-census --json)"
printf '%s\n' "$A_READY_SERVICE_CENSUS_JSON" | jq -e \
  --arg controllerSha "$SETFARM_ROOT_EXPECTED_SHA" \
  --argjson dashboardPid "$A_PRE_MUTATION_DASHBOARD_PID" \
  --argjson mcPid "$A_PRE_MUTATION_MC_PID" '
  .schema == "setfarm.internal-production-service-census.v1" and
  (.services | length == 4) and
  (.services[] | select(.service == "spawner") | .loadedSourceSha) == $controllerSha and
  (.services[] | select(.service == "dashboard") | .pid) == $dashboardPid and
  (.services[] | select(.service == "missionControl") | .pid) == $mcPid
' >/dev/null
require_authenticated_clean_main_setfarm_root_v1
npm --prefix "$SETFARM_ROOT" run --silent acceptance:baseline-post-handoff -- verify-current-entry --json
```

Expected: the adjacent read-only status block freshly reopens the one fixed operation in a valid resumable prefix; `blocked`, `absent`, or a crossed operation fails before mutation. The single zero-input `resume-current-entry` then internally consumes that fixed authority and drives or adopts it through the acyclic startup token → restart → predecessor termination/postzero → sealed admission chain, pre-manifest migration authorization/applied-current receipt, A activation, unchanged-generation admission-ready transition, and one fence/two-target canary lifecycle. It internally establishes the durable `prepared` admission-ready barrier before canary admission and never accepts mutation argv. A ready retry returns the byte-identical terminal without a new effect. Every crash/retry uses the same operation head and cannot skip or overshoot an invalid prefix. Dashboard and Mission Control remain on their pre-mutation PIDs. Subsequent status, service census, pair resolution, and `verify-current-entry` calls are read-only. The canary records one exact observed failure lifecycle; the separate focused-test receipt remains the proof for the complete three-code set.

Task 7 alone may consume this ready pre-rebind pair. No Task 8 or B/C/D/E action consumes it directly; those phases require Task 7's strict post-rebind successor.

---

### Task 7: Rebuild clean main, validate the applied baseline schema, and rebind all internal services safely

**Files:**

- No source edits.
- Runtime build output remains ignored/untracked.

**Interfaces:**

- Consumes: the ready pre-full-rebind `InternalProductionCurrentEntryAuthorityPairV1`, including its prepared-before-mutation operation, pre-schema startup token/restart/termination/postzero/sealed chain, already applied/current migration receipt/audit with immutable v31/pending causal quartet, A-manifest activation, same-generation normal-admission-ready pair, mixed loaded-runtime authority, canary chain, and PBA pair; merged Mission Control `main`; merged Setfarm `main`; and zero active ownership.
- Produces: no schema mutation. It read-only reopens/verifies that same migration receipt/current audit, then loads clean-main builds into the Setfarm spawner, Setfarm dashboard, and Mission Control processes with healthy HTTP endpoints and exact process/build identity evidence, and seals one strict `InternalProductionPostRebindEntryAuthorityPairV1` successor.

`InternalProductionPostRebindEntryAuthorityV1` has schema `setfarm.internal-production-post-rebind-entry-authority.v1` and exact derived pair `{postRebindEntryAuthorityRef,postRebindEntryAuthorityHash}`. It binds the predecessor current-entry pair and reopens its controller operation, pre-schema token/restart/sealed admission/postzero, admission-ready transition, mixed predecessor runtime, applied migration receipt/current audit, A-manifest activation, canary chain, and PBA pair. It binds the byte-identical migration pair again rather than creating a Task 7 migration authority; the receipt's v31/pending and pre-schema authorization chains remain causal history only. It additionally binds the live-rebind restart-sequence pair and three ordered service authority pairs; Task 7 Setfarm controller source/tree/build; Mission Control source/tree/build; post-rebind loaded-service authority; service census, runtime-source, health, and final complete zero-owner hashes. Every scoped loaded Setfarm service must equal Task 7's controller source/build and Mission Control must equal its Task 7 build; OpenClaw remains identity/health only. The loaded PBA endpoint must resolve by HTTP to the predecessor pair. The resolver/current verifier reopens every dependency and reobserves source/build/schema/services/evidence/zero owners without any migration writer.

`InternalProductionPostRebindEntryAuthorityStatusV1` is `absent | predecessor_ready | rebuilding | restarting | verifying | ready | blocked`; there is no `migration_applying` branch. `absent` has every predecessor/restart/service/verification/authority field null. `predecessor_ready` requires the predecessor pair plus its prepared operation, terminal pre-schema/sealed/admission-ready chain, already applied migration/current audit, manifest, predecessor runtime, canary, and PBA pairs. `rebuilding` adds Task 7 clean builds while post-rebind restart/service/evidence fields remain null. `restarting` adds the live-rebind sequence prefix. `verifying` adds terminal restart/service fields and scoped loaded-source/build equality while final HTTP evidence/health/zero-owner/post pair remain null. Only `ready` adds HTTP evidence equality, final verification tuple, and post-rebind pair. `blocked` preserves exactly the last valid prefix with every later field null. One expected-predecessor head makes prepare/resume/status crash-idempotent; retry never applies migration or repeats a settled restart.

The post-rebind producer requires its migration pair to equal the already applied pair in current-entry, then reopens the receipt and its `predecessorAuthorityV3Migration31AuditRef/Hash` plus `pendingBootstrapHandoffMigrationRef/Hash`. It treats the pending pair as immutable pre-apply history, never a current-pending assertion. Every B/C/D/E consumer obtains the applied pair and causal quartet only through the current post-rebind successor.

- [ ] **Step 1: Prove there is no active ownership before restart**

Run with `SETFARM_PG_URL` already present in the operator shell:

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
npm run --silent acceptance:baseline-post-handoff -- verify-current-entry --json
require_authenticated_clean_main_setfarm_root_v1
npm run acceptance:baseline-post-handoff -- zero-owner --json
```

Expected: the complete code-owned census is zero. If not, stop; do not restart or mutate rows/processes/worktrees.

- [ ] **Step 2: Rebuild Setfarm from clean main**

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
A_SETFARM_BUILD_BRANCH="$(git branch --show-current)"
test "$A_SETFARM_BUILD_BRANCH" = "main"
A_SETFARM_BUILD_STATUS="$(git status --porcelain=v1 --untracked-files=all)"
test -z "$A_SETFARM_BUILD_STATUS"
require_authenticated_clean_main_setfarm_root_v1
npm ci
require_authenticated_clean_main_setfarm_root_v1
npm test
require_authenticated_clean_main_setfarm_root_v1
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

- [ ] **Step 3a: Read-only reopen the Task 6A A11 manifest activation**

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
A_MANIFEST_ACTIVATION_JSON="$(npm run --silent acceptance:baseline-post-handoff -- \
  owner-producer-manifest-status --json)"
A_MANIFEST_RECEIPT_REF="$(printf '%s\n' "$A_MANIFEST_ACTIVATION_JSON" | jq -er '.receiptRef')"
A_MANIFEST_RECEIPT_HASH="$(printf '%s\n' "$A_MANIFEST_ACTIVATION_JSON" | jq -er '.receiptHash')"
A_MANIFEST_SUCCESSOR_ACTIVATION_REF="$(printf '%s\n' "$A_MANIFEST_ACTIVATION_JSON" | jq -er '.successorActivationRef')"
A_MANIFEST_SUCCESSOR_ACTIVATION_HASH="$(printf '%s\n' "$A_MANIFEST_ACTIVATION_JSON" | jq -er '.successorActivationHash')"
A_MANIFEST_SUCCESSOR_HEAD_REF="$(printf '%s\n' "$A_MANIFEST_ACTIVATION_JSON" | jq -er '.successorHeadRef')"
A_MANIFEST_SUCCESSOR_HEAD_HASH="$(printf '%s\n' "$A_MANIFEST_ACTIVATION_JSON" | jq -er '.successorHeadHash')"
printf '%s\n' "$A_MANIFEST_ACTIVATION_JSON" | jq -e '
  .schema == "setfarm.internal-production-baseline-owner-producer-manifest-activation-status.v1" and
  .state == "active" and
  .predecessorActivationRef == null and .predecessorActivationHash == null and
  .predecessorHeadRef == null and .predecessorHeadHash == null and
  (.manifestHash | test("^[0-9a-f]{64}$")) and
  (.sourceBuildAuthorityRef | type == "string") and
  (.sourceBuildAuthorityHash | test("^[0-9a-f]{64}$"))
' >/dev/null
require_authenticated_clean_main_setfarm_root_v1
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

Expected: two read-only observations reopen and re-hash the exact Task 6A A11 successor receipt/head tuple and wrapper status. Any status other than `active`, unequal pair, non-null predecessor, dirty/wrong-source-build authority, or ambiguity exits here. Task 7 performs no activation, migration, guard, source-bootstrap, or owner-admission mutation in this step.

- [ ] **Step 4: Read-only reopen and verify the Task 6A migration before any Task 7 restart**

Run the just-built CLI directly from clean Setfarm `main`. Task 6A has already applied migration 32 and rebound the spawner; this step may only validate those authorities:

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
A_PRE_MIGRATION_BRANCH="$(git branch --show-current)"
test "$A_PRE_MIGRATION_BRANCH" = "main"
A_PRE_MIGRATION_STATUS="$(git status --porcelain=v1 --untracked-files=all)"
test -z "$A_PRE_MIGRATION_STATUS"
A_PRE_MIGRATION_HEAD="$(git rev-parse HEAD)"
A_PRE_MIGRATION_ORIGIN="$(git rev-parse refs/remotes/origin/main)"
test "$A_PRE_MIGRATION_HEAD" = "$A_PRE_MIGRATION_ORIGIN"
A_PRE_MIGRATION_BUILD_SHA="$(jq -er '.sha' dist/BUILD_INFO.json)"
test "$A_PRE_MIGRATION_BUILD_SHA" = "$A_PRE_MIGRATION_HEAD"
require_authenticated_clean_main_setfarm_root_v1
A_PREDECESSOR_CURRENT_ENTRY_JSON="$(npm run --silent acceptance:baseline-post-handoff -- verify-current-entry --json)"
A_MIGRATION_RECEIPT_REF="$(printf '%s\n' "$A_PREDECESSOR_CURRENT_ENTRY_JSON" | jq -er '.bootstrapHandoffMigrationReceiptRef')"
A_MIGRATION_RECEIPT_HASH="$(printf '%s\n' "$A_PREDECESSOR_CURRENT_ENTRY_JSON" | jq -er '.bootstrapHandoffMigrationReceiptHash')"
A_CURRENT_AUDIT_REF="$(printf '%s\n' "$A_PREDECESSOR_CURRENT_ENTRY_JSON" | jq -er '.bootstrapHandoffCurrentAuditRef')"
A_CURRENT_AUDIT_HASH="$(printf '%s\n' "$A_PREDECESSOR_CURRENT_ENTRY_JSON" | jq -er '.bootstrapHandoffCurrentAuditHash')"
require_authenticated_clean_main_setfarm_root_v1
npm run db:contract-spine:plan
require_authenticated_clean_main_setfarm_root_v1
npm run check:migration-digests
require_authenticated_clean_main_setfarm_root_v1
A_MIGRATION_RECEIPT_JSON="$(npm run --silent acceptance:baseline-post-handoff -- resolve-bootstrap-handoff-migration --json)"
printf '%s\n' "$A_MIGRATION_RECEIPT_JSON" | jq -e \
  --arg receiptRef "$A_MIGRATION_RECEIPT_REF" \
  --arg receiptHash "$A_MIGRATION_RECEIPT_HASH" '
  .schema == "setfarm.internal-production-baseline-bootstrap-handoff-migration-receipt.v1" and
  .migrationId == "contract-spine-bootstrap-main-claim-handoff-v1" and
  .migrationReceiptRef == $receiptRef and .migrationReceiptHash == $receiptHash and
  (.predecessorAuthorityV3Migration31AuditRef | startswith("setfarm://internal-production/")) and
  (.predecessorAuthorityV3Migration31AuditHash | test("^[0-9a-f]{64}$")) and
  (.pendingBootstrapHandoffMigrationRef | startswith("setfarm://internal-production/")) and
  (.pendingBootstrapHandoffMigrationHash | test("^[0-9a-f]{64}$")) and
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
  .ownerReservationSidecarPresent == true and
  .ownerAdmissionHeadPresent == true and
  .ownerReservationSidecarPresent == true and
  .ownerAdmissionHeadPresent == true
' >/dev/null
require_authenticated_clean_main_setfarm_root_v1
npm run db:contract-spine:verify
require_authenticated_clean_main_setfarm_root_v1
A_SUCCESSOR_CURRENT_JSON="$(npm run --silent acceptance:baseline-post-handoff -- verify-bootstrap-handoff-migration-current --json)"
printf '%s\n' "$A_SUCCESSOR_CURRENT_JSON" | jq -e \
  --arg receiptRef "$A_MIGRATION_RECEIPT_REF" --arg receiptHash "$A_MIGRATION_RECEIPT_HASH" \
  --arg currentRef "$A_CURRENT_AUDIT_REF" --arg currentHash "$A_CURRENT_AUDIT_HASH" '
  .schema == "setfarm.internal-production-bootstrap-handoff-current-audit.v1" and
  .migrationReceiptRef == $receiptRef and .migrationReceiptHash == $receiptHash and
  .bootstrapHandoffCurrentAuditRef == $currentRef and .bootstrapHandoffCurrentAuditHash == $currentHash and
  .applyStatus == "applied" and .verifyStatus == "verified" and .currentStatus == "current" and
  .pendingMigrationCount == 0 and .driftedMigrationCount == 0 and
  (.bootstrapHandoffCurrentAuditRef | startswith("setfarm://internal-production/")) and
  (.bootstrapHandoffCurrentAuditHash | test("^[0-9a-f]{64}$"))
' >/dev/null
A_POST_MIGRATION_STATUS="$(git status --porcelain=v1 --untracked-files=all)"
test -z "$A_POST_MIGRATION_STATUS"
A_POST_MIGRATION_HEAD="$(git rev-parse HEAD)"
test "$A_POST_MIGRATION_HEAD" = "$A_PRE_MIGRATION_HEAD"
```

Expected: Task 7 reopens the byte-identical Task 6A receipt/current-audit pairs from current-entry, verifies the receipt's immutable v31/pending causal history and both schema families, and runs generic full verification read-only. There is no guard, dedicated apply call, schema transaction, or manifest activation. A missing/corrupt/unverified, non-ancestral, cross-paired, or blob/digest/schema-mismatched authority blocks before a Task 7 restart reservation or side effect.

- [ ] **Step 5: Rebind the spawner, dashboard, and Mission Control to the verified builds**

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
readonly A_SETFARM_ROOT="$SETFARM_ROOT"
readonly A_MC_ROOT=/Users/setrox/ai/setrox/mission-control
A_UID="$(id -u)"
readonly A_UID
cd "$A_SETFARM_ROOT"

require_authenticated_clean_main_setfarm_root_v1
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

A_OLD_SERVICE_CENSUS_JSON="$(
  require_authenticated_clean_main_setfarm_root_v1
  npm run --silent acceptance:baseline-post-handoff -- service-census --json
)"
printf '%s\n' "$A_OLD_SERVICE_CENSUS_JSON" | jq -e '
  .schema == "setfarm.internal-production-service-census.v1" and
  .spawner.processOwnerCount == 1 and
  .dashboard.processOwnerCount == 1 and .dashboard.listenerOwnerCount == 1 and
  .missionControl.processOwnerCount == 1 and .missionControl.listenerOwnerCount == 1 and
  .openClaw.processOwnerCount == 1 and .openClaw.listenerOwnerCount == 1 and
  (.censusHash | test("^[0-9a-f]{64}$"))
' >/dev/null
A_OLD_SPAWNER_PID="$(printf '%s\n' "$A_OLD_SERVICE_CENSUS_JSON" | jq -er '.spawner.pid')"
readonly A_OLD_SPAWNER_PID
A_OLD_DASHBOARD_PID="$(printf '%s\n' "$A_OLD_SERVICE_CENSUS_JSON" | jq -er '.dashboard.pid')"
readonly A_OLD_DASHBOARD_PID
A_OLD_MC_PID="$(printf '%s\n' "$A_OLD_SERVICE_CENSUS_JSON" | jq -er '.missionControl.pid')"
readonly A_OLD_MC_PID

A_LIVE_RESTART_SEQUENCE="$(
  require_authenticated_clean_main_setfarm_root_v1
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
  require_authenticated_clean_main_setfarm_root_v1
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

A_NEW_SERVICE_CENSUS_JSON="$(
  require_authenticated_clean_main_setfarm_root_v1
  npm run --silent acceptance:baseline-post-handoff -- service-census --json
)"
printf '%s\n' "$A_NEW_SERVICE_CENSUS_JSON" | jq -e '
  .schema == "setfarm.internal-production-service-census.v1" and
  .spawner.processOwnerCount == 1 and
  .dashboard.processOwnerCount == 1 and .dashboard.listenerOwnerCount == 1 and
  .missionControl.processOwnerCount == 1 and .missionControl.listenerOwnerCount == 1 and
  .openClaw.processOwnerCount == 1 and .openClaw.listenerOwnerCount == 1 and
  (.censusHash | test("^[0-9a-f]{64}$"))
' >/dev/null
A_NEW_SPAWNER_PID="$(printf '%s\n' "$A_NEW_SERVICE_CENSUS_JSON" | jq -er '.spawner.pid')"
readonly A_NEW_SPAWNER_PID
A_NEW_DASHBOARD_PID="$(printf '%s\n' "$A_NEW_SERVICE_CENSUS_JSON" | jq -er '.dashboard.pid')"
readonly A_NEW_DASHBOARD_PID
A_NEW_MC_PID="$(printf '%s\n' "$A_NEW_SERVICE_CENSUS_JSON" | jq -er '.missionControl.pid')"
readonly A_NEW_MC_PID
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
require_authenticated_clean_main_setfarm_root_v1
npm run acceptance:baseline-post-handoff -- zero-owner --json
require_authenticated_clean_main_setfarm_root_v1
npm run acceptance:baseline-post-handoff -- runtime-source \
  --setfarm-sha "$A_SETFARM_SHA" \
  --mission-control-sha "$A_MC_SHA" \
  --json
printf '%s\n' \
  "setfarmSha=$A_SETFARM_SHA spawnerPid=$A_NEW_SPAWNER_PID spawnerBuildHash=$A_SPAWNER_BUILD_HASH" \
  "setfarmSha=$A_SETFARM_SHA dashboardPid=$A_NEW_DASHBOARD_PID dashboardBuildHash=$A_DASHBOARD_BUILD_HASH" \
  "missionControlSha=$A_MC_SHA missionControlPid=$A_NEW_MC_PID missionControlBuildHash=$A_MC_BUILD_HASH"
```

Expected: before its first reservation, the resolved `live-rebind` sequence freshly reopens and binds the exact Task 6A-applied migration ref/hash/schema projection. It then proves each exact fresh zero-owner guard was durably retained before its restart, each migration-bound composite pair was freshly resolved and predecessor-CAS advanced in spawner-to-dashboard-to-Mission-Control order, and the final zero-owner census settled before completion. The review packet/private live handoff binds `A_LIVE_RESTART_SEQUENCE_REF`, `A_LIVE_RESTART_SEQUENCE_HASH`, the migration identity, and the resolved receipt's exact three ordered authority pairs. Every daemon PID changes, every new command names the canonical built entrypoint, the entrypoint hashes remain those measured from clean `main`, and both HTTP services recover. Only the bounded sequence/status evidence and three identity lines are retained; no guard capability, raw restart body, or LaunchAgent environment dictionary is captured.

- [ ] **Step 6: Prove the active count is reconciled**

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
require_authenticated_clean_main_setfarm_root_v1
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
A_SERVICE_CENSUS_JSON="$(
  require_authenticated_clean_main_setfarm_root_v1
  npm run --silent acceptance:baseline-post-handoff -- service-census --json
)"
printf '%s\n' "$A_SERVICE_CENSUS_JSON" | jq -e '
  .schema == "setfarm.internal-production-service-census.v1" and
  .spawner.processOwnerCount == 1 and
  .dashboard.processOwnerCount == 1 and .dashboard.listenerOwnerCount == 1 and
  .missionControl.processOwnerCount == 1 and .missionControl.listenerOwnerCount == 1 and
  .openClaw.processOwnerCount == 1 and .openClaw.listenerOwnerCount == 1 and
  (.censusHash | test("^[0-9a-f]{64}$"))
' >/dev/null
require_authenticated_clean_main_setfarm_root_v1
setfarm dashboard status
require_authenticated_clean_main_setfarm_root_v1
setfarm spawner status
```

Expected: one unique listener owner for each port, one spawner process, and both Setfarm status commands report running. The transient LaunchAgent watchdog command is not counted as a second daemon.

- [ ] **Step 8: Seal and verify the post-rebind entry successor**

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
npm --prefix "$SETFARM_ROOT" run --silent acceptance:baseline-post-handoff -- resume-post-rebind-entry --json
require_authenticated_clean_main_setfarm_root_v1
A_POST_REBIND_STATUS_JSON="$(npm --prefix "$SETFARM_ROOT" run --silent acceptance:baseline-post-handoff -- post-rebind-entry-status --json)"
printf '%s\n' "$A_POST_REBIND_STATUS_JSON" | jq -e '
  . as $status |
  .state == "ready" and
  (.predecessorCurrentEntryRef | startswith("setfarm://internal-production/")) and
  (.predecessorCurrentEntryHash | test("^[0-9a-f]{64}$")) and
  (.predecessorLoadedRuntimeServiceAuthorityHash | test("^[0-9a-f]{64}$")) and
  (.predecessorAuthorityV3Migration31AuditRef | startswith("setfarm://internal-production/")) and
  (.predecessorAuthorityV3Migration31AuditHash | test("^[0-9a-f]{64}$")) and
  (.predecessorPendingBootstrapHandoffMigrationRef | startswith("setfarm://internal-production/")) and
  (.predecessorPendingBootstrapHandoffMigrationHash | test("^[0-9a-f]{64}$")) and
  (.migrationReceiptRef | startswith("setfarm://internal-production/")) and
  (.migrationReceiptHash | test("^[0-9a-f]{64}$")) and
  (.bootstrapHandoffCurrentAuditRef | startswith("setfarm://internal-production/")) and
  (.bootstrapHandoffCurrentAuditHash | test("^[0-9a-f]{64}$")) and
  (.restartSequenceRef | startswith("setfarm://internal-production/")) and
  (.restartSequenceHash | test("^[0-9a-f]{64}$")) and
  all(.loadedRuntimeServiceAuthority.setfarmServices[];
    .loadedSourceSha == $status.controllerSourceAuthority.controllerSourceSha and
    .loadedTreeHash == $status.controllerSourceAuthority.controllerTreeHash and
    .loadedBuildHash == $status.controllerSourceAuthority.controllerBuildHash) and
  .loadedRuntimeServiceAuthority.missionControl.loadedSourceSha == .missionControlSourceAuthority.sourceSha and
  .loadedRuntimeServiceAuthority.missionControl.loadedTreeHash == .missionControlSourceAuthority.treeHash and
  .loadedRuntimeServiceAuthority.missionControl.loadedBuildHash == .missionControlSourceAuthority.buildHash and
  .productBuildAuthorityV2DeliveryEvidenceObservationTransport == "http" and
  .productBuildAuthorityV2DeliveryEvidenceRef == .predecessorProductBuildAuthorityV2DeliveryEvidenceRef and
  .productBuildAuthorityV2DeliveryEvidenceHash == .predecessorProductBuildAuthorityV2DeliveryEvidenceHash and
  (.postRebindEntryAuthorityRef | startswith("setfarm://internal-production/")) and
  (.postRebindEntryAuthorityHash | test("^[0-9a-f]{64}$"))
' >/dev/null
require_authenticated_clean_main_setfarm_root_v1
npm --prefix "$SETFARM_ROOT" run --silent acceptance:baseline-post-handoff -- verify-post-rebind-entry --json
```

Expected: the first call creates or adopts exactly one linear successor after all Task 7 effects are terminal; response loss at any store/head boundary returns the byte-identical pair. Status/resolver preserve the predecessor's distinct mixed loaded-runtime authority, Task 6A-applied migration receipt/current-audit pair, that receipt's immutable v31/pending causal quartet, and delivery-evidence pair; prove that exact receipt remains applied/current; prove every scoped Setfarm service is loaded from Task 7's controller source/tree/build and Mission Control from its Task 7 source/tree/build; and require the rebound HTTP endpoint to return the same delivery-evidence pair previously observed through the source CLI. No Task 8 or B/C/D/E operation begins until this pair is `ready` and current.

---

### Task 8: Take the baseline backup and record the acceptance packet

**Files:**

- Create: `docs/review-packets/2026-08-13-internal-production-baseline.md`
- Create outside Git: `/Users/setrox/ai/setrox/data/backups/internal-production-baseline/setfarm.dump`
- Create outside Git: `/Users/setrox/ai/setrox/data/backups/internal-production-baseline/setfarm.list.txt`
- Create outside Git: `/Users/setrox/ai/setrox/data/backups/internal-production-baseline/setfarm.sha256`

**Interfaces:**

- Consumes: a freshly verified current `InternalProductionPostRebindEntryAuthorityPairV1`, clean-main repositories, healthy services, matching active censuses, Task 6A's already applied and Task 7 restart-bound exact bootstrap-handoff migration receipt, and the current PostgreSQL schema. It resolves the predecessor current-entry pair only through that successor and never asks the pre-rebind verifier to remain current.
- Produces: one crash-resumable authenticated backup receipt and a bounded Markdown summary that binds, but does not reapply, the already verified migration and does not embed the dump or secrets.

- [ ] **Step 1: Freshly resolve the applied migration and run read-only authority audits**

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
A_POST_REBIND_ENTRY_JSON="$(npm run --silent acceptance:baseline-post-handoff -- verify-post-rebind-entry --json)"
A_POST_REBIND_V31_REF="$(printf '%s\n' "$A_POST_REBIND_ENTRY_JSON" | jq -er '.predecessorAuthorityV3Migration31AuditRef')"
A_POST_REBIND_V31_HASH="$(printf '%s\n' "$A_POST_REBIND_ENTRY_JSON" | jq -er '.predecessorAuthorityV3Migration31AuditHash')"
A_POST_REBIND_PENDING_REF="$(printf '%s\n' "$A_POST_REBIND_ENTRY_JSON" | jq -er '.predecessorPendingBootstrapHandoffMigrationRef')"
A_POST_REBIND_PENDING_HASH="$(printf '%s\n' "$A_POST_REBIND_ENTRY_JSON" | jq -er '.predecessorPendingBootstrapHandoffMigrationHash')"
require_authenticated_clean_main_setfarm_root_v1
npm run db:contract-spine:plan
require_authenticated_clean_main_setfarm_root_v1
npm run check:migration-digests
require_authenticated_clean_main_setfarm_root_v1
A_MIGRATION_RECEIPT_JSON="$(npm run --silent acceptance:baseline-post-handoff -- resolve-bootstrap-handoff-migration --json)"
printf '%s\n' "$A_MIGRATION_RECEIPT_JSON" | jq -e '
  .schema == "setfarm.internal-production-baseline-bootstrap-handoff-migration-receipt.v1" and
  .migrationId == "contract-spine-bootstrap-main-claim-handoff-v1" and
  .predecessorAuthorityV3Migration31AuditRef == $v31Ref and
  .predecessorAuthorityV3Migration31AuditHash == $v31Hash and
  .pendingBootstrapHandoffMigrationRef == $pendingRef and
  .pendingBootstrapHandoffMigrationHash == $pendingHash and
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
  .ownerReservationSidecarPresent == true and
  .ownerAdmissionHeadPresent == true and
  (.migrationReceiptRef | startswith("setfarm://internal-production/")) and
  (.migrationReceiptHash | test("^[0-9a-f]{64}$"))
' --arg v31Ref "$A_POST_REBIND_V31_REF" \
  --arg v31Hash "$A_POST_REBIND_V31_HASH" \
  --arg pendingRef "$A_POST_REBIND_PENDING_REF" \
  --arg pendingHash "$A_POST_REBIND_PENDING_HASH" >/dev/null
require_authenticated_clean_main_setfarm_root_v1
npm run db:contract-spine:verify
require_authenticated_clean_main_setfarm_root_v1
npm run db:contract-spine:audit-current-authority-ledgers
require_authenticated_clean_main_setfarm_root_v1
npm run db:contract-spine:audit-artifact-batches
require_authenticated_clean_main_setfarm_root_v1
npm run db:contract-spine:audit-artifact-store-authority-ledger
require_authenticated_clean_main_setfarm_root_v1
npm run db:contract-spine:audit-platform-release-store-records
```

Expected: Task 8 performs no migration or other schema mutation. The zero-input command follows only the fixed one-migration terminal locator, freshly reopens Task 6A's strict applied receipt, repeats its digest/schema/apply/verify relations, and returns the exact pair already bound by the `live-rebind` sequence and three restart authorities. The schema and every applicable authority audit pass. Missing/corrupt/drifted authority fails closed; no guard is minted and no rollback or second migration transaction occurs.

- [ ] **Step 2: Create and inspect a custom-format PostgreSQL backup**

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
require_authenticated_clean_main_setfarm_root_v1
npm run --silent acceptance:baseline-post-handoff -- backup --json | jq -e \
  --arg hash "$A_BACKUP_RECEIPT_HASH" \
  '.receiptHash == $hash' >/dev/null
```

Expected: the code-owned command creates or resumes one journaled attempt, `pg_restore --list` has authenticated the custom archive, all three fixed targets are exact regular mode-`0600` link-count-one files, and a fresh invocation returns the byte-identical receipt. A crash in any hard-link window adopts only the authenticated contiguous prefix and completes; a gap, journal drift, missing durable attempt, or mismatched/racing target fails closed without overwrite. Do not add the targets, attempt journal, manifest, or receipt to Git.

- [ ] **Step 3: Capture exact bounded evidence for the packet**

Capture these commands without exposing environment values:

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
git -C "$SETFARM_ROOT" rev-parse HEAD
git -C /Users/setrox/ai/setrox/mission-control rev-parse HEAD
jq -r '.name + " " + .version' "$SETFARM_ROOT/package.json"
jq -r '.name + " " + .version' /Users/setrox/ai/setrox/mission-control/package.json
jq -r '.sha, .branch, .dirty' "$SETFARM_ROOT/dist/BUILD_INFO.json"
A_PACKET_SETFARM_SHA="$(git -C "$SETFARM_ROOT" rev-parse HEAD)"
jq -e --arg sha "$A_PACKET_SETFARM_SHA" \
  '.sha == $sha and .branch == "main" and .dirty == false' \
  "$SETFARM_ROOT/dist/BUILD_INFO.json"
shasum -a 256 "$SETFARM_ROOT/dist/spawner.js"
shasum -a 256 "$SETFARM_ROOT/dist/server/daemon.js"
shasum -a 256 /Users/setrox/ai/setrox/mission-control/dist-server/index.js
A_PACKET_SERVICE_CENSUS_JSON="$(
  require_authenticated_clean_main_setfarm_root_v1
  npm run --silent acceptance:baseline-post-handoff -- service-census --json
)"
printf '%s\n' "$A_PACKET_SERVICE_CENSUS_JSON" | jq -e '
  .schema == "setfarm.internal-production-service-census.v1" and
  .spawner.processOwnerCount == 1 and
  .dashboard.processOwnerCount == 1 and .dashboard.listenerOwnerCount == 1 and
  .missionControl.processOwnerCount == 1 and .missionControl.listenerOwnerCount == 1 and
  .openClaw.processOwnerCount == 1 and .openClaw.listenerOwnerCount == 1 and
  (.censusHash | test("^[0-9a-f]{64}$"))
' >/dev/null
A_PACKET_SPAWNER_PID="$(printf '%s\n' "$A_PACKET_SERVICE_CENSUS_JSON" | jq -er '.spawner.pid')"
ps -p "$A_PACKET_SPAWNER_PID" -o pid=,command=
A_PACKET_DASHBOARD_PID="$(printf '%s\n' "$A_PACKET_SERVICE_CENSUS_JSON" | jq -er '.dashboard.pid')"
ps -p "$A_PACKET_DASHBOARD_PID" -o pid=,command=
A_PACKET_MC_PID="$(printf '%s\n' "$A_PACKET_SERVICE_CENSUS_JSON" | jq -er '.missionControl.pid')"
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
: "${SETFARM_ROOT:?authenticated clean-main Setfarm root is required}"
readonly A_SETFARM_ROOT="$SETFARM_ROOT"
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
: "${SETFARM_ROOT:?authenticated clean-main Setfarm root is required}"
readonly A_SETFARM_ROOT="$SETFARM_ROOT"
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

The A source change delivered before this documentation handoff must contain exactly the 64 paths in `TASK_0_EXACT_SOURCE_PATHS_V1`, including the owner-admission core/test, exact literal source-manifest test, target-guard mint/bind call site, guarded migration-32 registry/source-integrity/generated digest/private test helper, `src/db-pg.ts`, the isolated PostgreSQL runner, every audited direct migration apply/verify caller test, adjacent runtime-completion and Mission Control filter tests, all restart/receipt/PBA/active-status modules and focused tests, generated active-status pair, and package wiring. The source inventory/tree/hash gate compares the literal tuple path-for-path and rejects an omission, extra path, duplicate, reorder, Markdown-derived expected set, or count-only assertion. The post-handoff writer accepts no sequence or migration field/pair from the shell: it takes the retained `documentation-rollback` final pair from the code-owned coordinator, freshly resolves `InternalProductionBaselineRestartSequenceReceiptV1` and the already applied `InternalProductionBaselineBootstrapHandoffMigrationReceiptV1`, requires their source/build/final-census/schema identities to equal the current record inputs, and copies their exact pairs plus all three ordered restart composite pairs. A missing, in-progress, blocked, live-rebind, structurally cloned, swapped, or drifted sequence or migration prevents `record`; the final baseline receipt hash covers every copied pair, including the migration receipt's exact v31 predecessor and pending-successor causal pairs. Define the strict receipt as:

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
readonly A_SETFARM_ROOT="$SETFARM_ROOT"
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
require_authenticated_clean_main_setfarm_root_v1
npm run db:contract-spine:audit-current-authority-ledgers
require_authenticated_clean_main_setfarm_root_v1
npm run acceptance:baseline-post-handoff -- zero-owner --json
require_authenticated_clean_main_setfarm_root_v1
npm ci
require_authenticated_clean_main_setfarm_root_v1
npm test
require_authenticated_clean_main_setfarm_root_v1
npm run build
A_ROLLBACK_BUILD_INFO_SHA="$(jq -er '.sha' dist/BUILD_INFO.json)"
A_ROLLBACK_BUILD_HEAD="$(git rev-parse HEAD)"
test "$A_ROLLBACK_BUILD_INFO_SHA" = "$A_ROLLBACK_BUILD_HEAD"
require_authenticated_clean_main_setfarm_root_v1
npm run db:contract-spine:audit-current-authority-ledgers
require_authenticated_clean_main_setfarm_root_v1
npm run acceptance:baseline-post-handoff -- zero-owner --json >/dev/null
A_ROLLBACK_RESTART_SEQUENCE="$(
  require_authenticated_clean_main_setfarm_root_v1
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
  require_authenticated_clean_main_setfarm_root_v1
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
require_authenticated_clean_main_setfarm_root_v1
npm run db:contract-spine:audit-current-authority-ledgers
require_authenticated_clean_main_setfarm_root_v1
npm run acceptance:baseline-post-handoff -- zero-owner --json
curl -fsS --retry 20 --retry-delay 1 http://127.0.0.1:3080/api/health | jq -e '.status == "healthy"'
curl -fsS --retry 20 --retry-delay 1 http://127.0.0.1:3333/ >/dev/null
A_ROLLBACK_FINAL_BUILD_INFO_SHA="$(jq -er '.sha' dist/BUILD_INFO.json)"
A_ROLLBACK_FINAL_HEAD="$(git rev-parse HEAD)"
test "$A_ROLLBACK_FINAL_BUILD_INFO_SHA" = "$A_ROLLBACK_FINAL_HEAD"
A_ROLLBACK_FINAL_STATUS="$(git status --porcelain=v1 --untracked-files=all)"
test -z "$A_ROLLBACK_FINAL_STATUS"
require_authenticated_clean_main_setfarm_root_v1
npm run acceptance:baseline-post-handoff -- record --json
require_authenticated_clean_main_setfarm_root_v1
npm run acceptance:baseline-post-handoff -- verify-current --json
```

The receipt is never tracked. Subprojects B/E call only `resolve-historical --json`, rehash the strict result, require ancestor continuity to the final operational pair, and carry only its canonical ref/hash and recorded historical identities in closure evidence. Final operational source/build/service authority is proven separately by the B/E epoch observers and must not be confused with A's historical pair. A stale Setfarm or Mission Control build at A time, nonzero owner, dirty tree, service-entrypoint drift, a docs SHA unequal to `origin/main`, broken history, or an unavailable private receipt fails.

## Final Acceptance Gate

Subproject A passes only when all of the following are simultaneously true:

- Product Build Authority V2 reviewed PR #19 merge `240e779d78804843a1202cbf0440fe423b806b1a` remains an ancestor of current clean synchronized Mission Control `main`; all reconciliation-branch stages prove production observer/resolver/CLI/endpoint-owner refusal and no publication, then Task 6 Step 8's clean post-merge main/build creates and reopens one strict current `ProductBuildAuthorityV2DeliveryEvidencePairV1` over its exact delivered paths/tests/twelve-entry vendor lock without inventing a global per-run authority pair. Task 6A consumes only that post-merge pair.
- The pre-full-rebind `InternalProductionCurrentEntryAuthorityPairV1` resolves as Task 7's immutable predecessor, independently binds the Task 0 controller/rebound spawner and delivered dashboard/Mission-Control runtime authorities, stores the exact Task 6A applied migration receipt and successor-current audit while reopening that receipt's v31/pending causal quartet, and preserves its canary fence/target/settlement/close/release chain; it is not required to remain current after rebind.
- The ready `InternalProductionPostRebindEntryAuthorityPairV1` freshly verifies the exact successor migration applied/current, binds the predecessor runtime authority, requires every scoped loaded Setfarm service to equal Task 7 controller source/build and Mission Control to equal its Task 7 source/build, requires the loaded HTTP delivery-evidence pair to equal the predecessor source-observed pair, and binds the restart/schema/complete-zero-owner chain. Task 8 and B/C/D/E use only this successor.
- Focused Authority-V3 tests prove all three mutually exclusive setup-packet failure codes, while the separately bound fresh canary proves exactly one observed code lifecycle with one claim, one termination, and zero redispatch.
- Setfarm and Mission Control contract artifacts are byte-compatible and pinned to the accepted Setfarm producer SHA.
- DB active run count, `/api/runs`, and `/api/projects[].execution.active` agree exactly.
- Every active project has one non-empty `execution.runId`, and active project-to-run bindings are one-to-one with no duplicate run ID.
- Historical failed/cancelled/completed projects remain discoverable.
- No raw registry or V3 receipt `active` value is presented as active Setfarm execution.
- Active Run shows an empty state when no run is in the canonical `running|resuming|cancelling|failing` operational-active set.
- Mission Control full tests, build, and render smoke pass.
- Setfarm full tests and guarded clean-main build pass.
- Final loaded Setfarm `BUILD_INFO.sha` equals the post-packet documentation merge at clean `origin/main`; the private post-handoff receipt binds the earlier operational SHA without circular tracked evidence.
- The v31 historical/current-authority audit, sole pre-apply pending-successor projection, Task 6A applied receipt, and successor-current audit all resolve with their phase-exact applied/pending relations and no drift; Task 7 performs no migration mutation.
- The custom-format PostgreSQL backup has one authenticated completed attempt/journal receipt; all three fixed files exist with recorded hashes, the checksum matches, and the archive is listable by matching PostgreSQL tooling.
- Exactly one intended Mission Control listener, Setfarm dashboard listener, OpenClaw listener owner, and Setfarm spawner process exists.
- Both repositories are clean and equal to `origin/main`.
- The baseline packet contains no secret, dump, runtime payload, log, or screenshot.
- Production admission remains honestly blocked for the deferred external-distribution authorities.
