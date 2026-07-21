import { createHash, randomUUID } from "node:crypto";
import { constants, type Stats } from "node:fs";
import {
  lstat,
  link,
  mkdir,
  open,
  opendir,
  realpath,
  rmdir,
  stat,
  unlink,
} from "node:fs/promises";
import path from "node:path";

import {
  CanonicalJsonLimitError,
  DEFAULT_CANONICAL_JSON_BOUNDED_WORK_LIMITS,
  canonicalJsonBytesBounded,
} from "./bounded-canonical-json.js";
import { Sha256Schema } from "./schemas/common-v1.js";
import {
  SemanticArtifactEnvelopeV1Schema,
  type SemanticArtifactEnvelopeV1,
} from "./artifact-envelope.js";
import {
  ArtifactCapacityError,
  DEFAULT_ARTIFACT_CAPACITY_LIMITS,
  assessArtifactBatchCapacity,
  assessArtifactCapacity,
  measureArtifactCapacity,
  normalizeArtifactCapacityLimits,
  throwForArtifactCapacity,
  type ArtifactCapacityLimits,
  type ArtifactCapacitySnapshot,
} from "./artifact-capacity.js";
import {
  ARTIFACT_STORE_STAGING_DIRECTORY_V1,
  isHybridArtifactStoreCapacityLeaseProviderV1,
  type ArtifactStoreCapacityLeaseProvider,
} from "./artifact-store-authority.js";
import {
  ARTIFACT_STORE_BATCH_PLAN_SCHEMA_V1,
  ARTIFACT_STORE_BATCH_PUT_RESULT_SCHEMA_V1,
  copyPreparedArtifactStoreBatchCanonicalItemsV1,
  prepareArtifactStoreBatchPlanV1,
  type ArtifactStoreBatchPutResultV1,
  type PreparedArtifactStoreBatchCanonicalItemV1,
  type PreparedArtifactStoreBatchV1,
} from "./artifact-store-batch-plan.js";

export { ArtifactCapacityError } from "./artifact-capacity.js";
export {
  SemanticArtifactEnvelopeV1Schema,
  type SemanticArtifactEnvelopeV1,
} from "./artifact-envelope.js";

export type ArtifactStoreErrorCode =
  | "ARTIFACT_INVALID_HASH"
  | "ARTIFACT_NOT_FOUND"
  | "ARTIFACT_UNSAFE_FILE_TYPE"
  | "ARTIFACT_ROOT_CHANGED_DURING_OPERATION"
  | "ARTIFACT_FILE_CHANGED_DURING_READ"
  | "ARTIFACT_BOUNDED_READ_EXCEEDED"
  | "ARTIFACT_INVALID_ENVELOPE"
  | "ARTIFACT_HASH_COLLISION_OR_CORRUPTION"
  | "ARTIFACT_NON_CANONICAL_BYTES";

export class ArtifactStoreError extends Error {
  readonly code: ArtifactStoreErrorCode;
  readonly artifactHash?: string;
  override readonly cause?: unknown;

  constructor(
    code: ArtifactStoreErrorCode,
    message: string,
    options: { artifactHash?: string; cause?: unknown } = {},
  ) {
    super(message);
    this.name = "ArtifactStoreError";
    this.code = code;
    this.artifactHash = options.artifactHash;
    this.cause = options.cause;
  }
}

export type ArtifactPutResult = Readonly<{
  hash: string;
  path: string;
  created: boolean;
}>;

export type ArtifactGetResult = Readonly<{
  hash: string;
  path: string;
  envelope: SemanticArtifactEnvelopeV1;
  bytes: Buffer;
}>;

type ArtifactStoreReadTestHooks = Readonly<{
  /** Deterministic mutation seam; it cannot bypass any post-read verification. */
  afterArtifactRead?: (context: Readonly<{
    target: string;
    artifactHash: string;
    byteLength: number;
  }>) => void | Promise<void>;
  /** Runs inside the held capacity lease and before its post-measure fence. */
  afterCapacityMeasure?: (context: Readonly<{
    artifactHash: string;
    rootBytes: number;
    freeBytes: number;
  }>) => void | Promise<void>;
  /** Runs after no-replace link and before directory sync/post-link fences. */
  afterArtifactLink?: (context: Readonly<{
    artifactHash: string;
    target: string;
    temp: string;
  }>) => void | Promise<void>;
  /** Runs after every temp is exact/file-synced and before the first final link. */
  afterBatchStaging?: (context: Readonly<{
    planIdentityHash: string;
    attemptPath: string;
    items: readonly Readonly<{
      durabilityTier: number;
      artifactHash: string;
      temp: string;
    }>[];
  }>) => void | Promise<void>;
  /** Runs after one no-replace link/EEXIST convergence and before its tier barrier. */
  afterBatchArtifactLink?: (context: Readonly<{
    planIdentityHash: string;
    durabilityTier: number;
    artifactHash: string;
    target: string;
    temp: string;
    created: boolean;
  }>) => void | Promise<void>;
  /** Runs only after the exact tier root-directory sync has completed. */
  afterBatchTierSync?: (context: Readonly<{
    planIdentityHash: string;
    durabilityTier: number;
  }>) => void | Promise<void>;
  /** Runs before the mandatory fresh verification of every final target. */
  beforeBatchFinalVerification?: (context: Readonly<{
    planIdentityHash: string;
  }>) => void | Promise<void>;
}>;

type ArtifactRootIdentity = Readonly<{
  dev: number;
  ino: number;
}>;

type BatchDirectoryIdentity = Readonly<ArtifactRootIdentity & {
  mode: number;
  uid: number;
}>;

type BatchFileIdentity = Readonly<ArtifactRootIdentity & {
  size: number;
  mtimeMs: number;
  ctimeMs: number;
  mode: number;
  uid: number;
  nlink: number;
}>;

type StagedBatchItem = Readonly<{
  item: PreparedArtifactStoreBatchCanonicalItemV1;
  publicPath: string;
  authorityPath: string;
  tempPath: string;
  identity: BatchFileIdentity;
}>;

const hybridAuthorityBackedStores = new WeakSet<object>();

/**
 * Runtime capability check. Only this module can brand the exact concrete
 * store instance after it accepts a trusted hybrid provider.
 */
