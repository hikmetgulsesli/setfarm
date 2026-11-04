/** Import-inert filesystem DATA reader. A path/UID conveys no operational authority. */
import fs, { type BigIntStats } from 'node:fs';
import path from 'node:path';
import type { SubscriptionModelRefV1 } from './subscription-coding-policy-v1.js';
import { createSubscriptionCredentialRedactorV1 } from './subscription-credential-redactor-v1.js';

const CODE = 'SUBSCRIPTION_CREDENTIAL_REFUSED';
const fields = ['dev', 'ino', 'mode', 'uid', 'gid', 'nlink', 'size', 'mtimeNs', 'ctimeNs', 'birthtimeNs'] as const;
type HeldDirectory = { name: string; fd: number; before: BigIntStats };

function refuse(): never { throw new Error(CODE); }
function same(before: BigIntStats, after: BigIntStats): boolean {
  return fields.every(field => before[field] === after[field]);
}
function privateDirectory(stat: BigIntStats, uid: bigint): void {
  if (!stat.isDirectory() || stat.uid !== uid || (stat.mode & 0o7777n) !== 0o700n) refuse();
}
function privateFile(stat: BigIntStats, uid: bigint): void {
  if (!stat.isFile() || stat.uid !== uid || (stat.mode & 0o7777n) !== 0o600n
    || stat.nlink !== 1n || stat.size <= 0n || stat.size > 4096n) refuse();
}
function canonicalDirectory(value: unknown): asserts value is string {
  if (typeof value !== 'string' || !path.isAbsolute(value) || value === '/'
    || value.length > 4096 || /[\\\x00-\x1f\x7f]/.test(value)
    || value.endsWith('/') || value.includes('//') || path.normalize(value) !== value
    || fs.realpathSync(value) !== value) refuse();
}
function recheckParents(parents: readonly HeldDirectory[], uid: bigint): void {
  for (const parent of parents) {
    const held = fs.fstatSync(parent.fd, { bigint: true });
    const named = fs.lstatSync(parent.name, { bigint: true });
    privateDirectory(held, uid); privateDirectory(named, uid);
    if (!same(parent.before, held) || !same(parent.before, named)
      || fs.realpathSync(parent.name) !== parent.name) refuse();
  }
}
function parseRecord(bytes: Buffer, modelRef: SubscriptionModelRefV1, providerId: 'minimax' | 'kimi'): string {
  let value: Record<string, unknown> | undefined;
  try {
    const parsed: unknown = JSON.parse(bytes.toString('utf8'));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) refuse();
    value = parsed as Record<string, unknown>;
    const keys = Object.keys(value);
    if (keys.length !== 4 || keys.some(key => !['schema', 'providerId', 'modelRef', 'credential'].includes(key))
      || value.schema !== 'setfarm.subscription-credential.v1' || value.providerId !== providerId
      || value.modelRef !== modelRef || typeof value.credential !== 'string') refuse();
    // Owned record convention: exact JSON roundtrip plus LF, preserving member
    // order. This rejects duplicate keys, whitespace ambiguity and invalid UTF-8.
    if (!bytes.equals(Buffer.from(JSON.stringify(value) + '\n'))) refuse();
    if (providerId === 'minimax' && !value.credential.startsWith('sk-cp')) refuse();
    const redactor = createSubscriptionCredentialRedactorV1(value.credential);
    redactor.discard(); // Apply the existing finite-spelling secret constraints.
    return value.credential;
  } finally {
    // Drop local references; JavaScript strings cannot be securely erased.
    if (value) value.credential = undefined;
    value = undefined;
  }
}

/**
 * Reads only a fixed record beneath the supplied DATA directory; never provisions
 * or grants installation admission. Ancestors above it need not be mode 0700.
 * Node pathname opens are not atomic openat traversal: private owned installation
 * ancestry and held descriptor/name rechecks are the boundary used here.
 */
export function readSubscriptionCredentialRecordV1(input: Readonly<{
  installationDirectory: string; expectedUid: number; modelRef: SubscriptionModelRefV1;
}>): string {
  const descriptors: number[] = [], parents: HeldDirectory[] = [];
  let bytes: Buffer | undefined, credential: string | undefined, failed = false;
  try {
    const { installationDirectory, expectedUid, modelRef } = input;
    canonicalDirectory(installationDirectory);
    if (!Number.isSafeInteger(expectedUid) || expectedUid < 0
      || (modelRef !== 'minimax/MiniMax-M3.1-Flash' && modelRef !== 'kimi/k3.1-pro')) refuse();
    const uid = BigInt(expectedUid), providerId = modelRef === 'minimax/MiniMax-M3.1-Flash' ? 'minimax' : 'kimi';
    for (const name of [installationDirectory, path.join(installationDirectory, 'credentials'),
      path.join(installationDirectory, 'credentials', 'coding-subscriptions')]) {
      const before = fs.lstatSync(name, { bigint: true });
      privateDirectory(before, uid);
      if (fs.realpathSync(name) !== name) refuse();
      const fd = fs.openSync(name, fs.constants.O_RDONLY | fs.constants.O_DIRECTORY
        | fs.constants.O_NOFOLLOW | fs.constants.O_NONBLOCK);
      descriptors.push(fd);
      const held = fs.fstatSync(fd, { bigint: true });
      privateDirectory(held, uid);
      if (!same(before, held)) refuse();
      parents.push({ name, fd, before });
    }
    recheckParents(parents, uid);
    const name = path.join(parents[2]!.name, providerId + '.json');
    const namedBefore = fs.lstatSync(name, { bigint: true });
    privateFile(namedBefore, uid);
    if (fs.realpathSync(name) !== name) refuse();
    const fd = fs.openSync(name, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW | fs.constants.O_NONBLOCK);
    descriptors.push(fd);
    const before = fs.fstatSync(fd, { bigint: true });
    const namedAtOpen = fs.lstatSync(name, { bigint: true });
    privateFile(before, uid); privateFile(namedAtOpen, uid);
    if (!same(namedBefore, before) || !same(before, namedAtOpen)) refuse();
    recheckParents(parents, uid); // All leaf and parent identities checked before body access.
    bytes = Buffer.alloc(Number(before.size));
    let offset = 0;
    while (offset < bytes.length) {
      const count = fs.readSync(fd, bytes, offset, bytes.length - offset, null);
      if (count <= 0) refuse();
      offset += count;
    }
    const extra = Buffer.alloc(1);
    try { if (fs.readSync(fd, extra, 0, 1, null) !== 0) refuse(); }
    finally { extra.fill(0); }
    const after = fs.fstatSync(fd, { bigint: true }), namedAfter = fs.lstatSync(name, { bigint: true });
    privateFile(after, uid); privateFile(namedAfter, uid);
    if (!same(before, after) || !same(before, namedAfter) || fs.realpathSync(name) !== name) refuse();
    recheckParents(parents, uid);
    credential = parseRecord(bytes, modelRef, providerId);
  } catch {
    failed = true;
  } finally {
    bytes?.fill(0); bytes = undefined;
    // Try each owned descriptor once even if closing another descriptor fails.
    for (const fd of descriptors.reverse()) {
      try { fs.closeSync(fd); } catch { failed = true; }
    }
  }
  try {
    if (failed || credential === undefined) refuse();
    return credential;
  } finally { credential = undefined; }
}
