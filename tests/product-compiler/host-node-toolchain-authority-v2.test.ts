import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import {
  chmod,
  chown,
  copyFile,
  link,
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  rename,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, it } from "node:test";

import {
  HostNodeToolchainAuthorityErrorV2,
  createHostNodeToolchainAuthorityV2,
  createHostNodeToolchainAuthorityV2ForTest,
  executeHostNodeToolchainCandidateProductionNpmCiV2,
  inspectHostNodeToolchainReceiptV2,
  isProductionHostNodeToolchainAuthorityV2,
  requireProductionHostNodeToolchainPreSpawnV2,
  revalidateHostNodeToolchainAuthorityV2,
  type HostNodeToolchainProbeInvocationV2,
  type HostNodeToolchainProbeResultV2,
  type HostNodeToolchainCandidateProductionNpmCiInputV2,
} from "../../src/product-compiler/host-node-toolchain-authority-v2.js";
import {
  HostNodeToolchainReceiptV2Schema,
  hashHostNodeExecutableIdentityV2,
  hashHostNodeToolchainReceiptV2,
} from "../../src/product-compiler/schemas/host-node-toolchain-receipt-v2.js";
import {
  CANDIDATE_NPM_DIRECT_ARGV_HASH_V2,
} from "../../src/execution/schemas/candidate-runtime-bundle-v2.js";

const PROFILE_ID = "PROFILE_NODE_EXPRESS_API_STATELESS_EXACT_V2" as const;
const roots: string[] = [];

type Fixture = Readonly<{
  root: string;
  node: string;
  npmRoot: string;
  npmCli: string;
  packageJson: string;
  dynamicLibrary: string;
}>;

type ProbeOverrides = Readonly<{
  node?: HostNodeToolchainProbeResultV2;
  npm?: HostNodeToolchainProbeResultV2;
}>;

type CandidateProductionInstallFixture = Readonly<{
  privateRoot: string;
  candidateBundleRoot: string;
  environment: HostNodeToolchainCandidateProductionNpmCiInputV2["environment"];
}>;

function sha256(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

async function makeFixture(): Promise<Fixture> {
  const root = await mkdtemp(path.join(tmpdir(), "setfarm-host-node-v2-"));
  roots.push(root);
  const node = path.join(root, "bin", "node");
  const npmRoot = path.join(root, "lib", "node_modules", "npm");
  const npmCli = path.join(npmRoot, "bin", "npm-cli.js");
  const packageJson = path.join(npmRoot, "package.json");
  const dynamicLibrary = path.join(root, "lib", "libnode.127.dylib");
  await mkdir(path.dirname(node), { recursive: true });
  await mkdir(path.dirname(npmCli), { recursive: true });
  await mkdir(path.join(npmRoot, "lib"), { recursive: true });
  await writeFile(node, "fixture-node-binary\n", { mode: 0o555 });
  await writeFile(npmCli, "#!/usr/bin/env node\nrequire('../lib/cli.js')(process)\n", { mode: 0o555 });
  await writeFile(path.join(npmRoot, "lib", "cli.js"), "module.exports = () => {}\n", { mode: 0o444 });
  await writeFile(packageJson, `${JSON.stringify({
    name: "npm",
    version: "10.9.8",
    bin: { npm: "bin/npm-cli.js", npx: "bin/npx-cli.js" },
  })}\n`, { mode: 0o444 });
  await writeFile(path.join(npmRoot, ".npmrc"), "", { mode: 0o444 });
  await writeFile(path.join(npmRoot, "bin", "npx-cli.js"), "// fixture\n", { mode: 0o555 });
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
    chmod(packageJson, 0o444),
    chmod(path.join(npmRoot, ".npmrc"), 0o444),
    chmod(path.join(npmRoot, "bin", "npx-cli.js"), 0o555),
    chmod(dynamicLibrary, 0o555),
  ]);
  return { root, node, npmRoot, npmCli, packageJson, dynamicLibrary };
}

function exited(stdout: string, stderr = ""): HostNodeToolchainProbeResultV2 {
  return Object.freeze({
    status: "exited",
    exitCode: 0,
    signal: null,
    stdout,
    stderr,
  });
}

