import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { buildSubscriptionAttemptLaunchMaterialV1 as build } from '../../src/execution/subscription-attempt-launch-material-v1.js';
import type { SubscriptionAttemptBrokerWorkerV1 } from '../../src/execution/subscription-attempt-broker-v1.js';

function fixture(modelRef: SubscriptionAttemptBrokerWorkerV1['modelRef'] = 'kimi/k3.1-pro') {
  const identity = { attemptId: 'ATT_fixture_1', generationId: 'generation_1', modelRef };
  const kimi = modelRef === 'kimi/k3.1-pro';
  const worker: SubscriptionAttemptBrokerWorkerV1 = { ...identity, providerId: kimi ? 'kimi' : 'minimax',
    modelId: kimi ? 'k3.1-pro' : 'MiniMax-M3.1-Flash', baseUrl: 'http://127.0.0.1:49157/v1',
    api: 'anthropic-messages', apiKey: 'A'.repeat(43), auth: 'api-key', authHeader: true };
  return { identity, worker, root: '/private/tmp/owned adapter fixture', prompt: 'Read the owned nonce.' };
}
function expectedConfig(root: string, p: string, m: string, q: string) {
  return {
    logging: { level: 'silent', consoleLevel: 'error', file: root + '/openclaw.log' },
    diagnostics: { enabled: false, otel: { enabled: false }, cacheTrace: { enabled: false } },
    update: { checkOnStart: false, auto: { enabled: false } }, proxy: { enabled: false }, plugins: { enabled: false },
    acp: { enabled: false, dispatch: { enabled: false } },
    models: { mode: 'replace', pricing: { enabled: false }, providers: {
      [p]: { baseUrl: 'http://127.0.0.1:49157/v1', api: 'anthropic-messages', auth: 'api-key', authHeader: true,
        apiKey: 'A'.repeat(43), agentRuntime: { id: 'pi' }, request: { allowPrivateNetwork: true },
        models: [{ id: m, name: m, reasoning: true, input: ['text'], contextWindow: 200000, maxTokens: 2048,
          agentRuntime: { id: 'pi' } }] } } },
    agents: { defaults: { timeFormat: '24', agentRuntime: { id: 'pi' }, model: { primary: q, fallbacks: [] },
      models: { [q]: { agentRuntime: { id: 'pi' } } }, workspace: root + '/work', skipBootstrap: true, skills: [],
      startupContext: { enabled: false }, memorySearch: { enabled: false }, timeoutSeconds: 20, maxConcurrent: 1 },
      list: [{ id: 'subscription-worker', default: true, workspace: root + '/work',
        agentDir: root + '/state/agents/subscription-worker/agent', model: { primary: q, fallbacks: [] }, skills: [] }] },
    tools: { allow: ['read'], fs: { workspaceOnly: true }, web: { search: { enabled: false }, fetch: { enabled: false } },
      agentToAgent: { enabled: false }, elevated: { enabled: false } },
  };
}
function frozen(value: unknown): void {
  if (value && typeof value === 'object') {
    assert.ok(Object.isFrozen(value)); for (const child of Object.values(value)) frozen(child);
  }
}
function expectedMaterial(input: ReturnType<typeof fixture>) {
  const r = input.root, q = input.identity.modelRef;
  const p = q === 'kimi/k3.1-pro' ? 'kimi' : 'minimax', m = p === 'kimi' ? 'k3.1-pro' : 'MiniMax-M3.1-Flash';
  const digest = createHash('sha256').update(JSON.stringify(['ATT_fixture_1', 'generation_1', q])).digest('hex');
  return {
    schema: 'setfarm.subscription-attempt-launch-material.v1', profile: 'private-headless-readonly-v1',
    identity: { attemptId: 'ATT_fixture_1', generationId: 'generation_1', modelRef: q }, sessionId: 'sfsub-' + digest,
    cwd: r + '/work', directories: ['home', 'state', 'state/agents', 'state/agents/subscription-worker',
      'state/agents/subscription-worker/agent', 'state/agents/main', 'state/agents/main/agent', 'xdg', 'xdg/config',
      'xdg/cache', 'xdg/data', 'xdg/state', 'tmp', 'work'].map(p => r + '/' + p),
    env: { HOME: r + '/home', OPENCLAW_HOME: r + '/home', OPENCLAW_STATE_DIR: r + '/state',
      OPENCLAW_CONFIG_PATH: r + '/config.json', PI_CODING_AGENT_DIR: r + '/state/agents/subscription-worker/agent',
      XDG_CONFIG_HOME: r + '/xdg/config', XDG_CACHE_HOME: r + '/xdg/cache', XDG_DATA_HOME: r + '/xdg/data',
      XDG_STATE_HOME: r + '/xdg/state', TMPDIR: r + '/tmp', TMP: r + '/tmp', TEMP: r + '/tmp', PATH: '/usr/bin:/bin',
      LANG: 'en_US.UTF-8', TZ: 'UTC', NO_COLOR: '1', NODE_DISABLE_COMPILE_CACHE: '1', OPENCLAW_NO_RESPAWN: '1',
      OPENCLAW_PATH_BOOTSTRAPPED: '1', OPENCLAW_LOG_LEVEL: 'silent', OPENCLAW_AUTH_STORE_READONLY: '1', OPENCLAW_TRAJECTORY: 'false' },
    argv: ['agent', '--local', '--json', '--agent', 'subscription-worker', '--session-id',
      'sfsub-' + digest, '--message', input.prompt, '--timeout', '20'],
    files: [ { path: r + '/config.json', mode: 0o600, contents: JSON.stringify(expectedConfig(r, p, m, q), null, 2) + '\n' },
      ...['subscription-worker', 'main'].map(id => ({ path: r + '/state/agents/' + id + '/agent/auth-profiles.json',
        mode: 0o600, contents: '{\n  "version": 1,\n  "profiles": {}\n}\n' })), ],
  };
}
for (const q of ['kimi/k3.1-pro', 'minimax/MiniMax-M3.1-Flash'] as const) {
  test(`only capability enters complete readonly projection: ${q}`, () => {
    const input = fixture(q), value = build(input);
    assert.deepEqual(value, expectedMaterial(input));
    assert.ok(!JSON.stringify([value.argv, value.env, value.files.slice(1)]).includes(input.worker.apiKey));
    frozen(value); const snapshot = JSON.stringify(value);
    input.identity.attemptId = 'mutated'; input.worker = { ...input.worker, apiKey: 'B'.repeat(43) }; input.root = '/elsewhere';
    assert.equal(JSON.stringify(value), snapshot);
  });
}

