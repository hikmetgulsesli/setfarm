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

## Shared selected identity hash

`selectionHash` is a drift precondition, not authority. Both repositories consume the same pure strict `ControlSelectionIdentityV1Schema` and `hashControlSelectionIdentityV1` exported by SF `src/execution/schemas/manual-control-job-v1.ts`; hash with the existing SF `hashCanonicalJson` over exactly this parsed record (no additional timestamps, MC build or suite fields):

```ts
type ControlSelectionIdentityV1 = Readonly<{
  schema: 'setfarm.manual-control-selection.v1';
  installationId: string; sourceSha: string;
  installationDir: string; releaseDir: string; catalogHash: string;
  activationPreparedHash: string; activationAcknowledgedHash: string;
}>;
```

Map only from the captured validated `freshInstallationSelectionV1`: `state.origin.installationId`, `state.origin.sourceSha`, `directory`, `paths.repository`, `catalogHash`, `activation.preparedPin.sha256`, `activation.activatedPin.sha256`. Require acknowledged activation and both pins; no activation/unknown selection refuses launch. UUID/source/hash/path validation is strict; paths are canonical absolute internal values checked by the existing selection authority. Recheck `selection.assertUnchanged()` before/after derivation and before effects; ordinary selected operational entry/database/build checks remain mandatory. MC extends only its internal captured Selection view and uses the fixed selected SF pure schema/hash helper; it never derives from HTTP or current checkout. Raw record/paths/pins stay private; browser receives only the resulting hash. MC source/build and suite identities are separately bound in the job receipt. This hash grants no runtime or credential authority.

## Private control custody and direct evaluator enrollment

MC writes the strict `ControlPrivateIntentV1` at exactly `runtime/mission-control/controls/jobs/<jobId>/intent.json` (0700 private directories, immutable0600 regular single-link file, pinned safe parents) before spawning. The selected SF module independently reads that fixed path; no caller path is accepted. `registerSelectedManualWorkerCustodyV1(custody:ControlWorkerCustodyV1): Promise<void>` in the mapped admission module verifies prepared operational entry, exact compiled worker/executable/OS argv/start/group, shared selected identity, pinned intent and every job/source/selection/MCbuild binding plus SHA256(nonce). It retains private in-memory custody and stable intent pins; no public boolean authorizes self-exclusion.

`prepareSelectedDirectEvaluationIntentV1(): Promise<Readonly<{jobId:string;kind:'convergence_full8';selectionHash:string;sourceSha:string;suiteHash:string}>>` is a zero-argument internal API in that same module. It accepts only the exact selected compiled convergence CLI and the committed codex-v1 recipe at the selected output root/current source, preserving the existing unselected CLI behavior. Unsupported/default-other selected recipes refuse clearly before effects. Both exact selected codex planning and execute modes may enroll; private direct intent records the actual mode and planning never qualifies. It exclusively fsyncs its own SF-private nonce-bound intent at `runtime/evals/manual-controls/direct/<jobId>.json` and registers exact current process. It must not invent MC build fields. Validate/load recipe and acquire before evaluator artifact preparation/publication; the existing read-only selected ports factory need not be split. No generic CLI form is added.

Acquisition excludes only the independently validated control process belonging to this intent. Subsequent bind/release requires exact current custody and held revision. Other process/build/publication/work/child owners and unknown custody remain blocking. Registration alone grants no workflow admission or runtime role rights. Public owner observation still reports owned for an unfinished reservation.

## Private SF custody closure (settled before implementation)

`closeSelectedManualWorkerCustodyV1(): Promise<void>` in the mapped SF admission module closes only the uninterrupted exact privately registered current worker/direct process. Public intent/receipt/custody/HTTP schemas are unchanged. It publishes an exclusive fsynced immutable0600 single-link marker under private0700 safe parents at exactly selected `runtime/evals/manual-controls/closures/<jobId>.json`; no direct-only `.released` convention remains. The strict module-private marker is bounded16KiB and has exactly:

```ts
type ManualCustodyClosureV1 = Readonly<{
  schema:'setfarm.manual-control-custody-closed.v1';
  jobId:string; kind:'activation_preflight'|'convergence_full8';
  selectionHash:string; sourceSha:string; suiteHash:string|null;
  executionMode:'preflight'|'execute';
  intentOrigin:'mission_control'|'direct';
  intentHash:string; nonceDigest:string;
  owner:{pid:number;processStartedAt:string;processGroupId:number;
    source:'observed_os';executable:string;script:string;commandHash:string};
  closure:{kind:'never_reserved'}
    |{kind:'reservation_released';revision:number;recordHash:string};
}>;
```

Hashes are SHA256 of exact immutable intent/released-record bytes and exact observed OS command respectively; do not substitute public receipt hashes. Validate canonical UUID/time/path/hash and recipe/mode/kind relations. `reservation_released` resolves the exact immutable retained revision at `runtime/evals/manual-controls/revisions/<revision padded to20 decimal digits>.json` and matches all bindings. Pin safe parents and regular file identity/owner/mode/links/content before/after; conflicting files/unsafe or missing history refuse. This is the existing source-owned private trust boundary, not a signature against arbitrary same-UID mutation.

One custody per process has irreversible acquisition-in-flight/publication-attempt/held/released/closing/closed/uncertain facts. Set publication-attempt before pending publication even if write throws; registration cannot reset lifecycle. Latch closure before awaits and serialize against acquire/bind/release. Closed or uncertain custody never dispatches effects or re-acquires. Zero/multiple/restarted custody refuses; same-process acknowledged repeat succeeds only after identical pinned marker validation.

Under the existing short shared DB fence and exact durable mutation guard, `never_reserved` requires no acquisition in flight, no publication attempt, no admitted effects and no bounded current/history reservation attributable to this job/intent/owner. It retires only this proven never-admitted intent even if unrelated activity caused the refusal; foreign owners/reservations remain blocking and untouched. Any pending write/rollback/lost acknowledgement/ambiguous own work forbids it. Previously acquired custody must first have exact latest-revision release return successfully in this process; closure retains and validates that released archive. It never implicitly releases or manufactures terminal state.

Publish closure under the same durable mutation boundary, honor it only with mutation guard absent before/after stable reads, and remove only the exact pinned guard after definite transaction success. Rollback, uncertain commit or residue stays unknown; GET/restart never repairs/deletes/adopts. A valid marker suppresses only its bound immutable intent, never an observed live process/descendant/foreign owner. Only the exact current registered process/intent can be self-excluded for its own closure/release. After closure only bounded authenticated terminal reporting/owned shutdown remains.

Reservation release proves every cumulative bound slot/admission/claim, including earlier revisions: unused claims have both run_id/consumed_at null; used claims have both and the exact run. Used claims need no current unexpired admission but all original identities/hashes match. Every used run must have actual terminal state and canonical closed owner, verified through existing `resolveInternalProductionWorkflowRunTerminalAuthorityPairInTransactionV1` and `resolveInternalProductionOwnerReservationCloseInTransactionV1` plus actual locked owner/close references and the complete owner census. Status alone, last-slot-only proof, process exit or MC receipt prose is insufficient. No terminal/owner mutation or privilege repair is introduced.

SF's bounded MC namespace inventory recognizes only canonical UUID job directories plus each required pinned strict `intent.json`; unknown top-level entries or partial/unsafe job directories/intent leaves are unknown. Other broker-owned siblings inside a validated job directory are opaque: SF neither interprets nor follows them and accepts no receipt/log locator. The broker owns their separate safe storage. A valid ui_regression intent is separate from SF evaluator reservation/closure; malformed intent is never silently skipped. Abandoned/unregistered SF intents remain unknown.

Worker/direct order is registration, acquire, admitted work, canonical settlement, exact release, close custody, authenticated final acknowledgement, exit. A certain pre-publication refusal skips release but closes its own never-reserved custody. Pre-registration/ambiguous acquisition/release/closure failures retain ownership_unknown; no age/exit/receipt retry/adoption grants authority. MC publishes/pins intent before one fixed spawn, authenticates closure acknowledgement on its existing channel and never invents closure from receipt state. A closed marker never hides a still-live worker. Task1 owns private lifecycle/census/fence tests; Task2/direct CLI and MC broker consume it in mapped files. Normal test/review/build/operational gates remain required.

## Accepted private worker channel, journal and publication contract

## Decision

Use one inherited Node IPC channel for each original broker/worker pair, authenticated with the **existing** per-job nonce; one SF append-only journal; and the broker's existing durable receipt/CAS owner. No reconnect, restart adoption, generic endpoint or new credential. A worker wrapper owns all-slot admission binding and exact start reconciliation. Runner callbacks provide awaited phase/publication checkpoints. Public schemas and HTTP bodies remain unchanged.

A cancel-file polling channel is unnecessary for this version. It would add a second authority/ordering source and restart-adoption questions. Broker restart breaks the original channel; the worker takes the disconnect policy below, and the new broker reports unresolved jobs unknown. Browser reload merely reads durable receipts and does not break the server/worker channel.

## Fixed files and writers

All roots derive from captured selected installation/intent; no path is supplied over HTTP or progress frames.

