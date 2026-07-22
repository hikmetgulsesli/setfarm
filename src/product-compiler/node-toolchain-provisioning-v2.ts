import { spawn } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import {
  chmodSync,
  chownSync,
  closeSync,
  constants,
  fchmodSync,
  fchownSync,
  fstatSync,
  fsyncSync,
  linkSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  readdirSync,
  readSync,
  rmdirSync,
  unlinkSync,
  writeSync,
  type Stats,
} from "node:fs";
import path from "node:path";
import { isProxy } from "node:util/types";

import { canonicalJsonBytes, hashCanonicalJson } from "./canonical-json.js";
import {
  copyMaterializedNodeToolchainPrivateTreeBundleV2,
  inspectNodeToolchainPrivateTreeReceiptV2,
  type MaterializedNodeToolchainPrivateTreeV2,
  type NodeToolchainPrivateTreeBundleEntryV2,
  type NodeToolchainPrivateTreeBundleV2,
} from "./node-toolchain-private-tree-v2.js";
import {
  NODE_TOOLCHAIN_PROVISIONING_LOCK_BASENAME_V2,
  NODE_TOOLCHAIN_PROVISIONING_STAGING_BASENAME_V2,
  NODE_TOOLCHAIN_ROOT_PARENT_V2,
  getCodeOwnedNodeToolchainTargetV2,
  hashNodeToolchainOperationalLocatorV2,
  type NodeToolchainTargetV2,
} from "./node-toolchain-target-registry-v2.js";
import {
  NODE_TOOLCHAIN_PROVISIONING_AUTHORITY_REF_V2,
  NODE_TOOLCHAIN_PROVISIONING_CLAIM_V2_SCHEMA,
  NODE_TOOLCHAIN_PROVISIONING_INTENT_V2_SCHEMA,
  NODE_TOOLCHAIN_PROVISIONING_RECEIPT_V2_SCHEMA,
  NODE_TOOLCHAIN_PROVISIONING_VERSION_V2,
  NodeToolchainProvisioningClaimV2Schema,
  NodeToolchainProvisioningIntentV2Schema,
  NodeToolchainProvisioningReceiptV2Schema,
  hashNodeToolchainProvisioningClaimV2,
  hashNodeToolchainProvisioningIntentV2,
  hashNodeToolchainProvisioningReceiptV2,
  type NodeToolchainProvisioningClaimV2,
  type NodeToolchainProvisioningIntentHashPayloadV2,
  type NodeToolchainProvisioningIntentV2,
  type NodeToolchainProvisioningReceiptHashPayloadV2,
  type NodeToolchainProvisioningReceiptV2,
} from "./schemas/node-toolchain-provisioning-v2.js";

const LOCKF_PATH_V2 = "/usr/bin/lockf" as const;
const LOCK_HELPER_PATH_V2 = "/bin/cat" as const;
const LOCK_FILE_BYTES_V2 = Buffer.from("setfarm.node-toolchain-provisioning-lock.v2\n", "utf8");
const LOCK_ACQUISITION_TIMEOUT_SECONDS_V2 = 10;
const LOCK_PROTOCOL_TIMEOUT_MS_V2 = 12_000;
const CANONICAL_FILE_MAX_BYTES_V2 = 1024 * 1024;
const MAX_TOOL_BYTES_V2 = 4 * 1024 * 1024;
const MAX_TREE_DEPTH_V2 = 64;

type AdmissionScopeV2 = "production_root" | "test_fixture";

export type NodeToolchainProvisioningErrorCodeV2 =
  | "NODE_TOOLCHAIN_PROVISIONING_V2_INPUT_INVALID"
  | "NODE_TOOLCHAIN_PROVISIONING_V2_PLATFORM_UNSUPPORTED"
  | "NODE_TOOLCHAIN_PROVISIONING_V2_ROOT_PRIVILEGE_REQUIRED"
  | "NODE_TOOLCHAIN_PROVISIONING_V2_PARENT_INVALID"
  | "NODE_TOOLCHAIN_PROVISIONING_V2_LOCK_TOOL_INVALID"
  | "NODE_TOOLCHAIN_PROVISIONING_V2_LOCK_TIMEOUT"
  | "NODE_TOOLCHAIN_PROVISIONING_V2_LOCK_LOST"
  | "NODE_TOOLCHAIN_PROVISIONING_V2_INTENT_INVALID"
  | "NODE_TOOLCHAIN_PROVISIONING_V2_CLAIM_CONFLICT"
  | "NODE_TOOLCHAIN_PROVISIONING_V2_STAGE_INVALID"
  | "NODE_TOOLCHAIN_PROVISIONING_V2_FINAL_ROOT_CONFLICT"
  | "NODE_TOOLCHAIN_PROVISIONING_V2_FINAL_TREE_INVALID"
  | "NODE_TOOLCHAIN_PROVISIONING_V2_RECEIPT_CONFLICT"
  | "NODE_TOOLCHAIN_PROVISIONING_V2_RECEIPT_INVALID"
  | "NODE_TOOLCHAIN_PROVISIONING_V2_HANDLE_UNAUTHENTICATED"
  | "NODE_TOOLCHAIN_PROVISIONING_V2_HOST_DRIFT";

export class NodeToolchainProvisioningErrorV2 extends Error {
  readonly code: NodeToolchainProvisioningErrorCodeV2;
  override readonly cause?: unknown;

  constructor(
    code: NodeToolchainProvisioningErrorCodeV2,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message.slice(0, 1_500), options);
    this.name = "NodeToolchainProvisioningErrorV2";
    this.code = code;
    this.cause = options?.cause;
  }
}

type FingerprintV2 = Readonly<{
  device: number;
  inode: number;
  mode: number;
  ownerUid: number;
  ownerGid: number;
  linkCount: number;
  byteLength: number;
  modifiedMs: number;
  changedMs: number;
}>;

type ExactSystemToolRefV2 = "MACOS_LOCKF_V2" | "MACOS_CAT_LOCK_HELPER_V2";

type ExactSystemToolV2<RefV2 extends ExactSystemToolRefV2 = ExactSystemToolRefV2> = Readonly<{
  toolRef: RefV2;
  contentHash: string;
  byteLength: number;
  mode: "0755";
  ownerUid: 0;
  ownerGid: number;
  linkCount: 1;
  fingerprint: FingerprintV2;
}>;

type PublicationPathsV2 = Readonly<{
  parent: string;
  root: string;
  receipt: string;
  claim: string;
  lock: string;
  staging: string;
  treeStage: string;
  claimStage: string;
  receiptStage: string;
}>;

type ExpectedOwnerV2 = Readonly<{ uid: number; gid: number }>;

type ProvisioningTestHooksV2 = Readonly<{
  afterClaimLink?: () => void;
  afterClaim?: () => void | Promise<void>;
  afterStage?: () => void | Promise<void>;
  afterRootCreate?: () => void | Promise<void>;
  afterFileLink?: (input: Readonly<{ locator: string; linkedCount: number }>) => void | Promise<void>;
  afterRootVerify?: () => void | Promise<void>;
  afterReceiptLink?: () => void;
  afterReceiptPublish?: () => void | Promise<void>;
}>;

type ProvisionedStateV2 = Readonly<{
  paths: PublicationPathsV2;
  expectedOwner: ExpectedOwnerV2;
  parentMode: 0o700 | 0o755;
  parentFingerprint: FingerprintV2;
  stagingFingerprint: FingerprintV2;
  stagingInspection: "require_empty" | "root_private_metadata_only";
  receipt: NodeToolchainProvisioningReceiptV2;
  receiptFingerprint: FingerprintV2;
  rootFingerprint: FingerprintV2;
  expectedEntries: readonly NodeToolchainPrivateTreeBundleEntryV2[];
}>;

const handleConstructorCapabilityV2 = Object.freeze({});
const provisionedStateV2 = new WeakMap<object, ProvisionedStateV2>();

export class ProvisionedNodeToolchainV2 {
  readonly receiptHash: string;

  constructor(capability: object, state: ProvisionedStateV2) {
    if (capability !== handleConstructorCapabilityV2) {
      throw new NodeToolchainProvisioningErrorV2(
        "NODE_TOOLCHAIN_PROVISIONING_V2_HANDLE_UNAUTHENTICATED",
        "Provisioned Node toolchain constructor capability is unavailable",
      );
    }
    this.receiptHash = state.receipt.receiptHash;
    provisionedStateV2.set(this, state);
    Object.freeze(this);
  }
}

function fail(
  code: NodeToolchainProvisioningErrorCodeV2,
  message: string,
  cause?: unknown,
): never {
  throw new NodeToolchainProvisioningErrorV2(
    code,
    message,
    cause === undefined ? undefined : { cause },
  );
}

function isNodeError(error: unknown, code: string): boolean {
  return error instanceof Error && "code" in error && error.code === code;
}

function isWrappedNodeError(error: unknown, code: string): boolean {
  return isNodeError(error, code)
    || (error instanceof NodeToolchainProvisioningErrorV2 && isNodeError(error.cause, code));
}

function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function fingerprint(stat: Stats): FingerprintV2 {
  return Object.freeze({
    device: stat.dev,
    inode: stat.ino,
    mode: stat.mode,
    ownerUid: stat.uid,
    ownerGid: stat.gid,
    linkCount: stat.nlink,
    byteLength: stat.size,
    modifiedMs: stat.mtimeMs,
    changedMs: stat.ctimeMs,
  });
}

function sameFingerprint(left: FingerprintV2, right: FingerprintV2): boolean {
  return left.device === right.device
    && left.inode === right.inode
    && left.mode === right.mode
    && left.ownerUid === right.ownerUid
    && left.ownerGid === right.ownerGid
    && left.linkCount === right.linkCount
    && left.byteLength === right.byteLength
    && left.modifiedMs === right.modifiedMs
    && left.changedMs === right.changedMs;
}

function samePhysicalIdentity(left: FingerprintV2, right: FingerprintV2): boolean {
  return left.device === right.device && left.inode === right.inode;
}

function modeBits(stat: Stats | FingerprintV2): number {
  return stat.mode & 0o7777;
}

function deepFreezeJson<T>(value: T): T {
  if (value === null || typeof value !== "object") return value;
  const pending: object[] = [value as object];
  while (pending.length > 0) {
    const current = pending.pop()!;
    if (Object.isFrozen(current)) continue;
    for (const child of Object.values(current)) {
      if (child !== null && typeof child === "object" && !Object.isFrozen(child)) pending.push(child);
    }
    Object.freeze(current);
  }
  return value;
}

function defensiveReceiptCopy(
  receipt: NodeToolchainProvisioningReceiptV2,
): NodeToolchainProvisioningReceiptV2 {
  return deepFreezeJson(structuredClone(receipt));
}

function closeQuietly(descriptor: number | undefined): void {
  if (descriptor === undefined) return;
  try {
    closeSync(descriptor);
  } catch {
    // The primary typed failure remains authoritative.
  }
}

function syncDirectory(absolutePath: string): void {
  const descriptor = openSync(
    absolutePath,
    constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW | constants.O_NONBLOCK,
  );
  try {
    fsyncSync(descriptor);
  } finally {
    closeSync(descriptor);
  }
}

function stableFileHash(input: Readonly<{
  absolutePath: string;
  maxBytes: number;
  expectedOwner?: ExpectedOwnerV2;
  allowedModes?: readonly number[];
  allowedLinks?: readonly number[];
  errorCode: NodeToolchainProvisioningErrorCodeV2;
}>): Readonly<{ fingerprint: FingerprintV2; contentHash: string }> {
  let descriptor: number | undefined;
  try {
    const pathBefore = lstatSync(input.absolutePath);
    if (
      pathBefore.isSymbolicLink()
      || !pathBefore.isFile()
      || !Number.isSafeInteger(pathBefore.size)
      || pathBefore.size < 0
      || pathBefore.size > input.maxBytes
      || (input.expectedOwner
        && (pathBefore.uid !== input.expectedOwner.uid || pathBefore.gid !== input.expectedOwner.gid))
      || (input.allowedModes && !input.allowedModes.includes(modeBits(pathBefore)))
      || (input.allowedLinks && !input.allowedLinks.includes(pathBefore.nlink))
    ) {
      return fail(input.errorCode, "Provisioning file is not one exact bounded ordinary file");
    }
    descriptor = openSync(
      input.absolutePath,
      constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK,
    );
    const before = fstatSync(descriptor);
    if (!sameFingerprint(fingerprint(pathBefore), fingerprint(before))) {
      return fail(input.errorCode, "Provisioning file changed before its exact read");
    }
    const hash = createHash("sha256");
    const buffer = Buffer.allocUnsafe(64 * 1024);
    let total = 0;
    while (true) {
      const count = readSync(descriptor, buffer, 0, buffer.length, null);
      if (count === 0) break;
      total += count;
      if (total > input.maxBytes) return fail(input.errorCode, "Provisioning file exceeded its read bound");
      hash.update(buffer.subarray(0, count));
    }
    const after = fstatSync(descriptor);
    const pathAfter = lstatSync(input.absolutePath);
    if (
      total !== before.size
      || !sameFingerprint(fingerprint(before), fingerprint(after))
      || !sameFingerprint(fingerprint(after), fingerprint(pathAfter))
    ) {
      return fail(input.errorCode, "Provisioning file changed during its exact read");
    }
    return Object.freeze({ fingerprint: fingerprint(after), contentHash: hash.digest("hex") });
  } catch (error) {
    if (error instanceof NodeToolchainProvisioningErrorV2) throw error;
    return fail(input.errorCode, "Provisioning file could not be captured exactly", error);
  } finally {
    closeQuietly(descriptor);
  }
}

