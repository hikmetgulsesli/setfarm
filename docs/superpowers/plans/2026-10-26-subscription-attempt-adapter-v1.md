# Subscription Attempt Adapter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Only Root may dispatch; the assigned author may not spawn subagents. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an inactive capability-only OpenClaw launch-material adapter and parent broker/worker custody composition for the approved subscription models.

**Architecture:** A pure builder projects one existing broker binding into a fixed private read-only headless profile. A separate parent lifecycle helper joins the original broker and owned-worker closure promises, with fixed deadlines and sanitized publication. Neither module has an operational importer, production credential acquisition or launch/admission effects.

**Tech Stack:** TypeScript ESM, existing Node path/crypto/Promise/AbortSignal/timers, node:test, existing tsx and TypeScript. No dependency additions.

**Spec:** `docs/superpowers/specs/2026-10-26-subscription-attempt-adapter-design.md`. Read the complete spec alongside this plan; its exact interfaces, validation tables, config literal, environment key set and lifecycle state machine are binding.

## Global Constraints

- Only two new Source modules, two new tests and this spec/plan are in the implementation File Map. Existing broker/redactor remain unchanged.
- No spawner, selected-profile, installation, OS, runtime-guard, eval suite, dependency, service, database, credential or shared-config changes.
- No operational importer, environment enable switch, production credential lookup, arbitrary command/endpoint override or caller-asserted admission.
- Shape validation is not admission, entitlement, isolation, actual process ownership or durable crash proof.
- Profile is private-headless-readonly-v1: Read only, timeFormat24, trajectoryfalse, maxTokens2048, contextWindow200000, timeout20seconds, empty fallbacks, explicit public CLI --local.
- Fixed parent deadlines: lifetime20000ms, drain2500ms, publication1000ms. No public clock or timer injection.
- Only original broker.closed and worker.closed establish resource closure; stop-return promises are acknowledgments, never substitutes.
- broker.stop is called synchronously before worker.stop; duplicate close calls return the exact same result promise. Unknown custody/publication failure remains uncertain.
- All result fields are explicit sanitized primitives. Never copy terminalCode, errors, capabilities, full port objects, config, env or argv into lifecycle output.
- Tests use synthetic literals/controlled promises. At most one actual existing-synthetic-broker composition test is allowed, with no upstream requests, no mock upstream server, no SDK and no actual worker.
- Root alone stages/commits/pushes/delivers. Source writes are serialized. Full guarded build follows reviewed normal merge in a fresh exact clean-main release; no dirty-build/runtime-guard bypass.

## File Map and causal scope

| File | Action and responsibility |
| --- | --- |
| `src/execution/subscription-attempt-launch-material-v1.ts` | Create pure strict-input launch projection; derive all private paths and one model's data. |
| `tests/execution-attempts/subscription-attempt-launch-material-v1.test.ts` | Create independent expected projections, serialization/refusal/inert-import tests. |
| `src/execution/subscription-attempt-custody-v1.ts` | Create parent original-promise custody composition and bounded sanitized publication. |
| `tests/execution-attempts/subscription-attempt-custody-v1.test.ts` | Create controlled-promise state machine tests and one no-request synthetic composition test. |
| `docs/superpowers/specs/2026-10-26-subscription-attempt-adapter-design.md` | Adopt exact contracts and qualification limits. |
| This plan | Author/reviewer execution contract. |

The causal root fix prevents provider key propagation through inherited configuration and makes the broker part of attempt custody. Existing selected Codex behavior remains authoritative. The task cannot claim operational annual-model integration or broaden the fake Read profile into coding execution.

## Task 1: Capability-only launch material and joint parent custody

This is one task because the two helpers share the exact attempt/model identity and qualification boundary. Implement the Source files sequentially in the same writer, then review the complete four-file change. No independent parallel author is needed.

**Consumes:** Existing `SubscriptionAttemptBrokerWorkerV1`, `SubscriptionAttemptBrokerV1`, `SubscriptionAttemptBrokerStopV1` and broker closure receipt behavior from `src/execution/subscription-attempt-broker-v1.ts`. Only the last test consumes runtime `startSubscriptionAttemptBrokerForTestV1`.

**Produces:** Every exact exported type/function/constant in the spec's Launch-material API and Joint-custody API. In particular:

