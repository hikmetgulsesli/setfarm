import { z } from "zod";

import { SemanticArtifactEnvelopeV1Schema } from "../artifact-envelope.js";
import {
  DEFAULT_CANONICAL_JSON_BOUNDED_WORK_LIMITS,
  canonicalJsonBytesBounded,
} from "../bounded-canonical-json.js";
import { hashCanonicalJson } from "../canonical-json.js";
import {
  GitCodeShaSchema,
  Sha256Schema,
} from "./common-v1.js";
import {
  ImplementationSourceMapAuthorityV2Schema,
  ImplementationSourceMapExecutionV2Schema,
  ImplementationSourceMapProducerV2Schema,
  IMPLEMENTATION_SOURCE_MAP_ARTIFACT_TYPE_V2,
  IMPLEMENTATION_SOURCE_MAP_CONTRACT_HASH_V2,
  IMPLEMENTATION_SOURCE_MAP_V2_MAX_CANONICAL_BYTES,
  IMPLEMENTATION_SOURCE_MAP_V2_SCHEMA,
  IMPLEMENTATION_SOURCE_MAP_V2_VERSION,
  hashImplementationSourceMapAuthorityV2,
} from "./implementation-source-map-v2.js";

export const PRODUCT_BUILD_PACKET_ARTIFACT_TYPE_V4 =
  "setfarm.product-build-packet.v4" as const;
export const PRODUCT_BUILD_PACKET_V4_SCHEMA =
  "setfarm.product-build-packet.v4" as const;
export const PRODUCT_BUILD_PACKET_V4_VERSION = "4.0.0" as const;
export const PRODUCT_BUILD_PACKET_V4_MAX_CANONICAL_BYTES = 4 * 1024 * 1024;
export const PRODUCT_BUILD_PACKET_V4_BOUNDED_WORK_LIMITS = Object.freeze({
  maxDepth: DEFAULT_CANONICAL_JSON_BOUNDED_WORK_LIMITS.maxDepth + 28,
  maxNodes: PRODUCT_BUILD_PACKET_V4_MAX_CANONICAL_BYTES + 100_000,
  maxContainerEntries:
    DEFAULT_CANONICAL_JSON_BOUNDED_WORK_LIMITS.maxContainerEntries,
  maxWorkUnits:
    (PRODUCT_BUILD_PACKET_V4_MAX_CANONICAL_BYTES * 8) + (4 * 1024 * 1024),
});

export const PRODUCT_BUILD_PACKET_V4_BLOCKER_CODES = Object.freeze([
  "PRODUCT_BUILD_PACKET_V4_ATOMIC_ARTIFACT_SET_ACTIVATION_UNVERIFIED",
  "PRODUCT_BUILD_PACKET_V4_AUTHENTICATED_BUILD_TEST_EVIDENCE_UNVERIFIED",
  "PRODUCT_BUILD_PACKET_V4_EVIDENCE_REGISTRY_V2_UNVERIFIED",
  "PRODUCT_BUILD_PACKET_V4_IMPLEMENTATION_SLICE_V2_UNVERIFIED",
  "PRODUCT_BUILD_PACKET_V4_RELEASE_MANIFEST_UNVERIFIED",
] as const);

export const PRODUCT_BUILD_PACKET_V4_VALIDATION_IDS = Object.freeze([
  "VALIDATE_PACKET_V4_ATTEMPT_RECEIPTS_EXCLUDED",
  "VALIDATE_PACKET_V4_INDIVIDUAL_CAS_PREFLIGHT",
  "VALIDATE_PACKET_V4_LOGICAL_EXECUTION_EXACT",
  "VALIDATE_PACKET_V4_SOURCE_MAP_FORWARD_BINDING",
  "VALIDATE_PACKET_V4_SOURCE_MAP_ROOT_FRESH",
  "VALIDATE_PACKET_V4_UPSTREAM_AUTHORITY_EXACT",
] as const);

