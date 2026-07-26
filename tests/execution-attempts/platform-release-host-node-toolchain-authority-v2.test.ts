import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  chmod,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  realpath,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, it } from "node:test";

import {
  canonicalJsonStringify,
  hashCanonicalJson,
} from
  "../../src/product-compiler/canonical-json.js";
import {
  createHostNodeToolchainAuthorityV2ForTest,
  type HostNodeToolchainAuthorityV2,
  type HostNodeToolchainProbeInvocationV2,
  type HostNodeToolchainProbeResultV2,
} from
  "../../src/product-compiler/host-node-toolchain-authority-v2.js";
import {
  PlatformReleaseHostNodeToolchainAuthorityErrorV2,
  PlatformReleaseHostNodeToolchainAuthorityV2,
  createPlatformReleaseHostNodeToolchainAuthorityV2,
  createPlatformReleaseHostNodeToolchainAuthorityV2ForTest,
  executePlatformReleaseHostNodeToolchainBuildInternalV2,
  executePlatformReleaseHostNodeToolchainNpmCiInternalV2,
  inspectPlatformReleaseHostNodeToolchainReceiptV2,
  isProductionPlatformReleaseHostNodeToolchainAuthorityV2,
  revalidatePlatformReleaseHostNodeToolchainAuthorityV2,
  type PlatformReleaseHostNodeToolchainBuildEvidenceV2,
  type PlatformReleaseHostNodeToolchainNpmCiEvidenceV2,
} from
  "../../src/execution/platform-release-host-node-toolchain-authority-v2.js";
import {
  PlatformReleaseHostNodeToolchainReceiptV2Schema,
  hashPlatformReleaseHostNodeToolchainReceiptV2,
  parsePlatformReleaseHostNodeToolchainReceiptCandidateV2,
} from
  "../../src/execution/schemas/platform-release-host-node-toolchain-v2.js";
import {
  PlatformReleaseHostNodeToolchainBuildEvidenceV2Schema,
  hashPlatformReleaseHostNodeToolchainBuildEvidenceV2,
} from
  "../../src/execution/schemas/platform-release-host-node-build-evidence-v2.js";

type FixtureV2 = Readonly<{
  root: string;
  node: string;
  npmRoot: string;
  npmCli: string;
  dynamicLibrary: string;
}>;

const cleanupRoots: string[] = [];
const BUILD_SOURCE_SHA_V2 = "a".repeat(40);
const BUILD_SOURCE_EPOCH_V2 = "1700000000";
const BUILD_TOOLCHAIN_HASH_V2 = "b".repeat(64);

function platformBuildResultV2() {
  return Object.freeze({
    schema:
      "setfarm.build-platform-release-command-result.v2" as const,
    version: "2.0.0" as const,
    sourceFingerprintHash: "c".repeat(64),
    sourceFileCount: 2,
    sourceDirectoryCount: 1,
    sourceTotalBytes: 2,
    sourceSha: BUILD_SOURCE_SHA_V2,
    sourceDateEpoch: BUILD_SOURCE_EPOCH_V2,
    buildToolchainTreeHash: BUILD_TOOLCHAIN_HASH_V2,
    buildToolchainFileCount: 1,
    buildToolchainDirectoryCount: 2,
    buildToolchainTotalBytes: 1,
    compilerEntryHash: "d".repeat(64),
    platformFileCount: 1,
    platformDirectoryCount: 1,
    platformTotalBytes: 1,
    outputLayout:
      "payload_dist_and_package_json_only" as const,
    productionUse:
      "forbidden_until_dependency_materialization_and_manifest_verification" as const,
  });
}

function exited(
  stdout: string,
  stderr = "",
): HostNodeToolchainProbeResultV2 {
  return Object.freeze({
    status: "exited",
    exitCode: 0,
    signal: null,
    stdout,
    stderr,
  });
}

function hasWrappedBuildCauseV2(
  error: unknown,
  expectedCauseCode: string,
): boolean {
  return error
    instanceof PlatformReleaseHostNodeToolchainAuthorityErrorV2
    && error.code
      === "PLATFORM_RELEASE_HOST_NODE_TOOLCHAIN_V2_BUILD_FAILED"
    && typeof error.cause === "object"
    && error.cause !== null
    && "code" in error.cause
    && error.cause.code === expectedCauseCode;
}

