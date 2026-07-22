import { z } from "zod";

import {
  ARTIFACT_STORE_BATCH_PLAN_SCHEMA_V1,
  copyPreparedArtifactStoreBatchCanonicalItemsV1,
  prepareArtifactStoreBatchPlanV1,
  type PreparedArtifactStoreBatchV1,
} from "./artifact-store-batch-plan.js";
import {
  DEFAULT_CANONICAL_JSON_BOUNDED_WORK_LIMITS,
  canonicalJsonBytesBounded,
} from "./bounded-canonical-json.js";
import { canonicalJsonStringify, hashCanonicalJson } from "./canonical-json.js";
import {
  compileImplementationSourceMapV2,
  compileImplementationSourceMapV2ForTest,
} from "./implementation-source-map-v2.js";
import type { MaterializedNodeScaffoldPrivateStageV2 } from
  "./node-scaffold-private-materializer-v2.js";
import {
  verifyProductBuildPacketV4,
  verifyProductBuildPacketV4ForTest,
} from "./product-build-packet-v4.js";
import {
  deriveImplementationSliceCandidateV2,
} from "./slice-compiler-v2.js";
import {
  IMPLEMENTATION_CLOSURE_ARTIFACT_TYPE_V2,
  IMPLEMENTATION_CLOSURE_CONTRACT_HASH_V2,
  IMPLEMENTATION_CLOSURE_STORY_ENTRY_V2_SCHEMA,
  IMPLEMENTATION_CLOSURE_V2_BLOCKER_CODES,
  IMPLEMENTATION_CLOSURE_V2_BOUNDED_WORK_LIMITS,
  IMPLEMENTATION_CLOSURE_V2_MAX_CANONICAL_BYTES,
  IMPLEMENTATION_CLOSURE_V2_SCHEMA,
  IMPLEMENTATION_CLOSURE_V2_VALIDATION_IDS,
  IMPLEMENTATION_CLOSURE_V2_VERSION,
  ImplementationClosureEnvelopeV2Schema,
  ImplementationClosureProducerV2Schema,
  ImplementationClosureV2Schema,
  hashImplementationClosureProductDispositionV2,
  hashImplementationClosureStoryEntryV2,
  hashImplementationClosureStoryMembershipV2,
  hashImplementationClosureV2,
  recursivelyFreezeImplementationClosureV2,
  type ImplementationClosureEnvelopeV2,
  type ImplementationClosureProducerV2,
  type ImplementationClosureStoryEntryV2,
  type ImplementationClosureV2,
} from "./schemas/implementation-closure-v2.js";
import {
  ImplementationSliceEnvelopeV2Schema,
  ImplementationSliceProducerV2Schema,
} from "./schemas/implementation-slice-v2.js";
import {
  ImplementationSourceMapEnvelopeV2Schema,
  type ImplementationSourceMapStoryLeafEnvelopeV2,
  type ImplementationSourceMapStoryProofV2,
} from "./schemas/implementation-source-map-v2.js";
import {
  ProductBuildPacketEnvelopeV4Schema,
  type ProductBuildPacketEnvelopeV4,
} from "./schemas/product-build-packet-v4.js";
import { Sha256Schema, StoryIdSchema } from "./schemas/common-v1.js";
import {
  BuildTopologyV3Schema,
  type BuildTopologyV3,
} from "./schemas/build-topology-v3.js";
import {
  FileTreeManifestV3Schema,
  type FileTreeManifestV3,
} from "./schemas/file-tree-manifest-v3.js";
import {
  NodeProductRuntimeSourceReceiptV2Schema,
  type NodeProductRuntimeSourceReceiptV2,
} from "./schemas/node-product-runtime-source-v2.js";
import {
  NodeProductTestSourceReceiptV2Schema,
  type NodeProductTestSourceReceiptV2,
} from "./schemas/node-product-test-source-v2.js";