| Owner | Fixed layout |
| --- | --- |
| MC | Existing immutable `runtime/mission-control/controls/jobs/<jobId>/intent.json`; existing broker receipt/idempotency storage; private `channel.json` recording the original channel/child binding; immutable `cancel.json` for the one irreversible cancellation latch |
| SF | `runtime/evals/manual-control-journals/<jobId>/records/<revision padded to 20 digits>.json`; mutable CAS pointer `head.json`; exact temporary pointer `head.next.json` only during a write |
| Task 1 | Existing reservation/closure namespace unchanged, including `runtime/evals/manual-controls/closures/<jobId>.json` |

MC alone writes public receipts. SF alone writes its journal. MC never opens the SF journal to establish custody and SF never reads MC receipts/cancel files as authority. Task 1 continues treating broker siblings as opaque. A new `channel.json` or `cancel.json` has no meaning to Task 1's SF census.

`channel.json` is strict immutable private data with exactly `schema:'mission-control.control-channel.v1'`, jobId, intentHash, channelId, originalChild (the strict exact observed owner), and readyFrameHash. It records an already-observed original child, never a capability to reconnect. Both broker siblings use the existing safe 0700/0600 single-link/pinned-parent/exclusive/fsynced discipline; each is bounded to 16 KiB. Neither stores the raw nonce.

Journal directories are exclusively created 0700 **after successful reservation acquisition and before any admitted evaluator/preflight effect**. Files are immutable 0600, regular, single-link, bounded, no-follow, with stable safe-parent/dev/inode/owner/mode/content pins. No adoption of an existing job journal. Direct selected planning/execute uses the same journal with its SF-private intent and no MC fields/channel. No-reservation refusal can close without creating a journal.

Journal record envelope, strict with no unknown fields:

```ts
type WorkerJournalRecordV1 = Readonly<{
  schema: 'setfarm.manual-control-journal-record.v1';
  jobId: string; intentHash: string; ownerHash: string;
  revision: number; previousHash: string | null;
  event: WorkerJournalEventV1;
}>;
type WorkerJournalHeadV1 = Readonly<{
  schema: 'setfarm.manual-control-journal-head.v1';
  jobId: string; revision: number; recordHash: string;
}>;
```

`intentHash`, `ownerHash` and `recordHash` are SHA256 of exact immutable intent bytes, canonical strict observed-owner JSON, and exact record bytes respectively. Owner includes the Task 1 exact OS PID/start/group/executable/script/commandHash. Use canonical JSON plus one newline for stored bytes; hashes never use pretty-JSON equivalents. Revision starts at 1, increments by exactly 1; previousHash is null only for revision 1. Maximum 1,024 records/job, 64 KiB/record, 1 KiB/head. Do not journal every 15-second poll/heartbeat; journal state transitions and actual durable effect identities. Reaching a bound refuses further work.

`WorkerJournalEventV1` is a strict discriminated union with precisely the events below. Each hash/ID/enum has a pure validator; no arbitrary metadata/blob/log field. The first `acquired` record includes kind, selectionHash, sourceSha, suiteHash, executionMode, exact owner, origin and held reservation revision. Later records are bound through the chain.

| Event | Required private payload/fact |
| --- | --- |
| `acquired` | Captured identity above and successfully returned reservation revision |
| `phase` | Fixed phase enum, current catalog case or null, actual completed count |
| `canary_create_requested` | Release/suite/preflight hashes, exact requested eight slot identities and private slot tokens, actual TTL; before calling the real repository once |
| `canary_bound` | Full validated returned context set and refreshed Task 1 reservation revision; after one all-slot bind, before any start |
| `start_requested` | Exact catalog case/repetition/admission/slot/task identity; before invoking actual start once |
| `run_bound` | Same identity, exact consumed-claim run ID/run number, normal or recovered-output source |
| `run_result_stored` | Exact bound case/run and successfully stored per-run result hash |
| `cancel_latched` | Source `operator` or `channel_lost`, request ID or null; irreversible, no arbitrary reason |
| `stop_requested` | Exact bound run and fresh canonical snapshot hash; before canonical stop |
| `stop_observed` | Exact run, canonical request result `requested|already_terminal|refused`, safe code |
| `artifacts_stored` | Publication stage and exact result/gate hashes/decisions as defined below |
| `finalization_boundary` | Exact candidate pair and decision `cancel|continue`; for GO/continue this records the promotion attempt boundary |
| `released` | Successfully returned release and its held revision identity; no caller assertion can manufacture it |
| `closed` | Hash of the exact already-published Task 1 closure marker, final outcome and final refs |
| `fault` | Fixed safe code and last proved phase; never authority to release |

On append: verify the old head/pins and immutable tail; exclusively write/fsync next record; write/fsync `head.next.json`; recheck expected old head/pins; rename over head and fsync parent; verify new head. One writer serializes all journal/progress/cancel work. Failure between record and head leaves retained residue and unknown; no skip, truncate, overwrite, scan-latest or restart repair. A journal is evidence, never permission to adopt a reservation.

Journal failure after acquisition stops new cases, artifacts, promotion and public final claims. Do not run a stop effect unless its exact binding and required stop-intent record are already durable. Existing canonical work may drain under its real owner; retain reservation/unknown until a safe in-scope proof exists. Never turn journal failure into a benign evaluator blocker through `settle`. In contrast, a healthy-journal transport failure can still journal and request exact canonical stop without the unavailable broker.

## Transport and early handshake before DB

The broker spawns only captured selected Node plus `dist/cli/control-test-worker-v1.js --job-id <uuid>`, with a fixed inherited IPC descriptor at fd 3, JSON serialization, bounded private stdout/stderr files, no shell and sanitized loader/env inputs. Keep the IPC channel throughout the job; no early `disconnect()`/reconnect. Runtime/credential authority remains the existing selected operational entry.

1. MC fsyncs immutable intent and its idempotency/initial receipt before spawn. It creates one random channel UUID for that child, not a reconnect token.
2. The CLI checks compiled canonical self/argv, no execArgv/loader injection, captured acknowledged selection, connected inherited IPC, and strict bounded custody/intent/nonce/job/build/path bindings **before importing the effectful worker graph or preparing SQL**. It independently pins and reads the fixed intent. The first parent frame supplies the existing `ControlWorkerCustodyV1` only through fd 3.
3. MC independently observes its actual `ChildProcess.pid` and exact OS start/group/executable/script/full command hash, with expected parent-child relation. The worker observes its own exact identity and sends `ready`; a PID/identity claimed by the child alone is insufficient. Both sides bind channel/job/intent; raw nonce appears only in the initial custody payload, never a journal or receipt.
4. MC validates that `ready` matches its independent observation, fsyncs `channel.json`, applies the starting receipt revision and sends a durable ACK. Only after that ACK may the worker call unchanged operational preparation/assertion, Task 1 registration/acquisition and actual worker dispatch. Registration independently repeats custody/entry validation after DB preparation.

Use a 10-second bounded startup handshake and 30-second frame-ACK deadline. These bound channel liveness, not the full8 job or its case budgets. Never kill a shared service or assume timeout means the child is absent. Before registration, failure leaves durable intent unknown. After registered never-published refusal, the Task 1 zero-argument closure path may finish the exact refused intent without a journal. A pre-registration failure may send a safe `fault`, but cannot send `final_closed`.

Keep the uninterrupted IPC listener/sequence/queued-cancel state in a small private `src/execution/manual-test-worker-channel-v1.ts` runtime module. Its import graph contains only process/fs/crypto, pure schemas and read-only selection/intent observation; no DB/preflight/evaluator/admission imports. The CLI owns its early `acceptSelectedManualWorkerChannelV1()` call, returning the validated intent/custody after ready ACK. The later worker's zero-argument internal channel accessor requires that exact module-private handshake and custody identity; it accepts no caller-provided authority flag. This preserves the two-argument production worker entry and avoids passing mutable IPC state through public custody fields, globals or a dropped/reinstalled message listener. Importing the module alone attaches no listener or performs no I/O; the explicit accept call does. Test-only transport adapters cannot install production handshake custody.

## Strict private frames

Add pure `src/execution/schemas/manual-control-worker-channel-v1.ts`. It exports versioned frame/journal-event schemas and canonical frame hashing/MAC helpers; it imports only pure schema/canonicalization/crypto dependencies, never worker/admission/DB/runtime factories. MC loads this fixed trusted compiled module. This does not widen `manual-control-job-v1.ts` or a public DTO.

All post-custody frames have exactly:

```ts
type WorkerChannelEnvelopeV1 = Readonly<{
  schema: 'setfarm.manual-control-worker-channel.v1';
  jobId: string; channelId: string; intentHash: string;
  direction: 'broker_to_worker' | 'worker_to_broker';
  sequence: number;
  body: WorkerChannelBodyV1;
  mac: string;
}>;
```

MAC is HMAC-SHA256 with UTF-8 bytes of the existing nonce, over canonical JSON of the envelope excluding `mac`, including direction and schema. Use timing-safe equal-length digest comparison. The first strict custody frame is the same binding plus `{type:'custody',custody:ControlWorkerCustodyV1}`; its nonce establishes the private channel key and must match the independently pinned intent digest. Do not persist it. The inherited channel/child handle and independently verified identity remain essential; MAC is not new runtime authority or a replacement for entry checks.

Each direction has its own positive safe-integer sequence, starting at 1. One message writer per direction; no parallel sequence assignment. Maximum encoded frame 16 KiB and one unacknowledged worker progress/final frame, with bounded pending control frames (16). Use strict JSON object validation and reject excess bytes before any application callback; Node IPC does not provide a hostile-peer streaming-size boundary, so this is a bounded trusted-local transport, not an arbitrary untrusted socket. Do not add a new listener.

