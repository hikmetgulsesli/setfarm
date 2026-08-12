import { createHash } from "node:crypto";
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
  renameSync,
  rmdirSync,
  unlinkSync,
  writeSync,
  type BigIntStats,
  type Stats,
} from "node:fs";
import path from "node:path";
import { isProxy } from "node:util/types";

import { PLATFORM_RELEASE_BOOTSTRAP_CONTRACT_V2 } from "../execution/schemas/platform-release-bootstrap-contract-v2.js";
import { canonicalJsonBytes } from "./canonical-json.js";
import {
  DarwinParentDescriptorLeaseErrorV2,
  acquireDarwinParentDescriptorLeaseV2,
  type DarwinParentDescriptorLeaseV2,
} from "./darwin-parent-descriptor-lease-v2.js";
import {
  openNodeToolchainProvisionerBootstrapPackageV2ForTest,
  openProductionNodeToolchainProvisionerBootstrapPackageV2,
  revalidateNodeToolchainProvisionerBootstrapPackageV2,
} from "./node-toolchain-provisioner-bootstrap-package-v2.js";
import {
  copyNodeToolchainProvisionerBootstrapPreparedPackageV2,
  revalidateNodeToolchainProvisionerBootstrapPreparedPackageV2,
  type NodeToolchainProvisionerBootstrapPreparedPackageSnapshotV2,
  type PreparedNodeToolchainProvisionerBootstrapPackageV2,
} from "./node-toolchain-provisioner-bootstrap-prepared-package-v2.js";
import {
  planNodeToolchainProvisionerBootstrapInstallationV2,
} from "./node-toolchain-provisioner-bootstrap-installation-plan-v2.js";
import {
  NodeToolchainProvisionerBootstrapInstallationPlanV2Schema,
  type NodeToolchainProvisionerBootstrapInstallationPlanV2,
} from "./schemas/node-toolchain-provisioner-bootstrap-installation-plan-v2.js";
import {
  NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_CLAIM_V2_SCHEMA,
  NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_CLAIM_STAGE_BASENAME_V2,
  NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_LOCK_CONTENT_V2,
  NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_PAYLOAD_STAGE_BASENAME_V2,
  NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_RECEIPT_BASENAME_V2,
  NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_RECEIPT_STAGE_BASENAME_V2,
  NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_RECEIPT_V2_SCHEMA,
  NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_SETFARM_ROOT_V2,
  NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_VERSION_V2,
  NodeToolchainProvisionerBootstrapInstallationClaimV2Schema,
  NodeToolchainProvisionerBootstrapInstallationReceiptV2Schema,
  buildNodeToolchainProvisionerBootstrapRollbackHistoryV2,
  buildNodeToolchainProvisionerBootstrapInstallationClaimV2,
  buildNodeToolchainProvisionerBootstrapInstallationIntentV2,
  getNodeToolchainProvisionerBootstrapInstallationPathsV2,
  hashNodeToolchainProvisionerBootstrapInstallationReceiptV2,
  hashNodeToolchainProvisionerBootstrapInstalledTreeV2,
  type NodeToolchainProvisionerBootstrapInstallationClaimV2,
  type NodeToolchainProvisionerBootstrapInstallationPathsV2,
  type NodeToolchainProvisionerBootstrapInstallationReceiptHashPayloadV2,
  type NodeToolchainProvisionerBootstrapInstallationReceiptV2,
  type NodeToolchainProvisionerBootstrapRollbackHistoryEntryV2,
  type NodeToolchainProvisionerBootstrapRollbackHistoryV2,
} from "./schemas/node-toolchain-provisioner-bootstrap-installation-state-v2.js";
import {
  NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_ROLLBACK_CLAIM_STAGE_BASENAME_V2,
  NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_ROLLBACK_RECEIPT_BASENAME_REGEX_V2,
  NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_ROLLBACK_RECEIPT_STAGE_BASENAME_V2,
  NodeToolchainProvisionerBootstrapRollbackClaimV2Schema,
  NodeToolchainProvisionerBootstrapRollbackPlanV2Schema,
  NodeToolchainProvisionerBootstrapRollbackReceiptV2Schema,
  buildNodeToolchainProvisionerBootstrapRollbackClaimV2,
  buildNodeToolchainProvisionerBootstrapRollbackPlanV2,
  buildNodeToolchainProvisionerBootstrapRollbackReceiptV2,
  getNodeToolchainProvisionerBootstrapRollbackPathsV2,
  type NodeToolchainProvisionerBootstrapRollbackClaimV2,
  type NodeToolchainProvisionerBootstrapRollbackPathsV2,
  type NodeToolchainProvisionerBootstrapRollbackPlanV2,
  type NodeToolchainProvisionerBootstrapRollbackReceiptV2,
  type NodeToolchainProvisionerBootstrapRollbackTreeEntryV2,
} from "./schemas/node-toolchain-provisioner-bootstrap-rollback-v2.js";
import {
  NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_BUNDLE_LOCATOR_V2,
  NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_LAUNCHER_LOCATOR_V2,
  NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_MANIFEST_LOCATOR_V2,
  NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_ROOT_V2,
  NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_RUNTIME_LOCATOR_V2,
} from "./schemas/node-toolchain-provisioner-bootstrap-v2.js";
import {
  matchesExactStableFilesystemObjectV2,
} from "./exact-stable-filesystem-identity-v2.js";

const LOCK_FILE_BYTES_V2 = Buffer.from(
  NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_LOCK_CONTENT_V2,
  "utf8",
);
const CLAIM_STAGE_BASENAME_V2 =
  NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_CLAIM_STAGE_BASENAME_V2;
const RECEIPT_STAGE_BASENAME_V2 =
  NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_RECEIPT_STAGE_BASENAME_V2;
const PAYLOAD_STAGE_BASENAME_V2 =
  NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_PAYLOAD_STAGE_BASENAME_V2;
const MAX_CANONICAL_BYTES_V2 = 16 * 1024 * 1024;
const ROLLBACK_RECEIPT_BASENAME_PATTERN_V2 = new RegExp(
  NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_ROLLBACK_RECEIPT_BASENAME_REGEX_V2,
);

export type NodeToolchainProvisionerBootstrapInstallationErrorCodeV2 =
  | "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_V2_INPUT_INVALID"
  | "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_V2_SCOPE_INVALID"
  | "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_V2_PRECONDITION_CHANGED"
  | "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_V2_PARENT_INVALID"
  | "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_V2_LOCK_FAILED"
  | "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_V2_CONFLICT"
  | "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_V2_PUBLICATION_FAILED"
  | "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_V2_RECOVERY_FAILED"
  | "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_V2_RECEIPT_INVALID"
  | "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_V2_PACKAGE_INVALID"
  | "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_V2_HANDLE_UNAUTHENTICATED"
  | "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_V2_DRIFT"
  | "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_V2_ROLLBACK_CONFLICT"
  | "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_V2_ROLLBACK_FAILED";

export class NodeToolchainProvisionerBootstrapInstallationErrorV2 extends Error {
  readonly code: NodeToolchainProvisionerBootstrapInstallationErrorCodeV2;
  override readonly cause?: unknown;

  constructor(
    code: NodeToolchainProvisionerBootstrapInstallationErrorCodeV2,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message.slice(0, 1_500), options);
    this.name = "NodeToolchainProvisionerBootstrapInstallationErrorV2";
    this.code = code;
    this.cause = options?.cause;
  }
}

type AdmissionScopeV2 = "production_release" | "test_fixture";
type OwnerV2 = Readonly<{ uid: number; gid: number }>;

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

type CapturedEntryV2 = Readonly<{
  absolutePath: string;
  relativePath: string;
  type: "directory" | "file";
  fingerprint: FingerprintV2;
}>;

type InstalledStateV2 = Readonly<{
  admissionScope: AdmissionScopeV2;
  paths: NodeToolchainProvisionerBootstrapInstallationPathsV2;
  expectedOwner: OwnerV2;
  parentMode: 0o700 | 0o755;
  receipt: NodeToolchainProvisionerBootstrapInstallationReceiptV2;
  rootFingerprint: FingerprintV2;
}>;

export type NodeToolchainProvisionerBootstrapInstallationTestHooksV2 = Readonly<{
  afterLegacyLeaseAcquired?: () => void;
  afterClaimStage?: () => void;
  afterClaimPublished?: () => void;
  afterPayloadStaged?: () => void;
  afterRootCreated?: () => void;
  afterSecondMemberLinked?: () => void;
  afterRootVerified?: () => void;
  afterReceiptStage?: () => void;
  afterReceiptPublished?: () => void;
}>;

const handleCapabilityV2 = Object.freeze({});
const installedStatesV2 = new WeakMap<object, InstalledStateV2>();

export class InstalledNodeToolchainProvisionerBootstrapV2 {
  readonly receiptHash: string;
  readonly admissionScope: AdmissionScopeV2;

  constructor(capability: object, state: InstalledStateV2) {
    if (capability !== handleCapabilityV2) {
      throw new NodeToolchainProvisionerBootstrapInstallationErrorV2(
        "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_V2_HANDLE_UNAUTHENTICATED",
        "Installed bootstrap constructor capability is unavailable",
      );
    }
    this.receiptHash = state.receipt.receiptHash;
    this.admissionScope = state.admissionScope;
    installedStatesV2.set(this, state);
    Object.freeze(this);
  }
}

function fail(
  code: NodeToolchainProvisionerBootstrapInstallationErrorCodeV2,
  message: string,
  cause?: unknown,
): never {
  throw new NodeToolchainProvisionerBootstrapInstallationErrorV2(
    code,
    message,
    cause === undefined ? undefined : { cause },
  );
}

function isNodeError(error: unknown, code: string): boolean {
  return error instanceof Error && "code" in error && error.code === code;
}

function isWrappedNodeError(error: unknown, code: string): boolean {
  let current = error;
  const seen = new Set<unknown>();
  while (current instanceof Error && !seen.has(current)) {
    if ("code" in current && current.code === code) return true;
    seen.add(current);
    current = "cause" in current ? current.cause : undefined;
  }
  return false;
}

