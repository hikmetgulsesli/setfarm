import assert from 'node:assert/strict';
import test from 'node:test';
import { chmodSync, linkSync, mkdirSync, mkdtempSync, realpathSync, renameSync, rmSync, symlinkSync,
  unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Import is inert. These tests call DATA parsers/resolvers and inspect only
// their own temporary files. Never invoke production capture, otool or a child.
let api: typeof import('../../src/execution/subscription-coding-node-libraries-v1.js') | undefined;
try { api = await import('../../src/execution/subscription-coding-node-libraries-v1.js'); }
catch (error) {
  const missing = error as { code?: unknown; url?: unknown };
  const urls = ['.js', '.ts'].map(ext => new URL('../../src/execution/subscription-coding-node-libraries-v1' + ext, import.meta.url).href);
  if (missing.code !== 'ERR_MODULE_NOT_FOUND' || !urls.includes(missing.url as string)) throw error;
}
const nodePath = '/opt/homebrew/Cellar/node/26.4.0/bin/node';
const libnode = '/opt/homebrew/Cellar/node/26.4.0/lib/libnode.147.dylib';
const llhttp = '/opt/homebrew/Cellar/llhttp/9.4.2/lib/libllhttp.9.4.2.dylib';
const llAlias = '/opt/homebrew/opt/llhttp/lib/libllhttp.9.4.dylib';
const system = '/usr/lib/libSystem.B.dylib';
function image(path: string, dependencies: string[], rpaths: string[] = []) {
  return { path, dependenciesOutput: path + ':\n' + dependencies.map(dep =>
    '\t' + dep + ' (compatibility version 1.0.0, current version 1.0.0)\n').join(''),
  loadCommandsOutput: path + ':\nMach header\n      magic cputype cpusubtype caps filetype ncmds sizeofcmds flags\n'
    + ` 0xfeedfacf 16777228 0 0x00 2 ${rpaths.length + 1} ${24 + rpaths.length * 48} 0x0\n`
    + 'Load command 0\n          cmd LC_UUID\n      cmdsize 24\n         uuid 00000000-0000-0000-0000-000000000000\n'
    + rpaths.map((rpath, i) =>
    `Load command ${i + 1}\n          cmd LC_RPATH\n      cmdsize 48\n         path ${rpath} (offset 12)\n`).join('') };
}
function graph() {
  return { nodePath, images: [image(nodePath, ['@rpath/libnode.147.dylib', llAlias, system], ['@loader_path', '@loader_path/../lib']),
    // A first -L row is not necessarily a self ID: this real dependency must survive.
    image(libnode, [llAlias, system]), image(llhttp, [llAlias, system])], aliases: [
    { path: '/opt/homebrew/opt/llhttp', target: '../Cellar/llhttp/9.4.2' },
    { path: '/opt/homebrew/Cellar/llhttp/9.4.2/lib/libllhttp.9.4.dylib', target: 'libllhttp.9.4.2.dylib' }] };
}
function owned(run: (root: string) => void) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'subscription-library-data-')));
  try { run(root); } finally { rmSync(root, { recursive: true, force: true }); }
}

test('Node library capability exists without invoking a production executable', () => {
  assert.equal(typeof api?.captureSubscriptionCodingNodeLibrariesV1, 'function', 'Node dynamic-library closure capability missing');
  assert.equal(api!.captureSubscriptionCodingNodeLibrariesV1.length, 0, 'production capture takes no caller arguments');
  assert.equal(typeof api!.parseSubscriptionCodingNodeMachOV1, 'function');
  assert.equal(typeof api!.resolveSubscriptionCodingNodeLibraryDataV1, 'function');
  assert.equal(typeof api!.captureSubscriptionCodingOwnedFileDataV1, 'function');
});

test('Mach-O parser preserves declared RPATH order and every dependency including a possible self ID', () => {
  const fixture = image(llhttp, [llAlias, system], ['@loader_path', '@loader_path/../lib']);
  const parsed = api!.parseSubscriptionCodingNodeMachOV1(fixture.path, fixture.dependenciesOutput, fixture.loadCommandsOutput);
  assert.deepEqual(parsed.dependencies, [llAlias, system]);
  assert.deepEqual(parsed.rpaths, ['@loader_path', '@loader_path/../lib']);
  assert.ok(Object.isFrozen(parsed)); assert.ok(Object.isFrozen(parsed.rpaths));
});