`WorkerChannelBodyV1` has exactly these variants:

| Direction/type | Payload |
| --- | --- |
| B→W `custody` | Existing custody record; allowed only first |
| W→B `ready` | Exact strict observed owner; journal reference null |
| W→B `progress` | `journal:{revision,hash}` or null during startup; `phase`, `currentCaseId`, `ownedRunId`, `completedCases`, fixed safe `code|null`; no report refs or selectors |
| B→W `ack` | Exact `workerSequence`, SHA256 of accepted canonical worker envelope including MAC, `receiptRevision`, and the exact safe `ControlJobReceiptV1` snapshot committed for that frame |
| B→W `cancel` | One opaque request UUID and accepted public receipt revision; no path or stop target |
| W→B `cancel_observed` | Request UUID, source journal revision/hash, `effective:'latched'|'after_boundary'`; an ACK of observation, not proof stop/closure succeeded |
| W→B `fault` | Fixed safe code/phase, last durable journal ref or null; always unresolved ownership unless separate final proof exists |
| W→B `final_closed` | Journal ref or null only for never-reserved refusal; closure marker byte hash; outcome `completed|failed|blocked|cancelled`; safe code|null; actual completed count; final `ControlReportRefsV1`; finalization `no_promotion|promotion_confirmed|cancelled_before_boundary|never_reserved` |

There is no separate arbitrary progress patch, command, run selector, environment, raw output or physical path. Fixed phases are `starting`, `acquired`, `preflight`, `admission`, `case_start`, `case_running`, `case_collect`, `publishing`, `finalizing`, `settling`, `released`, `closed`, `ownership_unknown`. The channel safe code allowlist is source-owned, not arbitrary caught exception text. `plannedCases`/kind/identities come from immutable intent; currentCaseId must be one of the selected suite's eight IDs; ownedRunId must be the worker's journaled bound run; completed count advances only after an actual per-run artifact is stored.

For `final_closed`, the source-owned worker invokes Task 1 close successfully, then pins/reads the fixed marker, verifies its expected identity and hashes its exact bytes. Task 1's successful return remains the closure proof; a byte hash alone never substitutes for it. MC accepts only the original authenticated uninterrupted source-owned final frame. The closure hash stays private audit linkage. No MC marker reader, duplicated closure validator, Task 1 schema extraction or effectful admission import on GET is needed. This preserves the already approved closure-ack trust boundary; a restarted broker cannot reconstruct/adopt that channel from a marker.

Exact retransmission of the outstanding worker frame uses identical sequence/bytes/MAC. Broker returns its already committed ACK mapping, with no second receipt revision. Changed bytes at the same sequence, a gap, wrong binding/direction/MAC, unexpected type or a duplicate outside the bounded accepted-history mapping refuses/fences the channel. Old valid duplicates cannot replay effects. Worker accepts ACK only for its exact outstanding frame; receipt identity/count/cancel/phase must obey the broker mapping. A stale ACK is never permission to continue a newer effect.

## Receipt revisions, cancellation, restart and lost ACKs

Worker sequence, SF journal revision and public receipt revision are **different counters**. Replace the brief's ambiguous “share monotonic revision semantics” with an explicit private mapping `(channelId, workerSequence, workerFrameHash) → receiptRevision`. MC serializes per-job receipt/idempotency/cancel/frame commits. Each new accepted worker event or first accepted cancel advances public revision exactly once; duplicate idempotency/frame replay does not. ACK is sent only after the corresponding durable MC receipt and mapping publication succeeds. If their existing store cannot atomically represent both, store the mapping alongside that immutable receipt revision and move its head only after both are durable; partial publication means unknown, not ACK success.

Broker projects safe progress, never copies a whole worker-supplied receipt. `cancelRequested` is monotonic broker-owned state; a progress ACK cannot clear it. Receipt identifiers/request time/recipe/build identities stay immutable. `startedAt` is the broker observation of authenticated acquisition; `finishedAt` is null until a valid final_closed commit. Progress state is `starting`/`running`, or `cancelling` after accepted cancel. A definitive closure may yield `completed` with failed/no-go evidence; `completed` is not pass. Pre-acquire refusal is `blocked`; honored cancellation is `cancelled`; a proved settled execution error may be `failed`. Ownership uncertainty is never one of these final claims.

`reportRefs` for this job stays `{}` throughout provisional progress. Candidate per-run/aggregate/gate/activation hashes remain in the private journal. Only `final_closed` publishes that job's final report refs, after definitive publication decision, Task 1 canonical release and closure. Existing historical completed-job evidence remains indexed and visible. No promotion/GO inference from process exit, all-eight count or candidate artifact existence.

For the first valid POST cancel, MC performs existing idempotency/revision checks and durably records exactly one immutable `cancel.json` containing schema `mission-control.control-cancel.v1`, jobId, intentHash, original channelId, requestId, idempotencyKeyHash, acceptedReceiptRevision and requestedAt. Publish the cancellation receipt revision/mapping before sending a signed `cancel` frame or returning 202. A partial local publication cannot return a successful acknowledgement. Further exact retries replay the same response; different accepted keys requesting the already-latched cancellation do not create a second stop or clear the latch. The worker persists `cancel_latched` before `cancel_observed`; future-case/promotion checks consult that private irreversible latch. Cancel is actionable while an ordinary progress ACK is outstanding; the channel reader must not deadlock behind its own progress waiter.

A cancellation received during startup before journal creation is latched in the uninterrupted channel state, backed by MC's durable cancel record. It suppresses acquisition/evaluator effects: finish only the already-authorized mandatory selected preparation/registration needed for a certain never-reserved close, then send final_closed with null journal, empty refs and cancelled outcome. Do not emit cancel_observed without a journal; final_closed supplies the definitive acknowledgement in this branch. If preparation/registration cannot complete, leave unknown. A cancel queued before handshake is sent only after the first custody/ready binding, never as an alternative ingress frame. If acquisition already began, its actual outcome determines the registered-never-published versus acquired settlement path; no in-flight reservation is assumed absent.

Receipt CAS races are broker-serialized. A final_closed that says promotion already confirmed may produce `completed` with `cancelRequested:true` and safe `CONTROL_CANCEL_TOO_LATE` when cancel was accepted after the worker's boundary. It must not say cancelled/revoked. A final no-promotion outcome similarly preserves the actual boundary result when cancel arrived after the evaluator finished its final decision. 202 promises a durable request, not winning a race.

Lost progress ACK after bounded identical retry, channel disconnect, invalid frame or broker death latches channel failure. With healthy journal the worker persists source `channel_lost` cancellation, starts no further cases, blocks promotion before the boundary, and requests only an already-proved exact owned run's canonical stop. It may finish evidence/actual settlement and Task 1 release/closure using its original uninterrupted custody, even without progress ACKs; the broker is not required for canonical cleanup. Any ambiguity/refusal retains reservation/unknown. It never opens another channel or accepts a new broker nonce. MC does not mark complete from exit or missing heartbeat.

On broker restart, old live/unresolved jobs have no authenticated channel in the new process. GET provides a read-only `ownership_unknown` projection of an unfinished durable receipt at its existing revision, with finishedAt null, no new refs and `CONTROL_CHANNEL_UNAVAILABLE`; this projection creates no durable revision or CAS event. Preserve the stored record/history. Explicit launch/cancel refuses for such unresolved ownership; no spawn, cancel-file polling, reconnect, adoption or startup repair. Valid already-committed final_closed receipt revisions remain terminal after restart: reading a proven completed job is not adopting a running worker. Browser reload in the same broker process just reads ordinary durable progress and reuses idempotency keys.

Distinguish uncertain ACK from proven commit: if the worker's final frame never reached/committed at MC, MC remains unknown. If MC already durably committed the authenticated final closure and only its return ACK was lost, that committed terminal receipt remains valid; the worker can fail to receive its return value without undoing canonical closure. Requiring both endpoints to know the other knows forever would add an unbounded acknowledgement protocol. No side guesses completion from transport loss; only the endpoint holding the definite durable proof can report it.

The existing `runSelectedManualControlJobV1(intent,custody,ports?) → Promise<ControlJobReceiptV1>` can remain: on success return the exact final broker-generated receipt carried by ACK, never a worker-invented revision. Lost final ACK throws a channel-unknown failure even if SF closure is already durable. Selected direct mode returns its existing CLI result only after its own release/closure, with no MC receipt or fake channel.

## One admission/start owner and fatal journal failures

In the mapped worker, wrap **actual** `ports.admissions.createCanary` once. Persist the exact requested full slot set before invoking it once; validate all returned contexts against that request/committed suite and stored admission; perform **one** `bindSelectedManualCanaryV1` with the full set before returning contexts to the runner; retain its refreshed reservation; then persist `canary_bound`. No per-case rebind and no second owner in `onAdmission`. Remove the proposed `ConvergenceJobControlV1.onAdmission` method; the wrapper owns this seam entirely.

Wrap actual `ports.process.startRun` once. Require the full binding, durably append start_requested, invoke the fixed real start exactly once. On success **also** confirm its run through the exact consumed claim; on output failure inspect only that persisted admission/slot. Validate stored payload/hash/release/suite/case/task/repetition and selectorHash derived from the private captured token; paired run_id/consumed_at; actual run ID/number/protocol/compiler-release/admission/task identity. Unused/absent/partial/foreign claim after an ambiguous call is unknown, never permission to retry or pick latest. Persist run_bound before returning/recovered run identity to runner. No general repository/SQL-port API expansion is necessary.