function closeQuietly(descriptor: number | undefined): void {
  if (descriptor === undefined) return;
  try {
    closeSync(descriptor);
  } catch {
    // The primary typed outcome remains authoritative.
  }
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

function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
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

/**
 * Bootstrap installation receipts are still V2 JSON and therefore retain
 * numeric device/inode fields.  Directory admission must prove those values
 * came from an injective bigint projection; otherwise a rounded identity
 * could be mistaken for the durable installed root during open/revalidate.
 */
function assertExactDirectoryStableIdentityV2(input: Readonly<{
  absolutePath: string;
  expected: FingerprintV2;
  errorCode: NodeToolchainProvisionerBootstrapInstallationErrorCodeV2;
}>): void {
  let stat: BigIntStats;
  try {
    stat = lstatSync(input.absolutePath, { bigint: true });
  } catch (error) {
    return fail(
      input.errorCode,
      "Bootstrap installation directory exact physical identity could not be captured",
      error,
    );
  }
  if (
    !matchesExactStableFilesystemObjectV2({
      stat,
      expected: input.expected,
      objectKind: "directory",
    })
  ) {
    return fail(
      input.errorCode,
      "Bootstrap installation directory device/inode identity exceeds or differs from the exact V2 numeric boundary",
    );
  }
}

function assertExactObjectStableIdentityV2(input: Readonly<{
  absolutePath: string;
  expected: FingerprintV2;
  objectKind: "ordinary_file" | "directory";
  errorCode: NodeToolchainProvisionerBootstrapInstallationErrorCodeV2;
}>): void {
  let stat: BigIntStats;
  try {
    stat = lstatSync(input.absolutePath, { bigint: true });
  } catch (error) {
    return fail(
      input.errorCode,
      "Bootstrap installation cleanup object identity could not be captured exactly",
      error,
    );
  }
  if (
    !matchesExactStableFilesystemObjectV2({
      stat,
      expected: input.expected,
      objectKind: input.objectKind,
    })
  ) {
    return fail(
      input.errorCode,
      "Bootstrap installation cleanup object kind or stable identity changed",
    );
  }
}

function assertDirectory(input: Readonly<{
  absolutePath: string;
  expectedOwner: OwnerV2;
  allowedModes: readonly number[];
  errorCode: NodeToolchainProvisionerBootstrapInstallationErrorCodeV2;
}>): FingerprintV2 {
  try {
    const before = lstatSync(input.absolutePath);
    const after = lstatSync(input.absolutePath);
    if (
      before.isSymbolicLink()
      || !before.isDirectory()
      || before.uid !== input.expectedOwner.uid
      || before.gid !== input.expectedOwner.gid
      || !input.allowedModes.includes(modeBits(before))
      || !sameFingerprint(fingerprint(before), fingerprint(after))
    ) {
      return fail(input.errorCode, "Bootstrap installation directory boundary is invalid");
    }
    const captured = fingerprint(after);
    assertExactDirectoryStableIdentityV2({
      absolutePath: input.absolutePath,
      expected: captured,
      errorCode: input.errorCode,
    });
    return captured;
  } catch (error) {
    if (error instanceof NodeToolchainProvisionerBootstrapInstallationErrorV2) throw error;
    return fail(input.errorCode, "Bootstrap installation directory could not be inspected", error);
  }
}

function createOwnedDirectory(input: Readonly<{
  absolutePath: string;
  mode: 0o700 | 0o755;
  expectedOwner: OwnerV2;
  errorCode: NodeToolchainProvisionerBootstrapInstallationErrorCodeV2;
}>): FingerprintV2 {
  try {
    mkdirSync(input.absolutePath, { mode: 0o700 });
    chownSync(input.absolutePath, input.expectedOwner.uid, input.expectedOwner.gid);
    chmodSync(input.absolutePath, input.mode);
    syncDirectory(input.absolutePath);
    syncDirectory(path.dirname(input.absolutePath));
    return assertDirectory({
      absolutePath: input.absolutePath,
      expectedOwner: input.expectedOwner,
      allowedModes: [input.mode],
      errorCode: input.errorCode,
    });
  } catch (error) {
    if (error instanceof NodeToolchainProvisionerBootstrapInstallationErrorV2) throw error;
    return fail(input.errorCode, "Bootstrap installation directory could not be created", error);
  }
}

function stableFileBytes(input: Readonly<{
  absolutePath: string;
  expectedOwner: OwnerV2;
  allowedModes: readonly number[];
  allowedLinks: readonly number[];
  maxBytes: number;
  expectedBytes?: Uint8Array;
  errorCode: NodeToolchainProvisionerBootstrapInstallationErrorCodeV2;
}>): Readonly<{ bytes: Buffer; fingerprint: FingerprintV2 }> {
  let descriptor: number | undefined;
  let bytes: Buffer | undefined;
  let released = false;
  try {
    const pathBefore = lstatSync(input.absolutePath);
    if (
      pathBefore.isSymbolicLink()
      || !pathBefore.isFile()
      || pathBefore.uid !== input.expectedOwner.uid
      || pathBefore.gid !== input.expectedOwner.gid
      || !input.allowedModes.includes(modeBits(pathBefore))
      || !input.allowedLinks.includes(pathBefore.nlink)
      || !Number.isSafeInteger(pathBefore.size)
      || pathBefore.size < 1
      || pathBefore.size > input.maxBytes
      || (input.expectedBytes && pathBefore.size !== input.expectedBytes.byteLength)
    ) {
      return fail(input.errorCode, "Bootstrap installation file metadata is invalid");
    }
    descriptor = openSync(
      input.absolutePath,
      constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK,
    );
    const before = fstatSync(descriptor);
    if (!sameFingerprint(fingerprint(pathBefore), fingerprint(before))) {
      return fail(input.errorCode, "Bootstrap installation file changed before its read");
    }
    bytes = Buffer.allocUnsafeSlow(before.size);
    let offset = 0;
    while (offset < bytes.byteLength) {
      const count = readSync(descriptor, bytes, offset, bytes.byteLength - offset, null);
      if (count < 1) return fail(input.errorCode, "Bootstrap installation file ended early");
      offset += count;
    }
    const eof = Buffer.allocUnsafe(1);
    if (readSync(descriptor, eof, 0, 1, null) !== 0) {
      return fail(input.errorCode, "Bootstrap installation file exceeded its inspected length");
    }
    const after = fstatSync(descriptor);
    const pathAfter = lstatSync(input.absolutePath);
    if (
      !sameFingerprint(fingerprint(before), fingerprint(after))
      || !sameFingerprint(fingerprint(after), fingerprint(pathAfter))
      || (input.expectedBytes && !bytes.equals(input.expectedBytes))
    ) {
      return fail(input.errorCode, "Bootstrap installation file bytes changed or mismatched");
    }
    released = true;
    return Object.freeze({ bytes, fingerprint: fingerprint(after) });
  } catch (error) {
    if (error instanceof NodeToolchainProvisionerBootstrapInstallationErrorV2) throw error;
    return fail(input.errorCode, "Bootstrap installation file could not be read", error);
  } finally {
    if (!released) bytes?.fill(0);
    closeQuietly(descriptor);
  }
}

function writeExclusiveFile(input: Readonly<{
  absolutePath: string;
  bytes: Uint8Array;
  mode: 0o400 | 0o444 | 0o500 | 0o555 | 0o600;
  expectedOwner: OwnerV2;
  errorCode: NodeToolchainProvisionerBootstrapInstallationErrorCodeV2;
}>): FingerprintV2 {
  let descriptor: number | undefined;
  try {
    descriptor = openSync(
      input.absolutePath,
      constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW,
      0o600,
    );
    fchownSync(descriptor, input.expectedOwner.uid, input.expectedOwner.gid);
    fchmodSync(descriptor, input.mode);
    let offset = 0;
    while (offset < input.bytes.byteLength) {
      const written = writeSync(
        descriptor,
        input.bytes,
        offset,
        input.bytes.byteLength - offset,
        null,
      );
      if (written < 1) {
        return fail(input.errorCode, "Bootstrap installation file write made no progress");
      }
      offset += written;
    }
    fsyncSync(descriptor);
    const descriptorFingerprint = fingerprint(fstatSync(descriptor));
    closeSync(descriptor);
    descriptor = undefined;
    const pathFingerprint = fingerprint(lstatSync(input.absolutePath));
    if (!sameFingerprint(descriptorFingerprint, pathFingerprint)) {
      return fail(input.errorCode, "Bootstrap installation file changed during publication");
    }
    return pathFingerprint;
  } catch (error) {
    if (error instanceof NodeToolchainProvisionerBootstrapInstallationErrorV2) throw error;
    return fail(input.errorCode, "Bootstrap installation file publication failed", error);
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

function assertLegacyNodeRegistryCutoverAbsentV2(
  paths: Readonly<{ parent: string }>,
): void {
  const activationReceiptPath = path.join(
    paths.parent,
    PLATFORM_RELEASE_BOOTSTRAP_CONTRACT_V2.registry.activationReceiptBasename,
  );
  if (optionalFingerprint(activationReceiptPath) !== undefined) {
    return fail(
      "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_V2_LOCK_FAILED",
      "Registry activation receipt is present; legacy-only Node mutation is forbidden and requires the shared-parent then package-lock adapter",
    );
  }
}

function ensureProductionParent(
  paths: NodeToolchainProvisionerBootstrapInstallationPathsV2,
): Readonly<{ expectedOwner: OwnerV2; parentMode: 0o755 }> {
  if (
    paths.root !== NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_ROOT_V2
    || paths.setfarmRoot !== NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_SETFARM_ROOT_V2
    || typeof process.getuid !== "function"
    || typeof process.getgid !== "function"
    || process.getuid() !== 0
    || process.getgid() !== 0
  ) {
    return fail(
      "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_V2_SCOPE_INVALID",
      "Production bootstrap installation requires the root process and fixed target",
    );
  }
  const system = lstatSync(paths.systemAncestor);
  if (
    system.isSymbolicLink()
    || !system.isDirectory()
    || system.uid !== 0
    || modeBits(system) !== 0o755
  ) {
    return fail(
      "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_V2_PARENT_INVALID",
      "Production bootstrap system ancestor is not exact root-owned mode 0755",
    );
  }
  const owner = Object.freeze({ uid: 0, gid: 0 });
  for (const directory of [paths.setfarmRoot, paths.parent]) {
    if (!optionalFingerprint(directory)) {
      try {
        createOwnedDirectory({
          absolutePath: directory,
          mode: 0o755,
          expectedOwner: owner,
          errorCode: "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_V2_PARENT_INVALID",
        });
      } catch (error) {
        if (!isWrappedNodeError(error, "EEXIST")) throw error;
      }
    }
    assertDirectory({
      absolutePath: directory,
      expectedOwner: owner,
      allowedModes: [0o755],
      errorCode: "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_V2_PARENT_INVALID",
    });
  }
  return Object.freeze({ expectedOwner: owner, parentMode: 0o755 as const });
}

function testParent(
  paths: NodeToolchainProvisionerBootstrapInstallationPathsV2,
): Readonly<{ expectedOwner: OwnerV2; parentMode: 0o700 }> {
  if (
    paths.root === NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_ROOT_V2
    || typeof process.getuid !== "function"
    || typeof process.getgid !== "function"
  ) {
    return fail(
      "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_V2_SCOPE_INVALID",
      "Test bootstrap installation cannot target the production root",
    );
  }
  const expectedOwner = Object.freeze({ uid: process.getuid(), gid: process.getgid() });
  assertDirectory({
    absolutePath: paths.parent,
    expectedOwner,
    allowedModes: [0o700],
    errorCode: "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_V2_PARENT_INVALID",
  });
  return Object.freeze({ expectedOwner, parentMode: 0o700 as const });
}

function assertParentCensus(
  paths: NodeToolchainProvisionerBootstrapInstallationPathsV2,
  expectedOwner: OwnerV2,
  parentMode: 0o700 | 0o755,
): NodeToolchainProvisionerBootstrapRollbackHistoryV2 {
  try {
    const before = assertDirectory({
      absolutePath: paths.parent,
      expectedOwner,
      allowedModes: [parentMode],
      errorCode: "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_V2_PARENT_INVALID",
    });
    const names = readdirSync(paths.parent).sort();
    const allowed = new Set([
      path.basename(paths.root),
      path.basename(paths.receipt),
      path.basename(paths.claim),
      path.basename(paths.lock),
      path.basename(paths.staging),
    ]);
    const rollbackHistoryEntries: NodeToolchainProvisionerBootstrapRollbackHistoryEntryV2[] = [];
    const rollbackReceiptCaptures: Readonly<{
      absolutePath: string;
      fingerprint: FingerprintV2;
    }>[] = [];
    const after = assertDirectory({
      absolutePath: paths.parent,
      expectedOwner,
      allowedModes: [parentMode],
      errorCode: "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_V2_PARENT_INVALID",
    });
    for (const name of names) {
      if (allowed.has(name)) continue;
      if (!ROLLBACK_RECEIPT_BASENAME_PATTERN_V2.test(name)) {
        return fail(
          "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_V2_CONFLICT",
          "Bootstrap installation parent contains an artifact outside the exact source lifecycle",
        );
      }
      const absolutePath = path.join(paths.parent, name);
      const rollbackReceipt = assertHistoricalBootstrapRollbackReceipt({
        absolutePath,
        parent: paths.parent,
        expectedOwner,
        errorCode: "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_V2_CONFLICT",
      });
      rollbackHistoryEntries.push({
        installationReceiptHash:
          rollbackReceipt.value.removedGeneration.installationReceiptHash,
        rollbackReceiptHash: rollbackReceipt.value.receiptHash,
        rollbackReceiptLocatorHash: rollbackReceipt.value.receiptFile.locatorHash,
      });
      rollbackReceiptCaptures.push({
        absolutePath,
        fingerprint: rollbackReceipt.fingerprint,
      });
    }
    const finalNames = readdirSync(paths.parent).sort();
    const final = assertDirectory({
      absolutePath: paths.parent,
      expectedOwner,
      allowedModes: [parentMode],
      errorCode: "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_V2_PARENT_INVALID",
    });
    if (
      !sameFingerprint(before, after)
      || !sameFingerprint(after, final)
      || names.length !== finalNames.length
      || names.some((name, index) => name !== finalNames[index])
      || rollbackReceiptCaptures.some((capture) =>
        !sameFingerprint(capture.fingerprint, fingerprint(lstatSync(capture.absolutePath))))
    ) {
      return fail(
        "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_V2_CONFLICT",
        "Bootstrap installation parent changed during its exact lifecycle census",
      );
    }
    return buildNodeToolchainProvisionerBootstrapRollbackHistoryV2(rollbackHistoryEntries);
  } catch (error) {
    if (error instanceof NodeToolchainProvisionerBootstrapInstallationErrorV2) throw error;
    return fail(
      "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_V2_PARENT_INVALID",
      "Bootstrap installation parent census failed",
      error,
    );
  }
}

function ensureLock(
  paths: NodeToolchainProvisionerBootstrapInstallationPathsV2,
  expectedOwner: OwnerV2,
): void {
  if (!optionalFingerprint(paths.lock)) {
    try {
      writeExclusiveFile({
        absolutePath: paths.lock,
        bytes: LOCK_FILE_BYTES_V2,
        mode: 0o600,
        expectedOwner,
        errorCode: "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_V2_PARENT_INVALID",
      });
      syncDirectory(paths.parent);
    } catch (error) {
      if (!isWrappedNodeError(error, "EEXIST")) throw error;
    }
  }
  const lock = stableFileBytes({
    absolutePath: paths.lock,
    expectedOwner,
    allowedModes: [0o600],
    allowedLinks: [1],
    maxBytes: LOCK_FILE_BYTES_V2.byteLength,
    expectedBytes: LOCK_FILE_BYTES_V2,
    errorCode: "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_V2_PARENT_INVALID",
  });
  lock.bytes.fill(0);
}

function parsePlan(value: unknown): NodeToolchainProvisionerBootstrapInstallationPlanV2 {
  try {
    const parsed = NodeToolchainProvisionerBootstrapInstallationPlanV2Schema.safeParse(value);
    if (!parsed.success || parsed.data.decision === "no_mutation_blocked") {
      return fail(
        "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_V2_INPUT_INVALID",
        "Bootstrap installer requires one exact actionable V2 plan",
        parsed.success ? undefined : parsed.error,
      );
    }
    return deepFreezeJson(parsed.data);
  } catch (error) {
    if (error instanceof NodeToolchainProvisionerBootstrapInstallationErrorV2) throw error;
    return fail(
      "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_V2_INPUT_INVALID",
      "Bootstrap installation plan could not be inspected safely",
      error,
    );
  }
}

function assertPlanDecisionCurrent(
  submitted: NodeToolchainProvisionerBootstrapInstallationPlanV2,
  current: NodeToolchainProvisionerBootstrapInstallationPlanV2,
): void {
  const submittedRollbackHistory = submitted.inspection.predecessorRollbackHistory;
  const currentRollbackHistory = current.inspection.predecessorRollbackHistory;
  if (
    current.intent.intentHash !== submitted.intent.intentHash
    || !canonicalJsonBytes(current.intent).equals(canonicalJsonBytes(submitted.intent))
    || submittedRollbackHistory.status !== "verified"
    || currentRollbackHistory.status !== "verified"
    || !sameRollbackHistory(
      submittedRollbackHistory.summary,
      currentRollbackHistory.summary,
    )
  ) {
    return fail(
      "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_V2_PRECONDITION_CHANGED",
      "Bootstrap installation source or target intent changed after planning",
    );
  }
  if (current.decision === "no_mutation_blocked") {
    return fail(
      "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_V2_CONFLICT",
      "Fresh bootstrap installation evidence blocks every mutation",
    );
  }
  const allowedCurrentDecisions = submitted.decision === "publish_new"
    ? new Set(["publish_new", "recover_claimed", "return_ready"] as const)
    : submitted.decision === "recover_claimed"
      ? new Set(["recover_claimed", "return_ready"] as const)
      : new Set(["return_ready"] as const);
  if (!allowedCurrentDecisions.has(current.decision)) {
    return fail(
      "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_V2_PRECONDITION_CHANGED",
      "Bootstrap installation lifecycle moved outside the submitted plan decision",
    );
  }
}

function expectedFileSpecs(
  snapshot: NodeToolchainProvisionerBootstrapPreparedPackageSnapshotV2,
): readonly Readonly<{ locator: string; bytes: Buffer; mode: 0o444 | 0o555 }>[] {
  return Object.freeze([
    Object.freeze({
      locator: NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_LAUNCHER_LOCATOR_V2,
      bytes: snapshot.launcherBytes,
      mode: 0o555 as const,
    }),
    Object.freeze({
      locator: NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_BUNDLE_LOCATOR_V2,
      bytes: snapshot.bundleBytes,
      mode: 0o444 as const,
    }),
    Object.freeze({
      locator: NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_RUNTIME_LOCATOR_V2,
      bytes: snapshot.runtimeBytes,
      mode: 0o555 as const,
    }),
    Object.freeze({
      locator: NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_MANIFEST_LOCATOR_V2,
      bytes: snapshot.manifestBytes,
      mode: 0o444 as const,
    }),
  ]);
}

function publishCanonicalNoReplace(input: Readonly<{
  stagePath: string;
  targetPath: string;
  bytes: Uint8Array;
  expectedOwner: OwnerV2;
  afterStage?: () => void;
  afterLink?: () => void;
}>): void {
  const targetExisting = optionalFingerprint(input.targetPath);
  const stageExisting = optionalFingerprint(input.stagePath);
  if (!targetExisting && !stageExisting) {
    writeExclusiveFile({
      absolutePath: input.stagePath,
      bytes: input.bytes,
      mode: 0o444,
      expectedOwner: input.expectedOwner,
      errorCode: "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_V2_PUBLICATION_FAILED",
    });
    syncDirectory(path.dirname(input.stagePath));
    input.afterStage?.();
  }
  const stage = stableFileBytes({
    absolutePath: input.stagePath,
    expectedOwner: input.expectedOwner,
    allowedModes: [0o444],
    allowedLinks: targetExisting ? [2] : [1],
    maxBytes: Math.max(input.bytes.byteLength, 1),
    expectedBytes: input.bytes,
    errorCode: "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_V2_CONFLICT",
  });
  stage.bytes.fill(0);
  if (!targetExisting) {
    try {
      linkSync(input.stagePath, input.targetPath);
    } catch (error) {
      if (!isNodeError(error, "EEXIST")) {
        return fail(
          "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_V2_PUBLICATION_FAILED",
          "Bootstrap canonical authority could not be linked without replacement",
          error,
        );
      }
    }
    syncDirectory(path.dirname(input.targetPath));
    input.afterLink?.();
  }
  const target = stableFileBytes({
    absolutePath: input.targetPath,
    expectedOwner: input.expectedOwner,
    allowedModes: [0o444],
    allowedLinks: [2],
    maxBytes: Math.max(input.bytes.byteLength, 1),
    expectedBytes: input.bytes,
    errorCode: "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_V2_CONFLICT",
  });
  const stageAfter = fingerprint(lstatSync(input.stagePath));
  if (!samePhysicalIdentity(target.fingerprint, stageAfter)) {
    target.bytes.fill(0);
    return fail(
      "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_V2_CONFLICT",
      "Bootstrap canonical target and stage are not one exact inode",
    );
  }
  target.bytes.fill(0);
  assertExactObjectStableIdentityV2({
    absolutePath: input.stagePath,
    expected: target.fingerprint,
    objectKind: "ordinary_file",
    errorCode: "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_V2_CONFLICT",
  });
  unlinkSync(input.stagePath);
  syncDirectory(path.dirname(input.stagePath));
  const final = stableFileBytes({
    absolutePath: input.targetPath,
    expectedOwner: input.expectedOwner,
    allowedModes: [0o444],
    allowedLinks: [1],
    maxBytes: Math.max(input.bytes.byteLength, 1),
    expectedBytes: input.bytes,
    errorCode: "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_V2_PUBLICATION_FAILED",
  });
  final.bytes.fill(0);
}

function readCanonicalFile<T>(input: Readonly<{
  absolutePath: string;
  expectedOwner: OwnerV2;
  schema: { safeParse(value: unknown): { success: true; data: T } | { success: false; error: unknown } };
  allowedLinks?: readonly (1 | 2)[];
  errorCode: NodeToolchainProvisionerBootstrapInstallationErrorCodeV2;
}>): Readonly<{ value: T; bytes: Buffer; fingerprint: FingerprintV2 }> {
  const captured = stableFileBytes({
    absolutePath: input.absolutePath,
    expectedOwner: input.expectedOwner,
    allowedModes: [0o444],
    allowedLinks: input.allowedLinks ?? [1],
    maxBytes: MAX_CANONICAL_BYTES_V2,
    errorCode: input.errorCode,
  });
  try {
    const raw = JSON.parse(captured.bytes.toString("utf8"));
    const parsed = input.schema.safeParse(raw);
    if (!parsed.success || !captured.bytes.equals(canonicalJsonBytes(parsed.success ? parsed.data : raw))) {
      captured.bytes.fill(0);
      return fail(input.errorCode, "Bootstrap installation authority is not exact canonical JSON");
    }
    return Object.freeze({
      value: deepFreezeJson(parsed.data),
      bytes: captured.bytes,
      fingerprint: captured.fingerprint,
    });
  } catch (error) {
    captured.bytes.fill(0);
    if (error instanceof NodeToolchainProvisionerBootstrapInstallationErrorV2) throw error;
    return fail(input.errorCode, "Bootstrap installation authority could not be decoded", error);
  }
}

function assertHistoricalBootstrapRollbackReceipt(input: Readonly<{
  absolutePath: string;
  parent: string;
  expectedOwner: OwnerV2;
  activeReceiptStage?: string;
  errorCode: NodeToolchainProvisionerBootstrapInstallationErrorCodeV2;
}>): Readonly<{
  value: NodeToolchainProvisionerBootstrapRollbackReceiptV2;
  fingerprint: FingerprintV2;
}> {
  const allowStageAlias = input.activeReceiptStage !== undefined;
  const captured = readCanonicalFile({
    absolutePath: input.absolutePath,
    expectedOwner: input.expectedOwner,
    schema: NodeToolchainProvisionerBootstrapRollbackReceiptV2Schema,
    allowedLinks: allowStageAlias ? [1, 2] : [1],
    errorCode: input.errorCode,
  });
  try {
    const receiptPaths = getNodeToolchainProvisionerBootstrapRollbackPathsV2(
      captured.value.claim.plan.installed,
    );
    if (
      receiptPaths.parent !== input.parent
      || receiptPaths.rollbackReceipt !== input.absolutePath
      || captured.value.receiptFile.ownerUid !== input.expectedOwner.uid
      || captured.value.receiptFile.ownerGid !== input.expectedOwner.gid
      || (captured.fingerprint.linkCount === 2
        && (
          input.activeReceiptStage !== receiptPaths.rollbackReceiptStage
          || !optionalFingerprint(receiptPaths.rollbackReceiptStage)
          || !samePhysicalIdentity(
            captured.fingerprint,
            fingerprint(lstatSync(receiptPaths.rollbackReceiptStage)),
          )
        ))
    ) {
      return fail(
        input.errorCode,
        "Bootstrap rollback tombstone is not bound to this exact parent and publication inode",
      );
    }
    return Object.freeze({ value: captured.value, fingerprint: captured.fingerprint });
  } finally {
    captured.bytes.fill(0);
  }
}

function sameClaim(
  left: NodeToolchainProvisionerBootstrapInstallationClaimV2,
  right: NodeToolchainProvisionerBootstrapInstallationClaimV2,
): boolean {
  return left.claimHash === right.claimHash;
}

function sameRollbackHistory(
  left: NodeToolchainProvisionerBootstrapRollbackHistoryV2,
  right: NodeToolchainProvisionerBootstrapRollbackHistoryV2,
): boolean {
  return left.receiptCount === right.receiptCount
    && left.historyHash === right.historyHash;
}

function openInstalledPackage(
  admissionScope: AdmissionScopeV2,
  paths: NodeToolchainProvisionerBootstrapInstallationPathsV2,
  expectedOwner: OwnerV2,
): string {
  try {
    const handle = admissionScope === "production_release"
      ? openProductionNodeToolchainProvisionerBootstrapPackageV2()
      : openNodeToolchainProvisionerBootstrapPackageV2ForTest({
          root: paths.root,
          expectedOwner,
        });
    return revalidateNodeToolchainProvisionerBootstrapPackageV2(handle).manifestHash;
  } catch (error) {
    return fail(
      "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_V2_PACKAGE_INVALID",
      "Installed bootstrap package failed its every-only verifier",
      error,
    );
  }
}

function buildReceipt(input: Readonly<{
  claim: NodeToolchainProvisionerBootstrapInstallationClaimV2;
  rootFingerprint: FingerprintV2;
  predecessorRollbackHistory: NodeToolchainProvisionerBootstrapRollbackHistoryV2;
  lease: DarwinParentDescriptorLeaseV2;
}>): NodeToolchainProvisionerBootstrapInstallationReceiptV2 {
  const intent = input.claim.intent;
  const identity: NodeToolchainProvisionerBootstrapInstallationReceiptHashPayloadV2 = {
    schema: NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_RECEIPT_V2_SCHEMA,
    receiptVersion: NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_VERSION_V2,
    authorityRef: intent.authorityRef,
    status: "installed_verified",
    admissionScope: intent.admissionScope,
    claim: input.claim,
    predecessorRollbackHistory: input.predecessorRollbackHistory,
    publisher: {
      contractRef: "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLER_V2",
      lockExecutionPolicy: input.lease.evidence.executionPolicy,
      lockf: input.lease.evidence.lockf,
      lockHelper: input.lease.evidence.lockHelper,
    },
    finalRoot: {
      rootLocatorHash: intent.target.rootLocatorHash,
      manifestHash: intent.source.source.manifestHash,
      architecture: intent.architecture,
      device: input.rootFingerprint.device,
      inode: input.rootFingerprint.inode,
      ownerUid: input.rootFingerprint.ownerUid,
      ownerGid: input.rootFingerprint.ownerGid,
      mode: "0555",
      fileCount: 4,
      directoryCount: 4,
      totalBytes: intent.source.storage.totalBytes,
      treeHash: hashNodeToolchainProvisionerBootstrapInstalledTreeV2(intent.source),
    },
    claimFile: {
      locatorHash: intent.target.claimLocatorHash,
      mode: "0444",
      ownerUid: intent.target.expectedOwnerUid,
      ownerGid: intent.target.expectedOwnerGid,
      linkCount: 1,
    },
    receiptFile: {
      locatorHash: intent.target.receiptLocatorHash,
      mode: "0444",
      ownerUid: intent.target.expectedOwnerUid,
      ownerGid: intent.target.expectedOwnerGid,
      linkCount: 1,
      publicationPolicy: "canonical_stage_hard_link_no_replace_fsync_v2",
    },
  };
  const parsed = NodeToolchainProvisionerBootstrapInstallationReceiptV2Schema.safeParse({
    ...identity,
    receiptHash: hashNodeToolchainProvisionerBootstrapInstallationReceiptV2(identity),
  });
  if (!parsed.success) {
    return fail(
      "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_V2_RECEIPT_INVALID",
      "Fresh bootstrap installation receipt failed its exact schema",
      parsed.error,
    );
  }
  return deepFreezeJson(parsed.data);
}

type ExpectedPartialEntryV2 = Readonly<{
  type: "directory" | "file";
  bytes?: Buffer;
  allowedModes: readonly number[];
}>;

function expectedTreeEntries(
  snapshot: NodeToolchainProvisionerBootstrapPreparedPackageSnapshotV2,
  root: string,
): ReadonlyMap<string, ExpectedPartialEntryV2> {
  const directoryModes = root.endsWith(PAYLOAD_STAGE_BASENAME_V2) ? [0o700] : [0o555];
  const entries = new Map<string, ExpectedPartialEntryV2>([
    [".", { type: "directory", allowedModes: directoryModes }],
    ["bin", { type: "directory", allowedModes: directoryModes }],
    ["lib", { type: "directory", allowedModes: directoryModes }],
    ["runtime", { type: "directory", allowedModes: directoryModes }],
  ]);
  for (const spec of expectedFileSpecs(snapshot)) {
    entries.set(spec.locator, {
      type: "file",
      bytes: spec.bytes,
      allowedModes: [spec.mode],
    });
  }
  return entries;
}

function capturePartialTree(input: Readonly<{
  root: string;
  expectedOwner: OwnerV2;
  expectedEntries: ReadonlyMap<string, ExpectedPartialEntryV2>;
}>): readonly CapturedEntryV2[] {
  if (!optionalFingerprint(input.root)) return Object.freeze([]);
  const captures: CapturedEntryV2[] = [];
  const pending = ["."];
  while (pending.length > 0) {
    const relativePath = pending.pop()!;
    const expected = input.expectedEntries.get(relativePath);
    if (!expected) {
      return fail(
        "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_V2_RECOVERY_FAILED",
        "Bootstrap recovery found an entry outside its exact prepared source",
      );
    }
    const absolutePath = relativePath === "." ? input.root : path.join(input.root, relativePath);
    const before = lstatSync(absolutePath);
    if (
      before.isSymbolicLink()
      || before.uid !== input.expectedOwner.uid
      || before.gid !== input.expectedOwner.gid
      || !expected.allowedModes.includes(modeBits(before))
      || (expected.type === "directory" && !before.isDirectory())
      || (expected.type === "file" && !before.isFile())
    ) {
      return fail(
        "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_V2_RECOVERY_FAILED",
        "Bootstrap recovery entry metadata differs from its exact claim",
      );
    }
    if (expected.type === "directory") {
      const names = readdirSync(absolutePath).sort();
      for (const name of names) {
        const child = relativePath === "." ? name : `${relativePath}/${name}`;
        if (!input.expectedEntries.has(child)) {
          return fail(
            "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_V2_RECOVERY_FAILED",
            "Bootstrap recovery tree contains a foreign member",
          );
        }
        pending.push(child);
      }
    } else if (expected.bytes) {
      const file = stableFileBytes({
        absolutePath,
        expectedOwner: input.expectedOwner,
        allowedModes: expected.allowedModes,
        allowedLinks: [1, 2],
        maxBytes: expected.bytes.byteLength,
        expectedBytes: expected.bytes,
        errorCode: "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_V2_RECOVERY_FAILED",
      });
      file.bytes.fill(0);
    }
    const after = lstatSync(absolutePath);
    if (!sameFingerprint(fingerprint(before), fingerprint(after))) {
      return fail(
        "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_V2_RECOVERY_FAILED",
        "Bootstrap recovery entry changed during bounded capture",
      );
    }
    captures.push(Object.freeze({
      absolutePath,
      relativePath,
      type: expected.type,
      fingerprint: fingerprint(after),
    }));
  }
  return Object.freeze(captures);
}

function removeCapturedTrees(captures: readonly CapturedEntryV2[]): void {
  if (captures.length === 0) return;
  for (const entry of captures) {
    const current = fingerprint(lstatSync(entry.absolutePath));
    if (!sameFingerprint(current, entry.fingerprint)) {
      return fail(
        "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_V2_RECOVERY_FAILED",
        "Bootstrap recovery tree changed before removal",
      );
    }
  }
  const directories = captures
    .filter((entry) => entry.type === "directory")
    .sort((left, right) => left.relativePath.length - right.relativePath.length);
  for (const directory of directories) chmodSync(directory.absolutePath, 0o700);
  for (const file of captures.filter((entry) => entry.type === "file")) {
    assertExactObjectStableIdentityV2({
      absolutePath: file.absolutePath,
      expected: file.fingerprint,
      objectKind: "ordinary_file",
      errorCode: "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_V2_RECOVERY_FAILED",
    });
    unlinkSync(file.absolutePath);
  }
  for (const directory of [...directories].reverse()) {
    if (directory.relativePath === ".") {
      assertExactDirectoryStableIdentityV2({
        absolutePath: directory.absolutePath,
        expected: directory.fingerprint,
        errorCode: "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_V2_RECOVERY_FAILED",
      });
    } else {
      assertExactObjectStableIdentityV2({
        absolutePath: directory.absolutePath,
        expected: directory.fingerprint,
        objectKind: "directory",
        errorCode: "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_V2_RECOVERY_FAILED",
      });
    }
    rmdirSync(directory.absolutePath);
  }
}

function removeCapturedTree(captures: readonly CapturedEntryV2[]): void {
  removeCapturedTrees(captures);
}

function stageExpectedEntries(input: Readonly<{
  snapshot: NodeToolchainProvisionerBootstrapPreparedPackageSnapshotV2;
  claimBytes: Buffer;
  receiptBytes?: Buffer;
}>): ReadonlyMap<string, ExpectedPartialEntryV2> {
  const entries = new Map<string, ExpectedPartialEntryV2>([
    [".", { type: "directory", allowedModes: [0o700] }],
    [CLAIM_STAGE_BASENAME_V2, {
      type: "file",
      bytes: input.claimBytes,
      allowedModes: [0o444],
    }],
    [PAYLOAD_STAGE_BASENAME_V2, { type: "directory", allowedModes: [0o700] }],
    [`${PAYLOAD_STAGE_BASENAME_V2}/bin`, {
      type: "directory",
      allowedModes: [0o700],
    }],
    [`${PAYLOAD_STAGE_BASENAME_V2}/lib`, {
      type: "directory",
      allowedModes: [0o700],
    }],
    [`${PAYLOAD_STAGE_BASENAME_V2}/runtime`, {
      type: "directory",
      allowedModes: [0o700],
    }],
  ]);
  if (input.receiptBytes) {
    entries.set(RECEIPT_STAGE_BASENAME_V2, {
      type: "file",
      bytes: input.receiptBytes,
      allowedModes: [0o444],
    });
  }
  for (const spec of expectedFileSpecs(input.snapshot)) {
    entries.set(`${PAYLOAD_STAGE_BASENAME_V2}/${spec.locator}`, {
      type: "file",
      bytes: spec.bytes,
      allowedModes: [spec.mode],
    });
  }
  return entries;
}

function validateHardLinks(input: Readonly<{
  captures: readonly CapturedEntryV2[];
  claimPath: string;
  receiptPath: string;
}>): void {
  const all = [...input.captures];
  for (const absolutePath of [input.claimPath, input.receiptPath]) {
    if (!optionalFingerprint(absolutePath)) continue;
    const stat = lstatSync(absolutePath);
    all.push(Object.freeze({
      absolutePath,
      relativePath: absolutePath,
      type: "file" as const,
      fingerprint: fingerprint(stat),
    }));
  }
  const groups = new Map<string, CapturedEntryV2[]>();
  for (const entry of all.filter((candidate) => candidate.type === "file")) {
    const key = `${entry.fingerprint.device}:${entry.fingerprint.inode}`;
    const group = groups.get(key) ?? [];
    group.push(entry);
    groups.set(key, group);
  }
  for (const group of groups.values()) {
    const expectedLinks = group[0]!.fingerprint.linkCount;
    if (
      expectedLinks < 1
      || expectedLinks > 2
      || group.some((entry) => entry.fingerprint.linkCount !== expectedLinks)
      || group.length !== expectedLinks
    ) {
      return fail(
        "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_V2_RECOVERY_FAILED",
        "Bootstrap recovery refuses an external or incomplete hard-link alias",
      );
    }
  }
}

function materializePayloadStage(input: Readonly<{
  paths: NodeToolchainProvisionerBootstrapInstallationPathsV2;
  expectedOwner: OwnerV2;
  snapshot: NodeToolchainProvisionerBootstrapPreparedPackageSnapshotV2;
}>): string {
  const payloadRoot = path.join(input.paths.staging, PAYLOAD_STAGE_BASENAME_V2);
  createOwnedDirectory({
    absolutePath: payloadRoot,
    mode: 0o700,
    expectedOwner: input.expectedOwner,
    errorCode: "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_V2_PUBLICATION_FAILED",
  });
  for (const directory of ["bin", "lib", "runtime"] as const) {
    createOwnedDirectory({
      absolutePath: path.join(payloadRoot, directory),
      mode: 0o700,
      expectedOwner: input.expectedOwner,
      errorCode: "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_V2_PUBLICATION_FAILED",
    });
  }
  for (const spec of expectedFileSpecs(input.snapshot)) {
    writeExclusiveFile({
      absolutePath: path.join(payloadRoot, spec.locator),
      bytes: spec.bytes,
      mode: spec.mode,
      expectedOwner: input.expectedOwner,
      errorCode: "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_V2_PUBLICATION_FAILED",
    });
    syncDirectory(path.dirname(path.join(payloadRoot, spec.locator)));
  }
  capturePartialTree({
    root: payloadRoot,
    expectedOwner: input.expectedOwner,
    expectedEntries: expectedTreeEntries(input.snapshot, payloadRoot),
  });
  return payloadRoot;
}

function publishPayloadRoot(input: Readonly<{
  paths: NodeToolchainProvisionerBootstrapInstallationPathsV2;
  expectedOwner: OwnerV2;
  snapshot: NodeToolchainProvisionerBootstrapPreparedPackageSnapshotV2;
  hooks?: NodeToolchainProvisionerBootstrapInstallationTestHooksV2;
}>): void {
  const payloadRoot = path.join(input.paths.staging, PAYLOAD_STAGE_BASENAME_V2);
  createOwnedDirectory({
    absolutePath: input.paths.root,
    mode: 0o700,
    expectedOwner: input.expectedOwner,
    errorCode: "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_V2_PUBLICATION_FAILED",
  });
  for (const directory of ["bin", "lib", "runtime"] as const) {
    createOwnedDirectory({
      absolutePath: path.join(input.paths.root, directory),
      mode: 0o700,
      expectedOwner: input.expectedOwner,
      errorCode: "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_V2_PUBLICATION_FAILED",
    });
  }
  input.hooks?.afterRootCreated?.();
  let index = 0;
  for (const spec of expectedFileSpecs(input.snapshot)) {
    try {
      linkSync(
        path.join(payloadRoot, spec.locator),
        path.join(input.paths.root, spec.locator),
      );
    } catch (error) {
      return fail(
        "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_V2_PUBLICATION_FAILED",
        "Bootstrap payload member could not be hard-linked without replacement",
        error,
      );
    }
    syncDirectory(path.dirname(path.join(input.paths.root, spec.locator)));
    index += 1;
    if (index === 2) input.hooks?.afterSecondMemberLinked?.();
  }
  const stageCapture = capturePartialTree({
    root: payloadRoot,
    expectedOwner: input.expectedOwner,
    expectedEntries: expectedTreeEntries(input.snapshot, payloadRoot),
  });
  const rootCapture = capturePartialTree({
    root: input.paths.root,
    expectedOwner: input.expectedOwner,
    expectedEntries: new Map<string, ExpectedPartialEntryV2>([
      [".", { type: "directory" as const, allowedModes: [0o700] }],
      ["bin", { type: "directory" as const, allowedModes: [0o700] }],
      ["lib", { type: "directory" as const, allowedModes: [0o700] }],
      ["runtime", { type: "directory" as const, allowedModes: [0o700] }],
      ...expectedFileSpecs(input.snapshot).map((spec) => [
        spec.locator,
        { type: "file" as const, bytes: spec.bytes, allowedModes: [spec.mode] },
      ] as const),
    ]),
  });
  validateHardLinks({
    captures: [...stageCapture, ...rootCapture],
    claimPath: input.paths.claim,
    receiptPath: input.paths.receipt,
  });
  const stageEntries = new Map(
    stageCapture.map((entry) => [entry.relativePath, entry] as const),
  );
  for (const spec of expectedFileSpecs(input.snapshot)) {
    const entry = stageEntries.get(spec.locator);
    if (!entry || entry.type !== "file") {
      return fail(
        "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_V2_PUBLICATION_FAILED",
        "Bootstrap payload cleanup lost an exact staged file capture",
      );
    }
    assertExactObjectStableIdentityV2({
      absolutePath: entry.absolutePath,
      expected: entry.fingerprint,
      objectKind: "ordinary_file",
      errorCode: "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_V2_PUBLICATION_FAILED",
    });
    unlinkSync(entry.absolutePath);
  }
  for (const directory of ["bin", "lib", "runtime"] as const) {
    const entry = stageEntries.get(directory);
    if (!entry || entry.type !== "directory") {
      return fail(
        "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_V2_PUBLICATION_FAILED",
        "Bootstrap payload cleanup lost an exact staged directory capture",
      );
    }
    assertExactObjectStableIdentityV2({
      absolutePath: entry.absolutePath,
      expected: entry.fingerprint,
      objectKind: "directory",
      errorCode: "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_V2_PUBLICATION_FAILED",
    });
    rmdirSync(entry.absolutePath);
  }
  const payloadEntry = stageEntries.get(".");
  if (!payloadEntry || payloadEntry.type !== "directory") {
    return fail(
      "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_V2_PUBLICATION_FAILED",
      "Bootstrap payload cleanup lost an exact staged root capture",
    );
  }
  assertExactDirectoryStableIdentityV2({
    absolutePath: payloadEntry.absolutePath,
    expected: payloadEntry.fingerprint,
    errorCode: "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_V2_PUBLICATION_FAILED",
  });
  rmdirSync(payloadEntry.absolutePath);
  syncDirectory(input.paths.staging);
  for (const directory of ["bin", "lib", "runtime"] as const) {
    chmodSync(path.join(input.paths.root, directory), 0o555);
    syncDirectory(path.join(input.paths.root, directory));
  }
  chmodSync(input.paths.root, 0o555);
  syncDirectory(input.paths.root);
  syncDirectory(input.paths.parent);
}

function receiptMatchesReadyRoot(input: Readonly<{
  receipt: NodeToolchainProvisionerBootstrapInstallationReceiptV2;
  claim: NodeToolchainProvisionerBootstrapInstallationClaimV2;
  paths: NodeToolchainProvisionerBootstrapInstallationPathsV2;
  expectedOwner: OwnerV2;
  predecessorRollbackHistory: NodeToolchainProvisionerBootstrapRollbackHistoryV2;
}>): FingerprintV2 {
  if (!sameClaim(input.receipt.claim, input.claim)) {
    return fail(
      "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_V2_RECEIPT_INVALID",
      "Bootstrap installation receipt does not carry the exact active claim",
    );
  }
  const manifestHash = openInstalledPackage(
    input.receipt.admissionScope,
    input.paths,
    input.expectedOwner,
  );
  const root = assertDirectory({
    absolutePath: input.paths.root,
    expectedOwner: input.expectedOwner,
    allowedModes: [0o555],
    errorCode: "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_V2_PACKAGE_INVALID",
  });
  if (
    manifestHash !== input.receipt.finalRoot.manifestHash
    || !sameRollbackHistory(
      input.receipt.predecessorRollbackHistory,
      input.predecessorRollbackHistory,
    )
    || root.device !== input.receipt.finalRoot.device
    || root.inode !== input.receipt.finalRoot.inode
  ) {
    return fail(
      "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_V2_RECEIPT_INVALID",
      "Bootstrap installation receipt no longer identifies the physical root",
    );
  }
  return root;
}

function makeHandle(input: InstalledStateV2): InstalledNodeToolchainProvisionerBootstrapV2 {
  return new InstalledNodeToolchainProvisionerBootstrapV2(handleCapabilityV2, Object.freeze(input));
}

async function install(input: Readonly<{
  expectedScope: AdmissionScopeV2;
  preparedHandle: PreparedNodeToolchainProvisionerBootstrapPackageV2;
  plan: unknown;
  hooks?: NodeToolchainProvisionerBootstrapInstallationTestHooksV2;
}>): Promise<InstalledNodeToolchainProvisionerBootstrapV2> {
  const plan = parsePlan(input.plan);
  const source = revalidateNodeToolchainProvisionerBootstrapPreparedPackageV2(input.preparedHandle);
  const expectedIntent = buildNodeToolchainProvisionerBootstrapInstallationIntentV2(source);
  if (
    source.admissionScope !== input.expectedScope
    || plan.intent.intentHash !== expectedIntent.intentHash
    || !canonicalJsonBytes(plan.intent).equals(canonicalJsonBytes(expectedIntent))
  ) {
    return fail(
      "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_V2_SCOPE_INVALID",
      "Bootstrap plan, prepared handle and requested installation scope do not join",
    );
  }
  const claim = buildNodeToolchainProvisionerBootstrapInstallationClaimV2(expectedIntent);
  const claimBytes = canonicalJsonBytes(claim);
  const paths = getNodeToolchainProvisionerBootstrapInstallationPathsV2(source);
  const boundary = input.expectedScope === "production_release"
    ? ensureProductionParent(paths)
    : testParent(paths);
  assertLegacyNodeRegistryCutoverAbsentV2(paths);
  assertParentCensus(paths, boundary.expectedOwner, boundary.parentMode);
  ensureLock(paths, boundary.expectedOwner);
  let lease: DarwinParentDescriptorLeaseV2 | undefined;
  let snapshot: NodeToolchainProvisionerBootstrapPreparedPackageSnapshotV2 | undefined;
  try {
    lease = await acquireDarwinParentDescriptorLeaseV2({
      parentPath: paths.parent,
      lockPath: paths.lock,
      lockBytes: LOCK_FILE_BYTES_V2,
      expectedOwner: boundary.expectedOwner,
      allowedParentModes: [boundary.parentMode],
    });
    lease.assertCurrent();
    input.hooks?.afterLegacyLeaseAcquired?.();
    assertLegacyNodeRegistryCutoverAbsentV2(paths);
    const predecessorRollbackHistory = assertParentCensus(
      paths,
      boundary.expectedOwner,
      boundary.parentMode,
    );
    const freshSource = revalidateNodeToolchainProvisionerBootstrapPreparedPackageV2(
      input.preparedHandle,
    );
    if (freshSource.receiptHash !== source.receiptHash) {
      return fail(
        "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_V2_DRIFT",
        "Prepared bootstrap authority changed after installation planning",
      );
    }
    const currentPlan = planNodeToolchainProvisionerBootstrapInstallationV2(
      input.preparedHandle,
    );
    assertPlanDecisionCurrent(plan, currentPlan);
    const currentRollbackHistory = currentPlan.inspection.predecessorRollbackHistory;
    if (
      currentRollbackHistory.status !== "verified"
      || !sameRollbackHistory(currentRollbackHistory.summary, predecessorRollbackHistory)
    ) {
      return fail(
        "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_V2_PRECONDITION_CHANGED",
        "Bootstrap installation rollback history differs between plan and parent census",
      );
    }
    snapshot = copyNodeToolchainProvisionerBootstrapPreparedPackageV2(input.preparedHandle);

    if (optionalFingerprint(paths.receipt)) {
      const claimRead = readCanonicalFile({
        absolutePath: paths.claim,
        expectedOwner: boundary.expectedOwner,
        schema: NodeToolchainProvisionerBootstrapInstallationClaimV2Schema,
        allowedLinks: [1, 2],
        errorCode: "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_V2_CONFLICT",
      });
      const receiptRead = readCanonicalFile({
        absolutePath: paths.receipt,
        expectedOwner: boundary.expectedOwner,
        schema: NodeToolchainProvisionerBootstrapInstallationReceiptV2Schema,
        allowedLinks: [1, 2],
        errorCode: "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_V2_RECEIPT_INVALID",
      });
      try {
        if (!sameClaim(claimRead.value, claim)) {
          return fail(
            "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_V2_CONFLICT",
            "Ready bootstrap installation belongs to a different claim",
          );
        }
        const rootFingerprint = receiptMatchesReadyRoot({
          receipt: receiptRead.value,
          claim,
          paths,
          expectedOwner: boundary.expectedOwner,
          predecessorRollbackHistory,
        });
        if (optionalFingerprint(paths.staging)) {
          const receiptBytes = canonicalJsonBytes(receiptRead.value);
          const captures = capturePartialTree({
            root: paths.staging,
            expectedOwner: boundary.expectedOwner,
            expectedEntries: stageExpectedEntries({
              snapshot,
              claimBytes,
              receiptBytes,
            }),
          });
          validateHardLinks({
            captures,
            claimPath: paths.claim,
            receiptPath: paths.receipt,
          });
          removeCapturedTree(captures);
          syncDirectory(paths.parent);
          receiptBytes.fill(0);
        }
        lease.assertCurrent();
        return makeHandle({
          admissionScope: input.expectedScope,
          paths,
          expectedOwner: boundary.expectedOwner,
          parentMode: boundary.parentMode,
          receipt: receiptRead.value,
          rootFingerprint,
        });
      } finally {
        claimRead.bytes.fill(0);
        receiptRead.bytes.fill(0);
      }
    }

    const claimExists = optionalFingerprint(paths.claim) !== undefined;
    if (claimExists) {
      const existing = readCanonicalFile({
        absolutePath: paths.claim,
        expectedOwner: boundary.expectedOwner,
        schema: NodeToolchainProvisionerBootstrapInstallationClaimV2Schema,
        allowedLinks: [1, 2],
        errorCode: "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_V2_CONFLICT",
      });
      try {
        if (!sameClaim(existing.value, claim)) {
          return fail(
            "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_V2_CONFLICT",
            "Interrupted bootstrap installation belongs to a different source claim",
          );
        }
      } finally {
        existing.bytes.fill(0);
      }
      let completeRoot = false;
      let rootFingerprint: FingerprintV2 | undefined;
      try {
        const manifestHash = openInstalledPackage(
          input.expectedScope,
          paths,
          boundary.expectedOwner,
        );
        rootFingerprint = assertDirectory({
          absolutePath: paths.root,
          expectedOwner: boundary.expectedOwner,
          allowedModes: [0o555],
          errorCode: "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_V2_PACKAGE_INVALID",
        });
        completeRoot = manifestHash === source.source.manifestHash;
      } catch {
        completeRoot = false;
      }
      if (completeRoot && rootFingerprint) {
        const receipt = buildReceipt({
          claim,
          rootFingerprint,
          predecessorRollbackHistory,
          lease,
        });
        const receiptBytes = canonicalJsonBytes(receipt);
        try {
          if (optionalFingerprint(paths.staging)) {
            const captures = capturePartialTree({
              root: paths.staging,
              expectedOwner: boundary.expectedOwner,
              expectedEntries: stageExpectedEntries({ snapshot, claimBytes, receiptBytes }),
            });
            validateHardLinks({
              captures,
              claimPath: paths.claim,
              receiptPath: paths.receipt,
            });
            removeCapturedTree(captures);
            syncDirectory(paths.parent);
          }
          createOwnedDirectory({
            absolutePath: paths.staging,
            mode: 0o700,
            expectedOwner: boundary.expectedOwner,
            errorCode: "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_V2_RECOVERY_FAILED",
          });
          publishCanonicalNoReplace({
            stagePath: path.join(paths.staging, RECEIPT_STAGE_BASENAME_V2),
            targetPath: paths.receipt,
            bytes: receiptBytes,
            expectedOwner: boundary.expectedOwner,
            afterStage: input.hooks?.afterReceiptStage,
            afterLink: input.hooks?.afterReceiptPublished,
          });
          rmdirSync(paths.staging);
          syncDirectory(paths.parent);
          return makeHandle({
            admissionScope: input.expectedScope,
            paths,
            expectedOwner: boundary.expectedOwner,
            parentMode: boundary.parentMode,
            receipt,
            rootFingerprint,
          });
        } finally {
          receiptBytes.fill(0);
        }
      }
      const stageCaptures = capturePartialTree({
        root: paths.staging,
        expectedOwner: boundary.expectedOwner,
        expectedEntries: stageExpectedEntries({ snapshot, claimBytes }),
      });
      const rootCaptures = capturePartialTree({
        root: paths.root,
        expectedOwner: boundary.expectedOwner,
        expectedEntries: new Map<string, ExpectedPartialEntryV2>([
          [".", { type: "directory" as const, allowedModes: [0o700, 0o555] }],
          ["bin", { type: "directory" as const, allowedModes: [0o700, 0o555] }],
          ["lib", { type: "directory" as const, allowedModes: [0o700, 0o555] }],
          ["runtime", { type: "directory" as const, allowedModes: [0o700, 0o555] }],
          ...expectedFileSpecs(snapshot).map((spec) => [
            spec.locator,
            { type: "file" as const, bytes: spec.bytes, allowedModes: [spec.mode] },
          ] as const),
        ]),
      });
      validateHardLinks({
        captures: [...stageCaptures, ...rootCaptures],
        claimPath: paths.claim,
        receiptPath: paths.receipt,
      });
      removeCapturedTrees([...rootCaptures, ...stageCaptures]);
      syncDirectory(paths.parent);
    } else {
      if (optionalFingerprint(paths.root) || optionalFingerprint(paths.receipt)) {
        return fail(
          "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_V2_CONFLICT",
          "Bootstrap installer refuses an unclaimed target or receipt",
        );
      }
      if (optionalFingerprint(paths.staging)) {
        const captures = capturePartialTree({
          root: paths.staging,
          expectedOwner: boundary.expectedOwner,
          expectedEntries: new Map<string, ExpectedPartialEntryV2>([
            [".", { type: "directory" as const, allowedModes: [0o700] }],
            [CLAIM_STAGE_BASENAME_V2, {
              type: "file" as const,
              bytes: claimBytes,
              allowedModes: [0o444],
            }],
          ]),
        });
        validateHardLinks({
          captures,
          claimPath: paths.claim,
          receiptPath: paths.receipt,
        });
        removeCapturedTree(captures);
        syncDirectory(paths.parent);
      }
      createOwnedDirectory({
        absolutePath: paths.staging,
        mode: 0o700,
        expectedOwner: boundary.expectedOwner,
        errorCode: "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_V2_PUBLICATION_FAILED",
      });
      publishCanonicalNoReplace({
        stagePath: path.join(paths.staging, CLAIM_STAGE_BASENAME_V2),
        targetPath: paths.claim,
        bytes: claimBytes,
        expectedOwner: boundary.expectedOwner,
        afterStage: input.hooks?.afterClaimStage,
        afterLink: input.hooks?.afterClaimPublished,
      });
    }

    lease.assertCurrent();
    if (!optionalFingerprint(paths.staging)) {
      createOwnedDirectory({
        absolutePath: paths.staging,
        mode: 0o700,
        expectedOwner: boundary.expectedOwner,
        errorCode: "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_V2_PUBLICATION_FAILED",
      });
    }
    materializePayloadStage({
      paths,
      expectedOwner: boundary.expectedOwner,
      snapshot,
    });
    input.hooks?.afterPayloadStaged?.();
    publishPayloadRoot({
      paths,
      expectedOwner: boundary.expectedOwner,
      snapshot,
      ...(input.hooks ? { hooks: input.hooks } : {}),
    });
    const manifestHash = openInstalledPackage(
      input.expectedScope,
      paths,
      boundary.expectedOwner,
    );
    if (manifestHash !== source.source.manifestHash) {
      return fail(
        "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_V2_PACKAGE_INVALID",
        "Installed bootstrap manifest differs from its prepared source",
      );
    }
    const rootFingerprint = assertDirectory({
      absolutePath: paths.root,
      expectedOwner: boundary.expectedOwner,
      allowedModes: [0o555],
      errorCode: "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_V2_PACKAGE_INVALID",
    });
    input.hooks?.afterRootVerified?.();
    const receipt = buildReceipt({
      claim,
      rootFingerprint,
      predecessorRollbackHistory,
      lease,
    });
    const receiptBytes = canonicalJsonBytes(receipt);
    try {
      publishCanonicalNoReplace({
        stagePath: path.join(paths.staging, RECEIPT_STAGE_BASENAME_V2),
        targetPath: paths.receipt,
        bytes: receiptBytes,
        expectedOwner: boundary.expectedOwner,
        afterStage: input.hooks?.afterReceiptStage,
        afterLink: input.hooks?.afterReceiptPublished,
      });
    } finally {
      receiptBytes.fill(0);
    }
    rmdirSync(paths.staging);
    syncDirectory(paths.parent);
    lease.assertCurrent();
    const finalRollbackHistory = assertParentCensus(
      paths,
      boundary.expectedOwner,
      boundary.parentMode,
    );
    if (!sameRollbackHistory(finalRollbackHistory, predecessorRollbackHistory)) {
      return fail(
        "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_V2_DRIFT",
        "Bootstrap rollback history changed during installation publication",
      );
    }
    return makeHandle({
      admissionScope: input.expectedScope,
      paths,
      expectedOwner: boundary.expectedOwner,
      parentMode: boundary.parentMode,
      receipt,
      rootFingerprint,
    });
  } catch (error) {
    if (error instanceof NodeToolchainProvisionerBootstrapInstallationErrorV2) throw error;
    if (error instanceof DarwinParentDescriptorLeaseErrorV2) {
      return fail(
        "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_V2_LOCK_FAILED",
        "Bootstrap installation lost its Darwin parent descriptor lease",
        error,
      );
    }
    return fail(
      "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_V2_PUBLICATION_FAILED",
      "Bootstrap installation state machine failed",
      error,
    );
  } finally {
    claimBytes.fill(0);
    if (snapshot) {
      snapshot.manifestBytes.fill(0);
      snapshot.launcherBytes.fill(0);
      snapshot.bundleBytes.fill(0);
      snapshot.runtimeBytes.fill(0);
    }
    try {
      await lease?.release();
    } catch (error) {
      return fail(
        "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_V2_LOCK_FAILED",
        "Bootstrap installation lease could not be released exactly",
        error,
      );
    }
  }
}

export async function installNodeToolchainProvisionerBootstrapV2(
  preparedHandle: PreparedNodeToolchainProvisionerBootstrapPackageV2,
  plan: NodeToolchainProvisionerBootstrapInstallationPlanV2,
): Promise<InstalledNodeToolchainProvisionerBootstrapV2> {
  return install({
    expectedScope: "production_release",
    preparedHandle,
    plan,
  });
}

export async function installNodeToolchainProvisionerBootstrapV2ForTest(input: Readonly<{
  preparedHandle: PreparedNodeToolchainProvisionerBootstrapPackageV2;
  plan: NodeToolchainProvisionerBootstrapInstallationPlanV2;
  testHooks?: NodeToolchainProvisionerBootstrapInstallationTestHooksV2;
}>): Promise<InstalledNodeToolchainProvisionerBootstrapV2> {
  return install({
    expectedScope: "test_fixture",
    preparedHandle: input.preparedHandle,
    plan: input.plan,
    ...(input.testHooks ? { hooks: input.testHooks } : {}),
  });
}

function authenticState(handle: InstalledNodeToolchainProvisionerBootstrapV2): InstalledStateV2 {
  if (
    typeof handle !== "object"
    || handle === null
    || isProxy(handle)
    || Object.getPrototypeOf(handle) !== InstalledNodeToolchainProvisionerBootstrapV2.prototype
  ) {
    return fail(
      "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_V2_HANDLE_UNAUTHENTICATED",
      "Installed bootstrap operation requires one authentic handle",
    );
  }
  const state = installedStatesV2.get(handle);
  if (!state) {
    return fail(
      "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_V2_HANDLE_UNAUTHENTICATED",
      "Installed bootstrap handle was not issued by a fresh durable verifier",
    );
  }
  return state;
}

function openDurable(input: Readonly<{
  admissionScope: AdmissionScopeV2;
  paths: NodeToolchainProvisionerBootstrapInstallationPathsV2;
  expectedOwner: OwnerV2;
  parentMode: 0o700 | 0o755;
}>): InstalledNodeToolchainProvisionerBootstrapV2 {
  const predecessorRollbackHistory = assertParentCensus(
    input.paths,
    input.expectedOwner,
    input.parentMode,
  );
  const lock = stableFileBytes({
    absolutePath: input.paths.lock,
    expectedOwner: input.expectedOwner,
    allowedModes: [0o600],
    allowedLinks: [1],
    maxBytes: LOCK_FILE_BYTES_V2.byteLength,
    expectedBytes: LOCK_FILE_BYTES_V2,
    errorCode: "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_V2_PARENT_INVALID",
  });
  lock.bytes.fill(0);
  if (optionalFingerprint(input.paths.staging)) {
    return fail(
      "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_V2_RECEIPT_INVALID",
      "Durable bootstrap authority cannot open with an interrupted staging root",
    );
  }
  const claimRead = readCanonicalFile({
    absolutePath: input.paths.claim,
    expectedOwner: input.expectedOwner,
    schema: NodeToolchainProvisionerBootstrapInstallationClaimV2Schema,
    errorCode: "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_V2_RECEIPT_INVALID",
  });
  const receiptRead = readCanonicalFile({
    absolutePath: input.paths.receipt,
    expectedOwner: input.expectedOwner,
    schema: NodeToolchainProvisionerBootstrapInstallationReceiptV2Schema,
    errorCode: "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_V2_RECEIPT_INVALID",
  });
  try {
    if (
      claimRead.value.intent.admissionScope !== input.admissionScope
      || claimRead.value.intent.target.rootLocatorHash
        !== receiptRead.value.finalRoot.rootLocatorHash
    ) {
      return fail(
        "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_V2_RECEIPT_INVALID",
        "Durable bootstrap authority scope or target is inconsistent",
      );
    }
    const expectedPaths = getNodeToolchainProvisionerBootstrapInstallationPathsV2(
      claimRead.value.intent.source,
    );
    if (
      Object.keys(expectedPaths).some((key) =>
        expectedPaths[key as keyof typeof expectedPaths]
          !== input.paths[key as keyof typeof input.paths])
    ) {
      return fail(
        "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_V2_RECEIPT_INVALID",
        "Durable bootstrap authority paths differ from their canonical source",
      );
    }
    const rootFingerprint = receiptMatchesReadyRoot({
      receipt: receiptRead.value,
      claim: claimRead.value,
      paths: input.paths,
      expectedOwner: input.expectedOwner,
      predecessorRollbackHistory,
    });
    return makeHandle({
      admissionScope: input.admissionScope,
      paths: input.paths,
      expectedOwner: input.expectedOwner,
      parentMode: input.parentMode,
      receipt: receiptRead.value,
      rootFingerprint,
    });
  } finally {
    claimRead.bytes.fill(0);
    receiptRead.bytes.fill(0);
  }
}

export function openProductionInstalledNodeToolchainProvisionerBootstrapV2():
InstalledNodeToolchainProvisionerBootstrapV2 {
  const sourceRoot = NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_ROOT_V2;
  const parent = path.dirname(sourceRoot);
  const receiptPath = path.join(
    parent,
    NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_RECEIPT_BASENAME_V2,
  );
  const receiptRead = readCanonicalFile({
    absolutePath: receiptPath,
    expectedOwner: { uid: 0, gid: 0 },
    schema: NodeToolchainProvisionerBootstrapInstallationReceiptV2Schema,
    errorCode: "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_V2_RECEIPT_INVALID",
  });
  try {
    if (receiptRead.value.admissionScope !== "production_release") {
      return fail(
        "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_V2_SCOPE_INVALID",
        "Production bootstrap receipt is not production authority",
      );
    }
    return openDurable({
      admissionScope: "production_release",
      paths: getNodeToolchainProvisionerBootstrapInstallationPathsV2(
        receiptRead.value.claim.intent.source,
      ),
      expectedOwner: { uid: 0, gid: 0 },
      parentMode: 0o755,
    });
  } finally {
    receiptRead.bytes.fill(0);
  }
}

export function openInstalledNodeToolchainProvisionerBootstrapV2ForTest(input: Readonly<{
  root: string;
  expectedOwner: Readonly<{ uid: number; gid: number }>;
}>): InstalledNodeToolchainProvisionerBootstrapV2 {
  if (
    !path.isAbsolute(input.root)
    || path.normalize(input.root) !== input.root
    || input.root === NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_ROOT_V2
    || path.basename(input.root) !== "node-toolchain-provisioner-v2"
  ) {
    return fail(
      "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_V2_INPUT_INVALID",
      "Test durable bootstrap opener requires one normalized private V2 root",
    );
  }
  const parent = path.dirname(input.root);
  const receiptPath = path.join(
    parent,
    NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_RECEIPT_BASENAME_V2,
  );
  const receiptRead = readCanonicalFile({
    absolutePath: receiptPath,
    expectedOwner: input.expectedOwner,
    schema: NodeToolchainProvisionerBootstrapInstallationReceiptV2Schema,
    errorCode: "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_V2_RECEIPT_INVALID",
  });
  try {
    if (receiptRead.value.admissionScope !== "test_fixture") {
      return fail(
        "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_V2_SCOPE_INVALID",
        "Test bootstrap opener cannot adopt production authority",
      );
    }
    const paths = getNodeToolchainProvisionerBootstrapInstallationPathsV2(
      receiptRead.value.claim.intent.source,
    );
    if (paths.root !== input.root) {
      return fail(
        "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_V2_RECEIPT_INVALID",
        "Test bootstrap root differs from its durable receipt source",
      );
    }
    return openDurable({
      admissionScope: "test_fixture",
      paths,
      expectedOwner: input.expectedOwner,
      parentMode: 0o700,
    });
  } finally {
    receiptRead.bytes.fill(0);
  }
}

export function inspectNodeToolchainProvisionerBootstrapInstallationReceiptV2(
  handle: InstalledNodeToolchainProvisionerBootstrapV2,
): NodeToolchainProvisionerBootstrapInstallationReceiptV2 {
  return deepFreezeJson(structuredClone(authenticState(handle).receipt));
}

export function revalidateInstalledNodeToolchainProvisionerBootstrapV2(
  handle: InstalledNodeToolchainProvisionerBootstrapV2,
): NodeToolchainProvisionerBootstrapInstallationReceiptV2 {
  const state = authenticState(handle);
  const fresh = openDurable({
    admissionScope: state.admissionScope,
    paths: state.paths,
    expectedOwner: state.expectedOwner,
    parentMode: state.parentMode,
  });
  const freshState = authenticState(fresh);
  if (
    freshState.receipt.receiptHash !== state.receipt.receiptHash
    || !sameFingerprint(freshState.rootFingerprint, state.rootFingerprint)
  ) {
    return fail(
      "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_V2_DRIFT",
      "Installed bootstrap physical authority changed after handle issuance",
    );
  }
  return deepFreezeJson(structuredClone(freshState.receipt));
}

export type NodeToolchainProvisionerBootstrapRollbackTestHooksV2 = Readonly<{
  afterLegacyLeaseAcquired?: () => void;
  afterRollbackClaimStage?: () => void;
  afterRollbackClaimPublished?: () => void;
  afterQuarantineCreated?: () => void;
  afterRootWritable?: () => void;
  afterRootRenamed?: () => void;
  afterInstallationReceiptRemoved?: () => void;
  afterInstallationClaimRemoved?: () => void;
  afterRemovedEntry?: (input: Readonly<{ locator: string; removedCount: number }>) => void;
  afterRollbackReceiptStage?: () => void;
  afterRollbackReceiptPublished?: () => void;
  afterRollbackClaimRemoved?: () => void;
}>;

export type NodeToolchainProvisionerBootstrapRollbackResultV2 = Readonly<{
  rollbackReceipt: NodeToolchainProvisionerBootstrapRollbackReceiptV2;
  disposition: "rolled_back" | "recovered" | "already_complete";
}>;

export function planNodeToolchainProvisionerBootstrapRollbackV2(
  handle: InstalledNodeToolchainProvisionerBootstrapV2,
): NodeToolchainProvisionerBootstrapRollbackPlanV2 {
  return deepFreezeJson(buildNodeToolchainProvisionerBootstrapRollbackPlanV2(
    revalidateInstalledNodeToolchainProvisionerBootstrapV2(handle),
  ));
}

function parseRollbackPlan(
  value: unknown,
  expectedScope: AdmissionScopeV2,
): NodeToolchainProvisionerBootstrapRollbackPlanV2 {
  try {
    const parsed = NodeToolchainProvisionerBootstrapRollbackPlanV2Schema.safeParse(value);
    if (!parsed.success || parsed.data.admissionScope !== expectedScope) {
      return fail(
        "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_V2_ROLLBACK_CONFLICT",
        "Bootstrap rollback requires one exact scope-bound rollback plan",
        parsed.success ? undefined : parsed.error,
      );
    }
    return deepFreezeJson(parsed.data);
  } catch (error) {
    if (error instanceof NodeToolchainProvisionerBootstrapInstallationErrorV2) throw error;
    return fail(
      "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_V2_ROLLBACK_CONFLICT",
      "Bootstrap rollback plan could not be inspected safely",
      error,
    );
  }
}

function rollbackBoundary(
  plan: NodeToolchainProvisionerBootstrapRollbackPlanV2,
): Readonly<{
  paths: NodeToolchainProvisionerBootstrapRollbackPathsV2;
  expectedOwner: OwnerV2;
  parentMode: 0o700 | 0o755;
}> {
  const paths = getNodeToolchainProvisionerBootstrapRollbackPathsV2(plan.installed);
  const installationPaths = getNodeToolchainProvisionerBootstrapInstallationPathsV2(
    plan.installed.claim.intent.source,
  );
  const boundary = plan.admissionScope === "production_release"
    ? (() => {
        if (
          installationPaths.root !== NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_ROOT_V2
          || typeof process.getuid !== "function"
          || typeof process.getgid !== "function"
          || process.getuid() !== 0
          || process.getgid() !== 0
        ) {
          return fail(
            "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_V2_SCOPE_INVALID",
            "Production bootstrap rollback requires root and the fixed installed target",
          );
        }
        const system = lstatSync(installationPaths.systemAncestor);
        if (
          system.isSymbolicLink()
          || !system.isDirectory()
          || system.uid !== 0
          || modeBits(system) !== 0o755
        ) {
          return fail(
            "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_V2_PARENT_INVALID",
            "Production bootstrap rollback system ancestor is invalid",
          );
        }
        const expectedOwner = Object.freeze({ uid: 0, gid: 0 });
        for (const directory of [installationPaths.setfarmRoot, installationPaths.parent]) {
          assertDirectory({
            absolutePath: directory,
            expectedOwner,
            allowedModes: [0o755],
            errorCode: "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_V2_PARENT_INVALID",
          });
        }
        return Object.freeze({ expectedOwner, parentMode: 0o755 as const });
      })()
    : testParent(installationPaths);
  return Object.freeze({ paths, ...boundary });
}

function assertRollbackLock(input: Readonly<{
  paths: NodeToolchainProvisionerBootstrapRollbackPathsV2;
  expectedOwner: OwnerV2;
}>): void {
  const lock = stableFileBytes({
    absolutePath: input.paths.lock,
    expectedOwner: input.expectedOwner,
    allowedModes: [0o600],
    allowedLinks: [1],
    maxBytes: LOCK_FILE_BYTES_V2.byteLength,
    expectedBytes: LOCK_FILE_BYTES_V2,
    errorCode: "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_V2_ROLLBACK_CONFLICT",
  });
  lock.bytes.fill(0);
}

function assertRollbackParentCensus(input: Readonly<{
  paths: NodeToolchainProvisionerBootstrapRollbackPathsV2;
  expectedOwner: OwnerV2;
  parentMode: 0o700 | 0o755;
}>): NodeToolchainProvisionerBootstrapRollbackHistoryV2 {
  try {
    const before = assertDirectory({
      absolutePath: input.paths.parent,
      expectedOwner: input.expectedOwner,
      allowedModes: [input.parentMode],
      errorCode: "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_V2_ROLLBACK_CONFLICT",
    });
    const allowed = new Set([
      path.basename(input.paths.root),
      path.basename(input.paths.installationReceipt),
      path.basename(input.paths.installationClaim),
      path.basename(input.paths.lock),
      path.basename(input.paths.staging),
      path.basename(input.paths.rollbackClaim),
    ]);
    const names = readdirSync(input.paths.parent).sort();
    const rollbackHistoryEntries: NodeToolchainProvisionerBootstrapRollbackHistoryEntryV2[] = [];
    const rollbackReceiptCaptures: Readonly<{
      absolutePath: string;
      fingerprint: FingerprintV2;
    }>[] = [];
    const after = assertDirectory({
      absolutePath: input.paths.parent,
      expectedOwner: input.expectedOwner,
      allowedModes: [input.parentMode],
      errorCode: "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_V2_ROLLBACK_CONFLICT",
    });
    for (const name of names) {
      if (allowed.has(name)) continue;
      if (!ROLLBACK_RECEIPT_BASENAME_PATTERN_V2.test(name)) {
        return fail(
          "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_V2_ROLLBACK_CONFLICT",
          "Bootstrap rollback parent contains state outside one exact generation",
        );
      }
      const absolutePath = path.join(input.paths.parent, name);
      const rollbackReceipt = assertHistoricalBootstrapRollbackReceipt({
        absolutePath,
        parent: input.paths.parent,
        expectedOwner: input.expectedOwner,
        ...(absolutePath === input.paths.rollbackReceipt
          ? { activeReceiptStage: input.paths.rollbackReceiptStage }
          : {}),
        errorCode: "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_V2_ROLLBACK_CONFLICT",
      });
      rollbackHistoryEntries.push({
        installationReceiptHash:
          rollbackReceipt.value.removedGeneration.installationReceiptHash,
        rollbackReceiptHash: rollbackReceipt.value.receiptHash,
        rollbackReceiptLocatorHash: rollbackReceipt.value.receiptFile.locatorHash,
      });
      rollbackReceiptCaptures.push({
        absolutePath,
        fingerprint: rollbackReceipt.fingerprint,
      });
    }
    const finalNames = readdirSync(input.paths.parent).sort();
    const final = assertDirectory({
      absolutePath: input.paths.parent,
      expectedOwner: input.expectedOwner,
      allowedModes: [input.parentMode],
      errorCode: "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_V2_ROLLBACK_CONFLICT",
    });
    if (
      !sameFingerprint(before, after)
      || !sameFingerprint(after, final)
      || names.length !== finalNames.length
      || names.some((name, index) => name !== finalNames[index])
      || rollbackReceiptCaptures.some((capture) =>
        !sameFingerprint(capture.fingerprint, fingerprint(lstatSync(capture.absolutePath))))
    ) {
      return fail(
        "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_V2_ROLLBACK_CONFLICT",
        "Bootstrap rollback parent changed during its exact generation census",
      );
    }
    return buildNodeToolchainProvisionerBootstrapRollbackHistoryV2(rollbackHistoryEntries);
  } catch (error) {
    if (error instanceof NodeToolchainProvisionerBootstrapInstallationErrorV2) throw error;
    return fail(
      "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_V2_ROLLBACK_CONFLICT",
      "Bootstrap rollback parent census failed",
      error,
    );
  }
}

function ensureRollbackStaging(input: Readonly<{
  paths: NodeToolchainProvisionerBootstrapRollbackPathsV2;
  expectedOwner: OwnerV2;
}>): void {
  if (!optionalFingerprint(input.paths.staging)) {
    createOwnedDirectory({
      absolutePath: input.paths.staging,
      mode: 0o700,
      expectedOwner: input.expectedOwner,
      errorCode: "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_V2_ROLLBACK_CONFLICT",
    });
  }
  assertDirectory({
    absolutePath: input.paths.staging,
    expectedOwner: input.expectedOwner,
    allowedModes: [0o700],
    errorCode: "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_V2_ROLLBACK_CONFLICT",
  });
}

function assertRollbackStagingCensus(input: Readonly<{
  paths: NodeToolchainProvisionerBootstrapRollbackPathsV2;
  expectedOwner: OwnerV2;
  allowAbsent: boolean;
}>): void {
  if (!optionalFingerprint(input.paths.staging)) {
    if (input.allowAbsent) return;
    return fail(
      "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_V2_ROLLBACK_CONFLICT",
      "Bootstrap rollback staging root is unexpectedly absent",
    );
  }
  const before = assertDirectory({
    absolutePath: input.paths.staging,
    expectedOwner: input.expectedOwner,
    allowedModes: [0o700],
    errorCode: "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_V2_ROLLBACK_CONFLICT",
  });
  const allowed = new Set([
    NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_ROLLBACK_CLAIM_STAGE_BASENAME_V2,
    NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_ROLLBACK_RECEIPT_STAGE_BASENAME_V2,
    path.basename(input.paths.rollbackStage),
  ]);
  const names = readdirSync(input.paths.staging).sort();
  const after = assertDirectory({
    absolutePath: input.paths.staging,
    expectedOwner: input.expectedOwner,
    allowedModes: [0o700],
    errorCode: "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_V2_ROLLBACK_CONFLICT",
  });
  if (
    !sameFingerprint(before, after)
    || names.length > allowed.size
    || names.some((name) => !allowed.has(name))
  ) {
    return fail(
      "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_V2_ROLLBACK_CONFLICT",
      "Bootstrap rollback staging contains a foreign or changing member",
    );
  }
  if (optionalFingerprint(input.paths.rollbackStage)) {
    const rollbackStage = assertDirectory({
      absolutePath: input.paths.rollbackStage,
      expectedOwner: input.expectedOwner,
      allowedModes: [0o700],
      errorCode: "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_V2_ROLLBACK_CONFLICT",
    });
    const rollbackNames = readdirSync(input.paths.rollbackStage).sort();
    const rollbackStageAfter = assertDirectory({
      absolutePath: input.paths.rollbackStage,
      expectedOwner: input.expectedOwner,
      allowedModes: [0o700],
      errorCode: "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_V2_ROLLBACK_CONFLICT",
    });
    if (
      !sameFingerprint(rollbackStage, rollbackStageAfter)
      || rollbackNames.length > 1
      || rollbackNames.some((name) => name !== path.basename(input.paths.quarantineRoot))
    ) {
      return fail(
        "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_V2_ROLLBACK_CONFLICT",
        "Bootstrap rollback quarantine contains a foreign sibling",
      );
    }
  }
}

function readRollbackClaim(input: Readonly<{
  paths: NodeToolchainProvisionerBootstrapRollbackPathsV2;
  expectedOwner: OwnerV2;
  plan: NodeToolchainProvisionerBootstrapRollbackPlanV2;
}>): Readonly<{
  value: NodeToolchainProvisionerBootstrapRollbackClaimV2;
  fingerprint: FingerprintV2;
}> {
  const captured = readCanonicalFile({
    absolutePath: input.paths.rollbackClaim,
    expectedOwner: input.expectedOwner,
    schema: NodeToolchainProvisionerBootstrapRollbackClaimV2Schema,
    allowedLinks: [1, 2],
    errorCode: "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_V2_ROLLBACK_CONFLICT",
  });
  try {
    const stage = optionalFingerprint(input.paths.rollbackClaimStage);
    if (
      captured.value.plan.planHash !== input.plan.planHash
      || (captured.fingerprint.linkCount === 2
        && (!stage || !samePhysicalIdentity(captured.fingerprint, stage)))
      || (captured.fingerprint.linkCount === 1 && stage !== undefined)
    ) {
      return fail(
        "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_V2_ROLLBACK_CONFLICT",
        "Existing bootstrap rollback claim or stage alias belongs to another plan",
      );
    }
    return Object.freeze({ value: captured.value, fingerprint: captured.fingerprint });
  } finally {
    captured.bytes.fill(0);
  }
}

function readRollbackReceipt(input: Readonly<{
  paths: NodeToolchainProvisionerBootstrapRollbackPathsV2;
  expectedOwner: OwnerV2;
  plan: NodeToolchainProvisionerBootstrapRollbackPlanV2;
  allowedLinks?: readonly (1 | 2)[];
}>): Readonly<{
  value: NodeToolchainProvisionerBootstrapRollbackReceiptV2;
  fingerprint: FingerprintV2;
}> {
  const captured = readCanonicalFile({
    absolutePath: input.paths.rollbackReceipt,
    expectedOwner: input.expectedOwner,
    schema: NodeToolchainProvisionerBootstrapRollbackReceiptV2Schema,
    allowedLinks: input.allowedLinks ?? [1],
    errorCode: "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_V2_ROLLBACK_CONFLICT",
  });
  try {
    const stage = optionalFingerprint(input.paths.rollbackReceiptStage);
    if (
      captured.value.planHash !== input.plan.planHash
      || captured.value.removedGeneration.installationReceiptHash
        !== input.plan.generation.installationReceiptHash
      || captured.value.removedGeneration.rootDevice !== input.plan.generation.rootDevice
      || captured.value.removedGeneration.rootInode !== input.plan.generation.rootInode
      || (captured.fingerprint.linkCount === 2
        && (!stage || !samePhysicalIdentity(captured.fingerprint, stage)))
      || (captured.fingerprint.linkCount === 1 && stage !== undefined)
    ) {
      return fail(
        "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_V2_ROLLBACK_CONFLICT",
        "Existing bootstrap rollback tombstone belongs to another generation",
      );
    }
    return Object.freeze({ value: captured.value, fingerprint: captured.fingerprint });
  } finally {
    captured.bytes.fill(0);
  }
}

function unlinkCapturedFile(input: Readonly<{
  absolutePath: string;
  expected: FingerprintV2;
}>): void {
  const current = fingerprint(lstatSync(input.absolutePath));
  if (!sameFingerprint(current, input.expected)) {
    return fail(
      "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_V2_ROLLBACK_CONFLICT",
      "Bootstrap rollback file changed before exact unlink",
    );
  }
  unlinkSync(input.absolutePath);
  syncDirectory(path.dirname(input.absolutePath));
}

function rollbackEntryPath(root: string, locator: string): string {
  return locator === "." ? root : path.join(root, locator);
}

function validatePartialRollbackTree(input: Readonly<{
  root: string;
  claim: NodeToolchainProvisionerBootstrapRollbackClaimV2;
  expectedOwner: OwnerV2;
}>): void {
  const root = optionalFingerprint(input.root);
  if (!root) return;
  if (
    root.device !== input.claim.generation.rootDevice
    || root.inode !== input.claim.generation.rootInode
    || root.ownerUid !== input.expectedOwner.uid
    || root.ownerGid !== input.expectedOwner.gid
    || (modeBits(root) !== 0o555 && modeBits(root) !== 0o700)
  ) {
    return fail(
      "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_V2_ROLLBACK_CONFLICT",
      "Bootstrap rollback root differs from its claimed physical generation",
    );
  }
  assertExactDirectoryStableIdentityV2({
    absolutePath: input.root,
    expected: root,
    errorCode: "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_V2_ROLLBACK_CONFLICT",
  });
  const expected = new Map<string, NodeToolchainProvisionerBootstrapRollbackTreeEntryV2>(
    input.claim.treeEntries.map((entry) => [entry.locator, entry]),
  );
  const visit = (absoluteDirectory: string, locator: string): void => {
    const directoryEntry = expected.get(locator);
    const before = lstatSync(absoluteDirectory);
    if (
      !directoryEntry
      || directoryEntry.type !== "directory"
      || before.isSymbolicLink()
      || !before.isDirectory()
      || before.uid !== input.expectedOwner.uid
      || before.gid !== input.expectedOwner.gid
      || (modeBits(before) !== 0o555 && modeBits(before) !== 0o700)
    ) {
      return fail(
        "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_V2_ROLLBACK_CONFLICT",
        "Bootstrap rollback directory differs from its claim",
      );
    }
    const namesBefore = readdirSync(absoluteDirectory).sort();
    for (const name of namesBefore) {
      const childLocator = locator === "." ? name : `${locator}/${name}`;
      const entry = expected.get(childLocator);
      if (!entry) {
        return fail(
          "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_V2_ROLLBACK_CONFLICT",
          "Bootstrap rollback quarantine contains a foreign member",
        );
      }
      const absoluteChild = path.join(absoluteDirectory, name);
      const stat = lstatSync(absoluteChild);
      if (
        stat.isSymbolicLink()
        || stat.uid !== input.expectedOwner.uid
        || stat.gid !== input.expectedOwner.gid
      ) {
        return fail(
          "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_V2_ROLLBACK_CONFLICT",
          "Bootstrap rollback member ownership or type is foreign",
        );
      }
      if (entry.type === "directory") {
        visit(absoluteChild, childLocator);
        continue;
      }
      if (
        !stat.isFile()
        || stat.nlink !== 1
        || modeBits(stat) !== Number.parseInt(entry.mode, 8)
        || stat.size !== entry.byteLength
      ) {
        return fail(
          "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_V2_ROLLBACK_CONFLICT",
          "Bootstrap rollback file metadata differs from its claim",
        );
      }
      const captured = stableFileBytes({
        absolutePath: absoluteChild,
        expectedOwner: input.expectedOwner,
        allowedModes: [Number.parseInt(entry.mode, 8)],
        allowedLinks: [1],
        maxBytes: Math.max(entry.byteLength, 1),
        errorCode: "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_V2_ROLLBACK_CONFLICT",
      });
      try {
        if (captured.bytes.byteLength !== entry.byteLength || sha256(captured.bytes) !== entry.contentHash) {
          return fail(
            "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_V2_ROLLBACK_CONFLICT",
            "Bootstrap rollback file bytes differ from its claim",
          );
        }
      } finally {
        captured.bytes.fill(0);
      }
    }
    const after = lstatSync(absoluteDirectory);
    const namesAfter = readdirSync(absoluteDirectory).sort();
    if (
      !sameFingerprint(fingerprint(before), fingerprint(after))
      || namesBefore.length !== namesAfter.length
      || namesBefore.some((name, index) => name !== namesAfter[index])
    ) {
      return fail(
        "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_V2_ROLLBACK_CONFLICT",
        "Bootstrap rollback tree changed during its every-only census",
      );
    }
  };
  visit(input.root, ".");
}

function assertCompleteRollbackTree(input: Readonly<{
  root: string;
  claim: NodeToolchainProvisionerBootstrapRollbackClaimV2;
  expectedOwner: OwnerV2;
}>): void {
  validatePartialRollbackTree(input);
  for (const entry of input.claim.treeEntries) {
    if (!optionalFingerprint(rollbackEntryPath(input.root, entry.locator))) {
      return fail(
        "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_V2_ROLLBACK_CONFLICT",
        "Live bootstrap generation lost a claimed member before quarantine",
      );
    }
  }
}

function removePartialRollbackTree(input: Readonly<{
  root: string;
  claim: NodeToolchainProvisionerBootstrapRollbackClaimV2;
  expectedOwner: OwnerV2;
  hooks?: NodeToolchainProvisionerBootstrapRollbackTestHooksV2;
}>): void {
  validatePartialRollbackTree(input);
  if (!optionalFingerprint(input.root)) return;
  const directories = input.claim.treeEntries
    .filter((entry): entry is NodeToolchainProvisionerBootstrapRollbackTreeEntryV2 & {
      type: "directory";
    } => entry.type === "directory")
    .sort((left, right) => left.locator.split("/").length - right.locator.split("/").length);
  const directoryIdentities = new Map<string, FingerprintV2>();
  for (const entry of directories) {
    const absolutePath = rollbackEntryPath(input.root, entry.locator);
    const current = optionalFingerprint(absolutePath);
    if (!current) continue;
    if (
      current.ownerUid !== input.expectedOwner.uid
      || current.ownerGid !== input.expectedOwner.gid
      || (modeBits(current) !== 0o555 && modeBits(current) !== 0o700)
    ) {
      return fail(
        "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_V2_ROLLBACK_CONFLICT",
        "Bootstrap rollback directory changed before writable transition",
      );
    }
    directoryIdentities.set(entry.locator, current);
    if (modeBits(current) !== 0o700) {
      chmodSync(absolutePath, 0o700);
      syncDirectory(absolutePath);
    }
  }
  let removedCount = 0;
  for (const entry of input.claim.treeEntries.filter((candidate) => candidate.type === "file")) {
    const absolutePath = rollbackEntryPath(input.root, entry.locator);
    if (!optionalFingerprint(absolutePath)) continue;
    const captured = stableFileBytes({
      absolutePath,
      expectedOwner: input.expectedOwner,
      allowedModes: [Number.parseInt(entry.mode, 8)],
      allowedLinks: [1],
      maxBytes: Math.max(entry.byteLength, 1),
      errorCode: "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_V2_ROLLBACK_CONFLICT",
    });
    try {
      if (captured.bytes.byteLength !== entry.byteLength || sha256(captured.bytes) !== entry.contentHash) {
        return fail(
          "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_V2_ROLLBACK_CONFLICT",
          "Bootstrap rollback file changed before exact removal",
        );
      }
      assertExactObjectStableIdentityV2({
        absolutePath,
        expected: captured.fingerprint,
        objectKind: "ordinary_file",
        errorCode: "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_V2_ROLLBACK_CONFLICT",
      });
      unlinkCapturedFile({ absolutePath, expected: captured.fingerprint });
    } finally {
      captured.bytes.fill(0);
    }
    removedCount += 1;
    input.hooks?.afterRemovedEntry?.({ locator: entry.locator, removedCount });
  }
  const childDirectories = directories
    .filter((entry) => entry.locator !== ".")
    .sort((left, right) => right.locator.split("/").length - left.locator.split("/").length);
  for (const entry of childDirectories) {
    const absolutePath = rollbackEntryPath(input.root, entry.locator);
    const current = optionalFingerprint(absolutePath);
    const expected = directoryIdentities.get(entry.locator);
    if (!current) continue;
    if (!expected) {
      return fail(
        "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_V2_ROLLBACK_CONFLICT",
        "Bootstrap rollback directory lost its initial physical identity",
      );
    }
    if (
      current.ownerUid !== input.expectedOwner.uid
      || current.ownerGid !== input.expectedOwner.gid
      || modeBits(current) !== 0o700
    ) {
      return fail(
        "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_V2_ROLLBACK_CONFLICT",
        "Bootstrap rollback directory changed before exact removal",
      );
    }
    assertExactObjectStableIdentityV2({
      absolutePath,
      expected,
      objectKind: "directory",
      errorCode: "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_V2_ROLLBACK_CONFLICT",
    });
    rmdirSync(absolutePath);
    syncDirectory(path.dirname(absolutePath));
    removedCount += 1;
    input.hooks?.afterRemovedEntry?.({ locator: entry.locator, removedCount });
  }
  const root = optionalFingerprint(input.root);
  if (root) {
    const expectedRoot = directoryIdentities.get(".");
    if (!expectedRoot) {
      return fail(
        "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_V2_ROLLBACK_CONFLICT",
        "Bootstrap rollback root lost its initial physical identity",
      );
    }
    if (
      root.device !== input.claim.generation.rootDevice
      || root.inode !== input.claim.generation.rootInode
      || root.ownerUid !== input.expectedOwner.uid
      || root.ownerGid !== input.expectedOwner.gid
      || modeBits(root) !== 0o700
    ) {
      return fail(
        "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_V2_ROLLBACK_CONFLICT",
        "Bootstrap rollback root changed before exact removal",
      );
    }
    assertExactDirectoryStableIdentityV2({
      absolutePath: input.root,
      expected: expectedRoot,
      errorCode: "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_V2_ROLLBACK_CONFLICT",
    });
    rmdirSync(input.root);
    syncDirectory(path.dirname(input.root));
    removedCount += 1;
    input.hooks?.afterRemovedEntry?.({ locator: ".", removedCount });
  }
}

function readReadyRollbackGeneration(input: Readonly<{
  plan: NodeToolchainProvisionerBootstrapRollbackPlanV2;
  paths: NodeToolchainProvisionerBootstrapRollbackPathsV2;
  expectedOwner: OwnerV2;
}>): FingerprintV2 {
  const claimRead = readCanonicalFile({
    absolutePath: input.paths.installationClaim,
    expectedOwner: input.expectedOwner,
    schema: NodeToolchainProvisionerBootstrapInstallationClaimV2Schema,
    errorCode: "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_V2_ROLLBACK_CONFLICT",
  });
  const receiptRead = readCanonicalFile({
    absolutePath: input.paths.installationReceipt,
    expectedOwner: input.expectedOwner,
    schema: NodeToolchainProvisionerBootstrapInstallationReceiptV2Schema,
    errorCode: "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_V2_ROLLBACK_CONFLICT",
  });
  try {
    if (
      claimRead.value.claimHash !== input.plan.generation.installationClaimHash
      || receiptRead.value.receiptHash !== input.plan.generation.installationReceiptHash
      || receiptRead.value.claim.claimHash !== claimRead.value.claimHash
    ) {
      return fail(
        "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_V2_ROLLBACK_CONFLICT",
        "Live bootstrap installation authority changed after rollback planning",
      );
    }
    return receiptMatchesReadyRoot({
      receipt: receiptRead.value,
      claim: claimRead.value,
      paths: getNodeToolchainProvisionerBootstrapInstallationPathsV2(
        input.plan.installed.claim.intent.source,
      ),
      expectedOwner: input.expectedOwner,
      predecessorRollbackHistory: input.plan.installed.predecessorRollbackHistory,
    });
  } finally {
    claimRead.bytes.fill(0);
    receiptRead.bytes.fill(0);
  }
}

function removeInstallationAuthorityFile<T extends object>(input: Readonly<{
  absolutePath: string;
  expectedOwner: OwnerV2;
  schema: {
    safeParse(value: unknown):
      | { success: true; data: T }
      | { success: false; error: unknown };
  };
  expectedHash: string;
  readHash: (value: T) => string;
}>): void {
  if (!optionalFingerprint(input.absolutePath)) return;
  const captured = readCanonicalFile({
    absolutePath: input.absolutePath,
    expectedOwner: input.expectedOwner,
    schema: input.schema,
    errorCode: "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_V2_ROLLBACK_CONFLICT",
  });
  try {
    if (input.readHash(captured.value) !== input.expectedHash) {
      return fail(
        "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_V2_ROLLBACK_CONFLICT",
        "Bootstrap installation authority differs from the rollback claim",
      );
    }
    unlinkCapturedFile({ absolutePath: input.absolutePath, expected: captured.fingerprint });
  } finally {
    captured.bytes.fill(0);
  }
}

async function rollbackBootstrap(input: Readonly<{
  expectedScope: AdmissionScopeV2;
  plan: unknown;
  hooks?: NodeToolchainProvisionerBootstrapRollbackTestHooksV2;
}>): Promise<NodeToolchainProvisionerBootstrapRollbackResultV2> {
  const plan = parseRollbackPlan(input.plan, input.expectedScope);
  const boundary = rollbackBoundary(plan);
  const { paths } = boundary;
  assertLegacyNodeRegistryCutoverAbsentV2(paths);
  assertRollbackParentCensus(boundary);
  assertRollbackLock({ paths, expectedOwner: boundary.expectedOwner });
  let lease: DarwinParentDescriptorLeaseV2 | undefined;
  try {
    lease = await acquireDarwinParentDescriptorLeaseV2({
      parentPath: paths.parent,
      lockPath: paths.lock,
      lockBytes: LOCK_FILE_BYTES_V2,
      expectedOwner: boundary.expectedOwner,
      allowedParentModes: [boundary.parentMode],
    });
    lease.assertCurrent();
    input.hooks?.afterLegacyLeaseAcquired?.();
    assertLegacyNodeRegistryCutoverAbsentV2(paths);
    const observedRollbackHistory = assertRollbackParentCensus(boundary);
    const rollbackClaimExistsAtStart = optionalFingerprint(paths.rollbackClaim) !== undefined;
    const rollbackOperationalStateExistsAtStart = rollbackClaimExistsAtStart
      || optionalFingerprint(paths.staging) !== undefined;
    const rollbackReceiptExistsAtStart = optionalFingerprint(paths.rollbackReceipt) !== undefined;
    if (
      !rollbackReceiptExistsAtStart
      && !sameRollbackHistory(
        observedRollbackHistory,
        plan.installed.predecessorRollbackHistory,
      )
    ) {
      return fail(
        "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_V2_ROLLBACK_CONFLICT",
        "Bootstrap rollback predecessor history changed after generation planning",
      );
    }

    if (rollbackReceiptExistsAtStart) {
      const observed = readRollbackReceipt({
        paths,
        expectedOwner: boundary.expectedOwner,
        plan,
        allowedLinks: [1, 2],
      });
      const receiptBytes = canonicalJsonBytes(observed.value);
      try {
        if (optionalFingerprint(paths.rollbackReceiptStage)) {
          publishCanonicalNoReplace({
            stagePath: paths.rollbackReceiptStage,
            targetPath: paths.rollbackReceipt,
            bytes: receiptBytes,
            expectedOwner: boundary.expectedOwner,
          });
        }
      } finally {
        receiptBytes.fill(0);
      }
      if (rollbackClaimExistsAtStart) {
        const claimRead = readRollbackClaim({
          paths,
          expectedOwner: boundary.expectedOwner,
          plan,
        });
        if (claimRead.value.claimHash !== observed.value.claim.claimHash) {
          return fail(
            "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_V2_ROLLBACK_CONFLICT",
            "Bootstrap rollback tombstone and retained claim disagree",
          );
        }
        if (optionalFingerprint(paths.rollbackClaimStage)) {
          const claimBytes = canonicalJsonBytes(claimRead.value);
          try {
            publishCanonicalNoReplace({
              stagePath: paths.rollbackClaimStage,
              targetPath: paths.rollbackClaim,
              bytes: claimBytes,
              expectedOwner: boundary.expectedOwner,
            });
          } finally {
            claimBytes.fill(0);
          }
        }
        const freshClaim = readRollbackClaim({
          paths,
          expectedOwner: boundary.expectedOwner,
          plan,
        });
        unlinkCapturedFile({
          absolutePath: paths.rollbackClaim,
          expected: freshClaim.fingerprint,
        });
        input.hooks?.afterRollbackClaimRemoved?.();
      }
      if (
        optionalFingerprint(paths.root)
        || optionalFingerprint(paths.installationReceipt)
        || optionalFingerprint(paths.installationClaim)
        || optionalFingerprint(paths.quarantineRoot)
      ) {
        return fail(
          "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_V2_ROLLBACK_CONFLICT",
          "Completed bootstrap rollback tombstone coexists with live generation state",
        );
      }
      if (optionalFingerprint(paths.rollbackStage)) {
        if (readdirSync(paths.rollbackStage).length !== 0) {
          return fail(
            "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_V2_ROLLBACK_CONFLICT",
            "Completed bootstrap rollback retained quarantine state",
          );
        }
        rmdirSync(paths.rollbackStage);
        syncDirectory(paths.staging);
      }
      assertRollbackStagingCensus({
        paths,
        expectedOwner: boundary.expectedOwner,
        allowAbsent: true,
      });
      if (optionalFingerprint(paths.staging)) {
        if (readdirSync(paths.staging).length !== 0) {
          return fail(
            "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_V2_ROLLBACK_CONFLICT",
            "Completed bootstrap rollback retained operational stage files",
          );
        }
        rmdirSync(paths.staging);
        syncDirectory(paths.parent);
      }
      const durable = readRollbackReceipt({
        paths,
        expectedOwner: boundary.expectedOwner,
        plan,
      });
      return Object.freeze({
        rollbackReceipt: deepFreezeJson(structuredClone(durable.value)),
        disposition: rollbackOperationalStateExistsAtStart ? "recovered" : "already_complete",
      });
    }

    const expectedClaim = buildNodeToolchainProvisionerBootstrapRollbackClaimV2(plan);
    let claim: NodeToolchainProvisionerBootstrapRollbackClaimV2;
    if (rollbackClaimExistsAtStart) {
      const existing = readRollbackClaim({
        paths,
        expectedOwner: boundary.expectedOwner,
        plan,
      });
      if (existing.value.claimHash !== expectedClaim.claimHash) {
        return fail(
          "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_V2_ROLLBACK_CONFLICT",
          "Existing bootstrap rollback claim differs from its deterministic plan",
        );
      }
      claim = existing.value;
      ensureRollbackStaging({ paths, expectedOwner: boundary.expectedOwner });
      if (optionalFingerprint(paths.rollbackClaimStage)) {
        const claimBytes = canonicalJsonBytes(claim);
        try {
          publishCanonicalNoReplace({
            stagePath: paths.rollbackClaimStage,
            targetPath: paths.rollbackClaim,
            bytes: claimBytes,
            expectedOwner: boundary.expectedOwner,
          });
        } finally {
          claimBytes.fill(0);
        }
      }
    } else {
      const rootFingerprint = readReadyRollbackGeneration({
        plan,
        paths,
        expectedOwner: boundary.expectedOwner,
      });
      if (
        rootFingerprint.device !== plan.generation.rootDevice
        || rootFingerprint.inode !== plan.generation.rootInode
      ) {
        return fail(
          "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_V2_ROLLBACK_CONFLICT",
          "Bootstrap rollback plan no longer identifies the live physical root",
        );
      }
      assertCompleteRollbackTree({
        root: paths.root,
        claim: expectedClaim,
        expectedOwner: boundary.expectedOwner,
      });
      ensureRollbackStaging({ paths, expectedOwner: boundary.expectedOwner });
      assertRollbackStagingCensus({
        paths,
        expectedOwner: boundary.expectedOwner,
        allowAbsent: false,
      });
      const claimBytes = canonicalJsonBytes(expectedClaim);
      try {
        publishCanonicalNoReplace({
          stagePath: paths.rollbackClaimStage,
          targetPath: paths.rollbackClaim,
          bytes: claimBytes,
          expectedOwner: boundary.expectedOwner,
          afterStage: input.hooks?.afterRollbackClaimStage,
          afterLink: input.hooks?.afterRollbackClaimPublished,
        });
      } finally {
        claimBytes.fill(0);
      }
      claim = expectedClaim;
    }

    lease.assertCurrent();
    assertRollbackStagingCensus({
      paths,
      expectedOwner: boundary.expectedOwner,
      allowAbsent: false,
    });
    if (!optionalFingerprint(paths.rollbackStage)) {
      createOwnedDirectory({
        absolutePath: paths.rollbackStage,
        mode: 0o700,
        expectedOwner: boundary.expectedOwner,
        errorCode: "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_V2_ROLLBACK_CONFLICT",
      });
      syncDirectory(paths.staging);
      input.hooks?.afterQuarantineCreated?.();
    }
    const rootExists = optionalFingerprint(paths.root) !== undefined;
    const quarantineExists = optionalFingerprint(paths.quarantineRoot) !== undefined;
    if (rootExists && quarantineExists) {
      return fail(
        "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_V2_ROLLBACK_CONFLICT",
        "Bootstrap rollback cannot choose between live and quarantined roots",
      );
    }
    if (rootExists) {
      assertCompleteRollbackTree({
        root: paths.root,
        claim,
        expectedOwner: boundary.expectedOwner,
      });
      if (readdirSync(paths.rollbackStage).length !== 0) {
        return fail(
          "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_V2_ROLLBACK_CONFLICT",
          "Bootstrap rollback quarantine is not empty before atomic rename",
        );
      }
      const liveRoot = fingerprint(lstatSync(paths.root));
      chmodSync(paths.root, 0o700);
      syncDirectory(paths.root);
      syncDirectory(paths.parent);
      input.hooks?.afterRootWritable?.();
      assertExactDirectoryStableIdentityV2({
        absolutePath: paths.root,
        expected: liveRoot,
        errorCode: "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_V2_ROLLBACK_CONFLICT",
      });
      renameSync(paths.root, paths.quarantineRoot);
      syncDirectory(paths.parent);
      syncDirectory(paths.rollbackStage);
      input.hooks?.afterRootRenamed?.();
    }
    validatePartialRollbackTree({
      root: paths.quarantineRoot,
      claim,
      expectedOwner: boundary.expectedOwner,
    });
    if (
      !optionalFingerprint(paths.quarantineRoot)
      && (
        optionalFingerprint(paths.installationReceipt)
        || optionalFingerprint(paths.installationClaim)
      )
    ) {
      return fail(
        "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_V2_ROLLBACK_CONFLICT",
        "Bootstrap rollback lost both roots before authority removal",
      );
    }
    removeInstallationAuthorityFile({
      absolutePath: paths.installationReceipt,
      expectedOwner: boundary.expectedOwner,
      schema: NodeToolchainProvisionerBootstrapInstallationReceiptV2Schema,
      expectedHash: claim.generation.installationReceiptHash,
      readHash: (value) => value.receiptHash,
    });
    input.hooks?.afterInstallationReceiptRemoved?.();
    removeInstallationAuthorityFile({
      absolutePath: paths.installationClaim,
      expectedOwner: boundary.expectedOwner,
      schema: NodeToolchainProvisionerBootstrapInstallationClaimV2Schema,
      expectedHash: claim.generation.installationClaimHash,
      readHash: (value) => value.claimHash,
    });
    input.hooks?.afterInstallationClaimRemoved?.();
    removePartialRollbackTree({
      root: paths.quarantineRoot,
      claim,
      expectedOwner: boundary.expectedOwner,
      ...(input.hooks ? { hooks: input.hooks } : {}),
    });
    if (optionalFingerprint(paths.rollbackStage)) {
      rmdirSync(paths.rollbackStage);
      syncDirectory(paths.staging);
    }
    lease.assertCurrent();
    const rollbackReceipt = buildNodeToolchainProvisionerBootstrapRollbackReceiptV2({
      claim,
      publisher: lease.evidence,
    });
    const rollbackReceiptBytes = canonicalJsonBytes(rollbackReceipt);
    try {
      publishCanonicalNoReplace({
        stagePath: paths.rollbackReceiptStage,
        targetPath: paths.rollbackReceipt,
        bytes: rollbackReceiptBytes,
        expectedOwner: boundary.expectedOwner,
        afterStage: input.hooks?.afterRollbackReceiptStage,
        afterLink: input.hooks?.afterRollbackReceiptPublished,
      });
    } finally {
      rollbackReceiptBytes.fill(0);
    }
    const finalClaim = readRollbackClaim({
      paths,
      expectedOwner: boundary.expectedOwner,
      plan,
    });
    unlinkCapturedFile({ absolutePath: paths.rollbackClaim, expected: finalClaim.fingerprint });
    input.hooks?.afterRollbackClaimRemoved?.();
    assertRollbackStagingCensus({
      paths,
      expectedOwner: boundary.expectedOwner,
      allowAbsent: false,
    });
    if (readdirSync(paths.staging).length !== 0) {
      return fail(
        "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_V2_ROLLBACK_FAILED",
        "Bootstrap rollback retained operational stage files",
      );
    }
    rmdirSync(paths.staging);
    syncDirectory(paths.parent);
    if (
      optionalFingerprint(paths.root)
      || optionalFingerprint(paths.installationReceipt)
      || optionalFingerprint(paths.installationClaim)
      || optionalFingerprint(paths.rollbackClaim)
      || optionalFingerprint(paths.rollbackStage)
    ) {
      return fail(
        "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_V2_ROLLBACK_FAILED",
        "Bootstrap rollback completion retained live generation state",
      );
    }
    const durable = readRollbackReceipt({
      paths,
      expectedOwner: boundary.expectedOwner,
      plan,
    });
    return Object.freeze({
      rollbackReceipt: deepFreezeJson(structuredClone(durable.value)),
      disposition: rollbackOperationalStateExistsAtStart ? "recovered" : "rolled_back",
    });
  } catch (error) {
    if (error instanceof NodeToolchainProvisionerBootstrapInstallationErrorV2) throw error;
    if (error instanceof DarwinParentDescriptorLeaseErrorV2) {
      return fail(
        "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_V2_LOCK_FAILED",
        "Bootstrap rollback lost its Darwin parent descriptor lease",
        error,
      );
    }
    return fail(
      "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_V2_ROLLBACK_FAILED",
      "Bootstrap rollback state machine failed before exact completion",
      error,
    );
  } finally {
    try {
      await lease?.release();
    } catch (error) {
      return fail(
        "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_V2_LOCK_FAILED",
        "Bootstrap rollback lease could not be released exactly",
        error,
      );
    }
  }
}

export async function rollbackNodeToolchainProvisionerBootstrapV2(
  plan: NodeToolchainProvisionerBootstrapRollbackPlanV2,
): Promise<NodeToolchainProvisionerBootstrapRollbackResultV2> {
  return rollbackBootstrap({ expectedScope: "production_release", plan });
}

export async function rollbackNodeToolchainProvisionerBootstrapV2ForTest(input: Readonly<{
  plan: NodeToolchainProvisionerBootstrapRollbackPlanV2;
  testHooks?: NodeToolchainProvisionerBootstrapRollbackTestHooksV2;
}>): Promise<NodeToolchainProvisionerBootstrapRollbackResultV2> {
  return rollbackBootstrap({
    expectedScope: "test_fixture",
    plan: input.plan,
    ...(input.testHooks ? { hooks: input.testHooks } : {}),
  });
}

export function revalidateNodeToolchainProvisionerBootstrapRollbackReceiptV2(
  planInput: NodeToolchainProvisionerBootstrapRollbackPlanV2,
): NodeToolchainProvisionerBootstrapRollbackReceiptV2 {
  const plan = NodeToolchainProvisionerBootstrapRollbackPlanV2Schema.parse(planInput);
  const boundary = rollbackBoundary(plan);
  assertRollbackParentCensus(boundary);
  assertRollbackLock({ paths: boundary.paths, expectedOwner: boundary.expectedOwner });
  if (
    optionalFingerprint(boundary.paths.root)
    || optionalFingerprint(boundary.paths.installationReceipt)
    || optionalFingerprint(boundary.paths.installationClaim)
    || optionalFingerprint(boundary.paths.rollbackClaim)
    || optionalFingerprint(boundary.paths.staging)
  ) {
    return fail(
      "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_V2_ROLLBACK_CONFLICT",
      "Durable bootstrap rollback tombstone coexists with live operation state",
    );
  }
  const durable = readRollbackReceipt({
    paths: boundary.paths,
    expectedOwner: boundary.expectedOwner,
    plan,
  });
  return deepFreezeJson(structuredClone(durable.value));
}
