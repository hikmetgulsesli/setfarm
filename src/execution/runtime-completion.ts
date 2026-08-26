import { createHash, randomUUID } from "node:crypto";
import { AsyncLocalStorage } from "node:async_hooks";
import { execFileSync } from "node:child_process";
import { mkdirSync, openSync, closeSync, fsyncSync, fstatSync, lstatSync, readFileSync, readSync, readdirSync, writeFileSync, linkSync, unlinkSync, constants } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import type postgres from "postgres";
import { z } from "zod";

import { readDatabaseWallClock } from "../db/database-wall-clock.js";
import { assertClaimAuthority, parseClaimEnvelope } from "./claim-authority.js";
import type { ClaimEnvelopeV1 } from "./schemas/claim-envelope-v1.js";
import {
  createRuntimeCompletionPlanV1,
  RuntimeCompletionPlanDescriptorV1Schema,
  RuntimeCompletionPlanV1Schema,
  type RuntimeCompletionPlanDescriptorV1,
  type RuntimeCompletionPlanV1,
} from "./schemas/runtime-completion-plan-v1.js";
import {
  loadAndRevalidateV3StoryClaimRuntimeBindingV1,
  type V3StoryClaimRuntimeSubjectV1,
} from "./v3-story-claim-runtime-binding-v1.js";
import {
  RuntimeCompletionSubmissionEvidenceV1Schema,
  type RuntimeCompletionSubmissionEvidenceV1,
} from "./schemas/runtime-completion-submission-evidence-v1.js";
import { canonicalJsonStringify, hashCanonicalJson } from "../product-compiler/canonical-json.js";
import { releaseDrainedRuntimeSessionInTransaction } from "./runtime-session-repository.js";
import { currentRuntimeCompletionOwnerCapability } from "./runtime-completion-owner-context.js";
import { compileV3ImplementationTransportProposalV1 } from "./v3-implementation-output.js";
import { compileV3ImplementationCompletionProposal } from "./v3-implementation-completion.js";
import { v3RecoveryStoryLockIdentity } from "../recovery/v3-recovery-claim-authority.js";
import { assertRuntimeCompletionManifestInTransactionV1 } from "./runtime-completion-manifest-authority-v1.js";
import {
  beginOrAdoptInternalProductionOwnerReservationV1,
  bindInternalProductionOwnerReservationV1,
  closeInternalProductionOwnerReservationV1,
  lockInternalProductionBaselineCompletionOwnerBootstrapReleaseInTransactionV1,
  lockInternalProductionBaselineCompletionOwnerBootstrapTargetInTransactionV1,
  resolveInternalProductionCompletionOwnerTerminalAuthorityPairInTransactionV1,
  resolveInternalProductionOwnerReservationCloseInTransactionV1,
  pgBegin,
  type PgTransactionSql,
} from "../db-pg.js";
import {
  createInternalProductionCompletionOwnerCanonicalOwnerIdentityV1,
  createInternalProductionMandatoryEffectCanonicalOwnerIdentityV1,
} from "../internal-production/owner-admission-v1.js";

type Sql = postgres.Sql;
type TransactionSql = postgres.TransactionSql;

const RuntimeCompletionRequestIdSchema = z.string().regex(/^RCR_[A-Za-z0-9-]{16,160}$/);
const RuntimeCompletionRecoveryOwnerInstanceIdV1Schema = z.string().regex(
  /^setfarm-runtime-completion-recovery:v1:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
);
const RuntimeCompletionStateSchema = z.enum([
  "requested",
  "draining",
  "processing",
  "accepted",
  "rejected",
  "quarantined",
]);
const RuntimeCompletionApplyPhaseSchema = z.enum([
  "proposed",
  "executing",
  "owner_committed",
  "effects_committed",
]);

const MAX_RUNTIME_COMPLETION_PLAN_BYTES_V1 = 4_000_000;
const MAX_RUNTIME_COMPLETION_EFFECT_PAYLOAD_BYTES_V1 = 4_000_000;

export type InternalProductionBaselineCompletionOwnerBootstrapTargetGuardReceiptV1 = Readonly<{
  schema: "setfarm.internal-production-baseline-completion-owner-bootstrap-target-guard-receipt.v1";
  kind: "authenticated-completion-owner-bootstrap-target";
  requestIdHash: string;
  claimIdHash: string;
  runIdentityHash: string;
  ownerGenerationHash: string;
  ownerFenced: true;
  ownerDrained: true;
  unrelatedOwnerCount: 0;
  unrelatedOwnerCensusHash: string;
  targetGuardHash: string;
  targetGuardReceiptRef: string;
  targetGuardReceiptHash: string;
}>;

export type InternalProductionBaselineCompletionOwnerBootstrapTargetGuardV1 = Readonly<{
  kind: "authenticated-completion-owner-bootstrap-target";
  requestIdHash: string;
  claimIdHash: string;
  runIdentityHash: string;
  ownerGenerationHash: string;
  ownerFenced: true;
  ownerDrained: true;
  unrelatedOwnerCount: 0;
  unrelatedOwnerCensusHash: string;
  targetGuardReceiptRef: string;
  targetGuardReceiptHash: string;
  targetGuardHash: string;
}>;

export type InternalProductionBaselineCompletionOwnerBootstrapTargetGuardConsumptionV1 = Readonly<{
  schema: "setfarm.internal-production-baseline-completion-owner-bootstrap-target-guard-consumption.v1";
  targetGuardReceiptRef: string;
  targetGuardReceiptHash: string;
  targetGuardHash: string;
  operationRef: string;
  operationHash: string;
  requestIdHash: string;
  claimIdHash: string;
  runIdentityHash: string;
  ownerGenerationHash: string;
  targetGuardConsumed: true;
  consumptionRef: string;
  consumptionHash: string;
}>;

export type InternalProductionBaselineCompletionOwnerBootstrapCleanBuildVerificationV1 = Readonly<{
  kind: "authenticated-baseline-completion-owner-bootstrap-clean-build-verification";
  bootstrapMergeSha: string;
  bootstrapTreeHash: string;
  p0FileSetHash: string;
  buildInfoHash: string;
  focusedVerificationHash: string;
  baselineHistoricalReceiptRef: string;
  baselineHistoricalReceiptHash: string;
  bootstrapHandoffMigrationReceiptRef: string;
  bootstrapHandoffMigrationReceiptHash: string;
  requestIdHash: string;
  claimIdHash: string;
  runIdentityHash: string;
  ownerGenerationHash: string;
  verificationHash: string;
  capability: unknown;
}>;

type InternalProductionBaselineCompletionOwnerBootstrapEligibilityV1 = Readonly<{
  schema: "setfarm.internal-production-baseline-completion-owner-bootstrap-eligibility.v1";
  kind: "authenticated-baseline-completion-owner-bootstrap-clean-build-verification";
  deliveryAuthorityRef: string;
  deliveryAuthorityHash: string;
  bootstrapMergeSha: string;
  bootstrapTreeHash: string;
  p0FileSetHash: string;
  buildInfoHash: string;
  focusedVerificationHash: string;
  baselineHistoricalReceiptRef: string;
  baselineHistoricalReceiptHash: string;
  bootstrapHandoffMigrationReceiptRef: string;
  bootstrapHandoffMigrationReceiptHash: string;
  requestIdHash: string;
  claimIdHash: string;
  runIdentityHash: string;
  ownerGenerationHash: string;
  eligibilityRef: string;
  eligibilityHash: string;
}>;

type CompletionBootstrapCleanBuildCapabilityStateV1 = Readonly<{
  requestId: string;
  ownerInstanceId: string;
  ownerAttemptCount: number;
  eligibilityRef: string;
  eligibilityHash: string;
}>;

export type InternalProductionBaselineCompletionOwnerBootstrapLifecycleObservationV1 = Readonly<{
  schema: "setfarm.internal-production-baseline-completion-owner-bootstrap-lifecycle-observation.v1";
  state: "guard_consumed" | "owner_recovered" | "owner_released" | "completed";
  targetGuardReceiptRef: string;
  targetGuardReceiptHash: string;
  operationRef: string;
  operationHash: string;
  targetGuardConsumptionRef: string;
  targetGuardConsumptionHash: string;
  startupAdmissionRef: string;
  startupAdmissionHash: string;
  startupClaimHash: string;
  restartAuthorityRef: string;
  restartAuthorityHash: string;
  recoveredOwnerGenerationHash: string | null;
  targetOwnerReleaseReceiptHash: string | null;
  sequenceRef: string | null;
  sequenceHash: string | null;
  observationHash: string;
}>;

type BootstrapGuardStateV1 = Readonly<{
  receipt: InternalProductionBaselineCompletionOwnerBootstrapTargetGuardReceiptV1;
  requestId: string;
  ownerInstanceId: string;
  ownerAttemptCount: number;
}>;

const completionBootstrapGuardsV1 = new WeakMap<object, BootstrapGuardStateV1>();
const completionBootstrapCleanBuildCapabilitiesV1 = new WeakMap<object, CompletionBootstrapCleanBuildCapabilityStateV1>();
type CompletionBootstrapSelectedRecoveryCandidateV1 = Readonly<{
  requestId: string;
  ownerInstanceId: string;
  ownerAttemptCount: number;
  leaseExpiresAt: string;
}>;
const completionBootstrapSelectedRecoveryCandidatesV1 = new WeakMap<object, CompletionBootstrapSelectedRecoveryCandidateV1>();
let completionBootstrapPendingSelectedRecoveryTokenV1: object | null = null;
const completionBootstrapSelectedRecoveryContextV1 = new AsyncLocalStorage<CompletionBootstrapSelectedRecoveryCandidateV1>();

const COMPLETION_BOOTSTRAP_REPOSITORY_ROOT_V1 = path.dirname(path.dirname(path.dirname(fileURLToPath(import.meta.url))));
const COMPLETION_BOOTSTRAP_ROOT_V1 = path.join(
  COMPLETION_BOOTSTRAP_REPOSITORY_ROOT_V1,
  "data/internal-production-baseline/completion-owner-bootstrap-target-guard-v1",
);
const COMPLETION_BOOTSTRAP_MAX_BYTES_V1 = 1_048_576;
const SHA256_V1 = /^[a-f0-9]{64}$/;
const COMPLETION_BOOTSTRAP_ELIGIBILITY_PREFIX_V1 = "setfarm://internal-production/baseline-completion-owner-bootstrap-eligibility/sha256/";

function completionBootstrapFailV1(message: string): never {
  throw new Error(`INTERNAL_PRODUCTION_COMPLETION_OWNER_BOOTSTRAP_INVALID:${message}`);
}

function recursivelyFreezeCompletionBootstrapV1<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    for (const member of Object.values(value as Record<string, unknown>)) recursivelyFreezeCompletionBootstrapV1(member);
    Object.freeze(value);
  }
  return value;
}

function completionBootstrapBytesV1(value: unknown): Buffer {
  const bytes = Buffer.from(`${canonicalJsonStringify(value)}\n`, "utf8");
  if (bytes.length < 1 || bytes.length > COMPLETION_BOOTSTRAP_MAX_BYTES_V1) completionBootstrapFailV1("record size");
  return bytes;
}

function completionBootstrapHasExactStoredKeysV1(value: Record<string, unknown>, keys: readonly string[]): boolean {
  return Object.keys(value).join(",") === [...keys].sort().join(",");
}

type CompletionBootstrapPrivateDirectoryGuardV1 = Readonly<{ assertStable: () => void; close: () => void }>;

function authenticateCompletionBootstrapPrivateDirectoryChainV1(target: string): CompletionBootstrapPrivateDirectoryGuardV1 {
  const anchor = path.resolve(COMPLETION_BOOTSTRAP_REPOSITORY_ROOT_V1);
  const resolvedTarget = path.resolve(target);
  const relative = path.relative(anchor, resolvedTarget);
  if (relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) completionBootstrapFailV1("directory escaped repository");
  const segments = relative === "" ? [] : relative.split(path.sep);
  const paths = [anchor, ...segments.map((_, index) => path.join(anchor, ...segments.slice(0, index + 1)))];
  const descriptors: number[] = [];
  const held: Array<ReturnType<typeof fstatSync>> = [];
  let closed = false;
  const assertStable = (): void => {
    if (closed) completionBootstrapFailV1("directory guard closed");
    for (const [index, current] of paths.entries()) {
      const after = lstatSync(current, { bigint: true });
      const descriptorAfter = fstatSync(descriptors[index]!, { bigint: true });
      const observed = held[index]!;
      if (
        !after.isDirectory() || after.isSymbolicLink() || !descriptorAfter.isDirectory()
        || after.dev !== observed.dev || after.ino !== observed.ino || after.mode !== observed.mode
        || descriptorAfter.dev !== observed.dev || descriptorAfter.ino !== observed.ino
        || descriptorAfter.mode !== observed.mode
      ) completionBootstrapFailV1("directory changed while authenticated");
    }
  };
  try {
    for (const [index, current] of paths.entries()) {
      const before = lstatSync(current, { bigint: true });
      const descriptor = openSync(current, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_DIRECTORY);
      descriptors.push(descriptor);
      const observed = fstatSync(descriptor, { bigint: true });
      if (
        !before.isDirectory() || before.isSymbolicLink() || !observed.isDirectory()
        || before.dev !== observed.dev || before.ino !== observed.ino || before.mode !== observed.mode
        || before.nlink !== observed.nlink || before.nlink < 1n
        || (index > 0 && (observed.mode & 0o7777n) !== 0o700n)
        || (index > 0 && observed.dev !== held[0]!.dev)
      ) completionBootstrapFailV1("private directory identity");
      held.push(observed);
    }
    assertStable();
    return Object.freeze({
      assertStable,
      close: () => {
        if (closed) completionBootstrapFailV1("directory guard already closed");
        closed = true;
        for (const descriptor of descriptors.reverse()) closeSync(descriptor);
      },
    });
  } catch (error) {
    closed = true;
    for (const descriptor of descriptors.reverse()) closeSync(descriptor);
    throw error;
  }
}

function completionBootstrapEnsurePrivateDirectoryV1(directory: string): CompletionBootstrapPrivateDirectoryGuardV1 {
  const anchor = path.resolve(COMPLETION_BOOTSTRAP_REPOSITORY_ROOT_V1);
  const target = path.resolve(directory);
  const relative = path.relative(anchor, target);
  if (!relative || relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) completionBootstrapFailV1("directory escaped repository");
  let current = anchor;
  for (const member of relative.split(path.sep)) {
    if (!member || member === "." || member === "..") completionBootstrapFailV1("directory member");
    const parentGuard = authenticateCompletionBootstrapPrivateDirectoryChainV1(current);
    current = path.join(current, member);
    try {
      parentGuard.assertStable();
      try { mkdirSync(current, { mode: 0o700 }); }
      catch (error) {
        if (!(error instanceof Error) || !("code" in error) || error.code !== "EEXIST") throw error;
      }
      parentGuard.assertStable();
    } finally { parentGuard.close(); }
    const createdGuard = authenticateCompletionBootstrapPrivateDirectoryChainV1(current);
    createdGuard.close();
  }
  return authenticateCompletionBootstrapPrivateDirectoryChainV1(target);
}

function completionBootstrapReadBytesV1(target: string): Buffer {
  const parent = path.dirname(target);
  const parentGuard = authenticateCompletionBootstrapPrivateDirectoryChainV1(parent);
  const parentStats = lstatSync(parent, { bigint: true });
  try {
    parentGuard.assertStable();
    if (!parentStats.isDirectory() || parentStats.isSymbolicLink() || Number(parentStats.mode & 0o7777n) !== 0o700) completionBootstrapFailV1("record parent identity");
    const descriptor = openSync(target, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
    try {
      const before = fstatSync(descriptor, { bigint: true });
      const atPath = lstatSync(target, { bigint: true });
      if (!before.isFile() || before.dev !== parentStats.dev || before.dev !== atPath.dev || before.ino !== atPath.ino || before.nlink !== 1n || atPath.nlink !== 1n || Number(before.mode & 0o7777n) !== 0o600 || before.size < 1n || before.size > BigInt(COMPLETION_BOOTSTRAP_MAX_BYTES_V1)) completionBootstrapFailV1("record inode identity");
      const bytes = readFileSync(descriptor);
      const after = fstatSync(descriptor, { bigint: true });
      const reopened = lstatSync(target, { bigint: true });
      if (before.dev !== after.dev || before.ino !== after.ino || before.mode !== after.mode || before.nlink !== after.nlink || before.size !== after.size || before.mtimeNs !== after.mtimeNs || before.ctimeNs !== after.ctimeNs || after.dev !== reopened.dev || after.ino !== reopened.ino || after.nlink !== reopened.nlink || BigInt(bytes.length) !== after.size) completionBootstrapFailV1("record changed during read");
      parentGuard.assertStable();
      return bytes;
    } finally { closeSync(descriptor); }
  } finally { parentGuard.close(); }
}

function completionBootstrapRecoverNoReplacePublicationV1(target: string, bytes: Buffer): void {
  const directory = path.dirname(target);
  const prefix = `${path.basename(target)}.tmp-`;
  const candidates = readdirSync(directory).filter((entry) => entry.startsWith(prefix));
  if (candidates.length > 8) completionBootstrapFailV1("temporary candidate cap");
  if (candidates.length === 0) return;
  const namePattern = new RegExp(`^${prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[1-9][0-9]*-[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$`);
  const pinned: Array<{ temp: string; descriptor: number; identity: ReturnType<typeof fstatSync>; observed: Buffer }> = [];
  try {
    for (const entry of candidates) {
      if (!namePattern.test(entry)) completionBootstrapFailV1("temporary candidate name");
      const temp = path.join(directory, entry);
      const descriptor = openSync(temp, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
      const identity = fstatSync(descriptor, { bigint: true });
      const atTemp = lstatSync(temp, { bigint: true });
      const observed = readFileSync(descriptor);
      if (!identity.isFile() || identity.dev !== atTemp.dev || identity.ino !== atTemp.ino || (identity.mode & 0o7777n) !== 0o600n || ![1n, 2n].includes(identity.nlink) || identity.size !== BigInt(observed.length) || !observed.equals(bytes)) completionBootstrapFailV1("temporary candidate invalid");
      pinned.push({ temp, descriptor, identity, observed });
    }
    let targetStats: ReturnType<typeof lstatSync> | null = null;
    try { targetStats = lstatSync(target, { bigint: true }); } catch (error) { if (!(error instanceof Error) || !("code" in error) || error.code !== "ENOENT") throw error; }
    if (targetStats === null) {
      const prelinks = pinned.filter(({ identity }) => identity.nlink === 1n);
      if (prelinks.length < 1) completionBootstrapFailV1("temporary link state");
      linkSync(prelinks[0]!.temp, target);
      targetStats = lstatSync(target, { bigint: true });
    }
    const targetIsLinkedTemp = pinned.some(({ identity, observed }) => targetStats!.dev === identity.dev && targetStats!.ino === identity.ino && observed.equals(bytes));
    const targetIsIndependent = targetStats.nlink === 1n && completionBootstrapReadBytesV1(target).equals(bytes);
    if (!targetStats.isFile() || targetStats.isSymbolicLink() || (!targetIsLinkedTemp && !targetIsIndependent)) completionBootstrapFailV1("linked temporary identity");
    for (const item of pinned) {
      const now = fstatSync(item.descriptor, { bigint: true });
      const atPath = lstatSync(item.temp, { bigint: true });
      const observed = Buffer.alloc(Number(now.size));
      if (readSync(item.descriptor, observed, 0, observed.length, 0) !== observed.length || now.dev !== item.identity.dev || now.ino !== item.identity.ino || atPath.dev !== item.identity.dev || atPath.ino !== item.identity.ino || !observed.equals(item.observed) || !observed.equals(bytes)) completionBootstrapFailV1("temporary candidate changed");
      const linked = targetStats.dev === now.dev && targetStats.ino === now.ino && now.nlink === 2n;
      const stale = targetIsIndependent && (targetStats.dev !== now.dev || targetStats.ino !== now.ino) && now.nlink === 1n;
      if (!linked && !stale) completionBootstrapFailV1("linked temporary identity");
    }
    for (const item of pinned) unlinkSync(item.temp);
  } finally { for (const item of pinned) closeSync(item.descriptor); }
  const directoryDescriptor = openSync(directory, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_DIRECTORY);
  try { fsyncSync(directoryDescriptor); } finally { closeSync(directoryDescriptor); }
  if (!completionBootstrapReadBytesV1(target).equals(bytes)) completionBootstrapFailV1("recovered record identity");
}

function completionBootstrapWriteNoReplaceV1(target: string, value: unknown): void {
  const bytes = completionBootstrapBytesV1(value);
  const directoryGuard = completionBootstrapEnsurePrivateDirectoryV1(path.dirname(target));
  let mutationLock: Readonly<{ close: () => void }> | null = null;
  try {
    directoryGuard.assertStable();
    mutationLock = completionBootstrapAcquireLocatorMutationLockV1(target);
    directoryGuard.assertStable();
    completionBootstrapRecoverNoReplacePublicationV1(target, bytes);
    const basename = path.basename(target);
    const tempPrefix = `${basename}.tmp-`;
    const candidates = readdirSync(path.dirname(target)).filter((entry) => entry.startsWith(tempPrefix));
    if (candidates.length >= 8) completionBootstrapFailV1("temporary candidate cap");
    const temp = `${target}.tmp-${process.pid}-${randomUUID()}`;
    const fd = openSync(temp, constants.O_CREAT | constants.O_EXCL | constants.O_RDWR | constants.O_NOFOLLOW, 0o600);
    try {
      writeFileSync(fd, bytes); fsyncSync(fd);
      const identity = fstatSync(fd, { bigint: true });
      try { linkSync(temp, target); } catch (error) {
        if (!(error instanceof Error) || !("code" in error) || error.code !== "EEXIST") throw error;
        if (!completionBootstrapReadBytesV1(target).equals(bytes)) completionBootstrapFailV1("no-replace collision");
      }
      const atTemp = lstatSync(temp, { bigint: true });
      const observed = Buffer.alloc(Number(identity.size));
      if (readSync(fd, observed, 0, observed.length, 0) !== observed.length || atTemp.dev !== identity.dev || atTemp.ino !== identity.ino || !observed.equals(bytes)) completionBootstrapFailV1("temporary candidate changed");
      unlinkSync(temp);
    } finally { closeSync(fd); }
    directoryGuard.assertStable();
    const directory = openSync(path.dirname(target), constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_DIRECTORY);
    try { fsyncSync(directory); } finally { closeSync(directory); }
    if (!completionBootstrapReadBytesV1(target).equals(bytes)) completionBootstrapFailV1("record reauthentication");
    directoryGuard.assertStable();
  } finally { mutationLock?.close(); directoryGuard.close(); }
}

function completionBootstrapReadV1(target: string): unknown {
  const bytes = completionBootstrapReadBytesV1(target);
  if (bytes.length < 1 || bytes.length > COMPLETION_BOOTSTRAP_MAX_BYTES_V1 || bytes[bytes.length - 1] !== 0x0a) completionBootstrapFailV1("record framing");
  const value = JSON.parse(bytes.subarray(0, bytes.length - 1).toString("utf8")) as unknown;
  if (!completionBootstrapBytesV1(value).equals(bytes)) completionBootstrapFailV1("record is not canonical");
  return value;
}

function completionBootstrapAcquireLocatorMutationLockV1(target: string): Readonly<{ close: () => void }> {
  const lockPath = `${target}.controller.lock`;
  const directory = path.dirname(target);
  const tempPrefix = `${path.basename(lockPath)}.tmp-`;
  const targetHash = hashCanonicalJson({ schema: "setfarm.internal-production-completion-bootstrap-locator-mutation-target.v1", target });
  type ProcessSnapshotV1 =
    | Readonly<{ state: "live"; processStart: string; processCommandHash: string; processIdentityHash: string }>
    | Readonly<{ state: "dead" | "ambiguous" }>;
  const snapshot = (pid: number): ProcessSnapshotV1 => {
    try {
      const observedPid = execFileSync("/bin/ps", ["-p", String(pid), "-o", "pid="], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 2_000 }).trim();
      if (observedPid !== String(pid)) return Object.freeze({ state: "ambiguous" as const });
    } catch (error) {
      const failure = error as NodeJS.ErrnoException & { status?: number | null; stdout?: string | Buffer; stderr?: string | Buffer };
      const stdout = typeof failure.stdout === "string" ? failure.stdout : Buffer.isBuffer(failure.stdout) ? failure.stdout.toString("utf8") : "";
      const stderr = typeof failure.stderr === "string" ? failure.stderr : Buffer.isBuffer(failure.stderr) ? failure.stderr.toString("utf8") : "";
      if (failure.status === 1 && stdout.trim() === "" && stderr.trim() === "") return Object.freeze({ state: "dead" as const });
      return Object.freeze({ state: "ambiguous" as const });
    }
    try {
      const processStart = execFileSync("/bin/ps", ["-p", String(pid), "-o", "lstart="], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], timeout: 2_000 }).trim();
      const command = execFileSync("/bin/ps", ["-p", String(pid), "-o", "command="], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], timeout: 2_000 }).trim();
      if (!processStart || !command) return Object.freeze({ state: "ambiguous" as const });
      const processCommandHash = hashCanonicalJson({ schema: "setfarm.internal-production-completion-bootstrap-lock-process-command.v1", command });
      return Object.freeze({ state: "live" as const, processStart, processCommandHash, processIdentityHash: hashCanonicalJson({ schema: "setfarm.internal-production-completion-bootstrap-lock-process-identity.v1", pid, processStart, processCommandHash }) });
    } catch { return Object.freeze({ state: "ambiguous" as const }); }
  };
  const parse = (bytes: Buffer): Record<string, unknown> => {
    const value = JSON.parse(bytes.subarray(0, bytes.length - 1).toString("utf8")) as unknown;
    if (!value || typeof value !== "object" || Array.isArray(value) || !completionBootstrapBytesV1(value).equals(bytes) || !completionBootstrapHasExactStoredKeysV1(value as Record<string, unknown>, ["schema", "targetHash", "pid", "processStart", "processCommandHash", "processIdentityHash", "nonce"])) completionBootstrapFailV1("locator mutation lock shape");
    const record = value as Record<string, unknown>;
    if (record.schema !== "setfarm.internal-production-completion-bootstrap-locator-mutation-lock.v1" || record.targetHash !== targetHash || typeof record.pid !== "number" || !Number.isSafeInteger(record.pid) || record.pid < 1 || typeof record.processStart !== "string" || typeof record.processCommandHash !== "string" || !SHA256_V1.test(record.processCommandHash) || typeof record.processIdentityHash !== "string" || !SHA256_V1.test(record.processIdentityHash) || typeof record.nonce !== "string") completionBootstrapFailV1("locator mutation lock authority");
    return record;
  };
  const unlinkPinned = (candidate: string, descriptor: number, identity: ReturnType<typeof fstatSync>, bytes: Buffer): void => {
    const atPath = lstatSync(candidate, { bigint: true });
    const again = fstatSync(descriptor, { bigint: true });
    const observed = Buffer.alloc(Number(again.size));
    if (readSync(descriptor, observed, 0, observed.length, 0) !== observed.length || !again.isFile() || (again.mode & 0o7777n) !== 0o600n || again.dev !== identity.dev || again.ino !== identity.ino || again.size !== identity.size || atPath.dev !== identity.dev || atPath.ino !== identity.ino || !observed.equals(bytes)) completionBootstrapFailV1("locator mutation lock changed");
    unlinkSync(candidate);
  };
  const deadline = Date.now() + 10_000;
  for (;;) {
    const guard = authenticateCompletionBootstrapPrivateDirectoryChainV1(directory);
    guard.assertStable();
    const candidates = readdirSync(directory).filter((entry) => entry.startsWith(tempPrefix));
    if (candidates.length > 8) { guard.close(); completionBootstrapFailV1("locator mutation lock temporary cap"); }
    let busy = false;
    for (const entry of candidates) {
      if (!new RegExp(`^${tempPrefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[1-9][0-9]*-[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$`).test(entry)) { guard.close(); completionBootstrapFailV1("locator mutation lock temporary name"); }
      const candidate = path.join(directory, entry);
      const descriptor = openSync(candidate, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
      try {
        const identity = fstatSync(descriptor, { bigint: true });
        const bytes = readFileSync(descriptor);
        const owner = parse(bytes);
        const live = snapshot(owner.pid as number);
        if (live.state === "ambiguous" || (live.state === "live" && live.processStart === owner.processStart && live.processCommandHash === owner.processCommandHash && live.processIdentityHash === owner.processIdentityHash)) busy = true;
        else unlinkPinned(candidate, descriptor, identity, bytes);
      } finally { closeSync(descriptor); }
    }
    if (busy) { guard.close(); if (Date.now() >= deadline) completionBootstrapFailV1("locator mutation lock busy"); Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 5); continue; }
    try {
      const existingDescriptor = openSync(lockPath, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
      try {
        const identity = fstatSync(existingDescriptor, { bigint: true });
        const bytes = readFileSync(existingDescriptor);
        const owner = parse(bytes);
        const live = snapshot(owner.pid as number);
        if (live.state === "ambiguous" || (live.state === "live" && live.processStart === owner.processStart && live.processCommandHash === owner.processCommandHash && live.processIdentityHash === owner.processIdentityHash)) busy = true;
        else unlinkPinned(lockPath, existingDescriptor, identity, bytes);
      } finally { closeSync(existingDescriptor); }
    } catch (error) { if (!(error instanceof Error) || !("code" in error) || error.code !== "ENOENT") { guard.close(); throw error; } }
    if (busy) { guard.close(); if (Date.now() >= deadline) completionBootstrapFailV1("locator mutation lock busy"); Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 5); continue; }
    const nonce = randomUUID();
    const owner = snapshot(process.pid);
    if (owner.state !== "live") { guard.close(); completionBootstrapFailV1("locator mutation lock owner unavailable"); }
    const body = Object.freeze({ schema: "setfarm.internal-production-completion-bootstrap-locator-mutation-lock.v1", targetHash, pid: process.pid, processStart: owner.processStart, processCommandHash: owner.processCommandHash, processIdentityHash: owner.processIdentityHash, nonce });
    const bytes = completionBootstrapBytesV1(body);
    const temp = path.join(directory, `${tempPrefix}${process.pid}-${nonce}`);
    const descriptor = openSync(temp, constants.O_CREAT | constants.O_EXCL | constants.O_RDWR | constants.O_NOFOLLOW, 0o600);
    writeFileSync(descriptor, bytes); fsyncSync(descriptor);
    const identity = fstatSync(descriptor, { bigint: true });
    try { linkSync(temp, lockPath); } catch (error) {
      unlinkPinned(temp, descriptor, identity, bytes); closeSync(descriptor); guard.close();
      if (!(error instanceof Error) || !("code" in error) || error.code !== "EEXIST") throw error;
      if (Date.now() >= deadline) completionBootstrapFailV1("locator mutation lock busy");
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 5); continue;
    }
    unlinkPinned(temp, descriptor, identity, bytes);
    const parentDescriptor = openSync(directory, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_DIRECTORY);
    try { fsyncSync(parentDescriptor); } finally { closeSync(parentDescriptor); }
    guard.assertStable();
    return Object.freeze({ close: () => {
      try {
        const atPath = lstatSync(lockPath, { bigint: true });
        if (!identity.isFile() || identity.nlink !== 1n || identity.dev !== atPath.dev || identity.ino !== atPath.ino || !completionBootstrapReadBytesV1(lockPath).equals(bytes)) completionBootstrapFailV1("locator mutation lock changed");
        unlinkSync(lockPath);
        const directoryDescriptor = openSync(directory, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_DIRECTORY);
        try { fsyncSync(directoryDescriptor); } finally { closeSync(directoryDescriptor); }
        guard.assertStable();
      } finally { closeSync(descriptor); guard.close(); }
    } });
  }
}

