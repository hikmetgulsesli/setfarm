import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { narrowSubscriptionCodingWorkerMaterialV1 } from '../../src/execution/subscription-coding-worker-policy-v1.js';
import { EventEmitter } from 'node:events';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { ChildProcess } from 'node:child_process';
import type { SubscriptionAttemptBrokerReceiptV1 } from '../../src/execution/subscription-attempt-broker-v1.js';
import { SubscriptionCodingWorkerStartupErrorV1 } from '../../src/execution/subscription-coding-worker-v1.js';
import type { SubscriptionCodingWorkerOutputV1 } from '../../src/execution/subscription-coding-worker-v1.js';

// Only the inert joint owner is imported. Acquisitions below are owned fake
// handles, never credential/selected-installation/provider/SDK/OS admissions.
let api: typeof import('../../src/execution/subscription-coding-runtime-v1.js') | undefined;
try { api = await import('../../src/execution/subscription-coding-runtime-v1.js'); }
catch (error) {
  const missing = error as { code?: string; url?: string };
  if (missing.code !== 'ERR_MODULE_NOT_FOUND' || !['.js', '.ts'].some(ext => missing.url ===
    new URL('../../src/execution/subscription-coding-runtime-v1' + ext, import.meta.url).href)) throw error;
}
function required() { assert.ok(api, 'Task5A joint runtime owner implementation is missing'); return api; }
function deferred<T>() { let resolve!: (v: T) => void, reject!: (e: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; }
async function flush() { for (let n = 0; n < 25; n++) await Promise.resolve(); }
function fixture(kind: 'execution-attempt' | 'stage-claim' = 'execution-attempt') {
  const directory = realpathSync(mkdtempSync(join(tmpdir(), 'sf-sub-runtime-'))); chmodSync(directory, 0o700);
  const worktree = join(directory, 'worktree'); mkdirSync(worktree, { mode: 0o700 });
  const common = { runtimeSessionId: 'RT_coding_1', claimId: 51, ownerInstanceId: 'host.local:43100:12345678-1234-4234-8234-123456789abc', modelRef: 'minimax/MiniMax-M3.1-Flash' as const,
    sourceSha: 'a'.repeat(40), worktree };
  const binding = kind === 'execution-attempt'
    ? { ...common, kind: 'execution-attempt' as const, attemptId: 'ATT_coding_1', generation: 9, fenceToken: 'fence_token_1' }
    : { ...common, kind: 'stage-claim' as const };
  const identity = binding.kind === 'execution-attempt'
    ? { attemptId: binding.attemptId, generationId: 'generation-9', modelRef: binding.modelRef }
    : { attemptId: 'stage-claim-51', generationId: 'stage-runtime-' + createHash('sha256').update(binding.runtimeSessionId).digest('hex'), modelRef: binding.modelRef };
  const parentIdentity = { schema: 'setfarm.process-identity.v1' as const, pid: 43100,
    processStartedAt: '2026-11-04T12:00:00.000Z', processGroupId: 43000, source: 'observed_os' as const };
  const authority = { activationPreparedHash: 'b'.repeat(64), activationAcknowledgedHash: 'c'.repeat(64),
    sourceSha: binding.sourceSha, policySourceHash: 'd'.repeat(64), preloadHash: 'e'.repeat(64), parentIdentity };
  const isolation = { materialHash: '1'.repeat(64), policyHash: '2'.repeat(64), preloadHash: authority.preloadHash,
    proofHash: '3'.repeat(64), isolationHash: '4'.repeat(64) };
  const events: string[] = [], controller = new AbortController();
  const brokerClosure = deferred<SubscriptionAttemptBrokerReceiptV1>();
  const workerClosure = deferred<{ status: 'closed' | 'custody-uncertain' }>();
  const originalClosure = deferred<{ status: 'closed' | 'custody-uncertain' }>();
  const output = deferred<SubscriptionCodingWorkerOutputV1>();
  const brokerReceipt = { status: 'closed' as const, reason: 'completed' as const,
    acceptedRequests: 0, responseBytes: 0, redactions: 0, terminalCode: null };
  const workerOutput: SubscriptionCodingWorkerOutputV1 = { stdout: 'assistant report', stderr: '', stdoutBytes: 16,
    stderrBytes: 0, stdoutTruncated: false, stderrTruncated: false, exitCode: 0, signal: null,
    processClosed: true, stdoutEnded: true, stderrEnded: true, stdoutClosed: true, stderrClosed: true,
    streamError: false, proofHash: isolation.proofHash, isolationHash: isolation.isolationHash, materialHash: isolation.materialHash };
  const broker = { worker: { ...identity, providerId: 'minimax' as const, modelId: 'MiniMax-M3.1-Flash' as const,
    baseUrl: 'http://127.0.0.1:49157/v1', api: 'anthropic-messages' as const, apiKey: 'A'.repeat(43),
    auth: 'api-key' as const, authHeader: true as const }, closed: brokerClosure.promise,
    stop: async (_reason: string) => { events.push('broker-revoke'); return brokerReceipt; } };
  const worker = { identity, child: new EventEmitter() as ChildProcess, processIdentity: { ...parentIdentity, pid: 43200 },
    isolationHash: isolation.isolationHash, isolation, closed: workerClosure.promise, originalClosed: originalClosure.promise,
    output: output.promise, stop: async (_reason: string) => { events.push('worker-stop'); },
    async waitForOwnerAdmission() {
      assert.equal(existsSync(join(input.runtimePath, 'worker-bound.json')), true, 'wait preceded durable binding');
      events.push('owner-wait');
    },
    openGate() {
      assert.equal(existsSync(join(input.runtimePath, 'worker-bound.json')), true, 'gate preceded durable binding');
      events.push('gate-open');
    } };
  const input = { binding, root: join(directory, 'private-worker'), runtimePath: join(directory, 'journal'),
    prompt: 'Read the parent-owned complete handoff reference.', transcriptPath: join(directory, 'transcript.jsonl'),
    signal: controller.signal, authorityRoots: [join(directory, 'authority')], writeGrants: [], readOnlyControlPaths: [] };
  const port = {
    async deriveAuthority() { events.push('derive-authority'); return authority; },
    async acquireBroker() {
      assert.equal(existsSync(join(input.runtimePath, 'prepared.json')), true, 'broker acquired before prepared publication');
      events.push('acquire-broker'); return broker;
    },
    async launchWorker(launch: Parameters<typeof narrowSubscriptionCodingWorkerMaterialV1>[0] & { authorityRoots: readonly string[] }) {
      assert.deepEqual(launch.material.identity, identity); assert.ok(launch.authorityRoots.includes(input.runtimePath));
      // Fixture faithfully models the worker's actual deterministic narrowed material.
      // Expectations below mutate this independently to detect closure/hash mismatches.
      const effective = narrowSubscriptionCodingWorkerMaterialV1({ material: launch.material,
        writeGrants: launch.writeGrants, readOnlyControlPaths: launch.readOnlyControlPaths });
      Object.assign(isolation, { materialHash: effective.materialHash });
      Object.assign(workerOutput, { materialHash: effective.materialHash });
      events.push('launch-worker'); return worker;
    },
  };
  function originals(out: SubscriptionCodingWorkerOutputV1 = workerOutput) {
    originalClosure.resolve({ status: 'closed' }); output.resolve(out);
  }
  function finish(out: SubscriptionCodingWorkerOutputV1 = workerOutput) {
    brokerClosure.resolve(brokerReceipt); workerClosure.resolve({ status: 'closed' }); originals(out);
  }
  return { directory, input, port, authority, events, controller, broker, worker, brokerClosure,
    workerClosure, originalClosure, output, workerOutput, brokerReceipt, originals, finish,
    cleanup() { rmSync(directory, { recursive: true, force: true }); } };
}

test('joint owner publishes preparation before acquisition and binds original proof before exposing gate', async () => {
  const f = fixture(); try {
    const owner = await required().acquireSubscriptionCodingRuntimeV1(f.input, f.port);
    assert.deepEqual(f.events, ['derive-authority', 'acquire-broker', 'launch-worker', 'owner-wait']);
    assert.equal(owner.worker, f.worker);
    assert.match(owner.attachmentHash, /^[a-f0-9]{64}$/);
    const prepared = readFileSync(join(f.input.runtimePath, 'prepared.json'), 'utf8');
    const bound = readFileSync(join(f.input.runtimePath, 'worker-bound.json'), 'utf8');
    assert.ok(bound.includes('3'.repeat(64)));
    for (const text of [prepared, bound]) { assert.equal(text.includes('A'.repeat(43)), false); assert.equal(text.includes('apiKey'), false); }
    owner.openGate(); assert.equal(f.events.at(-1), 'gate-open');
    f.finish(); assert.equal((await owner.close('completed')).status, 'closed');
  } finally { f.cleanup(); }
});

test('inert runtime gives MiniMax PLAN matching broker and worker capacity within unchanged aggregate limits',async()=>{
  const f=fixture('stage-claim');try{
    const acquire=f.port.acquireBroker;
    let limits:unknown;
    const port={...f.port,async acquireBroker(request:{limits:unknown}){
      limits=request.limits;
      return acquire();
    }};
    const launch=f.port.launchWorker;
    let workerCapacity:unknown;
    port.launchWorker=async request=>{
      assert.deepEqual(request.material.argv.slice(-2),['--thinking','low']);
      workerCapacity=JSON.parse(request.material.files[0].contents).models.providers.minimax.models[0].maxTokens;
      return launch(request);
    };
    const owner=await required().acquireSubscriptionCodingRuntimeV1({...f.input,requestProfile:'plan-report-v1'} as never,port);
    f.finish();assert.equal((await owner.close('completed')).status,'closed');
    assert.deepEqual(limits,{maxRequests:128,maxOutputTokens:32768,maxTotalOutputTokens:524288,
      maxRequestBytes:2097152,maxResponseBytes:8388608,maxTotalResponseBytes:67108864,
      maxSseEventBytes:262144,attemptMs:1800000,requestMs:240000,idleMs:60000});
    assert.ok(Object.isFrozen(limits));
    assert.equal(workerCapacity,32768);
    assert.equal(f.events.filter(event=>event==='launch-worker').length,1);
  }finally{f.cleanup();}
});

test('close revokes broker before stopping worker and shares one promise until all originals close', async () => {
  const f = fixture(); try {
    const owner = await required().acquireSubscriptionCodingRuntimeV1(f.input, f.port);
    const first = owner.close('completed'), second = owner.close('owner-abort'); assert.equal(first, second);
    assert.deepEqual(f.events.slice(-2), ['broker-revoke', 'worker-stop']);
    let closed = false; void first.then(() => { closed = true; });
    f.workerClosure.resolve({ status: 'closed' }); f.brokerClosure.resolve(f.brokerReceipt);
    await flush(); assert.equal(closed, false, 'summary and stop acknowledgement are not original closure');
    f.originals(); const result = await first; assert.equal(result.status, 'closed');
    assert.deepEqual(result.binding, f.input.binding); assert.equal(result.attachmentHash, owner.attachmentHash);
    assert.equal(existsSync(join(f.input.runtimePath, 'closed.json')), true);
    assert.equal(owner.close('deadline'), first);
  } finally { f.cleanup(); }
});

test('original broker refusal remains diagnosable after joint closure without exposing worker material', async t => {
  const f = fixture(); const warnings: unknown[][] = [];
  t.mock.method(console, 'warn', (...args: unknown[]) => { warnings.push(args); });
  try {
    const owner = await required().acquireSubscriptionCodingRuntimeV1(f.input, f.port);
    f.brokerClosure.resolve({ status: 'closed', reason: 'refused', terminalCode: 'QUOTA',
      acceptedRequests: 1, responseBytes: 0, redactions: 0 });
    f.workerClosure.resolve({ status: 'closed' }); f.originals();
    assert.equal((await owner.closed).status, 'closed');
    assert.equal(warnings.length, 1, 'the original broker refusal code was lost');
    assert.equal(warnings[0].length, 1);
    const line = warnings[0][0]; assert.equal(typeof line, 'string');
    const prefix = '[subscription-runtime] SUBSCRIPTION_BROKER_TERMINAL ';
    assert.ok((line as string).startsWith(prefix));
    assert.deepEqual(JSON.parse((line as string).slice(prefix.length)), {
      runtimeSessionId: 'RT_coding_1', claimId: 51, modelRef: 'minimax/MiniMax-M3.1-Flash',
      reason: 'refused', terminalCode: 'QUOTA', acceptedRequests: 1, responseBytes: 0, redactions: 0,
    });
    assert.deepEqual(f.events.slice(-2), ['broker-revoke', 'worker-stop']);
    for (const privateValue of ['A'.repeat(43), 'fence_token_1', f.input.prompt, f.input.root]) {
      assert.equal((line as string).includes(privateValue), false);
    }
  } finally { f.finish(); f.cleanup(); }
});

test('diagnostic logger failure cannot interrupt original broker and worker closure', async t => {
  const f = fixture();
  t.mock.method(console, 'warn', () => { throw new Error('diagnostic sink unavailable'); });
  try {
    const owner = await required().acquireSubscriptionCodingRuntimeV1(f.input, f.port);
    f.brokerClosure.resolve({ status: 'closed', reason: 'refused', terminalCode: 'UPSTREAM_REJECTED',
      acceptedRequests: 1, responseBytes: 0, redactions: 0 });
    f.workerClosure.resolve({ status: 'closed' }); f.originals();
    assert.equal((await owner.closed).status, 'closed');
    assert.deepEqual(f.events.slice(-2), ['broker-revoke', 'worker-stop']);
  } finally { f.finish(); f.cleanup(); }
});

test('every acquired broker is retained when launch fails and startup Error.ownership retains uncertain worker', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const f = fixture(); try {
    const partial = { ...f.worker, originalClosed: undefined };
    f.port.launchWorker = async () => { throw new SubscriptionCodingWorkerStartupErrorV1(partial); };
    const starting = required().acquireSubscriptionCodingRuntimeV1(f.input, f.port);
    const refused = starting.then(() => assert.fail('partial launch admitted'), error => error as Error & {
      ownership: { broker: unknown; worker: unknown; close(reason: string): Promise<{ status: string }> } });
    await flush(); f.brokerClosure.resolve(f.brokerReceipt); f.workerClosure.resolve({ status: 'closed' });
    t.mock.timers.tick(2500); await flush();
    const error = await refused; assert.equal(error.message, 'SUBSCRIPTION_CODING_RUNTIME_REFUSED');
    assert.equal(error.ownership.broker, f.broker); assert.equal(error.ownership.worker, partial);
    assert.equal((await error.ownership.close('refused')).status, 'custody-uncertain');
    assert.deepEqual(f.events.slice(-2), ['broker-revoke', 'worker-stop']);
  } finally { f.cleanup(); }
});