const COMPILER_INPUT_MAX_CANONICAL_BYTES_V2 = 96 * 1024 * 1024;
const VERIFIER_INPUT_MAX_CANONICAL_BYTES_V2 = 104 * 1024 * 1024;
const INPUT_BOUNDED_WORK_LIMITS_V2 = Object.freeze({
  maxDepth: DEFAULT_CANONICAL_JSON_BOUNDED_WORK_LIMITS.maxDepth + 56,
  maxNodes: COMPILER_INPUT_MAX_CANONICAL_BYTES_V2 + 480_000,
  maxContainerEntries:
    DEFAULT_CANONICAL_JSON_BOUNDED_WORK_LIMITS.maxContainerEntries,
  maxWorkUnits:
    (COMPILER_INPUT_MAX_CANONICAL_BYTES_V2 * 8) + (24 * 1024 * 1024),
});
const VERIFIER_BOUNDED_WORK_LIMITS_V2 = Object.freeze({
  ...INPUT_BOUNDED_WORK_LIMITS_V2,
  maxNodes: VERIFIER_INPUT_MAX_CANONICAL_BYTES_V2 + 520_000,
  maxWorkUnits:
    (VERIFIER_INPUT_MAX_CANONICAL_BYTES_V2 * 8) + (24 * 1024 * 1024),
});
const EMPTY_DIAGNOSTICS = Object.freeze([]) as readonly [];

const SliceCandidateV2Schema = z.object({
  storyId: StoryIdSchema,
  expectedSliceEnvelopeHash: Sha256Schema,
  candidateSliceEnvelope: z.unknown(),
}).strict();

const CompilerInputV2Schema = z.object({
  closureProducer: z.unknown(),
  sliceProducer: z.unknown(),
  packetProducer: z.unknown(),
  sourceMapProducer: z.unknown(),
  productSpec: z.unknown(),
  deliverySelection: z.unknown(),
  designGraph: z.null().optional(),
  runtimeBehaviorProposal: z.unknown(),
  runtimeBehaviorContract: z.unknown(),
  realizationPlan: z.unknown(),
  fileTree: z.unknown(),
  buildTopology: z.unknown(),
  runtimeSourceText: z.string().min(1),
  runtimeSourceReceipt: z.unknown(),
  testSourceText: z.string().min(1),
  testSourceReceipt: z.unknown(),
  storyPlan: z.unknown(),
  sourceMapRootEnvelope: z.unknown(),
  expectedPacketEnvelopeHash: Sha256Schema,
  candidatePacketEnvelope: z.unknown(),
  sliceCandidates: z.array(SliceCandidateV2Schema).max(5_000),
}).strict();

const VerifierInputV2Schema = CompilerInputV2Schema.extend({
  expectedClosureEnvelopeHash: Sha256Schema,
  candidateClosureEnvelope: z.unknown(),
}).strict();

function errorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message.slice(0, 1_500)
    : "Unknown ImplementationClosureV2 failure";
}

function boundedSnapshot(
  input: unknown,
  maxBytes: number,
  workLimits: Omit<Parameters<typeof canonicalJsonBytesBounded>[1], "maxBytes">,
): unknown {
  const bytes = canonicalJsonBytesBounded(input, { maxBytes, ...workLimits });
  return JSON.parse(bytes.toString("utf8"));
}

export type ImplementationClosureDiagnosticCodeV2 =
  | "IMPLEMENTATION_CLOSURE_V2_ARTIFACT_INVALID"
  | "IMPLEMENTATION_CLOSURE_V2_CANDIDATE_MISMATCH"
  | "IMPLEMENTATION_CLOSURE_V2_CANDIDATE_SET_MISMATCH"
  | "IMPLEMENTATION_CLOSURE_V2_CROSS_AUTHORITY_MISMATCH"
  | "IMPLEMENTATION_CLOSURE_V2_EXPECTED_HASH_MISMATCH"
  | "IMPLEMENTATION_CLOSURE_V2_INPUT_INVALID"
  | "IMPLEMENTATION_CLOSURE_V2_PACKET_REJECTED"
  | "IMPLEMENTATION_CLOSURE_V2_PRODUCER_REJECTED"
  | "IMPLEMENTATION_CLOSURE_V2_PUBLICATION_PREFLIGHT_REJECTED"
  | "IMPLEMENTATION_CLOSURE_V2_SLICE_REJECTED"
  | "IMPLEMENTATION_CLOSURE_V2_SOURCE_MAP_REJECTED";

export type ImplementationClosureDiagnosticV2 = Readonly<{
  code: ImplementationClosureDiagnosticCodeV2;
  path: string;
  message: string;
}>;