export const PRODUCT_BUILD_PACKET_CONTRACT_V4 = Object.freeze({
  schema: "setfarm.product-build-packet-contract.v4" as const,
  contractVersion: PRODUCT_BUILD_PACKET_V4_VERSION,
  branch: "realization_v4" as const,
  stage: "source_map_verified_before_implementation_slice_v2" as const,
  authority: Object.freeze({
    sourceMap:
      "fresh_exact_root_envelope_and_complete_authority_body" as const,
    packetDirection: "packet_binds_source_map_root_never_reverse" as const,
    storyProjection: "future_slice_carries_one_bounded_merkle_proof" as const,
    execution:
      "build_topology_v3_compilation_logical_commands_and_runtime" as const,
  }),
  retryIdentity: Object.freeze({
    semantic: "packet_hash" as const,
    logicalSourceReceipts: "included" as const,
    operationalAttemptReceipts: "excluded" as const,
    candidateBuildReceipt:
      "future_authenticated_attempt_evidence_not_packet_identity" as const,
  }),
  publication: Object.freeze({
    preflightDurabilityTier: 0 as const,
    packetEnvelope:
      "individually_passes_artifact_store_batch_plan_v1" as const,
    currentBatchCapacity: 9 as const,
    atomicArtifactSetActivation: "unverified_and_forbidden" as const,
  }),
  forbiddenInputs: Object.freeze([
    "product_build_packet_v1",
    "product_build_packet_v2",
    "product_build_packet_v3",
    "implementation_source_map_v1",
    "story_plan_v2",
    "caller_authored_packet_reference",
    "caller_authored_source_map_reference",
    "dependency_receipt_hash",
    "environment_receipt_hash",
    "private_source_materialization_receipt",
    "stdout_or_stderr_hash",
    "timestamp",
    "candidate_commit_or_tree",
  ] as const),
  blockerCodes: PRODUCT_BUILD_PACKET_V4_BLOCKER_CODES,
  validationIds: PRODUCT_BUILD_PACKET_V4_VALIDATION_IDS,
  hashDomain: "setfarm.product-build-packet-hash.v4" as const,
} as const);

export const PRODUCT_BUILD_PACKET_CONTRACT_HASH_V4 = hashCanonicalJson(
  PRODUCT_BUILD_PACKET_CONTRACT_V4,
);

const PacketBlockerCodeV4Schema = z.enum(
  PRODUCT_BUILD_PACKET_V4_BLOCKER_CODES,
);
const PacketValidationIdV4Schema = z.enum(
  PRODUCT_BUILD_PACKET_V4_VALIDATION_IDS,
);

export const ProductBuildPacketProducerV4Schema = z.object({
  pass: z.literal("product-compiler-product-build-packet-v4"),
  codeSha: GitCodeShaSchema,
  toolVersions: z.object({
    implementationSourceMap: z.literal(IMPLEMENTATION_SOURCE_MAP_V2_VERSION),
    productBuildPacket: z.literal(PRODUCT_BUILD_PACKET_V4_VERSION),
  }).strict(),
}).strict();

export type ProductBuildPacketProducerV4 = z.infer<
  typeof ProductBuildPacketProducerV4Schema
>;

export const ProductBuildPacketSourceMapRootBindingV4Schema = z.object({
  artifactType: z.literal(IMPLEMENTATION_SOURCE_MAP_ARTIFACT_TYPE_V2),
  schema: z.literal(IMPLEMENTATION_SOURCE_MAP_V2_SCHEMA),
  version: z.literal(IMPLEMENTATION_SOURCE_MAP_V2_VERSION),
  contractHash: z.literal(IMPLEMENTATION_SOURCE_MAP_CONTRACT_HASH_V2),
  producer: ImplementationSourceMapProducerV2Schema,
  rootEnvelopeHash: Sha256Schema,
  rootEnvelopeByteLength: z.number().int().positive()
    .max(IMPLEMENTATION_SOURCE_MAP_V2_MAX_CANONICAL_BYTES),
  manifestHash: Sha256Schema,
  authorityHash: Sha256Schema,
  merkleRoot: Sha256Schema,
  leafCount: z.number().int().positive().max(5_000),
  storyIdSetHash: Sha256Schema,
  direction: z.literal("packet_v4_binds_source_map_v2_root"),
}).strict();

