import { createHash } from 'node:crypto';
import { posix } from 'node:path';
import { types } from 'node:util';
import { buildSubscriptionScopedFilePluginV1, SUBSCRIPTION_SCOPED_FILE_PLUGIN_ID_V1 } from './subscription-coding-scoped-file-tools-v1.js';
import { buildSubscriptionCodingMaterialV1, type SubscriptionCodingMaterialV1 } from './subscription-coding-policy-v1.js';
import type { SubscriptionAttemptIdentityV1 } from './subscription-attempt-launch-material-v1.js';
import type { ProcessIdentityV1 } from './schemas/process-identity-v1.js';

export function subscriptionCodingWorkerRefusedV1(): never { throw new Error('SUBSCRIPTION_CODING_WORKER_REFUSED'); }
const refuse: () => never = subscriptionCodingWorkerRefusedV1;
// Generated SBPL expands exact literal paths/exclusions; this is not a grant.
export const SUBSCRIPTION_CODING_SANDBOX_POLICY_MAX_BYTES_V1 = 1048576;
export function subscriptionCodingHashV1(value: string | Buffer): string {
  return createHash('sha256').update(value).digest('hex');
}
/** Public Homebrew runtime metadata only, never a private-directory policy.
 * Darwin's admin group owns the existing shared Homebrew lib ancestor. */
export function subscriptionCodingPublicAncestorAllowedV1(value: Readonly<{
  path: string; uid: bigint; gid: bigint; mode: bigint; currentUid: bigint;
  directory: boolean; symbolicLink: boolean;
}>): boolean {
  if (!value.directory || value.symbolicLink || (value.uid !== 0n && value.uid !== value.currentUid)
    || (value.mode & 0o002n) !== 0n) return false;
  if ((value.mode & 0o022n) === 0n) return true;
  return value.path === '/opt/homebrew/lib' && value.uid === value.currentUid
    && value.gid === 80n && (value.mode & 0o7777n) === 0o775n;
}
function own(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || types.isProxy(value)) refuse();
  const proto = Object.getPrototypeOf(value);
  if (proto !== Object.prototype && proto !== null) refuse();
  const out: Record<string, unknown> = Object.create(null);
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key !== 'string') refuse();
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !Object.hasOwn(descriptor, 'value')) refuse();
    out[key] = descriptor.value;
  }
  return out;
}
function exact(value: unknown, keys: readonly string[]): Record<string, unknown> {
  const out = own(value), actual = Object.keys(out);
  if (actual.length !== keys.length || actual.some(key => !keys.includes(key))) refuse();
  return out;
}
function detached(value: unknown, depth = 0): unknown {
  if (depth > 30) refuse();
  if (value !== null && typeof value === 'object' && types.isProxy(value)) refuse();
  if (typeof value === 'string' || typeof value === 'boolean' || value === null) return value;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (Array.isArray(value)) {
    if (value.length > 256) refuse();
    const ds = Object.getOwnPropertyDescriptors(value);
    if (Reflect.ownKeys(ds).length !== value.length + 1) refuse();
    return Array.from({ length: value.length }, (_, index) => {
      const d = ds[String(index)];
      if (!d || !Object.hasOwn(d, 'value')) refuse();
      return detached(d.value, depth + 1);
    });
  }
  const out = own(value);
  for (const key of Object.keys(out)) out[key] = detached(out[key], depth + 1);
  return out;
}
function freeze<T>(value: T): T {
  if (value !== null && typeof value === 'object') {
    Object.values(value).forEach(child => freeze(child)); Object.freeze(value);
  }
  return value;
}
export function subscriptionCodingCanonicalPathV1(value: unknown): value is string {
  return typeof value === 'string' && value.length > 1 && value.length <= 1024
    && value.startsWith('/') && !value.endsWith('/') && !/[\\\x00-\x1f\x7f]/.test(value)
    && !value.includes('//') && !value.split('/').some(part => part === '.' || part === '..')
    && posix.normalize(value) === value;
}
export function subscriptionCodingPathsOverlapV1(a: string, b: string): boolean {
  return a === b || a.startsWith(b + '/') || b.startsWith(a + '/');
}

