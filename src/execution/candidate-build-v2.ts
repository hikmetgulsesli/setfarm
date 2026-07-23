import { randomUUID } from "node:crypto";
import { isProxy } from "node:util/types";

import {
  ARTIFACT_STORE_BATCH_PLAN_SCHEMA_V1,
} from "../product-compiler/artifact-store-batch-plan.js";
import {
  SemanticArtifactEnvelopeV1Schema,
  type SemanticArtifactEnvelopeV1,
} from "../product-compiler/artifact-envelope.js";
import {
  canonicalJsonBytes,
  canonicalJsonStringify,
  hashCanonicalJson,
} from "../product-compiler/canonical-json.js";
import {
  verifyImplementationClosureV2,
  verifyImplementationClosureV2ForTest,
} from "../product-compiler/implementation-closure-v2.js";
import {
  IndexedArtifactPublisher,
  IndexedArtifactPublisherError,
  inspectIndexedArtifactPublisherAuthorityV1,
  type IndexedArtifactBatchPublicationResultV1,
} from "../product-compiler/indexed-artifact-publisher.js";
import {
  HostNodeToolchainAuthorityErrorV2,
  type HostNodeToolchainBuildEvidenceV2,
  type HostNodeToolchainBuildCompilerTargetV2,
} from "../product-compiler/host-node-toolchain-authority-v2.js";
import {
  NodeScaffoldExecutionEnvironmentErrorV2,
} from "../product-compiler/node-scaffold-execution-environment-v2.js";
import {
  NodeScaffoldPrivateMaterializerErrorV2,
  destroyNodeCandidateBuildAttemptInternalV2,
  executeNodeCandidateBuildProcessInternalV2,
  finalizeNodeCandidateBuildOutputV2,
  finalizeNodeCandidateBuildOutputV2ForTest,
  revalidateNodeCandidateBuildOutputV2,
  revalidateNodeProductSourcesV1,
  revalidateNodeScaffoldDependenciesV2,
  type MaterializedNodeScaffoldPrivateStageV2,
  type NodeCandidateBuildOutputV2,
} from "../product-compiler/node-scaffold-private-materializer-v2.js";
import type { BuildTopologyV3 } from
  "../product-compiler/schemas/build-topology-v3.js";
import type { BuildDependencyMaterializationReceiptV2 } from
  "../product-compiler/schemas/node-scaffold-private-materialization-v2.js";
import {
  acquireVerifiedCandidateSourceBuildContextInternalV1,
  revalidateVerifiedCandidateSourceAuthorityV1,
  type VerifiedCandidateSourceAuthorityV1,
  type VerifiedCandidateSourceBuildContextInternalV1,
} from "./candidate-source-v1.js";
import {
  CANDIDATE_BUILD_OPERATION_V2_SCHEMA,
  CANDIDATE_BUILD_OUTPUT_FILE_V2_SCHEMA,
  CANDIDATE_BUILD_OUTPUT_TREE_BINDING_V2_SCHEMA,
  CANDIDATE_BUILD_PROCESS_OUTCOME_V2_SCHEMA,
  CANDIDATE_BUILD_PROCESS_POLICY_V2,
  CANDIDATE_BUILD_RECEIPT_CONTRACT_HASH_V2,
  CANDIDATE_BUILD_RECEIPT_V2_BLOCKER_CODES,
  CANDIDATE_BUILD_RECEIPT_V2_SCHEMA,
  CANDIDATE_BUILD_RECEIPT_V2_VERSION,
  CANDIDATE_BUILD_SOURCE_CHECKPOINT_V2_SCHEMA,
  CANDIDATE_CANONICAL_RUNTIME_TREE_ARTIFACT_REF_V2_SCHEMA,
  hashCandidateBuildOperationV2,
  hashCandidateBuildOutputMembershipV2,
  hashCandidateBuildOutputTreeBindingV2,
  hashCandidateBuildProcessOutcomeV2,
  hashCandidateBuildReceiptV2,
  hashCandidateBuildSourceCheckpointV2,
  parseCandidateBuildReceiptV2,
  type CandidateBuildOperationHashPayloadV2,
  type CandidateBuildOutputTreeBindingHashPayloadV2,
  type CandidateBuildProcessOutcomeHashPayloadV2,
  type CandidateBuildProducerV2,
  type CandidateBuildReceiptHashPayloadV2,
  type CandidateBuildReceiptV2,
  type CandidateBuildSourceCheckpointHashPayloadV2,
} from "./schemas/candidate-build-receipt-v2.js";
import {
  CANONICAL_RUNTIME_TREE_V2_SCHEMA,
} from "./schemas/canonical-runtime-tree-v2.js";

const EMPTY_DIAGNOSTICS = Object.freeze([]) as readonly [];

export type CandidateBuildErrorCodeV2 =
  | "CANDIDATE_BUILD_V2_INPUT_INVALID"
  | "CANDIDATE_BUILD_V2_SOURCE_REJECTED"
  | "CANDIDATE_BUILD_V2_CLOSURE_REJECTED"
  | "CANDIDATE_BUILD_V2_ARTIFACT_AUTHORITY_REJECTED"
  | "CANDIDATE_BUILD_V2_OPERATION_REJECTED"
  | "CANDIDATE_BUILD_V2_ALREADY_CONSUMED"
  | "CANDIDATE_BUILD_V2_PROCESS_REJECTED"
  | "CANDIDATE_BUILD_V2_OUTPUT_REJECTED"
  | "CANDIDATE_BUILD_V2_PUBLICATION_REJECTED"
  | "CANDIDATE_BUILD_V2_RECEIPT_INVALID"
  | "CANDIDATE_BUILD_V2_AUTHORITY_UNAUTHENTICATED"
  | "CANDIDATE_BUILD_V2_EXPECTED_HASH_MISMATCH"
  | "CANDIDATE_BUILD_V2_RUNTIME_BUNDLE_ALREADY_CONSUMED"
  | "CANDIDATE_BUILD_V2_CLEANUP_FAILED";