test('abort closes the owned pair and keeps the gate shut without losing handles', async () => {
  const f = fixture(); try {
    const owner = await required().acquireSubscriptionCodingRuntimeV1(f.input, f.port);
    f.controller.abort(); assert.deepEqual(f.events.slice(-2), ['broker-revoke', 'worker-stop']);
    assert.throws(() => owner.openGate(), /SUBSCRIPTION_CODING_RUNTIME_REFUSED/);
    f.finish(); assert.equal((await owner.closed).status, 'closed');
  } finally { f.cleanup(); }
});

test('coding deadline is 1800 seconds and original observation stays bounded at 2500ms', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] }); const f = fixture(); try {
    const owner = await required().acquireSubscriptionCodingRuntimeV1(f.input, f.port);
    t.mock.timers.tick(20000); await flush(); assert.equal(f.events.includes('broker-revoke'), false);
    t.mock.timers.tick(1779999); await flush(); assert.equal(f.events.includes('broker-revoke'), false);
    t.mock.timers.tick(1); await flush(); assert.deepEqual(f.events.slice(-2), ['broker-revoke', 'worker-stop']);
    f.brokerClosure.resolve(f.brokerReceipt); f.workerClosure.resolve({ status: 'closed' });
    await flush(); t.mock.timers.tick(2500); await flush();
    const result = await owner.closed; assert.equal(result.status, 'custody-uncertain'); assert.equal(result.worker, 'custody-uncertain');
    f.originals(); await flush(); assert.equal((await owner.close('completed')).status, 'custody-uncertain');
    assert.equal(owner.worker.originalClosed, f.originalClosure.promise, 'late original retained after uncertainty');
  } finally { f.cleanup(); }
});