export type ProductBuildPacketSourceMapRootBindingV4 = z.infer<
  typeof ProductBuildPacketSourceMapRootBindingV4Schema
>;

export const ProductBuildPacketLogicalSourceAuthorityV4Schema = z.object({
  runtimeLogicalReceiptHash: Sha256Schema,
  testLogicalReceiptHash: Sha256Schema,
  operationalReceiptHashes: z.tuple([]),
  disposition: z.literal(
    "logical_source_identity_included_operational_attempt_identity_excluded",
  ),
}).strict();

const CandidateBuildPrerequisiteV4Schema = z.object({
  requiredReceiptSchema: z.literal("setfarm.candidate-build-receipt.v2"),
  currentState: z.literal("absent"),
  disposition: z.literal(
    "future_authenticated_attempt_evidence_not_packet_identity",
  ),
}).strict();

const ProductBuildPacketIdentityV4Schema = z.object({
  schema: z.literal(PRODUCT_BUILD_PACKET_V4_SCHEMA),
  packetVersion: z.literal(4),
  semanticVersion: z.literal(PRODUCT_BUILD_PACKET_V4_VERSION),
  contractHash: z.literal(PRODUCT_BUILD_PACKET_CONTRACT_HASH_V4),
  branch: z.literal("realization_v4"),
  stage: z.literal("source_map_verified_before_implementation_slice_v2"),
  readiness: z.object({
    status: z.literal("shadow_sealed"),
    productionUse: z.literal("forbidden"),
    blockerCodes: z.array(PacketBlockerCodeV4Schema)
      .length(PRODUCT_BUILD_PACKET_V4_BLOCKER_CODES.length),
  }).strict(),
  sourceMapAuthority: ImplementationSourceMapAuthorityV2Schema,
  sourceMapAuthorityHash: Sha256Schema,
  sourceMapRoot: ProductBuildPacketSourceMapRootBindingV4Schema,
  execution: ImplementationSourceMapExecutionV2Schema,
  logicalSourceAuthority: ProductBuildPacketLogicalSourceAuthorityV4Schema,
  candidateBuild: CandidateBuildPrerequisiteV4Schema,
  validationIds: z.array(PacketValidationIdV4Schema)
    .length(PRODUCT_BUILD_PACKET_V4_VALIDATION_IDS.length),
}).strict();

export type ProductBuildPacketHashPayloadV4 = z.infer<
  typeof ProductBuildPacketIdentityV4Schema
>;

export function hashProductBuildPacketV4(
  value: ProductBuildPacketHashPayloadV4 | ProductBuildPacketV4,
): string {
  const payload = { ...value } as Record<string, unknown>;
  delete payload.packetHash;
  return hashCanonicalJson({
    schema: "setfarm.product-build-packet-hash.v4",
    packet: payload,
  });
}

