import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, renameSync } from "node:fs";
import {
  chmod,
  link,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  realpath,
  rename,
  rm,
  stat,
  symlink,
  unlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, afterEach, before, describe, it } from "node:test";

import ts from "typescript";

import { EVIDENCE_RECEIPT_V2_SCHEMA } from
  "../../src/evidence/schemas/evidence-receipt-v2.js";
import {
  CANDIDATE_BUILD_RECEIPT_V2_SCHEMA,
  CandidateBuildReceiptV2Schema,
} from "../../src/execution/schemas/candidate-build-receipt-v2.js";
import {
  CandidateBuildErrorV2,
  acquireCandidateBuildRuntimeBundleContextInternalV2,
  buildCandidateV2ForTest,
  settleCandidateBuildRuntimeBundleContextInternalV2,
  verifyCandidateBuildV2ForTest,
} from "../../src/execution/candidate-build-v2.js";
import {
  CandidateRuntimeBundleErrorV2,
  destroyCandidateRuntimeBundleV2,
  materializeCandidateRuntimeBundleV2ForTest,
  verifyCandidateRuntimeBundleV2ForTest,
  type CandidateRuntimeBundleAuthorityV2,
} from "../../src/execution/candidate-runtime-bundle-v2.js";
import {
  CandidateRuntimeBundleV2Schema,
} from "../../src/execution/schemas/candidate-runtime-bundle-v2.js";
import {
  compileCandidateSourceV1,
  compileCandidateSourceV1ForTest,
  revalidateVerifiedCandidateSourceAuthorityV1,
  verifyCandidateSourceV1ForTest,
} from "../../src/execution/candidate-source-v1.js";
import {
  CANDIDATE_SOURCE_RECEIPT_CONTRACT_HASH_V1,
  CandidateSourceEnvelopeV1Schema,
  CandidateSourceReceiptV1Schema,
  hashCandidateSourceReceiptV1,
} from "../../src/execution/schemas/candidate-source-receipt-v1.js";
import { createArtifactIndexForTests as createArtifactIndex } from
  "../../src/product-compiler/artifact-index.js";
import { canonicalJsonStringify, hashCanonicalJson } from
  "../../src/product-compiler/canonical-json.js";
import {
  copyPreparedArtifactStoreBatchCanonicalItemsV1,
} from "../../src/product-compiler/artifact-store-batch-plan.js";
import {
  createHybridArtifactStoreCapacityLeaseProviderV1,
} from "../../src/product-compiler/artifact-store-authority.js";
import { ContentAddressedArtifactStore } from
  "../../src/product-compiler/artifact-store.js";
import {
  copyVerifiedDeepByteBundleBytesV2,
  createDeepByteBundleCasAuthorityV2,
  verifyDeepByteBundleFromCasV2,
  type DeepByteBundleCasAuthorityV2,
  type VerifiedDeepByteBundleV2,
} from "../../src/product-compiler/deep-byte-bundle-verifier-v2.js";
import {
  createHostNodeToolchainAuthorityV2ForTest,
  type HostNodeToolchainAuthorityV2,
  type HostNodeToolchainProbeInvocationV2,
  type HostNodeToolchainProbeResultV2,
} from "../../src/product-compiler/host-node-toolchain-authority-v2.js";
import {
  FileTreeManifestVerificationErrorV2,
  compileFileTreeManifestV2,
  compileFileTreeManifestV2ForTest,
  verifyFileTreeManifestV2AtDependencyStageForTest,
  verifyFileTreeManifestV2ForTest,
} from "../../src/product-compiler/file-tree-manifest-v2.js";
import {
  FileTreeManifestVerificationErrorV3,
  compileFileTreeManifestV3,
  compileFileTreeManifestV3ForTest,
  verifyFileTreeManifestV3AtDependencyStageForTest,
  verifyFileTreeManifestV3ForTest,
} from "../../src/product-compiler/file-tree-manifest-v3.js";
import {
  BuildTopologyVerificationErrorV2,
  compileBuildTopologyV2,
  compileBuildTopologyV2ForTest,
  verifyBuildTopologyV2ForTest,
} from "../../src/product-compiler/build-topology-v2.js";
import {
  BuildTopologyVerificationErrorV3,
  compileBuildTopologyV3,
  compileBuildTopologyV3ForTest,
  verifyBuildTopologyV3ForTest,
} from "../../src/product-compiler/build-topology-v3.js";
import {
  NodeProductRuntimeSourceVerificationErrorV2,
  generateNodeProductRuntimeSourceV2,
  generateNodeProductRuntimeSourceV2ForTest,
  verifyNodeProductRuntimeSourceV2ForTest,
} from "../../src/product-compiler/node-product-runtime-generator-v2.js";
import {
  NodeProductTestSourceVerificationErrorV2,
  generateNodeProductTestSourceV2,
  generateNodeProductTestSourceV2ForTest,
  verifyNodeProductTestSourceV2ForTest,
} from "../../src/product-compiler/node-product-test-generator-v2.js";
import {
  StoryPlanVerificationErrorV3,
  compileStoryPlanV3,
  compileStoryPlanV3ForTest,
  verifyStoryPlanV3ForTest,
} from "../../src/product-compiler/story-plan-v3.js";
import {
  ImplementationSourceMapStoryProofVerificationErrorV2,
  compileImplementationSourceMapV2,
  compileImplementationSourceMapV2ForTest,
  verifyImplementationSourceMapStoryProofV2ForTest,
} from "../../src/product-compiler/implementation-source-map-v2.js";
import {
  compileProductBuildPacketV4,
  compileProductBuildPacketV4ForTest,
  verifyProductBuildPacketV4ForTest,
} from "../../src/product-compiler/product-build-packet-v4.js";
import {
  compileImplementationSliceV2,
  compileImplementationSliceV2ForTest,
  verifyImplementationSliceV2ForTest,
} from "../../src/product-compiler/slice-compiler-v2.js";
import {
  compileImplementationClosureV2,
  compileImplementationClosureV2ForTest,
  verifyImplementationClosureV2ForTest,
} from "../../src/product-compiler/implementation-closure-v2.js";
import {
  NodeProductSourcePublicationVerificationErrorV1,
  compileNodeProductSourcePublicationV1,
  compileNodeProductSourcePublicationV1ForTest,
  verifyNodeProductSourcePublicationV1ForTest,
} from "../../src/product-compiler/node-product-source-publication-v1.js";
import {
  NodeSemanticRuleGeneratorTransitionVerificationErrorV2,
  compileNodeSemanticRuleGeneratorTransitionV2,
  compileNodeSemanticRuleGeneratorTransitionV2ForTest,
  verifyNodeSemanticRuleGeneratorTransitionV2ForTest,
} from "../../src/product-compiler/node-semantic-rule-generator-transition-v2.js";
import { IndexedArtifactPublisher } from
  "../../src/product-compiler/indexed-artifact-publisher.js";
import {
  createNodeScaffoldExecutionEnvironmentV2ForTest,
  destroyNodeScaffoldExecutionEnvironmentV2,
  executeNodeScaffoldEnvironmentBuildV2,
  revalidateNodeScaffoldExecutionEnvironmentV2,
  type NodeScaffoldExecutionEnvironmentV2,
} from "../../src/product-compiler/node-scaffold-execution-environment-v2.js";
import {
  destroyNodeCandidateRuntimePrivateV2,
  materializeNodeCandidateRuntimePrivateV2ForTest,
  revalidateNodeCandidateRuntimePrivateV2,
  type MaterializedNodeCandidateRuntimePrivateV2,
} from "../../src/product-compiler/node-candidate-runtime-private-materializer-v2.js";
import {
  deriveCodeOwnedNodeScaffoldProductionClosureV2,
} from "../../src/product-compiler/node-scaffold-production-closure-v2.js";
import {
  MaterializedNodeScaffoldPrivateStageV2,
  NodeScaffoldPrivateMaterializerErrorV2,
  acquireNodeCandidateRuntimeBundleInputsInternalV2,
  destroyNodeScaffoldPrivateStageV2,
  finalizeNodeCandidateBuildOutputV2ForTest,
  getCodeOwnedPrivateStagedMaterializerAuthorityV2,
  inspectScaffoldBaseMaterializationReceiptV2,
  inspectBuildDependencyMaterializationReceiptV2,
  inspectNodeProductSourceMaterializationReceiptV1,
  isProductionNodeScaffoldPrivateStageV2,
  materializeNodeProductSourcesV1,
  materializeNodeProductSourcesV1ForTest,
  materializeNodeScaffoldPrivateStageV2,
  materializeNodeScaffoldPrivateStageV2ForTest,
  materializeNodeScaffoldDependenciesV2,
  materializeNodeScaffoldDependenciesV2ForTest,
  revalidateNodeProductSourcesV1,
  revalidateNodeCandidateBuildOutputV2,
  revalidateNodeScaffoldDependenciesV2,
  revalidateNodeScaffoldPrivateStageV2,
  settleNodeCandidateRuntimeBundleInputsInternalV2,
  type NodeProductSourceMaterializerCrashBoundaryV1,
  type NodeScaffoldPrivateMaterializerCrashBoundaryV2,
} from "../../src/product-compiler/node-scaffold-private-materializer-v2.js";
import {
  getCodeOwnedNodeScaffoldAssetPublicationV2,
  getCodeOwnedNodeScaffoldToolchainEntryV2,
  verifyCodeOwnedNodeScaffoldAssetByteBundleV2,
  type NodeScaffoldAssetRoleV2,
  type NodeScaffoldProfileIdV2,
} from "../../src/product-compiler/node-scaffold-toolchain-catalog-v2.js";
import {
  PrivateStagedMaterializerAuthorityV2Schema,
  BuildDependencyMaterializationReceiptV2Schema,
  ScaffoldBaseMaterializationReceiptV2Schema,
} from "../../src/product-compiler/schemas/node-scaffold-private-materialization-v2.js";
import {
  BUILD_TOPOLOGY_CONTRACT_HASH_V2,
  BUILD_TOPOLOGY_CONTRACT_V2,
  BuildTopologyV2Schema,
  hashBuildTopologyLogicalBuildV2,
  hashBuildTopologyManifestV2,
} from "../../src/product-compiler/schemas/build-topology-v2.js";
import {
  BUILD_TOPOLOGY_CONTRACT_HASH_V3,
  BUILD_TOPOLOGY_CONTRACT_V3,
  BuildTopologyV3Schema,
  hashBuildTopologyCommandContractV3,
  hashBuildTopologyLogicalBuildV3,
  hashBuildTopologyManifestV3,
} from "../../src/product-compiler/schemas/build-topology-v3.js";
import {
  NODE_ENTRYPOINT_GENERATOR_CONTRACT_HASH_V2,
  NODE_ENTRYPOINT_GENERATOR_CONTRACT_V2,
  NODE_SEMANTIC_RULE_GENERATOR_TRANSITION_CONTRACT_HASH_V2,
  NODE_SEMANTIC_RULE_GENERATOR_TRANSITION_CONTRACT_V2,
  NODE_SEMANTIC_RULE_GENERATOR_TRANSITION_MAX_COUNT_V2,
  NODE_SEMANTIC_RULE_GENERATOR_TRANSITION_MAX_ROUTE_COUNT_V2,
  NodeSemanticRuleGeneratorTransitionV2Schema,
  hashNodeSemanticRuleGeneratorTransitionMembershipV2,
  hashNodeSemanticRuleGeneratorTransitionV2,
} from "../../src/product-compiler/schemas/node-semantic-rule-generator-transition-v2.js";
import {
  FILE_TREE_MANIFEST_CONTRACT_HASH_V2,
  FILE_TREE_MANIFEST_CONTRACT_V2,
  FileTreeManifestV2Schema,
  hashFileTreeManifestV2,
  hashFileTreePathEntryV2,
  hashFileTreePathMembershipV2,
} from "../../src/product-compiler/schemas/file-tree-manifest-v2.js";
import {
  FILE_TREE_MANIFEST_CONTRACT_HASH_V3,
  FILE_TREE_MANIFEST_CONTRACT_V3,
  FileTreeManifestV3Schema,
  hashFileTreeManifestV3,
  hashFileTreePathEntryV3,
  hashFileTreePathMembershipV3,
  hashFileTreeRuntimeBindingMembershipV3,
  type FileTreeManifestV3,
} from "../../src/product-compiler/schemas/file-tree-manifest-v3.js";
import {
  resolveProductDeliverySelectionV2,
} from "../../src/product-compiler/product-delivery-profile-catalog-v2.js";
import {
  compileSemanticRealizationPlanV2,
} from "../../src/product-compiler/semantic-realization-plan-v2.js";
import type { ProductSpecV2 } from
  "../../src/product-compiler/schemas/product-spec-v2.js";
import { ProductSpecV2Schema } from
  "../../src/product-compiler/schemas/product-spec-v2.js";
import {
  NODE_PRODUCT_RUNTIME_PROGRAM_CONTRACT_HASH_V2,
  NodeProductRuntimeSourceReceiptV2Schema,
  hashNodeProductRuntimeGeneratedMemberMembershipV2,
  hashNodeProductRuntimeSourceLogicalReceiptV2,
  hashNodeProductRuntimeSourceReceiptV2,
} from "../../src/product-compiler/schemas/node-product-runtime-source-v2.js";
import {
  NodeProductTestSourceReceiptV2Schema,
  hashNodeProductActionTestMembershipV2,
  hashNodeProductTestSourceLogicalReceiptV2,
  hashNodeProductTestSourceReceiptV2,
} from "../../src/product-compiler/schemas/node-product-test-source-v2.js";
import {
  STORY_PLAN_CONTRACT_HASH_V3,
  StoryPlanV3Schema,
  hashProductStoryV3,
  hashStoryMembershipV3,
  hashStoryPlanV3,
} from "../../src/product-compiler/schemas/story-plan-v3.js";
import {
  IMPLEMENTATION_SOURCE_MAP_CONTRACT_HASH_V2,
  ImplementationSourceMapEnvelopeV2Schema,
  ImplementationSourceMapStoryProofV2Schema,
  hashImplementationSourceMapAuthorityV2,
  hashImplementationSourceMapManifestV2,
  hashImplementationSourceMapStoryLeafV2,
  hashImplementationSourceMapStoryProofV2,
  implementationSourceMapMerkleRootV2,
} from "../../src/product-compiler/schemas/implementation-source-map-v2.js";
import {
  PRODUCT_BUILD_PACKET_CONTRACT_HASH_V4,
  ProductBuildPacketEnvelopeV4Schema,
  hashProductBuildPacketV4,
} from "../../src/product-compiler/schemas/product-build-packet-v4.js";
import {
  IMPLEMENTATION_SLICE_CONTRACT_HASH_V2,
  ImplementationSliceEnvelopeV2Schema,
  ImplementationSliceV2Schema,
  hashImplementationSlicePacketBindingV2,
  hashImplementationSliceV2,
} from "../../src/product-compiler/schemas/implementation-slice-v2.js";
import {
  IMPLEMENTATION_CLOSURE_CONTRACT_HASH_V2,
  ImplementationClosureEnvelopeV2Schema,
  ImplementationClosureV2Schema,
  hashImplementationClosureStoryEntryV2,
  hashImplementationClosureStoryMembershipV2,
  hashImplementationClosureProductDispositionV2,
  hashImplementationClosureV2,
} from "../../src/product-compiler/schemas/implementation-closure-v2.js";
import {
  LegacyImplementationSliceV2Schema,
} from "../../src/product-compiler/schemas/implementation-slice-v2-legacy.js";
import {
  NodeProductSourcePublicationReceiptSetV1Schema,
  NodeProductSourcePublicationReceiptV1Schema,
  hashNodeProductSourcePublicationEntryCommitmentV1,
  hashNodeProductSourcePublicationReceiptSetV1,
  hashNodeProductSourcePublicationReceiptV1,
  nodeProductSourcePublicationReceiptRefV1,
} from "../../src/product-compiler/schemas/node-product-source-publication-v1.js";
import {
  NODE_PRODUCT_SOURCE_MATERIALIZER_CONTRACT_HASH_V1,
  NodeProductSourceMaterializationReceiptV1Schema,
} from "../../src/product-compiler/schemas/node-product-source-materialization-v1.js";
import {
  hashDeepByteBundleConsumerBindingV2,
} from "../../src/product-compiler/schemas/deep-byte-bundle-verification-receipt-v2.js";
import {
  createIsolatedTestDatabase,
  type TestDatabase,
} from "../execution-attempts/test-database.js";
import {
  entityFieldNodeExpressApiProductSpecV2,
  entityFieldNodeRuntimeBehaviorAuthorityV1,
  genuineNodeCliProductSpecV2,
  genuineNodeExpressApiProductSpecV2,
  nodeRuntimeBehaviorAuthorityV1,
  twoStoryNodeExpressApiProductSpecV2,
} from "./fixtures/no-design-product-semantics-v2.js";

const LIMITS = Object.freeze({
  maxPayloadBytes: 4 * 1024 * 1024,
  rootQuotaBytes: 256 * 1024 * 1024,
  minFreeBytes: 0,
});
const CLI_PROFILE = "PROFILE_NODE_CLI_STATELESS_EXACT_V2" as const;
const API_PROFILE = "PROFILE_NODE_EXPRESS_API_STATELESS_EXACT_V2" as const;
const FILE_TREE_CONTRACT_HASH_GOLDEN_V2 =
  "c882764fc3790d7a7815c0ba802d0201d76e3ff874c878e0bf13f1b9d727756c";
const FILE_TREE_CONTRACT_HASH_GOLDEN_V3 =
  "013c2b2e04985fb54896d34f84e9044a3e30dff1f1297050e8d0c741462f487a";
const BUILD_TOPOLOGY_CONTRACT_HASH_GOLDEN_V2 =
  "5ac524ec5f5c45ac3091c39c5fe959da3da970c15757196879031db55c30ef28";
const BUILD_TOPOLOGY_CONTRACT_HASH_GOLDEN_V3 =
  "409d808e65a5a2a9d974b7af5190c20309573f92f81829ab68eb2e000114c894";
const NODE_PRODUCT_RUNTIME_PROGRAM_CONTRACT_HASH_GOLDEN_V2 =
  "5443c8c68e178ec3cce5a94857918dae195848e4f33e8ec751e0154b6fc97a46";
const NODE_ENTRYPOINT_GENERATOR_CONTRACT_HASH_GOLDEN_V2 =
  "52b95411113b302c8993e8d3debc712831955cb72a8b91a0226e40941a86933a";
const NODE_RULE_GENERATOR_TRANSITION_CONTRACT_HASH_GOLDEN_V2 =
  "6ea5bb30efdd5b98229bb0ca7e13bffbbc8601eadcd7a76b362cbd2d7bc0f10a";
const NODE_SOURCE_PUBLICATION_PRODUCER_V1 = Object.freeze({
  pass: "node-product-source-publication-v1",
  codeSha: "a".repeat(64),
  toolVersions: Object.freeze({ node: "22.18.0" }),
});
const ROLES = Object.freeze([
  "package_manifest",
  "dependency_lock_manifest",
  "typescript_compiler_config",
] as const satisfies readonly NodeScaffoldAssetRoleV2[]);

type HostFixtureV2 = Readonly<{
  root: string;
  node: string;
  npmRoot: string;
  dynamicLibrary: string;
}>;

type AssetSetV2 = Readonly<{
  packageManifest: VerifiedDeepByteBundleV2;
  dependencyLockManifest: VerifiedDeepByteBundleV2;
  typescriptCompilerConfig: VerifiedDeepByteBundleV2;
}>;

type InstallControlV2 = {
  result?: HostNodeToolchainProbeResultV2;
  afterInstall?: (projectRoot: string) => Promise<void> | void;
};

type BuildControlV2 = {
  result?: HostNodeToolchainProbeResultV2;
  afterBuild?: (projectRoot: string) => Promise<void> | void;
};

const installControls = new Map<NodeScaffoldProfileIdV2, InstallControlV2>();
const installInvocations: HostNodeToolchainProbeInvocationV2[] = [];
const runtimeInstallInvocations: HostNodeToolchainProbeInvocationV2[] = [];
const buildControls = new Map<NodeScaffoldProfileIdV2, BuildControlV2>();
const buildInvocations: HostNodeToolchainProbeInvocationV2[] = [];

function exited(stdout: string, stderr = ""): HostNodeToolchainProbeResultV2 {
  return Object.freeze({
    status: "exited",
    exitCode: 0,
    signal: null,
    stdout,
    stderr,
  });
}

function nonzero(stderr: string): HostNodeToolchainProbeResultV2 {
  return Object.freeze({
    status: "exited",
    exitCode: 1,
    signal: null,
    stdout: "",
    stderr,
  });
}

function effectiveConfig(invocation: HostNodeToolchainProbeInvocationV2):
Record<string, unknown> {
  return {
    audit: true,
    ca: null,
    cache: invocation.env.NPM_CONFIG_CACHE,
    cafile: null,
    cert: null,
    color: false,
    "engine-strict": true,
    "foreground-scripts": false,
    fund: true,
    globalconfig: invocation.env.NPM_CONFIG_GLOBALCONFIG,
    "https-proxy": null,
    "ignore-scripts": false,
    key: null,
    location: "user",
    "logs-max": 0,
    noproxy: [""],
    prefix: path.dirname(path.dirname(invocation.executable)),
    proxy: null,
    registry: "https://registry.npmjs.org",
    "script-shell": null,
    shell: "sh",
    "strict-ssl": true,
    userconfig: invocation.env.NPM_CONFIG_USERCONFIG,
  };
}

async function makeHostFixture(root: string): Promise<HostFixtureV2> {
  const node = path.join(root, "bin", "node");
  const npmRoot = path.join(root, "lib", "node_modules", "npm");
  const npmCli = path.join(npmRoot, "bin", "npm-cli.js");
  const dynamicLibrary = path.join(root, "lib", "libnode.127.dylib");
  await mkdir(path.dirname(node), { recursive: true });
  await mkdir(path.dirname(npmCli), { recursive: true });
  await mkdir(path.join(npmRoot, "lib"), { recursive: true });
  await writeFile(node, "fixture-node-binary\n", { mode: 0o555 });
  await writeFile(npmCli, "require('../lib/cli.js')(process)\n", { mode: 0o555 });
  await writeFile(path.join(npmRoot, "lib", "cli.js"), "module.exports = () => {}\n", {
    mode: 0o444,
  });
  await writeFile(path.join(npmRoot, "package.json"), `${JSON.stringify({
    name: "npm",
    version: "10.9.8",
    bin: { npm: "bin/npm-cli.js" },
  })}\n`, { mode: 0o444 });
  await writeFile(dynamicLibrary, "fixture-dylib\n", { mode: 0o555 });
  await Promise.all([
    chmod(path.join(root, "bin"), 0o755),
    chmod(path.join(root, "lib"), 0o755),
    chmod(path.join(root, "lib", "node_modules"), 0o755),
    chmod(npmRoot, 0o755),
    chmod(path.join(npmRoot, "bin"), 0o755),
    chmod(path.join(npmRoot, "lib"), 0o755),
    chmod(node, 0o555),
    chmod(npmCli, 0o555),
    chmod(path.join(npmRoot, "lib", "cli.js"), 0o444),
    chmod(path.join(npmRoot, "package.json"), 0o444),
    chmod(dynamicLibrary, 0o555),
  ]);
  return { root, node, npmRoot, dynamicLibrary };
}

async function fakeNpmCiV2(
  profileId: NodeScaffoldProfileIdV2,
  projectRoot: string,
  selection: "all" | "production" = "all",
): Promise<void> {
  const entry = getCodeOwnedNodeScaffoldToolchainEntryV2(profileId)!;
  const nodes = selection === "production"
    ? deriveCodeOwnedNodeScaffoldProductionClosureV2(profileId).nodes
    : entry.dependencyGraph.nodes;
  const rootLock = JSON.parse(await readFile(path.join(projectRoot, "package-lock.json"), "utf8")) as {
    name: string;
    version: string;
    packages: Record<string, Record<string, unknown>>;
  };
  const nodeModulesRoot = path.join(projectRoot, "node_modules");
  await mkdir(nodeModulesRoot, { mode: 0o700 });
  await chmod(nodeModulesRoot, 0o700);
  const hiddenPackages: Record<string, Record<string, unknown>> = {};
  for (const node of nodes) {
    const lockEntry = rootLock.packages[node.packagePath]!;
    hiddenPackages[node.packagePath] = structuredClone(lockEntry);
    const packageRoot = path.join(projectRoot, ...node.packagePath.split("/"));
    await mkdir(packageRoot, { recursive: true, mode: 0o700 });
    const packageJson = {
      name: node.packageName,
      version: node.version,
      ...(lockEntry.bin === undefined ? {} : { bin: lockEntry.bin }),
    };
    await writeFile(path.join(packageRoot, "package.json"), `${JSON.stringify(packageJson)}\n`, {
      mode: 0o600,
    });
    const rawBin = lockEntry.bin;
    const commands: Array<readonly [string, string]> = typeof rawBin === "string"
      ? [[node.packageName.split("/").at(-1)!, rawBin] as const]
      : rawBin && typeof rawBin === "object"
        ? Object.entries(rawBin).map(([command, target]) => [command, String(target)] as const)
        : [];
    const segments = node.packagePath.split("/");
    const nodeModulesIndex = segments.lastIndexOf("node_modules");
    const container = segments.slice(0, nodeModulesIndex + 1).join("/");
    for (const [command, target] of commands) {
      const targetPath = path.join(packageRoot, ...target.split("/"));
      await mkdir(path.dirname(targetPath), { recursive: true, mode: 0o700 });
      await writeFile(targetPath, "#!/usr/bin/env node\n", { mode: 0o700 });
      await chmod(targetPath, 0o700);
      const binDirectory = path.join(projectRoot, ...container.split("/"), ".bin");
      await mkdir(binDirectory, { recursive: true, mode: 0o700 });
      const linkPath = path.join(binDirectory, command);
      const targetLocator = `${node.packagePath}/${target}`;
      const linkLocator = `${container}/.bin/${command}`;
      await symlink(path.posix.relative(path.posix.dirname(linkLocator), targetLocator), linkPath);
    }
  }
  await writeFile(path.join(nodeModulesRoot, ".package-lock.json"), `${JSON.stringify({
    name: rootLock.name,
    version: rootLock.version,
    lockfileVersion: 3,
    requires: true,
    packages: hiddenPackages,
  })}\n`, { mode: 0o600 });
}

async function fakeTypeScriptBuildV2(
  profileId: NodeScaffoldProfileIdV2,
  projectRoot: string,
): Promise<void> {
  const base = profileId === CLI_PROFILE ? "cli" : "app";
  const dist = path.join(projectRoot, "dist");
  await mkdir(dist, { mode: 0o755 });
  for (const suffix of [".ts", ".setfarm.test.ts"] as const) {
    const sourceName = `${base}${suffix}`;
    const outputName = sourceName.slice(0, -3) + ".js";
    const source = await readFile(path.join(projectRoot, "src", sourceName), "utf8");
    const emitted = ts.transpileModule(source, {
      compilerOptions: {
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.NodeNext,
        moduleResolution: ts.ModuleResolutionKind.NodeNext,
        verbatimModuleSyntax: true,
      },
      fileName: sourceName,
      reportDiagnostics: true,
    });
    assert.equal(
      emitted.diagnostics?.filter((diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error)
        .length ?? 0,
      0,
    );
    await writeFile(path.join(dist, outputName), emitted.outputText, { mode: 0o644 });
  }
}

function hostAdapter(fixture: HostFixtureV2, profileId: NodeScaffoldProfileIdV2) {
  return async (invocation: HostNodeToolchainProbeInvocationV2):
  Promise<HostNodeToolchainProbeResultV2> => {
    if (invocation.probeRef === "HOST_NODE_RUNTIME_IDENTITY_PROBE_V2") {
      return exited(`${JSON.stringify({
        version: "22.23.1",
        modulesAbi: "127",
        napiVersion: "10",
        platform: "darwin",
        architecture: "arm64",
        execPath: fixture.node,
      })}\n`);
    }
    if (invocation.probeRef === "HOST_NPM_VERSION_PROBE_V2") return exited("10.9.8\n");
    if (invocation.probeRef === "HOST_NPM_SCAFFOLD_INSTALL_V2") {
      installInvocations.push(invocation);
      const control = installControls.get(profileId);
      if (control?.result) return control.result;
      await fakeNpmCiV2(profileId, invocation.cwd);
      await control?.afterInstall?.(invocation.cwd);
      return exited(`\nadded ${getCodeOwnedNodeScaffoldToolchainEntryV2(profileId)!
        .dependencyGraph.nodeCount} packages in 1s\n`);
    }
    if (invocation.probeRef === "HOST_NPM_CANDIDATE_PRODUCTION_INSTALL_V2") {
      runtimeInstallInvocations.push(invocation);
      const closure = deriveCodeOwnedNodeScaffoldProductionClosureV2(profileId);
      await fakeNpmCiV2(profileId, invocation.cwd, "production");
      return exited(`\nadded ${closure.nodeCount} packages in 1s\n`);
    }
    if (invocation.probeRef === "HOST_NODE_PRODUCT_BUILD_V2") {
      buildInvocations.push(invocation);
      const control = buildControls.get(profileId);
      if (control?.result) return control.result;
      await fakeTypeScriptBuildV2(profileId, invocation.cwd);
      await control?.afterBuild?.(invocation.cwd);
      return exited("");
    }
    return exited(`${JSON.stringify(effectiveConfig(invocation), null, 2)}\n`);
  };
}

function deliverySelectionForV2(
  productSpec: ProductSpecV2,
  stackPackId: "node-cli" | "node-express-api",
) {
  const result = resolveProductDeliverySelectionV2({
    productSpec,
    requestedStackPackId: stackPackId,
  });
  assert.equal(
    result.status,
    "shadow_selected",
    result.status === "rejected" ? JSON.stringify(result.diagnostics) : undefined,
  );
  if (result.status !== "shadow_selected") throw new Error("Expected delivery selection");
  return result.selection;
}

function prerequisiteNodeExpressApiProductSpecV2(): ProductSpecV2 {
  const candidate: any = structuredClone(twoStoryNodeExpressApiProductSpecV2());
  const noteAction = candidate.actions.find((action: any) =>
    action.id === "ACT_CREATE_NOTE");
  if (!noteAction) throw new Error("Expected note action fixture");
  noteAction.evidenceScenario.prerequisiteSteps = [{
    actionRef: "ACT_CREATE_TASK",
    inputValues: { project: "setfarm", title: "Prerequisite task" },
  }];
  return ProductSpecV2Schema.parse(candidate);
}

function transpileGeneratedRuntimeV2(sourceText: string): string {
  const transpiled = ts.transpileModule(sourceText, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
      verbatimModuleSyntax: true,
    },
    fileName: "generated-runtime.ts",
    reportDiagnostics: true,
  });
  const errors = (transpiled.diagnostics ?? []).filter((item) =>
    item.category === ts.DiagnosticCategory.Error);
  assert.deepEqual(errors.map((item) => ts.flattenDiagnosticMessageText(
    item.messageText,
    "\n",
  )), []);
  return transpiled.outputText;
}

