import type postgres from "postgres";

import type { ArtifactCapacityLimits } from "../product-compiler/artifact-capacity.js";
import {
  ContentAddressedArtifactStore,
  isHybridAuthorityBackedArtifactStore,
  type ArtifactGetResult,
} from "../product-compiler/artifact-store.js";
import { hashCanonicalJson } from "../product-compiler/canonical-json.js";
import { SemanticArtifactProducerV1Schema } from "../product-compiler/schemas/common-v1.js";
import {
  RuntimeArtifactReaderError,
  type SealedRuntimePacket,
} from "../product-compiler/runtime-artifact-reader.js";
import { resolveArtifactStorePublicationAuthorityMode } from "../runtime-config.js";
import {
  DESIGN_CANDIDATE_AUTHORITY_EVIDENCE_SCHEMA_V2,
  DESIGN_CANDIDATE_AUTHORITY_REQUESTER_V2,
  STITCH_TARGET_CANDIDATE_SELECTION_FAILURE_ARTIFACT_TYPE_V2,
  STITCH_TARGET_CANDIDATE_SELECTION_FAILURE_REF_KEY_V2,
  OperationalDesignCandidateAuthorityTerminationEvidenceV1Schema,
  createOperationalFailureIdentityV2,
} from "../execution/schemas/operational-failure-identity-v2.js";
import {
  ProductBuildAuthorityV1Schema,
  type ProductBuildAuthorityV1,
} from "./schemas/product-build-authority-v1.js";
import {
  ProductBuildAuthorityV2Schema,
  ProductBuildRefusalV2Schema,
  StitchTargetCandidateSelectionFailureEnvelopeV1Schema,
  type ProductBuildAuthorityV2,
  type ProductBuildRefusalV2,
} from "./schemas/product-build-authority-v2.js";

export type ProductBuildAuthorityReader = Readonly<{
  readSealedPacket(runId: string): Promise<SealedRuntimePacket>;
  auditTerminalPacket(runId: string): Promise<SealedRuntimePacket>;
}>;

type ReadOnlySql = Pick<postgres.Sql, "unsafe">;

export type OperationalArtifactReadPort = Readonly<{
  get(artifactHash: string): Promise<ArtifactGetResult>;
}>;

export type CanonicalTerminationProjection = Readonly<{
  ref: string;
  requestId: string;
  runRef: string;
  targetStatus: string;
  state: string;
  requestedBy: string;
  evidence: Readonly<Record<string, unknown>>;
}>;

export type VerifiedDesignCandidateRefusalReadOptions = Readonly<{
  sql: ReadOnlySql;
  artifactRoot: string;
  artifactLimits: ArtifactCapacityLimits;
  artifactReadPort?: OperationalArtifactReadPort;
  terminationRequest?: CanonicalTerminationProjection;
}>;

export type ProductBuildAuthorityV2ErrorCode =
  | "PRODUCT_BUILD_REFUSAL_TERMINATION_AMBIGUOUS"
  | "PRODUCT_BUILD_REFUSAL_TERMINATION_INVALID"
  | "PRODUCT_BUILD_REFUSAL_ARTIFACT_REF_MISSING"
  | "PRODUCT_BUILD_REFUSAL_ARTIFACT_REF_INVALID"
  | "PRODUCT_BUILD_REFUSAL_ARTIFACT_INDEX_INVALID"
  | "PRODUCT_BUILD_REFUSAL_ARTIFACT_AUTHORITY_REQUIRED"
  | "PRODUCT_BUILD_REFUSAL_ARTIFACT_STORE_INVALID";

export class ProductBuildAuthorityV2Error extends Error {
  readonly code: ProductBuildAuthorityV2ErrorCode;

  constructor(code: ProductBuildAuthorityV2ErrorCode, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "ProductBuildAuthorityV2Error";
    this.code = code;
  }
}

type RawDesignTermination = Readonly<{
  request_id: string;
  target_status: string;
  state: string;
  requested_by: string;
  evidence: unknown;
}>;

type RawFailureArtifactRef = Readonly<{
  artifact_hash: string;
  artifact_type: string;
  byte_length: string | number;
  producer_metadata: unknown;
}>;

