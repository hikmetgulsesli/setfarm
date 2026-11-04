import { spawn, type ChildProcess } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import { constants, closeSync, fstatSync, fsyncSync, lstatSync, mkdirSync, openSync, readSync,
  readdirSync, readlinkSync, realpathSync, writeSync, type BigIntStats } from 'node:fs';
import { dirname, resolve } from 'node:path';
import type { Readable, Writable } from 'node:stream';
import { types } from 'node:util';
import type { SubscriptionCodingMaterialV1 } from './subscription-coding-policy-v1.js';
import type { SubscriptionOwnedWorkerV1, SubscriptionWorkerClosureV1 } from './subscription-attempt-custody-v1.js';
import type { SubscriptionAttemptBrokerStopV1 } from './subscription-attempt-broker-v1.js';
import { createSubscriptionCredentialRedactorV1 } from './subscription-credential-redactor-v1.js';
import { observeProcessIdentity } from './process-identity.js';
import type { ProcessIdentityV1 } from './schemas/process-identity-v1.js';
import { SUBSCRIPTION_CODING_WORKER_PRELOAD_V1 } from './subscription-coding-worker-preload-v1.js';
import { SUBSCRIPTION_CODING_SANDBOX_POLICY_MAX_BYTES_V1, buildSubscriptionCodingSandboxPolicyV1, buildSubscriptionCodingProbeChallengeV1,
  createSubscriptionCodingTranscriptCloserV1, createSubscriptionCodingCustodyTrackerV1,
  createSubscriptionCodingProbeProtocolV1, subscriptionCodingCanonicalPathV1,
  subscriptionCodingHashV1, subscriptionCodingWorkerRefusedV1,
  subscriptionCodingPublicAncestorAllowedV1,
  narrowSubscriptionCodingWorkerMaterialV1, type SubscriptionCodingCustodyEventV1,
  type SubscriptionCodingProbeProtocolV1, type SubscriptionCodingWriteGrantV1 } from './subscription-coding-worker-policy-v1.js';

import { captureSubscriptionCodingNodeLibrariesV1, type SubscriptionCodingNodeLibrariesV1 } from './subscription-coding-node-libraries-v1.js';

const refuse: () => never = subscriptionCodingWorkerRefusedV1;
const SDK_ROOT = '/opt/homebrew/lib/node_modules/openclaw';
const SANDBOX = '/usr/bin/sandbox-exec';
const OUTPUT_LIMIT = 1048576;
const STARTUP_MS = 10000;
const DRAIN_MS = 2500;
const uid = () => { if (!process.getuid) refuse(); return BigInt(process.getuid()); };

export type SubscriptionCodingWorkerOutputV1 = Readonly<{
  stdout: string; stderr: string; stdoutBytes: number; stderrBytes: number;
  stdoutTruncated: boolean; stderrTruncated: boolean;
  exitCode: number | null; signal: NodeJS.Signals | null;
  processClosed: boolean; stdoutEnded: boolean; stderrEnded: boolean;
  stdoutClosed: boolean; stderrClosed: boolean; streamError: boolean;
  proofHash: string | null; isolationHash: string; materialHash: string;
}>;
export type SubscriptionCodingOwnedWorkerV1 = SubscriptionOwnedWorkerV1 & Readonly<{
  child: ChildProcess; processIdentity: ProcessIdentityV1; openGate(): void; isolationHash: string;
  isolation: Readonly<{ materialHash: string; policyHash: string; preloadHash: string;
    proofHash: string; isolationHash: string }>;
  output: Promise<SubscriptionCodingWorkerOutputV1>;
  originalClosed: Promise<SubscriptionWorkerClosureV1>;
}>;
export type SubscriptionCodingPartialOwnedWorkerV1 = SubscriptionOwnedWorkerV1 & Readonly<{
  child: ChildProcess; processIdentity?: ProcessIdentityV1;
  output: Promise<SubscriptionCodingWorkerOutputV1>;
  originalClosed?: Promise<SubscriptionWorkerClosureV1>;
}>;
export class SubscriptionCodingWorkerStartupErrorV1 extends Error {
  declare readonly ownership: SubscriptionCodingPartialOwnedWorkerV1;
  constructor(ownership: SubscriptionCodingPartialOwnedWorkerV1) {
    super('SUBSCRIPTION_CODING_WORKER_REFUSED');
    Object.defineProperty(this, 'ownership', { value: ownership, enumerable: false, configurable: false, writable: false });
  }
}
/** The actual startup catch uses this path; cleanup acknowledgement never
 * substitutes a new closure or drops an uncertain acquired child. */
