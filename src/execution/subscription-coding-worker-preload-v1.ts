/** Fixed ESM --import program. Top-level await completes probes and the FD3
 * parent gate before Node evaluates the pinned SDK CLI entry. No listener. */
export const SUBSCRIPTION_CODING_WORKER_PRELOAD_V1 = String.raw`
import fs from 'node:fs';
import net from 'node:net';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const fail = () => { process.exit(97); };
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const exact = (value, keys) => value !== null && typeof value === 'object' && !Array.isArray(value)
  && Object.keys(value).length === keys.length && Object.keys(value).every(key => keys.includes(key));
const denial = error => error && (error.code === 'EPERM' || error.code === 'EACCES') ? error.code : 'ambiguous';
let deadline = performance.now() + 9000;
let timer = setTimeout(fail, 9000);
const timely = () => { if (performance.now() >= deadline) fail(); };
const channel = new net.Socket({ fd: 3, readable: true, writable: false });
let pending = Buffer.alloc(0), received = 0, waiting, queued = [], frames = 0, proofSent = false, openAccepted = false;
channel.on('error', fail);
// This remains active after the CLI gate: parent FD3 closure ends the worker.
channel.on('end', fail);
channel.on('close', fail);
channel.on('data', chunk => {
  if (openAccepted) fail();
  received += chunk.length;
  if (received > 16384) fail();
  pending = Buffer.concat([pending, chunk]);
  let newline;
  while ((newline = pending.indexOf(10)) !== -1) {
    if (++frames > 3 || (frames >= 2 && !proofSent)) fail();
    const bytes = pending.subarray(0, newline); pending = pending.subarray(newline + 1);
    let value;
    try { value = JSON.parse(bytes.toString('utf8')); } catch { fail(); }
    if (JSON.stringify(value) !== bytes.toString('utf8')) fail();
    if (waiting) { const accept = waiting; waiting = undefined; accept(value); }
    else queued.push(value);
  }
});
const next = () => queued.length ? Promise.resolve(queued.shift()) : new Promise(resolve => { waiting = resolve; });
const write = frame => {
  const bytes = Buffer.from(JSON.stringify(frame) + '\n');
  if (bytes.length > 8192) fail();
  let offset = 0;
  while (offset < bytes.length) {
    const written = fs.writeSync(4, bytes, offset, bytes.length - offset);
    if (written <= 0) fail(); offset += written;
  }
};
function deniedOpen(path, flags) {
  let fd;
  try { fd = fs.openSync(path, flags); return 'allowed'; }
  catch (error) { return denial(error); }
  finally { if (fd !== undefined) fs.closeSync(fd); }
}
function deniedSpawn(executable, argv) {
  return new Promise(resolve => {
    let child, done = false, exited = false;
    const finish = result => { if (done) return; done = true; clearTimeout(deadline); resolve(result); };
    const deadline = setTimeout(() => {
      if (child && !exited) { try { child.kill('SIGKILL'); } catch {} }
      finish('ambiguous');
    }, 1000);
    try {
      child = spawn(executable, argv, { shell: false, env: { ...process.env }, stdio: 'ignore' });
      child.once('error', error => finish(denial(error)));
      child.once('exit', () => { exited = true; });
      child.once('close', () => finish('allowed'));
    } catch (error) { finish(denial(error)); }
  });
}
function connect(host, port, positive) {
  return new Promise(resolve => {
    let done = false;
    const socket = net.createConnection({ host, port });
    const finish = result => {
      if (done) return; done = true; clearTimeout(deadline); socket.destroy(); resolve(result);
    };
    const deadline = setTimeout(() => finish('ambiguous'), 1000);
    socket.once('connect', () => finish(positive ? 'connected' : 'allowed'));
    socket.once('error', error => finish(denial(error)));
  });
}
try {
  const challenge = await next();
  timely();
  const bindingKeys = ['nonce', 'pid', 'identity', 'materialHash', 'policyHash', 'preloadHash'];
  if (!exact(challenge, ['schema', 'type', ...bindingKeys, 'profilePath', 'preloadPath', 'credentialProbePath', 'authorityProbePath', 'authorityProbeHash',
    'brokerPort', 'nodePath', 'argvHash', 'environmentHash', 'files'])
    || challenge.schema !== 'setfarm.subscription-coding-challenge.v1' || challenge.type !== 'challenge'
    || challenge.pid !== process.pid || challenge.nodePath !== process.execPath
    || !['nonce', 'materialHash', 'policyHash', 'preloadHash', 'argvHash', 'environmentHash', 'authorityProbeHash'].every(key =>
      typeof challenge[key] === 'string' && /^[a-f0-9]{64}$/.test(challenge[key]))
    || !exact(challenge.identity, ['attemptId', 'generationId', 'modelRef'])
    || !Number.isInteger(challenge.brokerPort) || challenge.brokerPort < 1 || challenge.brokerPort > 65535
    || [3080, 3333, 18789].includes(challenge.brokerPort)
    || !Array.isArray(challenge.files) || (challenge.files.length !== 3 && challenge.files.length !== 5)
    || challenge.preloadPath !== fileURLToPath(import.meta.url)
    || challenge.authorityProbePath !== challenge.profilePath
    || challenge.authorityProbeHash !== challenge.policyHash) fail();
  if (challenge.files.length === 5) {
    const root = challenge.profilePath.slice(0, -'/profile.sb'.length);
    const suffixes = ['/config.json', '/state/agents/subscription-worker/agent/auth-profiles.json',
      '/state/agents/main/agent/auth-profiles.json', '/scoped-files/openclaw.plugin.json', '/scoped-files/index.mjs'];
    if (challenge.profilePath !== root + '/profile.sb'
      || challenge.files.some((file, index) => file.path !== root + suffixes[index])) fail();
  }
  const binding = Object.fromEntries(bindingKeys.map(key => [key, challenge[key]]));
  if (hash(fs.readFileSync(fileURLToPath(import.meta.url))) !== challenge.preloadHash
    || hash(fs.readFileSync(challenge.profilePath)) !== challenge.policyHash
    || hash(JSON.stringify(process.argv.slice(1))) !== challenge.argvHash
    || hash(JSON.stringify(Object.fromEntries(Object.entries(process.env).sort(([a], [b]) => a.localeCompare(b))))) !== challenge.environmentHash) fail();
  for (const file of challenge.files) {
    if (!exact(file, ['path', 'hash']) || typeof file.path !== 'string' || !/^[a-f0-9]{64}$/.test(file.hash)
      || hash(fs.readFileSync(file.path)) !== file.hash) fail();
  }
  const results = {
    credentialRead: deniedOpen(challenge.credentialProbePath, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW | fs.constants.O_NONBLOCK),
    // Existing pinned protected profile; no O_CREAT/TRUNC and no write call.
    authorityWrite: deniedOpen(challenge.authorityProbePath, fs.constants.O_WRONLY | fs.constants.O_NOFOLLOW | fs.constants.O_NONBLOCK),
    sameNodeSpawn: await deniedSpawn(process.execPath, ['--eval', 'process.exit(73)']),
    nonPinnedExec: await deniedSpawn('/usr/bin/true', []),
    publicConnect: await connect('192.0.2.1', 443, false),
    loopbackConnect: await connect('127.0.0.1', challenge.brokerPort === 9 ? 10 : 9, false),
    brokerConnect: await connect('127.0.0.1', challenge.brokerPort, true),
  };
  if (hash(fs.readFileSync(challenge.authorityProbePath)) !== challenge.authorityProbeHash) fail();
  if (results.brokerConnect !== 'connected' || Object.entries(results).some(([key, value]) =>
    key !== 'brokerConnect' && value !== 'EPERM' && value !== 'EACCES')) fail();
  timely();
  if (pending.length || queued.length) fail();
  write({ schema: 'setfarm.subscription-coding-probe.v1', type: 'proof', ...binding, results });
  proofSent = true;
  let gate = await next();
  timely();
  if (pending.length || queued.length) fail();
  if (JSON.stringify(gate) === JSON.stringify({
    schema: 'setfarm.subscription-coding-gate.v1', type: 'owner-admission-wait', ...binding })) {
    deadline = performance.now() + 120000;
    clearTimeout(timer); timer = setTimeout(fail, 120000);
    write({ schema: 'setfarm.subscription-coding-probe.v1', type: 'owner-admission-waiting', ...binding });
    gate = await next();
    timely();
    // Only the optional authenticated wait starts a fresh short OPENED phase.
    deadline = performance.now() + 9000;
    clearTimeout(timer); timer = setTimeout(fail, 9000);
  }
  if (pending.length || queued.length || JSON.stringify(gate) !== JSON.stringify({
    schema: 'setfarm.subscription-coding-gate.v1', type: 'open', ...binding })) fail();
  timely();
  openAccepted = true;
  write({ schema: 'setfarm.subscription-coding-probe.v1', type: 'opened', ...binding });
  timely();
  clearTimeout(timer);
  // Lifetime EOF stays observed while CLI work is active, without keeping a
  // naturally completed CLI alive solely because its parent still owns FD3.
  channel.unref();
} catch { fail(); }
`;
