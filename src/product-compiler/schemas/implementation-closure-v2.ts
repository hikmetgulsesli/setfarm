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
  StoryIdSchema,
} from "./common-v1.js";
import {
  ImplementationSlicePacketBindingV2Schema,
  IMPLEMENTATION_SLICE_ARTIFACT_TYPE_V2,
  IMPLEMENTATION_SLICE_V2_SCHEMA,
  IMPLEMENTATION_SLICE_V2_VERSION,
} from "./implementation-slice-v2.js";
import {
  ImplementationSourceMapLeafRefV2Schema,
  IMPLEMENTATION_SOURCE_MAP_V2_VERSION,
  hashImplementationSourceMapStoryIdSetV2,
} from "./implementation-source-map-v2.js";
import { PRODUCT_BUILD_PACKET_V4_VERSION } from
  "./product-build-packet-v4.js";

export const IMPLEMENTATION_CLOSURE_ARTIFACT_TYPE_V2 =
  "setfarm.implementation-closure.v2" as const;
export const IMPLEMENTATION_CLOSURE_V2_SCHEMA =
  IMPLEMENTATION_CLOSURE_ARTIFACT_TYPE_V2;
export const IMPLEMENTATION_CLOSURE_STORY_ENTRY_V2_SCHEMA =
  "setfarm.implementation-closure-story-entry.v2" as const;
export const IMPLEMENTATION_CLOSURE_V2_VERSION = "2.0.0" as const;
export const IMPLEMENTATION_CLOSURE_V2_MAX_CANONICAL_BYTES = 4 * 1024 * 1024;
export const IMPLEMENTATION_CLOSURE_V2_BOUNDED_WORK_LIMITS = Object.freeze({
  maxDepth: DEFAULT_CANONICAL_JSON_BOUNDED_WORK_LIMITS.maxDepth + 28,
  maxNodes: IMPLEMENTATION_CLOSURE_V2_MAX_CANONICAL_BYTES + 100_000,
  maxContainerEntries:
    DEFAULT_CANONICAL_JSON_BOUNDED_WORK_LIMITS.maxContainerEntries,
  maxWorkUnits:
    (IMPLEMENTATION_CLOSURE_V2_MAX_CANONICAL_BYTES * 8) + (4 * 1024 * 1024),
});

export const IMPLEMENTATION_CLOSURE_V2_BLOCKER_CODES = Object.freeze([
  "IMPLEMENTATION_CLOSURE_V2_ATOMIC_ARTIFACT_SET_ACTIVATION_UNVERIFIED",
  "IMPLEMENTATION_CLOSURE_V2_AUTHENTICATED_CANDIDATE_EVIDENCE_UNVERIFIED",
  "IMPLEMENTATION_CLOSURE_V2_CANDIDATE_SOURCE_UNVERIFIED",
  "IMPLEMENTATION_CLOSURE_V2_EVIDENCE_ADAPTER_REGISTRY_V2_UNVERIFIED",
  "IMPLEMENTATION_CLOSURE_V2_EVIDENCE_PLAN_V2_UNVERIFIED",
  "IMPLEMENTATION_CLOSURE_V2_RELEASE_MANIFEST_UNVERIFIED",
] as const);

export const IMPLEMENTATION_CLOSURE_V2_VALIDATION_IDS = Object.freeze([
  "VALIDATE_IMPLEMENTATION_CLOSURE_V2_EVERY_SOURCE_MAP_STORY_EXACTLY_ONCE",
  "VALIDATE_IMPLEMENTATION_CLOSURE_V2_GENERATED_DISPOSITION_EXACT",
  "VALIDATE_IMPLEMENTATION_CLOSURE_V2_INDIVIDUAL_CAS_PREFLIGHT",
  "VALIDATE_IMPLEMENTATION_CLOSURE_V2_PACKET_V4_FRESH",
  "VALIDATE_IMPLEMENTATION_CLOSURE_V2_SLICE_CANDIDATES_FRESH",
  "VALIDATE_IMPLEMENTATION_CLOSURE_V2_SOURCE_MAP_V2_FRESH",
  "VALIDATE_IMPLEMENTATION_CLOSURE_V2_STORY_ORDER_EXACT",
] as const);

