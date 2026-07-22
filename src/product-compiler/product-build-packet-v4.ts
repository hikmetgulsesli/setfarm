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
  BuildTopologyV3Schema,
  projectBuildTopologyCommandContractV3,
} from "./schemas/build-topology-v3.js";
import { Sha256Schema } from "./schemas/common-v1.js";
import {
  ImplementationSourceMapEnvelopeV2Schema,
  ImplementationSourceMapProducerV2Schema,
} from "./schemas/implementation-source-map-v2.js";
import {
  ProductBuildPacketEnvelopeV4Schema,
  ProductBuildPacketProducerV4Schema,
  ProductBuildPacketV4Schema,
  PRODUCT_BUILD_PACKET_ARTIFACT_TYPE_V4,
  PRODUCT_BUILD_PACKET_CONTRACT_HASH_V4,
  PRODUCT_BUILD_PACKET_V4_BLOCKER_CODES,
  PRODUCT_BUILD_PACKET_V4_BOUNDED_WORK_LIMITS,
  PRODUCT_BUILD_PACKET_V4_MAX_CANONICAL_BYTES,
  PRODUCT_BUILD_PACKET_V4_SCHEMA,
  PRODUCT_BUILD_PACKET_V4_VALIDATION_IDS,
  PRODUCT_BUILD_PACKET_V4_VERSION,
  hashProductBuildPacketV4,
  recursivelyFreezeProductBuildPacketV4,
  type ProductBuildPacketEnvelopeV4,
  type ProductBuildPacketProducerV4,
  type ProductBuildPacketV4,
} from "./schemas/product-build-packet-v4.js";

const COMPILER_INPUT_MAX_CANONICAL_BYTES_V4 = 56 * 1024 * 1024;
const VERIFIER_INPUT_MAX_CANONICAL_BYTES_V4 = 64 * 1024 * 1024;
const INPUT_BOUNDED_WORK_LIMITS_V4 = Object.freeze({
  maxDepth: DEFAULT_CANONICAL_JSON_BOUNDED_WORK_LIMITS.maxDepth + 44,
  maxNodes: COMPILER_INPUT_MAX_CANONICAL_BYTES_V4 + 280_000,
  maxContainerEntries:
    DEFAULT_CANONICAL_JSON_BOUNDED_WORK_LIMITS.maxContainerEntries,
  maxWorkUnits:
    (COMPILER_INPUT_MAX_CANONICAL_BYTES_V4 * 8) + (16 * 1024 * 1024),
});
const VERIFIER_BOUNDED_WORK_LIMITS_V4 = Object.freeze({
  ...INPUT_BOUNDED_WORK_LIMITS_V4,
  maxNodes: VERIFIER_INPUT_MAX_CANONICAL_BYTES_V4 + 320_000,
  maxWorkUnits:
    (VERIFIER_INPUT_MAX_CANONICAL_BYTES_V4 * 8) + (16 * 1024 * 1024),
});
const EMPTY_DIAGNOSTICS = Object.freeze([]) as readonly [];

const CompilerInputV4Schema = z.object({
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
}).strict();

const VerifierInputV4Schema = CompilerInputV4Schema.extend({
  expectedPacketEnvelopeHash: Sha256Schema,
  candidatePacketEnvelope: z.unknown(),
}).strict();

function errorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message.slice(0, 1_500)
    : "Unknown ProductBuildPacketV4 failure";
}

function boundedSnapshot(
  input: unknown,
  maxBytes: number,
  workLimits: Omit<Parameters<typeof canonicalJsonBytesBounded>[1], "maxBytes">,
): unknown {
  const bytes = canonicalJsonBytesBounded(input, { maxBytes, ...workLimits });
  return JSON.parse(bytes.toString("utf8"));
}

