import { randomUUID } from "node:crypto";

import type postgres from "postgres";
import { z } from "zod";

import { hashCanonicalJson } from "./canonical-json.js";
import { canonicalJsonBytesBounded } from "./bounded-canonical-json.js";
import {
  ARTIFACT_PUBLICATION_BATCH_IDENTITY_SCHEMA,
  ARTIFACT_PUBLICATION_BATCH_MAX_CANONICAL_BYTES,
  ARTIFACT_PUBLICATION_BATCH_MAX_TOTAL_PRODUCER_IDENTITY_BYTES,
  ArtifactPublicationBatchIdentityItemSchema,
  ArtifactPublicationBatchReservationIdSchema,
  computeArtifactPublicationBatchProducerIdentityByteLength,
  computeArtifactPublicationBatchChildReservationId,
  computeArtifactPublicationBatchIdentityHash,
} from "./artifact-publication-batch-identity.js";
import {
  ArtifactStoreBatchPlanError,
  normalizeArtifactPublicationBatchPlanBindingV1,
  type ArtifactPublicationBatchPlanBindingV1,
} from "./artifact-publication-batch-plan-binding.js";
import {
  CompilerIdentityV1Schema,
  SemanticArtifactProducerV1Schema,
  Sha256Schema,
  type CompilerIdentityV1,
  type SemanticArtifactProducerV1,
} from "./schemas/common-v1.js";
import {
  ProductBuildPacketV3Schema,
  type ProductBuildPacketV3,
} from "./schemas/product-build-packet-v3.js";

type Sql = postgres.Sql;
type TransactionSql = postgres.TransactionSql;

const ArtifactTypeSchema = z.string().min(1).max(200).regex(
  /^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)+$/,
  "Expected a versioned semantic artifact type",
);
const ReservationIdSchema = z.string().min(1).max(200);
const OwnerIdSchema = z.string().min(1).max(200);
const RefKeySchema = z.string().min(1).max(160).regex(/^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)*$/);

const PRODUCT_PACKET_REF_TYPES_V1 = Object.freeze({
  PRODUCT_SPEC: "setfarm.product-spec.v1",
  DESIGN_GRAPH: "setfarm.design-interaction-graph.v1",
  BUILD_TOPOLOGY: "setfarm.build-topology.v1",
  STORY_PLAN: "setfarm.story-plan.v1",
  PRODUCT_BUILD_PACKET: "setfarm.product-build-packet.v1",
  COMPILATION_REPORT: "setfarm.product-compilation-report.v1",
} as const);

const PRODUCT_PACKET_REF_TYPES_V2 = Object.freeze({
  PRODUCT_SPEC: "setfarm.product-spec.v1",
  DESIGN_GRAPH: "setfarm.design-interaction-graph.v1",
  BUILD_TOPOLOGY: "setfarm.build-topology.v1",
  STORY_PLAN: "setfarm.story-plan.v1",
  DESIGN_SOURCE_CLOSURE: "setfarm.design-source-closure.v1",
  PRODUCT_BUILD_PACKET: "setfarm.product-build-packet.v2",
  COMPILATION_REPORT: "setfarm.product-compilation-report.v2",
} as const);

const PRODUCT_PACKET_REF_TYPES_V3_NONE = Object.freeze({
  PRODUCT_SPEC: "setfarm.product-spec.v2",
  BUILD_TOPOLOGY: "setfarm.build-topology.v1",
  STORY_PLAN: "setfarm.story-plan.v2",
  DESIGN_SOURCE_CLOSURE: "setfarm.design-source-closure.v2",
  IMPLEMENTATION_SOURCE_MAP: "setfarm.implementation-source-map.v1",
  PRODUCT_BUILD_PACKET: "setfarm.product-build-packet.v3",
  COMPILATION_REPORT: "setfarm.product-compilation-report.v3",
} as const);

const PRODUCT_PACKET_REF_TYPES_V3_STITCH = Object.freeze({
  ...PRODUCT_PACKET_REF_TYPES_V3_NONE,
  DESIGN_GRAPH: "setfarm.design-interaction-graph.v2",
} as const);

const ArtifactIdentitySchema = z.object({
  hash: Sha256Schema,
  artifactType: ArtifactTypeSchema,
  byteLength: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  producer: SemanticArtifactProducerV1Schema,
}).strict();

export type ArtifactIdentity = z.infer<typeof ArtifactIdentitySchema>;

export type ArtifactIndexErrorCode =
  | "ARTIFACT_BATCH_DUPLICATE_CONFLICT"
  | "ARTIFACT_BATCH_ID_REUSED"
  | "ARTIFACT_BATCH_INCOMPLETE"
  | "ARTIFACT_BATCH_INVALID"
  | "ARTIFACT_BATCH_LEASE_LOST"
  | "ARTIFACT_BATCH_NOT_EXPIRED"
  | "ARTIFACT_BATCH_OPERATION_REQUIRED"
  | "ARTIFACT_BATCH_TERMINAL"
  | "ARTIFACT_BOOTSTRAP_ACTIVE_RESERVATIONS"
  | "ARTIFACT_BOOTSTRAP_MISMATCH"
  | "ARTIFACT_CAPACITY_EXCEEDED"
  | "ARTIFACT_IDENTITY_MISMATCH"
  | "ARTIFACT_INDEX_ACCOUNTING_MISMATCH"
  | "ARTIFACT_INDEX_NOT_READY"
  | "ARTIFACT_PAYLOAD_TOO_LARGE"
  | "ARTIFACT_RESERVATION_BUSY"
  | "ARTIFACT_RESERVATION_ID_REUSED"
  | "ARTIFACT_RESERVATION_LEASE_LOST"
  | "ARTIFACT_RESERVATION_NOT_EXPIRED"
  | "ARTIFACT_RESERVATION_NOT_FOUND"
  | "PRODUCT_PACKET_ARTIFACT_TYPE_INVALID"
  | "PRODUCT_PACKET_ATTEMPT_CONFLICT"
  | "PRODUCT_PACKET_REFS_INCOMPLETE"
  | "PRODUCT_PACKET_RELEASE_MISMATCH"
  | "PRODUCT_PACKET_RUN_NOT_ACTIVE"
  | "PRODUCT_PACKET_RUN_NOT_FOUND"
  | "PRODUCT_PACKET_RUN_NOT_V3"
  | "PRODUCT_PACKET_SEAL_CONFLICT"
  | "RUN_ARTIFACT_REF_CONFLICT";

export class ArtifactIndexError extends Error {
  readonly code: ArtifactIndexErrorCode;

  constructor(code: ArtifactIndexErrorCode, message: string) {
    super(message);
    this.name = "ArtifactIndexError";
    this.code = code;
  }
}

type ArtifactRow = Readonly<{
  artifact_hash: string;
  artifact_type: string;
  byte_length: string | number;
  producer_metadata: unknown;
  created_at: Date | string;
}>;

type CapacityRow = Readonly<{
  quota_bytes: string | number;
  max_payload_bytes: string | number;
  total_bytes: string | number;
  reserved_bytes: string | number;
  state: string;
  reconciled_at: Date | string | null;
  diagnostic: string | null;
  updated_at: Date | string;
}>;

type ReservationRow = Readonly<{
  reservation_id: string;
  artifact_hash: string;
  artifact_type: string;
  byte_length: string | number;
  producer_metadata: unknown;
  state: string;
  owner_instance_id: string | null;
  lease_token: string | null;
  lease_expires_at: Date | string | null;
  diagnostic: string | null;
  published_at: Date | string | null;
  finalized_at: Date | string | null;
  created_at: Date | string;
  updated_at: Date | string;
}>;

type PublicationBatchRow = Readonly<{
  batch_reservation_id: string;
  identity_schema: string;
  batch_identity_hash: string;
  artifact_count: string | number;
  created_by_instance_id: string;
  state: string;
  owner_instance_id: string | null;
  lease_token: string | null;
  lease_expires_at: Date | string | null;
  diagnostic: string | null;
  finalized_at: Date | string | null;
  created_at: Date | string;
  updated_at: Date | string;
}>;

type PublicationBatchItemRow = Readonly<{
  batch_reservation_id: string;
  ordinal: string | number;
  artifact_hash: string;
  artifact_type: string;
  byte_length: string | number;
  producer_metadata: unknown;
  reservation_id: string | null;
  indexed_artifact_hash: string | null;
  created_at: Date | string;
}>;

type PublicationBatchPlanRow = Readonly<{
  batch_reservation_id: string;
  plan_schema: string;
  plan_identity_hash: string;
  item_count: string | number;
  created_at: Date | string;
}>;

type PublicationBatchPlanItemRow = Readonly<{
  batch_reservation_id: string;
  ordinal: string | number;
  artifact_hash: string;
  durability_tier: string | number;
  created_at: Date | string;
}>;

export type IndexedArtifact = Readonly<ArtifactIdentity & { createdAt: string }>;
export type RunArtifactRef = Readonly<{
  runId: string;
  refKey: string;
  artifactHash: string;
  artifactType: string;
  createdAt: string;
}>;
export type ArtifactCapacityState = Readonly<{
  quotaBytes: number;
  maxPayloadBytes: number;
  totalBytes: number;
  reservedBytes: number;
  state: "bootstrap_required" | "ready" | "quarantined";
  reconciledAt?: string;
  diagnostic?: string;
  updatedAt: string;
}>;
export type ArtifactPublicationReservation = Readonly<{
  reservationId: string;
  artifact: ArtifactIdentity;
  state: "reserved" | "published" | "released" | "quarantined";
  ownerInstanceId?: string;
  leaseToken?: string;
  leaseExpiresAt?: string;
  diagnostic?: string;
  publishedAt?: string;
  finalizedAt?: string;
  createdAt: string;
  updatedAt: string;
}>;

export type ArtifactPublicationBatchItem = Readonly<
  | {
      status: "already_published";
      artifact: IndexedArtifact;
      reservationId?: string;
    }
  | {
      status: "reserved";
      artifact: ArtifactIdentity;
      reservation: ArtifactPublicationReservation;
      created: boolean;
    }
>;

export type ArtifactPublicationBatchReservation = Readonly<{
  batchReservationId: string;
  identitySchema: typeof ARTIFACT_PUBLICATION_BATCH_IDENTITY_SCHEMA;
  batchIdentityHash: string;
  batchCreated: boolean;
  state: "active" | "completed" | "released" | "quarantined";
  createdByInstanceId: string;
  ownerInstanceId?: string;
  leaseToken?: string;
  leaseExpiresAt?: string;
  diagnostic?: string;
  finalizedAt?: string;
  status: "already_published" | "partially_published" | "reserved";
  plan: ArtifactPublicationBatchPlanBindingV1;
  items: readonly ArtifactPublicationBatchItem[];
  newlyReservedBytes: number;
  createdAt: string;
  updatedAt: string;
}>;

export type ArtifactPublicationBatchLifecycle = Readonly<{
  batchReservationId: string;
  identitySchema: typeof ARTIFACT_PUBLICATION_BATCH_IDENTITY_SCHEMA;
  batchIdentityHash: string;
  state: "active" | "completed" | "released" | "quarantined";
  createdByInstanceId: string;
  ownerInstanceId?: string;
  leaseToken?: string;
  leaseExpiresAt?: string;
  diagnostic?: string;
  finalizedAt?: string;
  reservations: readonly ArtifactPublicationReservation[];
  createdAt: string;
  updatedAt: string;
}>;

export const ARTIFACT_PUBLICATION_BATCH_RECOVERY_SNAPSHOT_SCHEMA_V1 =
  "setfarm.artifact-publication-batch-recovery-snapshot.v1" as const;

export type ArtifactPublicationBatchRecoverySnapshot = Readonly<{
  schema: typeof ARTIFACT_PUBLICATION_BATCH_RECOVERY_SNAPSHOT_SCHEMA_V1;
  lifecycle: ArtifactPublicationBatchLifecycle;
  plan: ArtifactPublicationBatchPlanBindingV1;
  members: readonly Readonly<{
    ordinal: number;
    durabilityTier: number;
    artifact: ArtifactIdentity;
    authority:
      | Readonly<{ kind: "indexed"; artifactHash: string }>
      | Readonly<{ kind: "reservation"; reservationId: string }>;
  }>[];
}>;

function safeInteger(value: string | number, code: string): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0) throw new Error(code);
  return parsed;
}

function timestamp(value: Date | string): string {
  const parsed = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(parsed.getTime())) throw new Error("ARTIFACT_INDEX_TIMESTAMP_INVALID");
  return parsed.toISOString();
}

function optionalTimestamp(value: Date | string | null): string | undefined {
  return value === null ? undefined : timestamp(value);
}

function jsonObject(value: unknown, code: string): Record<string, unknown> {
  const parsed = typeof value === "string" ? JSON.parse(value) as unknown : value;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error(code);
  return parsed as Record<string, unknown>;
}

function validTime(value?: Date): Date {
  const parsed = value ? new Date(value) : new Date();
  if (!Number.isFinite(parsed.getTime())) throw new TypeError("Artifact index time is invalid");
  return parsed;
}

type ArtifactLeaseTimeAuthority = "database" | "caller-test";

async function artifactLeaseAuthorityNow(
  sql: Sql | TransactionSql,
  callerNow: Date | undefined,
  authority: ArtifactLeaseTimeAuthority,
): Promise<Date> {
  if (authority === "caller-test") {
    const databaseRows = await sql.unsafe<Array<{ database_name: string }>>(
      "SELECT current_database() AS database_name",
    );
    if (!/^setfarm_[a-z0-9_]*test_[a-z0-9_]+$/.test(databaseRows[0]!.database_name)) {
      throw new Error("ARTIFACT_TEST_CLOCK_REQUIRES_ISOLATED_TEST_DATABASE");
    }
    return validTime(callerNow);
  }
  const rows = await sql.unsafe<Array<{ now: Date | string }>>(
    "SELECT clock_timestamp() AS now",
  );
  return validTime(new Date(rows[0]!.now));
}

function leaseDuration(
  value: number | undefined,
  authority: ArtifactLeaseTimeAuthority = "database",
): number {
  const duration = Math.trunc(value ?? 2 * 60_000);
  if (!Number.isFinite(duration)) throw new TypeError("Artifact reservation lease is invalid");
  const minimum = authority === "caller-test" ? 100 : 5_000;
  return Math.max(minimum, Math.min(duration, 30 * 60_000));
}

function identityFromRow(
  row: ArtifactRow | ReservationRow | PublicationBatchItemRow,
): ArtifactIdentity {
  return ArtifactIdentitySchema.parse({
    hash: row.artifact_hash,
    artifactType: row.artifact_type,
    byteLength: safeInteger(row.byte_length, "ARTIFACT_INDEX_BYTE_LENGTH_INVALID"),
    producer: SemanticArtifactProducerV1Schema.parse(jsonObject(
      row.producer_metadata,
      "ARTIFACT_INDEX_PRODUCER_INVALID",
    )),
  });
}

function batchIdentityFromRow(row: PublicationBatchItemRow): ArtifactIdentity {
  return ArtifactPublicationBatchIdentityItemSchema.parse({
    hash: row.artifact_hash,
    artifactType: row.artifact_type,
    byteLength: safeInteger(row.byte_length, "ARTIFACT_INDEX_BYTE_LENGTH_INVALID"),
    producer: jsonObject(row.producer_metadata, "ARTIFACT_INDEX_PRODUCER_INVALID"),
  });
}

