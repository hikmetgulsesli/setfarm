import assert from 'node:assert/strict';
import test from 'node:test';
import ts from 'typescript';
import * as ownedFs from 'node:fs';
import { createHash } from 'node:crypto';
import { EventEmitter } from 'node:events';
import { chmodSync, linkSync, lstatSync, mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import * as ownedPath from 'node:path';
import { SUBSCRIPTION_SCOPED_FILE_OPERATIONS_V1 } from '../../src/execution/subscription-coding-scoped-file-tools-v1.js';
import { execFileSync, type ChildProcess } from 'node:child_process';
import { buildSubscriptionCodingMaterialV1 } from '../../src/execution/subscription-coding-policy-v1.js';
import type { ProcessIdentityV1 } from '../../src/execution/schemas/process-identity-v1.js';

// These tests exercise inert production data/protocol/custody and bounded owned
// filesystem DATA only, including a fixed mkfifo fixture utility. They never
// launch an SDK worker, listen, or qualify an OS sandbox.
let api: typeof import('../../src/execution/subscription-coding-worker-policy-v1.js') | undefined;
const workerApi = await import('../../src/execution/subscription-coding-worker-v1.js');
try {
  api = await import('../../src/execution/subscription-coding-worker-policy-v1.js');
} catch (error) {
  const missing = error as { code?: unknown; url?: unknown };
  const urls = ['.js', '.ts'].map(extension => new URL(
    '../../src/execution/subscription-coding-worker-policy-v1' + extension, import.meta.url).href);
  if (missing.code !== 'ERR_MODULE_NOT_FOUND' || !urls.includes(missing.url as string)) throw error;
}

test('public runtime accepts only the exact owned Homebrew admin ancestor exception', () => {
  assert.ok(api && typeof api.subscriptionCodingPublicAncestorAllowedV1 === 'function', 'public runtime ancestor policy missing');
  const normal = { path: '/opt/homebrew/lib', uid: 501n, gid: 80n, mode: 0o40775n, currentUid: 501n,
    directory: true, symbolicLink: false };
  assert.equal(api.subscriptionCodingPublicAncestorAllowedV1(normal), true);
  for (const delta of [{ path: '/opt/homebrew/lib/node_modules' }, { uid: 502n }, { gid: 20n },
    { mode: 0o40777n }, { directory: false }, { symbolicLink: true }]) {
    assert.equal(api.subscriptionCodingPublicAncestorAllowedV1({ ...normal, ...delta }), false);
  }
  assert.equal(api.subscriptionCodingPublicAncestorAllowedV1({ ...normal, path: '/opt/homebrew', mode: 0o40755n }), true);
});

function material() {
  const identity = { attemptId: 'ATT_worker_1', generationId: 'generation-7',
    modelRef: 'minimax/MiniMax-M3.1-Flash' as const };
  return buildSubscriptionCodingMaterialV1({ identity, worker: { ...identity,
    providerId: 'minimax', modelId: 'MiniMax-M3.1-Flash', baseUrl: 'http://127.0.0.1:49157/v1',
    api: 'anthropic-messages', apiKey: 'A'.repeat(43), auth: 'api-key', authHeader: true },
  root: '/private/tmp/owned worker', worktree: '/private/tmp/claimed project',
  prompt: 'Implement the complete inline claim using filesystem tools.' });
}
function cloneMaterial() { return JSON.parse(JSON.stringify(material())) as ReturnType<typeof material>; }

test('worker reconstructs only the exact fixed PLAN thinking-low suffix and binds its complete material hash',()=>{
  assert.ok(api);const normal=material(),plan=cloneMaterial();(plan.argv as string[]).push('--thinking','low');
  const checked=api.validateSubscriptionCodingWorkerMaterialV1(plan);
  assert.deepEqual(checked.material,plan);
  assert.equal(checked.materialHash,createHash('sha256').update(JSON.stringify(plan)).digest('hex'));
  assert.notEqual(checked.materialHash,api.validateSubscriptionCodingWorkerMaterialV1(normal).materialHash);
  for(const suffix of [['--thinking','off'],['--thinking','medium'],['--thinking','low','--thinking','low'],
    ['--thinking','low','--model','kimi/k3.1-pro'],['--thinking']]){
    const forged=cloneMaterial();(forged.argv as string[]).push(...suffix);
    assert.throws(()=>api!.validateSubscriptionCodingWorkerMaterialV1(forged),{message:'SUBSCRIPTION_CODING_WORKER_REFUSED'});
  }
  const configForged=JSON.parse(JSON.stringify(plan));
  const config=JSON.parse(configForged.files[0].contents);config.models.providers.minimax.models[0].maxTokens=16384;
  configForged.files[0].contents=JSON.stringify(config,null,2)+'\n';
  assert.throws(()=>api!.validateSubscriptionCodingWorkerMaterialV1(configForged),{message:'SUBSCRIPTION_CODING_WORKER_REFUSED'});
});
const identity: ProcessIdentityV1 = { schema: 'setfarm.process-identity.v1', pid: 43210,
  processStartedAt: '2026-11-04T12:00:00.000Z', processGroupId: 43200, source: 'observed_os' };
function binding() {
  return { nonce: '1'.repeat(64), pid: identity.pid, identity: material().identity,
    materialHash: '2'.repeat(64), policyHash: '3'.repeat(64), preloadHash: '4'.repeat(64) };
}
function proofFrame() {
  return { schema: 'setfarm.subscription-coding-probe.v1', type: 'proof', ...binding(),
    results: { credentialRead: 'EACCES', authorityWrite: 'EPERM', sameNodeSpawn: 'EPERM',
      nonPinnedExec: 'EACCES', publicConnect: 'EPERM', loopbackConnect: 'EACCES', brokerConnect: 'connected' } };
}
function line(value: unknown) { return Buffer.from(JSON.stringify(value) + '\n'); }
function openedFrame() {
  return { schema: 'setfarm.subscription-coding-probe.v1', type: 'opened', ...binding() };
}
function paths() {
  return { privateRoot: '/private/tmp/owned worker', worktree: '/private/tmp/claimed project',
    authorityRoots: ['/private/owner/credentials', '/private/owner/journal'],
    gitControlPaths: ['/private/tmp/claimed project/.git', '/private/owner/git/common',
      '/private/owner/git/common/worktrees/claimed'],
    nodePath: '/opt/homebrew/Cellar/node/26.4.0/bin/node',
    nodeLibraryPaths: { readPaths: ['/opt/homebrew/opt/llhttp/lib/libllhttp.9.4.dylib',
      '/opt/homebrew/Cellar/llhttp/9.4.2/lib/libllhttp.9.4.2.dylib'],
    mapPaths: ['/opt/homebrew/opt/llhttp/lib/libllhttp.9.4.dylib',
      '/opt/homebrew/Cellar/llhttp/9.4.2/lib/libllhttp.9.4.2.dylib'] },
    openclawRoot: '/opt/homebrew/lib/node_modules/openclaw',
    preloadPath: '/private/tmp/owned worker/fixed-gate.mjs',
    profilePath: '/private/tmp/owned worker/profile.sb',
    transcriptPath: '/private/owner/transcripts/worker.jsonl', brokerPort: 49157,
    // This existing policy fixture explicitly models a bootstrap role's full grant.
    writeGrants: [{ path: '/private/tmp/claimed project', kind: 'directory' as const }],
    readOnlyControlPaths: [] as string[] };
}

test('worker policy API is available without launching an executable', () => {
  assert.equal(typeof api?.validateSubscriptionCodingWorkerMaterialV1, 'function',
    'Task4 worker material/protocol/custody implementation is missing');
  assert.equal(typeof api?.buildSubscriptionCodingSandboxPolicyV1, 'function');
  assert.equal(typeof api?.createSubscriptionCodingProbeProtocolV1, 'function');
  assert.equal(typeof api?.createSubscriptionCodingCustodyTrackerV1, 'function');
});

test('material validator reconstructs the fixed coding projection and rejects forged tools, env, URL and argv', { skip: !api }, () => {
  const original = material();
  const checked = api!.validateSubscriptionCodingWorkerMaterialV1(original);
  assert.equal(checked.root, '/private/tmp/owned worker');
  assert.equal(checked.brokerPort, 49157);
  assert.match(checked.materialHash, /^[a-f0-9]{64}$/);
  assert.deepEqual(checked.material, material());
  assert.notEqual(checked.material, original);
  assert.ok(Object.isFrozen(checked.material.env));
  const mutations: Array<(value: ReturnType<typeof cloneMaterial>) => void> = [
    value => { (value.env as Record<string, string>).NODE_OPTIONS = '--require /ambient/hook.cjs'; },
    value => { (value.env as Record<string, string>).HOME = '/Users/ambient'; },
    value => { (value.argv as string[]).push('--gateway'); },
    value => { (value.argv as string[])[value.argv.length - 1] = '20'; },
    value => { Object.assign(value, { profile: 'private-headless-readonly-v1' }); },
    value => { Object.assign(value, { sessionId: 'forged-session' }); },
    value => { Object.assign(value.files[1], { contents: '{"version":1,"profiles":{"ambient":{}}}\n' }); },
    ...['tools', 'workspace', 'provider', 'fallback', 'timeout'].map(kind => (value: ReturnType<typeof cloneMaterial>) => {
      const cfg = JSON.parse(value.files[0].contents);
      if (kind === 'tools') cfg.tools.allow.push('exec');
      if (kind === 'workspace') cfg.tools.fs.workspaceOnly = false;
      if (kind === 'provider') cfg.models.providers.minimax.baseUrl = 'https://provider.invalid/v1';
      if (kind === 'fallback') cfg.agents.defaults.model.fallbacks.push('ambient/model');
      if (kind === 'timeout') cfg.agents.defaults.timeoutSeconds = 20;
      Object.assign(value.files[0], { contents: JSON.stringify(cfg, null, 2) + '\n' });
    }),
  ];
  for (const mutate of mutations) {
    const forged = cloneMaterial(); mutate(forged);
    assert.throws(() => api!.validateSubscriptionCodingWorkerMaterialV1(forged),
      { message: 'SUBSCRIPTION_CODING_WORKER_REFUSED' });
  }
});

test('closed material data refuses getters, proxies and extra members without executing caller code', { skip: !api }, () => {
  let calls = 0;
  const trap = () => { calls++; throw new Error('FAKE_PRIVATE_DETAIL'); };
  const getter = Object.defineProperty(cloneMaterial(), 'env', { get: trap });
  const proxied = new Proxy(cloneMaterial(), { get: trap, ownKeys: trap, getPrototypeOf: trap });
  const nested = cloneMaterial(); Object.assign(nested, { env: new Proxy(nested.env, { ownKeys: trap }) });
  for (const value of [getter, proxied, nested, { ...cloneMaterial(), ready: true }, null, []]) {
    assert.throws(() => api!.validateSubscriptionCodingWorkerMaterialV1(value as never),
      { message: 'SUBSCRIPTION_CODING_WORKER_REFUSED' });
  }
  assert.equal(calls, 0);
});

test('canonical path policy refuses aliases and protected overlap before producing a sandbox profile', { skip: !api }, () => {
  const invalid: unknown[] = [
    { ...paths(), worktree: '/private/tmp/claimed project/../escape' },
    { ...paths(), privateRoot: '/private/tmp/claimed project/runtime' },
    { ...paths(), authorityRoots: ['/private/tmp/claimed project'] },
    { ...paths(), authorityRoots: ['/private/tmp/owned worker/state'] },
    { ...paths(), gitControlPaths: ['/private/tmp/claimed project/src'] },
    { ...paths(), preloadPath: '/private/tmp/claimed project/gate.mjs' },
    { ...paths(), transcriptPath: '/private/tmp/owned worker/state/transcript' },
    { ...paths(), worktree: '/opt/homebrew/lib/node_modules/openclaw/project' },
    { ...paths(), worktree: '/private/tmp/bad\npath' },
    ...[0, 3080, 3333, 18789, 65536].map(brokerPort => ({ ...paths(), brokerPort })),
  ];
  for (const value of invalid) assert.throws(() => api!.buildSubscriptionCodingSandboxPolicyV1(value as never),
    { message: 'SUBSCRIPTION_CODING_WORKER_REFUSED' });
});

test('sandbox serialization keeps protected exclusions on writes and only the pinned exec and exact broker endpoint', { skip: !api }, () => {
  // These assertions concern emitted policy DATA; actual denial needs Root's OS qualification.
  const policy = api!.buildSubscriptionCodingSandboxPolicyV1(paths());
  assert.match(policy, /\(deny default\)/);
  assert.match(policy, /\(deny process-fork\)/);
  assert.match(policy, /\(allow process-exec \(literal "\/opt\/homebrew\/Cellar\/node\/26\.4\.0\/bin\/node"\)\)/);
  assert.match(policy, /\(allow network-outbound \(remote tcp4 "localhost:49157"\)\)/);
  assert.doesNotMatch(policy, /\(allow (?:network-inbound|process-fork)\b/);
  assert.doesNotMatch(policy, /\(allow network-outbound\s*\)/);
  assert.doesNotMatch(policy, /\(subpath "(?:\/|\/Users|\/private|\/opt)"\)/);
  const writes = policy.split('\n').filter(row => row.startsWith('(allow file-write'));
  assert.ok(writes.length > 0);
  for (const row of writes) {
    assert.match(row, /require-all/);
    for (const protectedPath of [...paths().gitControlPaths, ...paths().authorityRoots,
      paths().preloadPath, paths().profilePath]) {
      assert.ok(row.includes(JSON.stringify(protectedPath)), 'a broader write grant must not reopen a protected path');
    }
  }
});

test('nonce protocol binds every proof field and accepts a single gate only after a complete valid proof', { skip: !api }, () => {
  const protocol = api!.createSubscriptionCodingProbeProtocolV1(binding());
  assert.equal(protocol.state, 'awaiting-proof');
  assert.throws(() => protocol.openGate(), { message: 'SUBSCRIPTION_CODING_WORKER_REFUSED' });
  const ready = api!.createSubscriptionCodingProbeProtocolV1(binding());
  const bytes = line(proofFrame());
  ready.accept(bytes.subarray(0, 17)); assert.equal(ready.state, 'awaiting-proof');
  ready.accept(bytes.subarray(17)); assert.equal(ready.state, 'ready');
  assert.match(ready.proofHash!, /^[a-f0-9]{64}$/);
  const gate = JSON.parse(ready.openGate());
  assert.deepEqual(gate, { schema: 'setfarm.subscription-coding-gate.v1', type: 'open', ...binding() });
  assert.equal(ready.state, 'gate-sent');
  ready.accept(line(openedFrame())); assert.equal(ready.state, 'open');
  assert.throws(() => ready.openGate(), { message: 'SUBSCRIPTION_CODING_WORKER_REFUSED' });
  const badFrames: unknown[] = [
    { ...proofFrame(), nonce: 'f'.repeat(64) }, { ...proofFrame(), pid: identity.pid + 1 },
    { ...proofFrame(), materialHash: 'f'.repeat(64) }, { ...proofFrame(), policyHash: 'f'.repeat(64) },
    { ...proofFrame(), preloadHash: 'f'.repeat(64) },
    { ...proofFrame(), identity: { ...material().identity, generationId: 'generation-8' } },
    { ...proofFrame(), extra: true }, { ...proofFrame(), type: 'ready' }, openedFrame(),
    ...['credentialRead', 'authorityWrite', 'sameNodeSpawn', 'nonPinnedExec', 'publicConnect', 'loopbackConnect']
      .flatMap(key => ['allowed', 'ECONNREFUSED', 'ETIMEDOUT'].map(result => ({ ...proofFrame(),
        results: { ...proofFrame().results, [key]: result } }))),
    { ...proofFrame(), results: { ...proofFrame().results, brokerConnect: 'ECONNREFUSED' } },
  ];
  for (const frame of badFrames) {
    const bad = api!.createSubscriptionCodingProbeProtocolV1(binding());
    assert.throws(() => bad.accept(line(frame)), { message: 'SUBSCRIPTION_CODING_WORKER_REFUSED' });
    assert.equal(bad.state, 'failed');
  }
});

test('duplicate, partial, oversized and EOF proof frames fail closed with no recoverable readiness', { skip: !api }, () => {
  for (const bytes of [Buffer.alloc(16385, 120), Buffer.from('{"type":"proof"}\n'),
    Buffer.from(JSON.stringify(proofFrame()).replace('"type":"proof"', '"type":"proof","type":"proof"') + '\n')]) {
    const protocol = api!.createSubscriptionCodingProbeProtocolV1(binding());
    assert.throws(() => protocol.accept(bytes), { message: 'SUBSCRIPTION_CODING_WORKER_REFUSED' });
    assert.equal(protocol.state, 'failed');
  }
  const duplicate = api!.createSubscriptionCodingProbeProtocolV1(binding());
  duplicate.accept(line(proofFrame()));
  assert.throws(() => duplicate.accept(line(proofFrame())), { message: 'SUBSCRIPTION_CODING_WORKER_REFUSED' });
  const eof = api!.createSubscriptionCodingProbeProtocolV1(binding());
  eof.accept(line(proofFrame()).subarray(0, 19));
  assert.throws(() => eof.end(), { message: 'SUBSCRIPTION_CODING_WORKER_REFUSED' });
  assert.equal(eof.state, 'failed');
});

test('custody waits for original process and late EOF on both streams; exact identity prevents reused PID signals', { skip: !api }, () => {
  const protocol = api!.createSubscriptionCodingProbeProtocolV1(binding());
  protocol.accept(line(proofFrame()));
  const tracker = api!.createSubscriptionCodingCustodyTrackerV1(identity, protocol);
  assert.equal(tracker.status, 'pending');
  assert.equal(tracker.canSignal(identity), true);
  for (const observed of [null, { ...identity, pid: identity.pid + 1 },
    { ...identity, processStartedAt: '2026-11-04T12:00:00.001Z' },
    { ...identity, processGroupId: identity.processGroupId! + 1 },
    { ...identity, source: 'tracked_child' as const }]) assert.equal(tracker.canSignal(observed), false);
  tracker.observe('child-exit');
  assert.equal(tracker.canSignal(identity), false);
  tracker.observe('child-close'); tracker.observe('stdout-close'); tracker.observe('stderr-close');
  assert.equal(tracker.status, 'pending', 'close without original stream EOF is insufficient');
  tracker.observe('stdout-end'); assert.equal(tracker.status, 'pending');
  tracker.observe('stderr-end'); assert.equal(tracker.status, 'closed');
  const noProof = api!.createSubscriptionCodingCustodyTrackerV1(identity,
    api!.createSubscriptionCodingProbeProtocolV1(binding()));
  for (const event of ['child-exit', 'child-close', 'stdout-end', 'stdout-close', 'stderr-end', 'stderr-close'] as const) noProof.observe(event);
  assert.equal(noProof.status, 'custody-uncertain', 'exit and EOF cannot replace genuine applied-policy probe provenance');
  const lateError = api!.createSubscriptionCodingCustodyTrackerV1(identity, protocol);
  lateError.observe('stdout-error'); lateError.observe('deadline');
  assert.equal(lateError.status, 'custody-uncertain');
  // Uncertain diagnostics do not release cleanup ownership of the still-live original child.
  assert.equal(lateError.canSignal(identity), true);
});

test('empty canonical mutation grants narrow the effective SDK to read and bind grants plus actual config', { skip: !api }, () => {
  assert.equal(typeof api!.narrowSubscriptionCodingWorkerMaterialV1, 'function',
    'canonical role mutation-grant narrowing is missing');
  const seed = material(), control = seed.cwd + '/.setfarm/claim.json';
  const effective = api!.narrowSubscriptionCodingWorkerMaterialV1({
    material: seed, writeGrants: [], readOnlyControlPaths: [control],
  });
  const config = JSON.parse(effective.material.files[0].contents);
  assert.deepEqual(config.tools.allow, ['read']);
  assert.equal(config.tools.fs.workspaceOnly, true);
  assert.deepEqual(config.agents.defaults.model.fallbacks, []);
  assert.deepEqual(seed, material(), 'narrowing must preserve the fixed seed projection');
  const writable = api!.narrowSubscriptionCodingWorkerMaterialV1({
    material: seed, writeGrants: [{ path: seed.cwd + '/src', kind: 'directory' }],
    readOnlyControlPaths: [control],
  });
  assert.deepEqual(JSON.parse(writable.material.files[0].contents).tools.allow, ['read', 'setfarm_write', 'setfarm_edit']);
  assert.notEqual(effective.materialHash, writable.materialHash);
  const otherControl = api!.narrowSubscriptionCodingWorkerMaterialV1({
    material: seed, writeGrants: [], readOnlyControlPaths: [seed.cwd + '/.setfarm/other-claim.json'],
  });
  assert.notEqual(effective.materialHash, otherControl.materialHash);
  const readOnlyPolicy = api!.buildSubscriptionCodingSandboxPolicyV1({
    ...paths(), writeGrants: [], readOnlyControlPaths: [control],
  });
  const worktreeWrites = readOnlyPolicy.split('\n').filter(row =>
    row.startsWith('(allow file-write') && (row.includes('(require-all (subpath "/private/tmp/claimed project")')
      || row.includes('(require-all (literal "/private/tmp/claimed project")')));
  assert.deepEqual(worktreeWrites, [], 'no workspace write grant may be synthesized for a read-only role');
});

test('canonical slice grants restrict writable predicates and a broad grant cannot reopen handoff controls', { skip: !api }, () => {
  const worktree = material().cwd, control = worktree + '/.setfarm/claim.json';
  const scoped = { ...paths(), writeGrants: [
    { path: worktree + '/src', kind: 'directory' as const },
    { path: worktree + '/README.md', kind: 'file' as const },
  ], readOnlyControlPaths: [control] };
  const policy = api!.buildSubscriptionCodingSandboxPolicyV1(scoped);
  const writes = policy.split('\n').filter(row => row.startsWith('(allow file-write'));
  assert.ok(writes.some(row => row.includes('(subpath "/private/tmp/claimed project/src")')));
  assert.ok(writes.some(row => row.includes('(literal "/private/tmp/claimed project/README.md")')));
  assert.ok(!writes.some(row => row.includes('(subpath "/private/tmp/claimed project")')));
  const broad = api!.buildSubscriptionCodingSandboxPolicyV1({ ...scoped,
    writeGrants: [{ path: worktree, kind: 'directory' }] });
  const broadWrite = broad.split('\n').find(row =>
    row.startsWith('(allow file-write') && row.includes('(subpath "/private/tmp/claimed project")'));
  assert.ok(broadWrite);
  assert.ok(broadWrite.includes('(require-not (subpath "/private/tmp/claimed project/.setfarm/claim.json"))'));
  // Path serialization only: Root separately qualifies actual rename denial.
  const structuralWrites = broad.split('\n').filter(row => row.startsWith('(allow file-write-unlink'));
  assert.ok(structuralWrites.length > 0, 'structural writes require their own bounded predicates');
  for (const row of structuralWrites) {
    assert.ok(row.includes('(require-not (literal "/private/tmp/claimed project/.setfarm"))'),
      'renaming a handoff ancestor must not move the protected inode into a writable namespace');
    assert.ok(row.includes('(require-not (literal "/private/tmp/claimed project"))'),
      'the original workspace namespace must stay anchored');
  }
  for (const writeGrants of [
    [{ path: '/private/owner/credentials', kind: 'directory' }],
    [{ path: worktree + '/../outside', kind: 'directory' }],
    [{ path: worktree + '/src', kind: 'all' }],
    [{ path: worktree + '/.git/config', kind: 'file' }],
    [{ path: worktree + '/src', kind: 'directory', approved: true }],
  ]) assert.throws(() => api!.buildSubscriptionCodingSandboxPolicyV1({ ...scoped, writeGrants } as never),
    { message: 'SUBSCRIPTION_CODING_WORKER_REFUSED' });
  assert.throws(() => api!.buildSubscriptionCodingSandboxPolicyV1({
    ...scoped, readOnlyControlPaths: ['/private/owner/journal/claim.json'],
  }), { message: 'SUBSCRIPTION_CODING_WORKER_REFUSED' });
});

test('post-spawn startup refusal retains pending original ownership after cleanup acknowledgement', async () => {
  assert.equal(typeof workerApi.rejectSubscriptionCodingWorkerStartupV1, 'function',
    'startup refusal must retain the real partial acquisition');
  const child = Object.assign(new EventEmitter(), { pid: 43210 }) as ChildProcess;
  const originalClosed = new Promise<{ status: 'closed' | 'custody-uncertain' }>(() => {});
  const originalOutput = new Promise<never>(() => {});
  const stop = async () => {}; // A cleanup acknowledgement is deliberately not original closure.
  const partial = { identity: material().identity, child, closed: originalClosed, originalClosed, output: originalOutput,
    processIdentity: undefined, stop };
  let failure: unknown;
  try { await workerApi.rejectSubscriptionCodingWorkerStartupV1(partial); }
  catch (error) { failure = error; }
  assert.ok(failure instanceof Error);
  assert.equal(failure.message, 'SUBSCRIPTION_CODING_WORKER_REFUSED');
  const descriptor = Object.getOwnPropertyDescriptor(failure, 'ownership');
  assert.ok(descriptor);
  assert.equal(descriptor.enumerable, false);
  assert.equal(descriptor.writable, false);
  assert.equal(descriptor.configurable, false);
  assert.equal(descriptor.value, partial);
  assert.equal(descriptor.value.child, child);
  assert.equal(descriptor.value.closed, originalClosed);
  assert.equal(descriptor.value.originalClosed, originalClosed);
  assert.equal(descriptor.value.output, originalOutput);
  assert.equal(descriptor.value.stop, stop);
  assert.ok(!Object.hasOwn(descriptor.value, 'openGate'));
  assert.equal(JSON.stringify(failure), '{}');
  assert.equal(await Promise.race([originalClosed.then(() => 'settled'), Promise.resolve('pending')]), 'pending');
});

test('challenge uses an existing pinned protected file for a nonmutating write-open probe', { skip: !api }, () => {
  assert.equal(typeof api!.buildSubscriptionCodingProbeChallengeV1, 'function',
    'the authority probe must bind an existing protected file');
  const challenge = api!.buildSubscriptionCodingProbeChallengeV1({
    binding: binding(), profilePath: paths().profilePath, preloadPath: paths().preloadPath,
    credentialProbePath: paths().authorityRoots[0], brokerPort: 49157, nodePath: paths().nodePath,
    argvHash: '5'.repeat(64), environmentHash: '6'.repeat(64),
    files: material().files.map(file => ({ path: file.path, hash: '7'.repeat(64) })),
  });
  assert.equal(challenge.authorityProbePath, '/private/tmp/owned worker/profile.sb');
  assert.equal(challenge.authorityProbeHash, '3'.repeat(64));
  assert.equal(challenge.profilePath, challenge.authorityProbePath);
  assert.ok(!JSON.stringify(challenge).includes('A'.repeat(43)));
  assert.ok(!challenge.authorityProbePath.includes(binding().nonce));
});

test('filesystem DATA inspection permits safe npm bin links and protected Git absence while rejecting escapes', () => {
  assert.equal(typeof workerApi.inspectSubscriptionCodingWorktreeV1, 'function',
    'bounded physical path inspection is missing');
  assert.equal(typeof workerApi.inspectSubscriptionCodingGitControlPathsV1, 'function',
    'protected absent Git metadata inspection is missing');
  const fixture = mkdtempSync(join(realpathSync(tmpdir()), 'sf-worker-path-data-'));
  chmodSync(fixture, 0o700);
  const worktree = fixture + '/worktree';
  mkdirSync(worktree, { mode: 0o700 });
  const makeDirectory = (path: string) => mkdirSync(path, { recursive: true, mode: 0o700 });
  const makeFile = (path: string) => writeFileSync(path, 'owned inert fixture\n', { mode: 0o600 });
  try {
    makeDirectory(worktree + '/node_modules/.bin');
    makeDirectory(worktree + '/node_modules/package');
    makeFile(worktree + '/node_modules/package/bin.js');
    symlinkSync('../package/bin.js', worktree + '/node_modules/.bin/tool');
    assert.doesNotThrow(() => workerApi.inspectSubscriptionCodingWorktreeV1(worktree, []));
    const absent = workerApi.inspectSubscriptionCodingGitControlPathsV1(worktree);
    assert.equal(absent.kind, 'absent');
    assert.deepEqual(absent.paths, [worktree + '/.git']);
    makeDirectory(worktree + '/.git');
    makeFile(worktree + '/.git/config');
    assert.equal(workerApi.inspectSubscriptionCodingGitControlPathsV1(worktree).kind, 'present');
    makeDirectory(worktree + '/.setfarm');
    makeFile(worktree + '/.setfarm/claim.json');
    symlinkSync('../../.setfarm/claim.json', worktree + '/node_modules/.bin/control');
    assert.throws(() => workerApi.inspectSubscriptionCodingWorktreeV1(worktree, [worktree + '/.setfarm/claim.json']),
      { message: 'SUBSCRIPTION_CODING_WORKER_REFUSED' });
    rmSync(worktree + '/node_modules/.bin/control');
    makeFile(fixture + '/outside.js');
    symlinkSync('../../../outside.js', worktree + '/node_modules/.bin/outside');
    assert.throws(() => workerApi.inspectSubscriptionCodingWorktreeV1(worktree, []),
      { message: 'SUBSCRIPTION_CODING_WORKER_REFUSED' });
    rmSync(worktree + '/node_modules/.bin/outside');
    symlinkSync('../../.git/config', worktree + '/node_modules/.bin/git-control');
    assert.throws(() => workerApi.inspectSubscriptionCodingWorktreeV1(worktree, []),
      { message: 'SUBSCRIPTION_CODING_WORKER_REFUSED' });
    rmSync(worktree + '/node_modules/.bin/git-control');
    symlinkSync('cycle-b', worktree + '/node_modules/.bin/cycle-a');
    symlinkSync('cycle-a', worktree + '/node_modules/.bin/cycle-b');
    assert.throws(() => workerApi.inspectSubscriptionCodingWorktreeV1(worktree, []),
      { message: 'SUBSCRIPTION_CODING_WORKER_REFUSED' });
    rmSync(worktree + '/node_modules/.bin/cycle-a'); rmSync(worktree + '/node_modules/.bin/cycle-b');
    linkSync(fixture + '/outside.js', worktree + '/hardlink.js');
    assert.throws(() => workerApi.inspectSubscriptionCodingWorktreeV1(worktree, []),
      { message: 'SUBSCRIPTION_CODING_WORKER_REFUSED' });
  } finally { rmSync(fixture, { recursive: true, force: true }); }
});

test('transcript close invalidates descriptor ownership once even when close releases then throws', { skip: !api }, () => {
  assert.equal(typeof api!.createSubscriptionCodingTranscriptCloserV1, 'function',
    'one-shot transcript descriptor custody is missing');
  let generation: 'original' | 'replacement' = 'original', replacementOpen = false;
  const closer = api!.createSubscriptionCodingTranscriptCloserV1(81, {
    validateAndSync(fd: number) { assert.equal(fd, 81); },
    close(fd: number) {
      assert.equal(fd, 81);
      if (generation === 'original') {
        generation = 'replacement'; replacementOpen = true;
        throw new Error('FAKE_CLOSE_RELEASED_DESCRIPTOR');
      }
      replacementOpen = false;
    },
  });
  assert.equal(closer.close(), 'custody-uncertain');
  assert.equal(closer.fd, undefined, 'numeric descriptor ownership must be invalidated before close');
  assert.equal(closer.close(), 'custody-uncertain');
  assert.equal(replacementOpen, true, 'a reused numeric descriptor must never be retried');
  let originalOpen = true;
  const failedSync = api!.createSubscriptionCodingTranscriptCloserV1(82, {
    validateAndSync() { throw new Error('FAKE_SYNC_FAILURE'); },
    close() { originalOpen = false; },
  });
  assert.equal(failedSync.close(), 'custody-uncertain');
  assert.equal(originalOpen, false, 'validation/sync failure still closes the owned descriptor once');
});

test('sandbox permits dyld root-directory open without granting root subtree file data', () => {
  assert.ok(api, 'worker policy implementation is required');
  const policy = api.buildSubscriptionCodingSandboxPolicyV1(paths());
  assert.match(policy, /^\(allow file-read-data \(literal "\/"\)\)$/m);
  assert.doesNotMatch(policy, /\(allow file-read(?:-data|\*)?\s+\(subpath "\/"\)\)/);
});


test('Node library policy grants exact files and ancestor metadata with all protected exclusions', () => {
  assert.ok(api);
  const policy = api.buildSubscriptionCodingSandboxPolicyV1(paths());
  for (const path of paths().nodeLibraryPaths.readPaths) {
    const reads = policy.split('\n').filter(row => row.startsWith('(allow file-read*') && row.includes('(literal ' + JSON.stringify(path) + ')'));
    const maps = policy.split('\n').filter(row => row.startsWith('(allow file-map-executable') && row.includes('(literal ' + JSON.stringify(path) + ')'));
    assert.equal(reads.length, 1); assert.equal(maps.length, 1);
    for (const row of [...reads, ...maps]) for (const protectedPath of [...paths().authorityRoots,
      ...paths().gitControlPaths, paths().transcriptPath]) assert.ok(row.includes(JSON.stringify(protectedPath)));
  }
  assert.match(policy, /file-read-metadata.*\(literal "\/opt\/homebrew\/opt\/llhttp\/lib"\)/);
  assert.doesNotMatch(policy, /\(subpath "\/opt\/homebrew\/(?:opt(?:\/[^" ]*)?|Cellar\/llhttp(?:\/[^" ]*)?)"\)/);
});

test('Node library policy rejects missing, directory, non-public, duplicate and overlapping path DATA', () => {
  assert.ok(api);
  const noLibraries = { ...paths() } as Record<string, unknown>; delete noLibraries.nodeLibraryPaths;
  assert.throws(() => api!.buildSubscriptionCodingSandboxPolicyV1(noLibraries as never));
  for (const path of ['/opt/homebrew', '/opt/homebrew/opt/llhttp/lib', '/Users/owner/key.dylib',
    '/opt/homebrew/lib/node_modules/openclaw/hook.dylib', '/opt/homebrew/opt/llhttp/../key.dylib']) {
    assert.throws(() => api!.buildSubscriptionCodingSandboxPolicyV1({ ...paths(),
      nodeLibraryPaths: { readPaths: [path], mapPaths: [path] } }));
  }
  const publicFile = paths().nodeLibraryPaths.readPaths[0];
  for (const nodeLibraryPaths of [
    { readPaths: [publicFile, publicFile], mapPaths: [publicFile] },
    { readPaths: [], mapPaths: [publicFile] },
    { readPaths: [publicFile], mapPaths: [publicFile], approved: true },
  ]) assert.throws(() => api!.buildSubscriptionCodingSandboxPolicyV1({ ...paths(), nodeLibraryPaths } as never));
  for (const field of ['authorityRoots', 'gitControlPaths'] as const) {
    const value = field === 'authorityRoots' ? [publicFile] : [paths().worktree + '/.git', publicFile];
    assert.throws(() => api!.buildSubscriptionCodingSandboxPolicyV1({ ...paths(), [field]: value }));
  }
  assert.throws(() => api!.buildSubscriptionCodingSandboxPolicyV1({ ...paths(), transcriptPath: publicFile }));
});


test('SDK temp preparation creates only the fixed owned UID leaf and refuses aliases, unsafe parents and existing paths', () => {
  assert.equal(typeof workerApi.prepareSubscriptionCodingSdkTempDirectoryV1, 'function',
    'parent-owned SDK temp preparation capability missing');
  assert.ok(process.getuid);
  const owner = process.getuid();
  const fixture = mkdtempSync(join(realpathSync(tmpdir()), 'sf-sdk-temp-data-'));
  const root = (name: string, rootMode = 0o700, tmpMode = 0o700) => {
    const path = join(fixture, name); mkdirSync(path, { mode: rootMode }); chmodSync(path, rootMode);
    mkdirSync(join(path, 'tmp'), { mode: tmpMode }); chmodSync(join(path, 'tmp'), tmpMode); return path;
  };
  try {
    const privateRoot = root('private');
    const expected = privateRoot + '/tmp/openclaw-' + owner;
    const path = workerApi.prepareSubscriptionCodingSdkTempDirectoryV1(privateRoot);
    assert.equal(path, expected); assert.equal(realpathSync(path), expected);
    const stat = lstatSync(path);
    assert.equal(stat.isDirectory(), true); assert.equal(stat.isSymbolicLink(), false);
    assert.equal(stat.uid, owner); assert.equal(stat.mode & 0o7777, 0o700);
    assert.throws(() => workerApi.prepareSubscriptionCodingSdkTempDirectoryV1(privateRoot),
      { message: 'SUBSCRIPTION_CODING_WORKER_REFUSED' }, 'existing UID leaf must never be adopted');
    for (const unsafe of [root('public-root', 0o755), root('public-tmp', 0o700, 0o755)]) {
      assert.throws(() => workerApi.prepareSubscriptionCodingSdkTempDirectoryV1(unsafe),
        { message: 'SUBSCRIPTION_CODING_WORKER_REFUSED' });
    }
    const realRoot = root('real-root'); const aliasRoot = join(fixture, 'alias-root');
    symlinkSync(realRoot, aliasRoot);
    assert.throws(() => workerApi.prepareSubscriptionCodingSdkTempDirectoryV1(aliasRoot),
      { message: 'SUBSCRIPTION_CODING_WORKER_REFUSED' });
    const tmpAliasRoot = join(fixture, 'tmp-alias-root'); mkdirSync(tmpAliasRoot, { mode: 0o700 });
    symlinkSync(join(realRoot, 'tmp'), join(tmpAliasRoot, 'tmp'));
    assert.throws(() => workerApi.prepareSubscriptionCodingSdkTempDirectoryV1(tmpAliasRoot),
      { message: 'SUBSCRIPTION_CODING_WORKER_REFUSED' });
    const existingAliasRoot = root('existing-alias');
    symlinkSync(join(realRoot, 'tmp'), existingAliasRoot + '/tmp/openclaw-' + owner);
    assert.throws(() => workerApi.prepareSubscriptionCodingSdkTempDirectoryV1(existingAliasRoot),
      { message: 'SUBSCRIPTION_CODING_WORKER_REFUSED' });
  } finally { rmSync(fixture, { recursive: true, force: true }); }
});

// Bounded generated-policy regression: exact private production bodies, with
// filesystem effects restricted to this test's exclusive temporary directory.
// This is file/policy DATA, never an OS sandbox or worker admission substitute.
const workerSource=()=>ownedFs.readFileSync(new URL('../../src/execution/subscription-coding-worker-v1.ts',import.meta.url),'utf8');
function workerTree(){return ts.createSourceFile('worker.ts',workerSource(),ts.ScriptTarget.Latest,true);}
function privatePolicyFileRealm(root:string){
  const tree=workerTree(),names=['sameStat','canonicalDirectory','safeFileStat','pinFile','checkPin','createPrivateFile'];
  const declarations=tree.statements.filter((node):node is ts.FunctionDeclaration=>ts.isFunctionDeclaration(node)&&!!node.name&&names.includes(node.name.text));
  for(const name of names)assert.equal(declarations.filter(node=>node.name?.text===name).length,1,'exact worker function required: '+name);
  const calls:ts.CallExpression[]=[];
  const visit=(node:ts.Node)=>{if(ts.isCallExpression(node)&&node.expression.getText(tree)==='createPrivateFile'&&node.arguments[0]?.getText(tree)==='profilePath')calls.push(node);ts.forEachChild(node,visit);};
  visit(tree);assert.equal(calls.length,1,'actual worker generated profile materialization must remain unique');
  const body=declarations.map(node=>node.getText(tree)).join('\n');
  const profileBudget=(api as unknown as Record<string,unknown>).SUBSCRIPTION_CODING_SANDBOX_POLICY_MAX_BYTES_V1??1048576;
  const ports={constants:ownedFs.constants,closeSync:ownedFs.closeSync,fstatSync:ownedFs.fstatSync,
    fsyncSync:ownedFs.fsyncSync,lstatSync:ownedFs.lstatSync,openSync:ownedFs.openSync,readSync:ownedFs.readSync,
    realpathSync:ownedFs.realpathSync,writeSync:ownedFs.writeSync,
    dirname,createHash,Buffer,process:{getuid:()=>process.getuid!()},uid:()=>BigInt(process.getuid!()),
    refuse:api!.subscriptionCodingWorkerRefusedV1,subscriptionCodingCanonicalPathV1:api!.subscriptionCodingCanonicalPathV1,
    SUBSCRIPTION_CODING_SANDBOX_POLICY_MAX_BYTES_V1:profileBudget};
  const execute=(expression:string,locals:Record<string,unknown>)=>{
    const all={...ports,...locals},js=ts.transpileModule(body+'\nfunction exercise(){return '+expression+';}',{
      compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText;
    return new Function(...Object.keys(all),js+';return exercise();')(...Object.values(all));
  };
  return{profile:(policy:string)=>execute(calls[0]!.getText(tree),{profilePath:join(root,'profile.sb'),policy}),
    create:(name:string,contents:string)=>execute('createPrivateFile(file, contents)',{file:join(root,name),contents}),
    readback:(pin:unknown)=>execute('pinFile(pin.path,true,SUBSCRIPTION_CODING_SANDBOX_POLICY_MAX_BYTES_V1)',{pin}),
    recheck:(pin:unknown)=>execute('checkPin(pin)',{pin})};
}
function deepPolicyPaths(){
  const installation='/Users/owner/ai/setrox/data/installations/00000000-0000-4000-8000-000000000001';
  const container=installation+'/runtime/attempt-workspaces/subscription/RTS_00000000-0000-4000-8000-000000000041';
  const privateRoot=container+'/worker',worktree=installation+'/runtime/agent-scratch';
  const libraries=Array.from({length:67},(_,index)=>index%2
    ?`/opt/homebrew/opt/dependency-${index}/lib/libdependency-${index}.1.dylib`
    :`/opt/homebrew/Cellar/dependency-${index}/1.2.3/lib/libdependency-${index}.1.2.dylib`);
  return{...paths(),privateRoot,worktree,authorityRoots:[installation+'/credentials/coding-subscriptions',installation+'/runtime/services',container+'/owner'],
    gitControlPaths:[worktree+'/.git',installation+'/runtime/git/common',installation+'/runtime/git/common/worktrees/story'],
    preloadPath:privateRoot+'/fixed-gate.mjs',profilePath:privateRoot+'/profile.sb',transcriptPath:container+'/worker-output.log',
    nodeLibraryPaths:{readPaths:libraries,mapPaths:libraries},writeGrants:[],
    readOnlyControlPaths:Array.from({length:16},(_,i)=>worktree+'/.setfarm/stage-executions/claim-41/subscription-handoff/canonical-'+i+'.part')};
}
test('realistic deep generated SBPL above generic file cap is pinned and read back without losing bytes or exclusions',()=>{
  assert.ok(api);const input=deepPolicyPaths(),policy=api.buildSubscriptionCodingSandboxPolicyV1(input),bytes=Buffer.byteLength(policy);
  assert.ok(bytes>262144,'fixture must reproduce the real policy/generic-file capacity mismatch');assert.ok(bytes<=1048576);
  const root=realpathSync(mkdtempSync(join(tmpdir(),'sf-generated-policy-budget-')));chmodSync(root,0o700);
  try{
    const files=privatePolicyFileRealm(root),pin=files.profile(policy);
    assert.equal((api as unknown as Record<string,unknown>).SUBSCRIPTION_CODING_SANDBOX_POLICY_MAX_BYTES_V1,1048576);
    assert.equal(Number(pin.stat.size),bytes);assert.equal(pin.hash,api.subscriptionCodingHashV1(policy));
    assert.equal(ownedFs.readFileSync(pin.path,'utf8'),policy);assert.equal(lstatSync(pin.path).mode&0o7777,0o600);
    const replay=files.readback(pin);assert.equal(replay.hash,pin.hash);assert.equal(Number(replay.stat.size),bytes);files.recheck(pin);
    assert.match(policy,/^\(deny process-fork\)$/m);assert.match(policy,/^\(deny network-inbound\)$/m);
    for(const library of input.nodeLibraryPaths.readPaths)assert.ok(policy.includes('(literal '+JSON.stringify(library)+')'));
    for(const control of input.readOnlyControlPaths)assert.ok(policy.includes('(require-not (subpath '+JSON.stringify(control)+'))'));
  }finally{rmSync(root,{recursive:true,force:true});}
});
test('generic config and preload file materialization retains its exact 256KiB limit',()=>{
  assert.ok(api);const root=realpathSync(mkdtempSync(join(tmpdir(),'sf-private-material-budget-')));chmodSync(root,0o700);
  try{
    const files=privatePolicyFileRealm(root);
    for(const [index,name] of ['config.json','fixed-gate.mjs'].entries()){
      const pin=files.create(name,'x'.repeat(262144));assert.equal(Number(pin.stat.size),262144);
      assert.throws(()=>files.create('oversize-'+index,'x'.repeat(262145)),{message:'SUBSCRIPTION_CODING_WORKER_REFUSED'});
    }
  }finally{rmSync(root,{recursive:true,force:true});}
});
test('generated policy above fixed 1MiB capacity refuses at the actual pure pre-materialization build point',()=>{
  assert.ok(api);const input=deepPolicyPaths();
  const oversized={...input,readOnlyControlPaths:Array.from({length:128},(_,i)=>input.worktree+'/.setfarm/controls/'+('x'.repeat(700))+'-'+i+'.json')};
  assert.ok(oversized.readOnlyControlPaths.length<=256);
  assert.equal(oversized.nodeLibraryPaths.readPaths.length,67);assert.ok(oversized.nodeLibraryPaths.mapPaths.length<=256);
  for(const path of [...oversized.readOnlyControlPaths,...oversized.nodeLibraryPaths.readPaths,...oversized.nodeLibraryPaths.mapPaths,
    oversized.privateRoot,oversized.worktree,...oversized.authorityRoots,...oversized.gitControlPaths,oversized.profilePath,
    oversized.preloadPath,oversized.transcriptPath,oversized.nodePath,oversized.openclawRoot]){
    assert.ok(path.length<=1024,'oversize DATA must remain inside the existing path bound');
    assert.equal(api.subscriptionCodingCanonicalPathV1(path),true,'over-policy-cap case must not fail an earlier lexical guard');
  }
  const tree=workerTree(),launch=tree.statements.find((node):node is ts.FunctionDeclaration=>ts.isFunctionDeclaration(node)&&node.name?.text==='launchSubscriptionCodingWorkerV1');
  assert.ok(launch?.body);let statements:readonly ts.Statement[]|undefined;
  const visit=(node:ts.Node)=>{if(ts.isBlock(node)&&node.statements.some(item=>ts.isExpressionStatement(item)&&item.expression.getText(tree)==='buildSubscriptionCodingSandboxPolicyV1(lexical)'))statements=node.statements;ts.forEachChild(node,visit);};
  visit(launch);assert.ok(statements);
  const offset=statements.findIndex(node=>ts.isExpressionStatement(node)&&node.expression.getText(tree)==='buildSubscriptionCodingSandboxPolicyV1(lexical)');
  assert.ok(offset>=0);const code=statements.slice(offset,offset+2).map(node=>node.getText(tree)).join('\n'),effects:string[]=[];
  const run=new Function('buildSubscriptionCodingSandboxPolicyV1','lexical','publicRuntimeDirectory','sdkRoot',code);
  assert.throws(()=>run(api!.buildSubscriptionCodingSandboxPolicyV1,oversized,()=>{effects.push('filesystem');throw Error('FILE_EFFECT_REACHED');},paths().openclawRoot),
    {message:'SUBSCRIPTION_CODING_WORKER_REFUSED'});
  assert.deepEqual(effects,[],'oversized generated policy must refuse before filesystem materialization');
});

function openedStartupCallback(){
  assert.ok(api);const protocol=api.createSubscriptionCodingProbeProtocolV1(binding()),tree=workerTree(),callbacks:ts.ArrowFunction[]=[];
  const visit=(node:ts.Node)=>{
    if(ts.isCallExpression(node)&&ts.isPropertyAccessExpression(node.expression)&&node.expression.expression.getText(tree)==='proof'
      &&node.expression.name.text==='on'&&ts.isStringLiteral(node.arguments[0]!)&&node.arguments[0]!.text==='data'
      &&node.arguments[1]&&ts.isArrowFunction(node.arguments[1])&&node.arguments[1].getText(tree).includes('protocol.accept(chunk)'))callbacks.push(node.arguments[1]);
    ts.forEachChild(node,visit);
  };
  visit(tree);assert.equal(callbacks.length,1,'actual private proof data callback must remain unique');
  let clock=0,faults=0,ready=0;const recorded:string[]=[],cleared:number[]=[],timers=new Map<number,{due:number;call:()=>void}>();
  const timer=73;timers.set(timer,{due:10000,call:()=>{faults++;}});
  const ports={protocol,stopping:false,settled:false,performance:{now:()=>clock},lifetimeDeadline:1800000,admissionDeadline:120000,
    setTimeout:()=>74,startupResolve:()=>{ready++;},record:(event:string)=>recorded.push(event),fault:()=>{faults++;},
    clearTimeout:(id:number)=>{cleared.push(id);timers.delete(id);}};
  const code='function fixture(){let proofReady=false;let startupDeadline=10000;let waitResolve,waitReject;let startupTimer='+timer+';const accept='+callbacks[0]!.getText(tree)
    +';return {accept,get proofReady(){return proofReady;},get startupTimer(){return startupTimer;}};}';
  const js=ts.transpileModule(code,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText;
  const observed=new Function(...Object.keys(ports),js+';return fixture();')(...Object.values(ports));
  return{protocol,observed,cleared,recorded,faults:()=>faults,ready:()=>ready,
    advance:(ms:number)=>{clock+=ms;for(const [id,pending]of timers)if(pending.due<=clock){timers.delete(id);pending.call();}}};
}
test('authenticated OPENED acknowledgement disarms the actual startup callback timer and permits quiet work past startup',()=>{
  const f=openedStartupCallback();f.observed.accept(line(proofFrame()));assert.equal(f.ready(),1);assert.equal(f.observed.proofReady,true);
  assert.deepEqual(f.cleared,[],'proof READY cannot authorize an unlimited pending parent gate');
  f.protocol.openGate();assert.deepEqual(f.cleared,[],'gate write is not an authenticated OPENED acknowledgement');
  f.observed.accept(line(openedFrame()));assert.equal(f.protocol.state,'open');assert.deepEqual(f.cleared,[73]);assert.equal(f.observed.startupTimer,undefined);
  f.advance(20000);assert.equal(f.faults(),0,'quiet SDK work must outlive the completed startup window');assert.deepEqual(f.recorded,[]);
});
test('READY and gate-sent without OPENED keep the existing startup timeout armed',()=>{
  for(const phase of ['ready','gate-sent']){
    const f=openedStartupCallback();f.observed.accept(line(proofFrame()));if(phase==='gate-sent')f.protocol.openGate();
    assert.equal(f.protocol.state,phase);assert.deepEqual(f.cleared,[]);assert.equal(f.observed.startupTimer,73);
    f.advance(9999);assert.equal(f.faults(),0);f.advance(1);assert.equal(f.faults(),1);
  }
});
test('foreign or duplicate OPENED still faults through the exact private callback',()=>{
  const foreign=openedStartupCallback();foreign.observed.accept(line(proofFrame()));foreign.protocol.openGate();
  foreign.observed.accept(line({...openedFrame(),nonce:'f'.repeat(64)}));assert.equal(foreign.protocol.state,'failed');
  assert.equal(foreign.faults(),1);assert.deepEqual(foreign.recorded,['child-error']);assert.deepEqual(foreign.cleared,[]);
  const duplicate=openedStartupCallback();duplicate.observed.accept(line(proofFrame()));duplicate.protocol.openGate();duplicate.observed.accept(line(openedFrame()));
  duplicate.observed.accept(line(openedFrame()));assert.equal(duplicate.protocol.state,'failed');assert.equal(duplicate.faults(),1);
  assert.deepEqual(duplicate.recorded,['child-error']);assert.deepEqual(duplicate.cleared,[73],'duplicate frame cannot re-clear or revive the startup timer');
});


test('writable material binds only the fixed private plugin while readonly seed stays three files', () => {
  assert.ok(api);
  const seed = material(), grants = [{ path: seed.cwd + '/allowed.ts', kind: 'file' as const }];
  const readOnly = api.narrowSubscriptionCodingWorkerMaterialV1({ material: seed, writeGrants: [], readOnlyControlPaths: [] });
  assert.equal(readOnly.material.files.length, 3);
  assert.deepEqual(JSON.parse(readOnly.material.files[0].contents).plugins, { enabled: false });
  const writable = api.narrowSubscriptionCodingWorkerMaterialV1({ material: seed, writeGrants: grants, readOnlyControlPaths: [] });
  const root = '/private/tmp/owned worker', config = JSON.parse(writable.material.files[0].contents);
  assert.equal(writable.material.files.length, 5);
  assert.deepEqual(config.plugins, { enabled: true, allow: ['setfarm-scoped-files-v1'],
    load: { paths: [root + '/scoped-files'] }, slots: { memory: 'none', contextEngine: 'none' }, bundledDiscovery: 'allowlist', entries: { 'setfarm-scoped-files-v1': { enabled: true } } });
  assert.deepEqual(config.tools.allow, ['read', 'setfarm_write', 'setfarm_edit']);
  assert.equal(config.tools.fs.workspaceOnly, true);
  const manifest = JSON.parse(writable.material.files[3].contents);
  assert.deepEqual(manifest.contracts.tools, ['setfarm_write', 'setfarm_edit']);
  assert.deepEqual(writable.material.files.slice(3).map(file => [file.path, file.mode]), [
    [root + '/scoped-files/openclaw.plugin.json', 0o600], [root + '/scoped-files/index.mjs', 0o600],
  ]);
  const input = { binding: binding(), profilePath: paths().profilePath, preloadPath: paths().preloadPath,
    credentialProbePath: paths().authorityRoots[0], brokerPort: 49157, nodePath: paths().nodePath,
    argvHash: '5'.repeat(64), environmentHash: '6'.repeat(64),
    files: writable.material.files.map(file => ({ path: file.path, hash: createHash('sha256').update(file.contents).digest('hex') })) };
  assert.equal(api.buildSubscriptionCodingProbeChallengeV1(input).files.length, 5);
  for (const files of [input.files.slice(0, 4), [...input.files, input.files[4]],
    input.files.map((file, index) => index === 4 ? { ...file, path: root + '/scoped-files/other.mjs' } : file),
    [input.files[0], input.files[1], input.files[2], input.files[4], input.files[3]]]) {
    assert.throws(() => api!.buildSubscriptionCodingProbeChallengeV1({ ...input, files }), /SUBSCRIPTION_CODING_WORKER_REFUSED/);
  }
  assert.throws(() => api!.validateSubscriptionCodingWorkerMaterialV1(writable.material), /SUBSCRIPTION_CODING_WORKER_REFUSED/,
    'effective plugin material cannot become caller-authored seed authority');
  const crossed = api.narrowSubscriptionCodingWorkerMaterialV1({ material: seed,
    writeGrants: [{ path: seed.cwd + '/other.ts', kind: 'file' }], readOnlyControlPaths: [] });
  assert.notEqual(crossed.materialHash, writable.materialHash);
  assert.notEqual(crossed.material.files[4].contents, writable.material.files[4].contents);
});

type ScopedOperations = {
  access(path: string): Promise<void>; readFile(path: string): Promise<Buffer>;
  mkdir(path: string): Promise<void>; writeFile(path: string, contents: string): Promise<void>; dispose(): void;
};
const scopedOperations = new Function('return (' + SUBSCRIPTION_SCOPED_FILE_OPERATIONS_V1 + ')')() as
  (fs: typeof ownedFs, path: typeof ownedPath, scope: { root: string; grants: { path: string; kind: 'file' | 'directory' }[];
    controls: string[]; maxBytes: number }, signal: AbortSignal | undefined, editing: boolean, rootIdentity: ownedFs.BigIntStats) => ScopedOperations;

test('pinned Node operations write exact existing/new files and retain invocation-specific edit preimages', async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'setfarm-scoped-files-')));
  const file = root + '/existing.txt', fresh = root + '/new.txt', control = root + '/protected.txt';
  const scope = { root, grants: [file, fresh, control].map(path => ({ path, kind: 'file' as const })),
    controls: [control], maxBytes: 2097152 };
  writeFileSync(file, 'before\n', { mode: 0o600 }); writeFileSync(control, 'protected', { mode: 0o600 });
  try {
    const write = scopedOperations(ownedFs, ownedPath, scope, undefined, false, ownedFs.lstatSync(root, { bigint: true }));
    await write.mkdir(root); await write.writeFile(file, 'written\n'); await write.writeFile(fresh, 'new\n');
    assert.equal(ownedFs.readFileSync(file, 'utf8'), 'written\n');
    assert.equal(ownedFs.readFileSync(fresh, 'utf8'), 'new\n');
    const edit = scopedOperations(ownedFs, ownedPath, scope, undefined, true, ownedFs.lstatSync(root, { bigint: true }));
    assert.equal((await edit.readFile(file)).toString(), 'written\n');
    await edit.writeFile(file, 'edited\n'); edit.dispose();
    assert.equal(ownedFs.readFileSync(file, 'utf8'), 'edited\n');
    const stale = scopedOperations(ownedFs, ownedPath, scope, undefined, true, ownedFs.lstatSync(root, { bigint: true }));
    await stale.readFile(file); writeFileSync(file, 'concurrent\n');
    await assert.rejects(stale.writeFile(file, 'clobbered\n'), /SETFARM_SCOPED_FILE_REFUSED/); stale.dispose();
    assert.equal(ownedFs.readFileSync(file, 'utf8'), 'concurrent\n');
    const unrelated = scopedOperations(ownedFs, ownedPath, scope, undefined, true, ownedFs.lstatSync(root, { bigint: true }));
    await assert.rejects(unrelated.writeFile(file, 'no-read'), /SETFARM_SCOPED_FILE_REFUSED/);
    await assert.rejects(write.writeFile(control, 'changed'), /SETFARM_SCOPED_FILE_REFUSED/);
    await assert.rejects(write.writeFile(root + '/ungranted.txt', 'changed'), /SETFARM_SCOPED_FILE_REFUSED/);
    const stopped = new AbortController(); stopped.abort();
    const canceled = scopedOperations(ownedFs, ownedPath, scope, stopped.signal, false, ownedFs.lstatSync(root, { bigint: true }));
    await assert.rejects(canceled.writeFile(file, 'canceled'), /Operation aborted/);
    assert.equal(ownedFs.readFileSync(file, 'utf8'), 'concurrent\n');
    const abortBetween = new AbortController();
    const readThenAbort = scopedOperations(ownedFs, ownedPath, scope, abortBetween.signal, true, ownedFs.lstatSync(root, { bigint: true }));
    await readThenAbort.readFile(file); abortBetween.abort();
    await assert.rejects(readThenAbort.writeFile(file, 'late write'), /Operation aborted/); readThenAbort.dispose();
    assert.equal(ownedFs.readFileSync(file, 'utf8'), 'concurrent\n');
    assert.equal(ownedFs.readFileSync(control, 'utf8'), 'protected');
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('pinned Node operations refuse aliases, hardlinks, nonregulars and unsafe modes without adoption', async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'setfarm-scoped-refusals-')));
  const target = root + '/target', alias = root + '/alias', hard = root + '/hard', directory = root + '/directory';
  writeFileSync(target, 'retained', { mode: 0o600 }); symlinkSync(target, alias); linkSync(target, hard); mkdirSync(directory, { mode: 0o700 });
  const scope = { root, grants: [target, alias, hard, directory].map(path => ({ path, kind: 'file' as const })), controls: [], maxBytes: 2097152 };
  try {
    const operations = scopedOperations(ownedFs, ownedPath, scope, undefined, false, ownedFs.lstatSync(root, { bigint: true }));
    for (const path of [target, alias, hard, directory]) await assert.rejects(operations.writeFile(path, 'bad'));
    assert.equal(ownedFs.readFileSync(target, 'utf8'), 'retained');
    ownedFs.unlinkSync(hard); chmodSync(target, 0o666);
    await assert.rejects(operations.writeFile(target, 'bad'), /SETFARM_SCOPED_FILE_REFUSED/);
    assert.equal(ownedFs.readFileSync(target, 'utf8'), 'retained');
    assert.equal(lstatSync(alias).isSymbolicLink(), true);
    await assert.rejects(operations.mkdir(root + '/ungranted-parent'));
    assert.equal(ownedFs.existsSync(root + '/ungranted-parent'), false);
  } finally { rmSync(root, { recursive: true, force: true }); }
});