export type ProductBuildPacketDiagnosticCodeV4 =
  | "PRODUCT_BUILD_PACKET_V4_ARTIFACT_INVALID"
  | "PRODUCT_BUILD_PACKET_V4_CANDIDATE_MISMATCH"
  | "PRODUCT_BUILD_PACKET_V4_EXPECTED_HASH_MISMATCH"
  | "PRODUCT_BUILD_PACKET_V4_INPUT_INVALID"
  | "PRODUCT_BUILD_PACKET_V4_PRODUCER_REJECTED"
  | "PRODUCT_BUILD_PACKET_V4_PUBLICATION_PREFLIGHT_REJECTED"
  | "PRODUCT_BUILD_PACKET_V4_SOURCE_MAP_REJECTED"
  | "PRODUCT_BUILD_PACKET_V4_SOURCE_MAP_ROOT_MISMATCH";

export type ProductBuildPacketDiagnosticV4 = Readonly<{
  code: ProductBuildPacketDiagnosticCodeV4;
  path: string;
  message: string;
}>;

export type ProductBuildPacketPublicationPreflightV4 = Readonly<{
  artifactType: typeof PRODUCT_BUILD_PACKET_ARTIFACT_TYPE_V4;
  envelopeHash: string;
  byteLength: number;
  durabilityTier: 0;
  preparedPublication: PreparedArtifactStoreBatchV1;
}>;

export type CompiledProductBuildPacketV4 = Readonly<{
  value: Readonly<ProductBuildPacketV4>;
  envelope: Readonly<ProductBuildPacketEnvelopeV4>;
  envelopeHash: string;
  canonicalBytes: string;
  publicationPreflight: ProductBuildPacketPublicationPreflightV4;
}>;

type RejectedProductBuildPacketV4 = Readonly<{
  status: "rejected";
  diagnostics: readonly ProductBuildPacketDiagnosticV4[];
}>;

export type ProductBuildPacketCompilationResultV4 =
  | Readonly<{
      status: "shadow_sealed";
      diagnostics: readonly [];
      packet: CompiledProductBuildPacketV4;
      sourceMapRootEnvelopeHash: string;
      publicationDisposition:
        "packet_preflighted_individually_atomic_artifact_set_activation_blocked";
    }>
  | RejectedProductBuildPacketV4;

function rejected(
  code: ProductBuildPacketDiagnosticCodeV4,
  path: string,
  message: string,
): RejectedProductBuildPacketV4 {
  return Object.freeze({
    status: "rejected" as const,
    diagnostics: Object.freeze([Object.freeze({
      code,
      path: path.slice(0, 1_000),
      message: message.slice(0, 1_500),
    })]),
  });
}

function sourceMapCompilerInputV4(
  input: z.infer<typeof CompilerInputV4Schema>,
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

function packetPublicationPreflightV4(
  envelope: ProductBuildPacketEnvelopeV4,
  canonicalBytes: Buffer,
): ProductBuildPacketPublicationPreflightV4 {
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
    throw new Error("Artifact-store preflight changed PacketV4 envelope identity");
  }
  return Object.freeze({
    artifactType: PRODUCT_BUILD_PACKET_ARTIFACT_TYPE_V4,
    envelopeHash,
    byteLength: canonicalBytes.byteLength,
    durabilityTier: 0 as const,
    preparedPublication,
  });
}

