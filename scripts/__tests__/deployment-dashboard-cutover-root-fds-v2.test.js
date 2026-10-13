import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const provider = fileURLToPath(new URL('../deployment-dashboard-cutover-root-fds-v2.py', import.meta.url));
const native = { skip: process.platform !== 'darwin', timeout: 20000 };
const environment = { PATH: '/usr/bin:/bin', LANG: 'C', LC_ALL: 'C' };
const refusal = 'DASHBOARD_ROOT_FD_DIAGNOSTIC_REFUSED\n';
const canonical = value => `${JSON.stringify(value, Object.keys(value).sort())}\n`;
// Request arrays contain primitive integers; no nested object key filtering.
function fixture(t) {
  const directory = fs.realpathSync(fs.mkdtempSync('/private/tmp/dashboard-root-fds-v2-'));
  fs.chmodSync(directory, 0o700);
  const root = path.join(directory, 'restart-authority-retirement-v1');
  fs.mkdirSync(root, { mode: 0o700 });
  const fd = fs.openSync(root, fs.constants.O_RDONLY | fs.constants.O_DIRECTORY | fs.constants.O_NOFOLLOW);
  const settlers = [];
  const state = { directory, root, fd, original: undefined, settlers, providerUnknown: false };
  let closeAttempted = false;
  t.after(async () => {
    for (const settle of settlers) await settle();
    assert.equal(state.providerUnknown, false, 'retain original FD on unknown provider custody');
    assert.ok(state.original, 'retain unsealed original FD after failed fstat');
    assert.equal(closeAttempted, false); closeAttempted = true;
    fs.closeSync(fd);
    assert.throws(() => fs.fstatSync(fd), { code: 'EBADF' });
    // Deliberately retain the owned fixture directory as diagnostic evidence.
  });
  const raw = fs.fstatSync(fd, { bigint: true });
  const numeric = key => {
    const limit = key === 'mode' || key === 'nlink' ? 65535n : 4294967295n;
    assert.ok(raw[key] >= 0n && raw[key] <= limit); return Number(raw[key]);
  };
  state.original = { dev: raw.dev, ino: raw.ino, mode: numeric('mode'), nlink: numeric('nlink'), uid: numeric('uid'), gid: numeric('gid') };
  return state;
}
function request(f, pids = [process.pid]) {
  return { schema: 'setfarm.dashboard-cutover-root-fd-request.v2', rootDev: String(f.original.dev),
    rootIno: String(f.original.ino), pids: [...pids].sort((a, b) => a - b) };
}
async function invoke(input, f) {
  const child = spawn('/usr/bin/python3', ['-I', '-S', '-B', provider], {
    cwd: '/', env: environment, stdio: ['pipe', 'pipe', 'pipe'],
  });
  let stdout = '', stderr = '', bytes = 0, transportError;
  const eof = { stdout: false, stderr: false };
  for (const [stream, which] of [[child.stdout, 'stdout'], [child.stderr, 'stderr']]) {
    stream.setEncoding('utf8');
    stream.on('data', data => {
      bytes += Buffer.byteLength(data);
      if (bytes > 1048576) { transportError ??= new Error('bounded provider output exceeded'); return; }
      if (which === 'stdout') stdout += data; else stderr += data;
    });
    stream.on('error', error => { transportError ??= error; });
    stream.on('end', () => { eof[which] = true; });
  }
  child.stdin.on('error', error => { transportError ??= error; });
  const completion = once(child, 'close');
  let timer;
  const deadline = new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('provider custody unknown: no natural close within10s')), 10000); });
  child.stdin.end(typeof input === 'string' || Buffer.isBuffer(input) ? input : canonical(input));
  let status, signal;
  try { [status, signal] = await Promise.race([completion, deadline]); }
  catch (error) { f.providerUnknown = true; throw error; }
  finally { clearTimeout(timer); }
  // On an unknown timeout, do not signal, retry or treat custody as settled.
  if (transportError || signal !== null || !eof.stdout || !eof.stderr) f.providerUnknown = true;
  assert.equal(transportError, undefined, String(transportError));
  assert.equal(signal, null, 'provider must settle naturally with both output EOFs');
  assert.deepEqual(eof, { stdout: true, stderr: true });
  return { status, signal, stdout, stderr, pid: child.pid };
}
async function readReport(f, pids = [process.pid]) {
  const result = await invoke(request(f, pids), f);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stderr, '');
  const packet = JSON.parse(result.stdout);
  // Independently check recursively sorted canonical wire, not the producer's encoder.
  const sorted = value => Array.isArray(value) ? value.map(sorted) : value !== null && typeof value === 'object'
    ? Object.fromEntries(Object.keys(value).sort().map(key => [key, sorted(value[key])])) : value;
  assert.equal(result.stdout, `${JSON.stringify(sorted(packet))}\n`);
  assert.deepEqual(Object.keys(packet).sort(), ['authority', 'coverage', 'gid', 'observerPid', 'parentPid',
    'processes', 'rootDev', 'rootIno', 'schema', 'uid'].sort());
  assert.equal(packet.schema, 'setfarm.dashboard-cutover-root-fd-diagnostic.v2');
  assert.equal(packet.authority, 'diagnostic-only');
  assert.equal(packet.coverage, 'requested-process-vnode-fds');
  assert.equal(packet.uid, process.getuid());
  assert.equal(packet.gid, process.getgid());
  assert.equal(packet.parentPid, process.pid);
  assert.equal(packet.observerPid, result.pid);
  assert.equal(packet.rootDev, String(f.original.dev));
  assert.equal(packet.rootIno, String(f.original.ino));
  assert.deepEqual(packet.processes.map(p => p.pid), [...pids].sort((a, b) => a - b));
  for (const p of packet.processes) {
    assert.deepEqual(Object.keys(p).sort(), ['pid', 'ppid', 'uid', 'gid', 'pgid', 'startSeconds',
      'startMicroseconds', 'fds', 'rootFds'].sort());
    assert.equal(p.uid, process.getuid()); assert.equal(p.gid, process.getgid());
    assert.ok(p.ppid > 0 && p.pgid > 0 && p.startSeconds > 0);
    assert.ok(Number.isInteger(p.startMicroseconds) && p.startMicroseconds >= 0 && p.startMicroseconds < 1000000);
    assert.deepEqual(p.fds.map(v => v.fd), [...new Set(p.fds.map(v => v.fd))].sort((a, b) => a - b));
    for (const entry of p.fds) {
      assert.deepEqual(Object.keys(entry).sort(), ['fd', 'type']);
      assert.ok(Number.isInteger(entry.fd) && entry.fd >= 0);
      assert.ok([0, 1, 2, 3, 4, 5, 6, 7, 9, 10, 11].includes(entry.type));
    }
    for (const entry of p.rootFds) {
      assert.deepEqual(Object.keys(entry).sort(), ['dev', 'fd', 'gid', 'ino', 'mode', 'nlink', 'uid']);
      assert.equal(entry.dev, String(f.original.dev)); assert.equal(entry.ino, String(f.original.ino));
      assert.equal(entry.mode, f.original.mode); assert.equal(entry.uid, f.original.uid);
      assert.equal(entry.gid, f.original.gid); assert.equal(entry.nlink, f.original.nlink);
      assert.ok(p.fds.some(v => v.fd === entry.fd && v.type === 1));
    }
  }
  assert.ok(packet.processes.find(p => p.pid === process.pid).rootFds.some(v => v.fd === f.fd));
  assert.equal(fs.fstatSync(f.fd, { bigint: true }).ino, f.original.ino);
  return packet;
}
async function refused(input, f) {
  const result = await invoke(input, f);
  assert.equal(result.status, 1, result.stderr);
  assert.equal(result.stdout, '');
  assert.equal(result.stderr, refusal);
}

