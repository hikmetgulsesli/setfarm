# Subscription attempt adapter design

## Goal and authorized boundary

Compose the existing subscription broker with deterministic capability-only OpenClaw launch material and parent-owned joint custody. Deliver two inert Source modules and their focused fake tests. This is preparatory source integration; it does not start workers, read credentials, confer admission, or finish operational integration.

Root adopted this slice under the user's continue/new-model objective and Standing Owner Authorization. Root alone owns staging, commits, delivery and any later operational decision. Source edits are serialized in the existing sole writer. No spawner, selected profile, installation, OS, runtime guard, eval suite, dependency or broker/redactor changes belong to this slice.

The causal defect is SDK persistence of a supplied credential after source reread failure. The broker removes that credential from the SDK. The adapter addresses the next necessary boundaries: constructing launch data without inherited auth and joining broker custody with worker custody. It is not a general model router or credential manager.

## Existing boundaries

Baseline is main6e2dbab4. Consume the broker's existing types/factories/custody unchanged (`src/execution/subscription-attempt-broker-v1.ts:7-112,195-228,490-510`). The private headless two-case qualification is `logs/2026-10-21-controls-current-evidence-v1/subscription-broker-headless-v2-original-root-qualification-20261026-v1.json`, SHA256 `083cce4aa632dfb0519d15a399ca7d3c3f150666519c1e4c6a2530f5f831932b`. It proves fake-provider Read/thinking-shape compatibility with all children denied, not real exec/OS/admission/full8 or this new materialization. Do not repeat installed SDK/provider trials.

Selected Codex remains required (`src/spawner.ts:323-328,358-374`; `src/installation/fresh-installation-v3-profile-v1.ts:16-48`). Legacy config/env inheritance (`spawner.ts:3426-3440,3532-3571`) is not safe for this future route. Existing operational Source/DB admission, reader/native/full8 and provider/model matching remain unchanged.

## File Map

| File | Responsibility |
| --- | --- |
| `src/execution/subscription-attempt-launch-material-v1.ts` | Pure exact-binding projection to private paths, configuration, environment and public CLI arguments. |
| `tests/execution-attempts/subscription-attempt-launch-material-v1.test.ts` | Pure projection, refusal, serialization and inert-import tests. |
| `src/execution/subscription-attempt-custody-v1.ts` | Parent lifecycle composition of original broker/worker closure promises, bounded publication, fixed sanitized result. |
| `tests/execution-attempts/subscription-attempt-custody-v1.test.ts` | Controlled-promise lifecycle tests plus at most one existing synthetic broker composition test without requests. |
| This spec and `docs/superpowers/plans/2026-10-26-subscription-attempt-adapter-v1.md` | Adopted requirements and executable handoff. |

## Shared constraints

- ESM TypeScript, explicit `.js` imports, existing Node APIs, no new dependencies.
- Both modules are import-inert. Type-only imports of existing broker types are preferred; launch code may import only `node:path` and `node:crypto` at runtime. Custody code needs no runtime imports.
- No real credential, credential lookup, ambient environment read, shared config copy, executable override/resolution, SDK import, SQL, filesystem effect, listener, worker spawn or provider request in either new module.
- No production importer or environment switch. No `admitted` flags, receipt-shaped approval inputs, custom clock/scheduler or policy override in the public constructor.
- Object shape validation proves shape only, never admission, entitlement, exact process ownership, physical path protection or OS isolation. In-memory lifecycle ports are not durable authority.
- Exact production broker and redactor remain unchanged. Tests never call the production broker constructor.
- No retry, fallback, alternate adapter, provider purchase or PAYG path. Fresh attempt/generation requires a fresh broker capability.
- Tests use fake literals and controlled promises. Root admits at most one bounded synthetic broker listener composition case with no upstream request, no SDK, no actual worker and no extra mock server.
- Root alone commits/delivers; full guarded build follows reviewed normal merge in a fresh exact clean-main release. No dirty-build or runtime-guard bypass.

## Launch-material API

Export these exact interfaces and function from `subscription-attempt-launch-material-v1.ts`:

```ts
import type { SubscriptionAttemptBrokerWorkerV1 } from './subscription-attempt-broker-v1.js';

export type SubscriptionAttemptIdentityV1 = Readonly<{
  attemptId: string;
  generationId: string;
  modelRef: SubscriptionAttemptBrokerWorkerV1['modelRef'];
}>;
export type SubscriptionAttemptLaunchInputV1 = Readonly<{
  identity: SubscriptionAttemptIdentityV1;
  worker: SubscriptionAttemptBrokerWorkerV1;
  root: string;
  prompt: string;
}>;
export type SubscriptionAttemptPrivateFileV1 = Readonly<{
  path: string;
  mode: 0o600;
  contents: string;
}>;
export type SubscriptionAttemptLaunchMaterialV1 = Readonly<{
  schema: 'setfarm.subscription-attempt-launch-material.v1';
  profile: 'private-headless-readonly-v1';
  identity: SubscriptionAttemptIdentityV1;
  sessionId: string;
  cwd: string;
  directories: readonly string[];
  files: readonly SubscriptionAttemptPrivateFileV1[];
  env: Readonly<Record<string, string>>;
  argv: readonly string[];
}>;
export function buildSubscriptionAttemptLaunchMaterialV1(
  input: SubscriptionAttemptLaunchInputV1,
): SubscriptionAttemptLaunchMaterialV1;
```

There is no input for limits, tool permissions, shared config, executable, provider credential or environment. Fixed profile timeout is20seconds, catalog maxTokens2048, contextWindow200000, one worker and only Read. These catalog values preserve the private fixture shape; they are not new provider-maxima or entitlement claims. A future owner must separately enforce actual broker reservations/deadlines; material alone cannot establish their consistency.

### Validation

Validate every supplied record as an exact plain own-data-property object (`Object.prototype` or null prototype), rejecting symbols, unknown fields, accessors and malformed fields without invoking getters/coercion/toJSON. All failures, including reflective Proxy traps, throw only `new Error('SUBSCRIPTION_LAUNCH_INPUT_INVALID')`; never interpolate input. No effect follows invalid input.

Identity has exactly attemptId/generationId/modelRef. IDs match `/^[A-Za-z0-9_-]{1,128}$/`. ModelRef is exactly `minimax/MiniMax-M3.1-Flash` or `kimi/k3.1-pro`. Worker has exactly the existing ten fields: attemptId, generationId, modelRef, providerId, modelId, baseUrl, api, apiKey, auth, authHeader. It must match identity and exact corresponding raw provider/model; API=`anthropic-messages`, auth=`api-key`, authHeader=true. Capability must match `/^[A-Za-z0-9_-]{43}$/`, the existing32-byte base64url capability shape. This is not a proof it originated from a broker.

Base URL must exactly match `http://127.0.0.1:<canonical-decimal-port>/v1`, port1..65535 with no leading zeros and excluding3080,3333,18789. Require URL canonical string equality; reject credentials, query, fragment, alternate host/IP spelling, HTTPS and trailing slash. The operating system chooses the actual broker port; shape validation cannot prove it is owned or ephemeral.

Root is a string of1..1024 characters, starts `/`, is not `/`, has no trailing slash, backslash, control character or DEL, and equals `path.posix.normalize(root)`; reject `//`, `.` or `..` segments before normalization. Spaces are allowed. No fs/realpath call: root's real ownership, symlink/mount aliasing and0750/0700 protection belong to later materialization admission. Prompt is a string with1..65536 UTF-8 bytes, no NUL; it is passed as one argv value, never shell code. Do not call user methods to calculate bytes.

Copy only validated scalar fields. Freeze the result and every nested record/array. Do not retain caller object references.

### Exact material

Derive all paths using POSIX joins beneath root. Ordered directories are:

```text
home
state
state/agents
state/agents/subscription-worker
state/agents/subscription-worker/agent
state/agents/main
state/agents/main/agent
xdg
xdg/config
xdg/cache
xdg/data
xdg/state
tmp
work
```

List each as an absolute path. Do not create directories. The later authorized materializer must create private owned directories and files without symlink following; the data adapter cannot promise it has done so.

`sessionId = 'sfsub-' + SHA256(JSON.stringify([attemptId,generationId,modelRef]))` using the full lowercase64hex digest. `cwd = root + '/work'`. Agent ID is fixed `subscription-worker`. argv is exactly:

```ts
['agent', '--local', '--json', '--agent', 'subscription-worker',
 '--session-id', sessionId, '--message', prompt, '--timeout', '20']
```

No executable or shell string is returned. Exact model is bound in the generated single-provider/single-agent config. The plan does not invent a new CLI `--model` behavior.

Environment has exactly these entries, with ROOT substituted by the normalized input root:

```text
HOME=ROOT/home
OPENCLAW_HOME=ROOT/home
OPENCLAW_STATE_DIR=ROOT/state
OPENCLAW_CONFIG_PATH=ROOT/config.json
PI_CODING_AGENT_DIR=ROOT/state/agents/subscription-worker/agent
XDG_CONFIG_HOME=ROOT/xdg/config
XDG_CACHE_HOME=ROOT/xdg/cache
XDG_DATA_HOME=ROOT/xdg/data
XDG_STATE_HOME=ROOT/xdg/state
TMPDIR=ROOT/tmp
TMP=ROOT/tmp
TEMP=ROOT/tmp
PATH=/usr/bin:/bin
LANG=en_US.UTF-8
TZ=UTC
NO_COLOR=1
NODE_DISABLE_COMPILE_CACHE=1
OPENCLAW_NO_RESPAWN=1
OPENCLAW_PATH_BOOTSTRAPPED=1
OPENCLAW_LOG_LEVEL=silent
OPENCLAW_AUTH_STORE_READONLY=1
OPENCLAW_TRAJECTORY=false
```

This does not include NODE_OPTIONS or the private experiment's preload guard. A later launcher must provide its reviewed actual guard/isolation separately; the material is not permission to launch an unguarded worker. PATH is fixed for this read-only profile; adding coding tools is a separate qualified profile.

Return exactly three files, all mode0600, `JSON.stringify(value, null, 2) + '\n'`: ROOT/config.json then the two derived agent auth-profiles.json files (subscription-worker and main). Each auth file is `{version:1,profiles:{}}`. The exact config object is:

```ts
const p = worker.providerId, m = worker.modelId, q = identity.modelRef;
const config = {
  logging: { level: 'silent', consoleLevel: 'error', file: root + '/openclaw.log' },
  diagnostics: { enabled: false, otel: { enabled: false }, cacheTrace: { enabled: false } },
  update: { checkOnStart: false, auto: { enabled: false } },
  proxy: { enabled: false }, plugins: { enabled: false },
  acp: { enabled: false, dispatch: { enabled: false } },
  models: { mode: 'replace', pricing: { enabled: false }, providers: {
    [p]: { baseUrl: worker.baseUrl, api: 'anthropic-messages', auth: 'api-key',
      authHeader: true, apiKey: worker.apiKey, agentRuntime: { id: 'pi' },
      request: { allowPrivateNetwork: true },
      models: [{ id: m, name: m, reasoning: true, input: ['text'],
        contextWindow: 200000, maxTokens: 2048, agentRuntime: { id: 'pi' } }] }
  } },
  agents: {
    defaults: { timeFormat: '24', agentRuntime: { id: 'pi' },
      model: { primary: q, fallbacks: [] }, models: { [q]: { agentRuntime: { id: 'pi' } } },
      workspace: root + '/work', skipBootstrap: true, skills: [],
      startupContext: { enabled: false }, memorySearch: { enabled: false },
      timeoutSeconds: 20, maxConcurrent: 1 },
    list: [{ id: 'subscription-worker', default: true, workspace: root + '/work',
      agentDir: root + '/state/agents/subscription-worker/agent',
      model: { primary: q, fallbacks: [] }, skills: [] }]
  },
  tools: { allow: ['read'], fs: { workspaceOnly: true },
    web: { search: { enabled: false }, fetch: { enabled: false } },
    agentToAgent: { enabled: false }, elevated: { enabled: false } }
};
```

No gateway configuration or port is returned; `--local` is explicit. There is no permission here to contact a gateway. Omitting the fixture's private canary gateway port is a deliberate data-shape change, not a claim of a new installed-CLI compatibility result. This module must not copy the fixture's process/network shim or reinterpret scutil denials as allowed child execution.