test('pinned Node operations reject a real FIFO using nonblocking descriptor opens', async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'setfarm-scoped-fifo-'))), fifo = root + '/fifo';
  const scope = { root, grants: [{ path: fifo, kind: 'file' as const }], controls: [], maxBytes: 2097152 };
  try {
    execFileSync('/usr/bin/mkfifo', ['-m', '600', fifo], { timeout: 2000, stdio: 'pipe' });
    assert.equal(lstatSync(fifo).isFIFO(), true);
    let opened = 0, closed = 0;
    const fs = new Proxy(ownedFs, { get(target, key) {
      if (key === 'openSync') return (value: ownedFs.PathLike, flags: string | number, mode?: ownedFs.Mode) => {
        if (typeof flags !== 'number' || !(flags & ownedFs.constants.O_NONBLOCK)) throw new Error('TEST_NONBLOCK_MISSING');
        assert.ok(flags & ownedFs.constants.O_NOFOLLOW); opened++;
        return ownedFs.openSync(value, flags, mode);
      };
      if (key === 'closeSync') return (fd: number) => { closed++; ownedFs.closeSync(fd); };
      return Reflect.get(target, key);
    } });
    const operations = scopedOperations(fs, ownedPath, scope, undefined, true, ownedFs.lstatSync(root, { bigint: true }));
    await assert.rejects(operations.access(fifo), /^Error: SETFARM_SCOPED_FILE_REFUSED$/);
    await assert.rejects(operations.readFile(fifo), /^Error: SETFARM_SCOPED_FILE_REFUSED$/);
    assert.equal(opened, 2); assert.equal(closed, 2);
    const writer = scopedOperations(fs, ownedPath, scope, undefined, false, ownedFs.lstatSync(root, { bigint: true }));
    await assert.rejects(writer.writeFile(fifo, 'bad'), /^Error: SETFARM_SCOPED_FILE_REFUSED$/);
    assert.equal(opened, 2, 'FIFO write refuses its nonregular preimage before opening');
    assert.equal(lstatSync(fifo).isFIFO(), true);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('pinned Node operations enforce byte limits and precreation abort without touching absent targets', async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'setfarm-scoped-limits-')));
  const exact = root + '/exact', oversized = root + '/oversized', canceled = root + '/canceled';
  const scope = { root, grants: [exact, oversized, canceled].map(path => ({ path, kind: 'file' as const })),
    controls: [], maxBytes: 2097152 };
  try {
    const operations = scopedOperations(ownedFs, ownedPath, scope, undefined, false, ownedFs.lstatSync(root, { bigint: true }));
    const content = 'x'.repeat(scope.maxBytes);
    await operations.writeFile(exact, content);
    assert.equal(ownedFs.readFileSync(exact, 'utf8'), content);
    let opens = 0;
    const fs = new Proxy(ownedFs, { get(target, key) {
      if (key === 'openSync') return (..._args: unknown[]) => { opens++; throw new Error('TEST_UNEXPECTED_OPEN'); };
      return Reflect.get(target, key);
    } });
    const guarded = scopedOperations(fs, ownedPath, scope, undefined, false, ownedFs.lstatSync(root, { bigint: true }));
    await assert.rejects(guarded.writeFile(oversized, content + 'x'), /^Error: SETFARM_SCOPED_FILE_REFUSED$/);
    const controller = new AbortController(); controller.abort();
    const aborted = scopedOperations(fs, ownedPath, scope, controller.signal, false, ownedFs.lstatSync(root, { bigint: true }));
    await assert.rejects(aborted.writeFile(canceled, 'no-create'), /^Error: Operation aborted$/);
    assert.equal(opens, 0);
    assert.equal(ownedFs.existsSync(oversized), false); assert.equal(ownedFs.existsSync(canceled), false);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('pinned Node operations never adopt an EXCL race and refuse write or close failures', async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'setfarm-scoped-errors-')));
  const raced = root + '/raced', file = root + '/existing';
  const scope = { root, grants: [raced, file].map(path => ({ path, kind: 'file' as const })), controls: [], maxBytes: 2097152 };
  try {
    let raceOpens = 0;
    const raceFs = new Proxy(ownedFs, { get(target, key) {
      if (key === 'openSync') return (value: ownedFs.PathLike, flags: string | number, mode?: ownedFs.Mode) => {
        assert.equal(value, raced); assert.equal(typeof flags, 'number');
        assert.ok(Number(flags) & ownedFs.constants.O_EXCL); assert.ok(Number(flags) & ownedFs.constants.O_CREAT);
        raceOpens++; writeFileSync(raced, 'other-creator', { flag: 'wx', mode: 0o600 });
        return ownedFs.openSync(value, flags, mode);
      };
      return Reflect.get(target, key);
    } });
    const racedWrite = scopedOperations(raceFs, ownedPath, scope, undefined, false, ownedFs.lstatSync(root, { bigint: true }));
    await assert.rejects(racedWrite.writeFile(raced, 'must-not-adopt'), { code: 'EEXIST' });
    assert.equal(raceOpens, 1); assert.equal(ownedFs.readFileSync(raced, 'utf8'), 'other-creator');
    for (const fault of ['write-error', 'zero-progress', 'close-error'] as const) {
      writeFileSync(file, 'before', { mode: 0o600 });
      let opens = 0, closes = 0, openedFd: number | undefined;
      const fs = new Proxy(ownedFs, { get(target, key) {
        if (key === 'openSync') return (value: ownedFs.PathLike, flags: string | number, mode?: ownedFs.Mode) => {
          opens++; openedFd = ownedFs.openSync(value, flags, mode); return openedFd;
        };
        if (key === 'writeSync' && fault !== 'close-error') return (..._args: unknown[]) => {
          if (fault === 'zero-progress') return 0;
          throw Object.assign(new Error('TEST_WRITE_ERROR'), { code: 'EIO' });
        };
        if (key === 'closeSync') return (fd: number) => {
          closes++; ownedFs.closeSync(fd);
          if (fault === 'close-error') throw Object.assign(new Error('TEST_CLOSE_ERROR'), { code: 'EIO' });
        };
        return Reflect.get(target, key);
      } });
      const operations = scopedOperations(fs, ownedPath, scope, undefined, false, ownedFs.lstatSync(root, { bigint: true }));
      const expected = fault === 'write-error' ? /^Error: TEST_WRITE_ERROR$/
        : fault === 'zero-progress' ? /^Error: SETFARM_SCOPED_FILE_REFUSED$/ : /^Error: TEST_CLOSE_ERROR$/;
      await assert.rejects(operations.writeFile(file, 'after'), expected);
      assert.equal(opens, 1); assert.equal(closes, 1); assert.notEqual(openedFd, undefined);
      assert.throws(() => ownedFs.fstatSync(openedFd!), { code: 'EBADF' });
      assert.equal(ownedFs.readFileSync(file, 'utf8'), fault === 'close-error' ? 'after' : 'before',
        'close-error may leave candidate bytes but must never produce a success result');
    }
  } finally { rmSync(root, { recursive: true, force: true }); }
});

