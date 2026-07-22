import { createHash, randomUUID } from "node:crypto";
import { isProxy } from "node:util/types";

import {
  ArtifactStoreError,
  ContentAddressedArtifactStore,
  isHybridWriterAuthorityBackedArtifactStore,
  SemanticArtifactEnvelopeV1Schema,
  type ArtifactGetResult,
  type ArtifactPutResult,
  type ArtifactStoreInventoryAuthorityV1,
  type ArtifactStoreInventoryIssueV1,
  type ArtifactStoreInventorySnapshotV1,
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
  MAX_EXPIRED_ARTIFACT_PUBLICATION_BATCHES_PER_RECOVERY_V1,
  createArtifactIndex,
  type ArtifactIdentity,
  type ArtifactPublicationBatchLifecycle,
  type ArtifactPublicationBatchRecoverySnapshot,
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
  | "quarantineBootstrapInventory"
  | "reservePublicationBatch"
  | "heartbeatPublicationBatch"
  | "adoptExpiredPublicationBatch"
  | "listExpiredPublicationBatches"
  | "getPublicationBatchRecoverySnapshot"
  | "publishPublicationBatchItem"
  | "finalizeOwnedPublicationBatch"
  | "finalizeExpiredPublicationBatch"
  | "getPublicationBatchLifecycle"
>;

type ArtifactSingleRecoveryIndexClient = Pick<
  ArtifactIndexClient,
  | "publish"
  | "listExpired"
  | "adoptExpired"
  | "releaseExpired"
  | "quarantineExpired"
>;

type ArtifactBatchRecoveryIndexClient = Pick<
  ArtifactIndexClient,
  | "adoptExpiredPublicationBatch"
  | "listExpiredPublicationBatches"
  | "getPublicationBatchRecoverySnapshot"
  | "publishPublicationBatchItem"
  | "finalizeOwnedPublicationBatch"
  | "finalizeExpiredPublicationBatch"
>;

type ArtifactStoreClient = Pick<ContentAddressedArtifactStore, "put" | "get">
  & Partial<Pick<ContentAddressedArtifactStore, "putPreparedBatch">>;

const concreteArtifactStorePut = ContentAddressedArtifactStore.prototype.put;
const concreteArtifactStoreGet = ContentAddressedArtifactStore.prototype.get;
const concreteArtifactStorePutPreparedBatch =
  ContentAddressedArtifactStore.prototype.putPreparedBatch;
const concreteArtifactStoreWithInventorySnapshot =
  ContentAddressedArtifactStore.prototype.withInventorySnapshot;

function withConcreteArtifactInventorySnapshot<T>(
  store: ContentAddressedArtifactStore,
  work: (snapshot: ArtifactStoreInventorySnapshotV1) => Promise<T>,
): Promise<T> {
  return concreteArtifactStoreWithInventorySnapshot.call(store, work) as Promise<T>;
}

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

export const ARTIFACT_PUBLICATION_BATCH_RECOVERY_RESULT_SCHEMA_V1 =
  "setfarm.artifact-publication-batch-recovery-result.v1" as const;

export type ArtifactPublicationBatchRecoveryMemberResultV1 = Readonly<{
  ordinal: number;
  durabilityTier: number;
  identity: ArtifactIdentity;
  authorityBefore: "indexed" | "reservation";
  observation: "not_observed" | "exact" | "missing" | "corrupt";
  action: "none" | "already_indexed" | "published" | "released" | "quarantined";
  diagnostic?: string;
}>;

export type ArtifactPublicationBatchRecoveryResultV1 = Readonly<{
  schema: typeof ARTIFACT_PUBLICATION_BATCH_RECOVERY_RESULT_SCHEMA_V1;
  batchReservationId: string;
  batchIdentityHash: string;
  planIdentityHash: string;
  observedGeneration: Readonly<{
    leaseToken: string;
    leaseExpiresAt: string;
  }>;
  resolution: "completed" | "released" | "quarantined" | "stale";
  members: readonly ArtifactPublicationBatchRecoveryMemberResultV1[];
  closures: readonly ArtifactClosureEvidenceV1[];
  lifecycle: ArtifactPublicationBatchLifecycle;
  diagnostic?: string;
}>;

export type IndexedArtifactPublisherErrorCode =
  | "ARTIFACT_FILESYSTEM_INDEX_MISMATCH"
  | "ARTIFACT_BATCH_PUBLICATION_INCOMPLETE"
  | "ARTIFACT_INVENTORY_ENTRY_INVALID"
  | "ARTIFACT_INVENTORY_CLOSURE_REJECTED"
  | "ARTIFACT_PUBLICATION_BUSY_TIMEOUT"
  | "ARTIFACT_PRODUCTION_AUTHORITY_REQUIRED";

export const ARTIFACT_INVENTORY_VALIDATION_SCHEMA_V1 =
  "setfarm.artifact-inventory-validation.v1" as const;

export type ArtifactInventoryValidationV1 = Readonly<{
  schema: typeof ARTIFACT_INVENTORY_VALIDATION_SCHEMA_V1;
  status: "verified" | "rejected";
  authority: ArtifactStoreInventoryAuthorityV1;
  finalEntryCount: number;
  artifactCount: number;
  totalBytes: number;
  artifacts: readonly ArtifactIdentity[];
  entryIssues: readonly ArtifactStoreInventoryIssueV1[];
  closures: readonly ArtifactClosureEvidenceV1[];
}>;

export class IndexedArtifactPublisherError extends Error {
  readonly code: IndexedArtifactPublisherErrorCode;
  readonly inventory?: ArtifactInventoryValidationV1;
  override readonly cause?: unknown;

  constructor(
    code: IndexedArtifactPublisherErrorCode,
    message: string,
    options: Readonly<{
      cause?: unknown;
      inventory?: ArtifactInventoryValidationV1;
    }> = {},
  ) {
    super(message);
    this.name = "IndexedArtifactPublisherError";
    this.code = code;
    this.inventory = options.inventory;
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

function validateArtifactInventorySnapshotV1(
  snapshot: ArtifactStoreInventorySnapshotV1,
): ArtifactInventoryValidationV1 {
  // Snapshot construction completes every bounded exact read before this
  // semantic closure pass can begin.
  const evidence = prepareArtifactClosureEvidenceSetV1(snapshot.artifacts);
  const artifacts = snapshot.artifacts.map((stored) =>
    identityForEnvelope(stored.envelope, stored.bytes));
  const registryKinds = new Map<string, "leaf" | "dependency-root">(
    ARTIFACT_CLOSURE_REGISTRY_V1.entries.map((entry) => [
      entry.artifactType,
      entry.kind,
    ]),
  );
  const closures = artifacts.map((artifact) => evaluateArtifactClosureV1({
    evidence,
    root: artifact,
    role: registryKinds.get(artifact.artifactType) === "dependency-root"
      ? "dependency-root"
      : "leaf",
  }));
  const status = snapshot.status === "verified"
    && closures.every((closure) => closure.status === "verified")
    ? "verified" as const
    : "rejected" as const;
  return Object.freeze({
    schema: ARTIFACT_INVENTORY_VALIDATION_SCHEMA_V1,
    status,
    authority: snapshot.authority,
    finalEntryCount: snapshot.finalEntryCount,
    artifactCount: artifacts.length,
    totalBytes: snapshot.totalBytes,
    artifacts: Object.freeze(artifacts),
    entryIssues: snapshot.issues,
    closures: Object.freeze(closures),
  });
}

function rejectedArtifactInventoryError(
  inventory: ArtifactInventoryValidationV1,
  cause?: unknown,
): IndexedArtifactPublisherError {
  const rejectedClosures = inventory.closures
    .filter((closure) => closure.status === "rejected")
    .map((closure) => closure.classification)
    .sort();
  const entryCodes = inventory.entryIssues.map((issue) => issue.code).sort();
  const code: IndexedArtifactPublisherErrorCode = rejectedClosures.length > 0
    ? "ARTIFACT_INVENTORY_CLOSURE_REJECTED"
    : "ARTIFACT_INVENTORY_ENTRY_INVALID";
  const classifications = [...new Set([...entryCodes, ...rejectedClosures])];
  return new IndexedArtifactPublisherError(
    code,
    `${code}: ${classifications.join(",") || "inventory rejected"}`,
    {
      inventory,
      ...(cause === undefined ? {} : { cause }),
    },
  );
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

const indexedArtifactPublisherAuthorityV1 = new WeakMap<object, Readonly<{
  publicationAuthority: "standalone" | "hybrid-required";
}>>();

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
      && !isHybridWriterAuthorityBackedArtifactStore(input.store)
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
    indexedArtifactPublisherAuthorityV1.set(this, Object.freeze({
      publicationAuthority: this.publicationAuthority,
    }));
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

export function inspectIndexedArtifactPublisherAuthorityV1(
  publisher: IndexedArtifactPublisher,
): Readonly<{ publicationAuthority: "standalone" | "hybrid-required" }> {
  if (
    typeof publisher !== "object"
    || publisher === null
    || isProxy(publisher)
    || Object.getPrototypeOf(publisher) !== IndexedArtifactPublisher.prototype
  ) {
    throw new IndexedArtifactPublisherError(
      "ARTIFACT_PRODUCTION_AUTHORITY_REQUIRED",
      "Artifact publication requires one authentic indexed publisher",
    );
  }
  const state = indexedArtifactPublisherAuthorityV1.get(publisher);
  if (!state) {
    throw new IndexedArtifactPublisherError(
      "ARTIFACT_PRODUCTION_AUTHORITY_REQUIRED",
      "Artifact publication requires one authentic indexed publisher",
    );
  }
  return state;
}

export async function scanArtifactInventory(
  store: ContentAddressedArtifactStore,
): Promise<ArtifactIdentity[]> {
  return withConcreteArtifactInventorySnapshot(
    store,
    async (snapshot) => {
      const inventory = validateArtifactInventorySnapshotV1(snapshot);
      if (inventory.status === "rejected") {
        throw rejectedArtifactInventoryError(inventory);
      }
      return [...inventory.artifacts];
    },
  );
}

async function quarantineRejectedArtifactInventory(
  index: Pick<ReturnType<typeof createArtifactIndex>, "quarantineBootstrapInventory">,
  error: IndexedArtifactPublisherError,
  now?: Date,
): Promise<never> {
  if (error.inventory?.status !== "rejected") throw error;
  try {
    await index.quarantineBootstrapInventory({
      code: error.code === "ARTIFACT_INVENTORY_CLOSURE_REJECTED"
        ? "ARTIFACT_INVENTORY_CLOSURE_REJECTED"
        : "ARTIFACT_INVENTORY_ENTRY_INVALID",
      diagnostic: error.message,
      ...(now === undefined ? {} : { now }),
    });
  } catch (quarantineError) {
    throw rejectedArtifactInventoryError(error.inventory, quarantineError);
  }
  throw error;
}

export async function verifyArtifactIndexInventory(input: Readonly<{
  index: Pick<ReturnType<typeof createArtifactIndex>, "verifyInventory">;
  store: ContentAddressedArtifactStore;
}>): Promise<Readonly<{
  capacity: ArtifactCapacityState;
  artifacts: ArtifactIdentity[];
  inventory: ArtifactInventoryValidationV1;
}>> {
  return withConcreteArtifactInventorySnapshot(
    input.store,
    async (snapshot) => {
      const inventory = validateArtifactInventorySnapshotV1(snapshot);
      if (inventory.status === "rejected") {
        throw rejectedArtifactInventoryError(inventory);
      }
      const artifacts = [...inventory.artifacts];
      const capacity = await input.index.verifyInventory({ artifacts });
      return Object.freeze({ capacity, artifacts, inventory });
    },
  );
}

export async function bootstrapArtifactIndex(input: Readonly<{
  index: Pick<
    ReturnType<typeof createArtifactIndex>,
    "bootstrap" | "quarantineBootstrapInventory"
  >;
  store: ContentAddressedArtifactStore;
  quotaBytes?: number;
  maxPayloadBytes?: number;
  now?: Date;
}>): Promise<Readonly<{
  capacity: ArtifactCapacityState;
  artifacts: ArtifactIdentity[];
  inventory: ArtifactInventoryValidationV1;
}>> {
  try {
    return await withConcreteArtifactInventorySnapshot(
      input.store,
      async (snapshot) => {
        const inventory = validateArtifactInventorySnapshotV1(snapshot);
        if (inventory.status === "rejected") {
          throw rejectedArtifactInventoryError(inventory);
        }
        const artifacts = [...inventory.artifacts];
        const capacity = await input.index.bootstrap({
          artifacts,
          ...(input.quotaBytes === undefined ? {} : { quotaBytes: input.quotaBytes }),
          ...(input.maxPayloadBytes === undefined ? {} : { maxPayloadBytes: input.maxPayloadBytes }),
          ...(input.now === undefined ? {} : { now: input.now }),
        });
        return Object.freeze({ capacity, artifacts, inventory });
      },
    );
  } catch (error) {
    if (
      error instanceof ArtifactIndexError
      && error.code === "ARTIFACT_BOOTSTRAP_MISMATCH"
    ) {
      await input.index.quarantineBootstrapInventory({
        code: "ARTIFACT_INDEX_FILESYSTEM_MISMATCH",
        diagnostic: error.message,
        ...(input.now === undefined ? {} : { now: input.now }),
      });
      throw error;
    }
    if (
      !(error instanceof IndexedArtifactPublisherError)
      || error.inventory?.status !== "rejected"
    ) {
      throw error;
    }
    return quarantineRejectedArtifactInventory(input.index, error, input.now);
  }
}

type ArtifactPublicationBatchRecoverySnapshotMember =
  ArtifactPublicationBatchRecoverySnapshot["members"][number];

type ArtifactPublicationBatchMemberObservation = Readonly<{
  member: ArtifactPublicationBatchRecoverySnapshotMember;
  observation: "exact" | "missing" | "corrupt";
  stored?: ArtifactGetResult;
  diagnostic?: string;
}>;

const DETERMINISTIC_CORRUPT_ARTIFACT_STORE_CODES = new Set([
  "ARTIFACT_UNSAFE_FILE_TYPE",
  "ARTIFACT_BOUNDED_READ_EXCEEDED",
  "ARTIFACT_INVALID_ENVELOPE",
  "ARTIFACT_HASH_COLLISION_OR_CORRUPTION",
  "ARTIFACT_NON_CANONICAL_BYTES",
]);

function batchRecoveryStale(error: unknown): boolean {
  return error instanceof ArtifactIndexError && [
    "ARTIFACT_BATCH_LEASE_LOST",
    "ARTIFACT_BATCH_NOT_EXPIRED",
    "ARTIFACT_BATCH_TERMINAL",
  ].includes(error.code);
}

function sameBatchRecoveryGeneration(
  observed: ArtifactPublicationBatchLifecycle,
  current: ArtifactPublicationBatchLifecycle,
): boolean {
  return observed.batchReservationId === current.batchReservationId
    && observed.batchIdentityHash === current.batchIdentityHash
    && observed.state === "active"
    && current.state === "active"
    && typeof observed.leaseToken === "string"
    && observed.leaseToken === current.leaseToken
    && typeof observed.leaseExpiresAt === "string"
    && observed.leaseExpiresAt === current.leaseExpiresAt;
}

async function observeArtifactPublicationBatchMembers(
  store: ArtifactStoreClient,
  snapshot: ArtifactPublicationBatchRecoverySnapshot,
): Promise<readonly ArtifactPublicationBatchMemberObservation[]> {
  return Object.freeze(await Promise.all(snapshot.members.map(async (member) => {
    try {
      const stored = await store.get(member.artifact.hash);
      assertStoredIdentity(stored, member.artifact);
      return Object.freeze({ member, observation: "exact" as const, stored });
    } catch (error) {
      if (error instanceof ArtifactStoreError && error.code === "ARTIFACT_NOT_FOUND") {
        if (member.authority.kind === "reservation") {
          return Object.freeze({ member, observation: "missing" as const });
        }
        return Object.freeze({
          member,
          observation: "corrupt" as const,
          diagnostic: "ARTIFACT_INDEXED_CAS_MISSING",
        });
      }
      if (
        error instanceof IndexedArtifactPublisherError
        || (error instanceof ArtifactStoreError
          && DETERMINISTIC_CORRUPT_ARTIFACT_STORE_CODES.has(error.code))
      ) {
        return Object.freeze({
          member,
          observation: "corrupt" as const,
          diagnostic: error instanceof Error && "code" in error
            ? String(error.code)
            : "ARTIFACT_FILESYSTEM_INDEX_MISMATCH",
        });
      }
      // Root replacement, in-flight file mutation, and other I/O uncertainty
      // are not evidence that immutable bytes are corrupt. Preserve the active
      // aggregate so another bounded recovery pass can fresh-read it.
      throw error;
    }
  })));
}

function evaluateArtifactPublicationBatchRecoveryClosures(
  snapshot: ArtifactPublicationBatchRecoverySnapshot,
  observations: readonly ArtifactPublicationBatchMemberObservation[],
): readonly ArtifactClosureEvidenceV1[] {
  const evidence = prepareArtifactClosureEvidenceSetV1(
    observations.flatMap((item) => item.observation === "exact" && item.stored
      ? [item.stored]
      : []),
  );
  const dependencyRootTypes = new Set<string>(
    ARTIFACT_CLOSURE_REGISTRY_V1.entries
      .filter((entry) => entry.kind === "dependency-root")
      .map((entry) => entry.artifactType),
  );
  return Object.freeze(snapshot.members.map((member) => evaluateArtifactClosureV1({
    evidence,
    root: member.artifact,
    role: dependencyRootTypes.has(member.artifact.artifactType)
      ? "dependency-root"
      : "leaf",
  })));
}

function artifactPublicationBatchRecoveryCorruption(
  snapshot: ArtifactPublicationBatchRecoverySnapshot,
  observations: readonly ArtifactPublicationBatchMemberObservation[],
  closures: readonly ArtifactClosureEvidenceV1[],
): string | undefined {
  const corrupt = observations.find((item) => item.observation === "corrupt");
  if (corrupt) {
    return `${corrupt.diagnostic ?? "ARTIFACT_RECOVERY_CORRUPT"}:${corrupt.member.artifact.hash}`;
  }
  const rejected = closures.find((closure) =>
    closure.status === "rejected"
    && closure.classification !== "ARTIFACT_CLOSURE_ROOT_MISSING"
    && closure.classification !== "ARTIFACT_CLOSURE_DEPENDENCY_MISSING");
  if (rejected) return `${rejected.classification}:${rejected.rootHash}`;

  const planByHash = new Map(snapshot.plan.items.map((item) => [item.identity.hash, item]));
  for (const closure of closures) {
    if (closure.role !== "dependency-root") continue;
    for (const member of closure.members) {
      if (member.role !== "dependency") continue;
      const planned = planByHash.get(member.expected.hash);
      if (
        !planned
        || planned.durabilityTier !== member.durabilityTier
        || (member.observed && !sameIdentity(planned.identity, member.observed))
      ) {
        return `ARTIFACT_CLOSURE_PLAN_MISMATCH:${closure.rootHash}`;
      }
    }
  }
  return undefined;
}

function artifactPublicationBatchRecoveryResult(input: Readonly<{
  snapshot: ArtifactPublicationBatchRecoverySnapshot;
  observed: ArtifactPublicationBatchLifecycle;
  observations?: readonly ArtifactPublicationBatchMemberObservation[];
  actions?: ReadonlyMap<string, ArtifactPublicationBatchRecoveryMemberResultV1["action"]>;
  closures?: readonly ArtifactClosureEvidenceV1[];
  lifecycle: ArtifactPublicationBatchLifecycle;
  resolution: ArtifactPublicationBatchRecoveryResultV1["resolution"];
  diagnostic?: string;
}>): ArtifactPublicationBatchRecoveryResultV1 {
  if (!input.observed.leaseToken || !input.observed.leaseExpiresAt) {
    throw batchIncomplete("expired aggregate observation has no exact lease generation");
  }
  const observations = new Map(
    input.observations?.map((item) => [item.member.artifact.hash, item]) ?? [],
  );
  const members = Object.freeze(input.snapshot.members.map((member) => {
    const observation = observations.get(member.artifact.hash);
    return Object.freeze({
      ordinal: member.ordinal,
      durabilityTier: member.durabilityTier,
      identity: member.artifact,
      authorityBefore: member.authority.kind,
      observation: observation?.observation ?? "not_observed" as const,
      action: input.actions?.get(member.artifact.hash) ?? "none" as const,
      ...(observation?.diagnostic ? { diagnostic: observation.diagnostic } : {}),
    });
  }));
  return Object.freeze({
    schema: ARTIFACT_PUBLICATION_BATCH_RECOVERY_RESULT_SCHEMA_V1,
    batchReservationId: input.snapshot.lifecycle.batchReservationId,
    batchIdentityHash: input.snapshot.lifecycle.batchIdentityHash,
    planIdentityHash: input.snapshot.plan.planIdentityHash,
    observedGeneration: Object.freeze({
      leaseToken: input.observed.leaseToken,
      leaseExpiresAt: input.observed.leaseExpiresAt,
    }),
    resolution: input.resolution,
    members,
    closures: Object.freeze(input.closures ?? []),
    lifecycle: input.lifecycle,
    ...(input.diagnostic ? { diagnostic: input.diagnostic } : {}),
  });
}

async function staleArtifactPublicationBatchRecoveryResult(input: Readonly<{
  index: ArtifactBatchRecoveryIndexClient;
  snapshot: ArtifactPublicationBatchRecoverySnapshot;
  observed: ArtifactPublicationBatchLifecycle;
  observations?: readonly ArtifactPublicationBatchMemberObservation[];
  actions?: ReadonlyMap<string, ArtifactPublicationBatchRecoveryMemberResultV1["action"]>;
  closures?: readonly ArtifactClosureEvidenceV1[];
}>): Promise<ArtifactPublicationBatchRecoveryResultV1> {
  const current = await input.index.getPublicationBatchRecoverySnapshot({
    batchReservationId: input.snapshot.lifecycle.batchReservationId,
  });
  return artifactPublicationBatchRecoveryResult({
    snapshot: input.snapshot,
    observed: input.observed,
    ...(input.observations ? { observations: input.observations } : {}),
    ...(input.actions ? { actions: input.actions } : {}),
    ...(input.closures ? { closures: input.closures } : {}),
    lifecycle: current.lifecycle,
    resolution: "stale",
    diagnostic: "ARTIFACT_BATCH_RECOVERY_STALE_GENERATION",
  });
}

export async function recoverExpiredArtifactPublicationBatches(input: Readonly<{
  index: ArtifactBatchRecoveryIndexClient;
  store: ArtifactStoreClient;
  ownerInstanceId?: string;
  leaseMs?: number;
  maxBatches?: number;
  now?: Date;
}>): Promise<ArtifactPublicationBatchRecoveryResultV1[]> {
  const owner = input.ownerInstanceId
    ?? `artifact-batch-recovery:${process.pid}:${randomUUID()}`;
  const now = input.now ?? new Date();
  const maxBatches = input.maxBatches
    ?? MAX_EXPIRED_ARTIFACT_PUBLICATION_BATCHES_PER_RECOVERY_V1;
  if (
    !Number.isSafeInteger(maxBatches)
    || maxBatches < 1
    || maxBatches > MAX_EXPIRED_ARTIFACT_PUBLICATION_BATCHES_PER_RECOVERY_V1
  ) {
    throw batchIncomplete(
      `recovery batch limit must be 1..${MAX_EXPIRED_ARTIFACT_PUBLICATION_BATCHES_PER_RECOVERY_V1}`,
    );
  }
  const expired = await input.index.listExpiredPublicationBatches(now, maxBatches);
  const results: ArtifactPublicationBatchRecoveryResultV1[] = [];
  for (const observed of expired) {
    if (!observed.leaseToken || !observed.leaseExpiresAt) {
      throw batchIncomplete("expired aggregate listing has no exact lease generation");
    }
    const snapshot = await input.index.getPublicationBatchRecoverySnapshot({
      batchReservationId: observed.batchReservationId,
    });
    if (!sameBatchRecoveryGeneration(observed, snapshot.lifecycle)) {
      results.push(await staleArtifactPublicationBatchRecoveryResult({
        index: input.index,
        snapshot,
        observed,
      }));
      continue;
    }

    const observations = await observeArtifactPublicationBatchMembers(input.store, snapshot);
    const closures = evaluateArtifactPublicationBatchRecoveryClosures(snapshot, observations);
    const corruption = artifactPublicationBatchRecoveryCorruption(
      snapshot,
      observations,
      closures,
    );
    const actions = new Map<
      string,
      ArtifactPublicationBatchRecoveryMemberResultV1["action"]
    >();
    for (const member of snapshot.members) {
      if (member.authority.kind === "indexed") {
        actions.set(member.artifact.hash, "already_indexed");
      }
    }

    if (corruption) {
      try {
        const lifecycle = await input.index.finalizeExpiredPublicationBatch({
          batchReservationId: observed.batchReservationId,
          batchIdentityHash: observed.batchIdentityHash,
          expectedLeaseToken: observed.leaseToken,
          expectedLeaseExpiresAt: observed.leaseExpiresAt,
          resolution: "quarantined",
          diagnostic: corruption,
          now,
        });
        for (const member of snapshot.members) {
          if (member.authority.kind === "reservation") {
            actions.set(member.artifact.hash, "quarantined");
          }
        }
        results.push(artifactPublicationBatchRecoveryResult({
          snapshot,
          observed,
          observations,
          actions,
          closures,
          lifecycle,
          resolution: "quarantined",
          diagnostic: corruption,
        }));
      } catch (error) {
        if (!batchRecoveryStale(error)) throw error;
        results.push(await staleArtifactPublicationBatchRecoveryResult({
          index: input.index,
          snapshot,
          observed,
          observations,
          actions,
          closures,
        }));
      }
      continue;
    }

    const observationByHash = new Map(
      observations.map((item) => [item.member.artifact.hash, item]),
    );
    const closureByRoot = new Map(closures.map((item) => [item.rootHash, item]));
    const publishable = snapshot.members.filter((member) =>
      member.authority.kind === "reservation"
      && observationByHash.get(member.artifact.hash)?.observation === "exact"
      && closureByRoot.get(member.artifact.hash)?.status === "verified");
    const remainder = snapshot.members.filter((member) =>
      member.authority.kind === "reservation"
      && !publishable.some((candidate) => candidate.artifact.hash === member.artifact.hash));
    let operationOffsetMs = 0;
    const nextOperationTime = () => new Date(now.getTime() + (++operationOffsetMs));

    if (publishable.length === 0) {
      try {
        const lifecycle = await input.index.finalizeExpiredPublicationBatch({
          batchReservationId: observed.batchReservationId,
          batchIdentityHash: observed.batchIdentityHash,
          expectedLeaseToken: observed.leaseToken,
          expectedLeaseExpiresAt: observed.leaseExpiresAt,
          resolution: "released",
          diagnostic: "ARTIFACT_BATCH_RECOVERY_NO_CLOSURE_SAFE_BYTES",
          now,
        });
        for (const member of remainder) actions.set(member.artifact.hash, "released");
        results.push(artifactPublicationBatchRecoveryResult({
          snapshot,
          observed,
          observations,
          actions,
          closures,
          lifecycle,
          resolution: "released",
          diagnostic: "ARTIFACT_BATCH_RECOVERY_NO_CLOSURE_SAFE_BYTES",
        }));
      } catch (error) {
        if (!batchRecoveryStale(error)) throw error;
        results.push(await staleArtifactPublicationBatchRecoveryResult({
          index: input.index,
          snapshot,
          observed,
          observations,
          actions,
          closures,
        }));
      }
      continue;
    }

    let leaseToken: string;
    try {
      const adopted = await input.index.adoptExpiredPublicationBatch({
        batchReservationId: observed.batchReservationId,
        batchIdentityHash: observed.batchIdentityHash,
        expectedLeaseToken: observed.leaseToken,
        expectedLeaseExpiresAt: observed.leaseExpiresAt,
        ownerInstanceId: owner,
        leaseMs: input.leaseMs,
        now,
      });
      if (!adopted.leaseToken) throw batchIncomplete("adopted aggregate has no lease token");
      leaseToken = adopted.leaseToken;
    } catch (error) {
      if (!batchRecoveryStale(error)) throw error;
      results.push(await staleArtifactPublicationBatchRecoveryResult({
        index: input.index,
        snapshot,
        observed,
        observations,
        actions,
        closures,
      }));
      continue;
    }

    let stale = false;
    try {
      const publishableHashes = new Set(publishable.map((item) => item.artifact.hash));
      for (const member of snapshot.members) {
        if (!publishableHashes.has(member.artifact.hash)) continue;
        if (member.authority.kind !== "reservation") {
          throw batchIncomplete("publishable recovery member lost its reservation authority");
        }
        const published = await input.index.publishPublicationBatchItem({
          batchReservationId: observed.batchReservationId,
          reservationId: member.authority.reservationId,
          artifact: member.artifact,
          ownerInstanceId: owner,
          leaseToken,
          now: nextOperationTime(),
        });
        if (!sameIdentity(published.artifact, member.artifact)) {
          throw batchIncomplete(`recovery published a different identity for ${member.artifact.hash}`);
        }
        actions.set(member.artifact.hash, "published");
      }
    } catch (error) {
      if (!batchRecoveryStale(error)) throw error;
      stale = true;
    }
    if (stale) {
      results.push(await staleArtifactPublicationBatchRecoveryResult({
        index: input.index,
        snapshot,
        observed,
        observations,
        actions,
        closures,
      }));
      continue;
    }

    if (remainder.length > 0) {
      try {
        const lifecycle = await input.index.finalizeOwnedPublicationBatch({
          batchReservationId: observed.batchReservationId,
          ownerInstanceId: owner,
          leaseToken,
          resolution: "released",
          diagnostic: "ARTIFACT_BATCH_RECOVERY_RELEASED_UNPUBLISHABLE_REMAINDER",
          now: nextOperationTime(),
        });
        for (const member of remainder) actions.set(member.artifact.hash, "released");
        results.push(artifactPublicationBatchRecoveryResult({
          snapshot,
          observed,
          observations,
          actions,
          closures,
          lifecycle,
          resolution: "released",
          diagnostic: "ARTIFACT_BATCH_RECOVERY_RELEASED_UNPUBLISHABLE_REMAINDER",
        }));
      } catch (error) {
        if (!batchRecoveryStale(error)) throw error;
        results.push(await staleArtifactPublicationBatchRecoveryResult({
          index: input.index,
          snapshot,
          observed,
          observations,
          actions,
          closures,
        }));
      }
      continue;
    }

    const finalSnapshot = await input.index.getPublicationBatchRecoverySnapshot({
      batchReservationId: observed.batchReservationId,
    });
    if (finalSnapshot.lifecycle.state !== "completed") {
      throw batchIncomplete("recovery consumed every reservation without completing the aggregate");
    }
    results.push(artifactPublicationBatchRecoveryResult({
      snapshot,
      observed,
      observations,
      actions,
      closures,
      lifecycle: finalSnapshot.lifecycle,
      resolution: "completed",
    }));
  }
  return results;
}

export async function recoverExpiredArtifactPublications(input: Readonly<{
  index: ArtifactSingleRecoveryIndexClient;
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