export async function rejectSubscriptionCodingWorkerStartupV1(ownership: SubscriptionCodingPartialOwnedWorkerV1): Promise<never> {
  try { await ownership.stop('refused'); } catch {}
  throw new SubscriptionCodingWorkerStartupErrorV1(ownership);
}
type Pin = Readonly<{ path: string; stat: BigIntStats; hash: string }>;
function sameStat(a: BigIntStats, b: BigIntStats): boolean {
  return a.dev === b.dev && a.ino === b.ino && a.mode === b.mode && a.uid === b.uid && a.gid === b.gid
    && a.nlink === b.nlink && a.rdev === b.rdev && a.size === b.size && a.mtimeNs === b.mtimeNs
    && a.ctimeNs === b.ctimeNs && a.birthtimeNs === b.birthtimeNs;
}
function sameObject(a: BigIntStats, b: BigIntStats): boolean {
  return a.dev === b.dev && a.ino === b.ino && a.mode === b.mode && a.uid === b.uid
    && a.gid === b.gid && a.nlink === b.nlink && a.birthtimeNs === b.birthtimeNs;
}
function canonicalDirectory(path: string, privateMode = false): void {
  if (!subscriptionCodingCanonicalPathV1(path) || realpathSync(path) !== path) refuse();
  let current = path;
  while (current !== '/') {
    const stat = lstatSync(current, { bigint: true });
    if (!stat.isDirectory() || stat.isSymbolicLink() || (stat.uid !== uid() && stat.uid !== 0n)) refuse();
    // The root-owned sticky temporary directory is the only shared ancestor.
    if ((stat.mode & 0o022n) !== 0n && !(stat.uid === 0n && (stat.mode & 0o1000n) !== 0n)) refuse();
    current = dirname(current);
  }
  const stat = lstatSync(path, { bigint: true });
  if (privateMode && (stat.uid !== uid() || (stat.mode & 0o7777n) !== 0o700n)) refuse();
}
function safeFileStat(stat: BigIntStats, privateMode: boolean): void {
  if (!stat.isFile() || stat.nlink !== 1n || (stat.uid !== uid() && stat.uid !== 0n)
    || (stat.mode & 0o022n) !== 0n
    || (privateMode && (stat.uid !== uid() || (stat.mode & 0o7777n) !== 0o600n))) refuse();
}
function publicRuntimeDirectory(path: string): void {
  if (!(path === '/usr/bin' || path === '/opt/homebrew' || path.startsWith('/opt/homebrew/'))
    || realpathSync(path) !== path) refuse();
  let current = path;
  while (true) {
    const stat = lstatSync(current, { bigint: true });
    if (!subscriptionCodingPublicAncestorAllowedV1({ path: current, uid: stat.uid, gid: stat.gid,
      mode: stat.mode, currentUid: uid(), directory: stat.isDirectory(), symbolicLink: stat.isSymbolicLink() })) refuse();
    if (current === '/') break;
    current = dirname(current);
  }
}
function pinFile(path: string, privateMode = false, maximum = 268435456,
  directoryCheck: (path: string) => void = canonicalDirectory): Pin {
  directoryCheck(dirname(path));
  if (realpathSync(path) !== path) refuse();
  const before = lstatSync(path, { bigint: true }); safeFileStat(before, privateMode);
  if (before.size < 0n || before.size > BigInt(maximum)) refuse();
  let fd: number | undefined;
  try {
    fd = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
    if (!sameStat(before, fstatSync(fd, { bigint: true }))) refuse();
    const hash = createHash('sha256'), buffer = Buffer.alloc(65536);
    let bytes = 0, count: number;
    while ((count = readSync(fd, buffer, 0, buffer.length, null)) > 0) {
      bytes += count; if (bytes > maximum) refuse(); hash.update(buffer.subarray(0, count));
    }
    const after = fstatSync(fd, { bigint: true });
    if (BigInt(bytes) !== before.size || !sameStat(before, after)
      || !sameStat(after, lstatSync(path, { bigint: true })) || realpathSync(path) !== path) refuse();
    return Object.freeze({ path, stat: after, hash: hash.digest('hex') });
  } finally { if (fd !== undefined) closeSync(fd); }
}
function checkPin(pin: Pin): void {
  if (realpathSync(pin.path) !== pin.path || !sameStat(pin.stat, lstatSync(pin.path, { bigint: true }))) refuse();
}
function readSmall(path: string, maximum = 4096, directoryCheck: (path: string) => void = canonicalDirectory): string {
  const pin = pinFile(path, false, maximum, directoryCheck), bytes = Buffer.alloc(Number(pin.stat.size));
  let fd: number | undefined;
  try {
    fd = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
    if (!sameStat(pin.stat, fstatSync(fd, { bigint: true }))) refuse();
    let offset = 0;
    while (offset < bytes.length) {
      const count = readSync(fd, bytes, offset, bytes.length - offset, null);
      if (!count) refuse(); offset += count;
    }
    if (subscriptionCodingHashV1(bytes) !== pin.hash || !sameStat(pin.stat, fstatSync(fd, { bigint: true }))) refuse();
    checkPin(pin);
    return bytes.toString('utf8');
  } finally { bytes.fill(0); if (fd !== undefined) closeSync(fd); }
}
function createPrivateDirectory(path: string): void {
  canonicalDirectory(dirname(path)); mkdirSync(path, { mode: 0o700 }); canonicalDirectory(path, true);
}
/** Parent prepares the SDK's fixed temp leaf so the child need not chmod it.
 * Nonrecursive mkdir refuses every existing name, including aliases. */