function stableFileBytes(input: Readonly<{
  absolutePath: string;
  maxBytes: number;
  expectedOwner: ExpectedOwnerV2;
  allowedModes: readonly number[];
  allowedLinks: readonly number[];
  errorCode: NodeToolchainProvisioningErrorCodeV2;
}>): Readonly<{ fingerprint: FingerprintV2; bytes: Buffer }> {
  const hashed = stableFileHash(input);
  const bytes = readFileSync(input.absolutePath);
  const after = stableFileHash(input);
  if (
    !sameFingerprint(hashed.fingerprint, after.fingerprint)
    || sha256(bytes) !== hashed.contentHash
    || bytes.byteLength !== hashed.fingerprint.byteLength
  ) {
    bytes.fill(0);
    return fail(input.errorCode, "Provisioning canonical file changed during its bounded read");
  }
  return Object.freeze({ fingerprint: after.fingerprint, bytes });
}

function captureSystemTool<RefV2 extends ExactSystemToolRefV2>(
  absolutePath: typeof LOCKF_PATH_V2 | typeof LOCK_HELPER_PATH_V2,
  toolRef: RefV2,
): ExactSystemToolV2<RefV2> {
  const captured = stableFileHash({
    absolutePath,
    maxBytes: MAX_TOOL_BYTES_V2,
    expectedOwner: { uid: 0, gid: lstatSync(absolutePath).gid },
    allowedModes: [0o755],
    allowedLinks: [1],
    errorCode: "NODE_TOOLCHAIN_PROVISIONING_V2_LOCK_TOOL_INVALID",
  });
  if (captured.fingerprint.ownerUid !== 0 || modeBits(captured.fingerprint) !== 0o755) {
    return fail(
      "NODE_TOOLCHAIN_PROVISIONING_V2_LOCK_TOOL_INVALID",
      "Provisioning lock tool is not exact root-owned executable authority",
    );
  }
  return Object.freeze({
    toolRef,
    contentHash: captured.contentHash,
    byteLength: captured.fingerprint.byteLength,
    mode: "0755",
    ownerUid: 0,
    ownerGid: captured.fingerprint.ownerGid,
    linkCount: 1,
    fingerprint: captured.fingerprint,
  });
}

function exactSystemToolReceipt<RefV2 extends ExactSystemToolRefV2>(tool: ExactSystemToolV2<RefV2>) {
  const { fingerprint: _fingerprint, ...receipt } = tool;
  return Object.freeze(receipt);
}

function assertSystemToolCurrent(
  absolutePath: typeof LOCKF_PATH_V2 | typeof LOCK_HELPER_PATH_V2,
  expected: ExactSystemToolV2,
): void {
  const current = captureSystemTool(absolutePath, expected.toolRef);
  if (
    current.contentHash !== expected.contentHash
    || !sameFingerprint(current.fingerprint, expected.fingerprint)
  ) {
    fail("NODE_TOOLCHAIN_PROVISIONING_V2_LOCK_LOST", "Provisioning lock tool changed while held");
  }
}

function assertDirectory(input: Readonly<{
  absolutePath: string;
  expectedOwner: ExpectedOwnerV2;
  allowedModes: readonly number[];
  errorCode: NodeToolchainProvisioningErrorCodeV2;
}>): FingerprintV2 {
  try {
    const stat = lstatSync(input.absolutePath);
    if (
      stat.isSymbolicLink()
      || !stat.isDirectory()
      || stat.uid !== input.expectedOwner.uid
      || stat.gid !== input.expectedOwner.gid
      || !input.allowedModes.includes(modeBits(stat))
    ) {
      return fail(input.errorCode, "Provisioning directory identity is invalid");
    }
    return fingerprint(stat);
  } catch (error) {
    if (error instanceof NodeToolchainProvisioningErrorV2) throw error;
    return fail(input.errorCode, "Provisioning directory could not be inspected", error);
  }
}

function assertRootOwnedSystemDirectory(input: Readonly<{
  absolutePath: string;
  allowedModes: readonly number[];
  errorCode: NodeToolchainProvisioningErrorCodeV2;
}>): FingerprintV2 {
  try {
    const stat = lstatSync(input.absolutePath);
    if (
      stat.isSymbolicLink()
      || !stat.isDirectory()
      || stat.uid !== 0
      || !input.allowedModes.includes(modeBits(stat))
    ) {
      return fail(input.errorCode, "Root-owned system directory identity is invalid");
    }
    return fingerprint(stat);
  } catch (error) {
    if (error instanceof NodeToolchainProvisioningErrorV2) throw error;
    return fail(input.errorCode, "Root-owned system directory could not be inspected", error);
  }
}

function createOwnedDirectory(input: Readonly<{
  absolutePath: string;
  mode: number;
  expectedOwner: ExpectedOwnerV2;
  errorCode: NodeToolchainProvisioningErrorCodeV2;
}>): FingerprintV2 {
  try {
    mkdirSync(input.absolutePath, { mode: input.mode });
    if (typeof process.geteuid === "function" && process.geteuid() === 0) {
      chownSync(input.absolutePath, input.expectedOwner.uid, input.expectedOwner.gid);
    }
    chmodSync(input.absolutePath, input.mode);
    return assertDirectory({
      absolutePath: input.absolutePath,
      expectedOwner: input.expectedOwner,
      allowedModes: [input.mode],
      errorCode: input.errorCode,
    });
  } catch (error) {
    if (error instanceof NodeToolchainProvisioningErrorV2) throw error;
    return fail(input.errorCode, "Provisioning directory could not be created exclusively", error);
  }
}

function writeExclusiveFile(input: Readonly<{
  absolutePath: string;
  bytes: Uint8Array;
  mode: number;
  expectedOwner: ExpectedOwnerV2;
  errorCode: NodeToolchainProvisioningErrorCodeV2;
}>): FingerprintV2 {
  let descriptor: number | undefined;
  try {
    descriptor = openSync(
      input.absolutePath,
      constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW,
      0o600,
    );
    if (typeof process.geteuid === "function" && process.geteuid() === 0) {
      fchownSync(descriptor, input.expectedOwner.uid, input.expectedOwner.gid);
    }
    let offset = 0;
    while (offset < input.bytes.byteLength) {
      const count = writeSync(descriptor, input.bytes, offset, input.bytes.byteLength - offset);
      if (count < 1) return fail(input.errorCode, "Provisioning file write made no progress");
      offset += count;
    }
    fchmodSync(descriptor, input.mode);
    fsyncSync(descriptor);
    const stat = fstatSync(descriptor);
    if (
      !stat.isFile()
      || stat.nlink !== 1
      || stat.uid !== input.expectedOwner.uid
      || stat.gid !== input.expectedOwner.gid
      || modeBits(stat) !== input.mode
      || stat.size !== input.bytes.byteLength
    ) {
      return fail(input.errorCode, "Provisioning file write lost its exact identity");
    }
    return fingerprint(stat);
  } catch (error) {
    if (error instanceof NodeToolchainProvisioningErrorV2) throw error;
    return fail(input.errorCode, "Provisioning file could not be written exclusively", error);
  } finally {
    closeQuietly(descriptor);
  }
}

function optionalFingerprint(absolutePath: string): FingerprintV2 | undefined {
  try {
    return fingerprint(lstatSync(absolutePath));
  } catch (error) {
    if (isNodeError(error, "ENOENT")) return undefined;
    throw error;
  }
}

function expectedOwnerForCurrentProcess(): ExpectedOwnerV2 {
  const uid = typeof process.geteuid === "function" ? process.geteuid() : undefined;
  const gid = typeof process.getegid === "function" ? process.getegid() : undefined;
  if (uid === undefined || gid === undefined) {
    return fail(
      "NODE_TOOLCHAIN_PROVISIONING_V2_PLATFORM_UNSUPPORTED",
      "Node toolchain provisioning requires POSIX effective identity APIs",
    );
  }
  return Object.freeze({ uid, gid });
}

function assertProductionSystemAncestor(): void {
  const applicationSupport = "/Library/Application Support";
  assertRootOwnedSystemDirectory({
    absolutePath: applicationSupport,
    allowedModes: [0o755],
    errorCode: "NODE_TOOLCHAIN_PROVISIONING_V2_PARENT_INVALID",
  });
}

function inspectProductionParent(): ExpectedOwnerV2 {
  if (process.platform !== "darwin") {
    return fail(
      "NODE_TOOLCHAIN_PROVISIONING_V2_PLATFORM_UNSUPPORTED",
      "Production Node toolchain authority currently supports Darwin only",
    );
  }
  assertProductionSystemAncestor();
  const expectedOwner = Object.freeze({ uid: 0, gid: 0 });
  const setfarmRoot = path.dirname(NODE_TOOLCHAIN_ROOT_PARENT_V2);
  for (const target of [setfarmRoot, NODE_TOOLCHAIN_ROOT_PARENT_V2]) {
    assertDirectory({
      absolutePath: target,
      expectedOwner,
      allowedModes: [0o755],
      errorCode: "NODE_TOOLCHAIN_PROVISIONING_V2_PARENT_INVALID",
    });
  }
  return expectedOwner;
}

function ensureProductionParent(): ExpectedOwnerV2 {
  if (process.platform !== "darwin") {
    return fail(
      "NODE_TOOLCHAIN_PROVISIONING_V2_PLATFORM_UNSUPPORTED",
      "Production Node toolchain provisioning currently supports Darwin only",
    );
  }
  if (typeof process.geteuid !== "function" || process.geteuid() !== 0) {
    return fail(
      "NODE_TOOLCHAIN_PROVISIONING_V2_ROOT_PRIVILEGE_REQUIRED",
      "Production Node toolchain provisioning requires effective UID 0",
    );
  }
  const expectedOwner = Object.freeze({ uid: 0, gid: 0 });
  assertProductionSystemAncestor();
  const setfarmRoot = path.dirname(NODE_TOOLCHAIN_ROOT_PARENT_V2);
  for (const target of [setfarmRoot, NODE_TOOLCHAIN_ROOT_PARENT_V2]) {
    if (!optionalFingerprint(target)) {
      try {
        createOwnedDirectory({
          absolutePath: target,
          mode: 0o755,
          expectedOwner,
          errorCode: "NODE_TOOLCHAIN_PROVISIONING_V2_PARENT_INVALID",
        });
        syncDirectory(path.dirname(target));
      } catch (error) {
        if (!isWrappedNodeError(error, "EEXIST")) throw error;
      }
    }
    assertDirectory({
      absolutePath: target,
      expectedOwner,
      allowedModes: [0o755],
      errorCode: "NODE_TOOLCHAIN_PROVISIONING_V2_PARENT_INVALID",
    });
  }
  return expectedOwner;
}

function testParent(input: string): Readonly<{ parent: string; expectedOwner: ExpectedOwnerV2 }> {
  if (
    typeof input !== "string"
    || !path.isAbsolute(input)
    || path.normalize(input) !== input
    || input.includes("\0")
  ) {
    return fail(
      "NODE_TOOLCHAIN_PROVISIONING_V2_INPUT_INVALID",
      "Test provisioning parent must be one normalized absolute path",
    );
  }
  const expectedOwner = expectedOwnerForCurrentProcess();
  assertDirectory({
    absolutePath: input,
    expectedOwner,
    allowedModes: [0o700],
    errorCode: "NODE_TOOLCHAIN_PROVISIONING_V2_PARENT_INVALID",
  });
  return Object.freeze({ parent: input, expectedOwner });
}

function publicationPaths(input: Readonly<{
  parent: string;
  target: NodeToolchainTargetV2;
  intentHash?: string;
}>): PublicationPathsV2 {
  const root = path.join(input.parent, input.target.rootBasename);
  const receipt = path.join(input.parent, input.target.receiptBasename);
  const claim = path.join(input.parent, input.target.claimBasename);
  const lock = path.join(input.parent, NODE_TOOLCHAIN_PROVISIONING_LOCK_BASENAME_V2);
  const staging = path.join(input.parent, NODE_TOOLCHAIN_PROVISIONING_STAGING_BASENAME_V2);
  const stageKey = input.intentHash ?? "pending";
  return Object.freeze({
    parent: input.parent,
    root,
    receipt,
    claim,
    lock,
    staging,
    treeStage: path.join(staging, `${stageKey}.tree`),
    claimStage: path.join(staging, `${stageKey}.claim.tmp`),
    receiptStage: path.join(staging, `${stageKey}.receipt.tmp`),
  });
}

function assertStagingCensus(input: Readonly<{
  paths: PublicationPathsV2;
  expectedOwner: ExpectedOwnerV2;
  allowCurrentIntentArtifacts: boolean;
  errorCode: NodeToolchainProvisioningErrorCodeV2;
}>): readonly string[] {
  try {
    const before = assertDirectory({
      absolutePath: input.paths.staging,
      expectedOwner: input.expectedOwner,
      allowedModes: [0o700],
      errorCode: input.errorCode,
    });
    const names = readdirSync(input.paths.staging).sort();
    const after = assertDirectory({
      absolutePath: input.paths.staging,
      expectedOwner: input.expectedOwner,
      allowedModes: [0o700],
      errorCode: input.errorCode,
    });
    const allowed = input.allowCurrentIntentArtifacts
      ? new Set([
          path.basename(input.paths.treeStage),
          path.basename(input.paths.claimStage),
          path.basename(input.paths.receiptStage),
        ])
      : new Set<string>();
    if (
      !sameFingerprint(before, after)
      || names.length > allowed.size
      || names.some((name) => !allowed.has(name))
    ) {
      return fail(
        input.errorCode,
        input.allowCurrentIntentArtifacts
          ? "Provisioning staging root contains an artifact outside the exact current intent"
          : "Ready provisioning staging root is not empty",
      );
    }
    return Object.freeze(names);
  } catch (error) {
    if (error instanceof NodeToolchainProvisioningErrorV2) throw error;
    return fail(input.errorCode, "Provisioning staging census could not be reproduced", error);
  }
}

