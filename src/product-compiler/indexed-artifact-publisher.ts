import { createHash, randomUUID } from "node:crypto";
import { readdir } from "node:fs/promises";

import {
  ArtifactStoreError,
  ContentAddressedArtifactStore,
  isHybridAuthorityBackedArtifactStore,
  SemanticArtifactEnvelopeV1Schema,
  type ArtifactGetResult,
  type ArtifactPutResult,
  type SemanticArtifactEnvelopeV1,
} from "./artifact-store.js";
import {
  ArtifactIndexError,
  createArtifactIndex,
  type ArtifactIdentity,
  type ArtifactPublicationReservation,
  type ArtifactCapacityState,
} from "./artifact-index.js";
import { canonicalJsonBytes } from "./canonical-json.js";

type ArtifactIndexClient = Pick<
  ReturnType<typeof createArtifactIndex>,
  | "reservePublication"
  | "publish"
  | "finalizeOwnedReservation"
  | "listExpired"
  | "adoptExpired"
  | "releaseExpired"
  | "quarantineExpired"
  | "bootstrap"
>;

type ArtifactStoreClient = Pick<ContentAddressedArtifactStore, "put" | "get">;

const concreteArtifactStorePut = ContentAddressedArtifactStore.prototype.put;
const concreteArtifactStoreGet = ContentAddressedArtifactStore.prototype.get;

export type IndexedArtifactPublicationResult = ArtifactPutResult & Readonly<{
  identity: ArtifactIdentity;
  indexCreated: boolean;
}>;

export type ArtifactRecoveryResult = Readonly<{
  reservationId: string;
  artifactHash: string;
  resolution: "published" | "released" | "quarantined" | "stale";
  diagnostic?: string;
}>;

export type IndexedArtifactPublisherErrorCode =
  | "ARTIFACT_FILESYSTEM_INDEX_MISMATCH"
  | "ARTIFACT_INVENTORY_ENTRY_INVALID"
  | "ARTIFACT_PUBLICATION_BUSY_TIMEOUT"
  | "ARTIFACT_PRODUCTION_AUTHORITY_REQUIRED";

export class IndexedArtifactPublisherError extends Error {
  readonly code: IndexedArtifactPublisherErrorCode;
  override readonly cause?: unknown;

  constructor(
    code: IndexedArtifactPublisherErrorCode,
    message: string,
    options: Readonly<{ cause?: unknown }> = {},
  ) {
    super(message);
    this.name = "IndexedArtifactPublisherError";
    this.code = code;
    this.cause = options.cause;
  }
}

function hashBytes(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function identityForEnvelope(
  envelope: SemanticArtifactEnvelopeV1,
  bytes = canonicalJsonBytes(envelope),
): ArtifactIdentity {
  return Object.freeze({
    hash: hashBytes(bytes),
    artifactType: envelope.artifactType,
    byteLength: bytes.length,
    producer: envelope.producer,
  });
}

function sameIdentity(left: ArtifactIdentity, right: ArtifactIdentity): boolean {
  return left.hash === right.hash
    && left.artifactType === right.artifactType
    && left.byteLength === right.byteLength
    && canonicalJsonBytes(left.producer).equals(canonicalJsonBytes(right.producer));
}

function assertStoredIdentity(
  stored: ArtifactGetResult,
  expected: ArtifactIdentity,
): void {
  const observed = identityForEnvelope(stored.envelope, stored.bytes);
  if (!sameIdentity(observed, expected)) {
    throw new IndexedArtifactPublisherError(
      "ARTIFACT_FILESYSTEM_INDEX_MISMATCH",
      `Artifact ${expected.hash} filesystem identity differs from its publication identity`,
    );
  }
}

function isNodeError(error: unknown, code: string): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error && error.code === code;
}

