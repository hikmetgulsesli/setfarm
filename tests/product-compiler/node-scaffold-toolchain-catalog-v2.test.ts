import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  NodeScaffoldToolchainCatalogVerificationErrorV2,
  NodeScaffoldToolchainResolutionVerificationErrorV2,
  getCodeOwnedNodeScaffoldToolchainCatalogV2,
  getCodeOwnedNodeScaffoldToolchainEntryV2,
  nodeScaffoldToolchainCatalogHashV2,
  resolveNodeScaffoldToolchainV2,
  verifyNodeScaffoldToolchainCatalogV2,
  verifyNodeScaffoldToolchainResolutionV2,
} from "../../src/product-compiler/node-scaffold-toolchain-catalog-v2.js";
import {
  resolveProductDeliverySelectionV2,
  type ProductDeliverySelectionV2,
} from "../../src/product-compiler/product-delivery-profile-catalog-v2.js";
import {
  NODE_SCAFFOLD_ASSET_CODE_SHA_V2,
  NODE_SCAFFOLD_BUILD_REQUIRED_PRECONDITIONS_V2,
  NODE_SCAFFOLD_INSTALL_REQUIRED_PRECONDITIONS_V2,
  NODE_SCAFFOLD_TEST_REQUIRED_PRECONDITIONS_V2,
  NODE_SCAFFOLD_TOOLCHAIN_BLOCKER_CODES_V2,
  NODE_SCAFFOLD_TOOLCHAIN_CATALOG_VERSION_V2,
  NodeScaffoldDependencyGraphV2Schema,
  NodeScaffoldToolchainCatalogV2Schema,
  NodeScaffoldToolchainResolutionV2Schema,
  hashNodeScaffoldDependencyEdgeMembershipV2,
  hashNodeScaffoldDependencyGraphV2,
  hashNodeScaffoldDependencyNodeMembershipV2,
  hashNodeScaffoldExecutionEnvironmentV2,
  hashNodeScaffoldSemanticRequirementMembershipV2,
  hashNodeScaffoldToolchainCatalogV2,
  hashNodeScaffoldToolchainEntryV2,
  hashNodeScaffoldToolchainResolutionV2,
  nodeScaffoldVersionSatisfiesSpecV2,
  type NodeScaffoldToolchainCatalogV2,
  type NodeScaffoldToolchainResolutionV2,
} from "../../src/product-compiler/schemas/node-scaffold-toolchain-catalog-v2.js";
import type { ProductSpecV2 } from "../../src/product-compiler/schemas/product-spec-v2.js";
import {
  genuineNodeCliProductSpecV2,
  genuineNodeExpressApiProductSpecV2,
  twoStoryNodeExpressApiProductSpecV2,
} from "./fixtures/no-design-product-semantics-v2.js";

const CATALOG_HASH_GOLDEN_V2 =
  "c3bea66eb67191aab2d3b489b53ce8bb63d4e40bceef71c50f771adce4e65c82";
const CLI_ENTRY_HASH_GOLDEN_V2 =
  "394f08a458cfed9d8516d4d463d1b139c0cf2899d470b107b4247be2b534a050";
const API_ENTRY_HASH_GOLDEN_V2 =
  "9982762efb8ac598af3acf08a4b1b22db188bae9d1fd20564b83fa36fe6c314a";
const CLI_GRAPH_HASH_GOLDEN_V2 =
  "9df929156d318356432f64478465b4d9db56e149322c0a409668cb1d94cd2e05";
const API_GRAPH_HASH_GOLDEN_V2 =
  "0b252fa9eae81525771901bad0a279656164e4b03dceadde6b58186ee80c519f";

const FILE_GOLDENS_V2 = Object.freeze({
  cli: Object.freeze([
    Object.freeze({
      role: "package_manifest",
      rawHash: "8c8249391b57fc7b7d3f440335d3e1b9b9fd75f7baa4e7d3bf615f5e3054700c",
      rawByteLength: 301,
      bundleHash: "32b7db78487ca7023c8decf1ad7aa611dda1f7baa60094a44b8938fe708b4ca3",
    }),
    Object.freeze({
      role: "dependency_lock_manifest",
      rawHash: "e30f7d18cec621f492825b7ead4b9cfe2d624b4105b25df6684885fe1f87f519",
      rawByteLength: 1_197,
      bundleHash: "d86ebea38e92ba865ad1abc800af9e3aff2dfed258a5682be8913805e7605ef2",
    }),
    Object.freeze({
      role: "typescript_compiler_config",
      rawHash: "87cee8ff1887b0bccf7ee2a48f80d7260bfbf2fb67ac1ce1e6ca77abb8fb9bdc",
      rawByteLength: 333,
      bundleHash: "f3beb21fa12b3218e9337942e38f794fdea9352da30e0bb69fb85b9caa6e62e0",
    }),
  ]),
  api: Object.freeze([
    Object.freeze({
      role: "package_manifest",
      rawHash: "d36a97f3cf8f73fa00a3102683d734a846138c8519205933388ad3b0e719237a",
      rawByteLength: 369,
      bundleHash: "bc92442867d5976555cdcc6114f3814e3b2b8debc1e7eb0bff8e129f77499a1e",
    }),
    Object.freeze({
      role: "dependency_lock_manifest",
      rawHash: "bb91e8e0ff68969491f37e1dd3f1c1f50b8a1aeb8f1b6ae765adbe48e74803d2",
      rawByteLength: 27_244,
      bundleHash: "71b038d0a383b9895c5d7eeb5cd3b703dc3d598f41ad080e920216e8a5809020",
    }),
    Object.freeze({
      role: "typescript_compiler_config",
      rawHash: "87cee8ff1887b0bccf7ee2a48f80d7260bfbf2fb67ac1ce1e6ca77abb8fb9bdc",
      rawByteLength: 333,
      bundleHash: "f3beb21fa12b3218e9337942e38f794fdea9352da30e0bb69fb85b9caa6e62e0",
    }),
  ]),
});