function completionBootstrapPairV1(value: unknown, refKey: string, hashKey: string, prefix: string): Readonly<Record<string, string>> {
  if (!value || typeof value !== "object" || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype || Reflect.ownKeys(value).some((key) => typeof key !== "string") || Object.keys(value).join(",") !== `${refKey},${hashKey}`) completionBootstrapFailV1("pair shape");
  const pair = value as Record<string, unknown>;
  if (typeof pair[hashKey] !== "string" || !SHA256_V1.test(pair[hashKey] as string) || pair[refKey] !== `${prefix}${pair[hashKey]}`) completionBootstrapFailV1("pair identity");
  return Object.freeze({ [refKey]: pair[refKey] as string, [hashKey]: pair[hashKey] as string });
}

function completionBootstrapReceiptPathV1(hash: string): string {
  return path.join(COMPLETION_BOOTSTRAP_ROOT_V1, "receipts/sha256", hash.slice(0, 2), `${hash}.json`);
}

function completionBootstrapConsumptionPathV1(hash: string): string {
  return path.join(COMPLETION_BOOTSTRAP_ROOT_V1, "consumptions/sha256", hash.slice(0, 2), `${hash}.json`);
}

function completionBootstrapConsumedPathV1(hash: string): string {
  return path.join(COMPLETION_BOOTSTRAP_ROOT_V1, "consumed-guards/sha256", hash.slice(0, 2), `${hash}.json`);
}

function completionBootstrapEligibilityPathV1(hash: string): string {
  return path.join(COMPLETION_BOOTSTRAP_ROOT_V1, "eligibilities/sha256", hash.slice(0, 2), `${hash}.json`);
}

function completionBootstrapSelectedEligibilityPathV1(): string {
  return path.join(COMPLETION_BOOTSTRAP_ROOT_V1, "selected-eligibility.json");
}

function completionBootstrapReadEligibilityV1(
  input: Readonly<{ eligibilityRef: string; eligibilityHash: string }>,
): InternalProductionBaselineCompletionOwnerBootstrapEligibilityV1 {
  const pair = completionBootstrapPairV1(input, "eligibilityRef", "eligibilityHash", COMPLETION_BOOTSTRAP_ELIGIBILITY_PREFIX_V1);
  const value = completionBootstrapReadV1(completionBootstrapEligibilityPathV1(pair.eligibilityHash!));
  if (!value || typeof value !== "object" || Array.isArray(value)) completionBootstrapFailV1("eligibility shape");
  const eligibility = value as Record<string, unknown>;
  const keys = ["schema", "kind", "deliveryAuthorityRef", "deliveryAuthorityHash", "bootstrapMergeSha", "bootstrapTreeHash", "p0FileSetHash", "buildInfoHash", "focusedVerificationHash", "baselineHistoricalReceiptRef", "baselineHistoricalReceiptHash", "bootstrapHandoffMigrationReceiptRef", "bootstrapHandoffMigrationReceiptHash", "requestIdHash", "claimIdHash", "runIdentityHash", "ownerGenerationHash", "eligibilityRef", "eligibilityHash"] as const;
  if (!completionBootstrapHasExactStoredKeysV1(eligibility, keys) || eligibility.schema !== "setfarm.internal-production-baseline-completion-owner-bootstrap-eligibility.v1" || eligibility.kind !== "authenticated-baseline-completion-owner-bootstrap-clean-build-verification") completionBootstrapFailV1("eligibility keys");
  const body = Object.fromEntries(keys.slice(0, -2).map((key) => [key, eligibility[key]]));
  if (hashCanonicalJson(body) !== pair.eligibilityHash || eligibility.eligibilityRef !== pair.eligibilityRef || eligibility.eligibilityHash !== pair.eligibilityHash) completionBootstrapFailV1("eligibility authority");
  for (const key of ["deliveryAuthorityHash", "p0FileSetHash", "buildInfoHash", "focusedVerificationHash", "baselineHistoricalReceiptHash", "bootstrapHandoffMigrationReceiptHash", "requestIdHash", "claimIdHash", "runIdentityHash", "ownerGenerationHash", "eligibilityHash"] as const) if (typeof eligibility[key] !== "string" || !SHA256_V1.test(eligibility[key] as string)) completionBootstrapFailV1(`eligibility ${key}`);
  return recursivelyFreezeCompletionBootstrapV1(eligibility) as InternalProductionBaselineCompletionOwnerBootstrapEligibilityV1;
}

function completionBootstrapReadSelectedEligibilityV1(): Readonly<{ eligibilityRef: string; eligibilityHash: string }> {
  const value = completionBootstrapReadV1(completionBootstrapSelectedEligibilityPathV1());
  if (!value || typeof value !== "object" || Array.isArray(value) || !completionBootstrapHasExactStoredKeysV1(value as Record<string, unknown>, ["eligibilityRef", "eligibilityHash"])) completionBootstrapFailV1("selected eligibility locator");
  const stored = value as Record<string, unknown>;
  return completionBootstrapPairV1(
    { eligibilityRef: stored.eligibilityRef, eligibilityHash: stored.eligibilityHash },
    "eligibilityRef",
    "eligibilityHash",
    COMPLETION_BOOTSTRAP_ELIGIBILITY_PREFIX_V1,
  ) as Readonly<{ eligibilityRef: string; eligibilityHash: string }>;
}

function completionBootstrapSelectedEligibilityMatchesRowV1(row: RuntimeCompletionRow): boolean {
  let selected: Readonly<{ eligibilityRef: string; eligibilityHash: string }>;
  try { selected = completionBootstrapReadSelectedEligibilityV1(); } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") return false;
    throw error;
  }
  const eligibility = completionBootstrapReadEligibilityV1(selected);
  return eligibility.requestIdHash === hashCanonicalJson({ schema: "setfarm.internal-production-runtime-completion-request-id.v1", requestId: row.request_id })
    && eligibility.claimIdHash === hashCanonicalJson({ schema: "setfarm.internal-production-runtime-completion-claim-id.v1", claimId: String(row.claim_id) })
    && eligibility.runIdentityHash === hashCanonicalJson({ schema: "setfarm.internal-production-runtime-completion-run-identity.v1", runId: row.run_id })
    && eligibility.ownerGenerationHash === hashCanonicalJson({ schema: "setfarm.internal-production-runtime-completion-owner-generation.v1", ownerInstanceId: row.owner_instance_id, ownerAttemptCount: row.owner_attempt_count });
}

function completionBootstrapRequireSelectedEligibilityMatchesReceiptAndRowV1(
  row: RuntimeCompletionRow,
  receipt: InternalProductionBaselineCompletionOwnerBootstrapTargetGuardReceiptV1,
): InternalProductionBaselineCompletionOwnerBootstrapEligibilityV1 {
  const eligibility = completionBootstrapReadEligibilityV1(completionBootstrapReadSelectedEligibilityV1());
  const requestIdHash = hashCanonicalJson({ schema: "setfarm.internal-production-runtime-completion-request-id.v1", requestId: row.request_id });
  const claimIdHash = hashCanonicalJson({ schema: "setfarm.internal-production-runtime-completion-claim-id.v1", claimId: String(row.claim_id) });
  const runIdentityHash = hashCanonicalJson({ schema: "setfarm.internal-production-runtime-completion-run-identity.v1", runId: row.run_id });
  const ownerGenerationHash = hashCanonicalJson({ schema: "setfarm.internal-production-runtime-completion-owner-generation.v1", ownerInstanceId: row.owner_instance_id, ownerAttemptCount: row.owner_attempt_count });
  if (eligibility.requestIdHash !== requestIdHash || eligibility.claimIdHash !== claimIdHash || eligibility.runIdentityHash !== runIdentityHash || eligibility.ownerGenerationHash !== ownerGenerationHash || receipt.requestIdHash !== requestIdHash || receipt.claimIdHash !== claimIdHash || receipt.runIdentityHash !== runIdentityHash || receipt.ownerGenerationHash !== ownerGenerationHash) completionBootstrapFailV1("selected eligibility guard identity crossed");
  return eligibility;
}

export {
  RuntimeCompletionSubmissionEvidenceV1Schema,
  type RuntimeCompletionSubmissionEvidenceV1,
} from "./schemas/runtime-completion-submission-evidence-v1.js";

export type RuntimeCompletionRow = Readonly<{
  request_id: string;
  runtime_session_id: string;
  claim_id: string;
  run_id: string;
  step_db_id: string;
  workflow_step_id: string;
  story_db_id: string | null;
  story_id: string | null;
  attempt_id: string | null;
  claim_envelope: unknown;
  output: string;
  output_hash: string;
  source_proposal: string | null;
  submission_evidence: unknown | null;
  apply_phase: string;
  claim_outcome: string | null;
  claim_committed_at: Date | string | null;
  effects_committed_at: Date | string | null;
  completion_plan: unknown | null;
  completion_plan_hash: string | null;
  prepared_at: Date | string | null;
  owner_attempt_count: number;
  state: string;
  requested_by: string;
  owner_instance_id: string | null;
  lease_expires_at: Date | string | null;
  requested_at: Date | string;
  drained_at: Date | string | null;
  processing_at: Date | string | null;
  accepted_at: Date | string | null;
  rejected_at: Date | string | null;
  diagnostic: string | null;
  result: unknown;
  created_at: Date | string;
  updated_at: Date | string;
}>;

export type RuntimeCompletionRequest = Readonly<{
  requestId: string;
  runtimeSessionId: string;
  claimId: number;
  runId: string;
  stepDbId: string;
  workflowStepId: string;
  storyDbId?: string;
  storyId?: string;
  attemptId?: string;
  claimEnvelope: ClaimEnvelopeV1;
  output: string;
  outputHash: string;
  submissionEvidence?: RuntimeCompletionSubmissionEvidenceV1;
  sourceProposalRef?: string;
  applyPhase: z.infer<typeof RuntimeCompletionApplyPhaseSchema>;
  claimOutcome?: string;
  claimCommittedAt?: string;
  effectsCommittedAt?: string;
  completionPlan?: RuntimeCompletionPlanV1;
  completionPlanHash?: string;
  preparedAt?: string;
  ownerAttemptCount: number;
  state: z.infer<typeof RuntimeCompletionStateSchema>;
  requestedBy: string;
  ownerInstanceId?: string;
  leaseExpiresAt?: string;
  requestedAt: string;
  drainedAt?: string;
  processingAt?: string;
  acceptedAt?: string;
  rejectedAt?: string;
  diagnostic?: string;
  result: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}>;

function timestamp(value: Date | string): string {
  return (value instanceof Date ? value : new Date(value)).toISOString();
}

function optionalTimestamp(value: Date | string | null): string | undefined {
  return value === null ? undefined : timestamp(value);
}

function validTime(value: Date | undefined): Date {
  const parsed = value ? new Date(value) : new Date();
  if (!Number.isFinite(parsed.getTime())) throw new Error("RUNTIME_COMPLETION_TIME_INVALID");
  return parsed;
}

function exactTimestamp(value: string, code: string): Date {
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) throw new Error(code);
  return parsed;
}

function claimId(value: string): number {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) throw new Error("RUNTIME_COMPLETION_CLAIM_ID_INVALID");
  return parsed;
}

function objectValue(value: unknown, code: string): Record<string, unknown> {
  const parsed = typeof value === "string" ? JSON.parse(value) as unknown : value;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error(code);
  return parsed as Record<string, unknown>;
}

export function mapRuntimeCompletionRequestRowV1(
  row: RuntimeCompletionRow,
): RuntimeCompletionRequest {
  const envelope = parseClaimEnvelope(
    typeof row.claim_envelope === "string" ? JSON.parse(row.claim_envelope) : row.claim_envelope,
  );
  const submissionEvidence = row.submission_evidence
    ? RuntimeCompletionSubmissionEvidenceV1Schema.parse(
        typeof row.submission_evidence === "string"
          ? JSON.parse(row.submission_evidence)
          : row.submission_evidence,
      )
    : undefined;
  if (submissionEvidence) {
    if (
      envelope.protocol !== "v3"
      || envelope.workflowStepId !== "implement"
      || submissionEvidence.canonicalOutputHash !== row.output_hash
      || !row.source_proposal
      || createHash("sha256").update(row.source_proposal, "utf8").digest("hex")
        !== submissionEvidence.sourceProposalHash
    ) {
      throw new Error("RUNTIME_COMPLETION_SUBMISSION_EVIDENCE_DB_BINDING_INVALID");
    }
  } else if (row.source_proposal !== null) {
    throw new Error("RUNTIME_COMPLETION_SOURCE_PROPOSAL_DB_BINDING_INVALID");
  }
  return Object.freeze({
    requestId: RuntimeCompletionRequestIdSchema.parse(row.request_id),
    runtimeSessionId: row.runtime_session_id,
    claimId: claimId(row.claim_id),
    runId: row.run_id,
    stepDbId: row.step_db_id,
    workflowStepId: row.workflow_step_id,
    ...(row.story_db_id ? { storyDbId: row.story_db_id } : {}),
    ...(row.story_id ? { storyId: row.story_id } : {}),
    ...(row.attempt_id ? { attemptId: row.attempt_id } : {}),
    claimEnvelope: envelope,
    output: row.output,
    outputHash: row.output_hash,
    ...(submissionEvidence
      ? {
          submissionEvidence,
          sourceProposalRef: `setfarm://runtime-completion/${row.request_id}/source-proposal/${submissionEvidence.sourceProposalHash}`,
        }
      : {}),
    applyPhase: RuntimeCompletionApplyPhaseSchema.parse(row.apply_phase),
    ...(row.claim_outcome ? { claimOutcome: row.claim_outcome } : {}),
    ...(optionalTimestamp(row.claim_committed_at) ? { claimCommittedAt: optionalTimestamp(row.claim_committed_at) } : {}),
    ...(optionalTimestamp(row.effects_committed_at) ? { effectsCommittedAt: optionalTimestamp(row.effects_committed_at) } : {}),
    ...(row.completion_plan ? {
      completionPlan: RuntimeCompletionPlanV1Schema.parse(
        typeof row.completion_plan === "string" ? JSON.parse(row.completion_plan) : row.completion_plan,
      ),
    } : {}),
    ...(row.completion_plan_hash ? { completionPlanHash: row.completion_plan_hash } : {}),
    ...(optionalTimestamp(row.prepared_at) ? { preparedAt: optionalTimestamp(row.prepared_at) } : {}),
    ownerAttemptCount: row.owner_attempt_count,
    state: RuntimeCompletionStateSchema.parse(row.state),
    requestedBy: row.requested_by,
    ...(row.owner_instance_id ? { ownerInstanceId: row.owner_instance_id } : {}),
    ...(optionalTimestamp(row.lease_expires_at) ? { leaseExpiresAt: optionalTimestamp(row.lease_expires_at) } : {}),
    requestedAt: timestamp(row.requested_at),
    ...(optionalTimestamp(row.drained_at) ? { drainedAt: optionalTimestamp(row.drained_at) } : {}),
    ...(optionalTimestamp(row.processing_at) ? { processingAt: optionalTimestamp(row.processing_at) } : {}),
    ...(optionalTimestamp(row.accepted_at) ? { acceptedAt: optionalTimestamp(row.accepted_at) } : {}),
    ...(optionalTimestamp(row.rejected_at) ? { rejectedAt: optionalTimestamp(row.rejected_at) } : {}),
    ...(row.diagnostic ? { diagnostic: row.diagnostic } : {}),
    result: Object.freeze({ ...objectValue(row.result, "RUNTIME_COMPLETION_RESULT_INVALID") }),
    createdAt: timestamp(row.created_at),
    updatedAt: timestamp(row.updated_at),
  });
}

const mapRequest = mapRuntimeCompletionRequestRowV1;

export async function findRuntimeCompletionRequestByIdV1(
  sql: postgres.Sql | postgres.TransactionSql,
  requestId: string,
): Promise<RuntimeCompletionRequest | undefined> {
  const rows = await sql.unsafe<RuntimeCompletionRow[]>(
    "SELECT * FROM runtime_completion_requests WHERE request_id = $1 LIMIT 1",
    [RuntimeCompletionRequestIdSchema.parse(requestId)],
  );
  return rows[0] ? mapRuntimeCompletionRequestRowV1(rows[0]) : undefined;
}

export function newRuntimeCompletionRequestId(): string {
  return `RCR_${randomUUID()}`;
}

type CompletionOwnerReservationV1 = Awaited<ReturnType<
  typeof beginOrAdoptInternalProductionOwnerReservationV1
>>;

async function beginCompletionOwnerReservationInTransactionV1(
  sql: TransactionSql,
  requestId: string,
  expectedState: "pending" | "bound",
): Promise<Readonly<{
  identity: ReturnType<typeof createInternalProductionCompletionOwnerCanonicalOwnerIdentityV1>;
  reservation: CompletionOwnerReservationV1;
}>> {
  const identity = createInternalProductionCompletionOwnerCanonicalOwnerIdentityV1({ requestId });
  const reservation = await beginOrAdoptInternalProductionOwnerReservationV1(
    sql as PgTransactionSql,
    {
      producerImplementationId: "a-completion-owner-v1",
      ownerKey: identity.ownerKey,
    },
  );
  const sidecars = await sql.unsafe<Array<{
    reservation_ref: string;
    reservation_hash: string;
    state: string;
  }>>(
    `SELECT reservation_ref,reservation_hash,state
       FROM internal_production_owner_reservations_v1
      WHERE producer_implementation_id = 'a-completion-owner-v1'
        AND category = 'completion-owner'
        AND owner_key = $1
      FOR UPDATE`,
    [requestId],
  );
  if (
    sidecars.length !== 1
    || sidecars[0]?.reservation_ref !== reservation.reservationRef
    || sidecars[0]?.reservation_hash !== reservation.reservationHash
    || sidecars[0]?.state !== expectedState
  ) throw new Error("INTERNAL_PRODUCTION_COMPLETION_OWNER_ADOPTION_INVALID");
  return Object.freeze({ identity, reservation });
}

async function bindCompletionOwnerReservationInTransactionV1(
  sql: TransactionSql,
  birth: Awaited<ReturnType<typeof beginCompletionOwnerReservationInTransactionV1>>,
  expected: RuntimeCompletionRow,
): Promise<RuntimeCompletionRow> {
  const reread = await sql.unsafe<RuntimeCompletionRow[]>(
    "SELECT * FROM runtime_completion_requests WHERE request_id = $1 FOR UPDATE",
    [expected.request_id],
  );
  if (
    reread.length !== 1
    || !reread[0]
    || canonicalJsonStringify(JSON.parse(JSON.stringify(mapRequest(reread[0]))))
      !== canonicalJsonStringify(JSON.parse(JSON.stringify(mapRequest(expected))))
  ) throw new Error("INTERNAL_PRODUCTION_COMPLETION_OWNER_REREAD_INVALID");
  const bound = await bindInternalProductionOwnerReservationV1(
    sql as PgTransactionSql,
    {
      reservationRef: birth.reservation.reservationRef,
      reservationHash: birth.reservation.reservationHash,
      canonicalOwnerIdentity: birth.identity,
    },
  );
  if (
    bound.ownerKey !== expected.request_id
    || bound.reservationRef !== birth.reservation.reservationRef
    || bound.reservationHash !== birth.reservation.reservationHash
    || bound.canonicalOwnerIdentity.ownerKey !== expected.request_id
  ) throw new Error("INTERNAL_PRODUCTION_COMPLETION_OWNER_BINDING_INVALID");
  return reread[0];
}

async function closeCompletionOwnerAfterTerminalMutationV1(
  sql: TransactionSql,
  requestId: string,
): Promise<void> {
  const terminalClose = await resolveInternalProductionCompletionOwnerTerminalAuthorityPairInTransactionV1(
    sql as PgTransactionSql,
    { requestId },
  );
  const close = await closeInternalProductionOwnerReservationV1(
    sql as PgTransactionSql,
    terminalClose,
  );
  const reopened = await resolveInternalProductionOwnerReservationCloseInTransactionV1(
    sql as PgTransactionSql,
    { closeRef: close.closeRef, closeHash: close.closeHash },
  );
  if (
    reopened.reservationRef !== terminalClose.reservationRef
    || reopened.reservationHash !== terminalClose.reservationHash
  ) throw new Error("INTERNAL_PRODUCTION_COMPLETION_OWNER_CLOSE_IDENTITY_INVALID");
}

async function closeCompletionOwnerIfPresentAfterTerminalMutationV1(
  sql: TransactionSql,
  requestId: string,
): Promise<void> {
  const expectedOwnerKeyHash = hashCanonicalJson({
    schema: "setfarm.internal-production-owner-key.v1",
    ownerKeyDerivationId: "completion-request-id-v1",
    ownerKey: requestId,
  });
  const owners = await sql.unsafe<Array<{
    reservation_ref: string;
    category: string;
    owner_key: string;
    owner_key_hash: string;
    producer_implementation_id: string;
    reservation_owner_key: string | null;
    reservation_owner_key_hash: string | null;
  }>>(
    `SELECT reservation_ref,category,owner_key,owner_key_hash,producer_implementation_id,
            reservation_payload->>'ownerKey' AS reservation_owner_key,
            reservation_payload->>'ownerKeyHash' AS reservation_owner_key_hash
       FROM internal_production_owner_reservations_v1
      WHERE (
              (producer_implementation_id = 'a-completion-owner-v1'
                AND category = 'completion-owner')
              OR reservation_payload->>'producerImplementationId' = 'a-completion-owner-v1'
              OR binding_payload->>'producerImplementationId' = 'a-completion-owner-v1'
            )
        AND (
              owner_key = $1
              OR owner_key_hash = $2
              OR reservation_payload->>'ownerKey' = $1
              OR reservation_payload->>'ownerKeyHash' = $2
              OR canonical_owner_identity->>'ownerKey' = $1
              OR binding_payload->>'ownerKey' = $1
              OR binding_payload->'canonicalOwnerIdentity'->>'ownerKey' = $1
            )
      FOR UPDATE`,
    [requestId, expectedOwnerKeyHash],
  );
  if (owners.length > 1) throw new Error("INTERNAL_PRODUCTION_COMPLETION_OWNER_AMBIGUOUS");
  if (owners.length === 0) return;
  const owner = owners[0]!;
  if (
    owner.category !== "completion-owner"
    || owner.producer_implementation_id !== "a-completion-owner-v1"
    || owner.owner_key !== requestId
    || owner.owner_key_hash !== expectedOwnerKeyHash
    || owner.reservation_owner_key !== requestId
    || owner.reservation_owner_key_hash !== expectedOwnerKeyHash
  ) throw new Error("INTERNAL_PRODUCTION_COMPLETION_OWNER_CORRUPTION");
  await closeCompletionOwnerAfterTerminalMutationV1(sql, requestId);
}

export function isRuntimeCompletionRecoveryOwnerInstanceIdV1(value: string): boolean {
  return RuntimeCompletionRecoveryOwnerInstanceIdV1Schema.safeParse(value).success;
}

function newRuntimeCompletionRecoveryOwnerInstanceIdV1(): string {
  return RuntimeCompletionRecoveryOwnerInstanceIdV1Schema.parse(
    `setfarm-runtime-completion-recovery:v1:${randomUUID()}`,
  );
}

export type RequestRuntimeCompletionResult =
  | Readonly<{ status: "direct" }>
  | Readonly<{ status: "requested" | "existing"; request: RuntimeCompletionRequest }>;

function completionReplayOutputMatches(
  replay: RuntimeCompletionRequest,
  candidateOutputHash: string,
  rawOutput: string,
  nativeV3Implementation: boolean,
): boolean {
  if (replay.outputHash === candidateOutputHash) return true;
  if (!nativeV3Implementation || replay.submissionEvidence) return false;
  // Migration-v19 compatibility: historic native-v3 requests retained the
  // raw legacy transport object. Compare its canonical projection without
  // retroactively manufacturing a receipt or changing the stored owner.
  try {
    return compileV3ImplementationTransportProposalV1(replay.output)
      .canonicalOutputHash === candidateOutputHash;
  } catch {
    return replay.output === rawOutput;
  }
}

type PreparedCompletionEffectOwnerV1 = Readonly<{
  effect: RuntimeCompletionPlanV1["effects"][number];
  effectPayload: Record<string, unknown>;
  inputHash: string;
}>;

type MandatoryEffectOwnerBirthV1 = Readonly<{
  effectKey: string;
  identity: ReturnType<typeof createInternalProductionMandatoryEffectCanonicalOwnerIdentityV1>;
  reservation: CompletionOwnerReservationV1;
}>;