/** Pure reconstruction, never a physical filesystem or startup-admission receipt. */
export function validateSubscriptionCodingWorkerMaterialV1(input: unknown): Readonly<{
  material: SubscriptionCodingMaterialV1; root: string; brokerPort: number; materialHash: string; capability: string;
}> {
  try {
    const copy = detached(input) as SubscriptionCodingMaterialV1;
    exact(copy, ['schema', 'profile', 'identity', 'sessionId', 'cwd', 'directories', 'files', 'env', 'argv']);
    if (!Array.isArray(copy.files) || copy.files.length !== 3 || !Array.isArray(copy.argv)
      || typeof copy.files[0]?.contents !== 'string' || Buffer.byteLength(copy.files[0].contents) > 262144
      || typeof copy.files[0]?.path !== 'string' || !copy.files[0].path.endsWith('/config.json')) refuse();
    const root = copy.files[0].path.slice(0, -'/config.json'.length);
    const config = JSON.parse(copy.files[0].contents), identity = copy.identity;
    const kimi = identity.modelRef === 'kimi/k3.1-pro', providerId = kimi ? 'kimi' : 'minimax';
    const provider = config.models.providers[providerId];
    const material = buildSubscriptionCodingMaterialV1({ identity, root, worktree: copy.cwd,
      ...(copy.argv.length === 13 && copy.argv[11] === '--thinking' && copy.argv[12] === 'low'
        ? { requestProfile: 'plan-report-v1' as const } : {}),
      prompt: copy.argv[8], worker: { ...identity, providerId, modelId: kimi ? 'k3.1-pro' : 'MiniMax-M3.1-Flash',
        baseUrl: provider.baseUrl, api: provider.api, apiKey: provider.apiKey,
        auth: provider.auth, authHeader: provider.authHeader } });
    if (JSON.stringify(copy) !== JSON.stringify(material)) refuse();
    const brokerPort = Number(new URL(provider.baseUrl).port);
    return freeze({ material, root, brokerPort, materialHash: subscriptionCodingHashV1(JSON.stringify(material)),
      capability: provider.apiKey as string });
  } catch { refuse(); }
}

export type SubscriptionCodingWriteGrantV1 = Readonly<{ path: string; kind: 'file' | 'directory' }>;
/** Same wire schema as the seed; tools are regenerated only by the narrowing function. */
export type SubscriptionCodingWorkerEffectiveMaterialV1 = SubscriptionCodingMaterialV1;
function mutationScope(worktree: string, grants: unknown, controls: unknown): Readonly<{
  writeGrants: readonly SubscriptionCodingWriteGrantV1[]; readOnlyControlPaths: readonly string[];
}> {
  const writeData = detached(grants), controlData = detached(controls);
  if (!Array.isArray(writeData) || !Array.isArray(controlData)) refuse();
  const readOnlyControlPaths = controlData.map(path => {
    if (!subscriptionCodingCanonicalPathV1(path) || !path.startsWith(worktree + '/')) refuse();
    return path;
  }).sort();
  if (new Set(readOnlyControlPaths).size !== readOnlyControlPaths.length) refuse();
  const writeGrants = writeData.map<SubscriptionCodingWriteGrantV1>(value => {
    const grant = exact(value, ['path', 'kind']), path = grant.path, kind = grant.kind;
    if (!subscriptionCodingCanonicalPathV1(path) || (kind !== 'file' && kind !== 'directory')
      || !(path.startsWith(worktree + '/') || (path === worktree && kind === 'directory'))
      || path === worktree + '/.git' || path.startsWith(worktree + '/.git/')
      || readOnlyControlPaths.some(control => path === control || path.startsWith(control + '/'))) refuse();
    return { path, kind };
  }).sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : a.kind.localeCompare(b.kind));
  if (new Set(writeGrants.map(grant => grant.path)).size !== writeGrants.length) refuse();
  return freeze({ writeGrants, readOnlyControlPaths });
}
/** Deterministic role-authority narrowing of a validated fixed Task1 seed.
 * Scope DATA is parent-derived canonical authority, never an approval flag. */
