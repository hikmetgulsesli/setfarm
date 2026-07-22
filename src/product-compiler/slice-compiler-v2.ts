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
  verifyImplementationSourceMapStoryProofV2,
  verifyImplementationSourceMapStoryProofV2ForTest,
} from "./implementation-source-map-v2.js";
import type { MaterializedNodeScaffoldPrivateStageV2 } from
  "./node-scaffold-private-materializer-v2.js";
import {
  verifyProductBuildPacketV4,
  verifyProductBuildPacketV4ForTest,
} from "./product-build-packet-v4.js";
import { Sha256Schema, StoryIdSchema } from "./schemas/common-v1.js";
import {
  ImplementationSliceEnvelopeV2Schema,
  ImplementationSliceProducerV2Schema,
  ImplementationSliceV2Schema,
  IMPLEMENTATION_SLICE_ARTIFACT_TYPE_V2,
  IMPLEMENTATION_SLICE_CONTRACT_HASH_V2,
  IMPLEMENTATION_SLICE_V2_BLOCKER_CODES,
  IMPLEMENTATION_SLICE_V2_BOUNDED_WORK_LIMITS,
  IMPLEMENTATION_SLICE_V2_MAX_CANONICAL_BYTES,
  IMPLEMENTATION_SLICE_V2_SCHEMA,
  IMPLEMENTATION_SLICE_V2_VALIDATION_IDS,
  IMPLEMENTATION_SLICE_V2_VERSION,
  hashImplementationSliceDispositionV2,
  hashImplementationSlicePacketBindingV2,
  hashImplementationSliceProofBindingV2,
  hashImplementationSliceV2,
  recursivelyFreezeImplementationSliceV2,
  type ImplementationSliceEnvelopeV2,
  type ImplementationSliceProducerV2,
  type ImplementationSliceV2,
} from "./schemas/implementation-slice-v2.js";
import {
  ImplementationSourceMapEnvelopeV2Schema,
  ImplementationSourceMapStoryProofV2Schema,
  type ImplementationSourceMapStoryLeafEnvelopeV2,
  type ImplementationSourceMapStoryProofV2,
} from "./schemas/implementation-source-map-v2.js";
import {
  ProductBuildPacketEnvelopeV4Schema,
  type ProductBuildPacketEnvelopeV4,
} from "./schemas/product-build-packet-v4.js";

const COMPILER_INPUT_MAX_CANONICAL_BYTES_V2 = 72 * 1024 * 1024;
const VERIFIER_INPUT_MAX_CANONICAL_BYTES_V2 = 80 * 1024 * 1024;
const INPUT_BOUNDED_WORK_LIMITS_V2 = Object.freeze({
  maxDepth: DEFAULT_CANONICAL_JSON_BOUNDED_WORK_LIMITS.maxDepth + 52,
  maxNodes: COMPILER_INPUT_MAX_CANONICAL_BYTES_V2 + 360_000,
  maxContainerEntries:
    DEFAULT_CANONICAL_JSON_BOUNDED_WORK_LIMITS.maxContainerEntries,
  maxWorkUnits:
    (COMPILER_INPUT_MAX_CANONICAL_BYTES_V2 * 8) + (20 * 1024 * 1024),
});
const VERIFIER_BOUNDED_WORK_LIMITS_V2 = Object.freeze({
  ...INPUT_BOUNDED_WORK_LIMITS_V2,
  maxNodes: VERIFIER_INPUT_MAX_CANONICAL_BYTES_V2 + 400_000,
  maxWorkUnits:
    (VERIFIER_INPUT_MAX_CANONICAL_BYTES_V2 * 8) + (20 * 1024 * 1024),
});
const EMPTY_DIAGNOSTICS = Object.freeze([]) as readonly [];

const CompilerInputV2Schema = z.object({
  sliceProducer: z.unknown(),
  storyId: StoryIdSchema,
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
  sourceMapProof: z.unknown(),
  expectedPacketEnvelopeHash: Sha256Schema,
  candidatePacketEnvelope: z.unknown(),
}).strict();

const VerifierInputV2Schema = CompilerInputV2Schema.extend({
  expectedSliceEnvelopeHash: Sha256Schema,
  candidateSliceEnvelope: z.unknown(),
}).strict();

function errorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message.slice(0, 1_500)
    : "Unknown ImplementationSliceV2 failure";
}

function boundedSnapshot(
  input: unknown,
  maxBytes: number,
  workLimits: Omit<Parameters<typeof canonicalJsonBytesBounded>[1], "maxBytes">,
): unknown {
  const bytes = canonicalJsonBytesBounded(input, { maxBytes, ...workLimits });
  return JSON.parse(bytes.toString("utf8"));
}

export type ImplementationSliceDiagnosticCodeV2 =
  | "IMPLEMENTATION_SLICE_V2_ARTIFACT_INVALID"
  | "IMPLEMENTATION_SLICE_V2_CANDIDATE_MISMATCH"
  | "IMPLEMENTATION_SLICE_V2_CROSS_AUTHORITY_MISMATCH"
  | "IMPLEMENTATION_SLICE_V2_EXPECTED_HASH_MISMATCH"
  | "IMPLEMENTATION_SLICE_V2_INPUT_INVALID"
  | "IMPLEMENTATION_SLICE_V2_PACKET_REJECTED"
  | "IMPLEMENTATION_SLICE_V2_PRODUCER_REJECTED"
  | "IMPLEMENTATION_SLICE_V2_PROOF_REJECTED"
  | "IMPLEMENTATION_SLICE_V2_PUBLICATION_PREFLIGHT_REJECTED";

export type ImplementationSliceDiagnosticV2 = Readonly<{
  code: ImplementationSliceDiagnosticCodeV2;
  path: string;
  message: string;
}>;

export type ImplementationSlicePublicationPreflightV2 = Readonly<{
  artifactType: typeof IMPLEMENTATION_SLICE_ARTIFACT_TYPE_V2;
  envelopeHash: string;
  byteLength: number;
  durabilityTier: 0;
  preparedPublication: PreparedArtifactStoreBatchV1;
}>;

export type VerifiedImplementationSliceContextAttachmentsV2 = Readonly<{
  packetEnvelope: Readonly<ProductBuildPacketEnvelopeV4>;
  storyProof: Readonly<ImplementationSourceMapStoryProofV2>;
  storyLeafEnvelope: Readonly<ImplementationSourceMapStoryLeafEnvelopeV2>;
}>;

export type CompiledImplementationSliceV2 = Readonly<{
  value: Readonly<ImplementationSliceV2>;
  envelope: Readonly<ImplementationSliceEnvelopeV2>;
  envelopeHash: string;
  canonicalBytes: string;
  publicationPreflight: ImplementationSlicePublicationPreflightV2;
}>;

type RejectedImplementationSliceV2 = Readonly<{
  status: "rejected";
  diagnostics: readonly ImplementationSliceDiagnosticV2[];
}>;

export type ImplementationSliceCompilationResultV2 =
  | Readonly<{
      status: "shadow_sealed";
      diagnostics: readonly [];
      slice: CompiledImplementationSliceV2;
      contextAttachments: VerifiedImplementationSliceContextAttachmentsV2;
      publicationDisposition:
        "slice_preflighted_individually_atomic_artifact_set_activation_blocked";
      implementationDisposition:
        "generated_sources_complete_no_model_dispatch";
    }>
  | RejectedImplementationSliceV2;

function rejected(
  code: ImplementationSliceDiagnosticCodeV2,
  path: string,
  message: string,
): RejectedImplementationSliceV2 {
  return Object.freeze({
    status: "rejected" as const,
    diagnostics: Object.freeze([Object.freeze({
      code,
      path: path.slice(0, 1_000),
      message: message.slice(0, 1_500),
    })]),
  });
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

function proofVerifierInputV2(
  input: z.infer<typeof CompilerInputV2Schema>,
  expectedRootEnvelopeHash: string,
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
    expectedRootEnvelopeHash,
    rootEnvelope: input.sourceMapRootEnvelope,
    proof: input.sourceMapProof,
  };
}

function slicePublicationPreflightV2(
  envelope: ImplementationSliceEnvelopeV2,
  canonicalBytes: Buffer,
): ImplementationSlicePublicationPreflightV2 {
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
    throw new Error("Artifact-store preflight changed SliceV2 envelope identity");
  }
  return Object.freeze({
    artifactType: IMPLEMENTATION_SLICE_ARTIFACT_TYPE_V2,
    envelopeHash,
    byteLength: canonicalBytes.byteLength,
    durabilityTier: 0 as const,
    preparedPublication,
  });
}