export class CandidateBuildErrorV2 extends Error {
  readonly code: CandidateBuildErrorCodeV2;
  override readonly cause?: unknown;

  constructor(
    code: CandidateBuildErrorCodeV2,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message.slice(0, 1_500), options);
    this.name = "CandidateBuildErrorV2";
    this.code = code;
    this.cause = options?.cause;
  }
}

function fail(
  code: CandidateBuildErrorCodeV2,
  message: string,
  cause?: unknown,
): never {
  throw new CandidateBuildErrorV2(
    code,
    message,
    cause === undefined ? undefined : { cause },
  );
}

function exactInputHandles(input: unknown): Readonly<{
  sourceAuthority: VerifiedCandidateSourceAuthorityV1;
  artifactAuthority: IndexedArtifactPublisher;
}> {
  if (
    input === null
    || typeof input !== "object"
    || Array.isArray(input)
    || isProxy(input)
    || (Object.getPrototypeOf(input) !== Object.prototype
      && Object.getPrototypeOf(input) !== null)
  ) {
    return fail(
      "CANDIDATE_BUILD_V2_INPUT_INVALID",
      "Candidate build input must be one non-proxied plain object",
    );
  }
  const keys = Reflect.ownKeys(input);
  if (
    keys.length !== 2
    || !keys.includes("sourceAuthority")
    || !keys.includes("artifactAuthority")
    || keys.some((key) => typeof key !== "string")
  ) {
    return fail(
      "CANDIDATE_BUILD_V2_INPUT_INVALID",
      "Candidate build input must contain exactly sourceAuthority and artifactAuthority",
    );
  }
  const source = Object.getOwnPropertyDescriptor(input, "sourceAuthority");
  const artifact = Object.getOwnPropertyDescriptor(input, "artifactAuthority");
  if (
    !source
    || !("value" in source)
    || !source.enumerable
    || !artifact
    || !("value" in artifact)
    || !artifact.enumerable
  ) {
    return fail(
      "CANDIDATE_BUILD_V2_INPUT_INVALID",
      "Candidate build handles must be enumerable data properties",
    );
  }
  return Object.freeze({
    sourceAuthority: source.value as VerifiedCandidateSourceAuthorityV1,
    artifactAuthority: artifact.value as IndexedArtifactPublisher,
  });
}

function producerV2(codeSha: string): CandidateBuildProducerV2 {
  return Object.freeze({
    pass: "candidate-build-authority-v2" as const,
    codeSha,
    toolVersions: Object.freeze({
      candidateBuild: CANDIDATE_BUILD_RECEIPT_V2_VERSION,
      candidateSource: "1.0.0" as const,
      buildTopology: "3.2.0" as const,
      canonicalRuntimeTree: "2.0.0" as const,
    }),
  });
}

async function sourceCheckpointV2(
  context: VerifiedCandidateSourceBuildContextInternalV1,
) {
  const [source, dependency] = await Promise.all([
    revalidateNodeProductSourcesV1(context.stage),
    revalidateNodeScaffoldDependenciesV2(context.stage),
  ]);
  const identity: CandidateBuildSourceCheckpointHashPayloadV2 = {
    schema: CANDIDATE_BUILD_SOURCE_CHECKPOINT_V2_SCHEMA,
    candidateSourceEnvelopeHash: context.envelopeHash,
    candidateSourceReceiptHash: context.envelope.payload.receiptHash,
    semanticRevisionHash:
      context.envelope.payload.semanticRevision.revisionHash,
    sourceMaterializationReceiptHash: source.receiptHash,
    sourceDirectoryPhysicalIdentityHash:
      source.sourceDirectory.physicalIdentityHash,
    dependencyReceiptHash: dependency.receiptHash,
    dependencyIdentityHash: dependency.dependencyIdentityHash,
  };
  return Object.freeze({
    value: Object.freeze({
      ...identity,
      checkpointHash: hashCandidateBuildSourceCheckpointV2(identity),
    }),
    source,
    dependency,
  });
}

function processOutcomeV2(evidence: HostNodeToolchainBuildEvidenceV2) {
  const identity: CandidateBuildProcessOutcomeHashPayloadV2 = {
    schema: CANDIDATE_BUILD_PROCESS_OUTCOME_V2_SCHEMA,
    status: evidence.status,
    exitCode: evidence.exitCode,
    signal: evidence.signal,
    stdoutHash: evidence.stdoutHash,
    stdoutBytes: evidence.stdoutBytes,
    stderrHash: evidence.stderrHash,
    stderrBytes: evidence.stderrBytes,
  };
  return Object.freeze({
    ...identity,
    outcomeHash: hashCandidateBuildProcessOutcomeV2(identity),
  });
}