async function makeFixtureV2(): Promise<FixtureV2> {
  const root = await realpath(
    await mkdtemp(
      path.join(tmpdir(), "setfarm-platform-host-v2-"),
    ),
  );
  cleanupRoots.push(root);
  const node = path.join(root, "bin", "node");
  const npmRoot = path.join(root, "lib", "node_modules", "npm");
  const npmCli = path.join(npmRoot, "bin", "npm-cli.js");
  const dynamicLibrary =
    path.join(root, "lib", "libnode.127.dylib");
  await mkdir(path.dirname(node), { recursive: true });
  await mkdir(path.dirname(npmCli), { recursive: true });
  await mkdir(path.join(npmRoot, "lib"), { recursive: true });
  await writeFile(node, "fixture-node-binary\n", { mode: 0o555 });
  await writeFile(
    npmCli,
    "require('../lib/cli.js')(process)\n",
    { mode: 0o555 },
  );
  await writeFile(
    path.join(npmRoot, "lib", "cli.js"),
    "module.exports = () => {}\n",
    { mode: 0o444 },
  );
  await writeFile(
    path.join(npmRoot, "package.json"),
    `${JSON.stringify({
      name: "npm",
      version: "10.9.8",
      bin: { npm: "bin/npm-cli.js" },
    })}\n`,
    { mode: 0o444 },
  );
  await writeFile(dynamicLibrary, "fixture-dylib\n", {
    mode: 0o555,
  });
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
  return { root, node, npmRoot, npmCli, dynamicLibrary };
}

function probeAdapterV2(
  fixture: FixtureV2,
  calls: HostNodeToolchainProbeInvocationV2[],
  onPlatformBuild?: (
    invocation: HostNodeToolchainProbeInvocationV2,
  ) => Promise<HostNodeToolchainProbeResultV2>,
) {
  return async (
    invocation: HostNodeToolchainProbeInvocationV2,
  ): Promise<HostNodeToolchainProbeResultV2> => {
    calls.push(invocation);
    if (
      invocation.probeRef
        === "HOST_NODE_RUNTIME_IDENTITY_PROBE_V2"
    ) {
      return exited(`${JSON.stringify({
        version: "22.23.1",
        modulesAbi: "127",
        napiVersion: "10",
        platform: "darwin",
        architecture: "arm64",
        execPath: fixture.node,
      })}\n`);
    }
    if (invocation.probeRef === "HOST_NPM_VERSION_PROBE_V2") {
      return exited("10.9.8\n");
    }
    if (
      invocation.probeRef
        === "HOST_NPM_PLATFORM_RELEASE_BUILD_INSTALL_V2"
    ) {
      return exited("installed exact release build graph\n");
    }
    if (
      invocation.probeRef
        === "HOST_NODE_PLATFORM_RELEASE_BUILD_V2"
    ) {
      if (onPlatformBuild) return onPlatformBuild(invocation);
      const outputIndex = invocation.argv.indexOf("--output-root");
      const outputRoot = invocation.argv[outputIndex + 1];
      assert.ok(outputIndex >= 0);
      assert.ok(outputRoot);
      await mkdir(path.join(outputRoot, "payload"), {
        mode: 0o700,
      });
      return exited(
        `${canonicalJsonStringify(platformBuildResultV2())}\n`,
      );
    }
    return exited("");
  };
}

async function hostAuthorityV2(
  fixture: FixtureV2,
  profileId:
    | "PROFILE_NODE_CLI_STATELESS_EXACT_V2"
    | "PROFILE_NODE_EXPRESS_API_STATELESS_EXACT_V2",
  calls: HostNodeToolchainProbeInvocationV2[] = [],
  onPlatformBuild?: (
    invocation: HostNodeToolchainProbeInvocationV2,
  ) => Promise<HostNodeToolchainProbeResultV2>,
): Promise<HostNodeToolchainAuthorityV2> {
  return createHostNodeToolchainAuthorityV2ForTest({
    profileId,
    fixture: {
      candidateRoot: fixture.root,
      host: {
        platform: "darwin",
        architecture: "arm64",
        macosProductVersion: "26.5.2",
        macosBuildVersion: "25F84",
        darwinKernelRelease: "25.5.0",
      },
      nonSystemDynamicLibraryPaths: [fixture.dynamicLibrary],
    },
    probeAdapter: probeAdapterV2(
      fixture,
      calls,
      onPlatformBuild,
    ),
  });
}

