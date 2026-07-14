import { randomUUID } from "node:crypto";

import type postgres from "postgres";
import { z } from "zod";

import {
  CompilerIdentityV1Schema,
  SemanticArtifactProducerV1Schema,
  Sha256Schema,
  type CompilerIdentityV1,
  type SemanticArtifactProducerV1,
} from "./schemas/common-v1.js";

type Sql = postgres.Sql;
type TransactionSql = postgres.TransactionSql;

const ArtifactTypeSchema = z.string().min(1).max(200).regex(
  /^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)+$/,
  "Expected a versioned semantic artifact type",
);
const ReservationIdSchema = z.string().min(1).max(200);
const OwnerIdSchema = z.string().min(1).max(200);
const RefKeySchema = z.string().min(1).max(160).regex(/^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)*$/);

const PRODUCT_PACKET_REF_TYPES = Object.freeze({
  PRODUCT_SPEC: "setfarm.product-spec.v1",
  DESIGN_GRAPH: "setfarm.design-interaction-graph.v1",
  BUILD_TOPOLOGY: "setfarm.build-topology.v1",
  STORY_PLAN: "setfarm.story-plan.v1",
  PRODUCT_BUILD_PACKET: "setfarm.product-build-packet.v1",
  COMPILATION_REPORT: "setfarm.product-compilation-report.v1",
} as const);

const ArtifactIdentitySchema = z.object({
  hash: Sha256Schema,
  artifactType: ArtifactTypeSchema,
  byteLength: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  producer: SemanticArtifactProducerV1Schema,
}).strict();

export type ArtifactIdentity = z.infer<typeof ArtifactIdentitySchema>;

export type ArtifactIndexErrorCode =
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

function leaseDuration(value?: number): number {
  const duration = Math.trunc(value ?? 2 * 60_000);
  if (!Number.isFinite(duration)) throw new TypeError("Artifact reservation lease is invalid");
  return Math.max(100, Math.min(duration, 30 * 60_000));
}

