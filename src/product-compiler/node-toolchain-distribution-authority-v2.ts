import { createHash } from "node:crypto";
import {
  chmodSync,
  closeSync,
  constants,
  fstatSync,
  fsyncSync,
  lstatSync,
  mkdtempSync,
  openSync,
  readSync,
  readdirSync,
  rmdirSync,
  unlinkSync,
  writeSync,
  type Stats,
} from "node:fs";
import path from "node:path";
import { isProxy } from "node:util/types";

import {
  getCodeOwnedNodeToolchainDistributionArtifactV2,
  getCodeOwnedNodeToolchainDistributionManifestV2,
} from "./node-toolchain-distribution-manifest-v2.js";
import {
  NODE_TOOLCHAIN_DISTRIBUTION_MANIFEST_V2_SCHEMA,
  NODE_TOOLCHAIN_DISTRIBUTION_VERIFICATION_RECEIPT_V2_SCHEMA,
  NODE_TOOLCHAIN_DISTRIBUTION_VERSION_V2,
  NodeToolchainDistributionArtifactV2Schema,
  NodeToolchainDistributionVerificationReceiptV2Schema,
  hashNodeToolchainDistributionVerificationReceiptV2,
  type NodeToolchainDistributionArtifactV2,
  type NodeToolchainDistributionVerificationReceiptHashPayloadV2,
  type NodeToolchainDistributionVerificationReceiptV2,
} from "./schemas/node-toolchain-distribution-v2.js";

export type NodeToolchainDistributionAuthorityErrorCodeV2 =
  | "NODE_TOOLCHAIN_DISTRIBUTION_V2_INPUT_INVALID"
  | "NODE_TOOLCHAIN_DISTRIBUTION_V2_SOURCE_INVALID"
  | "NODE_TOOLCHAIN_DISTRIBUTION_V2_LENGTH_MISMATCH"
  | "NODE_TOOLCHAIN_DISTRIBUTION_V2_DIGEST_MISMATCH"
  | "NODE_TOOLCHAIN_DISTRIBUTION_V2_SOURCE_CHANGED"
  | "NODE_TOOLCHAIN_DISTRIBUTION_V2_PRIVATE_COPY_MISMATCH"
  | "NODE_TOOLCHAIN_DISTRIBUTION_V2_RECEIPT_INVALID"
  | "NODE_TOOLCHAIN_DISTRIBUTION_V2_HANDLE_UNAUTHENTICATED"
  | "NODE_TOOLCHAIN_DISTRIBUTION_V2_HANDLE_DISPOSED"
  | "NODE_TOOLCHAIN_DISTRIBUTION_V2_CLEANUP_FAILED";

export class NodeToolchainDistributionAuthorityErrorV2 extends Error {
  readonly code: NodeToolchainDistributionAuthorityErrorCodeV2;
  override readonly cause?: unknown;

  constructor(
    code: NodeToolchainDistributionAuthorityErrorCodeV2,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message.slice(0, 1_500), options);
    this.name = "NodeToolchainDistributionAuthorityErrorV2";
    this.code = code;
    this.cause = options?.cause;
  }
}

