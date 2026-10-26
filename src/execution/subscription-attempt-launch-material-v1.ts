import { posix } from 'node:path';
import { createHash } from 'node:crypto';
import type { SubscriptionAttemptBrokerWorkerV1 } from './subscription-attempt-broker-v1.js';

export type SubscriptionAttemptIdentityV1 = Readonly<{
  attemptId: string; generationId: string; modelRef: SubscriptionAttemptBrokerWorkerV1['modelRef'];
}>;
export type SubscriptionAttemptLaunchInputV1 = Readonly<{
  identity: SubscriptionAttemptIdentityV1; worker: SubscriptionAttemptBrokerWorkerV1; root: string; prompt: string;
}>;
export type SubscriptionAttemptPrivateFileV1 = Readonly<{ path: string; mode: 0o600; contents: string }>;
export type SubscriptionAttemptLaunchMaterialV1 = Readonly<{
  schema: 'setfarm.subscription-attempt-launch-material.v1'; profile: 'private-headless-readonly-v1';
  identity: SubscriptionAttemptIdentityV1; sessionId: string; cwd: string; directories: readonly string[];
  files: readonly SubscriptionAttemptPrivateFileV1[]; env: Readonly<Record<string, string>>; argv: readonly string[];
}>;
function invalid(): never { throw new Error('SUBSCRIPTION_LAUNCH_INPUT_INVALID'); }
function data(value: unknown, keys: readonly string[]): Record<string, unknown> {
  if (value === null || typeof value !== 'object') invalid();
  const proto = Object.getPrototypeOf(value);
  if (proto !== Object.prototype && proto !== null) invalid();
  const descriptors = Object.getOwnPropertyDescriptors(value), actual = Reflect.ownKeys(descriptors);
  if (actual.length !== keys.length || actual.some(k => typeof k !== 'string' || !keys.includes(k))) invalid();
  const copy: Record<string, unknown> = Object.create(null);
  for (const key of keys) {
    const d = descriptors[key]; if (!d || !Object.hasOwn(d, 'value')) invalid(); copy[key] = d.value;
  }
  return copy;
}
function id(value: unknown): value is string { return typeof value === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(value); }
function freeze<T>(value: T): T {
  if (value !== null && typeof value === 'object') { for (const child of Object.values(value)) freeze(child); Object.freeze(value); }
  return value;
}
/** Pure launch data only. The caller still owns materialization, isolation and admission. */
export function buildSubscriptionAttemptLaunchMaterialV1(input: SubscriptionAttemptLaunchInputV1): SubscriptionAttemptLaunchMaterialV1 {
  try {
    const v = data(input, ['identity', 'worker', 'root', 'prompt']);
    const i = data(v.identity, ['attemptId', 'generationId', 'modelRef']);
    if (!id(i.attemptId) || !id(i.generationId)
      || (i.modelRef !== 'kimi/k3.1-pro' && i.modelRef !== 'minimax/MiniMax-M3.1-Flash')) invalid();
    const identity: SubscriptionAttemptIdentityV1 = { attemptId: i.attemptId, generationId: i.generationId, modelRef: i.modelRef };
    const w = data(v.worker, ['attemptId', 'generationId', 'modelRef', 'providerId', 'modelId', 'baseUrl', 'api', 'apiKey', 'auth', 'authHeader']);
    const p = identity.modelRef === 'kimi/k3.1-pro' ? 'kimi' : 'minimax';
    const m = p === 'kimi' ? 'k3.1-pro' : 'MiniMax-M3.1-Flash', q = identity.modelRef;
    if (w.attemptId !== identity.attemptId || w.generationId !== identity.generationId || w.modelRef !== q
      || w.providerId !== p || w.modelId !== m || w.api !== 'anthropic-messages' || w.auth !== 'api-key'
      || w.authHeader !== true || typeof w.apiKey !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(w.apiKey)
      || typeof w.baseUrl !== 'string') invalid();
    const port = /^http:\/\/127\.0\.0\.1:([1-9][0-9]{0,4})\/v1$/.exec(w.baseUrl)?.[1];
    if (!port || Number(port) > 65535 || [3080, 3333, 18789].includes(Number(port)) || new URL(w.baseUrl).href !== w.baseUrl) invalid();
    const root = v.root, prompt = v.prompt;
    if (typeof root !== 'string' || root.length < 1 || root.length > 1024 || root === '/' || !root.startsWith('/')
      || root.endsWith('/') || /[\\\x00-\x1f\x7f]/.test(root) || root.includes('//')
      || root.split('/').some(s => s === '.' || s === '..') || posix.normalize(root) !== root
      || typeof prompt !== 'string' || prompt.includes('\0') || Buffer.byteLength(prompt, 'utf8') < 1
      || Buffer.byteLength(prompt, 'utf8') > 65536) invalid();
    const path = (part: string) => posix.join(root, part);
    const sessionId = 'sfsub-' + createHash('sha256').update(JSON.stringify([identity.attemptId, identity.generationId, q])).digest('hex');
    const config = {
      logging: { level: 'silent', consoleLevel: 'error', file: path('openclaw.log') },
      diagnostics: { enabled: false, otel: { enabled: false }, cacheTrace: { enabled: false } },
      update: { checkOnStart: false, auto: { enabled: false } }, proxy: { enabled: false }, plugins: { enabled: false },
      acp: { enabled: false, dispatch: { enabled: false } },
      models: { mode: 'replace', pricing: { enabled: false }, providers: {
        [p]: { baseUrl: w.baseUrl, api: 'anthropic-messages', auth: 'api-key', authHeader: true, apiKey: w.apiKey,
          agentRuntime: { id: 'pi' }, request: { allowPrivateNetwork: true },
          models: [{ id: m, name: m, reasoning: true, input: ['text'], contextWindow: 200000, maxTokens: 2048, agentRuntime: { id: 'pi' } }] }
      } },
      agents: { defaults: { timeFormat: '24', agentRuntime: { id: 'pi' }, model: { primary: q, fallbacks: [] },
        models: { [q]: { agentRuntime: { id: 'pi' } } }, workspace: path('work'), skipBootstrap: true, skills: [],
        startupContext: { enabled: false }, memorySearch: { enabled: false }, timeoutSeconds: 20, maxConcurrent: 1 },
        list: [{ id: 'subscription-worker', default: true, workspace: path('work'),
          agentDir: path('state/agents/subscription-worker/agent'), model: { primary: q, fallbacks: [] }, skills: [] }] },
      tools: { allow: ['read'], fs: { workspaceOnly: true }, web: { search: { enabled: false }, fetch: { enabled: false } },
        agentToAgent: { enabled: false }, elevated: { enabled: false } },
    };
    const file = (part: string, value: unknown): SubscriptionAttemptPrivateFileV1 => ({ path: path(part), mode: 0o600, contents: JSON.stringify(value, null, 2) + '\n' });
    return freeze({ schema: 'setfarm.subscription-attempt-launch-material.v1', profile: 'private-headless-readonly-v1', identity,
      sessionId, cwd: path('work'), directories: ['home', 'state', 'state/agents', 'state/agents/subscription-worker',
        'state/agents/subscription-worker/agent', 'state/agents/main', 'state/agents/main/agent', 'xdg', 'xdg/config',
        'xdg/cache', 'xdg/data', 'xdg/state', 'tmp', 'work'].map(path),
      files: [file('config.json', config), file('state/agents/subscription-worker/agent/auth-profiles.json', { version: 1, profiles: {} }),
        file('state/agents/main/agent/auth-profiles.json', { version: 1, profiles: {} })],
      env: { HOME: path('home'), OPENCLAW_HOME: path('home'), OPENCLAW_STATE_DIR: path('state'), OPENCLAW_CONFIG_PATH: path('config.json'),
        PI_CODING_AGENT_DIR: path('state/agents/subscription-worker/agent'), XDG_CONFIG_HOME: path('xdg/config'), XDG_CACHE_HOME: path('xdg/cache'),
        XDG_DATA_HOME: path('xdg/data'), XDG_STATE_HOME: path('xdg/state'), TMPDIR: path('tmp'), TMP: path('tmp'), TEMP: path('tmp'),
        PATH: '/usr/bin:/bin', LANG: 'en_US.UTF-8', TZ: 'UTC', NO_COLOR: '1', NODE_DISABLE_COMPILE_CACHE: '1', OPENCLAW_NO_RESPAWN: '1',
        OPENCLAW_PATH_BOOTSTRAPPED: '1', OPENCLAW_LOG_LEVEL: 'silent', OPENCLAW_AUTH_STORE_READONLY: '1', OPENCLAW_TRAJECTORY: 'false' },
      argv: ['agent', '--local', '--json', '--agent', 'subscription-worker', '--session-id', sessionId, '--message', prompt, '--timeout', '20'],
    });
  } catch { invalid(); }
}