async function inspectEffectOwnerSidecarInTransactionV1(
  sql: TransactionSql,
  identity: ReturnType<typeof createInternalProductionMandatoryEffectCanonicalOwnerIdentityV1>,
): Promise<Readonly<{
  reservation_ref: string;
  reservation_hash: string;
  state: string;
  category: string;
  owner_key: string;
  owner_key_hash: string;
  producer_implementation_id: string;
  reservation_owner_key: string | null;
  reservation_owner_key_hash: string | null;
}> | undefined> {
  const expectedOwnerKeyHash = hashCanonicalJson({
    schema: "setfarm.internal-production-owner-key.v1",
    ownerKeyDerivationId: "completion-request-id-effect-key-v1",
    ownerKey: identity.ownerKey,
  });
  const rows = await sql.unsafe<Array<{
    reservation_ref: string;
    reservation_hash: string;
    state: string;
    category: string;
    owner_key: string;
    owner_key_hash: string;
    producer_implementation_id: string;
    reservation_owner_key: string | null;
    reservation_owner_key_hash: string | null;
  }>>(
    `SELECT reservation_ref,reservation_hash,state,category,owner_key,owner_key_hash,
            producer_implementation_id,
            reservation_payload->>'ownerKey' AS reservation_owner_key,
            reservation_payload->>'ownerKeyHash' AS reservation_owner_key_hash
       FROM internal_production_owner_reservations_v1
      WHERE (
              (producer_implementation_id = 'a-mandatory-effect-v1'
                AND category = 'mandatory-effect')
              OR reservation_payload->>'producerImplementationId' = 'a-mandatory-effect-v1'
              OR binding_payload->>'producerImplementationId' = 'a-mandatory-effect-v1'
            )
        AND (
              owner_key = $1
              OR owner_key_hash = $2
              OR reservation_payload->>'ownerKey' = $1
              OR reservation_payload->>'ownerKeyHash' = $2
              OR canonical_owner_identity->>'ownerKey' = $1
              OR binding_payload->>'ownerKey' = $1
              OR binding_payload->'canonicalOwnerIdentity'->>'ownerKey' = $1
            )
      FOR UPDATE`,
    [identity.ownerKey, expectedOwnerKeyHash],
  );
  if (rows.length > 1) throw new Error("INTERNAL_PRODUCTION_MANDATORY_EFFECT_OWNER_AMBIGUOUS");
  const row = rows[0];
  if (!row) return undefined;
  if (
    row.category !== "mandatory-effect"
    || row.producer_implementation_id !== "a-mandatory-effect-v1"
    || row.owner_key !== identity.ownerKey
    || row.owner_key_hash !== expectedOwnerKeyHash
    || row.reservation_owner_key !== identity.ownerKey
    || row.reservation_owner_key_hash !== expectedOwnerKeyHash
  ) throw new Error("INTERNAL_PRODUCTION_MANDATORY_EFFECT_OWNER_CORRUPTION");
  return row;
}

async function beginMandatoryEffectOwnerInTransactionV1(
  sql: TransactionSql,
  requestId: string,
  prepared: PreparedCompletionEffectOwnerV1,
): Promise<MandatoryEffectOwnerBirthV1 | undefined> {
  const identity = createInternalProductionMandatoryEffectCanonicalOwnerIdentityV1({
    requestId,
    effectKey: prepared.effect.effectKey,
  });
  if (!prepared.effect.mandatory) {
    if (await inspectEffectOwnerSidecarInTransactionV1(sql, identity)) {
      throw new Error("INTERNAL_PRODUCTION_OPTIONAL_EFFECT_OWNER_FORBIDDEN");
    }
    return undefined;
  }
  const reservation = await beginOrAdoptInternalProductionOwnerReservationV1(
    sql as PgTransactionSql,
    {
      producerImplementationId: "a-mandatory-effect-v1",
      ownerKey: identity.ownerKey,
    },
  );
  const sidecar = await inspectEffectOwnerSidecarInTransactionV1(sql, identity);
  if (
    !sidecar
    || sidecar.state !== "pending"
    || sidecar.reservation_ref !== reservation.reservationRef
    || sidecar.reservation_hash !== reservation.reservationHash
  ) throw new Error("INTERNAL_PRODUCTION_MANDATORY_EFFECT_OWNER_ADOPTION_INVALID");
  return Object.freeze({ effectKey: prepared.effect.effectKey, identity, reservation });
}

async function bindMandatoryEffectOwnersInTransactionV1(
  sql: TransactionSql,
  births: readonly MandatoryEffectOwnerBirthV1[],
): Promise<void> {
  for (const birth of births) {
    const bound = await bindInternalProductionOwnerReservationV1(
      sql as PgTransactionSql,
      {
        reservationRef: birth.reservation.reservationRef,
        reservationHash: birth.reservation.reservationHash,
        canonicalOwnerIdentity: birth.identity,
      },
    );
    if (
      bound.ownerKey !== birth.identity.ownerKey
      || bound.reservationRef !== birth.reservation.reservationRef
      || bound.reservationHash !== birth.reservation.reservationHash
      || bound.canonicalOwnerIdentity.ownerHash !== birth.identity.ownerHash
    ) throw new Error("INTERNAL_PRODUCTION_MANDATORY_EFFECT_OWNER_BINDING_INVALID");
  }
}

async function authenticateCommittedEffectOwnersInTransactionV1(
  sql: TransactionSql,
  requestId: string,
  plan: RuntimeCompletionPlanV1,
): Promise<void> {
  const rows = await sql.unsafe<Array<{
    effect_key: string;
    ordinal: number;
    effect_type: string;
    input_hash: string;
    payload: unknown;
    mandatory: boolean;
    state: string;
  }>>(
    `SELECT effect_key,ordinal,effect_type,input_hash,payload,mandatory,state
       FROM runtime_completion_effects
      WHERE request_id = $1
      ORDER BY ordinal,effect_key
      FOR UPDATE`,
    [requestId],
  );
  if (rows.length !== plan.effects.length) {
    throw new Error("RUNTIME_COMPLETION_OWNER_COMMIT_EFFECT_CENSUS_INVALID");
  }
  for (const [index, row] of rows.entries()) {
    const effect = plan.effects[index]!;
    const payload = {
      schema: "setfarm.runtime-completion-effect-input.v1",
      planHash: hashCanonicalJson(plan),
      plan,
      effect: effect.payload,
    };
    if (
      row.effect_key !== effect.effectKey
      || row.ordinal !== effect.ordinal
      || row.effect_type !== effect.effectType
      || row.input_hash !== hashCanonicalJson(payload)
      || row.mandatory !== effect.mandatory
      || canonicalJsonStringify(row.payload) !== canonicalJsonStringify(payload)
    ) throw new Error("RUNTIME_COMPLETION_OWNER_COMMIT_EFFECT_BINDING_INVALID");
    const identity = createInternalProductionMandatoryEffectCanonicalOwnerIdentityV1({
      requestId,
      effectKey: effect.effectKey,
    });
    const sidecar = await inspectEffectOwnerSidecarInTransactionV1(sql, identity);
    if (!effect.mandatory) {
      if (sidecar) throw new Error("INTERNAL_PRODUCTION_OPTIONAL_EFFECT_OWNER_FORBIDDEN");
      continue;
    }
    const expectedState = ["applied", "reconciled"].includes(row.state) ? "closed" : "bound";
    if (!sidecar || sidecar.state !== expectedState) {
      throw new Error("INTERNAL_PRODUCTION_MANDATORY_EFFECT_OWNER_ADOPTION_INVALID");
    }
    const reservation = await beginOrAdoptInternalProductionOwnerReservationV1(
      sql as PgTransactionSql,
      {
        producerImplementationId: "a-mandatory-effect-v1",
        ownerKey: identity.ownerKey,
      },
    );
    if (
      reservation.reservationRef !== sidecar.reservation_ref
      || reservation.reservationHash !== sidecar.reservation_hash
    ) throw new Error("INTERNAL_PRODUCTION_MANDATORY_EFFECT_OWNER_ADOPTION_INVALID");
    await bindMandatoryEffectOwnersInTransactionV1(sql, [
      Object.freeze({ effectKey: effect.effectKey, identity, reservation }),
    ]);
  }
}

/**
 * Stamp the exact claim/product owner commit in the same transaction that
 * closes the claim. This is the durable crash boundary: claim outcome alone
 * is never used as a proxy for completion continuation/effect success.
 */
export async function markRuntimeCompletionOwnerCommittedInTransaction(
  sql: TransactionSql,
  input: Readonly<{
    claimId: number;
    claimOutcome: string;
    plan: RuntimeCompletionPlanDescriptorV1;
    now?: Date;
  }>,
): Promise<boolean> {
  if (!Number.isSafeInteger(input.claimId) || input.claimId <= 0) {
    throw new Error("RUNTIME_COMPLETION_OWNER_COMMIT_CLAIM_ID_INVALID");
  }
  if (!input.claimOutcome.trim()) throw new Error("RUNTIME_COMPLETION_OWNER_COMMIT_OUTCOME_INVALID");
  const descriptor = RuntimeCompletionPlanDescriptorV1Schema.parse(input.plan);
  validTime(input.now);
  const rows = await sql.unsafe<RuntimeCompletionRow[]>(
    `SELECT *
       FROM runtime_completion_requests
      WHERE claim_id = $1
      FOR UPDATE`,
    [input.claimId],
  );
  const current = rows[0];
  if (!current) return false;
  const wallClock = await readDatabaseWallClock(
    sql,
    "RUNTIME_COMPLETION_DATABASE_WALL_CLOCK_UNAVAILABLE",
  );
  if (current.state !== "processing") {
    if (
      current.apply_phase === "effects_committed"
      && current.claim_outcome === input.claimOutcome
    ) {
      const storedPlan = current.completion_plan
        ? RuntimeCompletionPlanV1Schema.parse(
          typeof current.completion_plan === "string"
            ? JSON.parse(current.completion_plan)
            : current.completion_plan,
        )
        : undefined;
      if (!storedPlan || hashCanonicalJson({
        kind: storedPlan.kind,
        continuation: storedPlan.continuation,
        ...(storedPlan.subject ? { subject: storedPlan.subject } : {}),
        effects: storedPlan.effects,
      }) !== hashCanonicalJson(descriptor)) {
        throw new Error("RUNTIME_COMPLETION_OWNER_COMMIT_PLAN_CONFLICT");
      }
      await assertRuntimeCompletionManifestInTransactionV1(sql, {
        requestId: current.request_id,
        requireSettledMandatoryEffects: true,
      });
      await authenticateCommittedEffectOwnersInTransactionV1(
        sql,
        current.request_id,
        storedPlan,
      );
      return true;
    }
    throw new Error(`RUNTIME_COMPLETION_OWNER_COMMIT_STATE_INVALID:${current.state}`);
  }
  const capability = currentRuntimeCompletionOwnerCapability();
  if (
    !capability
    || current.request_id !== capability.requestId
    || current.owner_instance_id !== capability.ownerInstanceId
    || current.owner_attempt_count !== capability.ownerAttemptCount
    || !current.lease_expires_at
    || new Date(current.lease_expires_at).getTime() <= wallClock.getTime()
  ) {
    throw new Error("RUNTIME_COMPLETION_OWNER_COMMIT_CAPABILITY_STALE");
  }
  if (["owner_committed", "effects_committed"].includes(current.apply_phase)) {
    if (current.claim_outcome !== input.claimOutcome) {
      throw new Error("RUNTIME_COMPLETION_OWNER_COMMIT_OUTCOME_CONFLICT");
    }
    const storedPlan = current.completion_plan
      ? RuntimeCompletionPlanV1Schema.parse(
        typeof current.completion_plan === "string" ? JSON.parse(current.completion_plan) : current.completion_plan,
      )
      : undefined;
    if (!storedPlan || hashCanonicalJson({
      kind: storedPlan.kind,
      continuation: storedPlan.continuation,
      ...(storedPlan.subject ? { subject: storedPlan.subject } : {}),
      effects: storedPlan.effects,
    }) !== hashCanonicalJson(descriptor)) {
      throw new Error("RUNTIME_COMPLETION_OWNER_COMMIT_PLAN_CONFLICT");
    }
    await assertRuntimeCompletionManifestInTransactionV1(sql, {
      requestId: current.request_id,
    });
    await authenticateCommittedEffectOwnersInTransactionV1(
      sql,
      current.request_id,
      storedPlan,
    );
    return true;
  }
  if (current.apply_phase !== "executing") {
    throw new Error(`RUNTIME_COMPLETION_OWNER_COMMIT_PHASE_INVALID:${current.apply_phase}`);
  }
  const prepared = createRuntimeCompletionPlanV1({
    requestId: current.request_id,
    claimId: input.claimId,
    runId: current.run_id,
    stepDbId: current.step_db_id,
    workflowStepId: current.workflow_step_id,
    outputHash: current.output_hash,
    descriptor,
    preparedAt: wallClock,
  });
  const preparedPlanBytes = Buffer.byteLength(
    canonicalJsonStringify(prepared.plan),
    "utf8",
  );
  if (preparedPlanBytes < 2 || preparedPlanBytes > MAX_RUNTIME_COMPLETION_PLAN_BYTES_V1) {
    throw new Error("RUNTIME_COMPLETION_OWNER_COMMIT_PLAN_SIZE_INVALID");
  }
  if (prepared.plan.effects.some((effect, index) => effect.ordinal !== index)) {
    throw new Error("RUNTIME_COMPLETION_OWNER_COMMIT_EFFECT_ORDER_INVALID");
  }
  const preparedEffects = prepared.plan.effects.map((effect) => {
    const effectPayload = {
      schema: "setfarm.runtime-completion-effect-input.v1" as const,
      planHash: prepared.planHash,
      plan: prepared.plan,
      effect: effect.payload,
    };
    return Object.freeze({
      effect,
      effectPayload,
      inputHash: hashCanonicalJson(effectPayload),
      byteLength: Buffer.byteLength(canonicalJsonStringify(effectPayload), "utf8"),
    });
  });
  const aggregateEffectBytes = preparedEffects.reduce(
    (total, effect) => total + effect.byteLength,
    0,
  );
  if (aggregateEffectBytes < 2
    || aggregateEffectBytes > MAX_RUNTIME_COMPLETION_EFFECT_PAYLOAD_BYTES_V1) {
    throw new Error("RUNTIME_COMPLETION_OWNER_COMMIT_EFFECT_PAYLOAD_SIZE_INVALID");
  }
  const preexistingEffects = await sql.unsafe<Array<{ effect_key: string }>>(
    `SELECT effect_key
       FROM runtime_completion_effects
      WHERE request_id = $1
      ORDER BY ordinal, effect_key
      LIMIT 1`,
    [current.request_id],
  );
  if (preexistingEffects.length !== 0) {
    throw new Error("RUNTIME_COMPLETION_OWNER_COMMIT_EFFECT_PRESEED_DETECTED");
  }
  const updated = await sql.unsafe<Array<{ request_id: string }>>(
    `UPDATE runtime_completion_requests
        SET apply_phase = 'owner_committed', claim_outcome = $2,
            claim_committed_at = $3,
            completion_plan = $4::text::jsonb,
            completion_plan_hash = $5,
            prepared_at = $3,
            updated_at = $3
      WHERE claim_id = $1
        AND request_id = $6
        AND state = 'processing'
        AND apply_phase = 'executing'
        AND owner_instance_id = $7
        AND owner_attempt_count = $8
        AND lease_expires_at > $9
      RETURNING request_id`,
    [
      input.claimId,
      input.claimOutcome.slice(0, 80),
      wallClock,
      JSON.stringify(prepared.plan),
      prepared.planHash,
      capability.requestId,
      capability.ownerInstanceId,
      capability.ownerAttemptCount,
      wallClock,
    ],
  );
  if (updated.length !== 1) throw new Error("RUNTIME_COMPLETION_OWNER_COMMIT_CAS_LOST");
  for (const preparedEffect of preparedEffects) {
    const { effect, effectPayload, inputHash } = preparedEffect;
    const mandatoryEffectOwnerBirth = await beginMandatoryEffectOwnerInTransactionV1(
      sql,
      current.request_id,
      preparedEffect,
    );
    const insertedEffects = await sql.unsafe<Array<{ effect_key: string }>>(
      `INSERT INTO runtime_completion_effects (
         request_id, effect_key, ordinal, effect_type, input_hash,
         payload, mandatory, state, created_at, updated_at
       ) VALUES ($1, $2, $3, $4, $5, $6::text::jsonb, $7, 'pending', $8, $8)
       RETURNING effect_key`,
      [
        current.request_id,
        effect.effectKey,
        effect.ordinal,
        effect.effectType,
        inputHash,
        JSON.stringify(effectPayload),
        effect.mandatory,
        wallClock,
      ],
    );
    if (insertedEffects.length !== 1 || insertedEffects[0]!.effect_key !== effect.effectKey) {
      throw new Error("RUNTIME_COMPLETION_OWNER_COMMIT_EFFECT_INSERT_FAILED");
    }
    const reread = await sql.unsafe<Array<{
      effect_key: string;
      ordinal: number;
      effect_type: string;
      input_hash: string;
      payload: unknown;
      mandatory: boolean;
      state: string;
    }>>(
      `SELECT effect_key,ordinal,effect_type,input_hash,payload,mandatory,state
         FROM runtime_completion_effects
        WHERE request_id = $1 AND effect_key = $2
        FOR UPDATE`,
      [current.request_id, effect.effectKey],
    );
    const stored = reread[0];
    if (
      reread.length !== 1
      || !stored
      || stored.effect_key !== effect.effectKey
      || stored.ordinal !== effect.ordinal
      || stored.effect_type !== effect.effectType
      || stored.input_hash !== inputHash
      || stored.mandatory !== effect.mandatory
      || stored.state !== "pending"
      || canonicalJsonStringify(stored.payload) !== canonicalJsonStringify(effectPayload)
    ) throw new Error("RUNTIME_COMPLETION_OWNER_COMMIT_EFFECT_BINDING_INVALID");
    if (mandatoryEffectOwnerBirth) {
      await bindMandatoryEffectOwnersInTransactionV1(sql, [mandatoryEffectOwnerBirth]);
    }
  }
  const storedEffects = await sql.unsafe<Array<{
    effect_key: string;
    ordinal: number;
    effect_type: string;
    input_hash: string;
    payload: unknown;
    mandatory: boolean;
  }>>(
    `SELECT effect_key, ordinal, effect_type, input_hash, payload, mandatory
       FROM runtime_completion_effects
      WHERE request_id = $1
      ORDER BY ordinal, effect_key
      LIMIT $2`,
    [current.request_id, prepared.plan.effects.length + 1],
  );
  if (storedEffects.length !== prepared.plan.effects.length) {
    throw new Error("RUNTIME_COMPLETION_OWNER_COMMIT_EFFECT_CENSUS_INVALID");
  }
  for (const [index, stored] of storedEffects.entries()) {
    const expected = prepared.plan.effects[index]!;
    const expectedPayload = {
      schema: "setfarm.runtime-completion-effect-input.v1",
      planHash: prepared.planHash,
      plan: prepared.plan,
      effect: expected.payload,
    };
    if (stored.effect_key !== expected.effectKey
      || stored.ordinal !== expected.ordinal
      || stored.effect_type !== expected.effectType
      || stored.mandatory !== expected.mandatory
      || stored.input_hash !== hashCanonicalJson(expectedPayload)
      || canonicalJsonStringify(stored.payload) !== canonicalJsonStringify(expectedPayload)) {
      throw new Error("RUNTIME_COMPLETION_OWNER_COMMIT_EFFECT_BINDING_INVALID");
    }
  }
  const outboxEventKey = `runtime-completion/${current.request_id}/owner-committed`;
  await sql.unsafe(
    `INSERT INTO operational_outbox (
       outbox_id, request_id, event_key, event_type, aggregate_type,
       aggregate_id, payload, state, created_at, updated_at
     ) VALUES ($1, $2, $3, 'runtime.completion_owner_committed',
       'run', $4, $5::text::jsonb, 'pending', $6, $6)
     ON CONFLICT (event_key) DO NOTHING`,
    [
      `OBX_${hashCanonicalJson(outboxEventKey).slice(0, 40)}`,
      current.request_id,
      outboxEventKey,
      current.run_id,
      JSON.stringify({
        schema: "setfarm.operational-outbox-event.v1",
        requestId: current.request_id,
        claimId: input.claimId,
        claimOutcome: input.claimOutcome,
        planHash: prepared.planHash,
      }),
      wallClock,
    ],
  );
  return true;
}

/**
 * Publish an agent's completion proposal without allowing that still-running
 * runtime to close its claim. The spawner is the only consumer allowed to
 * accept it, after durable drain evidence exists.
 */
export async function requestRuntimeCompletion(
  sql: Sql,
  rawInput: Readonly<{
    envelope: ClaimEnvelopeV1;
    output: string;
    requestId?: string;
    now?: Date;
  }>,
): Promise<RequestRuntimeCompletionResult> {
  if (
    Object.hasOwn(rawInput, "submissionEvidence")
    || Object.hasOwn(rawInput, "sourceProposal")
  ) {
    throw new Error("RUNTIME_COMPLETION_CALLER_COMPILER_EVIDENCE_NOT_AUTHORIZED");
  }
  const envelope = parseClaimEnvelope(rawInput.envelope);
  const rawOutput = String(rawInput.output ?? "");
  const outputBytes = Buffer.byteLength(rawOutput, "utf8");
  if (outputBytes < 1 || outputBytes > 4 * 1024 * 1024) {
    throw new Error("RUNTIME_COMPLETION_OUTPUT_SIZE_INVALID");
  }
  validTime(rawInput.now);
  const nativeV3Implementation = envelope.protocol === "v3"
    && envelope.workflowStepId === "implement";
  const transportCompilation = nativeV3Implementation
    ? compileV3ImplementationTransportProposalV1(rawOutput)
    : undefined;
  let output = transportCompilation
    ? canonicalJsonStringify(transportCompilation.output)
    : rawOutput;
  let outputHash = createHash("sha256").update(output, "utf8").digest("hex");
  let submissionEvidence: RuntimeCompletionSubmissionEvidenceV1 | undefined;
  let sourceProposal: string | undefined;
  const requestId = rawInput.requestId
    ? RuntimeCompletionRequestIdSchema.parse(rawInput.requestId)
    : newRuntimeCompletionRequestId();

  // Lost-response retries must be answerable from durable identity even after
  // the claim/run has become terminal. Authority validation is intentionally
  // below this exact replay lookup; it protects new publications, while this
  // branch only returns the already-committed request for the same capability
  // and output hash.
  const replayRows = await sql.unsafe<RuntimeCompletionRow[]>(
    "SELECT * FROM runtime_completion_requests WHERE claim_id = $1 LIMIT 1",
    [envelope.claimId],
  );
  if (replayRows[0]) {
    const replay = mapRequest(replayRows[0]);
    if (
      !completionReplayOutputMatches(
        replay,
        outputHash,
        rawOutput,
        nativeV3Implementation,
      )
      || JSON.stringify(replay.claimEnvelope) !== JSON.stringify(envelope)
    ) {
      throw new Error("RUNTIME_COMPLETION_REQUEST_CONFLICT");
    }
    return { status: "existing", request: replay };
  }

  const runtimeRows = await sql.unsafe<Array<{ session_id: string }>>(
    "SELECT session_id FROM runtime_sessions WHERE claim_id = $1 LIMIT 1",
    [envelope.claimId],
  );
  if (runtimeRows.length === 0) {
    if (envelope.protocol !== "legacy") {
      throw new Error("RUNTIME_COMPLETION_MANAGED_RUNTIME_REQUIRED");
    }
    return { status: "direct" };
  }

  if (nativeV3Implementation) {
    const compiled = await compileV3ImplementationCompletionProposal({
      sql,
      envelope,
      rawProposal: rawOutput,
    });
    output = compiled.output;
    outputHash = compiled.submissionEvidence.canonicalOutputHash;
    submissionEvidence = compiled.submissionEvidence;
    sourceProposal = compiled.sourceProposal;
  }

  await assertClaimAuthority(sql, envelope, envelope.stepId);

  return sql.begin(async (transaction) => {
    if (envelope.storyId) {
      await transaction.unsafe("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [
        v3RecoveryStoryLockIdentity({ runId: envelope.runId, storyId: envelope.storyId }),
      ]);
    }
    const runs = await transaction.unsafe<Array<{ status: string }>>(
      "SELECT status FROM runs WHERE id = $1 FOR UPDATE",
      [envelope.runId],
    );
    if (!runs[0] || !["running", "resuming"].includes(runs[0].status)) {
      throw new Error(`RUNTIME_COMPLETION_RUN_NOT_ACTIVE:${runs[0]?.status ?? "missing"}`);
    }
    const terminations = await transaction.unsafe<Array<{ request_id: string }>>(
      `SELECT request_id FROM run_termination_requests
        WHERE run_id = $1 AND state <> 'terminalized'
        ORDER BY requested_at, request_id LIMIT 1 FOR UPDATE`,
      [envelope.runId],
    );
    if (terminations.length > 0) throw new Error("RUNTIME_COMPLETION_TERMINATION_PENDING");

    const runtimeOwners = await transaction.unsafe<Array<{
      runtime_session_id: string;
      runtime_state: string;
      runtime_owner_instance_id: string;
      runtime_attempt_id: string | null;
    }>>(
      `SELECT rs.session_id AS runtime_session_id,
              rs.state AS runtime_state,
              rs.owner_instance_id AS runtime_owner_instance_id,
              rs.attempt_id AS runtime_attempt_id
         FROM runtime_sessions rs
        WHERE rs.claim_id = $1 AND rs.run_id = $2
        ORDER BY rs.session_id
        FOR UPDATE`,
      [envelope.claimId, envelope.runId],
    );
    if (runtimeOwners.length !== 1) {
      throw new Error(`RUNTIME_COMPLETION_RUNTIME_OWNER_CARDINALITY_INVALID:${runtimeOwners.length}`);
    }
    const runtimeOwner = runtimeOwners[0];
    if (!runtimeOwner) throw new Error("RUNTIME_COMPLETION_OWNER_NOT_FOUND");

    let normalAttemptLeaseFence: Readonly<{
      attemptLeaseExpiresAt: Date | string;
    }> | undefined;
    let recoveryLeaseFence: Readonly<{
      attemptLeaseExpiresAt: Date | string;
      deliveryLeaseExpiresAt: Date | string;
    }> | undefined;
    if (nativeV3Implementation && envelope.attempt) {
      const attempts = await transaction.unsafe<Array<{
        attempt_id: string;
        claim_id: string | number | null;
        run_id: string;
        story_id: string;
        generation: number;
        fence_token: string;
        disposition: string;
        step_id: string;
        agent_id: string | null;
        recovery_case_revision_id: string | null;
        recovery_dispatch_id: string | null;
        lease_expires_at: Date | string;
      }>>(
        `SELECT attempt_id, claim_id, run_id, step_id, story_id, agent_id,
                generation, fence_token, disposition,
                recovery_case_revision_id, recovery_dispatch_id,
                lease_expires_at
           FROM execution_attempts
          WHERE attempt_id = $1
          FOR UPDATE`,
        [envelope.attempt.attemptId],
      );
      const attempt = attempts[0];
      const recoveryBound = Boolean(
        attempt?.recovery_case_revision_id && attempt.recovery_dispatch_id,
      );
      if ((attempt?.recovery_case_revision_id === null) !== (attempt?.recovery_dispatch_id === null)) {
        throw new Error("RUNTIME_COMPLETION_RECOVERY_ATTEMPT_IDENTITY_INCOMPLETE");
      }
      const exactAttempt = Boolean(
        attempt
        && Number(attempt.claim_id) === envelope.claimId
        && attempt.run_id === envelope.runId
        && attempt.step_id === envelope.workflowStepId
        && attempt.story_id === envelope.storyId
        && (attempt.agent_id === null || attempt.agent_id === envelope.claimAgentId)
        && attempt.generation === envelope.attempt.generation
        && attempt.fence_token === envelope.attempt.fenceToken
        && ["claimed", "running"].includes(attempt.disposition)
        && runtimeOwner.runtime_attempt_id === attempt.attempt_id
      );
      if (!exactAttempt) {
        throw new Error(
          recoveryBound
            ? "RUNTIME_COMPLETION_RECOVERY_ATTEMPT_FENCE_STALE"
            : "RUNTIME_COMPLETION_NORMAL_ATTEMPT_FENCE_STALE",
        );
      }
      if (recoveryBound) {
        const deliveries = await transaction.unsafe<Array<{
          dispatch_id: string;
          lease_expires_at: Date | string;
        }>>(
          `SELECT dispatch_id, lease_expires_at
             FROM recovery_dispatch_deliveries
            WHERE dispatch_id = $1
              AND revision_id = $2
              AND run_id = $3
              AND story_id = $4
              AND attempt_id = $5
              AND claim_id = $6
              AND state IN ('attempt_reserved', 'running')
            FOR UPDATE`,
          [
            attempt.recovery_dispatch_id!,
            attempt.recovery_case_revision_id!,
            envelope.runId,
            envelope.storyId!,
            attempt.attempt_id,
            envelope.claimId,
          ],
        );
        if (deliveries.length !== 1) {
          throw new Error("RUNTIME_COMPLETION_RECOVERY_DELIVERY_FENCE_STALE");
        }
        recoveryLeaseFence = {
          attemptLeaseExpiresAt: attempt.lease_expires_at,
          deliveryLeaseExpiresAt: deliveries[0]!.lease_expires_at,
        };
      } else {
        normalAttemptLeaseFence = { attemptLeaseExpiresAt: attempt!.lease_expires_at };
      }
    }

    const claimOwners = await transaction.unsafe<Array<{
      claim_outcome: string | null;
      claim_run_id: string;
      claim_step_id: string;
      claim_story_id: string | null;
      claim_agent_id: string;
    }>>(
      `SELECT cl.outcome AS claim_outcome, cl.run_id AS claim_run_id,
              cl.step_id AS claim_step_id, cl.story_id AS claim_story_id,
              cl.agent_id AS claim_agent_id
         FROM claim_log cl
        WHERE cl.id = $1
        FOR UPDATE`,
      [envelope.claimId],
    );
    const claimOwner = claimOwners[0];
    if (!claimOwner) throw new Error("RUNTIME_COMPLETION_OWNER_NOT_FOUND");
    if (
      claimOwner.claim_run_id !== envelope.runId
      || claimOwner.claim_step_id !== envelope.workflowStepId
      || (claimOwner.claim_story_id ?? undefined) !== envelope.storyId
      || claimOwner.claim_agent_id !== envelope.claimAgentId
    ) throw new Error("RUNTIME_COMPLETION_OWNER_IDENTITY_MISMATCH");
    if (claimOwner.claim_outcome !== null) throw new Error("RUNTIME_COMPLETION_OWNER_NOT_ACTIVE");
    const owner = { ...runtimeOwner, ...claimOwner };

    let boundStorySubject: V3StoryClaimRuntimeSubjectV1 | undefined;
    if (envelope.protocol === "v3"
      && (envelope.workflowStepId === "implement" || envelope.workflowStepId === "supervise")) {
      boundStorySubject = await loadAndRevalidateV3StoryClaimRuntimeBindingV1(transaction, {
        claimId: envelope.claimId,
        runtimeSessionId: runtimeOwner.runtime_session_id,
        runId: envelope.runId,
        stepDbId: envelope.stepId,
        workflowStepId: envelope.workflowStepId,
      });
      if (envelope.workflowStepId === "implement") {
        if (boundStorySubject.kind !== "story_member"
          || envelope.storyDbId !== boundStorySubject.storyDbId
          || envelope.storyId !== boundStorySubject.storyId) {
          throw new Error("RUNTIME_COMPLETION_STORY_BINDING_ENVELOPE_MISMATCH");
        }
      } else if (envelope.storyDbId || envelope.storyId || envelope.attempt) {
        throw new Error("RUNTIME_COMPLETION_SUPERVISE_ENVELOPE_STORY_FORBIDDEN");
      }
    }

    const existing = await transaction.unsafe<RuntimeCompletionRow[]>(
      "SELECT * FROM runtime_completion_requests WHERE claim_id = $1 LIMIT 1 FOR UPDATE",
      [envelope.claimId],
    );
    if (existing[0]) {
      const request = mapRequest(existing[0]);
      if (
        request.runtimeSessionId !== owner.runtime_session_id
        || !completionReplayOutputMatches(
          request,
          outputHash,
          rawOutput,
          nativeV3Implementation,
        )
        || JSON.stringify(request.claimEnvelope) !== JSON.stringify(envelope)
      ) {
        throw new Error("RUNTIME_COMPLETION_REQUEST_CONFLICT");
      }
      return { status: "existing" as const, request };
    }
    const steps = await transaction.unsafe<Array<{ status: string; current_story_id: string | null }>>(
      `SELECT status, current_story_id FROM steps
        WHERE id = $1 AND run_id = $2 AND step_id = $3 FOR UPDATE`,
      [envelope.stepId, envelope.runId, envelope.workflowStepId],
    );
    const expectedStepStoryDbId = boundStorySubject?.kind === "story_member"
      ? boundStorySubject.storyDbId
      : envelope.storyDbId ?? null;
    if (
      steps[0]?.status !== "running"
      || steps[0].current_story_id !== expectedStepStoryDbId
    ) throw new Error("RUNTIME_COMPLETION_OWNER_NOT_ACTIVE");
    // The step is the final lock in the publication chain. Read a volatile DB
    // wall clock only now: waiting on any earlier owner/step lock must be able
    // to expire the recovery lease before this publication becomes durable.
    const publicationTime = await readDatabaseWallClock(
      transaction,
      "RUNTIME_COMPLETION_DATABASE_WALL_CLOCK_UNAVAILABLE",
    );
    if (recoveryLeaseFence || normalAttemptLeaseFence) {
      const attemptLeaseExpiresAt = recoveryLeaseFence?.attemptLeaseExpiresAt
        ?? normalAttemptLeaseFence!.attemptLeaseExpiresAt;
      if (new Date(attemptLeaseExpiresAt).getTime() <= publicationTime.getTime()) {
        throw new Error(
          recoveryLeaseFence
            ? "RUNTIME_COMPLETION_RECOVERY_ATTEMPT_FENCE_STALE"
            : "RUNTIME_COMPLETION_NORMAL_ATTEMPT_FENCE_STALE",
        );
      }
      if (
        recoveryLeaseFence
        && new Date(recoveryLeaseFence.deliveryLeaseExpiresAt).getTime() <= publicationTime.getTime()
      ) {
        throw new Error("RUNTIME_COMPLETION_RECOVERY_DELIVERY_FENCE_STALE");
      }
    }
    if (!["reserved", "starting", "running", "drain_requested", "drained"].includes(owner.runtime_state)) {
      throw new Error(`RUNTIME_COMPLETION_RUNTIME_STATE_INVALID:${owner.runtime_state}`);
    }

    const inserted = await transaction.unsafe<RuntimeCompletionRow[]>(
      `INSERT INTO runtime_completion_requests (
         request_id, runtime_session_id, claim_id, run_id, step_db_id,
         workflow_step_id, story_db_id, story_id, attempt_id,
         claim_envelope, output, output_hash, source_proposal, submission_evidence,
         state, requested_by, requested_at, result, created_at, updated_at
       ) VALUES (
         $1, $2, $3, $4, $5,
         $6, $7, $8, $9,
         $10::text::jsonb, $11, $12, $13, $14::text::jsonb,
         'requested', $15, $16, '{}'::jsonb, $16, $16
       )
       RETURNING *`,
      [
        requestId,
        owner.runtime_session_id,
        envelope.claimId,
        envelope.runId,
        envelope.stepId,
        envelope.workflowStepId,
        boundStorySubject?.kind === "story_member"
          ? boundStorySubject.storyDbId
          : envelope.storyDbId ?? null,
        boundStorySubject?.kind === "story_member"
          ? boundStorySubject.storyId
          : envelope.storyId ?? null,
        envelope.attempt?.attemptId ?? null,
        JSON.stringify(envelope),
        output,
        outputHash,
        sourceProposal ?? null,
        submissionEvidence ? JSON.stringify(submissionEvidence) : null,
        envelope.runtimeAgentId,
        publicationTime,
      ],
    );
    if (inserted.length !== 1) throw new Error("RUNTIME_COMPLETION_REQUEST_INSERT_FAILED");
    if (["reserved", "starting", "running"].includes(owner.runtime_state)) {
      const drained = await transaction.unsafe<Array<{ session_id: string }>>(
        `UPDATE runtime_sessions
            SET state = 'drain_requested',
                drain_requested_at = COALESCE(drain_requested_at, $3),
                diagnostic = $4,
                state_version = state_version + 1,
                updated_at = $3
          WHERE session_id = $1
            AND owner_instance_id = $2
            AND state IN ('reserved', 'starting', 'running')
          RETURNING session_id`,
        [
          owner.runtime_session_id,
          owner.runtime_owner_instance_id,
          publicationTime,
          `Completion ${requestId} requested exact runtime drain`,
        ],
      );
      if (drained.length !== 1) throw new Error("RUNTIME_COMPLETION_DRAIN_REQUEST_CAS_LOST");
    }
    return { status: "requested" as const, request: mapRequest(inserted[0]!) };
  }) as Promise<RequestRuntimeCompletionResult>;
}

