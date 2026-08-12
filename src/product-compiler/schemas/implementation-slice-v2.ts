import { z } from "zod";

// V25's immutable preparation-authority migration digest binds the historical
// import path for this leaf schema. Keep only that narrow compatibility export;
// the legacy slice envelope and compiler remain explicit `-legacy` modules.
export { ImplementationDependencyOutputV2Schema } from
  "./implementation-slice-v2-legacy.js";

import { SemanticArtifactEnvelopeV1Schema } from "../artifact-envelope.js";
import {
  DEFAULT_CANONICAL_JSON_BOUNDED_WORK_LIMITS,
  canonicalJsonBytesBounded,
} from "../bounded-canonical-json.js";
import { hashCanonicalJson } from "../canonical-json.js";
import {
  GitCodeShaSchema,
  PathBindingIdSchema,
  Sha256Schema,
  StoryIdSchema,
} from "./common-v1.js";
import {
  ImplementationSourceMapLeafRefV2Schema,
  ImplementationSourceMapProducerV2Schema,
  ImplementationSourceMapProofStepV2Schema,
  IMPLEMENTATION_SOURCE_MAP_ARTIFACT_TYPE_V2,
  IMPLEMENTATION_SOURCE_MAP_CONTRACT_HASH_V2,
  IMPLEMENTATION_SOURCE_MAP_STORY_LEAF_ARTIFACT_TYPE_V2,
  IMPLEMENTATION_SOURCE_MAP_STORY_LEAF_V2_SCHEMA,
  IMPLEMENTATION_SOURCE_MAP_STORY_PROOF_V2_SCHEMA,
  IMPLEMENTATION_SOURCE_MAP_V2_VERSION,
  hashImplementationSourceMapMerkleLeafV2,
  hashImplementationSourceMapMerklePairV2,
  hashImplementationSourceMapMerkleUnaryV2,
} from "./implementation-source-map-v2.js";
import {
  ProductBuildPacketProducerV4Schema,
  PRODUCT_BUILD_PACKET_ARTIFACT_TYPE_V4,
  PRODUCT_BUILD_PACKET_CONTRACT_HASH_V4,
  PRODUCT_BUILD_PACKET_V4_SCHEMA,
  PRODUCT_BUILD_PACKET_V4_VERSION,
} from "./product-build-packet-v4.js";

export const IMPLEMENTATION_SLICE_ARTIFACT_TYPE_V2 =
  "setfarm.implementation-slice.v2" as const;
export const IMPLEMENTATION_SLICE_V2_SCHEMA =
  "setfarm.implementation-slice.v2" as const;
export const IMPLEMENTATION_SLICE_V2_VERSION = "2.0.0" as const;
export const IMPLEMENTATION_SLICE_V2_MAX_CANONICAL_BYTES = 4 * 1024 * 1024;
export const IMPLEMENTATION_SLICE_V2_BOUNDED_WORK_LIMITS = Object.freeze({
  maxDepth: DEFAULT_CANONICAL_JSON_BOUNDED_WORK_LIMITS.maxDepth + 28,
  maxNodes: IMPLEMENTATION_SLICE_V2_MAX_CANONICAL_BYTES + 100_000,
  maxContainerEntries:
    DEFAULT_CANONICAL_JSON_BOUNDED_WORK_LIMITS.maxContainerEntries,
  maxWorkUnits:
    (IMPLEMENTATION_SLICE_V2_MAX_CANONICAL_BYTES * 8) + (4 * 1024 * 1024),
});

export const IMPLEMENTATION_SLICE_V2_BLOCKER_CODES = Object.freeze([
  "IMPLEMENTATION_SLICE_V2_ATOMIC_ARTIFACT_SET_ACTIVATION_UNVERIFIED",
  "IMPLEMENTATION_SLICE_V2_AUTHENTICATED_CANDIDATE_EVIDENCE_UNVERIFIED",
  "IMPLEMENTATION_SLICE_V2_EVIDENCE_ADAPTER_REGISTRY_V2_UNVERIFIED",
  "IMPLEMENTATION_SLICE_V2_EVIDENCE_PLAN_V2_UNVERIFIED",
  "IMPLEMENTATION_SLICE_V2_RELEASE_MANIFEST_UNVERIFIED",
] as const);

