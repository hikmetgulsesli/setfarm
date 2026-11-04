/** Fake owned stores and actual-Source DATA only; never import selected authority. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { mock, test } from 'node:test';
import ts from 'typescript';
import type { SubscriptionModelRefV1 } from '../../src/execution/subscription-coding-policy-v1.js';

let api: typeof import('../../src/execution/subscription-credential-record-v1.js') | undefined;
try {
  api = await import('../../src/execution/subscription-credential-record-v1.js');
} catch (error) {
  const missing = error as { code?: unknown; url?: unknown };
  const urls = ['.js', '.ts'].map(ext => new URL('../../src/execution/subscription-credential-record-v1' + ext, import.meta.url).href);
  if (missing.code !== 'ERR_MODULE_NOT_FOUND' || !urls.includes(missing.url as string)) throw error;
}
const read = api?.readSubscriptionCredentialRecordV1 as NonNullable<typeof api>['readSubscriptionCredentialRecordV1'];
const REFUSED = { message: 'SUBSCRIPTION_CREDENTIAL_REFUSED' };
const models = ['minimax/MiniMax-M3.1-Flash', 'kimi/k3.1-pro'] as const;
const secret = (model: SubscriptionModelRefV1) => model === models[0] ? 'sk-cp-FAKE-ONLY-credential-12345' : 'FAKE-ONLY-kimi-credential-12345';
function record(modelRef: SubscriptionModelRefV1 = models[0]): string {
  return JSON.stringify({ schema: 'setfarm.subscription-credential.v1',
    providerId: modelRef === models[0] ? 'minimax' : 'kimi', modelRef, credential: secret(modelRef) }) + '\n';
}
function fixture() {
  const outer = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'subscription-record-test-')));
  // Ancestors above the selected installation need not be private.
  fs.chmodSync(outer, 0o755);
  const installationDirectory = path.join(outer, 'installation');
  const credentials = path.join(installationDirectory, 'credentials');
  const vault = path.join(credentials, 'coding-subscriptions');
  for (const directory of [installationDirectory, credentials, vault]) fs.mkdirSync(directory, { mode: 0o700 });
  for (const model of models) fs.writeFileSync(path.join(vault, model === models[0] ? 'minimax.json' : 'kimi.json'), record(model), { mode: 0o600 });
  const input = { installationDirectory, expectedUid: process.getuid!(), modelRef: models[0] as SubscriptionModelRefV1 };
  return { outer, vault, credentials, input, leaf: path.join(vault, 'minimax.json'),
    dispose() { fs.rmSync(outer, { recursive: true, force: true }); } };
}

test('protected record DATA capability exists', () => {
  assert.equal(typeof read, 'function', 'protected subscription record DATA reader is missing');
});

test('both exact annual model records read under private installation with ordinary ancestors', { skip: !api }, () => {
  const f = fixture();
  try {
    for (const modelRef of models) assert.equal(read({ ...f.input, modelRef }), secret(modelRef));
    const valid = JSON.parse(record());
    fs.writeFileSync(f.leaf, JSON.stringify({ credential: valid.credential, modelRef: valid.modelRef,
      providerId: valid.providerId, schema: valid.schema }) + '\n');
    assert.equal(read(f.input), secret(models[0]));
  }
  finally { f.dispose(); }
});

test('missing, symlinked, linked, unowned, permissive and oversized records refuse without leaking', { skip: !api }, () => {
  for (const mutation of ['missing', 'symlink', 'hardlink', 'owner', 'mode', 'oversize'] as const) {
    const f = fixture();
    try {
      if (mutation === 'missing') fs.unlinkSync(f.leaf);
      if (mutation === 'symlink') { fs.renameSync(f.leaf, f.leaf + '.target'); fs.symlinkSync(f.leaf + '.target', f.leaf); }
      if (mutation === 'hardlink') fs.linkSync(f.leaf, f.leaf + '.linked');
      if (mutation === 'mode') fs.chmodSync(f.leaf, 0o640);
      if (mutation === 'oversize') fs.writeFileSync(f.leaf, 'x'.repeat(4097));
      assert.throws(() => read({ ...f.input, expectedUid: f.input.expectedUid + (mutation === 'owner' ? 1 : 0) }), REFUSED);
    } finally { f.dispose(); }
  }
});

test('owned-record canonical encoding rejects ambiguous JSON, wrong models and invalid secret bytes', { skip: !api }, () => {
  const f = fixture();
  try {
    const valid = JSON.parse(record());
    const invalid = ['{', record() + '\n', record().replace('{', '{"credential":"duplicate",'),
      JSON.stringify({ ...valid, extra: true }) + '\n', JSON.stringify({ ...valid, providerId: 'kimi' }) + '\n',
      JSON.stringify({ ...valid, modelRef: models[1] }) + '\n', JSON.stringify({ ...valid, schema: 'other' }) + '\n',
      ...['short', 'x'.repeat(20), 'sk-cp-with space 123456', 'sk-cp-\n1234567890123456', 'sk-cp-é1234567890123456']
        .map(credential => JSON.stringify({ ...valid, credential }) + '\n')];
    for (const contents of invalid) { fs.writeFileSync(f.leaf, contents); assert.throws(() => read(f.input), REFUSED); }
  } finally { f.dispose(); }
});

test('noncanonical names and nonprivate or symlinked vault ancestors refuse', { skip: !api }, () => {
  const f = fixture();
  try {
    for (const installationDirectory of [f.input.installationDirectory + '/', f.input.installationDirectory + '/.',
      path.join(f.outer, 'alias'), 'relative', '/', f.input.installationDirectory + '\0']) {
      if (installationDirectory.endsWith('/alias')) fs.symlinkSync(f.input.installationDirectory, installationDirectory);
      assert.throws(() => read({ ...f.input, installationDirectory }), REFUSED);
    }
    for (const directory of [f.input.installationDirectory, f.credentials, f.vault]) {
      fs.chmodSync(directory, 0o750);
      assert.throws(() => read(f.input), REFUSED);
      fs.chmodSync(directory, 0o700);
    }
    fs.renameSync(f.vault, f.vault + '.original'); fs.symlinkSync(f.vault + '.original', f.vault);
    assert.throws(() => read(f.input), REFUSED);
  } finally { f.dispose(); }
});

test('leaf replacement is rejected before body read and held descriptors close exactly once', { skip: !api }, () => {
  const f = fixture(), originalOpen = fs.openSync, originalClose = fs.closeSync;
  const opened: number[] = [], closed: number[] = [];
  let bodyReads = 0, replaced = false, fixtureMutation = false;
  mock.method(fs, 'openSync', (...args: Parameters<typeof fs.openSync>) => {
    const fd = originalOpen(...args);
    if (!fixtureMutation) opened.push(fd);
    if (args[0] === f.leaf && !replaced) {
      replaced = true; fixtureMutation = true;
      try { fs.renameSync(f.leaf, f.leaf + '.old'); fs.writeFileSync(f.leaf, record(), { mode: 0o600 }); }
      finally { fixtureMutation = false; }
    }
    return fd;
  });
  mock.method(fs, 'readSync', () => { bodyReads++; throw Error('body must not be read'); });
  mock.method(fs, 'closeSync', (fd: number) => {
    if (!fixtureMutation) closed.push(fd);
    originalClose(fd);
  });
  try {
    assert.throws(() => read(f.input), REFUSED);
    assert.equal(replaced, true);
    assert.equal(bodyReads, 0);
    assert.deepEqual([...closed].sort(), [...opened].sort());
  } finally { mock.restoreAll(); f.dispose(); }
});

test('ancestor replacement during a real read refuses after rechecking held parent identities', { skip: !api }, () => {
  const f = fixture(), originalRead = fs.readSync;
  let replaced = false;
  mock.method(fs, 'readSync', (...args: Parameters<typeof fs.readSync>) => {
    if (!replaced) {
      replaced = true;
      fs.renameSync(f.vault, f.vault + '.old'); fs.mkdirSync(f.vault, { mode: 0o700 });
      fs.writeFileSync(f.leaf, record(), { mode: 0o600 });
    }
    return originalRead(...args);
  });
  try { assert.throws(() => read(f.input), REFUSED); assert.equal(replaced, true); }
  finally { mock.restoreAll(); f.dispose(); }
});

function facadeData(options: { selected?: boolean; guardFails?: number; mutateAfterRead?: boolean } = {}) {
  // Extract actual Source as DATA, following fresh-installation-v3-profile.test.ts.
  // These local stand-ins confer no selected installation or operational authority.
  const file = new URL('../../src/execution/subscription-parent-credential-v1.ts', import.meta.url);
  const source = fs.readFileSync(file, 'utf8');
  const tree = ts.createSourceFile(file.pathname, source, ts.ScriptTarget.Latest, true);
  const body = tree.statements.filter(node => !ts.isImportDeclaration(node)).map(node => node.getText(tree)).join('\n');
  const compiled = ts.transpileModule(body, { compilerOptions: { target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext } }).outputText.replace(/^export /gm, '');
  const events: string[] = []; let guards = 0, drift = false;
  const api = new Function('freshInstallationSelectionV1', 'assertFreshInstallationSelectionUnchangedV1',
    'assertFreshInstallationOperationalEntryV1', 'readSubscriptionCredentialRecordV1', 'process', compiled
    + ';return {withSelectedSubscriptionCredentialV1};')(
    options.selected === false ? null : { directory: '/DATA/selected', assertUnchanged() {
      events.push('unchanged'); if (drift) throw Error('FAKE_PRIVATE_SOURCE_DRIFT');
    } },
    () => { events.push('selection'); },
    () => { events.push('entry'); if (++guards === options.guardFails) throw Error('FAKE_PRIVATE_ENTRY'); },
    (input: unknown) => { events.push('read'); assert.deepEqual(input, {
      installationDirectory: '/DATA/selected', expectedUid: 1234, modelRef: models[0],
    }); if (options.mutateAfterRead) drift = true; return secret(models[0]); },
    { getuid: () => 1234 },
  ) as { withSelectedSubscriptionCredentialV1<T>(model: SubscriptionModelRefV1, use: (credential: string) => Promise<T>): Promise<T> };
  return { api, events, drift() { drift = true; } };
}

test('actual facade DATA rejects absent entry and pre-callback Source drift; callback errors sanitize without losing acquired results', { skip: !api }, async () => {
  for (const options of [{ selected: false }, { guardFails: 1 }, { guardFails: 2 }, { mutateAfterRead: true }]) {
    const h = facadeData(options); let calls = 0;
    await assert.rejects(h.api.withSelectedSubscriptionCredentialV1(models[0], async () => { calls++; }), REFUSED);
    assert.equal(calls, 0);
  }
  const h = facadeData(), handle = { owned: 'broker-DATA' };
  const result = await h.api.withSelectedSubscriptionCredentialV1(models[0], async credential => {
    assert.equal(credential, secret(models[0]));
    assert.ok(h.events.indexOf('read') > h.events.indexOf('entry'));
    assert.ok(h.events.slice(h.events.indexOf('read') + 1).includes('entry'));
    h.drift(); return handle;
  });
  assert.equal(result, handle); // No validation after callback may discard this acquired handle.
  await assert.rejects(facadeData().api.withSelectedSubscriptionCredentialV1(models[0], async () => {
    throw Error('FAKE_PRIVATE_CALLBACK_' + secret(models[0]));
  }), REFUSED);
});