async function typecheckGeneratedRuntimeV2(
  sandboxRoot: string,
  sourceText: string,
  sourceBasename: "cli.ts" | "app.ts",
): Promise<void> {
  const root = path.join(sandboxRoot, `runtime-typecheck-${randomUUID()}`);
  await mkdir(root, { recursive: true, mode: 0o700 });
  const sourcePath = path.join(root, sourceBasename);
  const expressTypesPath = path.join(root, "express.d.ts");
  await Promise.all([
    writeFile(path.join(root, "package.json"), "{\"type\":\"module\"}\n", {
      mode: 0o600,
    }),
    writeFile(sourcePath, sourceText, { mode: 0o600 }),
    writeFile(expressTypesPath, [
      "declare module \"express\" {",
      "  export interface Request { method: string; originalUrl: string; url: string; body: any; }",
      "  export interface Response { status(code: number): Response; json(body: any): Response; }",
      "  export type NextFunction = (error?: unknown) => void;",
      "  export type RequestHandler = (request: Request, response: Response, next: NextFunction) => void;",
      "}",
      "",
    ].join("\n"), { mode: 0o600 }),
  ]);
  const execution = spawnSync(process.execPath, [
    path.join(process.cwd(), "node_modules", "typescript", "bin", "tsc"),
    "--noEmit",
    "--strict",
    "--target",
    "ES2022",
    "--module",
    "NodeNext",
    "--moduleResolution",
    "NodeNext",
    "--verbatimModuleSyntax",
    "--types",
    "node",
    "--typeRoots",
    path.join(process.cwd(), "node_modules", "@types"),
    sourcePath,
    expressTypesPath,
  ], {
    encoding: "utf8",
    env: {},
    timeout: 10_000,
  });
  assert.equal(
    execution.status,
    0,
    `${execution.stdout}\n${execution.stderr}`,
  );
}

async function typecheckGeneratedTestV2(
  sandboxRoot: string,
  sourceText: string,
  sourceBasename: "cli.setfarm.test.ts" | "app.setfarm.test.ts",
): Promise<void> {
  const root = path.join(sandboxRoot, `test-source-typecheck-${randomUUID()}`);
  await mkdir(root, { recursive: true, mode: 0o700 });
  const sourcePath = path.join(root, sourceBasename);
  await Promise.all([
    writeFile(path.join(root, "package.json"), "{\"type\":\"module\"}\n", {
      mode: 0o600,
    }),
    writeFile(sourcePath, sourceText, { mode: 0o600 }),
  ]);
  const execution = spawnSync(process.execPath, [
    path.join(process.cwd(), "node_modules", "typescript", "bin", "tsc"),
    "--noEmit",
    "--strict",
    "--target",
    "ES2022",
    "--module",
    "NodeNext",
    "--moduleResolution",
    "NodeNext",
    "--verbatimModuleSyntax",
    "--types",
    "node",
    "--typeRoots",
    path.join(process.cwd(), "node_modules", "@types"),
    sourcePath,
  ], {
    encoding: "utf8",
    env: {},
    timeout: 10_000,
  });
  assert.equal(
    execution.status,
    0,
    `${execution.stdout}\n${execution.stderr}`,
  );
}

function assertRecursivelyFrozen(value: unknown): void {
  if (value === null || typeof value !== "object") return;
  assert.equal(Object.isFrozen(value), true);
  Object.values(value).forEach(assertRecursivelyFrozen);
}