function sameProducer(left: SemanticArtifactProducerV1, right: SemanticArtifactProducerV1): boolean {
  return left.pass === right.pass
    && left.codeSha === right.codeSha
    && left.model === right.model
    && left.promptHash === right.promptHash
    && JSON.stringify(Object.entries(left.toolVersions).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0))
      === JSON.stringify(Object.entries(right.toolVersions).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0));
}

function sameIdentity(left: ArtifactIdentity, right: ArtifactIdentity): boolean {
  return left.hash === right.hash
    && left.artifactType === right.artifactType
    && left.byteLength === right.byteLength
    && sameProducer(left.producer, right.producer);
}

function assertIdentity(actual: ArtifactIdentity, expected: ArtifactIdentity): void {
  if (!sameIdentity(actual, expected)) {
    throw new ArtifactIndexError(
      "ARTIFACT_IDENTITY_MISMATCH",
      `Artifact ${expected.hash} metadata differs from its immutable index identity`,
    );
  }
}

const MAX_ARTIFACT_PUBLICATION_BATCH_OCCURRENCES = 9;

function normalizePublicationBatchArtifacts(
  input: unknown,
): Readonly<{
  artifacts: readonly ArtifactIdentity[];
  batchIdentityHash: string;
}> {
  let snapshot: unknown;
  try {
    snapshot = JSON.parse(canonicalJsonBytesBounded(input, {
      maxBytes: ARTIFACT_PUBLICATION_BATCH_MAX_CANONICAL_BYTES,
      maxDepth: 16,
      maxNodes: 40_000,
      maxContainerEntries: 4_096,
      maxWorkUnits: 16 * 1024 * 1024,
    }).toString("utf8")) as unknown;
  } catch {
    throw new ArtifactIndexError(
      "ARTIFACT_BATCH_INVALID",
      "Artifact publication batch is not bounded canonical input",
    );
  }
  if (
    !Array.isArray(snapshot)
    || snapshot.length < 1
    || snapshot.length > MAX_ARTIFACT_PUBLICATION_BATCH_OCCURRENCES
  ) {
    throw new ArtifactIndexError(
      "ARTIFACT_BATCH_INVALID",
      `Artifact publication batch must contain 1..${MAX_ARTIFACT_PUBLICATION_BATCH_OCCURRENCES} occurrences`,
    );
  }
  const byHash = new Map<string, ArtifactIdentity>();
  for (let index = 0; index < snapshot.length; index += 1) {
    if (!Object.hasOwn(snapshot, index)) {
      throw new ArtifactIndexError(
        "ARTIFACT_BATCH_INVALID",
        "Artifact publication batch must be a dense array",
      );
    }
    let artifact: ArtifactIdentity;
    try {
      artifact = ArtifactPublicationBatchIdentityItemSchema.parse(snapshot[index]);
    } catch {
      throw new ArtifactIndexError(
        "ARTIFACT_BATCH_INVALID",
        `Artifact publication batch item ${index} is invalid`,
      );
    }
    const existing = byHash.get(artifact.hash);
    if (existing && !sameIdentity(existing, artifact)) {
      throw new ArtifactIndexError(
        "ARTIFACT_BATCH_DUPLICATE_CONFLICT",
        `Artifact ${artifact.hash} appears with conflicting immutable metadata`,
      );
    }
    byHash.set(artifact.hash, artifact);
  }
  const artifacts = Object.freeze(
    [...byHash.values()].sort((left, right) => left.hash < right.hash ? -1 : left.hash > right.hash ? 1 : 0),
  );
  const totalProducerIdentityBytes = artifacts.reduce(
    (total, artifact) => total
      + computeArtifactPublicationBatchProducerIdentityByteLength(artifact.producer),
    0,
  );
  if (totalProducerIdentityBytes > ARTIFACT_PUBLICATION_BATCH_MAX_TOTAL_PRODUCER_IDENTITY_BYTES) {
    throw new ArtifactIndexError(
      "ARTIFACT_BATCH_INVALID",
      "Artifact publication batch producer identities exceed their aggregate byte budget",
    );
  }
  return Object.freeze({
    artifacts,
    batchIdentityHash: computeArtifactPublicationBatchIdentityHash(artifacts),
  });
}

function addBatchBytes(total: number, byteLength: number): number {
  if (!Number.isSafeInteger(byteLength) || byteLength <= 0 || total > Number.MAX_SAFE_INTEGER - byteLength) {
    throw new ArtifactIndexError(
      "ARTIFACT_BATCH_INVALID",
      "Artifact publication batch byte total is not a positive safe integer",
    );
  }
  return total + byteLength;
}

function publicationBatchStatus(
  items: readonly ArtifactPublicationBatchItem[],
): ArtifactPublicationBatchReservation["status"] {
  const reserved = items.filter((item) => item.status === "reserved").length;
  if (reserved === 0) return "already_published";
  if (reserved === items.length) return "reserved";
  return "partially_published";
}

function mapArtifact(row: ArtifactRow): IndexedArtifact {
  return Object.freeze({ ...identityFromRow(row), createdAt: timestamp(row.created_at) });
}

function mapCapacity(row: CapacityRow): ArtifactCapacityState {
  const state = z.enum(["bootstrap_required", "ready", "quarantined"]).parse(row.state);
  return Object.freeze({
    quotaBytes: safeInteger(row.quota_bytes, "ARTIFACT_CAPACITY_QUOTA_INVALID"),
    maxPayloadBytes: safeInteger(row.max_payload_bytes, "ARTIFACT_CAPACITY_PAYLOAD_INVALID"),
    totalBytes: safeInteger(row.total_bytes, "ARTIFACT_CAPACITY_TOTAL_INVALID"),
    reservedBytes: safeInteger(row.reserved_bytes, "ARTIFACT_CAPACITY_RESERVED_INVALID"),
    state,
    ...(optionalTimestamp(row.reconciled_at) ? { reconciledAt: optionalTimestamp(row.reconciled_at) } : {}),
    ...(row.diagnostic ? { diagnostic: row.diagnostic } : {}),
    updatedAt: timestamp(row.updated_at),
  });
}

function mapReservation(row: ReservationRow): ArtifactPublicationReservation {
  const state = z.enum(["reserved", "published", "released", "quarantined"]).parse(row.state);
  return Object.freeze({
    reservationId: row.reservation_id,
    artifact: identityFromRow(row),
    state,
    ...(row.owner_instance_id ? { ownerInstanceId: row.owner_instance_id } : {}),
    ...(row.lease_token ? { leaseToken: row.lease_token } : {}),
    ...(optionalTimestamp(row.lease_expires_at) ? { leaseExpiresAt: optionalTimestamp(row.lease_expires_at) } : {}),
    ...(row.diagnostic ? { diagnostic: row.diagnostic } : {}),
    ...(optionalTimestamp(row.published_at) ? { publishedAt: optionalTimestamp(row.published_at) } : {}),
    ...(optionalTimestamp(row.finalized_at) ? { finalizedAt: optionalTimestamp(row.finalized_at) } : {}),
    createdAt: timestamp(row.created_at),
    updatedAt: timestamp(row.updated_at),
  });
}

function mapPublicationBatchLifecycle(row: PublicationBatchRow) {
  const state = z.enum(["active", "completed", "released", "quarantined"]).parse(row.state);
  return Object.freeze({
    state,
    createdByInstanceId: OwnerIdSchema.parse(row.created_by_instance_id),
    ...(row.owner_instance_id ? { ownerInstanceId: OwnerIdSchema.parse(row.owner_instance_id) } : {}),
    ...(row.lease_token ? { leaseToken: z.string().min(1).max(200).parse(row.lease_token) } : {}),
    ...(optionalTimestamp(row.lease_expires_at)
      ? { leaseExpiresAt: optionalTimestamp(row.lease_expires_at) }
      : {}),
    ...(row.diagnostic ? { diagnostic: row.diagnostic } : {}),
    ...(optionalTimestamp(row.finalized_at) ? { finalizedAt: optionalTimestamp(row.finalized_at) } : {}),
    createdAt: timestamp(row.created_at),
    updatedAt: timestamp(row.updated_at),
  });
}

function assertNotBatchChildReservation(reservationId: string): void {
  if (reservationId.startsWith("APRB_")) {
    throw new ArtifactIndexError(
      "ARTIFACT_BATCH_OPERATION_REQUIRED",
      "Deterministic batch children require aggregate publication APIs",
    );
  }
}

function mapPublicationBatchAggregateLifecycle(
  batch: PublicationBatchRow,
  reservations: readonly ReservationRow[],
): ArtifactPublicationBatchLifecycle {
  if (batch.identity_schema !== ARTIFACT_PUBLICATION_BATCH_IDENTITY_SCHEMA) {
    throw new Error("ARTIFACT_BATCH_IDENTITY_SCHEMA_INVALID");
  }
  return Object.freeze({
    batchReservationId: batch.batch_reservation_id,
    identitySchema: ARTIFACT_PUBLICATION_BATCH_IDENTITY_SCHEMA,
    batchIdentityHash: Sha256Schema.parse(batch.batch_identity_hash),
    ...mapPublicationBatchLifecycle(batch),
    reservations: Object.freeze(reservations.map(mapReservation)),
  });
}

async function lockPublicationBatchAggregate(
  sql: TransactionSql,
  batchReservationId: string,
): Promise<Readonly<{
  batch: PublicationBatchRow;
  items: readonly PublicationBatchItemRow[];
  reservations: readonly ReservationRow[];
}>> {
  const batchRows = await sql.unsafe<PublicationBatchRow[]>(
    `SELECT * FROM artifact_publication_batches
      WHERE batch_reservation_id = $1
      FOR UPDATE`,
    [batchReservationId],
  );
  const batch = batchRows[0];
  if (!batch) {
    throw new ArtifactIndexError(
      "ARTIFACT_BATCH_INCOMPLETE",
      `Unknown artifact publication batch ${batchReservationId}`,
    );
  }
  const items = await sql.unsafe<PublicationBatchItemRow[]>(
    `SELECT * FROM artifact_publication_batch_items
      WHERE batch_reservation_id = $1
      ORDER BY ordinal
      FOR UPDATE`,
    [batchReservationId],
  );
  if (items.length !== safeInteger(batch.artifact_count, "ARTIFACT_BATCH_COUNT_INVALID")) {
    throw new ArtifactIndexError(
      "ARTIFACT_BATCH_INCOMPLETE",
      `Artifact publication batch ${batchReservationId} membership is incomplete`,
    );
  }
  const reservationIds = items.flatMap((item) => item.reservation_id ? [item.reservation_id] : []);
  const reservations = reservationIds.length === 0
    ? []
    : await sql.unsafe<ReservationRow[]>(
        `SELECT * FROM artifact_publication_reservations
          WHERE reservation_id = ANY($1::text[])
          ORDER BY reservation_id
          FOR UPDATE`,
        [reservationIds],
      );
  if (reservations.length !== reservationIds.length) {
    throw new ArtifactIndexError(
      "ARTIFACT_BATCH_INCOMPLETE",
      `Artifact publication batch ${batchReservationId} child set is incomplete`,
    );
  }
  return Object.freeze({ batch, items: Object.freeze(items), reservations: Object.freeze(reservations) });
}

async function lockPublicationBatchPlan(
  sql: TransactionSql,
  batchReservationId: string,
): Promise<Readonly<{
  plan: PublicationBatchPlanRow;
  items: readonly PublicationBatchPlanItemRow[];
}>> {
  const planRows = await sql.unsafe<PublicationBatchPlanRow[]>(
    `SELECT * FROM artifact_publication_batch_plans
      WHERE batch_reservation_id = $1
      FOR UPDATE`,
    [batchReservationId],
  );
  const plan = planRows[0];
  if (!plan) {
    throw new ArtifactIndexError(
      "ARTIFACT_BATCH_INCOMPLETE",
      `Artifact publication batch ${batchReservationId} has no durable recovery plan`,
    );
  }
  const items = await sql.unsafe<PublicationBatchPlanItemRow[]>(
    `SELECT * FROM artifact_publication_batch_plan_items
      WHERE batch_reservation_id = $1
      ORDER BY ordinal
      FOR UPDATE`,
    [batchReservationId],
  );
  return Object.freeze({ plan, items: Object.freeze(items) });
}

function mapPublicationBatchPlanBinding(
  batch: PublicationBatchRow,
  membershipRows: readonly PublicationBatchItemRow[],
  planRow: PublicationBatchPlanRow,
  planItemRows: readonly PublicationBatchPlanItemRow[],
): ArtifactPublicationBatchPlanBindingV1 {
  const batchReservationId = batch.batch_reservation_id;
  try {
    const artifactCount = safeInteger(batch.artifact_count, "ARTIFACT_BATCH_COUNT_INVALID");
    const itemCount = safeInteger(planRow.item_count, "ARTIFACT_BATCH_PLAN_COUNT_INVALID");
    if (
      planRow.batch_reservation_id !== batchReservationId
      || itemCount !== artifactCount
      || membershipRows.length !== artifactCount
      || planItemRows.length !== artifactCount
      || timestamp(planRow.created_at) !== timestamp(batch.created_at)
    ) {
      throw new Error("ARTIFACT_BATCH_PLAN_HEADER_MISMATCH");
    }

    const membershipByHash = new Map<string, ArtifactIdentity>();
    for (const row of membershipRows) {
      const identity = batchIdentityFromRow(row);
      if (
        row.batch_reservation_id !== batchReservationId
        || membershipByHash.has(identity.hash)
      ) {
        throw new Error("ARTIFACT_BATCH_PLAN_MEMBERSHIP_INVALID");
      }
      membershipByHash.set(identity.hash, identity);
    }

    const items = planItemRows.map((row, ordinal) => {
      const identity = membershipByHash.get(row.artifact_hash);
      if (
        row.batch_reservation_id !== batchReservationId
        || safeInteger(row.ordinal, "ARTIFACT_BATCH_PLAN_ORDINAL_INVALID") !== ordinal
        || timestamp(row.created_at) !== timestamp(planRow.created_at)
        || !identity
      ) {
        throw new Error("ARTIFACT_BATCH_PLAN_ITEM_MISMATCH");
      }
      return Object.freeze({
        durabilityTier: safeInteger(
          row.durability_tier,
          "ARTIFACT_BATCH_PLAN_TIER_INVALID",
        ),
        identity,
      });
    });
    if (new Set(planItemRows.map((row) => row.artifact_hash)).size !== artifactCount) {
      throw new Error("ARTIFACT_BATCH_PLAN_MEMBERSHIP_INVALID");
    }
    return normalizeArtifactPublicationBatchPlanBindingV1({
      schema: planRow.plan_schema,
      planIdentityHash: planRow.plan_identity_hash,
      items,
    });
  } catch (error) {
    if (error instanceof ArtifactIndexError) throw error;
    const detail = error instanceof ArtifactStoreBatchPlanError
      ? error.message
      : error instanceof Error ? error.message : String(error);
    throw new ArtifactIndexError(
      "ARTIFACT_BATCH_INCOMPLETE",
      `Artifact publication batch ${batchReservationId} recovery plan is invalid: ${detail}`,
    );
  }
}