function selectionFor(
  productSpec: ProductSpecV2,
  requestedStackPackId: "node-cli" | "node-express-api",
): ProductDeliverySelectionV2 {
  const result = resolveProductDeliverySelectionV2({
    productSpec,
    requestedStackPackId,
  });
  assert.equal(
    result.status,
    "shadow_selected",
    result.status === "rejected" ? JSON.stringify(result.diagnostics) : undefined,
  );
  if (result.status !== "shadow_selected") throw new Error("Expected selection");
  return result.selection;
}

function resolved(
  productSpec: ProductSpecV2,
  requestedStackPackId: "node-cli" | "node-express-api",
) {
  const deliverySelection = selectionFor(productSpec, requestedStackPackId);
  const result = resolveNodeScaffoldToolchainV2({
    productSpec,
    deliverySelection,
  });
  assert.equal(
    result.status,
    "shadow_resolved",
    result.status === "rejected" ? JSON.stringify(result.diagnostics) : undefined,
  );
  if (result.status !== "shadow_resolved") throw new Error("Expected resolution");
  return { productSpec, deliverySelection, ...result };
}

function assertRecursivelyFrozen(value: unknown): void {
  if (value === null || typeof value !== "object") return;
  assert.equal(Object.isFrozen(value), true);
  Object.values(value).forEach(assertRecursivelyFrozen);
}

function rehashGraph(graph: any): void {
  graph.nodeCount = graph.nodes.length;
  graph.edgeCount = graph.edges.length;
  graph.nodeMembershipHash = hashNodeScaffoldDependencyNodeMembershipV2(
    graph.nodes,
  );
  graph.edgeMembershipHash = hashNodeScaffoldDependencyEdgeMembershipV2(
    graph.edges,
  );
  graph.graphHash = hashNodeScaffoldDependencyGraphV2(graph);
}

function rehashCatalog(catalog: any): void {
  for (const entry of catalog.entries) {
    rehashGraph(entry.dependencyGraph);
    entry.executionEnvironment.environmentContractHash =
      hashNodeScaffoldExecutionEnvironmentV2(entry.executionEnvironment);
    for (const recipe of ["install", "build", "test"]) {
      entry.recipes[recipe].environmentBinding.environmentContractHash =
        entry.executionEnvironment.environmentContractHash;
    }
    entry.entryHash = hashNodeScaffoldToolchainEntryV2(entry);
  }
  catalog.entryCount = catalog.entries.length;
  catalog.catalogHash = hashNodeScaffoldToolchainCatalogV2(catalog);
}

function rehashResolution(resolution: any): void {
  resolution.semanticRequirementBindingCount =
    resolution.semanticRequirementBindings.length;
  resolution.semanticRequirementMembershipHash =
    hashNodeScaffoldSemanticRequirementMembershipV2(
      resolution.semanticRequirementBindings,
    );
  resolution.resolutionHash = hashNodeScaffoldToolchainResolutionV2(resolution);
}

function assertCatalogVerificationError(
  operation: () => unknown,
  code: NodeScaffoldToolchainCatalogVerificationErrorV2["code"],
): void {
  assert.throws(operation, (error: unknown) =>
    error instanceof NodeScaffoldToolchainCatalogVerificationErrorV2
    && error.code === code);
}

function assertResolutionVerificationError(
  operation: () => unknown,
  code: NodeScaffoldToolchainResolutionVerificationErrorV2["code"],
): void {
  assert.throws(operation, (error: unknown) =>
    error instanceof NodeScaffoldToolchainResolutionVerificationErrorV2
    && error.code === code);
}