// Exercise the actual launcher after filesystem preparation and the complete
// fixed preload. Only OS, filesystem, clocks and transport effects are inert.
// A blanket startup clock increase or early SDK admission breaks these tests.
function actualWorkerClockRealm(seed = material()) {
  assert.ok(api);
  const tree = workerTree();
  let statements: readonly ts.Statement[] | undefined;
  const visit = (node: ts.Node) => {
    if (ts.isBlock(node) && node.statements.some(item => ts.isVariableStatement(item)
      && item.declarationList.declarations.some(d => d.name.getText(tree) === 'startup'))) statements = node.statements;
    ts.forEachChild(node, visit);
  };
  visit(tree); assert.ok(statements);
  const start = statements.findIndex(node => ts.isVariableStatement(node)
    && node.declarationList.declarations.some(d => d.name.getText(tree) === 'child'));
  const end = statements.findIndex(node => ts.isReturnStatement(node) && node.expression?.getText(tree) === 'owned');
  assert.ok(start >= 0 && end > start);
  const constants = tree.statements.filter(node => ts.isVariableStatement(node)
    && node.declarationList.declarations.some(d => ['STARTUP_MS', 'OWNER_ADMISSION_MS', 'DRAIN_MS', 'OUTPUT_LIMIT', 'SANDBOX'].includes(d.name.getText(tree))))
    .map(node => node.getText(tree)).join('\n');
  const body = constants + '\n' + statements.slice(start, end + 1).map(node => node.getText(tree)).join('\n');
  let now = 0, serial = 0, sdk = false, dead = false, stale = false, materialStale = false;
  const timers = new Map<number, { due: number; call: () => void }>();
  const external = (call: () => void) => { try { call(); } catch (error) { if (!(error instanceof Error) || !/^INERT_EXIT_/.test(error.message)) throw error; } };
  const setTimer = (call: () => void, ms: number) => { const id = ++serial; timers.set(id, { due: now + ms, call: () => external(call) }); return id; };
  const clearTimer = (id: number) => { timers.delete(id); };
  const streams = [new EventEmitter(), new EventEmitter()];
  const proof = Object.assign(new EventEmitter(), { destroy() {} });
  const channel = Object.assign(new EventEmitter(), { unref() {} });
  const connections: string[] = [];
  const signals: string[] = [], exits: number[] = [], outbound: Record<string, unknown>[] = [];
  let suppressAck = false, suppressOpened = false, holdProof = false, openedWriteDelay = 0;
  const held: Buffer[] = [], parentFrames: Record<string, unknown>[] = [];
  const child = Object.assign(new EventEmitter(), { pid: identity.pid, stdout: streams[0], stderr: streams[1], stdio: [] as unknown[] });
  function death(code: number) {
    if (dead) return; dead = true; exits.push(code);
    child.emit('exit', code, null); child.emit('close');
    for (const stream of streams) { stream.emit('end'); stream.emit('close'); }
    proof.emit('end');
  }
  const gate = Object.assign(new EventEmitter(), {
    write(bytes: string, callback: (error?: Error) => void) {
      parentFrames.push(JSON.parse(bytes));
      queueMicrotask(() => external(() => { if (!dead) channel.emit('data', Buffer.from(bytes)); callback(); })); return true;
    },
    destroy() { queueMicrotask(() => external(() => { channel.emit('end'); })); },
  });
  child.stdio = [null, ...streams, gate, proof];
  const checked = api.narrowSubscriptionCodingWorkerMaterialV1({ material: seed, writeGrants: [], readOnlyControlPaths: [] });
  const p = paths(), preloadPath = p.preloadPath, profilePath = p.profilePath, entryPath = p.openclawRoot + '/openclaw.mjs';
  const preload = ownedFs.readFileSync(new URL('../../src/execution/subscription-coding-worker-preload-v1.ts', import.meta.url), 'utf8');
  const preloadTree = ts.createSourceFile('preload.ts', preload, ts.ScriptTarget.Latest, true);
  const declaration = (preloadTree.statements.find(ts.isVariableStatement)!).declarationList.declarations[0]!;
  assert.ok(declaration.initializer && ts.isTaggedTemplateExpression(declaration.initializer));
  const program = (declaration.initializer.template as ts.NoSubstitutionTemplateLiteral).rawText!;
  const hash = api.subscriptionCodingHashV1, policy = 'inert pinned policy';
  const files = new Map<string, string>([[preloadPath, program], [profilePath, policy], ...checked.material.files.map(f => [f.path, f.contents] as [string, string])]);
  const processPort = { pid: identity.pid, execPath: p.nodePath, argv: [p.nodePath, entryPath, ...checked.material.argv], env: checked.material.env,
    exit(code: number): never { death(code); throw Error('INERT_EXIT_' + code); } };
  const denied = () => Object.assign(Error('inert denial'), { code: 'EPERM' });
  const childPorts = { Buffer, performance: { now: () => now }, setTimeout: setTimer, clearTimeout: clearTimer,
    process: processPort, crypto: { createHash }, fileURLToPath: () => preloadPath,
    fs: { constants: ownedFs.constants, readFileSync: (path: string) => { assert.ok(files.has(path)); return files.get(path); },
      openSync: () => { throw denied(); }, closeSync: () => {},
      writeSync(_fd: number, bytes: Buffer, offset: number, length: number) {
        const chunk = bytes.subarray(offset, offset + length), frame = JSON.parse(chunk.toString()); outbound.push(frame);
        if (frame.type === 'opened') now += openedWriteDelay;
        if (holdProof && frame.type === 'proof') held.push(chunk);
        else if (!(suppressAck && frame.type === 'owner-admission-waiting') && !(suppressOpened && frame.type === 'opened')) proof.emit('data', chunk);
        return length;
      } },
    net: { Socket: function() { return channel; }, createConnection(options: { host: string; port: number }) {
      connections.push(options.host + ':' + options.port);
      const socket = Object.assign(new EventEmitter(), { destroy() {} });
      queueMicrotask(() => options.port === 49157 ? socket.emit('connect') : socket.emit('error', denied())); return socket;
    } },
    spawn: () => { const process = new EventEmitter(); queueMicrotask(() => process.emit('error', denied())); return process; },
  };
  const childCode = program.replace(/^import .*;\n/gm, '').replaceAll('import.meta.url', '"inert-preload-url"');
  const runChild = new Function(...Object.keys(childPorts), 'return (async()=>{' + childCode + '\n})()');
  let actualProtocol: import('../../src/execution/subscription-coding-worker-policy-v1.js').SubscriptionCodingProbeProtocolV1 | undefined;
  const parentPorts = { ...api, createSubscriptionCodingProbeProtocolV1: (b: Parameters<typeof api.createSubscriptionCodingProbeProtocolV1>[0]) => {
    actualProtocol = api!.createSubscriptionCodingProbeProtocolV1(b); return actualProtocol;
  }, Buffer, performance: { now: () => now }, setTimeout: setTimer, clearTimeout: clearTimer,
    material: checked.material, checked, capability: 'A'.repeat(43), materialHash: checked.materialHash,
    policyHash: hash(policy), preloadHash: hash(program), profilePath, preloadPath, nodePath: p.nodePath, entryPath,
    brokerPort: 49157, authorityRoots: p.authorityRoots, fd: 7,
    transcriptCloser: { close: () => 'closed' }, closePublicAncestors: () => true,
    nodeLibraries: { closureHash: 'a'.repeat(64), close: () => 'closed' },
    publicPins: [], controlPins: [], publicAncestors: [],
    stableCheck: () => { if (materialStale) api!.subscriptionCodingWorkerRefusedV1(); },
    inspectSubscriptionCodingWorktreeV1() {}, randomBytes: () => Buffer.from('1'.repeat(64), 'hex'),
    observeProcessIdentity: () => stale ? { ...identity, processStartedAt: '2026-11-05T00:00:00.000Z' } : identity,
    process: { kill: (_pid: number, signal: string) => { signals.push(signal); death(97); } },
    spawn: () => { void (runChild(...Object.values(childPorts)) as Promise<void>).then(() => { if (!dead) sdk = true; }).catch(() => {}); return child; },
    createSubscriptionCredentialRedactorV1: () => ({ discard() {}, push: (b: Buffer) => b, finish: () => Buffer.alloc(0) }),
    refuse: api.subscriptionCodingWorkerRefusedV1,
  };
  const code = ts.transpileModule('async function run(){let partial,owned; ' + body + '}', {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText;
  const acquire = () => new Function(...Object.keys(parentPorts), code + ';return run();')(...Object.values(parentPorts)) as Promise<import('../../src/execution/subscription-coding-worker-v1.js').SubscriptionCodingOwnedWorkerV1>;
  async function flushClock() { for (let n = 0; n < 100; n++) await Promise.resolve(); }
  return { acquire, checked, exits, signals, outbound, parentFrames, proof, channel, connections,
    delayOpenedWrite: (ms: number) => { openedWriteDelay = ms; },
    injectChild: (bytes: Buffer) => external(() => { channel.emit('data', bytes); }),
    injectEOF: () => external(() => { channel.emit('end'); }),
    holdProof: () => { holdProof = true; }, releaseProof: () => { held.splice(0).forEach(b => proof.emit('data', b)); },
    state: () => actualProtocol?.state,
    sdk: () => sdk, dead: () => dead, now: () => now, flush: flushClock,
    staleIdentity: () => { stale = true; }, staleMaterial: () => { materialStale = true; },
    suppressAck: () => { suppressAck = true; }, suppressOpened: () => { suppressOpened = true; },
    jump: (target: number) => { now = target; },
    async advance(target: number) {
      for (;;) {
        const due = [...timers].filter(([, t]) => t.due <= target).sort((a, b) => a[1].due - b[1].due)[0];
        if (!due) break; now = due[1].due; timers.delete(due[0]); due[1].call(); await flushClock();
      }
      now = target; await flushClock();
    },
    death: () => death(0),
  };
}

test('actual runtime bound worker survives owner publication at 16s before exact OPENED and SDK entry', async () => {
  const runtime = await import('../../src/execution/subscription-coding-runtime-v1.js');
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'sf-owner-clock-'))); chmodSync(root, 0o700);
  const worktree = join(root, 'worktree'); mkdirSync(worktree, { mode: 0o700 });
  const b = { kind: 'execution-attempt' as const, runtimeSessionId: 'RT_clock', claimId: 51,
    ownerInstanceId: 'host.local:43100:12345678-1234-4234-8234-123456789abc', modelRef: 'minimax/MiniMax-M3.1-Flash' as const,
    sourceSha: 'a'.repeat(40), worktree, attemptId: 'ATT_worker_1', generation: 7, fenceToken: 'fence_clock' };
  let f: ReturnType<typeof actualWorkerClockRealm> | undefined;
  let finishBroker!: () => void;
  const brokerClosed = new Promise<any>(resolve => { finishBroker = () => resolve({ status: 'closed', reason: 'completed', acceptedRequests: 0, responseBytes: 0, redactions: 0, terminalCode: null }); });
  let owner: Awaited<ReturnType<typeof runtime.acquireSubscriptionCodingRuntimeV1>> | undefined;
  try {
    const pending = runtime.acquireSubscriptionCodingRuntimeV1({ binding: b, root: join(root, 'worker'), runtimePath: join(root, 'journal'),
      prompt: 'Inert owner admission regression.', transcriptPath: join(root, 'output'), signal: new AbortController().signal,
      authorityRoots: [join(root, 'authority')], writeGrants: [], readOnlyControlPaths: [] }, {
      async deriveAuthority() { return { activationPreparedHash: 'b'.repeat(64), activationAcknowledgedHash: 'c'.repeat(64),
        sourceSha: b.sourceSha, policySourceHash: 'd'.repeat(64), preloadHash: api!.subscriptionCodingHashV1((await import('../../src/execution/subscription-coding-worker-preload-v1.js')).SUBSCRIPTION_CODING_WORKER_PRELOAD_V1), parentIdentity: identity }; },
      async acquireBroker({ identity: id }) { return { worker: { ...id, providerId: 'minimax', modelId: 'MiniMax-M3.1-Flash', baseUrl: 'http://127.0.0.1:49157/v1', api: 'anthropic-messages', apiKey: 'A'.repeat(43), auth: 'api-key', authHeader: true },
        closed: brokerClosed, stop: async () => { finishBroker(); return brokerClosed; } }; },
      async launchWorker({ material: seed }) { f = actualWorkerClockRealm(seed); return f.acquire(); },
    });
    owner = await pending;
    assert.ok(f); assert.equal(ownedFs.existsSync(join(root, 'journal/worker-bound.json')), true);
    assert.equal(f.outbound[0]?.type, 'proof'); assert.equal(f.sdk(), false);
    await f.advance(16000);
    assert.deepEqual(f.connections, ['192.0.2.1:443', '127.0.0.1:9', '127.0.0.1:49157'], 'only the unchanged TCP isolation probes run before publication');
    assert.equal(f.sdk(), false, 'SDK must remain blocked until owner publication');
    let refusal: unknown; try { owner.openGate(); } catch (error) { refusal = error; }
    assert.equal(refusal, undefined, 'valid 16s owner publication lost original worker to startup clock; exits=' + JSON.stringify(f.exits));
    await f.flush(); assert.equal(f.outbound.at(-1)?.type, 'opened'); assert.equal(f.state(), 'open'); assert.equal(f.sdk(), true); assert.deepEqual(f.signals, []);
  } finally {
    f?.death(); finishBroker(); if (owner) await owner.close('completed'); rmSync(root, { recursive: true, force: true });
  }
});