function normalizePublicationBatchPlanInput(
  input: unknown,
  artifacts: readonly ArtifactIdentity[],
): ArtifactPublicationBatchPlanBindingV1 {
  let plan: ArtifactPublicationBatchPlanBindingV1;
  try {
    plan = normalizeArtifactPublicationBatchPlanBindingV1(input);
  } catch (error) {
    const detail = error instanceof ArtifactStoreBatchPlanError ? `: ${error.message}` : "";
    throw new ArtifactIndexError(
      "ARTIFACT_BATCH_INVALID",
      `Artifact publication batch recovery plan is invalid${detail}`,
    );
  }
  if (plan.items.length !== artifacts.length) {
    throw new ArtifactIndexError(
      "ARTIFACT_BATCH_INVALID",
      "Artifact publication batch recovery plan does not cover its exact identity set",
    );
  }
  const artifactsByHash = new Map(artifacts.map((artifact) => [artifact.hash, artifact]));
  for (const item of plan.items) {
    const artifact = artifactsByHash.get(item.identity.hash);
    if (!artifact || !sameIdentity(artifact, item.identity)) {
      throw new ArtifactIndexError(
        "ARTIFACT_BATCH_INVALID",
        "Artifact publication batch recovery plan differs from its immutable identity set",
      );
    }
  }
  return plan;
}

function samePublicationBatchPlan(
  left: ArtifactPublicationBatchPlanBindingV1,
  right: ArtifactPublicationBatchPlanBindingV1,
): boolean {
  return left.schema === right.schema
    && left.planIdentityHash === right.planIdentityHash
    && left.items.length === right.items.length
    && left.items.every((item, index) => {
      const candidate = right.items[index];
      return candidate !== undefined
        && item.durabilityTier === candidate.durabilityTier
        && sameIdentity(item.identity, candidate.identity);
    });
}

async function lockCapacity(sql: TransactionSql): Promise<CapacityRow> {
  const rows = await sql.unsafe<CapacityRow[]>(
    "SELECT * FROM artifact_capacity WHERE capacity_key = 'semantic-artifacts' FOR UPDATE",
  );
  if (rows.length !== 1) throw new Error("ARTIFACT_CAPACITY_SINGLETON_INVALID");
  return rows[0]!;
}

async function readArtifact(sql: Sql | TransactionSql, hash: string): Promise<ArtifactRow | undefined> {
  const rows = await sql.unsafe<ArtifactRow[]>(
    "SELECT * FROM semantic_artifacts WHERE artifact_hash = $1",
    [hash],
  );
  return rows[0];
}

function capacityInput(value: number | undefined, fallback: number, label: string): number {
  const parsed = value ?? fallback;
  if (!Number.isSafeInteger(parsed) || parsed <= 0) throw new TypeError(`${label} must be a positive safe integer`);
  return parsed;
}