describe("NodeScaffoldToolchainCatalogV2 code-owned authority", () => {
  it("pins exactly two recursively immutable shadow entries and version goldens", () => {
    const catalog = getCodeOwnedNodeScaffoldToolchainCatalogV2();
    assert.equal(catalog.schema, "setfarm.node-scaffold-toolchain-catalog.v2");
    assert.equal(catalog.catalogVersion, NODE_SCAFFOLD_TOOLCHAIN_CATALOG_VERSION_V2);
    assert.equal(catalog.catalogVersion, "2.0.0");
    assert.equal(catalog.sourceAuthority.codeSha, NODE_SCAFFOLD_ASSET_CODE_SHA_V2);
    assert.equal(catalog.sourceAuthority.codeSha,
      "9a1b80e7b3e7f2d8cea1b6b0a74d1bfcf76c6ddf");
    assert.equal(catalog.sourceAuthority.publicationStatus, "unpublished_shadow");
    assert.equal(catalog.sourceAuthority.deepCasVerification.status, "unverified");
    assert.deepEqual(catalog.readiness.blockerCodes,
      NODE_SCAFFOLD_TOOLCHAIN_BLOCKER_CODES_V2);
    assert.equal(catalog.readiness.productionUse, "forbidden");
    assert.equal(catalog.entryCount, 2);
    assert.deepEqual(catalog.entries.map((entry) => entry.entryRef), [
      "NODE_SCAFFOLD_TOOLCHAIN_NODE_CLI_V2",
      "NODE_SCAFFOLD_TOOLCHAIN_NODE_EXPRESS_API_V2",
    ]);
    assert.deepEqual(catalog.entries.map((entry) => entry.entryHash), [
      CLI_ENTRY_HASH_GOLDEN_V2,
      API_ENTRY_HASH_GOLDEN_V2,
    ]);
    assert.equal(catalog.catalogHash, CATALOG_HASH_GOLDEN_V2);
    assert.equal(nodeScaffoldToolchainCatalogHashV2(), CATALOG_HASH_GOLDEN_V2);
    assertRecursivelyFrozen(catalog);
    assert.notEqual(getCodeOwnedNodeScaffoldToolchainCatalogV2(), catalog);
  });

  it("binds six exact ByteBundle refs without claiming publication or deep CAS proof", () => {
    const catalog = getCodeOwnedNodeScaffoldToolchainCatalogV2();
    for (const [index, entry] of catalog.entries.entries()) {
      const expected = index === 0 ? FILE_GOLDENS_V2.cli : FILE_GOLDENS_V2.api;
      assert.equal(entry.scaffold.fileCount, 3);
      assert.deepEqual(entry.scaffold.files.map((file) => ({
        role: file.role,
        rawHash: file.rawHash,
        rawByteLength: file.rawByteLength,
        bundleHash: file.byteBundle.envelopeHash,
      })), expected);
      assert.deepEqual(entry.scaffold.files.map((file) => ({
        slot: file.pathSlotRef,
        locator: file.normalizedLocator,
        mediaType: file.mediaType,
      })), [
        {
          slot: "PATH_SLOT_NODE_PACKAGE_JSON_V2",
          locator: "package.json",
          mediaType: "application/json",
        },
        {
          slot: "PATH_SLOT_NODE_PACKAGE_LOCK_JSON_V2",
          locator: "package-lock.json",
          mediaType: "application/json",
        },
        {
          slot: "PATH_SLOT_NODE_TSCONFIG_JSON_V2",
          locator: "tsconfig.json",
          mediaType: "application/json",
        },
      ]);
      assert.equal(entry.scaffold.files.every((file) =>
        file.byteBundle.artifactType === "setfarm.byte-bundle.v1"
        && file.byteBundle.rawHash === file.rawHash
        && file.byteBundle.rawByteLength === file.rawByteLength), true);
      const serialized = JSON.stringify(entry.scaffold);
      for (const forbidden of [
        "src/cli.ts",
        "src/app.ts",
        ".gitignore",
        "README",
        "dist/",
        "node_modules/",
      ]) assert.equal(serialized.includes(forbidden), false);
    }
  });

  it("derives complete exact CLI and API dependency graphs from the lock bytes", () => {
    const [cli, api] = getCodeOwnedNodeScaffoldToolchainCatalogV2().entries;
    assert.deepEqual({
      nodes: cli!.dependencyGraph.nodeCount,
      edges: cli!.dependencyGraph.edgeCount,
      graphHash: cli!.dependencyGraph.graphHash,
    }, { nodes: 3, edges: 3, graphHash: CLI_GRAPH_HASH_GOLDEN_V2 });
    assert.deepEqual({
      nodes: api!.dependencyGraph.nodeCount,
      edges: api!.dependencyGraph.edgeCount,
      graphHash: api!.dependencyGraph.graphHash,
    }, { nodes: 79, edges: 141, graphHash: API_GRAPH_HASH_GOLDEN_V2 });
    for (const entry of [cli!, api!]) {
      const graph = entry.dependencyGraph;
      assert.equal(NodeScaffoldDependencyGraphV2Schema.safeParse(graph).success, true);
      assert.equal(graph.nodes.every((node, index) =>
        index === 0 || graph.nodes[index - 1]!.packagePath < node.packagePath), true);
      assert.equal(graph.nodes.every((node) =>
        node.resolved.startsWith("https://registry.npmjs.org/")
        && node.integrity.startsWith("sha512-")
        && node.installLifecycle === "hasInstallScript_absent_in_lock"
        && node.nativeLockMetadata === "absent"), true);
      assert.equal(graph.edges.every((edge, index) =>
        index === 0
        || [
          graph.edges[index - 1]!.ownerPackagePath,
          graph.edges[index - 1]!.kind,
          graph.edges[index - 1]!.dependencyName,
          graph.edges[index - 1]!.resolvedPackagePath,
        ].join("\0") < [
          edge.ownerPackagePath,
          edge.kind,
          edge.dependencyName,
          edge.resolvedPackagePath,
        ].join("\0")), true);
      assert.equal(graph.edges.every((edge) =>
        nodeScaffoldVersionSatisfiesSpecV2(
          edge.resolvedVersion,
          edge.declaredSpec,
        )), true);
      assert.equal(graph.policy.registryLifecycleMetadataAuthority,
        "unversioned_audit_not_production_authority");
      assert.equal(graph.policy.deepTarballContentAuthority, "unverified_blocking");
    }
  });

  it("publishes an explicit bounded semver grammar and rejects unknown syntax", () => {
    const accepted = [
      ["1.2.3", "1.2.3"],
      ["1.9.1", "1"],
      ["99.0.0", "*"],
      ["2.4.1", "^2"],
      ["1.13.4", "^1.13.3"],
      ["0.7.2", "^0.7.1"],
      ["0.7.2", "~0.7.0"],
      ["2.4.0", ">= 2.1.2 < 3.0.0"],
    ] as const;
    accepted.forEach(([version, spec]) =>
      assert.equal(nodeScaffoldVersionSatisfiesSpecV2(version, spec), true));
    for (const [version, spec] of [
      ["2.0.0", "^1.0.0"],
      ["0.8.0", "^0.7.1"],
      ["1.3.0", "~1.2.0"],
      ["1.0.0", "1.x"],
      ["1.0.0", "latest"],
      ["1.0.0", "npm:alias@1.0.0"],
      ["1.0.0", "git+https://example.invalid/repo.git"],
      ["1.0.0", "file:../escape"],
      ["1.0.0", "^1 || ^2"],
    ]) assert.equal(nodeScaffoldVersionSatisfiesSpecV2(version, spec), false);
    assert.equal(
      nodeScaffoldVersionSatisfiesSpecV2(
        "9007199254740993.0.0",
        "9007199254740992.0.0",
      ),
      false,
    );
    assert.equal(nodeScaffoldVersionSatisfiesSpecV2("01.2.3", "1.2.3"), false);
    const oversizedComparator = `>= ${"9".repeat(65)}.0.0 < ${"9".repeat(66)}.0.0`;
    assert.doesNotThrow(() =>
      nodeScaffoldVersionSatisfiesSpecV2("1.0.0", oversizedComparator));
    assert.equal(
      nodeScaffoldVersionSatisfiesSpecV2("1.0.0", oversizedComparator),
      false,
    );
    assert.equal(
      nodeScaffoldVersionSatisfiesSpecV2("1.0.0", `^${"9".repeat(65)}.0.0`),
      false,
    );
  });

  it("keeps install, build, source generation, and acceptance fail-closed", () => {
    for (const entry of getCodeOwnedNodeScaffoldToolchainCatalogV2().entries) {
      assert.deepEqual(entry.recipes.install.directArgv, [
        "npm",
        "ci",
        "--include=dev",
        "--ignore-scripts",
        "--no-audit",
        "--no-fund",
      ]);
      const environment = entry.executionEnvironment;
      assert.equal(environment.contractVersion, "2.2.0");
      assert.equal(environment.mode, "planned_isolated_exact");
      assert.equal(environment.productionAuthority, "unverified_blocking");
      assert.equal(environment.inheritAmbientEnvironment, false);
      assert.equal(environment.constructionPolicy, "deny_all_then_exact_set");
      assert.deepEqual(environment.inheritedVariableAllowlist, []);
      assert.equal(environment.fixedVariables.NODE_DISABLE_COMPILE_CACHE, "1");
      assert.equal(environment.fixedVariables.NPM_CONFIG_ENGINE_STRICT, "true");
      assert.equal(environment.fixedVariables.NPM_CONFIG_LOGS_MAX, "0");
      assert.equal(
        environment.npmConfigIsolation.ambientVariablePolicy,
        "strip_all_before_exact_set",
      );
      assert.equal(environment.attemptScopedVariableBindings.PATH,
        "HOST_TOOLCHAIN_EXACT_COMMAND_PATH_V2");
      assert.notEqual(
        environment.npmConfigIsolation.userNpmrc.pathRef,
        environment.npmConfigIsolation.globalNpmrc.pathRef,
      );
      assert.equal(
        environment.environmentContractHash,
        hashNodeScaffoldExecutionEnvironmentV2(environment),
      );
      assert.deepEqual(
        entry.recipes.install.requiredPreconditions,
        NODE_SCAFFOLD_INSTALL_REQUIRED_PRECONDITIONS_V2,
      );
      assert.deepEqual(
        entry.recipes.build.requiredPreconditions,
        NODE_SCAFFOLD_BUILD_REQUIRED_PRECONDITIONS_V2,
      );
      assert.deepEqual(
        entry.recipes.test.requiredPreconditions,
        NODE_SCAFFOLD_TEST_REQUIRED_PRECONDITIONS_V2,
      );
      for (const recipe of ["install", "build", "test"] as const) {
        assert.equal(
          entry.recipes[recipe].environmentBinding.environmentContractHash,
          environment.environmentContractHash,
        );
        assert.equal(
          entry.recipes[recipe].requiredPreconditionCount,
          entry.recipes[recipe].requiredPreconditions.length,
        );
      }
      assert.equal(entry.recipes.install.executionStatus,
        "blocked_until_private_materializer_and_host_receipt");
      assert.equal(entry.sourceGeneration.scaffoldCreatesSource, false);
      assert.equal(entry.sourceGeneration.requiredBaseState, "absent");
      assert.equal(entry.sourceGeneration.finalOwnerRef, "NODE_ENTRYPOINT_GENERATOR_V2");
      assert.equal(entry.sourceGeneration.outputMode, "whole_file");
      assert.equal(entry.sourceGeneration.modelWriteAuthority, "forbidden");
      assert.equal(entry.sourceGeneration.currentSemanticRulesCompatibility.status,
        "unmigrated_shared_entrypoint_rules");
      assert.equal(
        entry.sourceGeneration.currentSemanticRulesCompatibility.productionActivation,
        "forbidden",
      );
      assert.equal(entry.recipes.build.missingSourceReceiptDisposition,
        "typed_precondition_rejection");
      assert.equal(entry.recipes.test.minimumTestCount, 1);
      assert.equal(entry.recipes.test.zeroTestReceipt, "forbidden");
      assert.equal(entry.recipes.test.acceptanceAuthority,
        "none_until_verified_canonical_receipt");
      assert.equal(entry.toolchain.nodeRuntime.exactHostResolution,
        "unverified_blocking");
      assert.equal(
        entry.dependencyGraph.policy.deepTarballContentBlockerCode,
        "NODE_SCAFFOLD_V2_DEPENDENCY_TARBALL_CONTENT_UNVERIFIED",
      );
      assert.equal(
        entry.dependencyGraph.policy.transitiveEngineCompatibilityBlockerCode,
        "NODE_SCAFFOLD_V2_TRANSITIVE_ENGINE_COMPATIBILITY_UNVERIFIED",
      );
    }
  });

  it("fresh-verifies only exact code-owned catalog authority", () => {
    const catalog = getCodeOwnedNodeScaffoldToolchainCatalogV2();
    assert.deepEqual(verifyNodeScaffoldToolchainCatalogV2(catalog), catalog);
    assert.equal(getCodeOwnedNodeScaffoldToolchainEntryV2(
      "PROFILE_NODE_CLI_STATELESS_EXACT_V2")?.entryHash,
    CLI_ENTRY_HASH_GOLDEN_V2);
    assert.equal(getCodeOwnedNodeScaffoldToolchainEntryV2("PROFILE_UNKNOWN"), null);

    const forged = structuredClone(catalog) as any;
    forged.entries[0].dependencyGraph.nodes[0].license = "ISC";
    forged.entries[0].dependencyGraph.nodes[0].lockEntryHash = "f".repeat(64);
    rehashCatalog(forged);
    assert.equal(NodeScaffoldToolchainCatalogV2Schema.safeParse(forged).success, true);
    assertCatalogVerificationError(
      () => verifyNodeScaffoldToolchainCatalogV2(forged),
      "NODE_SCAFFOLD_TOOLCHAIN_CATALOG_V2_AUTHORITY_MISMATCH",
    );

    const extra = structuredClone(catalog) as any;
    extra.entries[0].scaffold.files[0].owner = "setup_owner";
    assertCatalogVerificationError(
      () => verifyNodeScaffoldToolchainCatalogV2(extra),
      "NODE_SCAFFOLD_TOOLCHAIN_CATALOG_V2_CANDIDATE_INVALID",
    );
  });
});