export function isHybridAuthorityBackedArtifactStore(
  value: unknown,
): value is ContentAddressedArtifactStore {
  return typeof value === "object"
    && value !== null
    && hybridAuthorityBackedStores.has(value)
    && Object.getPrototypeOf(value) === ContentAddressedArtifactStore.prototype
    && !Object.prototype.hasOwnProperty.call(value, "put")
    && !Object.prototype.hasOwnProperty.call(value, "get")
    && !Object.prototype.hasOwnProperty.call(value, "putPreparedBatch");
}

function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function isNodeError(error: unknown, code: string): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error && error.code === code;
}

function fileIdentity(value: Pick<Stats, "dev" | "ino">): ArtifactRootIdentity {
  return { dev: value.dev, ino: value.ino };
}

function sameFileIdentity(
  left: Pick<Stats, "dev" | "ino">,
  right: Pick<Stats, "dev" | "ino">,
): boolean {
  return left.dev === right.dev && left.ino === right.ino;
}

async function unlinkIfSameFile(
  target: string,
  expected: Pick<Stats, "dev" | "ino"> | undefined,
): Promise<void> {
  if (!expected) return;
  try {
    const current = await lstat(target);
    if (sameFileIdentity(current, expected)) await unlink(target);
  } catch (error) {
    if (!isNodeError(error, "ENOENT")) throw error;
  }
}

function boundedCanonicalJsonBytes(value: unknown, maxBytes: number): Buffer {
  return canonicalJsonBytesBounded(value, {
    maxBytes,
    ...DEFAULT_CANONICAL_JSON_BOUNDED_WORK_LIMITS,
  });
}

function boundedCanonicalJsonBytesForPut(value: unknown, maxBytes: number): Buffer {
  try {
    return boundedCanonicalJsonBytes(value, maxBytes);
  } catch (error) {
    if (error instanceof CanonicalJsonLimitError) {
      throw new ArtifactCapacityError(
        "ARTIFACT_PAYLOAD_TOO_LARGE",
        `Artifact canonicalization exceeded its bounded payload authority: ${error.code}`,
      );
    }
    throw error;
  }
}

async function syncDirectory(directory: string): Promise<void> {
  let handle;
  try {
    handle = await open(
      directory,
      constants.O_RDONLY
        | constants.O_DIRECTORY
        | constants.O_NOFOLLOW
        | constants.O_NONBLOCK,
    );
    await handle.sync();
  } finally {
    await handle?.close();
  }
}

function currentUid(): number | undefined {
  return typeof process.getuid === "function" ? process.getuid() : undefined;
}

function batchDirectoryIdentity(stats: Stats): BatchDirectoryIdentity {
  return Object.freeze({
    dev: stats.dev,
    ino: stats.ino,
    mode: stats.mode & 0o7777,
    uid: stats.uid,
  });
}

function batchFileIdentity(stats: Stats): BatchFileIdentity {
  return Object.freeze({
    dev: stats.dev,
    ino: stats.ino,
    size: stats.size,
    mtimeMs: stats.mtimeMs,
    ctimeMs: stats.ctimeMs,
    mode: stats.mode & 0o7777,
    uid: stats.uid,
    nlink: stats.nlink,
  });
}

function sameBatchDirectoryIdentity(
  left: BatchDirectoryIdentity,
  right: BatchDirectoryIdentity,
): boolean {
  return sameFileIdentity(left, right)
    && left.mode === right.mode
    && left.uid === right.uid;
}

function sameBatchFileIdentity(
  left: BatchFileIdentity,
  right: BatchFileIdentity,
): boolean {
  return sameFileIdentity(left, right)
    && left.size === right.size
    && left.mtimeMs === right.mtimeMs
    && left.ctimeMs === right.ctimeMs
    && left.mode === right.mode
    && left.uid === right.uid
    && left.nlink === right.nlink;
}

function assertPrivateBatchDirectory(
  stats: Stats,
  label: string,
  artifactHash: string,
): void {
  if (
    !stats.isDirectory()
    || stats.isSymbolicLink()
    || (stats.mode & 0o7777) !== 0o700
    || (currentUid() !== undefined && stats.uid !== currentUid())
  ) {
    throw new ArtifactStoreError(
      "ARTIFACT_UNSAFE_FILE_TYPE",
      `${label} must be one private owner-controlled ordinary directory`,
      { artifactHash },
    );
  }
}

function assertPrivateBatchFile(
  stats: Stats,
  label: string,
  artifactHash: string,
  allowedLinks: readonly number[],
): void {
  if (
    !stats.isFile()
    || stats.isSymbolicLink()
    || !allowedLinks.includes(stats.nlink)
    || (stats.mode & 0o7777) !== 0o600
    || (currentUid() !== undefined && stats.uid !== currentUid())
  ) {
    throw new ArtifactStoreError(
      "ARTIFACT_UNSAFE_FILE_TYPE",
      `${label} must have one exact private ordinary-file link topology`,
      { artifactHash },
    );
  }
}

async function openBatchDirectory(
  target: string,
  expected: BatchDirectoryIdentity,
  label: string,
  artifactHash: string,
) {
  let handle;
  try {
    handle = await open(
      target,
      constants.O_RDONLY
        | constants.O_DIRECTORY
        | constants.O_NOFOLLOW
        | constants.O_NONBLOCK,
    );
    const observed = await handle.stat();
    assertPrivateBatchDirectory(observed, label, artifactHash);
    if (!sameBatchDirectoryIdentity(batchDirectoryIdentity(observed), expected)) {
      throw new ArtifactStoreError(
        "ARTIFACT_ROOT_CHANGED_DURING_OPERATION",
        `${label} changed before its directory handle was acquired`,
        { artifactHash },
      );
    }
    return handle;
  } catch (error) {
    await handle?.close();
    throw error;
  }
}

async function assertBatchDirectoryCurrent(
  target: string,
  expected: BatchDirectoryIdentity,
  label: string,
  artifactHash: string,
): Promise<void> {
  let observed: Stats;
  try {
    observed = await lstat(target);
  } catch (error) {
    throw new ArtifactStoreError(
      "ARTIFACT_ROOT_CHANGED_DURING_OPERATION",
      `${label} disappeared during batch publication`,
      { artifactHash, cause: error },
    );
  }
  assertPrivateBatchDirectory(observed, label, artifactHash);
  if (!sameBatchDirectoryIdentity(batchDirectoryIdentity(observed), expected)) {
    throw new ArtifactStoreError(
      "ARTIFACT_ROOT_CHANGED_DURING_OPERATION",
      `${label} changed during batch publication`,
      { artifactHash },
    );
  }
}