function identityFromRow(row: ArtifactRow | ReservationRow): ArtifactIdentity {
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

function sameProducer(left: SemanticArtifactProducerV1, right: SemanticArtifactProducerV1): boolean {
  return left.pass === right.pass
    && left.codeSha === right.codeSha
    && left.model === right.model
    && left.promptHash === right.promptHash
    && JSON.stringify(Object.entries(left.toolVersions).sort(([a], [b]) => a.localeCompare(b)))
      === JSON.stringify(Object.entries(right.toolVersions).sort(([a], [b]) => a.localeCompare(b)));
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

export function createArtifactIndex(sql: Sql) {
  return Object.freeze({
    async getCapacity(): Promise<ArtifactCapacityState> {
      const rows = await sql.unsafe<CapacityRow[]>(
        "SELECT * FROM artifact_capacity WHERE capacity_key = 'semantic-artifacts'",
      );
      if (rows.length !== 1) throw new Error("ARTIFACT_CAPACITY_SINGLETON_INVALID");
      return mapCapacity(rows[0]!);
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
      const artifact = ArtifactIdentitySchema.parse(input.artifact);
      const ownerInstanceId = OwnerIdSchema.parse(input.ownerInstanceId);
      const now = validTime(input.now);
      const expiresAt = new Date(now.getTime() + leaseDuration(input.leaseMs));
      return sql.begin(async (transaction) => {
        const capacity = await lockCapacity(transaction);
        if (capacity.state !== "ready") {
          throw new ArtifactIndexError(
            "ARTIFACT_INDEX_NOT_READY",
            "Artifact index must complete exact bootstrap reconciliation before publication",
          );
        }
        const indexed = await readArtifact(transaction, artifact.hash);
        if (indexed) {
          assertIdentity(identityFromRow(indexed), artifact);
          return { status: "already_published" as const, artifact: mapArtifact(indexed) };
        }
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
          throw new ArtifactIndexError(
            "ARTIFACT_RESERVATION_ID_REUSED",
            `Artifact reservation ${reservationId} is already finalized or owned by another publisher`,
          );
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
      const owner = OwnerIdSchema.parse(input.ownerInstanceId);
      const leaseToken = z.string().min(1).max(200).parse(input.leaseToken);
      const now = validTime(input.now);
      const expiresAt = new Date(now.getTime() + leaseDuration(input.leaseMs));
      const rows = await sql.unsafe<ReservationRow[]>(
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
      const owner = OwnerIdSchema.parse(input.ownerInstanceId);
      const leaseToken = z.string().min(1).max(200).parse(input.leaseToken);
      const diagnostic = z.string().min(1).max(4_000).parse(input.diagnostic.trim());
      const now = validTime(input.now);
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
      const artifact = ArtifactIdentitySchema.parse(input.artifact);
      const owner = OwnerIdSchema.parse(input.ownerInstanceId);
      const leaseToken = z.string().min(1).max(200).parse(input.leaseToken);
      const now = validTime(input.now);
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
      const now = validTime(nowInput);
      const rows = await sql.unsafe<ReservationRow[]>(
        `SELECT * FROM artifact_publication_reservations
          WHERE state = 'reserved' AND lease_expires_at <= $1
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
      const artifact = ArtifactIdentitySchema.parse(input.artifact);
      const owner = OwnerIdSchema.parse(input.ownerInstanceId);
      const now = validTime(input.now);
      const expiresAt = new Date(now.getTime() + leaseDuration(input.leaseMs));
      return sql.begin(async (transaction) => {
        await lockCapacity(transaction);
        const rows = await transaction.unsafe<ReservationRow[]>(
          "SELECT * FROM artifact_publication_reservations WHERE reservation_id = $1 FOR UPDATE",
          [reservationId],
        );
        const reservation = rows[0];
        if (!reservation) throw new ArtifactIndexError("ARTIFACT_RESERVATION_NOT_FOUND", `Unknown artifact reservation ${reservationId}`);
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
      return finalizeExpiredReservation(sql, { ...input, resolution: "released" });
    },

    async quarantineExpired(input: Readonly<{
      reservationId: string;
      diagnostic: string;
      now?: Date;
    }>): Promise<ArtifactPublicationReservation> {
      if (!input.diagnostic.trim()) throw new TypeError("Artifact quarantine diagnostic must not be empty");
      return finalizeExpiredReservation(sql, { ...input, resolution: "quarantined" });
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
      artifactRefs: Readonly<Record<keyof typeof PRODUCT_PACKET_REF_TYPES, string>>;
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
      const expectedKeys = Object.keys(PRODUCT_PACKET_REF_TYPES).sort();
      const observedKeys = Object.keys(rawRefs).sort();
      if (
        observedKeys.length !== expectedKeys.length
        || observedKeys.some((key, index) => key !== expectedKeys[index])
        || rawRefs.PRODUCT_BUILD_PACKET !== packetHash
      ) {
        throw new ArtifactIndexError(
          "PRODUCT_PACKET_REFS_INCOMPLETE",
          "Product packet activation requires the exact canonical artifact reference set",
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

        let refsCreated = 0;
        for (const refKey of expectedKeys) {
          const artifactHash = rawRefs[refKey]!;
          const artifact = await readArtifact(transaction, artifactHash);
          const expectedType = PRODUCT_PACKET_REF_TYPES[
            refKey as keyof typeof PRODUCT_PACKET_REF_TYPES
          ];
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
        if (!artifact || artifact.artifact_type !== "setfarm.product-build-packet.v1") {
          throw new ArtifactIndexError(
            "PRODUCT_PACKET_ARTIFACT_TYPE_INVALID",
            `Packet ${packetHash} is not an indexed Product Build Packet v1 artifact`,
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

async function finalizeExpiredReservation(
  sql: Sql,
  input: Readonly<{
    reservationId: string;
    resolution: "released" | "quarantined";
    diagnostic?: string;
    now?: Date;
  }>,
): Promise<ArtifactPublicationReservation> {
  const reservationId = ReservationIdSchema.parse(input.reservationId);
  const now = validTime(input.now);
  return sql.begin(async (transaction) => {
    await lockCapacity(transaction);
    const rows = await transaction.unsafe<ReservationRow[]>(
      "SELECT * FROM artifact_publication_reservations WHERE reservation_id = $1 FOR UPDATE",
      [reservationId],
    );
    const reservation = rows[0];
    if (!reservation) throw new ArtifactIndexError("ARTIFACT_RESERVATION_NOT_FOUND", `Unknown artifact reservation ${reservationId}`);
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
