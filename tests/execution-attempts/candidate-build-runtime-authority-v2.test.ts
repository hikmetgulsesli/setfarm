import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import { canonicalJsonBytes, hashCanonicalJson } from
  "../../src/product-compiler/canonical-json.js";
import * as buildModule from "../../src/execution/schemas/candidate-build-receipt-v2.js";
import {
  CANDIDATE_BUILD_OPERATION_V2_SCHEMA,
  CANDIDATE_BUILD_OUTPUT_FILE_V2_SCHEMA,
  CANDIDATE_BUILD_OUTPUT_TREE_BINDING_V2_SCHEMA,
  CANDIDATE_BUILD_PROCESS_OUTCOME_V2_SCHEMA,
  CANDIDATE_BUILD_PROCESS_POLICY_V2,
  CANDIDATE_BUILD_RECEIPT_CONTRACT_HASH_V2,
  CANDIDATE_BUILD_RECEIPT_V2_BLOCKER_CODES,
  CANDIDATE_BUILD_RECEIPT_V2_MAX_CANONICAL_BYTES,
  CANDIDATE_BUILD_RECEIPT_V2_SCHEMA,
  CANDIDATE_BUILD_RECEIPT_V2_VERSION,
  CANDIDATE_BUILD_SOURCE_CHECKPOINT_V2_SCHEMA,
  CANDIDATE_CANONICAL_RUNTIME_TREE_ARTIFACT_REF_V2_SCHEMA,
  CandidateBuildReceiptV2Schema,
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
  type CandidateBuildReceiptHashPayloadV2,
  type CandidateBuildReceiptV2,
  type CandidateBuildSourceCheckpointHashPayloadV2,
  type CandidateCanonicalRuntimeTreeArtifactRefV2,
} from "../../src/execution/schemas/candidate-build-receipt-v2.js";
import * as bundleModule from "../../src/execution/schemas/candidate-runtime-bundle-v2.js";
import {
  CANDIDATE_NPM_MATERIALIZATION_RECEIPT_ABI_POLICY_V2,
  CANDIDATE_NPM_MATERIALIZATION_RECEIPT_V2_SCHEMA,
  CANDIDATE_NPM_PROCESS_OUTCOME_V2_SCHEMA,
  CANDIDATE_NPM_PROCESS_POLICY_V2,
  CANDIDATE_NPM_PRODUCTION_MATERIALIZATION_CONFIG_V2,
  CANDIDATE_NPM_PRODUCTION_MATERIALIZATION_RECIPE_V2,
  CANDIDATE_PRODUCTION_GRAPH_ARTIFACT_REF_V2_SCHEMA,
  CANDIDATE_RUNTIME_APPLICATION_TREE_BINDING_V2_SCHEMA,
  CANDIDATE_RUNTIME_BUNDLE_CONTRACT_HASH_V2,
  CANDIDATE_RUNTIME_BUNDLE_V2_BLOCKER_CODES,
  CANDIDATE_RUNTIME_BUNDLE_V2_MAX_CANONICAL_BYTES,
  CANDIDATE_RUNTIME_BUNDLE_V2_SCHEMA,
  CANDIDATE_RUNTIME_BUNDLE_V2_VERSION,
  CANDIDATE_RUNTIME_DEPENDENCY_TREE_BINDING_V2_SCHEMA,
  CANDIDATE_RUNTIME_PACKAGE_JSON_REF_V2_SCHEMA,
  CANDIDATE_RUNTIME_PRODUCTION_GRAPH_BINDING_V2_SCHEMA,
  CANDIDATE_RUNTIME_SOURCE_BINDING_V2_SCHEMA,
  CANDIDATE_RUNTIME_SOURCE_CHECKPOINT_V2_SCHEMA,
  CANDIDATE_RUNTIME_TREE_ARTIFACT_REF_V2_SCHEMA,
  CandidateRuntimeBundleV2Schema,
  hashCandidateNpmMaterializationReceiptV2,
  hashCandidateNpmMaterializationReceiptAbiPolicyV2,
  hashCandidateNpmProcessOutcomeV2,
  hashCandidateNpmProductionMaterializationConfigV2,
  hashCandidateNpmProductionMaterializationRecipeV2,
  hashCandidateRuntimeApplicationTreeBindingV2,
  hashCandidateRuntimeBundleClosureV2,
  hashCandidateRuntimeBundleV2,
  hashCandidateRuntimeDependencyTreeBindingV2,
  hashCandidateRuntimeProductionGraphBindingV2,
  hashCandidateRuntimeSourceCheckpointV2,
  parseCandidateRuntimeBundleV2,
  type CandidateNpmMaterializationReceiptHashPayloadV2,
  type CandidateNpmProcessOutcomeHashPayloadV2,
  type CandidateRuntimeApplicationTreeBindingHashPayloadV2,
  type CandidateRuntimeBundleHashPayloadV2,
  type CandidateRuntimeBundleV2,
  type CandidateRuntimeDependencyTreeBindingHashPayloadV2,
  type CandidateRuntimePackageJsonRefV2,
  type CandidateRuntimeProductionGraphBindingHashPayloadV2,
  type CandidateRuntimeSourceCheckpointHashPayloadV2,
  type CandidateRuntimeBundleProducerV2,
} from "../../src/execution/schemas/candidate-runtime-bundle-v2.js";
import {
  CANONICAL_RUNTIME_TREE_V2_SCHEMA,
  createCanonicalRuntimeTreeV2,
  type CanonicalRuntimeTreeV2,
} from "../../src/execution/schemas/canonical-runtime-tree-v2.js";
import {
  EXACT_SOURCE_FILE_REF_V2_SCHEMA,
} from "../../src/execution/schemas/external-runtime-resolution-v2.js";