function exactPacketProofRootV2(
  packet: ProductBuildPacketEnvelopeV4,
  proof: ImplementationSourceMapStoryProofV2,
): boolean {
  const packetRoot = packet.payload.sourceMapRoot;
  return proof.root.artifactType === packetRoot.artifactType
    && proof.root.envelopeHash === packetRoot.rootEnvelopeHash
    && proof.root.manifestHash === packetRoot.manifestHash
    && proof.root.authorityHash === packetRoot.authorityHash
    && proof.root.merkleRoot === packetRoot.merkleRoot
    && proof.root.leafCount === packetRoot.leafCount
    && proof.root.storyIdSetHash === packetRoot.storyIdSetHash;
}

async function compileInternalV2(
  handle: MaterializedNodeScaffoldPrivateStageV2,
  input: unknown,
  expectedScope: "production_host" | "test_fixture",
): Promise<ImplementationSliceCompilationResultV2> {
  let snapshot: unknown;
  try {
    snapshot = boundedSnapshot(
      input,
      COMPILER_INPUT_MAX_CANONICAL_BYTES_V2,
      INPUT_BOUNDED_WORK_LIMITS_V2,
    );
  } catch (error) {
    return rejected(
      "IMPLEMENTATION_SLICE_V2_INPUT_INVALID",
      "/",
      errorMessage(error),
    );
  }
  const parsed = CompilerInputV2Schema.safeParse(snapshot);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return rejected(
      "IMPLEMENTATION_SLICE_V2_INPUT_INVALID",
      `/${issue?.path.map(String).join("/") ?? ""}`.replace(/\/$/u, "") || "/",
      issue?.message ?? "ImplementationSliceV2 input is invalid",
    );
  }
  const sliceProducer = ImplementationSliceProducerV2Schema.safeParse(
    parsed.data.sliceProducer,
  );
  if (!sliceProducer.success) {
    return rejected(
      "IMPLEMENTATION_SLICE_V2_PRODUCER_REJECTED",
      "/sliceProducer",
      sliceProducer.error.issues[0]?.message ?? "Slice producer is invalid",
    );
  }
  const candidatePacket = ProductBuildPacketEnvelopeV4Schema.safeParse(
    parsed.data.candidatePacketEnvelope,
  );
  const sourceMapRoot = ImplementationSourceMapEnvelopeV2Schema.safeParse(
    parsed.data.sourceMapRootEnvelope,
  );
  const sourceMapProof = ImplementationSourceMapStoryProofV2Schema.safeParse(
    parsed.data.sourceMapProof,
  );
  if (!candidatePacket.success || !sourceMapRoot.success || !sourceMapProof.success) {
    const message = !candidatePacket.success
      ? candidatePacket.error.issues[0]?.message ?? "PacketV4 candidate is invalid"
      : !sourceMapRoot.success
        ? sourceMapRoot.error.issues[0]?.message ?? "SourceMap root is invalid"
        : !sourceMapProof.success
          ? sourceMapProof.error.issues[0]?.message ?? "SourceMap proof is invalid"
          : "Slice authority input is invalid";
    return rejected(
      !candidatePacket.success
        ? "IMPLEMENTATION_SLICE_V2_PACKET_REJECTED"
        : "IMPLEMENTATION_SLICE_V2_PROOF_REJECTED",
      !candidatePacket.success ? "/candidatePacketEnvelope" : "/sourceMapProof",
      message,
    );
  }

  const verifyPacket = expectedScope === "production_host"
    ? verifyProductBuildPacketV4
    : verifyProductBuildPacketV4ForTest;
  const packet = await verifyPacket(handle, packetVerifierInputV2(parsed.data));
  if (packet.status !== "verified_shadow") {
    const first = packet.diagnostics[0];
    return rejected(
      "IMPLEMENTATION_SLICE_V2_PACKET_REJECTED",
      first?.path ?? "/packet",
      first?.message ?? "Fresh PacketV4 verification was rejected",
    );
  }
  if (sliceProducer.data.codeSha !== packet.envelope.producer.codeSha) {
    return rejected(
      "IMPLEMENTATION_SLICE_V2_PRODUCER_REJECTED",
      "/sliceProducer/codeSha",
      "Slice, PacketV4 and SourceMap producers must use the same code revision",
    );
  }

  const verifyProof = expectedScope === "production_host"
    ? verifyImplementationSourceMapStoryProofV2
    : verifyImplementationSourceMapStoryProofV2ForTest;
  try {
    await verifyProof(
      handle,
      proofVerifierInputV2(
        parsed.data,
        packet.packet.sourceMapRoot.rootEnvelopeHash,
      ),
    );
  } catch (error) {
    return rejected(
      "IMPLEMENTATION_SLICE_V2_PROOF_REJECTED",
      "/sourceMapProof",
      errorMessage(error),
    );
  }

  const proof = sourceMapProof.data;
  const leaf = proof.leaf.envelope.payload;
  const story = leaf.story;
  const packetValue = packet.packet;
  if (
    parsed.data.storyId !== story.storyId
    || !exactPacketProofRootV2(packet.envelope, proof)
    || leaf.authority.sourceMapAuthorityHash
      !== packetValue.sourceMapAuthorityHash
    || canonicalJsonStringify(leaf.execution)
      !== canonicalJsonStringify(packetValue.execution)
    || story.sourceDependencies.runtime.logicalReceiptHash
      !== packetValue.logicalSourceAuthority.runtimeLogicalReceiptHash
    || story.sourceDependencies.test.logicalReceiptHash
      !== packetValue.logicalSourceAuthority.testLogicalReceiptHash
    || story.physicalSharedGrantRefs.length !== 0
    || leaf.designSource.kind !== "none"
    || leaf.modelAuthoredDeclarations.status !== "not_applicable"
  ) {
    return rejected(
      "IMPLEMENTATION_SLICE_V2_CROSS_AUTHORITY_MISMATCH",
      "/sourceMapProof",
      "PacketV4, story proof, source ownership and execution authority differ",
    );
  }

  try {
    const producer: ImplementationSliceProducerV2 = sliceProducer.data;
    const packetEnvelopeBytes = canonicalJsonBytesBounded(packet.envelope, {
      maxBytes: 4 * 1024 * 1024,
      ...DEFAULT_CANONICAL_JSON_BOUNDED_WORK_LIMITS,
    });
    const packetRoot = packetValue.sourceMapRoot;
    const packetBindingIdentity = {
      artifactType: packet.envelope.artifactType,
      schema: packetValue.schema,
      version: packetValue.semanticVersion,
      contractHash: packetValue.contractHash,
      producer: packet.envelope.producer,
      packetHash: packetValue.packetHash,
      envelopeHash: packet.envelopeHash,
      envelopeByteLength: packetEnvelopeBytes.byteLength,
      sourceMapRoot: {
        artifactType: packetRoot.artifactType,
        envelopeHash: packetRoot.rootEnvelopeHash,
        manifestHash: packetRoot.manifestHash,
        authorityHash: packetRoot.authorityHash,
        merkleRoot: packetRoot.merkleRoot,
        leafCount: packetRoot.leafCount,
        storyIdSetHash: packetRoot.storyIdSetHash,
      },
    };
    const packetBinding = {
      ...packetBindingIdentity,
      bindingHash: hashImplementationSlicePacketBindingV2(
        packetBindingIdentity,
      ),
    };
    const proofBindingIdentity = {
      schema:
        "setfarm.implementation-source-map-story-proof-binding.v2" as const,
      proofSchema: proof.schema,
      proofVersion: proof.proofVersion,
      proofHash: proof.proofHash,
      root: proof.root,
      leaf: {
        artifactType: proof.leaf.envelope.artifactType,
        schema: proof.leaf.envelope.payload.schema,
        reference: proof.leaf.reference,
        leafHash: leaf.leafHash,
      },
      auditPath: proof.auditPath,
    };
    const proofBinding = {
      ...proofBindingIdentity,
      bindingHash: hashImplementationSliceProofBindingV2(
        proofBindingIdentity,
      ),
    };
    const dispositionIdentity = {
      mode: "generated_sources_complete_no_model_dispatch" as const,
      modelDispatch: "forbidden" as const,
      modelWritablePathRefs: [] as [],
      runtimeSource: {
        ownerRef: story.sourceDependencies.runtime.ownerRef,
        pathRef: story.sourceDependencies.runtime.pathRef,
        logicalReceiptHash:
          story.sourceDependencies.runtime.logicalReceiptHash,
        sourceIdentityHash:
          story.sourceDependencies.runtime.sourceIdentityHash,
      },
      testSource: {
        ownerRef: story.sourceDependencies.test.ownerRef,
        pathRef: story.sourceDependencies.test.pathRef,
        logicalReceiptHash: story.sourceDependencies.test.logicalReceiptHash,
        sourceIdentityHash: story.sourceDependencies.test.sourceIdentityHash,
      },
      execution: {
        compilationContractHash: leaf.execution.compilationContractHash,
        commandContractHash: leaf.execution.commandContractHash,
        runtimeContractHash: leaf.execution.runtimeContractHash,
      },
      evidenceBindingCount: leaf.evidenceBindings.length,
    };
    const implementation = {
      ...dispositionIdentity,
      dispositionHash: hashImplementationSliceDispositionV2(
        dispositionIdentity,
      ),
    };
    const identity = {
      schema: IMPLEMENTATION_SLICE_V2_SCHEMA,
      sliceVersion: IMPLEMENTATION_SLICE_V2_VERSION,
      contractHash: IMPLEMENTATION_SLICE_CONTRACT_HASH_V2,
      stage:
        "packet_v4_and_story_proof_verified_before_evidence_plan_v2" as const,
      readiness: {
        status: "shadow_sealed" as const,
        productionUse: "forbidden" as const,
        blockerCodes: [...IMPLEMENTATION_SLICE_V2_BLOCKER_CODES],
      },
      packet: packetBinding,
      storyProof: proofBinding,
      story: {
        storyId: story.storyId,
        storyHash: story.storyHash,
        order: story.order,
      },
      implementation,
      validationIds: [...IMPLEMENTATION_SLICE_V2_VALIDATION_IDS],
    };
    const value = recursivelyFreezeImplementationSliceV2(
      ImplementationSliceV2Schema.parse({
        ...identity,
        sliceHash: hashImplementationSliceV2(identity),
      }),
    );
    const envelope = recursivelyFreezeImplementationSliceV2(
      ImplementationSliceEnvelopeV2Schema.parse({
        schema: "setfarm.semantic-artifact-envelope.v1",
        artifactType: IMPLEMENTATION_SLICE_ARTIFACT_TYPE_V2,
        producer,
        payload: value,
      }),
    );
    const bytes = canonicalJsonBytesBounded(envelope, {
      maxBytes: IMPLEMENTATION_SLICE_V2_MAX_CANONICAL_BYTES,
      ...IMPLEMENTATION_SLICE_V2_BOUNDED_WORK_LIMITS,
    });
    const publicationPreflight = slicePublicationPreflightV2(envelope, bytes);
    const slice = Object.freeze({
      value,
      envelope,
      envelopeHash: publicationPreflight.envelopeHash,
      canonicalBytes: bytes.toString("utf8"),
      publicationPreflight,
    });
    const contextAttachments = recursivelyFreezeImplementationSliceV2({
      packetEnvelope: packet.envelope,
      storyProof: proof,
      storyLeafEnvelope: proof.leaf.envelope,
    });
    return Object.freeze({
      status: "shadow_sealed" as const,
      diagnostics: EMPTY_DIAGNOSTICS,
      slice,
      contextAttachments,
      publicationDisposition:
        "slice_preflighted_individually_atomic_artifact_set_activation_blocked" as const,
      implementationDisposition:
        "generated_sources_complete_no_model_dispatch" as const,
    });
  } catch (error) {
    const message = errorMessage(error);
    const publicationFailure = /artifact|batch|publication|payload/iu.test(message);
    return rejected(
      publicationFailure
        ? "IMPLEMENTATION_SLICE_V2_PUBLICATION_PREFLIGHT_REJECTED"
        : "IMPLEMENTATION_SLICE_V2_ARTIFACT_INVALID",
      publicationFailure ? "/publication" : "/",
      message,
    );
  }
}