function makeProbeAdapter(
  fixture: Fixture,
  calls: HostNodeToolchainProbeInvocationV2[],
  overrides: ProbeOverrides = {},
) {
  return async (invocation: HostNodeToolchainProbeInvocationV2):
  Promise<HostNodeToolchainProbeResultV2> => {
    calls.push(invocation);
    if (invocation.probeRef === "HOST_NODE_RUNTIME_IDENTITY_PROBE_V2") {
      return overrides.node ?? exited(`${JSON.stringify({
        version: "22.23.1",
        modulesAbi: "127",
        napiVersion: "10",
        platform: "darwin",
        architecture: "arm64",
        execPath: fixture.node,
      })}\n`);
    }
    return overrides.npm ?? exited("10.9.8\n");
  };
}

async function authority(
  fixture: Fixture,
  overrides: ProbeOverrides = {},
  calls: HostNodeToolchainProbeInvocationV2[] = [],
) {
  return createHostNodeToolchainAuthorityV2ForTest({
    profileId: PROFILE_ID,
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
    probeAdapter: makeProbeAdapter(fixture, calls, overrides),
  });
}

async function makeCandidateProductionInstallFixture():
Promise<CandidateProductionInstallFixture> {
  const privateRoot = await realpath(
    await mkdtemp(path.join(tmpdir(), "setfarm-runtime-env-v2-")),
  );
  roots.push(privateRoot);
  for (const name of ["cache", "config-probe", "home", "tmp"]) {
    await mkdir(path.join(privateRoot, name), { mode: 0o700 });
    await chmod(path.join(privateRoot, name), 0o700);
  }
  await writeFile(path.join(privateRoot, "global.npmrc"), "\n", { mode: 0o600 });
  await writeFile(path.join(privateRoot, "user.npmrc"), "\n", { mode: 0o600 });
  await chmod(privateRoot, 0o700);

  const attemptRoot = await realpath(
    await mkdtemp(path.join(tmpdir(), "setfarm-runtime-attempt-v2-")),
  );
  roots.push(attemptRoot);
  const candidateBundleRoot = path.join(attemptRoot, "candidate-bundle");
  const applicationRoot = path.join(candidateBundleRoot, "application");
  await mkdir(applicationRoot, { recursive: true, mode: 0o700 });
  await writeFile(path.join(applicationRoot, "app.js"), "export function createApp() {}\n", {
    mode: 0o444,
  });
  await writeFile(
    path.join(applicationRoot, "app.setfarm.test.js"),
    "export const testCount = 1;\n",
    { mode: 0o444 },
  );
  await writeFile(path.join(candidateBundleRoot, "package.json"), `${JSON.stringify({
    name: "@setfarm/generated-node-express-api-v2",
    version: "0.0.0",
    private: true,
    dependencies: { express: "5.2.1" },
    devDependencies: { typescript: "5.9.3" },
  })}\n`, { mode: 0o444 });
  await writeFile(path.join(candidateBundleRoot, "package-lock.json"), `${JSON.stringify({
    name: "@setfarm/generated-node-express-api-v2",
    version: "0.0.0",
    lockfileVersion: 3,
    requires: true,
    packages: {},
  })}\n`, { mode: 0o444 });
  await Promise.all([
    chmod(attemptRoot, 0o700),
    chmod(candidateBundleRoot, 0o700),
    chmod(applicationRoot, 0o555),
    chmod(path.join(applicationRoot, "app.js"), 0o444),
    chmod(path.join(applicationRoot, "app.setfarm.test.js"), 0o444),
    chmod(path.join(candidateBundleRoot, "package.json"), 0o444),
    chmod(path.join(candidateBundleRoot, "package-lock.json"), 0o444),
  ]);
  return {
    privateRoot,
    candidateBundleRoot,
    environment: Object.freeze({
      CI: "true",
      HOME: path.join(privateRoot, "home"),
      LANG: "C.UTF-8",
      LC_ALL: "C.UTF-8",
      NODE_DISABLE_COMPILE_CACHE: "1",
      NO_COLOR: "1",
      NPM_CONFIG_CACHE: path.join(privateRoot, "cache"),
      NPM_CONFIG_ENGINE_STRICT: "true",
      NPM_CONFIG_GLOBALCONFIG: path.join(privateRoot, "global.npmrc"),
      NPM_CONFIG_LOGS_MAX: "0",
      NPM_CONFIG_REGISTRY: "https://registry.npmjs.org",
      NPM_CONFIG_USERCONFIG: path.join(privateRoot, "user.npmrc"),
      TEMP: path.join(privateRoot, "tmp"),
      TMP: path.join(privateRoot, "tmp"),
      TMPDIR: path.join(privateRoot, "tmp"),
      TZ: "UTC",
    }),
  };
}

