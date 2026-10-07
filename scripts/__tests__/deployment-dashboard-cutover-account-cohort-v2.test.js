import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const provider = fileURLToPath(new URL('../deployment-dashboard-cutover-account-cohort-v2.py', import.meta.url));
const environment = { PATH: '/usr/bin:/bin', LANG: 'C', LC_ALL: 'C' };
const native = { skip: process.platform !== 'darwin', timeout: 20000 };
const schema = 'setfarm.dashboard-cutover-account-cohort-request.v2';
const request = `{"schema":"${schema}"}\n`;
const refusal = 'DASHBOARD_ACCOUNT_COHORT_DIAGNOSTIC_REFUSED\n';
async function bounded(promise) {
  let timer;
  const timeout = new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('process custody unknown after10s; never signal/retry')), 10000); });
  try { return await Promise.race([promise, timeout]); } finally { clearTimeout(timer); }
}
function custody(child) {
  let stdout = '', stderr = '', bytes = 0, error;
  const eof = { stdout: false, stderr: false };
  for (const [stream, name] of [[child.stdout, 'stdout'], [child.stderr, 'stderr']]) {
    stream.setEncoding('utf8');
    stream.on('data', data => {
      bytes += Buffer.byteLength(data);
      if (bytes > 1048576) { error ??= new Error('output exceeds1MiB'); return; }
      if (name === 'stdout') stdout += data; else stderr += data;
    });
    stream.on('error', value => { error ??= value; });
    stream.on('end', () => { eof[name] = true; });
  }
  child.stdin.on('error', value => { error ??= value; });
  const close = once(child, 'close');
  close.catch(value => { error ??= value; });
  const settle = async () => {
    const [status, signal] = await bounded(close);
    assert.equal(error, undefined, String(error)); assert.equal(signal, null);
    assert.deepEqual(eof, { stdout: true, stderr: true });
    return { pid: child.pid, status, stdout, stderr };
  };
  return { settle };
}
async function invoke(input = request) {
  const child = spawn('/usr/bin/python3', ['-I', '-S', '-B', provider], {
    cwd: '/', env: environment, stdio: ['pipe', 'pipe', 'pipe'],
  });
  const owned = custody(child);
  child.stdin.end(input);
  return await owned.settle();
}
const identityKeys = ['pid', 'ppid', 'uid', 'gid', 'ruid', 'rgid', 'savedUid', 'savedGid',
  'pgid', 'startSeconds', 'startMicroseconds'];
const sampleKeys = [...identityKeys, 'status', 'inExit', 'exitStatus'].sort();
const sorted = value => Array.isArray(value) ? value.map(sorted) : value !== null && typeof value === 'object'
  ? Object.fromEntries(Object.keys(value).sort().map(key => [key, sorted(value[key])])) : value;