function operationV2(buildTopology: BuildTopologyV3) {
  const build = buildTopology.commands.build;
  const identity: CandidateBuildOperationHashPayloadV2 = {
    schema: CANDIDATE_BUILD_OPERATION_V2_SCHEMA,
    topologySchema: buildTopology.schema,
    topologyVersion: buildTopology.topologyVersion,
    commandRef: build.commandRef,
    executableRef: build.executableRef,
    compilerExecutableRef: build.compilerExecutableRef,
    compilerTarget: build.compilerTarget,
    cwdRootRef: build.cwdRootRef,
    directArgv: build.directArgv,
    shell: build.shell,
    processPolicy: build.processPolicy,
    commandContractHash: buildTopology.authority.commandContractHash,
    compilationContractHash:
      buildTopology.authority.compilationContractHash,
  };
  if (
    canonicalJsonStringify(identity.processPolicy)
      !== canonicalJsonStringify(CANDIDATE_BUILD_PROCESS_POLICY_V2)
  ) {
    return fail(
      "CANDIDATE_BUILD_V2_OPERATION_REJECTED",
      "BuildTopology does not reproduce the exact CandidateBuildV2 process policy",
    );
  }
  return Object.freeze({
    ...identity,
    operationHash: hashCandidateBuildOperationV2(identity),
  });
}

function compilerTargetFromDependencyV2(
  dependency: BuildDependencyMaterializationReceiptV2,
): HostNodeToolchainBuildCompilerTargetV2 {
  const compilers = dependency.installedBins.entries.filter((entry) =>
    entry.commandName === "tsc"
    && entry.packagePath === "node_modules/typescript"
    && entry.linkLocator === "node_modules/.bin/tsc"
    && entry.targetLocator === "node_modules/typescript/bin/tsc");
  if (compilers.length !== 1) {
    return fail(
      "CANDIDATE_BUILD_V2_OPERATION_REJECTED",
      "Dependency authority does not contain exactly one admitted TypeScript compiler",
    );
  }
  const compiler = compilers[0]!;
  return Object.freeze({
    executableRef: "TOOL_NODE_TYPESCRIPT_TSC_V2" as const,
    exactVersion: "5.9.3" as const,
    commandName: "tsc" as const,
    packagePath: "node_modules/typescript" as const,
    linkLocator: "node_modules/.bin/tsc" as const,
    targetLocator: "node_modules/typescript/bin/tsc" as const,
    linkTargetHash: compiler.linkTargetHash,
    targetContentHash: compiler.targetContentHash,
    executionDisposition:
      "direct_target_via_authenticated_node_runtime" as const,
  });
}

function assertExecutionJoinsV2(input: Readonly<{
  before: Awaited<ReturnType<typeof sourceCheckpointV2>>;
  operation: ReturnType<typeof operationV2>;
  processEvidence: HostNodeToolchainBuildEvidenceV2;
  output: NodeCandidateBuildOutputV2;
  buildTopology: BuildTopologyV3;
  expectedScope: "production_host" | "test_fixture";
}>): void {
  const expectedCompiler = compilerTargetFromDependencyV2(
    input.before.dependency,
  );
  if (
    canonicalJsonStringify(input.operation.compilerTarget)
      !== canonicalJsonStringify(expectedCompiler)
    || canonicalJsonStringify(input.processEvidence.directArgv)
      !== canonicalJsonStringify(input.operation.directArgv)
    || input.processEvidence.directArgvHash !== hashCanonicalJson({
      schema: "setfarm.candidate-build-direct-argv-hash.v2",
      directArgv: input.operation.directArgv,
    })
    || input.processEvidence.hostToolchainReceiptHash
      !== input.before.dependency.hostToolchain.receiptHash
    || input.processEvidence.nodeIdentityHash
      !== input.before.dependency.hostToolchain.nodeIdentityHash
    || input.processEvidence.environmentHash
      !== input.before.dependency.environmentBinding.environmentHash
    || input.output.admissionScope !== input.expectedScope
    || input.output.profileId !== input.buildTopology.authority.profileId
    || input.output.sourceMaterializationReceiptHash
      !== input.before.source.receiptHash
    || input.output.dependencyReceiptHash
      !== input.before.dependency.receiptHash
    || input.output.dependencyIdentityHash
      !== input.before.dependency.dependencyIdentityHash
  ) {
    return fail(
      "CANDIDATE_BUILD_V2_OPERATION_REJECTED",
      "Candidate source, topology, compiler, environment, process and output authority do not join",
    );
  }
}

function assertOutputPublicationV2(input: Readonly<{
  publication: IndexedArtifactBatchPublicationResultV1;
  reservationId: string;
  envelopeHash: string;
  envelopeByteLength: number;
  producer: CandidateBuildProducerV2;
}>): void {
  if (
    input.publication.batchReservationId !== input.reservationId
    || input.publication.lifecycle.state !== "completed"
    || input.publication.items.length !== 1
    || input.publication.items[0]?.durabilityTier !== 0
    || input.publication.items[0]?.identity.hash !== input.envelopeHash
    || input.publication.items[0]?.identity.byteLength
      !== input.envelopeByteLength
    || canonicalJsonStringify(input.publication.items[0]?.identity.producer)
      !== canonicalJsonStringify(input.producer)
  ) {
    return fail(
      "CANDIDATE_BUILD_V2_PUBLICATION_REJECTED",
      "Indexed publisher changed candidate output tree identity or completion state",
    );
  }
}

