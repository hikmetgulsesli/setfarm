# Controls and manual infrastructure tests

Part of the approved operator workspace (`2026-10-19-operator-workspace-design.md`). User approved all audit recommendations; this deliverable includes working test actions, persisted progress and real reports. A panel of unsupported buttons is insufficient. Source architecture census and constraints: `/Users/setrox/ai/setrox/logs/2026-10-19-ui-implementation/controls-runner-architecture.md`, including the local-auth/entry addendum. Root serializes both repositories and owns delivery.

## Operator behavior

Controls provides connection refresh, canonical “Neden bekliyor?”, actual activation preflight, unchanged full8 evaluation, isolated UI regression, and latest evidence. A refresh only reads. Launch is explicit, confirms the selected job and visible budget in the same UI, and returns a persisted job whose progress survives navigation/reload/HTTP disconnect. Cancel means requested until actual owned work and ownership settle. Existing failed/quarantined reports remain visible.

The actual activation report has six unique checks: migration_shape, migration_attestation, database, artifact_capacity, activity, protocol_activation. Convergence's own eight preflight checks are a different report. The actual full8 product cases are utility-status-baseline, utility-preference-compositional, operations-work-baseline, operations-queue-paraphrase, game-start-baseline, game-restart-compositional, negative-ambiguous-product, negative-unsupported-kernel. Never pad missing rows with passes or infer GO from counts/health.

Full8 recipe is the selected release's committed `evals/suites/product-convergence-codex-v1.json`, one repetition, v3, existing rootCauseRepeatLimit3, runMs21600000/case and pollMs15000. Preserve all suite tasks/oracles/gate/admission and provider/material checks. The maximum planned case budget is48hours, plus collection overhead; show actual progress rather than a quick-completion promise. No UI timeout kills a long evaluation.

## Local operator boundary

Reuse current MC authentication. New Controls mutations additionally require exact loopback socket, exact configured127.0.0.1 host/port, same Origin, JSON content type, strict bounded body and expected selected identity. Reject foreign/missing browser origin rather than accepting arbitrary remote clients. Keep general/global/source/DB/runtime guards intact and server operational credentials private. No new credential or broader listener is configured by this feature. Current read-only census found fresh MC bound only127.0.0.1:3080, existing server operational token present, AUTH_TOKEN absent/empty; these are dated facts, not authority to change config. Never send the operational token to the browser.

GET handlers/read adapters never launch jobs, spawn processes, mkdir, repair, register historical reports or publish artifacts. Existing mandatory global read-only git integrity probes remain the documented exception. Production composition imports only fixed trusted compiled modules from the captured selected release, never a request-supplied path. Worker validates its exact compiled self-path/argv and inherited private custody; existing CLI form allowlist is not widened unnecessarily.

## Fixed contracts

Only `activation_preflight`, `convergence_full8`, `ui_regression` job kinds exist. POST `/api/controls/jobs` accepts exactly kind, idempotencyKey, expectedSelectionHash. Cancel accepts exactly idempotencyKey and expectedRevision for an opaque validated jobId. No command/argv/path/model/env/token/suite/budget inputs. GET evidence, recent jobs(limit50), exact job and optional manifest-bound screenshot use opaque IDs/hashes only, no private paths/raw logs. All responses no-store.

Public receipt schema `mission-control.control-job.v1`: jobId/kind/revision/selectionHash/sourceSha/mcSourceSha/mcBuildHash/suiteHash; accepted|starting|running|cancelling|completed|failed|blocked|cancelled|ownership_unknown state; request/start/update/finish times; phase/code; exact current case/owned run IDs; completed/planned case counts; activation/result/gate/ui report hashes and cancelRequested. Completed job is distinct from passing report/qualified release. Null means unknown.

Private immutable intent binds selected installation/release, loaded MC build, fixed recipe and a nonce supplied through inherited descriptor/IPC. Never expose nonce, selectors, PG URLs or raw process output. A private selected runtime/mission-control/controls directory is created only on explicit POST with owned0700 directories/0600 files, no link/adoption, stable inode/mode checks, exclusive publication, fsync and monotonic CAS revisions. Idempotent exact retries produce one spawn even after MC restart; different request under same key conflicts. Unfinished reservation remains active/unknown after restart, never auto-rerun/adopt/kill. Output is bounded on disk, not unbounded in response memory.