Introduce a source-owned internal fatal control error classifier (not string matching user/provider output). Runner `settle` at wrapped admission/start must rethrow this error class unchanged; it may continue to convert ordinary repository/start failures into existing evaluator blockers only when custody/journal facts remain certain. Test both paths. Unknown ownership, journal failure, failed binding, lost start with no exact resolved claim or transport failure without durable cancellation are not ordinary `EVAL_CANARY_ADMISSION_FAILED`/`EVAL_RUN_START_FAILED` completion paths.

## Exact runner control additions and publication order

Keep runner/default ports signatures except `rawOptions.control?`, held outside strict RunnerOptionsSchema parsing. The proposed private interface is:

```ts
interface ConvergenceJobControlV1 {
  beforeCase(value: BoundCaseIdentityV1): Promise<void>;
  onRunStarted(value: BoundCaseIdentityV1 & {
    admissionHash: string; slotHash: string; runId: string;
  }): Promise<void>;
  onRunResult(value: BoundCaseIdentityV1 & {
    runId: string; resultHash: string;
  }): Promise<void>;
  cancellationRequested(): Promise<boolean>;
  requestOwnedRunStop(value: BoundCaseIdentityV1 & {runId:string}):
    Promise<'requested'|'already_terminal'|'refused'>;
  onPhase(value: {
    phase: 'preflight'|'admission'|'case_start'|'case_running'|
      'case_collect'|'publishing'|'finalizing'|'settling';
    currentCaseId: string|null; completedCases: number;
  }): Promise<void>;
  onPublication(value: {
    stage: 'candidate'|'cancelled_final'|'promotion_confirmed'|'final_without_promotion';
    resultHash: string; gateHash: string;
    resultStatus: 'planned'|'pass'|'fail'|'blocked'; gateDecision: 'go'|'no_go';
  }): Promise<void>;
  beforeFinalization(value: {
    resultHash: string; gateHash: string; gateDecision: 'go'|'no_go';
  }): Promise<'cancel'|'continue'>;
}
```

All callbacks are awaited and failures escape ordinary result-conversion wrappers. `onRunStarted` verifies the already-durable worker-wrapper binding and emits safe progress; it does not create a second binding. `onRunResult` runs only after real artifact.put success. `onPhase` reports actual phase transitions, including preflight completion as the next phase; it does not supply fabricated check rows.

Cancellation checkpoints: before the evaluator's preflight effects, before canary creation, before each case/start, on each existing terminal poll (same pollMs/runMs), between actual collection/publication phases, and before finalization. A cancellation observed before the first convergence preflight still permits the existing read-only preflight observations necessary to construct its truthful report; do not launch canary/workflow/provider work or manufacture passing checks. Activation uses a simpler policy: cancel before invocation skips it; once invoked, run the actual six checks/publication exactly once, then retain the report and honor cancellation at its return boundary. No activation hook/source change is needed solely for this policy.

Within terminal wait, a latched cancellation invokes the exact stop adapter once per proved request and continues observing canonical settlement. The adapter obtains `buildRunOperationalSnapshot(sql, exactRunId)`, verifies the bound claim/run again, journals stop intent with the fresh hash, then invokes `executeRunOperationalAction(sql,{action:'stop',runId,expectedSnapshotHash})`. No latest/prefix resolver. Stale snapshot/denied action/uncertain response is refusal/unknown, not success or automatic repeated stop. An independently verified terminal race can return already_terminal; this means no new stop request was needed, **not** proof all owners drained. Task 1 release still supplies the full final proof. Do not start new project sync/collection effects after cancellation if those effects are unnecessary to retain existing evidence. Preserve actual oracle/evidence failures and configured timing; never fabricate a run result merely to reach eight.

Publication order is fixed:

1. Store the candidate aggregate result; compute/store its linked gate; await onPublication(candidate). Those refs stay private.
2. Await beforeFinalization(candidate). It drains accepted channel cancellation, consults the irreversible latch, and durably journals the decision. This is the **last cooperative checkpoint**. If it returns continue for GO, invoke the existing promoteReleaseGo immediately, with no additional awaited operation/callback between them. Its return of continue is the local promotion-attempt boundary; a later-arriving cancel may lose even if its HTTP request was already in flight elsewhere.
3. If cancel wins, build a **new** truthful aggregate with exact `EVAL_CANCEL_REQUESTED` and status blocked, retaining all actual runs/counts/oracles/root causes; store it, compute/store its linked no_go gate with `CONVERGENCE_CANCEL_REQUESTED`, await onPublication(cancelled_final), and return only that final pair. Never promote. Existing immutable candidate files are retained. If the candidate was already this exact cancelled result, reuse the identical content-addressed pair rather than inventing an unrelated mutation.
4. If continue with no_go, await onPublication(final_without_promotion) and return its pair. If continue with GO, await actual promotion return, then onPublication(promotion_confirmed), then return. Journal/transport/call failure after promotion may have begun remains unknown; do not rewrite cancellation evidence or claim rollback/revocation. Actual promotion may have committed despite lost response.
5. Worker awaits owned work/actual canonical settlement, releases latest reservation through Task 1, journals released, calls Task 1 close, verifies/hashes its marker, journals closed, then sends final_closed with **only** final refs. A failure at any uncertain boundary prevents public completed/GO inference. The journal can fail after SF closure; MC then remains unknown although the independent closure marker remains true.

Result-schema change is precisely Root's cancellation refinement in v1, inherited by v2; add only the exact gate code/no_go rule. Uncancelled schemas, pass-with-blockers prohibition, fixed suite/task/oracle/budget/admission semantics remain unchanged. Cancellation after confirmed promotion never rewrites/revokes prior evidence; final receipt may show completed plus cancelRequested=true/too-late code.

## Smallest source/test map and acceptance matrix

| Scope | Files |
| --- | --- |
| SF worker/entry | Already mapped new `src/execution/manual-test-worker-v1.ts`, `src/cli/control-test-worker-v1.ts`: journal, channel adapter, wrappers, exact SQL/snapshot/stop adapters and Task 1 lifecycle. Production CLI uses only the two-argument call; injected effect adapters remain test-only and cannot mint custody |
| Early channel lifetime | Add private `src/execution/manual-test-worker-channel-v1.ts`: one explicit early handshake/listener and uninterrupted in-memory sequencing/cancel state across CLI→worker handoff; no DB/evaluator dependency. Exercise it in the mapped actual entry/worker tests |
| Pure paired ABI | Add `src/execution/schemas/manual-control-worker-channel-v1.ts` and `tests/execution-attempts/manual-control-worker-channel-v1.test.ts`; include pure journal event/frame types, internal fatal-control error type/classifier if shared with runner, no effectful imports. No Task 1 closure extraction/MC marker reader in the recommended version |
| Convergence | Already mapped `src/evals/convergence-runner.ts`; Root-approved additions `src/evals/result-schema.ts`, `src/evals/release-gate.ts`. Direct selected planning/execute enroll/acquire before first artifacts and release/close with SQL still open; unselected CLI behavior unchanged |
| MC | Already mapped `server/services/control-jobs.ts`, `server/services/fresh-installation-runtime.ts`, their tests: fixed spawn/identity, pure ABI import, sole receipt writer and mapping, durable cancel, no-adoption channel lifetime. No new route/public DTO/service configuration |
| Tests | Existing planned `manual-test-worker-v1.test.ts`, `fresh-installation-control-worker-entry.test.ts`, `convergence-eval.test.ts`, `convergence-runner-v2.test.ts`, MC broker/route tests; targeted pure frame tests above. Keep existing execution-attempt runner/owned P3 rules |

Required focused matrix:

- Early gate: invalid source/self/argv/loader/intent/nonce/IPC, foreign child/start/group/command and handshake timeout each produce zero DB/evaluator/provider/publication calls. No fabricated positive selected-entry authority.
- Frames: strict size/key/type/MAC/direction/binding; both sequence spaces; exact retry versus mutated replay/gap; cancel during outstanding progress ACK; receipt CAS races; no raw nonce/selector/task/path/log in public records.
- Journal: immutable chain/head CAS and owner/hash pins; every fsync/publication failure and hostile links/ancestor swap; record-before-head crash; cap reached; no restart adoption; fatal failures escape settle and prevent next effect.
- Admission/start: one real all-slot create/bind before first start, refreshed revision retained; bind/journal failure cannot continue; normal response confirmed by claim; lost output recovers exactly one consumed slot; unused/partial/foreign facts remain unknown with zero retries.
- Cancel: before preflight/canary/case, during exact run, between collection, after all eight, after candidate result, after candidate gate, at finalization boundary, during uncertain promotion, after confirmed promotion. Both v1/v2 preserve actual runs and truthful blocked/no_go cancellation pair; no suite/timing/oracle changes.
- Settlement: fresh exact snapshot/stop; stale/denied/terminal race/live-owner residue; complete Task 1 proof before release; never-reserved refusal closes without journal; closure/journal/final-frame failure leaves MC unknown and refs provisional.
- Transport: lost initial ACK, lost progress ACK, identical retransmit, child exit without final, disconnect while active, broker restart, browser reload, lost final frame, and final ACK lost **after** a proven MC commit. Differentiate endpoint certainty; never infer completion from exit. GET creates no files, revisions, children or repairs.
- Publication: candidate refs never enter active public receipt; cancellation writes a newly hash-linked final pair and preserves originals; promotion happens at most once and only after continue boundary; unknown promotion is neither retried nor revoked; only closure-final frame publishes final report refs.