export const IMPLEMENTATION_SLICE_V2_VALIDATION_IDS = Object.freeze([
  "VALIDATE_SLICE_V2_GENERATOR_OWNERSHIP_EXACT",
  "VALIDATE_SLICE_V2_INDIVIDUAL_CAS_PREFLIGHT",
  "VALIDATE_SLICE_V2_LEGACY_WIRE_REJECTED",
  "VALIDATE_SLICE_V2_MODEL_WRITE_AUTHORITY_EMPTY",
  "VALIDATE_SLICE_V2_PACKET_V4_FRESH",
  "VALIDATE_SLICE_V2_SOURCE_MAP_PROOF_FRESH",
  "VALIDATE_SLICE_V2_STORY_PROJECTION_EXACT",
] as const);

export const IMPLEMENTATION_SLICE_CONTRACT_V2 = Object.freeze({
  schema: "setfarm.implementation-slice-contract.v2" as const,
  contractVersion: IMPLEMENTATION_SLICE_V2_VERSION,
  stage: "packet_v4_and_story_proof_verified_before_evidence_plan_v2" as const,
  artifactGraph: Object.freeze({
    packet: "exact_cas_envelope_binding_not_embedded" as const,
    storyProof: "compact_merkle_binding_with_exact_leaf_cas_ref" as const,
    verifiedAttachments:
      "fresh_packet_and_one_story_proof_returned_outside_payload" as const,
    maximumEnvelopeBytes: IMPLEMENTATION_SLICE_V2_MAX_CANONICAL_BYTES,
  }),
  implementation: Object.freeze({
    mode: "generated_sources_complete_no_model_dispatch" as const,
    modelDispatch: "forbidden" as const,
    modelWritablePathRefs: "exact_empty" as const,
    runtimeOwner: "OWNER_NODE_PRODUCT_RUNTIME_GENERATOR_V2" as const,
    testOwner: "OWNER_NODE_PRODUCT_TEST_GENERATOR_V2" as const,
  }),
  retryIdentity: Object.freeze({
    semantic: "slice_hash" as const,
    operationalAttemptReceipts: "excluded" as const,
    recoveryDirective: "future_typed_delta_artifact_only" as const,
  }),
  publication: Object.freeze({
    preflightDurabilityTier: 0 as const,
    atomicArtifactSetActivation: "unverified_and_forbidden" as const,
  }),
  legacy: Object.freeze({
    numericSliceVersion: 2 as const,
    disposition: "explicit_legacy_module_read_replay_only" as const,
    projectionToCanonical: "forbidden" as const,
  }),
  forbiddenInputs: Object.freeze([
    "product_build_packet_v3",
    "story_plan_v2",
    "implementation_source_map_v1",
    "full_source_map_root_in_slice_payload",
    "full_story_leaf_envelope_in_slice_payload",
    "unrelated_story_leaf",
    "source_revision",
    "worktree_snapshot",
    "dependency_attempt_receipt",
    "source_materialization_receipt",
    "candidate_commit_or_tree",
    "recovery_prose",
    "model_writable_path",
  ] as const),
  blockerCodes: IMPLEMENTATION_SLICE_V2_BLOCKER_CODES,
  validationIds: IMPLEMENTATION_SLICE_V2_VALIDATION_IDS,
  hashDomains: Object.freeze({
    packetBinding: "setfarm.implementation-slice-packet-binding-hash.v2" as const,
    proofBinding: "setfarm.implementation-slice-proof-binding-hash.v2" as const,
    disposition: "setfarm.implementation-slice-disposition-hash.v2" as const,
    slice: "setfarm.implementation-slice-hash.v2" as const,
  }),
} as const);

export const IMPLEMENTATION_SLICE_CONTRACT_HASH_V2 = hashCanonicalJson(
  IMPLEMENTATION_SLICE_CONTRACT_V2,
);

const SliceBlockerCodeV2Schema = z.enum(IMPLEMENTATION_SLICE_V2_BLOCKER_CODES);
const SliceValidationIdV2Schema = z.enum(IMPLEMENTATION_SLICE_V2_VALIDATION_IDS);

export const ImplementationSliceProducerV2Schema = z.object({
  pass: z.literal("product-compiler-implementation-slice-v2"),
  codeSha: GitCodeShaSchema,
  toolVersions: z.object({
    implementationSlice: z.literal(IMPLEMENTATION_SLICE_V2_VERSION),
    implementationSourceMap: z.literal(IMPLEMENTATION_SOURCE_MAP_V2_VERSION),
    productBuildPacket: z.literal(PRODUCT_BUILD_PACKET_V4_VERSION),
  }).strict(),
}).strict();

export type ImplementationSliceProducerV2 = z.infer<
  typeof ImplementationSliceProducerV2Schema