Setfarm owns actual six-check/evaluator workers and a durable evaluation reservation also used by the direct evaluator entry. A common short selected workflow-admission epoch serializes reservation acquisition against actual run insertion/canary consumption. Only exact verified canary slots belonging to that reservation may create child runs. Full complete activity includes cancelling/failing, all claim/attempt/runtime/completion/recovery/termination families and evaluator/other known owner reservations; unknown refuses. No multi-day SQL transaction. Preserve existing source/build/catalog/material/quota/one-use admission checks.

Actual evaluation uses existing runConvergenceSuite/default ports/store/gate/promotion. Progress hooks journal admission before start, exact run binding, results and phase. A lost start response is resolved only through that persisted canary claim's run_id; never retry the start or choose latest run. Cooperative cancel stops future cases and invokes canonical stop only for that exact bound run with fresh snapshot/invariants. Preserve refusals, release reservation only after canonical terminal and owners actually settle, never kill shared services. Observe cancellation before GO promotion. Preflight cancel respects publication boundaries; UI worker only cleans its captured fixture children and retains incomplete evidence.

## Evidence

New job receipts index exact hashes. Missing root remains missing; GET does not scan latest/readdir order. Historical records may be explicitly registered through a separately validated source-owned bounded index operation, never adopted by GET. Selected roots and current source/build compatibility are server-derived.

Nonmutating reader opens bounded regular files O_RDONLY/O_NOFOLLOW, checks parents/dev/ino/owner/mode/links/size before and after, rejects symlink/ancestor swaps/traversal/oversize/nonregular files, and validates existing source-owned schemas/canonical hashes/linkage. Eval bucket layout and canonical result/gate hashes differ from raw pretty JSON hashes; activation uses its artifact envelope. Six activation IDs must be exact/unique. Stored gate must link result/release and agree with existing pure gate evaluation; GET never publishes/promotes. Missing gate is unqualified, planned is planned, incompatible source is historical. No raw task/environment/private diagnostics in response. Timestamps absent in schema remain null; mtime is separately labelled filesystem time.

UI reports bind MC sourceSHA, loaded buildHash, fixture version/hash, time, actual assertions and screenshot hashes. Source/build mismatch is historical. Standalone reader modules do not import publisher/evaluator runtime graphs. Fixed trusted composition and versioned DTO checks use existing repository contract patterns; do not copy an incomplete validator into MC or instantiate the mkdir-on-get eval store.

## UI regression

Keep existing render-smoke port13081 and ordered six-route contract. Add independent source-owned `test:ui` fixture runner on checked loopback13082, isolated temp data, actual built client, fixed API fixtures and deny unexpected HTTP/WS/service workers/provider/mutation requests. Sanitize child environment and capture exact owned PID/browser/server lifecycle; refuse occupied port instead of killing its owner.

Exercise all preserved routes plus Controls at390/768/1440, all eight run tabs, A101 Clone This, stale/late history and new/reset/navigation races, D/P/input/select/contenteditable/IME/modifier cases, search/favorites/mobile focus,14-agent grid/panel, Rules503 draft/confirmation retention, realzero/unknown metrics, historical/planned/unqualified reports and job launch/reload/idempotency/cancel through fake API. Assert no console errors, unexpected network, horizontal overflow or unreadable ordinary fonts. Capture and retain screenshots/report even on failure. Actual live product verification uses CUA after reviewed rollout, without live provider/mutation clicks.

## Verification and delivery

Meaningful production-boundary RED/GREEN before behavior changes, source-owned temp-file/ephemeral HTTP/fake-effect tests, isolated PG for persistence changes, independent task/branch review and clean stock builds precede rollout. Tests include concurrency/restart/crash windows, unknown ownership, selector drift, exact cancellation, unchanged suite budgets, report corruption/unsafe trees and read-only inventory invariance. Root separately proves real selected preflight/full8 after causal fixes; source/UI fixture success is not workflow GO. New instance/ACL effects use existing bounded authority audit and no old catalog repair.

## Source language integration ruling

The existing English source guard and English UI language remain binding. Turkish operator terms in design prose denote concepts; actual product labels and behavioral assertions use clear English equivalents. Do not add guard exceptions, escaped copy or hidden string catalogs. This resolves the actual combined-build language refusal without weakening compiler/prompt/source guards.