test('exact data validation rejects malformed launch inputs without getters or coercion', () => {
  let calls = 0;
  const bad: unknown[] = [null, [], { ...fixture(), extra: 1 }, { ...fixture(), credential: 'synthetic-secret' }];
  for (const patch of [{ attemptId: '' }, { attemptId: '../x' }, { generationId: 'x'.repeat(129) },
    { generationId: 'other' }, { modelRef: 'kimi/other' }, { providerKey: 'synthetic-secret' }]) {
    bad.push({ ...fixture(), identity: { ...fixture().identity, ...patch } });
  }
  for (const patch of [{ attemptId: 'different' }, { generationId: 'different' }, { modelRef: 'minimax/MiniMax-M3.1-Flash' },
    { providerId: 'minimax' }, { modelId: 'wrong' }, { api: 'other' }, { auth: 'bearer' }, { authHeader: false },
    { apiKey: 'A'.repeat(42) }, { apiKey: '+'.repeat(43) }, { credential: 'synthetic-secret' }]) {
    bad.push({ ...fixture(), worker: { ...fixture().worker, ...patch } });
  }
  for (const url of ['http://localhost:49157/v1', 'http://127.0.0.1:049157/v1', 'http://127.0.0.1:0/v1',
    'http://127.0.0.1:65536/v1', ...[3080,3333,18789].map(p => `http://127.0.0.1:${p}/v1`),
    'https://127.0.0.1:49157/v1', 'http://x@127.0.0.1:49157/v1', 'http://127.0.0.1:49157/v1/',
    'http://127.0.0.1:49157/v1?a', 'http://127.0.0.1:49157/v1#x', 'http://[::1]:49157/v1']) {
    bad.push({ ...fixture(), worker: { ...fixture().worker, baseUrl: url } });
  }
  for (const root of ['', '/', 'relative', '//a', '/a//b', '/a/../b', '/a/./b', '/a/', '/a\\b', '/a\u007f', '/a\n', '/' + 'a'.repeat(1024)]) bad.push({ ...fixture(), root });
  for (const prompt of ['', 'a\0b', 'a'.repeat(65537), 'é'.repeat(32769), { toString() { calls++; return 'x'; } }]) bad.push({ ...fixture(), prompt });
  bad.push(Object.assign(fixture(), { [Symbol('extra')]: 1 }));
  bad.push(Object.defineProperty(fixture(), 'prompt', { get() { calls++; return 'x'; } }));
  bad.push({ ...fixture(), identity: Object.assign(Object.create({}), fixture().identity) });
  bad.push({ ...fixture(), worker: Object.assign(fixture().worker, { toJSON() { calls++; return {}; } }) });
  bad.push(new Proxy({}, { getPrototypeOf() { throw new Error('synthetic-secret'); } }));
  const revoked = Proxy.revocable({}, {}); revoked.revoke(); bad.push(revoked.proxy);
  for (const value of bad) assert.throws(() => build(value as never), { message: 'SUBSCRIPTION_LAUNCH_INPUT_INVALID' });
  assert.equal(calls, 0);
});
test('null-prototype data and prompt byte boundary work without retaining caller references', () => {
  const f = fixture();
  const value = build(Object.assign(Object.create(null), f, { identity: Object.assign(Object.create(null), f.identity),
    worker: Object.assign(Object.create(null), f.worker), prompt: 'é'.repeat(32768) }));
  assert.equal(value.argv[8], 'é'.repeat(32768));
});

