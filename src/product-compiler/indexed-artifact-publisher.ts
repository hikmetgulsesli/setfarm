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
  ARTIFACT_STORE_BATCH_PUT_RESULT_SCHEMA_V1,
  copyPreparedArtifactStoreBatchCanonicalItemsV1,
  createArtifactPublicationBatchPlanBindingV1,
  prepareArtifactStoreBatchPlanV1,
  type ArtifactStoreBatchPutResultV1,
  type PreparedArtifactStoreBatchCanonicalItemV1,
  type PreparedArtifactStoreBatchV1,
} from "./artifact-store-batch-plan.js";
import {
  ARTIFACT_CLOSURE_REGISTRY_V1,
  evaluateArtifactClosureV1,
  prepareArtifactClosureEvidenceSetV1,
  type ArtifactClosureEvidenceV1,
} from "./artifact-closure.js";
import {
  ArtifactIndexError,
  createArtifactIndex,
  type ArtifactIdentity,
  type ArtifactPublicationBatchLifecycle,
  type ArtifactPublicationBatchReservation,
  type ArtifactPublicationReservation,
  type ArtifactCapacityState,
} from "./artifact-index.js";
import {
  computeArtifactPublicationBatchIdentityHash,
} from "./artifact-publication-batch-identity.js";
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
  | "reservePublicationBatch"
  | "heartbeatPublicationBatch"
  | "publishPublicationBatchItem"
  | "finalizeOwnedPublicationBatch"
  | "getPublicationBatchLifecycle"
>;

type ArtifactStoreClient = Pick<ContentAddressedArtifactStore, "put" | "get">
  & Partial<Pick<ContentAddressedArtifactStore, "putPreparedBatch">>;

const concreteArtifactStorePut = ContentAddressedArtifactStore.prototype.put;
const concreteArtifactStoreGet = ContentAddressedArtifactStore.prototype.get;
const concreteArtifactStorePutPreparedBatch =
  ContentAddressedArtifactStore.prototype.putPreparedBatch;

export type IndexedArtifactPublicationResult = ArtifactPutResult & Readonly<{
  identity: ArtifactIdentity;
  indexCreated: boolean;
}>;

export const INDEXED_ARTIFACT_BATCH_PUBLICATION_RESULT_SCHEMA_V1 =
  "setfarm.indexed-artifact-batch-publication-result.v1" as const;

export type IndexedArtifactBatchPublicationResultItemV1 = Readonly<{
  durabilityTier: number;
  identity: ArtifactIdentity;
  path: string;
  casCreated: boolean;
  indexCreated: boolean;
}>;

export type IndexedArtifactBatchPublicationResultV1 = Readonly<{
  schema: typeof INDEXED_ARTIFACT_BATCH_PUBLICATION_RESULT_SCHEMA_V1;
  batchReservationId: string;
  batchIdentityHash: string;
  planIdentityHash: string;
  batchCreated: boolean;
  cas: ArtifactStoreBatchPutResultV1;
  closures: readonly ArtifactClosureEvidenceV1[];
  items: readonly IndexedArtifactBatchPublicationResultItemV1[];
  lifecycle: ArtifactPublicationBatchLifecycle;
}>;

export type ArtifactRecoveryResult = Readonly<{
  reservationId: string;
  artifactHash: string;
  resolution: "published" | "released" | "quarantined" | "stale";
  diagnostic?: string;
}>;

export type IndexedArtifactPublisherErrorCode =
  | "ARTIFACT_FILESYSTEM_INDEX_MISMATCH"
  | "ARTIFACT_BATCH_PUBLICATION_INCOMPLETE"
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

function batchIncomplete(message: string, cause?: unknown): IndexedArtifactPublisherError {
  return new IndexedArtifactPublisherError(
    "ARTIFACT_BATCH_PUBLICATION_INCOMPLETE",
    `ARTIFACT_BATCH_PUBLICATION_INCOMPLETE: ${message}`,
    cause === undefined ? {} : { cause },
  );
}