async function ensureLockAndStaging(
  paths: PublicationPathsV2,
  expectedOwner: ExpectedOwnerV2,
): Promise<void> {
  const existingLock = optionalFingerprint(paths.lock);
  if (!existingLock) {
    try {
      writeExclusiveFile({
        absolutePath: paths.lock,
        bytes: LOCK_FILE_BYTES_V2,
        mode: 0o600,
        expectedOwner,
        errorCode: "NODE_TOOLCHAIN_PROVISIONING_V2_PARENT_INVALID",
      });
      syncDirectory(paths.parent);
    } catch (error) {
      if (!isWrappedNodeError(error, "EEXIST")) throw error;
    }
  }
  let lock: ReturnType<typeof stableFileBytes> | undefined;
  for (let attempt = 0; attempt < 100 && !lock; attempt += 1) {
    try {
      lock = stableFileBytes({
        absolutePath: paths.lock,
        maxBytes: LOCK_FILE_BYTES_V2.byteLength,
        expectedOwner,
        allowedModes: [0o600],
        allowedLinks: [1],
        errorCode: "NODE_TOOLCHAIN_PROVISIONING_V2_PARENT_INVALID",
      });
    } catch (error) {
      if (attempt === 99) throw error;
      await new Promise<void>((resolve) => setTimeout(resolve, 10));
    }
  }
  if (!lock) {
    return fail(
      "NODE_TOOLCHAIN_PROVISIONING_V2_PARENT_INVALID",
      "Provisioning lock descriptor did not become stable",
    );
  }
  try {
    if (!lock.bytes.equals(LOCK_FILE_BYTES_V2)) {
      return fail(
        "NODE_TOOLCHAIN_PROVISIONING_V2_PARENT_INVALID",
        "Provisioning kernel-lock descriptor has foreign canonical bytes",
      );
    }
  } finally {
    lock.bytes.fill(0);
  }
  if (!optionalFingerprint(paths.staging)) {
    try {
      createOwnedDirectory({
        absolutePath: paths.staging,
        mode: 0o700,
        expectedOwner,
        errorCode: "NODE_TOOLCHAIN_PROVISIONING_V2_PARENT_INVALID",
      });
      syncDirectory(paths.parent);
    } catch (error) {
      if (!isWrappedNodeError(error, "EEXIST")) throw error;
    }
  }
  assertDirectory({
    absolutePath: paths.staging,
    expectedOwner,
    allowedModes: [0o700],
    errorCode: "NODE_TOOLCHAIN_PROVISIONING_V2_PARENT_INVALID",
  });
}

type KernelLeaseV2 = Readonly<{
  lockf: ExactSystemToolV2<"MACOS_LOCKF_V2">;
  lockHelper: ExactSystemToolV2<"MACOS_CAT_LOCK_HELPER_V2">;
  assertCurrent: () => void;
  release: () => Promise<void>;
}>;

async function waitForChildExit(
  child: ReturnType<typeof spawn>,
  timeoutMs = 5_000,
): Promise<void> {
  if (child.exitCode !== null || child.signalCode !== null) return;
  await new Promise<void>((resolve, reject) => {
    let settled = false;
    const finish = (error?: Error): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      child.off("close", onClose);
      child.off("error", onError);
      if (error) reject(error);
      else resolve();
    };
    const onClose = () => finish();
    const onError = (error: Error) => finish(error);
    const timer = setTimeout(() => finish(new Error("lock helper exit timeout")), timeoutMs);
    child.once("close", onClose);
    child.once("error", onError);
  });
}

async function acquireKernelLease(
  paths: PublicationPathsV2,
  expectedOwner: ExpectedOwnerV2,
): Promise<KernelLeaseV2> {
  if (process.platform !== "darwin") {
    return fail(
      "NODE_TOOLCHAIN_PROVISIONING_V2_PLATFORM_UNSUPPORTED",
      "Node toolchain provisioning lock requires Darwin /usr/bin/lockf",
    );
  }
  const lockf = captureSystemTool(LOCKF_PATH_V2, "MACOS_LOCKF_V2");
  const lockHelper = captureSystemTool(LOCK_HELPER_PATH_V2, "MACOS_CAT_LOCK_HELPER_V2");
  const expectedParent = assertDirectory({
    absolutePath: paths.parent,
    expectedOwner,
    allowedModes: expectedOwner.uid === 0 ? [0o755] : [0o700],
    errorCode: "NODE_TOOLCHAIN_PROVISIONING_V2_PARENT_INVALID",
  });
  const expectedStaging = assertDirectory({
    absolutePath: paths.staging,
    expectedOwner,
    allowedModes: [0o700],
    errorCode: "NODE_TOOLCHAIN_PROVISIONING_V2_PARENT_INVALID",
  });
  const expectedLock = stableFileHash({
    absolutePath: paths.lock,
    maxBytes: LOCK_FILE_BYTES_V2.byteLength,
    expectedOwner,
    allowedModes: [0o600],
    allowedLinks: [1],
    errorCode: "NODE_TOOLCHAIN_PROVISIONING_V2_PARENT_INVALID",
  }).fingerprint;
  let descriptor: number | undefined;
  let child: ReturnType<typeof spawn> | undefined;
  try {
    descriptor = openSync(paths.lock, constants.O_RDWR | constants.O_NOFOLLOW | constants.O_NONBLOCK);
    if (!sameFingerprint(fingerprint(fstatSync(descriptor)), expectedLock)) {
      return fail("NODE_TOOLCHAIN_PROVISIONING_V2_LOCK_LOST", "Provisioning lock changed while opened");
    }
    const token = `setfarm-node-toolchain-lock:${randomUUID()}\n`;
    child = spawn(LOCKF_PATH_V2, [
      "-s",
      "-t",
      String(LOCK_ACQUISITION_TIMEOUT_SECONDS_V2),
      "/dev/fd/3",
      LOCK_HELPER_PATH_V2,
    ], {
      env: { LANG: "C", LC_ALL: "C", TZ: "UTC" },
      shell: false,
      stdio: ["pipe", "pipe", "pipe", descriptor],
      windowsHide: true,
    });
    let stdinError: Error | undefined;
    child.stdin!.on("error", (error) => { stdinError = error; });
    let stderr = "";
    child.stderr!.on("data", (chunk: Buffer) => {
      if (Buffer.byteLength(stderr, "utf8") <= 4_096) stderr += chunk.toString("utf8");
    });
    const readiness = await new Promise<"ready">((resolve, reject) => {
      let output = "";
      let settled = false;
      const finish = (error?: Error): void => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        child!.stdout!.off("data", onData);
        child!.off("close", onClose);
        child!.off("error", onError);
        if (error) reject(error);
        else resolve("ready");
      };
      const onData = (chunk: Buffer): void => {
        output += chunk.toString("utf8");
        if (output === token) finish();
        else if (output.length > token.length || !token.startsWith(output)) {
          finish(new Error("lock helper emitted non-canonical readiness output"));
        }
      };
      const onClose = (code: number | null, signal: NodeJS.Signals | null): void => {
        const error = code === 75 && signal === null
          ? new NodeToolchainProvisioningErrorV2(
              "NODE_TOOLCHAIN_PROVISIONING_V2_LOCK_TIMEOUT",
              "Provisioning kernel lock acquisition timed out",
            )
          : new NodeToolchainProvisioningErrorV2(
              "NODE_TOOLCHAIN_PROVISIONING_V2_LOCK_LOST",
              `Provisioning lock helper exited before readiness (${code ?? signal}); ${stderr}`,
            );
        finish(error);
      };
      const onError = (error: Error): void => finish(error);
      const timer = setTimeout(
        () => finish(new NodeToolchainProvisioningErrorV2(
          "NODE_TOOLCHAIN_PROVISIONING_V2_LOCK_TIMEOUT",
          "Provisioning lock readiness protocol timed out",
        )),
        LOCK_PROTOCOL_TIMEOUT_MS_V2,
      );
      child!.stdout!.on("data", onData);
      child!.once("close", onClose);
      child!.once("error", onError);
      child!.stdin!.write(token);
    });
    if (readiness !== "ready") {
      return fail("NODE_TOOLCHAIN_PROVISIONING_V2_LOCK_LOST", "Provisioning lock did not become ready");
    }
    closeSync(descriptor);
    descriptor = undefined;
    let released = false;
    const activeChild = child;
    const assertCurrent = (): void => {
      if (
        released
        || activeChild.exitCode !== null
        || activeChild.signalCode !== null
        || activeChild.stdin!.destroyed
        || stdinError
      ) {
        return fail("NODE_TOOLCHAIN_PROVISIONING_V2_LOCK_LOST", "Provisioning kernel lock is no longer held");
      }
      const current = stableFileHash({
        absolutePath: paths.lock,
        maxBytes: LOCK_FILE_BYTES_V2.byteLength,
        expectedOwner,
        allowedModes: [0o600],
        allowedLinks: [1],
        errorCode: "NODE_TOOLCHAIN_PROVISIONING_V2_LOCK_LOST",
      }).fingerprint;
      if (!sameFingerprint(current, expectedLock)) {
        return fail("NODE_TOOLCHAIN_PROVISIONING_V2_LOCK_LOST", "Provisioning lock identity changed while held");
      }
      const currentParent = assertDirectory({
        absolutePath: paths.parent,
        expectedOwner,
        allowedModes: expectedOwner.uid === 0 ? [0o755] : [0o700],
        errorCode: "NODE_TOOLCHAIN_PROVISIONING_V2_LOCK_LOST",
      });
      const currentStaging = assertDirectory({
        absolutePath: paths.staging,
        expectedOwner,
        allowedModes: [0o700],
        errorCode: "NODE_TOOLCHAIN_PROVISIONING_V2_LOCK_LOST",
      });
      if (
        !samePhysicalIdentity(currentParent, expectedParent)
        || !samePhysicalIdentity(currentStaging, expectedStaging)
      ) {
        return fail(
          "NODE_TOOLCHAIN_PROVISIONING_V2_LOCK_LOST",
          "Provisioning parent or staging root changed while the kernel lock was held",
        );
      }
    };
    const release = async (): Promise<void> => {
      if (released) return;
      released = true;
      activeChild.stdin!.end();
      await waitForChildExit(activeChild);
      if (activeChild.exitCode !== 0 || activeChild.signalCode !== null || stdinError) {
        return fail("NODE_TOOLCHAIN_PROVISIONING_V2_LOCK_LOST", "Provisioning lock helper exited abnormally");
      }
    };
    assertCurrent();
    assertSystemToolCurrent(LOCKF_PATH_V2, lockf);
    assertSystemToolCurrent(LOCK_HELPER_PATH_V2, lockHelper);
    return Object.freeze({ lockf, lockHelper, assertCurrent, release });
  } catch (error) {
    if (child && child.exitCode === null && child.signalCode === null) {
      child.stdin?.destroy();
      child.kill("SIGKILL");
      await waitForChildExit(child).catch(() => undefined);
    }
    if (error instanceof NodeToolchainProvisioningErrorV2) throw error;
    return fail("NODE_TOOLCHAIN_PROVISIONING_V2_LOCK_LOST", "Provisioning kernel lock failed", error);
  } finally {
    closeQuietly(descriptor);
  }
}

function canonicalTreeHash(entries: readonly NodeToolchainPrivateTreeBundleEntryV2[]): string {
  return hashCanonicalJson({
    schema: "setfarm.node-toolchain-normalized-private-tree.v2",
    entries: entries.map((entry) => ({
      locator: entry.locator,
      type: entry.type,
      mode: entry.mode,
      ...(entry.type === "file"
        ? { byteLength: entry.byteLength, contentHash: entry.contentHash }
        : {}),
    })),
  });
}

function canonicalNpmTreeHash(entries: readonly NodeToolchainPrivateTreeBundleEntryV2[]): string {
  const npmPrefix = "lib/node_modules/npm";
  const npmEntries = entries
    .filter((entry) => entry.locator === npmPrefix || entry.locator.startsWith(`${npmPrefix}/`))
    .map((entry) => ({
      ...entry,
      locator: entry.locator === npmPrefix ? "." : entry.locator.slice(npmPrefix.length + 1),
    }));
  return hashCanonicalJson({
    schema: "setfarm.node-toolchain-normalized-npm-tree.v2",
    entries: npmEntries.map((entry) => ({
      locator: entry.locator,
      type: entry.type,
      mode: entry.mode,
      ...(entry.type === "file"
        ? { byteLength: entry.byteLength, contentHash: entry.contentHash }
        : {}),
    })),
  });
}

function validateTreeLocator(locator: "." | string): void {
  const segments = locator === "." ? [] : locator.split("/");
  if (
    (locator !== "." && (segments.length < 1 || segments.length > MAX_TREE_DEPTH_V2))
    || segments.some((segment) => !/^[A-Za-z0-9._@+-]+$/.test(segment))
  ) {
    return fail(
      "NODE_TOOLCHAIN_PROVISIONING_V2_FINAL_TREE_INVALID",
      "Provisioned tree contains a non-canonical locator",
    );
  }
}

