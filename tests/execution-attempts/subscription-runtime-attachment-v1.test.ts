import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { chmodSync, linkSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, statSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Direct inert DATA API only. No selected installation, database, subprocess,
// sandbox, credentials or network is loaded or exercised by these tests.
let api: typeof import('../../src/execution/subscription-runtime-attachment-v1.js') | undefined;
try { api = await import('../../src/execution/subscription-runtime-attachment-v1.js'); }
catch (error) {
  const missing = error as { code?: string; url?: string };
  if (missing.code !== 'ERR_MODULE_NOT_FOUND' || !['.js', '.ts'].some(ext => missing.url ===
    new URL('../../src/execution/subscription-runtime-attachment-v1' + ext, import.meta.url).href)) throw error;
}
function required() { assert.ok(api, 'Task5A immutable runtime attachment implementation is missing'); return api; }
const hash = (bytes: string | Buffer) => createHash('sha256').update(bytes).digest('hex');
function fixture() {
  const directory = realpathSync(mkdtempSync(join(tmpdir(), 'sf-sub-attachment-')));
  chmodSync(directory, 0o700);
  const worktree = join(directory, 'worktree'); mkdirSync(worktree, { mode: 0o700 });
  const binding = { kind: 'execution-attempt' as const, runtimeSessionId: 'RT_attachment_1', claimId: 41, attemptId: 'ATT_attachment_1',
    generation: 7, fenceToken: 'fence_token_1', ownerInstanceId: 'host.local:43100:12345678-1234-4234-8234-123456789abc',
    modelRef: 'minimax/MiniMax-M3.1-Flash' as const, sourceSha: 'a'.repeat(40), worktree };
  const parentIdentity = { schema: 'setfarm.process-identity.v1' as const, pid: 43100,
    processStartedAt: '2026-11-04T12:00:00.000Z', processGroupId: 43000, source: 'observed_os' as const };
  const authority = { activationPreparedHash: 'b'.repeat(64), activationAcknowledgedHash: 'c'.repeat(64),
    sourceSha: binding.sourceSha, policySourceHash: 'd'.repeat(64), preloadHash: 'e'.repeat(64), parentIdentity };
  const worker = { processIdentity: { ...parentIdentity, pid: 43200 }, brokerPort: 49157,
    isolation: { materialHash: '1'.repeat(64), policyHash: '2'.repeat(64), preloadHash: authority.preloadHash,
      proofHash: '3'.repeat(64), isolationHash: '4'.repeat(64) } };
  return { directory, runtimePath: join(directory, 'journal'), binding, authority, worker,
    cleanup() { rmSync(directory, { recursive: true, force: true }); } };
}

test('immutable journal is private and replay cannot replace a different prepared tuple', () => {
  const f = fixture(); try {
    const journal = required().createSubscriptionRuntimeAttachmentV1({ runtimePath: f.runtimePath, binding: f.binding, authority: f.authority });
    const prepared = readFileSync(join(f.runtimePath, 'prepared.json'));
    assert.equal(statSync(f.runtimePath).mode & 0o777, 0o700);
    assert.equal(statSync(join(f.runtimePath, 'prepared.json')).mode & 0o777, 0o600);
    assert.equal(journal.attachmentHash, hash(prepared));
    assert.equal(required().createSubscriptionRuntimeAttachmentV1({ runtimePath: f.runtimePath, binding: f.binding, authority: f.authority }).attachmentHash, journal.attachmentHash);
    assert.throws(() => required().createSubscriptionRuntimeAttachmentV1({ runtimePath: f.runtimePath, authority: f.authority,
      binding: { ...f.binding, fenceToken: 'different_fence' } }), /SUBSCRIPTION_RUNTIME_ATTACHMENT_REFUSED/);
    assert.deepEqual(readFileSync(join(f.runtimePath, 'prepared.json')), prepared);
  } finally { f.cleanup(); }
});

test('journal refuses extra secret or admission fields rather than serializing them', () => {
  const f = fixture(); try {
    for (const authority of [{ ...f.authority, credential: 'FAKE_SECRET_NEVER_PUBLISH' },
      { ...f.authority, admitted: true }, { ...f.authority, sourceSha: 'f'.repeat(40) }]) {
      assert.throws(() => required().createSubscriptionRuntimeAttachmentV1({ runtimePath: f.runtimePath, binding: f.binding, authority } as never),
        /SUBSCRIPTION_RUNTIME_ATTACHMENT_REFUSED/);
    }
  } finally { f.cleanup(); }
});

test('worker-bound record requires the actual proof, policy, preload and process identity before closure', async () => {
  const f = fixture(); try {
    const journal = required().createSubscriptionRuntimeAttachmentV1({ runtimePath: f.runtimePath, binding: f.binding, authority: f.authority });
    await assert.rejects(journal.publishClosed({ binding: f.binding, attachmentHash: journal.attachmentHash,
      status: 'closed', broker: 'closed', worker: 'closed', evidenceRefs: [] }), /SUBSCRIPTION_RUNTIME_ATTACHMENT_REFUSED/);
    for (const worker of [{ ...f.worker, isolation: { ...f.worker.isolation, proofHash: null } },
      { ...f.worker, isolation: { ...f.worker.isolation, preloadHash: '0'.repeat(64) } },
      { ...f.worker, processIdentity: { ...f.worker.processIdentity, source: 'legacy-backfill' } }]) {
      await assert.rejects(journal.bindWorker(worker as never), /SUBSCRIPTION_RUNTIME_ATTACHMENT_REFUSED/);
    }
    await journal.bindWorker(f.worker);
    const view = required().readSubscriptionRuntimeAttachmentV1({ runtimePath: f.runtimePath, binding: f.binding });
    assert.equal(view.phase, 'worker-bound');
    assert.equal(view.worker!.isolation.proofHash, '3'.repeat(64));
    assert.equal(view.worker!.processIdentity.pid, 43200);
    assert.equal(view.closure, null);
    assert.equal(readFileSync(join(f.runtimePath, 'worker-bound.json'), 'utf8').includes('apiKey'), false);
  } finally { f.cleanup(); }
});

test('reader authenticates every locked tuple field and immutable chain bytes', async () => {
  const f = fixture(); try {
    const journal = required().createSubscriptionRuntimeAttachmentV1({ runtimePath: f.runtimePath, binding: f.binding, authority: f.authority }); await journal.bindWorker(f.worker);
    await journal.publishClosed({ binding: f.binding, attachmentHash: journal.attachmentHash,
      status: 'closed', broker: 'closed', worker: 'closed', evidenceRefs: ['original-process-and-streams', 'original-broker'] });
    assert.equal(required().readSubscriptionRuntimeAttachmentV1({ runtimePath: f.runtimePath, binding: f.binding }).closure!.status, 'closed');
    const changes = { runtimeSessionId: 'RT_other', claimId: 42, attemptId: 'ATT_other', generation: 8,
      fenceToken: 'other_fence', ownerInstanceId: 'other_owner', modelRef: 'kimi/k3.1-pro',
      sourceSha: 'f'.repeat(40), worktree: join(f.directory, 'other') };
    for (const [key, value] of Object.entries(changes)) assert.throws(() =>
      required().readSubscriptionRuntimeAttachmentV1({ runtimePath: f.runtimePath, binding: { ...f.binding, [key]: value } } as never),
    /SUBSCRIPTION_RUNTIME_ATTACHMENT_REFUSED/);
    const path = join(f.runtimePath, 'worker-bound.json');
    const contents = JSON.parse(readFileSync(path, 'utf8')); contents.worker.isolation.proofHash = '9'.repeat(64);
    writeFileSync(path, JSON.stringify(contents) + '\n', { mode: 0o600 });
    assert.throws(() => required().readSubscriptionRuntimeAttachmentV1({ runtimePath: f.runtimePath, binding: f.binding }),
      /SUBSCRIPTION_RUNTIME_ATTACHMENT_REFUSED/);
  } finally { f.cleanup(); }
});

test('journal rejects symlink, hardlink and public record custody', () => {
  for (const kind of ['symlink', 'hardlink', 'public'] as const) {
    const f = fixture(); try {
      required().createSubscriptionRuntimeAttachmentV1({ runtimePath: f.runtimePath, binding: f.binding, authority: f.authority });
      const record = join(f.runtimePath, 'prepared.json'), original = readFileSync(record);
      if (kind === 'public') chmodSync(record, 0o644);
      else {
        rmSync(record); const outside = join(f.directory, 'outside.json'); writeFileSync(outside, original, { mode: 0o600 });
        if (kind === 'symlink') symlinkSync(outside, record); else linkSync(outside, record);
      }
      assert.throws(() => required().readSubscriptionRuntimeAttachmentV1({ runtimePath: f.runtimePath, binding: f.binding }),
        /SUBSCRIPTION_RUNTIME_ATTACHMENT_REFUSED/);
    } finally { f.cleanup(); }
  }
});


test('stage-claim journal binds real runtime and claim identity without invented execution fence', async () => {
  const f = fixture(); try {
    const { attemptId: _attempt, generation: _generation, fenceToken: _fence, ...common } = f.binding;
    const binding = { ...common, kind: 'stage-claim' as const };
    const journal = required().createSubscriptionRuntimeAttachmentV1({ runtimePath: f.runtimePath, binding, authority: f.authority });
    await journal.bindWorker(f.worker);
    await journal.publishClosed({ binding, attachmentHash: journal.attachmentHash,
      status: 'closed', broker: 'closed', worker: 'closed', evidenceRefs: ['original-process-and-streams', 'original-broker'] });
    const view = required().readSubscriptionRuntimeAttachmentV1({ runtimePath: f.runtimePath, binding });
    assert.equal(view.closure!.status, 'closed'); assert.equal(view.binding.kind, 'stage-claim');
    const raw = readFileSync(join(f.runtimePath, 'prepared.json'), 'utf8');
    for (const invented of ['attemptId', 'generation', 'fenceToken']) assert.equal(raw.includes('"' + invented + '"'), false);
    assert.throws(() => required().readSubscriptionRuntimeAttachmentV1({ runtimePath: f.runtimePath, binding: f.binding }),
      /SUBSCRIPTION_RUNTIME_ATTACHMENT_REFUSED/);
  } finally { f.cleanup(); }
});

test('journal refuses mixed stage and execution binding shapes before any prepared record', () => {
  const f = fixture(); try {
    const { attemptId: _attempt, generation: _generation, fenceToken: _fence, ...common } = f.binding;
    for (const binding of [{ ...f.binding, kind: 'stage-claim' }, { ...common, kind: 'execution-attempt' },
      { ...common, kind: 'stage-claim', attemptId: 'fake_attempt' }, { ...f.binding, kind: 'other' }]) {
      assert.throws(() => required().createSubscriptionRuntimeAttachmentV1({ runtimePath: f.runtimePath, binding, authority: f.authority } as never),
        /SUBSCRIPTION_RUNTIME_ATTACHMENT_REFUSED/);
    }
  } finally { f.cleanup(); }
});