function assertBatchReservationMatchesPrepared(
  batchReservationId: string,
  ownerInstanceId: string,
  preparedItems: readonly PreparedArtifactStoreBatchCanonicalItemV1[],
  reservation: ArtifactPublicationBatchReservation,
): void {
  const expectedIdentityHash = computeArtifactPublicationBatchIdentityHash(
    preparedItems.map((item) => item.identity),
  );
  const expectedPlan = createArtifactPublicationBatchPlanBindingV1(
    preparedItems.map((item) => Object.freeze({
      durabilityTier: item.durabilityTier,
      identity: item.identity,
    })),
  );
  if (
    reservation.batchReservationId !== batchReservationId
    || reservation.batchIdentityHash !== expectedIdentityHash
    || reservation.plan.planIdentityHash !== expectedPlan.planIdentityHash
    || reservation.plan.items.length !== expectedPlan.items.length
    || reservation.items.length !== preparedItems.length
  ) {
    throw batchIncomplete("database batch identity or membership count differs from the prepared plan");
  }
  for (let ordinal = 0; ordinal < expectedPlan.items.length; ordinal += 1) {
    const expected = expectedPlan.items[ordinal]!;
    const observedPlanItem = reservation.plan.items[ordinal];
    if (
      !observedPlanItem
      || observedPlanItem.durabilityTier !== expected.durabilityTier
      || !sameIdentity(observedPlanItem.identity, expected.identity)
    ) {
      throw batchIncomplete("database recovery plan differs from the exact prepared tier order");
    }
  }
  const expectedByHash = new Map(
    preparedItems.map((item) => [item.identity.hash, item.identity]),
  );
  const observed = new Set<string>();
  for (const item of reservation.items) {
    const expected = expectedByHash.get(item.artifact.hash);
    if (!expected || observed.has(item.artifact.hash) || !sameIdentity(item.artifact, expected)) {
      throw batchIncomplete("database batch membership is not the exact prepared identity set");
    }
    observed.add(item.artifact.hash);
    if (item.status === "reserved") {
      if (
        !sameIdentity(item.reservation.artifact, expected)
        || item.reservation.state !== "reserved"
      ) {
        throw batchIncomplete(`database child reservation ${item.artifact.hash} is incoherent`);
      }
    }
  }
  if (observed.size !== expectedByHash.size) {
    throw batchIncomplete("database batch membership omits a prepared identity");
  }
  const reservedCount = reservation.items.filter((item) => item.status === "reserved").length;
  const expectedStatus = reservedCount === 0
    ? "already_published"
    : reservedCount === reservation.items.length
      ? "reserved"
      : "partially_published";
  if (reservation.status !== expectedStatus) {
    throw batchIncomplete("database batch status differs from its exact member states");
  }

  const hasLeaseFields = reservation.ownerInstanceId === ownerInstanceId
    && typeof reservation.leaseToken === "string"
    && reservation.leaseToken.length > 0
    && typeof reservation.leaseExpiresAt === "string"
    && Number.isFinite(Date.parse(reservation.leaseExpiresAt));
  if (reservation.state === "active") {
    if (
      !hasLeaseFields
      || reservation.createdByInstanceId !== ownerInstanceId
      || reservation.items.every((item) => item.status !== "reserved")
    ) {
      throw batchIncomplete("active database batch lacks one exact aggregate owner/token/expiry fence");
    }
    for (const item of reservation.items) {
      if (item.status !== "reserved") continue;
      if (
        item.reservation.ownerInstanceId !== reservation.ownerInstanceId
        || item.reservation.leaseToken !== reservation.leaseToken
        || item.reservation.leaseExpiresAt !== reservation.leaseExpiresAt
      ) {
        throw batchIncomplete(`database child ${item.artifact.hash} differs from its aggregate fence`);
      }
    }
  } else if (
    reservation.state !== "completed"
    || reservation.status !== "already_published"
    || reservation.items.some((item) => item.status !== "already_published")
    || reservation.ownerInstanceId !== undefined
    || reservation.leaseToken !== undefined
    || reservation.leaseExpiresAt !== undefined
  ) {
    throw batchIncomplete("database batch is neither coherently active nor completed");
  }
}