## Accepted exact paired exports and separate UI worker lifecycle

## 1. Exact shared pure module ABI

File: SF `src/execution/schemas/manual-control-worker-channel-v1.ts`. MC imports the corresponding fixed selected compiled module. All validators are strict; all schemas are source-owned. Zod `ZodType<T>` below specifies exported parse results, not a requirement to cast away schema inference. Export these exact names:

```ts
export const CONTROL_WORKER_CHANNEL_MAX_BYTES_V1 = 16_384;
export const CONTROL_WORKER_JOURNAL_RECORD_MAX_BYTES_V1 = 65_536;
export const CONTROL_WORKER_JOURNAL_HEAD_MAX_BYTES_V1 = 1_024;
export const CONTROL_WORKER_JOURNAL_MAX_RECORDS_V1 = 1_024;

export type ObservedControlWorkerOwnerV1 = Readonly<{
  pid: number; processStartedAt: string; processGroupId: number;
  source: 'observed_os'; executable: string; script: string; commandHash: string;
}>;
export type WorkerJournalRefV1 = Readonly<{revision:number;hash:string}>;
export type WorkerChannelBindingV1 = Readonly<{
  jobId:string; channelId:string; intentHash:string; kind:ControlJobKindV1;
}>;
export type WorkerChannelDirectionV1 = 'broker_to_worker'|'worker_to_broker';

export const ObservedControlWorkerOwnerV1Schema:
  z.ZodType<ObservedControlWorkerOwnerV1>;
export const WorkerJournalRefV1Schema: z.ZodType<WorkerJournalRefV1>;
export const WorkerChannelBindingV1Schema: z.ZodType<WorkerChannelBindingV1>;
export const WorkerChannelBodyV1Schema: z.ZodType<WorkerChannelBodyV1>;
export const WorkerChannelEnvelopeV1Schema: z.ZodType<WorkerChannelEnvelopeV1>;
export const WorkerJournalEventV1Schema: z.ZodType<WorkerJournalEventV1>;
export const WorkerJournalRecordV1Schema: z.ZodType<WorkerJournalRecordV1>;
export const WorkerJournalHeadV1Schema: z.ZodType<WorkerJournalHeadV1>;

export function signWorkerChannelFrameV1(input: Readonly<{
  binding:WorkerChannelBindingV1; direction:WorkerChannelDirectionV1;
  sequence:number; body:WorkerChannelBodyV1; nonce:string;
}>): WorkerChannelEnvelopeV1;

export function verifyWorkerChannelFrameV1(input: Readonly<{
  frame:unknown; binding:WorkerChannelBindingV1;
  direction:WorkerChannelDirectionV1; nonce:string;
}>): WorkerChannelEnvelopeV1;

export function hashWorkerChannelFrameV1(frame:WorkerChannelEnvelopeV1):string;
export function hashObservedControlWorkerOwnerV1(owner:ObservedControlWorkerOwnerV1):string;
export function serializeWorkerJournalRecordV1(record:WorkerJournalRecordV1):Uint8Array;
export function parseWorkerJournalRecordV1(bytes:Uint8Array):WorkerJournalRecordV1;
export function hashWorkerJournalRecordV1(record:WorkerJournalRecordV1):string;
export function serializeWorkerJournalHeadV1(head:WorkerJournalHeadV1):Uint8Array;
export function parseWorkerJournalHeadV1(bytes:Uint8Array):WorkerJournalHeadV1;

export type ControlWorkerFatalCodeV1 =
  | 'CONTROL_CHANNEL_INVALID' | 'CONTROL_CHANNEL_UNAVAILABLE'
  | 'CONTROL_JOURNAL_FAILED' | 'CONTROL_CUSTODY_UNCERTAIN'
  | 'CONTROL_BINDING_FAILED' | 'CONTROL_START_UNRESOLVED'
  | 'CONTROL_PROMOTION_UNCERTAIN' | 'CONTROL_SETTLEMENT_UNCERTAIN';
export class ControlWorkerFatalErrorV1 extends Error {
  readonly code:ControlWorkerFatalCodeV1;
  constructor(code:ControlWorkerFatalCodeV1);
}
export function isControlWorkerFatalErrorV1(error:unknown):error is ControlWorkerFatalErrorV1;
```

`ControlJobKindV1`, `ControlJobReceiptV1`, `ControlReportRefsV1` and `ControlWorkerCustodyV1` are imported from the existing public-schema module; do not redeclare them. Export `WorkerChannelBodyV1`, `WorkerChannelEnvelopeV1`, `WorkerJournalEventV1`, `WorkerJournalRecordV1` and `WorkerJournalHeadV1` types as well as their schemas. The envelope/record/head fields are exactly Root's candidate. A body/journal event discriminates on **`type`**; the envelope wraps it in `body`, journal record in `event`. No second `payload` nesting.

`sign` constructs the fixed envelope header from binding and rejects wrong-kind/direction bodies. `verify` rejects over-limit serialized bytes, extra keys, invalid MAC, wrong expected bindings/direction and wrong-kind bodies, returning the strictly parsed frame or throwing `ControlWorkerFatalErrorV1('CONTROL_CHANNEL_INVALID')`. It does **not** mutate sequence state or establish runtime authority: the channel owner enforces exact sequence/replay/lifecycle and independently observed process/intent. Expected kind comes from pinned immutable intent, never a request Boolean. `custody` must match header job and nonce argument. ACK must match header job and expected receipt kind; full receipt immutable-identity/revision checks remain broker/channel obligations.

MAC input is UTF-8 canonical JSON of the envelope **without `mac`, without trailing newline**. Key is UTF-8 existing nonce bytes. Frame hash is SHA256 of canonical complete envelope **including `mac`, without newline**; owner hash is SHA256 of canonical strict owner JSON without newline. Journal serialization is canonical JSON **plus exactly one newline**; record hash is SHA256 of that serialization. Byte parsers check caps, parse strictly and require byte-for-byte equality with canonical serialization. No timestamp/path/nonce side effects in these helpers. Frame limits apply to canonical encoded size plus a bound on the received JSON encoding; IPC is still the accepted trusted-local transport.

The fatal classifier recognizes only instances created by this canonical module (module-private WeakSet brand plus class identity); plain `{code}`, matching messages or foreign serialized errors are false. Runtime errors from subprocess/provider data are never interpreted as this class. The constructor accepts only the fixed code enum and exposes no raw cause/secret message. This classification only means “must not be swallowed by settle”; it grants no custody/admission/cleanup authority. Production imports must use one canonical compiled module URL, without cache-busting queries.

### Exact SF field spellings

Freeze these payload names from the parent candidate; retain its semantics/phase literals. `Ref` below means WorkerJournalRefV1, `Owner` means ObservedControlWorkerOwnerV1, `Case` means `{caseId,caseHash,taskHash,repetition:1}`. Every object is strict, counters are bounded safe integers, hashes lowercase SHA256, UUIDs canonical, and strings use the existing bounded ID/code validators.

| Body type | Fields after `type` |
| --- | --- |
| `custody` | `custody:ControlWorkerCustodyV1` |
| `ready` | `owner:Owner`, `journal:null` |
| `progress` | `journal:Ref|null`, `phase`, `currentCaseId:string|null`, `ownedRunId:string|null`, `completedCases:number`, `code:string|null` |
| `ack` | `workerSequence:number`, `workerFrameHash:string`, `receiptRevision:number`, `receipt:ControlJobReceiptV1` |
| `cancel` | `requestId:string`, `acceptedReceiptRevision:number` |
| `cancel_observed` | `requestId:string`, `journal:Ref`, `effective:'latched'|'after_boundary'` |
| `fault` | `code:string`, `phase`, `journal:Ref|null` |
| `final_closed` | `journal:Ref|null`, `closureHash:string`, `outcome`, `code:string|null`, `completedCases:number`, `reportRefs:ControlReportRefsV1`, `finalization` |

The existing source-owned safe-code allowlist, not arbitrary error text, applies. SF final refs cannot contain uiReportHash; activation final refs cannot contain result/gate hashes; full8 final refs cannot contain activationHash. Null-journal final_closed requires never_reserved, empty refs and zero completed count. `promotion_confirmed` requires a result/gate pair and completed outcome; cancelled outcome cannot claim promotion_confirmed.

| Journal event type | Fields after `type` |
| --- | --- |
| `acquired` | `kind:'activation_preflight'|'convergence_full8'`, selectionHash, sourceSha, suiteHash, executionMode, `owner:Owner`, `origin:'mission_control'|'direct'`, `reservationRevision:number` |
| `phase` | phase, currentCaseId, completedCases |
| `canary_create_requested` | releaseSha, suiteHash, preflightHash, ttlMs, `slots:readonly {caseId,caseHash,taskHash,repetition:1,slotToken}[]` |
| `canary_bound` | `contexts:readonly {caseId,context:InternalCanaryAdmissionContextV1}[]`, reservationRevision |
| `start_requested` | `case:Case`, admissionHash, slotHash |
| `run_bound` | `case:Case`, admissionHash, slotHash, runId, runNumber, `source:'start_response'|'consumed_claim'` |
| `run_result_stored` | `case:Case`, runId, resultHash |
| `cancel_latched` | `source:'operator'|'channel_lost'`, `requestId:string|null` |
| `stop_requested` | runId, snapshotHash |
| `stop_observed` | runId, `result:'requested'|'already_terminal'|'refused'`, `code:string|null` |
| `artifacts_stored` | stage, resultHash, gateHash, resultStatus, gateDecision — exactly onPublication's shape |
| `finalization_boundary` | resultHash, gateHash, gateDecision, `decision:'cancel'|'continue'` |
| `released` | `heldRevision:number` — latest held input whose real release returned |
| `closed` | closureHash, outcome, `reportRefs:ControlReportRefsV1` |
| `fault` | `code:ControlWorkerFatalCodeV1`, phase |