// A real cooperative child, never an OS/backend policy double. All returned
// fixture FDs remain held until stdin EOF or an explicit fixture-only close.
const childSource = `
const fs = require('node:fs');
const readline = require('node:readline');
const root = process.argv[2];
let originals = [fs.openSync(root, fs.constants.O_RDONLY | fs.constants.O_DIRECTORY | fs.constants.O_NOFOLLOW)];
const snapshot = originals.map(fd => { const s = fs.fstatSync(fd, { bigint: true }); return { fd, dev: String(s.dev), ino: String(s.ino) }; });
const close = () => { for (const fd of originals) { fs.closeSync(fd); try { fs.fstatSync(fd); throw new Error('still open'); } catch (e) { if (e.code !== 'EBADF') throw e; } } originals = []; };
console.log(JSON.stringify({ kind: 'ready', pid: process.pid, snapshot }));
const input = readline.createInterface({ input: process.stdin });
input.on('line', line => { if (line !== 'close') throw new Error('unknown fixture command'); close(); console.log(JSON.stringify({ kind: 'closed' })); });
input.on('close', () => { close(); console.log(JSON.stringify({ kind: 'settled' })); });
`;
const inheritedSource = `
import json, os, sys
originals = [3, os.dup(3)]
snapshot = []
for fd in originals:
    s = os.fstat(fd)
    snapshot.append({'fd': fd, 'dev': str(s.st_dev), 'ino': str(s.st_ino)})
def close():
    while originals:
        fd = originals.pop()
        os.close(fd)
        try:
            os.fstat(fd)
        except OSError as e:
            if e.errno != 9:
                raise
        else:
            raise RuntimeError('still open')
print(json.dumps({'kind': 'ready', 'pid': os.getpid(), 'snapshot': snapshot}), flush=True)
for line in sys.stdin:
    if line != 'close\\n':
        raise RuntimeError('unknown fixture command')
    close()
    print(json.dumps({'kind': 'closed'}), flush=True)
close()
print(json.dumps({'kind': 'settled'}), flush=True)
`;
async function holder(t, f, mode = 'open', location = f.root) {
  const executable = mode === 'inherit' ? '/usr/bin/python3' : process.execPath;
  const args = mode === 'inherit' ? ['-I', '-S', '-B', '-c', inheritedSource] : ['-e', childSource, mode, location];
  const child = spawn(executable, args, {
    cwd: '/', env: environment, stdio: mode === 'inherit' ? ['pipe', 'pipe', 'pipe', f.fd] : ['pipe', 'pipe', 'pipe'],
  });
  let transportError, bytes = 0;
  const eof = { stdout: false, stderr: false };
  const closed = once(child, 'close');
  closed.catch(error => { transportError ??= error; });
  let stderr = ''; child.stderr.setEncoding('utf8'); child.stderr.on('data', data => {
    bytes += Buffer.byteLength(data); if (bytes > 1048576) { transportError ??= new Error('holder output cap'); return; } stderr += data;
  });
  child.stdin.on('error', error => { transportError ??= error; });
  child.stdout.setEncoding('utf8');
  for (const [stream, which] of [[child.stdout, 'stdout'], [child.stderr, 'stderr']]) {
    stream.on('end', () => { eof[which] = true; });
    stream.on('error', error => { transportError ??= error; });
  }
  const messages = []; let resolveMessage;
  let partial = '';
  child.stdout.on('data', data => {
    bytes += Buffer.byteLength(data); if (bytes > 1048576) { transportError ??= new Error('holder output cap'); partial = ''; return; }
    partial += data;
    let newline;
    while ((newline = partial.indexOf('\n')) !== -1) {
      const line = partial.slice(0, newline); partial = partial.slice(newline + 1);
      if (messages.length >= 3) { transportError ??= new Error('holder message cap'); continue; }
      try { messages.push(JSON.parse(line)); } catch (error) { transportError ??= error; continue; }
      if (resolveMessage) { const resolve = resolveMessage; resolveMessage = undefined; resolve(messages.shift()); }
    }
  });
  const bounded = async promise => {
    let timer; const deadline = new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('holder custody unknown: no settlement within10s')), 10000); });
    try { return await Promise.race([promise, deadline]); } finally { clearTimeout(timer); }
  };
  const next = () => bounded(messages.length ? Promise.resolve(messages.shift()) : new Promise(resolve => { resolveMessage = resolve; }));
  let settlement;
  const finish = () => settlement ??= (async () => {
    child.stdin.end();
    const [code, signal] = await bounded(closed);
    assert.equal(transportError, undefined, String(transportError));
    assert.equal(signal, null); assert.equal(code, 0, stderr); assert.equal(stderr, '');
    assert.deepEqual(eof, { stdout: true, stderr: true }); assert.equal(partial, '');
    assert.equal((await next()).kind, 'settled');
  })();
  f.settlers.push(finish);
  closed.then(([code, signal]) => { if (code !== 0 || signal !== null) t.diagnostic(`actual holder disposition code=${code} signal=${signal} stderr=${stderr}`); }, () => {});
  const ready = await next();
  assert.equal(ready.kind, 'ready'); assert.equal(ready.pid, child.pid);
  return { pid: child.pid, ready, finish, close: async () => {
    child.stdin.write('close\n'); assert.equal((await next()).kind, 'closed');
  } };
}