function terminationRef(requestId: string): string {
  return `setfarm://run-termination/${encodeURIComponent(requestId)}`;
}

function jsonObject(value: unknown): Record<string, unknown> {
  const parsed = typeof value === "string" ? JSON.parse(value) as unknown : value;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new ProductBuildAuthorityV2Error(
      "PRODUCT_BUILD_REFUSAL_TERMINATION_INVALID",
      "Typed design refusal evidence is not a JSON object",
    );
  }
  return parsed as Record<string, unknown>;
}

function parseByteLength(value: string | number): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new ProductBuildAuthorityV2Error(
      "PRODUCT_BUILD_REFUSAL_ARTIFACT_INDEX_INVALID",
      "Typed design refusal artifact index byte length is invalid",
    );
  }
  return parsed;
}

async function readDesignTermination(
  sql: ReadOnlySql,
  runId: string,
): Promise<CanonicalTerminationProjection | null> {
  const rows = await sql.unsafe<RawDesignTermination[]>(
    `SELECT request_id, target_status, state, requested_by, evidence
       FROM run_termination_requests
      WHERE run_id = $1 AND requested_by = $2
      ORDER BY request_id`,
    [runId, DESIGN_CANDIDATE_AUTHORITY_REQUESTER_V2],
  );
  if (rows.length === 0) return null;
  if (rows.length !== 1) {
    throw new ProductBuildAuthorityV2Error(
      "PRODUCT_BUILD_REFUSAL_TERMINATION_AMBIGUOUS",
      `Run ${runId} has multiple typed design refusal termination rows`,
    );
  }
  const row = rows[0]!;
  return {
    ref: terminationRef(row.request_id),
    requestId: row.request_id,
    runRef: `setfarm://run/${encodeURIComponent(runId)}`,
    targetStatus: row.target_status,
    state: row.state,
    requestedBy: row.requested_by,
    evidence: jsonObject(row.evidence),
  };
}

/**
 * Resolves one typed pre-packet design refusal through every authoritative
 * layer: terminal request, immutable run ref, semantic index, and CAS bytes.
 */
