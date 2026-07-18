import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import { canonicalJsonBytes } from "../../src/product-compiler/canonical-json.js";
import * as buildModule from "../../src/execution/schemas/candidate-build-receipt-v2.js";
import {
  CANDIDATE_BUILD_COMMAND_BINDING_V2_SCHEMA,
  CANDIDATE_BUILD_OUTPUT_TREE_BINDING_V2_SCHEMA,
  CANDIDATE_BUILD_RECEIPT_V2_MAX_CANONICAL_BYTES,
  CANDIDATE_BUILD_RECEIPT_V2_SCHEMA,
  CANDIDATE_CANONICAL_RUNTIME_TREE_ARTIFACT_REF_V2_SCHEMA,
  CandidateBuildReceiptV2Schema,
  hashCandidateBuildCommandArgvV2,
  hashCandidateBuildCommandBindingV2,
  hashCandidateBuildCommandCapabilityRefsV2,
  hashCandidateBuildCommandEnvironmentRefsV2,
  hashCandidateBuildOutputTreeBindingV2,
  hashCandidateBuildReceiptV2,
  parseCandidateBuildReceiptV2,
  type CandidateBuildCommandBindingHashPayloadV2,
  type CandidateBuildOutputTreeBindingHashPayloadV2,
  type CandidateBuildReceiptHashPayloadV2,
  type CandidateBuildReceiptV2,
  type CandidateCanonicalRuntimeTreeArtifactRefV2,
} from "../../src/execution/schemas/candidate-build-receipt-v2.js";
import * as bundleModule from "../../src/execution/schemas/candidate-runtime-bundle-v2.js";
import {
  CANDIDATE_NPM_MATERIALIZATION_RECEIPT_V2_SCHEMA,
  CANDIDATE_NPM_MATERIALIZATION_RECEIPT_ABI_POLICY_V2,
  CANDIDATE_NPM_PRODUCTION_MATERIALIZATION_CONFIG_V2,
  CANDIDATE_NPM_PRODUCTION_MATERIALIZATION_RECIPE_V2,
  CANDIDATE_NPM_PRODUCTION_MATERIALIZATION_RECIPE_V2_SCHEMA,
  CANDIDATE_RUNTIME_APPLICATION_TREE_BINDING_V2_SCHEMA,
  CANDIDATE_RUNTIME_BUNDLE_V2_MAX_CANONICAL_BYTES,
  CANDIDATE_RUNTIME_BUNDLE_V2_SCHEMA,
  CANDIDATE_RUNTIME_DEPENDENCY_TREE_BINDING_V2_SCHEMA,
  CANDIDATE_RUNTIME_PACKAGE_JSON_REF_V2_SCHEMA,
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

function createApplicationTree(): CanonicalRuntimeTreeV2 {
  return createCanonicalRuntimeTreeV2({
    schema: CANONICAL_RUNTIME_TREE_V2_SCHEMA,
    profile: "dist",
    rootMode: "0555",
    entries: [
      { path: "assets", type: "directory", mode: "0555" },
      {
        path: "assets/app.css",
        type: "file",
        mode: "0444",
        executable: false,
        byteLength: 7,
        contentHash: sha("candidate-css"),
      },
      {
        path: "index.js",
        type: "file",
        mode: "0444",
        executable: false,
        byteLength: 11,
        contentHash: sha("candidate-index"),
      },
    ],
    fileCount: 2,
    directoryCount: 1,
    totalBytes: 18,
  });
}

function createDependencyTree(): CanonicalRuntimeTreeV2 {
  return createCanonicalRuntimeTreeV2({
    schema: CANONICAL_RUNTIME_TREE_V2_SCHEMA,
    profile: "dependencies",
    rootMode: "0555",
    entries: [
      { path: "@scope", type: "directory", mode: "0555" },
      { path: "@scope/pkg", type: "directory", mode: "0555" },
      {
        path: "@scope/pkg/index.js",
        type: "file",
        mode: "0444",
        executable: false,
        byteLength: 5,
        contentHash: sha("dependency-index"),
      },
      {
        path: "package.json",
        type: "file",
        mode: "0444",
        executable: false,
        byteLength: 2,
        contentHash: sha("dependency-package"),
      },
    ],
    fileCount: 2,
    directoryCount: 2,
    totalBytes: 7,
  });
}

function treeArtifact(label: string): CandidateCanonicalRuntimeTreeArtifactRefV2 {
  return {
    schema: CANDIDATE_CANONICAL_RUNTIME_TREE_ARTIFACT_REF_V2_SCHEMA,
    artifactType: CANONICAL_RUNTIME_TREE_V2_SCHEMA,
    envelopeHash: sha(`${label}-envelope`),
    envelopeByteLength: 1_024,
  };
}

function createBuildOutput(
  tree = createApplicationTree(),
): CandidateBuildOutputTreeBindingHashPayloadV2 & { bindingHash: string } {
  const identity: CandidateBuildOutputTreeBindingHashPayloadV2 = {
    schema: CANDIDATE_BUILD_OUTPUT_TREE_BINDING_V2_SCHEMA,
    treeSchema: tree.schema,
    profile: "dist",
    logicalRoot: "candidate-build-output",
    treeArtifact: treeArtifact("application"),
    treeHash: tree.treeHash,
    treePayloadHash: tree.payloadHash,
    fileCount: tree.fileCount,
    directoryCount: tree.directoryCount,
    totalBytes: tree.totalBytes,
  };
  return { ...identity, bindingHash: hashCandidateBuildOutputTreeBindingV2(identity) };
}

function createBuildCommand(): CandidateBuildCommandBindingHashPayloadV2 & {
  commandBindingHash: string;
} {
  const identity: CandidateBuildCommandBindingHashPayloadV2 = {
    schema: CANDIDATE_BUILD_COMMAND_BINDING_V2_SCHEMA,
    commandId: "CMD_BUILD_PRODUCTION",
    kind: "build",
    invocationMode: "direct_argv",
    argvHash: hashCandidateBuildCommandArgvV2(["npm", "run", "build"]),
    cwd: ".",
    timeoutMs: 120_000,
    capabilityRefsHash: hashCandidateBuildCommandCapabilityRefsV2([
      "CAP_TEST_RUNNER",
    ]),
    environmentRefsHash: hashCandidateBuildCommandEnvironmentRefsV2([
      "CI",
      "NODE_ENV",
    ]),
    catalogCommandRef: "STACK_NODE_WEB_CMD_BUILD_V2",
    catalogCommandHash: sha("catalog-build-command"),
  };
  return { ...identity, commandBindingHash: hashCandidateBuildCommandBindingV2(identity) };
}

function createBuildReceipt(): CandidateBuildReceiptV2 {
  const sourceRevision = {
    sha: sha("candidate-source-commit"),
    treeHash: sha("candidate-source-tree"),
  };
  const identity: CandidateBuildReceiptHashPayloadV2 = {
    schema: CANDIDATE_BUILD_RECEIPT_V2_SCHEMA,
    version: "2.0.0",
    authorityState: "candidate_unverified",
    productionUse: "forbidden",
    packetEnvelopeHash: sha("packet-envelope"),
    buildTopologyHash: sha("build-topology"),
    sourceBefore: sourceRevision,
    sourceAfter: clone(sourceRevision),
    selectedBuildCommand: createBuildCommand(),
    toolchainHash: sha("candidate-build-toolchain"),
    environmentCapsuleHash: sha("candidate-build-environment"),
    exitCode: 0,
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

function createDependencyBinding(
  tree = createDependencyTree(),
): CandidateRuntimeDependencyTreeBindingHashPayloadV2 & { bindingHash: string } {
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
): CandidateNpmMaterializationReceiptHashPayloadV2 & { receiptHash: string } {
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
      version: "10.8.2",
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
  return {
    ...identity,
    receiptHash: hashCandidateNpmMaterializationReceiptV2(identity),
  };
}

function createRuntimeBundle(): CandidateRuntimeBundleV2 {
  const buildReceipt = createBuildReceipt();
  const dependencyTree = createDependencyBinding();
  const identityWithoutClosure = {
    schema: CANDIDATE_RUNTIME_BUNDLE_V2_SCHEMA,
    version: "2.0.0",
    authorityState: "candidate_unverified",
    productionUse: "forbidden",
    packetEnvelopeHash: buildReceipt.packetEnvelopeHash,
    buildTopologyHash: buildReceipt.buildTopologyHash,
    sourceRevision: clone(buildReceipt.sourceAfter),
    buildReceiptHash: buildReceipt.receiptHash,
    buildReceipt,
    logicalRoot: "candidate-bundle",
    rootMode: "0555",
    allowedRootEntries: ["application", "node_modules", "package.json"] as const,
    applicationTree: createApplicationBinding(buildReceipt),
    dependencyTree,
    packageJson: createPackageJson(),
    npmMaterializationReceipt: createNpmReceipt(dependencyTree),
  } as const;
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

test("candidate build and runtime literals, hashes, exact bindings, and frozen parsers are deterministic", () => {
  const build = createBuildReceipt();
  const bundle = createRuntimeBundle();
  assert.equal(CandidateBuildReceiptV2Schema.safeParse(build).success, true);
  assert.equal(CandidateRuntimeBundleV2Schema.safeParse(bundle).success, true);
  assert.equal(build.schema, "setfarm.candidate-build-receipt.v2");
  assert.equal(build.authorityState, "candidate_unverified");
  assert.equal(build.productionUse, "forbidden");
  assert.equal(build.outputTree.logicalRoot, "candidate-build-output");
  assert.equal(build.outputTree.profile, "dist");
  assert.equal(build.selectedBuildCommand.kind, "build");
  assert.equal(build.selectedBuildCommand.invocationMode, "direct_argv");
  assert.equal(bundle.logicalRoot, "candidate-bundle");
  assert.equal(bundle.authorityState, "candidate_unverified");
  assert.equal(bundle.productionUse, "forbidden");
  assert.equal(bundle.rootMode, "0555");
  assert.deepEqual(bundle.allowedRootEntries, [
    "application",
    "node_modules",
    "package.json",
  ]);
  assert.equal(bundle.applicationTree.logicalRoot, "candidate-bundle/application");
  assert.equal(bundle.applicationTree.profile, "dist");
  assert.equal(bundle.dependencyTree.logicalRoot, "candidate-bundle/node_modules");
  assert.equal(bundle.dependencyTree.profile, "dependencies");
  assert.equal(bundle.packageJson.mode, "0444");
  assert.equal(bundle.npmMaterializationReceipt.lifecycleScripts, "forbidden");
  assert.equal(bundle.npmMaterializationReceipt.exitCode, 0);
  assert.equal(bundle.npmMaterializationReceipt.recipeHash,
    bundle.npmMaterializationReceipt.installRecipe.recipeHash);
  assert.equal(bundle.npmMaterializationReceipt.installRecipe.recipeHash,
    hashCandidateNpmProductionMaterializationRecipeV2(
      bundle.npmMaterializationReceipt.installRecipe,
    ));
  assert.equal(bundle.npmMaterializationReceipt.installRecipe.subcommand, "ci");
  assert.deepEqual(bundle.npmMaterializationReceipt.installRecipe.arguments, [
    "--omit=dev",
    "--ignore-scripts",
    "--no-audit",
    "--no-fund",
  ]);
  assert.equal(bundle.npmMaterializationReceipt.installRecipe.dependencySelection,
    "production_only");
  assert.equal(bundle.npmMaterializationReceipt.installRecipe.outputRoot,
    bundle.npmMaterializationReceipt.outputRoot);
  assert.equal(bundle.npmMaterializationReceipt.installRecipe.lifecycleScripts,
    bundle.npmMaterializationReceipt.lifecycleScripts);
  assert.equal(
    bundle.npmMaterializationReceipt.installRecipe.materializationReceiptSchema,
    CANDIDATE_NPM_MATERIALIZATION_RECEIPT_V2_SCHEMA,
  );
  assert.equal(
    bundle.npmMaterializationReceipt.installRecipe.materializationReceiptSchemaHash,
    CANDIDATE_NPM_MATERIALIZATION_RECEIPT_ABI_POLICY_V2.policyHash,
  );
  assert.equal(
    bundle.npmMaterializationReceipt.installRecipe.configHash,
    CANDIDATE_NPM_PRODUCTION_MATERIALIZATION_CONFIG_V2.configHash,
  );
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
  assertRecursivelyFrozen(CANDIDATE_NPM_PRODUCTION_MATERIALIZATION_CONFIG_V2);
  assertRecursivelyFrozen(CANDIDATE_NPM_MATERIALIZATION_RECEIPT_ABI_POLICY_V2);
  assertRecursivelyFrozen(CANDIDATE_NPM_PRODUCTION_MATERIALIZATION_RECIPE_V2);
  assert.equal("entries" in build.outputTree, false);
  assert.equal("entries" in bundle.applicationTree, false);
  assert.equal("entries" in bundle.dependencyTree, false);
  assert.equal("worktree" in build, false);
  assert.equal("worktree" in bundle, false);
  assert.equal("createdAt" in build, false);
  assert.equal("createdAt" in bundle, false);

  const parsedBuild = parseCandidateBuildReceiptV2(clone(build));
  const parsedBundle = parseCandidateRuntimeBundleV2(clone(bundle));
  assert.deepEqual(parsedBuild, build);
  assert.deepEqual(parsedBundle, bundle);
  assert.notStrictEqual(parsedBuild, build);
  assert.notStrictEqual(parsedBundle, bundle);
  assertRecursivelyFrozen(parsedBuild);
  assertRecursivelyFrozen(parsedBundle);
});

test("candidate build receipt rejects source drift, failed builds, stale hashes, unknown fields, and forged tree refs", () => {
  const sourceDrift = clone(createBuildReceipt());
  sourceDrift.sourceAfter.sha = sha("drifted-source");
  sourceDrift.receiptHash = hashCandidateBuildReceiptV2(sourceDrift);
  assert.equal(CandidateBuildReceiptV2Schema.safeParse(sourceDrift).success, false);

  const failedBuild = clone(createBuildReceipt()) as unknown as Record<string, unknown>;
  failedBuild.exitCode = 1;
  failedBuild.receiptHash = hashCandidateBuildReceiptV2(failedBuild as never);
  assert.equal(CandidateBuildReceiptV2Schema.safeParse(failedBuild).success, false);

  const staleCommand = clone(createBuildReceipt());
  staleCommand.selectedBuildCommand.timeoutMs += 1;
  staleCommand.receiptHash = hashCandidateBuildReceiptV2(staleCommand);
  assert.equal(CandidateBuildReceiptV2Schema.safeParse(staleCommand).success, false);

  const staleOutput = clone(createBuildReceipt());
  staleOutput.outputTree.totalBytes += 1;
  staleOutput.receiptHash = hashCandidateBuildReceiptV2(staleOutput);
  assert.equal(CandidateBuildReceiptV2Schema.safeParse(staleOutput).success, false);

  const forgedTreeRef = clone(createBuildReceipt());
  const refWithExtra = {
    ...forgedTreeRef.outputTree.treeArtifact,
    mutablePath: "/tmp/worktree/dist",
  };
  forgedTreeRef.outputTree = {
    ...forgedTreeRef.outputTree,
    treeArtifact: refWithExtra,
  } as typeof forgedTreeRef.outputTree;
  forgedTreeRef.outputTree.bindingHash =
    hashCandidateBuildOutputTreeBindingV2(forgedTreeRef.outputTree);
  forgedTreeRef.receiptHash = hashCandidateBuildReceiptV2(forgedTreeRef);
  assert.equal(CandidateBuildReceiptV2Schema.safeParse(forgedTreeRef).success, false);

  assert.equal(CandidateBuildReceiptV2Schema.safeParse({
    ...createBuildReceipt(),
    timestamp: "2026-07-18T00:00:00.000Z",
  }).success, false);
  assert.equal(CandidateBuildReceiptV2Schema.safeParse({
    ...createBuildReceipt(),
    authorityState: "verified",
  }).success, false);
  assert.equal(CandidateBuildReceiptV2Schema.safeParse({
    ...createBuildReceipt(),
    productionUse: "allowed",
  }).success, false);
});

test("runtime bundle rejects self-consistent cross-join, application, and npm/tree forgeries", () => {
  const packetForgery = clone(createRuntimeBundle());
  packetForgery.packetEnvelopeHash = sha("different-packet");
  packetForgery.bundleHash = hashCandidateRuntimeBundleV2(packetForgery);
  assert.equal(CandidateRuntimeBundleV2Schema.safeParse(packetForgery).success, false);

  const sourceForgery = clone(createRuntimeBundle());
  sourceForgery.sourceRevision.treeHash = sha("different-source-tree");
  sourceForgery.bundleHash = hashCandidateRuntimeBundleV2(sourceForgery);
  assert.equal(CandidateRuntimeBundleV2Schema.safeParse(sourceForgery).success, false);

  const applicationForgery = clone(createRuntimeBundle());
  applicationForgery.applicationTree.treeHash = sha("different-application-tree");
  rehashRuntimeBundle(applicationForgery);
  assert.equal(CandidateRuntimeBundleV2Schema.safeParse(applicationForgery).success, false);

  const npmForgery = clone(createRuntimeBundle());
  npmForgery.npmMaterializationReceipt.dependencyTreePayloadHash =
    sha("different-dependency-payload");
  rehashRuntimeBundle(npmForgery);
  assert.equal(CandidateRuntimeBundleV2Schema.safeParse(npmForgery).success, false);

  const buildReceiptForgery = clone(createRuntimeBundle());
  buildReceiptForgery.buildReceiptHash = sha("different-build-receipt");
  buildReceiptForgery.bundleHash = hashCandidateRuntimeBundleV2(buildReceiptForgery);
  assert.equal(CandidateRuntimeBundleV2Schema.safeParse(buildReceiptForgery).success, false);

  const staleRecipe = clone(createRuntimeBundle());
  staleRecipe.npmMaterializationReceipt.installRecipe.configHash =
    sha("different-npm-config");
  staleRecipe.npmMaterializationReceipt.installRecipe.recipeHash =
    hashCandidateNpmProductionMaterializationRecipeV2(
      staleRecipe.npmMaterializationReceipt.installRecipe,
    );
  staleRecipe.npmMaterializationReceipt.recipeHash =
    staleRecipe.npmMaterializationReceipt.installRecipe.recipeHash;
  staleRecipe.npmMaterializationReceipt.receiptHash =
    hashCandidateNpmMaterializationReceiptV2(staleRecipe.npmMaterializationReceipt);
  staleRecipe.bundleHash = hashCandidateRuntimeBundleV2(staleRecipe);
  assert.equal(CandidateRuntimeBundleV2Schema.safeParse(staleRecipe).success, false);

  const recipeJoinForgery = clone(createRuntimeBundle());
  recipeJoinForgery.npmMaterializationReceipt.recipeHash = sha("different-recipe");
  recipeJoinForgery.npmMaterializationReceipt.receiptHash =
    hashCandidateNpmMaterializationReceiptV2(
      recipeJoinForgery.npmMaterializationReceipt,
    );
  recipeJoinForgery.bundleHash = hashCandidateRuntimeBundleV2(recipeJoinForgery);
  assert.equal(CandidateRuntimeBundleV2Schema.safeParse(recipeJoinForgery).success, false);

  const argumentForgery = clone(createRuntimeBundle()) as unknown as {
    npmMaterializationReceipt: {
      installRecipe: {
        arguments: string[];
        recipeHash: string;
      };
      recipeHash: string;
      receiptHash: string;
    };
    bundleHash: string;
  };
  argumentForgery.npmMaterializationReceipt.installRecipe.arguments[0] = "--include=dev";
  argumentForgery.npmMaterializationReceipt.installRecipe.recipeHash =
    hashCandidateNpmProductionMaterializationRecipeV2(
      argumentForgery.npmMaterializationReceipt.installRecipe as never,
    );
  argumentForgery.npmMaterializationReceipt.recipeHash =
    argumentForgery.npmMaterializationReceipt.installRecipe.recipeHash;
  argumentForgery.npmMaterializationReceipt.receiptHash =
    hashCandidateNpmMaterializationReceiptV2(
      argumentForgery.npmMaterializationReceipt as never,
    );
  argumentForgery.bundleHash = hashCandidateRuntimeBundleV2(argumentForgery as never);
  assert.equal(CandidateRuntimeBundleV2Schema.safeParse(argumentForgery).success, false);
});

test("runtime bundle rejects noncanonical roots, layouts, package refs, extra entries, and stale closure hashes", () => {
  const wrongRoot = {
    ...createRuntimeBundle(),
    logicalRoot: "candidate-bundle-copy",
  };
  assert.equal(CandidateRuntimeBundleV2Schema.safeParse(wrongRoot).success, false);

  const wrongMode = {
    ...createRuntimeBundle(),
    rootMode: "0755",
  };
  assert.equal(CandidateRuntimeBundleV2Schema.safeParse(wrongMode).success, false);

  const wrongLayout = {
    ...createRuntimeBundle(),
    allowedRootEntries: ["application", "package.json", "node_modules"],
  };
  assert.equal(CandidateRuntimeBundleV2Schema.safeParse(wrongLayout).success, false);

  const fourthEntry = {
    ...createRuntimeBundle(),
    allowedRootEntries: ["application", "node_modules", "package.json", "secret"],
  };
  assert.equal(CandidateRuntimeBundleV2Schema.safeParse(fourthEntry).success, false);
  assert.equal(CandidateRuntimeBundleV2Schema.safeParse({
    ...createRuntimeBundle(),
    secretRootEntry: { logicalLocator: "candidate-bundle/secret" },
  }).success, false);

  const mutablePackage = clone(createRuntimeBundle()) as unknown as Record<string, unknown>;
  mutablePackage.packageJson = {
    ...(mutablePackage.packageJson as Record<string, unknown>),
    mode: "0644",
  };
  assert.equal(CandidateRuntimeBundleV2Schema.safeParse(mutablePackage).success, false);

  const staleClosure = clone(createRuntimeBundle());
  staleClosure.packageJson.contentHash = sha("different-package-json");
  staleClosure.bundleHash = hashCandidateRuntimeBundleV2(staleClosure);
  assert.equal(CandidateRuntimeBundleV2Schema.safeParse(staleClosure).success, false);

  assert.equal(CandidateRuntimeBundleV2Schema.safeParse({
    ...createRuntimeBundle(),
    authorityState: "verified",
  }).success, false);
  assert.equal(CandidateRuntimeBundleV2Schema.safeParse({
    ...createRuntimeBundle(),
    productionUse: "allowed",
  }).success, false);
});

test("bounded parsers reject oversized, cyclic, accessor, and hostile proxy candidates without invoking user code", () => {
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
  assert.throws(() => parseCandidateRuntimeBundleV2({
    ...bundle,
    padding: "x".repeat(CANDIDATE_RUNTIME_BUNDLE_V2_MAX_CANONICAL_BYTES),
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

  let proxyGetInvoked = false;
  const hostile = new Proxy({}, {
    get() {
      proxyGetInvoked = true;
      throw new Error("proxy get trap must not run");
    },
  });
  assert.throws(() => parseCandidateBuildReceiptV2(hostile));
  assert.equal(proxyGetInvoked, false);
});

test("candidate artifact hashes have fixed literal goldens and separated domains", () => {
  const build = createBuildReceipt();
  const bundle = createRuntimeBundle();
  const actual = {
    argvHash: build.selectedBuildCommand.argvHash,
    capabilityRefsHash: build.selectedBuildCommand.capabilityRefsHash,
    environmentRefsHash: build.selectedBuildCommand.environmentRefsHash,
    commandBindingHash: build.selectedBuildCommand.commandBindingHash,
    buildOutputBindingHash: build.outputTree.bindingHash,
    buildReceiptHash: build.receiptHash,
    applicationBindingHash: bundle.applicationTree.bindingHash,
    dependencyBindingHash: bundle.dependencyTree.bindingHash,
    npmConfigHash: CANDIDATE_NPM_PRODUCTION_MATERIALIZATION_CONFIG_V2.configHash,
    npmReceiptAbiPolicyHash:
      CANDIDATE_NPM_MATERIALIZATION_RECEIPT_ABI_POLICY_V2.policyHash,
    npmRecipeHash: bundle.npmMaterializationReceipt.installRecipe.recipeHash,
    npmReceiptHash: bundle.npmMaterializationReceipt.receiptHash,
    bundleClosureHash: bundle.bundleClosureHash,
    bundleHash: bundle.bundleHash,
    buildCanonicalBytes: canonicalJsonBytes(build).byteLength,
    bundleCanonicalBytes: canonicalJsonBytes(bundle).byteLength,
  };
  assert.deepEqual(actual, {
    argvHash: "eab518ab4749ea3db8ef4ca8cc77ecb68f2d27a58f561747b3f7e3e8af5ee6ed",
    capabilityRefsHash: "356e6f73bcc7e23174c26c1111fc756c67d26accc5a3c985560eb39d86b64a34",
    environmentRefsHash: "37ded600ea86bf8c9834b98a57191b57d7f2f5208bfa257f1609fea3aa47a30e",
    commandBindingHash: "66848f9d9009857ebe7de4425b9865650d8f046a070f5c21812ce506a02b6fa1",
    buildOutputBindingHash: "bc9c1596edd94ad6f655846aa3055c3b4a930609ede89cc309ec3070c81c91dc",
    buildReceiptHash: "92f4ab828140dce4aeb2c9eaa57c3a63046719fcb12dcafad07be1a5d3ed776f",
    applicationBindingHash: "f1fd8c41c096d4237fd8ad99639f8effdc07ca58e98bb4a406f60af88d1a16c7",
    dependencyBindingHash: "537a977eb53395e6fe9e30338d75104ec96ec0ef59c67782fc27977765808e4b",
    npmConfigHash: "548a8894a209c13f0edda9684c8cc91b12e1aa11b4d73c860df59004fffa3c9d",
    npmReceiptAbiPolicyHash: "374bbc794e441c35de2316b8ae2f2fef269013021f75dd1dc5788aada766ffb9",
    npmRecipeHash: "65a481f9d3f0ba72e2b0bd6d02f9042e5c9ee2c85f02cf86a5a51771a927654c",
    npmReceiptHash: "ba6e370294d4a312578bab80cfc945688d07b214d59c60e2632f72baf95638ce",
    bundleClosureHash: "497574e765d72a71bff1b3cc716afe955102a74da30bc0e44a31f3e7a4ef684e",
    bundleHash: "323abc5e318b20ee19558ab99683964106315d62a97f9cd0d7c492d580cf0af7",
    buildCanonicalBytes: 2_297,
    bundleCanonicalBytes: 6_817,
  });
  const hashes = Object.entries(actual)
    .filter(([name]) => name.endsWith("Hash"))
    .map(([, value]) => value);
  assert.equal(new Set(hashes).size, hashes.length);
});

test("candidate DTO modules expose data contracts, parsers, and hashes but no operational authority", () => {
  const exportedNames = [
    ...Object.keys(buildModule),
    ...Object.keys(bundleModule),
  ];
  assert.equal(exportedNames.some((name) =>
    /^(?:verify|issue|materialize|activate|run|launch|derive|create)/i.test(name)), false);
  assert.equal(exportedNames.some((name) =>
    /(?:Brand|Verified|Activated|Default|Retry|Classifier)/.test(name)), false);
  assert.equal(exportedNames.every((name) =>
    /^(?:CANDIDATE_|Candidate.*Schema$|hashCandidate|parseCandidate)/.test(name)), true);
});
