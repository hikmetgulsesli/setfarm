import { createHash, randomUUID } from "node:crypto";
import {
  link,
  mkdir,
  open,
  readFile,
  unlink,
} from "node:fs/promises";
import path from "node:path";
import { z } from "zod";

import { canonicalJsonBytes } from "./canonical-json.js";
import {
  SemanticArtifactProducerV1Schema,
  Sha256Schema,
} from "./schemas/common-v1.js";
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

export const SemanticArtifactEnvelopeV1Schema = z
  .object({
    schema: z.literal("setfarm.semantic-artifact-envelope.v1"),
    artifactType: z
      .string()
      .min(1)
      .max(200)
      .regex(/^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)+$/),
    producer: SemanticArtifactProducerV1Schema,
    payload: z.unknown(),
  })
  .strict();

export type SemanticArtifactEnvelopeV1 = z.infer<typeof SemanticArtifactEnvelopeV1Schema>;

export type ArtifactStoreErrorCode =
  | "ARTIFACT_INVALID_HASH"
  | "ARTIFACT_NOT_FOUND"
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

function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function isNodeError(error: unknown, code: string): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error && error.code === code;
}

async function syncDirectory(directory: string): Promise<void> {
  let handle;
  try {
    handle = await open(directory, "r");
    await handle.sync();
  } catch (error) {
    if (
      !isNodeError(error, "EINVAL")
      && !isNodeError(error, "ENOTSUP")
      && !isNodeError(error, "EPERM")
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
  private readonly measure: () => Promise<ArtifactCapacitySnapshot>;

  constructor(
    root: string,
    options: Readonly<{
      limits?: ArtifactCapacityLimits;
      measure?: () => Promise<ArtifactCapacitySnapshot>;
      lockTimeoutMs?: number;
    }> = {},
  ) {
    if (!root.trim()) {
      throw new TypeError("Artifact store root must not be empty");
    }
    this.root = path.resolve(root);
    this.limits = normalizeArtifactCapacityLimits(
      options.limits ?? DEFAULT_ARTIFACT_CAPACITY_LIMITS,
    );
    this.measure = options.measure ?? (() => measureArtifactCapacity(this.root));
    this.lockTimeoutMs = Math.max(1, Math.min(options.lockTimeoutMs ?? 5_000, 30_000));
  }

  private readonly lockTimeoutMs: number;

  private async withCapacityLock<T>(work: () => Promise<T>): Promise<T> {
    const lockPath = path.join(this.root, ".capacity.lock");
    const token = randomUUID();
    const deadline = Date.now() + this.lockTimeoutMs;
    let handle;
    while (!handle) {
      try {
        handle = await open(lockPath, "wx", 0o600);
        await handle.writeFile(token, "utf8");
        await handle.sync();
      } catch (error) {
        await handle?.close();
        handle = undefined;
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
    try {
      return await work();
    } finally {
      await handle.close();
      try {
        const current = await readFile(lockPath, "utf8");
        if (current === token) await unlink(lockPath);
      } catch (error) {
        if (!isNodeError(error, "ENOENT")) throw error;
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

  private async verifyExisting(
    target: string,
    expectedHash: string,
    expectedBytes?: Buffer,
  ): Promise<Buffer | undefined> {
    let bytes: Buffer;
    try {
      bytes = await readFile(target);
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
    const envelope = SemanticArtifactEnvelopeV1Schema.parse(value);
    const bytes = canonicalJsonBytes(envelope);
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
    return this.withCapacityLock(async () => {
      const racedExisting = await this.verifyExisting(target, hash, bytes);
      if (racedExisting) return { hash, path: target, created: false };
      const capacity = await this.measure();
      throwForArtifactCapacity(assessArtifactCapacity({
        payloadBytes: bytes.length,
        rootBytes: capacity.rootBytes,
        freeBytes: capacity.freeBytes,
        limits: this.limits,
      }));

      const temp = path.join(this.root, `.${hash}.${process.pid}.${randomUUID()}.tmp`);
      let published = false;
      let handle;
      try {
        handle = await open(temp, "wx", 0o600);
        await handle.writeFile(bytes);
        await handle.sync();
        await handle.close();
        handle = undefined;

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
        await syncDirectory(this.root);
        return { hash, path: target, created: published };
      } finally {
        await handle?.close();
        try {
          await unlink(temp);
        } catch (error) {
          if (!isNodeError(error, "ENOENT")) throw error;
        }
      }
    });
  }

  async get(hash: string): Promise<ArtifactGetResult> {
    const target = this.pathFor(hash);
    let bytes: Buffer;
    try {
      bytes = await readFile(target);
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

    const envelopeResult = SemanticArtifactEnvelopeV1Schema.safeParse(parsed);
    if (!envelopeResult.success) {
      throw new ArtifactStoreError(
        "ARTIFACT_INVALID_ENVELOPE",
        `Artifact ${hash} does not contain a valid semantic envelope`,
        { artifactHash: hash, cause: envelopeResult.error },
      );
    }

    const canonicalBytes = canonicalJsonBytes(envelopeResult.data);
    if (!bytes.equals(canonicalBytes)) {
      throw new ArtifactStoreError(
        "ARTIFACT_NON_CANONICAL_BYTES",
        `Artifact ${hash} bytes are not Setfarm Canonical JSON v1`,
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
