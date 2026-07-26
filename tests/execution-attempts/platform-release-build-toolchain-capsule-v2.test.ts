import assert from "node:assert/strict";
import { createHash } from "node:crypto";
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
  hashCanonicalJson,
} from
  "../../src/product-compiler/canonical-json.js";
import {
  createHostNodeToolchainAuthorityV2ForTest,
  hashHostNodePlatformReleaseOutputStageIdentityV2,
  HostNodeToolchainAuthorityErrorV2,
  type HostNodeToolchainProbeInvocationV2,
  type HostNodeToolchainProbeResultV2,
} from
  "../../src/product-compiler/host-node-toolchain-authority-v2.js";
import {
  createPlatformReleaseHostNodeToolchainAuthorityV2ForTest,
  inspectPlatformReleaseHostNodeToolchainReceiptV2,
  PlatformReleaseHostNodeToolchainAuthorityErrorV2,
} from
  "../../src/execution/platform-release-host-node-toolchain-authority-v2.js";
import {
  AdmittedPlatformReleaseSourceStageV2,
  PlatformReleaseBuildToolchainCapsuleErrorV2,
  PlatformReleaseBuildToolchainCapsuleV2,
  PlatformReleaseCompiledOutputPairV2,
  type PlatformReleaseDependencyMaterializationFaultForTestV2,
  PlatformReleaseDependencyMaterializedPairErrorV2,
  PlatformReleaseDependencyMaterializedPairV2,
  PlatformReleaseSourceAdmissionErrorV2,
  admitPlatformReleaseSourceV2ForTest,
  disposePlatformReleaseDependencyMaterializedPairV2,
  disposePlatformReleaseSourceStageV2,
  inspectPlatformReleaseCompiledOutputPairV2,
  inspectPlatformReleaseDependencyMaterializedPairV2,
  inspectPlatformReleaseBuildToolchainReceiptV2,
  inspectPlatformReleaseSourceAdmissionCandidateV2,
  materializePlatformReleaseCompiledOutputPairV2,
  materializePlatformReleaseCompiledOutputPairV2ForTest,
  materializePlatformReleaseCompiledOutputPairWithAllocationFaultForTestV2,
  materializePlatformReleaseDependencyMaterializedPairForTestV2,
  materializePlatformReleaseDependencyMaterializedPairWithFaultForTestV2,
  materializePlatformReleaseDependencyMaterializedPairV2,
  materializePlatformReleaseBuildToolchainCapsuleV2,
  materializePlatformReleaseBuildToolchainCapsuleV2ForTest,
  revalidatePlatformReleaseCompiledOutputPairV2,
  revalidatePlatformReleaseDependencyMaterializedPairV2,
  revalidatePlatformReleaseBuildToolchainCapsuleV2,
  withPlatformReleaseCompiledOutputPairForTestV2,
  withPlatformReleaseDependencyMaterializedPairForTestV2,
  withPlatformReleaseBuildToolchainCapsuleForTestV2,
  withPlatformReleaseSourceStageForTestV2,
} from
  "../../src/execution/platform-release-source-admission-v2.js";
import {
  EXACT_PLATFORM_RELEASE_SOURCE_REF_V2_SCHEMA,
  PLATFORM_RELEASE_SOURCE_TREE_BINDING_V2_SCHEMA,
  PlatformReleaseBuildToolchainReceiptV2Schema,
  PlatformReleaseSourceTreeBindingV2Schema,
  hashExactPlatformReleaseSourceRefV2,
  hashPlatformReleaseSourceTreeBindingV2,
} from
  "../../src/execution/schemas/platform-release-build-v2.js";
import {
  hashPlatformReleaseCompiledOutputPairInspectionV2,
  PlatformReleaseCompiledOutputPairInspectionV2Schema,
} from
  "../../src/execution/schemas/platform-release-compiled-output-pair-v2.js";
import {
  hashPlatformReleaseDependencyOutputBindingV2,
  hashPlatformReleaseDependencyMaterializedPairInspectionV2,
  PlatformReleaseDependencyMaterializedPairInspectionV2Schema,
} from
  "../../src/execution/schemas/platform-release-dependency-materialized-pair-v2.js";
import {
  materializePlatformReleaseProductionDependenciesInternalV2,
  PlatformReleaseProductionDependencyMaterializationErrorV2,
  revalidatePlatformReleaseProductionDependenciesInternalV2,
} from
  "../../src/execution/platform-release-production-dependency-materialization-v2.js";
import {
  derivePlatformReleaseSourceLockAuthorityInternalV2,
  hashPlatformReleaseSourceLockAuthorityInternalV2,
  PlatformReleaseBuildToolchainMaterializationErrorV2,
  validatePlatformReleaseSourceLockAuthorityInternalV2,
} from
  "../../src/execution/platform-release-build-toolchain-materialization-v2.js";

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
    libc?: readonly string[];
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
    ...(input.libc ? { libc: input.libc } : {}),
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

function sourceArtifactsWithProductionV2(
  libc?: readonly string[],
  runtimeAlphaDev = false,
) {
  const base = structuredClone(sourceArtifactsV2());
  const packageJson = {
    ...base.packageJson,
    dependencies: {
      "runtime-alpha": "1.0.0",
    },
    optionalDependencies: {
      "runtime-beta": "1.0.0",
    },
  };
  const packages = {
    ...base.lock.packages,
    "": {
      name: packageJson.name,
      version: packageJson.version,
      bin: packageJson.bin,
      dependencies: packageJson.dependencies,
      devDependencies: packageJson.devDependencies,
      engines: packageJson.engines,
      optionalDependencies:
        packageJson.optionalDependencies,
    },
    "node_modules/runtime-alpha": lockEntry({
      name: "runtime-alpha",
      version: "1.0.0",
      dependencies: {
        "runtime-child": "1.0.0",
      },
      ...(libc ? { libc } : {}),
      ...(runtimeAlphaDev ? { dev: true } : {}),
    }),
    "node_modules/runtime-beta": lockEntry({
      name: "runtime-beta",
      version: "1.0.0",
      optional: true,
      os: ["darwin"],
      cpu: ["arm64"],
    }),
    "node_modules/runtime-child": lockEntry({
      name: "runtime-child",
      version: "1.0.0",
    }),
  };
  delete packages[
    "node_modules/@fixture/darwin-arm64"
  ];
  return Object.freeze({
    packageJson,
    lock: {
      ...base.lock,
      packages,
    },
  });
}