Worker capability may occur in the config file and persisted worker artifacts. Real provider credentials must never be input to this module. An arbitrary malicious prompt/root could itself contain any string; the API is not a secret detector or universal DLP promise. Tests establish absence of unrelated fake parent-secret material when none is supplied in public strings.

## Joint-custody API

Export these exact interfaces, constant values and constructor from `subscription-attempt-custody-v1.ts`:

```ts
import type { SubscriptionAttemptBrokerV1, SubscriptionAttemptBrokerStopV1 }
  from './subscription-attempt-broker-v1.js';
import type { SubscriptionAttemptIdentityV1 } from './subscription-attempt-launch-material-v1.js';

export const SUBSCRIPTION_CUSTODY_LIFETIME_MS_V1 = 20_000;
export const SUBSCRIPTION_CUSTODY_DRAIN_MS_V1 = 2_500;
export const SUBSCRIPTION_CUSTODY_PUBLICATION_MS_V1 = 1_000;
export type SubscriptionWorkerClosureV1 = Readonly<{
  status: 'closed' | 'custody-uncertain';
}>;
export type SubscriptionOwnedWorkerV1 = Readonly<{
  identity: SubscriptionAttemptIdentityV1;
  closed: Promise<SubscriptionWorkerClosureV1>;
  stop(reason: SubscriptionAttemptBrokerStopV1): Promise<void>;
}>;
export type SubscriptionJointResourceStateV1 =
  'pending' | 'closed' | 'custody-uncertain' | 'invalid';
export type SubscriptionJointFaultV1 =
  'none' | 'broker-stop' | 'worker-stop' | 'broker-closure' | 'worker-closure' | 'drain-timeout';
export type SubscriptionAttemptClosureObservationV1 = Readonly<{
  schema: 'setfarm.subscription-attempt-closure-observation.v1';
  runtimeSessionId: string;
  identity: SubscriptionAttemptIdentityV1;
  reason: SubscriptionAttemptBrokerStopV1;
  broker: SubscriptionJointResourceStateV1;
  worker: SubscriptionJointResourceStateV1;
  fault: SubscriptionJointFaultV1;
}>;
export type SubscriptionAttemptCustodyResultV1 = Readonly<{
  schema: 'setfarm.subscription-attempt-custody-result.v1';
  observation: SubscriptionAttemptClosureObservationV1;
  publication: 'published' | 'failed' | 'timed-out';
  fault: SubscriptionJointFaultV1;
  status: 'closed' | 'custody-uncertain';
}>;
export type SubscriptionAttemptCustodyInputV1 = Readonly<{
  runtimeSessionId: string;
  identity: SubscriptionAttemptIdentityV1;
  broker: SubscriptionAttemptBrokerV1;
  worker: SubscriptionOwnedWorkerV1;
  signal: AbortSignal;
  publish(observation: SubscriptionAttemptClosureObservationV1): Promise<void>;
}>;
export type SubscriptionAttemptCustodyV1 = Readonly<{
  close(reason: SubscriptionAttemptBrokerStopV1): Promise<SubscriptionAttemptCustodyResultV1>;
  closed: Promise<SubscriptionAttemptCustodyResultV1>;
}>;
export function ownSubscriptionAttemptCustodyV1(
  input: SubscriptionAttemptCustodyInputV1,
): SubscriptionAttemptCustodyV1;
```

`publish` is an explicit parent lifecycle recording port, not an admission callback. It receives a resource observation, not a successful runtime-release instruction. No consumerRelease flag exists. The result is not an existing Setfarm admission/drain receipt and cannot be fed into those validators. A published observation alone does not imply publication succeeded or both resources closed.

### Construction and binding

Apply the same exact own-data record discipline and fixed-error boundary as launch material. Constructor failure throws only `SUBSCRIPTION_CUSTODY_INPUT_INVALID`. runtimeSessionId and identity IDs obey the same1..128 safe-character rule. Worker identity and broker.worker identities/model must equal expected identity. Validate broker.worker's full shape/model/API/capability/baseUrl exactly as launch material, using local private validation (no filesystem or launch material creation). Broker object has exactly worker/stop/closed; worker object has exactly identity/stop/closed; publish/stop fields are functions; signal is an AbortSignal. Original closed promises must be native Promise instances usable by `Promise.prototype.then.call`; reject arbitrary thenables. Port callbacks are trusted parent code, not untrusted worker RPC.