function waitAckFrame() { return { ...openedFrame(), type: 'owner-admission-waiting' }; }
test('one authenticated optional wait rejects early, foreign, malformed, duplicate, replay and partial transitions', () => {
  assert.ok(api);
  for (const bad of [waitAckFrame(), { ...waitAckFrame(), nonce: 'f'.repeat(64) },
    { ...waitAckFrame(), extra: true }, openedFrame(), proofFrame()]) {
    const p = api.createSubscriptionCodingProbeProtocolV1(binding());
    p.accept(line(proofFrame()));
    if (bad.type !== 'owner-admission-waiting') p.waitForOwnerAdmission();
    assert.throws(() => p.accept(line(bad)), /SUBSCRIPTION_CODING_WORKER_REFUSED/);
    assert.equal(p.state, 'failed');
  }
  for (const bad of [{ ...waitAckFrame(), nonce: 'f'.repeat(64) }, { ...waitAckFrame(), extra: true },
    { ...waitAckFrame(), identity: { ...binding().identity, generationId: 'foreign' } }]) {
    const p = api.createSubscriptionCodingProbeProtocolV1(binding()); p.accept(line(proofFrame())); p.waitForOwnerAdmission();
    assert.throws(() => p.accept(line(bad))); assert.equal(p.state, 'failed');
  }
  for (const outgoing of ['waitForOwnerAdmission', 'openGate'] as const) {
    const p = api.createSubscriptionCodingProbeProtocolV1(binding()); p.accept(Buffer.concat([line(proofFrame()), Buffer.from('{')]));
    assert.throws(() => p[outgoing](), /SUBSCRIPTION_CODING_WORKER_REFUSED/);
  }
  for (const duplicate of ['request', 'ack', 'replay', 'partial-open'] as const) {
    const p = api.createSubscriptionCodingProbeProtocolV1(binding()); p.accept(line(proofFrame()));
    assert.deepEqual(JSON.parse(p.waitForOwnerAdmission()), { schema: 'setfarm.subscription-coding-gate.v1', type: 'owner-admission-wait', ...binding() });
    if (duplicate === 'request') { assert.throws(() => p.waitForOwnerAdmission()); continue; }
    p.accept(line(waitAckFrame()));
    if (duplicate === 'ack') assert.throws(() => p.accept(line(waitAckFrame())));
    else if (duplicate === 'partial-open') { p.accept(Buffer.from('{')); assert.throws(() => p.openGate()); }
    else { p.openGate(); p.accept(line(openedFrame())); assert.throws(() => p.accept(line(waitAckFrame()))); }
    assert.equal(p.state, 'failed');
  }
});