Refine full8 slot/context arrays to exactly eight unique fixed catalog cases/repetition 1; context's private slotToken remains journal-only. Initial journal revision must be acquired. Schema checks basic cross-field constraints; actual stored-admission/run proof and allowed transition order remain worker responsibilities. A schema-valid event alone proves no effect occurred.

## 2. UI is a separate MC fixture owner

UI never imports/calls SF acquire/bind/release/close, writes an SF journal/marker, or sends final_closed. Its safe private frame bodies are added to the shared pure **data** union only; SF accepts none of them. Keep envelope/MAC/sequencing/ACK/cancel mapping unchanged. Contextual verification permits `ready/progress/cancel_observed/final_closed` only for the two SF kinds and the following variants only for ui_regression. Common custody/ack/cancel/fault remain shared.

```ts
export type UiRegressionWorkerBodyV1 =
  | Readonly<{type:'ui_ready'; owner:ObservedControlWorkerOwnerV1;
      fixtureVersion:string; fixtureHash:string; plannedAssertions:number}>
  | Readonly<{type:'ui_progress';
      phase:'starting'|'running'|'publishing'|'cleanup';
      completedAssertions:number; plannedAssertions:number; code:string|null}>
  | Readonly<{type:'ui_cancel_observed'; requestId:string;
      effective:'latched'|'after_boundary'}>
  | Readonly<{type:'ui_final'; uiReportHash:string; cleanupHash:string;
      ownedCleanup:'confirmed';
      outcome:'completed'|'failed'|'blocked'|'cancelled'; code:string|null;
      completedAssertions:number; plannedAssertions:number}>;
export const UiRegressionWorkerBodyV1Schema:z.ZodType<UiRegressionWorkerBodyV1>;
```

`WorkerChannelBodyV1` includes this union. This is a private version-1 contract being frozen before implementation; public receipt/report DTOs do not change. Reject SF final_closed for UI and ui_final for SF even with a valid MAC. UI final has **no** closureHash/SF reservation revision/resultHash/gateHash. `ownedCleanup:false`, null, unknown or a missing proof is not a terminal variant: send fault/retain unknown instead. A literal confirmed is not authority by itself; acceptance requires all proof below.

Common fault retains the parent candidate's phase enum; UI maps its cleanup failure to `phase:'settling'` and other unresolved ownership to `phase:'ownership_unknown'`. Do not silently widen SF phases to UI-only literals. Its journal is null for UI, and source-owned safe codes classify the failure.

### Original-child handshake and isolation

MC launches only its captured fixed Node and trusted `scripts/ui-regression.mjs --job-id <uuid>` for broker jobs, with the same fd3 channel and original-child identity checks. The script's ordinary standalone `test:ui` invocation remains a separate local fixture mode; its artifacts are never automatically adopted as broker completion. Validate the job-mode self path/argv, current loaded MC build/client/fixture identity, pinned intent and nonce before opening 13082 or launching a browser. Parent uses actual loaded MC build identity; no current-HEAD substitution.

The plan strips installation selectors/PG URLs/operational credentials from UI fixture child environments. Preserve this. For the broker UI worker bootstrap, pass **one fixed read-only fd4 for the already-open O_NOFOLLOW pinned immutable intent**, in addition to fd3; the public request cannot choose a path/descriptor. Worker reads at most the existing intent bound, checks descriptor/path pins, derives only the fixed job siblings from that source-owned record, and matches initial custody nonce/job/source/selection/MC build. This avoids importing prepared MC/SF runtime composition or propagating credential-bearing selection to fixtures. Load only the fixed selected **pure** SF frame module at the release path bound in that intent and the fixed trusted MC protocol/report module; no request-selected import. Broker's already-validated captured selection and original channel are the launch authority, not fd4 contents alone. Fixture server/browser descendants receive neither inherited custody descriptors nor installation/PG/token/loader environment. No new credential is minted.

Persist a private `ui-worker/owner.json` bound to jobId/intentHash/original owner hash/MC source/build/fixture identity before fixture effects. Maintain bounded immutable child lifecycle records under `ui-worker/children/` for every intended child launch: record spawn intent before launch and exact observed child/handle identity afterwards. Ambiguous launch stays unknown, never treated as never-started. In-process fixture server ownership is captured separately by its actual server handle and successful bind; an occupied 13082 belongs to someone else and is never killed. No changes to 13081 smoke behavior.

### Actual report plus definite owned cleanup

Use fixed per-job private artifacts `ui-worker/artifacts/<sha256>.json` and `<sha256>.png`, with schema/manifest selecting type. Report/cleanup JSON hashes are SHA256 of canonical strict JSON plus newline; screenshots hash exact PNG bytes. Exclusive/fsynced single-link private files and pinned safe parents; report/cleanup <=1 MiB each, <=2,048 named assertions and <=512 screenshots; each screenshot <=16 MiB. These are artifact safety limits, not test-suite pass shortcuts. Artifact IDs never encode physical paths.

MC's pure `server/services/control-ui-worker-protocol.ts` exports the existing strict `UiRegressionReportV1Schema` and new `UiRegressionCleanupProofV1Schema`. The script imports its fixed built module. Cleanup proof is exactly:

```ts
type UiRegressionCleanupProofV1 = Readonly<{
  schema:'mission-control.ui-regression-cleanup.v1';
  jobId:string; intentHash:string; ownerHash:string;
  mcSourceSha:string; mcBuildHash:string; fixtureHash:string;
  uiReportHash:string;
  server:'not_started'|'closed'; browser:'not_started'|'closed';
  children:readonly Readonly<{
    spawnId:string; owner:ObservedControlWorkerOwnerV1|null;
    state:'not_started'|'closed';
  }>[];
}>;
```

Refine not_started to null owner and positively proven no created resource; closed to captured exact owner plus actual owned-handle exit/closure and no retained owned descendants. Bound children to 256, unique spawn IDs, and require every durable spawn intent has exactly one disposition. A timeout/PID disappearance alone is insufficient. Browser.close/server.close completion and captured child lifecycle settle the resources that this worker actually created; ambiguous descendants, PID reuse, unconfirmed handle close or pending child publication means unknown. Cleanup never touches unrelated process groups/listeners and never claims worker exit itself as fixture cleanup.

Worker runs actual assertions/screenshots, retains partial/fail report, closes only its captured browser/server/children, validates complete own lifecycle, then publishes cleanup proof bound to the immutable report and sends authenticated ui_final. `finishedAt` must be nonnull for a terminal report. MC validates report/cleanup bytes, exact hashes/schema/loaded MC source/build/fixture identity, original owner binding, complete manifest and assertion counts before committing a terminal receipt. Screenshot reads remain manifest-only/nonmutating. Successful runner return or child exit without this original-channel final proof is unknown. Never infer pass from counts; pass requires the full fixed assertion catalog's actual successful results. Failed/incomplete reports can still be retained after confirmed cleanup.

UI receipt projection: ui_ready establishes starting; first actual running progress establishes startedAt; completedCases/plannedCases map to completed/planned **named assertions**, fixed by fixture catalog at ready, never screenshots or SF's eight cases. currentCaseId/ownedRunId remain null. reportRefs stays empty until accepted ui_final, then exactly `{uiReportHash}`. Ordinary report pass/fail with definite cleanup can complete the job; blocked startup and honored cancel use blocked/cancelled with actual incomplete/fail report. None qualifies an SF release.

### Cancellation and disconnection

Use the existing durable broker cancel record and signed cancel frame. UI latches it before its own observation ACK, starts no further assertions/screenshots/children and cooperatively stops current fixture activity through its owned handles. Add only optional `control?:{cancellationRequested():boolean; onProgress(value:{completedAssertions:number;plannedAssertions:number}):Promise<void>}` to the plan's `runUiRegressionV1` input; its supplied Browser is not itself custody proof. The outer fixed UI worker owns launching and cleanup; injected test browsers simulate behavior but cannot establish production ownership.

Before-child cancellation still writes a truthful incomplete report and proves no resources started. Mid-test cancellation retains completed assertions/screenshots and publishes incomplete report; it then performs definite owned cleanup before ui_final/cancelled. Channel loss follows the same cooperative stop/cleanup policy with no reconnect; if final cannot reach the original broker, the receipt remains unknown. Cancel after the worker's durable final report/cleanup decision is late: no rewrite/delete of a completed immutable report, and the broker may complete with cancelRequested true/too-late code. A report write/cleanup proof failure prevents ui_final; no fake SF marker or process-absence shortcut. Restart rules and lost final ACK after definite MC commit are exactly the accepted parent protocol.