export function narrowSubscriptionCodingWorkerMaterialV1(input: Readonly<{
  material: SubscriptionCodingMaterialV1; writeGrants: readonly SubscriptionCodingWriteGrantV1[];
  readOnlyControlPaths: readonly string[];
}>): Readonly<{
  material: SubscriptionCodingWorkerEffectiveMaterialV1; root: string; brokerPort: number;
  materialHash: string; capability: string; writeGrants: readonly SubscriptionCodingWriteGrantV1[];
  readOnlyControlPaths: readonly string[];
}> {
  try {
    const value = exact(input, ['material', 'writeGrants', 'readOnlyControlPaths']);
    const seed = validateSubscriptionCodingWorkerMaterialV1(value.material);
    const scope = mutationScope(seed.material.cwd, value.writeGrants, value.readOnlyControlPaths);
    const config = JSON.parse(seed.material.files[0].contents);
    const pluginDirectory = seed.root + '/scoped-files';
    const plugin = scope.writeGrants.length ? buildSubscriptionScopedFilePluginV1({
      privateRoot: seed.root, worktree: seed.material.cwd, grants: scope.writeGrants, controls: scope.readOnlyControlPaths,
    }) : undefined;
    config.tools.allow = plugin ? ['read', 'setfarm_write', 'setfarm_edit'] : ['read'];
    if (plugin) config.plugins = { enabled: true, allow: [SUBSCRIPTION_SCOPED_FILE_PLUGIN_ID_V1],
      load: { paths: [pluginDirectory] }, slots: { memory: 'none', contextEngine: 'none' }, bundledDiscovery: 'allowlist', entries: { [SUBSCRIPTION_SCOPED_FILE_PLUGIN_ID_V1]: { enabled: true } } };
    const pluginFiles = plugin ? [
      { path: pluginDirectory + '/openclaw.plugin.json', mode: 0o600 as const, contents: plugin.manifest },
      { path: pluginDirectory + '/index.mjs', mode: 0o600 as const, contents: plugin.source },
    ] : [];
    const material = freeze({ ...seed.material,
      directories: plugin ? [...seed.material.directories, pluginDirectory] : [...seed.material.directories],
      files: [...seed.material.files.map((file, index) =>
        index === 0 ? { ...file, contents: JSON.stringify(config, null, 2) + '\n' } : { ...file }), ...pluginFiles] });
    return freeze({ material, root: seed.root, brokerPort: seed.brokerPort, capability: seed.capability,
      ...scope, materialHash: subscriptionCodingHashV1(JSON.stringify({
        material, writeGrants: scope.writeGrants, readOnlyControlPaths: scope.readOnlyControlPaths,
      })) });
  } catch { refuse(); }
}