test('wait ACK alone never certifies closure and all original events remain necessary', () => {
  assert.ok(api);
  for (const phase of ['admission-wait-sent', 'admission-waiting']) {
    const p = api.createSubscriptionCodingProbeProtocolV1(binding()), tracker = api.createSubscriptionCodingCustodyTrackerV1(identity, p);
    p.accept(line(proofFrame())); p.waitForOwnerAdmission(); if (phase === 'admission-waiting') p.accept(line(waitAckFrame()));
    assert.equal(tracker.status, 'pending'); assert.equal(tracker.canSignal(identity), true);
    for (const event of ['child-exit', 'child-close', 'stdout-end', 'stdout-close', 'stderr-end'] as const) tracker.observe(event);
    assert.equal(tracker.status, 'pending'); tracker.observe('stderr-close'); assert.equal(tracker.status, 'closed');
    assert.throws(() => p.end()); assert.equal(tracker.status, 'custody-uncertain', 'pre-OPEN proof EOF remains a fault');
  }
});

test('actual bodies retain READY and direct OPEN original short clocks', async () => {
  for (const phase of ['ready', 'direct-open', 'slow-proof']) {
    const f = actualWorkerClockRealm(); if (phase === 'slow-proof') f.holdProof();
    const acquiring = f.acquire(); void acquiring.catch(() => {}); await f.flush();
    if (phase === 'slow-proof') { await f.advance(9000); f.releaseProof(); await assert.rejects(acquiring); }
    else {
      const worker = await acquiring;
      if (phase === 'direct-open') { worker.openGate(); await f.flush(); assert.equal(f.sdk(), true); }
      await f.advance(8999); assert.equal(f.dead(), false);
      await f.advance(9000); assert.equal(f.dead(), phase === 'ready');
      if (phase === 'direct-open') { await f.advance(20000); assert.equal(f.dead(), false); }
      f.death(); await worker.originalClosed;
    }
    assert.equal(f.sdk(), phase === 'direct-open');
  }
});