function outputBindingV2(input: Readonly<{
  output: NodeCandidateBuildOutputV2;
  producer: CandidateBuildProducerV2;
  envelopeHash: string;
  envelopeByteLength: number;
}>) {
  const files = input.output.files.map((file) => Object.freeze({
    schema: CANDIDATE_BUILD_OUTPUT_FILE_V2_SCHEMA,
    normalizedLocator: file.normalizedLocator,
    mode: file.mode,
    executable: file.executable,
    contentHash: file.contentHash,
    byteLength: file.byteLength,
  })) as unknown as CandidateBuildOutputTreeBindingHashPayloadV2["files"];
  const identity = {
    schema: CANDIDATE_BUILD_OUTPUT_TREE_BINDING_V2_SCHEMA,
    profileId: input.output.profileId,
    treeSchema: input.output.tree.schema,
    profile: "dist" as const,
    logicalRoot: "candidate-build-output" as const,
    rootMode: input.output.tree.rootMode,
    memberCount: 2 as const,
    files,
    membershipHash: hashCandidateBuildOutputMembershipV2(files),
    treeArtifact: {
      schema: CANDIDATE_CANONICAL_RUNTIME_TREE_ARTIFACT_REF_V2_SCHEMA,
      artifactType: CANONICAL_RUNTIME_TREE_V2_SCHEMA,
      envelopeHash: input.envelopeHash,
      envelopeByteLength: input.envelopeByteLength,
      producer: input.producer,
    },
    treeHash: input.output.tree.treeHash,
    treePayloadHash: input.output.tree.payloadHash,
    fileCount: 2 as const,
    directoryCount: 0 as const,
    totalBytes: input.output.tree.totalBytes,
  } as CandidateBuildOutputTreeBindingHashPayloadV2;
  return Object.freeze({
    ...identity,
    bindingHash: hashCandidateBuildOutputTreeBindingV2(identity),
  });
}

type VerifiedClosureV2 = Extract<Awaited<ReturnType<
  typeof verifyImplementationClosureV2ForTest
>>, { status: "verified_shadow" }>;

type CandidateBuildRuntimeBundleLeaseV2 = {
  status: "ready" | "claimed" | "consumed";
};

type CandidateBuildAuthorityStateV2 = Readonly<{
  stage: MaterializedNodeScaffoldPrivateStageV2;
  sourceAuthority: VerifiedCandidateSourceAuthorityV1;
  receipt: CandidateBuildReceiptV2;
  output: NodeCandidateBuildOutputV2;
  artifactAuthority: IndexedArtifactPublisher;
  publicationReservationId: string;
  treeEnvelope: SemanticArtifactEnvelopeV1;
  treeEnvelopeHash: string;
  expectedScope: "production_host" | "test_fixture";
  runtimeBundleLease: CandidateBuildRuntimeBundleLeaseV2;
}>;

const candidateBuildAuthorityConstructorCapabilityV2 = Object.freeze({});
const candidateBuildAuthorityStateV2 = new WeakMap<
  object,
  CandidateBuildAuthorityStateV2
>();

export class CandidateBuildAuthorityV2 {
  readonly receiptHash: string;
  readonly semanticRevisionHash: string;
  readonly outputTreeHash: string;
  readonly admissionScope: "production_host" | "test_fixture";

  constructor(capability: object, state: CandidateBuildAuthorityStateV2) {
    if (capability !== candidateBuildAuthorityConstructorCapabilityV2) {
      throw new CandidateBuildErrorV2(
        "CANDIDATE_BUILD_V2_AUTHORITY_UNAUTHENTICATED",
        "Candidate build authority constructor capability is unavailable",
      );
    }
    this.receiptHash = state.receipt.receiptHash;
    this.semanticRevisionHash =
      state.receipt.authority.candidateSource.semanticRevisionHash;
    this.outputTreeHash = state.receipt.outputTree.treeHash;
    this.admissionScope = state.expectedScope;
    candidateBuildAuthorityStateV2.set(this, state);
    Object.freeze(this);
  }
}

export type CandidateBuildResultV2 = Readonly<{
  status: "shadow_verified_build";
  diagnostics: readonly [];
  receipt: CandidateBuildReceiptV2;
  outputTreeEnvelope: SemanticArtifactEnvelopeV1;
  outputTreeEnvelopeHash: string;
  authority: CandidateBuildAuthorityV2;
  activationDisposition:
    "blocked_until_registry_evidence_runtime_bundle_and_atomic_activation";
}>;

