import assert from 'node:assert/strict';
import test from 'node:test';
import type { SubscriptionModelRefV1 } from '../../src/execution/subscription-coding-policy-v1.js';
import { buildSubscriptionAttemptLaunchMaterialV1 as buildReadonly } from '../../src/execution/subscription-attempt-launch-material-v1.js';
import type { SubscriptionAttemptBrokerWorkerV1 } from '../../src/execution/subscription-attempt-broker-v1.js';
import { validateSubscriptionCodingWorkerMaterialV1 } from '../../src/execution/subscription-coding-worker-policy-v1.js';

let api: typeof import('../../src/execution/subscription-coding-policy-v1.js') | undefined;
try {
  api = await import('../../src/execution/subscription-coding-policy-v1.js');
} catch (error) {
  const missing = error as { code?: unknown; url?: unknown };
  const urls = ['.js', '.ts'].map(extension => new URL('../../src/execution/subscription-coding-policy-v1' + extension, import.meta.url).href);
  if (missing.code !== 'ERR_MODULE_NOT_FOUND' || !urls.includes(missing.url as string)) throw error;
}
const build = api?.buildSubscriptionCodingMaterialV1 as NonNullable<typeof api>['buildSubscriptionCodingMaterialV1'];
const SUBSCRIPTION_CODING_LIMITS_V1 = api?.SUBSCRIPTION_CODING_LIMITS_V1;

function fixture(modelRef: SubscriptionModelRefV1 = 'kimi/k3.1-pro') {
  const identity = { attemptId: 'ATT_coding_1', generationId: 'generation_1', modelRef };
  const kimi = modelRef === 'kimi/k3.1-pro';
  const worker: SubscriptionAttemptBrokerWorkerV1 = { ...identity, providerId: kimi ? 'kimi' : 'minimax',
    modelId: kimi ? 'k3.1-pro' : 'MiniMax-M3.1-Flash', baseUrl: 'http://127.0.0.1:49157/v1',
    api: 'anthropic-messages', apiKey: 'A'.repeat(43), auth: 'api-key', authHeader: true };
  return { identity, worker, root: '/private/tmp/coding private fixture',
    worktree: '/private/tmp/project fixture', prompt: 'Implement the complete inline claim in this workspace.' };
}
function readonlyInput(input: ReturnType<typeof fixture>) {
  return { identity: input.identity, worker: input.worker, root: input.root, prompt: input.prompt };
}
function frozen(value: unknown): void {
  if (value !== null && typeof value === 'object') {
    assert.ok(Object.isFrozen(value));
    for (const child of Object.values(value)) frozen(child);
  }
}

test('Kimi coding enables low thinking while MiniMax and readonly controls omit the default', () => {
  const input = fixture();
  const kimi = build(input), minimax = build(fixture('minimax/MiniMax-M3.1-Flash'));
  assert.equal(JSON.parse(kimi.files[0].contents).agents.defaults.thinkingDefault, 'low');
  assert.equal(Object.hasOwn(JSON.parse(minimax.files[0].contents).agents.defaults, 'thinkingDefault'), false);
  for (const modelRef of ['kimi/k3.1-pro', 'minimax/MiniMax-M3.1-Flash'] as const) {
    const control = buildReadonly(readonlyInput(fixture(modelRef)));
    assert.equal(Object.hasOwn(JSON.parse(control.files[0].contents).agents.defaults, 'thinkingDefault'), false);
  }
});

test('worker reconstruction accepts emitted Kimi material and refuses disabled thinking tampering', () => {
  const material = build(fixture());
  const checked = validateSubscriptionCodingWorkerMaterialV1(material);
  assert.deepEqual(checked.material, material);
  assert.notEqual(checked.material, material);
  const tampered = JSON.parse(JSON.stringify(material));
  const config = JSON.parse(tampered.files[0].contents);
  config.agents.defaults.thinkingDefault = 'off';
  tampered.files[0].contents = JSON.stringify(config, null, 2) + '\n';
  assert.throws(() => validateSubscriptionCodingWorkerMaterialV1(tampered),
    { message: 'SUBSCRIPTION_CODING_WORKER_REFUSED' });
});