export const IMPLEMENTATION_CLOSURE_CONTRACT_V2 = Object.freeze({
  schema: "setfarm.implementation-closure-contract.v2" as const,
  contractVersion: IMPLEMENTATION_CLOSURE_V2_VERSION,
  stage: "every_story_slice_verified_before_candidate_source_v1" as const,
  completeness: Object.freeze({
    scope: "product" as const,
    membership:
      "every_and_only_source_map_story_has_one_fresh_slice" as const,
    order: "source_map_leaf_index_exact_no_caller_sort_repair" as const,
    storyIdentity: "packet_bound_story_id_set_hash" as const,
  }),
  implementation: Object.freeze({
    mode: "generated_sources_complete_no_model_dispatch" as const,
    modelDispatch: "forbidden" as const,
    modelWritablePathRefs: "exact_empty" as const,
    futureModelAuthoredBranch: "separately_versioned" as const,
  }),
  artifactGraph: Object.freeze({
    packet: "compact_slice_packet_binding" as const,
    stories:
      "leaf_proof_slice_commitments_without_embedded_envelopes" as const,
    maximumEnvelopeBytes: IMPLEMENTATION_CLOSURE_V2_MAX_CANONICAL_BYTES,
  }),
  retryIdentity: Object.freeze({
    semantic: "closure_hash" as const,
    selectedStoryProxy: "forbidden" as const,
    operationalAttemptReceipts: "excluded" as const,
  }),
  publication: Object.freeze({
    preflightDurabilityTier: 0 as const,
    atomicArtifactSetActivation: "unverified_and_forbidden" as const,
  }),
  forbiddenInputs: Object.freeze([
    "selected_story_slice_as_product_completion",
    "missing_duplicate_extra_or_reordered_story_slice",
    "embedded_packet_or_story_envelope",
    "source_revision",
    "filesystem_path",
    "operational_attempt_receipt",
    "model_transcript",
    "recovery_prose",
  ] as const),
  blockerCodes: IMPLEMENTATION_CLOSURE_V2_BLOCKER_CODES,
  validationIds: IMPLEMENTATION_CLOSURE_V2_VALIDATION_IDS,
  hashDomains: Object.freeze({
    storyEntry: "setfarm.implementation-closure-story-entry-hash.v2" as const,
    storyMembership:
      "setfarm.implementation-closure-story-membership-hash.v2" as const,
    productDisposition:
      "setfarm.implementation-closure-product-disposition-hash.v2" as const,
    closure: "setfarm.implementation-closure-hash.v2" as const,
  }),
} as const);

export const IMPLEMENTATION_CLOSURE_CONTRACT_HASH_V2 = hashCanonicalJson(
  IMPLEMENTATION_CLOSURE_CONTRACT_V2,
);

const ClosureBlockerCodeV2Schema = z.enum(
  IMPLEMENTATION_CLOSURE_V2_BLOCKER_CODES,
);
const ClosureValidationIdV2Schema = z.enum(
  IMPLEMENTATION_CLOSURE_V2_VALIDATION_IDS,
);

export const ImplementationClosureProducerV2Schema = z.object({
  pass: z.literal("product-compiler-implementation-closure-v2"),
  codeSha: GitCodeShaSchema,
  toolVersions: z.object({
    implementationClosure: z.literal(IMPLEMENTATION_CLOSURE_V2_VERSION),
    implementationSlice: z.literal(IMPLEMENTATION_SLICE_V2_VERSION),
    implementationSourceMap: z.literal(IMPLEMENTATION_SOURCE_MAP_V2_VERSION),
    productBuildPacket: z.literal(PRODUCT_BUILD_PACKET_V4_VERSION),
  }).strict(),
}).strict();

export type ImplementationClosureProducerV2 = z.infer<
  typeof ImplementationClosureProducerV2Schema
>;

const StoryEntryIdentityV2Schema = z.object({
  schema: z.literal(IMPLEMENTATION_CLOSURE_STORY_ENTRY_V2_SCHEMA),
  story: z.object({
    storyId: StoryIdSchema,
    storyHash: Sha256Schema,
    order: z.number().int().positive().max(5_000),
  }).strict(),
  sourceMap: z.object({
    reference: ImplementationSourceMapLeafRefV2Schema,
    proofHash: Sha256Schema,
    proofBindingHash: Sha256Schema,
  }).strict(),
  slice: z.object({
    artifactType: z.literal(IMPLEMENTATION_SLICE_ARTIFACT_TYPE_V2),
    schema: z.literal(IMPLEMENTATION_SLICE_V2_SCHEMA),
    version: z.literal(IMPLEMENTATION_SLICE_V2_VERSION),
    envelopeHash: Sha256Schema,
    sliceHash: Sha256Schema,
    dispositionHash: Sha256Schema,
  }).strict(),
}).strict();

export type ImplementationClosureStoryEntryHashPayloadV2 = z.infer<
  typeof StoryEntryIdentityV2Schema
>;

export function hashImplementationClosureStoryEntryV2(
  value:
    | ImplementationClosureStoryEntryHashPayloadV2
    | ImplementationClosureStoryEntryV2,
): string {
  const payload = { ...value } as Record<string, unknown>;
  delete payload.entryHash;
  return hashCanonicalJson({
    schema: "setfarm.implementation-closure-story-entry-hash.v2",
    entry: payload,
  });
}