export type SubscriptionCodingSandboxPathsV1 = Readonly<{
  privateRoot: string; worktree: string; authorityRoots: readonly string[]; gitControlPaths: readonly string[];
  nodePath: string; nodeLibraryPaths: Readonly<{ readPaths: readonly string[]; mapPaths: readonly string[] }>;
  openclawRoot: string; preloadPath: string; profilePath: string; transcriptPath: string; brokerPort: number;
  writeGrants: readonly SubscriptionCodingWriteGrantV1[]; readOnlyControlPaths: readonly string[];
}>;
/** Serializes path DATA. The physical launcher obtains and rechecks these paths itself. */
export function buildSubscriptionCodingSandboxPolicyV1(input: SubscriptionCodingSandboxPathsV1): string {
  try {
    const v = detached(input) as SubscriptionCodingSandboxPathsV1;
    exact(v, ['privateRoot', 'worktree', 'authorityRoots', 'gitControlPaths', 'nodePath', 'openclawRoot',
      'preloadPath', 'profilePath', 'transcriptPath', 'brokerPort', 'writeGrants', 'readOnlyControlPaths', 'nodeLibraryPaths']);
    const paths = [v.privateRoot, v.worktree, v.nodePath, v.openclawRoot, v.preloadPath, v.profilePath, v.transcriptPath];
    if (!Array.isArray(v.authorityRoots) || v.authorityRoots.length < 1 || v.authorityRoots.length > 32
      || !Array.isArray(v.gitControlPaths) || v.gitControlPaths.length < 1 || v.gitControlPaths.length > 8
      || ![...paths, ...v.authorityRoots, ...v.gitControlPaths].every(subscriptionCodingCanonicalPathV1)
      || !Number.isInteger(v.brokerPort) || v.brokerPort < 1 || v.brokerPort > 65535
      || [3080, 3333, 18789].includes(v.brokerPort)) refuse();
    const scope = mutationScope(v.worktree, v.writeGrants, v.readOnlyControlPaths);
    if (v.preloadPath !== v.privateRoot + '/fixed-gate.mjs' || v.profilePath !== v.privateRoot + '/profile.sb'
      || v.gitControlPaths[0] !== v.worktree + '/.git'
      || !/^\/opt\/homebrew\/Cellar\/node(?:@[0-9]+)?\/[0-9]+\.[0-9]+\.[0-9]+\/bin\/node$/.test(v.nodePath)
      || v.openclawRoot !== '/opt/homebrew/lib/node_modules/openclaw'
      || subscriptionCodingPathsOverlapV1(v.privateRoot, v.worktree)) refuse();
    const libraryData = exact(v.nodeLibraryPaths, ['readPaths', 'mapPaths']);
    const libraryLists = [libraryData.readPaths, libraryData.mapPaths];
    for (const list of libraryLists) {
      if (!Array.isArray(list) || list.length > 256 || new Set(list).size !== list.length
        || list.some(path => !subscriptionCodingCanonicalPathV1(path)
          || !/^\/opt\/homebrew\/(?:Cellar\/[^/]+\/[^/]+\/(?:lib|bin)|opt\/[^/]+\/lib)\/(?:[^/]+\/)*[^/]+\.dylib$/.test(path))) refuse();
    }
    const libraryReads = libraryData.readPaths as string[], libraryMaps = libraryData.mapPaths as string[];
    if (libraryMaps.some(path => !libraryReads.includes(path))) refuse();
    const runtimeRoot = posix.dirname(posix.dirname(v.nodePath));
    const readableSystem = ['/usr/lib', '/System/Library', '/System/Volumes/Preboot/Cryptexes/OS/usr/lib', v.openclawRoot];
    const runtimeProtected = [...readableSystem, runtimeRoot, ...libraryReads, ...libraryMaps];
    for (const protectedPath of [...v.authorityRoots, v.transcriptPath]) {
      if ([v.privateRoot, v.worktree, ...runtimeProtected].some(path => subscriptionCodingPathsOverlapV1(path, protectedPath))) refuse();
    }
    for (const gitPath of v.gitControlPaths.slice(1)) {
      if ([v.privateRoot, v.worktree, ...runtimeProtected].some(path => subscriptionCodingPathsOverlapV1(path, gitPath))) refuse();
    }
    if (runtimeProtected.some(path => [v.privateRoot, v.worktree].some(other => subscriptionCodingPathsOverlapV1(path, other)))) refuse();
    const readProtected = [...v.authorityRoots, ...v.gitControlPaths, v.transcriptPath];
    const writeProtected = [...readProtected, ...scope.readOnlyControlPaths, v.preloadPath, v.profilePath, v.privateRoot + '/config.json',
      v.privateRoot + '/state/agents/subscription-worker/agent/auth-profiles.json',
      v.privateRoot + '/state/agents/main/agent/auth-profiles.json'];
    const quote = (path: string) => JSON.stringify(path);
    const exclude = (items: readonly string[]) => items.map(path => `(require-not (subpath ${quote(path)}))`).join(' ');
    const rule = (operation: string, kind: 'literal' | 'subpath', path: string, exclusions: readonly string[]) =>
      `(allow ${operation} (require-all (${kind} ${quote(path)}) ${exclude(exclusions)}))`;
    // Exact ancestor unlink exclusions preserve protected namespaces while
    // ordinary descendants retain their scoped create/data permissions.
    const structuralAncestors = new Set<string>([v.worktree, v.privateRoot]);
    for (const path of writeProtected) {
      const anchor = path.startsWith(v.worktree + '/') ? v.worktree
        : path.startsWith(v.privateRoot + '/') ? v.privateRoot : undefined;
      if (!anchor) continue;
      let parent = posix.dirname(path);
      while (parent === anchor || parent.startsWith(anchor + '/')) {
        structuralAncestors.add(parent);
        if (parent === anchor) break;
        parent = posix.dirname(parent);
      }
    }
    const writable = [
      ...scope.writeGrants.map(grant => ({ path: grant.path, kind: grant.kind === 'file' ? 'literal' as const : 'subpath' as const })),
      ...['state', 'home', 'xdg', 'tmp'].map(part => ({ path: v.privateRoot + '/' + part, kind: 'subpath' as const })),
      ...['/dev/null', v.privateRoot + '/openclaw.log'].map(path => ({ path, kind: 'literal' as const })),
    ];
    const structuralRule = (kind: 'literal' | 'subpath', path: string) =>
      '(allow file-write-unlink (require-all (' + kind + ' ' + quote(path) + ') ' + exclude(writeProtected)
      + ' ' + [...structuralAncestors].map(parent => '(require-not (literal ' + quote(parent) + '))').join(' ') + '))';
    const ancestors = new Set<string>(['/']);
    for (const path of [...paths, ...readableSystem, ...libraryReads, ...libraryMaps]) {
      let parent = posix.dirname(path);
      while (parent !== '/') { ancestors.add(parent); parent = posix.dirname(parent); }
    }
    const policy = ['(version 1)', '(deny default)', '(deny process-fork)', '(deny network-inbound)',
      '(allow file-read-data (literal "/"))',
      `(allow process-exec (literal ${quote(v.nodePath)}))`,
      '(allow process-info* (target self))', '(allow signal (target self))', '(allow sysctl-read)',
      ...[...readableSystem, v.privateRoot, v.worktree].map(path => rule('file-read*', 'subpath', path, readProtected)),
      ...[v.nodePath, ...libraryReads].map(path => rule('file-read*', 'literal', path, readProtected)),
      ...libraryMaps.map(path => rule('file-map-executable', 'literal', path, readProtected)),
      ...[...readableSystem, v.nodePath].map(path => rule('file-map-executable', path === v.nodePath ? 'literal' : 'subpath', path, readProtected)),
      ...[...ancestors, '/dev/null', '/dev/random', '/dev/urandom'].map(path => rule('file-read-metadata', 'literal', path, readProtected)),
      ...['/dev/null', '/dev/random', '/dev/urandom'].map(path => rule('file-read-data', 'literal', path, readProtected)),
      ...writable.map(grant => rule('file-write-data file-write-create', grant.kind, grant.path, writeProtected)),
      ...writable.map(grant => structuralRule(grant.kind, grant.path)),
      `(allow network-outbound (remote tcp4 "localhost:${v.brokerPort}"))`, ''].join('\n');
    if (Buffer.byteLength(policy, 'utf8') > SUBSCRIPTION_CODING_SANDBOX_POLICY_MAX_BYTES_V1) refuse();
    return policy;
  } catch { refuse(); }
}