test('graph resolution retains transitive and first-row dependencies, self ID, canonical target and both aliases', async () => {
  const result = await api!.resolveSubscriptionCodingNodeLibraryDataV1(graph());
  assert.deepEqual(result.mapPaths, [libnode, llhttp, '/opt/homebrew/Cellar/llhttp/9.4.2/lib/libllhttp.9.4.dylib', llAlias].sort());
  assert.ok(result.readPaths.includes(llAlias));
  assert.equal(result.images.length, 3);
  assert.equal(result.edges.filter(edge => edge.loaderPath === libnode && edge.path === llhttp).length, 1);
  assert.equal(result.edges.filter(edge => edge.loaderPath === llhttp && edge.path === llhttp).length, 1);
  assert.ok(!result.mapPaths.includes(system)); assert.ok(Object.isFrozen(result.edges));
});

test('ordered RPATH resolution records earlier absent candidates and chooses first present candidate', async () => {
  const fixture = graph();
  const result = await api!.resolveSubscriptionCodingNodeLibraryDataV1(fixture);
  assert.deepEqual(result.absentPaths, ['/opt/homebrew/Cellar/node/26.4.0/bin/libnode.147.dylib']);
  fixture.images.push(image('/opt/homebrew/Cellar/node/26.4.0/bin/libnode.147.dylib', [system]));
  const earlier = await api!.resolveSubscriptionCodingNodeLibraryDataV1(fixture);
  assert.equal(earlier.edges[0].path, '/opt/homebrew/Cellar/node/26.4.0/bin/libnode.147.dylib');
  assert.deepEqual(earlier.absentPaths, []);
  const inherited = graph();
  inherited.images[1] = image(libnode, ['@rpath/libextra.dylib']);
  inherited.images.push(image('/opt/homebrew/Cellar/node/26.4.0/lib/libextra.dylib', [system]));
  const transitive = await api!.resolveSubscriptionCodingNodeLibraryDataV1(inherited);
  assert.ok(transitive.absentPaths.includes('/opt/homebrew/Cellar/node/26.4.0/bin/libextra.dylib'),
    'inherited @loader_path expands relative to its declaring executable');
});

test('graph resolution rejects unknown tokens, absent libraries, alias escape/cycle and duplicate image ambiguity', async () => {
  for (const dependency of ['@unknown/lib.dylib', 'relative.dylib', '/Users/owner/lib.dylib',
    '/opt/homebrew/lib/libuntrusted.dylib', '@rpath/missing.dylib']) {
    const fixture = graph(); fixture.images[0] = image(nodePath, [dependency], ['@loader_path']);
    await assert.rejects(() => api!.resolveSubscriptionCodingNodeLibraryDataV1(fixture));
  }
  for (const target of ['/Users/owner/private', '/opt/homebrew/opt/llhttp', 'other-link/../Cellar/llhttp/9.4.2']) {
    const fixture = graph(); fixture.aliases[0].target = target;
    await assert.rejects(() => api!.resolveSubscriptionCodingNodeLibraryDataV1(fixture));
  }
  const parentA = '/opt/homebrew/Cellar/a/1.0/lib/liba.dylib';
  const parentB = '/opt/homebrew/Cellar/b/1.0/lib/libb.dylib';
  const shared = '/opt/homebrew/Cellar/shared/1.0/lib/libshared.dylib';
  await assert.rejects(() => api!.resolveSubscriptionCodingNodeLibraryDataV1({ nodePath, aliases: [], images: [
    image(nodePath, [parentA, parentB]), image(parentA, [shared], ['@loader_path']),
    image(parentB, [shared], ['@loader_path']), image(shared, ['@rpath/libcommon.dylib']),
    image('/opt/homebrew/Cellar/a/1.0/lib/libcommon.dylib', [system]),
    image('/opt/homebrew/Cellar/b/1.0/lib/libcommon.dylib', [system]),
  ] }));
  const duplicate = graph(); duplicate.images.push(image(llhttp, [system]));
  await assert.rejects(() => api!.resolveSubscriptionCodingNodeLibraryDataV1(duplicate));
});