async function compileInternalV4(
  handle: MaterializedNodeScaffoldPrivateStageV2,
  input: unknown,
  expectedScope: "production_host" | "test_fixture",
): Promise<ProductBuildPacketCompilationResultV4> {
  let snapshot: unknown;
  try {
    snapshot = boundedSnapshot(
      input,
      COMPILER_INPUT_MAX_CANONICAL_BYTES_V4,
      INPUT_BOUNDED_WORK_LIMITS_V4,
    );
  } catch (error) {
    return rejected(
      "PRODUCT_BUILD_PACKET_V4_INPUT_INVALID",
      "/",
      errorMessage(error),
    );
  }
  const parsed = CompilerInputV4Schema.safeParse(snapshot);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return rejected(
      "PRODUCT_BUILD_PACKET_V4_INPUT_INVALID",
      `/${issue?.path.map(String).join("/") ?? ""}`.replace(/\/$/u, "") || "/",
      issue?.message ?? "ProductBuildPacketV4 input is invalid",
    );
  }

  const packetProducer = ProductBuildPacketProducerV4Schema.safeParse(
    parsed.data.packetProducer,
  );
  const sourceMapProducer = ImplementationSourceMapProducerV2Schema.safeParse(
    parsed.data.sourceMapProducer,
  );
  if (!packetProducer.success || !sourceMapProducer.success) {
    const producerMessage = !packetProducer.success
      ? packetProducer.error.issues[0]?.message ?? "Packet producer is invalid"
      : !sourceMapProducer.success
        ? sourceMapProducer.error.issues[0]?.message ?? "SourceMap producer is invalid"
        : "Packet producer identity is invalid";
    return rejected(
      "PRODUCT_BUILD_PACKET_V4_PRODUCER_REJECTED",
      packetProducer.success ? "/sourceMapProducer" : "/packetProducer",
      producerMessage,
    );
  }
  if (packetProducer.data.codeSha !== sourceMapProducer.data.codeSha) {
    return rejected(
      "PRODUCT_BUILD_PACKET_V4_PRODUCER_REJECTED",
      "/packetProducer/codeSha",
      "Packet and SourceMap producers must use the same code revision",
    );
  }

  const candidateRoot = ImplementationSourceMapEnvelopeV2Schema.safeParse(
    parsed.data.sourceMapRootEnvelope,
  );
  if (!candidateRoot.success) {
    return rejected(
      "PRODUCT_BUILD_PACKET_V4_SOURCE_MAP_ROOT_MISMATCH",
      "/sourceMapRootEnvelope",
      candidateRoot.error.issues[0]?.message ?? "SourceMap root envelope is invalid",
    );
  }

  const compileSourceMap = expectedScope === "production_host"
    ? compileImplementationSourceMapV2
    : compileImplementationSourceMapV2ForTest;
  const sourceMap = await compileSourceMap(
    handle,
    sourceMapCompilerInputV4(parsed.data),
  );
  if (sourceMap.status !== "shadow_compiled") {
    const first = sourceMap.diagnostics[0];
    return rejected(
      "PRODUCT_BUILD_PACKET_V4_SOURCE_MAP_REJECTED",
      first?.path ?? "/sourceMap",
      first?.message ?? "Fresh SourceMapV2 compilation was rejected",
    );
  }
  if (
    canonicalJsonStringify(candidateRoot.data)
      !== canonicalJsonStringify(sourceMap.root.envelope)
  ) {
    return rejected(
      "PRODUCT_BUILD_PACKET_V4_SOURCE_MAP_ROOT_MISMATCH",
      "/sourceMapRootEnvelope",
      "Candidate SourceMap root envelope differs from fresh reproduction",
    );
  }

  const buildTopology = BuildTopologyV3Schema.safeParse(
    parsed.data.buildTopology,
  );
  if (!buildTopology.success) {
    return rejected(
      "PRODUCT_BUILD_PACKET_V4_SOURCE_MAP_REJECTED",
      "/buildTopology",
      buildTopology.error.issues[0]?.message ?? "BuildTopologyV3 is invalid",
    );
  }

  try {
    const root = sourceMap.root.value;
    const rootEnvelopeBytes = Buffer.from(sourceMap.root.canonicalBytes, "utf8");
    const producer: ProductBuildPacketProducerV4 = packetProducer.data;
    const identity = {
      schema: PRODUCT_BUILD_PACKET_V4_SCHEMA,
      packetVersion: 4 as const,
      semanticVersion: PRODUCT_BUILD_PACKET_V4_VERSION,
      contractHash: PRODUCT_BUILD_PACKET_CONTRACT_HASH_V4,
      branch: "realization_v4" as const,
      stage: "source_map_verified_before_implementation_slice_v2" as const,
      readiness: {
        status: "shadow_sealed" as const,
        productionUse: "forbidden" as const,
        blockerCodes: [...PRODUCT_BUILD_PACKET_V4_BLOCKER_CODES],
      },
      sourceMapAuthority: root.authority,
      sourceMapAuthorityHash: root.authorityHash,
      sourceMapRoot: {
        artifactType: sourceMap.root.envelope.artifactType,
        schema: root.schema,
        version: root.mapVersion,
        contractHash: root.contractHash,
        producer: sourceMap.root.envelope.producer,
        rootEnvelopeHash: sourceMap.root.envelopeHash,
        rootEnvelopeByteLength: rootEnvelopeBytes.byteLength,
        manifestHash: root.manifestHash,
        authorityHash: root.authorityHash,
        merkleRoot: root.merkleRoot,
        leafCount: root.leafCount,
        storyIdSetHash: root.storyIdSetHash,
        direction: "packet_v4_binds_source_map_v2_root" as const,
      },
      execution: {
        compilation: buildTopology.data.compilation,
        commands: projectBuildTopologyCommandContractV3(
          buildTopology.data.commands,
        ),
        runtimeTarget: buildTopology.data.runtimeTarget,
        compilationContractHash:
          buildTopology.data.authority.compilationContractHash,
        commandContractHash: buildTopology.data.authority.commandContractHash,
        runtimeContractHash: buildTopology.data.authority.runtimeContractHash,
      },
      logicalSourceAuthority: {
        runtimeLogicalReceiptHash:
          root.authority.runtimeSource.logicalReceiptHash,
        testLogicalReceiptHash: root.authority.testSource.logicalReceiptHash,
        operationalReceiptHashes: [] as [],
        disposition:
          "logical_source_identity_included_operational_attempt_identity_excluded" as const,
      },
      candidateBuild: {
        requiredReceiptSchema: "setfarm.candidate-build-receipt.v2" as const,
        currentState: "absent" as const,
        disposition:
          "future_authenticated_attempt_evidence_not_packet_identity" as const,
      },
      validationIds: [...PRODUCT_BUILD_PACKET_V4_VALIDATION_IDS],
    };
    const value = recursivelyFreezeProductBuildPacketV4(
      ProductBuildPacketV4Schema.parse({
        ...identity,
        packetHash: hashProductBuildPacketV4(identity),
      }),
    );
    const envelope = recursivelyFreezeProductBuildPacketV4(
      ProductBuildPacketEnvelopeV4Schema.parse({
        schema: "setfarm.semantic-artifact-envelope.v1",
        artifactType: PRODUCT_BUILD_PACKET_ARTIFACT_TYPE_V4,
        producer,
        payload: value,
      }),
    );
    const bytes = canonicalJsonBytesBounded(envelope, {
      maxBytes: PRODUCT_BUILD_PACKET_V4_MAX_CANONICAL_BYTES,
      ...PRODUCT_BUILD_PACKET_V4_BOUNDED_WORK_LIMITS,
    });
    const publicationPreflight = packetPublicationPreflightV4(envelope, bytes);
    const packet = Object.freeze({
      value,
      envelope,
      envelopeHash: publicationPreflight.envelopeHash,
      canonicalBytes: bytes.toString("utf8"),
      publicationPreflight,
    });
    return Object.freeze({
      status: "shadow_sealed" as const,
      diagnostics: EMPTY_DIAGNOSTICS,
      packet,
      sourceMapRootEnvelopeHash: sourceMap.root.envelopeHash,
      publicationDisposition:
        "packet_preflighted_individually_atomic_artifact_set_activation_blocked" as const,
    });
  } catch (error) {
    const message = errorMessage(error);
    const publicationFailure = /artifact|batch|publication|payload/iu.test(message);
    return rejected(
      publicationFailure
        ? "PRODUCT_BUILD_PACKET_V4_PUBLICATION_PREFLIGHT_REJECTED"
        : "PRODUCT_BUILD_PACKET_V4_ARTIFACT_INVALID",
      publicationFailure ? "/publication" : "/",
      message,
    );
  }
}