function discoverReadyTree(input: Readonly<{
  paths: PublicationPathsV2;
  expectedOwner: ExpectedOwnerV2;
  receipt: NodeToolchainProvisioningReceiptV2;
}>): Readonly<{
  root: FingerprintV2;
  entries: readonly NodeToolchainPrivateTreeBundleEntryV2[];
}> {
  const entries: NodeToolchainPrivateTreeBundleEntryV2[] = [];
  const casefoldLocators = new Map<string, string>();
  let fileCount = 0;
  let directoryCount = 0;
  let totalBytes = 0;

  const visit = (absoluteDirectory: string, locator: "." | string): void => {
    validateTreeLocator(locator);
    const before = assertDirectory({
      absolutePath: absoluteDirectory,
      expectedOwner: input.expectedOwner,
      allowedModes: [0o555],
      errorCode: "NODE_TOOLCHAIN_PROVISIONING_V2_FINAL_TREE_INVALID",
    });
    entries.push(Object.freeze({
      locator,
      type: "directory",
      mode: "0555",
      byteLength: 0,
      contentHash: null,
      bytes: null,
    }));
    if (locator !== ".") {
      directoryCount += 1;
      if (directoryCount > input.receipt.finalRoot.directoryCount) {
        return fail(
          "NODE_TOOLCHAIN_PROVISIONING_V2_FINAL_TREE_INVALID",
          "Provisioned tree exceeded its receipted directory bound",
        );
      }
    }
    const namesBefore = readdirSync(absoluteDirectory).sort();
    for (const name of namesBefore) {
      const childLocator = locator === "." ? name : `${locator}/${name}`;
      validateTreeLocator(childLocator);
      const folded = childLocator.toLowerCase();
      const prior = casefoldLocators.get(folded);
      if (prior !== undefined && prior !== childLocator) {
        return fail(
          "NODE_TOOLCHAIN_PROVISIONING_V2_FINAL_TREE_INVALID",
          "Provisioned tree contains a case-folding collision",
        );
      }
      casefoldLocators.set(folded, childLocator);
      const absoluteChild = path.join(absoluteDirectory, name);
      const child = lstatSync(absoluteChild);
      if (child.isDirectory() && !child.isSymbolicLink()) {
        visit(absoluteChild, childLocator);
        continue;
      }
      if (
        child.isSymbolicLink()
        || !child.isFile()
        || child.nlink !== 1
        || child.uid !== input.expectedOwner.uid
        || child.gid !== input.expectedOwner.gid
        || (modeBits(child) !== 0o444 && modeBits(child) !== 0o555)
      ) {
        return fail(
          "NODE_TOOLCHAIN_PROVISIONING_V2_FINAL_TREE_INVALID",
          "Provisioned tree contains a non-canonical file identity",
        );
      }
      fileCount += 1;
      if (fileCount > input.receipt.finalRoot.fileCount) {
        return fail(
          "NODE_TOOLCHAIN_PROVISIONING_V2_FINAL_TREE_INVALID",
          "Provisioned tree exceeded its receipted file bound",
        );
      }
      const captured = stableFileHash({
        absolutePath: absoluteChild,
        maxBytes: input.receipt.finalRoot.totalBytes,
        expectedOwner: input.expectedOwner,
        allowedModes: [0o444, 0o555],
        allowedLinks: [1],
        errorCode: "NODE_TOOLCHAIN_PROVISIONING_V2_FINAL_TREE_INVALID",
      });
      totalBytes += captured.fingerprint.byteLength;
      if (totalBytes > input.receipt.finalRoot.totalBytes) {
        return fail(
          "NODE_TOOLCHAIN_PROVISIONING_V2_FINAL_TREE_INVALID",
          "Provisioned tree exceeded its receipted byte bound",
        );
      }
      entries.push(Object.freeze({
        locator: childLocator,
        type: "file",
        mode: modeBits(captured.fingerprint) === 0o555 ? "0555" : "0444",
        byteLength: captured.fingerprint.byteLength,
        contentHash: captured.contentHash,
        bytes: null,
      }));
    }
    const after = assertDirectory({
      absolutePath: absoluteDirectory,
      expectedOwner: input.expectedOwner,
      allowedModes: [0o555],
      errorCode: "NODE_TOOLCHAIN_PROVISIONING_V2_FINAL_TREE_INVALID",
    });
    const namesAfter = readdirSync(absoluteDirectory).sort();
    if (
      !sameFingerprint(before, after)
      || namesBefore.length !== namesAfter.length
      || namesBefore.some((name, index) => name !== namesAfter[index])
    ) {
      return fail(
        "NODE_TOOLCHAIN_PROVISIONING_V2_FINAL_TREE_INVALID",
        "Provisioned tree changed during every-and-only discovery",
      );
    }
  };

  visit(input.paths.root, ".");
  entries.sort((left, right) => left.locator < right.locator ? -1 : left.locator > right.locator ? 1 : 0);
  const root = fingerprint(lstatSync(input.paths.root));
  const byLocator = new Map(entries.map((entry) => [entry.locator, entry]));
  const node = byLocator.get("bin/node");
  const npmCli = byLocator.get("lib/node_modules/npm/bin/npm-cli.js");
  const packageJson = byLocator.get("lib/node_modules/npm/package.json");
  if (
    fileCount !== input.receipt.finalRoot.fileCount
    || directoryCount !== input.receipt.finalRoot.directoryCount
    || totalBytes !== input.receipt.finalRoot.totalBytes
    || canonicalTreeHash(entries) !== input.receipt.finalRoot.treeHash
    || canonicalNpmTreeHash(entries) !== input.receipt.finalRoot.npmTreeHash
    || node?.type !== "file"
    || node.contentHash !== input.receipt.finalRoot.nodeContentHash
    || npmCli?.type !== "file"
    || npmCli.contentHash !== input.receipt.source.tree.npm.cli.contentHash
    || packageJson?.type !== "file"
    || packageJson.contentHash !== input.receipt.source.tree.npm.packageJson.contentHash
    || root.device !== input.receipt.finalRoot.device
    || root.inode !== input.receipt.finalRoot.inode
    || root.ownerUid !== input.receipt.finalRoot.ownerUid
    || root.ownerGid !== input.receipt.finalRoot.ownerGid
    || modeBits(root) !== 0o555
  ) {
    return fail(
      "NODE_TOOLCHAIN_PROVISIONING_V2_FINAL_TREE_INVALID",
      "Provisioned tree does not reproduce its durable receipt",
    );
  }
  return Object.freeze({ root, entries: Object.freeze(entries) });
}

function validateBundle(bundle: NodeToolchainPrivateTreeBundleV2): void {
  const entries = bundle.entries;
  const locators = entries.map((entry) => entry.locator);
  if (
    entries.length < 1
    || entries[0]?.locator !== "."
    || entries[0]?.type !== "directory"
    || new Set(locators).size !== locators.length
    || locators.some((locator, index) => index > 0 && locator <= locators[index - 1]!)
  ) {
    return fail(
      "NODE_TOOLCHAIN_PROVISIONING_V2_INPUT_INVALID",
      "Private tree bundle entries are not one canonical every-and-only list",
    );
  }
  let fileCount = 0;
  let directoryCount = 0;
  let totalBytes = 0;
  for (const entry of entries) {
    const segments = entry.locator === "." ? [] : entry.locator.split("/");
    if (
      (entry.locator !== "." && (segments.length < 1 || segments.length > MAX_TREE_DEPTH_V2))
      || segments.some((segment) => !/^[A-Za-z0-9._@+-]+$/.test(segment))
    ) {
      return fail("NODE_TOOLCHAIN_PROVISIONING_V2_INPUT_INVALID", "Private tree locator is not portable");
    }
    if (entry.type === "directory") {
      if (entry.bytes !== null || entry.contentHash !== null || entry.byteLength !== 0 || entry.mode !== "0555") {
        return fail("NODE_TOOLCHAIN_PROVISIONING_V2_INPUT_INVALID", "Private tree directory entry is invalid");
      }
      if (entry.locator !== ".") directoryCount += 1;
      continue;
    }
    if (
      !entry.bytes
      || entry.contentHash === null
      || entry.bytes.byteLength !== entry.byteLength
      || sha256(entry.bytes) !== entry.contentHash
      || (entry.mode !== "0444" && entry.mode !== "0555")
    ) {
      return fail("NODE_TOOLCHAIN_PROVISIONING_V2_INPUT_INVALID", "Private tree file entry bytes are invalid");
    }
    fileCount += 1;
    totalBytes += entry.byteLength;
  }
  if (
    fileCount !== bundle.receipt.tree.fileCount
    || directoryCount !== bundle.receipt.tree.directoryCount
    || totalBytes !== bundle.receipt.tree.totalBytes
    || canonicalTreeHash(entries) !== bundle.receipt.tree.treeHash
  ) {
    return fail(
      "NODE_TOOLCHAIN_PROVISIONING_V2_INPUT_INVALID",
      "Private tree bundle does not reproduce its authenticated receipt",
    );
  }
}

function buildIntent(input: Readonly<{
  admissionScope: AdmissionScopeV2;
  bundle: NodeToolchainPrivateTreeBundleV2;
  target: NodeToolchainTargetV2;
  paths: PublicationPathsV2;
  expectedOwner: ExpectedOwnerV2;
}>): NodeToolchainProvisioningIntentV2 {
  const source = input.bundle.receipt;
  const identity: NodeToolchainProvisioningIntentHashPayloadV2 = {
    schema: NODE_TOOLCHAIN_PROVISIONING_INTENT_V2_SCHEMA,
    intentVersion: NODE_TOOLCHAIN_PROVISIONING_VERSION_V2,
    authorityRef: NODE_TOOLCHAIN_PROVISIONING_AUTHORITY_REF_V2,
    admissionScope: input.admissionScope,
    architecture: source.inventory.distribution.artifact.architecture,
    source: {
      privateTreeReceiptHash: source.receiptHash,
      distributionManifestHash: source.inventory.distribution.manifest.manifestHash,
      distributionArtifactHash: source.inventory.distribution.artifact.artifactHash,
      archiveSha256: source.inventory.distribution.archive.sha256,
      treeHash: source.tree.treeHash,
    },
    target: {
      targetRef: input.target.targetRef,
      rootBasename: input.target.rootBasename,
      rootLocatorHash: hashNodeToolchainOperationalLocatorV2("root", input.paths.root),
      receiptBasename: input.target.receiptBasename,
      receiptLocatorHash: hashNodeToolchainOperationalLocatorV2("receipt", input.paths.receipt),
      parentLocatorHash: hashNodeToolchainOperationalLocatorV2("parent", input.paths.parent),
    },
    publication: {
      serializationPolicy: "darwin_parent_descriptor_lockf_v2",
      claimPolicy: "canonical_no_replace_claim_before_root_v2",
      directoryPolicy: "exclusive_inaccessible_root_then_read_only_v2",
      filePolicy: "same_filesystem_hard_link_no_replace_v2",
      receiptPolicy: "canonical_no_replace_receipt_last_v2",
      durabilityPolicy: "file_and_directory_fsync_v2",
      recoveryPolicy: "exact_claim_bounded_rebuild_v2",
      expectedOwnerUid: input.expectedOwner.uid,
      expectedOwnerGid: input.expectedOwner.gid,
      expectedRootMode: "0555",
    },
  };
  const parsed = NodeToolchainProvisioningIntentV2Schema.safeParse({
    ...identity,
    intentHash: hashNodeToolchainProvisioningIntentV2(identity),
  });
  if (!parsed.success) {
    return fail(
      "NODE_TOOLCHAIN_PROVISIONING_V2_INTENT_INVALID",
      "Fresh Node toolchain provisioning intent failed its canonical schema",
      parsed.error,
    );
  }
  return deepFreezeJson(parsed.data);
}

function buildClaim(intent: NodeToolchainProvisioningIntentV2): NodeToolchainProvisioningClaimV2 {
  const identity = {
    schema: NODE_TOOLCHAIN_PROVISIONING_CLAIM_V2_SCHEMA,
    claimVersion: NODE_TOOLCHAIN_PROVISIONING_VERSION_V2,
    status: "preparing" as const,
    intent,
  };
  return deepFreezeJson(NodeToolchainProvisioningClaimV2Schema.parse({
    ...identity,
    claimHash: hashNodeToolchainProvisioningClaimV2(identity),
  }));
}

function readCanonicalFile<T>(input: Readonly<{
  absolutePath: string;
  schema: { safeParse(value: unknown): { success: true; data: T } | { success: false; error: unknown } };
  expectedOwner: ExpectedOwnerV2;
  allowedMode: number;
  allowedLinks?: readonly number[];
  errorCode: NodeToolchainProvisioningErrorCodeV2;
}>): Readonly<{ value: T; fingerprint: FingerprintV2; bytes: Buffer }> {
  const captured = stableFileBytes({
    absolutePath: input.absolutePath,
    maxBytes: CANONICAL_FILE_MAX_BYTES_V2,
    expectedOwner: input.expectedOwner,
    allowedModes: [input.allowedMode],
    allowedLinks: input.allowedLinks ?? [1],
    errorCode: input.errorCode,
  });
  let raw: unknown;
  try {
    raw = JSON.parse(captured.bytes.toString("utf8"));
  } catch (error) {
    captured.bytes.fill(0);
    return fail(input.errorCode, "Provisioning authority file is not JSON", error);
  }
  const parsed = input.schema.safeParse(raw);
  if (!parsed.success) {
    captured.bytes.fill(0);
    return fail(input.errorCode, "Provisioning authority file failed its exact schema", parsed.error);
  }
  const canonical = canonicalJsonBytes(parsed.data);
  if (!captured.bytes.equals(canonical)) {
    captured.bytes.fill(0);
    canonical.fill(0);
    return fail(input.errorCode, "Provisioning authority file is not canonical JSON bytes");
  }
  canonical.fill(0);
  return Object.freeze({ value: deepFreezeJson(parsed.data), fingerprint: captured.fingerprint, bytes: captured.bytes });
}

function unlinkStableFile(
  absolutePath: string,
  expected: FingerprintV2,
  errorCode: NodeToolchainProvisioningErrorCodeV2,
): void {
  const current = fingerprint(lstatSync(absolutePath));
  if (!sameFingerprint(current, expected)) {
    return fail(errorCode, "Provisioning file changed before exact unlink");
  }
  unlinkSync(absolutePath);
}