```ts
buildSubscriptionAttemptLaunchMaterialV1(input: SubscriptionAttemptLaunchInputV1): SubscriptionAttemptLaunchMaterialV1;
ownSubscriptionAttemptCustodyV1(input: SubscriptionAttemptCustodyInputV1): SubscriptionAttemptCustodyV1;
```

`SubscriptionAttemptIdentityV1` is exported from the launch module and imported type-only by custody. The custody result includes both frozen pre-publication observation and final `fault`, so a stop rejection during publication cannot be hidden by an earlier frozen observation. Export no test constructor, runtime launcher or approval input.

### Step 1 — Read the exact seam and record the baseline

- [ ] Read both AGENTS, this spec and the existing broker types/factories/lifecycle at `subscription-attempt-broker-v1.ts:7-112,195-228,490-510`.
- [ ] Read existing focused broker test patterns without running their real loopback suite: `tests/execution-attempts/subscription-attempt-broker-v1.test.ts` and `subscription-attempt-broker-worker-boundary-v1.test.ts`.
- [ ] Root verifies the sole writer is clean before author edits; workers do not run git mutations. Root retains exact Source baseline and new branch in the task evidence. Do not overwrite any pre-existing task artifact.

Create only task-local evidence under `.superpowers/sdd/2026-10-26-subscription-attempt-adapter-v1/`. Use exclusive writes for reports/captures. The runner below is a task artifact, not Source or a production helper. Create it as `run-focused.py` with the exact code:

```python
import hashlib, json, os, pathlib, shutil, subprocess, sys, tempfile, time
W = pathlib.Path(__file__).resolve().parents[3]
A = pathlib.Path(__file__).resolve().parent
phase = sys.argv[1]
if phase not in ('red', 'green', 'adjacent', 'typecheck'):
    raise SystemExit('invalid phase')
node = shutil.which('node')
if not node:
    raise SystemExit('node unavailable')
new_tests = [
    'tests/execution-attempts/subscription-attempt-launch-material-v1.test.ts',
    'tests/execution-attempts/subscription-attempt-custody-v1.test.ts',
]
if phase in ('red', 'green'):
    cmd = [node, '--import', 'tsx', '--test', '--test-concurrency=1', *new_tests]
elif phase == 'adjacent':
    cmd = [node, '--import', 'tsx', '--test', '--test-concurrency=1',
        'tests/installation/fresh-installation-v3-profile.test.ts',
        'tests/execution-attempts/operational-retry-directive.test.ts']
else:
    cmd = [node, 'node_modules/typescript/bin/tsc', '--noEmit']
# Private test HOME prevents accidental global profile selection. No inherited
# authority, provider credentials, proxy, NODE_OPTIONS or SETFARM/PG variables.
home = pathlib.Path(tempfile.mkdtemp(prefix='setfarm-adapter-test-home-'))
os.chmod(home, 0o700)
env = {'HOME': str(home), 'TMPDIR': str(home),
       'PATH': str(pathlib.Path(node).parent) + ':/usr/bin:/bin',
       'LANG': 'en_US.UTF-8', 'TZ': 'UTC', 'NODE_DISABLE_COMPILE_CACHE': '1'}
stdout_path, stderr_path = A / (phase + '.stdout'), A / (phase + '.stderr')
result_path = A / (phase + '.result.json')
# Reserve all evidence names before execution; do not overwrite original captures.
fds = []
for path in (stdout_path, stderr_path, result_path):
    fds.append(os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600))
started = time.monotonic()
with os.fdopen(fds[0], 'wb') as out, os.fdopen(fds[1], 'wb') as err:
    proc = subprocess.Popen(cmd, cwd=W, env=env, stdout=out, stderr=err)
    try:
        code = proc.wait(timeout=75)
        timed_out = False
    except subprocess.TimeoutExpired:
        # Signal only this owned original; preserve timeout as a failed result.
        proc.terminate()
        try:
            code = proc.wait(timeout=5)
        except subprocess.TimeoutExpired:
            proc.kill()
            code = proc.wait(timeout=5)
        timed_out = True
receipt = {'phase': phase, 'argv': cmd, 'cwd': str(W), 'pid': proc.pid,
           'exit': code, 'timedOut': timed_out,
           'elapsedSeconds': time.monotonic() - started,
           'privateTestHome': str(home),
           'stdoutBytes': stdout_path.stat().st_size,
           'stderrBytes': stderr_path.stat().st_size,
           'stdoutSha256': hashlib.sha256(stdout_path.read_bytes()).hexdigest(),
           'stderrSha256': hashlib.sha256(stderr_path.read_bytes()).hexdigest()}
with os.fdopen(fds[2], 'w') as result:
    json.dump(receipt, result, indent=2)
    result.write('\n')
print(json.dumps(receipt))
raise SystemExit(124 if timed_out else code)
```

