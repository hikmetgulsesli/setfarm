import { createHash, randomUUID } from "node:crypto";
import { constants, type Stats } from "node:fs";
import {
  lstat,
  link,
  mkdir,
  open,
  realpath,
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
  assessArtifactCapacity,
  measureArtifactCapacity,
  normalizeArtifactCapacityLimits,
  throwForArtifactCapacity,
  type ArtifactCapacityLimits,
  type ArtifactCapacitySnapshot,
} from "./artifact-capacity.js";

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
}>;

type ArtifactRootIdentity = Readonly<{
  dev: number;
  ino: number;
}>;

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
    handle = await open(directory, "r");
    await handle.sync();
  } catch (error) {
    // These codes mean directory fsync is unsupported by the platform. Access
    // failures such as EACCES still propagate: publication must not claim
    // durability when the configured artifact root cannot be synchronized.
    if (
      !isNodeError(error, "EINVAL")
      && !isNodeError(error, "ENOTSUP")
      && !isNodeError(error, "EPERM")
      && !isNodeError(error, "EISDIR")
    ) {
      throw error;
    }
  } finally {
    await handle?.close();
  }
}

export class ContentAddressedArtifactStore {
  readonly root: string;
  readonly limits: ArtifactCapacityLimits;
  private readonly measureOverride?: () => Promise<ArtifactCapacitySnapshot>;
  private readonly testHooks?: ArtifactStoreReadTestHooks;
  private rootIdentity?: ArtifactRootIdentity;
  private rootAuthorityPath?: string;

  constructor(
    root: string,
    options: Readonly<{
      limits?: ArtifactCapacityLimits;
      measure?: () => Promise<ArtifactCapacitySnapshot>;
      lockTimeoutMs?: number;
      testHooks?: ArtifactStoreReadTestHooks;
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

  async put(value: unknown): Promise<ArtifactPutResult> {
    // Capture hostile/caller-owned input under bounded canonical authority
    // before schema traversal. Zod only receives the plain snapshot produced by
    // JSON.parse, never caller accessors, proxies, or concurrently mutable
    // containers.
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
    const hash = sha256(bytes);
    const target = this.pathFor(hash);

    const existing = await this.verifyExisting(target, hash, bytes);
    if (existing) return { hash, path: target, created: false };

    await mkdir(this.root, { recursive: true });
    return this.withCapacityLock(hash, async (lease) => {
      await lease.assertCurrent();
      const racedExisting = await this.verifyExisting(target, hash, bytes);
      if (racedExisting) return { hash, path: target, created: false };
      const measured = await measureArtifactCapacity(lease.authorityPath);
      const override = await this.measureOverride?.();
      const capacity = override
        ? Object.freeze({
            // Injection is conservative-only: tests may model less capacity,
            // but no caller can undercount the held root or overstate its disk.
            rootBytes: Math.max(measured.rootBytes, override.rootBytes),
            freeBytes: Math.min(measured.freeBytes, override.freeBytes),
          })
        : measured;
      await this.testHooks?.afterCapacityMeasure?.({
        artifactHash: hash,
        rootBytes: capacity.rootBytes,
        freeBytes: capacity.freeBytes,
      });
      await lease.assertCurrent();
      throwForArtifactCapacity(assessArtifactCapacity({
        payloadBytes: bytes.length,
        rootBytes: capacity.rootBytes,
        freeBytes: capacity.freeBytes,
        limits: this.limits,
      }));

      const temp = path.join(this.root, `.${hash}.${process.pid}.${randomUUID()}.tmp`);
      let published = false;
      let handle;
      let tempIdentity: Stats | undefined;
      try {
        await lease.assertCurrent();
        handle = await open(temp, "wx", 0o600);
        tempIdentity = await handle.stat();
        await lease.assertCurrent();
        await handle.writeFile(bytes);
        await handle.sync();
        await handle.close();
        handle = undefined;
        await lease.assertCurrent();

        try {
          // A same-directory hard link is an atomic no-replace publish. Node's
          // rename API can overwrite an existing immutable hash target, so link
          // preserves the stronger never-overwrite invariant during races.
          await link(temp, target);
          published = true;
        } catch (error) {
          if (!isNodeError(error, "EEXIST")) throw error;
          const racedTarget = await this.verifyExisting(target, hash, bytes);
          if (!racedTarget) {
            throw new ArtifactStoreError(
              "ARTIFACT_HASH_COLLISION_OR_CORRUPTION",
              `Artifact target ${hash} disappeared during atomic publication`,
              { artifactHash: hash },
            );
          }
        }
        await this.testHooks?.afterArtifactLink?.({
          artifactHash: hash,
          target,
          temp,
        });
        await lease.assertCurrent();
        await syncDirectory(this.root);
        await lease.assertCurrent();
        const verified = await this.verifyExisting(target, hash, bytes);
        if (!verified) {
          throw new ArtifactStoreError(
            "ARTIFACT_ROOT_CHANGED_DURING_OPERATION",
            `Artifact ${hash} disappeared before publication could be returned`,
            { artifactHash: hash },
          );
        }
        return { hash, path: target, created: published };
      } finally {
        await handle?.close();
        await unlinkIfSameFile(temp, tempIdentity);
      }
    });
  }

  async get(hash: string): Promise<ArtifactGetResult> {
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
}