test('mismatched worker tuple is refused after acquisition and both known handles remain owned', async () => {
  const f = fixture(); try {
    const wrong = { ...f.worker, identity: { ...f.worker.identity, generationId: 'generation-8' } };
    f.port.launchWorker = async () => wrong;
    const refused = required().acquireSubscriptionCodingRuntimeV1(f.input, f.port).then(
      () => assert.fail('mismatched worker admitted'), error => error);
    await flush(); f.finish(); const error = await refused;
    assert.equal(error.message, 'SUBSCRIPTION_CODING_RUNTIME_REFUSED');
    assert.equal(error.ownership.worker, wrong); assert.equal(error.ownership.broker, f.broker);
    assert.equal((await error.ownership.closed).status, 'custody-uncertain');
  } finally { f.cleanup(); }
});

test('matching process close cannot hide mismatched final policy, model or stream evidence', async () => {
  const mutations = [
    (out: SubscriptionCodingWorkerOutputV1) => ({ ...out, proofHash: '9'.repeat(64) }),
    (out: SubscriptionCodingWorkerOutputV1) => ({ ...out, isolationHash: '9'.repeat(64) }),
    (out: SubscriptionCodingWorkerOutputV1) => ({ ...out, materialHash: '9'.repeat(64) }),
    (out: SubscriptionCodingWorkerOutputV1) => ({ ...out, stderrClosed: false }),
    (out: SubscriptionCodingWorkerOutputV1) => ({ ...out, streamError: true }),
  ];
  for (const mutate of mutations) { const f = fixture(); try {
    const owner = await required().acquireSubscriptionCodingRuntimeV1(f.input, f.port);
    f.finish(mutate(f.workerOutput)); assert.equal((await owner.close('completed')).status, 'custody-uncertain');
  } finally { f.cleanup(); } }
});