function canonicalCasResult(
  prepared: PreparedArtifactStoreBatchV1,
  preparedItems: readonly PreparedArtifactStoreBatchCanonicalItemV1[],
  storedItems: readonly ArtifactGetResult[],
  candidate?: ArtifactStoreBatchPutResultV1,
): ArtifactStoreBatchPutResultV1 {
  if (
    candidate
    && (
      candidate.schema !== ARTIFACT_STORE_BATCH_PUT_RESULT_SCHEMA_V1
      || candidate.planIdentityHash !== prepared.planIdentityHash
      || candidate.items.length !== preparedItems.length
    )
  ) {
    throw batchIncomplete("CAS batch receipt does not bind the prepared plan");
  }
  const storedByHash = new Map(storedItems.map((item) => [item.hash, item]));
  const candidateByHash = new Map(candidate?.items.map((item) => [item.hash, item]) ?? []);
  if (candidate && candidateByHash.size !== preparedItems.length) {
    throw batchIncomplete("CAS batch receipt repeats or omits a prepared identity");
  }
  const items = preparedItems.map((item) => {
    const stored = storedByHash.get(item.identity.hash);
    const receipt = candidateByHash.get(item.identity.hash);
    if (!stored) throw batchIncomplete(`fresh CAS receipt is missing ${item.identity.hash}`);
    const created = receipt?.created ?? false;
    if (
      candidate
      && (
        !receipt
        || receipt.durabilityTier !== item.durabilityTier
        || receipt.byteLength !== item.identity.byteLength
        || receipt.path !== stored.path
      )
    ) {
      throw batchIncomplete(`CAS receipt for ${item.identity.hash} differs from fresh evidence`);
    }
    return Object.freeze({
      durabilityTier: item.durabilityTier,
      hash: item.identity.hash,
      path: stored.path,
      byteLength: item.identity.byteLength,
      created,
    });
  });
  const createdCount = items.filter((item) => item.created).length;
  const createdBytes = items.reduce(
    (total, item) => total + (item.created ? item.byteLength : 0),
    0,
  );
  if (
    candidate
    && (candidate.createdCount !== createdCount || candidate.createdBytes !== createdBytes)
  ) {
    throw batchIncomplete("CAS batch aggregate receipt counters differ from its members");
  }
  return Object.freeze({
    schema: ARTIFACT_STORE_BATCH_PUT_RESULT_SCHEMA_V1,
    planIdentityHash: prepared.planIdentityHash,
    createdCount,
    createdBytes,
    items: Object.freeze(items),
  });
}

function validatePreparedClosure(
  preparedItems: readonly PreparedArtifactStoreBatchCanonicalItemV1[],
  storedItems: readonly ArtifactGetResult[],
): readonly ArtifactClosureEvidenceV1[] {
  const evidence = prepareArtifactClosureEvidenceSetV1(storedItems);
  const planByHash = new Map(preparedItems.map((item) => [item.identity.hash, item]));
  const dependencyRootTypes = new Set<string>(
    ARTIFACT_CLOSURE_REGISTRY_V1.entries
      .filter((entry) => entry.kind === "dependency-root")
      .map((entry) => entry.artifactType),
  );
  const closures: ArtifactClosureEvidenceV1[] = [];
  for (const item of preparedItems) {
    if (!dependencyRootTypes.has(item.identity.artifactType)) continue;
    const closure = evaluateArtifactClosureV1({
      evidence,
      root: item.identity,
      role: "dependency-root",
    });
    if (closure.status !== "verified") {
      throw batchIncomplete(
        `semantic closure for ${item.identity.hash} was rejected as ${closure.classification}`,
      );
    }
    for (const member of closure.members) {
      const planned = planByHash.get(member.expected.hash);
      if (
        !planned
        || planned.durabilityTier !== member.durabilityTier
        || !member.observed
        || !sameIdentity(planned.identity, member.observed)
        || !member.publishable
      ) {
        throw batchIncomplete(
          `semantic closure member ${member.expected.hash} is absent or assigned to the wrong durability tier`,
        );
      }
    }
    closures.push(closure);
  }
  return Object.freeze(closures);
}

