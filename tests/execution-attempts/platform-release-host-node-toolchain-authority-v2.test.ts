import assert from "node:assert/strict";
import {
  chmod,
  mkdir,
  mkdtemp,
  realpath,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, it } from "node:test";

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
  executePlatformReleaseHostNodeToolchainNpmCiInternalV2,
  inspectPlatformReleaseHostNodeToolchainReceiptV2,
  isProductionPlatformReleaseHostNodeToolchainAuthorityV2,
  revalidatePlatformReleaseHostNodeToolchainAuthorityV2,
  type PlatformReleaseHostNodeToolchainNpmCiEvidenceV2,
} from
  "../../src/execution/platform-release-host-node-toolchain-authority-v2.js";
import {
  PlatformReleaseHostNodeToolchainReceiptV2Schema,
  hashPlatformReleaseHostNodeToolchainReceiptV2,
  parsePlatformReleaseHostNodeToolchainReceiptCandidateV2,
} from
  "../../src/execution/schemas/platform-release-host-node-toolchain-v2.js";

type FixtureV2 = Readonly<{
  root: string;
  node: string;
  npmRoot: string;
  npmCli: string;
  dynamicLibrary: string;
}>;

const cleanupRoots: string[] = [];

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
    return exited("");
  };
}

async function hostAuthorityV2(
  fixture: FixtureV2,
  profileId:
    | "PROFILE_NODE_CLI_STATELESS_EXACT_V2"
    | "PROFILE_NODE_EXPRESS_API_STATELESS_EXACT_V2",
  calls: HostNodeToolchainProbeInvocationV2[] = [],
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
    probeAdapter: probeAdapterV2(fixture, calls),
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

afterEach(async () => {
  await Promise.all(cleanupRoots.splice(0).map(async (root) => {
    await chmod(root, 0o700).catch(() => undefined);
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