export function compileProductBuildPacketV4(
  handle: MaterializedNodeScaffoldPrivateStageV2,
  input: unknown,
): Promise<ProductBuildPacketCompilationResultV4> {
  return compileInternalV4(handle, input, "production_host");
}

export function compileProductBuildPacketV4ForTest(
  handle: MaterializedNodeScaffoldPrivateStageV2,
  input: unknown,
): Promise<ProductBuildPacketCompilationResultV4> {
  return compileInternalV4(handle, input, "test_fixture");
}

export type ProductBuildPacketVerificationResultV4 =
  | Readonly<{
      status: "verified_shadow";
      diagnostics: readonly [];
      packet: Readonly<ProductBuildPacketV4>;
      envelope: Readonly<ProductBuildPacketEnvelopeV4>;
      envelopeHash: string;
      sourceMapRootEnvelopeHash: string;
    }>
  | RejectedProductBuildPacketV4;

async function verifyInternalV4(
  handle: MaterializedNodeScaffoldPrivateStageV2,
  input: unknown,
  expectedScope: "production_host" | "test_fixture",
): Promise<ProductBuildPacketVerificationResultV4> {
  let snapshot: unknown;
  try {
    snapshot = boundedSnapshot(
      input,
      VERIFIER_INPUT_MAX_CANONICAL_BYTES_V4,
      VERIFIER_BOUNDED_WORK_LIMITS_V4,
    );
  } catch (error) {
    return rejected(
      "PRODUCT_BUILD_PACKET_V4_INPUT_INVALID",
      "/",
      errorMessage(error),
    );
  }
  const parsed = VerifierInputV4Schema.safeParse(snapshot);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return rejected(
      "PRODUCT_BUILD_PACKET_V4_INPUT_INVALID",
      `/${issue?.path.map(String).join("/") ?? ""}`.replace(/\/$/u, "") || "/",
      issue?.message ?? "ProductBuildPacketV4 verifier input is invalid",
    );
  }
  const candidate = ProductBuildPacketEnvelopeV4Schema.safeParse(
    parsed.data.candidatePacketEnvelope,
  );
  if (!candidate.success) {
    return rejected(
      "PRODUCT_BUILD_PACKET_V4_CANDIDATE_MISMATCH",
      "/candidatePacketEnvelope",
      candidate.error.issues[0]?.message ?? "Candidate packet envelope is invalid",
    );
  }
  const compilerInput = { ...parsed.data } as Record<string, unknown>;
  delete compilerInput.expectedPacketEnvelopeHash;
  delete compilerInput.candidatePacketEnvelope;
  const reproduced = await compileInternalV4(handle, compilerInput, expectedScope);
  if (reproduced.status !== "shadow_sealed") return reproduced;
  if (reproduced.packet.envelopeHash !== parsed.data.expectedPacketEnvelopeHash) {
    return rejected(
      "PRODUCT_BUILD_PACKET_V4_EXPECTED_HASH_MISMATCH",
      "/expectedPacketEnvelopeHash",
      "Expected PacketV4 envelope hash differs from fresh reproduction",
    );
  }
  if (
    hashCanonicalJson(candidate.data) !== parsed.data.expectedPacketEnvelopeHash
    || canonicalJsonStringify(candidate.data)
      !== canonicalJsonStringify(reproduced.packet.envelope)
  ) {
    return rejected(
      "PRODUCT_BUILD_PACKET_V4_CANDIDATE_MISMATCH",
      "/candidatePacketEnvelope",
      "Candidate PacketV4 envelope differs from fresh reproduction",
    );
  }
  return Object.freeze({
    status: "verified_shadow" as const,
    diagnostics: EMPTY_DIAGNOSTICS,
    packet: reproduced.packet.value,
    envelope: reproduced.packet.envelope,
    envelopeHash: reproduced.packet.envelopeHash,
    sourceMapRootEnvelopeHash: reproduced.sourceMapRootEnvelopeHash,
  });
}

export function verifyProductBuildPacketV4(
  handle: MaterializedNodeScaffoldPrivateStageV2,
  input: unknown,
): Promise<ProductBuildPacketVerificationResultV4> {
  return verifyInternalV4(handle, input, "production_host");
}

export function verifyProductBuildPacketV4ForTest(
  handle: MaterializedNodeScaffoldPrivateStageV2,
  input: unknown,
): Promise<ProductBuildPacketVerificationResultV4> {
  return verifyInternalV4(handle, input, "test_fixture");
}