test('closure publication conflict cannot erase uncertainty or replace existing evidence', async () => {
  const f = fixture(); try {
    const owner = await required().acquireSubscriptionCodingRuntimeV1(f.input, f.port);
    const path = join(f.input.runtimePath, 'closed.json'); writeFileSync(path, 'conflicting-publication\n', { mode: 0o600 });
    f.finish(); const result = await owner.close('completed'); assert.equal(result.status, 'custody-uncertain');
    assert.equal(readFileSync(path, 'utf8'), 'conflicting-publication\n');
    assert.equal((await owner.close('completed')).status, 'custody-uncertain');
  } finally { f.cleanup(); }
});

test('Source drift refuses before broker acquisition and caller tuple never constitutes admission', async () => {
  const f = fixture(); try {
    f.port.deriveAuthority = async () => ({ ...f.authority, sourceSha: 'f'.repeat(40) });
    await assert.rejects(required().acquireSubscriptionCodingRuntimeV1(f.input, f.port), /SUBSCRIPTION_CODING_RUNTIME_REFUSED/);
    assert.equal(f.events.includes('acquire-broker'), false);
  } finally { f.cleanup(); }
});

test('abort during worker acquisition retains and closes a later acquired original instead of opening its gate', async () => {
  const f = fixture(); try {
    const acquiring = deferred<typeof f.worker>();
    f.port.launchWorker = async () => { f.events.push('launch-pending'); return acquiring.promise; };
    const starting = required().acquireSubscriptionCodingRuntimeV1(f.input, f.port).then(
      () => assert.fail('aborted startup admitted'), error => error);
    await flush(); f.controller.abort(); await flush();
    assert.ok(f.events.includes('broker-revoke'), 'known broker must be revoked while launch is pending');
    acquiring.resolve(f.worker); await flush(); f.finish(); const error = await starting;
    assert.equal(error.message, 'SUBSCRIPTION_CODING_RUNTIME_REFUSED'); assert.equal(error.ownership.worker, f.worker);
    assert.equal(f.events.includes('gate-open'), false); assert.ok(f.events.includes('worker-stop'));
  } finally { f.cleanup(); }
});