export function compileImplementationSliceV2(
  handle: MaterializedNodeScaffoldPrivateStageV2,
  input: unknown,
): Promise<ImplementationSliceCompilationResultV2> {
  return compileInternalV2(handle, input, "production_host");
}

export function compileImplementationSliceV2ForTest(
  handle: MaterializedNodeScaffoldPrivateStageV2,
  input: unknown,
): Promise<ImplementationSliceCompilationResultV2> {
  return compileInternalV2(handle, input, "test_fixture");
}

export type ImplementationSliceVerificationResultV2 =
  | Readonly<{
      status: "verified_shadow";
      diagnostics: readonly [];
      slice: Readonly<ImplementationSliceV2>;
      envelope: Readonly<ImplementationSliceEnvelopeV2>;
      envelopeHash: string;
      contextAttachments: VerifiedImplementationSliceContextAttachmentsV2;
      implementationDisposition:
        "generated_sources_complete_no_model_dispatch";
    }>
  | RejectedImplementationSliceV2;

async function verifyInternalV2(
  handle: MaterializedNodeScaffoldPrivateStageV2,
  input: unknown,
  expectedScope: "production_host" | "test_fixture",
): Promise<ImplementationSliceVerificationResultV2> {
  let snapshot: unknown;
  try {
    snapshot = boundedSnapshot(
      input,
      VERIFIER_INPUT_MAX_CANONICAL_BYTES_V2,
      VERIFIER_BOUNDED_WORK_LIMITS_V2,
    );
  } catch (error) {
    return rejected(
      "IMPLEMENTATION_SLICE_V2_INPUT_INVALID",
      "/",
      errorMessage(error),
    );
  }
  const parsed = VerifierInputV2Schema.safeParse(snapshot);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return rejected(
      "IMPLEMENTATION_SLICE_V2_INPUT_INVALID",
      `/${issue?.path.map(String).join("/") ?? ""}`.replace(/\/$/u, "") || "/",
      issue?.message ?? "ImplementationSliceV2 verifier input is invalid",
    );
  }
  const candidate = ImplementationSliceEnvelopeV2Schema.safeParse(
    parsed.data.candidateSliceEnvelope,
  );
  if (!candidate.success) {
    return rejected(
      "IMPLEMENTATION_SLICE_V2_CANDIDATE_MISMATCH",
      "/candidateSliceEnvelope",
      candidate.error.issues[0]?.message ?? "Candidate slice envelope is invalid",
    );
  }
  const compilerInput = { ...parsed.data } as Record<string, unknown>;
  delete compilerInput.expectedSliceEnvelopeHash;
  delete compilerInput.candidateSliceEnvelope;
  const reproduced = await compileInternalV2(handle, compilerInput, expectedScope);
  if (reproduced.status !== "shadow_sealed") return reproduced;
  if (reproduced.slice.envelopeHash !== parsed.data.expectedSliceEnvelopeHash) {
    return rejected(
      "IMPLEMENTATION_SLICE_V2_EXPECTED_HASH_MISMATCH",
      "/expectedSliceEnvelopeHash",
      "Expected SliceV2 envelope hash differs from fresh reproduction",
    );
  }
  if (
    hashCanonicalJson(candidate.data) !== parsed.data.expectedSliceEnvelopeHash
    || canonicalJsonStringify(candidate.data)
      !== canonicalJsonStringify(reproduced.slice.envelope)
  ) {
    return rejected(
      "IMPLEMENTATION_SLICE_V2_CANDIDATE_MISMATCH",
      "/candidateSliceEnvelope",
      "Candidate SliceV2 envelope differs from fresh reproduction",
    );
  }
  return Object.freeze({
    status: "verified_shadow" as const,
    diagnostics: EMPTY_DIAGNOSTICS,
    slice: reproduced.slice.value,
    envelope: reproduced.slice.envelope,
    envelopeHash: reproduced.slice.envelopeHash,
    contextAttachments: reproduced.contextAttachments,
    implementationDisposition:
      "generated_sources_complete_no_model_dispatch" as const,
  });
}

export function verifyImplementationSliceV2(
  handle: MaterializedNodeScaffoldPrivateStageV2,
  input: unknown,
): Promise<ImplementationSliceVerificationResultV2> {
  return verifyInternalV2(handle, input, "production_host");
}

export function verifyImplementationSliceV2ForTest(
  handle: MaterializedNodeScaffoldPrivateStageV2,
  input: unknown,
): Promise<ImplementationSliceVerificationResultV2> {
  return verifyInternalV2(handle, input, "test_fixture");
}