function createArtifactIndexWithLeaseTimeAuthority(
  sql: Sql,
  leaseTimeAuthority: ArtifactLeaseTimeAuthority,
) {
  return Object.freeze({
    async getCapacity(): Promise<ArtifactCapacityState> {
      const rows = await sql.unsafe<CapacityRow[]>(
        "SELECT * FROM artifact_capacity WHERE capacity_key = 'semantic-artifacts'",
      );
      if (rows.length !== 1) throw new Error("ARTIFACT_CAPACITY_SINGLETON_INVALID");
      return mapCapacity(rows[0]!);
    },

    async getPublicationBatchLifecycle(input: Readonly<{
      batchReservationId: string;
    }>): Promise<ArtifactPublicationBatchLifecycle> {
      const batchReservationId = ArtifactPublicationBatchReservationIdSchema.parse(
        input.batchReservationId,
      );
      return sql.begin(async (transaction) => {
        // Match every mutating batch path's capacity -> aggregate lock order.
        // The returned lifecycle is therefore one coherent post-commit snapshot.
        await lockCapacity(transaction);
        const aggregate = await lockPublicationBatchAggregate(transaction, batchReservationId);
        return mapPublicationBatchAggregateLifecycle(
          aggregate.batch,
          aggregate.reservations,
        );
      }) as Promise<ArtifactPublicationBatchLifecycle>;
    },

    async getPublicationBatchRecoverySnapshot(input: Readonly<{
      batchReservationId: string;
    }>): Promise<ArtifactPublicationBatchRecoverySnapshot> {
      const batchReservationId = ArtifactPublicationBatchReservationIdSchema.parse(
        input.batchReservationId,
      );
      return sql.begin(async (transaction) => {
        // Keep the same capacity -> aggregate -> immutable plan lock order as
        // publication and recovery mutations.
        await lockCapacity(transaction);
        const aggregate = await lockPublicationBatchAggregate(transaction, batchReservationId);
        const durablePlan = await lockPublicationBatchPlan(transaction, batchReservationId);
        const plan = mapPublicationBatchPlanBinding(
          aggregate.batch,
          aggregate.items,
          durablePlan.plan,
          durablePlan.items,
        );
        const membershipByHash = new Map(
          aggregate.items.map((item) => [item.artifact_hash, item]),
        );
        const reservationIds = new Set(
          aggregate.reservations.map((reservation) => reservation.reservation_id),
        );
        const members = plan.items.map((item, ordinal) => {
          const membership = membershipByHash.get(item.identity.hash);
          if (!membership) {
            throw new ArtifactIndexError(
              "ARTIFACT_BATCH_INCOMPLETE",
              `Artifact publication batch ${batchReservationId} recovery membership is incomplete`,
            );
          }
          let authority: ArtifactPublicationBatchRecoverySnapshot["members"][number]["authority"];
          if (
            membership.indexed_artifact_hash === item.identity.hash
            && membership.reservation_id === null
          ) {
            authority = Object.freeze({
              kind: "indexed" as const,
              artifactHash: item.identity.hash,
            });
          } else if (
            membership.indexed_artifact_hash === null
            && membership.reservation_id !== null
            && reservationIds.has(membership.reservation_id)
          ) {
            authority = Object.freeze({
              kind: "reservation" as const,
              reservationId: membership.reservation_id,
            });
          } else {
            throw new ArtifactIndexError(
              "ARTIFACT_BATCH_INCOMPLETE",
              `Artifact publication batch ${batchReservationId} recovery authority is invalid for ${item.identity.hash}`,
            );
          }
          return Object.freeze({
            ordinal,
            durabilityTier: item.durabilityTier,
            artifact: item.identity,
            authority,
          });
        });
        return Object.freeze({
          schema: ARTIFACT_PUBLICATION_BATCH_RECOVERY_SNAPSHOT_SCHEMA_V1,
          lifecycle: mapPublicationBatchAggregateLifecycle(
            aggregate.batch,
            aggregate.reservations,
          ),
          plan,
          members: Object.freeze(members),
        });
      }) as Promise<ArtifactPublicationBatchRecoverySnapshot>;
    },

    async getArtifact(hash: string): Promise<IndexedArtifact | undefined> {
      const parsedHash = Sha256Schema.parse(hash);
      const row = await readArtifact(sql, parsedHash);
      return row ? mapArtifact(row) : undefined;
    },

    async getRunArtifactRef(
      runIdInput: string,
      refKeyInput: string,
    ): Promise<RunArtifactRef | undefined> {
      const runId = z.string().min(1).max(200).parse(runIdInput);
      const refKey = RefKeySchema.parse(refKeyInput);
      const rows = await sql.unsafe<Array<{
        run_id: string;
        ref_key: string;
        artifact_hash: string;
        artifact_type: string;
        created_at: Date | string;
      }>>(
        `SELECT r.run_id, r.ref_key, r.artifact_hash, a.artifact_type, r.created_at
           FROM run_artifact_refs r
           JOIN semantic_artifacts a ON a.artifact_hash = r.artifact_hash
          WHERE r.run_id = $1 AND r.ref_key = $2`,
        [runId, refKey],
      );
      const row = rows[0];
      return row ? Object.freeze({
        runId: row.run_id,
        refKey: row.ref_key,
        artifactHash: Sha256Schema.parse(row.artifact_hash),
        artifactType: ArtifactTypeSchema.parse(row.artifact_type),
        createdAt: timestamp(row.created_at),
      }) : undefined;
    },

    async listRunArtifactRefs(runIdInput: string): Promise<RunArtifactRef[]> {
      const runId = z.string().min(1).max(200).parse(runIdInput);
      const rows = await sql.unsafe<Array<{
        run_id: string;
        ref_key: string;
        artifact_hash: string;
        artifact_type: string;
        created_at: Date | string;
      }>>(
        `SELECT r.run_id, r.ref_key, r.artifact_hash, a.artifact_type, r.created_at
           FROM run_artifact_refs r
           JOIN semantic_artifacts a ON a.artifact_hash = r.artifact_hash
          WHERE r.run_id = $1
          ORDER BY r.ref_key`,
        [runId],
      );
      return rows.map((row) => Object.freeze({
        runId: row.run_id,
        refKey: RefKeySchema.parse(row.ref_key),
        artifactHash: Sha256Schema.parse(row.artifact_hash),
        artifactType: ArtifactTypeSchema.parse(row.artifact_type),
        createdAt: timestamp(row.created_at),
      }));
    },

    async verifyInventory(input: Readonly<{
      artifacts: readonly ArtifactIdentity[];
    }>): Promise<ArtifactCapacityState> {
      const artifacts = input.artifacts.map((artifact) => ArtifactIdentitySchema.parse(artifact));
      const inventory = new Map<string, ArtifactIdentity>();
      for (const artifact of artifacts) {
        if (inventory.has(artifact.hash)) {
          throw new ArtifactIndexError(
            "ARTIFACT_BOOTSTRAP_MISMATCH",
            `Artifact verification inventory repeats ${artifact.hash}`,
          );
        }
        inventory.set(artifact.hash, artifact);
      }
      return sql.begin(async (transaction) => {
        const capacityRow = await lockCapacity(transaction);
        const capacity = mapCapacity(capacityRow);
        if (capacity.state !== "ready") {
          throw new ArtifactIndexError(
            "ARTIFACT_INDEX_NOT_READY",
            `Artifact index state is ${capacity.state}`,
          );
        }
        const rows = await transaction.unsafe<ArtifactRow[]>(
          "SELECT * FROM semantic_artifacts ORDER BY artifact_hash",
        );
        if (rows.length !== inventory.size) {
          throw new ArtifactIndexError(
            "ARTIFACT_BOOTSTRAP_MISMATCH",
            "Artifact filesystem and immutable index contain different hash counts",
          );
        }
        let indexedBytes = 0;
        for (const row of rows) {
          const expected = inventory.get(row.artifact_hash);
          if (!expected) {
            throw new ArtifactIndexError(
              "ARTIFACT_BOOTSTRAP_MISMATCH",
              `Indexed artifact ${row.artifact_hash} is absent from the filesystem inventory`,
            );
          }
          assertIdentity(identityFromRow(row), expected);
          indexedBytes += safeInteger(row.byte_length, "ARTIFACT_INDEX_BYTE_LENGTH_INVALID");
        }
        const reserved = await transaction.unsafe<Array<{ reserved_bytes: string | number }>>(
          `SELECT COALESCE(SUM(byte_length), 0)::bigint AS reserved_bytes
             FROM artifact_publication_reservations
            WHERE state = 'reserved'`,
        );
        const actualReserved = safeInteger(
          reserved[0]?.reserved_bytes ?? 0,
          "ARTIFACT_CAPACITY_RESERVED_INVALID",
        );
        if (capacity.totalBytes !== indexedBytes || capacity.reservedBytes !== actualReserved) {
          throw new ArtifactIndexError(
            "ARTIFACT_INDEX_ACCOUNTING_MISMATCH",
            "Artifact capacity counters differ from immutable index and live reservations",
          );
        }
        return capacity;
      }) as Promise<ArtifactCapacityState>;
    },

    async bootstrap(input: Readonly<{
      artifacts: readonly ArtifactIdentity[];
      quotaBytes?: number;
      maxPayloadBytes?: number;
      now?: Date;
    }>): Promise<ArtifactCapacityState> {
      const artifacts = input.artifacts.map((artifact) => ArtifactIdentitySchema.parse(artifact));
      const byHash = new Map<string, ArtifactIdentity>();
      let totalBytes = 0;
      for (const artifact of artifacts) {
        const existing = byHash.get(artifact.hash);
        if (existing) {
          assertIdentity(existing, artifact);
          throw new ArtifactIndexError(
            "ARTIFACT_BOOTSTRAP_MISMATCH",
            `Artifact bootstrap inventory repeats ${artifact.hash}`,
          );
        }
        byHash.set(artifact.hash, artifact);
        totalBytes += artifact.byteLength;
        if (!Number.isSafeInteger(totalBytes)) throw new TypeError("Artifact bootstrap total exceeds safe integer range");
      }
      const now = validTime(input.now);
      const result = await sql.begin(async (transaction) => {
        const capacity = await lockCapacity(transaction);
        const active = await transaction.unsafe<Array<{ reservation_id: string }>>(
          "SELECT reservation_id FROM artifact_publication_reservations WHERE state = 'reserved' LIMIT 1",
        );
        if (active[0]) {
          throw new ArtifactIndexError(
            "ARTIFACT_BOOTSTRAP_ACTIVE_RESERVATIONS",
            "Artifact bootstrap requires all publication reservations to be settled",
          );
        }
        const quotaBytes = capacityInput(
          input.quotaBytes,
          safeInteger(capacity.quota_bytes, "ARTIFACT_CAPACITY_QUOTA_INVALID"),
          "quotaBytes",
        );
        const maxPayloadBytes = capacityInput(
          input.maxPayloadBytes,
          safeInteger(capacity.max_payload_bytes, "ARTIFACT_CAPACITY_PAYLOAD_INVALID"),
          "maxPayloadBytes",
        );
        if (maxPayloadBytes > quotaBytes || totalBytes > quotaBytes) {
          throw new ArtifactIndexError(
            "ARTIFACT_CAPACITY_EXCEEDED",
            "Artifact bootstrap inventory exceeds the configured capacity",
          );
        }
        const rows = await transaction.unsafe<ArtifactRow[]>(
          "SELECT * FROM semantic_artifacts ORDER BY artifact_hash FOR UPDATE",
        );
        const indexed = new Map(rows.map((row) => [row.artifact_hash, row]));
        let mismatch: string | undefined;
        for (const row of rows) {
          const observed = byHash.get(row.artifact_hash);
          if (!observed) {
            mismatch = `Indexed artifact ${row.artifact_hash} is absent from the filesystem inventory`;
            break;
          }
          if (!sameIdentity(identityFromRow(row), observed)) {
            mismatch = `Indexed artifact ${row.artifact_hash} differs from the filesystem inventory identity`;
            break;
          }
        }
        if (mismatch) {
          await transaction.unsafe(
            `UPDATE artifact_capacity
                SET state = 'quarantined', reconciled_at = $1,
                    diagnostic = $2, updated_at = $1
              WHERE capacity_key = 'semantic-artifacts'`,
            [now, mismatch.slice(0, 4_000)],
          );
          return { status: "mismatch" as const, diagnostic: mismatch };
        }
        for (const artifact of artifacts) {
          if (indexed.has(artifact.hash)) continue;
          await transaction.unsafe(
            `INSERT INTO semantic_artifacts (
               artifact_hash, artifact_type, byte_length, producer_metadata, created_at
             ) VALUES ($1, $2, $3, $4::text::jsonb, $5)`,
            [
              artifact.hash,
              artifact.artifactType,
              artifact.byteLength,
              JSON.stringify(artifact.producer),
              now,
            ],
          );
        }
        const updated = await transaction.unsafe<CapacityRow[]>(
          `UPDATE artifact_capacity
              SET quota_bytes = $1, max_payload_bytes = $2,
                  total_bytes = $3, reserved_bytes = 0,
                  state = 'ready', reconciled_at = $4,
                  diagnostic = NULL, updated_at = $4
            WHERE capacity_key = 'semantic-artifacts'
            RETURNING *`,
          [quotaBytes, maxPayloadBytes, totalBytes, now],
        );
        return { status: "ready" as const, capacity: mapCapacity(updated[0]!) };
      }) as Readonly<
        | { status: "mismatch"; diagnostic: string }
        | { status: "ready"; capacity: ArtifactCapacityState }
      >;
      if (result.status === "mismatch") {
        throw new ArtifactIndexError("ARTIFACT_BOOTSTRAP_MISMATCH", result.diagnostic);
      }
      return result.capacity;
    },

    async reservePublicationBatch(input: Readonly<{
      batchReservationId: string;
      artifacts: readonly ArtifactIdentity[];
      plan: unknown;
      ownerInstanceId: string;
      leaseToken?: string;
      leaseMs?: number;
      now?: Date;
    }>): Promise<ArtifactPublicationBatchReservation> {
      let batchReservationId: string;
      let ownerInstanceId: string;
      try {
        batchReservationId = ArtifactPublicationBatchReservationIdSchema.parse(
          input.batchReservationId,
        );
        ownerInstanceId = OwnerIdSchema.parse(input.ownerInstanceId);
      } catch {
        throw new ArtifactIndexError(
          "ARTIFACT_BATCH_INVALID",
          "Artifact publication batch identity or owner is invalid",
        );
      }
      const normalized = normalizePublicationBatchArtifacts(input.artifacts);
      const requestedPlan = normalizePublicationBatchPlanInput(
        input.plan,
        normalized.artifacts,
      );
      let replayLeaseToken: string | undefined;
      try {
        replayLeaseToken = input.leaseToken === undefined
          ? undefined
          : z.string().min(1).max(200).parse(input.leaseToken);
      } catch {
        throw new ArtifactIndexError(
          "ARTIFACT_BATCH_INVALID",
          "Artifact publication batch replay lease token is invalid",
        );
      }
      const artifacts = normalized.artifacts;
      const childReservationIds = new Map(artifacts.map((artifact) => [
        artifact.hash,
        computeArtifactPublicationBatchChildReservationId(
          batchReservationId,
          normalized.batchIdentityHash,
          artifact.hash,
        ),
      ]));
      let leaseMs: number;
      try {
        leaseMs = leaseDuration(input.leaseMs, leaseTimeAuthority);
        if (leaseTimeAuthority === "caller-test") validTime(input.now);
      } catch {
        throw new ArtifactIndexError(
          "ARTIFACT_BATCH_INVALID",
          "Artifact publication batch time or lease duration is invalid",
        );
      }

      return sql.begin(async (transaction) => {
        const capacity = await lockCapacity(transaction);
        if (capacity.state !== "ready") {
          throw new ArtifactIndexError(
            "ARTIFACT_INDEX_NOT_READY",
            "Artifact index must complete exact bootstrap reconciliation before batch publication",
          );
        }
        const now = await artifactLeaseAuthorityNow(
          transaction,
          input.now,
          leaseTimeAuthority,
        );
        const expiresAt = new Date(now.getTime() + leaseMs);

        const batchRows = await transaction.unsafe<PublicationBatchRow[]>(
          `SELECT * FROM artifact_publication_batches
            WHERE batch_reservation_id = $1
            FOR UPDATE`,
          [batchReservationId],
        );
        const indexedRows = await transaction.unsafe<ArtifactRow[]>(
          `SELECT * FROM semantic_artifacts
            WHERE artifact_hash = ANY($1::text[])
            ORDER BY artifact_hash`,
          [artifacts.map((artifact) => artifact.hash)],
        );
        const indexedByHash = new Map(indexedRows.map((row) => [row.artifact_hash, row]));
        for (const artifact of artifacts) {
          const indexed = indexedByHash.get(artifact.hash);
          if (indexed) assertIdentity(identityFromRow(indexed), artifact);
        }

        const existingBatch = batchRows[0];
        if (existingBatch) {
          const artifactCount = safeInteger(
            existingBatch.artifact_count,
            "ARTIFACT_BATCH_COUNT_INVALID",
          );
          if (
            existingBatch.identity_schema !== ARTIFACT_PUBLICATION_BATCH_IDENTITY_SCHEMA
            ||
            existingBatch.batch_identity_hash !== normalized.batchIdentityHash
            || artifactCount !== artifacts.length
          ) {
            throw new ArtifactIndexError(
              "ARTIFACT_BATCH_ID_REUSED",
              `Artifact publication batch ${batchReservationId} has a different immutable identity`,
            );
          }
          const batchLifecycle = mapPublicationBatchLifecycle(existingBatch);
          if (batchLifecycle.state === "released" || batchLifecycle.state === "quarantined") {
            throw new ArtifactIndexError(
              "ARTIFACT_BATCH_TERMINAL",
              `Artifact publication batch ${batchReservationId} is terminal in ${batchLifecycle.state} state`,
            );
          }
          if (
            batchLifecycle.state === "active"
            && (
              batchLifecycle.ownerInstanceId !== ownerInstanceId
              || batchLifecycle.leaseToken !== replayLeaseToken
              || !batchLifecycle.leaseExpiresAt
              || new Date(batchLifecycle.leaseExpiresAt).getTime() <= now.getTime()
            )
          ) {
            throw new ArtifactIndexError(
              "ARTIFACT_BATCH_LEASE_LOST",
              `Artifact publication batch ${batchReservationId} replay does not hold its live aggregate fence`,
            );
          }
          const itemRows = await transaction.unsafe<PublicationBatchItemRow[]>(
            `SELECT * FROM artifact_publication_batch_items
              WHERE batch_reservation_id = $1
              ORDER BY ordinal`,
            [batchReservationId],
          );
          if (itemRows.length !== artifacts.length) {
            throw new ArtifactIndexError(
              "ARTIFACT_BATCH_INCOMPLETE",
              `Artifact publication batch ${batchReservationId} membership is incomplete`,
            );
          }
          const reservationIds = itemRows.flatMap((item) =>
            item.reservation_id ? [item.reservation_id] : []);
          const reservationRows = reservationIds.length === 0
            ? []
            : await transaction.unsafe<ReservationRow[]>(
                `SELECT * FROM artifact_publication_reservations
                  WHERE reservation_id = ANY($1::text[])
                  ORDER BY reservation_id
                  FOR UPDATE`,
                [reservationIds],
              );
          const durablePlanRows = await lockPublicationBatchPlan(
            transaction,
            batchReservationId,
          );
          const durablePlan = mapPublicationBatchPlanBinding(
            existingBatch,
            itemRows,
            durablePlanRows.plan,
            durablePlanRows.items,
          );
          if (!samePublicationBatchPlan(durablePlan, requestedPlan)) {
            throw new ArtifactIndexError(
              "ARTIFACT_BATCH_ID_REUSED",
              `Artifact publication batch ${batchReservationId} has a different immutable recovery plan`,
            );
          }
          if (batchLifecycle.state === "active") {
            const observedAfterAggregateLock = await artifactLeaseAuthorityNow(
              transaction,
              input.now,
              leaseTimeAuthority,
            );
            if (
              !batchLifecycle.leaseExpiresAt
              || new Date(batchLifecycle.leaseExpiresAt).getTime()
                <= observedAfterAggregateLock.getTime()
            ) {
              throw new ArtifactIndexError(
                "ARTIFACT_BATCH_LEASE_LOST",
                `Artifact publication batch ${batchReservationId} expired while its aggregate replay locks were acquired`,
              );
            }
          }
          const reservationsById = new Map(
            reservationRows.map((row) => [row.reservation_id, row]),
          );
          const items: ArtifactPublicationBatchItem[] = [];
          for (let ordinal = 0; ordinal < artifacts.length; ordinal += 1) {
            const artifact = artifacts[ordinal]!;
            const item = itemRows[ordinal]!;
            if (
              safeInteger(item.ordinal, "ARTIFACT_BATCH_ORDINAL_INVALID") !== ordinal
              || item.batch_reservation_id !== batchReservationId
              || !sameIdentity(batchIdentityFromRow(item), artifact)
            ) {
              throw new ArtifactIndexError(
                "ARTIFACT_BATCH_ID_REUSED",
                `Artifact publication batch ${batchReservationId} membership differs from its identity`,
              );
            }
            const indexed = indexedByHash.get(artifact.hash);
            if (item.indexed_artifact_hash !== null) {
              if (
                item.indexed_artifact_hash !== artifact.hash
                || item.reservation_id !== null
                || !indexed
              ) {
                throw new ArtifactIndexError(
                  "ARTIFACT_BATCH_INCOMPLETE",
                  `Artifact publication batch ${batchReservationId} has invalid indexed membership`,
                );
              }
              items.push(Object.freeze({
                status: "already_published" as const,
                artifact: mapArtifact(indexed),
              }));
              continue;
            }
            const expectedReservationId = childReservationIds.get(artifact.hash)!;
            const reservation = item.reservation_id
              ? reservationsById.get(item.reservation_id)
              : undefined;
            if (
              item.reservation_id !== expectedReservationId
              || !reservation
              || !sameIdentity(identityFromRow(reservation), artifact)
            ) {
              throw new ArtifactIndexError(
                "ARTIFACT_BATCH_INCOMPLETE",
                `Artifact publication batch ${batchReservationId} child reservation is missing or mismatched`,
              );
            }
            if (indexed) {
              if (reservation.state !== "published") {
                throw new ArtifactIndexError(
                  "ARTIFACT_BATCH_INCOMPLETE",
                  `Artifact publication batch ${batchReservationId} indexed child has an incompatible reservation state`,
                );
              }
              items.push(Object.freeze({
                status: "already_published" as const,
                artifact: mapArtifact(indexed),
                reservationId: reservation.reservation_id,
              }));
              continue;
            }
            if (
              reservation.state !== "reserved"
              || batchLifecycle.state !== "active"
              || reservation.owner_instance_id !== batchLifecycle.ownerInstanceId
              || reservation.lease_token !== batchLifecycle.leaseToken
              || !reservation.lease_expires_at
              || !batchLifecycle.leaseExpiresAt
              || timestamp(reservation.lease_expires_at) !== batchLifecycle.leaseExpiresAt
            ) {
              throw new ArtifactIndexError(
                "ARTIFACT_BATCH_INCOMPLETE",
                `Artifact publication batch ${batchReservationId} no longer owns a live complete reservation set`,
              );
            }
            items.push(Object.freeze({
              status: "reserved" as const,
              artifact,
              reservation: mapReservation(reservation),
              created: false,
            }));
          }
          const frozenItems = Object.freeze(items);
          return Object.freeze({
            batchReservationId,
            identitySchema: ARTIFACT_PUBLICATION_BATCH_IDENTITY_SCHEMA,
            batchIdentityHash: normalized.batchIdentityHash,
            batchCreated: false,
            ...batchLifecycle,
            status: publicationBatchStatus(frozenItems),
            plan: durablePlan,
            items: frozenItems,
            newlyReservedBytes: 0,
          });
        }

        const childIds = [...childReservationIds.values()];
        const collidingChildren = await transaction.unsafe<ReservationRow[]>(
          `SELECT * FROM artifact_publication_reservations
            WHERE reservation_id = ANY($1::text[])
            ORDER BY reservation_id
            FOR UPDATE`,
          [childIds],
        );
        if (collidingChildren.length > 0) {
          throw new ArtifactIndexError(
            "ARTIFACT_BATCH_INCOMPLETE",
            `Artifact publication batch ${batchReservationId} has child reservations without its header`,
          );
        }
        const activeRows = await transaction.unsafe<ReservationRow[]>(
          `SELECT * FROM artifact_publication_reservations
            WHERE artifact_hash = ANY($1::text[]) AND state = 'reserved'
            ORDER BY artifact_hash, reservation_id
            FOR UPDATE`,
          [artifacts.map((artifact) => artifact.hash)],
        );
        if (activeRows[0]) {
          const expected = artifacts.find((artifact) => artifact.hash === activeRows[0]!.artifact_hash)!;
          assertIdentity(identityFromRow(activeRows[0]), expected);
          throw new ArtifactIndexError(
            "ARTIFACT_RESERVATION_BUSY",
            `Artifact ${activeRows[0].artifact_hash} already has an active publication reservation`,
          );
        }

        const maxPayloadBytes = safeInteger(
          capacity.max_payload_bytes,
          "ARTIFACT_CAPACITY_PAYLOAD_INVALID",
        );
        const quotaBytes = safeInteger(capacity.quota_bytes, "ARTIFACT_CAPACITY_QUOTA_INVALID");
        const totalBytes = safeInteger(capacity.total_bytes, "ARTIFACT_CAPACITY_TOTAL_INVALID");
        const reservedBytes = safeInteger(
          capacity.reserved_bytes,
          "ARTIFACT_CAPACITY_RESERVED_INVALID",
        );
        let newlyReservedBytes = 0;
        const unpublished = artifacts.filter((artifact) => !indexedByHash.has(artifact.hash));
        const initialState = unpublished.length === 0 ? "completed" as const : "active" as const;
        const batchLeaseToken = initialState === "active" ? `APB_${randomUUID()}` : null;
        for (const artifact of unpublished) {
          if (artifact.byteLength > maxPayloadBytes) {
            throw new ArtifactIndexError(
              "ARTIFACT_PAYLOAD_TOO_LARGE",
              `Artifact ${artifact.hash} exceeds the indexed maximum payload size`,
            );
          }
          newlyReservedBytes = addBatchBytes(newlyReservedBytes, artifact.byteLength);
        }
        if (
          totalBytes > quotaBytes - reservedBytes
          || newlyReservedBytes > quotaBytes - totalBytes - reservedBytes
        ) {
          throw new ArtifactIndexError(
            "ARTIFACT_CAPACITY_EXCEEDED",
            "Artifact publication batch reservation would exceed the indexed root quota",
          );
        }

        const insertedBatches = await transaction.unsafe<PublicationBatchRow[]>(
          `INSERT INTO artifact_publication_batches (
             batch_reservation_id, identity_schema, batch_identity_hash, artifact_count,
             created_by_instance_id, state, owner_instance_id, lease_token,
             lease_expires_at, finalized_at, created_at, updated_at
           ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $11)
           RETURNING *`,
          [
            batchReservationId,
            ARTIFACT_PUBLICATION_BATCH_IDENTITY_SCHEMA,
            normalized.batchIdentityHash,
            artifacts.length,
            ownerInstanceId,
            initialState,
            initialState === "active" ? ownerInstanceId : null,
            batchLeaseToken,
            initialState === "active" ? expiresAt : null,
            initialState === "completed" ? now : null,
            now,
          ],
        );
        const createdReservations = new Map<string, ReservationRow>();
        for (const artifact of unpublished) {
          const reservationId = childReservationIds.get(artifact.hash)!;
          const rows = await transaction.unsafe<ReservationRow[]>(
            `INSERT INTO artifact_publication_reservations (
               reservation_id, artifact_hash, artifact_type, byte_length,
               producer_metadata, state, owner_instance_id, lease_token,
               lease_expires_at, created_at, updated_at
             ) VALUES ($1, $2, $3, $4, $5::text::jsonb, 'reserved', $6, $7, $8, $9, $9)
             RETURNING *`,
            [
              reservationId,
              artifact.hash,
              artifact.artifactType,
              artifact.byteLength,
              JSON.stringify(artifact.producer),
              ownerInstanceId,
              batchLeaseToken,
              expiresAt,
              now,
            ],
          );
          createdReservations.set(artifact.hash, rows[0]!);
        }
        if (newlyReservedBytes > 0) {
          await transaction.unsafe(
            `UPDATE artifact_capacity
                SET reserved_bytes = reserved_bytes + $1, updated_at = $2
              WHERE capacity_key = 'semantic-artifacts'`,
            [newlyReservedBytes, now],
          );
        }
        const items: ArtifactPublicationBatchItem[] = [];
        for (let ordinal = 0; ordinal < artifacts.length; ordinal += 1) {
          const artifact = artifacts[ordinal]!;
          const indexed = indexedByHash.get(artifact.hash);
          const reservation = createdReservations.get(artifact.hash);
          await transaction.unsafe(
            `INSERT INTO artifact_publication_batch_items (
               batch_reservation_id, ordinal, artifact_hash, artifact_type,
               byte_length, producer_metadata, reservation_id,
               indexed_artifact_hash, created_at
             ) VALUES ($1, $2, $3, $4, $5, $6::text::jsonb, $7, $8, $9)`,
            [
              batchReservationId,
              ordinal,
              artifact.hash,
              artifact.artifactType,
              artifact.byteLength,
              JSON.stringify(artifact.producer),
              reservation?.reservation_id ?? null,
              indexed?.artifact_hash ?? null,
              now,
            ],
          );
          if (indexed) {
            items.push(Object.freeze({
              status: "already_published" as const,
              artifact: mapArtifact(indexed),
            }));
          } else {
            items.push(Object.freeze({
              status: "reserved" as const,
              artifact,
              reservation: mapReservation(reservation!),
              created: true,
            }));
          }
        }
        await transaction.unsafe(
          `INSERT INTO artifact_publication_batch_plans (
             batch_reservation_id, plan_schema, plan_identity_hash,
             item_count, created_at
           ) VALUES ($1, $2, $3, $4, $5)`,
          [
            batchReservationId,
            requestedPlan.schema,
            requestedPlan.planIdentityHash,
            requestedPlan.items.length,
            now,
          ],
        );
        for (let ordinal = 0; ordinal < requestedPlan.items.length; ordinal += 1) {
          const item = requestedPlan.items[ordinal]!;
          await transaction.unsafe(
            `INSERT INTO artifact_publication_batch_plan_items (
               batch_reservation_id, ordinal, artifact_hash,
               durability_tier, created_at
             ) VALUES ($1, $2, $3, $4, $5)`,
            [
              batchReservationId,
              ordinal,
              item.identity.hash,
              item.durabilityTier,
              now,
            ],
          );
        }
        await transaction.unsafe("SET CONSTRAINTS ALL IMMEDIATE");
        let finalBatch = insertedBatches[0]!;
        if (initialState === "active" && leaseTimeAuthority === "database") {
          await transaction.unsafe("SET CONSTRAINTS ALL DEFERRED");
          const observedNow = await artifactLeaseAuthorityNow(
            transaction,
            undefined,
            leaseTimeAuthority,
          );
          const finalNow = new Date(Math.max(observedNow.getTime(), now.getTime() + 1));
          const finalExpiresAt = new Date(finalNow.getTime() + leaseMs);
          const refreshedReservations = await transaction.unsafe<ReservationRow[]>(
            `UPDATE artifact_publication_reservations
                SET lease_expires_at = $2, updated_at = $3
              WHERE reservation_id = ANY($1::text[])
                AND state = 'reserved'
              RETURNING *`,
            [[...createdReservations.values()].map((row) => row.reservation_id), finalExpiresAt, finalNow],
          );
          for (const row of refreshedReservations) {
            createdReservations.set(row.artifact_hash, row);
          }
          const refreshedBatches = await transaction.unsafe<PublicationBatchRow[]>(
            `UPDATE artifact_publication_batches
                SET lease_expires_at = $2, updated_at = $3
              WHERE batch_reservation_id = $1
              RETURNING *`,
            [batchReservationId, finalExpiresAt, finalNow],
          );
          finalBatch = refreshedBatches[0]!;
        }
        const refreshedItems = items.map((item) => {
          if (item.status !== "reserved") return item;
          const reservation = createdReservations.get(item.artifact.hash);
          if (!reservation) throw new Error("ARTIFACT_BATCH_RESERVATION_REFRESH_MISSING");
          return Object.freeze({
            ...item,
            reservation: mapReservation(reservation),
          });
        });
        const frozenItems = Object.freeze(refreshedItems);
        return Object.freeze({
          batchReservationId,
          identitySchema: ARTIFACT_PUBLICATION_BATCH_IDENTITY_SCHEMA,
          batchIdentityHash: normalized.batchIdentityHash,
          batchCreated: true,
          ...mapPublicationBatchLifecycle(finalBatch),
          status: publicationBatchStatus(frozenItems),
          plan: requestedPlan,
          items: frozenItems,
          newlyReservedBytes,
        });
      }) as Promise<ArtifactPublicationBatchReservation>;
    },

    async heartbeatPublicationBatch(input: Readonly<{
      batchReservationId: string;
      ownerInstanceId: string;
      leaseToken: string;
      leaseMs?: number;
      now?: Date;
    }>): Promise<ArtifactPublicationBatchLifecycle> {
      const batchReservationId = ArtifactPublicationBatchReservationIdSchema.parse(
        input.batchReservationId,
      );
      const owner = OwnerIdSchema.parse(input.ownerInstanceId);
      const leaseToken = z.string().min(1).max(200).parse(input.leaseToken);
      const leaseMs = leaseDuration(input.leaseMs, leaseTimeAuthority);
      if (leaseTimeAuthority === "caller-test") validTime(input.now);
      return sql.begin(async (transaction) => {
        await lockCapacity(transaction);
        const aggregate = await lockPublicationBatchAggregate(transaction, batchReservationId);
        const now = await artifactLeaseAuthorityNow(transaction, input.now, leaseTimeAuthority);
        const lifecycle = mapPublicationBatchLifecycle(aggregate.batch);
        if (
          lifecycle.state !== "active"
          || lifecycle.ownerInstanceId !== owner
          || lifecycle.leaseToken !== leaseToken
          || !lifecycle.leaseExpiresAt
          || new Date(lifecycle.leaseExpiresAt).getTime() <= now.getTime()
        ) {
          throw new ArtifactIndexError(
            "ARTIFACT_BATCH_LEASE_LOST",
            `Artifact publication batch ${batchReservationId} heartbeat lost its aggregate fence`,
          );
        }
        const reserved = aggregate.reservations.filter((reservation) => reservation.state === "reserved");
        if (
          reserved.length === 0
          || reserved.some((reservation) =>
            reservation.owner_instance_id !== owner
            || reservation.lease_token !== leaseToken
            || timestamp(reservation.lease_expires_at!) !== lifecycle.leaseExpiresAt)
        ) {
          throw new ArtifactIndexError(
            "ARTIFACT_BATCH_INCOMPLETE",
            `Artifact publication batch ${batchReservationId} does not have one coherent live child set`,
          );
        }
        const expiresAt = new Date(now.getTime() + leaseMs);
        const updatedReservations = await transaction.unsafe<ReservationRow[]>(
          `UPDATE artifact_publication_reservations
              SET lease_expires_at = $2, updated_at = $3
            WHERE reservation_id = ANY($1::text[])
              AND state = 'reserved'
            RETURNING *`,
          [reserved.map((reservation) => reservation.reservation_id), expiresAt, now],
        );
        const updatedBatchRows = await transaction.unsafe<PublicationBatchRow[]>(
          `UPDATE artifact_publication_batches
              SET lease_expires_at = $2, updated_at = $3
            WHERE batch_reservation_id = $1
            RETURNING *`,
          [batchReservationId, expiresAt, now],
        );
        const terminalReservations = aggregate.reservations.filter(
          (reservation) => reservation.state !== "reserved",
        );
        return mapPublicationBatchAggregateLifecycle(
          updatedBatchRows[0]!,
          [...terminalReservations, ...updatedReservations].sort((left, right) =>
            left.reservation_id.localeCompare(right.reservation_id)),
        );
      }) as Promise<ArtifactPublicationBatchLifecycle>;
    },

    async adoptExpiredPublicationBatch(input: Readonly<{
      batchReservationId: string;
      batchIdentityHash: string;
      ownerInstanceId: string;
      leaseMs?: number;
      now?: Date;
    }>): Promise<ArtifactPublicationBatchLifecycle> {
      const batchReservationId = ArtifactPublicationBatchReservationIdSchema.parse(
        input.batchReservationId,
      );
      const batchIdentityHash = Sha256Schema.parse(input.batchIdentityHash);
      const owner = OwnerIdSchema.parse(input.ownerInstanceId);
      const leaseMs = leaseDuration(input.leaseMs, leaseTimeAuthority);
      if (leaseTimeAuthority === "caller-test") validTime(input.now);
      return sql.begin(async (transaction) => {
        await lockCapacity(transaction);
        const aggregate = await lockPublicationBatchAggregate(transaction, batchReservationId);
        const now = await artifactLeaseAuthorityNow(transaction, input.now, leaseTimeAuthority);
        const lifecycle = mapPublicationBatchLifecycle(aggregate.batch);
        if (aggregate.batch.batch_identity_hash !== batchIdentityHash) {
          throw new ArtifactIndexError(
            "ARTIFACT_BATCH_ID_REUSED",
            `Artifact publication batch ${batchReservationId} identity differs from the adoption request`,
          );
        }
        if (lifecycle.state !== "active") {
          throw new ArtifactIndexError(
            "ARTIFACT_BATCH_TERMINAL",
            `Artifact publication batch ${batchReservationId} is terminal in ${lifecycle.state} state`,
          );
        }
        if (
          !lifecycle.leaseExpiresAt
          || new Date(lifecycle.leaseExpiresAt).getTime() > now.getTime()
        ) {
          throw new ArtifactIndexError(
            "ARTIFACT_BATCH_NOT_EXPIRED",
            `Artifact publication batch ${batchReservationId} is not expired and adoptable`,
          );
        }
        const reserved = aggregate.reservations.filter((reservation) => reservation.state === "reserved");
        if (
          reserved.length === 0
          || aggregate.reservations.some((reservation) =>
            reservation.state !== "reserved" && reservation.state !== "published")
        ) {
          throw new ArtifactIndexError(
            "ARTIFACT_BATCH_INCOMPLETE",
            `Artifact publication batch ${batchReservationId} cannot adopt a split or terminal child set`,
          );
        }
        const leaseToken = `APB_${randomUUID()}`;
        const expiresAt = new Date(now.getTime() + leaseMs);
        const updatedReservations = await transaction.unsafe<ReservationRow[]>(
          `UPDATE artifact_publication_reservations
              SET owner_instance_id = $2, lease_token = $3,
                  lease_expires_at = $4, updated_at = $5
            WHERE reservation_id = ANY($1::text[])
              AND state = 'reserved'
            RETURNING *`,
          [reserved.map((reservation) => reservation.reservation_id), owner, leaseToken, expiresAt, now],
        );
        const updatedBatchRows = await transaction.unsafe<PublicationBatchRow[]>(
          `UPDATE artifact_publication_batches
              SET owner_instance_id = $2, lease_token = $3,
                  lease_expires_at = $4, updated_at = $5
            WHERE batch_reservation_id = $1
            RETURNING *`,
          [batchReservationId, owner, leaseToken, expiresAt, now],
        );
        const published = aggregate.reservations.filter((reservation) => reservation.state === "published");
        return mapPublicationBatchAggregateLifecycle(
          updatedBatchRows[0]!,
          [...published, ...updatedReservations].sort((left, right) =>
            left.reservation_id.localeCompare(right.reservation_id)),
        );
      }) as Promise<ArtifactPublicationBatchLifecycle>;
    },

    async listExpiredPublicationBatches(
      nowInput?: Date,
    ): Promise<ArtifactPublicationBatchLifecycle[]> {
      if (leaseTimeAuthority === "caller-test") validTime(nowInput);
      const now = await artifactLeaseAuthorityNow(sql, nowInput, leaseTimeAuthority);
      const batches = await sql.unsafe<PublicationBatchRow[]>(
        `SELECT * FROM artifact_publication_batches
          WHERE state = 'active' AND lease_expires_at <= $1
          ORDER BY lease_expires_at, batch_reservation_id`,
        [now],
      );
      const results: ArtifactPublicationBatchLifecycle[] = [];
      for (const batch of batches) {
        const reservations = await sql.unsafe<ReservationRow[]>(
          `SELECT r.*
             FROM artifact_publication_batch_items i
             JOIN artifact_publication_reservations r
               ON r.reservation_id = i.reservation_id
            WHERE i.batch_reservation_id = $1
            ORDER BY r.reservation_id`,
          [batch.batch_reservation_id],
        );
        results.push(mapPublicationBatchAggregateLifecycle(batch, reservations));
      }
      return results;
    },

    async finalizeOwnedPublicationBatch(input: Readonly<{
      batchReservationId: string;
      ownerInstanceId: string;
      leaseToken: string;
      resolution: "released" | "quarantined";
      diagnostic: string;
      now?: Date;
    }>): Promise<ArtifactPublicationBatchLifecycle> {
      return finalizePublicationBatch(sql, leaseTimeAuthority, {
        ...input,
        authority: "owned",
      });
    },

    async finalizeExpiredPublicationBatch(input: Readonly<{
      batchReservationId: string;
      batchIdentityHash: string;
      expectedLeaseToken: string;
      expectedLeaseExpiresAt: string;
      resolution: "released" | "quarantined";
      diagnostic: string;
      now?: Date;
    }>): Promise<ArtifactPublicationBatchLifecycle> {
      return finalizePublicationBatch(sql, leaseTimeAuthority, {
        ...input,
        authority: "expired",
      });
    },

    async publishPublicationBatchItem(input: Readonly<{
      batchReservationId: string;
      reservationId: string;
      artifact: ArtifactIdentity;
      ownerInstanceId: string;
      leaseToken: string;
      now?: Date;
    }>): Promise<Readonly<{
      created: boolean;
      artifact: IndexedArtifact;
      batchState: "active" | "completed";
    }>> {
      const batchReservationId = ArtifactPublicationBatchReservationIdSchema.parse(
        input.batchReservationId,
      );
      const reservationId = ReservationIdSchema.parse(input.reservationId);
      if (!reservationId.startsWith("APRB_")) {
        throw new ArtifactIndexError(
          "ARTIFACT_BATCH_OPERATION_REQUIRED",
          "Batch publication requires a deterministic APRB_ child reservation",
        );
      }
      const artifact = ArtifactIdentitySchema.parse(input.artifact);
      const owner = OwnerIdSchema.parse(input.ownerInstanceId);
      const leaseToken = z.string().min(1).max(200).parse(input.leaseToken);
      if (leaseTimeAuthority === "caller-test") validTime(input.now);
      return sql.begin(async (transaction) => {
        await lockCapacity(transaction);
        const aggregate = await lockPublicationBatchAggregate(transaction, batchReservationId);
        const item = aggregate.items.find((candidate) => candidate.reservation_id === reservationId);
        const reservation = aggregate.reservations.find(
          (candidate) => candidate.reservation_id === reservationId,
        );
        if (
          !item
          || !reservation
          || item.batch_reservation_id !== batchReservationId
          || !sameIdentity(batchIdentityFromRow(item), artifact)
        ) {
          throw new ArtifactIndexError(
            "ARTIFACT_BATCH_INCOMPLETE",
            `Reservation ${reservationId} is not the requested batch member`,
          );
        }
        assertIdentity(identityFromRow(reservation), artifact);
        if (reservation.state === "published") {
          if (aggregate.batch.state === "released" || aggregate.batch.state === "quarantined") {
            throw new ArtifactIndexError(
              "ARTIFACT_BATCH_TERMINAL",
              `Artifact publication batch ${batchReservationId} is terminal in ${aggregate.batch.state} state`,
            );
          }
          const indexed = await readArtifact(transaction, artifact.hash);
          if (!indexed) throw new Error("ARTIFACT_PUBLISHED_RESERVATION_WITHOUT_INDEX");
          assertIdentity(identityFromRow(indexed), artifact);
          const state = z.enum(["active", "completed"]).parse(aggregate.batch.state);
          return { created: false, artifact: mapArtifact(indexed), batchState: state };
        }
        const now = await artifactLeaseAuthorityNow(transaction, input.now, leaseTimeAuthority);
        const lifecycle = mapPublicationBatchLifecycle(aggregate.batch);
        if (lifecycle.state !== "active") {
          throw new ArtifactIndexError(
            "ARTIFACT_BATCH_TERMINAL",
            `Artifact publication batch ${batchReservationId} is terminal in ${lifecycle.state} state`,
          );
        }
        if (
          lifecycle.ownerInstanceId !== owner
          || lifecycle.leaseToken !== leaseToken
          || !lifecycle.leaseExpiresAt
          || new Date(lifecycle.leaseExpiresAt).getTime() <= now.getTime()
          || reservation.state !== "reserved"
          || reservation.owner_instance_id !== owner
          || reservation.lease_token !== leaseToken
          || !reservation.lease_expires_at
          || timestamp(reservation.lease_expires_at) !== lifecycle.leaseExpiresAt
        ) {
          throw new ArtifactIndexError(
            "ARTIFACT_BATCH_LEASE_LOST",
            `Artifact publication batch ${batchReservationId} item lost its aggregate fence`,
          );
        }
        const inserted = await transaction.unsafe<Array<{ artifact_hash: string }>>(
          `INSERT INTO semantic_artifacts (
             artifact_hash, artifact_type, byte_length, producer_metadata, created_at
           ) VALUES ($1, $2, $3, $4::text::jsonb, $5)
           ON CONFLICT (artifact_hash) DO NOTHING
           RETURNING artifact_hash`,
          [
            artifact.hash,
            artifact.artifactType,
            artifact.byteLength,
            JSON.stringify(artifact.producer),
            now,
          ],
        );
        const indexed = await readArtifact(transaction, artifact.hash);
        if (!indexed) throw new Error("ARTIFACT_PUBLICATION_INDEX_INSERT_FAILED");
        assertIdentity(identityFromRow(indexed), artifact);
        const created = inserted.length === 1;
        await transaction.unsafe(
          `UPDATE artifact_capacity
              SET total_bytes = total_bytes + $1,
                  reserved_bytes = reserved_bytes - $2,
                  updated_at = $3
            WHERE capacity_key = 'semantic-artifacts'`,
          [created ? artifact.byteLength : 0, artifact.byteLength, now],
        );
        await transaction.unsafe(
          `UPDATE artifact_publication_reservations
              SET state = 'published', owner_instance_id = NULL,
                  lease_token = NULL, lease_expires_at = NULL,
                  published_at = $2, finalized_at = $2, updated_at = $2
            WHERE reservation_id = $1`,
          [reservationId, now],
        );
        const lastReserved = aggregate.reservations.every((candidate) =>
          candidate.reservation_id === reservationId || candidate.state !== "reserved");
        if (lastReserved) {
          await transaction.unsafe(
            `UPDATE artifact_publication_batches
                SET state = 'completed', owner_instance_id = NULL,
                    lease_token = NULL, lease_expires_at = NULL,
                    diagnostic = NULL, finalized_at = $2, updated_at = $2
              WHERE batch_reservation_id = $1`,
            [batchReservationId, now],
          );
        }
        return {
          created,
          artifact: mapArtifact(indexed),
          batchState: lastReserved ? "completed" as const : "active" as const,
        };
      }) as Promise<Readonly<{
        created: boolean;
        artifact: IndexedArtifact;
        batchState: "active" | "completed";
      }>>;
    },

    async reservePublication(input: Readonly<{
      reservationId: string;
      artifact: ArtifactIdentity;
      ownerInstanceId: string;
      leaseMs?: number;
      now?: Date;
    }>): Promise<Readonly<
      | { status: "already_published"; artifact: IndexedArtifact }
      | { status: "reserved"; reservation: ArtifactPublicationReservation }
    >> {
      const reservationId = ReservationIdSchema.parse(input.reservationId);
      assertNotBatchChildReservation(reservationId);
      const artifact = ArtifactIdentitySchema.parse(input.artifact);
      const ownerInstanceId = OwnerIdSchema.parse(input.ownerInstanceId);
      const leaseMs = leaseDuration(input.leaseMs, leaseTimeAuthority);
      if (leaseTimeAuthority === "caller-test") validTime(input.now);
      return sql.begin(async (transaction) => {
        const capacity = await lockCapacity(transaction);
        if (capacity.state !== "ready") {
          throw new ArtifactIndexError(
            "ARTIFACT_INDEX_NOT_READY",
            "Artifact index must complete exact bootstrap reconciliation before publication",
          );
        }
        const now = await artifactLeaseAuthorityNow(
          transaction,
          input.now,
          leaseTimeAuthority,
        );
        const expiresAt = new Date(now.getTime() + leaseMs);
        const sameIdRows = await transaction.unsafe<ReservationRow[]>(
          "SELECT * FROM artifact_publication_reservations WHERE reservation_id = $1 FOR UPDATE",
          [reservationId],
        );
        const sameId = sameIdRows[0];
        if (sameId) {
          assertIdentity(identityFromRow(sameId), artifact);
          if (
            sameId.state === "reserved"
            && sameId.owner_instance_id === ownerInstanceId
            && sameId.lease_expires_at
            && new Date(sameId.lease_expires_at).getTime() > now.getTime()
          ) {
            return { status: "reserved" as const, reservation: mapReservation(sameId) };
          }
          if (sameId.state === "published") {
            const indexed = await readArtifact(transaction, artifact.hash);
            if (!indexed) throw new Error("ARTIFACT_PUBLISHED_RESERVATION_WITHOUT_INDEX");
            assertIdentity(identityFromRow(indexed), artifact);
            return { status: "already_published" as const, artifact: mapArtifact(indexed) };
          }
          throw new ArtifactIndexError(
            "ARTIFACT_RESERVATION_ID_REUSED",
            `Artifact reservation ${reservationId} is already finalized or owned by another publisher`,
          );
        }
        const indexed = await readArtifact(transaction, artifact.hash);
        if (indexed) {
          assertIdentity(identityFromRow(indexed), artifact);
          return { status: "already_published" as const, artifact: mapArtifact(indexed) };
        }
        const activeRows = await transaction.unsafe<ReservationRow[]>(
          `SELECT * FROM artifact_publication_reservations
            WHERE artifact_hash = $1 AND state = 'reserved'
            FOR UPDATE`,
          [artifact.hash],
        );
        if (activeRows[0]) {
          assertIdentity(identityFromRow(activeRows[0]), artifact);
          throw new ArtifactIndexError(
            "ARTIFACT_RESERVATION_BUSY",
            `Artifact ${artifact.hash} already has an active publication reservation`,
          );
        }
        const maxPayloadBytes = safeInteger(capacity.max_payload_bytes, "ARTIFACT_CAPACITY_PAYLOAD_INVALID");
        const quotaBytes = safeInteger(capacity.quota_bytes, "ARTIFACT_CAPACITY_QUOTA_INVALID");
        const totalBytes = safeInteger(capacity.total_bytes, "ARTIFACT_CAPACITY_TOTAL_INVALID");
        const reservedBytes = safeInteger(capacity.reserved_bytes, "ARTIFACT_CAPACITY_RESERVED_INVALID");
        if (artifact.byteLength > maxPayloadBytes) {
          throw new ArtifactIndexError(
            "ARTIFACT_PAYLOAD_TOO_LARGE",
            `Artifact ${artifact.hash} exceeds the indexed maximum payload size`,
          );
        }
        if (totalBytes + reservedBytes + artifact.byteLength > quotaBytes) {
          throw new ArtifactIndexError(
            "ARTIFACT_CAPACITY_EXCEEDED",
            "Artifact publication reservation would exceed the indexed root quota",
          );
        }
        const leaseToken = `APR_${randomUUID()}`;
        const rows = await transaction.unsafe<ReservationRow[]>(
          `INSERT INTO artifact_publication_reservations (
             reservation_id, artifact_hash, artifact_type, byte_length,
             producer_metadata, state, owner_instance_id, lease_token,
             lease_expires_at, created_at, updated_at
           ) VALUES ($1, $2, $3, $4, $5::text::jsonb, 'reserved', $6, $7, $8, $9, $9)
           RETURNING *`,
          [
            reservationId,
            artifact.hash,
            artifact.artifactType,
            artifact.byteLength,
            JSON.stringify(artifact.producer),
            ownerInstanceId,
            leaseToken,
            expiresAt,
            now,
          ],
        );
        await transaction.unsafe(
          `UPDATE artifact_capacity
              SET reserved_bytes = reserved_bytes + $1, updated_at = $2
            WHERE capacity_key = 'semantic-artifacts'`,
          [artifact.byteLength, now],
        );
        return { status: "reserved" as const, reservation: mapReservation(rows[0]!) };
      }) as Promise<Readonly<
        | { status: "already_published"; artifact: IndexedArtifact }
        | { status: "reserved"; reservation: ArtifactPublicationReservation }
      >>;
    },

    async heartbeatReservation(input: Readonly<{
      reservationId: string;
      ownerInstanceId: string;
      leaseToken: string;
      leaseMs?: number;
      now?: Date;
    }>): Promise<ArtifactPublicationReservation> {
      const reservationId = ReservationIdSchema.parse(input.reservationId);
      assertNotBatchChildReservation(reservationId);
      const owner = OwnerIdSchema.parse(input.ownerInstanceId);
      const leaseToken = z.string().min(1).max(200).parse(input.leaseToken);
      const leaseMs = leaseDuration(input.leaseMs, leaseTimeAuthority);
      if (leaseTimeAuthority === "caller-test") validTime(input.now);
      return sql.begin(async (transaction) => {
        await transaction.unsafe(
          "SELECT reservation_id FROM artifact_publication_reservations WHERE reservation_id = $1 FOR UPDATE",
          [reservationId],
        );
        const now = await artifactLeaseAuthorityNow(
          transaction,
          input.now,
          leaseTimeAuthority,
        );
        const expiresAt = new Date(now.getTime() + leaseMs);
        const rows = await transaction.unsafe<ReservationRow[]>(
          `UPDATE artifact_publication_reservations
              SET lease_expires_at = $4, updated_at = $5
            WHERE reservation_id = $1
              AND state = 'reserved'
              AND owner_instance_id = $2
              AND lease_token = $3
              AND lease_expires_at > $5
            RETURNING *`,
          [reservationId, owner, leaseToken, expiresAt, now],
        );
        if (rows.length !== 1) {
          throw new ArtifactIndexError(
            "ARTIFACT_RESERVATION_LEASE_LOST",
            `Artifact reservation ${reservationId} heartbeat lost its lease fence`,
          );
        }
        return mapReservation(rows[0]!);
      }) as Promise<ArtifactPublicationReservation>;
    },

    async finalizeOwnedReservation(input: Readonly<{
      reservationId: string;
      ownerInstanceId: string;
      leaseToken: string;
      resolution: "released" | "quarantined";
      diagnostic: string;
      now?: Date;
    }>): Promise<ArtifactPublicationReservation> {
      const reservationId = ReservationIdSchema.parse(input.reservationId);
      assertNotBatchChildReservation(reservationId);
      const owner = OwnerIdSchema.parse(input.ownerInstanceId);
      const leaseToken = z.string().min(1).max(200).parse(input.leaseToken);
      const diagnostic = z.string().min(1).max(4_000).parse(input.diagnostic.trim());
      if (leaseTimeAuthority === "caller-test") validTime(input.now);
      return sql.begin(async (transaction) => {
        await lockCapacity(transaction);
        const rows = await transaction.unsafe<ReservationRow[]>(
          "SELECT * FROM artifact_publication_reservations WHERE reservation_id = $1 FOR UPDATE",
          [reservationId],
        );
        const reservation = rows[0];
        if (!reservation) {
          throw new ArtifactIndexError(
            "ARTIFACT_RESERVATION_NOT_FOUND",
            `Unknown artifact reservation ${reservationId}`,
          );
        }
        const now = await artifactLeaseAuthorityNow(
          transaction,
          input.now,
          leaseTimeAuthority,
        );
        if (
          reservation.state !== "reserved"
          || reservation.owner_instance_id !== owner
          || reservation.lease_token !== leaseToken
          || !reservation.lease_expires_at
          || new Date(reservation.lease_expires_at).getTime() <= now.getTime()
        ) {
          throw new ArtifactIndexError(
            "ARTIFACT_RESERVATION_LEASE_LOST",
            `Artifact reservation ${reservationId} is not held by this publisher`,
          );
        }
        const byteLength = safeInteger(
          reservation.byte_length,
          "ARTIFACT_INDEX_BYTE_LENGTH_INVALID",
        );
        await transaction.unsafe(
          `UPDATE artifact_capacity
              SET reserved_bytes = reserved_bytes - $1,
                  state = CASE WHEN $3 = 'quarantined' THEN 'quarantined' ELSE state END,
                  diagnostic = CASE WHEN $3 = 'quarantined' THEN $4 ELSE diagnostic END,
                  reconciled_at = CASE WHEN $3 = 'quarantined' THEN $2 ELSE reconciled_at END,
                  updated_at = $2
            WHERE capacity_key = 'semantic-artifacts'`,
          [byteLength, now, input.resolution, diagnostic],
        );
        const updated = await transaction.unsafe<ReservationRow[]>(
          `UPDATE artifact_publication_reservations
              SET state = $2, owner_instance_id = NULL, lease_token = NULL,
                  lease_expires_at = NULL, diagnostic = $3,
                  finalized_at = $4, updated_at = $4
            WHERE reservation_id = $1
            RETURNING *`,
          [reservationId, input.resolution, diagnostic, now],
        );
        return mapReservation(updated[0]!);
      }) as Promise<ArtifactPublicationReservation>;
    },

    async publish(input: Readonly<{
      reservationId: string;
      artifact: ArtifactIdentity;
      ownerInstanceId: string;
      leaseToken: string;
      now?: Date;
    }>): Promise<Readonly<{ created: boolean; artifact: IndexedArtifact }>> {
      const reservationId = ReservationIdSchema.parse(input.reservationId);
      assertNotBatchChildReservation(reservationId);
      const artifact = ArtifactIdentitySchema.parse(input.artifact);
      const owner = OwnerIdSchema.parse(input.ownerInstanceId);
      const leaseToken = z.string().min(1).max(200).parse(input.leaseToken);
      if (leaseTimeAuthority === "caller-test") validTime(input.now);
      return sql.begin(async (transaction) => {
        await lockCapacity(transaction);
        const rows = await transaction.unsafe<ReservationRow[]>(
          "SELECT * FROM artifact_publication_reservations WHERE reservation_id = $1 FOR UPDATE",
          [reservationId],
        );
        const reservation = rows[0];
        if (!reservation) {
          throw new ArtifactIndexError("ARTIFACT_RESERVATION_NOT_FOUND", `Unknown artifact reservation ${reservationId}`);
        }
        const now = await artifactLeaseAuthorityNow(
          transaction,
          input.now,
          leaseTimeAuthority,
        );
        assertIdentity(identityFromRow(reservation), artifact);
        if (reservation.state === "published") {
          const indexed = await readArtifact(transaction, artifact.hash);
          if (!indexed) throw new Error("ARTIFACT_PUBLISHED_RESERVATION_WITHOUT_INDEX");
          assertIdentity(identityFromRow(indexed), artifact);
          return { created: false, artifact: mapArtifact(indexed) };
        }
        if (
          reservation.state !== "reserved"
          || reservation.owner_instance_id !== owner
          || reservation.lease_token !== leaseToken
          || !reservation.lease_expires_at
          || new Date(reservation.lease_expires_at).getTime() <= now.getTime()
        ) {
          throw new ArtifactIndexError(
            "ARTIFACT_RESERVATION_LEASE_LOST",
            `Artifact reservation ${reservationId} is not held by this publisher`,
          );
        }
        const inserted = await transaction.unsafe<Array<{ artifact_hash: string }>>(
          `INSERT INTO semantic_artifacts (
             artifact_hash, artifact_type, byte_length, producer_metadata, created_at
           ) VALUES ($1, $2, $3, $4::text::jsonb, $5)
           ON CONFLICT (artifact_hash) DO NOTHING
           RETURNING artifact_hash`,
          [
            artifact.hash,
            artifact.artifactType,
            artifact.byteLength,
            JSON.stringify(artifact.producer),
            now,
          ],
        );
        const indexed = await readArtifact(transaction, artifact.hash);
        if (!indexed) throw new Error("ARTIFACT_PUBLICATION_INDEX_INSERT_FAILED");
        assertIdentity(identityFromRow(indexed), artifact);
        const created = inserted.length === 1;
        await transaction.unsafe(
          `UPDATE artifact_capacity
              SET total_bytes = total_bytes + $1,
                  reserved_bytes = reserved_bytes - $2,
                  updated_at = $3
            WHERE capacity_key = 'semantic-artifacts'`,
          [created ? artifact.byteLength : 0, artifact.byteLength, now],
        );
        await transaction.unsafe(
          `UPDATE artifact_publication_reservations
              SET state = 'published', owner_instance_id = NULL,
                  lease_token = NULL, lease_expires_at = NULL,
                  published_at = $2, finalized_at = $2, updated_at = $2
            WHERE reservation_id = $1`,
          [reservationId, now],
        );
        return { created, artifact: mapArtifact(indexed) };
      }) as Promise<Readonly<{ created: boolean; artifact: IndexedArtifact }>>;
    },

    async listExpired(nowInput?: Date): Promise<ArtifactPublicationReservation[]> {
      if (leaseTimeAuthority === "caller-test") validTime(nowInput);
      const now = await artifactLeaseAuthorityNow(sql, nowInput, leaseTimeAuthority);
      const rows = await sql.unsafe<ReservationRow[]>(
        `SELECT * FROM artifact_publication_reservations
          WHERE state = 'reserved'
            AND left(reservation_id, 5) <> 'APRB_'
            AND lease_expires_at <= $1
          ORDER BY lease_expires_at, reservation_id`,
        [now],
      );
      return rows.map(mapReservation);
    },

    async adoptExpired(input: Readonly<{
      reservationId: string;
      artifact: ArtifactIdentity;
      ownerInstanceId: string;
      leaseMs?: number;
      now?: Date;
    }>): Promise<ArtifactPublicationReservation> {
      const reservationId = ReservationIdSchema.parse(input.reservationId);
      assertNotBatchChildReservation(reservationId);
      const artifact = ArtifactIdentitySchema.parse(input.artifact);
      const owner = OwnerIdSchema.parse(input.ownerInstanceId);
      const leaseMs = leaseDuration(input.leaseMs, leaseTimeAuthority);
      if (leaseTimeAuthority === "caller-test") validTime(input.now);
      return sql.begin(async (transaction) => {
        await lockCapacity(transaction);
        const rows = await transaction.unsafe<ReservationRow[]>(
          "SELECT * FROM artifact_publication_reservations WHERE reservation_id = $1 FOR UPDATE",
          [reservationId],
        );
        const reservation = rows[0];
        if (!reservation) throw new ArtifactIndexError("ARTIFACT_RESERVATION_NOT_FOUND", `Unknown artifact reservation ${reservationId}`);
        const now = await artifactLeaseAuthorityNow(
          transaction,
          input.now,
          leaseTimeAuthority,
        );
        const expiresAt = new Date(now.getTime() + leaseMs);
        assertIdentity(identityFromRow(reservation), artifact);
        if (
          reservation.state !== "reserved"
          || !reservation.lease_expires_at
          || new Date(reservation.lease_expires_at).getTime() > now.getTime()
        ) {
          throw new ArtifactIndexError(
            "ARTIFACT_RESERVATION_NOT_EXPIRED",
            `Artifact reservation ${reservationId} is not expired and adoptable`,
          );
        }
        const leaseToken = `APR_${randomUUID()}`;
        const updated = await transaction.unsafe<ReservationRow[]>(
          `UPDATE artifact_publication_reservations
              SET owner_instance_id = $2, lease_token = $3,
                  lease_expires_at = $4, updated_at = $5
            WHERE reservation_id = $1
            RETURNING *`,
          [reservationId, owner, leaseToken, expiresAt, now],
        );
        return mapReservation(updated[0]!);
      }) as Promise<ArtifactPublicationReservation>;
    },

    async releaseExpired(input: Readonly<{
      reservationId: string;
      diagnostic?: string;
      now?: Date;
    }>): Promise<ArtifactPublicationReservation> {
      return finalizeExpiredReservation(
        sql,
        leaseTimeAuthority,
        { ...input, resolution: "released" },
      );
    },

    async quarantineExpired(input: Readonly<{
      reservationId: string;
      diagnostic: string;
      now?: Date;
    }>): Promise<ArtifactPublicationReservation> {
      if (!input.diagnostic.trim()) throw new TypeError("Artifact quarantine diagnostic must not be empty");
      return finalizeExpiredReservation(
        sql,
        leaseTimeAuthority,
        { ...input, resolution: "quarantined" },
      );
    },

    async addRunArtifactRef(input: Readonly<{
      runId: string;
      refKey: string;
      artifactHash: string;
      now?: Date;
    }>): Promise<Readonly<{ created: boolean; runId: string; refKey: string; artifactHash: string }>> {
      const runId = z.string().min(1).max(200).parse(input.runId);
      const refKey = RefKeySchema.parse(input.refKey);
      const artifactHash = Sha256Schema.parse(input.artifactHash);
      const now = validTime(input.now);
      return sql.begin(async (transaction) => {
        const inserted = await transaction.unsafe<Array<{ run_id: string }>>(
          `INSERT INTO run_artifact_refs (run_id, ref_key, artifact_hash, created_at)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (run_id, ref_key) DO NOTHING
           RETURNING run_id`,
          [runId, refKey, artifactHash, now],
        );
        const rows = await transaction.unsafe<Array<{ artifact_hash: string }>>(
          "SELECT artifact_hash FROM run_artifact_refs WHERE run_id = $1 AND ref_key = $2",
          [runId, refKey],
        );
        if (rows[0]?.artifact_hash !== artifactHash) {
          throw new ArtifactIndexError(
            "RUN_ARTIFACT_REF_CONFLICT",
            `Run artifact reference ${runId}/${refKey} is already sealed to another hash`,
          );
        }
        return { created: inserted.length === 1, runId, refKey, artifactHash };
      }) as Promise<Readonly<{ created: boolean; runId: string; refKey: string; artifactHash: string }>>;
    },

    async activateProductPacket(input: Readonly<{
      runId: string;
      packetHash: string;
      compiler: CompilerIdentityV1;
      packet?: unknown;
      artifactRefs: Readonly<Record<string, string>>;
      now?: Date;
    }>): Promise<Readonly<{
      created: boolean;
      runId: string;
      packetHash: string;
      compiler: CompilerIdentityV1;
      sealedAt: string;
    }>> {
      const runId = z.string().min(1).max(200).parse(input.runId);
      const packetHash = Sha256Schema.parse(input.packetHash);
      const compiler = CompilerIdentityV1Schema.parse(input.compiler);
      const rawRefs = z.record(RefKeySchema, Sha256Schema).parse(input.artifactRefs);
      if (rawRefs.PRODUCT_BUILD_PACKET !== packetHash) {
        throw new ArtifactIndexError(
          "PRODUCT_PACKET_REFS_INCOMPLETE",
          "Product packet activation requires its canonical packet reference",
        );
      }
      const now = validTime(input.now);
      return sql.begin(async (transaction) => {
        await transaction.unsafe(
          "SELECT pg_advisory_xact_lock(hashtextextended($1, 0))",
          [`product-packet:${runId}`],
        );
        const runs = await transaction.unsafe<Array<{
          protocol: string;
          status: string;
          compiler_release_sha: string | null;
          packet_hash: string | null;
        }>>(
          `SELECT protocol, status, compiler_release_sha, packet_hash
             FROM runs WHERE id = $1 FOR UPDATE`,
          [runId],
        );
        const run = runs[0];
        if (!run) {
          throw new ArtifactIndexError(
            "PRODUCT_PACKET_RUN_NOT_FOUND",
            `Product packet run ${runId} does not exist`,
          );
        }
        if (run.protocol !== "v3") {
          throw new ArtifactIndexError(
            "PRODUCT_PACKET_RUN_NOT_V3",
            `Run ${runId} is not a Product Compiler v3 owner`,
          );
        }
        if (!["running", "resuming"].includes(run.status)) {
          throw new ArtifactIndexError(
            "PRODUCT_PACKET_RUN_NOT_ACTIVE",
            `Run ${runId} is not active for packet activation`,
          );
        }
        if (run.compiler_release_sha !== compiler.codeSha) {
          throw new ArtifactIndexError(
            "PRODUCT_PACKET_RELEASE_MISMATCH",
            `Run ${runId} release does not match the packet compiler identity`,
          );
        }
        if (run.packet_hash !== null && run.packet_hash !== packetHash) {
          throw new ArtifactIndexError(
            "PRODUCT_PACKET_SEAL_CONFLICT",
            `Run ${runId} is already activated with another packet`,
          );
        }
        const attempts = await transaction.unsafe<Array<{ count: number }>>(
          "SELECT COUNT(*)::integer AS count FROM execution_attempts WHERE run_id = $1",
          [runId],
        );
        if ((attempts[0]?.count ?? 0) > 0 && run.packet_hash === null) {
          throw new ArtifactIndexError(
            "PRODUCT_PACKET_ATTEMPT_CONFLICT",
            `Run ${runId} already has an attempt before packet activation`,
          );
        }

        const packetArtifact = await readArtifact(transaction, packetHash);
        let packetV3: ProductBuildPacketV3 | undefined;
        if (packetArtifact?.artifact_type === "setfarm.product-build-packet.v3") {
          const parsed = ProductBuildPacketV3Schema.safeParse(input.packet);
          if (!parsed.success) {
            throw new ArtifactIndexError(
              "PRODUCT_PACKET_ARTIFACT_TYPE_INVALID",
              `Packet ${packetHash} requires one exact ProductBuildPacketV3 activation payload`,
            );
          }
          packetV3 = parsed.data;
          const packetIdentity = identityFromRow(packetArtifact);
          const envelopeHash = hashCanonicalJson({
            schema: "setfarm.semantic-artifact-envelope.v1",
            artifactType: "setfarm.product-build-packet.v3",
            producer: packetIdentity.producer,
            payload: packetV3,
          });
          if (envelopeHash !== packetHash) {
            throw new ArtifactIndexError(
              "ARTIFACT_IDENTITY_MISMATCH",
              `Packet ${packetHash} activation payload differs from its immutable CAS envelope`,
            );
          }
          if (
            packetV3.compiler.codeSha !== compiler.codeSha
            || packetV3.compiler.version !== compiler.version
            || packetIdentity.producer.codeSha !== compiler.codeSha
          ) {
            throw new ArtifactIndexError(
              "PRODUCT_PACKET_RELEASE_MISMATCH",
              `Packet ${packetHash}, producer, compiler, and run release identities do not agree`,
            );
          }
        }
        const refTypes = packetV3?.designSourceKind === "stitch"
          ? PRODUCT_PACKET_REF_TYPES_V3_STITCH
          : packetV3?.designSourceKind === "none"
            ? PRODUCT_PACKET_REF_TYPES_V3_NONE
            : packetArtifact?.artifact_type === "setfarm.product-build-packet.v2"
              ? PRODUCT_PACKET_REF_TYPES_V2
              : packetArtifact?.artifact_type === "setfarm.product-build-packet.v1"
                ? PRODUCT_PACKET_REF_TYPES_V1
                : undefined;
        if (!refTypes) {
          throw new ArtifactIndexError(
            "PRODUCT_PACKET_ARTIFACT_TYPE_INVALID",
            `Packet ${packetHash} is not an indexed Product Build Packet v1, v2, or v3 artifact`,
          );
        }
        const expectedKeys = Object.keys(refTypes).sort();
        const observedKeys = Object.keys(rawRefs).sort();
        if (
          observedKeys.length !== expectedKeys.length
          || observedKeys.some((key, index) => key !== expectedKeys[index])
        ) {
          throw new ArtifactIndexError(
            "PRODUCT_PACKET_REFS_INCOMPLETE",
            "Product packet activation requires the exact canonical reference set for its indexed packet schema",
          );
        }
        if (packetV3) {
          const packetRefs: Record<string, string | null> = {
            PRODUCT_SPEC: packetV3.productSpecV2Hash,
            DESIGN_GRAPH: packetV3.designGraphV2Hash,
            BUILD_TOPOLOGY: packetV3.buildTopologyV1Hash,
            STORY_PLAN: packetV3.storyPlanV2Hash,
            DESIGN_SOURCE_CLOSURE: packetV3.designSourceClosureV2Hash,
            IMPLEMENTATION_SOURCE_MAP: packetV3.implementationSourceMapV1Hash,
            PRODUCT_BUILD_PACKET: packetHash,
          };
          for (const [refKey, expectedHash] of Object.entries(packetRefs)) {
            const observedHash = rawRefs[refKey] ?? null;
            if (observedHash !== expectedHash) {
              throw new ArtifactIndexError(
                "PRODUCT_PACKET_REFS_INCOMPLETE",
                `${refKey} does not equal the exact CAS envelope hash sealed by ProductBuildPacketV3`,
              );
            }
          }
        }

        let refsCreated = 0;
        for (const refKey of expectedKeys) {
          const artifactHash = rawRefs[refKey]!;
          const artifact = await readArtifact(transaction, artifactHash);
          const expectedType = refTypes[refKey as keyof typeof refTypes];
          if (!artifact || artifact.artifact_type !== expectedType) {
            throw new ArtifactIndexError(
              "PRODUCT_PACKET_ARTIFACT_TYPE_INVALID",
              `${refKey} does not resolve to indexed ${expectedType}`,
            );
          }
          const inserted = await transaction.unsafe<Array<{ run_id: string }>>(
            `INSERT INTO run_artifact_refs (run_id, ref_key, artifact_hash, created_at)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (run_id, ref_key) DO NOTHING
             RETURNING run_id`,
            [runId, refKey, artifactHash, now],
          );
          refsCreated += inserted.length;
          const refs = await transaction.unsafe<Array<{ artifact_hash: string }>>(
            "SELECT artifact_hash FROM run_artifact_refs WHERE run_id = $1 AND ref_key = $2",
            [runId, refKey],
          );
          if (refs[0]?.artifact_hash !== artifactHash) {
            throw new ArtifactIndexError(
              "RUN_ARTIFACT_REF_CONFLICT",
              `Run artifact reference ${runId}/${refKey} is already sealed to another hash`,
            );
          }
        }

        const packetInserted = await transaction.unsafe<Array<{ run_id: string }>>(
          `INSERT INTO product_packets (run_id, packet_hash, compiler_metadata, sealed_at)
           VALUES ($1, $2, $3::text::jsonb, $4)
           ON CONFLICT (run_id) DO NOTHING
           RETURNING run_id`,
          [runId, packetHash, JSON.stringify(compiler), now],
        );
        const packets = await transaction.unsafe<Array<{
          packet_hash: string;
          compiler_metadata: unknown;
          sealed_at: Date | string;
        }>>(
          "SELECT packet_hash, compiler_metadata, sealed_at FROM product_packets WHERE run_id = $1",
          [runId],
        );
        const packet = packets[0];
        const existingCompiler = packet
          ? CompilerIdentityV1Schema.parse(jsonObject(
              packet.compiler_metadata,
              "PRODUCT_PACKET_COMPILER_INVALID",
            ))
          : undefined;
        if (
          !packet
          || packet.packet_hash !== packetHash
          || existingCompiler?.version !== compiler.version
          || existingCompiler.codeSha !== compiler.codeSha
        ) {
          throw new ArtifactIndexError(
            "PRODUCT_PACKET_SEAL_CONFLICT",
            `Run ${runId} product packet row conflicts with this activation`,
          );
        }
        const activated = await transaction.unsafe<Array<{ id: string }>>(
          `UPDATE runs SET packet_hash = $2, updated_at = $3
            WHERE id = $1 AND packet_hash IS NULL
            RETURNING id`,
          [runId, packetHash, now],
        );
        const finalRuns = await transaction.unsafe<Array<{ packet_hash: string | null }>>(
          "SELECT packet_hash FROM runs WHERE id = $1",
          [runId],
        );
        if (finalRuns[0]?.packet_hash !== packetHash) {
          throw new ArtifactIndexError(
            "PRODUCT_PACKET_SEAL_CONFLICT",
            `Run ${runId} packet activation did not converge on the exact hash`,
          );
        }
        return {
          created: refsCreated > 0 || packetInserted.length === 1 || activated.length === 1,
          runId,
          packetHash,
          compiler: existingCompiler,
          sealedAt: timestamp(packet.sealed_at),
        };
      }) as Promise<Readonly<{
        created: boolean;
        runId: string;
        packetHash: string;
        compiler: CompilerIdentityV1;
        sealedAt: string;
      }>>;
    },

    async sealProductPacket(input: Readonly<{
      runId: string;
      packetHash: string;
      compiler: CompilerIdentityV1;
      now?: Date;
    }>): Promise<Readonly<{
      created: boolean;
      runId: string;
      packetHash: string;
      compiler: CompilerIdentityV1;
      sealedAt: string;
    }>> {
      const runId = z.string().min(1).max(200).parse(input.runId);
      const packetHash = Sha256Schema.parse(input.packetHash);
      const compiler = CompilerIdentityV1Schema.parse(input.compiler);
      const now = validTime(input.now);
      return sql.begin(async (transaction) => {
        const artifact = await readArtifact(transaction, packetHash);
        if (
          !artifact
          || !["setfarm.product-build-packet.v1", "setfarm.product-build-packet.v2"].includes(artifact.artifact_type)
        ) {
          throw new ArtifactIndexError(
            "PRODUCT_PACKET_ARTIFACT_TYPE_INVALID",
            `Packet ${packetHash} is not an indexed Product Build Packet v1 or v2 artifact`,
          );
        }
        const inserted = await transaction.unsafe<Array<{ run_id: string }>>(
          `INSERT INTO product_packets (run_id, packet_hash, compiler_metadata, sealed_at)
           VALUES ($1, $2, $3::text::jsonb, $4)
           ON CONFLICT (run_id) DO NOTHING
           RETURNING run_id`,
          [runId, packetHash, JSON.stringify(compiler), now],
        );
        const rows = await transaction.unsafe<Array<{
          packet_hash: string;
          compiler_metadata: unknown;
          sealed_at: Date | string;
        }>>(
          "SELECT packet_hash, compiler_metadata, sealed_at FROM product_packets WHERE run_id = $1",
          [runId],
        );
        const existing = rows[0];
        const existingCompiler = existing
          ? CompilerIdentityV1Schema.parse(jsonObject(existing.compiler_metadata, "PRODUCT_PACKET_COMPILER_INVALID"))
          : undefined;
        if (
          !existing
          || existing.packet_hash !== packetHash
          || existingCompiler?.version !== compiler.version
          || existingCompiler.codeSha !== compiler.codeSha
        ) {
          throw new ArtifactIndexError(
            "PRODUCT_PACKET_SEAL_CONFLICT",
            `Run ${runId} is already sealed to a different Product Build Packet identity`,
          );
        }
        return {
          created: inserted.length === 1,
          runId,
          packetHash,
          compiler: existingCompiler,
          sealedAt: timestamp(existing.sealed_at),
        };
      }) as Promise<Readonly<{
        created: boolean;
        runId: string;
        packetHash: string;
        compiler: CompilerIdentityV1;
        sealedAt: string;
      }>>;
    },
  });
}