>;

const PacketBindingIdentityV2Schema = z.object({
  artifactType: z.literal(PRODUCT_BUILD_PACKET_ARTIFACT_TYPE_V4),
  schema: z.literal(PRODUCT_BUILD_PACKET_V4_SCHEMA),
  version: z.literal(PRODUCT_BUILD_PACKET_V4_VERSION),
  contractHash: z.literal(PRODUCT_BUILD_PACKET_CONTRACT_HASH_V4),
  producer: ProductBuildPacketProducerV4Schema,
  packetHash: Sha256Schema,
  envelopeHash: Sha256Schema,
  envelopeByteLength: z.number().int().positive().max(4 * 1024 * 1024),
  sourceMapRoot: z.object({
    artifactType: z.literal(IMPLEMENTATION_SOURCE_MAP_ARTIFACT_TYPE_V2),
    envelopeHash: Sha256Schema,
    manifestHash: Sha256Schema,
    authorityHash: Sha256Schema,
    merkleRoot: Sha256Schema,
    leafCount: z.number().int().positive().max(5_000),
    storyIdSetHash: Sha256Schema,
  }).strict(),
}).strict();

export type ImplementationSlicePacketBindingHashPayloadV2 = z.infer<
  typeof PacketBindingIdentityV2Schema
>;

export function hashImplementationSlicePacketBindingV2(
  value:
    | ImplementationSlicePacketBindingHashPayloadV2
    | ImplementationSlicePacketBindingV2,
): string {
  const payload = { ...value } as Record<string, unknown>;
  delete payload.bindingHash;
  return hashCanonicalJson({
    schema: "setfarm.implementation-slice-packet-binding-hash.v2",
    binding: payload,
  });
}

export const ImplementationSlicePacketBindingV2Schema =
  PacketBindingIdentityV2Schema.extend({
    bindingHash: Sha256Schema,
  }).strict().superRefine((value, context) => {
    if (value.bindingHash !== hashImplementationSlicePacketBindingV2(value)) {
      context.addIssue({
        code: "custom",
        path: ["bindingHash"],
        message: "Slice PacketV4 binding hash must bind the exact CAS identity",
      });
    }
  });

export type ImplementationSlicePacketBindingV2 = z.infer<
  typeof ImplementationSlicePacketBindingV2Schema
>;

const ProofRootIdentityV2Schema = z.object({
  artifactType: z.literal(IMPLEMENTATION_SOURCE_MAP_ARTIFACT_TYPE_V2),
  envelopeHash: Sha256Schema,
  manifestHash: Sha256Schema,
  authorityHash: Sha256Schema,
  merkleRoot: Sha256Schema,
  leafCount: z.number().int().positive().max(5_000),
  storyIdSetHash: Sha256Schema,
}).strict();

const ProofBindingIdentityV2Schema = z.object({
  schema: z.literal("setfarm.implementation-source-map-story-proof-binding.v2"),
  proofSchema: z.literal(IMPLEMENTATION_SOURCE_MAP_STORY_PROOF_V2_SCHEMA),
  proofVersion: z.literal(IMPLEMENTATION_SOURCE_MAP_V2_VERSION),
  proofHash: Sha256Schema,
  root: ProofRootIdentityV2Schema,
  leaf: z.object({
    artifactType: z.literal(
      IMPLEMENTATION_SOURCE_MAP_STORY_LEAF_ARTIFACT_TYPE_V2,
    ),
    schema: z.literal(IMPLEMENTATION_SOURCE_MAP_STORY_LEAF_V2_SCHEMA),
    reference: ImplementationSourceMapLeafRefV2Schema,
    leafHash: Sha256Schema,
  }).strict(),
  auditPath: z.array(ImplementationSourceMapProofStepV2Schema).max(14),
}).strict();

export type ImplementationSliceProofBindingHashPayloadV2 = z.infer<
  typeof ProofBindingIdentityV2Schema
>;

export function hashImplementationSliceProofBindingV2(
  value:
    | ImplementationSliceProofBindingHashPayloadV2
    | ImplementationSliceProofBindingV2,
): string {
  const payload = { ...value } as Record<string, unknown>;
  delete payload.bindingHash;
  return hashCanonicalJson({
    schema: "setfarm.implementation-slice-proof-binding-hash.v2",
    binding: payload,
  });
}