export type SubscriptionCodingProbeBindingV1 = Readonly<{
  nonce: string; pid: number; identity: SubscriptionAttemptIdentityV1;
  materialHash: string; policyHash: string; preloadHash: string;
}>;
export function buildSubscriptionCodingProbeChallengeV1(input: Readonly<{
  binding: SubscriptionCodingProbeBindingV1; profilePath: string; preloadPath: string; credentialProbePath: string;
  brokerPort: number; nodePath: string; argvHash: string; environmentHash: string;
  files: readonly Readonly<{ path: string; hash: string }>[];
}>) {
  try {
    const value = detached(input) as typeof input;
    exact(value, ['binding', 'profilePath', 'preloadPath', 'credentialProbePath', 'brokerPort', 'nodePath',
      'argvHash', 'environmentHash', 'files']);
    const binding = createSubscriptionCodingProbeProtocolV1(value.binding).binding;
    if (![value.profilePath, value.preloadPath, value.credentialProbePath, value.nodePath]
      .every(subscriptionCodingCanonicalPathV1)
      || !value.profilePath.endsWith('/profile.sb')
      || value.preloadPath !== value.profilePath.slice(0, -'/profile.sb'.length) + '/fixed-gate.mjs'
      || ![value.argvHash, value.environmentHash].every(hash => /^[a-f0-9]{64}$/.test(hash))
      || !Number.isInteger(value.brokerPort) || value.brokerPort < 1 || value.brokerPort > 65535
      || [3080, 3333, 18789].includes(value.brokerPort) || !Array.isArray(value.files)
      || (value.files.length !== 3 && value.files.length !== 5)) refuse();
    if (value.files.length === 5) {
      const root = value.profilePath.slice(0, -'/profile.sb'.length);
      const suffixes = ['/config.json', '/state/agents/subscription-worker/agent/auth-profiles.json',
        '/state/agents/main/agent/auth-profiles.json', '/scoped-files/openclaw.plugin.json', '/scoped-files/index.mjs'];
      if (value.files.some((file, index) => file.path !== root + suffixes[index])) refuse();
    }
    for (const file of value.files) {
      exact(file, ['path', 'hash']);
      if (!subscriptionCodingCanonicalPathV1(file.path) || !/^[a-f0-9]{64}$/.test(file.hash)) refuse();
    }
    return freeze({ schema: 'setfarm.subscription-coding-challenge.v1' as const, type: 'challenge' as const,
      ...binding, profilePath: value.profilePath, preloadPath: value.preloadPath,
      credentialProbePath: value.credentialProbePath, authorityProbePath: value.profilePath,
      authorityProbeHash: binding.policyHash, brokerPort: value.brokerPort, nodePath: value.nodePath,
      argvHash: value.argvHash, environmentHash: value.environmentHash, files: value.files });
  } catch { refuse(); }
}