test('fixed PLAN report DATA profile requests low thinking without changing model, limits or other launch material', () => {
  const input=fixture('minimax/MiniMax-M3.1-Flash'),normal=build(input);
  const plan=build({...input,requestProfile:'plan-report-v1'} as never);
  assert.deepEqual(plan.argv,[...normal.argv,'--thinking','low']);
  assert.deepEqual({...plan,argv:normal.argv},normal);
  assert.equal(JSON.parse(plan.files[0].contents).models.providers.minimax.models[0].maxTokens,8192);
  assert.equal(SUBSCRIPTION_CODING_LIMITS_V1?.maxOutputTokens,8192);frozen(plan);
  assert.deepEqual(build(input),normal,'omitted profile preserves the existing coding defaults');
});

test('PLAN request profile accepts no arbitrary thinking, model, or caller-controlled value', () => {
  for(const requestProfile of ['off','medium','plan-report-v2',null,{}, {thinking:'off'}, ['plan-report-v1']])
    assert.throws(()=>build({...fixture(),requestProfile} as never),{message:'SUBSCRIPTION_CODING_INPUT_INVALID'});
  let calls=0;
  const input=Object.defineProperty(fixture(),'requestProfile',{get(){calls++;throw Error('PRIVATE_PROFILE_GETTER');}});
  assert.throws(()=>build(input),{message:'SUBSCRIPTION_CODING_INPUT_INVALID'});assert.equal(calls,0);
});

for (const modelRef of ['kimi/k3.1-pro', 'minimax/MiniMax-M3.1-Flash'] as const) {
  test(`coding material confines file tools and model selection: ${modelRef}`, { skip: !api && modelRef !== 'kimi/k3.1-pro' }, () => {
    assert.equal(typeof build, 'function', 'coding capability is missing');
    const input = fixture(modelRef), value = build(input), config = JSON.parse(value.files[0].contents);
    const provider = modelRef === 'kimi/k3.1-pro' ? 'kimi' : 'minimax';
    assert.equal(value.schema, 'setfarm.subscription-attempt-launch-material.v1');
    assert.equal(value.profile, 'subscription-coding-files-v1');
    assert.deepEqual(value.identity, input.identity);
    assert.equal(value.cwd, input.worktree);
    assert.equal(config.agents.defaults.workspace, input.worktree);
    assert.equal(config.agents.list[0].workspace, input.worktree);
    assert.deepEqual(config.tools, { allow: ['read', 'write', 'edit'], fs: { workspaceOnly: true },
      web: { search: { enabled: false }, fetch: { enabled: false } },
      agentToAgent: { enabled: false }, elevated: { enabled: false } });
    assert.deepEqual(config.agents.defaults.model, { primary: modelRef, fallbacks: [] });
    assert.deepEqual(config.agents.list[0].model, { primary: modelRef, fallbacks: [] });
    assert.equal(config.agents.defaults.timeoutSeconds, 1800);
    assert.equal(config.agents.defaults.skipBootstrap, true);
    assert.deepEqual(config.agents.defaults.skills, []);
    assert.equal(config.agents.defaults.startupContext.enabled, false);
    assert.equal(config.agents.defaults.memorySearch.enabled, false);
    assert.equal(config.models.mode, 'replace');
    assert.deepEqual(Object.keys(config.models.providers), [provider]);
    const selected = config.models.providers[provider];
    assert.equal(selected.apiKey, 'A'.repeat(43));
    assert.equal(selected.baseUrl, 'http://127.0.0.1:49157/v1');
    assert.equal(selected.models.length, 1);
    assert.equal(selected.models[0].maxTokens, 8192);
    assert.equal(selected.models[0].contextWindow, 200000);
    assert.deepEqual(config.plugins, { enabled: false });
    assert.deepEqual(config.acp, { enabled: false, dispatch: { enabled: false } });
    assert.deepEqual(config.proxy, { enabled: false });
    assert.deepEqual(value.argv, ['agent', '--local', '--json', '--agent', 'subscription-worker',
      '--session-id', value.sessionId, '--message', input.prompt, '--timeout', '1800']);
  });
}

