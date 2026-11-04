import { createHash } from 'node:crypto';
import { constants, closeSync, fstatSync, fsyncSync, lstatSync, mkdirSync, openSync,
  readSync, realpathSync, writeSync, type BigIntStats } from 'node:fs';
import { dirname, posix } from 'node:path';
import { types } from 'node:util';
import type { SubscriptionModelRefV1 } from './subscription-coding-policy-v1.js';
import type { ProcessIdentityV1 } from './schemas/process-identity-v1.js';

export type SubscriptionRuntimeBindingV1 = Readonly<{
  runtimeSessionId: string; claimId: number; ownerInstanceId: string;
  modelRef: SubscriptionModelRefV1; sourceSha: string; worktree: string;
}> & (Readonly<{ kind: 'execution-attempt'; attemptId: string; generation: number; fenceToken: string }>
  | Readonly<{ kind: 'stage-claim'; attemptId?: never; generation?: never; fenceToken?: never }>);
export type SubscriptionRuntimeAuthorityV1 = Readonly<{
  activationPreparedHash: string; activationAcknowledgedHash: string; sourceSha: string;
  policySourceHash: string; preloadHash: string; parentIdentity: ProcessIdentityV1;
}>;
export type SubscriptionRuntimeIsolationV1 = Readonly<{
  materialHash: string; policyHash: string; preloadHash: string; proofHash: string; isolationHash: string;
}>;
export type SubscriptionRuntimeWorkerBindingV1 = Readonly<{
  processIdentity: ProcessIdentityV1; brokerPort: number; isolation: SubscriptionRuntimeIsolationV1;
}>;
export type SubscriptionRuntimeClosureV1 = Readonly<{
  binding: SubscriptionRuntimeBindingV1; attachmentHash: string;
  status: 'closed' | 'custody-uncertain'; broker: 'closed' | 'custody-uncertain';
  worker: 'closed' | 'custody-uncertain'; evidenceRefs: readonly string[];
}>;
export type SubscriptionRuntimeAttachmentViewV1 = Readonly<{
  phase: 'prepared' | 'worker-bound' | 'closed'; binding: SubscriptionRuntimeBindingV1;
  attachmentHash: string; authority: SubscriptionRuntimeAuthorityV1;
  worker: SubscriptionRuntimeWorkerBindingV1 | null; closure: SubscriptionRuntimeClosureV1 | null;
}>;
export type SubscriptionRuntimeAttachmentV1 = Readonly<{
  attachmentHash: string;
  bindWorker(worker: SubscriptionRuntimeWorkerBindingV1): Promise<void>;
  publishClosed(closure: SubscriptionRuntimeClosureV1): Promise<void>;
}>;
const SCHEMA = 'setfarm.subscription-runtime-attachment.v1';
const HASH = /^[a-f0-9]{64}$/;
const SOURCE = /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/;
const MAX_RECORD = 32768;
function refuse(): never { throw new Error('SUBSCRIPTION_RUNTIME_ATTACHMENT_REFUSED'); }
function freeze<T>(value: T): T {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
}
function exact(value: unknown, keys: readonly string[]): Record<string, unknown> {
  if (!value || typeof value !== 'object' || types.isProxy(value)) refuse();
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) refuse();
  const descriptors = Object.getOwnPropertyDescriptors(value), actual = Reflect.ownKeys(descriptors);
  if (actual.length !== keys.length || actual.some(key => typeof key !== 'string' || !keys.includes(key))) refuse();
  const result: Record<string, unknown> = Object.create(null);
  for (const key of keys) { const d = descriptors[key]; if (!d || !Object.hasOwn(d, 'value')) refuse(); result[key] = d.value; }
  return result;
}
function id(value: unknown, maximum = 200): value is string {
  return typeof value === 'string' && value.length <= maximum && /^[A-Za-z0-9_-]+$/.test(value);
}
export function isSubscriptionRuntimeCanonicalPathV1(value: unknown): value is string {
  return typeof value === 'string' && value.length <= 4096 && value !== '/' && value.startsWith('/')
    && !/[\\\x00-\x1f\x7f]/.test(value) && !value.endsWith('/') && posix.normalize(value) === value;
}
/** Strict DATA parser, never selected-entry or claim admission. */
export function parseSubscriptionRuntimeBindingV1(value: unknown): SubscriptionRuntimeBindingV1 {
  try {
    if (!value || typeof value !== 'object' || types.isProxy(value)) refuse();
    const discriminator = Object.getOwnPropertyDescriptor(value, 'kind');
    if (!discriminator || !Object.hasOwn(discriminator, 'value')) refuse();
    const kind = discriminator.value;
    if (kind !== 'execution-attempt' && kind !== 'stage-claim') refuse();
    const v = exact(value, ['kind', 'runtimeSessionId', 'claimId', 'ownerInstanceId', 'modelRef', 'sourceSha', 'worktree',
      ...(kind === 'execution-attempt' ? ['attemptId', 'generation', 'fenceToken'] : [])]);
    if (!id(v.runtimeSessionId) || !Number.isSafeInteger(v.claimId) || (v.claimId as number) <= 0
      || typeof v.ownerInstanceId !== 'string' || v.ownerInstanceId.length < 1 || v.ownerInstanceId.length > 500
      || /[\x00-\x1f\x7f]/.test(v.ownerInstanceId) || !isSubscriptionRuntimeCanonicalPathV1(v.worktree)
      || (v.modelRef !== 'minimax/MiniMax-M3.1-Flash' && v.modelRef !== 'kimi/k3.1-pro')
      || typeof v.sourceSha !== 'string' || !SOURCE.test(v.sourceSha)) refuse();
    const common = { runtimeSessionId: v.runtimeSessionId, claimId: v.claimId as number,
      ownerInstanceId: v.ownerInstanceId, modelRef: v.modelRef as SubscriptionModelRefV1, sourceSha: v.sourceSha, worktree: v.worktree };
    if (kind === 'stage-claim') return freeze({ kind: 'stage-claim' as const, ...common });
    if (!id(v.attemptId, 128) || !Number.isSafeInteger(v.generation) || (v.generation as number) <= 0
      || !id(v.fenceToken, 500)) refuse();
    return freeze({ kind: 'execution-attempt' as const, ...common, attemptId: v.attemptId, generation: v.generation as number, fenceToken: v.fenceToken });
  } catch { refuse(); }
}
function processIdentity(value: unknown): ProcessIdentityV1 {
  const v = exact(value, ['schema', 'pid', 'processStartedAt', 'processGroupId', 'source']);
  if (v.schema !== 'setfarm.process-identity.v1' || v.source !== 'observed_os'
    || !Number.isSafeInteger(v.pid) || (v.pid as number) <= 0
    || !Number.isSafeInteger(v.processGroupId) || (v.processGroupId as number) <= 0
    || typeof v.processStartedAt !== 'string' || v.processStartedAt.length > 64
    || !/^\d{4}-\d\d-\d\dT/.test(v.processStartedAt) || !Number.isFinite(Date.parse(v.processStartedAt))) refuse();
  return freeze({ schema: v.schema, pid: v.pid as number, processStartedAt: v.processStartedAt,
    processGroupId: v.processGroupId as number, source: v.source });
}
export function parseSubscriptionRuntimeAuthorityV1(value: unknown, binding: SubscriptionRuntimeBindingV1): SubscriptionRuntimeAuthorityV1 {
  try {
    const v = exact(value, ['activationPreparedHash', 'activationAcknowledgedHash', 'sourceSha', 'policySourceHash', 'preloadHash', 'parentIdentity']);
    if (v.sourceSha !== binding.sourceSha || !['activationPreparedHash', 'activationAcknowledgedHash', 'policySourceHash', 'preloadHash']
      .every(key => typeof v[key] === 'string' && HASH.test(v[key] as string))) refuse();
    return freeze({ activationPreparedHash: v.activationPreparedHash as string,
      activationAcknowledgedHash: v.activationAcknowledgedHash as string, sourceSha: binding.sourceSha,
      policySourceHash: v.policySourceHash as string, preloadHash: v.preloadHash as string,
      parentIdentity: processIdentity(v.parentIdentity) });
  } catch { refuse(); }
}
export function parseSubscriptionRuntimeWorkerBindingV1(value: unknown, authority: SubscriptionRuntimeAuthorityV1): SubscriptionRuntimeWorkerBindingV1 {
  try {
    const v = exact(value, ['processIdentity', 'brokerPort', 'isolation']);
    const isolation = exact(v.isolation, ['materialHash', 'policyHash', 'preloadHash', 'proofHash', 'isolationHash']);
    if (!Object.values(isolation).every(hash => typeof hash === 'string' && HASH.test(hash))
      || isolation.preloadHash !== authority.preloadHash || !Number.isSafeInteger(v.brokerPort)
      || (v.brokerPort as number) < 1 || (v.brokerPort as number) > 65535 || [3080, 3333, 18789].includes(v.brokerPort as number)) refuse();
    return freeze({ processIdentity: processIdentity(v.processIdentity), brokerPort: v.brokerPort as number,
      isolation: isolation as SubscriptionRuntimeIsolationV1 });
  } catch { refuse(); }
}
function equal(a: unknown, b: unknown): boolean { return JSON.stringify(a) === JSON.stringify(b); }
function closureData(value: unknown, binding: SubscriptionRuntimeBindingV1, attachmentHash: string): SubscriptionRuntimeClosureV1 {
  const v = exact(value, ['binding', 'attachmentHash', 'status', 'broker', 'worker', 'evidenceRefs']);
  const parsed = parseSubscriptionRuntimeBindingV1(v.binding);
  if (!equal(parsed, binding) || v.attachmentHash !== attachmentHash
    || ![v.status, v.broker, v.worker].every(status => status === 'closed' || status === 'custody-uncertain')
    || (v.status === 'closed' && (v.broker !== 'closed' || v.worker !== 'closed'))
    || !Array.isArray(v.evidenceRefs) || types.isProxy(v.evidenceRefs) || v.evidenceRefs.length > 100) refuse();
  const refs = Object.getOwnPropertyDescriptors(v.evidenceRefs);
  for (let index = 0; index < v.evidenceRefs.length; index++) {
    const d = refs[String(index)]; if (!d || !Object.hasOwn(d, 'value') || typeof d.value !== 'string'
      || d.value.length < 1 || d.value.length > 500 || /[\x00-\x1f\x7f]/.test(d.value)) refuse();
  }
  return freeze({ binding: parsed, attachmentHash, status: v.status, broker: v.broker,
    worker: v.worker, evidenceRefs: [...v.evidenceRefs] } as SubscriptionRuntimeClosureV1);
}
const bytesOf = (value: unknown) => Buffer.from(JSON.stringify(value) + '\n');
const hashOf = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');
function preparationData(binding: SubscriptionRuntimeBindingV1, authority: SubscriptionRuntimeAuthorityV1) {
  const b = parseSubscriptionRuntimeBindingV1(binding), a = parseSubscriptionRuntimeAuthorityV1(authority, b);
  return { schema: SCHEMA, phase: 'prepared', binding: b, authority: a };
}
/** Exact immutable preparation bytes hash; DATA only, never startup admission. */
export function subscriptionRuntimePreparationHashV1(binding: SubscriptionRuntimeBindingV1, authority: SubscriptionRuntimeAuthorityV1): string {
  return hashOf(bytesOf(preparationData(binding, authority)));
}
function uid(): bigint { if (!process.getuid) refuse(); return BigInt(process.getuid()); }
function stable(a: BigIntStats, b: BigIntStats): boolean {
  return a.dev === b.dev && a.ino === b.ino && a.mode === b.mode && a.uid === b.uid && a.gid === b.gid
    && a.nlink === b.nlink && a.size === b.size && a.mtimeNs === b.mtimeNs && a.ctimeNs === b.ctimeNs && a.birthtimeNs === b.birthtimeNs;
}
function directory(path: string, privateMode: boolean): void {
  if (!isSubscriptionRuntimeCanonicalPathV1(path) || realpathSync(path) !== path) refuse();
  let current = path;
  while (current !== '/') {
    const st = lstatSync(current, { bigint: true });
    if (!st.isDirectory() || st.isSymbolicLink() || (st.uid !== uid() && st.uid !== 0n)
      || ((st.mode & 0o022n) !== 0n && !(st.uid === 0n && (st.mode & 0o1000n) !== 0n))) refuse();
    current = dirname(current);
  }
  const st = lstatSync(path, { bigint: true });
  if (privateMode && (st.uid !== uid() || (st.mode & 0o7777n) !== 0o700n)) refuse();
}
function safeFile(st: BigIntStats): void {
  if (!st.isFile() || st.nlink !== 1n || st.uid !== uid() || (st.mode & 0o7777n) !== 0o600n
    || st.size < 1n || st.size > BigInt(MAX_RECORD)) refuse();
}
function readRecord(path: string, optional = false): Buffer | null {
  let fd: number | undefined;
  try {
    directory(dirname(path), true);
    let before: BigIntStats;
    try { before = lstatSync(path, { bigint: true }); }
    catch (error) { if (optional && (error as NodeJS.ErrnoException).code === 'ENOENT') return null; throw error; }
    safeFile(before);
    if (realpathSync(path) !== path) refuse();
    fd = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
    if (!stable(before, fstatSync(fd, { bigint: true }))) refuse();
    const bytes = Buffer.alloc(Number(before.size)); let offset = 0;
    while (offset < bytes.length) { const count = readSync(fd, bytes, offset, bytes.length - offset, null); if (!count) refuse(); offset += count; }
    const extra = Buffer.alloc(1); if (readSync(fd, extra, 0, 1, null)) refuse();
    if (!stable(before, fstatSync(fd, { bigint: true })) || !stable(before, lstatSync(path, { bigint: true })) || realpathSync(path) !== path) refuse();
    return bytes;
  } finally { if (fd !== undefined) closeSync(fd); }
}
function syncDirectory(path: string): void {
  let fd: number | undefined;
  try {
    directory(path, true); const before = lstatSync(path, { bigint: true });
    fd = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
    const opened = fstatSync(fd, { bigint: true });
    if (before.dev !== opened.dev || before.ino !== opened.ino || !opened.isDirectory()) refuse();
    fsyncSync(fd);
    const after = lstatSync(path, { bigint: true });
    if (after.dev !== opened.dev || after.ino !== opened.ino || after.uid !== uid() || (after.mode & 0o7777n) !== 0o700n) refuse();
  } finally { if (fd !== undefined) closeSync(fd); }
}
function writeRecord(path: string, value: unknown): void {
  const bytes = bytesOf(value); if (bytes.length > MAX_RECORD) refuse();
  directory(dirname(path), true); let fd: number | undefined;
  try {
    try { fd = openSync(path, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600); }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
      const existing = readRecord(path); if (!existing?.equals(bytes)) refuse();
      syncDirectory(dirname(path)); return;
    }
    let offset = 0;
    while (offset < bytes.length) { const count = writeSync(fd, bytes, offset, bytes.length - offset); if (count <= 0) refuse(); offset += count; }
    fsyncSync(fd); const st = fstatSync(fd, { bigint: true }); safeFile(st);
    if (!stable(st, lstatSync(path, { bigint: true })) || realpathSync(path) !== path) refuse();
  } finally { if (fd !== undefined) closeSync(fd); }
  syncDirectory(dirname(path));
}
function parse(bytes: Buffer): Record<string, unknown> {
  const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes), value = JSON.parse(text) as unknown;
  // Parent records have one fixed serialization. Duplicate keys/trailing bytes,
  // alternate encodings and silent JSON coercions are never accepted as replay.
  if (!bytesOf(value).equals(bytes)) refuse();
  if (!value || typeof value !== 'object' || Array.isArray(value)) refuse();
  return value as Record<string, unknown>;
}
function readView(runtimePath: string, expected: SubscriptionRuntimeBindingV1): SubscriptionRuntimeAttachmentViewV1 {
  directory(runtimePath, true);
  const preparedBytes = readRecord(runtimePath + '/prepared.json')!;
  const p = exact(parse(preparedBytes), ['schema', 'phase', 'binding', 'authority']);
  if (p.schema !== SCHEMA || p.phase !== 'prepared') refuse();
  const binding = parseSubscriptionRuntimeBindingV1(p.binding); if (!equal(binding, expected)) refuse();
  const authority = parseSubscriptionRuntimeAuthorityV1(p.authority, binding), attachmentHash = hashOf(preparedBytes);
  const boundBytes = readRecord(runtimePath + '/worker-bound.json', true);
  let worker: SubscriptionRuntimeWorkerBindingV1 | null = null;
  if (boundBytes) {
    const b = exact(parse(boundBytes), ['schema', 'phase', 'binding', 'attachmentHash', 'worker']);
    if (b.schema !== SCHEMA || b.phase !== 'worker-bound' || b.attachmentHash !== attachmentHash
      || !equal(parseSubscriptionRuntimeBindingV1(b.binding), binding)) refuse();
    worker = parseSubscriptionRuntimeWorkerBindingV1(b.worker, authority);
  }
  const closedBytes = readRecord(runtimePath + '/closed.json', true);
  let closure: SubscriptionRuntimeClosureV1 | null = null;
  if (closedBytes) {
    if (!boundBytes || !worker) refuse();
    const c = exact(parse(closedBytes), ['schema', 'phase', 'binding', 'attachmentHash', 'workerHash', 'closure']);
    if (c.schema !== SCHEMA || c.phase !== 'closed' || c.attachmentHash !== attachmentHash || c.workerHash !== hashOf(boundBytes)
      || !equal(parseSubscriptionRuntimeBindingV1(c.binding), binding)) refuse();
    closure = closureData(c.closure, binding, attachmentHash);
  }
  return freeze({ phase: closure ? 'closed' : worker ? 'worker-bound' : 'prepared', binding, authority, attachmentHash, worker, closure });
}
/** Parent journal DATA only; existence never proves original-process absence. */
export function readSubscriptionRuntimeAttachmentV1(input: Readonly<{
  runtimePath: string; binding: SubscriptionRuntimeBindingV1;
}>): SubscriptionRuntimeAttachmentViewV1 {
  try {
    const v = exact(input, ['runtimePath', 'binding']); if (!isSubscriptionRuntimeCanonicalPathV1(v.runtimePath)) refuse();
    return readView(v.runtimePath, parseSubscriptionRuntimeBindingV1(v.binding));
  } catch { refuse(); }
}
/** Own immutable records; callers must independently possess selected admission. */
export function createSubscriptionRuntimeAttachmentV1(input: Readonly<{
  runtimePath: string; binding: SubscriptionRuntimeBindingV1; authority: SubscriptionRuntimeAuthorityV1;
}>): SubscriptionRuntimeAttachmentV1 {
  try {
    const v = exact(input, ['runtimePath', 'binding', 'authority']);
    if (!isSubscriptionRuntimeCanonicalPathV1(v.runtimePath)) refuse();
    const runtimePath = v.runtimePath, binding = parseSubscriptionRuntimeBindingV1(v.binding);
    const authority = parseSubscriptionRuntimeAuthorityV1(v.authority, binding);
    if (runtimePath === binding.worktree || runtimePath.startsWith(binding.worktree + '/') || binding.worktree.startsWith(runtimePath + '/')) refuse();
    directory(dirname(runtimePath), false);
    try { mkdirSync(runtimePath, { mode: 0o700 }); syncDirectory(dirname(runtimePath)); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error; }
    directory(runtimePath, true);
    const prepared = preparationData(binding, authority);
    writeRecord(runtimePath + '/prepared.json', prepared);
    const attachmentHash = subscriptionRuntimePreparationHashV1(binding, authority);
    // The replay is exact even if later records already exist. Acquisition must
    // separately require phase=prepared before creating another external owner.
    const view = readView(runtimePath, binding); if (view.attachmentHash !== attachmentHash || !equal(view.authority, authority)) refuse();
    return Object.freeze({ attachmentHash,
      async bindWorker(value: SubscriptionRuntimeWorkerBindingV1): Promise<void> {
        try {
          const before = readView(runtimePath, binding); if (before.attachmentHash !== attachmentHash) refuse();
          const worker = parseSubscriptionRuntimeWorkerBindingV1(value, authority);
          writeRecord(runtimePath + '/worker-bound.json', { schema: SCHEMA, phase: 'worker-bound', binding, attachmentHash, worker });
          const after = readView(runtimePath, binding); if (!equal(after.worker, worker)) refuse();
        } catch { refuse(); }
      },
      async publishClosed(value: SubscriptionRuntimeClosureV1): Promise<void> {
        try {
          const before = readView(runtimePath, binding); if (before.attachmentHash !== attachmentHash || !before.worker) refuse();
          const closure = closureData(value, binding, attachmentHash), boundBytes = readRecord(runtimePath + '/worker-bound.json')!;
          writeRecord(runtimePath + '/closed.json', { schema: SCHEMA, phase: 'closed', binding, attachmentHash, workerHash: hashOf(boundBytes), closure });
          const after = readView(runtimePath, binding); if (!equal(after.closure, closure)) refuse();
        } catch { refuse(); }
      },
    });
  } catch { refuse(); }
}