test('actual parent directory FD produces only a requested-process diagnostic', native, async t => {
  const f = fixture(t); await readReport(f);
});
test('actual distinct holder process retains its root FD after observation', native, async t => {
  const f = fixture(t); const h = await holder(t, f);
  const packet = await readReport(f, [process.pid, h.pid]);
  const child = packet.processes.find(p => p.pid === h.pid);
  assert.equal(child.ppid, process.pid);
  assert.deepEqual(child.rootFds.map(v => v.fd), h.ready.snapshot.map(v => v.fd));
});
test('actual inherited and duplicated descriptors remain separate inode matches', native, async t => {
  const f = fixture(t); const h = await holder(t, f, 'inherit');
  assert.equal(h.ready.snapshot.length, 2);
  for (const entry of h.ready.snapshot) assert.equal(entry.ino, String(f.original.ino));
  const child = (await readReport(f, [process.pid, h.pid])).processes.find(p => p.pid === h.pid);
  assert.deepEqual(child.rootFds.map(v => v.fd), h.ready.snapshot.map(v => v.fd).sort((a, b) => a - b));
});
test('neighbour inode is not silently promoted to a root match', native, async t => {
  const f = fixture(t); const neighbour = path.join(f.directory, 'neighbour'); fs.mkdirSync(neighbour, { mode: 0o700 });
  const h = await holder(t, f, 'open', neighbour);
  assert.notEqual(h.ready.snapshot[0].ino, String(f.original.ino));
  assert.deepEqual((await readReport(f, [process.pid, h.pid])).processes.find(p => p.pid === h.pid).rootFds, []);
});
test('renamed but held root remains an inode-only match', native, async t => {
  const f = fixture(t); const h = await holder(t, f);
  fs.renameSync(f.root, `${f.root}.held`);
  assert.throws(() => fs.lstatSync(f.root), { code: 'ENOENT' });
  assert.ok((await readReport(f, [process.pid, h.pid])).processes.find(p => p.pid === h.pid).rootFds.length > 0);
});
test('closed fixture root FD is absent from a fresh diagnostic, not death authority', native, async t => {
  const f = fixture(t); const h = await holder(t, f); await h.close();
  assert.deepEqual((await readReport(f, [process.pid, h.pid])).processes.find(p => p.pid === h.pid).rootFds, []);
});
test('actual naturally exited requested holder refuses the whole report', native, async t => {
  const f = fixture(t); const h = await holder(t, f); await h.finish();
  // This freshly exited owned PID is not a durable historical death witness.
  await refused(request(f, [process.pid, h.pid]), f);
});
test('nonmatching parent inode refuses even when requested PID is real', native, async t => {
  const f = fixture(t); const input = request(f); input.rootIno = '18446744073709551615'; await refused(input, f);
});
test('strict bounded canonical request refuses malformed fields without partial output', native, async t => {
  const f = fixture(t), good = request(f);
  for (const input of [
    { ...good, extra: true }, { ...good, rootDev: '01' }, { ...good, rootIno: 1 },
    { ...good, rootDev: '4294967296' }, { ...good, rootIno: '18446744073709551616' },
    { ...good, pids: [] }, { ...good, pids: [process.pid, process.pid] },
    { ...good, pids: [0, process.pid] }, { ...good, pids: [2147483648, process.pid] },
    { ...good, pids: [true, process.pid] }, { ...good, pids: [process.pid + 1] },
    { ...good, pids: Array.from({ length: 65 }, (_, i) => process.pid + i) },
  ]) await refused(input, f);
  for (const wire of [JSON.stringify(good), `${JSON.stringify(good)}\n`, `${canonical(good)} `,
    `${canonical(good)}${' '.repeat(65536)}`, '{"pids":[]}\n', Buffer.from([0xff, 0x0a]),
    canonical(good).replace('"pids":', '"pids":[],"pids":')]) await refused(wire, f);
});
