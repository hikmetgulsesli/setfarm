import assert from "node:assert/strict";
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
  unlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, afterEach, before, describe, it } from "node:test";

import { createArtifactIndexForTests as createArtifactIndex } from
  "../../src/product-compiler/artifact-index.js";
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
import { IndexedArtifactPublisher } from
  "../../src/product-compiler/indexed-artifact-publisher.js";
import {
  createNodeScaffoldExecutionEnvironmentV2ForTest,
  destroyNodeScaffoldExecutionEnvironmentV2,
  type NodeScaffoldExecutionEnvironmentV2,
} from "../../src/product-compiler/node-scaffold-execution-environment-v2.js";
import {
  MaterializedNodeScaffoldPrivateStageV2,
  NodeScaffoldPrivateMaterializerErrorV2,
  destroyNodeScaffoldPrivateStageV2,
  getCodeOwnedPrivateStagedMaterializerAuthorityV2,
  inspectScaffoldBaseMaterializationReceiptV2,
  isProductionNodeScaffoldPrivateStageV2,
  materializeNodeScaffoldPrivateStageV2,
  materializeNodeScaffoldPrivateStageV2ForTest,
  revalidateNodeScaffoldPrivateStageV2,
  type NodeScaffoldPrivateMaterializerCrashBoundaryV2,
} from "../../src/product-compiler/node-scaffold-private-materializer-v2.js";
import {
  getCodeOwnedNodeScaffoldAssetPublicationV2,
  verifyCodeOwnedNodeScaffoldAssetByteBundleV2,
  type NodeScaffoldAssetRoleV2,
  type NodeScaffoldProfileIdV2,
} from "../../src/product-compiler/node-scaffold-toolchain-catalog-v2.js";
import {
  PrivateStagedMaterializerAuthorityV2Schema,
  ScaffoldBaseMaterializationReceiptV2Schema,
} from "../../src/product-compiler/schemas/node-scaffold-private-materialization-v2.js";
import {
  createIsolatedTestDatabase,
  type TestDatabase,
} from "../execution-attempts/test-database.js";

const LIMITS = Object.freeze({
  maxPayloadBytes: 4 * 1024 * 1024,
  rootQuotaBytes: 256 * 1024 * 1024,
  minFreeBytes: 0,
});
const CLI_PROFILE = "PROFILE_NODE_CLI_STATELESS_EXACT_V2" as const;
const API_PROFILE = "PROFILE_NODE_EXPRESS_API_STATELESS_EXACT_V2" as const;
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

function exited(stdout: string, stderr = ""): HostNodeToolchainProbeResultV2 {
  return Object.freeze({
    status: "exited",
    exitCode: 0,
    signal: null,
    stdout,
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

function hostAdapter(fixture: HostFixtureV2) {
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
    return exited(`${JSON.stringify(effectiveConfig(invocation), null, 2)}\n`);
  };
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
        probeAdapter: hostAdapter(hostFixture),
      }));
    }
  });

  afterEach(() => {
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
    assert.equal(authority.activation, "scaffold_base_only_dependency_install_blocked");
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