test('coding broker ceilings cover a bounded 30 minute attempt within the fixed per-request output ceiling', { skip: !api }, () => {
  assert.deepEqual(SUBSCRIPTION_CODING_LIMITS_V1, { maxRequests: 128, maxOutputTokens: 8192,
    maxTotalOutputTokens: 524288, maxRequestBytes: 2097152, maxResponseBytes: 8388608,
    maxTotalResponseBytes: 67108864, maxSseEventBytes: 262144,
    attemptMs: 1800000, requestMs: 120000, idleMs: 60000 });
  frozen(SUBSCRIPTION_CODING_LIMITS_V1);
});

test('coding preserves private custody material and leaves the 20 second readonly control unchanged', { skip: !api }, () => {
  const input = fixture(), control = buildReadonly(readonlyInput(input)), value = build(input);
  const controlConfig = JSON.parse(control.files[0].contents);
  assert.equal(control.profile, 'private-headless-readonly-v1');
  assert.equal(control.cwd, input.root + '/work');
  assert.equal(controlConfig.agents.defaults.timeoutSeconds, 20);
  assert.equal(controlConfig.models.providers.kimi.models[0].maxTokens, 2048);
  assert.deepEqual(controlConfig.tools.allow, ['read']);
  assert.equal(control.argv.at(-1), '20');
  assert.deepEqual(value.directories, ['home', 'state', 'state/agents', 'state/agents/subscription-worker',
    'state/agents/subscription-worker/agent', 'state/agents/main', 'state/agents/main/agent',
    'xdg', 'xdg/config', 'xdg/cache', 'xdg/data', 'xdg/state', 'tmp', 'work'].map(p => input.root + '/' + p));
  assert.equal(value.files.length, 3);
  assert.deepEqual(value.files.map(f => [f.path, f.mode]), [
    [input.root + '/config.json', 0o600],
    [input.root + '/state/agents/subscription-worker/agent/auth-profiles.json', 0o600],
    [input.root + '/state/agents/main/agent/auth-profiles.json', 0o600],
  ]);
  for (const file of value.files.slice(1)) assert.deepEqual(JSON.parse(file.contents), { version: 1, profiles: {} });
  const r = input.root;
  assert.deepEqual(value.env, { HOME: r + '/home', OPENCLAW_HOME: r + '/home', OPENCLAW_STATE_DIR: r + '/state',
    OPENCLAW_CONFIG_PATH: r + '/config.json', PI_CODING_AGENT_DIR: r + '/state/agents/subscription-worker/agent',
    XDG_CONFIG_HOME: r + '/xdg/config', XDG_CACHE_HOME: r + '/xdg/cache', XDG_DATA_HOME: r + '/xdg/data',
    XDG_STATE_HOME: r + '/xdg/state', TMPDIR: r + '/tmp', TMP: r + '/tmp', TEMP: r + '/tmp', PATH: '/usr/bin:/bin',
    LANG: 'en_US.UTF-8', TZ: 'UTC', NO_COLOR: '1', OPENSSL_CONF: '/dev/null', NODE_DISABLE_COMPILE_CACHE: '1', OPENCLAW_NO_RESPAWN: '1',
    OPENCLAW_PATH_BOOTSTRAPPED: '1', OPENCLAW_LOG_LEVEL: 'silent', OPENCLAW_AUTH_STORE_READONLY: '1', OPENCLAW_TRAJECTORY: 'false' });
  for (const key of ['KIMI_API_KEY', 'MINIMAX_API_KEY', 'ANTHROPIC_API_KEY', 'HTTP_PROXY', 'HTTPS_PROXY',
    'NODE_OPTIONS', 'NODE_TLS_REJECT_UNAUTHORIZED', 'SETFARM_PG_URL']) assert.ok(!Object.hasOwn(value.env, key));
  assert.equal(control.env.OPENSSL_CONF, undefined);
  assert.ok(!JSON.stringify([value.argv, value.env, value.files.slice(1)]).includes(input.worker.apiKey));
  assert.equal(JSON.stringify(buildReadonly(readonlyInput(input))), JSON.stringify(control));
});