async function report() {
  const result = await invoke();
  assert.equal(result.status, 0, result.stderr); assert.equal(result.stderr, '');
  const packet = JSON.parse(result.stdout);
  assert.equal(result.stdout, `${JSON.stringify(sorted(packet))}\n`);
  assert.deepEqual(Object.keys(packet).sort(), ['schema', 'authority', 'coverage', 'uid', 'gid',
    'observerPid', 'parentPid', 'processes'].sort());
  assert.equal(packet.schema, 'setfarm.dashboard-cutover-account-cohort-diagnostic.v2');
  assert.equal(packet.authority, 'diagnostic-only');
  assert.equal(packet.coverage, 'sampled-effective-uid-process-metadata');
  assert.equal(packet.uid, process.getuid()); assert.equal(packet.gid, process.getgid());
  assert.equal(packet.observerPid, result.pid); assert.equal(packet.parentPid, process.pid);
  assert.ok(packet.processes.length > 0 && packet.processes.length <= 1024);
  const pids = packet.processes.map(p => p.first.pid);
  assert.deepEqual(pids, [...new Set(pids)].sort((a, b) => a - b));
  assert.ok(pids.includes(result.pid) && pids.includes(process.pid));
  for (const p of packet.processes) {
    assert.deepEqual(Object.keys(p).sort(), ['first', 'last']);
    for (const sample of [p.first, p.last]) {
      assert.deepEqual(Object.keys(sample).sort(), sampleKeys);
      assert.equal(sample.uid, process.getuid()); assert.ok([2, 3, 4, 5].includes(sample.status));
      assert.equal(typeof sample.inExit, 'boolean');
      for (const key of sampleKeys.filter(key => key !== 'inExit')) assert.ok(Number.isSafeInteger(sample[key]) && sample[key] >= 0);
      for (const key of sampleKeys.filter(key => key !== 'inExit' && key !== 'startSeconds')) assert.ok(sample[key] <= 4294967295);
      assert.ok(sample.pid > 0 && sample.pid <= 2147483647);
      assert.ok(sample.startSeconds > 0 && sample.startMicroseconds < 1000000);
      if (sample.status !== 5) assert.ok(sample.ppid > 0 && sample.pgid > 0);
    }
    for (const key of identityKeys) assert.equal(p.first[key], p.last[key]);
  }
  const parent = packet.processes.find(p => p.first.pid === process.pid);
  assert.equal(parent.first.ppid, process.ppid); assert.equal(parent.first.gid, process.getgid());
  const observer = packet.processes.find(p => p.first.pid === result.pid);
  assert.equal(observer.first.ppid, process.pid);
  return packet;
}
async function holder(t) {
  const birthLowerSeconds = Math.floor(Date.now() / 1000) - 1;
  const child = spawn(process.execPath, ['-e', `
console.log(JSON.stringify({ kind: 'ready', pid: process.pid, uid: process.getuid(), gid: process.getgid(), ppid: process.ppid }));
process.stdin.resume();
process.stdin.once('end', () => console.log(JSON.stringify({ kind: 'settled' })));
`], { cwd: '/', env: environment, stdio: ['pipe', 'pipe', 'pipe'] });
  const owned = custody(child);
  let partial = '', bytes = 0, parseError, resolveReady, ready;
  const readiness = new Promise(resolve => { resolveReady = resolve; });
  child.stdout.on('data', data => {
    bytes += Buffer.byteLength(data);
    if (bytes > 1048576) { parseError ??= new Error('holder readiness output exceeds1MiB'); partial = ''; return; }
    partial += data;
    let newline;
    while ((newline = partial.indexOf('\n')) !== -1) {
      const line = partial.slice(0, newline); partial = partial.slice(newline + 1);
      try {
        const value = JSON.parse(line);
        if (value.kind === 'ready' && ready === undefined) { ready = value; resolveReady(value); }
      } catch (error) { parseError ??= error; }
    }
  });
  let settlement;
  const finish = () => settlement ??= (async () => {
    child.stdin.end(); const result = await owned.settle();
    assert.equal(parseError, undefined, String(parseError)); assert.equal(partial, '');
    assert.equal(result.status, 0, result.stderr); assert.equal(result.stderr, '');
    const messages = result.stdout.trim().split('\n').map(line => JSON.parse(line));
    assert.deepEqual(messages.map(m => m.kind), ['ready', 'settled']);
  })();
  t.after(finish);
  const value = await bounded(readiness);
  assert.equal(value.pid, child.pid); assert.equal(value.uid, process.getuid());
  assert.equal(value.gid, process.getgid()); assert.equal(value.ppid, process.pid);
  return { pid: child.pid, finish, birthLowerSeconds, birthUpperSeconds: Math.floor(Date.now() / 1000) + 1 };
}

test('actual UID cohort reports parent and observer without completeness authority', native, async () => {
  await report();
});
test('real owned holder appears with bracketed account and birth identity', native, async t => {
  const h = await holder(t); const packet = await report();
  const found = packet.processes.find(p => p.first.pid === h.pid); assert.ok(found);
  assert.equal(found.first.ppid, process.pid); assert.equal(found.first.uid, process.getuid());
  assert.equal(found.first.gid, process.getgid());
  assert.ok(found.first.startSeconds >= h.birthLowerSeconds && found.first.startSeconds <= h.birthUpperSeconds);
});
test('naturally settled holder compares fresh cohorts only, never certifies historical death', native, async t => {
  const h = await holder(t); const before = await report();
  const old = before.processes.find(p => p.first.pid === h.pid); assert.ok(old);
  await h.finish();
  const after = await report();
  const current = after.processes.find(p => p.first.pid === h.pid);
  if (current) assert.notDeepEqual([current.first.startSeconds, current.first.startMicroseconds],
    [old.first.startSeconds, old.first.startMicroseconds], 'never merge reused PID generations');
});
test('schema-only bounded canonical wire rejects policy and scope inputs', native, async () => {
  const invalid = [request.trimEnd(), ` ${request}`, `${request}\n`, '{"schema":"wrong"}\n',
    `{"schema":"${schema}","uid":${process.getuid()}}\n`,
    `{"schema":"${schema}","pids":[${process.pid}]}\n`,
    `{"schema":"${schema}","schema":"${schema}"}\n`,
    Buffer.from([0xff, 0x0a]), `${request}${' '.repeat(65537 - Buffer.byteLength(request))}`];
  for (const input of invalid) {
    const result = await invoke(input);
    assert.equal(result.status, 1, result.stderr); assert.equal(result.stdout, ''); assert.equal(result.stderr, refusal);
  }
});