export type ImplementationClosurePublicationPreflightV2 = Readonly<{
  artifactType: typeof IMPLEMENTATION_CLOSURE_ARTIFACT_TYPE_V2;
  envelopeHash: string;
  byteLength: number;
  durabilityTier: 0;
  preparedPublication: PreparedArtifactStoreBatchV1;
}>;

export type VerifiedImplementationClosureContextAttachmentsV2 = Readonly<{
  packetEnvelope: Readonly<ProductBuildPacketEnvelopeV4>;
  fileTree: Readonly<FileTreeManifestV3>;
  buildTopology: Readonly<BuildTopologyV3>;
  runtimeSourceReceipt: Readonly<NodeProductRuntimeSourceReceiptV2>;
  testSourceReceipt: Readonly<NodeProductTestSourceReceiptV2>;
  sourceMapRootEnvelope: Readonly<
    z.infer<typeof ImplementationSourceMapEnvelopeV2Schema>
  >;
  storyProofs: readonly Readonly<ImplementationSourceMapStoryProofV2>[];
  storyLeafEnvelopes:
    readonly Readonly<ImplementationSourceMapStoryLeafEnvelopeV2>[];
  sliceEnvelopes: readonly Readonly<
    z.infer<typeof ImplementationSliceEnvelopeV2Schema>
  >[];
}>;

export type CompiledImplementationClosureV2 = Readonly<{
  value: Readonly<ImplementationClosureV2>;
  envelope: Readonly<ImplementationClosureEnvelopeV2>;
  envelopeHash: string;
  canonicalBytes: string;
  publicationPreflight: ImplementationClosurePublicationPreflightV2;
}>;

type RejectedImplementationClosureV2 = Readonly<{
  status: "rejected";
  diagnostics: readonly ImplementationClosureDiagnosticV2[];
}>;

export type ImplementationClosureCompilationResultV2 =
  | Readonly<{
      status: "shadow_closed";
      diagnostics: readonly [];
      closure: CompiledImplementationClosureV2;
      contextAttachments: VerifiedImplementationClosureContextAttachmentsV2;
      publicationDisposition:
        "closure_preflighted_individually_atomic_artifact_set_activation_blocked";
      implementationDisposition:
        "generated_sources_complete_no_model_dispatch";
    }>
  | RejectedImplementationClosureV2;

function rejected(
  code: ImplementationClosureDiagnosticCodeV2,
  path: string,
  message: string,
): RejectedImplementationClosureV2 {
  return Object.freeze({
    status: "rejected" as const,
    diagnostics: Object.freeze([Object.freeze({
      code,
      path: path.slice(0, 1_000),
      message: message.slice(0, 1_500),
    })]),
  });
}

function sourceMapCompilerInputV2(
  input: z.infer<typeof CompilerInputV2Schema>,
) {
  return {
    producer: input.sourceMapProducer,
    productSpec: input.productSpec,
    deliverySelection: input.deliverySelection,
    ...(input.designGraph === null ? { designGraph: null } : {}),
    runtimeBehaviorProposal: input.runtimeBehaviorProposal,
    runtimeBehaviorContract: input.runtimeBehaviorContract,
    realizationPlan: input.realizationPlan,
    fileTree: input.fileTree,
    buildTopology: input.buildTopology,
    runtimeSourceText: input.runtimeSourceText,
    runtimeSourceReceipt: input.runtimeSourceReceipt,
    testSourceText: input.testSourceText,
    testSourceReceipt: input.testSourceReceipt,
    storyPlan: input.storyPlan,
  };
}

function packetVerifierInputV2(
  input: z.infer<typeof CompilerInputV2Schema>,
) {
  return {
    packetProducer: input.packetProducer,
    sourceMapProducer: input.sourceMapProducer,
    productSpec: input.productSpec,
    deliverySelection: input.deliverySelection,
    ...(input.designGraph === null ? { designGraph: null } : {}),
    runtimeBehaviorProposal: input.runtimeBehaviorProposal,
    runtimeBehaviorContract: input.runtimeBehaviorContract,
    realizationPlan: input.realizationPlan,
    fileTree: input.fileTree,
    buildTopology: input.buildTopology,
    runtimeSourceText: input.runtimeSourceText,
    runtimeSourceReceipt: input.runtimeSourceReceipt,
    testSourceText: input.testSourceText,
    testSourceReceipt: input.testSourceReceipt,
    storyPlan: input.storyPlan,
    sourceMapRootEnvelope: input.sourceMapRootEnvelope,
    expectedPacketEnvelopeHash: input.expectedPacketEnvelopeHash,
    candidatePacketEnvelope: input.candidatePacketEnvelope,
  };
}

