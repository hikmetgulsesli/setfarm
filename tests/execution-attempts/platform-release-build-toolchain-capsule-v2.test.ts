import assert from "node:assert/strict";
import {
  chmodSync,
  existsSync,
  linkSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  realpathSync,
  renameSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { afterEach, describe, it } from "node:test";

import {
  canonicalJsonStringify,
} from
  "../../src/product-compiler/canonical-json.js";
import {
  createHostNodeToolchainAuthorityV2ForTest,
  hashHostNodePlatformReleaseOutputStageIdentityV2,
  type HostNodeToolchainProbeInvocationV2,
  type HostNodeToolchainProbeResultV2,
} from
  "../../src/product-compiler/host-node-toolchain-authority-v2.js";
import {
  createPlatformReleaseHostNodeToolchainAuthorityV2ForTest,
} from
  "../../src/execution/platform-release-host-node-toolchain-authority-v2.js";
import {
  AdmittedPlatformReleaseSourceStageV2,
  PlatformReleaseBuildToolchainCapsuleErrorV2,
  PlatformReleaseBuildToolchainCapsuleV2,
  PlatformReleaseCompiledOutputPairV2,
  PlatformReleaseSourceAdmissionErrorV2,
  admitPlatformReleaseSourceV2ForTest,
  disposePlatformReleaseSourceStageV2,
  inspectPlatformReleaseCompiledOutputPairV2,
  inspectPlatformReleaseBuildToolchainReceiptV2,
  materializePlatformReleaseCompiledOutputPairV2,
  materializePlatformReleaseCompiledOutputPairV2ForTest,
  materializePlatformReleaseCompiledOutputPairWithAllocationFaultForTestV2,
  materializePlatformReleaseBuildToolchainCapsuleV2,
  materializePlatformReleaseBuildToolchainCapsuleV2ForTest,
  revalidatePlatformReleaseCompiledOutputPairV2,
  revalidatePlatformReleaseBuildToolchainCapsuleV2,
  withPlatformReleaseCompiledOutputPairForTestV2,
  withPlatformReleaseBuildToolchainCapsuleForTestV2,
  withPlatformReleaseSourceStageForTestV2,
} from
  "../../src/execution/platform-release-source-admission-v2.js";
import {
  PlatformReleaseBuildToolchainReceiptV2Schema,
} from
  "../../src/execution/schemas/platform-release-build-v2.js";
import {
  hashPlatformReleaseCompiledOutputPairInspectionV2,
  PlatformReleaseCompiledOutputPairInspectionV2Schema,
} from
  "../../src/execution/schemas/platform-release-compiled-output-pair-v2.js";

const GIT = "/usr/bin/git";
const roots: string[] = [];

type InstallModeV2 =
  | "valid"
  | "install_failure"
  | "missing_required"
  | "unexpected_package"
  | "wrong_bin_target";

type HostFixtureV2 = Readonly<{
  root: string;
  node: string;
  npmRoot: string;
  npmCli: string;
  dynamicLibrary: string;
}>;

type RepositoryFixtureV2 = Readonly<{
  root: string;
  repository: string;
}>;

function exited(
  stdout = "",
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

function runGit(
  repository: string,
  args: readonly string[],
): string {
  const result = spawnSync(GIT, [
    "-C",
    repository,
    ...args,
  ], {
    encoding: "utf8",
    env: {
      GIT_CONFIG_GLOBAL: "/dev/null",
      GIT_CONFIG_NOSYSTEM: "1",
      GIT_TERMINAL_PROMPT: "0",
      HOME: "/var/empty",
      LANG: "C",
      LC_ALL: "C",
      PATH: "/usr/bin:/bin",
      TZ: "UTC",
      GIT_AUTHOR_DATE: "2026-07-26T00:00:00Z",
      GIT_COMMITTER_DATE: "2026-07-26T00:00:00Z",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  assert.equal(
    result.status,
    0,
    `${args.join(" ")} failed: ${result.stderr}`,
  );
  return result.stdout.replace(/\n$/, "");
}

function lockEntry(
  input: Readonly<{
    name: string;
    version: string;
    dev?: boolean;
    optional?: boolean;
    dependencies?: Readonly<Record<string, string>>;
    os?: readonly string[];
    cpu?: readonly string[];
    bin?: string | Readonly<Record<string, string>>;
  }>,
) {
  return {
    version: input.version,
    resolved:
      `https://registry.npmjs.org/${input.name}/-/${input.name
        .split("/").at(-1)}-${input.version}.tgz`,
    integrity:
      "sha512-AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=",
    license: "MIT",
    ...(input.dev ? { dev: true } : {}),
    ...(input.optional ? { optional: true } : {}),
    ...(input.dependencies
      ? { dependencies: input.dependencies }
      : {}),
    ...(input.os ? { os: input.os } : {}),
    ...(input.cpu ? { cpu: input.cpu } : {}),
    ...(input.bin ? { bin: input.bin } : {}),
  };
}

function sourceArtifactsV2() {
  const packageJson = {
    name: "setfarm",
    version: "9.9.9",
    type: "module",
    private: true,
    engines: { node: ">=22" },
    bin: { setfarm: "dist/cli/cli.js" },
    scripts: { build: "tsc" },
    devDependencies: {
      typescript: "5.9.3",
    },
    optionalDependencies: {
      "@fixture/darwin-arm64": "1.0.0",
    },
  };
  const root = {
    name: packageJson.name,
    version: packageJson.version,
    bin: packageJson.bin,
    devDependencies: packageJson.devDependencies,
    engines: packageJson.engines,
    optionalDependencies:
      packageJson.optionalDependencies,
  };
  const packages = {
    "": root,
    "node_modules/@fixture/darwin-arm64": lockEntry({
      name: "@fixture/darwin-arm64",
      version: "1.0.0",
      dev: true,
      optional: true,
      os: ["darwin"],
      cpu: ["arm64"],
    }),
    "node_modules/compiler-helper": lockEntry({
      name: "compiler-helper",
      version: "1.0.0",
      dev: true,
    }),
    "node_modules/typescript": lockEntry({
      name: "typescript",
      version: "5.9.3",
      dev: true,
      dependencies: {
        "compiler-helper": "1.0.0",
      },
      bin: {
        tsc: "bin/tsc",
        tsserver: "bin/tsserver",
      },
    }),
  };
  return Object.freeze({
    packageJson,
    lock: {
      name: "setfarm",
      version: "9.9.9",
      lockfileVersion: 3,
      requires: true,
      packages,
    },
  });
}

function createRepositoryFixtureV2(): RepositoryFixtureV2 {
  const root = realpathSync(mkdtempSync(path.join(
    tmpdir(),
    "setfarm-platform-build-toolchain-source-v2-",
  )));
  roots.push(root);
  const origin = path.join(root, "origin.git");
  const repository = path.join(root, "repository");
  mkdirSync(origin);
  mkdirSync(repository);
  runGit(origin, ["init", "--bare"]);
  runGit(repository, ["init", "-b", "main"]);
  runGit(repository, [
    "config",
    "user.name",
    "Setfarm Test",
  ]);
  runGit(repository, [
    "config",
    "user.email",
    "setfarm@example.invalid",
  ]);
  runGit(repository, [
    "remote",
    "add",
    "origin",
    origin,
  ]);
  const artifacts = sourceArtifactsV2();
  writeFileSync(
    path.join(repository, "package.json"),
    `${JSON.stringify(artifacts.packageJson)}\n`,
  );
  writeFileSync(
    path.join(repository, "package-lock.json"),
    `${JSON.stringify(artifacts.lock)}\n`,
  );
  writeFileSync(
    path.join(repository, "tsconfig.json"),
    `${JSON.stringify({
      compilerOptions: {
        module: "NodeNext",
        target: "ES2022",
      },
    })}\n`,
  );
  mkdirSync(path.join(repository, "src"));
  writeFileSync(
    path.join(repository, "src", "index.ts"),
    "export const fixture = true;\n",
  );
  mkdirSync(
    path.join(repository, "src", "server"),
    { recursive: true },
  );
  writeFileSync(
    path.join(repository, "src", "server", "index.html"),
    "<!doctype html><title>fixture</title>\n",
  );
  mkdirSync(
    path.join(repository, "src", "installer", "prompts"),
    { recursive: true },
  );
  mkdirSync(
    path.join(repository, "src", "installer", "steps"),
    { recursive: true },
  );
  writeFileSync(
    path.join(
      repository,
      "src",
      "installer",
      "prompts",
      "fixture.md",
    ),
    "# Fixture prompt\n",
  );
  writeFileSync(
    path.join(
      repository,
      "src",
      "installer",
      "steps",
      "fixture.md",
    ),
    "# Fixture step\n",
  );
  writeFileSync(
    path.join(
      repository,
      "src",
      "installer",
      "compat-rules.json",
    ),
    "{\"version\":1}\n",
  );
  mkdirSync(path.join(repository, "scripts"));
  writeFileSync(
    path.join(
      repository,
      "scripts",
      "build-platform-release-v2.mjs",
    ),
    readFileSync(path.join(
      process.cwd(),
      "scripts",
      "build-platform-release-v2.mjs",
    )),
    { mode: 0o755 },
  );
  writeFileSync(
    path.join(
      repository,
      "scripts",
      "stitch-to-jsx.mjs",
    ),
    "export const convert = () => null;\n",
    { mode: 0o755 },
  );
  runGit(repository, ["add", "--all"]);
  runGit(repository, ["commit", "-m", "fixture"]);
  runGit(repository, ["push", "-u", "origin", "main"]);
  return Object.freeze({
    root,
    repository: realpathSync(repository),
  });
}

function createHostFixtureV2(): HostFixtureV2 {
  const root = realpathSync(mkdtempSync(path.join(
    tmpdir(),
    "setfarm-platform-build-toolchain-host-v2-",
  )));
  roots.push(root);
  const node = path.join(root, "bin", "node");
  const npmRoot =
    path.join(root, "lib", "node_modules", "npm");
  const npmCli = path.join(npmRoot, "bin", "npm-cli.js");
  const dynamicLibrary =
    path.join(root, "lib", "libnode.127.dylib");
  mkdirSync(path.dirname(node), { recursive: true });
  mkdirSync(path.dirname(npmCli), { recursive: true });
  mkdirSync(path.join(npmRoot, "lib"), {
    recursive: true,
  });
  writeFileSync(node, "fixture-node-binary\n", {
    mode: 0o555,
  });
  writeFileSync(
    npmCli,
    "require('../lib/cli.js')(process)\n",
    { mode: 0o555 },
  );
  writeFileSync(
    path.join(npmRoot, "lib", "cli.js"),
    "module.exports = () => {}\n",
    { mode: 0o444 },
  );
  writeFileSync(
    path.join(npmRoot, "package.json"),
    `${JSON.stringify({
      name: "npm",
      version: "10.9.8",
      bin: { npm: "bin/npm-cli.js" },
    })}\n`,
    { mode: 0o444 },
  );
  writeFileSync(dynamicLibrary, "fixture-dylib\n", {
    mode: 0o555,
  });
  for (const directory of [
    path.join(root, "bin"),
    path.join(root, "lib"),
    path.join(root, "lib", "node_modules"),
    npmRoot,
    path.join(npmRoot, "bin"),
    path.join(npmRoot, "lib"),
  ]) {
    chmodSync(directory, 0o755);
  }
  chmodSync(node, 0o555);
  chmodSync(npmCli, 0o555);
  chmodSync(
    path.join(npmRoot, "lib", "cli.js"),
    0o444,
  );
  chmodSync(
    path.join(npmRoot, "package.json"),
    0o444,
  );
  chmodSync(dynamicLibrary, 0o555);
  return Object.freeze({
    root,
    node,
    npmRoot,
    npmCli,
    dynamicLibrary,
  });
}

function materializeFakeInstallV2(
  projectRoot: string,
  mode: InstallModeV2,
): void {
  const artifacts = sourceArtifactsV2();
  const nodeModules = path.join(projectRoot, "node_modules");
  const typescript =
    path.join(nodeModules, "typescript");
  const helper =
    path.join(nodeModules, "compiler-helper");
  mkdirSync(path.join(typescript, "bin"), {
    recursive: true,
  });
  writeFileSync(
    path.join(typescript, "package.json"),
    `${JSON.stringify({
      name: "typescript",
      version: "5.9.3",
    })}\n`,
    { mode: 0o644 },
  );
  writeFileSync(
    path.join(typescript, "bin", "tsc"),
    [
      "#!/usr/bin/env node",
      "const fs = require('node:fs');",
      "const path = require('node:path');",
      "const index = process.argv.indexOf('--outDir');",
      "if (index < 0 || !process.argv[index + 1]) process.exit(2);",
      "const root = process.argv[index + 1];",
      "fs.mkdirSync(path.join(root, 'cli'), { recursive: true });",
      "fs.writeFileSync(path.join(root, 'cli', 'cli.js'), '#!/usr/bin/env node\\nexport {};\\n');",
      "",
    ].join("\n"),
    { mode: 0o755 },
  );
  writeFileSync(
    path.join(typescript, "bin", "tsserver"),
    "#!/usr/bin/env node\n",
    { mode: 0o755 },
  );
  if (mode !== "missing_required") {
    mkdirSync(helper);
    writeFileSync(
      path.join(helper, "package.json"),
      `${JSON.stringify({
        name: "compiler-helper",
        version: "1.0.0",
      })}\n`,
      { mode: 0o644 },
    );
    writeFileSync(
      path.join(helper, "index.js"),
      "export {};\n",
      { mode: 0o644 },
    );
  }
  const bin = path.join(nodeModules, ".bin");
  mkdirSync(bin);
  symlinkSync(
    mode === "wrong_bin_target"
      ? "../typescript/bin/tsserver"
      : "../typescript/bin/tsc",
    path.join(bin, "tsc"),
  );
  symlinkSync(
    "../typescript/bin/tsserver",
    path.join(bin, "tsserver"),
  );
  const hiddenPackages: Record<string, unknown> = {
    "node_modules/typescript":
      artifacts.lock.packages[
        "node_modules/typescript"
      ],
  };
  if (mode !== "missing_required") {
    hiddenPackages["node_modules/compiler-helper"] =
      artifacts.lock.packages[
        "node_modules/compiler-helper"
      ];
  }
  if (mode === "unexpected_package") {
    const rogueEntry = lockEntry({
      name: "rogue",
      version: "1.0.0",
      dev: true,
    });
    hiddenPackages["node_modules/rogue"] = rogueEntry;
    const rogue = path.join(nodeModules, "rogue");
    mkdirSync(rogue);
    writeFileSync(
      path.join(rogue, "package.json"),
      `${JSON.stringify({
        name: "rogue",
        version: "1.0.0",
      })}\n`,
    );
  }
  writeFileSync(
    path.join(nodeModules, ".package-lock.json"),
    `${JSON.stringify({
      name: "setfarm",
      version: "9.9.9",
      lockfileVersion: 3,
      requires: true,
      packages: hiddenPackages,
    })}\n`,
    { mode: 0o644 },
  );
}

function executeBuildInvocationForTestV2(
  invocation: HostNodeToolchainProbeInvocationV2,
): HostNodeToolchainProbeResultV2 {
  const result = spawnSync(
    process.execPath,
    invocation.argv,
    {
      cwd: invocation.cwd,
      env: invocation.env,
      encoding: "utf8",
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
      timeout: invocation.timeoutMs,
      maxBuffer: Math.max(
        invocation.maxStdoutBytes,
        invocation.maxStderrBytes,
      ),
    },
  );
  if (result.error) {
    return Object.freeze({
      status: "spawn_failed" as const,
      stdout: result.stdout ?? "",
      stderr: result.stderr ?? "",
    });
  }
  return Object.freeze({
    status: "exited" as const,
    exitCode: result.status,
    signal: result.signal,
    stdout: result.stdout,
    stderr: result.stderr,
  });
}

async function createPlatformHostV2(
  fixture: HostFixtureV2,
  mode: InstallModeV2,
  installGate?: Readonly<{
    entered: () => void;
    wait: Promise<void>;
  }>,
  buildHook?: (
    invocation: HostNodeToolchainProbeInvocationV2,
    occurrence: number,
  ) =>
    | HostNodeToolchainProbeResultV2
    | undefined
    | Promise<
      HostNodeToolchainProbeResultV2 | undefined
    >,
  installHook?: (
    invocation: HostNodeToolchainProbeInvocationV2,
  ) => void | Promise<void>,
) {
  let buildOccurrence = 0;
  const probeAdapter = async (
    invocation: HostNodeToolchainProbeInvocationV2,
  ): Promise<HostNodeToolchainProbeResultV2> => {
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
    if (
      invocation.probeRef === "HOST_NPM_VERSION_PROBE_V2"
    ) {
      return exited("10.9.8\n");
    }
    if (
      invocation.probeRef
        === "HOST_NPM_PLATFORM_RELEASE_BUILD_INSTALL_V2"
    ) {
      installGate?.entered();
      if (installGate) await installGate.wait;
      if (mode === "install_failure") {
        return Object.freeze({
          status: "exited",
          exitCode: 1,
          signal: null,
          stdout: "",
          stderr: "authenticated npm ci failed\n",
        });
      }
      materializeFakeInstallV2(invocation.cwd, mode);
      await installHook?.(invocation);
      return exited("installed exact build graph\n");
    }
    if (
      invocation.probeRef
        === "HOST_NODE_PLATFORM_RELEASE_BUILD_V2"
    ) {
      buildOccurrence += 1;
      const overridden = await buildHook?.(
        invocation,
        buildOccurrence,
      );
      if (overridden) return overridden;
      return executeBuildInvocationForTestV2(
        invocation,
      );
    }
    return exited();
  };
  const bootstrap =
    await createHostNodeToolchainAuthorityV2ForTest({
      profileId: "PROFILE_NODE_CLI_STATELESS_EXACT_V2",
      fixture: {
        candidateRoot: fixture.root,
        host: {
          platform: "darwin",
          architecture: "arm64",
          macosProductVersion: "26.5.2",
          macosBuildVersion: "25F84",
          darwinKernelRelease: "25.5.0",
        },
        nonSystemDynamicLibraryPaths: [
          fixture.dynamicLibrary,
        ],
      },
      probeAdapter,
    });
  return createPlatformReleaseHostNodeToolchainAuthorityV2ForTest({
    hostToolchain: bootstrap,
  });
}

function admittedSourceV2(
  fixture: RepositoryFixtureV2,
): AdmittedPlatformReleaseSourceStageV2 {
  return admitPlatformReleaseSourceV2ForTest({
    repositoryRoot: fixture.repository,
  });
}

function makeWritable(root: string): void {
  if (!existsSync(root)) return;
  const stat = lstatSync(root);
  if (stat.isSymbolicLink()) return;
  if (stat.isDirectory()) {
    chmodSync(root, 0o700);
    for (const name of readdirSync(root)) {
      makeWritable(path.join(root, name));
    }
  } else {
    chmodSync(root, 0o600);
  }
}

afterEach(() => {
  for (const root of roots.splice(0)) {
    makeWritable(root);
    rmSync(root, { recursive: true, force: true });
  }
});

describe("PlatformReleaseBuildToolchainCapsuleV2", () => {
  it("materializes one pathless exact dev closure and freshly revalidates it", async () => {
    const repository = createRepositoryFixtureV2();
    const hostFixture = createHostFixtureV2();
    const source = admittedSourceV2(repository);
    try {
      const host = await createPlatformHostV2(
        hostFixture,
        "valid",
      );
      const capsule =
        await materializePlatformReleaseBuildToolchainCapsuleV2ForTest({
          sourceStage: source,
          hostToolchain: host,
        });
      const receipt =
        inspectPlatformReleaseBuildToolchainReceiptV2(
          capsule,
        );

      assert.equal(
        PlatformReleaseBuildToolchainReceiptV2Schema
          .parse(receipt).receiptHash,
        receipt.receiptHash,
      );
      assert.equal(receipt.tree.packageCount, 2);
      assert.equal(receipt.compiler.version, "5.9.3");
      assert.equal(
        receipt.compiler.entryModuleLocator,
        "node_modules/typescript/bin/tsc",
      );
      assert.equal(
        receipt.installRecipe.configHash.length,
        64,
      );
      assert.equal(Object.isFrozen(receipt), true);
      assert.doesNotMatch(
        JSON.stringify(receipt),
        /setfarm-platform-build-toolchain-|setfarm-platform-release-source-|\/private\/|\/Users\//,
      );
      assert.deepEqual(
        await revalidatePlatformReleaseBuildToolchainCapsuleV2(
          capsule,
        ),
        receipt,
      );
      await withPlatformReleaseBuildToolchainCapsuleForTestV2(
        capsule,
        (nodeModulesRoot) => {
          assert.deepEqual(
            readdirSync(nodeModulesRoot).sort(),
            ["compiler-helper", "typescript"],
          );
          assert.equal(
            existsSync(path.join(
              nodeModulesRoot,
              ".package-lock.json",
            )),
            false,
          );
          assert.equal(
            existsSync(path.join(nodeModulesRoot, ".bin")),
            false,
          );
          assert.equal(
            lstatSync(nodeModulesRoot).mode & 0o7777,
            0o555,
          );
        },
      );
      assert.throws(
        () => new PlatformReleaseBuildToolchainCapsuleV2(
          {},
          {} as never,
        ),
        {
          code:
            "PLATFORM_RELEASE_BUILD_TOOLCHAIN_CAPSULE_V2_HANDLE_UNAUTHENTICATED",
        },
      );
      await assert.rejects(
        materializePlatformReleaseBuildToolchainCapsuleV2ForTest({
          sourceStage: source,
          hostToolchain: host,
        }),
        {
          code:
            "PLATFORM_RELEASE_BUILD_TOOLCHAIN_CAPSULE_V2_ALREADY_MATERIALIZED",
        },
      );
    } finally {
      disposePlatformReleaseSourceStageV2(source);
    }
  });

  it("owns two independent canonical compiled outputs and disposes every root", async () => {
    const repository = createRepositoryFixtureV2();
    const hostFixture = createHostFixtureV2();
    const source = admittedSourceV2(repository);
    let sourceRoot = "";
    withPlatformReleaseSourceStageForTestV2(
      source,
      (root) => {
        sourceRoot = root;
      },
    );
    let disposed = false;
    let firstOutputRoot = "";
    let secondOutputRoot = "";
    try {
      const buildOccurrences: number[] = [];
      const host = await createPlatformHostV2(
        hostFixture,
        "valid",
        undefined,
        (_invocation, occurrence) => {
          buildOccurrences.push(occurrence);
          return undefined;
        },
      );
      const capsule =
        await materializePlatformReleaseBuildToolchainCapsuleV2ForTest({
          sourceStage: source,
          hostToolchain: host,
        });
      let accessorCalled = false;
      await assert.rejects(
        materializePlatformReleaseCompiledOutputPairV2ForTest(
          new Proxy({
            sourceStage: source,
            buildToolchain: capsule,
          }, {
            get() {
              accessorCalled = true;
              return undefined;
            },
          }),
        ),
        {
          code:
            "PLATFORM_RELEASE_COMPILED_OUTPUT_PAIR_V2_INPUT_INVALID",
        },
      );
      await assert.rejects(
        materializePlatformReleaseCompiledOutputPairV2ForTest({
          sourceStage: source,
          get buildToolchain() {
            accessorCalled = true;
            return capsule;
          },
        }),
        {
          code:
            "PLATFORM_RELEASE_COMPILED_OUTPUT_PAIR_V2_INPUT_INVALID",
        },
      );
      assert.equal(accessorCalled, false);
      await assert.rejects(
        materializePlatformReleaseCompiledOutputPairV2({
          sourceStage: source,
          buildToolchain: capsule,
        }),
        {
          code:
            "PLATFORM_RELEASE_COMPILED_OUTPUT_PAIR_V2_SCOPE_MISMATCH",
        },
      );
      const pair =
        await materializePlatformReleaseCompiledOutputPairV2ForTest({
          sourceStage: source,
          buildToolchain: capsule,
        });
      const inspection =
        inspectPlatformReleaseCompiledOutputPairV2(pair);
      assert.deepEqual(
        PlatformReleaseCompiledOutputPairInspectionV2Schema
          .parse(inspection),
        inspection,
      );
      assert.equal(Object.isFrozen(inspection), true);
      assert.equal(
        Object.isFrozen(inspection.stableOutput),
        true,
      );
      assert.equal(
        Object.isFrozen(inspection.occurrences),
        true,
      );
      assert.equal(
        pair.stableOutputBindingHash,
        inspection.stableOutput.bindingHash,
      );
      assert.notEqual(
        inspection.occurrences[0].hostBuildEvidenceHash,
        inspection.occurrences[1].hostBuildEvidenceHash,
      );
      assert.equal(
        inspection.occurrences[0]
          .predependencyOutputBindingHash,
        inspection.stableOutput.bindingHash,
      );
      assert.equal(
        inspection.occurrences[1]
          .predependencyOutputBindingHash,
        inspection.stableOutput.bindingHash,
      );
      assert.equal(
        inspection.occurrences[0]
          .stableHostProjectionHash,
        inspection.occurrences[1]
          .stableHostProjectionHash,
      );
      assert.doesNotMatch(
        JSON.stringify(inspection),
        /setfarm-platform-build-toolchain-|setfarm-platform-release-source-|setfarm-platform-release-output-|\/private\/|\/Users\//,
      );
      const tampered = structuredClone(inspection);
      tampered.occurrences[0]
        .predependencyOutputBindingHash = "0".repeat(64);
      tampered.inspectionHash =
        hashPlatformReleaseCompiledOutputPairInspectionV2(
          tampered,
        );
      assert.throws(
        () =>
          PlatformReleaseCompiledOutputPairInspectionV2Schema
            .parse(tampered),
      );
      assert.notEqual(
        inspection.occurrences[0]
          .outputStagePhysicalIdentityHash,
        inspection.occurrences[1]
          .outputStagePhysicalIdentityHash,
      );
      assert.deepEqual(buildOccurrences, [1, 2]);
      assert.throws(
        () => new PlatformReleaseCompiledOutputPairV2(
          {},
          {} as never,
        ),
        {
          code:
            "PLATFORM_RELEASE_COMPILED_OUTPUT_PAIR_V2_HANDLE_UNAUTHENTICATED",
        },
      );
      await assert.rejects(
        revalidatePlatformReleaseCompiledOutputPairV2(
          Object.create(
            PlatformReleaseCompiledOutputPairV2.prototype,
          ) as PlatformReleaseCompiledOutputPairV2,
        ),
        {
          code:
            "PLATFORM_RELEASE_COMPILED_OUTPUT_PAIR_V2_HANDLE_UNAUTHENTICATED",
        },
      );
      await withPlatformReleaseCompiledOutputPairForTestV2(
        pair,
        (roots) => {
          firstOutputRoot = roots.firstOutputRoot;
          secondOutputRoot = roots.secondOutputRoot;
          assert.notEqual(
            firstOutputRoot,
            secondOutputRoot,
          );
          for (const root of [
            firstOutputRoot,
            secondOutputRoot,
          ]) {
            assert.deepEqual(
              readdirSync(root),
              ["payload"],
            );
            assert.deepEqual(
              readdirSync(path.join(root, "payload")).sort(),
              ["dist", "package.json"],
            );
          }
          const firstStat = lstatSync(firstOutputRoot);
          const secondStat = lstatSync(secondOutputRoot);
          assert.equal(
            inspection.occurrences[0]
              .outputStagePhysicalIdentityHash,
            hashHostNodePlatformReleaseOutputStageIdentityV2({
              device: firstStat.dev,
              inode: firstStat.ino,
              mode: firstStat.mode,
              ownerUid: firstStat.uid,
              ownerGid: firstStat.gid,
            }),
          );
          assert.equal(
            inspection.occurrences[1]
              .outputStagePhysicalIdentityHash,
            hashHostNodePlatformReleaseOutputStageIdentityV2({
              device: secondStat.dev,
              inode: secondStat.ino,
              mode: secondStat.mode,
              ownerUid: secondStat.uid,
              ownerGid: secondStat.gid,
            }),
          );
        },
      );
      assert.deepEqual(
        await revalidatePlatformReleaseCompiledOutputPairV2(
          pair,
        ),
        inspection,
      );
      await assert.rejects(
        materializePlatformReleaseCompiledOutputPairV2ForTest({
          sourceStage: source,
          buildToolchain: capsule,
        }),
        {
          code:
            "PLATFORM_RELEASE_COMPILED_OUTPUT_PAIR_V2_ALREADY_MATERIALIZED",
        },
      );
      disposePlatformReleaseSourceStageV2(source);
      disposed = true;
      assert.equal(
        existsSync(path.dirname(sourceRoot)),
        false,
      );
      assert.equal(
        existsSync(path.dirname(firstOutputRoot)),
        false,
      );
      assert.equal(
        existsSync(path.dirname(secondOutputRoot)),
        false,
      );
      await assert.rejects(
        revalidatePlatformReleaseCompiledOutputPairV2(pair),
        {
          code:
            "PLATFORM_RELEASE_COMPILED_OUTPUT_PAIR_V2_SOURCE_DRIFT",
        },
      );
    } finally {
      if (!disposed) {
        try {
          disposePlatformReleaseSourceStageV2(source);
        } catch (error) {
          if (
            !(error instanceof PlatformReleaseSourceAdmissionErrorV2)
            || error.code
              !== "PLATFORM_RELEASE_SOURCE_V2_HANDLE_DISPOSED"
          ) throw error;
        }
      }
    }
  });

  it("claims one double-build transaction before its first asynchronous build", async () => {
    const repository = createRepositoryFixtureV2();
    const hostFixture = createHostFixtureV2();
    const source = admittedSourceV2(repository);
    let releaseBuild!: () => void;
    const buildWait = new Promise<void>((resolve) => {
      releaseBuild = resolve;
    });
    let markBuildEntered!: () => void;
    const buildEntered = new Promise<void>((resolve) => {
      markBuildEntered = resolve;
    });
    const buildOccurrences: number[] = [];
    try {
      const host = await createPlatformHostV2(
        hostFixture,
        "valid",
        undefined,
        async (_invocation, occurrence) => {
          buildOccurrences.push(occurrence);
          if (occurrence === 1) {
            markBuildEntered();
            await buildWait;
          }
          return undefined;
        },
      );
      const capsule =
        await materializePlatformReleaseBuildToolchainCapsuleV2ForTest({
          sourceStage: source,
          hostToolchain: host,
        });
      const first =
        materializePlatformReleaseCompiledOutputPairV2ForTest({
          sourceStage: source,
          buildToolchain: capsule,
        });
      await buildEntered;
      await assert.rejects(
        materializePlatformReleaseCompiledOutputPairV2ForTest({
          sourceStage: source,
          buildToolchain: capsule,
        }),
        {
          code:
            "PLATFORM_RELEASE_COMPILED_OUTPUT_PAIR_V2_ALREADY_MATERIALIZED",
        },
      );
      assert.throws(
        () => disposePlatformReleaseSourceStageV2(source),
        {
          code:
            "PLATFORM_RELEASE_SOURCE_V2_MATERIALIZATION_BUSY",
        },
      );
      releaseBuild();
      const pair = await first;
      assert.deepEqual(buildOccurrences, [1, 2]);
      await revalidatePlatformReleaseCompiledOutputPairV2(
        pair,
      );
    } finally {
      releaseBuild?.();
      try {
        disposePlatformReleaseSourceStageV2(source);
      } catch (error) {
        if (
          !(error instanceof PlatformReleaseSourceAdmissionErrorV2)
          || error.code
            !== "PLATFORM_RELEASE_SOURCE_V2_HANDLE_DISPOSED"
        ) throw error;
      }
    }
  });

  for (
    const checkpoint of [
      "after_first_parent_created",
      "after_first_output_created",
    ] as const
  ) {
    it(`quarantines an unanchored allocation at ${checkpoint}`, async () => {
      const repository = createRepositoryFixtureV2();
      const hostFixture = createHostFixtureV2();
      const source = admittedSourceV2(repository);
      let sourceRoot = "";
      let observedPath = "";
      withPlatformReleaseSourceStageForTestV2(
        source,
        (root) => {
          sourceRoot = root;
        },
      );
      const host = await createPlatformHostV2(
        hostFixture,
        "valid",
      );
      const capsule =
        await materializePlatformReleaseBuildToolchainCapsuleV2ForTest({
          sourceStage: source,
          hostToolchain: host,
        });
      let observedFailure: unknown;
      await assert.rejects(
        materializePlatformReleaseCompiledOutputPairWithAllocationFaultForTestV2(
          {
            sourceStage: source,
            buildToolchain: capsule,
          },
          {
            checkpoint,
            observePath: (absolutePath) => {
              observedPath = absolutePath;
              writeFileSync(
                path.join(
                  absolutePath,
                  "quarantine-sentinel",
                ),
                "must survive\n",
              );
            },
          },
        ),
        (error: unknown) => {
          observedFailure = error;
          return error instanceof Error
            && "code" in error
            && error.code
              === "PLATFORM_RELEASE_COMPILED_OUTPUT_PAIR_V2_CLEANUP_FAILED";
        },
      );
      const quarantinedParent =
        checkpoint === "after_first_parent_created"
          ? observedPath
          : path.dirname(observedPath);
      roots.push(quarantinedParent);
      assert.equal(existsSync(quarantinedParent), true);
      assert.equal(
        readFileSync(
          path.join(
            observedPath,
            "quarantine-sentinel",
          ),
          "utf8",
        ),
        "must survive\n",
      );
      assert.equal(
        existsSync(path.dirname(sourceRoot)),
        false,
      );
      assert.ok(
        observedFailure instanceof Error
        && "cause" in observedFailure
        && observedFailure.cause
          instanceof AggregateError,
      );
      assert.equal(
        observedFailure.cause.errors[0]?.code,
        "PLATFORM_RELEASE_COMPILED_OUTPUT_PAIR_V2_BUILD_FAILED",
      );
      assert.equal(
        observedFailure.cause.errors[1]?.code,
        "PLATFORM_RELEASE_SOURCE_V2_CLEANUP_FAILED",
      );
    });
  }

  it("rejects equal-content source and toolchain handles from different physical contexts", async () => {
    const repository = createRepositoryFixtureV2();
    const hostFixture = createHostFixtureV2();
    const firstSource = admittedSourceV2(repository);
    const secondSource = admittedSourceV2(repository);
    try {
      const host = await createPlatformHostV2(
        hostFixture,
        "valid",
      );
      const firstCapsule =
        await materializePlatformReleaseBuildToolchainCapsuleV2ForTest({
          sourceStage: firstSource,
          hostToolchain: host,
        });
      const secondCapsule =
        await materializePlatformReleaseBuildToolchainCapsuleV2ForTest({
          sourceStage: secondSource,
          hostToolchain: host,
        });
      await assert.rejects(
        materializePlatformReleaseCompiledOutputPairV2ForTest({
          sourceStage: firstSource,
          buildToolchain: secondCapsule,
        }),
        {
          code:
            "PLATFORM_RELEASE_COMPILED_OUTPUT_PAIR_V2_SCOPE_MISMATCH",
        },
      );
      await assert.rejects(
        materializePlatformReleaseCompiledOutputPairV2ForTest({
          sourceStage: secondSource,
          buildToolchain: firstCapsule,
        }),
        {
          code:
            "PLATFORM_RELEASE_COMPILED_OUTPUT_PAIR_V2_SCOPE_MISMATCH",
        },
      );
      await revalidatePlatformReleaseBuildToolchainCapsuleV2(
        firstCapsule,
      );
      await revalidatePlatformReleaseBuildToolchainCapsuleV2(
        secondCapsule,
      );
    } finally {
      disposePlatformReleaseSourceStageV2(firstSource);
      disposePlatformReleaseSourceStageV2(secondSource);
    }
  });

  it("destroys source and both output parents when the second build fails", async () => {
    const repository = createRepositoryFixtureV2();
    const hostFixture = createHostFixtureV2();
    const source = admittedSourceV2(repository);
    let sourceRoot = "";
    withPlatformReleaseSourceStageForTestV2(
      source,
      (root) => {
        sourceRoot = root;
      },
    );
    const outputRoots: string[] = [];
    const host = await createPlatformHostV2(
      hostFixture,
      "valid",
      undefined,
      (invocation, occurrence) => {
        const outputIndex =
          invocation.argv.indexOf("--output-root");
        assert.ok(outputIndex >= 0);
        outputRoots.push(
          invocation.argv[outputIndex + 1]!,
        );
        return occurrence === 2
          ? Object.freeze({
            status: "exited" as const,
            exitCode: 1,
            signal: null,
            stdout: "",
            stderr: "second build failed\n",
          })
          : undefined;
      },
    );
    const capsule =
      await materializePlatformReleaseBuildToolchainCapsuleV2ForTest({
        sourceStage: source,
        hostToolchain: host,
      });
    await assert.rejects(
      materializePlatformReleaseCompiledOutputPairV2ForTest({
        sourceStage: source,
        buildToolchain: capsule,
      }),
      {
        code:
          "PLATFORM_RELEASE_COMPILED_OUTPUT_PAIR_V2_BUILD_FAILED",
      },
    );
    assert.equal(outputRoots.length, 2);
    assert.equal(
      existsSync(path.dirname(sourceRoot)),
      false,
    );
    for (const root of outputRoots) {
      assert.equal(
        existsSync(path.dirname(root)),
        false,
      );
    }
    await assert.rejects(
      materializePlatformReleaseCompiledOutputPairV2ForTest({
        sourceStage: source,
        buildToolchain: capsule,
      }),
      {
        code:
          "PLATFORM_RELEASE_COMPILED_OUTPUT_PAIR_V2_INPUT_INVALID",
      },
    );
  });

  it("rejects a canonical command result that does not join source authority", async () => {
    const repository = createRepositoryFixtureV2();
    const hostFixture = createHostFixtureV2();
    const source = admittedSourceV2(repository);
    let sourceRoot = "";
    withPlatformReleaseSourceStageForTestV2(
      source,
      (root) => {
        sourceRoot = root;
      },
    );
    const buildOccurrences: number[] = [];
    const host = await createPlatformHostV2(
      hostFixture,
      "valid",
      undefined,
      (invocation, occurrence) => {
        buildOccurrences.push(occurrence);
        const observed =
          executeBuildInvocationForTestV2(invocation);
        assert.equal(observed.status, "exited");
        if (observed.status !== "exited") {
          return observed;
        }
        assert.equal(observed.exitCode, 0);
        const result = JSON.parse(observed.stdout) as
          Record<string, unknown>;
        result.sourceFileCount =
          Number(result.sourceFileCount) + 1;
        return Object.freeze({
          ...observed,
          stdout:
            `${canonicalJsonStringify(result)}\n`,
        });
      },
    );
    const capsule =
      await materializePlatformReleaseBuildToolchainCapsuleV2ForTest({
        sourceStage: source,
        hostToolchain: host,
      });
    await assert.rejects(
      materializePlatformReleaseCompiledOutputPairV2ForTest({
        sourceStage: source,
        buildToolchain: capsule,
      }),
      {
        code:
          "PLATFORM_RELEASE_COMPILED_OUTPUT_PAIR_V2_OUTPUT_INVALID",
      },
    );
    assert.deepEqual(buildOccurrences, [1]);
    assert.equal(
      existsSync(path.dirname(sourceRoot)),
      false,
    );
  });

  it("rejects equal command results when compiled dist bytes differ", async () => {
    const repository = createRepositoryFixtureV2();
    const hostFixture = createHostFixtureV2();
    const source = admittedSourceV2(repository);
    let sourceRoot = "";
    withPlatformReleaseSourceStageForTestV2(
      source,
      (root) => {
        sourceRoot = root;
      },
    );
    const host = await createPlatformHostV2(
      hostFixture,
      "valid",
      undefined,
      (invocation, occurrence) => {
        const observed =
          executeBuildInvocationForTestV2(invocation);
        if (
          occurrence !== 2
          || observed.status !== "exited"
          || observed.exitCode !== 0
        ) return observed;
        const outputIndex =
          invocation.argv.indexOf("--output-root");
        const outputRoot =
          invocation.argv[outputIndex + 1]!;
        const distRoot = path.join(
          outputRoot,
          "payload",
          "dist",
        );
        const buildInfo = path.join(
          distRoot,
          "BUILD_INFO.json",
        );
        const before = readFileSync(buildInfo, "utf8");
        const after = before.replace(
          "\"dirty\":false",
          "\"dirty\":true ",
        );
        assert.equal(after.length, before.length);
        assert.notEqual(after, before);
        chmodSync(distRoot, 0o700);
        chmodSync(buildInfo, 0o600);
        writeFileSync(buildInfo, after);
        chmodSync(buildInfo, 0o444);
        chmodSync(distRoot, 0o555);
        return observed;
      },
    );
    const capsule =
      await materializePlatformReleaseBuildToolchainCapsuleV2ForTest({
        sourceStage: source,
        hostToolchain: host,
      });
    await assert.rejects(
      materializePlatformReleaseCompiledOutputPairV2ForTest({
        sourceStage: source,
        buildToolchain: capsule,
      }),
      {
        code:
          "PLATFORM_RELEASE_COMPILED_OUTPUT_PAIR_V2_EQUALITY_FAILED",
      },
    );
    assert.equal(
      existsSync(path.dirname(sourceRoot)),
      false,
    );
  });

  it("rejects first-output mutation hidden by matching second output", async () => {
    const repository = createRepositoryFixtureV2();
    const hostFixture = createHostFixtureV2();
    const source = admittedSourceV2(repository);
    let sourceRoot = "";
    let firstOutputRoot = "";
    withPlatformReleaseSourceStageForTestV2(
      source,
      (root) => {
        sourceRoot = root;
      },
    );
    const host = await createPlatformHostV2(
      hostFixture,
      "valid",
      undefined,
      (invocation, occurrence) => {
        const observed =
          executeBuildInvocationForTestV2(invocation);
        if (
          observed.status !== "exited"
          || observed.exitCode !== 0
        ) return observed;
        const outputIndex =
          invocation.argv.indexOf("--output-root");
        const outputRoot =
          invocation.argv[outputIndex + 1]!;
        if (occurrence === 1) {
          firstOutputRoot = outputRoot;
          return observed;
        }
        const mutateBuildInfo = (root: string) => {
          const distRoot = path.join(
            root,
            "payload",
            "dist",
          );
          const buildInfo = path.join(
            distRoot,
            "BUILD_INFO.json",
          );
          const before = readFileSync(buildInfo, "utf8");
          const after = before.replace(
            "\"dirty\":false",
            "\"dirty\":true ",
          );
          assert.equal(after.length, before.length);
          assert.notEqual(after, before);
          chmodSync(distRoot, 0o700);
          chmodSync(buildInfo, 0o600);
          writeFileSync(buildInfo, after);
          chmodSync(buildInfo, 0o444);
          chmodSync(distRoot, 0o555);
        };
        mutateBuildInfo(firstOutputRoot);
        mutateBuildInfo(outputRoot);
        return observed;
      },
    );
    const capsule =
      await materializePlatformReleaseBuildToolchainCapsuleV2ForTest({
        sourceStage: source,
        hostToolchain: host,
      });
    await assert.rejects(
      materializePlatformReleaseCompiledOutputPairV2ForTest({
        sourceStage: source,
        buildToolchain: capsule,
      }),
      {
        code:
          "PLATFORM_RELEASE_COMPILED_OUTPUT_PAIR_V2_OUTPUT_INVALID",
      },
    );
    assert.equal(
      existsSync(path.dirname(sourceRoot)),
      false,
    );
    assert.equal(
      existsSync(path.dirname(firstOutputRoot)),
      false,
    );
  });

  it("terminally destroys a compiled pair after callback output drift", async () => {
    const repository = createRepositoryFixtureV2();
    const hostFixture = createHostFixtureV2();
    const source = admittedSourceV2(repository);
    let sourceRoot = "";
    withPlatformReleaseSourceStageForTestV2(
      source,
      (root) => {
        sourceRoot = root;
      },
    );
    const externalRoot = realpathSync(mkdtempSync(path.join(
      tmpdir(),
      "setfarm-compiled-output-cleanup-sentinel-v2-",
    )));
    roots.push(externalRoot);
    const externalFile = path.join(
      externalRoot,
      "external.txt",
    );
    writeFileSync(externalFile, "external\n", {
      mode: 0o444,
    });
    chmodSync(externalFile, 0o444);
    const externalDirectory = path.join(
      externalRoot,
      "external-directory",
    );
    mkdirSync(externalDirectory);
    writeFileSync(
      path.join(externalDirectory, "sentinel"),
      "survives\n",
    );
    const host = await createPlatformHostV2(
      hostFixture,
      "valid",
    );
    const capsule =
      await materializePlatformReleaseBuildToolchainCapsuleV2ForTest({
        sourceStage: source,
        hostToolchain: host,
      });
    const pair =
      await materializePlatformReleaseCompiledOutputPairV2ForTest({
        sourceStage: source,
        buildToolchain: capsule,
      });
    let firstOutputRoot = "";
    let secondOutputRoot = "";
    await assert.rejects(
      withPlatformReleaseCompiledOutputPairForTestV2(
        pair,
        (roots) => {
          firstOutputRoot = roots.firstOutputRoot;
          secondOutputRoot = roots.secondOutputRoot;
          writeFileSync(
            path.join(
              firstOutputRoot,
              "payload",
              "rogue",
            ),
            "drift\n",
          );
          linkSync(
            externalFile,
            path.join(
              firstOutputRoot,
              "payload",
              "external-hardlink",
            ),
          );
          symlinkSync(
            externalDirectory,
            path.join(
              firstOutputRoot,
              "payload",
              "external-symlink",
            ),
          );
        },
      ),
      {
        code:
          "PLATFORM_RELEASE_COMPILED_OUTPUT_PAIR_V2_OUTPUT_INVALID",
      },
    );
    assert.equal(
      existsSync(path.dirname(sourceRoot)),
      false,
    );
    assert.equal(
      readFileSync(externalFile, "utf8"),
      "external\n",
    );
    assert.equal(
      lstatSync(externalFile).mode & 0o7777,
      0o444,
    );
    assert.equal(lstatSync(externalFile).nlink, 1);
    assert.equal(
      readFileSync(
        path.join(externalDirectory, "sentinel"),
        "utf8",
      ),
      "survives\n",
    );
    assert.equal(
      existsSync(path.dirname(firstOutputRoot)),
      false,
    );
    assert.equal(
      existsSync(path.dirname(secondOutputRoot)),
      false,
    );
    await assert.rejects(
      revalidatePlatformReleaseCompiledOutputPairV2(
        pair,
      ),
      {
        code:
          "PLATFORM_RELEASE_COMPILED_OUTPUT_PAIR_V2_SOURCE_DRIFT",
      },
    );
  });

  it("refuses a replaced output parent while cleaning every other owned root", async () => {
    const repository = createRepositoryFixtureV2();
    const hostFixture = createHostFixtureV2();
    const source = admittedSourceV2(repository);
    let sourceRoot = "";
    withPlatformReleaseSourceStageForTestV2(
      source,
      (root) => {
        sourceRoot = root;
      },
    );
    const siblingSentinel = realpathSync(mkdtempSync(
      path.join(
        tmpdir(),
        "setfarm-compiled-output-sibling-v2-",
      ),
    ));
    roots.push(siblingSentinel);
    writeFileSync(
      path.join(siblingSentinel, "sentinel"),
      "outside\n",
    );
    const host = await createPlatformHostV2(
      hostFixture,
      "valid",
    );
    const capsule =
      await materializePlatformReleaseBuildToolchainCapsuleV2ForTest({
        sourceStage: source,
        hostToolchain: host,
      });
    const pair =
      await materializePlatformReleaseCompiledOutputPairV2ForTest({
        sourceStage: source,
        buildToolchain: capsule,
      });
    let replacedParent = "";
    let displacedParent = "";
    let secondParent = "";
    let observedCleanupFailure: unknown;
    await assert.rejects(
      withPlatformReleaseCompiledOutputPairForTestV2(
        pair,
        (output) => {
          replacedParent =
            path.dirname(output.firstOutputRoot);
          displacedParent =
            `${replacedParent}-displaced`;
          secondParent =
            path.dirname(output.secondOutputRoot);
          renameSync(
            replacedParent,
            displacedParent,
          );
          mkdirSync(replacedParent, { mode: 0o700 });
          writeFileSync(
            path.join(replacedParent, "replacement"),
            "must survive\n",
          );
        },
      ),
      (error: unknown) => {
        observedCleanupFailure = error;
        return error instanceof Error
          && "code" in error
          && error.code
            === "PLATFORM_RELEASE_COMPILED_OUTPUT_PAIR_V2_CLEANUP_FAILED";
      },
    );
    assert.ok(
      observedCleanupFailure instanceof Error
      && "cause" in observedCleanupFailure
      && observedCleanupFailure.cause
        instanceof AggregateError,
    );
    const cleanupCauses =
      observedCleanupFailure.cause.errors;
    assert.equal(cleanupCauses.length, 2);
    assert.equal(
      cleanupCauses[0]?.code,
      "PLATFORM_RELEASE_COMPILED_OUTPUT_PAIR_V2_OUTPUT_INVALID",
    );
    assert.equal(
      cleanupCauses[1]?.code,
      "PLATFORM_RELEASE_SOURCE_V2_CLEANUP_FAILED",
    );
    roots.push(replacedParent, displacedParent);
    assert.equal(existsSync(replacedParent), true);
    assert.equal(existsSync(displacedParent), true);
    assert.equal(existsSync(secondParent), false);
    assert.equal(
      existsSync(path.dirname(sourceRoot)),
      false,
    );
    assert.equal(
      readFileSync(
        path.join(replacedParent, "replacement"),
        "utf8",
      ),
      "must survive\n",
    );
    assert.equal(
      readFileSync(
        path.join(siblingSentinel, "sentinel"),
        "utf8",
      ),
      "outside\n",
    );
    await assert.rejects(
      revalidatePlatformReleaseCompiledOutputPairV2(pair),
      {
        code:
          "PLATFORM_RELEASE_COMPILED_OUTPUT_PAIR_V2_SOURCE_DRIFT",
      },
    );
  });

  for (
    const mode of [
      "missing_required",
      "unexpected_package",
      "wrong_bin_target",
    ] as const
  ) {
    it(`rejects hostile npm output: ${mode}`, async () => {
      const repository = createRepositoryFixtureV2();
      const hostFixture = createHostFixtureV2();
      const source = admittedSourceV2(repository);
      let sourceRoot = "";
      withPlatformReleaseSourceStageForTestV2(
        source,
        (root) => {
          sourceRoot = root;
        },
      );
      try {
        const host = await createPlatformHostV2(
          hostFixture,
          mode,
        );
        await assert.rejects(
          materializePlatformReleaseBuildToolchainCapsuleV2ForTest({
            sourceStage: source,
            hostToolchain: host,
          }),
          {
            code:
              "PLATFORM_RELEASE_BUILD_TOOLCHAIN_CAPSULE_V2_TREE_INVALID",
          },
        );
        assert.equal(
          existsSync(path.dirname(sourceRoot)),
          false,
        );
        assert.throws(
          () => withPlatformReleaseSourceStageForTestV2(
            source,
            () => undefined,
          ),
          {
            code:
              "PLATFORM_RELEASE_SOURCE_V2_HANDLE_DISPOSED",
          },
        );
      } finally {
        try {
          disposePlatformReleaseSourceStageV2(source);
        } catch (error) {
          if (
            !(error instanceof PlatformReleaseSourceAdmissionErrorV2)
            || error.code
              !== "PLATFORM_RELEASE_SOURCE_V2_HANDLE_DISPOSED"
          ) throw error;
        }
      }
    });
  }

  it("cleans hostile npm hardlinks without mutating the external inode", async () => {
    const repository = createRepositoryFixtureV2();
    const hostFixture = createHostFixtureV2();
    const source = admittedSourceV2(repository);
    let sourceRoot = "";
    withPlatformReleaseSourceStageForTestV2(
      source,
      (root) => {
        sourceRoot = root;
      },
    );
    const externalRoot = realpathSync(mkdtempSync(path.join(
      tmpdir(),
      "setfarm-toolchain-cleanup-hardlink-v2-",
    )));
    roots.push(externalRoot);
    const externalFile =
      path.join(externalRoot, "external.txt");
    writeFileSync(externalFile, "external\n");
    chmodSync(externalFile, 0o444);
    const host = await createPlatformHostV2(
      hostFixture,
      "valid",
      undefined,
      undefined,
      (invocation) => {
        linkSync(
          externalFile,
          path.join(
            invocation.cwd,
            "node_modules",
            "typescript",
            "external-hardlink",
          ),
        );
      },
    );
    await assert.rejects(
      materializePlatformReleaseBuildToolchainCapsuleV2ForTest({
        sourceStage: source,
        hostToolchain: host,
      }),
      {
        code:
          "PLATFORM_RELEASE_BUILD_TOOLCHAIN_CAPSULE_V2_TREE_INVALID",
      },
    );
    assert.equal(
      existsSync(path.dirname(sourceRoot)),
      false,
    );
    assert.equal(
      readFileSync(externalFile, "utf8"),
      "external\n",
    );
    assert.equal(
      lstatSync(externalFile).mode & 0o7777,
      0o444,
    );
    assert.equal(lstatSync(externalFile).nlink, 1);
  });

  it("reports replaced scratch cleanup and terminally invalidates the source", async () => {
    const repository = createRepositoryFixtureV2();
    const hostFixture = createHostFixtureV2();
    const source = admittedSourceV2(repository);
    let sourceRoot = "";
    let replacedEnvironmentRoot = "";
    let displacedEnvironmentRoot = "";
    withPlatformReleaseSourceStageForTestV2(
      source,
      (root) => {
        sourceRoot = root;
      },
    );
    const host = await createPlatformHostV2(
      hostFixture,
      "valid",
      undefined,
      undefined,
      (invocation) => {
        const home = invocation.env.HOME;
        assert.equal(typeof home, "string");
        replacedEnvironmentRoot =
          path.dirname(home as string);
        displacedEnvironmentRoot =
          `${replacedEnvironmentRoot}-displaced`;
        renameSync(
          replacedEnvironmentRoot,
          displacedEnvironmentRoot,
        );
        mkdirSync(
          replacedEnvironmentRoot,
          { mode: 0o700 },
        );
        writeFileSync(
          path.join(
            replacedEnvironmentRoot,
            "replacement",
          ),
          "must survive\n",
        );
      },
    );
    await assert.rejects(
      materializePlatformReleaseBuildToolchainCapsuleV2ForTest({
        sourceStage: source,
        hostToolchain: host,
      }),
      {
        code:
          "PLATFORM_RELEASE_BUILD_TOOLCHAIN_CAPSULE_V2_CLEANUP_FAILED",
      },
    );
    roots.push(
      replacedEnvironmentRoot,
      displacedEnvironmentRoot,
    );
    assert.equal(
      existsSync(path.dirname(sourceRoot)),
      false,
    );
    assert.equal(
      readFileSync(
        path.join(
          replacedEnvironmentRoot,
          "replacement",
        ),
        "utf8",
      ),
      "must survive\n",
    );
    assert.equal(
      existsSync(displacedEnvironmentRoot),
      true,
    );
  });

  it("terminally disposes the source context after an acquired install fails", async () => {
    const repository = createRepositoryFixtureV2();
    const hostFixture = createHostFixtureV2();
    const source = admittedSourceV2(repository);
    let sourceRoot = "";
    withPlatformReleaseSourceStageForTestV2(
      source,
      (root) => {
        sourceRoot = root;
      },
    );
    const host = await createPlatformHostV2(
      hostFixture,
      "install_failure",
    );
    await assert.rejects(
      materializePlatformReleaseBuildToolchainCapsuleV2ForTest({
        sourceStage: source,
        hostToolchain: host,
      }),
      {
        code:
          "PLATFORM_RELEASE_BUILD_TOOLCHAIN_CAPSULE_V2_INSTALL_FAILED",
      },
    );
    assert.equal(
      existsSync(path.dirname(sourceRoot)),
      false,
    );
    assert.throws(
      () => withPlatformReleaseSourceStageForTestV2(
        source,
        () => undefined,
      ),
      {
        code:
          "PLATFORM_RELEASE_SOURCE_V2_HANDLE_DISPOSED",
      },
    );
    await assert.rejects(
      materializePlatformReleaseBuildToolchainCapsuleV2ForTest({
        sourceStage: source,
        hostToolchain: host,
      }),
      {
        code:
          "PLATFORM_RELEASE_BUILD_TOOLCHAIN_CAPSULE_V2_INPUT_INVALID",
      },
    );
  });

  it("owns concurrent and disposal lifecycle as one bounded transaction", async () => {
    const repository = createRepositoryFixtureV2();
    const hostFixture = createHostFixtureV2();
    const source = admittedSourceV2(repository);
    let releaseInstall!: () => void;
    const installWait = new Promise<void>((resolve) => {
      releaseInstall = resolve;
    });
    let markEntered!: () => void;
    const entered = new Promise<void>((resolve) => {
      markEntered = resolve;
    });
    try {
      const host = await createPlatformHostV2(
        hostFixture,
        "valid",
        {
          entered: markEntered,
          wait: installWait,
        },
      );
      const first =
        materializePlatformReleaseBuildToolchainCapsuleV2ForTest({
          sourceStage: source,
          hostToolchain: host,
        });
      await assert.rejects(
        materializePlatformReleaseBuildToolchainCapsuleV2ForTest({
          sourceStage: source,
          hostToolchain: host,
        }),
        {
          code:
            "PLATFORM_RELEASE_BUILD_TOOLCHAIN_CAPSULE_V2_ALREADY_MATERIALIZED",
        },
      );
      await entered;
      assert.throws(
        () => disposePlatformReleaseSourceStageV2(source),
        {
          code:
            "PLATFORM_RELEASE_SOURCE_V2_MATERIALIZATION_BUSY",
        },
      );
      releaseInstall();
      const capsule = await first;
      assert.equal(capsule.admissionScope, "test_fixture");
      await revalidatePlatformReleaseBuildToolchainCapsuleV2(
        capsule,
      );
    } finally {
      releaseInstall?.();
      try {
        disposePlatformReleaseSourceStageV2(source);
      } catch (error) {
        if (
          !(error instanceof PlatformReleaseSourceAdmissionErrorV2)
          || error.code
            !== "PLATFORM_RELEASE_SOURCE_V2_HANDLE_DISPOSED"
        ) throw error;
      }
    }
  });

  it("detects sealed compiler mutation and source disposal", async () => {
    const repository = createRepositoryFixtureV2();
    const hostFixture = createHostFixtureV2();
    const source = admittedSourceV2(repository);
    const host = await createPlatformHostV2(
      hostFixture,
      "valid",
    );
    const capsule =
      await materializePlatformReleaseBuildToolchainCapsuleV2ForTest({
        sourceStage: source,
        hostToolchain: host,
      });
    await assert.rejects(
      withPlatformReleaseBuildToolchainCapsuleForTestV2(
        capsule,
        (nodeModulesRoot) => {
          const target = path.join(
            nodeModulesRoot,
            "typescript",
            "bin",
            "tsc",
          );
          chmodSync(target, 0o755);
          writeFileSync(target, "#!/usr/bin/env node\n// drift\n");
          chmodSync(target, 0o555);
        },
      ),
      (error: unknown) =>
        error
          instanceof PlatformReleaseBuildToolchainCapsuleErrorV2
        && error.code
          === "PLATFORM_RELEASE_BUILD_TOOLCHAIN_CAPSULE_V2_TREE_INVALID",
    );
    disposePlatformReleaseSourceStageV2(source);
    await assert.rejects(
      revalidatePlatformReleaseBuildToolchainCapsuleV2(
        capsule,
      ),
      {
        code:
          "PLATFORM_RELEASE_BUILD_TOOLCHAIN_CAPSULE_V2_SOURCE_DRIFT",
      },
    );
  });

  it("keeps production scope, candidate JSON and hostile proxies outside authority", async () => {
    const repository = createRepositoryFixtureV2();
    const hostFixture = createHostFixtureV2();
    const source = admittedSourceV2(repository);
    try {
      const host = await createPlatformHostV2(
        hostFixture,
        "valid",
      );
      await assert.rejects(
        materializePlatformReleaseBuildToolchainCapsuleV2({
          sourceStage: source,
          hostToolchain: host,
        }),
        {
          code:
            "PLATFORM_RELEASE_BUILD_TOOLCHAIN_CAPSULE_V2_SCOPE_MISMATCH",
        },
      );
      const hostile = new Proxy(
        {
          sourceStage: source,
          hostToolchain: host,
        },
        {
          ownKeys() {
            throw new Error("proxy trap must not execute");
          },
        },
      );
      await assert.rejects(
        materializePlatformReleaseBuildToolchainCapsuleV2ForTest(
          hostile,
        ),
        {
          code:
            "PLATFORM_RELEASE_BUILD_TOOLCHAIN_CAPSULE_V2_INPUT_INVALID",
        },
      );
      const capsule =
        await materializePlatformReleaseBuildToolchainCapsuleV2ForTest({
          sourceStage: source,
          hostToolchain: host,
        });
      const candidate =
        inspectPlatformReleaseBuildToolchainReceiptV2(
          capsule,
        );
      await assert.rejects(
        revalidatePlatformReleaseBuildToolchainCapsuleV2(
          candidate as never,
        ),
        {
          code:
            "PLATFORM_RELEASE_BUILD_TOOLCHAIN_CAPSULE_V2_HANDLE_UNAUTHENTICATED",
        },
      );
    } finally {
      disposePlatformReleaseSourceStageV2(source);
    }
  });
});