test('actual wait request without ACK retains parent 10s bound and rejects its pending promise', async () => {
  const f = actualWorkerClockRealm(), worker = await f.acquire(); f.suppressAck();
  const waiting = worker.waitForOwnerAdmission(); const refused = assert.rejects(waiting, /SUBSCRIPTION_CODING_WORKER_REFUSED/);
  await f.flush(); assert.equal(f.outbound.at(-1)?.type, 'owner-admission-waiting');
  await f.advance(9999); assert.equal(f.dead(), false); assert.equal(f.sdk(), false);
  await f.advance(10000); await refused; assert.equal(f.dead(), true); assert.deepEqual(f.signals, ['SIGTERM']);
});

test('actual ACK wait expires once at fixed 120s and cannot renew or enter SDK', async () => {
  const f = actualWorkerClockRealm(), worker = await f.acquire();
  await f.advance(1000); await worker.waitForOwnerAdmission(); await f.flush();
  await f.advance(120999); assert.equal(f.dead(), false); assert.equal(f.sdk(), false);
  await f.advance(121000); assert.equal(f.dead(), true); assert.equal(f.sdk(), false);
  assert.throws(() => worker.openGate()); await assert.rejects(worker.waitForOwnerAdmission());
});

test('actual waited OPEN without delivered OPENED retains fresh parent 10s bound', async () => {
  const f = actualWorkerClockRealm(), worker = await f.acquire(); await worker.waitForOwnerAdmission();
  await f.advance(16000); f.suppressOpened(); worker.openGate(); await f.flush();
  assert.equal(f.outbound.at(-1)?.type, 'opened');
  await f.advance(25999); assert.equal(f.dead(), false);
  await f.advance(26000); assert.equal(f.dead(), true); assert.deepEqual(f.signals, ['SIGTERM']);
});

