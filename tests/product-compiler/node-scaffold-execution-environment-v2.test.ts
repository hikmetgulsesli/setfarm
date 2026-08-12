import assert from "node:assert/strict";
import { chmodSync, existsSync, mkdirSync, renameSync } from "node:fs";
import {
  chmod,
  link,
  lstat,
  mkdir,
  mkdtemp,
  realpath,
  rename,
  rm,
  unlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, it } from "node:test";

import {
  createHostNodeToolchainAuthorityV2ForTest,
  type HostNodeToolchainProbeInvocationV2,
  type HostNodeToolchainProbeResultV2,
} from "../../src/product-compiler/host-node-toolchain-authority-v2.js";
import {
  NodeScaffoldExecutionEnvironmentErrorV2,
  NodeScaffoldExecutionEnvironmentV2,
  createNodeScaffoldExecutionEnvironmentV2,
  createNodeScaffoldExecutionEnvironmentV2ForTest,
  destroyNodeScaffoldExecutionEnvironmentV2,
  inspectEffectiveNpmConfigReceiptV2,
  inspectNodeScaffoldExecutionEnvironmentReceiptV2,
  isProductionNodeScaffoldExecutionEnvironmentV2,
  revalidateNodeScaffoldExecutionEnvironmentV2,
  type NodeScaffoldExecutionEnvironmentTestCheckpointV2,
} from "../../src/product-compiler/node-scaffold-execution-environment-v2.js";
import {
  EffectiveNpmConfigReceiptV2Schema,
  NodeScaffoldExecutionEnvironmentReceiptV2Schema,
} from "../../src/product-compiler/schemas/node-scaffold-execution-environment-v2.js";
import {
  NODE_SCAFFOLD_EXECUTION_ENVIRONMENT_REHEARSAL_AUTHORITY_REF_V2,
  NODE_SCAFFOLD_EXECUTION_ENVIRONMENT_REHEARSAL_RECEIPT_V2_SCHEMA,
  NODE_SCAFFOLD_EXECUTION_ENVIRONMENT_REHEARSAL_VERSION_V2,
  NodeScaffoldExecutionEnvironmentRehearsalReceiptV2Schema,
  hashNodeScaffoldExecutionEnvironmentRehearsalReceiptV2,
  type NodeScaffoldExecutionEnvironmentRehearsalReceiptHashPayloadV2,
} from "../../src/product-compiler/schemas/node-scaffold-execution-environment-rehearsal-v2.js";

const PROFILE_ID = "PROFILE_NODE_CLI_STATELESS_EXACT_V2" as const;
const cleanupRoots: string[] = [];

type Fixture = Readonly<{
  root: string;
  node: string;
  npmRoot: string;
  npmCli: string;
  dynamicLibrary: string;
}>;

type AdapterControl = {
  effectiveConfigMutation?: (config: Record<string, unknown>) => void;
  onEffectiveProbe?: (invocation: HostNodeToolchainProbeInvocationV2) => Promise<void> | void;
  effectiveResult?: HostNodeToolchainProbeResultV2;
};

function exited(stdout: string, stderr = ""): HostNodeToolchainProbeResultV2 {
  return Object.freeze({
    status: "exited",
    exitCode: 0,
    signal: null,
    stdout,
    stderr,
  });
}

async function makeFixture(): Promise<Fixture> {
  const root = await mkdtemp(path.join(tmpdir(), "setfarm-f3-host-"));
  cleanupRoots.push(root);
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
  return { root, node, npmRoot, npmCli, dynamicLibrary };
}