All implementation tests must own/close any nested subprocess or synthetic listener in cleanup; a runner timeout does not certify their closure. Root must inspect original process/output/custody before considering another run. Preserve the test home for review; no broad cleanup. The artifact runner itself invokes only the named focused tests or no-emit compiler, never build/DB/provider/SDK work.

### Step 2 — Write meaningful RED tests before Source modules

- [ ] Create both new test files with imports of the missing exports. Use `node:test` and strict assert; assert behavior rather than Source text.

Launch fixture and first causal test:

```ts
import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { buildSubscriptionAttemptLaunchMaterialV1 } from '../../src/execution/subscription-attempt-launch-material-v1.js';
import type { SubscriptionAttemptBrokerWorkerV1 } from '../../src/execution/subscription-attempt-broker-v1.js';

function launchInput(modelRef: SubscriptionAttemptBrokerWorkerV1['modelRef'] = 'kimi/k3.1-pro') {
  const identity = { attemptId: 'ATT_fixture_1', generationId: 'generation_1', modelRef };
  const kimi = modelRef === 'kimi/k3.1-pro';
  const worker: SubscriptionAttemptBrokerWorkerV1 = {
    ...identity, providerId: kimi ? 'kimi' : 'minimax',
    modelId: kimi ? 'k3.1-pro' : 'MiniMax-M3.1-Flash',
    baseUrl: 'http://127.0.0.1:49157/v1', api: 'anthropic-messages',
    apiKey: 'A'.repeat(43), auth: 'api-key', authHeader: true,
  };
  return { identity, worker, root: '/private/tmp/owned adapter fixture', prompt: 'Read the owned nonce.' };
}

test('only a per-attempt capability enters the exact readonly launch profile', () => {
  const input = launchInput();
  const result = buildSubscriptionAttemptLaunchMaterialV1(input);
  const cfg = JSON.parse(result.files[0]!.contents);
  assert.deepEqual(Object.keys(cfg.models.providers), ['kimi']);
  assert.equal(cfg.models.providers.kimi.apiKey, input.worker.apiKey);
  assert.equal(cfg.models.providers.kimi.models[0].id, 'k3.1-pro');
  assert.deepEqual(cfg.agents.defaults.model, { primary: 'kimi/k3.1-pro', fallbacks: [] });
  assert.deepEqual(cfg.tools.allow, ['read']);
  assert.equal(cfg.agents.defaults.timeFormat, '24');
  assert.equal(result.env.OPENCLAW_TRAJECTORY, 'false');
  assert.equal(result.files.length, 3);
  for (const file of result.files.slice(1)) assert.deepEqual(JSON.parse(file.contents), { version: 1, profiles: {} });
  assert.ok(!JSON.stringify(result.env).includes(input.worker.apiKey));
  assert.ok(!JSON.stringify(result.argv).includes(input.worker.apiKey));
  const digest = createHash('sha256').update(JSON.stringify([
    input.identity.attemptId, input.identity.generationId, input.identity.modelRef,
  ])).digest('hex');
  assert.equal(result.sessionId, 'sfsub-' + digest);
  assert.deepEqual(result.argv, ['agent', '--local', '--json', '--agent',
    'subscription-worker', '--session-id', 'sfsub-' + digest,
    '--message', input.prompt, '--timeout', '20']);
});
```

In the same test file add the complete expected config from the spec as an independent fixture and compare the parsed config. Assert the exact22-key environment, ordered14 directories, file paths/modes, cwd, recursively frozen output and independence from post-return input mutation. A count assertion alone is not sufficient: compare the exact environment key/value object.

Custody controlled-promise fixture and first causal test:

```ts
import assert from 'node:assert/strict';
import test from 'node:test';
import { ownSubscriptionAttemptCustodyV1 } from '../../src/execution/subscription-attempt-custody-v1.js';
import type { SubscriptionAttemptBrokerV1, SubscriptionAttemptBrokerReceiptV1,
  SubscriptionAttemptBrokerWorkerV1 } from '../../src/execution/subscription-attempt-broker-v1.js';
import type { SubscriptionWorkerClosureV1, SubscriptionAttemptClosureObservationV1 }
  from '../../src/execution/subscription-attempt-custody-v1.js';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
const closedBroker = (): SubscriptionAttemptBrokerReceiptV1 => ({
  status: 'closed', reason: 'completed', acceptedRequests: 0,
  responseBytes: 0, redactions: 0, terminalCode: null,
});
function custodyFixture() {
  const identity = { attemptId: 'ATT_fixture_1', generationId: 'generation_1',
    modelRef: 'kimi/k3.1-pro' as const };
  const binding: SubscriptionAttemptBrokerWorkerV1 = { ...identity, providerId: 'kimi',
    modelId: 'k3.1-pro', baseUrl: 'http://127.0.0.1:49157/v1',
    api: 'anthropic-messages', apiKey: 'A'.repeat(43), auth: 'api-key', authHeader: true };
  const brokerDone = deferred<SubscriptionAttemptBrokerReceiptV1>();
  const workerDone = deferred<SubscriptionWorkerClosureV1>();
  const events: string[] = [];
  const observations: SubscriptionAttemptClosureObservationV1[] = [];
  const broker: SubscriptionAttemptBrokerV1 = { worker: binding, closed: brokerDone.promise,
    stop() { events.push('broker-stop'); return Promise.resolve(closedBroker()); } };
  const worker = { identity, closed: workerDone.promise,
    stop() { events.push('worker-stop'); return Promise.resolve(); } };
  const controller = new AbortController();
  const input = { runtimeSessionId: 'session_1', identity, broker, worker,
    signal: controller.signal,
    publish(value: SubscriptionAttemptClosureObservationV1) {
      observations.push(value); events.push('publish'); return Promise.resolve();
    } };
  return { input, events, observations, brokerDone, workerDone, controller };
}

test('stop acknowledgments cannot replace original custody; close joins', async () => {
  const f = custodyFixture();
  const owned = ownSubscriptionAttemptCustodyV1(f.input);
  const first = owned.close('completed');
  assert.equal(first, owned.closed);
  assert.equal(owned.close('owner-abort'), first);
  assert.deepEqual(f.events, ['broker-stop', 'worker-stop']);
  let settled = false;
  void first.then(() => { settled = true; });
  await Promise.resolve(); await Promise.resolve();
  assert.equal(settled, false);
  assert.equal(f.observations.length, 0);
  f.workerDone.resolve({ status: 'closed' });
  await Promise.resolve(); await Promise.resolve();
  assert.equal(settled, false);
  f.brokerDone.resolve(closedBroker());
  const result = await first;
  assert.equal(result.status, 'closed');
  assert.equal(result.publication, 'published');
  assert.equal(result.fault, 'none');
  assert.equal(result.observation.reason, 'completed');
  assert.equal(f.observations.length, 1);
});
```

- [ ] Add focused tests listed in Step5 before their corresponding implementation branch; do not postpone all negative coverage until the end.
- [ ] Run causal RED exactly once:

```bash
python3 .superpowers/sdd/2026-10-26-subscription-attempt-adapter-v1/run-focused.py red
```

Expected: missing new module/export, exit nonzero. Read captured output to verify that cause; a loader, environment, timeout or unrelated dependency error is not the causal RED. No production module is created merely to make RED look cleaner.

### Step 3 — Implement pure launch material

- [ ] Create the launch Source with every exact spec interface, `node:path`/`node:crypto` runtime imports and broker type-only import.
- [ ] Implement a private strict own-data validator; use descriptor values rather than subsequent raw caller lookups. The whole public function catches reflective/validation failures and throws only SUBSCRIPTION_LAUNCH_INPUT_INVALID.