function diagnostic(error: unknown): string {
  const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  return message.slice(0, 4_000) || "Unknown artifact publication failure";
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export class IndexedArtifactPublisher {
  private readonly index: ArtifactIndexClient;
  private readonly store: ArtifactStoreClient;
  private readonly ownerInstanceId: string;
  private readonly leaseMs: number;
  private readonly busyWaitMs: number;
  private readonly retryDelayMs: number;
  private readonly publicationAuthority: "standalone" | "hybrid-required";

  constructor(input: Readonly<{
    index: ArtifactIndexClient;
    store: ArtifactStoreClient;
    ownerInstanceId?: string;
    leaseMs?: number;
    busyWaitMs?: number;
    retryDelayMs?: number;
    publicationAuthority?: "standalone" | "hybrid-required";
  }>) {
    this.publicationAuthority = input.publicationAuthority ?? "standalone";
    if (
      this.publicationAuthority === "hybrid-required"
      && !isHybridAuthorityBackedArtifactStore(input.store)
    ) {
      throw new IndexedArtifactPublisherError(
        "ARTIFACT_PRODUCTION_AUTHORITY_REQUIRED",
        "Production artifact publication requires the concrete trusted hybrid store",
      );
    }
    this.index = input.index;
    this.store = this.publicationAuthority === "hybrid-required"
      ? Object.freeze({
          put: concreteArtifactStorePut.bind(input.store),
          get: concreteArtifactStoreGet.bind(input.store),
        })
      : input.store;
    this.ownerInstanceId = input.ownerInstanceId
      ?? `artifact-publisher:${process.pid}:${randomUUID()}`;
    this.leaseMs = Math.max(100, Math.min(Math.trunc(input.leaseMs ?? 120_000), 30 * 60_000));
    this.busyWaitMs = Math.max(0, Math.min(Math.trunc(input.busyWaitMs ?? 5_000), 30_000));
    this.retryDelayMs = Math.max(1, Math.min(Math.trunc(input.retryDelayMs ?? 20), 1_000));
  }

  private async getStored(hash: string): Promise<ArtifactGetResult> {
    return this.store.get(hash);
  }

  async put(value: unknown): Promise<IndexedArtifactPublicationResult> {
    const envelope = SemanticArtifactEnvelopeV1Schema.parse(value);
    const bytes = canonicalJsonBytes(envelope);
    const identity = identityForEnvelope(envelope, bytes);
    const deadline = Date.now() + this.busyWaitMs;
    let reservation: ArtifactPublicationReservation | undefined;

    while (!reservation) {
      const reservationId = `APRQ_${randomUUID()}`;
      try {
        const reserved = await this.index.reservePublication({
          reservationId,
          artifact: identity,
          ownerInstanceId: this.ownerInstanceId,
          leaseMs: this.leaseMs,
        });
        if (reserved.status === "already_published") {
          if (!sameIdentity(reserved.artifact, identity)) {
            throw new IndexedArtifactPublisherError(
              "ARTIFACT_FILESYSTEM_INDEX_MISMATCH",
              `Artifact ${identity.hash} immutable index identity differs from the requested envelope`,
            );
          }
          const stored = await this.getStored(identity.hash);
          assertStoredIdentity(stored, identity);
          return {
            hash: identity.hash,
            path: stored.path,
            created: false,
            identity,
            indexCreated: false,
          };
        }
        reservation = reserved.reservation;
      } catch (error) {
        if (
          !(error instanceof ArtifactIndexError)
          || error.code !== "ARTIFACT_RESERVATION_BUSY"
        ) {
          throw error;
        }
        if (Date.now() >= deadline) {
          throw new IndexedArtifactPublisherError(
            "ARTIFACT_PUBLICATION_BUSY_TIMEOUT",
            `Artifact ${identity.hash} remained reserved beyond the bounded publication wait`,
            { cause: error },
          );
        }
        await delay(this.retryDelayMs);
      }
    }

    const leaseToken = reservation.leaseToken;
    if (!leaseToken) throw new Error("ARTIFACT_RESERVATION_LEASE_TOKEN_MISSING");
    try {
      const written = await this.store.put(envelope);
      if (written.hash !== identity.hash) {
        throw new IndexedArtifactPublisherError(
          "ARTIFACT_FILESYSTEM_INDEX_MISMATCH",
          `Artifact store returned ${written.hash} for reserved hash ${identity.hash}`,
        );
      }
      const stored = await this.getStored(identity.hash);
      assertStoredIdentity(stored, identity);
      const published = await this.index.publish({
        reservationId: reservation.reservationId,
        artifact: identity,
        ownerInstanceId: this.ownerInstanceId,
        leaseToken,
      });
      return {
        ...written,
        identity,
        indexCreated: published.created,
      };
    } catch (error) {
      await this.settleFailedOwnedReservation(reservation, identity, error);
      throw error;
    }
  }

  private async settleFailedOwnedReservation(
    reservation: ArtifactPublicationReservation,
    identity: ArtifactIdentity,
    failure: unknown,
  ): Promise<void> {
    if (!reservation.leaseToken) return;
    let resolution: "released" | "quarantined" | undefined;
    try {
      const stored = await this.getStored(identity.hash);
      assertStoredIdentity(stored, identity);
      if (
        failure instanceof ArtifactIndexError
        && failure.code === "ARTIFACT_IDENTITY_MISMATCH"
      ) {
        resolution = "quarantined";
      } else {
        // Valid CAS bytes must remain attached to the reservation. If the DB
        // publication failed after the durable filesystem write, expiry
        // recovery adopts this exact lease and commits the missing index row.
        return;
      }
    } catch (inspectionError) {
      if (inspectionError instanceof ArtifactStoreError) {
        resolution = inspectionError.code === "ARTIFACT_NOT_FOUND"
          ? "released"
          : "quarantined";
      } else if (inspectionError instanceof IndexedArtifactPublisherError) {
        resolution = "quarantined";
      } else {
        return;
      }
    }
    try {
      await this.index.finalizeOwnedReservation({
        reservationId: reservation.reservationId,
        ownerInstanceId: this.ownerInstanceId,
        leaseToken: reservation.leaseToken,
        resolution,
        diagnostic: diagnostic(failure),
      });
    } catch {
      // Preserve the publication error. A lost DB connection or an expired
      // lease is handled by the durable expired-reservation reconciler.
    }
  }
}

export async function scanArtifactInventory(
  store: ContentAddressedArtifactStore,
): Promise<ArtifactIdentity[]> {
  let entries;
  try {
    entries = await readdir(store.root, { withFileTypes: true });
  } catch (error) {
    if (isNodeError(error, "ENOENT")) return [];
    throw error;
  }
  const artifacts: ArtifactIdentity[] = [];
  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    const match = /^([a-f0-9]{64})\.json$/.exec(entry.name);
    if (!entry.isFile() || !match) {
      throw new IndexedArtifactPublisherError(
        "ARTIFACT_INVENTORY_ENTRY_INVALID",
        `Artifact inventory contains non-canonical entry ${entry.name}`,
      );
    }
    const stored = await store.get(match[1]!);
    artifacts.push(identityForEnvelope(stored.envelope, stored.bytes));
  }
  return artifacts;
}