test('actual parent checks monotonic deadlines even when timer callbacks have not run', async () => {
  for (const transition of ['request', 'ack', 'open-wait', 'open-direct', 'opened', 'whole-lifetime']) {
    const f = actualWorkerClockRealm(), worker = await f.acquire();
    if (transition === 'ack') {
      f.suppressAck(); const pending = worker.waitForOwnerAdmission(); const refused = assert.rejects(pending);
      await f.flush(); f.jump(10000); f.proof.emit('data', line(f.outbound.at(-1))); await refused;
    } else if (transition === 'request') { f.jump(10000); await assert.rejects(worker.waitForOwnerAdmission()); }
    else if (transition === 'open-direct') { f.jump(10000); assert.throws(() => worker.openGate()); }
    else {
      await worker.waitForOwnerAdmission();
      if (transition === 'opened') {
        f.suppressOpened(); f.jump(16000); worker.openGate(); await f.flush();
        f.jump(26000); f.proof.emit('data', line(f.outbound.at(-1)));
      } else { f.jump(transition === 'whole-lifetime' ? 1800000 : 120000); assert.throws(() => worker.openGate()); }
    }
    await f.flush(); assert.equal(f.dead(), true, transition); if (transition !== 'opened') assert.equal(f.sdk(), false);
  }
});

