import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import { canonicalJsonBytes } from "../../src/product-compiler/canonical-json.js";
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
  CANDIDATE_NPM_PRODUCTION_MATERIALIZATION_CONFIG_V2,
  CANDIDATE_NPM_PRODUCTION_MATERIALIZATION_RECIPE_V2,
  CANDIDATE_RUNTIME_APPLICATION_TREE_BINDING_V2_SCHEMA,
  CANDIDATE_RUNTIME_BUNDLE_V2_MAX_CANONICAL_BYTES,
  CANDIDATE_RUNTIME_BUNDLE_V2_SCHEMA,
  CANDIDATE_RUNTIME_DEPENDENCY_TREE_BINDING_V2_SCHEMA,
  CANDIDATE_RUNTIME_PACKAGE_JSON_REF_V2_SCHEMA,
  CANDIDATE_RUNTIME_SOURCE_BINDING_V2_SCHEMA,
  CandidateRuntimeBundleV2Schema,
  hashCandidateNpmMaterializationReceiptV2,
  hashCandidateNpmMaterializationReceiptAbiPolicyV2,
  hashCandidateNpmProductionMaterializationConfigV2,
  hashCandidateNpmProductionMaterializationRecipeV2,
  hashCandidateRuntimeApplicationTreeBindingV2,
  hashCandidateRuntimeBundleClosureV2,
  hashCandidateRuntimeBundleV2,
  hashCandidateRuntimeDependencyTreeBindingV2,
  parseCandidateRuntimeBundleV2,
  type CandidateNpmMaterializationReceiptHashPayloadV2,
  type CandidateRuntimeApplicationTreeBindingHashPayloadV2,
  type CandidateRuntimeBundleHashPayloadV2,
  type CandidateRuntimeBundleV2,
  type CandidateRuntimeDependencyTreeBindingHashPayloadV2,
  type CandidateRuntimePackageJsonRefV2,
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
      projectScopeHash: sha("build-project-scope"),
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
    treeArtifact: treeArtifact("dependencies"),
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

function createNpmReceipt(
  dependencyTree: ReturnType<typeof createDependencyBinding>,
) {
  const installRecipe = clone(CANDIDATE_NPM_PRODUCTION_MATERIALIZATION_RECIPE_V2);
  const identity: CandidateNpmMaterializationReceiptHashPayloadV2 = {
    schema: CANDIDATE_NPM_MATERIALIZATION_RECEIPT_V2_SCHEMA,
    outputRoot: "candidate-bundle/node_modules",
    lockfile: {
      schema: EXACT_SOURCE_FILE_REF_V2_SCHEMA,
      locator: "package-lock.json",
      mediaType: "application/json",
      hash: sha("candidate-lockfile"),
      byteLength: 4_096,
    },
    installRecipe,
    recipeHash: installRecipe.recipeHash,
    npmIdentity: {
      packageName: "npm",
      version: "10.9.8",
      executableRef: "HOST_NPM_EXECUTABLE_V2",
      executableHash: sha("candidate-npm-executable"),
      packageTreeHash: sha("candidate-npm-package-tree"),
    },
    productionPackageResolutionGraphHash: sha("candidate-production-graph"),
    dependencyTreeBindingHash: dependencyTree.bindingHash,
    dependencyTreeHash: dependencyTree.treeHash,
    dependencyTreePayloadHash: dependencyTree.treePayloadHash,
    packageCount: 1,
    lifecycleScripts: "forbidden",
    exitCode: 0,
  };
  return { ...identity, receiptHash: hashCandidateNpmMaterializationReceiptV2(identity) };
}

function createRuntimeBundle(): CandidateRuntimeBundleV2 {
  const buildReceipt = createBuildReceipt();
  const dependencyTree = createDependencyBinding();
  const identityWithoutClosure = {
    schema: CANDIDATE_RUNTIME_BUNDLE_V2_SCHEMA,
    version: "2.0.0" as const,
    authorityState: "candidate_unverified" as const,
    productionUse: "forbidden" as const,
    packetEnvelopeHash: buildReceipt.authority.packet.envelopeHash,
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
    packageJson: createPackageJson(),
    npmMaterializationReceipt: createNpmReceipt(dependencyTree),
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
    operationHash: build.operation.operationHash,
    sourceCheckpointHash: build.sourceBefore.checkpointHash,
    processOutcomeHash: build.processOutcome.outcomeHash,
    outputMembershipHash: build.outputTree.membershipHash,
    outputBindingHash: build.outputTree.bindingHash,
    buildReceiptHash: build.receiptHash,
    bundleHash: bundle.bundleHash,
  };
  assert.deepEqual(hashes, {
    contractHash: "bd7e6c6ab0ef8e53f7d7f5d0c9461ab3f9fa5ac488bb48a707e1d5b800a952dc",
    operationHash: "d313ee9852a169e8d677ee7c3289822c45723ed85d7cdba2ed3be39c0e124c05",
    sourceCheckpointHash: "494c933edb52015d324aba924152aad6be096e4c8a27c1ede416f8d83995c703",
    processOutcomeHash: "807438076500934b4c29071070981064428d7d238826cadcd6ae5009437ff71f",
    outputMembershipHash: "57b1e3351dd9efdb1c2b057bcebb2e1f8d27a8ce94980010d6ec8ab88e296c86",
    outputBindingHash: "8c28e7c8ba629e8a37b58480daea553f25efff18ca9191863049e7a2d242b7b0",
    buildReceiptHash: "395d7af831d19ce6b238bb270e40b6eb0c289b3d29627bbe3aa23399ad7f7f29",
    bundleHash: "4480dd09e4a5d478ff5d78f2b39ccd61a2fbe960d04ba4a39edc97d118802981",
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