export async function readVerifiedDesignCandidateRefusal(
  runId: string,
  options: VerifiedDesignCandidateRefusalReadOptions,
): Promise<ProductBuildRefusalV2 | null> {
  const termination = options.terminationRequest
    ?? await readDesignTermination(options.sql, runId);
  if (!termination) return null;
  if (
    termination.targetStatus !== "failed"
    || termination.state !== "terminalized"
    || termination.requestedBy !== DESIGN_CANDIDATE_AUTHORITY_REQUESTER_V2
    || termination.ref !== terminationRef(termination.requestId)
    || termination.runRef !== `setfarm://run/${encodeURIComponent(runId)}`
  ) {
    throw new ProductBuildAuthorityV2Error(
      "PRODUCT_BUILD_REFUSAL_TERMINATION_INVALID",
      `Run ${runId} typed design refusal is not a canonical failed terminal request`,
    );
  }

  const evidenceResult = OperationalDesignCandidateAuthorityTerminationEvidenceV1Schema.safeParse(
    termination.evidence,
  );
  if (!evidenceResult.success) {
    throw new ProductBuildAuthorityV2Error(
      "PRODUCT_BUILD_REFUSAL_TERMINATION_INVALID",
      `Run ${runId} typed design refusal evidence is invalid`,
      { cause: evidenceResult.error },
    );
  }
  const evidence = evidenceResult.data;
  const refs = await options.sql.unsafe<RawFailureArtifactRef[]>(
    `SELECT r.artifact_hash, a.artifact_type, a.byte_length, a.producer_metadata
       FROM run_artifact_refs r
       JOIN semantic_artifacts a ON a.artifact_hash = r.artifact_hash
      WHERE r.run_id = $1 AND r.ref_key = $2`,
    [runId, STITCH_TARGET_CANDIDATE_SELECTION_FAILURE_REF_KEY_V2],
  );
  if (refs.length === 0) {
    throw new ProductBuildAuthorityV2Error(
      "PRODUCT_BUILD_REFUSAL_ARTIFACT_REF_MISSING",
      `Run ${runId} typed design refusal has no immutable failure artifact ref`,
    );
  }
  if (refs.length !== 1) {
    throw new ProductBuildAuthorityV2Error(
      "PRODUCT_BUILD_REFUSAL_ARTIFACT_REF_INVALID",
      `Run ${runId} typed design refusal artifact ref is ambiguous`,
    );
  }
  const reference = refs[0]!;
  if (
    reference.artifact_type !== STITCH_TARGET_CANDIDATE_SELECTION_FAILURE_ARTIFACT_TYPE_V2
    || reference.artifact_hash !== evidence.failureArtifactHash
  ) {
    throw new ProductBuildAuthorityV2Error(
      "PRODUCT_BUILD_REFUSAL_ARTIFACT_REF_INVALID",
      `Run ${runId} typed design refusal ref differs from termination evidence`,
    );
  }

  const indexedProducer = SemanticArtifactProducerV1Schema.safeParse(reference.producer_metadata);
  if (!indexedProducer.success) {
    throw new ProductBuildAuthorityV2Error(
      "PRODUCT_BUILD_REFUSAL_ARTIFACT_INDEX_INVALID",
      `Run ${runId} typed design refusal index producer is invalid`,
      { cause: indexedProducer.error },
    );
  }
  const indexedByteLength = parseByteLength(reference.byte_length);
  if (
    resolveArtifactStorePublicationAuthorityMode() === "hybrid-required"
    && !isHybridAuthorityBackedArtifactStore(options.artifactReadPort)
  ) {
    throw new ProductBuildAuthorityV2Error(
      "PRODUCT_BUILD_REFUSAL_ARTIFACT_AUTHORITY_REQUIRED",
      `Run ${runId} typed design refusal requires the canonical hybrid artifact read port`,
    );
  }
  const store = options.artifactReadPort
    ?? new ContentAddressedArtifactStore(options.artifactRoot, {
      limits: options.artifactLimits,
    });
  let stored;
  try {
    stored = await store.get(reference.artifact_hash);
  } catch (error) {
    throw new ProductBuildAuthorityV2Error(
      "PRODUCT_BUILD_REFUSAL_ARTIFACT_STORE_INVALID",
      `Run ${runId} typed design refusal CAS artifact is missing or corrupt`,
      { cause: error },
    );
  }
  const envelopeResult = StitchTargetCandidateSelectionFailureEnvelopeV1Schema.safeParse(
    stored.envelope,
  );
  if (
    !envelopeResult.success
    || stored.bytes.byteLength !== indexedByteLength
    || hashCanonicalJson(indexedProducer.data) !== hashCanonicalJson(stored.envelope.producer)
    || hashCanonicalJson(stored.envelope) !== reference.artifact_hash
  ) {
    throw new ProductBuildAuthorityV2Error(
      "PRODUCT_BUILD_REFUSAL_ARTIFACT_INDEX_INVALID",
      `Run ${runId} typed design refusal CAS envelope differs from its immutable index`,
      { cause: envelopeResult.success ? undefined : envelopeResult.error },
    );
  }
  const envelope = envelopeResult.data;
  if (
    envelope.payload.fingerprint !== evidence.failureFingerprint
    || envelope.payload.candidateSelectionHash !== evidence.candidateSelectionHash
  ) {
    throw new ProductBuildAuthorityV2Error(
      "PRODUCT_BUILD_REFUSAL_ARTIFACT_REF_INVALID",
      `Run ${runId} typed design refusal payload differs from termination evidence`,
    );
  }

  const failureIdentity = createOperationalFailureIdentityV2({
    requestedBy: termination.requestedBy,
    evidenceSchema: DESIGN_CANDIDATE_AUTHORITY_EVIDENCE_SCHEMA_V2,
    operationalCause: evidence.operationalFailureCause,
    exactFailure: {
      schema: "setfarm.operational-exact-failure-identity.v2",
      kind: "stitch_target_candidate_selection",
      refKey: evidence.failureRefKey,
      artifactType: evidence.failureArtifactType,
      failureArtifactHash: reference.artifact_hash,
      failureFingerprint: envelope.payload.fingerprint,
      candidateSelectionHash: envelope.payload.candidateSelectionHash,
    },
  });
  return ProductBuildRefusalV2Schema.parse({
    terminationRequestRef: termination.ref,
    failureIdentity,
    failureArtifact: {
      refKey: STITCH_TARGET_CANDIDATE_SELECTION_FAILURE_REF_KEY_V2,
      artifactHash: reference.artifact_hash,
      envelope,
    },
  });
}