/**
 * Quarantine an expired processing owner from the recovery lane. This is
 * deliberately separate from the live-owner repository API: the caller does
 * not own the expired lease, so it must present the exact owner, lease,
 * phase, and row-version timestamps it locked while proving expiry.
 */
export async function quarantineExpiredRuntimeCompletionForRecoveryInTransaction(
  sql: TransactionSql,
  input: Readonly<{
    requestId: string;
    expectedOwnerInstanceId: string;
    expectedLeaseExpiresAt: string;
    expectedUpdatedAt: string;
    expectedApplyPhase: z.infer<typeof RuntimeCompletionApplyPhaseSchema>;
    diagnostic: string;
    now?: Date;
  }>,
): Promise<RuntimeCompletionRequest> {
  if (!input.expectedOwnerInstanceId.trim()) {
    throw new Error("RUNTIME_COMPLETION_RECOVERY_QUARANTINE_OWNER_REQUIRED");
  }
  if (!input.diagnostic.trim()) {
    throw new Error("RUNTIME_COMPLETION_RECOVERY_QUARANTINE_DIAGNOSTIC_REQUIRED");
  }
  validTime(input.now);
  const expectedLeaseExpiresAt = exactTimestamp(
    input.expectedLeaseExpiresAt,
    "RUNTIME_COMPLETION_RECOVERY_QUARANTINE_LEASE_INVALID",
  );
  const expectedUpdatedAt = exactTimestamp(
    input.expectedUpdatedAt,
    "RUNTIME_COMPLETION_RECOVERY_QUARANTINE_VERSION_INVALID",
  );
  const identities = await sql.unsafe<Array<{ run_id: string }>>(
    "SELECT run_id FROM runtime_completion_requests WHERE request_id = $1",
    [RuntimeCompletionRequestIdSchema.parse(input.requestId)],
  );
  if (!identities[0]) throw new Error("RUNTIME_COMPLETION_RECOVERY_QUARANTINE_CAS_LOST");
  await sql.unsafe("SELECT id FROM runs WHERE id = $1 FOR UPDATE", [identities[0].run_id]);
  const locked = await sql.unsafe<RuntimeCompletionRow[]>(
    "SELECT * FROM runtime_completion_requests WHERE request_id = $1 FOR UPDATE",
    [input.requestId],
  );
  const current = locked[0];
  const now = await readDatabaseWallClock(
    sql,
    "RUNTIME_COMPLETION_DATABASE_WALL_CLOCK_UNAVAILABLE",
  );
  if (
    !current
    || current.state !== "processing"
    || current.owner_instance_id !== input.expectedOwnerInstanceId
    || !current.lease_expires_at
    || new Date(current.lease_expires_at).getTime() !== expectedLeaseExpiresAt.getTime()
    || new Date(current.updated_at).getTime() !== expectedUpdatedAt.getTime()
    || current.apply_phase !== input.expectedApplyPhase
  ) {
    throw new Error("RUNTIME_COMPLETION_RECOVERY_QUARANTINE_CAS_LOST");
  }
  if (expectedLeaseExpiresAt.getTime() > now.getTime()) {
    throw new Error("RUNTIME_COMPLETION_RECOVERY_QUARANTINE_LEASE_STILL_LIVE");
  }
  const rows = await sql.unsafe<RuntimeCompletionRow[]>(
    `UPDATE runtime_completion_requests
        SET state = 'quarantined', lease_expires_at = NULL,
            diagnostic = $2, updated_at = $3
      WHERE request_id = $1
        AND state = 'processing'
        AND owner_instance_id = $4
        AND lease_expires_at = $5
        AND lease_expires_at <= $3
        AND updated_at = $6
        AND apply_phase = $7
      RETURNING *`,
    [
      RuntimeCompletionRequestIdSchema.parse(input.requestId),
      input.diagnostic.slice(0, 4_000),
      now,
      input.expectedOwnerInstanceId,
      expectedLeaseExpiresAt,
      expectedUpdatedAt,
      RuntimeCompletionApplyPhaseSchema.parse(input.expectedApplyPhase),
    ],
  );
  if (rows.length !== 1) {
    throw new Error("RUNTIME_COMPLETION_RECOVERY_QUARANTINE_CAS_LOST");
  }
  await closeCompletionOwnerAfterTerminalMutationV1(sql, rows[0]!.request_id);
  return mapRequest(rows[0]!);
}

type LockedRuntimeCompletionChain = Readonly<{
  request: RuntimeCompletionRow;
  runStatus: string;
  terminationRequestId?: string;
  runtimeState: string;
  claimOutcome: string | null;
}>;

async function lockRuntimeCompletionChainInTransaction(
  transaction: TransactionSql,
  rawRequestId: string,
): Promise<LockedRuntimeCompletionChain | undefined> {
  const requestId = RuntimeCompletionRequestIdSchema.parse(rawRequestId);
  const identities = await transaction.unsafe<RuntimeCompletionRow[]>(
    "SELECT * FROM runtime_completion_requests WHERE request_id = $1",
    [requestId],
  );
  const identity = identities[0];
  if (!identity) return undefined;
  if (identity.story_id) {
    await transaction.unsafe("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [
      v3RecoveryStoryLockIdentity({ runId: identity.run_id, storyId: identity.story_id }),
    ]);
  }
  const runs = await transaction.unsafe<Array<{ status: string }>>(
    "SELECT status FROM runs WHERE id = $1 FOR UPDATE",
    [identity.run_id],
  );
  if (!runs[0]) throw new Error("RUNTIME_COMPLETION_RUN_NOT_FOUND");
  const terminations = await transaction.unsafe<Array<{ request_id: string }>>(
    `SELECT request_id FROM run_termination_requests
      WHERE run_id = $1 AND state <> 'terminalized'
      ORDER BY requested_at, request_id LIMIT 1 FOR UPDATE`,
    [identity.run_id],
  );
  const runtimes = await transaction.unsafe<Array<{
    session_id: string;
    claim_id: string | number;
    attempt_id: string | null;
    state: string;
  }>>(
    `SELECT session_id, claim_id, attempt_id, state
       FROM runtime_sessions WHERE session_id = $1 FOR UPDATE`,
    [identity.runtime_session_id],
  );
  const runtime = runtimes[0];
  if (!runtime) throw new Error("RUNTIME_COMPLETION_RUNTIME_NOT_FOUND");
  if (identity.attempt_id) {
    const attempts = await transaction.unsafe<Array<{ attempt_id: string }>>(
      "SELECT attempt_id FROM execution_attempts WHERE attempt_id = $1 FOR UPDATE",
      [identity.attempt_id],
    );
    if (attempts.length !== 1) throw new Error("RUNTIME_COMPLETION_ATTEMPT_NOT_FOUND");
    await transaction.unsafe(
      `SELECT dispatch_id FROM recovery_dispatch_deliveries
        WHERE attempt_id = $1 AND claim_id = $2 FOR UPDATE`,
      [identity.attempt_id, identity.claim_id],
    );
  }
  const claims = await transaction.unsafe<Array<{ outcome: string | null }>>(
    "SELECT outcome FROM claim_log WHERE id = $1 FOR UPDATE",
    [identity.claim_id],
  );
  if (!claims[0]) throw new Error("RUNTIME_COMPLETION_CLAIM_NOT_FOUND");
  const requests = await transaction.unsafe<RuntimeCompletionRow[]>(
    "SELECT * FROM runtime_completion_requests WHERE request_id = $1 FOR UPDATE",
    [requestId],
  );
  const request = requests[0];
  if (
    !request
    || request.run_id !== identity.run_id
    || request.runtime_session_id !== identity.runtime_session_id
    || request.claim_id !== identity.claim_id
    || request.attempt_id !== identity.attempt_id
    || String(runtime.claim_id) !== String(identity.claim_id)
    || runtime.attempt_id !== identity.attempt_id
  ) throw new Error("RUNTIME_COMPLETION_CHAIN_IDENTITY_CHANGED");
  return {
    request,
    runStatus: runs[0].status,
    ...(terminations[0] ? { terminationRequestId: terminations[0].request_id } : {}),
    runtimeState: runtime.state,
    claimOutcome: claims[0].outcome,
  };
}