```ts
function invalid(): never { throw new Error('SUBSCRIPTION_LAUNCH_INPUT_INVALID'); }
function ownData(value: unknown, keys: readonly string[]): Record<string, unknown> {
  if (value === null || typeof value !== 'object') invalid();
  const proto = Object.getPrototypeOf(value);
  if (proto !== Object.prototype && proto !== null) invalid();
  const ds = Object.getOwnPropertyDescriptors(value);
  const actual = Reflect.ownKeys(ds);
  if (actual.length !== keys.length || actual.some(k => typeof k !== 'string' || !keys.includes(k))) invalid();
  const copy: Record<string, unknown> = Object.create(null);
  for (const k of keys) {
    const d = ds[k];
    if (!d || !Object.hasOwn(d, 'value')) invalid();
    copy[k] = d.value;
  }
  return copy;
}
```

- [ ] Implement the spec's exact scalar/model/URL/root/prompt checks. Reject unsafe input rather than normalize it. Derive the full session digest, paths, three files,22 env entries and argv. Copy the spec's complete config literal; no shared config or object spread of unvalidated input.
- [ ] Deep-freeze only generated data, never caller objects/ports:

```ts
function freezeGenerated<T>(value: T): T {
  if (value !== null && typeof value === 'object') {
    for (const child of Object.values(value)) freezeGenerated(child);
    Object.freeze(value);
  }
  return value;
}
```

### Step 4 — Implement original-promise custody

- [ ] Create custody Source with every exact spec type/constant, including final result `fault`, and type-only imports. Validate all input/binding/worker/native promises before acquisition; fixed failure is SUBSCRIPTION_CUSTODY_INPUT_INVALID.
- [ ] Snapshot primitives and original functions/objects/promises. Attach intrinsic handlers to both original closed promises before return. Precreate the only result promise; close must be a synchronous function returning it directly:

```ts
let finishResult!: (result: SubscriptionAttemptCustodyResultV1) => void;
const closed = new Promise<SubscriptionAttemptCustodyResultV1>(resolve => { finishResult = resolve; });
```

- [ ] Gate all subscribed callbacks until acquisition commits after both original subscriptions, abort registration and timer setup. On partial acquisition failure, mark abandoned and remove own timer/listener; already-queued outcomes are consumed without stop/publication effects. Keep ownership with the caller and throw the fixed constructor error.

- [ ] Implement the spec state machine with private shutdown/finalizing/finished booleans, first reason/fault, two resource states and fixed timer handles. First close synchronously requests captured broker.stop then worker.stop, separately catches failures and consumes their native-Promise rejections. Never derive a resource state from a stop acknowledgment. Duplicate/reentrant close joins `closed`.
- [ ] Observe original receipts with exact descriptor validation and fixed status/fault mapping; omit terminalCode, counts and all raw data. Original settlement triggers close using the spec trigger table. Once both resources settle, allow a microtask turn for already-settled stop rejections, then publish.2500ms drain expiry freezes pending states as uncertain. Late settlement cannot upgrade a frozen result.
- [ ] Freeze/copy observation, invoke publish once and bound it by1000ms. Publication error/invalid return/hang is failed/timed-out. Preserve any fault arriving during publication in final result.fault/status. Result closed requires both observed resources closed, final fault none and publication fulfilled. Remove own timers/abort listener; consume late original/stop/publication rejections.
- [ ] Attach owner abort and20000ms lifetime timer, recheck already-aborted signal and return frozen `{close,closed}`. No admission, launch, release flag, polling, retry, DB or durable-custody claims.

### Step 5 — Complete causal negative, timer and serialization coverage