function publishCanonicalNoReplace<T>(input: Readonly<{
  target: string;
  stage: string;
  value: T;
  schema: { safeParse(value: unknown): { success: true; data: T } | { success: false; error: unknown } };
  mode: number;
  expectedOwner: ExpectedOwnerV2;
  errorCode: NodeToolchainProvisioningErrorCodeV2;
  afterLink?: () => void;
}>): Readonly<{ created: boolean; fingerprint: FingerprintV2 }> {
  const bytes = canonicalJsonBytes(input.value);
  try {
    const existingTarget = optionalFingerprint(input.target);
    const existingStageAtStart = optionalFingerprint(input.stage);
    if (existingTarget) {
      if (existingStageAtStart) {
        const targetPair = readCanonicalFile({
          absolutePath: input.target,
          schema: input.schema,
          expectedOwner: input.expectedOwner,
          allowedMode: input.mode,
          allowedLinks: [2],
          errorCode: input.errorCode,
        });
        const stagePair = readCanonicalFile({
          absolutePath: input.stage,
          schema: input.schema,
          expectedOwner: input.expectedOwner,
          allowedMode: input.mode,
          allowedLinks: [2],
          errorCode: input.errorCode,
        });
        try {
          if (
            !samePhysicalIdentity(targetPair.fingerprint, stagePair.fingerprint)
            || !targetPair.bytes.equals(bytes)
            || !stagePair.bytes.equals(bytes)
          ) {
            return fail(input.errorCode, "Provisioning target/stage crash pair is not one exact inode");
          }
          syncDirectory(path.dirname(input.target));
          unlinkStableFile(input.stage, stagePair.fingerprint, input.errorCode);
          syncDirectory(path.dirname(input.stage));
          const final = readCanonicalFile({
            absolutePath: input.target,
            schema: input.schema,
            expectedOwner: input.expectedOwner,
            allowedMode: input.mode,
            allowedLinks: [1],
            errorCode: input.errorCode,
          });
          try {
            if (!final.bytes.equals(bytes)) {
              return fail(input.errorCode, "Provisioning crash-pair target changed during replay");
            }
            return Object.freeze({ created: false, fingerprint: final.fingerprint });
          } finally {
            final.bytes.fill(0);
          }
        } finally {
          targetPair.bytes.fill(0);
          stagePair.bytes.fill(0);
        }
      }
      const existing = readCanonicalFile({
        absolutePath: input.target,
        schema: input.schema,
        expectedOwner: input.expectedOwner,
        allowedMode: input.mode,
        errorCode: input.errorCode,
      });
      try {
        if (!existing.bytes.equals(bytes)) {
          return fail(input.errorCode, "Existing provisioning authority has a different canonical identity");
        }
        return Object.freeze({ created: false, fingerprint: existing.fingerprint });
      } finally {
        existing.bytes.fill(0);
      }
    }
    const existingStage = existingStageAtStart;
    if (existingStage) {
      const staged = stableFileBytes({
        absolutePath: input.stage,
        maxBytes: CANONICAL_FILE_MAX_BYTES_V2,
        expectedOwner: input.expectedOwner,
        allowedModes: [input.mode, 0o600],
        allowedLinks: [1],
        errorCode: input.errorCode,
      });
      try {
        if (staged.bytes.equals(bytes) && modeBits(staged.fingerprint) === input.mode) {
          // Exact crash-replay stage is reused below.
        } else if (staged.fingerprint.linkCount === 1) {
          unlinkStableFile(input.stage, staged.fingerprint, input.errorCode);
          syncDirectory(path.dirname(input.stage));
        } else {
          return fail(input.errorCode, "Provisioning canonical stage has a foreign identity");
        }
      } finally {
        staged.bytes.fill(0);
      }
    }
    if (!optionalFingerprint(input.stage)) {
      writeExclusiveFile({
        absolutePath: input.stage,
        bytes,
        mode: input.mode,
        expectedOwner: input.expectedOwner,
        errorCode: input.errorCode,
      });
      syncDirectory(path.dirname(input.stage));
    }
    const stageBefore = stableFileBytes({
      absolutePath: input.stage,
      maxBytes: CANONICAL_FILE_MAX_BYTES_V2,
      expectedOwner: input.expectedOwner,
      allowedModes: [input.mode],
      allowedLinks: [1],
      errorCode: input.errorCode,
    });
    try {
      if (!stageBefore.bytes.equals(bytes)) {
        return fail(input.errorCode, "Provisioning canonical stage bytes changed before no-replace link");
      }
      try {
        // POSIX hard-link creation is the no-replace publication primitive.
        linkSync(input.stage, input.target);
      } catch (error) {
        if (!isNodeError(error, "EEXIST")) throw error;
        const raced = readCanonicalFile({
          absolutePath: input.target,
          schema: input.schema,
          expectedOwner: input.expectedOwner,
          allowedMode: input.mode,
          errorCode: input.errorCode,
        });
        try {
          if (!raced.bytes.equals(bytes)) {
            return fail(input.errorCode, "Provisioning authority target won with different canonical bytes");
          }
          const stageCurrent = fingerprint(lstatSync(input.stage));
          if (!sameFingerprint(stageCurrent, stageBefore.fingerprint) || stageCurrent.linkCount !== 1) {
            return fail(input.errorCode, "Provisioning canonical stage changed during EEXIST convergence");
          }
          unlinkStableFile(input.stage, stageCurrent, input.errorCode);
          syncDirectory(path.dirname(input.stage));
          syncDirectory(path.dirname(input.target));
          return Object.freeze({ created: false, fingerprint: raced.fingerprint });
        } finally {
          raced.bytes.fill(0);
        }
      }
      input.afterLink?.();
      const targetLinked = fingerprint(lstatSync(input.target));
      const stageLinked = fingerprint(lstatSync(input.stage));
      if (
        !samePhysicalIdentity(targetLinked, stageLinked)
        || targetLinked.linkCount !== 2
        || stageLinked.linkCount !== 2
      ) {
        return fail(input.errorCode, "Provisioning no-replace target did not retain its staged inode");
      }
      syncDirectory(path.dirname(input.target));
      unlinkStableFile(input.stage, stageLinked, input.errorCode);
      syncDirectory(path.dirname(input.stage));
      const final = stableFileBytes({
        absolutePath: input.target,
        maxBytes: CANONICAL_FILE_MAX_BYTES_V2,
        expectedOwner: input.expectedOwner,
        allowedModes: [input.mode],
        allowedLinks: [1],
        errorCode: input.errorCode,
      });
      try {
        if (!final.bytes.equals(bytes)) {
          return fail(input.errorCode, "Provisioning no-replace target changed after durability barrier");
        }
        return Object.freeze({ created: true, fingerprint: final.fingerprint });
      } finally {
        final.bytes.fill(0);
      }
    } finally {
      stageBefore.bytes.fill(0);
    }
  } finally {
    bytes.fill(0);
  }
}

function absoluteEntryPath(root: string, locator: "." | string): string {
  if (locator === ".") return root;
  const target = path.join(root, locator);
  const relative = path.relative(root, target);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
    return fail("NODE_TOOLCHAIN_PROVISIONING_V2_INPUT_INVALID", "Tree entry escaped its exact root");
  }
  return target;
}

function directoryEntries(
  entries: readonly NodeToolchainPrivateTreeBundleEntryV2[],
): readonly NodeToolchainPrivateTreeBundleEntryV2[] {
  return entries
    .filter((entry) => entry.type === "directory" && entry.locator !== ".")
    .sort((left, right) => {
      const depth = left.locator.split("/").length - right.locator.split("/").length;
      return depth !== 0 ? depth : left.locator < right.locator ? -1 : 1;
    });
}

function fileEntries(
  entries: readonly NodeToolchainPrivateTreeBundleEntryV2[],
): readonly NodeToolchainPrivateTreeBundleEntryV2[] {
  return entries.filter((entry) => entry.type === "file");
}

function materializeTreeStage(input: Readonly<{
  stageRoot: string;
  entries: readonly NodeToolchainPrivateTreeBundleEntryV2[];
  expectedOwner: ExpectedOwnerV2;
}>): void {
  if (optionalFingerprint(input.stageRoot)) {
    return fail("NODE_TOOLCHAIN_PROVISIONING_V2_STAGE_INVALID", "Provisioning tree stage already exists");
  }
  createOwnedDirectory({
    absolutePath: input.stageRoot,
    mode: 0o700,
    expectedOwner: input.expectedOwner,
    errorCode: "NODE_TOOLCHAIN_PROVISIONING_V2_STAGE_INVALID",
  });
  for (const entry of directoryEntries(input.entries)) {
    createOwnedDirectory({
      absolutePath: absoluteEntryPath(input.stageRoot, entry.locator),
      mode: 0o700,
      expectedOwner: input.expectedOwner,
      errorCode: "NODE_TOOLCHAIN_PROVISIONING_V2_STAGE_INVALID",
    });
  }
  for (const entry of fileEntries(input.entries)) {
    if (!entry.bytes || entry.contentHash === null) {
      return fail("NODE_TOOLCHAIN_PROVISIONING_V2_STAGE_INVALID", "Provisioning file stage lacks bytes");
    }
    writeExclusiveFile({
      absolutePath: absoluteEntryPath(input.stageRoot, entry.locator),
      bytes: entry.bytes,
      mode: entry.mode === "0555" ? 0o555 : 0o444,
      expectedOwner: input.expectedOwner,
      errorCode: "NODE_TOOLCHAIN_PROVISIONING_V2_STAGE_INVALID",
    });
  }
  for (const entry of [...directoryEntries(input.entries)].reverse()) {
    syncDirectory(absoluteEntryPath(input.stageRoot, entry.locator));
  }
  syncDirectory(input.stageRoot);
  syncDirectory(path.dirname(input.stageRoot));
}

type CapturedPartialTreeV2 = Readonly<{
  root: FingerprintV2;
  directories: ReadonlyMap<string, FingerprintV2>;
  files: ReadonlyMap<string, FingerprintV2>;
}>;

function capturePartialTree(input: Readonly<{
  root: string;
  entries: readonly NodeToolchainPrivateTreeBundleEntryV2[];
  expectedOwner: ExpectedOwnerV2;
  kind: "stage" | "final";
}>): CapturedPartialTreeV2 {
  const expected = new Map(input.entries.map((entry) => [entry.locator, entry]));
  const directories = new Map<string, FingerprintV2>();
  const files = new Map<string, FingerprintV2>();
  const root = assertDirectory({
    absolutePath: input.root,
    expectedOwner: input.expectedOwner,
    allowedModes: input.kind === "stage" ? [0o700] : [0o700, 0o555],
    errorCode: input.kind === "stage"
      ? "NODE_TOOLCHAIN_PROVISIONING_V2_STAGE_INVALID"
      : "NODE_TOOLCHAIN_PROVISIONING_V2_FINAL_ROOT_CONFLICT",
  });
  directories.set(".", root);
  const visit = (absoluteDirectory: string, locator: "." | string): void => {
    const before = fingerprint(lstatSync(absoluteDirectory));
    const namesBefore = readdirSync(absoluteDirectory).sort();
    for (const name of namesBefore) {
      const childLocator = locator === "." ? name : `${locator}/${name}`;
      const expectedEntry = expected.get(childLocator);
      if (!expectedEntry) {
        return fail(
          input.kind === "stage"
            ? "NODE_TOOLCHAIN_PROVISIONING_V2_STAGE_INVALID"
            : "NODE_TOOLCHAIN_PROVISIONING_V2_FINAL_ROOT_CONFLICT",
          "Interrupted provisioning tree contains a foreign entry",
        );
      }
      const child = path.join(absoluteDirectory, name);
      const stat = lstatSync(child);
      if (
        stat.isSymbolicLink()
        || stat.uid !== input.expectedOwner.uid
        || stat.gid !== input.expectedOwner.gid
      ) {
        return fail(
          input.kind === "stage"
            ? "NODE_TOOLCHAIN_PROVISIONING_V2_STAGE_INVALID"
            : "NODE_TOOLCHAIN_PROVISIONING_V2_FINAL_ROOT_CONFLICT",
          "Interrupted provisioning tree has a foreign filesystem identity",
        );
      }
      if (stat.isDirectory()) {
        if (
          expectedEntry.type !== "directory"
          || (input.kind === "stage" && modeBits(stat) !== 0o700)
          || (input.kind === "final" && modeBits(stat) !== 0o700 && modeBits(stat) !== 0o555)
        ) {
          return fail(
            input.kind === "stage"
              ? "NODE_TOOLCHAIN_PROVISIONING_V2_STAGE_INVALID"
              : "NODE_TOOLCHAIN_PROVISIONING_V2_FINAL_ROOT_CONFLICT",
            "Interrupted provisioning directory does not match its selected member",
          );
        }
        directories.set(childLocator, fingerprint(stat));
        visit(child, childLocator);
        continue;
      }
      if (expectedEntry.type !== "file" || !stat.isFile() || stat.nlink < 1 || stat.nlink > 2) {
        return fail(
          input.kind === "stage"
            ? "NODE_TOOLCHAIN_PROVISIONING_V2_STAGE_INVALID"
            : "NODE_TOOLCHAIN_PROVISIONING_V2_FINAL_ROOT_CONFLICT",
          "Interrupted provisioning file type or link topology is invalid",
        );
      }
      const expectedMode = expectedEntry.mode === "0555" ? 0o555 : 0o444;
      if (input.kind === "final" || modeBits(stat) !== 0o600) {
        const captured = stableFileHash({
          absolutePath: child,
          maxBytes: expectedEntry.byteLength,
          expectedOwner: input.expectedOwner,
          allowedModes: [expectedMode],
          allowedLinks: [stat.nlink],
          errorCode: input.kind === "stage"
            ? "NODE_TOOLCHAIN_PROVISIONING_V2_STAGE_INVALID"
            : "NODE_TOOLCHAIN_PROVISIONING_V2_FINAL_ROOT_CONFLICT",
        });
        if (
          captured.fingerprint.byteLength !== expectedEntry.byteLength
          || captured.contentHash !== expectedEntry.contentHash
        ) {
          return fail(
            input.kind === "stage"
              ? "NODE_TOOLCHAIN_PROVISIONING_V2_STAGE_INVALID"
              : "NODE_TOOLCHAIN_PROVISIONING_V2_FINAL_ROOT_CONFLICT",
            "Interrupted provisioning file bytes do not match the authenticated member",
          );
        }
        files.set(childLocator, captured.fingerprint);
      } else {
        if (stat.nlink !== 1 || stat.size > expectedEntry.byteLength) {
          return fail(
            "NODE_TOOLCHAIN_PROVISIONING_V2_STAGE_INVALID",
            "Interrupted partial stage file is not safely removable",
          );
        }
        files.set(childLocator, fingerprint(stat));
      }
    }
    const after = fingerprint(lstatSync(absoluteDirectory));
    const namesAfter = readdirSync(absoluteDirectory).sort();
    if (
      !sameFingerprint(before, after)
      || namesBefore.length !== namesAfter.length
      || namesBefore.some((name, index) => name !== namesAfter[index])
    ) {
      return fail(
        input.kind === "stage"
          ? "NODE_TOOLCHAIN_PROVISIONING_V2_STAGE_INVALID"
          : "NODE_TOOLCHAIN_PROVISIONING_V2_FINAL_ROOT_CONFLICT",
        "Interrupted provisioning directory changed during bounded capture",
      );
    }
  };
  visit(input.root, ".");
  return Object.freeze({ root, directories, files });
}