export function createRuntimeCompletionRepository(sql: Sql) {
  const findById = (requestId: string): Promise<RuntimeCompletionRequest | undefined> =>
    findRuntimeCompletionRequestByIdV1(sql, requestId);

  return Object.freeze({
    findById,
    async findByClaimId(rawClaimId: number): Promise<RuntimeCompletionRequest | undefined> {
      if (!Number.isSafeInteger(rawClaimId) || rawClaimId <= 0) throw new Error("RUNTIME_COMPLETION_CLAIM_ID_INVALID");
      const rows = await sql.unsafe<RuntimeCompletionRow[]>(
        "SELECT * FROM runtime_completion_requests WHERE claim_id = $1 LIMIT 1",
        [rawClaimId],
      );
      return rows[0] ? mapRequest(rows[0]) : undefined;
    },
    async listPending(limit = 100): Promise<RuntimeCompletionRequest[]> {
      const bounded = Math.max(1, Math.min(500, Math.trunc(limit)));
      const rows = await sql.unsafe<RuntimeCompletionRow[]>(
        `SELECT * FROM runtime_completion_requests
          WHERE state IN ('requested', 'draining', 'processing')
          ORDER BY requested_at, request_id LIMIT $1`,
        [bounded],
      );
      return rows.map(mapRequest);
    },
    async claim(input: Readonly<{
      requestId?: string;
      ownerInstanceId: string;
      leaseMs?: number;
      now?: Date;
    }>): Promise<RuntimeCompletionRequest | undefined> {
      validTime(input.now);
      const leaseMs = Math.max(30_000, Math.min(30 * 60_000, Math.trunc(input.leaseMs ?? 10 * 60_000)));
      return sql.begin(async (transaction) => {
        const candidates = await transaction.unsafe<Array<{ request_id: string; run_id: string }>>(
          `SELECT request_id, run_id FROM runtime_completion_requests
            WHERE ($1::text IS NULL OR request_id = $1)
              AND (
                state = 'requested'
                OR (state = 'draining' AND lease_expires_at <= clock_timestamp())
              )
            ORDER BY requested_at, request_id
            LIMIT 1`,
          [input.requestId ?? null],
        );
        const candidate = candidates[0];
        if (!candidate) return undefined;

        const chain = await lockRuntimeCompletionChainInTransaction(transaction, candidate.request_id);
        const request = chain?.request;
        const wallClock = await readDatabaseWallClock(
          transaction,
          "RUNTIME_COMPLETION_DATABASE_WALL_CLOCK_UNAVAILABLE",
        );
        if (
          !request
          || !(
            request.state === "requested"
            || (request.state === "draining" && request.lease_expires_at
              && new Date(request.lease_expires_at).getTime() <= wallClock.getTime())
          )
        ) return undefined;
        // A cancellation published before this completion acquired ownership
        // wins immediately. If this request was already draining and its lease
        // expired, however, it must be recoverable solely to finish/reuse the
        // exact drain proof; markProcessing will then observe cancellation and
        // reject the completion before product state can change.
        if (chain.terminationRequestId && request.state === "requested") return undefined;
        const ownerBirth = await beginCompletionOwnerReservationInTransactionV1(
          transaction,
          request.request_id,
          request.state === "requested" ? "pending" : "bound",
        );
        const leaseExpiresAt = new Date(wallClock.getTime() + leaseMs);
        const updated = await transaction.unsafe<RuntimeCompletionRow[]>(
          `UPDATE runtime_completion_requests
              SET state = 'draining', owner_instance_id = $2,
                  lease_expires_at = $3, updated_at = $4
            WHERE request_id = $1
              AND (state = 'requested' OR (state = 'draining' AND lease_expires_at <= $5))
            RETURNING *`,
          [request.request_id, input.ownerInstanceId, leaseExpiresAt, wallClock, wallClock],
        );
        if (updated.length !== 1 || !updated[0]) {
          throw new Error("RUNTIME_COMPLETION_CLAIM_CAS_LOST");
        }
        const bound = await bindCompletionOwnerReservationInTransactionV1(
          transaction,
          ownerBirth,
          updated[0],
        );
        return mapRequest(bound);
      }) as Promise<RuntimeCompletionRequest | undefined>;
    },
    async recoverExpiredProcessing(input: Readonly<{
      ownerInstanceId: string;
      leaseMs?: number;
      now?: Date;
    }>): Promise<Readonly<{
      status: "none" | "resume_owner" | "resume_effects" | "finalize" | "bootstrap_selected" | "preempted" | "quarantined";
      request?: RuntimeCompletionRequest;
    }>> {
      validTime(input.now);
      const leaseMs = Math.max(60_000, Math.min(60 * 60_000, Math.trunc(input.leaseMs ?? 10 * 60_000)));
      return sql.begin(async (transaction) => {
        const candidates = await transaction.unsafe<Array<{ request_id: string; run_id: string }>>(
          `SELECT request_id, run_id
             FROM runtime_completion_requests
            WHERE state = 'processing' AND lease_expires_at <= clock_timestamp()
            ORDER BY requested_at, request_id
            LIMIT 1`,
          [],
        );
        const candidate = candidates[0];
        if (!candidate) return { status: "none" as const };
        const chain = await lockRuntimeCompletionChainInTransaction(transaction, candidate.request_id);
        const request = chain?.request;
        const wallClock = await readDatabaseWallClock(
          transaction,
          "RUNTIME_COMPLETION_DATABASE_WALL_CLOCK_UNAVAILABLE",
        );
        if (
          !request
          || request.state !== "processing"
          || !request.lease_expires_at
          || new Date(request.lease_expires_at).getTime() > wallClock.getTime()
        ) return { status: "none" as const };
        if (request.apply_phase === "effects_committed" && completionBootstrapSelectedEligibilityMatchesRowV1(request)) {
          if (!request.owner_instance_id || !request.lease_expires_at) throw new Error("RUNTIME_COMPLETION_BOOTSTRAP_SELECTED_RECOVERY_AUTHORITY_INCOMPLETE");
          const token = Object.freeze({});
          completionBootstrapSelectedRecoveryCandidatesV1.set(token, Object.freeze({
            requestId: request.request_id,
            ownerInstanceId: request.owner_instance_id,
            ownerAttemptCount: request.owner_attempt_count,
            leaseExpiresAt: timestamp(request.lease_expires_at),
          }));
          completionBootstrapPendingSelectedRecoveryTokenV1 = token;
          return { status: "bootstrap_selected" as const, request: mapRequest(request) };
        }
        const runtimeState = chain.runtimeState;
        const claimOutcome = chain.claimOutcome;
        const quarantineExpiredOwner = async (diagnostic: string): Promise<RuntimeCompletionRequest> => {
          if (!request.owner_instance_id || !request.lease_expires_at) {
            throw new Error("RUNTIME_COMPLETION_RECOVERY_QUARANTINE_PROOF_INCOMPLETE");
          }
          return quarantineExpiredRuntimeCompletionForRecoveryInTransaction(transaction, {
            requestId: request.request_id,
            expectedOwnerInstanceId: request.owner_instance_id,
            expectedLeaseExpiresAt: timestamp(request.lease_expires_at),
            expectedUpdatedAt: timestamp(request.updated_at),
            expectedApplyPhase: RuntimeCompletionApplyPhaseSchema.parse(request.apply_phase),
            diagnostic,
            now: wallClock,
          });
        };
        if (
          chain.terminationRequestId
          && request.apply_phase === "executing"
          && claimOutcome === null
        ) {
          const rejected = await transaction.unsafe<RuntimeCompletionRow[]>(
            `UPDATE runtime_completion_requests
                SET state = 'rejected', rejected_at = $2, lease_expires_at = NULL,
                    diagnostic = $3, updated_at = $2
              WHERE request_id = $1 AND state = 'processing'
              RETURNING *`,
            [
              request.request_id,
              wallClock,
              `Completion preempted before owner commit by ${chain.terminationRequestId}`,
            ],
          );
          if (rejected.length !== 1) throw new Error("RUNTIME_COMPLETION_RECOVERY_PREEMPT_CAS_LOST");
          await closeCompletionOwnerAfterTerminalMutationV1(
            transaction,
            rejected[0]!.request_id,
          );
          return { status: "preempted" as const, request: mapRequest(rejected[0]!) };
        }
        if (
          runtimeState === "drained"
          && claimOutcome === null
          && request.apply_phase === "executing"
        ) {
          if (request.owner_attempt_count >= 3) {
            const quarantined = await quarantineExpiredOwner(
              "RUNTIME_COMPLETION_OWNER_ATTEMPT_BUDGET_EXHAUSTED: exact completion owner failed three times without a durable owner commit",
            );
            return { status: "quarantined" as const, request: quarantined };
          }
          const adopted = await transaction.unsafe<RuntimeCompletionRow[]>(
            `UPDATE runtime_completion_requests
                SET owner_instance_id = $2, lease_expires_at = $3,
                    owner_attempt_count = owner_attempt_count + 1, updated_at = $1
              WHERE request_id = $4 AND state = 'processing'
              RETURNING *`,
            [wallClock, input.ownerInstanceId, new Date(wallClock.getTime() + leaseMs), request.request_id],
          );
          if (adopted.length !== 1) throw new Error("RUNTIME_COMPLETION_RECOVERY_CAS_LOST");
          return { status: "resume_owner" as const, request: mapRequest(adopted[0]!) };
        }
        if (
          runtimeState === "drained"
          && claimOutcome !== null
          && ["owner_committed", "effects_committed"].includes(request.apply_phase)
        ) {
          // The pre-owner attempt count is intentionally bounded by the frozen
          // v8 schema. Once the owner receipt is durable, fence every recovery
          // generation with a fresh internal owner identity instead of
          // incrementing that exhausted pre-commit budget.
          const recoveryOwnerInstanceId = newRuntimeCompletionRecoveryOwnerInstanceIdV1();
          const adopted = await transaction.unsafe<RuntimeCompletionRow[]>(
            `UPDATE runtime_completion_requests
                SET owner_instance_id = $2, lease_expires_at = $3,
                    updated_at = $1
              WHERE request_id = $4 AND state = 'processing'
                AND apply_phase = $5
                AND owner_attempt_count = $6
                AND owner_instance_id = $7
              RETURNING *`,
            [
              wallClock,
              recoveryOwnerInstanceId,
              new Date(wallClock.getTime() + leaseMs),
              request.request_id,
              request.apply_phase,
              request.owner_attempt_count,
              request.owner_instance_id,
            ],
          );
          if (adopted.length !== 1) throw new Error("RUNTIME_COMPLETION_RECOVERY_CAS_LOST");
          return {
            status: request.apply_phase === "effects_committed" ? "finalize" as const : "resume_effects" as const,
            request: mapRequest(adopted[0]!),
          };
        }
        const diagnostic = claimOutcome === null
          ? "EXPIRED_COMPLETION_PROCESSING_WITH_ACTIVE_CLAIM: owner commit absent; bounded recovery required"
          : `EXPIRED_COMPLETION_PROCESSING_RECEIPT_INVALID:phase=${request.apply_phase}:runtime=${runtimeState}`;
        const quarantined = await quarantineExpiredOwner(diagnostic);
        return { status: "quarantined" as const, request: quarantined };
      }) as Promise<Readonly<{
        status: "none" | "resume_owner" | "resume_effects" | "finalize" | "bootstrap_selected" | "preempted" | "quarantined";
        request?: RuntimeCompletionRequest;
      }>>;
    },
    async heartbeatProcessing(input: Readonly<{
      requestId: string;
      ownerInstanceId: string;
      ownerAttemptCount: number;
      leaseMs?: number;
      now?: Date;
    }>): Promise<boolean> {
      validTime(input.now);
      const leaseMs = Math.max(60_000, Math.min(60 * 60_000, Math.trunc(input.leaseMs ?? 10 * 60_000)));
      return sql.begin(async (transaction) => {
        const chain = await lockRuntimeCompletionChainInTransaction(transaction, input.requestId);
        const request = chain?.request;
        if (!request) return false;
        const wallClock = await readDatabaseWallClock(
          transaction,
          "RUNTIME_COMPLETION_DATABASE_WALL_CLOCK_UNAVAILABLE",
        );
        const ownerAttemptCount = z.number().int().positive().parse(input.ownerAttemptCount);
        if (
          request.state !== "processing"
          || request.owner_instance_id !== input.ownerInstanceId
          || request.owner_attempt_count !== ownerAttemptCount
          || !request.lease_expires_at
          || new Date(request.lease_expires_at).getTime() <= wallClock.getTime()
        ) return false;
        const rows = await transaction.unsafe<Array<{ request_id: string }>>(
          `UPDATE runtime_completion_requests
              SET lease_expires_at = $3, updated_at = $4
            WHERE request_id = $1
              AND owner_instance_id = $2
              AND owner_attempt_count = $5
              AND state = 'processing'
              AND lease_expires_at > $6
            RETURNING request_id`,
          [
            request.request_id,
            input.ownerInstanceId,
            new Date(wallClock.getTime() + leaseMs),
            wallClock,
            ownerAttemptCount,
            wallClock,
          ],
        );
        return rows.length === 1;
      }) as Promise<boolean>;
    },
    async markProcessing(input: Readonly<{
      requestId: string;
      ownerInstanceId: string;
      leaseMs?: number;
      now?: Date;
    }>): Promise<RuntimeCompletionRequest> {
      validTime(input.now);
      const leaseMs = Math.max(60_000, Math.min(60 * 60_000, Math.trunc(input.leaseMs ?? 30 * 60_000)));
      return sql.begin(async (transaction) => {
        const chain = await lockRuntimeCompletionChainInTransaction(transaction, input.requestId);
        const request = chain?.request;
        if (!request) throw new Error("RUNTIME_COMPLETION_REQUEST_NOT_FOUND");
        const wallClock = await readDatabaseWallClock(
          transaction,
          "RUNTIME_COMPLETION_DATABASE_WALL_CLOCK_UNAVAILABLE",
        );
        if (request.state !== "draining" || request.owner_instance_id !== input.ownerInstanceId) {
          throw new Error("RUNTIME_COMPLETION_DRAIN_OWNER_MISMATCH");
        }
        if (
          !request.lease_expires_at
          || new Date(request.lease_expires_at).getTime() <= wallClock.getTime()
        ) throw new Error("RUNTIME_COMPLETION_DRAIN_OWNER_LEASE_STALE");
        if (chain.runtimeState !== "drained") throw new Error("RUNTIME_COMPLETION_RUNTIME_NOT_DRAINED");
        if (chain.claimOutcome !== null) throw new Error("RUNTIME_COMPLETION_CLAIM_ALREADY_TERMINAL");
        if (!["running", "resuming"].includes(chain.runStatus)) {
          throw new Error(`RUNTIME_COMPLETION_RUN_NOT_ACTIVE:${chain.runStatus}`);
        }
        if (chain.terminationRequestId) throw new Error("RUNTIME_COMPLETION_TERMINATION_PENDING");
        const updated = await transaction.unsafe<RuntimeCompletionRow[]>(
          `UPDATE runtime_completion_requests
              SET state = 'processing', processing_at = $3,
                  apply_phase = 'executing',
                  owner_attempt_count = owner_attempt_count + 1,
                  drained_at = COALESCE(drained_at, $3),
                  lease_expires_at = $4, updated_at = $3
            WHERE request_id = $1 AND owner_instance_id = $2 AND state = 'draining'
              AND owner_attempt_count < 3
            RETURNING *`,
          [
            request.request_id,
            input.ownerInstanceId,
            wallClock,
            new Date(wallClock.getTime() + leaseMs),
          ],
        );
        if (updated.length !== 1) throw new Error("RUNTIME_COMPLETION_PROCESSING_CAS_LOST");
        return mapRequest(updated[0]!);
      }) as Promise<RuntimeCompletionRequest>;
    },
    async markEffectsCommitted(input: Readonly<{
      requestId: string;
      ownerInstanceId: string;
      ownerAttemptCount: number;
      result: Record<string, unknown>;
      now?: Date;
    }>): Promise<RuntimeCompletionRequest> {
      if (input.now) validTime(input.now);
      return sql.begin(async (transaction) => {
        const chain = await lockRuntimeCompletionChainInTransaction(
          transaction,
          input.requestId,
        );
        const current = chain?.request;
        if (!current) throw new Error("RUNTIME_COMPLETION_REQUEST_NOT_FOUND");
        const ownerAttemptCount = z.number().int().positive().parse(input.ownerAttemptCount);
        const canonicalResult = hashCanonicalJson(input.result);
        if (current.state === "accepted") {
          if (
            current.apply_phase === "effects_committed"
            && hashCanonicalJson(objectValue(current.result, "RUNTIME_COMPLETION_RESULT_INVALID")) === canonicalResult
          ) return mapRequest(current);
          throw new Error("RUNTIME_COMPLETION_EFFECTS_COMMIT_TERMINAL_CONFLICT");
        }
        const wallClock = await readDatabaseWallClock(
          transaction,
          "RUNTIME_COMPLETION_DATABASE_WALL_CLOCK_UNAVAILABLE",
        );
        const exactOwner = current.state === "processing"
          && current.owner_instance_id === input.ownerInstanceId
          && current.owner_attempt_count === ownerAttemptCount
          && current.lease_expires_at !== null
          && new Date(current.lease_expires_at).getTime() > wallClock.getTime();
        if (
          exactOwner
          && current.apply_phase === "effects_committed"
        ) {
          if (hashCanonicalJson(objectValue(current.result, "RUNTIME_COMPLETION_RESULT_INVALID")) !== canonicalResult) {
            throw new Error("RUNTIME_COMPLETION_EFFECTS_COMMIT_RESULT_CONFLICT");
          }
          return mapRequest(current);
        }
        if (
          !exactOwner
          || current.apply_phase !== "owner_committed"
        ) throw new Error("RUNTIME_COMPLETION_EFFECTS_COMMIT_OWNER_MISMATCH");
        await assertRuntimeCompletionManifestInTransactionV1(transaction, {
          requestId: current.request_id,
          requireSettledMandatoryEffects: true,
        });
        const rows = await transaction.unsafe<RuntimeCompletionRow[]>(
          `UPDATE runtime_completion_requests
              SET apply_phase = 'effects_committed', effects_committed_at = $3,
                  result = $4::text::jsonb, updated_at = $3
            WHERE request_id = $1 AND owner_instance_id = $2
              AND owner_attempt_count = $5
              AND lease_expires_at > $3
              AND state = 'processing' AND apply_phase = 'owner_committed'
            RETURNING *`,
          [
            current.request_id,
            input.ownerInstanceId,
            wallClock,
            JSON.stringify(input.result),
            ownerAttemptCount,
          ],
        );
        if (rows.length !== 1) throw new Error("RUNTIME_COMPLETION_EFFECTS_COMMIT_CAS_LOST");
        return mapRequest(rows[0]!);
      }) as Promise<RuntimeCompletionRequest>;
    },
    async acceptAndRelease(input: Readonly<{
      requestId: string;
      ownerInstanceId: string;
      ownerAttemptCount: number;
      result: Record<string, unknown>;
      now?: Date;
    }>): Promise<RuntimeCompletionRequest> {
      if (input.now) validTime(input.now);
      return sql.begin(async (transaction) => {
        const chain = await lockRuntimeCompletionChainInTransaction(transaction, input.requestId);
        const request = chain?.request;
        if (!request) throw new Error("RUNTIME_COMPLETION_REQUEST_NOT_FOUND");
        const ownerAttemptCount = z.number().int().positive().parse(input.ownerAttemptCount);
        const canonicalResult = hashCanonicalJson(input.result);
        if (request.state === "accepted") {
          const storedResultHash = hashCanonicalJson(
            objectValue(request.result, "RUNTIME_COMPLETION_RESULT_INVALID"),
          );
          const compoundReplayHash = (
            ["completed", "failed", "cancelled"].includes(chain.runStatus)
            && !Object.prototype.hasOwnProperty.call(input.result, "terminalRunStatus")
          )
            ? hashCanonicalJson({ ...input.result, terminalRunStatus: chain.runStatus })
            : undefined;
          if (storedResultHash === canonicalResult || storedResultHash === compoundReplayHash) {
            await closeCompletionOwnerAfterTerminalMutationV1(transaction, request.request_id);
            return mapRequest(request);
          }
          throw new Error("RUNTIME_COMPLETION_ACCEPT_TERMINAL_CONFLICT");
        }
        const wallClock = await readDatabaseWallClock(
          transaction,
          "RUNTIME_COMPLETION_DATABASE_WALL_CLOCK_UNAVAILABLE",
        );
        if (
          request.state !== "processing"
          || request.owner_instance_id !== input.ownerInstanceId
          || request.owner_attempt_count !== ownerAttemptCount
          || !request.lease_expires_at
          || new Date(request.lease_expires_at).getTime() <= wallClock.getTime()
        ) {
          throw new Error("RUNTIME_COMPLETION_PROCESSING_OWNER_MISMATCH");
        }
        if (chain.claimOutcome === null) throw new Error("RUNTIME_COMPLETION_CLAIM_REMAINED_ACTIVE");
        if (request.apply_phase !== "effects_committed" || request.effects_committed_at === null) {
          throw new Error("RUNTIME_COMPLETION_EFFECTS_NOT_COMMITTED");
        }
        await releaseDrainedRuntimeSessionInTransaction(transaction, {
          sessionId: request.runtime_session_id,
          claimId: claimId(request.claim_id),
          now: wallClock,
        });
        const updated = await transaction.unsafe<RuntimeCompletionRow[]>(
          `UPDATE runtime_completion_requests
              SET state = 'accepted', accepted_at = $3,
                  lease_expires_at = NULL,
                  result = $4::text::jsonb,
                  diagnostic = 'Completion accepted after proven runtime drain',
                  updated_at = $3
            WHERE request_id = $1 AND owner_instance_id = $2 AND state = 'processing'
              AND owner_attempt_count = $5
              AND lease_expires_at > $3
            RETURNING *`,
          [
            request.request_id,
            input.ownerInstanceId,
            wallClock,
            JSON.stringify(input.result),
            ownerAttemptCount,
          ],
        );
        if (updated.length !== 1) throw new Error("RUNTIME_COMPLETION_ACCEPT_CAS_LOST");
        await closeCompletionOwnerAfterTerminalMutationV1(
          transaction,
          updated[0]!.request_id,
        );
        return mapRequest(updated[0]!);
      }) as Promise<RuntimeCompletionRequest>;
    },
    async preemptForRunTermination(input: Readonly<{
      requestId: string;
      diagnostic: string;
      result?: Record<string, unknown>;
      now?: Date;
    }>): Promise<Readonly<{
      status: "preempted" | "resume_effects" | "finalize" | "not_pending" | "not_preemptible";
      request: RuntimeCompletionRequest;
    }>> {
      if (!input.diagnostic.trim()) throw new Error("RUNTIME_COMPLETION_REJECTION_DIAGNOSTIC_REQUIRED");
      if (input.now) validTime(input.now);
      return sql.begin(async (transaction) => {
        const chain = await lockRuntimeCompletionChainInTransaction(transaction, input.requestId);
        const current = chain?.request;
        if (!current) throw new Error("RUNTIME_COMPLETION_REQUEST_NOT_FOUND");
        if (current.state === "rejected") {
          await closeCompletionOwnerIfPresentAfterTerminalMutationV1(
            transaction,
            current.request_id,
          );
          return { status: "preempted" as const, request: mapRequest(current) };
        }
        if (current.state === "processing" && current.apply_phase === "owner_committed") {
          return { status: "resume_effects" as const, request: mapRequest(current) };
        }
        if (current.state === "processing" && current.apply_phase === "effects_committed") {
          return { status: "finalize" as const, request: mapRequest(current) };
        }
        if (!chain.terminationRequestId) {
          return { status: "not_pending" as const, request: mapRequest(current) };
        }
        const preemptible = current.state === "requested"
          || current.state === "draining"
          || (
            current.state === "processing"
            && current.apply_phase === "executing"
            && chain.claimOutcome === null
          );
        if (!preemptible) {
          return { status: "not_preemptible" as const, request: mapRequest(current) };
        }
        const wallClock = await readDatabaseWallClock(
          transaction,
          "RUNTIME_COMPLETION_DATABASE_WALL_CLOCK_UNAVAILABLE",
        );
        const rows = await transaction.unsafe<RuntimeCompletionRow[]>(
          `UPDATE runtime_completion_requests
              SET state = 'rejected', rejected_at = $2,
                  lease_expires_at = NULL, diagnostic = $3,
                  result = (result || $4::text::jsonb), updated_at = $2
            WHERE request_id = $1
              AND state = $5
              AND apply_phase = $6
            RETURNING *`,
          [
            current.request_id,
            wallClock,
            input.diagnostic.slice(0, 4_000),
            JSON.stringify({
              ...(input.result ?? {}),
              preemptedByRunTermination: true,
              terminationRequestId: chain.terminationRequestId,
            }),
            current.state,
            current.apply_phase,
          ],
        );
        if (rows.length !== 1) throw new Error("RUNTIME_COMPLETION_REJECT_CAS_LOST");
        if (current.state === "requested") {
          await closeCompletionOwnerIfPresentAfterTerminalMutationV1(
            transaction,
            rows[0]!.request_id,
          );
        } else {
          await closeCompletionOwnerAfterTerminalMutationV1(
            transaction,
            rows[0]!.request_id,
          );
        }
        return { status: "preempted" as const, request: mapRequest(rows[0]!) };
      }) as Promise<Readonly<{
        status: "preempted" | "resume_effects" | "finalize" | "not_pending" | "not_preemptible";
        request: RuntimeCompletionRequest;
      }>>;
    },
    async quarantine(input: Readonly<{
      requestId: string;
      ownerInstanceId: string;
      expectedState: "draining" | "processing";
      expectedLeaseExpiresAt: string;
      expectedUpdatedAt: string;
      diagnostic: string;
      result?: Record<string, unknown>;
      now?: Date;
    }>): Promise<RuntimeCompletionRequest> {
      if (!input.diagnostic.trim()) throw new Error("RUNTIME_COMPLETION_QUARANTINE_DIAGNOSTIC_REQUIRED");
      if (!input.ownerInstanceId.trim()) throw new Error("RUNTIME_COMPLETION_QUARANTINE_OWNER_REQUIRED");
      if (input.now) validTime(input.now);
      const expectedLeaseExpiresAt = exactTimestamp(
        input.expectedLeaseExpiresAt,
        "RUNTIME_COMPLETION_QUARANTINE_LEASE_INVALID",
      );
      const expectedUpdatedAt = exactTimestamp(
        input.expectedUpdatedAt,
        "RUNTIME_COMPLETION_QUARANTINE_VERSION_INVALID",
      );
      return sql.begin(async (transaction) => {
        const chain = await lockRuntimeCompletionChainInTransaction(transaction, input.requestId);
        const current = chain?.request;
        if (!current) throw new Error("RUNTIME_COMPLETION_REQUEST_NOT_FOUND");
        if (current.state === "quarantined") {
          await closeCompletionOwnerAfterTerminalMutationV1(transaction, current.request_id);
          return mapRequest(current);
        }
        const wallClock = await readDatabaseWallClock(
          transaction,
          "RUNTIME_COMPLETION_DATABASE_WALL_CLOCK_UNAVAILABLE",
        );
        if (
          current.owner_instance_id !== input.ownerInstanceId
          || current.state !== input.expectedState
          || !current.lease_expires_at
          || new Date(current.lease_expires_at).getTime() !== expectedLeaseExpiresAt.getTime()
          || new Date(current.lease_expires_at).getTime() <= wallClock.getTime()
          || new Date(current.updated_at).getTime() !== expectedUpdatedAt.getTime()
        ) throw new Error("RUNTIME_COMPLETION_QUARANTINE_AUTHORITY_LOST");
        if (
          current.state === "processing"
          && current.apply_phase !== "executing"
        ) throw new Error("RUNTIME_COMPLETION_QUARANTINE_CANONICAL_CONTINUATION_REQUIRED");
        const rows = await transaction.unsafe<RuntimeCompletionRow[]>(
          `UPDATE runtime_completion_requests
              SET state = 'quarantined', lease_expires_at = NULL,
                  diagnostic = $2, result = (result || $3::text::jsonb), updated_at = $4
            WHERE request_id = $1
              AND owner_instance_id = $5
              AND state = $6
              AND (state = 'draining' OR apply_phase = 'executing')
              AND lease_expires_at = $7
              AND lease_expires_at > $4
              AND updated_at = $8
            RETURNING *`,
          [
            current.request_id,
            input.diagnostic.slice(0, 4_000),
            JSON.stringify(input.result ?? {}),
            wallClock,
            input.ownerInstanceId,
            input.expectedState,
            expectedLeaseExpiresAt,
            expectedUpdatedAt,
          ],
        );
        if (rows.length !== 1) throw new Error("RUNTIME_COMPLETION_QUARANTINE_AUTHORITY_LOST");
        await closeCompletionOwnerAfterTerminalMutationV1(
          transaction,
          rows[0]!.request_id,
        );
        return mapRequest(rows[0]!);
      }) as Promise<RuntimeCompletionRequest>;
    },
  });
}

function completionBootstrapCleanBuildVerificationV1(
  eligibility: InternalProductionBaselineCompletionOwnerBootstrapEligibilityV1,
  capability: object,
): InternalProductionBaselineCompletionOwnerBootstrapCleanBuildVerificationV1 {
  const body = {
    kind: eligibility.kind,
    bootstrapMergeSha: eligibility.bootstrapMergeSha,
    bootstrapTreeHash: eligibility.bootstrapTreeHash,
    p0FileSetHash: eligibility.p0FileSetHash,
    buildInfoHash: eligibility.buildInfoHash,
    focusedVerificationHash: eligibility.focusedVerificationHash,
    baselineHistoricalReceiptRef: eligibility.baselineHistoricalReceiptRef,
    baselineHistoricalReceiptHash: eligibility.baselineHistoricalReceiptHash,
    bootstrapHandoffMigrationReceiptRef: eligibility.bootstrapHandoffMigrationReceiptRef,
    bootstrapHandoffMigrationReceiptHash: eligibility.bootstrapHandoffMigrationReceiptHash,
    requestIdHash: eligibility.requestIdHash,
    claimIdHash: eligibility.claimIdHash,
    runIdentityHash: eligibility.runIdentityHash,
    ownerGenerationHash: eligibility.ownerGenerationHash,
  };
  const verificationHash = hashCanonicalJson(body);
  return recursivelyFreezeCompletionBootstrapV1({ ...body, verificationHash, capability });
}

async function completionBootstrapReopenEligibilityAuthoritiesV1(
  eligibility: InternalProductionBaselineCompletionOwnerBootstrapEligibilityV1,
): Promise<void> {
  const receipt = await import("../internal-production/baseline-post-handoff-receipt-v1.js") as unknown as Record<string, unknown>;
  const resolveDelivery = receipt.resolveInternalProductionBaselineTask12P0DeliveryAuthorityV1;
  const observeCurrentDelivery = receipt.observeCurrentInternalProductionBaselineTask12P0DeliveryAuthorityV1;
  const resolveHistorical = receipt.resolveInternalProductionCurrentEntryAuthorityV1;
  const resolveMigration = receipt.resolveInternalProductionBaselineBootstrapHandoffMigrationReceiptV1;
  if (typeof resolveDelivery !== "function" || resolveDelivery.length !== 1 || typeof observeCurrentDelivery !== "function" || observeCurrentDelivery.length !== 0 || typeof resolveHistorical !== "function" || resolveHistorical.length !== 1 || typeof resolveMigration !== "function" || resolveMigration.length !== 1) completionBootstrapFailV1("clean-build authority resolver unavailable");
  const delivery = await (resolveDelivery as (input: unknown) => Promise<Record<string, unknown>>)({ deliveryAuthorityRef: eligibility.deliveryAuthorityRef, deliveryAuthorityHash: eligibility.deliveryAuthorityHash });
  const currentDelivery = await (observeCurrentDelivery as () => Promise<Record<string, unknown>>)();
  await (resolveHistorical as (input: unknown) => Promise<unknown>)({ entryAuthorityRef: eligibility.baselineHistoricalReceiptRef, entryAuthorityHash: eligibility.baselineHistoricalReceiptHash });
  await (resolveMigration as (input: unknown) => Promise<unknown>)({ migrationReceiptRef: eligibility.bootstrapHandoffMigrationReceiptRef, migrationReceiptHash: eligibility.bootstrapHandoffMigrationReceiptHash });
  if (delivery.deliveryCommitSha !== eligibility.bootstrapMergeSha || delivery.deliveryTreeHash !== eligibility.bootstrapTreeHash || delivery.exact24PathBlobSetHash !== eligibility.p0FileSetHash || delivery.currentSourceBuildHash !== eligibility.buildInfoHash || delivery.focusedVerificationHash !== eligibility.focusedVerificationHash) completionBootstrapFailV1("clean-build delivery relation crossed");
  if (currentDelivery.deliveryCommitSha !== eligibility.bootstrapMergeSha || currentDelivery.deliveryTreeHash !== eligibility.bootstrapTreeHash || currentDelivery.exact24PathBlobSetHash !== eligibility.p0FileSetHash || currentDelivery.focusedVerificationHash !== eligibility.focusedVerificationHash || currentDelivery.deliveryAncestorOfCurrentSource !== true) completionBootstrapFailV1("clean-build current delivery relation crossed");
}

export async function createInternalProductionBaselineCompletionOwnerBootstrapCleanBuildVerificationV1(
): Promise<InternalProductionBaselineCompletionOwnerBootstrapCleanBuildVerificationV1 | null> {
  const capability = currentRuntimeCompletionOwnerCapability();
  if (!capability) completionBootstrapFailV1("OWNER_CONTEXT_REQUIRED");
  const receipt = await import("../internal-production/baseline-post-handoff-receipt-v1.js") as unknown as Record<string, unknown>;
  const observeDelivery = receipt.observeCurrentInternalProductionBaselineTask12P0DeliveryAuthorityV1;
  const observeCurrentEntry = receipt.observeInternalProductionCurrentEntryAuthorityStatusV1;
  const resolveHistorical = receipt.resolveInternalProductionCurrentEntryAuthorityV1;
  const resolveMigration = receipt.resolveInternalProductionBaselineBootstrapHandoffMigrationReceiptV1;
  if (typeof observeDelivery !== "function" || observeDelivery.length !== 0 || typeof observeCurrentEntry !== "function" || observeCurrentEntry.length !== 0 || typeof resolveHistorical !== "function" || resolveHistorical.length !== 1 || typeof resolveMigration !== "function" || resolveMigration.length !== 1) completionBootstrapFailV1("clean-build authority port unavailable");
  const delivery = await (observeDelivery as () => Promise<Record<string, unknown>>)();
  const currentEntry = await (observeCurrentEntry as () => Promise<Record<string, unknown>>)();
  if (currentEntry.state !== "ready" || !currentEntry.entryAuthority || typeof currentEntry.entryAuthority !== "object" || !currentEntry.migrationApplyingPhase || typeof currentEntry.migrationApplyingPhase !== "object") completionBootstrapFailV1("clean-build current entry is not ready");
  const historical = currentEntry.entryAuthority as Record<string, unknown>;
  const migrationPhase = currentEntry.migrationApplyingPhase as Record<string, unknown>;
  const migration = migrationPhase.migrationReceipt as Record<string, unknown> | undefined;
  if (typeof historical.entryAuthorityRef !== "string" || typeof historical.entryAuthorityHash !== "string" || typeof migration?.migrationReceiptRef !== "string" || typeof migration.migrationReceiptHash !== "string") completionBootstrapFailV1("clean-build historical authority is incomplete");
  await (resolveHistorical as (input: unknown) => Promise<unknown>)({ entryAuthorityRef: historical.entryAuthorityRef, entryAuthorityHash: historical.entryAuthorityHash });
  await (resolveMigration as (input: unknown) => Promise<unknown>)({ migrationReceiptRef: migration.migrationReceiptRef, migrationReceiptHash: migration.migrationReceiptHash });
  const row = await pgBegin(async (transaction) => {
    const rows = await transaction.unsafe<Array<Pick<RuntimeCompletionRow, "request_id" | "claim_id" | "run_id" | "state" | "apply_phase" | "owner_instance_id" | "owner_attempt_count" | "lease_expires_at">>>(
      "SELECT request_id,claim_id,run_id,state,apply_phase,owner_instance_id,owner_attempt_count,lease_expires_at FROM runtime_completion_requests WHERE request_id=$1 FOR UPDATE",
      [capability.requestId],
    );
    const current = rows[0];
    const wallClock = await readDatabaseWallClock(transaction, "INTERNAL_PRODUCTION_COMPLETION_BOOTSTRAP_CLOCK_UNAVAILABLE");
    if (!current || rows.length !== 1 || current.state !== "processing" || current.apply_phase !== "effects_committed" || current.owner_instance_id !== capability.ownerInstanceId || current.owner_attempt_count !== capability.ownerAttemptCount || current.lease_expires_at === null || new Date(current.lease_expires_at).getTime() <= wallClock.getTime()) completionBootstrapFailV1("clean-build owner context stale");
    return current;
  });
  const body = {
    schema: "setfarm.internal-production-baseline-completion-owner-bootstrap-eligibility.v1" as const,
    kind: "authenticated-baseline-completion-owner-bootstrap-clean-build-verification" as const,
    deliveryAuthorityRef: String(delivery.deliveryAuthorityRef),
    deliveryAuthorityHash: String(delivery.deliveryAuthorityHash),
    bootstrapMergeSha: String(delivery.deliveryCommitSha),
    bootstrapTreeHash: String(delivery.deliveryTreeHash),
    p0FileSetHash: String(delivery.exact24PathBlobSetHash),
    buildInfoHash: String(delivery.currentSourceBuildHash),
    focusedVerificationHash: String(delivery.focusedVerificationHash),
    baselineHistoricalReceiptRef: historical.entryAuthorityRef,
    baselineHistoricalReceiptHash: historical.entryAuthorityHash,
    bootstrapHandoffMigrationReceiptRef: migration.migrationReceiptRef,
    bootstrapHandoffMigrationReceiptHash: migration.migrationReceiptHash,
    requestIdHash: hashCanonicalJson({ schema: "setfarm.internal-production-runtime-completion-request-id.v1", requestId: row.request_id }),
    claimIdHash: hashCanonicalJson({ schema: "setfarm.internal-production-runtime-completion-claim-id.v1", claimId: String(row.claim_id) }),
    runIdentityHash: hashCanonicalJson({ schema: "setfarm.internal-production-runtime-completion-run-identity.v1", runId: row.run_id }),
    ownerGenerationHash: hashCanonicalJson({ schema: "setfarm.internal-production-runtime-completion-owner-generation.v1", ownerInstanceId: capability.ownerInstanceId, ownerAttemptCount: capability.ownerAttemptCount }),
  };
  const eligibilityHash = hashCanonicalJson(body);
  const eligibilityRef = `${COMPLETION_BOOTSTRAP_ELIGIBILITY_PREFIX_V1}${eligibilityHash}`;
  const eligibility = recursivelyFreezeCompletionBootstrapV1({ ...body, eligibilityRef, eligibilityHash });
  completionBootstrapWriteNoReplaceV1(completionBootstrapEligibilityPathV1(eligibilityHash), eligibility);
  const pair = Object.freeze({ eligibilityRef, eligibilityHash });
  try { completionBootstrapWriteNoReplaceV1(completionBootstrapSelectedEligibilityPathV1(), pair); } catch (error) {
    if (!(error instanceof Error) || !/collision/i.test(error.message)) throw error;
  }
  const selected = completionBootstrapReadSelectedEligibilityV1();
  const winner = completionBootstrapReadEligibilityV1(selected);
  await completionBootstrapReopenEligibilityAuthoritiesV1(winner);
  if (selected.eligibilityRef !== eligibilityRef || selected.eligibilityHash !== eligibilityHash) return null;
  const capabilityToken = Object.freeze({});
  const verification = completionBootstrapCleanBuildVerificationV1(winner, capabilityToken);
  completionBootstrapCleanBuildCapabilitiesV1.set(verification, { requestId: capability.requestId, ownerInstanceId: capability.ownerInstanceId, ownerAttemptCount: capability.ownerAttemptCount, eligibilityRef, eligibilityHash });
  return verification;
}