test('stage-claim owner uses labelled claim/runtime broker identity and publishes no execution attempt', async () => {
  const f = fixture('stage-claim'); try {
    const owner = await required().acquireSubscriptionCodingRuntimeV1(f.input, f.port);
    assert.equal(owner.worker.identity.attemptId, 'stage-claim-51');
    assert.match(owner.worker.identity.generationId, /^stage-runtime-[a-f0-9]{64}$/);
    const raw = readFileSync(join(f.input.runtimePath, 'prepared.json'), 'utf8');
    assert.ok(raw.includes('"stage-claim"'));
    for (const invented of ['attemptId', 'generation', 'fenceToken']) assert.equal(raw.includes('"' + invented + '"'), false);
    f.finish(); const result = await owner.close('completed');
    assert.equal(result.binding.kind, 'stage-claim'); assert.equal(result.status, 'closed');
  } finally { f.cleanup(); }
});


test('late startup rejection retains actual Error.ownership after abort observation has already timed out', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] }); const f = fixture(); try {
    const pending = deferred<typeof f.worker>();
    f.port.launchWorker = async () => pending.promise;
    const starting = required().acquireSubscriptionCodingRuntimeV1(f.input, f.port).then(
      () => assert.fail('aborted startup admitted'), error => error as Error & {
        ownership: { worker: unknown; closed: Promise<{ status: string }> }
      });
    await flush(); f.controller.abort(); await flush();
    f.brokerClosure.resolve(f.brokerReceipt); await flush();
    t.mock.timers.tick(2500); await flush();
    const error = await starting;
    assert.equal((await error.ownership.closed).status, 'custody-uncertain');
    const actualStartupError = new SubscriptionCodingWorkerStartupErrorV1(f.worker);
    const descriptor = Object.getOwnPropertyDescriptor(actualStartupError, 'ownership')!;
    assert.equal(descriptor.enumerable, false); assert.equal(descriptor.writable, false);
    pending.reject(actualStartupError); await flush();
    assert.equal(error.ownership.worker, f.worker, 'late rejected acquisition discarded its actual child owner');
    assert.ok(f.events.includes('worker-stop')); assert.equal(f.events.includes('gate-open'), false);
    assert.equal((error.ownership.worker as typeof f.worker).originalClosed, f.originalClosure.promise);
    f.finish(); await flush(); assert.equal((await error.ownership.closed).status, 'custody-uncertain');
  } finally { f.cleanup(); }
});