export function prepareSubscriptionCodingSdkTempDirectoryV1(privateRoot: string): string {
  try {
    canonicalDirectory(privateRoot, true);
    const temporaryRoot = privateRoot + '/tmp'; canonicalDirectory(temporaryRoot, true);
    const path = temporaryRoot + '/openclaw-' + uid().toString();
    mkdirSync(path, { mode: 0o700 });
    canonicalDirectory(privateRoot, true); canonicalDirectory(temporaryRoot, true);
    canonicalDirectory(path, true);
    return path;
  } catch { return refuse(); }
}
function createPrivateFile(path: string, contents: string, maximum = 262144): Pin {
  const bytes = Buffer.from(contents);
  if (bytes.length > maximum) refuse();
  canonicalDirectory(dirname(path), true);
  let fd: number | undefined;
  try {
    fd = openSync(path, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
    let offset = 0;
    while (offset < bytes.length) {
      const written = writeSync(fd, bytes, offset, bytes.length - offset);
      if (written <= 0) refuse(); offset += written;
    }
    fsyncSync(fd);
    safeFileStat(fstatSync(fd, { bigint: true }), true);
  } finally { if (fd !== undefined) closeSync(fd); }
  return pinFile(path, true, maximum);
}
export function inspectSubscriptionCodingGitControlPathsV1(worktree: string): Readonly<{
  kind: 'absent' | 'present'; paths: readonly string[];
}> {
  try {
    canonicalDirectory(worktree);
    const pointer = worktree + '/.git';
    try { lstatSync(pointer); }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return Object.freeze({
        kind: 'absent', paths: Object.freeze([pointer]),
      });
      throw error;
    }
    return Object.freeze({ kind: 'present', paths: gitControlPathsPresent(worktree) });
  } catch { refuse(); }
}
function gitControlPathsPresent(worktree: string): readonly string[] {
  const pointer = worktree + '/.git', stat = lstatSync(pointer, { bigint: true });
  let gitdir: string;
  if (stat.isDirectory() && !stat.isSymbolicLink()) gitdir = pointer;
  else {
    safeFileStat(stat, false);
    const match = /^gitdir: ([^\x00\r\n]+)\r?\n?$/.exec(readSmall(pointer));
    if (!match) refuse();
    gitdir = resolve(worktree, match[1]);
  }
  canonicalDirectory(gitdir);
  const paths = [pointer, ...(gitdir === pointer ? [] : [gitdir])];
  const commonPointer = gitdir + '/commondir';
  try {
    const text = readSmall(commonPointer);
    if (!/^[^\x00\r\n]+\r?\n?$/.test(text)) refuse();
    const common = resolve(gitdir, text.trimEnd()); canonicalDirectory(common);
    paths.push(commonPointer, common);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
  return Object.freeze([...new Set(paths)]);
}
export function inspectSubscriptionCodingWorktreeV1(worktree: string, protectedControls: readonly string[]): void {
  try { inspectWorktree(worktree, protectedControls); } catch { refuse(); }
}
function inspectWorktree(worktree: string, protectedControls: readonly string[]): void {
  canonicalDirectory(worktree);
  if (lstatSync(worktree, { bigint: true }).uid !== uid()) refuse();
  if (!Array.isArray(protectedControls) || protectedControls.length > 256
    || !protectedControls.every(subscriptionCodingCanonicalPathV1)) refuse();
  const protectedPaths = [worktree + '/.git', ...protectedControls];
  const protectedTarget = (path: string) => protectedPaths.some(protectedPath =>
    path === protectedPath || path.startsWith(protectedPath + '/')
    || protectedPath.startsWith(path + '/'));
  const inspectBinLink = (path: string): void => {
    if (!/(?:^|\/)node_modules\/\.bin\/[^/]+$/.test(path.slice(worktree.length + 1))) refuse();
    let target = path, count = 0;
    const visited = new Set<string>();
    while (true) {
      if (++count > 64 || visited.has(target) || !target.startsWith(worktree + '/') || protectedTarget(target)) refuse();
      visited.add(target);
      const stat = lstatSync(target, { bigint: true });
      if (stat.uid !== uid()) refuse();
      if (!stat.isSymbolicLink()) {
        if (realpathSync(target) !== target) refuse();
        safeFileStat(stat, false); return;
      }
      target = resolve(dirname(target), readlinkSync(target));
    }
  };
  let entries = 0;
  const visitedDirectories = new Set<string>();
  const inspect = (directory: string, depth: number): void => {
    if (depth > 64) refuse();
    const directoryStat = lstatSync(directory, { bigint: true });
    const directoryKey = String(directoryStat.dev) + ':' + String(directoryStat.ino);
    if (visitedDirectories.has(directoryKey)) refuse();
    visitedDirectories.add(directoryKey);
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      if (directory === worktree && entry.name === '.git') continue;
      if (++entries > 100000) refuse();
      const path = directory + '/' + entry.name;
      if (!subscriptionCodingCanonicalPathV1(path)) refuse();
      const stat = lstatSync(path, { bigint: true });
      if (stat.uid !== uid()) refuse();
      if (stat.isSymbolicLink()) { inspectBinLink(path); continue; }
      if ((stat.mode & 0o022n) !== 0n) refuse();
      if (stat.isDirectory()) inspect(path, depth + 1);
      else if (!stat.isFile() || stat.nlink !== 1n) refuse();
    }
  };
  inspect(worktree, 0);
}
function inspectWriteGrant(grant: SubscriptionCodingWriteGrantV1): void {
  canonicalDirectory(dirname(grant.path));
  let stat: BigIntStats;
  try { stat = lstatSync(grant.path, { bigint: true }); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return;
    throw error;
  }
  if (realpathSync(grant.path) !== grant.path || stat.uid !== uid()) refuse();
  if (grant.kind === 'directory') canonicalDirectory(grant.path);
  else safeFileStat(stat, false);
}
function launchInput(input: unknown) {
  if (!input || typeof input !== 'object' || types.isProxy(input)) refuse();
  const proto = Object.getPrototypeOf(input);
  if (proto !== Object.prototype && proto !== null) refuse();
  const ds = Object.getOwnPropertyDescriptors(input), keys = Reflect.ownKeys(ds);
  if (keys.length !== 5 || keys.some(key => typeof key !== 'string'
    || !['material', 'transcriptPath', 'authorityRoots', 'writeGrants', 'readOnlyControlPaths'].includes(key))
    || Object.values(ds).some(d => !Object.hasOwn(d, 'value'))) refuse();
  const checked = narrowSubscriptionCodingWorkerMaterialV1({ material: ds.material.value,
    writeGrants: ds.writeGrants.value, readOnlyControlPaths: ds.readOnlyControlPaths.value });
  const transcriptPath: unknown = ds.transcriptPath.value, authorityRoots: unknown = ds.authorityRoots.value;
  if (!subscriptionCodingCanonicalPathV1(transcriptPath) || !Array.isArray(authorityRoots) || types.isProxy(authorityRoots)
    || authorityRoots.length < 1 || authorityRoots.length > 32) refuse();
  const ads = Object.getOwnPropertyDescriptors(authorityRoots);
  if (Reflect.ownKeys(ads).length !== authorityRoots.length + 1) refuse();
  const roots = Array.from({ length: authorityRoots.length }, (_, index) => {
    const d = ads[String(index)];
    if (!d || !Object.hasOwn(d, 'value') || !subscriptionCodingCanonicalPathV1(d.value)) refuse();
    return d.value as string;
  });
  return { checked, transcriptPath, authorityRoots: Object.freeze(roots) };
}