function classifyFailureV2(error: unknown): CandidateBuildErrorV2 {
  if (error instanceof CandidateBuildErrorV2) return error;
  if (error instanceof HostNodeToolchainAuthorityErrorV2) {
    const processFailure = new Set([
      "HOST_NODE_TOOLCHAIN_V2_BUILD_TIMEOUT",
      "HOST_NODE_TOOLCHAIN_V2_BUILD_OUTPUT_LIMIT",
      "HOST_NODE_TOOLCHAIN_V2_BUILD_SPAWN_FAILED",
      "HOST_NODE_TOOLCHAIN_V2_BUILD_SIGNALLED",
      "HOST_NODE_TOOLCHAIN_V2_BUILD_NONZERO",
    ]).has(error.code);
    return new CandidateBuildErrorV2(
      processFailure
        ? "CANDIDATE_BUILD_V2_PROCESS_REJECTED"
        : "CANDIDATE_BUILD_V2_OPERATION_REJECTED",
      `Authenticated host build rejected the attempt as ${error.code}`,
      { cause: error },
    );
  }
  if (error instanceof NodeScaffoldPrivateMaterializerErrorV2) {
    return new CandidateBuildErrorV2(
      error.code === "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_BUILD_ALREADY_CONSUMED"
        ? "CANDIDATE_BUILD_V2_ALREADY_CONSUMED"
        : error.code === "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_BUILD_OUTPUT_INVALID"
        ? "CANDIDATE_BUILD_V2_OUTPUT_REJECTED"
        : "CANDIDATE_BUILD_V2_SOURCE_REJECTED",
      `Private materializer rejected the attempt as ${error.code}`,
      { cause: error },
    );
  }
  if (error instanceof NodeScaffoldExecutionEnvironmentErrorV2) {
    return new CandidateBuildErrorV2(
      error.code === "NODE_SCAFFOLD_EXECUTION_ENVIRONMENT_V2_BUILD_ALREADY_CONSUMED"
        ? "CANDIDATE_BUILD_V2_ALREADY_CONSUMED"
        : "CANDIDATE_BUILD_V2_OPERATION_REJECTED",
      `Execution environment rejected the attempt as ${error.code}`,
      { cause: error },
    );
  }
  if (error instanceof IndexedArtifactPublisherError) {
    return new CandidateBuildErrorV2(
      "CANDIDATE_BUILD_V2_PUBLICATION_REJECTED",
      `Indexed artifact publication rejected the output as ${error.code}`,
      { cause: error },
    );
  }
  return new CandidateBuildErrorV2(
    "CANDIDATE_BUILD_V2_RECEIPT_INVALID",
    "Candidate build failed at an untyped internal boundary",
    { cause: error },
  );
}