describe("NodeScaffoldToolchainV2 product-specific resolution", () => {
  it("freshly binds every exact CLI and API scaffold token plus source token", () => {
    const cli = resolved(genuineNodeCliProductSpecV2(), "node-cli");
    const api = resolved(genuineNodeExpressApiProductSpecV2(), "node-express-api");
    assert.deepEqual(cli.resolution.fileBindings.map((binding) => ({
      role: binding.role,
      token: binding.pathToken,
      binding: binding.tokenBindingHash,
    })), [
      {
        role: "package_manifest",
        token: "af6d13622dbed9a8e23f28fa09a80479b5c30590ebfec373fd07d57c53f5353a",
        binding: "e6c4cb2b0fea2fedbf1c7738c169a139b0c184e0be531a8a1f59dfa2e4e2ee9f",
      },
      {
        role: "dependency_lock_manifest",
        token: "fed27973625e457b94ff9835d6d9a947cb6eb5df98db5373117a6fd157740121",
        binding: "e75c18ca13b790fd4104ce9f81d2e04707adf14411b01b5107b40c8b72251ac7",
      },
      {
        role: "typescript_compiler_config",
        token: "f05641251ec781cfa0e07687271f01f4f27c0b33de7a9f9ea15ed9bdfe529179",
        binding: "d7231db78aff58f02b46dd9ab5efd18646b617aa91bc1a263a115af8df41eccb",
      },
    ]);
    assert.deepEqual(cli.resolution.selectedEntrypoint, {
      pathSlotRef: "PATH_SLOT_NODE_CLI_SOURCE_ENTRYPOINT_V2",
      pathToken: "718cc34c69a78d0de1cd8a86de8df21645fa03a116d96d35496683b54ec361fd",
      tokenBindingHash: "dd4e2ac8f3fbe947d68d3a35f968e037b61de0f92b1bad54cce8a15d05f5e7fc",
      normalizedLocator: "src/cli.ts",
      requiredBaseState: "absent",
      finalOwnerRef: "NODE_ENTRYPOINT_GENERATOR_V2",
      modelWriteAuthority: "forbidden",
    });
    assert.deepEqual(api.resolution.fileBindings.map((binding) => binding.pathToken), [
      "4c23bc6c44a1af1e4e04d77c5c5915920592a48ad7e9862c34472bfb905f139f",
      "bc0fc41dd2420e5d6b84f764613a8aacd6fa4d8895aba7ff0252243a0d210975",
      "84fb9230333ef052dda3d3ffc066c50249b65724d308fb9fc67439ebadfa3b2f",
    ]);
    assert.equal(api.resolution.selectedEntrypoint.pathToken,
      "c9858ed70fadc64c5b9e0f8105a53d7a883fcbaa57ef3c1acfe4cd53cc484055");
    assertRecursivelyFrozen(cli.resolution);
    assertRecursivelyFrozen(cli.entry);
    assertRecursivelyFrozen(api.resolution);
    assertRecursivelyFrozen(api.entry);
  });

  it("maps every current semantic requirement without fixed cardinality", () => {
    const oneRoute = resolved(
      genuineNodeExpressApiProductSpecV2(),
      "node-express-api",
    );
    const twoRoute = resolved(
      twoStoryNodeExpressApiProductSpecV2(),
      "node-express-api",
    );
    assert.equal(oneRoute.resolution.semanticRequirementBindingCount, 3);
    assert.equal(twoRoute.resolution.semanticRequirementBindingCount, 4);
    for (const item of [oneRoute, twoRoute]) {
      const source = item.resolution.selectedEntrypoint;
      assert.equal(item.resolution.semanticRequirementBindings.every((binding) =>
        binding.expectationKind === "shared_structural_selected_entrypoint"
        && binding.requiredAuthority === "node_execution_path_token_v2"
        && binding.resolvedPathSlotRef === source.pathSlotRef
        && binding.resolvedPathToken === source.pathToken
        && binding.resolvedTokenBindingHash === source.tokenBindingHash
        && binding.compatibilityStatus
          === "current_v1_rule_unmigrated_v2_activation_forbidden"), true);
    }
    assert.equal(oneRoute.entry.entryHash, twoRoute.entry.entryHash);
    assert.equal(oneRoute.catalogHash, twoRoute.catalogHash);
    assert.notEqual(
      oneRoute.resolution.sourceAuthority.semanticPathTokenSetHash,
      twoRoute.resolution.sourceAuthority.semanticPathTokenSetHash,
    );
    assert.notEqual(
      oneRoute.resolution.resolutionHash,
      twoRoute.resolution.resolutionHash,
    );
  });

  it("fresh-verifies a resolution and rejects a fully rehashed omission", () => {
    const genuine = resolved(genuineNodeExpressApiProductSpecV2(),
      "node-express-api");
    const verified = verifyNodeScaffoldToolchainResolutionV2({
      productSpec: genuine.productSpec,
      deliverySelection: genuine.deliverySelection,
      candidate: genuine.resolution,
    });
    assert.equal(verified.status, "verified_shadow");
    assert.equal(verified.resolution.resolutionHash,
      genuine.resolution.resolutionHash);

    const omitted = structuredClone(genuine.resolution) as any;
    omitted.semanticRequirementBindings.pop();
    rehashResolution(omitted);
    assert.equal(NodeScaffoldToolchainResolutionV2Schema.safeParse(omitted).success,
      true);
    assertResolutionVerificationError(
      () => verifyNodeScaffoldToolchainResolutionV2({
        productSpec: genuine.productSpec,
        deliverySelection: genuine.deliverySelection,
        candidate: omitted,
      }),
      "NODE_SCAFFOLD_TOOLCHAIN_V2_VERIFICATION_AUTHORITY_MISMATCH",
    );

    const contradictoryFile = structuredClone(genuine.resolution) as any;
    contradictoryFile.fileBindings[0].pathSlotRef =
      "PATH_SLOT_NODE_TSCONFIG_JSON_V2";
    contradictoryFile.fileBindings[0].normalizedLocator = "tsconfig.json";
    rehashResolution(contradictoryFile);
    assert.equal(
      NodeScaffoldToolchainResolutionV2Schema.safeParse(contradictoryFile)
        .success,
      false,
    );

    const duplicatePathToken = structuredClone(genuine.resolution) as any;
    duplicatePathToken.fileBindings[0].pathToken =
      duplicatePathToken.fileBindings[1].pathToken;
    rehashResolution(duplicatePathToken);
    assert.equal(
      NodeScaffoldToolchainResolutionV2Schema.safeParse(duplicatePathToken)
        .success,
      false,
    );
  });

  it("rejects stale, cross-profile, and caller-expanded authority", () => {
    const cliSpec = genuineNodeCliProductSpecV2();
    const apiSpec = genuineNodeExpressApiProductSpecV2();
    const cliSelection = selectionFor(cliSpec, "node-cli");
    const apiSelection = selectionFor(apiSpec, "node-express-api");
    const cross = resolveNodeScaffoldToolchainV2({
      productSpec: cliSpec,
      deliverySelection: apiSelection,
    });
    assert.equal(cross.status, "rejected");
    assert.equal(cross.status === "rejected" && cross.diagnostics[0]?.code,
      "NODE_SCAFFOLD_TOOLCHAIN_V2_LAYOUT_REJECTED");

    const stale = structuredClone(cliSelection) as any;
    stale.profileHash = "f".repeat(64);
    const staleResult = resolveNodeScaffoldToolchainV2({
      productSpec: cliSpec,
      deliverySelection: stale,
    });
    assert.equal(staleResult.status, "rejected");
    assert.equal(staleResult.status === "rejected" && staleResult.diagnostics[0]?.code,
      "NODE_SCAFFOLD_TOOLCHAIN_V2_LAYOUT_REJECTED");

    assert.equal(resolveNodeScaffoldToolchainV2({
      productSpec: cliSpec,
      deliverySelection: cliSelection,
      callerCatalog: getCodeOwnedNodeScaffoldToolchainCatalogV2(),
    }).status, "rejected");
  });
});

