# Internal Production Baseline and Mission Control Handoff Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reopen the already delivered Mission Control Product Build Authority V2 and operational-snapshot-v3 receipts, remove any remaining false active-project presentation, and establish the Authority-V3/migration-31-verified clean-main baseline for Setfarm and Mission Control before the first golden run.

**Architecture:** Mission Control continues to proxy and render Setfarm-owned authority without inventing a second authority model. A new read-only project execution projection separates catalog lifecycle, workflow execution, runtime health, and immutable V3 deployment-receipt state; it resolves only explicit run identifiers or exact run numbers from PostgreSQL. After the Mission Control changes merge, both repositories are rebuilt from clean `main`, the live services are restarted only with a zero-owner census, and a bounded baseline packet records exact code, contract, database, process, port, backup, and HTTP evidence.

**Tech Stack:** TypeScript ESM, Node.js 22+, React 19, Express 5, PostgreSQL, `node:test`, Playwright, GitHub CLI, macOS LaunchAgents.

**Spec:** `docs/superpowers/specs/2026-08-13-setfarm-mission-control-internal-production-closure-design.md`

## 2026-08-16 Execution Rebaseline

Product Build Authority V2 behavior and `setfarm.run-operational-snapshot.v3` are already delivered acceptance inputs. Repository truth exposes only per-run Product Build Authority `authorityHash`; it does not contain a global PBA V2 receipt pair. Task 0 first delivers Setfarm's local strict `ProductBuildAuthorityV2DeliveryEvidenceResponseV1` wire parser/schema and canonical fixtures without importing Mission Control source. Task 1 then implements the exact read-only Mission Control `ProductBuildAuthorityV2DeliveryEvidenceV1` producer/endpoint against that response contract without changing the delivered PBA parser/server/UI behavior. The reconciliation feature branch may exercise injected fixtures and compute expected deterministic hashes only as non-authoritative test data: its production observer, pair resolver, CLI, and endpoint owner fail closed before pair publication because the branch is not clean synchronized `main`. Task 6 Step 8 is the first point that creates and reopens the authoritative current pair, after the reviewed merge and a clean synchronized Mission Control main/build. The observations and branch identities in “Starting Evidence” are historical. Current execution starts only from an execution-time exact clean synchronized Setfarm `main` descendant that retains reviewed Authority-V3 PR #86 merge `1d691c89760339ea905dfe17f8e9188e62603c1c` as an ancestor, with migrations 1 through 31 independently verified applied/current, guarded migration 32 as the sole actionable Task 6A successor, source-known automatic migration 33 blocked behind it, and one fresh clean canary proving its one terminal-preclaim lifecycle. Run 2075 remains polluted historical evidence and is not resumed. The local delivery-evidence response contract is not a generated or vendored Setfarm contract artifact: the ten-artifact vendored set that exists before the operational-active pair expands to twelve when that pair is added, and the later run-operational-model-v2 pair expands it to fourteen.

OA18 additionally requires a distinct loaded-generation proof from the Mission Control process that owns port 3080. Task 1's same owner module captures one immutable loaded-build snapshot during compiled server-module evaluation before `server.listen()` and the same route exposes it at fixed operationally authenticated `GET /api/internal-production/product-build-authority-v2-loaded-build`; existing `server/index.ts` supplies endpoint-specific operational authentication, the authenticated-canonical-only general-auth bypass, and authentication-before-parser-wrapper-before-router ordering, while the route's exact raw guard refuses every noncanonical target before snapshot access. This endpoint is not a delivery-evidence pair, current-source observer, mutable current pointer, or substitute source CLI. The existing non-listening CLI remains current-filesystem/current-source authority only and is never used to identify bytes already loaded by a PID. Setfarm accepts Mission Control as loaded generation only through the startup snapshot bracketed by stable launchd, process, and listener observations frozen in OA18 below.

Task 6A first performs the one disjoint pre-schema spawner rebind into `pre-manifest-bootstrap-sealed`, applies guarded migration 32 through its sealed-status-bound pre-manifest authorization, publishes/reopens its applied receipt/current audit, separately applies or exact-adopts and fully verifies ordinary migration 33, activates A, completes generic full verification and normal initialization, transitions that same spawner generation once to normal Task 0 admission without another restart, and seals those pre-full-rebind facts as the strict `InternalProductionCurrentEntryAuthorityPairV1`. Task 7 consumes that predecessor and, after read-only schema validation plus its authorized rebuild/restart/rebind, seals the strict `InternalProductionPostRebindEntryAuthorityPairV1`. Task 8 and every B/C/D/E descendant consume only the post-rebind successor as current authority; no descendant requires the predecessor to remain current or reconstructs either pair from prose, a SHA alone, or the historical run.

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
- Every remaining code task follows test-first development. Task 1 preserves the delivered `240e779d78804843a1202cbf0440fe423b806b1a` Product Build Authority V2 behavior byte-for-byte while adding two distinct read-only surfaces on the fresh reconciliation branch: the current-source delivery-evidence producer/endpoint/tests/non-listening CLI, and the startup-frozen loaded-build producer/endpoint/tests with its `server/index.ts` raw-target/endpoint-operational-auth/parser-order root fix. Branch delivery-evidence tests use injected contract fixtures and non-authoritative expected hashes; no production current delivery-evidence pair is published, resolved, or handed off before Task 6 Step 8.
- Stop and report if the same canonical systemic failure repeats three times after attempted fixes.
- Execute the source/contract dependency in this exact order: Task 0 source-only delivery of the local Setfarm response parser/schema and operational-active producer artifacts; Task 1 branch creation and Mission Control current-source delivery-evidence plus startup-frozen loaded-build implementations, including the raw-target/endpoint-operational-auth/parser-order root fix, against canonical fixtures; Task 5 Steps 1–3 to vendor the operational-active producer artifacts; Tasks 2–4; Task 5 Steps 4–6 to cross and checkpoint the semantic consumer with fixture-only delivery-evidence expectations; Task 6 reviewed Mission Control delivery; Task 6 Step 8 authoritative clean-main pair creation/reopen; Task 6A pre-rebind entry; then Task 7. No Mission Control module is imported to make Task 0 constructible, no reconciliation-branch stage publishes or consumes a production current pair, and the canary does not run before Task 6 Step 8 has returned the exact clean-main pair.
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
- Create `mission-control/server/services/product-build-authority-v2-delivery-evidence-v1.ts` — sole read-only owner of the strict delivery-evidence projection, deterministic pair, clean-main-only current-source observer, focused-test receipt, and pair-only resolver; it also validates the terminal build identity and complete output content, hashes the exact identity and executing compiled owner-module bytes, creates one fresh startup instance, and freezes the exact loaded-build response during compiled module evaluation before `server.listen()`. Its current-source observer/resolver publishes nothing off clean synchronized `main` with a matching build SHA, while the loaded response performs no request-time observation or mutation.
- Create `mission-control/server/services/product-build-authority-v2-delivery-evidence-v1.test.ts` — merge/path/blob/lock/test/source/status/pair tamper and missing-evidence tests, canonical delivery fixture/hash tests, feature-branch fail-closed/no-publication tests, and the loaded-build module-evaluation A/fresh-B, exact response/hash/ref, frozen PID/instance, startup-unavailable, and no-request-time-Git/test/CLI/filesystem/listen/write matrix.
- Modify `mission-control/server/routes/setfarm-operational.ts` — preserve fixed `GET /api/internal-production/product-build-authority-v2-delivery-evidence` and add only fixed operationally authenticated `GET /api/internal-production/product-build-authority-v2-loaded-build`; both retain current no-cache headers. The loaded route's raw method/path guard calls `next()` for HEAD and every noncanonical alias before snapshot access, rejects query/body/body-framing input, and otherwise serializes only its frozen startup result.
- Modify `mission-control/server/routes/setfarm-operational.test.ts` — preserve the exact delivery-evidence endpoint contract and add loaded-build endpoint-operational-auth/general-auth-bypass/parser-wrapper/router order, exact operational-auth status/body and digest-comparison cases, low-level canonical/alias raw-target equality, authenticated alias and operationally authenticated HEAD 404, unauthenticated canonical malformed/framed exact loaded 401, authenticated canonical malformed/framed finite 400, literal request header `Content-Length: 0`, exact success/unavailable body, query/body/framing refusal, no-cache, zero-snapshot-access, unrelated general-auth parity, and frozen-response regressions.
- Modify `mission-control/server/index.ts` — before the existing general `/api` authentication mount, add the exact raw-canonical-path `x-setfarm-operational-token` authenticator using existing `config.setfarmOperationalWriteToken`; bypass general `AUTH_TOKEN` authentication only for its private authenticated marker, and keep the single global parser wrapper after both authentication layers and before the loaded router while bypassing JSON decoding only for exact loaded `req.path`. Existing public-health, unrelated-route, general-authentication, parser, and generic-error behavior remains unchanged.
- Modify `mission-control/package.json` — add the zero-input non-listening `internal:product-build-authority-v2-delivery-evidence` source-observer CLI; it first returns an authoritative pair only from Task 6 Step 8's clean synchronized post-merge main/build and is reused before Task 7 loads the endpoint in the Mission Control service. This CLI remains current-source authority only and is never loaded-PID generation authority.

The cross-repository File Map remains exact. The loaded-build correction changes only five Mission Control paths: `server/services/product-build-authority-v2-delivery-evidence-v1.ts`, `server/services/product-build-authority-v2-delivery-evidence-v1.test.ts`, `server/routes/setfarm-operational.ts`, `server/routes/setfarm-operational.test.ts`, and existing `server/index.ts`. The fifth path owns only endpoint-specific operational authentication, its private canonical general-auth bypass, and authentication/parser-wrapper/router ordering; the route retains raw-target and request-validity refusal. The correction does not alter delivered per-run Product Build Authority V2 behavior or any unrelated route's existing general authentication/parser/error behavior. Setfarm changes only OA18's already listed retention implementation/test during the later implementation slice. No path is added to `TASK_0_EXACT_SOURCE_PATHS_V1`; its literal unique sorted cardinality remains 109, with OA18 still contributing only `scripts/build-generation-retention.mjs` and `scripts/__tests__/build-generation-retention.test.js`.

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
- Create `mission-control/server/shared/setfarm-operational-active-run-status-v1.ts` — import the vendored schema enum once and expose its exact typed predicate to server and browser consumers from inside the existing server TypeScript compilation root. Browser consumers import this same browser-safe module through Vite; there is no second tuple or predicate.
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
  - `setfarm/tests/internal-production/owner-admission-v1.test.ts` — exact 35-category/35-map-key/36-scalar coverage, repository reservation/close pair resolution, same-transaction sidecar idempotency, fixed production composition/no caller registry-factory, test-private fake, fence, import-direction/import-inertness, unchanged public generic activation ABI/error shape, and private-sentinel non-observability tests.
  - `setfarm/src/internal-production/baseline-post-handoff-receipt-v1.ts` — also owns the strict content-addressed baseline service-restart authority/store/resolver used by B P0, the disjoint one-use pre-manifest migration-32 authorization/legacy-census observer, the one named-field service-census ABI, the pre-mutation loaded-runtime authority/store/resolver, the exact twelve-state current-entry status with its four nested crash-phase unions, the sole strict current-entry verification response/store/resolver, and the import-safe zero-input read-only observer of the one prepared fixed current-entry operation.
  - `setfarm/src/internal-production/product-build-authority-v2-delivery-evidence-v1.ts` — sole local owner of the strict response constants/schema/parser and canonical field/null relations plus fixed code-owned source/HTTP observer and pair-only resolver; accepts no root, URL, ref, hash, body, transport override, or import from sibling Mission Control source.
  - `setfarm/tests/internal-production/product-build-authority-v2-delivery-evidence-v1.test.ts` — canonical positive/negative response fixtures, exact canonical bytes/hash/fields, source-boundary no-sibling-import checks, delivery-evidence source/HTTP pair equality only, pre-rebind source CLI, post-rebind delivery endpoint, loaded-endpoint non-substitutability, and tamper/status tests.
  - `setfarm/src/internal-production/baseline-owner-producer-manifest-activation-controller-v1.ts` — A-only, import-inert, path-free zero-input controller that dynamically loads production ports, adopts committed PostgreSQL current before any fresh current-entry/PBA/Setfarm/Git observation, invokes only the exact controller-specific PostgreSQL A-activation port from the seeded-null state, and derives its wrapper receipt/status solely from committed activation/head/current rows.
  - `setfarm/src/internal-production/baseline-post-handoff-cli.ts`
  - `setfarm/src/internal-production/baseline-service-restart-helper-v1.ts` — private fixed no-shell helper entry for disjoint pre-schema-spawner and normal post-activation actions; no public argv surface.
  - `setfarm/src/internal-production/baseline-spawner-startup-admission-v1.ts` — A-operation-bound new-spawner startup capability/locator/claim plus the fixed pre-schema authorization, startup token, disjoint restart authority, predecessor-termination observation, replacement-process observation, sealed admission, same-generation admission-ready record, strict phase stores, and pair-only resolvers.
  - `setfarm/src/internal-production/baseline-service-restart-sequence-v1.ts` — fixed `live-rebind|d-startup-hook-load|documentation-rollback` coordinator, journal, and resolver.
  - `setfarm/src/internal-production/baseline-restart-authority-retirement-v1.ts` — the one-way A-to-D physical-service restart-authority epoch, A-owned strict hook-readiness/activation/cutover contracts and stores, code-owned hook observer/recorder, global transition lock, durable retirement/cutover receipts, and pair-only resolvers.
  - the exact repository transaction call sites in `TASK_0_EXACT_SOURCE_PATHS_V1` — implement the sixteen A-owned rows of `INTERNAL_PRODUCTION_OWNER_PRODUCER_ROWS_A_V1`; each resolves admission, begins or adopts its fixed reservation before the first matching owner INSERT/birth, binds the sidecar in that transaction, and closes only after its authenticated terminal transition. The ordinary `run` row is born only inside `persistWorkflowRunInTransaction(sql,input)`; the public `persistWorkflowRun(input)` wrapper owns and awaits `pgBegin`, keeps the callback result private, and cannot resolve or expose it until commit acknowledgement. `spawner.ts` consumes only that post-commit authenticated run-owner pair and cannot reserve it later; it additionally accepts only the operation-bound pre-schema startup token, exposes no owner/listener/normal loop while sealed, and enables producers only after same-generation admission-ready.
  - `setfarm/src/installer/run.ts`, `setfarm/tests/execution-attempts/run-protocol.test.ts`, `setfarm/tests/execution-attempts/v3-release-admission.test.ts`, and `setfarm/tests/evals/convergence-eval.test.ts` — the installer calls only the public `persistWorkflowRun(input)` wrapper; all direct fixtures prove its same-transaction run-owner result, commit-visible boundary, and pre-manifest admission fence.
  - `setfarm/src/execution/runtime-completion.ts` — mint the opaque completion-owner bootstrap target guard only inside the authenticated current-owner context.
  - `setfarm/src/db/bootstrap-main-claim-handoff-v1-migration.ts` — sole immutable implementation, ordered statements, named migration identity, and schema projector for the bootstrap-main-claim handoff migration.
  - `setfarm/src/db/contract-spine-migrations.ts`, `setfarm/src/db/contract-spine-migration-source-integrity.ts`, and `setfarm/src/db/contract-spine-migration-digests.generated.ts` — guarded registration of exact ordinal 32, its source-integrity manifest, and generated named digest entry before B Task P0; unrelated later entries may be appended without changing A's authority.
  - `setfarm/src/db-pg.ts` — sole production composition for the injected owner repository/controller and fixed non-exported category resolver table; also owns the exact controller-only A-activation port, shared non-exported generic activation core, and module-private candidate-drift sentinel without widening the public generic activator; its operation-bound sealed startup branch permits only a minimal read-only v31/pending-32 connection and cannot report normal DB ready, while ordinary startup still fails generic full verify until 32 is applied.
  - `setfarm/scripts/run-isolated-postgres-tests.ts` — projects current bytes, has its authenticated setup child invoke only the fixed test-private guarded-migration-32 then ordinary-migration-33/A authority on a private template before full verification, clones a verified primary, and then runs the exact one-file test child.
  - `setfarm/tests/internal-production/baseline-post-handoff-receipt-v1.test.ts` — includes the exact named-field service census, pre-mutation runtime authority, sole status/verification wire shapes, twelve-state/nested-phase strict-nullability, store, pair-resolution, crash-prefix, clone, count/source/listener drift, flattened-field rejection, OpenClaw-null-source tests, and the prepared-operation observer's exact absence, strict physical-family, drift, historical-resolution, and zero-mutation matrix.
  - `setfarm/tests/internal-production/baseline-owner-producer-manifest-activation-controller-v1.test.ts` — A controller source/PBA/vendor cross-binding, exact controller-only port input/caller boundary, private-sentinel drift mapping and generic-error opacity, PostgreSQL receipt/status, concurrency, interruption, response-loss replay, CLI, dynamic-port import-inertness, committed-current-first adoption, committed-row-only status, exhaustive collision mapping, and no-producer-before-activation tests.
  - `setfarm/tests/internal-production/baseline-post-handoff-cli.test.ts`
  - `setfarm/tests/internal-production/baseline-service-restart-helper-v1.test.ts`
  - `setfarm/tests/internal-production/baseline-spawner-startup-admission-v1.test.ts` — also proves operation-bound authorization prepare/execute equality, strict token/restart/termination/replacement/sealed/ready stores and pair resolvers, exact rebind/migration status unions, total owner-producer refusal while sealed, crash/replay, and the no-restart transition to normal admission.
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

**Files:** exactly the 109 repository-relative paths in `TASK_0_EXACT_SOURCE_PATHS_V1` below. This is the complete Task 0 source/test/generated/package surface, including every repository transaction that performs an A owner INSERT/birth or terminal UPDATE, every audited direct SQL/bypass path, the ordinary-run persistence caller and all direct affected tests, one-way owner-admission core/test and PostgreSQL wiring, restart-authority retirement module/test, guarded bootstrap-handoff migration module/registry/source-integrity/generated digest/tests/private isolated-test lifecycle, every direct apply/verify caller test, adjacent runtime-completion and dashboard-filter tests, strict local Product Build Authority V2 response parser/fixtures, the build-output-tree writer and historical Git-object primitives plus their direct-caller regressions, the OA18 operator-only build-generation retention tool, its startup-frozen Mission Control loaded-build consumer, and its test, operational-active producer/artifacts, and the literal source-manifest test. No production module parses this Markdown. `tests/internal-production/task-0-source-manifest.test.ts` owns a byte-for-byte literal copy of this tuple and exercises a private exact-set validator with the tuple, then with one omission, one extra path, one duplicate, and one reorder; a count-only assertion is forbidden. The loaded-generation correction adds no Setfarm path and does not alter any member, order, or byte of the tuple.

```typescript
export const TASK_0_EXACT_SOURCE_PATHS_V1 = [
  "contracts/generated/mission-control/operational-active-run-status.v1.compatibility.json",
  "contracts/generated/mission-control/operational-active-run-status.v1.schema.json",
  "package.json",
  "scripts/__tests__/build-generation-retention.test.js",
  "scripts/__tests__/build-info-version.test.js",
  "scripts/build-generation-retention.mjs",
  "scripts/run-isolated-postgres-tests.ts",
  "scripts/write-build-info.mjs",
  "src/contracts/mission-control-contract-artifacts.ts",
  "src/contracts/operational-active-run-status-v1-cli.ts",
  "src/contracts/operational-active-run-status-v1.ts",
  "src/db-pg.ts",
  "src/db/bootstrap-main-claim-handoff-v1-migration.ts",
  "src/db/contract-spine-migration-digests.generated.ts",
  "src/db/contract-spine-migration-source-integrity.ts",
  "src/db/contract-spine-migrations.ts",
  "src/execution/attempt-reconciler.ts",
  "src/execution/attempt-repository.ts",
  "src/execution/claim-attempt-transition.ts",
  "src/execution/claim-runtime-publication.ts",
  "src/execution/operational-event-delivery-repository.ts",
  "src/execution/operational-outbox-repository.ts",
  "src/execution/pre-dispatch-withdrawal-authority.ts",
  "src/execution/run-persistence.ts",
  "src/execution/run-terminal-transition.ts",
  "src/execution/run-termination.ts",
  "src/execution/runtime-completion-effect-repository.ts",
  "src/execution/runtime-completion-effect-runner.ts",
  "src/execution/runtime-completion.ts",
  "src/execution/runtime-session-repository.ts",
  "src/execution/v3-git-revision.ts",
  "src/installer/cleanup-ops.ts",
  "src/installer/run.ts",
  "src/installer/step-fail.ts",
  "src/installer/step-ops.ts",
  "src/internal-production/baseline-owner-producer-manifest-activation-controller-v1.ts",
  "src/internal-production/baseline-post-handoff-cli.ts",
  "src/internal-production/baseline-post-handoff-receipt-v1.ts",
  "src/internal-production/baseline-restart-authority-retirement-v1.ts",
  "src/internal-production/baseline-service-restart-helper-v1.ts",
  "src/internal-production/baseline-service-restart-sequence-v1.ts",
  "src/internal-production/baseline-spawner-startup-admission-v1.ts",
  "src/internal-production/owner-admission-v1.ts",
  "src/internal-production/product-build-authority-v2-delivery-evidence-v1.ts",
  "src/medic/checks.ts",
  "src/medic/medic.ts",
  "src/recovery/finding-recovery-repository.ts",
  "src/recovery/v3-downstream-evidence-publication.ts",
  "src/recovery/v3-evidence-only-publication.ts",
  "src/recovery/v3-evidence-only-worker.ts",
  "src/recovery/v3-recovery-lifecycle-reconciler.ts",
  "src/server/dashboard.ts",
  "src/server/index.html",
  "src/spawner.ts",
  "tests/claim-log-lifecycle.test.ts",
  "tests/cleanup-ops.test.ts",
  "tests/evals/convergence-eval.test.ts",
  "tests/execution-attempts/activation-preflight.test.ts",
  "tests/execution-attempts/artifact-publication-batch-migration.test.ts",
  "tests/execution-attempts/artifact-publication-batch-plan-migration.test.ts",
  "tests/execution-attempts/artifact-store-authority-migration.test.ts",
  "tests/execution-attempts/attempt-reconciler.test.ts",
  "tests/execution-attempts/claim-attempt-transition.test.ts",
  "tests/execution-attempts/claim-runtime-publication.test.ts",
  "tests/execution-attempts/migration-source-digests.test.ts",
  "tests/execution-attempts/migrations.test.ts",
  "tests/execution-attempts/operational-event-delivery.test.ts",
  "tests/execution-attempts/operational-event-migration.test.ts",
  "tests/execution-attempts/operational-failure-cause-migration.test.ts",
  "tests/execution-attempts/operational-outbox-repository.test.ts",
  "tests/execution-attempts/platform-release-store-record-ledger-v3-contract-integration.test.ts",
  "tests/execution-attempts/preparation-authority-v2-migration.test.ts",
  "tests/execution-attempts/product-compilation-attempt-migration.test.ts",
  "tests/execution-attempts/run-protocol.test.ts",
  "tests/execution-attempts/run-terminal-transition.test.ts",
  "tests/execution-attempts/run-termination.test.ts",
  "tests/execution-attempts/runtime-completion-effect-runner.test.ts",
  "tests/execution-attempts/runtime-completion-manifest-authority-migration.test.ts",
  "tests/execution-attempts/runtime-completion.test.ts",
  "tests/execution-attempts/runtime-hooks.test.ts",
  "tests/execution-attempts/runtime-session-repository.test.ts",
  "tests/execution-attempts/test-database.ts",
  "tests/execution-attempts/v3-downstream-evidence-publication.test.ts",
  "tests/execution-attempts/v3-git-revision.test.ts",
  "tests/execution-attempts/v3-implementation-attempt-v2.test.ts",
  "tests/execution-attempts/v3-normal-implementation-preclaim.test.ts",
  "tests/execution-attempts/v3-preparation-block-repository.test.ts",
  "tests/execution-attempts/v3-release-admission.test.ts",
  "tests/execution-attempts/v3-story-claim-runtime-binding-v1-migration.test.ts",
  "tests/findings/migration-recovery-compatibility.test.ts",
  "tests/findings/migration.test.ts",
  "tests/findings/repository.test.ts",
  "tests/findings/v3-evidence-only-worker.test.ts",
  "tests/findings/v3-recovery-lifecycle-reconciler.test.ts",
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

Task 0 also owns the Task 6A entry ABI: strict `InternalProductionCurrentEntryAuthorityV1`, `InternalProductionCurrentEntryAuthorityPairV1`, `InternalProductionCurrentEntryAuthorityStatusV1`, `InternalProductionCurrentEntryFreshRuntimeAndOwnerObservationV1`, `InternalProductionCurrentEntryVerificationV1`, their no-replace stores/pair-only resolvers/current verifier, the fixed `prepare-current-entry|resume-current-entry|current-entry-status|verify-current-entry --json` CLI, and strict read-only `InternalProductionServiceCensusV1` from `service-census --json`. `current-entry-status` has exactly one wire body: the twelve-state nested status union below, with no flattened lifecycle mirrors. `verify-current-entry` has exactly one wire body: the strict current verification receipt below, not a status or authority-body variant. Its fresh runtime/owner evidence is a separately stored and resolved pair, never an orphan observation hash. `prepare-current-entry` is zero-input and must durably publish/reopen the fixed operation after the read-only PBA/v31/pending/source-build prerequisites but before the first service or database mutation. `resume-current-entry` is the only production coordinator allowed to invoke the internal pre-schema restart and guarded-apply ports; every retry reopens the same operation head and resumes its exact prefix. It additionally owns strict read-only `InternalProductionAuthorityV3Migration31AuditV1` with pair `{authorityV3Migration31AuditRef,authorityV3Migration31AuditHash}` and `InternalProductionPendingBootstrapHandoffMigrationProjectionV1` with pair `{pendingBootstrapHandoffMigrationRef,pendingBootstrapHandoffMigrationHash}`. The zero-input current v31 wrapper proves migrations 1 through 31 are applied/current and binds OA17's current source/build, PR #86's real merge/tree/ancestry delivery facts, the full exact current-authority audit body/hash, and migration-31 semantic digest/source-manifest-entry hash; PR #86 supplied no separate authority receipt or historical build. The zero-input pending wrapper separately binds the exact sole guarded pending-successor inspector output and current-HEAD migration-implementation mode/blob to the same OA17 source, with no other pending or drifted entry. Both current wrappers fail after migration 32, while both fixed content-derived pairs remain historically resolvable without store scans or mutation.

Migration 32 is the sole `migrationClass:"guarded"` member of the ordered registry; ordinals 1–31 are `migrationClass:"automatic"`. The exact framework contract is:

- `planContractSpineMigrations(sql)` enumerates both classes in ordinal order, includes `migrationClass` on every row, and reports guarded 32 as `state:"pending"`/plan `status:"pending"` until its exact dedicated apply succeeds.
- `applyContractSpineMigrations(sql, options?)` applies or adopts only `automatic` entries. It never executes, adopts, journals, or verifies a missing guarded entry; its strict result adds `guardedPending:["contract-spine-bootstrap-main-claim-handoff-v1"]` before Task 6A's purpose-bound apply and `guardedPending:[]` afterward. There is no option, migration ID, callback, environment variable, or cast that makes generic apply consume a guarded entry.
- `verifyContractSpineMigrations(sql, options?)` continues to use the complete registered plan and fails with `MIGRATION_INCOMPLETE` naming guarded ordinal 32 while it is pending. It returns `status:"verified"` only after the exact dedicated apply has journaled and verified 32. Therefore generic `db:contract-spine:verify` is prohibited before Task 6A's purpose-bound apply, not weakened to ignore the successor.
- `auditAuthorityV3ContractSpineThroughMigration31V1(sql)` is the only targeted predecessor audit. It verifies exact applied/current ordinals 1–31 and their source/current-authority relations, deliberately makes no claim about a later registered-unapplied row, and produces the A v31 audit pair.
- `inspectPendingBootstrapMainClaimHandoffGuardedSuccessorV1(sql)` is the only guarded-successor inspector. It accepts no ID/version/digest/projection input and succeeds only for exactly one registry successor, ordinal `32`, name `contract-spine-bootstrap-main-claim-handoff-v1`, class `guarded`, absent journal row/absent schema, with no other pending, unexpected, partial, adoptable, or drifted entry.
- The registry exposes no generic guarded apply. Its sole production execution port is `applyBootstrapMainClaimHandoffGuardedMigration32V1(sql, evidence)`, where `evidence` is constructed only inside the already prepared Task 6A current-entry controller after it reopens the exact v31 audit, pending successor, clean build, terminal `pre-manifest-bootstrap-sealed` spawner admission, that admission's post-predecessor-termination complete legacy/pre-manifest zero-owner observation, one later fresh equality reobservation, and one-use `InternalProductionPreManifestMigration32AuthorizationV1`. It never asks for or accepts the normal manifest-backed complete-zero guard. The port fixes ordinal/name/class/statements and rejects a caller SQL body, ID, digest, projection, database selector, normal restart authorization, owner-manifest authority, or capability clone. It is an internal controller port with no production CLI/export for arbitrary callers; Task 7 has no apply port.

`CONTRACT_SPINE_SEMANTIC_MIGRATION_SOURCE_MANIFEST[32]` binds the dedicated module's exact implementation/ordered-statement/schema-projector regions and the registry's guarded-class/registration/dispatch regions. `CONTRACT_SPINE_SEMANTIC_MIGRATION_DIGESTS[32]` is produced only by `scripts/check-contract-spine-migration-digests.ts --write`; the generated map, source-integrity manifest, checksum, named `(32,migrationId,migrationDigest)` entry hash, pending projection, and later receipt must all agree. Tests mutate each region/dependency and prove only entry 32 changes; hand-editing the generated digest or omitting the source-integrity entry fails `check:migration-digests`.

The isolated lifecycle is exact. The P3 projected runner's authenticated setup child alone performs generic automatic apply through 31 → fixed guarded-migration-32 test capability and current verification → separate ordinary migration-33 apply and full verification → A activation/head → complete through-33 generic verification, normal initialization, and readiness publication on its empty template, then closes every connection; only a byte-verified clone of that quiescent template backs default `createIsolatedTestDatabase()` and `reset()`, so neither operation reapplies migration or activation. The existing test-only zero-argument `database.applyBootstrapMainClaimHandoffGuardedMigration32ForTestV1()` remains defined only in `tests/execution-attempts/test-database.ts`, fixes migration ID/ordinal/body/projector and deterministic test evidence, accepts no production connection, environment switch, caller ID/body/evidence, or generic capability, and is absent from `src`, `package.json`, and production exports. A separately created `{migrate:false}` fixture has zero Setfarm schema and remains pending until its test explicitly invokes the exact transition; `createIsolatedMigration31TestDatabase()` derives only v31 plus the pending successor from that path, and direct-caller tests prove generic verify fails beforehand and succeeds only after exact guarded 32, separate ordinary 33, A activation, and complete verification/initialization/readiness. Direct helper use outside the authenticated projected setup/test subprocesses fails before database mutation. All twenty direct test callers are in the literal File Map and adjacent command. The audited non-test callers are `src/db-pg.ts`, `src/evals/convergence-runner.ts`, `src/execution/activation-preflight.ts`, `scripts/contract-spine-migrate.ts`, and `scripts/product-artifact-index.ts`: none receives the test capability or a generic guarded mode, and each keeps the intended fail-closed behavior while 32 is pending or ordinary 33 is not current. Task 0 never applies 32 or 33 to the live/canonical database.

#### OA17: freeze clean Setfarm source/build and historical Git authority before current-entry

OA17 is the first independently implementable dependency slice after the OA16 schema foundation. Its base freeze expands the complete exact Task 0 File Map from 101 to 105 paths with `scripts/__tests__/build-info-version.test.js`, `scripts/write-build-info.mjs`, `src/execution/v3-git-revision.ts`, and `tests/execution-attempts/v3-git-revision.test.ts`; its direct-caller regression correction then expands 105 to 107 with `tests/execution-attempts/v3-implementation-attempt-v2.test.ts` and `tests/execution-attempts/v3-normal-implementation-preclaim.test.ts`. `src/internal-production/baseline-post-handoff-receipt-v1.ts` and its focused test remain existing tuple members. OA17 defines no current-entry operation body, head, publication, v31 audit wrapper, pending-successor wrapper, manifest activator/store, or A-only activation wrapper. Those remain explicit later dependencies; no OA17 success claim may say that `controllerBuildHash`, current-entry, or historical A source resolution was already available before this slice.

Before either prepare or finalize trusts a live build input, the writer pins exact `HEAD^{commit}` and `HEAD^{tree}` and enumerates `git ls-tree -r -z --full-tree HEAD` through the fixed Git policy below. `InternalProductionPinnedBuildInputSetV1` is exactly `{schema:"setfarm.internal-production-pinned-build-input-set.v1",sourceSha,sourceTreeHash,entries,buildInputSetHash}`; each ordered entry is exactly `{locator,gitMode,gitBlobHash}`, locators are canonical repository-relative POSIX paths in unsigned UTF-8 byte order, `gitMode` is exactly `"100644"|"100755"`, and `gitBlobHash` is the exact full blob object ID. The pinned input set is the complete tracked regular-blob tuple, not a trusted live glob: a tracked symlink/gitlink/special mode, missing/extra/duplicate/colliding tree entry, or nonblob object fails. `buildInputSetHash` is exactly `hashCanonicalJson({schema,sourceSha,sourceTreeHash,entries})` and excludes only itself.

All pinned-input, pre-rotation `dist`, retained-archive, fresh-`dist` expected-output/observed-output, and observer traversals share the exact finite constants `MAX_BUILD_TREE_DEPTH_V1=64`, `MAX_BUILD_INPUT_ENTRIES_V1=10_000`, `MAX_BUILD_OUTPUT_ENTRIES_V1=10_000`, `MAX_BUILD_LOCATOR_UTF8_OCTETS_V1=1_024`, `MAX_BUILD_FILE_BYTES_V1=33_554_432`, and `MAX_BUILD_TOTAL_BYTES_V1=536_870_912`; archive count additionally uses `MAX_BUILD_ARCHIVE_GENERATIONS_V1=8`. Depth counts each traversed generation root as zero. Each pre-rotation `dist` and each exact retained archive generation owns an independently reset output-entry and byte counter, so every generation is individually at most 10,000 dirents and 536,870,912 regular-file bytes rather than sharing an aggregate counter. Every encountered dirent increments its generation's output-entry counter before type or exclusion classification, including directories, authority files, recognized publication temporaries, symlinks, and specials; only regular-file sizes enter the byte counters, also before authority exclusion. Crossing a limit fails before trusting, normalizing, hashing, rotation, or publication. A wide-empty-directory fixture proves that the 10,000th dirent reaches ordinary semantic classification while the 10,001st fails the cap before classification; an in-cap unexpected empty directory is valid bounded storage during pre-rotation/archive validation but fails finalize/observer exact terminal topology.

The build-command/topology contract is code-owned, not inferred from successful output. `package.json` must contain byte-equal `prebuild`, `build`, `postbuild`, `check:migration-digests`, and `check:mission-control-contracts` script values equal to the current literals: prepare followed by the version/English/path/migration/mission-control checks; exact build prefix `umask 077 && ` followed by `tsc -p tsconfig.json`, the two fixed copies, direct prompt copy, recursive step-asset copy, sole CLI chmod, and version injection; then finalize. The build value has that prefix exactly once at byte zero, so its one shell-local mask covers every tsc/cp/mkdir/copy-step/chmod/inject command even when the parent invokes npm under umask `0o000`; no command may reset it. `tsconfig.json` must project exactly `{target:"ES2022",module:"NodeNext",moduleResolution:"NodeNext",outDir:"dist",rootDir:"src",strict:true,esModuleInterop:true,forceConsistentCasingInFileNames:true,skipLibCheck:true,types:["node"],include:["src/**/*.ts"]}` with no output-affecting extra. The fixed copy topology is exactly `src/server/index.html → dist/server/index.html` and `src/installer/compat-rules.json → dist/installer/compat-rules.json`; prompt topology is nonrecursive direct `src/installer/prompts/*.md`; step topology is real-directory recursive `.md` traversal from `src/installer/steps` preserving its relative POSIX locator below `dist/installer/steps`. The writer compares these exact package/config/topology projections before deriving expected locators and fails until this contract and its tests are deliberately updated if any prefix, command, option, glob, or traversal changes.

```json
{
  "prebuild": "node scripts/write-build-info.mjs --prepare && node scripts/check-version-contract.mjs && node scripts/check-english-contract.mjs && node scripts/check-path-contract.mjs && npm run check:migration-digests && npm run check:mission-control-contracts",
  "build": "umask 077 && tsc -p tsconfig.json && cp src/server/index.html dist/server/index.html && cp src/installer/compat-rules.json dist/installer/compat-rules.json && mkdir -p dist/installer/prompts && cp src/installer/prompts/*.md dist/installer/prompts/ && node scripts/copy-step-assets.mjs && chmod +x dist/cli/cli.js && node scripts/inject-version.js",
  "postbuild": "node scripts/write-build-info.mjs --finalize",
  "check:migration-digests": "node --import tsx scripts/check-contract-spine-migration-digests.ts --check",
  "check:mission-control-contracts": "node --import tsx scripts/mission-control-contract-artifacts.ts --check"
}
```

For every pinned input entry the writer opens the live locator with strict no-follow regular/link-count-one semantics, requires live mode `0o644` for Git `100644` or `0o755` for Git `100755`, reads bounded stable bytes, reads the pinned blob through `git cat-file blob <gitBlobHash>`, and requires byte identity before and after the build phase. Every input path is fenced by parent identity plus a validated `{dev,ino,mode,size}` snapshot, bounded read, and strict reopen of the same locator and identity; a rename, alias, parent swap, or metadata drift fails. This whole-tree equality necessarily covers all emitted/copied inputs plus `package.json`, `package-lock.json`, `tsconfig.json`, `scripts/write-build-info.mjs`, `scripts/check-version-contract.mjs`, `scripts/check-english-contract.mjs`, `scripts/check-path-contract.mjs`, `scripts/check-contract-spine-migration-digests.ts`, `scripts/mission-control-contract-artifacts.ts`, `scripts/copy-step-assets.mjs`, `scripts/inject-version.js`, their tracked local dependency/read closure, and every migration/contract/source file those prebuild checks inspect. No working-tree index bit is authority: `assume-unchanged` or `skip-worktree` cannot hide a byte or mode difference because comparison is directly against the pinned Git blob/mode. Directory identities are exact `{realpath,devDecimal,inoDecimal,mode}`, with unsigned canonical decimal device/inode strings. Prepare records exact strict `PlatformBuildPrepareV2` `{schema:"setfarm.platform-build-prepare.v2",buildId,sourceSha,sourceTreeHash,buildInputSetHash,branch:"main",dirty:false,porcelainV2Hash,repositoryDirectoryIdentity,distDirectoryIdentity}` in that order; finalize requires the same pinned tuple and exact prepared repository/dist identities and never rewrites the prepared `BUILD_INFO.json`.

`scripts/write-build-info.mjs --prepare` uses only Node's standard `lstat`/`realpath`/`rename`/`mkdir`/`chmod`/`fsync` operations; OA17 adds no native helper and makes no `openat`, `renameat2`, or descriptor-relative path-operation claim. The pinned build-topology contract additionally requires exact `.gitignore` rule `.setfarm/`. Before rotation, exact `/usr/bin/git -c core.hooksPath=/dev/null -c core.fsmonitor=false check-ignore --no-index -q -- .setfarm/build-generations-v1/<buildId>.dist` under the replacement environment must exit 0 with empty stdout/stderr. Prepare snapshots the code-derived real repository as `{realpath,devDecimal,inoDecimal,mode}`, requires it non-group/world-writable, and validates fixed ignored parents `.setfarm` and `.setfarm/build-generations-v1` as real same-device repository descendants. `.setfarm` is created durably at `0o700` when absent or, when already used by Setfarm, must be a real non-group/world-writable identity-stable directory; `build-generations-v1` is created or adopted only at exact `0o700`.

Adopting an existing archive root is read-only but never shallow. Prepare first enumerates its direct entries and requires each to have exact lowercase UUID-v4 name `<uuid>.dist` and be a real same-device exact-`0o755` identity-stable directory; an unknown direct entry, ninth entry, file, symlink, special, wrong name/mode/device, path escape, duplicate/collision, or identity drift fails. It then recursively traverses every accepted generation with counters reset at that generation root and the common depth/entry/locator/per-file/total caps. Descendants may be only canonical identity-stable real same-device exact-`0o755` directories or same-device no-follow link-count-one regular files; every dirent counts before classification, and any symlink, hard link, special, collision, observable swap, or cap overflow fails. Retained storage is deliberately not terminal build authority: a generation may be empty, incomplete, a subset, or contain bounded extra canonical directories/files, and no exact expected output topology, source provenance, file mode, or byte hash is claimed. Existing archives remain read-only and require every encountered directory at `0o755`, but they are never normalized, mutated, deleted, merged, reused as current output, or pruned.

Prepare generates one unpredictable lowercase UUID-v4 `buildId` before rotation and requires its candidate absent. It completes the full read-only retained-generation validation above before classifying archive count. If root `dist` exists while eight valid archives already exist, prepare throws typed `BUILD_GENERATION_RETENTION_REQUIRED` before reading or mutating `dist`, creating authority, or changing either parent. Otherwise an existing `dist` must be one real same-device repository child at exact mode `0o755`. Before any cleanup, prepare performs a complete bounded no-follow inventory under the common caps; it counts before classification, provisionally recognizes only the three root publisher families below, and accepts only same-device regular files plus canonical real same-device directories whose mode satisfies `(mode & 0o022) === 0`. It identity-checks that predicate before opening or descending into each directory; modes such as `0o700`, `0o750`, and `0o755` are traversable, while the `0o777|0o775` cases and any other group/world-writable directory fail before descendant read, sanitation, or mutation. A symlink, special, nonpublisher hard link, collision, path escape, instability, or cap overflow also fails before cleanup.

The pre-rotation sanitation tuple is exact and ordered: `PREVIOUS_BUILD_PUBLISHER_BASENAMES_V1 = ["BUILD_INFO.json","PLATFORM_BUILD_OUTPUT_TREE.json","PLATFORM_RELEASE_MANIFEST.json"]`. For each basename, a fixed file with no candidate is admissible only as a no-follow same-device regular link-count-one file at `0o444`; fixed absent with no candidate is admissible. Fixed plus exactly one grammar-matching `.<basename>.<lowercase-uuid-v4>.tmp` is recoverable only when both paths are no-follow same-device regular links to the same inode, both report link count two and mode `0o444`, and bounded stable reads are byte-identical; prepare identity-rechecks and unlinks only the temporary, fsyncs `dist`, then strictly reopens the fixed file at the same inode/exact bytes/`0o444`/link-count one. Fixed absent plus exactly one grammar-matching stable same-device no-follow regular link-count-one temp at `0o600|0o444` is uncommitted old-generation state: prepare identity-rechecks and unlinks it, fsyncs `dist`, and requires both names absent; it never completes or publishes the old generation. An unknown publisher-like name, multiple candidates for one basename, fixed/candidate different inode, symlink/directory/special, wrong device/link count/mode, unstable bytes, or any other combination fails without cleanup. Sanitation repeats bounded identity checks around every unlink and cannot touch an arbitrary ordinary file.

After sanitation, prepare repeats the complete bounded storage traversal. It permits arbitrary canonical same-device no-follow regular link-count-one files and arbitrary real same-device directories, including empty, incomplete, subset, and extra storage; it claims neither expected terminal topology nor file bytes/modes. Before descending it again requires every directory to satisfy `(mode & 0o022) === 0` and captures its identity; a directory with group/world-writable mode, or an observable swap, fails before its descendants are read and before any normalization. Only after the whole validation pass succeeds does normalization begin: prepare iterates the captured directory tuple in canonical order, identity-rechecks each descriptor, changes it to exact `0o755`, fsyncs, closes/reopens, and requires retained device/inode/mode. It then atomically renames the whole unchanged-file generation to `.setfarm/build-generations-v1/<buildId>.dist`, fsyncs both parents, requires the archive to retain captured device/inode and all normalized directory modes, and requires root `dist` absent. A thrown/lost rename response is adopted only when source is absent and candidate reopens with the captured identity; source-present/candidate-absent is unchanged and every other state is corruption. If root `dist` was absent, even at eight archives, no archive is added.

Prepare next creates and fsyncs fresh exact-`0o755` `dist`, derives `EXPECTED_BUILD_OUTPUT_DIRECTORY_LOCATORS_V1` from the already pinned expected ordinary output tuple, and precreates the entire closure parent-first before BUILD_INFO or prepare-receipt publication. Every expected nested directory is created/adopted as a real same-device directory, changed through its descriptor to `0o755`, fsynced, parent-fsynced, closed/reopened, and identity/mode checked; after the full tuple, prepare re-enumerates and requires exactly that closure with no extra. Thus later `tsc`, `mkdir -p`, copy, and asset steps under the build script's fixed umask `0o077` reuse code-owned directories and cannot introduce authoritative directory modes even when npm's parent umask is `0o000`. The receipt records the fresh directory identity; when rotation occurred its `buildId` names the predecessor archive. Finalize requires the prepared identities and exact closure. Because every invocation read-only revalidates each retained archive independently at no more than 536,870,912 regular-file bytes, at most eight generations and `4_294_967_296` retained regular-file bytes are bounded without claiming their provenance or hashing their content.

Rotation recovery is intentionally append-only. A crash before rename leaves the predecessor `dist`; retry chooses a new build ID, performs the bounded publisher sanitation and directory normalization above, and rotates it. A crash after rename but before fresh-`dist` creation leaves the archive and an absent `dist`; retry chooses a new build ID and creates fresh `dist` without touching the archive. A crash after directory precreation, BUILD_INFO, partial prepare publication, ordinary build output, output-tree publication, or release-manifest publication causes retry to sanitize any exact recoverable publisher link/temp state, rotate the incomplete real `dist` as another whole storage archive, create/preseed another fresh generation, and issue a new receipt. An invalid publisher state or archive-name collision fails without overwrite; a later invocation may proceed only after the state is valid and chooses a new ID. No retry ever finishes an old generation, reuses, deletes, merges, or prunes an archive. Because standard Node path APIs cannot exclude a malicious same-UID actor that performs and restores an otherwise unobservable swap wholly between identity checkpoints, OA17 explicitly does not claim safety against that adversary; external single-writer serialization is required. It does detect and reject every observable identity change covered by deterministic fixtures.

OA17 deliberately has no retention mutation, override, environment switch, or shell cleanup instruction. OA18 below is the explicit permanent-rollout dependency and now defines the separately reviewed operator-owned maintenance-window authority that inventories exact archived identities, proves no active build/recovery observer can reference them, authorizes bounded oldest-generation permanent disposition, records durable evidence, and preserves crash recovery. In the combined current design, `BUILD_GENERATION_RETENTION_REQUIRED` can be resolved only through that exact OA18 authority; no Setfarm build path silently prunes or bypasses the eight-generation bound.

`scripts/write-build-info.mjs --finalize` creates `dist/PLATFORM_BUILD_OUTPUT_TREE.json` after every ordinary build output is complete and before `dist/PLATFORM_RELEASE_MANIFEST.json`; the release manifest remains the terminal release-authority write. The new artifact is one strict `PlatformBuildOutputTreeV1`:

```typescript
export type PlatformBuildOutputTreeEntryV1 = Readonly<{
  locator: string;
  mode: number;
  byteLength: number;
  sha256: Sha256V1;
}>;
export type PlatformBuildOutputTreeV1 = Readonly<{
  schema: "setfarm.platform-build-output-tree.v1";
  sourceSha: GitObjectHashV1;
  sourceTreeHash: GitObjectHashV1;
  entries: readonly PlatformBuildOutputTreeEntryV1[];
  outputTreeHash: Sha256V1;
}>;
```

Each locator is the NFC-stable repository-relative POSIX path `dist/<relative-output-path>`: no empty segment, `.`, `..`, backslash, NUL/control byte, absolute path, non-NFC spelling, or value longer than 1,024 UTF-8 octets is accepted. Entries are unique and ordered by unsigned UTF-8 byte comparison of `locator`; a duplicate raw locator or a Unicode-normalization/case-fold filesystem collision fails. The code-owned expected locator set is derived only from the pinned input path tuple: every pinned `src/**/*.ts` regular source except `*.d.ts`, `*.mts`, and `*.cts` maps to `dist/<path-relative-to-src-with-.ts-replaced-by-.js>`; pinned fixed copy `src/server/index.html` maps to `dist/server/index.html`; pinned fixed copy `src/installer/compat-rules.json` maps to `dist/installer/compat-rules.json`; every pinned direct `src/installer/prompts/*.md` maps to the same relative path below `dist/installer/prompts/`; and every pinned recursive `src/installer/steps/**/*.md` maps to the same relative path below `dist/installer/steps/`. No live source glob and no other ordinary output locator is permitted. The observed included locator tuple must equal that derived tuple byte-for-byte; the four authority-file exclusions are exactly `dist/BUILD_INFO.json`, `dist/PLATFORM_BUILD_PREPARE.json`, `dist/PLATFORM_BUILD_OUTPUT_TREE.json`, and `dist/PLATFORM_RELEASE_MANIFEST.json`.

`EXPECTED_BUILD_OUTPUT_DIRECTORY_LOCATORS_V1` is derived, never scanned or caller-supplied: take every unique proper directory ancestor below `dist` of every code-owned expected ordinary output locator, exclude the `dist` root, and order the result by unsigned UTF-8 locator bytes. Authority files are root children and add no directory. Prepare precreates and verifies this complete closure without claiming any output file exists. Finalize and the zero-input observer are the only stages that require the combined exact derived directory-and-file topology: no missing, extra, or empty nested directory, every member one real same-device identity-stable directory at exact mode `0o755`, and the exact ordinary file tuple. Pre-rotation and retained-archive storage validation explicitly do not impose it. Directory mode is a topology invariant and does not enter `PlatformBuildOutputTreeV1` or `outputTreeHash`.

Before hashing, finalize revalidates the repository/fresh-dist path identities, derives `EXPECTED_BUILD_OUTPUT_DIRECTORY_LOCATORS_V1`, and validates every expected output as a no-follow regular link-count-one file. In unsigned locator order it records every expected nested directory's parent chain plus `{dev,ino,mode}`, requires `(mode & 0o022) === 0`, changes the already validated directory through its descriptor to exact `0o755`, fsyncs it, closes/reopens the same locator, and requires unchanged device/inode plus mode `0o755`; an observable directory/parent swap or group/world-writable directory fails. Before changing any ordinary output mode, finalize records its revalidated parent chain plus `{dev,ino,mode,size}` and likewise requires `(mode & 0o022) === 0`, proving the build-script mask never exposed a group/world-writable intermediate. It then normalizes `dist/cli/cli.js` to exact mode `0o755` and every other ordinary output to exact mode `0o644` through its already validated file descriptor, fsyncs, closes, and strictly reopens the same locator after another fresh-dist identity check; the reopened `{dev,ino,size,mode}` must name the same file. No other executable tuple exists. The fixed build-script mask therefore remains effective even when npm's parent umask is `0o000`. Each included entry remains device/inode/size/mode/mtime/ctime stable across its bounded post-normalization read and final reopen and contributes its exact byte length and SHA-256. Finalize then enumerates complete fresh `dist` under the shared caps, proves exact ordinary-file locator equality and exact nested-directory tuple/mode equality, and rereads/revalidates `BUILD_INFO.json` and `PLATFORM_BUILD_PREPARE.json` after that enumeration before publishing the output tree. A missing expected locator/directory or any extra, empty, stale, symlinked, hard-linked, multiply named, group/world-writable or wrong-mode, observably directory-swapped, or changed output fails. `outputTreeHash` is exactly `hashCanonicalJson({schema,sourceSha,sourceTreeHash,entries})` in that member order and excludes only itself; directory modes and locators remain validated non-hash invariants.

BUILD_INFO, output tree, and terminal release manifest use one private, non-exported JavaScript publication primitive; OA17 adds no helper file or public injection seam. BUILD_INFO supplies its exact pretty-byte candidate below; each exact declared-order output-tree/release body supplies UTF-8 `JSON.stringify(body) + "\n"`. Temporary names are respectively `.BUILD_INFO.json.<uuid-v4>.tmp`, `.PLATFORM_BUILD_OUTPUT_TREE.json.<uuid-v4>.tmp`, and `.PLATFORM_RELEASE_MANIFEST.json.<uuid-v4>.tmp` in fresh `dist`. A new candidate is opened no-follow/exclusive at `0o600`, written and fsynced, changed to `0o444` and fsynced, linked to the fixed basename without replacement, directory-fsynced, then unlinked and directory-fsynced. Success requires a final no-follow reopen whose bytes are exact, mode is `0o444`, link count is one, and repository/fresh-`dist` identities are unchanged.

The primitive has one exact recovery matrix. Discovery counts every fresh-dist dirent before classification; only one grammar-matching candidate may be provisionally omitted from expected-locator comparison, while unknown/multiple candidates are never omitted. Fixed absent plus no recognized temporary publishes fresh. Fixed absent plus exactly one grammar-matching stable no-follow regular same-device link-count-one temporary at exact mode `0o600|0o444` treats that temporary as uncommitted: if its bounded stable bytes equal the freshly derived candidate, recovery changes it to `0o444` when needed, fsyncs its descriptor, and links it; if its bytes are unequal or partial, recovery proves the same path/device/inode/mode/link identity, unlinks that stable temporary, fsyncs the parent, and starts a fresh publication. Unknown name, multiple candidates, symlink/special/directory, wrong device, link count, or mode fails without cleanup. Fixed present plus no temporary adopts only exact bytes at `0o444`/link-count one. Fixed present plus exactly one recognized same-inode `0o444` temporary is the post-link response-loss state: both links must report link count two and exact bytes, after which recovery unlinks only that temporary and fsyncs. A different-inode temporary, unequal fixed bytes, unexpected link count, or any other combination conflicts. Every success path—including fixed-only adoption and either recovery form—fsyncs the parent once more, strictly no-follow reopens the fixed file, and rechecks exact bytes/mode/link-count one plus parent identity immediately before return.

The shared publisher tests BUILD_INFO, output tree, and release manifest independently at crashes after temporary creation, write/fsync, chmod/fsync, fixed-link creation, first directory fsync, temporary unlink, second directory fsync, fixed reopen, and response return. Its double-crash matrix first creates every recoverable orphan/fixed state, then crashes recovery itself before/after unequal-temp unlink, cleanup fsync, recovered chmod, descriptor fsync, link, fixed/sibling cleanup, final parent fsync, and strict reopen; a second retry must either reach the same exact fixed bytes at `0o444`/link-count one or retain a fail-closed invalid state without overwriting unrelated bytes. The prepare receipt remains durable until output tree reaches its exact adopted terminal. Finalize then durably removes the prepare receipt and invokes the same primitive for `PLATFORM_RELEASE_MANIFEST.json` as terminal release authority; terminal-manifest fixtures repeat the complete single- and double-crash matrix rather than relying on output-tree coverage. If the prepare receipt is absent after output-tree adoption, retry enters only this terminal-recovery state: it rederives pinned source and expected outputs, reopens BUILD_INFO and the exact output tree, reconstructs the same deterministic release manifest, and publishes/adopts it without rewriting BUILD_INFO, rebuilding, or creating a new output tree. After terminal publication it re-enumerates fresh `dist`, rereads/reopens all three remaining authority files, and revalidates exact bytes/hashes/modes/link counts plus unchanged repository/fresh-`dist` identities.

The deterministic `PlatformReleaseManifestV1` candidate is never copied from an existing manifest. Finalize locates exact pinned entry `scripts/stitch-to-jsx.mjs`, requires Git mode `100644`, reads its raw pinned blob bytes by object ID, requires 1 through `16_777_216` bytes and strict UTF-8 round trip, and constructs exactly this declared-order body from the pinned source tuple:

```typescript
const expectedReleaseManifest = {
  schema: "setfarm.platform-release-manifest.v1",
  releaseSha: sourceSha,
  branch: "main",
  dirty: false,
  stitchConverter: {
    converterId: "setfarm.stitch-to-jsx",
    source: {
      schema: "setfarm.source-artifact-ref.v1",
      hash: sha256(pinnedStitchConverterBytes),
      mediaType: "text/javascript",
      locator: "scripts/stitch-to-jsx.mjs",
      byteLength: pinnedStitchConverterBytes.byteLength,
    },
  },
} as const;
```

The live converter is already independently byte/mode-equal to that pinned blob through whole-input validation. The terminal file must equal the exact canonical artifact bytes for this body; schema-valid but different SHA, branch, dirty value, converter ID, source schema/hash/media type/locator/length, extra member, key spelling/order, whitespace, or trailing bytes are not adoptable authority.

`dist/BUILD_INFO.json` has exactly seven enumerable fields in this declared order: `{sha,shortSha,branch,dirty,packageVersion,displayVersion,builtAt}`. Its file bytes are exactly UTF-8 `JSON.stringify(value, null, 2) + "\n"`; compact JSON, alternate indentation/order/whitespace, BOM, or trailing bytes fail. `sha` is a full lowercase 40- or 64-hex Git commit, `shortSha === sha.slice(0,8)`, `branch === "main"`, `dirty === false`, `packageVersion` is the exact nonempty package version, and `displayVersion` equals the literal concatenation `packageVersion + "+" + shortSha`. `builtAt` is strict UTC RFC 3339 metadata with millisecond precision (`YYYY-MM-DDTHH:mm:ss.sssZ`) but is excluded from build identity. Prepare publishes these bytes in fresh `dist` through the same durable private primitive using `.BUILD_INFO.json.<uuid-v4>.tmp`; final BUILD_INFO is no-follow regular, link-count one, exact mode `0o444`, parent-fsynced, and strictly reopened before return. Restrictive umask cannot change it, finalize never rewrites it, and the observer reparses the seven-field value, reconstructs the exact pretty bytes, and verifies raw bytes/mode/link count plus source fields. The exact stable projection is:

```typescript
export type InternalProductionStableSetfarmBuildInfoV1 = Readonly<{
  schema: "setfarm.internal-production-stable-setfarm-build-info.v1";
  sha: GitObjectHashV1;
  shortSha: string;
  branch: "main";
  dirty: false;
  packageVersion: string;
  displayVersion: string;
}>;
```

`stableBuildInfo` is constructed in the shown order. `releaseManifestHash` is `hashCanonicalJson(releaseManifest)` over the complete strict `setfarm.platform-release-manifest.v1` body in its declared order. `controllerBuildHash` is exactly `hashCanonicalJson({schema:"setfarm.internal-production-controller-build.v1",stableBuildInfo,buildInputSetHash,outputTreeHash,releaseManifestHash})` in that member order. It therefore changes with the pinned input set, stable build metadata, any included output byte/mode/locator, or the release manifest, but two otherwise identical finalized builds with different valid `builtAt` values have the same `controllerBuildHash`. Neither raw `BUILD_INFO.json`, its `builtAt`, path, PID, timestamp, stdout, nor filesystem metadata enters the projection.

`src/internal-production/baseline-post-handoff-receipt-v1.ts` owns zero-input `observeCurrentInternalProductionCleanSetfarmSourceBuildV1()`. It derives the one real repository root only from its own exact real `src/internal-production/baseline-post-handoff-receipt-v1.ts` or `dist/internal-production/baseline-post-handoff-receipt-v1.js` module location and requires `/usr/bin/git rev-parse --show-toplevel` to resolve to that same root. It accepts no root, executable, environment, branch, ref, SHA, tree, build, body, filesystem, clock, subprocess, or fallback input and has no package-install or sibling-checkout fallback. Every Git child uses literal `/usr/bin/git`, `shell:false`, bounded output/time, and a replacement environment containing only fixed locale/PATH plus `GIT_CONFIG_NOSYSTEM=1`, `GIT_CONFIG_GLOBAL=/dev/null`, `GIT_NO_REPLACE_OBJECTS=1`, `GIT_OPTIONAL_LOCKS=0`, and `GIT_TERMINAL_PROMPT=0`; every command also fixes `core.hooksPath=/dev/null`, disables fsmonitor, and uses no fetch or mutation. Before the origin read, exact `/usr/bin/git -c core.hooksPath=/dev/null -c core.fsmonitor=false config --local --no-includes --name-only --get-regexp '^include'` must exit 1 with empty stdout/stderr, so a local `include` or `includeIf` key fails. Origin is read only by exact `/usr/bin/git -c core.hooksPath=/dev/null -c core.fsmonitor=false config --local --no-includes --get-all remote.origin.url`; it must exit 0 with empty stderr and stdout bytes exactly `https://github.com/hikmetgulsesli/setfarm.git\n`. Zero, multiple, empty, whitespace-padded, differently encoded, or noncanonical lines fail.

The observer requires symbolic branch exactly `main`; empty `git status --porcelain=v2 --untracked-files=all`; one full `HEAD^{commit}` equal to `refs/remotes/origin/main^{commit}`; and one full `HEAD^{tree}` whose hash format matches the commit format. Before reading any build artifact, it snapshots and repeatedly reopens the code-derived repository/fresh-`dist` `{realpath,devDecimal,inoDecimal,mode}` identities, derives the complete pinned input set anew from `HEAD` under the shared caps, and for every entry proves strict live no-follow link-count-one byte/mode equality to the pinned Git blob/mode with validate-read-reopen path identity. From pinned `scripts/stitch-to-jsx.mjs` blob bytes it also constructs the exact expected release-manifest body and canonical artifact bytes above. This finalized-current observer leaves `.setfarm/build-generations-v1` outside its read set; the prepare-time archive-root adoption traversal above solely owns retained-generation bounding.

The observer then reads each authority file and ordinary output only through revalidated fresh-`dist` paths, applies the preclassification dirent counters, validates per-path parent plus `{dev,ino,mode,size}`, and derives the same `EXPECTED_BUILD_OUTPUT_DIRECTORY_LOCATORS_V1`. It requires the observed nested-directory tuple to equal that exact set, requires every member to remain a real same-device mode-`0o755` directory across identity reopen, fully recomputes the expected ordinary-output enumeration/hash, and rereads all three authority files after enumeration. An empty/extra/missing/wrong-mode/swapped directory fails even though directory metadata is not hashed. The release manifest must be both one strict `PlatformReleaseManifestV1` and byte-for-byte equal to the deterministic pinned-source canonical candidate; shape-only validity or self-consistent tampered hash/length is insufficient. After artifact reads it repeats origin/branch/status/HEAD/tree, rederives the entire pinned set, requires exact tuple/hash equality with the first set, rereads every live tracked input against pinned blobs/modes, reconstructs the same expected manifest, and only then rereads the authority files and revalidates repository/fresh-`dist` plus nested-directory identities/modes. Build info SHA/branch/dirty, pinned set source/tree/hash, output-tree source SHA/tree, exact release manifest, and the observed Git tuple must all agree. Thus finalized-artifact observation rejects hidden post-build `assume-unchanged` or `skip-worktree` byte/mode drift even when porcelain is empty. Any detached/non-main ref, dirty tracked or untracked byte, missing/stale origin, local include, multiple/noncanonical remote, stale build, manifest field/byte drift, source/tree/input/output drift, observable repository/dist/descendant swap, Git replacement-object possibility, limit overflow, or before/after TOCTOU drift fails before returning `{branch:"main",clean:true,sha,treeHash,buildHash:controllerBuildHash,originMainSha}`. Like the writer, the observer claims deterministic observable-change detection under single-writer operation, not protection from an unobservable malicious same-UID swap wholly between standard Node path checkpoints. Its controller projection is exactly `{controllerSourceSha:sha,controllerTreeHash:treeHash,controllerBuildHash:buildHash}`.

`src/execution/v3-git-revision.ts` additionally owns low-level `replayV3HistoricalGitCommitAncestryV1({repo,ancestorSha,descendantSha,expectedAncestorTreeHash,expectedDescendantTreeHash,expectedMergeBase})`. This generic primitive accepts exactly one repository boundary plus two exact full lowercase commit SHAs and their stored expected proof members; it never chooses a root, ref, branch, remote, fetch, or current head. The baseline-receipt/A-source wrapper remains zero-input and supplies only its code-owned fixed real Setfarm root plus stored authority values. The primitive uses the same fixed `/usr/bin/git`/replacement-environment/no-replace/no-config policy, reopens both raw object IDs with `cat-file`, requires exact type `commit` rather than blob/tree/tag, resolves and type-checks each `^{tree}`, requires exact stored-tree equality, accepts only `merge-base --is-ancestor` exit status 0, then requires plain `merge-base` to emit exactly one full hash equal to both `expectedMergeBase` and `ancestorSha`. It repeats commit-type/tree reads after ancestry evaluation and rejects missing objects, replacement objects, blobs, tags, nonancestors, multiple/empty merge bases, stored proof mismatch, or object/ref drift. Current clean Setfarm or Mission Control HEAD/build/PBA equality is deliberately absent from this historical primitive.

OA17 TDD is exact. First add failing cases, observe RED for the missing artifact/observer/helper behavior, then implement pinned-input verification and build-command parity, bounded non-destructive generation rotation, pre-rotation publisher sanitation, prepare-time directory precreation, output/directory mode normalization and the shared private artifact publisher, low-level Git replay, and zero-input baseline observer in that order. Writer tests run two consecutive clean prepare/build/finalize cycles and prove the second bounds/sanitizes then atomically moves the entire first `dist`—including bounded stale/extra/empty/incomplete storage and prior authority files—to one exact `0o755` `<buildId>.dist` archive, creates/preseeds fresh `0o755` `dist`, and never deletes/prunes an archive. Pre-rotation fixtures accept arbitrary bounded canonical regular link-count-one files and non-group/world-writable real directories, normalize identity-stable `0o700|0o750|0o755` nested directories to `0o755` after the whole validation pass, and reject the `0o777|0o775` cases or another group/world-writable mode before descending, sanitation, or any normalization. They also reject every independently reset depth/entry/locator/per-file/total boundary violation, symlink/special/nonpublisher hardlink/collision, escape, or read/identity drift and do not require terminal file/directory topology.

Sanitation fixtures independently exercise all three exact publisher basenames. They accept fixed-absent/no-temp and exact fixed-only; clean fixed plus one same-inode two-link `0o444` exact-byte temp to fixed/link-count one with directory fsync/reopen; and remove fixed-absent one-link stable `0o600|0o444` temp as uncommitted without finishing it. They reject an unknown publisher-like name, multiple candidates, fixed/temp different inode or bytes, wrong type/device/link/mode, instability, and a cleanup race, proving no unrelated file is touched. Archive-root fixtures accept seven valid direct entries only after recursively traversing every generation under independently reset caps, then rotate to exactly eight; stored generations may be empty, incomplete, subsets, or contain bounded extra canonical files/directories. With eight plus a preexisting `dist`, they require `BUILD_GENERATION_RETENTION_REQUIRED` and byte/identity equality before versus after; eight plus absent `dist` may create fresh without a ninth. They reject an unknown direct entry, ninth generation, non-UUID, file, symlink, special, wrong root/nested-directory mode or device, descendant hard link/special/symlink, per-generation 10,001st dirent or 512-MiB overflow, collision, and traversal identity drift, while a bounded bootstrap archive proves only current storage bounds and contributes no byte hash/provenance claim.

Full-build restart fixtures use disposable Git repositories and execute the literal `npm run build`, never this source worktree. Under each parent umask `0o077` and `0o000`, one fixture interrupts after prepare has precreated the complete nested closure but before the first build output (`mkdir-before-file`), and three fixtures interrupt immediately after the fixed hard link for BUILD_INFO, output tree, and release manifest respectively. Fault points are fixture-only committed transformations inside the disposable repository and are removed in a new fixture commit before restart; production exports no fault flag, environment switch, root, filesystem, or callback seam. A second full `npm run build` must sanitize rather than finish the old generation, rotate it without any publisher temp sibling, precreate a new exact-`0o755` closure, and finish one valid terminal build. The parent umask `0o000` fixture observes finalize's pre-normalization check and proves every tsc/cp/copy-step/chmod/inject intermediate and every nested directory has `(mode & 0o022) === 0`; terminal ordinary files are `0o644`, sole CLI is `0o755`, and directories are `0o755`. Rotation fixtures also stop before rename, after successful/response-lost rename, and before/after fresh-dist/precreation/prepare receipt; retries preserve all archives. Tests assert the derived eight-generation/`4_294_967_296`-byte bound and OA18 maintenance-window dependency. A source-boundary fixture rejects a native addon/helper, recursive deletion, archive mutation/delete/prune, or claimed `openat`/`renameat2` guarantee and retains the same-UID limitation.

Separate hidden-drift fixtures mark a TypeScript source, copied asset, converter, and one build script/config `assume-unchanged` or `skip-worktree`, mutate live bytes or executable mode while porcelain remains empty, and require pinned blob/mode comparison to fail in both writer and finalized-artifact observer; the observer fixture introduces hidden drift only after valid artifacts exist and proves both its pre-artifact and post-artifact whole-input passes fail closed. Package parity plus source-token fixtures require raw `package.json` build bytes to start with exactly one `umask 077 && ` at byte zero, retain the entire frozen suffix, and contain no later `umask`; deleting, moving, duplicating, or resetting the token fails before expected-locator derivation. Other parity fixtures change `tsconfig` rootDir/outDir/include/output option, direct prompt glob, fixed copy mapping, or recursive copy-step traversal and require failure until the code-owned contract is updated. Prepare/finalize tests prove exact `0o755` for `dist` plus every precreated derived nested output directory under both parent umasks, exact `0o644` ordinary outputs, sole `dist/cli/cli.js` `0o755`, and BUILD_INFO exact pretty bytes at `0o444`/link-count one. Compact/reordered/reindented/BOM/trailing BUILD_INFO, wrong mode/link/type, and raw-byte observer tamper fail. Finalize/observer alone prove combined derived directory-and-file set equality and reject a missing, extra, empty, group/world-writable, wrong-mode, symlinked, or swapped nested directory plus every output-byte/mode/locator tamper and missing/extra/symlink/hardlink/collision case. Directory-race fixtures make observable swaps of repository, fresh `dist`, a nested output directory, output parent, authority file, or ordinary output between validate/normalize/fsync/read/reopen checkpoints and require identity failure; nested-directory mode drift and authority mutation after enumeration also fail. Boundary fixtures cover depth 64, 1,024 locator octets, 32 MiB per file, and 512 MiB total plus the fresh-`dist` wide-empty-directory rule: every directory/symlink/special is counted before classification, dirent 10,000 reaches semantic rejection, and 10,001 fails the cap first.

BUILD_INFO, output-tree, and release-manifest crash fixtures each cover every temporary/write/chmod/link/fsync/unlink/reopen/response boundary; fixed-absent zero/exact-one/unequal-partial-one/multiple-invalid and fixed-present equal/unequal/same-inode/different-inode states; unequal stable-temp unlink+parent-fsync+fresh publication; and mandatory parent-fsync/strict-reopen on fixed-only adoption. The double-crash matrix crashes each recovery before and after cleanup unlink/fsync, recovered chmod/fsync/link, sibling cleanup, final parent fsync, and reopen, then proves a second retry terminates exact or remains fail-closed without overwriting unrelated bytes. All three authority files end exact `0o444`/link-count one. Manifest tests construct expected bytes from pinned `scripts/stitch-to-jsx.mjs` blob bytes/hash/length and exact source SHA/main/clean fields, then tamper every outer and nested field, extra member, member order, whitespace, trailing byte, converter blob, hash, and length; strict shape alone never passes. They prove equivalent `builtAt` values do not change identity; dirty tracked/untracked, detached/wrong branch, missing/stale/noncanonical/multiple origin, local include/includeIf, source/build/ref and before/after drift fail; valid commit ancestry succeeds; missing/blob/tag/tree/nonancestor/tree-mismatch/merge-base-mismatch/drift cases fail; and no production root/tool/env/SHA/body/fake seam or packaged fallback is exported. All prepare/build/finalize subprocesses execute only inside disposable temporary Git fixtures assembled by the test; the focused commands never run a build in the source worktree or touch live artifacts. Run:

```bash
set -euo pipefail
node --test scripts/__tests__/build-info-version.test.js
node --import tsx --test tests/execution-attempts/v3-git-revision.test.ts
node --import tsx --test tests/execution-attempts/v3-implementation-attempt-v2.test.ts
node --import tsx --test tests/execution-attempts/v3-normal-implementation-preclaim.test.ts
node --import tsx --test tests/internal-production/baseline-post-handoff-receipt-v1.test.ts
npx tsc -p tsconfig.json --noEmit
npm run check:english
npm run check:paths
git diff --check
```

These are source-only gates; any build subprocess is confined to a disposable temporary Git fixture and never targets this worktree or live artifacts. They do not publish a current-entry operation, create a live store/authority, connect to PostgreSQL, or mutate a live service. The owner performs the later real clean-main build/release gate only after reviewed source delivery.

#### OA18: authorize rotation history, permanent bounded disposition, and the first current entry

OA18 expands OA17's historical 107-path tuple to the current exact 109-path tuple by adding only `scripts/__tests__/build-generation-retention.test.js` and `scripts/build-generation-retention.mjs` in lexicographic order. It makes rotation provenance constructible before it permits retention. `scripts/write-build-info.mjs` imports only the new module's pure strict ledger schemas, parsers, hashing, and no-replace publication helpers; the new module has a main guard, so importing it cannot execute a CLI. `scripts/build-generation-retention.mjs` never imports or executes the writer. Both paths apply the same strict parser and chain rules.

The fixed rotation-ledger root is `<code-owned Setfarm root>/.setfarm/build-generation-rotation-ledger-v1`, with exact real `0o700` root and exact `intents`, `completions`, and `dispositions` directories. Each immutable record is canonical JSON plus one LF, at most 1,048,576 bytes, one no-follow regular file at `0o600` and link count one, published without replacement as `<20-digit-zero-padded-ordinal>-<lowercase-uuid-v4>.json` in its kind directory, followed by directory fsync and strict reopen. Lowercase UUID-v4 is exactly `/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/`; filename, body, ref, and archive locator must agree on the same ordinal/UUID. The bounded exact ordered scan accepts at most 4,096 ordinals and otherwise throws typed `BUILD_GENERATION_ROTATION_LEDGER_CAPACITY_REQUIRED`; there is no compaction or backfill. Ordinal one has a null predecessor. Every later intent and completion binds the exact immediately preceding completion pair. A gap, fork, duplicate ordinal, crossed intent/completion, invalid predecessor, both source and destination present, neither present after a reported rename, or an archive without its exact completed-ledger record is corruption. Any existing legacy unindexed archive therefore blocks rotation and retention; UUID, mtime, and ctime are never chronology authority and no implementation may guess a backfill.

Every OA18 immutable filesystem publisher uses one grammar-bounded no-replace recovery automaton, shared by rotation-ledger records, the maintenance lock, retention operations/candidate indexes/receipts, erase-step intents/completions, the three fixed current-entry prerequisite/operation files, and every later filesystem-backed current-entry phase/status/authority record below. `MAX_NO_REPLACE_PUBLISHER_TEMP_CANDIDATES_V1=8`; a ninth grammar temp or any unknown publisher-like dirent blocks before cleanup. A live immutable contender owns its fresh UUID temp until link result: the winner normalizes its own two-link state; a loser that observes `EEXIST` reopens the fixed byte-identical record, identity-checks and unlinks only its own temp, fsyncs the parent, and never touches another contender's temp. Recovery enumerates zero through eight temps in unsigned-UTF-8 basename order. Fixed-only exact bytes are parent-fsynced/reopened. Fixed plus any finite set of stable byte-equal unpublished duplicates permits deterministic one-at-a-time identity-rechecked duplicate unlink, parent fsync after each, and fixed reopen; a same-inode two-link temp is normalized by the same rule. With fixed absent, the lexicographically first stable complete expected temp resumes fsync/link/parent-fsync/temp-unlink/reopen, after which only other stable byte-equal duplicates are removed deterministically. A sole recognized stable incomplete/unequal temp is uncommitted and may be identity-rechecked/unlinked/fsynced before fresh publication; competing unequal/partial shapes, wrong type/device/mode/link count, or drift block. Every initial/recovery boundary is double-crashed, and real two- and three-contender tests prove one fixed winner, owner-only loser cleanup, deterministic duplicate recovery, and no leaked temp.

Maintenance-lock temps are a stricter branch: each temp's exact bytes bind its own `nonce+pid+processLstart+processGroupId`, and a losing live acquirer may remove only the temp whose nonce and identity it owns. Recovery applies the frozen process observer below to every lock temp and fixed lock. It removes a temp only for exact definite-dead or exact live-PID start/group mismatch, after byte/identity reopen and parent fsync; one exact live match or any ambiguous observation blocks all stealing/cleanup. It never treats an immutable byte-equal temp rule as authority to remove a live lock contender.

Writer and retention mutation share the one fixed durable lock `<code-owned Setfarm root>/.setfarm/build-generation-maintenance-lock-v1.json`. Its strict canonical-JSON-plus-LF body is exactly `{schema:"setfarm.platform-build-generation-maintenance-lock.v1",kind:"writer_prepare"|"retention_prepare"|"retention_resume",nonce:LowercaseUuidV4,pid,processLstart,processGroupId,candidateKeyHash}`; `candidateKeyHash` binds the writer build-attempt key or exact retention completion/operation pair and no caller supplies it. `pid` and `processGroupId` are canonical positive safe integers. The observer constants are frozen as `PROCESS_IDENTITY_EXECUTABLE_V1="/bin/ps"`, `PROCESS_IDENTITY_TIMEOUT_MS_V1=10_000`, `PROCESS_IDENTITY_MAX_BUFFER_BYTES_V1=1_048_576`, argv exactly `["-p",String(pid),"-o","lstart=","-o","pgid="]`, and child environment exactly `{PATH:"/usr/bin:/bin:/usr/sbin:/sbin",LANG:"C",LC_ALL:"C"}` with no inherited member. Exit 1 with byte-empty stdout/stderr is the sole `definitely_dead` result. Exit 0 requires byte-empty stderr and exactly one canonical LF-terminated row containing one English-C-locale `lstart` field and one canonical positive-safe-integer pgid, with no prefix/suffix/second row; exact stored `lstart+pgid` is `live_match`, while either mismatch is `live_pid_reused`. Nonzero other than 1, signal, timeout, overflow, spawn error, nonempty stderr on either status, exit-1 output, exit-0 empty/multiple/non-LF/malformed/non-C row, unsafe integer, or parse ambiguity is `ambiguous` and blocks. Only `definitely_dead|live_pid_reused` permits identity-rechecked stale unlink/fsync; `live_match|ambiguous` blocks. Mtime/age, signal, force, caller PID, and blind stale removal are forbidden. Release requires the acquiring process's exact nonce/kind/pid/lstart/pgid/candidate bytes and identity, unlinks only that fixed file, fsyncs/reopens the parent, and proves absence.

`write-build-info --prepare`, retention `prepare`, and retention `resume` acquire respectively `writer_prepare`, `retention_prepare`, and `retention_resume` before their first ledger/store/filesystem mutation and release only after their phase's durable terminal record or unchanged failure state is reopened. No writer/retention mutation occurs outside one of those three lock kinds, and `inspect` is read-only. The operation candidate index plus this lock prevents two retention operations for one candidate; the intent automaton plus this lock prevents two writer intents from one completion tip. Tests race two and three real child contenders; interrupt winner and losers at temp/link/fsync/cleanup boundaries; exercise exact dead, live-match, PID-reuse, and every ambiguous `/bin/ps` outcome; and require exactly one winner, owner-aware cleanup, no fork, and no over-cap temp leak. This replaces OA17's external writer/retention serialization assumption while retaining the stated same-UID filesystem-adversary limit.

Rotation scanning is a strict dangling-intent automaton, not a latest-completion shortcut. A completed tip permits exactly one next intent. An unmatched intent is classified only as `intent_published` when its exact source exists and destination is absent, or `rename_observed` when source is absent and the exact destination reopens with the bound identity/inventory; the first state may perform that intent's rename and the second may publish only that intent's completion. Source and destination both present/absent, destination inequality, a second intent for the same next ordinal, an intent whose predecessor is not the tip, or any new intent while one is unmatched is corruption. Recovery must finish the same intent under one current `writer_prepare` lock bound to that intent's durable writer candidate before any fresh rotation; after a crash, only the exact dead/mismatched-owner proof above may clear the stale lock before reacquisition. Thus response loss cannot fork chronology and a dangling intent cannot be skipped by a later writer or retention operation.

The strict ledger bodies and projections are:

```typescript
export type LowercaseUuidV4 = string & {
  readonly __lowercaseUuidV4: unique symbol;
};
export type PlatformBuildGenerationDirectoryIdentityV1 = Readonly<{
  realpath: string;
  devDecimal: string;
  inoDecimal: string;
  mode: number;
  linkCount: number;
}>;
export type PlatformBuildGenerationInventoryV1 = Readonly<{
  schema: "setfarm.platform-build-generation-inventory.v1";
  rootPhysicalIdentity: Readonly<{
    devDecimal: string;
    inoDecimal: string;
    mode: number;
    linkCount: number;
  }>;
  entryCount: number;
  regularFileByteCount: number;
  entries: readonly Readonly<{
    locator: string;
    kind: "directory" | "regular_file";
    devDecimal: string;
    inoDecimal: string;
    mode: number;
    linkCount: number;
    byteLength: number | null;
    sha256: Sha256V1 | null;
  }>[];
  physicalInventoryHash: Sha256V1;
  contentInventoryHash: Sha256V1;
}>;
export type PlatformBuildGenerationRotationControllerSourceV1 = Readonly<{
  branch: "main";
  clean: true;
  sourceSha: GitObjectHashV1;
  sourceTreeHash: GitObjectHashV1;
  originMainSha: GitObjectHashV1;
  buildInputSetHash: Sha256V1;
}>;
export type PlatformBuildGenerationRotationIntentPairV1 = Readonly<{
  intentRef: CanonicalRef;
  intentHash: Sha256V1;
}>;
export type PlatformBuildGenerationRotationIntentV1 = Readonly<{
  schema: "setfarm.platform-build-generation-rotation-intent.v1";
  ordinal: number;
  buildId: LowercaseUuidV4;
  predecessorCompletion:
    | null
    | PlatformBuildGenerationRotationCompletionPairV1;
  sourceParentIdentity: PlatformBuildGenerationDirectoryIdentityV1;
  destinationParentIdentity: PlatformBuildGenerationDirectoryIdentityV1;
  sourceLocator: "dist";
  destinationLocator: `.setfarm/build-generations-v1/${LowercaseUuidV4}.dist`;
  inventory: PlatformBuildGenerationInventoryV1;
  rotationControllerSource: PlatformBuildGenerationRotationControllerSourceV1;
  intentRef: CanonicalRef;
  intentHash: Sha256V1;
}>;
export type PlatformBuildGenerationRotationCompletionV1 = Readonly<{
  schema: "setfarm.platform-build-generation-rotation-completion.v1";
  ordinal: number;
  buildId: LowercaseUuidV4;
  predecessorCompletion:
    | null
    | PlatformBuildGenerationRotationCompletionPairV1;
  intent: PlatformBuildGenerationRotationIntentPairV1;
  sourceParentIdentity: PlatformBuildGenerationDirectoryIdentityV1;
  destinationParentIdentity: PlatformBuildGenerationDirectoryIdentityV1;
  archiveLocator: `.setfarm/build-generations-v1/${LowercaseUuidV4}.dist`;
  archiveIdentity: PlatformBuildGenerationDirectoryIdentityV1;
  inventory: PlatformBuildGenerationInventoryV1;
  rotationControllerSource: PlatformBuildGenerationRotationControllerSourceV1;
  completionRef: CanonicalRef;
  completionHash: Sha256V1;
}>;
export type PlatformBuildGenerationRotationCompletionPairV1 = Readonly<{
  completionRef: CanonicalRef;
  completionHash: Sha256V1;
}>;
export type PlatformBuildGenerationRotationDispositionV1 = Readonly<{
  schema: "setfarm.platform-build-generation-rotation-disposition.v1";
  ordinal: number;
  buildId: LowercaseUuidV4;
  completion: PlatformBuildGenerationRotationCompletionPairV1;
  retentionOperation: PlatformBuildGenerationRetentionOperationPairV1;
  retentionReceipt: PlatformBuildGenerationRetentionReceiptPairV1;
  sourceAbsent: true;
  quarantineLocator:
    `.setfarm/build-generation-quarantine-v1/${Sha256V1}.dist`;
  disposedRootPhysicalIdentity:
    PlatformBuildGenerationInventoryV1["rootPhysicalIdentity"];
  physicalInventoryHash: Sha256V1;
  contentInventoryHash: Sha256V1;
  permanentDisposition: true;
  quarantineAbsent: true;
  dispositionRef: CanonicalRef;
  dispositionHash: Sha256V1;
}>;
export type PlatformBuildGenerationRotationDispositionPairV1 = Readonly<{
  dispositionRef: CanonicalRef;
  dispositionHash: Sha256V1;
}>;
```

`PlatformBuildGenerationDirectoryIdentityV1` is OA18-owned rather than an import of OA17's private type: `realpath` is a canonical absolute no-NUL path equal to the code-owned expected locator's realpath, device/inode strings are nonempty unsigned canonical decimal with no leading zero except `"0"`, mode is an exact nonnegative integer permission/type projection, and link count is a positive safe integer.

`LowercaseUuidV4` is a strict branded value matching the regex above. The inventory is the exhaustive root-relative no-follow traversal under the OA17 generation-local limits: depth starts at zero for this generation and the 10,000-dirent and 536,870,912-regular-byte counters reset independently for it. The root itself is excluded from `entries`; `entryCount === entries.length`; `regularFileByteCount` is the exact safe-integer sum of regular-file `byteLength`; and the one canonical tuple contains every descendant exactly once in global unsigned-UTF-8 locator byte order, independent of traversal order or depth. Every regular file has `linkCount===1` and non-null byte length/hash. APFS directory and root `linkCount` is not topology: it is an opaque positive safe integer required only to remain stable across the immediately adjacent descriptor reopen or same-object rename observation that publishes a phase. It is never derived from directory child counts, and a later erase phase records and authenticates a fresh opaque directory-link snapshot instead of comparing it to the original inventory value. Directories have null byte length/hash. `physicalInventoryHash` is `hashCanonicalJson({schema,rootPhysicalIdentity,entryCount,regularFileByteCount,entries:entries.map(({sha256,...entry}) => entry)})`; `contentInventoryHash` is `hashCanonicalJson({schema,entryCount,regularFileByteCount,entries:entries.map(({locator,kind,mode,byteLength,sha256}) => ({locator,kind,mode,byteLength,sha256}))})`. Entry locators are relative to the renamed generation root; neither hash includes the root realpath, while the surrounding intent/completion separately binds the expected source/destination locator and reopened realpath identity. The writer publishes and strictly reopens the intent before rename. It renames only the bound source to the bound archive, fsyncs both parents, requires source absent, and immediately reopens the same root device/inode/mode/opaque-link snapshot and exhaustive relative inventories at the exact destination before publishing and reopening completion. A lost rename response is adopted only when source is absent and that exact destination equality holds; source-present/destination-absent is unexecuted, while both or neither is corruption. Prepare cannot claim the incomplete predecessor's build hash: `rotationControllerSource` is derived from pinned current Git inputs and requires `sourceSha===originMainSha`; the archive remains bounded storage, not a terminal build/provenance authority. Intent, completion, and disposition hashes exclude only their own ref/hash. Their refs are respectively `setfarm://internal-production/build-generation-rotation-intent/<20-digit-ordinal>/<uuid>/sha256/<intentHash>`, `setfarm://internal-production/build-generation-rotation-completion/<20-digit-ordinal>/<uuid>/sha256/<completionHash>`, and `setfarm://internal-production/build-generation-rotation-disposition/<20-digit-ordinal>/<uuid>/sha256/<dispositionHash>`, with exact body/ref/filename cross-equality. An exact completion, not an archive name or clock, advances the monotonic chain.

Retention is a separate operator-only maintenance workflow. `package.json` adds exactly `build-generation-retention:inspect`, `build-generation-retention:prepare`, and `build-generation-retention:resume`. `inspect` and `prepare` accept no path, UUID, ordinal, age, count, force, root, observer, or filesystem argument; `inspect` is zero-input/read-only and reports the validated chain, fixed maintenance lock, dangling intent, operation, and transient-quarantine state without selecting through a latest-file shortcut. `prepare` is zero-input, requires no dangling rotation intent, selects only the lowest completed ordinal among active archives, and refuses to select either of the newest two completed ordinals. The operation index is candidate-keyed: for one exact candidate completion it may publish or adopt only one unresolved operation pair, and any second operation body/ref/hash for that candidate is a fork. It acquires exact `retention_prepare`, publishes/adopts the immutable operation/index, releases that same fixed lock, and prints only the operation pair. `resume` accepts only `--operation-ref <ref> --operation-hash <hash> --json`, opens exactly that pair without scanning or accepting a body/path, requires it to equal the candidate-keyed unresolved operation, acquires `retention_resume`, and alone performs the transient quarantine plus permanent disposition before receipt/disposition publication and exact lock release. `npm run build` and every writer/finalizer path remain incapable of invoking retention or selecting/deleting a generation; their only shared surface is the maintenance lock and strict ledger parser.

The retention authority store is exactly `/Users/setrox/ai/setrox/data/internal-production-baseline/build-generation-retention-v1`, with exact real `0o700` root plus `operations/sha256`, `operation-candidates/sha256`, `erase-steps/sha256`, and `receipts/sha256` directories. Its content-addressed canonical-JSON-plus-LF records and candidate index are at most 1,048,576 bytes, no-follow regular `0o600`, link count one, and use the one recovery automaton above; byte-identical canonical fixed content is the only adoptable no-replace result. The candidate index locator is derived from the exact candidate completion-pair hash and contains exactly one operation pair; it is the no-scan/no-fork authority for adoption. Each erase-step intent/completion is content-addressed, binds the operation pair, zero-based post-order ordinal, exact locator/kind/identity, current phase's opaque directory-link snapshot where applicable, exact remaining-dirent-subset hash before and after, action `unlink|rmdir`, and immediately preceding erase-step completion pair; the maximum is the already bounded inventory entry count plus the root. The fixed quarantine root is `<code-owned Setfarm root>/.setfarm/build-generation-quarantine-v1`, exact real `0o700`, and permits zero or one exact transient child. `MAX_QUARANTINED_GENERATIONS_V1=1`; an existing child must equal the pair-authorized operation's derived locator and exact inventory or every command blocks. The exact destination is `<operationHash>.dist` at `0o755`. Quarantine is only the crash-recoverable rename boundary before permanent post-order disposition; terminal success requires it absent and releases disk.

Reference proof uses no shell and fixed `/usr/sbin/lsof` argv `-nP -F0 +D <candidate>`, `LSOF_REFERENCE_OBSERVER_TIMEOUT_MS_V1=10_000`, and `LSOF_REFERENCE_OBSERVER_MAX_BUFFER_BYTES_V1=1_048_576`. It runs under code-owned UID `process.getuid()`; the locally verified zero-match result is only exit status 1 with exactly empty stdout and stderr. Exit zero, nonempty output, another status, timeout, buffer overflow, execution error, or parse ambiguity blocks. This is explicitly a same-UID observer limitation, not proof against another UID or an unobservable malicious same-UID race. The fixed config tuple is `/Users/setrox/Library/LaunchAgents/com.setrox.setfarm-spawner.plist`, `/Users/setrox/Library/LaunchAgents/com.setrox.setfarm-dashboard.plist`, and `/Users/setrox/Library/LaunchAgents/com.setrox.mission-control.plist`. All three actual plists omit `Program`: the generic bounded no-follow plist decoder requires `program:null`, a nonempty `programArguments` tuple, and `effectiveProgram===programArguments[0]`. It represents `WorkingDirectory` as exactly `string | null`; label validation requires plist `workingDirectory:null` for spawner and dashboard and the literal `/Users/setrox/ai/setrox/mission-control` for Mission Control. The loaded-job decoder independently represents an absent launchd working directory as `{kind:"absent_launchd_default",reported:null,effective:"/"}`, an explicitly printed default as `{kind:"reported_launchd_default",reported:"/",effective:"/"}`, or an explicit nondefault as `{kind:"explicit",reported:string,effective:string}`; spawner/dashboard accept only one of the two exact default variants, while Mission Control accepts only the explicit Mission Control literal. It never invents plist/loaded equality between null and `/`. Loaded `Program` is independently either explicit or launchd-derived from `ProgramArguments[0]`, but its resolved effective value and loaded argument zero must both equal the plist `effectiveProgram`.

Expected runtime provenance is frozen inside the retention-operation core before the first loaded-process or `launchctl` observation and is never derived from that observation. The exact ordered tuple is spawner, dashboard, Mission Control. Spawner and dashboard reuse the same pair/body: their pair is the exact `{sourceSha:sourceBuild.sha,sourceTreeHash:sourceBuild.treeHash,controllerBuildHash:sourceBuild.buildHash}` projection and their body is byte-equal to the operation's current OA17 `sourceBuild`. Mission Control uses the operation's exact current `productBuildAuthorityV2DeliveryEvidence` pair and exact `productBuildAuthorityV2Observation` body only as the independently frozen expected source; its pair must also equal the pair embedded by that body's response. The operation first current-observes and freezes `sourceBuild`, then current-observes and freezes the PBA V2 pair/body, then constructs and validates this three-entry tuple, and only then observes any loaded job. A source CLI proves that expected current-source body at initial prepare; it never proves the loaded Mission Control generation. Historical resume recovers the expected body only from the embedded operation tuple through the pure PBA response parser, never from today's HEAD/build, today's source CLI, today's PBA CLI, a sibling checkout, or a loaded-process path.

Mission Control's loaded-generation producer is owned by the already mapped `server/services/product-build-authority-v2-delivery-evidence-v1.ts`. During evaluation of that compiled server module, before `server.listen()`, it strictly reads the terminal `dist-server/internal-production-build-identity.v1.json`, recomputes the complete `dist` plus `dist-server` output content hash under the existing build-identity algorithm while excluding only that identity file, requires equality with `buildIdentity.buildHash`, hashes the exact build-identity file bytes, hashes its own executing compiled owner-module bytes, creates one code-owned fresh lowercase UUID-v4 startup instance, and recursively freezes one success snapshot. A capture failure is caught and frozen as unavailable startup state; it does not publish a partial snapshot. The exact success ABI is:

```typescript
type ProductBuildAuthorityV2LoadedBuildResponseV1 = Readonly<{
  schema: "mission-control.product-build-authority-v2-loaded-build-response.v1";
  loadedBuildRef: `mission-control://internal-production/product-build-authority-v2-loaded-build/sha256/${string}`;
  loadedBuildHash: string;
  startupInstance: Readonly<{
    schema: "mission-control.product-build-authority-v2-startup-instance.v1";
    pid: number;
    instanceId: string;
  }>;
  loadedBuild: Readonly<{
    schema: "mission-control.product-build-authority-v2-loaded-build.v1";
    entryModulePath: "dist-server/services/product-build-authority-v2-delivery-evidence-v1.js";
    entryModuleHash: string;
    buildIdentity: Readonly<{
      schema: "mission-control.internal-production-build-identity.v1";
      sourceSha: string;
      treeHash: string;
      buildHash: string;
    }>;
    buildIdentityHash: string;
  }>;
}>;
```

Every SHA-256 member is exactly lowercase 64-hex. Only `buildIdentity.sourceSha` and `.treeHash` use the existing strict 40-or-64-lowercase-Git-object grammar. `loadedBuildHash = hashCanonicalJson(loadedBuild)` in the declared order, and `loadedBuildRef` is exactly `mission-control://internal-production/product-build-authority-v2-loaded-build/sha256/${loadedBuildHash}`. `startupInstance.pid` is the positive safe integer `process.pid`; `instanceId` is generated once during module evaluation, matches the strict lowercase UUID-v4 grammar, and has no caller, environment, fixture, or production injection. Startup instance is required correlation but is excluded from `loadedBuildHash` and its ref.

Freeze `PRODUCT_BUILD_AUTHORITY_V2_LOADED_BUILD_CANONICAL_REQUEST_TARGET_V1="/api/internal-production/product-build-authority-v2-loaded-build"` and `PRODUCT_BUILD_AUTHORITY_V2_OPERATIONAL_TOKEN_HEADER="x-setfarm-operational-token"`. The exact load-bearing relative order for this path is public `/api/health` ahead of authentication; root-mounted `productBuildAuthorityV2OperationalAuth`; `/api`-mounted `productBuildAuthorityV2GeneralAuth`; the single global `jsonBodyParser` wrapper over `express.json({limit:"2mb"})`; then, after unchanged unrelated API middleware and routers, `app.use("/api", setfarmOperationalRouter)`; API 404; and the existing terminal error boundary. Existing pre-auth public mounts and unrelated mounts retain their order and behavior. The operational authenticator computes a raw pathname only by slicing `req.originalUrl` before its first literal `?`, without decoding or normalization. A target whose raw pathname is not byte-for-byte equal to the canonical ASCII path passes unchanged to existing general `/api` authentication. A target whose raw pathname is exact—including a query-bearing target, HEAD, or another method—must pass endpoint operational authentication before general authentication, parser middleware, router dispatch, or snapshot access.

Exact success additionally requires `req.method==="GET"`, raw `req.originalUrl` byte-for-byte equal to the complete canonical request target with no `?` delimiter, and parser-visible `req.path` byte-for-byte equal to that canonical path. The parser wrapper applies the `req.path` equality before router dispatch. Because authentication candidacy compares only the raw pathname, a query-bearing canonical-path target authenticates first; the route's raw-target/request validator then returns request-invalid 400 before snapshot access. The route's method/raw-path guard calls `next()` before snapshot access for HEAD, another method, or a pathname mismatch. No case folding, percent decoding, slash collapsing, trailing-slash removal, or dot-segment removal may establish acceptance. The raw low-level refusal tuple is mixed-case `/API/internal-production/product-build-authority-v2-loaded-build`, inner-component mixed case `/api/Internal-Production/product-build-authority-v2-loaded-build`, trailing slash `/api/internal-production/product-build-authority-v2-loaded-build/`, duplicate slash `/api//internal-production/product-build-authority-v2-loaded-build`, percent encoding `/api/internal-production/product-build-authority-v2-loaded-%62uild`, and dot segment `/api/internal-production/./product-build-authority-v2-loaded-build`; every composition is also noncanonical. Such aliases never receive the operational-auth marker and therefore retain existing general `/api` authentication. With the frozen launchd environment, where `AUTH_TOKEN` is absent, each bodyless alias returns exact `404 {error:"Not found"}`; when general auth is separately configured, the same 404 follows only after its existing credential succeeds, while an unauthenticated alias retains its existing 401. Every case performs zero startup-snapshot access. A canonical `HEAD` with valid operational authentication returns 404 with no transmitted representation body and zero snapshot access; other unsupported methods likewise return the existing 404 after the applicable authentication.

The endpoint's configured source is exactly `config.setfarmOperationalWriteToken`, code-owned as module-evaluation `process.env.SETFARM_OPERATIONAL_WRITE_TOKEN || ""` with no trim, decoding, alternate variable, secret-store lookup, or fallback. The authenticator freezes `sha256(config.setfarmOperationalWriteToken)` during module evaluation only when the configured value is a string with JavaScript `length >= 32`; missing or shorter configuration returns exactly `503 {status:"unavailable",code:"PRODUCT_BUILD_AUTHORITY_V2_LOADED_BUILD_AUTH_UNAVAILABLE"}` for every raw canonical-path candidate. Otherwise it reads only the normalized request header `req.headers["x-setfarm-operational-token"]`, substitutes the empty string for any non-string value, hashes that UTF-8 string once, and applies `crypto.timingSafeEqual` to the two fixed-length SHA-256 buffers. Missing, duplicate/coalesced, wrong, query-only, body-only, `x-mc-token`-only, `Authorization`-only, or unequal operational credentials return exactly `401 {status:"unavailable",code:"PRODUCT_BUILD_AUTHORITY_V2_LOADED_BUILD_UNAUTHORIZED"}`. Neither failure invokes general auth, JSON decoding, router dispatch, or snapshot access, and no token is compared as a plain string, logged, reflected, or persisted.

Successful endpoint authentication defines one non-enumerable, non-configurable, non-writable symbol marker on the request. `productBuildAuthorityV2GeneralAuth` bypasses the existing `authMiddleware` only for that marker; every other `/api` request invokes the existing middleware unchanged. Thus a distinct configured `AUTH_TOKEN` cannot reject the already operationally authenticated canonical-path request, and Setfarm never reads, derives, injects, or forwards `AUTH_TOKEN`, `x-mc-token`, `Authorization`, or a query token. The globally mounted `jsonBodyParser` remains after both authentication layers and before all subsequently mounted routers, including the loaded router, but bypasses JSON decoding only when `req.path` is exactly the canonical loaded path. The loaded route itself rejects any query member, parsed body, `Content-Length` header including literal `0`, or `Transfer-Encoding` header as exact `400 {status:"unavailable",code:"PRODUCT_BUILD_AUTHORITY_V2_LOADED_BUILD_REQUEST_INVALID"}` with loaded no-cache headers and zero snapshot access. Consequently, an unauthenticated canonical malformed/framed request is exact loaded-endpoint 401, while the same request with valid operational authentication reaches the route unchanged and is exact finite 400 rather than a parser error or generic 500. Unrelated routes retain their existing general authentication, JSON parsing, and terminal-error behavior.

Fixed `GET /api/internal-production/product-build-authority-v2-loaded-build` retains `Cache-Control: no-store, max-age=0, must-revalidate`, `Pragma: no-cache`, and `Expires: 0`. A valid request serializes only the frozen snapshot and performs no Git command, build, focused test, CLI execution, filesystem read or write, listener action, current-source observation, resolver call, or mutation. Frozen startup capture failure returns only `503 {status:"unavailable",code:"PRODUCT_BUILD_AUTHORITY_V2_LOADED_BUILD_STARTUP_CAPTURE_INVALID"}`. It exposes no diagnostic detail, partial build, fallback to the delivery-evidence endpoint, or request-time retry.

For the Mission Control tuple member only, Setfarm brackets that fixed operationally authenticated loopback request in this exact order under the existing 10-second/1-MiB bounded replacement environment: (1) exact no-shell `/bin/launchctl print gui/<uid>/com.setrox.mission-control`; (2) exact no-shell `/bin/ps -p <pid> -o lstart= -o pgid=`; (3) exact no-shell `/usr/sbin/lsof -nP -iTCP:3080 -sTCP:LISTEN -F0pcfn`; (4) one no-proxy, no-config Node HTTP GET to `http://127.0.0.1:3080/api/internal-production/product-build-authority-v2-loaded-build`; then (5) the same launchctl, ps, and listener-lsof observations again. Before step 4, the strict fixed-plist projection and first loaded-launchctl projection must contain byte-identical raw `SETFARM_OPERATIONAL_WRITE_TOKEN` values satisfying the endpoint grammar. Because Mission Control's code-owned config binding is the direct environment value above, those are also the exact configured bytes hashed by the endpoint's module-evaluation authenticator. Setfarm holds those bytes only in the observer's local scope, sends them exactly once as the sole `x-setfarm-operational-token` header, and after the response requires the repeated launchctl projection to contain the same bytes. Only the already declared redacted/raw-null environment commitment and its hash may be persisted; the raw token is absent from operation/receipt/proof bodies, stdout, stderr, errors, and logs. `AUTH_TOKEN` remains intentionally absent from the frozen Mission Control environment tuple and is not an input. Missing, invalid, or crossed operational-token bytes fail closed with `BUILD_GENERATION_LOADED_MISSION_CONTROL_PROOF_REQUIRED` before operation publication or mutation.

The listener command's complete accepted stdout grammar is `process-set+`, where each process set is literal `p` + canonical positive-decimal PID + NUL, literal `c` + one nonempty NUL/LF-free UTF-8 command + NUL, then LF and one or more file sets; each file set is literal `f` + canonical nonnegative-decimal descriptor + NUL, literal `n` + endpoint + NUL, then LF. NUL terminates fields and LF terminates sets; a missing/final-extra byte, invalid UTF-8, empty value, leading-zero integer, unknown/duplicate/reordered field, process field inside a file set, file field before a process set, or other separator is invalid. Exit status must be exactly zero, stderr exactly empty, and the whole bounded stdout must contain exactly one process set with exactly one file set. Its PID must equal the launchd PID. The only accepted raw endpoint values are `127.0.0.1:3080` (IPv4 loopback), `[::1]:3080` (IPv6 loopback), or `*:3080` (the `-nP` lsof representation shared by IPv4 `INADDR_ANY` and IPv6 unspecified wildcard); hostnames, explicit `0.0.0.0`/`[::]`, mapped or scoped IPv6, another address/port, a peer arrow, or a suffix are rejected. `protocol:"TCP"` and `state:"LISTEN"` are code-owned projections of the fixed `-iTCP:3080 -sTCP:LISTEN` selection, not fields invented from `-F0pcfn`. The strict listener-fence projection is declared in exact order as `{schema,port:3080,protocol:"TCP",state:"LISTEN",listenerPid,command,fileDescriptor,endpoint,initialLsofBytesHash,finalLsofBytesHash}`. The second launchctl/ps/lsof byte strings and every parsed label, PID, start, process-group, command, endpoint, listener, and file-descriptor identity must equal the first observations. No caller chooses the URL, port, label, executable, argv, proxy, auth source, header, parser, timeout, body, response, or retry.

Setfarm strict-parses the response, recomputes `loadedBuildHash` and `loadedBuildRef`, requires `startupInstance.pid` to equal the twice-fenced launchd/listener PID, and requires `loadedBuild.buildIdentity.{sourceSha,treeHash,buildHash}` to equal `productBuildAuthorityV2Observation.response.evidence.currentSource.{sha,treeHash,buildHash}` from the operation. The Mission Control `serviceGenerationHash` is recomputed over one declared-order projection containing its schema and label, the complete `startupInstance`, complete `loadedBuild`, process fence, and listener fence; the process and listener fences each include both observation byte hashes plus their exact parsed identities and enforce first/second equality. PID or instance crossing, missing/stale endpoint, non-200 or wrong body, hash/ref/domain mismatch, source/tree/build mismatch, listener multiplicity or PID mismatch, any before/after drift, or any execution of the sibling/current source CLI in this loaded-generation path throws the finite code `BUILD_GENERATION_LOADED_MISSION_CONTROL_PROOF_REQUIRED` before operation publication or any retention mutation. A later disk/CLI advance does not change the loaded endpoint; historical resume compares the same embedded expected source to the still-frozen loaded response and never calls today's CLI.

Spawner and dashboard continue to execute their existing fixed no-shell `/bin/launchctl print gui/<uid>/<label>` plus process proof under a replacement child environment containing only literal `PATH=/usr/bin:/bin:/usr/sbin:/sbin`, `LANG=C`, and `LC_ALL=C`, with fixed 10-second/1-MiB bounds. For Mission Control, the initial and repeated launchctl/ps observations in the exact bracket above are the general loaded-job/process proof; no duplicate launchctl, ps, listener observation, CLI, or endpoint request is inserted into that sequence. The proof strictly parses the loaded label, explicit-or-derived Program observation, nonempty ordered arguments, independent working-directory observation, exact environment-key tuple, loaded PID, frozen `/bin/ps` start/group result, and process identity. For every path-bearing effective-Program/ProgramArguments/WorkingDirectory/environment token it performs a bounded at-most-32-hop no-follow symlink-chain walk: every hop is canonical absolute, loop-free, identity-stable, and recorded through `{dev,ino,mode,linkCount}` plus token/final-realpath hashes; relative tokens resolve only against that observation's independently established effective working directory. Setfarm loaded source SHA/tree/build continues to come from the finalized historical Setfarm generation and must equal its operation-bound OA17 source body. Mission Control source/tree/build comes only from the startup-frozen loaded-build response and must equal the operation-embedded PBA current source as described above; standard macOS `ps` and `lsof` never claim to expose already-evaluated V8 module bytes. `expectedObservedFieldEqualityHash=hashCanonicalJson({schema:"setfarm.platform-build-generation-expected-observed-field-equality.v1",label,expectedRuntimeSource,loadedProcessObservation})` in that declared order; the parser recomputes it and rejects any inequality. Executable/entrypoint/process/generation observations remain independently authenticated facts and cannot manufacture an expected body. Every resolved executable/entrypoint/config path must be outside both candidate and quarantine by lexical locator, canonical realpath, and device/inode ancestry. A missing/crossed expected tuple entry, a service not running from its independent expected body, an unverifiable generation, or candidate equality blocks retention and requires service rebind outside this tool.

This producer is explicitly a startup filesystem/build snapshot, not a claim that macOS exposes V8 memory bytes. Its authority comes from completing and freezing capture during compiled module evaluation before the listener opens. The existing same-UID filesystem-adversary and unobservable-race limitations remain; the new endpoint closes the ordinary stale-loaded-server/current-disk split but does not claim protection against a malicious same-UID actor that can win an unobservable race during startup capture.

Stored evidence is deliberately sufficient but redacted. Exact environment-name tuples are spawner `["PATH","SETFARM_PG_URL"]`, dashboard `["PATH","SETFARM_OPERATIONAL_WRITE_TOKEN","SETFARM_PG_URL"]`, and Mission Control `["CLI_PATH","MC_HOST","MC_INTERNAL_URL","MC_PORT","PATH","PROJECTS_DIR","PROJECTS_JSON","SETFARM_DIR","SETFARM_OPERATIONAL_WRITE_TOKEN","SETFARM_PG_URL","SETFARM_REPO_DIR","SETFARM_URL"]`; each is already in unsigned-UTF-8 order. Missing, duplicate, reordered, or extra keys and every unknown key block. `PATH` uses grammar `colon_path_list`; `CLI_PATH|PROJECTS_DIR|SETFARM_DIR|SETFARM_REPO_DIR` use `absolute_path`; `PROJECTS_JSON` uses `absolute_file_path`; `MC_INTERNAL_URL|SETFARM_URL` use `absolute_http_url`; `MC_HOST` uses `host_scalar`; `MC_PORT` uses `decimal_port_scalar`; `SETFARM_OPERATIONAL_WRITE_TOKEN` uses `opaque_secret_scalar`; and `SETFARM_PG_URL` uses `postgresql_connection_url`. PATH-list and absolute/path/URL fields use their exact structural tokenizers. Host, port, token, and database URL are secret-redacted scalars with exact raw-value hashes and a conservative path/URL token scan; the database URL additionally uses its structural URL components without persisting them. Every environment entry satisfies `valueHash===classificationCommitment.rawValueHash`, exact name/source/field ordinal, the declared grammar/classification/tokenization/scan policy, `exposure:"redacted_secret"`, and `rawValue:null`; raw secret values are never persisted. The general stored grammar remains opaque, but Mission Control loaded-endpoint authentication additionally requires the transient raw operational token to be a string with JavaScript `length >= 32` and to survive the fixed Node HTTP header write exactly.

Every config projection has one exact coverage tuple: effective Program ordinal zero, each ordered argument at its zero-based ordinal, working directory ordinal zero, and each exact environment name at its tuple ordinal. `{source,sourceName,fieldOrdinal}` is unique and exact; missing, duplicate, reordered, or extra coverage rejects the proof. Nonsecret effective-Program/argv/working-directory fields take `exposure:"nonsecret"` with exact raw string and hash. Tokenization is frozen by the field contract: none has zero tokens; single has exactly ordinal-zero token; colon-list splits on literal `:` preserving empty segments and records exactly one ordinal per segment, with an empty segment resolving to the effective working directory; URL and conservative scans record their complete deterministic token projection. Token hashes, path/nonpath class, bounded hops, final-realpath hash, and `outsideCandidateAndQuarantine:true` are stored. `noCandidateReference:true` is the publication-time observer conclusion covered by the proof hash, not a claim that history reconstructs a secret from its hash. Historical resolution strict-parses/re-hashes commitments and exact coverage only. Raw environment values and raw launchctl/plutil output are never stored. Any parse ambiguity, coverage/tokenization violation, forbidden loaded-default state, environment/path reference, timeout, overflow, PID/start/process drift, expected/observed source inequality, symlink swap, or generation drift blocks. Freshness is procedural re-execution and ordering, never a timestamp or nonce. `prepare` binds phase `prepare`; resume binds separate `pre_disposition` immediately before rename and `post_quarantine` after rename against the destination identity.

```typescript
export type PlatformBuildGenerationLaunchAgentLabelV1 =
  | "com.setrox.setfarm-spawner"
  | "com.setrox.setfarm-dashboard"
  | "com.setrox.mission-control";
export type PlatformBuildGenerationRedactedEnvironmentEntryV1<
  Name extends string = string,
> = Readonly<{
  name: Name;
  valueHash: Sha256V1;
  classificationCommitment:
    PlatformBuildGenerationPathResolutionCommitmentBaseV1 & Readonly<{
      source: "environment"; sourceName: Name;
      valueGrammar:
        | "colon_path_list"
        | "absolute_path"
        | "absolute_file_path"
        | "absolute_http_url"
        | "host_scalar"
        | "decimal_port_scalar"
        | "opaque_secret_scalar"
        | "postgresql_connection_url";
      scanPolicy: "none-v1" | "conservative-path-and-url-token-scan-v1";
      exposure: "redacted_secret"; rawValue: null; rawValueRedacted: true;
    }>;
  noCandidateReference: true;
}>;
type PlatformBuildGenerationPathResolutionCommitmentBaseV1 = Readonly<{
  source: "effective_program" | "argument" | "working_directory" | "environment";
  sourceName: string | null;
  fieldOrdinal: number;
  rawValueHash: Sha256V1;
  classification:
    | "not_path_bearing"
    | "single_path"
    | "path_list"
    | "absolute_url"
    | "scalar"
    | "database_url";
  tokenization:
    | "none-v1"
    | "single-v1"
    | "colon-path-list-v1"
    | "url-components-v1"
    | "conservative-path-url-scan-v1"
    | "database-url-components-and-conservative-scan-v1";
  tokenCommitments: readonly Readonly<{
    tokenOrdinal: number;
    tokenHash: Sha256V1;
    tokenKind: "path" | "url" | "nonpath";
    emptyPathListSegment: boolean;
    resolutionKind:
      | "absolute"
      | "effective_working_directory_relative"
      | "not_applicable";
    symlinkHops: readonly Readonly<{
      devDecimal: string; inoDecimal: string; mode: number; linkCount: number;
      lexicalLocatorHash: Sha256V1; resolvedLocatorHash: Sha256V1;
    }>[];
    finalRealpathHash: Sha256V1 | null;
    outsideCandidateAndQuarantine: true;
  }>[];
}>;
export type PlatformBuildGenerationPathResolutionCommitmentV1 =
  PlatformBuildGenerationPathResolutionCommitmentBaseV1 &
    (| Readonly<{
         exposure: "redacted_secret";
         rawValue: null;
         rawValueRedacted: true;
       }>
     | Readonly<{
         exposure: "nonsecret";
         rawValue: string;
         rawValueRedacted: false;
       }>);
export type PlatformBuildGenerationLoadedWorkingDirectoryObservationV1 =
  | Readonly<{ kind: "absent_launchd_default"; reported: null; effective: "/" }>
  | Readonly<{ kind: "reported_launchd_default"; reported: "/"; effective: "/" }>
  | Readonly<{ kind: "explicit"; reported: string; effective: string }>;
export type PlatformBuildGenerationLoadedProgramObservationV1 =
  | Readonly<{ kind: "explicit"; reported: string; effective: string }>
  | Readonly<{
      kind: "derived_program_arguments_0";
      reported: null;
      effective: string;
    }>;
export type PlatformBuildGenerationExpectedSetfarmSourcePairV1 = Readonly<{
  sourceSha: GitObjectHashV1;
  sourceTreeHash: GitObjectHashV1;
  controllerBuildHash: Sha256V1;
}>;
export type PlatformBuildGenerationExpectedSetfarmRuntimeSourceV1<
  Label extends "com.setrox.setfarm-spawner" | "com.setrox.setfarm-dashboard",
> = Readonly<{
  label: Label;
  provenance: "operation_current_oa17_setfarm_source_build";
  sourcePair: PlatformBuildGenerationExpectedSetfarmSourcePairV1;
  sourceBody: InternalProductionCleanSetfarmSourceBuildV1;
}>;
export type PlatformBuildGenerationExpectedMissionControlRuntimeSourceV1 =
  Readonly<{
    label: "com.setrox.mission-control";
    provenance: "operation_embedded_expected_pba_v2_current_source";
    sourcePair: ProductBuildAuthorityV2DeliveryEvidencePairV1;
    sourceBody: ProductBuildAuthorityV2DeliveryEvidenceObservationV1;
  }>;
export type PlatformBuildGenerationExpectedRuntimeSourceV1 =
  | PlatformBuildGenerationExpectedSetfarmRuntimeSourceV1<
      "com.setrox.setfarm-spawner"
    >
  | PlatformBuildGenerationExpectedSetfarmRuntimeSourceV1<
      "com.setrox.setfarm-dashboard"
    >
  | PlatformBuildGenerationExpectedMissionControlRuntimeSourceV1;
export type PlatformBuildGenerationExpectedRuntimeSourcesV1 = readonly [
  PlatformBuildGenerationExpectedSetfarmRuntimeSourceV1<
    "com.setrox.setfarm-spawner"
  >,
  PlatformBuildGenerationExpectedSetfarmRuntimeSourceV1<
    "com.setrox.setfarm-dashboard"
  >,
  PlatformBuildGenerationExpectedMissionControlRuntimeSourceV1,
];
export type PlatformBuildGenerationEnvironmentNameTupleV1<
  Label extends PlatformBuildGenerationLaunchAgentLabelV1,
> = Label extends "com.setrox.setfarm-spawner"
  ? readonly ["PATH", "SETFARM_PG_URL"]
  : Label extends "com.setrox.setfarm-dashboard"
    ? readonly ["PATH", "SETFARM_OPERATIONAL_WRITE_TOKEN", "SETFARM_PG_URL"]
    : readonly [
        "CLI_PATH", "MC_HOST", "MC_INTERNAL_URL", "MC_PORT", "PATH",
        "PROJECTS_DIR", "PROJECTS_JSON", "SETFARM_DIR",
        "SETFARM_OPERATIONAL_WRITE_TOKEN", "SETFARM_PG_URL",
        "SETFARM_REPO_DIR", "SETFARM_URL",
      ];
export type PlatformBuildGenerationEnvironmentTupleV1<
  Label extends PlatformBuildGenerationLaunchAgentLabelV1,
> = Readonly<{
  [Ordinal in keyof PlatformBuildGenerationEnvironmentNameTupleV1<Label>]:
    PlatformBuildGenerationEnvironmentNameTupleV1<Label>[Ordinal] extends string
      ? PlatformBuildGenerationRedactedEnvironmentEntryV1<
          PlatformBuildGenerationEnvironmentNameTupleV1<Label>[Ordinal]
        >
      : never;
}>;
export const PLATFORM_BUILD_GENERATION_ENVIRONMENT_NAMES_BY_LABEL_V1 = {
  "com.setrox.setfarm-spawner": ["PATH", "SETFARM_PG_URL"],
  "com.setrox.setfarm-dashboard": [
    "PATH", "SETFARM_OPERATIONAL_WRITE_TOKEN", "SETFARM_PG_URL",
  ],
  "com.setrox.mission-control": [
    "CLI_PATH", "MC_HOST", "MC_INTERNAL_URL", "MC_PORT", "PATH",
    "PROJECTS_DIR", "PROJECTS_JSON", "SETFARM_DIR",
    "SETFARM_OPERATIONAL_WRITE_TOKEN", "SETFARM_PG_URL",
    "SETFARM_REPO_DIR", "SETFARM_URL",
  ],
} as const;
export const PLATFORM_BUILD_GENERATION_ENVIRONMENT_FIELD_CONTRACTS_V1 = {
  PATH: {
    valueGrammar: "colon_path_list", classification: "path_list",
    tokenization: "colon-path-list-v1", scanPolicy: "none-v1",
  },
  CLI_PATH: {
    valueGrammar: "absolute_path", classification: "single_path",
    tokenization: "single-v1", scanPolicy: "none-v1",
  },
  PROJECTS_DIR: {
    valueGrammar: "absolute_path", classification: "single_path",
    tokenization: "single-v1", scanPolicy: "none-v1",
  },
  PROJECTS_JSON: {
    valueGrammar: "absolute_file_path", classification: "single_path",
    tokenization: "single-v1", scanPolicy: "none-v1",
  },
  SETFARM_DIR: {
    valueGrammar: "absolute_path", classification: "single_path",
    tokenization: "single-v1", scanPolicy: "none-v1",
  },
  SETFARM_REPO_DIR: {
    valueGrammar: "absolute_path", classification: "single_path",
    tokenization: "single-v1", scanPolicy: "none-v1",
  },
  MC_INTERNAL_URL: {
    valueGrammar: "absolute_http_url", classification: "absolute_url",
    tokenization: "url-components-v1", scanPolicy: "none-v1",
  },
  SETFARM_URL: {
    valueGrammar: "absolute_http_url", classification: "absolute_url",
    tokenization: "url-components-v1", scanPolicy: "none-v1",
  },
  MC_HOST: {
    valueGrammar: "host_scalar", classification: "scalar",
    tokenization: "conservative-path-url-scan-v1",
    scanPolicy: "conservative-path-and-url-token-scan-v1",
  },
  MC_PORT: {
    valueGrammar: "decimal_port_scalar", classification: "scalar",
    tokenization: "conservative-path-url-scan-v1",
    scanPolicy: "conservative-path-and-url-token-scan-v1",
  },
  SETFARM_OPERATIONAL_WRITE_TOKEN: {
    valueGrammar: "opaque_secret_scalar", classification: "scalar",
    tokenization: "conservative-path-url-scan-v1",
    scanPolicy: "conservative-path-and-url-token-scan-v1",
  },
  SETFARM_PG_URL: {
    valueGrammar: "postgresql_connection_url", classification: "database_url",
    tokenization: "database-url-components-and-conservative-scan-v1",
    scanPolicy: "conservative-path-and-url-token-scan-v1",
  },
} as const;
export type PlatformBuildGenerationMissionControlProcessFenceV1 = Readonly<{
  schema: "setfarm.platform-build-generation-mission-control-process-fence.v1";
  launchctlPid: number;
  processLstart: string;
  processGroupId: number;
  initialLaunchctlBytesHash: Sha256V1;
  initialPsBytesHash: Sha256V1;
  finalLaunchctlBytesHash: Sha256V1;
  finalPsBytesHash: Sha256V1;
}>;
export type PlatformBuildGenerationMissionControlListenerFenceV1 = Readonly<{
  schema: "setfarm.platform-build-generation-mission-control-listener-fence.v1";
  port: 3080;
  protocol: "TCP";
  state: "LISTEN";
  listenerPid: number;
  command: string;
  fileDescriptor: number;
  endpoint: "127.0.0.1:3080" | "[::1]:3080" | "*:3080";
  initialLsofBytesHash: Sha256V1;
  finalLsofBytesHash: Sha256V1;
}>;
export type PlatformBuildGenerationMissionControlLoadedBuildProofV1 = Readonly<{
  schema: "setfarm.platform-build-generation-mission-control-loaded-build-proof.v1";
  endpoint:
    "http://127.0.0.1:3080/api/internal-production/product-build-authority-v2-loaded-build";
  processFence: PlatformBuildGenerationMissionControlProcessFenceV1;
  listenerFence: PlatformBuildGenerationMissionControlListenerFenceV1;
  response: ProductBuildAuthorityV2LoadedBuildResponseV1;
}>;
export type PlatformBuildGenerationLaunchAgentConfigProofV1<
  Locator extends string,
  Label extends PlatformBuildGenerationLaunchAgentLabelV1,
  PlistWorkingDirectory extends string | null,
> = Readonly<{
  locator: Locator;
  label: Label;
  launchctlExecutable: "/bin/launchctl";
  launchctlDomain: `gui/${number}`;
  expectedRuntimeSource:
    Extract<PlatformBuildGenerationExpectedRuntimeSourceV1, { label: Label }>;
  plistProjection: Readonly<{
    program: null;
    effectiveProgram: string;
    workingDirectory: PlistWorkingDirectory;
    programArguments: readonly [string, ...string[]];
    environment: PlatformBuildGenerationEnvironmentTupleV1<Label>;
    pathResolutionCommitments: readonly PlatformBuildGenerationPathResolutionCommitmentV1[];
  }>;
  loadedJobProjection: Readonly<{
    program: PlatformBuildGenerationLoadedProgramObservationV1;
    workingDirectory: PlatformBuildGenerationLoadedWorkingDirectoryObservationV1;
    programArguments: readonly [string, ...string[]];
    environment: PlatformBuildGenerationEnvironmentTupleV1<Label>;
    pathResolutionCommitments: readonly PlatformBuildGenerationPathResolutionCommitmentV1[];
    loadedProcess: Readonly<{
      pid: number; processLstart: string; processGroupId: number;
      processIdentityHash: Sha256V1;
      executableRealpathHash: Sha256V1;
      entrypointRealpathHash: Sha256V1;
      sourceSha: GitObjectHashV1; sourceTreeHash: GitObjectHashV1;
      controllerBuildHash: Sha256V1; serviceGenerationHash: Sha256V1;
      actualGenerationAuthenticated: true;
      missionControlLoadedBuildProof:
        Label extends "com.setrox.mission-control"
          ? PlatformBuildGenerationMissionControlLoadedBuildProofV1
          : null;
      expectedObservedFieldEqualityHash: Sha256V1;
    }>;
  }>;
  plistBytesHash: Sha256V1;
  launchctlBytesHash: Sha256V1;
  projectionHash: Sha256V1;
  noCandidateReference: true;
}>;
export type PlatformBuildGenerationZeroReferenceProofV1 = Readonly<{
  schema: "setfarm.platform-build-generation-zero-reference-proof.v1";
  phase: "prepare" | "pre_disposition" | "post_quarantine";
  operation: PlatformBuildGenerationRetentionOperationPairV1 | null;
  candidateCompletion: PlatformBuildGenerationRotationCompletionPairV1;
  observedUid: number;
  candidate: Readonly<{
    locator: string;
    rootPhysicalIdentity:
      PlatformBuildGenerationInventoryV1["rootPhysicalIdentity"];
    physicalInventoryHash: Sha256V1;
  }>;
  lsofExecutable: "/usr/sbin/lsof";
  lsofArgvContract:
    "setfarm.lsof-no-reference-argv.-nP.-F0.+D-candidate.v1";
  exitStatus: 1;
  stdoutHash:
    "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";
  stderrHash:
    "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";
  launchAgentConfigs: readonly [
    PlatformBuildGenerationLaunchAgentConfigProofV1<
      "/Users/setrox/Library/LaunchAgents/com.setrox.setfarm-spawner.plist",
      "com.setrox.setfarm-spawner",
      null
    >,
    PlatformBuildGenerationLaunchAgentConfigProofV1<
      "/Users/setrox/Library/LaunchAgents/com.setrox.setfarm-dashboard.plist",
      "com.setrox.setfarm-dashboard",
      null
    >,
    PlatformBuildGenerationLaunchAgentConfigProofV1<
      "/Users/setrox/Library/LaunchAgents/com.setrox.mission-control.plist",
      "com.setrox.mission-control",
      "/Users/setrox/ai/setrox/mission-control"
    >,
  ];
  proofHash: Sha256V1;
}>;
export type PlatformBuildGenerationRetentionOperationCoreV1 = Readonly<{
  schema: "setfarm.platform-build-generation-retention-operation.v1";
  purpose: "permanently-dispose-lowest-completed-build-generation-v1";
  candidateCompletion: PlatformBuildGenerationRotationCompletionPairV1;
  candidateOrdinal: number;
  sourceBuild: InternalProductionCleanSetfarmSourceBuildV1;
  productBuildAuthorityV2DeliveryEvidence:
    ProductBuildAuthorityV2DeliveryEvidencePairV1;
  productBuildAuthorityV2Observation:
    ProductBuildAuthorityV2DeliveryEvidenceObservationV1;
  expectedRuntimeSources: PlatformBuildGenerationExpectedRuntimeSourcesV1;
  executingImplementationClosure: Readonly<{
    schema: "setfarm.platform-build-generation-retention-executing-closure.v1";
    moduleRootKind: "code_derived_import_meta";
    moduleRootRepositoryLocator: ".";
    entryLocator: "scripts/build-generation-retention.mjs";
    maxModuleCount: 256;
    maxImportEdgeCount: 2_048;
    maxLocatorUtf8Octets: 1_024;
    maxModuleBytes: 1_048_576;
    maxTotalModuleBytes: 16_777_216;
    entries: readonly Readonly<{
      locator: string;
      gitMode: "100644" | "100755";
      gitBlobHash: GitObjectHashV1;
      byteLength: number;
      sha256: Sha256V1;
    }>[];
    importEdges: readonly Readonly<{
      importerLocator: string;
      literalSpecifier: `./${string}` | `../${string}`;
      importedLocator: string;
    }>[];
    nodeBuiltinSpecifiers: readonly `node:${string}`[];
    closureHash: Sha256V1;
  }>;
  candidateArchiveLocator:
    `.setfarm/build-generations-v1/${LowercaseUuidV4}.dist`;
  candidateArchiveIdentity: PlatformBuildGenerationDirectoryIdentityV1;
  candidateInventory: PlatformBuildGenerationInventoryV1;
  prepareZeroReferenceProof: PlatformBuildGenerationZeroReferenceProofV1;
  prepareZeroReferenceProofHash: Sha256V1;
}>;
export type PlatformBuildGenerationRetentionOperationV1 = Readonly<{
  operationCore: PlatformBuildGenerationRetentionOperationCoreV1;
  expectedQuarantineLocator:
    `.setfarm/build-generation-quarantine-v1/${Sha256V1}.dist`;
  operationRef: CanonicalRef;
  operationHash: Sha256V1;
}>;
export type PlatformBuildGenerationRetentionOperationPairV1 = Readonly<{
  operationRef: CanonicalRef;
  operationHash: Sha256V1;
}>;
export type PlatformBuildGenerationRetentionReceiptV1 = Readonly<{
  schema: "setfarm.platform-build-generation-retention-receipt.v1";
  operationRef: CanonicalRef;
  operationHash: Sha256V1;
  preDispositionZeroReferenceProof:
    PlatformBuildGenerationZeroReferenceProofV1;
  preDispositionZeroReferenceProofHash: Sha256V1;
  sourceAbsent: true;
  quarantineLocator:
    `.setfarm/build-generation-quarantine-v1/${Sha256V1}.dist`;
  quarantineIdentity: PlatformBuildGenerationDirectoryIdentityV1;
  quarantineInventory: PlatformBuildGenerationInventoryV1;
  postQuarantineZeroReferenceProof:
    PlatformBuildGenerationZeroReferenceProofV1;
  postQuarantineZeroReferenceProofHash: Sha256V1;
  permanentDisposition: true;
  erasedEntryCount: number;
  erasedRegularFileByteCount: number;
  finalEraseStepRef: CanonicalRef;
  finalEraseStepHash: Sha256V1;
  quarantineAbsent: true;
  receiptRef: CanonicalRef;
  receiptHash: Sha256V1;
}>;
export type PlatformBuildGenerationRetentionReceiptPairV1 = Readonly<{
  receiptRef: CanonicalRef;
  receiptHash: Sha256V1;
}>;
```

Both decoders first represent generic `workingDirectory` as exactly `string | null`; label validation then requires spawner/dashboard plist null and Mission Control's literal, while the loaded job uses its independent default/explicit union. All plist `program` members are null, each plist/loaded argument tuple is nonempty, and plist effective Program, both argument-zero values, and the loaded explicit-or-derived effective Program are equal after bounded resolution. Each fixed config embeds the strict redacted plist/loaded-job and actual-process-generation projections described above. Raw environment values are never a receipt member; each exact label-ordered environment commitment, nonsecret structured path-resolution commitment, loaded process projection, and both redacted projections enter `projectionHash`. Historical parsing verifies those stored canonical commitments and their observation-time `noCandidateReference:true`; it never pretends that a raw secret path can be rederived from `valueHash`. Every proof's `candidateCompletion` equals the operation core's exact pair; the prepare proof has null operation, and both resume proofs equal the derived operation pair.

The operation parser requires `expectedRuntimeSources` to have exactly the three declared labels in order. Tuple entries zero and one must have byte-identical `sourceBody===sourceBuild`, identical `sourcePair`, and each pair field equal the corresponding body SHA/tree/build field. Entry two's pair/body must byte-equal the operation's PBA pair/body, and the pair must equal `sourceBody.response.{deliveryEvidenceRef,deliveryEvidenceHash}` and its evidence pair. Each launch-agent proof's `expectedRuntimeSource` must byte-equal its indexed operation entry; no proof or loaded observation may introduce another expected body. Spawner and dashboard require `missionControlLoadedBuildProof:null`. Mission Control requires the strict non-null proof, exact endpoint, recomputed response hash/ref, response PID equal to `processFence.launchctlPid` and `listenerFence.listenerPid`, equal initial/final observation hashes, and loaded build-identity source/tree/build equal to the embedded expected current source. Its `serviceGenerationHash` is exactly `hashCanonicalJson({schema:"setfarm.platform-build-generation-loaded-service-generation.v1",label:"com.setrox.mission-control",startupInstance:response.startupInstance,loadedBuild:response.loadedBuild,processFence,listenerFence})` in that declared order. These relations are checked before `expectedObservedFieldEqualityHash`, `projectionHash`, `proofHash`, or `operationHash` is accepted.

Each proof hash is `hashCanonicalJson` over its entire body except `proofHash`; both empty stream hashes equal SHA-256 of zero bytes, and the three config projection hashes are recomputable from the strict redacted plist/launchctl projections. Phase/context equality is strict: prepare has `operation:null`, while both resume proofs bind the exact operation pair. `operationHash=hashCanonicalJson(operationCore)`; the operation ref is `setfarm://internal-production/build-generation-retention-operation/sha256/${operationHash}`. Only after deriving that hash does the publisher derive `expectedQuarantineLocator=.setfarm/build-generation-quarantine-v1/${operationHash}.dist`; that derived locator is not in `operationCore`, avoiding a recursive fixed point, and the parser must rederive it. `receiptHash` excludes only its own ref/hash and its ref is `setfarm://internal-production/build-generation-retention-receipt/sha256/${receiptHash}`.

Current clean source/build/PBA equality is required exactly once, before `retention_prepare` performs the first retention mutation. The immutable operation then binds the exact canonical executing closure above. The module root is derived only by walking from the real executing `import.meta.url` entrypoint to the authenticated repository root; `moduleRootRepositoryLocator:"."` and the literal entry locator are fixed, never caller paths. Entries are unique and globally unsigned-UTF-8 locator sorted; edges are sorted by importer/specifier/imported locator; explicit `node:` builtins are unique sorted separately and are not filesystem entries. Counts, locator bytes, per-module bytes, and total bytes obey the literal caps in the body. Static source parsing accepts only literal relative `./|../` import/export specifiers resolved with exact Node ESM extension rules to an in-root regular entry, plus explicit `node:` builtins. It rejects dynamic `import()`, computed/nonliteral specifiers, bare packages, absolute/file URLs, implicit extension/directory-index guessing, symlink escape, duplicate/cycle ambiguity, and any resolved out-of-root member.

Before the first mutation every closure entry's `gitMode/gitBlobHash` must equal the exact `sourceBuild` commit tree entry and its bytes must reproduce both Git blob and `sha256`; after mutation the same equality is replayed only from the stored historical Git objects. `closureHash=hashCanonicalJson({schema,moduleRootKind,moduleRootRepositoryLocator,entryLocator,maxModuleCount,maxImportEdgeCount,maxLocatorUtf8Octets,maxModuleBytes,maxTotalModuleBytes,entries,importEdges,nodeBuiltinSpecifiers})` in that declared order. Every `resume` pair-resolves the operation/candidate, derives the actual module root from its executing entrypoint, re-enumerates the transitive closure with this grammar, and requires byte/mode/blob/locator/edge/builtin/cap/hash equality before its next mutation. It never requires today's HEAD, worktree, build, or PBA to equal the historical operation. Missing historical object, untracked module, unsupported import, or closure mismatch blocks; a later clean-main advance does not.

Resume first reopens the explicit operation pair, candidate index, maintenance lock, completion, historical source/closure proof, and exhaustive inventory, and resolves the entire erase intent/completion chain before classifying archive-versus-quarantine rename state. With no erase step, source-present/quarantine-absent obtains the exact pre-disposition proof and performs the fixed rename; source-absent/quarantine-exact adopts the rename; both present blocks, and both absent is corruption unless authenticated erase-prefix state below proves progress. With an erase prefix, the observed remaining quarantine dirents must equal exactly the original inventory minus that authenticated prefix; the archive must be absent and an unexpected archive or unknown/replacement dirent blocks. It obtains the distinct post-quarantine proof before the first erase. Deletion is a fixed bounded no-follow order over the root-excluded global inventory tuple: regular files in reverse tuple order; then directories by descending path depth and, within equal depth, reverse unsigned-UTF-8 locator order; then the bound root last. Before each file unlink it reopens exact parent plus `{dev,ino,mode,linkCount:1,byteLength,sha256}`. Before each directory/root `rmdir` it requires the exact expected remaining dirent subset, exact `{dev,ino,mode}`, and a fresh opaque positive-safe-integer link snapshot stable through that phase's immediate reopen; it never derives a directory link count from children. Every primitive is parent-fsynced and followed by exact remaining-subset re-enumeration. OA17 depth/locator/entry/file/total caps reset for this candidate during every such enumeration. No recursive API, glob, shell, symlink follow, path accepted from argv, unlisted entry, partial-inventory success, or `force` path exists.

Before each `unlink|rmdir`, resume publishes/reopens that ordinal's immutable erase-step intent; after the destructive call, parent fsync, and exact absence/remaining-inventory reopen it publishes/reopens the corresponding completion. A crash before the intent cannot delete that entry. An unmatched non-root intent is adopted only when the exact target is absent and the current remaining dirent subset/identities equal the intent's exact post-state; target present with the exact pre-state resumes the action. Any expected absence without a matching completed or uniquely unmatched intent prefix, unknown/replacement entry, wrong predecessor, second same-ordinal step, or subset drift is corruption.

The terminal suffix is one exact automaton resolved before any new effect: (1) authentic unmatched root intent + archive absent + quarantine absent + exact empty remaining subset publishes/adopts only the root completion; (2) exact root completion + absent receipt publishes/adopts only the receipt; (3) exact receipt + absent disposition publishes/adopts only the disposition; (4) exact disposition is terminal and alone permits exact `retention_resume` lock release. At every state all earlier pairs must reopen and all later records must be absent. Root completion plus an existing unequal receipt, receipt without its root completion, disposition without its exact receipt, a fork/extra suffix record, or both endpoints absent without one of these authenticated prefixes is corruption. The root completion is the receipt's exact `finalEraseStepRef/Hash`; retry never repeats deletion or skips a suffix edge.

Only after quarantine absence does resume publish/reopen the permanent receipt and exact ordinal/UUID disposition, then release the exact `retention_resume` lock. The receipt's erase counters must equal the bound inventory's `entryCount` and `regularFileByteCount`; the disposition binds the deleted physical/content inventory and `quarantineAbsent:true`, never claims a currently existing quarantine. Response-loss recovery adopts only that exact prefix. The writer accepts a completed ordinal in exactly one terminal state: its exact active archive exists with no disposition, or its archive is absent and the strict disposition resolves through the same operation/receipt/candidate pairs with exact `quarantineAbsent:true` proof. Both/neither is corruption. There is no restore, erase command, second authorization, silent deletion, `rm -rf`, `recursive:true`, arbitrary unlink traversal, or force path: permanent deletion occurs only inside pair-only `resume` and cannot be reversed.

The first current-entry prerequisite records are strict immutable bodies, not invented PR receipts or build artifacts. PR #86 delivered only merge commit `1d691c89760339ea905dfe17f8e9188e62603c1c` with tree `04f1d95a58360d06e866fe816138655efa916284` plus exact Git ancestry to the current OA17 source; there is no separate delivered Authority-V3 receipt or historical build. `AuthorityV3ContractSpineThroughMigration31AuditV1["migrations"]` must be exactly 31 ordered records, versions 1 through 31, each `migrationClass:"automatic"`, each `state:"applied"|"adopted"`, with its exact source name and checksum. `currentAuthorityAudit` is the full strict `CurrentContractSpineAuthorityLedgersAuditV2` returned by `auditCurrentContractSpineAuthorityLedgersAtV31Data`, including its real count, tail, authority, timestamp, and binding facts; no identity-only projection replaces it.

```typescript
export type InternalProductionAuthorityV3Migration31AuditV1 = Readonly<{
  schema: "setfarm.internal-production-authority-v3-migration31-audit.v1";
  currentStatus: "current";
  controllerSource: InternalProductionCleanSetfarmSourceBuildV1;
  pr86Delivery: Readonly<{
    pullRequestNumber: 86;
    mergeSha: "1d691c89760339ea905dfe17f8e9188e62603c1c";
    mergeTreeHash: "04f1d95a58360d06e866fe816138655efa916284";
    descendantSha: GitObjectHashV1;
    descendantTreeHash: GitObjectHashV1;
    expectedMergeBase: "1d691c89760339ea905dfe17f8e9188e62603c1c";
  }>;
  authorityV3ContractSpineThroughMigration31:
    AuthorityV3ContractSpineThroughMigration31AuditV1;
  currentAuthorityAudit: CurrentContractSpineAuthorityLedgersAuditV2;
  currentAuthorityAuditHash: Sha256V1;
  migration31SemanticDigest: Sha256V1;
  migration31SourceManifestEntryHash: Sha256V1;
  authorityV3Migration31AuditRef: CanonicalRef;
  authorityV3Migration31AuditHash: Sha256V1;
}>;
export type InternalProductionPendingBootstrapHandoffMigrationProjectionV1 =
  Readonly<{
    schema:
      "setfarm.internal-production-pending-bootstrap-handoff-migration-projection.v1";
    currentStatus: "current";
    controllerSource: InternalProductionCleanSetfarmSourceBuildV1;
    pendingSuccessor:
      PendingBootstrapMainClaimHandoffGuardedSuccessorV1;
    migrationImplementation: Readonly<{
      locator: "src/db/bootstrap-main-claim-handoff-v1-migration.ts";
      gitMode: "100644";
      gitBlobHash: GitObjectHashV1;
    }>;
    pendingBootstrapHandoffMigrationRef: CanonicalRef;
    pendingBootstrapHandoffMigrationHash: Sha256V1;
  }>;
export type InternalProductionCurrentEntryOperationV1 = Readonly<{
  schema: "setfarm.internal-production-current-entry-operation.v1";
  purpose: "task6a-internal-production-current-entry-v1";
  controllerSource: InternalProductionCleanSetfarmSourceBuildV1;
  productBuildAuthorityV2DeliveryEvidence:
    ProductBuildAuthorityV2DeliveryEvidencePairV1;
  productBuildAuthorityV2Observation:
    ProductBuildAuthorityV2DeliveryEvidenceObservationV1;
  authorityV3Migration31Audit:
    InternalProductionAuthorityV3Migration31AuditPairV1;
  pendingBootstrapHandoffMigration:
    InternalProductionPendingBootstrapHandoffMigrationProjectionPairV1;
  operationRef: CanonicalRef;
  operationHash: Sha256V1;
}>;
export function observePreparedInternalProductionCurrentEntryOperationV1():
  Promise<InternalProductionCurrentEntryOperationV1 | null>;
```

`pr86Delivery.descendantSha` and `descendantTreeHash` equal `controllerSource.sha` and `.treeHash`; `replayV3HistoricalGitCommitAncestryV1` must reopen the fixed merge commit/tree and prove its singleton merge base equals the fixed merge SHA.

`currentAuthorityAuditHash` is exactly `hashCanonicalJson(currentAuthorityAudit)`. `migration31SemanticDigest` is exactly `CONTRACT_SPINE_SEMANTIC_MIGRATION_DIGESTS[31]`; `migration31SourceManifestEntryHash` is exactly `hashCanonicalJson(CONTRACT_SPINE_SEMANTIC_MIGRATION_SOURCE_MANIFEST[31])`, not a vague full-manifest hash. The pending body embeds exactly the real inspector output: the sole ordinal-32 migration record, name `contract-spine-bootstrap-main-claim-handoff-v1`, exact checksum, class `guarded`, state `pending`, and its `migrationDigest`, `namedMigrationDigestEntryHash`, `orderedStatementsHash`, and `expectedSchemaProjectionHash`. It adds only the code-owned current-HEAD Git entry for `src/db/bootstrap-main-claim-handoff-v1-migration.ts`; no second source-integrity or implementation digest is invented.

Each body hash is `hashCanonicalJson` over every shown member except its own ref/hash. Their exact prefixes are `setfarm://internal-production/authority-v3-migration31-audit/sha256/`, `setfarm://internal-production/pending-bootstrap-handoff-migration/sha256/`, and `setfarm://internal-production/current-entry-operation/sha256/`. The fixed store is `/Users/setrox/ai/setrox/data/internal-production-baseline/current-entry-v1`, never `.setfarm`, with exact real `0o700` directories and exactly three fixed files: `authority-v3-migration31-audit.json`, `pending-bootstrap-handoff-migration.json`, and `current-entry-operation.json`. Each is canonical JSON plus one LF, at most 1,048,576 bytes, one no-follow regular `0o600` link and uses the common grammar-bounded no-replace recovery automaton above, including fixed-plus-same-inode normalization, exact complete-temp resume, stable uncommitted-temp cleanup, all-other-shapes refusal, and the double-crash matrix. Historical resolvers accept only the exact pair, derive the one fixed locator from the pair kind, and never accept or scan for a path/body/latest record.

`observePreparedInternalProductionCurrentEntryOperationV1(): Promise<InternalProductionCurrentEntryOperationV1 | null>` is the sole code-owned current-operation read boundary. It accepts zero arguments and no root, locator, filesystem, pair, body, observer, resolver, SQL handle, or callback; its fixed repository/data/store locator and complete three-member family registry remain private. Importing the receipt module performs no filesystem, process, Git, PBA, database, or mutation work. A call performs one bounded no-follow, identity-stable physical inventory from validated code-owned ancestors through the real same-device exact-`0o700` store. Every present fixed family file must be a same-device no-follow regular exact-`0o600` one-link file of 1 through 1,048,576 bytes and must remain byte/descriptor/parent-identity stable across read and reopen. A missing store is absence only when its existing ancestors validate and no partial family path exists; a present valid store may contain the exact fixed v31 and pending siblings while the operation member is absent. Only either exact condition returns `null`. Any temporary, unknown or foreign entry, duplicate family member, symlink, hard link, special or wrong type, wrong mode, cross-device member, size violation, collision, or inventory/path/descriptor/byte drift throws the finite current-entry corruption failure and never degrades to `null`.

When the fixed operation exists, the observer reads only enough strict canonical bytes to obtain its exact `operationRef`/`operationHash`, calls the existing pair-only `resolveInternalProductionCurrentEntryOperationV1({operationRef,operationHash})`, and returns that byte-identical recursively frozen historical body. It does not define a second parser or relax the resolver. The call performs zero `mkdir`, write, `chmod`, link, unlink, rename, fsync, temporary-file recovery/cleanup/publication, random identifier generation, current source/PBA observation, PBA CLI/HTTP work, current v31/pending database observation, or database access. `prepareInternalProductionCurrentEntryOperationV1()` remains the sole Task 6A pre-mutation writer: it may create/adopt the operation only before the first live mutation, and no activation path may import or call it after migration 32 activation begins. The historical resolver remains pair-only and current-independent; the new observer does not turn historical pair resolution into a latest scan.

Once migration 32 is applied/current, `prepareInternalProductionCurrentEntryOperationV1()` is permanently forbidden; activation and recovery may use only the read-only accessor or exact historical pairs as specified for their respective boundaries.

`src/db-pg.ts` owns exactly two new narrow zero-input, purpose-specific composition ports: `auditCurrentInternalProductionAuthorityV3Migration31V1()` and `inspectCurrentInternalProductionPendingBootstrapHandoffMigrationV1()`. Internally they obtain `getSql()` and call only `auditAuthorityV3ContractSpineThroughMigration31V1`, `auditCurrentContractSpineAuthorityLedgersAtV31Data`, and `inspectPendingBootstrapMainClaimHandoffGuardedSuccessorV1`; they bypass `ensureSchemaReady` and normal `pgBegin`, cannot migrate/apply/mutate, accept no SQL/root/body/options, and never expose `getSql`.

The lock description must match the existing implementations exactly. The predecessor audit and pending inspector each use ordinary `sql.begin`, set transaction-local `search_path`, acquire `pg_advisory_xact_lock_shared(contractSpineMigrationLockKey)`, perform only reads, and release the shared transaction lock at transaction end; the plan does not mislabel that default transaction as `READ ONLY`. The full v31 current-authority audit separately reserves one connection, sets bounded session lock/statement timeouts, acquires the exclusive session lock `pg_advisory_lock(contractSpineMigrationLockKey)`, preflights the head/failure-cause identity, then begins `ISOLATION LEVEL REPEATABLE READ READ ONLY`. Inside it takes the existing `ACCESS SHARE` locks on `run_termination_requests`, `setfarm_schema_migrations`, and the full existing authority-ledger relation tuple before reading; it commits/rolls back, explicitly `pg_advisory_unlock`s, resets both timeouts, and destroys a poisoned session on cleanup failure. Tests assert these literal modes/order and reject an invented shared session lock, exclusive xact lock, omitted table lock, or generic “read-only/advisory” paraphrase. The current v31 port also requires exact pending-32 inspector success before return. Existing public `getSql` remains unrelated. `baseline-post-handoff-receipt-v1.ts` statically imports none of `db-pg.ts`, PostgreSQL, or the migration module; its zero-input current wrappers dynamically import exactly these two ports, preserving OA17 import-inertness.

Current auditors and historical resolvers are intentionally different. A current v31 publication reobserves the OA17 source/build, PR #86 Git objects/ancestry, exact 1..31 audit, full current-authority audit/body hash, migration-31 digest/source-manifest-entry hash, and exact pending-32 success. A current pending publication reobserves the same source/build, exact inspector output, and the pinned implementation mode/blob. Both current functions fail after migration 32 is applied. Their pair-only historical resolvers reopen and strict-parse stored immutable bytes, recompute body/hash/ref and Git ancestry where bound, and make no claim that today's database is still v31 or pending; they continue to resolve after migration 32. The operation resolver similarly reopens v31 and pending history. For PBA it does not call `resolveProductBuildAuthorityV2DeliveryEvidenceV1`, because that current resolver reobserves the source CLI: it strict-parses the stored `productBuildAuthorityV2Observation` through pure `parseProductBuildAuthorityV2DeliveryEvidenceResponseV1`, verifies observation schema/transport plus embedded response/pair/hash equality, and makes no current PBA claim. No separate PBA store/file is added.

Before the first restart or database mutation, and again on every recovery invocation, `resume-current-entry` authenticates its currently executing implementation from the code-derived module root: the loaded CLI/baseline/db-pg/migration JavaScript locators must be members of the finalized output-tree authority whose `controllerBuildHash`, source SHA/tree, pinned input set, and migration-32 source Git blob equal the operation's stored controller/pending authorities. A source checkout match without executing-build equality is insufficient. After migration 32 consumes the pending state, recovery never calls either current v31/pending wrapper again: it pair-resolves the stored v31, pending, operation, authorization, consumption, migration-32 receipt, and current-audit history, authenticates the executing implementation against the immutable operation, exact-verifies or resumes ordinary migration 33, and only then resumes A and the next durable phase. Tests crash immediately after migration-32 schema commit, after each receipt/current-audit publication, before/during migration 33, after its commit acknowledgement or acknowledgement loss, and after 33 is current before A; they may advance current DB/source independently and require historical recovery of the same operation without reapplying 32 or duplicating 33. A migration-33 pre-ack failure rolls back only its transaction; executing from a stale/different build blocks before mutation.

`prepare-current-entry` first resolves an existing operation pair historically and adopts it. Otherwise its exact zero-input order is OA17 source `S0` → current PBA observation/pair → current v31 audit/publish → current pending inspect/publish → OA17 source and PBA reobserve → require `S0`, PBA observation, full current-authority audit, v31 audit, and pending inspector byte equality → publish operation → historical pair resolution → final source/PBA/current-v31/current-pending equality fences. Operation publication therefore never smuggles in a stale source, database body, or PBA observation.

Only after that entry slice exists may A activation proceed. First add the strict A source-build body parser/hash/ref projection in import-inert owner core. New A creation resolves the current operation, current PBA, and current OA17 source/build and requires exact equality. Historical A resolution replays its embedded operation/PBA evidence and exact Git ancestry without current source/PBA/database equality. Then add the generic PostgreSQL source store, one shared non-exported activation core, the unchanged public generic activator, the exact controller-only A port, and the current resolver in `src/db-pg.ts`, followed by the zero-input A-only wrapper. The public generic activator's target classification remains the closed typed union `"SUPERSEDED" | "CORRUPTION"`; only the controller-specific port may privately remap exact candidate-drift sentinel identity. `InternalProductionBaselineOwnerProducerManifestActivationStatusV1` below is the sole canonical wrapper/CLI wire union; no prose-only or second status shape is permitted. PostgreSQL is the sole activation/store/current implementation; no filesystem substitute is permitted.

Every test of the two `src/db-pg.ts` current-entry wrappers, the A activation controller/store/current resolver, or any other path that opens real `getSql()` executes only inside `scripts/run-isolated-postgres-tests.ts` against its disposable exact-prefix database family. The only database variables in this contract are `SETFARM_TEST_PG_ADMIN_URL` and `SETFARM_PG_URL`: the runner accepts the former only as administrator input, rejects ambient child URL, creates one empty random template per one-file invocation, has the authenticated setup child apply/activate/verify and quiesce it, creates and verifies a primary by exact PostgreSQL template clone, exports only that primary as `SETFARM_PG_URL`, runs exactly `node --import tsx --test --test-concurrency=1 <one-file>`, and exact-prefix-cleans the primary, template, and every helper clone/empty leftover before another file starts. Standalone Node invocations of production-capable files use only the exact anchored pure/source/private-fake test-name filters frozen in the focused command under `env -u SETFARM_PG_URL -u SETFARM_TEST_PG_ADMIN_URL`; they fail immediately if either database variable, `getSql`, a socket, a production controller, or a production activation wrapper is reached. The isolated runner is the only gate allowed to exercise the actual PostgreSQL lock modes or PostgreSQL activation composition above.

The loaded-generation correction has two exact cross-repository RED/GREEN gates. Run the Mission Control gate from its isolated reconciliation worktree; `server/routes/setfarm-operational.test.ts` also reads or exercises the mapped `server/index.ts` composition. The gate covers module-evaluation A capture followed by disk/build-identity/source-CLI overwrite to B while the same response remains A, a fresh B module evaluation that differs, exact success body/hash/ref and exact unavailable shape, and load-bearing relative source order endpoint operational authenticator → canonical-marker-aware general `/api` auth → exact-path JSON-parser wrapper → loaded router/raw guard → API 404 → terminal boundary. It proves byte-exact canonical raw `req.originalUrl` target and parser-visible `req.path` acceptance; missing/short configured operational token exact `503 {status:"unavailable",code:"PRODUCT_BUILD_AUTHORITY_V2_LOADED_BUILD_AUTH_UNAVAILABLE"}`; missing/duplicate-coalesced/wrong/general-only credentials exact `401 {status:"unavailable",code:"PRODUCT_BUILD_AUTHORITY_V2_LOADED_BUILD_UNAUTHORIZED"}`; SHA-256 digest plus timing-safe comparison; a valid operational-only credential despite a distinct `AUTH_TOKEN`; authenticated-general alias 404 and zero snapshot access for every listed/composed mixed-case/slash/percent/dot form; operationally authenticated canonical HEAD 404 and zero snapshot access; unauthenticated canonical malformed/framed exact loaded 401; authenticated canonical malformed/framed, query, and literal request header `Content-Length: 0` exact 400; unchanged unrelated `/api` general authentication/parser/error behavior; frozen PID/instance; and the absence of request-time Git/test/CLI/filesystem/listen/write work:

```bash
set -euo pipefail
node --import tsx --test \
  server/routes/setfarm-operational.test.ts \
  server/services/product-build-authority-v2-delivery-evidence-v1.test.ts
npx tsc -p tsconfig.server.json --noEmit
```

Run the Setfarm loaded-consumer gate from this isolated worktree; it covers A-loaded/B-disk separation; the complete NUL-field/LF-set `-F0pcfn` grammar; exact `127.0.0.1:3080`, `[::1]:3080`, and `*:3080` acceptance; malformed/extra/reordered/multiple-listener/wrong-endpoint refusal; listener PID mismatch; PID/start/listener drift; stale or missing endpoint; a self-consistent crossed response/fence; fixed-plist/first-loaded/repeated-loaded operational-token raw-byte equality; a single transient `x-setfarm-operational-token` send; no durable/output/error raw token; no `AUTH_TOKEN` source; forbidden current/sibling CLI execution; exact finite proof-required failure; and historical resume from embedded expected authority plus the frozen loaded endpoint only. The manifest gate proves that this correction adds no Setfarm path and preserves the exact literal 109-path tuple:

```bash
set -euo pipefail
node --test scripts/__tests__/build-generation-retention.test.js
node --import tsx --test tests/internal-production/task-0-source-manifest.test.ts
node --check scripts/build-generation-retention.mjs
npx tsc -p tsconfig.json --noEmit
```

OA18 TDD first observes RED, then implements the loaded-generation correction, rotation ledger, retention, current records, and activation dependencies in that order. The complete exact focused commands remain:

```bash
set -euo pipefail
: "${SETFARM_TEST_PG_ADMIN_URL:?isolated-test PostgreSQL admin URL is required}"
test -z "${SETFARM_PG_URL:-}"
node --test scripts/__tests__/build-info-version.test.js
node --test scripts/__tests__/build-generation-retention.test.js
node --import tsx --test tests/execution-attempts/migration-source-digests.test.ts
env -u SETFARM_PG_URL -u SETFARM_TEST_PG_ADMIN_URL \
  node --import tsx --test \
  --test-name-pattern='^(pure current-entry parser rejects malformed status|source boundary keeps PostgreSQL imports lazy|private fake projects current-entry status|read-only prepared operation observer is exact and mutation-free)$' \
  tests/internal-production/baseline-post-handoff-receipt-v1.test.ts
env -u SETFARM_PG_URL -u SETFARM_TEST_PG_ADMIN_URL \
  node --import tsx --test \
  --test-name-pattern='^(pure activation parser rejects malformed status|source boundary keeps activation PostgreSQL imports lazy|private fake derives canonical activation status)$' \
  tests/internal-production/baseline-owner-producer-manifest-activation-controller-v1.test.ts
env -u SETFARM_PG_URL -u SETFARM_TEST_PG_ADMIN_URL \
  node --import tsx --test \
  --test-name-pattern='^(pure owner-admission parser rejects malformed authority|source boundary keeps owner-admission PostgreSQL imports lazy|private fake derives owner-admission projection)$' \
  tests/internal-production/owner-admission-v1.test.ts
env -u SETFARM_PG_URL node --import tsx scripts/run-isolated-postgres-tests.ts -- \
  node --import tsx --test --test-concurrency=1 \
  tests/internal-production/baseline-post-handoff-receipt-v1.test.ts
env -u SETFARM_PG_URL node --import tsx scripts/run-isolated-postgres-tests.ts -- \
  node --import tsx --test --test-concurrency=1 \
  tests/internal-production/baseline-owner-producer-manifest-activation-controller-v1.test.ts
env -u SETFARM_PG_URL node --import tsx scripts/run-isolated-postgres-tests.ts -- \
  node --import tsx --test --test-concurrency=1 \
  tests/internal-production/owner-admission-v1.test.ts
env -u SETFARM_PG_URL node --import tsx scripts/run-isolated-postgres-tests.ts -- \
  node --import tsx --test --test-concurrency=1 \
  tests/execution-attempts/migrations.test.ts
env -u SETFARM_PG_URL node --import tsx scripts/run-isolated-postgres-tests.ts -- \
  node --import tsx --test --test-concurrency=1 \
  tests/execution-attempts/platform-release-store-record-ledger-v3-contract-integration.test.ts
npx tsc -p tsconfig.json --noEmit
npm run check:english
npm run check:paths
git diff --check
```

Fixtures cover exact rotation intent/completion/disposition chains; every dangling-intent state; ordinal gap/fork/duplicate/unindexed archives; the shared publisher automaton's complete fixed/temp shape and double-crash matrices; fixed-lock live/dead/PID-reuse/no-fork races; response loss at every intent/rename/fsync/reopen/completion/transient-quarantine/post-order-delete/receipt/disposition boundary including unmatched root intent with both endpoints absent; APFS opaque directory-link observations and exact remaining-dirent subsets; exhaustive root-excluded inventory order/counters; 4,096/4,097 ledger capacity; candidate-keyed operation no-fork; lowest-ordinal/newest-two selection; fixed reference lsof plus complete listener-lsof NUL/LF grammar and endpoint cases; label-specific nullable plist/independent loaded-default cases; bounded symlink-chain/path commitments; Setfarm finalized-generation proof; Mission Control's startup-frozen loaded-build proof; same-UID limitation; three-phase proof drift; operation/receipt/disposition cross-pair; and absence of any public erase/restore/build-prune path. Runtime-authority cases prove the ordered operation tuple is frozen before observation, spawner/dashboard reuse the OA17 pair/body, Mission Control uses the embedded PBA body only as expected source, and its actual source/build comes only from the PID/listener-fenced loaded endpoint. They cover A-loaded/B-disk separation, a fresh B startup, listener/PID/start/instance drift, stale/missing endpoints, self-consistent crossed observations, exact response/hash/ref/source equality, historical recovery through only the embedded pure parser plus frozen endpoint, and a source/current/sibling CLI call count of zero in every loaded-generation and historical-resume path. Plist/environment cases prove all three `Program` keys absent, nonempty argument zero/effective Program equality for explicit and derived loaded forms, every exact per-label key/grammar/tokenizer/scan tuple, missing/duplicate/reordered/extra/unknown rejection, fixed-plist/loaded-job raw operational-token equality through both request fences, timing-safe endpoint authentication, one transient header send, no `AUTH_TOKEN` use, and absence of raw secret values from every durable/output/error surface. One disposable full-cycle fixture begins at the retention boundary, permanently disposes the lowest generation, then lets the writer rotate `dist` back to the eight-generation bound; it repeats that complete retention → writer-rotation sequence a second time and proves distinct candidate-indexed operations/receipts/dispositions, monotonic completion ordinals, no fork, no archive resurrection, and no residual quarantine. Current-entry cases cover strict v31/pending/operation parsers, all 31 migration rows, full audit and actual DB lock modes, pending implementation/executing-build drift, PBA/source drift, post-mutation historical recovery, canonical activation union/exhaustive jq, the shared no-replace automaton, and final fences. After the isolated harness applies migration 32, both zero-input current wrappers fail while all stored pair-only historical resolvers and historical A resolution succeed. Retention/current-entry filesystem cases run only in disposable fixtures/private spawned-Node mocks; production exports no root, filesystem, SQL, observer, or test injection. Every case proves literal live data and repository `.setfarm` unchanged or absent. Only one isolated PostgreSQL-runner invocation per whole file may call real `getSql`, current-entry controllers/wrappers, or activation controllers/wrappers against its fresh temporary database. These gates do not build this worktree or mutate a live database/service/current-entry/archive/quarantine; permanent deletion is exercised only inside disposable fixture roots.

The entry ABI separates `controllerSourceAuthority` from `loadedRuntimeServiceAuthority`. The controller authority binds the exact clean Task 0 descendant `controllerSourceSha`, `controllerTreeHash`, and `controllerBuildHash`. Before the canary, the already prepared Task 6A operation first performs one controlled pre-schema spawner-only rebind to that Task 0 source/build. The replacement starts in strict `pre-manifest-bootstrap-sealed` admission, publishes no run/claim/execution-attempt/runtime-session/completion-owner/mandatory-effect or any other owner-producer byte, opens no normal listener/loop, and waits fail-closed. After authentic old-spawner termination and while the replacement is already sealed, the controller obtains a new complete legacy/pre-manifest observation proving all 36 counters—including process, listener, worktree, dirty-worktree, and stale-child ownership—are zero; this post-termination pair is part of the sealed admission. A pre-dispatch snapshot alone is never migration authority. Only after reopening that pair and a later fresh equal reobservation may the controller apply/acknowledge migration 32, publish/reopen its receipt/current audit, separately apply or exact-adopt and fully verify ordinary migration 33, activate A's manifest, complete generic through-33 verification/normal initialization, and let that same spawner generation resolve both admission pairs and transition once to `normal-task0-admission-ready`; there is no second spawner restart. If any owner or child appears between initial observation, dispatch, predecessor termination, sealing, or migration authorization, the replacement remains sealed and migration is unavailable. The loaded-runtime authority binds source/tree/build plus process/generation identity for the Task 0 spawner, delivered Setfarm dashboard, and delivered Mission Control. OpenClaw is independently authenticated only by process, generation, listener, and owner-count identity; its source/tree/build fields are exactly null. Equality with the controller is required only for the spawner. Only the admission-ready spawner containing the Task 0 owner-reservation hooks may process the canary. Task 7 later rebuilds/rebinds the full spawner/dashboard/Mission-Control set and performs no schema mutation.

Its canary path internally uses Task 0's dedicated `current-entry-canary-source-run-launch-v1` owner-admission fence with exact typed `source-run` and `run` target reservations, the compound target-close authority, and the fence-release authority. The sole strict service census wire body is exactly `{schema,spawner,dashboard,missionControl,openClaw,censusHash}`. Each named projection contains integer `pid`, authenticated process/service/generation identity, and exact `processOwnerCount`; dashboard, Mission Control, and OpenClaw additionally contain their loopback listener identity and exact `listenerOwnerCount`. Spawner/dashboard and Mission Control carry their authenticated source/tree/build, while OpenClaw carries exact null source/tree/build. `censusHash` is exactly `hashCanonicalJson({schema,spawner,dashboard,missionControl,openClaw})` in that literal member order and excludes only `censusHash`; there is no service array, alternate hash alias, sortable projection, or caller-chosen ordering. The entry recorder accepts no caller root/SHA/run/failure code/test result/service identity/migration body/receipt body; it obtains every identity through fixed code-owned observers and stores the focused three-code test receipt separately from the one-code live-canary settlement.

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

export type ProductBuildAuthorityV2DeliveryEvidencePairV1 = Readonly<{
  deliveryEvidenceRef: CanonicalRef;
  deliveryEvidenceHash: Sha256V1;
}>;

export type ProductBuildAuthorityV2DeliveryEvidenceObservationV1 = Readonly<{
  schema: "setfarm.product-build-authority-v2-delivery-evidence-observation.v1";
  observationTransport: "source-cli";
  response: ProductBuildAuthorityV2DeliveryEvidenceResponseV1;
}>;

export function observeCurrentProductBuildAuthorityV2DeliveryEvidenceV1():
  Promise<ProductBuildAuthorityV2DeliveryEvidenceObservationV1>;

export function resolveProductBuildAuthorityV2DeliveryEvidenceV1(
  input: ProductBuildAuthorityV2DeliveryEvidencePairV1,
): Promise<ProductBuildAuthorityV2DeliveryEvidenceObservationV1>;
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

The same Task 0 module provides zero-input `observeCurrentProductBuildAuthorityV2DeliveryEvidenceV1()` as a required Task 0 postcondition. Before Task 7 it derives Mission Control's non-listening source-CLI target only from the fixed loaded LaunchAgent configuration `gui/<process.getuid()>/com.setrox.mission-control`: `/bin/launchctl` plus `/usr/bin/plutil` authenticate the loaded job's exact plist, label, canonical working directory, Node executable and `dist-server/index.js` entrypoint, then derive the sibling compiled delivery-evidence CLI below that same working directory. This configuration is only a path-free, code-owned locator and asserts no source/build or loaded-process byte identity. The located CLI itself reopens its module root and proves clean literal synchronized `main`, source/tree/build identity, exact content hash, focused tests and unchanged final attestation; its strict response is the sole pre-rebind source/build authority. No sibling path, `HOME`, environment root, caller path, or caller transport is accepted.

The first source-CLI slice exports strict `ProductBuildAuthorityV2DeliveryEvidenceObservationV1 {schema,observationTransport:"source-cli",response}` plus pair-only `ProductBuildAuthorityV2DeliveryEvidencePairV1`; it does not attempt HTTP or fallback. It observes the fixed launchd locator both before and after the bounded CLI execution and rejects drift. The child uses the authenticated Node realpath, exact `[derivedCliPath,"--json"]`, authenticated cwd, `shell:false`, a fixed timeout/max buffer, and a replacement environment containing only `PATH`, `LANG`, and `LC_ALL`; no `HOME`, `NODE_*`, `GIT_*`, proxy, database, token, or Setfarm variable crosses the boundary. Success is exactly one compact JSON document plus one terminal newline and empty stderr, followed by the local strict parser; every error is a finite redacted code and never includes launchctl/plist/child bytes or paths.

Only after Task 7 freshly resolves the authenticated post-rebind restart/loaded-runtime authority may the lifecycle-specific post-rebind observer use fixed loopback `GET /api/internal-production/product-build-authority-v2-delivery-evidence`; it must parse to the identical predecessor source-CLI evidence pair. Endpoint availability is never transport authority, and there is no HTTP-first, fallback, or automatic selector in the pre-rebind parser module. Current-entry requires `source-cli`; post-rebind requires `http`. No caller chooses transport, URL, root, command, ref, hash, response, parser, schema, fixture, or fallback. `resolveProductBuildAuthorityV2DeliveryEvidenceV1({deliveryEvidenceRef,deliveryEvidenceHash})` validates an exact pair before any OS call, performs a fresh source-CLI observation, and requires byte-identical response pair; it scans no store and accepts no body. The separate loaded-build observer calls only fixed `GET /api/internal-production/product-build-authority-v2-loaded-build`, parses only `ProductBuildAuthorityV2LoadedBuildResponseV1`, recomputes its loaded hash/ref, and binds its PID/listener/source identity without ever entering the delivery-evidence pair resolver. Task 0 tests use private Node-core/test-module mocks only, never a production transport injection or fixture export. The later Task 6 Step 8/Task 7 integration exercises both real, non-interchangeable HTTP wire responses without importing either repository's implementation into the other.

Task 0 also owns Task 7's strict successor ABI in `src/internal-production/baseline-post-handoff-receipt-v1.ts`: `InternalProductionPostRebindEntryAuthorityV1`, exact pair `InternalProductionPostRebindEntryAuthorityPairV1`, discriminated `InternalProductionPostRebindEntryAuthorityStatusV1`, fixed private content-addressed store, `resolveInternalProductionPostRebindEntryAuthorityV1({postRebindEntryAuthorityRef,postRebindEntryAuthorityHash})`, zero-input `resumeInternalProductionPostRebindEntryAuthorityV1()`, `observeInternalProductionPostRebindEntryAuthorityStatusV1()`, and `verifyCurrentInternalProductionPostRebindEntryAuthorityV1()`. The CLI adds only `resume-post-rebind-entry|post-rebind-entry-status|verify-post-rebind-entry --json`; none accepts predecessor, root, SHA, migration, restart, service, schema, owner, receipt body, or locator input.

Task 0 also owns exact `InternalProductionBaselineRestartSequenceIntentKindV1`, `InternalProductionBaselineServiceRestartAuthorityPairV1`, `InternalProductionBaselineRestartSequenceReceiptV1`, `InternalProductionBaselineRestartSequenceStatusV1`, `resumeInternalProductionBaselineRestartSequenceV1({intentKind})`, `observeInternalProductionBaselineRestartSequenceStatusV1({intentKind})`, and `resolveInternalProductionBaselineRestartSequenceReceiptV1({sequenceRef,sequenceHash})`. The CLI surface adds only `resume-restart-sequence --intent live-rebind|d-startup-hook-load|documentation-rollback --json` and read-only `restart-sequence-status --intent live-rebind|d-startup-hook-load|documentation-rollback --json`; all other arguments fail before observation or mutation.

Task 0's exact A-owned cutover ABI additionally includes `InternalProductionGlobalOwnerAdmissionFencePurposeV1`, `InternalProductionGlobalOwnerAdmissionFenceV1`, narrow null-target `acquireInternalProductionGlobalOwnerAdmissionFenceV1(...)`, dedicated `acquireInternalProductionSourceRunLaunchOwnerAdmissionFenceV1(...)`, dedicated `acquireInternalProductionRecoveryRestartOwnerAdmissionFenceV1(...)`, `reobserveInternalProductionGlobalOwnerAdmissionFenceV1(...)`, `closeInternalProductionSourceRunLaunchTargetReservationsUnderFenceV1(...)`, `closeInternalProductionRecoveryRestartTargetsUnderFenceV1(...)`, `INTERNAL_PRODUCTION_OWNER_CATEGORY_REGISTRY_V1`, `InternalProductionCompleteZeroOwnerCensusV1`, the key-checked `INTERNAL_PRODUCTION_OWNER_CATEGORY_CENSUS_MAP_V1`, `InternalProductionOwnerProducerRowV1`, `InternalProductionOwnerProducerManifestV1`, the sixteen-row `INTERNAL_PRODUCTION_OWNER_PRODUCER_ROWS_A_V1`, exact `INTERNAL_PRODUCTION_OWNER_PRODUCER_MANIFEST_A_V1`, stable A–E-discriminated `InternalProductionOwnerProducerSourceBuildAuthorityPairV1`, strict `InternalProductionOwnerProducerSourceBuildAuthorityAV1` and its Task-0-A-only `InternalProductionOwnerProducerSourceBuildAuthorityV1` body union, `InternalProductionOwnerProducerManifestSetActivationPredecessorV1`, `InternalProductionOwnerProducerManifestSetActivationCurrentV1`, `InternalProductionOwnerProducerManifestSetActivationStoreV1`, `activateInternalProductionOwnerProducerManifestSetV1(...)`, source/activation/head pair resolvers, zero-input `resolveCurrentInternalProductionOwnerProducerManifestSetActivationV1()`, transaction-pinned `resolveCurrentInternalProductionOwnerProducerManifestSetActivationInTransactionV1(sql)`, `InternalProductionBaselineOwnerProducerManifestActivationReceiptV1`, `InternalProductionBaselineOwnerProducerManifestActivationStatusV1`, zero-input `activateInternalProductionBaselineOwnerProducerManifestV1()`, zero-input read-only `observeInternalProductionBaselineOwnerProducerManifestActivationStatusV1()`, `assembleInternalProductionOwnerProducerRegistryV1(...)`, `InternalProductionOwnerReservationV1`, `beginOrAdoptInternalProductionOwnerReservationV1(...)`, `closeInternalProductionOwnerReservationV1(...)`, and their pair-only resolvers. It also owns `InternalProductionPhysicalServiceRestartAuthorityCutoverOperationV1` and `resolveInternalProductionPhysicalServiceRestartAuthorityCutoverOperationV1({operationRef,operationHash})`, plus the finite recovery-source bootstrap ABI `InternalProductionRecoverySourceBootstrapOperationV1`, `prepareInternalProductionRecoverySourceBootstrapRunV1()`, zero-input `resumeActiveInternalProductionRecoverySourceBootstrapRunV1()`, and read-only `observeInternalProductionRecoverySourceBootstrapStatusV1()`. The immutable cutover operation is private/path-free and exists before its bound guard can be consumed; D receives no operation pair and imports no operation writer.

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
export type InternalProductionLegacyPreManifestZeroOwnerObservationPairV1 =
  Readonly<{
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
  currentEntryOperationRef: CanonicalRef;
  currentEntryOperationHash: Sha256V1;
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
  task0SpawnerTreeHash: GitObjectHashV1;
  task0SpawnerBuildHash: Sha256V1;
  predecessorSpawnerProcessIdentityRef: CanonicalRef;
  predecessorSpawnerProcessIdentityHash: Sha256V1;
  predecessorSpawnerServiceIdentityHash: Sha256V1;
  predecessorSpawnerGenerationHash: Sha256V1;
  startupTokenRef: CanonicalRef;
  startupTokenHash: Sha256V1;
}>;
export type InternalProductionPreSchemaSpawnerStartupTokenPairV1 = Readonly<{
  startupTokenRef: CanonicalRef;
  startupTokenHash: Sha256V1;
}>;
export type InternalProductionPreSchemaSpawnerRestartAuthorityPairV1 = Readonly<{
  restartAuthorityRef: CanonicalRef;
  restartAuthorityHash: Sha256V1;
}>;
export type InternalProductionPreSchemaSpawnerRestartAuthorityV1 = Readonly<{
  schema: "setfarm.internal-production-pre-schema-spawner-restart-authority.v1";
  actionId: "task6a-pre-schema-setfarm-spawner-rebind-v1";
  service: "setfarm-spawner";
  currentEntryOperationRef: CanonicalRef;
  currentEntryOperationHash: Sha256V1;
  preSchemaSpawnerRebindAuthorizationRef: CanonicalRef;
  preSchemaSpawnerRebindAuthorizationHash: Sha256V1;
  startupTokenRef: CanonicalRef;
  startupTokenHash: Sha256V1;
  predecessorSpawnerProcessIdentityRef: CanonicalRef;
  predecessorSpawnerProcessIdentityHash: Sha256V1;
  predecessorSpawnerServiceIdentityHash: Sha256V1;
  predecessorSpawnerGenerationHash: Sha256V1;
  targetSpawnerSourceSha: GitObjectHashV1;
  targetSpawnerTreeHash: GitObjectHashV1;
  targetSpawnerBuildHash: Sha256V1;
  uid: number;
  launchdLabel: "com.setrox.setfarm-spawner";
  executable: "/bin/launchctl";
  argv: readonly ["kickstart", "-k", `gui/${number}/com.setrox.setfarm-spawner`];
  restartAuthorityRef: CanonicalRef;
  restartAuthorityHash: Sha256V1;
}>;
export type InternalProductionPreSchemaSpawnerPredecessorTerminationObservationPairV1 =
  Readonly<{
    predecessorTerminationObservationRef: CanonicalRef;
    predecessorTerminationObservationHash: Sha256V1;
  }>;
export type InternalProductionPreSchemaSpawnerPredecessorTerminationObservationV1 =
  Readonly<{
    schema: "setfarm.internal-production-pre-schema-spawner-predecessor-termination-observation.v1";
    currentEntryOperationRef: CanonicalRef;
    currentEntryOperationHash: Sha256V1;
    preSchemaSpawnerRebindAuthorizationRef: CanonicalRef;
    preSchemaSpawnerRebindAuthorizationHash: Sha256V1;
    startupTokenRef: CanonicalRef;
    startupTokenHash: Sha256V1;
    restartAuthorityRef: CanonicalRef;
    restartAuthorityHash: Sha256V1;
    predecessorSpawnerProcessIdentityRef: CanonicalRef;
    predecessorSpawnerProcessIdentityHash: Sha256V1;
    predecessorSpawnerServiceIdentityHash: Sha256V1;
    predecessorSpawnerGenerationHash: Sha256V1;
    observedProcessState: "terminal-and-not-running";
    observedListenerState: "absent";
    predecessorTerminationObservationRef: CanonicalRef;
    predecessorTerminationObservationHash: Sha256V1;
  }>;
export type InternalProductionPreSchemaSpawnerReplacementProcessObservationPairV1 =
  Readonly<{
    replacementProcessObservationRef: CanonicalRef;
    replacementProcessObservationHash: Sha256V1;
  }>;
export type InternalProductionPreSchemaSpawnerReplacementProcessObservationV1 = Readonly<{
  schema: "setfarm.internal-production-pre-schema-spawner-replacement-process-observation.v1";
  currentEntryOperationRef: CanonicalRef;
  currentEntryOperationHash: Sha256V1;
  preSchemaSpawnerRebindAuthorizationRef: CanonicalRef;
  preSchemaSpawnerRebindAuthorizationHash: Sha256V1;
  startupTokenRef: CanonicalRef;
  startupTokenHash: Sha256V1;
  restartAuthorityRef: CanonicalRef;
  restartAuthorityHash: Sha256V1;
  predecessorTerminationObservationRef: CanonicalRef;
  predecessorTerminationObservationHash: Sha256V1;
  replacementSpawnerProcessIdentityRef: CanonicalRef;
  replacementSpawnerProcessIdentityHash: Sha256V1;
  replacementSpawnerServiceIdentityHash: Sha256V1;
  actualSpawnerGenerationHash: Sha256V1;
  actualSpawnerSourceSha: GitObjectHashV1;
  actualSpawnerTreeHash: GitObjectHashV1;
  actualSpawnerBuildHash: Sha256V1;
  differsFromPredecessorProcessIdentity: true;
  startupMode: "pre-manifest-bootstrap-sealed";
  replacementProcessObservationRef: CanonicalRef;
  replacementProcessObservationHash: Sha256V1;
}>;
export type InternalProductionPreSchemaSpawnerSealedAdmissionPairV1 = Readonly<{
  sealedAdmissionRef: CanonicalRef;
  sealedAdmissionHash: Sha256V1;
}>;
export type InternalProductionPreSchemaSpawnerSealedAdmissionV1 = Readonly<{
  schema: "setfarm.internal-production-pre-schema-spawner-sealed-admission.v1";
  state: "pre-manifest-bootstrap-sealed";
  currentEntryOperationRef: CanonicalRef;
  currentEntryOperationHash: Sha256V1;
  preSchemaSpawnerRebindAuthorizationRef: CanonicalRef;
  preSchemaSpawnerRebindAuthorizationHash: Sha256V1;
  startupTokenRef: CanonicalRef;
  startupTokenHash: Sha256V1;
  preSchemaSpawnerRestartAuthorityRef: CanonicalRef;
  preSchemaSpawnerRestartAuthorityHash: Sha256V1;
  predecessorTerminationObservationRef: CanonicalRef;
  predecessorTerminationObservationHash: Sha256V1;
  replacementProcessObservationRef: CanonicalRef;
  replacementProcessObservationHash: Sha256V1;
  currentSpawnerGenerationHash: Sha256V1;
  postPredecessorTerminationLegacyZeroOwnerObservationRef: CanonicalRef;
  postPredecessorTerminationLegacyZeroOwnerObservationHash: Sha256V1;
  allOwnerProducerEntrypointsBlocked: true;
  sealedAdmissionRef: CanonicalRef;
  sealedAdmissionHash: Sha256V1;
}>;
export type InternalProductionTask0SpawnerAdmissionReadyPairV1 = Readonly<{
  admissionReadyRef: CanonicalRef;
  admissionReadyHash: Sha256V1;
}>;
export type InternalProductionCurrentEntryOperationPairV1 = Readonly<{
  operationRef: CanonicalRef;
  operationHash: Sha256V1;
}>;
export type InternalProductionPreMutationLoadedRuntimeServiceAuthorityPairV1 = Readonly<{
  preMutationLoadedRuntimeServiceAuthorityRef: CanonicalRef;
  preMutationLoadedRuntimeServiceAuthorityHash: Sha256V1;
}>;
export type InternalProductionServiceCensusSpawnerV1 = Readonly<{
  pid: number; processStartTimeEpochMs: number;
  processIdentityHash: Sha256V1; serviceIdentityHash: Sha256V1;
  generationHash: Sha256V1;
  loadedSourceSha: GitObjectHashV1; loadedTreeHash: GitObjectHashV1;
  loadedBuildHash: Sha256V1;
  processOwnerCount: 1;
  listener: null;
}>;
export type InternalProductionServiceCensusDashboardV1 = Readonly<{
  pid: number; processStartTimeEpochMs: number;
  processIdentityHash: Sha256V1; serviceIdentityHash: Sha256V1;
  generationHash: Sha256V1;
  loadedSourceSha: GitObjectHashV1; loadedTreeHash: GitObjectHashV1;
  loadedBuildHash: Sha256V1;
  processOwnerCount: 1; listenerOwnerCount: 1;
  listener: Readonly<{
    host: "127.0.0.1"; port: 3333; listenerIdentityHash: Sha256V1;
  }>;
}>;
export type InternalProductionServiceCensusMissionControlV1 = Readonly<{
  pid: number; processStartTimeEpochMs: number;
  processIdentityHash: Sha256V1; serviceIdentityHash: Sha256V1;
  generationHash: Sha256V1;
  loadedSourceSha: GitObjectHashV1; loadedTreeHash: GitObjectHashV1;
  loadedBuildHash: Sha256V1;
  processOwnerCount: 1; listenerOwnerCount: 1;
  listener: Readonly<{
    host: "127.0.0.1"; port: 3080; listenerIdentityHash: Sha256V1;
  }>;
}>;
export type InternalProductionServiceCensusOpenClawV1 = Readonly<{
  pid: number; processStartTimeEpochMs: number;
  processIdentityHash: Sha256V1; serviceIdentityHash: Sha256V1;
  generationHash: Sha256V1;
  loadedSourceSha: null; loadedTreeHash: null; loadedBuildHash: null;
  processOwnerCount: 1; listenerOwnerCount: 1;
  listener: Readonly<{
    host: "127.0.0.1"; port: 18789; listenerIdentityHash: Sha256V1;
  }>;
}>;
export type InternalProductionServiceCensusV1 = Readonly<{
  schema: "setfarm.internal-production-service-census.v1";
  spawner: InternalProductionServiceCensusSpawnerV1;
  dashboard: InternalProductionServiceCensusDashboardV1;
  missionControl: InternalProductionServiceCensusMissionControlV1;
  openClaw: InternalProductionServiceCensusOpenClawV1;
  censusHash: Sha256V1;
}>;
export function deriveInternalProductionServiceCensusHashV1(
  input: Omit<InternalProductionServiceCensusV1, "censusHash">,
): Sha256V1 {
  return hashCanonicalJson({
    schema: input.schema,
    spawner: input.spawner,
    dashboard: input.dashboard,
    missionControl: input.missionControl,
    openClaw: input.openClaw,
  });
}
export type InternalProductionPreMutationLoadedRuntimeSpawnerProjectionV1 =
  Readonly<{
    pid: number; processStartTimeEpochMs: number;
    processIdentityHash: Sha256V1; serviceIdentityHash: Sha256V1;
    generationHash: Sha256V1;
    loadedSourceSha: GitObjectHashV1; loadedTreeHash: GitObjectHashV1;
    loadedBuildHash: Sha256V1; processOwnerCount: 1; listener: null;
  }>;
export type InternalProductionPreMutationLoadedRuntimeDashboardProjectionV1 =
  Readonly<{
    pid: number; processStartTimeEpochMs: number;
    processIdentityHash: Sha256V1; serviceIdentityHash: Sha256V1;
    generationHash: Sha256V1;
    loadedSourceSha: GitObjectHashV1; loadedTreeHash: GitObjectHashV1;
    loadedBuildHash: Sha256V1;
    processOwnerCount: 1; listenerOwnerCount: 1;
    listener: Readonly<{
      host: "127.0.0.1"; port: 3333; listenerIdentityHash: Sha256V1;
    }>;
  }>;
export type InternalProductionPreMutationLoadedRuntimeMissionControlProjectionV1 =
  Readonly<{
    pid: number; processStartTimeEpochMs: number;
    processIdentityHash: Sha256V1; serviceIdentityHash: Sha256V1;
    generationHash: Sha256V1;
    loadedSourceSha: GitObjectHashV1; loadedTreeHash: GitObjectHashV1;
    loadedBuildHash: Sha256V1;
    processOwnerCount: 1; listenerOwnerCount: 1;
    listener: Readonly<{
      host: "127.0.0.1"; port: 3080; listenerIdentityHash: Sha256V1;
    }>;
  }>;
export type InternalProductionPreMutationLoadedRuntimeOpenClawProjectionV1 =
  Readonly<{
    pid: number; processStartTimeEpochMs: number;
    processIdentityHash: Sha256V1; serviceIdentityHash: Sha256V1;
    generationHash: Sha256V1;
    loadedSourceSha: null; loadedTreeHash: null; loadedBuildHash: null;
    processOwnerCount: 1; listenerOwnerCount: 1;
    listener: Readonly<{
      host: "127.0.0.1"; port: 18789; listenerIdentityHash: Sha256V1;
    }>;
  }>;
export type InternalProductionPreMutationLoadedRuntimeServiceAuthorityV1 = Readonly<{
  schema: "setfarm.internal-production-pre-mutation-loaded-runtime-service-authority.v1";
  currentEntryOperationRef: CanonicalRef;
  currentEntryOperationHash: Sha256V1;
  observedServiceCensusHash: Sha256V1;
  spawner: InternalProductionPreMutationLoadedRuntimeSpawnerProjectionV1;
  dashboard: InternalProductionPreMutationLoadedRuntimeDashboardProjectionV1;
  missionControl: InternalProductionPreMutationLoadedRuntimeMissionControlProjectionV1;
  openClaw: InternalProductionPreMutationLoadedRuntimeOpenClawProjectionV1;
  serviceProjectionSetHash: Sha256V1;
  preMutationLoadedRuntimeServiceAuthorityRef: CanonicalRef;
  preMutationLoadedRuntimeServiceAuthorityHash: Sha256V1;
}>;
export function deriveInternalProductionPreMutationServiceProjectionSetHashV1(
  input: InternalProductionPreMutationLoadedRuntimeServiceAuthorityV1,
): Sha256V1 {
  return hashCanonicalJson({
    schema: input.schema,
    currentEntryOperationRef: input.currentEntryOperationRef,
    currentEntryOperationHash: input.currentEntryOperationHash,
    observedServiceCensusHash: input.observedServiceCensusHash,
    spawner: input.spawner,
    dashboard: input.dashboard,
    missionControl: input.missionControl,
    openClaw: input.openClaw,
  });
}
export interface InternalProductionPreMutationLoadedRuntimeServiceAuthorityStoreV1 {
  publish(input: InternalProductionPreMutationLoadedRuntimeServiceAuthorityV1):
    Promise<InternalProductionPreMutationLoadedRuntimeServiceAuthorityPairV1>;
  resolve(input: InternalProductionPreMutationLoadedRuntimeServiceAuthorityPairV1):
    Promise<InternalProductionPreMutationLoadedRuntimeServiceAuthorityV1>;
}
export function resolveInternalProductionPreMutationLoadedRuntimeServiceAuthorityV1(
  input: InternalProductionPreMutationLoadedRuntimeServiceAuthorityPairV1,
): Promise<InternalProductionPreMutationLoadedRuntimeServiceAuthorityV1>;

export type InternalProductionCurrentEntryMigrationApplyingPhaseV1 =
  | Readonly<{
      phase: "prepared";
      authorization: InternalProductionPreManifestMigration32AuthorizationPairV1;
      consumption: null; migrationReceipt: null; currentAudit: null;
    }>
  | Readonly<{
      phase: "consumed";
      authorization: InternalProductionPreManifestMigration32AuthorizationPairV1;
      consumption: InternalProductionPreManifestMigration32AuthorizationConsumptionPairV1;
      migrationReceipt: null; currentAudit: null;
    }>
  | Readonly<{
      phase: "receipt_published";
      authorization: InternalProductionPreManifestMigration32AuthorizationPairV1;
      consumption: InternalProductionPreManifestMigration32AuthorizationConsumptionPairV1;
      migrationReceipt: InternalProductionBaselineBootstrapHandoffMigrationReceiptPairV1;
      currentAudit: null;
    }>
  | Readonly<{
      phase: "current_audited";
      authorization: InternalProductionPreManifestMigration32AuthorizationPairV1;
      consumption: InternalProductionPreManifestMigration32AuthorizationConsumptionPairV1;
      migrationReceipt: InternalProductionBaselineBootstrapHandoffMigrationReceiptPairV1;
      currentAudit: Readonly<{
        bootstrapHandoffCurrentAuditRef: CanonicalRef;
        bootstrapHandoffCurrentAuditHash: Sha256V1;
      }>;
    }>;
export type InternalProductionCurrentEntrySpawnerAdmissionTransitionPhaseV1 =
  | Readonly<{
      phase: "sealed";
      sealedAdmission: InternalProductionPreSchemaSpawnerSealedAdmissionPairV1;
      admissionReady: null; loadedRuntimeServiceAuthority: null;
    }>
  | Readonly<{
      phase: "admission_ready";
      sealedAdmission: InternalProductionPreSchemaSpawnerSealedAdmissionPairV1;
      admissionReady: InternalProductionTask0SpawnerAdmissionReadyPairV1;
      loadedRuntimeServiceAuthority: null;
    }>
  | Readonly<{
      phase: "runtime_observed";
      sealedAdmission: InternalProductionPreSchemaSpawnerSealedAdmissionPairV1;
      admissionReady: InternalProductionTask0SpawnerAdmissionReadyPairV1;
      loadedRuntimeServiceAuthority: Readonly<{
        loadedRuntimeServiceAuthorityRef: CanonicalRef;
        loadedRuntimeServiceAuthorityHash: Sha256V1;
      }>;
    }>;
export type InternalProductionCurrentEntryCanaryRunningPhaseV1 =
  | Readonly<{
      phase: "running";
      ownerAdmissionFenceRef: CanonicalRef; ownerAdmissionFenceHash: Sha256V1;
      sourceRunTargetReservationRef: CanonicalRef;
      sourceRunTargetReservationHash: Sha256V1;
      runTargetReservationRef: CanonicalRef; runTargetReservationHash: Sha256V1;
      terminalSettlementRef: null; terminalSettlementHash: null;
      targetCloseRef: null; targetCloseHash: null;
    }>
  | Readonly<{
      phase: "terminal_settlement_published";
      ownerAdmissionFenceRef: CanonicalRef; ownerAdmissionFenceHash: Sha256V1;
      sourceRunTargetReservationRef: CanonicalRef;
      sourceRunTargetReservationHash: Sha256V1;
      runTargetReservationRef: CanonicalRef; runTargetReservationHash: Sha256V1;
      terminalSettlementRef: CanonicalRef; terminalSettlementHash: Sha256V1;
      targetCloseRef: null; targetCloseHash: null;
    }>;
export type InternalProductionCurrentEntrySettledPhaseV1 =
  | Readonly<{
      phase: "target_closed";
      terminalSettlementRef: CanonicalRef; terminalSettlementHash: Sha256V1;
      targetCloseRef: CanonicalRef; targetCloseHash: Sha256V1;
      ownerAdmissionFenceReleaseRef: null; ownerAdmissionFenceReleaseHash: null;
      entryAuthorityRef: null; entryAuthorityHash: null;
    }>
  | Readonly<{
      phase: "fence_released";
      terminalSettlementRef: CanonicalRef; terminalSettlementHash: Sha256V1;
      targetCloseRef: CanonicalRef; targetCloseHash: Sha256V1;
      ownerAdmissionFenceReleaseRef: CanonicalRef;
      ownerAdmissionFenceReleaseHash: Sha256V1;
      entryAuthorityRef: null; entryAuthorityHash: null;
    }>;
export type InternalProductionCurrentEntryBlockedReasonCodeV1 =
  | "PRE_MUTATION_RUNTIME_AUTHORITY_DRIFT"
  | "PRE_SCHEMA_REBIND_BLOCKED"
  | "MIGRATION_AUTHORIZATION_BLOCKED"
  | "MIGRATION_RECEIPT_PUBLICATION_FAILED"
  | "MIGRATION_CURRENT_AUDIT_FAILED"
  | "MANIFEST_ACTIVATION_FAILED"
  | "SPAWNER_ADMISSION_FAILED"
  | "RUNTIME_OBSERVATION_DRIFT"
  | "CANARY_START_FAILED"
  | "CANARY_SETTLEMENT_FAILED"
  | "CANARY_TARGET_CLOSE_FAILED"
  | "CANARY_FENCE_RELEASE_FAILED"
  | "ENTRY_PUBLICATION_FAILED";
export type InternalProductionCurrentEntryAuthorityStatusPairV1 = Readonly<{
  statusRef: CanonicalRef;
  statusHash: Sha256V1;
}>;
export type InternalProductionCurrentEntryNonBlockedStateV1 =
  | "absent" | "operation_prepared" | "pre_schema_spawner_rebinding"
  | "pre_manifest_bootstrap_sealed" | "migration_applying"
  | "manifest_activating" | "spawner_admission_transitioning"
  | "prepared" | "canary_running" | "settled" | "ready";
export type InternalProductionCurrentEntryControllerSourceAuthorityV1 = Readonly<{
  controllerSourceSha: GitObjectHashV1;
  controllerTreeHash: GitObjectHashV1;
  controllerBuildHash: Sha256V1;
}>;
export type ProductBuildAuthorityV2DeliveryEvidencePairV1 = Readonly<{
  deliveryEvidenceRef: CanonicalRef;
  deliveryEvidenceHash: Sha256V1;
}>;
export type InternalProductionAuthorityV3Migration31AuditPairV1 = Readonly<{
  authorityV3Migration31AuditRef: CanonicalRef;
  authorityV3Migration31AuditHash: Sha256V1;
}>;
export type InternalProductionPendingBootstrapHandoffMigrationProjectionPairV1 =
  Readonly<{
    pendingBootstrapHandoffMigrationRef: CanonicalRef;
    pendingBootstrapHandoffMigrationHash: Sha256V1;
  }>;
type InternalProductionCurrentEntryAuthorityStatusFixedPrefixV1 = Readonly<{
  schema: "setfarm.internal-production-current-entry-authority-status.v1";
  operationRef: CanonicalRef;
  operationHash: Sha256V1;
  controllerSourceAuthority:
    InternalProductionCurrentEntryControllerSourceAuthorityV1;
  productBuildAuthorityV2DeliveryEvidence:
    ProductBuildAuthorityV2DeliveryEvidencePairV1;
  authorityV3Migration31Audit:
    InternalProductionAuthorityV3Migration31AuditPairV1;
  pendingBootstrapHandoffMigration:
    InternalProductionPendingBootstrapHandoffMigrationProjectionPairV1;
  preMutationLoadedRuntimeServiceAuthorityRef: CanonicalRef;
  preMutationLoadedRuntimeServiceAuthorityHash: Sha256V1;
  preMutationLoadedRuntimeServiceAuthority:
    InternalProductionPreMutationLoadedRuntimeServiceAuthorityV1;
  statusRef: CanonicalRef;
  statusHash: Sha256V1;
}>;
type InternalProductionCurrentEntryManifestActivationPairV1 = Readonly<{
  ownerProducerManifestActivationRef: CanonicalRef;
  ownerProducerManifestActivationHash: Sha256V1;
  ownerProducerManifestHeadRef: CanonicalRef;
  ownerProducerManifestHeadHash: Sha256V1;
}>;
export type InternalProductionCurrentEntryAuthorityPairV1 = Readonly<{
  entryAuthorityRef: CanonicalRef;
  entryAuthorityHash: Sha256V1;
}>;
type InternalProductionCurrentEntryPartialRebindStatusV1 = Extract<
  InternalProductionPreSchemaSpawnerRebindStatusV1,
  { state: "prepared" | "startup_token_published" | "dispatching" }
>;
type InternalProductionCurrentEntrySealedRebindStatusV1 = Extract<
  InternalProductionPreSchemaSpawnerRebindStatusV1,
  { state: "pre_manifest_bootstrap_sealed" }
>;
type InternalProductionCurrentEntryReadyRebindStatusV1 = Extract<
  InternalProductionPreSchemaSpawnerRebindStatusV1,
  { state: "normal_task0_admission_ready" }
>;
type InternalProductionCurrentEntryLastValidRebindProjectionV1 =
  | Readonly<{
      state: "operation_prepared";
      preSchemaSpawnerRebindStatus: null;
      preSchemaSpawnerRebindStatusBody: null;
    }>
  | Readonly<{
      state: "pre_schema_spawner_rebinding";
      preSchemaSpawnerRebindStatus:
        InternalProductionPreSchemaSpawnerRebindStatusPairV1;
      preSchemaSpawnerRebindStatusBody:
        InternalProductionCurrentEntryPartialRebindStatusV1;
    }>
  | Readonly<{
      state: "pre_manifest_bootstrap_sealed" | "migration_applying" |
        "manifest_activating";
      preSchemaSpawnerRebindStatus:
        InternalProductionPreSchemaSpawnerRebindStatusPairV1;
      preSchemaSpawnerRebindStatusBody:
        InternalProductionCurrentEntrySealedRebindStatusV1;
    }>
  | Readonly<{
      state: "spawner_admission_transitioning";
      preSchemaSpawnerRebindStatus:
        InternalProductionPreSchemaSpawnerRebindStatusPairV1;
      preSchemaSpawnerRebindStatusBody:
        InternalProductionCurrentEntrySealedRebindStatusV1 |
        InternalProductionCurrentEntryReadyRebindStatusV1;
    }>
  | Readonly<{
      state: "prepared" | "canary_running" | "settled" | "ready";
      preSchemaSpawnerRebindStatus:
        InternalProductionPreSchemaSpawnerRebindStatusPairV1;
      preSchemaSpawnerRebindStatusBody:
        InternalProductionCurrentEntryReadyRebindStatusV1;
    }>;
export type InternalProductionCurrentEntryAuthorityStatusV1 =
  | Readonly<{
      schema: "setfarm.internal-production-current-entry-authority-status.v1";
      state: "absent";
      operationRef: null; operationHash: null;
      controllerSourceAuthority: null;
      productBuildAuthorityV2DeliveryEvidence: null;
      authorityV3Migration31Audit: null;
      pendingBootstrapHandoffMigration: null;
      preMutationLoadedRuntimeServiceAuthorityRef: null;
      preMutationLoadedRuntimeServiceAuthorityHash: null;
      preMutationLoadedRuntimeServiceAuthority: null;
      preSchemaSpawnerRebindStatus: null;
      preSchemaSpawnerRebindStatusBody: null;
      migrationApplyingPhase: null;
      manifestActivation: null; spawnerAdmissionTransitionPhase: null;
      canaryRunningPhase: null; settledPhase: null; entryAuthority: null;
      blockedReason: null; statusRef: CanonicalRef; statusHash: Sha256V1;
    }>
  | (InternalProductionCurrentEntryAuthorityStatusFixedPrefixV1 & Readonly<{
      state: "operation_prepared";
      preSchemaSpawnerRebindStatus: null;
      preSchemaSpawnerRebindStatusBody: null;
      migrationApplyingPhase: null;
      manifestActivation: null; spawnerAdmissionTransitionPhase: null;
      canaryRunningPhase: null; settledPhase: null; entryAuthority: null;
      blockedReason: null;
    }>)
  | (InternalProductionCurrentEntryAuthorityStatusFixedPrefixV1 & Readonly<{
      state: "pre_schema_spawner_rebinding";
      preSchemaSpawnerRebindStatus: InternalProductionPreSchemaSpawnerRebindStatusPairV1;
      preSchemaSpawnerRebindStatusBody:
        InternalProductionCurrentEntryPartialRebindStatusV1;
      migrationApplyingPhase: null; manifestActivation: null;
      spawnerAdmissionTransitionPhase: null; canaryRunningPhase: null;
      settledPhase: null; entryAuthority: null; blockedReason: null;
    }>)
  | (InternalProductionCurrentEntryAuthorityStatusFixedPrefixV1 & Readonly<{
      state: "pre_manifest_bootstrap_sealed";
      preSchemaSpawnerRebindStatus: InternalProductionPreSchemaSpawnerRebindStatusPairV1;
      preSchemaSpawnerRebindStatusBody:
        InternalProductionCurrentEntrySealedRebindStatusV1;
      migrationApplyingPhase: null; manifestActivation: null;
      spawnerAdmissionTransitionPhase: null; canaryRunningPhase: null;
      settledPhase: null; entryAuthority: null; blockedReason: null;
    }>)
  | (InternalProductionCurrentEntryAuthorityStatusFixedPrefixV1 & Readonly<{
      state: "migration_applying";
      preSchemaSpawnerRebindStatus: InternalProductionPreSchemaSpawnerRebindStatusPairV1;
      preSchemaSpawnerRebindStatusBody:
        InternalProductionCurrentEntrySealedRebindStatusV1;
      migrationApplyingPhase: InternalProductionCurrentEntryMigrationApplyingPhaseV1;
      manifestActivation: null; spawnerAdmissionTransitionPhase: null;
      canaryRunningPhase: null; settledPhase: null; entryAuthority: null;
      blockedReason: null;
    }>)
  | (InternalProductionCurrentEntryAuthorityStatusFixedPrefixV1 & Readonly<{
      state: "manifest_activating";
      preSchemaSpawnerRebindStatus: InternalProductionPreSchemaSpawnerRebindStatusPairV1;
      preSchemaSpawnerRebindStatusBody:
        InternalProductionCurrentEntrySealedRebindStatusV1;
      migrationApplyingPhase: Extract<InternalProductionCurrentEntryMigrationApplyingPhaseV1,
        { phase: "current_audited" }>;
      manifestActivation: null; spawnerAdmissionTransitionPhase: null;
      canaryRunningPhase: null; settledPhase: null; entryAuthority: null;
      blockedReason: null;
    }>)
  | (InternalProductionCurrentEntryAuthorityStatusFixedPrefixV1 & Readonly<{
      state: "spawner_admission_transitioning";
      preSchemaSpawnerRebindStatus: InternalProductionPreSchemaSpawnerRebindStatusPairV1;
      migrationApplyingPhase: Extract<InternalProductionCurrentEntryMigrationApplyingPhaseV1,
        { phase: "current_audited" }>;
      manifestActivation: InternalProductionCurrentEntryManifestActivationPairV1;
      canaryRunningPhase: null; settledPhase: null; entryAuthority: null;
      blockedReason: null;
    }> & (
      | Readonly<{
          preSchemaSpawnerRebindStatusBody:
            InternalProductionCurrentEntrySealedRebindStatusV1;
          spawnerAdmissionTransitionPhase: Extract<
            InternalProductionCurrentEntrySpawnerAdmissionTransitionPhaseV1,
            { phase: "sealed" }
          >;
        }>
      | Readonly<{
          preSchemaSpawnerRebindStatusBody:
            InternalProductionCurrentEntryReadyRebindStatusV1;
          spawnerAdmissionTransitionPhase: Extract<
            InternalProductionCurrentEntrySpawnerAdmissionTransitionPhaseV1,
            { phase: "admission_ready" | "runtime_observed" }
          >;
        }>
    ))
  | (InternalProductionCurrentEntryAuthorityStatusFixedPrefixV1 & Readonly<{
      state: "prepared";
      preSchemaSpawnerRebindStatus: InternalProductionPreSchemaSpawnerRebindStatusPairV1;
      preSchemaSpawnerRebindStatusBody:
        InternalProductionCurrentEntryReadyRebindStatusV1;
      migrationApplyingPhase: Extract<InternalProductionCurrentEntryMigrationApplyingPhaseV1,
        { phase: "current_audited" }>;
      manifestActivation: InternalProductionCurrentEntryManifestActivationPairV1;
      spawnerAdmissionTransitionPhase:
        Extract<InternalProductionCurrentEntrySpawnerAdmissionTransitionPhaseV1,
          { phase: "runtime_observed" }>;
      canaryRunningPhase: null; settledPhase: null; entryAuthority: null;
      blockedReason: null;
    }>)
  | (InternalProductionCurrentEntryAuthorityStatusFixedPrefixV1 & Readonly<{
      state: "canary_running";
      preSchemaSpawnerRebindStatus: InternalProductionPreSchemaSpawnerRebindStatusPairV1;
      preSchemaSpawnerRebindStatusBody:
        InternalProductionCurrentEntryReadyRebindStatusV1;
      migrationApplyingPhase: Extract<InternalProductionCurrentEntryMigrationApplyingPhaseV1,
        { phase: "current_audited" }>;
      manifestActivation: InternalProductionCurrentEntryManifestActivationPairV1;
      spawnerAdmissionTransitionPhase:
        Extract<InternalProductionCurrentEntrySpawnerAdmissionTransitionPhaseV1,
          { phase: "runtime_observed" }>;
      canaryRunningPhase: InternalProductionCurrentEntryCanaryRunningPhaseV1;
      settledPhase: null; entryAuthority: null; blockedReason: null;
    }>)
  | (InternalProductionCurrentEntryAuthorityStatusFixedPrefixV1 & Readonly<{
      state: "settled";
      preSchemaSpawnerRebindStatus: InternalProductionPreSchemaSpawnerRebindStatusPairV1;
      preSchemaSpawnerRebindStatusBody:
        InternalProductionCurrentEntryReadyRebindStatusV1;
      migrationApplyingPhase: Extract<InternalProductionCurrentEntryMigrationApplyingPhaseV1,
        { phase: "current_audited" }>;
      manifestActivation: InternalProductionCurrentEntryManifestActivationPairV1;
      spawnerAdmissionTransitionPhase:
        Extract<InternalProductionCurrentEntrySpawnerAdmissionTransitionPhaseV1,
          { phase: "runtime_observed" }>;
      canaryRunningPhase: Extract<InternalProductionCurrentEntryCanaryRunningPhaseV1,
        { phase: "terminal_settlement_published" }>;
      settledPhase: InternalProductionCurrentEntrySettledPhaseV1;
      entryAuthority: null; blockedReason: null;
    }>)
  | (InternalProductionCurrentEntryAuthorityStatusFixedPrefixV1 & Readonly<{
      state: "ready";
      preSchemaSpawnerRebindStatus: InternalProductionPreSchemaSpawnerRebindStatusPairV1;
      preSchemaSpawnerRebindStatusBody:
        InternalProductionCurrentEntryReadyRebindStatusV1;
      migrationApplyingPhase: Extract<InternalProductionCurrentEntryMigrationApplyingPhaseV1,
        { phase: "current_audited" }>;
      manifestActivation: InternalProductionCurrentEntryManifestActivationPairV1;
      spawnerAdmissionTransitionPhase:
        Extract<InternalProductionCurrentEntrySpawnerAdmissionTransitionPhaseV1,
          { phase: "runtime_observed" }>;
      canaryRunningPhase: Extract<InternalProductionCurrentEntryCanaryRunningPhaseV1,
        { phase: "terminal_settlement_published" }>;
      settledPhase: Extract<InternalProductionCurrentEntrySettledPhaseV1,
        { phase: "fence_released" }>;
      entryAuthority: InternalProductionCurrentEntryAuthorityPairV1;
      blockedReason: null;
    }>)
  | Readonly<{
      schema: "setfarm.internal-production-current-entry-authority-status.v1";
      state: "blocked";
      lastValidPrefix:
        | Readonly<{
            state: "absent";
            operationRef: null; operationHash: null;
            controllerSourceAuthority: null;
            productBuildAuthorityV2DeliveryEvidence: null;
            authorityV3Migration31Audit: null;
            pendingBootstrapHandoffMigration: null;
            preMutationLoadedRuntimeServiceAuthorityRef: null;
            preMutationLoadedRuntimeServiceAuthorityHash: null;
            preMutationLoadedRuntimeServiceAuthority: null;
            preSchemaSpawnerRebindStatus: null;
            preSchemaSpawnerRebindStatusBody: null;
            lastValidStatusRef: CanonicalRef; lastValidStatusHash: Sha256V1;
          }>
        | (Readonly<{
            operationRef: CanonicalRef; operationHash: Sha256V1;
            controllerSourceAuthority:
              InternalProductionCurrentEntryControllerSourceAuthorityV1;
            productBuildAuthorityV2DeliveryEvidence:
              ProductBuildAuthorityV2DeliveryEvidencePairV1;
            authorityV3Migration31Audit:
              InternalProductionAuthorityV3Migration31AuditPairV1;
            pendingBootstrapHandoffMigration:
              InternalProductionPendingBootstrapHandoffMigrationProjectionPairV1;
            preMutationLoadedRuntimeServiceAuthorityRef: CanonicalRef;
            preMutationLoadedRuntimeServiceAuthorityHash: Sha256V1;
            preMutationLoadedRuntimeServiceAuthority:
              InternalProductionPreMutationLoadedRuntimeServiceAuthorityV1;
            lastValidStatusRef: CanonicalRef; lastValidStatusHash: Sha256V1;
          }> & InternalProductionCurrentEntryLastValidRebindProjectionV1);
      blockedReason: InternalProductionCurrentEntryBlockedReasonCodeV1;
      statusRef: CanonicalRef; statusHash: Sha256V1;
    }>;
export interface InternalProductionCurrentEntryAuthorityStatusStoreV1 {
  publish(input: InternalProductionCurrentEntryAuthorityStatusV1):
    Promise<InternalProductionCurrentEntryAuthorityStatusPairV1>;
  resolve(input: InternalProductionCurrentEntryAuthorityStatusPairV1):
    Promise<InternalProductionCurrentEntryAuthorityStatusV1>;
  observeFixedStatus(): Promise<InternalProductionCurrentEntryAuthorityStatusV1>;
}

// Every non-null preSchemaSpawnerRebindStatus has the pair-resolved strict
// preSchemaSpawnerRebindStatusBody beside it. Body statusRef/statusHash equal
// the pair and currentEntryOperation equals the top-level operation. prepared
// has only operation+authorization; startup_token_published adds only its token;
// dispatching has exactly one restart_authority_published, predecessor_terminated,
// or replacement_observed prefix with exact nullability; the sealed state retains
// terminal predecessor/replacement pairs plus sealedAdmission; ready retains those
// pairs and adds admissionReady. Nonblocked top-level phases may expose only their
// corresponding partial, sealed, or ready body; blocked is never embedded there.

export function resolveInternalProductionCurrentEntryAuthorityStatusV1(
  input: InternalProductionCurrentEntryAuthorityStatusPairV1,
): Promise<InternalProductionCurrentEntryAuthorityStatusV1>;
export type InternalProductionCompleteZeroOwnerCensusObservationPairV1 =
  Readonly<{
    observationRef: CanonicalRef;
    observationHash: Sha256V1;
  }>;
export type InternalProductionCurrentEntryResolvedAuthoritySetV1 = readonly [
  Readonly<{ name: "productBuildAuthorityV2DeliveryEvidence";
    pair: ProductBuildAuthorityV2DeliveryEvidencePairV1 }>,
  Readonly<{ name: "authorityV3Migration31Audit";
    pair: InternalProductionAuthorityV3Migration31AuditPairV1 }>,
  Readonly<{ name: "pendingBootstrapHandoffMigration";
    pair: InternalProductionPendingBootstrapHandoffMigrationProjectionPairV1 }>,
  Readonly<{ name: "authorityV3FocusedTestReceipt"; pair: Readonly<{
    focusedAuthorityV3TestReceiptRef: CanonicalRef;
    focusedAuthorityV3TestReceiptHash: Sha256V1;
  }> }>,
  Readonly<{ name: "currentEntryOperation";
    pair: InternalProductionCurrentEntryOperationPairV1 }>,
  Readonly<{ name: "preMutationLoadedRuntimeServiceAuthority";
    pair: InternalProductionPreMutationLoadedRuntimeServiceAuthorityPairV1 }>,
  Readonly<{ name: "preSchemaSpawnerRebindAuthorization";
    pair: InternalProductionPreSchemaSpawnerRebindAuthorizationPairV1 }>,
  Readonly<{ name: "preSchemaSpawnerStartupToken";
    pair: InternalProductionPreSchemaSpawnerStartupTokenPairV1 }>,
  Readonly<{ name: "preSchemaSpawnerRestartAuthority";
    pair: InternalProductionPreSchemaSpawnerRestartAuthorityPairV1 }>,
  Readonly<{ name: "predecessorTerminationObservation";
    pair: InternalProductionPreSchemaSpawnerPredecessorTerminationObservationPairV1 }>,
  Readonly<{ name: "replacementProcessObservation";
    pair: InternalProductionPreSchemaSpawnerReplacementProcessObservationPairV1 }>,
  Readonly<{ name: "postPredecessorTerminationLegacyZeroOwnerObservation";
    pair: InternalProductionLegacyPreManifestZeroOwnerObservationPairV1 }>,
  Readonly<{ name: "preSchemaSpawnerSealedAdmission";
    pair: InternalProductionPreSchemaSpawnerSealedAdmissionPairV1 }>,
  Readonly<{ name: "freshLegacyZeroOwnerObservation";
    pair: InternalProductionLegacyPreManifestZeroOwnerObservationPairV1 }>,
  Readonly<{ name: "preManifestMigration32Authorization";
    pair: InternalProductionPreManifestMigration32AuthorizationPairV1 }>,
  Readonly<{ name: "preManifestMigration32AuthorizationConsumption";
    pair: InternalProductionPreManifestMigration32AuthorizationConsumptionPairV1 }>,
  Readonly<{ name: "bootstrapHandoffMigrationReceipt";
    pair: InternalProductionBaselineBootstrapHandoffMigrationReceiptPairV1 }>,
  Readonly<{ name: "bootstrapHandoffCurrentAudit"; pair: Readonly<{
    bootstrapHandoffCurrentAuditRef: CanonicalRef;
    bootstrapHandoffCurrentAuditHash: Sha256V1;
  }> }>,
  Readonly<{ name: "ownerProducerManifestActivation"; pair: Readonly<{
    ownerProducerManifestActivationRef: CanonicalRef;
    ownerProducerManifestActivationHash: Sha256V1;
  }> }>,
  Readonly<{ name: "ownerProducerManifestHead"; pair: Readonly<{
    ownerProducerManifestHeadRef: CanonicalRef;
    ownerProducerManifestHeadHash: Sha256V1;
  }> }>,
  Readonly<{ name: "task0SpawnerAdmissionReady";
    pair: InternalProductionTask0SpawnerAdmissionReadyPairV1 }>,
  Readonly<{ name: "preSchemaSpawnerRebindStatus";
    pair: InternalProductionPreSchemaSpawnerRebindStatusPairV1 }>,
  Readonly<{ name: "loadedRuntimeServiceAuthority"; pair: Readonly<{
    loadedRuntimeServiceAuthorityRef: CanonicalRef;
    loadedRuntimeServiceAuthorityHash: Sha256V1;
  }> }>,
  Readonly<{ name: "ownerAdmissionFence"; pair: Readonly<{
    ownerAdmissionFenceRef: CanonicalRef;
    ownerAdmissionFenceHash: Sha256V1;
  }> }>,
  Readonly<{ name: "sourceRunTargetReservation"; pair: Readonly<{
    sourceRunTargetReservationRef: CanonicalRef;
    sourceRunTargetReservationHash: Sha256V1;
  }> }>,
  Readonly<{ name: "runTargetReservation"; pair: Readonly<{
    runTargetReservationRef: CanonicalRef;
    runTargetReservationHash: Sha256V1;
  }> }>,
  Readonly<{ name: "terminalSettlement"; pair: Readonly<{
    terminalSettlementRef: CanonicalRef;
    terminalSettlementHash: Sha256V1;
  }> }>,
  Readonly<{ name: "targetClose"; pair: Readonly<{
    targetCloseRef: CanonicalRef;
    targetCloseHash: Sha256V1;
  }> }>,
  Readonly<{ name: "ownerAdmissionFenceRelease"; pair: Readonly<{
    ownerAdmissionFenceReleaseRef: CanonicalRef;
    ownerAdmissionFenceReleaseHash: Sha256V1;
  }> }>,
  Readonly<{ name: "currentEntryAuthority";
    pair: InternalProductionCurrentEntryAuthorityPairV1 }>,
  Readonly<{ name: "currentEntryStatus";
    pair: InternalProductionCurrentEntryAuthorityStatusPairV1 }>,
  Readonly<{ name: "completeZeroOwnerCensusObservation";
    pair: InternalProductionCompleteZeroOwnerCensusObservationPairV1 }>,
  Readonly<{ name: "freshRuntimeAndOwnerObservation";
    pair: InternalProductionCurrentEntryFreshRuntimeAndOwnerObservationPairV1 }>,
];
export function deriveInternalProductionCurrentEntryResolvedAuthoritySetHashV1(
  orderedPairs: InternalProductionCurrentEntryResolvedAuthoritySetV1,
): Sha256V1 {
  return hashCanonicalJson(orderedPairs);
}
export type InternalProductionCurrentEntryControllerRuntimeSourceRelationsV1 =
  Readonly<{
    controllerSourceAuthority:
      InternalProductionCurrentEntryControllerSourceAuthorityV1;
    loadedRuntimeServiceAuthority: Readonly<{
      loadedRuntimeServiceAuthorityRef: CanonicalRef;
      loadedRuntimeServiceAuthorityHash: Sha256V1;
    }>;
    spawner: Readonly<{
      relation: "equals-controller-source-authority";
      loadedSourceSha: GitObjectHashV1;
      loadedTreeHash: GitObjectHashV1;
      loadedBuildHash: Sha256V1;
    }>;
    dashboard: Readonly<{
      relation: "authenticated-delivered-runtime";
      loadedSourceSha: GitObjectHashV1;
      loadedTreeHash: GitObjectHashV1;
      loadedBuildHash: Sha256V1;
    }>;
    missionControl: Readonly<{
      relation: "authenticated-delivered-runtime";
      loadedSourceSha: GitObjectHashV1;
      loadedTreeHash: GitObjectHashV1;
      loadedBuildHash: Sha256V1;
    }>;
    openClaw: Readonly<{
      relation: "authenticated-process-generation-listener-only";
      loadedSourceSha: null;
      loadedTreeHash: null;
      loadedBuildHash: null;
    }>;
  }>;
export type Rfc3339UtcTimestampMillisV1 = string & {
  readonly __rfc3339UtcTimestampMillisV1: unique symbol;
};
export type InternalProductionCurrentEntryFreshRuntimeAndOwnerObservationPairV1 =
  Readonly<{
    freshRuntimeAndOwnerObservationRef: CanonicalRef;
    freshRuntimeAndOwnerObservationHash: Sha256V1;
  }>;
export type InternalProductionCurrentEntryFreshRuntimeAndOwnerObservationV1 =
  Readonly<{
    schema: "setfarm.internal-production-current-entry-fresh-runtime-and-owner-observation.v1";
    currentEntryStatus: InternalProductionCurrentEntryAuthorityStatusPairV1;
    entryAuthority: InternalProductionCurrentEntryAuthorityPairV1;
    serviceCensus: InternalProductionServiceCensusV1;
    completeZeroOwnerCensusObservation:
      InternalProductionCompleteZeroOwnerCensusObservationPairV1;
    completeZeroOwnerCensusObservationBody:
      InternalProductionCompleteZeroOwnerCensusObservationV1;
    controllerRuntimeSourceRelations:
      InternalProductionCurrentEntryControllerRuntimeSourceRelationsV1;
    observedAt: Rfc3339UtcTimestampMillisV1;
    freshRuntimeAndOwnerObservationRef: CanonicalRef;
    freshRuntimeAndOwnerObservationHash: Sha256V1;
  }>;
export function deriveInternalProductionCurrentEntryFreshObservationHashV1(
  input: InternalProductionCurrentEntryFreshRuntimeAndOwnerObservationV1,
): Sha256V1 {
  return hashCanonicalJson({
    schema: input.schema,
    currentEntryStatus: input.currentEntryStatus,
    entryAuthority: input.entryAuthority,
    serviceCensus: input.serviceCensus,
    completeZeroOwnerCensusObservation:
      input.completeZeroOwnerCensusObservation,
    completeZeroOwnerCensusObservationBody:
      input.completeZeroOwnerCensusObservationBody,
    controllerRuntimeSourceRelations: input.controllerRuntimeSourceRelations,
    observedAt: input.observedAt,
  });
}
export interface InternalProductionCurrentEntryFreshRuntimeAndOwnerObservationStoreV1 {
  publish(input: InternalProductionCurrentEntryFreshRuntimeAndOwnerObservationV1):
    Promise<InternalProductionCurrentEntryFreshRuntimeAndOwnerObservationPairV1>;
  resolve(input: InternalProductionCurrentEntryFreshRuntimeAndOwnerObservationPairV1):
    Promise<InternalProductionCurrentEntryFreshRuntimeAndOwnerObservationV1>;
}
export function resolveInternalProductionCurrentEntryFreshRuntimeAndOwnerObservationV1(
  input: InternalProductionCurrentEntryFreshRuntimeAndOwnerObservationPairV1,
): Promise<InternalProductionCurrentEntryFreshRuntimeAndOwnerObservationV1>;
export type InternalProductionCurrentEntryVerificationPairV1 = Readonly<{
  currentEntryVerificationRef: CanonicalRef;
  currentEntryVerificationHash: Sha256V1;
}>;
export type InternalProductionCurrentEntryVerificationV1 = Readonly<{
  schema: "setfarm.internal-production-current-entry-verification.v1";
  currentStatus: "current";
  currentEntryStatus: InternalProductionCurrentEntryAuthorityStatusPairV1;
  entryAuthority: InternalProductionCurrentEntryAuthorityPairV1;
  resolvedAuthoritySetHash: Sha256V1;
  freshRuntimeAndOwnerObservation:
    InternalProductionCurrentEntryFreshRuntimeAndOwnerObservationPairV1;
  currentEntryVerificationRef: CanonicalRef;
  currentEntryVerificationHash: Sha256V1;
}>;
export function deriveInternalProductionCurrentEntryVerificationHashV1(
  input: InternalProductionCurrentEntryVerificationV1,
): Sha256V1 {
  return hashCanonicalJson({
    schema: input.schema,
    currentStatus: input.currentStatus,
    currentEntryStatus: input.currentEntryStatus,
    entryAuthority: input.entryAuthority,
    resolvedAuthoritySetHash: input.resolvedAuthoritySetHash,
    freshRuntimeAndOwnerObservation: input.freshRuntimeAndOwnerObservation,
  });
}
export interface InternalProductionCurrentEntryVerificationStoreV1 {
  publish(input: InternalProductionCurrentEntryVerificationV1):
    Promise<InternalProductionCurrentEntryVerificationPairV1>;
  resolve(input: InternalProductionCurrentEntryVerificationPairV1):
    Promise<InternalProductionCurrentEntryVerificationV1>;
}
export function resolveInternalProductionCurrentEntryVerificationV1(
  input: InternalProductionCurrentEntryVerificationPairV1,
): Promise<InternalProductionCurrentEntryVerificationV1>;
export function verifyCurrentInternalProductionCurrentEntryV1():
  Promise<InternalProductionCurrentEntryVerificationV1>;
export type InternalProductionPreSchemaSpawnerRebindRefusalCodeV1 =
  | "CURRENT_ENTRY_OPERATION_NOT_PREPARED"
  | "CURRENT_ENTRY_OPERATION_MISMATCH"
  | "PREDECESSOR_IDENTITY_OR_TERMINATION_MISMATCH"
  | "REPLACEMENT_IDENTITY_OR_SOURCE_MISMATCH"
  | "POST_TERMINATION_LEGACY_OWNER_NONZERO"
  | "SEALED_STARTUP_ADMISSION_INVALID"
  | "NORMAL_FULL_VERIFY_OR_DB_INITIALIZATION_FAILED";
export type InternalProductionTask0SpawnerAdmissionReadyV1 = Readonly<{
  schema: "setfarm.internal-production-task0-spawner-admission-ready.v1";
  state: "normal-task0-admission-ready";
  currentEntryOperationRef: CanonicalRef;
  currentEntryOperationHash: Sha256V1;
  preSchemaSpawnerRebindAuthorizationRef: CanonicalRef;
  preSchemaSpawnerRebindAuthorizationHash: Sha256V1;
  startupTokenRef: CanonicalRef;
  startupTokenHash: Sha256V1;
  restartAuthorityRef: CanonicalRef;
  restartAuthorityHash: Sha256V1;
  predecessorTerminationObservationRef: CanonicalRef;
  predecessorTerminationObservationHash: Sha256V1;
  replacementProcessObservationRef: CanonicalRef;
  replacementProcessObservationHash: Sha256V1;
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
export type InternalProductionPreSchemaSpawnerRebindStatusPairV1 = Readonly<{
  statusRef: CanonicalRef;
  statusHash: Sha256V1;
}>;
type InternalProductionPreSchemaSpawnerDispatchPrefixV1 =
  | Readonly<{
      phase: "restart_authority_published";
      predecessorTerminationObservation: null;
      replacementProcessObservation: null;
    }>
  | Readonly<{
      phase: "predecessor_terminated";
      predecessorTerminationObservation:
        InternalProductionPreSchemaSpawnerPredecessorTerminationObservationPairV1;
      replacementProcessObservation: null;
    }>
  | Readonly<{
      phase: "replacement_observed";
      predecessorTerminationObservation:
        InternalProductionPreSchemaSpawnerPredecessorTerminationObservationPairV1;
      replacementProcessObservation:
        InternalProductionPreSchemaSpawnerReplacementProcessObservationPairV1;
    }>;
export type InternalProductionPreSchemaSpawnerRebindStatusV1 =
  | Readonly<{
      schema: "setfarm.internal-production-pre-schema-spawner-rebind-status.v1";
      state: "absent";
      currentEntryOperation: null; authorization: null; startupToken: null;
      restartAuthority: null; dispatchPrefix: null; sealedAdmission: null;
      admissionReady: null; refusalCode: null;
      statusRef: CanonicalRef; statusHash: Sha256V1;
    }>
  | Readonly<{
      schema: "setfarm.internal-production-pre-schema-spawner-rebind-status.v1";
      state: "prepared";
      currentEntryOperation: InternalProductionCurrentEntryOperationPairV1;
      authorization: InternalProductionPreSchemaSpawnerRebindAuthorizationPairV1;
      startupToken: null; restartAuthority: null; dispatchPrefix: null;
      sealedAdmission: null; admissionReady: null; refusalCode: null;
      statusRef: CanonicalRef; statusHash: Sha256V1;
    }>
  | Readonly<{
      schema: "setfarm.internal-production-pre-schema-spawner-rebind-status.v1";
      state: "startup_token_published";
      currentEntryOperation: InternalProductionCurrentEntryOperationPairV1;
      authorization: InternalProductionPreSchemaSpawnerRebindAuthorizationPairV1;
      startupToken: InternalProductionPreSchemaSpawnerStartupTokenPairV1;
      restartAuthority: null; dispatchPrefix: null; sealedAdmission: null;
      admissionReady: null; refusalCode: null;
      statusRef: CanonicalRef; statusHash: Sha256V1;
    }>
  | Readonly<{
      schema: "setfarm.internal-production-pre-schema-spawner-rebind-status.v1";
      state: "dispatching";
      currentEntryOperation: InternalProductionCurrentEntryOperationPairV1;
      authorization: InternalProductionPreSchemaSpawnerRebindAuthorizationPairV1;
      startupToken: InternalProductionPreSchemaSpawnerStartupTokenPairV1;
      restartAuthority: InternalProductionPreSchemaSpawnerRestartAuthorityPairV1;
      dispatchPrefix: InternalProductionPreSchemaSpawnerDispatchPrefixV1;
      sealedAdmission: null; admissionReady: null; refusalCode: null;
      statusRef: CanonicalRef; statusHash: Sha256V1;
    }>
  | Readonly<{
      schema: "setfarm.internal-production-pre-schema-spawner-rebind-status.v1";
      state: "pre_manifest_bootstrap_sealed";
      currentEntryOperation: InternalProductionCurrentEntryOperationPairV1;
      authorization: InternalProductionPreSchemaSpawnerRebindAuthorizationPairV1;
      startupToken: InternalProductionPreSchemaSpawnerStartupTokenPairV1;
      restartAuthority: InternalProductionPreSchemaSpawnerRestartAuthorityPairV1;
      dispatchPrefix: Extract<InternalProductionPreSchemaSpawnerDispatchPrefixV1,
        { phase: "replacement_observed" }>;
      sealedAdmission: InternalProductionPreSchemaSpawnerSealedAdmissionPairV1;
      admissionReady: null; refusalCode: null;
      statusRef: CanonicalRef; statusHash: Sha256V1;
    }>
  | Readonly<{
      schema: "setfarm.internal-production-pre-schema-spawner-rebind-status.v1";
      state: "normal_task0_admission_ready";
      currentEntryOperation: InternalProductionCurrentEntryOperationPairV1;
      authorization: InternalProductionPreSchemaSpawnerRebindAuthorizationPairV1;
      startupToken: InternalProductionPreSchemaSpawnerStartupTokenPairV1;
      restartAuthority: InternalProductionPreSchemaSpawnerRestartAuthorityPairV1;
      dispatchPrefix: Extract<InternalProductionPreSchemaSpawnerDispatchPrefixV1,
        { phase: "replacement_observed" }>;
      sealedAdmission: InternalProductionPreSchemaSpawnerSealedAdmissionPairV1;
      admissionReady: InternalProductionTask0SpawnerAdmissionReadyPairV1;
      refusalCode: null; statusRef: CanonicalRef; statusHash: Sha256V1;
    }>
  | Readonly<{
      schema: "setfarm.internal-production-pre-schema-spawner-rebind-status.v1";
      state: "blocked";
      lastValidState: "absent" | "prepared" | "startup_token_published" |
        "dispatching" | "pre_manifest_bootstrap_sealed" |
        "normal_task0_admission_ready";
      lastValidStatusRef: CanonicalRef;
      lastValidStatusHash: Sha256V1;
      refusalCode: InternalProductionPreSchemaSpawnerRebindRefusalCodeV1;
      statusRef: CanonicalRef; statusHash: Sha256V1;
    }>;
export interface InternalProductionPreSchemaSpawnerRebindAuthorizationStoreV1 {
  prepare(input: InternalProductionPreSchemaSpawnerRebindAuthorizationV1):
    Promise<InternalProductionPreSchemaSpawnerRebindAuthorizationPairV1>;
  resolve(input: InternalProductionPreSchemaSpawnerRebindAuthorizationPairV1):
    Promise<InternalProductionPreSchemaSpawnerRebindAuthorizationV1>;
}
export interface InternalProductionPreSchemaSpawnerStartupTokenStoreV1 {
  publish(input: InternalProductionPreSchemaSpawnerStartupTokenV1):
    Promise<InternalProductionPreSchemaSpawnerStartupTokenPairV1>;
  resolve(input: InternalProductionPreSchemaSpawnerStartupTokenPairV1):
    Promise<InternalProductionPreSchemaSpawnerStartupTokenV1>;
}
export interface InternalProductionPreSchemaSpawnerRestartAuthorityStoreV1 {
  publish(input: InternalProductionPreSchemaSpawnerRestartAuthorityV1):
    Promise<InternalProductionPreSchemaSpawnerRestartAuthorityPairV1>;
  resolve(input: InternalProductionPreSchemaSpawnerRestartAuthorityPairV1):
    Promise<InternalProductionPreSchemaSpawnerRestartAuthorityV1>;
}
export interface InternalProductionPreSchemaSpawnerPredecessorTerminationObservationStoreV1 {
  publish(input: InternalProductionPreSchemaSpawnerPredecessorTerminationObservationV1):
    Promise<InternalProductionPreSchemaSpawnerPredecessorTerminationObservationPairV1>;
  resolve(input: InternalProductionPreSchemaSpawnerPredecessorTerminationObservationPairV1):
    Promise<InternalProductionPreSchemaSpawnerPredecessorTerminationObservationV1>;
}
export interface InternalProductionPreSchemaSpawnerReplacementProcessObservationStoreV1 {
  publish(input: InternalProductionPreSchemaSpawnerReplacementProcessObservationV1):
    Promise<InternalProductionPreSchemaSpawnerReplacementProcessObservationPairV1>;
  resolve(input: InternalProductionPreSchemaSpawnerReplacementProcessObservationPairV1):
    Promise<InternalProductionPreSchemaSpawnerReplacementProcessObservationV1>;
}
export interface InternalProductionPreSchemaSpawnerSealedAdmissionStoreV1 {
  publish(input: InternalProductionPreSchemaSpawnerSealedAdmissionV1):
    Promise<InternalProductionPreSchemaSpawnerSealedAdmissionPairV1>;
  resolve(input: InternalProductionPreSchemaSpawnerSealedAdmissionPairV1):
    Promise<InternalProductionPreSchemaSpawnerSealedAdmissionV1>;
}
export interface InternalProductionTask0SpawnerAdmissionReadyStoreV1 {
  publish(input: InternalProductionTask0SpawnerAdmissionReadyV1):
    Promise<InternalProductionTask0SpawnerAdmissionReadyPairV1>;
  resolve(input: InternalProductionTask0SpawnerAdmissionReadyPairV1):
    Promise<InternalProductionTask0SpawnerAdmissionReadyV1>;
}
export interface InternalProductionPreSchemaSpawnerRebindStatusStoreV1 {
  publish(input: InternalProductionPreSchemaSpawnerRebindStatusV1):
    Promise<InternalProductionPreSchemaSpawnerRebindStatusPairV1>;
  resolve(input: InternalProductionPreSchemaSpawnerRebindStatusPairV1):
    Promise<InternalProductionPreSchemaSpawnerRebindStatusV1>;
  observeFixedStatus(): Promise<InternalProductionPreSchemaSpawnerRebindStatusV1>;
}
export function prepareInternalProductionPreSchemaSpawnerRebindAuthorizationV1():
  Promise<InternalProductionPreSchemaSpawnerRebindAuthorizationPairV1>;
export function executeOrRecoverInternalProductionPreSchemaSpawnerRebindV1(
  input: InternalProductionPreSchemaSpawnerRebindAuthorizationPairV1,
): Promise<InternalProductionPreSchemaSpawnerRestartAuthorityPairV1>;
export function resolveInternalProductionPreSchemaSpawnerRebindAuthorizationV1(
  input: InternalProductionPreSchemaSpawnerRebindAuthorizationPairV1,
): Promise<InternalProductionPreSchemaSpawnerRebindAuthorizationV1>;
export function observeInternalProductionPreSchemaSpawnerRebindStatusV1():
  Promise<InternalProductionPreSchemaSpawnerRebindStatusV1>;
export function resolveInternalProductionPreSchemaSpawnerRebindStatusV1(
  input: InternalProductionPreSchemaSpawnerRebindStatusPairV1,
): Promise<InternalProductionPreSchemaSpawnerRebindStatusV1>;
export function resolveInternalProductionPreSchemaSpawnerStartupTokenV1(
  input: InternalProductionPreSchemaSpawnerStartupTokenPairV1,
): Promise<InternalProductionPreSchemaSpawnerStartupTokenV1>;
export function resolveInternalProductionPreSchemaSpawnerRestartAuthorityV1(
  input: InternalProductionPreSchemaSpawnerRestartAuthorityPairV1,
): Promise<InternalProductionPreSchemaSpawnerRestartAuthorityV1>;
export function resolveInternalProductionPreSchemaSpawnerPredecessorTerminationObservationV1(
  input: InternalProductionPreSchemaSpawnerPredecessorTerminationObservationPairV1,
): Promise<InternalProductionPreSchemaSpawnerPredecessorTerminationObservationV1>;
export function resolveInternalProductionPreSchemaSpawnerReplacementProcessObservationV1(
  input: InternalProductionPreSchemaSpawnerReplacementProcessObservationPairV1,
): Promise<InternalProductionPreSchemaSpawnerReplacementProcessObservationV1>;
export function resolveInternalProductionPreSchemaSpawnerSealedAdmissionV1(
  input: InternalProductionPreSchemaSpawnerSealedAdmissionPairV1,
): Promise<InternalProductionPreSchemaSpawnerSealedAdmissionV1>;
export function resolveInternalProductionTask0SpawnerAdmissionReadyV1(
  input: InternalProductionTask0SpawnerAdmissionReadyPairV1,
): Promise<InternalProductionTask0SpawnerAdmissionReadyV1>;

export type InternalProductionPreManifestMigration32AuthorizationPairV1 = Readonly<{
  authorizationRef: CanonicalRef;
  authorizationHash: Sha256V1;
}>;
export type InternalProductionPreManifestMigration32AuthorizationV1 = Readonly<{
  schema: "setfarm.internal-production-pre-manifest-migration-32-authorization.v1";
  purpose: "task6a-guarded-migration-32-after-sealed-spawner-v1";
  currentEntryOperationRef: CanonicalRef;
  currentEntryOperationHash: Sha256V1;
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
export type InternalProductionPreManifestMigration32AuthorizationConsumptionPairV1 =
  Readonly<{ consumptionRef: CanonicalRef; consumptionHash: Sha256V1 }>;
export type InternalProductionPreManifestMigration32AuthorizationConsumptionV1 = Readonly<{
  schema: "setfarm.internal-production-pre-manifest-migration-32-authorization-consumption.v1";
  currentEntryOperationRef: CanonicalRef;
  currentEntryOperationHash: Sha256V1;
  authorizationRef: CanonicalRef;
  authorizationHash: Sha256V1;
  sealedSpawnerAdmissionRef: CanonicalRef;
  sealedSpawnerAdmissionHash: Sha256V1;
  migrationId: "contract-spine-bootstrap-main-claim-handoff-v1";
  migrationOrdinal: 32;
  consumptionRef: CanonicalRef;
  consumptionHash: Sha256V1;
}>;
export type InternalProductionBaselineBootstrapHandoffMigrationReceiptPairV1 = Readonly<{
  migrationReceiptRef: CanonicalRef;
  migrationReceiptHash: Sha256V1;
}>;
export type InternalProductionPreManifestMigration32AuthorizationStatusPairV1 =
  Readonly<{ statusRef: CanonicalRef; statusHash: Sha256V1 }>;
export type InternalProductionPreManifestMigration32AuthorizationStatusV1 =
  | Readonly<{
      schema: "setfarm.internal-production-pre-manifest-migration-32-authorization-status.v1";
      state: "absent";
      currentEntryOperation: null; authorization: null; consumption: null;
      migrationReceipt: null; refusalCode: null;
      statusRef: CanonicalRef; statusHash: Sha256V1;
    }>
  | Readonly<{
      schema: "setfarm.internal-production-pre-manifest-migration-32-authorization-status.v1";
      state: "prepared";
      currentEntryOperation: InternalProductionCurrentEntryOperationPairV1;
      authorization: InternalProductionPreManifestMigration32AuthorizationPairV1;
      consumption: null; migrationReceipt: null; refusalCode: null;
      statusRef: CanonicalRef; statusHash: Sha256V1;
    }>
  | Readonly<{
      schema: "setfarm.internal-production-pre-manifest-migration-32-authorization-status.v1";
      state: "consumed";
      currentEntryOperation: InternalProductionCurrentEntryOperationPairV1;
      authorization: InternalProductionPreManifestMigration32AuthorizationPairV1;
      consumption: InternalProductionPreManifestMigration32AuthorizationConsumptionPairV1;
      migrationReceipt: null; refusalCode: null;
      statusRef: CanonicalRef; statusHash: Sha256V1;
    }>
  | Readonly<{
      schema: "setfarm.internal-production-pre-manifest-migration-32-authorization-status.v1";
      state: "terminal";
      currentEntryOperation: InternalProductionCurrentEntryOperationPairV1;
      authorization: InternalProductionPreManifestMigration32AuthorizationPairV1;
      consumption: InternalProductionPreManifestMigration32AuthorizationConsumptionPairV1;
      migrationReceipt: InternalProductionBaselineBootstrapHandoffMigrationReceiptPairV1;
      refusalCode: null; statusRef: CanonicalRef; statusHash: Sha256V1;
    }>
  | Readonly<{
      schema: "setfarm.internal-production-pre-manifest-migration-32-authorization-status.v1";
      state: "blocked";
      lastValidState: "absent" | "prepared" | "consumed" | "terminal";
      lastValidStatusRef: CanonicalRef;
      lastValidStatusHash: Sha256V1;
      refusalCode: "SEALED_ADMISSION_INVALID" | "LEGACY_ZERO_REOBSERVATION_DRIFT" |
        "AUTHORIZATION_REPLAY" | "MIGRATION_TRANSACTION_FAILED";
      statusRef: CanonicalRef; statusHash: Sha256V1;
    }>;
export interface InternalProductionPreManifestMigration32AuthorizationStoreV1 {
  prepare(input: InternalProductionPreManifestMigration32AuthorizationV1):
    Promise<InternalProductionPreManifestMigration32AuthorizationPairV1>;
  resolve(input: InternalProductionPreManifestMigration32AuthorizationPairV1):
    Promise<InternalProductionPreManifestMigration32AuthorizationV1>;
}
export interface InternalProductionPreManifestMigration32AuthorizationConsumptionStoreV1 {
  publish(input: InternalProductionPreManifestMigration32AuthorizationConsumptionV1):
    Promise<InternalProductionPreManifestMigration32AuthorizationConsumptionPairV1>;
  resolve(input: InternalProductionPreManifestMigration32AuthorizationConsumptionPairV1):
    Promise<InternalProductionPreManifestMigration32AuthorizationConsumptionV1>;
}
export interface InternalProductionPreManifestMigration32AuthorizationStatusStoreV1 {
  publish(input: InternalProductionPreManifestMigration32AuthorizationStatusV1):
    Promise<InternalProductionPreManifestMigration32AuthorizationStatusPairV1>;
  resolve(input: InternalProductionPreManifestMigration32AuthorizationStatusPairV1):
    Promise<InternalProductionPreManifestMigration32AuthorizationStatusV1>;
  observeFixedStatus(): Promise<InternalProductionPreManifestMigration32AuthorizationStatusV1>;
}
export function prepareInternalProductionPreManifestMigration32AuthorizationV1():
  Promise<InternalProductionPreManifestMigration32AuthorizationPairV1>;
export function resolveInternalProductionPreManifestMigration32AuthorizationV1(
  input: InternalProductionPreManifestMigration32AuthorizationPairV1,
): Promise<InternalProductionPreManifestMigration32AuthorizationV1>;
export function resolveInternalProductionPreManifestMigration32AuthorizationConsumptionV1(
  input: InternalProductionPreManifestMigration32AuthorizationConsumptionPairV1,
): Promise<InternalProductionPreManifestMigration32AuthorizationConsumptionV1>;
export function observeInternalProductionPreManifestMigration32AuthorizationStatusV1():
  Promise<InternalProductionPreManifestMigration32AuthorizationStatusV1>;
export function resolveInternalProductionPreManifestMigration32AuthorizationStatusV1(
  input: InternalProductionPreManifestMigration32AuthorizationStatusPairV1,
): Promise<InternalProductionPreManifestMigration32AuthorizationStatusV1>;

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
  currentEntryOperationRef: CanonicalRef;
  currentEntryOperationHash: string;
  preSchemaSpawnerRebindAuthorizationRef: CanonicalRef;
  preSchemaSpawnerRebindAuthorizationHash: string;
  preSchemaSpawnerStartupTokenRef: CanonicalRef;
  preSchemaSpawnerStartupTokenHash: string;
  preSchemaSpawnerRestartAuthorityRef: CanonicalRef;
  preSchemaSpawnerRestartAuthorityHash: string;
  predecessorTerminationObservationRef: CanonicalRef;
  predecessorTerminationObservationHash: string;
  replacementProcessObservationRef: CanonicalRef;
  replacementProcessObservationHash: string;
  preSchemaSpawnerSealedAdmissionRef: CanonicalRef;
  preSchemaSpawnerSealedAdmissionHash: string;
  postPredecessorTerminationLegacyZeroOwnerObservationRef: CanonicalRef;
  postPredecessorTerminationLegacyZeroOwnerObservationHash: string;
  freshLegacyZeroOwnerObservationRef: CanonicalRef;
  freshLegacyZeroOwnerObservationHash: string;
  preManifestMigration32AuthorizationRef: CanonicalRef;
  preManifestMigration32AuthorizationHash: string;
  preManifestMigration32AuthorizationConsumptionRef: CanonicalRef;
  preManifestMigration32AuthorizationConsumptionHash: string;
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
  ownerCategoryRegistryHash: Sha256V1;
  ownerCategoryCensusMapHash: Sha256V1;
  activeProducerManifestSetActivationRef: CanonicalRef;
  activeProducerManifestSetActivationHash: Sha256V1;
  activeProducerManifestSetHash: Sha256V1;
  reservationIdentitySetHash: Sha256V1;
  ownerIdentitySetHash: Sha256V1;
  observationRef: CanonicalRef;
  observationHash: Sha256V1;
}>;
export interface InternalProductionCompleteZeroOwnerCensusObservationStoreV1 {
  publish(input: InternalProductionCompleteZeroOwnerCensusObservationV1):
    Promise<InternalProductionCompleteZeroOwnerCensusObservationPairV1>;
  resolve(input: InternalProductionCompleteZeroOwnerCensusObservationPairV1):
    Promise<InternalProductionCompleteZeroOwnerCensusObservationV1>;
}
export function observeCompleteInternalProductionZeroOwnerCensusV1():
  Promise<InternalProductionCompleteZeroOwnerCensusObservationV1>;
export function resolveInternalProductionCompleteZeroOwnerCensusObservationV1(
  input: InternalProductionCompleteZeroOwnerCensusObservationPairV1,
): Promise<InternalProductionCompleteZeroOwnerCensusObservationV1>;

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
  { plan: "A", module: "src/execution/run-persistence.ts", function: "persistWorkflowRunInTransaction", implementationId: "a-runtime-run-v1", category: "run", ownerKeyDerivationId: "run-id-generation-v1", censusKeys: ["activeRunCount"] },
  { plan: "A", module: "src/execution/claim-runtime-publication.ts", function: "publishSingleClaimRuntime", implementationId: "a-claim-single-runtime-v1", category: "claim", ownerKeyDerivationId: "claim-log-id-v1", censusKeys: ["openClaimCount"] },
  { plan: "A", module: "src/execution/claim-runtime-publication.ts", function: "publishLoopClaimRuntime", implementationId: "a-claim-loop-runtime-v1", category: "claim", ownerKeyDerivationId: "claim-log-id-v1", censusKeys: ["openClaimCount"] },
  { plan: "A", module: "src/recovery/v3-downstream-evidence-publication.ts", function: "createV3DownstreamEvidencePublication.reserve", implementationId: "a-claim-v3-downstream-evidence-v1", category: "claim", ownerKeyDerivationId: "claim-log-id-v1", censusKeys: ["openClaimCount"] },
  { plan: "A", module: "src/recovery/v3-evidence-only-publication.ts", function: "createV3EvidenceOnlyPublication.reserve", implementationId: "a-claim-v3-evidence-only-v1", category: "claim", ownerKeyDerivationId: "claim-log-id-v1", censusKeys: ["openClaimCount"] },
  { plan: "A", module: "src/execution/attempt-repository.ts", function: "reserveAttemptInTransaction", implementationId: "a-execution-attempt-v1", category: "execution-attempt", ownerKeyDerivationId: "execution-attempt-id-generation-v1", censusKeys: ["executionAttemptCount"] },
  { plan: "A", module: "src/execution/runtime-session-repository.ts", function: "reserveRuntimeSessionInTransaction", implementationId: "a-runtime-session-v1", category: "runtime-session", ownerKeyDerivationId: "runtime-session-id-v1", censusKeys: ["activeRuntimeSessionCount"] },
  { plan: "A", module: "src/execution/runtime-completion.ts", function: "createRuntimeCompletionRepository.claim", implementationId: "a-completion-owner-v1", category: "completion-owner", ownerKeyDerivationId: "completion-request-id-v1", censusKeys: ["activeCompletionOwnerCount"] },
  { plan: "A", module: "src/execution/runtime-completion.ts", function: "markRuntimeCompletionOwnerCommittedInTransaction", implementationId: "a-mandatory-effect-v1", category: "mandatory-effect", ownerKeyDerivationId: "completion-request-id-effect-key-v1", censusKeys: ["unsettledMandatoryEffectCount"] },
  { plan: "A", module: "src/execution/run-termination.ts", function: "requestRunTerminationInTransaction", implementationId: "a-termination-v1", category: "termination", ownerKeyDerivationId: "termination-request-id-v1", censusKeys: ["terminationOwnerCount"] },
  { plan: "A", module: "src/recovery/finding-recovery-repository.ts", function: "createFindingRecoveryRepository.putFindingSet", implementationId: "a-finding-recovery-repository-v1", category: "finding", ownerKeyDerivationId: "finding-set-hash-v1", censusKeys: ["findingOwnerCount"] },
  { plan: "A", module: "src/recovery/v3-downstream-evidence-publication.ts", function: "putFindingSet", implementationId: "a-finding-v3-downstream-evidence-v1", category: "finding", ownerKeyDerivationId: "finding-set-hash-v1", censusKeys: ["findingOwnerCount"] },
  { plan: "A", module: "src/recovery/v3-evidence-only-publication.ts", function: "putFindingSetInTransaction", implementationId: "a-finding-v3-evidence-only-v1", category: "finding", ownerKeyDerivationId: "finding-set-hash-v1", censusKeys: ["findingOwnerCount"] },
  { plan: "A", module: "src/execution/operational-outbox-repository.ts", function: "createOperationalOutboxRepository.publish", implementationId: "a-operational-delivery-v1", category: "operational-delivery", ownerKeyDerivationId: "operational-event-key-consumer-v1", censusKeys: ["operationalDeliveryCount"] },
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

export type InternalProductionOwnerProducerSourceBuildAuthorityPairV1 = Readonly<{
  plan: "A" | "B" | "C" | "D" | "E";
  sourceBuildAuthorityRef: CanonicalRef;
  sourceBuildAuthorityHash: Sha256V1;
}>;
export type InternalProductionOwnerProducerSourceBuildAuthorityAV1 = Readonly<{
  schema: "setfarm.internal-production-owner-producer-source-build-authority-a.v1";
  plan: "A";
  manifestHash: Sha256V1;
  currentEntryOperationRef: CanonicalRef;
  currentEntryOperationHash: Sha256V1;
  setfarmSource: Readonly<{
    branch: "main";
    clean: true;
    sha: GitObjectHashV1;
    treeHash: GitObjectHashV1;
    buildHash: Sha256V1;
    originMainSha: GitObjectHashV1;
  }>;
  productBuildAuthorityV2DeliveryEvidenceRef: CanonicalRef;
  productBuildAuthorityV2DeliveryEvidenceHash: Sha256V1;
  productBuildAuthorityV2Observation:
    ProductBuildAuthorityV2DeliveryEvidenceObservationV1;
  vendorProducerCommit: GitObjectHashV1;
  vendorProducerCommitAncestorProof: Readonly<{
    schema: "setfarm.internal-production-vendor-ancestor-proof.v1";
    vendorProducerCommit: GitObjectHashV1;
    setfarmSourceSha: GitObjectHashV1;
    mergeBase: GitObjectHashV1;
    verified: true;
  }>;
  ownerCategoryRegistryHash: Sha256V1;
  ownerCategoryCensusMapHash: Sha256V1;
  sourceBuildAuthorityRef: CanonicalRef;
  sourceBuildAuthorityHash: Sha256V1;
}>;
export type InternalProductionOwnerProducerSourceBuildAuthorityV1 =
  InternalProductionOwnerProducerSourceBuildAuthorityAV1;

export type InternalProductionOwnerProducerManifestSetPhaseV1 =
  | "A" | "A+B" | "A+B+C" | "A+B+C+D" | "A+B+C+D+E";
export type InternalProductionOwnerProducerManifestSetActivationReceiptV1 = Readonly<{
  schema: "setfarm.internal-production-owner-producer-manifest-set-activation.v1";
  phase: InternalProductionOwnerProducerManifestSetPhaseV1;
  orderedPlans: readonly ("A" | "B" | "C" | "D" | "E")[];
  orderedManifestHashes: readonly string[];
  orderedSourceBuildAuthorities:
    readonly InternalProductionOwnerProducerSourceBuildAuthorityPairV1[];
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
  currentRevision: number;
  head: InternalProductionOwnerProducerManifestSetActivationHeadV1;
  receipt: InternalProductionOwnerProducerManifestSetActivationReceiptV1;
}>;
export type InternalProductionOwnerProducerManifestSetActivationPairV1 = Readonly<{
  activationRef: CanonicalRef;
  activationHash: Sha256V1;
}>;
export type InternalProductionOwnerProducerManifestSetActivationHeadPairV1 = Readonly<{
  headRef: CanonicalRef;
  headHash: Sha256V1;
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
      receiptRef: null; receiptHash: null;
      manifestHash: null;
      sourceBuildAuthorityRef: null; sourceBuildAuthorityHash: null;
      blockedReason: null;
      statusRef: CanonicalRef; statusHash: Sha256V1;
    }>
  | Readonly<{
      schema: "setfarm.internal-production-baseline-owner-producer-manifest-activation-status.v1";
      state: "blocked";
      predecessorActivationRef: null; predecessorActivationHash: null;
      predecessorHeadRef: null; predecessorHeadHash: null;
      successorActivationRef: null; successorActivationHash: null;
      successorHeadRef: null; successorHeadHash: null;
      receiptRef: null; receiptHash: null;
      manifestHash: null;
      sourceBuildAuthorityRef: null; sourceBuildAuthorityHash: null;
      blockedReason: "SUPERSEDED" | "CORRUPTION";
      statusRef: CanonicalRef; statusHash: Sha256V1;
    }>
  | Readonly<{
      schema: "setfarm.internal-production-baseline-owner-producer-manifest-activation-status.v1";
      state: "active";
      predecessorActivationRef: null; predecessorActivationHash: null;
      predecessorHeadRef: null; predecessorHeadHash: null;
      successorActivationRef: CanonicalRef; successorActivationHash: Sha256V1;
      successorHeadRef: CanonicalRef; successorHeadHash: Sha256V1;
      receiptRef: CanonicalRef; receiptHash: Sha256V1;
      manifestHash: Sha256V1;
      sourceBuildAuthorityRef: CanonicalRef;
      sourceBuildAuthorityHash: Sha256V1;
      blockedReason: null;
      statusRef: CanonicalRef; statusHash: Sha256V1;
    }>;
export function activateInternalProductionBaselineOwnerProducerManifestV1():
  Promise<InternalProductionBaselineOwnerProducerManifestActivationReceiptV1>;
export function observeInternalProductionBaselineOwnerProducerManifestActivationStatusV1():
  Promise<InternalProductionBaselineOwnerProducerManifestActivationStatusV1>;

// receiptHash = hashCanonicalJson({schema,plan,manifestHash,
//   sourceBuildAuthorityRef,sourceBuildAuthorityHash,
//   predecessorActivationRef,predecessorActivationHash,
//   predecessorHeadRef,predecessorHeadHash,successorActivationRef,
//   successorActivationHash,successorHeadRef,successorHeadHash})
// receiptRef = setfarm://internal-production/baseline-owner-producer-manifest-activation-receipt/sha256/<receiptHash>
// statusHash = hashCanonicalJson(all declared members except statusRef/statusHash)
// statusRef = setfarm://internal-production/baseline-owner-producer-manifest-activation-status/sha256/<statusHash>
export interface InternalProductionOwnerProducerManifestSetActivationStoreV1 {
  activate(input: Readonly<{
    expectedPredecessor: InternalProductionOwnerProducerManifestSetActivationPredecessorV1 | null;
    manifests: readonly InternalProductionOwnerProducerManifestV1[];
    orderedSourceBuildAuthorities:
      readonly InternalProductionOwnerProducerSourceBuildAuthorityPairV1[];
  }>): Promise<InternalProductionOwnerProducerManifestSetActivationPairV1>;
  resolveSourceBuildAuthority(
    input: InternalProductionOwnerProducerSourceBuildAuthorityPairV1,
  ): Promise<InternalProductionOwnerProducerSourceBuildAuthorityV1>;
  resolve(input: InternalProductionOwnerProducerManifestSetActivationPairV1):
    Promise<InternalProductionOwnerProducerManifestSetActivationReceiptV1>;
  resolveHead(input: InternalProductionOwnerProducerManifestSetActivationHeadPairV1):
    Promise<InternalProductionOwnerProducerManifestSetActivationHeadV1>;
  resolveCurrent(): Promise<InternalProductionOwnerProducerManifestSetActivationCurrentV1 | null>;
}
export function activateInternalProductionOwnerProducerManifestSetV1(input: Readonly<{
  expectedPredecessor: InternalProductionOwnerProducerManifestSetActivationPredecessorV1 | null;
  manifests: readonly InternalProductionOwnerProducerManifestV1[];
  orderedSourceBuildAuthorities:
    readonly InternalProductionOwnerProducerSourceBuildAuthorityPairV1[];
}>): Promise<InternalProductionOwnerProducerManifestSetActivationPairV1>;
export function activateInternalProductionBaselineOwnerProducerManifestAFromControllerV1(
  input: Readonly<{
    sourceBuildAuthority: InternalProductionOwnerProducerSourceBuildAuthorityPairV1;
  }>,
): Promise<InternalProductionOwnerProducerManifestSetActivationPairV1>;
export function resolveInternalProductionOwnerProducerSourceBuildAuthorityV1(
  input: InternalProductionOwnerProducerSourceBuildAuthorityPairV1,
): Promise<InternalProductionOwnerProducerSourceBuildAuthorityV1>;
export function resolveInternalProductionOwnerProducerManifestSetActivationV1(
  input: InternalProductionOwnerProducerManifestSetActivationPairV1,
): Promise<InternalProductionOwnerProducerManifestSetActivationReceiptV1>;
export function resolveInternalProductionOwnerProducerManifestSetActivationHeadV1(
  input: InternalProductionOwnerProducerManifestSetActivationHeadPairV1,
): Promise<InternalProductionOwnerProducerManifestSetActivationHeadV1>;
export function resolveCurrentInternalProductionOwnerProducerManifestSetActivationV1():
  Promise<InternalProductionOwnerProducerManifestSetActivationCurrentV1 | null>;
export function resolveCurrentInternalProductionOwnerProducerManifestSetActivationInTransactionV1(
  sql: PgTransactionSql,
): Promise<InternalProductionOwnerProducerManifestSetActivationCurrentV1 | null>;
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

The same A source claim pre-delivers one exact guarded migration containing the owner-admission sidecar/head, bootstrap-main-claim handoff schema B P0 later consumes, and the four-relation owner-producer manifest/source-build activation authority. `src/db/bootstrap-main-claim-handoff-v1-migration.ts` is the sole immutable owner of its migration ID, ordered statements, and schema projector; the registry/digest files remain append-only, not whole-file authority. After the reviewed A and Mission Control sources are merged and clean, Task 6A first prepares the immutable current-entry operation, then that operation's zero-input resume performs the sole pre-schema spawner restart and proves the Task 0 generation is terminally `pre-manifest-bootstrap-sealed`. Only then may the controller prepare `InternalProductionPreManifestMigration32AuthorizationV1`, which binds the sealed admission, fresh v31 audit/pending projection, clean A source/build, and a newly reobserved complete legacy/pre-manifest zero-owner observation. The controller passes only that authorization pair to the internal `applyInternalProductionBaselineBootstrapHandoffMigrationV1(...)`; no normal complete-zero guard, public migration CLI, or caller body exists. Apply consumes the authorization once, invokes the dedicated guarded port, verifies all three schema families, and publishes/reopens one receipt. Initial application requires `currentSetfarmSourceSha === migrationSourceSha`; the receipt binds the causal quartet, pre-schema/sealed/legacy-census/migration-authorization chain, implementation Git blob, ordered statements, named digest entry/digest, and verified schema projection without pinning the mutable aggregate. The fixed terminal locator/resolver accepts no ID/ref/hash/path/SQL/database override. Every later consumer, including Task 7, is read-only and repeats bounded ancestry plus dedicated blob/statements/digest/schema verification. Unrelated append-only entries remain allowed. Normal restart authorization binds the same applied pair only after A activation. Current/post-rebind and baseline current/historical resolvers reopen it; B never applies schema.

For migration 32 specifically, generic plan observes pending, generic apply skips, and generic verify fails `MIGRATION_INCOMPLETE` until Task 6A's dedicated purpose-bound operation calls `applyBootstrapMainClaimHandoffGuardedMigration32V1`. Its ordered statements atomically create the bootstrap operation/claim/terminal-pair schema, `internal_production_owner_reservations_v1`, and singleton `internal_production_owner_admission_head_v1`; its projector verifies all three. The receipt hashes the exact v31 audit and pre-apply pending pairs alongside the pre-schema spawner authorization, sealed admission, fresh legacy/pre-manifest census, one-use migration authorization, apply, and schema facts. There is no generic guarded mode, pre-schema normal manifest/complete-zero authority, Task 0 live application, direct production apply CLI, or Task 7 apply path.

A also predeclares the only B-purpose guard seam in `baseline-post-handoff-receipt-v1.ts`. `bindInternalProductionBaselineGoldenLaunchMigrationZeroOwnerGuardV1()` accepts a fresh generic A zero-owner pair only after B has durably published and reopened its fixed `pendingInputRef`/`pendingInputHash`, validates the exact purpose and canonical pending-input namespace, and publishes the immutable authorization pair without consuming the guard. `consumeInternalProductionBaselineGoldenLaunchMigrationZeroOwnerGuardV1()` accepts only that authorization plus the equality-bound B operation pair, reopens both A records, and one-use consumes the underlying guard inside A before publishing the consumption pair. B never imports, authenticates, or mutates A's generic guard store directly. The authorization/consumption resolvers are read-only, pair-only, and reject another purpose, pending input, operation, replay, structural clone, or raw guard substitution.

`baseline-restart-authority-retirement-v1.ts` owns one fixed global physical-restart transition lock and one immutable two-epoch head for the ordered services `setfarm-spawner`, `setfarm-dashboard`, and `mission-control`. It also predeclares and solely owns the strict `InternalProductionServiceRestartStartupHooksReadyV1`, `InternalProductionServiceRestartAuthorityActivationV1`, and `InternalProductionServiceRestartAuthorityCutoverV1` schemas, content-addressed stores, fixed locators, code-owned runtime-hook observer/recorder, and pair-only resolvers; A imports no D schema, store, capability, callback, or body. A's `INTERNAL_PRODUCTION_RECOVERY_RESTART_TARGET_FAMILY_ABI_V1` is the physical forward-identity registry: its seven ordered records fix implementation ID, module-relative path, and export name. Readiness repeats those records in the same order and adds the observed module blob hash, clean D source SHA, and D build hash for each; all seven must agree on the reviewed D source/build and exact module blob. A reads and hashes the registered source/build identities through code-owned observers and never imports or evaluates the future D module. The separate three service startup-hook IDs remain exact runtime hook observations. No caller supplies a service, path, export, SHA, build, blob hash, generation, hook hash, verdict, or D object. Epoch one is `authorityOwner:"baseline-a"` and requires readiness/activation/retirement fields null; epoch two is `authorityOwner:"recovery-d"` and requires all three exact pairs non-null. A delivers as a Task 0 postcondition the sole two-step cutover mutation boundary: `prepareInternalProductionPhysicalServiceRestartAuthorityCutoverToRecoveryDV1({zeroOwnerGuardRef,zeroOwnerGuardHash})` and zero-input `resumeActiveInternalProductionPhysicalServiceRestartAuthorityCutoverToRecoveryDV1()`. Exactly D's reviewed cutover adapter may import those two mutations unaliased; every other D import from the A module is a type or read-only resolver/status observer, and no CLI/worker/other production module may call them. The former single-call commit, standalone retirement export, and every D-owned readiness/activation/cutover writer do not exist. Under the one transition lock, resume follows the exact operation-first durability order below, then performs one expected-predecessor visibility CAS from epoch one to the complete A-owned readiness/retirement/activation/cutover/epoch-two tuple. Before the CAS, A epoch one remains authoritative and D remains disabled even though exact invisible candidates may exist; after it, readers must freshly resolve the epoch's complete tuple from A's stores. D publishes no parallel candidate or summary. Every A ordinary restart, bootstrap prepare, and new sequence acquires the same lock before it reads epoch one or publishes any authorization/operation; after epoch two it fails before mutation with typed `BASELINE_RESTART_AUTHORITY_RETIRED`. A operations durably in flight before cutover remain recoverable and therefore make cutover refuse until terminal; completed A history remains resolvable forever. A partial/mismatched operation or candidate is ambiguous and never enables either owner.

Prepare's first and sole durable creation is the complete fixed `cutover-pending-input.json` record. It contains `InternalProductionPhysicalServiceRestartAuthorityCutoverPendingInputV1` directly; its constant canonical ref is derived from that fixed namespace and `pendingInputHash` hashes the strict body with only the derived ref/hash omitted, so no content-addressed member, guard authorization, operation, locator, or candidate can be orphaned before discoverability. Publication uses an unpredictable same-directory temporary, file fsync, atomic no-replace, parent fsync, and `O_NOFOLLOW` reopen. There is no separate content-addressed pending-input object or pending-input locator. Only after reopening this record does prepare acquire A's durable global owner-admission fence for the exact cutover purpose. One canonical owner-admission head serializes fence acquire/release and every producer reservation begin/close. Its exhaustive registry is exactly `INTERNAL_PRODUCTION_OWNER_CATEGORY_REGISTRY_V1`: run, claim, execution attempt, runtime session, completion owner, mandatory effect, ordinary start, restart reservation/operation, launch preparation, prepared/staged work, fixture attempt, artifact reservation/publication, docs session/lease, fleet stage/inflight/review, matrix inflight, launch outbox, termination, finding, recovery, operational delivery, source run, cold rehearsal, compilation/execution lease, process, listener, worktree, dirty worktree, and stale child. Fence acquire treats every open reservation and published live owner as nonzero. Outside a typed fence target family, a producer must begin or byte-identically adopt its category/owner-key reservation before its first durable owner byte; its canonical PostgreSQL owner insert and sidecar bind then occur in the same transaction, and it closes only through the exact category-typed terminal authority. Inside `source-run-launch` or `recovery-restart`, the same atomic fence/head CAS creates the complete exact named target set, those target pairs are the only permitted begin authorities while the fence is held, and only the matching exact compound close may settle them. Reservation CAS refuses while a fence is held; fence CAS refuses while any non-target reservation or owner is live. A nonzero observation leaves the same fixed pending record in `pending-input`, publishes no operation, consumes no guard, and performs no epoch mutation; zero-input resume alone may retry acquisition.

Guarded migration 32 creates the permanent PostgreSQL sidecar `internal_production_owner_reservations_v1` plus the singleton `internal_production_owner_admission_head_v1` relation. `owner-admission-v1.ts` is pure and import-inert: it imports only canonical pure helpers plus the type-only `PgTransactionSql` shape, opens no connection, imports no `db-pg`, and exports only types, ports, and pure primitives. It exports no caller-constructible repository/controller factory, terminal-resolver registry, production capability, or database singleton. `src/db-pg.ts` owns the sole production repository implementation, the fixed non-exported category-to-authenticated-terminal-resolver table, and the code-owned composed controller after an explicit configured SQL connection exists. Production entrypoints and the top-level pair-only reservation/close resolvers obtain only that composed controller/repository; no caller supplies a repository, resolver table, or factory. A test-private fake is defined only in the focused test and cannot be imported by production.

The caller passes the same `PgTransactionSql` to repository `resolveReservation(...)`, controller begin/adopt, its canonical owner insert, controller bind, authenticated terminal resolution, controller close, and repository `resolveClose(...)` as applicable. The repository locks the singleton head and reservation key, verifies the active manifest row/category/owner-key derivation, inserts or byte-identically adopts the pending sidecar row, permits the caller's canonical owner insert, binds its exact owner pair, and CAS-advances the head before that one PostgreSQL transaction commits. A crash/throw/deadlock before commit exposes neither reservation nor owner; a lost response after commit is recovered through the same injected repository and returns the byte-identical bound row without a second owner. A conflicting producer/category/key/pair, partially visible row, stale head, or second owner fails and rolls back the whole transaction. Concrete owner tables receive no duplicate reservation columns; the sidecar is the authoritative binding.

The P2 ordinary-run vertical slice modifies exactly these eleven existing members of the byte-identical 109-path Task 0 File Map, with no addition, omission, reorder, or generated path: `src/db-pg.ts`, `src/execution/run-persistence.ts`, `src/execution/run-terminal-transition.ts`, `src/installer/run.ts`, `src/spawner.ts`, `tests/claim-log-lifecycle.test.ts`, `tests/evals/convergence-eval.test.ts`, `tests/execution-attempts/run-protocol.test.ts`, `tests/execution-attempts/run-terminal-transition.test.ts`, `tests/execution-attempts/v3-release-admission.test.ts`, and `tests/internal-production/owner-admission-v1.test.ts`. P2 owns only the ordinary-run repository/caller/consumer/terminal vertical and the insertion half of the pre-schema fence. P4 owns the counterpart through the already mapped `src/internal-production/baseline-post-handoff-receipt-v1.ts`, `src/internal-production/baseline-spawner-startup-admission-v1.ts`, `src/db/bootstrap-main-claim-handoff-v1-migration.ts`, `src/db/contract-spine-migrations.ts`, `src/db-pg.ts`, `tests/internal-production/baseline-post-handoff-receipt-v1.test.ts`, `tests/internal-production/baseline-spawner-startup-admission-v1.test.ts`, and `tests/execution-attempts/migrations.test.ts`, plus the three overlapping P2 run/admission/eval fixtures. This ownership split changes no literal Task 0 path.

The ordinary `run` producer is not `src/spawner.ts`. The first durable `activeRunCount` byte is `runWorkflow → persistWorkflowRun(input) → persistWorkflowRunInTransaction(sql,input)`, so `src/execution/run-persistence.ts` owns implementation `a-runtime-run-v1` at the inner function. `persistWorkflowRunInTransaction(sql,input)` is the manifest birth function: inside the passed `PgTransactionSql`, it resolves the exact run-admission authority, begins or adopts the typed run reservation, inserts or byte-identically adopts the workflow-run row, binds its authenticated run-owner pair in the sidecar, and returns one tentative `{run,runOwnerReservationRef,runOwnerReservationHash}` value only to the enclosing callback. It never opens or commits a transaction and is not a production caller surface.

The ordinary-run canonical identity is byte-exact. Let `runId` be the unmodified `run.id` string and `encodedRunId = encodeURIComponent(runId)`. A resolver decodes that one path segment and requires both `decoded === runId` and `encodeURIComponent(decoded) === encodedRunId`; an encoding exception, empty ID, slash-created extra segment, lowercase or otherwise noncanonical percent spelling, or unequal round trip fails. The bound `InternalProductionCanonicalOwnerIdentityV1<"run">` is exactly `{schema:"setfarm.internal-production-canonical-owner-identity.v1",category:"run",ownerKey:runId,ownerRef:`setfarm://runs/${encodedRunId}`,ownerHash}` where `ownerHash = hashCanonicalJson({schema:"setfarm.internal-production-workflow-run-owner.v1",runId})`. No run number, task, context, protocol, caller time, database time, status, reservation pair, or other mutable value enters that identity hash.

That minimal identity never substitutes for strict response-loss adoption. An existing run is adoptable only after the same transaction locks it and equality-validates the exact complete INSERT projection, the complete ordered step INSERT projections, the release/canary admission and exact same-run consumption, the reservation row and pair, the binding row/body/hash/authority, the canonical identity, and authenticated head ancestry. The stored database times are adopted only as members of that already authenticated committed row; a caller time cannot replace them. A partial row, changed field, reordered/extra/missing step, crossed or second admission consumption, pending/closed sidecar, changed binding, second reservation, or downstream owner fails without mutation. A successful retry returns the original stored row and original reservation pair byte-for-byte and performs no second INSERT, slot consumption, reservation, binding, notification, or work dispatch.

For terminal status exactly `completed | failed | cancelled`, `terminalOwnerRef` is exactly `setfarm://runs/${encodedRunId}/terminal/${status}` and `terminalOwnerHash = hashCanonicalJson({schema:"setfarm.internal-production-workflow-run-terminal-owner.v1",runId,status})`. The fixed private `run` member of `OWNER_TERMINAL_AUTHORITY_RESOLVERS_V1` constructs `InternalProductionTerminalOwnerAuthorityV1<"run">` only after locking and observing that exact run row in the named terminal status and equality-validating the bound `a-runtime-run-v1` identity. Its `resolveByAuthorityPair` considers only the exact bound ordinary-run reservation selected by implementation/category/state and requires one matching derived authority; its `resolveByTerminalOwnerPair` parses the canonical terminal ref and resolves that exact row. Neither accepts a caller body, category, status, owner hash, terminal hash, repository, newest scan, or structural clone. The authority pair remains exactly `deriveInternalProductionTerminalOwnerAuthorityPairV1(authority)`. `transitionRunToTerminalInTransaction` publishes the terminal row, derives and pair-resolves that authority, invokes only the public pair-input close in the same transaction, and pair-resolves the resulting close before returning; an already-terminal exact replay adopts the same close without another head transition.

Public `persistWorkflowRun(input)` owns and awaits `pgBegin`; it is the only production caller surface and passes the transaction SQL to `persistWorkflowRunInTransaction`. The callback's tentative value remains private inside `pgBegin`: the public promise cannot resolve and the installer, spawner, or another continuation cannot observe either row or pair until commit acknowledgement. `src/installer/run.ts` calls the wrapper directly and never calls the inner function. Callback throw, rollback, commit rejection, or connection loss before acknowledgement exposes neither run nor pair and leaves no row/sidecar residue. Response loss after an acknowledged commit is retried through the wrapper, which pair-resolves and returns the byte-identical committed row/pair; neither installer nor spawner may consume a precommit value, reserve after insertion, or reconstruct authority from a run ID. Any insert, including a direct CLI path, that cannot bind the pair in the same transaction fails and rolls back.

The committed run-owner handoff uses the existing sidecar rather than an outbox or duplicate owner field. The installer copies the exact post-commit `runOwnerReservationRef`/`runOwnerReservationHash` returned by `persistWorkflowRun(input)` into its first `step_pending` notification, and the spawner invokes the pair-only resolver and equality-validates the complete bound owner before work. Notification loss, spawner restart, polling, and retry use one private locator recovery: read only the already stored `reservation_ref`/`reservation_hash` selected by exact `(producer_implementation_id:'a-runtime-run-v1',category:'run',owner_key:runId,state:'bound')`, then invoke the same pair-only resolver. That stored-scalar lookup is not authority and is not reconstruction; it never computes a ref/hash from `runId`, begins/adopts/binds, accepts a caller pair as truth, or scans newest state. No run-owner handoff outbox, new table/column, run-context copy, late reservation, or alternate locator is permitted. `src/spawner.ts` cannot import or call the begin/bind APIs.

`run-protocol.test.ts`, `v3-release-admission.test.ts`, and `convergence-eval.test.ts` hold `pgBegin` at callback-return and commit-acknowledgement latches and prove the inner tentative result is never externally observable and the public promise remains pending. They then cover successful commit release, callback rollback, commit rejection, lost connection before acknowledgement, response loss after acknowledged commit, and byte-identical retry. Compile-time and runtime fixtures reject an installer import/call of `persistWorkflowRunInTransaction`, a transaction adapter that forwards the callback value before commit, and a wrapper that does not await `pgBegin`.

To close the pre-schema race, P2 removes `runAdmissionLockKey` and every ordinary-run advisory/file lock. Every `persistWorkflowRunInTransaction` transaction first locks the exact `public.setfarm_schema_migrations` version-31 row `FOR UPDATE` and equality-validates its `031_operational_failure_cause_authority_v3` name, checksum, and state against the pinned v31 audit; it next locks the owner-admission head and only then resolves admission, performs activity census, begins/adopts the reservation, or writes the first run byte. The sole order is v31 journal row, then owner head, then admission resolution. A missing/noncurrent migration 32 or 33, missing owner head, inactive A manifest, incomplete through-33 full verification or normal database initialization, or absent/mismatched same-generation admission-ready authority fails closed before reservation or INSERT. P2 proves this insertion half and may not claim the observation-to-apply race closed.

P4 owns the counterpart. Before final legacy-zero reobservation, the current-entry controller opens the migration-32 transaction and locks that same validated v31 journal row. That one transaction holds the row only through final reobservation, authorization consumption, migration-32 DDL and journaling, singleton owner-head seed and verification, and commit; commit releases the predecessor fence with the successor head already installed and verified. Only after that acknowledged commit does the coordinator, in separate postcommit steps, resolve the migration-32 applied receipt/current audit, apply or exact-adopt and fully verify ordinary migration 33 in its own transaction, activate A, run generic full verification of the complete through-33 chain, perform normal database initialization, and publish the same-generation admission-ready authority. An unrelated CLI insert racing after postzero blocks on v31 until migration-32 commit, then follows v31 journal row → owner head → admission resolution and fails closed while migration 33 or any later postcommit step is incomplete; it cannot slip between observation and apply or write during the postcommit gap. The only later permitted target is the same current-entry operation's exact typed canary run reservation after every postcommit step and admission-ready. Tests race that target and an unrelated CLI insert at the v31 lock, migration-32 commit, migration-32 receipt/current audit, before/during/after the migration-33 transaction, owner-head, each later postcommit transition, admission-resolution, and head-transition boundaries and prove exactly the target may win, with transaction rollback limited to 33 on its pre-ack failure, exact adoption after its commit-ack loss, no cross-transaction lock claim, advisory/file lock, unreserved row, late spawner reservation, or second owner.

The exact P2 RED/GREEN matrix is: (1) the inner/public ABI, private callback result, awaited commit boundary, and installer refusal to import/call the inner function; (2) validated v31-journal-row → owner-head → admission-resolution ordering, removal of `runAdmissionLockKey`, no advisory/file substitute, and fail-closed refusal until migration 32 is acknowledged/current, its receipt/current audit is durable, ordinary migration 33 is applied/current, A is active, the complete through-33 verification and normal initialization pass, and admission-ready is current; (3) same-transaction admission after both locks, begin/adopt, run/step insert or exact adoption, release/canary consumption, bind, and tentative pair; (4) callback throw, rollback, commit rejection, and connection loss before acknowledgement with zero visible run/reservation/binding/result; (5) callback-return and commit-acknowledgement latches keeping the public promise and pair invisible; (6) post-ack response loss followed by the public-wrapper byte-identical retry with one run, one ordered step set, one slot consumption, one reservation, and one binding; (7) concurrent ordinary/V3 admission with exactly one permitted owner across the migration-32 receipt/audit, separate migration-33 transaction and all later readiness prefixes; (8) run terminal authority resolution, same-transaction close, exact replay, crossed identity/pair/status/hash rejection, and zero mutation on failure; (9) first-notification post-commit pair consumption plus notification-loss/restart/poll/retry stored-pair locator recovery; and (10) AST/source boundaries forbidding spawner begin/bind/late reserve, installer inner calls, caller terminal bodies, reverse-derived pair scalars, run-owner outbox, and undeclared paths. `owner-admission-v1.test.ts` owns the exact identity/hash/ref and resolver matrix; `run-protocol.test.ts`, `v3-release-admission.test.ts`, and `convergence-eval.test.ts` own persistence, latch, rollback/loss/retry, and canary cases; `run-terminal-transition.test.ts` owns terminal close; and `claim-log-lifecycle.test.ts` owns the spawner/installer source boundary.

<!-- oa18-p3-canonical-owner-terminal-rebaseline-v1:start -->
P3 adds ordinary contract-spine migration `033_v3_recovery_claim_runtime_publication_v1` inline in `src/db/contract-spine-migrations.ts`. Migration 32's statements, semantic regions, digest, checksum, application provenance, and guarded application path remain byte-for-byte unchanged: neither byte between `migration-v32-registration:BEGIN/END` nor any byte between `migration-v32-guarded-dispatch:BEGIN/END` is edited. The existing frozen `migrations` tuple remains the through-32 registry. Migration 33 is declared after the registration region and one frozen complete registry appends exactly 33 for generic plan/source-binding/verification only. The existing exported apply declaration, whose body crosses the frozen dispatch region, is renamed outside that region to a private through-v32 core; after `migration-v32-guarded-dispatch:END`, a same-name exported wrapper owns one outer transaction and calls that core through a private savepoint facade before handling migration 33 in the same outer transaction. The legacy core's journal read is deliberately bounded to ordinals at most 32, while the complete planner/verifier and wrapper read the full known journal; a journal row above 33 or any nonexact row remains unknown/drift, never silently ignored. Migration 33 is source-known and `automatic`, but its plan state is exactly `blocked_by_guarded_predecessor`. While guarded migration 32 is pending, exact read-only full-tail journal/schema validation and the ordinary read-only migration-33 detector are permitted, but migration-33 adoption, DDL, mutation, or journaling is forbidden. The existing pending-successor inspection excludes the blocked state and therefore still sees migration 32 as the sole actionable guarded successor. Once the targeted guarded migration-32 application is acknowledged and reverified current, migration 33 becomes the sole pending automatic successor.

The public apply wrapper preserves the existing `ContractSpineMigrationApplyResult` ABI and exact caller options without a compatibility rebaseline. It validates `releaseSha`, opens one bounded outer `sql.begin`, sets the transaction-local options, takes the same contract-spine advisory transaction lock before any full-tail observation, and read-only preflights the complete known journal/schema tail. Only an exact admissible legacy prefix from zero through 31 followed by absent guarded 32/blocked 33, or exact applied/current guarded 32 followed by absent/exact 33, is permitted; unknown, partial, extra, checksum/provenance/schema-drifted, or otherwise nonexact 33 fails before mutation. The wrapper constructs one private code-owned callable `Sql` facade over that held `TransactionSql`: SQL operations forward only to the held transaction and its `.begin(callback)` delegates only to `outerTransaction.savepoint(callback)`. The facade, transaction, SQL, and callback are not accepted from a caller, exported, or replaceable, and no second root transaction or independently acknowledged effect exists.

The existing current-head `public.setfarm_schema_migrations` schema already provides nullable `release_sha`, `verified_release_sha`, and `verified_at` columns and the exact constraint `(verified_release_sha IS NULL) = (verified_at IS NULL)`; migration 33 changes none of that journal schema. The wrapper passes the caller options, including caller `releaseSha`, unchanged to the captured through-v32 core through the private facade. The core's unchanged `.begin(callback)` therefore runs as a savepoint inside the held outer transaction; all legacy application/adoption/journaling, application `release_sha`, and its frozen all-row `verified_release_sha`/`verified_at` UPDATE remain byte-compatible and tentative in that one outer transaction. The full-tail preflight has three exact branches before the core: absent/adoptable 33, exact journaled 33, or fail. Unknown, drifted, partial, extra, or otherwise nonexact 33 fails read-only before the core and therefore before any legacy or release-metadata mutation. On the absent/adoptable branch, no journal row 33 exists when the core runs, so its frozen UPDATE affects only the exact then-present prefix through 31 or 32 and newly applied/adopted legacy rows retain caller `release_sha` exactly as before. On the exact existing-journaled-33 branch, row 33 does exist when the core runs: if caller `releaseSha` is defined, the frozen all-row UPDATE deliberately updates row 33's `verified_release_sha` and `verified_at` together with the exact legacy prefix while preserving row 33's original application `release_sha`; if `releaseSha` is undefined, the frozen conditional UPDATE does not run and every existing metadata value remains unchanged. If the core result contains guarded migration 32 in `guardedPending`, the wrapper may repeat exact read-only tail/schema validation, including the ordinary read-only migration-33 detector, but performs no migration-33 adoption, DDL, mutation, or journaling. It returns the byte-equivalent legacy result only after the single outer commit is acknowledged.

If guarded 32 is exact applied/current after the core savepoint, the wrapper retains the same outer advisory lock, locks and revalidates the exact source/journal/schema chain through 32 plus guarded-32 application provenance, and handles only migration 33 before the outer callback returns. For exact absent 33 it applies the ordered statements and verifies the relation; for exact present-but-unjournaled 33 it exact-adopts only after complete schema verification. In either new/adopted case it captures one database-derived `NOW()` timestamp once in the held outer transaction and performs one journal INSERT with the exact columns `(version,name,checksum,state,release_sha,verified_release_sha,verified_at)`: when caller `releaseSha` is defined, both SHA columns equal that value and `verified_at` equals the captured database timestamp; when it is undefined, all three metadata columns are NULL. Exact journaled 33 is fully reverified and returned as already applied without rewriting its application `release_sha`; any defined caller `releaseSha` has already updated only its verification pair through the frozen core, while an undefined option changed no existing metadata. The wrapper then reverifies the complete exact 1–33 source/journal/schema/provenance, including the exact release-metadata branch, and tail, and tentatively appends 33 to exactly one of `applied | adopted | alreadyApplied`, preserving prior array order and `guardedPending`. No tentative result is observable until the one outer commit acknowledgement. Any preflight, core/savepoint, migration-33, journal INSERT, final verification, outer callback, commit, or backend failure rolls back legacy mutations, release metadata, and migration-33 effects together. There is no migration-33 rollback API, compensating rollback, rollback semantic region, or separately committed successor/release effect.

The migration-33 crash prefixes are exact. Failure or loss before/during preflight, the through-v32 savepoint, migration-33 apply/adoption/journal, or final full verification rolls the one outer transaction back and exposes no result or legacy/release/migration-33 residue. Loss of the outer commit acknowledgement retries from either the entirely pre-call state or the entirely committed exact state; the latter reruns the core against current legacy rows, exact-verifies 33, and reports already applied without duplicate DDL or journaling. Generic planning and verification see 33 through the complete registry on every call, while every version-32 targeted API and source verifier remains bound to the unchanged through-32 bytes. RED freezes both marked v32 regions byte-for-byte, the version-32 digest/checksum/provenance, the post-region function rebinding and generic-export visibility of 33, one outer transaction/lock, facade-authenticity and `.begin`-to-savepoint dispatch, caller-option preservation, blocked read-only validation with zero migration-33 adoption/DDL/mutation/journal, same-transaction successor/result aggregation, and every crash prefix above. Its real-PostgreSQL release-SHA matrix reads and byte-compares `release_sha`, `verified_release_sha`, and `verified_at` for new, adopted, and exact-existing journaled 33 under both defined and undefined options; proves the one captured database timestamp and pair constraint for new/adopted rows; proves defined release updates only the existing row's verification pair while preserving application release; proves undefined release preserves existing values and inserts three NULLs for new/adopted rows; proves unknown/drifted/partial/extra state fails before the core with zero mutation; and proves every post-core failure rolls the full metadata/legacy/33 transaction back. It additionally proves no caller SQL/callback/facade seam and no result before outer commit acknowledgement. P3's projected template performs migration 32 through the existing guarded test lifecycle, applies and fully verifies migration 33, and only then activates A and publishes readiness. Empty and migration-31 fixtures remain schema-empty and pending-32 respectively and never contain migration 33 or A.

Migration 33 creates the sole durable relation `public.internal_production_v3_recovery_claim_publications_v1` plus only its private immutability function and triggers. Its exact ordered columns are `claim_id BIGINT PRIMARY KEY`, `runtime_session_id TEXT NOT NULL UNIQUE`, `run_id TEXT NOT NULL`, `step_db_id TEXT NOT NULL`, `workflow_step_id TEXT NOT NULL`, `story_db_id TEXT NOT NULL`, `story_id TEXT NOT NULL`, `story_index INTEGER NOT NULL`, `recovery_case_id TEXT NOT NULL`, `revision_id TEXT NOT NULL`, `dispatch_id TEXT NOT NULL UNIQUE`, `status TEXT NOT NULL`, `handoff_canonical_json TEXT NOT NULL`, `handoff_hash TEXT NOT NULL`, and `bound_at TIMESTAMPTZ NOT NULL`. `status` is exactly `lease_acquired | lease_reissued`; `handoff_hash` is 64 lowercase hexadecimal; `handoff_canonical_json` is nonempty UTF-8 canonical JSON text whose parsed value is exactly one strict `V3RecoveryClaimHandoffV1`, whose `schema`, original `status`, run/story/case/revision/dispatch identities equal the scalar columns, and whose SHA-256 equals `handoff_hash`. Exact foreign keys bind `run_id` to `runs(id)`, `(claim_id,run_id,workflow_step_id)` to `claim_log(id,run_id,step_id)`, `(runtime_session_id,claim_id,run_id)` to `runtime_sessions(session_id,claim_id,run_id)`, `(step_db_id,run_id,workflow_step_id)` to `steps(id,run_id,step_id)`, `(story_db_id,run_id,story_id,story_index)` to `stories(id,run_id,story_id,story_index)`, `recovery_case_id` to `recovery_cases(recovery_case_id)`, `(revision_id,recovery_case_id)` to `recovery_case_revisions(revision_id,recovery_case_id)`, and `(dispatch_id,revision_id)` to `recovery_revision_dispatches(dispatch_id,revision_id)`, while `dispatch_id` alone references `recovery_dispatch_deliveries(dispatch_id)`; application insertion and migration verification additionally require the delivery row's `revision_id`, `recovery_case_id`, `run_id`, and `story_id` to equal the immutable publication scalars. Every foreign key is `ON DELETE RESTRICT`. One code-owned trigger function backs an exact row trigger rejecting UPDATE or DELETE and an exact statement trigger rejecting TRUNCATE. There is no backfill, mutable payload, diagnostic, or latest-row selector. Task 3 writes neither `recovery_dispatch_deliveries.claim_id` nor `recovery_dispatch_deliveries.attempt_id`; after its acknowledged claim/runtime/publication commit that delivery pair remains exactly `(NULL,NULL)` for Task 4 to bind under the separate authority below.

For a model-recovery publication, Task 3 strict-parses the caller handoff with `V3RecoveryClaimHandoffV1Schema`, constructs `handoffCanonicalJson = canonicalJsonStringify(parsedHandoff)` once, and computes `handoffHash = hashCanonicalJson(parsedHandoff)` over those exact UTF-8 bytes, and in the existing claim-publication transaction locks and revalidates the complete delivery/revision/case chain. After the claim, runtime session, step, story, and owner bindings exist but before commit, it inserts the exact scalar identities, original `status`, canonical text/hash, and database `bound_at`; any duplicate or crossing must exact-adopt the one row or fail with the whole transaction rolled back. Response-loss replay locates only by the stable claim-ID/runtime-session pair, locks the immutable publication and exact dispatch chain, strict-parses the stored text, requires re-canonicalization byte equality and a recomputed hash, revalidates every scalar/foreign identity, requires `canonicalJsonStringify(V3RecoveryClaimHandoffV1Schema.parse(callerHandoff))` to be byte-identical, and returns the stored parsed handoff. A changed status, unrelated later delivery, crossed claim/session/dispatch, partial or extra row, noncanonical or schema-invalid text, hash drift, claim-publication transaction rollback, and concurrent publisher all fail closed. Task 4 must lock and byte-exactly authenticate this relation before model-recovery attempt birth; it consumes the relation as immutable authority and does not reinterpret, update, replace, or recreate it.

Task 4 attempt birth has exactly three disjoint paths. A model-recovery reservation has the exact non-null `recoveryDispatchId`, recovery-case revision, and delivery-lease authority; under the delivery lock it reopens the one migration-33 publication by the exact claim/dispatch/revision identity, locks the bound runtime session and complete case/revision/dispatch chain, strict-parses the stored handoff, and requires stored canonical-text byte equality, recomputed hash equality, and equality of every scalar, directive, lease, source, packet, finding, and slice authority. Only then, in that same passed transaction, it resolves readiness, begins or adopts the execution-attempt owner, inserts or completely exact-adopts one new attempt, exactly rereads it, binds its owner, and CAS-publishes the recovery delivery's `claim_id`, `attempt_id`, `execution_slice_hash`, and `state='attempt_reserved'` together. An evidence-only recovery reservation has an exact recovery dispatch but no runtime session and no migration-33 publication row: `createV3EvidenceOnlyPublication.reserve` locks the exact leased evidence-only delivery/case/revision/dispatch chain and creates and binds its exact child claim in its one existing reserve transaction. After the exact child claim identity exists tentatively but before attempt birth or delivery mutation, one code-owned query under those already-held locks performs the sole permitted evidence-only runtime/publication lookup: it negatively checks for any runtime session or migration-33 publication matching the exact child-claim/dispatch identity, requires zero matches, and rolls the whole transaction back on any positive candidate. That check proves absence only; it may not parse, authenticate, consume, or depend on a positive migration-33 body, and no second, unlocked, latest-row, or scanning runtime/publication lookup is permitted. The same transaction then creates and binds the exact execution attempt and publishes the claim/attempt/slice/`attempt_reserved` delivery state together. An ordinary downstream evidence reservation in `createV3DownstreamEvidencePublication.reserve` has no `recoveryDispatchId`, recovery-case revision, or recovery-delivery lease; it creates its claim and attempt without any delivery or migration-33 lookup or write. A caller cannot relabel one path as another, and the generic ordinary attempt path never infers recovery from a claim, story, role, or attempt class.

The recovery delivery binding is one indivisible pair publication, never a Task-3 prohibition. The only model-recovery prefix accepted at Task 4 entry is the Task-3 result with exact delivery `claim_id IS NULL`, `attempt_id IS NULL`, `execution_slice_hash IS NULL`, and the exact live leased authority; evidence-only accepts the analogous exact leased prefix created without a runtime/publication row. The only new committed birth result has the exact claim ID, new attempt ID, requested slice hash, and `attempt_reserved` state together; later exact replay may also observe that identical triple in `running`. A non-null/null or null/non-null claim/attempt half-pair, a pair with a null or different slice, a prebound pair without the exact attempt and owner sidecar, a model row without the exact migration-33 publication/runtime chain, an evidence-only row with a runtime/publication row, or an ordinary reservation carrying any recovery field fails before a new owner, attempt, delivery mutation, or caller-visible result.

Task 4 RED/GREEN and source inventory are exact. `src/execution/attempt-repository.ts` owns the common readiness → begin/adopt → INSERT-or-exact-adopt → exact-reread → bind sequence, the model-recovery migration-33 authentication, and the single four-field recovery-delivery CAS; `src/recovery/v3-evidence-only-publication.ts` owns evidence-only claim-plus-attempt composition and the one locked negative runtime/publication existence check in its existing reserve transaction; `src/recovery/v3-downstream-evidence-publication.ts` owns the ordinary no-recovery branch; the worker and lifecycle-reconciler paths are terminal-only and never birth or reserve an attempt. RED separately proves the Task-3 null/null prefix, the model migration-33 byte/hash and complete-chain gate, the evidence-only check's exact lock/identity/zero-row requirement and refusal of a positive, second, unlocked, latest-row, or scanning lookup, ordinary recovery-field absence, every half-pair/crossed-pair/slice/state refusal, and a source inventory rejecting another birth, delivery binder, positive evidence-only m33 consumer/dependency, or terminal-only reserve. A failure at any model boundary rolls back only Task 4's tentative owner/attempt/delivery effects while preserving the already committed Task-3 claim/runtime/publication and null/null delivery prefix; a failure at any evidence-only boundary rolls back its tentative claim, attempt, both owner bindings, and delivery mutation together; an ordinary failure rolls back its local claim/attempt effects with no recovery read. Response loss adopts either the exact pre-call prefix or the exact committed pair without a second attempt, owner reservation, head advance, delivery attempt-count advance, or caller-selected identity. A deterministic two-publisher race permits one committed pair and makes the loser exact-adopt that pair or fail unchanged; it never produces two attempts or a half-pair.

Task 4 also closes the post-publication/pre-attempt lease-expiry prefix without making the immutable Task-3 publication an attempt. `src/recovery/v3-recovery-lifecycle-reconciler.ts`, using the existing Task-3 claim/runtime in-transaction terminal resolvers and generic owner close, owns one transaction in the same delivery/case/revision/dispatch lock order as Task-4 birth. It reopens and byte-authenticates the exact immutable publication and full delivery chain, uses database wall-clock time to prove the lease expired, and requires the exact delivery prefix `claim_id IS NULL`, `attempt_id IS NULL`, null slice, and no attempt. It then terminalizes the exact claim and runtime session through their already allowed terminal dispositions, resolves and closes both exact owners, and terminally blocks or quarantines that same delivery and recovery case atomically while preserving the migration-33 row. It never resets or reauthorizes the same dispatch, and it creates no run/story/global tombstone or uniqueness claim that could make a later, independently authorized successor case/revision/dispatch with its own exact lease and immutable publication impossible. `tests/findings/v3-recovery-lifecycle-reconciler.test.ts` owns the focused RED and deterministic race evidence; both files are already in Task 4's exact15, so this adds no File Map member, migration, or successor scope.

The Task-4 lease-expiry RED/race matrix is exact:

| Prefix or race | Required outcome | Forbidden outcome |
|---|---|---|
| Lease expires after immutable Task-3 claim/runtime/publication commit but before Task-4 birth | One locked transaction authenticates the exact publication/null pair, terminalizes and closes the exact claim/runtime owners, and terminally blocks or quarantines the same delivery and case | Same-dispatch reset/reauthorization, publication deletion/mutation, partial owner close, attempt birth, or later-successor poison |
| Birth locks first while the exact lease remains unexpired | The authenticated claim/attempt/slice/`attempt_reserved` tuple commits; a later expiry contender loses the unbound-prefix check and follows attempt-bound lifecycle authority | Pre-attempt expiry cleanup over an attempt-bound delivery or a second pair |
| Expiry locks first, including when wall-clock expiry occurs while a birth contender waits | Database time selects expiry; owner closes plus delivery/case terminalization commit, and birth fails its exact lease/prefix gate unchanged | Stale caller time authorizes birth, a half-close, or same-dispatch retry |
| Expiry response or commit acknowledgement is lost, including two expiry publishers | Retry adopts the one exact terminal result with no second close or owner-head advance; one contender commits and the other exact-adopts or fails unchanged | Double close, duplicate head advance, reopened dispatch, or deletion of immutable evidence |
| Later independently authorized successor case/revision/dispatch | Its own exact lease, claim/runtime/publication, and Task-4 birth remain constructible | A global/run/story tombstone or cross-dispatch uniqueness block created by prior expiry |

The canonical parity gate extracts the bytes strictly between the P3 marker lines from both tracked plan and spec, byte-compares the two extractions, independently computes SHA-256 for each, and requires equal digests before any Task-4 RED edit. Any byte mismatch or unequal digest fails closed; no digest is embedded inside the marked block that it authenticates. These Task 4 changes use only existing exact51/frozen109 paths, add no File Map member or migration, and leave guarded migration 32 → ordinary migration 33 → A activation/readiness unchanged.

The P3 producer/terminal rebaseline closes the eight remaining A categories without changing the generic owner-admission ABI. Existing numeric ABIs make the full PostgreSQL BIGINT claim-ID range nonconstructible within frozen exact51/109, so the Setfarm claim-ID domain is exactly `1` through `9007199254740991` inclusive. For every category below, the builder returns exactly `InternalProductionCanonicalOwnerIdentityV1<Category>` with property order `{schema:"setfarm.internal-production-canonical-owner-identity.v1",category,ownerKey,ownerRef,ownerHash}`. Let `segment(value) = encodeURIComponent(value)` subject to exact decode and re-encode equality; an exception, empty value, slash-created extra segment, lowercase or otherwise noncanonical percent spelling, or unequal round trip fails. `claimIdText` is canonical positive decimal text matching `/^[1-9][0-9]{0,18}$/` and `BigInt(claimIdText) <= 9007199254740991n`; it is never accepted as a JavaScript `number`. `attemptId`, `sessionId`, `completionRequestId`, and `terminationRequestId` match respectively `/^ATT_[A-Za-z0-9-]{16,160}$/`, `/^RTS_[A-Za-z0-9-]{16,160}$/`, `/^RCR_[A-Za-z0-9-]{16,160}$/`, and `/^RTR_[A-Za-z0-9-]{16,160}$/`. `effectKey` and `eventKey` are 1–4,096 printable ASCII bytes matching `/^[\x21-\x7e]+$/` with no leading/trailing whitespace; `findingSetHash` is exactly 64 lowercase hexadecimal characters; and `consumer` is exactly `jsonl | webhook`.

The P3 field-specific generic-owner maxima are exact length limits: `ownerKey` is at most 8,462, `ownerRef` is at most 12,499, and `terminalOwnerRef` is at most 12,519. Every bounded P3 value is canonical ASCII, so byte length and JavaScript string length are identical at these limits. `src/internal-production/owner-admission-v1.ts` adds optional maximum arguments to its existing strict string/ref validators only where `ownerKey`, `ownerRef`, or `terminalOwnerRef` is validated in reservation, canonical-identity, bound-reservation, terminal-authority, or close construction/authentication; those fields pass exactly their named maximum. Every other generic string/ref field, and every validator call without that field-specific option, retains the existing 4,000 maximum. A global default increase, category-wide permissive validator, truncation, hash-only substitution, or reuse of an expanded maximum for another field is forbidden.

Unknown claim-sequence driver output is accepted only as canonical `claimIdText`: it must be a string matching that grammar and satisfy `BigInt(claimIdText) <= 9007199254740991n`. Owner identity, owner key/ref/hash, terminal body/hash, reservation, explicit claim `INSERT`, reread equality, bind, and every authority reference use that original text exclusively. A legacy numeric projection is allowed at any DB-to-legacy boundary only after this exact checked conversion, and not as a globally-once-only rule: `const claimId = Number(claimIdText); if (!Number.isSafeInteger(claimId) || String(claimId) !== claimIdText) throw new Error("INTERNAL_PRODUCTION_CLAIM_ID_SAFE_INTEGER_INVALID");`. No number-derived value may construct or authorize an owner identity, reservation, INSERT, reread comparison, bind, ref, or hash. A text value above the cap fails before reservation, claim `INSERT`, or any category byte; the only permitted effect is the nontransactional PostgreSQL sequence gap from allocation. Full PostgreSQL BIGINT support, if later mandatory, is a separate compatibility migration costing 48 source and 38 test paths plus a persisted JSON policy; it does not alter current exact51, tuple109, or File Map.

The eight canonical identities are byte-exact. Claim uses `ownerKey=claimIdText`, `ownerRef=setfarm://claim-log/${claimIdText}`, and `ownerHash=hashCanonicalJson({schema:"setfarm.internal-production-claim-owner.v1",claimId:claimIdText})`. Execution attempt uses raw `ownerKey=attemptId`, `ownerRef=setfarm://execution-attempt/${segment(attemptId)}`, and `ownerHash=hashCanonicalJson({schema:"setfarm.internal-production-execution-attempt-owner.v1",attemptId})`. Runtime session uses raw `ownerKey=sessionId`, `ownerRef=setfarm://runtime-session/${segment(sessionId)}`, and `ownerHash=hashCanonicalJson({schema:"setfarm.internal-production-runtime-session-owner.v1",sessionId})`. Completion owner uses raw `ownerKey=completionRequestId`, `ownerRef=setfarm://runtime-completion/${segment(completionRequestId)}`, and `ownerHash=hashCanonicalJson({schema:"setfarm.internal-production-completion-owner.v1",requestId:completionRequestId})`. Mandatory effect uses `ownerKey=canonicalJsonStringify({schema:"setfarm.internal-production-completion-request-id-effect-key.v1",requestId:completionRequestId,effectKey})`, `ownerRef=setfarm://runtime-completion/${segment(completionRequestId)}/mandatory-effect/${segment(effectKey)}`, and `ownerHash=hashCanonicalJson({schema:"setfarm.internal-production-mandatory-effect-owner.v1",requestId:completionRequestId,effectKey})`. Termination uses raw `ownerKey=terminationRequestId`, `ownerRef=setfarm://run-termination/${segment(terminationRequestId)}`, and `ownerHash=hashCanonicalJson({schema:"setfarm.internal-production-termination-owner.v1",requestId:terminationRequestId})`. Finding uses raw `ownerKey=findingSetHash`, `ownerRef=setfarm://finding-set/${findingSetHash}`, and `ownerHash=hashCanonicalJson({schema:"setfarm.internal-production-finding-owner.v1",findingSetHash})`. Operational delivery uses `ownerKey=canonicalJsonStringify({schema:"setfarm.internal-production-operational-event-key-consumer.v1",eventKey,consumer})`, `ownerRef=setfarm://operational-event/${segment(eventKey)}/delivery/${consumer}`, and `ownerHash=hashCanonicalJson({schema:"setfarm.internal-production-operational-delivery-owner.v1",eventKey,consumer})`. The two composite owner keys are the exact canonical JSON TEXT bytes shown; raw JSON whitespace, property reorder, alternate escaping, delimiter concatenation, or parsing and reserialization outside the canonical helper is unequal authority.

The exact builders are `createInternalProductionClaimCanonicalOwnerIdentityV1({claimIdText})`, `createInternalProductionExecutionAttemptCanonicalOwnerIdentityV1({attemptId})`, `createInternalProductionRuntimeSessionCanonicalOwnerIdentityV1({sessionId})`, `createInternalProductionCompletionOwnerCanonicalOwnerIdentityV1({requestId})`, `createInternalProductionMandatoryEffectCanonicalOwnerIdentityV1({requestId,effectKey})`, `createInternalProductionTerminationCanonicalOwnerIdentityV1({requestId})`, `createInternalProductionFindingCanonicalOwnerIdentityV1({findingSetHash})`, and `createInternalProductionOperationalDeliveryCanonicalOwnerIdentityV1({eventKey,consumer})`. Each accepts exactly the named frozen input shape, rejects extra keys, and performs the scalar, ref, body, hash, and owner-key checks above. No builder accepts implementation ID, category, owner key/ref/hash, terminal state, reservation pair, SQL, repository, resolver, or body.

For each identity, `terminalOwnerRef` is exactly `${ownerRef}/terminal/${status}` and `terminalOwnerHash` hashes the category-specific body in declaration order: `{schema:"setfarm.internal-production-claim-terminal-owner.v1",claimId:claimIdText,status}`; `{schema:"setfarm.internal-production-execution-attempt-terminal-owner.v1",attemptId,status}`; `{schema:"setfarm.internal-production-runtime-session-terminal-owner.v1",sessionId,status}`; `{schema:"setfarm.internal-production-completion-owner-terminal.v1",requestId:completionRequestId,status}`; `{schema:"setfarm.internal-production-mandatory-effect-terminal-owner.v1",requestId:completionRequestId,effectKey,status}`; `{schema:"setfarm.internal-production-termination-terminal-owner.v1",requestId:terminationRequestId,status}`; `{schema:"setfarm.internal-production-finding-terminal-owner.v1",findingSetHash,status}`; or `{schema:"setfarm.internal-production-operational-delivery-terminal-owner.v1",eventKey,consumer,status}`. The allowed status discriminants are respectively claim `completed | infra_retry | failed | skipped | abandoned | cancelled`; execution attempt `produced_delta | already_satisfied | no_progress | inconclusive | failed | verified`; runtime session `released | quarantined`; completion owner `accepted | rejected | quarantined`; mandatory effect `applied | reconciled`; termination `terminalized`; finding `published`; and operational delivery `delivered | skipped | quarantined`. Retry, lease, attempt, generation, diagnostic, result, evidence, time, mutable state version, and claim outcome outside the declared claim terminal status enter neither owner nor terminal identity.

`src/internal-production/owner-admission-v1.ts` exports exactly `export type InternalProductionResolvedOwnerTerminalCloseInputV1 = Readonly<{reservationRef:string;reservationHash:string;terminalAuthorityRef:string;terminalAuthorityHash:string}>`. The record has exactly those four enumerable own string keys in that declaration order, no symbols or accessors, and is recursively frozen. It exposes neither an `ownerReservation*` alias nor an owner body, terminal body, category, status, implementation ID, repository, resolver, or other caller-selected authority seam.

`src/db-pg.ts` exports exactly the authenticated in-transaction close-input ports `resolveInternalProductionClaimTerminalAuthorityPairInTransactionV1`, `resolveInternalProductionExecutionAttemptTerminalAuthorityPairInTransactionV1`, `resolveInternalProductionRuntimeSessionTerminalAuthorityPairInTransactionV1`, `resolveInternalProductionCompletionOwnerTerminalAuthorityPairInTransactionV1`, `resolveInternalProductionMandatoryEffectTerminalAuthorityPairInTransactionV1`, `resolveInternalProductionTerminationTerminalAuthorityPairInTransactionV1`, `resolveInternalProductionFindingTerminalAuthorityPairInTransactionV1`, and `resolveInternalProductionOperationalDeliveryTerminalAuthorityPairInTransactionV1`. Each accepts only `(sql: PgTransactionSql, exact scalar identity input)` and returns `Promise<InternalProductionResolvedOwnerTerminalCloseInputV1>`. It locks the exact terminal row and every category-specific child row required to prove terminality, reconstructs the canonical identity through the exact builder, and fully reopens exactly one `bound | closed` sidecar by category, owner key, complete bound body, reservation ref/hash, and the permitted frozen A producer implementation set. Claim permits exactly `a-claim-single-runtime-v1 | a-claim-loop-runtime-v1 | a-claim-v3-downstream-evidence-v1 | a-claim-v3-evidence-only-v1`; finding permits exactly `a-finding-recovery-repository-v1 | a-finding-v3-downstream-evidence-v1 | a-finding-v3-evidence-only-v1`; every other category permits only its exact frozen A implementation ID. Zero matches or more than one match across the permitted set is corrupt and fails before close. The port privately constructs the generic terminal authority only from the locked rows, derives and authenticates its terminal pair through the fixed non-exported category resolver, exact-key constructs and recursively freezes `{reservationRef,reservationHash,terminalAuthorityRef,terminalAuthorityHash}`, and returns that value. The caller passes it directly and unchanged to `closeInternalProductionOwnerReservationV1(sql,input)` after the terminal mutation in the same transaction; it may not rename, reconstruct, merge, or supplement the input. There is no exported terminal-authority factory, resolver table, row-to-authority projector, caller status/body/category, scan-latest path, unlocked read, structural-clone adoption, `ownerReservation*` projection, or second composition.

`tests/execution-attempts/test-database.ts` is the only P3 readiness-fixture installer, capability authenticator, and projected clone/empty-database helper; its existing public test ABI remains exactly `createIsolatedTestDatabase(options?: Readonly<{migrate?: boolean}>)`, and no template, prefix, root, URL, role, nonce, or lifecycle option is added. In each runner-owned projected subprocess it independently resolves its module root from its own `import.meta.url`, realpaths that root and `process.cwd()`, reads and caches exactly one capability frame from inherited file descriptor 3, rejects a missing, malformed, duplicate, trailing, or replayed frame, and closes the descriptor. It parses the runner-owned private fixed-name marker, whose exact canonical body is only `{schema:"setfarm.p3-isolated-projection-marker.v1",projectionRoot,projectedHead,runDatabasePrefix,templateDatabaseName,adminUrlSha256,setupNonceSha256,testNonceSha256}`, authenticates the projected local Git HEAD, validates the exact prefix/name grammar and `adminUrlSha256 === sha256(normalizedExistingAdminUrl)`, requires `moduleRootRealpath === cwdRealpath === markerProjectionRootRealpath`, and accepts the cached capability only when its exact role and `sha256(decodedNonceBytes)` equal that role's marker digest. In the fixed setup subprocess, only role `setup` may connect to the exact empty template database, apply the full test-only guarded migration-32 lifecycle, then apply and fully verify ordinary migration 33 before installing one activated literal-hash A authority/head, create the temporary module at the projected graph's fixed production-relative `src/internal-production/baseline-spawner-startup-admission-v1.js` URL, close every template connection, and exit; the generated module embeds only deterministic recursively frozen `normal_task0_admission_ready` status and `normal-task0-admission-ready` body records whose self pair and activation/head pairs bind to that A node. In the exact one-file test child, role `test` is authenticated before the generated module's observer or resolver returns and before any database helper mutation. A default `createIsolatedTestDatabase()` creates a fresh exact-prefix random database only with PostgreSQL `CREATE DATABASE <new> TEMPLATE <exact quiescent template>`, opens it, and re-resolves/reverifies the byte-identical A activation/head and readiness relations before returning; it never reapplies migration or activation. `createIsolatedTestDatabase({migrate:false})` instead creates an independently prefixed empty database with zero schema and no A/readiness, and `createIsolatedMigration31TestDatabase()` builds only the exact pending-v32 migration-31 state from that empty path. Neither path exposes readiness or A unless the test later invokes the already exact test-only transitions that produce the same authenticated A relations. Every returned database owns an idempotent exact-name close/terminate/drop cleanup, while the runner retains final cleanup authority for every exact-prefix leftover. A setup nonce cannot authenticate test, a test nonce cannot authenticate setup, and neither nonce, template identity, prefix, nor admin hash is reusable or transferable across roots, runs, or processes. This remains test infrastructure only: production never imports it, and it exposes no production injection, environment switch, caller root/path/module/loader/marker/capability/descriptor/template/prefix, callback, SQL, body, pair, or readiness seam.

`scripts/run-isolated-postgres-tests.ts` is the only P3 projection owner. It derives and realpath-validates the source repository root only from the code-owned `new URL("../", import.meta.url)` parent; ambient `cwd`, an environment variable, a CLI argument, a callback, or an imported caller value can neither select nor replace that root. It enumerates the source Git index as the complete dependency authority, accepts only stage-zero `100644 | 100755` regular-file entries, and copies every indexed path's current worktree bytes into one disposable projection while preserving the indexed executable mode. This intentionally carries exact-scope unstaged overlays and automatically includes tracked `tsconfig*`, `.gitignore`, all scripts, package configuration, source, and tests needed by dependency or historical-object reads. A missing indexed path, stage conflict, mode/type drift, tracked symlink, submodule, path escape, socket/device/FIFO/other special entry, modification outside the exact P3 scope, or unexpected nonignored P3 untracked byte fails before projection use.

The runner initializes deterministic projection-local Git metadata, points its object alternates only at the real source repository's realpath-validated object store for read-only historical ancestry/object lookup, stages the projected current bytes, and creates one local projected-current commit with the authenticated source HEAD as parent and code-owned fixed author/committer identity, timestamps, message, and config. Signing, hooks, remotes, fetch, network, writes to the source object store, and caller Git configuration are disabled. The runner alone may add `projection/node_modules` as a link to the realpath-validated source-root dependency directory; that exact link is the sole symlink exception and is never caller supplied. Through its existing import-meta-root-safe isolated-test database lifecycle and existing admin URL, the runner generates one random exact `runDatabasePrefix = "setfarm_p3_" + <24 lowercase hexadecimal characters>`, derives only `templateDatabaseName = runDatabasePrefix + "_template"` and `primaryDatabaseName = runDatabasePrefix + "_primary"`, and first creates the empty template database. It then generates two distinct 32-byte cryptographically random values, `setupNonceBytes` and `testNonceBytes`, and writes one private fixed-name marker exactly `{schema:"setfarm.p3-isolated-projection-marker.v1",projectionRoot,projectedHead,runDatabasePrefix,templateDatabaseName,adminUrlSha256:sha256(normalizedExistingAdminUrl),setupNonceSha256:sha256(setupNonceBytes),testNonceSha256:sha256(testNonceBytes)}`; neither nonce nor the plaintext admin URL enters the marker or any other file. It spawns exactly one fixed projected setup subprocess as `node --import tsx tests/execution-attempts/test-database.ts`, with `cwd` equal to the projection, the existing admin URL authority, the code-owned template database URL, and one runner-created extra pipe at child file descriptor 3, writes exactly one ASCII frame `SETFARM_P3_PROJECTION_CAPABILITY_V1:setup:<64 lowercase hexadecimal setup-nonce characters>\n`, and closes its writer. Only acknowledged exit 0 after guarded migration 32, ordinary migration-33 application/full verification, literal-A activation, fixed-module creation, and complete template-connection closure permits the runner's admin connection to create the primary database with exact `CREATE DATABASE <primaryDatabaseName> TEMPLATE <templateDatabaseName>`. The runner reopens and verifies the primary's exact A activation/head/readiness relations, then spawns the exact one-file test child `node --import tsx --test --test-concurrency=1 <one-file>` in the same projected cwd with `SETFARM_PG_URL` fixed to that primary database and a new private FD3 pipe carrying exactly `SETFARM_P3_PROJECTION_CAPABILITY_V1:test:<64 lowercase hexadecimal test-nonce characters>\n`; it closes that writer after one frame. The nonce, role capability, descriptor, template name, or prefix is never accepted from environment, argv, a file, caller input, or a caller-supplied descriptor; the existing admin environment remains the only caller-supplied database authority and must hash to the marker. Setup and test pipes and nonces are distinct and cannot cross, replay, or be inherited by a second process. No durable setup receipt or adoption path exists or is needed. Per-call helper cleanup drops its exact database; independently, the runner's existing shared `finally` enumerates only databases whose names match its full exact random prefix plus the fixed `template | primary | clone_<12 lowercase hex> | empty_<12 lowercase hex>` suffix grammar, terminates their connections, drops all primary/template/clone/empty leftovers, closes every capability/admin endpoint, and removes the fixed module, marker, `node_modules` link, and projection after setup failure or response loss, primary-clone failure, test-child crash/failure, success, or signal.

The corrected P3 sub-File-Map is exactly 51 existing members of the byte-identical 109-path tuple: 29 production/package paths and 22 tests. Production/package is `scripts/run-isolated-postgres-tests.ts`; `src/db-pg.ts`; `src/db/contract-spine-migration-digests.generated.ts`; `src/db/contract-spine-migration-source-integrity.ts`; `src/db/contract-spine-migrations.ts`; `src/internal-production/owner-admission-v1.ts`; the thirteen execution paths `src/execution/attempt-reconciler.ts`, `src/execution/attempt-repository.ts`, `src/execution/claim-attempt-transition.ts`, `src/execution/claim-runtime-publication.ts`, `src/execution/operational-event-delivery-repository.ts`, `src/execution/operational-outbox-repository.ts`, `src/execution/pre-dispatch-withdrawal-authority.ts`, `src/execution/run-terminal-transition.ts`, `src/execution/run-termination.ts`, `src/execution/runtime-completion-effect-repository.ts`, `src/execution/runtime-completion-effect-runner.ts`, `src/execution/runtime-completion.ts`, and `src/execution/runtime-session-repository.ts`; `src/installer/cleanup-ops.ts`, `src/installer/step-fail.ts`, `src/installer/step-ops.ts`; `src/medic/checks.ts`, `src/medic/medic.ts`; and the five recovery paths `src/recovery/finding-recovery-repository.ts`, `src/recovery/v3-downstream-evidence-publication.ts`, `src/recovery/v3-evidence-only-publication.ts`, `src/recovery/v3-evidence-only-worker.ts`, and `src/recovery/v3-recovery-lifecycle-reconciler.ts`. Tests are `tests/claim-log-lifecycle.test.ts`, `tests/cleanup-ops.test.ts`; the fifteen execution tests `tests/execution-attempts/attempt-reconciler.test.ts`, `tests/execution-attempts/claim-attempt-transition.test.ts`, `tests/execution-attempts/claim-runtime-publication.test.ts`, `tests/execution-attempts/migration-source-digests.test.ts`, `tests/execution-attempts/migrations.test.ts`, `tests/execution-attempts/operational-event-delivery.test.ts`, `tests/execution-attempts/operational-outbox-repository.test.ts`, `tests/execution-attempts/run-terminal-transition.test.ts`, `tests/execution-attempts/run-termination.test.ts`, `tests/execution-attempts/runtime-completion-effect-runner.test.ts`, `tests/execution-attempts/runtime-completion.test.ts`, `tests/execution-attempts/runtime-hooks.test.ts`, `tests/execution-attempts/runtime-session-repository.test.ts`, `tests/execution-attempts/test-database.ts`, and `tests/execution-attempts/v3-downstream-evidence-publication.test.ts`; `tests/findings/repository.test.ts`, `tests/findings/v3-evidence-only-worker.test.ts`, `tests/findings/v3-recovery-lifecycle-reconciler.test.ts`; `tests/internal-production/owner-admission-v1.test.ts`; and `tests/internal-production/task-0-source-manifest.test.ts`. This is 29 + 22 = 51: all five added migration/digest members already belong to frozen109; it includes `scripts/run-isolated-postgres-tests.ts`, `src/internal-production/owner-admission-v1.ts`, `src/execution/runtime-completion-effect-runner.ts`, and `tests/execution-attempts/test-database.ts` and excludes the convergence-evaluation test.

The exact P3 RED/GREEN matrix covers: (1) every scalar lower/upper bound, prefix, printable-ASCII, Setfarm claim-domain boundary, Git-independent SHA-256, consumer, segment round-trip, and extra-key refusal, including claim text `1` and `9007199254740991`, refusal of `9007199254740992`, PostgreSQL maximum, a number input, and noncanonical forms, plus exact-under/exact/over canonical-ASCII byte/string-length cases for 8,462 `ownerKey`, 12,499 `ownerRef`, and 12,519 `terminalOwnerRef`, preservation of the 4,000 default for every other generic string/ref, and refusal to reuse a field-specific maximum at another call site; (2) all eight owner body/key/ref/hash bytes and both canonical JSON TEXT composite-key whitespace/order/escaping tamper; (3) every allowed terminal discriminant, including byte-exact claim `abandoned` and `cancelled`, plus rejection of each misspelling, omission, reorder, nonterminal, retry, lease, generation, and crossed-category state; (4) each named builder's exact signature and refusal of caller identity/body/category/SQL/repository input; (5) lock-before-derive, exact child reread, one fully reopened bound-or-closed sidecar across the exact permitted implementation set, zero/multiple-match corruption, private construction, authenticated terminal pair, exact-key recursively frozen `InternalProductionResolvedOwnerTerminalCloseInputV1`, and direct unchanged generic-close consumption after terminal mutation in one transaction; (6) transaction rollback and callback/commit failure with zero terminal/close residue, post-ack response loss with byte-identical close adoption, and no head advance on replay; (7) exact SQL claim preallocation returning text, canonical text/cap validation before identity, original text for reservation/explicit `INSERT`/reread equality/bind/refs/hashes, checked legacy projection only at DB-to-legacy boundaries, above-cap refusal before claim/category bytes with only a sequence gap, and four producers, attempt/runtime/completion/effect/termination/finding/delivery births, every listed terminal/direct-bypass writer, and absence of an undeclared mutation; (8) crossed reservation/terminal pair/status/key/ref/hash, partial child set, stale head, structural clone, ambiguous sidecar, unlocked row, forged terminal body, extra/missing/reordered close-input key, symbol/accessor, mutation, `ownerReservation*` alias, unchecked claim conversion, number-derived claim authority, and caller body/status fail before close; (9) deterministic two-publisher and terminal-versus-retry/lease interleavings, including exact recovery claim/attempt pair publication with half-pair refusal; (10) ambient-wrong-cwd and direct-current-checkout failure followed by projection success, import-meta-root realpath authority, complete stage-zero `100644 | 100755` Git-index dependency projection, exact-scope unstaged overlay preservation, tracked config/scripts inclusion, executable-mode preservation, deterministic projected-current commit, read-only source-object alternates, historical ancestry/object reads, fixed setup and exact one-file test child/cwd enforcement, sole safe `node_modules` link, and refusal of caller/env/argument root, foreign tracked modification, untracked P3 byte, missing/type/mode/stage/path/symlink/submodule/special-file drift, signing, hook, remote, or network; (11) exact-key template/prefix/admin-hash/two-digest marker with no plaintext admin URL or nonce, distinct setup/test role-framed FD delivery/read/cache/close, and root/HEAD/module-root/cwd/template/prefix/admin-hash/tamper/crossing/replay/second-process refusal; empty-template creation before setup; setup-only guarded migration-32 then ordinary migration-33/A/module creation plus template quiescence; acknowledged setup exit before exact primary clone and test spawn; primary and every normal multi-create helper database cloned only from the exact quiescent template with byte-identical A/head/readiness verification and zero lifecycle reapply; existing ABI and sole `migrate` flag; independently empty `migrate:false`, exact pending-v32 migration31 derivation, and no premature A/readiness; setup loss, child crash, per-call cleanup, and exact-prefix runner-finally termination/drop of primary/template/multiple clone/empty leftovers without a foreign-database drop; and (12) exact migration-33 identity/statements/detector/projector/semantic-source/digest/journal parity, byte-unchanged migration-32 registration/dispatch regions and source/digest/checksum/provenance, post-region through-v32-core/exported-wrapper rebinding, generic ABI visibility, bounded legacy/full-known journal reads, `blocked_by_guarded_predecessor` with read-only tail/schema/detector validation but zero migration-33 adoption/DDL/mutation/journal before targeted 32, one outer transaction/advisory lock, private authentic callable-Sql facade whose `.begin` delegates only to the held transaction savepoint, caller options including `releaseSha` reaching the core unchanged, pre-core exact absent/adoptable versus exact-existing versus fail branches, the frozen core all-row verification update excluding absent/adoptable 33 but including exact existing 33, byte-compatible legacy application/verification metadata, new/adopted 33 INSERT of exact `release_sha | verified_release_sha | verified_at` defined/undefined triples with one captured database timestamp, existing-33 application-release preservation plus defined verification-pair update/undefined no-update, same-transaction automatic successor after current 32, exact tentative applied/adopted/already-applied aggregation, final full 1–33 verification, no caller SQL/callback/facade seam, outer-rollback atomicity, commit-ack-loss exact retry, transaction rollback only, exact immutable relation columns/constraints/foreign keys/triggers, no backfill or migration-33 rollback API, and empty/v31 absence; (13) original-status canonical-handoff insert with claim/session/story/dispatch binding, stored-byte replay, changed-status/later-delivery/crossing/partial/extra/hash/schema/transaction-rollback/concurrency refusal, Task-3 delivery `(claim_id,attempt_id)=(NULL,NULL)` preservation, Task-4 model byte-exact migration-33 authentication and atomic delivery claim/attempt/slice/`attempt_reserved` publication, evidence-only same-transaction claim/attempt publication without a runtime/migration-33 row, ordinary downstream absence of recovery identity or lookup, rollback/response-loss/two-publisher/half-pair refusal, and closed source inventory; and (14) exact51/109 parity, import inertness, no caller template/prefix/root/option, no production or setup-receipt/adoption seam, and no `convergence-eval` ownership claim.
<!-- oa18-p3-canonical-owner-terminal-rebaseline-v1:end -->

<!-- oa18-p4-migration32-transaction-readiness-rebaseline-v1:start -->
Compatibility ordering is explicit: P4 still owns only the exact guarded migration-32 transaction and its exact29 arithmetic is unchanged. After that targeted transaction commits and 32 is current, P3's already source-known ordinary migration 33 is the sole automatic successor and must be applied and fully verified before A activation, full verification, normal initialization, or readiness publication; P4 never folds 33 into migration-32 statements, digest, checksum, provenance, or transaction evidence.

The P4 fence counterpart is constructible only through the controller-owned opaque transaction composition in `src/db-pg.ts`. Its exact exported ABI is `InternalProductionCurrentEntryMigration32TransactionV1`, a recursively frozen visible value containing only `{schema:"setfarm.internal-production-current-entry-migration-32-transaction.v1"}`; zero-input `openInternalProductionCurrentEntryMigration32TransactionV1(): Promise<InternalProductionCurrentEntryMigration32TransactionV1>`; `stageInternalProductionCurrentEntryMigration32InTransactionV1(transaction,evidence): Promise<void>` where `evidence` is `BootstrapMainClaimHandoffGuardedMigration32EvidenceV1`; `commitInternalProductionCurrentEntryMigration32TransactionV1(transaction): Promise<BootstrapMainClaimHandoffGuardedMigration32ApplyResultV1>`; and `abortInternalProductionCurrentEntryMigration32TransactionV1(transaction): Promise<void>`. A module-private WeakMap alone authenticates the handle and retains its SQL transaction, private deferred disposition, tentative result, and exact phase `locked_v31 | staged | committing | terminal`. A clone, crossed process, illegal phase, second stage, or repeated commit/abort fails. The visible value and every exported signature contain no SQL, connection, callback, options, URL, database, root, migration ID/body, lock key, evidence constructor, result setter, or generic guarded mode.

`openInternalProductionCurrentEntryMigration32TransactionV1()` bypasses `ensureSchemaReady`, starts one raw `getSql().begin` with fixed bounded transaction-local timeouts and `search_path=public`, and resolves the handle only after `SELECT version,name,checksum,state FROM public.setfarm_schema_migrations WHERE version=31 FOR UPDATE` returns exactly one row equal to version `31`, name `031_operational_failure_cause_authority_v3`, the pinned v31 checksum, and state exactly `applied`. The private transaction callback then waits on the private disposition. While the handle remains `locked_v31`, `applyInternalProductionBaselineBootstrapHandoffMigrationV1({authorizationRef,authorizationHash})` freshly reopens the fixed current-entry operation, sealed admission, v31 audit, sole pending-32 projection, clean source/build, and post-predecessor-termination legacy-zero pair; performs one final complete legacy/pre-manifest zero-owner reobservation and requires byte equality; publishes or byte-identically adopts only the same operation-bound authorization consumption; remints the existing WeakSet-authenticated exact evidence; and calls `stageInternalProductionCurrentEntryMigration32InTransactionV1(transaction,evidence)`. `src/db-pg.ts` never imports the receipt, startup-admission, or CLI module; the controller dynamically imports the exact db-pg ports, so this composition creates no ESM cycle and preserves import inertness.

The existing dedicated guarded port becomes exactly `applyBootstrapMainClaimHandoffGuardedMigration32V1(sql: Sql | TransactionSql,evidence: BootstrapMainClaimHandoffGuardedMigration32EvidenceV1): Promise<BootstrapMainClaimHandoffGuardedMigration32ApplyResultV1>`. It delegates to one private guarded body: root `Sql` uses `begin`, while the held controller `TransactionSql` uses `savepoint`; no `TransactionSql` is passed to the former Sql-only nested-`begin` implementation. Stage calls only the `TransactionSql` branch. That private body retains the existing advisory/table locks, exact predecessor/pending checks, DDL, migration journal and application provenance, singleton owner-head seed, schema projection, journal/source-chain verification, and response-loss adoption. Stage stores the tentative result only in the private WeakMap and returns void. Commit releases the success disposition and returns that result only after the outer `begin` COMMIT acknowledgement. Abort releases a private rollback sentinel and returns only after rollback. Callback failure, process death, commit rejection, or backend loss exposes no tentative result, migration receipt, or current audit and creates no new migration-32 journal, schema, or owner-head residue; an initial-application failure leaves all three absent. The durable authorization consumption may be reopened after rollback only for the byte-identical current-entry operation, authorization, and evidence; it never authorizes changed evidence. Commit or abort terminally invalidates the handle, which never spans a postcommit effect.

Only after the guarded-32 transaction's acknowledged commit does zero-input current-entry resume separately reopen and publish the migration-32 applied receipt/current audit, invoke the ordinary generic controller to apply or exact-adopt and fully verify sole successor 33 in its own transaction, call `activateInternalProductionBaselineOwnerProducerManifestV1()`, run generic full verification of the complete through-33 chain, perform normal database initialization, and permit only the already sealed same spawner generation to publish admission-ready. Migration 33 adds no P4 receipt/status field, top state, nested discriminant, transaction handle, or exact29 path; while the existing receipt/current-audit prefix remains durable and A is still absent, retry derives progress only by exact journal/schema verification of 33. Crash after the 32 commit but before its receipt/current audit reopens the exact guarded result; crash after that audit but before 33 starts retries from current 32; failure inside the 33 transaction rolls back only 33 and retries it; loss of the 33 commit acknowledgement exact-verifies the one journal/schema result and adopts it without duplicate DDL; crash after 33 is current but before A resumes at A. Every later prefix remains independently idempotent and recoverable without another guarded-32 transaction or spawner restart. An ordinary publisher released from the v31 lock then follows v31 journal row → owner head → admission resolution and fails closed before reservation or INSERT while any migration-32 applied/current, migration-33 applied/current, A-activation, complete full-verification, initialization, or readiness fact is absent or mismatched. Only the same current-entry operation's typed canary may proceed after the complete postcommit chain.

The fixed-path P2 readiness loader requires callable own named exports `observeInternalProductionPreSchemaSpawnerRebindStatusV1` with arity zero and `resolveInternalProductionTask0SpawnerAdmissionReadyV1` with arity one, and invokes only `observeInternalProductionPreSchemaSpawnerRebindStatusV1()` followed by `resolveInternalProductionTask0SpawnerAdmissionReadyV1(status.admissionReady)`. It must not require the module namespace to contain only those two keys. The binding-declared additional startup exports are permitted: `prepareInternalProductionPreSchemaSpawnerRebindAuthorizationV1`, `executeOrRecoverInternalProductionPreSchemaSpawnerRebindV1`, `resolveInternalProductionPreSchemaSpawnerRebindAuthorizationV1`, `resolveInternalProductionPreSchemaSpawnerRebindStatusV1`, `resolveInternalProductionPreSchemaSpawnerStartupTokenV1`, `resolveInternalProductionPreSchemaSpawnerRestartAuthorityV1`, `resolveInternalProductionPreSchemaSpawnerPredecessorTerminationObservationV1`, `resolveInternalProductionPreSchemaSpawnerReplacementProcessObservationV1`, and `resolveInternalProductionPreSchemaSpawnerSealedAdmissionV1`. The startup-module source inventory rejects every undeclared environment, root, path, module, SQL, callback, body, parser, observer, store, or readiness-injection export; this is no arbitrary extension seam. Only returned records, not functions or exports, are recursively frozen. The observed outer state remains exactly `normal_task0_admission_ready`; the resolved body state remains exactly `normal-task0-admission-ready`; and self-pair, same-generation, pair/body, authenticated current-chain unique literal-hash A-ancestor, and that A node's activation/head equality remain mandatory while the current tip may be A+B through A+B+C+D+E.

The exact P4 sub-File-Map is 29 existing members of the unchanged 109-path tuple: thirteen production/package paths and sixteen tests. Production/package is `package.json`, `src/db-pg.ts`, `src/db/bootstrap-main-claim-handoff-v1-migration.ts`, `src/db/contract-spine-migrations.ts`, `src/db/contract-spine-migration-digests.generated.ts`, `src/execution/runtime-completion.ts`, `src/spawner.ts`, `src/internal-production/baseline-post-handoff-receipt-v1.ts`, `src/internal-production/baseline-post-handoff-cli.ts`, `src/internal-production/baseline-restart-authority-retirement-v1.ts`, `src/internal-production/baseline-service-restart-helper-v1.ts`, `src/internal-production/baseline-service-restart-sequence-v1.ts`, and `src/internal-production/baseline-spawner-startup-admission-v1.ts`. Tests are `tests/internal-production/baseline-post-handoff-cli.test.ts`, `tests/internal-production/baseline-restart-authority-retirement-v1.test.ts`, `tests/internal-production/baseline-service-restart-helper-v1.test.ts`, `tests/internal-production/baseline-service-restart-sequence-v1.test.ts`, `tests/internal-production/baseline-spawner-startup-admission-v1.test.ts`, `tests/internal-production/baseline-post-handoff-receipt-v1.test.ts`, `tests/internal-production/baseline-owner-producer-manifest-activation-controller-v1.test.ts`, `tests/internal-production/owner-admission-v1.test.ts`, `tests/internal-production/task-0-source-manifest.test.ts`, `tests/execution-attempts/migrations.test.ts`, `tests/execution-attempts/migration-source-digests.test.ts`, `tests/execution-attempts/run-protocol.test.ts`, `tests/execution-attempts/runtime-completion.test.ts`, `tests/execution-attempts/v3-release-admission.test.ts`, `tests/claim-log-lifecycle.test.ts`, and `tests/evals/convergence-eval.test.ts`. This exact 13 + 16 map adds, removes, and reorders no literal Task 0 path.

The exact P4 RED/GREEN matrix covers: (1) exact29/109 and plan/spec byte parity; (2) handle exposure only after exact applied-v31 row lock and rollback on absent, adopted, wrong-name, wrong-checksum, or wrong-state v31; (3) final zero reobservation and authorization consumption after the lock, with nonzero/drift/crossed-pair refusal before DDL; (4) clone, cross-process, illegal phase, repeated operation, and non-controller caller refusal; (5) private `Sql.begin` versus `TransactionSql.savepoint` dispatch with no exported SQL/callback/generic migration seam; (6) stage-result and receipt/current-audit invisibility before acknowledged outer commit; (7) callback throw, abort, process death, commit rejection, and backend loss with zero migration-32/schema/head residue and same-exact durable-consumption recovery; (8) one atomic successful migration journal/application-provenance/schema/head result; (9) ordinary and V3 publishers blocked on v31 and then failing at owner-head/admission throughout every incomplete postcommit prefix, including deterministic two-publisher interleavings; (10) guarded-32 acknowledged commit → migration-32 applied receipt/current audit → separately transacted ordinary-33 apply/exact-adopt and full verification → A activation → complete generic full verify → normal initialization → same-generation ready ordering, with crash recovery before/after the 32 receipt/audit, before/during/after the 33 transaction, after 33 before A, no duplicate DDL/journal, no second guarded transaction or restart, and no new P4 field/state/path; (11) loader acceptance of the real binding module's declared extra exports plus exact two-name/arity invocation, and rejection of missing, wrong-arity, nonfunction, or undeclared injection exports; (12) exact outer/inner readiness literals, frozen returned records, self/pair/generation/A-ancestor/activation/head relations, and tamper refusal; (13) default no-module, pending-32, pending/drifted-33, or every other incomplete startup state refusing a run byte; (14) digest/source/projector/DDL parity through 32 plus read-only compatibility verification of the source-known 33 successor without changing any migration-32 byte; (15) one-way import graph and no import-time DB/process/store/void work; and (16) source-only delivery with no live database, current-entry, service, authority, canary, or run mutation. This ruling supersedes every earlier Sql-only nested-transaction assumption, whole-module two-key readiness assertion, smaller P4 map, or claim that a transaction lock spans migration-33 or any later activation/readiness effect.
<!-- oa18-p4-migration32-transaction-readiness-rebaseline-v1:end -->

Close's public input is exactly `{reservationRef,reservationHash,terminalAuthorityRef,terminalAuthorityHash}`. The code-owned composed controller uses repository `resolveReservation(sql,pair)` to obtain the category, selects only the corresponding non-exported resolver from `src/db-pg.ts`, authenticates the terminal pair inside that same repository transaction, and passes the resulting non-caller-constructible terminal authority to `closeInTransactionV1`. The repository re-locks the row/head, checks the exact bound owner/category/key/pair, CAS-publishes one close, and `resolveClose(sql,pair)` reopens it through the same port. Top-level production pair-only resolvers use this composition; the pure core never opens a connection. A lost close response adopts only the identical close; a structural terminal body/clone, crossed category, different terminal pair, stale head, or partial transition fails without mutation. No public close accepts a category, terminal object, resolver registry, repository, or factory. This is PostgreSQL atomicity only: filesystem, process, listener, dispatch, and service effects begin only after the bound transaction is durable and remain governed by their own outbox/receipt protocol. Reservation activation begins in Task 6A only after migrations 32 and 33 are applied/current, A-manifest activation and complete through-33 verification/initialization succeed, and normal admission is ready.

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

In `migrations.test.ts` and `migration-source-digests.test.ts`, require one guarded ordinal 32 whose exact ordered statements/projector contain owner-admission sidecar/head, bootstrap operation/claim/terminal-pair schema, and all four activation-authority relations including immutable source/activation/head enforcement and singleton current. Before application, the targeted v31 audit proves 1–31 current and the sole pending inspector proves exactly guarded 32. Generic apply reports it skipped and generic full verify fails `MIGRATION_INCOMPLETE`. The already prepared Task 6A controller alone reopens both pairs, terminally resolves the operation-bound sealed Task 0 spawner, reobserves the complete legacy/pre-manifest owner census, consumes the one-use `InternalProductionPreManifestMigration32AuthorizationV1`, applies once, seals `InternalProductionBaselineBootstrapHandoffMigrationReceiptV1`, and produces the current audit with zero pending/drift. It never calls normal complete-zero before activation. Current-entry stores the applied pair/current audit, not a pending-current pair; its receipt preserves the causal quartet plus pre-schema/sealed/legacy-census authorization chain. Task 7, every normal restart/sequence, B P0, D hook load, and both baseline resolvers reopen the applied chain and have no apply seam.

The shared isolated lifecycle and every direct caller are executable acceptance scope. `test-database.ts` and `run-isolated-postgres-tests.ts` prove empty template → authenticated setup automatic apply → exact test-only guarded-migration-32 capability → ordinary migration-33 application/full verification → A capability → full verify/quiescence → verified primary/default clone, with no lifecycle replay by a normal helper call. Each of the twenty literal direct-caller tests is audited: a test requiring pending semantics uses the separately empty `{migrate:false}` or derived migration31 path and asserts generic verify/readiness failure before the exact transition; a test requiring a complete fixture receives an authenticated clone of the fully prepared template. Tests reject a production/env/caller-selected template, prefix, root, nonce, role, or test mode; arbitrary migration ID/body/evidence; capability import from `src`; generic guarded apply; zero/two pending entries; production apply before the Task0 spawner is sealed or after normal admission/canary; a normal complete-zero/manifest guard substituted for the pre-manifest authorization; manifest before schema; wrong/replayed authorization; partial schema state; changed implementation/statements/digest/projection; response-loss duplication; or any Task 7/B/Task 8 apply. Crash tests additionally cover setup loss, template connection leakage, primary/multi-clone/empty cleanup, and foreign-prefix preservation, while current-entry retry returns the same pairs or fails closed without a second restart/schema mutation.

In `baseline-post-handoff-receipt-v1.test.ts`, exercise the B-purpose guard seam without importing B: bind only the literal `golden-launch-operation-migration-release-v1` purpose to a canonical pending-input ref/hash, reopen the authorization, bind one canonical operation ref/hash, and consume the underlying generic guard exactly once through A's named consumer. Crash before/after authorization publication, operation binding, guard consumption, consumption-receipt publication, and response; fresh-process recovery adopts the same authorization/consumption pairs. Reject another purpose/namespace, missing pending input, structural clone, changed operation, direct generic-store access, replay, and a second consumer before any guarded side effect.

In that same focused file, exercise Task 6A current-entry and Task 7 post-rebind ordering separately. Current-entry tests require the fixed PBA source pair; an immutable operation prepared before any mutation; the acyclic pre-schema authorization/startup-token/restart/termination/postzero/sealed-admission chain; applied migration receipt/current audit with its causal v31/pending and sealed/legacy-census authorization chains; A-manifest activation; same-generation `normal-task0-admission-ready`; current Task 0 controller; and mixed runtime authority. They require spawner/controller source-build equality, require dashboard/MC generations unchanged from delivered observations, and reject canary admission before schema/manifest/full-verify/normal DB initialization/admission-ready. Crash/race/replay every prefix and assert the exact twelve-state nullability, one migration, one spawner restart, one token-to-sealed-to-ready chain, one canary start/claim/termination, zero redispatch, and zero unrelated owner. Tests invoke no standalone production restart/apply mutation argv. PBA fixtures additionally enforce `GitObjectHashV1` 40/64 boundaries for `producerCommit`, `deliveryMergeSha`, `currentSource.sha`, `currentSource.treeHash`, and `currentSource.originMainSha` versus exact 64-hex content/build/receipt/lock/evidence hashes. Post-Task6 wire integration compares source CLI only with the later delivery-evidence HTTP response. Post-rebind tests independently exercise both fixed URLs: the delivery endpoint must return the byte-identical predecessor pair/body, while the loaded endpoint must return only the strict startup snapshot with recomputed loaded hash/ref, PID/listener-fence equality, and embedded-expected source/tree/build equality. They reject swapped URLs or bodies, a loaded response passed to the delivery pair resolver, any loaded-ref/delivery-ref equality claim, stale/crossed PID/listener/source evidence, and either missing check. The remaining post-rebind tests consume the already applied predecessor, simulate only Task 7 build/restart/service/source/zero-owner receipts, and assert `absent -> predecessor_ready -> rebuilding -> restarting -> verifying -> ready`; there is no migration-applying state or schema write. Reject a Task 7 apply attempt, stale predecessor, mixed receipt/restart pairs, caller locator/body, structural clone, source/build/schema/service/evidence drift, nonzero owner, fork, or a repeated settled restart.

In `operational-active-run-status-v1.test.ts`, require the source tuple, Zod enum options, generated JSON Schema enum, CLI JSON, dashboard filter, and existing authoritative DB census predicate to contain the same ordered four values: `running`, `resuming`, `cancelling`, `failing`; require the compatibility fixture to be a schema-valid member bound to that exact schema. Exercise the transition sequence `running -> resuming -> cancelling -> failing` and prove every state remains operational-active without being collapsed; transitions from any of those states to `completed`, `failed`, or `cancelled` become inactive. Reject `pending`, every terminal status, a reordered/extended artifact, duplicate value, or locally maintained dashboard/UI list. Spawn the JSON CLI through `npm run --silent`, feed its stdout directly to the parser, and prove the stream contains exactly one JSON document with no npm banner.

For backup recovery, use a temporary fixed-root test harness and an injected crash hook around every `dump-linked`, `list-linked`, and `checksum-linked` hard-link operation: immediately before the link, immediately after the link but before directory fsync, after fsync but before the immutable phase record is published, and immediately after that record is published. Every rerun must authenticate and adopt only the exact contiguous prefix, complete the remaining links, and return the byte-identical receipt. Add crashes before/after `artifacts-sealed`, `published`, every source-name unlink, and `sources-released`. For each of the seven journal phases, crash before/after unpredictable temporary-record creation, full write, file fsync, no-replace publication, journal-directory fsync, temporary-name unlink, and final `O_NOFOLLOW` reopen; every recovery either authenticates the same whole record and continues or sees no committed phase. Reject a partial/truncated record, a later record without its predecessor, a forged/reordered/hash-chain-broken record, an unknown fixed record, a symlink/hardlink/mode-drifted record, an unequal pre-existing phase target, a temporary-file poisoning attempt, any use of append/`O_APPEND` against journal authority, a gap such as dump plus checksum without list, a target with different device/inode while its sealed source exists, any artifact hash/size/mode/symlink/hardlink mismatch, a foreign pre-existing target without the durable attempt, or a second attempt. Prove the final three targets are regular non-symlink mode-`0600`, link-count-one files and that rerunning `backup --json` only reopens the same receipt.

Round 4 extends that focused current-entry matrix without adding a top state. It enumerates all four migration-applying phases, all three spawner-admission phases, both canary-running phases, and both settled phases; crashes immediately before/after every durable member named by those discriminants and requires byte-identical adoption. Round 5 keeps that matrix and publishes/resolves `InternalProductionPreMutationLoadedRuntimeServiceAuthorityV1` against the sole named-field `InternalProductionServiceCensusV1`: tests compare the exact spawner/dashboard/Mission-Control/OpenClaw process, generation, owner-count, listener, and applicable source/tree/build fields one by one plus `observedServiceCensusHash === censusHash`, never an array or whole-object shortcut. OpenClaw source/tree/build remain null. Every later status/final entry preserves the pair; a structural clone or any applicable identity/count drift fails. Each branch test asserts all required prior pairs, every mandated null later member, the finite blocked reason, and refusal of an impossible combination. Wire fixtures reject any flattened lifecycle mirror and require `current-entry-status` and `verify-current-entry` to emit only their one strict canonical object each. Round 6 additionally mutates every member, position, and excluded/derived field in the census, pre-mutation projection, ordered resolved-pair tuple, fresh runtime/owner observation, and verification-receipt hash inputs. It rejects a reordered tuple, reordered named JSON construction, omitted or extra pair, included derived ref/hash, excluded authority member, crossed status/entry/observation pair, stale service or owner body, mismatched nested body hash, non-current manifest activation, and a hash-only fresh observation. Positive fixtures publish and pair-resolve the observation before the verification receipt, then make the verification resolver freshly reobserve both runtime and complete owner evidence and require byte equality.

- [ ] **Step 2: Implement the smallest fixed authority**

`baseline-spawner-startup-admission-v1.ts` owns the exact target-guard/P0 bootstrap records plus the disjoint pre-schema authorization, startup token, restart authority, predecessor-termination observation, replacement-process observation, sealed admission, admission-ready record, their strict stores, and pair-only resolvers. Zero-input authorization prepare first resolves the fixed current-entry head in exact `operation_prepared`, copies its operation ref/hash into the authorization, and cannot create an authorization for an absent, later-phase, blocked, or caller-supplied operation. Pair-only execute/recover reopens the authorization and fixed operation and requires byte equality before any helper/outbox/dispatch byte. `baseline-service-restart-helper-v1.ts` alone performs both fixed no-shell dispatch families, distinguished by closed operation schema/action ID; the pre-schema family is literal `setfarm-spawner` and cannot accept or adopt a normal restart authorization. Before dispatch the controller publishes only an immutable token binding the operation/authorization, target source/tree/build, and authenticated predecessor process/service/generation. It deliberately contains no predicted next-generation field, restart authority, termination observation, replacement identity, post-termination census, sealed admission, or admission-ready pair. Actual generation first exists in the later replacement-process observation and must differ in process identity from the predecessor while matching the token's target source/tree/build. Only that operation-bound token and fixed locator—not environment, argv, caller mode, service, label, path, body, or structural clone—may boot `src/spawner.ts` into its no-producer `pre-manifest-bootstrap-sealed` loop.

The acyclic chain is operation → authorization → token → restart authority → code-owned predecessor-termination observation → replacement-process observation → post-termination zero observation → sealed admission → migration/current audit → manifest activation → admission-ready. Termination is never a hash-only boolean: its strict receipt reopens the exact predecessor process/service/generation and proves terminal process plus absent listener. The replacement receipt reopens termination, records actual PID/start-time-derived process identity, service identity, generation, source/tree/build, and proves it differs from the predecessor. Sealed and ready receipts bind every exact predecessor pair; every record has one no-replace store and pair-only resolver, and no resolver accepts a structural body or scans latest. Rebind status is the strict discriminated progression `absent → prepared → startup_token_published → dispatching → pre_manifest_bootstrap_sealed → normal_task0_admission_ready`; `dispatching` has a nested exact restart/termination/replacement prefix, and `blocked` preserves only the exact last-valid status pair. Missing, extra, crossed, or phase-impossible fields fail strict parsing.

In the sealed branch `src/db-pg.ts` opens only the minimal read-only connection needed for the targeted v31 audit and pending-32 inspector; it neither skips nor weakens generic verification, never reports normal DB ready, creates no owner/listener/claim, and exposes no normal spawner loop. Default startup still runs ordinary generic full verify and therefore fails closed while 32 is pending or 33 is blocked/pending/drifted. An owner/process/listener/worktree/stale-child race at any observation/dispatch/termination/seal boundary leaves status nonterminal and migration authorization unavailable. After the migration-32 receipt/current audit, the controller separately applies/exact-adopts and verifies ordinary 33, then activates A; the same sealed process reopens the exact migration-32 and A pairs, verifies complete through-33 schema, runs normal DB initialization, atomically publishes `normal-task0-admission-ready`, and only then enables producer entrypoints. Wrong/missing/replayed token/admission, a crossed operation, unexpected process identity, noncurrent 33, or full-verify/initialization failure exits or blocks. There is no environment flag or generic pending-32/33 bypass. A and D retain disjoint operation schemas, roots, locators, authenticators, and action tables; source tests enforce those boundaries.

Before each guard observation, the coordinator freshly reopens the prior resolved `after` projection and current runtime projection and requires canonical equality. Pair zero's `before` equals the sealed initial projection; pair `i.before` equals pair `i-1.after`; the final projection equals pair two's `after`. It holds Setfarm/Mission Control source and build identities invariant throughout the sequence and permits only the ordinal's target service authority/generation transition. It derives each `orderedAdvanceHashes[i]` from the exact predecessor/successor projection pair, ordinal, service/action, composite pair, and prior advance hash, then the final receipt/resolver recomputes the complete three-link chain.

`baseline-service-restart-sequence-v1.ts` is a required Task 0 postcondition and the sole sequence-intent, guard-pair, composite-pair, CAS-journal, final-receipt, and status owner. It calls Task 0's code-owned zero-owner observer and `restartInternalProductionBaselineServiceV1()` directly; it does not spawn the public CLI or duplicate restart logic. Every record uses the Task 0-owned fixed private root and unpredictable-temporary/file-fsync/no-replace/parent-fsync/`O_NOFOLLOW` reopen protocol. `baseline-post-handoff-cli.ts` validates exactly the three finite intent literals `live-rebind|d-startup-hook-load|documentation-rollback` and delegates `resume-restart-sequence` or read-only `restart-sequence-status`; the mutating command returns only a completed final pair and status never repairs or advances. A fresh process resolves every returned pair before use.

`baseline-restart-authority-retirement-v1.ts` is the sole fixed transition lock/epoch/readiness/activation/retirement/cutover writer. The helper, bootstrap preparer, and sequence coordinator all call its internal A-active guard while holding the same lock before their first durable mutation. D's exact reviewed cutover adapter alone imports A's two cutover mutations unaliased; every other D consumer imports only types/resolvers/status, while A imports nothing from D. `owner-admission-v1.ts` owns the pure guarded fence, canonical 35-category/35-key/36-scalar census mapping, plan-manifest, typed reservation/sidecar-port, bind, close, and repository/controller port ABI. It may import only pure canonical helpers and type-only PostgreSQL interfaces; it never imports the receipt, activation controller, restart retirement/helper/sequence, startup admission, CLI, spawner, execution call sites, or a database singleton, and it exports no production composition factory or resolver table. `baseline-post-handoff-receipt-v1.ts`, the activation controller, retirement/helper/sequence/startup modules, `src/db-pg.ts`, and the producer modules named by manifest A depend one way on `owner-admission-v1.ts`. `src/db-pg.ts` alone constructs the production repository/controller and fixed category-specific authenticated terminal resolver table after an explicit configured connection exists; coordinators and top-level pair-only resolvers obtain that code-owned composition, never caller ports/capabilities. Runtime observation, DB connection, store opening, process inspection, controller construction, and `void` execution at module scope are forbidden in every other new Task 0 module. Type-only reverse edges are also forbidden when they would load a runtime module; shared types live in the core.

`baseline-post-handoff-receipt-v1.ts` owns the guarded migration receipt, B-purpose guard seam, and fixed recovery-source operation/run receipt/status/resolver while consuming the owner-admission core. The pure activation types/projections remain in `owner-admission-v1.ts`; `src/db-pg.ts` solely owns their PostgreSQL repository, private delivered-phase/source-authority resolver tables, transaction-pinned current resolver, and public pair/current composition. `baseline-post-handoff-cli.ts` and `package.json` own the three bootstrap verbs. The repository transaction files named in the File Map implement exactly the sixteen literal seven-field rows of `INTERNAL_PRODUCTION_OWNER_PRODUCER_ROWS_A_V1`, including four real claim births, three real finding-set births, `execution-attempt` separately from `fixture-attempt`, and the source bootstrap's `run` reservation separately from the ordinary `persistWorkflowRunInTransaction` producer; `INTERNAL_PRODUCTION_OWNER_PRODUCER_MANIFEST_A_V1.manifestHash` hashes exactly its schema, plan, and ordered rows. The target-family ABI changes no A-owned producer call site and leaves manifest A at exactly sixteen rows. The exact cumulative activation row counts are `A=16`, `A+B=26`, `A+B+C=32`, `A+B+C+D=48`, and `A+B+C+D+E=57`; every activation test rejects another count, omission, duplicate, reorder, or phase sum. A imports no B–E source and does not assert a future module exists. `owner-admission-v1.test.ts` and `baseline-post-handoff-receipt-v1.test.ts` require exactly 35 unique categories, exactly 35 key-checked census-map entries, complete coverage of all 36 scalar counters, the intentional two-scalar `artifact-publication` mapping, the exact sixteen A rows, unique implementation ID/module-function/owner-key tuples, and census keys equal to each row's category map.

The owner-inventory test parses every production source in the current 109-path literal File Map and enumerates every owner-table INSERT/birth plus every matching terminal UPDATE. It requires each birth to map to exactly one declared row and to execute admission resolution → begin/adopt → owner mutation → sidecar bind inside one passed `PgTransactionSql`; it requires each terminal transition to authenticate the declared reservation and terminal pair before close in that same transaction. An undeclared birth or terminal UPDATE, a declared row with no matching mutation, bind-before-birth, birth-before-begin, close-before-terminal, a direct SQL/bypass path outside the tuple, or a second owner for one atomic key fails the AST inventory. The direct SQL/bypass and terminal audit explicitly includes `src/execution/attempt-reconciler.ts`, pre-dispatch withdrawal, installer cleanup/step failure/step operations, medic checks/repair, evidence-only worker, and recovery-lifecycle reconciliation paths and their named tests. `runtime-completion-effect-runner.ts` is not a mandatory-effect producer: it remains in the File Map only as a caller of repository-owned terminal/apply behavior.

Owner identity and terminal semantics are fixed. Run identity is exact `run.id`; retry or reobservation of the same persisted run adopts the byte-identical reservation. A run closes only inside `transitionRunToTerminalInTransaction` when status becomes exactly `completed | failed | cancelled`, with the terminal UPDATE and typed close in the same transaction. An already-terminal byte-identical replay adopts the existing close and does not advance the owner-admission head. Execution-attempt identity is exact `attempt_id`: every `reserveAttemptInTransaction` generation allocates a new `attempt_id` and therefore a distinct reservation, while retry/reobservation of the same `attempt_id`, generation, and fence adopts the same reservation. Any CAS from `claimed | running` to exact `TerminalAttemptDispositionV1` member `produced_delta | already_satisfied | no_progress | inconclusive | failed | verified` closes in that transaction.

The execution-attempt terminal state fixture owns exactly this module/function inventory: `src/execution/attempt-repository.ts#createAttemptRepository.complete`; `src/execution/attempt-reconciler.ts#completeTerminalAttemptForRecovery`; `src/execution/claim-attempt-transition.ts#closeClaimAndBoundAttemptInTransaction`; `src/execution/claim-attempt-transition.ts#completeStoryClaimAndBoundAttempt`; `src/execution/pre-dispatch-withdrawal-authority.ts#withdrawPreDispatchClaimInTransaction`; `src/execution/run-terminal-transition.ts#transitionRunToTerminalInTransaction`; `src/recovery/v3-downstream-evidence-publication.ts#createV3DownstreamEvidencePublication.complete`; `src/recovery/v3-evidence-only-publication.ts#createV3EvidenceOnlyPublication.completeAttempt`; `src/recovery/v3-evidence-only-worker.ts#quarantineDelivery`; `src/recovery/v3-recovery-lifecycle-reconciler.ts#blockExpiredEvidenceAttempt`; and `src/recovery/v3-recovery-lifecycle-reconciler.ts#blockExpiredModelAttempt`. The AST/runtime scan rejects a terminal execution-attempt UPDATE outside this exact list, a missing listed writer, or any listed writer that does not perform the authenticated typed close in the same transaction.

Claim identity is canonical `claimIdText`, while the persisted claim key remains `claim_log.id`; only `closeExactSingleStepClaimInTransaction`, `closeClaimAndBoundAttemptInTransaction`/`completeStoryClaimAndBoundAttempt`, or `transitionRunToTerminalInTransaction` closes it. Before each of the four claim births, its transaction preallocates text with exact SQL `SELECT nextval(pg_get_serial_sequence('claim_log','id'))::bigint::text AS id`; it validates unknown driver output as canonical claim text and `BigInt(claimIdText) <= 9007199254740991n` before any owner, claim, step, story, runtime, attempt, or category mutation. It derives identity from original text, begins/adopts with that identity, explicitly supplies the same original text to INSERT, rereads for original-text equality, and binds in that transaction. A legacy numeric projection is permitted only after identity derivation and the exact safe-integer/string-round-trip check; it cannot provide authority. Sequence allocation is not owner birth; rollback or an above-cap rejection may consume one unused value but exposes no owner/pair/category byte. Response loss and reobservation of the same committed in-domain `claim_log.id` adopt the byte-identical reservation; a new story `claim_generation` that inserts a new claim row/`claim_log.id` is a distinct reservation and requires the prior claim's authenticated terminal close. A pre-P3 persisted claim above the cap is intentionally not reconstructed through a number: its canonical terminal resolution fails closed. Focused tests cover rollback, response loss, retry/reobserve, explicit-ID equality for all four claim producers, and the cap-negative terminal-resolution case. Runtime-session identity is `session_id`; only the three reserved/drained release functions or the run-terminal drained-to-released transition closes it. Completion identity is `request_id`; draining reclaims and processing `owner_attempt_count` rotations adopt the same reservation, birth is `createRuntimeCompletionRepository.claim` at `requested → draining`, and only accept/reject/quarantine closes it. Mandatory-effect identity is `(request_id,effect_key)`; `attempt_count`/`lease_token` retry rotation never closes or reopens it, `releaseForRetry` is nonterminal, repository `settle` or run-terminal terminal effect application closes it, and quarantine remains nonzero while the census still classifies the row as not applied/reconciled. Termination identity is `request_id` and closes only at `transitionRunToTerminalInTransaction`'s request-to-terminalized transition. Finding identity is `finding_set_hash`, one owner per atomic set publication, and closes only after the exact set plus children reread in the same transaction. Operational-delivery identity is `(event_key,consumer)` and closes only at delivery-repository `settle` or its quarantine/expired-final-lease sweep. `run-protocol`, `v3-release-admission`, and `convergence-eval` additionally prove every direct persistence path returns and consumes the same transaction-bound run-owner pair and that an unrelated CLI run loses to the fixed pre-manifest fence while only the later typed current-entry target can proceed.

Migration 32 additionally creates exactly four activation-authority relations, with columns in the following literal order. Immutable `internal_production_owner_producer_source_build_authorities_v1` is `(source_build_authority_ref text NOT NULL, source_build_authority_hash char(64) NOT NULL, plan text NOT NULL, manifest_hash char(64) NOT NULL, owner_category_registry_hash char(64) NOT NULL, owner_category_census_map_hash char(64) NOT NULL, canonical_body text NOT NULL, created_at timestamptz NOT NULL DEFAULT transaction_timestamp())`. Immutable `internal_production_owner_producer_manifest_set_activations_v1` is `(activation_ref text NOT NULL, activation_hash char(64) NOT NULL, phase text NOT NULL, manifest_set_hash char(64) NOT NULL, owner_category_registry_hash char(64) NOT NULL, owner_category_census_map_hash char(64) NOT NULL, predecessor_activation_ref text, predecessor_activation_hash char(64), predecessor_head_ref text, predecessor_head_hash char(64), canonical_body text NOT NULL, created_at timestamptz NOT NULL DEFAULT transaction_timestamp())`. Immutable `internal_production_owner_producer_manifest_activation_heads_v1` is `(head_ref text NOT NULL, head_hash char(64) NOT NULL, phase text NOT NULL, activation_ref text NOT NULL, activation_hash char(64) NOT NULL, predecessor_head_ref text, predecessor_head_hash char(64), canonical_body text NOT NULL, created_at timestamptz NOT NULL DEFAULT transaction_timestamp())`. Singleton `internal_production_owner_producer_manifest_set_current_v1` is `(singleton_key boolean NOT NULL DEFAULT TRUE, current_revision bigint NOT NULL DEFAULT 0, phase text, activation_ref text, activation_hash char(64), head_ref text, head_hash char(64), updated_at timestamptz NOT NULL DEFAULT transaction_timestamp())`. The head name is exactly 63 bytes; the rejected 67-byte variant that retains `_set_` before `activation_heads` must never appear in SQL or projector metadata.

All three immutable `canonical_body` values are canonical JSON **TEXT**, never `jsonb`. The database casts only to assert an object and bounds the stored text bytes; every INSERT/adopt/resolver reparses the text with the strict application schema, requires the stored TEXT to equal the exact canonical bytes supplied to `hashCanonicalJson(parsedBody)`, and requires the recomputed body hash/ref to match. Whitespace, key-order, numeric-rendering, duplicate-key, or other byte drift fails; no JSONB rendering or database round-trip may define the projection.

The literal source constraint/index names are `ip_op_sba_v1_pkey`, `ip_op_sba_v1_hash_uq`, `ip_op_sba_v1_pair_uq`, `ip_op_sba_v1_plan_ck`, `ip_op_sba_v1_ref_ck`, `ip_op_sba_v1_hash_ck`, `ip_op_sba_v1_body_ck`, and `ip_op_sba_v1_plan_manifest_idx`. Their exact CHECK expressions are `plan IN ('A','B','C','D','E')`, `octet_length(source_build_authority_ref) BETWEEN 1 AND 512`, `source_build_authority_hash ~ '^[0-9a-f]{64}$' AND manifest_hash ~ '^[0-9a-f]{64}$' AND owner_category_registry_hash ~ '^[0-9a-f]{64}$' AND owner_category_census_map_hash ~ '^[0-9a-f]{64}$'`, and `jsonb_typeof(canonical_body::jsonb) = 'object' AND octet_length(canonical_body) BETWEEN 2 AND 65536`. PK is the ref, unique keys are hash and ref/hash, and the sole additional index is `USING btree (plan,manifest_hash)`.

The activation names are `ip_op_msa_v1_pkey`, `ip_op_msa_v1_hash_uq`, `ip_op_msa_v1_pair_uq`, `ip_op_msa_v1_phase_ck`, `ip_op_msa_v1_refs_ck`, `ip_op_msa_v1_hashes_ck`, `ip_op_msa_v1_body_ck`, `ip_op_msa_v1_pred_activation_pair_ck`, `ip_op_msa_v1_pred_head_pair_ck`, `ip_op_msa_v1_phase_pred_ck`, `ip_op_msa_v1_pred_activation_fk`, `ip_op_msa_v1_pred_head_fk`, `ip_op_msa_v1_phase_manifest_idx`, `ip_op_msa_v1_pred_activation_idx`, and `ip_op_msa_v1_pred_head_idx`. Exact CHECKs are `phase IN ('A','A+B','A+B+C','A+B+C+D','A+B+C+D+E')`; `octet_length(activation_ref) BETWEEN 1 AND 512 AND (predecessor_activation_ref IS NULL OR octet_length(predecessor_activation_ref) BETWEEN 1 AND 512) AND (predecessor_head_ref IS NULL OR octet_length(predecessor_head_ref) BETWEEN 1 AND 512)`; `activation_hash ~ '^[0-9a-f]{64}$' AND manifest_set_hash ~ '^[0-9a-f]{64}$' AND owner_category_registry_hash ~ '^[0-9a-f]{64}$' AND owner_category_census_map_hash ~ '^[0-9a-f]{64}$' AND (predecessor_activation_hash IS NULL OR predecessor_activation_hash ~ '^[0-9a-f]{64}$') AND (predecessor_head_hash IS NULL OR predecessor_head_hash ~ '^[0-9a-f]{64}$')`; `(predecessor_activation_ref IS NULL) = (predecessor_activation_hash IS NULL)`; `(predecessor_head_ref IS NULL) = (predecessor_head_hash IS NULL)`; `(phase = 'A') = (predecessor_activation_ref IS NULL AND predecessor_activation_hash IS NULL AND predecessor_head_ref IS NULL AND predecessor_head_hash IS NULL)`; and `jsonb_typeof(canonical_body::jsonb) = 'object' AND octet_length(canonical_body) BETWEEN 2 AND 65536`. Its two predecessor FKs are `MATCH SIMPLE ON UPDATE RESTRICT ON DELETE RESTRICT NOT DEFERRABLE`; its additional indexes are exactly `USING btree (phase,manifest_set_hash)`, `USING btree (predecessor_activation_ref,predecessor_activation_hash) WHERE predecessor_activation_ref IS NOT NULL`, and `USING btree (predecessor_head_ref,predecessor_head_hash) WHERE predecessor_head_ref IS NOT NULL`.

The head names are `ip_op_mah_v1_pkey`, `ip_op_mah_v1_hash_uq`, `ip_op_mah_v1_pair_uq`, `ip_op_mah_v1_activation_pair_uq`, `ip_op_mah_v1_phase_ck`, `ip_op_mah_v1_refs_ck`, `ip_op_mah_v1_hashes_ck`, `ip_op_mah_v1_body_ck`, `ip_op_mah_v1_pred_pair_ck`, `ip_op_mah_v1_phase_pred_ck`, `ip_op_mah_v1_activation_fk`, `ip_op_mah_v1_pred_head_fk`, `ip_op_mah_v1_phase_activation_idx`, and `ip_op_mah_v1_pred_head_idx`. Exact CHECKs are the same literal phase list; `octet_length(head_ref) BETWEEN 1 AND 512 AND octet_length(activation_ref) BETWEEN 1 AND 512 AND (predecessor_head_ref IS NULL OR octet_length(predecessor_head_ref) BETWEEN 1 AND 512)`; `head_hash ~ '^[0-9a-f]{64}$' AND activation_hash ~ '^[0-9a-f]{64}$' AND (predecessor_head_hash IS NULL OR predecessor_head_hash ~ '^[0-9a-f]{64}$')`; `(predecessor_head_ref IS NULL) = (predecessor_head_hash IS NULL)`; `(phase = 'A') = (predecessor_head_ref IS NULL AND predecessor_head_hash IS NULL)`; and `jsonb_typeof(canonical_body::jsonb) = 'object' AND octet_length(canonical_body) BETWEEN 2 AND 65536`. Its activation and self-predecessor FKs use `MATCH SIMPLE ON UPDATE RESTRICT ON DELETE RESTRICT NOT DEFERRABLE`; its additional indexes are exactly `USING btree (phase,activation_ref,activation_hash)` and `USING btree (predecessor_head_ref,predecessor_head_hash) WHERE predecessor_head_ref IS NOT NULL`. The unique activation quartet is `(head_ref,head_hash,activation_ref,activation_hash)`.

The current names are `ip_op_msc_v1_pkey`, `ip_op_msc_v1_singleton_ck`, `ip_op_msc_v1_revision_ck`, `ip_op_msc_v1_phase_ck`, `ip_op_msc_v1_shape_ck`, `ip_op_msc_v1_refs_ck`, `ip_op_msc_v1_hashes_ck`, `ip_op_msc_v1_activation_fk`, and `ip_op_msc_v1_head_activation_fk`. Exact CHECKs are `singleton_key IS TRUE`, `current_revision >= 0`, `phase IS NULL OR phase IN ('A','A+B','A+B+C','A+B+C+D','A+B+C+D+E')`, `(current_revision = 0 AND phase IS NULL AND activation_ref IS NULL AND activation_hash IS NULL AND head_ref IS NULL AND head_hash IS NULL) OR (current_revision > 0 AND phase IS NOT NULL AND activation_ref IS NOT NULL AND activation_hash IS NOT NULL AND head_ref IS NOT NULL AND head_hash IS NOT NULL)`, `(activation_ref IS NULL OR octet_length(activation_ref) BETWEEN 1 AND 512) AND (head_ref IS NULL OR octet_length(head_ref) BETWEEN 1 AND 512)`, and `(activation_hash IS NULL OR activation_hash ~ '^[0-9a-f]{64}$') AND (head_hash IS NULL OR head_hash ~ '^[0-9a-f]{64}$')`. Both FKs use `MATCH SIMPLE ON UPDATE RESTRICT ON DELETE RESTRICT NOT DEFERRABLE`; current has no additional index. Migration seeds exactly `(TRUE,0,NULL,NULL,NULL,NULL,NULL,transaction_timestamp())`.

The ordered DDL is: create exact function `ip_op_reject_immutable_v1()`; create source then its additional index; create activation without its head FK then its indexes; create the 63-byte-named head then its indexes; add activation's head FK; create current; seed current; create exact function `ip_op_enforce_current_update_v1()`; then create triggers `ip_op_sba_v1_immutable_trg`, `ip_op_msa_v1_immutable_trg`, `ip_op_mah_v1_immutable_trg`, `ip_op_msc_v1_delete_truncate_trg`, and `ip_op_msc_v1_update_trg` in that order. The first three are statement-level `BEFORE UPDATE OR DELETE OR TRUNCATE`; current delete/truncate is statement-level; current update is row-level `BEFORE UPDATE`. The update function rejects key change or anything except `NEW.current_revision = OLD.current_revision + 1`; sets `NEW.updated_at = transaction_timestamp()`; permits only all-null revision zero to phase A or one literal immediate phase successor; locks/reopens the immutable target activation/head rows; requires their exact phase and mutual pair; and requires their predecessor activation/head pairs to equal OLD current, with all predecessor pairs null only for the seed-to-A transition. It rejects arbitrary/no-op/skipped/current-row UPDATE independently of the activator's old-revision-and-pair CAS.

The function and trigger statements are byte-frozen as the following PostgreSQL-valid SQL; no omitted default clause or alternate error text is equivalent:

```sql
CREATE FUNCTION public.ip_op_reject_immutable_v1()
RETURNS trigger
LANGUAGE plpgsql
VOLATILE
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $function$
BEGIN
  RAISE EXCEPTION USING
    ERRCODE = '55000',
    MESSAGE = 'IP_OWNER_PRODUCER_IMMUTABLE_MUTATION';
  RETURN NULL;
END;
$function$;

CREATE FUNCTION public.ip_op_enforce_current_update_v1()
RETURNS trigger
LANGUAGE plpgsql
VOLATILE
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  target_activation public.internal_production_owner_producer_manifest_set_activations_v1%ROWTYPE;
  target_head public.internal_production_owner_producer_manifest_activation_heads_v1%ROWTYPE;
BEGIN
  IF NEW.singleton_key IS DISTINCT FROM OLD.singleton_key
     OR NEW.singleton_key IS DISTINCT FROM TRUE
     OR NEW.current_revision IS DISTINCT FROM OLD.current_revision + 1 THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'IP_OWNER_PRODUCER_CURRENT_TRANSITION_INVALID';
  END IF;

  IF NOT (
    (OLD.current_revision = 0 AND OLD.phase IS NULL AND NEW.phase = 'A')
    OR (OLD.phase = 'A' AND NEW.phase = 'A+B')
    OR (OLD.phase = 'A+B' AND NEW.phase = 'A+B+C')
    OR (OLD.phase = 'A+B+C' AND NEW.phase = 'A+B+C+D')
    OR (OLD.phase = 'A+B+C+D' AND NEW.phase = 'A+B+C+D+E')
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'IP_OWNER_PRODUCER_CURRENT_TRANSITION_INVALID';
  END IF;

  SELECT * INTO STRICT target_activation
    FROM public.internal_production_owner_producer_manifest_set_activations_v1
   WHERE activation_ref = NEW.activation_ref
     AND activation_hash = NEW.activation_hash
   FOR KEY SHARE;
  SELECT * INTO STRICT target_head
    FROM public.internal_production_owner_producer_manifest_activation_heads_v1
   WHERE head_ref = NEW.head_ref
     AND head_hash = NEW.head_hash
   FOR KEY SHARE;

  IF target_activation.phase IS DISTINCT FROM NEW.phase
     OR target_head.phase IS DISTINCT FROM NEW.phase
     OR target_head.activation_ref IS DISTINCT FROM NEW.activation_ref
     OR target_head.activation_hash IS DISTINCT FROM NEW.activation_hash THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'IP_OWNER_PRODUCER_CURRENT_TRANSITION_INVALID';
  END IF;

  IF OLD.current_revision = 0 THEN
    IF target_activation.predecessor_activation_ref IS NOT NULL
       OR target_activation.predecessor_activation_hash IS NOT NULL
       OR target_activation.predecessor_head_ref IS NOT NULL
       OR target_activation.predecessor_head_hash IS NOT NULL
       OR target_head.predecessor_head_ref IS NOT NULL
       OR target_head.predecessor_head_hash IS NOT NULL THEN
      RAISE EXCEPTION USING
        ERRCODE = '23514',
        MESSAGE = 'IP_OWNER_PRODUCER_CURRENT_TRANSITION_INVALID';
    END IF;
  ELSIF target_activation.predecessor_activation_ref IS DISTINCT FROM OLD.activation_ref
     OR target_activation.predecessor_activation_hash IS DISTINCT FROM OLD.activation_hash
     OR target_activation.predecessor_head_ref IS DISTINCT FROM OLD.head_ref
     OR target_activation.predecessor_head_hash IS DISTINCT FROM OLD.head_hash
     OR target_head.predecessor_head_ref IS DISTINCT FROM OLD.head_ref
     OR target_head.predecessor_head_hash IS DISTINCT FROM OLD.head_hash THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'IP_OWNER_PRODUCER_CURRENT_TRANSITION_INVALID';
  END IF;

  NEW.updated_at := transaction_timestamp();
  RETURN NEW;
EXCEPTION
  WHEN NO_DATA_FOUND THEN
    RAISE EXCEPTION USING
      ERRCODE = '23503',
      MESSAGE = 'IP_OWNER_PRODUCER_CURRENT_TARGET_MISSING';
  WHEN TOO_MANY_ROWS THEN
    RAISE EXCEPTION USING
      ERRCODE = '21000',
      MESSAGE = 'IP_OWNER_PRODUCER_CURRENT_TARGET_NONUNIQUE';
END;
$function$;

CREATE TRIGGER ip_op_sba_v1_immutable_trg
BEFORE UPDATE OR DELETE OR TRUNCATE ON public.internal_production_owner_producer_source_build_authorities_v1
FOR EACH STATEMENT EXECUTE FUNCTION public.ip_op_reject_immutable_v1();
CREATE TRIGGER ip_op_msa_v1_immutable_trg
BEFORE UPDATE OR DELETE OR TRUNCATE ON public.internal_production_owner_producer_manifest_set_activations_v1
FOR EACH STATEMENT EXECUTE FUNCTION public.ip_op_reject_immutable_v1();
CREATE TRIGGER ip_op_mah_v1_immutable_trg
BEFORE UPDATE OR DELETE OR TRUNCATE ON public.internal_production_owner_producer_manifest_activation_heads_v1
FOR EACH STATEMENT EXECUTE FUNCTION public.ip_op_reject_immutable_v1();
CREATE TRIGGER ip_op_msc_v1_delete_truncate_trg
BEFORE DELETE OR TRUNCATE ON public.internal_production_owner_producer_manifest_set_current_v1
FOR EACH STATEMENT EXECUTE FUNCTION public.ip_op_reject_immutable_v1();
CREATE TRIGGER ip_op_msc_v1_update_trg
BEFORE UPDATE ON public.internal_production_owner_producer_manifest_set_current_v1
FOR EACH ROW EXECUTE FUNCTION public.ip_op_enforce_current_update_v1();
```

There are no other activation-family tables, views, materialized views, sequences, functions, triggers, indexes, policies, RLS enablement, ownership changes, or relation-specific ACL changes. The schema projector hashes and verifies every literal ordered column/type/null/default, exact constraint/index/FK definition and name, `MATCH SIMPLE`/actions/deferrability, RLS/no-policy state, and the sole seed row. It never compares `pg_get_functiondef` or `pg_get_triggerdef` output to input `CREATE` text. The migration module separately freezes `EXPECTED_IP_OP_FUNCTION_CATALOG_DEFS_V1` and `EXPECTED_IP_OP_TRIGGER_CATALOG_DEFS_V1`: exact normalized catalog-rendered definitions captured from installing the literal statements, including PostgreSQL's `CREATE OR REPLACE FUNCTION` and configuration-clause canonicalization. The projector compares normalized actual catalog rendering only to those expected catalog-rendered constants.

For each function it also projects exact `pg_proc`/language facts: namespace `public`; exact `proname`; `prokind='f'`; `pronargs=0`; empty `proargtypes`; `proallargtypes IS NULL`; `proargmodes IS NULL`; `proargnames IS NULL`; `pronargdefaults=0`; `provariadic=0`; `prorettype=pg_catalog.trigger`; language `plpgsql`; `provolatile='v'`; `prosecdef=false`; `proconfig=ARRAY['search_path=pg_catalog, public']`; and `proacl IS NULL`. The dependency query is exactly constrained by `d.classid = 'pg_proc'::regclass AND d.objid = function_oid AND d.objsubid = 0`, then identifies each referenced object by joining on `d.refclassid`/`d.refobjid`. It must return exactly two rows per function, both `deptype='n'` and `refobjsubid=0`: one `{refclassid:'pg_language'::regclass,referenced:'plpgsql'}` and one `{refclassid:'pg_namespace'::regclass,referenced:'public'}`. Any third row, missing row, extension/pinned dependency, trigger-return-type dependency, or body-relation dependency is invalid. Body relation names are authenticated only by the source digest and expected catalog-rendered function definition, never by invented `pg_depend` rows.

Trigger projections are exact: name, owning `tgrelid`, expected function `tgfoid`, `tgenabled='O'`, `tgisinternal=false`, `tgparentid=0`, `tgconstraint=0`, `tgdeferrable=false`, `tginitdeferred=false`, empty `tgattr`, `tgnargs=0`, zero-length `tgargs`, `tgqual IS NULL`, and null old/new transition-table names. The three immutable triggers have `tgtype=58` (statement, before, update/delete/truncate); current delete/truncate has `tgtype=42`; current update has `tgtype=19` (row, before, update). No other trigger row targets these relations. An isolated migrated-PostgreSQL catalog regression freezes the exact two-row dependency set for both functions; adding, removing, or reclassifying any dependency fails.

Migration source-integrity/digest tests bind the byte-frozen input statement and token regions plus the separate expected-catalog-rendering constant regions. Projector tests install the literal statements, then prove catalog rendering, `pg_proc`, `pg_language`, `pg_trigger`, ACL, and dependency projections exactly; this separates source-text authority from installed-semantic authority. Its internal `existingRelations` tuple changes from exact four to exact eight: `internal_production_bootstrap_main_claim_handoff_operations_v1`, `internal_production_owner_reservations_v1`, `internal_production_owner_admission_authorities_v1`, `internal_production_owner_admission_head_v1`, `internal_production_owner_producer_source_build_authorities_v1`, `internal_production_owner_producer_manifest_set_activations_v1`, `internal_production_owner_producer_manifest_activation_heads_v1`, and `internal_production_owner_producer_manifest_set_current_v1`, in that order. The externally returned `BootstrapMainClaimHandoffV1SchemaProjection` remains its exact byte-identical nine-member object, and `hashCanonicalJson(expectedProjection)` remains byte-identical. Activation metadata is only a prerequisite for projector success; no public activation projection field or activation hash is added. Migration 32 is still pending and not applied to the live database during Task 0.

The activation sub-File-Map is rebaselined from eleven to exactly thirteen existing members of `TASK_0_EXACT_SOURCE_PATHS_V1`; this causal dependency correction adds no path to the complete tuple and leaves all 109 path strings and their byte order unchanged. Its nine generic paths are `src/db/bootstrap-main-claim-handoff-v1-migration.ts`, `src/db/contract-spine-migration-digests.generated.ts`, `src/db/contract-spine-migration-source-integrity.ts`, `src/db-pg.ts`, `src/internal-production/owner-admission-v1.ts`, `tests/execution-attempts/migration-source-digests.test.ts`, `tests/execution-attempts/migrations.test.ts`, `tests/execution-attempts/test-database.ts`, and `tests/internal-production/owner-admission-v1.test.ts`. Its two A-wrapper paths are `src/internal-production/baseline-owner-producer-manifest-activation-controller-v1.ts` and `tests/internal-production/baseline-owner-producer-manifest-activation-controller-v1.test.ts`. Its two read-only current-entry operation dependency paths are the already listed `src/internal-production/baseline-post-handoff-receipt-v1.ts` and `tests/internal-production/baseline-post-handoff-receipt-v1.test.ts`. OA17 plus its direct-caller regression correction still historically reached 107 paths, and OA18 still adds only its two ledger/retention paths to make 109. No fourteenth activation path, second filesystem current locator, or new activation generated artifact is permitted.

The A source-build authority is strict and content-addressed, with creation and historical resolution deliberately separate. There is no exported complete caller-body constructor or factory. `owner-admission-v1.ts` may export the stable PairV1/type surface and strict pure parsers/projections, but it recursively validates the complete embedded PBA delivery observation with semantics equivalent to the owning PBA parser: every closed nested key set, canonical bound, response/evidence pair/hash relation, ordered path and vendor-artifact tuple, focused-test receipt, vendor-lock identity, and producer commit must validate. It may implement that pure validation in the owner core to preserve the one-way import boundary; it must not replace the complete check with a shallow envelope check or add a reverse runtime import.

The controller and database layer each own a fixed private non-exported new-A candidate creator. Each creator is zero-input and obtains the immutable operation only through `observePreparedInternalProductionCurrentEntryOperationV1()`, never through a direct path, `lstat`, caller pair/body, or `prepareInternalProductionCurrentEntryOperationV1()`. Only after the controller has proven committed PostgreSQL current is the exact seeded null may creation freshly observe current PBA and clean synchronized Setfarm `{branch:"main",clean:true,sha,treeHash,buildHash,originMainSha}`; require `setfarmSource.sha === setfarmSource.originMainSha`; require controller SHA/tree/build equality with Setfarm; read vendor commit only from `pba.response.evidence.vendorLock.producerCommit`; prove that commit is an ancestor of Setfarm SHA without equating them; and return the exact bounded canonical candidate that the activation transaction may persist. The database's independent private creator repeats the same code-owned observations and exact derivation before accepting the controller-supplied pair. Vendor artifacts/authentication remain bound to that embedded PBA observation. The body stores the exact PBA pair and bounded canonical `productBuildAuthorityV2Observation`, immutable operation pair, Setfarm source/tree/build/Git objects, and exact `vendorProducerCommitAncestorProof`; its object is 2–65536 canonical octets and every nested collection/string obeys its owning strict response bound.

The historical pair resolver accepts only the stable A PairV1 and never calls the zero-input operation observer or any current observer. It reopens the immutable PostgreSQL row, recomputes its canonical body/hash/ref, recursively authenticates its complete embedded/bound PBA observation through the strict owner-core equivalent, pair-resolves the stored immutable operation, verifies the named Git objects still exist, and replays the stored ancestor proof. It never requires current Setfarm or Mission Control HEAD/tree/build/PBA equality. Therefore an A source row and cumulative activation remain resolvable after either main advances. The caller supplies no source body, root, Git identity, PBA body, vendor commit, registry, census, or resolver. `sourceBuildAuthorityHash` is `hashCanonicalJson({schema,plan,manifestHash,currentEntryOperationRef,currentEntryOperationHash,setfarmSource,productBuildAuthorityV2DeliveryEvidenceRef,productBuildAuthorityV2DeliveryEvidenceHash,productBuildAuthorityV2Observation,vendorProducerCommit,vendorProducerCommitAncestorProof,ownerCategoryRegistryHash,ownerCategoryCensusMapHash})`; its ref is exactly `setfarm://internal-production/owner-producer-source-build-authority/A/sha256/${sourceBuildAuthorityHash}`.

All activation hashes are schema-domain-separated. `ownerCategoryRegistryHash` is `hashCanonicalJson({schema:"setfarm.internal-production-owner-category-registry.v1",categories:INTERNAL_PRODUCTION_OWNER_CATEGORY_REGISTRY_V1})`. `ownerCategoryCensusMapHash` is `hashCanonicalJson({schema:"setfarm.internal-production-owner-category-census-map.v1",entries:INTERNAL_PRODUCTION_OWNER_CATEGORY_REGISTRY_V1.map(category => ({category,censusKeys:INTERNAL_PRODUCTION_OWNER_CATEGORY_CENSUS_MAP_V1[category]}))})`: `entries` is that exact ordered array of `{category,censusKeys}`, each `censusKeys` array preserves its declared order, and no object/map representation is hashed. `manifestSetHash` is `hashCanonicalJson({schema:"setfarm.internal-production-owner-producer-manifest-set.v1",phase,orderedPlans,orderedManifestHashes,orderedSourceBuildAuthorities,ownerCategoryRegistryHash,ownerCategoryCensusMapHash})`. `activationHash` hashes the complete activation receipt excluding only `activationRef`/`activationHash`; its ref is `setfarm://internal-production/owner-producer-manifest-set-activation/sha256/${activationHash}`. `headHash` hashes exactly `{schema,phase,activationRef,activationHash,predecessorHeadRef,predecessorHeadHash}`; its ref is `setfarm://internal-production/owner-producer-manifest-set-activation-head/sha256/${headHash}`. The mutable singleton current row has deliberately no authority ref/hash: only `currentRevision` plus exact activation/head pairs identify its CAS state, and consumers must reopen those immutable pairs. A ref/hash mismatch, crossed source pair, structural body, registry/census reorder, or hash projection containing its own derived pair is invalid.

`activateInternalProductionOwnerProducerManifestSetV1(...)` retains its exact public input, return type, and stable PairV1 envelope `{plan:"A"|"B"|"C"|"D"|"E",sourceBuildAuthorityRef,sourceBuildAuthorityHash}`. It still requires exact `orderedSourceBuildAuthorities` pairs alongside manifests and expected predecessor; store, receipt, resolver, and activator V1 signatures do not widen. After its existing exact input validation, its only operational error categories remain `SUPERSEDED | CORRUPTION`, with exact messages `INTERNAL_PRODUCTION_OWNER_PRODUCER_ACTIVATION_SUPERSEDED` and `INTERNAL_PRODUCTION_OWNER_PRODUCER_ACTIVATION_CORRUPTION`. Each exported failure is an ordinary `Error` with `Object.getPrototypeOf(error) === Error.prototype` and no nonstandard own string/symbol property, custom prototype, `cause`, tag, boolean, token, or other side channel; in particular no `privateCandidateDrift` property exists. The public generic activator never exposes or maps any case to `CURRENT_SOURCE_DRIFT`. Task 0's strict body union and private delivered-phase/body-resolver registry contain only A. Before B, C, D, or E may register its phase, that delivery must define and version its actual strict body variant with source SHA/tree/build and delivery evidence, widen only the body union/registry, add its fixed new-versus-historical resolver, and then register the phase. Empty/common-base-only bodies are forbidden; PairV1 and public function signatures do not widen.

`src/db-pg.ts` additionally exports exactly `activateInternalProductionBaselineOwnerProducerManifestAFromControllerV1(input: Readonly<{sourceBuildAuthority: InternalProductionOwnerProducerSourceBuildAuthorityPairV1}>): Promise<InternalProductionOwnerProducerManifestSetActivationPairV1>`. The exact runtime input has only `sourceBuildAuthority`; it strict-parses that pair, requires `plan:"A"`, and accepts no body, manifest, predecessor, root, store, SQL, resolver, observer, callback, or extra key. The zero-input `baseline-owner-producer-manifest-activation-controller-v1.ts` is its sole production importer/caller; no CLI, owner-core export, store-interface method, later-phase module, or other production path may call it. The port invokes the same non-exported generic activation core used by the public generic wrapper, supplying only fixed `expectedPredecessor:null`, literal `[INTERNAL_PRODUCTION_OWNER_PRODUCER_MANIFEST_A_V1]`, and `[sourceBuildAuthority]`; there is no duplicated transaction algorithm.

The shared core uses one module-private, locally created `Symbol` identity solely when a valid controller-supplied A pair differs from the independently derived database new-A candidate. The symbol is not exported, registered globally, stringified, attached to an error/result, placed in `cause`, returned, or observable through module exports, `Reflect.ownKeys`, prototype inspection, logging, or a callback. Both exported wrappers catch it inside `src/db-pg.ts` after transaction rollback: the controller-specific port maps only exact identity equality with that sentinel to an ordinary finite `CURRENT_SOURCE_DRIFT` error, while the public generic wrapper maps the same internal condition to its existing ordinary `CORRUPTION` error. Wrong-plan, malformed/crossed pair, generic source/target collision, SQL failure, and every non-sentinel exception remain `CORRUPTION`; no message/property duck typing may classify drift. The sentinel and controller-only port change no committed-row status behavior and create no durable failure/status state.

The one-transaction algorithm order is exact. First validate manifest and pair shapes/order/counts. Second resolve every source through the fixed plan resolver before deriving, hashing, selecting, or classifying any target: an existing pair uses historical resolution, while an absent A pair may match only the zero-input independently derived new-A candidate; future phases must follow the same split. Third, and only after every source resolution succeeds, derive all target canonical bodies/pairs. Fourth lock and fully resolve singleton current `FOR UPDATE`. Current resolution performs one bounded cross-bound recursive walk of activation and head together, using one visited set and one phase/depth bound: each phase's activation, head, source authorities, predecessor activation pair, and predecessor head pair is read and cross-checked once on the same `PgTransactionSql`. It must not recursively resolve the activation chain and then separately recurse or re-resolve the head chain. Then inspect only target activation and head. If both exist byte-identically and current names that exact target, reopen/equality-check the complete target and adopt. If both exist byte-identically and the fully resolved strict current is a descendant whose authenticated predecessor chain contains the exact target pair, throw typed `INTERNAL_PRODUCTION_OWNER_PRODUCER_ACTIVATION_SUPERSEDED` with no mutation. If exactly one target record exists, either target mismatches, or exact targets coexist with an unrelated/broken current or chain, raise corruption. If both target records are absent, continue. Shared or prior-phase source-row presence is never classified as a partial target.

On the both-targets-absent branch, independently INSERT each resolved source candidate when absent or adopt it only when byte-identical, so prior-phase source rows are normal. Next validate/pair-resolve the locked expected predecessor; insert activation then head; and perform the old-revision-and-pair current CAS, whose database trigger independently enforces the immediate successor. It returns nothing outside the callback before commit acknowledgement. Rollback exposes no partial authority/current move; lost response adopts the exact activation/head/current target even when the original expected predecessor is now stale. Two identical initial calls converge; conflicting initial calls or concurrent appenders from one predecessor permit one winner. Collision handling is finite and typed: a source ref/hash/unique-key collision or non-byte-identical source row, a one-sided/duplicate/mismatched target, or an unrelated/broken current/chain maps only to `CORRUPTION`; an exact authenticated descendant maps only to `SUPERSEDED`; and a current-CAS loss must reopen and either adopt the exact committed target, classify its exact descendant as `SUPERSEDED`, or return `CORRUPTION`. Raw SQLSTATE, constraint names, driver text, and arbitrary exception messages never become the public activation/status result. Filesystem read-then-rename, process-local locks, advisory locks, latest-row scans, caller repositories/resolvers, and structural predecessor bodies are forbidden.

The pair resolvers reopen only their exact PostgreSQL ref/hash rows and recompute canonical bodies. Source pair resolution is historical and current-independent; only new source creation performs fresh current observation. Store, public, and transaction-pinned current resolvers all return `InternalProductionOwnerProducerManifestSetActivationCurrentV1 | null`. The exact seeded row `(currentRevision=0,phase=null,activation pair=null,head pair=null)` returns `null`; any other all-null revision, half-null tuple, missing or duplicate singleton row, nonzero row-count anomaly, or invalid current row throws typed corruption and never returns empty. `resolveCurrentInternalProductionOwnerProducerManifestSetActivationInTransactionV1(sql)` locks the singleton row and reopens the named source authorities, activation, head, and complete predecessor chain on that same `PgTransactionSql`; owner admission and complete-zero census call this transaction-pinned resolver before checking implementation IDs. The public zero-input current resolver owns a read-only transaction and returns only after commit. It never opens a filesystem locator and never performs a second unpinned current read. Unknown plan authority, unavailable future phase, half-null current, broken chain, tampered canonical JSON, invalid embedded historical evidence, or noncurrent pair makes activation and owner admission unavailable rather than empty.

`baseline-owner-producer-manifest-activation-controller-v1.ts` remains a separate A-only zero-input wrapper. Module evaluation is import-inert: it statically imports only pure values/types that cannot open a runtime boundary, dynamically loads its receipt, source/PBA/Git, and PostgreSQL production ports inside the relevant async operation, and performs no module-scope observation, controller construction, database connection, or `void` execution. Its activation method first dynamically loads only the PostgreSQL current resolver and resolves committed current before loading or invoking the prepared-operation observer, source/PBA/Git observers, or either private new-A creator. An exact committed A current is fully pair-resolved and adopted as the byte-identical receipt without any fresh observer call. A fully resolved later/non-A current throws finite `SUPERSEDED` without a fresh observer; an invalid current throws finite `CORRUPTION`. Only the exact seeded-null current may dynamically load `observePreparedInternalProductionCurrentEntryOperationV1()`, derive the strict private A source candidate, and call `activateInternalProductionBaselineOwnerProducerManifestAFromControllerV1({sourceBuildAuthority:{plan:"A",sourceBuildAuthorityRef:source.sourceBuildAuthorityRef,sourceBuildAuthorityHash:source.sourceBuildAuthorityHash}})`. It never imports or calls `activateInternalProductionOwnerProducerManifestSetV1(...)`, never supplies the A manifest/predecessor itself, and never inspects an error property, prototype, symbol, or other sentinel side channel. A null prepared operation makes `activateInternalProductionBaselineOwnerProducerManifestV1()` throw finite `CURRENT_ENTRY_UNAVAILABLE`; only the controller's own fresh observation mismatch or the controller-specific database port's ordinary `CURRENT_SOURCE_DRIFT` error makes that activation call throw finite `CURRENT_SOURCE_DRIFT`. Those two activation-call-only failures create no activation, head, source, current, status, or failure row and persist no status body; while committed current remains the seeded null, a later read-only status call returns `absent`. The controller accepts no manifest/plan/phase/pair/body/root/store/SQL/resolver/observer input and never calls `prepareInternalProductionCurrentEntryOperationV1()`.

A response-loss retry repeats the committed-current-first decision and adopts only the identical A activation; it does not freshly rebuild A before adoption. `observeInternalProductionBaselineOwnerProducerManifestActivationStatusV1()` dynamically loads only the committed PostgreSQL current/pair resolvers, never calls activation, the prepared-operation accessor, current-entry prepare, source/PBA/Git observers, either new-A creator, or an activation-failure store, and derives no field from an uncommitted candidate or prior thrown call. Its committed-database-only mapping is total and exact: the unique seeded revision-zero/all-null current returns `absent`; the fully resolved exact committed A current returns `active`; a fully resolved later/non-A committed current returns `blocked` with `blockedReason:"SUPERSEDED"`; and a corrupt or unresolvable committed current returns `blocked` with `blockedReason:"CORRUPTION"`. Its sole canonical common key set and union are the declared `absent | active | blocked` ABI above: `absent` has every predecessor/successor/receipt/manifest/source field null and `blockedReason:null`; `active` has predecessor quartet null, exact committed successor activation/head, receipt, manifest and source-build pairs non-null, and `blockedReason:null`; `blocked` has every authority field null and exactly one `SUPERSEDED | CORRUPTION`. The status parser, wire body, hash projection, and status fixtures reject every blocked reason outside those exact two. All three states have the canonical status pair. There is no externally observable `activating` state, filesystem operation/receipt/head/status locator, partial activation pair, durable activation-failure/status row, raw database error, or second status shape.

The three activation dependency suites use test-first RED/GREEN coverage. The receipt suite proves exact prepared-operation absence for both wholly absent and valid-sibling stores, strict bounded family inventory/physical validation, every temporary/foreign/type/link/mode/device/size/collision/identity/byte drift refusal, exact pair-resolved frozen-body equality, import inertness, and zero writer/recovery/current-observer/PBA/DB calls. The owner-core suite proves recursive complete PBA validation against the owning parser's positive and exhaustive nested tamper corpus, stable PairV1/public signatures, no exported complete caller-body factory, and no reverse runtime import. The controller/database suite proves dynamic production-port loads and import inertness; source-boundary enumeration naming the zero-input controller as the sole production importer/caller of `activateInternalProductionBaselineOwnerProducerManifestAFromControllerV1`; controller refusal to import/call the public generic activator; exact one-key A-pair input and rejection of extra/body/root/store/SQL/resolver/observer/wrong-plan/crossed inputs; delegation to the single shared private core with fixed null predecessor and literal A manifest; committed exact-A adoption before every fresh observer; later-current supersession; seeded-null-only new-A candidate creation; exact thrown `CURRENT_ENTRY_UNAVAILABLE` and `CURRENT_SOURCE_DRIFT` activation-call failures with byte-identical source/activation/head/current tables, no failure/status row, and a subsequent seeded-null status of `absent`; a valid self-consistent controller/database candidate mismatch that maps to drift only through module-private sentinel identity; every malformed pair, non-sentinel failure, and generic collision mapping to `CORRUPTION`; the same candidate mismatch through public `activateInternalProductionOwnerProducerManifestSetV1(...)` remaining `CORRUPTION`; unchanged generic input/return types and exact two operational errors; `Object.getPrototypeOf(error) === Error.prototype`, no `cause`, no nonstandard `Reflect.ownKeys`, no custom prototype/symbol/tag/boolean, no exported/global sentinel, and no `privateCandidateDrift` property on either exported boundary; committed-row-only status mapping for seeded-null `absent`, exact committed A `active`, later committed current `blocked/SUPERSEDED`, and corrupt committed current `blocked/CORRUPTION`; strict status parser/wire/hash rejection of every reason outside the exact two-member blocked domain; every exact status union/nullability/hash shape; source resolution before any target derivation/query; one cross-bound activation-plus-head recursive walk with one read per phase; exact four-relation DDL/projector/digest and internal `existingRelations` four-to-eight projection; literal identifier length/name and PostgreSQL truncation refusal; every literal CHECK/FK/index/function/trigger definition; arbitrary current UPDATE refusal; canonical TEXT versus JSONB metadata and whitespace/key-order/numeric/duplicate-key drift; absent/duplicate/half-null singleton current and exact all-null-seed `null`; initial A activation; shared/prior source reuse; same-target adoption before predecessor validation; descendant `SUPERSEDED`; every source/target/current collision-to-`CORRUPTION` mapping; identical/conflicting concurrency and two appenders; response loss; rollback after every write and before/after CAS/commit; CAS loss finite reopen; lock blocking/reopen; pinned-current equality; immutable-row mutation refusal; historical A after either main/build advances; exhaustive embedded PBA/operation/Git-object/ancestor/registry/census/activation/head/predecessor/future-phase tamper; and caller resolver/repository/body injection. Every real PostgreSQL matrix file runs exhaustively in its own disposable isolated-runner invocation; pure/source/import tests run only under the exact no-database anchored commands below. Source/transcript fixtures still prove guarded migration, A activation, admission-ready, and first producer ordering.

B, C, D, and E each own and test only their later literal table/manifest and append exactly one phase after their source exists. Before registering its phase, each task must define/version/widen the strict pair/body/compile-time union using its actual source SHA/tree/build and delivery evidence and add distinct new-versus-historical source resolution; no empty future source body exists in Task 0. Only E's final source task imports the five exact manifest exports, invokes `assembleInternalProductionOwnerProducerRegistryV1(...)`, verifies final category coverage and all-row File Map/AST relations, and publishes the aggregate registry hash in the `A+B+C+D+E` activation; no earlier task performs an all-row scan. Every phase test uses PostgreSQL transaction rollback/commit, singleton `FOR UPDATE`, revision-and-pair CAS, exact-pair reopen, and response-loss re-entry. It adopts only a unique byte-identical `{head,receipt}` tuple and rejects same-phase forks, an activation receipt whose predecessor quartet is not the prior current tuple, or a current head whose source/build authority no longer resolves historically. No B–E activation test uses a temporary file, fsync, link, rename, filesystem receipt/head, or filesystem current locator. Compile-time fixtures prove generic `acquireInternalProductionGlobalOwnerAdmissionFenceV1(...)` accepts only the exact migration or cutover purpose with `targetFamily:null` and rejects source-run/restart purposes; the two dedicated acquire seams accept only their discriminated exact inputs. Target-family schema tests assert the seven exact named descriptor fields, categories, implementation IDs, canonical ABI hash, target-family hash, and return members; reject a missing/eighth/renamed field, arbitrary reservation or identity array, caller owner-key hash, mismatched coordinator/active-target discriminant, and any derivation input beyond the immutable authorization-operation pair plus exact authority and namespace/service/coordination tuple. Runtime tests hold the shared owner-admission head at every A reservation/fence CAS boundary and prove either one reservation/owner or one fence wins, never both. Recovery-restart tests publish the immutable operation, outbox, helper, child, replacement process, and startup listener under their already acquired exact target pairs without ordinary begin; then publish the acyclic immutable terminal core and prove the pair-only compound close removes all seven targets in one successor while preserving the fence and exact coordinator/active-target authority. They reject an ordinary begin under the fence, a partial/per-target/generic close, a final-envelope close input, a terminal core containing the future close/release/envelope pair, a core/operation/family mismatch, and release before compound close. Counters prove no durable owner publication precedes reservation, no fence becomes visible with a pending non-target reservation, and no target remains after the compound close.

Helper recovery records every generation as immutable history. If a helper dies after its startup marker but before guard consumption, the coordinator may publish one `setfarm.internal-production-baseline-restart-helper-generation-abandonment.v1` record binding the operation/outbox, abandoned generation/claim/process/startup hashes, a fresh code-owned dead-process observation hash, `guardConsumed:false`, and exact absence hashes for dispatch-issued, launchctl-child, and settlement evidence. Only after reopening that record may an expected-predecessor CAS publish the next helper generation. A concurrent successor loses the CAS and adopts the winner. The old marker is never deleted or rewritten. Guard consumption permanently closes this branch: from then on recovery may only authenticate the same live helper, adopt its completion/failure settlement, or record ambiguity; no abandonment successor, claim takeover, or dispatch is legal.

`baseline-service-restart-helper-v1.ts` is the sole fixed child entry. The controller launches `process.execPath` plus that compiled module path through `execFile`/`shell:false`, with no user arguments and a replacement environment, and passes one unforgeable operation capability through a private inherited descriptor. The helper authenticates that capability against the durable A-only reservation/operation/outbox before claiming it; direct execution, a caller descriptor/body, an inherited ambient variable, a second claim, or any D capability/namespace fails before guard consumption. Its public module surface is empty.

Implement `operational-active-run-status-v1.ts` as the sole runtime producer of the declared tuple, Zod schema, type, and predicate. Register it in `mission-control-contract-artifacts.ts` so the existing generator derives the JSON Schema and compatibility fixture from that module; do not hand-maintain their enum. Update the artifact test from the current ten to twelve exact ordered paths and cross the new fixture through the producer schema. The code-owned zero-owner observer and dashboard import the predicate directly. The contract CLI serializes the same frozen tuple and hashes the canonical object excluding `contractHash`; `package.json` exposes it as `contract:operational-active-run-status`. In `dashboard.ts`, replace exclude-terminal/current-state guesses with the imported predicate for default `/api/runs` selection and the `operationalActive` field. In `index.html`, consume only `operationalActive === true`. Keep historical-run retrieval explicit and preserve the raw status string without reclassifying it. The regression also reads the authoritative census migration and requires its literal set to remain identical to the producer; changing either side without regenerating/reconciling the other fails.

After the producer and failing artifact expectations are implemented, run the existing code-owned writer once: `node --import tsx scripts/mission-control-contract-artifacts.ts --write`. Only the two declared generated files may be new; every pre-existing generated artifact must remain byte-identical.

Use existing Setfarm database/process/worktree observers; do not create a second run classifier or lifecycle controller. `observeCompleteInternalProductionZeroOwnerCensusV1()` is zero-input/read-only and returns the strict path-free `InternalProductionCompleteZeroOwnerCensusObservationV1`: exactly 35 ordered category registry entries, exactly 35 census-map keys, and complete coverage of exactly 36 scalar counters including `executionAttemptCount`. `artifact-publication` alone maps to both `publicationBatchCount` and `artifactPublicationCount`; every other category maps to exactly one scalar, and no scalar is unmapped or multiply owned. The observation also binds the freshly resolved current manifest-set activation ref/hash, active manifest-set hash, category-registry hash, census-map hash, reservation/owner identity-set hashes, and its derived ref/hash. Its no-replace store and pair-only resolver re-hash the strict body, reopen the named current manifest activation, and reject a structural body, latest scan, or crossed pair. Production accepts no injected observer, census, activation, root, store, or row; tests may use a private non-exported fake helper that cannot be imported by D/E. The receipt module owns the fixed backup path, durable attempt/journal, and no-follow/no-replace protocol. Source observers reject an injected root, connection string, command, service label, PID, or receipt body. The `runtime-source` CLI alone accepts exactly two comparison SHA arguments, validates them as Git object hashes, and passes them only as expected identities to the code-owned observer; neither value selects a root/build/process.

A has one disjoint pre-schema spawner mutation owned only by the prepared current-entry controller; every other service mutation uses the normal finite authorization/consume surface. `prepareInternalProductionBaselineServiceRestartV1({service})` is unavailable until migrations 32 and 33 are applied/current, A's manifest is active, complete through-33 verification/normal initialization succeed, and normal admission is ready. Thereafter it accepts only `setfarm-spawner | setfarm-dashboard | mission-control`, internally reopens the current applied migration-32 receipt, exact-verifies current migration 33, and reopens manifest activation, observes a fresh manifest-backed complete-zero-owner census, mints and retains the one-use guard, binds the current runtime-source projection, publishes through the fixed `InternalProductionBaselineServiceRestartAuthorizationStoreV1`, and returns only `{authorizationRef,authorizationHash}`. Its exact CLI is `prepare-restart-service --service <closed-service> --json`. `restart-service --authorization-ref <CanonicalRef> --authorization-hash <64-hex> --json` accepts only that pair, pair-resolves the strict authorization, derives the service from it, and consumes it once. It has no `--service` flag. Neither normal command accepts a label, command, executable, argv, UID, domain, PID, path, root, environment, guard, migration pair, or receipt body. The strict status is `absent | prepared | consumed | blocked`; its pair/status/store resolver never scans newest authority, and a retry adopts only the byte-identical authorization/consumption. The private helper has no public argv. The pre-schema controller calls a separate operation/action namespace fixed to `setfarm-spawner`; it cannot present that authorization to this normal API. Both closed paths derive `uid` only from code-owned `process.getuid()` (and fail closed if unavailable/non-integer), then dispatch the matching fixed label through the same no-shell helper:

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

The only database variables in this contract are `SETFARM_TEST_PG_ADMIN_URL` and `SETFARM_PG_URL`. The isolated runner accepts the administrator connection only as the former, rejects ambient `SETFARM_PG_URL`, creates a new randomly named noncanonical database for each one-file invocation, automatically applies the ordinary registry followed by the fixed test-private migration-32 authority, performs full verification, exports only that child database as `SETFARM_PG_URL`, and drops it after the serial child exits. It never aliases or exports the administrator URL as the child URL. Every whole production-capable `getSql`, current-entry controller/wrapper, owner-admission, activation controller/store/current, or migration test file appears only inside one runner invocation and its child is exactly `node --import tsx --test --test-concurrency=1 <one-file>`; each next file receives a different database, which is the frozen reset boundary. A standalone invocation of one of the three production-capable internal-production files is permitted only under the exact anchored pure/source/private-fake test-name filters below and under `env -u SETFARM_PG_URL -u SETFARM_TEST_PG_ADMIN_URL`; reaching `getSql`, opening a socket, importing a production PostgreSQL wrapper, or observing either database variable fails that filtered test process.

- [ ] **Step 3: Run focused and adjacent verification**

```bash
set -euo pipefail
: "${SETFARM_TEST_PG_ADMIN_URL:?isolated-test PostgreSQL admin URL is required}"
test -z "${SETFARM_PG_URL:-}"
readonly SETFARM_TEST_PG_ADMIN_URL
A_ISOLATED_PG_TEST_FILES=(
  tests/claim-log-lifecycle.test.ts \
  tests/cleanup-ops.test.ts \
  tests/execution-attempts/claim-attempt-transition.test.ts \
  tests/execution-attempts/claim-runtime-publication.test.ts \
  tests/execution-attempts/operational-event-delivery.test.ts \
  tests/execution-attempts/operational-outbox-repository.test.ts \
  tests/execution-attempts/run-termination.test.ts \
  tests/execution-attempts/runtime-completion-effect-runner.test.ts \
  tests/execution-attempts/runtime-hooks.test.ts \
  tests/execution-attempts/runtime-session-repository.test.ts \
  tests/execution-attempts/v3-downstream-evidence-publication.test.ts \
  tests/findings/repository.test.ts \
  tests/findings/v3-evidence-only-worker.test.ts \
  tests/findings/v3-recovery-lifecycle-reconciler.test.ts \
  tests/internal-production/owner-admission-v1.test.ts \
  tests/internal-production/baseline-owner-producer-manifest-activation-controller-v1.test.ts \
  tests/internal-production/baseline-post-handoff-receipt-v1.test.ts \
  tests/execution-attempts/migrations.test.ts \
  tests/execution-attempts/platform-release-store-record-ledger-v3-contract-integration.test.ts \
  tests/execution-attempts/activation-preflight.test.ts \
  tests/execution-attempts/artifact-publication-batch-migration.test.ts \
  tests/execution-attempts/artifact-publication-batch-plan-migration.test.ts \
  tests/execution-attempts/artifact-store-authority-migration.test.ts \
  tests/execution-attempts/attempt-reconciler.test.ts \
  tests/execution-attempts/operational-event-migration.test.ts \
  tests/execution-attempts/operational-failure-cause-migration.test.ts \
  tests/execution-attempts/preparation-authority-v2-migration.test.ts \
  tests/execution-attempts/product-compilation-attempt-migration.test.ts \
  tests/execution-attempts/run-protocol.test.ts \
  tests/execution-attempts/run-terminal-transition.test.ts \
  tests/execution-attempts/runtime-completion-manifest-authority-migration.test.ts \
  tests/execution-attempts/v3-preparation-block-repository.test.ts \
  tests/execution-attempts/v3-release-admission.test.ts \
  tests/execution-attempts/v3-story-claim-runtime-binding-v1-migration.test.ts \
  tests/findings/migration-recovery-compatibility.test.ts \
  tests/findings/migration.test.ts \
  tests/evals/convergence-eval.test.ts \
  tests/product-compiler/artifact-store-authority.test.ts \
  tests/product-compiler/artifact-store-staging.test.ts
)
for A_ISOLATED_PG_TEST_FILE in "${A_ISOLATED_PG_TEST_FILES[@]}"; do
  env -u SETFARM_PG_URL \
    SETFARM_TEST_PG_ADMIN_URL="$SETFARM_TEST_PG_ADMIN_URL" \
    node --import tsx scripts/run-isolated-postgres-tests.ts -- \
      node --import tsx --test --test-concurrency=1 "$A_ISOLATED_PG_TEST_FILE"
done
env -u SETFARM_PG_URL -u SETFARM_TEST_PG_ADMIN_URL \
  node --import tsx --test \
  tests/operational-active-run-status-v1.test.ts \
  tests/mission-control-contract-artifacts.test.ts \
  tests/mission-control-terminal-filter.test.ts \
  tests/internal-production/product-build-authority-v2-delivery-evidence-v1.test.ts \
  tests/internal-production/baseline-service-restart-helper-v1.test.ts \
  tests/internal-production/baseline-spawner-startup-admission-v1.test.ts \
  tests/internal-production/baseline-service-restart-sequence-v1.test.ts \
  tests/internal-production/baseline-restart-authority-retirement-v1.test.ts \
  tests/internal-production/task-0-source-manifest.test.ts \
  tests/execution-attempts/migration-source-digests.test.ts \
  tests/execution-attempts/runtime-completion.test.ts \
  tests/internal-production/baseline-post-handoff-cli.test.ts
env -u SETFARM_PG_URL -u SETFARM_TEST_PG_ADMIN_URL \
  node --import tsx --test \
  --test-name-pattern='^(pure current-entry parser rejects malformed status|source boundary keeps PostgreSQL imports lazy|private fake projects current-entry status|read-only prepared operation observer is exact and mutation-free)$' \
  tests/internal-production/baseline-post-handoff-receipt-v1.test.ts
env -u SETFARM_PG_URL -u SETFARM_TEST_PG_ADMIN_URL \
  node --import tsx --test \
  --test-name-pattern='^(pure activation parser rejects malformed status|source boundary keeps activation PostgreSQL imports lazy|private fake derives canonical activation status)$' \
  tests/internal-production/baseline-owner-producer-manifest-activation-controller-v1.test.ts
env -u SETFARM_PG_URL -u SETFARM_TEST_PG_ADMIN_URL \
  node --import tsx --test \
  --test-name-pattern='^(pure owner-admission parser rejects malformed authority|source boundary keeps owner-admission PostgreSQL imports lazy|private fake derives owner-admission projection)$' \
  tests/internal-production/owner-admission-v1.test.ts
node --import tsx scripts/mission-control-contract-artifacts.ts --check
npx tsc -p tsconfig.json --noEmit
npm run check:english
npm run check:paths
npm run check:migration-digests
git diff --check
```

- [ ] **Step 4: Deliver through one canonical Setfarm V3 source claim**

The Setfarm owner allocates the isolated source worktree from clean `main`; the implementation/review agents edit/test only the 109 paths in `TASK_0_EXACT_SOURCE_PATHS_V1` and submit the claim output. Setfarm alone commits, pushes, opens, reviews, merges, cleans up, and returns clean synchronized `main`. Task 0 may generate only the two checked-in operational-active artifacts and the checked-in migration digest entries through their deterministic writers; `dist/PLATFORM_BUILD_OUTPUT_TREE.json` is an untracked clean-build output, not a checked-in source artifact. It may create/drop isolated test databases and apply guarded 32 only through the literal test-only capability after generic automatic apply through 31, then apply and fully verify ordinary 33 before A and final full verification; it must not connect either capability to the live/canonical database. No live migration/schema change, owner/reservation/manifest activation, current/post-rebind authority, canary/run, service restart/rebind, runtime/store/receipt, backup, baseline Markdown, or generated-project mutation occurs in this task. Task 6A is the first production apply/activation/rebind phase; Task 7/8 cannot begin until Task 6A's current-entry pair is ready.

---

### Task 1: Implement the Product Build Authority V2 evidence and loaded-build producers

**Files:** preserve and verify the seven delivered Product Build Authority paths; create the delivery-evidence owner/test; modify only the fixed route/test, `server/index.ts`, and package command named in the File Map on `fix/internal-production-baseline-reconciliation`. The loaded-build correction uses the owner, owner test, route, and route test already present in the cross-repository File Map and adds the existing `server/index.ts` as its fifth Mission Control path for the raw-target/endpoint-operational-auth/parser-order root fix; it creates no additional Mission Control file and adds no Setfarm path. Task 0's already delivered Setfarm response parser remains repository-local and is never imported, copied as source, or reached through sibling traversal.

**Interfaces:**

- Consumes: Setfarm `GET /api/runs/:runId/product-build-authority` responses using `setfarm.product-build-authority.v1` or `setfarm.product-build-authority.v2`.
- Produces: `ProductBuildAuthority = ProductBuildAuthorityV1 | ProductBuildAuthorityV2`.
- Produces: `parseProductBuildAuthority(value: unknown, expectedRunId?: string): ProductBuildAuthority`.
- Produces: `SetfarmProductBuildAuthorityClient.get(runId: string): Promise<ProductBuildAuthorityFetchResult>`.
- Produces: `parseProductBuildAuthorityResponse(statusCode: number, body: unknown, expectedRunId: string)` for the browser boundary.
- Verifies: the delivered UI labels V2 `sealed_packet` as `SEALED`, V2 `refused_before_packet` as `REFUSED`, and never falls back to agent prose.
- Implements for post-merge use: strict read-only `ProductBuildAuthorityV2DeliveryEvidenceV1`, exact `ProductBuildAuthorityV2DeliveryEvidencePairV1 = {deliveryEvidenceRef,deliveryEvidenceHash}`, zero-input `observeCurrentProductBuildAuthorityV2DeliveryEvidenceV1()`, pair-only `resolveProductBuildAuthorityV2DeliveryEvidenceV1({deliveryEvidenceRef,deliveryEvidenceHash})`, fixed endpoint `GET /api/internal-production/product-build-authority-v2-delivery-evidence`, and the zero-input non-listening source CLI. The production observer/resolver/CLI/endpoint owner requires clean synchronized Mission Control `main` with `HEAD === refs/remotes/origin/main === build SHA`; therefore the reconciliation branch cannot produce or consume this pair.
- Implements for the loaded server: the exact `ProductBuildAuthorityV2LoadedBuildResponseV1` frozen in OA18, one module-evaluation startup capture before `server.listen()`, fixed operationally authenticated `GET /api/internal-production/product-build-authority-v2-loaded-build`, exact alias/HEAD 404 refusal after the applicable authentication, endpoint authentication from existing `config.setfarmOperationalWriteToken` through SHA-256 digest plus timing-safe comparison of the `x-setfarm-operational-token` header, private-marker general-auth bypass, authentication-before-exact-path-parser-wrapper-before-router order, and route-owned finite request-invalid 400. This producer has no pair resolver, current pointer, CLI, request-time observer, caller input, `AUTH_TOKEN` dependency, or fallback.

`ProductBuildAuthorityV2DeliveryEvidenceV1` has schema `mission-control.product-build-authority-v2-delivery-evidence.v1`, `currentStatus:"current"`, fixed `deliveryPrNumber:19`, and fixed `deliveryMergeSha:"240e779d78804843a1202cbf0440fe423b806b1a"`. It binds that merge's ancestry to current clean Mission Control `main`; current Mission Control source SHA, tree hash, and build hash; the exact ordered blob hashes for the seven delivered schema/parser/server/UI/test paths plus `contracts/vendor/setfarm/mission-control-contracts.v1.lock.json`; the strict focused-test receipt ref/hash; and the lock's producer commit, lock-content hash, exact ordered twelve artifact path/hash identities, and compatibility-set hash. `deliveryEvidenceHash` is `hashCanonicalJson` of every field except its two derived pair fields; `deliveryEvidenceRef` is exactly `mission-control://internal-production/product-build-authority-v2-delivery-evidence/sha256/${deliveryEvidenceHash}`. There is no mutable store, current pointer, caller body, per-run authority ref, or claimed global PBA authority pair. A private test-only injected contract evaluator may compute candidate canonical bytes and expected hashes from frozen fixtures, but those values are explicitly non-authoritative: it cannot call the production observer/resolver, publish a pair, populate a current pointer, or escape the test module.

The owner module derives its repository root only from its own authenticated module/build location, requires literal clean `main` and `HEAD === refs/remotes/origin/main === build SHA` before evidence construction or pair resolution, invokes one fixed no-shell focused-test command over the three delivered test files, and emits a deterministic `ProductBuildAuthorityV2FocusedTestReceiptV1`. That receipt binds the fixed command-contract hash, ordered test-path/blob hashes, `passed:true`, and exit status 0; its content hash/ref exclude volatile duration, PID, path, stdout, and timestamp. The pair-only resolver reruns those fixed observers and accepts only byte-identical current evidence. The endpoint and source CLI call the same zero-input resolver and return exactly `{schema,currentStatus,deliveryEvidenceRef,deliveryEvidenceHash,evidence}` with no query, run ID, root, ref, hash, body, or transport argument. On a feature branch, detached head, dirty tree, stale `origin/main`, or build-SHA mismatch they fail before focused tests, hashing, resolver access, response serialization, stdout, or any publication side effect. Mission Control implements the wire producer independently against Task 0's canonical schema/status/ref/hash/evidence/null relations; neither repository imports the other. Source-boundary and later wire-integration tests compare the exact canonical response bytes, hash fields, field set, and rejection cases while proving the delivery-evidence response is not added to the ten/twelve/fourteen generated-vendor inventories.

The same owner module independently captures loaded-build authority from the executing compiled generation. Static import evaluation completes the terminal build-identity validation, complete output-hash recomputation, exact identity-byte hash, owner-module-byte hash, fresh process PID/UUID startup instance, and recursive freeze before the server can call `listen`. The loaded endpoint returns only that snapshot or the one frozen startup-invalid 503 shape. It never calls the clean-current delivery observer/resolver, focused tests, source CLI, Git, or filesystem after startup. The startup snapshot and delivery-evidence response remain distinct schemas and hash domains; equality is required only between loaded `buildIdentity` source/tree/build and the operation-embedded delivery evidence's `currentSource` when Setfarm consumes them.

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

- [ ] **Step 2: Write the failing delivery-evidence, loaded-build, and branch-refusal tests**

Add exact tests for PR/merge ancestry, all eight ordered path/blob members, current source/tree/build, focused-test receipt, twelve lock identities, deterministic candidate bytes/hash under injected frozen fixtures, and endpoint/CLI-shaped canonical fixture equality without invoking the production observer or pair-only resolver. Add the exact OA18 loaded-build RED matrix in the same owner/route tests: evaluate compiled generation A, atomically replace the disposable disk build identity, owner module, and source CLI with B, prove repeated requests remain A without request-time work, then freshly evaluate B and prove a distinct frozen response; cover every response field/hash/ref/grammar, PID/UUID freeze, startup-invalid 503, no-cache headers, load-bearing relative source order endpoint operational authenticator → canonical-marker-aware general `/api` auth → exact-path JSON-parser wrapper → loaded router/raw guard → API 404 → terminal boundary, and byte-exact canonical raw `req.originalUrl` target plus parser-visible `req.path` equality. Low-level raw tests send mixed-case `/API` plus inner-component, trailing-slash, duplicate-slash, percent-encoded, dot-segment, and composed aliases with a valid configured general credential and require exact API 404 with zero snapshot access; canonical HEAD with the valid operational credential is bodyless 404 with zero snapshot reads. They separately require missing/short configured operational token exact AUTH_UNAVAILABLE 503; missing/duplicate-coalesced/wrong/query/body/`x-mc-token`-only credentials exact loaded UNAUTHORIZED 401; SHA-256 digest plus timing-safe equality; a valid operational-only credential reaching the route when a distinct `AUTH_TOKEN` is configured; unauthenticated canonical malformed/body-framed exact loaded 401; authenticated canonical malformed/body-framed/query exact finite request-invalid 400 rather than generic 500; literal request header `Content-Length: 0` exact 400; and unchanged general auth/parser/error behavior for unrelated `/api` routes. Observe RED because both required surfaces and the mount-order/raw-target/authentication correction are absent. Delivery tests delete or tamper each path blob, vendor-lock identity, test result, source/tree/build value, current status, ref, and hash in turn; simulate missing merge ancestry, dirty/non-main source, unsupported query/body/run ID, a per-run `authorityHash` substituted as the evidence pair, and source/HTTP cross-pairs. A production CLI invocation from `fix/internal-production-baseline-reconciliation` must exit nonzero with empty stdout before focused-test execution, hashing, or resolver access, and publication/store/pointer spies remain at zero. The production delivery endpoint owner and pair resolver have the same branch refusal. No branch test publishes or resolves a production pair; it only compares non-authoritative candidate canonical bytes/hash inside private fixtures. Loaded-build tests use disposable compiled-output fixtures and never inject a production startup snapshot, PID, UUID, root, filesystem, body, response, or credential. Every case fails closed.

- [ ] **Step 3: Implement the read-only owner, two endpoints, resolver, and non-listening source CLI**

The source CLI exists because the pre-Task7 Mission Control service has not loaded Task 1 bytes. Its production path loads only the reviewed post-merge current Mission Control build in a one-shot process, opens no listener, performs no restart, and calls the current-source delivery owner. It is never loaded-generation authority. During Tasks 1–6 Step 7, only private injected-fixture tests may evaluate the delivery contract; direct production CLI, delivery endpoint owner, observer, and resolver calls on the reconciliation branch must refuse with no pair. After Task 6 Step 8 has built clean synchronized `main`, Task 6A's fixed Setfarm current-source observer may invoke only this CLI before rebind. In `server/index.ts`, preserve public health ahead of authentication; mount the raw-canonical-path operational authenticator; mount the private-marker-aware general `/api` auth wrapper; and retain the single global parser wrapper above the loaded router while bypassing JSON decoding only for exact loaded `req.path`. The route retains the exact raw method/path, query, body, and framing refusals and calls `next()` to existing API 404 for HEAD/aliases before snapshot access. Existing unrelated-route general auth/parser/error behavior remains unchanged, and no `AUTH_TOKEN` source or environment member is added. Once the compiled server starts, its separate loaded-build endpoint returns the module-evaluation snapshot for that PID; OA18 retention uses only that endpoint for loaded generation. Task 7 continues to require the delivery-evidence endpoint to return the byte-identical post-merge pair before it seals post-rebind authority.

- [ ] **Step 4: Run the focused authority and delivery-evidence suite**

```bash
set -euo pipefail
node --import tsx --test \
  server/routes/setfarm-operational.test.ts \
  server/services/setfarm-product-build-authority.test.ts \
  server/services/product-build-authority-v2-delivery-evidence-v1.test.ts \
  tests/product-build-authority-render.test.tsx
```

Expected: all tests pass; V1 remains readable; V2 sealed/refused payloads retain strict server behavior; injected canonical delivery fixtures produce deterministic non-authoritative candidate bytes/hashes; feature-branch production invocation publishes no pair; every missing/tampered path/blob/lock/test/source/status/cross-pair case fails closed; and the loaded-build suite proves startup A remains frozen after disk/CLI B, fresh B differs, all refusal/unavailable bodies are exact, only the byte-exact canonical raw target/path proceeds, every listed/composed alias after applicable general auth and canonical HEAD after operational auth terminates at exact 404 with zero snapshot access, missing/short operational configuration terminates at exact loaded-auth 503, missing/wrong/general-only endpoint credentials terminate at exact loaded-auth 401, a valid operational-only credential reaches the route despite distinct general auth, unauthenticated malformed/framed canonical requests cannot bypass authentication, authenticated malformed/framed/query and `Content-Length: 0` requests terminate at exact 400, unrelated general auth/parser/error behavior is unchanged, and request handling performs zero Git/test/CLI/filesystem/listen/write work.

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
  server/index.ts \
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

Expected: the only source changes are the File Map's owner/test/route/test/index/package paths on the one reconciliation branch. The production command fails before emitting a response or publishing/resolving evidence. Focused tests separately prove zero publication/store/pointer/resolver calls and may retain only non-authoritative candidate bytes/hashes inside their injected fixture scope. No branch status, shell, checkpoint, review handoff, or commit metadata contains a production current pair.

---

### Task 2: Add an exact project-to-run execution projection

Task 2 continues on Task 1's single `fix/internal-production-baseline-reconciliation` branch after Task 1's focused fixture and feature-branch no-publication tests pass. It does not resolve or consume a production delivery-evidence pair. Tasks 1–5 alone write to that branch. The seven delivered Product Build Authority V2 behavior paths remain verified inputs and are not behaviorally changed unless a newly failing current regression identifies an independently reviewed root fix.

**Files:**

- Create: `mission-control/server/shared/setfarm-operational-active-run-status-v1.ts`
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
  server/shared/setfarm-operational-active-run-status-v1.ts \
  server/services/project-execution-state.ts \
  server/services/project-execution-state.test.ts \
  server/utils/setfarm-db.ts
git diff --name-only -- \
  server/shared/setfarm-operational-active-run-status-v1.ts \
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
- Consume: `mission-control/server/services/project-execution-state.ts`, its Setfarm-derived execution state, and `mission-control/server/shared/setfarm-operational-active-run-status-v1.ts`; the route defines no active-status list.

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

export function readProjectApiProjections():
  Promise<Array<Record<string, unknown> & ProjectApiProjection>>;
```

The projection first proves `execution.active === (execution.runStatus !== null && isSetfarmOperationalActiveRunStatusV1(execution.runStatus))`; an active execution must also have `execution.state === execution.runStatus`. A mismatch fails with `PROJECT_EXECUTION_ACTIVE_RELATION_INVALID`. Active execution maps public status to `building`. An exact terminal execution maps `completed|done` to `completed`, `failed` to `failed`, and `cancelled|canceled` to `cancelled`; any other terminal status fails with `PROJECT_EXECUTION_TERMINAL_STATUS_INVALID`. Otherwise persisted `completed|done`, `failed|error`, and `cancelled|canceled` retain their corresponding public terminal status, while every other legacy catalog value maps to `registered`.

The canonical V3 marker remains the existing exact `productCompilerProtocol:"v3"` plus `createdBy:"setfarm-v3-terminal-projector"` predicate. Its runtime state comes only from `observedServiceStatus` (`active|inactive`, otherwise `unknown`), its `checkedAt` comes only from a nonempty `observedServiceCheckedAt`, and its reason is the nonempty exact upstream `observedServiceReasonCode` or fixed `V3_DEPLOYMENT_OBSERVATION_UNAVAILABLE`; immutable receipt `serviceStatus` is never a runtime fallback. A noncanonical record maps only exact observed/post-probe `serviceStatus` `active|inactive`, otherwise `unknown`, has `checkedAt:null`, and uses fixed `PROJECT_RUNTIME_LEGACY_SERVICE_STATUS_ACTIVE|INACTIVE|UNKNOWN`. A canonical receipt exists only when stored `status` and `serviceStatus` are both exact `active` and both canonical hashes are lowercase SHA-256; otherwise projection fails with `PROJECT_API_CANONICAL_RECEIPT_INVALID`. Noncanonical records never synthesize a receipt.

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

Capture binding hints, every raw binding identity field (`latestRunId`, `workflowRunId`, `setfarmRunIds`, `latestRunNumber`, and `runNumber`), and immutable catalog/receipt fields from the de-duplicated pre-enrichment records. Existing name/repository/task enrichment remains advisory and may contribute display fields or runtime probes, but the projected clone restores those exact binding fields and cannot change execution binding, raw action/evidence authority, public catalog status, immutable receipt, or action authority. A same-name/repository unrelated run therefore cannot replace either `execution.runId` or any returned raw binding identity. Run the same read-only projection for `GET /projects/:id`: project/enrich the registered-record collection with one bounded run-row read and then preserve the existing `findProjectByIdOrRepo` lookup semantics. Do not project mutation responses, import/export payloads, or persistence objects in this task.

`readProjectApiProjections()` is the sole zero-input list reader implementing steps 1–6; `GET /projects` calls it and then applies request-specific filtering/sorting. Task 4's overview route imports this read-only seam for active-workflow counts rather than repeating raw `projects.json`, broad `getRuns()`, binding, enrichment, or the active tuple. It never saves, mutates, accepts a repository/reader/row input, or returns an unprojected record.

Keep `ProjectsJsonRepository.save()`, canonical transfer ACK hashing, patch guards, deletion guards, and V3 persisted record shapes unchanged. Remove name/task/repository matching only from execution-state assignment; legacy descriptive enrichment may remain advisory but cannot change `execution`, public `status`, or action authority. The route imports the shared predicate and fail-closed equality-checks `execution.active === (execution.runStatus !== null && isSetfarmOperationalActiveRunStatusV1(execution.runStatus))` before emitting a project. It copies the exact active transition state from `ProjectExecutionState`; it never imports a second tuple or treats `pending` as active.

- [ ] **Step 4: Make terminal filtering explicit**

Update `isHiddenTerminalProject()` to use `execution.state === "terminal"` plus public `status` in `failed|cancelled`; default `/api/projects` continues to include all records. `hideTerminal=1` remains the only API request that hides terminal projects.

Legacy synthesis does not pre-drop `cancelled|canceled` runs: it produces their terminal projection like other historical runs. The default list includes them, while the explicit `hideTerminal=1` filter removes them. No earlier synthesis/filter branch may silently erase failed or cancelled history.

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
- Consume: `mission-control/server/shared/setfarm-operational-active-run-status-v1.ts`
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
- Consumes: Task 3's zero-input read-only `readProjectApiProjections()` collection seam; Overview never repeats raw project loading, broad run lookup, execution binding, or runtime observation.
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

Overview's pure active-project selector requires `execution.active === true`, `execution.runStatus !== null`, the shared predicate to accept that exact `runStatus`, and `execution.state === execution.runStatus`; it then uses the distinct projected `execution.runId` identities to select corresponding raw run summaries and rejects cross-source status disagreement. Its recent-runtime selector considers projected records with a valid declared frontend/main port regardless of catalog or execution terminal state, sorts by creation time, caps at six, and leaves `online` solely to the bounded live port probe. `Projects.tsx` re-reads the canonical project list after create/import/toggle mutations because Task 3 intentionally does not return projections from mutation endpoints; it never fabricates or retains stale execution/runtime/receipt fields optimistically.

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

- `InternalProductionPreMutationLoadedRuntimeServiceAuthorityV1` is a strict code-owned four-service observation created inside zero-input `prepare-current-entry` from the immediately preceding Step 1 `InternalProductionServiceCensusV1`. Its exact pair is published only after the fixed current-entry operation exists. Its body binds that operation, `observedServiceCensusHash`, and four exact named `spawner`, `dashboard`, `missionControl`, and `openClaw` projections including process/generation/owner counts and applicable listener identity. Spawner/dashboard and Mission Control bind authenticated loaded source/tree/build; OpenClaw binds process/generation/listener identity only and has exact null source/tree/build. `serviceProjectionSetHash` is exactly `hashCanonicalJson({schema,currentEntryOperationRef,currentEntryOperationHash,observedServiceCensusHash,spawner,dashboard,missionControl,openClaw})` in that member order; it excludes the authority ref/hash and itself. The authority hash is separately `hashCanonicalJson` over the complete strict authority body excluding only its two derived pair fields, and its ref is `setfarm://internal-production/pre-mutation-loaded-runtime-service-authority/sha256/${preMutationLoadedRuntimeServiceAuthorityHash}`. Its no-replace store and pair-only resolver recompute both and accept no caller body, process field, census, path, PID, or newest scan. Tests require `observedServiceCensusHash === census.censusHash` and compare each shared named projection field; they never compare structurally unequal whole objects. The status ABI is the two direct scalar fields `.preMutationLoadedRuntimeServiceAuthorityRef`/`.preMutationLoadedRuntimeServiceAuthorityHash` plus the freshly pair-resolved `.preMutationLoadedRuntimeServiceAuthority` body, never a caller-supplied `preMutationLoadedRuntimeServiceAuthorityPair` wrapper. `operation_prepared`, every later nonblocked status, and final `InternalProductionCurrentEntryAuthorityV1` contain the byte-identical pair. The final current-entry body also embeds the freshly pair-resolved authority body; this pre-mutation observation remains distinct from the later mixed `loadedRuntimeServiceAuthority` produced after the spawner transition.

- Every non-absent current-entry phase repeats the exact current-entry operation pair and pre-mutation runtime-authority pair. Its strict pre-schema subchain is authorization → startup token → restart authority → predecessor-termination observation → replacement-process observation → sealed admission → admission ready; the migration subchain adds the exact authorization-consumption pair before its terminal migration-32 receipt/current audit, then requires ordinary migration 33 applied/current before A. Migration 33 adds no receipt/status field or nested discriminant: retries in the existing `current_audited` to `manifest_activating` gap derive its progress solely from exact journal/schema verification. Within `pre_schema_spawner_rebinding`, the nested rebind status may be only `prepared`, `startup_token_published`, or one of the ordered `dispatching` prefixes; `pre_manifest_bootstrap_sealed` requires the terminal sealed status and every predecessor pair. The four Round 4 nested discriminants represent the mandated receipt/current-audit, admission-ready/runtime-observed, canary-settlement, target-close, and fence-release crash boundaries without adding a thirteenth top state. Every later phase preserves those byte-identical pairs. Strict schemas require all earlier fields and exact null later fields and reject a crossed operation, hash-only termination, predicted generation, phase-impossible field, or blocked-prefix clone.

- `InternalProductionCurrentEntryAuthorityV1` has schema `setfarm.internal-production-current-entry-authority.v1`. It binds reviewed PR #86 merge `1d691c89760339ea905dfe17f8e9188e62603c1c` as an ancestor; exact `controllerSourceAuthority:{controllerSourceSha,controllerTreeHash,controllerBuildHash}` for current clean Task 0 Setfarm main; the current-entry operation pair created before mutation; the direct pre-mutation loaded-runtime ref/hash plus its freshly pair-resolved strict body; the pre-schema spawner authorization/restart authority, sealed admission, post-predecessor-termination legacy-zero pair, and same-generation normal-admission-ready pair; exact applied `bootstrapHandoffMigrationReceiptRef/Hash` and `bootstrapHandoffCurrentAuditRef/Hash`; the A-manifest activation/head pairs; separate `loadedRuntimeServiceAuthority` with the spawner equal to the Task 0 controller build, dashboard and Mission Control on their independently authenticated delivered source/builds, and OpenClaw authenticated by process/generation/listener identity with null source/tree/build; current clean Mission Control SHA; exact PBA delivery-evidence pair; focused Authority-V3 test receipt; one fresh canary settlement and its fence/typed-target/compound-close/release pairs; and the final complete zero-unrelated-owner census. It has no top-level pending-migration pair or pending-current assertion. The migration receipt preserves the exact v31 predecessor/pre-apply pending quartet plus the pre-schema/sealed/legacy-census/migration-authorization chain as immutable causal history.
- `InternalProductionCurrentEntryAuthorityPairV1` is exactly `{entryAuthorityRef,entryAuthorityHash}`. `InternalProductionCurrentEntryAuthorityStatusV1` is the sole `current-entry-status --json` wire body and keeps exactly twelve top states: `absent | operation_prepared | pre_schema_spawner_rebinding | pre_manifest_bootstrap_sealed | migration_applying | manifest_activating | spawner_admission_transitioning | prepared | canary_running | settled | ready | blocked`. `absent` has every authority, prerequisite, and phase null. The fixed prefix of `operation_prepared` and every later nonblocked state contains the byte-identical operation pair, `controllerSourceAuthority`, nested PBA-v2 pair, nested v31-audit pair, nested pending-32 projection pair, and `InternalProductionPreMutationLoadedRuntimeServiceAuthorityPairV1` plus its resolved body. No branch has a flattened lifecycle, canary, controller, runtime, migration, manifest, or entry mirror. Three state-specific `Extract` aliases make the rebind body partial only in `pre_schema_spawner_rebinding`, sealed in `pre_manifest_bootstrap_sealed|migration_applying|manifest_activating`, and normal-ready in `prepared|canary_running|settled|ready`; the blocked last-valid projection repeats that same mapping. `spawner_admission_transitioning` is a relational union: `sealed` carries only the sealed body, while `admission_ready|runtime_observed` carries only the normal-ready body. `migration_applying` has strict nested `prepared | consumed | receipt_published | current_audited`: consumption is null only in `prepared`, receipt is null through `consumed`, and current audit is null through `receipt_published`. Migration 33 adds no field or nested phase; the controller remains at `current_audited`, derives retry progress from exact journal/schema state, and only after 33 is applied/current may advance to `manifest_activating`. `spawner_admission_transitioning` has strict nested `sealed | admission_ready | runtime_observed`: admission-ready is null in `sealed`, and post-rebind mixed runtime authority is null until `runtime_observed`. Only `runtime_observed` may advance to `prepared`. `canary_running` is nested `running | terminal_settlement_published`, with settlement null in `running` and target close null in both. `settled` is nested `target_closed | fence_released`, with release null in `target_closed` and final entry null in both. Only `ready` adds nested `.entryAuthority.entryAuthorityRef/Hash`. Every branch uses the fixed prior pairs and an exact strict schema; `blocked` preserves one exact last-valid status pair and one finite `InternalProductionCurrentEntryBlockedReasonCodeV1`. A missing/extra/crossed pair, wrong nested phase, impossible nullability, structural clone, skipped durable boundary, or undeclared top-level field fails parsing/resolution and cannot advance the head.
- The focused-test receipt proves the exact mutually exclusive tuple `SETUP_PACKET_DESIGN_SOURCE_ATTEMPT_REJECTED`, `SETUP_PACKET_DESIGN_SOURCE_CLOSURE_REJECTED`, and `SETUP_PACKET_IMPLEMENTATION_SOURCE_MAP_REJECTED` across source mapping, migration 31, rollback refusal, and terminal-preclaim regressions. The single live canary proves only the one exact failure code it actually observed. It never claims that one run emitted all three mutually exclusive codes.
- The canary settlement requires a new disposable run, one observed tuple member, exactly one terminal claim, exactly one termination request, zero redispatch after terminalization, zero open claim/runtime/completion/effect ownership, and no reuse or continuation of run 2075.
- `prepare-current-entry --json` accepts no root/SHA/run/code/path/receipt override. After it internally reopens Task 6 Step 8's PBA pair plus clean source/build and the read-only v31/pending authorities, it creates or adopts the fixed operation before any service/database mutation and returns only its pair. `resume-current-entry --json` accepts no identity and is the sole production mutation controller: it resumes that fixed operation through pre-schema authorization/dispatch/old-spawner termination/startup seal/post-termination legacy zero, fresh legacy equality reobservation, pre-manifest guarded-32 authorization/apply/acknowledged commit/receipt/current audit, separately transacted ordinary-33 apply or exact adoption and full verification, A-manifest activation, same-generation complete generic full verify/normal DB initialization/admission-ready, mixed runtime observation, canary fence/targets/start/settlement/close/release, and ready publication. It never invokes the public normal restart API and exposes no apply/restart/activation mutation argv. `current-entry-status --json` is read-only and emits only the strict status union.

- Zero-input `verify-current-entry --json` resolves the ready status and entry plus the first 31 predecessor pairs of `InternalProductionCurrentEntryResolvedAuthoritySetV1` in this exact lifecycle order: `productBuildAuthorityV2DeliveryEvidence`, `authorityV3Migration31Audit`, `pendingBootstrapHandoffMigration`, `authorityV3FocusedTestReceipt`, `currentEntryOperation`, `preMutationLoadedRuntimeServiceAuthority`, `preSchemaSpawnerRebindAuthorization`, `preSchemaSpawnerStartupToken`, `preSchemaSpawnerRestartAuthority`, `predecessorTerminationObservation`, `replacementProcessObservation`, `postPredecessorTerminationLegacyZeroOwnerObservation`, `preSchemaSpawnerSealedAdmission`, `freshLegacyZeroOwnerObservation`, `preManifestMigration32Authorization`, `preManifestMigration32AuthorizationConsumption`, `bootstrapHandoffMigrationReceipt`, `bootstrapHandoffCurrentAudit`, `ownerProducerManifestActivation`, `ownerProducerManifestHead`, `task0SpawnerAdmissionReady`, `preSchemaSpawnerRebindStatus`, `loadedRuntimeServiceAuthority`, `ownerAdmissionFence`, `sourceRunTargetReservation`, `runTargetReservation`, `terminalSettlement`, `targetClose`, `ownerAdmissionFenceRelease`, `currentEntryAuthority`, `currentEntryStatus`. After publishing the fresh evidence below, it appends `completeZeroOwnerCensusObservation` and `freshRuntimeAndOwnerObservation` as members 32 and 33. Every tuple member is exactly `{name,pair}`; `resolvedAuthoritySetHash` is `hashCanonicalJson` of that exact 33-member tuple with no sort, omission, duplicate, latest-store lookup, structural body, or additional member.

- The verifier next freshly observes the canonical named service census and the post-manifest `InternalProductionCompleteZeroOwnerCensusObservationV1`, publishes both the complete-zero body and pair, and then publishes `InternalProductionCurrentEntryFreshRuntimeAndOwnerObservationV1`. That strict body is exactly `{schema,currentEntryStatus,entryAuthority,serviceCensus,completeZeroOwnerCensusObservation,completeZeroOwnerCensusObservationBody,controllerRuntimeSourceRelations,observedAt,freshRuntimeAndOwnerObservationRef,freshRuntimeAndOwnerObservationHash}`. It requires the nested owner pair to equal the nested body's derived `observationRef/Hash`; that owner body resolves the exact current manifest activation and all 35/35/36 zero-owner evidence. `controllerRuntimeSourceRelations` contains the controller authority and loaded-runtime pair, requires spawner source/tree/build equality to the controller, binds dashboard and Mission Control to their authenticated delivered runtime identities, and fixes OpenClaw to process/generation/listener-only with null source/tree/build. `observedAt` is strict UTC RFC 3339 with milliseconds. The observation hash is `hashCanonicalJson({schema,currentEntryStatus,entryAuthority,serviceCensus,completeZeroOwnerCensusObservation,completeZeroOwnerCensusObservationBody,controllerRuntimeSourceRelations,observedAt})` in that order, excluding only its derived ref/hash; its ref is `setfarm://internal-production/current-entry-fresh-runtime-and-owner-observation/sha256/${freshRuntimeAndOwnerObservationHash}`. Its no-replace store and pair-only resolver reject structural bodies, latest scans, crossed pairs, stale census, owner drift, or source-relation drift.

- Only after resolving that observation does the verifier finish the 33-member tuple and publish the sole `InternalProductionCurrentEntryVerificationV1` success receipt. It is exactly `{schema,currentStatus,currentEntryStatus,entryAuthority,resolvedAuthoritySetHash,freshRuntimeAndOwnerObservation,currentEntryVerificationRef,currentEntryVerificationHash}`; `freshRuntimeAndOwnerObservation` is the exact nested ref/hash pair, never a hash-only assertion. `currentEntryVerificationHash` is exactly `hashCanonicalJson({schema,currentStatus,currentEntryStatus,entryAuthority,resolvedAuthoritySetHash,freshRuntimeAndOwnerObservation})` in that order and excludes only the receipt's derived ref/hash. Its ref is `setfarm://internal-production/current-entry-verification/sha256/${currentEntryVerificationHash}`. The receipt resolver reopens every one of the 33 ordered pairs, recomputes all projections, then performs a new code-owned runtime and complete-owner observation and requires equality with the stored evidence before returning current. Thus the order is acyclic: fresh observation first, verification receipt second. Any noncurrent relation or failed fresh equality exits nonzero with no success body. Task 7 calls the same zero-input verifier before its first restart and never applies schema.
- Crash/race/replay tests interrupt before and after operation publication, first legacy observation, pre-schema authorization, helper/outbox/dispatch, old-spawner terminal observation, sealed-process startup, post-termination all-36-zero observation, fresh migration-time reobservation, guarded-32 authorization/transaction/commit acknowledgement/receipt/current audit, ordinary-33 transaction start/commit acknowledgement/current verification, manifest activation, complete generic full verify/normal DB initialization/admission-ready CAS, mixed runtime observation, PBA resolution, canary fence/targets/start/settlement/close/release, ready publication, and response. Retry adopts only the same operation/head prefix. A crash before 33 starts retains current 32; a pre-ack 33 failure rolls back only 33; a lost 33 commit acknowledgement exact-adopts the one result; a crash after current 33 before A resumes at A. Race an owner/child at every observation-to-dispatch/termination/seal/apply boundary and require the replacement to stay sealed with migration unavailable. Tests reject default startup success while 32 or 33 is pending/drifted, any env/argv/caller sealed mode, generic early apply, Task 7 apply, normal complete-zero/restart before activation, missing/additional pending migration, causal-pair drift, manifest before current 33, canary before admission-ready, dashboard/MC pre-canary rebind, old-spawner production after terminal restart, PBA tamper, fork, second run, unrelated owner, one-sided close, release-before-close, caller scalar, or structural clone.

- Round 3 crash fixtures stop before/after authorization, startup-token publication, restart-authority publication, helper dispatch, strict predecessor-termination observation, strict replacement-process observation, sealed-admission publication, migration-authorization consumption, terminal migration-32 receipt/current audit, ordinary-migration-33 transaction/current verification, A activation, and admission-ready publication. Migration-33 boundaries remain within the existing current-audited-to-manifest prefix and add no status member. Each status prefix resolves its exact operation and record pairs; retries adopt that prefix, and impossible nullability, crossed pairs, predicted generations, structural bodies, or newest-store scans fail without advancing.

- Round 4 crash fixtures additionally stop before/after pre-mutation runtime-authority publication, guarded-32 migration authorization prepare, consumption, receipt publication, current-audit publication, ordinary-33 transaction start, commit acknowledgement/current verification, A activation, admission-ready publication, mixed-runtime observation, canary start, terminal-settlement publication, compound target close, fence release, and entry publication. The migration-33 boundaries reuse the exact `current_audited` prefix until A and therefore add no top state, nested field, or pair; every other boundary maps to one exact top-state/nested-phase combination above. Tests enumerate every strict branch, pairwise null relation, fixed predecessor pair, and finite blocked reason, and reject a skipped nested member, stale pre-mutation census, caller runtime body, crossed operation, or status repair.

- [ ] **Step 1: Verify read-only prerequisites and prepare before mutation**

The operator shell receives `SETFARM_ROOT` and `SETFARM_ROOT_EXPECTED_SHA` from the freshly resolved clean-main controller authority and runs the validator before every command. It records only read-only PBA/v31/pending/service prerequisites, then calls zero-input `prepare-current-entry` before any live mutation. Step 1 contains no resume, restart, migration-apply, activation, guard, service, label, command, path, or authority-body argv. Dashboard and Mission Control remain on their delivered generations.

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
  .currentStatus == "current" and
  .controllerSource.branch == "main" and .controllerSource.clean == true and
  .controllerSource.sha == $controllerSha and
  .controllerSource.originMainSha == $controllerSha and
  .pr86Delivery.pullRequestNumber == 86 and
  .pr86Delivery.mergeSha == "1d691c89760339ea905dfe17f8e9188e62603c1c" and
  .pr86Delivery.mergeTreeHash == "04f1d95a58360d06e866fe816138655efa916284" and
  .pr86Delivery.expectedMergeBase == "1d691c89760339ea905dfe17f8e9188e62603c1c" and
  .authorityV3ContractSpineThroughMigration31.schema == "setfarm.authority-v3-contract-spine-through-migration-31-audit.v1" and
  .authorityV3ContractSpineThroughMigration31.status == "verified" and
  .authorityV3ContractSpineThroughMigration31.throughVersion == 31 and
  (.authorityV3ContractSpineThroughMigration31.migrations | length) == 31 and
  all(.authorityV3ContractSpineThroughMigration31.migrations | to_entries[];
    .value.version == (.key + 1) and
    .value.migrationClass == "automatic" and
    (.value.state == "applied" or .value.state == "adopted") and
    (.value.name | type == "string") and
    (.value.checksum | test("^[0-9a-f]{64}$"))) and
  .currentAuthorityAudit.schema == "setfarm.contract-spine-current-authority-ledgers-audit.v2" and
  .currentAuthorityAudit.status == "verified" and
  (.currentAuthorityAuditHash | test("^[0-9a-f]{64}$")) and
  (.migration31SemanticDigest | test("^[0-9a-f]{64}$")) and
  (.migration31SourceManifestEntryHash | test("^[0-9a-f]{64}$")) and
  (.authorityV3Migration31AuditRef | startswith("setfarm://internal-production/authority-v3-migration31-audit/sha256/")) and
  (.authorityV3Migration31AuditHash | test("^[0-9a-f]{64}$"))
' --arg controllerSha "$SETFARM_ROOT_EXPECTED_SHA" >/dev/null
require_authenticated_clean_main_setfarm_root_v1
A_PENDING_SUCCESSOR_JSON="$(npm --prefix "$SETFARM_ROOT" run --silent acceptance:baseline-post-handoff -- inspect-pending-bootstrap-handoff-successor --json)"
A_PENDING_SUCCESSOR_REF="$(printf '%s\n' "$A_PENDING_SUCCESSOR_JSON" | jq -er '.pendingBootstrapHandoffMigrationRef')"
A_PENDING_SUCCESSOR_HASH="$(printf '%s\n' "$A_PENDING_SUCCESSOR_JSON" | jq -er '.pendingBootstrapHandoffMigrationHash')"
printf '%s\n' "$A_PENDING_SUCCESSOR_JSON" | jq -e '
  .schema == "setfarm.internal-production-pending-bootstrap-handoff-migration-projection.v1" and
  .currentStatus == "current" and
  .controllerSource.branch == "main" and .controllerSource.clean == true and
  .controllerSource.sha == $controllerSha and
  .controllerSource.originMainSha == $controllerSha and
  .pendingSuccessor.schema == "setfarm.pending-bootstrap-main-claim-handoff-guarded-successor.v1" and
  .pendingSuccessor.status == "exact_pending_guarded_successor" and
  .pendingSuccessor.migration.version == 32 and
  .pendingSuccessor.migration.name == "contract-spine-bootstrap-main-claim-handoff-v1" and
  .pendingSuccessor.migration.migrationClass == "guarded" and
  .pendingSuccessor.migration.state == "pending" and
  (.pendingSuccessor.migration.checksum | test("^[0-9a-f]{64}$")) and
  (.pendingSuccessor.orderedStatementsHash | test("^[0-9a-f]{64}$")) and
  (.pendingSuccessor.namedMigrationDigestEntryHash | test("^[0-9a-f]{64}$")) and
  (.pendingSuccessor.migrationDigest | test("^[0-9a-f]{64}$")) and
  (.pendingSuccessor.expectedSchemaProjectionHash | test("^[0-9a-f]{64}$")) and
  .migrationImplementation.locator == "src/db/bootstrap-main-claim-handoff-v1-migration.ts" and
  .migrationImplementation.gitMode == "100644" and
  (.migrationImplementation.gitBlobHash | test("^[0-9a-f]{40}([0-9a-f]{24})?$")) and
  (.pendingBootstrapHandoffMigrationRef | startswith("setfarm://internal-production/pending-bootstrap-handoff-migration/sha256/")) and
  (.pendingBootstrapHandoffMigrationHash | test("^[0-9a-f]{64}$"))
' --arg controllerSha "$SETFARM_ROOT_EXPECTED_SHA" >/dev/null
require_authenticated_clean_main_setfarm_root_v1
A_PRE_ENTRY_SERVICE_CENSUS_JSON="$(npm --prefix "$SETFARM_ROOT" run --silent acceptance:baseline-post-handoff -- service-census --json)"
printf '%s\n' "$A_PRE_ENTRY_SERVICE_CENSUS_JSON" | jq -e '
  keys == ["censusHash","dashboard","missionControl","openClaw","schema","spawner"] and
  .schema == "setfarm.internal-production-service-census.v1" and
  .spawner.processOwnerCount == 1 and .spawner.listener == null and
  .dashboard.processOwnerCount == 1 and .dashboard.listenerOwnerCount == 1 and
  .dashboard.listener.host == "127.0.0.1" and .dashboard.listener.port == 3333 and
  .missionControl.processOwnerCount == 1 and .missionControl.listenerOwnerCount == 1 and
  .missionControl.listener.host == "127.0.0.1" and .missionControl.listener.port == 3080 and
  .openClaw.processOwnerCount == 1 and .openClaw.listenerOwnerCount == 1 and
  .openClaw.listener.host == "127.0.0.1" and .openClaw.listener.port == 18789 and
  .openClaw.loadedSourceSha == null and .openClaw.loadedTreeHash == null and
  .openClaw.loadedBuildHash == null and
  (.censusHash | test("^[0-9a-f]{64}$"))
' >/dev/null
A_PRE_ENTRY_DASHBOARD_PID="$(printf '%s\n' "$A_PRE_ENTRY_SERVICE_CENSUS_JSON" | jq -er '.dashboard.pid')"
A_PRE_ENTRY_MC_PID="$(printf '%s\n' "$A_PRE_ENTRY_SERVICE_CENSUS_JSON" | jq -er '.missionControl.pid')"
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
  --arg pendingRef "$A_PENDING_SUCCESSOR_REF" --arg pendingHash "$A_PENDING_SUCCESSOR_HASH" \
  --arg controllerSha "$SETFARM_ROOT_EXPECTED_SHA" \
  --argjson preEntryCensus "$A_PRE_ENTRY_SERVICE_CENSUS_JSON" '
  def sameProcess($authority; $census):
    $authority.pid == $census.pid and
    $authority.processStartTimeEpochMs == $census.processStartTimeEpochMs and
    $authority.processIdentityHash == $census.processIdentityHash and
    $authority.serviceIdentityHash == $census.serviceIdentityHash and
    $authority.generationHash == $census.generationHash and
    $authority.processOwnerCount == $census.processOwnerCount;
  def sameLoadedSource($authority; $census):
    $authority.loadedSourceSha == $census.loadedSourceSha and
    $authority.loadedTreeHash == $census.loadedTreeHash and
    $authority.loadedBuildHash == $census.loadedBuildHash;
  def sameListener($authority; $census):
    $authority.listenerOwnerCount == $census.listenerOwnerCount and
    $authority.listener.host == $census.listener.host and
    $authority.listener.port == $census.listener.port and
    $authority.listener.listenerIdentityHash == $census.listener.listenerIdentityHash;
  keys == ["authorityV3Migration31Audit","blockedReason","canaryRunningPhase",
    "controllerSourceAuthority","entryAuthority","manifestActivation",
    "migrationApplyingPhase","operationHash","operationRef",
    "pendingBootstrapHandoffMigration","preMutationLoadedRuntimeServiceAuthority",
    "preMutationLoadedRuntimeServiceAuthorityHash",
    "preMutationLoadedRuntimeServiceAuthorityRef","preSchemaSpawnerRebindStatus",
    "preSchemaSpawnerRebindStatusBody",
    "productBuildAuthorityV2DeliveryEvidence","schema","settledPhase",
    "spawnerAdmissionTransitionPhase","state","statusHash","statusRef"] and
  .schema == "setfarm.internal-production-current-entry-authority-status.v1" and
  .state == "operation_prepared" and
  .operationRef == $operationRef and .operationHash == $operationHash and
  .controllerSourceAuthority.controllerSourceSha == $controllerSha and
  (.controllerSourceAuthority.controllerTreeHash | test("^[0-9a-f]{40}([0-9a-f]{24})?$")) and
  (.controllerSourceAuthority.controllerBuildHash | test("^[0-9a-f]{64}$")) and
  .productBuildAuthorityV2DeliveryEvidence.deliveryEvidenceRef == $pbaRef and
  .productBuildAuthorityV2DeliveryEvidence.deliveryEvidenceHash == $pbaHash and
  .authorityV3Migration31Audit.authorityV3Migration31AuditRef == $v31Ref and
  .authorityV3Migration31Audit.authorityV3Migration31AuditHash == $v31Hash and
  .pendingBootstrapHandoffMigration.pendingBootstrapHandoffMigrationRef == $pendingRef and
  .pendingBootstrapHandoffMigration.pendingBootstrapHandoffMigrationHash == $pendingHash and
  (.preMutationLoadedRuntimeServiceAuthorityRef | startswith("setfarm://internal-production/")) and
  (.preMutationLoadedRuntimeServiceAuthorityHash | test("^[0-9a-f]{64}$")) and
  .preMutationLoadedRuntimeServiceAuthority.schema ==
    "setfarm.internal-production-pre-mutation-loaded-runtime-service-authority.v1" and
  .preMutationLoadedRuntimeServiceAuthority.currentEntryOperationRef == $operationRef and
  .preMutationLoadedRuntimeServiceAuthority.currentEntryOperationHash == $operationHash and
  .preMutationLoadedRuntimeServiceAuthority.observedServiceCensusHash ==
    $preEntryCensus.censusHash and
  sameProcess(.preMutationLoadedRuntimeServiceAuthority.spawner; $preEntryCensus.spawner) and
  sameLoadedSource(.preMutationLoadedRuntimeServiceAuthority.spawner; $preEntryCensus.spawner) and
  .preMutationLoadedRuntimeServiceAuthority.spawner.listener == null and
  sameProcess(.preMutationLoadedRuntimeServiceAuthority.dashboard; $preEntryCensus.dashboard) and
  sameLoadedSource(.preMutationLoadedRuntimeServiceAuthority.dashboard; $preEntryCensus.dashboard) and
  sameListener(.preMutationLoadedRuntimeServiceAuthority.dashboard; $preEntryCensus.dashboard) and
  sameProcess(.preMutationLoadedRuntimeServiceAuthority.missionControl; $preEntryCensus.missionControl) and
  sameLoadedSource(.preMutationLoadedRuntimeServiceAuthority.missionControl; $preEntryCensus.missionControl) and
  sameListener(.preMutationLoadedRuntimeServiceAuthority.missionControl; $preEntryCensus.missionControl) and
  sameProcess(.preMutationLoadedRuntimeServiceAuthority.openClaw; $preEntryCensus.openClaw) and
  sameLoadedSource(.preMutationLoadedRuntimeServiceAuthority.openClaw; $preEntryCensus.openClaw) and
  sameListener(.preMutationLoadedRuntimeServiceAuthority.openClaw; $preEntryCensus.openClaw) and
  (.preMutationLoadedRuntimeServiceAuthority.serviceProjectionSetHash |
    test("^[0-9a-f]{64}$")) and
  .preMutationLoadedRuntimeServiceAuthority.preMutationLoadedRuntimeServiceAuthorityRef ==
    .preMutationLoadedRuntimeServiceAuthorityRef and
  .preMutationLoadedRuntimeServiceAuthority.preMutationLoadedRuntimeServiceAuthorityHash ==
    .preMutationLoadedRuntimeServiceAuthorityHash and
  .preSchemaSpawnerRebindStatus == null and
  .preSchemaSpawnerRebindStatusBody == null and .migrationApplyingPhase == null and
  .manifestActivation == null and .spawnerAdmissionTransitionPhase == null and
  .canaryRunningPhase == null and .settledPhase == null and .entryAuthority == null and
  .blockedReason == null and
  (.statusRef | startswith("setfarm://internal-production/")) and
  (.statusHash | test("^[0-9a-f]{64}$"))
' >/dev/null
```

Expected: read-only PBA/v31/pending/source prerequisites and the adjacent exact named-field four-service census are captured before `prepare-current-entry`. Prepare publishes the operation, then the operation-bound pre-mutation loaded-runtime authority and `operation_prepared` status before the first live mutation. The one strict status body contains those four nested prerequisite authorities, direct pre-mutation pair plus resolved body, and no flattened mirrors. Its four named projections equal the census's shared named identity/count fields, `observedServiceCensusHash` equals `censusHash`, and every later phase is null. This step invokes no resume, restart, migration, activation, guard, run, or other live mutation.

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
A_CURRENT_ENTRY_PRE_RESUME_OPERATION_REF="$(printf '%s\n' "$A_CURRENT_ENTRY_PRE_RESUME_STATUS_JSON" | jq -er '.operationRef')"
A_CURRENT_ENTRY_PRE_RESUME_OPERATION_HASH="$(printf '%s\n' "$A_CURRENT_ENTRY_PRE_RESUME_STATUS_JSON" | jq -er '.operationHash')"
A_PRE_MUTATION_RUNTIME_AUTHORITY_REF="$(printf '%s\n' "$A_CURRENT_ENTRY_PRE_RESUME_STATUS_JSON" | jq -er '.preMutationLoadedRuntimeServiceAuthorityRef')"
A_PRE_MUTATION_RUNTIME_AUTHORITY_HASH="$(printf '%s\n' "$A_CURRENT_ENTRY_PRE_RESUME_STATUS_JSON" | jq -er '.preMutationLoadedRuntimeServiceAuthorityHash')"
A_PRE_RESUME_CONTROLLER_SOURCE_SHA="$(printf '%s\n' "$A_CURRENT_ENTRY_PRE_RESUME_STATUS_JSON" | jq -er '.controllerSourceAuthority.controllerSourceSha')"
A_PRE_RESUME_CONTROLLER_TREE_HASH="$(printf '%s\n' "$A_CURRENT_ENTRY_PRE_RESUME_STATUS_JSON" | jq -er '.controllerSourceAuthority.controllerTreeHash')"
A_PRE_RESUME_CONTROLLER_BUILD_HASH="$(printf '%s\n' "$A_CURRENT_ENTRY_PRE_RESUME_STATUS_JSON" | jq -er '.controllerSourceAuthority.controllerBuildHash')"
A_PRE_RESUME_PBA_REF="$(printf '%s\n' "$A_CURRENT_ENTRY_PRE_RESUME_STATUS_JSON" | jq -er '.productBuildAuthorityV2DeliveryEvidence.deliveryEvidenceRef')"
A_PRE_RESUME_PBA_HASH="$(printf '%s\n' "$A_CURRENT_ENTRY_PRE_RESUME_STATUS_JSON" | jq -er '.productBuildAuthorityV2DeliveryEvidence.deliveryEvidenceHash')"
A_PRE_RESUME_V31_REF="$(printf '%s\n' "$A_CURRENT_ENTRY_PRE_RESUME_STATUS_JSON" | jq -er '.authorityV3Migration31Audit.authorityV3Migration31AuditRef')"
A_PRE_RESUME_V31_HASH="$(printf '%s\n' "$A_CURRENT_ENTRY_PRE_RESUME_STATUS_JSON" | jq -er '.authorityV3Migration31Audit.authorityV3Migration31AuditHash')"
A_PRE_RESUME_PENDING_REF="$(printf '%s\n' "$A_CURRENT_ENTRY_PRE_RESUME_STATUS_JSON" | jq -er '.pendingBootstrapHandoffMigration.pendingBootstrapHandoffMigrationRef')"
A_PRE_RESUME_PENDING_HASH="$(printf '%s\n' "$A_CURRENT_ENTRY_PRE_RESUME_STATUS_JSON" | jq -er '.pendingBootstrapHandoffMigration.pendingBootstrapHandoffMigrationHash')"
printf '%s\n' "$A_CURRENT_ENTRY_PRE_RESUME_STATUS_JSON" | jq -e \
  --arg controllerSha "$SETFARM_ROOT_EXPECTED_SHA" '
  def exactRefHash($ref; $hash; $domain):
    ($hash | type == "string" and test("^[0-9a-f]{64}$")) and
    $ref == ($domain + $hash);
  def exactPair($value; $refKey; $hashKey; $domain):
    ($value | type == "object") and
    (($value | keys) == ([$refKey,$hashKey] | sort)) and
    exactRefHash($value[$refKey]; $value[$hashKey]; $domain);
  def exactRebindBody:
    .preSchemaSpawnerRebindStatus as $pair |
    .preSchemaSpawnerRebindStatusBody as $body |
    exactPair($pair; "statusRef"; "statusHash";
      "setfarm://internal-production/pre-schema-spawner-rebind-status/sha256/") and
    ($body | type == "object") and
    ($body | keys == ["admissionReady","authorization","currentEntryOperation",
      "dispatchPrefix","refusalCode","restartAuthority","schema",
      "sealedAdmission","startupToken","state","statusHash","statusRef"]) and
    $body.schema == "setfarm.internal-production-pre-schema-spawner-rebind-status.v1" and
    $body.statusRef == $pair.statusRef and $body.statusHash == $pair.statusHash and
    exactPair($body.currentEntryOperation; "operationRef"; "operationHash";
      "setfarm://internal-production/current-entry-operation/sha256/") and
    $body.currentEntryOperation.operationRef == .operationRef and
    $body.currentEntryOperation.operationHash == .operationHash and
    exactPair($body.authorization; "authorizationRef"; "authorizationHash";
      "setfarm://internal-production/pre-schema-spawner-rebind-authorization/sha256/") and
    $body.refusalCode == null and
    (if $body.state == "prepared" then
       $body.startupToken == null and
       $body.restartAuthority == null and $body.dispatchPrefix == null and
       $body.sealedAdmission == null and $body.admissionReady == null
     elif $body.state == "startup_token_published" then
       exactPair($body.startupToken; "startupTokenRef"; "startupTokenHash";
         "setfarm://internal-production/pre-schema-spawner-startup-token/sha256/") and
       $body.restartAuthority == null and $body.dispatchPrefix == null and
       $body.sealedAdmission == null and $body.admissionReady == null
     elif $body.state == "dispatching" then
       exactPair($body.startupToken; "startupTokenRef"; "startupTokenHash";
         "setfarm://internal-production/pre-schema-spawner-startup-token/sha256/") and
       exactPair($body.restartAuthority; "restartAuthorityRef"; "restartAuthorityHash";
         "setfarm://internal-production/pre-schema-spawner-restart-authority/sha256/") and
       ($body.dispatchPrefix | keys == ["phase","predecessorTerminationObservation",
         "replacementProcessObservation"]) and
       $body.sealedAdmission == null and $body.admissionReady == null and
       (if $body.dispatchPrefix.phase == "restart_authority_published" then
          $body.dispatchPrefix.predecessorTerminationObservation == null and
          $body.dispatchPrefix.replacementProcessObservation == null
        elif $body.dispatchPrefix.phase == "predecessor_terminated" then
          exactPair($body.dispatchPrefix.predecessorTerminationObservation;
            "predecessorTerminationObservationRef"; "predecessorTerminationObservationHash";
            "setfarm://internal-production/pre-schema-spawner-predecessor-termination-observation/sha256/") and
          $body.dispatchPrefix.replacementProcessObservation == null
        elif $body.dispatchPrefix.phase == "replacement_observed" then
          exactPair($body.dispatchPrefix.predecessorTerminationObservation;
            "predecessorTerminationObservationRef"; "predecessorTerminationObservationHash";
            "setfarm://internal-production/pre-schema-spawner-predecessor-termination-observation/sha256/") and
          exactPair($body.dispatchPrefix.replacementProcessObservation;
            "replacementProcessObservationRef"; "replacementProcessObservationHash";
            "setfarm://internal-production/pre-schema-spawner-replacement-process-observation/sha256/")
        else false end)
     elif $body.state == "pre_manifest_bootstrap_sealed" or
          $body.state == "normal_task0_admission_ready" then
       exactPair($body.startupToken; "startupTokenRef"; "startupTokenHash";
         "setfarm://internal-production/pre-schema-spawner-startup-token/sha256/") and
       exactPair($body.restartAuthority; "restartAuthorityRef"; "restartAuthorityHash";
         "setfarm://internal-production/pre-schema-spawner-restart-authority/sha256/") and
       ($body.dispatchPrefix | keys == ["phase","predecessorTerminationObservation",
         "replacementProcessObservation"]) and
       $body.dispatchPrefix.phase == "replacement_observed" and
       exactPair($body.dispatchPrefix.predecessorTerminationObservation;
         "predecessorTerminationObservationRef"; "predecessorTerminationObservationHash";
         "setfarm://internal-production/pre-schema-spawner-predecessor-termination-observation/sha256/") and
       exactPair($body.dispatchPrefix.replacementProcessObservation;
         "replacementProcessObservationRef"; "replacementProcessObservationHash";
         "setfarm://internal-production/pre-schema-spawner-replacement-process-observation/sha256/") and
       exactPair($body.sealedAdmission; "sealedAdmissionRef"; "sealedAdmissionHash";
         "setfarm://internal-production/pre-schema-spawner-sealed-admission/sha256/") and
       (if $body.state == "pre_manifest_bootstrap_sealed" then $body.admissionReady == null
        else exactPair($body.admissionReady; "admissionReadyRef"; "admissionReadyHash";
          "setfarm://internal-production/task0-spawner-admission-ready/sha256/") end)
     else false end) and
    (if .state == "pre_schema_spawner_rebinding" then
       ($body.state == "prepared" or $body.state == "startup_token_published" or
        $body.state == "dispatching")
     elif .state == "pre_manifest_bootstrap_sealed" or .state == "migration_applying" or
          .state == "manifest_activating" then
       $body.state == "pre_manifest_bootstrap_sealed"
     elif .state == "spawner_admission_transitioning" then
       (if .spawnerAdmissionTransitionPhase.phase == "sealed" then
          $body.state == "pre_manifest_bootstrap_sealed"
        else $body.state == "normal_task0_admission_ready" end)
     else $body.state == "normal_task0_admission_ready" end);
  def exactTopLevelPhase:
    if .state == "operation_prepared" then
  .preSchemaSpawnerRebindStatus == null and
  .preSchemaSpawnerRebindStatusBody == null and .migrationApplyingPhase == null and
      .manifestActivation == null and .spawnerAdmissionTransitionPhase == null and
      .canaryRunningPhase == null and .settledPhase == null and .entryAuthority == null
    elif .state == "pre_schema_spawner_rebinding" or
         .state == "pre_manifest_bootstrap_sealed" then
      exactRebindBody and
      .migrationApplyingPhase == null and .manifestActivation == null and
      .spawnerAdmissionTransitionPhase == null and .canaryRunningPhase == null and
      .settledPhase == null and .entryAuthority == null
    elif .state == "migration_applying" then
      exactRebindBody and
      (.migrationApplyingPhase | type == "object") and .manifestActivation == null and
      .spawnerAdmissionTransitionPhase == null and .canaryRunningPhase == null and
      .settledPhase == null and .entryAuthority == null
    elif .state == "manifest_activating" then
      exactRebindBody and
      .migrationApplyingPhase.phase == "current_audited" and
      .manifestActivation == null and .spawnerAdmissionTransitionPhase == null and
      .canaryRunningPhase == null and .settledPhase == null and .entryAuthority == null
    elif .state == "spawner_admission_transitioning" then
      exactRebindBody and
      .migrationApplyingPhase.phase == "current_audited" and
      (.manifestActivation | type == "object") and
      (.spawnerAdmissionTransitionPhase | type == "object") and
      .canaryRunningPhase == null and .settledPhase == null and .entryAuthority == null
    elif .state == "prepared" then
      exactRebindBody and
      .migrationApplyingPhase.phase == "current_audited" and
      (.manifestActivation | type == "object") and
      .spawnerAdmissionTransitionPhase.phase == "runtime_observed" and
      .canaryRunningPhase == null and .settledPhase == null and .entryAuthority == null
    elif .state == "canary_running" then
      exactRebindBody and
      .migrationApplyingPhase.phase == "current_audited" and
      (.manifestActivation | type == "object") and
      .spawnerAdmissionTransitionPhase.phase == "runtime_observed" and
      (.canaryRunningPhase | type == "object") and
      .settledPhase == null and .entryAuthority == null
    elif .state == "settled" then
      exactRebindBody and
      .migrationApplyingPhase.phase == "current_audited" and
      (.manifestActivation | type == "object") and
      .spawnerAdmissionTransitionPhase.phase == "runtime_observed" and
      .canaryRunningPhase.phase == "terminal_settlement_published" and
      (.settledPhase | type == "object") and .entryAuthority == null
    elif .state == "ready" then
      exactRebindBody and
      .migrationApplyingPhase.phase == "current_audited" and
      (.manifestActivation | type == "object") and
      .spawnerAdmissionTransitionPhase.phase == "runtime_observed" and
      .canaryRunningPhase.phase == "terminal_settlement_published" and
      .settledPhase.phase == "fence_released" and
      (.entryAuthority | type == "object")
    else false end;
  exactTopLevelPhase and
  keys == ["authorityV3Migration31Audit","blockedReason","canaryRunningPhase",
    "controllerSourceAuthority","entryAuthority","manifestActivation",
    "migrationApplyingPhase","operationHash","operationRef",
    "pendingBootstrapHandoffMigration","preMutationLoadedRuntimeServiceAuthority",
    "preMutationLoadedRuntimeServiceAuthorityHash",
    "preMutationLoadedRuntimeServiceAuthorityRef","preSchemaSpawnerRebindStatus",
    "preSchemaSpawnerRebindStatusBody",
    "productBuildAuthorityV2DeliveryEvidence","schema","settledPhase",
    "spawnerAdmissionTransitionPhase","state","statusHash","statusRef"] and
  .schema == "setfarm.internal-production-current-entry-authority-status.v1" and
  exactRefHash(.operationRef; .operationHash;
    "setfarm://internal-production/current-entry-operation/sha256/") and
  .controllerSourceAuthority.controllerSourceSha == $controllerSha and
  (.controllerSourceAuthority.controllerTreeHash | test("^[0-9a-f]{40}([0-9a-f]{24})?$")) and
  (.controllerSourceAuthority.controllerBuildHash | test("^[0-9a-f]{64}$")) and
  exactPair(.productBuildAuthorityV2DeliveryEvidence; "deliveryEvidenceRef";
    "deliveryEvidenceHash";
    "mission-control://internal-production/product-build-authority-v2-delivery-evidence/sha256/") and
  exactPair(.authorityV3Migration31Audit; "authorityV3Migration31AuditRef";
    "authorityV3Migration31AuditHash";
    "setfarm://internal-production/authority-v3-migration31-audit/sha256/") and
  exactPair(.pendingBootstrapHandoffMigration; "pendingBootstrapHandoffMigrationRef";
    "pendingBootstrapHandoffMigrationHash";
    "setfarm://internal-production/pending-bootstrap-handoff-migration/sha256/") and
  exactRefHash(.preMutationLoadedRuntimeServiceAuthorityRef;
    .preMutationLoadedRuntimeServiceAuthorityHash;
    "setfarm://internal-production/pre-mutation-loaded-runtime-service-authority/sha256/") and
  .preMutationLoadedRuntimeServiceAuthority.currentEntryOperationRef == .operationRef and
  .preMutationLoadedRuntimeServiceAuthority.currentEntryOperationHash == .operationHash and
  .preMutationLoadedRuntimeServiceAuthority.preMutationLoadedRuntimeServiceAuthorityRef ==
    .preMutationLoadedRuntimeServiceAuthorityRef and
  .preMutationLoadedRuntimeServiceAuthority.preMutationLoadedRuntimeServiceAuthorityHash ==
    .preMutationLoadedRuntimeServiceAuthorityHash and
  exactRefHash(.statusRef; .statusHash;
    "setfarm://internal-production/current-entry-authority-status/sha256/") and
  .blockedReason == null and
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
  .state != "blocked" and
  (.migrationApplyingPhase == null or
    ((.migrationApplyingPhase.phase == "prepared" and
      .migrationApplyingPhase.consumption == null and
      .migrationApplyingPhase.migrationReceipt == null and
      .migrationApplyingPhase.currentAudit == null) or
     (.migrationApplyingPhase.phase == "consumed" and
      .migrationApplyingPhase.consumption != null and
      .migrationApplyingPhase.migrationReceipt == null and
      .migrationApplyingPhase.currentAudit == null) or
     (.migrationApplyingPhase.phase == "receipt_published" and
      .migrationApplyingPhase.consumption != null and
      .migrationApplyingPhase.migrationReceipt != null and
      .migrationApplyingPhase.currentAudit == null) or
     (.migrationApplyingPhase.phase == "current_audited" and
      .migrationApplyingPhase.consumption != null and
      .migrationApplyingPhase.migrationReceipt != null and
      .migrationApplyingPhase.currentAudit != null))) and
  (.spawnerAdmissionTransitionPhase == null or
    ((.spawnerAdmissionTransitionPhase.phase == "sealed" and
      .spawnerAdmissionTransitionPhase.admissionReady == null and
      .spawnerAdmissionTransitionPhase.loadedRuntimeServiceAuthority == null) or
     (.spawnerAdmissionTransitionPhase.phase == "admission_ready" and
      .spawnerAdmissionTransitionPhase.admissionReady != null and
      .spawnerAdmissionTransitionPhase.loadedRuntimeServiceAuthority == null) or
     (.spawnerAdmissionTransitionPhase.phase == "runtime_observed" and
      .spawnerAdmissionTransitionPhase.admissionReady != null and
      .spawnerAdmissionTransitionPhase.loadedRuntimeServiceAuthority != null))) and
  (.canaryRunningPhase == null or
    ((.canaryRunningPhase.phase == "running" and
      .canaryRunningPhase.terminalSettlementRef == null and
      .canaryRunningPhase.targetCloseRef == null) or
     (.canaryRunningPhase.phase == "terminal_settlement_published" and
      .canaryRunningPhase.terminalSettlementRef != null and
      .canaryRunningPhase.targetCloseRef == null))) and
  (.settledPhase == null or
    ((.settledPhase.phase == "target_closed" and
      .settledPhase.ownerAdmissionFenceReleaseRef == null and
      .settledPhase.entryAuthorityRef == null) or
     (.settledPhase.phase == "fence_released" and
      .settledPhase.ownerAdmissionFenceReleaseRef != null and
      .settledPhase.entryAuthorityRef == null)))
' >/dev/null
npm --prefix "$SETFARM_ROOT" run --silent acceptance:baseline-post-handoff -- resume-current-entry --json >/dev/null
require_authenticated_clean_main_setfarm_root_v1
A_CURRENT_ENTRY_STATUS_JSON="$(npm --prefix "$SETFARM_ROOT" run --silent acceptance:baseline-post-handoff -- current-entry-status --json)"
printf '%s\n' "$A_CURRENT_ENTRY_STATUS_JSON" | jq -e \
  --arg operationRef "$A_CURRENT_ENTRY_PRE_RESUME_OPERATION_REF" --arg operationHash "$A_CURRENT_ENTRY_PRE_RESUME_OPERATION_HASH" \
  --arg preMutationRuntimeRef "$A_PRE_MUTATION_RUNTIME_AUTHORITY_REF" --arg preMutationRuntimeHash "$A_PRE_MUTATION_RUNTIME_AUTHORITY_HASH" \
  --arg controllerSha "$A_PRE_RESUME_CONTROLLER_SOURCE_SHA" \
  --arg controllerTree "$A_PRE_RESUME_CONTROLLER_TREE_HASH" \
  --arg controllerBuild "$A_PRE_RESUME_CONTROLLER_BUILD_HASH" \
  --arg pbaRef "$A_PRE_RESUME_PBA_REF" --arg pbaHash "$A_PRE_RESUME_PBA_HASH" \
  --arg v31Ref "$A_PRE_RESUME_V31_REF" --arg v31Hash "$A_PRE_RESUME_V31_HASH" \
  --arg pendingRef "$A_PRE_RESUME_PENDING_REF" --arg pendingHash "$A_PRE_RESUME_PENDING_HASH" '
  def exactRefHash($ref; $hash; $domain):
    ($hash | type == "string" and test("^[0-9a-f]{64}$")) and
    $ref == ($domain + $hash);
  def exactPair($value; $refKey; $hashKey; $domain):
    ($value | type == "object") and
    (($value | keys) == ([$refKey,$hashKey] | sort)) and
    exactRefHash($value[$refKey]; $value[$hashKey]; $domain);
  def exactReadyRebind:
    .preSchemaSpawnerRebindStatus as $pair |
    .preSchemaSpawnerRebindStatusBody as $body |
    exactPair($pair; "statusRef"; "statusHash";
      "setfarm://internal-production/pre-schema-spawner-rebind-status/sha256/") and
    ($body | keys == ["admissionReady","authorization","currentEntryOperation",
      "dispatchPrefix","refusalCode","restartAuthority","schema",
      "sealedAdmission","startupToken","state","statusHash","statusRef"]) and
    $body.schema == "setfarm.internal-production-pre-schema-spawner-rebind-status.v1" and
    $body.state == "normal_task0_admission_ready" and
    $body.statusRef == $pair.statusRef and $body.statusHash == $pair.statusHash and
    exactPair($body.currentEntryOperation; "operationRef"; "operationHash";
      "setfarm://internal-production/current-entry-operation/sha256/") and
    $body.currentEntryOperation.operationRef == $operationRef and
    $body.currentEntryOperation.operationHash == $operationHash and
    exactPair($body.authorization; "authorizationRef"; "authorizationHash";
      "setfarm://internal-production/pre-schema-spawner-rebind-authorization/sha256/") and
    exactPair($body.startupToken; "startupTokenRef"; "startupTokenHash";
      "setfarm://internal-production/pre-schema-spawner-startup-token/sha256/") and
    exactPair($body.restartAuthority; "restartAuthorityRef"; "restartAuthorityHash";
      "setfarm://internal-production/pre-schema-spawner-restart-authority/sha256/") and
    ($body.dispatchPrefix | keys == ["phase","predecessorTerminationObservation",
      "replacementProcessObservation"]) and
    $body.dispatchPrefix.phase == "replacement_observed" and
    exactPair($body.dispatchPrefix.predecessorTerminationObservation;
      "predecessorTerminationObservationRef"; "predecessorTerminationObservationHash";
      "setfarm://internal-production/pre-schema-spawner-predecessor-termination-observation/sha256/") and
    exactPair($body.dispatchPrefix.replacementProcessObservation;
      "replacementProcessObservationRef"; "replacementProcessObservationHash";
      "setfarm://internal-production/pre-schema-spawner-replacement-process-observation/sha256/") and
    exactPair($body.sealedAdmission; "sealedAdmissionRef"; "sealedAdmissionHash";
      "setfarm://internal-production/pre-schema-spawner-sealed-admission/sha256/") and
    exactPair($body.admissionReady; "admissionReadyRef"; "admissionReadyHash";
      "setfarm://internal-production/task0-spawner-admission-ready/sha256/") and
    $body.refusalCode == null;
  keys == ["authorityV3Migration31Audit","blockedReason","canaryRunningPhase",
    "controllerSourceAuthority","entryAuthority","manifestActivation",
    "migrationApplyingPhase","operationHash","operationRef",
    "pendingBootstrapHandoffMigration","preMutationLoadedRuntimeServiceAuthority",
    "preMutationLoadedRuntimeServiceAuthorityHash",
    "preMutationLoadedRuntimeServiceAuthorityRef","preSchemaSpawnerRebindStatus",
    "preSchemaSpawnerRebindStatusBody",
    "productBuildAuthorityV2DeliveryEvidence","schema","settledPhase",
    "spawnerAdmissionTransitionPhase","state","statusHash","statusRef"] and
  .schema == "setfarm.internal-production-current-entry-authority-status.v1" and
  .state == "ready" and
  exactRefHash(.operationRef; .operationHash;
    "setfarm://internal-production/current-entry-operation/sha256/") and
  .operationRef == $operationRef and .operationHash == $operationHash and
  .preMutationLoadedRuntimeServiceAuthorityRef == $preMutationRuntimeRef and
  .preMutationLoadedRuntimeServiceAuthorityHash == $preMutationRuntimeHash and
  .preMutationLoadedRuntimeServiceAuthority.currentEntryOperationRef == $operationRef and
  .preMutationLoadedRuntimeServiceAuthority.currentEntryOperationHash == $operationHash and
  .preMutationLoadedRuntimeServiceAuthority.preMutationLoadedRuntimeServiceAuthorityRef ==
    $preMutationRuntimeRef and
  .preMutationLoadedRuntimeServiceAuthority.preMutationLoadedRuntimeServiceAuthorityHash ==
    $preMutationRuntimeHash and
  .preMutationLoadedRuntimeServiceAuthority.spawner.processOwnerCount == 1 and
  .preMutationLoadedRuntimeServiceAuthority.spawner.listener == null and
  .preMutationLoadedRuntimeServiceAuthority.dashboard.processOwnerCount == 1 and
  .preMutationLoadedRuntimeServiceAuthority.dashboard.listenerOwnerCount == 1 and
  .preMutationLoadedRuntimeServiceAuthority.missionControl.processOwnerCount == 1 and
  .preMutationLoadedRuntimeServiceAuthority.missionControl.listenerOwnerCount == 1 and
  .preMutationLoadedRuntimeServiceAuthority.openClaw.processOwnerCount == 1 and
  .preMutationLoadedRuntimeServiceAuthority.openClaw.listenerOwnerCount == 1 and
  .preMutationLoadedRuntimeServiceAuthority.openClaw.loadedSourceSha == null and
  .preMutationLoadedRuntimeServiceAuthority.openClaw.loadedTreeHash == null and
  .preMutationLoadedRuntimeServiceAuthority.openClaw.loadedBuildHash == null and
  exactReadyRebind and
  .controllerSourceAuthority.controllerSourceSha == $controllerSha and
  .controllerSourceAuthority.controllerTreeHash == $controllerTree and
  .controllerSourceAuthority.controllerBuildHash == $controllerBuild and
  .productBuildAuthorityV2DeliveryEvidence.deliveryEvidenceRef == $pbaRef and
  .productBuildAuthorityV2DeliveryEvidence.deliveryEvidenceHash == $pbaHash and
  .authorityV3Migration31Audit.authorityV3Migration31AuditRef == $v31Ref and
  .authorityV3Migration31Audit.authorityV3Migration31AuditHash == $v31Hash and
  .pendingBootstrapHandoffMigration.pendingBootstrapHandoffMigrationRef == $pendingRef and
  .pendingBootstrapHandoffMigration.pendingBootstrapHandoffMigrationHash == $pendingHash and
  .migrationApplyingPhase.phase == "current_audited" and
  exactPair(.migrationApplyingPhase.authorization; "authorizationRef";
    "authorizationHash";
    "setfarm://internal-production/pre-manifest-migration32-authorization/sha256/") and
  exactPair(.migrationApplyingPhase.consumption; "consumptionRef"; "consumptionHash";
    "setfarm://internal-production/pre-manifest-migration32-authorization-consumption/sha256/") and
  exactPair(.migrationApplyingPhase.migrationReceipt; "migrationReceiptRef";
    "migrationReceiptHash";
    "setfarm://internal-production/baseline-bootstrap-handoff-migration-receipt/sha256/") and
  exactPair(.migrationApplyingPhase.currentAudit; "bootstrapHandoffCurrentAuditRef";
    "bootstrapHandoffCurrentAuditHash";
    "setfarm://internal-production/bootstrap-handoff-current-audit/sha256/") and
  (.manifestActivation | keys == ["ownerProducerManifestActivationHash",
    "ownerProducerManifestActivationRef","ownerProducerManifestHeadHash",
    "ownerProducerManifestHeadRef"]) and
  exactRefHash(.manifestActivation.ownerProducerManifestActivationRef;
    .manifestActivation.ownerProducerManifestActivationHash;
    "setfarm://internal-production/owner-producer-manifest-set-activation/sha256/") and
  exactRefHash(.manifestActivation.ownerProducerManifestHeadRef;
    .manifestActivation.ownerProducerManifestHeadHash;
    "setfarm://internal-production/owner-producer-manifest-set-activation-head/sha256/") and
  .spawnerAdmissionTransitionPhase.phase == "runtime_observed" and
  exactPair(.spawnerAdmissionTransitionPhase.sealedAdmission; "sealedAdmissionRef";
    "sealedAdmissionHash";
    "setfarm://internal-production/pre-schema-spawner-sealed-admission/sha256/") and
  exactPair(.spawnerAdmissionTransitionPhase.admissionReady; "admissionReadyRef";
    "admissionReadyHash";
    "setfarm://internal-production/task0-spawner-admission-ready/sha256/") and
  exactPair(.spawnerAdmissionTransitionPhase.loadedRuntimeServiceAuthority;
    "loadedRuntimeServiceAuthorityRef"; "loadedRuntimeServiceAuthorityHash";
    "setfarm://internal-production/loaded-runtime-service-authority/sha256/") and
  .canaryRunningPhase.phase == "terminal_settlement_published" and
  exactRefHash(.canaryRunningPhase.ownerAdmissionFenceRef;
    .canaryRunningPhase.ownerAdmissionFenceHash;
    "setfarm://internal-production/global-owner-admission-fence/sha256/") and
  exactRefHash(.canaryRunningPhase.sourceRunTargetReservationRef;
    .canaryRunningPhase.sourceRunTargetReservationHash;
    "setfarm://internal-production/source-run-target-reservation/sha256/") and
  exactRefHash(.canaryRunningPhase.runTargetReservationRef;
    .canaryRunningPhase.runTargetReservationHash;
    "setfarm://internal-production/run-target-reservation/sha256/") and
  exactRefHash(.canaryRunningPhase.terminalSettlementRef;
    .canaryRunningPhase.terminalSettlementHash;
    "setfarm://internal-production/canary-terminal-settlement/sha256/") and
  .canaryRunningPhase.targetCloseRef == null and
  .canaryRunningPhase.targetCloseHash == null and
  .settledPhase.phase == "fence_released" and
  exactRefHash(.settledPhase.terminalSettlementRef;
    .settledPhase.terminalSettlementHash;
    "setfarm://internal-production/canary-terminal-settlement/sha256/") and
  exactRefHash(.settledPhase.targetCloseRef; .settledPhase.targetCloseHash;
    "setfarm://internal-production/canary-target-close/sha256/") and
  exactRefHash(.settledPhase.ownerAdmissionFenceReleaseRef;
    .settledPhase.ownerAdmissionFenceReleaseHash;
    "setfarm://internal-production/global-owner-admission-fence-release/sha256/") and
  .settledPhase.entryAuthorityRef == null and .settledPhase.entryAuthorityHash == null and
  exactPair(.entryAuthority; "entryAuthorityRef"; "entryAuthorityHash";
    "setfarm://internal-production/current-entry-authority/sha256/") and
  .blockedReason == null and
  exactRefHash(.statusRef; .statusHash;
    "setfarm://internal-production/current-entry-authority-status/sha256/")
' >/dev/null
require_authenticated_clean_main_setfarm_root_v1
A_PRE_MUTATION_DASHBOARD_PID="$(printf '%s\n' "$A_CURRENT_ENTRY_STATUS_JSON" | jq -er '.preMutationLoadedRuntimeServiceAuthority.dashboard.pid')"
A_PRE_MUTATION_MC_PID="$(printf '%s\n' "$A_CURRENT_ENTRY_STATUS_JSON" | jq -er '.preMutationLoadedRuntimeServiceAuthority.missionControl.pid')"
A_READY_SERVICE_CENSUS_JSON="$(npm --prefix "$SETFARM_ROOT" run --silent acceptance:baseline-post-handoff -- service-census --json)"
printf '%s\n' "$A_READY_SERVICE_CENSUS_JSON" | jq -e \
  --arg controllerSha "$SETFARM_ROOT_EXPECTED_SHA" \
  --argjson dashboardPid "$A_PRE_MUTATION_DASHBOARD_PID" \
  --argjson mcPid "$A_PRE_MUTATION_MC_PID" '
  keys == ["censusHash","dashboard","missionControl","openClaw","schema","spawner"] and
  .schema == "setfarm.internal-production-service-census.v1" and
  .spawner.loadedSourceSha == $controllerSha and .spawner.processOwnerCount == 1 and
  .spawner.listener == null and
  .dashboard.pid == $dashboardPid and .dashboard.processOwnerCount == 1 and
  .dashboard.listenerOwnerCount == 1 and
  .missionControl.pid == $mcPid and .missionControl.processOwnerCount == 1 and
  .missionControl.listenerOwnerCount == 1 and
  .openClaw.processOwnerCount == 1 and .openClaw.listenerOwnerCount == 1 and
  .openClaw.loadedSourceSha == null and .openClaw.loadedTreeHash == null and
  .openClaw.loadedBuildHash == null and
  (.censusHash | test("^[0-9a-f]{64}$"))
' >/dev/null
require_authenticated_clean_main_setfarm_root_v1
A_CURRENT_ENTRY_STATUS_REF="$(printf '%s\n' "$A_CURRENT_ENTRY_STATUS_JSON" | jq -er '.statusRef')"
A_CURRENT_ENTRY_STATUS_HASH="$(printf '%s\n' "$A_CURRENT_ENTRY_STATUS_JSON" | jq -er '.statusHash')"
A_CURRENT_ENTRY_AUTHORITY_REF="$(printf '%s\n' "$A_CURRENT_ENTRY_STATUS_JSON" | jq -er '.entryAuthority.entryAuthorityRef')"
A_CURRENT_ENTRY_AUTHORITY_HASH="$(printf '%s\n' "$A_CURRENT_ENTRY_STATUS_JSON" | jq -er '.entryAuthority.entryAuthorityHash')"
A_CURRENT_ENTRY_VERIFICATION_JSON="$(npm --prefix "$SETFARM_ROOT" run --silent acceptance:baseline-post-handoff -- verify-current-entry --json)"
printf '%s\n' "$A_CURRENT_ENTRY_VERIFICATION_JSON" | jq -e \
  --arg statusRef "$A_CURRENT_ENTRY_STATUS_REF" --arg statusHash "$A_CURRENT_ENTRY_STATUS_HASH" \
  --arg entryRef "$A_CURRENT_ENTRY_AUTHORITY_REF" --arg entryHash "$A_CURRENT_ENTRY_AUTHORITY_HASH" '
  keys == ["currentEntryStatus","currentEntryVerificationHash",
    "currentEntryVerificationRef","currentStatus","entryAuthority",
    "freshRuntimeAndOwnerObservation","resolvedAuthoritySetHash","schema"] and
  .schema == "setfarm.internal-production-current-entry-verification.v1" and
  .currentStatus == "current" and
  .currentEntryStatus.statusRef == $statusRef and
  .currentEntryStatus.statusHash == $statusHash and
  .entryAuthority.entryAuthorityRef == $entryRef and
  .entryAuthority.entryAuthorityHash == $entryHash and
  (.resolvedAuthoritySetHash | test("^[0-9a-f]{64}$")) and
  (.freshRuntimeAndOwnerObservation | keys ==
    ["freshRuntimeAndOwnerObservationHash",
      "freshRuntimeAndOwnerObservationRef"]) and
  (.freshRuntimeAndOwnerObservation.freshRuntimeAndOwnerObservationRef |
    startswith("setfarm://internal-production/current-entry-fresh-runtime-and-owner-observation/sha256/")) and
  (.freshRuntimeAndOwnerObservation.freshRuntimeAndOwnerObservationHash |
    test("^[0-9a-f]{64}$")) and
  (.currentEntryVerificationRef |
    startswith("setfarm://internal-production/current-entry-verification/sha256/")) and
  (.currentEntryVerificationHash | test("^[0-9a-f]{64}$"))
' >/dev/null
```

Expected: the adjacent read-only status block freshly reopens the one fixed operation, four fixed prerequisite authorities, and exact pre-mutation loaded-runtime pair/body in a valid resumable prefix; `blocked`, `absent`, a census/runtime drift, or a crossed operation fails before mutation. It validates only fields declared by the strict status union and phase-specific nullability for every resumable nested discriminant. The single zero-input `resume-current-entry` then internally consumes that fixed authority and drives or adopts it through the acyclic startup token → restart → predecessor termination/postzero → sealed admission chain, all four guarded-32 migration phases, exact ordinary-33 apply/current verification within the existing current-audited prefix, A activation, all three admission phases, both canary phases, both settled phases, and ready publication. It internally establishes the durable `prepared` admission-ready barrier before canary admission and never accepts mutation argv. A ready retry returns the byte-identical terminal without a new effect. Every crash/retry uses the same operation head, pre-mutation runtime pair, and nested phase prefix and cannot skip or overshoot an invalid boundary; migration-33 recovery uses exact journal/schema state and adds no status field. The ready status uses only nested pair fields and proves dashboard/Mission Control remain on the pre-mutation PIDs through the named service census. The zero-input verifier then resolves and authenticates all deep canary, subchain, source/runtime, and zero-owner facts internally and returns its one strict current verification pair/body; the shell does not duplicate undeclared details. Subsequent status, service census, pair resolution, and verification calls are read-only. The canary records one exact observed failure lifecycle; the separate focused-test receipt remains the proof for the complete three-code set.

Task 7 alone may consume this ready pre-rebind pair. No Task 8 or B/C/D/E action consumes it directly; those phases require Task 7's strict post-rebind successor.

---

### Task 7: Rebuild clean main, validate the applied baseline schema, and rebind all internal services safely

**Files:**

- No source edits.
- Runtime build output remains ignored/untracked.

**Interfaces:**

- Consumes: the ready pre-full-rebind `InternalProductionCurrentEntryAuthorityPairV1`, including its prepared-before-mutation operation and exact pre-mutation loaded-runtime authority pair/body, pre-schema startup token/restart/termination/postzero/sealed chain, already applied/current migration receipt/audit with immutable v31/pending causal quartet, A-manifest activation, same-generation normal-admission-ready pair, mixed loaded-runtime authority, terminal nested phase chain, canary chain, and PBA pair; merged Mission Control `main`; merged Setfarm `main`; and zero active ownership.
- Produces: no schema mutation. It read-only reopens/verifies that same migration receipt/current audit, then loads clean-main builds into the Setfarm spawner, Setfarm dashboard, and Mission Control processes with healthy HTTP endpoints and exact process/build identity evidence, and seals one strict `InternalProductionPostRebindEntryAuthorityPairV1` successor.

`InternalProductionPostRebindEntryAuthorityV1` has schema `setfarm.internal-production-post-rebind-entry-authority.v1` and exact derived pair `{postRebindEntryAuthorityRef,postRebindEntryAuthorityHash}`. It binds the predecessor current-entry pair and reopens its controller operation, pre-schema token/restart/sealed admission/postzero, admission-ready transition, mixed predecessor runtime, applied migration receipt/current audit, A-manifest activation, canary chain, and PBA pair. It binds the byte-identical migration pair again rather than creating a Task 7 migration authority; the receipt's v31/pending and pre-schema authorization chains remain causal history only. It additionally binds the live-rebind restart-sequence pair and three ordered service authority pairs; Task 7 Setfarm controller source/tree/build; Mission Control source/tree/build; post-rebind loaded-service authority; service census, runtime-source, health, and final complete zero-owner hashes. Every scoped loaded Setfarm service must equal Task 7's controller source/build and Mission Control must equal its Task 7 build; OpenClaw remains identity/health only.

Task 7 performs two independent fixed HTTP checks. First, `GET /api/internal-production/product-build-authority-v2-delivery-evidence` returns the strict delivery-evidence response whose extracted `{deliveryEvidenceRef,deliveryEvidenceHash}` and evidence body are byte-identical to the predecessor source-observed delivery pair/body. Second, `GET /api/internal-production/product-build-authority-v2-loaded-build` returns the strict startup-frozen `ProductBuildAuthorityV2LoadedBuildResponseV1`; Task 7 recomputes its `loadedBuildHash` and `loadedBuildRef`, requires `startupInstance.pid` to equal the stable Mission Control process/listener PID fence, and requires `loadedBuild.buildIdentity.{sourceSha,treeHash,buildHash}` to equal both Task 7's Mission Control source authority and the embedded predecessor delivery evidence's `currentSource.{sha,treeHash,buildHash}`. The loaded endpoint never resolves, returns, or equals a `ProductBuildAuthorityV2DeliveryEvidencePairV1`; `loadedBuildRef/loadedBuildHash` remain a distinct schema/hash domain. The resolver/current verifier reopens every dependency and reobserves both independent HTTP facts plus source/build/schema/services/zero owners without any migration writer.

`InternalProductionPostRebindEntryAuthorityStatusV1` is `absent | predecessor_ready | rebuilding | restarting | verifying | ready | blocked`; there is no `migration_applying` branch. `absent` has every predecessor/restart/service/verification/authority field null. `predecessor_ready` requires the predecessor pair plus its exact `predecessorCurrentEntryOperation`, `predecessorPreSchemaSpawnerRebindStatus`, and pair-resolved `predecessorPreSchemaSpawnerRebindStatusBody`; that body is the terminal normal-ready variant and retains the exact authorization/token/restart/dispatch/predecessor/replacement/sealed/admission pairs. It also requires the already applied migration/current audit, manifest, predecessor runtime, canary, and PBA pairs. Every later nonblocked branch retains those three nested predecessor members byte-identically. `rebuilding` adds Task 7 clean builds while post-rebind restart/service/evidence fields remain null. `restarting` adds the live-rebind sequence prefix. `verifying` adds terminal restart/service fields and scoped loaded-source/build equality while final HTTP evidence/health/zero-owner/post pair remain null. Only `ready` adds HTTP evidence equality, final verification tuple, and post-rebind pair. `blocked` preserves exactly the last valid prefix with every later field null. One expected-predecessor head makes prepare/resume/status crash-idempotent; retry never applies migration or repeats a settled restart.

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
A_TASK7_CURRENT_ENTRY_VERIFICATION_JSON="$(npm run --silent acceptance:baseline-post-handoff -- verify-current-entry --json)"
printf '%s\n' "$A_TASK7_CURRENT_ENTRY_VERIFICATION_JSON" | jq -e '
  keys == ["currentEntryStatus","currentEntryVerificationHash",
    "currentEntryVerificationRef","currentStatus","entryAuthority",
    "freshRuntimeAndOwnerObservation","resolvedAuthoritySetHash","schema"] and
  .schema == "setfarm.internal-production-current-entry-verification.v1" and
  .currentStatus == "current" and
  (.currentEntryStatus.statusRef | startswith("setfarm://internal-production/")) and
  (.currentEntryStatus.statusHash | test("^[0-9a-f]{64}$")) and
  (.entryAuthority.entryAuthorityRef | startswith("setfarm://internal-production/")) and
  (.entryAuthority.entryAuthorityHash | test("^[0-9a-f]{64}$")) and
  (.resolvedAuthoritySetHash | test("^[0-9a-f]{64}$")) and
  (.freshRuntimeAndOwnerObservation | keys ==
    ["freshRuntimeAndOwnerObservationHash",
      "freshRuntimeAndOwnerObservationRef"]) and
  (.freshRuntimeAndOwnerObservation.freshRuntimeAndOwnerObservationRef |
    startswith("setfarm://internal-production/current-entry-fresh-runtime-and-owner-observation/sha256/")) and
  (.freshRuntimeAndOwnerObservation.freshRuntimeAndOwnerObservationHash |
    test("^[0-9a-f]{64}$")) and
  (.currentEntryVerificationRef |
    startswith("setfarm://internal-production/current-entry-verification/sha256/")) and
  (.currentEntryVerificationHash | test("^[0-9a-f]{64}$"))
' >/dev/null
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

- [ ] **Step 3a: Read-only reopen the Task 6A A16 manifest activation**

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
  keys == ["blockedReason","manifestHash","predecessorActivationHash",
    "predecessorActivationRef","predecessorHeadHash","predecessorHeadRef",
    "receiptHash","receiptRef","schema","sourceBuildAuthorityHash",
    "sourceBuildAuthorityRef","state","statusHash","statusRef",
    "successorActivationHash","successorActivationRef","successorHeadHash",
    "successorHeadRef"] and
  .schema == "setfarm.internal-production-baseline-owner-producer-manifest-activation-status.v1" and
  .state == "active" and
  .predecessorActivationRef == null and .predecessorActivationHash == null and
  .predecessorHeadRef == null and .predecessorHeadHash == null and
  .receiptRef ==
    ("setfarm://internal-production/baseline-owner-producer-manifest-activation-receipt/sha256/" +
      .receiptHash) and
  (.receiptHash | test("^[0-9a-f]{64}$")) and
  .successorActivationRef ==
    ("setfarm://internal-production/owner-producer-manifest-set-activation/sha256/" +
      .successorActivationHash) and
  (.successorActivationHash | test("^[0-9a-f]{64}$")) and
  .successorHeadRef ==
    ("setfarm://internal-production/owner-producer-manifest-set-activation-head/sha256/" +
      .successorHeadHash) and
  (.successorHeadHash | test("^[0-9a-f]{64}$")) and
  (.manifestHash | test("^[0-9a-f]{64}$")) and
  .sourceBuildAuthorityRef ==
    ("setfarm://internal-production/owner-producer-source-build-authority/A/sha256/" +
      .sourceBuildAuthorityHash) and
  (.sourceBuildAuthorityHash | test("^[0-9a-f]{64}$")) and
  .blockedReason == null and
  .statusRef ==
    ("setfarm://internal-production/baseline-owner-producer-manifest-activation-status/sha256/" +
      .statusHash) and
  (.statusHash | test("^[0-9a-f]{64}$"))
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
  keys == ["blockedReason","manifestHash","predecessorActivationHash",
    "predecessorActivationRef","predecessorHeadHash","predecessorHeadRef",
    "receiptHash","receiptRef","schema","sourceBuildAuthorityHash",
    "sourceBuildAuthorityRef","state","statusHash","statusRef",
    "successorActivationHash","successorActivationRef","successorHeadHash",
    "successorHeadRef"] and
  .schema == "setfarm.internal-production-baseline-owner-producer-manifest-activation-status.v1" and
  .state == "active" and
  .predecessorActivationRef == null and .predecessorActivationHash == null and
  .predecessorHeadRef == null and .predecessorHeadHash == null and
  .receiptRef ==
    ("setfarm://internal-production/baseline-owner-producer-manifest-activation-receipt/sha256/" +
      .receiptHash) and
  (.receiptHash | test("^[0-9a-f]{64}$")) and
  .successorActivationRef ==
    ("setfarm://internal-production/owner-producer-manifest-set-activation/sha256/" +
      .successorActivationHash) and
  (.successorActivationHash | test("^[0-9a-f]{64}$")) and
  .successorHeadRef ==
    ("setfarm://internal-production/owner-producer-manifest-set-activation-head/sha256/" +
      .successorHeadHash) and
  (.successorHeadHash | test("^[0-9a-f]{64}$")) and
  (.manifestHash | test("^[0-9a-f]{64}$")) and
  .sourceBuildAuthorityRef ==
    ("setfarm://internal-production/owner-producer-source-build-authority/A/sha256/" +
      .sourceBuildAuthorityHash) and
  (.sourceBuildAuthorityHash | test("^[0-9a-f]{64}$")) and
  .blockedReason == null and
  .statusRef ==
    ("setfarm://internal-production/baseline-owner-producer-manifest-activation-status/sha256/" +
      .statusHash) and
  (.statusHash | test("^[0-9a-f]{64}$"))
' >/dev/null
```

Expected: two read-only observations reopen and re-hash the exact Task 6A A16 successor receipt/head tuple and wrapper status. Any status other than `active`, unequal pair, non-null predecessor, dirty/wrong-source-build authority, or ambiguity exits here. Task 7 performs no activation, migration, guard, source-bootstrap, or owner-admission mutation in this step.

- [ ] **Step 4: Read-only reopen and verify the Task 6A migration before any Task 7 restart**

Run the just-built CLI directly from clean Setfarm `main`. Task 6A has already applied/audited migration 32, applied and fully verified ordinary migration 33, activated A, completed full initialization/readiness, and rebound the spawner; this step may only validate those authorities:

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
A_PREDECESSOR_CURRENT_ENTRY_STATUS_JSON="$(npm run --silent acceptance:baseline-post-handoff -- current-entry-status --json)"
printf '%s\n' "$A_PREDECESSOR_CURRENT_ENTRY_STATUS_JSON" | jq -e '
  keys == ["authorityV3Migration31Audit","blockedReason","canaryRunningPhase",
    "controllerSourceAuthority","entryAuthority","manifestActivation",
    "migrationApplyingPhase","operationHash","operationRef",
    "pendingBootstrapHandoffMigration","preMutationLoadedRuntimeServiceAuthority",
    "preMutationLoadedRuntimeServiceAuthorityHash",
    "preMutationLoadedRuntimeServiceAuthorityRef","preSchemaSpawnerRebindStatus",
    "preSchemaSpawnerRebindStatusBody",
    "productBuildAuthorityV2DeliveryEvidence","schema","settledPhase",
    "spawnerAdmissionTransitionPhase","state","statusHash","statusRef"] and
  .schema == "setfarm.internal-production-current-entry-authority-status.v1" and
  .state == "ready" and
  .preSchemaSpawnerRebindStatusBody.state == "normal_task0_admission_ready" and
  .preSchemaSpawnerRebindStatusBody.statusRef == .preSchemaSpawnerRebindStatus.statusRef and
  .preSchemaSpawnerRebindStatusBody.statusHash == .preSchemaSpawnerRebindStatus.statusHash and
  .preSchemaSpawnerRebindStatusBody.currentEntryOperation.operationRef == .operationRef and
  .preSchemaSpawnerRebindStatusBody.currentEntryOperation.operationHash == .operationHash and
  .preSchemaSpawnerRebindStatusBody.dispatchPrefix.phase == "replacement_observed" and
  (.preSchemaSpawnerRebindStatusBody.dispatchPrefix.predecessorTerminationObservation |
    type == "object") and
  (.preSchemaSpawnerRebindStatusBody.dispatchPrefix.replacementProcessObservation |
    type == "object") and
  (.preSchemaSpawnerRebindStatusBody.sealedAdmission | type == "object") and
  (.preSchemaSpawnerRebindStatusBody.admissionReady | type == "object") and
  .migrationApplyingPhase.phase == "current_audited" and
  .spawnerAdmissionTransitionPhase.phase == "runtime_observed" and
  .canaryRunningPhase.phase == "terminal_settlement_published" and
  .settledPhase.phase == "fence_released" and
  (.entryAuthority.entryAuthorityRef | startswith("setfarm://internal-production/")) and
  (.entryAuthority.entryAuthorityHash | test("^[0-9a-f]{64}$"))
' >/dev/null
A_MIGRATION_RECEIPT_REF="$(printf '%s\n' "$A_PREDECESSOR_CURRENT_ENTRY_STATUS_JSON" | jq -er '.migrationApplyingPhase.migrationReceipt.migrationReceiptRef')"
A_MIGRATION_RECEIPT_HASH="$(printf '%s\n' "$A_PREDECESSOR_CURRENT_ENTRY_STATUS_JSON" | jq -er '.migrationApplyingPhase.migrationReceipt.migrationReceiptHash')"
A_CURRENT_AUDIT_REF="$(printf '%s\n' "$A_PREDECESSOR_CURRENT_ENTRY_STATUS_JSON" | jq -er '.migrationApplyingPhase.currentAudit.bootstrapHandoffCurrentAuditRef')"
A_CURRENT_AUDIT_HASH="$(printf '%s\n' "$A_PREDECESSOR_CURRENT_ENTRY_STATUS_JSON" | jq -er '.migrationApplyingPhase.currentAudit.bootstrapHandoffCurrentAuditHash')"
A_PREDECESSOR_STATUS_REF="$(printf '%s\n' "$A_PREDECESSOR_CURRENT_ENTRY_STATUS_JSON" | jq -er '.statusRef')"
A_PREDECESSOR_STATUS_HASH="$(printf '%s\n' "$A_PREDECESSOR_CURRENT_ENTRY_STATUS_JSON" | jq -er '.statusHash')"
A_PREDECESSOR_ENTRY_REF="$(printf '%s\n' "$A_PREDECESSOR_CURRENT_ENTRY_STATUS_JSON" | jq -er '.entryAuthority.entryAuthorityRef')"
A_PREDECESSOR_ENTRY_HASH="$(printf '%s\n' "$A_PREDECESSOR_CURRENT_ENTRY_STATUS_JSON" | jq -er '.entryAuthority.entryAuthorityHash')"
require_authenticated_clean_main_setfarm_root_v1
A_PREDECESSOR_CURRENT_ENTRY_VERIFICATION_JSON="$(npm run --silent acceptance:baseline-post-handoff -- verify-current-entry --json)"
printf '%s\n' "$A_PREDECESSOR_CURRENT_ENTRY_VERIFICATION_JSON" | jq -e \
  --arg statusRef "$A_PREDECESSOR_STATUS_REF" --arg statusHash "$A_PREDECESSOR_STATUS_HASH" \
  --arg entryRef "$A_PREDECESSOR_ENTRY_REF" --arg entryHash "$A_PREDECESSOR_ENTRY_HASH" '
  keys == ["currentEntryStatus","currentEntryVerificationHash",
    "currentEntryVerificationRef","currentStatus","entryAuthority",
    "freshRuntimeAndOwnerObservation","resolvedAuthoritySetHash","schema"] and
  .schema == "setfarm.internal-production-current-entry-verification.v1" and
  .currentStatus == "current" and
  .currentEntryStatus.statusRef == $statusRef and
  .currentEntryStatus.statusHash == $statusHash and
  .entryAuthority.entryAuthorityRef == $entryRef and
  .entryAuthority.entryAuthorityHash == $entryHash and
  (.resolvedAuthoritySetHash | test("^[0-9a-f]{64}$")) and
  (.freshRuntimeAndOwnerObservation | keys ==
    ["freshRuntimeAndOwnerObservationHash",
      "freshRuntimeAndOwnerObservationRef"]) and
  (.freshRuntimeAndOwnerObservation.freshRuntimeAndOwnerObservationRef |
    startswith("setfarm://internal-production/current-entry-fresh-runtime-and-owner-observation/sha256/")) and
  (.freshRuntimeAndOwnerObservation.freshRuntimeAndOwnerObservationHash |
    test("^[0-9a-f]{64}$")) and
  (.currentEntryVerificationRef |
    startswith("setfarm://internal-production/current-entry-verification/sha256/")) and
  (.currentEntryVerificationHash | test("^[0-9a-f]{64}$"))
' >/dev/null
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

Expected: Task 7 reads the byte-identical Task 6A receipt/current-audit pairs only from the ready status's declared nested migration phase, then requires the sole strict verification response to bind that exact ready status and nested entry pair. The verifier internally authenticates the immutable v31/pending causal history and all deep subchains; the transcript separately reopens the migration receipt/current audit and runs generic full verification read-only. There is no flattened status mirror, guard, dedicated apply call, schema transaction, or manifest activation. A missing/corrupt/unverified, non-ancestral, cross-paired, or blob/digest/schema-mismatched authority blocks before a Task 7 restart reservation or side effect.

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
  def exactRefHash($ref; $hash; $domain):
    ($hash | type == "string" and test("^[0-9a-f]{64}$")) and
    $ref == ($domain + $hash);
  def exactPair($value; $refKey; $hashKey; $domain):
    ($value | type == "object") and
    (($value | keys) == ([$refKey,$hashKey] | sort)) and
    exactRefHash($value[$refKey]; $value[$hashKey]; $domain);
  def exactTerminalPredecessorRebind:
    .predecessorPreSchemaSpawnerRebindStatus as $pair |
    .predecessorPreSchemaSpawnerRebindStatusBody as $body |
    exactPair(.predecessorCurrentEntryOperation; "operationRef"; "operationHash";
      "setfarm://internal-production/current-entry-operation/sha256/") and
    exactPair($pair; "statusRef"; "statusHash";
      "setfarm://internal-production/pre-schema-spawner-rebind-status/sha256/") and
    ($body | keys == ["admissionReady","authorization","currentEntryOperation",
      "dispatchPrefix","refusalCode","restartAuthority","schema",
      "sealedAdmission","startupToken","state","statusHash","statusRef"]) and
    $body.schema == "setfarm.internal-production-pre-schema-spawner-rebind-status.v1" and
    $body.state == "normal_task0_admission_ready" and
    $body.statusRef == $pair.statusRef and $body.statusHash == $pair.statusHash and
    exactPair($body.currentEntryOperation; "operationRef"; "operationHash";
      "setfarm://internal-production/current-entry-operation/sha256/") and
    $body.currentEntryOperation == .predecessorCurrentEntryOperation and
    exactPair($body.authorization; "authorizationRef"; "authorizationHash";
      "setfarm://internal-production/pre-schema-spawner-rebind-authorization/sha256/") and
    exactPair($body.startupToken; "startupTokenRef"; "startupTokenHash";
      "setfarm://internal-production/pre-schema-spawner-startup-token/sha256/") and
    exactPair($body.restartAuthority; "restartAuthorityRef"; "restartAuthorityHash";
      "setfarm://internal-production/pre-schema-spawner-restart-authority/sha256/") and
    ($body.dispatchPrefix | keys == ["phase","predecessorTerminationObservation",
      "replacementProcessObservation"]) and
    $body.dispatchPrefix.phase == "replacement_observed" and
    exactPair($body.dispatchPrefix.predecessorTerminationObservation;
      "predecessorTerminationObservationRef"; "predecessorTerminationObservationHash";
      "setfarm://internal-production/pre-schema-spawner-predecessor-termination-observation/sha256/") and
    exactPair($body.dispatchPrefix.replacementProcessObservation;
      "replacementProcessObservationRef"; "replacementProcessObservationHash";
      "setfarm://internal-production/pre-schema-spawner-replacement-process-observation/sha256/") and
    exactPair($body.sealedAdmission; "sealedAdmissionRef"; "sealedAdmissionHash";
      "setfarm://internal-production/pre-schema-spawner-sealed-admission/sha256/") and
    exactPair($body.admissionReady; "admissionReadyRef"; "admissionReadyHash";
      "setfarm://internal-production/task0-spawner-admission-ready/sha256/") and
    $body.refusalCode == null;
  . as $status |
  .schema == "setfarm.internal-production-post-rebind-entry-authority-status.v1" and
  .state == "ready" and
  exactTerminalPredecessorRebind and
  exactRefHash(.predecessorCurrentEntryRef; .predecessorCurrentEntryHash;
    "setfarm://internal-production/current-entry-authority/sha256/") and
  (.predecessorLoadedRuntimeServiceAuthorityHash | test("^[0-9a-f]{64}$")) and
  exactRefHash(.predecessorAuthorityV3Migration31AuditRef;
    .predecessorAuthorityV3Migration31AuditHash;
    "setfarm://internal-production/authority-v3-migration31-audit/sha256/") and
  exactRefHash(.predecessorPendingBootstrapHandoffMigrationRef;
    .predecessorPendingBootstrapHandoffMigrationHash;
    "setfarm://internal-production/pending-bootstrap-handoff-migration/sha256/") and
  exactRefHash(.migrationReceiptRef; .migrationReceiptHash;
    "setfarm://internal-production/baseline-bootstrap-handoff-migration-receipt/sha256/") and
  exactRefHash(.bootstrapHandoffCurrentAuditRef; .bootstrapHandoffCurrentAuditHash;
    "setfarm://internal-production/bootstrap-handoff-current-audit/sha256/") and
  exactRefHash(.restartSequenceRef; .restartSequenceHash;
    "setfarm://internal-production/baseline-restart-sequence/sha256/") and
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
  exactRefHash(.productBuildAuthorityV2DeliveryEvidenceRef;
    .productBuildAuthorityV2DeliveryEvidenceHash;
    "mission-control://internal-production/product-build-authority-v2-delivery-evidence/sha256/") and
  exactRefHash(.postRebindEntryAuthorityRef; .postRebindEntryAuthorityHash;
    "setfarm://internal-production/post-rebind-entry-authority/sha256/") and
  exactRefHash(.statusRef; .statusHash;
    "setfarm://internal-production/post-rebind-entry-authority-status/sha256/") and
  .blockedReason == null
' >/dev/null
require_authenticated_clean_main_setfarm_root_v1
npm --prefix "$SETFARM_ROOT" run --silent acceptance:baseline-post-handoff -- verify-post-rebind-entry --json
```

Expected: the first call creates or adopts exactly one linear successor after all Task 7 effects are terminal; response loss at any store/head boundary returns the byte-identical pair. Status/resolver preserve the predecessor's distinct mixed loaded-runtime authority, Task 6A-applied migration receipt/current-audit pair, that receipt's immutable v31/pending causal quartet, and delivery-evidence pair; prove that exact receipt remains applied/current; and prove every scoped Setfarm service is loaded from Task 7's controller source/tree/build and Mission Control from its Task 7 source/tree/build. They then prove two independent HTTP facts: the delivery-evidence endpoint's strict response contains the byte-identical predecessor source-observed delivery pair/body; separately, the loaded-build endpoint's strict startup-frozen response has recomputed loaded hash/ref, PID equal to the stable Mission Control process/listener fence, and build-identity source/tree/build equal to both Task 7 Mission Control authority and the predecessor's embedded expected evidence. The loaded response neither resolves nor equals the delivery pair. No Task 8 or B/C/D/E operation begins until the post-rebind pair is `ready` and current.

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

The A source change delivered before this documentation handoff must contain exactly the 109 paths in `TASK_0_EXACT_SOURCE_PATHS_V1`, including the build-output-tree writer/test, OA18 rotation-ledger/retention tool and test, historical Git-object helper/test plus its two direct-caller regressions, owner-admission core/test, exact literal source-manifest and AST owner-inventory tests, every real owner birth/terminal/direct-SQL path, ordinary-run persistence transaction/caller/direct tests, target-guard mint/bind call site, guarded migration-32 registry/source-integrity/generated digest/private test helper, `src/db-pg.ts`, the isolated PostgreSQL runner, every audited direct apply/verify caller test, adjacent runtime-completion and Mission Control filter tests, all restart/receipt/PBA/active-status modules and focused tests, generated active-status pair, and package wiring. The source inventory/tree/hash gate compares the literal tuple path-for-path and rejects an omission, extra path, duplicate, reorder, Markdown-derived expected set, or count-only assertion. The post-handoff writer accepts no sequence or migration field/pair from the shell: it takes the retained `documentation-rollback` final pair from the code-owned coordinator, freshly resolves `InternalProductionBaselineRestartSequenceReceiptV1` and the already applied `InternalProductionBaselineBootstrapHandoffMigrationReceiptV1`, requires their source/build/final-census/schema identities to equal the current record inputs, and copies their exact pairs plus all three ordered restart composite pairs. A missing, in-progress, blocked, live-rebind, structurally cloned, swapped, or drifted sequence or migration prevents `record`; the final baseline receipt hash covers every copied pair, including the migration receipt's exact v31 predecessor and pending-successor causal pairs. Define the strict receipt as:

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
- The ready `InternalProductionPostRebindEntryAuthorityPairV1` freshly verifies the exact successor migration applied/current, binds the predecessor runtime authority, requires every scoped loaded Setfarm service to equal Task 7 controller source/build and Mission Control to equal its Task 7 source/build, and binds the restart/schema/complete-zero-owner chain. It proves two independent HTTP checks: the delivery-evidence endpoint returns the byte-identical predecessor source-observed delivery pair/body; the loaded-build endpoint separately returns a strict startup-frozen response with recomputed loaded hash/ref, PID equal to its stable process/listener fence, and build-identity source/tree/build equal to the embedded expected evidence. The loaded response never resolves or equals the delivery pair. Task 8 and B/C/D/E use only this successor.
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
