import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import test from 'node:test';

const SOURCE = new URL('../task6a-origin-native-task-port-v2.c', import.meta.url);
// Explicit test-process-only opt-in; never ambient native execution in a glob.
const REFUSAL_TEST_ENABLED = process.env.SETFARM_TASK6A_NATIVE_TASK_PORT_TEST === 'refusal';
const CLANG = '/Library/Developer/CommandLineTools/usr/bin/clang';
const LD = '/Library/Developer/CommandLineTools/usr/bin/ld';
const NODE = '/opt/homebrew/Cellar/node/26.4.0/bin/node';
const SDK = '/Library/Developer/CommandLineTools/SDKs/MacOSX26.5.sdk';
const RESOURCE = '/Library/Developer/CommandLineTools/usr/lib/clang/21';
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const ENTRY = "import {writeFileSync} from 'node:fs';\n" +
  "writeFileSync(new URL('./entry-started', import.meta.url), 'entry started\\n', {flag:'wx',mode:0o600});\n" +
  "process.exit(2);\n";

function sameStat(a, b) {
  return ['dev', 'ino', 'uid', 'gid', 'mode', 'nlink', 'size', 'mtimeNs', 'ctimeNs']
    .every(key => a[key] === b[key]);
}

function checkSystemDirectory(filename, expectedInode) {
  let current = '';
  for (const part of filename.split('/').filter(Boolean)) {
    current += '/' + part;
    const stat = fs.lstatSync(current, {bigint: true});
    assert.ok(stat.isDirectory(), 'physical directory: ' + current);
    assert.equal(stat.uid, 0n);
    assert.equal(stat.gid, 0n);
    assert.equal(stat.mode & 0o022n, 0n);
    if (current === filename && expectedInode) assert.equal(stat.ino, BigInt(expectedInode));
  }
}

function holdRegular(filename, expectedHash, expectedUid) {
  const fd = fs.openSync(filename, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW | fs.constants.O_NONBLOCK);
  try {
    const initial = fs.fstatSync(fd, {bigint: true});
    assert.ok(initial.isFile());
    assert.equal(initial.nlink, 1n);
    assert.equal(initial.uid, BigInt(expectedUid));
    assert.equal(initial.mode & 0o022n, 0n);
    const bytes = fs.readFileSync(fd);
    assert.ok(sameStat(initial, fs.fstatSync(fd, {bigint: true})));
    assert.ok(sameStat(initial, fs.lstatSync(filename, {bigint: true})));
    if (expectedHash) assert.equal(sha256(bytes), expectedHash);
    return {
      bytes,
      check() {
        assert.ok(sameStat(initial, fs.fstatSync(fd, {bigint: true})));
        assert.ok(sameStat(initial, fs.lstatSync(filename, {bigint: true})));
        const final = Buffer.alloc(bytes.length);
        let offset = 0;
        while (offset < final.length) {
          const count = fs.readSync(fd, final, offset, final.length - offset, offset);
          assert.ok(count > 0);
          offset += count;
        }
        assert.deepEqual(final, bytes);
        assert.ok(sameStat(initial, fs.fstatSync(fd, {bigint: true})));
        assert.ok(sameStat(initial, fs.lstatSync(filename, {bigint: true})));
      },
      close() { fs.closeSync(fd); },
    };
  } catch (error) {
    try { fs.closeSync(fd); }
    catch (cleanup) { throw new AggregateError([error, cleanup], 'read and close failed'); }
    throw error;
  }
}

function entryStarted(directory, held) {
  try {
    held.push(holdRegular(directory + '/entry-started', sha256('entry started\n'), 501));
    return true;
  } catch (error) {
    if (error.code === 'ENOENT') return false;
    throw error;
  }
}

function checkPrivateDirectory(filename, initial) {
  const actual = fs.lstatSync(filename, {bigint: true});
  assert.ok(actual.isDirectory());
  assert.equal(actual.uid, 501n);
  assert.equal(actual.gid, 0n);
  assert.equal(actual.mode & 0o777n, 0o700n);
  if (initial) {
    assert.equal(actual.dev, initial.dev);
    assert.equal(actual.ino, initial.ino);
  }
  return actual;
}