async function runtimeInstallAuthority(
  fixture: Fixture,
  calls: HostNodeToolchainProbeInvocationV2[],
  runtimeOperation: (
    invocation: HostNodeToolchainProbeInvocationV2,
  ) => Promise<HostNodeToolchainProbeResultV2>,
) {
  const baseAdapter = makeProbeAdapter(fixture, calls);
  return createHostNodeToolchainAuthorityV2ForTest({
    profileId: PROFILE_ID,
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
    probeAdapter: async (invocation) => {
      if (invocation.probeRef !== "HOST_NPM_CANDIDATE_PRODUCTION_INSTALL_V2") {
        return baseAdapter(invocation);
      }
      calls.push(invocation);
      return runtimeOperation(invocation);
    },
  });
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map(async (root) => {
    await chmod(path.join(root, "candidate-bundle", "application"), 0o700)
      .catch(() => undefined);
    await rm(root, { recursive: true, force: true });
  }));
});

describe("HostNodeToolchainAuthorityV2", () => {
  it("issues a pathless authenticated receipt for the exact paired toolchain", async () => {
    const fixture = await makeFixture();
    const calls: HostNodeToolchainProbeInvocationV2[] = [];
    const handle = await authority(fixture, {}, calls);
    const receipt = inspectHostNodeToolchainReceiptV2(handle);

    assert.equal(receipt.admissionScope, "test_fixture");
    assert.equal(receipt.filesystemProtection, "test_fixture_only");
    assert.equal(isProductionHostNodeToolchainAuthorityV2(handle), false);
    assert.equal(receipt.requirement.profileId, PROFILE_ID);
    assert.equal(receipt.node.version, "22.23.1");
    assert.equal(receipt.node.modulesAbi, "127");
    assert.equal(receipt.node.napiVersion, "10");
    assert.equal(receipt.npm.version, "10.9.8");
    assert.equal(receipt.npm.cliLocator, "bin/npm-cli.js");
    assert.equal(receipt.npm.packageTree.fileCount, 5);
    assert.equal(receipt.node.nonSystemDynamicLibraries.memberCount, 1);
    assert.equal(HostNodeToolchainReceiptV2Schema.parse(receipt).receiptHash, receipt.receiptHash);
    assert.equal(Object.isFrozen(receipt), true);
    assert.equal(Object.isFrozen(receipt.npm), true);
    assert.doesNotMatch(JSON.stringify(receipt), /setfarm-host-node-v2|\/private\/|\/opt\/|\/Users\//);

    assert.deepEqual(calls.map((call) => call.probeRef), [
      "HOST_NODE_RUNTIME_IDENTITY_PROBE_V2",
      "HOST_NPM_VERSION_PROBE_V2",
    ]);
    const realNode = await realpath(fixture.node);
    const realNpmCli = await realpath(fixture.npmCli);
    assert.equal(calls[0]?.executable, realNode);
    assert.equal(calls[1]?.executable, realNode);
    assert.equal(calls[1]?.argv[0], realNpmCli);
    assert.equal(calls.every((call) => call.shell === false), true);
    assert.equal(calls.every((call) => call.env.NODE_OPTIONS === undefined), true);
    assert.equal(calls.every((call) => call.env.npm_config_registry === undefined), true);
    assert.equal(calls.every((call) => call.env.PATH === path.dirname(realNode)), true);
  });

  it("returns defensive receipt copies and rejects DTOs, proxies and forged handles", async () => {
    const fixture = await makeFixture();
    const handle = await authority(fixture);
    const first = inspectHostNodeToolchainReceiptV2(handle);
    const second = inspectHostNodeToolchainReceiptV2(handle);
    assert.notEqual(first, second);
    assert.notEqual(first.node, second.node);
    assert.throws(() => inspectHostNodeToolchainReceiptV2(first as never), {
      code: "HOST_NODE_TOOLCHAIN_V2_HANDLE_UNAUTHENTICATED",
    });
    assert.throws(() => inspectHostNodeToolchainReceiptV2(new Proxy(handle, {}) as never), {
      code: "HOST_NODE_TOOLCHAIN_V2_HANDLE_UNAUTHENTICATED",
    });
    assert.throws(() => inspectHostNodeToolchainReceiptV2(Object.create(Object.getPrototypeOf(handle))), {
      code: "HOST_NODE_TOOLCHAIN_V2_HANDLE_UNAUTHENTICATED",
    });

    await assert.rejects(requireProductionHostNodeToolchainPreSpawnV2(handle), {
      code: "HOST_NODE_TOOLCHAIN_V2_PRODUCTION_AUTHORITY_REQUIRED",
    });

    const { receiptHash: _receiptHash, ...payload } = first;
    const { identityHash: _identityHash, ...nodeIdentity } = payload.node;
    const forgedNodeIdentity = {
      ...nodeIdentity,
      executable: {
        ...nodeIdentity.executable,
        contentHash: "d".repeat(64),
      },
    };
    const selfRehashed = {
      ...payload,
      node: {
        ...forgedNodeIdentity,
        identityHash: hashHostNodeExecutableIdentityV2(forgedNodeIdentity),
      },
      receiptHash: hashHostNodeToolchainReceiptV2(payload),
    };
    selfRehashed.receiptHash = hashHostNodeToolchainReceiptV2(selfRehashed);
    assert.equal(HostNodeToolchainReceiptV2Schema.safeParse(selfRehashed).success, true);
    assert.throws(() => inspectHostNodeToolchainReceiptV2(selfRehashed as never), {
      code: "HOST_NODE_TOOLCHAIN_V2_HANDLE_UNAUTHENTICATED",
    });

    const forgedProduction = {
      ...first,
      admissionScope: "production_host" as const,
      filesystemProtection: "root_owned_runtime_read_only" as const,
    };
    forgedProduction.receiptHash = hashHostNodeToolchainReceiptV2(forgedProduction);
    assert.equal(HostNodeToolchainReceiptV2Schema.safeParse(forgedProduction).success, false);
  });

  it("rejects wrong versions and an executable/npm pairing mismatch", async () => {
    const fixture = await makeFixture();
    await assert.rejects(authority(fixture, {
      node: exited(`${JSON.stringify({
        version: "23.0.0",
        modulesAbi: "131",
        napiVersion: "10",
        platform: "darwin",
        architecture: "arm64",
        execPath: fixture.node,
      })}\n`),
    }), { code: "HOST_NODE_TOOLCHAIN_V2_NODE_VERSION_MISMATCH" });
    await assert.rejects(authority(fixture, { npm: exited("11.0.0\n") }), {
      code: "HOST_NODE_TOOLCHAIN_V2_NPM_VERSION_MISMATCH",
    });
    await assert.rejects(authority(fixture, {
      node: exited(`${JSON.stringify({
        version: "22.23.1",
        modulesAbi: "127",
        napiVersion: "10",
        platform: "darwin",
        architecture: "arm64",
        execPath: path.join(fixture.root, "other-node"),
      })}\n`),
    }), { code: "HOST_NODE_TOOLCHAIN_V2_EXECUTABLE_PAIRING_MISMATCH" });
  });

  it("classifies every bounded probe failure without retry prose", async () => {
    const fixture = await makeFixture();
    const failures: Array<readonly [HostNodeToolchainProbeResultV2, string]> = [
      [Object.freeze({ status: "timed_out", stdout: "", stderr: "" }),
        "HOST_NODE_TOOLCHAIN_V2_PROBE_TIMEOUT"],
      [Object.freeze({ status: "output_limit_exceeded", stdout: "x", stderr: "" }),
        "HOST_NODE_TOOLCHAIN_V2_PROBE_OUTPUT_LIMIT"],
      [Object.freeze({ status: "spawn_failed", stdout: "", stderr: "denied" }),
        "HOST_NODE_TOOLCHAIN_V2_PROBE_SPAWN_FAILED"],
      [Object.freeze({ status: "exited", exitCode: null, signal: "SIGKILL", stdout: "", stderr: "" }),
        "HOST_NODE_TOOLCHAIN_V2_PROBE_SIGNALLED"],
      [Object.freeze({ status: "exited", exitCode: 7, signal: null, stdout: "", stderr: "failure" }),
        "HOST_NODE_TOOLCHAIN_V2_PROBE_NONZERO"],
      [exited("not-json\n"), "HOST_NODE_TOOLCHAIN_V2_PROBE_MALFORMED"],
    ];
    for (const [result, code] of failures) {
      await assert.rejects(authority(fixture, { node: result }), { code });
    }
  });

  it("rejects symlinks, hard links and mutable package payload additions", async () => {
    const symlinkFixture = await makeFixture();
    const original = `${symlinkFixture.npmCli}.original`;
    await rename(symlinkFixture.npmCli, original);
    await symlink(original, symlinkFixture.npmCli);
    await assert.rejects(authority(symlinkFixture), {
      code: "HOST_NODE_TOOLCHAIN_V2_PACKAGE_CLOSURE_INVALID",
    });

    const hardlinkFixture = await makeFixture();
    await link(
      path.join(hardlinkFixture.npmRoot, "lib", "cli.js"),
      path.join(hardlinkFixture.npmRoot, "lib", "cli-alias.js"),
    );
    await assert.rejects(authority(hardlinkFixture), {
      code: "HOST_NODE_TOOLCHAIN_V2_PACKAGE_CLOSURE_INVALID",
    });

    const writableFixture = await makeFixture();
    await writeFile(path.join(writableFixture.npmRoot, "unexpected.pyc"), "mutable", { mode: 0o644 });
    await assert.rejects(authority(writableFixture), {
      code: "HOST_NODE_TOOLCHAIN_V2_PACKAGE_CLOSURE_INVALID",
    });

    const builtinConfigFixture = await makeFixture();
    await writeFile(path.join(builtinConfigFixture.npmRoot, "npmrc"), "prefix=/unexpected\n", {
      mode: 0o444,
    });
    await assert.rejects(authority(builtinConfigFixture), {
      code: "HOST_NODE_TOOLCHAIN_V2_PACKAGE_CLOSURE_INVALID",
    });
  });

  it("revalidates every held identity and refuses unchanged-receipt host drift", async () => {
    const fixture = await makeFixture();
    const handle = await authority(fixture);
    const original = inspectHostNodeToolchainReceiptV2(handle);
    await chmod(path.join(fixture.npmRoot, "lib", "cli.js"), 0o644);
    await writeFile(path.join(fixture.npmRoot, "lib", "cli.js"), "mutated\n");
    await chmod(path.join(fixture.npmRoot, "lib", "cli.js"), 0o444);

    await assert.rejects(revalidateHostNodeToolchainAuthorityV2(handle), {
      code: "HOST_NODE_TOOLCHAIN_V2_HOST_DRIFT",
    });
    assert.equal(inspectHostNodeToolchainReceiptV2(handle).receiptHash, original.receiptHash);
  });

  it("invalidates the handle when a non-system dynamic library changes", async () => {
    const fixture = await makeFixture();
    const handle = await authority(fixture);
    await chmod(fixture.dynamicLibrary, 0o755);
    await writeFile(fixture.dynamicLibrary, "changed-dylib\n");
    await chmod(fixture.dynamicLibrary, 0o555);
    await assert.rejects(revalidateHostNodeToolchainAuthorityV2(handle), {
      code: "HOST_NODE_TOOLCHAIN_V2_HOST_DRIFT",
    });
  });

  it("constructs probe environments from deny-all despite hostile ambient values", async () => {
    const fixture = await makeFixture();
    const calls: HostNodeToolchainProbeInvocationV2[] = [];
    const prior = {
      PATH: process.env.PATH,
      NODE_OPTIONS: process.env.NODE_OPTIONS,
      npmConfig: process.env.npm_config_registry,
      proxy: process.env.HTTPS_PROXY,
    };
    process.env.PATH = "/attacker/bin";
    process.env.NODE_OPTIONS = "--require=/attacker/preload.js";
    process.env.npm_config_registry = "https://attacker.invalid";
    process.env.HTTPS_PROXY = "https://attacker.invalid";
    try {
      await authority(fixture, {}, calls);
    } finally {
      for (const [key, value] of Object.entries({
        PATH: prior.PATH,
        NODE_OPTIONS: prior.NODE_OPTIONS,
        npm_config_registry: prior.npmConfig,
        HTTPS_PROXY: prior.proxy,
      })) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
    }
    for (const call of calls) {
      assert.deepEqual(Object.keys(call.env).sort(), [
        "HOME",
        "LANG",
        "LC_ALL",
        "NO_COLOR",
        "NPM_CONFIG_CACHE",
        "NPM_CONFIG_GLOBALCONFIG",
        "NPM_CONFIG_USERCONFIG",
        "PATH",
        "TEMP",
        "TMP",
        "TMPDIR",
        "TZ",
      ]);
      assert.equal(Object.values(call.env).some((value) => value.includes("attacker")), false);
    }
  });

  it("keeps production candidate paths code-owned and rejects caller path injection", async () => {
    const source = await readFile(
      path.resolve("src/product-compiler/host-node-toolchain-authority-v2.ts"),
      "utf8",
    );
    const registrySource = await readFile(
      path.resolve("src/product-compiler/node-toolchain-target-registry-v2.ts"),
      "utf8",
    );
    assert.match(
      registrySource,
      /\/Library\/Application Support\/Setfarm\/toolchains/,
    );
    assert.match(registrySource, /node-22\.23\.1-npm-10\.9\.8-darwin-arm64/);
    assert.match(source, /getCodeOwnedNodeToolchainTargetV2\(host\.architecture\)/);
    assert.match(source, /openProductionProvisionedNodeToolchainV2\(\)/);
    assert.doesNotMatch(source, /logicalRoot:\s*"\/opt\/homebrew\/opt\/node@22"/);
    assert.doesNotMatch(source, /logicalRoot:\s*"\/usr\/local\/opt\/node@22"/);
    assert.match(source, /createHostNodeToolchainAuthorityV2\(input: unknown\)/);
    assert.doesNotMatch(source, /createHostNodeToolchainAuthorityV2\(input: Readonly<\{[^}]*root:/s);

    await assert.rejects(
      createHostNodeToolchainAuthorityV2({
        profileId: PROFILE_ID,
        candidateRoot: "/tmp/attacker-node",
      } as never),
      (error: unknown) => error instanceof HostNodeToolchainAuthorityErrorV2
        && error.code === "HOST_NODE_TOOLCHAIN_V2_INPUT_INVALID",
    );
  });

  it("binds receipt hashes to the exact package and executable closure", async () => {
    const fixture = await makeFixture();
    const receipt = inspectHostNodeToolchainReceiptV2(await authority(fixture));
    assert.equal(receipt.node.executable.contentHash, sha256("fixture-node-binary\n"));
    assert.equal(
      receipt.npm.packageJson.contentHash,
      sha256(await readFile(fixture.packageJson)),
    );
    assert.deepEqual(receipt.npm.builtinNpmrc, { locator: "npmrc", status: "absent" });
    assert.equal(receipt.receiptHash, hashHostNodeToolchainReceiptV2(receipt));
  });

  it("executes only the exact fenced candidate production npm operation", async () => {
    const fixture = await makeFixture();
    const install = await makeCandidateProductionInstallFixture();
    const calls: HostNodeToolchainProbeInvocationV2[] = [];
    const handle = await runtimeInstallAuthority(fixture, calls, async (invocation) => {
      await mkdir(path.join(invocation.cwd, "node_modules"), { mode: 0o755 });
      return exited("added 67 packages\n");
    });
    const evidence = await executeHostNodeToolchainCandidateProductionNpmCiV2(
      handle,
      install,
    );

    assert.equal(evidence.probeRef,
      "HOST_NPM_CANDIDATE_PRODUCTION_INSTALL_V2");
    assert.deepEqual(evidence.directArgv, [
      "npm",
      "ci",
      "--omit=dev",
      "--ignore-scripts",
      "--no-audit",
      "--no-fund",
    ]);
    assert.equal(evidence.stdin, "closed");
    assert.equal(evidence.shell, "forbidden");
    assert.equal(evidence.ambientEnvironment, "forbidden");
    assert.equal(evidence.status, "exited_zero");
    assert.equal(evidence.directArgvHash, CANDIDATE_NPM_DIRECT_ARGV_HASH_V2);
    assert.match(evidence.projectScopeHash, /^[a-f0-9]{64}$/u);
    assert.match(evidence.sourceFenceHash, /^[a-f0-9]{64}$/u);
    assert.equal(Object.isFrozen(evidence), true);
    assert.doesNotMatch(JSON.stringify(evidence),
      /setfarm-runtime-env-v2|setfarm-runtime-attempt-v2|\/private\/|\/Users\//);

    const runtimeCall = calls.find((call) =>
      call.probeRef === "HOST_NPM_CANDIDATE_PRODUCTION_INSTALL_V2");
    assert.ok(runtimeCall);
    assert.equal(runtimeCall.executable, await realpath(fixture.node));
    assert.deepEqual(runtimeCall.argv, [
      await realpath(fixture.npmCli),
      "ci",
      "--omit=dev",
      "--ignore-scripts",
      "--no-audit",
      "--no-fund",
    ]);
    assert.equal(runtimeCall.cwd, install.candidateBundleRoot);
    assert.equal(runtimeCall.shell, false);
    assert.equal(runtimeCall.timeoutMs, 120_000);
    assert.equal(runtimeCall.maxStdoutBytes, 65_536);
    assert.equal(runtimeCall.maxStderrBytes, 65_536);
    assert.equal(runtimeCall.env.PATH, path.dirname(await realpath(fixture.node)));
    assert.equal(runtimeCall.env.NODE_OPTIONS, undefined);
    assert.equal(runtimeCall.env.npm_config_registry, undefined);
  });

  it("classifies every candidate production npm process failure", async () => {
    const fixture = await makeFixture();
    const install = await makeCandidateProductionInstallFixture();
    const failures: Array<readonly [HostNodeToolchainProbeResultV2, string]> = [
      [Object.freeze({ status: "timed_out", stdout: "", stderr: "" }),
        "HOST_NODE_TOOLCHAIN_V2_RUNTIME_INSTALL_TIMEOUT"],
      [Object.freeze({ status: "output_limit_exceeded", stdout: "x", stderr: "" }),
        "HOST_NODE_TOOLCHAIN_V2_RUNTIME_INSTALL_OUTPUT_LIMIT"],
      [Object.freeze({ status: "spawn_failed", stdout: "", stderr: "denied" }),
        "HOST_NODE_TOOLCHAIN_V2_RUNTIME_INSTALL_SPAWN_FAILED"],
      [Object.freeze({
        status: "exited",
        exitCode: null,
        signal: "SIGKILL",
        stdout: "",
        stderr: "",
      }), "HOST_NODE_TOOLCHAIN_V2_RUNTIME_INSTALL_SIGNALLED"],
      [Object.freeze({
        status: "exited",
        exitCode: 17,
        signal: null,
        stdout: "",
        stderr: "failed",
      }), "HOST_NODE_TOOLCHAIN_V2_RUNTIME_INSTALL_NONZERO"],
    ];
    for (const [result, code] of failures) {
      const handle = await runtimeInstallAuthority(fixture, [], async () => result);
      await assert.rejects(
        executeHostNodeToolchainCandidateProductionNpmCiV2(handle, install),
        { code },
      );
    }
    const throwing = await runtimeInstallAuthority(fixture, [], async () => {
      throw new Error("adapter failed");
    });
    await assert.rejects(
      executeHostNodeToolchainCandidateProductionNpmCiV2(throwing, install),
      { code: "HOST_NODE_TOOLCHAIN_V2_RUNTIME_INSTALL_SPAWN_FAILED" },
    );
  });

  it("rejects candidate source drift and caller-owned operation fields", async () => {
    const fixture = await makeFixture();
    const install = await makeCandidateProductionInstallFixture();
    const packageJson = path.join(install.candidateBundleRoot, "package.json");
    const handle = await runtimeInstallAuthority(fixture, [], async (invocation) => {
      await chmod(packageJson, 0o644);
      await writeFile(packageJson, "{\"name\":\"mutated\"}\n");
      await chmod(packageJson, 0o444);
      await mkdir(path.join(invocation.cwd, "node_modules"), { mode: 0o755 });
      return exited("added 1 package\n");
    });
    await assert.rejects(
      executeHostNodeToolchainCandidateProductionNpmCiV2(handle, install),
      { code: "HOST_NODE_TOOLCHAIN_V2_RUNTIME_INSTALL_SOURCE_DRIFT" },
    );

    const clean = await makeCandidateProductionInstallFixture();
    const cleanHandle = await runtimeInstallAuthority(fixture, [], async () =>
      exited("unreachable\n"));
    await assert.rejects(
      executeHostNodeToolchainCandidateProductionNpmCiV2(cleanHandle, {
        ...clean,
        argv: ["npm", "install"],
      } as never),
      { code: "HOST_NODE_TOOLCHAIN_V2_RUNTIME_INSTALL_SCOPE_INVALID" },
    );
  });

  it("runs the real direct probe adapter and recursive Mach-O resolver", {
    skip: !existsSync("/opt/homebrew/opt/node@22/bin/node")
      || !existsSync("/opt/homebrew/opt/node@22/lib/libnode.127.dylib"),
  }, async () => {
    const fixture = await makeFixture();
    await rm(fixture.node);
    await copyFile("/opt/homebrew/opt/node@22/bin/node", fixture.node);
    await chown(fixture.node, process.getuid(), process.getgid());
    await chmod(fixture.node, 0o555);
    await rm(fixture.dynamicLibrary);
    await copyFile("/opt/homebrew/opt/node@22/lib/libnode.127.dylib", fixture.dynamicLibrary);
    await chown(fixture.dynamicLibrary, process.getuid(), process.getgid());
    await chmod(fixture.dynamicLibrary, 0o555);
    await chmod(fixture.npmCli, 0o644);
    await writeFile(fixture.npmCli, "process.stdout.write('10.9.8\\n')\n");
    await chmod(fixture.npmCli, 0o555);

    const handle = await createHostNodeToolchainAuthorityV2ForTest({
      profileId: PROFILE_ID,
      fixture: {
        candidateRoot: fixture.root,
        host: {
          platform: "darwin",
          architecture: "arm64",
          macosProductVersion: "26.5.2",
          macosBuildVersion: "25F84",
          darwinKernelRelease: "25.5.0",
        },
      },
    });
    const receipt = inspectHostNodeToolchainReceiptV2(handle);
    assert.equal(receipt.node.version, "22.23.1");
    assert.equal(receipt.npm.version, "10.9.8");
    assert.ok(receipt.node.nonSystemDynamicLibraries.memberCount >= 10);
    assert.equal(
      (await revalidateHostNodeToolchainAuthorityV2(handle)).receiptHash,
      receipt.receiptHash,
    );
  });

  it("enforces timeout, output and signal bounds in the real process adapter", async () => {
    const cases: Array<readonly [string, string]> = [
      ["#!/bin/sh\n/bin/sleep 30\n", "HOST_NODE_TOOLCHAIN_V2_PROBE_TIMEOUT"],
      [
        "#!/bin/sh\n/usr/bin/yes x | /usr/bin/head -c 5000\n",
        "HOST_NODE_TOOLCHAIN_V2_PROBE_OUTPUT_LIMIT",
      ],
      ["#!/bin/sh\n/bin/kill -KILL $$\n", "HOST_NODE_TOOLCHAIN_V2_PROBE_SIGNALLED"],
    ];
    for (const [script, code] of cases) {
      const fixture = await makeFixture();
      await chmod(fixture.node, 0o755);
      await writeFile(fixture.node, script);
      await chmod(fixture.node, 0o555);
      await assert.rejects(createHostNodeToolchainAuthorityV2ForTest({
        profileId: PROFILE_ID,
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
      }), { code });
    }
  });
});