function completionBootstrapValidateAnyStoredResultV1(value: unknown): Record<string, unknown> {
  const keys = ["schema", "state", "targetGuardReceiptRef", "targetGuardReceiptHash", "operationRef", "operationHash", "targetGuardConsumptionRef", "targetGuardConsumptionHash", "recoveredOwnerGenerationHash", "targetOwnerReleaseReceiptHash", "sequenceRef", "sequenceHash"] as const;
  if (!value || typeof value !== "object" || Array.isArray(value) || !completionBootstrapHasExactStoredKeysV1(value as Record<string, unknown>, keys)) completionBootstrapFailV1("bootstrap result shape");
  const result = value as Record<string, unknown>;
  const state = String(result.state);
  const sha = (member: unknown): member is string => typeof member === "string" && SHA256_V1.test(member);
  const pair = (ref: unknown, hash: unknown, prefix: string): boolean => sha(hash) && ref === `${prefix}${hash}`;
  const operationPresent = pair(result.operationRef, result.operationHash, "setfarm://internal-production/baseline-spawner-bootstrap-restart-operation/sha256/");
  const consumptionPresent = pair(result.targetGuardConsumptionRef, result.targetGuardConsumptionHash, "setfarm://internal-production/baseline-completion-owner-bootstrap-target-guard-consumption/sha256/");
  const recoveredPresent = sha(result.recoveredOwnerGenerationHash);
  const releasePresent = sha(result.targetOwnerReleaseReceiptHash);
  const sequencePresent = pair(result.sequenceRef, result.sequenceHash, "setfarm://internal-production/baseline-spawner-bootstrap-restart-sequence/sha256/");
  if (
    result.schema !== "setfarm.internal-production-baseline-spawner-bootstrap-completion-result.v1"
    || !["guard_prepared", "operation_bound", "guard_consumed", "owner_recovered", "owner_released", "completed"].includes(state)
    || !pair(result.targetGuardReceiptRef, result.targetGuardReceiptHash, "setfarm://internal-production/baseline-completion-owner-bootstrap-target-guard-receipt/sha256/")
    || (state === "guard_prepared" && (result.operationRef !== null || result.operationHash !== null || result.targetGuardConsumptionRef !== null || result.targetGuardConsumptionHash !== null || result.recoveredOwnerGenerationHash !== null || result.targetOwnerReleaseReceiptHash !== null || result.sequenceRef !== null || result.sequenceHash !== null))
    || (state === "operation_bound" && (!operationPresent || result.targetGuardConsumptionRef !== null || result.targetGuardConsumptionHash !== null || result.recoveredOwnerGenerationHash !== null || result.targetOwnerReleaseReceiptHash !== null || result.sequenceRef !== null || result.sequenceHash !== null))
    || (state === "guard_consumed" && (!operationPresent || !consumptionPresent || result.recoveredOwnerGenerationHash !== null || result.targetOwnerReleaseReceiptHash !== null || result.sequenceRef !== null || result.sequenceHash !== null))
    || (state === "owner_recovered" && (!operationPresent || !consumptionPresent || !recoveredPresent || result.targetOwnerReleaseReceiptHash !== null || result.sequenceRef !== null || result.sequenceHash !== null))
    || (state === "owner_released" && (!operationPresent || !consumptionPresent || !recoveredPresent || !releasePresent || result.sequenceRef !== null || result.sequenceHash !== null))
    || (state === "completed" && (!operationPresent || !consumptionPresent || !recoveredPresent || !releasePresent || !sequencePresent))
  ) completionBootstrapFailV1("bootstrap result authority");
  return Object.fromEntries(keys.map((key) => [key, result[key]]));
}

async function completionBootstrapBindOperationForOwnerV1(
  capability: Readonly<{ requestId: string; ownerInstanceId: string; ownerAttemptCount: number }>,
  guard: InternalProductionBaselineCompletionOwnerBootstrapTargetGuardV1,
  operation: Readonly<{ operationRef: string; operationHash: string }>,
): Promise<void> {
  const selectedRecovery = completionBootstrapSelectedRecoveryContextV1.getStore();
  if (selectedRecovery && (selectedRecovery.requestId !== capability.requestId || selectedRecovery.ownerInstanceId !== capability.ownerInstanceId || selectedRecovery.ownerAttemptCount !== capability.ownerAttemptCount)) completionBootstrapFailV1("selected recovery bind authority crossed");
  await pgBegin(async (transaction) => {
    const rows = await transaction.unsafe<Array<Pick<RuntimeCompletionRow, "request_id" | "claim_id" | "run_id" | "runtime_session_id" | "state" | "apply_phase" | "owner_instance_id" | "owner_attempt_count" | "lease_expires_at" | "drained_at" | "result">>>("SELECT request_id,claim_id,run_id,runtime_session_id,state,apply_phase,owner_instance_id,owner_attempt_count,lease_expires_at,drained_at,result FROM runtime_completion_requests WHERE request_id=$1 FOR UPDATE", [capability.requestId]);
    const row = rows[0];
    if (selectedRecovery) {
      const wallClock = await readDatabaseWallClock(transaction, "INTERNAL_PRODUCTION_COMPLETION_BOOTSTRAP_CLOCK_UNAVAILABLE");
      const sessions = row ? await transaction.unsafe<Array<{ state: string }>>("SELECT state FROM runtime_sessions WHERE session_id=$1 FOR UPDATE", [row.runtime_session_id]) : [];
      if (!row || row.state !== "processing" || row.apply_phase !== "effects_committed" || row.drained_at === null || row.lease_expires_at === null || timestamp(row.lease_expires_at) !== selectedRecovery.leaseExpiresAt || new Date(row.lease_expires_at).getTime() > wallClock.getTime() || sessions.length !== 1 || sessions[0]!.state !== "drained") completionBootstrapFailV1("selected recovery consumption authority crossed");
      const receipt = await resolveInternalProductionBaselineCompletionOwnerBootstrapTargetGuardReceiptV1({ targetGuardReceiptRef: guard.targetGuardReceiptRef, targetGuardReceiptHash: guard.targetGuardReceiptHash });
      completionBootstrapRequireSelectedEligibilityMatchesReceiptAndRowV1(row as RuntimeCompletionRow, receipt);
    }
    const result = row?.result && typeof row.result === "object" && !Array.isArray(row.result) ? row.result as Record<string, unknown> : {};
    const priorValue = result.internalProductionBaselineSpawnerBootstrap;
    const prior = priorValue === undefined ? undefined : completionBootstrapValidateAnyStoredResultV1(priorValue);
    if (!row || row.owner_instance_id !== capability.ownerInstanceId || row.owner_attempt_count !== capability.ownerAttemptCount || !prior || prior.targetGuardReceiptRef !== guard.targetGuardReceiptRef || prior.targetGuardReceiptHash !== guard.targetGuardReceiptHash) completionBootstrapFailV1("clean-build operation guard binding");
    if (prior.state === "operation_bound") {
      if (prior.operationRef !== operation.operationRef || prior.operationHash !== operation.operationHash) completionBootstrapFailV1("clean-build operation binding crossed");
      return;
    }
    if (prior.state !== "guard_prepared" || prior.operationRef !== null || prior.operationHash !== null) completionBootstrapFailV1("clean-build operation predecessor");
    const next = { ...prior, state: "operation_bound", operationRef: operation.operationRef, operationHash: operation.operationHash };
    const updated = await transaction.unsafe<Array<{ result: unknown }>>("UPDATE runtime_completion_requests SET result=jsonb_set(COALESCE(result,'{}'::jsonb),'{internalProductionBaselineSpawnerBootstrap}',$2::jsonb,true),updated_at=clock_timestamp() WHERE request_id=$1 AND owner_instance_id=$3 AND owner_attempt_count=$4 RETURNING result", [capability.requestId, JSON.stringify(next), capability.ownerInstanceId, capability.ownerAttemptCount]);
    if (updated.length !== 1) completionBootstrapFailV1("clean-build operation bind CAS lost");
    const updatedOuter = updated[0]!.result as Record<string, unknown>;
    const reopened = completionBootstrapValidateAnyStoredResultV1(updatedOuter.internalProductionBaselineSpawnerBootstrap);
    if (hashCanonicalJson(reopened) !== hashCanonicalJson(next)) completionBootstrapFailV1("clean-build operation bind successor invalid");
  });
}

async function completionBootstrapCurrentSelectedPhaseForOwnerV1(
  capability: Readonly<{ requestId: string; ownerInstanceId: string; ownerAttemptCount: number }>,
  allowExpiredSelectedOwner: boolean,
  expectedExpiredLeaseExpiresAt?: string,
): Promise<Record<string, unknown> | null> {
  return pgBegin(async (transaction) => {
    const rows = await transaction.unsafe<Array<Pick<RuntimeCompletionRow, "state" | "apply_phase" | "owner_instance_id" | "owner_attempt_count" | "lease_expires_at" | "result">>>("SELECT state,apply_phase,owner_instance_id,owner_attempt_count,lease_expires_at,result FROM runtime_completion_requests WHERE request_id=$1 FOR UPDATE", [capability.requestId]);
    const row = rows[0];
    const wallClock = await readDatabaseWallClock(transaction, "INTERNAL_PRODUCTION_COMPLETION_BOOTSTRAP_CLOCK_UNAVAILABLE");
    if (!row || rows.length !== 1 || row.state !== "processing" || row.apply_phase !== "effects_committed" || row.owner_instance_id !== capability.ownerInstanceId || row.owner_attempt_count !== capability.ownerAttemptCount || row.lease_expires_at === null || (!allowExpiredSelectedOwner && new Date(row.lease_expires_at).getTime() <= wallClock.getTime()) || (allowExpiredSelectedOwner && (new Date(row.lease_expires_at).getTime() > wallClock.getTime() || timestamp(row.lease_expires_at) !== expectedExpiredLeaseExpiresAt))) completionBootstrapFailV1("clean-build selected phase owner crossed");
    const result = row.result && typeof row.result === "object" && !Array.isArray(row.result) ? row.result as Record<string, unknown> : {};
    const phase = result.internalProductionBaselineSpawnerBootstrap;
    if (phase === undefined) return null;
    return Object.freeze(completionBootstrapValidateAnyStoredResultV1(phase));
  });
}

export async function continueInternalProductionBaselineCompletionOwnerBootstrapAfterCleanBuildV1(
  input: Readonly<{ verification: InternalProductionBaselineCompletionOwnerBootstrapCleanBuildVerificationV1 }>,
): Promise<void> {
  if (!input || typeof input !== "object" || Array.isArray(input) || Object.getPrototypeOf(input) !== Object.prototype || Reflect.ownKeys(input).some((key) => typeof key !== "string") || Object.keys(input).join(",") !== "verification") completionBootstrapFailV1("VERIFICATION_INPUT_INVALID");
  const state = completionBootstrapCleanBuildCapabilitiesV1.get(input.verification);
  const capability = currentRuntimeCompletionOwnerCapability();
  if (!state || !capability || state.requestId !== capability.requestId || state.ownerInstanceId !== capability.ownerInstanceId || state.ownerAttemptCount !== capability.ownerAttemptCount) completionBootstrapFailV1("VERIFICATION_CAPABILITY_INVALID");
  const selected = completionBootstrapReadSelectedEligibilityV1();
  if (selected.eligibilityRef !== state.eligibilityRef || selected.eligibilityHash !== state.eligibilityHash) completionBootstrapFailV1("VERIFICATION_SELECTION_CROSSED");
  const eligibility = completionBootstrapReadEligibilityV1(selected);
  await completionBootstrapReopenEligibilityAuthoritiesV1(eligibility);
  if (!input.verification.capability || typeof input.verification.capability !== "object") completionBootstrapFailV1("VERIFICATION_CAPABILITY_INVALID");
  const expected = completionBootstrapCleanBuildVerificationV1(eligibility, input.verification.capability);
  if (hashCanonicalJson({ ...input.verification, capability: null }) !== hashCanonicalJson({ ...expected, capability: null })) completionBootstrapFailV1("VERIFICATION_BODY_CROSSED");
  const currentPhase = await completionBootstrapCurrentSelectedPhaseForOwnerV1(capability, false);
  if (currentPhase && ["operation_bound", "guard_consumed", "owner_recovered"].includes(String(currentPhase.state))) {
    const operation = completionBootstrapOperationPairV1({ operationRef: currentPhase.operationRef, operationHash: currentPhase.operationHash });
    const sequence = await import("../internal-production/baseline-service-restart-sequence-v1.js") as unknown as Record<string, unknown>;
    const execute = sequence.executeOrRecoverInternalProductionBaselineSpawnerBootstrapRestartV1;
    if (typeof execute !== "function" || execute.length !== 1) completionBootstrapFailV1("clean-build sequence execute port unavailable");
    await (execute as (input: unknown) => Promise<unknown>)(operation);
    return;
  }
  if (currentPhase !== null && currentPhase.state !== "guard_prepared") completionBootstrapFailV1("clean-build selected phase unsupported");
  const guard = await prepareInternalProductionBaselineCompletionOwnerBootstrapTargetGuardV1();
  const retirement = await import("../internal-production/baseline-restart-authority-retirement-v1.js") as unknown as Record<string, unknown>;
  const acquire = retirement.acquireInternalProductionPhysicalServiceRestartAuthorityTransitionLeaseV1;
  const release = retirement.releaseInternalProductionPhysicalServiceRestartAuthorityTransitionLeaseV1;
  if (typeof acquire !== "function" || acquire.length !== 0 || typeof release !== "function" || release.length !== 1) completionBootstrapFailV1("clean-build transition lease port unavailable");
  const lease = await (acquire as () => Promise<unknown>)();
  let released = false;
  let operation: Readonly<{ operationRef: string; operationHash: string }> | null = null;
  try {
    const sequence = await import("../internal-production/baseline-service-restart-sequence-v1.js") as unknown as Record<string, unknown>;
    const prepare = sequence.prepareInternalProductionBaselineSpawnerBootstrapRestartV1;
    if (typeof prepare !== "function" || prepare.length !== 1) completionBootstrapFailV1("clean-build sequence prepare port unavailable");
    operation = await (prepare as (input: unknown) => Promise<Readonly<{ operationRef: string; operationHash: string }>>)({ targetGuard: guard, postSettlementContinuationKind: "setfarm-bootstrap-main-claim-allocation-v1" });
    await completionBootstrapBindOperationForOwnerV1(capability, guard, operation);
  } finally {
    await (release as (lease: unknown) => Promise<void>)(lease);
    released = true;
  }
  if (!released || operation === null) completionBootstrapFailV1("clean-build transition lease release failed");
  const sequence = await import("../internal-production/baseline-service-restart-sequence-v1.js") as unknown as Record<string, unknown>;
  const execute = sequence.executeOrRecoverInternalProductionBaselineSpawnerBootstrapRestartV1;
  if (typeof execute !== "function" || execute.length !== 1) completionBootstrapFailV1("clean-build sequence execute port unavailable");
  await (execute as (input: unknown) => Promise<unknown>)(operation);
}

async function completionBootstrapPreflightSelectedRecoveryUnderLeaseV1(
  candidate: CompletionBootstrapSelectedRecoveryCandidateV1,
): Promise<Record<string, unknown> | null> {
  return pgBegin(async (transaction) => {
    const headProof = await lockInternalProductionBaselineCompletionOwnerBootstrapTargetInTransactionV1(transaction as PgTransactionSql, { requestId: candidate.requestId });
    const rows = await transaction.unsafe<RuntimeCompletionRow[]>("SELECT * FROM runtime_completion_requests WHERE request_id=$1 FOR UPDATE", [candidate.requestId]);
    const row = rows[0];
    const sessions = row ? await transaction.unsafe<Array<{ state: string }>>("SELECT state FROM runtime_sessions WHERE session_id=$1 FOR UPDATE", [row.runtime_session_id]) : [];
    const wallClock = await readDatabaseWallClock(transaction, "INTERNAL_PRODUCTION_COMPLETION_BOOTSTRAP_CLOCK_UNAVAILABLE");
    if (!row || rows.length !== 1 || row.state !== "processing" || row.apply_phase !== "effects_committed" || row.drained_at === null || row.owner_instance_id !== candidate.ownerInstanceId || row.owner_attempt_count !== candidate.ownerAttemptCount || row.lease_expires_at === null || timestamp(row.lease_expires_at) !== candidate.leaseExpiresAt || new Date(row.lease_expires_at).getTime() > wallClock.getTime() || sessions.length !== 1 || sessions[0]!.state !== "drained") completionBootstrapFailV1("selected bootstrap recovery preflight crossed");
    const ownerRows = await transaction.unsafe<Array<{ reservation_ref: string; reservation_hash: string }>>("SELECT reservation_ref,reservation_hash FROM internal_production_owner_reservations_v1 WHERE category='completion-owner' AND owner_key=$1 AND state='bound'", [row.request_id]);
    if (ownerRows.length !== 1 || ownerRows[0]!.reservation_ref !== headProof.targetOwnerReservationRef || ownerRows[0]!.reservation_hash !== headProof.targetOwnerReservationHash) completionBootstrapFailV1("selected bootstrap recovery target crossed");
    const outer = row.result && typeof row.result === "object" && !Array.isArray(row.result) ? row.result as Record<string, unknown> : {};
    const rawPhase = outer.internalProductionBaselineSpawnerBootstrap;
    if (rawPhase === undefined) {
      const eligibility = completionBootstrapReadEligibilityV1(completionBootstrapReadSelectedEligibilityV1());
      if (!completionBootstrapSelectedEligibilityMatchesRowV1(row) || eligibility.ownerGenerationHash !== hashCanonicalJson({ schema: "setfarm.internal-production-runtime-completion-owner-generation.v1", ownerInstanceId: row.owner_instance_id, ownerAttemptCount: row.owner_attempt_count })) completionBootstrapFailV1("selected bootstrap recovery eligibility crossed");
      return null;
    }
    const phase = completionBootstrapValidateAnyStoredResultV1(rawPhase);
    const receipt = await resolveInternalProductionBaselineCompletionOwnerBootstrapTargetGuardReceiptV1({ targetGuardReceiptRef: String(phase.targetGuardReceiptRef), targetGuardReceiptHash: String(phase.targetGuardReceiptHash) });
    completionBootstrapRequireSelectedEligibilityMatchesReceiptAndRowV1(row, receipt);
    return Object.freeze(phase);
  });
}

export async function recoverSelectedInternalProductionBaselineCompletionOwnerBootstrapV1(): Promise<void> {
  const token = completionBootstrapPendingSelectedRecoveryTokenV1;
  completionBootstrapPendingSelectedRecoveryTokenV1 = null;
  if (!token) completionBootstrapFailV1("selected bootstrap recovery candidate token absent");
  const candidate = completionBootstrapSelectedRecoveryCandidatesV1.get(token);
  completionBootstrapSelectedRecoveryCandidatesV1.delete(token);
  if (!candidate) completionBootstrapFailV1("selected bootstrap recovery candidate token invalid");
  const selected = completionBootstrapReadSelectedEligibilityV1();
  const eligibility = completionBootstrapReadEligibilityV1(selected);
  await completionBootstrapReopenEligibilityAuthoritiesV1(eligibility);
  const retirement = await import("../internal-production/baseline-restart-authority-retirement-v1.js") as unknown as Record<string, unknown>;
  const acquire = retirement.acquireInternalProductionPhysicalServiceRestartAuthorityTransitionLeaseV1;
  const release = retirement.releaseInternalProductionPhysicalServiceRestartAuthorityTransitionLeaseV1;
  if (typeof acquire !== "function" || acquire.length !== 0 || typeof release !== "function" || release.length !== 1) completionBootstrapFailV1("selected bootstrap recovery transition lease unavailable");
  const lease = await (acquire as () => Promise<unknown>)();
  let operation: Readonly<{ operationRef: string; operationHash: string }> | null = null;
  try {
    const recoveryOwner = Object.freeze({ requestId: candidate.requestId, ownerInstanceId: candidate.ownerInstanceId, ownerAttemptCount: candidate.ownerAttemptCount });
    await completionBootstrapReopenEligibilityAuthoritiesV1(eligibility);
    await completionBootstrapSelectedRecoveryContextV1.run(candidate, async () => {
      const phase = await completionBootstrapPreflightSelectedRecoveryUnderLeaseV1(candidate);
      if (phase && ["operation_bound", "guard_consumed", "owner_recovered"].includes(String(phase.state))) {
        operation = completionBootstrapOperationPairV1({ operationRef: phase.operationRef, operationHash: phase.operationHash });
      } else {
        if (phase !== null && phase.state !== "guard_prepared") completionBootstrapFailV1("selected bootstrap recovery phase unsupported");
        let guard: InternalProductionBaselineCompletionOwnerBootstrapTargetGuardV1;
        if (phase === null) {
          guard = await prepareInternalProductionBaselineCompletionOwnerBootstrapTargetGuardCoreV1(recoveryOwner, true);
        } else {
          const receipt = await resolveInternalProductionBaselineCompletionOwnerBootstrapTargetGuardReceiptV1({ targetGuardReceiptRef: String(phase.targetGuardReceiptRef), targetGuardReceiptHash: String(phase.targetGuardReceiptHash) });
          guard = recursivelyFreezeCompletionBootstrapV1({ kind: receipt.kind, requestIdHash: receipt.requestIdHash, claimIdHash: receipt.claimIdHash, runIdentityHash: receipt.runIdentityHash, ownerGenerationHash: receipt.ownerGenerationHash, ownerFenced: true as const, ownerDrained: true as const, unrelatedOwnerCount: 0 as const, unrelatedOwnerCensusHash: receipt.unrelatedOwnerCensusHash, targetGuardReceiptRef: receipt.targetGuardReceiptRef, targetGuardReceiptHash: receipt.targetGuardReceiptHash, targetGuardHash: receipt.targetGuardHash });
        }
        const sequence = await import("../internal-production/baseline-service-restart-sequence-v1.js") as unknown as Record<string, unknown>;
        const prepare = sequence.prepareInternalProductionBaselineSpawnerBootstrapRestartFromDurableTargetGuardReceiptForRecoveryV1;
        if (typeof prepare !== "function" || prepare.length !== 1) completionBootstrapFailV1("selected bootstrap recovery prepare port unavailable");
        operation = await (prepare as (input: unknown) => Promise<Readonly<{ operationRef: string; operationHash: string }>>)({ targetGuardReceiptRef: guard.targetGuardReceiptRef, targetGuardReceiptHash: guard.targetGuardReceiptHash });
        await completionBootstrapBindOperationForOwnerV1(recoveryOwner, guard, operation);
      }
    });
  } finally { await (release as (lease: unknown) => Promise<void>)(lease); }
  if (!operation) completionBootstrapFailV1("selected bootstrap recovery operation absent");
  const sequence = await import("../internal-production/baseline-service-restart-sequence-v1.js") as unknown as Record<string, unknown>;
  const execute = sequence.executeOrRecoverInternalProductionBaselineSpawnerBootstrapRestartV1;
  if (typeof execute !== "function" || execute.length !== 1) completionBootstrapFailV1("selected bootstrap recovery execute port unavailable");
  await completionBootstrapSelectedRecoveryContextV1.run(candidate, () => (
    (execute as (input: unknown) => Promise<unknown>)(operation)
  ));
}

export async function resolveInternalProductionBaselineCompletionOwnerBootstrapTargetGuardReceiptV1(
  pair: Readonly<{ targetGuardReceiptRef: string; targetGuardReceiptHash: string }>,
): Promise<InternalProductionBaselineCompletionOwnerBootstrapTargetGuardReceiptV1> {
  const exact = completionBootstrapPairV1(
    pair,
    "targetGuardReceiptRef",
    "targetGuardReceiptHash",
    "setfarm://internal-production/baseline-completion-owner-bootstrap-target-guard-receipt/sha256/",
  );
  const value = completionBootstrapReadV1(completionBootstrapReceiptPathV1(exact.targetGuardReceiptHash!));
  if (!value || typeof value !== "object" || Array.isArray(value)) completionBootstrapFailV1("receipt shape");
  const receipt = value as Record<string, unknown>;
  const keys = ["schema", "kind", "requestIdHash", "claimIdHash", "runIdentityHash", "ownerGenerationHash", "ownerFenced", "ownerDrained", "unrelatedOwnerCount", "unrelatedOwnerCensusHash", "targetGuardHash", "targetGuardReceiptRef", "targetGuardReceiptHash"];
  if (!completionBootstrapHasExactStoredKeysV1(receipt, keys)) completionBootstrapFailV1("receipt keys");
  const body = Object.fromEntries(keys.slice(0, -2).map((key) => [key, receipt[key]]));
  const receiptHash = hashCanonicalJson(body);
  const targetGuardHash = hashCanonicalJson(Object.fromEntries(keys.slice(1, 10).map((key) => [key, receipt[key]])));
  if (
    receipt.schema !== "setfarm.internal-production-baseline-completion-owner-bootstrap-target-guard-receipt.v1"
    || receipt.kind !== "authenticated-completion-owner-bootstrap-target"
    || receipt.ownerFenced !== true
    || receipt.ownerDrained !== true
    || receipt.unrelatedOwnerCount !== 0
    || receipt.targetGuardHash !== targetGuardHash
    || receipt.targetGuardReceiptHash !== receiptHash
    || receipt.targetGuardReceiptRef !== exact.targetGuardReceiptRef
    || receipt.targetGuardReceiptHash !== exact.targetGuardReceiptHash
  ) completionBootstrapFailV1("receipt authority");
  for (const key of ["requestIdHash", "claimIdHash", "runIdentityHash", "ownerGenerationHash", "unrelatedOwnerCensusHash", "targetGuardHash", "targetGuardReceiptHash"]) {
    if (typeof receipt[key] !== "string" || !SHA256_V1.test(receipt[key] as string)) completionBootstrapFailV1(`receipt ${key}`);
  }
  return recursivelyFreezeCompletionBootstrapV1(receipt) as InternalProductionBaselineCompletionOwnerBootstrapTargetGuardReceiptV1;
}