// All original exit/close/error listeners precede stream handling. Drain to
// natural close; never kill an uncertain compiler/child or synthesize closure.
function settled(command, args, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd, env: {PATH: '/usr/bin:/bin', LANG: 'C', LC_ALL: 'C', TMPDIR: cwd},
      stdio: ['ignore', 'pipe', 'pipe'], shell: false,
    });
    const stdout = [], stderr = [], failures = [];
    let total = 0, overflow = false, missingStream = false, exit = null;
    let stdoutEnded = false, stderrEnded = false;
    child.on('error', error => { failures.push(error); });
    child.on('exit', (code, signal) => { exit = {code, signal}; });
    child.on('close', (code, signal) => {
      if (missingStream) failures.push(new Error('owned child output stream missing'));
      if (failures.length) return reject(new AggregateError(failures, 'owned child failed after close'));
      try {
        assert.ok(!overflow, 'output overflow after definite close');
        assert.deepEqual(exit, {code, signal});
        assert.equal(signal, null);
        assert.ok(stdoutEnded && stderrEnded, 'both output EOF required');
        resolve({code, stdout: Buffer.concat(stdout).toString(), stderr: Buffer.concat(stderr).toString()});
      } catch (error) { reject(error); }
    });
    for (const [stream, chunks, isStdout] of [[child.stdout, stdout, true], [child.stderr, stderr, false]]) {
      if (!stream) { missingStream = true; continue; }
      try {
        stream.on('error', error => { failures.push(error); });
        stream.on('end', () => {
          if (isStdout) stdoutEnded = true;
          else stderrEnded = true;
        });
        stream.on('data', bytes => {
          try {
            total += bytes.length;
            if (total <= 1_048_576) chunks.push(bytes);
            else overflow = true;
          } catch (error) { failures.push(error); }
        });
      } catch (error) { failures.push(error); }
    }
  });
}