Validate all structure before taking ownership. On invalid input the caller retains the handles and responsibility to close them; the constructor must not make cleanup claims or call arbitrary invalid methods. After validation capture original promise identities and original stop/publish functions. Call stop with its captured original object as `this`; no later property lookup is allowed. Detach immutable primitive identity snapshot. Register fulfillment/rejection handlers on both original broker.closed and worker.closed before returning; use intrinsic Promise.prototype.then to avoid overridden instance then methods. Capture the resulting observation chains with rejection handlers. Attach owner abort and the fixed20s lifetime timer, then recheck already-aborted signal. Attachments never substitute an already resolved stop-return promise for actual closure.

A native Promise subclass/Proxy whose intrinsic attachment fails is invalid. All validation/access failures are sanitized. Do not stringify errors. No cleanup side effects occur before validation finishes; if handler attachment itself fails during ownership acquisition, reject construction with the fixed error and leave ownership with the caller. In tests cover malformed promise objects before they can register live handles.

Acquisition is committed only after both original-promise subscriptions, owner-abort registration and lifetime-timer setup succeed. Gate queued handlers on that committed acquisition state. If any acquisition step throws, abandon the acquisition, remove its own timer/listener, and consume any already-attached promise outcomes without calling stop or publish. A first already-fulfilled original promise must not trigger cleanup after attaching the second original fails. This is construction rollback, not a successful closure observation.

### State machine

Create one result promise at construction and return it as `closed`; every `close` invocation returns that exact promise. close is not declared async (which would wrap it in a distinct promise). At most once, latch shutdown, preserve first reason, clear lifetime timer and remove abort listener. Invoke captured `broker.stop(reason)` synchronously **before** invoking captured `worker.stop(reason)`, even if broker.stop throws. Do not await either call before requesting the other. Synchronous throws and rejected stop-return promises latch a fixed first fault and are consumed. Stop-return promises acknowledge requests only; their fulfillment is never custody evidence. They cannot extend deadlines or replace original closure promises.

Stop methods contractually return native Promises. Reject/invalid stop returns latch broker-stop/worker-stop. Register their rejection handlers with the intrinsic then method. A fulfilled actual original closed promise is the relevant successful resource proof; a still-pending stop acknowledgment does not block physically proven closure. Before finishing a ready observation, drain an ordinary Promise microtask turn so already-settled stop rejection handlers have run. Rejections that arise only after the immutable final result cannot rewrite that result and are consumed; they are not new physical custody evidence. Fixed lifetime/drain/publication bounds prevent indefinite retention solely for stop acknowledgments.

Triggers:

| Trigger | First close reason |
| --- | --- |
| Explicit close(valid reason) | Supplied completed/owner-abort/deadline/refused |
| Explicit close(invalid runtime value) | refused |
| Owner abort, including already aborted | owner-abort |
| Fixed lifetime expiry | deadline |
| Worker original closure resolves status closed | completed |
| Worker closure uncertain/rejected/malformed | refused |
| Broker original closure resolves valid status closed | Its validated existing reason |
| Broker closure uncertain/rejected/malformed | refused |

First shutdown reason wins; subsequent triggers join. Resource observation is independent of reason: an aborted attempt with both resources actually closed may yield custody status closed, not workflow success.

Validate broker original receipt against its exact six fields `status,reason,acceptedRequests,responseBytes,redactions,terminalCode`; counts must be nonnegative safe integers; reason is the existing four-member enum; status is existing closed/custody-uncertain; terminalCode is null or string bounded to128 characters. **Never copy terminalCode or any count/raw error into output**; this slice uses only validated status/reason. A valid but arbitrary terminalCode is intentionally omitted, not blindly trusted. Worker closure is exactly `{status}`. Any malformed/throwing receipt becomes invalid and its fixed closure fault. Only primitive validated fields are retained; discard raw values.

Shutdown arms a2500ms drain deadline. If both original promises settle to valid closed and no observed fault, proceed to publication; if both settle with uncertainty/invalid or observed fault, publish that uncertain observation without waiting for the full deadline. If any resource remains pending at deadline, latch drain-timeout unless a prior fault exists, publish pending status and finalize uncertain. Keep original rejection handlers attached so late settlement is consumed; a frozen observation/result is never upgraded after timeout. No public method claims to prove or repair durable crash custody.