async function prepareInternalProductionBaselineCompletionOwnerBootstrapTargetGuardCoreV1(
  capability: Readonly<{ requestId: string; ownerInstanceId: string; ownerAttemptCount: number }>,
  allowExpiredSelectedOwner: boolean,
): Promise<InternalProductionBaselineCompletionOwnerBootstrapTargetGuardV1> {
  const receipt = await pgBegin(async (transaction) => {
    const headProof = await lockInternalProductionBaselineCompletionOwnerBootstrapTargetInTransactionV1(transaction as PgTransactionSql, { requestId: capability.requestId });
    const rows = await transaction.unsafe<Array<Pick<RuntimeCompletionRow, "request_id" | "claim_id" | "run_id" | "runtime_session_id" | "state" | "apply_phase" | "owner_instance_id" | "owner_attempt_count" | "drained_at" | "lease_expires_at" | "result">>>(
      "SELECT request_id,claim_id,run_id,runtime_session_id,state,apply_phase,owner_instance_id,owner_attempt_count,drained_at,lease_expires_at,result FROM runtime_completion_requests WHERE request_id=$1 FOR UPDATE",
      [capability.requestId],
    );
    const row = rows[0];
    const wallClock = await readDatabaseWallClock(transaction, "INTERNAL_PRODUCTION_COMPLETION_BOOTSTRAP_CLOCK_UNAVAILABLE");
    if (!row || rows.length !== 1 || row.state !== "processing" || row.apply_phase !== "effects_committed" || row.owner_instance_id !== capability.ownerInstanceId || row.owner_attempt_count !== capability.ownerAttemptCount || row.drained_at === null || row.lease_expires_at === null || (!allowExpiredSelectedOwner && new Date(row.lease_expires_at).getTime() <= wallClock.getTime())) completionBootstrapFailV1("OWNER_CONTEXT_STALE_OR_NOT_DRAINED");
    const sessions = await transaction.unsafe<Array<{ state: string }>>("SELECT state FROM runtime_sessions WHERE session_id=$1 AND state='drained' FOR UPDATE", [row.runtime_session_id]);
    if (sessions.length !== 1 || sessions[0]?.state !== "drained") completionBootstrapFailV1("OWNER_SESSION_NOT_DRAINED");
    const openOwnerRows = await transaction.unsafe<Array<{
      reservation_ref: string;
      reservation_hash: string;
      category: string;
      owner_key: string;
      owner_key_hash: string;
      producer_implementation_id: string;
      state: string;
      reservation_owner_key: string | null;
      reservation_owner_key_hash: string | null;
      identity_owner_key: string | null;
      identity_owner_hash: string | null;
    }>>(
      `SELECT reservation_ref,reservation_hash,category,owner_key,owner_key_hash,
              producer_implementation_id,state,
              reservation_payload->>'ownerKey' AS reservation_owner_key,
              reservation_payload->>'ownerKeyHash' AS reservation_owner_key_hash,
              canonical_owner_identity->>'ownerKey' AS identity_owner_key,
              canonical_owner_identity->>'ownerHash' AS identity_owner_hash
         FROM internal_production_owner_reservations_v1
        WHERE state IN ('pending','bound')
        ORDER BY reservation_ref
        FOR UPDATE`,
    );
    const completionOwnerIdentity = createInternalProductionCompletionOwnerCanonicalOwnerIdentityV1({ requestId: row.request_id });
    const expectedOwnerKeyHash = hashCanonicalJson({
      schema: "setfarm.internal-production-owner-key.v1",
      ownerKeyDerivationId: "completion-request-id-v1",
      ownerKey: row.request_id,
    });
    const targetOwner = openOwnerRows[0];
    const unrelatedOwnerCount = openOwnerRows.length - 1;
    if (
      openOwnerRows.length !== 1
      || unrelatedOwnerCount !== 0
      || !targetOwner
      || targetOwner.category !== "completion-owner"
      || targetOwner.producer_implementation_id !== "a-completion-owner-v1"
      || targetOwner.state !== "bound"
      || targetOwner.owner_key !== row.request_id
      || targetOwner.owner_key_hash !== expectedOwnerKeyHash
      || targetOwner.reservation_owner_key !== row.request_id
      || targetOwner.reservation_owner_key_hash !== expectedOwnerKeyHash
      || targetOwner.identity_owner_key !== completionOwnerIdentity.ownerKey
      || targetOwner.identity_owner_hash !== completionOwnerIdentity.ownerHash
      || targetOwner.reservation_ref !== headProof.targetOwnerReservationRef
      || targetOwner.reservation_hash !== headProof.targetOwnerReservationHash
    ) completionBootstrapFailV1("TARGET_OWNER_IS_NOT_SOLE_OPEN_OWNER");
    const requestIdHash = hashCanonicalJson({ schema: "setfarm.internal-production-runtime-completion-request-id.v1", requestId: row.request_id });
    const claimIdHash = hashCanonicalJson({ schema: "setfarm.internal-production-runtime-completion-claim-id.v1", claimId: String(row.claim_id) });
    const runIdentityHash = hashCanonicalJson({ schema: "setfarm.internal-production-runtime-completion-run-identity.v1", runId: row.run_id });
    const ownerGenerationHash = hashCanonicalJson({ schema: "setfarm.internal-production-runtime-completion-owner-generation.v1", ownerInstanceId: capability.ownerInstanceId, ownerAttemptCount: capability.ownerAttemptCount });
    const unrelatedOwnerCensusHash = hashCanonicalJson({ schema: "setfarm.internal-production-baseline-completion-owner-unrelated-census.v1", requestIdHash, unrelatedOwnerCount });
    const targetGuardBody = { kind: "authenticated-completion-owner-bootstrap-target" as const, requestIdHash, claimIdHash, runIdentityHash, ownerGenerationHash, ownerFenced: true as const, ownerDrained: true as const, unrelatedOwnerCount: 0 as const, unrelatedOwnerCensusHash };
    const targetGuardHash = hashCanonicalJson(targetGuardBody);
    const receiptBody = { schema: "setfarm.internal-production-baseline-completion-owner-bootstrap-target-guard-receipt.v1" as const, ...targetGuardBody, targetGuardHash };
    const targetGuardReceiptHash = hashCanonicalJson(receiptBody);
    const targetGuardReceiptRef = `setfarm://internal-production/baseline-completion-owner-bootstrap-target-guard-receipt/sha256/${targetGuardReceiptHash}`;
    const value = recursivelyFreezeCompletionBootstrapV1({ ...receiptBody, targetGuardReceiptRef, targetGuardReceiptHash });
    completionBootstrapWriteNoReplaceV1(completionBootstrapReceiptPathV1(targetGuardReceiptHash), value);
    const rawResult = row.result && typeof row.result === "object" && !Array.isArray(row.result) ? row.result as Record<string, unknown> : {};
    const priorValue = rawResult.internalProductionBaselineSpawnerBootstrap;
    const prior = priorValue === undefined ? undefined : completionBootstrapValidateAnyStoredResultV1(priorValue);
    if (prior && (prior.targetGuardReceiptRef !== targetGuardReceiptRef || prior.targetGuardReceiptHash !== targetGuardReceiptHash)) completionBootstrapFailV1("request guard already crossed");
    if (!prior) {
      const bootstrap = { schema: "setfarm.internal-production-baseline-spawner-bootstrap-completion-result.v1", state: "guard_prepared", targetGuardReceiptRef, targetGuardReceiptHash, operationRef: null, operationHash: null, targetGuardConsumptionRef: null, targetGuardConsumptionHash: null, recoveredOwnerGenerationHash: null, targetOwnerReleaseReceiptHash: null, sequenceRef: null, sequenceHash: null };
      const updated = await transaction.unsafe<Array<{ result: unknown }>>("UPDATE runtime_completion_requests SET result=jsonb_set(COALESCE(result,'{}'::jsonb),'{internalProductionBaselineSpawnerBootstrap}',$2::jsonb,true),updated_at=clock_timestamp() WHERE request_id=$1 RETURNING result", [capability.requestId, JSON.stringify(bootstrap)]);
      if (updated.length !== 1) completionBootstrapFailV1("guard result CAS lost");
      const successor = (updated[0]!.result as Record<string, unknown>).internalProductionBaselineSpawnerBootstrap;
      if (hashCanonicalJson(completionBootstrapValidateAnyStoredResultV1(successor)) !== hashCanonicalJson(bootstrap)) completionBootstrapFailV1("guard result successor invalid");
    }
    return value;
  });
  const guard = recursivelyFreezeCompletionBootstrapV1({ kind: receipt.kind, requestIdHash: receipt.requestIdHash, claimIdHash: receipt.claimIdHash, runIdentityHash: receipt.runIdentityHash, ownerGenerationHash: receipt.ownerGenerationHash, ownerFenced: true as const, ownerDrained: true as const, unrelatedOwnerCount: 0 as const, unrelatedOwnerCensusHash: receipt.unrelatedOwnerCensusHash, targetGuardReceiptRef: receipt.targetGuardReceiptRef, targetGuardReceiptHash: receipt.targetGuardReceiptHash, targetGuardHash: receipt.targetGuardHash });
  completionBootstrapGuardsV1.set(guard, { receipt, requestId: capability.requestId, ownerInstanceId: capability.ownerInstanceId, ownerAttemptCount: capability.ownerAttemptCount });
  return guard;
}

export async function prepareInternalProductionBaselineCompletionOwnerBootstrapTargetGuardV1(
): Promise<InternalProductionBaselineCompletionOwnerBootstrapTargetGuardV1> {
  const capability = currentRuntimeCompletionOwnerCapability();
  if (!capability) completionBootstrapFailV1("OWNER_CONTEXT_REQUIRED");
  return prepareInternalProductionBaselineCompletionOwnerBootstrapTargetGuardCoreV1(capability, false);
}

export async function authenticateInternalProductionBaselineCompletionOwnerBootstrapTargetGuardV1(
  guard: InternalProductionBaselineCompletionOwnerBootstrapTargetGuardV1,
): Promise<InternalProductionBaselineCompletionOwnerBootstrapTargetGuardReceiptV1> {
  const state = completionBootstrapGuardsV1.get(guard);
  const capability = currentRuntimeCompletionOwnerCapability();
  if (!state || !capability || state.requestId !== capability.requestId || state.ownerInstanceId !== capability.ownerInstanceId || state.ownerAttemptCount !== capability.ownerAttemptCount) completionBootstrapFailV1("GUARD_CAPABILITY_INVALID");
  const receipt = await resolveInternalProductionBaselineCompletionOwnerBootstrapTargetGuardReceiptV1({ targetGuardReceiptRef: guard.targetGuardReceiptRef, targetGuardReceiptHash: guard.targetGuardReceiptHash });
  const visible = { kind: receipt.kind, requestIdHash: receipt.requestIdHash, claimIdHash: receipt.claimIdHash, runIdentityHash: receipt.runIdentityHash, ownerGenerationHash: receipt.ownerGenerationHash, ownerFenced: receipt.ownerFenced, ownerDrained: receipt.ownerDrained, unrelatedOwnerCount: receipt.unrelatedOwnerCount, unrelatedOwnerCensusHash: receipt.unrelatedOwnerCensusHash, targetGuardReceiptRef: receipt.targetGuardReceiptRef, targetGuardReceiptHash: receipt.targetGuardReceiptHash, targetGuardHash: receipt.targetGuardHash };
  if (hashCanonicalJson(visible) !== hashCanonicalJson(guard) || receipt.targetGuardReceiptHash !== state.receipt.targetGuardReceiptHash) completionBootstrapFailV1("GUARD_RECEIPT_CROSSED");
  return receipt;
}

function completionBootstrapReadConsumptionContentV1(
  exact: Readonly<Record<string, string>>,
): InternalProductionBaselineCompletionOwnerBootstrapTargetGuardConsumptionV1 {
  const value = completionBootstrapReadV1(completionBootstrapConsumptionPathV1(exact.consumptionHash!));
  if (!value || typeof value !== "object" || Array.isArray(value)) completionBootstrapFailV1("consumption shape");
  const consumption = value as Record<string, unknown>;
  const keys = ["schema", "targetGuardReceiptRef", "targetGuardReceiptHash", "targetGuardHash", "operationRef", "operationHash", "requestIdHash", "claimIdHash", "runIdentityHash", "ownerGenerationHash", "targetGuardConsumed", "consumptionRef", "consumptionHash"];
  if (!completionBootstrapHasExactStoredKeysV1(consumption, keys)) completionBootstrapFailV1("consumption keys");
  const body = Object.fromEntries(keys.slice(0, -2).map((key) => [key, consumption[key]]));
  const hash = hashCanonicalJson(body);
  if (consumption.schema !== "setfarm.internal-production-baseline-completion-owner-bootstrap-target-guard-consumption.v1" || consumption.targetGuardConsumed !== true || consumption.consumptionHash !== hash || consumption.consumptionRef !== exact.consumptionRef || consumption.consumptionHash !== exact.consumptionHash) completionBootstrapFailV1("consumption authority");
  if (typeof consumption.targetGuardReceiptHash !== "string" || !SHA256_V1.test(consumption.targetGuardReceiptHash)) completionBootstrapFailV1("consumption guard hash");
  return recursivelyFreezeCompletionBootstrapV1(consumption) as InternalProductionBaselineCompletionOwnerBootstrapTargetGuardConsumptionV1;
}

export async function resolveInternalProductionBaselineCompletionOwnerBootstrapTargetGuardConsumptionV1(
  pair: Readonly<{ consumptionRef: string; consumptionHash: string }>,
): Promise<InternalProductionBaselineCompletionOwnerBootstrapTargetGuardConsumptionV1> {
  const exact = completionBootstrapPairV1(pair, "consumptionRef", "consumptionHash", "setfarm://internal-production/baseline-completion-owner-bootstrap-target-guard-consumption/sha256/");
  const consumption = completionBootstrapReadConsumptionContentV1(exact);
  const marker = completionBootstrapPairV1(
    completionBootstrapReadV1(completionBootstrapConsumedPathV1(String(consumption.targetGuardReceiptHash))),
    "consumptionRef",
    "consumptionHash",
    "setfarm://internal-production/baseline-completion-owner-bootstrap-target-guard-consumption/sha256/",
  );
  if (marker.consumptionRef !== exact.consumptionRef || marker.consumptionHash !== exact.consumptionHash) completionBootstrapFailV1("consumption index is crossed");
  return consumption;
}

export async function consumeInternalProductionBaselineCompletionOwnerBootstrapTargetGuardForOperationV1(
  input: Readonly<{ targetGuardReceiptRef: string; targetGuardReceiptHash: string; operationRef: string; operationHash: string }>,
): Promise<Readonly<{ consumptionRef: string; consumptionHash: string }>> {
  if (!input || typeof input !== "object" || Array.isArray(input) || Object.getPrototypeOf(input) !== Object.prototype || Reflect.ownKeys(input).some((key) => typeof key !== "string") || Object.keys(input).join(",") !== "targetGuardReceiptRef,targetGuardReceiptHash,operationRef,operationHash") completionBootstrapFailV1("consume input shape");
  const selectedRecovery = completionBootstrapSelectedRecoveryContextV1.getStore();
  const capability = currentRuntimeCompletionOwnerCapability() ?? (selectedRecovery ? Object.freeze({ requestId: selectedRecovery.requestId, ownerInstanceId: selectedRecovery.ownerInstanceId, ownerAttemptCount: selectedRecovery.ownerAttemptCount }) : null);
  if (!SHA256_V1.test(input.operationHash) || input.operationRef !== `setfarm://internal-production/baseline-spawner-bootstrap-restart-operation/sha256/${input.operationHash}`) completionBootstrapFailV1("operation pair");
  const receipt = await resolveInternalProductionBaselineCompletionOwnerBootstrapTargetGuardReceiptV1(input);
  const consumptionBody = { schema: "setfarm.internal-production-baseline-completion-owner-bootstrap-target-guard-consumption.v1" as const, targetGuardReceiptRef: receipt.targetGuardReceiptRef, targetGuardReceiptHash: receipt.targetGuardReceiptHash, targetGuardHash: receipt.targetGuardHash, operationRef: input.operationRef, operationHash: input.operationHash, requestIdHash: receipt.requestIdHash, claimIdHash: receipt.claimIdHash, runIdentityHash: receipt.runIdentityHash, ownerGenerationHash: receipt.ownerGenerationHash, targetGuardConsumed: true as const };
  const consumptionHash = hashCanonicalJson(consumptionBody);
  const consumptionRef = `setfarm://internal-production/baseline-completion-owner-bootstrap-target-guard-consumption/sha256/${consumptionHash}`;
  const consumption = recursivelyFreezeCompletionBootstrapV1({ ...consumptionBody, consumptionRef, consumptionHash });
  if (!capability) {
    const durableConsumption = completionBootstrapReadConsumptionContentV1({ consumptionRef, consumptionHash });
    const operationPair = Object.freeze({ operationRef: input.operationRef, operationHash: input.operationHash });
    const row = await completionBootstrapFindRequestV1(operationPair);
    const prior = completionBootstrapStoredResultV1(row, operationPair);
    if (
      prior.state !== "guard_consumed"
      || prior.targetGuardReceiptRef !== receipt.targetGuardReceiptRef || prior.targetGuardReceiptHash !== receipt.targetGuardReceiptHash
      || prior.targetGuardConsumptionRef !== durableConsumption.consumptionRef || prior.targetGuardConsumptionHash !== durableConsumption.consumptionHash
      || receipt.requestIdHash !== hashCanonicalJson({ schema: "setfarm.internal-production-runtime-completion-request-id.v1", requestId: row.request_id })
      || receipt.claimIdHash !== hashCanonicalJson({ schema: "setfarm.internal-production-runtime-completion-claim-id.v1", claimId: String(row.claim_id) })
      || receipt.runIdentityHash !== hashCanonicalJson({ schema: "setfarm.internal-production-runtime-completion-run-identity.v1", runId: row.run_id })
      || row.owner_instance_id === null
      || receipt.ownerGenerationHash !== hashCanonicalJson({ schema: "setfarm.internal-production-runtime-completion-owner-generation.v1", ownerInstanceId: row.owner_instance_id, ownerAttemptCount: row.owner_attempt_count })
    ) completionBootstrapFailV1("durable consumption adoption crossed");
    completionBootstrapWriteNoReplaceV1(completionBootstrapConsumedPathV1(receipt.targetGuardReceiptHash), { consumptionRef, consumptionHash });
    await resolveInternalProductionBaselineCompletionOwnerBootstrapTargetGuardConsumptionV1({ consumptionRef, consumptionHash });
    return Object.freeze({ consumptionRef, consumptionHash });
  }
  await pgBegin(async (transaction) => {
    const rows = await transaction.unsafe<Array<Pick<RuntimeCompletionRow, "request_id" | "claim_id" | "run_id" | "runtime_session_id" | "state" | "apply_phase" | "owner_instance_id" | "owner_attempt_count" | "lease_expires_at" | "drained_at" | "result">>>("SELECT request_id,claim_id,run_id,runtime_session_id,state,apply_phase,owner_instance_id,owner_attempt_count,lease_expires_at,drained_at,result FROM runtime_completion_requests WHERE request_id=$1 FOR UPDATE", [capability.requestId]);
    const row = rows[0];
    if (selectedRecovery) {
      const wallClock = await readDatabaseWallClock(transaction, "INTERNAL_PRODUCTION_COMPLETION_BOOTSTRAP_CLOCK_UNAVAILABLE");
      const sessions = row ? await transaction.unsafe<Array<{ state: string }>>("SELECT state FROM runtime_sessions WHERE session_id=$1 FOR UPDATE", [row.runtime_session_id]) : [];
      if (!row || row.state !== "processing" || row.apply_phase !== "effects_committed" || row.drained_at === null || row.lease_expires_at === null || timestamp(row.lease_expires_at) !== selectedRecovery.leaseExpiresAt || new Date(row.lease_expires_at).getTime() > wallClock.getTime() || sessions.length !== 1 || sessions[0]!.state !== "drained") completionBootstrapFailV1("selected recovery consumption authority crossed");
      completionBootstrapRequireSelectedEligibilityMatchesReceiptAndRowV1(row as RuntimeCompletionRow, receipt);
    }
    const result = row?.result && typeof row.result === "object" && !Array.isArray(row.result) ? row.result as Record<string, unknown> : {};
    const priorValue = result.internalProductionBaselineSpawnerBootstrap;
    const prior = priorValue === undefined ? undefined : completionBootstrapValidateAnyStoredResultV1(priorValue);
    if (!row || row.owner_instance_id !== capability.ownerInstanceId || row.owner_attempt_count !== capability.ownerAttemptCount || !prior || prior.targetGuardReceiptRef !== receipt.targetGuardReceiptRef || prior.targetGuardReceiptHash !== receipt.targetGuardReceiptHash) completionBootstrapFailV1("request guard binding");
    if (["operation_bound", "guard_consumed"].includes(String(prior.state))) {
      if (prior.operationRef !== input.operationRef || prior.operationHash !== input.operationHash) completionBootstrapFailV1("operation binding crossed");
      return;
    }
    if (prior.state !== "guard_prepared" || prior.operationRef !== null || prior.operationHash !== null) completionBootstrapFailV1("request operation predecessor");
    const next = { ...prior, state: "operation_bound", operationRef: input.operationRef, operationHash: input.operationHash };
    const updated = await transaction.unsafe<Array<{ result: unknown }>>("UPDATE runtime_completion_requests SET result=jsonb_set(COALESCE(result,'{}'::jsonb),'{internalProductionBaselineSpawnerBootstrap}',$2::jsonb,true),updated_at=clock_timestamp() WHERE request_id=$1 RETURNING result", [capability.requestId, JSON.stringify(next)]);
    if (updated.length !== 1 || hashCanonicalJson(completionBootstrapValidateAnyStoredResultV1((updated[0]!.result as Record<string, unknown>).internalProductionBaselineSpawnerBootstrap)) !== hashCanonicalJson(next)) completionBootstrapFailV1("operation binding successor invalid");
  });
  completionBootstrapWriteNoReplaceV1(completionBootstrapConsumptionPathV1(consumptionHash), consumption);
  await pgBegin(async (transaction) => {
    const rows = await transaction.unsafe<Array<Pick<RuntimeCompletionRow, "request_id" | "claim_id" | "run_id" | "runtime_session_id" | "state" | "apply_phase" | "owner_instance_id" | "owner_attempt_count" | "lease_expires_at" | "drained_at" | "result">>>("SELECT request_id,claim_id,run_id,runtime_session_id,state,apply_phase,owner_instance_id,owner_attempt_count,lease_expires_at,drained_at,result FROM runtime_completion_requests WHERE request_id=$1 FOR UPDATE", [capability.requestId]);
    const row = rows[0];
    if (selectedRecovery) {
      const wallClock = await readDatabaseWallClock(transaction, "INTERNAL_PRODUCTION_COMPLETION_BOOTSTRAP_CLOCK_UNAVAILABLE");
      const sessions = row ? await transaction.unsafe<Array<{ state: string }>>("SELECT state FROM runtime_sessions WHERE session_id=$1 FOR UPDATE", [row.runtime_session_id]) : [];
      if (!row || row.state !== "processing" || row.apply_phase !== "effects_committed" || row.drained_at === null || row.lease_expires_at === null || timestamp(row.lease_expires_at) !== selectedRecovery.leaseExpiresAt || new Date(row.lease_expires_at).getTime() > wallClock.getTime() || sessions.length !== 1 || sessions[0]!.state !== "drained" || !completionBootstrapSelectedEligibilityMatchesRowV1(row as RuntimeCompletionRow)) completionBootstrapFailV1("selected recovery consumption authority crossed");
      completionBootstrapRequireSelectedEligibilityMatchesReceiptAndRowV1(row as RuntimeCompletionRow, receipt);
    }
    const result = row?.result && typeof row.result === "object" && !Array.isArray(row.result) ? row.result as Record<string, unknown> : {};
    const priorValue = result.internalProductionBaselineSpawnerBootstrap;
    const prior = priorValue === undefined ? undefined : completionBootstrapValidateAnyStoredResultV1(priorValue);
    if (!row || row.owner_instance_id !== capability.ownerInstanceId || row.owner_attempt_count !== capability.ownerAttemptCount || !prior || prior.targetGuardReceiptRef !== receipt.targetGuardReceiptRef || prior.targetGuardReceiptHash !== receipt.targetGuardReceiptHash) completionBootstrapFailV1("request guard binding");
    if (prior.state === "guard_consumed" && prior.targetGuardConsumptionHash === consumptionHash) return;
    if (prior.state !== "operation_bound" || prior.operationRef !== input.operationRef || prior.operationHash !== input.operationHash) completionBootstrapFailV1("operation not durably bound");
    const next = { ...prior, state: "guard_consumed", targetGuardConsumptionRef: consumptionRef, targetGuardConsumptionHash: consumptionHash };
    const updated = await transaction.unsafe<Array<{ result: unknown }>>("UPDATE runtime_completion_requests SET result=jsonb_set(COALESCE(result,'{}'::jsonb),'{internalProductionBaselineSpawnerBootstrap}',$2::jsonb,true),updated_at=clock_timestamp() WHERE request_id=$1 RETURNING result", [capability.requestId, JSON.stringify(next)]);
    if (updated.length !== 1 || hashCanonicalJson(completionBootstrapValidateAnyStoredResultV1((updated[0]!.result as Record<string, unknown>).internalProductionBaselineSpawnerBootstrap)) !== hashCanonicalJson(next)) completionBootstrapFailV1("guard consumption successor invalid");
  });
  completionBootstrapWriteNoReplaceV1(completionBootstrapConsumedPathV1(receipt.targetGuardReceiptHash), { consumptionRef, consumptionHash });
  return Object.freeze({ consumptionRef, consumptionHash });
}

const COMPLETION_BOOTSTRAP_RESULT_KEYS_V1 = Object.freeze([
  "schema", "state", "targetGuardReceiptRef", "targetGuardReceiptHash", "operationRef", "operationHash",
  "targetGuardConsumptionRef", "targetGuardConsumptionHash", "recoveredOwnerGenerationHash",
  "targetOwnerReleaseReceiptHash", "sequenceRef", "sequenceHash",
] as const);

type CompletionBootstrapLifecycleContextV1 = Readonly<{
  row: RuntimeCompletionRow;
  result: Record<string, unknown>;
  operation: Record<string, unknown>;
  receipt: InternalProductionBaselineCompletionOwnerBootstrapTargetGuardReceiptV1;
  consumption: InternalProductionBaselineCompletionOwnerBootstrapTargetGuardConsumptionV1;
  startupAdmissionPair: Readonly<{ startupAdmissionRef: string; startupAdmissionHash: string }>;
  startupAdmission: Record<string, unknown>;
  startupClaim: Record<string, unknown>;
  restartAuthorityPair: Readonly<{ receiptRef: string; receiptHash: string }>;
  restartAuthority: Record<string, unknown>;
}>;

function completionBootstrapOperationPairV1(input: unknown): Readonly<{ operationRef: string; operationHash: string }> {
  if (!input || typeof input !== "object" || Array.isArray(input) || Object.getPrototypeOf(input) !== Object.prototype || Reflect.ownKeys(input).some((key) => typeof key !== "string") || Object.keys(input).join(",") !== "operationRef,operationHash") completionBootstrapFailV1("lifecycle operation pair");
  const pair = input as Record<string, unknown>;
  if (typeof pair.operationHash !== "string" || !SHA256_V1.test(pair.operationHash) || pair.operationRef !== `setfarm://internal-production/baseline-spawner-bootstrap-restart-operation/sha256/${pair.operationHash}`) completionBootstrapFailV1("lifecycle operation identity");
  return Object.freeze({ operationRef: pair.operationRef as string, operationHash: pair.operationHash });
}

function completionBootstrapStoredResultV1(row: RuntimeCompletionRow, operationPair: Readonly<{ operationRef: string; operationHash: string }>): Record<string, unknown> {
  const outer = row.result && typeof row.result === "object" && !Array.isArray(row.result) ? row.result as Record<string, unknown> : completionBootstrapFailV1("lifecycle result object");
  const exact = completionBootstrapValidateAnyStoredResultV1(outer.internalProductionBaselineSpawnerBootstrap);
  if (
    !["guard_consumed", "owner_recovered", "owner_released", "completed"].includes(String(exact.state))
    || exact.operationRef !== operationPair.operationRef || exact.operationHash !== operationPair.operationHash
    || typeof exact.targetGuardReceiptHash !== "string" || !SHA256_V1.test(exact.targetGuardReceiptHash)
    || typeof exact.targetGuardConsumptionHash !== "string" || !SHA256_V1.test(exact.targetGuardConsumptionHash)
    || (exact.state === "guard_consumed" && (exact.recoveredOwnerGenerationHash !== null || exact.targetOwnerReleaseReceiptHash !== null || exact.sequenceRef !== null || exact.sequenceHash !== null))
    || (exact.state === "owner_recovered" && (typeof exact.recoveredOwnerGenerationHash !== "string" || !SHA256_V1.test(exact.recoveredOwnerGenerationHash) || exact.targetOwnerReleaseReceiptHash !== null || exact.sequenceRef !== null || exact.sequenceHash !== null))
    || (exact.state === "owner_released" && (typeof exact.recoveredOwnerGenerationHash !== "string" || !SHA256_V1.test(exact.recoveredOwnerGenerationHash) || typeof exact.targetOwnerReleaseReceiptHash !== "string" || !SHA256_V1.test(exact.targetOwnerReleaseReceiptHash) || exact.sequenceRef !== null || exact.sequenceHash !== null))
    || (exact.state === "completed" && (typeof exact.recoveredOwnerGenerationHash !== "string" || !SHA256_V1.test(exact.recoveredOwnerGenerationHash) || typeof exact.targetOwnerReleaseReceiptHash !== "string" || !SHA256_V1.test(exact.targetOwnerReleaseReceiptHash) || typeof exact.sequenceHash !== "string" || !SHA256_V1.test(exact.sequenceHash) || exact.sequenceRef !== `setfarm://internal-production/baseline-spawner-bootstrap-restart-sequence/sha256/${exact.sequenceHash}`))
  ) completionBootstrapFailV1("lifecycle result authority");
  return Object.fromEntries(COMPLETION_BOOTSTRAP_RESULT_KEYS_V1.map((key) => [key, exact[key]]));
}

async function completionBootstrapFindRequestV1(operationPair: Readonly<{ operationRef: string; operationHash: string }>): Promise<RuntimeCompletionRow> {
  return pgBegin(async (transaction) => {
    const rows = await transaction.unsafe<RuntimeCompletionRow[]>(
      `SELECT * FROM runtime_completion_requests
        WHERE result->'internalProductionBaselineSpawnerBootstrap'->>'operationRef'=$1
          AND result->'internalProductionBaselineSpawnerBootstrap'->>'operationHash'=$2
        FOR UPDATE`,
      [operationPair.operationRef, operationPair.operationHash],
    );
    if (rows.length !== 1 || !rows[0]) completionBootstrapFailV1("lifecycle request cardinality");
    completionBootstrapStoredResultV1(rows[0], operationPair);
    return rows[0];
  });
}