test('Mach-O metadata refuses malformed, partial, foreign-header and oversized outputs', () => {
  assert.ok(api, 'Node dynamic-library parser capability missing');
  const fixture = image(nodePath, [system], ['@loader_path']);
  for (const [deps, commands] of [
    [nodePath + ':\n garbage\n', fixture.loadCommandsOutput],
    [fixture.dependenciesOutput, nodePath + ':\nLoad command 0\n cmd LC_RPATH\n cmdsize 48\n'],
    ['/foreign/node:\n', fixture.loadCommandsOutput],
    [fixture.dependenciesOutput, '/foreign/node:\n'],
    ['x'.repeat(524289), fixture.loadCommandsOutput],
    [fixture.dependenciesOutput, 'x'.repeat(524289)],
    [fixture.dependenciesOutput + '\u0000', fixture.loadCommandsOutput],
    [fixture.dependenciesOutput, fixture.loadCommandsOutput.replace('Load command 1', 'Load command 2')],
    [fixture.dependenciesOutput, fixture.loadCommandsOutput.replace('2 2 72 0x0', '2 3 72 0x0')],
  ]) assert.throws(() => api!.parseSubscriptionCodingNodeMachOV1(nodePath, deps, commands));
});

test('graph collection enforces image, edge and alias budgets before accepting closure DATA', async () => {
  const images = Array.from({ length: 65 }, (_, i) => image(i ? `/opt/homebrew/Cellar/fixture/1.0/lib/lib${i}.dylib` : nodePath,
    i < 64 ? [`/opt/homebrew/Cellar/fixture/1.0/lib/lib${i + 1}.dylib`] : [system]));
  await assert.rejects(() => api!.resolveSubscriptionCodingNodeLibraryDataV1({ nodePath, images, aliases: [] }));
  const tooManyEdges = graph(); tooManyEdges.images[0] = image(nodePath, Array(513).fill(llAlias));
  await assert.rejects(() => api!.resolveSubscriptionCodingNodeLibraryDataV1(tooManyEdges));
  const tooManyAliases = graph(); tooManyAliases.aliases.push(...Array.from({ length: 129 }, (_, i) =>
    ({ path: `/opt/homebrew/opt/a${i}`, target: '../Cellar/llhttp/9.4.2' })));
  await assert.rejects(() => api!.resolveSubscriptionCodingNodeLibraryDataV1(tooManyAliases));
});

test('owned file DATA pins alias text and canonical content and rejects retargeted aliases', () => owned(root => {
  mkdirSync(join(root, 'lib')); writeFileSync(join(root, 'lib/file.dylib'), 'mach-o fixture', { mode: 0o644 });
  symlinkSync('lib', join(root, 'opt')); symlinkSync('file.dylib', join(root, 'lib/version.dylib'));
  const snapshot = api!.captureSubscriptionCodingOwnedFileDataV1({ paths: [join(root, 'opt/version.dylib')], absentPaths: [] });
  try {
    assert.ok(snapshot.readPaths.includes(join(root, 'lib/file.dylib')));
    assert.ok(snapshot.readPaths.includes(join(root, 'opt/version.dylib')));
    assert.match(snapshot.closureHash, /^[0-9a-f]{64}$/); snapshot.recheck();
    unlinkSync(join(root, 'opt')); symlinkSync('.', join(root, 'opt'));
    assert.throws(() => snapshot.recheck());
  } finally { assert.equal(snapshot.close(), 'closed'); }
}));

test('owned file DATA keeps earlier absent RPATH candidates absent', () => owned(root => {
  writeFileSync(join(root, 'present.dylib'), 'fixture', { mode: 0o644 });
  const absent = join(root, 'earlier.dylib');
  const snapshot = api!.captureSubscriptionCodingOwnedFileDataV1({ paths: [join(root, 'present.dylib')], absentPaths: [absent] });
  try { snapshot.recheck(); writeFileSync(absent, 'shadow', { mode: 0o644 }); assert.throws(() => snapshot.recheck()); }
  finally { snapshot.close(); }
}));

test('owned file DATA rejects same-name replacement, content mutation and renamed held ancestor', () => {
  for (const mutation of ['replace', 'content', 'ancestor']) owned(root => {
    mkdirSync(join(root, 'lib')); const path = join(root, 'lib/file.dylib'); writeFileSync(path, 'fixture', { mode: 0o644 });
    const snapshot = api!.captureSubscriptionCodingOwnedFileDataV1({ paths: [path], absentPaths: [] });
    try {
      if (mutation === 'replace') { unlinkSync(path); writeFileSync(path, 'fixture', { mode: 0o644 }); }
      if (mutation === 'content') writeFileSync(path, 'changed', { mode: 0o644 });
      if (mutation === 'ancestor') { renameSync(join(root, 'lib'), join(root, 'moved')); mkdirSync(join(root, 'lib')); writeFileSync(path, 'fixture'); }
      assert.throws(() => snapshot.recheck());
    } finally { snapshot.close(); }
  });
});