describe("NodeScaffoldToolchainV2 adversarial schema and public-input bounds", () => {
  const baseCatalog = () => structuredClone(
    getCodeOwnedNodeScaffoldToolchainCatalogV2(),
  ) as any;

  it("rejects missing, unreachable, reordered, incompatible, and remote graph tamper", () => {
    const cases: any[] = [];
    const sortEdges = (graph: any) => graph.edges.sort((left: any, right: any) =>
      [
        left.ownerPackagePath,
        left.kind,
        left.dependencyName,
        left.resolvedPackagePath,
      ].join("\0").localeCompare([
        right.ownerPackagePath,
        right.kind,
        right.dependencyName,
        right.resolvedPackagePath,
      ].join("\0")));

    const missingNode = baseCatalog();
    missingNode.entries[1].dependencyGraph.nodes.pop();
    rehashCatalog(missingNode);
    cases.push(missingNode);

    const missingEdge = baseCatalog();
    const rootEdgeIndex = missingEdge.entries[1].dependencyGraph.edges
      .findIndex((edge: any) => edge.ownerPackagePath === "");
    missingEdge.entries[1].dependencyGraph.edges.splice(rootEdgeIndex, 1);
    rehashCatalog(missingEdge);
    cases.push(missingEdge);

    const reorderedEdge = baseCatalog();
    reorderedEdge.entries[1].dependencyGraph.edges.reverse();
    rehashCatalog(reorderedEdge);
    cases.push(reorderedEdge);

    const incompatible = baseCatalog();
    incompatible.entries[1].dependencyGraph.edges[0].declaredSpec = "999.0.0";
    rehashCatalog(incompatible);
    cases.push(incompatible);

    const unsupported = baseCatalog();
    unsupported.entries[1].dependencyGraph.edges[0].declaredSpec = "^1 || ^2";
    rehashCatalog(unsupported);
    cases.push(unsupported);

    const registry = baseCatalog();
    registry.entries[1].dependencyGraph.nodes[0].resolved =
      "https://example.invalid/package.tgz";
    rehashCatalog(registry);
    cases.push(registry);

    const duplicate = baseCatalog();
    duplicate.entries[1].dependencyGraph.nodes.push(
      structuredClone(duplicate.entries[1].dependencyGraph.nodes[0]),
    );
    duplicate.entries[1].dependencyGraph.nodes.sort((left: any, right: any) =>
      left.packagePath < right.packagePath ? -1 : 1);
    rehashCatalog(duplicate);
    cases.push(duplicate);

    const wrongTargetName = baseCatalog();
    const wildcardEdges = wrongTargetName.entries[1].dependencyGraph.edges
      .filter((edge: any) =>
        edge.ownerPackagePath !== "" && edge.declaredSpec === "*")
      .slice(0, 2);
    assert.equal(wildcardEdges.length, 2);
    [
      wildcardEdges[0].resolvedPackagePath,
      wildcardEdges[1].resolvedPackagePath,
    ] = [
      wildcardEdges[1].resolvedPackagePath,
      wildcardEdges[0].resolvedPackagePath,
    ];
    [wildcardEdges[0].resolvedVersion, wildcardEdges[1].resolvedVersion] = [
      wildcardEdges[1].resolvedVersion,
      wildcardEdges[0].resolvedVersion,
    ];
    sortEdges(wrongTargetName.entries[1].dependencyGraph);
    rehashCatalog(wrongTargetName);
    cases.push(wrongTargetName);

    const nonCanonicalLockPath = baseCatalog();
    const cliGraph = nonCanonicalLockPath.entries[0].dependencyGraph;
    const typescriptNode = cliGraph.nodes.find((node: any) =>
      node.packageName === "typescript");
    assert.ok(typescriptNode);
    const oldTypescriptPath = typescriptNode.packagePath;
    typescriptNode.packagePath = `${oldTypescriptPath}/extra`;
    for (const edge of cliGraph.edges) {
      if (edge.ownerPackagePath === oldTypescriptPath) {
        edge.ownerPackagePath = typescriptNode.packagePath;
      }
      if (edge.resolvedPackagePath === oldTypescriptPath) {
        edge.resolvedPackagePath = typescriptNode.packagePath;
      }
    }
    cliGraph.nodes.sort((left: any, right: any) =>
      left.packagePath.localeCompare(right.packagePath));
    sortEdges(cliGraph);
    rehashCatalog(nonCanonicalLockPath);
    cases.push(nonCanonicalLockPath);

    const nonNearest = baseCatalog();
    const apiGraph = nonNearest.entries[1].dependencyGraph;
    const bodyParserContentType = apiGraph.edges.find((edge: any) =>
      edge.ownerPackagePath === "node_modules/body-parser"
      && edge.dependencyName === "content-type");
    const typeIsContentType = apiGraph.edges.find((edge: any) =>
      edge.ownerPackagePath === "node_modules/type-is"
      && edge.dependencyName === "content-type");
    assert.ok(bodyParserContentType && typeIsContentType);
    [
      bodyParserContentType.resolvedPackagePath,
      typeIsContentType.resolvedPackagePath,
    ] = [
      typeIsContentType.resolvedPackagePath,
      bodyParserContentType.resolvedPackagePath,
    ];
    sortEdges(apiGraph);
    rehashCatalog(nonNearest);
    cases.push(nonNearest);

    const toolchainDrift = baseCatalog();
    const driftGraph = toolchainDrift.entries[0].dependencyGraph;
    const driftDependency = driftGraph.root.directDependencies.find(
      (dependency: any) => dependency.packageName === "typescript",
    );
    const driftEdge = driftGraph.edges.find((edge: any) =>
      edge.ownerPackagePath === "" && edge.dependencyName === "typescript");
    const driftNode = driftGraph.nodes.find((node: any) =>
      node.packageName === "typescript");
    assert.ok(driftDependency && driftEdge && driftNode);
    driftDependency.exactVersion = "5.9.4";
    driftEdge.declaredSpec = "5.9.4";
    driftEdge.resolvedVersion = "5.9.4";
    driftNode.version = "5.9.4";
    driftNode.lockEntryHash = "f".repeat(64);
    rehashCatalog(toolchainDrift);
    cases.push(toolchainDrift);

    for (const candidate of cases) {
      assert.equal(NodeScaffoldToolchainCatalogV2Schema.safeParse(candidate).success,
        false);
    }
  });

  it("rejects wrong file cardinality, path substitution, source claims, and activation", () => {
    const missing = baseCatalog();
    missing.entries[0].scaffold.files.pop();
    rehashCatalog(missing);
    assert.equal(NodeScaffoldToolchainCatalogV2Schema.safeParse(missing).success, false);

    const swapped = baseCatalog();
    swapped.entries[0].scaffold.files[0].normalizedLocator = "tsconfig.json";
    rehashCatalog(swapped);
    assert.equal(NodeScaffoldToolchainCatalogV2Schema.safeParse(swapped).success, false);

    const sourceClaim = baseCatalog();
    sourceClaim.entries[0].sourceGeneration.scaffoldCreatesSource = true;
    rehashCatalog(sourceClaim);
    assert.equal(NodeScaffoldToolchainCatalogV2Schema.safeParse(sourceClaim).success,
      false);

    const activation = baseCatalog();
    activation.entries[0].readiness.productionUse = "allowed";
    rehashCatalog(activation);
    assert.equal(NodeScaffoldToolchainCatalogV2Schema.safeParse(activation).success,
      false);

    const zeroTests = baseCatalog();
    zeroTests.entries[0].recipes.test.minimumTestCount = 0;
    rehashCatalog(zeroTests);
    assert.equal(NodeScaffoldToolchainCatalogV2Schema.safeParse(zeroTests).success,
      false);
  });

  it("rejects self-rehashed environment, precondition, and blocker drift", () => {
    const cases: any[] = [];

    const missingPath = baseCatalog();
    delete missingPath.entries[0].executionEnvironment
      .attemptScopedVariableBindings.PATH;
    rehashCatalog(missingPath);
    cases.push(missingPath);

    const ambientNpmConfig = baseCatalog();
    ambientNpmConfig.entries[0].executionEnvironment.npmConfigIsolation
      .ambientVariablePolicy = "allow_ambient";
    rehashCatalog(ambientNpmConfig);
    cases.push(ambientNpmConfig);

    const sharedNpmrc = baseCatalog();
    sharedNpmrc.entries[0].executionEnvironment.npmConfigIsolation.globalNpmrc
      .pathRef = "PRIVATE_STAGE_EMPTY_USER_NPMRC_V2";
    rehashCatalog(sharedNpmrc);
    cases.push(sharedNpmrc);

    const reorderedPreconditions = baseCatalog();
    reorderedPreconditions.entries[0].recipes.build.requiredPreconditions.reverse();
    rehashCatalog(reorderedPreconditions);
    cases.push(reorderedPreconditions);

    const omittedPrecondition = baseCatalog();
    omittedPrecondition.entries[0].recipes.test.requiredPreconditions.pop();
    omittedPrecondition.entries[0].recipes.test.requiredPreconditionCount -= 1;
    rehashCatalog(omittedPrecondition);
    cases.push(omittedPrecondition);

    const orphanedBlocker = baseCatalog();
    orphanedBlocker.entries[0].dependencyGraph.policy
      .deepTarballContentBlockerCode =
        "NODE_SCAFFOLD_V2_BYTE_BUNDLE_DEEP_VERIFICATION_UNVERIFIED";
    rehashCatalog(orphanedBlocker);
    cases.push(orphanedBlocker);

    for (const candidate of cases) {
      assert.equal(
        NodeScaffoldToolchainCatalogV2Schema.safeParse(candidate).success,
        false,
      );
    }
  });

  it("turns proxies, cycles, accessors, and over-limit input into typed rejection", () => {
    let trapCount = 0;
    const proxy = new Proxy({}, {
      ownKeys() {
        trapCount += 1;
        return [];
      },
      getOwnPropertyDescriptor() {
        trapCount += 1;
        return undefined;
      },
    });
    assert.equal(resolveNodeScaffoldToolchainV2(proxy).status, "rejected");
    assert.equal(trapCount, 0);

    const cycle: any = { productSpec: {} };
    cycle.deliverySelection = cycle;
    assert.equal(resolveNodeScaffoldToolchainV2(cycle).status, "rejected");

    let getterCount = 0;
    const accessor = {};
    Object.defineProperty(accessor, "productSpec", {
      enumerable: true,
      get() {
        getterCount += 1;
        return {};
      },
    });
    assert.equal(resolveNodeScaffoldToolchainV2(accessor).status, "rejected");
    assert.equal(getterCount, 0);

    const oversized = {
      productSpec: { payload: "x".repeat(8 * 1024 * 1024) },
      deliverySelection: {},
    };
    assert.equal(resolveNodeScaffoldToolchainV2(oversized).status, "rejected");
  });

  it("keeps schema-local validation separate from fresh code authority", () => {
    const catalog = getCodeOwnedNodeScaffoldToolchainCatalogV2();
    assert.equal(NodeScaffoldToolchainCatalogV2Schema.safeParse(catalog).success,
      true);
    const cli = resolved(genuineNodeCliProductSpecV2(), "node-cli");
    assert.equal(NodeScaffoldToolchainResolutionV2Schema.safeParse(
      cli.resolution,
    ).success, true);
    assert.equal(
      hashNodeScaffoldToolchainCatalogV2(catalog as NodeScaffoldToolchainCatalogV2),
      catalog.catalogHash,
    );
    assert.equal(
      hashNodeScaffoldToolchainResolutionV2(
        cli.resolution as NodeScaffoldToolchainResolutionV2,
      ),
      cli.resolution.resolutionHash,
    );
  });
});