test('runtime waits for the original physical ACK after durable binding before exposing owner gate', async () => {
  const f = fixture(); const ack = deferred<void>();
  try {
    f.worker.waitForOwnerAdmission = () => {
      assert.equal(existsSync(join(f.input.runtimePath, 'worker-bound.json')), true);
      f.events.push('wait-pending'); return ack.promise;
    };
    let returned = false;
    const pending = required().acquireSubscriptionCodingRuntimeV1(f.input, f.port).then(value => { returned = true; return value; });
    await flush(); assert.equal(returned, false); assert.equal(f.events.at(-1), 'wait-pending');
    assert.equal(f.events.includes('gate-open'), false);
    ack.resolve(); const owner = await pending; assert.equal(returned, true);
    owner.openGate(); assert.equal(f.events.at(-1), 'gate-open');
    f.finish(); assert.equal((await owner.closed).status, 'closed');
  } finally { f.finish(); f.cleanup(); }
});

test('runtime refuses missing, malformed or rejecting physical wait and retains all acquired owners', async () => {
  for (const method of [undefined, () => ({ then() {} }), () => Promise.reject(Error('physical wait refused'))]) {
    const f = fixture(); try {
      Object.assign(f.worker, { waitForOwnerAdmission: method });
      const refused = required().acquireSubscriptionCodingRuntimeV1(f.input, f.port).then(
        () => assert.fail('invalid physical wait admitted'), error => error);
      await flush(); const error = await refused;
      assert.equal(error.message, 'SUBSCRIPTION_CODING_RUNTIME_REFUSED');
      assert.equal(error.ownership.worker, f.worker); assert.equal(error.ownership.broker, f.broker);
      assert.equal(f.events.includes('gate-open'), false); assert.deepEqual(f.events.slice(-2), ['broker-revoke', 'worker-stop']);
      f.finish(); assert.equal((await error.ownership.closed).status, 'custody-uncertain');
    } finally { f.cleanup(); }
  }
});

test('abort, original closure and original lifetime race a never-settling wait ACK without releasing custody', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  for (const failure of ['abort', 'original', 'lifetime']) {
    const f = fixture(); try {
      f.worker.waitForOwnerAdmission = () => new Promise<void>(() => {});
      const refused = required().acquireSubscriptionCodingRuntimeV1(f.input, f.port).then(
        () => assert.fail('closed physical wait admitted'), error => error);
      await flush(); assert.equal(existsSync(join(f.input.runtimePath, 'worker-bound.json')), true);
      if (failure === 'abort') f.controller.abort();
      if (failure === 'original') f.originals();
      if (failure === 'lifetime') { t.mock.timers.tick(1799999); await flush(); assert.equal(f.events.includes('broker-revoke'), false); t.mock.timers.tick(1); }
      await flush(); t.mock.timers.tick(2500); await flush();
      const error = await refused;
      assert.equal(error.ownership.worker, f.worker); assert.equal(error.ownership.worker.originalClosed, f.originalClosure.promise);
      assert.equal((await error.ownership.closed).status, 'custody-uncertain');
      assert.equal(f.events.includes('gate-open'), false); f.finish();
    } finally { f.cleanup(); }
  }
});
