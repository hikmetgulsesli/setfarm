import { randomUUID } from "node:crypto";
import {
  closeSync,
  existsSync,
  fstatSync,
  fsyncSync,
  lstatSync,
  openSync,
  readFileSync,
  readdirSync,
  statfsSync,
  type BigIntStats,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { z } from "zod";

import { canonicalJsonStringify } from "../product-compiler/canonical-json.js";
import { observeProcessIdentity } from "./process-identity.js";
import {
  ProcessIdentityV1Schema,
  sameProcessIdentity,
} from "./schemas/process-identity-v1.js";

export const DEFAULT_V3_SEAL_CAPACITY_LIMITS = Object.freeze({
  rootQuotaBytes: 64 * 1024 * 1024 * 1024,
  maxSealCount: 256,
  minFreeBytes: 2 * 1024 * 1024 * 1024,
});

export type V3SealCapacityLimits = Readonly<{
  rootQuotaBytes: number;
  maxSealCount: number;
  minFreeBytes: number;
}>;

export type V3SealCapacityReservation = Readonly<{
  admitWrite(byteLength: number): void;
}>;

const V3SealCapacityLockV1Schema = z.object({
  schema: z.literal("setfarm.v3-seal-capacity-lock.v1"),
  token: z.string().uuid(),
  ownerIdentity: ProcessIdentityV1Schema,
  acquiredAt: z.string().datetime({ offset: true }),
}).strict();

type V3SealCapacityLockV1 = z.infer<typeof V3SealCapacityLockV1Schema>;

type V3SealCapacityLockIdentityV2 = Readonly<{
  device: bigint;
  inode: bigint;
  ownerUid: bigint;
  ownerGid: bigint;
  objectKind: "ordinary_file";
}>;

function fail(code: string, detail: string): never {
  throw new Error(`${code}:${detail.slice(0, 500)}`);
}

function exactCapacityLockIdentityFromStat(
  stat: BigIntStats,
): V3SealCapacityLockIdentityV2 | undefined {
  if (stat.isSymbolicLink() || !stat.isFile() || stat.nlink !== 1n) {
    return undefined;
  }
  return Object.freeze({
    device: stat.dev,
    inode: stat.ino,
    ownerUid: stat.uid,
    ownerGid: stat.gid,
    objectKind: "ordinary_file" as const,
  });
}

function sameCapacityLockIdentity(
  left: V3SealCapacityLockIdentityV2,
  right: V3SealCapacityLockIdentityV2,
): boolean {
  return left.device === right.device
    && left.inode === right.inode
    && left.ownerUid === right.ownerUid
    && left.ownerGid === right.ownerGid
    && left.objectKind === right.objectKind;
}

function captureCapacityLockIdentity(filePath: string): V3SealCapacityLockIdentityV2 {
  const stat = lstatSync(filePath, { bigint: true }) as BigIntStats;
  const identity = exactCapacityLockIdentityFromStat(stat);
  if (!identity) fail("V3_DEPLOY_SEAL_CAPACITY_LOCK_INVALID", filePath);
  return identity;
}

function assertCapacityLockIdentityCurrent(
  filePath: string,
  expected: V3SealCapacityLockIdentityV2,
): void {
  const observed = captureCapacityLockIdentity(filePath);
  if (!sameCapacityLockIdentity(observed, expected)) {
    fail("V3_DEPLOY_SEAL_CAPACITY_LOCK_CHANGED", filePath);
  }
}

function safeNonNegative(value: number, label: string): number {
  if (!Number.isSafeInteger(value) || value < 0) throw new TypeError(`${label} must be a non-negative safe integer`);
  return value;
}

export function normalizeV3SealCapacityLimits(
  input: V3SealCapacityLimits,
): V3SealCapacityLimits {
  const limits = {
    rootQuotaBytes: safeNonNegative(input.rootQuotaBytes, "rootQuotaBytes"),
    maxSealCount: safeNonNegative(input.maxSealCount, "maxSealCount"),
    minFreeBytes: safeNonNegative(input.minFreeBytes, "minFreeBytes"),
  };
  if (limits.rootQuotaBytes === 0 || limits.maxSealCount === 0) {
    throw new TypeError("v3 seal root quota and seal count must be positive");
  }
  return Object.freeze(limits);
}

function fsyncDirectory(directoryPath: string): void {
  const descriptor = openSync(directoryPath, "r");
  try { fsyncSync(descriptor); } finally { closeSync(descriptor); }
}

function capacityLockBytes(lock: V3SealCapacityLockV1): string {
  return `${canonicalJsonStringify(lock)}\n`;
}

function readCapacityLock(filePath: string): Readonly<{
  lock: V3SealCapacityLockV1;
  bytes: string;
  identity: V3SealCapacityLockIdentityV2;
}> {
  const stats = lstatSync(filePath);
  if (!stats.isFile() || stats.isSymbolicLink() || (stats.mode & 0o777) !== 0o600) {
    fail("V3_DEPLOY_SEAL_CAPACITY_LOCK_INVALID", filePath);
  }
  const beforeExact = captureCapacityLockIdentity(filePath);
  const bytes = readFileSync(filePath, "utf8");
  const afterExact = captureCapacityLockIdentity(filePath);
  if (!sameCapacityLockIdentity(beforeExact, afterExact)) {
    fail("V3_DEPLOY_SEAL_CAPACITY_LOCK_CHANGED", filePath);
  }
  let lock: V3SealCapacityLockV1;
  try {
    lock = V3SealCapacityLockV1Schema.parse(JSON.parse(bytes));
  } catch (error) {
    fail("V3_DEPLOY_SEAL_CAPACITY_LOCK_INVALID", String(error));
  }
  if (bytes !== capacityLockBytes(lock)) fail("V3_DEPLOY_SEAL_CAPACITY_LOCK_INVALID", filePath);
  return { lock, bytes, identity: afterExact };
}

function writeCapacityLock(
  filePath: string,
  lock: V3SealCapacityLockV1,
): V3SealCapacityLockIdentityV2 | false {
  let descriptor: number | undefined;
  try {
    descriptor = openSync(filePath, "wx", 0o600);
    writeFileSync(descriptor, capacityLockBytes(lock), "utf8");
    fsyncSync(descriptor);
    const descriptorStat = fstatSync(descriptor, { bigint: true }) as BigIntStats;
    const descriptorIdentity = exactCapacityLockIdentityFromStat(descriptorStat);
    if (!descriptorIdentity) fail("V3_DEPLOY_SEAL_CAPACITY_LOCK_INVALID", filePath);
    closeSync(descriptor);
    descriptor = undefined;
    fsyncDirectory(path.dirname(filePath));
    const pathIdentity = captureCapacityLockIdentity(filePath);
    if (!sameCapacityLockIdentity(descriptorIdentity, pathIdentity)) {
      fail("V3_DEPLOY_SEAL_CAPACITY_LOCK_CHANGED", filePath);
    }
    return descriptorIdentity;
  } catch (error) {
    if (descriptor !== undefined) closeSync(descriptor);
    if ((error as NodeJS.ErrnoException).code === "EEXIST") return false;
    throw error;
  }
}

function ownerStatus(lock: V3SealCapacityLockV1): "alive" | "dead" | "unknown" {
  const observed = observeProcessIdentity(lock.ownerIdentity.pid);
  if (observed) return sameProcessIdentity(lock.ownerIdentity, observed) ? "alive" : "dead";
  try {
    process.kill(lock.ownerIdentity.pid, 0);
    return "unknown";
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === "ESRCH" ? "dead" : "unknown";
  }
}

async function acquireCapacityLock(sealedRoot: string): Promise<Readonly<{
  filePath: string;
  value: V3SealCapacityLockV1;
  bytes: string;
  identity: V3SealCapacityLockIdentityV2;
}>> {
  const ownerIdentity = observeProcessIdentity(process.pid);
  if (!ownerIdentity) fail("V3_DEPLOY_SEAL_CAPACITY_LOCK_OWNER_UNAVAILABLE", String(process.pid));
  const value = V3SealCapacityLockV1Schema.parse({
    schema: "setfarm.v3-seal-capacity-lock.v1",
    token: randomUUID(),
    ownerIdentity,
    acquiredAt: new Date().toISOString(),
  });
  const filePath = path.join(sealedRoot, ".capacity.lock");
  const startedAt = Date.now();
  while (Date.now() - startedAt < 120_000) {
    const createdIdentity = writeCapacityLock(filePath, value);
    if (createdIdentity) {
      return {
        filePath,
        value,
        bytes: capacityLockBytes(value),
        identity: createdIdentity,
      };
    }
    const observed = readCapacityLock(filePath);
    const status = ownerStatus(observed.lock);
    if (status === "unknown") fail("V3_DEPLOY_SEAL_CAPACITY_LOCK_OWNER_AMBIGUOUS", filePath);
    if (status === "dead") {
      const reread = readCapacityLock(filePath);
      if (
        reread.bytes !== observed.bytes
        || !sameCapacityLockIdentity(reread.identity, observed.identity)
      ) {
        fail("V3_DEPLOY_SEAL_CAPACITY_LOCK_CHANGED", filePath);
      }
      assertCapacityLockIdentityCurrent(filePath, observed.identity);
      unlinkSync(filePath);
      fsyncDirectory(sealedRoot);
      continue;
    }
    await delay(25);
  }
  fail("V3_DEPLOY_SEAL_CAPACITY_LOCK_TIMEOUT", sealedRoot);
}

function releaseCapacityLock(input: Readonly<{
  filePath: string;
  bytes: string;
  identity: V3SealCapacityLockIdentityV2;
}>): void {
  const observed = readCapacityLock(input.filePath);
  if (
    observed.bytes !== input.bytes
    || !sameCapacityLockIdentity(observed.identity, input.identity)
  ) {
    fail("V3_DEPLOY_SEAL_CAPACITY_LOCK_OWNERSHIP_MISMATCH", input.filePath);
  }
  assertCapacityLockIdentityCurrent(input.filePath, input.identity);
  unlinkSync(input.filePath);
  fsyncDirectory(path.dirname(input.filePath));
}

function measureSealRoot(sealedRoot: string): Readonly<{
  rootBytes: number;
  sealCount: number;
}> {
  let rootBytes = 0;
  let sealCount = 0;
  const visit = (absolutePath: string): void => {
    const stats = lstatSync(absolutePath);
    if (stats.isSymbolicLink()) fail("V3_DEPLOY_SEAL_CAPACITY_PATH_UNSAFE", absolutePath);
    if (stats.isDirectory()) {
      for (const entry of readdirSync(absolutePath).sort()) {
        if (absolutePath === sealedRoot && entry === ".capacity.lock") continue;
        visit(path.join(absolutePath, entry));
      }
      return;
    }
    if (!stats.isFile()) fail("V3_DEPLOY_SEAL_CAPACITY_PATH_UNSAFE", absolutePath);
    rootBytes += stats.size;
    if (!Number.isSafeInteger(rootBytes)) fail("V3_DEPLOY_SEAL_CAPACITY_SIZE_OVERFLOW", absolutePath);
    if (absolutePath.endsWith(".authority.json")) sealCount += 1;
  };
  visit(sealedRoot);
  return { rootBytes, sealCount };
}

function freeBytes(sealedRoot: string): number {
  const filesystem = statfsSync(sealedRoot);
  const bytes = Number(filesystem.bavail) * Number(filesystem.bsize);
  if (!Number.isSafeInteger(bytes) || bytes < 0) {
    fail("V3_DEPLOY_SEAL_CAPACITY_FREE_SPACE_INVALID", sealedRoot);
  }
  return bytes;
}

export async function withV3SealCapacityAdmission<T>(input: Readonly<{
  sealedRoot: string;
  createsSeal: boolean;
  limits?: V3SealCapacityLimits;
  operation(reservation: V3SealCapacityReservation): Promise<T>;
}>): Promise<T> {
  if (!existsSync(input.sealedRoot)) fail("V3_DEPLOY_SEAL_CAPACITY_ROOT_MISSING", input.sealedRoot);
  const limits = normalizeV3SealCapacityLimits(input.limits ?? DEFAULT_V3_SEAL_CAPACITY_LIMITS);
  const lock = await acquireCapacityLock(input.sealedRoot);
  try {
    const measured = measureSealRoot(input.sealedRoot);
    if (input.createsSeal && measured.sealCount + 1 > limits.maxSealCount) {
      fail("V3_DEPLOY_SEAL_COUNT_QUOTA_EXCEEDED", String(measured.sealCount + 1));
    }
    let admittedBytes = 0;
    const reservation: V3SealCapacityReservation = Object.freeze({
      admitWrite(byteLength: number): void {
        const nextBytes = safeNonNegative(byteLength, "seal write byteLength");
        if (!input.createsSeal && nextBytes > 0) {
          fail("V3_DEPLOY_SEAL_EXISTING_ROOT_WRITE_FORBIDDEN", String(nextBytes));
        }
        const projectedAdmitted = admittedBytes + nextBytes;
        const projectedRootBytes = measured.rootBytes + projectedAdmitted;
        if (!Number.isSafeInteger(projectedRootBytes) || projectedRootBytes > limits.rootQuotaBytes) {
          fail("V3_DEPLOY_SEAL_ROOT_QUOTA_EXCEEDED", String(projectedRootBytes));
        }
        const available = freeBytes(input.sealedRoot);
        if (available - nextBytes < limits.minFreeBytes) {
          fail("V3_DEPLOY_SEAL_FREE_SPACE_LOW", String(available));
        }
        admittedBytes = projectedAdmitted;
      },
    });
    return await input.operation(reservation);
  } finally {
    releaseCapacityLock(lock);
  }
}