function isAggregateLeaseLoss(error: unknown): boolean {
  return error instanceof ArtifactIndexError && error.code === "ARTIFACT_BATCH_LEASE_LOST";
}

function assertCompletedBatchLifecycle(
  batchReservationId: string,
  batchIdentityHash: string,
  expectedReserved: readonly ArtifactIdentity[],
  lifecycle: ArtifactPublicationBatchLifecycle,
): void {
  if (
    lifecycle.batchReservationId !== batchReservationId
    || lifecycle.batchIdentityHash !== batchIdentityHash
    || lifecycle.state !== "completed"
    || lifecycle.ownerInstanceId !== undefined
    || lifecycle.leaseToken !== undefined
    || lifecycle.leaseExpiresAt !== undefined
    || lifecycle.reservations.length !== expectedReserved.length
  ) {
    throw batchIncomplete("final database lifecycle is not the exact completed aggregate");
  }
  const expectedByHash = new Map(expectedReserved.map((item) => [item.hash, item]));
  for (const reservation of lifecycle.reservations) {
    const expected = expectedByHash.get(reservation.artifact.hash);
    if (
      !expected
      || reservation.state !== "published"
      || !sameIdentity(reservation.artifact, expected)
    ) {
      throw batchIncomplete("final database lifecycle contains an incomplete child");
    }
    expectedByHash.delete(reservation.artifact.hash);
  }
  if (expectedByHash.size !== 0) {
    throw batchIncomplete("final database lifecycle omits a reserved child");
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
          putPreparedBatch: concreteArtifactStorePutPreparedBatch.bind(input.store),
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

  private async readPreparedItemsFresh(
    items: readonly PreparedArtifactStoreBatchCanonicalItemV1[],
  ): Promise<readonly ArtifactGetResult[]> {
    // Start every read before awaiting the aggregate. Successful replay therefore
    // proves the complete fresh CAS set rather than a short-circuited prefix.
    return Object.freeze(await Promise.all(items.map(async (item) => {
      const stored = await this.getStored(item.identity.hash);
      assertStoredIdentity(stored, item.identity);
      return stored;
    })));
  }

  async putBatch(input: Readonly<{
    batchReservationId: string;
    plan: unknown;
  }>): Promise<IndexedArtifactBatchPublicationResultV1> {
    // Public input is fully snapshotted before the first database operation.
    const batchReservationId = input.batchReservationId;
    const prepared = prepareArtifactStoreBatchPlanV1(input.plan);
    const preparedItems = copyPreparedArtifactStoreBatchCanonicalItemsV1(prepared);
    const publicationPlan = createArtifactPublicationBatchPlanBindingV1(
      preparedItems.map((item) => Object.freeze({
        durabilityTier: item.durabilityTier,
        identity: item.identity,
      })),
    );
    if (publicationPlan.planIdentityHash !== prepared.planIdentityHash) {
      throw batchIncomplete("prepared CAS plan and database recovery plan identities differ");
    }
    const putPreparedBatch = this.store.putPreparedBatch;
    if (!putPreparedBatch) {
      throw batchIncomplete("artifact store does not expose prepared batch publication");
    }
    let reservation: ArtifactPublicationBatchReservation | undefined;
    try {
      reservation = await this.index.reservePublicationBatch({
        batchReservationId,
        artifacts: preparedItems.map((item) => item.identity),
        plan: publicationPlan,
        ownerInstanceId: this.ownerInstanceId,
        leaseMs: this.leaseMs,
      });
      assertBatchReservationMatchesPrepared(
        batchReservationId,
        this.ownerInstanceId,
        preparedItems,
        reservation,
      );

      // Never use putPreparedBatch to recreate bytes for a member the database
      // already considers indexed. Such absence is authority drift, not a write.
      const alreadyIndexed = new Set(
        reservation.items
          .filter((item) => item.status === "already_published")
          .map((item) => item.artifact.hash),
      );
      const indexedItems = preparedItems.filter((item) => alreadyIndexed.has(item.identity.hash));
      if (reservation.state === "active" && indexedItems.length > 0) {
        await this.readPreparedItemsFresh(indexedItems);
      }

      let cas: ArtifactStoreBatchPutResultV1;
      let storedItems: readonly ArtifactGetResult[];
      if (reservation.state === "completed") {
        storedItems = await this.readPreparedItemsFresh(preparedItems);
        cas = canonicalCasResult(prepared, preparedItems, storedItems);
      } else {
        const candidate = await putPreparedBatch.call(this.store, prepared);
        storedItems = await this.readPreparedItemsFresh(preparedItems);
        cas = canonicalCasResult(prepared, preparedItems, storedItems, candidate);
      }

      const closures = validatePreparedClosure(preparedItems, storedItems);
      const reservedItems = reservation.items.filter(
        (item): item is Extract<typeof item, { status: "reserved" }> => item.status === "reserved",
      );
      const expectedReserved = reservation.items.flatMap((item) =>
        item.status === "reserved" || item.reservationId !== undefined
          ? [item.artifact]
          : []);
      const indexCreatedByHash = new Map<string, boolean>();

      if (reservation.state === "active") {
        const leaseToken = reservation.leaseToken;
        if (!leaseToken) throw batchIncomplete("active aggregate lease token is missing");
        const heartbeat = await this.index.heartbeatPublicationBatch({
          batchReservationId: reservation.batchReservationId,
          ownerInstanceId: this.ownerInstanceId,
          leaseToken,
          leaseMs: this.leaseMs,
        });
        if (
          heartbeat.state !== "active"
          || heartbeat.ownerInstanceId !== this.ownerInstanceId
          || heartbeat.leaseToken !== leaseToken
          || !heartbeat.leaseExpiresAt
        ) {
          throw batchIncomplete("aggregate heartbeat did not return the exact live fence");
        }

        const reservationByHash = new Map(
          reservedItems.map((item) => [item.artifact.hash, item.reservation]),
        );
        const indexedHashes = new Set(alreadyIndexed);
        const closureByRoot = new Map(closures.map((closure) => [closure.rootHash, closure]));
        for (const item of preparedItems) {
          if (indexedHashes.has(item.identity.hash)) {
            indexCreatedByHash.set(item.identity.hash, false);
            continue;
          }
          const earlierUnindexed = preparedItems.find((candidate) =>
            candidate.durabilityTier < item.durabilityTier
            && !indexedHashes.has(candidate.identity.hash));
          if (earlierUnindexed) {
            throw batchIncomplete(
              `tier ${item.durabilityTier} cannot publish before ${earlierUnindexed.identity.hash}`,
            );
          }
          const closure = closureByRoot.get(item.identity.hash);
          const unindexedDependency = closure?.members.find((member) =>
            member.role === "dependency" && !indexedHashes.has(member.expected.hash));
          if (unindexedDependency) {
            throw batchIncomplete(
              `dependency root ${item.identity.hash} cannot publish before ${unindexedDependency.expected.hash}`,
            );
          }
          const child = reservationByHash.get(item.identity.hash);
          if (!child?.leaseToken || child.leaseToken !== leaseToken) {
            throw batchIncomplete(`prepared member ${item.identity.hash} lacks its exact child fence`);
          }
          const published = await this.index.publishPublicationBatchItem({
            batchReservationId: reservation.batchReservationId,
            reservationId: child.reservationId,
            artifact: item.identity,
            ownerInstanceId: this.ownerInstanceId,
            leaseToken,
          });
          if (!sameIdentity(published.artifact, item.identity)) {
            throw batchIncomplete(`database published a different identity for ${item.identity.hash}`);
          }
          indexedHashes.add(item.identity.hash);
          indexCreatedByHash.set(item.identity.hash, published.created);
        }
        if (indexedHashes.size !== preparedItems.length) {
          throw batchIncomplete("database publication did not consume the complete prepared batch");
        }
      } else {
        for (const item of preparedItems) indexCreatedByHash.set(item.identity.hash, false);
      }

      const lifecycle = await this.index.getPublicationBatchLifecycle({
        batchReservationId: reservation.batchReservationId,
      });
      assertCompletedBatchLifecycle(
        reservation.batchReservationId,
        reservation.batchIdentityHash,
        expectedReserved,
        lifecycle,
      );
      const casByHash = new Map(cas.items.map((item) => [item.hash, item]));
      const items = Object.freeze(preparedItems.map((item) => {
        const receipt = casByHash.get(item.identity.hash);
        if (!receipt) throw batchIncomplete(`final CAS result omits ${item.identity.hash}`);
        return Object.freeze({
          durabilityTier: item.durabilityTier,
          identity: item.identity,
          path: receipt.path,
          casCreated: receipt.created,
          indexCreated: indexCreatedByHash.get(item.identity.hash) ?? false,
        });
      }));
      return Object.freeze({
        schema: INDEXED_ARTIFACT_BATCH_PUBLICATION_RESULT_SCHEMA_V1,
        batchReservationId: reservation.batchReservationId,
        batchIdentityHash: reservation.batchIdentityHash,
        planIdentityHash: prepared.planIdentityHash,
        batchCreated: reservation.batchCreated,
        cas,
        closures,
        items,
        lifecycle,
      });
    } catch (error) {
      if (reservation) {
        await this.settleFailedOwnedBatch(reservation, preparedItems, error);
      }
      throw error;
    }
  }

  private async settleFailedOwnedBatch(
    reservation: ArtifactPublicationBatchReservation,
    items: readonly PreparedArtifactStoreBatchCanonicalItemV1[],
    failure: unknown,
  ): Promise<void> {
    if (
      reservation.state !== "active"
      || !reservation.leaseToken
      || isAggregateLeaseLoss(failure)
    ) return;

    const observations = await Promise.allSettled(items.map(async (item) => {
      const stored = await this.getStored(item.identity.hash);
      assertStoredIdentity(stored, item.identity);
      return stored;
    }));
    const indexedHashes = new Set(
      reservation.items
        .filter((item) => item.status === "already_published")
        .map((item) => item.artifact.hash),
    );
    let exact = 0;
    let missing = 0;
    let corrupt = false;
    let uncertain = false;
    for (const [index, observation] of observations.entries()) {
      if (observation.status === "fulfilled") {
        exact += 1;
        continue;
      }
      const error = observation.reason;
      if (error instanceof ArtifactStoreError && error.code === "ARTIFACT_NOT_FOUND") {
        if (indexedHashes.has(items[index]!.identity.hash)) corrupt = true;
        else missing += 1;
      } else if (
        error instanceof IndexedArtifactPublisherError
        || (error instanceof ArtifactStoreError && [
          "ARTIFACT_UNSAFE_FILE_TYPE",
          "ARTIFACT_INVALID_ENVELOPE",
          "ARTIFACT_HASH_COLLISION_OR_CORRUPTION",
          "ARTIFACT_NON_CANONICAL_BYTES",
        ].includes(error.code))
      ) {
        corrupt = true;
      } else {
        uncertain = true;
      }
    }
    if (uncertain) return;
    const resolution = corrupt
      ? "quarantined" as const
      : exact === 0 && missing === items.length
        ? "released" as const
        : undefined;
    if (!resolution) return;
    try {
      await this.index.finalizeOwnedPublicationBatch({
        batchReservationId: reservation.batchReservationId,
        ownerInstanceId: this.ownerInstanceId,
        leaseToken: reservation.leaseToken,
        resolution,
        diagnostic: diagnostic(failure),
      });
    } catch {
      // Preserve the primary failure. Expiry recovery owns any lease race or
      // uncertain database outcome and will classify the aggregate afresh.
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