async function invokeOwnedTaskPortProbe(args, stage = 'execute', fixture = 'delivered', control = 'none') {
  assert.deepEqual(args, ['unexpected']);
  assert.equal(stage, 'execute');
  assert.equal(fixture, 'delivered');
  assert.equal(control, 'none');
  const held = [], directories = [];
  let primary = null;
  try {
    held.push(holdRegular(fileURLToPath(SOURCE), null, 501));
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    return {
      availability: 'source-unavailable', code: null,
      stdout: '', stderr: '', entryStarted: null,
    };
  }
  try {
    assert.equal(process.platform, 'darwin');
    assert.equal(process.getuid(), 501);
    assert.equal(process.geteuid(), 501);
    held.push(holdRegular(fileURLToPath(import.meta.url), null, 501));
    held.push(holdRegular(CLANG, 'f30550eab15fdf5ab8c0dc54c52679711241e5d4b636b027e18c09fef531775d', 0));
    held.push(holdRegular(LD, '28d85b9af18c923db12e0b4ce70b80ee217f2b7cade0e872baa9e8ddc396c08d', 0));
    held.push(holdRegular(NODE, '59cd4fb59cf5bc239f43d5db8c0cd8c23c22db79419612b92da3b7cf34de8553', 501));
    checkSystemDirectory('/Library/Developer/CommandLineTools/usr/bin');
    checkSystemDirectory(SDK, 14162438);
    checkSystemDirectory(RESOURCE, 6714331);
    for (const directory of [SDK + '/usr/include', RESOURCE + '/include', SDK + '/usr/lib'])
      checkSystemDirectory(directory);
    const settings = holdRegular(SDK + '/SDKSettings.json',
      'f8d005f09381389167f9e0aeaa169bc9e7dff162ef22ca2fd8e98df7ff1acafe', 0);
    held.push(settings);
    assert.equal(JSON.parse(settings.bytes).CanonicalName, 'macosx26.5');
    assert.equal(JSON.parse(settings.bytes).MinimalDisplayName, '26.5');
    held.push(holdRegular(SDK + '/usr/lib/libSystem.B.tbd',
      '20cfce043f11a083e2eb6111efe3579919a8082fa4cc912a7bd839af2010ec57', 0));
    const directory = fs.mkdtempSync('/private/tmp/setfarm-native-task-port-test.');
    fs.chmodSync(directory, 0o700);
    directories.push({path: directory, stat: checkPrivateDirectory(directory)});
    const source = directory + '/task6a-origin-native-task-port-v2.c';
    const object = directory + '/probe.o', binary = directory + '/probe';
    const fixtureEntry = directory + '/task6a-protected-origin-entry-v2.mjs';
    fs.writeFileSync(source, held[0].bytes, {flag: 'wx', mode: 0o600});
    fs.writeFileSync(fixtureEntry, ENTRY, {flag: 'wx', mode: 0o600});
    held.push(holdRegular(source, sha256(held[0].bytes), 501));
    held.push(holdRegular(fixtureEntry, sha256(ENTRY), 501));
    const compile = await settled(CLANG, [
      '--no-default-config', '--target=arm64-apple-macos26.5',
      '-resource-dir', RESOURCE, '-isysroot', SDK, '-integrated-as',
      '-nostdinc', '-isystem', RESOURCE + '/include', '-isystem', SDK + '/usr/include',
      '-fno-modules', '-fno-lto', '-std=c11', '-O0', '-Wall', '-Wextra', '-Werror',
      '-c', source, '-o', object,
    ], directory);
    assert.deepEqual(compile, {code: 0, stdout: '', stderr: ''});
    const objectInput = holdRegular(object, null, 501);
    held.push(objectInput);
    const calibration = fs.mkdtempSync('/private/tmp/setfarm-native-task-port-witness.');
    fs.chmodSync(calibration, 0o700);
    directories.push({path: calibration, stat: checkPrivateDirectory(calibration)});
    const calibrationEntry = calibration + '/task6a-protected-origin-entry-v2.mjs';
    fs.writeFileSync(calibrationEntry, ENTRY, {flag: 'wx', mode: 0o600});
    held.push(holdRegular(calibrationEntry, sha256(ENTRY), 501));
    const observed = await settled(NODE, [calibrationEntry], calibration);
    assert.deepEqual(observed, {code: 2, stdout: '', stderr: ''});
    assert.equal(entryStarted(calibration, held), true, 'startup witness must actually work');
    const link = await settled(CLANG, [
      '--no-default-config', '--target=arm64-apple-macos26.5',
      '-resource-dir', RESOURCE, '-isysroot', SDK, '--ld-path=' + LD,
      '-fno-lto', '-nostdlib', '-Wl,-Z', '-Wl,-syslibroot,' + SDK,
      object, SDK + '/usr/lib/libSystem.B.tbd', '-o', binary,
    ], directory);
    assert.deepEqual(link, {code: 0, stdout: '', stderr: ''});
    const binaryInput = holdRegular(binary, null, 501);
    held.push(binaryInput);
    const actual = await settled(binary, args, directory);
    return {
      ...actual, availability: 'executed-ordinary', entryStarted: entryStarted(directory, held),
      evidence: {
        directory, calibration, sourceHash: sha256(held[0].bytes),
        objectHash: sha256(objectInput.bytes), binaryHash: sha256(binaryInput.bytes),
        entryHash: sha256(ENTRY), compilerExit: compile.code, linkerExit: link.code,
        witnessExit: observed.code, definiteExitCloseAndBothEof: true,
        entryKind: 'startup-witness', productionAuthority: false, controlUsable: false,
        completeNativeClosure: false, protectedOrigin: false,
      },
    };
  } catch (error) {
    primary = error;
    throw error;
  } finally {
    // Retain original fresh artifacts on every outcome; check all, close all.
    const errors = [];
    for (const directory of directories) {
      try { checkPrivateDirectory(directory.path, directory.stat); }
      catch (error) { errors.push(error); }
    }
    for (const [directory, inode] of [[SDK, 14162438], [RESOURCE, 6714331]]) {
      try { checkSystemDirectory(directory, inode); }
      catch (error) { errors.push(error); }
    }
    for (const item of held) {
      try { item.check(); } catch (error) { errors.push(error); }
    }
    for (const item of held.reverse()) {
      try { item.close(); } catch (error) { errors.push(error); }
    }
    if (errors.length) throw new AggregateError(primary ? [primary, ...errors] : errors,
      'original input/output custody failed');
  }
}

// Catches acceptance of a public argument or entry startup before refusal.
// Missing-source assertion is support RED, not a kernel/capability witness.
test('ordinary native task-port parent refuses an extra argument before entry start',
  {skip: !REFUSAL_TEST_ENABLED}, async t => {
  const actual = await invokeOwnedTaskPortProbe(['unexpected']);
  t.diagnostic('actual support: ' + actual.availability);
  if (actual.evidence) t.diagnostic(JSON.stringify(actual.evidence));
  assert.equal(actual.code, 2, 'actual support: ' + actual.availability);
  assert.equal(actual.stdout, '');
  assert.equal(actual.stderr, 'TASK6A_NATIVE_TASK_PORT_PROBE_REFUSED\n');
  assert.equal(actual.entryStarted, false);
});