test('actual wait binds deadline to request emission rather than delayed ACK arrival', async () => {
  const f = actualWorkerClockRealm(), worker = await f.acquire(); f.suppressAck();
  const waiting = worker.waitForOwnerAdmission(); await f.flush(); await f.advance(8000);
  f.proof.emit('data', line(f.outbound.at(-1))); await waiting;
  await f.advance(119999); assert.equal(f.dead(), false);
  await f.advance(120000); assert.equal(f.dead(), true); assert.equal(f.sdk(), false);
});

test('actual identity/material changes, EOF, original death and stop refuse pending or acknowledged wait', async () => {
  for (const phase of ['before-request', 'pending', 'acknowledged']) for (const failure of ['identity', 'material', 'EOF', 'death', 'stop']) {
    const f = actualWorkerClockRealm(), worker = await f.acquire();
    let refusal: Promise<void> | undefined;
    if (phase === 'pending') { f.suppressAck(); refusal = assert.rejects(worker.waitForOwnerAdmission()); await f.flush(); }
    if (phase === 'acknowledged') await worker.waitForOwnerAdmission();
    if (failure === 'identity') f.staleIdentity();
    if (failure === 'material') f.staleMaterial();
    if (failure === 'EOF') f.injectEOF();
    if (failure === 'death') f.death();
    if (failure === 'stop') void worker.stop('owner-abort');
    if (phase === 'before-request') await assert.rejects(worker.waitForOwnerAdmission());
    else if (failure === 'identity' || failure === 'material') assert.throws(() => worker.openGate());
    await f.flush(); if (refusal) await refusal;
    assert.equal(f.sdk(), false); f.death(); await worker.originalClosed;
  }
});

test('actual wait and OPEN never restart the original worker lifetime', async () => {
  const f = actualWorkerClockRealm(), worker = await f.acquire(); await f.advance(5000); await worker.waitForOwnerAdmission();
  await f.advance(16000); worker.openGate(); await f.flush(); assert.equal(f.sdk(), true);
  await f.advance(1799999); assert.equal(f.dead(), false);
  await f.advance(1800000); assert.equal(f.dead(), true); assert.deepEqual(f.signals, ['SIGTERM']);
});

test('actual preload rejects foreign, duplicate, queued and partial phase frames before SDK entry', async () => {
  for (const failure of ['foreign-wait', 'duplicate-wait', 'foreign-open', 'queued-open', 'partial-open', 'late-open']) {
    const f = actualWorkerClockRealm();
    const acquisition = f.acquire(); void acquisition.catch(() => {}); await f.flush();
    const challenge = f.parentFrames[0]!, bind = Object.fromEntries(['nonce', 'pid', 'identity', 'materialHash', 'policyHash', 'preloadHash'].map(k => [k, challenge[k]]));
    const wait = { schema: 'setfarm.subscription-coding-gate.v1', type: 'owner-admission-wait', ...bind };
    const open = { ...wait, type: 'open' };
    const worker = await acquisition;
    if (failure === 'foreign-open') { await worker.waitForOwnerAdmission(); f.injectChild(line({ ...open, nonce: 'f'.repeat(64) })); }
    if (failure === 'foreign-wait') f.injectChild(line({ ...wait, nonce: 'f'.repeat(64) }));
    if (failure === 'queued-open') f.injectChild(Buffer.concat([line(wait), line(open)]));
    if (failure === 'partial-open') f.injectChild(Buffer.concat([line(wait), Buffer.from('{')]));
    if (failure === 'duplicate-wait') { await worker.waitForOwnerAdmission(); f.injectChild(line(wait)); }
    if (failure === 'late-open') { await worker.waitForOwnerAdmission(); f.jump(120000); f.injectChild(line(open)); }
    await f.flush(); assert.equal(f.dead(), true, failure); assert.equal(f.sdk(), false); f.death();
  }
});

test('actual child rejects startup and waited OPENED at monotonic 9s even before timer callbacks', async () => {
  const lateProof = actualWorkerClockRealm();
  const acquiring = lateProof.acquire(); const refused = assert.rejects(acquiring);
  lateProof.jump(9000); await lateProof.flush(); await refused;
  assert.equal(lateProof.sdk(), false); assert.equal(lateProof.outbound.length, 0);
  const f = actualWorkerClockRealm(), worker = await f.acquire();
  await worker.waitForOwnerAdmission(); await f.advance(16000); f.delayOpenedWrite(9000);
  worker.openGate(); await f.flush(); assert.equal(f.dead(), true); assert.equal(f.sdk(), false);
});

test('actual child refuses queued or partial data after the direct OPENED transition', async () => {
  for (const bytes of [Buffer.from('{'), line({ type: 'replay' })]) {
    const f = actualWorkerClockRealm(), worker = await f.acquire(); worker.openGate(); await f.flush();
    assert.equal(f.sdk(), true); f.injectChild(bytes); await f.flush(); assert.equal(f.dead(), true);
  }
});
