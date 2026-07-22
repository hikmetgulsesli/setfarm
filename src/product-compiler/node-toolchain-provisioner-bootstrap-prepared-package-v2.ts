import { createHash } from "node:crypto";
import {
  chmodSync,
  closeSync,
  constants,
  fchmodSync,
  fstatSync,
  fsyncSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  openSync,
  readSync,
  readdirSync,
  realpathSync,
  rmSync,
  rmdirSync,
  unlinkSync,
  writeSync,
  type Stats,
} from "node:fs";
import path from "node:path";
import { isProxy } from "node:util/types";

import { canonicalJsonBytes } from "./canonical-json.js";
import {
  copyCompiledNodeToolchainProvisionerBootstrapV2,
  type CompiledNodeToolchainProvisionerBootstrapSnapshotV2,
  type CompiledNodeToolchainProvisionerBootstrapV2,
} from "./node-toolchain-provisioner-bootstrap-v2.js";
import {
  renderNodeToolchainProvisionerBootstrapLauncherV2,
} from "./node-toolchain-provisioner-bootstrap-launcher-v2.js";
import {
  NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_BUNDLE_LOCATOR_V2,
  NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_LAUNCHER_LOCATOR_V2,
  NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_MANIFEST_LOCATOR_V2,
  NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_MAX_BUNDLE_BYTES_V2,
  NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_MAX_LAUNCHER_BYTES_V2,
  NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_MAX_MANIFEST_BYTES_V2,
  NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_MAX_RUNTIME_BYTES_V2,
  NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_RUNTIME_LOCATOR_V2,
  NodeToolchainProvisionerBootstrapManifestV2Schema,
  type NodeToolchainProvisionerBootstrapManifestV2,
} from "./schemas/node-toolchain-provisioner-bootstrap-v2.js";
import {
  NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_PREPARED_PACKAGE_AUTHORITY_REF_V2,
  NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_PREPARED_PACKAGE_RECEIPT_V2_SCHEMA,
  NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_PREPARED_PACKAGE_VERSION_V2,
  NodeToolchainProvisionerBootstrapPreparedPackageReceiptV2Schema,
  hashNodeToolchainProvisionerBootstrapPreparedPackageReceiptV2,
  hashNodeToolchainProvisionerBootstrapPreparedTreeV2,
  type NodeToolchainProvisionerBootstrapPreparedPackageReceiptHashPayloadV2,
  type NodeToolchainProvisionerBootstrapPreparedPackageReceiptV2,
} from "./schemas/node-toolchain-provisioner-bootstrap-prepared-package-v2.js";

const PRODUCTION_STAGE_PREFIX_V2 =
  "/private/tmp/setfarm-node-toolchain-bootstrap-prepared-v2-" as const;
const TEST_STAGE_BASENAME_PREFIX_V2 =
  "setfarm-node-toolchain-bootstrap-prepared-v2-" as const;
const PAYLOAD_BASENAME_V2 = "payload" as const;

export type NodeToolchainProvisionerBootstrapPreparedPackageErrorCodeV2 =
  | "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_PREPARED_V2_INPUT_INVALID"
  | "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_PREPARED_V2_STAGE_INVALID"
  | "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_PREPARED_V2_PUBLICATION_FAILED"
  | "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_PREPARED_V2_PACKAGE_INVALID"
  | "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_PREPARED_V2_HANDLE_UNAUTHENTICATED"
  | "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_PREPARED_V2_HANDLE_DISPOSED"
  | "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_PREPARED_V2_PACKAGE_DRIFT"
  | "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_PREPARED_V2_CLEANUP_FAILED";

export class NodeToolchainProvisionerBootstrapPreparedPackageErrorV2 extends Error {
  readonly code: NodeToolchainProvisionerBootstrapPreparedPackageErrorCodeV2;
  override readonly cause?: unknown;

  constructor(
    code: NodeToolchainProvisionerBootstrapPreparedPackageErrorCodeV2,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message.slice(0, 1_500), options);
    this.name = "NodeToolchainProvisionerBootstrapPreparedPackageErrorV2";
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

type DirectoryCaptureV2 = Readonly<{
  locator: string;
  fingerprint: FingerprintV2;
  entries: readonly string[];
}>;

type FileCaptureV2 = Readonly<{
  locator: string;
  fingerprint: FingerprintV2;
  sha256: string;
}>;

type PreparedCaptureV2 = Readonly<{
  directories: readonly DirectoryCaptureV2[];
  files: readonly FileCaptureV2[];
  manifest: NodeToolchainProvisionerBootstrapManifestV2;
}>;

type PreparedPackageStateV2 = Readonly<{
  stageRoot: string;
  payloadRoot: string;
  ownerUid: number;
  ownerGid: number;
  receipt: NodeToolchainProvisionerBootstrapPreparedPackageReceiptV2;
  manifest: NodeToolchainProvisionerBootstrapManifestV2;
  directories: readonly DirectoryCaptureV2[];
  files: readonly FileCaptureV2[];
}>;

export type NodeToolchainProvisionerBootstrapPreparedPackageTestHooksV2 = Readonly<{
  beforeManifest?: (input: Readonly<{
    stageRoot: string;
    payloadRoot: string;
  }>) => void;
}>;

const handleCapabilityV2 = Object.freeze({});
const preparedPackageStatesV2 = new WeakMap<object, PreparedPackageStateV2>();
const disposedPreparedPackageHandlesV2 = new WeakSet<object>();

export class PreparedNodeToolchainProvisionerBootstrapPackageV2 {
  readonly receiptHash: string;
  readonly admissionScope: "production_release" | "test_fixture";