export const ImplementationClosureStoryEntryV2Schema =
  StoryEntryIdentityV2Schema.extend({
    entryHash: Sha256Schema,
  }).strict().superRefine((value, context) => {
    const reference = value.sourceMap.reference;
    if (
      value.story.storyId !== reference.storyId
      || value.story.storyHash !== reference.storyHash
      || value.story.order !== reference.index + 1
      || value.entryHash !== hashImplementationClosureStoryEntryV2(value)
    ) {
      context.addIssue({
        code: "custom",
        path: ["entryHash"],
        message: "Closure story entry must bind one exact SourceMap story and slice",
      });
    }
  });

export type ImplementationClosureStoryEntryV2 = z.infer<
  typeof ImplementationClosureStoryEntryV2Schema
>;

export function hashImplementationClosureStoryMembershipV2(
  entries: readonly Pick<
    ImplementationClosureStoryEntryV2,
    "entryHash" | "story"
  >[],
): string {
  return hashCanonicalJson({
    schema: "setfarm.implementation-closure-story-membership-hash.v2",
    entries: entries.map((entry) => ({
      storyId: entry.story.storyId,
      entryHash: entry.entryHash,
    })),
  });
}

const StorySetIdentityV2Schema = z.object({
  storyCount: z.number().int().positive().max(5_000),
  storyIdSetHash: Sha256Schema,
  entries: z.array(ImplementationClosureStoryEntryV2Schema).min(1).max(5_000),
  membershipHash: Sha256Schema,
}).strict();

const ProductDispositionIdentityV2Schema = z.object({
  mode: z.literal("generated_sources_complete_no_model_dispatch"),
  modelDispatch: z.literal("forbidden"),
  modelWritablePathRefs: z.tuple([]),
  storyCount: z.number().int().positive().max(5_000),
  storyMembershipHash: Sha256Schema,
}).strict();

export type ImplementationClosureProductDispositionHashPayloadV2 = z.infer<
  typeof ProductDispositionIdentityV2Schema
>;

export function hashImplementationClosureProductDispositionV2(
  value:
    | ImplementationClosureProductDispositionHashPayloadV2
    | ImplementationClosureProductDispositionV2,
): string {
  const payload = { ...value } as Record<string, unknown>;
  delete payload.dispositionHash;
  return hashCanonicalJson({
    schema: "setfarm.implementation-closure-product-disposition-hash.v2",
    disposition: payload,
  });
}

export const ImplementationClosureProductDispositionV2Schema =
  ProductDispositionIdentityV2Schema.extend({
    dispositionHash: Sha256Schema,
  }).strict().superRefine((value, context) => {
    if (
      value.dispositionHash
        !== hashImplementationClosureProductDispositionV2(value)
    ) {
      context.addIssue({
        code: "custom",
        path: ["dispositionHash"],
        message: "Closure product disposition hash must bind exact story membership",
      });
    }
  });

export type ImplementationClosureProductDispositionV2 = z.infer<
  typeof ImplementationClosureProductDispositionV2Schema
>;

const ClosureIdentityV2Schema = z.object({
  schema: z.literal(IMPLEMENTATION_CLOSURE_V2_SCHEMA),
  closureVersion: z.literal(IMPLEMENTATION_CLOSURE_V2_VERSION),
  contractHash: z.literal(IMPLEMENTATION_CLOSURE_CONTRACT_HASH_V2),
  stage: z.literal("every_story_slice_verified_before_candidate_source_v1"),
  readiness: z.object({
    status: z.literal("shadow_closed"),
    productionUse: z.literal("forbidden"),
    blockerCodes: z.array(ClosureBlockerCodeV2Schema)
      .length(IMPLEMENTATION_CLOSURE_V2_BLOCKER_CODES.length),
  }).strict(),
  packet: ImplementationSlicePacketBindingV2Schema,
  storySet: StorySetIdentityV2Schema,
  implementation: ImplementationClosureProductDispositionV2Schema,
  validationIds: z.array(ClosureValidationIdV2Schema)
    .length(IMPLEMENTATION_CLOSURE_V2_VALIDATION_IDS.length),
}).strict();

export type ImplementationClosureHashPayloadV2 = z.infer<
  typeof ClosureIdentityV2Schema
>;

export function hashImplementationClosureV2(
  value: ImplementationClosureHashPayloadV2 | ImplementationClosureV2,
): string {
  const payload = { ...value } as Record<string, unknown>;
  delete payload.closureHash;
  return hashCanonicalJson({
    schema: "setfarm.implementation-closure-hash.v2",
    closure: payload,
  });
}