async function resolveCompletionBootstrapLifecycleContextV1(
  operationPair: Readonly<{ operationRef: string; operationHash: string }>,
  suppliedSequencePair?: Readonly<{ sequenceRef: string; sequenceHash: string }>,
): Promise<CompletionBootstrapLifecycleContextV1> {
  const sequenceModule = await import("../internal-production/baseline-service-restart-sequence-v1.js") as Record<string, unknown>;
  const resolveOperation = sequenceModule.resolveInternalProductionBaselineSpawnerBootstrapRestartOperationV1;
  const resolveSequence = sequenceModule.resolveInternalProductionBaselineSpawnerBootstrapRestartSequenceV1;
  if (typeof resolveOperation !== "function" || resolveOperation.length !== 1 || typeof resolveSequence !== "function" || resolveSequence.length !== 1) completionBootstrapFailV1("lifecycle sequence resolvers");
  const operation = await (resolveOperation as (value: unknown) => Promise<Record<string, unknown>>)(operationPair);
  if (operation.operationRef !== operationPair.operationRef || operation.operationHash !== operationPair.operationHash) completionBootstrapFailV1("lifecycle operation crossed");
  const row = await completionBootstrapFindRequestV1(operationPair);
  const result = completionBootstrapStoredResultV1(row, operationPair);
  const receipt = await resolveInternalProductionBaselineCompletionOwnerBootstrapTargetGuardReceiptV1({ targetGuardReceiptRef: String(result.targetGuardReceiptRef), targetGuardReceiptHash: String(result.targetGuardReceiptHash) });
  const consumption = await resolveInternalProductionBaselineCompletionOwnerBootstrapTargetGuardConsumptionV1({ consumptionRef: String(result.targetGuardConsumptionRef), consumptionHash: String(result.targetGuardConsumptionHash) });
  if (
    receipt.requestIdHash !== hashCanonicalJson({ schema: "setfarm.internal-production-runtime-completion-request-id.v1", requestId: row.request_id })
    || receipt.claimIdHash !== hashCanonicalJson({ schema: "setfarm.internal-production-runtime-completion-claim-id.v1", claimId: String(row.claim_id) })
    || receipt.runIdentityHash !== hashCanonicalJson({ schema: "setfarm.internal-production-runtime-completion-run-identity.v1", runId: row.run_id })
    || row.owner_instance_id === null
    || receipt.ownerGenerationHash !== hashCanonicalJson({ schema: "setfarm.internal-production-runtime-completion-owner-generation.v1", ownerInstanceId: row.owner_instance_id, ownerAttemptCount: row.owner_attempt_count })
    || operation.targetGuardReceiptRef !== receipt.targetGuardReceiptRef || operation.targetGuardReceiptHash !== receipt.targetGuardReceiptHash
    || consumption.operationRef !== operationPair.operationRef || consumption.operationHash !== operationPair.operationHash
    || consumption.targetGuardReceiptRef !== receipt.targetGuardReceiptRef || consumption.targetGuardReceiptHash !== receipt.targetGuardReceiptHash
  ) completionBootstrapFailV1("lifecycle guard/operation/raw request crossed");
  if (["guard_consumed", "owner_recovered"].includes(String(result.state))) {
    await pgBegin(async (transaction) => {
      const sessions = await transaction.unsafe<Array<{ state: string }>>("SELECT state FROM runtime_sessions WHERE session_id=$1 AND state='drained' FOR UPDATE", [row.runtime_session_id]);
      const owners = await transaction.unsafe<Array<{ reservation_ref: string; reservation_hash: string; state: string; owner_key: string; owner_key_hash: string; producer_implementation_id: string; reservation_owner_key: string | null; reservation_owner_key_hash: string | null; identity_owner_key: string | null; identity_owner_hash: string | null }>>(
        `SELECT reservation_ref,reservation_hash,state,owner_key,owner_key_hash,producer_implementation_id,
                reservation_payload->>'ownerKey' AS reservation_owner_key,
                reservation_payload->>'ownerKeyHash' AS reservation_owner_key_hash,
                canonical_owner_identity->>'ownerKey' AS identity_owner_key,
                canonical_owner_identity->>'ownerHash' AS identity_owner_hash
           FROM internal_production_owner_reservations_v1
          WHERE category='completion-owner' AND owner_key=$1 AND producer_implementation_id='a-completion-owner-v1' AND state='bound'
          FOR UPDATE`,
        [row.request_id],
      );
      const canonicalOwner = createInternalProductionCompletionOwnerCanonicalOwnerIdentityV1({ requestId: row.request_id });
      const expectedOwnerKeyHash = hashCanonicalJson({ schema: "setfarm.internal-production-owner-key.v1", ownerKeyDerivationId: "completion-request-id-v1", ownerKey: row.request_id });
      const owner = owners[0];
      if (sessions.length !== 1 || sessions[0]?.state !== "drained" || owners.length !== 1 || !owner || owner.state !== "bound" || owner.owner_key !== row.request_id || owner.owner_key_hash !== expectedOwnerKeyHash || owner.producer_implementation_id !== "a-completion-owner-v1" || owner.reservation_owner_key !== row.request_id || owner.reservation_owner_key_hash !== expectedOwnerKeyHash || owner.identity_owner_key !== canonicalOwner.ownerKey || owner.identity_owner_hash !== canonicalOwner.ownerHash) completionBootstrapFailV1("recoverable lifecycle owner/session state");
    });
  }

  const spawner = await import("../spawner.js") as Record<string, unknown>;
  const resolveAdmission = spawner.resolveInternalProductionBaselineSpawnerStartupAdmissionV1;
  const resolveAdmissionForOperation = spawner.resolveInternalProductionBaselineSpawnerStartupAdmissionForRestartOperationV1;
  const resolveClaim = spawner.resolveInternalProductionBaselineSpawnerStartupClaimV1;
  const resolveActive = spawner.resolveActiveInternalProductionBaselineSpawnerStartupAdmissionV1;
  if (typeof resolveAdmission !== "function" || resolveAdmission.length !== 1 || typeof resolveAdmissionForOperation !== "function" || resolveAdmissionForOperation.length !== 1 || typeof resolveClaim !== "function" || resolveClaim.length !== 1 || typeof resolveActive !== "function" || resolveActive.length !== 0) completionBootstrapFailV1("lifecycle spawner resolvers");
  let startupAdmissionPair: Readonly<{ startupAdmissionRef: string; startupAdmissionHash: string }>;
  if (suppliedSequencePair || result.state === "completed") {
    const sequencePair = suppliedSequencePair ?? { sequenceRef: String(result.sequenceRef), sequenceHash: String(result.sequenceHash) };
    const sequence = await (resolveSequence as (value: unknown) => Promise<Record<string, unknown>>)(sequencePair);
    if (sequence.operationRef !== operationPair.operationRef || sequence.operationHash !== operationPair.operationHash) completionBootstrapFailV1("lifecycle sequence crossed");
    startupAdmissionPair = Object.freeze({ startupAdmissionRef: String(sequence.startupAdmissionRef), startupAdmissionHash: String(sequence.startupAdmissionHash) });
  } else {
    const active = await (resolveActive as () => Promise<Record<string, unknown> | null>)();
    if (!active || active.bootstrapOperationRef !== operationPair.operationRef || active.bootstrapOperationHash !== operationPair.operationHash) completionBootstrapFailV1("lifecycle active admission crossed");
    startupAdmissionPair = Object.freeze({ startupAdmissionRef: `setfarm://internal-production/baseline-spawner-startup-admission/sha256/${String(active.admissionHash)}`, startupAdmissionHash: String(active.admissionHash) });
  }
  const startupAdmission = await (resolveAdmission as (value: unknown) => Promise<Record<string, unknown>>)(startupAdmissionPair);
  if (startupAdmission.bootstrapOperationRef !== operationPair.operationRef || startupAdmission.bootstrapOperationHash !== operationPair.operationHash) completionBootstrapFailV1("lifecycle admission bootstrap crossed");
  const normalOperationPair = Object.freeze({ operationRef: `setfarm://internal-production/baseline-service-restart-operation/sha256/${String(startupAdmission.operationId)}`, operationHash: String(startupAdmission.operationId) });
  const reopenedAdmissionPair = await (resolveAdmissionForOperation as (value: unknown) => Promise<Record<string, string>>)(normalOperationPair);
  if (reopenedAdmissionPair.startupAdmissionRef !== startupAdmissionPair.startupAdmissionRef || reopenedAdmissionPair.startupAdmissionHash !== startupAdmissionPair.startupAdmissionHash) completionBootstrapFailV1("lifecycle admission locator crossed");
  const startupClaim = await (resolveClaim as (value: unknown) => Promise<Record<string, unknown>>)(startupAdmissionPair);

  const receiptModule = await import("../internal-production/baseline-post-handoff-receipt-v1.js") as Record<string, unknown>;
  const resolveNormalOperation = receiptModule.resolveInternalProductionBaselineServiceRestartOperationV1;
  const resolveAuthorization = receiptModule.resolveInternalProductionBaselineServiceRestartAuthorizationV1;
  const observeStatus = receiptModule.observeInternalProductionBaselineServiceRestartAuthorizationStatusV1;
  const resolveRestart = receiptModule.resolveInternalProductionBaselineServiceRestartAuthorityV1;
  if (typeof resolveNormalOperation !== "function" || resolveNormalOperation.length !== 1 || typeof resolveAuthorization !== "function" || resolveAuthorization.length !== 1 || typeof observeStatus !== "function" || observeStatus.length !== 1 || typeof resolveRestart !== "function" || resolveRestart.length !== 1) completionBootstrapFailV1("lifecycle restart resolvers");
  const normalOperation = await (resolveNormalOperation as (value: unknown) => Promise<Record<string, unknown>>)(normalOperationPair);
  const authorization = await (resolveAuthorization as (value: unknown) => Promise<Record<string, unknown>>)({ authorizationRef: normalOperation.authorizationRef, authorizationHash: normalOperation.authorizationHash });
  const status = await (observeStatus as (value: unknown) => Promise<Record<string, unknown>>)({ authorizationRef: normalOperation.authorizationRef, authorizationHash: normalOperation.authorizationHash });
  if (status.state !== "consumed" || typeof status.consumptionRef !== "string" || typeof status.consumptionHash !== "string") completionBootstrapFailV1("lifecycle restart authority incomplete");
  const restartAuthorityPair = Object.freeze({ receiptRef: status.consumptionRef as string, receiptHash: status.consumptionHash as string });
  const restartAuthority = await (resolveRestart as (value: unknown) => Promise<Record<string, unknown>>)(restartAuthorityPair);
  const restart = restartAuthority.restart as Record<string, unknown> | undefined;
  if (!restart || restartAuthority.guardKind !== "fenced-completion-owner-bootstrap" || restartAuthority.operationId !== normalOperationPair.operationHash || restartAuthority.targetGuardReceiptRef !== receipt.targetGuardReceiptRef || restartAuthority.targetGuardReceiptHash !== receipt.targetGuardReceiptHash || startupAdmission.restartLaunchOutboxHash !== restart.outboxHash || startupAdmission.beforeGenerationHash !== restart.beforeGenerationHash || startupClaim.operationId !== normalOperationPair.operationHash || startupClaim.currentGenerationHash !== restart.afterGenerationHash || (result.recoveredOwnerGenerationHash !== null && result.recoveredOwnerGenerationHash !== restart.afterGenerationHash)) completionBootstrapFailV1("lifecycle restart/admission/claim crossed");
  if (["owner_released", "completed"].includes(String(result.state))) {
    if (row.state !== "accepted" || row.apply_phase !== "effects_committed" || row.accepted_at === null || row.lease_expires_at !== null || typeof result.targetOwnerReleaseReceiptHash !== "string") completionBootstrapFailV1("released lifecycle request state");
    await pgBegin(async (transaction) => {
      const sessions = await transaction.unsafe<Array<{ state: string }>>("SELECT state FROM runtime_sessions WHERE session_id=$1 AND state='released' FOR UPDATE", [row.runtime_session_id]);
      if (sessions.length !== 1 || sessions[0]?.state !== "released") completionBootstrapFailV1("released lifecycle session state");
      const owners = await transaction.unsafe<Array<{ reservation_ref: string; reservation_hash: string; state: string }>>("SELECT reservation_ref,reservation_hash,state FROM internal_production_owner_reservations_v1 WHERE category='completion-owner' AND owner_key=$1 AND state='closed' FOR UPDATE", [row.request_id]);
      if (owners.length !== 1 || owners[0]?.state !== "closed") completionBootstrapFailV1("released lifecycle owner state");
      const closeHash = result.targetOwnerReleaseReceiptHash as string;
      const close = await resolveInternalProductionOwnerReservationCloseInTransactionV1(transaction as PgTransactionSql, { closeRef: `setfarm://internal-production/owner-reservation-closes/sha256/${closeHash}`, closeHash });
      if (close.reservationRef !== owners[0]!.reservation_ref || close.reservationHash !== owners[0]!.reservation_hash) completionBootstrapFailV1("released lifecycle close state");
    });
  } else if (row.state !== "processing" || row.apply_phase !== "effects_committed" || row.drained_at === null || row.lease_expires_at === null) completionBootstrapFailV1("open lifecycle request state");
  return Object.freeze({ row, result, operation, receipt, consumption, startupAdmissionPair, startupAdmission, startupClaim, restartAuthorityPair, restartAuthority });
}

function completionBootstrapLifecycleObservationV1(context: CompletionBootstrapLifecycleContextV1): InternalProductionBaselineCompletionOwnerBootstrapLifecycleObservationV1 {
  const body = {
    schema: "setfarm.internal-production-baseline-completion-owner-bootstrap-lifecycle-observation.v1" as const,
    state: context.result.state as "guard_consumed" | "owner_recovered" | "owner_released" | "completed",
    targetGuardReceiptRef: context.receipt.targetGuardReceiptRef,
    targetGuardReceiptHash: context.receipt.targetGuardReceiptHash,
    operationRef: String(context.operation.operationRef),
    operationHash: String(context.operation.operationHash),
    targetGuardConsumptionRef: context.consumption.consumptionRef,
    targetGuardConsumptionHash: context.consumption.consumptionHash,
    startupAdmissionRef: context.startupAdmissionPair.startupAdmissionRef,
    startupAdmissionHash: context.startupAdmissionPair.startupAdmissionHash,
    startupClaimHash: String(context.startupClaim.startupClaimHash),
    restartAuthorityRef: context.restartAuthorityPair.receiptRef,
    restartAuthorityHash: context.restartAuthorityPair.receiptHash,
    recoveredOwnerGenerationHash: context.result.recoveredOwnerGenerationHash as string | null,
    targetOwnerReleaseReceiptHash: context.result.targetOwnerReleaseReceiptHash as string | null,
    sequenceRef: context.result.sequenceRef as string | null,
    sequenceHash: context.result.sequenceHash as string | null,
  };
  return recursivelyFreezeCompletionBootstrapV1({ ...body, observationHash: hashCanonicalJson(body) });
}

export async function observeInternalProductionBaselineCompletionOwnerBootstrapLifecycleV1(
  input: Readonly<{ operationRef: string; operationHash: string }>,
): Promise<InternalProductionBaselineCompletionOwnerBootstrapLifecycleObservationV1> {
  const operationPair = completionBootstrapOperationPairV1(input);
  const context = await resolveCompletionBootstrapLifecycleContextV1(operationPair);
  return completionBootstrapLifecycleObservationV1(context);
}

export async function recoverAndReleaseInternalProductionBaselineCompletionOwnerBootstrapTargetV1(
  input: Readonly<{ operationRef: string; operationHash: string }>,
): Promise<InternalProductionBaselineCompletionOwnerBootstrapLifecycleObservationV1> {
  const operationPair = completionBootstrapOperationPairV1(input);
  let context = await resolveCompletionBootstrapLifecycleContextV1(operationPair);
  if (context.result.state === "guard_consumed") {
    await pgBegin(async (transaction) => {
      const rows = await transaction.unsafe<RuntimeCompletionRow[]>("SELECT * FROM runtime_completion_requests WHERE request_id=$1 FOR UPDATE", [context.row.request_id]);
      const row = rows[0];
      if (!row || rows.length !== 1 || row.state !== "processing" || row.apply_phase !== "effects_committed" || row.drained_at === null || row.owner_instance_id !== context.row.owner_instance_id || row.owner_attempt_count !== context.row.owner_attempt_count || row.lease_expires_at === null) completionBootstrapFailV1("owner recovery request state");
      const prior = completionBootstrapStoredResultV1(row, operationPair);
      if (prior.state !== "guard_consumed" || hashCanonicalJson(prior) !== hashCanonicalJson(context.result)) completionBootstrapFailV1("owner recovery predecessor");
      const next = { ...prior, state: "owner_recovered", recoveredOwnerGenerationHash: String(context.startupClaim.currentGenerationHash) };
      const updated = await transaction.unsafe<Array<{ request_id: string }>>(
        `UPDATE runtime_completion_requests
            SET result=jsonb_set(COALESCE(result,'{}'::jsonb),'{internalProductionBaselineSpawnerBootstrap}',$2::jsonb,true),updated_at=clock_timestamp()
          WHERE request_id=$1 AND state='processing' AND apply_phase='effects_committed'
            AND result->'internalProductionBaselineSpawnerBootstrap'->>'state'='guard_consumed'
          RETURNING request_id`,
        [row.request_id, JSON.stringify(next)],
      );
      if (updated.length !== 1) completionBootstrapFailV1("owner recovery CAS");
    });
    context = await resolveCompletionBootstrapLifecycleContextV1(operationPair);
  }
  if (context.result.state === "owner_recovered") {
    await pgBegin(async (transaction) => {
      const headProof = await lockInternalProductionBaselineCompletionOwnerBootstrapReleaseInTransactionV1(transaction as PgTransactionSql, { requestId: context.row.request_id, targetGuardReceiptRef: String(context.result.targetGuardReceiptRef), targetGuardReceiptHash: String(context.result.targetGuardReceiptHash), operationRef: String(context.result.operationRef), operationHash: String(context.result.operationHash) });
      const rows = await transaction.unsafe<RuntimeCompletionRow[]>("SELECT * FROM runtime_completion_requests WHERE request_id=$1 FOR UPDATE", [context.row.request_id]);
      const row = rows[0];
      if (!row || rows.length !== 1 || row.state !== "processing" || row.apply_phase !== "effects_committed" || row.drained_at === null || row.owner_instance_id !== context.row.owner_instance_id || row.owner_attempt_count !== context.row.owner_attempt_count || row.lease_expires_at === null) completionBootstrapFailV1("owner release request state");
      const prior = completionBootstrapStoredResultV1(row, operationPair);
      if (prior.state !== "owner_recovered" || prior.recoveredOwnerGenerationHash !== context.startupClaim.currentGenerationHash || hashCanonicalJson(prior) !== hashCanonicalJson(context.result)) completionBootstrapFailV1("owner release predecessor");
      const now = await readDatabaseWallClock(transaction, "INTERNAL_PRODUCTION_COMPLETION_OWNER_BOOTSTRAP_CLOCK_UNAVAILABLE");
      await releaseDrainedRuntimeSessionInTransaction(transaction, { sessionId: row.runtime_session_id, claimId: Number(row.claim_id), ownerInstanceId: row.owner_instance_id ?? undefined, now });
      const accepted = await transaction.unsafe<Array<{ request_id: string }>>(
        `UPDATE runtime_completion_requests
            SET state='accepted',accepted_at=$2,lease_expires_at=NULL,updated_at=$2
          WHERE request_id=$1 AND state='processing' AND apply_phase='effects_committed'
            AND owner_instance_id=$3 AND owner_attempt_count=$4
            AND result->'internalProductionBaselineSpawnerBootstrap'->>'state'='owner_recovered'
          RETURNING request_id`,
        [row.request_id, now, row.owner_instance_id, row.owner_attempt_count],
      );
      if (accepted.length !== 1) completionBootstrapFailV1("owner release acceptance CAS");
      const terminal = await resolveInternalProductionCompletionOwnerTerminalAuthorityPairInTransactionV1(transaction as PgTransactionSql, { requestId: row.request_id });
      if (terminal.reservationRef !== headProof.targetOwnerReservationRef || terminal.reservationHash !== headProof.targetOwnerReservationHash) completionBootstrapFailV1("owner release head proof crossed");
      const close = await closeInternalProductionOwnerReservationV1(transaction as PgTransactionSql, terminal);
      const reopened = await resolveInternalProductionOwnerReservationCloseInTransactionV1(transaction as PgTransactionSql, { closeRef: close.closeRef, closeHash: close.closeHash });
      if (reopened.reservationRef !== terminal.reservationRef || reopened.reservationHash !== terminal.reservationHash) completionBootstrapFailV1("owner release close crossed");
      const next = { ...prior, state: "owner_released", targetOwnerReleaseReceiptHash: close.closeHash };
      const updated = await transaction.unsafe<Array<{ request_id: string }>>(
        `UPDATE runtime_completion_requests
            SET result=jsonb_set(COALESCE(result,'{}'::jsonb),'{internalProductionBaselineSpawnerBootstrap}',$2::jsonb,true),updated_at=$3
          WHERE request_id=$1 AND state='accepted' AND apply_phase='effects_committed'
            AND result->'internalProductionBaselineSpawnerBootstrap'->>'state'='owner_recovered'
          RETURNING request_id`,
        [row.request_id, JSON.stringify(next), now],
      );
      if (updated.length !== 1) completionBootstrapFailV1("owner release result CAS");
    });
    context = await resolveCompletionBootstrapLifecycleContextV1(operationPair);
  }
  if (context.result.state !== "owner_released") completionBootstrapFailV1("owner release terminal state");
  return completionBootstrapLifecycleObservationV1(context);
}

export async function completeInternalProductionBaselineCompletionOwnerBootstrapForSequenceV1(
  input: Readonly<{ operationRef: string; operationHash: string; sequenceRef: string; sequenceHash: string }>,
): Promise<InternalProductionBaselineCompletionOwnerBootstrapLifecycleObservationV1> {
  if (!input || typeof input !== "object" || Array.isArray(input) || Object.getPrototypeOf(input) !== Object.prototype || Reflect.ownKeys(input).some((key) => typeof key !== "string") || Object.keys(input).join(",") !== "operationRef,operationHash,sequenceRef,sequenceHash" || typeof input.sequenceHash !== "string" || !SHA256_V1.test(input.sequenceHash) || input.sequenceRef !== `setfarm://internal-production/baseline-spawner-bootstrap-restart-sequence/sha256/${input.sequenceHash}`) completionBootstrapFailV1("complete sequence input");
  const operationPair = completionBootstrapOperationPairV1({ operationRef: input.operationRef, operationHash: input.operationHash });
  const sequencePair = Object.freeze({ sequenceRef: input.sequenceRef, sequenceHash: input.sequenceHash });
  let context = await resolveCompletionBootstrapLifecycleContextV1(operationPair, sequencePair);
  if (context.result.state === "completed") {
    if (context.result.sequenceRef !== input.sequenceRef || context.result.sequenceHash !== input.sequenceHash) completionBootstrapFailV1("completed sequence crossed");
    return completionBootstrapLifecycleObservationV1(context);
  }
  if (context.result.state !== "owner_released") completionBootstrapFailV1("sequence completion predecessor");
  await pgBegin(async (transaction) => {
    const rows = await transaction.unsafe<RuntimeCompletionRow[]>("SELECT * FROM runtime_completion_requests WHERE request_id=$1 FOR UPDATE", [context.row.request_id]);
    const row = rows[0];
    if (!row || rows.length !== 1 || row.state !== "accepted" || row.apply_phase !== "effects_committed" || row.accepted_at === null || row.lease_expires_at !== null) completionBootstrapFailV1("sequence completion request state");
    const prior = completionBootstrapStoredResultV1(row, operationPair);
    if (prior.state !== "owner_released" || hashCanonicalJson(prior) !== hashCanonicalJson(context.result)) completionBootstrapFailV1("sequence completion predecessor crossed");
    const next = { ...prior, state: "completed", sequenceRef: input.sequenceRef, sequenceHash: input.sequenceHash };
    const updated = await transaction.unsafe<Array<{ request_id: string }>>(
      `UPDATE runtime_completion_requests
          SET result=jsonb_set(COALESCE(result,'{}'::jsonb),'{internalProductionBaselineSpawnerBootstrap}',$2::jsonb,true),updated_at=clock_timestamp()
        WHERE request_id=$1 AND state='accepted' AND apply_phase='effects_committed'
          AND result->'internalProductionBaselineSpawnerBootstrap'->>'state'='owner_released'
        RETURNING request_id`,
      [row.request_id, JSON.stringify(next)],
    );
    if (updated.length !== 1) completionBootstrapFailV1("sequence completion CAS");
  });
  context = await resolveCompletionBootstrapLifecycleContextV1(operationPair, sequencePair);
  if (context.result.state !== "completed") completionBootstrapFailV1("sequence completion not visible");
  return completionBootstrapLifecycleObservationV1(context);
}

export async function terminalizeRuntimeCompletionForRunInTransactionV1(
  sql: TransactionSql,
  input: Readonly<{
    requestId: string;
    runId: string;
    terminalRunStatus: "completed" | "failed" | "cancelled";
    transitionTime: Date;
  }>,
): Promise<string> {
  const requestId = RuntimeCompletionRequestIdSchema.parse(input.requestId);
  const terminalRunStatus = z.enum(["completed", "failed", "cancelled"]).parse(input.terminalRunStatus);
  if (!input.runId.trim() || !Number.isFinite(input.transitionTime.getTime())) {
    throw new Error("RUN_TERMINAL_COMPLETION_INPUT_INVALID");
  }
  const current = await sql.unsafe<Array<{ state: string; apply_phase: string }>>(
    `SELECT state,apply_phase FROM runtime_completion_requests
      WHERE request_id=$1 AND run_id=$2 FOR UPDATE`,
    [requestId, input.runId],
  );
  const stored = current[0];
  if (current.length !== 1 || !stored) throw new Error("RUN_TERMINAL_COMPLETION_NOT_FOUND");
  const resolution = (
    (stored.state === "requested" && stored.apply_phase === "proposed")
    || (stored.state === "draining" && stored.apply_phase === "proposed")
  )
    ? "rejected"
    : stored.state === "processing" && stored.apply_phase === "effects_committed"
      ? "accepted"
      : undefined;
  if (!resolution) {
    throw new Error(`RUN_TERMINAL_COMPLETION_STATE_OPEN:${stored.state}:${stored.apply_phase}`);
  }
  const rows = await sql.unsafe<RuntimeCompletionRow[]>(
    `UPDATE runtime_completion_requests
        SET state = $5,
            accepted_at = CASE WHEN $5 = 'accepted' THEN $6 ELSE accepted_at END,
            rejected_at = CASE WHEN $5 = 'rejected' THEN $6 ELSE rejected_at END,
            lease_expires_at = NULL,
            diagnostic = CASE WHEN $5 = 'rejected' THEN $7 ELSE diagnostic END,
            result = (result || $8::text::jsonb),
            updated_at = $6
      WHERE request_id = $1 AND run_id = $2
        AND state = $3 AND apply_phase = $4
      RETURNING *`,
    [
      requestId,
      input.runId,
      stored.state,
      stored.apply_phase,
      resolution,
      input.transitionTime,
      `Completion terminalized by canonical run ${terminalRunStatus}`,
      JSON.stringify({ terminalRunStatus }),
    ],
  );
  if (rows.length !== 1 || rows[0]?.request_id !== requestId) {
    throw new Error("RUN_TERMINAL_COMPLETION_CAS_LOST");
  }
  const reread = await sql.unsafe<RuntimeCompletionRow[]>(
    "SELECT * FROM runtime_completion_requests WHERE request_id = $1 FOR UPDATE",
    [requestId],
  );
  if (
    reread.length !== 1
    || reread[0]?.request_id !== requestId
    || reread[0]?.run_id !== input.runId
    || reread[0]?.state !== resolution
    || reread[0]?.apply_phase !== stored.apply_phase
  ) throw new Error("RUN_TERMINAL_COMPLETION_REREAD_INVALID");
  return requestId;
}

/** Canonical run terminalization rejects any completion proposal it preempted. */
export async function rejectRuntimeCompletionsForTerminalRunInTransaction(
  sql: TransactionSql,
  input: Readonly<{ runId: string; diagnostic: string }>,
): Promise<number> {
  await sql.unsafe("SELECT id FROM runs WHERE id = $1 FOR UPDATE", [input.runId]);
  const candidates = await sql.unsafe<Array<{ request_id: string; state: string }>>(
    `SELECT request_id,state
       FROM runtime_completion_requests
      WHERE run_id = $1
        AND state IN ('requested', 'draining')
      ORDER BY request_id
      FOR UPDATE`,
    [input.runId],
  );
  if (candidates.length === 0) return 0;
  const wallClock = await readDatabaseWallClock(
    sql,
    "RUNTIME_COMPLETION_DATABASE_WALL_CLOCK_UNAVAILABLE",
  );
  const rows = await sql.unsafe<Array<{ request_id: string }>>(
    `UPDATE runtime_completion_requests
        SET state = 'rejected', rejected_at = $2,
            lease_expires_at = NULL, diagnostic = $3, updated_at = $2
      WHERE run_id = $1
        AND state IN ('requested', 'draining')
        AND request_id = ANY($4::text[])
      RETURNING request_id`,
    [
      input.runId,
      wallClock,
      input.diagnostic.slice(0, 4_000),
      candidates.map((candidate) => candidate.request_id),
    ],
  );
  if (rows.length !== candidates.length) {
    throw new Error("RUNTIME_COMPLETION_TERMINAL_REJECT_CAS_LOST");
  }
  const updated = new Set(rows.map((row) => row.request_id));
  for (const candidate of candidates) {
    if (!updated.has(candidate.request_id)) {
      throw new Error("RUNTIME_COMPLETION_TERMINAL_REJECT_CAS_LOST");
    }
    if (candidate.state === "requested") {
      await closeCompletionOwnerIfPresentAfterTerminalMutationV1(sql, candidate.request_id);
    } else {
      await closeCompletionOwnerAfterTerminalMutationV1(sql, candidate.request_id);
    }
  }
  return rows.length;
}