export async function bootstrapArtifactIndex(input: Readonly<{
  index: Pick<ReturnType<typeof createArtifactIndex>, "bootstrap">;
  store: ContentAddressedArtifactStore;
  quotaBytes?: number;
  maxPayloadBytes?: number;
  now?: Date;
}>): Promise<Readonly<{ capacity: ArtifactCapacityState; artifacts: ArtifactIdentity[] }>> {
  const artifacts = await scanArtifactInventory(input.store);
  const capacity = await input.index.bootstrap({
    artifacts,
    ...(input.quotaBytes === undefined ? {} : { quotaBytes: input.quotaBytes }),
    ...(input.maxPayloadBytes === undefined ? {} : { maxPayloadBytes: input.maxPayloadBytes }),
    ...(input.now === undefined ? {} : { now: input.now }),
  });
  return { capacity, artifacts };
}

export async function recoverExpiredArtifactPublications(input: Readonly<{
  index: ArtifactIndexClient;
  store: ArtifactStoreClient;
  ownerInstanceId?: string;
  leaseMs?: number;
  now?: Date;
}>): Promise<ArtifactRecoveryResult[]> {
  const owner = input.ownerInstanceId ?? `artifact-recovery:${process.pid}:${randomUUID()}`;
  const now = input.now ?? new Date();
  const expired = await input.index.listExpired(now);
  const results: ArtifactRecoveryResult[] = [];
  for (const reservation of expired) {
    let stored: ArtifactGetResult;
    try {
      stored = await input.store.get(reservation.artifact.hash);
      assertStoredIdentity(stored, reservation.artifact);
    } catch (error) {
      try {
        if (error instanceof ArtifactStoreError && error.code === "ARTIFACT_NOT_FOUND") {
          await input.index.releaseExpired({
            reservationId: reservation.reservationId,
            diagnostic: "Expired publication has no durable CAS bytes",
            now,
          });
          results.push({
            reservationId: reservation.reservationId,
            artifactHash: reservation.artifact.hash,
            resolution: "released",
          });
        } else {
          const reason = diagnostic(error);
          await input.index.quarantineExpired({
            reservationId: reservation.reservationId,
            diagnostic: reason,
            now,
          });
          results.push({
            reservationId: reservation.reservationId,
            artifactHash: reservation.artifact.hash,
            resolution: "quarantined",
            diagnostic: reason,
          });
        }
      } catch (finalizeError) {
        if (
          finalizeError instanceof ArtifactIndexError
          && finalizeError.code === "ARTIFACT_RESERVATION_NOT_EXPIRED"
        ) {
          results.push({
            reservationId: reservation.reservationId,
            artifactHash: reservation.artifact.hash,
            resolution: "stale",
          });
          continue;
        }
        throw finalizeError;
      }
      continue;
    }

    try {
      const adopted = await input.index.adoptExpired({
        reservationId: reservation.reservationId,
        artifact: reservation.artifact,
        ownerInstanceId: owner,
        leaseMs: input.leaseMs,
        now,
      });
      if (!adopted.leaseToken) throw new Error("ARTIFACT_RECOVERY_LEASE_TOKEN_MISSING");
      await input.index.publish({
        reservationId: reservation.reservationId,
        artifact: reservation.artifact,
        ownerInstanceId: owner,
        leaseToken: adopted.leaseToken,
        now,
      });
      results.push({
        reservationId: reservation.reservationId,
        artifactHash: reservation.artifact.hash,
        resolution: "published",
      });
    } catch (error) {
      if (
        error instanceof ArtifactIndexError
        && error.code === "ARTIFACT_RESERVATION_NOT_EXPIRED"
      ) {
        results.push({
          reservationId: reservation.reservationId,
          artifactHash: reservation.artifact.hash,
          resolution: "stale",
        });
        continue;
      }
      throw error;
    }
  }
  return results;
}