function unique(values: readonly string[]): boolean {
  return new Set(values).size === values.length;
}

function canonicalStrings(values: readonly string[]): boolean {
  return values.every((value, index) => index === 0 || values[index - 1]! < value);
}

function closureIssuesV2(
  value: ImplementationClosureHashPayloadV2 & { closureHash: string },
  context: z.RefinementCtx,
): void {
  const entries = value.storySet.entries;
  const storyIds = entries.map((entry) => entry.story.storyId);
  const storyHashes = entries.map((entry) => entry.story.storyHash);
  const leafEnvelopeHashes = entries.map(
    (entry) => entry.sourceMap.reference.leafEnvelopeHash,
  );
  const proofHashes = entries.map((entry) => entry.sourceMap.proofHash);
  const proofBindingHashes = entries.map(
    (entry) => entry.sourceMap.proofBindingHash,
  );
  const sliceEnvelopeHashes = entries.map(
    (entry) => entry.slice.envelopeHash,
  );
  const sliceHashes = entries.map((entry) => entry.slice.sliceHash);
  const exactSets =
    JSON.stringify(value.readiness.blockerCodes)
      === JSON.stringify(IMPLEMENTATION_CLOSURE_V2_BLOCKER_CODES)
    && JSON.stringify(value.validationIds)
      === JSON.stringify(IMPLEMENTATION_CLOSURE_V2_VALIDATION_IDS);
  const exactStories =
    value.storySet.storyCount === entries.length
    && value.storySet.storyCount === value.packet.sourceMapRoot.leafCount
    && canonicalStrings(storyIds)
    && unique(storyIds)
    && unique(storyHashes)
    && unique(leafEnvelopeHashes)
    && unique(proofHashes)
    && unique(proofBindingHashes)
    && unique(sliceEnvelopeHashes)
    && unique(sliceHashes)
    && entries.every((entry, index) =>
      entry.sourceMap.reference.index === index
      && entry.story.order === index + 1)
    && value.storySet.storyIdSetHash
      === hashImplementationSourceMapStoryIdSetV2(storyIds)
    && value.storySet.storyIdSetHash
      === value.packet.sourceMapRoot.storyIdSetHash
    && value.storySet.membershipHash
      === hashImplementationClosureStoryMembershipV2(entries);
  const exactDisposition =
    value.implementation.storyCount === entries.length
    && value.implementation.storyMembershipHash
      === value.storySet.membershipHash;
  if (!exactSets || !exactStories || !exactDisposition) {
    context.addIssue({
      code: "custom",
      path: ["storySet"],
      message: "Closure must contain every-and-only canonical SourceMap story slice",
    });
  }
  if (value.closureHash !== hashImplementationClosureV2(value)) {
    context.addIssue({
      code: "custom",
      path: ["closureHash"],
      message: "Closure hash must bind the complete product implementation manifest",
    });
  }
}

const ImplementationClosureCandidateV2Schema = ClosureIdentityV2Schema.extend({
  closureHash: Sha256Schema,
}).strict().superRefine(closureIssuesV2);

export const ImplementationClosureV2Schema = z.unknown()
  .superRefine((value, context) => {
    try {
      canonicalJsonBytesBounded(value, {
        maxBytes: IMPLEMENTATION_CLOSURE_V2_MAX_CANONICAL_BYTES,
        ...IMPLEMENTATION_CLOSURE_V2_BOUNDED_WORK_LIMITS,
      });
    } catch {
      context.addIssue({
        code: "custom",
        message: "ImplementationClosureV2 exceeds canonical byte or work bounds",
      });
    }
  }).pipe(ImplementationClosureCandidateV2Schema);

export type ImplementationClosureV2 = z.infer<
  typeof ImplementationClosureCandidateV2Schema
>;

export const ImplementationClosureEnvelopeV2Schema =
  SemanticArtifactEnvelopeV1Schema.extend({
    artifactType: z.literal(IMPLEMENTATION_CLOSURE_ARTIFACT_TYPE_V2),
    producer: ImplementationClosureProducerV2Schema,
    payload: ImplementationClosureV2Schema,
  }).strict().superRefine((value, context) => {
    if (value.producer.codeSha !== value.payload.packet.producer.codeSha) {
      context.addIssue({
        code: "custom",
        path: ["producer", "codeSha"],
        message: "Closure and PacketV4 producers must use the same code revision",
      });
    }
  });

export type ImplementationClosureEnvelopeV2 = z.infer<
  typeof ImplementationClosureEnvelopeV2Schema
>;

export function recursivelyFreezeImplementationClosureV2<T>(value: T): T {
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
