import assert from 'node:assert/strict';
import test from 'node:test';
import { EventEmitter } from 'node:events';
import { chmodSync, linkSync, mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { ChildProcess } from 'node:child_process';
import { buildSubscriptionCodingMaterialV1 } from '../../src/execution/subscription-coding-policy-v1.js';
import type { ProcessIdentityV1 } from '../../src/execution/schemas/process-identity-v1.js';

// These tests exercise inert production data/protocol/custody and bounded owned
// filesystem DATA only. They never launch, listen, or qualify an OS sandbox.
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
  assert.match(policy, /\(allow network-outbound \(remote ip "127\.0\.0\.1:49157"\)\)/);
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
  assert.deepEqual(JSON.parse(writable.material.files[0].contents).tools.allow, ['read', 'write', 'edit']);
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