Make that UI boundary explicit: retain a candidate report before cleanup so cleanup failure never loses actual assertions/screenshots. After definite owned cleanup, check the cancel latch once and durably record the final decision. If cancellation won during reporting/cleanup, append a new immutable report with outcome incomplete and the same actual assertions/screenshots, preserving the prior candidate. Publish cleanup proof linked to this **final** report hash, then ui_final. A cancellation delivered after that local final decision is late and never interrupts cleanup or rewrites evidence. Only the final pair reaches the receipt. This introduces no SF result/gate semantics.

## 3. Replace metadata-only ManualWorkerPort with an original session

The broker owns durable receipt/sequence/ACK mapping and constructs signed frames. The port owns fixed spawn, independent child observation, bounded original-channel transport and lifecycle notifications. It never commits a public receipt or interprets process exit as completion. Exact internal types:

```ts
type ManualWorkerEventsV1 = Readonly<{
  onFrame(frame:unknown):Promise<void>;
  onUnavailable(reason:'disconnect'|'exit'|'error'|'overflow'):Promise<void>;
}>;
type OriginalManualWorkerSessionV1 = Readonly<{
  binding:WorkerChannelBindingV1;
  originalChild:ObservedControlWorkerOwnerV1;
  executableHash:string;
  beginDelivery(events:ManualWorkerEventsV1):void;
  send(frame:WorkerChannelEnvelopeV1):Promise<void>;
}>;
interface ManualWorkerPortV1 {
  startFixed(input:Readonly<{
    intent:ControlPrivateIntentV1;
    custody:ControlWorkerCustodyV1;
    binding:WorkerChannelBindingV1;
  }>):Promise<OriginalManualWorkerSessionV1>;
}
```

`startFixed` derives kind/path/argv from validated captured composition, pins the exact intent and performs at most one spawn. Install low-level listeners immediately; buffer at most the accepted 16 frames/16 KiB each until **one** beginDelivery call, which starts ordered delivery only after returning. The broker stores the returned original session, invokes beginDelivery, then sends signed custody. Child emits no authorized work before custody/ready ACK. This prevents a synchronous fake/fast real child from racing handler installation. No reattach/beginDelivery twice or replacement child is supported.

`send` resolves on the IPC transport's send completion only; it never implies peer validation, durable receipt or cleanup. `onFrame` is serialized with broker's per-job state operations. Only after durable receipt+mapping commit does broker call send(ack). The separate `requestOwnedCancellation(intent)` method is removed: broker durably accepts cancellation then sends the bound signed cancel on this original session. No generic kill/run/path method is exposed. Unknown/absent session cannot be reconstructed on restart.

Test fakes implement this **same** interface and delivery ordering, supply bounded simulated frames, capture outgoing custody/ACK/cancel and emit explicit unavailable events. Existing tests using only `{pid,startedAt,executableHash}` or successful start/exit as terminal must be updated; no production fallback to that obsolete shape. Positive fake-port tests remain component evidence, not selected compiled custody/runtime qualification.

## Exact narrow additions and verification cases

- SF pure schema module: freeze the above exports, SF journal field names, fatal classifier and contextual UI body union; add pure crypto/hash golden vectors, extra-key/size/nonce/direction/sequence-data/kind rejection tests. State/replay enforcement remains runtime tests. No SF Task 1 source/schema changes.
- MC mapped broker/runtime files/tests: replace ManualWorkerPort signature and fake ports, original-session handler ordering, separate SF/UI terminal dispatch, persisted ACK/CAS/cancel and restart refusal. Add MC pure `server/services/control-ui-worker-protocol.ts` for report/cleanup validators; fixed `.mjs` worker consumes its compiled output. Existing mapped `scripts/ui-regression.mjs`, fixtures and contract tests own UI implementation.
- Test valid-MAC wrong-kind final rejection; UI never calls any SF admission/closure API; UI pass/fail/early-cancel/mid-cancel/late-cancel/occupied-port/report-failure/cleanup-failure/unknown descendants; original-child/MC-build/fixture/hash/manifest mismatch; exit without final unknown; complete report plus unconfirmed cleanup unknown; no secrets/selection/IPC handles inherited by fixture descendants; browser reload and broker restart retain the accepted distinction.


## Root integration rulings for this accepted private contract

This section is accepted before implementation and supersedes candidate wording. Public receipt/request schemas remain unchanged. The protocol is private data/transport, never operational authority. SF Task1 source review and actual15RAW/17PG/70adjacent passed; real compiled entry/build/live/full8 are still later gates.

The fixed MC UI job worker is **`dist-server/scripts/ui-regression.mjs --job-id <uuid>`**, copied byte-for-byte with `ui-regression-fixtures.mjs` from the source-owned scripts by the stock MC build before its existing content identity calculation. Both copies therefore belong to the loaded dist-server content hash. Broker captures only that built fixed path, not an unmeasured source script. `test:ui` also uses this trusted built entry after a stock build. The two source .mjs modules remain the editable source, and their fixed built layout resolves pure protocol/report modules without importing SQL-owning composition. This replaces the candidate source-script production path. No build identity algorithm or validator exemption changes. Cost if wrong: refuse the worker/build until source-owned copy/topology is corrected; never trust a mismatched current checkout or widen path inputs.

Root accepts fixed read-only inherited intent fd4 only for MC UI job bootstrap, in addition to fd3; parent pins it O_NOFOLLOW and worker rechecks exact immutable descriptor/path/intent/nonce/build facts. Fixture descendants receive neither custody descriptor nor credentials/installation/PG/loader environment. This is no new credential or external authorization. UI completion requires its own retained report plus definite original-worker-owned cleanup proof; never SF final_closed or a fake SF closure marker.

The current real13081 render smoke cannot yet run safely: source inspection found inherited credentials/default upstreams and missing owned DB/mock/egress fences. A separate MC Controls Task4 will add bounded source-owned isolation fixtures. Preserve its exact ordered six routes, port13081 and actual MC-proxied strict sealed V3 packet requirement; no default-mount/production credit from the separate13082 UI fixture.

## Private safe codes and captured internal MC composition

Root ruling before implementation: the existing public Code regex is not a private safe-code allowlist. The pure SF channel module additionally exports `ControlWorkerSafeCodeV1` and `ControlWorkerSafeCodeV1Schema` for exactly: `CONTROL_CHANNEL_INVALID`, `CONTROL_CHANNEL_UNAVAILABLE`, `CONTROL_JOURNAL_FAILED`, `CONTROL_CUSTODY_UNCERTAIN`, `CONTROL_BINDING_FAILED`, `CONTROL_START_UNRESOLVED`, `CONTROL_PROMOTION_UNCERTAIN`, `CONTROL_SETTLEMENT_UNCERTAIN`, `CONTROL_CANCEL_TOO_LATE`, `CONTROL_CANCEL_REQUESTED`, `CONTROL_JOB_BLOCKED`, `CONTROL_JOB_FAILED`, `CONTROL_CHANNEL_READY`. Nullable private frame code fields use only this enum. The fatal class retains its existing eight-code subset. Normal progress uses null. Actual activation/evaluation check codes remain in source reports; no provider exception/log text crosses private or public progress. Existing bounded public HTTP error codes are a separate contract, not aliases permitted in private frames. Cost if wrong: refuse unsupported private codes and correct focused tests, never broaden to arbitrary caught messages.

Root accepts composition-only `SelectedControlRuntimeV1` fields for authoritative pure schemas/channel modules and captured `assertUnchanged:()=>void|Promise<void>`, awaited before effects. These come only from fixed trusted prepared startup composition; no request-controlled module/path/function or copied authority validator. Preserve `createControlJobsV1({root,selected,worker})` and exact original-session worker interface. The UI fixture identity is captured only from trusted measured built assets; unavailable assets refuse UI launch without fabricated identity or effects. Pure-module shape types may be described locally for bundling; the actual fixed compiled source validators remain authoritative. Cost if wrong: Controls refuses the unsupported selection; no fallback to current source or invented runtime qualification.

## Exact independent OS owner observation convention

Root actual-child evidence corrected the earlier combined ps command: macOS truncates a non-final comm column despite -ww, so the old Task1 observer refuses a valid long-path Node. Preserve its UTC ISO timestamp and exact raw args hash; change only executable observation to bounded stable metadata/args → separate comm-only → equal metadata/args. Use `/bin/ps -ww -p <PID> -o lstart= -o pgid= -o args=` for the first/last exact matching snapshots and `/bin/ps -ww -p <PID> -o comm=` for the full last-column executable. Fixed PATH `/usr/bin:/bin:/usr/sbin:/sbin`, LANG C, LC_ALL C and TZ UTC; zero stderr, bounded timeout/output, any inconsistency refuses. `processStartedAt` is `new Date(capturedLstart + ' UTC').toISOString()`. `commandHash` is SHA256 of UTF-8 exact captured args field excluding row newline, with no trim/normalization/reconstructed argv. Require realpath(full comm) equal the canonical captured executable, exact fixed executable/script/argv/job, and actual child parent relation inside stable observations. Spawn with canonical executable; do not relax argv prefix to accept aliases. No lsof/proc_pidpath/new privilege/time tolerance or substring absence. The Task1 helper and early SF channel use the same refined observation; broker independently observes its actual original ChildProcess, never trusts a claimed identity alone. Before edit add actual owned-child RED for old helper/early channel, explicit self-timeout and owned-handle cleanup, no ports/selection/DB/provider; then GREEN and proportional affected raw/PG re-verification by Root. This is a necessary in-goal startup root fix, not a guard bypass. Cost if wrong: retain custody refusal/unknown and fix observations; never weaken identity or silently count untested activation.