export function createArtifactIndex(sql: Sql) {
  return createArtifactIndexWithLeaseTimeAuthority(sql, "database");
}

/** Test-only deterministic clock authority; production leases always use PostgreSQL time. */
export function createArtifactIndexForTests(sql: Sql) {
  return createArtifactIndexWithLeaseTimeAuthority(sql, "caller-test");
}

async function finalizePublicationBatch(
  sql: Sql,
  leaseTimeAuthority: ArtifactLeaseTimeAuthority,
  input: Readonly<{
    batchReservationId: string;
    authority: "owned" | "expired";
    ownerInstanceId?: string;
    leaseToken?: string;
    batchIdentityHash?: string;
    expectedLeaseToken?: string;
    expectedLeaseExpiresAt?: string;
    resolution: "released" | "quarantined";
    diagnostic: string;
    now?: Date;
  }>,
): Promise<ArtifactPublicationBatchLifecycle> {
  const batchReservationId = ArtifactPublicationBatchReservationIdSchema.parse(
    input.batchReservationId,
  );
  const diagnostic = z.string().min(1).max(4_000).parse(input.diagnostic.trim());
  const owner = input.authority === "owned"
    ? OwnerIdSchema.parse(input.ownerInstanceId)
    : undefined;
  const leaseToken = input.authority === "owned"
    ? z.string().min(1).max(200).parse(input.leaseToken)
    : undefined;
  const batchIdentityHash = input.authority === "expired"
    ? Sha256Schema.parse(input.batchIdentityHash)
    : undefined;
  const expectedLeaseToken = input.authority === "expired"
    ? z.string().min(1).max(200).parse(input.expectedLeaseToken)
    : undefined;
  const expectedLeaseExpiresAt = input.authority === "expired"
    ? validTime(new Date(z.string().datetime({ offset: true }).parse(
        input.expectedLeaseExpiresAt,
      ))).toISOString()
    : undefined;
  if (leaseTimeAuthority === "caller-test") validTime(input.now);
  return sql.begin(async (transaction) => {
    await lockCapacity(transaction);
    const aggregate = await lockPublicationBatchAggregate(transaction, batchReservationId);
    const now = await artifactLeaseAuthorityNow(transaction, input.now, leaseTimeAuthority);
    const lifecycle = mapPublicationBatchLifecycle(aggregate.batch);
    if (lifecycle.state !== "active") {
      throw new ArtifactIndexError(
        "ARTIFACT_BATCH_TERMINAL",
        `Artifact publication batch ${batchReservationId} is terminal in ${lifecycle.state} state`,
      );
    }
    if (input.authority === "owned") {
      if (
        lifecycle.ownerInstanceId !== owner
        || lifecycle.leaseToken !== leaseToken
        || !lifecycle.leaseExpiresAt
        || new Date(lifecycle.leaseExpiresAt).getTime() <= now.getTime()
      ) {
        throw new ArtifactIndexError(
          "ARTIFACT_BATCH_LEASE_LOST",
          `Artifact publication batch ${batchReservationId} finalization lost its aggregate fence`,
        );
      }
    } else {
      if (
        aggregate.batch.batch_identity_hash !== batchIdentityHash
        || lifecycle.leaseToken !== expectedLeaseToken
        || lifecycle.leaseExpiresAt !== expectedLeaseExpiresAt
      ) {
        throw new ArtifactIndexError(
          "ARTIFACT_BATCH_LEASE_LOST",
          `Artifact publication batch ${batchReservationId} expired observation lost its aggregate generation`,
        );
      }
      if (
        !lifecycle.leaseExpiresAt
        || new Date(lifecycle.leaseExpiresAt).getTime() > now.getTime()
      ) {
        throw new ArtifactIndexError(
          "ARTIFACT_BATCH_NOT_EXPIRED",
          `Artifact publication batch ${batchReservationId} is not the exact expired aggregate`,
        );
      }
    }
    if (aggregate.reservations.some((reservation) =>
      reservation.state !== "reserved" && reservation.state !== "published")) {
      throw new ArtifactIndexError(
        "ARTIFACT_BATCH_INCOMPLETE",
        `Artifact publication batch ${batchReservationId} has a split terminal child set`,
      );
    }
    const reserved = aggregate.reservations.filter((reservation) => reservation.state === "reserved");
    if (reserved.length === 0) {
      throw new ArtifactIndexError(
        "ARTIFACT_BATCH_INCOMPLETE",
        `Artifact publication batch ${batchReservationId} has no remaining reservation to finalize`,
      );
    }
    let reservedBytes = 0;
    for (const reservation of reserved) {
      reservedBytes = addBatchBytes(
        reservedBytes,
        safeInteger(reservation.byte_length, "ARTIFACT_INDEX_BYTE_LENGTH_INVALID"),
      );
    }
    await transaction.unsafe(
      `UPDATE artifact_capacity
          SET reserved_bytes = reserved_bytes - $1,
              state = CASE WHEN $3 = 'quarantined' THEN 'quarantined' ELSE state END,
              diagnostic = CASE WHEN $3 = 'quarantined' THEN $4 ELSE diagnostic END,
              reconciled_at = CASE WHEN $3 = 'quarantined' THEN $2 ELSE reconciled_at END,
              updated_at = $2
        WHERE capacity_key = 'semantic-artifacts'`,
      [reservedBytes, now, input.resolution, diagnostic],
    );
    const updatedReservations = await transaction.unsafe<ReservationRow[]>(
      `UPDATE artifact_publication_reservations
          SET state = $2, owner_instance_id = NULL, lease_token = NULL,
              lease_expires_at = NULL, diagnostic = $3,
              finalized_at = $4, updated_at = $4
        WHERE reservation_id = ANY($1::text[])
          AND state = 'reserved'
        RETURNING *`,
      [reserved.map((reservation) => reservation.reservation_id), input.resolution, diagnostic, now],
    );
    const updatedBatchRows = await transaction.unsafe<PublicationBatchRow[]>(
      `UPDATE artifact_publication_batches
          SET state = $2, owner_instance_id = NULL, lease_token = NULL,
              lease_expires_at = NULL, diagnostic = $3,
              finalized_at = $4, updated_at = $4
        WHERE batch_reservation_id = $1
        RETURNING *`,
      [batchReservationId, input.resolution, diagnostic, now],
    );
    const published = aggregate.reservations.filter((reservation) => reservation.state === "published");
    return mapPublicationBatchAggregateLifecycle(
      updatedBatchRows[0]!,
      [...published, ...updatedReservations].sort((left, right) =>
        left.reservation_id.localeCompare(right.reservation_id)),
    );
  }) as Promise<ArtifactPublicationBatchLifecycle>;
}