type FileFingerprintV2 = Readonly<{
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

type TestHooksV2 = Readonly<{
  afterSourceCopy?: () => void | Promise<void>;
  afterPrivateSync?: (input: Readonly<{
    privateArchivePath: string;
  }>) => void | Promise<void>;
}>;

type PrivateArchiveStateV2 = Readonly<{
  privateRoot: string;
  privateRootFingerprint: FileFingerprintV2;
  privateArchivePath: string;
  privateArchiveFingerprint: FileFingerprintV2;
  receipt: NodeToolchainDistributionVerificationReceiptV2;
}>;

const handleConstructorCapabilityV2 = Object.freeze({});
const privateArchiveStateV2 = new WeakMap<object, PrivateArchiveStateV2>();
const disposedHandlesV2 = new WeakSet<object>();

export class VerifiedNodeToolchainDistributionArchiveV2 {
  readonly receiptHash: string;

  constructor(
    capability: object,
    state: PrivateArchiveStateV2,
  ) {
    if (capability !== handleConstructorCapabilityV2) {
      throw new NodeToolchainDistributionAuthorityErrorV2(
        "NODE_TOOLCHAIN_DISTRIBUTION_V2_HANDLE_UNAUTHENTICATED",
        "Verified Node distribution constructor capability is unavailable",
      );
    }
    this.receiptHash = state.receipt.receiptHash;
    privateArchiveStateV2.set(this, state);
    Object.freeze(this);
  }
}

function fail(
  code: NodeToolchainDistributionAuthorityErrorCodeV2,
  message: string,
  cause?: unknown,
): never {
  throw new NodeToolchainDistributionAuthorityErrorV2(
    code,
    message,
    cause === undefined ? undefined : { cause },
  );
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value) || isProxy(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function exactKeys(value: Record<string, unknown>, expected: readonly string[]): boolean {
  const keys = Reflect.ownKeys(value);
  if (keys.some((key) => typeof key !== "string") || keys.length !== expected.length) return false;
  const sorted = [...expected].sort();
  return (keys as string[]).sort().every((key, index) => key === sorted[index]);
}

function fingerprint(stat: Stats): FileFingerprintV2 {
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

function sameFingerprint(left: FileFingerprintV2, right: FileFingerprintV2): boolean {
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

function defensiveReceiptCopy(
  receipt: NodeToolchainDistributionVerificationReceiptV2,
): NodeToolchainDistributionVerificationReceiptV2 {
  return deepFreezeJson(structuredClone(receipt));
}

function authenticState(
  handle: VerifiedNodeToolchainDistributionArchiveV2,
): PrivateArchiveStateV2 {
  if (
    typeof handle !== "object"
    || handle === null
    || isProxy(handle)
    || Object.getPrototypeOf(handle) !== VerifiedNodeToolchainDistributionArchiveV2.prototype
  ) {
    return fail(
      "NODE_TOOLCHAIN_DISTRIBUTION_V2_HANDLE_UNAUTHENTICATED",
      "Node distribution operation requires one authentic archive handle",
    );
  }
  if (disposedHandlesV2.has(handle)) {
    return fail(
      "NODE_TOOLCHAIN_DISTRIBUTION_V2_HANDLE_DISPOSED",
      "Verified Node distribution archive has already been disposed",
    );
  }
  const state = privateArchiveStateV2.get(handle);
  if (!state) {
    return fail(
      "NODE_TOOLCHAIN_DISTRIBUTION_V2_HANDLE_UNAUTHENTICATED",
      "Node distribution operation requires one authentic archive handle",
    );
  }
  return state;
}

function closeQuietly(descriptor: number | undefined): void {
  if (descriptor === undefined) return;
  try {
    closeSync(descriptor);
  } catch {
    // The primary typed failure remains authoritative.
  }
}

function cleanupPrivateRoot(privateRoot: string, privateArchivePath: string): void {
  try {
    const names = readdirSync(privateRoot);
    if (names.length > 1 || (names.length === 1 && names[0] !== path.basename(privateArchivePath))) {
      return fail(
        "NODE_TOOLCHAIN_DISTRIBUTION_V2_CLEANUP_FAILED",
        "Private distribution root contains an unowned entry",
      );
    }
    if (names.length === 1) unlinkSync(privateArchivePath);
    rmdirSync(privateRoot);
  } catch (error) {
    if (error instanceof NodeToolchainDistributionAuthorityErrorV2) throw error;
    return fail(
      "NODE_TOOLCHAIN_DISTRIBUTION_V2_CLEANUP_FAILED",
      "Private distribution root could not be removed exactly",
      error,
    );
  }
}

function buildReceipt(input: Readonly<{
  admissionScope: "production_distribution" | "test_fixture";
  manifestHash: string;
  artifact: NodeToolchainDistributionArtifactV2;
}>): NodeToolchainDistributionVerificationReceiptV2 {
  const identity: NodeToolchainDistributionVerificationReceiptHashPayloadV2 = {
    schema: NODE_TOOLCHAIN_DISTRIBUTION_VERIFICATION_RECEIPT_V2_SCHEMA,
    receiptVersion: NODE_TOOLCHAIN_DISTRIBUTION_VERSION_V2,
    status: "verified",
    admissionScope: input.admissionScope,
    verifier: {
      contractRef: "NODE_TOOLCHAIN_DISTRIBUTION_ARCHIVE_VERIFIER_V2",
      contractVersion: NODE_TOOLCHAIN_DISTRIBUTION_VERSION_V2,
      sourceReadPolicy: "open_no_follow_single_link_stable_v2",
      privateCopyPolicy: "exclusive_0600_fsync_rehash_v2",
    },
    manifest: {
      schema: NODE_TOOLCHAIN_DISTRIBUTION_MANIFEST_V2_SCHEMA,
      manifestHash: input.manifestHash,
    },
    artifact: input.artifact,
    archive: {
      archiveFormat: input.artifact.archiveFormat,
      byteLength: input.artifact.byteLength,
      sha256: input.artifact.sha256,
    },
  };
  const parsed = NodeToolchainDistributionVerificationReceiptV2Schema.safeParse({
    ...identity,
    receiptHash: hashNodeToolchainDistributionVerificationReceiptV2(identity),
  });
  if (!parsed.success) {
    return fail(
      "NODE_TOOLCHAIN_DISTRIBUTION_V2_RECEIPT_INVALID",
      "Fresh Node distribution receipt failed its canonical schema",
      parsed.error,
    );
  }
  return deepFreezeJson(parsed.data);
}

async function copyAndVerifyArchive(input: Readonly<{
  archivePath: string;
  artifact: NodeToolchainDistributionArtifactV2;
  testHooks?: TestHooksV2;
}>): Promise<Readonly<{
  privateRoot: string;
  privateRootFingerprint: FileFingerprintV2;
  privateArchivePath: string;
  privateArchiveFingerprint: FileFingerprintV2;
}>> {
  const sourcePath = path.resolve(input.archivePath);
  let sourceDescriptor: number | undefined;
  let privateDescriptor: number | undefined;
  let privateRoot: string | undefined;
  let privateArchivePath: string | undefined;
  let completed = false;
  try {
    const sourcePathBefore = lstatSync(sourcePath);
    if (sourcePathBefore.isSymbolicLink() || !sourcePathBefore.isFile() || sourcePathBefore.nlink !== 1) {
      return fail(
        "NODE_TOOLCHAIN_DISTRIBUTION_V2_SOURCE_INVALID",
        "Distribution source must be one direct single-link regular file",
      );
    }
    if (sourcePathBefore.size !== input.artifact.byteLength) {
      return fail(
        "NODE_TOOLCHAIN_DISTRIBUTION_V2_LENGTH_MISMATCH",
        "Distribution source length differs from the code-owned artifact",
      );
    }
    sourceDescriptor = openSync(
      sourcePath,
      constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK,
    );
    const sourceBefore = fstatSync(sourceDescriptor);
    if (!sameFingerprint(fingerprint(sourcePathBefore), fingerprint(sourceBefore))) {
      return fail(
        "NODE_TOOLCHAIN_DISTRIBUTION_V2_SOURCE_CHANGED",
        "Distribution source changed before its exact read",
      );
    }

    privateRoot = mkdtempSync("/private/tmp/setfarm-node-toolchain-distribution-v2-");
    chmodSync(privateRoot, 0o700);
    privateArchivePath = path.join(privateRoot, "archive.tar.xz");
    privateDescriptor = openSync(
      privateArchivePath,
      constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW,
      0o600,
    );

    const hash = createHash("sha256");
    const buffer = Buffer.allocUnsafe(256 * 1024);
    let byteLength = 0;
    while (true) {
      const bytesRead = readSync(sourceDescriptor, buffer, 0, buffer.length, null);
      if (bytesRead === 0) break;
      byteLength += bytesRead;
      if (byteLength > input.artifact.byteLength) {
        return fail(
          "NODE_TOOLCHAIN_DISTRIBUTION_V2_LENGTH_MISMATCH",
          "Distribution source exceeded its exact length during read",
        );
      }
      hash.update(buffer.subarray(0, bytesRead));
      let offset = 0;
      while (offset < bytesRead) {
        const written = writeSync(privateDescriptor, buffer, offset, bytesRead - offset);
        if (written < 1) {
          return fail(
            "NODE_TOOLCHAIN_DISTRIBUTION_V2_PRIVATE_COPY_MISMATCH",
            "Private distribution copy made no forward progress",
          );
        }
        offset += written;
      }
    }
    await input.testHooks?.afterSourceCopy?.();
    const sourceAfter = fstatSync(sourceDescriptor);
    const sourcePathAfter = lstatSync(sourcePath);
    if (
      !sameFingerprint(fingerprint(sourceBefore), fingerprint(sourceAfter))
      || !sameFingerprint(fingerprint(sourceAfter), fingerprint(sourcePathAfter))
    ) {
      return fail(
        "NODE_TOOLCHAIN_DISTRIBUTION_V2_SOURCE_CHANGED",
        "Distribution source changed while its private copy was created",
      );
    }
    if (byteLength !== input.artifact.byteLength) {
      return fail(
        "NODE_TOOLCHAIN_DISTRIBUTION_V2_LENGTH_MISMATCH",
        "Distribution source read length differs from the code-owned artifact",
      );
    }
    if (hash.digest("hex") !== input.artifact.sha256) {
      return fail(
        "NODE_TOOLCHAIN_DISTRIBUTION_V2_DIGEST_MISMATCH",
        "Distribution source digest differs from the code-owned artifact",
      );
    }
    fsyncSync(privateDescriptor);
    closeSync(privateDescriptor);
    privateDescriptor = undefined;
    const rootDescriptor = openSync(privateRoot, constants.O_RDONLY);
    try {
      fsyncSync(rootDescriptor);
    } finally {
      closeSync(rootDescriptor);
    }
    await input.testHooks?.afterPrivateSync?.({ privateArchivePath });

    const verified = hashPrivateArchive(privateArchivePath, input.artifact);
    const result = Object.freeze({
      privateRoot,
      privateRootFingerprint: fingerprint(lstatSync(privateRoot)),
      privateArchivePath,
      privateArchiveFingerprint: verified.fingerprint,
    });
    completed = true;
    return result;
  } catch (error) {
    if (error instanceof NodeToolchainDistributionAuthorityErrorV2) throw error;
    return fail(
      "NODE_TOOLCHAIN_DISTRIBUTION_V2_SOURCE_INVALID",
      "Distribution source could not be copied exactly",
      error,
    );
  } finally {
    closeQuietly(sourceDescriptor);
    closeQuietly(privateDescriptor);
    if (!completed && privateRoot && privateArchivePath) {
      try {
        cleanupPrivateRoot(privateRoot, privateArchivePath);
      } catch {
        // The primary verification error remains authoritative.
      }
    }
  }
}

function hashPrivateArchive(
  privateArchivePath: string,
  artifact: NodeToolchainDistributionArtifactV2,
): Readonly<{ fingerprint: FileFingerprintV2 }> {
  let descriptor: number | undefined;
  try {
    const pathBefore = lstatSync(privateArchivePath);
    if (
      pathBefore.isSymbolicLink()
      || !pathBefore.isFile()
      || pathBefore.nlink !== 1
      || (pathBefore.mode & 0o7777) !== 0o600
      || pathBefore.size !== artifact.byteLength
    ) {
      return fail(
        "NODE_TOOLCHAIN_DISTRIBUTION_V2_PRIVATE_COPY_MISMATCH",
        "Private distribution copy lost its exact file identity",
      );
    }
    descriptor = openSync(
      privateArchivePath,
      constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK,
    );
    const before = fstatSync(descriptor);
    if (!sameFingerprint(fingerprint(pathBefore), fingerprint(before))) {
      return fail(
        "NODE_TOOLCHAIN_DISTRIBUTION_V2_PRIVATE_COPY_MISMATCH",
        "Private distribution copy changed before rehash",
      );
    }
    const hash = createHash("sha256");
    const buffer = Buffer.allocUnsafe(256 * 1024);
    let byteLength = 0;
    while (true) {
      const bytesRead = readSync(descriptor, buffer, 0, buffer.length, null);
      if (bytesRead === 0) break;
      byteLength += bytesRead;
      if (byteLength > artifact.byteLength) {
        return fail(
          "NODE_TOOLCHAIN_DISTRIBUTION_V2_PRIVATE_COPY_MISMATCH",
          "Private distribution copy exceeded its exact length",
        );
      }
      hash.update(buffer.subarray(0, bytesRead));
    }
    const after = fstatSync(descriptor);
    const pathAfter = lstatSync(privateArchivePath);
    if (
      !sameFingerprint(fingerprint(before), fingerprint(after))
      || !sameFingerprint(fingerprint(after), fingerprint(pathAfter))
      || byteLength !== artifact.byteLength
      || hash.digest("hex") !== artifact.sha256
    ) {
      return fail(
        "NODE_TOOLCHAIN_DISTRIBUTION_V2_PRIVATE_COPY_MISMATCH",
        "Private distribution copy bytes or identity differ from the verified artifact",
      );
    }
    return Object.freeze({ fingerprint: fingerprint(after) });
  } catch (error) {
    if (error instanceof NodeToolchainDistributionAuthorityErrorV2) throw error;
    return fail(
      "NODE_TOOLCHAIN_DISTRIBUTION_V2_PRIVATE_COPY_MISMATCH",
      "Private distribution copy could not be rehashed",
      error,
    );
  } finally {
    closeQuietly(descriptor);
  }
}

async function verify(input: Readonly<{
  admissionScope: "production_distribution" | "test_fixture";
  archivePath: string;
  artifact: NodeToolchainDistributionArtifactV2;
  manifestHash: string;
  testHooks?: TestHooksV2;
}>): Promise<VerifiedNodeToolchainDistributionArchiveV2> {
  const copied = await copyAndVerifyArchive({
    archivePath: input.archivePath,
    artifact: input.artifact,
    ...(input.testHooks ? { testHooks: input.testHooks } : {}),
  });
  try {
    const receipt = buildReceipt(input);
    const state: PrivateArchiveStateV2 = Object.freeze({ ...copied, receipt });
    return new VerifiedNodeToolchainDistributionArchiveV2(handleConstructorCapabilityV2, state);
  } catch (error) {
    cleanupPrivateRoot(copied.privateRoot, copied.privateArchivePath);
    throw error;
  }
}

function parseProductionInput(input: unknown): Readonly<{
  architecture: "arm64" | "x64";
  archivePath: string;
}> {
  if (!isPlainRecord(input) || !exactKeys(input, ["architecture", "archivePath"])) {
    return fail(
      "NODE_TOOLCHAIN_DISTRIBUTION_V2_INPUT_INVALID",
      "Production distribution verification input must contain exactly architecture and archivePath",
    );
  }
  if (
    (input.architecture !== "arm64" && input.architecture !== "x64")
    || typeof input.archivePath !== "string"
    || input.archivePath.length < 1
    || input.archivePath.length > 4_096
    || input.archivePath.includes("\0")
  ) {
    return fail(
      "NODE_TOOLCHAIN_DISTRIBUTION_V2_INPUT_INVALID",
      "Production distribution architecture or candidate path is invalid",
    );
  }
  return Object.freeze({ architecture: input.architecture, archivePath: input.archivePath });
}

export async function verifyNodeToolchainDistributionArchiveV2(input: unknown):
Promise<VerifiedNodeToolchainDistributionArchiveV2> {
  const parsed = parseProductionInput(input);
  const manifest = getCodeOwnedNodeToolchainDistributionManifestV2();
  const artifact = getCodeOwnedNodeToolchainDistributionArtifactV2(parsed.architecture);
  return verify({
    admissionScope: "production_distribution",
    archivePath: parsed.archivePath,
    artifact,
    manifestHash: manifest.manifestHash,
  });
}

export type VerifyNodeToolchainDistributionArchiveV2TestInput = Readonly<{
  archivePath: string;
  artifact: NodeToolchainDistributionArtifactV2;
  manifestHash: string;
  testHooks?: TestHooksV2;
}>;

export async function verifyNodeToolchainDistributionArchiveV2ForTest(
  input: VerifyNodeToolchainDistributionArchiveV2TestInput,
): Promise<VerifiedNodeToolchainDistributionArchiveV2> {
  const artifact = NodeToolchainDistributionArtifactV2Schema.safeParse(input.artifact);
  if (
    !artifact.success
    || artifact.data.sourceAuthority !== "test_fixture"
    || !/^[a-f0-9]{64}$/.test(input.manifestHash)
  ) {
    return fail(
      "NODE_TOOLCHAIN_DISTRIBUTION_V2_INPUT_INVALID",
      "Test distribution verification requires one exact test artifact and manifest hash",
      artifact.success ? undefined : artifact.error,
    );
  }
  return verify({
    admissionScope: "test_fixture",
    archivePath: input.archivePath,
    artifact: artifact.data,
    manifestHash: input.manifestHash,
    ...(input.testHooks ? { testHooks: input.testHooks } : {}),
  });
}

export function inspectNodeToolchainDistributionVerificationReceiptV2(
  handle: VerifiedNodeToolchainDistributionArchiveV2,
): NodeToolchainDistributionVerificationReceiptV2 {
  return defensiveReceiptCopy(authenticState(handle).receipt);
}

export async function revalidateVerifiedNodeToolchainDistributionArchiveV2(
  handle: VerifiedNodeToolchainDistributionArchiveV2,
): Promise<NodeToolchainDistributionVerificationReceiptV2> {
  const state = authenticState(handle);
  try {
    const root = fingerprint(lstatSync(state.privateRoot));
    if (
      !sameFingerprint(root, state.privateRootFingerprint)
      || (root.mode & 0o7777) !== 0o700
      || readdirSync(state.privateRoot).length !== 1
      || readdirSync(state.privateRoot)[0] !== path.basename(state.privateArchivePath)
    ) {
      return fail(
        "NODE_TOOLCHAIN_DISTRIBUTION_V2_PRIVATE_COPY_MISMATCH",
        "Private distribution root changed after verification",
      );
    }
    const artifact = state.receipt.artifact;
    const fresh = hashPrivateArchive(state.privateArchivePath, artifact);
    if (!sameFingerprint(fresh.fingerprint, state.privateArchiveFingerprint)) {
      return fail(
        "NODE_TOOLCHAIN_DISTRIBUTION_V2_PRIVATE_COPY_MISMATCH",
        "Private distribution archive identity changed after verification",
      );
    }
    return defensiveReceiptCopy(state.receipt);
  } catch (error) {
    if (error instanceof NodeToolchainDistributionAuthorityErrorV2) throw error;
    return fail(
      "NODE_TOOLCHAIN_DISTRIBUTION_V2_PRIVATE_COPY_MISMATCH",
      "Private distribution authority could not be reproduced",
      error,
    );
  }
}

function unpooledBuffer(length: number): Buffer {
  return Buffer.allocUnsafeSlow(length);
}

/**
 * Returns a defensive bounded byte copy only after fresh private-copy
 * reproduction. Paths and descriptors remain module-private.
 */
export async function copyVerifiedNodeToolchainDistributionArchiveBytesV2(
  handle: VerifiedNodeToolchainDistributionArchiveV2,
): Promise<Buffer> {
  const state = authenticState(handle);
  await revalidateVerifiedNodeToolchainDistributionArchiveV2(handle);
  let descriptor: number | undefined;
  try {
    descriptor = openSync(
      state.privateArchivePath,
      constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK,
    );
    const before = fstatSync(descriptor);
    if (!sameFingerprint(fingerprint(before), state.privateArchiveFingerprint)) {
      return fail(
        "NODE_TOOLCHAIN_DISTRIBUTION_V2_PRIVATE_COPY_MISMATCH",
        "Private distribution archive changed before defensive copy",
      );
    }
    const output = unpooledBuffer(state.receipt.archive.byteLength);
    let offset = 0;
    while (offset < output.byteLength) {
      const bytesRead = readSync(
        descriptor,
        output,
        offset,
        output.byteLength - offset,
        null,
      );
      if (bytesRead < 1) {
        return fail(
          "NODE_TOOLCHAIN_DISTRIBUTION_V2_PRIVATE_COPY_MISMATCH",
          "Private distribution archive ended before its exact byte length",
        );
      }
      offset += bytesRead;
    }
    const eof = Buffer.allocUnsafe(1);
    if (readSync(descriptor, eof, 0, 1, null) !== 0) {
      return fail(
        "NODE_TOOLCHAIN_DISTRIBUTION_V2_PRIVATE_COPY_MISMATCH",
        "Private distribution archive exceeded its exact byte length",
      );
    }
    const after = fstatSync(descriptor);
    if (!sameFingerprint(fingerprint(before), fingerprint(after))) {
      return fail(
        "NODE_TOOLCHAIN_DISTRIBUTION_V2_PRIVATE_COPY_MISMATCH",
        "Private distribution archive changed during defensive copy",
      );
    }
    return output;
  } catch (error) {
    if (error instanceof NodeToolchainDistributionAuthorityErrorV2) throw error;
    return fail(
      "NODE_TOOLCHAIN_DISTRIBUTION_V2_PRIVATE_COPY_MISMATCH",
      "Private distribution archive could not be copied defensively",
      error,
    );
  } finally {
    closeQuietly(descriptor);
  }
}

export async function disposeVerifiedNodeToolchainDistributionArchiveV2(
  handle: VerifiedNodeToolchainDistributionArchiveV2,
): Promise<void> {
  if (
    typeof handle !== "object"
    || handle === null
    || isProxy(handle)
    || Object.getPrototypeOf(handle) !== VerifiedNodeToolchainDistributionArchiveV2.prototype
  ) {
    return fail(
      "NODE_TOOLCHAIN_DISTRIBUTION_V2_HANDLE_UNAUTHENTICATED",
      "Distribution disposal requires one authentic archive handle",
    );
  }
  if (disposedHandlesV2.has(handle)) return;
  const state = privateArchiveStateV2.get(handle);
  if (!state) {
    return fail(
      "NODE_TOOLCHAIN_DISTRIBUTION_V2_HANDLE_UNAUTHENTICATED",
      "Distribution disposal requires one authentic archive handle",
    );
  }
  await revalidateVerifiedNodeToolchainDistributionArchiveV2(handle);
  cleanupPrivateRoot(state.privateRoot, state.privateArchivePath);
  privateArchiveStateV2.delete(handle);
  disposedHandlesV2.add(handle);
}