async function buildInternalV2(
  input: unknown,
  expectedScope: "production_host" | "test_fixture",
): Promise<CandidateBuildResultV2> {
  const handles = exactInputHandles(input);
  let context: VerifiedCandidateSourceBuildContextInternalV1 | undefined;
  let succeeded = false;
  try {
    try {
      context = await acquireVerifiedCandidateSourceBuildContextInternalV1(
        handles.sourceAuthority,
      );
    } catch (error) {
      return fail(
        "CANDIDATE_BUILD_V2_SOURCE_REJECTED",
        "Candidate source authority could not be freshly acquired",
        error,
      );
    }
    if (context.expectedScope !== expectedScope) {
      return fail(
        "CANDIDATE_BUILD_V2_SOURCE_REJECTED",
        "Candidate build cannot promote, downgrade or cross source scope",
      );
    }
    let publisher: ReturnType<typeof inspectIndexedArtifactPublisherAuthorityV1>;
    try {
      publisher = inspectIndexedArtifactPublisherAuthorityV1(
        handles.artifactAuthority,
      );
    } catch (error) {
      return fail(
        "CANDIDATE_BUILD_V2_ARTIFACT_AUTHORITY_REJECTED",
        "Candidate output publisher is not an authentic indexed authority",
        error,
      );
    }
    if (
      expectedScope === "production_host"
      && publisher.publicationAuthority !== "hybrid-required"
    ) {
      return fail(
        "CANDIDATE_BUILD_V2_ARTIFACT_AUTHORITY_REJECTED",
        "Production candidate build requires the trusted hybrid publisher",
      );
    }
    const verifyClosure = expectedScope === "production_host"
      ? verifyImplementationClosureV2
      : verifyImplementationClosureV2ForTest;
    let closure: Awaited<ReturnType<typeof verifyClosure>>;
    try {
      closure = await verifyClosure(
        context.stage,
        context.closureVerificationInput,
      );
    } catch (error) {
      return fail(
        "CANDIDATE_BUILD_V2_CLOSURE_REJECTED",
        "Implementation closure could not be freshly reproduced",
        error,
      );
    }
    if (closure.status !== "verified_shadow") {
      return fail(
        "CANDIDATE_BUILD_V2_CLOSURE_REJECTED",
        "Candidate build requires one freshly verified complete ImplementationClosureV2",
      );
    }
    const verifiedClosure = closure as VerifiedClosureV2;
    const before = await sourceCheckpointV2(context);
    const operation = operationV2(
      verifiedClosure.contextAttachments.buildTopology,
    );
    const processEvidence = await executeNodeCandidateBuildProcessInternalV2(
      context.stage,
    );
    const finalizeOutput = expectedScope === "production_host"
      ? finalizeNodeCandidateBuildOutputV2
      : finalizeNodeCandidateBuildOutputV2ForTest;
    const output = await finalizeOutput(context.stage);
    assertExecutionJoinsV2({
      before,
      operation,
      processEvidence,
      output,
      buildTopology: verifiedClosure.contextAttachments.buildTopology,
      expectedScope,
    });
    const sourceAfterAuthority = await revalidateVerifiedCandidateSourceAuthorityV1(
      handles.sourceAuthority,
    );
    const after = await sourceCheckpointV2(context);
    if (
      sourceAfterAuthority.receiptHash
        !== before.value.candidateSourceReceiptHash
      || sourceAfterAuthority.envelopeHash
        !== before.value.candidateSourceEnvelopeHash
      || sourceAfterAuthority.implementationClosureHash
        !== verifiedClosure.closure.closureHash
      || sourceAfterAuthority.semanticRevisionHash
        !== before.value.semanticRevisionHash
      || canonicalJsonStringify(after.value)
        !== canonicalJsonStringify(before.value)
    ) {
      return fail(
        "CANDIDATE_BUILD_V2_SOURCE_REJECTED",
        "Authenticated candidate source changed across the build fence",
      );
    }
    const producer = producerV2(verifiedClosure.envelope.producer.codeSha);
    const treeEnvelope = SemanticArtifactEnvelopeV1Schema.parse({
      schema: "setfarm.semantic-artifact-envelope.v1",
      artifactType: CANONICAL_RUNTIME_TREE_V2_SCHEMA,
      producer,
      payload: output.tree,
    });
    const treeEnvelopeHash = hashCanonicalJson(treeEnvelope);
    const treeEnvelopeByteLength = canonicalJsonBytes(treeEnvelope).byteLength;
    const publicationReservationId = `candidate-build-v2:${randomUUID()}`;
    const publication = await handles.artifactAuthority.putBatch({
      batchReservationId: publicationReservationId,
      plan: {
        schema: ARTIFACT_STORE_BATCH_PLAN_SCHEMA_V1,
        items: [{ durabilityTier: 0, envelope: treeEnvelope }],
      },
    });
    assertOutputPublicationV2({
      publication,
      reservationId: publicationReservationId,
      envelopeHash: treeEnvelopeHash,
      envelopeByteLength: treeEnvelopeByteLength,
      producer,
    });
    const buildTopology = verifiedClosure.contextAttachments.buildTopology;
    const packetEnvelope = verifiedClosure.contextAttachments.packetEnvelope;
    const closureValue = verifiedClosure.closure;
    const outputTree = outputBindingV2({
      output,
      producer,
      envelopeHash: treeEnvelopeHash,
      envelopeByteLength: treeEnvelopeByteLength,
    });
    const receiptIdentity: CandidateBuildReceiptHashPayloadV2 = {
      schema: CANDIDATE_BUILD_RECEIPT_V2_SCHEMA,
      receiptVersion: CANDIDATE_BUILD_RECEIPT_V2_VERSION,
      contractHash: CANDIDATE_BUILD_RECEIPT_CONTRACT_HASH_V2,
      stage: "private_candidate_build_verified",
      readiness: {
        status: "verified_private_shadow",
        productionUse: "forbidden",
        blockerCodes: [...CANDIDATE_BUILD_RECEIPT_V2_BLOCKER_CODES],
      },
      producer,
      authority: {
        productRef: buildTopology.authority.productRef,
        packet: {
          schema: packetEnvelope.payload.schema,
          version: packetEnvelope.payload.semanticVersion,
          envelopeHash: hashCanonicalJson(packetEnvelope),
          packetHash: packetEnvelope.payload.packetHash,
        },
        implementationClosure: {
          artifactType: verifiedClosure.envelope.artifactType,
          schema: closureValue.schema,
          version: closureValue.closureVersion,
          envelopeHash: verifiedClosure.envelopeHash,
          closureHash: closureValue.closureHash,
        },
        candidateSource: {
          schema: context.envelope.payload.schema,
          version: context.envelope.payload.receiptVersion,
          envelopeHash: context.envelopeHash,
          receiptHash: context.envelope.payload.receiptHash,
          semanticRevisionHash:
            context.envelope.payload.semanticRevision.revisionHash,
        },
        buildTopology: {
          schema: buildTopology.schema,
          version: buildTopology.topologyVersion,
          manifestHash: buildTopology.manifestHash,
          logicalBuildHash: buildTopology.logicalBuildHash,
          commandContractHash:
            buildTopology.authority.commandContractHash,
          compilationContractHash:
            buildTopology.authority.compilationContractHash,
        },
      },
      operation,
      executionAuthority: {
        admissionScope: expectedScope,
        pathDisclosure: "forbidden",
        hostToolchain: {
          receiptHash: before.dependency.hostToolchain.receiptHash,
          nodeIdentityHash: before.dependency.hostToolchain.nodeIdentityHash,
        },
        environment: {
          receiptHash: before.dependency.environmentBinding.receiptHash,
          environmentContractHash:
            before.dependency.environmentBinding.environmentContractHash,
          effectiveConfigHash:
            before.dependency.environmentBinding.effectiveConfigHash,
          environmentHash: before.dependency.environmentBinding.environmentHash,
        },
        dependency: {
          receiptHash: before.dependency.receiptHash,
          dependencyIdentityHash: before.dependency.dependencyIdentityHash,
          installedBinsMembershipHash:
            before.dependency.installedBins.membershipHash,
          compilerTarget: operation.compilerTarget,
        },
        processBinding: {
          probeRef: processEvidence.probeRef,
          projectScopeHash: processEvidence.projectScopeHash,
          compilerTargetIdentityHash:
            processEvidence.compilerTargetIdentityHash,
          directArgvHash: processEvidence.directArgvHash,
        },
      },
      sourceBefore: before.value,
      sourceAfter: after.value,
      processOutcome: processOutcomeV2(processEvidence),
      outputTree,
    };
    const receipt = parseCandidateBuildReceiptV2({
      ...receiptIdentity,
      receiptHash: hashCandidateBuildReceiptV2(receiptIdentity),
    });
    const runtimeBundleLease: CandidateBuildRuntimeBundleLeaseV2 = {
      status: "ready",
    };
    const state: CandidateBuildAuthorityStateV2 = Object.freeze({
      stage: context.stage,
      sourceAuthority: handles.sourceAuthority,
      receipt,
      output,
      artifactAuthority: handles.artifactAuthority,
      publicationReservationId,
      treeEnvelope,
      treeEnvelopeHash,
      expectedScope,
      runtimeBundleLease,
    });
    const authority = new CandidateBuildAuthorityV2(
      candidateBuildAuthorityConstructorCapabilityV2,
      state,
    );
    succeeded = true;
    return Object.freeze({
      status: "shadow_verified_build" as const,
      diagnostics: EMPTY_DIAGNOSTICS,
      receipt,
      outputTreeEnvelope: treeEnvelope,
      outputTreeEnvelopeHash: treeEnvelopeHash,
      authority,
      activationDisposition:
        "blocked_until_registry_evidence_runtime_bundle_and_atomic_activation" as const,
    });
  } catch (error) {
    throw classifyFailureV2(error);
  } finally {
    if (context && !succeeded) {
      try {
        destroyNodeCandidateBuildAttemptInternalV2(context.stage);
      } catch (cleanupError) {
        throw new CandidateBuildErrorV2(
          "CANDIDATE_BUILD_V2_CLEANUP_FAILED",
          "Failed candidate build could not clean both authenticated private roots",
          { cause: cleanupError },
        );
      }
    }
  }
}