## MC HTTP evidence envelope and initial selection metadata

Root resolves the initial-launch metadata gap with a separate strict MC HTTP wrapper. Existing `ControlEvidenceResponseV1`, SF projections, receipts and launch/cancel request bodies stay unchanged. `GET /api/controls/evidence` and client `getControlsEvidence()` return exactly:

```ts
export type ControlEvidenceEnvelopeV1 = Readonly<{
  schema:'mission-control.controls-evidence-envelope.v1';
  selectionHash:string|null;
  evidence:ControlEvidenceResponseV1;
  history:readonly Readonly<{
    id:string; sourceSha:string; evidence:ControlEvidenceProjectionV1;
  }>[];
}>;
```

The selected hash comes only from captured unchanged prepared composition; null means unavailable/unconfigured and disables launch. History is at most50 opaque stable IDs and source hashes from the explicit validated private SF evidence index, never a directory/latest scan; no raw path/log/task/selector. UI job/report history remains its own indexed source, not fabricated SF projection. Jobs stays its own endpoint and is not duplicated in this envelope. Parse the wrapper strictly in mapped MC evidence/route/client tests; never upgrade qualification from a completed job/count/GO file. Cost if wrong: refuse unavailable metadata/evidence and correct the wrapper/client together; no new authority or implicit job start.

## Accepted two-level evidence qualification

Root accepts the bounded private admission-composed reader below before SFTask3 and its MC composition edit. It fixes a concrete proof gap: immutable GO files alone do not prove separate committed admission promotion. The unchanged filesystem-only reader leaves current GO unqualified; historical stays historical. Exact committed source-owned admission observation enables qualified without changing receipt ownership, starting work or granting workflow authority. Public projections/inputs/receipt/request schemas and Task2 worker protocol are unchanged. Follow the already existing admission deep artifact/hash semantics; never call the mutating store/repository from GET.

## Exact minimal private export

Create `src/evals/control-evidence-admission-reader-v1.ts` with this sole cross-repository function:

```ts
import type postgres from "postgres";
import type {
  ControlEvidenceExpectedV1,
  ControlEvidenceProjectionV1,
} from "../execution/schemas/manual-control-job-v1.js";

export function readSelectedControlEvidenceWithAdmissionV1(
  input: ControlEvidenceExpectedV1,
  sql: postgres.Sql,
): Promise<ControlEvidenceProjectionV1>;
```

The SQL argument is a private capability supplied exclusively by the selected MC composition's captured owner. It is never a DTO, HTTP argument, callback supplied by a request, returned admission object, or predicate such as `promoted: true`. The adapter owns both the filesystem read and the fixed SQL; it never accepts an externally constructed projection to upgrade. Type-only `postgres` import erases at runtime. No new factory, cache, global DB client, or initialization API.

Algorithm:

1. Call the unchanged `readSelectedControlEvidenceV1(input)`. Its default current qualification is `unqualified`; historical remains `historical`. Require the full reader-validated current, execute, pass, exact eight-case result with linked, recomputed GO gate. Any planned, partial, failed, blocked, no-GO, historical, unavailable, malformed, or unsafe artifact evidence returns without querying admission. Counts alone are insufficient. Retain all original artifact checks and selected identity/ancestor pins.
2. For this valid GO candidate only, use the supplied `sql.begin('isolation level repeatable read read only', ...)`. Set transaction-local lock/statement timeouts to the existing composition's 1000/5000 ms values with `pg_catalog.set_config`; qualify the table as `public.v3_release_admissions`. Do not create a connection, migrate, promote, lock rows `FOR UPDATE/SHARE`, or call any repository. Read exactly:

   ```sql
   SELECT admission_hash, kind, release_sha, suite_hash,
          result_hash, result_ref, gate_hash, gate_ref, expires_at, payload
     FROM public.v3_release_admissions
    WHERE kind = 'release_go' AND release_sha = $1
    LIMIT 2
   ```

   Bind the schema-validated expected release SHA. Zero rows means missing proof; two means conflict. For one row, parse `V3ReleaseAdmissionV1Schema`, require `kind='release_go'`, recomputed admission hash, canonical refs, null expiry, and exact scalar/payload agreement as in `parseAdmissionRow`. Match release/suite and result/gate hashes/refs to the already validated expected artifacts. A legitimate admission pointing at another result/gate does not qualify these refs.
3. Upgrade only after the read-only transaction resolves successfully. Recheck selected installation identity after all asynchronous work. MC additionally rechecks the captured context, selected identity, compiled module pins, and unchanged owner before and after the adapter call. Guard/identity failure is the existing fail-closed selection failure; never catch it as an ordinary missing admission.
4. Successful exact observation changes only `evaluation.report.qualification` to `qualified` and clears the candidate's admission-observation availability code. Preserve all artifact statuses, runs/counts, checks, hashes, and blocker codes. This reports the committed admission observed at the read snapshot; it does not authorize a workflow, replace workflow admission checks, or adopt any worker.

No full canary-evidence replay is required on GET: `promoteReleaseGo` already requires that evidence in the transaction that stores this authoritative row. Reading a caller-constructed payload would not establish that fact; reading the captured selected DB does. Do not broaden this adapter into a new admission authority.

## Missing and uncertain proof

Use the existing `evaluation.availability` shape. Valid artifacts remain `state:'available'` with their report and `qualification:'unqualified'`; safe observation codes explain why qualification was not established:

| Condition | Code |
| --- | --- |
| FS-only current GO candidate, no admission observation | `CONTROL_RELEASE_ADMISSION_UNOBSERVED` |
| No release GO row | `CONTROL_RELEASE_ADMISSION_MISSING` |
| Multiple release GO rows | `CONTROL_RELEASE_ADMISSION_CONFLICT` |
| Malformed payload/hash, scalar mismatch, wrong linked tuple | `CONTROL_RELEASE_ADMISSION_INVALID` |
| Query, timeout, permission, connection, or transaction completion failure | `CONTROL_RELEASE_ADMISSION_UNKNOWN` |

These codes explain projection availability/qualification; they are not inserted into result-derived `blockerCodes`. Missing admission is not missing artifact evidence. Never replace actual pass/GO with fabricated blocked/no-GO artifacts. Existing artifact errors keep their original availability/state/code. Historical evidence stays historical. Catch failure around the **whole transaction**, including its completion; observing a row followed by transaction failure must not leak a qualified result. Selection/module/owner checks occur outside that DB-error catch. No cached positive or stale fallback after a failed observation.

## MC composition and File Map

- **SF create:** `src/evals/control-evidence-admission-reader-v1.ts`, imports only the FS reader, selected read-only selection helpers, pure admission/schema/canonical helpers, and erased SQL types. No runtime import of `db`, admission repository, report store, preflight execution, runner, spawner, or evaluator. Existing pure schema extraction and FS-reader work remain as planned.
- **SF test:** `tests/evals/control-evidence-reader-v1.test.ts` asserts FS GO stays unqualified; new `tests/evals/control-evidence-admission-reader-v1.test.ts` covers exact observation and readonly composition. Repository production promotion logic is unchanged.
- **MC edit:** `server/services/fresh-installation-runtime.ts` adds/pins/imports the fixed compiled `evals/control-evidence-admission-reader-v1.js`, validates its export, and replaces direct `readEvidence` assignment with a wrapper that calls `assertUnchanged()`, awaits `adapter.readSelectedControlEvidenceWithAdmissionV1(expected, captured.owner)`, then calls `assertUnchanged()` again. Preserve the existing private `SelectedControlRuntimeV1.readEvidence(input)` signature. Keep the original fixed FS module pin as well; this is an additional private module, not a worker entrypoint/index replacement.
- **MC tests:** selected-runtime/Controls composition tests must establish that only the captured owner is supplied, that selection/owner/module drift refuses before and after an await, and that HTTP cannot inject a SQL client, admission payload, or qualification override. Root assigns the exact existing test file after the active MC writer freezes.
- **Root-owned paired plans/File Map:** record the added private compiled export and two-level qualification rule. Public schemas/routes/receipt and Task 2 worker exports remain unchanged. Serialize the MC seam edit with its current writer; this report is not authorization for concurrent edits.


### Root required focused verification and boundaries

Add pure adapter tests plus existing P3-owned real-PG integration through a new `tests/execution-attempts/control-evidence-admission-reader-v1.isolated-pg.test.ts`, registered in the existing OWNER_BACKED_TESTS by SFTask3. Root alone runs protected PG. Use actual production promotion with valid committed fixture prerequisites, never hand-insert a positive authority row or use a synthetic promoted boolean. Verify files before promotion unqualified, actual committed exact admission qualified, rollback/uncommitted other-connection row not qualified, transaction completion failure cannot leak positive, and no data/DDL/filesystem writes or DB preparation/new client in reader. Component fixture evidence remains distinct from actual full8/live qualification. Selection/module/owner drift must fail outside ordinary DB-error catch. Missing/conflicting/invalid/unknown admission retains truthful available artifacts with safe qualification observation code, never fabricated blocked/no_go reports. SQL capability is only MC captured selected owner, never HTTP, globals or a caller assertion. Cost if wrong: unqualified/unknown evidence and reviewed correction, never false GO/adoption or borrowed DB authority.
