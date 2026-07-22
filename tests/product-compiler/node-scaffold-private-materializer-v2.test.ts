import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
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

import { createArtifactIndexForTests as createArtifactIndex } from
  "../../src/product-compiler/artifact-index.js";
import { canonicalJsonStringify } from
  "../../src/product-compiler/canonical-json.js";
import {
  createHybridArtifactStoreCapacityLeaseProviderV1,
} from "../../src/product-compiler/artifact-store-authority.js";
import { ContentAddressedArtifactStore } from
  "../../src/product-compiler/artifact-store.js";
import {
  createDeepByteBundleCasAuthorityV2,
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
  revalidateNodeScaffoldExecutionEnvironmentV2,
  type NodeScaffoldExecutionEnvironmentV2,
} from "../../src/product-compiler/node-scaffold-execution-environment-v2.js";
import {
  MaterializedNodeScaffoldPrivateStageV2,
  NodeScaffoldPrivateMaterializerErrorV2,
  destroyNodeScaffoldPrivateStageV2,
  getCodeOwnedPrivateStagedMaterializerAuthorityV2,
  inspectScaffoldBaseMaterializationReceiptV2,
  inspectBuildDependencyMaterializationReceiptV2,
  isProductionNodeScaffoldPrivateStageV2,
  materializeNodeScaffoldPrivateStageV2,
  materializeNodeScaffoldPrivateStageV2ForTest,
  materializeNodeScaffoldDependenciesV2,
  materializeNodeScaffoldDependenciesV2ForTest,
  revalidateNodeScaffoldDependenciesV2,
  revalidateNodeScaffoldPrivateStageV2,
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
  "70276cf52b8dc844e1d60f5bf11203b17f5623126c433a184bcf301cfe231896";
const NODE_PRODUCT_RUNTIME_PROGRAM_CONTRACT_HASH_GOLDEN_V2 =
  "5443c8c68e178ec3cce5a94857918dae195848e4f33e8ec751e0154b6fc97a46";
const NODE_ENTRYPOINT_GENERATOR_CONTRACT_HASH_GOLDEN_V2 =
  "52b95411113b302c8993e8d3debc712831955cb72a8b91a0226e40941a86933a";
const NODE_RULE_GENERATOR_TRANSITION_CONTRACT_HASH_GOLDEN_V2 =
  "6ea5bb30efdd5b98229bb0ca7e13bffbbc8601eadcd7a76b362cbd2d7bc0f10a";
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

const installControls = new Map<NodeScaffoldProfileIdV2, InstallControlV2>();
const installInvocations: HostNodeToolchainProbeInvocationV2[] = [];

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
): Promise<void> {
  const entry = getCodeOwnedNodeScaffoldToolchainEntryV2(profileId)!;
  const rootLock = JSON.parse(await readFile(path.join(projectRoot, "package-lock.json"), "utf8")) as {
    name: string;
    version: string;
    packages: Record<string, Record<string, unknown>>;
  };
  const nodeModulesRoot = path.join(projectRoot, "node_modules");
  await mkdir(nodeModulesRoot, { mode: 0o700 });
  await chmod(nodeModulesRoot, 0o700);
  const hiddenPackages: Record<string, Record<string, unknown>> = {};
  for (const node of entry.dependencyGraph.nodes) {
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
  let hostFixture: HostFixtureV2;
  const hosts = new Map<NodeScaffoldProfileIdV2, HostNodeToolchainAuthorityV2>();
  const assetSets = new Map<NodeScaffoldProfileIdV2, AssetSetV2>();
  const activeStages: MaterializedNodeScaffoldPrivateStageV2[] = [];
  const activeEnvironments: NodeScaffoldExecutionEnvironmentV2[] = [];

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
      "e4de05ba5910f719656c21dcf2de0569300c9ff2aabd20567304eaffccd2d75d",
      "f30c83809cbd46216973dd14a3fb6f8485975e3b54893f88e0b3e4a3a5a60f12",
      "391d6bde7cf4d513f199cee7872f1428f185145ed1eb07b5868b156a23aa2720",
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
      "4bca861764adf8af19a773c72f917120b5c2a5c50394a1ec59f644fb5b2d3f61",
      "af7be152b7f815156af7f6ed005c5aaee56b525d62f87da2bb1c7c8aadc48a07",
      "563e57b001b37ed888443e29f479ad9d8dffe1563d6c9512e269ec55d8b7bc69",
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
      }
    }

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