function closurePublicationPreflightV2(
  envelope: ImplementationClosureEnvelopeV2,
  canonicalBytes: Buffer,
): ImplementationClosurePublicationPreflightV2 {
  const envelopeHash = hashCanonicalJson(envelope);
  const preparedPublication = prepareArtifactStoreBatchPlanV1({
    schema: ARTIFACT_STORE_BATCH_PLAN_SCHEMA_V1,
    items: [{ durabilityTier: 0, envelope }],
  });
  const items = copyPreparedArtifactStoreBatchCanonicalItemsV1(
    preparedPublication,
  );
  if (
    items.length !== 1
    || items[0]!.durabilityTier !== 0
    || items[0]!.identity.hash !== envelopeHash
    || items[0]!.identity.byteLength !== canonicalBytes.byteLength
    || !items[0]!.bytes.equals(canonicalBytes)
  ) {
    throw new Error(
      "Artifact-store preflight changed ImplementationClosureV2 identity",
    );
  }
  return Object.freeze({
    artifactType: IMPLEMENTATION_CLOSURE_ARTIFACT_TYPE_V2,
    envelopeHash,
    byteLength: canonicalBytes.byteLength,
    durabilityTier: 0 as const,
    preparedPublication,
  });
}

async function compileInternalV2(
  handle: MaterializedNodeScaffoldPrivateStageV2,
  input: unknown,
  expectedScope: "production_host" | "test_fixture",
): Promise<ImplementationClosureCompilationResultV2> {
  let snapshot: unknown;
  try {
    snapshot = boundedSnapshot(
      input,
      COMPILER_INPUT_MAX_CANONICAL_BYTES_V2,
      INPUT_BOUNDED_WORK_LIMITS_V2,
    );
  } catch (error) {
    return rejected(
      "IMPLEMENTATION_CLOSURE_V2_INPUT_INVALID",
      "/",
      errorMessage(error),
    );
  }
  const parsed = CompilerInputV2Schema.safeParse(snapshot);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return rejected(
      "IMPLEMENTATION_CLOSURE_V2_INPUT_INVALID",
      `/${issue?.path.map(String).join("/") ?? ""}`.replace(/\/$/u, "") || "/",
      issue?.message ?? "ImplementationClosureV2 input is invalid",
    );
  }
  const closureProducer = ImplementationClosureProducerV2Schema.safeParse(
    parsed.data.closureProducer,
  );
  const sliceProducer = ImplementationSliceProducerV2Schema.safeParse(
    parsed.data.sliceProducer,
  );
  if (!closureProducer.success || !sliceProducer.success) {
    const issue = !closureProducer.success
      ? closureProducer.error.issues[0]
      : !sliceProducer.success ? sliceProducer.error.issues[0] : undefined;
    return rejected(
      "IMPLEMENTATION_CLOSURE_V2_PRODUCER_REJECTED",
      !closureProducer.success ? "/closureProducer" : "/sliceProducer",
      issue?.message ?? "Implementation closure producer is invalid",
    );
  }
  const candidatePacket = ProductBuildPacketEnvelopeV4Schema.safeParse(
    parsed.data.candidatePacketEnvelope,
  );
  const candidateRoot = ImplementationSourceMapEnvelopeV2Schema.safeParse(
    parsed.data.sourceMapRootEnvelope,
  );
  if (!candidatePacket.success || !candidateRoot.success) {
    const issue = !candidatePacket.success
      ? candidatePacket.error.issues[0]
      : !candidateRoot.success ? candidateRoot.error.issues[0] : undefined;
    return rejected(
      !candidatePacket.success
        ? "IMPLEMENTATION_CLOSURE_V2_PACKET_REJECTED"
        : "IMPLEMENTATION_CLOSURE_V2_SOURCE_MAP_REJECTED",
      !candidatePacket.success
        ? "/candidatePacketEnvelope"
        : "/sourceMapRootEnvelope",
      issue?.message ?? "Implementation closure upstream envelope is invalid",
    );
  }
  const declaredLeaves = candidateRoot.data.payload.leaves;
  if (
    parsed.data.sliceCandidates.length !== declaredLeaves.length
    || parsed.data.sliceCandidates.some((candidate, index) =>
      candidate.storyId !== declaredLeaves[index]?.storyId)
  ) {
    return rejected(
      "IMPLEMENTATION_CLOSURE_V2_CANDIDATE_SET_MISMATCH",
      "/sliceCandidates",
      "Slice candidates must match every declared SourceMap leaf in exact order",
    );
  }

  const compileSourceMap = expectedScope === "production_host"
    ? compileImplementationSourceMapV2
    : compileImplementationSourceMapV2ForTest;
  const sourceMap = await compileSourceMap(
    handle,
    sourceMapCompilerInputV2(parsed.data),
  );
  if (sourceMap.status !== "shadow_compiled") {
    const first = sourceMap.diagnostics[0];
    return rejected(
      "IMPLEMENTATION_CLOSURE_V2_SOURCE_MAP_REJECTED",
      first?.path ?? "/sourceMap",
      first?.message ?? "Fresh SourceMapV2 reproduction was rejected",
    );
  }
  if (
    canonicalJsonStringify(candidateRoot.data)
      !== canonicalJsonStringify(sourceMap.root.envelope)
  ) {
    return rejected(
      "IMPLEMENTATION_CLOSURE_V2_SOURCE_MAP_REJECTED",
      "/sourceMapRootEnvelope",
      "Candidate SourceMapV2 root differs from fresh reproduction",
    );
  }

  const verifyPacket = expectedScope === "production_host"
    ? verifyProductBuildPacketV4
    : verifyProductBuildPacketV4ForTest;
  const packet = await verifyPacket(handle, packetVerifierInputV2(parsed.data));
  if (packet.status !== "verified_shadow") {
    const first = packet.diagnostics[0];
    return rejected(
      "IMPLEMENTATION_CLOSURE_V2_PACKET_REJECTED",
      first?.path ?? "/packet",
      first?.message ?? "Fresh PacketV4 verification was rejected",
    );
  }
  if (
    closureProducer.data.codeSha !== packet.envelope.producer.codeSha
    || sliceProducer.data.codeSha !== packet.envelope.producer.codeSha
    || packet.packet.sourceMapRoot.rootEnvelopeHash
      !== sourceMap.root.envelopeHash
  ) {
    return rejected(
      "IMPLEMENTATION_CLOSURE_V2_CROSS_AUTHORITY_MISMATCH",
      "/closureProducer",
      "Closure, SliceV2, PacketV4 and SourceMapV2 authority revisions differ",
    );
  }

  const candidates = parsed.data.sliceCandidates;
  if (
    candidates.length !== sourceMap.proofs.length
    || candidates.length !== sourceMap.root.value.leafCount
  ) {
    return rejected(
      "IMPLEMENTATION_CLOSURE_V2_CANDIDATE_SET_MISMATCH",
      "/sliceCandidates",
      "Slice candidate count must equal the complete SourceMap story set",
    );
  }

  const storyEntries: ImplementationClosureStoryEntryV2[] = [];
  const sealedSliceEnvelopes: z.infer<
    typeof ImplementationSliceEnvelopeV2Schema
  >[] = [];
  let packetBinding: ReturnType<
    typeof deriveImplementationSliceCandidateV2
  >["value"]["packet"] | undefined;
  for (const [index, proof] of sourceMap.proofs.entries()) {
    const candidate = candidates[index]!;
    const reference = proof.leaf.reference;
    if (candidate.storyId !== reference.storyId) {
      return rejected(
        "IMPLEMENTATION_CLOSURE_V2_CANDIDATE_SET_MISMATCH",
        `/sliceCandidates/${index}/storyId`,
        "Slice candidates must use exact SourceMap leaf-index order",
      );
    }
    const candidateEnvelope = ImplementationSliceEnvelopeV2Schema.safeParse(
      candidate.candidateSliceEnvelope,
    );
    if (!candidateEnvelope.success) {
      return rejected(
        "IMPLEMENTATION_CLOSURE_V2_SLICE_REJECTED",
        `/sliceCandidates/${index}/candidateSliceEnvelope`,
        candidateEnvelope.error.issues[0]?.message
          ?? "Candidate SliceV2 envelope is invalid",
      );
    }
    let reproduced;
    try {
      reproduced = deriveImplementationSliceCandidateV2({
        producer: sliceProducer.data,
        packetEnvelope: packet.envelope,
        packetEnvelopeHash: packet.envelopeHash,
        storyProof: proof,
      });
    } catch (error) {
      return rejected(
        "IMPLEMENTATION_CLOSURE_V2_SLICE_REJECTED",
        `/sliceCandidates/${index}`,
        errorMessage(error),
      );
    }
    if (reproduced.envelopeHash !== candidate.expectedSliceEnvelopeHash) {
      return rejected(
        "IMPLEMENTATION_CLOSURE_V2_SLICE_REJECTED",
        `/sliceCandidates/${index}/expectedSliceEnvelopeHash`,
        "Expected SliceV2 envelope hash differs from fresh reproduction",
      );
    }
    if (
      hashCanonicalJson(candidateEnvelope.data)
        !== candidate.expectedSliceEnvelopeHash
      || canonicalJsonStringify(candidateEnvelope.data)
        !== canonicalJsonStringify(reproduced.envelope)
    ) {
      return rejected(
        "IMPLEMENTATION_CLOSURE_V2_SLICE_REJECTED",
        `/sliceCandidates/${index}/candidateSliceEnvelope`,
        "Candidate SliceV2 envelope differs from fresh reproduction",
      );
    }
    if (
      reproduced.value.implementation.mode
        !== "generated_sources_complete_no_model_dispatch"
      || reproduced.value.implementation.modelDispatch !== "forbidden"
      || reproduced.value.implementation.modelWritablePathRefs.length !== 0
    ) {
      return rejected(
        "IMPLEMENTATION_CLOSURE_V2_CROSS_AUTHORITY_MISMATCH",
        `/sliceCandidates/${index}/candidateSliceEnvelope/payload/implementation`,
        "Every closure slice must have the exact generated no-dispatch disposition",
      );
    }
    if (
      packetBinding !== undefined
      && canonicalJsonStringify(packetBinding)
        !== canonicalJsonStringify(reproduced.value.packet)
    ) {
      return rejected(
        "IMPLEMENTATION_CLOSURE_V2_CROSS_AUTHORITY_MISMATCH",
        `/sliceCandidates/${index}/candidateSliceEnvelope/payload/packet`,
        "Every closure slice must bind one exact PacketV4",
      );
    }
    packetBinding ??= reproduced.value.packet;
    const entryIdentity = {
      schema: IMPLEMENTATION_CLOSURE_STORY_ENTRY_V2_SCHEMA,
      story: reproduced.value.story,
      sourceMap: {
        reference,
        proofHash: proof.proofHash,
        proofBindingHash: reproduced.value.storyProof.bindingHash,
      },
      slice: {
        artifactType: reproduced.envelope.artifactType,
        schema: reproduced.value.schema,
        version: reproduced.value.sliceVersion,
        envelopeHash: reproduced.envelopeHash,
        sliceHash: reproduced.value.sliceHash,
        dispositionHash: reproduced.value.implementation.dispositionHash,
      },
    };
    storyEntries.push({
      ...entryIdentity,
      entryHash: hashImplementationClosureStoryEntryV2(entryIdentity),
    });
    sealedSliceEnvelopes.push(reproduced.envelope);
  }

  if (packetBinding === undefined) {
    return rejected(
      "IMPLEMENTATION_CLOSURE_V2_CANDIDATE_SET_MISMATCH",
      "/sliceCandidates",
      "Implementation closure requires at least one story slice",
    );
  }

  try {
    const storyMembershipHash =
      hashImplementationClosureStoryMembershipV2(storyEntries);
    const dispositionIdentity = {
      mode: "generated_sources_complete_no_model_dispatch" as const,
      modelDispatch: "forbidden" as const,
      modelWritablePathRefs: [] as [],
      storyCount: storyEntries.length,
      storyMembershipHash,
    };
    const identity = {
      schema: IMPLEMENTATION_CLOSURE_V2_SCHEMA,
      closureVersion: IMPLEMENTATION_CLOSURE_V2_VERSION,
      contractHash: IMPLEMENTATION_CLOSURE_CONTRACT_HASH_V2,
      stage: "every_story_slice_verified_before_candidate_source_v1" as const,
      readiness: {
        status: "shadow_closed" as const,
        productionUse: "forbidden" as const,
        blockerCodes: [...IMPLEMENTATION_CLOSURE_V2_BLOCKER_CODES],
      },
      packet: packetBinding,
      storySet: {
        storyCount: storyEntries.length,
        storyIdSetHash: sourceMap.root.value.storyIdSetHash,
        entries: storyEntries,
        membershipHash: storyMembershipHash,
      },
      implementation: {
        ...dispositionIdentity,
        dispositionHash: hashImplementationClosureProductDispositionV2(
          dispositionIdentity,
        ),
      },
      validationIds: [...IMPLEMENTATION_CLOSURE_V2_VALIDATION_IDS],
    };
    const value = recursivelyFreezeImplementationClosureV2(
      ImplementationClosureV2Schema.parse({
        ...identity,
        closureHash: hashImplementationClosureV2(identity),
      }),
    );
    const producer: ImplementationClosureProducerV2 = closureProducer.data;
    const envelope = recursivelyFreezeImplementationClosureV2(
      ImplementationClosureEnvelopeV2Schema.parse({
        schema: "setfarm.semantic-artifact-envelope.v1",
        artifactType: IMPLEMENTATION_CLOSURE_ARTIFACT_TYPE_V2,
        producer,
        payload: value,
      }),
    );
    const bytes = canonicalJsonBytesBounded(envelope, {
      maxBytes: IMPLEMENTATION_CLOSURE_V2_MAX_CANONICAL_BYTES,
      ...IMPLEMENTATION_CLOSURE_V2_BOUNDED_WORK_LIMITS,
    });
    const publicationPreflight = closurePublicationPreflightV2(envelope, bytes);
    const closure = Object.freeze({
      value,
      envelope,
      envelopeHash: publicationPreflight.envelopeHash,
      canonicalBytes: bytes.toString("utf8"),
      publicationPreflight,
    });
    const contextAttachments = recursivelyFreezeImplementationClosureV2({
      packetEnvelope: packet.envelope,
      fileTree: FileTreeManifestV3Schema.parse(parsed.data.fileTree),
      buildTopology: BuildTopologyV3Schema.parse(parsed.data.buildTopology),
      runtimeSourceReceipt: NodeProductRuntimeSourceReceiptV2Schema.parse(
        parsed.data.runtimeSourceReceipt,
      ),
      testSourceReceipt: NodeProductTestSourceReceiptV2Schema.parse(
        parsed.data.testSourceReceipt,
      ),
      sourceMapRootEnvelope: sourceMap.root.envelope,
      storyProofs: sourceMap.proofs,
      storyLeafEnvelopes: sourceMap.proofs.map((proof) => proof.leaf.envelope),
      sliceEnvelopes: sealedSliceEnvelopes,
    });
    return Object.freeze({
      status: "shadow_closed" as const,
      diagnostics: EMPTY_DIAGNOSTICS,
      closure,
      contextAttachments,
      publicationDisposition:
        "closure_preflighted_individually_atomic_artifact_set_activation_blocked" as const,
      implementationDisposition:
        "generated_sources_complete_no_model_dispatch" as const,
    });
  } catch (error) {
    const message = errorMessage(error);
    const publicationFailure = /artifact|batch|publication|payload/iu.test(message);
    return rejected(
      publicationFailure
        ? "IMPLEMENTATION_CLOSURE_V2_PUBLICATION_PREFLIGHT_REJECTED"
        : "IMPLEMENTATION_CLOSURE_V2_ARTIFACT_INVALID",
      publicationFailure ? "/publication" : "/",
      message,
    );
  }
}