- [ ] Launch test matrix: both models; full expected config/env/dirs/files; prototype/null-prototype cases; symbol/extra/accessor keys; throwing/revoked Proxy; mismatched generation/attempt/model; wrong provider/raw model/API/auth; capability length/alphabet; URL auth/query/fragment/IPv6/localhost/wrong protocol/leading-zero/out-of-range/reserved port; root relative/root-slash/double-slash/dot-dot/trailing slash/backslash/control; NUL/empty/oversized prompt. Each invalid case expects exactly SUBSCRIPTION_LAUNCH_INPUT_INVALID and no raw input in its message.
- [ ] Mutation tests: mutate original identity/worker/root holder after return and assert snapshot unchanged. Recursively assert Object.isFrozen on generated objects/arrays. Assert no provider-key field accepted at any input level. Since this is not DLP, do not assert arbitrary prompt text is secretly scrubbed.
- [ ] Poisoned ambient test runs only in a child process whose env is explicitly copied from the already scrubbed test env plus fake `KIMI_API_KEY`, `MINIMAX_API_KEY`, `ANTHROPIC_API_KEY`, `HTTP_PROXY`, `HTTPS_PROXY`, `SETFARM_PG_URL`, `OPENCLAW_CONFIG_PATH` values. Set `NODE_OPTIONS=''` in the spawn environment (so the loader is safe), then assign a fake NODE_OPTIONS string inside the test child before calling the pure builder. Construct expected material independently and verify none of the poison literals appear. No real secret/profile read, no profile filesystem write, no value printing. Child timeout10000ms; assert exit0 and a fixed success marker. Always retain/inspect original exit on failure.
- [ ] Inert import test in a separate scrubbed Node subprocess patches `http.createServer`, HTTP/HTTPS request, net.connect, child_process spawn/exec families and fs write functions to throw a fixed failure. Use `syncBuiltinESMExports()` after patching. Permit loader reads; instrument credential/profile-looking read paths to throw without logging the path. Import both new modules only, assert no environment mutation, print INERT. This test does not assert all filesystem reads are impossible under a TS loader.
- [ ] Custody validation matrix: exact records/identity/native promises/functions/signal, invalid constructor fixed error and zero stop/publication calls. Test thenable objects, overridden instance then methods, malformed receipt getters/symbols and reflective failures. The constructor owns only valid captured handles; caller handles cleanup of invalid input.
- [ ] Cover partial acquisition rollback: make the first original already fulfilled and the second a Promise subclass whose `Symbol.species` getter throws on intrinsic attachment. Construction must throw only SUBSCRIPTION_CUSTODY_INPUT_INVALID; flush queued microtasks and assert zero broker-stop, worker-stop and publication calls. Do not treat an already-registered handler as permission to own a rejected construction.
- [ ] Lifecycle matrix: stop ordering/duplicates/first reason; owner abort before and after registration; broker closes first; worker closes first; both close; each original rejects; uncertainty; counts invalid; stop throws/rejects/returns malformed; complete original closures despite pending stop acknowledgment; rejected stop acknowledgment before finalization forces uncertainty. Inject a synthetic secret into terminalCode and exceptions; assert serialized observation/result contains neither it nor capability/config/env/argv/raw objects.
- [ ] Publication matrix: called once with frozen copied observation; success; synchronous throw; rejection; invalid return; hang; stop rejection while publication pending updates final result fault/status; late publication fulfillment/rejection cannot upgrade or republish. Worker/broker late settlement after drain timeout cannot change the frozen receipt.
- [ ] Timer cases use test-owned mock timers, not public injection. A representative deterministic test is:

```ts
test('drain timeout remains uncertain after late originals close', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const f = custodyFixture();
  const owned = ownSubscriptionAttemptCustodyV1(f.input);
  const resultPromise = owned.close('completed');
  t.mock.timers.tick(2500);
  await Promise.resolve(); await Promise.resolve();
  const result = await resultPromise;
  assert.equal(result.status, 'custody-uncertain');
  assert.equal(result.fault, 'drain-timeout');
  const snapshot = JSON.stringify(result);
  f.brokerDone.resolve(closedBroker()); f.workerDone.resolve({ status: 'closed' });
  await Promise.resolve(); await Promise.resolve();
  assert.equal(JSON.stringify(result), snapshot);
  assert.equal(f.observations.length, 1);
});
```

Mock timers do not flush Promise microtasks. In hang-publication tests tick2500 for drain, flush microtasks, then tick1000 for publication; lifetime tests tick20000 before drain/publication. Use test cleanup to reset mock timers and resolve any test-owned pending promises needed for assertions. Do not pass synthetic time controls to production APIs.

- [ ] Add exactly one owned synthetic broker composition test, with no request or upstream server:

```ts
import { startSubscriptionAttemptBrokerForTestV1 } from '../../src/execution/subscription-attempt-broker-v1.js';

test('existing synthetic broker closure joins controlled worker without upstream traffic', async t => {
  let opens = 0;
  const controller = new AbortController();
  const identity = { attemptId: 'ATT_composition_1', generationId: 'generation_1',
    modelRef: 'kimi/k3.1-pro' as const };
  const { broker } = await startSubscriptionAttemptBrokerForTestV1({ ...identity,
    signal: controller.signal,
    limits: { maxRequests: 1, maxOutputTokens: 2048, maxTotalOutputTokens: 2048,
      maxRequestBytes: 65536, maxResponseBytes: 131072, maxTotalResponseBytes: 131072,
      maxSseEventBytes: 32768, attemptMs: 10000, requestMs: 5000, idleMs: 2000 },
  }, { open() { opens++; throw new Error('SYNTHETIC_UPSTREAM_FORBIDDEN'); } });
  t.after(async () => { await broker.stop('owner-abort'); });
  const workerDone = deferred<SubscriptionWorkerClosureV1>();
  const owned = ownSubscriptionAttemptCustodyV1({ runtimeSessionId: 'session_composition',
    identity, broker, signal: controller.signal,
    worker: { identity, closed: workerDone.promise,
      stop() { workerDone.resolve({ status: 'closed' }); return Promise.resolve(); } },
    publish() { return Promise.resolve(); },
  });
  assert.equal((await owned.close('completed')).status, 'closed');
  assert.equal((await broker.closed).status, 'closed');
  assert.equal(opens, 0);
});
```

This case consumes the synthetic factory's generated fake internally but never serializes/prints the fakeCredential return value. Do not add a second actual broker listener case, SDK run, HTTP request, production factory call or port scanner. Existing original broker.closed is the actual closure oracle for this bounded test.

### Step 6 — Focused GREEN and adjacent invariants

- [ ] Run the new tests and read both captured streams and exit:

```bash
python3 .superpowers/sdd/2026-10-26-subscription-attempt-adapter-v1/run-focused.py green
```

Expected exit0, all new tests pass, original test process settles. Failure means inspect the original before editing/rerunning; retain distinct run captures rather than overwrite. Any later rerun needs a fresh runner phase/file variant explicitly recorded by Root; it is not an invitation to loop on a hung process.

- [ ] Run selected Codex/no-fallback adjacency only:

```bash
python3 .superpowers/sdd/2026-10-26-subscription-attempt-adapter-v1/run-focused.py adjacent
```

Expected exit0 for `tests/installation/fresh-installation-v3-profile.test.ts` and `tests/execution-attempts/operational-retry-directive.test.ts`. No full suite, DB owner suite or spawner import. Existing three broker test files are unchanged protocol oracles; don't rerun their many actual listeners merely to validate two new inactive modules. If new evidence requires broader broker verification, Root must deliberately revise the scoped verification record.

- [ ] Run no-emit TypeScript:

```bash
python3 .superpowers/sdd/2026-10-26-subscription-attempt-adapter-v1/run-focused.py typecheck
```

Expected exit0. This is not a full build. No full build on the dirty author worktree.

### Step 7 — Author self-review and Root-only delivery handoff

- [ ] Self-review the complete four-file change against every spec requirement. Confirm no operational importers, real credential input, arbitrary env/config merge, guard changes, time injection, stop-return custody substitution, unbounded deadline, raw terminalCode copy or result release flag.
- [ ] Write `.superpowers/sdd/2026-10-26-subscription-attempt-adapter-v1/task-1-report.md` exclusively. Include exact touched files; original RED cause/exit; GREEN/adjacent/typecheck commands, exits, counts and capture hashes; one synthetic composition case opens0; self-review; all qualification/activation limits. No success claim if any original remains unresolved.
- [ ] Report to Root without staging/commit/push/build or subagent dispatch. Root reads full diff and actual captures, obtains independent task/spec/quality review and whole-branch review, handles any scoped fixes serially and alone performs conventional commit/delivery. Suggested conventional subject: `feat: add inert subscription attempt adapter`.

## Root delivery and remaining work

Root reviews actual diff/captures, obtains independent spec/quality and whole-branch review, then alone commits/delivers. Full guarded build occurs on fresh exact clean main after normal reviewed merge; release stays unstarted. Checkpoint must say **adapter source delivered; operational broker wiring absent**.

The spec's later-production dependency list is binding: exact parent subscription provenance, code-owned selected identity/transition, real OS/exec/FD/egress qualification, spawner pre-transfer/drain/shutdown and durable crash recovery, current Source/reader/native/Task6A/full8 evidence, and separately unanswered Homebrew permissions. This task implements none of those effects and preserves selected Codex refusal. No live claim or legacy shortcut is authorized.