function packetClosureIssuesV4(
  value: ProductBuildPacketHashPayloadV4 & { packetHash: string },
  context: z.RefinementCtx,
): void {
  const authority = value.sourceMapAuthority;
  if (
    JSON.stringify(value.readiness.blockerCodes)
      !== JSON.stringify(PRODUCT_BUILD_PACKET_V4_BLOCKER_CODES)
    || JSON.stringify(value.validationIds)
      !== JSON.stringify(PRODUCT_BUILD_PACKET_V4_VALIDATION_IDS)
  ) {
    context.addIssue({
      code: "custom",
      path: ["readiness"],
      message: "Packet readiness and validation sets must equal code-owned V4 sets",
    });
  }
  if (
    value.sourceMapAuthorityHash
      !== hashImplementationSourceMapAuthorityV2(authority)
    || value.sourceMapRoot.authorityHash !== value.sourceMapAuthorityHash
    || value.sourceMapRoot.leafCount !== authority.storyPlan.storyCount
  ) {
    context.addIssue({
      code: "custom",
      path: ["sourceMapAuthorityHash"],
      message: "Packet must bind the complete exact SourceMapV2 authority and root",
    });
  }
  if (
    value.execution.compilationContractHash
      !== authority.buildTopology.compilationContractHash
    || value.execution.commandContractHash
      !== authority.buildTopology.commandContractHash
    || value.execution.runtimeContractHash
      !== authority.buildTopology.runtimeContractHash
  ) {
    context.addIssue({
      code: "custom",
      path: ["execution"],
      message: "Packet execution must equal SourceMap BuildTopologyV3 authority",
    });
  }
  if (
    value.logicalSourceAuthority.runtimeLogicalReceiptHash
      !== authority.runtimeSource.logicalReceiptHash
    || value.logicalSourceAuthority.testLogicalReceiptHash
      !== authority.testSource.logicalReceiptHash
  ) {
    context.addIssue({
      code: "custom",
      path: ["logicalSourceAuthority"],
      message: "Packet logical sources must equal SourceMap runtime and test authority",
    });
  }
  if (value.packetHash !== hashProductBuildPacketV4(value)) {
    context.addIssue({
      code: "custom",
      path: ["packetHash"],
      message: "Packet hash must bind the complete V4 payload",
    });
  }
}

const ProductBuildPacketCandidateV4Schema =
  ProductBuildPacketIdentityV4Schema.extend({
    packetHash: Sha256Schema,
  }).strict().superRefine(packetClosureIssuesV4);

export const ProductBuildPacketV4Schema = z.unknown()
  .superRefine((value, context) => {
    try {
      canonicalJsonBytesBounded(value, {
        maxBytes: PRODUCT_BUILD_PACKET_V4_MAX_CANONICAL_BYTES,
        ...PRODUCT_BUILD_PACKET_V4_BOUNDED_WORK_LIMITS,
      });
    } catch {
      context.addIssue({
        code: "custom",
        message: "ProductBuildPacketV4 exceeds canonical byte or work bounds",
      });
    }
  }).pipe(ProductBuildPacketCandidateV4Schema);

export type ProductBuildPacketV4 = z.infer<
  typeof ProductBuildPacketCandidateV4Schema
>;

export const ProductBuildPacketEnvelopeV4Schema =
  SemanticArtifactEnvelopeV1Schema.extend({
    artifactType: z.literal(PRODUCT_BUILD_PACKET_ARTIFACT_TYPE_V4),
    producer: ProductBuildPacketProducerV4Schema,
    payload: ProductBuildPacketV4Schema,
  }).strict().superRefine((value, context) => {
    if (value.producer.codeSha !== value.payload.sourceMapRoot.producer.codeSha) {
      context.addIssue({
        code: "custom",
        path: ["producer", "codeSha"],
        message: "Packet and SourceMap producers must use the same code revision",
      });
    }
  });

export type ProductBuildPacketEnvelopeV4 = z.infer<
  typeof ProductBuildPacketEnvelopeV4Schema
>;

export function recursivelyFreezeProductBuildPacketV4<T>(value: T): T {
  if (value === null || typeof value !== "object") return value;
  const pending: object[] = [value as object];
  while (pending.length > 0) {
    const current = pending.pop()!;
    if (Object.isFrozen(current)) continue;
    for (const child of Object.values(current)) {
      if (child !== null && typeof child === "object" && !Object.isFrozen(child)) {
        pending.push(child);
      }
    }
    Object.freeze(current);
  }
  return value;
}