function removeCapturedTree(input: Readonly<{
  root: string;
  captured: CapturedPartialTreeV2;
  expectedOwner: ExpectedOwnerV2;
  errorCode: NodeToolchainProvisioningErrorCodeV2;
}>): void {
  const writableDirectories = [...input.captured.directories]
    .sort((left, right) => left[0].split("/").length - right[0].split("/").length);
  for (const [locator, expected] of writableDirectories) {
    const absolutePath = absoluteEntryPath(input.root, locator);
    const current = fingerprint(lstatSync(absolutePath));
    if (
      !samePhysicalIdentity(current, expected)
      || current.ownerUid !== input.expectedOwner.uid
      || current.ownerGid !== input.expectedOwner.gid
    ) {
      return fail(input.errorCode, "Interrupted provisioning directory changed before cleanup");
    }
    chmodSync(absolutePath, 0o700);
  }
  for (const [locator, expected] of [...input.captured.files].sort((left, right) =>
    right[0].length - left[0].length)) {
    const absolutePath = absoluteEntryPath(input.root, locator);
    const current = fingerprint(lstatSync(absolutePath));
    if (
      !samePhysicalIdentity(current, expected)
      || current.ownerUid !== input.expectedOwner.uid
      || current.ownerGid !== input.expectedOwner.gid
      || current.linkCount < 1
      || current.linkCount > 2
    ) {
      return fail(input.errorCode, "Interrupted provisioning file changed before cleanup");
    }
    unlinkSync(absolutePath);
  }
  const directories = [...input.captured.directories]
    .filter(([locator]) => locator !== ".")
    .sort((left, right) => right[0].split("/").length - left[0].split("/").length);
  for (const [locator, expected] of directories) {
    const absolutePath = absoluteEntryPath(input.root, locator);
    const current = fingerprint(lstatSync(absolutePath));
    if (
      !samePhysicalIdentity(current, expected)
      || current.ownerUid !== input.expectedOwner.uid
      || current.ownerGid !== input.expectedOwner.gid
    ) {
      return fail(input.errorCode, "Interrupted provisioning directory changed before cleanup");
    }
    rmdirSync(absolutePath);
  }
  const currentRoot = fingerprint(lstatSync(input.root));
  if (
    !samePhysicalIdentity(currentRoot, input.captured.root)
    || currentRoot.ownerUid !== input.expectedOwner.uid
    || currentRoot.ownerGid !== input.expectedOwner.gid
  ) {
    return fail(input.errorCode, "Interrupted provisioning root changed before cleanup");
  }
  rmdirSync(input.root);
}

function reconcileInterruptedTrees(input: Readonly<{
  paths: PublicationPathsV2;
  entries: readonly NodeToolchainPrivateTreeBundleEntryV2[];
  expectedOwner: ExpectedOwnerV2;
}>): void {
  const stageExists = optionalFingerprint(input.paths.treeStage) !== undefined;
  const finalExists = optionalFingerprint(input.paths.root) !== undefined;
  if (!stageExists && !finalExists) return;
  const stage = stageExists
    ? capturePartialTree({
        root: input.paths.treeStage,
        entries: input.entries,
        expectedOwner: input.expectedOwner,
        kind: "stage",
      })
    : undefined;
  const final = finalExists
    ? capturePartialTree({
        root: input.paths.root,
        entries: input.entries,
        expectedOwner: input.expectedOwner,
        kind: "final",
      })
    : undefined;
  for (const [locator, file] of stage?.files ?? []) {
    if (file.linkCount === 2) {
      const peer = final?.files.get(locator);
      if (!peer || !samePhysicalIdentity(file, peer) || peer.linkCount !== 2) {
        return fail(
          "NODE_TOOLCHAIN_PROVISIONING_V2_STAGE_INVALID",
          "Interrupted stage hard link has no exact final-tree peer",
        );
      }
    }
  }
  for (const [locator, file] of final?.files ?? []) {
    if (file.linkCount === 2) {
      const peer = stage?.files.get(locator);
      if (!peer || !samePhysicalIdentity(file, peer) || peer.linkCount !== 2) {
        return fail(
          "NODE_TOOLCHAIN_PROVISIONING_V2_FINAL_ROOT_CONFLICT",
          "Interrupted final hard link has no exact deterministic-stage peer",
        );
      }
    }
  }
  if (stage) {
    removeCapturedTree({
      root: input.paths.treeStage,
      captured: stage,
      expectedOwner: input.expectedOwner,
      errorCode: "NODE_TOOLCHAIN_PROVISIONING_V2_STAGE_INVALID",
    });
    syncDirectory(input.paths.staging);
  }
  if (final) {
    removeCapturedTree({
      root: input.paths.root,
      captured: final,
      expectedOwner: input.expectedOwner,
      errorCode: "NODE_TOOLCHAIN_PROVISIONING_V2_FINAL_ROOT_CONFLICT",
    });
    syncDirectory(input.paths.parent);
  }
}

function captureFinalTree(input: Readonly<{
  root: string;
  entries: readonly NodeToolchainPrivateTreeBundleEntryV2[];
  expectedOwner: ExpectedOwnerV2;
  expectedTreeHash: string;
}>): FingerprintV2 {
  const captured = capturePartialTree({
    root: input.root,
    entries: input.entries,
    expectedOwner: input.expectedOwner,
    kind: "final",
  });
  const expectedFileCount = input.entries.filter((entry) => entry.type === "file").length;
  const expectedDirectoryCount = input.entries.filter((entry) =>
    entry.type === "directory" && entry.locator !== ".").length;
  if (
    captured.files.size !== expectedFileCount
    || captured.directories.size !== expectedDirectoryCount + 1
    || [...captured.files.values()].some((file) => file.linkCount !== 1)
    || [...captured.directories.values()].some((directory) => modeBits(directory) !== 0o555)
    || canonicalTreeHash(input.entries) !== input.expectedTreeHash
  ) {
    return fail(
      "NODE_TOOLCHAIN_PROVISIONING_V2_FINAL_TREE_INVALID",
      "Published Node toolchain root is not the exact closed read-only tree",
    );
  }
  return captured.root;
}

async function publishStagedTree(input: Readonly<{
  paths: PublicationPathsV2;
  entries: readonly NodeToolchainPrivateTreeBundleEntryV2[];
  expectedOwner: ExpectedOwnerV2;
  lease: KernelLeaseV2;
  hooks?: ProvisioningTestHooksV2;
}>): Promise<FingerprintV2> {
  input.lease.assertCurrent();
  createOwnedDirectory({
    absolutePath: input.paths.root,
    mode: 0o700,
    expectedOwner: input.expectedOwner,
    errorCode: "NODE_TOOLCHAIN_PROVISIONING_V2_FINAL_ROOT_CONFLICT",
  });
  syncDirectory(input.paths.parent);
  await input.hooks?.afterRootCreate?.();
  for (const entry of directoryEntries(input.entries)) {
    createOwnedDirectory({
      absolutePath: absoluteEntryPath(input.paths.root, entry.locator),
      mode: 0o700,
      expectedOwner: input.expectedOwner,
      errorCode: "NODE_TOOLCHAIN_PROVISIONING_V2_FINAL_ROOT_CONFLICT",
    });
  }
  let linkedCount = 0;
  for (const entry of fileEntries(input.entries)) {
    input.lease.assertCurrent();
    const stagePath = absoluteEntryPath(input.paths.treeStage, entry.locator);
    const finalPath = absoluteEntryPath(input.paths.root, entry.locator);
    const expectedMode = entry.mode === "0555" ? 0o555 : 0o444;
    const stage = stableFileHash({
      absolutePath: stagePath,
      maxBytes: entry.byteLength,
      expectedOwner: input.expectedOwner,
      allowedModes: [expectedMode],
      allowedLinks: [1],
      errorCode: "NODE_TOOLCHAIN_PROVISIONING_V2_STAGE_INVALID",
    });
    if (stage.fingerprint.byteLength !== entry.byteLength || stage.contentHash !== entry.contentHash) {
      return fail("NODE_TOOLCHAIN_PROVISIONING_V2_STAGE_INVALID", "Tree stage file changed before publication");
    }
    try {
      linkSync(stagePath, finalPath);
    } catch (error) {
      return fail(
        "NODE_TOOLCHAIN_PROVISIONING_V2_FINAL_ROOT_CONFLICT",
        "Final tree no-replace hard link failed",
        error,
      );
    }
    const stageLinked = fingerprint(lstatSync(stagePath));
    const finalLinked = fingerprint(lstatSync(finalPath));
    if (
      !samePhysicalIdentity(stageLinked, finalLinked)
      || stageLinked.linkCount !== 2
      || finalLinked.linkCount !== 2
      || stageLinked.ownerUid !== input.expectedOwner.uid
      || stageLinked.ownerGid !== input.expectedOwner.gid
      || modeBits(stageLinked) !== expectedMode
    ) {
      return fail(
        "NODE_TOOLCHAIN_PROVISIONING_V2_FINAL_TREE_INVALID",
        "Final tree hard link did not retain the exact staged identity",
      );
    }
    linkedCount += 1;
    await input.hooks?.afterFileLink?.({ locator: entry.locator, linkedCount });
  }
  for (const entry of [...directoryEntries(input.entries)].reverse()) {
    syncDirectory(absoluteEntryPath(input.paths.root, entry.locator));
  }
  syncDirectory(input.paths.root);
  syncDirectory(input.paths.parent);
  input.lease.assertCurrent();

  for (const entry of fileEntries(input.entries)) {
    const stagePath = absoluteEntryPath(input.paths.treeStage, entry.locator);
    const finalPath = absoluteEntryPath(input.paths.root, entry.locator);
    const stage = fingerprint(lstatSync(stagePath));
    const final = fingerprint(lstatSync(finalPath));
    if (!samePhysicalIdentity(stage, final) || stage.linkCount !== 2 || final.linkCount !== 2) {
      return fail(
        "NODE_TOOLCHAIN_PROVISIONING_V2_FINAL_TREE_INVALID",
        "Final tree lost its exact stage alias before stage cleanup",
      );
    }
    unlinkStableFile(stagePath, stage, "NODE_TOOLCHAIN_PROVISIONING_V2_STAGE_INVALID");
    const finalAfter = fingerprint(lstatSync(finalPath));
    if (!samePhysicalIdentity(finalAfter, final) || finalAfter.linkCount !== 1) {
      return fail(
        "NODE_TOOLCHAIN_PROVISIONING_V2_FINAL_TREE_INVALID",
        "Final tree file did not become one immutable link after stage cleanup",
      );
    }
  }
  for (const entry of [...directoryEntries(input.entries)].reverse()) {
    const stageDirectory = absoluteEntryPath(input.paths.treeStage, entry.locator);
    syncDirectory(stageDirectory);
    rmdirSync(stageDirectory);
  }
  syncDirectory(input.paths.treeStage);
  rmdirSync(input.paths.treeStage);
  syncDirectory(input.paths.staging);

  for (const entry of [...directoryEntries(input.entries)].reverse()) {
    const finalDirectory = absoluteEntryPath(input.paths.root, entry.locator);
    chmodSync(finalDirectory, 0o555);
    syncDirectory(finalDirectory);
  }
  chmodSync(input.paths.root, 0o555);
  syncDirectory(input.paths.root);
  syncDirectory(input.paths.parent);
  input.lease.assertCurrent();
  return captureFinalTree({
    root: input.paths.root,
    entries: input.entries,
    expectedOwner: input.expectedOwner,
    expectedTreeHash: canonicalTreeHash(input.entries),
  });
}