/** Descriptor ownership only; these callbacks cannot qualify process custody. */
export function createSubscriptionCodingTranscriptCloserV1(fd: number, operations: Readonly<{
  validateAndSync(fd: number): void; close(fd: number): void;
}>) {
  if (!Number.isSafeInteger(fd) || fd < 0 || typeof operations.validateAndSync !== 'function'
    || typeof operations.close !== 'function') refuse();
  let owned: number | undefined = fd, result: 'closed' | 'custody-uncertain' | undefined;
  return Object.freeze({
    get fd() { return owned; },
    close(): 'closed' | 'custody-uncertain' {
      if (result) return result;
      const original = owned;
      // Invalidate before either callback: even a failed close may release fd.
      owned = undefined; result = 'closed';
      if (original === undefined) return result;
      try { operations.validateAndSync(original); } catch { result = 'custody-uncertain'; }
      try { operations.close(original); } catch { result = 'custody-uncertain'; }
      return result;
    },
  });
}

export type SubscriptionCodingProbeProtocolV1 = Readonly<{
  readonly state: 'awaiting-proof' | 'ready' | 'gate-sent' | 'open' | 'failed';
  readonly proofHash: string | null; readonly binding: SubscriptionCodingProbeBindingV1;
  accept(chunk: Buffer): void; end(): void; openGate(): string;
}>;
const protocols = new WeakSet<object>();
export function createSubscriptionCodingProbeProtocolV1(input: SubscriptionCodingProbeBindingV1): SubscriptionCodingProbeProtocolV1 {
  const value = detached(input) as SubscriptionCodingProbeBindingV1;
  exact(value, ['nonce', 'pid', 'identity', 'materialHash', 'policyHash', 'preloadHash']);
  const i = exact(value.identity, ['attemptId', 'generationId', 'modelRef']);
  if (![value.nonce, value.materialHash, value.policyHash, value.preloadHash].every(hash => typeof hash === 'string' && /^[a-f0-9]{64}$/.test(hash))
    || !Number.isSafeInteger(value.pid) || value.pid <= 0
    || ![i.attemptId, i.generationId].every(id => typeof id === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(id))
    || !['kimi/k3.1-pro', 'minimax/MiniMax-M3.1-Flash'].includes(i.modelRef as string)) refuse();
  const binding = freeze(value);
  let state: SubscriptionCodingProbeProtocolV1['state'] = 'awaiting-proof', proofHash: string | null = null;
  let pending = Buffer.alloc(0), size = 0, ended = false;
  const fail = (): never => { state = 'failed'; pending = Buffer.alloc(0); refuse(); };
  function frame(bytes: Buffer): void {
    let parsed: Record<string, unknown>;
    try {
      const text = bytes.toString('utf8'); parsed = JSON.parse(text);
      // Fixed compact frames reject duplicate members, whitespace aliases and invalid UTF8.
      if (JSON.stringify(parsed) !== text) fail();
      const type = parsed.type;
      exact(parsed, ['schema', 'type', ...Object.keys(binding), ...(type === 'proof' ? ['results'] : [])]);
      if (parsed.schema !== 'setfarm.subscription-coding-probe.v1'
        || Object.keys(binding).some(key => JSON.stringify(parsed[key]) !== JSON.stringify(binding[key as keyof typeof binding]))) fail();
      if (type === 'proof' && state === 'awaiting-proof') {
        const results = exact(parsed.results, ['credentialRead', 'authorityWrite', 'sameNodeSpawn', 'nonPinnedExec',
          'publicConnect', 'loopbackConnect', 'brokerConnect']);
        if (results.brokerConnect !== 'connected' || Object.entries(results).some(([key, result]) =>
          key !== 'brokerConnect' && result !== 'EACCES' && result !== 'EPERM')) fail();
        proofHash = subscriptionCodingHashV1(bytes); state = 'ready';
      } else if (type === 'opened' && state === 'gate-sent') state = 'open';
      else fail();
    } catch { fail(); }
  }
  const protocol: SubscriptionCodingProbeProtocolV1 = Object.freeze({
    get state() { return state; }, get proofHash() { return proofHash; }, binding,
    accept(chunk: Buffer) {
      if (!Buffer.isBuffer(chunk) || state === 'failed' || ended || (size += chunk.length) > 16384) fail();
      pending = Buffer.concat([pending, chunk]);
      let newline: number;
      while ((newline = pending.indexOf(10)) !== -1) {
        const bytes = pending.subarray(0, newline); pending = pending.subarray(newline + 1); frame(bytes);
      }
    },
    end() { if (ended) return; ended = true; if (pending.length || state !== 'open') fail(); },
    openGate() {
      if (ended || state !== 'ready') fail();
      state = 'gate-sent';
      return JSON.stringify({ schema: 'setfarm.subscription-coding-gate.v1', type: 'open', ...binding }) + '\n';
    },
  });
  protocols.add(protocol); return protocol;
}

