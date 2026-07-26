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
  IndexedArtifactPublisher,
  IndexedArtifactPublisherError,
  inspectIndexedArtifactPublisherAuthorityV1,
  type IndexedArtifactBatchPublicationResultV1,
} from "../product-compiler/indexed-artifact-publisher.js";
import {
  MaterializedNodeCandidateRuntimePrivateV2,
  NodeCandidateRuntimePrivateMaterializerErrorV2,
  acquireNodeCandidateRuntimePhysicalLaunchContextInternalV2,
  destroyNodeCandidateRuntimePrivateV2,
  materializeNodeCandidateRuntimePrivateV2,
  materializeNodeCandidateRuntimePrivateV2ForTest,
  revalidateNodeCandidateRuntimePrivateV2,
  type NodeCandidateRuntimePrivateMaterializationV2,
} from "../product-compiler/node-candidate-runtime-private-materializer-v2.js";
import {
  destroyNodeScaffoldExecutionEnvironmentV2,
} from "../product-compiler/node-scaffold-execution-environment-v2.js";
import {
  NodeScaffoldPrivateMaterializerErrorV2,
  acquireNodeCandidateRuntimeBundleInputsInternalV2,
  destroyNodeCandidateBuildAttemptInternalV2,
  inspectScaffoldBaseMaterializationReceiptV2,
  settleNodeCandidateRuntimeBundleInputsInternalV2,
  type NodeCandidateBuildOutputV2,
  type NodeCandidateRuntimeBundleInputsInternalV2,
} from "../product-compiler/node-scaffold-private-materializer-v2.js";
import {
  NODE_SCAFFOLD_PRODUCTION_CLOSURE_AUTHORITY_REF_V2,
  NODE_SCAFFOLD_PRODUCTION_CLOSURE_CONTRACT_HASH_V2,
  NODE_SCAFFOLD_PRODUCTION_CLOSURE_V2_SCHEMA,
  NODE_SCAFFOLD_PRODUCTION_CLOSURE_VERSION_V2,
} from "../product-compiler/schemas/node-scaffold-production-closure-v2.js";
import {
  NODE_SCAFFOLD_PRODUCTION_MATERIALIZATION_CONTRACT_HASH_V2,
} from "../product-compiler/schemas/node-scaffold-production-materialization-v2.js";
import type {
  CliInvocationInputTransportV2,
  HttpInvocationInputTransportV2,
} from "../product-compiler/schemas/invocation-input-transport-v2.js";
import type {
  CliEncodedInvocationRequestV2,
  HttpEncodedInvocationRequestV2,
} from "../product-compiler/invocation-input-transport-v2.js";
import {
  CandidateBuildAuthorityV2,
  CandidateBuildErrorV2,
  acquireCandidateBuildInvocationTransportContextInternalV2,
  acquireCandidateBuildRuntimeBundleContextInternalV2,
  settleCandidateBuildRuntimeBundleContextInternalV2,
  verifyCandidateBuildV2,
  verifyCandidateBuildV2ForTest,
  type CandidateBuildRuntimeBundleContextInternalV2,
} from "./candidate-build-v2.js";
import {
  executePrivateNodeCliProcessV2,
  type PrivateNodeCliProcessResultV2,
} from "./private-node-cli-process-v2.js";
import {
  executePrivateNodeExpressApiProcessV2,
  type PrivateNodeExpressApiProcessResultV2,
} from "./private-node-express-api-process-v2.js";
import {
  CANDIDATE_NPM_DIRECT_ARGV_HASH_V2,
  CANDIDATE_NPM_MATERIALIZATION_RECEIPT_V2_SCHEMA,
  CANDIDATE_NPM_PROCESS_OUTCOME_V2_SCHEMA,
  CANDIDATE_NPM_PROCESS_POLICY_V2,
  CANDIDATE_NPM_PRODUCTION_MATERIALIZATION_RECIPE_V2,
  CANDIDATE_PRODUCTION_GRAPH_ARTIFACT_REF_V2_SCHEMA,
  CANDIDATE_RUNTIME_APPLICATION_TREE_BINDING_V2_SCHEMA,
  CANDIDATE_RUNTIME_BUNDLE_CONTRACT_HASH_V2,
  CANDIDATE_RUNTIME_BUNDLE_V2_BLOCKER_CODES,
  CANDIDATE_RUNTIME_BUNDLE_V2_SCHEMA,
  CANDIDATE_RUNTIME_BUNDLE_V2_VERSION,
  CANDIDATE_RUNTIME_DEPENDENCY_TREE_BINDING_V2_SCHEMA,
  CANDIDATE_RUNTIME_PACKAGE_JSON_REF_V2_SCHEMA,
  CANDIDATE_RUNTIME_PRODUCTION_CLOSURE_BINDING_V2_SCHEMA,
  CANDIDATE_RUNTIME_PRODUCTION_GRAPH_BINDING_V2_SCHEMA,
  CANDIDATE_RUNTIME_SOURCE_BINDING_V2_SCHEMA,
  CANDIDATE_RUNTIME_SOURCE_CHECKPOINT_V2_SCHEMA,
  CANDIDATE_RUNTIME_TREE_ARTIFACT_REF_V2_SCHEMA,
  hashCandidateNpmMaterializationReceiptV2,
  hashCandidateNpmProcessOutcomeV2,
  hashCandidateRuntimeApplicationTreeBindingV2,
  hashCandidateRuntimeBundleClosureV2,
  hashCandidateRuntimeBundleV2,
  hashCandidateRuntimeDependencyTreeBindingV2,
  hashCandidateRuntimeProductionClosureBindingV2,
  hashCandidateRuntimeProductionGraphBindingV2,
  hashCandidateRuntimeSourceCheckpointV2,
  parseCandidateRuntimeBundleV2,
  type CandidateNpmMaterializationReceiptHashPayloadV2,
  type CandidateNpmProcessOutcomeHashPayloadV2,
  type CandidateRuntimeApplicationTreeBindingHashPayloadV2,
  type CandidateRuntimeBundleHashPayloadV2,
  type CandidateRuntimeBundleProducerV2,
  type CandidateRuntimeBundleV2,
  type CandidateRuntimeDependencyTreeBindingHashPayloadV2,
  type CandidateRuntimeProductionClosureBindingHashPayloadV2,
  type CandidateRuntimeProductionGraphBindingHashPayloadV2,
  type CandidateRuntimeSourceCheckpointHashPayloadV2,
} from "./schemas/candidate-runtime-bundle-v2.js";
import {
  CANONICAL_RUNTIME_TREE_V2_SCHEMA,
} from "./schemas/canonical-runtime-tree-v2.js";
import {
  EXACT_SOURCE_FILE_REF_V2_SCHEMA,
  PRODUCTION_PACKAGE_RESOLUTION_GRAPH_V2_SCHEMA,
} from "./schemas/external-runtime-resolution-v2.js";

const EMPTY_DIAGNOSTICS = Object.freeze([]) as readonly [];

export type CandidateRuntimeBundleErrorCodeV2 =
  | "CANDIDATE_RUNTIME_BUNDLE_V2_INPUT_INVALID"
  | "CANDIDATE_RUNTIME_BUNDLE_V2_BUILD_REJECTED"
  | "CANDIDATE_RUNTIME_BUNDLE_V2_BUILD_ALREADY_CONSUMED"
  | "CANDIDATE_RUNTIME_BUNDLE_V2_MATERIALIZATION_REJECTED"
  | "CANDIDATE_RUNTIME_BUNDLE_V2_PUBLICATION_REJECTED"
  | "CANDIDATE_RUNTIME_BUNDLE_V2_RECEIPT_INVALID"
  | "CANDIDATE_RUNTIME_BUNDLE_V2_AUTHORITY_UNAUTHENTICATED"
  | "CANDIDATE_RUNTIME_BUNDLE_V2_EXPECTED_HASH_MISMATCH"
  | "CANDIDATE_RUNTIME_BUNDLE_V2_STATE_DRIFT"
  | "CANDIDATE_RUNTIME_BUNDLE_V2_LAUNCH_PROFILE_INVALID"
  | "CANDIDATE_RUNTIME_BUNDLE_V2_LAUNCH_AUTHORITY_ALREADY_CONSUMED"
  | "CANDIDATE_RUNTIME_BUNDLE_V2_LAUNCH_TRANSPORT_REJECTED"
  | "CANDIDATE_RUNTIME_BUNDLE_V2_LAUNCH_PROCESS_REJECTED"
  | "CANDIDATE_RUNTIME_BUNDLE_V2_DESTROYED"
  | "CANDIDATE_RUNTIME_BUNDLE_V2_CLEANUP_FAILED";

export class CandidateRuntimeBundleErrorV2 extends Error {
  readonly code: CandidateRuntimeBundleErrorCodeV2;
  override readonly cause?: unknown;

  constructor(
    code: CandidateRuntimeBundleErrorCodeV2,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message.slice(0, 1_500), options);
    this.name = "CandidateRuntimeBundleErrorV2";
    this.code = code;
    this.cause = options?.cause;
  }
}

function fail(
  code: CandidateRuntimeBundleErrorCodeV2,
  message: string,
  cause?: unknown,
): never {
  throw new CandidateRuntimeBundleErrorV2(
    code,
    message,
    cause === undefined ? undefined : { cause },
  );
}