async function assertBatchDirectoryEmpty(
  target: string,
  label: string,
  artifactHash: string,
): Promise<void> {
  let directory;
  try {
    directory = await opendir(target, { bufferSize: 1 });
    const entry = await directory.read();
    if (entry) {
      throw new ArtifactStoreError(
        "ARTIFACT_ROOT_CHANGED_DURING_OPERATION",
        `${label} is not empty before owned batch publication`,
        { artifactHash },
      );
    }
  } finally {
    await directory?.close();
  }
}

async function readExactStagedBytes(
  target: string,
  expectedBytes: Buffer,
  artifactHash: string,
  expectedIdentity?: BatchFileIdentity,
): Promise<BatchFileIdentity> {
  let handle;
  try {
    const pathBefore = await lstat(target);
    assertPrivateBatchFile(pathBefore, "Artifact batch temp", artifactHash, [1]);
    if (
      !Number.isSafeInteger(pathBefore.size)
      || pathBefore.size !== expectedBytes.length
    ) {
      throw new ArtifactStoreError(
        "ARTIFACT_FILE_CHANGED_DURING_READ",
        `Artifact batch temp ${artifactHash} has an unexpected byte length`,
        { artifactHash },
      );
    }
    const identityBefore = batchFileIdentity(pathBefore);
    if (expectedIdentity && !sameBatchFileIdentity(identityBefore, expectedIdentity)) {
      throw new ArtifactStoreError(
        "ARTIFACT_FILE_CHANGED_DURING_READ",
        `Artifact batch temp ${artifactHash} changed before publication`,
        { artifactHash },
      );
    }
    handle = await open(
      target,
      constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK,
    );
    const before = await handle.stat();
    assertPrivateBatchFile(before, "Held artifact batch temp", artifactHash, [1]);
    if (!sameBatchFileIdentity(batchFileIdentity(before), identityBefore)) {
      throw new ArtifactStoreError(
        "ARTIFACT_FILE_CHANGED_DURING_READ",
        `Artifact batch temp ${artifactHash} changed before its exact read`,
        { artifactHash },
      );
    }
    const bytes = Buffer.allocUnsafe(before.size);
    let offset = 0;
    while (offset < bytes.length) {
      const read = await handle.read(bytes, offset, bytes.length - offset, offset);
      if (read.bytesRead === 0) break;
      offset += read.bytesRead;
    }
    const probe = Buffer.allocUnsafe(1);
    const beyond = await handle.read(probe, 0, 1, before.size);
    const after = await handle.stat();
    const pathAfter = await lstat(target);
    if (
      offset !== before.size
      || beyond.bytesRead !== 0
      || !sameBatchFileIdentity(batchFileIdentity(after), identityBefore)
      || !sameBatchFileIdentity(batchFileIdentity(pathAfter), identityBefore)
      || !bytes.equals(expectedBytes)
      || sha256(bytes) !== artifactHash
    ) {
      throw new ArtifactStoreError(
        "ARTIFACT_FILE_CHANGED_DURING_READ",
        `Artifact batch temp ${artifactHash} failed exact staged-byte verification`,
        { artifactHash },
      );
    }
    return identityBefore;
  } catch (error) {
    if (error instanceof ArtifactStoreError) throw error;
    throw new ArtifactStoreError(
      "ARTIFACT_FILE_CHANGED_DURING_READ",
      `Artifact batch temp ${artifactHash} could not be read safely`,
      { artifactHash, cause: error },
    );
  } finally {
    await handle?.close();
  }
}

export class ContentAddressedArtifactStore {
  readonly root: string;
  readonly limits: ArtifactCapacityLimits;
  private readonly measureOverride?: () => Promise<ArtifactCapacitySnapshot>;
  private readonly testHooks?: ArtifactStoreReadTestHooks;
  private readonly capacityLeaseProvider?: ArtifactStoreCapacityLeaseProvider;
  private rootIdentity?: ArtifactRootIdentity;
  private rootAuthorityPath?: string;

  constructor(
    root: string,
    options: Readonly<{
      limits?: ArtifactCapacityLimits;
      measure?: () => Promise<ArtifactCapacitySnapshot>;
      lockTimeoutMs?: number;
      testHooks?: ArtifactStoreReadTestHooks;
      capacityLeaseProvider?: ArtifactStoreCapacityLeaseProvider;
    }> = {},
  ) {
    if (!root.trim()) {
      throw new TypeError("Artifact store root must not be empty");
    }
    this.root = path.resolve(root);
    this.limits = normalizeArtifactCapacityLimits(
      options.limits ?? DEFAULT_ARTIFACT_CAPACITY_LIMITS,
    );
    this.measureOverride = options.measure;
    this.lockTimeoutMs = Math.max(1, Math.min(options.lockTimeoutMs ?? 5_000, 30_000));
    this.testHooks = options.testHooks;
    if (options.capacityLeaseProvider) {
      if (!isHybridArtifactStoreCapacityLeaseProviderV1(options.capacityLeaseProvider)) {
        throw new TypeError("Artifact store capacity provider is not a trusted hybrid authority");
      }
      if (path.resolve(options.capacityLeaseProvider.artifactRoot) !== this.root) {
        throw new TypeError("Artifact store capacity provider root does not match the store root");
      }
      this.capacityLeaseProvider = options.capacityLeaseProvider;
      hybridAuthorityBackedStores.add(this);
    }
  }

  private readonly lockTimeoutMs: number;

  private bindRootIdentity(root: Stats, artifactHash: string): ArtifactRootIdentity {
    if (!root.isDirectory()) {
      throw new ArtifactStoreError(
        "ARTIFACT_UNSAFE_FILE_TYPE",
        `Artifact root for ${artifactHash} is not a directory`,
        { artifactHash },
      );
    }
    const identity = fileIdentity(root);
    if (this.rootIdentity && !sameFileIdentity(this.rootIdentity, identity)) {
      throw new ArtifactStoreError(
        "ARTIFACT_ROOT_CHANGED_DURING_OPERATION",
        `Artifact root authority changed before operating on ${artifactHash}`,
        { artifactHash },
      );
    }
    this.rootIdentity ??= identity;
    return identity;
  }