function compactProofPathClosesV2(
  value: ImplementationSliceProofBindingHashPayloadV2,
): boolean {
  const reference = value.leaf.reference;
  if (reference.index >= value.root.leafCount) return false;
  let current = hashImplementationSourceMapMerkleLeafV2(reference);
  let currentIndex = reference.index;
  let currentCount = value.root.leafCount;
  for (const step of value.auditPath) {
    if (currentCount <= 1) return false;
    const oddTail = currentCount % 2 === 1
      && currentIndex === currentCount - 1;
    const expected = oddTail
      ? "unary"
      : currentIndex % 2 === 0 ? "right" : "left";
    if (step.kind !== expected) return false;
    current = step.kind === "unary"
      ? hashImplementationSourceMapMerkleUnaryV2(current)
      : step.kind === "right"
        ? hashImplementationSourceMapMerklePairV2(current, step.siblingHash)
        : hashImplementationSourceMapMerklePairV2(step.siblingHash, current);
    currentIndex = Math.floor(currentIndex / 2);
    currentCount = Math.ceil(currentCount / 2);
  }
  return currentCount === 1 && current === value.root.merkleRoot;
}

export const ImplementationSliceProofBindingV2Schema =
  ProofBindingIdentityV2Schema.extend({
    bindingHash: Sha256Schema,
  }).strict().superRefine((value, context) => {
    if (
      !compactProofPathClosesV2(value)
      || value.bindingHash !== hashImplementationSliceProofBindingV2(value)
    ) {
      context.addIssue({
        code: "custom",
        path: ["auditPath"],
        message: "Compact story proof binding must close exact path, root and hash",
      });
    }
  });

export type ImplementationSliceProofBindingV2 = z.infer<
  typeof ImplementationSliceProofBindingV2Schema
>;

const ImplementationDispositionIdentityV2Schema = z.object({
  mode: z.literal("generated_sources_complete_no_model_dispatch"),
  modelDispatch: z.literal("forbidden"),
  modelWritablePathRefs: z.tuple([]),
  runtimeSource: z.object({
    ownerRef: z.literal("OWNER_NODE_PRODUCT_RUNTIME_GENERATOR_V2"),
    pathRef: PathBindingIdSchema,
    logicalReceiptHash: Sha256Schema,
    sourceIdentityHash: Sha256Schema,
  }).strict(),
  testSource: z.object({
    ownerRef: z.literal("OWNER_NODE_PRODUCT_TEST_GENERATOR_V2"),
    pathRef: PathBindingIdSchema,
    logicalReceiptHash: Sha256Schema,
    sourceIdentityHash: Sha256Schema,
  }).strict(),
  execution: z.object({
    compilationContractHash: Sha256Schema,
    commandContractHash: Sha256Schema,
    runtimeContractHash: Sha256Schema,
  }).strict(),
  evidenceBindingCount: z.number().int().positive().max(20_000),
}).strict();

export type ImplementationSliceDispositionHashPayloadV2 = z.infer<
  typeof ImplementationDispositionIdentityV2Schema
>;

export function hashImplementationSliceDispositionV2(
  value:
    | ImplementationSliceDispositionHashPayloadV2
    | ImplementationSliceDispositionV2,
): string {
  const payload = { ...value } as Record<string, unknown>;
  delete payload.dispositionHash;
  return hashCanonicalJson({
    schema: "setfarm.implementation-slice-disposition-hash.v2",
    disposition: payload,
  });
}

export const ImplementationSliceDispositionV2Schema =
  ImplementationDispositionIdentityV2Schema.extend({
    dispositionHash: Sha256Schema,
  }).strict().superRefine((value, context) => {
    if (value.dispositionHash !== hashImplementationSliceDispositionV2(value)) {
      context.addIssue({
        code: "custom",
        path: ["dispositionHash"],
        message: "Slice disposition hash must bind exact no-dispatch authority",
      });
    }
  });

export type ImplementationSliceDispositionV2 = z.infer<
  typeof ImplementationSliceDispositionV2Schema
>;