test('owned file DATA rejects unsafe file modes, hardlinks, non-files and symlink cycles', () => owned(root => {
  assert.ok(api, 'owned file snapshot capability missing');
  const path = join(root, 'file.dylib'); writeFileSync(path, 'fixture', { mode: 0o644 });
  chmodSync(path, 0o666);
  assert.throws(() => api!.captureSubscriptionCodingOwnedFileDataV1({ paths: [path], absentPaths: [] }));
  chmodSync(path, 0o644); linkSync(path, join(root, 'hard.dylib'));
  assert.throws(() => api!.captureSubscriptionCodingOwnedFileDataV1({ paths: [path], absentPaths: [] }));
  assert.throws(() => api!.captureSubscriptionCodingOwnedFileDataV1({ paths: [root], absentPaths: [] }));
  symlinkSync('cycle.dylib', join(root, 'cycle.dylib'));
  assert.throws(() => api!.captureSubscriptionCodingOwnedFileDataV1({ paths: [join(root, 'cycle.dylib')], absentPaths: [] }));
}));

test('owned snapshot close is one-shot and a closed snapshot can never recheck as valid', () => owned(root => {
  const path = join(root, 'file.dylib'); writeFileSync(path, 'fixture', { mode: 0o644 });
  const snapshot = api!.captureSubscriptionCodingOwnedFileDataV1({ paths: [path], absentPaths: [] });
  assert.ok(Object.isFrozen(snapshot)); assert.equal(snapshot.close(), 'closed');
  assert.equal(snapshot.close(), 'closed'); assert.throws(() => snapshot.recheck());
}));

test('versioned formula alias DATA resolves ordinary @ names while preserving exact public files', async () => {
  assert.ok(api, 'Node library graph capability missing');
  const openssl = '/opt/homebrew/Cellar/openssl@3/3.6.2/lib/libcrypto.3.dylib';
  const icu = '/opt/homebrew/Cellar/icu4c@78/78.3/lib/libicuuc.78.dylib';
  const opensslAlias = '/opt/homebrew/opt/openssl@3/lib/libcrypto.3.dylib';
  const icuAlias = '/opt/homebrew/opt/icu4c@78/lib/libicuuc.78.dylib';
  const result = await api.resolveSubscriptionCodingNodeLibraryDataV1({ nodePath,
    images: [image(nodePath, [opensslAlias, icuAlias]), image(openssl, [system]), image(icu, [system])],
    aliases: [{ path: '/opt/homebrew/opt/openssl@3', target: '../Cellar/openssl@3/3.6.2' },
      { path: '/opt/homebrew/opt/icu4c@78', target: '../Cellar/icu4c@78/78.3' }] });
  assert.deepEqual(result.mapPaths, [openssl, icu, opensslAlias, icuAlias].sort());
  assert.deepEqual(result.readPaths, [openssl, icu, opensslAlias, icuAlias].sort());
  assert.deepEqual(result.edges.slice(0, 2).map(edge => edge.path), [openssl, icu]);
});

test('versioned formula alias owned DATA pins @ target names and still rejects alias identity drift', () => owned(root => {
  assert.ok(api, 'owned file snapshot capability missing');
  mkdirSync(join(root, 'opt'));
  const paths: string[] = [], canonicalPaths: string[] = [];
  for (const [formula, version, name] of [['openssl@3', '3.6.2', 'libcrypto.3.dylib'],
    ['icu4c@78', '78.3', 'libicuuc.78.dylib']]) {
    const directory = join(root, 'Cellar', formula, version, 'lib');
    mkdirSync(directory, { recursive: true });
    writeFileSync(join(directory, name), 'owned Mach-O fixture ' + formula, { mode: 0o644 });
    symlinkSync('../Cellar/' + formula + '/' + version, join(root, 'opt', formula));
    paths.push(join(root, 'opt', formula, 'lib', name)); canonicalPaths.push(join(directory, name));
  }
  const snapshot = api.captureSubscriptionCodingOwnedFileDataV1({ paths, absentPaths: [] });
  try {
    assert.deepEqual(snapshot.readPaths, [...paths, ...canonicalPaths].sort());
    snapshot.recheck();
    unlinkSync(join(root, 'opt/openssl@3'));
    symlinkSync('../Cellar/openssl@3/3.6.2', join(root, 'opt/openssl@3'));
    assert.throws(() => snapshot.recheck(), 'same alias text with a replaced symlink identity must still refuse');
  } finally { assert.equal(snapshot.close(), 'closed'); }
}));