  private async assertCurrentRoot(
    expected: ArtifactRootIdentity,
    artifactHash: string,
  ): Promise<void> {
    try {
      const current = await stat(this.root);
      if (!current.isDirectory() || !sameFileIdentity(current, expected)) {
        throw new ArtifactStoreError(
          "ARTIFACT_ROOT_CHANGED_DURING_OPERATION",
          `Artifact root changed while operating on ${artifactHash}`,
          { artifactHash },
        );
      }
      this.bindRootIdentity(current, artifactHash);
    } catch (error) {
      if (error instanceof ArtifactStoreError) throw error;
      if (
        isNodeError(error, "ENOENT")
        || isNodeError(error, "ENOTDIR")
        || isNodeError(error, "ELOOP")
      ) {
        throw new ArtifactStoreError(
          "ARTIFACT_ROOT_CHANGED_DURING_OPERATION",
          `Artifact root disappeared or became unsafe while operating on ${artifactHash}`,
          { artifactHash, cause: error },
        );
      }
      throw error;
    }
  }

  private async authorityPathForRoot(
    expected: ArtifactRootIdentity,
    artifactHash: string,
  ): Promise<string> {
    await this.assertCurrentRoot(expected, artifactHash);
    try {
      const authorityPath = this.rootAuthorityPath ?? await realpath(this.root);
      const authority = await stat(authorityPath);
      if (!authority.isDirectory() || !sameFileIdentity(authority, expected)) {
        throw new ArtifactStoreError(
          "ARTIFACT_ROOT_CHANGED_DURING_OPERATION",
          `Artifact root physical authority changed while operating on ${artifactHash}`,
          { artifactHash },
        );
      }
      this.rootAuthorityPath ??= authorityPath;
      return this.rootAuthorityPath;
    } catch (error) {
      if (error instanceof ArtifactStoreError) throw error;
      if (
        isNodeError(error, "ENOENT")
        || isNodeError(error, "ENOTDIR")
        || isNodeError(error, "ELOOP")
      ) {
        throw new ArtifactStoreError(
          "ARTIFACT_ROOT_CHANGED_DURING_OPERATION",
          `Artifact root physical authority disappeared for ${artifactHash}`,
          { artifactHash, cause: error },
        );
      }
      throw error;
    }
  }

  private async withCapacityLock<T>(
    artifactHash: string,
    work: (lease: Readonly<{
      authorityPath: string;
      assertCurrent: () => Promise<void>;
    }>) => Promise<T>,
  ): Promise<T> {
    if (this.capacityLeaseProvider) {
      return this.capacityLeaseProvider.withLease(async (providerLease) => {
        const rootHandle = await open(
          this.root,
          constants.O_RDONLY
            | constants.O_DIRECTORY
            | constants.O_NOFOLLOW
            | constants.O_NONBLOCK,
        );
        try {
          await providerLease.assertCurrent();
          const rootBefore = await rootHandle.stat();
          const rootIdentity = this.bindRootIdentity(rootBefore, artifactHash);
          const authorityPath = await this.authorityPathForRoot(rootIdentity, artifactHash);
          const lease = Object.freeze({
            authorityPath,
            assertCurrent: async () => {
              await providerLease.assertCurrent();
              await this.authorityPathForRoot(rootIdentity, artifactHash);
            },
          });
          await lease.assertCurrent();
          return await work(lease);
        } finally {
          await rootHandle.close();
        }
      });
    }
    const lockPath = path.join(this.root, ".capacity.lock");
    const token = randomUUID();
    const deadline = Date.now() + this.lockTimeoutMs;
    const rootHandle = await open(
      this.root,
      constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NONBLOCK,
    );
    let handle;
    let lockIdentity: Stats | undefined;
    try {
      const rootBefore = await rootHandle.stat();
      const rootIdentity = this.bindRootIdentity(rootBefore, artifactHash);
      const authorityPath = await this.authorityPathForRoot(rootIdentity, artifactHash);
      while (!handle) {
        try {
          await this.assertCurrentRoot(rootIdentity, artifactHash);
          handle = await open(lockPath, "wx", 0o600);
          await handle.writeFile(token, "utf8");
          await handle.sync();
          lockIdentity = await handle.stat();
          await this.assertCurrentRoot(rootIdentity, artifactHash);
          const currentLock = await lstat(lockPath);
          if (!currentLock.isFile() || !sameFileIdentity(currentLock, lockIdentity)) {
            throw new ArtifactStoreError(
              "ARTIFACT_ROOT_CHANGED_DURING_OPERATION",
              `Artifact capacity lock path changed for ${artifactHash}`,
              { artifactHash },
            );
          }
        } catch (error) {
          await handle?.close();
          handle = undefined;
          await unlinkIfSameFile(lockPath, lockIdentity);
          lockIdentity = undefined;
          if (!isNodeError(error, "EEXIST")) throw error;
          if (Date.now() >= deadline) {
            throw new ArtifactCapacityError(
              "ARTIFACT_CAPACITY_LOCK_TIMEOUT",
              "Artifact capacity lock was not acquired within the bounded timeout",
            );
          }
          await new Promise((resolve) => setTimeout(resolve, 20));
        }
      }
      const lease = Object.freeze({
        authorityPath,
        assertCurrent: async () => {
          await this.authorityPathForRoot(rootIdentity, artifactHash);
        },
      });
      await lease.assertCurrent();
      return await work(lease);
    } finally {
      await handle?.close();
      try {
        await unlinkIfSameFile(lockPath, lockIdentity);
      } finally {
        await rootHandle.close();
      }
    }
  }

  pathFor(hash: string): string {
    const parsed = Sha256Schema.safeParse(hash);
    if (!parsed.success) {
      throw new ArtifactStoreError(
        "ARTIFACT_INVALID_HASH",
        "Artifact path requires a lowercase SHA-256 digest",
        { artifactHash: hash },
      );
    }
    const target = path.resolve(this.root, `${parsed.data}.json`);
    if (path.dirname(target) !== this.root) {
      throw new ArtifactStoreError(
        "ARTIFACT_INVALID_HASH",
        "Artifact path escaped the injected store root",
        { artifactHash: hash },
      );
    }
    return target;
  }