function sha(label: string): string {
  return createHash("sha256").update(label).digest("hex");
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function assertRecursivelyFrozen(value: unknown): void {
  const pending: unknown[] = [value];
  while (pending.length > 0) {
    const current = pending.pop();
    if (current === null || typeof current !== "object") continue;
    assert.equal(Object.isFrozen(current), true);
    pending.push(...Object.values(current));
  }
}

function producer() {
  return {
    pass: "candidate-build-authority-v2" as const,
    codeSha: "abcdef0",
    toolVersions: {
      candidateBuild: CANDIDATE_BUILD_RECEIPT_V2_VERSION,
      candidateSource: "1.0.0" as const,
      buildTopology: "3.2.0" as const,
      canonicalRuntimeTree: "2.0.0" as const,
    },
  };
}

function runtimeProducer(): CandidateRuntimeBundleProducerV2 {
  return {
    pass: "candidate-runtime-bundle-authority-v2",
    codeSha: producer().codeSha,
    toolVersions: {
      candidateRuntimeBundle: CANDIDATE_RUNTIME_BUNDLE_V2_VERSION,
      candidateBuild: CANDIDATE_BUILD_RECEIPT_V2_VERSION,
      candidateSource: "1.0.0",
      canonicalRuntimeTree: "2.0.0",
      productionPackageResolutionGraph: "2.0.0",
    },
  };
}

function createApplicationTree(): CanonicalRuntimeTreeV2 {
  return createCanonicalRuntimeTreeV2({
    schema: CANONICAL_RUNTIME_TREE_V2_SCHEMA,
    profile: "dist",
    rootMode: "0555",
    entries: [
      {
        path: "cli.js",
        type: "file",
        mode: "0444",
        executable: false,
        byteLength: 11,
        contentHash: sha("candidate-cli"),
      },
      {
        path: "cli.setfarm.test.js",
        type: "file",
        mode: "0444",
        executable: false,
        byteLength: 7,
        contentHash: sha("candidate-cli-test"),
      },
    ],
    fileCount: 2,
    directoryCount: 0,
    totalBytes: 18,
  });
}

function createDependencyTree(): CanonicalRuntimeTreeV2 {
  return createCanonicalRuntimeTreeV2({
    schema: CANONICAL_RUNTIME_TREE_V2_SCHEMA,
    profile: "dependencies",
    rootMode: "0555",
    entries: [
      { path: "pkg", type: "directory", mode: "0555" },
      {
        path: "pkg/index.js",
        type: "file",
        mode: "0444",
        executable: false,
        byteLength: 5,
        contentHash: sha("dependency-index"),
      },
    ],
    fileCount: 1,
    directoryCount: 1,
    totalBytes: 5,
  });
}

function treeArtifact(label: string): CandidateCanonicalRuntimeTreeArtifactRefV2 {
  return {
    schema: CANDIDATE_CANONICAL_RUNTIME_TREE_ARTIFACT_REF_V2_SCHEMA,
    artifactType: CANONICAL_RUNTIME_TREE_V2_SCHEMA,
    envelopeHash: sha(`${label}-envelope`),
    envelopeByteLength: 1_024,
    producer: producer(),
  };
}

function runtimeTreeArtifact(label: string) {
  return {
    schema: CANDIDATE_RUNTIME_TREE_ARTIFACT_REF_V2_SCHEMA,
    artifactType: CANONICAL_RUNTIME_TREE_V2_SCHEMA,
    envelopeHash: sha(`${label}-envelope`),
    envelopeByteLength: 1_024,
    producer: runtimeProducer(),
  } as const;
}

function compilerTarget() {
  return {
    executableRef: "TOOL_NODE_TYPESCRIPT_TSC_V2" as const,
    exactVersion: "5.9.3" as const,
    commandName: "tsc" as const,
    packagePath: "node_modules/typescript" as const,
    linkLocator: "node_modules/.bin/tsc" as const,
    targetLocator: "node_modules/typescript/bin/tsc" as const,
    linkTargetHash: sha("tsc-link-target"),
    targetContentHash: sha("tsc-target-content"),
    executionDisposition:
      "direct_target_via_authenticated_node_runtime" as const,
  };
}

function createBuildOperation() {
  const identity: CandidateBuildOperationHashPayloadV2 = {
    schema: CANDIDATE_BUILD_OPERATION_V2_SCHEMA,
    topologySchema: "setfarm.build-topology.v3",
    topologyVersion: "3.2.0",
    commandRef: "CMD_NODE_PRODUCT_BUILD_V3",
    executableRef: "TOOL_NODE_RUNTIME_V2",
    compilerExecutableRef: "TOOL_NODE_TYPESCRIPT_TSC_V2",
    compilerTarget: compilerTarget(),
    cwdRootRef: "PATH_ROOT_NODE_REPOSITORY_V2",
    directArgv: [
      "node",
      "node_modules/typescript/bin/tsc",
      "-p",
      "tsconfig.json",
    ],
    shell: "forbidden",
    processPolicy: { ...CANDIDATE_BUILD_PROCESS_POLICY_V2 },
    commandContractHash: sha("command-contract"),
    compilationContractHash: sha("compilation-contract"),
  };
  return { ...identity, operationHash: hashCandidateBuildOperationV2(identity) };
}

function createSourceCheckpoint() {
  const identity: CandidateBuildSourceCheckpointHashPayloadV2 = {
    schema: CANDIDATE_BUILD_SOURCE_CHECKPOINT_V2_SCHEMA,
    candidateSourceEnvelopeHash: sha("candidate-source-envelope"),
    candidateSourceReceiptHash: sha("candidate-source-receipt"),
    semanticRevisionHash: sha("candidate-source-semantic-revision"),
    sourceMaterializationReceiptHash: sha("source-materialization-receipt"),
    sourceDirectoryPhysicalIdentityHash: sha("source-directory-physical"),
    dependencyReceiptHash: sha("dependency-receipt"),
    dependencyIdentityHash: sha("dependency-identity"),
  };
  return {
    ...identity,
    checkpointHash: hashCandidateBuildSourceCheckpointV2(identity),
  };
}

function createProcessOutcome() {
  const identity: CandidateBuildProcessOutcomeHashPayloadV2 = {
    schema: CANDIDATE_BUILD_PROCESS_OUTCOME_V2_SCHEMA,
    status: "exited_zero",
    exitCode: 0,
    signal: null,
    stdoutHash: sha("build-stdout"),
    stdoutBytes: 0,
    stderrHash: sha("build-stderr"),
    stderrBytes: 0,
  };
  return { ...identity, outcomeHash: hashCandidateBuildProcessOutcomeV2(identity) };
}

function createBuildOutput(
  tree = createApplicationTree(),
): CandidateBuildOutputTreeBindingHashPayloadV2 & { bindingHash: string } {
  const files = [
    {
      schema: CANDIDATE_BUILD_OUTPUT_FILE_V2_SCHEMA,
      normalizedLocator: "dist/cli.js",
      mode: "0444",
      executable: false,
      contentHash: tree.entries[0]!.contentHash!,
      byteLength: tree.entries[0]!.byteLength!,
    },
    {
      schema: CANDIDATE_BUILD_OUTPUT_FILE_V2_SCHEMA,
      normalizedLocator: "dist/cli.setfarm.test.js",
      mode: "0444",
      executable: false,
      contentHash: tree.entries[1]!.contentHash!,
      byteLength: tree.entries[1]!.byteLength!,
    },
  ] as const;
  const identity: CandidateBuildOutputTreeBindingHashPayloadV2 = {
    schema: CANDIDATE_BUILD_OUTPUT_TREE_BINDING_V2_SCHEMA,
    profileId: "PROFILE_NODE_CLI_STATELESS_EXACT_V2",
    treeSchema: tree.schema,
    profile: "dist",
    logicalRoot: "candidate-build-output",
    rootMode: "0555",
    memberCount: 2,
    files,
    membershipHash: hashCandidateBuildOutputMembershipV2(files),
    treeArtifact: treeArtifact("application"),
    treeHash: tree.treeHash,
    treePayloadHash: tree.payloadHash,
    fileCount: 2,
    directoryCount: 0,
    totalBytes: tree.totalBytes,
  };
  return { ...identity, bindingHash: hashCandidateBuildOutputTreeBindingV2(identity) };
}

function createBuildReceipt(): CandidateBuildReceiptV2 {
  const operation = createBuildOperation();
  const source = createSourceCheckpoint();
  const identity: CandidateBuildReceiptHashPayloadV2 = {
    schema: CANDIDATE_BUILD_RECEIPT_V2_SCHEMA,
    receiptVersion: CANDIDATE_BUILD_RECEIPT_V2_VERSION,
    contractHash: CANDIDATE_BUILD_RECEIPT_CONTRACT_HASH_V2,
    stage: "private_candidate_build_verified",
    readiness: {
      status: "verified_private_shadow",
      productionUse: "forbidden",
      blockerCodes: [...CANDIDATE_BUILD_RECEIPT_V2_BLOCKER_CODES],
    },
    producer: producer(),
    authority: {
      productRef: "PROD_FIXTURE",
      packet: {
        schema: "setfarm.product-build-packet.v4",
        version: "4.0.0",
        envelopeHash: sha("packet-envelope"),
        packetHash: sha("packet"),
      },
      implementationClosure: {
        artifactType: "setfarm.implementation-closure.v2",
        schema: "setfarm.implementation-closure.v2",
        version: "2.0.0",
        envelopeHash: sha("implementation-closure-envelope"),
        closureHash: sha("implementation-closure"),
      },
      candidateSource: {
        schema: "setfarm.candidate-source-receipt.v1",
        version: "1.0.0",
        envelopeHash: source.candidateSourceEnvelopeHash,
        receiptHash: source.candidateSourceReceiptHash,
        semanticRevisionHash: source.semanticRevisionHash,
      },
      buildTopology: {
        schema: "setfarm.build-topology.v3",
        version: "3.2.0",
        manifestHash: sha("build-topology-manifest"),
        logicalBuildHash: sha("logical-build"),
        commandContractHash: operation.commandContractHash,
        compilationContractHash: operation.compilationContractHash,
      },
    },
    operation,
    executionAuthority: {
      admissionScope: "test_fixture",
      pathDisclosure: "forbidden",
      hostToolchain: {
        receiptHash: sha("host-toolchain-receipt"),
        nodeIdentityHash: sha("node-identity"),
      },
      environment: {
        receiptHash: sha("environment-receipt"),
        environmentContractHash: sha("environment-contract"),
        effectiveConfigHash: sha("effective-config"),
        environmentHash: sha("environment"),
      },
      dependency: {
        receiptHash: source.dependencyReceiptHash,
        dependencyIdentityHash: source.dependencyIdentityHash,
        installedBinsMembershipHash: sha("installed-bins"),
        compilerTarget: clone(operation.compilerTarget),
      },
      processBinding: {
        probeRef: "HOST_NODE_PRODUCT_BUILD_V2",
        projectScopeHash: sha("build-project-scope"),
        compilerTargetIdentityHash: sha("compiler-target-identity"),
        directArgvHash: hashCanonicalJson({
          schema: "setfarm.candidate-build-direct-argv-hash.v2",
          directArgv: operation.directArgv,
        }),
      },
    },
    sourceBefore: source,
    sourceAfter: clone(source),
    processOutcome: createProcessOutcome(),
    outputTree: createBuildOutput(),
  };
  return { ...identity, receiptHash: hashCandidateBuildReceiptV2(identity) };
}

function createApplicationBinding(
  build: CandidateBuildReceiptV2,
): CandidateRuntimeApplicationTreeBindingHashPayloadV2 & { bindingHash: string } {
  const output = build.outputTree;
  const identity: CandidateRuntimeApplicationTreeBindingHashPayloadV2 = {
    schema: CANDIDATE_RUNTIME_APPLICATION_TREE_BINDING_V2_SCHEMA,
    treeSchema: output.treeSchema,
    profile: "dist",
    logicalRoot: "candidate-bundle/application",
    treeArtifact: clone(output.treeArtifact),
    treeHash: output.treeHash,
    treePayloadHash: output.treePayloadHash,
    fileCount: output.fileCount,
    directoryCount: output.directoryCount,
    totalBytes: output.totalBytes,
  };
  return {
    ...identity,
    bindingHash: hashCandidateRuntimeApplicationTreeBindingV2(identity),
  };
}

function createDependencyBinding() {
  const tree = createDependencyTree();
  const identity: CandidateRuntimeDependencyTreeBindingHashPayloadV2 = {
    schema: CANDIDATE_RUNTIME_DEPENDENCY_TREE_BINDING_V2_SCHEMA,
    treeSchema: tree.schema,
    profile: "dependencies",
    logicalRoot: "candidate-bundle/node_modules",
    treeArtifact: runtimeTreeArtifact("dependencies"),
    treeHash: tree.treeHash,
    treePayloadHash: tree.payloadHash,
    fileCount: tree.fileCount,
    directoryCount: tree.directoryCount,
    totalBytes: tree.totalBytes,
  };
  return {
    ...identity,
    bindingHash: hashCandidateRuntimeDependencyTreeBindingV2(identity),
  };
}

function createPackageJson(): CandidateRuntimePackageJsonRefV2 {
  return {
    schema: CANDIDATE_RUNTIME_PACKAGE_JSON_REF_V2_SCHEMA,
    logicalLocator: "candidate-bundle/package.json",
    mediaType: "application/json",
    contentHash: sha("candidate-package-json"),
    byteLength: 386,
    mode: "0444",
  };
}

function createRuntimeSourceCheckpoint(
  build: CandidateBuildReceiptV2,
): CandidateRuntimeSourceCheckpointHashPayloadV2 & {
  checkpointHash: string;
} {
  const identity: CandidateRuntimeSourceCheckpointHashPayloadV2 = {
    schema: CANDIDATE_RUNTIME_SOURCE_CHECKPOINT_V2_SCHEMA,
    candidateSourceReceiptHash: build.sourceAfter.candidateSourceReceiptHash,
    semanticRevisionHash: build.sourceAfter.semanticRevisionHash,
    packageJson: {
      locator: "package.json",
      mediaType: "application/json",
      contentHash: sha("candidate-package-json"),
      byteLength: 386,
    },
    lockfile: {
      schema: EXACT_SOURCE_FILE_REF_V2_SCHEMA,
      locator: "package-lock.json",
      mediaType: "application/json",
      hash: sha("candidate-lockfile"),
      byteLength: 4_096,
    },
  };
  return {
    ...identity,
    checkpointHash: hashCandidateRuntimeSourceCheckpointV2(identity),
  };
}

function createProductionGraph(
  dependencyTree: ReturnType<typeof createDependencyBinding>,
) {
  const identity: CandidateRuntimeProductionGraphBindingHashPayloadV2 = {
    schema: CANDIDATE_RUNTIME_PRODUCTION_GRAPH_BINDING_V2_SCHEMA,
    graphSchema: "setfarm.production-package-resolution-graph.v2",
    graphArtifact: {
      schema: CANDIDATE_PRODUCTION_GRAPH_ARTIFACT_REF_V2_SCHEMA,
      artifactType: "setfarm.production-package-resolution-graph.v2",
      envelopeHash: sha("candidate-production-graph-envelope"),
      envelopeByteLength: 2_048,
      producer: runtimeProducer(),
    },
    resolutionGraphHash: sha("candidate-production-graph"),
    materializedDependencyTreeHash: dependencyTree.treeHash,
    packageCount: 1,
  };
  return {
    ...identity,
    bindingHash: hashCandidateRuntimeProductionGraphBindingV2(identity),
  };
}

function createNpmProcessOutcome() {
  const identity: CandidateNpmProcessOutcomeHashPayloadV2 = {
    schema: CANDIDATE_NPM_PROCESS_OUTCOME_V2_SCHEMA,
    status: "exited_zero",
    exitCode: 0,
    signal: null,
    stdoutHash: sha("candidate-npm-stdout"),
    stdoutBytes: 12,
    stderrHash: sha("candidate-npm-stderr"),
    stderrBytes: 0,
    processPolicy: clone(CANDIDATE_NPM_PROCESS_POLICY_V2),
  };
  return {
    ...identity,
    outcomeHash: hashCandidateNpmProcessOutcomeV2(identity),
  };
}

function createNpmReceipt(
  dependencyTree: ReturnType<typeof createDependencyBinding>,
  productionGraph: ReturnType<typeof createProductionGraph>,
  build: CandidateBuildReceiptV2,
) {
  const installRecipe = clone(CANDIDATE_NPM_PRODUCTION_MATERIALIZATION_RECIPE_V2);
  const sourceCheckpoint = createRuntimeSourceCheckpoint(build);
  const identity: CandidateNpmMaterializationReceiptHashPayloadV2 = {
    schema: CANDIDATE_NPM_MATERIALIZATION_RECEIPT_V2_SCHEMA,
    receiptVersion: CANDIDATE_RUNTIME_BUNDLE_V2_VERSION,
    contractHash: CANDIDATE_RUNTIME_BUNDLE_CONTRACT_HASH_V2,
    stage: "private_candidate_production_dependencies_verified",
    producer: runtimeProducer(),
    outputRoot: "candidate-bundle/node_modules",
    installRecipe,
    recipeHash: installRecipe.recipeHash,
    npmIdentity: {
      packageName: "npm",
      version: "10.9.8",
      executableRef: "TOOL_NODE_NPM_CLI_V2",
      closureHash: sha("candidate-npm-closure"),
      cliContentHash: sha("candidate-npm-executable"),
      packageTreeHash: sha("candidate-npm-package-tree"),
    },
    hostToolchain: {
      receiptHash: sha("host-toolchain-receipt"),
      nodeIdentityHash: sha("host-node-identity"),
      npmClosureHash: sha("candidate-npm-closure"),
    },
    environment: {
      receiptHash: sha("candidate-environment-receipt"),
      environmentContractHash: sha("candidate-environment-contract"),
      effectiveConfigHash: sha("candidate-effective-config"),
      environmentHash: sha("candidate-environment"),
    },
    processBinding: {
      probeRef: "HOST_NPM_CANDIDATE_PRODUCTION_INSTALL_V2",
      projectScopeHash: sha("candidate-bundle-project-scope"),
      directArgvHash: bundleModule.CANDIDATE_NPM_DIRECT_ARGV_HASH_V2,
    },
    sourceBefore: sourceCheckpoint,
    sourceAfter: clone(sourceCheckpoint),
    productionGraph,
    dependencyTreeBindingHash: dependencyTree.bindingHash,
    dependencyTreeHash: dependencyTree.treeHash,
    dependencyTreePayloadHash: dependencyTree.treePayloadHash,
    packageCount: 1,
    lifecycleScripts: "forbidden",
    processOutcome: createNpmProcessOutcome(),
  };
  return { ...identity, receiptHash: hashCandidateNpmMaterializationReceiptV2(identity) };
}

function createRuntimeBundle(): CandidateRuntimeBundleV2 {
  const buildReceipt = createBuildReceipt();
  const dependencyTree = createDependencyBinding();
  const productionGraph = createProductionGraph(dependencyTree);
  const identityWithoutClosure = {
    schema: CANDIDATE_RUNTIME_BUNDLE_V2_SCHEMA,
    receiptVersion: CANDIDATE_RUNTIME_BUNDLE_V2_VERSION,
    contractHash: CANDIDATE_RUNTIME_BUNDLE_CONTRACT_HASH_V2,
    stage: "private_candidate_runtime_bundle_verified" as const,
    readiness: {
      status: "verified_private_shadow" as const,
      productionUse: "forbidden" as const,
      blockerCodes: clone(CANDIDATE_RUNTIME_BUNDLE_V2_BLOCKER_CODES),
    },
    producer: runtimeProducer(),
    packetEnvelopeHash: buildReceipt.authority.packet.envelopeHash,
    implementationClosureHash:
      buildReceipt.authority.implementationClosure.closureHash,
    buildTopologyHash: buildReceipt.authority.buildTopology.manifestHash,
    sourceAuthority: {
      schema: CANDIDATE_RUNTIME_SOURCE_BINDING_V2_SCHEMA,
      candidateSourceEnvelopeHash:
        buildReceipt.sourceAfter.candidateSourceEnvelopeHash,
      candidateSourceReceiptHash:
        buildReceipt.sourceAfter.candidateSourceReceiptHash,
      semanticRevisionHash: buildReceipt.sourceAfter.semanticRevisionHash,
    },
    buildReceiptHash: buildReceipt.receiptHash,
    buildReceipt,
    logicalRoot: "candidate-bundle" as const,
    rootMode: "0555" as const,
    allowedRootEntries: ["application", "node_modules", "package.json"] as const,
    applicationTree: createApplicationBinding(buildReceipt),
    dependencyTree,
    productionGraph,
    packageJson: createPackageJson(),
    npmMaterializationReceipt: createNpmReceipt(
      dependencyTree,
      productionGraph,
      buildReceipt,
    ),
  };
  const bundleClosureHash = hashCandidateRuntimeBundleClosureV2(identityWithoutClosure);
  const identity: CandidateRuntimeBundleHashPayloadV2 = {
    ...identityWithoutClosure,
    bundleClosureHash,
  };
  return { ...identity, bundleHash: hashCandidateRuntimeBundleV2(identity) };
}

function rehashRuntimeBundle(candidate: CandidateRuntimeBundleV2): void {
  candidate.applicationTree.bindingHash =
    hashCandidateRuntimeApplicationTreeBindingV2(candidate.applicationTree);
  candidate.dependencyTree.bindingHash =
    hashCandidateRuntimeDependencyTreeBindingV2(candidate.dependencyTree);
  candidate.productionGraph.bindingHash =
    hashCandidateRuntimeProductionGraphBindingV2(candidate.productionGraph);
  candidate.npmMaterializationReceipt.productionGraph = clone(candidate.productionGraph);
  candidate.npmMaterializationReceipt.sourceBefore.checkpointHash =
    hashCandidateRuntimeSourceCheckpointV2(
      candidate.npmMaterializationReceipt.sourceBefore,
    );
  candidate.npmMaterializationReceipt.sourceAfter.checkpointHash =
    hashCandidateRuntimeSourceCheckpointV2(
      candidate.npmMaterializationReceipt.sourceAfter,
    );
  candidate.npmMaterializationReceipt.processOutcome.outcomeHash =
    hashCandidateNpmProcessOutcomeV2(
      candidate.npmMaterializationReceipt.processOutcome,
    );
  candidate.npmMaterializationReceipt.receiptHash =
    hashCandidateNpmMaterializationReceiptV2(candidate.npmMaterializationReceipt);
  candidate.bundleClosureHash = hashCandidateRuntimeBundleClosureV2(candidate);
  candidate.bundleHash = hashCandidateRuntimeBundleV2(candidate);
}

test("superseding candidate build wire is content-first, exact, deterministic and frozen", () => {
  const build = createBuildReceipt();
  const bundle = createRuntimeBundle();
  assert.equal(CandidateBuildReceiptV2Schema.safeParse(build).success, true);
  assert.equal(CandidateRuntimeBundleV2Schema.safeParse(bundle).success, true);
  assert.equal(build.receiptVersion, "2.1.0");
  assert.equal(build.stage, "private_candidate_build_verified");
  assert.equal(build.readiness.productionUse, "forbidden");
  assert.equal(build.operation.commandRef, "CMD_NODE_PRODUCT_BUILD_V3");
  assert.deepEqual(build.operation.directArgv, [
    "node",
    "node_modules/typescript/bin/tsc",
    "-p",
    "tsconfig.json",
  ]);
  assert.deepEqual(build.operation.processPolicy, CANDIDATE_BUILD_PROCESS_POLICY_V2);
  assert.deepEqual(build.outputTree.files.map((file) => file.normalizedLocator), [
    "dist/cli.js",
    "dist/cli.setfarm.test.js",
  ]);
  assert.equal(build.sourceBefore.semanticRevisionHash,
    build.sourceAfter.semanticRevisionHash);
  assert.equal("sha" in build.sourceBefore, false);
  assert.equal("treeHash" in build.sourceBefore, false);
  assert.equal("cwd" in build.operation, false);
  assert.equal("environmentRefs" in build.operation, false);
  assert.equal("worktree" in build, false);
  assert.equal("createdAt" in build, false);
  assert.equal(bundle.receiptVersion, CANDIDATE_RUNTIME_BUNDLE_V2_VERSION);
  assert.equal(bundle.stage, "private_candidate_runtime_bundle_verified");
  assert.equal(bundle.readiness.status, "verified_private_shadow");
  assert.equal(bundle.readiness.productionUse, "forbidden");
  assert.deepEqual(bundle.readiness.blockerCodes,
    CANDIDATE_RUNTIME_BUNDLE_V2_BLOCKER_CODES);
  assert.equal(bundle.dependencyTree.treeArtifact.producer.pass,
    "candidate-runtime-bundle-authority-v2");
  assert.equal(bundle.applicationTree.treeArtifact.producer.pass,
    "candidate-build-authority-v2");
  assert.equal(bundle.productionGraph.graphArtifact.producer.pass,
    "candidate-runtime-bundle-authority-v2");

  const parsedBuild = parseCandidateBuildReceiptV2(clone(build));
  const parsedBundle = parseCandidateRuntimeBundleV2(clone(bundle));
  assert.deepEqual(parsedBuild, build);
  assert.deepEqual(parsedBundle, bundle);
  assertRecursivelyFrozen(parsedBuild);
  assertRecursivelyFrozen(parsedBundle);
  assertRecursivelyFrozen(CANDIDATE_NPM_PRODUCTION_MATERIALIZATION_CONFIG_V2);
  assertRecursivelyFrozen(CANDIDATE_NPM_MATERIALIZATION_RECEIPT_ABI_POLICY_V2);
  assert.equal(
    CANDIDATE_NPM_PRODUCTION_MATERIALIZATION_CONFIG_V2.configHash,
    hashCandidateNpmProductionMaterializationConfigV2(
      CANDIDATE_NPM_PRODUCTION_MATERIALIZATION_CONFIG_V2,
    ),
  );
  assert.equal(
    CANDIDATE_NPM_MATERIALIZATION_RECEIPT_ABI_POLICY_V2.policyHash,
    hashCandidateNpmMaterializationReceiptAbiPolicyV2(
      CANDIDATE_NPM_MATERIALIZATION_RECEIPT_ABI_POLICY_V2,
    ),
  );
});

test("candidate build rejects source, topology, process, output and producer forgeries", () => {
  const sourceDrift = clone(createBuildReceipt());
  sourceDrift.sourceAfter.semanticRevisionHash = sha("drifted-source");
  sourceDrift.sourceAfter.checkpointHash =
    hashCandidateBuildSourceCheckpointV2(sourceDrift.sourceAfter);
  sourceDrift.receiptHash = hashCandidateBuildReceiptV2(sourceDrift);
  assert.equal(CandidateBuildReceiptV2Schema.safeParse(sourceDrift).success, false);

  const failedBuild = clone(createBuildReceipt()) as unknown as Record<string, unknown>;
  failedBuild.processOutcome = {
    ...(failedBuild.processOutcome as Record<string, unknown>),
    status: "nonzero",
    exitCode: 1,
  };
  failedBuild.receiptHash = hashCandidateBuildReceiptV2(failedBuild as never);
  assert.equal(CandidateBuildReceiptV2Schema.safeParse(failedBuild).success, false);

  const staleOperation = clone(createBuildReceipt()) as unknown as {
    operation: { processPolicy: { timeoutMs: number }; operationHash: string };
    receiptHash: string;
  };
  staleOperation.operation.processPolicy.timeoutMs += 1;
  staleOperation.operation.operationHash =
    hashCandidateBuildOperationV2(staleOperation.operation as never);
  staleOperation.receiptHash = hashCandidateBuildReceiptV2(staleOperation as never);
  assert.equal(CandidateBuildReceiptV2Schema.safeParse(staleOperation).success, false);

  const staleOutput = clone(createBuildReceipt());
  staleOutput.outputTree.totalBytes += 1;
  staleOutput.outputTree.bindingHash =
    hashCandidateBuildOutputTreeBindingV2(staleOutput.outputTree);
  staleOutput.receiptHash = hashCandidateBuildReceiptV2(staleOutput);
  assert.equal(CandidateBuildReceiptV2Schema.safeParse(staleOutput).success, false);

  const forgedProducer = clone(createBuildReceipt());
  forgedProducer.outputTree.treeArtifact.producer.codeSha = "1234567";
  forgedProducer.outputTree.bindingHash =
    hashCandidateBuildOutputTreeBindingV2(forgedProducer.outputTree);
  forgedProducer.receiptHash = hashCandidateBuildReceiptV2(forgedProducer);
  assert.equal(CandidateBuildReceiptV2Schema.safeParse(forgedProducer).success, false);

  assert.equal(CandidateBuildReceiptV2Schema.safeParse({
    ...createBuildReceipt(),
    timestamp: "2026-07-21T00:00:00.000Z",
  }).success, false);
});

test("runtime bundle joins the superseding source/build authority and rejects cross-joins", () => {
  const sourceForgery = clone(createRuntimeBundle());
  sourceForgery.sourceAuthority.semanticRevisionHash = sha("different-source");
  sourceForgery.bundleHash = hashCandidateRuntimeBundleV2(sourceForgery);
  assert.equal(CandidateRuntimeBundleV2Schema.safeParse(sourceForgery).success, false);

  const packetForgery = clone(createRuntimeBundle());
  packetForgery.packetEnvelopeHash = sha("different-packet");
  packetForgery.bundleHash = hashCandidateRuntimeBundleV2(packetForgery);
  assert.equal(CandidateRuntimeBundleV2Schema.safeParse(packetForgery).success, false);

  const applicationForgery = clone(createRuntimeBundle());
  applicationForgery.applicationTree.treeHash = sha("different-application");
  rehashRuntimeBundle(applicationForgery);
  assert.equal(CandidateRuntimeBundleV2Schema.safeParse(applicationForgery).success, false);

  const npmForgery = clone(createRuntimeBundle());
  npmForgery.npmMaterializationReceipt.dependencyTreePayloadHash = sha("different-deps");
  rehashRuntimeBundle(npmForgery);
  assert.equal(CandidateRuntimeBundleV2Schema.safeParse(npmForgery).success, false);

  const buildProducerForgery = clone(createRuntimeBundle()) as unknown as {
    dependencyTree: { treeArtifact: unknown; bindingHash: string };
    bundleHash: string;
  };
  buildProducerForgery.dependencyTree.treeArtifact = treeArtifact("forged-dependencies");
  buildProducerForgery.dependencyTree.bindingHash =
    hashCandidateRuntimeDependencyTreeBindingV2(
      buildProducerForgery.dependencyTree as never,
    );
  buildProducerForgery.bundleHash = hashCandidateRuntimeBundleV2(
    buildProducerForgery as never,
  );
  assert.equal(CandidateRuntimeBundleV2Schema.safeParse(buildProducerForgery).success,
    false);

  const processForgery = clone(createRuntimeBundle());
  processForgery.npmMaterializationReceipt.processBinding.directArgvHash =
    sha("caller-selected-npm-argv");
  rehashRuntimeBundle(processForgery);
  assert.equal(CandidateRuntimeBundleV2Schema.safeParse(processForgery).success, false);

  const sourceFenceForgery = clone(createRuntimeBundle());
  sourceFenceForgery.npmMaterializationReceipt.sourceAfter.lockfile.hash =
    sha("changed-lockfile");
  rehashRuntimeBundle(sourceFenceForgery);
  assert.equal(CandidateRuntimeBundleV2Schema.safeParse(sourceFenceForgery).success,
    false);

  const staleRecipe = clone(createRuntimeBundle());
  staleRecipe.npmMaterializationReceipt.installRecipe.configHash = sha("different-config");
  staleRecipe.npmMaterializationReceipt.installRecipe.recipeHash =
    hashCandidateNpmProductionMaterializationRecipeV2(
      staleRecipe.npmMaterializationReceipt.installRecipe,
    );
  staleRecipe.npmMaterializationReceipt.recipeHash =
    staleRecipe.npmMaterializationReceipt.installRecipe.recipeHash;
  staleRecipe.npmMaterializationReceipt.receiptHash =
    hashCandidateNpmMaterializationReceiptV2(
      staleRecipe.npmMaterializationReceipt,
    );
  staleRecipe.bundleHash = hashCandidateRuntimeBundleV2(staleRecipe);
  assert.equal(CandidateRuntimeBundleV2Schema.safeParse(staleRecipe).success, false);
});

test("bounded candidate parsers reject oversized, cyclic, accessor and proxy inputs", () => {
  const build = createBuildReceipt();
  const bundle = createRuntimeBundle();
  assert.equal(canonicalJsonBytes(build).byteLength
    < CANDIDATE_BUILD_RECEIPT_V2_MAX_CANONICAL_BYTES, true);
  assert.equal(canonicalJsonBytes(bundle).byteLength
    < CANDIDATE_RUNTIME_BUNDLE_V2_MAX_CANONICAL_BYTES, true);
  assert.throws(() => parseCandidateBuildReceiptV2({
    ...build,
    padding: "x".repeat(CANDIDATE_BUILD_RECEIPT_V2_MAX_CANONICAL_BYTES),
  }));

  const cyclic: Record<string, unknown> = { ...build };
  cyclic.self = cyclic;
  assert.throws(() => parseCandidateBuildReceiptV2(cyclic));

  let accessorInvoked = false;
  const accessor = { ...bundle };
  Object.defineProperty(accessor, "hidden", {
    enumerable: true,
    get() {
      accessorInvoked = true;
      return "forbidden";
    },
  });
  assert.throws(() => parseCandidateRuntimeBundleV2(accessor));
  assert.equal(accessorInvoked, false);

  let proxyInvoked = false;
  const hostile = new Proxy({}, {
    get() {
      proxyInvoked = true;
      throw new Error("proxy trap must not run");
    },
  });
  assert.throws(() => parseCandidateBuildReceiptV2(hostile));
  assert.equal(proxyInvoked, false);
});

test("candidate build superseding-wire hash domains stay deterministic and separate", () => {
  const build = createBuildReceipt();
  const bundle = createRuntimeBundle();
  const hashes = {
    contractHash: CANDIDATE_BUILD_RECEIPT_CONTRACT_HASH_V2,
    runtimeContractHash: CANDIDATE_RUNTIME_BUNDLE_CONTRACT_HASH_V2,
    npmConfigHash: CANDIDATE_NPM_PRODUCTION_MATERIALIZATION_CONFIG_V2.configHash,
    npmAbiPolicyHash:
      CANDIDATE_NPM_MATERIALIZATION_RECEIPT_ABI_POLICY_V2.policyHash,
    npmRecipeHash: CANDIDATE_NPM_PRODUCTION_MATERIALIZATION_RECIPE_V2.recipeHash,
    operationHash: build.operation.operationHash,
    sourceCheckpointHash: build.sourceBefore.checkpointHash,
    processOutcomeHash: build.processOutcome.outcomeHash,
    outputMembershipHash: build.outputTree.membershipHash,
    outputBindingHash: build.outputTree.bindingHash,
    buildReceiptHash: build.receiptHash,
    runtimeSourceCheckpointHash:
      bundle.npmMaterializationReceipt.sourceBefore.checkpointHash,
    npmProcessOutcomeHash:
      bundle.npmMaterializationReceipt.processOutcome.outcomeHash,
    dependencyBindingHash: bundle.dependencyTree.bindingHash,
    productionGraphBindingHash: bundle.productionGraph.bindingHash,
    bundleClosureHash: bundle.bundleClosureHash,
    bundleHash: bundle.bundleHash,
  };
  assert.deepEqual(hashes, {
    contractHash: "692d50995d31be1902960fa77161544d61da9c0f813be12b2e2379c7c2ab273d",
    runtimeContractHash: "f89ddb6362bba6284f5e203ee0c2b8a139fee721cd7540195a87c7f4bb3af896",
    npmConfigHash: "548a8894a209c13f0edda9684c8cc91b12e1aa11b4d73c860df59004fffa3c9d",
    npmAbiPolicyHash: "522212a9e0dcc63640991b498ec57bc78bdfaeb032943238bc13135fa0321073",
    npmRecipeHash: "307ff51a4d9abaae5a714ec426cfb527497abfa589e5c8f3a81ae8ff2a6bf243",
    operationHash: "d313ee9852a169e8d677ee7c3289822c45723ed85d7cdba2ed3be39c0e124c05",
    sourceCheckpointHash: "494c933edb52015d324aba924152aad6be096e4c8a27c1ede416f8d83995c703",
    processOutcomeHash: "807438076500934b4c29071070981064428d7d238826cadcd6ae5009437ff71f",
    outputMembershipHash: "57b1e3351dd9efdb1c2b057bcebb2e1f8d27a8ce94980010d6ec8ab88e296c86",
    outputBindingHash: "8c28e7c8ba629e8a37b58480daea553f25efff18ca9191863049e7a2d242b7b0",
    buildReceiptHash: "881efc30b79bf0c8b6234fecae3484d8712718b48ea39a75923070fa483a29ea",
    runtimeSourceCheckpointHash: "9dfc11ab296dc21246e04d559220ec44277a0eb764fafdad6e272f80dde46bea",
    npmProcessOutcomeHash: "0578d55a2d9ca75d74ee041cfb5f79448690e7dfa794cfa95994bb8ce6563499",
    dependencyBindingHash: "2bfc3cafa87d7d17905fcb4e373d013193bfc441362310e83ae14deb9623df69",
    productionGraphBindingHash: "374ff896af895cde446f12b4680ff82220635c0b23545d5b23f933ec76456715",
    bundleClosureHash: "dd4cac16ece4ee37c6a248c4ffa305691585ade8b92f3b8e4b9bc2487a81a6c4",
    bundleHash: "e0f83abb5390ea4f21cb417a465764b4fec1c1a1a8208ef3986e03ea0362f0fe",
  });
  assert.equal(new Set(Object.values(hashes)).size, Object.keys(hashes).length);
});

test("candidate DTO modules expose contracts but no operational authority", () => {
  const exportedNames = [
    ...Object.keys(buildModule),
    ...Object.keys(bundleModule),
  ];
  assert.equal(exportedNames.some((name) =>
    /^(?:verify|issue|materialize|activate|run|launch|derive|create)/i.test(name)), false);
  assert.equal(exportedNames.some((name) =>
    /(?:Brand|Verified|Activated|Default|Retry|Classifier)/.test(name)), false);
});