export function compileImplementationClosureV2(
  handle: MaterializedNodeScaffoldPrivateStageV2,
  input: unknown,
): Promise<ImplementationClosureCompilationResultV2> {
  return compileInternalV2(handle, input, "production_host");
}

export function compileImplementationClosureV2ForTest(
  handle: MaterializedNodeScaffoldPrivateStageV2,
  input: unknown,
): Promise<ImplementationClosureCompilationResultV2> {
  return compileInternalV2(handle, input, "test_fixture");
}

export type ImplementationClosureVerificationResultV2 =
  | Readonly<{
      status: "verified_shadow";
      diagnostics: readonly [];
      closure: Readonly<ImplementationClosureV2>;
      envelope: Readonly<ImplementationClosureEnvelopeV2>;
      envelopeHash: string;
      contextAttachments: VerifiedImplementationClosureContextAttachmentsV2;
      implementationDisposition:
        "generated_sources_complete_no_model_dispatch";
    }>
  | RejectedImplementationClosureV2;

async function verifyInternalV2(
  handle: MaterializedNodeScaffoldPrivateStageV2,
  input: unknown,
  expectedScope: "production_host" | "test_fixture",
): Promise<ImplementationClosureVerificationResultV2> {
  let snapshot: unknown;
  try {
    snapshot = boundedSnapshot(
      input,
      VERIFIER_INPUT_MAX_CANONICAL_BYTES_V2,
      VERIFIER_BOUNDED_WORK_LIMITS_V2,
    );
  } catch (error) {
    return rejected(
      "IMPLEMENTATION_CLOSURE_V2_INPUT_INVALID",
      "/",
      errorMessage(error),
    );
  }
  const parsed = VerifierInputV2Schema.safeParse(snapshot);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return rejected(
      "IMPLEMENTATION_CLOSURE_V2_INPUT_INVALID",
      `/${issue?.path.map(String).join("/") ?? ""}`.replace(/\/$/u, "") || "/",
      issue?.message ?? "ImplementationClosureV2 verifier input is invalid",
    );
  }
  const candidate = ImplementationClosureEnvelopeV2Schema.safeParse(
    parsed.data.candidateClosureEnvelope,
  );
  if (!candidate.success) {
    return rejected(
      "IMPLEMENTATION_CLOSURE_V2_CANDIDATE_MISMATCH",
      "/candidateClosureEnvelope",
      candidate.error.issues[0]?.message
        ?? "Candidate ImplementationClosureV2 envelope is invalid",
    );
  }
  const compilerInput = { ...parsed.data } as Record<string, unknown>;
  delete compilerInput.expectedClosureEnvelopeHash;
  delete compilerInput.candidateClosureEnvelope;
  const reproduced = await compileInternalV2(handle, compilerInput, expectedScope);
  if (reproduced.status !== "shadow_closed") return reproduced;
  if (
    reproduced.closure.envelopeHash
      !== parsed.data.expectedClosureEnvelopeHash
  ) {
    return rejected(
      "IMPLEMENTATION_CLOSURE_V2_EXPECTED_HASH_MISMATCH",
      "/expectedClosureEnvelopeHash",
      "Expected closure envelope hash differs from fresh reproduction",
    );
  }
  if (
    hashCanonicalJson(candidate.data)
      !== parsed.data.expectedClosureEnvelopeHash
    || canonicalJsonStringify(candidate.data)
      !== canonicalJsonStringify(reproduced.closure.envelope)
  ) {
    return rejected(
      "IMPLEMENTATION_CLOSURE_V2_CANDIDATE_MISMATCH",
      "/candidateClosureEnvelope",
      "Candidate ImplementationClosureV2 differs from fresh reproduction",
    );
  }
  return Object.freeze({
    status: "verified_shadow" as const,
    diagnostics: EMPTY_DIAGNOSTICS,
    closure: reproduced.closure.value,
    envelope: reproduced.closure.envelope,
    envelopeHash: reproduced.closure.envelopeHash,
    contextAttachments: reproduced.contextAttachments,
    implementationDisposition:
      "generated_sources_complete_no_model_dispatch" as const,
  });
}

export function verifyImplementationClosureV2(
  handle: MaterializedNodeScaffoldPrivateStageV2,
  input: unknown,
): Promise<ImplementationClosureVerificationResultV2> {
  return verifyInternalV2(handle, input, "production_host");
}

export function verifyImplementationClosureV2ForTest(
  handle: MaterializedNodeScaffoldPrivateStageV2,
  input: unknown,
): Promise<ImplementationClosureVerificationResultV2> {
  return verifyInternalV2(handle, input, "test_fixture");
}