  private async readBoundedArtifactBytes(
    target: string,
    artifactHash: string,
  ): Promise<Buffer> {
    let rootHandle;
    let handle;
    try {
      rootHandle = await open(
        this.root,
        constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NONBLOCK,
      );
      const rootBefore = await rootHandle.stat();
      this.bindRootIdentity(rootBefore, artifactHash);
      try {
        handle = await open(
          target,
          constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK,
        );
      } catch (error) {
        if (isNodeError(error, "ENOENT")) throw error;
        let entry;
        try {
          entry = await lstat(target);
        } catch {
          // Classification must never replace the original operational error.
          // In particular, missing targets and inaccessible regular files keep
          // their existing ENOENT/EACCES behavior.
          throw error;
        }
        if (!entry.isFile() || entry.isSymbolicLink()) {
          throw new ArtifactStoreError(
            "ARTIFACT_UNSAFE_FILE_TYPE",
            `Artifact ${artifactHash} is not an openable regular file`,
            { artifactHash, cause: error },
          );
        }
        throw error;
      }

      const before = await handle.stat();
      if (!before.isFile()) {
        throw new ArtifactStoreError(
          "ARTIFACT_UNSAFE_FILE_TYPE",
          `Artifact ${artifactHash} is not a regular file`,
          { artifactHash },
        );
      }
      if (
        !Number.isSafeInteger(before.size)
        || before.size < 0
        || before.size > this.limits.maxPayloadBytes
      ) {
        throw new ArtifactStoreError(
          "ARTIFACT_BOUNDED_READ_EXCEEDED",
          `Artifact ${artifactHash} exceeds the ${this.limits.maxPayloadBytes} byte read boundary`,
          { artifactHash },
        );
      }

      const bytes = Buffer.allocUnsafe(before.size);
      let byteLength = 0;
      while (byteLength < before.size) {
        const read = await handle.read(
          bytes,
          byteLength,
          before.size - byteLength,
          byteLength,
        );
        if (read.bytesRead === 0) break;
        byteLength += read.bytesRead;
      }

      await this.testHooks?.afterArtifactRead?.({
        target,
        artifactHash,
        byteLength,
      });

      const probe = Buffer.allocUnsafe(1);
      const probeRead = await handle.read(probe, 0, 1, before.size);
      const after = await handle.stat();
      const rootAfter = await rootHandle.stat();
      let currentRoot;
      let currentTarget;
      try {
        [currentRoot, currentTarget] = await Promise.all([
          stat(this.root),
          lstat(target),
        ]);
      } catch (error) {
        if (
          isNodeError(error, "ENOENT")
          || isNodeError(error, "ENOTDIR")
          || isNodeError(error, "ELOOP")
        ) {
          throw new ArtifactStoreError(
            "ARTIFACT_FILE_CHANGED_DURING_READ",
            `Artifact ${artifactHash} root or path changed while it was being read`,
            { artifactHash, cause: error },
          );
        }
        throw error;
      }
      if (
        after.size > this.limits.maxPayloadBytes
        || (probeRead.bytesRead > 0 && before.size === this.limits.maxPayloadBytes)
      ) {
        throw new ArtifactStoreError(
          "ARTIFACT_BOUNDED_READ_EXCEEDED",
          `Artifact ${artifactHash} exceeded the ${this.limits.maxPayloadBytes} byte read boundary`,
          { artifactHash },
        );
      }
      if (
        !after.isFile()
        || byteLength !== before.size
        || probeRead.bytesRead !== 0
        || before.dev !== after.dev
        || before.ino !== after.ino
        || before.size !== after.size
        || before.mtimeMs !== after.mtimeMs
        || before.ctimeMs !== after.ctimeMs
        || !rootAfter.isDirectory()
        || !currentRoot.isDirectory()
        || rootBefore.dev !== rootAfter.dev
        || rootBefore.ino !== rootAfter.ino
        || rootAfter.dev !== currentRoot.dev
        || rootAfter.ino !== currentRoot.ino
        || !currentTarget.isFile()
        || currentTarget.isSymbolicLink()
        || after.dev !== currentTarget.dev
        || after.ino !== currentTarget.ino
      ) {
        throw new ArtifactStoreError(
          "ARTIFACT_FILE_CHANGED_DURING_READ",
          `Artifact ${artifactHash} changed while it was being read`,
          { artifactHash },
        );
      }
      return bytes;
    } finally {
      try {
        await handle?.close();
      } finally {
        await rootHandle?.close();
      }
    }
  }

  private async verifyExisting(
    target: string,
    expectedHash: string,
    expectedBytes?: Buffer,
  ): Promise<Buffer | undefined> {
    let bytes: Buffer;
    try {
      bytes = await this.readBoundedArtifactBytes(target, expectedHash);
    } catch (error) {
      if (isNodeError(error, "ENOENT")) return undefined;
      throw error;
    }

    if (sha256(bytes) !== expectedHash || (expectedBytes && !bytes.equals(expectedBytes))) {
      throw new ArtifactStoreError(
        "ARTIFACT_HASH_COLLISION_OR_CORRUPTION",
        `Artifact target ${expectedHash} contains bytes that do not match its hash`,
        { artifactHash: expectedHash },
      );
    }
    return bytes;
  }

  private authorityTargetPath(authorityRoot: string, hash: string): string {
    this.pathFor(hash);
    const target = path.resolve(authorityRoot, `${hash}.json`);
    if (path.dirname(target) !== path.resolve(authorityRoot)) {
      throw new ArtifactStoreError(
        "ARTIFACT_INVALID_HASH",
        "Artifact authority path escaped the held physical root",
        { artifactHash: hash },
      );
    }
    return target;
  }

  private async openOrCreateBatchDirectory(
    target: string,
    label: string,
    planIdentityHash: string,
    allowExisting: boolean,
  ): Promise<Readonly<{
    created: boolean;
    identity: BatchDirectoryIdentity;
    handle: Awaited<ReturnType<typeof openBatchDirectory>>;
  }>> {
    let created = false;
    try {
      await mkdir(target, { mode: 0o700 });
      created = true;
    } catch (error) {
      if (!allowExisting || !isNodeError(error, "EEXIST")) throw error;
    }
    const observed = await lstat(target);
    assertPrivateBatchDirectory(observed, label, planIdentityHash);
    const identity = batchDirectoryIdentity(observed);
    const handle = await openBatchDirectory(
      target,
      identity,
      label,
      planIdentityHash,
    );
    return Object.freeze({ created, identity, handle });
  }