export type SubscriptionCodingCustodyEventV1 = 'child-exit' | 'child-close' | 'child-error'
  | 'stdout-end' | 'stdout-close' | 'stdout-error' | 'stderr-end' | 'stderr-close' | 'stderr-error' | 'deadline';
export function createSubscriptionCodingCustodyTrackerV1(identity: ProcessIdentityV1, protocol: SubscriptionCodingProbeProtocolV1) {
  const expected = freeze(detached(identity) as ProcessIdentityV1);
  exact(expected, ['schema', 'pid', 'processStartedAt', 'processGroupId', 'source']);
  if (expected.schema !== 'setfarm.process-identity.v1' || expected.source !== 'observed_os'
    || !Number.isSafeInteger(expected.pid) || expected.pid < 1 || !Number.isSafeInteger(expected.processGroupId)
    || expected.processGroupId! < 1 || !Number.isFinite(Date.parse(expected.processStartedAt))
    || !protocols.has(protocol) || protocol.binding.pid !== expected.pid) refuse();
  const events = new Set<SubscriptionCodingCustodyEventV1>();
  return Object.freeze({
    observe(event: SubscriptionCodingCustodyEventV1) { events.add(event); },
    get status(): 'pending' | 'closed' | 'custody-uncertain' {
      if ([...events].some(event => event.endsWith('error') || event === 'deadline') || protocol.state === 'failed') return 'custody-uncertain';
      if (!['child-exit', 'child-close', 'stdout-end', 'stdout-close', 'stderr-end', 'stderr-close']
        .every(event => events.has(event as SubscriptionCodingCustodyEventV1))) return 'pending';
      return protocol.proofHash && ['ready', 'gate-sent', 'open'].includes(protocol.state) ? 'closed' : 'custody-uncertain';
    },
    canSignal(observed: ProcessIdentityV1 | null): boolean {
      return !events.has('child-exit') && !events.has('child-close') && observed !== null
        && observed.schema === expected.schema && observed.source === 'observed_os'
        && observed.pid === expected.pid && observed.processGroupId === expected.processGroupId
        && observed.processStartedAt === expected.processStartedAt;
    },
  });
}