function effectiveConfig(invocation: HostNodeToolchainProbeInvocationV2): Record<string, unknown> {
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

async function makeAuthority(input: Readonly<{
  fixture: Fixture;
  calls: HostNodeToolchainProbeInvocationV2[];
  control?: AdapterControl;
  profileId?:
    | "PROFILE_NODE_CLI_STATELESS_EXACT_V2"
    | "PROFILE_NODE_EXPRESS_API_STATELESS_EXACT_V2";
}>) {
  const adapter = async (invocation: HostNodeToolchainProbeInvocationV2):
  Promise<HostNodeToolchainProbeResultV2> => {
    input.calls.push(invocation);
    if (invocation.probeRef === "HOST_NODE_RUNTIME_IDENTITY_PROBE_V2") {
      return exited(`${JSON.stringify({
        version: "22.23.1",
        modulesAbi: "127",
        napiVersion: "10",
        platform: "darwin",
        architecture: "arm64",
        execPath: input.fixture.node,
      })}\n`);
    }
    if (invocation.probeRef === "HOST_NPM_VERSION_PROBE_V2") return exited("10.9.8\n");
    await input.control?.onEffectiveProbe?.(invocation);
    if (input.control?.effectiveResult) return input.control.effectiveResult;
    const config = effectiveConfig(invocation);
    input.control?.effectiveConfigMutation?.(config);
    return exited(`${JSON.stringify(config, null, 2)}\n`);
  };
  return createHostNodeToolchainAuthorityV2ForTest({
    profileId: input.profileId ?? PROFILE_ID,
    fixture: {
      candidateRoot: input.fixture.root,
      host: {
        platform: "darwin",
        architecture: "arm64",
        macosProductVersion: "26.5.2",
        macosBuildVersion: "25F84",
        darwinKernelRelease: "25.5.0",
      },
      nonSystemDynamicLibraryPaths: [input.fixture.dynamicLibrary],
    },
    probeAdapter: adapter,
  });
}

async function makeScratchParent(): Promise<string> {
  const logical = await mkdtemp(path.join(tmpdir(), "setfarm-f3-parent-"));
  cleanupRoots.push(logical);
  await chmod(logical, 0o700);
  return realpath(logical);
}

async function createFixtureEnvironment(input: Readonly<{
  control?: AdapterControl;
  calls?: HostNodeToolchainProbeInvocationV2[];
  profileId?:
    | "PROFILE_NODE_CLI_STATELESS_EXACT_V2"
    | "PROFILE_NODE_EXPRESS_API_STATELESS_EXACT_V2";
}> = {}) {
  const fixture = await makeFixture();
  const calls = input.calls ?? [];
  const profileId = input.profileId ?? PROFILE_ID;
  const hostToolchain = await makeAuthority({
    fixture,
    calls,
    control: input.control,
    profileId,
  });
  const scratchParent = await makeScratchParent();
  const handle = await createNodeScaffoldExecutionEnvironmentV2ForTest({
    profileId,
    hostToolchain,
    scratchParent,
  });
  return { fixture, calls, hostToolchain, scratchParent, handle };
}

function effectiveInvocation(calls: readonly HostNodeToolchainProbeInvocationV2[]) {
  const invocation = calls.find((call) =>
    call.probeRef === "HOST_NPM_EFFECTIVE_CONFIG_PROBE_V2");
  assert.ok(invocation);
  return invocation;
}

afterEach(async () => {
  await Promise.all(cleanupRoots.splice(0).map((root) =>
    rm(root, { recursive: true, force: true })));
});

describe("NodeScaffoldExecutionEnvironmentV2", () => {
  it("issues pathless receipts for one deny-all environment shared by every recipe", async () => {
    const calls: HostNodeToolchainProbeInvocationV2[] = [];
    const priorMixedCase = process.env.NpM_CoNfIg_ReGiStRy;
    const priorProxy = process.env.npm_config_proxy;
    const priorNodeOptions = process.env.NODE_OPTIONS;
    process.env.NpM_CoNfIg_ReGiStRy = "https://attacker.invalid";
    process.env.npm_config_proxy = "http://attacker.invalid";
    process.env.NODE_OPTIONS = "--require=/tmp/attacker.js";
    let created: Awaited<ReturnType<typeof createFixtureEnvironment>> | undefined;
    try {
      created = await createFixtureEnvironment({ calls });
    } finally {
      if (priorMixedCase === undefined) delete process.env.NpM_CoNfIg_ReGiStRy;
      else process.env.NpM_CoNfIg_ReGiStRy = priorMixedCase;
      if (priorProxy === undefined) delete process.env.npm_config_proxy;
      else process.env.npm_config_proxy = priorProxy;
      if (priorNodeOptions === undefined) delete process.env.NODE_OPTIONS;
      else process.env.NODE_OPTIONS = priorNodeOptions;
    }
    assert.ok(created);
    const receipt = inspectNodeScaffoldExecutionEnvironmentReceiptV2(created.handle);
    const configReceipt = inspectEffectiveNpmConfigReceiptV2(created.handle);
    assert.equal(isProductionNodeScaffoldExecutionEnvironmentV2(created.handle), false);
    assert.equal(receipt.admissionScope, "test_fixture");
    assert.equal(receipt.status, "verified_environment_pending_file_tree_join");
    assert.equal(receipt.productionUse, "forbidden_until_private_materializer_and_file_tree_join");
    assert.equal(receipt.executionProjectNpmrc.evidenceStatus, "pending_file_tree_join");
    assert.equal(configReceipt.sourceIsolation.probeProjectNpmrc.state, "absent");
    assert.equal(configReceipt.effectiveConfig.registry, "https://registry.npmjs.org");
    assert.equal(configReceipt.effectiveConfig.proxy, "absent");
    assert.equal(configReceipt.effectiveConfig.ca, "absent");
    assert.equal(configReceipt.effectiveConfig.engineStrict, true);
    assert.notEqual(
      receipt.privateMaterialization.userNpmrc.identityHash,
      receipt.privateMaterialization.globalNpmrc.identityHash,
    );
    assert.equal(
      NodeScaffoldExecutionEnvironmentReceiptV2Schema.parse(receipt).receiptHash,
      receipt.receiptHash,
    );
    assert.equal(
      EffectiveNpmConfigReceiptV2Schema.parse(configReceipt).receiptHash,
      configReceipt.receiptHash,
    );
    assert.equal(Object.isFrozen(receipt), true);
    assert.equal(Object.isFrozen(receipt.privateMaterialization), true);
    assert.doesNotMatch(
      JSON.stringify({ receipt, configReceipt }),
      /\/private\/|\/var\/folders|\/Users\/|setfarm-f3-/,
    );

    const recipeHashes = receipt.recipeBindings.map((binding) => binding.environmentHash);
    assert.deepEqual(recipeHashes, [
      receipt.environment.environmentHash,
      receipt.environment.environmentHash,
      receipt.environment.environmentHash,
    ]);
    const invocation = effectiveInvocation(calls);
    assert.equal(invocation.shell, false);
    assert.deepEqual(invocation.argv.slice(1), ["config", "list", "--json"]);
    assert.equal(invocation.env.NpM_CoNfIg_ReGiStRy, undefined);
    assert.equal(invocation.env.npm_config_proxy, undefined);
    assert.equal(invocation.env.NODE_OPTIONS, undefined);
    assert.deepEqual(Object.keys(invocation.env).sort(), receipt.environment.exactVariableNames);
    assert.equal(invocation.env.PATH, path.dirname(await realpath(created.fixture.node)));
    assert.notEqual(invocation.env.NPM_CONFIG_USERCONFIG, invocation.env.NPM_CONFIG_GLOBALCONFIG);

    const privateRoot = path.dirname(invocation.cwd);
    assert.equal(existsSync(privateRoot), true);
    destroyNodeScaffoldExecutionEnvironmentV2(created.handle);
    assert.equal(existsSync(privateRoot), false);
    destroyNodeScaffoldExecutionEnvironmentV2(created.handle);
    await assert.rejects(revalidateNodeScaffoldExecutionEnvironmentV2(created.handle), {
      code: "NODE_SCAFFOLD_EXECUTION_ENVIRONMENT_V2_DESTROYED",
    });
  });

  it("rejects forged handles, extra inputs, unsafe parents and production promotion", async () => {
    const fixture = await makeFixture();
    const calls: HostNodeToolchainProbeInvocationV2[] = [];
    const hostToolchain = await makeAuthority({ fixture, calls });
    const scratchParent = await makeScratchParent();
    await assert.rejects(createNodeScaffoldExecutionEnvironmentV2({
      profileId: PROFILE_ID,
      hostToolchain,
    }), { code: "NODE_SCAFFOLD_EXECUTION_ENVIRONMENT_V2_PRODUCTION_AUTHORITY_REQUIRED" });
    await assert.rejects(createNodeScaffoldExecutionEnvironmentV2ForTest({
      profileId: PROFILE_ID,
      hostToolchain,
      scratchParent,
      extra: true,
    } as never), { code: "NODE_SCAFFOLD_EXECUTION_ENVIRONMENT_V2_INPUT_INVALID" });
    let getterInvoked = false;
    const accessorInput = Object.defineProperty({
      hostToolchain,
      scratchParent,
    }, "profileId", {
      enumerable: true,
      get() {
        getterInvoked = true;
        return PROFILE_ID;
      },
    });
    await assert.rejects(createNodeScaffoldExecutionEnvironmentV2ForTest(accessorInput as never), {
      code: "NODE_SCAFFOLD_EXECUTION_ENVIRONMENT_V2_INPUT_INVALID",
    });
    assert.equal(getterInvoked, false);
    await chmod(scratchParent, 0o755);
    await assert.rejects(createNodeScaffoldExecutionEnvironmentV2ForTest({
      profileId: PROFILE_ID,
      hostToolchain,
      scratchParent,
    }), { code: "NODE_SCAFFOLD_EXECUTION_ENVIRONMENT_V2_INPUT_INVALID" });
    assert.throws(() => new NodeScaffoldExecutionEnvironmentV2({}, {} as never), {
      code: "NODE_SCAFFOLD_EXECUTION_ENVIRONMENT_V2_HANDLE_UNAUTHENTICATED",
    });
    assert.throws(() => inspectNodeScaffoldExecutionEnvironmentReceiptV2({} as never), {
      code: "NODE_SCAFFOLD_EXECUTION_ENVIRONMENT_V2_HANDLE_UNAUTHENTICATED",
    });
  });

  it("cleans its exact partial root after every create-before-write checkpoint failure", async () => {
    const checkpoints: readonly NodeScaffoldExecutionEnvironmentTestCheckpointV2[] = [
      "after_private_root_create",
      "after_private_directory_create",
      "after_private_npmrc_create",
    ];
    const fixture = await makeFixture();
    const calls: HostNodeToolchainProbeInvocationV2[] = [];
    const hostToolchain = await makeAuthority({ fixture, calls });
    const scratchParent = await makeScratchParent();
    const sentinel = path.join(scratchParent, "sentinel");
    await writeFile(sentinel, "foreign\n", { mode: 0o600 });

    for (const checkpoint of checkpoints) {
      await assert.rejects(createNodeScaffoldExecutionEnvironmentV2ForTest({
        profileId: PROFILE_ID,
        hostToolchain,
        scratchParent,
        testHooks: {
          afterCheckpoint(observed) {
            if (observed === checkpoint) throw new Error(`FAULT:${checkpoint}`);
          },
        },
      }), {
        code: "NODE_SCAFFOLD_EXECUTION_ENVIRONMENT_V2_MATERIALIZATION_FAILED",
      });
      assert.deepEqual(
        await (await import("node:fs/promises")).readdir(scratchParent),
        ["sentinel"],
      );
    }
  });

  it("joins both code-owned Node product profiles without project-specific environment rules", async () => {
    for (const profileId of [
      "PROFILE_NODE_CLI_STATELESS_EXACT_V2",
      "PROFILE_NODE_EXPRESS_API_STATELESS_EXACT_V2",
    ] as const) {
      const created = await createFixtureEnvironment({ profileId });
      const receipt = inspectNodeScaffoldExecutionEnvironmentReceiptV2(created.handle);
      assert.equal(receipt.catalogBinding.profileId, profileId);
      assert.equal(
        receipt.catalogBinding.entryRef,
        profileId === "PROFILE_NODE_CLI_STATELESS_EXACT_V2"
          ? "NODE_SCAFFOLD_TOOLCHAIN_NODE_CLI_V2"
          : "NODE_SCAFFOLD_TOOLCHAIN_NODE_EXPRESS_API_V2",
      );
      destroyNodeScaffoldExecutionEnvironmentV2(created.handle);
    }
  });

  it("rejects registry, proxy, CA, credential and lifecycle precedence drift", async () => {
    const mutations: Array<(config: Record<string, unknown>) => void> = [
      (config) => { config.registry = "https://mirror.invalid"; },
      (config) => { config.proxy = "http://proxy.invalid"; },
      (config) => { config.ca = ["attacker-ca"]; },
      (config) => { config["//registry.npmjs.org/:_authToken"] = "secret"; },
      (config) => { config["//registry.npmjs.org/:_authToken"] = null; },
      (config) => { config["ignore-scripts"] = true; },
      (config) => { config["engine-strict"] = false; },
      (config) => { config["script-shell"] = "/tmp/attacker-shell"; },
      (config) => { config["logs-max"] = 10; },
    ];
    for (const effectiveConfigMutation of mutations) {
      const fixture = await makeFixture();
      const calls: HostNodeToolchainProbeInvocationV2[] = [];
      const hostToolchain = await makeAuthority({
        fixture,
        calls,
        control: { effectiveConfigMutation },
      });
      const scratchParent = await makeScratchParent();
      await assert.rejects(createNodeScaffoldExecutionEnvironmentV2ForTest({
        profileId: PROFILE_ID,
        hostToolchain,
        scratchParent,
      }), { code: "NODE_SCAFFOLD_EXECUTION_ENVIRONMENT_V2_EFFECTIVE_CONFIG_INVALID" });
      assert.deepEqual(await (await import("node:fs/promises")).readdir(scratchParent), []);
    }
  });

  it("rejects user/global aliasing and source mutation during the probe", async () => {
    const attacks: Array<(input: Readonly<{
      fixture: Fixture;
      invocation: HostNodeToolchainProbeInvocationV2;
    }>) => Promise<void>> = [
      async ({ invocation }) => {
        await unlink(invocation.env.NPM_CONFIG_GLOBALCONFIG!);
        await link(
          invocation.env.NPM_CONFIG_USERCONFIG!,
          invocation.env.NPM_CONFIG_GLOBALCONFIG!,
        );
      },
      async ({ invocation }) => {
        await writeFile(path.join(invocation.cwd, ".npmrc"), "registry=https://attacker.invalid\n");
      },
      async ({ invocation }) => {
        await writeFile(invocation.env.NPM_CONFIG_USERCONFIG!, "proxy=http://attacker.invalid\n");
      },
      async ({ fixture }) => {
        await writeFile(path.join(fixture.npmRoot, "npmrc"), "registry=https://attacker.invalid\n", {
          mode: 0o444,
        });
      },
    ];
    for (const [index, attack] of attacks.entries()) {
      const fixture = await makeFixture();
      const calls: HostNodeToolchainProbeInvocationV2[] = [];
      const hostToolchain = await makeAuthority({
        fixture,
        calls,
        control: {
          onEffectiveProbe: (invocation) => attack({ fixture, invocation }),
        },
      });
      const scratchParent = await makeScratchParent();
      await assert.rejects(createNodeScaffoldExecutionEnvironmentV2ForTest({
        profileId: PROFILE_ID,
        hostToolchain,
        scratchParent,
      }), (error: unknown) => {
        if (!(error instanceof NodeScaffoldExecutionEnvironmentErrorV2)) return false;
        if (index < 2) {
          return error.code === "NODE_SCAFFOLD_EXECUTION_ENVIRONMENT_V2_STATE_DRIFT"
            && error.cause instanceof AggregateError
            && error.cause.errors.length === 2
            && error.message.includes("cleanup retained its authenticated root");
        }
        return error.code
          === "NODE_SCAFFOLD_EXECUTION_ENVIRONMENT_V2_EFFECTIVE_CONFIG_INVALID";
      });
      const retained = await (await import("node:fs/promises")).readdir(
        scratchParent,
      );
      assert.equal(retained.length, index < 2 ? 1 : 0);
    }
  });

  it("reprobes on revalidation and detects private source or probe-result drift", async () => {
    const control: AdapterControl = {};
    const created = await createFixtureEnvironment({ control });
    const invocation = effectiveInvocation(created.calls);
    const originalReceipt = inspectNodeScaffoldExecutionEnvironmentReceiptV2(created.handle);
    assert.equal(
      (await revalidateNodeScaffoldExecutionEnvironmentV2(created.handle)).receiptHash,
      originalReceipt.receiptHash,
    );
    control.effectiveConfigMutation = (config) => {
      config["https-proxy"] = "http://attacker.invalid";
    };
    await assert.rejects(revalidateNodeScaffoldExecutionEnvironmentV2(created.handle), {
      code: "NODE_SCAFFOLD_EXECUTION_ENVIRONMENT_V2_STATE_DRIFT",
    });
    control.effectiveConfigMutation = undefined;
    await writeFile(invocation.env.NPM_CONFIG_USERCONFIG!, "x");
    await assert.rejects(revalidateNodeScaffoldExecutionEnvironmentV2(created.handle), {
      code: "NODE_SCAFFOLD_EXECUTION_ENVIRONMENT_V2_STATE_DRIFT",
    });
    destroyNodeScaffoldExecutionEnvironmentV2(created.handle);
  });

  it("creates unique attempts and refuses to delete a replacement root", async () => {
    const fixture = await makeFixture();
    const calls: HostNodeToolchainProbeInvocationV2[] = [];
    const hostToolchain = await makeAuthority({ fixture, calls });
    const scratchParent = await makeScratchParent();
    const first = await createNodeScaffoldExecutionEnvironmentV2ForTest({
      profileId: PROFILE_ID,
      hostToolchain,
      scratchParent,
    });
    const second = await createNodeScaffoldExecutionEnvironmentV2ForTest({
      profileId: PROFILE_ID,
      hostToolchain,
      scratchParent,
    });
    const effectiveCalls = calls.filter((call) =>
      call.probeRef === "HOST_NPM_EFFECTIVE_CONFIG_PROBE_V2");
    assert.equal(effectiveCalls.length, 2);
    const firstRoot = path.dirname(effectiveCalls[0]!.cwd);
    const secondRoot = path.dirname(effectiveCalls[1]!.cwd);
    assert.notEqual(firstRoot, secondRoot);
    assert.notEqual(first.receiptHash, second.receiptHash);

    const displaced = `${firstRoot}-displaced`;
    await rename(firstRoot, displaced);
    await mkdir(firstRoot, { mode: 0o700 });
    await assert.rejects(async () => destroyNodeScaffoldExecutionEnvironmentV2(first), {
      code: "NODE_SCAFFOLD_EXECUTION_ENVIRONMENT_V2_STATE_DRIFT",
    });
    assert.equal(existsSync(firstRoot), true);
    destroyNodeScaffoldExecutionEnvironmentV2(second);
    await rm(firstRoot, { recursive: true, force: true });
    await rm(displaced, { recursive: true, force: true });
  });

  it("types a cleanup descriptor-close failure and permits an exact retained-root retry", async () => {
    const fixture = await makeFixture();
    const calls: HostNodeToolchainProbeInvocationV2[] = [];
    const hostToolchain = await makeAuthority({ fixture, calls });
    const scratchParent = await makeScratchParent();
    let closeFailurePending = true;
    const handle = await createNodeScaffoldExecutionEnvironmentV2ForTest({
      profileId: PROFILE_ID,
      hostToolchain,
      scratchParent,
      testHooks: {
        afterCleanupDirectoryDescriptorClose(locator) {
          if (locator === "." && closeFailurePending) {
            closeFailurePending = false;
            throw new Error("INJECTED_EXECUTION_CLEANUP_CLOSE_FAILURE");
          }
        },
      },
    });
    const privateRoot = path.dirname(effectiveInvocation(calls).cwd);

    await assert.rejects(async () => destroyNodeScaffoldExecutionEnvironmentV2(handle),
      (error: unknown) =>
        error instanceof NodeScaffoldExecutionEnvironmentErrorV2
        && error.code === "NODE_SCAFFOLD_EXECUTION_ENVIRONMENT_V2_STATE_DRIFT"
        && error.cause instanceof Error
        && error.cause.message === "INJECTED_EXECUTION_CLEANUP_CLOSE_FAILURE");
    assert.equal(existsSync(privateRoot), true);

    destroyNodeScaffoldExecutionEnvironmentV2(handle);
    assert.equal(existsSync(privateRoot), false);
  });

  it("restores a retained nested directory to its original read-only mode", async () => {
    const fixture = await makeFixture();
    const calls: HostNodeToolchainProbeInvocationV2[] = [];
    const hostToolchain = await makeAuthority({ fixture, calls });
    const scratchParent = await makeScratchParent();
    let closeFailurePending = true;
    const handle = await createNodeScaffoldExecutionEnvironmentV2ForTest({
      profileId: PROFILE_ID,
      hostToolchain,
      scratchParent,
      testHooks: {
        afterCleanupDirectoryDescriptorClose(locator) {
          if (locator === "config-probe" && closeFailurePending) {
            closeFailurePending = false;
            throw new Error("INJECTED_EXECUTION_NESTED_CLEANUP_CLOSE_FAILURE");
          }
        },
      },
    });
    const privateRoot = path.dirname(effectiveInvocation(calls).cwd);
    const nestedDirectory = path.join(privateRoot, "config-probe");
    await chmod(nestedDirectory, 0o555);

    await assert.rejects(async () => destroyNodeScaffoldExecutionEnvironmentV2(handle),
      (error: unknown) =>
        error instanceof NodeScaffoldExecutionEnvironmentErrorV2
        && error.code === "NODE_SCAFFOLD_EXECUTION_ENVIRONMENT_V2_STATE_DRIFT"
        && error.cause instanceof Error
        && error.cause.message === "INJECTED_EXECUTION_NESTED_CLEANUP_CLOSE_FAILURE");
    assert.equal(existsSync(nestedDirectory), true);
    assert.equal((await lstat(nestedDirectory)).mode & 0o7777, 0o555);

    destroyNodeScaffoldExecutionEnvironmentV2(handle);
    assert.equal(existsSync(privateRoot), false);
  });

  it("orders cleanup then restore errors and does not mutate a foreign replacement", async () => {
    const fixture = await makeFixture();
    const calls: HostNodeToolchainProbeInvocationV2[] = [];
    const hostToolchain = await makeAuthority({ fixture, calls });
    const scratchParent = await makeScratchParent();
    let privateRoot = "";
    let displaced = "";
    let failuresPending = true;
    const handle = await createNodeScaffoldExecutionEnvironmentV2ForTest({
      profileId: PROFILE_ID,
      hostToolchain,
      scratchParent,
      testHooks: {
        afterCleanupDirectoryDescriptorClose(locator) {
          if (locator !== "config-probe" || !failuresPending) return;
          failuresPending = false;
          const nestedDirectory = path.join(privateRoot, "config-probe");
          displaced = `${nestedDirectory}-displaced`;
          renameSync(nestedDirectory, displaced);
          mkdirSync(nestedDirectory, { mode: 0o555 });
          chmodSync(nestedDirectory, 0o555);
          throw new Error("INJECTED_EXECUTION_CLEANUP_PRIMARY_FAILURE");
        },
      },
    });
    privateRoot = path.dirname(effectiveInvocation(calls).cwd);
    const nestedDirectory = path.join(privateRoot, "config-probe");
    await chmod(nestedDirectory, 0o555);

    await assert.rejects(async () => destroyNodeScaffoldExecutionEnvironmentV2(handle),
      (error: unknown) => {
        if (
          !(error instanceof NodeScaffoldExecutionEnvironmentErrorV2)
          || !(error.cause instanceof AggregateError)
          || error.cause.errors.length !== 2
        ) return false;
        const [primary, restore] = error.cause.errors;
        return primary instanceof NodeScaffoldExecutionEnvironmentErrorV2
          && primary.cause instanceof Error
          && primary.cause.message === "INJECTED_EXECUTION_CLEANUP_PRIMARY_FAILURE"
          && restore instanceof NodeScaffoldExecutionEnvironmentErrorV2
          && restore.message.includes("changed before mode restoration");
      });
    assert.equal((await lstat(nestedDirectory)).mode & 0o7777, 0o555);
    assert.equal((await lstat(displaced)).mode & 0o7777, 0o700);

    await rm(nestedDirectory, { recursive: true, force: true });
    renameSync(displaced, nestedDirectory);
    destroyNodeScaffoldExecutionEnvironmentV2(handle);
    assert.equal(existsSync(privateRoot), false);
  });

  it("preserves cleanup census read and directory-close failures in primary-first order", async () => {
    const fixture = await makeFixture();
    const calls: HostNodeToolchainProbeInvocationV2[] = [];
    const hostToolchain = await makeAuthority({ fixture, calls });
    const scratchParent = await makeScratchParent();
    let failuresPending = true;
    const handle = await createNodeScaffoldExecutionEnvironmentV2ForTest({
      profileId: PROFILE_ID,
      hostToolchain,
      scratchParent,
      testHooks: {
        beforeCleanupCensusDirectoryRead(locator) {
          if (locator === "." && failuresPending) {
            throw new Error("INJECTED_EXECUTION_CENSUS_READ_FAILURE");
          }
        },
        afterCleanupCensusDirectoryClose(locator) {
          if (locator === "." && failuresPending) {
            throw new Error("INJECTED_EXECUTION_CENSUS_CLOSE_FAILURE");
          }
        },
      },
    });
    const privateRoot = path.dirname(effectiveInvocation(calls).cwd);

    await assert.rejects(async () => destroyNodeScaffoldExecutionEnvironmentV2(handle),
      (error: unknown) =>
        error instanceof NodeScaffoldExecutionEnvironmentErrorV2
        && error.code === "NODE_SCAFFOLD_EXECUTION_ENVIRONMENT_V2_STATE_DRIFT"
        && error.cause instanceof AggregateError
        && error.cause.errors.length === 2
        && error.cause.errors[0] instanceof Error
        && error.cause.errors[0].message === "INJECTED_EXECUTION_CENSUS_READ_FAILURE"
        && error.cause.errors[1] instanceof Error
        && error.cause.errors[1].message === "INJECTED_EXECUTION_CENSUS_CLOSE_FAILURE");
    assert.equal(existsSync(privateRoot), true);

    failuresPending = false;
    destroyNodeScaffoldExecutionEnvironmentV2(handle);
    assert.equal(existsSync(privateRoot), false);
  });

  it("preserves a foreign nested replacement until test recovery restores the captured census", async () => {
    const created = await createFixtureEnvironment();
    const invocation = effectiveInvocation(created.calls);
    const privateRoot = path.dirname(invocation.cwd);
    const nestedParent = path.join(privateRoot, "config-probe");
    const displaced = `${privateRoot}-config-probe-displaced`;
    const foreign = `${privateRoot}-config-probe-foreign`;
    const foreignLeaf = path.join(nestedParent, "foreign", "sentinel");

    await rename(nestedParent, displaced);
    await mkdir(path.dirname(foreignLeaf), { recursive: true, mode: 0o700 });
    await writeFile(foreignLeaf, "foreign\n", { mode: 0o600 });

    await assert.rejects(async () => destroyNodeScaffoldExecutionEnvironmentV2(
      created.handle,
    ), { code: "NODE_SCAFFOLD_EXECUTION_ENVIRONMENT_V2_STATE_DRIFT" });
    assert.equal(existsSync(privateRoot), true);
    assert.equal(existsSync(displaced), true);
    assert.equal(existsSync(foreignLeaf), true);

    await rename(nestedParent, foreign);
    await rename(displaced, nestedParent);
    destroyNodeScaffoldExecutionEnvironmentV2(created.handle);
    assert.equal(existsSync(privateRoot), false);
    assert.equal(existsSync(path.join(foreign, "foreign", "sentinel")), true);
    await rm(foreign, { recursive: true, force: true });
  });

  it("normalizes process failures into typed effective-config rejection and cleans only its root", async () => {
    const fixture = await makeFixture();
    const calls: HostNodeToolchainProbeInvocationV2[] = [];
    const hostToolchain = await makeAuthority({
      fixture,
      calls,
      control: {
        effectiveResult: Object.freeze({
          status: "timed_out",
          stdout: "",
          stderr: "",
        }),
      },
    });
    const scratchParent = await makeScratchParent();
    await assert.rejects(createNodeScaffoldExecutionEnvironmentV2ForTest({
      profileId: PROFILE_ID,
      hostToolchain,
      scratchParent,
    }), { code: "NODE_SCAFFOLD_EXECUTION_ENVIRONMENT_V2_EFFECTIVE_CONFIG_INVALID" });
    assert.equal(existsSync(scratchParent), true);
    assert.deepEqual(await (await import("node:fs/promises")).readdir(scratchParent), []);
  });

  it("binds the canonical official-runtime rehearsal receipt and rejects replay mismatch", () => {
    const hash = "a".repeat(64);
    const identity: NodeScaffoldExecutionEnvironmentRehearsalReceiptHashPayloadV2 = {
      schema: NODE_SCAFFOLD_EXECUTION_ENVIRONMENT_REHEARSAL_RECEIPT_V2_SCHEMA,
      receiptVersion: NODE_SCAFFOLD_EXECUTION_ENVIRONMENT_REHEARSAL_VERSION_V2,
      authorityRef: NODE_SCAFFOLD_EXECUTION_ENVIRONMENT_REHEARSAL_AUTHORITY_REF_V2,
      status: "rehearsal_passed",
      admissionScope: "test_fixture",
      architecture: "arm64",
      officialSource: {
        manifestHash: hash,
        artifactHash: hash,
        verificationReceiptHash: hash,
        archiveSha256: hash,
        archiveByteLength: 25_962_500,
      },
      provisioning: {
        receiptSchema: "setfarm.node-toolchain-provisioning-receipt.v2",
        receiptHash: hash,
        treeHash: hash,
        targetRef: "SETFARM_ROOT_NODE_22_23_1_NPM_10_9_8_ARM64_V2",
      },
      hostToolchain: {
        receiptSchema: "setfarm.host-node-toolchain-receipt.v2",
        receiptHash: hash,
        nodeVersion: "22.23.1",
        modulesAbi: "127",
        napiVersion: "10",
        npmVersion: "10.9.8",
        nodeIdentityHash: hash,
        npmClosureHash: hash,
      },
      environment: {
        receiptSchema: "setfarm.node-scaffold-execution-environment-receipt.v2",
        receiptHash: hash,
        effectiveConfigReceiptSchema: "setfarm.effective-npm-config-receipt.v2",
        effectiveConfigReceiptHash: hash,
        effectiveConfigHash: hash,
        environmentHash: hash,
        revalidationReceiptHash: hash,
        registry: "https://registry.npmjs.org",
        projectNpmrcEvidence: "pending_file_tree_join",
      },
      finalState: {
        environmentRoot: "absent_after_authenticated_destroy",
        rehearsalRoot: "removed_exactly",
        productionToolchainRoot: "untouched",
      },
    };
    const receipt = {
      ...identity,
      receiptHash: hashNodeScaffoldExecutionEnvironmentRehearsalReceiptV2(identity),
    };
    assert.equal(
      NodeScaffoldExecutionEnvironmentRehearsalReceiptV2Schema.parse(receipt).receiptHash,
      receipt.receiptHash,
    );
    assert.equal(NodeScaffoldExecutionEnvironmentRehearsalReceiptV2Schema.safeParse({
      ...receipt,
      environment: { ...receipt.environment, revalidationReceiptHash: "b".repeat(64) },
      receiptHash: hashNodeScaffoldExecutionEnvironmentRehearsalReceiptV2({
        ...identity,
        environment: { ...identity.environment, revalidationReceiptHash: "b".repeat(64) },
      }),
    }).success, false);
  });
});