export function buildCandidateV2(input: unknown): Promise<CandidateBuildResultV2> {
  return buildInternalV2(input, "production_host");
}

export function buildCandidateV2ForTest(input: unknown): Promise<CandidateBuildResultV2> {
  return buildInternalV2(input, "test_fixture");
}

function authenticBuildStateV2(
  authority: CandidateBuildAuthorityV2,
): CandidateBuildAuthorityStateV2 {
  if (
    typeof authority !== "object"
    || authority === null
    || isProxy(authority)
    || Object.getPrototypeOf(authority) !== CandidateBuildAuthorityV2.prototype
  ) {
    return fail(
      "CANDIDATE_BUILD_V2_AUTHORITY_UNAUTHENTICATED",
      "Candidate build verification requires one authentic authority",
    );
  }
  const state = candidateBuildAuthorityStateV2.get(authority);
  if (!state) {
    return fail(
      "CANDIDATE_BUILD_V2_AUTHORITY_UNAUTHENTICATED",
      "Candidate build verification requires one authentic authority",
    );
  }
  return state;
}

async function verifyBuildInternalV2(input: unknown, expectedScope: "production_host" | "test_fixture") {
  if (
    input === null
    || typeof input !== "object"
    || Array.isArray(input)
    || isProxy(input)
    || (Object.getPrototypeOf(input) !== Object.prototype
      && Object.getPrototypeOf(input) !== null)
    || Reflect.ownKeys(input).length !== 2
    || !Reflect.ownKeys(input).includes("buildAuthority")
    || !Reflect.ownKeys(input).includes("expectedReceiptHash")
    || Reflect.ownKeys(input).some((key) => typeof key !== "string")
  ) {
    return fail("CANDIDATE_BUILD_V2_INPUT_INVALID", "Candidate build verifier input is invalid");
  }
  const authorityDescriptor = Object.getOwnPropertyDescriptor(input, "buildAuthority");
  const hashDescriptor = Object.getOwnPropertyDescriptor(input, "expectedReceiptHash");
  if (
    !authorityDescriptor
    || !("value" in authorityDescriptor)
    || !authorityDescriptor.enumerable
    || !hashDescriptor
    || !("value" in hashDescriptor)
    || !hashDescriptor.enumerable
    || typeof hashDescriptor.value !== "string"
    || !/^[a-f0-9]{64}$/u.test(hashDescriptor.value)
  ) {
    return fail("CANDIDATE_BUILD_V2_INPUT_INVALID", "Candidate build verifier fields are invalid");
  }
  const authority = authorityDescriptor.value as CandidateBuildAuthorityV2;
  const state = authenticBuildStateV2(authority);
  if (state.expectedScope !== expectedScope) {
    return fail("CANDIDATE_BUILD_V2_AUTHORITY_UNAUTHENTICATED", "Candidate build scope mismatch");
  }
  if (state.receipt.receiptHash !== hashDescriptor.value) {
    return fail(
      "CANDIDATE_BUILD_V2_EXPECTED_HASH_MISMATCH",
      "Expected candidate build receipt hash differs from authority",
    );
  }
  let source: Awaited<ReturnType<
    typeof revalidateVerifiedCandidateSourceAuthorityV1
  >>;
  try {
    source = await revalidateVerifiedCandidateSourceAuthorityV1(
      state.sourceAuthority,
    );
  } catch (error) {
    return fail(
      "CANDIDATE_BUILD_V2_SOURCE_REJECTED",
      "Candidate build source authority no longer reproduces",
      error,
    );
  }
  let output: NodeCandidateBuildOutputV2;
  try {
    output = await revalidateNodeCandidateBuildOutputV2(state.stage);
  } catch (error) {
    throw classifyFailureV2(error);
  }
  try {
    const publisher = inspectIndexedArtifactPublisherAuthorityV1(
      state.artifactAuthority,
    );
    if (
      expectedScope === "production_host"
      && publisher.publicationAuthority !== "hybrid-required"
    ) {
      return fail(
        "CANDIDATE_BUILD_V2_ARTIFACT_AUTHORITY_REJECTED",
        "Production candidate output publisher lost hybrid authority",
      );
    }
    const replay = await state.artifactAuthority.putBatch({
      batchReservationId: state.publicationReservationId,
      plan: {
        schema: ARTIFACT_STORE_BATCH_PLAN_SCHEMA_V1,
        items: [{ durabilityTier: 0, envelope: state.treeEnvelope }],
      },
    });
    assertOutputPublicationV2({
      publication: replay,
      reservationId: state.publicationReservationId,
      envelopeHash: state.treeEnvelopeHash,
      envelopeByteLength: canonicalJsonBytes(state.treeEnvelope).byteLength,
      producer: state.receipt.producer,
    });
  } catch (error) {
    if (error instanceof CandidateBuildErrorV2) throw error;
    return fail(
      "CANDIDATE_BUILD_V2_PUBLICATION_REJECTED",
      "Candidate output publication no longer reproduces from indexed CAS authority",
      error,
    );
  }
  const outputBinding = outputBindingV2({
    output,
    producer: state.receipt.producer,
    envelopeHash: state.treeEnvelopeHash,
    envelopeByteLength: canonicalJsonBytes(state.treeEnvelope).byteLength,
  });
  let parsedReceipt: CandidateBuildReceiptV2;
  try {
    parsedReceipt = parseCandidateBuildReceiptV2(state.receipt);
  } catch (error) {
    return fail(
      "CANDIDATE_BUILD_V2_RECEIPT_INVALID",
      "Candidate build receipt no longer validates",
      error,
    );
  }
  if (
    source.receiptHash !== state.receipt.authority.candidateSource.receiptHash
    || source.semanticRevisionHash
      !== state.receipt.authority.candidateSource.semanticRevisionHash
    || source.implementationClosureHash
      !== state.receipt.authority.implementationClosure.closureHash
    || source.envelopeHash
      !== state.receipt.authority.candidateSource.envelopeHash
    || output.tree.treeHash !== state.output.tree.treeHash
    || output.tree.payloadHash !== state.output.tree.payloadHash
    || hashCanonicalJson(state.treeEnvelope) !== state.treeEnvelopeHash
    || canonicalJsonStringify(state.treeEnvelope.payload)
      !== canonicalJsonStringify(output.tree)
    || canonicalJsonStringify(outputBinding)
      !== canonicalJsonStringify(state.receipt.outputTree)
    || parsedReceipt.receiptHash !== state.receipt.receiptHash
  ) {
    return fail(
      "CANDIDATE_BUILD_V2_OUTPUT_REJECTED",
      "Candidate build authority no longer reproduces its source, output and receipt",
    );
  }
  return Object.freeze({
    status: "verified_shadow" as const,
    diagnostics: EMPTY_DIAGNOSTICS,
    receipt: state.receipt,
    outputTreeEnvelopeHash: state.treeEnvelopeHash,
    authority,
  });
}