/** Physical mechanism only. The Task5 owner must establish genuine selected
 * entry/claim/DB authority, own the broker and markRunning before openGate().
 * No credential facade, installation selection or admission override is used. */
export async function launchSubscriptionCodingWorkerV1(input: Readonly<{
  material: SubscriptionCodingMaterialV1; transcriptPath: string; authorityRoots: readonly string[];
  writeGrants: readonly SubscriptionCodingWriteGrantV1[]; readOnlyControlPaths: readonly string[];
}>): Promise<SubscriptionCodingOwnedWorkerV1> {
  let transcript: number | undefined;
  let transcriptCloser: ReturnType<typeof createSubscriptionCodingTranscriptCloserV1> | undefined;
  let partial: SubscriptionCodingPartialOwnedWorkerV1 | undefined;
  let owned: SubscriptionCodingOwnedWorkerV1 | undefined;
  let nodeLibraries: SubscriptionCodingNodeLibrariesV1 | undefined;
  const publicAncestors: { path: string; stat: BigIntStats; fd: number | undefined }[] = [];
  const closePublicAncestors = (): boolean => {
    let closed = true;
    for (const pin of publicAncestors) {
      const fd = pin.fd; pin.fd = undefined;
      if (fd !== undefined) { try { closeSync(fd); } catch { closed = false; } }
    }
    return closed;
  };
  try {
    const { checked, transcriptPath, authorityRoots } = launchInput(input);
    const { material, root, brokerPort, materialHash, capability } = checked;
    if (process.platform !== 'darwin') refuse();
    const [major, minor] = process.versions.node.split('.').map(Number);
    if (major < 22 || (major === 22 && minor < 19)) refuse();
    const nodePath = realpathSync(process.execPath), sdkRoot = realpathSync(SDK_ROOT);
    const entryPath = sdkRoot + '/openclaw.mjs', preloadPath = root + '/fixed-gate.mjs', profilePath = root + '/profile.sb';
    // Parent-only public metadata capture, with no caller path or backend.
    nodeLibraries = await captureSubscriptionCodingNodeLibrariesV1();
    if (nodeLibraries.nodePath !== nodePath) refuse();
    const lexical = { nodeLibraryPaths: { readPaths: nodeLibraries.readPaths, mapPaths: nodeLibraries.mapPaths }, privateRoot: root, worktree: material.cwd, authorityRoots,
      gitControlPaths: [material.cwd + '/.git'], nodePath, openclawRoot: sdkRoot,
      preloadPath, profilePath, transcriptPath, brokerPort,
      writeGrants: checked.writeGrants, readOnlyControlPaths: checked.readOnlyControlPaths };
    // Pure overlap checks precede private filesystem materialization.
    buildSubscriptionCodingSandboxPolicyV1(lexical);
    publicRuntimeDirectory(sdkRoot); publicRuntimeDirectory(dirname(nodePath));
    inspectSubscriptionCodingWorktreeV1(material.cwd, checked.readOnlyControlPaths);
    checked.writeGrants.forEach(inspectWriteGrant);
    const controlPins = checked.readOnlyControlPaths.map(path => pinFile(path, true, 1048576));
    for (const path of authorityRoots) canonicalDirectory(path);
    canonicalDirectory(dirname(transcriptPath));
    const gitSnapshot = inspectSubscriptionCodingGitControlPathsV1(material.cwd), gitPaths = gitSnapshot.paths;
    const gitFiles = (gitSnapshot.kind === 'present' ? gitPaths : []).filter(path => lstatSync(path).isFile()).map(path => pinFile(path, false, 4096));
    const gitDirectories = (gitSnapshot.kind === 'present' ? gitPaths : []).filter(path => lstatSync(path).isDirectory())
      .map(path => ({ path, stat: lstatSync(path, { bigint: true }) }));
    const policy = buildSubscriptionCodingSandboxPolicyV1({ ...lexical, gitControlPaths: gitPaths });
    const policyHash = subscriptionCodingHashV1(policy), preloadHash = subscriptionCodingHashV1(SUBSCRIPTION_CODING_WORKER_PRELOAD_V1);
    const publicPaths = [nodePath, SANDBOX, entryPath, sdkRoot + '/package.json',
      sdkRoot + '/dist/entry.js', sdkRoot + '/dist/cli/run-main.js'];
    const ancestorPaths = new Set<string>();
    for (const path of publicPaths) {
      let parent = dirname(path);
      while (true) { ancestorPaths.add(parent); if (parent === '/') break; parent = dirname(parent); }
    }
    for (const path of ancestorPaths) {
      const stat = lstatSync(path, { bigint: true });
      const fd = openSync(path, constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW);
      publicAncestors.push({ path, stat, fd });
      if (!sameStat(stat, fstatSync(fd, { bigint: true })) || realpathSync(path) !== path) refuse();
    }
    const publicPins = publicPaths.map(path => pinFile(path, false, 268435456, publicRuntimeDirectory));
    const packageData = JSON.parse(readSmall(sdkRoot + '/package.json', 262144, publicRuntimeDirectory));
    if (packageData.name !== 'openclaw' || packageData.version !== '2026.5.20'
      || packageData.engines?.node !== '>=22.19.0' || dirname(entryPath) !== sdkRoot) refuse();
    createPrivateDirectory(root);
    for (const directory of material.directories) createPrivateDirectory(directory);
    const sdkTempDirectory = prepareSubscriptionCodingSdkTempDirectoryV1(root);
    const privatePins = material.files.map(file => createPrivateFile(file.path, file.contents));
    privatePins.push(createPrivateFile(preloadPath, SUBSCRIPTION_CODING_WORKER_PRELOAD_V1), createPrivateFile(profilePath, policy, SUBSCRIPTION_CODING_SANDBOX_POLICY_MAX_BYTES_V1));
    const privateDirectories = [root, ...material.directories, sdkTempDirectory]
      .map(path => ({ path, stat: lstatSync(path, { bigint: true }) }));
    const fd = openSync(transcriptPath, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
    transcript = fd;
    transcriptCloser = createSubscriptionCodingTranscriptCloserV1(fd, {
      validateAndSync(original) {
        if (!sameObject(transcriptStat, fstatSync(original, { bigint: true }))
          || !sameObject(transcriptStat, lstatSync(transcriptPath, { bigint: true }))) refuse();
        fsyncSync(original);
      },
      close: closeSync,
    });
    transcript = undefined; // Ownership transferred to the one-shot closer.
    const transcriptStat = fstatSync(fd, { bigint: true }); safeFileStat(transcriptStat, true);
    if (!sameObject(transcriptStat, lstatSync(transcriptPath, { bigint: true })) || realpathSync(transcriptPath) !== transcriptPath) refuse();
    const stableCheck = () => {
      nodeLibraries!.recheck();
      for (const pin of publicAncestors) {
        if (pin.fd === undefined || realpathSync(pin.path) !== pin.path
          || !sameStat(pin.stat, fstatSync(pin.fd, { bigint: true }))
          || !sameStat(pin.stat, lstatSync(pin.path, { bigint: true }))) refuse();
      }
      publicRuntimeDirectory(sdkRoot); publicRuntimeDirectory(dirname(nodePath));
      publicPins.forEach(checkPin); privatePins.forEach(checkPin); gitFiles.forEach(checkPin); controlPins.forEach(checkPin);
      checked.writeGrants.forEach(inspectWriteGrant);
      for (const directory of [...gitDirectories, ...privateDirectories]) {
        if (!sameObject(directory.stat, lstatSync(directory.path, { bigint: true }))) refuse();
      }
      canonicalDirectory(root, true);
      for (const directory of material.directories) canonicalDirectory(directory, true);
      for (const path of authorityRoots) canonicalDirectory(path);
      if (JSON.stringify(inspectSubscriptionCodingGitControlPathsV1(material.cwd)) !== JSON.stringify(gitSnapshot)
        || !sameObject(transcriptStat, fstatSync(fd, { bigint: true }))
        || !sameObject(transcriptStat, lstatSync(transcriptPath, { bigint: true }))) refuse();
    };
    stableCheck();

    // From this point onward every original process and stream event is retained
    // before the first await. No later refusal discards the acquired child.
    let child!: ChildProcess, startupDeadline = 0;
    const events = new Set<SubscriptionCodingCustodyEventV1>();
    let originalIdentity: ProcessIdentityV1 | undefined;
    let protocol: SubscriptionCodingProbeProtocolV1 | undefined;
    let tracker: ReturnType<typeof createSubscriptionCodingCustodyTrackerV1> | undefined;
    let exitCode: number | null = null, signal: NodeJS.Signals | null = null, isolationHash = '';
    let settled = false, stopping: Promise<void> | undefined, proofReady = false;
    let startupResolve!: () => void, startupReject!: () => void;
    const startup = new Promise<void>((yes, no) => { startupResolve = yes; startupReject = () => no(new Error('SUBSCRIPTION_CODING_WORKER_REFUSED')); });
    // Attach a rejection consumer immediately, including synchronous startup failure.
    void startup.catch(() => {});
    let resolveClosed!: (value: SubscriptionWorkerClosureV1) => void;
    const closed = new Promise<SubscriptionWorkerClosureV1>(yes => { resolveClosed = yes; });
    let resolveOriginalClosed!: (value: SubscriptionWorkerClosureV1) => void;
    const originalClosed = new Promise<SubscriptionWorkerClosureV1>(yes => { resolveOriginalClosed = yes; });
    let resolveOutput!: (value: SubscriptionCodingWorkerOutputV1) => void;
    const output = new Promise<SubscriptionCodingWorkerOutputV1>(yes => { resolveOutput = yes; });
    let killTimer: ReturnType<typeof setTimeout> | undefined, drainTimer: ReturnType<typeof setTimeout> | undefined;
    let startupTimer: ReturnType<typeof setTimeout> | undefined, lifetimeTimer: ReturnType<typeof setTimeout> | undefined;
    let stdout: Readable | null = null, stderr: Readable | null = null;
    let gate: Writable | null = null, proof: Readable | null = null;
    const captures = {
      stdout: { redactor: createSubscriptionCredentialRedactorV1(capability), chunks: [] as Buffer[], raw: 0, saved: 0, truncated: false, finished: false },
      stderr: { redactor: createSubscriptionCredentialRedactorV1(capability), chunks: [] as Buffer[], raw: 0, saved: 0, truncated: false, finished: false },
    };
    const record = (event: SubscriptionCodingCustodyEventV1) => { events.add(event); tracker?.observe(event); };
    const allOriginalClosed = () => ['child-exit', 'child-close', 'stdout-end', 'stdout-close', 'stderr-end', 'stderr-close']
      .every(event => events.has(event as SubscriptionCodingCustodyEventV1));
    const finish = (status: SubscriptionWorkerClosureV1['status']) => {
      if (settled) return; settled = true;
      for (const timer of [killTimer, drainTimer, startupTimer, lifetimeTimer]) if (timer) clearTimeout(timer);
      for (const capture of Object.values(captures)) if (!capture.finished) { capture.redactor.discard(); capture.finished = true; }
      if (transcriptCloser?.close() !== 'closed') status = 'custody-uncertain';
      if (!closePublicAncestors()) status = 'custody-uncertain';
      if (nodeLibraries?.close() !== 'closed') status = 'custody-uncertain';
      resolveClosed(Object.freeze({ status }));
      resolveOutput(Object.freeze({
        stdout: Buffer.concat(captures.stdout.chunks).toString('utf8'), stderr: Buffer.concat(captures.stderr.chunks).toString('utf8'),
        stdoutBytes: captures.stdout.raw, stderrBytes: captures.stderr.raw,
        stdoutTruncated: captures.stdout.truncated, stderrTruncated: captures.stderr.truncated,
        exitCode, signal, processClosed: events.has('child-close'), stdoutEnded: events.has('stdout-end'),
        stderrEnded: events.has('stderr-end'), stdoutClosed: events.has('stdout-close'), stderrClosed: events.has('stderr-close'),
        streamError: events.has('stdout-error') || events.has('stderr-error'),
        proofHash: protocol?.proofHash ?? null, isolationHash, materialHash,
      }));
      try { gate?.destroy(); } catch {}
      // Original process/stream handles and the genuine originalClosed promise
      // stay retained after an uncertain deadline; no synthetic EOF is created.
      if (allOriginalClosed()) { try { proof?.destroy(); } catch {} }
    };
    const maybeFinish = () => {
      if (allOriginalClosed()) {
        const status = tracker?.status === 'closed' ? 'closed' : 'custody-uncertain';
        resolveOriginalClosed(Object.freeze({ status })); finish(status);
      }
    };
    const signalOriginal = (requested: NodeJS.Signals) => {
      if (!originalIdentity || events.has('child-exit') || events.has('child-close')) return;
      const current = observeProcessIdentity(originalIdentity.pid);
      if (!tracker?.canSignal(current ?? null)) return;
      try { process.kill(originalIdentity.pid, requested); } catch {}
    };
    const stop = (_reason: SubscriptionAttemptBrokerStopV1): Promise<void> => {
      if (stopping) return stopping;
      stopping = (async () => {
        try { gate?.destroy(); } catch {}
        signalOriginal('SIGTERM');
        if (!settled) {
          killTimer = setTimeout(() => signalOriginal('SIGKILL'), 2000);
          drainTimer = setTimeout(() => { record('deadline'); finish('custody-uncertain'); }, DRAIN_MS);
        }
        maybeFinish(); await closed;
      })();
      return stopping;
    };
    const fault = () => { startupReject(); void stop('refused'); };
    const publish = (name: 'stdout' | 'stderr', bytes: Buffer) => {
      if (!bytes.length || settled) return;
      const capture = captures[name], room = OUTPUT_LIMIT - capture.saved;
      const saved = bytes.subarray(0, Math.max(0, room));
      if (saved.length) {
        capture.chunks.push(Buffer.from(saved)); capture.saved += saved.length;
        try {
          const row = Buffer.from(JSON.stringify({ stream: name, text: saved.toString('utf8') }) + '\n');
          let offset = 0;
          while (offset < row.length) {
            const written = writeSync(fd, row, offset, row.length - offset);
            if (written <= 0) refuse(); offset += written;
          }
        } catch { record(name === 'stdout' ? 'stdout-error' : 'stderr-error'); fault(); }
      }
      if (saved.length !== bytes.length) { capture.truncated = true; fault(); }
    };
    const attachStream = (name: 'stdout' | 'stderr', stream: Readable | null) => {
      if (!stream) { record(name === 'stdout' ? 'stdout-error' : 'stderr-error'); fault(); return; }
      stream.on('data', (chunk: Buffer) => {
        if (settled) return;
        const capture = captures[name];
        capture.raw = Math.min(Number.MAX_SAFE_INTEGER, capture.raw + chunk.length);
        if (capture.raw > OUTPUT_LIMIT) {
          capture.truncated = true; capture.redactor.discard(); capture.finished = true;
          fault(); return;
        }
        try { publish(name, capture.redactor.push(chunk)); } catch { record(name === 'stdout' ? 'stdout-error' : 'stderr-error'); fault(); }
      });
      stream.once('end', () => {
        const capture = captures[name];
        if (!capture.finished) { capture.finished = true; try { publish(name, capture.redactor.finish()); } catch { record(name === 'stdout' ? 'stdout-error' : 'stderr-error'); fault(); } }
        record(name === 'stdout' ? 'stdout-end' : 'stderr-end'); maybeFinish();
      });
      stream.once('close', () => { record(name === 'stdout' ? 'stdout-close' : 'stderr-close'); maybeFinish(); });
      stream.once('error', () => { record(name === 'stdout' ? 'stdout-error' : 'stderr-error'); fault(); });
    };
    // All fallible setup without a child is complete. Retain the actual partial
    // owner immediately after spawn, before observation, validation or awaiting.
    child = spawn(SANDBOX, ['-f', profilePath, nodePath, '--import', preloadPath, entryPath, ...material.argv],
      { shell: false, cwd: material.cwd, env: { ...material.env }, stdio: ['ignore', 'pipe', 'pipe', 'pipe', 'pipe'] });
    startupDeadline = performance.now() + STARTUP_MS;
    stdout = child.stdout; stderr = child.stderr;
    gate = child.stdio[3] as Writable | null; proof = child.stdio[4] as Readable | null;
    partial = Object.freeze({ identity: material.identity, child, closed, originalClosed, output, stop,
      get processIdentity() { return originalIdentity; } });
    child.once('exit', (code, termination) => {
      exitCode = code; signal = termination; record('child-exit');
      if (!proofReady) startupReject();
      void stop('completed'); maybeFinish();
    });
    child.once('close', () => { record('child-close'); maybeFinish(); });
    child.once('error', () => { record('child-error'); fault(); });
    attachStream('stdout', stdout); attachStream('stderr', stderr);
    gate?.once('error', fault);
    if (!gate || !proof || !child.pid) fault();
    proof?.on('data', (chunk: Buffer) => {
      try {
        if (!protocol) refuse();
        protocol.accept(chunk);
        if (protocol.state === 'ready') { proofReady = true; startupResolve(); }
      } catch { record('child-error'); fault(); }
    });
    proof?.once('end', () => { try { protocol?.end(); } catch { record('child-error'); fault(); } });
    proof?.once('error', () => { record('child-error'); fault(); });
    startupTimer = setTimeout(fault, STARTUP_MS);
    lifetimeTimer = setTimeout(() => { void stop('deadline'); }, 1800000);

    // Acquisition has cleanup registered before observing or awaiting anything.
    if (!child.pid || !gate || !proof) refuse();
    originalIdentity = observeProcessIdentity(child.pid);
    if (!originalIdentity || originalIdentity.source !== 'observed_os' || originalIdentity.processGroupId === undefined) refuse();
    originalIdentity = Object.freeze({ ...originalIdentity });
    const binding = { nonce: randomBytes(32).toString('hex'), pid: child.pid, identity: material.identity,
      materialHash, policyHash, preloadHash };
    protocol = createSubscriptionCodingProbeProtocolV1(binding);
    tracker = createSubscriptionCodingCustodyTrackerV1(originalIdentity, protocol);
    for (const event of events) tracker.observe(event);
    if (!tracker.canSignal(observeProcessIdentity(child.pid) ?? null)) refuse();
    const challenge = JSON.stringify(buildSubscriptionCodingProbeChallengeV1({ binding,
      profilePath, preloadPath, credentialProbePath: authorityRoots[0],
      brokerPort, nodePath, argvHash: subscriptionCodingHashV1(JSON.stringify([entryPath, ...material.argv])),
      environmentHash: subscriptionCodingHashV1(JSON.stringify(Object.fromEntries(Object.entries(material.env).sort(([a], [b]) => a.localeCompare(b))))),
      files: material.files.map(file => ({ path: file.path, hash: subscriptionCodingHashV1(file.contents) })),
    })) + '\n';
    if (Buffer.byteLength(challenge) > 16384 || stopping || performance.now() >= startupDeadline) refuse();
    gate.write(challenge, error => { if (error) fault(); });
    await startup;
    stableCheck();
    inspectSubscriptionCodingWorktreeV1(material.cwd, checked.readOnlyControlPaths);
    for (const pin of publicPins) {
      const fresh = pinFile(pin.path, false, 268435456, publicRuntimeDirectory);
      if (!sameStat(pin.stat, fresh.stat) || pin.hash !== fresh.hash) refuse();
    }
    if (stopping || performance.now() >= startupDeadline || protocol.state !== 'ready'
      || !tracker.canSignal(observeProcessIdentity(child.pid) ?? null)) refuse();
    isolationHash = subscriptionCodingHashV1(JSON.stringify({ schema: 'setfarm.subscription-coding-isolation.v1',
      materialHash, policyHash, preloadHash, nodeLibraryClosureHash: nodeLibraries.closureHash, processIdentity: originalIdentity, proofHash: protocol.proofHash,
      controls: controlPins.map(pin => ({ path: pin.path, hash: pin.hash, dev: String(pin.stat.dev), ino: String(pin.stat.ino) })),
      publicAncestors: publicAncestors.map(pin => ({ path: pin.path, dev: String(pin.stat.dev), ino: String(pin.stat.ino),
        uid: String(pin.stat.uid), gid: String(pin.stat.gid), mode: String(pin.stat.mode),
        mtimeNs: String(pin.stat.mtimeNs), ctimeNs: String(pin.stat.ctimeNs), birthtimeNs: String(pin.stat.birthtimeNs) })),
      publicFiles: publicPins.map(pin => ({ path: pin.path, hash: pin.hash, dev: String(pin.stat.dev), ino: String(pin.stat.ino) })) }));
    owned = Object.freeze({
      identity: material.identity, child, processIdentity: Object.freeze({ ...originalIdentity }), closed, originalClosed, output,
      isolationHash, isolation: Object.freeze({ materialHash, policyHash, preloadHash,
        proofHash: protocol.proofHash!, isolationHash }), stop,
      openGate() {
        try {
          stableCheck();
          if (stopping || performance.now() >= startupDeadline || !tracker!.canSignal(observeProcessIdentity(child.pid!) ?? null)) refuse();
          gate.write(protocol!.openGate(), error => { if (error) fault(); });
        } catch { fault(); refuse(); }
      },
    });
    return owned;
  } catch {
    if (partial) return rejectSubscriptionCodingWorkerStartupV1(partial);
    closePublicAncestors();
    nodeLibraries?.close();
    if (transcriptCloser) transcriptCloser.close();
    if (transcript !== undefined) {
      const original = transcript; transcript = undefined;
      try { closeSync(original); } catch {}
    }
    refuse();
  }
}