async function makeInstallScopeV2() {
  const environmentRoot = await realpath(
    await mkdtemp(
      path.join(tmpdir(), "setfarm-platform-env-v2-"),
    ),
  );
  cleanupRoots.push(environmentRoot);
  for (const name of ["cache", "config-probe", "home", "tmp"]) {
    await mkdir(path.join(environmentRoot, name), {
      mode: 0o700,
    });
  }
  await writeFile(
    path.join(environmentRoot, "global.npmrc"),
    "\n",
    { mode: 0o600 },
  );
  await writeFile(
    path.join(environmentRoot, "user.npmrc"),
    "\n",
    { mode: 0o600 },
  );
  await chmod(environmentRoot, 0o700);

  const installRoot = await realpath(
    await mkdtemp(
      path.join(tmpdir(), "setfarm-platform-install-v2-"),
    ),
  );
  cleanupRoots.push(installRoot);
  const projectRoot = path.join(installRoot, "project");
  await mkdir(
    path.join(installRoot, "dependency-capsule"),
    { mode: 0o700 },
  );
  await mkdir(projectRoot, { mode: 0o700 });
  for (const name of [
    "package-lock.json",
    "package.json",
    "tsconfig.json",
  ]) {
    await writeFile(
      path.join(projectRoot, name),
      `${JSON.stringify({ name })}\n`,
      { mode: 0o444 },
    );
    await chmod(path.join(projectRoot, name), 0o444);
  }
  await chmod(installRoot, 0o700);
  return {
    privateRoot: environmentRoot,
    projectRoot,
    environment: Object.freeze({
      CI: "true" as const,
      HOME: path.join(environmentRoot, "home"),
      LANG: "C.UTF-8" as const,
      LC_ALL: "C.UTF-8" as const,
      NODE_DISABLE_COMPILE_CACHE: "1" as const,
      NO_COLOR: "1" as const,
      NPM_CONFIG_CACHE: path.join(environmentRoot, "cache"),
      NPM_CONFIG_ENGINE_STRICT: "true" as const,
      NPM_CONFIG_GLOBALCONFIG:
        path.join(environmentRoot, "global.npmrc"),
      NPM_CONFIG_LOGS_MAX: "0" as const,
      NPM_CONFIG_REGISTRY:
        "https://registry.npmjs.org" as const,
      NPM_CONFIG_USERCONFIG:
        path.join(environmentRoot, "user.npmrc"),
      TEMP: path.join(environmentRoot, "tmp"),
      TMP: path.join(environmentRoot, "tmp"),
      TMPDIR: path.join(environmentRoot, "tmp"),
      TZ: "UTC" as const,
    }),
  };
}

async function makeBuildScopeV2() {
  const contextRoot = await realpath(
    await mkdtemp(
      path.join(tmpdir(), "setfarm-platform-build-context-v2-"),
    ),
  );
  cleanupRoots.push(contextRoot);
  const sourceRoot = path.join(contextRoot, "source");
  const buildToolchainRoot =
    path.join(contextRoot, "node_modules");
  const commandPath = path.join(
    sourceRoot,
    "scripts",
    "build-platform-release-v2.mjs",
  );
  await mkdir(path.dirname(commandPath), {
    recursive: true,
    mode: 0o755,
  });
  await mkdir(buildToolchainRoot, { mode: 0o755 });
  await writeFile(
    commandPath,
    "process.stdout.write('fixture build command\\n');\n",
    { mode: 0o444 },
  );
  await writeFile(
    path.join(sourceRoot, "source.ts"),
    "export const source = true;\n",
    { mode: 0o444 },
  );
  await writeFile(
    path.join(buildToolchainRoot, "compiler"),
    "fixture compiler\n",
    { mode: 0o444 },
  );
  await Promise.all([
    chmod(commandPath, 0o444),
    chmod(path.dirname(commandPath), 0o555),
    chmod(sourceRoot, 0o555),
    chmod(buildToolchainRoot, 0o555),
    chmod(contextRoot, 0o700),
  ]);

  const outputParent = await realpath(
    await mkdtemp(
      path.join(tmpdir(), "setfarm-platform-build-output-v2-"),
    ),
  );
  cleanupRoots.push(outputParent);
  const outputRoot = path.join(outputParent, "output");
  await mkdir(outputRoot, { mode: 0o700 });
  await chmod(outputParent, 0o700);
  const commandBytes = await readFile(commandPath);
  return Object.freeze({
    sourceRoot,
    outputRoot,
    buildToolchainRoot,
    buildToolchainHash: BUILD_TOOLCHAIN_HASH_V2,
    sourceSha: BUILD_SOURCE_SHA_V2,
    sourceDateEpoch: BUILD_SOURCE_EPOCH_V2,
    commandModuleHash: createHash("sha256")
      .update(commandBytes)
      .digest("hex"),
  });
}

async function makeTreeWritableV2(root: string): Promise<void> {
  await chmod(root, 0o700).catch(() => undefined);
  const entries = await readdir(root, {
    withFileTypes: true,
  }).catch(() => []);
  await Promise.all(entries.map(async (entry) => {
    const absolute = path.join(root, entry.name);
    if (entry.isDirectory()) {
      await makeTreeWritableV2(absolute);
    } else if (!entry.isSymbolicLink()) {
      await chmod(absolute, 0o600).catch(() => undefined);
    }
  }));
}

afterEach(async () => {
  await Promise.all(cleanupRoots.splice(0).map(async (root) => {
    await makeTreeWritableV2(root);
    await rm(root, { recursive: true, force: true });
  }));
});