  async #putPreparedBatch(
    prepared: PreparedArtifactStoreBatchV1,
  ): Promise<ArtifactStoreBatchPutResultV1> {
    const items = copyPreparedArtifactStoreBatchCanonicalItemsV1(prepared);
    for (const item of items) {
      if (
        item.identity.byteLength !== item.bytes.length
        || sha256(item.bytes) !== item.identity.hash
      ) {
        throw new ArtifactStoreError(
          "ARTIFACT_INVALID_ENVELOPE",
          `Prepared artifact ${item.identity.hash} lost its exact byte identity`,
          { artifactHash: item.identity.hash },
        );
      }
      this.pathFor(item.identity.hash);
      throwForArtifactCapacity(assessArtifactCapacity({
        payloadBytes: item.bytes.length,
        rootBytes: 0,
        freeBytes: Number.MAX_SAFE_INTEGER,
        limits: this.limits,
      }));
      // Outside-lease reads are optimization/error discovery only. Every item
      // is read again under the physical capacity lease below.
      await this.verifyExisting(
        this.pathFor(item.identity.hash),
        item.identity.hash,
        item.bytes,
      );
    }

    if (!this.capacityLeaseProvider) {
      await mkdir(this.root, { recursive: true });
    }
    return this.withCapacityLock(prepared.planIdentityHash, async (lease) => {
      await lease.assertCurrent();
      const authorityTargets = new Map<string, string>();
      const existingHashes = new Set<string>();
      for (const item of items) {
        const target = this.authorityTargetPath(
          lease.authorityPath,
          item.identity.hash,
        );
        authorityTargets.set(item.identity.hash, target);
        const existing = await this.verifyExisting(
          target,
          item.identity.hash,
          item.bytes,
        );
        if (existing) existingHashes.add(item.identity.hash);
      }
      const missing = items.filter((item) => !existingHashes.has(item.identity.hash));
      if (missing.length > 0) {
        const measured = await measureArtifactCapacity(lease.authorityPath);
        const override = await this.measureOverride?.();
        const capacity = override
          ? Object.freeze({
              rootBytes: Math.max(measured.rootBytes, override.rootBytes),
              freeBytes: Math.min(measured.freeBytes, override.freeBytes),
            })
          : measured;
        await this.testHooks?.afterCapacityMeasure?.({
          artifactHash: prepared.planIdentityHash,
          rootBytes: capacity.rootBytes,
          freeBytes: capacity.freeBytes,
        });
        await lease.assertCurrent();
        throwForArtifactCapacity(assessArtifactBatchCapacity({
          missingPayloadByteLengths: missing.map((item) => item.bytes.length),
          rootBytes: capacity.rootBytes,
          freeBytes: capacity.freeBytes,
          limits: this.limits,
        }));
      }

      const createdByHash = new Map(items.map((item) => [item.identity.hash, false]));
      const cleanupCandidates: Array<Readonly<{
        artifactHash: string;
        tempPath: string;
        authorityPath: string;
        identity: ArtifactRootIdentity;
      }>> = [];
      let stagingPath: string | undefined;
      let stagingIdentity: BatchDirectoryIdentity | undefined;
      let stagingHandle: Awaited<ReturnType<typeof openBatchDirectory>> | undefined;
      let attemptPath: string | undefined;
      let attemptIdentity: BatchDirectoryIdentity | undefined;
      let attemptHandle: Awaited<ReturnType<typeof openBatchDirectory>> | undefined;
      let operationCompleted = false;
      let cleanupCompleted = false;

      const cleanupOwnedAttempt = async (): Promise<void> => {
        if (!attemptPath || !attemptIdentity || !attemptHandle) return;
        await lease.assertCurrent();
        await assertBatchDirectoryCurrent(
          attemptPath,
          attemptIdentity,
          "Artifact batch attempt",
          prepared.planIdentityHash,
        );
        for (const candidate of cleanupCandidates) {
          await lease.assertCurrent();
          const current = await lstat(candidate.tempPath);
          if (!sameFileIdentity(current, candidate.identity)) {
            throw new ArtifactStoreError(
              "ARTIFACT_FILE_CHANGED_DURING_READ",
              `Owned batch temp ${candidate.artifactHash} changed before cleanup`,
              { artifactHash: candidate.artifactHash },
            );
          }
          assertPrivateBatchFile(
            current,
            "Owned artifact batch temp",
            candidate.artifactHash,
            [1, 2],
          );
          if (current.nlink === 2) {
            const final = await lstat(candidate.authorityPath);
            assertPrivateBatchFile(
              final,
              "Owned artifact batch final alias",
              candidate.artifactHash,
              [2],
            );
            if (!sameFileIdentity(current, final)) {
              throw new ArtifactStoreError(
                "ARTIFACT_FILE_CHANGED_DURING_READ",
                `Owned batch temp ${candidate.artifactHash} has a foreign second link`,
                { artifactHash: candidate.artifactHash },
              );
            }
          }
          await unlink(candidate.tempPath);
          if (current.nlink === 2) {
            const final = await lstat(candidate.authorityPath);
            assertPrivateBatchFile(
              final,
              "Finalized artifact batch alias",
              candidate.artifactHash,
              [1],
            );
            if (!sameFileIdentity(final, candidate.identity)) {
              throw new ArtifactStoreError(
                "ARTIFACT_FILE_CHANGED_DURING_READ",
                `Final artifact ${candidate.artifactHash} changed during temp cleanup`,
                { artifactHash: candidate.artifactHash },
              );
            }
          }
        }
        await syncDirectory(attemptPath);
        await assertBatchDirectoryCurrent(
          attemptPath,
          attemptIdentity,
          "Artifact batch attempt",
          prepared.planIdentityHash,
        );
        await assertBatchDirectoryEmpty(
          attemptPath,
          "Artifact batch attempt",
          prepared.planIdentityHash,
        );
        await attemptHandle.close();
        attemptHandle = undefined;
        await lease.assertCurrent();
        await rmdir(attemptPath);
        await syncDirectory(stagingPath!);
        await syncDirectory(lease.authorityPath);
        cleanupCompleted = true;
      };

      try {
        const staged: StagedBatchItem[] = [];
        if (missing.length > 0) {
          stagingPath = path.join(
            lease.authorityPath,
            ARTIFACT_STORE_STAGING_DIRECTORY_V1,
          );
          const staging = await this.openOrCreateBatchDirectory(
            stagingPath,
            "Artifact batch staging root",
            prepared.planIdentityHash,
            true,
          );
          stagingIdentity = staging.identity;
          stagingHandle = staging.handle;
          await assertBatchDirectoryEmpty(
            stagingPath,
            "Artifact batch staging root",
            prepared.planIdentityHash,
          );
          attemptPath = path.join(
            stagingPath,
            `${prepared.planIdentityHash}.${randomUUID()}`,
          );
          const attempt = await this.openOrCreateBatchDirectory(
            attemptPath,
            "Artifact batch attempt",
            prepared.planIdentityHash,
            false,
          );
          attemptIdentity = attempt.identity;
          attemptHandle = attempt.handle;

          for (const item of missing) {
            await lease.assertCurrent();
            await assertBatchDirectoryCurrent(
              stagingPath,
              stagingIdentity,
              "Artifact batch staging root",
              prepared.planIdentityHash,
            );
            await assertBatchDirectoryCurrent(
              attemptPath,
              attemptIdentity,
              "Artifact batch attempt",
              prepared.planIdentityHash,
            );
            const tempPath = path.join(attemptPath, `${item.identity.hash}.tmp`);
            let handle;
            try {
              handle = await open(
                tempPath,
                constants.O_WRONLY
                  | constants.O_CREAT
                  | constants.O_EXCL
                  | constants.O_NOFOLLOW,
                0o600,
              );
              await handle.chmod(0o600);
              const created = await handle.stat();
              assertPrivateBatchFile(
                created,
                "New artifact batch temp",
                item.identity.hash,
                [1],
              );
              cleanupCandidates.push(Object.freeze({
                artifactHash: item.identity.hash,
                tempPath,
                authorityPath: authorityTargets.get(item.identity.hash)!,
                identity: fileIdentity(created),
              }));
              await handle.writeFile(item.bytes);
              await handle.sync();
            } finally {
              await handle?.close();
            }
            const identity = await readExactStagedBytes(
              tempPath,
              item.bytes,
              item.identity.hash,
            );
            staged.push(Object.freeze({
              item,
              publicPath: this.pathFor(item.identity.hash),
              authorityPath: authorityTargets.get(item.identity.hash)!,
              tempPath,
              identity,
            }));
          }
          await syncDirectory(attemptPath);
          await syncDirectory(stagingPath);
          await syncDirectory(lease.authorityPath);
          await lease.assertCurrent();
          await this.testHooks?.afterBatchStaging?.({
            planIdentityHash: prepared.planIdentityHash,
            attemptPath,
            items: Object.freeze(staged.map((entry) => Object.freeze({
              durabilityTier: entry.item.durabilityTier,
              artifactHash: entry.item.identity.hash,
              temp: entry.tempPath,
            }))),
          });

          const tiers = [...new Set(staged.map((entry) => entry.item.durabilityTier))];
          for (const durabilityTier of tiers) {
            for (const entry of staged.filter(
              (candidate) => candidate.item.durabilityTier === durabilityTier,
            )) {
              await lease.assertCurrent();
              await assertBatchDirectoryCurrent(
                stagingPath,
                stagingIdentity,
                "Artifact batch staging root",
                prepared.planIdentityHash,
              );
              await assertBatchDirectoryCurrent(
                attemptPath,
                attemptIdentity,
                "Artifact batch attempt",
                prepared.planIdentityHash,
              );
              await readExactStagedBytes(
                entry.tempPath,
                entry.item.bytes,
                entry.item.identity.hash,
                entry.identity,
              );
              let created = false;
              try {
                await link(entry.tempPath, entry.authorityPath);
                created = true;
                const [tempStats, finalStats] = await Promise.all([
                  lstat(entry.tempPath),
                  lstat(entry.authorityPath),
                ]);
                assertPrivateBatchFile(
                  tempStats,
                  "Linked artifact batch temp",
                  entry.item.identity.hash,
                  [2],
                );
                assertPrivateBatchFile(
                  finalStats,
                  "Linked artifact batch final",
                  entry.item.identity.hash,
                  [2],
                );
                if (!sameFileIdentity(tempStats, finalStats)) {
                  throw new ArtifactStoreError(
                    "ARTIFACT_FILE_CHANGED_DURING_READ",
                    `Artifact ${entry.item.identity.hash} did not retain its staged inode`,
                    { artifactHash: entry.item.identity.hash },
                  );
                }
              } catch (error) {
                if (!isNodeError(error, "EEXIST")) throw error;
                const raced = await this.verifyExisting(
                  entry.authorityPath,
                  entry.item.identity.hash,
                  entry.item.bytes,
                );
                if (!raced) {
                  throw new ArtifactStoreError(
                    "ARTIFACT_HASH_COLLISION_OR_CORRUPTION",
                    `Artifact target ${entry.item.identity.hash} disappeared during batch publication`,
                    { artifactHash: entry.item.identity.hash },
                  );
                }
              }
              createdByHash.set(entry.item.identity.hash, created);
              await this.testHooks?.afterArtifactLink?.({
                artifactHash: entry.item.identity.hash,
                target: entry.publicPath,
                temp: entry.tempPath,
              });
              await this.testHooks?.afterBatchArtifactLink?.({
                planIdentityHash: prepared.planIdentityHash,
                durabilityTier,
                artifactHash: entry.item.identity.hash,
                target: entry.publicPath,
                temp: entry.tempPath,
                created,
              });
            }
            await lease.assertCurrent();
            await syncDirectory(lease.authorityPath);
            await lease.assertCurrent();
            await this.testHooks?.afterBatchTierSync?.({
              planIdentityHash: prepared.planIdentityHash,
              durabilityTier,
            });
          }
        }

        await this.testHooks?.beforeBatchFinalVerification?.({
          planIdentityHash: prepared.planIdentityHash,
        });
        await lease.assertCurrent();
        for (const item of items) {
          const verified = await this.verifyExisting(
            authorityTargets.get(item.identity.hash)!,
            item.identity.hash,
            item.bytes,
          );
          if (!verified) {
            throw new ArtifactStoreError(
              "ARTIFACT_ROOT_CHANGED_DURING_OPERATION",
              `Artifact ${item.identity.hash} disappeared before batch completion`,
              { artifactHash: item.identity.hash },
            );
          }
        }
        await lease.assertCurrent();
        const resultItems = Object.freeze(items.map((item) => Object.freeze({
          durabilityTier: item.durabilityTier,
          hash: item.identity.hash,
          path: this.pathFor(item.identity.hash),
          byteLength: item.identity.byteLength,
          created: createdByHash.get(item.identity.hash) ?? false,
        })));
        const createdItems = resultItems.filter((item) => item.created);
        const result = Object.freeze({
          schema: ARTIFACT_STORE_BATCH_PUT_RESULT_SCHEMA_V1,
          planIdentityHash: prepared.planIdentityHash,
          createdCount: createdItems.length,
          createdBytes: createdItems.reduce((sum, item) => sum + item.byteLength, 0),
          items: resultItems,
        });
        operationCompleted = true;
        return result;
      } finally {
        try {
          await cleanupOwnedAttempt();
        } catch (cleanupError) {
          if (operationCompleted) throw cleanupError;
        } finally {
          await attemptHandle?.close();
          await stagingHandle?.close();
        }
        if (
          !this.capacityLeaseProvider
          && stagingPath
          && (cleanupCompleted || !attemptPath)
        ) {
          try {
            await lease.assertCurrent();
            await assertBatchDirectoryEmpty(
              stagingPath,
              "Artifact batch staging root",
              prepared.planIdentityHash,
            );
            await rmdir(stagingPath);
            await syncDirectory(lease.authorityPath);
          } catch (cleanupError) {
            if (operationCompleted) throw cleanupError;
          }
        }
      }
    });
  }

  async putPreparedBatch(
    prepared: PreparedArtifactStoreBatchV1,
  ): Promise<ArtifactStoreBatchPutResultV1> {
    return this.#putPreparedBatch(prepared);
  }

  async put(value: unknown): Promise<ArtifactPutResult> {
    // Preserve the historical hostile-input and schema error boundary before
    // delegating the exact normalized envelope to the private batch core.
    const sourceBytes = boundedCanonicalJsonBytesForPut(
      value,
      this.limits.maxPayloadBytes,
    );
    const snapshot: unknown = JSON.parse(sourceBytes.toString("utf8"));
    const envelope = SemanticArtifactEnvelopeV1Schema.parse(snapshot);
    const bytes = boundedCanonicalJsonBytesForPut(
      envelope,
      this.limits.maxPayloadBytes,
    );
    if (!bytes.equals(sourceBytes)) {
      throw new ArtifactStoreError(
        "ARTIFACT_INVALID_ENVELOPE",
        "Artifact schema normalization changed canonical input bytes",
      );
    }
    throwForArtifactCapacity(assessArtifactCapacity({
      payloadBytes: bytes.length,
      rootBytes: 0,
      freeBytes: Number.MAX_SAFE_INTEGER,
      limits: this.limits,
    }));
    const batch = prepareArtifactStoreBatchPlanV1({
      schema: ARTIFACT_STORE_BATCH_PLAN_SCHEMA_V1,
      items: [{ durabilityTier: 0, envelope }],
    }, { maxPayloadBytes: this.limits.maxPayloadBytes });
    const result = await this.#putPreparedBatch(batch);
    const item = result.items[0];
    if (!item || result.items.length !== 1) {
      throw new ArtifactStoreError(
        "ARTIFACT_INVALID_ENVELOPE",
        "Single artifact publication did not return one exact batch member",
      );
    }
    return Object.freeze({
      hash: item.hash,
      path: item.path,
      created: item.created,
    });
  }

  private async getUnleased(hash: string): Promise<ArtifactGetResult> {
    const target = this.pathFor(hash);
    let bytes: Buffer;
    try {
      bytes = await this.readBoundedArtifactBytes(target, hash);
    } catch (error) {
      if (isNodeError(error, "ENOENT")) {
        throw new ArtifactStoreError(
          "ARTIFACT_NOT_FOUND",
          `Artifact ${hash} does not exist`,
          { artifactHash: hash, cause: error },
        );
      }
      throw error;
    }

    if (sha256(bytes) !== hash) {
      throw new ArtifactStoreError(
        "ARTIFACT_HASH_COLLISION_OR_CORRUPTION",
        `Artifact ${hash} failed hash verification`,
        { artifactHash: hash },
      );
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(bytes.toString("utf8"));
    } catch (error) {
      throw new ArtifactStoreError(
        "ARTIFACT_INVALID_ENVELOPE",
        `Artifact ${hash} is not valid JSON`,
        { artifactHash: hash, cause: error },
      );
    }

    let sourceCanonicalBytes: Buffer;
    try {
      // Bound shape/work before Zod traverses even a hash-valid but hostile
      // on-disk envelope (for example, a huge producer.toolVersions record).
      sourceCanonicalBytes = boundedCanonicalJsonBytes(
        parsed,
        this.limits.maxPayloadBytes,
      );
    } catch (error) {
      if (error instanceof CanonicalJsonLimitError) {
        throw new ArtifactStoreError(
          "ARTIFACT_INVALID_ENVELOPE",
          `Artifact ${hash} exceeds bounded canonical validation authority`,
          { artifactHash: hash, cause: error },
        );
      }
      throw error;
    }
    if (!bytes.equals(sourceCanonicalBytes)) {
      throw new ArtifactStoreError(
        "ARTIFACT_NON_CANONICAL_BYTES",
        `Artifact ${hash} bytes are not Setfarm Canonical JSON v1`,
        { artifactHash: hash },
      );
    }

    const envelopeResult = SemanticArtifactEnvelopeV1Schema.safeParse(parsed);
    if (!envelopeResult.success) {
      throw new ArtifactStoreError(
        "ARTIFACT_INVALID_ENVELOPE",
        `Artifact ${hash} does not contain a valid semantic envelope`,
        { artifactHash: hash, cause: envelopeResult.error },
      );
    }

    let envelopeCanonicalBytes: Buffer;
    try {
      envelopeCanonicalBytes = boundedCanonicalJsonBytes(
        envelopeResult.data,
        this.limits.maxPayloadBytes,
      );
    } catch (error) {
      if (error instanceof CanonicalJsonLimitError) {
        throw new ArtifactStoreError(
          "ARTIFACT_INVALID_ENVELOPE",
          `Artifact ${hash} exceeds bounded canonical validation authority`,
          { artifactHash: hash, cause: error },
        );
      }
      throw error;
    }
    if (!sourceCanonicalBytes.equals(envelopeCanonicalBytes)) {
      throw new ArtifactStoreError(
        "ARTIFACT_INVALID_ENVELOPE",
        `Artifact ${hash} schema normalization changed canonical bytes`,
        { artifactHash: hash },
      );
    }

    return {
      hash,
      path: target,
      envelope: envelopeResult.data,
      bytes,
    };
  }

  async get(hash: string): Promise<ArtifactGetResult> {
    // Reject untrusted path input before acquiring DB/kernel authority. The
    // private implementation repeats this check before resolving its target.
    this.pathFor(hash);
    if (!this.capacityLeaseProvider) return this.getUnleased(hash);
    return this.capacityLeaseProvider.withLease(async (lease) => {
      await lease.assertCurrent();
      const stored = await this.getUnleased(hash);
      await lease.assertCurrent();
      return stored;
    });
  }
}