function buildReceipt(input: Readonly<{
  admissionScope: AdmissionScopeV2;
  intent: NodeToolchainProvisioningIntentV2;
  claim: NodeToolchainProvisioningClaimV2;
  source: NodeToolchainPrivateTreeBundleV2["receipt"];
  rootFingerprint: FingerprintV2;
  lockf: ExactSystemToolV2<"MACOS_LOCKF_V2">;
  lockHelper: ExactSystemToolV2<"MACOS_CAT_LOCK_HELPER_V2">;
}>): NodeToolchainProvisioningReceiptV2 {
  const identity: NodeToolchainProvisioningReceiptHashPayloadV2 = {
    schema: NODE_TOOLCHAIN_PROVISIONING_RECEIPT_V2_SCHEMA,
    receiptVersion: NODE_TOOLCHAIN_PROVISIONING_VERSION_V2,
    authorityRef: NODE_TOOLCHAIN_PROVISIONING_AUTHORITY_REF_V2,
    authorityVersion: NODE_TOOLCHAIN_PROVISIONING_VERSION_V2,
    status: "provisioned_verified",
    admissionScope: input.admissionScope,
    intent: input.intent,
    source: input.source,
    publisher: {
      contractRef: "NODE_TOOLCHAIN_ROOT_PUBLISHER_V2",
      lockExecutionPolicy: "exact_lockf_fd_then_exact_cat_pipe_v2",
      lockf: exactSystemToolReceipt(input.lockf),
      lockHelper: exactSystemToolReceipt(input.lockHelper),
      claimHash: input.claim.claimHash,
    },
    finalRoot: {
      targetRef: input.intent.target.targetRef,
      rootLocatorHash: input.intent.target.rootLocatorHash,
      device: input.rootFingerprint.device,
      inode: input.rootFingerprint.inode,
      ownerUid: input.rootFingerprint.ownerUid,
      ownerGid: input.rootFingerprint.ownerGid,
      mode: "0555",
      fileCount: input.source.tree.fileCount,
      directoryCount: input.source.tree.directoryCount,
      totalBytes: input.source.tree.totalBytes,
      treeHash: input.source.tree.treeHash,
      nodeContentHash: input.source.tree.node.contentHash,
      npmTreeHash: input.source.tree.npm.treeHash,
    },
    receiptFile: {
      receiptLocatorHash: input.intent.target.receiptLocatorHash,
      mode: "0444",
      ownerUid: input.intent.publication.expectedOwnerUid,
      ownerGid: input.intent.publication.expectedOwnerGid,
      linkCount: 1,
      publicationPolicy: "canonical_stage_hard_link_no_replace_fsync_v2",
    },
  };
  const parsed = NodeToolchainProvisioningReceiptV2Schema.safeParse({
    ...identity,
    receiptHash: hashNodeToolchainProvisioningReceiptV2(identity),
  });
  if (!parsed.success) {
    return fail(
      "NODE_TOOLCHAIN_PROVISIONING_V2_RECEIPT_INVALID",
      "Fresh Node toolchain provisioning receipt failed its canonical schema",
      parsed.error,
    );
  }
  return deepFreezeJson(parsed.data);
}

function authenticState(handle: ProvisionedNodeToolchainV2): ProvisionedStateV2 {
  if (
    typeof handle !== "object"
    || handle === null
    || isProxy(handle)
    || Object.getPrototypeOf(handle) !== ProvisionedNodeToolchainV2.prototype
  ) {
    return fail(
      "NODE_TOOLCHAIN_PROVISIONING_V2_HANDLE_UNAUTHENTICATED",
      "Provisioned Node toolchain operation requires one authentic handle",
    );
  }
  const state = provisionedStateV2.get(handle);
  if (!state) {
    return fail(
      "NODE_TOOLCHAIN_PROVISIONING_V2_HANDLE_UNAUTHENTICATED",
      "Provisioned Node toolchain operation requires one authentic handle",
    );
  }
  return state;
}

function makeHandle(input: Readonly<{
  paths: PublicationPathsV2;
  expectedOwner: ExpectedOwnerV2;
  parentMode: 0o700 | 0o755;
  stagingInspection: "require_empty" | "root_private_metadata_only";
  receipt: NodeToolchainProvisioningReceiptV2;
  receiptFingerprint: FingerprintV2;
  rootFingerprint: FingerprintV2;
  expectedEntries: readonly NodeToolchainPrivateTreeBundleEntryV2[];
}>): ProvisionedNodeToolchainV2 {
  const parentFingerprint = assertDirectory({
    absolutePath: input.paths.parent,
    expectedOwner: input.expectedOwner,
    allowedModes: [input.parentMode],
    errorCode: "NODE_TOOLCHAIN_PROVISIONING_V2_PARENT_INVALID",
  });
  const stagingFingerprint = assertDirectory({
    absolutePath: input.paths.staging,
    expectedOwner: input.expectedOwner,
    allowedModes: [0o700],
    errorCode: "NODE_TOOLCHAIN_PROVISIONING_V2_PARENT_INVALID",
  });
  const state: ProvisionedStateV2 = Object.freeze({
    paths: input.paths,
    expectedOwner: input.expectedOwner,
    parentMode: input.parentMode,
    parentFingerprint,
    stagingFingerprint,
    stagingInspection: input.stagingInspection,
    receipt: input.receipt,
    receiptFingerprint: input.receiptFingerprint,
    rootFingerprint: input.rootFingerprint,
    expectedEntries: Object.freeze([...input.expectedEntries]),
  });
  return new ProvisionedNodeToolchainV2(handleConstructorCapabilityV2, state);
}

function readExactClaim(
  paths: PublicationPathsV2,
  expectedOwner: ExpectedOwnerV2,
  expected: NodeToolchainProvisioningClaimV2,
): Readonly<{ value: NodeToolchainProvisioningClaimV2; fingerprint: FingerprintV2 }> {
  const captured = readCanonicalFile({
    absolutePath: paths.claim,
    schema: NodeToolchainProvisioningClaimV2Schema,
    expectedOwner,
    allowedMode: 0o600,
    errorCode: "NODE_TOOLCHAIN_PROVISIONING_V2_CLAIM_CONFLICT",
  });
  const expectedBytes = canonicalJsonBytes(expected);
  try {
    if (captured.value.claimHash !== expected.claimHash || !captured.bytes.equals(expectedBytes)) {
      return fail(
        "NODE_TOOLCHAIN_PROVISIONING_V2_CLAIM_CONFLICT",
        "Existing provisioning claim belongs to a different immutable intent",
      );
    }
    return Object.freeze({ value: captured.value, fingerprint: captured.fingerprint });
  } finally {
    expectedBytes.fill(0);
    captured.bytes.fill(0);
  }
}

function removeExactClaim(
  paths: PublicationPathsV2,
  expectedOwner: ExpectedOwnerV2,
  expected: NodeToolchainProvisioningClaimV2,
): void {
  if (!optionalFingerprint(paths.claim)) return;
  const claim = readExactClaim(paths, expectedOwner, expected);
  unlinkStableFile(
    paths.claim,
    claim.fingerprint,
    "NODE_TOOLCHAIN_PROVISIONING_V2_CLAIM_CONFLICT",
  );
  syncDirectory(paths.parent);
}

function readExistingReceipt(
  paths: PublicationPathsV2,
  expectedOwner: ExpectedOwnerV2,
  expectedIntent: NodeToolchainProvisioningIntentV2,
): Readonly<{ value: NodeToolchainProvisioningReceiptV2; fingerprint: FingerprintV2 }> {
  const captured = readCanonicalFile({
    absolutePath: paths.receipt,
    schema: NodeToolchainProvisioningReceiptV2Schema,
    expectedOwner,
    allowedMode: 0o444,
    allowedLinks: [1, 2],
    errorCode: "NODE_TOOLCHAIN_PROVISIONING_V2_RECEIPT_CONFLICT",
  });
  try {
    if (captured.value.intent.intentHash !== expectedIntent.intentHash) {
      return fail(
        "NODE_TOOLCHAIN_PROVISIONING_V2_RECEIPT_CONFLICT",
        "Existing provisioning receipt belongs to a different immutable intent",
      );
    }
    return Object.freeze({ value: captured.value, fingerprint: captured.fingerprint });
  } finally {
    captured.bytes.fill(0);
  }
}

function verifyReadyRoot(input: Readonly<{
  paths: PublicationPathsV2;
  expectedOwner: ExpectedOwnerV2;
  entries: readonly NodeToolchainPrivateTreeBundleEntryV2[];
  receipt: NodeToolchainProvisioningReceiptV2;
}>): FingerprintV2 {
  const root = captureFinalTree({
    root: input.paths.root,
    entries: input.entries,
    expectedOwner: input.expectedOwner,
    expectedTreeHash: input.receipt.finalRoot.treeHash,
  });
  if (
    root.device !== input.receipt.finalRoot.device
    || root.inode !== input.receipt.finalRoot.inode
    || root.ownerUid !== input.receipt.finalRoot.ownerUid
    || root.ownerGid !== input.receipt.finalRoot.ownerGid
    || modeBits(root) !== 0o555
  ) {
    return fail(
      "NODE_TOOLCHAIN_PROVISIONING_V2_FINAL_TREE_INVALID",
      "Ready Node toolchain root differs from its durable provisioning receipt",
    );
  }
  return root;
}

async function provision(input: Readonly<{
  admissionScope: AdmissionScopeV2;
  privateTree: MaterializedNodeToolchainPrivateTreeV2;
  parent: string;
  expectedOwner: ExpectedOwnerV2;
  hooks?: ProvisioningTestHooksV2;
}>): Promise<ProvisionedNodeToolchainV2> {
  const sourceReceipt = inspectNodeToolchainPrivateTreeReceiptV2(input.privateTree);
  if (
    (input.admissionScope === "production_root" && sourceReceipt.admissionScope !== "production_distribution")
    || (input.admissionScope === "test_fixture" && sourceReceipt.admissionScope !== "test_fixture")
  ) {
    return fail(
      "NODE_TOOLCHAIN_PROVISIONING_V2_INPUT_INVALID",
      "Provisioning scope cannot promote a private tree from another admission scope",
    );
  }
  const bundle = await copyMaterializedNodeToolchainPrivateTreeBundleV2(input.privateTree);
  validateBundle(bundle);
  const architecture = bundle.receipt.inventory.distribution.artifact.architecture;
  const target = getCodeOwnedNodeToolchainTargetV2(architecture);
  const basePaths = publicationPaths({ parent: input.parent, target });
  const intent = buildIntent({
    admissionScope: input.admissionScope,
    bundle,
    target,
    paths: basePaths,
    expectedOwner: input.expectedOwner,
  });
  const paths = publicationPaths({ parent: input.parent, target, intentHash: intent.intentHash });
  const claim = buildClaim(intent);
  await ensureLockAndStaging(paths, input.expectedOwner);
  const lease = await acquireKernelLease(paths, input.expectedOwner);
  try {
    lease.assertCurrent();
    assertStagingCensus({
      paths,
      expectedOwner: input.expectedOwner,
      allowCurrentIntentArtifacts: true,
      errorCode: "NODE_TOOLCHAIN_PROVISIONING_V2_STAGE_INVALID",
    });
    const receiptExists = optionalFingerprint(paths.receipt) !== undefined;
    const claimExists = optionalFingerprint(paths.claim) !== undefined;
    const claimStageExists = optionalFingerprint(paths.claimStage) !== undefined;
    const rootExists = optionalFingerprint(paths.root) !== undefined;
    const stageExists = optionalFingerprint(paths.treeStage) !== undefined;

    if (receiptExists) {
      if (stageExists) {
        return fail(
          "NODE_TOOLCHAIN_PROVISIONING_V2_STAGE_INVALID",
          "Ready provisioning receipt cannot coexist with an interrupted tree stage",
        );
      }
      if (!claimExists && claimStageExists) {
        return fail(
          "NODE_TOOLCHAIN_PROVISIONING_V2_CLAIM_CONFLICT",
          "Ready provisioning receipt cannot adopt a claim stage without its target",
        );
      }
      if (claimExists) {
        publishCanonicalNoReplace({
          target: paths.claim,
          stage: paths.claimStage,
          value: claim,
          schema: NodeToolchainProvisioningClaimV2Schema,
          mode: 0o600,
          expectedOwner: input.expectedOwner,
          errorCode: "NODE_TOOLCHAIN_PROVISIONING_V2_CLAIM_CONFLICT",
        });
      }
      const existing = readExistingReceipt(paths, input.expectedOwner, intent);
      const reconciledReceipt = publishCanonicalNoReplace({
        target: paths.receipt,
        stage: paths.receiptStage,
        value: existing.value,
        schema: NodeToolchainProvisioningReceiptV2Schema,
        mode: 0o444,
        expectedOwner: input.expectedOwner,
        errorCode: "NODE_TOOLCHAIN_PROVISIONING_V2_RECEIPT_CONFLICT",
      });
      const root = verifyReadyRoot({
        paths,
        expectedOwner: input.expectedOwner,
        entries: bundle.entries,
        receipt: existing.value,
      });
      if (claimExists) removeExactClaim(paths, input.expectedOwner, claim);
      assertStagingCensus({
        paths,
        expectedOwner: input.expectedOwner,
        allowCurrentIntentArtifacts: false,
        errorCode: "NODE_TOOLCHAIN_PROVISIONING_V2_STAGE_INVALID",
      });
      return makeHandle({
        paths,
        expectedOwner: input.expectedOwner,
        parentMode: input.admissionScope === "production_root" ? 0o755 : 0o700,
        stagingInspection: "require_empty",
        receipt: existing.value,
        receiptFingerprint: reconciledReceipt.fingerprint,
        rootFingerprint: root,
        expectedEntries: bundle.entries,
      });
    }

    if (!claimExists && (rootExists || stageExists)) {
      return fail(
        rootExists
          ? "NODE_TOOLCHAIN_PROVISIONING_V2_FINAL_ROOT_CONFLICT"
          : "NODE_TOOLCHAIN_PROVISIONING_V2_STAGE_INVALID",
        "Unreceipted provisioning state has no exact prior no-replace claim",
      );
    }
    publishCanonicalNoReplace({
      target: paths.claim,
      stage: paths.claimStage,
      value: claim,
      schema: NodeToolchainProvisioningClaimV2Schema,
      mode: 0o600,
      expectedOwner: input.expectedOwner,
      errorCode: "NODE_TOOLCHAIN_PROVISIONING_V2_CLAIM_CONFLICT",
      ...(input.hooks?.afterClaimLink ? { afterLink: input.hooks.afterClaimLink } : {}),
    });
    await input.hooks?.afterClaim?.();
    lease.assertCurrent();
    reconcileInterruptedTrees({ paths, entries: bundle.entries, expectedOwner: input.expectedOwner });
    materializeTreeStage({
      stageRoot: paths.treeStage,
      entries: bundle.entries,
      expectedOwner: input.expectedOwner,
    });
    capturePartialTree({
      root: paths.treeStage,
      entries: bundle.entries,
      expectedOwner: input.expectedOwner,
      kind: "stage",
    });
    syncDirectory(paths.staging);
    await input.hooks?.afterStage?.();
    const root = await publishStagedTree({
      paths,
      entries: bundle.entries,
      expectedOwner: input.expectedOwner,
      lease,
      ...(input.hooks ? { hooks: input.hooks } : {}),
    });
    await input.hooks?.afterRootVerify?.();
    lease.assertCurrent();
    assertSystemToolCurrent(LOCKF_PATH_V2, lease.lockf);
    assertSystemToolCurrent(LOCK_HELPER_PATH_V2, lease.lockHelper);
    const receipt = buildReceipt({
      admissionScope: input.admissionScope,
      intent,
      claim,
      source: bundle.receipt,
      rootFingerprint: root,
      lockf: lease.lockf,
      lockHelper: lease.lockHelper,
    });
    const publishedReceipt = publishCanonicalNoReplace({
      target: paths.receipt,
      stage: paths.receiptStage,
      value: receipt,
      schema: NodeToolchainProvisioningReceiptV2Schema,
      mode: 0o444,
      expectedOwner: input.expectedOwner,
      errorCode: "NODE_TOOLCHAIN_PROVISIONING_V2_RECEIPT_CONFLICT",
      ...(input.hooks?.afterReceiptLink ? { afterLink: input.hooks.afterReceiptLink } : {}),
    });
    await input.hooks?.afterReceiptPublish?.();
    lease.assertCurrent();
    removeExactClaim(paths, input.expectedOwner, claim);
    const finalRoot = verifyReadyRoot({
      paths,
      expectedOwner: input.expectedOwner,
      entries: bundle.entries,
      receipt,
    });
    assertStagingCensus({
      paths,
      expectedOwner: input.expectedOwner,
      allowCurrentIntentArtifacts: false,
      errorCode: "NODE_TOOLCHAIN_PROVISIONING_V2_STAGE_INVALID",
    });
    return makeHandle({
      paths,
      expectedOwner: input.expectedOwner,
      parentMode: input.admissionScope === "production_root" ? 0o755 : 0o700,
      stagingInspection: "require_empty",
      receipt,
      receiptFingerprint: publishedReceipt.fingerprint,
      rootFingerprint: finalRoot,
      expectedEntries: bundle.entries,
    });
  } finally {
    for (const entry of bundle.entries) entry.bytes?.fill(0);
    await lease.release();
  }
}