function child(script: string, poison = false) {
  const env: NodeJS.ProcessEnv = { HOME: process.env.HOME, TMPDIR: process.env.TMPDIR, PATH: process.env.PATH,
    LANG: 'en_US.UTF-8', TZ: 'UTC', NODE_DISABLE_COMPILE_CACHE: '1', TSX_DISABLE_CACHE: '1', NODE_OPTIONS: '' };
  if (poison) for (const key of ['KIMI_API_KEY', 'MINIMAX_API_KEY', 'ANTHROPIC_API_KEY', 'HTTP_PROXY', 'HTTPS_PROXY',
    'SETFARM_PG_URL', 'OPENCLAW_CONFIG_PATH']) env[key] = 'FAKE_PARENT_SECRET_"' + key;
  const result = spawnSync(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', script],
    { encoding: 'utf8', env, timeout: 10000 });
  assert.equal(result.error, undefined); assert.equal(result.signal, null); assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
}
test('ambient provider, proxy, shared config and NODE_OPTIONS data cannot enter launch projection', () => {
  const f = fixture(), expected = expectedMaterial(f);
  assert.equal(child(`import assert from 'node:assert/strict';
    import { buildSubscriptionAttemptLaunchMaterialV1 as build } from './src/execution/subscription-attempt-launch-material-v1.ts';
    process.env.NODE_OPTIONS = 'FAKE_PARENT_SECRET_NODE_OPTIONS';
    const value = build(${JSON.stringify(f)}); assert.deepEqual(value, ${JSON.stringify(expected)});
    const output = JSON.stringify(value);
    for (const [key, raw] of Object.entries(process.env)) if (raw && raw.includes('FAKE_PARENT_SECRET')) {
      for (const s of [raw, JSON.stringify(raw).slice(1,-1), encodeURIComponent(raw), Buffer.from(raw).toString('base64')]) assert.ok(!output.includes(s));
    } console.log('POISON_ISOLATED');`, true), 'POISON_ISOLATED');
});
test('both module imports are inert under trapped effects and profile reads', () => {
  assert.equal(child(`import assert from 'node:assert/strict'; import http from 'node:http'; import https from 'node:https';
    import net from 'node:net'; import fs from 'node:fs'; import fsp from 'node:fs/promises';
    import cp from 'node:child_process'; import { syncBuiltinESMExports } from 'node:module';
    const before = JSON.stringify(process.env); const fail = () => { throw new Error('IMPORT_SIDE_EFFECT'); };
    http.createServer=fail; http.request=fail; http.get=fail; https.request=fail; https.get=fail; net.connect=fail; net.createConnection=fail;
    for (const k of ['spawn','spawnSync','exec','execSync','execFile','execFileSync','fork']) cp[k]=fail;
    for (const k of ['writeFileSync','appendFileSync','mkdirSync','renameSync','unlinkSync','rmSync']) fs[k]=fail;
    for (const k of ['writeFile','appendFile','mkdir','rename','unlink','rm']) { fs[k]=fail; fsp[k]=fail; }
    const suspicious = p => typeof p === 'string' && /auth-profiles|credentials|config\\.json|\\.env/.test(p);
    const read = fs.readFileSync; fs.readFileSync = function(p,...args) { if(suspicious(p)) fail(); return read.call(this,p,...args); };
    const readAsync = fsp.readFile; fsp.readFile = function(p,...args) { if(suspicious(p)) fail(); return readAsync.call(this,p,...args); };
    syncBuiltinESMExports();
    await import('./src/execution/subscription-attempt-launch-material-v1.ts');
    await import('./src/execution/subscription-attempt-custody-v1.ts');
    assert.equal(JSON.stringify(process.env),before); console.log('INERT');`), 'INERT');
});