function createRepositoryFixtureV2(
  artifacts = sourceArtifactsV2(),
): RepositoryFixtureV2 {
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

function materializeFakeProductionInstallV2(
  projectRoot: string,
): void {
  const nodeModules = path.join(projectRoot, "node_modules");
  mkdirSync(nodeModules, { mode: 0o755 });
  writeFileSync(
    path.join(nodeModules, ".package-lock.json"),
    `${JSON.stringify({
      name: "setfarm",
      version: "9.9.9",
      lockfileVersion: 3,
      requires: true,
      packages: {},
    })}\n`,
    { mode: 0o644 },
  );
}

function addFakeInstalledPackagesV2(
  projectRoot: string,
  packagePaths: readonly string[],
): void {
  const lock = JSON.parse(readFileSync(
    path.join(projectRoot, "package-lock.json"),
    "utf8",
  )) as {
    name: string;
    version: string;
    packages: Record<string, Record<string, unknown>>;
  };
  const nodeModules = path.join(projectRoot, "node_modules");
  const hiddenPath =
    path.join(nodeModules, ".package-lock.json");
  const hidden = JSON.parse(readFileSync(
    hiddenPath,
    "utf8",
  )) as {
    name: string;
    version: string;
    lockfileVersion: number;
    requires: boolean;
    packages: Record<string, unknown>;
  };
  for (const packagePath of packagePaths) {
    const entry = lock.packages[packagePath];
    assert.ok(entry);
    const segments = packagePath.split("/");
    const lastNodeModules =
      segments.lastIndexOf("node_modules");
    const packageName = segments[lastNodeModules + 1]!
      .startsWith("@")
      ? `${segments[lastNodeModules + 1]}/${
        segments[lastNodeModules + 2]
      }`
      : segments[lastNodeModules + 1]!;
    const relativePath =
      packagePath.slice("node_modules/".length);
    const packageRoot = path.join(
      nodeModules,
      ...relativePath.split("/"),
    );
    mkdirSync(packageRoot, { recursive: true });
    writeFileSync(
      path.join(packageRoot, "package.json"),
      `${JSON.stringify({
        name: packageName,
        version: entry.version,
      })}\n`,
      { mode: 0o644 },
    );
    writeFileSync(
      path.join(packageRoot, "index.js"),
      "export const runtimeFixture = true;\n",
      { mode: 0o644 },
    );
    hidden.packages[packagePath] = entry;
  }
  writeFileSync(
    hiddenPath,
    `${JSON.stringify(hidden)}\n`,
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
  productionInstallHook?: (
    invocation: HostNodeToolchainProbeInvocationV2,
    occurrence: number,
  ) =>
    | HostNodeToolchainProbeResultV2
    | undefined
    | Promise<
      HostNodeToolchainProbeResultV2 | undefined
    >,
) {
  let buildOccurrence = 0;
  let productionInstallOccurrence = 0;
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
        === "HOST_NPM_PLATFORM_RELEASE_PRODUCTION_INSTALL_V2"
    ) {
      productionInstallOccurrence += 1;
      const overridden = await productionInstallHook?.(
        invocation,
        productionInstallOccurrence,
      );
      if (overridden) return overridden;
      return exited(
        "npm produced no tree for the empty production graph\n",
      );
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

function errorMessagesV2(
  error: unknown,
  seen = new Set<unknown>(),
): readonly string[] {
  if (
    error === null
    || (
      typeof error !== "object"
      && typeof error !== "function"
    )
    || seen.has(error)
  ) {
    return [];
  }
  seen.add(error);
  const messages: string[] = [];
  if (error instanceof Error) {
    messages.push(error.message);
    if (error.cause !== undefined) {
      messages.push(...errorMessagesV2(error.cause, seen));
    }
  }
  if (error instanceof AggregateError) {
    for (const nested of error.errors) {
      messages.push(...errorMessagesV2(nested, seen));
    }
  }
  return messages;
}

function errorCodesV2(
  error: unknown,
  seen = new Set<unknown>(),
): readonly string[] {
  if (
    error === null
    || (
      typeof error !== "object"
      && typeof error !== "function"
    )
    || seen.has(error)
  ) {
    return [];
  }
  seen.add(error);
  const codes: string[] = [];
  if (
    "code" in error
    && typeof error.code === "string"
  ) {
    codes.push(error.code);
  }
  if (error instanceof Error && error.cause !== undefined) {
    codes.push(...errorCodesV2(error.cause, seen));
  }
  if (error instanceof AggregateError) {
    for (const nested of error.errors) {
      codes.push(...errorCodesV2(nested, seen));
    }
  }
  return codes;
}

const CURRENT_PRODUCTION_PACKAGE_PATHS_V2 = Object.freeze([
  "node_modules/json5",
  "node_modules/playwright",
  "node_modules/playwright-core",
  "node_modules/playwright/node_modules/fsevents",
  "node_modules/postgres",
  "node_modules/yaml",
  "node_modules/zod",
] as const);

const CURRENT_PRODUCTION_BIN_TARGETS_V2 =
  Object.freeze([
    Object.freeze({
      link: "json5",
      targetPackagePath: "node_modules/json5",
      target: "lib/cli.js",
    }),
    Object.freeze({
      link: "playwright",
      targetPackagePath: "node_modules/playwright",
      target: "cli.js",
    }),
    Object.freeze({
      link: "playwright-core",
      targetPackagePath:
        "node_modules/playwright-core",
      target: "cli.js",
    }),
    Object.freeze({
      link: "yaml",
      targetPackagePath: "node_modules/yaml",
      target: "bin.mjs",
    }),
  ] as const);

function sha256V2(
  value: string | Uint8Array,
): string {
  return createHash("sha256")
    .update(value)
    .digest("hex");
}

function packageNameFromCurrentLockPathV2(
  packagePath: string,
): string {
  const segments = packagePath.split("/");
  const nodeModulesIndex =
    segments.lastIndexOf("node_modules");
  const first = segments[nodeModulesIndex + 1]!;
  return first.startsWith("@")
    ? `${first}/${segments[nodeModulesIndex + 2]!}`
    : first;
}

function createCurrentProductionProjectV2() {
  const parent = realpathSync(
    mkdtempSync(path.join(
      tmpdir(),
      "setfarm-current-production-lock-v2-",
    )),
  );
  roots.push(parent);
  chmodSync(parent, 0o700);
  const projectRoot = path.join(parent, "project");
  mkdirSync(projectRoot, { mode: 0o700 });

  const sourceDefinitions = [
    {
      locator: "package-lock.json" as const,
      role: "dependency_lock_manifest" as const,
    },
    {
      locator: "package.json" as const,
      role: "package_manifest" as const,
    },
    {
      locator: "tsconfig.json" as const,
      role: "typescript_compiler_config" as const,
    },
  ];
  const sourceBytes = sourceDefinitions.map(
    ({ locator, role }) => {
      const bytes = readFileSync(path.resolve(locator));
      const destination =
        path.join(projectRoot, locator);
      writeFileSync(destination, bytes, {
        mode: 0o444,
      });
      chmodSync(destination, 0o444);
      const identity = {
        schema:
          EXACT_PLATFORM_RELEASE_SOURCE_REF_V2_SCHEMA,
        role,
        locator,
        mediaType: "application/json" as const,
        gitBlobHash:
          sha256V2(`current-git-blob:${locator}`),
        contentHash: sha256V2(bytes),
        byteLength: bytes.byteLength,
        gitMode: "100644" as const,
        exportedMode: "0444" as const,
      };
      return Object.freeze({
        bytes,
        sourceRef: Object.freeze({
          ...identity,
          sourceRefHash:
            hashExactPlatformReleaseSourceRefV2(
              identity,
            ),
        }),
      });
    },
  );
  const inputs = sourceBytes.map(
    (entry) => entry.sourceRef,
  ) as [
    (typeof sourceBytes)[number]["sourceRef"],
    (typeof sourceBytes)[number]["sourceRef"],
    (typeof sourceBytes)[number]["sourceRef"],
  ];
  const inputMembershipHash = hashCanonicalJson({
    schema:
      "setfarm.platform-release-source-input-membership.v2",
    entries: inputs.map((entry) => ({
      role: entry.role,
      locator: entry.locator,
      sourceRefHash: entry.sourceRefHash,
    })),
  });
  const sourceIdentity = {
    schema:
      PLATFORM_RELEASE_SOURCE_TREE_BINDING_V2_SCHEMA,
    sourceTreeHash:
      sha256V2("current-source-tree"),
    exportedFileTreeHash:
      sha256V2("current-exported-file-tree"),
    exportedFileCount: inputs.length,
    exportedDirectoryCount: 0,
    exportedTotalBytes: sourceBytes.reduce(
      (total, entry) =>
        total + entry.bytes.byteLength,
      0,
    ),
    inputMembershipHash,
    inputs,
  };
  const source =
    PlatformReleaseSourceTreeBindingV2Schema.parse({
      ...sourceIdentity,
      bindingHash:
        hashPlatformReleaseSourceTreeBindingV2(
          sourceIdentity,
        ),
    });

  const lock = JSON.parse(
    sourceBytes[0]!.bytes.toString("utf8"),
  ) as {
    name: string;
    version: string;
    lockfileVersion: number;
    requires: boolean;
    packages: Record<string, Record<string, unknown>>;
  };
  const nodeModulesRoot =
    path.join(projectRoot, "node_modules");
  mkdirSync(nodeModulesRoot, { mode: 0o755 });
  for (
    const packagePath
    of CURRENT_PRODUCTION_PACKAGE_PATHS_V2
  ) {
    const lockEntry = lock.packages[packagePath];
    assert.ok(lockEntry);
    assert.equal(typeof lockEntry.version, "string");
    const relativePath = packagePath.slice(
      "node_modules/".length,
    );
    const packageRoot =
      path.join(nodeModulesRoot, relativePath);
    mkdirSync(packageRoot, {
      recursive: true,
      mode: 0o755,
    });
    writeFileSync(
      path.join(packageRoot, "package.json"),
      `${JSON.stringify({
        name:
          packageNameFromCurrentLockPathV2(
            packagePath,
          ),
        version: lockEntry.version,
      })}\n`,
      { mode: 0o644 },
    );
  }
  for (
    const bin
    of CURRENT_PRODUCTION_BIN_TARGETS_V2
  ) {
    const relativePackagePath =
      bin.targetPackagePath.slice(
        "node_modules/".length,
      );
    const target = path.join(
      nodeModulesRoot,
      relativePackagePath,
      bin.target,
    );
    mkdirSync(path.dirname(target), {
      recursive: true,
      mode: 0o755,
    });
    writeFileSync(
      target,
      "#!/usr/bin/env node\n",
      { mode: 0o755 },
    );
    chmodSync(target, 0o755);
  }
  const binRoot =
    path.join(nodeModulesRoot, ".bin");
  mkdirSync(binRoot, { mode: 0o755 });
  for (
    const bin
    of CURRENT_PRODUCTION_BIN_TARGETS_V2
  ) {
    const fullTarget =
      `${bin.targetPackagePath}/${bin.target}`;
    symlinkSync(
      path.posix.relative(
        "node_modules/.bin",
        fullTarget,
      ),
      path.join(binRoot, bin.link),
    );
  }
  const hiddenLock = {
    name: lock.name,
    version: lock.version,
    lockfileVersion: 3,
    requires: true,
    packages: Object.fromEntries(
      CURRENT_PRODUCTION_PACKAGE_PATHS_V2.map(
        (packagePath) => [
          packagePath,
          structuredClone(
            lock.packages[packagePath],
          ),
        ],
      ),
    ),
  };
  writeFileSync(
    path.join(
      nodeModulesRoot,
      ".package-lock.json",
    ),
    `${JSON.stringify(hiddenLock)}\n`,
    { mode: 0o644 },
  );
  return Object.freeze({
    projectRoot,
    nodeModulesRoot,
    source,
  });
}

afterEach(() => {
  for (const root of roots.splice(0)) {
    makeWritable(root);
    rmSync(root, { recursive: true, force: true });
  }
});

describe("PlatformReleaseBuildToolchainCapsuleV2", () => {
  it("binds source lock authority to its exact phase and canonical hash", () => {
    const repository = createRepositoryFixtureV2();
    const source = admittedSourceV2(repository);
    try {
      const inspected =
        inspectPlatformReleaseSourceAdmissionCandidateV2(
          source,
        );
      assert.equal(
        inspected.admissionScope,
        "test_fixture",
      );
      assert.ok(inspected.testEvidence);
      const sourceBinding =
        inspected.testEvidence.exportedSource.source;
      withPlatformReleaseSourceStageForTestV2(
        source,
        (stageRoot) => {
          const authority =
            derivePlatformReleaseSourceLockAuthorityInternalV2({
              projectRoot: stageRoot,
              source: sourceBinding,
              purpose: "build_toolchain",
            });
          assert.doesNotThrow(() =>
            validatePlatformReleaseSourceLockAuthorityInternalV2(
              authority,
              "build_toolchain",
            ));
          const wrongPurposeBeforeHash = {
            ...authority,
            purpose: "production_runtime" as const,
            authorityHash: "0".repeat(64),
          };
          const wrongPurpose = {
            ...wrongPurposeBeforeHash,
            authorityHash:
              hashPlatformReleaseSourceLockAuthorityInternalV2(
                wrongPurposeBeforeHash,
              ),
          };
          assert.throws(
            () =>
              validatePlatformReleaseSourceLockAuthorityInternalV2(
                wrongPurpose,
                "build_toolchain",
              ),
            {
              code:
                "PLATFORM_RELEASE_BUILD_TOOLCHAIN_V2_AUTHORITY_MISMATCH",
            },
          );
          assert.throws(
            () =>
              validatePlatformReleaseSourceLockAuthorityInternalV2(
                {
                  ...authority,
                  authorityHash: "0".repeat(64),
                },
                "build_toolchain",
              ),
            {
              code:
                "PLATFORM_RELEASE_BUILD_TOOLCHAIN_V2_AUTHORITY_MISMATCH",
            },
          );
          assert.throws(
            () =>
              validatePlatformReleaseSourceLockAuthorityInternalV2(
                {
                  ...authority,
                  extra: "forged",
                } as never,
                "build_toolchain",
              ),
            {
              code:
                "PLATFORM_RELEASE_BUILD_TOOLCHAIN_V2_AUTHORITY_MISMATCH",
            },
          );
        },
      );
    } finally {
      disposePlatformReleaseSourceStageV2(source);
    }
  });

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

describe("PlatformReleaseDependencyMaterializedPairV2", () => {
  it("replays the checked-in nested production lock twice without npm or network", async () => {
    const hostFixture = createHostFixtureV2();
    const host = await createPlatformHostV2(
      hostFixture,
      "valid",
    );
    const hostToolchain =
      inspectPlatformReleaseHostNodeToolchainReceiptV2(
        host,
      );
    assert.equal(
      hostToolchain.requirement
        .productionInstallCommandRef,
      "MATERIALIZE_PRODUCTION_DEPENDENCIES_V2",
    );
    const firstProject =
      createCurrentProductionProjectV2();
    const secondProject =
      createCurrentProductionProjectV2();
    const first =
      materializePlatformReleaseProductionDependenciesInternalV2({
        admissionScope: "test_fixture",
        projectRoot: firstProject.projectRoot,
        source: firstProject.source,
        hostPlatform: "darwin",
        hostArchitecture: "arm64",
        hostToolchain,
      });
    const second =
      materializePlatformReleaseProductionDependenciesInternalV2({
        admissionScope: "test_fixture",
        projectRoot: secondProject.projectRoot,
        source: secondProject.source,
        hostPlatform: "darwin",
        hostArchitecture: "arm64",
        hostToolchain,
      });

    assert.deepEqual(
      first.productionClosure.installedPackages.map(
        (entry) => entry.packagePath,
      ),
      CURRENT_PRODUCTION_PACKAGE_PATHS_V2,
    );
    assert.deepEqual(
      first.productionClosure.rootDependencyLocators,
      [
        "node_modules/json5",
        "node_modules/playwright",
        "node_modules/postgres",
        "node_modules/yaml",
        "node_modules/zod",
      ],
    );
    assert.equal(
      first.productionClosure.installedPackageCount,
      7,
    );
    assert.equal(first.productionClosure.edgeCount, 7);
    assert.equal(first.productionGraph.packageCount, 7);
    assert.equal(
      first.productionGraph.dependencyEdges.length,
      7,
    );
    assert.deepEqual(
      readdirSync(firstProject.nodeModulesRoot).sort(),
      [
        "json5",
        "playwright",
        "playwright-core",
        "postgres",
        "yaml",
        "zod",
      ],
    );
    assert.deepEqual(
      readdirSync(path.join(
        firstProject.nodeModulesRoot,
        "playwright",
        "node_modules",
      )).sort(),
      ["fsevents"],
    );
    assert.equal(
      existsSync(path.join(
        firstProject.nodeModulesRoot,
        ".bin",
      )),
      false,
    );
    assert.equal(
      existsSync(path.join(
        firstProject.nodeModulesRoot,
        ".package-lock.json",
      )),
      false,
    );

    const stableFirst = {
      lockAuthority: first.lockAuthority,
      productionClosure:
        first.productionClosure,
      hiddenLockRawHash:
        first.hiddenLockRawHash,
      rawInstallMembershipHash:
        first.rawInstallMembershipHash,
      installedPackageMembershipHash:
        first.installedPackageMembershipHash,
      dependencyTree: first.dependencyTree,
      dependencyTreeBinding:
        first.dependencyTreeBinding,
      productionGraph: first.productionGraph,
      materializationReceipt:
        first.materializationReceipt,
    };
    const stableSecond = {
      lockAuthority: second.lockAuthority,
      productionClosure:
        second.productionClosure,
      hiddenLockRawHash:
        second.hiddenLockRawHash,
      rawInstallMembershipHash:
        second.rawInstallMembershipHash,
      installedPackageMembershipHash:
        second.installedPackageMembershipHash,
      dependencyTree: second.dependencyTree,
      dependencyTreeBinding:
        second.dependencyTreeBinding,
      productionGraph: second.productionGraph,
      materializationReceipt:
        second.materializationReceipt,
    };
    assert.equal(
      canonicalJsonStringify(stableFirst),
      canonicalJsonStringify(stableSecond),
    );

    const freshFirst =
      revalidatePlatformReleaseProductionDependenciesInternalV2({
        admissionScope: "test_fixture",
        nodeModulesRoot:
          firstProject.nodeModulesRoot,
        source: firstProject.source,
        hostToolchain,
        lockAuthority: first.lockAuthority,
        productionClosure:
          first.productionClosure,
        dependencyTree: first.dependencyTree,
        dependencyTreeBinding:
          first.dependencyTreeBinding,
        productionGraph:
          first.productionGraph,
        materializationReceipt:
          first.materializationReceipt,
      });
    const freshSecond =
      revalidatePlatformReleaseProductionDependenciesInternalV2({
        admissionScope: "test_fixture",
        nodeModulesRoot:
          secondProject.nodeModulesRoot,
        source: secondProject.source,
        hostToolchain,
        lockAuthority: second.lockAuthority,
        productionClosure:
          second.productionClosure,
        dependencyTree: second.dependencyTree,
        dependencyTreeBinding:
          second.dependencyTreeBinding,
        productionGraph:
          second.productionGraph,
        materializationReceipt:
          second.materializationReceipt,
      });
    assert.equal(
      canonicalJsonStringify(freshFirst),
      canonicalJsonStringify(freshSecond),
    );
  });

  it("owns two independent sealed production closures behind one pathless authority", async () => {
    const repository = createRepositoryFixtureV2();
    const hostFixture = createHostFixtureV2();
    const source = admittedSourceV2(repository);
    let dependencyPair:
      PlatformReleaseDependencyMaterializedPairV2
      | undefined;
    let released = false;
    let sourceRoot = "";
    let firstOutputRoot = "";
    let secondOutputRoot = "";
    withPlatformReleaseSourceStageForTestV2(
      source,
      (root) => {
        sourceRoot = root;
      },
    );
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
      const compiledPair =
        await materializePlatformReleaseCompiledOutputPairV2ForTest({
          sourceStage: source,
          buildToolchain: capsule,
        });
      await assert.rejects(
        materializePlatformReleaseDependencyMaterializedPairV2(
          compiledPair,
        ),
        {
          code:
            "PLATFORM_RELEASE_DEPENDENCY_PAIR_V2_SCOPE_MISMATCH",
        },
      );
      dependencyPair =
        await materializePlatformReleaseDependencyMaterializedPairForTestV2(
          compiledPair,
        );
      const inspection =
        inspectPlatformReleaseDependencyMaterializedPairV2(
          dependencyPair,
        );
      assert.deepEqual(
        PlatformReleaseDependencyMaterializedPairInspectionV2Schema
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
        dependencyPair.stableOutputBindingHash,
        inspection.stableOutput.bindingHash,
      );
      assert.equal(
        inspection.stableOutput.dependencyTree.fileCount,
        0,
      );
      assert.equal(
        inspection.stableOutput.dependencyTree.directoryCount,
        0,
      );
      assert.notEqual(
        inspection.occurrences[0]
          .hostDependencyInstallEvidenceHash,
        inspection.occurrences[1]
          .hostDependencyInstallEvidenceHash,
      );
      assert.notEqual(
        inspection.occurrences[0]
          .dependencyTreePhysicalIdentityHash,
        inspection.occurrences[1]
          .dependencyTreePhysicalIdentityHash,
      );
      assert.notEqual(
        inspection.occurrences[0].projectScopeHash,
        inspection.occurrences[1].projectScopeHash,
      );
      assert.notEqual(
        inspection.occurrences[0]
          .projectPhysicalIdentityHash,
        inspection.occurrences[1]
          .projectPhysicalIdentityHash,
      );
      assert.notEqual(
        inspection.occurrences[0].environmentHash,
        inspection.occurrences[1].environmentHash,
      );
      assert.notEqual(
        inspection.occurrences[0]
          .environmentScopeHash,
        inspection.occurrences[1]
          .environmentScopeHash,
      );
      assert.equal(
        inspection.occurrences[0]
          .dependencyOutputBindingHash,
        inspection.stableOutput.bindingHash,
      );
      assert.equal(
        inspection.occurrences[1]
          .dependencyOutputBindingHash,
        inspection.stableOutput.bindingHash,
      );
      const forgedSharedProjectScope =
        structuredClone(inspection);
      forgedSharedProjectScope.occurrences[1]
        .projectScopeHash =
          forgedSharedProjectScope.occurrences[0]
            .projectScopeHash;
      forgedSharedProjectScope.inspectionHash =
        hashPlatformReleaseDependencyMaterializedPairInspectionV2(
          forgedSharedProjectScope,
        );
      assert.throws(() =>
        PlatformReleaseDependencyMaterializedPairInspectionV2Schema
          .parse(forgedSharedProjectScope));
      const forgedReceiptJoin =
        structuredClone(inspection);
      forgedReceiptJoin.occurrences[1]
        .npmMaterializationReceiptHash = "0".repeat(64);
      forgedReceiptJoin.inspectionHash =
        hashPlatformReleaseDependencyMaterializedPairInspectionV2(
          forgedReceiptJoin,
        );
      assert.throws(() =>
        PlatformReleaseDependencyMaterializedPairInspectionV2Schema
          .parse(forgedReceiptJoin));
      const forgedPredecessorJoin =
        structuredClone(inspection);
      forgedPredecessorJoin.stableOutput
        .predependencyOutputBindingHash = "1".repeat(64);
      forgedPredecessorJoin.stableOutput.bindingHash =
        hashPlatformReleaseDependencyOutputBindingV2(
          forgedPredecessorJoin.stableOutput,
        );
      for (
        const occurrence
        of forgedPredecessorJoin.occurrences
      ) {
        occurrence.dependencyOutputBindingHash =
          forgedPredecessorJoin.stableOutput.bindingHash;
      }
      forgedPredecessorJoin.inspectionHash =
        hashPlatformReleaseDependencyMaterializedPairInspectionV2(
          forgedPredecessorJoin,
        );
      assert.throws(() =>
        PlatformReleaseDependencyMaterializedPairInspectionV2Schema
          .parse(forgedPredecessorJoin));
      assert.doesNotMatch(
        JSON.stringify(inspection),
        /setfarm-platform-release-(?:source|output|dependency)-|\/private\/|\/Users\//,
      );
      assert.throws(
        () => new PlatformReleaseDependencyMaterializedPairV2(
          {},
          {} as never,
        ),
        {
          code:
            "PLATFORM_RELEASE_DEPENDENCY_PAIR_V2_HANDLE_UNAUTHENTICATED",
        },
      );
      assert.throws(
        () =>
          inspectPlatformReleaseCompiledOutputPairV2(
            compiledPair,
          ),
        {
          code:
            "PLATFORM_RELEASE_COMPILED_OUTPUT_PAIR_V2_SOURCE_DRIFT",
        },
      );
      await assert.rejects(
        revalidatePlatformReleaseCompiledOutputPairV2(
          compiledPair,
        ),
        {
          code:
            "PLATFORM_RELEASE_COMPILED_OUTPUT_PAIR_V2_SOURCE_DRIFT",
        },
      );
      assert.deepEqual(
        await revalidatePlatformReleaseDependencyMaterializedPairV2(
          dependencyPair,
        ),
        inspection,
      );
      await withPlatformReleaseDependencyMaterializedPairForTestV2(
        dependencyPair,
        (outputRoots) => {
          firstOutputRoot = outputRoots.firstOutputRoot;
          secondOutputRoot = outputRoots.secondOutputRoot;
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
              readdirSync(
                path.join(root, "payload"),
              ).sort(),
              [
                "dist",
                "node_modules",
                "package.json",
              ],
            );
            const dependencyRoot = path.join(
              root,
              "payload",
              "node_modules",
            );
            assert.deepEqual(
              readdirSync(dependencyRoot),
              [],
            );
            assert.equal(
              lstatSync(dependencyRoot).mode & 0o7777,
              0o555,
            );
          }
        },
      );
      assert.throws(
        () => disposePlatformReleaseSourceStageV2(source),
        {
          code:
            "PLATFORM_RELEASE_SOURCE_V2_MATERIALIZATION_BUSY",
        },
      );
      disposePlatformReleaseDependencyMaterializedPairV2(
        dependencyPair,
      );
      released = true;
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
        revalidatePlatformReleaseDependencyMaterializedPairV2(
          dependencyPair,
        ),
        {
          code:
            "PLATFORM_RELEASE_DEPENDENCY_PAIR_V2_SOURCE_DRIFT",
        },
      );
      assert.throws(
        () =>
          disposePlatformReleaseDependencyMaterializedPairV2(
            dependencyPair!,
          ),
        {
          code:
            "PLATFORM_RELEASE_DEPENDENCY_PAIR_V2_SOURCE_DRIFT",
        },
      );
    } finally {
      if (!released) {
        if (dependencyPair) {
          disposePlatformReleaseDependencyMaterializedPairV2(
            dependencyPair,
          );
        } else {
          try {
            disposePlatformReleaseSourceStageV2(source);
          } catch (error) {
            if (
              !(error instanceof
                PlatformReleaseSourceAdmissionErrorV2)
              || error.code
                !== "PLATFORM_RELEASE_SOURCE_V2_HANDLE_DISPOSED"
            ) throw error;
          }
        }
      }
    }
  });

  const terminalFaultCheckpoints = [
    "after_first_dependency_root_opened",
    "after_first_dependency_root_adopted",
    "after_first_dependency_root_resealed",
    "after_second_dependency_root_opened",
    "after_second_dependency_root_adopted",
    "after_second_dependency_root_resealed",
    "after_scratch_cleanup_before_registration",
    "after_registration_and_predecessor_consumption_before_return",
  ] as const satisfies readonly
    PlatformReleaseDependencyMaterializationFaultForTestV2["checkpoint"][];

  for (const checkpoint of terminalFaultCheckpoints) {
    it(`terminally cleans every owned root for the ${checkpoint} fault checkpoint`, async () => {
      const repository = createRepositoryFixtureV2();
      const hostFixture = createHostFixtureV2();
      const source = admittedSourceV2(repository);
      let sourceRoot = "";
      let firstOutputRoot = "";
      let secondOutputRoot = "";
      const scratchRoots: string[] = [];
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
        undefined,
        (invocation) => {
          scratchRoots.push(
            path.dirname(invocation.env.HOME!),
            path.dirname(invocation.cwd),
          );
          return undefined;
        },
      );
      const capsule =
        await materializePlatformReleaseBuildToolchainCapsuleV2ForTest({
          sourceStage: source,
          hostToolchain: host,
        });
      const compiledPair =
        await materializePlatformReleaseCompiledOutputPairV2ForTest({
          sourceStage: source,
          buildToolchain: capsule,
        });
      await withPlatformReleaseCompiledOutputPairForTestV2(
        compiledPair,
        (outputRoots) => {
          firstOutputRoot = outputRoots.firstOutputRoot;
          secondOutputRoot = outputRoots.secondOutputRoot;
        },
      );
      let observedPath = "";
      await assert.rejects(
        materializePlatformReleaseDependencyMaterializedPairWithFaultForTestV2(
          compiledPair,
          {
            checkpoint,
            observePath(absolutePath) {
              observedPath = absolutePath;
            },
          },
        ),
        {
          code:
            "PLATFORM_RELEASE_DEPENDENCY_PAIR_V2_OUTPUT_INVALID",
        },
      );
      assert.notEqual(observedPath, "");
      assert.equal(scratchRoots.length, 4);
      for (const ownedRoot of [
        path.dirname(sourceRoot),
        path.dirname(firstOutputRoot),
        path.dirname(secondOutputRoot),
        ...scratchRoots,
      ]) {
        assert.equal(
          existsSync(ownedRoot),
          false,
          `${ownedRoot} must be terminally absent`,
        );
      }
      assert.equal(existsSync(observedPath), false);
      assert.throws(
        () => disposePlatformReleaseSourceStageV2(source),
        {
          code:
            "PLATFORM_RELEASE_SOURCE_V2_HANDLE_DISPOSED",
        },
      );
    });
  }

  it("rechecks both scratch trees after the final awaited authority fence", async () => {
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
    const compiledPair =
      await materializePlatformReleaseCompiledOutputPairV2ForTest({
        sourceStage: source,
        buildToolchain: capsule,
      });
    await assert.rejects(
      materializePlatformReleaseDependencyMaterializedPairWithFaultForTestV2(
        compiledPair,
        {
          checkpoint: "after_final_async_fence",
          observePath(projectRoot) {
            const dependencyRoot = path.join(
              projectRoot,
              "node_modules",
            );
            chmodSync(dependencyRoot, 0o700);
            writeFileSync(
              path.join(dependencyRoot, "post-fence-race.txt"),
              "changed after the final awaited fence\n",
              { mode: 0o600 },
            );
            chmodSync(dependencyRoot, 0o555);
          },
        },
      ),
      {
        code:
          "PLATFORM_RELEASE_DEPENDENCY_PAIR_V2_AUTHORITY_MISMATCH",
      },
    );
    assert.throws(
      () => disposePlatformReleaseSourceStageV2(source),
      {
        code:
          "PLATFORM_RELEASE_SOURCE_V2_HANDLE_DISPOSED",
      },
    );
  });

  it("preserves replaced scratch roots without re-entering failed cleanup", async () => {
    const repository = createRepositoryFixtureV2();
    const hostFixture = createHostFixtureV2();
    const source = admittedSourceV2(repository);
    let sourceRoot = "";
    let firstOutputRoot = "";
    let secondOutputRoot = "";
    const scratchRoots: string[] = [];
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
      undefined,
      (invocation) => {
        scratchRoots.push(
          path.dirname(invocation.env.HOME!),
          path.dirname(invocation.cwd),
        );
        return undefined;
      },
    );
    const capsule =
      await materializePlatformReleaseBuildToolchainCapsuleV2ForTest({
        sourceStage: source,
        hostToolchain: host,
      });
    const compiledPair =
      await materializePlatformReleaseCompiledOutputPairV2ForTest({
        sourceStage: source,
        buildToolchain: capsule,
      });
    await withPlatformReleaseCompiledOutputPairForTestV2(
      compiledPair,
      (outputRoots) => {
        firstOutputRoot = outputRoots.firstOutputRoot;
        secondOutputRoot = outputRoots.secondOutputRoot;
      },
    );
    let replacementRoot = "";
    let originalRoot = "";
    let replacementSentinel = "";
    await assert.rejects(
      materializePlatformReleaseDependencyMaterializedPairWithFaultForTestV2(
        compiledPair,
        {
          checkpoint: "before_scratch_cleanup",
          observePath(environmentRoot) {
            replacementRoot = environmentRoot;
            originalRoot = `${environmentRoot}-original`;
            renameSync(environmentRoot, originalRoot);
            mkdirSync(environmentRoot, { mode: 0o700 });
            replacementSentinel = path.join(
              environmentRoot,
              "untrusted-sentinel.txt",
            );
            writeFileSync(
              replacementSentinel,
              "preserve untrusted replacement\n",
              { mode: 0o600 },
            );
            roots.push(replacementRoot, originalRoot);
          },
        },
      ),
      (error: unknown) => {
        assert.ok(
          error instanceof
            PlatformReleaseDependencyMaterializedPairErrorV2,
        );
        assert.equal(
          error.code,
          "PLATFORM_RELEASE_DEPENDENCY_PAIR_V2_CLEANUP_FAILED",
        );
        const messages =
          errorMessagesV2(error).join("\n");
        assert.match(messages, /replaced or changed/);
        assert.doesNotMatch(
          messages,
          /already entered cleanup|cleanup was re-entered/,
        );
        return true;
      },
    );
    assert.equal(existsSync(replacementRoot), true);
    assert.equal(existsSync(originalRoot), true);
    assert.equal(
      readFileSync(replacementSentinel, "utf8"),
      "preserve untrusted replacement\n",
    );
    assert.equal(scratchRoots.length, 4);
    for (const ownedRoot of [
      path.dirname(sourceRoot),
      path.dirname(firstOutputRoot),
      path.dirname(secondOutputRoot),
      ...scratchRoots.filter(
        (root) => root !== replacementRoot,
      ),
    ]) {
      assert.equal(
        existsSync(ownedRoot),
        false,
        `${ownedRoot} must be terminally absent`,
      );
    }
    assert.throws(
      () => disposePlatformReleaseSourceStageV2(source),
      {
        code:
          "PLATFORM_RELEASE_SOURCE_V2_HANDLE_DISPOSED",
      },
    );
  });

  it("rejects extra-key, proxy and accessor fault descriptors before claiming authority", async () => {
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
    const compiledPair =
      await materializePlatformReleaseCompiledOutputPairV2ForTest({
        sourceStage: source,
        buildToolchain: capsule,
      });
    const accessorFault: Record<string, unknown> = {
      checkpoint: "after_final_async_fence",
    };
    Object.defineProperty(
      accessorFault,
      "observePath",
      {
        enumerable: true,
        get() {
          return () => {};
        },
      },
    );
    const invalidFaults = [
      {
        checkpoint: "after_final_async_fence",
        observePath() {},
        extra: true,
      },
      new Proxy(
        {
          checkpoint: "after_final_async_fence",
          observePath() {},
        },
        {},
      ),
      accessorFault,
    ];
    for (const fault of invalidFaults) {
      await assert.rejects(
        materializePlatformReleaseDependencyMaterializedPairWithFaultForTestV2(
          compiledPair,
          fault as
            PlatformReleaseDependencyMaterializationFaultForTestV2,
        ),
        {
          code:
            "PLATFORM_RELEASE_DEPENDENCY_PAIR_V2_TEST_ONLY",
        },
      );
    }
    const dependencyPair =
      await materializePlatformReleaseDependencyMaterializedPairForTestV2(
        compiledPair,
      );
    disposePlatformReleaseDependencyMaterializedPairV2(
      dependencyPair,
    );
  });

  it("materializes every-and-only required plus observed optional runtime packages without dev leakage", async () => {
    const artifacts = sourceArtifactsWithProductionV2();
    const repository =
      createRepositoryFixtureV2(artifacts);
    const hostFixture = createHostFixtureV2();
    const source = admittedSourceV2(repository);
    let dependencyPair:
      PlatformReleaseDependencyMaterializedPairV2
      | undefined;
    const productionInvocations:
      HostNodeToolchainProbeInvocationV2[] = [];
    const productionPackagePaths = [
      "node_modules/runtime-alpha",
      "node_modules/runtime-beta",
      "node_modules/runtime-child",
    ];
    try {
      const host = await createPlatformHostV2(
        hostFixture,
        "valid",
        undefined,
        undefined,
        (invocation) => {
          addFakeInstalledPackagesV2(
            invocation.cwd,
            productionPackagePaths,
          );
        },
        (invocation) => {
          productionInvocations.push(invocation);
          assert.equal(
            invocation.executable,
            hostFixture.node,
          );
          assert.deepEqual(invocation.argv, [
            hostFixture.npmCli,
            "ci",
            "--omit=dev",
            "--ignore-scripts",
            "--no-audit",
            "--no-fund",
          ]);
          assert.equal(invocation.shell, false);
          assert.equal(invocation.timeoutMs, 120_000);
          assert.equal(
            invocation.maxStdoutBytes,
            65_536,
          );
          assert.equal(
            invocation.maxStderrBytes,
            65_536,
          );
          assert.equal(
            Object.hasOwn(
              invocation.env,
              "HTTP_PROXY",
            ),
            false,
          );
          materializeFakeProductionInstallV2(
            invocation.cwd,
          );
          addFakeInstalledPackagesV2(
            invocation.cwd,
            productionPackagePaths,
          );
          return exited(
            "required and optional production closure installed\n",
          );
        },
      );
      const capsule =
        await materializePlatformReleaseBuildToolchainCapsuleV2ForTest({
          sourceStage: source,
          hostToolchain: host,
        });
      const compiledPair =
        await materializePlatformReleaseCompiledOutputPairV2ForTest({
          sourceStage: source,
          buildToolchain: capsule,
        });
      dependencyPair =
        await materializePlatformReleaseDependencyMaterializedPairForTestV2(
          compiledPair,
        );
      assert.equal(productionInvocations.length, 2);
      assert.notEqual(
        productionInvocations[0]!.cwd,
        productionInvocations[1]!.cwd,
      );
      assert.notEqual(
        productionInvocations[0]!.env.HOME,
        productionInvocations[1]!.env.HOME,
      );
      const inspection =
        inspectPlatformReleaseDependencyMaterializedPairV2(
          dependencyPair,
        );
      assert.equal(
        inspection.stableOutput.dependencyTree.fileCount,
        6,
      );
      assert.equal(
        inspection.stableOutput.dependencyTree.directoryCount,
        3,
      );
      assert.equal(
        inspection.stableOutput.dependencyTree.totalBytes
          > 0,
        true,
      );
      await withPlatformReleaseDependencyMaterializedPairForTestV2(
        dependencyPair,
        ({ firstOutputRoot, secondOutputRoot }) => {
          for (const outputRoot of [
            firstOutputRoot,
            secondOutputRoot,
          ]) {
            const nodeModules = path.join(
              outputRoot,
              "payload",
              "node_modules",
            );
            assert.deepEqual(
              readdirSync(nodeModules).sort(),
              [
                "runtime-alpha",
                "runtime-beta",
                "runtime-child",
              ],
            );
            assert.equal(
              existsSync(path.join(
                nodeModules,
                "typescript",
              )),
              false,
            );
            assert.equal(
              existsSync(path.join(
                nodeModules,
                "compiler-helper",
              )),
              false,
            );
            assert.equal(
              existsSync(path.join(
                nodeModules,
                ".package-lock.json",
              )),
              false,
            );
            assert.equal(
              existsSync(path.join(
                nodeModules,
                ".bin",
              )),
              false,
            );
          }
        },
      );
      await revalidatePlatformReleaseDependencyMaterializedPairV2(
        dependencyPair,
      );
    } finally {
      if (dependencyPair) {
        disposePlatformReleaseDependencyMaterializedPairV2(
          dependencyPair,
        );
      } else {
        try {
          disposePlatformReleaseSourceStageV2(source);
        } catch (error) {
          if (
            !(error instanceof
              PlatformReleaseSourceAdmissionErrorV2)
            || error.code
              !== "PLATFORM_RELEASE_SOURCE_V2_HANDLE_DISPOSED"
          ) throw error;
        }
      }
    }
  });

  it("rejects nondeterministic optional-package observation across independent npm occurrences", async () => {
    const artifacts = sourceArtifactsWithProductionV2();
    const repository =
      createRepositoryFixtureV2(artifacts);
    const hostFixture = createHostFixtureV2();
    const source = admittedSourceV2(repository);
    const requiredPackagePaths = [
      "node_modules/runtime-alpha",
      "node_modules/runtime-child",
    ];
    const allProductionPackagePaths = [
      ...requiredPackagePaths,
      "node_modules/runtime-beta",
    ];
    const host = await createPlatformHostV2(
      hostFixture,
      "valid",
      undefined,
      undefined,
      (invocation) => {
        addFakeInstalledPackagesV2(
          invocation.cwd,
          allProductionPackagePaths,
        );
      },
      (invocation, occurrence) => {
        materializeFakeProductionInstallV2(
          invocation.cwd,
        );
        addFakeInstalledPackagesV2(
          invocation.cwd,
          occurrence === 1
            ? allProductionPackagePaths
            : requiredPackagePaths,
        );
        return exited(
          `production closure occurrence ${occurrence}\n`,
        );
      },
    );
    const capsule =
      await materializePlatformReleaseBuildToolchainCapsuleV2ForTest({
        sourceStage: source,
        hostToolchain: host,
      });
    const compiledPair =
      await materializePlatformReleaseCompiledOutputPairV2ForTest({
        sourceStage: source,
        buildToolchain: capsule,
      });
    await assert.rejects(
      materializePlatformReleaseDependencyMaterializedPairForTestV2(
        compiledPair,
      ),
      {
        code:
          "PLATFORM_RELEASE_DEPENDENCY_PAIR_V2_EQUALITY_FAILED",
      },
    );
    assert.throws(
      () => disposePlatformReleaseSourceStageV2(source),
      {
        code:
          "PLATFORM_RELEASE_SOURCE_V2_HANDLE_DISPOSED",
      },
    );
  });

  it("rejects an undeclared installed package and terminally destroys the transaction", async () => {
    const repository = createRepositoryFixtureV2();
    const hostFixture = createHostFixtureV2();
    const source = admittedSourceV2(repository);
    let productionOccurrences = 0;
    const host = await createPlatformHostV2(
      hostFixture,
      "valid",
      undefined,
      undefined,
      undefined,
      (invocation) => {
        productionOccurrences += 1;
        materializeFakeProductionInstallV2(
          invocation.cwd,
        );
        const rogue = path.join(
          invocation.cwd,
          "node_modules",
          "rogue",
        );
        mkdirSync(rogue);
        writeFileSync(
          path.join(rogue, "package.json"),
          `${JSON.stringify({
            name: "rogue",
            version: "1.0.0",
          })}\n`,
        );
        return exited("hostile undeclared package installed\n");
      },
    );
    const capsule =
      await materializePlatformReleaseBuildToolchainCapsuleV2ForTest({
        sourceStage: source,
        hostToolchain: host,
      });
    const compiledPair =
      await materializePlatformReleaseCompiledOutputPairV2ForTest({
        sourceStage: source,
        buildToolchain: capsule,
      });
    await assert.rejects(
      materializePlatformReleaseDependencyMaterializedPairForTestV2(
        compiledPair,
      ),
      (error: unknown) => {
        assert.ok(
          error instanceof
            PlatformReleaseDependencyMaterializedPairErrorV2,
        );
        assert.equal(
          error.code,
          "PLATFORM_RELEASE_DEPENDENCY_PAIR_V2_INSTALL_TREE_INVALID",
        );
        assert.ok(
          error.cause instanceof
            PlatformReleaseProductionDependencyMaterializationErrorV2,
        );
        assert.equal(
          error.cause.code,
          "PLATFORM_RELEASE_PRODUCTION_DEPENDENCY_V2_INSTALL_TREE_INVALID",
        );
        return true;
      },
    );
    assert.equal(productionOccurrences, 1);
    assert.throws(
      () => disposePlatformReleaseSourceStageV2(source),
      {
        code:
          "PLATFORM_RELEASE_SOURCE_V2_HANDLE_DISPOSED",
      },
    );
  });

  it("fails closed when a reached runtime package declares an unauthenticated libc selector", async () => {
    const artifacts =
      sourceArtifactsWithProductionV2(["glibc"]);
    const repository =
      createRepositoryFixtureV2(artifacts);
    const hostFixture = createHostFixtureV2();
    const source = admittedSourceV2(repository);
    const productionPackagePaths = [
      "node_modules/runtime-alpha",
      "node_modules/runtime-beta",
      "node_modules/runtime-child",
    ];
    const host = await createPlatformHostV2(
      hostFixture,
      "valid",
      undefined,
      undefined,
      (invocation) => {
        addFakeInstalledPackagesV2(
          invocation.cwd,
          productionPackagePaths,
        );
      },
      (invocation) => {
        materializeFakeProductionInstallV2(
          invocation.cwd,
        );
        addFakeInstalledPackagesV2(
          invocation.cwd,
          productionPackagePaths,
        );
        return exited(
          "production closure with libc selector installed\n",
        );
      },
    );
    const capsule =
      await materializePlatformReleaseBuildToolchainCapsuleV2ForTest({
        sourceStage: source,
        hostToolchain: host,
      });
    const compiledPair =
      await materializePlatformReleaseCompiledOutputPairV2ForTest({
        sourceStage: source,
        buildToolchain: capsule,
      });
    await assert.rejects(
      materializePlatformReleaseDependencyMaterializedPairForTestV2(
        compiledPair,
      ),
      {
        code:
          "PLATFORM_RELEASE_DEPENDENCY_PAIR_V2_CLOSURE_INVALID",
      },
    );
    assert.throws(
      () => disposePlatformReleaseSourceStageV2(source),
      {
        code:
          "PLATFORM_RELEASE_SOURCE_V2_HANDLE_DISPOSED",
      },
    );
  });

  it("rejects a successful npm result that omits one required production dependency", async () => {
    const artifacts = sourceArtifactsWithProductionV2();
    const repository =
      createRepositoryFixtureV2(artifacts);
    const hostFixture = createHostFixtureV2();
    const source = admittedSourceV2(repository);
    const productionPackagePaths = [
      "node_modules/runtime-alpha",
      "node_modules/runtime-beta",
      "node_modules/runtime-child",
    ];
    const host = await createPlatformHostV2(
      hostFixture,
      "valid",
      undefined,
      undefined,
      (invocation) => {
        addFakeInstalledPackagesV2(
          invocation.cwd,
          productionPackagePaths,
        );
      },
      (invocation) => {
        materializeFakeProductionInstallV2(
          invocation.cwd,
        );
        return exited(
          "npm reported success without the required production closure\n",
        );
      },
    );
    const capsule =
      await materializePlatformReleaseBuildToolchainCapsuleV2ForTest({
        sourceStage: source,
        hostToolchain: host,
      });
    const compiledPair =
      await materializePlatformReleaseCompiledOutputPairV2ForTest({
        sourceStage: source,
        buildToolchain: capsule,
      });
    await assert.rejects(
      materializePlatformReleaseDependencyMaterializedPairForTestV2(
        compiledPair,
      ),
      (error: unknown) => {
        assert.ok(
          error instanceof
            PlatformReleaseDependencyMaterializedPairErrorV2,
        );
        assert.equal(
          error.code,
          "PLATFORM_RELEASE_DEPENDENCY_PAIR_V2_CLOSURE_INVALID",
        );
        assert.ok(
          error.cause instanceof
            PlatformReleaseProductionDependencyMaterializationErrorV2,
        );
        assert.equal(
          error.cause.code,
          "PLATFORM_RELEASE_PRODUCTION_DEPENDENCY_V2_CLOSURE_INVALID",
        );
        return true;
      },
    );
    assert.throws(
      () => disposePlatformReleaseSourceStageV2(source),
      {
        code:
          "PLATFORM_RELEASE_SOURCE_V2_HANDLE_DISPOSED",
      },
    );
  });

  it("fails closed when npm exposes a development-only lock entry in the runtime closure", async () => {
    const artifacts =
      sourceArtifactsWithProductionV2(
        undefined,
        true,
      );
    const repository =
      createRepositoryFixtureV2(artifacts);
    const hostFixture = createHostFixtureV2();
    const source = admittedSourceV2(repository);
    const productionPackagePaths = [
      "node_modules/runtime-alpha",
      "node_modules/runtime-beta",
      "node_modules/runtime-child",
    ];
    const host = await createPlatformHostV2(
      hostFixture,
      "valid",
      undefined,
      undefined,
      (invocation) => {
        addFakeInstalledPackagesV2(
          invocation.cwd,
          productionPackagePaths,
        );
      },
      (invocation) => {
        materializeFakeProductionInstallV2(
          invocation.cwd,
        );
        addFakeInstalledPackagesV2(
          invocation.cwd,
          productionPackagePaths,
        );
        return exited(
          "development-only runtime package exposed\n",
        );
      },
    );
    const capsule =
      await materializePlatformReleaseBuildToolchainCapsuleV2ForTest({
        sourceStage: source,
        hostToolchain: host,
      });
    const compiledPair =
      await materializePlatformReleaseCompiledOutputPairV2ForTest({
        sourceStage: source,
        buildToolchain: capsule,
      });
    await assert.rejects(
      materializePlatformReleaseDependencyMaterializedPairForTestV2(
        compiledPair,
      ),
      {
        code:
          "PLATFORM_RELEASE_DEPENDENCY_PAIR_V2_LOCK_INVALID",
      },
    );
    assert.throws(
      () => disposePlatformReleaseSourceStageV2(source),
      {
        code:
          "PLATFORM_RELEASE_SOURCE_V2_HANDLE_DISPOSED",
      },
    );
  });

  it("claims the compiled pair synchronously before the first production npm occurrence", async () => {
    const repository = createRepositoryFixtureV2();
    const hostFixture = createHostFixtureV2();
    const source = admittedSourceV2(repository);
    let dependencyPair:
      PlatformReleaseDependencyMaterializedPairV2
      | undefined;
    let releaseInstall!: () => void;
    const installWait = new Promise<void>((resolve) => {
      releaseInstall = resolve;
    });
    let markInstallEntered!: () => void;
    const installEntered = new Promise<void>((resolve) => {
      markInstallEntered = resolve;
    });
    const productionOccurrences: number[] = [];
    try {
      const host = await createPlatformHostV2(
        hostFixture,
        "valid",
        undefined,
        undefined,
        undefined,
        async (invocation, occurrence) => {
          productionOccurrences.push(occurrence);
          if (occurrence === 1) {
            markInstallEntered();
            await installWait;
          }
          return exited(
            `production occurrence ${occurrence}\n`,
          );
        },
      );
      const capsule =
        await materializePlatformReleaseBuildToolchainCapsuleV2ForTest({
          sourceStage: source,
          hostToolchain: host,
        });
      const compiledPair =
        await materializePlatformReleaseCompiledOutputPairV2ForTest({
          sourceStage: source,
          buildToolchain: capsule,
        });
      const first =
        materializePlatformReleaseDependencyMaterializedPairForTestV2(
          compiledPair,
        );
      await installEntered;
      await assert.rejects(
        materializePlatformReleaseDependencyMaterializedPairForTestV2(
          compiledPair,
        ),
        {
          code:
            "PLATFORM_RELEASE_DEPENDENCY_PAIR_V2_ALREADY_CLAIMED",
        },
      );
      assert.throws(
        () =>
          inspectPlatformReleaseCompiledOutputPairV2(
            compiledPair,
          ),
        {
          code:
            "PLATFORM_RELEASE_COMPILED_OUTPUT_PAIR_V2_SOURCE_DRIFT",
        },
      );
      releaseInstall();
      dependencyPair = await first;
      assert.deepEqual(
        productionOccurrences,
        [1, 2],
      );
      await revalidatePlatformReleaseDependencyMaterializedPairV2(
        dependencyPair,
      );
    } finally {
      releaseInstall?.();
      if (dependencyPair) {
        disposePlatformReleaseDependencyMaterializedPairV2(
          dependencyPair,
        );
      } else {
        try {
          disposePlatformReleaseSourceStageV2(source);
        } catch (error) {
          if (
            !(error instanceof
              PlatformReleaseSourceAdmissionErrorV2)
            || error.code
              !== "PLATFORM_RELEASE_SOURCE_V2_HANDLE_DISPOSED"
          ) throw error;
        }
      }
    }
  });

  it("normalizes stale compiled-pair revalidation while the dependency successor claims ownership", async () => {
    const repository = createRepositoryFixtureV2();
    const hostFixture = createHostFixtureV2();
    const source = admittedSourceV2(repository);
    let dependencyPair:
      PlatformReleaseDependencyMaterializedPairV2
      | undefined;
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
      const compiledPair =
        await materializePlatformReleaseCompiledOutputPairV2ForTest({
          sourceStage: source,
          buildToolchain: capsule,
        });
      const staleRevalidation =
        revalidatePlatformReleaseCompiledOutputPairV2(
          compiledPair,
        );
      const successor =
        materializePlatformReleaseDependencyMaterializedPairForTestV2(
          compiledPair,
        );
      await assert.rejects(
        staleRevalidation,
        {
          code:
            "PLATFORM_RELEASE_COMPILED_OUTPUT_PAIR_V2_SOURCE_DRIFT",
        },
      );
      dependencyPair = await successor;
      await revalidatePlatformReleaseDependencyMaterializedPairV2(
        dependencyPair,
      );
    } finally {
      if (dependencyPair) {
        disposePlatformReleaseDependencyMaterializedPairV2(
          dependencyPair,
        );
      } else {
        try {
          disposePlatformReleaseSourceStageV2(source);
        } catch (error) {
          if (
            !(error instanceof
              PlatformReleaseSourceAdmissionErrorV2)
            || error.code
              !== "PLATFORM_RELEASE_SOURCE_V2_HANDLE_DISPOSED"
          ) throw error;
        }
      }
    }
  });

  it("normalizes an in-flight dependency revalidation after synchronous disposal", async () => {
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
    const compiledPair =
      await materializePlatformReleaseCompiledOutputPairV2ForTest({
        sourceStage: source,
        buildToolchain: capsule,
      });
    const dependencyPair =
      await materializePlatformReleaseDependencyMaterializedPairForTestV2(
        compiledPair,
      );
    let firstOutputRoot = "";
    let secondOutputRoot = "";
    await withPlatformReleaseDependencyMaterializedPairForTestV2(
      dependencyPair,
      (outputRoots) => {
        firstOutputRoot = outputRoots.firstOutputRoot;
        secondOutputRoot = outputRoots.secondOutputRoot;
      },
    );
    const pending =
      revalidatePlatformReleaseDependencyMaterializedPairV2(
        dependencyPair,
      );
    disposePlatformReleaseDependencyMaterializedPairV2(
      dependencyPair,
    );
    await assert.rejects(
      pending,
      {
        code:
          "PLATFORM_RELEASE_DEPENDENCY_PAIR_V2_SOURCE_DRIFT",
      },
    );
    assert.equal(
      existsSync(path.dirname(firstOutputRoot)),
      false,
    );
    assert.equal(
      existsSync(path.dirname(secondOutputRoot)),
      false,
    );
  });

  it("gives one concurrent dependency revalidator destructive failure ownership", async () => {
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
    const compiledPair =
      await materializePlatformReleaseCompiledOutputPairV2ForTest({
        sourceStage: source,
        buildToolchain: capsule,
      });
    const dependencyPair =
      await materializePlatformReleaseDependencyMaterializedPairForTestV2(
        compiledPair,
      );
    let firstOutputRoot = "";
    let secondOutputRoot = "";
    await withPlatformReleaseDependencyMaterializedPairForTestV2(
      dependencyPair,
      (outputRoots) => {
        firstOutputRoot = outputRoots.firstOutputRoot;
        secondOutputRoot = outputRoots.secondOutputRoot;
      },
    );
    const firstPending =
      revalidatePlatformReleaseDependencyMaterializedPairV2(
        dependencyPair,
      );
    const secondPending =
      revalidatePlatformReleaseDependencyMaterializedPairV2(
        dependencyPair,
      );
    const firstDependencyRoot = path.join(
      firstOutputRoot,
      "payload",
      "node_modules",
    );
    chmodSync(firstDependencyRoot, 0o700);
    writeFileSync(
      path.join(firstDependencyRoot, "rogue.txt"),
      "concurrent dependency drift\n",
      { mode: 0o600 },
    );
    chmodSync(firstDependencyRoot, 0o555);
    const outcomes = await Promise.allSettled([
      firstPending,
      secondPending,
    ]);
    assert.equal(
      outcomes.every(
        (outcome) => outcome.status === "rejected",
      ),
      true,
    );
    const codes = outcomes.map((outcome) => {
      assert.equal(outcome.status, "rejected");
      const reason = (
        outcome as PromiseRejectedResult
      ).reason as {
        code?: string;
      };
      return reason.code;
    }).sort();
    assert.deepEqual(codes, [
      "PLATFORM_RELEASE_DEPENDENCY_PAIR_V2_AUTHORITY_MISMATCH",
      "PLATFORM_RELEASE_DEPENDENCY_PAIR_V2_SOURCE_DRIFT",
    ]);
    assert.equal(
      outcomes.some((outcome) =>
        outcome.status === "rejected"
        && errorMessagesV2(outcome.reason).some(
          (message) => /cleanup/i.test(message),
        )),
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
    assert.throws(
      () => disposePlatformReleaseSourceStageV2(source),
      {
        code:
          "PLATFORM_RELEASE_SOURCE_V2_HANDLE_DISPOSED",
      },
    );
  });

  it("detects mutation of the first sealed scratch tree while the second npm occurrence runs", async () => {
    const repository = createRepositoryFixtureV2();
    const hostFixture = createHostFixtureV2();
    const source = admittedSourceV2(repository);
    let firstProjectRoot = "";
    const host = await createPlatformHostV2(
      hostFixture,
      "valid",
      undefined,
      undefined,
      undefined,
      (invocation, occurrence) => {
        if (occurrence === 1) {
          firstProjectRoot = invocation.cwd;
        } else {
          const firstDependencyRoot = path.join(
            firstProjectRoot,
            "node_modules",
          );
          chmodSync(firstDependencyRoot, 0o700);
          writeFileSync(
            path.join(firstDependencyRoot, "raced.txt"),
            "first sealed scratch tree changed\n",
            { mode: 0o600 },
          );
          chmodSync(firstDependencyRoot, 0o555);
        }
        return exited(
          `production occurrence ${occurrence}\n`,
        );
      },
    );
    const capsule =
      await materializePlatformReleaseBuildToolchainCapsuleV2ForTest({
        sourceStage: source,
        hostToolchain: host,
      });
    const compiledPair =
      await materializePlatformReleaseCompiledOutputPairV2ForTest({
        sourceStage: source,
        buildToolchain: capsule,
      });
    await assert.rejects(
      materializePlatformReleaseDependencyMaterializedPairForTestV2(
        compiledPair,
      ),
      {
        code:
          "PLATFORM_RELEASE_DEPENDENCY_PAIR_V2_AUTHORITY_MISMATCH",
      },
    );
    assert.throws(
      () => disposePlatformReleaseSourceStageV2(source),
      {
        code:
          "PLATFORM_RELEASE_SOURCE_V2_HANDLE_DISPOSED",
      },
    );
  });

  it("rejects a same-byte production project replacement and preserves the untrusted subtree", async () => {
    const repository = createRepositoryFixtureV2();
    const hostFixture = createHostFixtureV2();
    const source = admittedSourceV2(repository);
    let sourceRoot = "";
    let firstOutputRoot = "";
    let secondOutputRoot = "";
    let environmentRoot = "";
    let installRoot = "";
    let replacementProjectRoot = "";
    let originalProjectRoot = "";
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
      undefined,
      (invocation, occurrence) => {
        if (occurrence === 1) {
          replacementProjectRoot = invocation.cwd;
          originalProjectRoot =
            `${replacementProjectRoot}-original`;
          environmentRoot = path.dirname(
            invocation.env.HOME!,
          );
          installRoot = path.dirname(
            replacementProjectRoot,
          );
          renameSync(
            replacementProjectRoot,
            originalProjectRoot,
          );
          mkdirSync(replacementProjectRoot, {
            mode: 0o700,
          });
          for (const name of [
            "package-lock.json",
            "package.json",
            "tsconfig.json",
          ]) {
            renameSync(
              path.join(originalProjectRoot, name),
              path.join(replacementProjectRoot, name),
            );
          }
          roots.push(installRoot);
        }
        return exited(
          `production occurrence ${occurrence}\n`,
        );
      },
    );
    const capsule =
      await materializePlatformReleaseBuildToolchainCapsuleV2ForTest({
        sourceStage: source,
        hostToolchain: host,
      });
    const compiledPair =
      await materializePlatformReleaseCompiledOutputPairV2ForTest({
        sourceStage: source,
        buildToolchain: capsule,
      });
    await withPlatformReleaseCompiledOutputPairForTestV2(
      compiledPair,
      (outputRoots) => {
        firstOutputRoot = outputRoots.firstOutputRoot;
        secondOutputRoot = outputRoots.secondOutputRoot;
      },
    );
    await assert.rejects(
      materializePlatformReleaseDependencyMaterializedPairForTestV2(
        compiledPair,
      ),
      (error: unknown) => {
        assert.ok(
          error instanceof
            PlatformReleaseDependencyMaterializedPairErrorV2,
        );
        assert.equal(
          error.code,
          "PLATFORM_RELEASE_DEPENDENCY_PAIR_V2_CLEANUP_FAILED",
        );
        const messages =
          errorMessagesV2(error).join("\n");
        assert.match(
          messages,
          /project is not one exact private every-and-only topology|scratch authority changed/,
        );
        assert.match(messages, /replaced or changed/);
        assert.doesNotMatch(
          messages,
          /already entered cleanup|cleanup was re-entered/,
        );
        const codes = errorCodesV2(error);
        assert.equal(
          codes.includes(
            "PLATFORM_RELEASE_DEPENDENCY_PAIR_V2_INSTALL_SCOPE_INVALID",
          ),
          true,
        );
        assert.equal(
          codes.includes(
            "PLATFORM_RELEASE_HOST_NODE_TOOLCHAIN_V2_PRODUCTION_INSTALL_SCOPE_INVALID",
          ),
          true,
        );
        assert.equal(
          codes.includes(
            "HOST_NODE_TOOLCHAIN_V2_RELEASE_DEPENDENCY_INSTALL_SCOPE_INVALID",
          ),
          true,
        );
        return true;
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
    assert.equal(
      existsSync(path.dirname(secondOutputRoot)),
      false,
    );
    assert.equal(existsSync(environmentRoot), false);
    assert.equal(existsSync(installRoot), true);
    assert.equal(
      existsSync(replacementProjectRoot),
      true,
    );
    assert.equal(existsSync(originalProjectRoot), true);
    assert.throws(
      () => disposePlatformReleaseSourceStageV2(source),
      {
        code:
          "PLATFORM_RELEASE_SOURCE_V2_HANDLE_DISPOSED",
      },
    );
  });

  it("terminally destroys the transaction when the first production install fails", async () => {
    const repository = createRepositoryFixtureV2();
    const hostFixture = createHostFixtureV2();
    const source = admittedSourceV2(repository);
    const productionOccurrences: number[] = [];
    const host = await createPlatformHostV2(
      hostFixture,
      "valid",
      undefined,
      undefined,
      undefined,
      (_invocation, occurrence) => {
        productionOccurrences.push(occurrence);
        return Object.freeze({
          status: "exited" as const,
          exitCode: 1,
          signal: null,
          stdout: "",
          stderr:
            "first authenticated production npm ci failed\n",
        });
      },
    );
    const capsule =
      await materializePlatformReleaseBuildToolchainCapsuleV2ForTest({
        sourceStage: source,
        hostToolchain: host,
      });
    const compiledPair =
      await materializePlatformReleaseCompiledOutputPairV2ForTest({
        sourceStage: source,
        buildToolchain: capsule,
      });
    await assert.rejects(
      materializePlatformReleaseDependencyMaterializedPairForTestV2(
        compiledPair,
      ),
      (error: unknown) => {
        assert.ok(
          error instanceof
            PlatformReleaseDependencyMaterializedPairErrorV2,
        );
        assert.equal(
          error.code,
          "PLATFORM_RELEASE_DEPENDENCY_PAIR_V2_INSTALL_FAILED",
        );
        assert.ok(
          error.cause instanceof
            PlatformReleaseHostNodeToolchainAuthorityErrorV2,
        );
        assert.equal(
          error.cause.code,
          "PLATFORM_RELEASE_HOST_NODE_TOOLCHAIN_V2_INSTALL_FAILED",
        );
        assert.ok(
          error.cause.cause instanceof
            HostNodeToolchainAuthorityErrorV2,
        );
        assert.equal(
          error.cause.cause.code,
          "HOST_NODE_TOOLCHAIN_V2_RELEASE_DEPENDENCY_INSTALL_NONZERO",
        );
        return true;
      },
    );
    assert.deepEqual(productionOccurrences, [1]);
    assert.throws(
      () => disposePlatformReleaseSourceStageV2(source),
      {
        code:
          "PLATFORM_RELEASE_SOURCE_V2_HANDLE_DISPOSED",
      },
    );
  });

  it("terminally destroys source, outputs and scratch after the second production install fails", async () => {
    const repository = createRepositoryFixtureV2();
    const hostFixture = createHostFixtureV2();
    const source = admittedSourceV2(repository);
    let sourceRoot = "";
    let firstOutputRoot = "";
    let secondOutputRoot = "";
    withPlatformReleaseSourceStageForTestV2(
      source,
      (root) => {
        sourceRoot = root;
      },
    );
    const productionOccurrences: number[] = [];
    const host = await createPlatformHostV2(
      hostFixture,
      "valid",
      undefined,
      undefined,
      undefined,
      (invocation, occurrence) => {
        productionOccurrences.push(occurrence);
        if (occurrence === 2) {
          return Object.freeze({
            status: "exited" as const,
            exitCode: 1,
            signal: null,
            stdout: "",
            stderr:
              "second authenticated production npm ci failed\n",
          });
        }
        return exited("first production closure installed\n");
      },
    );
    const capsule =
      await materializePlatformReleaseBuildToolchainCapsuleV2ForTest({
        sourceStage: source,
        hostToolchain: host,
      });
    const compiledPair =
      await materializePlatformReleaseCompiledOutputPairV2ForTest({
        sourceStage: source,
        buildToolchain: capsule,
      });
    await withPlatformReleaseCompiledOutputPairForTestV2(
      compiledPair,
      (outputRoots) => {
        firstOutputRoot = outputRoots.firstOutputRoot;
        secondOutputRoot = outputRoots.secondOutputRoot;
      },
    );
    await assert.rejects(
      materializePlatformReleaseDependencyMaterializedPairForTestV2(
        compiledPair,
      ),
      (error: unknown) => {
        assert.ok(
          error instanceof
            PlatformReleaseDependencyMaterializedPairErrorV2,
        );
        assert.equal(
          error.code,
          "PLATFORM_RELEASE_DEPENDENCY_PAIR_V2_INSTALL_FAILED",
        );
        assert.ok(
          error.cause instanceof
            PlatformReleaseHostNodeToolchainAuthorityErrorV2,
        );
        assert.equal(
          error.cause.code,
          "PLATFORM_RELEASE_HOST_NODE_TOOLCHAIN_V2_INSTALL_FAILED",
        );
        assert.ok(
          error.cause.cause instanceof
            HostNodeToolchainAuthorityErrorV2,
        );
        assert.equal(
          error.cause.cause.code,
          "HOST_NODE_TOOLCHAIN_V2_RELEASE_DEPENDENCY_INSTALL_NONZERO",
        );
        return true;
      },
    );
    assert.deepEqual(productionOccurrences, [1, 2]);
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
      revalidatePlatformReleaseCompiledOutputPairV2(
        compiledPair,
      ),
      {
        code:
          "PLATFORM_RELEASE_COMPILED_OUTPUT_PAIR_V2_SOURCE_DRIFT",
      },
    );
    assert.throws(
      () => disposePlatformReleaseSourceStageV2(source),
      {
        code:
          "PLATFORM_RELEASE_SOURCE_V2_HANDLE_DISPOSED",
      },
    );
  });

  it("rejects unsupported source dependency grammar before any npm occurrence", async () => {
    const artifacts = structuredClone(
      sourceArtifactsWithProductionV2(),
    ) as any;
    artifacts.packageJson.dependencies[
      "runtime-alpha"
    ] = "latest";
    artifacts.lock.packages[""].dependencies[
      "runtime-alpha"
    ] = "latest";
    const repository =
      createRepositoryFixtureV2(artifacts);
    const hostFixture = createHostFixtureV2();
    const source = admittedSourceV2(repository);
    let buildInstallOccurrences = 0;
    let productionInstallOccurrences = 0;
    const host = await createPlatformHostV2(
      hostFixture,
      "valid",
      undefined,
      undefined,
      () => {
        buildInstallOccurrences += 1;
      },
      () => {
        productionInstallOccurrences += 1;
        return undefined;
      },
    );
    await assert.rejects(
      materializePlatformReleaseBuildToolchainCapsuleV2ForTest({
        sourceStage: source,
        hostToolchain: host,
      }),
      (error: unknown) => {
        assert.ok(
          error instanceof
            PlatformReleaseBuildToolchainCapsuleErrorV2,
        );
        assert.equal(
          error.code,
          "PLATFORM_RELEASE_BUILD_TOOLCHAIN_CAPSULE_V2_TREE_INVALID",
        );
        assert.ok(
          error.cause instanceof
            PlatformReleaseBuildToolchainMaterializationErrorV2,
        );
        assert.equal(
          error.cause.code,
          "PLATFORM_RELEASE_BUILD_TOOLCHAIN_V2_LOCK_INVALID",
        );
        assert.match(
          errorMessagesV2(error).join("\n"),
          /unsafe package name or version spec/,
        );
        return true;
      },
    );
    assert.equal(buildInstallOccurrences, 0);
    assert.equal(productionInstallOccurrences, 0);
    assert.throws(
      () => disposePlatformReleaseSourceStageV2(source),
      {
        code:
          "PLATFORM_RELEASE_SOURCE_V2_HANDLE_DISPOSED",
      },
    );
  });
});