export async function provisionNodeToolchainV2(
  privateTree: MaterializedNodeToolchainPrivateTreeV2,
): Promise<ProvisionedNodeToolchainV2> {
  if (inspectNodeToolchainPrivateTreeReceiptV2(privateTree).admissionScope !== "production_distribution") {
    return fail(
      "NODE_TOOLCHAIN_PROVISIONING_V2_INPUT_INVALID",
      "Production provisioning requires one production-distribution private tree",
    );
  }
  const expectedOwner = ensureProductionParent();
  return provision({
    admissionScope: "production_root",
    privateTree,
    parent: NODE_TOOLCHAIN_ROOT_PARENT_V2,
    expectedOwner,
  });
}

export async function provisionNodeToolchainV2ForTest(
  privateTree: MaterializedNodeToolchainPrivateTreeV2,
  input: Readonly<{
    parent: string;
    hooks?: ProvisioningTestHooksV2;
  }>,
): Promise<ProvisionedNodeToolchainV2> {
  if (!input || typeof input !== "object") {
    return fail(
      "NODE_TOOLCHAIN_PROVISIONING_V2_INPUT_INVALID",
      "Test provisioning requires one explicit private test parent",
    );
  }
  const parent = testParent(input.parent);
  return provision({
    admissionScope: "test_fixture",
    privateTree,
    parent: parent.parent,
    expectedOwner: parent.expectedOwner,
    ...(input.hooks ? { hooks: input.hooks } : {}),
  });
}

function openDurableProvisioningAuthority(input: Readonly<{
  admissionScope: AdmissionScopeV2;
  architecture: "arm64" | "x64";
  parent: string;
  expectedOwner: ExpectedOwnerV2;
  parentMode: 0o700 | 0o755;
  stagingInspection: "require_empty" | "root_private_metadata_only";
}>): ProvisionedNodeToolchainV2 {
  const target = getCodeOwnedNodeToolchainTargetV2(input.architecture);
  const basePaths = publicationPaths({ parent: input.parent, target });
  const captured = readCanonicalFile({
    absolutePath: basePaths.receipt,
    schema: NodeToolchainProvisioningReceiptV2Schema,
    expectedOwner: input.expectedOwner,
    allowedMode: 0o444,
    errorCode: "NODE_TOOLCHAIN_PROVISIONING_V2_RECEIPT_INVALID",
  });
  try {
    const receipt = deepFreezeJson(captured.value);
    const paths = publicationPaths({
      parent: input.parent,
      target,
      intentHash: receipt.intent.intentHash,
    });
    if (
      receipt.admissionScope !== input.admissionScope
      || receipt.intent.architecture !== input.architecture
      || receipt.source.inventory.distribution.artifact.architecture !== input.architecture
      || receipt.intent.target.targetRef !== target.targetRef
      || receipt.intent.target.rootBasename !== target.rootBasename
      || receipt.intent.target.receiptBasename !== target.receiptBasename
      || receipt.intent.target.rootLocatorHash
        !== hashNodeToolchainOperationalLocatorV2("root", paths.root)
      || receipt.intent.target.receiptLocatorHash
        !== hashNodeToolchainOperationalLocatorV2("receipt", paths.receipt)
      || receipt.intent.target.parentLocatorHash
        !== hashNodeToolchainOperationalLocatorV2("parent", paths.parent)
      || receipt.intent.publication.expectedOwnerUid !== input.expectedOwner.uid
      || receipt.intent.publication.expectedOwnerGid !== input.expectedOwner.gid
      || receipt.finalRoot.ownerUid !== input.expectedOwner.uid
      || receipt.finalRoot.ownerGid !== input.expectedOwner.gid
    ) {
      return fail(
        "NODE_TOOLCHAIN_PROVISIONING_V2_RECEIPT_INVALID",
        "Durable provisioning receipt does not bind this exact target, owner and admission scope",
      );
    }
    const parentFingerprint = assertDirectory({
      absolutePath: paths.parent,
      expectedOwner: input.expectedOwner,
      allowedModes: [input.parentMode],
      errorCode: "NODE_TOOLCHAIN_PROVISIONING_V2_PARENT_INVALID",
    });
    const stagingFingerprint = assertDirectory({
      absolutePath: paths.staging,
      expectedOwner: input.expectedOwner,
      allowedModes: [0o700],
      errorCode: "NODE_TOOLCHAIN_PROVISIONING_V2_PARENT_INVALID",
    });
    if (optionalFingerprint(paths.claim)) {
      return fail(
        "NODE_TOOLCHAIN_PROVISIONING_V2_RECEIPT_INVALID",
        "Durable provisioning receipt coexists with an incomplete target claim",
      );
    }
    if (input.stagingInspection === "require_empty") {
      assertStagingCensus({
        paths,
        expectedOwner: input.expectedOwner,
        allowCurrentIntentArtifacts: false,
        errorCode: "NODE_TOOLCHAIN_PROVISIONING_V2_RECEIPT_INVALID",
      });
    }
    const discovered = discoverReadyTree({
      paths,
      expectedOwner: input.expectedOwner,
      receipt,
    });
    const verifiedRoot = verifyReadyRoot({
      paths,
      expectedOwner: input.expectedOwner,
      entries: discovered.entries,
      receipt,
    });
    if (!sameFingerprint(discovered.root, verifiedRoot)) {
      return fail(
        "NODE_TOOLCHAIN_PROVISIONING_V2_HOST_DRIFT",
        "Provisioned root identity changed between durable discovery passes",
      );
    }
    const handle = makeHandle({
      paths,
      expectedOwner: input.expectedOwner,
      parentMode: input.parentMode,
      stagingInspection: input.stagingInspection,
      receipt,
      receiptFingerprint: captured.fingerprint,
      rootFingerprint: verifiedRoot,
      expectedEntries: discovered.entries,
    });
    const state = authenticState(handle);
    if (
      !samePhysicalIdentity(state.parentFingerprint, parentFingerprint)
      || !samePhysicalIdentity(state.stagingFingerprint, stagingFingerprint)
    ) {
      return fail(
        "NODE_TOOLCHAIN_PROVISIONING_V2_HOST_DRIFT",
        "Provisioning operational roots changed while durable authority was opened",
      );
    }
    return handle;
  } finally {
    captured.bytes.fill(0);
  }
}

/**
 * Rehydrates production authority from the code-owned receipt and root only.
 * The caller cannot supply a path, architecture, owner or expected hash.
 */
export async function openProductionProvisionedNodeToolchainV2():
Promise<ProvisionedNodeToolchainV2> {
  if (process.platform !== "darwin" || (process.arch !== "arm64" && process.arch !== "x64")) {
    return fail(
      "NODE_TOOLCHAIN_PROVISIONING_V2_PLATFORM_UNSUPPORTED",
      "Production Node toolchain authority currently admits Darwin arm64 or x64 only",
    );
  }
  const expectedOwner = inspectProductionParent();
  return openDurableProvisioningAuthority({
    admissionScope: "production_root",
    architecture: process.arch,
    parent: NODE_TOOLCHAIN_ROOT_PARENT_V2,
    expectedOwner,
    parentMode: 0o755,
    // The root-owned 0700 staging directory is intentionally unreadable to the
    // unprivileged runtime. Receipt-last publication plus an absent target claim
    // is the runtime authority; only metadata identity is observable here.
    stagingInspection: "root_private_metadata_only",
  });
}

/** Test-only durable rehydration; its explicit root can never become production authority. */
export async function openProvisionedNodeToolchainV2ForTest(input: Readonly<{
  parent: string;
  architecture: "arm64" | "x64";
}>): Promise<ProvisionedNodeToolchainV2> {
  if (!input || typeof input !== "object") {
    return fail(
      "NODE_TOOLCHAIN_PROVISIONING_V2_INPUT_INVALID",
      "Test durable provisioning authority requires one explicit input",
    );
  }
  const parent = testParent(input.parent);
  return openDurableProvisioningAuthority({
    admissionScope: "test_fixture",
    architecture: input.architecture,
    parent: parent.parent,
    expectedOwner: parent.expectedOwner,
    parentMode: 0o700,
    stagingInspection: "require_empty",
  });
}

export function inspectNodeToolchainProvisioningReceiptV2(
  handle: ProvisionedNodeToolchainV2,
): NodeToolchainProvisioningReceiptV2 {
  return defensiveReceiptCopy(authenticState(handle).receipt);
}

export function isProductionProvisionedNodeToolchainV2(
  handle: ProvisionedNodeToolchainV2,
): boolean {
  return authenticState(handle).receipt.admissionScope === "production_root";
}

export async function revalidateProvisionedNodeToolchainV2(
  handle: ProvisionedNodeToolchainV2,
): Promise<NodeToolchainProvisioningReceiptV2> {
  const state = authenticState(handle);
  try {
    const parent = assertDirectory({
      absolutePath: state.paths.parent,
      expectedOwner: state.expectedOwner,
      allowedModes: [state.parentMode],
      errorCode: "NODE_TOOLCHAIN_PROVISIONING_V2_HOST_DRIFT",
    });
    const staging = assertDirectory({
      absolutePath: state.paths.staging,
      expectedOwner: state.expectedOwner,
      allowedModes: [0o700],
      errorCode: "NODE_TOOLCHAIN_PROVISIONING_V2_HOST_DRIFT",
    });
    if (
      !samePhysicalIdentity(parent, state.parentFingerprint)
      || !samePhysicalIdentity(staging, state.stagingFingerprint)
    ) {
      return fail(
        "NODE_TOOLCHAIN_PROVISIONING_V2_HOST_DRIFT",
        "Provisioning parent or root-private staging identity changed after authority issuance",
      );
    }
    if (
      optionalFingerprint(state.paths.claim)
    ) {
      return fail(
        "NODE_TOOLCHAIN_PROVISIONING_V2_HOST_DRIFT",
        "Ready provisioning authority regained an incomplete publication artifact",
      );
    }
    if (state.stagingInspection === "require_empty") {
      assertStagingCensus({
        paths: state.paths,
        expectedOwner: state.expectedOwner,
        allowCurrentIntentArtifacts: false,
        errorCode: "NODE_TOOLCHAIN_PROVISIONING_V2_HOST_DRIFT",
      });
    }
    const receipt = readCanonicalFile({
      absolutePath: state.paths.receipt,
      schema: NodeToolchainProvisioningReceiptV2Schema,
      expectedOwner: state.expectedOwner,
      allowedMode: 0o444,
      errorCode: "NODE_TOOLCHAIN_PROVISIONING_V2_HOST_DRIFT",
    });
    try {
      if (
        receipt.value.receiptHash !== state.receipt.receiptHash
        || !sameFingerprint(receipt.fingerprint, state.receiptFingerprint)
      ) {
        return fail(
          "NODE_TOOLCHAIN_PROVISIONING_V2_HOST_DRIFT",
          "Durable Node provisioning receipt changed after authority issuance",
        );
      }
    } finally {
      receipt.bytes.fill(0);
    }
    const root = verifyReadyRoot({
      paths: state.paths,
      expectedOwner: state.expectedOwner,
      entries: state.expectedEntries,
      receipt: state.receipt,
    });
    if (!sameFingerprint(root, state.rootFingerprint)) {
      return fail(
        "NODE_TOOLCHAIN_PROVISIONING_V2_HOST_DRIFT",
        "Provisioned Node tree filesystem identity changed after authority issuance",
      );
    }
    return defensiveReceiptCopy(state.receipt);
  } catch (error) {
    if (error instanceof NodeToolchainProvisioningErrorV2
      && error.code === "NODE_TOOLCHAIN_PROVISIONING_V2_HOST_DRIFT") throw error;
    return fail(
      "NODE_TOOLCHAIN_PROVISIONING_V2_HOST_DRIFT",
      "Provisioned Node toolchain could not reproduce its durable authority",
      error,
    );
  }
}