function deepFreezeJson<T>(value: T): T {
  const pending: object[] = [];
  if (value !== null && typeof value === "object") pending.push(value);
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

function defensiveCopy<T>(value: T): T {
  return deepFreezeJson(structuredClone(value));
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (
    value === null
    || typeof value !== "object"
    || Array.isArray(value)
    || isProxy(value)
  ) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function exactDataValue(
  input: unknown,
  expectedKeys: readonly string[],
): Readonly<Record<string, unknown>> {
  if (!isPlainRecord(input)) {
    return fail(
      "CANDIDATE_RUNTIME_BUNDLE_V2_INPUT_INVALID",
      "Candidate runtime input must be one non-proxied plain object",
    );
  }
  const keys = Reflect.ownKeys(input);
  if (
    keys.length !== expectedKeys.length
    || keys.some((key) => typeof key !== "string" || !expectedKeys.includes(key))
  ) {
    return fail(
      "CANDIDATE_RUNTIME_BUNDLE_V2_INPUT_INVALID",
      "Candidate runtime input fields are not exact",
    );
  }
  const descriptors = Object.getOwnPropertyDescriptors(input);
  const values: Record<string, unknown> = {};
  for (const key of expectedKeys) {
    const descriptor = descriptors[key];
    if (!descriptor || !("value" in descriptor) || !descriptor.enumerable) {
      return fail(
        "CANDIDATE_RUNTIME_BUNDLE_V2_INPUT_INVALID",
        "Candidate runtime input fields must be enumerable data properties",
      );
    }
    values[key] = descriptor.value;
  }
  return Object.freeze(values);
}

function exactBuildInput(input: unknown): CandidateBuildAuthorityV2 {
  return exactDataValue(input, ["buildAuthority"])
    .buildAuthority as CandidateBuildAuthorityV2;
}

function producerV2(codeSha: string): CandidateRuntimeBundleProducerV2 {
  return Object.freeze({
    pass: "candidate-runtime-bundle-authority-v2" as const,
    codeSha,
    toolVersions: Object.freeze({
      candidateRuntimeBundle: CANDIDATE_RUNTIME_BUNDLE_V2_VERSION,
      candidateBuild: "2.1.0" as const,
      candidateSource: "1.0.0" as const,
      canonicalRuntimeTree: "2.0.0" as const,
      productionPackageResolutionGraph: "2.0.0" as const,
    }),
  });
}

type RuntimeArtifactSetV2 = Readonly<{
  dependencyEnvelope: SemanticArtifactEnvelopeV1;
  dependencyEnvelopeHash: string;
  dependencyEnvelopeByteLength: number;
  graphEnvelope: SemanticArtifactEnvelopeV1;
  graphEnvelopeHash: string;
  graphEnvelopeByteLength: number;
}>;

function runtimeArtifactSetV2(
  materialization: NodeCandidateRuntimePrivateMaterializationV2,
  producer: CandidateRuntimeBundleProducerV2,
): RuntimeArtifactSetV2 {
  const dependencyEnvelope = deepFreezeJson(
    SemanticArtifactEnvelopeV1Schema.parse({
      schema: "setfarm.semantic-artifact-envelope.v1",
      artifactType: CANONICAL_RUNTIME_TREE_V2_SCHEMA,
      producer,
      payload: materialization.dependencyTree,
    }),
  );
  const graphEnvelope = deepFreezeJson(
    SemanticArtifactEnvelopeV1Schema.parse({
      schema: "setfarm.semantic-artifact-envelope.v1",
      artifactType: PRODUCTION_PACKAGE_RESOLUTION_GRAPH_V2_SCHEMA,
      producer,
      payload: materialization.productionGraph,
    }),
  );
  return Object.freeze({
    dependencyEnvelope,
    dependencyEnvelopeHash: hashCanonicalJson(dependencyEnvelope),
    dependencyEnvelopeByteLength: canonicalJsonBytes(dependencyEnvelope).byteLength,
    graphEnvelope,
    graphEnvelopeHash: hashCanonicalJson(graphEnvelope),
    graphEnvelopeByteLength: canonicalJsonBytes(graphEnvelope).byteLength,
  });
}

function assertArtifactPublicationV2(input: Readonly<{
  publication: IndexedArtifactBatchPublicationResultV1;
  reservationId: string;
  artifacts: RuntimeArtifactSetV2;
  producer: CandidateRuntimeBundleProducerV2;
}>): void {
  const expected = new Map([
    [input.artifacts.dependencyEnvelopeHash, {
      artifactType: CANONICAL_RUNTIME_TREE_V2_SCHEMA,
      byteLength: input.artifacts.dependencyEnvelopeByteLength,
    }],
    [input.artifacts.graphEnvelopeHash, {
      artifactType: PRODUCTION_PACKAGE_RESOLUTION_GRAPH_V2_SCHEMA,
      byteLength: input.artifacts.graphEnvelopeByteLength,
    }],
  ]);
  if (expected.size !== 2) {
    return fail(
      "CANDIDATE_RUNTIME_BUNDLE_V2_PUBLICATION_REJECTED",
      "Runtime artifact identities collided before batch publication",
    );
  }
  if (
    input.publication.batchReservationId !== input.reservationId
    || input.publication.lifecycle.state !== "completed"
    || input.publication.items.length !== expected.size
  ) {
    return fail(
      "CANDIDATE_RUNTIME_BUNDLE_V2_PUBLICATION_REJECTED",
      "Runtime artifact batch did not complete as one exact indexed set",
    );
  }
  const observed = new Set<string>();
  for (const item of input.publication.items) {
    const match = expected.get(item.identity.hash);
    if (
      !match
      || observed.has(item.identity.hash)
      || item.durabilityTier !== 0
      || item.identity.artifactType !== match.artifactType
      || item.identity.byteLength !== match.byteLength
      || canonicalJsonStringify(item.identity.producer)
        !== canonicalJsonStringify(input.producer)
    ) {
      return fail(
        "CANDIDATE_RUNTIME_BUNDLE_V2_PUBLICATION_REJECTED",
        "Runtime artifact publication changed batch membership or identity",
      );
    }
    observed.add(item.identity.hash);
  }
  if (observed.size !== expected.size) {
    return fail(
      "CANDIDATE_RUNTIME_BUNDLE_V2_PUBLICATION_REJECTED",
      "Runtime artifact publication omitted an exact batch member",
    );
  }
}

function applicationBindingV2(
  buildReceipt: CandidateBuildRuntimeBundleContextInternalV2["receipt"],
  materialization: NodeCandidateRuntimePrivateMaterializationV2,
) {
  const output = buildReceipt.outputTree;
  const identity: CandidateRuntimeApplicationTreeBindingHashPayloadV2 = {
    schema: CANDIDATE_RUNTIME_APPLICATION_TREE_BINDING_V2_SCHEMA,
    treeSchema: output.treeSchema,
    profile: "dist",
    logicalRoot: "candidate-bundle/application",
    treeArtifact: output.treeArtifact,
    treeHash: materialization.applicationTree.treeHash,
    treePayloadHash: materialization.applicationTree.payloadHash,
    fileCount: materialization.applicationTree.fileCount,
    directoryCount: materialization.applicationTree.directoryCount,
    totalBytes: materialization.applicationTree.totalBytes,
  };
  return Object.freeze({
    ...identity,
    bindingHash: hashCandidateRuntimeApplicationTreeBindingV2(identity),
  });
}

function dependencyBindingV2(
  materialization: NodeCandidateRuntimePrivateMaterializationV2,
  artifacts: RuntimeArtifactSetV2,
  producer: CandidateRuntimeBundleProducerV2,
) {
  const tree = materialization.dependencyTree;
  const identity: CandidateRuntimeDependencyTreeBindingHashPayloadV2 = {
    schema: CANDIDATE_RUNTIME_DEPENDENCY_TREE_BINDING_V2_SCHEMA,
    treeSchema: tree.schema,
    profile: "dependencies",
    logicalRoot: "candidate-bundle/node_modules",
    treeArtifact: {
      schema: CANDIDATE_RUNTIME_TREE_ARTIFACT_REF_V2_SCHEMA,
      artifactType: CANONICAL_RUNTIME_TREE_V2_SCHEMA,
      envelopeHash: artifacts.dependencyEnvelopeHash,
      envelopeByteLength: artifacts.dependencyEnvelopeByteLength,
      producer,
    },
    treeHash: tree.treeHash,
    treePayloadHash: tree.payloadHash,
    fileCount: tree.fileCount,
    directoryCount: tree.directoryCount,
    totalBytes: tree.totalBytes,
  };
  return Object.freeze({
    ...identity,
    bindingHash: hashCandidateRuntimeDependencyTreeBindingV2(identity),
  });
}

function productionGraphBindingV2(
  materialization: NodeCandidateRuntimePrivateMaterializationV2,
  artifacts: RuntimeArtifactSetV2,
  producer: CandidateRuntimeBundleProducerV2,
) {
  const graph = materialization.productionGraph;
  const identity: CandidateRuntimeProductionGraphBindingHashPayloadV2 = {
    schema: CANDIDATE_RUNTIME_PRODUCTION_GRAPH_BINDING_V2_SCHEMA,
    graphSchema: graph.schema,
    graphArtifact: {
      schema: CANDIDATE_PRODUCTION_GRAPH_ARTIFACT_REF_V2_SCHEMA,
      artifactType: PRODUCTION_PACKAGE_RESOLUTION_GRAPH_V2_SCHEMA,
      envelopeHash: artifacts.graphEnvelopeHash,
      envelopeByteLength: artifacts.graphEnvelopeByteLength,
      producer,
    },
    resolutionGraphHash: graph.resolutionGraphHash,
    materializedDependencyTreeHash: graph.materializedDependencyTreeHash,
    packageCount: graph.packageCount,
  };
  return Object.freeze({
    ...identity,
    bindingHash: hashCandidateRuntimeProductionGraphBindingV2(identity),
  });
}

function productionClosureBindingV2(
  materialization: NodeCandidateRuntimePrivateMaterializationV2,
) {
  const closure = materialization.productionClosure;
  const identity: CandidateRuntimeProductionClosureBindingHashPayloadV2 = {
    schema: CANDIDATE_RUNTIME_PRODUCTION_CLOSURE_BINDING_V2_SCHEMA,
    closureSchema: NODE_SCAFFOLD_PRODUCTION_CLOSURE_V2_SCHEMA,
    closureVersion: NODE_SCAFFOLD_PRODUCTION_CLOSURE_VERSION_V2,
    authorityRef: NODE_SCAFFOLD_PRODUCTION_CLOSURE_AUTHORITY_REF_V2,
    closureContractHash: NODE_SCAFFOLD_PRODUCTION_CLOSURE_CONTRACT_HASH_V2,
    materializationContractHash:
      NODE_SCAFFOLD_PRODUCTION_MATERIALIZATION_CONTRACT_HASH_V2,
    profileId: closure.profileBinding.profileId,
    profileEntryHash: closure.profileBinding.entryHash,
    catalogHash: closure.profileBinding.catalogHash,
    closureHash: closure.closureHash,
    sourceGraphHash: closure.sourceGraph.graphHash,
    sourceLockRawHash: closure.sourceGraph.lockRawHash,
    sourceRootManifestRawHash: closure.sourceGraph.rootManifestRawHash,
    sourceLockRootHash: closure.sourceGraph.lockRootHash,
    sourceGraphNodeCount: closure.sourceGraph.nodeCount,
    sourceGraphEdgeCount: closure.sourceGraph.edgeCount,
    sourceGraphNodeMembershipHash: closure.sourceGraph.nodeMembershipHash,
    sourceGraphEdgeMembershipHash: closure.sourceGraph.edgeMembershipHash,
    rootDependencyCount: closure.rootDependencyCount,
    nodeCount: closure.nodeCount,
    edgeCount: closure.edgeCount,
    rootMembershipHash: closure.rootMembershipHash,
    nodeMembershipHash: closure.nodeMembershipHash,
    edgeMembershipHash: closure.edgeMembershipHash,
  };
  return Object.freeze({
    ...identity,
    bindingHash: hashCandidateRuntimeProductionClosureBindingV2(identity),
  });
}

function sourceCheckpointV2(
  buildReceipt: CandidateBuildRuntimeBundleContextInternalV2["receipt"],
  source: NodeCandidateRuntimePrivateMaterializationV2["sourceBefore"],
) {
  const identity: CandidateRuntimeSourceCheckpointHashPayloadV2 = {
    schema: CANDIDATE_RUNTIME_SOURCE_CHECKPOINT_V2_SCHEMA,
    candidateSourceReceiptHash:
      buildReceipt.sourceAfter.candidateSourceReceiptHash,
    semanticRevisionHash: buildReceipt.sourceAfter.semanticRevisionHash,
    packageJson: {
      locator: "package.json",
      mediaType: "application/json",
      contentHash: source.packageJson.contentHash,
      byteLength: source.packageJson.byteLength,
    },
    lockfile: {
      schema: EXACT_SOURCE_FILE_REF_V2_SCHEMA,
      locator: "package-lock.json",
      mediaType: "application/json",
      hash: source.packageLock.contentHash,
      byteLength: source.packageLock.byteLength,
    },
  };
  return Object.freeze({
    ...identity,
    checkpointHash: hashCandidateRuntimeSourceCheckpointV2(identity),
  });
}

function npmProcessOutcomeV2(
  materialization: NodeCandidateRuntimePrivateMaterializationV2,
) {
  const evidence = materialization.installEvidence;
  const identity: CandidateNpmProcessOutcomeHashPayloadV2 = {
    schema: CANDIDATE_NPM_PROCESS_OUTCOME_V2_SCHEMA,
    status: evidence.status,
    exitCode: evidence.exitCode,
    signal: evidence.signal,
    stdoutHash: evidence.stdoutHash,
    stdoutBytes: evidence.stdoutBytes,
    stderrHash: evidence.stderrHash,
    stderrBytes: evidence.stderrBytes,
    processPolicy: CANDIDATE_NPM_PROCESS_POLICY_V2,
  };
  return Object.freeze({
    ...identity,
    outcomeHash: hashCandidateNpmProcessOutcomeV2(identity),
  });
}

function assertMaterializationJoinsBuildV2(input: Readonly<{
  buildReceipt: CandidateBuildRuntimeBundleContextInternalV2["receipt"];
  buildOutput: NodeCandidateBuildOutputV2;
  materialization: NodeCandidateRuntimePrivateMaterializationV2;
  expectedScope: "production_host" | "test_fixture";
}>): void {
  const source = input.buildReceipt.sourceAfter;
  const output = input.buildReceipt.outputTree;
  const runtime = input.materialization;
  if (
    runtime.admissionScope !== input.expectedScope
    || runtime.profileId !== output.profileId
    || runtime.sourceMaterializationReceiptHash
      !== source.sourceMaterializationReceiptHash
    || runtime.dependencyReceiptHash !== source.dependencyReceiptHash
    || runtime.dependencyIdentityHash !== source.dependencyIdentityHash
    || canonicalJsonStringify(runtime.applicationTree)
      !== canonicalJsonStringify(input.buildOutput.tree)
    || runtime.applicationTree.treeHash !== output.treeHash
    || runtime.applicationTree.payloadHash !== output.treePayloadHash
    || runtime.packageJson.contentHash
      !== runtime.productionClosure.sourceGraph.rootManifestRawHash
    || runtime.sourceAfter.packageLock.contentHash
      !== runtime.productionClosure.sourceGraph.lockRawHash
    || runtime.productionGraph.materializedDependencyTreeHash
      !== runtime.dependencyTree.treeHash
    || runtime.productionGraph.packageCount !== runtime.productionClosure.nodeCount
    || runtime.installEvidence.hostToolchainReceiptHash
      !== runtime.hostToolchain.receiptHash
    || runtime.installEvidence.environmentHash
      !== runtime.environment.environment.environmentHash
    || runtime.environment.admissionScope !== input.expectedScope
    || runtime.hostToolchain.admissionScope !== input.expectedScope
  ) {
    return fail(
      "CANDIDATE_RUNTIME_BUNDLE_V2_STATE_DRIFT",
      "Candidate build, application, source, closure, host and runtime materialization do not join",
    );
  }
}

function compileBundleV2(input: Readonly<{
  buildReceipt: CandidateBuildRuntimeBundleContextInternalV2["receipt"];
  buildOutput: NodeCandidateBuildOutputV2;
  materialization: NodeCandidateRuntimePrivateMaterializationV2;
  artifacts: RuntimeArtifactSetV2;
  producer: CandidateRuntimeBundleProducerV2;
  expectedScope: "production_host" | "test_fixture";
}>): CandidateRuntimeBundleV2 {
  assertMaterializationJoinsBuildV2(input);
  const build = input.buildReceipt;
  const runtime = input.materialization;
  if (
    runtime.hostToolchain.npm.version !== "10.9.8"
    || runtime.installEvidence.directArgvHash !== CANDIDATE_NPM_DIRECT_ARGV_HASH_V2
  ) {
    return fail(
      "CANDIDATE_RUNTIME_BUNDLE_V2_STATE_DRIFT",
      "Candidate runtime npm identity or direct argv differs from the exact contract",
    );
  }
  const applicationTree = applicationBindingV2(build, runtime);
  const dependencyTree = dependencyBindingV2(
    runtime,
    input.artifacts,
    input.producer,
  );
  const productionGraph = productionGraphBindingV2(
    runtime,
    input.artifacts,
    input.producer,
  );
  const productionClosure = productionClosureBindingV2(runtime);
  const sourceBefore = sourceCheckpointV2(build, runtime.sourceBefore);
  const sourceAfter = sourceCheckpointV2(build, runtime.sourceAfter);
  const npmIdentity = {
    packageName: "npm" as const,
    version: "10.9.8" as const,
    executableRef: "TOOL_NODE_NPM_CLI_V2" as const,
    closureHash: runtime.hostToolchain.npm.closureHash,
    cliContentHash: runtime.hostToolchain.npm.cli.contentHash,
    packageTreeHash:
      runtime.hostToolchain.npm.packageTree.normalizedTreeHash,
  };
  const npmReceiptIdentity: CandidateNpmMaterializationReceiptHashPayloadV2 = {
    schema: CANDIDATE_NPM_MATERIALIZATION_RECEIPT_V2_SCHEMA,
    receiptVersion: CANDIDATE_RUNTIME_BUNDLE_V2_VERSION,
    contractHash: CANDIDATE_RUNTIME_BUNDLE_CONTRACT_HASH_V2,
    stage: "private_candidate_production_dependencies_verified",
    producer: input.producer,
    outputRoot: "candidate-bundle/node_modules",
    installRecipe: CANDIDATE_NPM_PRODUCTION_MATERIALIZATION_RECIPE_V2,
    recipeHash: CANDIDATE_NPM_PRODUCTION_MATERIALIZATION_RECIPE_V2.recipeHash,
    npmIdentity,
    hostToolchain: {
      receiptHash: runtime.hostToolchain.receiptHash,
      nodeIdentityHash: runtime.hostToolchain.node.identityHash,
      npmClosureHash: runtime.hostToolchain.npm.closureHash,
    },
    environment: {
      receiptHash: runtime.environment.receiptHash,
      environmentContractHash:
        runtime.environment.environment.environmentContractHash,
      effectiveConfigHash:
        runtime.environment.effectiveNpmConfig.effectiveConfigHash,
      environmentHash: runtime.environment.environment.environmentHash,
    },
    processBinding: {
      probeRef: runtime.installEvidence.probeRef,
      projectScopeHash: runtime.installEvidence.projectScopeHash,
      sourceFenceHash: runtime.installEvidence.sourceFenceHash,
      directArgvHash: runtime.installEvidence.directArgvHash,
    },
    sourceBefore,
    sourceAfter,
    productionClosure,
    productionGraph,
    dependencyTreeBindingHash: dependencyTree.bindingHash,
    dependencyTreeHash: dependencyTree.treeHash,
    dependencyTreePayloadHash: dependencyTree.treePayloadHash,
    packageCount: runtime.productionGraph.packageCount,
    lifecycleScripts: "forbidden",
    processOutcome: npmProcessOutcomeV2(runtime),
  };
  const npmMaterializationReceipt = Object.freeze({
    ...npmReceiptIdentity,
    receiptHash: hashCandidateNpmMaterializationReceiptV2(npmReceiptIdentity),
  });
  const blockerCodes: CandidateRuntimeBundleHashPayloadV2["readiness"]["blockerCodes"] = [
    CANDIDATE_RUNTIME_BUNDLE_V2_BLOCKER_CODES[0],
    CANDIDATE_RUNTIME_BUNDLE_V2_BLOCKER_CODES[1],
    CANDIDATE_RUNTIME_BUNDLE_V2_BLOCKER_CODES[2],
    CANDIDATE_RUNTIME_BUNDLE_V2_BLOCKER_CODES[3],
  ];
  const allowedRootEntries: CandidateRuntimeBundleHashPayloadV2["allowedRootEntries"] = [
    "application",
    "node_modules",
    "package.json",
  ];
  const identityWithoutClosure = {
    schema: CANDIDATE_RUNTIME_BUNDLE_V2_SCHEMA,
    receiptVersion: CANDIDATE_RUNTIME_BUNDLE_V2_VERSION,
    contractHash: CANDIDATE_RUNTIME_BUNDLE_CONTRACT_HASH_V2,
    stage: "private_candidate_runtime_bundle_verified" as const,
    readiness: {
      status: "verified_private_shadow" as const,
      productionUse: "forbidden" as const,
      blockerCodes,
    },
    producer: input.producer,
    packetEnvelopeHash: build.authority.packet.envelopeHash,
    implementationClosureHash:
      build.authority.implementationClosure.closureHash,
    buildTopologyHash: build.authority.buildTopology.manifestHash,
    sourceAuthority: {
      schema: CANDIDATE_RUNTIME_SOURCE_BINDING_V2_SCHEMA,
      candidateSourceEnvelopeHash:
        build.sourceAfter.candidateSourceEnvelopeHash,
      candidateSourceReceiptHash:
        build.sourceAfter.candidateSourceReceiptHash,
      semanticRevisionHash: build.sourceAfter.semanticRevisionHash,
    },
    buildReceiptHash: build.receiptHash,
    buildReceipt: build,
    logicalRoot: "candidate-bundle" as const,
    rootMode: "0555" as const,
    allowedRootEntries,
    applicationTree,
    dependencyTree,
    productionGraph,
    packageJson: {
      schema: CANDIDATE_RUNTIME_PACKAGE_JSON_REF_V2_SCHEMA,
      logicalLocator: "candidate-bundle/package.json" as const,
      mediaType: "application/json" as const,
      contentHash: runtime.packageJson.contentHash,
      byteLength: runtime.packageJson.byteLength,
      mode: "0444" as const,
    },
    npmMaterializationReceipt,
  };
  const bundleClosureHash = hashCandidateRuntimeBundleClosureV2(
    {
      logicalRoot: identityWithoutClosure.logicalRoot,
      rootMode: identityWithoutClosure.rootMode,
      allowedRootEntries: identityWithoutClosure.allowedRootEntries,
      applicationTree,
      dependencyTree,
      productionGraph,
      packageJson: identityWithoutClosure.packageJson,
    },
  );
  const identity: CandidateRuntimeBundleHashPayloadV2 = {
    ...identityWithoutClosure,
    bundleClosureHash,
  };
  try {
    return parseCandidateRuntimeBundleV2({
      ...identity,
      bundleHash: hashCandidateRuntimeBundleV2(identity),
    });
  } catch (error) {
    return fail(
      "CANDIDATE_RUNTIME_BUNDLE_V2_RECEIPT_INVALID",
      "Candidate runtime evidence did not produce one valid canonical bundle",
      error,
    );
  }
}

type RuntimeLifecycleV2 = { status: "ready" | "destroyed" };

type CandidateRuntimeBundleAuthorityStateV2 = Readonly<{
  expectedScope: "production_host" | "test_fixture";
  buildAuthority: CandidateBuildAuthorityV2;
  buildStage: CandidateBuildRuntimeBundleContextInternalV2["stage"];
  buildOutput: NodeCandidateBuildOutputV2;
  privateRuntime: MaterializedNodeCandidateRuntimePrivateV2;
  artifactAuthority: IndexedArtifactPublisher;
  publicationReservationId: string;
  artifacts: RuntimeArtifactSetV2;
  producer: CandidateRuntimeBundleProducerV2;
  bundle: CandidateRuntimeBundleV2;
  lifecycle: RuntimeLifecycleV2;
}>;

const runtimeAuthorityConstructorCapabilityV2 = Object.freeze({});
const runtimeAuthorityStateV2 = new WeakMap<
  object,
  CandidateRuntimeBundleAuthorityStateV2
>();

export class CandidateRuntimeBundleAuthorityV2 {
  readonly bundleHash: string;
  readonly bundleClosureHash: string;
  readonly buildReceiptHash: string;
  readonly applicationTreeHash: string;
  readonly dependencyTreeHash: string;
  readonly productionGraphHash: string;
  readonly admissionScope: "production_host" | "test_fixture";

  constructor(
    capability: object,
    state: CandidateRuntimeBundleAuthorityStateV2,
  ) {
    if (capability !== runtimeAuthorityConstructorCapabilityV2) {
      throw new CandidateRuntimeBundleErrorV2(
        "CANDIDATE_RUNTIME_BUNDLE_V2_AUTHORITY_UNAUTHENTICATED",
        "Candidate runtime authority constructor capability is unavailable",
      );
    }
    this.bundleHash = state.bundle.bundleHash;
    this.bundleClosureHash = state.bundle.bundleClosureHash;
    this.buildReceiptHash = state.bundle.buildReceiptHash;
    this.applicationTreeHash = state.bundle.applicationTree.treeHash;
    this.dependencyTreeHash = state.bundle.dependencyTree.treeHash;
    this.productionGraphHash = state.bundle.productionGraph.resolutionGraphHash;
    this.admissionScope = state.expectedScope;
    runtimeAuthorityStateV2.set(this, state);
    Object.freeze(this);
  }
}

export type CandidateRuntimeBundleResultV2 = Readonly<{
  status: "shadow_verified_runtime_bundle";
  diagnostics: readonly [];
  bundle: CandidateRuntimeBundleV2;
  dependencyTreeEnvelopeHash: string;
  productionGraphEnvelopeHash: string;
  authority: CandidateRuntimeBundleAuthorityV2;
  activationDisposition:
    "blocked_until_registry_evidence_launch_and_atomic_activation";
}>;

function classifyFailureV2(error: unknown): CandidateRuntimeBundleErrorV2 {
  if (error instanceof CandidateRuntimeBundleErrorV2) return error;
  if (error instanceof CandidateBuildErrorV2) {
    return new CandidateRuntimeBundleErrorV2(
      error.code === "CANDIDATE_BUILD_V2_RUNTIME_BUNDLE_ALREADY_CONSUMED"
        ? "CANDIDATE_RUNTIME_BUNDLE_V2_BUILD_ALREADY_CONSUMED"
        : "CANDIDATE_RUNTIME_BUNDLE_V2_BUILD_REJECTED",
      `Candidate build authority rejected runtime materialization as ${error.code}`,
      { cause: error },
    );
  }
  if (
    error instanceof NodeCandidateRuntimePrivateMaterializerErrorV2
    || error instanceof NodeScaffoldPrivateMaterializerErrorV2
  ) {
    return new CandidateRuntimeBundleErrorV2(
      "CANDIDATE_RUNTIME_BUNDLE_V2_MATERIALIZATION_REJECTED",
      `Private runtime materialization was rejected as ${error.code}`,
      { cause: error },
    );
  }
  if (error instanceof IndexedArtifactPublisherError) {
    return new CandidateRuntimeBundleErrorV2(
      "CANDIDATE_RUNTIME_BUNDLE_V2_PUBLICATION_REJECTED",
      `Runtime artifact publication was rejected as ${error.code}`,
      { cause: error },
    );
  }
  return new CandidateRuntimeBundleErrorV2(
    "CANDIDATE_RUNTIME_BUNDLE_V2_RECEIPT_INVALID",
    "Candidate runtime materialization failed at an untyped internal boundary",
    { cause: error },
  );
}

async function materializeInternalV2(
  input: unknown,
  expectedScope: "production_host" | "test_fixture",
): Promise<CandidateRuntimeBundleResultV2> {
  const buildAuthority = exactBuildInput(input);
  let context: CandidateBuildRuntimeBundleContextInternalV2 | undefined;
  let runtimeInputs: NodeCandidateRuntimeBundleInputsInternalV2 | undefined;
  let privateRuntime: MaterializedNodeCandidateRuntimePrivateV2 | undefined;
  let buildLeaseClaimed = false;
  let stageLeaseClaimed = false;
  let succeeded = false;
  let primaryFailure: CandidateRuntimeBundleErrorV2 | undefined;
  try {
    context = await acquireCandidateBuildRuntimeBundleContextInternalV2(
      buildAuthority,
      expectedScope,
    );
    buildLeaseClaimed = true;
    const scaffoldBaseReceiptHash =
      inspectScaffoldBaseMaterializationReceiptV2(context.stage).receiptHash;
    runtimeInputs = await acquireNodeCandidateRuntimeBundleInputsInternalV2(
      context.stage,
      {
        admissionScope: context.expectedScope,
        profileId: context.output.profileId,
        sourceMaterializationReceiptHash:
          context.output.sourceMaterializationReceiptHash,
        dependencyReceiptHash: context.output.dependencyReceiptHash,
        dependencyIdentityHash: context.output.dependencyIdentityHash,
        outputMembershipHash: context.output.membershipHash,
        outputTreeHash: context.output.tree.treeHash,
        outputTreePayloadHash: context.output.tree.payloadHash,
      },
    );
    stageLeaseClaimed = true;
    if (runtimeInputs.scaffoldBaseReceiptHash !== scaffoldBaseReceiptHash) {
      return fail(
        "CANDIDATE_RUNTIME_BUNDLE_V2_STATE_DRIFT",
        "Candidate runtime input lease changed scaffold-base authority",
      );
    }
    const materializePrivate = expectedScope === "production_host"
      ? materializeNodeCandidateRuntimePrivateV2
      : materializeNodeCandidateRuntimePrivateV2ForTest;
    privateRuntime = await materializePrivate({ runtimeInputs });
    settleNodeCandidateRuntimeBundleInputsInternalV2(
      context.stage,
      runtimeInputs.scaffoldBaseReceiptHash,
    );
    stageLeaseClaimed = false;
    settleCandidateBuildRuntimeBundleContextInternalV2(
      buildAuthority,
      context.receipt.receiptHash,
    );
    buildLeaseClaimed = false;
    const materialization = await revalidateNodeCandidateRuntimePrivateV2(
      privateRuntime,
    );
    let publisher: ReturnType<typeof inspectIndexedArtifactPublisherAuthorityV1>;
    try {
      publisher = inspectIndexedArtifactPublisherAuthorityV1(
        context.artifactAuthority,
      );
    } catch (error) {
      return fail(
        "CANDIDATE_RUNTIME_BUNDLE_V2_PUBLICATION_REJECTED",
        "Candidate runtime publisher is not one authentic indexed authority",
        error,
      );
    }
    if (
      expectedScope === "production_host"
      && publisher.publicationAuthority !== "hybrid-required"
    ) {
      return fail(
        "CANDIDATE_RUNTIME_BUNDLE_V2_PUBLICATION_REJECTED",
        "Production runtime artifacts require trusted hybrid publication",
      );
    }
    const producer = producerV2(context.receipt.producer.codeSha);
    const artifacts = runtimeArtifactSetV2(materialization, producer);
    const bundle = compileBundleV2({
      buildReceipt: context.receipt,
      buildOutput: context.output,
      materialization,
      artifacts,
      producer,
      expectedScope,
    });
    const publicationReservationId = `candidate-runtime-bundle-v2:${randomUUID()}`;
    const publication = await context.artifactAuthority.putBatch({
      batchReservationId: publicationReservationId,
      plan: {
        schema: ARTIFACT_STORE_BATCH_PLAN_SCHEMA_V1,
        items: [
          { durabilityTier: 0, envelope: artifacts.dependencyEnvelope },
          { durabilityTier: 0, envelope: artifacts.graphEnvelope },
        ],
      },
    });
    assertArtifactPublicationV2({
      publication,
      reservationId: publicationReservationId,
      artifacts,
      producer,
    });
    const lifecycle: RuntimeLifecycleV2 = { status: "ready" };
    const state: CandidateRuntimeBundleAuthorityStateV2 = Object.freeze({
      expectedScope,
      buildAuthority,
      buildStage: context.stage,
      buildOutput: context.output,
      privateRuntime,
      artifactAuthority: context.artifactAuthority,
      publicationReservationId,
      artifacts,
      producer,
      bundle,
      lifecycle,
    });
    const authority = new CandidateRuntimeBundleAuthorityV2(
      runtimeAuthorityConstructorCapabilityV2,
      state,
    );
    succeeded = true;
    return Object.freeze({
      status: "shadow_verified_runtime_bundle" as const,
      diagnostics: EMPTY_DIAGNOSTICS,
      bundle,
      dependencyTreeEnvelopeHash: artifacts.dependencyEnvelopeHash,
      productionGraphEnvelopeHash: artifacts.graphEnvelopeHash,
      authority,
      activationDisposition:
        "blocked_until_registry_evidence_launch_and_atomic_activation" as const,
    });
  } catch (error) {
    primaryFailure = classifyFailureV2(error);
    throw primaryFailure;
  } finally {
    if (!succeeded) {
      const cleanupErrors: unknown[] = [];
      if (stageLeaseClaimed && context && runtimeInputs) {
        try {
          settleNodeCandidateRuntimeBundleInputsInternalV2(
            context.stage,
            runtimeInputs.scaffoldBaseReceiptHash,
          );
        } catch (error) {
          cleanupErrors.push(error);
        }
      }
      if (buildLeaseClaimed && context) {
        try {
          settleCandidateBuildRuntimeBundleContextInternalV2(
            buildAuthority,
            context.receipt.receiptHash,
          );
        } catch (error) {
          cleanupErrors.push(error);
        }
      }
      if (privateRuntime) {
        try {
          destroyNodeCandidateRuntimePrivateV2(privateRuntime);
        } catch (error) {
          cleanupErrors.push(error);
        }
      } else if (runtimeInputs) {
        for (const file of [
          runtimeInputs.packageJson,
          runtimeInputs.packageLock,
          ...runtimeInputs.application,
        ]) file.bytes.fill(0);
        try {
          destroyNodeScaffoldExecutionEnvironmentV2(
            runtimeInputs.runtimeEnvironment,
          );
        } catch (error) {
          cleanupErrors.push(error);
        }
      }
      if (context) {
        try {
          destroyNodeCandidateBuildAttemptInternalV2(context.stage);
        } catch (error) {
          cleanupErrors.push(error);
        }
      }
      if (cleanupErrors.length > 0) {
        throw new CandidateRuntimeBundleErrorV2(
          "CANDIDATE_RUNTIME_BUNDLE_V2_CLEANUP_FAILED",
          "Failed runtime attempt could not clean every authenticated private authority",
          { cause: { primaryFailure, cleanupErrors } },
        );
      }
    }
  }
}

export function materializeCandidateRuntimeBundleV2(
  input: unknown,
): Promise<CandidateRuntimeBundleResultV2> {
  return materializeInternalV2(input, "production_host");
}

export function materializeCandidateRuntimeBundleV2ForTest(
  input: unknown,
): Promise<CandidateRuntimeBundleResultV2> {
  return materializeInternalV2(input, "test_fixture");
}

function authenticRuntimeStateV2(
  authority: CandidateRuntimeBundleAuthorityV2,
): CandidateRuntimeBundleAuthorityStateV2 {
  if (
    typeof authority !== "object"
    || authority === null
    || isProxy(authority)
    || Object.getPrototypeOf(authority)
      !== CandidateRuntimeBundleAuthorityV2.prototype
  ) {
    return fail(
      "CANDIDATE_RUNTIME_BUNDLE_V2_AUTHORITY_UNAUTHENTICATED",
      "Candidate runtime verification requires one authentic authority",
    );
  }
  const state = runtimeAuthorityStateV2.get(authority);
  if (!state) {
    return fail(
      "CANDIDATE_RUNTIME_BUNDLE_V2_AUTHORITY_UNAUTHENTICATED",
      "Candidate runtime verification requires one authentic authority",
    );
  }
  return state;
}

async function verifyInternalV2(
  input: unknown,
  expectedScope: "production_host" | "test_fixture",
) {
  const values = exactDataValue(input, ["expectedBundleHash", "runtimeAuthority"]);
  if (
    typeof values.expectedBundleHash !== "string"
    || !/^[a-f0-9]{64}$/u.test(values.expectedBundleHash)
  ) {
    return fail(
      "CANDIDATE_RUNTIME_BUNDLE_V2_INPUT_INVALID",
      "Candidate runtime expected bundle hash is invalid",
    );
  }
  const authority = values.runtimeAuthority as CandidateRuntimeBundleAuthorityV2;
  const state = authenticRuntimeStateV2(authority);
  if (state.expectedScope !== expectedScope) {
    return fail(
      "CANDIDATE_RUNTIME_BUNDLE_V2_AUTHORITY_UNAUTHENTICATED",
      "Candidate runtime authority scope does not match the verifier",
    );
  }
  if (state.lifecycle.status === "destroyed") {
    return fail(
      "CANDIDATE_RUNTIME_BUNDLE_V2_DESTROYED",
      "Candidate runtime authority has already been destroyed",
    );
  }
  if (state.bundle.bundleHash !== values.expectedBundleHash) {
    return fail(
      "CANDIDATE_RUNTIME_BUNDLE_V2_EXPECTED_HASH_MISMATCH",
      "Expected candidate runtime bundle hash differs from authority",
    );
  }
  try {
    const verifyBuild = expectedScope === "production_host"
      ? verifyCandidateBuildV2
      : verifyCandidateBuildV2ForTest;
    const verifiedBuild = await verifyBuild({
      buildAuthority: state.buildAuthority,
      expectedReceiptHash: state.bundle.buildReceiptHash,
    });
    if (
      verifiedBuild.status !== "verified_shadow"
      || verifiedBuild.receipt.receiptHash !== state.bundle.buildReceiptHash
    ) {
      return fail(
        "CANDIDATE_RUNTIME_BUNDLE_V2_BUILD_REJECTED",
        "Candidate build no longer reproduces for runtime verification",
      );
    }
    const materialization = await revalidateNodeCandidateRuntimePrivateV2(
      state.privateRuntime,
    );
    const freshArtifacts = runtimeArtifactSetV2(materialization, state.producer);
    if (
      canonicalJsonStringify(freshArtifacts)
        !== canonicalJsonStringify(state.artifacts)
    ) {
      return fail(
        "CANDIDATE_RUNTIME_BUNDLE_V2_STATE_DRIFT",
        "Candidate runtime artifacts no longer reproduce from physical authority",
      );
    }
    const publisher = inspectIndexedArtifactPublisherAuthorityV1(
      state.artifactAuthority,
    );
    if (
      expectedScope === "production_host"
      && publisher.publicationAuthority !== "hybrid-required"
    ) {
      return fail(
        "CANDIDATE_RUNTIME_BUNDLE_V2_PUBLICATION_REJECTED",
        "Production runtime publisher lost trusted hybrid authority",
      );
    }
    const replay = await state.artifactAuthority.putBatch({
      batchReservationId: state.publicationReservationId,
      plan: {
        schema: ARTIFACT_STORE_BATCH_PLAN_SCHEMA_V1,
        items: [
          { durabilityTier: 0, envelope: state.artifacts.dependencyEnvelope },
          { durabilityTier: 0, envelope: state.artifacts.graphEnvelope },
        ],
      },
    });
    assertArtifactPublicationV2({
      publication: replay,
      reservationId: state.publicationReservationId,
      artifacts: state.artifacts,
      producer: state.producer,
    });
    const freshBundle = compileBundleV2({
      buildReceipt: verifiedBuild.receipt,
      buildOutput: state.buildOutput,
      materialization,
      artifacts: state.artifacts,
      producer: state.producer,
      expectedScope,
    });
    const parsed = parseCandidateRuntimeBundleV2(state.bundle);
    if (
      canonicalJsonStringify(freshBundle)
        !== canonicalJsonStringify(state.bundle)
      || parsed.bundleHash !== state.bundle.bundleHash
    ) {
      return fail(
        "CANDIDATE_RUNTIME_BUNDLE_V2_STATE_DRIFT",
        "Candidate runtime authority no longer reproduces its canonical bundle",
      );
    }
    return Object.freeze({
      status: "verified_shadow" as const,
      diagnostics: EMPTY_DIAGNOSTICS,
      bundle: defensiveCopy(parsed),
      dependencyTreeEnvelopeHash: state.artifacts.dependencyEnvelopeHash,
      productionGraphEnvelopeHash: state.artifacts.graphEnvelopeHash,
      authority,
    });
  } catch (error) {
    throw classifyFailureV2(error);
  }
}

export function verifyCandidateRuntimeBundleV2(input: unknown) {
  return verifyInternalV2(input, "production_host");
}

export function verifyCandidateRuntimeBundleV2ForTest(input: unknown) {
  return verifyInternalV2(input, "test_fixture");
}

type CandidateRuntimeCliExecutionLeaseLifecycleInternalV2 = {
  status: "ready" | "claimed" | "consumed";
};

type CandidateRuntimeCliExecutionLeaseStateInternalV2 = Readonly<{
  runtimeAuthority: CandidateRuntimeBundleAuthorityV2;
  admissionScope: "production_host" | "test_fixture";
  expectedBundleHash: string;
  buildReceiptHash: string;
  transportContract: Readonly<CliInvocationInputTransportV2>;
  transportSetHash: string;
  transportMembershipHash: string;
  runtimeSourceLogicalReceiptHash: string;
  lifecycle: CandidateRuntimeCliExecutionLeaseLifecycleInternalV2;
}>;

const candidateRuntimeCliLeaseConstructorCapabilityInternalV2 =
  Object.freeze({});
const candidateRuntimeCliLeaseStateInternalV2 = new WeakMap<
  object,
  CandidateRuntimeCliExecutionLeaseStateInternalV2
>();

/**
 * @internal Pathless one-use bridge from an authentic runtime bundle to the
 * code-owned CLI launcher.
 */
export class CandidateRuntimeCliExecutionLeaseInternalV2 {
  readonly runtimeBundleHash: string;
  readonly buildReceiptHash: string;
  readonly actionRef: string;
  readonly transportContractHash: string;
  readonly admissionScope: "production_host" | "test_fixture";

  constructor(
    capability: object,
    state: CandidateRuntimeCliExecutionLeaseStateInternalV2,
  ) {
    if (capability !== candidateRuntimeCliLeaseConstructorCapabilityInternalV2) {
      throw new CandidateRuntimeBundleErrorV2(
        "CANDIDATE_RUNTIME_BUNDLE_V2_AUTHORITY_UNAUTHENTICATED",
        "Candidate runtime CLI lease constructor capability is unavailable",
      );
    }
    this.runtimeBundleHash = state.expectedBundleHash;
    this.buildReceiptHash = state.buildReceiptHash;
    this.actionRef = state.transportContract.actionRef;
    this.transportContractHash = state.transportContract.contractHash;
    this.admissionScope = state.admissionScope;
    candidateRuntimeCliLeaseStateInternalV2.set(this, state);
    Object.freeze(this);
  }
}

function authenticCandidateRuntimeCliLeaseInternalV2(
  lease: CandidateRuntimeCliExecutionLeaseInternalV2,
): CandidateRuntimeCliExecutionLeaseStateInternalV2 {
  if (
    typeof lease !== "object"
    || lease === null
    || isProxy(lease)
    || Object.getPrototypeOf(lease)
      !== CandidateRuntimeCliExecutionLeaseInternalV2.prototype
  ) {
    return fail(
      "CANDIDATE_RUNTIME_BUNDLE_V2_AUTHORITY_UNAUTHENTICATED",
      "Candidate runtime CLI execution requires one authentic lease",
    );
  }
  const state = candidateRuntimeCliLeaseStateInternalV2.get(lease);
  if (!state) {
    return fail(
      "CANDIDATE_RUNTIME_BUNDLE_V2_AUTHORITY_UNAUTHENTICATED",
      "Candidate runtime CLI execution requires one authentic lease",
    );
  }
  return state;
}

export type CandidateRuntimeCliExecutionLeaseResultInternalV2 = Readonly<{
  lease: CandidateRuntimeCliExecutionLeaseInternalV2;
  runtimeBundleHash: string;
  runtimeBundleClosureHash: string;
  buildReceiptHash: string;
  applicationTreeHash: string;
  materializationHash: string;
  moduleLocator: "candidate-bundle/application/cli.js";
  moduleContentHash: string;
  moduleByteLength: number;
  moduleMode: "0444";
  modulePhysicalIdentityHash: string;
  transportContract: Readonly<CliInvocationInputTransportV2>;
  transportSetHash: string;
  transportMembershipHash: string;
  runtimeSourceLogicalReceiptHash: string;
}>;

export async function issueCandidateRuntimeCliExecutionLeaseInternalV2(
  runtimeAuthority: CandidateRuntimeBundleAuthorityV2,
  expectedBundleHash: string,
  expectedScope: "production_host" | "test_fixture",
  actionRef: unknown,
): Promise<CandidateRuntimeCliExecutionLeaseResultInternalV2> {
  const runtimeState = authenticRuntimeStateV2(runtimeAuthority);
  if (
    runtimeState.expectedScope !== expectedScope
    || runtimeState.bundle.bundleHash !== expectedBundleHash
  ) {
    return fail(
      "CANDIDATE_RUNTIME_BUNDLE_V2_AUTHORITY_UNAUTHENTICATED",
      "Candidate runtime CLI lease scope or expected bundle differs",
    );
  }
  const verified = await verifyInternalV2({
    runtimeAuthority,
    expectedBundleHash,
  }, expectedScope);
  const transport =
    await acquireCandidateBuildInvocationTransportContextInternalV2(
      runtimeState.buildAuthority,
      expectedScope,
      actionRef,
    );
  const contract = transport.source.transportContract;
  if (
    runtimeState.bundle.buildReceipt.outputTree.profileId
      !== "PROFILE_NODE_CLI_STATELESS_EXACT_V2"
    || contract.kind !== "cli_command"
    || contract.profileBinding.profileId
      !== "PROFILE_NODE_CLI_STATELESS_EXACT_V2"
    || contract.stackPackBinding.stackPackId !== "node-cli"
    || contract.runtimeBinding.invocationKind !== "cli_process"
    || contract.runtimeBinding.launcherRef !== "LAUNCH_NODE_CLI_V2"
    || transport.buildReceiptHash !== runtimeState.bundle.buildReceiptHash
    || transport.buildOutputTreeHash
      !== runtimeState.bundle.applicationTree.treeHash
    || verified.bundle.bundleHash !== runtimeState.bundle.bundleHash
  ) {
    return fail(
      "CANDIDATE_RUNTIME_BUNDLE_V2_LAUNCH_PROFILE_INVALID",
      "Candidate runtime, build output and transport do not form one CLI launch profile",
    );
  }
  const physical =
    await acquireNodeCandidateRuntimePhysicalLaunchContextInternalV2(
      runtimeState.privateRuntime,
    );
  if (
    physical.profileId !== "PROFILE_NODE_CLI_STATELESS_EXACT_V2"
    || physical.applicationTree.treeHash
      !== runtimeState.bundle.applicationTree.treeHash
    || physical.materializationHash
      !== runtimeState.privateRuntime.materializationHash
    || physical.applicationEntrypoint.logicalLocator !== "cli.js"
  ) {
    return fail(
      "CANDIDATE_RUNTIME_BUNDLE_V2_STATE_DRIFT",
      "Candidate runtime physical CLI entrypoint does not reproduce its bundle",
    );
  }
  const lifecycle: CandidateRuntimeCliExecutionLeaseLifecycleInternalV2 = {
    status: "ready",
  };
  const leaseState: CandidateRuntimeCliExecutionLeaseStateInternalV2 =
    Object.freeze({
      runtimeAuthority,
      admissionScope: expectedScope,
      expectedBundleHash,
      buildReceiptHash: runtimeState.bundle.buildReceiptHash,
      transportContract: defensiveCopy(contract),
      transportSetHash: transport.source.transportSetHash,
      transportMembershipHash: transport.source.transportMembershipHash,
      runtimeSourceLogicalReceiptHash:
        transport.source.runtimeSourceLogicalReceiptHash,
      lifecycle,
    });
  const lease = new CandidateRuntimeCliExecutionLeaseInternalV2(
    candidateRuntimeCliLeaseConstructorCapabilityInternalV2,
    leaseState,
  );
  return Object.freeze({
    lease,
    runtimeBundleHash: runtimeState.bundle.bundleHash,
    runtimeBundleClosureHash: runtimeState.bundle.bundleClosureHash,
    buildReceiptHash: runtimeState.bundle.buildReceiptHash,
    applicationTreeHash: runtimeState.bundle.applicationTree.treeHash,
    materializationHash: physical.materializationHash,
    moduleLocator: "candidate-bundle/application/cli.js" as const,
    moduleContentHash: physical.applicationEntrypoint.contentHash,
    moduleByteLength: physical.applicationEntrypoint.byteLength,
    moduleMode: "0444" as const,
    modulePhysicalIdentityHash:
      physical.applicationEntrypoint.physicalIdentityHash,
    transportContract: defensiveCopy(contract),
    transportSetHash: transport.source.transportSetHash,
    transportMembershipHash: transport.source.transportMembershipHash,
    runtimeSourceLogicalReceiptHash:
      transport.source.runtimeSourceLogicalReceiptHash,
  });
}

function candidateRuntimeCliSourceFenceHashInternalV2(
  runtimeBundleHash: string,
  physical: Awaited<ReturnType<
    typeof acquireNodeCandidateRuntimePhysicalLaunchContextInternalV2
  >>,
): string {
  return hashCanonicalJson({
    schema: "setfarm.candidate-runtime-cli-source-fence.v2",
    runtimeBundleHash,
    materializationHash: physical.materializationHash,
    applicationTreeHash: physical.applicationTree.treeHash,
    module: {
      logicalLocator: physical.applicationEntrypoint.logicalLocator,
      contentHash: physical.applicationEntrypoint.contentHash,
      byteLength: physical.applicationEntrypoint.byteLength,
      mode: physical.applicationEntrypoint.mode,
      physicalIdentityHash:
        physical.applicationEntrypoint.physicalIdentityHash,
    },
    environmentReceiptHash: physical.environment.environmentReceiptHash,
    environmentHash: physical.environment.environmentHash,
    hostToolchainReceiptHash:
      physical.environment.hostRuntime.hostToolchainReceiptHash,
    nodeIdentityHash: physical.environment.hostRuntime.nodeIdentityHash,
    nodeExecutableContentHash:
      physical.environment.hostRuntime.nodeExecutableContentHash,
  });
}

export type CandidateRuntimeCliExecutionResultInternalV2 = Readonly<{
  runtimeBundleHash: string;
  runtimeBundleClosureHash: string;
  buildReceiptHash: string;
  applicationTreeHash: string;
  materializationHash: string;
  moduleLocator: "candidate-bundle/application/cli.js";
  moduleContentHash: string;
  moduleByteLength: number;
  moduleMode: "0444";
  modulePhysicalIdentityHash: string;
  transportContract: Readonly<CliInvocationInputTransportV2>;
  transportSetHash: string;
  transportMembershipHash: string;
  runtimeSourceLogicalReceiptHash: string;
  sourceFenceBeforeHash: string;
  sourceFenceAfterHash: string;
  hostToolchainReceiptHash: string;
  nodeIdentityHash: string;
  nodeExecutableContentHash: string;
  process: PrivateNodeCliProcessResultV2;
}>;

export async function executeCandidateRuntimeCliLeaseInternalV2(
  lease: CandidateRuntimeCliExecutionLeaseInternalV2,
  request: CliEncodedInvocationRequestV2,
): Promise<CandidateRuntimeCliExecutionResultInternalV2> {
  const leaseState = authenticCandidateRuntimeCliLeaseInternalV2(lease);
  if (leaseState.lifecycle.status !== "ready") {
    return fail(
      "CANDIDATE_RUNTIME_BUNDLE_V2_LAUNCH_AUTHORITY_ALREADY_CONSUMED",
      "Candidate runtime CLI execution lease is one-use",
    );
  }
  leaseState.lifecycle.status = "claimed";
  const runtimeState = authenticRuntimeStateV2(leaseState.runtimeAuthority);
  let processResult: PrivateNodeCliProcessResultV2 | undefined;
  try {
    const verified = await verifyInternalV2({
      runtimeAuthority: leaseState.runtimeAuthority,
      expectedBundleHash: leaseState.expectedBundleHash,
    }, leaseState.admissionScope);
    const transport =
      await acquireCandidateBuildInvocationTransportContextInternalV2(
        runtimeState.buildAuthority,
        leaseState.admissionScope,
        leaseState.transportContract.actionRef,
      );
    if (
      verified.bundle.bundleHash !== leaseState.expectedBundleHash
      || transport.buildReceiptHash !== leaseState.buildReceiptHash
      || canonicalJsonStringify(transport.source.transportContract)
        !== canonicalJsonStringify(leaseState.transportContract)
      || transport.source.transportSetHash !== leaseState.transportSetHash
      || transport.source.transportMembershipHash
        !== leaseState.transportMembershipHash
      || transport.source.runtimeSourceLogicalReceiptHash
        !== leaseState.runtimeSourceLogicalReceiptHash
    ) {
      return fail(
        "CANDIDATE_RUNTIME_BUNDLE_V2_LAUNCH_TRANSPORT_REJECTED",
        "Candidate runtime CLI transport changed before execution",
      );
    }
    const before =
      await acquireNodeCandidateRuntimePhysicalLaunchContextInternalV2(
        runtimeState.privateRuntime,
      );
    if (
      before.profileId !== "PROFILE_NODE_CLI_STATELESS_EXACT_V2"
      || before.applicationEntrypoint.logicalLocator !== "cli.js"
      || before.applicationTree.treeHash
        !== runtimeState.bundle.applicationTree.treeHash
      || before.materializationHash
        !== runtimeState.privateRuntime.materializationHash
    ) {
      return fail(
        "CANDIDATE_RUNTIME_BUNDLE_V2_STATE_DRIFT",
        "Candidate runtime CLI source fence does not match its bundle",
      );
    }
    const sourceFenceBeforeHash =
      candidateRuntimeCliSourceFenceHashInternalV2(
        leaseState.expectedBundleHash,
        before,
      );
    processResult = await executePrivateNodeCliProcessV2({
      bundleRoot: before.bundleRoot,
      modulePath: before.applicationEntrypoint.absolutePath,
      moduleContentHash: before.applicationEntrypoint.contentHash,
      nodeExecutablePath:
        before.environment.hostRuntime.nodeExecutablePath,
      request,
    });
    const after =
      await acquireNodeCandidateRuntimePhysicalLaunchContextInternalV2(
        runtimeState.privateRuntime,
      );
    const sourceFenceAfterHash =
      candidateRuntimeCliSourceFenceHashInternalV2(
        leaseState.expectedBundleHash,
        after,
      );
    if (
      sourceFenceAfterHash !== sourceFenceBeforeHash
      || after.applicationEntrypoint.contentHash
        !== before.applicationEntrypoint.contentHash
      || after.applicationEntrypoint.physicalIdentityHash
        !== before.applicationEntrypoint.physicalIdentityHash
      || after.environment.hostRuntime.nodeExecutableContentHash
        !== before.environment.hostRuntime.nodeExecutableContentHash
    ) {
      processResult.stdout.fill(0);
      processResult.stderr.fill(0);
      return fail(
        "CANDIDATE_RUNTIME_BUNDLE_V2_STATE_DRIFT",
        "Candidate runtime CLI authority changed across process execution",
      );
    }
    return Object.freeze({
      runtimeBundleHash: runtimeState.bundle.bundleHash,
      runtimeBundleClosureHash: runtimeState.bundle.bundleClosureHash,
      buildReceiptHash: runtimeState.bundle.buildReceiptHash,
      applicationTreeHash: runtimeState.bundle.applicationTree.treeHash,
      materializationHash: before.materializationHash,
      moduleLocator: "candidate-bundle/application/cli.js" as const,
      moduleContentHash: before.applicationEntrypoint.contentHash,
      moduleByteLength: before.applicationEntrypoint.byteLength,
      moduleMode: "0444" as const,
      modulePhysicalIdentityHash:
        before.applicationEntrypoint.physicalIdentityHash,
      transportContract: defensiveCopy(leaseState.transportContract),
      transportSetHash: leaseState.transportSetHash,
      transportMembershipHash: leaseState.transportMembershipHash,
      runtimeSourceLogicalReceiptHash:
        leaseState.runtimeSourceLogicalReceiptHash,
      sourceFenceBeforeHash,
      sourceFenceAfterHash,
      hostToolchainReceiptHash:
        before.environment.hostRuntime.hostToolchainReceiptHash,
      nodeIdentityHash: before.environment.hostRuntime.nodeIdentityHash,
      nodeExecutableContentHash:
        before.environment.hostRuntime.nodeExecutableContentHash,
      process: processResult,
    });
  } catch (error) {
    processResult?.stdout.fill(0);
    processResult?.stderr.fill(0);
    if (error instanceof CandidateRuntimeBundleErrorV2) throw error;
    return fail(
      "CANDIDATE_RUNTIME_BUNDLE_V2_LAUNCH_PROCESS_REJECTED",
      "Candidate runtime CLI execution failed at one authenticated boundary",
      error,
    );
  } finally {
    leaseState.lifecycle.status = "consumed";
  }
}

type CandidateRuntimeApiExecutionLeaseLifecycleInternalV2 = {
  status: "ready" | "claimed" | "consumed";
};

type CandidateRuntimeApiExecutionLeaseStateInternalV2 = Readonly<{
  runtimeAuthority: CandidateRuntimeBundleAuthorityV2;
  admissionScope: "production_host" | "test_fixture";
  expectedBundleHash: string;
  buildReceiptHash: string;
  transportContract: Readonly<HttpInvocationInputTransportV2>;
  transportSetHash: string;
  transportMembershipHash: string;
  runtimeSourceLogicalReceiptHash: string;
  lifecycle: CandidateRuntimeApiExecutionLeaseLifecycleInternalV2;
}>;

const candidateRuntimeApiLeaseConstructorCapabilityInternalV2 =
  Object.freeze({});
const candidateRuntimeApiLeaseStateInternalV2 = new WeakMap<
  object,
  CandidateRuntimeApiExecutionLeaseStateInternalV2
>();

/**
 * @internal Pathless one-use bridge from an authentic runtime bundle to the
 * code-owned Node Express API launcher.
 */
export class CandidateRuntimeApiExecutionLeaseInternalV2 {
  readonly runtimeBundleHash: string;
  readonly buildReceiptHash: string;
  readonly actionRef: string;
  readonly transportContractHash: string;
  readonly admissionScope: "production_host" | "test_fixture";

  constructor(
    capability: object,
    state: CandidateRuntimeApiExecutionLeaseStateInternalV2,
  ) {
    if (capability !== candidateRuntimeApiLeaseConstructorCapabilityInternalV2) {
      throw new CandidateRuntimeBundleErrorV2(
        "CANDIDATE_RUNTIME_BUNDLE_V2_AUTHORITY_UNAUTHENTICATED",
        "Candidate runtime API lease constructor capability is unavailable",
      );
    }
    this.runtimeBundleHash = state.expectedBundleHash;
    this.buildReceiptHash = state.buildReceiptHash;
    this.actionRef = state.transportContract.actionRef;
    this.transportContractHash = state.transportContract.contractHash;
    this.admissionScope = state.admissionScope;
    candidateRuntimeApiLeaseStateInternalV2.set(this, state);
    Object.freeze(this);
  }
}

function authenticCandidateRuntimeApiLeaseInternalV2(
  lease: CandidateRuntimeApiExecutionLeaseInternalV2,
): CandidateRuntimeApiExecutionLeaseStateInternalV2 {
  if (
    typeof lease !== "object"
    || lease === null
    || isProxy(lease)
    || Object.getPrototypeOf(lease)
      !== CandidateRuntimeApiExecutionLeaseInternalV2.prototype
  ) {
    return fail(
      "CANDIDATE_RUNTIME_BUNDLE_V2_AUTHORITY_UNAUTHENTICATED",
      "Candidate runtime API execution requires one authentic lease",
    );
  }
  const state = candidateRuntimeApiLeaseStateInternalV2.get(lease);
  if (!state) {
    return fail(
      "CANDIDATE_RUNTIME_BUNDLE_V2_AUTHORITY_UNAUTHENTICATED",
      "Candidate runtime API execution requires one authentic lease",
    );
  }
  return state;
}

export type CandidateRuntimeApiExecutionLeaseResultInternalV2 = Readonly<{
  lease: CandidateRuntimeApiExecutionLeaseInternalV2;
  runtimeBundleHash: string;
  runtimeBundleClosureHash: string;
  buildReceiptHash: string;
  applicationTreeHash: string;
  materializationHash: string;
  moduleLocator: "candidate-bundle/application/app.js";
  moduleContentHash: string;
  moduleByteLength: number;
  moduleMode: "0444";
  modulePhysicalIdentityHash: string;
  applicationExport: "setfarmHttpHandlerV2";
  transportContract: Readonly<HttpInvocationInputTransportV2>;
  transportSetHash: string;
  transportMembershipHash: string;
  runtimeSourceLogicalReceiptHash: string;
}>;

export async function issueCandidateRuntimeApiExecutionLeaseInternalV2(
  runtimeAuthority: CandidateRuntimeBundleAuthorityV2,
  expectedBundleHash: string,
  expectedScope: "production_host" | "test_fixture",
  actionRef: unknown,
): Promise<CandidateRuntimeApiExecutionLeaseResultInternalV2> {
  const runtimeState = authenticRuntimeStateV2(runtimeAuthority);
  if (
    runtimeState.expectedScope !== expectedScope
    || runtimeState.bundle.bundleHash !== expectedBundleHash
  ) {
    return fail(
      "CANDIDATE_RUNTIME_BUNDLE_V2_AUTHORITY_UNAUTHENTICATED",
      "Candidate runtime API lease scope or expected bundle differs",
    );
  }
  const verified = await verifyInternalV2({
    runtimeAuthority,
    expectedBundleHash,
  }, expectedScope);
  const transport =
    await acquireCandidateBuildInvocationTransportContextInternalV2(
      runtimeState.buildAuthority,
      expectedScope,
      actionRef,
    );
  const contract = transport.source.transportContract;
  if (
    runtimeState.bundle.buildReceipt.outputTree.profileId
      !== "PROFILE_NODE_EXPRESS_API_STATELESS_EXACT_V2"
    || contract.kind !== "http_request"
    || contract.profileBinding.profileId
      !== "PROFILE_NODE_EXPRESS_API_STATELESS_EXACT_V2"
    || contract.stackPackBinding.stackPackId !== "node-express-api"
    || contract.runtimeBinding.invocationKind !== "http_service"
    || contract.runtimeBinding.launcherRef !== "LAUNCH_NODE_EXPRESS_API_V2"
    || transport.buildReceiptHash !== runtimeState.bundle.buildReceiptHash
    || transport.buildOutputTreeHash
      !== runtimeState.bundle.applicationTree.treeHash
    || verified.bundle.bundleHash !== runtimeState.bundle.bundleHash
  ) {
    return fail(
      "CANDIDATE_RUNTIME_BUNDLE_V2_LAUNCH_PROFILE_INVALID",
      "Candidate runtime, build output and transport do not form one API launch profile",
    );
  }
  const physical =
    await acquireNodeCandidateRuntimePhysicalLaunchContextInternalV2(
      runtimeState.privateRuntime,
    );
  if (
    physical.profileId !== "PROFILE_NODE_EXPRESS_API_STATELESS_EXACT_V2"
    || physical.applicationTree.treeHash
      !== runtimeState.bundle.applicationTree.treeHash
    || physical.materializationHash
      !== runtimeState.privateRuntime.materializationHash
    || physical.applicationEntrypoint.logicalLocator !== "app.js"
  ) {
    return fail(
      "CANDIDATE_RUNTIME_BUNDLE_V2_STATE_DRIFT",
      "Candidate runtime physical API entrypoint does not reproduce its bundle",
    );
  }
  const lifecycle: CandidateRuntimeApiExecutionLeaseLifecycleInternalV2 = {
    status: "ready",
  };
  const leaseState: CandidateRuntimeApiExecutionLeaseStateInternalV2 =
    Object.freeze({
      runtimeAuthority,
      admissionScope: expectedScope,
      expectedBundleHash,
      buildReceiptHash: runtimeState.bundle.buildReceiptHash,
      transportContract: defensiveCopy(contract),
      transportSetHash: transport.source.transportSetHash,
      transportMembershipHash: transport.source.transportMembershipHash,
      runtimeSourceLogicalReceiptHash:
        transport.source.runtimeSourceLogicalReceiptHash,
      lifecycle,
    });
  const lease = new CandidateRuntimeApiExecutionLeaseInternalV2(
    candidateRuntimeApiLeaseConstructorCapabilityInternalV2,
    leaseState,
  );
  return Object.freeze({
    lease,
    runtimeBundleHash: runtimeState.bundle.bundleHash,
    runtimeBundleClosureHash: runtimeState.bundle.bundleClosureHash,
    buildReceiptHash: runtimeState.bundle.buildReceiptHash,
    applicationTreeHash: runtimeState.bundle.applicationTree.treeHash,
    materializationHash: physical.materializationHash,
    moduleLocator: "candidate-bundle/application/app.js" as const,
    moduleContentHash: physical.applicationEntrypoint.contentHash,
    moduleByteLength: physical.applicationEntrypoint.byteLength,
    moduleMode: "0444" as const,
    modulePhysicalIdentityHash:
      physical.applicationEntrypoint.physicalIdentityHash,
    applicationExport: "setfarmHttpHandlerV2" as const,
    transportContract: defensiveCopy(contract),
    transportSetHash: transport.source.transportSetHash,
    transportMembershipHash: transport.source.transportMembershipHash,
    runtimeSourceLogicalReceiptHash:
      transport.source.runtimeSourceLogicalReceiptHash,
  });
}

function candidateRuntimeApiSourceFenceHashInternalV2(
  runtimeBundleHash: string,
  physical: Awaited<ReturnType<
    typeof acquireNodeCandidateRuntimePhysicalLaunchContextInternalV2
  >>,
): string {
  return hashCanonicalJson({
    schema: "setfarm.candidate-runtime-api-source-fence.v2",
    runtimeBundleHash,
    materializationHash: physical.materializationHash,
    applicationTreeHash: physical.applicationTree.treeHash,
    module: {
      logicalLocator: physical.applicationEntrypoint.logicalLocator,
      contentHash: physical.applicationEntrypoint.contentHash,
      byteLength: physical.applicationEntrypoint.byteLength,
      mode: physical.applicationEntrypoint.mode,
      physicalIdentityHash:
        physical.applicationEntrypoint.physicalIdentityHash,
      applicationExport: "setfarmHttpHandlerV2",
    },
    environmentReceiptHash: physical.environment.environmentReceiptHash,
    environmentHash: physical.environment.environmentHash,
    hostToolchainReceiptHash:
      physical.environment.hostRuntime.hostToolchainReceiptHash,
    nodeIdentityHash: physical.environment.hostRuntime.nodeIdentityHash,
    nodeExecutableContentHash:
      physical.environment.hostRuntime.nodeExecutableContentHash,
  });
}

export type CandidateRuntimeApiExecutionResultInternalV2 = Readonly<{
  runtimeBundleHash: string;
  runtimeBundleClosureHash: string;
  buildReceiptHash: string;
  applicationTreeHash: string;
  materializationHash: string;
  moduleLocator: "candidate-bundle/application/app.js";
  moduleContentHash: string;
  moduleByteLength: number;
  moduleMode: "0444";
  modulePhysicalIdentityHash: string;
  applicationExport: "setfarmHttpHandlerV2";
  transportContract: Readonly<HttpInvocationInputTransportV2>;
  transportSetHash: string;
  transportMembershipHash: string;
  runtimeSourceLogicalReceiptHash: string;
  sourceFenceBeforeHash: string;
  sourceFenceAfterHash: string;
  hostToolchainReceiptHash: string;
  nodeIdentityHash: string;
  nodeExecutableContentHash: string;
  process: PrivateNodeExpressApiProcessResultV2;
}>;

export async function executeCandidateRuntimeApiLeaseInternalV2(
  lease: CandidateRuntimeApiExecutionLeaseInternalV2,
  request: HttpEncodedInvocationRequestV2,
): Promise<CandidateRuntimeApiExecutionResultInternalV2> {
  const leaseState = authenticCandidateRuntimeApiLeaseInternalV2(lease);
  if (leaseState.lifecycle.status !== "ready") {
    return fail(
      "CANDIDATE_RUNTIME_BUNDLE_V2_LAUNCH_AUTHORITY_ALREADY_CONSUMED",
      "Candidate runtime API execution lease is one-use",
    );
  }
  leaseState.lifecycle.status = "claimed";
  const runtimeState = authenticRuntimeStateV2(leaseState.runtimeAuthority);
  let processResult: PrivateNodeExpressApiProcessResultV2 | undefined;
  try {
    const verified = await verifyInternalV2({
      runtimeAuthority: leaseState.runtimeAuthority,
      expectedBundleHash: leaseState.expectedBundleHash,
    }, leaseState.admissionScope);
    const transport =
      await acquireCandidateBuildInvocationTransportContextInternalV2(
        runtimeState.buildAuthority,
        leaseState.admissionScope,
        leaseState.transportContract.actionRef,
      );
    if (
      verified.bundle.bundleHash !== leaseState.expectedBundleHash
      || transport.buildReceiptHash !== leaseState.buildReceiptHash
      || canonicalJsonStringify(transport.source.transportContract)
        !== canonicalJsonStringify(leaseState.transportContract)
      || transport.source.transportSetHash !== leaseState.transportSetHash
      || transport.source.transportMembershipHash
        !== leaseState.transportMembershipHash
      || transport.source.runtimeSourceLogicalReceiptHash
        !== leaseState.runtimeSourceLogicalReceiptHash
    ) {
      return fail(
        "CANDIDATE_RUNTIME_BUNDLE_V2_LAUNCH_TRANSPORT_REJECTED",
        "Candidate runtime API transport changed before execution",
      );
    }
    const before =
      await acquireNodeCandidateRuntimePhysicalLaunchContextInternalV2(
        runtimeState.privateRuntime,
      );
    if (
      before.profileId !== "PROFILE_NODE_EXPRESS_API_STATELESS_EXACT_V2"
      || before.applicationEntrypoint.logicalLocator !== "app.js"
      || before.applicationTree.treeHash
        !== runtimeState.bundle.applicationTree.treeHash
      || before.materializationHash
        !== runtimeState.privateRuntime.materializationHash
    ) {
      return fail(
        "CANDIDATE_RUNTIME_BUNDLE_V2_STATE_DRIFT",
        "Candidate runtime API source fence does not match its bundle",
      );
    }
    const sourceFenceBeforeHash =
      candidateRuntimeApiSourceFenceHashInternalV2(
        leaseState.expectedBundleHash,
        before,
      );
    processResult = await executePrivateNodeExpressApiProcessV2({
      bundleRoot: before.bundleRoot,
      modulePath: before.applicationEntrypoint.absolutePath,
      moduleContentHash: before.applicationEntrypoint.contentHash,
      nodeExecutablePath:
        before.environment.hostRuntime.nodeExecutablePath,
      request,
    });
    const after =
      await acquireNodeCandidateRuntimePhysicalLaunchContextInternalV2(
        runtimeState.privateRuntime,
      );
    const sourceFenceAfterHash =
      candidateRuntimeApiSourceFenceHashInternalV2(
        leaseState.expectedBundleHash,
        after,
      );
    if (
      sourceFenceAfterHash !== sourceFenceBeforeHash
      || after.applicationEntrypoint.contentHash
        !== before.applicationEntrypoint.contentHash
      || after.applicationEntrypoint.physicalIdentityHash
        !== before.applicationEntrypoint.physicalIdentityHash
      || after.environment.hostRuntime.nodeExecutableContentHash
        !== before.environment.hostRuntime.nodeExecutableContentHash
    ) {
      processResult.responseBody.fill(0);
      return fail(
        "CANDIDATE_RUNTIME_BUNDLE_V2_STATE_DRIFT",
        "Candidate runtime API authority changed across service execution",
      );
    }
    return Object.freeze({
      runtimeBundleHash: runtimeState.bundle.bundleHash,
      runtimeBundleClosureHash: runtimeState.bundle.bundleClosureHash,
      buildReceiptHash: runtimeState.bundle.buildReceiptHash,
      applicationTreeHash: runtimeState.bundle.applicationTree.treeHash,
      materializationHash: before.materializationHash,
      moduleLocator: "candidate-bundle/application/app.js" as const,
      moduleContentHash: before.applicationEntrypoint.contentHash,
      moduleByteLength: before.applicationEntrypoint.byteLength,
      moduleMode: "0444" as const,
      modulePhysicalIdentityHash:
        before.applicationEntrypoint.physicalIdentityHash,
      applicationExport: "setfarmHttpHandlerV2" as const,
      transportContract: defensiveCopy(leaseState.transportContract),
      transportSetHash: leaseState.transportSetHash,
      transportMembershipHash: leaseState.transportMembershipHash,
      runtimeSourceLogicalReceiptHash:
        leaseState.runtimeSourceLogicalReceiptHash,
      sourceFenceBeforeHash,
      sourceFenceAfterHash,
      hostToolchainReceiptHash:
        before.environment.hostRuntime.hostToolchainReceiptHash,
      nodeIdentityHash: before.environment.hostRuntime.nodeIdentityHash,
      nodeExecutableContentHash:
        before.environment.hostRuntime.nodeExecutableContentHash,
      process: processResult,
    });
  } catch (error) {
    processResult?.responseBody.fill(0);
    if (error instanceof CandidateRuntimeBundleErrorV2) throw error;
    return fail(
      "CANDIDATE_RUNTIME_BUNDLE_V2_LAUNCH_PROCESS_REJECTED",
      "Candidate runtime API execution failed at one authenticated boundary",
      error,
    );
  } finally {
    leaseState.lifecycle.status = "consumed";
  }
}

export function destroyCandidateRuntimeBundleV2(
  authority: CandidateRuntimeBundleAuthorityV2,
): void {
  const state = authenticRuntimeStateV2(authority);
  if (state.lifecycle.status === "destroyed") return;
  const cleanupErrors: unknown[] = [];
  try {
    destroyNodeCandidateRuntimePrivateV2(state.privateRuntime);
  } catch (error) {
    cleanupErrors.push(error);
  }
  try {
    destroyNodeCandidateBuildAttemptInternalV2(state.buildStage);
  } catch (error) {
    cleanupErrors.push(error);
  }
  if (cleanupErrors.length > 0) {
    return fail(
      "CANDIDATE_RUNTIME_BUNDLE_V2_CLEANUP_FAILED",
      "Candidate runtime authority could not destroy every owned private root",
      cleanupErrors,
    );
  }
  state.lifecycle.status = "destroyed";
}