describe("Node scaffold private staged materializer V2", () => {
  let database: TestDatabase;
  let sandbox: string;
  let artifactRoot: string;
  let casAuthority: DeepByteBundleCasAuthorityV2;
  let sourcePublisher: IndexedArtifactPublisher;
  let hostFixture: HostFixtureV2;
  const hosts = new Map<NodeScaffoldProfileIdV2, HostNodeToolchainAuthorityV2>();
  const assetSets = new Map<NodeScaffoldProfileIdV2, AssetSetV2>();
  const activeStages: MaterializedNodeScaffoldPrivateStageV2[] = [];
  const activeEnvironments: NodeScaffoldExecutionEnvironmentV2[] = [];
  const activeRuntimeBundles: MaterializedNodeCandidateRuntimePrivateV2[] = [];
  const activeRuntimeAuthorities: CandidateRuntimeBundleAuthorityV2[] = [];

  before(async () => {
    database = await createIsolatedTestDatabase();
    sandbox = await mkdtemp(path.join(tmpdir(), "setfarm-f4-stage-v2-"));
    const index = createArtifactIndex(database.sql);
    await index.bootstrap({
      artifacts: [],
      quotaBytes: LIMITS.rootQuotaBytes,
      maxPayloadBytes: LIMITS.maxPayloadBytes,
    });
    artifactRoot = path.join(sandbox, "artifacts", "sha256");
    await mkdir(path.dirname(artifactRoot), { recursive: true });
    const writer = new ContentAddressedArtifactStore(artifactRoot, {
      limits: LIMITS,
      capacityLeaseProvider: createHybridArtifactStoreCapacityLeaseProviderV1({
        sql: database.sql,
        artifactRoot,
        purpose: "writer",
      }),
    });
    const publication = getCodeOwnedNodeScaffoldAssetPublicationV2();
    for (const batch of publication.batches) {
      const publisher = new IndexedArtifactPublisher({
        index,
        store: writer,
        ownerInstanceId: `f4-stage-v2-${randomUUID()}`,
        publicationAuthority: "hybrid-required",
      });
      await publisher.putBatch({
        batchReservationId: randomUUID(),
        plan: batch.plan,
      });
    }
    sourcePublisher = new IndexedArtifactPublisher({
      index,
      store: writer,
      ownerInstanceId: `node-source-publication-v1-${randomUUID()}`,
      publicationAuthority: "hybrid-required",
    });
    casAuthority = createDeepByteBundleCasAuthorityV2({
      sql: database.sql,
      artifactRoot,
      artifactLimits: LIMITS,
    });
    for (const profileId of [CLI_PROFILE, API_PROFILE]) {
      const handles = new Map<NodeScaffoldAssetRoleV2, VerifiedDeepByteBundleV2>();
      for (const role of ROLES) {
        handles.set(role, await verifyCodeOwnedNodeScaffoldAssetByteBundleV2({
          authority: casAuthority,
          profileId,
          role,
        }));
      }
      assetSets.set(profileId, Object.freeze({
        packageManifest: handles.get("package_manifest")!,
        dependencyLockManifest: handles.get("dependency_lock_manifest")!,
        typescriptCompilerConfig: handles.get("typescript_compiler_config")!,
      }));
    }
    const fixtureRoot = await mkdtemp(path.join(sandbox, "host-"));
    hostFixture = await makeHostFixture(fixtureRoot);
    for (const profileId of [CLI_PROFILE, API_PROFILE]) {
      hosts.set(profileId, await createHostNodeToolchainAuthorityV2ForTest({
        profileId,
        fixture: {
          candidateRoot: hostFixture.root,
          host: {
            platform: "darwin",
            architecture: "arm64",
            macosProductVersion: "26.5.2",
            macosBuildVersion: "25F84",
            darwinKernelRelease: "25.5.0",
          },
          nonSystemDynamicLibraryPaths: [hostFixture.dynamicLibrary],
        },
        probeAdapter: hostAdapter(hostFixture, profileId),
      }));
    }
  });

  afterEach(() => {
    installControls.clear();
    installInvocations.splice(0);
    runtimeInstallInvocations.splice(0);
    buildControls.clear();
    buildInvocations.splice(0);
    for (const runtimeAuthority of activeRuntimeAuthorities.splice(0)) {
      try {
        destroyCandidateRuntimeBundleV2(runtimeAuthority);
      } catch {
        // Destructive assertions may already have consumed the authority.
      }
    }
    for (const runtimeBundle of activeRuntimeBundles.splice(0)) {
      try {
        destroyNodeCandidateRuntimePrivateV2(runtimeBundle);
      } catch {
        // Destructive assertions may already have consumed the handle.
      }
    }
    for (const stage of activeStages.splice(0)) {
      try {
        destroyNodeScaffoldPrivateStageV2(stage);
      } catch {
        // A replacement-root test owns its explicit cleanup.
      }
    }
    for (const environment of activeEnvironments.splice(0)) {
      try {
        destroyNodeScaffoldExecutionEnvironmentV2(environment);
      } catch {
        // Destructive assertions may already have consumed the handle.
      }
    }
  });

  after(async () => {
    await rm(sandbox, { recursive: true, force: true });
    await database.cleanup();
  });

  async function privateParent(label: string): Promise<string> {
    const root = await mkdtemp(path.join(sandbox, `${label}-`));
    await chmod(root, 0o700);
    return realpath(root);
  }

  async function environment(profileId: NodeScaffoldProfileIdV2 = CLI_PROFILE) {
    const scratchParent = await privateParent("environment");
    const handle = await createNodeScaffoldExecutionEnvironmentV2ForTest({
      profileId,
      hostToolchain: hosts.get(profileId)!,
      scratchParent,
    });
    activeEnvironments.push(handle);
    return handle;
  }

  async function stage(input: Readonly<{
    profileId?: NodeScaffoldProfileIdV2;
    environment?: NodeScaffoldExecutionEnvironmentV2;
    stageParent?: string;
    assets?: AssetSetV2;
  }> = {}) {
    const profileId = input.profileId ?? CLI_PROFILE;
    const environmentHandle = input.environment ?? await environment(profileId);
    const stageParent = input.stageParent ?? await privateParent("stage");
    const handle = await materializeNodeScaffoldPrivateStageV2ForTest({
      environment: environmentHandle,
      scratchParent: stageParent,
      ...(input.assets ?? assetSets.get(profileId)!),
    });
    activeStages.push(handle);
    return { handle, environmentHandle, stageParent };
  }

  async function onlyAttemptRoot(parent: string): Promise<string> {
    const names = await readdir(parent);
    assert.equal(names.length, 1);
    return path.join(parent, names[0]!);
  }

  async function preparePublishedNodeSourcesV1(
    handle: MaterializedNodeScaffoldPrivateStageV2,
    publicationMode: "complete" | "without_publication_receipt" = "complete",
    profileId: NodeScaffoldProfileIdV2 = CLI_PROFILE,
  ) {
    const productSpec = profileId === CLI_PROFILE
      ? genuineNodeCliProductSpecV2()
      : genuineNodeExpressApiProductSpecV2();
    const deliverySelection = deliverySelectionForV2(
      productSpec,
      profileId === CLI_PROFILE ? "node-cli" : "node-express-api",
    );
    const authorityInput = {
      productSpec,
      deliverySelection,
      ...nodeRuntimeBehaviorAuthorityV1(productSpec),
    };
    const realizationPlan = compileSemanticRealizationPlanV2(authorityInput);
    assert.equal(realizationPlan.status, "shadow_compiled");
    if (realizationPlan.status !== "shadow_compiled") {
      throw new Error("Expected source-materializer realization plan");
    }
    const fileTree = await compileFileTreeManifestV3ForTest(
      handle,
      authorityInput,
    );
    assert.equal(fileTree.status, "shadow_compiled");
    if (fileTree.status !== "shadow_compiled") {
      throw new Error("Expected source-materializer FileTreeV3");
    }
    await materializeNodeScaffoldDependenciesV2ForTest(handle);
    const buildTopology = await compileBuildTopologyV3ForTest(handle, {
      ...authorityInput,
      fileTree: fileTree.value,
    });
    assert.equal(buildTopology.status, "shadow_compiled");
    if (buildTopology.status !== "shadow_compiled") {
      throw new Error("Expected source-materializer BuildTopologyV3");
    }
    const compilerInput = {
      producer: NODE_SOURCE_PUBLICATION_PRODUCER_V1,
      ...authorityInput,
      realizationPlan: realizationPlan.value,
      fileTree: fileTree.value,
      buildTopology: buildTopology.value,
    };
    const publication = await compileNodeProductSourcePublicationV1ForTest(
      handle,
      compilerInput,
    );
    assert.equal(publication.status, "shadow_prepared");
    if (publication.status !== "shadow_prepared") {
      throw new Error("Expected prepared source publication");
    }
    for (const source of publication.publications) {
      const plan = publicationMode === "complete"
        ? source.publicationPlan
        : {
            schema: source.publicationPlan.schema,
            items: source.publicationPlan.items.filter((item) =>
              item.durabilityTier !== 3),
          };
      await sourcePublisher.putBatch({
        batchReservationId: randomUUID(),
        plan,
      });
    }
    return Object.freeze({
      compilerInput,
      candidatePublications: publication.publications.map((source) => ({
        sourceRole: source.sourceRole,
        envelopes: [...source.publicationEnvelopes].reverse(),
      })),
    });
  }

  it("materializes three authenticated assets into one pathless, replayable base receipt", async () => {
    const created = await stage();
    const receipt = inspectScaffoldBaseMaterializationReceiptV2(created.handle);
    assert.equal(receipt.status, "scaffold_base_materialized_verified");
    assert.equal(receipt.admissionScope, "test_fixture");
    assert.equal(isProductionNodeScaffoldPrivateStageV2(created.handle), false);
    assert.deepEqual(receipt.assets.map((asset) => [asset.role, asset.normalizedLocator]), [
      ["dependency_lock_manifest", "package-lock.json"],
      ["package_manifest", "package.json"],
      ["typescript_compiler_config", "tsconfig.json"],
    ]);
    assert.equal(receipt.baseState.fileCount, 3);
    assert.equal(receipt.baseState.projectNpmrc.state, "absent");
    assert.equal(receipt.baseState.dependencyInstallation.state, "absent");
    assert.equal(receipt.baseState.sourceEntrypoint.state, "absent");
    assert.equal(
      ScaffoldBaseMaterializationReceiptV2Schema.parse(receipt).receiptHash,
      receipt.receiptHash,
    );
    const authority = getCodeOwnedPrivateStagedMaterializerAuthorityV2();
    assert.equal(authority.activation, "dependency_materialization_verified_file_tree_blocked");
    assert.equal(
      PrivateStagedMaterializerAuthorityV2Schema.parse(authority).authorityHash,
      receipt.materializerAuthority.authorityHash,
    );
    assert.doesNotMatch(
      JSON.stringify(receipt),
      /setfarm-f4-stage-v2|\/private\/|\/var\/folders|\/Users\//,
    );

    const attemptRoot = await onlyAttemptRoot(created.stageParent);
    assert.deepEqual(await readdir(attemptRoot), ["dependency-capsule", "project"]);
    assert.deepEqual(await readdir(path.join(attemptRoot, "project")), [
      "package-lock.json",
      "package.json",
      "tsconfig.json",
    ]);
    for (const asset of receipt.assets) {
      const file = path.join(attemptRoot, "project", asset.normalizedLocator);
      assert.equal((await stat(file)).mode & 0o7777, 0o444);
      assert.equal((await readFile(file)).byteLength, asset.rawByteLength);
    }
    assert.equal(
      (await revalidateNodeScaffoldPrivateStageV2(created.handle)).receiptHash,
      receipt.receiptHash,
    );
    destroyNodeScaffoldPrivateStageV2(created.handle);
    assert.equal(existsSync(attemptRoot), false);
    destroyNodeScaffoldPrivateStageV2(created.handle);
    await assert.rejects(revalidateNodeScaffoldPrivateStageV2(created.handle), {
      code: "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_DESTROYED",
    });
  });

  it("materializes every-and-only locked dependency into a pathless read-only capsule", async () => {
    for (const profileId of [CLI_PROFILE, API_PROFILE]) {
      const created = await stage({ profileId });
      const receipt = await materializeNodeScaffoldDependenciesV2ForTest(created.handle);
      const entry = getCodeOwnedNodeScaffoldToolchainEntryV2(profileId)!;
      assert.equal(receipt.status, "dependencies_materialized_verified");
      assert.equal(receipt.admissionScope, "test_fixture");
      assert.equal(receipt.lockGraph.graphHash, entry.dependencyGraph.graphHash);
      assert.equal(receipt.lockGraph.expectedNodeCount, entry.dependencyGraph.nodeCount);
      assert.equal(receipt.lockGraph.installedPackageCount, entry.dependencyGraph.nodeCount);
      assert.equal(receipt.lockGraph.expectedEdgeCount, entry.dependencyGraph.edgeCount);
      assert.equal(receipt.lockGraph.graphDisposition, "every_and_only_verified");
      assert.equal(receipt.lifecycleAndEnginePolicy.engineStrict, true);
      assert.match(receipt.installExecution.projectScopeHash, /^[a-f0-9]{64}$/u);
      assert.equal(
        receipt.lifecycleAndEnginePolicy.compatibilityDisposition,
        "npm_engine_strict_exit_zero",
      );
      assert.equal(receipt.rawInstallTree.symbolicLinkCount, receipt.installedBins.count);
      assert.equal(receipt.dependencyCapsule.profile, "dependencies");
      assert.equal(receipt.dependencyCapsule.rootMode, "0555");
      assert.equal(
        receipt.dependencyCapsuleAuthority.metadataProbe,
        "test_fixture_clear_probe",
      );
      assert.equal(receipt.dependencyCapsuleAuthority.metadataNormalization,
        "test_fixture_none");
      assert.equal(receipt.dependencyCapsuleAuthority.hostMetadataExclusion,
        "test_fixture_none");
      assert.equal(
        receipt.dependencyCapsule.entries.some((candidate) =>
          candidate.path === ".bin" || candidate.path.startsWith(".bin/")),
        false,
      );
      assert.equal(
        BuildDependencyMaterializationReceiptV2Schema.parse(receipt).receiptHash,
        receipt.receiptHash,
      );
      assert.equal(
        inspectBuildDependencyMaterializationReceiptV2(created.handle).receiptHash,
        receipt.receiptHash,
      );
      assert.equal(
        (await revalidateNodeScaffoldDependenciesV2(created.handle)).receiptHash,
        receipt.receiptHash,
      );
      assert.doesNotMatch(
        JSON.stringify(receipt),
        /setfarm-f4-stage-v2|\/private\/|\/var\/folders|\/Users\//,
      );
      await assert.rejects(revalidateNodeScaffoldPrivateStageV2(created.handle), {
        code: "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_INSTALL_ALREADY_CONSUMED",
      });
      await assert.rejects(materializeNodeScaffoldDependenciesV2ForTest(created.handle), {
        code: "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_INSTALL_ALREADY_CONSUMED",
      });
      await assert.rejects(materializeNodeScaffoldDependenciesV2(created.handle), {
        code: "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_PRODUCTION_AUTHORITY_REQUIRED",
      });
      const invocation = installInvocations.at(-1)!;
      assert.deepEqual(invocation.argv.slice(1), [
        "ci",
        "--include=dev",
        "--ignore-scripts",
        "--no-audit",
        "--no-fund",
      ]);
      assert.equal(invocation.shell, false);
      assert.equal(invocation.timeoutMs, 120_000);
      assert.equal(invocation.maxStdoutBytes, 65_536);
      assert.equal(invocation.maxStderrBytes, 65_536);
      assert.equal(invocation.env.NPM_CONFIG_ENGINE_STRICT, "true");
      assert.equal(invocation.env.NODE_OPTIONS, undefined);
    }
  });

  it("derives and freshly verifies exact CLI/API scaffold-base FileTreeV2 authority", async () => {
    const cases = [
      {
        profileId: CLI_PROFILE,
        stackPackId: "node-cli" as const,
        productSpec: genuineNodeCliProductSpecV2(),
        semanticPathCount: 7,
        semanticIntentCount: 7,
        externalRequirementCount: 3,
        historicalPathCount: 1,
        totalPathCount: 13,
        ownerCount: 3,
        manifestHash: "701124755e7d699c7e7253335f42cb76acb912f4612e7d78d9740adb705523ce",
      },
      {
        profileId: API_PROFILE,
        stackPackId: "node-express-api" as const,
        productSpec: genuineNodeExpressApiProductSpecV2(),
        semanticPathCount: 8,
        semanticIntentCount: 8,
        externalRequirementCount: 3,
        historicalPathCount: 2,
        totalPathCount: 15,
        ownerCount: 3,
        manifestHash: "c5732d5837f119cf9422c567c9b5e3900e62afc2cf050a4edc3ab6e72afe2159",
      },
      {
        profileId: API_PROFILE,
        stackPackId: "node-express-api" as const,
        productSpec: twoStoryNodeExpressApiProductSpecV2(),
        semanticPathCount: 15,
        semanticIntentCount: 16,
        externalRequirementCount: 4,
        historicalPathCount: 2,
        totalPathCount: 22,
        ownerCount: 4,
        manifestHash: "2bfe379185522947a908803b4a99794852bdd2e31930d0f60049b85850276dee",
      },
    ];
    for (const fixture of cases) {
      const created = await stage({ profileId: fixture.profileId });
      const deliverySelection = deliverySelectionForV2(
        fixture.productSpec,
        fixture.stackPackId,
      );
      const input = {
        productSpec: fixture.productSpec,
        deliverySelection,
      };
      const compiled = await compileFileTreeManifestV2ForTest(created.handle, input);
      assert.equal(
        compiled.status,
        "shadow_compiled",
        compiled.status === "rejected"
          ? JSON.stringify(compiled.diagnostics)
          : undefined,
      );
      if (compiled.status !== "shadow_compiled") throw new Error("Expected FileTreeV2");
      const manifest = compiled.value;
      assert.equal(FILE_TREE_MANIFEST_CONTRACT_HASH_V2,
        FILE_TREE_CONTRACT_HASH_GOLDEN_V2);
      assert.equal(Object.isFrozen(FILE_TREE_MANIFEST_CONTRACT_V2), true);
      assert.equal(manifest.contractHash, FILE_TREE_CONTRACT_HASH_GOLDEN_V2);
      assert.equal(manifest.manifestHash, fixture.manifestHash);
      assert.equal(Object.hasOwn(manifest.authority, "admissionScope"), false);
      assert.equal(manifest.authority.profileId, fixture.profileId);
      assert.equal(manifest.authority.stackPackId, fixture.stackPackId);
      assert.equal(manifest.pathCount, fixture.totalPathCount);
      assert.equal(manifest.paths.filter((entry) =>
        entry.classification === "config").length, 3);
      assert.equal(manifest.paths.filter((entry) =>
        entry.classification === "source").length, fixture.semanticPathCount);
      assert.equal(manifest.paths.filter((entry) =>
        entry.classification === "compatibility_rejected").length,
      fixture.historicalPathCount);
      assert.equal(manifest.semanticCoverage.semanticTokenIntentCount,
        fixture.semanticIntentCount);
      assert.equal(manifest.semanticCoverage.externalRequirementIntentCount,
        fixture.externalRequirementCount);
      assert.equal(manifest.ownerCount, fixture.ownerCount);
      assert.equal(manifest.stage, "scaffold_base_ready");
      assert.equal(manifest.authority.projectInventory.nodeModulesState, "absent");
      assert.equal(JSON.stringify(manifest.paths).includes('"build_output"'), false);
      assert.equal(manifest.paths.find((entry) =>
        entry.classification === "entrypoint_generated")?.access,
      "generator_whole_file_future");
      assert.equal(manifest.paths.find((entry) =>
        entry.normalizedLocator === ".npmrc")?.currentState.state, "absent");
      assert.doesNotMatch(
        JSON.stringify(manifest),
        /admissionScope|privateRootIdentityHash|physicalIdentityHash|scaffoldBaseReceiptHash|executionEnvironmentReceiptHash/,
      );
      assert.doesNotMatch(
        JSON.stringify(manifest),
        /setfarm-f4-stage-v2|\/private\/|\/var\/folders|\/Users\//,
      );
      if (fixture.semanticIntentCount > fixture.semanticPathCount) {
        const aggregate = manifest.paths.find((entry) =>
          entry.authority.kind === "semantic_source_path"
          && entry.authority.materialization.kind === "shared_catalog_aggregate");
        assert.equal(aggregate?.authority.kind, "semantic_source_path");
        if (aggregate?.authority.kind !== "semantic_source_path") {
          throw new Error("Expected shared semantic aggregate");
        }
        assert.equal(aggregate.authority.intentBindingCount, 2);
        assert.equal(aggregate.writeGrantOwnerRefs.length, 2);
      }
      assert.equal(FileTreeManifestV2Schema.safeParse(manifest).success, true);
      assert.equal(compiled.canonicalBytes, canonicalJsonStringify(manifest));
      assertRecursivelyFrozen(compiled);

      const verified = await verifyFileTreeManifestV2ForTest(created.handle, {
        ...input,
        candidate: manifest,
      });
      assert.equal(verified.value.manifestHash, manifest.manifestHash);
      assertRecursivelyFrozen(verified);

      const wrongScope = await compileFileTreeManifestV2(created.handle, input);
      assert.equal(wrongScope.status, "rejected");
      assert.equal(wrongScope.diagnostics[0]?.code,
        "FILE_TREE_V2_PRODUCTION_AUTHORITY_REQUIRED");

      const selfRehashed = structuredClone(manifest) as any;
      selfRehashed.authority.nodePathTokenSetHash = "f".repeat(64);
      selfRehashed.manifestHash = hashFileTreeManifestV2(selfRehashed);
      assert.equal(FileTreeManifestV2Schema.safeParse(selfRehashed).success, true);
      await assert.rejects(
        verifyFileTreeManifestV2ForTest(created.handle, {
          ...input,
          candidate: selfRehashed,
        }),
        (error: unknown) =>
          error instanceof FileTreeManifestVerificationErrorV2
          && error.code === "FILE_TREE_V2_VERIFICATION_AUTHORITY_MISMATCH",
      );

      const forgedOwnership = structuredClone(manifest) as any;
      const exclusive = forgedOwnership.paths.find((entry: any) =>
        entry.authority.kind === "semantic_source_path"
        && entry.authority.materialization.kind === "exclusive_file");
      assert.ok(exclusive);
      exclusive.ownerRef = "OWNER_SETUP_V2";
      exclusive.entryHash = hashFileTreePathEntryV2(exclusive);
      forgedOwnership.pathMembershipHash = hashFileTreePathMembershipV2(
        forgedOwnership.paths,
      );
      forgedOwnership.manifestHash = hashFileTreeManifestV2(forgedOwnership);
      assert.equal(FileTreeManifestV2Schema.safeParse(forgedOwnership).success, false);

      if (fixture.profileId === CLI_PROFILE) {
        const sibling = await stage({ profileId: CLI_PROFILE });
        const siblingCompiled = await compileFileTreeManifestV2ForTest(
          sibling.handle,
          input,
        );
        assert.equal(siblingCompiled.status, "shadow_compiled");
        if (siblingCompiled.status !== "shadow_compiled") {
          throw new Error("Expected stable sibling FileTreeV2");
        }
        const firstBase = inspectScaffoldBaseMaterializationReceiptV2(created.handle);
        const siblingBase = inspectScaffoldBaseMaterializationReceiptV2(sibling.handle);
        assert.notEqual(firstBase.receiptHash, siblingBase.receiptHash);
        assert.equal(firstBase.semanticInputHash, siblingBase.semanticInputHash);
        assert.equal(manifest.manifestHash, siblingCompiled.value.manifestHash);
        assert.equal(compiled.canonicalBytes, siblingCompiled.canonicalBytes);

        const upstreamRejected = await compileFileTreeManifestV2ForTest(
          created.handle,
          { productSpec: {}, deliverySelection },
        );
        assert.equal(upstreamRejected.status, "rejected");
        assert.equal(upstreamRejected.diagnostics[0]?.code,
          "FILE_TREE_V2_UPSTREAM_AUTHORITY_REJECTED");

        let getterInvoked = false;
        const accessorInput = Object.defineProperty({ deliverySelection }, "productSpec", {
          enumerable: true,
          get() {
            getterInvoked = true;
            return fixture.productSpec;
          },
        });
        const accessorRejected = await compileFileTreeManifestV2ForTest(
          created.handle,
          accessorInput,
        );
        assert.equal(accessorRejected.status, "rejected");
        assert.equal(accessorRejected.diagnostics[0]?.code, "FILE_TREE_V2_INPUT_INVALID");
        assert.equal(getterInvoked, false);

        const attemptRoot = await onlyAttemptRoot(created.stageParent);
        await chmod(path.join(
          attemptRoot,
          "project",
          "package.json",
        ), 0o666);
        const driftRejected = await compileFileTreeManifestV2ForTest(
          created.handle,
          input,
        );
        assert.equal(driftRejected.status, "rejected");
        assert.equal(driftRejected.diagnostics[0]?.code,
          "FILE_TREE_V2_PRIVATE_STAGE_INVALID");
      }
    }
  });

  it("derives exact six-path FileTreeV3 realization authority for three product fixtures", async () => {
    const cases = [
      {
        profileId: CLI_PROFILE,
        stackPackId: "node-cli" as const,
        productSpec: genuineNodeCliProductSpecV2(),
        runtimeLocator: "src/cli.ts",
        testLocator: "src/cli.setfarm.test.ts",
        runtimeRealizationCount: 10,
        actionCount: 1,
        evidenceRelationCount: 2,
        testCoverageCount: 3,
      },
      {
        profileId: API_PROFILE,
        stackPackId: "node-express-api" as const,
        productSpec: genuineNodeExpressApiProductSpecV2(),
        runtimeLocator: "src/app.ts",
        testLocator: "src/app.setfarm.test.ts",
        runtimeRealizationCount: 11,
        actionCount: 1,
        evidenceRelationCount: 2,
        testCoverageCount: 3,
      },
      {
        profileId: API_PROFILE,
        stackPackId: "node-express-api" as const,
        productSpec: twoStoryNodeExpressApiProductSpecV2(),
        runtimeLocator: "src/app.ts",
        testLocator: "src/app.setfarm.test.ts",
        runtimeRealizationCount: 20,
        actionCount: 2,
        evidenceRelationCount: 4,
        testCoverageCount: 6,
      },
    ];
    const manifests = new Map<string, Readonly<FileTreeManifestV3>>();
    const manifestHashes: string[] = [];

    for (const [caseIndex, fixture] of cases.entries()) {
      const created = await stage({ profileId: fixture.profileId });
      const deliverySelection = deliverySelectionForV2(
        fixture.productSpec,
        fixture.stackPackId,
      );
      const input = {
        productSpec: fixture.productSpec,
        deliverySelection,
        ...nodeRuntimeBehaviorAuthorityV1(fixture.productSpec),
      };
      const compiled = await compileFileTreeManifestV3ForTest(created.handle, input);
      assert.equal(
        compiled.status,
        "shadow_compiled",
        compiled.status === "rejected"
          ? JSON.stringify(compiled.diagnostics)
          : undefined,
      );
      if (compiled.status !== "shadow_compiled") throw new Error("Expected FileTreeV3");
      const manifest = compiled.value;
      manifests.set(caseIndex === 0 ? "cli" : caseIndex === 1 ? "api" : "api-two",
        manifest);
      manifestHashes.push(manifest.manifestHash);

      assert.equal(FILE_TREE_MANIFEST_CONTRACT_HASH_V3,
        FILE_TREE_CONTRACT_HASH_GOLDEN_V3);
      assert.equal(Object.isFrozen(FILE_TREE_MANIFEST_CONTRACT_V3), true);
      assert.equal(manifest.contractHash, FILE_TREE_CONTRACT_HASH_GOLDEN_V3);
      assert.equal(manifest.authority.profileId, fixture.profileId);
      assert.equal(manifest.authority.stackPackId, fixture.stackPackId);
      assert.equal(
        manifest.authority.semanticRealizationPlan.runtimeBehaviorProposalHash,
        input.runtimeBehaviorContract.authority.proposalHash,
      );
      assert.equal(
        manifest.authority.semanticRealizationPlan.runtimeBehaviorContractHash,
        input.runtimeBehaviorContract.contractHash,
      );
      assert.equal(manifest.pathCount, 6);
      assert.equal(manifest.ownerCount, 3);
      assert.deepEqual(manifest.owners.map((owner) => owner.ownerRef), [
        "OWNER_NODE_PRODUCT_RUNTIME_GENERATOR_V2",
        "OWNER_NODE_PRODUCT_TEST_GENERATOR_V2",
        "OWNER_SETUP_V3",
      ]);
      assert.deepEqual(
        manifest.paths.map((entry) => entry.classification).sort(),
        [
          "config",
          "config",
          "config",
          "config_absence",
          "generated_runtime_source",
          "generated_test_source",
        ],
      );
      assert.equal(manifest.paths.every((entry) =>
        entry.writeGrantOwnerRefs.length === 0), true);
      assert.equal(manifest.coverage.modelWriteGrantCount, 0);
      assert.equal(manifest.coverage.storyOwnerCount, 0);
      assert.equal(manifest.coverage.runtimeRealizationCount,
        fixture.runtimeRealizationCount);
      assert.equal(manifest.coverage.actionCount, fixture.actionCount);
      assert.equal(manifest.coverage.evidenceRelationCount,
        fixture.evidenceRelationCount);
      assert.equal(manifest.coverage.testCoverageCount,
        fixture.testCoverageCount);

      const runtimeEntry = manifest.paths.find((entry) =>
        entry.authority.kind === "generated_runtime_source_target");
      assert.equal(runtimeEntry?.normalizedLocator, fixture.runtimeLocator);
      assert.equal(runtimeEntry?.authority.kind, "generated_runtime_source_target");
      if (runtimeEntry?.authority.kind !== "generated_runtime_source_target") {
        throw new Error("Expected generated runtime source target");
      }
      assert.equal(runtimeEntry.authority.realizationBindingCount,
        fixture.runtimeRealizationCount);
      assert.equal(runtimeEntry.authority.realizationBindings.length,
        fixture.runtimeRealizationCount);

      const testEntry = manifest.paths.find((entry) =>
        entry.authority.kind === "generated_test_source_target");
      assert.equal(testEntry?.normalizedLocator, fixture.testLocator);
      assert.equal(testEntry?.authority.kind, "generated_test_source_target");
      if (testEntry?.authority.kind !== "generated_test_source_target") {
        throw new Error("Expected generated test source target");
      }
      assert.equal(testEntry.authority.coverageBindingCount,
        fixture.testCoverageCount);
      assert.equal(testEntry.authority.coverageBindings.filter((binding) =>
        binding.coverageKind === "action").length, fixture.actionCount);
      assert.equal(testEntry.authority.coverageBindings.filter((binding) =>
        binding.coverageKind === "evidence_relation").length,
      fixture.evidenceRelationCount);

      const serialized = JSON.stringify(manifest);
      assert.doesNotMatch(serialized,
        /semanticPathTokenSetHash|model_owned_writable|model_granted_writable/);
      assert.doesNotMatch(serialized,
        /OWNER_STORY_|NODE_ENTRYPOINT_GENERATOR_V2|story_write_grants/);
      assert.doesNotMatch(serialized,
        /admissionScope|privateRootIdentityHash|physicalIdentityHash|scaffoldBaseReceiptHash|executionEnvironmentReceiptHash/);
      assert.doesNotMatch(serialized,
        /setfarm-f4-stage-v2|\/private\/|\/var\/folders|\/Users\//);
      assert.equal(FileTreeManifestV3Schema.safeParse(manifest).success, true);
      assert.equal(compiled.canonicalBytes, canonicalJsonStringify(manifest));
      assertRecursivelyFrozen(compiled);

      const verified = await verifyFileTreeManifestV3ForTest(created.handle, {
        ...input,
        candidate: manifest,
      });
      assert.equal(verified.value.manifestHash, manifest.manifestHash);
      assertRecursivelyFrozen(verified);

      const wrongScope = await compileFileTreeManifestV3(created.handle, input);
      assert.equal(wrongScope.status, "rejected");
      assert.equal(wrongScope.diagnostics[0]?.code,
        "FILE_TREE_V3_PRODUCTION_AUTHORITY_REQUIRED");

      const omittedRuntimeBinding = structuredClone(manifest) as any;
      const omittedRuntimeEntry = omittedRuntimeBinding.paths.find((entry: any) =>
        entry.authority.kind === "generated_runtime_source_target");
      omittedRuntimeEntry.authority.realizationBindings.pop();
      omittedRuntimeEntry.authority.realizationBindingCount =
        omittedRuntimeEntry.authority.realizationBindings.length;
      omittedRuntimeEntry.authority.realizationBindingMembershipHash =
        hashFileTreeRuntimeBindingMembershipV3(
          omittedRuntimeEntry.authority.realizationBindings,
        );
      omittedRuntimeBinding.coverage.runtimeRealizationCount =
        omittedRuntimeEntry.authority.realizationBindingCount;
      omittedRuntimeBinding.coverage.runtimeRealizationMembershipHash =
        omittedRuntimeEntry.authority.realizationBindingMembershipHash;
      omittedRuntimeBinding.authority.semanticRealizationPlan.generatorMemberCount =
        omittedRuntimeEntry.authority.realizationBindingCount;
      omittedRuntimeEntry.entryHash = hashFileTreePathEntryV3(omittedRuntimeEntry);
      omittedRuntimeBinding.pathMembershipHash = hashFileTreePathMembershipV3(
        omittedRuntimeBinding.paths,
      );
      omittedRuntimeBinding.manifestHash =
        hashFileTreeManifestV3(omittedRuntimeBinding);
      assert.equal(
        FileTreeManifestV3Schema.safeParse(omittedRuntimeBinding).success,
        true,
      );
      await assert.rejects(
        verifyFileTreeManifestV3ForTest(created.handle, {
          ...input,
          candidate: omittedRuntimeBinding,
        }),
        (error: unknown) =>
          error instanceof FileTreeManifestVerificationErrorV3
          && error.code === "FILE_TREE_V3_VERIFICATION_AUTHORITY_MISMATCH",
      );

      if (caseIndex === 0) {
        const forgedBehavior = structuredClone(manifest) as any;
        forgedBehavior.authority.semanticRealizationPlan
          .runtimeBehaviorContractHash = "f".repeat(64);
        forgedBehavior.manifestHash = hashFileTreeManifestV3(forgedBehavior);
        assert.equal(
          FileTreeManifestV3Schema.safeParse(forgedBehavior).success,
          true,
        );
        await assert.rejects(
          verifyFileTreeManifestV3ForTest(created.handle, {
            ...input,
            candidate: forgedBehavior,
          }),
          (error: unknown) =>
            error instanceof FileTreeManifestVerificationErrorV3
            && error.code === "FILE_TREE_V3_VERIFICATION_AUTHORITY_MISMATCH",
        );

        const sibling = await stage({ profileId: CLI_PROFILE });
        const siblingCompiled = await compileFileTreeManifestV3ForTest(
          sibling.handle,
          input,
        );
        assert.equal(siblingCompiled.status, "shadow_compiled");
        if (siblingCompiled.status !== "shadow_compiled") {
          throw new Error("Expected stable sibling FileTreeV3");
        }
        const firstBase = inspectScaffoldBaseMaterializationReceiptV2(created.handle);
        const siblingBase = inspectScaffoldBaseMaterializationReceiptV2(sibling.handle);
        assert.notEqual(firstBase.receiptHash, siblingBase.receiptHash);
        assert.equal(firstBase.semanticInputHash, siblingBase.semanticInputHash);
        assert.equal(manifest.manifestHash, siblingCompiled.value.manifestHash);
        assert.equal(compiled.canonicalBytes, siblingCompiled.canonicalBytes);

        const extraInput = await compileFileTreeManifestV3ForTest(created.handle, {
          ...input,
          unexpected: true,
        });
        assert.equal(extraInput.status, "rejected");
        assert.equal(extraInput.diagnostics[0]?.code, "FILE_TREE_V3_INPUT_INVALID");

        let getterInvoked = false;
        const accessorInput = Object.defineProperty(
          { deliverySelection },
          "productSpec",
          {
            enumerable: true,
            get() {
              getterInvoked = true;
              return fixture.productSpec;
            },
          },
        );
        const accessorRejected = await compileFileTreeManifestV3ForTest(
          created.handle,
          accessorInput,
        );
        assert.equal(accessorRejected.status, "rejected");
        assert.equal(accessorRejected.diagnostics[0]?.code,
          "FILE_TREE_V3_INPUT_INVALID");
        assert.equal(getterInvoked, false);

        const proxyInput = new Proxy(input, {
          ownKeys() {
            throw new Error("proxy ownKeys trap");
          },
        });
        const proxyRejected = await compileFileTreeManifestV3ForTest(
          created.handle,
          proxyInput,
        );
        assert.equal(proxyRejected.status, "rejected");
        assert.equal(proxyRejected.diagnostics[0]?.code,
          "FILE_TREE_V3_INPUT_INVALID");

        await materializeNodeScaffoldDependenciesV2ForTest(created.handle);
        const dependencyVerified =
          await verifyFileTreeManifestV3AtDependencyStageForTest(created.handle, {
            ...input,
            candidate: manifest,
          });
        assert.equal(dependencyVerified.value.manifestHash, manifest.manifestHash);
        assertRecursivelyFrozen(dependencyVerified);
      }
    }

    assert.deepEqual(manifestHashes, [
      "a736734317268c34e9b5634c1b7f1f0ac93211aa2cfcd881a50d3d382e36e7a7",
      "90a9ebadceadeed285e5876cc6d5a6d6723498335d944e501bc46e07191c3135",
      "6fe2747e23370a19c5a14b73054c358a0c26abf02d22fc75d83ef8580de089e9",
    ]);
    const cliManifest = manifests.get("cli");
    const apiManifest = manifests.get("api");
    assert.ok(cliManifest);
    assert.ok(apiManifest);
    const crossProfile = structuredClone(cliManifest) as any;
    const cliTestIndex = crossProfile.paths.findIndex((entry: any) =>
      entry.authority.kind === "generated_test_source_target");
    const apiTestEntry = structuredClone(apiManifest.paths.find((entry) =>
      entry.authority.kind === "generated_test_source_target"));
    assert.notEqual(cliTestIndex, -1);
    assert.ok(apiTestEntry);
    crossProfile.paths[cliTestIndex] = apiTestEntry;
    crossProfile.paths.sort((left: any, right: any) =>
      left.normalizedLocator < right.normalizedLocator
        ? -1
        : left.normalizedLocator > right.normalizedLocator ? 1 : 0);
    crossProfile.pathMembershipHash = hashFileTreePathMembershipV3(
      crossProfile.paths,
    );
    crossProfile.manifestHash = hashFileTreeManifestV3(crossProfile);
    assert.equal(FileTreeManifestV3Schema.safeParse(crossProfile).success, false);
  });

  it("joins FileTree and dependency-ready F4 evidence into stable BuildTopologyV2 authority", async () => {
    const cases = [
      {
        profileId: CLI_PROFILE,
        stackPackId: "node-cli" as const,
        productSpec: genuineNodeCliProductSpecV2(),
        fileTreePathCount: 13,
        outputPath: "dist/cli.js",
        candidatePath: "candidate-bundle/application/cli.js",
        runtimeKind: "cli",
        logicalBuildHash: "9f682c0f693999e01ccec6eb09ee07651b1056c198ddbb26c61ad52b4a5960b9",
      },
      {
        profileId: API_PROFILE,
        stackPackId: "node-express-api" as const,
        productSpec: genuineNodeExpressApiProductSpecV2(),
        fileTreePathCount: 15,
        outputPath: "dist/app.js",
        candidatePath: "candidate-bundle/application/app.js",
        runtimeKind: "http_handler",
        logicalBuildHash: "7c645d797803ce1b7a8a0f30c9c2e3f20c5ba3ed617312edf252f3def9135cfa",
      },
      {
        profileId: API_PROFILE,
        stackPackId: "node-express-api" as const,
        productSpec: twoStoryNodeExpressApiProductSpecV2(),
        fileTreePathCount: 22,
        outputPath: "dist/app.js",
        candidatePath: "candidate-bundle/application/app.js",
        runtimeKind: "http_handler",
        logicalBuildHash: "6f551d90c14837a8c1ac70e8fdd071413a71b80efea7134b4a12d51eef318c11",
      },
    ];
    for (const fixture of cases) {
      const created = await stage({ profileId: fixture.profileId });
      const deliverySelection = deliverySelectionForV2(
        fixture.productSpec,
        fixture.stackPackId,
      );
      const authorityInput = {
        productSpec: fixture.productSpec,
        deliverySelection,
      };
      const fileTreeResult = await compileFileTreeManifestV2ForTest(
        created.handle,
        authorityInput,
      );
      assert.equal(fileTreeResult.status, "shadow_compiled");
      if (fileTreeResult.status !== "shadow_compiled") {
        throw new Error("Expected dependency-ready FileTree input");
      }
      const dependency = await materializeNodeScaffoldDependenciesV2ForTest(
        created.handle,
      );
      const dependencyStageFileTree =
        await verifyFileTreeManifestV2AtDependencyStageForTest(created.handle, {
          ...authorityInput,
          candidate: fileTreeResult.value,
        });
      assert.equal(
        dependencyStageFileTree.value.manifestHash,
        fileTreeResult.value.manifestHash,
      );

      const compiled = await compileBuildTopologyV2ForTest(created.handle, {
        ...authorityInput,
        fileTree: fileTreeResult.value,
      });
      assert.equal(
        compiled.status,
        "shadow_compiled",
        compiled.status === "rejected"
          ? JSON.stringify(compiled.diagnostics)
          : undefined,
      );
      if (compiled.status !== "shadow_compiled") {
        throw new Error("Expected BuildTopologyV2");
      }
      const topology = compiled.value;
      assert.equal(BUILD_TOPOLOGY_CONTRACT_HASH_V2,
        BUILD_TOPOLOGY_CONTRACT_HASH_GOLDEN_V2);
      assert.equal(Object.isFrozen(BUILD_TOPOLOGY_CONTRACT_V2), true);
      assert.equal(topology.contractHash, BUILD_TOPOLOGY_CONTRACT_HASH_GOLDEN_V2);
      assert.equal(topology.stage, "dependencies_ready");
      assert.equal(topology.pathCount, fixture.fileTreePathCount + 4);
      assert.equal(topology.authority.fileTree.manifestHash,
        fileTreeResult.value.manifestHash);
      assert.equal(topology.operationalEvidence.dependencyReceiptHash,
        dependency.receiptHash);
      assert.equal(topology.logicalBuildHash, fixture.logicalBuildHash);
      assert.equal(topology.runtimeTarget.kind, fixture.runtimeKind);
      assert.equal(topology.commands.install.executionStatus,
        "verified_exited_zero");
      assert.equal(topology.commands.build.executionStatus,
        "blocked_until_source_declarations_and_receipt");
      assert.equal(topology.commands.test.minimumTestCount, 1);
      assert.equal(topology.commands.test.zeroTestReceipt, "forbidden");
      assert.equal(topology.entrypoint.sourceReceipt.state, "absent");
      assert.equal(topology.paths.filter((entry) =>
        entry.authority.kind === "file_tree_path").length,
      fixture.fileTreePathCount);
      assert.equal(topology.paths.find((entry) =>
        entry.classification === "build_output")?.normalizedLocator,
      fixture.outputPath);
      assert.equal(topology.paths.find((entry) =>
        entry.classification === "candidate_module")?.normalizedLocator,
      fixture.candidatePath);
      const raw = topology.paths.find((entry) =>
        entry.classification === "raw_dependency_build_input");
      const capsule = topology.paths.find((entry) =>
        entry.classification === "readonly_dependency_runtime_capsule");
      assert.equal(raw?.physicalSpace, "repository");
      assert.equal(raw?.normalizedLocator, "node_modules");
      assert.equal(capsule?.physicalSpace, "dependency_capsule");
      assert.equal(capsule?.normalizedLocator, "node_modules");
      assert.notEqual(raw?.pathRef, capsule?.pathRef);
      assert.equal(
        JSON.stringify(topology.authority).includes(dependency.receiptHash),
        false,
      );
      assert.doesNotMatch(
        JSON.stringify(topology),
        /setfarm-f4-stage-v2|\/private\/|\/var\/folders|\/Users\//,
      );
      assert.equal(BuildTopologyV2Schema.safeParse(topology).success, true);
      assert.equal(compiled.canonicalBytes, canonicalJsonStringify(topology));
      assertRecursivelyFrozen(compiled);

      const verified = await verifyBuildTopologyV2ForTest(created.handle, {
        ...authorityInput,
        fileTree: fileTreeResult.value,
        candidate: topology,
      });
      assert.equal(verified.value.manifestHash, topology.manifestHash);
      assertRecursivelyFrozen(verified);

      const wrongScope = await compileBuildTopologyV2(created.handle, {
        ...authorityInput,
        fileTree: fileTreeResult.value,
      });
      assert.equal(wrongScope.status, "rejected");
      assert.equal(wrongScope.diagnostics[0]?.code,
        "BUILD_TOPOLOGY_V2_PRODUCTION_AUTHORITY_REQUIRED");

      const selfRehashedLogical = structuredClone(topology) as any;
      selfRehashedLogical.authority.pathTokenSetHash = "f".repeat(64);
      selfRehashedLogical.logicalBuildHash = hashBuildTopologyLogicalBuildV2(
        selfRehashedLogical,
      );
      selfRehashedLogical.manifestHash = hashBuildTopologyManifestV2(
        selfRehashedLogical,
      );
      assert.equal(BuildTopologyV2Schema.safeParse(selfRehashedLogical).success, true);
      await assert.rejects(
        verifyBuildTopologyV2ForTest(created.handle, {
          ...authorityInput,
          fileTree: fileTreeResult.value,
          candidate: selfRehashedLogical,
        }),
        (error: unknown) =>
          error instanceof BuildTopologyVerificationErrorV2
          && error.code === "BUILD_TOPOLOGY_V2_VERIFICATION_AUTHORITY_MISMATCH",
      );

      const selfRehashedOperational = structuredClone(topology) as any;
      selfRehashedOperational.operationalEvidence.projectScopeHash = "a".repeat(64);
      selfRehashedOperational.manifestHash = hashBuildTopologyManifestV2(
        selfRehashedOperational,
      );
      assert.equal(
        selfRehashedOperational.logicalBuildHash,
        topology.logicalBuildHash,
      );
      assert.equal(BuildTopologyV2Schema.safeParse(selfRehashedOperational).success,
        true);
      await assert.rejects(
        verifyBuildTopologyV2ForTest(created.handle, {
          ...authorityInput,
          fileTree: fileTreeResult.value,
          candidate: selfRehashedOperational,
        }),
        (error: unknown) =>
          error instanceof BuildTopologyVerificationErrorV2
          && error.code === "BUILD_TOPOLOGY_V2_VERIFICATION_AUTHORITY_MISMATCH",
      );

      if (fixture.profileId === CLI_PROFILE) {
        const sibling = await stage({ profileId: CLI_PROFILE });
        const siblingFileTree = await compileFileTreeManifestV2ForTest(
          sibling.handle,
          authorityInput,
        );
        assert.equal(siblingFileTree.status, "shadow_compiled");
        if (siblingFileTree.status !== "shadow_compiled") {
          throw new Error("Expected sibling FileTreeV2");
        }
        const siblingDependency = await materializeNodeScaffoldDependenciesV2ForTest(
          sibling.handle,
        );
        const siblingTopology = await compileBuildTopologyV2ForTest(sibling.handle, {
          ...authorityInput,
          fileTree: siblingFileTree.value,
        });
        assert.equal(siblingTopology.status, "shadow_compiled");
        if (siblingTopology.status !== "shadow_compiled") {
          throw new Error("Expected sibling BuildTopologyV2");
        }
        assert.notEqual(dependency.receiptHash, siblingDependency.receiptHash);
        assert.notEqual(topology.manifestHash, siblingTopology.value.manifestHash);
        assert.equal(topology.logicalBuildHash,
          siblingTopology.value.logicalBuildHash);
        assert.equal(topology.authority.logicalDependencyHash,
          siblingTopology.value.authority.logicalDependencyHash);
      }
    }
  });

  it("binds FileTreeV3 to direct build and exact generated-test topology", async () => {
    const cases = [
      {
        profileId: CLI_PROFILE,
        stackPackId: "node-cli" as const,
        productSpec: genuineNodeCliProductSpecV2(),
        runtimeOutput: "dist/cli.js",
        testOutput: "dist/cli.setfarm.test.js",
        candidatePath: "candidate-bundle/application/cli.js",
        testArgv: ["node", "--test", "dist/cli.setfarm.test.js"],
        runtimeKind: "cli",
        runtimeRealizationCount: 10,
        testCoverageCount: 3,
      },
      {
        profileId: API_PROFILE,
        stackPackId: "node-express-api" as const,
        productSpec: genuineNodeExpressApiProductSpecV2(),
        runtimeOutput: "dist/app.js",
        testOutput: "dist/app.setfarm.test.js",
        candidatePath: "candidate-bundle/application/app.js",
        testArgv: ["node", "--test", "dist/app.setfarm.test.js"],
        runtimeKind: "http_handler",
        runtimeRealizationCount: 11,
        testCoverageCount: 3,
      },
      {
        profileId: API_PROFILE,
        stackPackId: "node-express-api" as const,
        productSpec: twoStoryNodeExpressApiProductSpecV2(),
        runtimeOutput: "dist/app.js",
        testOutput: "dist/app.setfarm.test.js",
        candidatePath: "candidate-bundle/application/app.js",
        testArgv: ["node", "--test", "dist/app.setfarm.test.js"],
        runtimeKind: "http_handler",
        runtimeRealizationCount: 20,
        testCoverageCount: 6,
      },
    ];
    const logicalBuildHashes: string[] = [];

    for (const [caseIndex, fixture] of cases.entries()) {
      const created = await stage({ profileId: fixture.profileId });
      const deliverySelection = deliverySelectionForV2(
        fixture.productSpec,
        fixture.stackPackId,
      );
      const authorityInput = {
        productSpec: fixture.productSpec,
        deliverySelection,
        ...nodeRuntimeBehaviorAuthorityV1(fixture.productSpec),
      };
      const fileTree = await compileFileTreeManifestV3ForTest(
        created.handle,
        authorityInput,
      );
      assert.equal(fileTree.status, "shadow_compiled");
      if (fileTree.status !== "shadow_compiled") {
        throw new Error("Expected V3 FileTree before dependency materialization");
      }
      const dependency = await materializeNodeScaffoldDependenciesV2ForTest(
        created.handle,
      );
      const compiled = await compileBuildTopologyV3ForTest(created.handle, {
        ...authorityInput,
        fileTree: fileTree.value,
      });
      assert.equal(
        compiled.status,
        "shadow_compiled",
        compiled.status === "rejected"
          ? JSON.stringify(compiled.diagnostics)
          : undefined,
      );
      if (compiled.status !== "shadow_compiled") {
        throw new Error("Expected BuildTopologyV3");
      }
      const topology = compiled.value;
      logicalBuildHashes.push(topology.logicalBuildHash);

      assert.equal(BUILD_TOPOLOGY_CONTRACT_HASH_V3,
        BUILD_TOPOLOGY_CONTRACT_HASH_GOLDEN_V3);
      assert.equal(Object.isFrozen(BUILD_TOPOLOGY_CONTRACT_V3), true);
      assert.equal(topology.contractHash, BUILD_TOPOLOGY_CONTRACT_HASH_GOLDEN_V3);
      assert.equal(topology.topologyVersion, "3.2.0");
      assert.equal(topology.stage,
        "realization_sources_planned_dependencies_ready");
      assert.equal(topology.pathCount, 11);
      assert.equal(topology.paths.filter((entry) =>
        entry.authority.kind === "file_tree_v3_path").length, 6);
      assert.equal(topology.paths.every((entry) =>
        entry.writeGrantOwnerRefs.length === 0), true);
      assert.equal(topology.authority.fileTree.manifestHash,
        fileTree.value.manifestHash);
      assert.equal(
        topology.authority.fileTree.runtimeBehaviorProposalHash,
        authorityInput.runtimeBehaviorContract.authority.proposalHash,
      );
      assert.equal(
        topology.authority.fileTree.runtimeBehaviorContractHash,
        authorityInput.runtimeBehaviorContract.contractHash,
      );
      assert.equal(topology.operationalEvidence.dependencyReceiptHash,
        dependency.receiptHash);
      assert.equal(topology.compilation.runtime.realizationCount,
        fixture.runtimeRealizationCount);
      assert.equal(topology.compilation.test.coverageCount,
        fixture.testCoverageCount);
      assert.equal(topology.compilation.runtime.sourceReceipt.state, "absent");
      assert.equal(topology.compilation.test.sourceReceipt.state, "absent");
      assert.equal(topology.runtimeTarget.kind, fixture.runtimeKind);

      assert.deepEqual(topology.commands.build.directArgv, [
        "node",
        "node_modules/typescript/bin/tsc",
        "-p",
        "tsconfig.json",
      ]);
      assert.equal(topology.commands.build.executableRef, "TOOL_NODE_RUNTIME_V2");
      assert.equal(topology.commands.build.compilerTarget.commandName, "tsc");
      assert.equal(topology.commands.build.compilerTarget.exactVersion, "5.9.3");
      assert.deepEqual(topology.commands.build.processPolicy, {
        stdin: "closed",
        timeoutMs: 120_000,
        maxStdoutBytes: 1_048_576,
        maxStderrBytes: 1_048_576,
        shell: "forbidden",
        ambientEnvironment: "forbidden",
        outputLimitDisposition: "typed_build_rejection",
        timeoutDisposition: "typed_build_rejection",
        nonzeroOrSignalDisposition: "typed_build_rejection",
      });
      assert.equal(
        topology.commands.build.buildReceiptSchema,
        CANDIDATE_BUILD_RECEIPT_V2_SCHEMA,
      );
      assert.equal(
        topology.compilation.candidate.requiredBuildReceiptSchema,
        CANDIDATE_BUILD_RECEIPT_V2_SCHEMA,
      );
      assert.equal(
        topology.commands.test.requiredPreconditions[0]?.receiptSchema,
        CANDIDATE_BUILD_RECEIPT_V2_SCHEMA,
      );
      assert.equal(
        topology.commands.test.canonicalReceiptSchema,
        EVIDENCE_RECEIPT_V2_SCHEMA,
      );
      assert.match(topology.commands.build.compilerTarget.targetContentHash,
        /^[a-f0-9]{64}$/u);
      assert.deepEqual(topology.commands.test.directArgv, fixture.testArgv);
      assert.equal(topology.commands.test.executableRef, "TOOL_NODE_RUNTIME_V2");
      assert.equal(topology.commands.test.minimumTestCount, 1);
      assert.equal(topology.commands.test.zeroTestReceipt, "forbidden");

      assert.equal(topology.paths.find((entry) =>
        entry.classification === "runtime_build_output")?.normalizedLocator,
      fixture.runtimeOutput);
      assert.equal(topology.paths.find((entry) =>
        entry.classification === "test_build_output")?.normalizedLocator,
      fixture.testOutput);
      assert.equal(topology.paths.find((entry) =>
        entry.classification === "candidate_module")?.normalizedLocator,
      fixture.candidatePath);
      const raw = topology.paths.find((entry) =>
        entry.classification === "raw_dependency_build_input");
      const capsule = topology.paths.find((entry) =>
        entry.classification === "readonly_dependency_runtime_capsule");
      assert.equal(raw?.physicalSpace, "repository");
      assert.equal(capsule?.physicalSpace, "dependency_capsule");
      assert.notEqual(raw?.pathRef, capsule?.pathRef);
      assert.equal(
        JSON.stringify(topology.authority).includes(dependency.receiptHash),
        false,
      );
      const serialized = JSON.stringify(topology);
      assert.equal(serialized.includes('["npm","run","build"]'), false);
      assert.equal(serialized.includes('["npm","test"]'), false);
      assert.doesNotMatch(serialized,
        /node-entrypoint-source-receipt|NODE_ENTRYPOINT_GENERATOR_V2/);
      assert.doesNotMatch(serialized,
        /model_owned_writable|model_granted_writable|OWNER_STORY_/);
      assert.doesNotMatch(serialized,
        /setfarm-f4-stage-v2|\/private\/|\/var\/folders|\/Users\//);
      assert.equal(BuildTopologyV3Schema.safeParse(topology).success, true);
      assert.equal(compiled.canonicalBytes, canonicalJsonStringify(topology));
      assertRecursivelyFrozen(compiled);

      const verified = await verifyBuildTopologyV3ForTest(created.handle, {
        ...authorityInput,
        fileTree: fileTree.value,
        candidate: topology,
      });
      assert.equal(verified.value.manifestHash, topology.manifestHash);
      assertRecursivelyFrozen(verified);

      const wrongScope = await compileBuildTopologyV3(created.handle, {
        ...authorityInput,
        fileTree: fileTree.value,
      });
      assert.equal(wrongScope.status, "rejected");
      assert.equal(wrongScope.diagnostics[0]?.code,
        "BUILD_TOPOLOGY_V3_PRODUCTION_AUTHORITY_REQUIRED");

      const selfRehashedLogical = structuredClone(topology) as any;
      selfRehashedLogical.authority.pathTokenSetHash = "f".repeat(64);
      selfRehashedLogical.logicalBuildHash = hashBuildTopologyLogicalBuildV3(
        selfRehashedLogical,
      );
      selfRehashedLogical.manifestHash = hashBuildTopologyManifestV3(
        selfRehashedLogical,
      );
      assert.equal(BuildTopologyV3Schema.safeParse(selfRehashedLogical).success,
        true);
      await assert.rejects(
        verifyBuildTopologyV3ForTest(created.handle, {
          ...authorityInput,
          fileTree: fileTree.value,
          candidate: selfRehashedLogical,
        }),
        (error: unknown) =>
          error instanceof BuildTopologyVerificationErrorV3
          && error.code === "BUILD_TOPOLOGY_V3_VERIFICATION_AUTHORITY_MISMATCH",
      );

      const selfRehashedOperational = structuredClone(topology) as any;
      selfRehashedOperational.operationalEvidence.projectScopeHash = "a".repeat(64);
      selfRehashedOperational.manifestHash = hashBuildTopologyManifestV3(
        selfRehashedOperational,
      );
      assert.equal(selfRehashedOperational.logicalBuildHash,
        topology.logicalBuildHash);
      assert.equal(
        BuildTopologyV3Schema.safeParse(selfRehashedOperational).success,
        true,
      );
      await assert.rejects(
        verifyBuildTopologyV3ForTest(created.handle, {
          ...authorityInput,
          fileTree: fileTree.value,
          candidate: selfRehashedOperational,
        }),
        (error: unknown) =>
          error instanceof BuildTopologyVerificationErrorV3
          && error.code === "BUILD_TOPOLOGY_V3_VERIFICATION_AUTHORITY_MISMATCH",
      );

      const npmDiscoveryForgery = structuredClone(topology) as any;
      npmDiscoveryForgery.commands.test.directArgv = ["npm", "test"];
      npmDiscoveryForgery.authority.commandContractHash =
        hashBuildTopologyCommandContractV3(npmDiscoveryForgery.commands);
      npmDiscoveryForgery.logicalBuildHash = hashBuildTopologyLogicalBuildV3(
        npmDiscoveryForgery,
      );
      npmDiscoveryForgery.manifestHash = hashBuildTopologyManifestV3(
        npmDiscoveryForgery,
      );
      assert.equal(BuildTopologyV3Schema.safeParse(npmDiscoveryForgery).success,
        false);

      if (caseIndex === 0) {
        const extraInput = await compileBuildTopologyV3ForTest(created.handle, {
          ...authorityInput,
          fileTree: fileTree.value,
          unexpected: true,
        });
        assert.equal(extraInput.status, "rejected");
        assert.equal(extraInput.diagnostics[0]?.code,
          "BUILD_TOPOLOGY_V3_INPUT_INVALID");

        let getterInvoked = false;
        const accessorInput = Object.defineProperty({
          productSpec: fixture.productSpec,
          deliverySelection,
        }, "fileTree", {
          enumerable: true,
          get() {
            getterInvoked = true;
            return fileTree.value;
          },
        });
        const accessorRejected = await compileBuildTopologyV3ForTest(
          created.handle,
          accessorInput,
        );
        assert.equal(accessorRejected.status, "rejected");
        assert.equal(accessorRejected.diagnostics[0]?.code,
          "BUILD_TOPOLOGY_V3_INPUT_INVALID");
        assert.equal(getterInvoked, false);

        const proxyInput = new Proxy({
          ...authorityInput,
          fileTree: fileTree.value,
        }, {
          ownKeys() {
            throw new Error("proxy ownKeys trap");
          },
        });
        const proxyRejected = await compileBuildTopologyV3ForTest(
          created.handle,
          proxyInput,
        );
        assert.equal(proxyRejected.status, "rejected");
        assert.equal(proxyRejected.diagnostics[0]?.code,
          "BUILD_TOPOLOGY_V3_INPUT_INVALID");

        const sibling = await stage({ profileId: CLI_PROFILE });
        const siblingFileTree = await compileFileTreeManifestV3ForTest(
          sibling.handle,
          authorityInput,
        );
        assert.equal(siblingFileTree.status, "shadow_compiled");
        if (siblingFileTree.status !== "shadow_compiled") {
          throw new Error("Expected sibling FileTreeV3");
        }
        const siblingDependency = await materializeNodeScaffoldDependenciesV2ForTest(
          sibling.handle,
        );
        const siblingTopology = await compileBuildTopologyV3ForTest(
          sibling.handle,
          { ...authorityInput, fileTree: siblingFileTree.value },
        );
        assert.equal(siblingTopology.status, "shadow_compiled");
        if (siblingTopology.status !== "shadow_compiled") {
          throw new Error("Expected sibling BuildTopologyV3");
        }
        assert.notEqual(dependency.receiptHash, siblingDependency.receiptHash);
        assert.notEqual(topology.manifestHash, siblingTopology.value.manifestHash);
        assert.equal(topology.logicalBuildHash,
          siblingTopology.value.logicalBuildHash);
        assert.equal(topology.authority.logicalDependencyHash,
          siblingTopology.value.authority.logicalDependencyHash);
      }
    }

    assert.deepEqual(logicalBuildHashes, [
      "e84797a297a091a9960d067e905a832d152cb997d83ac2a03ca0c8f08fc47a01",
      "3783202378a7454b949397fb2946e9e8231984441a219273e5ed3dfa153f9900",
      "4678f1ee2d9387d1795bf968a2edde0fd6bc0d61254822bef74629843f0452b4",
    ]);
  });

  it("generates exact CLI/API runtime bytes and binds every realization to source evidence", async () => {
    const cases = [
      {
        profileId: CLI_PROFILE,
        stackPackId: "node-cli" as const,
        productSpec: genuineNodeCliProductSpecV2(),
        behaviorAuthority: nodeRuntimeBehaviorAuthorityV1,
        sourceLocator: "src/cli.ts",
        runtimeKind: "cli" as const,
      },
      {
        profileId: API_PROFILE,
        stackPackId: "node-express-api" as const,
        productSpec: genuineNodeExpressApiProductSpecV2(),
        behaviorAuthority: nodeRuntimeBehaviorAuthorityV1,
        sourceLocator: "src/app.ts",
        runtimeKind: "api" as const,
      },
      {
        profileId: API_PROFILE,
        stackPackId: "node-express-api" as const,
        productSpec: twoStoryNodeExpressApiProductSpecV2(),
        behaviorAuthority: nodeRuntimeBehaviorAuthorityV1,
        sourceLocator: "src/app.ts",
        runtimeKind: "multi_api" as const,
      },
      {
        profileId: API_PROFILE,
        stackPackId: "node-express-api" as const,
        productSpec: prerequisiteNodeExpressApiProductSpecV2(),
        behaviorAuthority: nodeRuntimeBehaviorAuthorityV1,
        sourceLocator: "src/app.ts",
        runtimeKind: "prerequisite_api" as const,
      },
      {
        profileId: API_PROFILE,
        stackPackId: "node-express-api" as const,
        productSpec: entityFieldNodeExpressApiProductSpecV2(),
        behaviorAuthority: entityFieldNodeRuntimeBehaviorAuthorityV1,
        sourceLocator: "src/app.ts",
        runtimeKind: "entity_api" as const,
      },
    ];
    const storyPlanHashes: string[] = [];
    const sourceMapManifestHashes: string[] = [];
    const packetEnvelopeHashes: string[] = [];
    const sliceEnvelopeHashes: string[] = [];
    const closureEnvelopeHashes: string[] = [];
    let expectedSliceCount = 0;

    for (const [caseIndex, fixture] of cases.entries()) {
      const created = await stage({ profileId: fixture.profileId });
      const deliverySelection = deliverySelectionForV2(
        fixture.productSpec,
        fixture.stackPackId,
      );
      const authorityInput = {
        productSpec: fixture.productSpec,
        deliverySelection,
        ...fixture.behaviorAuthority(fixture.productSpec),
      };
      const realizationPlan = compileSemanticRealizationPlanV2(authorityInput);
      assert.equal(realizationPlan.status, "shadow_compiled");
      if (realizationPlan.status !== "shadow_compiled") {
        throw new Error("Expected semantic realization plan");
      }
      const fileTree = await compileFileTreeManifestV3ForTest(
        created.handle,
        authorityInput,
      );
      assert.equal(fileTree.status, "shadow_compiled");
      if (fileTree.status !== "shadow_compiled") {
        throw new Error("Expected runtime-generator FileTreeV3");
      }
      const dependency =
        await materializeNodeScaffoldDependenciesV2ForTest(created.handle);
      const buildTopology = await compileBuildTopologyV3ForTest(created.handle, {
        ...authorityInput,
        fileTree: fileTree.value,
      });
      assert.equal(buildTopology.status, "shadow_compiled");
      if (buildTopology.status !== "shadow_compiled") {
        throw new Error("Expected runtime-generator BuildTopologyV3");
      }
      const generatorInput = {
        ...authorityInput,
        realizationPlan: realizationPlan.value,
        fileTree: fileTree.value,
        buildTopology: buildTopology.value,
      };
      let sourceMaterializationInput: Readonly<{
        compilerInput: unknown;
        candidatePublications: unknown;
      }> | undefined;
      const generated = await generateNodeProductRuntimeSourceV2ForTest(
        created.handle,
        generatorInput,
      );
      assert.equal(
        generated.status,
        "shadow_generated",
        generated.status === "rejected"
          ? JSON.stringify(generated.diagnostics)
          : undefined,
      );
      if (generated.status !== "shadow_generated") {
        throw new Error("Expected generated runtime source");
      }

      assert.equal(
        NodeProductRuntimeSourceReceiptV2Schema.safeParse(generated.receipt)
          .success,
        true,
      );
      assert.equal(generated.receipt.source.normalizedLocator,
        fixture.sourceLocator);
      assert.equal(generated.receipt.source.contentHash,
        generated.sourceContentHash);
      assert.equal(generated.receipt.source.runtimeProgramHash,
        generated.runtimeProgramHash);
      assert.equal(
        generated.receipt.authority.runtimeProgramContractHash,
        NODE_PRODUCT_RUNTIME_PROGRAM_CONTRACT_HASH_V2,
      );
      assert.equal(
        generated.receipt.authority.runtimeBehavior.proposalHash,
        authorityInput.runtimeBehaviorContract.authority.proposalHash,
      );
      assert.equal(
        generated.receipt.authority.runtimeBehavior.contractHash,
        authorityInput.runtimeBehaviorContract.contractHash,
      );
      assert.equal(
        NODE_PRODUCT_RUNTIME_PROGRAM_CONTRACT_HASH_V2,
        NODE_PRODUCT_RUNTIME_PROGRAM_CONTRACT_HASH_GOLDEN_V2,
      );
      assert.equal(
        generated.receipt.coverage.generatorMemberCount,
        realizationPlan.value.coverage.generatorMemberCount,
      );
      assert.equal(
        generated.receipt.coverage.members.length,
        realizationPlan.value.coverage.generatorMemberCount,
      );
      assert.equal(generated.receipt.coverage.opaqueBehaviorCount, 0);
      assert.equal(
        generated.receipt.coverage.runtimeBehavior.contractHash,
        authorityInput.runtimeBehaviorContract.contractHash,
      );
      assert.equal(
        generated.receipt.coverage.runtimeBehavior.runtimeAssertionCount,
        authorityInput.runtimeBehaviorContract.coverage.runtimeAssertionCount,
      );
      assert.equal(
        generated.receipt.coverage.runtimeBehavior.runtimeAssertions.length,
        authorityInput.runtimeBehaviorContract.coverage.runtimeAssertionCount,
      );
      assert.equal(
        generated.receipt.coverage.runtimeBehavior.entityFieldBindingCount,
        authorityInput.runtimeBehaviorContract.coverage.entityFieldBindingCount,
      );
      assert.equal(
        generated.receipt.coverage.runtimeBehavior.checkpoints.afterAction,
        "generated_before_transaction_commit",
      );
      assert.equal(
        generated.sourceText.includes(authorityInput.runtimeBehaviorContract.contractHash),
        true,
      );
      if (fixture.runtimeKind === "entity_api") {
        assert.equal(
          generated.receipt.coverage.runtimeBehavior.entityFieldBindingCount,
          1,
        );
        const occurrenceRef = authorityInput.runtimeBehaviorContract
          .entityFieldBindings[0]!.occurrenceRef;
        assert.equal(
          generated.receipt.coverage.runtimeBehavior.entityFieldBindings[0]!
            .occurrenceRef,
          occurrenceRef,
        );
        assert.equal(generated.sourceText.includes(occurrenceRef), true);
      }
      assert.equal(generated.sourceText.includes("Math.random"), false);
      assert.equal(generated.sourceText.includes("Date.now"), false);
      assert.equal(generated.sourceText.includes("process.env"), false);
      assert.equal(generated.sourceText.includes(".listen("), false);
      assert.equal(generated.sourceText.includes("@setfarm-realization-v2"),
        true);
      const sourceBytes = Buffer.from(generated.sourceText, "utf8");
      for (const member of generated.receipt.coverage.members) {
        const marker = sourceBytes.subarray(
          member.sourceSpan.startByte,
          member.sourceSpan.endByteExclusive,
        ).toString("utf8");
        assert.match(marker, new RegExp(member.realizationRef, "u"));
        assert.match(marker, new RegExp(member.memberKind, "u"));
      }
      assertRecursivelyFrozen(generated);

      const verified = await verifyNodeProductRuntimeSourceV2ForTest(
        created.handle,
        {
          ...generatorInput,
          candidateReceipt: generated.receipt,
          candidateSourceText: generated.sourceText,
        },
      );
      assert.equal(verified.receipt.receiptHash, generated.receipt.receiptHash);
      assert.equal(verified.sourceText, generated.sourceText);
      assertRecursivelyFrozen(verified);

      await typecheckGeneratedRuntimeV2(
        sandbox,
        generated.sourceText,
        fixture.sourceLocator === "src/cli.ts" ? "cli.ts" : "app.ts",
      );
      const javascript = transpileGeneratedRuntimeV2(generated.sourceText);
      const testGeneratorInput = {
        ...generatorInput,
        runtimeSourceText: generated.sourceText,
        runtimeSourceReceipt: generated.receipt,
      };
      const generatedTest = await generateNodeProductTestSourceV2ForTest(
        created.handle,
        testGeneratorInput,
      );
      assert.equal(
        generatedTest.status,
        "shadow_generated",
        generatedTest.status === "rejected"
          ? JSON.stringify(generatedTest.diagnostics)
          : undefined,
      );
      if (generatedTest.status !== "shadow_generated") {
        throw new Error("Expected generated test source");
      }
      assert.equal(
        NodeProductTestSourceReceiptV2Schema.safeParse(generatedTest.receipt)
          .success,
        true,
      );
      assert.equal(
        generatedTest.receipt.authority.runtimeSource.logicalReceiptHash,
        generated.receipt.logicalReceiptHash,
      );
      assert.equal(
        generatedTest.receipt.authority.runtimeSource.runtimeProgramHash,
        generated.runtimeProgramHash,
      );
      assert.equal(
        generatedTest.receipt.coverage.testCount,
        fixture.productSpec.actions.length,
      );
      assert.equal(
        generatedTest.receipt.coverage.evidenceRelationCount,
        realizationPlan.value.coverage.evidenceRelationCount,
      );
      assert.equal(
        generatedTest.receipt.coverage.coverageBindingCount,
        fixture.productSpec.actions.length
          + realizationPlan.value.coverage.evidenceRelationCount,
      );
      assert.equal(
        generatedTest.receipt.coverage.behavior.assertionBindingCount,
        authorityInput.runtimeBehaviorContract.coverage.runtimeAssertionCount,
      );
      assert.equal(
        generatedTest.receipt.coverage.behavior.entityFieldBindingCount,
        authorityInput.runtimeBehaviorContract.coverage.entityFieldBindingCount,
      );
      if (fixture.runtimeKind === "entity_api") {
        const entityBinding = generatedTest.receipt.coverage.behavior
          .entityFieldBindings[0]!;
        assert.equal(entityBinding.actionRef, "ACT_CREATE_TASK");
        assert.equal(
          generatedTest.receipt.coverage.actionTests.find((binding) =>
            binding.actionRef === entityBinding.actionRef)
            ?.entityFieldOccurrenceRefs.includes(entityBinding.occurrenceRef),
          true,
        );
      }
      assert.equal(generatedTest.sourceText.includes("@setfarm-test-coverage-v2"),
        true);
      assert.equal(generatedTest.sourceText.includes("fetch("), false);
      assert.equal(generatedTest.sourceText.includes(".listen("), false);
      assert.equal(generatedTest.sourceText.includes("process.env"), false);
      const testSourceBytes = Buffer.from(generatedTest.sourceText, "utf8");
      for (const member of generatedTest.receipt.coverage.coverageMembers) {
        const marker = testSourceBytes.subarray(
          member.sourceSpan.startByte,
          member.sourceSpan.endByteExclusive,
        ).toString("utf8");
        assert.match(marker, new RegExp(member.coverageSymbolRef, "u"));
        assert.match(marker, new RegExp(member.testRef, "u"));
        assert.match(marker, new RegExp(member.subjectRef, "u"));
      }
      assertRecursivelyFrozen(generatedTest);

      const verifiedTest = await verifyNodeProductTestSourceV2ForTest(
        created.handle,
        {
          ...testGeneratorInput,
          candidateReceipt: generatedTest.receipt,
          candidateSourceText: generatedTest.sourceText,
        },
      );
      assert.equal(verifiedTest.receipt.receiptHash,
        generatedTest.receipt.receiptHash);
      assert.equal(verifiedTest.sourceText, generatedTest.sourceText);
      assertRecursivelyFrozen(verifiedTest);

      const storyPlanInput = {
        ...testGeneratorInput,
        testSourceText: generatedTest.sourceText,
        testSourceReceipt: generatedTest.receipt,
      };
      const storyPlan = await compileStoryPlanV3ForTest(
        created.handle,
        storyPlanInput,
      );
      assert.equal(
        storyPlan.status,
        "shadow_compiled",
        storyPlan.status === "rejected"
          ? JSON.stringify(storyPlan.diagnostics)
          : undefined,
      );
      if (storyPlan.status !== "shadow_compiled") {
        throw new Error("Expected StoryPlanV3");
      }
      assert.equal(StoryPlanV3Schema.safeParse(storyPlan.value).success, true);
      assert.equal(storyPlan.value.contractHash, STORY_PLAN_CONTRACT_HASH_V3);
      assert.equal(
        STORY_PLAN_CONTRACT_HASH_V3,
        "6755eac245ae58aff6babff05be6ff80ccbef346e098603fd2c75cd8d2351254",
      );
      assert.equal(
        storyPlan.value.coverage.storyScopedRealizationCount
          + storyPlan.value.coverage.productScopedRealizationCount,
        realizationPlan.value.realizationCount,
      );
      assert.equal(
        storyPlan.value.coverage.runtimeMemberCount,
        generated.receipt.coverage.members.length,
      );
      assert.equal(
        storyPlan.value.coverage.testCoverageMemberCount,
        generatedTest.receipt.coverage.coverageMembers.length,
      );
      assert.equal(
        storyPlan.value.stories.flatMap((story) => story.actionRefs).length,
        fixture.productSpec.actions.length,
      );
      assert.equal(storyPlan.value.productScope.realizations.length > 0, true);
      assert.ok(storyPlan.value.stories.every((story) =>
        story.physicalSharedGrantRefs.length === 0
        && story.sourceDependencies.runtime.ownerRef
          === "OWNER_NODE_PRODUCT_RUNTIME_GENERATOR_V2"
        && story.sourceDependencies.test.ownerRef
          === "OWNER_NODE_PRODUCT_TEST_GENERATOR_V2"));
      assert.equal(
        storyPlan.canonicalBytes.includes(generated.receipt.logicalReceiptHash),
        true,
      );
      assert.equal(
        storyPlan.canonicalBytes.includes(generatedTest.receipt.logicalReceiptHash),
        true,
      );
      assert.equal(
        storyPlan.canonicalBytes.includes(generated.receipt.receiptHash),
        false,
      );
      assert.equal(
        storyPlan.canonicalBytes.includes(generatedTest.receipt.receiptHash),
        false,
      );
      storyPlanHashes.push(storyPlan.value.planHash);
      const verifiedStoryPlan = await verifyStoryPlanV3ForTest(
        created.handle,
        { ...storyPlanInput, candidate: storyPlan.value },
      );
      assert.equal(verifiedStoryPlan.value.planHash, storyPlan.value.planHash);
      assertRecursivelyFrozen(verifiedStoryPlan);

      const sourceMapProducer = {
        pass: "product-compiler-implementation-source-map-v2" as const,
        codeSha: "abcdef0123456789",
        toolVersions: {
          implementationSourceMap: "2.0.0" as const,
          storyPlan: "3.0.0" as const,
        },
      };
      const sourceMapInput = {
        ...storyPlanInput,
        producer: sourceMapProducer,
        storyPlan: storyPlan.value,
      };
      const sourceMap = await compileImplementationSourceMapV2ForTest(
        created.handle,
        sourceMapInput,
      );
      assert.equal(
        sourceMap.status,
        "shadow_compiled",
        sourceMap.status === "rejected"
          ? JSON.stringify(sourceMap.diagnostics)
          : undefined,
      );
      if (sourceMap.status !== "shadow_compiled") {
        throw new Error("Expected ImplementationSourceMapV2");
      }
      assert.equal(
        ImplementationSourceMapEnvelopeV2Schema.safeParse(
          sourceMap.root.envelope,
        ).success,
        true,
      );
      assert.equal(
        sourceMap.root.value.contractHash,
        IMPLEMENTATION_SOURCE_MAP_CONTRACT_HASH_V2,
      );
      assert.equal(sourceMap.root.value.leafCount, storyPlan.value.storyCount);
      assert.equal(sourceMap.leaves.length, storyPlan.value.storyCount);
      assert.equal(sourceMap.proofs.length, storyPlan.value.storyCount);
      expectedSliceCount += sourceMap.proofs.length;
      assert.equal(
        sourceMap.root.value.authority.storyPlan.planHash,
        storyPlan.value.planHash,
      );
      assert.equal(
        sourceMap.root.value.authority.runtimeSource.logicalReceiptHash,
        generated.receipt.logicalReceiptHash,
      );
      assert.equal(
        sourceMap.root.value.authority.testSource.logicalReceiptHash,
        generatedTest.receipt.logicalReceiptHash,
      );
      assert.deepEqual(
        sourceMap.leaves.map((leaf) => leaf.reference.storyId),
        storyPlan.value.stories.map((story) => story.storyId),
      );
      assert.ok(sourceMap.leaves.every((leaf, index) =>
        leaf.value.story.storyHash === storyPlan.value.stories[index]!.storyHash
        && leaf.value.evidenceBindings.length
          === storyPlan.value.stories[index]!.evidenceRefs.length
        && leaf.value.execution.commandContractHash
          === buildTopology.value.authority.commandContractHash));
      assert.ok([
        ...sourceMap.leaves.map((leaf) => leaf.publicationPreflight),
        sourceMap.root.publicationPreflight,
      ].every((preflight) =>
        copyPreparedArtifactStoreBatchCanonicalItemsV1(
          preflight.preparedPublication,
        ).length === 1
        && preflight.durabilityTier === 0));
      const sourceMapJson = canonicalJsonStringify({
        root: sourceMap.root.envelope,
        leaves: sourceMap.leaves.map((leaf) => leaf.envelope),
      });
      assert.equal(sourceMapJson.includes(generated.receipt.receiptHash), false);
      assert.equal(
        sourceMapJson.includes(generatedTest.receipt.receiptHash),
        false,
      );
      sourceMapManifestHashes.push(sourceMap.root.value.manifestHash);
      assertRecursivelyFrozen(sourceMap);

      const packetProducer = {
        pass: "product-compiler-product-build-packet-v4" as const,
        codeSha: sourceMapProducer.codeSha,
        toolVersions: {
          implementationSourceMap: "2.0.0" as const,
          productBuildPacket: "4.0.0" as const,
        },
      };
      const packetInput = {
        ...storyPlanInput,
        packetProducer,
        sourceMapProducer,
        storyPlan: storyPlan.value,
        sourceMapRootEnvelope: sourceMap.root.envelope,
      };
      const packet = await compileProductBuildPacketV4ForTest(
        created.handle,
        packetInput,
      );
      assert.equal(
        packet.status,
        "shadow_sealed",
        packet.status === "rejected"
          ? JSON.stringify(packet.diagnostics)
          : undefined,
      );
      if (packet.status !== "shadow_sealed") {
        throw new Error("Expected ProductBuildPacketV4");
      }
      assert.equal(
        ProductBuildPacketEnvelopeV4Schema.safeParse(packet.packet.envelope)
          .success,
        true,
      );
      assert.equal(
        packet.packet.value.contractHash,
        PRODUCT_BUILD_PACKET_CONTRACT_HASH_V4,
      );
      assert.equal(
        packet.packet.value.sourceMapRoot.rootEnvelopeHash,
        sourceMap.root.envelopeHash,
      );
      assert.equal(
        packet.packet.value.sourceMapRoot.manifestHash,
        sourceMap.root.value.manifestHash,
      );
      assert.equal(
        packet.packet.value.sourceMapRoot.merkleRoot,
        sourceMap.root.value.merkleRoot,
      );
      assert.equal(
        packet.packet.value.sourceMapRoot.leafCount,
        sourceMap.root.value.leafCount,
      );
      assert.equal(
        packet.packet.value.sourceMapRoot.storyIdSetHash,
        sourceMap.root.value.storyIdSetHash,
      );
      assert.equal(
        packet.packet.value.sourceMapAuthorityHash,
        sourceMap.root.value.authorityHash,
      );
      assert.equal(
        packet.packet.value.execution.commandContractHash,
        buildTopology.value.authority.commandContractHash,
      );
      assert.equal(
        packet.packet.value.logicalSourceAuthority.runtimeLogicalReceiptHash,
        generated.receipt.logicalReceiptHash,
      );
      assert.equal(
        packet.packet.value.logicalSourceAuthority.testLogicalReceiptHash,
        generatedTest.receipt.logicalReceiptHash,
      );
      assert.equal(
        packet.packet.publicationPreflight.durabilityTier,
        0,
      );
      assert.equal(
        copyPreparedArtifactStoreBatchCanonicalItemsV1(
          packet.packet.publicationPreflight.preparedPublication,
        ).length,
        1,
      );
      assert.equal(
        packet.packet.canonicalBytes.includes(generated.receipt.receiptHash),
        false,
      );
      assert.equal(
        packet.packet.canonicalBytes.includes(generatedTest.receipt.receiptHash),
        false,
      );
      assert.equal(
        packet.packet.canonicalBytes.includes(
          buildTopology.value.operationalEvidence.dependencyReceiptHash,
        ),
        false,
      );
      packetEnvelopeHashes.push(packet.packet.envelopeHash);
      assertRecursivelyFrozen(packet);

      const sliceProducer = {
        pass: "product-compiler-implementation-slice-v2" as const,
        codeSha: packetProducer.codeSha,
        toolVersions: {
          implementationSlice: "2.0.0" as const,
          implementationSourceMap: "2.0.0" as const,
          productBuildPacket: "4.0.0" as const,
        },
      };
      const compiledSlices = [];
      const sliceInputs = [];
      for (const [proofIndex, sourceMapProof] of sourceMap.proofs.entries()) {
        const sliceInput = {
          ...packetInput,
          sliceProducer,
          storyId: storyPlan.value.stories[proofIndex]!.storyId,
          sourceMapProof,
          expectedPacketEnvelopeHash: packet.packet.envelopeHash,
          candidatePacketEnvelope: packet.packet.envelope,
        };
        const compiledSlice = await compileImplementationSliceV2ForTest(
          created.handle,
          sliceInput,
        );
        assert.equal(
          compiledSlice.status,
          "shadow_sealed",
          compiledSlice.status === "rejected"
            ? JSON.stringify(compiledSlice.diagnostics)
            : undefined,
        );
        if (compiledSlice.status !== "shadow_sealed") {
          throw new Error("Expected V4-native ImplementationSliceV2");
        }
        const slice = compiledSlice.slice.value;
        const proof = sourceMap.proofs[proofIndex]!;
        const story = storyPlan.value.stories[proofIndex]!;
        assert.equal(
          ImplementationSliceEnvelopeV2Schema.safeParse(
            compiledSlice.slice.envelope,
          ).success,
          true,
        );
        assert.equal(ImplementationSliceV2Schema.safeParse(slice).success, true);
        assert.equal(LegacyImplementationSliceV2Schema.safeParse(slice).success,
          false);
        assert.equal(slice.contractHash, IMPLEMENTATION_SLICE_CONTRACT_HASH_V2);
        assert.equal(slice.sliceVersion, "2.0.0");
        assert.equal(slice.packet.envelopeHash, packet.packet.envelopeHash);
        assert.equal(
          slice.packet.sourceMapRoot.envelopeHash,
          sourceMap.root.envelopeHash,
        );
        assert.equal(slice.storyProof.proofHash, proof.proofHash);
        assert.equal(
          slice.storyProof.leaf.reference.leafEnvelopeHash,
          proof.leaf.reference.leafEnvelopeHash,
        );
        assert.equal(
          slice.storyProof.leaf.leafHash,
          proof.leaf.envelope.payload.leafHash,
        );
        assert.equal(slice.story.storyId, story.storyId);
        assert.equal(slice.story.storyHash, story.storyHash);
        assert.equal(
          slice.implementation.mode,
          "generated_sources_complete_no_model_dispatch",
        );
        assert.equal(slice.implementation.modelDispatch, "forbidden");
        assert.deepEqual(slice.implementation.modelWritablePathRefs, []);
        assert.equal(
          slice.implementation.runtimeSource.logicalReceiptHash,
          generated.receipt.logicalReceiptHash,
        );
        assert.equal(
          slice.implementation.testSource.logicalReceiptHash,
          generatedTest.receipt.logicalReceiptHash,
        );
        assert.equal(
          canonicalJsonStringify(compiledSlice.contextAttachments.packetEnvelope),
          canonicalJsonStringify(packet.packet.envelope),
        );
        assert.equal(
          canonicalJsonStringify(compiledSlice.contextAttachments.storyProof),
          canonicalJsonStringify(proof),
        );
        assert.equal(
          compiledSlice.contextAttachments.storyLeafEnvelope.payload.leafHash,
          proof.leaf.envelope.payload.leafHash,
        );
        assert.equal(
          compiledSlice.slice.canonicalBytes.includes(story.title),
          false,
        );
        assert.equal(
          compiledSlice.slice.canonicalBytes.includes(
            packet.packet.value.candidateBuild.disposition,
          ),
          false,
        );
        assert.equal(
          compiledSlice.slice.canonicalBytes.includes(generated.receipt.receiptHash),
          false,
        );
        assert.equal(
          compiledSlice.slice.canonicalBytes.includes(
            buildTopology.value.operationalEvidence.dependencyReceiptHash,
          ),
          false,
        );
        assert.ok(
          Buffer.byteLength(compiledSlice.slice.canonicalBytes, "utf8")
            < 4 * 1024 * 1024,
        );
        assert.equal(
          copyPreparedArtifactStoreBatchCanonicalItemsV1(
            compiledSlice.slice.publicationPreflight.preparedPublication,
          ).length,
          1,
        );
        assertRecursivelyFrozen(compiledSlice);
        sliceEnvelopeHashes.push(compiledSlice.slice.envelopeHash);
        compiledSlices.push(compiledSlice);
        sliceInputs.push(sliceInput);
      }

      const closureProducer = {
        pass: "product-compiler-implementation-closure-v2" as const,
        codeSha: packetProducer.codeSha,
        toolVersions: {
          implementationClosure: "2.0.0" as const,
          implementationSlice: "2.0.0" as const,
          implementationSourceMap: "2.0.0" as const,
          productBuildPacket: "4.0.0" as const,
        },
      };
      const closureInput = {
        ...packetInput,
        closureProducer,
        sliceProducer,
        expectedPacketEnvelopeHash: packet.packet.envelopeHash,
        candidatePacketEnvelope: packet.packet.envelope,
        sliceCandidates: compiledSlices.map((compiledSlice) => ({
          storyId: compiledSlice.slice.value.story.storyId,
          expectedSliceEnvelopeHash: compiledSlice.slice.envelopeHash,
          candidateSliceEnvelope: compiledSlice.slice.envelope,
        })),
      };
      const compiledClosure = await compileImplementationClosureV2ForTest(
        created.handle,
        closureInput,
      );
      assert.equal(
        compiledClosure.status,
        "shadow_closed",
        compiledClosure.status === "rejected"
          ? JSON.stringify(compiledClosure.diagnostics)
          : undefined,
      );
      if (compiledClosure.status !== "shadow_closed") {
        throw new Error("Expected product-level ImplementationClosureV2");
      }
      const closure = compiledClosure.closure.value;
      assert.equal(ImplementationClosureV2Schema.safeParse(closure).success, true);
      assert.equal(
        ImplementationClosureEnvelopeV2Schema.safeParse(
          compiledClosure.closure.envelope,
        ).success,
        true,
      );
      assert.equal(closure.contractHash, IMPLEMENTATION_CLOSURE_CONTRACT_HASH_V2);
      assert.equal(closure.storySet.storyCount, sourceMap.root.value.leafCount);
      assert.equal(
        closure.storySet.storyIdSetHash,
        sourceMap.root.value.storyIdSetHash,
      );
      assert.deepEqual(
        closure.storySet.entries.map((entry) => entry.story.storyId),
        sourceMap.root.value.leaves.map((leaf) => leaf.storyId),
      );
      assert.deepEqual(
        closure.storySet.entries.map((entry) => entry.slice.envelopeHash),
        compiledSlices.map((compiledSlice) => compiledSlice.slice.envelopeHash),
      );
      assert.ok(closure.storySet.entries.every((entry, index) =>
        entry.sourceMap.proofHash === sourceMap.proofs[index]!.proofHash
        && entry.sourceMap.reference.leafEnvelopeHash
          === sourceMap.proofs[index]!.leaf.reference.leafEnvelopeHash
        && entry.slice.dispositionHash
          === compiledSlices[index]!.slice.value.implementation.dispositionHash));
      assert.equal(
        closure.implementation.mode,
        "generated_sources_complete_no_model_dispatch",
      );
      assert.equal(closure.implementation.modelDispatch, "forbidden");
      assert.deepEqual(closure.implementation.modelWritablePathRefs, []);
      assert.equal(
        compiledClosure.contextAttachments.sliceEnvelopes.length,
        sourceMap.root.value.leafCount,
      );
      assert.equal(
        compiledClosure.contextAttachments.storyLeafEnvelopes.length,
        sourceMap.root.value.leafCount,
      );
      assert.equal(
        copyPreparedArtifactStoreBatchCanonicalItemsV1(
          compiledClosure.closure.publicationPreflight.preparedPublication,
        ).length,
        1,
      );
      assert.ok(
        Buffer.byteLength(compiledClosure.closure.canonicalBytes, "utf8")
          < 4 * 1024 * 1024,
      );
      assertRecursivelyFrozen(compiledClosure);
      closureEnvelopeHashes.push(compiledClosure.closure.envelopeHash);

      if (caseIndex === 0 || caseIndex === 2) {
        const verifiedClosure = await verifyImplementationClosureV2ForTest(
          created.handle,
          {
            ...closureInput,
            expectedClosureEnvelopeHash:
              compiledClosure.closure.envelopeHash,
            candidateClosureEnvelope: compiledClosure.closure.envelope,
          },
        );
        assert.equal(
          verifiedClosure.status,
          "verified_shadow",
          verifiedClosure.status === "rejected"
            ? JSON.stringify(verifiedClosure.diagnostics)
            : undefined,
        );
        if (verifiedClosure.status !== "verified_shadow") {
          throw new Error("Expected verified ImplementationClosureV2");
        }
        assert.equal(
          verifiedClosure.closure.closureHash,
          compiledClosure.closure.value.closureHash,
        );
        assert.equal(
          verifiedClosure.implementationDisposition,
          "generated_sources_complete_no_model_dispatch",
        );
        assertRecursivelyFrozen(verifiedClosure);
      }

      if (caseIndex === 0) {
        const wrongClosureScope = await compileImplementationClosureV2(
          created.handle,
          closureInput,
        );
        assert.equal(wrongClosureScope.status, "rejected");

        const extraClosureInput = await compileImplementationClosureV2ForTest(
          created.handle,
          { ...closureInput, unexpected: true },
        );
        assert.equal(extraClosureInput.status, "rejected");
        assert.equal(
          extraClosureInput.diagnostics[0]?.code,
          "IMPLEMENTATION_CLOSURE_V2_INPUT_INVALID",
        );

        const missingClosureSlice = await compileImplementationClosureV2ForTest(
          created.handle,
          {
            ...closureInput,
            sliceCandidates: closureInput.sliceCandidates.slice(0, -1),
          },
        );
        assert.equal(missingClosureSlice.status, "rejected");
        assert.equal(
          missingClosureSlice.diagnostics[0]?.code,
          "IMPLEMENTATION_CLOSURE_V2_CANDIDATE_SET_MISMATCH",
        );
        if (closureInput.sliceCandidates.length > 1) {
          const duplicateCandidates = structuredClone(
            closureInput.sliceCandidates,
          );
          duplicateCandidates[1] = structuredClone(duplicateCandidates[0]!);
          const duplicateClosureSlice =
            await compileImplementationClosureV2ForTest(created.handle, {
              ...closureInput,
              sliceCandidates: duplicateCandidates,
            });
          assert.equal(duplicateClosureSlice.status, "rejected");
          assert.equal(
            duplicateClosureSlice.diagnostics[0]?.code,
            "IMPLEMENTATION_CLOSURE_V2_CANDIDATE_SET_MISMATCH",
          );
          const reorderedClosureSlice =
            await compileImplementationClosureV2ForTest(created.handle, {
              ...closureInput,
              sliceCandidates: [...closureInput.sliceCandidates].reverse(),
            });
          assert.equal(reorderedClosureSlice.status, "rejected");
          assert.equal(
            reorderedClosureSlice.diagnostics[0]?.code,
            "IMPLEMENTATION_CLOSURE_V2_CANDIDATE_SET_MISMATCH",
          );
        }

        const selfRehashedClosure = structuredClone(
          compiledClosure.closure.envelope,
        ) as any;
        selfRehashedClosure.payload.storySet.entries[0].slice.envelopeHash =
          "f".repeat(64);
        selfRehashedClosure.payload.storySet.entries[0].entryHash =
          hashImplementationClosureStoryEntryV2(
            selfRehashedClosure.payload.storySet.entries[0],
          );
        selfRehashedClosure.payload.storySet.membershipHash =
          hashImplementationClosureStoryMembershipV2(
            selfRehashedClosure.payload.storySet.entries,
          );
        selfRehashedClosure.payload.implementation.storyMembershipHash =
          selfRehashedClosure.payload.storySet.membershipHash;
        selfRehashedClosure.payload.implementation.dispositionHash =
          hashImplementationClosureProductDispositionV2(
            selfRehashedClosure.payload.implementation,
          );
        selfRehashedClosure.payload.closureHash = hashImplementationClosureV2(
          selfRehashedClosure.payload,
        );
        assert.equal(
          ImplementationClosureEnvelopeV2Schema.safeParse(selfRehashedClosure)
            .success,
          true,
        );
        const selfRehashedClosureEnvelopeHash = hashCanonicalJson(
          selfRehashedClosure,
        );
        const rejectedSelfRehashedClosure =
          await verifyImplementationClosureV2ForTest(created.handle, {
            ...closureInput,
            expectedClosureEnvelopeHash: selfRehashedClosureEnvelopeHash,
            candidateClosureEnvelope: selfRehashedClosure,
          });
        assert.equal(rejectedSelfRehashedClosure.status, "rejected");
        assert.equal(
          rejectedSelfRehashedClosure.diagnostics[0]?.code,
          "IMPLEMENTATION_CLOSURE_V2_EXPECTED_HASH_MISMATCH",
        );
        const rejectedClosureCandidateMismatch =
          await verifyImplementationClosureV2ForTest(created.handle, {
            ...closureInput,
            expectedClosureEnvelopeHash:
              compiledClosure.closure.envelopeHash,
            candidateClosureEnvelope: selfRehashedClosure,
          });
        assert.equal(rejectedClosureCandidateMismatch.status, "rejected");
        assert.equal(
          rejectedClosureCandidateMismatch.diagnostics[0]?.code,
          "IMPLEMENTATION_CLOSURE_V2_CANDIDATE_MISMATCH",
        );
      }

      if (caseIndex === 2) {
        assert.ok(closureInput.sliceCandidates.length > 1);
        const duplicateCandidates = structuredClone(
          closureInput.sliceCandidates,
        );
        duplicateCandidates[1] = structuredClone(duplicateCandidates[0]!);
        const duplicateClosureSlice =
          await compileImplementationClosureV2ForTest(created.handle, {
            ...closureInput,
            sliceCandidates: duplicateCandidates,
          });
        assert.equal(duplicateClosureSlice.status, "rejected");
        assert.equal(
          duplicateClosureSlice.diagnostics[0]?.code,
          "IMPLEMENTATION_CLOSURE_V2_CANDIDATE_SET_MISMATCH",
        );
        const reorderedClosureSlice =
          await compileImplementationClosureV2ForTest(created.handle, {
            ...closureInput,
            sliceCandidates: [...closureInput.sliceCandidates].reverse(),
          });
        assert.equal(reorderedClosureSlice.status, "rejected");
        assert.equal(
          reorderedClosureSlice.diagnostics[0]?.code,
          "IMPLEMENTATION_CLOSURE_V2_CANDIDATE_SET_MISMATCH",
        );
      }

      if (caseIndex === 0 || caseIndex === 2) {
        const verifyIndex = caseIndex === 2 ? compiledSlices.length - 1 : 0;
        const verifiedSlice = await verifyImplementationSliceV2ForTest(
          created.handle,
          {
            ...sliceInputs[verifyIndex]!,
            expectedSliceEnvelopeHash:
              compiledSlices[verifyIndex]!.slice.envelopeHash,
            candidateSliceEnvelope:
              compiledSlices[verifyIndex]!.slice.envelope,
          },
        );
        assert.equal(
          verifiedSlice.status,
          "verified_shadow",
          verifiedSlice.status === "rejected"
            ? JSON.stringify(verifiedSlice.diagnostics)
            : undefined,
        );
        if (verifiedSlice.status !== "verified_shadow") {
          throw new Error("Expected verified V4-native ImplementationSliceV2");
        }
        assert.equal(
          verifiedSlice.implementationDisposition,
          "generated_sources_complete_no_model_dispatch",
        );
        assertRecursivelyFrozen(verifiedSlice);
      }

      if (caseIndex === 0) {
        const wrongSliceScope = await compileImplementationSliceV2(
          created.handle,
          sliceInputs[0]!,
        );
        assert.equal(wrongSliceScope.status, "rejected");
        assert.equal(
          wrongSliceScope.diagnostics[0]?.code,
          "IMPLEMENTATION_SLICE_V2_PACKET_REJECTED",
        );
        const extraSliceInput = await compileImplementationSliceV2ForTest(
          created.handle,
          { ...sliceInputs[0]!, unexpected: true },
        );
        assert.equal(extraSliceInput.status, "rejected");
        assert.equal(
          extraSliceInput.diagnostics[0]?.code,
          "IMPLEMENTATION_SLICE_V2_INPUT_INVALID",
        );
        const sliceProducerDrift = await compileImplementationSliceV2ForTest(
          created.handle,
          {
            ...sliceInputs[0]!,
            sliceProducer: { ...sliceProducer, codeSha: "f".repeat(16) },
          },
        );
        assert.equal(sliceProducerDrift.status, "rejected");
        assert.equal(
          sliceProducerDrift.diagnostics[0]?.code,
          "IMPLEMENTATION_SLICE_V2_PRODUCER_REJECTED",
        );
        const wrongStory = await compileImplementationSliceV2ForTest(
          created.handle,
          { ...sliceInputs[0]!, storyId: "US-WRONG" },
        );
        assert.equal(wrongStory.status, "rejected");
        assert.equal(
          wrongStory.diagnostics[0]?.code,
          "IMPLEMENTATION_SLICE_V2_CROSS_AUTHORITY_MISMATCH",
        );

        const modelWriteInjection = structuredClone(
          compiledSlices[0]!.slice.envelope,
        ) as any;
        modelWriteInjection.payload.implementation.modelWritablePathRefs = [
          generated.receipt.source.pathRef,
        ];
        modelWriteInjection.payload.sliceHash =
          hashImplementationSliceV2(modelWriteInjection.payload);
        assert.equal(
          ImplementationSliceEnvelopeV2Schema.safeParse(modelWriteInjection)
            .success,
          false,
        );
        const operationalInjection = structuredClone(
          compiledSlices[0]!.slice.envelope,
        ) as any;
        operationalInjection.payload.sourceRevision = {
          sha: "f".repeat(40),
          treeHash: "e".repeat(40),
        };
        operationalInjection.payload.sliceHash =
          hashImplementationSliceV2(operationalInjection.payload);
        assert.equal(
          ImplementationSliceEnvelopeV2Schema.safeParse(operationalInjection)
            .success,
          false,
        );

        const selfRehashedSlice = structuredClone(
          compiledSlices[0]!.slice.envelope,
        ) as any;
        selfRehashedSlice.payload.packet.envelopeHash = "f".repeat(64);
        selfRehashedSlice.payload.packet.bindingHash =
          hashImplementationSlicePacketBindingV2(
            selfRehashedSlice.payload.packet,
          );
        selfRehashedSlice.payload.sliceHash =
          hashImplementationSliceV2(selfRehashedSlice.payload);
        assert.equal(
          ImplementationSliceEnvelopeV2Schema.safeParse(selfRehashedSlice)
            .success,
          true,
        );
        const selfRehashedSliceEnvelopeHash = hashCanonicalJson(
          selfRehashedSlice,
        );
        const rejectedSelfRehashedSlice =
          await verifyImplementationSliceV2ForTest(created.handle, {
            ...sliceInputs[0]!,
            expectedSliceEnvelopeHash: selfRehashedSliceEnvelopeHash,
            candidateSliceEnvelope: selfRehashedSlice,
          });
        assert.equal(rejectedSelfRehashedSlice.status, "rejected");
        assert.equal(
          rejectedSelfRehashedSlice.diagnostics[0]?.code,
          "IMPLEMENTATION_SLICE_V2_EXPECTED_HASH_MISMATCH",
        );
        const rejectedSliceCandidateMismatch =
          await verifyImplementationSliceV2ForTest(created.handle, {
            ...sliceInputs[0]!,
            expectedSliceEnvelopeHash:
              compiledSlices[0]!.slice.envelopeHash,
            candidateSliceEnvelope: selfRehashedSlice,
          });
        assert.equal(rejectedSliceCandidateMismatch.status, "rejected");
        assert.equal(
          rejectedSliceCandidateMismatch.diagnostics[0]?.code,
          "IMPLEMENTATION_SLICE_V2_CANDIDATE_MISMATCH",
        );

        let deepSliceProducer: unknown = { value: true };
        for (let depth = 0; depth < 220; depth += 1) {
          deepSliceProducer = { nested: deepSliceProducer };
        }
        const boundedSliceInput = await compileImplementationSliceV2ForTest(
          created.handle,
          { ...sliceInputs[0]!, sliceProducer: deepSliceProducer },
        );
        assert.equal(boundedSliceInput.status, "rejected");
        assert.equal(
          boundedSliceInput.diagnostics[0]?.code,
          "IMPLEMENTATION_SLICE_V2_INPUT_INVALID",
        );
      }

      if (caseIndex === 0 || caseIndex === 2) {
        const verifiedPacket = await verifyProductBuildPacketV4ForTest(
          created.handle,
          {
            ...packetInput,
            expectedPacketEnvelopeHash: packet.packet.envelopeHash,
            candidatePacketEnvelope: packet.packet.envelope,
          },
        );
        assert.equal(
          verifiedPacket.status,
          "verified_shadow",
          verifiedPacket.status === "rejected"
            ? JSON.stringify(verifiedPacket.diagnostics)
            : undefined,
        );
        if (verifiedPacket.status !== "verified_shadow") {
          throw new Error("Expected verified ProductBuildPacketV4");
        }
        assert.equal(
          verifiedPacket.sourceMapRootEnvelopeHash,
          sourceMap.root.envelopeHash,
        );
        assertRecursivelyFrozen(verifiedPacket);
      }

      if (caseIndex === 0) {
        const wrongPacketScope = await compileProductBuildPacketV4(
          created.handle,
          packetInput,
        );
        assert.equal(wrongPacketScope.status, "rejected");
        assert.equal(
          wrongPacketScope.diagnostics[0]?.code,
          "PRODUCT_BUILD_PACKET_V4_SOURCE_MAP_REJECTED",
        );
        const extraPacketInput = await compileProductBuildPacketV4ForTest(
          created.handle,
          { ...packetInput, unexpected: true },
        );
        assert.equal(extraPacketInput.status, "rejected");
        assert.equal(
          extraPacketInput.diagnostics[0]?.code,
          "PRODUCT_BUILD_PACKET_V4_INPUT_INVALID",
        );
        const producerDrift = await compileProductBuildPacketV4ForTest(
          created.handle,
          {
            ...packetInput,
            packetProducer: { ...packetProducer, codeSha: "f".repeat(16) },
          },
        );
        assert.equal(producerDrift.status, "rejected");
        assert.equal(
          producerDrift.diagnostics[0]?.code,
          "PRODUCT_BUILD_PACKET_V4_PRODUCER_REJECTED",
        );
        const rootSubstitution = structuredClone(sourceMap.root.envelope) as any;
        rootSubstitution.producer.codeSha = "e".repeat(16);
        assert.equal(
          ImplementationSourceMapEnvelopeV2Schema.safeParse(rootSubstitution)
            .success,
          true,
        );
        const rejectedRootSubstitution =
          await compileProductBuildPacketV4ForTest(created.handle, {
            ...packetInput,
            sourceMapRootEnvelope: rootSubstitution,
          });
        assert.equal(rejectedRootSubstitution.status, "rejected");
        assert.equal(
          rejectedRootSubstitution.diagnostics[0]?.code,
          "PRODUCT_BUILD_PACKET_V4_SOURCE_MAP_ROOT_MISMATCH",
        );

        const validationDrift = structuredClone(packet.packet.envelope) as any;
        validationDrift.payload.validationIds.reverse();
        validationDrift.payload.packetHash =
          hashProductBuildPacketV4(validationDrift.payload);
        assert.equal(
          ProductBuildPacketEnvelopeV4Schema.safeParse(validationDrift).success,
          false,
        );
        const operationalInjection = structuredClone(
          packet.packet.envelope,
        ) as any;
        operationalInjection.payload.logicalSourceAuthority
          .dependencyReceiptHash =
            buildTopology.value.operationalEvidence.dependencyReceiptHash;
        operationalInjection.payload.packetHash =
          hashProductBuildPacketV4(operationalInjection.payload);
        assert.equal(
          ProductBuildPacketEnvelopeV4Schema.safeParse(operationalInjection)
            .success,
          false,
        );

        const selfRehashed = structuredClone(packet.packet.envelope) as any;
        selfRehashed.payload.sourceMapAuthority.product.productSpecHash =
          "f".repeat(64);
        selfRehashed.payload.sourceMapAuthorityHash =
          hashImplementationSourceMapAuthorityV2(
            selfRehashed.payload.sourceMapAuthority,
          );
        selfRehashed.payload.sourceMapRoot.authorityHash =
          selfRehashed.payload.sourceMapAuthorityHash;
        selfRehashed.payload.packetHash =
          hashProductBuildPacketV4(selfRehashed.payload);
        assert.equal(
          ProductBuildPacketEnvelopeV4Schema.safeParse(selfRehashed).success,
          true,
        );
        const selfRehashedEnvelopeHash = hashCanonicalJson(selfRehashed);
        const rejectedSelfRehash = await verifyProductBuildPacketV4ForTest(
          created.handle,
          {
            ...packetInput,
            expectedPacketEnvelopeHash: selfRehashedEnvelopeHash,
            candidatePacketEnvelope: selfRehashed,
          },
        );
        assert.equal(rejectedSelfRehash.status, "rejected");
        assert.equal(
          rejectedSelfRehash.diagnostics[0]?.code,
          "PRODUCT_BUILD_PACKET_V4_EXPECTED_HASH_MISMATCH",
        );
        const rejectedCandidateMismatch =
          await verifyProductBuildPacketV4ForTest(created.handle, {
            ...packetInput,
            expectedPacketEnvelopeHash: packet.packet.envelopeHash,
            candidatePacketEnvelope: selfRehashed,
          });
        assert.equal(rejectedCandidateMismatch.status, "rejected");
        assert.equal(
          rejectedCandidateMismatch.diagnostics[0]?.code,
          "PRODUCT_BUILD_PACKET_V4_CANDIDATE_MISMATCH",
        );

        const executionDrift = structuredClone(packet.packet.envelope) as any;
        executionDrift.payload.execution.commands.environmentContractHash =
          "e".repeat(64);
        executionDrift.payload.execution.commandContractHash =
          hashBuildTopologyCommandContractV3(
            executionDrift.payload.execution.commands,
          );
        executionDrift.payload.sourceMapAuthority.buildTopology
          .commandContractHash =
            executionDrift.payload.execution.commandContractHash;
        executionDrift.payload.sourceMapAuthorityHash =
          hashImplementationSourceMapAuthorityV2(
            executionDrift.payload.sourceMapAuthority,
          );
        executionDrift.payload.sourceMapRoot.authorityHash =
          executionDrift.payload.sourceMapAuthorityHash;
        executionDrift.payload.packetHash =
          hashProductBuildPacketV4(executionDrift.payload);
        assert.equal(
          ProductBuildPacketEnvelopeV4Schema.safeParse(executionDrift).success,
          true,
        );
        const rejectedExecutionDrift =
          await verifyProductBuildPacketV4ForTest(created.handle, {
            ...packetInput,
            expectedPacketEnvelopeHash: hashCanonicalJson(executionDrift),
            candidatePacketEnvelope: executionDrift,
          });
        assert.equal(rejectedExecutionDrift.status, "rejected");
        assert.equal(
          rejectedExecutionDrift.diagnostics[0]?.code,
          "PRODUCT_BUILD_PACKET_V4_EXPECTED_HASH_MISMATCH",
        );

        const wrongExpectedHash = await verifyProductBuildPacketV4ForTest(
          created.handle,
          {
            ...packetInput,
            expectedPacketEnvelopeHash: "d".repeat(64),
            candidatePacketEnvelope: packet.packet.envelope,
          },
        );
        assert.equal(wrongExpectedHash.status, "rejected");
        assert.equal(
          wrongExpectedHash.diagnostics[0]?.code,
          "PRODUCT_BUILD_PACKET_V4_EXPECTED_HASH_MISMATCH",
        );

        let deepPacketProducer: unknown = { value: true };
        for (let depth = 0; depth < 200; depth += 1) {
          deepPacketProducer = { nested: deepPacketProducer };
        }
        const boundedPacketInput = await compileProductBuildPacketV4ForTest(
          created.handle,
          { ...packetInput, packetProducer: deepPacketProducer },
        );
        assert.equal(boundedPacketInput.status, "rejected");
        assert.equal(
          boundedPacketInput.diagnostics[0]?.code,
          "PRODUCT_BUILD_PACKET_V4_INPUT_INVALID",
        );
      }

      if (caseIndex === 0 || caseIndex === 2) {
        const proofIndex = caseIndex === 2
          ? sourceMap.proofs.length - 1
          : 0;
        const verifiedProof =
          await verifyImplementationSourceMapStoryProofV2ForTest(
            created.handle,
            {
              ...sourceMapInput,
              expectedRootEnvelopeHash: sourceMap.root.envelopeHash,
              rootEnvelope: sourceMap.root.envelope,
              proof: sourceMap.proofs[proofIndex],
            },
          );
        assert.equal(
          verifiedProof.leafReference.storyId,
          storyPlan.value.stories[proofIndex]!.storyId,
        );
        assert.equal(
          verifiedProof.rootEnvelopeHash,
          sourceMap.root.envelopeHash,
        );
        assertRecursivelyFrozen(verifiedProof);
        if (caseIndex === 2) {
          const wrongDirection = structuredClone(
            sourceMap.proofs[proofIndex],
          ) as any;
          assert.equal(wrongDirection.auditPath[0].kind, "left");
          wrongDirection.auditPath[0].kind = "right";
          wrongDirection.proofHash =
            hashImplementationSourceMapStoryProofV2(wrongDirection);
          assert.equal(
            ImplementationSourceMapStoryProofV2Schema.safeParse(
              wrongDirection,
            ).success,
            false,
          );
        }
      }

      if (caseIndex === 0) {
        const wrongSourceMapScope = await compileImplementationSourceMapV2(
          created.handle,
          sourceMapInput,
        );
        assert.equal(wrongSourceMapScope.status, "rejected");
        assert.equal(
          wrongSourceMapScope.diagnostics[0]?.code,
          "IMPLEMENTATION_SOURCE_MAP_V2_STORY_PLAN_REJECTED",
        );
        const extraSourceMapInput =
          await compileImplementationSourceMapV2ForTest(created.handle, {
            ...sourceMapInput,
            unexpected: true,
          });
        assert.equal(extraSourceMapInput.status, "rejected");
        assert.equal(
          extraSourceMapInput.diagnostics[0]?.code,
          "IMPLEMENTATION_SOURCE_MAP_V2_INPUT_INVALID",
        );

        const forgedRootEnvelope = structuredClone(
          sourceMap.root.envelope,
        ) as any;
        const forgedProof = structuredClone(sourceMap.proofs[0]) as any;
        forgedProof.leaf.envelope.payload.authority.productSpecHash =
          "f".repeat(64);
        forgedProof.leaf.envelope.payload.leafHash =
          hashImplementationSourceMapStoryLeafV2(
            forgedProof.leaf.envelope.payload,
          );
        forgedProof.leaf.reference.leafEnvelopeHash = hashCanonicalJson(
          forgedProof.leaf.envelope,
        );
        forgedProof.leaf.reference.byteLength = Buffer.byteLength(
          canonicalJsonStringify(forgedProof.leaf.envelope),
          "utf8",
        );
        forgedRootEnvelope.payload.leaves[0] = forgedProof.leaf.reference;
        forgedRootEnvelope.payload.merkleRoot =
          implementationSourceMapMerkleRootV2(
            forgedRootEnvelope.payload.leaves,
          );
        forgedRootEnvelope.payload.manifestHash =
          hashImplementationSourceMapManifestV2(
            forgedRootEnvelope.payload,
          );
        const forgedRootEnvelopeHash = hashCanonicalJson(forgedRootEnvelope);
        forgedProof.root.envelopeHash = forgedRootEnvelopeHash;
        forgedProof.root.manifestHash =
          forgedRootEnvelope.payload.manifestHash;
        forgedProof.root.merkleRoot = forgedRootEnvelope.payload.merkleRoot;
        forgedProof.proofHash =
          hashImplementationSourceMapStoryProofV2(forgedProof);
        assert.equal(
          ImplementationSourceMapEnvelopeV2Schema.safeParse(
            forgedRootEnvelope,
          ).success,
          true,
        );
        assert.equal(
          ImplementationSourceMapStoryProofV2Schema.safeParse(forgedProof)
            .success,
          true,
        );
        await assert.rejects(
          verifyImplementationSourceMapStoryProofV2ForTest(
            created.handle,
            {
              ...sourceMapInput,
              expectedRootEnvelopeHash: forgedRootEnvelopeHash,
              rootEnvelope: forgedRootEnvelope,
              proof: forgedProof,
            },
          ),
          (error: unknown) =>
            error instanceof
              ImplementationSourceMapStoryProofVerificationErrorV2
            && error.code
              === "IMPLEMENTATION_SOURCE_MAP_V2_PROOF_AUTHORITY_MISMATCH",
        );

        const wrongScope = await compileStoryPlanV3(
          created.handle,
          storyPlanInput,
        );
        assert.equal(wrongScope.status, "rejected");
        assert.equal(
          wrongScope.diagnostics[0]?.code,
          "STORY_PLAN_V3_SOURCE_AUTHORITY_REJECTED",
        );
        const extraInput = await compileStoryPlanV3ForTest(created.handle, {
          ...storyPlanInput,
          unexpected: true,
        });
        assert.equal(extraInput.status, "rejected");
        assert.equal(
          extraInput.diagnostics[0]?.code,
          "STORY_PLAN_V3_INPUT_INVALID",
        );
        const wrongStoryOwner = structuredClone(storyPlan.value) as any;
        wrongStoryOwner.stories[0].runtimeSourceMembers[0].storyId = "US-999";
        assert.equal(
          StoryPlanV3Schema.safeParse(wrongStoryOwner).success,
          false,
        );
        const omittedMember = structuredClone(storyPlan.value) as any;
        const omittedStory = omittedMember.stories[0];
        assert.equal(omittedStory.runtimeSourceMembers.length > 1, true);
        omittedStory.runtimeSourceMembers.pop();
        omittedStory.sourceDependencies.runtime.generatedSymbolRefs =
          omittedStory.runtimeSourceMembers.map((member: any) =>
            member.generatedSymbolRef).sort();
        omittedStory.storyHash = hashProductStoryV3(omittedStory);
        omittedMember.storyMembershipHash = hashStoryMembershipV3(
          omittedMember.stories,
        );
        omittedMember.coverage.runtimeMemberCount -= 1;
        const remainingRuntimeMembers = [
          ...omittedMember.stories.flatMap((story: any) =>
            story.runtimeSourceMembers),
          ...omittedMember.productScope.runtimeSourceMembers,
        ].sort((left: any, right: any) =>
          left.realizationRef.localeCompare(right.realizationRef));
        omittedMember.authority.runtimeSource.generatedMemberMembershipHash =
          hashNodeProductRuntimeGeneratedMemberMembershipV2(
            remainingRuntimeMembers,
          );
        omittedMember.planHash = hashStoryPlanV3(omittedMember);
        assert.equal(StoryPlanV3Schema.safeParse(omittedMember).success, true);
        await assert.rejects(
          verifyStoryPlanV3ForTest(created.handle, {
            ...storyPlanInput,
            candidate: omittedMember,
          }),
          (error: unknown) =>
            error instanceof StoryPlanVerificationErrorV3
            && error.code
              === "STORY_PLAN_V3_VERIFICATION_AUTHORITY_MISMATCH",
        );
      }

      await typecheckGeneratedTestV2(
        sandbox,
        generatedTest.sourceText,
        fixture.sourceLocator === "src/cli.ts"
          ? "cli.setfarm.test.ts"
          : "app.setfarm.test.ts",
      );
      const generatedTestJavascript = transpileGeneratedRuntimeV2(
        generatedTest.sourceText,
      );
      const proofRoot = path.join(sandbox, `generated-test-proof-${randomUUID()}`);
      const proofDist = path.join(proofRoot, "dist");
      await mkdir(proofDist, { recursive: true, mode: 0o700 });
      const runtimeOutputPath = path.join(
        proofDist,
        fixture.sourceLocator === "src/cli.ts" ? "cli.js" : "app.js",
      );
      const testOutputPath = path.join(
        proofDist,
        fixture.sourceLocator === "src/cli.ts"
          ? "cli.setfarm.test.js"
          : "app.setfarm.test.js",
      );
      await Promise.all([
        writeFile(path.join(proofRoot, "package.json"),
          "{\"type\":\"module\"}\n", { mode: 0o600 }),
        writeFile(runtimeOutputPath, javascript, { mode: 0o600 }),
        writeFile(testOutputPath, generatedTestJavascript, { mode: 0o600 }),
      ]);
      const testExecution = spawnSync(process.execPath, [
        "--test",
        testOutputPath,
      ], {
        cwd: proofRoot,
        encoding: "utf8",
        env: {},
        timeout: 20_000,
      });
      assert.equal(
        testExecution.status,
        0,
        `${testExecution.stdout}\n${testExecution.stderr}`,
      );
      assert.equal(testExecution.stderr, "");
      assert.match(testExecution.stdout,
        new RegExp(`tests ${fixture.productSpec.actions.length}`, "u"));

      if (caseIndex < 2) {
        const sourcePublicationInput = {
          producer: NODE_SOURCE_PUBLICATION_PRODUCER_V1,
          ...generatorInput,
        };
        const sourcePublication =
          await compileNodeProductSourcePublicationV1ForTest(
            created.handle,
            sourcePublicationInput,
          );
        assert.equal(
          sourcePublication.status,
          "shadow_prepared",
          sourcePublication.status === "rejected"
            ? JSON.stringify(sourcePublication.diagnostics)
            : undefined,
        );
        if (sourcePublication.status !== "shadow_prepared") {
          throw new Error("Expected prepared runtime/test source publication");
        }
        assert.equal(
          NodeProductSourcePublicationReceiptSetV1Schema.safeParse(
            sourcePublication.receiptSet,
          ).success,
          true,
        );
        assert.deepEqual(
          sourcePublication.publications.map((publication) =>
            publication.sourceRole),
          ["runtime", "test"],
        );
        assert.deepEqual(
          sourcePublication.receiptSet.entries.map((entry) => entry.sourceRole),
          ["runtime", "test"],
        );
        for (const publication of sourcePublication.publications) {
          assert.equal(
            NodeProductSourcePublicationReceiptV1Schema.safeParse(
              publication.receipt,
            ).success,
            true,
          );
          assert.equal(
            publication.receipt.receiptSet.commitmentHash,
            sourcePublication.receiptSet.commitmentHash,
          );
          assert.equal(
            publication.sourceBundleArtifactHash,
            publication.receipt.authority.sourceBundle.envelopeHash,
          );
          assert.equal(
            publication.sourceContentHash,
            publication.receipt.authority.sourceBundle.rawHash,
          );
          assert.equal(
            publication.sourceReceiptArtifactHash,
            publication.receipt.authority.sourceReceiptArtifact.envelopeHash,
          );
          assert.equal(
            publication.preparedPublication.occurrenceCount,
            publication.publicationEnvelopes.length,
          );
          assert.equal(
            publication.preparedPublication.items.filter((item) =>
              item.durabilityTier === 1).length,
            1,
          );
          assert.equal(
            publication.preparedPublication.items.filter((item) =>
              item.durabilityTier === 2).length,
            1,
          );
          assert.equal(
            publication.preparedPublication.items.filter((item) =>
              item.durabilityTier === 3).length,
            1,
          );
        }
        assertRecursivelyFrozen(sourcePublication.receiptSet);
        const candidatePublications = sourcePublication.publications.map(
          (publication) => ({
            sourceRole: publication.sourceRole,
            envelopes: [...publication.publicationEnvelopes].reverse(),
          }),
        );
        const verifiedPublication =
          await verifyNodeProductSourcePublicationV1ForTest(
            created.handle,
            {
              compilerInput: sourcePublicationInput,
              candidatePublications,
            },
          );
        assert.equal(verifiedPublication.status, "verified_shadow");
        assert.equal(
          verifiedPublication.receiptSet.commitmentHash,
          sourcePublication.receiptSet.commitmentHash,
        );

        if (caseIndex === 0) {
          for (const publication of sourcePublication.publications) {
            const indexed = await sourcePublisher.putBatch({
              batchReservationId: randomUUID(),
              plan: publication.publicationPlan,
            });
            assert.equal(indexed.lifecycle.state, "completed");
            assert.equal(
              indexed.items.length,
              publication.preparedPublication.occurrenceCount,
            );
            const bindingIdentity = {
              authoritySchema: publication.receipt.schema,
              authorityHash: publication.receipt.receiptHash,
              subjectRef:
                `${publication.sourceRole}:${publication.receipt.authority.source.pathRef}`,
              subjectHash:
                publication.receipt.authority.source.sourceIdentityHash,
            };
            const verifiedBundle = await verifyDeepByteBundleFromCasV2({
              authority: casAuthority,
              binding: {
                ...bindingIdentity,
                bindingHash:
                  hashDeepByteBundleConsumerBindingV2(bindingIdentity),
              },
              bundle: publication.receipt.authority.sourceBundle,
            });
            const sourceBytes = copyVerifiedDeepByteBundleBytesV2(verifiedBundle);
            assert.equal(sourceBytes.byteLength, publication.sourceByteLength);
            assert.equal(
              createHash("sha256").update(sourceBytes).digest("hex"),
              publication.sourceContentHash,
            );
          }
          sourceMaterializationInput = Object.freeze({
            compilerInput: sourcePublicationInput,
            candidatePublications,
          });

          const wrongPublicationScope =
            await compileNodeProductSourcePublicationV1(
              created.handle,
              sourcePublicationInput,
            );
          assert.equal(wrongPublicationScope.status, "rejected");
          assert.equal(
            wrongPublicationScope.diagnostics[0]?.code,
            "NODE_SOURCE_PUBLICATION_V1_RUNTIME_SOURCE_REJECTED",
          );

          const forgedRuntimeEnvelopes = structuredClone(
            sourcePublication.publications[0]!.publicationEnvelopes,
          ) as any[];
          const forgedEnvelope = forgedRuntimeEnvelopes.find((envelope) =>
            envelope.artifactType
              === "setfarm.node-product-source-publication-receipt.v1");
          assert.ok(forgedEnvelope);
          const forgedReceipt = forgedEnvelope.payload;
          forgedReceipt.authority.buildTopology.logicalBuildHash = "f".repeat(64);
          forgedReceipt.entryCommitmentHash =
            hashNodeProductSourcePublicationEntryCommitmentV1(
              forgedReceipt.authority,
            );
          forgedReceipt.receiptRef = nodeProductSourcePublicationReceiptRefV1(
            forgedReceipt.entryCommitmentHash,
          );
          forgedReceipt.receiptSet.entries[0].entryCommitmentHash =
            forgedReceipt.entryCommitmentHash;
          forgedReceipt.receiptSet.commitmentHash =
            hashNodeProductSourcePublicationReceiptSetV1(
              forgedReceipt.receiptSet,
            );
          forgedReceipt.receiptHash =
            hashNodeProductSourcePublicationReceiptV1(forgedReceipt);
          assert.equal(
            NodeProductSourcePublicationReceiptV1Schema.safeParse(
              forgedReceipt,
            ).success,
            true,
          );
          await assert.rejects(
            verifyNodeProductSourcePublicationV1ForTest(created.handle, {
              compilerInput: sourcePublicationInput,
              candidatePublications: [
                {
                  sourceRole: "runtime",
                  envelopes: forgedRuntimeEnvelopes,
                },
                candidatePublications[1],
              ],
            }),
            (error: unknown) =>
              error instanceof NodeProductSourcePublicationVerificationErrorV1
              && error.code
                === "NODE_SOURCE_PUBLICATION_V1_VERIFICATION_AUTHORITY_MISMATCH",
          );

          const extraPublicationInput =
            await compileNodeProductSourcePublicationV1ForTest(
              created.handle,
              { ...sourcePublicationInput, unexpected: true },
            );
          assert.equal(extraPublicationInput.status, "rejected");
          assert.equal(
            extraPublicationInput.diagnostics[0]?.code,
            "NODE_SOURCE_PUBLICATION_V1_INPUT_INVALID",
          );
        }
      }

      if (fixture.runtimeKind === "cli") {
        const modulePath = path.join(
          sandbox,
          `generated-cli-${randomUUID()}.mjs`,
        );
        await writeFile(modulePath, javascript, { mode: 0o600 });
        const execution = spawnSync(process.execPath, [
          modulePath,
          "add",
          "--title",
          "Runtime proof",
        ], {
          encoding: "utf8",
          env: {},
          timeout: 5_000,
        });
        assert.equal(execution.status, 0, execution.stderr);
        assert.equal(execution.stderr, "");
        assert.deepEqual(JSON.parse(execution.stdout), {
          task: { title: "Runtime proof" },
        });
        const invariantFailure = spawnSync(process.execPath, [
          modulePath,
          "add",
          "--title",
          "",
        ], {
          encoding: "utf8",
          env: {},
          timeout: 5_000,
        });
        assert.notEqual(invariantFailure.status, 0);
        assert.equal(invariantFailure.stdout, "");
        assert.match(
          invariantFailure.stderr,
          /RUNTIME_INVARIANT_ASSERTION_FAILED_AFTER_ACTION_ACT_ADD_TASK:RASSERT_/u,
        );
      } else if (fixture.runtimeKind === "api") {
        const encoded = Buffer.from(javascript, "utf8").toString("base64");
        const runtime = await import(
          `data:text/javascript;base64,${encoded}#${randomUUID()}`
        ) as { setfarmHttpHandlerV2: Function };
        assert.equal(typeof runtime.setfarmHttpHandlerV2, "function");

        let statusCode = 0;
        let responseBody: unknown;
        let nextError: unknown;
        const response = {
          status(code: number) {
            statusCode = code;
            return this;
          },
          json(body: unknown) {
            responseBody = body;
            return this;
          },
        };
        runtime.setfarmHttpHandlerV2({
          method: "POST",
          originalUrl: "/tasks/setfarm",
          url: "/tasks/setfarm",
          body: { title: "" },
        }, response, (error?: unknown) => {
          nextError = error ?? "NEXT_WITHOUT_ERROR";
        });
        assert.equal(nextError, undefined);
        assert.match(
          JSON.stringify(responseBody),
          /RUNTIME_INVARIANT_ASSERTION_FAILED_AFTER_ACTION_ACT_CREATE_TASK:RASSERT_/u,
        );

        runtime.setfarmHttpHandlerV2({
          method: "POST",
          originalUrl: "/tasks/setfarm",
          url: "/tasks/setfarm",
          body: { title: "Runtime API proof" },
        }, response, (error?: unknown) => {
          nextError = error ?? "NEXT_WITHOUT_ERROR";
        });
        assert.equal(nextError, undefined);
        assert.equal(statusCode, 201);
        assert.deepEqual(responseBody, {
          task: { title: "Runtime API proof" },
        });

        runtime.setfarmHttpHandlerV2({
          method: "POST",
          originalUrl: "/tasks/setfarm",
          url: "/tasks/setfarm",
          body: { title: "Valid", unexpected: true },
        }, response, (error?: unknown) => {
          nextError = error ?? "NEXT_WITHOUT_ERROR";
        });
        assert.equal(statusCode, 400);
        assert.equal(
          (responseBody as any).error.code,
          "INPUT_VALIDATION_FAILED",
        );
      } else if (fixture.runtimeKind === "entity_api") {
        const encoded = Buffer.from(javascript, "utf8").toString("base64");
        const runtime = await import(
          `data:text/javascript;base64,${encoded}#${randomUUID()}`
        ) as { setfarmHttpHandlerV2: Function };
        let statusCode = 0;
        let responseBody: unknown;
        let nextError: unknown;
        const response = {
          status(code: number) {
            statusCode = code;
            return this;
          },
          json(body: unknown) {
            responseBody = body;
            return this;
          },
        };

        runtime.setfarmHttpHandlerV2({
          method: "POST",
          originalUrl: "/tasks/missing",
          url: "/tasks/missing",
          body: { title: "Ignored transport title" },
        }, response, (error?: unknown) => {
          nextError = error ?? "NEXT_WITHOUT_ERROR";
        });
        assert.equal(nextError, undefined);
        assert.equal(statusCode, 500);
        assert.match(
          JSON.stringify(responseBody),
          /ENTITY_SNAPSHOT_MATCH_MISSING:ENTITYSRC_/u,
        );

        runtime.setfarmHttpHandlerV2({
          method: "POST",
          originalUrl: "/tasks/setfarm",
          url: "/tasks/setfarm",
          body: { title: "" },
        }, response, (error?: unknown) => {
          nextError = error ?? "NEXT_WITHOUT_ERROR";
        });
        assert.equal(nextError, undefined);
        assert.equal(statusCode, 201);
        assert.deepEqual(responseBody, { task: { title: "" } });
      }

      if (caseIndex === 0) {
        const wrongScope = await generateNodeProductRuntimeSourceV2(
          created.handle,
          generatorInput,
        );
        assert.equal(wrongScope.status, "rejected");
        assert.equal(
          wrongScope.diagnostics[0]?.code,
          "NODE_RUNTIME_SOURCE_V2_PRODUCTION_AUTHORITY_REQUIRED",
        );
        const wrongTestScope = await generateNodeProductTestSourceV2(
          created.handle,
          testGeneratorInput,
        );
        assert.equal(wrongTestScope.status, "rejected");
        assert.equal(
          wrongTestScope.diagnostics[0]?.code,
          "NODE_TEST_SOURCE_V2_PRODUCTION_AUTHORITY_REQUIRED",
        );

        await assert.rejects(
          verifyNodeProductTestSourceV2ForTest(created.handle, {
            ...testGeneratorInput,
            candidateReceipt: generatedTest.receipt,
            candidateSourceText: `${generatedTest.sourceText}// drift\n`,
          }),
          (error: unknown) =>
            error instanceof NodeProductTestSourceVerificationErrorV2
            && error.code
              === "NODE_TEST_SOURCE_V2_VERIFICATION_AUTHORITY_MISMATCH",
        );

        const omittedEvidenceCoverage = structuredClone(
          generatedTest.receipt,
        ) as any;
        omittedEvidenceCoverage.coverage.actionTests[0].evidenceRefs.pop();
        omittedEvidenceCoverage.coverage.actionTestMembershipHash =
          hashNodeProductActionTestMembershipV2(
            omittedEvidenceCoverage.coverage.actionTests,
          );
        omittedEvidenceCoverage.logicalReceiptHash =
          hashNodeProductTestSourceLogicalReceiptV2(omittedEvidenceCoverage);
        omittedEvidenceCoverage.receiptHash =
          hashNodeProductTestSourceReceiptV2(omittedEvidenceCoverage);
        assert.equal(
          NodeProductTestSourceReceiptV2Schema.safeParse(
            omittedEvidenceCoverage,
          ).success,
          false,
        );

        const selfRehashedTest = structuredClone(generatedTest.receipt) as any;
        selfRehashedTest.authority.buildTopology.logicalBuildHash = "f".repeat(64);
        selfRehashedTest.logicalReceiptHash =
          hashNodeProductTestSourceLogicalReceiptV2(selfRehashedTest);
        selfRehashedTest.receiptHash =
          hashNodeProductTestSourceReceiptV2(selfRehashedTest);
        assert.equal(
          NodeProductTestSourceReceiptV2Schema.safeParse(selfRehashedTest)
            .success,
          true,
        );
        await assert.rejects(
          verifyNodeProductTestSourceV2ForTest(created.handle, {
            ...testGeneratorInput,
            candidateReceipt: selfRehashedTest,
            candidateSourceText: generatedTest.sourceText,
          }),
          (error: unknown) =>
            error instanceof NodeProductTestSourceVerificationErrorV2
            && error.code
              === "NODE_TEST_SOURCE_V2_VERIFICATION_AUTHORITY_MISMATCH",
        );

        const extraTestInput = await generateNodeProductTestSourceV2ForTest(
          created.handle,
          { ...testGeneratorInput, unexpected: true },
        );
        assert.equal(extraTestInput.status, "rejected");
        assert.equal(extraTestInput.diagnostics[0]?.code,
          "NODE_TEST_SOURCE_V2_INPUT_INVALID");

        await assert.rejects(
          verifyNodeProductRuntimeSourceV2ForTest(created.handle, {
            ...generatorInput,
            candidateReceipt: generated.receipt,
            candidateSourceText: `${generated.sourceText}// drift\n`,
          }),
          (error: unknown) =>
            error instanceof NodeProductRuntimeSourceVerificationErrorV2
            && error.code
              === "NODE_RUNTIME_SOURCE_V2_VERIFICATION_AUTHORITY_MISMATCH",
        );

        const selfRehashed = structuredClone(generated.receipt) as any;
        selfRehashed.authority.buildTopology.logicalBuildHash = "f".repeat(64);
        selfRehashed.logicalReceiptHash =
          hashNodeProductRuntimeSourceLogicalReceiptV2(selfRehashed);
        selfRehashed.receiptHash =
          hashNodeProductRuntimeSourceReceiptV2(selfRehashed);
        assert.equal(
          NodeProductRuntimeSourceReceiptV2Schema.safeParse(selfRehashed)
            .success,
          true,
        );
        await assert.rejects(
          verifyNodeProductRuntimeSourceV2ForTest(created.handle, {
            ...generatorInput,
            candidateReceipt: selfRehashed,
            candidateSourceText: generated.sourceText,
          }),
          (error: unknown) =>
            error instanceof NodeProductRuntimeSourceVerificationErrorV2
            && error.code
              === "NODE_RUNTIME_SOURCE_V2_VERIFICATION_AUTHORITY_MISMATCH",
        );

        const extraInput = await generateNodeProductRuntimeSourceV2ForTest(
          created.handle,
          { ...generatorInput, unexpected: true },
        );
        assert.equal(extraInput.status, "rejected");
        assert.equal(extraInput.diagnostics[0]?.code,
          "NODE_RUNTIME_SOURCE_V2_INPUT_INVALID");

        const sibling = await stage({ profileId: CLI_PROFILE });
        const siblingFileTree = await compileFileTreeManifestV3ForTest(
          sibling.handle,
          authorityInput,
        );
        assert.equal(siblingFileTree.status, "shadow_compiled");
        if (siblingFileTree.status !== "shadow_compiled") {
          throw new Error("Expected sibling runtime FileTreeV3");
        }
        await materializeNodeScaffoldDependenciesV2ForTest(sibling.handle);
        const siblingTopology = await compileBuildTopologyV3ForTest(
          sibling.handle,
          { ...authorityInput, fileTree: siblingFileTree.value },
        );
        assert.equal(siblingTopology.status, "shadow_compiled");
        if (siblingTopology.status !== "shadow_compiled") {
          throw new Error("Expected sibling runtime BuildTopologyV3");
        }
        const siblingGenerated =
          await generateNodeProductRuntimeSourceV2ForTest(sibling.handle, {
            ...authorityInput,
            realizationPlan: realizationPlan.value,
            fileTree: siblingFileTree.value,
            buildTopology: siblingTopology.value,
          });
        assert.equal(siblingGenerated.status, "shadow_generated");
        if (siblingGenerated.status !== "shadow_generated") {
          throw new Error("Expected sibling runtime source");
        }
        assert.notEqual(
          siblingTopology.value.manifestHash,
          buildTopology.value.manifestHash,
        );
        assert.equal(siblingGenerated.sourceText, generated.sourceText);
        assert.equal(
          siblingGenerated.receipt.logicalReceiptHash,
          generated.receipt.logicalReceiptHash,
        );
        assert.notEqual(
          siblingGenerated.receipt.receiptHash,
          generated.receipt.receiptHash,
        );
        const siblingGeneratorInput = {
          ...authorityInput,
          realizationPlan: realizationPlan.value,
          fileTree: siblingFileTree.value,
          buildTopology: siblingTopology.value,
        };
        const siblingGeneratedTest =
          await generateNodeProductTestSourceV2ForTest(sibling.handle, {
            ...siblingGeneratorInput,
            runtimeSourceText: siblingGenerated.sourceText,
            runtimeSourceReceipt: siblingGenerated.receipt,
          });
        assert.equal(siblingGeneratedTest.status, "shadow_generated");
        if (siblingGeneratedTest.status !== "shadow_generated") {
          throw new Error("Expected sibling generated test source");
        }
        assert.equal(siblingGeneratedTest.sourceText, generatedTest.sourceText);
        assert.equal(
          siblingGeneratedTest.receipt.logicalReceiptHash,
          generatedTest.receipt.logicalReceiptHash,
        );
        assert.notEqual(
          siblingGeneratedTest.receipt.receiptHash,
          generatedTest.receipt.receiptHash,
        );
        const siblingStoryPlanInput = {
          ...siblingGeneratorInput,
          runtimeSourceText: siblingGenerated.sourceText,
          runtimeSourceReceipt: siblingGenerated.receipt,
          testSourceText: siblingGeneratedTest.sourceText,
          testSourceReceipt: siblingGeneratedTest.receipt,
        };
        const siblingStoryPlan = await compileStoryPlanV3ForTest(
          sibling.handle,
          siblingStoryPlanInput,
        );
        assert.equal(siblingStoryPlan.status, "shadow_compiled");
        if (siblingStoryPlan.status !== "shadow_compiled") {
          throw new Error("Expected sibling StoryPlanV3");
        }
        assert.equal(siblingStoryPlan.value.planHash, storyPlan.value.planHash);
        const siblingSourceMap =
          await compileImplementationSourceMapV2ForTest(sibling.handle, {
            ...siblingStoryPlanInput,
            producer: sourceMapProducer,
            storyPlan: siblingStoryPlan.value,
          });
        assert.equal(siblingSourceMap.status, "shadow_compiled");
        if (siblingSourceMap.status !== "shadow_compiled") {
          throw new Error("Expected sibling ImplementationSourceMapV2");
        }
        assert.equal(
          siblingSourceMap.root.value.manifestHash,
          sourceMap.root.value.manifestHash,
        );
        assert.equal(
          siblingSourceMap.root.envelopeHash,
          sourceMap.root.envelopeHash,
        );
        const siblingPacketInput = {
          ...siblingStoryPlanInput,
          packetProducer,
          sourceMapProducer,
          storyPlan: siblingStoryPlan.value,
          sourceMapRootEnvelope: siblingSourceMap.root.envelope,
        };
        const siblingPacket = await compileProductBuildPacketV4ForTest(
          sibling.handle,
          siblingPacketInput,
        );
        assert.equal(siblingPacket.status, "shadow_sealed");
        if (siblingPacket.status !== "shadow_sealed") {
          throw new Error("Expected sibling ProductBuildPacketV4");
        }
        assert.equal(
          siblingPacket.packet.value.packetHash,
          packet.packet.value.packetHash,
        );
        assert.equal(
          siblingPacket.packet.envelopeHash,
          packet.packet.envelopeHash,
        );
        const siblingSlices = [];
        for (const [proofIndex, proof] of siblingSourceMap.proofs.entries()) {
          const siblingSlice = await compileImplementationSliceV2ForTest(
            sibling.handle,
            {
              ...siblingPacketInput,
              sliceProducer,
              storyId: siblingStoryPlan.value.stories[proofIndex]!.storyId,
              sourceMapProof: proof,
              expectedPacketEnvelopeHash:
                siblingPacket.packet.envelopeHash,
              candidatePacketEnvelope: siblingPacket.packet.envelope,
            },
          );
          assert.equal(siblingSlice.status, "shadow_sealed");
          if (siblingSlice.status !== "shadow_sealed") {
            throw new Error("Expected sibling V4-native ImplementationSliceV2");
          }
          siblingSlices.push(siblingSlice);
        }
        assert.equal(
          siblingSlices[0]!.slice.value.sliceHash,
          compiledSlices[0]!.slice.value.sliceHash,
        );
        assert.equal(
          siblingSlices[0]!.slice.envelopeHash,
          compiledSlices[0]!.slice.envelopeHash,
        );
        const siblingClosureInput = {
          ...siblingPacketInput,
          closureProducer,
          sliceProducer,
          expectedPacketEnvelopeHash: siblingPacket.packet.envelopeHash,
          candidatePacketEnvelope: siblingPacket.packet.envelope,
          sliceCandidates: siblingSlices.map((siblingSlice) => ({
            storyId: siblingSlice.slice.value.story.storyId,
            expectedSliceEnvelopeHash: siblingSlice.slice.envelopeHash,
            candidateSliceEnvelope: siblingSlice.slice.envelope,
          })),
        };
        const siblingClosure = await compileImplementationClosureV2ForTest(
          sibling.handle,
          siblingClosureInput,
        );
        assert.equal(siblingClosure.status, "shadow_closed");
        if (siblingClosure.status !== "shadow_closed") {
          throw new Error("Expected sibling ImplementationClosureV2");
        }
        assert.equal(
          siblingClosure.closure.value.closureHash,
          compiledClosure.closure.value.closureHash,
        );
        assert.equal(
          siblingClosure.closure.envelopeHash,
          compiledClosure.closure.envelopeHash,
        );

        const siblingSourcePublicationInput = {
          producer: NODE_SOURCE_PUBLICATION_PRODUCER_V1,
          ...siblingGeneratorInput,
        };
        const siblingSourcePublication =
          await compileNodeProductSourcePublicationV1ForTest(
            sibling.handle,
            siblingSourcePublicationInput,
          );
        assert.equal(siblingSourcePublication.status, "shadow_prepared");
        if (siblingSourcePublication.status !== "shadow_prepared") {
          throw new Error("Expected sibling source publication");
        }
        for (const publication of siblingSourcePublication.publications) {
          const indexed = await sourcePublisher.putBatch({
            batchReservationId: randomUUID(),
            plan: publication.publicationPlan,
          });
          assert.equal(indexed.lifecycle.state, "completed");
        }
        const siblingCandidatePublications =
          siblingSourcePublication.publications.map((publication) => ({
            sourceRole: publication.sourceRole,
            envelopes: [...publication.publicationEnvelopes].reverse(),
          }));
        const siblingMaterializedSources =
          await materializeNodeProductSourcesV1ForTest(sibling.handle, {
            casAuthority,
            compilerInput: siblingSourcePublicationInput,
            candidatePublications: siblingCandidatePublications,
          });
        assert.equal(
          siblingMaterializedSources.status,
          "sources_materialized_verified",
        );

        assert.ok(sourceMaterializationInput);
        await assert.rejects(
          materializeNodeProductSourcesV1(created.handle, {
            casAuthority,
            ...sourceMaterializationInput,
          }),
          {
            code:
              "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_PRODUCTION_AUTHORITY_REQUIRED",
          },
        );
        const materializedSources =
          await materializeNodeProductSourcesV1ForTest(created.handle, {
            casAuthority,
            ...sourceMaterializationInput,
          });
        assert.equal(
          NodeProductSourceMaterializationReceiptV1Schema.safeParse(
            materializedSources,
          ).success,
          true,
        );
        assert.equal(
          materializedSources.materializerContractHash,
          NODE_PRODUCT_SOURCE_MATERIALIZER_CONTRACT_HASH_V1,
        );
        assert.equal(materializedSources.status,
          "sources_materialized_verified");
        assert.equal(materializedSources.admissionScope, "test_fixture");
        assert.deepEqual(
          materializedSources.sources.map((source) => source.sourceRole),
          ["runtime", "test"],
        );
        assert.ok(materializedSources.sources.every((source) =>
          source.sourceReceipt.casVerificationReceiptHash.length === 64
          && source.publicationReceipt.casVerificationReceiptHash.length === 64
          && source.bundle.deepVerificationReceiptHash.length === 64));
        assert.doesNotMatch(
          JSON.stringify(materializedSources),
          /setfarm-f4-stage-v2|\/private\/|\/var\/folders|\/Users\//,
        );
        assert.equal(
          (await revalidateNodeScaffoldDependenciesV2(created.handle)).receiptHash,
          dependency.receiptHash,
        );
        const closureVerificationInput = {
          ...closureInput,
          expectedClosureEnvelopeHash: compiledClosure.closure.envelopeHash,
          candidateClosureEnvelope: compiledClosure.closure.envelope,
        };
        const candidateSourceInput = { closureVerificationInput };
        const wrongCandidateSourceScope = await compileCandidateSourceV1(
          created.handle,
          candidateSourceInput,
        );
        assert.equal(wrongCandidateSourceScope.status, "rejected");
        assert.equal(
          wrongCandidateSourceScope.diagnostics[0]?.code,
          "CANDIDATE_SOURCE_V1_SCOPE_REJECTED",
        );
        const compiledCandidateSource = await compileCandidateSourceV1ForTest(
          created.handle,
          candidateSourceInput,
        );
        assert.equal(
          compiledCandidateSource.status,
          "shadow_verified_source",
          compiledCandidateSource.status === "rejected"
            ? JSON.stringify(compiledCandidateSource.diagnostics)
            : undefined,
        );
        if (compiledCandidateSource.status !== "shadow_verified_source") {
          throw new Error("Expected authenticated CandidateSourceV1");
        }
        const candidateSource = compiledCandidateSource.candidateSource.value;
        assert.equal(
          CandidateSourceReceiptV1Schema.safeParse(candidateSource).success,
          true,
        );
        assert.equal(
          CandidateSourceEnvelopeV1Schema.safeParse(
            compiledCandidateSource.candidateSource.envelope,
          ).success,
          true,
        );
        assert.equal(
          candidateSource.contractHash,
          CANDIDATE_SOURCE_RECEIPT_CONTRACT_HASH_V1,
        );
        assert.equal(
          candidateSource.semanticRevision.authority.implementationClosure
            .closureHash,
          compiledClosure.closure.value.closureHash,
        );
        assert.equal(
          candidateSource.semanticRevision.authority.implementationClosure
            .storyCount,
          sourceMap.root.value.leafCount,
        );
        assert.deepEqual(
          candidateSource.semanticRevision.contentTree.entries.map((entry) =>
            entry.normalizedLocator),
          [
            "package-lock.json",
            "package.json",
            "src/cli.setfarm.test.ts",
            "src/cli.ts",
            "tsconfig.json",
          ],
        );
        assert.equal(
          candidateSource.semanticRevision.contentTree.absences[0]
            .normalizedLocator,
          ".npmrc",
        );
        assert.equal(
          candidateSource.materialization.sourceMaterialization.receiptHash,
          materializedSources.receiptHash,
        );
        assert.equal(
          compiledCandidateSource.semanticRevisionHash,
          candidateSource.semanticRevision.revisionHash,
        );
        assert.equal(
          compiledCandidateSource.operationalReceiptHash,
          candidateSource.receiptHash,
        );
        assert.doesNotMatch(
          compiledCandidateSource.candidateSource.canonicalBytes,
          /setfarm-f4-stage-v2|\/private\/|\/var\/folders|\/Users\//,
        );
        assertRecursivelyFrozen(compiledCandidateSource);

        const verifiedCandidateSource = await verifyCandidateSourceV1ForTest(
          created.handle,
          {
            ...candidateSourceInput,
            expectedCandidateSourceEnvelopeHash:
              compiledCandidateSource.candidateSource.envelopeHash,
            candidateSourceEnvelope:
              compiledCandidateSource.candidateSource.envelope,
          },
        );
        assert.equal(
          verifiedCandidateSource.status,
          "verified_shadow",
          verifiedCandidateSource.status === "rejected"
            ? JSON.stringify(verifiedCandidateSource.diagnostics)
            : undefined,
        );
        if (verifiedCandidateSource.status !== "verified_shadow") {
          throw new Error("Expected verified CandidateSourceV1 authority");
        }
        assert.deepEqual(Object.keys(verifiedCandidateSource.authority), [
          "receiptHash",
          "semanticRevisionHash",
          "implementationClosureHash",
          "admissionScope",
        ]);
        assert.equal(
          verifiedCandidateSource.authority.semanticRevisionHash,
          candidateSource.semanticRevision.revisionHash,
        );
        const revalidatedCandidateSource =
          await revalidateVerifiedCandidateSourceAuthorityV1(
            verifiedCandidateSource.authority,
          );
        assert.equal(
          revalidatedCandidateSource.receiptHash,
          candidateSource.receiptHash,
        );

        const siblingClosureVerificationInput = {
          ...siblingClosureInput,
          expectedClosureEnvelopeHash: siblingClosure.closure.envelopeHash,
          candidateClosureEnvelope: siblingClosure.closure.envelope,
        };
        const siblingCandidateSource = await compileCandidateSourceV1ForTest(
          sibling.handle,
          { closureVerificationInput: siblingClosureVerificationInput },
        );
        assert.equal(
          siblingCandidateSource.status,
          "shadow_verified_source",
          siblingCandidateSource.status === "rejected"
            ? JSON.stringify(siblingCandidateSource.diagnostics)
            : undefined,
        );
        if (siblingCandidateSource.status !== "shadow_verified_source") {
          throw new Error("Expected sibling CandidateSourceV1");
        }
        assert.equal(
          siblingCandidateSource.semanticRevisionHash,
          compiledCandidateSource.semanticRevisionHash,
        );
        assert.equal(
          siblingCandidateSource.candidateSource.value.semanticRevision
            .contentTree.contentTreeHash,
          candidateSource.semanticRevision.contentTree.contentTreeHash,
        );
        assert.notEqual(
          siblingCandidateSource.operationalReceiptHash,
          compiledCandidateSource.operationalReceiptHash,
        );
        assert.notEqual(
          siblingCandidateSource.candidateSource.envelopeHash,
          compiledCandidateSource.candidateSource.envelopeHash,
        );
        const verifiedSiblingCandidateSource =
          await verifyCandidateSourceV1ForTest(sibling.handle, {
            closureVerificationInput: siblingClosureVerificationInput,
            expectedCandidateSourceEnvelopeHash:
              siblingCandidateSource.candidateSource.envelopeHash,
            candidateSourceEnvelope:
              siblingCandidateSource.candidateSource.envelope,
          });
        assert.equal(verifiedSiblingCandidateSource.status, "verified_shadow");
        if (verifiedSiblingCandidateSource.status !== "verified_shadow") {
          throw new Error("Expected verified sibling CandidateSourceV1 authority");
        }

        const selfRehashedCandidateSource = structuredClone(
          compiledCandidateSource.candidateSource.envelope,
        );
        selfRehashedCandidateSource.payload.materialization.sourceMaterialization
          .receiptHash = "f".repeat(64);
        selfRehashedCandidateSource.payload.receiptHash =
          hashCandidateSourceReceiptV1(selfRehashedCandidateSource.payload);
        assert.equal(
          CandidateSourceEnvelopeV1Schema.safeParse(selfRehashedCandidateSource)
            .success,
          true,
        );
        const rejectedCandidateSource = await verifyCandidateSourceV1ForTest(
          created.handle,
          {
            ...candidateSourceInput,
            expectedCandidateSourceEnvelopeHash:
              compiledCandidateSource.candidateSource.envelopeHash,
            candidateSourceEnvelope: selfRehashedCandidateSource,
          },
        );
        assert.equal(rejectedCandidateSource.status, "rejected");
        assert.equal(
          rejectedCandidateSource.diagnostics[0]?.code,
          "CANDIDATE_SOURCE_V1_CANDIDATE_MISMATCH",
        );

        const buildInvocationCount = buildInvocations.length;
        const candidateBuild = await buildCandidateV2ForTest({
          sourceAuthority: verifiedCandidateSource.authority,
          artifactAuthority: sourcePublisher,
        });
        const siblingCandidateBuild = await buildCandidateV2ForTest({
          sourceAuthority: verifiedSiblingCandidateSource.authority,
          artifactAuthority: sourcePublisher,
        });
        assert.equal(buildInvocations.length, buildInvocationCount + 2);
        assert.equal(
          CandidateBuildReceiptV2Schema.safeParse(candidateBuild.receipt).success,
          true,
        );
        assert.equal(candidateBuild.receipt.executionAuthority.pathDisclosure,
          "forbidden");
        assert.equal(candidateBuild.receipt.processOutcome.status, "exited_zero");
        assert.equal(candidateBuild.receipt.outputTree.memberCount, 2);
        assert.equal(candidateBuild.receipt.outputTree.fileCount, 2);
        assert.equal(candidateBuild.receipt.outputTree.directoryCount, 0);
        assert.deepEqual(
          candidateBuild.receipt.outputTree.files.map((file) =>
            file.normalizedLocator),
          ["dist/cli.js", "dist/cli.setfarm.test.js"],
        );
        assert.equal(
          candidateBuild.authority.semanticRevisionHash,
          compiledCandidateSource.semanticRevisionHash,
        );
        assert.equal(
          siblingCandidateBuild.authority.semanticRevisionHash,
          candidateBuild.authority.semanticRevisionHash,
        );
        assert.equal(
          siblingCandidateBuild.outputTreeEnvelopeHash,
          candidateBuild.outputTreeEnvelopeHash,
        );
        assert.equal(
          siblingCandidateBuild.receipt.outputTree.treeHash,
          candidateBuild.receipt.outputTree.treeHash,
        );
        assert.notEqual(
          siblingCandidateBuild.receipt.receiptHash,
          candidateBuild.receipt.receiptHash,
        );
        const verifiedCandidateBuild = await verifyCandidateBuildV2ForTest({
          buildAuthority: candidateBuild.authority,
          expectedReceiptHash: candidateBuild.receipt.receiptHash,
        });
        assert.equal(verifiedCandidateBuild.status, "verified_shadow");
        assert.equal(
          verifiedCandidateBuild.outputTreeEnvelopeHash,
          candidateBuild.outputTreeEnvelopeHash,
        );
        const runtimeBundleClaims = await Promise.allSettled([
          acquireCandidateBuildRuntimeBundleContextInternalV2(
            siblingCandidateBuild.authority,
            "test_fixture",
          ),
          acquireCandidateBuildRuntimeBundleContextInternalV2(
            siblingCandidateBuild.authority,
            "test_fixture",
          ),
        ]);
        assert.equal(runtimeBundleClaims[0]?.status, "fulfilled");
        assert.equal(runtimeBundleClaims[1]?.status, "rejected");
        if (runtimeBundleClaims[0]?.status !== "fulfilled") {
          throw new Error("Expected one claimed CandidateBuild runtime context");
        }
        assert.equal(
          runtimeBundleClaims[0].value.receipt.receiptHash,
          siblingCandidateBuild.receipt.receiptHash,
        );
        assert.equal(
          runtimeBundleClaims[0].value.outputTreeEnvelopeHash,
          siblingCandidateBuild.outputTreeEnvelopeHash,
        );
        assert.equal(
          (runtimeBundleClaims[1] as PromiseRejectedResult).reason.code,
          "CANDIDATE_BUILD_V2_RUNTIME_BUNDLE_ALREADY_CONSUMED",
        );
        const runtimeContext = runtimeBundleClaims[0].value;
        const runtimeInputs =
          await acquireNodeCandidateRuntimeBundleInputsInternalV2(
            runtimeContext.stage,
            {
              admissionScope: runtimeContext.expectedScope,
              profileId: runtimeContext.output.profileId,
              sourceMaterializationReceiptHash:
                runtimeContext.output.sourceMaterializationReceiptHash,
              dependencyReceiptHash:
                runtimeContext.output.dependencyReceiptHash,
              dependencyIdentityHash:
                runtimeContext.output.dependencyIdentityHash,
              outputMembershipHash: runtimeContext.output.membershipHash,
              outputTreeHash: runtimeContext.output.tree.treeHash,
              outputTreePayloadHash: runtimeContext.output.tree.payloadHash,
            },
          );
        assert.equal(runtimeInputs.admissionScope, "test_fixture");
        assert.equal(runtimeInputs.profileId, CLI_PROFILE);
        assert.deepEqual(runtimeInputs.application.map((file) =>
          file.logicalLocator), [
          "application/cli.js",
          "application/cli.setfarm.test.js",
        ]);
        assert.equal(
          runtimeInputs.application[0].contentHash,
          runtimeContext.output.files[0].contentHash,
        );
        assert.equal(runtimeInputs.packageJson.contentHash,
          getCodeOwnedNodeScaffoldToolchainEntryV2(CLI_PROFILE)!.scaffold.files
            .find((file) => file.normalizedLocator === "package.json")!.rawHash);
        const runtimeEnvironmentReceipt =
          await revalidateNodeScaffoldExecutionEnvironmentV2(
            runtimeInputs.runtimeEnvironment,
          );
        assert.equal(runtimeEnvironmentReceipt.admissionScope, "test_fixture");
        assert.notEqual(
          runtimeEnvironmentReceipt.receiptHash,
          siblingCandidateBuild.receipt.executionAuthority.environment.receiptHash,
        );
        await assert.rejects(
          executeNodeScaffoldEnvironmentBuildV2(
            runtimeInputs.runtimeEnvironment,
            runtimeContext.stage,
          ),
          {
            code: "NODE_SCAFFOLD_EXECUTION_ENVIRONMENT_V2_OPERATION_ROLE_INVALID",
          },
        );
        await assert.rejects(
          acquireNodeCandidateRuntimeBundleInputsInternalV2(
            runtimeContext.stage,
            {
              admissionScope: runtimeContext.expectedScope,
              profileId: runtimeContext.output.profileId,
              sourceMaterializationReceiptHash:
                runtimeContext.output.sourceMaterializationReceiptHash,
              dependencyReceiptHash:
                runtimeContext.output.dependencyReceiptHash,
              dependencyIdentityHash:
                runtimeContext.output.dependencyIdentityHash,
              outputMembershipHash: runtimeContext.output.membershipHash,
              outputTreeHash: runtimeContext.output.tree.treeHash,
              outputTreePayloadHash: runtimeContext.output.tree.payloadHash,
            },
          ),
          {
            code:
              "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_RUNTIME_BUNDLE_ALREADY_CONSUMED",
          },
        );
        const privateRuntime =
          await materializeNodeCandidateRuntimePrivateV2ForTest({
            runtimeInputs,
          });
        activeRuntimeBundles.push(privateRuntime);
        assert.equal(runtimeInstallInvocations.length, 1);
        assert.deepEqual(
          runtimeInstallInvocations[0]?.argv.slice(1),
          [
            "ci",
            "--omit=dev",
            "--ignore-scripts",
            "--no-audit",
            "--no-fund",
          ],
        );
        const privateRuntimeReceipt =
          await revalidateNodeCandidateRuntimePrivateV2(privateRuntime);
        assert.equal(privateRuntimeReceipt.admissionScope, "test_fixture");
        assert.equal(privateRuntimeReceipt.pathDisclosure, "forbidden");
        assert.equal(privateRuntimeReceipt.profileId, CLI_PROFILE);
        assert.equal(privateRuntimeReceipt.applicationTree.fileCount, 2);
        assert.equal(privateRuntimeReceipt.applicationTree.directoryCount, 0);
        assert.equal(privateRuntimeReceipt.dependencyTree.fileCount, 0);
        assert.equal(privateRuntimeReceipt.dependencyTree.directoryCount, 0);
        assert.equal(privateRuntimeReceipt.productionClosure.nodeCount, 0);
        assert.equal(privateRuntimeReceipt.productionGraph.packageCount, 0);
        assert.equal(
          privateRuntimeReceipt.applicationTree.treeHash,
          runtimeContext.output.tree.treeHash,
        );
        assert.deepEqual(
          privateRuntimeReceipt.applicationTree.entries
            .filter((entry) => entry.type === "file")
            .map((entry) => entry.contentHash),
          runtimeContext.output.files.map((file) => file.contentHash),
        );
        assert.equal(
          privateRuntimeReceipt.installEvidence.status,
          "exited_zero",
        );
        await assert.rejects(
          revalidateNodeCandidateRuntimePrivateV2(
            { ...privateRuntime } as MaterializedNodeCandidateRuntimePrivateV2,
          ),
          {
            code:
              "NODE_CANDIDATE_RUNTIME_PRIVATE_V2_AUTHORITY_UNAUTHENTICATED",
          },
        );
        settleNodeCandidateRuntimeBundleInputsInternalV2(
          runtimeContext.stage,
          runtimeInputs.scaffoldBaseReceiptHash,
        );
        settleCandidateBuildRuntimeBundleContextInternalV2(
          siblingCandidateBuild.authority,
          siblingCandidateBuild.receipt.receiptHash,
        );
        for (const file of [runtimeInputs.packageJson, runtimeInputs.packageLock,
          ...runtimeInputs.application]) {
          assert.equal(file.bytes.every((byte) => byte === 0), true);
        }
        destroyNodeCandidateRuntimePrivateV2(privateRuntime);
        await assert.rejects(
          revalidateNodeCandidateRuntimePrivateV2(privateRuntime),
          { code: "NODE_CANDIDATE_RUNTIME_PRIVATE_V2_DESTROYED" },
        );
        await assert.rejects(
          acquireCandidateBuildRuntimeBundleContextInternalV2(
            siblingCandidateBuild.authority,
            "test_fixture",
          ),
          (error: unknown) => error instanceof CandidateBuildErrorV2
            && error.code
              === "CANDIDATE_BUILD_V2_RUNTIME_BUNDLE_ALREADY_CONSUMED",
        );
        const issuedRuntimeClaims = await Promise.allSettled([
          materializeCandidateRuntimeBundleV2ForTest({
            buildAuthority: candidateBuild.authority,
          }),
          materializeCandidateRuntimeBundleV2ForTest({
            buildAuthority: candidateBuild.authority,
          }),
        ]);
        assert.equal(issuedRuntimeClaims[0]?.status, "fulfilled");
        assert.equal(issuedRuntimeClaims[1]?.status, "rejected");
        if (issuedRuntimeClaims[0]?.status !== "fulfilled") {
          throw new Error("Expected one issued CandidateRuntimeBundleV2");
        }
        assert.equal(
          (issuedRuntimeClaims[1] as PromiseRejectedResult).reason.code,
          "CANDIDATE_RUNTIME_BUNDLE_V2_BUILD_ALREADY_CONSUMED",
        );
        const issuedRuntime = issuedRuntimeClaims[0].value;
        activeRuntimeAuthorities.push(issuedRuntime.authority);
        assert.equal(issuedRuntime.status, "shadow_verified_runtime_bundle");
        assert.equal(
          CandidateRuntimeBundleV2Schema.safeParse(issuedRuntime.bundle).success,
          true,
        );
        assert.equal(
          issuedRuntime.bundle.buildReceiptHash,
          candidateBuild.receipt.receiptHash,
        );
        assert.equal(
          issuedRuntime.bundle.applicationTree.treeHash,
          candidateBuild.receipt.outputTree.treeHash,
        );
        assert.equal(issuedRuntime.bundle.dependencyTree.fileCount, 0);
        assert.equal(
          issuedRuntime.bundle.npmMaterializationReceipt.productionClosure
            .nodeCount,
          0,
        );
        assert.equal(runtimeInstallInvocations.length, 2);
        const verifiedRuntime = await verifyCandidateRuntimeBundleV2ForTest({
          runtimeAuthority: issuedRuntime.authority,
          expectedBundleHash: issuedRuntime.bundle.bundleHash,
        });
        assert.equal(verifiedRuntime.status, "verified_shadow");
        assert.equal(
          verifiedRuntime.bundle.bundleHash,
          issuedRuntime.bundle.bundleHash,
        );
        await assert.rejects(
          verifyCandidateRuntimeBundleV2ForTest({
            runtimeAuthority: {
              ...issuedRuntime.authority,
            } as CandidateRuntimeBundleAuthorityV2,
            expectedBundleHash: issuedRuntime.bundle.bundleHash,
          }),
          (error: unknown) => error instanceof CandidateRuntimeBundleErrorV2
            && error.code
              === "CANDIDATE_RUNTIME_BUNDLE_V2_AUTHORITY_UNAUTHENTICATED",
        );
        await assert.rejects(
          verifyCandidateRuntimeBundleV2ForTest({
            runtimeAuthority: issuedRuntime.authority,
            expectedBundleHash: "f".repeat(64),
          }),
          (error: unknown) => error instanceof CandidateRuntimeBundleErrorV2
            && error.code
              === "CANDIDATE_RUNTIME_BUNDLE_V2_EXPECTED_HASH_MISMATCH",
        );
        await assert.rejects(
          verifyCandidateBuildV2ForTest({
            buildAuthority: { ...candidateBuild.authority },
            expectedReceiptHash: candidateBuild.receipt.receiptHash,
          }),
          (error: unknown) => error instanceof CandidateBuildErrorV2
            && error.code === "CANDIDATE_BUILD_V2_AUTHORITY_UNAUTHENTICATED",
        );
        await assert.rejects(
          verifyCandidateBuildV2ForTest({
            buildAuthority: candidateBuild.authority,
            expectedReceiptHash: "f".repeat(64),
          }),
          (error: unknown) => error instanceof CandidateBuildErrorV2
            && error.code === "CANDIDATE_BUILD_V2_EXPECTED_HASH_MISMATCH",
        );
        await rm(
          path.join(
            artifactRoot,
            `${candidateBuild.outputTreeEnvelopeHash}.json`,
          ),
        );
        await assert.rejects(
          verifyCandidateBuildV2ForTest({
            buildAuthority: candidateBuild.authority,
            expectedReceiptHash: candidateBuild.receipt.receiptHash,
          }),
          (error: unknown) => error instanceof CandidateBuildErrorV2
            && error.code === "CANDIDATE_BUILD_V2_PUBLICATION_REJECTED",
        );
        await assert.rejects(
          buildCandidateV2ForTest({
            sourceAuthority: verifiedSiblingCandidateSource.authority,
            artifactAuthority: sourcePublisher,
          }),
          (error: unknown) => error instanceof CandidateBuildErrorV2
            && error.code === "CANDIDATE_BUILD_V2_ALREADY_CONSUMED",
        );

        const attemptRoot = await onlyAttemptRoot(created.stageParent);
        const sourceRoot = path.join(attemptRoot, "project", "src");
        assert.deepEqual(await readdir(sourceRoot), [
          "cli.setfarm.test.ts",
          "cli.ts",
        ]);
        const materializedRuntimePath = path.join(sourceRoot, "cli.ts");
        const materializedTestPath = path.join(
          sourceRoot,
          "cli.setfarm.test.ts",
        );
        assert.equal(
          (await readFile(materializedRuntimePath, "utf8")),
          generated.sourceText,
        );
        assert.equal(
          (await readFile(materializedTestPath, "utf8")),
          generatedTest.sourceText,
        );
        assert.equal((await stat(sourceRoot)).mode & 0o7777, 0o700);
        assert.equal((await stat(materializedRuntimePath)).mode & 0o7777, 0o444);
        assert.equal((await stat(materializedTestPath)).mode & 0o7777, 0o444);
        assert.equal(
          inspectNodeProductSourceMaterializationReceiptV1(created.handle)
            .receiptHash,
          materializedSources.receiptHash,
        );
        assert.equal(
          (await revalidateNodeProductSourcesV1(created.handle)).receiptHash,
          materializedSources.receiptHash,
        );
        await assert.rejects(
          materializeNodeProductSourcesV1ForTest(created.handle, {
            casAuthority,
            ...sourceMaterializationInput,
          }),
          {
            code:
              "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_SOURCE_ALREADY_CONSUMED",
          },
        );
        await chmod(materializedRuntimePath, 0o644);
        await assert.rejects(
          verifyCandidateBuildV2ForTest({
            buildAuthority: candidateBuild.authority,
            expectedReceiptHash: candidateBuild.receipt.receiptHash,
          }),
          (error: unknown) => error instanceof CandidateBuildErrorV2
            && error.code === "CANDIDATE_BUILD_V2_SOURCE_REJECTED",
        );
        await assert.rejects(revalidateNodeProductSourcesV1(created.handle), {
          code: "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_STATE_DRIFT",
        });
        destroyCandidateRuntimeBundleV2(issuedRuntime.authority);
        await assert.rejects(
          verifyCandidateRuntimeBundleV2ForTest({
            runtimeAuthority: issuedRuntime.authority,
            expectedBundleHash: issuedRuntime.bundle.bundleHash,
          }),
          (error: unknown) => error instanceof CandidateRuntimeBundleErrorV2
            && error.code === "CANDIDATE_RUNTIME_BUNDLE_V2_DESTROYED",
        );
      }
    }

    assert.deepEqual(storyPlanHashes, [
      "ec88d86bdac108f77daf50710371014748a8cb1d4fb1a45e6c6b3fd6f9805408",
      "5652228735f1018469a6f1ced468391585aa5e8b5bab245d83eaab97f024fd22",
      "681d4661a4c13dc8256760424bed48514bdc0889a5d33213574c35dd91818c9f",
      "f155909ff73d237f5468a034578dc2a9f8c6d9a6ccc85b82a6fdbb5a11329368",
      "3045cdd6b4d6b6125dbed33736f5f43c3726652a3e9a5fa3c6f24561ddf709ab",
    ]);
    assert.equal(sourceMapManifestHashes.length, cases.length);
    assert.equal(new Set(sourceMapManifestHashes).size, cases.length);
    assert.equal(packetEnvelopeHashes.length, cases.length);
    assert.equal(new Set(packetEnvelopeHashes).size, cases.length);
    assert.equal(sliceEnvelopeHashes.length, expectedSliceCount);
    assert.equal(new Set(sliceEnvelopeHashes).size, expectedSliceCount);
    assert.equal(closureEnvelopeHashes.length, cases.length);
    assert.equal(new Set(closureEnvelopeHashes).size, cases.length);

    const unsupportedCandidate: any = structuredClone(
      genuineNodeExpressApiProductSpecV2(),
    );
    unsupportedCandidate.actions[0].navigation = {
      kind: "route",
      routeRef: unsupportedCandidate.routes[0].id,
    };
    const unsupportedSpec = ProductSpecV2Schema.parse(unsupportedCandidate);
    const unsupportedCreated = await stage({ profileId: API_PROFILE });
    const unsupportedSelection = deliverySelectionForV2(
      unsupportedSpec,
      "node-express-api",
    );
    const rejectedUnsupported = await generateNodeProductRuntimeSourceV2ForTest(
      unsupportedCreated.handle,
      {
        productSpec: unsupportedSpec,
        deliverySelection: unsupportedSelection,
        ...nodeRuntimeBehaviorAuthorityV1(unsupportedSpec),
        realizationPlan: {},
        fileTree: {},
        buildTopology: {},
      },
    );
    assert.equal(rejectedUnsupported.status, "rejected");
    assert.equal(
      rejectedUnsupported.diagnostics[0]?.code,
      "NODE_RUNTIME_SOURCE_V2_UNSUPPORTED_BEHAVIOR_REJECTED",
    );
    assert.equal(rejectedUnsupported.diagnostics[0]?.path,
      "/productSpec/actions/0/navigation");

    const unsupportedEvidenceSpec = twoStoryNodeExpressApiProductSpecV2({
      memoryOnOriginalStory: true,
    });
    const unsupportedEvidenceCreated = await stage({ profileId: API_PROFILE });
    const unsupportedEvidenceSelection = deliverySelectionForV2(
      unsupportedEvidenceSpec,
      "node-express-api",
    );
    const rejectedEvidence = await generateNodeProductTestSourceV2ForTest(
      unsupportedEvidenceCreated.handle,
      {
        productSpec: unsupportedEvidenceSpec,
        deliverySelection: unsupportedEvidenceSelection,
        runtimeBehaviorProposal: {},
        runtimeBehaviorContract: {},
        realizationPlan: {},
        fileTree: {},
        buildTopology: {},
        runtimeSourceText: "x",
        runtimeSourceReceipt: {},
      },
    );
    assert.equal(rejectedEvidence.status, "rejected");
    assert.equal(
      rejectedEvidence.diagnostics[0]?.code,
      "NODE_TEST_SOURCE_V2_EVIDENCE_KIND_REJECTED",
    );
    assert.match(
      rejectedEvidence.diagnostics[0]?.message ?? "",
      /persistence_round_trip.*never fake or silently omit evidence/u,
    );
  });

  it("executes one exact private TypeScript build and seals every-and-only dist output", async () => {
    const created = await stage();
    const publication = await preparePublishedNodeSourcesV1(created.handle);
    const source = await materializeNodeProductSourcesV1ForTest(created.handle, {
      casAuthority,
      ...publication,
    });
    const evidence = await executeNodeScaffoldEnvironmentBuildV2(
      created.environmentHandle,
      created.handle,
    );
    assert.equal(evidence.probeRef, "HOST_NODE_PRODUCT_BUILD_V2");
    assert.deepEqual(evidence.directArgv, [
      "node",
      "node_modules/typescript/bin/tsc",
      "-p",
      "tsconfig.json",
    ]);
    assert.equal(evidence.stdin, "closed");
    assert.equal(evidence.timeoutMs, 120_000);
    assert.equal(evidence.maxStdoutBytes, 1_048_576);
    assert.equal(evidence.maxStderrBytes, 1_048_576);
    assert.equal(evidence.shell, "forbidden");
    assert.equal(evidence.ambientEnvironment, "forbidden");
    assert.equal(evidence.status, "exited_zero");
    assert.equal(buildInvocations.length, 1);
    assert.equal(buildInvocations[0]?.shell, false);
    assert.equal(buildInvocations[0]?.env.NODE_OPTIONS, undefined);
    assert.match(buildInvocations[0]?.argv[0] ?? "", /node_modules\/typescript\/bin\/tsc$/u);

    const output = await finalizeNodeCandidateBuildOutputV2ForTest(created.handle);
    assert.equal(output.sourceMaterializationReceiptHash, source.receiptHash);
    assert.equal(output.profileId, CLI_PROFILE);
    assert.equal(output.pathDisclosure, "forbidden");
    assert.equal(output.memberCount, 2);
    assert.deepEqual(output.files.map((file) => file.normalizedLocator), [
      "dist/cli.js",
      "dist/cli.setfarm.test.js",
    ]);
    assert.equal(output.files.every((file) => file.mode === "0444"), true);
    assert.equal(output.tree.profile, "dist");
    assert.equal(output.tree.rootMode, "0555");
    assert.equal(output.tree.fileCount, 2);
    assert.equal(output.tree.directoryCount, 0);
    assert.doesNotMatch(JSON.stringify(output), /\/private\/|\/var\/folders|\/Users\//u);
    assert.equal(
      (await revalidateNodeCandidateBuildOutputV2(created.handle)).tree.treeHash,
      output.tree.treeHash,
    );
    assert.equal(
      (await revalidateNodeProductSourcesV1(created.handle)).receiptHash,
      source.receiptHash,
    );
    assert.equal(
      (await revalidateNodeScaffoldExecutionEnvironmentV2(
        created.environmentHandle,
      )).receiptHash,
      inspectScaffoldBaseMaterializationReceiptV2(created.handle)
        .environmentBinding.receiptHash,
    );
    await assert.rejects(
      executeNodeScaffoldEnvironmentBuildV2(
        created.environmentHandle,
        created.handle,
      ),
      { code: "NODE_SCAFFOLD_EXECUTION_ENVIRONMENT_V2_BUILD_ALREADY_CONSUMED" },
    );

    const api = await stage({ profileId: API_PROFILE });
    const apiPublication = await preparePublishedNodeSourcesV1(
      api.handle,
      "complete",
      API_PROFILE,
    );
    await materializeNodeProductSourcesV1ForTest(api.handle, {
      casAuthority,
      ...apiPublication,
    });
    const apiEvidence = await executeNodeScaffoldEnvironmentBuildV2(
      api.environmentHandle,
      api.handle,
    );
    assert.equal(apiEvidence.status, "exited_zero");
    const apiOutput = await finalizeNodeCandidateBuildOutputV2ForTest(
      api.handle,
    );
    assert.equal(apiOutput.profileId, API_PROFILE);
    assert.deepEqual(apiOutput.files.map((file) => file.normalizedLocator), [
      "dist/app.js",
      "dist/app.setfarm.test.js",
    ]);
    assert.equal(apiOutput.tree.fileCount, 2);
    assert.equal(apiOutput.tree.directoryCount, 0);

    const attemptRoot = await onlyAttemptRoot(created.stageParent);
    const runtimeOutput = path.join(attemptRoot, "project", "dist", "cli.js");
    await chmod(runtimeOutput, 0o644);
    await writeFile(runtimeOutput, "mutated\n");
    await chmod(runtimeOutput, 0o444);
    await assert.rejects(revalidateNodeCandidateBuildOutputV2(created.handle), {
      code: "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_BUILD_OUTPUT_INVALID",
    });

    const failed = await stage();
    const failedPublication = await preparePublishedNodeSourcesV1(failed.handle);
    await materializeNodeProductSourcesV1ForTest(failed.handle, {
      casAuthority,
      ...failedPublication,
    });
    buildControls.set(CLI_PROFILE, { result: nonzero("typed fixture failure") });
    await assert.rejects(
      executeNodeScaffoldEnvironmentBuildV2(
        failed.environmentHandle,
        failed.handle,
      ),
      { code: "HOST_NODE_TOOLCHAIN_V2_BUILD_NONZERO" },
    );
    await assert.rejects(
      executeNodeScaffoldEnvironmentBuildV2(
        failed.environmentHandle,
        failed.handle,
      ),
      { code: "NODE_SCAFFOLD_EXECUTION_ENVIRONMENT_V2_BUILD_ALREADY_CONSUMED" },
    );
  });

  it("classifies every candidate-build process disposition and consumes each physical attempt", async () => {
    const cases: readonly Readonly<{
      label: string;
      result: HostNodeToolchainProbeResultV2;
      code: string;
    }>[] = [
      {
        label: "timeout",
        result: { status: "timed_out", stdout: "", stderr: "" },
        code: "HOST_NODE_TOOLCHAIN_V2_BUILD_TIMEOUT",
      },
      {
        label: "output-limit",
        result: { status: "output_limit_exceeded", stdout: "", stderr: "" },
        code: "HOST_NODE_TOOLCHAIN_V2_BUILD_OUTPUT_LIMIT",
      },
      {
        label: "spawn",
        result: { status: "spawn_failed", stdout: "", stderr: "spawn detail" },
        code: "HOST_NODE_TOOLCHAIN_V2_BUILD_SPAWN_FAILED",
      },
      {
        label: "signal",
        result: {
          status: "exited",
          exitCode: null,
          signal: "SIGTERM",
          stdout: "",
          stderr: "",
        },
        code: "HOST_NODE_TOOLCHAIN_V2_BUILD_SIGNALLED",
      },
    ];
    for (const fixture of cases) {
      const created = await stage();
      const publication = await preparePublishedNodeSourcesV1(created.handle);
      await materializeNodeProductSourcesV1ForTest(created.handle, {
        casAuthority,
        ...publication,
      });
      buildControls.set(CLI_PROFILE, { result: fixture.result });
      await assert.rejects(
        executeNodeScaffoldEnvironmentBuildV2(
          created.environmentHandle,
          created.handle,
        ),
        { code: fixture.code },
        fixture.label,
      );
      await assert.rejects(
        executeNodeScaffoldEnvironmentBuildV2(
          created.environmentHandle,
          created.handle,
        ),
        { code: "NODE_SCAFFOLD_EXECUTION_ENVIRONMENT_V2_BUILD_ALREADY_CONSUMED" },
      );
      buildControls.clear();
    }
  });

  it("serializes concurrent build claims to one process invocation", async () => {
    const created = await stage();
    const publication = await preparePublishedNodeSourcesV1(created.handle);
    await materializeNodeProductSourcesV1ForTest(created.handle, {
      casAuthority,
      ...publication,
    });
    const settled = await Promise.allSettled([
      executeNodeScaffoldEnvironmentBuildV2(
        created.environmentHandle,
        created.handle,
      ),
      executeNodeScaffoldEnvironmentBuildV2(
        created.environmentHandle,
        created.handle,
      ),
    ]);
    assert.equal(settled.filter((result) => result.status === "fulfilled").length, 1);
    assert.equal(settled.filter((result) => result.status === "rejected").length, 1);
    assert.equal(buildInvocations.length, 1);
    assert.equal(
      (await finalizeNodeCandidateBuildOutputV2ForTest(created.handle)).tree.fileCount,
      2,
    );
  });

  it("rejects source bytes when the exact publication receipts lack DB/CAS authority", async () => {
    const stageParent = await privateParent("source-receipt-missing");
    const sentinel = path.join(stageParent, "sentinel");
    await writeFile(sentinel, "foreign\n", { mode: 0o600 });
    const created = await stage({ stageParent });
    const publication = await preparePublishedNodeSourcesV1(
      created.handle,
      "without_publication_receipt",
    );
    await assert.rejects(
      materializeNodeProductSourcesV1ForTest(created.handle, {
        casAuthority,
        ...publication,
      }),
      {
        code:
          "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_SOURCE_AUTHORITY_INVALID",
      },
    );
    assert.deepEqual(await readdir(stageParent), ["sentinel"]);
  });

  it("removes a partial source tree after a post-runtime-write crash", async () => {
    const stageParent = await privateParent("source-partial-crash");
    const sentinel = path.join(stageParent, "sentinel");
    await writeFile(sentinel, "foreign\n", { mode: 0o600 });
    const created = await stage({ stageParent });
    const publication = await preparePublishedNodeSourcesV1(created.handle);
    const crashBoundary: NodeProductSourceMaterializerCrashBoundaryV1 =
      "after_runtime_source_fsync";
    await assert.rejects(
      materializeNodeProductSourcesV1ForTest(created.handle, {
        casAuthority,
        ...publication,
        testHooks: {
          afterBoundary(boundary) {
            if (boundary === crashBoundary) {
              throw new Error(`CRASH:${crashBoundary}`);
            }
          },
        },
      }),
      {
        code:
          "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_SOURCE_MATERIALIZATION_FAILED",
      },
    );
    assert.deepEqual(await readdir(stageParent), ["sentinel"]);
  });

  it("transitions every legacy Node entrypoint slot to one generator-owned whole-file authority", async () => {
    const cases = [
      {
        profileId: CLI_PROFILE,
        stackPackId: "node-cli" as const,
        productSpec: genuineNodeCliProductSpecV2(),
        entrypointKind: "cli",
        sourcePath: "src/cli.ts",
        routeCount: 1,
        transitionHash: "cd8014a004d21f00ea38169f78a26a5c9790789540a0bf6d8f93e53fd99f148d",
      },
      {
        profileId: API_PROFILE,
        stackPackId: "node-express-api" as const,
        productSpec: genuineNodeExpressApiProductSpecV2(),
        entrypointKind: "api",
        sourcePath: "src/app.ts",
        routeCount: 1,
        transitionHash: "73bddefb895694fc7d5a0b50151573377c8aa24027f11c45bb86bef79ceafcf5",
      },
      {
        profileId: API_PROFILE,
        stackPackId: "node-express-api" as const,
        productSpec: twoStoryNodeExpressApiProductSpecV2(),
        entrypointKind: "api",
        sourcePath: "src/app.ts",
        routeCount: 2,
        transitionHash: "4a535961087f8a3e91603bafbeb48fb73b9c0fef5c5e440c93b9c86b3bc13f15",
      },
    ];
    for (const fixture of cases) {
      const created = await stage({ profileId: fixture.profileId });
      const deliverySelection = deliverySelectionForV2(
        fixture.productSpec,
        fixture.stackPackId,
      );
      const authorityInput = {
        productSpec: fixture.productSpec,
        deliverySelection,
      };
      const fileTree = await compileFileTreeManifestV2ForTest(
        created.handle,
        authorityInput,
      );
      assert.equal(fileTree.status, "shadow_compiled");
      if (fileTree.status !== "shadow_compiled") {
        throw new Error("Expected FileTreeV2 before Node transition");
      }
      const dependency = await materializeNodeScaffoldDependenciesV2ForTest(
        created.handle,
      );
      const buildTopology = await compileBuildTopologyV2ForTest(created.handle, {
        ...authorityInput,
        fileTree: fileTree.value,
      });
      assert.equal(buildTopology.status, "shadow_compiled");
      if (buildTopology.status !== "shadow_compiled") {
        throw new Error("Expected BuildTopologyV2 before Node transition");
      }
      const compiled = await compileNodeSemanticRuleGeneratorTransitionV2ForTest(
        created.handle,
        {
          ...authorityInput,
          fileTree: fileTree.value,
          buildTopology: buildTopology.value,
        },
      );
      assert.equal(
        compiled.status,
        "shadow_compiled",
        compiled.status === "rejected"
          ? JSON.stringify(compiled.diagnostics)
          : undefined,
      );
      if (compiled.status !== "shadow_compiled") {
        throw new Error("Expected Node rule generator transition");
      }
      const transition = compiled.value;
      assert.equal(
        NODE_ENTRYPOINT_GENERATOR_CONTRACT_HASH_V2,
        NODE_ENTRYPOINT_GENERATOR_CONTRACT_HASH_GOLDEN_V2,
      );
      assert.equal(
        NODE_SEMANTIC_RULE_GENERATOR_TRANSITION_CONTRACT_HASH_V2,
        NODE_RULE_GENERATOR_TRANSITION_CONTRACT_HASH_GOLDEN_V2,
      );
      assert.equal(Object.isFrozen(NODE_ENTRYPOINT_GENERATOR_CONTRACT_V2), true);
      assert.equal(
        Object.isFrozen(NODE_SEMANTIC_RULE_GENERATOR_TRANSITION_CONTRACT_V2),
        true,
      );
      assert.equal(NODE_SEMANTIC_RULE_GENERATOR_TRANSITION_MAX_ROUTE_COUNT_V2, 500);
      assert.equal(NODE_SEMANTIC_RULE_GENERATOR_TRANSITION_MAX_COUNT_V2, 502);
      assert.equal(
        NODE_SEMANTIC_RULE_GENERATOR_TRANSITION_CONTRACT_V2
          .completeness.maximumTransitionCount,
        502,
      );
      assert.equal(transition.transitionHash, fixture.transitionHash);
      assert.equal(transition.authority.entrypoint.entrypointKind,
        fixture.entrypointKind);
      assert.equal(transition.coverage.entrypointRegistrationCount, 1);
      assert.equal(transition.coverage.routeRegistrationCount,
        fixture.routeCount);
      assert.equal(transition.coverage.runtimeRegistrationCount, 1);
      assert.equal(transition.transitionCount, fixture.routeCount + 2);
      assert.equal(transition.transitions.every((entry) =>
        entry.source.compatibilityStatus
          === "current_v1_rule_unmigrated_v2_activation_forbidden"
        && entry.source.outputPolicy === "model_writable"
        && entry.target.ownerRef === "OWNER_NODE_ENTRYPOINT_GENERATOR_V2"
        && entry.target.modelWriteAuthority === "forbidden"
        && entry.target.outputPolicy === "deterministic_generated"
        && entry.target.declarationState === "required_unverified"), true);
      assert.equal(new Set(transition.transitions.map((entry) =>
        entry.target.entrypointPathRef)).size, 1);
      const sourcePath = fileTree.value.paths.find((entry) =>
        entry.pathRef === transition.authority.entrypoint.pathRef);
      assert.equal(sourcePath?.normalizedLocator, fixture.sourcePath);
      assert.equal(
        JSON.stringify(transition).includes(buildTopology.value.manifestHash),
        false,
      );
      assert.equal(
        JSON.stringify(transition).includes(dependency.receiptHash),
        false,
      );
      assert.doesNotMatch(
        JSON.stringify(transition),
        /setfarm-f4-stage-v2|\/private\/|\/var\/folders|\/Users\//,
      );
      assert.equal(
        NodeSemanticRuleGeneratorTransitionV2Schema.safeParse(transition).success,
        true,
      );
      assert.equal(compiled.canonicalBytes, canonicalJsonStringify(transition));
      assertRecursivelyFrozen(compiled);

      const verified =
        await verifyNodeSemanticRuleGeneratorTransitionV2ForTest(created.handle, {
          ...authorityInput,
          fileTree: fileTree.value,
          buildTopology: buildTopology.value,
          candidate: transition,
        });
      assert.equal(verified.value.transitionHash, transition.transitionHash);
      assertRecursivelyFrozen(verified);

      const wrongScope = await compileNodeSemanticRuleGeneratorTransitionV2(
        created.handle,
        {
          ...authorityInput,
          fileTree: fileTree.value,
          buildTopology: buildTopology.value,
        },
      );
      assert.equal(wrongScope.status, "rejected");
      assert.equal(
        wrongScope.diagnostics[0]?.code,
        "NODE_RULE_GENERATOR_TRANSITION_V2_PRODUCTION_AUTHORITY_REQUIRED",
      );

      if (fixture.profileId === CLI_PROFILE) {
        const extraInput =
          await compileNodeSemanticRuleGeneratorTransitionV2ForTest(
            created.handle,
            {
              ...authorityInput,
              fileTree: fileTree.value,
              buildTopology: buildTopology.value,
              rules: [],
            },
          );
        assert.equal(extraInput.status, "rejected");
        assert.equal(
          extraInput.diagnostics[0]?.code,
          "NODE_RULE_GENERATOR_TRANSITION_V2_INPUT_INVALID",
        );
      }

      const selfRehashedLogical = structuredClone(transition) as any;
      selfRehashedLogical.authority.buildTopology.logicalBuildHash = "f".repeat(64);
      selfRehashedLogical.transitionHash =
        hashNodeSemanticRuleGeneratorTransitionV2(selfRehashedLogical);
      assert.equal(
        NodeSemanticRuleGeneratorTransitionV2Schema.safeParse(
          selfRehashedLogical,
        ).success,
        true,
      );
      await assert.rejects(
        verifyNodeSemanticRuleGeneratorTransitionV2ForTest(created.handle, {
          ...authorityInput,
          fileTree: fileTree.value,
          buildTopology: buildTopology.value,
          candidate: selfRehashedLogical,
        }),
        (error: unknown) =>
          error instanceof NodeSemanticRuleGeneratorTransitionVerificationErrorV2
          && error.code
            === "NODE_RULE_GENERATOR_TRANSITION_V2_VERIFICATION_AUTHORITY_MISMATCH",
      );

      if (fixture.routeCount > 1) {
        const omitted = structuredClone(transition) as any;
        const routeIndex = omitted.transitions.findIndex((entry: any) =>
          entry.source.responsibility === "route_registration");
        omitted.transitions.splice(routeIndex, 1);
        omitted.transitionCount = omitted.transitions.length;
        omitted.coverage.sourceRequirementCount = omitted.transitions.length;
        omitted.coverage.transitionCount = omitted.transitions.length;
        omitted.coverage.routeRegistrationCount -= 1;
        omitted.authority.entrypoint.requirementCount = omitted.transitions.length;
        omitted.transitionMembershipHash =
          hashNodeSemanticRuleGeneratorTransitionMembershipV2(
            omitted.transitions,
          );
        omitted.transitionHash = hashNodeSemanticRuleGeneratorTransitionV2(omitted);
        assert.equal(
          NodeSemanticRuleGeneratorTransitionV2Schema.safeParse(omitted).success,
          true,
        );
        await assert.rejects(
          verifyNodeSemanticRuleGeneratorTransitionV2ForTest(created.handle, {
            ...authorityInput,
            fileTree: fileTree.value,
            buildTopology: buildTopology.value,
            candidate: omitted,
          }),
          (error: unknown) =>
            error instanceof NodeSemanticRuleGeneratorTransitionVerificationErrorV2
            && error.code
              === "NODE_RULE_GENERATOR_TRANSITION_V2_VERIFICATION_AUTHORITY_MISMATCH",
        );
      }

      if (fixture.profileId === CLI_PROFILE) {
        const sibling = await stage({ profileId: CLI_PROFILE });
        const siblingFileTree = await compileFileTreeManifestV2ForTest(
          sibling.handle,
          authorityInput,
        );
        assert.equal(siblingFileTree.status, "shadow_compiled");
        if (siblingFileTree.status !== "shadow_compiled") {
          throw new Error("Expected sibling FileTreeV2");
        }
        await materializeNodeScaffoldDependenciesV2ForTest(sibling.handle);
        const siblingTopology = await compileBuildTopologyV2ForTest(sibling.handle, {
          ...authorityInput,
          fileTree: siblingFileTree.value,
        });
        assert.equal(siblingTopology.status, "shadow_compiled");
        if (siblingTopology.status !== "shadow_compiled") {
          throw new Error("Expected sibling BuildTopologyV2");
        }
        const siblingTransition =
          await compileNodeSemanticRuleGeneratorTransitionV2ForTest(sibling.handle, {
            ...authorityInput,
            fileTree: siblingFileTree.value,
            buildTopology: siblingTopology.value,
          });
        assert.equal(siblingTransition.status, "shadow_compiled");
        if (siblingTransition.status !== "shadow_compiled") {
          throw new Error("Expected sibling Node transition");
        }
        assert.notEqual(
          siblingTopology.value.manifestHash,
          buildTopology.value.manifestHash,
        );
        assert.equal(
          siblingTransition.value.transitionHash,
          transition.transitionHash,
        );
      }
    }
  });

  it("preclaims one install atomically and never reruns unchanged source", async () => {
    const created = await stage();
    const [first, second] = await Promise.allSettled([
      materializeNodeScaffoldDependenciesV2ForTest(created.handle),
      materializeNodeScaffoldDependenciesV2ForTest(created.handle),
    ]);
    const fulfilled = [first, second].filter((result) => result.status === "fulfilled");
    const rejected = [first, second].filter((result) => result.status === "rejected");
    assert.equal(fulfilled.length, 1);
    assert.equal(rejected.length, 1);
    assert.equal(
      (rejected[0] as PromiseRejectedResult).reason.code,
      "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_INSTALL_ALREADY_CONSUMED",
    );
    assert.equal(installInvocations.length, 1);
    assert.equal(inspectBuildDependencyMaterializationReceiptV2(created.handle).status,
      "dependencies_materialized_verified");
  });

  it("consumes failed process attempts once and cleans only their authenticated stage", async () => {
    const failures: HostNodeToolchainProbeResultV2[] = [
      nonzero("npm ERR! engine mismatch\n"),
      Object.freeze({ status: "timed_out", stdout: "", stderr: "" }),
      Object.freeze({ status: "output_limit_exceeded", stdout: "x", stderr: "" }),
      Object.freeze({ status: "spawn_failed", stdout: "", stderr: "spawn failed" }),
      Object.freeze({
        status: "exited",
        exitCode: null,
        signal: "SIGTERM",
        stdout: "",
        stderr: "",
      }),
    ];
    for (const result of failures) {
      const created = await stage();
      const attemptRoot = await onlyAttemptRoot(created.stageParent);
      installControls.set(CLI_PROFILE, { result });
      await assert.rejects(materializeNodeScaffoldDependenciesV2ForTest(created.handle), {
        code: "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_DEPENDENCY_INSTALL_FAILED",
      });
      assert.equal(existsSync(attemptRoot), false);
      await assert.rejects(revalidateNodeScaffoldExecutionEnvironmentV2(
        created.environmentHandle,
      ), {
        code: "NODE_SCAFFOLD_EXECUTION_ENVIRONMENT_V2_INSTALL_ALREADY_CONSUMED",
      });
      installControls.clear();
    }
  });

  it("rejects unexpected bins, hidden-lock members and hard links after npm exits zero", async () => {
    const mutations: Array<(projectRoot: string) => Promise<void>> = [
      async (projectRoot) => {
        const linkPath = path.join(projectRoot, "node_modules", ".bin", "tsc");
        await unlink(linkPath);
        await symlink("../undici-types/package.json", linkPath);
      },
      async (projectRoot) => {
        const hiddenPath = path.join(projectRoot, "node_modules", ".package-lock.json");
        const hidden = JSON.parse(await readFile(hiddenPath, "utf8")) as {
          packages: Record<string, unknown>;
        };
        hidden.packages["node_modules/foreign"] = {
          version: "1.0.0",
          resolved: "https://registry.npmjs.org/foreign/-/foreign-1.0.0.tgz",
          integrity: "sha512-foreign",
        };
        await writeFile(hiddenPath, `${JSON.stringify(hidden)}\n`);
      },
      async (projectRoot) => {
        const packageJson = path.join(projectRoot, "node_modules", "typescript", "package.json");
        await link(packageJson, `${packageJson}.alias`);
      },
    ];
    for (const afterInstall of mutations) {
      const created = await stage();
      const attemptRoot = await onlyAttemptRoot(created.stageParent);
      installControls.set(CLI_PROFILE, { afterInstall });
      await assert.rejects(materializeNodeScaffoldDependenciesV2ForTest(created.handle), {
        code: "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_DEPENDENCY_GRAPH_INVALID",
      });
      assert.equal(existsSync(attemptRoot), false);
      installControls.clear();
    }
  });

  it("freshly detects raw-install and normalized-capsule drift", async () => {
    const rawCreated = await stage();
    await materializeNodeScaffoldDependenciesV2ForTest(rawCreated.handle);
    const rawAttempt = await onlyAttemptRoot(rawCreated.stageParent);
    await chmod(path.join(
      rawAttempt,
      "project",
      "node_modules",
      "typescript",
      "package.json",
    ), 0o666);
    await assert.rejects(revalidateNodeScaffoldDependenciesV2(rawCreated.handle));

    const capsuleCreated = await stage();
    const capsuleReceipt = await materializeNodeScaffoldDependenciesV2ForTest(
      capsuleCreated.handle,
    );
    const capsuleAttempt = await onlyAttemptRoot(capsuleCreated.stageParent);
    const capsuleFile = capsuleReceipt.dependencyCapsule.entries.find((entry) =>
      entry.type === "file");
    assert.ok(capsuleFile);
    await chmod(path.join(capsuleAttempt, "dependency-capsule", capsuleFile.path), 0o644);
    await assert.rejects(revalidateNodeScaffoldDependenciesV2(capsuleCreated.handle), {
      code: "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_STATE_DRIFT",
    });
  });

  it("keeps semantic input stable while concurrent physical attempts remain unique", async () => {
    const firstEnvironment = await environment();
    const secondEnvironment = await environment();
    const firstParent = await privateParent("concurrent-a");
    const secondParent = await privateParent("concurrent-b");
    const assets = assetSets.get(CLI_PROFILE)!;
    const [first, second] = await Promise.all([
      materializeNodeScaffoldPrivateStageV2ForTest({
        environment: firstEnvironment,
        scratchParent: firstParent,
        ...assets,
      }),
      materializeNodeScaffoldPrivateStageV2ForTest({
        environment: secondEnvironment,
        scratchParent: secondParent,
        ...assets,
      }),
    ]);
    activeStages.push(first, second);
    const firstReceipt = inspectScaffoldBaseMaterializationReceiptV2(first);
    const secondReceipt = inspectScaffoldBaseMaterializationReceiptV2(second);
    assert.notEqual(firstReceipt.environmentBinding.receiptHash,
      secondReceipt.environmentBinding.receiptHash);
    assert.equal(firstReceipt.environmentBinding.effectiveConfigHash,
      secondReceipt.environmentBinding.effectiveConfigHash);
    assert.equal(firstReceipt.semanticInputHash, secondReceipt.semanticInputHash);
    assert.equal(firstReceipt.baseStateHash, secondReceipt.baseStateHash);
    assert.notEqual(firstReceipt.privateAttempt.rootIdentityHash,
      secondReceipt.privateAttempt.rootIdentityHash);
    assert.notEqual(firstReceipt.receiptHash, secondReceipt.receiptHash);
    assert.notEqual(await onlyAttemptRoot(firstParent), await onlyAttemptRoot(secondParent));
  });

  it("joins both product-neutral profiles and rejects cross-profile byte authority", async () => {
    for (const profileId of [CLI_PROFILE, API_PROFILE]) {
      const created = await stage({ profileId });
      const receipt = inspectScaffoldBaseMaterializationReceiptV2(created.handle);
      assert.equal(receipt.catalogBinding.profileId, profileId);
      assert.equal(receipt.catalogBinding.entryRef,
        profileId === CLI_PROFILE
          ? "NODE_SCAFFOLD_TOOLCHAIN_NODE_CLI_V2"
          : "NODE_SCAFFOLD_TOOLCHAIN_NODE_EXPRESS_API_V2");
    }
    const environmentHandle = await environment(CLI_PROFILE);
    const stageParent = await privateParent("cross-profile");
    await assert.rejects(materializeNodeScaffoldPrivateStageV2ForTest({
      environment: environmentHandle,
      scratchParent: stageParent,
      ...assetSets.get(CLI_PROFILE)!,
      packageManifest: assetSets.get(API_PROFILE)!.packageManifest,
    }), {
      code: "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_ASSET_AUTHORITY_INVALID",
    });
    assert.deepEqual(await readdir(stageParent), []);
  });

  it("rejects forged handles, extra or accessor input, unsafe parents and scope promotion", async () => {
    const environmentHandle = await environment();
    const stageParent = await privateParent("invalid-input");
    const assets = assetSets.get(CLI_PROFILE)!;
    await assert.rejects(materializeNodeScaffoldPrivateStageV2({
      environment: environmentHandle,
      ...assets,
    }), {
      code: "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_PRODUCTION_AUTHORITY_REQUIRED",
    });
    await assert.rejects(materializeNodeScaffoldPrivateStageV2ForTest({
      environment: environmentHandle,
      scratchParent: stageParent,
      ...assets,
      extra: true,
    } as never), {
      code: "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_INPUT_INVALID",
    });
    let getterInvoked = false;
    const accessor = Object.defineProperty({
      dependencyLockManifest: assets.dependencyLockManifest,
      environment: environmentHandle,
      packageManifest: assets.packageManifest,
      scratchParent: stageParent,
    }, "typescriptCompilerConfig", {
      enumerable: true,
      get() {
        getterInvoked = true;
        return assets.typescriptCompilerConfig;
      },
    });
    await assert.rejects(materializeNodeScaffoldPrivateStageV2ForTest(accessor as never), {
      code: "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_INPUT_INVALID",
    });
    assert.equal(getterInvoked, false);
    await chmod(stageParent, 0o755);
    await assert.rejects(materializeNodeScaffoldPrivateStageV2ForTest({
      environment: environmentHandle,
      scratchParent: stageParent,
      ...assets,
    }), {
      code: "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_INPUT_INVALID",
    });
    assert.throws(
      () => new MaterializedNodeScaffoldPrivateStageV2({}, {} as never),
      { code: "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_HANDLE_UNAUTHENTICATED" },
    );
    assert.throws(
      () => inspectScaffoldBaseMaterializationReceiptV2({} as never),
      { code: "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_HANDLE_UNAUTHENTICATED" },
    );
  });

  it("detects file, topology, hard-link, npmrc and case-fold drift on fresh replay", async () => {
    const mutations: Array<(projectRoot: string) => Promise<void>> = [
      async (projectRoot) => {
        await chmod(path.join(projectRoot, "package.json"), 0o644);
      },
      async (projectRoot) => {
        await writeFile(path.join(projectRoot, ".npmrc"), "registry=https://attacker.invalid\n");
      },
      async (projectRoot) => {
        try {
          await writeFile(path.join(projectRoot, "Package.json"), "{}\n", { flag: "wx" });
        } catch (error) {
          if (!["EACCES", "EEXIST"].includes((error as NodeJS.ErrnoException).code ?? "")) {
            throw error;
          }
          // A case-insensitive filesystem rejects the collision before the
          // materializer needs to; retain an extra-member topology attack.
          await writeFile(path.join(projectRoot, "foreign.json"), "{}\n");
        }
      },
      async (projectRoot) => {
        const target = path.join(projectRoot, "package.json");
        const replacement = path.join(projectRoot, "package.json.replacement");
        await link(target, replacement);
      },
      async (projectRoot) => {
        await mkdir(path.join(projectRoot, "node_modules"));
      },
    ];
    for (const mutate of mutations) {
      const created = await stage();
      const attemptRoot = await onlyAttemptRoot(created.stageParent);
      await mutate(path.join(attemptRoot, "project"));
      await assert.rejects(revalidateNodeScaffoldPrivateStageV2(created.handle), {
        code: "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_STATE_DRIFT",
      });
      destroyNodeScaffoldPrivateStageV2(created.handle);
    }
  });

  it("cleans only its authenticated attempt after every injected fsync boundary failure", async () => {
    const boundaries: readonly NodeScaffoldPrivateMaterializerCrashBoundaryV2[] = [
      "after_private_root_fsync",
      "after_layout_fsync",
      "after_package_lock_fsync",
      "after_package_json_fsync",
      "after_tsconfig_fsync",
      "after_project_fsync",
      "after_final_capture",
    ];
    const environmentHandle = await environment();
    for (const boundary of boundaries) {
      const stageParent = await privateParent(`crash-${boundary}`);
      const sentinel = path.join(stageParent, "sentinel");
      await writeFile(sentinel, "foreign\n", { mode: 0o600 });
      await assert.rejects(materializeNodeScaffoldPrivateStageV2ForTest({
        environment: environmentHandle,
        scratchParent: stageParent,
        ...assetSets.get(CLI_PROFILE)!,
        testHooks: {
          afterBoundary(observed) {
            if (observed === boundary) throw new Error(`CRASH:${boundary}`);
          },
        },
      }), (error: unknown) =>
        error instanceof NodeScaffoldPrivateMaterializerErrorV2
        && error.code === "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_MATERIALIZATION_FAILED");
      assert.deepEqual(await readdir(stageParent), ["sentinel"]);
    }
  });

  it("does not erase a replacement root when failure cleanup loses physical ownership", async () => {
    const environmentHandle = await environment();
    const stageParent = await privateParent("crash-replacement");
    let attemptRoot = "";
    let displaced = "";
    await assert.rejects(materializeNodeScaffoldPrivateStageV2ForTest({
      environment: environmentHandle,
      scratchParent: stageParent,
      ...assetSets.get(CLI_PROFILE)!,
      testHooks: {
        afterBoundary(boundary) {
          if (boundary !== "after_layout_fsync") return;
          const attemptName = readdirSync(stageParent).find((name) => name.startsWith("attempt-"));
          assert.ok(attemptName);
          attemptRoot = path.join(stageParent, attemptName);
          displaced = `${attemptRoot}-displaced`;
          renameSync(attemptRoot, displaced);
          mkdirSync(attemptRoot, { mode: 0o700 });
          throw new Error("CRASH_AFTER_REPLACEMENT");
        },
      },
    }), {
      code: "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_MATERIALIZATION_FAILED",
    });
    assert.equal(existsSync(attemptRoot), true);
    assert.equal(existsSync(displaced), true);
    await rm(attemptRoot, { recursive: true, force: true });
    await rm(displaced, { recursive: true, force: true });
  });

  it("refuses to delete a replacement root while preserving both physical trees", async () => {
    const created = await stage();
    const attemptRoot = await onlyAttemptRoot(created.stageParent);
    const displaced = `${attemptRoot}-displaced`;
    await rename(attemptRoot, displaced);
    await mkdir(attemptRoot, { mode: 0o700 });
    await assert.rejects(async () => destroyNodeScaffoldPrivateStageV2(created.handle), {
      code: "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_STATE_DRIFT",
    });
    assert.equal(existsSync(attemptRoot), true);
    assert.equal(existsSync(displaced), true);
    await rm(attemptRoot, { recursive: true, force: true });
    await rm(displaced, { recursive: true, force: true });
  });

  it("fails closed when an authenticated source handle is replaced by receipt-shaped data", async () => {
    const environmentHandle = await environment();
    const stageParent = await privateParent("forged-byte-handle");
    const assets = assetSets.get(CLI_PROFILE)!;
    await assert.rejects(materializeNodeScaffoldPrivateStageV2ForTest({
      environment: environmentHandle,
      scratchParent: stageParent,
      ...assets,
      packageManifest: { receipt: assets.packageManifest.receipt } as never,
    }), {
      code: "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_ASSET_AUTHORITY_INVALID",
    });
    assert.deepEqual(await readdir(stageParent), []);
  });
});