  constructor(capability: object, state: PreparedPackageStateV2) {
    if (capability !== handleCapabilityV2) {
      throw new NodeToolchainProvisionerBootstrapPreparedPackageErrorV2(
        "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_PREPARED_V2_HANDLE_UNAUTHENTICATED",
        "Prepared bootstrap package constructor capability is unavailable",
      );
    }
    this.receiptHash = state.receipt.receiptHash;
    this.admissionScope = state.receipt.admissionScope;
    preparedPackageStatesV2.set(this, state);
    Object.freeze(this);
  }
}

function fail(
  code: NodeToolchainProvisionerBootstrapPreparedPackageErrorCodeV2,
  message: string,
  cause?: unknown,
): never {
  throw new NodeToolchainProvisionerBootstrapPreparedPackageErrorV2(
    code,
    message,
    cause === undefined ? undefined : { cause },
  );
}

function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function modeBits(stat: Stats | FingerprintV2): number {
  return stat.mode & 0o7777;
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

function zeroSnapshot(snapshot: CompiledNodeToolchainProvisionerBootstrapSnapshotV2 | undefined): void {
  if (!snapshot) return;
  snapshot.manifestBytes.fill(0);
  snapshot.launcherBytes.fill(0);
  snapshot.bundleBytes.fill(0);
  snapshot.runtimeBytes.fill(0);
}

function processOwner(): Readonly<{ uid: number; gid: number }> {
  if (typeof process.getuid !== "function" || typeof process.getgid !== "function") {
    return fail(
      "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_PREPARED_V2_INPUT_INVALID",
      "Prepared bootstrap publication requires POSIX process ownership",
    );
  }
  return Object.freeze({ uid: process.getuid(), gid: process.getgid() });
}

function validateScratchParent(input: unknown, owner: Readonly<{ uid: number; gid: number }>): string {
  if (
    typeof input !== "string"
    || input.length < 1
    || input.length > 1_024
    || input.includes("\0")
    || !path.isAbsolute(input)
    || path.normalize(input) !== input
  ) {
    return fail(
      "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_PREPARED_V2_INPUT_INVALID",
      "Prepared bootstrap scratch parent must be one normalized absolute locator",
    );
  }
  try {
    const stat = lstatSync(input);
    if (
      !stat.isDirectory()
      || stat.isSymbolicLink()
      || realpathSync(input) !== input
      || stat.uid !== owner.uid
      || stat.gid !== owner.gid
      || modeBits(stat) !== 0o700
    ) {
      return fail(
        "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_PREPARED_V2_INPUT_INVALID",
        "Prepared bootstrap scratch parent must be one direct process-owned 0700 directory",
      );
    }
    return input;
  } catch (error) {
    if (error instanceof NodeToolchainProvisionerBootstrapPreparedPackageErrorV2) throw error;
    return fail(
      "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_PREPARED_V2_INPUT_INVALID",
      "Prepared bootstrap scratch parent could not be verified",
      error,
    );
  }
}

function closeQuietly(descriptor: number | undefined): void {
  if (descriptor === undefined) return;
  try {
    closeSync(descriptor);
  } catch {
    // The typed publication or verification failure remains authoritative.
  }
}

function writeExclusive(
  locator: string,
  bytes: Uint8Array,
  mode: 0o400 | 0o500,
  owner: Readonly<{ uid: number; gid: number }>,
): FileCaptureV2 {
  let descriptor: number | undefined;
  try {
    descriptor = openSync(
      locator,
      constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY | constants.O_NOFOLLOW,
      mode,
    );
    fchmodSync(descriptor, mode);
    let offset = 0;
    while (offset < bytes.byteLength) {
      const count = writeSync(descriptor, bytes, offset, bytes.byteLength - offset, null);
      if (count < 1) {
        return fail(
          "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_PREPARED_V2_PUBLICATION_FAILED",
          "Prepared bootstrap exclusive write ended before its exact byte length",
        );
      }
      offset += count;
    }
    fsyncSync(descriptor);
    const stat = fstatSync(descriptor);
    if (
      !stat.isFile()
      || stat.uid !== owner.uid
      || stat.gid !== owner.gid
      || stat.nlink !== 1
      || stat.size !== bytes.byteLength
      || modeBits(stat) !== mode
    ) {
      return fail(
        "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_PREPARED_V2_PUBLICATION_FAILED",
        "Prepared bootstrap exclusive file does not equal its storage contract",
      );
    }
    return Object.freeze({
      locator,
      fingerprint: fingerprint(stat),
      sha256: sha256(bytes),
    });
  } catch (error) {
    if (error instanceof NodeToolchainProvisionerBootstrapPreparedPackageErrorV2) throw error;
    return fail(
      "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_PREPARED_V2_PUBLICATION_FAILED",
      "Prepared bootstrap exclusive fsynced write failed",
      error,
    );
  } finally {
    closeQuietly(descriptor);
  }
}

function syncDirectory(
  locator: string,
  owner: Readonly<{ uid: number; gid: number }>,
): void {
  let descriptor: number | undefined;
  try {
    descriptor = openSync(locator, constants.O_RDONLY | constants.O_NOFOLLOW);
    const stat = fstatSync(descriptor);
    if (
      !stat.isDirectory()
      || stat.uid !== owner.uid
      || stat.gid !== owner.gid
      || modeBits(stat) !== 0o700
    ) {
      return fail(
        "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_PREPARED_V2_STAGE_INVALID",
        "Prepared bootstrap directory changed before its fsync barrier",
      );
    }
    fsyncSync(descriptor);
  } catch (error) {
    if (error instanceof NodeToolchainProvisionerBootstrapPreparedPackageErrorV2) throw error;
    return fail(
      "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_PREPARED_V2_PUBLICATION_FAILED",
      "Prepared bootstrap directory fsync failed",
      error,
    );
  } finally {
    closeQuietly(descriptor);
  }
}

function captureDirectory(input: Readonly<{
  root: string;
  locator: string;
  expectedEntries: readonly string[];
  owner: Readonly<{ uid: number; gid: number }>;
}>): DirectoryCaptureV2 {
  const absolute = input.locator === "." ? input.root : path.join(input.root, input.locator);
  try {
    const before = lstatSync(absolute);
    if (
      !before.isDirectory()
      || before.isSymbolicLink()
      || before.uid !== input.owner.uid
      || before.gid !== input.owner.gid
      || modeBits(before) !== 0o700
    ) {
      return fail(
        "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_PREPARED_V2_STAGE_INVALID",
        `Prepared bootstrap directory ${input.locator} has invalid metadata`,
      );
    }
    const entries = readdirSync(absolute).sort();
    const expected = [...input.expectedEntries].sort();
    if (
      entries.length !== expected.length
      || entries.some((entry, index) => entry !== expected[index])
    ) {
      return fail(
        "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_PREPARED_V2_STAGE_INVALID",
        `Prepared bootstrap directory ${input.locator} is not every-and-only`,
      );
    }
    const after = lstatSync(absolute);
    if (!sameFingerprint(fingerprint(before), fingerprint(after))) {
      return fail(
        "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_PREPARED_V2_STAGE_INVALID",
        `Prepared bootstrap directory ${input.locator} changed during enumeration`,
      );
    }
    return Object.freeze({
      locator: input.locator,
      fingerprint: fingerprint(after),
      entries: Object.freeze(entries),
    });
  } catch (error) {
    if (error instanceof NodeToolchainProvisionerBootstrapPreparedPackageErrorV2) throw error;
    return fail(
      "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_PREPARED_V2_STAGE_INVALID",
      `Prepared bootstrap directory ${input.locator} could not be verified`,
      error,
    );
  }
}

function readExactFile(input: Readonly<{
  payloadRoot: string;
  locator: string;
  expectedMode: 0o400 | 0o500;
  expectedLength: number;
  expectedSha256: string;
  maxLength: number;
  owner: Readonly<{ uid: number; gid: number }>;
}>): Readonly<{ bytes: Buffer; capture: FileCaptureV2 }> {
  const absolute = path.join(input.payloadRoot, input.locator);
  let descriptor: number | undefined;
  let bytes: Buffer | undefined;
  let released = false;
  try {
    descriptor = openSync(
      absolute,
      constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK,
    );
    const before = fstatSync(descriptor);
    if (
      !before.isFile()
      || before.uid !== input.owner.uid
      || before.gid !== input.owner.gid
      || before.nlink !== 1
      || modeBits(before) !== input.expectedMode
      || before.size !== input.expectedLength
      || before.size < 1
      || before.size > input.maxLength
    ) {
      return fail(
        "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_PREPARED_V2_PACKAGE_INVALID",
        `Prepared bootstrap member ${input.locator} has invalid metadata`,
      );
    }
    bytes = Buffer.allocUnsafeSlow(before.size);
    let offset = 0;
    while (offset < bytes.byteLength) {
      const count = readSync(descriptor, bytes, offset, bytes.byteLength - offset, null);
      if (count < 1) {
        return fail(
          "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_PREPARED_V2_PACKAGE_INVALID",
          `Prepared bootstrap member ${input.locator} ended early`,
        );
      }
      offset += count;
    }
    const eof = Buffer.allocUnsafe(1);
    if (readSync(descriptor, eof, 0, 1, null) !== 0) {
      return fail(
        "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_PREPARED_V2_PACKAGE_INVALID",
        `Prepared bootstrap member ${input.locator} exceeded its inspected length`,
      );
    }
    const after = fstatSync(descriptor);
    const pathAfter = lstatSync(absolute);
    const digest = sha256(bytes);
    if (
      !sameFingerprint(fingerprint(before), fingerprint(after))
      || !sameFingerprint(fingerprint(after), fingerprint(pathAfter))
      || digest !== input.expectedSha256
    ) {
      return fail(
        "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_PREPARED_V2_PACKAGE_INVALID",
        `Prepared bootstrap member ${input.locator} changed or mismatched`,
      );
    }
    const result = Object.freeze({
      bytes,
      capture: Object.freeze({
        locator: input.locator,
        fingerprint: fingerprint(after),
        sha256: digest,
      }),
    });
    released = true;
    return result;
  } catch (error) {
    if (error instanceof NodeToolchainProvisionerBootstrapPreparedPackageErrorV2) throw error;
    return fail(
      "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_PREPARED_V2_PACKAGE_INVALID",
      `Prepared bootstrap member ${input.locator} could not be read safely`,
      error,
    );
  } finally {
    if (!released) bytes?.fill(0);
    closeQuietly(descriptor);
  }
}

function fileSpecs(manifest: NodeToolchainProvisionerBootstrapManifestV2) {
  return Object.freeze([
    Object.freeze({
      ...manifest.files.launcher,
      storageMode: 0o500 as const,
      maxLength: NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_MAX_LAUNCHER_BYTES_V2,
    }),
    Object.freeze({
      ...manifest.files.bundle,
      storageMode: 0o400 as const,
      maxLength: NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_MAX_BUNDLE_BYTES_V2,
    }),
    Object.freeze({
      ...manifest.files.bootstrapRuntime,
      storageMode: 0o500 as const,
      maxLength: NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_MAX_RUNTIME_BYTES_V2,
    }),
  ]);
}

function capturePreparedDirectories(
  stageRoot: string,
  payloadRoot: string,
  owner: Readonly<{ uid: number; gid: number }>,
  manifestPresent: boolean,
): readonly DirectoryCaptureV2[] {
  return Object.freeze([
    captureDirectory({
      root: stageRoot,
      locator: ".",
      expectedEntries: [PAYLOAD_BASENAME_V2],
      owner,
    }),
    captureDirectory({
      root: payloadRoot,
      locator: ".",
      expectedEntries: manifestPresent
        ? [NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_MANIFEST_LOCATOR_V2, "bin", "lib", "runtime"]
        : ["bin", "lib", "runtime"],
      owner,
    }),
    captureDirectory({
      root: payloadRoot,
      locator: "bin",
      expectedEntries: [path.basename(NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_LAUNCHER_LOCATOR_V2)],
      owner,
    }),
    captureDirectory({
      root: payloadRoot,
      locator: "lib",
      expectedEntries: [path.basename(NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_BUNDLE_LOCATOR_V2)],
      owner,
    }),
    captureDirectory({
      root: payloadRoot,
      locator: "runtime",
      expectedEntries: [path.basename(NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_RUNTIME_LOCATOR_V2)],
      owner,
    }),
  ]);
}

function verifyBeforeManifest(input: Readonly<{
  stageRoot: string;
  payloadRoot: string;
  owner: Readonly<{ uid: number; gid: number }>;
  snapshot: CompiledNodeToolchainProvisionerBootstrapSnapshotV2;
}>): void {
  capturePreparedDirectories(input.stageRoot, input.payloadRoot, input.owner, false);
  const expectedBytes = new Map<string, Buffer>([
    [NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_LAUNCHER_LOCATOR_V2, input.snapshot.launcherBytes],
    [NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_BUNDLE_LOCATOR_V2, input.snapshot.bundleBytes],
    [NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_RUNTIME_LOCATOR_V2, input.snapshot.runtimeBytes],
  ]);
  for (const spec of fileSpecs(input.snapshot.manifest)) {
    const read = readExactFile({
      payloadRoot: input.payloadRoot,
      locator: spec.locator,
      expectedMode: spec.storageMode,
      expectedLength: spec.byteLength,
      expectedSha256: spec.sha256,
      maxLength: spec.maxLength,
      owner: input.owner,
    });
    try {
      const expected = expectedBytes.get(spec.locator);
      if (!expected || !read.bytes.equals(expected)) {
        return fail(
          "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_PREPARED_V2_PACKAGE_INVALID",
          `Prepared bootstrap pre-manifest member ${spec.locator} differs from compiled authority`,
        );
      }
    } finally {
      read.bytes.fill(0);
    }
  }
}

function verifyPreparedStage(input: Readonly<{
  stageRoot: string;
  payloadRoot: string;
  owner: Readonly<{ uid: number; gid: number }>;
  expectedManifest: NodeToolchainProvisionerBootstrapManifestV2;
}>): PreparedCaptureV2 {
  const beforeDirectories = capturePreparedDirectories(
    input.stageRoot,
    input.payloadRoot,
    input.owner,
    true,
  );
  const expectedManifestBytes = canonicalJsonBytes(input.expectedManifest);
  const manifestRead = readExactFile({
    payloadRoot: input.payloadRoot,
    locator: NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_MANIFEST_LOCATOR_V2,
    expectedMode: 0o400,
    expectedLength: expectedManifestBytes.byteLength,
    expectedSha256: sha256(expectedManifestBytes),
    maxLength: NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_MAX_MANIFEST_BYTES_V2,
    owner: input.owner,
  });
  let manifest: NodeToolchainProvisionerBootstrapManifestV2;
  try {
    const raw = JSON.parse(manifestRead.bytes.toString("utf8"));
    const parsed = NodeToolchainProvisionerBootstrapManifestV2Schema.safeParse(raw);
    if (
      !parsed.success
      || !manifestRead.bytes.equals(canonicalJsonBytes(parsed.success ? parsed.data : raw))
      || !manifestRead.bytes.equals(expectedManifestBytes)
    ) {
      return fail(
        "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_PREPARED_V2_PACKAGE_INVALID",
        "Prepared bootstrap manifest is not the exact compiled canonical authority",
        parsed.success ? undefined : parsed.error,
      );
    }
    manifest = deepFreezeJson(parsed.data);
  } catch (error) {
    if (error instanceof NodeToolchainProvisionerBootstrapPreparedPackageErrorV2) throw error;
    return fail(
      "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_PREPARED_V2_PACKAGE_INVALID",
      "Prepared bootstrap manifest could not be decoded safely",
      error,
    );
  } finally {
    manifestRead.bytes.fill(0);
    expectedManifestBytes.fill(0);
  }

  const files: FileCaptureV2[] = [manifestRead.capture];
  const expectedLauncher = renderNodeToolchainProvisionerBootstrapLauncherV2({
    rootLocator: manifest.layout.rootLocator,
    expectedOwnerUid: manifest.layout.expectedOwnerUid,
    expectedOwnerGid: manifest.layout.expectedOwnerGid,
    bundleSha256: manifest.files.bundle.sha256,
    bundleByteLength: manifest.files.bundle.byteLength,
    runtimeSha256: manifest.files.bootstrapRuntime.sha256,
    runtimeByteLength: manifest.files.bootstrapRuntime.byteLength,
  });
  try {
    for (const spec of fileSpecs(manifest)) {
      const read = readExactFile({
        payloadRoot: input.payloadRoot,
        locator: spec.locator,
        expectedMode: spec.storageMode,
        expectedLength: spec.byteLength,
        expectedSha256: spec.sha256,
        maxLength: spec.maxLength,
        owner: input.owner,
      });
      try {
        if (
          spec.locator === NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_LAUNCHER_LOCATOR_V2
          && !read.bytes.equals(expectedLauncher)
        ) {
          return fail(
            "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_PREPARED_V2_PACKAGE_INVALID",
            "Prepared bootstrap launcher is not reproduced by its future target contract",
          );
        }
        files.push(read.capture);
      } finally {
        read.bytes.fill(0);
      }
    }
  } finally {
    expectedLauncher.fill(0);
  }

  const afterDirectories = capturePreparedDirectories(
    input.stageRoot,
    input.payloadRoot,
    input.owner,
    true,
  );
  if (
    beforeDirectories.length !== afterDirectories.length
    || beforeDirectories.some((directory, index) => {
      const after = afterDirectories[index];
      return !after || !sameFingerprint(directory.fingerprint, after.fingerprint);
    })
  ) {
    return fail(
      "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_PREPARED_V2_STAGE_INVALID",
      "Prepared bootstrap directories changed while their members were reopened",
    );
  }
  return Object.freeze({
    directories: beforeDirectories,
    files: Object.freeze(files),
    manifest,
  });
}

function buildReceipt(
  capture: PreparedCaptureV2,
  owner: Readonly<{ uid: number; gid: number }>,
): NodeToolchainProvisionerBootstrapPreparedPackageReceiptV2 {
  const manifest = capture.manifest;
  if (manifest.build.authority.kind !== "authenticated_bundle") {
    return fail(
      "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_PREPARED_V2_PACKAGE_INVALID",
      "Prepared bootstrap authority requires one authenticated bundle manifest",
    );
  }
  const captures = new Map(capture.files.map((file) => [file.locator, file]));
  const manifestCapture = captures.get(NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_MANIFEST_LOCATOR_V2)!;
  const members = {
    manifest: {
      artifactRef: "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_MANIFEST_V2" as const,
      locator: NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_MANIFEST_LOCATOR_V2,
      mediaType: "application/json" as const,
      sha256: manifestCapture.sha256,
      byteLength: manifestCapture.fingerprint.byteLength,
      linkCount: 1 as const,
      storageMode: "0400" as const,
      targetMode: "0444" as const,
    },
    launcher: {
      artifactRef: manifest.files.launcher.artifactRef,
      locator: manifest.files.launcher.locator,
      mediaType: manifest.files.launcher.mediaType,
      sha256: manifest.files.launcher.sha256,
      byteLength: manifest.files.launcher.byteLength,
      linkCount: 1 as const,
      storageMode: "0500" as const,
      targetMode: manifest.files.launcher.mode,
    },
    bundle: {
      artifactRef: manifest.files.bundle.artifactRef,
      locator: manifest.files.bundle.locator,
      mediaType: manifest.files.bundle.mediaType,
      sha256: manifest.files.bundle.sha256,
      byteLength: manifest.files.bundle.byteLength,
      linkCount: 1 as const,
      storageMode: "0400" as const,
      targetMode: manifest.files.bundle.mode,
    },
    bootstrapRuntime: {
      artifactRef: manifest.files.bootstrapRuntime.artifactRef,
      locator: manifest.files.bootstrapRuntime.locator,
      mediaType: manifest.files.bootstrapRuntime.mediaType,
      sha256: manifest.files.bootstrapRuntime.sha256,
      byteLength: manifest.files.bootstrapRuntime.byteLength,
      linkCount: 1 as const,
      storageMode: "0500" as const,
      targetMode: manifest.files.bootstrapRuntime.mode,
    },
  };
  const totalBytes = Object.values(members)
    .reduce((sum, member) => sum + member.byteLength, 0);
  const storageBase = {
    ownerUid: owner.uid,
    ownerGid: owner.gid,
    rootMode: "0700" as const,
    directoryMode: "0700" as const,
    immutableFileMode: "0400" as const,
    executableFileMode: "0500" as const,
    linkPolicy: "regular_files_only_no_links_v2" as const,
    allowedDirectories: [".", "bin", "lib", "runtime"] as [
      ".",
      "bin",
      "lib",
      "runtime",
    ],
    allowedRootEntries: [
      NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_MANIFEST_LOCATOR_V2,
      "bin",
      "lib",
      "runtime",
    ] as [
      typeof NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_MANIFEST_LOCATOR_V2,
      "bin",
      "lib",
      "runtime",
    ],
    fileCount: 4 as const,
    directoryCount: 4 as const,
    totalBytes,
    treeHash: "0".repeat(64),
  };
  const storage = {
    ...storageBase,
    treeHash: hashNodeToolchainProvisionerBootstrapPreparedTreeV2({
      storage: storageBase,
      members,
    }),
  };
  const identity: NodeToolchainProvisionerBootstrapPreparedPackageReceiptHashPayloadV2 = {
    schema: NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_PREPARED_PACKAGE_RECEIPT_V2_SCHEMA,
    receiptVersion: NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_PREPARED_PACKAGE_VERSION_V2,
    authorityRef: NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_PREPARED_PACKAGE_AUTHORITY_REF_V2,
    admissionScope: manifest.admissionScope === "production_root"
      ? "production_release"
      : "test_fixture",
    status: "prepared_payload_verified",
    installationStatus: "not_installed_unprivileged_payload",
    source: {
      codeSha: manifest.release.codeSha,
      sourceTreeHash: manifest.release.sourceTreeHash,
      packageVersion: manifest.release.packageVersion,
      manifestHash: manifest.manifestHash,
      manifestSha256: members.manifest.sha256,
      manifestByteLength: members.manifest.byteLength,
      buildContractHash: manifest.build.buildContractHash,
      bundleAuthorityReceiptHash: manifest.build.authority.receipt.receiptHash,
      launcherHash: manifest.files.launcher.sha256,
      launcherByteLength: manifest.files.launcher.byteLength,
      bundleOutputHash: manifest.files.bundle.sha256,
      bundleOutputByteLength: manifest.files.bundle.byteLength,
      privateTreeReceiptHash: manifest.distribution.sourcePrivateTree.receiptHash,
      privateTreeNodeHash: manifest.distribution.sourcePrivateTree.tree.node.contentHash,
      privateTreeNodeByteLength: manifest.distribution.sourcePrivateTree.tree.node.byteLength,
    },
    target: {
      rootLocator: manifest.layout.rootLocator,
      expectedOwnerUid: manifest.layout.expectedOwnerUid,
      expectedOwnerGid: manifest.layout.expectedOwnerGid,
      directoryMode: manifest.layout.directoryMode,
      manifestMode: manifest.layout.manifestMode,
      publicationPolicy: manifest.layout.publicationPolicy,
    },
    storage,
    members,
    publication: {
      policy: "exclusive_create_fsync_files_directories_manifest_last_v2",
      manifestPublishedLast: true,
      reopenedAfterPublication: true,
      targetRootAccess: "none",
    },
  };
  const parsed = NodeToolchainProvisionerBootstrapPreparedPackageReceiptV2Schema.safeParse({
    ...identity,
    receiptHash: hashNodeToolchainProvisionerBootstrapPreparedPackageReceiptV2(identity),
  });
  if (!parsed.success) {
    return fail(
      "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_PREPARED_V2_PACKAGE_INVALID",
      "Prepared bootstrap receipt failed its exact V2 schema",
      parsed.error,
    );
  }
  return deepFreezeJson(parsed.data);
}

function safeRemoveFailedStage(stageRoot: string | undefined): void {
  if (!stageRoot) return;
  try {
    rmSync(stageRoot, { recursive: true, force: true });
  } catch {
    // The primary publication failure remains authoritative; no handle is issued.
  }
}

function createStage(
  stagePrefix: string,
  owner: Readonly<{ uid: number; gid: number }>,
): Readonly<{ stageRoot: string; payloadRoot: string }> {
  let stageRoot: string | undefined;
  try {
    stageRoot = mkdtempSync(stagePrefix);
    chmodSync(stageRoot, 0o700);
    const stage = lstatSync(stageRoot);
    if (
      !stage.isDirectory()
      || stage.isSymbolicLink()
      || realpathSync(stageRoot) !== stageRoot
      || stage.uid !== owner.uid
      || stage.gid !== owner.gid
      || modeBits(stage) !== 0o700
    ) {
      return fail(
        "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_PREPARED_V2_STAGE_INVALID",
        "Fresh prepared bootstrap stage does not equal its private owner contract",
      );
    }
    const payloadRoot = path.join(stageRoot, PAYLOAD_BASENAME_V2);
    mkdirSync(payloadRoot, { mode: 0o700 });
    chmodSync(payloadRoot, 0o700);
    for (const directory of ["bin", "lib", "runtime"] as const) {
      const locator = path.join(payloadRoot, directory);
      mkdirSync(locator, { mode: 0o700 });
      chmodSync(locator, 0o700);
    }
    return Object.freeze({ stageRoot, payloadRoot });
  } catch (error) {
    safeRemoveFailedStage(stageRoot);
    if (error instanceof NodeToolchainProvisionerBootstrapPreparedPackageErrorV2) throw error;
    return fail(
      "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_PREPARED_V2_STAGE_INVALID",
      "Fresh prepared bootstrap stage could not be created",
      error,
    );
  }
}

function publishPreparedPackage(input: Readonly<{
  compiledHandle: CompiledNodeToolchainProvisionerBootstrapV2;
  expectedScope: "production_root" | "test_fixture";
  stagePrefix: string;
  testHooks?: NodeToolchainProvisionerBootstrapPreparedPackageTestHooksV2;
}>): PreparedNodeToolchainProvisionerBootstrapPackageV2 {
  const owner = processOwner();
  let snapshot: CompiledNodeToolchainProvisionerBootstrapSnapshotV2 | undefined;
  let stageRoot: string | undefined;
  let issued = false;
  try {
    try {
      snapshot = copyCompiledNodeToolchainProvisionerBootstrapV2(input.compiledHandle);
    } catch (error) {
      return fail(
        "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_PREPARED_V2_INPUT_INVALID",
        "Prepared bootstrap publication requires one authentic compiled handle",
        error,
      );
    }
    if (snapshot.manifest.admissionScope !== input.expectedScope) {
      return fail(
        "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_PREPARED_V2_INPUT_INVALID",
        "Compiled bootstrap scope does not equal the prepared publisher authority",
      );
    }
    const stage = createStage(input.stagePrefix, owner);
    stageRoot = stage.stageRoot;
    writeExclusive(
      path.join(stage.payloadRoot, NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_LAUNCHER_LOCATOR_V2),
      snapshot.launcherBytes,
      0o500,
      owner,
    );
    writeExclusive(
      path.join(stage.payloadRoot, NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_BUNDLE_LOCATOR_V2),
      snapshot.bundleBytes,
      0o400,
      owner,
    );
    writeExclusive(
      path.join(stage.payloadRoot, NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_RUNTIME_LOCATOR_V2),
      snapshot.runtimeBytes,
      0o500,
      owner,
    );
    for (const directory of ["bin", "lib", "runtime"] as const) {
      syncDirectory(path.join(stage.payloadRoot, directory), owner);
    }
    input.testHooks?.beforeManifest?.(Object.freeze({
      stageRoot: stage.stageRoot,
      payloadRoot: stage.payloadRoot,
    }));
    verifyBeforeManifest({
      stageRoot: stage.stageRoot,
      payloadRoot: stage.payloadRoot,
      owner,
      snapshot,
    });
    writeExclusive(
      path.join(stage.payloadRoot, NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_MANIFEST_LOCATOR_V2),
      snapshot.manifestBytes,
      0o400,
      owner,
    );
    syncDirectory(stage.payloadRoot, owner);
    syncDirectory(stage.stageRoot, owner);
    const capture = verifyPreparedStage({
      stageRoot: stage.stageRoot,
      payloadRoot: stage.payloadRoot,
      owner,
      expectedManifest: snapshot.manifest,
    });
    const receipt = buildReceipt(capture, owner);
    const state: PreparedPackageStateV2 = Object.freeze({
      stageRoot: stage.stageRoot,
      payloadRoot: stage.payloadRoot,
      ownerUid: owner.uid,
      ownerGid: owner.gid,
      receipt,
      manifest: deepFreezeJson(structuredClone(capture.manifest)),
      directories: capture.directories,
      files: capture.files,
    });
    const handle = new PreparedNodeToolchainProvisionerBootstrapPackageV2(handleCapabilityV2, state);
    issued = true;
    return handle;
  } catch (error) {
    if (error instanceof NodeToolchainProvisionerBootstrapPreparedPackageErrorV2) throw error;
    return fail(
      "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_PREPARED_V2_PUBLICATION_FAILED",
      "Prepared bootstrap publication failed before authority issuance",
      error,
    );
  } finally {
    zeroSnapshot(snapshot);
    if (!issued) safeRemoveFailedStage(stageRoot);
  }
}

export function prepareNodeToolchainProvisionerBootstrapPackageV2(
  compiledHandle: CompiledNodeToolchainProvisionerBootstrapV2,
): PreparedNodeToolchainProvisionerBootstrapPackageV2 {
  return publishPreparedPackage({
    compiledHandle,
    expectedScope: "production_root",
    stagePrefix: PRODUCTION_STAGE_PREFIX_V2,
  });
}

function exactTestInput(input: unknown): Readonly<{
  scratchParent: string;
  testHooks?: NodeToolchainProvisionerBootstrapPreparedPackageTestHooksV2;
}> {
  try {
    if (
      typeof input !== "object"
      || input === null
      || isProxy(input)
      || Object.getPrototypeOf(input) !== Object.prototype
    ) {
      return fail(
        "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_PREPARED_V2_INPUT_INVALID",
        "Prepared bootstrap test input must be one plain exact object",
      );
    }
    const descriptors = Object.getOwnPropertyDescriptors(input);
    const keys = Reflect.ownKeys(input).sort();
    if (
      keys.length < 1
      || keys.length > 2
      || keys[0] !== "scratchParent"
      || (keys.length === 2 && keys[1] !== "testHooks")
    ) {
      return fail(
        "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_PREPARED_V2_INPUT_INVALID",
        "Prepared bootstrap test input has unknown or missing fields",
      );
    }
    const scratchParent = descriptors.scratchParent && "value" in descriptors.scratchParent
      ? descriptors.scratchParent.value
      : undefined;
    const hooks = descriptors.testHooks && "value" in descriptors.testHooks
      ? descriptors.testHooks.value
      : undefined;
    if (hooks !== undefined) {
      if (
        typeof hooks !== "object"
        || hooks === null
        || isProxy(hooks)
        || Object.getPrototypeOf(hooks) !== Object.prototype
        || Reflect.ownKeys(hooks).length !== 1
        || Reflect.ownKeys(hooks)[0] !== "beforeManifest"
      ) {
        return fail(
          "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_PREPARED_V2_INPUT_INVALID",
          "Prepared bootstrap test hooks must be one exact object",
        );
      }
      const descriptor = Object.getOwnPropertyDescriptor(hooks, "beforeManifest");
      if (!descriptor || !("value" in descriptor) || typeof descriptor.value !== "function") {
        return fail(
          "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_PREPARED_V2_INPUT_INVALID",
          "Prepared bootstrap before-manifest test hook must be one data function",
        );
      }
      return Object.freeze({
        scratchParent: scratchParent as string,
        testHooks: Object.freeze({ beforeManifest: descriptor.value }),
      });
    }
    return Object.freeze({ scratchParent: scratchParent as string });
  } catch (error) {
    if (error instanceof NodeToolchainProvisionerBootstrapPreparedPackageErrorV2) throw error;
    return fail(
      "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_PREPARED_V2_INPUT_INVALID",
      "Prepared bootstrap test input could not be inspected safely",
      error,
    );
  }
}

export function prepareNodeToolchainProvisionerBootstrapPackageV2ForTest(
  compiledHandle: CompiledNodeToolchainProvisionerBootstrapV2,
  input: unknown,
): PreparedNodeToolchainProvisionerBootstrapPackageV2 {
  const owner = processOwner();
  const exact = exactTestInput(input);
  const scratchParent = validateScratchParent(exact.scratchParent, owner);
  return publishPreparedPackage({
    compiledHandle,
    expectedScope: "test_fixture",
    stagePrefix: path.join(scratchParent, TEST_STAGE_BASENAME_PREFIX_V2),
    ...(exact.testHooks ? { testHooks: exact.testHooks } : {}),
  });
}

function authenticState(
  handle: PreparedNodeToolchainProvisionerBootstrapPackageV2,
): PreparedPackageStateV2 {
  if (
    typeof handle !== "object"
    || handle === null
    || isProxy(handle)
    || Object.getPrototypeOf(handle)
      !== PreparedNodeToolchainProvisionerBootstrapPackageV2.prototype
  ) {
    return fail(
      "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_PREPARED_V2_HANDLE_UNAUTHENTICATED",
      "Prepared bootstrap package operation requires one authentic handle",
    );
  }
  if (disposedPreparedPackageHandlesV2.has(handle)) {
    return fail(
      "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_PREPARED_V2_HANDLE_DISPOSED",
      "Prepared bootstrap package has already been disposed",
    );
  }
  const state = preparedPackageStatesV2.get(handle);
  if (!state) {
    return fail(
      "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_PREPARED_V2_HANDLE_UNAUTHENTICATED",
      "Prepared bootstrap package handle was not issued by the private publisher",
    );
  }
  return state;
}

function sameCapture(state: PreparedPackageStateV2, fresh: PreparedCaptureV2): boolean {
  return state.manifest.manifestHash === fresh.manifest.manifestHash
    && state.directories.length === fresh.directories.length
    && state.files.length === fresh.files.length
    && state.directories.every((directory, index) => {
      const next = fresh.directories[index];
      return next !== undefined
        && directory.locator === next.locator
        && sameFingerprint(directory.fingerprint, next.fingerprint);
    })
    && state.files.every((file, index) => {
      const next = fresh.files[index];
      return next !== undefined
        && file.locator === next.locator
        && file.sha256 === next.sha256
        && sameFingerprint(file.fingerprint, next.fingerprint);
    });
}

export function inspectNodeToolchainProvisionerBootstrapPreparedPackageReceiptV2(
  handle: PreparedNodeToolchainProvisionerBootstrapPackageV2,
): NodeToolchainProvisionerBootstrapPreparedPackageReceiptV2 {
  return deepFreezeJson(structuredClone(authenticState(handle).receipt));
}

export function revalidateNodeToolchainProvisionerBootstrapPreparedPackageV2(
  handle: PreparedNodeToolchainProvisionerBootstrapPackageV2,
): NodeToolchainProvisionerBootstrapPreparedPackageReceiptV2 {
  const state = authenticState(handle);
  const fresh = verifyPreparedStage({
    stageRoot: state.stageRoot,
    payloadRoot: state.payloadRoot,
    owner: { uid: state.ownerUid, gid: state.ownerGid },
    expectedManifest: state.manifest,
  });
  const receipt = buildReceipt(fresh, { uid: state.ownerUid, gid: state.ownerGid });
  if (!sameCapture(state, fresh) || receipt.receiptHash !== state.receipt.receiptHash) {
    return fail(
      "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_PREPARED_V2_PACKAGE_DRIFT",
      "Prepared bootstrap package physical identity changed after authority issuance",
    );
  }
  return deepFreezeJson(structuredClone(receipt));
}

function cleanupExactPackage(state: PreparedPackageStateV2): void {
  try {
    for (const locator of [
      NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_MANIFEST_LOCATOR_V2,
      NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_LAUNCHER_LOCATOR_V2,
      NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_BUNDLE_LOCATOR_V2,
      NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_RUNTIME_LOCATOR_V2,
    ]) {
      unlinkSync(path.join(state.payloadRoot, locator));
    }
    for (const directory of ["bin", "lib", "runtime"] as const) {
      rmdirSync(path.join(state.payloadRoot, directory));
    }
    rmdirSync(state.payloadRoot);
    rmdirSync(state.stageRoot);
  } catch (error) {
    return fail(
      "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_PREPARED_V2_CLEANUP_FAILED",
      "Authenticated prepared bootstrap package could not be removed exactly",
      error,
    );
  }
}

export function disposeNodeToolchainProvisionerBootstrapPreparedPackageV2(
  handle: PreparedNodeToolchainProvisionerBootstrapPackageV2,
): void {
  if (
    typeof handle !== "object"
    || handle === null
    || isProxy(handle)
    || Object.getPrototypeOf(handle)
      !== PreparedNodeToolchainProvisionerBootstrapPackageV2.prototype
  ) {
    return fail(
      "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_PREPARED_V2_HANDLE_UNAUTHENTICATED",
      "Prepared bootstrap package disposal requires one authentic handle",
    );
  }
  if (disposedPreparedPackageHandlesV2.has(handle)) return;
  const state = authenticState(handle);
  revalidateNodeToolchainProvisionerBootstrapPreparedPackageV2(handle);
  cleanupExactPackage(state);
  preparedPackageStatesV2.delete(handle);
  disposedPreparedPackageHandlesV2.add(handle);
}
