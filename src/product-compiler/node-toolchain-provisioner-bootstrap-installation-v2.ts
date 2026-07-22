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
  rmdirSync,
  unlinkSync,
  writeSync,
  type Stats,
} from "node:fs";
import path from "node:path";
import { isProxy } from "node:util/types";

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
  buildNodeToolchainProvisionerBootstrapInstallationClaimV2,
  buildNodeToolchainProvisionerBootstrapInstallationIntentV2,
  getNodeToolchainProvisionerBootstrapInstallationPathsV2,
  hashNodeToolchainProvisionerBootstrapInstallationReceiptV2,
  hashNodeToolchainProvisionerBootstrapInstalledTreeV2,
  type NodeToolchainProvisionerBootstrapInstallationClaimV2,
  type NodeToolchainProvisionerBootstrapInstallationPathsV2,
  type NodeToolchainProvisionerBootstrapInstallationReceiptHashPayloadV2,
  type NodeToolchainProvisionerBootstrapInstallationReceiptV2,
} from "./schemas/node-toolchain-provisioner-bootstrap-installation-state-v2.js";
import {
  NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_BUNDLE_LOCATOR_V2,
  NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_LAUNCHER_LOCATOR_V2,
  NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_MANIFEST_LOCATOR_V2,
  NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_ROOT_V2,
  NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_RUNTIME_LOCATOR_V2,
} from "./schemas/node-toolchain-provisioner-bootstrap-v2.js";

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
  | "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_V2_DRIFT";

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
    return fingerprint(after);
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
): void {
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
    const after = assertDirectory({
      absolutePath: paths.parent,
      expectedOwner,
      allowedModes: [parentMode],
      errorCode: "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_V2_PARENT_INVALID",
    });
    if (
      !samePhysicalIdentity(before, after)
      || names.some((name) => !allowed.has(name))
      || names.length > allowed.size
    ) {
      return fail(
        "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_V2_CONFLICT",
        "Bootstrap installation parent contains an artifact outside the exact source lifecycle",
      );
    }
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
  if (
    current.intent.intentHash !== submitted.intent.intentHash
    || !canonicalJsonBytes(current.intent).equals(canonicalJsonBytes(submitted.intent))
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

function sameClaim(
  left: NodeToolchainProvisionerBootstrapInstallationClaimV2,
  right: NodeToolchainProvisionerBootstrapInstallationClaimV2,
): boolean {
  return left.claimHash === right.claimHash;
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
    unlinkSync(file.absolutePath);
  }
  for (const directory of [...directories].reverse()) rmdirSync(directory.absolutePath);
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
  for (const spec of expectedFileSpecs(input.snapshot)) {
    unlinkSync(path.join(payloadRoot, spec.locator));
  }
  for (const directory of ["bin", "lib", "runtime"] as const) {
    rmdirSync(path.join(payloadRoot, directory));
  }
  rmdirSync(payloadRoot);
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
    assertParentCensus(paths, boundary.expectedOwner, boundary.parentMode);
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
        const receipt = buildReceipt({ claim, rootFingerprint, lease });
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
    const receipt = buildReceipt({ claim, rootFingerprint, lease });
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
    assertParentCensus(paths, boundary.expectedOwner, boundary.parentMode);
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
  assertParentCensus(input.paths, input.expectedOwner, input.parentMode);
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