test('invalid identity, capability, prompt and noncanonical or overlapping paths fail closed', { skip: !api }, () => {
  const bad: unknown[] = [null, [], { ...fixture(), extra: true },
    { ...fixture(), identity: { ...fixture().identity, generationId: 'different' } },
    { ...fixture(), worker: { ...fixture().worker, baseUrl: 'https://provider.example/v1' } },
    { ...fixture(), worker: { ...fixture().worker, apiKey: 'not-a-capability' } },
    { ...fixture(), prompt: '' }, { ...fixture(), prompt: 'x\0y' },
    { ...fixture(), prompt: 'x'.repeat(65537) }];
  for (const path of ['', '/', 'relative', '//a', '/a//b', '/a/./b', '/a/../b', '/a/',
    '/a\\b', '/a\n', '/a\u007f', '/' + 'a'.repeat(1024)]) {
    bad.push({ ...fixture(), worktree: path }, { ...fixture(), root: path });
  }
  for (const [root, worktree] of [['/private/owned', '/private/owned'],
    ['/private/owned', '/private/owned/project'], ['/private/owned/runtime', '/private/owned']]) {
    bad.push({ ...fixture(), root, worktree });
  }
  for (const input of bad) assert.throws(() => build(input as never), { message: 'SUBSCRIPTION_CODING_INPUT_INVALID' });
  assert.equal(build({ ...fixture(), root: '/private/owner', worktree: '/private/owner-project' }).cwd, '/private/owner-project');
});

test('closed own data rejects accessors and proxies without invoking their code or leaking errors', { skip: !api }, () => {
  let calls = 0;
  const getter = { get() { calls++; throw new Error('FAKE_PRIVATE_INPUT'); } };
  const trap = () => { calls++; throw new Error('FAKE_PRIVATE_PROXY'); };
  const proxy = (value: object) => new Proxy(value, { get: trap, getPrototypeOf: trap, ownKeys: trap,
    getOwnPropertyDescriptor: trap });
  const bad: unknown[] = [Object.defineProperty(fixture(), 'worktree', getter),
    { ...fixture(), identity: Object.defineProperty(fixture().identity, 'modelRef', getter) },
    { ...fixture(), worker: Object.defineProperty(fixture().worker, 'apiKey', getter) },
    { ...fixture(), worktree: { toString() { calls++; return '/private/project'; } } },
    Object.assign(fixture(), { [Symbol('extra')]: true }), proxy(fixture()),
    { ...fixture(), identity: proxy(fixture().identity) }, { ...fixture(), worker: proxy(fixture().worker) },
    Object.assign(Object.create({}), fixture())];
  const revoked = Proxy.revocable(fixture(), {}); revoked.revoke(); bad.push(revoked.proxy);
  for (const input of bad) assert.throws(() => build(input as never), { message: 'SUBSCRIPTION_CODING_INPUT_INVALID' });
  assert.equal(calls, 0);
});

test('material is detached and recursively frozen while null prototype records remain valid', { skip: !api }, () => {
  const input = fixture();
  const value = build(Object.assign(Object.create(null), input, {
    identity: Object.assign(Object.create(null), input.identity), worker: Object.assign(Object.create(null), input.worker),
  }));
  frozen(value);
  const snapshot = JSON.stringify(value);
  input.identity.attemptId = 'changed'; input.worker = { ...input.worker, apiKey: 'B'.repeat(43) };
  input.root = '/elsewhere'; input.worktree = '/other-project'; input.prompt = 'changed';
  assert.equal(JSON.stringify(value), snapshot);
  assert.throws(() => { (value.argv as string[]).push('unexpected'); }, TypeError);
  assert.throws(() => { (value.env as Record<string, string>).HOME = '/ambient'; }, TypeError);
});