const SliceIdentityV2Schema = z.object({
  schema: z.literal(IMPLEMENTATION_SLICE_V2_SCHEMA),
  sliceVersion: z.literal(IMPLEMENTATION_SLICE_V2_VERSION),
  contractHash: z.literal(IMPLEMENTATION_SLICE_CONTRACT_HASH_V2),
  stage: z.literal(
    "packet_v4_and_story_proof_verified_before_evidence_plan_v2",
  ),
  readiness: z.object({
    status: z.literal("shadow_sealed"),
    productionUse: z.literal("forbidden"),
    blockerCodes: z.array(SliceBlockerCodeV2Schema)
      .length(IMPLEMENTATION_SLICE_V2_BLOCKER_CODES.length),
  }).strict(),
  packet: ImplementationSlicePacketBindingV2Schema,
  storyProof: ImplementationSliceProofBindingV2Schema,
  story: z.object({
    storyId: StoryIdSchema,
    storyHash: Sha256Schema,
    order: z.number().int().positive().max(5_000),
  }).strict(),
  implementation: ImplementationSliceDispositionV2Schema,
  validationIds: z.array(SliceValidationIdV2Schema)
    .length(IMPLEMENTATION_SLICE_V2_VALIDATION_IDS.length),
}).strict();

export type ImplementationSliceHashPayloadV2 = z.infer<
  typeof SliceIdentityV2Schema
>;

export function hashImplementationSliceV2(
  value: ImplementationSliceHashPayloadV2 | ImplementationSliceV2,
): string {
  const payload = { ...value } as Record<string, unknown>;
  delete payload.sliceHash;
  return hashCanonicalJson({
    schema: "setfarm.implementation-slice-hash.v2",
    slice: payload,
  });
}

function sliceClosureIssuesV2(
  value: ImplementationSliceHashPayloadV2 & { sliceHash: string },
  context: z.RefinementCtx,
): void {
  const packetRoot = value.packet.sourceMapRoot;
  const proofRoot = value.storyProof.root;
  const reference = value.storyProof.leaf.reference;
  if (
    JSON.stringify(value.readiness.blockerCodes)
      !== JSON.stringify(IMPLEMENTATION_SLICE_V2_BLOCKER_CODES)
    || JSON.stringify(value.validationIds)
      !== JSON.stringify(IMPLEMENTATION_SLICE_V2_VALIDATION_IDS)
  ) {
    context.addIssue({
      code: "custom",
      path: ["readiness"],
      message: "Slice blockers and validations must equal exact code-owned sets",
    });
  }
  if (JSON.stringify(packetRoot) !== JSON.stringify(proofRoot)) {
    context.addIssue({
      code: "custom",
      path: ["storyProof", "root"],
      message: "Slice proof root must equal the PacketV4 SourceMap root binding",
    });
  }
  if (
    value.story.storyId !== reference.storyId
    || value.story.storyHash !== reference.storyHash
    || value.story.order !== reference.index + 1
  ) {
    context.addIssue({
      code: "custom",
      path: ["story"],
      message: "Slice story must equal the exact proof leaf reference",
    });
  }
  if (value.sliceHash !== hashImplementationSliceV2(value)) {
    context.addIssue({
      code: "custom",
      path: ["sliceHash"],
      message: "Slice hash must bind the complete compact V2 manifest",
    });
  }
}

const ImplementationSliceCandidateV2Schema = SliceIdentityV2Schema.extend({
  sliceHash: Sha256Schema,
}).strict().superRefine(sliceClosureIssuesV2);

export const ImplementationSliceV2Schema = z.unknown()
  .superRefine((value, context) => {
    try {
      canonicalJsonBytesBounded(value, {
        maxBytes: IMPLEMENTATION_SLICE_V2_MAX_CANONICAL_BYTES,
        ...IMPLEMENTATION_SLICE_V2_BOUNDED_WORK_LIMITS,
      });
    } catch {
      context.addIssue({
        code: "custom",
        message: "ImplementationSliceV2 exceeds canonical byte or work bounds",
      });
    }
  }).pipe(ImplementationSliceCandidateV2Schema);

export type ImplementationSliceV2 = z.infer<
  typeof ImplementationSliceCandidateV2Schema
>;

export const ImplementationSliceEnvelopeV2Schema =
  SemanticArtifactEnvelopeV1Schema.extend({
    artifactType: z.literal(IMPLEMENTATION_SLICE_ARTIFACT_TYPE_V2),
    producer: ImplementationSliceProducerV2Schema,
    payload: ImplementationSliceV2Schema,
  }).strict().superRefine((value, context) => {
    if (value.producer.codeSha !== value.payload.packet.producer.codeSha) {
      context.addIssue({
        code: "custom",
        path: ["producer", "codeSha"],
        message: "Slice and PacketV4 producers must use the same code revision",
      });
    }
  });

export type ImplementationSliceEnvelopeV2 = z.infer<
  typeof ImplementationSliceEnvelopeV2Schema
>;

export function recursivelyFreezeImplementationSliceV2<T>(value: T): T {
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