export function produceProductBuildAuthorityV1(packet: SealedRuntimePacket): ProductBuildAuthorityV1 {
  const identity = {
    schema: "setfarm.product-build-authority.v1" as const,
    ...packet,
  };
  return ProductBuildAuthorityV1Schema.parse({
    ...identity,
    authorityHash: hashCanonicalJson(identity),
  });
}

export function produceSealedProductBuildAuthorityV2(
  packet: SealedRuntimePacket,
): ProductBuildAuthorityV2 {
  const packetAuthority = produceProductBuildAuthorityV1(packet);
  const identity = {
    schema: "setfarm.product-build-authority.v2" as const,
    runId: packet.runId,
    disposition: "sealed_packet" as const,
    packetAuthority,
    refusal: null,
  };
  return ProductBuildAuthorityV2Schema.parse({
    ...identity,
    authorityHash: hashCanonicalJson(identity),
  });
}

export function produceRefusedProductBuildAuthorityV2(
  runId: string,
  refusal: ProductBuildRefusalV2,
): ProductBuildAuthorityV2 {
  const identity = {
    schema: "setfarm.product-build-authority.v2" as const,
    runId,
    disposition: "refused_before_packet" as const,
    packetAuthority: null,
    refusal,
  };
  return ProductBuildAuthorityV2Schema.parse({
    ...identity,
    authorityHash: hashCanonicalJson(identity),
  });
}

export async function readProductBuildAuthorityV1(
  reader: ProductBuildAuthorityReader,
  runId: string,
): Promise<ProductBuildAuthorityV1> {
  try {
    return produceProductBuildAuthorityV1(await reader.readSealedPacket(runId));
  } catch (error) {
    if (
      error instanceof RuntimeArtifactReaderError
      && error.code === "RUNTIME_PACKET_NOT_ACTIVE"
    ) {
      return produceProductBuildAuthorityV1(await reader.auditTerminalPacket(runId));
    }
    throw error;
  }
}

async function readPacketForAnyOwnedRun(
  reader: ProductBuildAuthorityReader,
  runId: string,
): Promise<SealedRuntimePacket> {
  try {
    return await reader.readSealedPacket(runId);
  } catch (error) {
    if (
      error instanceof RuntimeArtifactReaderError
      && error.code === "RUNTIME_PACKET_NOT_ACTIVE"
    ) {
      return reader.auditTerminalPacket(runId);
    }
    throw error;
  }
}

export async function readProductBuildAuthorityV2(
  reader: ProductBuildAuthorityReader,
  runId: string,
  options: VerifiedDesignCandidateRefusalReadOptions,
): Promise<ProductBuildAuthorityV2> {
  try {
    return produceSealedProductBuildAuthorityV2(
      await readPacketForAnyOwnedRun(reader, runId),
    );
  } catch (error) {
    if (
      !(error instanceof RuntimeArtifactReaderError)
      || error.code !== "RUNTIME_PACKET_NOT_SEALED"
    ) {
      throw error;
    }
    const refusal = await readVerifiedDesignCandidateRefusal(runId, options);
    if (!refusal) throw error;
    return produceRefusedProductBuildAuthorityV2(runId, refusal);
  }
}

/** Default operational reader is v2; v1 remains an explicit migration view. */
export async function readVersionedProductBuildAuthority(input: Readonly<{
  schema?: "v1" | "v2";
  reader: ProductBuildAuthorityReader;
  runId: string;
  refusalOptions: VerifiedDesignCandidateRefusalReadOptions;
}>): Promise<ProductBuildAuthorityV1 | ProductBuildAuthorityV2> {
  return input.schema === "v1"
    ? readProductBuildAuthorityV1(input.reader, input.runId)
    : readProductBuildAuthorityV2(input.reader, input.runId, input.refusalOptions);
}