describe("PlatformReleaseHostNodeToolchainAuthorityV2", () => {
  it("projects one profile-independent release identity from CLI and API bootstraps", async () => {
    const fixture = await makeFixtureV2();
    const cliBootstrap = await hostAuthorityV2(
      fixture,
      "PROFILE_NODE_CLI_STATELESS_EXACT_V2",
    );
    const apiBootstrap = await hostAuthorityV2(
      fixture,
      "PROFILE_NODE_EXPRESS_API_STATELESS_EXACT_V2",
    );
    const cli =
      await createPlatformReleaseHostNodeToolchainAuthorityV2ForTest({
        hostToolchain: cliBootstrap,
      });
    const api =
      await createPlatformReleaseHostNodeToolchainAuthorityV2ForTest({
        hostToolchain: apiBootstrap,
      });
    const cliReceipt =
      inspectPlatformReleaseHostNodeToolchainReceiptV2(cli);
    const apiReceipt =
      inspectPlatformReleaseHostNodeToolchainReceiptV2(api);

    assert.deepEqual(cliReceipt, apiReceipt);
    assert.equal(cli.receiptHash, api.receiptHash);
    assert.equal(
      cliReceipt.requirement.purpose,
      "platform_release_build_v2",
    );
    assert.equal(
      PlatformReleaseHostNodeToolchainReceiptV2Schema.parse(
        cliReceipt,
      ).receiptHash,
      cliReceipt.receiptHash,
    );
    assert.equal(
      isProductionPlatformReleaseHostNodeToolchainAuthorityV2(cli),
      false,
    );
    assert.equal(Object.isFrozen(cliReceipt), true);
    assert.equal(Object.isFrozen(cliReceipt.node), true);
    assert.doesNotMatch(
      JSON.stringify(cliReceipt),
      /PROFILE_NODE_|NODE_SCAFFOLD_TOOLCHAIN_NODE_|setfarm-platform-host-v2-|\/private\/|\/Users\//,
    );
  });

  it("keeps constructor, production scope and candidate JSON outside the authority boundary", async () => {
    const fixture = await makeFixtureV2();
    const bootstrap = await hostAuthorityV2(
      fixture,
      "PROFILE_NODE_CLI_STATELESS_EXACT_V2",
    );
    const handle =
      await createPlatformReleaseHostNodeToolchainAuthorityV2ForTest({
        hostToolchain: bootstrap,
      });
    const candidate =
      parsePlatformReleaseHostNodeToolchainReceiptCandidateV2(
        inspectPlatformReleaseHostNodeToolchainReceiptV2(handle),
      );

    assert.throws(
      () => new PlatformReleaseHostNodeToolchainAuthorityV2(
        {},
        {} as never,
      ),
      {
        code:
          "PLATFORM_RELEASE_HOST_NODE_TOOLCHAIN_V2_HANDLE_UNAUTHENTICATED",
      },
    );
    assert.throws(
      () =>
        inspectPlatformReleaseHostNodeToolchainReceiptV2(
          candidate as never,
        ),
      {
        code:
          "PLATFORM_RELEASE_HOST_NODE_TOOLCHAIN_V2_HANDLE_UNAUTHENTICATED",
      },
    );
    await assert.rejects(
      createPlatformReleaseHostNodeToolchainAuthorityV2({
        hostToolchain: bootstrap,
      }),
      {
        code:
          "PLATFORM_RELEASE_HOST_NODE_TOOLCHAIN_V2_PRODUCTION_AUTHORITY_REQUIRED",
      },
    );
    const hostile = new Proxy(
      { hostToolchain: bootstrap },
      {
        ownKeys() {
          throw new Error("trap must not execute");
        },
      },
    );
    await assert.rejects(
      createPlatformReleaseHostNodeToolchainAuthorityV2ForTest(
        hostile,
      ),
      {
        code:
          "PLATFORM_RELEASE_HOST_NODE_TOOLCHAIN_V2_INPUT_INVALID",
      },
    );
    assert.ok(
      PlatformReleaseHostNodeToolchainAuthorityErrorV2,
    );
  });

  it("normalizes install evidence without leaking the bootstrap profile or receipt hash", async () => {
    const fixture = await makeFixtureV2();
    const calls: HostNodeToolchainProbeInvocationV2[] = [];
    const bootstrap = await hostAuthorityV2(
      fixture,
      "PROFILE_NODE_EXPRESS_API_STATELESS_EXACT_V2",
      calls,
    );
    const handle =
      await createPlatformReleaseHostNodeToolchainAuthorityV2ForTest({
        hostToolchain: bootstrap,
      });
    const scope = await makeInstallScopeV2();
    const evidence =
      await executePlatformReleaseHostNodeToolchainNpmCiInternalV2(
        handle,
        scope,
      );

    assert.equal(
      evidence.platformHostToolchainReceiptHash,
      handle.receiptHash,
    );
    assert.deepEqual(evidence.directArgv, [
      "npm",
      "ci",
      "--include=dev",
      "--ignore-scripts",
      "--no-audit",
      "--no-fund",
    ]);
    assert.equal(evidence.exitCode, 0);
    assert.equal(Object.isFrozen(evidence), true);
    assert.equal(
      "hostToolchainReceiptHash" in evidence,
      false,
    );
    assert.doesNotMatch(
      JSON.stringify(evidence),
      /PROFILE_NODE_|NODE_SCAFFOLD_TOOLCHAIN_NODE_/,
    );
    assert.equal(
      calls.filter((call) =>
        call.probeRef
          === "HOST_NPM_PLATFORM_RELEASE_BUILD_INSTALL_V2"
      ).length,
      1,
    );
    const identity = { ...evidence } as
      Partial<PlatformReleaseHostNodeToolchainNpmCiEvidenceV2>;
    delete identity.evidenceHash;
    assert.equal(
      typeof evidence.evidenceHash,
      "string",
    );
  });

  it("executes one exact platform build through the authenticated host Node ABI", async () => {
    const fixture = await makeFixtureV2();
    const calls: HostNodeToolchainProbeInvocationV2[] = [];
    const bootstrap = await hostAuthorityV2(
      fixture,
      "PROFILE_NODE_EXPRESS_API_STATELESS_EXACT_V2",
      calls,
    );
    const handle =
      await createPlatformReleaseHostNodeToolchainAuthorityV2ForTest({
        hostToolchain: bootstrap,
      });
    const scope = await makeBuildScopeV2();
    const evidence =
      await executePlatformReleaseHostNodeToolchainBuildInternalV2(
        handle,
        scope,
      );
    const buildCalls = calls.filter((call) =>
      call.probeRef === "HOST_NODE_PLATFORM_RELEASE_BUILD_V2"
    );

    assert.equal(buildCalls.length, 1);
    const [buildCall] = buildCalls;
    assert.ok(buildCall);
    assert.equal(buildCall.executable, fixture.node);
    assert.equal(buildCall.cwd, scope.sourceRoot);
    assert.deepEqual(buildCall.argv, [
      path.join(
        scope.sourceRoot,
        "scripts",
        "build-platform-release-v2.mjs",
      ),
      "--source-root",
      scope.sourceRoot,
      "--output-root",
      scope.outputRoot,
      "--build-toolchain-root",
      scope.buildToolchainRoot,
      "--build-toolchain-hash",
      BUILD_TOOLCHAIN_HASH_V2,
      "--source-sha",
      BUILD_SOURCE_SHA_V2,
      "--source-date-epoch",
      BUILD_SOURCE_EPOCH_V2,
    ]);
    assert.deepEqual(buildCall.env, {
      CI: "true",
      LANG: "C.UTF-8",
      LC_ALL: "C.UTF-8",
      NO_COLOR: "1",
      SOURCE_DATE_EPOCH: BUILD_SOURCE_EPOCH_V2,
      TZ: "UTC",
    });
    assert.equal(buildCall.shell, false);
    assert.equal(buildCall.timeoutMs, 120_000);
    assert.equal(buildCall.maxStdoutBytes, 1_048_576);
    assert.equal(buildCall.maxStderrBytes, 1_048_576);
    assert.equal("PATH" in buildCall.env, false);
    assert.equal("HOME" in buildCall.env, false);

    assert.deepEqual(evidence.directArgv, [
      "node",
      "scripts/build-platform-release-v2.mjs",
      "--source-root",
      "<VERIFIED_SOURCE_STAGE>",
      "--output-root",
      "<EMPTY_OUTPUT_STAGE>",
      "--build-toolchain-root",
      "<AUTHENTICATED_BUILD_TOOLCHAIN_CAPSULE>",
      "--build-toolchain-hash",
      "<AUTHENTICATED_BUILD_TOOLCHAIN_TREE_HASH>",
      "--source-sha",
      "<ADMITTED_SOURCE_SHA>",
      "--source-date-epoch",
      "<ADMITTED_SOURCE_EPOCH>",
    ]);
    assert.deepEqual(
      evidence.commandResult,
      platformBuildResultV2(),
    );
    assert.equal(
      evidence.platformHostToolchainReceiptHash,
      handle.receiptHash,
    );
    assert.equal(
      evidence.productionUse,
      "forbidden_until_source_owned_double_build_and_fresh_release_verification",
    );
    assert.equal(evidence.inheritAmbientEnvironment, false);
    assert.equal(evidence.timeoutMs, 120_000);
    assert.equal(evidence.maxStdoutBytes, 1_048_576);
    assert.equal(evidence.maxStderrBytes, 1_048_576);
    assert.equal(evidence.shell, "forbidden");
    assert.equal(evidence.termination, "normal_exit");
    assert.equal(evidence.exitCode, 0);
    assert.equal(evidence.signal, null);
    assert.equal(evidence.stderrByteLength, 0);
    assert.equal(
      evidence.stderrContentHash,
      createHash("sha256").update("").digest("hex"),
    );
    assert.equal(Object.isFrozen(evidence), true);
    assert.equal(Object.isFrozen(evidence.directArgv), true);
    assert.equal(Object.isFrozen(evidence.commandResult), true);
    assert.doesNotMatch(
      JSON.stringify(evidence),
      /setfarm-platform-build-(?:context|output)-v2-|\/private\/|\/Users\//,
    );
    const identity = { ...evidence } as
      Partial<PlatformReleaseHostNodeToolchainBuildEvidenceV2>;
    delete identity.evidenceHash;
    assert.equal(
      evidence.evidenceHash,
      hashCanonicalJson({
        schema:
          "setfarm.platform-release-host-node-toolchain-build-evidence-hash.v2",
        evidence: identity,
      }),
    );
    assert.equal(
      PlatformReleaseHostNodeToolchainBuildEvidenceV2Schema
        .safeParse(evidence).success,
      true,
    );
    const forgedEnvironment = structuredClone(evidence);
    forgedEnvironment.environmentHash = "e".repeat(64);
    forgedEnvironment.evidenceHash =
      hashPlatformReleaseHostNodeToolchainBuildEvidenceV2(
        forgedEnvironment,
      );
    assert.equal(
      PlatformReleaseHostNodeToolchainBuildEvidenceV2Schema
        .safeParse(forgedEnvironment).success,
      false,
    );
    const forgedArgv = structuredClone(evidence) as
      typeof evidence & { directArgv: string[] };
    forgedArgv.directArgv[1] = "scripts/other.mjs";
    forgedArgv.directArgvHash = hashCanonicalJson({
      schema:
        "setfarm.platform-release-build-direct-argv-hash.v2",
      directArgv: forgedArgv.directArgv,
    });
    forgedArgv.evidenceHash =
      hashPlatformReleaseHostNodeToolchainBuildEvidenceV2(
        forgedArgv as never,
      );
    assert.equal(
      PlatformReleaseHostNodeToolchainBuildEvidenceV2Schema
        .safeParse(forgedArgv).success,
      false,
    );
  });

  it("rejects stale output, command drift and noncanonical command evidence", async () => {
    const fixture = await makeFixtureV2();
    const staleCalls: HostNodeToolchainProbeInvocationV2[] = [];
    const staleBootstrap = await hostAuthorityV2(
      fixture,
      "PROFILE_NODE_CLI_STATELESS_EXACT_V2",
      staleCalls,
    );
    const staleHandle =
      await createPlatformReleaseHostNodeToolchainAuthorityV2ForTest({
        hostToolchain: staleBootstrap,
      });
    const staleScope = await makeBuildScopeV2();
    let accessorCalled = false;
    const accessorInput = { ...staleScope };
    Object.defineProperty(accessorInput, "sourceRoot", {
      enumerable: true,
      get() {
        accessorCalled = true;
        return staleScope.sourceRoot;
      },
    });
    await assert.rejects(
      executePlatformReleaseHostNodeToolchainBuildInternalV2(
        staleHandle,
        accessorInput as never,
      ),
      {
        code:
          "PLATFORM_RELEASE_HOST_NODE_TOOLCHAIN_V2_BUILD_FAILED",
      },
    );
    assert.equal(accessorCalled, false);
    await writeFile(
      path.join(staleScope.outputRoot, "stale"),
      "not empty\n",
      { mode: 0o600 },
    );
    await assert.rejects(
      executePlatformReleaseHostNodeToolchainBuildInternalV2(
        staleHandle,
        staleScope,
      ),
      {
        code:
          "PLATFORM_RELEASE_HOST_NODE_TOOLCHAIN_V2_BUILD_FAILED",
      },
    );
    assert.equal(
      staleCalls.filter((call) =>
        call.probeRef === "HOST_NODE_PLATFORM_RELEASE_BUILD_V2"
      ).length,
      0,
    );

    const driftCalls: HostNodeToolchainProbeInvocationV2[] = [];
    const driftBootstrap = await hostAuthorityV2(
      fixture,
      "PROFILE_NODE_CLI_STATELESS_EXACT_V2",
      driftCalls,
    );
    const driftHandle =
      await createPlatformReleaseHostNodeToolchainAuthorityV2ForTest({
        hostToolchain: driftBootstrap,
      });
    const driftScope = await makeBuildScopeV2();
    const commandPath = path.join(
      driftScope.sourceRoot,
      "scripts",
      "build-platform-release-v2.mjs",
    );
    await chmod(commandPath, 0o644);
    await writeFile(commandPath, "changed command bytes\n");
    await chmod(commandPath, 0o444);
    await assert.rejects(
      executePlatformReleaseHostNodeToolchainBuildInternalV2(
        driftHandle,
        driftScope,
      ),
      {
        code:
          "PLATFORM_RELEASE_HOST_NODE_TOOLCHAIN_V2_BUILD_FAILED",
      },
    );
    assert.equal(
      driftCalls.filter((call) =>
        call.probeRef === "HOST_NODE_PLATFORM_RELEASE_BUILD_V2"
      ).length,
      0,
    );

    const racingCalls: HostNodeToolchainProbeInvocationV2[] = [];
    const racingBootstrap = await hostAuthorityV2(
      fixture,
      "PROFILE_NODE_CLI_STATELESS_EXACT_V2",
      racingCalls,
      async (invocation) => {
        const outputIndex =
          invocation.argv.indexOf("--output-root");
        const outputRoot = invocation.argv[outputIndex + 1];
        const commandPath = invocation.argv[0];
        assert.ok(outputRoot);
        assert.ok(commandPath);
        await mkdir(path.join(outputRoot, "payload"), {
          mode: 0o700,
        });
        await chmod(commandPath, 0o644);
        await writeFile(commandPath, "raced command bytes\n");
        await chmod(commandPath, 0o444);
        return exited(
          `${canonicalJsonStringify(platformBuildResultV2())}\n`,
        );
      },
    );
    const racingHandle =
      await createPlatformReleaseHostNodeToolchainAuthorityV2ForTest({
        hostToolchain: racingBootstrap,
      });
    await assert.rejects(
      executePlatformReleaseHostNodeToolchainBuildInternalV2(
        racingHandle,
        await makeBuildScopeV2(),
      ),
      {
        code:
          "PLATFORM_RELEASE_HOST_NODE_TOOLCHAIN_V2_BUILD_FAILED",
      },
    );
    assert.equal(
      racingCalls.filter((call) =>
        call.probeRef === "HOST_NODE_PLATFORM_RELEASE_BUILD_V2"
      ).length,
      1,
    );

    const proseCalls: HostNodeToolchainProbeInvocationV2[] = [];
    const proseBootstrap = await hostAuthorityV2(
      fixture,
      "PROFILE_NODE_CLI_STATELESS_EXACT_V2",
      proseCalls,
      async (invocation) => {
        const outputIndex =
          invocation.argv.indexOf("--output-root");
        const outputRoot = invocation.argv[outputIndex + 1];
        assert.ok(outputRoot);
        await mkdir(path.join(outputRoot, "payload"), {
          mode: 0o700,
        });
        return exited(
          `${canonicalJsonStringify(platformBuildResultV2())}\nprose\n`,
        );
      },
    );
    const proseHandle =
      await createPlatformReleaseHostNodeToolchainAuthorityV2ForTest({
        hostToolchain: proseBootstrap,
      });
    await assert.rejects(
      executePlatformReleaseHostNodeToolchainBuildInternalV2(
        proseHandle,
        await makeBuildScopeV2(),
      ),
      {
        code:
          "PLATFORM_RELEASE_HOST_NODE_TOOLCHAIN_V2_BUILD_FAILED",
      },
    );
    assert.equal(
      proseCalls.filter((call) =>
        call.probeRef === "HOST_NODE_PLATFORM_RELEASE_BUILD_V2"
      ).length,
      1,
    );
  });

  it("classifies every bounded platform build process failure and invalid epoch", async () => {
    const fixture = await makeFixtureV2();
    const cases: readonly Readonly<{
      label: string;
      result: HostNodeToolchainProbeResultV2;
      causeCode: string;
    }>[] = [
      {
        label: "timeout",
        result: Object.freeze({
          status: "timed_out",
          stdout: "",
          stderr: "",
        }),
        causeCode: "HOST_NODE_TOOLCHAIN_V2_BUILD_TIMEOUT",
      },
      {
        label: "output limit",
        result: Object.freeze({
          status: "output_limit_exceeded",
          stdout: "",
          stderr: "",
        }),
        causeCode:
          "HOST_NODE_TOOLCHAIN_V2_BUILD_OUTPUT_LIMIT",
      },
      {
        label: "spawn failure",
        result: Object.freeze({
          status: "spawn_failed",
          stdout: "",
          stderr: "spawn failed",
        }),
        causeCode:
          "HOST_NODE_TOOLCHAIN_V2_BUILD_SPAWN_FAILED",
      },
      {
        label: "signal",
        result: Object.freeze({
          status: "exited",
          exitCode: null,
          signal: "SIGTERM",
          stdout: "",
          stderr: "",
        }),
        causeCode:
          "HOST_NODE_TOOLCHAIN_V2_BUILD_SIGNALLED",
      },
      {
        label: "nonzero",
        result: Object.freeze({
          status: "exited",
          exitCode: 7,
          signal: null,
          stdout: "",
          stderr: "failed",
        }),
        causeCode:
          "HOST_NODE_TOOLCHAIN_V2_BUILD_NONZERO",
      },
    ];

    for (const candidate of cases) {
      const calls: HostNodeToolchainProbeInvocationV2[] = [];
      const bootstrap = await hostAuthorityV2(
        fixture,
        "PROFILE_NODE_CLI_STATELESS_EXACT_V2",
        calls,
        async () => candidate.result,
      );
      const handle =
        await createPlatformReleaseHostNodeToolchainAuthorityV2ForTest({
          hostToolchain: bootstrap,
        });
      await assert.rejects(
        executePlatformReleaseHostNodeToolchainBuildInternalV2(
          handle,
          await makeBuildScopeV2(),
        ),
        (error) =>
          hasWrappedBuildCauseV2(error, candidate.causeCode),
        candidate.label,
      );
    }

    const epochCalls: HostNodeToolchainProbeInvocationV2[] = [];
    const epochBootstrap = await hostAuthorityV2(
      fixture,
      "PROFILE_NODE_CLI_STATELESS_EXACT_V2",
      epochCalls,
    );
    const epochHandle =
      await createPlatformReleaseHostNodeToolchainAuthorityV2ForTest({
        hostToolchain: epochBootstrap,
      });
    const epochScope = await makeBuildScopeV2();
    await assert.rejects(
      executePlatformReleaseHostNodeToolchainBuildInternalV2(
        epochHandle,
        {
          ...epochScope,
          sourceDateEpoch: "1".repeat(21),
        },
      ),
      (error) =>
        hasWrappedBuildCauseV2(
          error,
          "HOST_NODE_TOOLCHAIN_V2_BUILD_SCOPE_INVALID",
        ),
    );
    assert.equal(
      epochCalls.filter((call) =>
        call.probeRef === "HOST_NODE_PLATFORM_RELEASE_BUILD_V2"
      ).length,
      0,
    );
  });

  it("rejects a mutable or linked payload root after process success", async () => {
    const fixture = await makeFixtureV2();
    const calls: HostNodeToolchainProbeInvocationV2[] = [];
    let occurrence = 0;
    const bootstrap = await hostAuthorityV2(
      fixture,
      "PROFILE_NODE_CLI_STATELESS_EXACT_V2",
      calls,
      async (invocation) => {
        const outputIndex =
          invocation.argv.indexOf("--output-root");
        const outputRoot = invocation.argv[outputIndex + 1];
        assert.ok(outputRoot);
        if (occurrence === 0) {
          await mkdir(path.join(outputRoot, "payload"), {
            mode: 0o755,
          });
          await chmod(path.join(outputRoot, "payload"), 0o755);
        } else {
          await symlink(
            invocation.cwd,
            path.join(outputRoot, "payload"),
          );
        }
        occurrence += 1;
        return exited(
          `${canonicalJsonStringify(platformBuildResultV2())}\n`,
        );
      },
    );
    const handle =
      await createPlatformReleaseHostNodeToolchainAuthorityV2ForTest({
        hostToolchain: bootstrap,
      });
    for (const label of ["mutable payload", "linked payload"]) {
      await assert.rejects(
        executePlatformReleaseHostNodeToolchainBuildInternalV2(
          handle,
          await makeBuildScopeV2(),
        ),
        (error) =>
          hasWrappedBuildCauseV2(
            error,
            "HOST_NODE_TOOLCHAIN_V2_BUILD_SCOPE_INVALID",
          ),
        label,
      );
    }
    assert.equal(occurrence, 2);
  });

  it("rejects coherent candidate drift and detects physical bootstrap mutation", async () => {
    const fixture = await makeFixtureV2();
    const bootstrap = await hostAuthorityV2(
      fixture,
      "PROFILE_NODE_CLI_STATELESS_EXACT_V2",
    );
    const handle =
      await createPlatformReleaseHostNodeToolchainAuthorityV2ForTest({
        hostToolchain: bootstrap,
      });
    const receipt = structuredClone(
      inspectPlatformReleaseHostNodeToolchainReceiptV2(handle),
    );
    receipt.npm.version = "10.9.7";
    receipt.receiptHash =
      hashPlatformReleaseHostNodeToolchainReceiptV2(receipt);
    assert.equal(
      PlatformReleaseHostNodeToolchainReceiptV2Schema.safeParse(
        receipt,
      ).success,
      false,
    );

    const mutable = path.join(fixture.npmRoot, "lib", "cli.js");
    await chmod(mutable, 0o644);
    await writeFile(mutable, "module.exports = () => 1\n");
    await assert.rejects(
      revalidatePlatformReleaseHostNodeToolchainAuthorityV2(handle),
      {
        code:
          "PLATFORM_RELEASE_HOST_NODE_TOOLCHAIN_V2_HOST_DRIFT",
      },
    );
  });
});