At observation freeze, clear the drain timer. Deep-freeze the observation with copied identity. Invoke publish exactly once, catch synchronous throw, require its return to be a native Promise, and race its observed settlement against1000ms. Published means fulfillment only; rejection/invalid return/throw means failed; timeout means timed-out. Consume late rejections; never call publish recursively to report its own failure. Return a deeply frozen result. The result's fault is the final fixed first fault observed before finalization, including stop rejection during publication. `status='closed'` iff observation broker and worker are closed, final fault none and publication published; otherwise custody-uncertain. A fault arising during publication cannot mutate the frozen observation, but must still force the returned result to custody-uncertain. Clear publication timer on settlement and all remaining own timers/listeners at finalization. A pending original promise keeps its handler but no timer is created to poll it. Bound is lifetime20s + drain2.5s + publication1s, subject to ordinary event-loop scheduling; synchronous blocking parent callbacks cannot be bounded by JS timers.

## Focused test acceptance

Launch tests cover both exact profiles, complete config/env/argv/file projection, all nested freezes and mutation of original input after return. Independently compute session digest and compare exact env key set. Capability occurs only in config contents, not argv/env/auth profiles. Unrelated synthetic parent secrets and their finite raw/JSON/percent/base64 variants never enter output. Poison known provider/proxy/DB/NODE_OPTIONS/shared-config variables only inside a scrubbed subprocess; compare returned material against the clean expected projection without printing environment values.

Table-drive malformed identity/model/provider/capability/baseUrl/ports/root/prompt/extra keys/accessors/symbols/Proxy cases; assert only fixed error and no getter/toJSON invocation. Test readonly tools/empty fallbacks even if ambient config suggests otherwise. All path validation is lexical; tests must not claim symlink protection. Import-inert subprocess traps runtime effect APIs and environment mutation, permitting ordinary loader reads but no application profile reads/writes/network/child calls. Use only ephemeral files created by the test for its own synthetic process script if necessary.

Custody tests use native controlled promises and an ordered string event array. Assert exact promise identity for repeated close; broker-stop precedes worker-stop in the same call stack; original promises, not stop fulfillment, determine resource closure. Test abort before/after registration, first-reason races, worker exit while broker pending, broker closed while worker pending, synchronous/rejected stops, invalid receipts, malicious terminalCode/raw errors, hanging/rejected/throwing publication, fixed lifetime/drain/publication expiry, late closure after timeout and receipt immutability. Deterministic `node:test` mock timers or controlled promises are allowed only in tests; no public clock injection.

Exactly one synthetic composition case may call the existing `startSubscriptionAttemptBrokerForTestV1` with an `open()` transport that increments a counter then throws. Make zero requests, compose with controlled worker closure, close, prove actual broker.closed status and helper result closed, and assert transport calls0. It opens only the existing broker's owned127.0.0.1:0 listener. Always stop the broker in a test cleanup hook. No actual installed worker, upstream listener, fetch, provider or real credential in this case.

## Later production dependencies

This slice has no operational importer. Later wiring requires a fixed authorized parent subscription credential source, a code-owned selected subscription execution identity and actual installation/source transition. Current selected Codex must still refuse incompatible profiles; neither environment toggles nor starting legacy OpenClaw are shortcuts.

The later spawner caller must acquire broker custody after exact admission/session acquisition (`src/spawner.ts:8181-8237`), before spawn (`:8239-8258`), retain pre-transfer ownership (`:8441-8449`), transfer alongside exact process/session identity (`:8263-8297`), and join broker closure with existing drain/completion/shutdown observations (`:8763-8862`, `:8611`, `:11549-11662`). Durable broker/process recovery after parent crash remains unimplemented; this cooperative in-memory helper is not absence proof.

Real OS/same-UID/FD/child-exec/egress isolation, exact current Source/reader/native/Task6A material and full8 qualification remain required for actual activation. The Read fixture cannot enable coding tools. Nonrecursive Homebrew Cellar/opt0775→0755 approval remains unanswered, and Root's current observation remains0775. No access-control effect is authorized by this source task.