export function verifyCandidateBuildV2(input: unknown) {
  return verifyBuildInternalV2(input, "production_host");
}

export function verifyCandidateBuildV2ForTest(input: unknown) {
  return verifyBuildInternalV2(input, "test_fixture");
}

export type CandidateBuildRuntimeBundleContextInternalV2 = Readonly<{
  expectedScope: "production_host" | "test_fixture";
  stage: MaterializedNodeScaffoldPrivateStageV2;
  receipt: CandidateBuildReceiptV2;
  output: NodeCandidateBuildOutputV2;
  artifactAuthority: IndexedArtifactPublisher;
  outputTreeEnvelope: SemanticArtifactEnvelopeV1;
  outputTreeEnvelopeHash: string;
}>;

/** @internal Preclaims the only runtime-bundle consumer before fresh verification. */
export async function acquireCandidateBuildRuntimeBundleContextInternalV2(
  authority: CandidateBuildAuthorityV2,
  expectedScope: "production_host" | "test_fixture",
): Promise<CandidateBuildRuntimeBundleContextInternalV2> {
  const state = authenticBuildStateV2(authority);
  if (
    state.expectedScope !== expectedScope
    || state.runtimeBundleLease.status !== "ready"
  ) {
    return fail(
      "CANDIDATE_BUILD_V2_RUNTIME_BUNDLE_ALREADY_CONSUMED",
      "Candidate build runtime-bundle authority is scope-bound and single-use",
    );
  }
  state.runtimeBundleLease.status = "claimed";
  try {
    const verified = await verifyBuildInternalV2({
      buildAuthority: authority,
      expectedReceiptHash: state.receipt.receiptHash,
    }, expectedScope);
    if (
      verified.status !== "verified_shadow"
      || verified.receipt.receiptHash !== state.receipt.receiptHash
      || verified.outputTreeEnvelopeHash !== state.treeEnvelopeHash
      || state.runtimeBundleLease.status !== "claimed"
    ) {
      return fail(
        "CANDIDATE_BUILD_V2_OUTPUT_REJECTED",
        "Candidate build changed while its runtime-bundle lease was claimed",
      );
    }
    return Object.freeze({
      expectedScope: state.expectedScope,
      stage: state.stage,
      receipt: state.receipt,
      output: state.output,
      artifactAuthority: state.artifactAuthority,
      outputTreeEnvelope: state.treeEnvelope,
      outputTreeEnvelopeHash: state.treeEnvelopeHash,
    });
  } catch (error) {
    state.runtimeBundleLease.status = "consumed";
    throw error;
  }
}

/** @internal Consumes the claimed runtime-bundle lease on every terminal outcome. */
export function settleCandidateBuildRuntimeBundleContextInternalV2(
  authority: CandidateBuildAuthorityV2,
  expectedReceiptHash: string,
): void {
  const state = authenticBuildStateV2(authority);
  if (
    state.runtimeBundleLease.status !== "claimed"
    || state.receipt.receiptHash !== expectedReceiptHash
  ) {
    return fail(
      "CANDIDATE_BUILD_V2_RUNTIME_BUNDLE_ALREADY_CONSUMED",
      "Candidate build runtime-bundle lease cannot be settled from this state",
    );
  }
  state.runtimeBundleLease.status = "consumed";
}