async function finalizeExpiredReservation(
  sql: Sql,
  leaseTimeAuthority: ArtifactLeaseTimeAuthority,
  input: Readonly<{
    reservationId: string;
    resolution: "released" | "quarantined";
    diagnostic?: string;
    now?: Date;
  }>,
): Promise<ArtifactPublicationReservation> {
  const reservationId = ReservationIdSchema.parse(input.reservationId);
  assertNotBatchChildReservation(reservationId);
  if (leaseTimeAuthority === "caller-test") validTime(input.now);
  return sql.begin(async (transaction) => {
    await lockCapacity(transaction);
    const rows = await transaction.unsafe<ReservationRow[]>(
      "SELECT * FROM artifact_publication_reservations WHERE reservation_id = $1 FOR UPDATE",
      [reservationId],
    );
    const reservation = rows[0];
    if (!reservation) throw new ArtifactIndexError("ARTIFACT_RESERVATION_NOT_FOUND", `Unknown artifact reservation ${reservationId}`);
    const now = await artifactLeaseAuthorityNow(
      transaction,
      input.now,
      leaseTimeAuthority,
    );
    if (
      reservation.state !== "reserved"
      || !reservation.lease_expires_at
      || new Date(reservation.lease_expires_at).getTime() > now.getTime()
    ) {
      throw new ArtifactIndexError(
        "ARTIFACT_RESERVATION_NOT_EXPIRED",
        `Artifact reservation ${reservationId} is not expired and finalizable`,
      );
    }
    const byteLength = safeInteger(reservation.byte_length, "ARTIFACT_INDEX_BYTE_LENGTH_INVALID");
    const diagnostic = input.diagnostic?.trim().slice(0, 4_000) || null;
    await transaction.unsafe(
      `UPDATE artifact_capacity
          SET reserved_bytes = reserved_bytes - $1,
              state = CASE WHEN $3 = 'quarantined' THEN 'quarantined' ELSE state END,
              diagnostic = CASE WHEN $3 = 'quarantined' THEN $4 ELSE diagnostic END,
              reconciled_at = CASE WHEN $3 = 'quarantined' THEN $2 ELSE reconciled_at END,
              updated_at = $2
        WHERE capacity_key = 'semantic-artifacts'`,
      [byteLength, now, input.resolution, diagnostic],
    );
    const updated = await transaction.unsafe<ReservationRow[]>(
      `UPDATE artifact_publication_reservations
          SET state = $2, owner_instance_id = NULL, lease_token = NULL,
              lease_expires_at = NULL, diagnostic = $3,
              finalized_at = $4, updated_at = $4
        WHERE reservation_id = $1
        RETURNING *`,
      [
        reservationId,
        input.resolution,
        diagnostic,
        now,
      ],
    );
    return mapReservation(updated[0]!);
  }) as Promise<ArtifactPublicationReservation>;
}
