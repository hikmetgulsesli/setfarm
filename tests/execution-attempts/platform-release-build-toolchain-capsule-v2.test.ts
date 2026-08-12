import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  chmodSync,
  chownSync,
  copyFileSync,
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
  unlinkSync,
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
  PlatformReleaseBootstrapInstalledMetadataOperationErrorV2,
  buildPlatformReleaseBootstrapInstalledMetadataOperationFixtureForTestV2,
  mutatePlatformReleaseBootstrapInstalledMetadataOperationFixtureForTestV2,
  observePlatformReleaseBootstrapInstalledMetadataOperationForTestV2,
} from
  "../../src/product-compiler/platform-release-bootstrap-installed-metadata-operation-test-support-v2.js";
import {
  PLATFORM_RELEASE_BOOTSTRAP_INSTALLED_NETWORK_NEGATIVE_EMPTY_SHA256_V2,
  PlatformReleaseBootstrapInstalledNetworkNegativeOperationErrorV2,
  observePlatformReleaseBootstrapInstalledNetworkNegativeEvidenceAtPrivateTargetInternalV2,
  observePlatformReleaseBootstrapInstalledNetworkNegativeOperationAtPrivateTargetInternalV2,
} from
  "../../src/product-compiler/platform-release-bootstrap-installed-network-negative-operation-test-support-v2.js";
import {
  createHostNodeToolchainAuthorityV2ForTest,
  hashHostNodePlatformReleaseOutputStageExactIdentityV2,
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
  PlatformReleaseCompositionModuleClosureForTestErrorV2,
  PlatformReleaseCompositionModuleExportsForTestErrorV2,
  PlatformReleaseCompositionMetadataPairForTestErrorV2,
  PlatformReleaseCompositionNetworkNegativePairForTestErrorV2,
  type PlatformReleaseCompositionOwnershipTransferFaultForTestV2,
  type PlatformReleaseDependencyMaterializationFaultForTestV2,
  PlatformReleaseDependencyMaterializedPairErrorV2,
  PlatformReleaseDependencyMaterializedPairV2,
  PlatformReleaseCompositionOwnershipTransferForTestV2,
  PlatformReleaseSourceAdmissionErrorV2,
  admitPlatformReleaseSourceV2ForTest,
  derivePlatformReleaseCompositionModuleClosureForTestV2,
  observePlatformReleaseCompositionModuleExportsForTestV2,
  observePlatformReleaseCompositionMetadataPairForTestV2,
  observePlatformReleaseCompositionNetworkNegativePairForTestV2,
  disposePlatformReleaseCompositionOwnershipTransferForTestV2,
  disposePlatformReleaseDependencyMaterializedPairV2,
  disposePlatformReleaseSourceStageV2,
  inspectPlatformReleaseCompiledOutputPairV2,
  inspectPlatformReleaseDependencyMaterializedPairV2,
  inspectPlatformReleaseCompositionOwnershipTransferForTestV2,
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
  rehearsePlatformReleaseCompositionOwnershipTransferForTestV2,
  rehearsePlatformReleaseCompositionOwnershipTransferWithFaultForTestV2,
  revalidatePlatformReleaseBuildToolchainCapsuleV2,
  withPlatformReleaseCompiledOutputPairForTestV2,
  withPlatformReleaseDependencyMaterializedPairForTestV2,
  withPlatformReleaseBuildToolchainCapsuleForTestV2,
  withPlatformReleaseSourceStageForTestV2,
} from
  "../../src/execution/platform-release-source-admission-v2.js";
import {
  inspectCompletedPlatformReleaseStageCandidateV2,
} from
  "../../src/execution/platform-release-terminal-writer-v2.js";
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
  hashPlatformReleaseCompositionModuleClosureForTestV2,
  hashPlatformReleaseCompositionModuleExportStableSetForTestV2,
  hashPlatformReleaseCompositionModuleExportsForTestV2,
  hashPlatformReleaseCompositionOwnershipTransferForTestV2,
  PlatformReleaseCompositionModuleClosureForTestV2Schema,
  PlatformReleaseCompositionModuleExportsForTestV2Schema,
  PlatformReleaseCompositionOwnershipTransferForTestV2Schema,
} from
  "../../src/execution/schemas/platform-release-composition-test-v2.js";
import {
  PlatformReleaseCompositionMetadataPairTestV2Schema,
  PlatformReleaseCompositionMetadataTestV2Schema,
  hashPlatformReleaseCompositionMetadataPairForTestV2,
  hashPlatformReleaseCompositionMetadataPairOccurrenceForTestV2,
  hashPlatformReleaseCompositionMetadataPairStableProjectionForTestV2,
  hashPlatformReleaseCompositionMetadataFixedArgvForTestV2,
  hashPlatformReleaseCompositionMetadataLaunchProjectionForTestV2,
  hashPlatformReleaseCompositionMetadataProcessObservationForTestV2,
  hashPlatformReleaseCompositionMetadataForTestV2,
} from
  "../../src/execution/schemas/platform-release-composition-metadata-test-v2.js";
import {
  PlatformReleaseCompositionNetworkNegativePairOccurrenceForTestV2Schema,
  PlatformReleaseCompositionNetworkNegativePairTestV2Schema,
  PlatformReleaseCompositionNetworkNegativeTestV2Schema,
  hashPlatformReleaseCompositionNetworkNegativeFixedArgvForTestV2,
  hashPlatformReleaseCompositionNetworkNegativeLaunchProjectionForTestV2,
  hashPlatformReleaseCompositionNetworkNegativePairForTestV2,
  hashPlatformReleaseCompositionNetworkNegativePairOccurrenceForTestV2,
  hashPlatformReleaseCompositionNetworkNegativePairStableProjectionForTestV2,
  hashPlatformReleaseCompositionNetworkNegativeProcessObservationForTestV2,
  hashPlatformReleaseCompositionNetworkNegativeForTestV2,
  hashPlatformReleaseCompositionNetworkNegativeTargetObservationForTestV2,
} from
  "../../src/execution/schemas/platform-release-composition-network-negative-test-v2.js";
import {
  getPlatformReleaseRequiredModuleRequirementV2,
} from
  "../../src/execution/schemas/platform-release-required-module-closure-v2.js";
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
import {
  materializePlatformReleaseHostCompositionFixtureV2,
} from
  "./helpers/platform-release-host-composition-fixture-v2.js";
import type {
  PlatformReleaseHostCompositionFixtureV2,
} from
  "../../src/execution/platform-release-host-composition-authority-v2.js";

const GIT = "/usr/bin/git";
const REQUIRED_MODULE_BUILD_FIXTURE_V2 =
  ".setfarm-required-modules-fixture-v2.json";
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
  compositionFixture:
    PlatformReleaseHostCompositionFixtureV2;
  compositionFiles: Readonly<Record<string, string>>;
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

function enableRequiredModuleBuildFixtureV2(
  fixture: RepositoryFixtureV2,
  fixtureLabel = "stable",
  wrongExport?: Readonly<{
    moduleLocator: string;
    name: string;
    actualKind: "function" | "string";
  }>,
  modulePreamble?: string,
): RepositoryFixtureV2 {
  writeFileSync(
    path.join(
      fixture.repository,
      REQUIRED_MODULE_BUILD_FIXTURE_V2,
    ),
    `${JSON.stringify({
      fixtureLabel,
      ...(wrongExport === undefined
        ? {}
        : { wrongExport }),
      ...(modulePreamble === undefined
        ? {}
        : { modulePreamble }),
      definitions:
        getPlatformReleaseRequiredModuleRequirementV2()
          .entries.map((definition) => ({
            moduleLocator: definition.moduleLocator,
            requiredExports: definition.requiredExports,
          })),
    })}\n`,
  );
  runGit(fixture.repository, ["add", "--all"]);
  runGit(fixture.repository, [
    "commit",
    "-m",
    `required module fixture ${fixtureLabel}`,
  ]);
  runGit(fixture.repository, ["push", "origin", "main"]);
  return fixture;
}

function createHostFixtureV2(
  options: Readonly<{
    operationalMetadataObserverWrappers?: boolean;
    operationalNetworkSandboxWrapper?: boolean;
  }> = {},
): HostFixtureV2 {
  const root = realpathSync(mkdtempSync(path.join(
    tmpdir(),
    "setfarm-platform-build-toolchain-host-v2-",
  )));
  roots.push(root);
  const composition =
    materializePlatformReleaseHostCompositionFixtureV2(
      "setfarm-platform-build-composition-v2-",
      options,
    );
  roots.push(composition.root);
  const node = path.join(root, "bin", "node");
  const npmRoot =
    path.join(root, "lib", "node_modules", "npm");
  const npmCli = path.join(npmRoot, "bin", "npm-cli.js");
  const sourceNodeRoot = path.resolve(
    path.dirname(realpathSync(process.execPath)),
    "..",
  );
  const sourceDynamicLibraryNames = readdirSync(
    path.join(sourceNodeRoot, "lib"),
  ).filter((name) => /^libnode(?:\.\d+)?\.dylib$/.test(name));
  if (sourceDynamicLibraryNames.length !== 1) {
    throw new Error(
      "Expected exactly one host libnode dylib beside the test Node executable",
    );
  }
  const dynamicLibrary =
    path.join(root, "lib", sourceDynamicLibraryNames[0]!);
  mkdirSync(path.dirname(node), { recursive: true });
  mkdirSync(path.dirname(npmCli), { recursive: true });
  mkdirSync(path.join(npmRoot, "lib"), {
    recursive: true,
  });
  copyFileSync(process.execPath, node);
  copyFileSync(
    path.join(
      sourceNodeRoot,
      "lib",
      sourceDynamicLibraryNames[0]!,
    ),
    dynamicLibrary,
  );
  if (
    typeof process.getuid === "function"
    && typeof process.getgid === "function"
  ) {
    chownSync(node, process.getuid(), process.getgid());
    chownSync(
      dynamicLibrary,
      process.getuid(),
      process.getgid(),
    );
  }
  chmodSync(node, 0o555);
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
    compositionFixture: composition.fixture,
    compositionFiles: composition.files,
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
      `const fixturePath = path.join(process.cwd(), ${JSON.stringify(REQUIRED_MODULE_BUILD_FIXTURE_V2)});`,
      "if (fs.existsSync(fixturePath)) {",
      "  const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));",
      "  for (const definition of fixture.definitions) {",
      "    if (!definition.moduleLocator.startsWith('dist/')) process.exit(3);",
      "    const target = path.join(root, definition.moduleLocator.slice('dist/'.length));",
      "    fs.mkdirSync(path.dirname(target), { recursive: true });",
      "    const lines = definition.requiredExports.map((entry) => { const kind = fixture.wrongExport && fixture.wrongExport.moduleLocator === definition.moduleLocator && fixture.wrongExport.name === entry.name ? fixture.wrongExport.actualKind : entry.kind; return kind === 'function' ? 'export function ' + entry.name + '() { return undefined; }' : 'export const ' + entry.name + ' = ' + JSON.stringify('fixture:' + fixture.fixtureLabel + ':' + entry.name) + ';'; });",
      "    fs.writeFileSync(target, (fixture.modulePreamble || '') + lines.join('\\n') + '\\n');",
      "  }",
      "}",
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
    compositionFixture: fixture.compositionFixture,
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

describe("installed platform-release metadata operation", () => {
  it("observes a real Darwin target with strict non-promotable read-only evidence", async () => {
    const hostFixture = createHostFixtureV2({
      operationalMetadataObserverWrappers: true,
    });
    const host = await createPlatformHostV2(
      hostFixture,
      "valid",
    );
    const fixture =
      buildPlatformReleaseBootstrapInstalledMetadataOperationFixtureForTestV2();
    let disposed = false;
    try {
      const evidence =
        await observePlatformReleaseBootstrapInstalledMetadataOperationForTestV2(
          host,
          fixture,
        );

      assert.deepEqual(
        PlatformReleaseCompositionMetadataTestV2Schema.parse(evidence),
        evidence,
      );
      assert.equal(Object.isFrozen(evidence), true);
      assert.equal(Object.isFrozen(evidence.targetBefore), true);
      assert.equal(evidence.admissionScope, "test_fixture");
      assert.equal(evidence.productionAuthority, false);
      assert.equal(evidence.productionAdmission, "forbidden");
      assert.equal(evidence.credentialUse, "none");
      assert.equal(evidence.mutationAuthority, false);
      assert.equal(evidence.trustConclusion, "characterization_only");
      assert.equal(
        evidence.receipt.observationOutcome,
        "metadata_policy_satisfied",
      );
      assert.equal(evidence.receipt.observedEntryCount, 1);
      assert.deepEqual(evidence.targetAfter, evidence.targetBefore);
      assert.equal(
        evidence.targetRootPhysicalIdentityHash,
        evidence.receipt.targetRootPhysicalIdentityHash,
      );
      assert.equal(
        hashPlatformReleaseCompositionMetadataForTestV2(evidence),
        evidence.evidenceHash,
      );
      assert.doesNotMatch(
        JSON.stringify(evidence),
        /(?:clear|\/tmp\/|\/private\/|\/Users\/)/u,
      );

      const promoted = structuredClone(evidence) as any;
      promoted.productionAuthority = true;
      promoted.evidenceHash =
        hashPlatformReleaseCompositionMetadataForTestV2(promoted);
      assert.equal(
        PlatformReleaseCompositionMetadataTestV2Schema
          .safeParse(promoted).success,
        false,
      );

      fixture.dispose();
      disposed = true;
      await assert.rejects(
        observePlatformReleaseBootstrapInstalledMetadataOperationForTestV2(
          host,
          fixture,
        ),
        {
          code:
            "INSTALLED_METADATA_OPERATION_FIXTURE_HANDLE_UNAUTHENTICATED",
        },
      );
    } finally {
      if (!disposed) fixture.dispose();
    }
  });

  it("keeps stable host-object identity across fresh metadata occurrences", async () => {
    const hostFixture = createHostFixtureV2({
      operationalMetadataObserverWrappers: true,
    });
    const host = await createPlatformHostV2(
      hostFixture,
      "valid",
    );
    const fixture =
      buildPlatformReleaseBootstrapInstalledMetadataOperationFixtureForTestV2();
    try {
      const first =
        await observePlatformReleaseBootstrapInstalledMetadataOperationForTestV2(
          host,
          fixture,
        );
      const repeated =
        await observePlatformReleaseBootstrapInstalledMetadataOperationForTestV2(
          host,
          fixture,
        );

      assert.deepEqual(
        repeated.targetBefore.stableIdentity,
        first.targetBefore.stableIdentity,
      );
      assert.deepEqual(
        repeated.targetBefore.mutableFingerprint,
        first.targetBefore.mutableFingerprint,
      );
      assert.equal(
        repeated.targetRootPhysicalIdentityHash,
        first.targetRootPhysicalIdentityHash,
      );
      assert.notEqual(repeated.occurrenceId, first.occurrenceId);
      assert.notEqual(
        repeated.receipt.messageHash,
        first.receipt.messageHash,
      );
      assert.notEqual(repeated.process.pid, first.process.pid);
      assert.notEqual(repeated.evidenceHash, first.evidenceHash);
    } finally {
      fixture.dispose();
    }
  });

  it("rejects direct-entry and same-byte identity drift before metadata execution", async () => {
    const hostFixture = createHostFixtureV2({
      operationalMetadataObserverWrappers: true,
    });
    const host = await createPlatformHostV2(
      hostFixture,
      "valid",
    );
    for (const mutation of [
      "add_target_entry",
      "replace_entry_same_bytes",
    ] as const) {
      const fixture =
        buildPlatformReleaseBootstrapInstalledMetadataOperationFixtureForTestV2();
      let disposed = false;
      try {
        mutatePlatformReleaseBootstrapInstalledMetadataOperationFixtureForTestV2(
          fixture,
          mutation,
        );
        await assert.rejects(
          observePlatformReleaseBootstrapInstalledMetadataOperationForTestV2(
            host,
            fixture,
          ),
          (error: unknown) => {
            assert.ok(
              error instanceof
                PlatformReleaseBootstrapInstalledMetadataOperationErrorV2,
            );
            assert.equal(
              error.code,
              "INSTALLED_METADATA_OPERATION_FIXTURE_HANDLE_UNAUTHENTICATED",
            );
            return true;
          },
        );
        fixture.dispose();
        disposed = true;
        assert.throws(
          () => fixture.dispose(),
          {
            code:
              "INSTALLED_METADATA_OPERATION_FIXTURE_HANDLE_UNAUTHENTICATED",
          },
        );
      } finally {
        if (!disposed) fixture.dispose();
      }
    }
  });

  it("authenticates the child rejection for unauthorized target metadata", async () => {
    const hostFixture = createHostFixtureV2({
      operationalMetadataObserverWrappers: true,
    });
    const host = await createPlatformHostV2(
      hostFixture,
      "valid",
    );
    const fixture =
      buildPlatformReleaseBootstrapInstalledMetadataOperationFixtureForTestV2();
    try {
      mutatePlatformReleaseBootstrapInstalledMetadataOperationFixtureForTestV2(
        fixture,
        "add_target_xattr",
      );
      await assert.rejects(
        observePlatformReleaseBootstrapInstalledMetadataOperationForTestV2(
          host,
          fixture,
        ),
        (error: unknown) => {
          assert.ok(
            error instanceof
              PlatformReleaseBootstrapInstalledMetadataOperationErrorV2,
          );
          assert.equal(
            error.code,
            "INSTALLED_METADATA_OPERATION_OPERATION_REJECTED",
          );
          return true;
        },
      );
    } finally {
      fixture.dispose();
    }
  });

  it("preserves an authenticated child authority-drift classification", async () => {
    const hostFixture = createHostFixtureV2({
      operationalMetadataObserverWrappers: true,
    });
    const releaseBootstrap =
      hostFixture.compositionFiles["bin/release-bootstrap"]!;
    chmodSync(releaseBootstrap, 0o755);
    writeFileSync(releaseBootstrap, [
      "const { createHash } = require('node:crypto');",
      "const { readFileSync } = require('node:fs');",
      "const canonical = (value) => {",
      "  if (value === null || typeof value !== 'object') return JSON.stringify(value);",
      "  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';",
      "  return '{' + Object.keys(value).sort().map((key) => JSON.stringify(key) + ':' + canonical(value[key])).join(',') + '}';",
      "};",
      "const hash = (value) => createHash('sha256').update(canonical(value), 'utf8').digest('hex');",
      "const input = JSON.parse(readFileSync(3, 'utf8'));",
      "const identity = {",
      "  schema: 'setfarm.platform-release-bootstrap-operation-failure.v2',",
      "  version: '2.0.0',",
      "  occurrenceId: input.occurrenceId,",
      "  operationAbiRef: 'ABI_PLATFORM_RELEASE_METADATA_PROBE_V2',",
      "  errorCode: 'AUTHORITY_DRIFT',",
      "  phaseRef: 'METADATA_PROBE_FILESYSTEM_FENCE_V2',",
      "  retryDisposition: 'retry_after_authority_delta',",
      "  authorityStateHash: input.hostCompositionReceiptHash,",
      "  diagnosticHash: hash({ schema: 'setfarm.platform-release-metadata-probe-diagnostic-hash.v2', diagnosticRef: 'METADATA_PROBE_FILESYSTEM_DRIFT' }),",
      "};",
      "const messageHash = hash({ schema: 'setfarm.platform-release-bootstrap-wire-message-hash.v2', schemaRef: identity.schema, message: identity });",
      "process.stdout.write(canonical({ ...identity, messageHash }) + '\\n');",
      "process.exitCode = 1;",
      "",
    ].join("\n"));
    chmodSync(releaseBootstrap, 0o555);
    const host = await createPlatformHostV2(
      hostFixture,
      "valid",
    );
    const fixture =
      buildPlatformReleaseBootstrapInstalledMetadataOperationFixtureForTestV2();
    try {
      await assert.rejects(
        observePlatformReleaseBootstrapInstalledMetadataOperationForTestV2(
          host,
          fixture,
        ),
        {
          code:
            "INSTALLED_METADATA_OPERATION_FILESYSTEM_DRIFT",
        },
      );
    } finally {
      fixture.dispose();
    }
  });
});

describe("installed platform-release network-negative operation", () => {
  it("rejects a caller-held terminal symlink at the target fence", {
    skip: process.platform !== "darwin",
  }, async () => {
    const hostFixture = createHostFixtureV2({
      operationalNetworkSandboxWrapper: true,
    });
    const host = await createPlatformHostV2(hostFixture, "valid");
    const targetRoot = mkdtempSync(path.join(
      tmpdir(),
      "setfarm-network-negative-symlink-target-v2-",
    ));
    const aliasParent = mkdtempSync(path.join(
      tmpdir(),
      "setfarm-network-negative-symlink-alias-v2-",
    ));
    roots.push(targetRoot, aliasParent);
    const alias = path.join(aliasParent, "target");
    symlinkSync(targetRoot, alias);

    await assert.rejects(
      observePlatformReleaseBootstrapInstalledNetworkNegativeOperationAtPrivateTargetInternalV2(
        host,
        alias,
      ),
      (error: unknown) => {
        assert.ok(
          error instanceof
            PlatformReleaseBootstrapInstalledNetworkNegativeOperationErrorV2,
        );
        assert.equal(
          error.code,
          "INSTALLED_NETWORK_NEGATIVE_OPERATION_FILESYSTEM_DRIFT",
        );
        return true;
      },
    );
  });

  it("executes the installed test-only sandbox ABI against an authentic output root", {
    skip: process.platform !== "darwin",
  }, async () => {
    const repository = createRepositoryFixtureV2();
    const hostFixture = createHostFixtureV2({
      operationalNetworkSandboxWrapper: true,
    });
    const source = admittedSourceV2(repository);
    let dependencyPair:
      PlatformReleaseDependencyMaterializedPairV2
      | undefined;
    try {
      const host = await createPlatformHostV2(hostFixture, "valid");
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

      const occurrence =
        await withPlatformReleaseDependencyMaterializedPairForTestV2(
          dependencyPair,
          ({ firstOutputRoot }) =>
            observePlatformReleaseBootstrapInstalledNetworkNegativeEvidenceAtPrivateTargetInternalV2(
              host,
              firstOutputRoot,
            ),
        );

      assert.deepEqual(
        PlatformReleaseCompositionNetworkNegativeTestV2Schema.parse(
          occurrence,
        ),
        occurrence,
      );
      assert.equal(Object.isFrozen(occurrence), true);
      assert.equal(occurrence.admissionScope, "test_fixture");
      assert.equal(occurrence.productionAuthority, false);
      assert.equal(occurrence.productionAdmission, "forbidden");
      assert.equal(occurrence.credentialUse, "none");
      assert.equal(occurrence.mutationAuthority, false);
      assert.equal(occurrence.trustConclusion, "characterization_only");
      assert.equal(
        hashPlatformReleaseCompositionNetworkNegativeForTestV2(
          occurrence,
        ),
        occurrence.evidenceHash,
      );
      assert.equal(occurrence.receipt.probeOutcome, "all_denied");
      assert.equal(
        occurrence.receipt.controlOutcome,
        "loopback_and_redirect_observed",
      );
      assert.equal(occurrence.receipt.attemptedProbeCount, 1);
      assert.equal(occurrence.receipt.deniedProbeCount, 1);
      assert.equal(
        occurrence.receipt.occurrenceId,
        occurrence.occurrenceId,
      );
      assert.equal(
        occurrence.receipt.hostIdentityHash,
        occurrence.hostIdentityHash,
      );
      assert.equal(
        occurrence.receipt.targetRootPhysicalIdentityHash,
        occurrence.targetRootPhysicalIdentityHash,
      );
      assert.equal(
        occurrence.receipt.hostCompositionReceiptHash,
        occurrence.hostCompositionReceiptHash,
      );
      assert.equal(
        occurrence.receipt.sandboxPolicyHash,
        occurrence.sandboxPolicyHash,
      );
      assert.deepEqual(occurrence.targetAfter, occurrence.targetBefore);
      assert.equal(occurrence.process.status, "exited");
      assert.equal(occurrence.process.exitCode, 0);
      assert.equal(occurrence.process.signal, null);
      assert.equal(
        occurrence.process.environmentPolicy,
        "exact_empty_environment_v2",
      );
      assert.equal(occurrence.process.shell, false);
      assert.equal(occurrence.process.stderrByteLength, 0);
      assert.equal(
        occurrence.process.stderrHash,
        PLATFORM_RELEASE_BOOTSTRAP_INSTALLED_NETWORK_NEGATIVE_EMPTY_SHA256_V2,
      );
      assert.doesNotMatch(
        JSON.stringify(occurrence),
        /(?:clear|\/tmp\/|\/private\/|\/Users\/)/u,
      );
      const promoted = structuredClone(occurrence) as any;
      promoted.productionAuthority = true;
      promoted.evidenceHash =
        hashPlatformReleaseCompositionNetworkNegativeForTestV2(
          promoted,
        );
      assert.equal(
        PlatformReleaseCompositionNetworkNegativeTestV2Schema
          .safeParse(promoted).success,
        false,
      );
      assert.equal(
        existsSync(path.join(
          "/private/tmp",
          `setfarm-installed-network-negative-operation-v2-${occurrence.occurrenceId}`,
        )),
        false,
      );
      await revalidatePlatformReleaseDependencyMaterializedPairV2(
        dependencyPair,
      );
    } finally {
      if (dependencyPair !== undefined) {
        disposePlatformReleaseDependencyMaterializedPairV2(dependencyPair);
      } else {
        disposePlatformReleaseSourceStageV2(source);
      }
    }
  });

  it("observes two strict network-negative occurrences under one exclusive pair lease", {
    skip: process.platform !== "darwin",
  }, async () => {
    const repository = createRepositoryFixtureV2();
    const hostFixture = createHostFixtureV2({
      operationalNetworkSandboxWrapper: true,
    });
    const source = admittedSourceV2(repository);
    let dependencyPair:
      PlatformReleaseDependencyMaterializedPairV2
      | undefined;
    try {
      const host = await createPlatformHostV2(hostFixture, "valid");
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

      await assert.rejects(
        observePlatformReleaseCompositionNetworkNegativePairForTestV2({
          dependencyPair,
          targetRoot: "/tmp/caller-selected-target",
        } as never),
        {
          code:
            "PLATFORM_RELEASE_COMPOSITION_NETWORK_NEGATIVE_PAIR_TEST_V2_INPUT_INVALID",
        },
      );
      await assert.rejects(
        observePlatformReleaseCompositionNetworkNegativePairForTestV2(
          "/tmp/caller-selected-target" as never,
        ),
        {
          code:
            "PLATFORM_RELEASE_COMPOSITION_NETWORK_NEGATIVE_PAIR_TEST_V2_INPUT_INVALID",
        },
      );
      await assert.rejects(
        observePlatformReleaseCompositionNetworkNegativePairForTestV2(
          new Proxy(dependencyPair, {}) as never,
        ),
        (error: unknown) => {
          assert.ok(
            error instanceof
              PlatformReleaseCompositionNetworkNegativePairForTestErrorV2,
          );
          assert.equal(
            error.code,
            "PLATFORM_RELEASE_COMPOSITION_NETWORK_NEGATIVE_PAIR_TEST_V2_INPUT_INVALID",
          );
          return true;
        },
      );

      let releaseRootCallback!: () => void;
      let markRootCallbackEntered!: () => void;
      const rootCallbackEntered = new Promise<void>((resolve) => {
        markRootCallbackEntered = resolve;
      });
      const releaseRootCallbackPromise =
        new Promise<void>((resolve) => {
          releaseRootCallback = resolve;
        });
      const heldRootCallback =
        withPlatformReleaseDependencyMaterializedPairForTestV2(
          dependencyPair,
          async () => {
            markRootCallbackEntered();
            await releaseRootCallbackPromise;
          },
        );
      await rootCallbackEntered;
      await assert.rejects(
        observePlatformReleaseCompositionNetworkNegativePairForTestV2(
          dependencyPair,
        ),
        {
          code:
            "PLATFORM_RELEASE_COMPOSITION_NETWORK_NEGATIVE_PAIR_TEST_V2_ALREADY_CLAIMED",
        },
      );
      releaseRootCallback();
      await heldRootCallback;

      const first =
        await observePlatformReleaseCompositionNetworkNegativePairForTestV2(
          dependencyPair,
        );
      const second =
        await observePlatformReleaseCompositionNetworkNegativePairForTestV2(
          dependencyPair,
        );
      for (const evidence of [first, second]) {
        assert.deepEqual(
          PlatformReleaseCompositionNetworkNegativePairTestV2Schema
            .parse(evidence),
          evidence,
        );
        assert.equal(Object.isFrozen(evidence), true);
        assert.equal(Object.isFrozen(evidence.occurrences), true);
        assert.equal(
          Object.isFrozen(evidence.occurrences[0].receipt),
          true,
        );
        assert.equal(evidence.productionAuthority, false);
        assert.equal(evidence.productionAdmission, "forbidden");
        assert.equal(evidence.mutationAuthority, false);
        assert.equal(evidence.callerJsonState, "absent");
        assert.equal(evidence.callerLocatorState, "absent");
        assert.equal(
          evidence.occurrences[0].stageRef,
          "PLATFORM_RELEASE_DEPENDENCY_STAGE_FIRST_V2",
        );
        assert.equal(
          evidence.occurrences[1].stageRef,
          "PLATFORM_RELEASE_DEPENDENCY_STAGE_SECOND_V2",
        );
        assert.equal(
          evidence.stableProjectionHash,
          evidence.occurrences[0].stableProjectionHash,
        );
        assert.equal(
          evidence.occurrences[0].stableProjectionHash,
          evidence.occurrences[1].stableProjectionHash,
        );
        assert.equal(
          evidence.occurrences[0].launchProjectionHash,
          evidence.occurrences[1].launchProjectionHash,
        );
        assert.equal(
          evidence.occurrences[0].receipt.stableNetworkProjectionHash,
          evidence.occurrences[1].receipt.stableNetworkProjectionHash,
        );
        assert.notEqual(
          evidence.occurrences[0].outputStagePhysicalIdentityHash,
          evidence.occurrences[1].outputStagePhysicalIdentityHash,
        );
        assert.notEqual(
          evidence.occurrences[0].targetRootPhysicalIdentityHash,
          evidence.occurrences[1].targetRootPhysicalIdentityHash,
        );
        assert.notEqual(
          evidence.occurrences[0].targetBefore.observationHash,
          evidence.occurrences[1].targetBefore.observationHash,
        );
        assert.notEqual(
          evidence.occurrences[0].occurrenceId,
          evidence.occurrences[1].occurrenceId,
        );
        assert.notEqual(
          evidence.occurrences[0].process.processObservationHash,
          evidence.occurrences[1].process.processObservationHash,
        );
        assert.notEqual(
          evidence.occurrences[0].receipt.messageHash,
          evidence.occurrences[1].receipt.messageHash,
        );
        assert.notEqual(
          evidence.occurrences[0].receipt.networkObservationHash,
          evidence.occurrences[1].receipt.networkObservationHash,
        );
        assert.notEqual(
          evidence.occurrences[0].occurrenceHash,
          evidence.occurrences[1].occurrenceHash,
        );
        assert.equal(
          hashPlatformReleaseCompositionNetworkNegativePairForTestV2(
            evidence,
          ),
          evidence.collectionHash,
        );
        assert.doesNotMatch(
          JSON.stringify(evidence),
          /\/tmp\/|\/private\/|\/var\/folders\/|\/Users\/|setfarm-platform-compiled-output/,
        );
      }
      assert.equal(
        first.stableProjectionHash,
        second.stableProjectionHash,
      );
      assert.equal(
        first.occurrences[0].targetRootPhysicalIdentityHash,
        second.occurrences[0].targetRootPhysicalIdentityHash,
      );
      assert.equal(
        first.occurrences[1].targetRootPhysicalIdentityHash,
        second.occurrences[1].targetRootPhysicalIdentityHash,
      );
      for (const index of [0, 1] as const) {
        assert.notEqual(
          first.occurrences[index].occurrenceId,
          second.occurrences[index].occurrenceId,
        );
        assert.notEqual(
          first.occurrences[index].process.processObservationHash,
          second.occurrences[index].process.processObservationHash,
        );
        assert.notEqual(
          first.occurrences[index].receipt.messageHash,
          second.occurrences[index].receipt.messageHash,
        );
        assert.notEqual(
          first.occurrences[index].receipt.networkObservationHash,
          second.occurrences[index].receipt.networkObservationHash,
        );
        assert.notEqual(
          first.occurrences[index].occurrenceHash,
          second.occurrences[index].occurrenceHash,
        );
      }
      assert.notEqual(first.collectionHash, second.collectionHash);

      const swapped = structuredClone(first) as any;
      swapped.occurrences.reverse();
      swapped.occurrences[0].stageRef =
        "PLATFORM_RELEASE_DEPENDENCY_STAGE_FIRST_V2";
      swapped.occurrences[1].stageRef =
        "PLATFORM_RELEASE_DEPENDENCY_STAGE_SECOND_V2";
      for (const occurrence of swapped.occurrences) {
        occurrence.occurrenceHash =
          hashPlatformReleaseCompositionNetworkNegativePairOccurrenceForTestV2(
            occurrence,
          );
      }
      swapped.collectionHash =
        hashPlatformReleaseCompositionNetworkNegativePairForTestV2(
          swapped,
        );
      assert.equal(
        PlatformReleaseCompositionNetworkNegativePairTestV2Schema
          .safeParse(swapped).success,
        false,
      );

      const aliased = structuredClone(first) as any;
      aliased.occurrences[1] = structuredClone(
        aliased.occurrences[0],
      );
      aliased.occurrences[1].stageRef =
        "PLATFORM_RELEASE_DEPENDENCY_STAGE_SECOND_V2";
      aliased.occurrences[1].occurrenceHash =
        hashPlatformReleaseCompositionNetworkNegativePairOccurrenceForTestV2(
          aliased.occurrences[1],
        );
      aliased.collectionHash =
        hashPlatformReleaseCompositionNetworkNegativePairForTestV2(
          aliased,
        );
      assert.equal(
        PlatformReleaseCompositionNetworkNegativePairTestV2Schema
          .safeParse(aliased).success,
        false,
      );

      const widenedTargetLayout = structuredClone(first) as any;
      const widenedOccurrence = widenedTargetLayout.occurrences[0];
      widenedOccurrence.targetBefore.mutableFingerprint
        .directEntryNamesHash = "a".repeat(64);
      widenedOccurrence.targetBefore.observationHash =
        hashPlatformReleaseCompositionNetworkNegativeTargetObservationForTestV2({
          stableIdentity: widenedOccurrence.targetBefore.stableIdentity,
          mutableFingerprint:
            widenedOccurrence.targetBefore.mutableFingerprint,
        });
      widenedOccurrence.targetAfter = structuredClone(
        widenedOccurrence.targetBefore,
      );
      widenedOccurrence.occurrenceHash =
        hashPlatformReleaseCompositionNetworkNegativePairOccurrenceForTestV2(
          widenedOccurrence,
        );
      widenedTargetLayout.collectionHash =
        hashPlatformReleaseCompositionNetworkNegativePairForTestV2(
          widenedTargetLayout,
        );
      assert.equal(
        PlatformReleaseCompositionNetworkNegativePairTestV2Schema
          .safeParse(widenedTargetLayout).success,
        false,
      );

      const detachedLaunch = structuredClone(first) as any;
      const detachedLaunchOccurrence =
        detachedLaunch.occurrences[1];
      detachedLaunchOccurrence.process.sandboxExecutableContentHash =
        "d".repeat(64);
      detachedLaunchOccurrence.process.fixedArgvHash =
        hashPlatformReleaseCompositionNetworkNegativeFixedArgvForTestV2(
          detachedLaunchOccurrence.process,
        );
      const {
        processObservationHash: _processObservationHash,
        ...detachedProcessIdentity
      } = detachedLaunchOccurrence.process;
      detachedLaunchOccurrence.process.processObservationHash =
        hashPlatformReleaseCompositionNetworkNegativeProcessObservationForTestV2(
          detachedProcessIdentity,
        );
      detachedLaunchOccurrence.launchProjectionHash =
        hashPlatformReleaseCompositionNetworkNegativeLaunchProjectionForTestV2(
          detachedLaunchOccurrence.process,
        );
      detachedLaunchOccurrence.stableProjectionHash =
        hashPlatformReleaseCompositionNetworkNegativePairStableProjectionForTestV2({
          operationAbiRef: detachedLaunch.operationAbiRef,
          operationAbiHash: detachedLaunch.operationAbiHash,
          sandboxPolicyHash:
            detachedLaunchOccurrence.sandboxPolicyHash,
          hostIdentityHash:
            detachedLaunchOccurrence.hostIdentityHash,
          platformHostToolchainReceiptHash:
            detachedLaunchOccurrence.platformHostToolchainReceiptHash,
          hostCompositionReceiptHash:
            detachedLaunchOccurrence.hostCompositionReceiptHash,
          stableOutputBindingHash:
            detachedLaunchOccurrence.stableOutputBindingHash,
          sandboxProfileHash:
            detachedLaunchOccurrence.receipt.sandboxProfileHash,
          probeProgramHash:
            detachedLaunchOccurrence.receipt.probeProgramHash,
          normalizedEnvironmentHash:
            detachedLaunchOccurrence.receipt.normalizedEnvironmentHash,
          probeClosureHash:
            detachedLaunchOccurrence.receipt.probeClosureHash,
          probeOutcome:
            detachedLaunchOccurrence.receipt.probeOutcome,
          attemptedProbeCount:
            detachedLaunchOccurrence.receipt.attemptedProbeCount,
          deniedProbeCount:
            detachedLaunchOccurrence.receipt.deniedProbeCount,
          deniedProbeSetHash:
            detachedLaunchOccurrence.receipt.deniedProbeSetHash,
          controlOutcome:
            detachedLaunchOccurrence.receipt.controlOutcome,
          controlSetHash:
            detachedLaunchOccurrence.receipt.controlSetHash,
          networkStableProjectionHash:
            detachedLaunchOccurrence.receipt
              .stableNetworkProjectionHash,
          launchProjectionHash:
            detachedLaunchOccurrence.launchProjectionHash,
        });
      detachedLaunchOccurrence.occurrenceHash =
        hashPlatformReleaseCompositionNetworkNegativePairOccurrenceForTestV2(
          detachedLaunchOccurrence,
        );
      detachedLaunch.collectionHash =
        hashPlatformReleaseCompositionNetworkNegativePairForTestV2(
          detachedLaunch,
        );
      assert.equal(
        PlatformReleaseCompositionNetworkNegativePairOccurrenceForTestV2Schema
          .safeParse(detachedLaunchOccurrence).success,
        true,
      );
      assert.equal(
        PlatformReleaseCompositionNetworkNegativePairTestV2Schema
          .safeParse(detachedLaunch).success,
        false,
      );

      const detachedPair = structuredClone(first) as any;
      detachedPair.dependencyPairInspectionHash = "f".repeat(64);
      detachedPair.collectionHash =
        hashPlatformReleaseCompositionNetworkNegativePairForTestV2(
          detachedPair,
        );
      assert.equal(
        PlatformReleaseCompositionNetworkNegativePairTestV2Schema
          .safeParse(detachedPair).success,
        false,
      );
      await revalidatePlatformReleaseDependencyMaterializedPairV2(
        dependencyPair,
      );
    } finally {
      if (dependencyPair !== undefined) {
        disposePlatformReleaseDependencyMaterializedPairV2(dependencyPair);
      } else {
        disposePlatformReleaseSourceStageV2(source);
      }
    }
  });

  it("invalidates and cleans both outputs after same-byte sandbox tool inode drift", {
    skip: process.platform !== "darwin",
  }, async () => {
    const repository = createRepositoryFixtureV2();
    const hostFixture = createHostFixtureV2({
      operationalNetworkSandboxWrapper: true,
    });
    const source = admittedSourceV2(repository);
    let dependencyPair:
      PlatformReleaseDependencyMaterializedPairV2
      | undefined;
    let firstOutputRoot = "";
    let secondOutputRoot = "";
    try {
      const host = await createPlatformHostV2(hostFixture, "valid");
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
      await withPlatformReleaseDependencyMaterializedPairForTestV2(
        dependencyPair,
        (outputRoots) => {
          firstOutputRoot = outputRoots.firstOutputRoot;
          secondOutputRoot = outputRoots.secondOutputRoot;
        },
      );
      const sandboxTool =
        hostFixture.compositionFiles["tools/sandbox-exec"]!;
      const bytes = readFileSync(sandboxTool);
      try {
        unlinkSync(sandboxTool);
        writeFileSync(sandboxTool, bytes, { mode: 0o755 });
        chmodSync(sandboxTool, 0o755);
      } finally {
        bytes.fill(0);
      }
      await assert.rejects(
        observePlatformReleaseCompositionNetworkNegativePairForTestV2(
          dependencyPair,
        ),
        {
          code:
            "PLATFORM_RELEASE_COMPOSITION_NETWORK_NEGATIVE_PAIR_TEST_V2_PAIR_DRIFT",
        },
      );
      assert.equal(existsSync(path.dirname(firstOutputRoot)), false);
      assert.equal(existsSync(path.dirname(secondOutputRoot)), false);
      assert.throws(
        () => disposePlatformReleaseDependencyMaterializedPairV2(
          dependencyPair!,
        ),
        {
          code:
            "PLATFORM_RELEASE_DEPENDENCY_PAIR_V2_SOURCE_DRIFT",
        },
      );
      dependencyPair = undefined;
    } finally {
      if (dependencyPair !== undefined) {
        try {
          disposePlatformReleaseDependencyMaterializedPairV2(
            dependencyPair,
          );
        } catch {
          // The drift assertion owns any terminal cleanup failure.
        }
      } else {
        try {
          disposePlatformReleaseSourceStageV2(source);
        } catch {
          // Terminal drift may already have destroyed the source.
        }
      }
    }
  });
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

  it("classifies composition drift during npm as host drift instead of install failure", async () => {
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
      undefined,
      () => {
        const target =
          hostFixture.compositionFiles[
            "lib/network-wrapper.mjs"
          ]!;
        chmodSync(target, 0o644);
        writeFileSync(target, "drift-during-npm\n");
        chmodSync(target, 0o444);
      },
    );

    await assert.rejects(
      materializePlatformReleaseBuildToolchainCapsuleV2ForTest({
        sourceStage: source,
        hostToolchain: host,
      }),
      {
        code:
          "PLATFORM_RELEASE_BUILD_TOOLCHAIN_CAPSULE_V2_HOST_DRIFT",
      },
    );
    assert.equal(existsSync(path.dirname(sourceRoot)), false);
  });

  it("classifies composition drift during a build occurrence as toolchain drift", async () => {
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
      (_invocation, occurrence) => {
        if (occurrence === 1) {
          const target =
            hostFixture.compositionFiles[
              "lib/network-wrapper.mjs"
            ]!;
          chmodSync(target, 0o644);
          writeFileSync(target, "drift-during-build\n");
          chmodSync(target, 0o444);
        }
        return undefined;
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
          "PLATFORM_RELEASE_COMPILED_OUTPUT_PAIR_V2_TOOLCHAIN_DRIFT",
      },
    );
    assert.equal(existsSync(path.dirname(sourceRoot)), false);
  });

  it("preserves source drift instead of relabeling it as a build failure", async () => {
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
    );
    const capsule =
      await materializePlatformReleaseBuildToolchainCapsuleV2ForTest({
        sourceStage: source,
        hostToolchain: host,
      });
    const packagePath = path.join(
      sourceRoot,
      "package.json",
    );
    chmodSync(packagePath, 0o644);
    writeFileSync(packagePath, "{\"drift\":true}\n");
    chmodSync(packagePath, 0o444);

    await assert.rejects(
      materializePlatformReleaseCompiledOutputPairV2ForTest({
        sourceStage: source,
        buildToolchain: capsule,
      }),
      {
        code:
          "PLATFORM_RELEASE_COMPILED_OUTPUT_PAIR_V2_SOURCE_DRIFT",
      },
    );
    assert.equal(existsSync(path.dirname(sourceRoot)), false);
  });

  it("maps sealed toolchain-tree drift to terminal compiled toolchain drift", async () => {
    const repository = createRepositoryFixtureV2();
    const hostFixture = createHostFixtureV2();
    const source = admittedSourceV2(repository);
    let sourceRoot = "";
    let nodeModulesRoot = "";
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
    await withPlatformReleaseBuildToolchainCapsuleForTestV2(
      capsule,
      (root) => {
        nodeModulesRoot = root;
      },
    );
    const compilerPath = path.join(
      nodeModulesRoot,
      "typescript",
      "bin",
      "tsc",
    );
    chmodSync(compilerPath, 0o755);
    writeFileSync(
      compilerPath,
      "#!/usr/bin/env node\n// sealed-tree-drift\n",
    );
    chmodSync(compilerPath, 0o555);

    await assert.rejects(
      materializePlatformReleaseCompiledOutputPairV2ForTest({
        sourceStage: source,
        buildToolchain: capsule,
      }),
      {
        code:
          "PLATFORM_RELEASE_COMPILED_OUTPUT_PAIR_V2_TOOLCHAIN_DRIFT",
      },
    );
    assert.equal(existsSync(path.dirname(sourceRoot)), false);
  });

  it("claims capsule revalidation once and terminally cleans host drift", async () => {
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
    );
    const capsule =
      await materializePlatformReleaseBuildToolchainCapsuleV2ForTest({
        sourceStage: source,
        hostToolchain: host,
      });
    const compositionTarget =
      hostFixture.compositionFiles[
        "lib/network-wrapper.mjs"
      ]!;
    chmodSync(compositionTarget, 0o644);
    writeFileSync(
      compositionTarget,
      "concurrent-revalidation-drift\n",
    );
    chmodSync(compositionTarget, 0o444);

    const first =
      revalidatePlatformReleaseBuildToolchainCapsuleV2(
        capsule,
      );
    const concurrent =
      revalidatePlatformReleaseBuildToolchainCapsuleV2(
        capsule,
      );
    await assert.rejects(
      concurrent,
      {
        code:
          "PLATFORM_RELEASE_BUILD_TOOLCHAIN_CAPSULE_V2_REVALIDATION_IN_FLIGHT",
      },
    );
    await assert.rejects(
      first,
      {
        code:
          "PLATFORM_RELEASE_BUILD_TOOLCHAIN_CAPSULE_V2_HOST_DRIFT",
      },
    );
    assert.equal(existsSync(path.dirname(sourceRoot)), false);
    await assert.rejects(
      revalidatePlatformReleaseBuildToolchainCapsuleV2(
        capsule,
      ),
      {
        code:
          "PLATFORM_RELEASE_BUILD_TOOLCHAIN_CAPSULE_V2_SOURCE_DRIFT",
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

  it("keeps source disposal outside an in-flight capsule revalidation claim", async () => {
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

    const revalidation =
      revalidatePlatformReleaseBuildToolchainCapsuleV2(
        capsule,
      );
    assert.throws(
      () => disposePlatformReleaseSourceStageV2(source),
      {
        code:
          "PLATFORM_RELEASE_SOURCE_V2_MATERIALIZATION_BUSY",
      },
    );
    await revalidation;
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
          const firstStat = lstatSync(firstOutputRoot, { bigint: true });
          const secondStat = lstatSync(secondOutputRoot, { bigint: true });
          const maxSafe = BigInt(Number.MAX_SAFE_INTEGER);
          assert.ok(firstStat.uid <= maxSafe && firstStat.gid <= maxSafe);
          assert.ok(secondStat.uid <= maxSafe && secondStat.gid <= maxSafe);
          assert.equal(
            inspection.occurrences[0]
              .outputStagePhysicalIdentityHash,
            hashHostNodePlatformReleaseOutputStageExactIdentityV2({
              device: String(firstStat.dev),
              inode: String(firstStat.ino),
              mode: Number(firstStat.mode & 0o7777n),
              ownerUid: Number(firstStat.uid),
              ownerGid: Number(firstStat.gid),
            }),
          );
          assert.equal(
            inspection.occurrences[1]
              .outputStagePhysicalIdentityHash,
            hashHostNodePlatformReleaseOutputStageExactIdentityV2({
              device: String(secondStat.dev),
              inode: String(secondStat.ino),
              mode: Number(secondStat.mode & 0o7777n),
              ownerUid: Number(secondStat.uid),
              ownerGid: Number(secondStat.gid),
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
    assert.throws(
      () => disposePlatformReleaseSourceStageV2(source),
      {
        code:
          "PLATFORM_RELEASE_SOURCE_V2_HANDLE_DISPOSED",
      },
    );
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

  it("classifies private host-composition drift as terminal toolchain drift and cleans the dependency pair once", async () => {
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
    await withPlatformReleaseDependencyMaterializedPairForTestV2(
      dependencyPair,
      (outputRoots) => {
        firstOutputRoot = outputRoots.firstOutputRoot;
        secondOutputRoot = outputRoots.secondOutputRoot;
      },
    );
    const compositionTarget =
      hostFixture.compositionFiles[
        "lib/network-wrapper.mjs"
      ]!;
    chmodSync(compositionTarget, 0o644);
    writeFileSync(compositionTarget, "private-drift\n");
    chmodSync(compositionTarget, 0o444);

    await assert.rejects(
      revalidatePlatformReleaseDependencyMaterializedPairV2(
        dependencyPair,
      ),
      {
        code:
          "PLATFORM_RELEASE_DEPENDENCY_PAIR_V2_TOOLCHAIN_DRIFT",
      },
    );
    assert.equal(existsSync(path.dirname(sourceRoot)), false);
    assert.equal(
      existsSync(path.dirname(firstOutputRoot)),
      false,
    );
    assert.equal(
      existsSync(path.dirname(secondOutputRoot)),
      false,
    );
    assert.throws(
      () =>
        disposePlatformReleaseDependencyMaterializedPairV2(
          dependencyPair,
        ),
      {
        code:
          "PLATFORM_RELEASE_DEPENDENCY_PAIR_V2_SOURCE_DRIFT",
      },
    );
  });

  it("maps sealed capsule-tree drift to terminal dependency toolchain drift", async () => {
    const repository = createRepositoryFixtureV2();
    const hostFixture = createHostFixtureV2();
    const source = admittedSourceV2(repository);
    let sourceRoot = "";
    let nodeModulesRoot = "";
    let firstOutputRoot = "";
    let secondOutputRoot = "";
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
    await withPlatformReleaseBuildToolchainCapsuleForTestV2(
      capsule,
      (root) => {
        nodeModulesRoot = root;
      },
    );
    const compiledPair =
      await materializePlatformReleaseCompiledOutputPairV2ForTest({
        sourceStage: source,
        buildToolchain: capsule,
      });
    const dependencyPair =
      await materializePlatformReleaseDependencyMaterializedPairForTestV2(
        compiledPair,
      );
    await withPlatformReleaseDependencyMaterializedPairForTestV2(
      dependencyPair,
      (outputRoots) => {
        firstOutputRoot = outputRoots.firstOutputRoot;
        secondOutputRoot = outputRoots.secondOutputRoot;
      },
    );
    const compilerPath = path.join(
      nodeModulesRoot,
      "typescript",
      "bin",
      "tsc",
    );
    chmodSync(compilerPath, 0o755);
    writeFileSync(
      compilerPath,
      "#!/usr/bin/env node\n// dependency-tree-drift\n",
    );
    chmodSync(compilerPath, 0o555);

    await assert.rejects(
      revalidatePlatformReleaseDependencyMaterializedPairV2(
        dependencyPair,
      ),
      {
        code:
          "PLATFORM_RELEASE_DEPENDENCY_PAIR_V2_TOOLCHAIN_DRIFT",
      },
    );
    assert.equal(existsSync(path.dirname(sourceRoot)), false);
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

  it("rejects an authentic dependency pair whose dist tree lacks the code-owned required module closure", async () => {
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
      dependencyPair =
        await materializePlatformReleaseDependencyMaterializedPairForTestV2(
          compiledPair,
        );
      await assert.rejects(
        derivePlatformReleaseCompositionModuleClosureForTestV2(
          dependencyPair,
        ),
        (error: unknown) => {
          assert.ok(
            error instanceof
              PlatformReleaseCompositionModuleClosureForTestErrorV2,
          );
          assert.equal(
            error.code,
            "PLATFORM_RELEASE_COMPOSITION_MODULE_CLOSURE_TEST_V2_MODULE_MISSING",
          );
          assert.match(
            error.message,
            /dist\/execution\/schemas\/node-cli-launcher-v2\.js/,
          );
          return true;
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
        disposePlatformReleaseSourceStageV2(source);
      }
    }
  });

  it("derives pathless runtime payload and all 17 module refs from authentic pairs without caller JSON", async () => {
    const repositories = [
      enableRequiredModuleBuildFixtureV2(
        createRepositoryFixtureV2(),
        "first-pair",
      ),
      enableRequiredModuleBuildFixtureV2(
        createRepositoryFixtureV2(),
        "second-pair",
      ),
    ] as const;
    const sources = repositories.map(admittedSourceV2);
    const hostFixture = createHostFixtureV2();
    const dependencyPairs:
      PlatformReleaseDependencyMaterializedPairV2[] = [];
    try {
      const host = await createPlatformHostV2(
        hostFixture,
        "valid",
      );
      for (const source of sources) {
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
        dependencyPairs.push(
          await materializePlatformReleaseDependencyMaterializedPairForTestV2(
            compiledPair,
          ),
        );
      }
      const [firstPair, secondPair] = dependencyPairs as [
        PlatformReleaseDependencyMaterializedPairV2,
        PlatformReleaseDependencyMaterializedPairV2,
      ];
      await assert.rejects(
        derivePlatformReleaseCompositionModuleClosureForTestV2({
          dependencyPair: firstPair,
          moduleRoot: "/tmp/caller-selected-modules",
        } as never),
        {
          code:
            "PLATFORM_RELEASE_COMPOSITION_MODULE_CLOSURE_TEST_V2_INPUT_INVALID",
        },
      );
      await assert.rejects(
        derivePlatformReleaseCompositionModuleClosureForTestV2(
          new Proxy(firstPair, {}) as never,
        ),
        {
          code:
            "PLATFORM_RELEASE_COMPOSITION_MODULE_CLOSURE_TEST_V2_INPUT_INVALID",
        },
      );
      await assert.rejects(
        derivePlatformReleaseCompositionModuleClosureForTestV2({
          firstPair,
          secondPair,
        } as never),
        {
          code:
            "PLATFORM_RELEASE_COMPOSITION_MODULE_CLOSURE_TEST_V2_INPUT_INVALID",
        },
      );

      const [first, repeated, second] = await Promise.all([
        derivePlatformReleaseCompositionModuleClosureForTestV2(
          firstPair,
        ),
        derivePlatformReleaseCompositionModuleClosureForTestV2(
          firstPair,
        ),
        derivePlatformReleaseCompositionModuleClosureForTestV2(
          secondPair,
        ),
      ]);
      assert.deepEqual(first, repeated);
      assert.deepEqual(
        PlatformReleaseCompositionModuleClosureForTestV2Schema
          .parse(first),
        first,
      );
      assert.equal(Object.isFrozen(first), true);
      assert.equal(Object.isFrozen(first.runtimePayload), true);
      assert.equal(
        Object.isFrozen(first.requiredModuleClosure.entries),
        true,
      );
      assert.equal(first.productionAuthority, false);
      assert.equal(first.productionAdmission, "forbidden");
      assert.equal(first.callerJsonState, "absent");
      assert.equal(first.mutationAuthority, false);
      assert.equal(
        first.requiredModuleClosure.entries.length,
        17,
      );
      assert.equal(
        first.requiredModuleClosure.runtimePayloadHash,
        first.runtimePayload.runtimePayloadHash,
      );
      assert.equal(
        first.requiredModuleClosure.platformTreeHash,
        first.runtimePayload.platformTree.treeHash,
      );
      assert.equal(first.runtimePayload.ownership.ownerUid, 0);
      assert.equal(first.runtimePayload.ownership.ownerGid, 0);
      assert.ok(first.runtimePayload.ownership.runtimeUid > 0);
      assert.equal(
        first.occurrences[0].moduleSetHash,
        first.occurrences[1].moduleSetHash,
      );
      assert.notEqual(
        first.occurrences[0].outputStagePhysicalIdentityHash,
        first.occurrences[1].outputStagePhysicalIdentityHash,
      );
      assert.equal(
        hashPlatformReleaseCompositionModuleClosureForTestV2(
          first,
        ),
        first.derivationHash,
      );
      assert.notEqual(
        first.requiredModuleClosure.closureHash,
        second.requiredModuleClosure.closureHash,
      );
      assert.notEqual(
        first.runtimePayload.platformTree.treeHash,
        second.runtimePayload.platformTree.treeHash,
      );
      assert.doesNotMatch(
        JSON.stringify(first),
        /\/tmp\/|\/private\/|\/Users\//,
      );
      const promoted = structuredClone(first) as any;
      promoted.productionAuthority = true;
      promoted.derivationHash =
        hashPlatformReleaseCompositionModuleClosureForTestV2(
          promoted,
        );
      assert.equal(
        PlatformReleaseCompositionModuleClosureForTestV2Schema
          .safeParse(promoted).success,
        false,
      );
      const detachedStableOutput = structuredClone(first) as any;
      detachedStableOutput.stableOutput
        .dependencyOutputBindingHash = hashCanonicalJson({
          schema: "test.detached-dependency-output.v2",
        });
      detachedStableOutput.derivationHash =
        hashPlatformReleaseCompositionModuleClosureForTestV2(
          detachedStableOutput,
        );
      assert.equal(
        PlatformReleaseCompositionModuleClosureForTestV2Schema
          .safeParse(detachedStableOutput).success,
        false,
      );
      const detachedModuleSet = structuredClone(first) as any;
      const forgedModuleSetHash = hashCanonicalJson({
        schema: "test.detached-module-set.v2",
      });
      detachedModuleSet.occurrences[0].moduleSetHash =
        forgedModuleSetHash;
      detachedModuleSet.occurrences[1].moduleSetHash =
        forgedModuleSetHash;
      detachedModuleSet.derivationHash =
        hashPlatformReleaseCompositionModuleClosureForTestV2(
          detachedModuleSet,
        );
      assert.equal(
        PlatformReleaseCompositionModuleClosureForTestV2Schema
          .safeParse(detachedModuleSet).success,
        false,
      );
      assert.throws(
        () => inspectCompletedPlatformReleaseStageCandidateV2(
          first as never,
        ),
        { code: "COMPLETED_STAGE_UNAUTHENTICATED" },
      );
      await Promise.all(
        dependencyPairs.map((pair) =>
          revalidatePlatformReleaseDependencyMaterializedPairV2(
            pair,
          )),
      );
    } finally {
      for (const pair of dependencyPairs) {
        try {
          disposePlatformReleaseDependencyMaterializedPairV2(pair);
        } catch {
          // The assertion path reports any authority failure.
        }
      }
      for (const source of sources.slice(dependencyPairs.length)) {
        try {
          disposePlatformReleaseSourceStageV2(source);
        } catch {
          // A failed transaction may already have destroyed this source.
        }
      }
    }
  });

  it("observes all required export kinds across two physical occurrences under one exclusive pair lease", async () => {
    const repositories = [
      enableRequiredModuleBuildFixtureV2(
        createRepositoryFixtureV2(),
        "export-probe-first",
      ),
      enableRequiredModuleBuildFixtureV2(
        createRepositoryFixtureV2(),
        "export-probe-second",
      ),
    ] as const;
    const sources = repositories.map(admittedSourceV2);
    const hostFixture = createHostFixtureV2();
    const dependencyPairs:
      PlatformReleaseDependencyMaterializedPairV2[] = [];
    try {
      const host = await createPlatformHostV2(
        hostFixture,
        "valid",
      );
      for (const source of sources) {
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
        dependencyPairs.push(
          await materializePlatformReleaseDependencyMaterializedPairForTestV2(
            compiledPair,
          ),
        );
      }
      const [firstPair, secondPair] = dependencyPairs as [
        PlatformReleaseDependencyMaterializedPairV2,
        PlatformReleaseDependencyMaterializedPairV2,
      ];
      await assert.rejects(
        observePlatformReleaseCompositionModuleExportsForTestV2({
          dependencyPair: firstPair,
          moduleRoot: "/tmp/caller-selected-modules",
        } as never),
        {
          code:
            "PLATFORM_RELEASE_COMPOSITION_MODULE_EXPORTS_TEST_V2_INPUT_INVALID",
        },
      );
      await assert.rejects(
        observePlatformReleaseCompositionModuleExportsForTestV2(
          new Proxy(firstPair, {}) as never,
        ),
        {
          code:
            "PLATFORM_RELEASE_COMPOSITION_MODULE_EXPORTS_TEST_V2_INPUT_INVALID",
        },
      );
      await assert.rejects(
        observePlatformReleaseCompositionModuleExportsForTestV2({
          firstPair,
          secondPair,
        } as never),
        {
          code:
            "PLATFORM_RELEASE_COMPOSITION_MODULE_EXPORTS_TEST_V2_INPUT_INVALID",
        },
      );

      const first =
        observePlatformReleaseCompositionModuleExportsForTestV2(
          firstPair,
        );
      const concurrent =
        observePlatformReleaseCompositionModuleExportsForTestV2(
          firstPair,
        );
      await assert.rejects(concurrent, {
        code:
          "PLATFORM_RELEASE_COMPOSITION_MODULE_EXPORTS_TEST_V2_ALREADY_CLAIMED",
      });
      assert.throws(
        () =>
          disposePlatformReleaseDependencyMaterializedPairV2(
            firstPair,
          ),
        {
          code:
            "PLATFORM_RELEASE_DEPENDENCY_PAIR_V2_SOURCE_DRIFT",
        },
      );
      const inspection = await first;
      assert.deepEqual(
        PlatformReleaseCompositionModuleExportsForTestV2Schema
          .parse(inspection),
        inspection,
      );
      assert.equal(Object.isFrozen(inspection), true);
      assert.equal(Object.isFrozen(inspection.probes), true);
      assert.equal(inspection.productionAuthority, false);
      assert.equal(inspection.productionAdmission, "forbidden");
      assert.equal(inspection.mutationAuthority, false);
      assert.equal(inspection.callerJsonState, "absent");
      assert.equal(
        inspection.operationExecutionState,
        "authenticated_test_host_composition_fixed_abi_fd3_isolated_observer_child",
      );
      assert.equal(
        inspection.productionUse,
        "forbidden_until_authenticated_installed_probe_and_verified_release",
      );
      assert.equal(inspection.probes.length, 17);
      assert.equal(
        new Set(
          inspection.probes.map(
            (probe) => probe.challengeHash,
          ),
        ).size,
        17,
      );
      for (const [index, probe] of inspection.probes.entries()) {
        const closureEntry =
          inspection.moduleClosureDerivation
            .requiredModuleClosure.entries[index]!;
        assert.deepEqual(probe.moduleRef, closureEntry.module);
        assert.deepEqual(
          probe.requiredExports,
          closureEntry.definition.requiredExports,
        );
        assert.deepEqual(
          probe.occurrences[0].observedExports,
          probe.requiredExports,
        );
        assert.deepEqual(
          probe.occurrences[1].observedExports,
          probe.requiredExports,
        );
        assert.notEqual(
          probe.occurrences[0].process.pid,
          probe.occurrences[1].process.pid,
        );
        assert.notEqual(
          `${probe.occurrences[0].moduleObservation.stableIdentity.device}:${probe.occurrences[0].moduleObservation.stableIdentity.inode}`,
          `${probe.occurrences[1].moduleObservation.stableIdentity.device}:${probe.occurrences[1].moduleObservation.stableIdentity.inode}`,
        );
        assert.equal(
          probe.occurrences[0].semanticProjectionHash,
          probe.occurrences[1].semanticProjectionHash,
        );
      }
      assert.equal(
        hashPlatformReleaseCompositionModuleExportStableSetForTestV2(
          inspection.probes,
        ),
        inspection.stableProjectionSetHash,
      );
      assert.equal(
        hashPlatformReleaseCompositionModuleExportsForTestV2(
          inspection,
        ),
        inspection.collectionHash,
      );
      assert.doesNotMatch(
        JSON.stringify(inspection),
        /\/tmp\/|\/private\/|\/Users\//,
      );
      const promoted = structuredClone(inspection) as any;
      promoted.productionAuthority = true;
      promoted.collectionHash =
        hashPlatformReleaseCompositionModuleExportsForTestV2(
          promoted,
        );
      assert.equal(
        PlatformReleaseCompositionModuleExportsForTestV2Schema
          .safeParse(promoted).success,
        false,
      );
      const detachedExecutionBridge =
        structuredClone(inspection) as any;
      detachedExecutionBridge.operationExecutionState =
        "direct_local_process";
      detachedExecutionBridge.collectionHash =
        hashPlatformReleaseCompositionModuleExportsForTestV2(
          detachedExecutionBridge,
        );
      assert.equal(
        PlatformReleaseCompositionModuleExportsForTestV2Schema
          .safeParse(detachedExecutionBridge).success,
        false,
      );
      const reordered = structuredClone(inspection) as any;
      reordered.probes.reverse();
      reordered.stableProjectionSetHash =
        hashPlatformReleaseCompositionModuleExportStableSetForTestV2(
          reordered.probes,
        );
      reordered.collectionHash =
        hashPlatformReleaseCompositionModuleExportsForTestV2(
          reordered,
        );
      assert.equal(
        PlatformReleaseCompositionModuleExportsForTestV2Schema
          .safeParse(reordered).success,
        false,
      );
      assert.throws(
        () => inspectCompletedPlatformReleaseStageCandidateV2(
          inspection as never,
        ),
        { code: "COMPLETED_STAGE_UNAUTHENTICATED" },
      );
      await Promise.all([
        revalidatePlatformReleaseDependencyMaterializedPairV2(
          firstPair,
        ),
        revalidatePlatformReleaseDependencyMaterializedPairV2(
          secondPair,
        ),
      ]);
    } finally {
      for (const pair of dependencyPairs) {
        try {
          disposePlatformReleaseDependencyMaterializedPairV2(pair);
        } catch {
          // The assertion path reports any authority failure.
        }
      }
      for (const source of sources.slice(dependencyPairs.length)) {
        try {
          disposePlatformReleaseSourceStageV2(source);
        } catch {
          // A failed transaction may already have destroyed this source.
        }
      }
    }
  });

  it("observes stable metadata semantics across two private physical output roots", {
    skip: process.platform !== "darwin",
  }, async () => {
    const repository = createRepositoryFixtureV2();
    const hostFixture = createHostFixtureV2({
      operationalMetadataObserverWrappers: true,
    });
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
      dependencyPair =
        await materializePlatformReleaseDependencyMaterializedPairForTestV2(
          compiledPair,
        );
      await assert.rejects(
        observePlatformReleaseCompositionMetadataPairForTestV2({
          dependencyPair,
          targetRoot: "/tmp/caller-selected-target",
        } as never),
        {
          code:
            "PLATFORM_RELEASE_COMPOSITION_METADATA_PAIR_TEST_V2_INPUT_INVALID",
        },
      );
      await assert.rejects(
        observePlatformReleaseCompositionMetadataPairForTestV2(
          new Proxy(dependencyPair, {}) as never,
        ),
        {
          code:
            "PLATFORM_RELEASE_COMPOSITION_METADATA_PAIR_TEST_V2_INPUT_INVALID",
        },
      );

      let releaseRootCallback!: () => void;
      let markRootCallbackEntered!: () => void;
      const rootCallbackEntered = new Promise<void>((resolve) => {
        markRootCallbackEntered = resolve;
      });
      const releaseRootCallbackPromise =
        new Promise<void>((resolve) => {
          releaseRootCallback = resolve;
        });
      const heldRootCallback =
        withPlatformReleaseDependencyMaterializedPairForTestV2(
          dependencyPair,
          async () => {
            markRootCallbackEntered();
            await releaseRootCallbackPromise;
          },
        );
      await rootCallbackEntered;
      await assert.rejects(
        observePlatformReleaseCompositionMetadataPairForTestV2(
          dependencyPair,
        ),
        {
          code:
            "PLATFORM_RELEASE_COMPOSITION_METADATA_PAIR_TEST_V2_ALREADY_CLAIMED",
        },
      );
      await assert.rejects(
        observePlatformReleaseCompositionModuleExportsForTestV2(
          dependencyPair,
        ),
        {
          code:
            "PLATFORM_RELEASE_COMPOSITION_MODULE_EXPORTS_TEST_V2_ALREADY_CLAIMED",
        },
      );
      assert.throws(
        () => disposePlatformReleaseDependencyMaterializedPairV2(
          dependencyPair!,
        ),
        {
          code:
            "PLATFORM_RELEASE_DEPENDENCY_PAIR_V2_SOURCE_DRIFT",
        },
      );
      releaseRootCallback();
      await heldRootCallback;

      const firstPending =
        observePlatformReleaseCompositionMetadataPairForTestV2(
          dependencyPair,
        );
      await assert.rejects(
        observePlatformReleaseCompositionMetadataPairForTestV2(
          dependencyPair,
        ),
        {
          code:
            "PLATFORM_RELEASE_COMPOSITION_METADATA_PAIR_TEST_V2_ALREADY_CLAIMED",
        },
      );
      await assert.rejects(
        withPlatformReleaseDependencyMaterializedPairForTestV2(
          dependencyPair,
          () => undefined,
        ),
        {
          code:
            "PLATFORM_RELEASE_DEPENDENCY_PAIR_V2_SOURCE_DRIFT",
        },
      );
      const first = await firstPending;
      const second =
        await observePlatformReleaseCompositionMetadataPairForTestV2(
          dependencyPair,
        );
      for (const evidence of [first, second]) {
        assert.deepEqual(
          PlatformReleaseCompositionMetadataPairTestV2Schema
            .parse(evidence),
          evidence,
        );
        assert.equal(Object.isFrozen(evidence), true);
        assert.equal(Object.isFrozen(evidence.occurrences), true);
        assert.equal(
          Object.isFrozen(evidence.occurrences[0].receipt),
          true,
        );
        assert.equal(evidence.productionAuthority, false);
        assert.equal(evidence.productionAdmission, "forbidden");
        assert.equal(evidence.mutationAuthority, false);
        assert.equal(evidence.callerJsonState, "absent");
        assert.equal(
          evidence.occurrences[0].stableProjectionHash,
          evidence.occurrences[1].stableProjectionHash,
        );
        assert.notEqual(
          evidence.occurrences[0].targetRootPhysicalIdentityHash,
          evidence.occurrences[1].targetRootPhysicalIdentityHash,
        );
        assert.notEqual(
          evidence.occurrences[0].receipt.metadataCatalogHash,
          evidence.occurrences[1].receipt.metadataCatalogHash,
        );
        assert.notEqual(
          evidence.occurrences[0].receipt.metadataObservationHash,
          evidence.occurrences[1].receipt.metadataObservationHash,
        );
        assert.notEqual(
          evidence.occurrences[0].process.processObservationHash,
          evidence.occurrences[1].process.processObservationHash,
        );
        assert.equal(
          hashPlatformReleaseCompositionMetadataPairForTestV2(
            evidence,
          ),
          evidence.collectionHash,
        );
        assert.doesNotMatch(
          JSON.stringify(evidence),
          /\/tmp\/|\/private\/|\/var\/folders\/|\/Users\/|setfarm-platform-compiled-output/,
        );
      }
      assert.equal(
        first.stableProjectionHash,
        second.stableProjectionHash,
      );
      assert.notEqual(
        first.occurrences[0].occurrenceId,
        second.occurrences[0].occurrenceId,
      );
      assert.notEqual(
        first.collectionHash,
        second.collectionHash,
      );
      assert.throws(
        () => inspectCompletedPlatformReleaseStageCandidateV2(
          first as never,
        ),
        { code: "COMPLETED_STAGE_UNAUTHENTICATED" },
      );
      const promoted = structuredClone(first) as any;
      promoted.productionAuthority = true;
      promoted.collectionHash =
        hashPlatformReleaseCompositionMetadataPairForTestV2(
          promoted,
        );
      assert.equal(
        PlatformReleaseCompositionMetadataPairTestV2Schema
          .safeParse(promoted).success,
        false,
      );
      const detachedPair = structuredClone(first) as any;
      detachedPair.dependencyPairInspectionHash = "f".repeat(64);
      detachedPair.collectionHash =
        hashPlatformReleaseCompositionMetadataPairForTestV2(
          detachedPair,
        );
      assert.equal(
        PlatformReleaseCompositionMetadataPairTestV2Schema
          .safeParse(detachedPair).success,
        false,
      );
      const swapped = structuredClone(first) as any;
      swapped.occurrences.reverse();
      swapped.occurrences[0].stageRef =
        "PLATFORM_RELEASE_DEPENDENCY_STAGE_FIRST_V2";
      swapped.occurrences[1].stageRef =
        "PLATFORM_RELEASE_DEPENDENCY_STAGE_SECOND_V2";
      for (const occurrence of swapped.occurrences) {
        occurrence.occurrenceHash =
          hashPlatformReleaseCompositionMetadataPairOccurrenceForTestV2(
            occurrence,
          );
      }
      swapped.collectionHash =
        hashPlatformReleaseCompositionMetadataPairForTestV2(
          swapped,
        );
      assert.equal(
        PlatformReleaseCompositionMetadataPairTestV2Schema
          .safeParse(swapped).success,
        false,
      );
      const aliased = structuredClone(first) as any;
      aliased.occurrences[1] = structuredClone(
        aliased.occurrences[0],
      );
      aliased.occurrences[1].stageRef =
        "PLATFORM_RELEASE_DEPENDENCY_STAGE_SECOND_V2";
      aliased.occurrences[1].occurrenceHash =
        hashPlatformReleaseCompositionMetadataPairOccurrenceForTestV2(
          aliased.occurrences[1],
        );
      aliased.collectionHash =
        hashPlatformReleaseCompositionMetadataPairForTestV2(
          aliased,
        );
      assert.equal(
        PlatformReleaseCompositionMetadataPairTestV2Schema
          .safeParse(aliased).success,
        false,
      );
      const unequalProjection = structuredClone(first) as any;
      unequalProjection.occurrences[1].stableProjectionHash =
        "e".repeat(64);
      unequalProjection.occurrences[1].occurrenceHash =
        hashPlatformReleaseCompositionMetadataPairOccurrenceForTestV2(
          unequalProjection.occurrences[1],
        );
      unequalProjection.collectionHash =
        hashPlatformReleaseCompositionMetadataPairForTestV2(
          unequalProjection,
        );
      assert.equal(
        PlatformReleaseCompositionMetadataPairTestV2Schema
          .safeParse(unequalProjection).success,
        false,
      );
      const detachedLaunch = structuredClone(first) as any;
      const detachedOccurrence = detachedLaunch.occurrences[1];
      detachedOccurrence.process.metadataModuleContentHash =
        "d".repeat(64);
      detachedOccurrence.process.fixedArgvHash =
        hashPlatformReleaseCompositionMetadataFixedArgvForTestV2(
          detachedOccurrence.process,
        );
      const {
        processObservationHash: _processObservationHash,
        ...detachedProcessIdentity
      } = detachedOccurrence.process;
      detachedOccurrence.process.processObservationHash =
        hashPlatformReleaseCompositionMetadataProcessObservationForTestV2(
          detachedProcessIdentity,
        );
      detachedOccurrence.launchProjectionHash =
        hashPlatformReleaseCompositionMetadataLaunchProjectionForTestV2(
          detachedOccurrence.process,
        );
      detachedOccurrence.stableProjectionHash =
        hashPlatformReleaseCompositionMetadataPairStableProjectionForTestV2({
          operationAbiRef: detachedLaunch.operationAbiRef,
          operationAbiHash: detachedLaunch.operationAbiHash,
          metadataPolicyHash:
            detachedOccurrence.metadataPolicyHash,
          hostIdentityHash: detachedOccurrence.hostIdentityHash,
          platformHostToolchainReceiptHash:
            detachedOccurrence.platformHostToolchainReceiptHash,
          hostCompositionReceiptHash:
            detachedOccurrence.hostCompositionReceiptHash,
          stableOutputBindingHash:
            detachedOccurrence.stableOutputBindingHash,
          targetEntryNamesHash:
            detachedOccurrence.receipt.targetEntryNamesHash,
          observedEntryCount:
            detachedOccurrence.receipt.observedEntryCount,
          observationOutcome:
            detachedOccurrence.receipt.observationOutcome,
          metadataStableProjectionHash:
            detachedOccurrence.receipt.stableMetadataProjectionHash,
          launchProjectionHash:
            detachedOccurrence.launchProjectionHash,
        });
      detachedOccurrence.occurrenceHash =
        hashPlatformReleaseCompositionMetadataPairOccurrenceForTestV2(
          detachedOccurrence,
        );
      detachedLaunch.collectionHash =
        hashPlatformReleaseCompositionMetadataPairForTestV2(
          detachedLaunch,
        );
      assert.equal(
        PlatformReleaseCompositionMetadataPairTestV2Schema
          .safeParse(detachedLaunch).success,
        false,
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
        disposePlatformReleaseSourceStageV2(source);
      }
    }
  });

  it("returns authenticated metadata rejection and releases the pair lease", {
    skip: process.platform !== "darwin",
  }, async () => {
    const repository = createRepositoryFixtureV2();
    const hostFixture = createHostFixtureV2({
      operationalMetadataObserverWrappers: true,
    });
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
      dependencyPair =
        await materializePlatformReleaseDependencyMaterializedPairForTestV2(
          compiledPair,
        );
      await withPlatformReleaseDependencyMaterializedPairForTestV2(
        dependencyPair,
        ({ firstOutputRoot }) => {
          const result = spawnSync(
            "/usr/bin/xattr",
            [
              "-w",
              "com.setfarm.metadata_pair_test_v2",
              "fixture",
              firstOutputRoot,
            ],
            { env: {}, shell: false, stdio: "ignore" },
          );
          assert.equal(result.error, undefined);
          assert.equal(result.status, 0);
        },
      );
      await assert.rejects(
        observePlatformReleaseCompositionMetadataPairForTestV2(
          dependencyPair,
        ),
        (error: unknown) => {
          assert.ok(
            error instanceof
              PlatformReleaseCompositionMetadataPairForTestErrorV2,
          );
          assert.equal(
            error.code,
            "PLATFORM_RELEASE_COMPOSITION_METADATA_PAIR_TEST_V2_OPERATION_REJECTED",
          );
          assert.doesNotMatch(
            errorMessagesV2(error).join("\n"),
            /\/tmp\/|\/private\/|\/var\/folders\/|\/Users\//,
          );
          return true;
        },
      );
      await withPlatformReleaseDependencyMaterializedPairForTestV2(
        dependencyPair,
        ({ firstOutputRoot }) => {
          const result = spawnSync(
            "/usr/bin/xattr",
            [
              "-d",
              "com.setfarm.metadata_pair_test_v2",
              firstOutputRoot,
            ],
            { env: {}, shell: false, stdio: "ignore" },
          );
          assert.equal(result.error, undefined);
          assert.equal(result.status, 0);
        },
      );
      await revalidatePlatformReleaseDependencyMaterializedPairV2(
        dependencyPair,
      );
      const recovered =
        await observePlatformReleaseCompositionMetadataPairForTestV2(
          dependencyPair,
        );
      assert.equal(recovered.occurrences.length, 2);

      const aclRule = "everyone deny delete";
      await withPlatformReleaseDependencyMaterializedPairForTestV2(
        dependencyPair,
        ({ secondOutputRoot }) => {
          const result = spawnSync(
            "/bin/chmod",
            ["+a", aclRule, secondOutputRoot],
            { env: {}, shell: false, stdio: "ignore" },
          );
          assert.equal(result.error, undefined);
          assert.equal(result.status, 0);
        },
      );
      await assert.rejects(
        observePlatformReleaseCompositionMetadataPairForTestV2(
          dependencyPair,
        ),
        {
          code:
            "PLATFORM_RELEASE_COMPOSITION_METADATA_PAIR_TEST_V2_OPERATION_REJECTED",
        },
      );
      await withPlatformReleaseDependencyMaterializedPairForTestV2(
        dependencyPair,
        ({ secondOutputRoot }) => {
          const result = spawnSync(
            "/bin/chmod",
            ["-a", aclRule, secondOutputRoot],
            { env: {}, shell: false, stdio: "ignore" },
          );
          assert.equal(result.error, undefined);
          assert.equal(result.status, 0);
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
        disposePlatformReleaseSourceStageV2(source);
      }
    }
  });

  it("terminally cleans the exact metadata pair after host launch drift", {
    skip: process.platform !== "darwin",
  }, async () => {
    const repository = createRepositoryFixtureV2();
    const hostFixture = createHostFixtureV2({
      operationalMetadataObserverWrappers: true,
    });
    const source = admittedSourceV2(repository);
    let dependencyPair:
      PlatformReleaseDependencyMaterializedPairV2
      | undefined;
    let firstOutputRoot = "";
    let secondOutputRoot = "";
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
      dependencyPair =
        await materializePlatformReleaseDependencyMaterializedPairForTestV2(
          compiledPair,
        );
      await withPlatformReleaseDependencyMaterializedPairForTestV2(
        dependencyPair,
        (roots) => {
          firstOutputRoot = roots.firstOutputRoot;
          secondOutputRoot = roots.secondOutputRoot;
        },
      );
      const metadataModule =
        hostFixture.compositionFiles[
          "lib/metadata-bootstrap.mjs"
        ]!;
      chmodSync(metadataModule, 0o644);
      writeFileSync(metadataModule, "private-host-drift\n");
      chmodSync(metadataModule, 0o444);
      await assert.rejects(
        observePlatformReleaseCompositionMetadataPairForTestV2(
          dependencyPair,
        ),
        {
          code:
            "PLATFORM_RELEASE_COMPOSITION_METADATA_PAIR_TEST_V2_PAIR_DRIFT",
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
      assert.throws(
        () => disposePlatformReleaseDependencyMaterializedPairV2(
          dependencyPair!,
        ),
        {
          code:
            "PLATFORM_RELEASE_DEPENDENCY_PAIR_V2_SOURCE_DRIFT",
        },
      );
      dependencyPair = undefined;
    } finally {
      if (dependencyPair) {
        try {
          disposePlatformReleaseDependencyMaterializedPairV2(
            dependencyPair,
          );
        } catch {
          // Drift assertions own any terminal cleanup failure.
        }
      } else {
        try {
          disposePlatformReleaseSourceStageV2(source);
        } catch {
          // A terminal metadata drift already destroyed the source.
        }
      }
    }
  });

  it("terminally rejects a same-byte metadata observer inode replacement", {
    skip: process.platform !== "darwin",
  }, async () => {
    const repository = createRepositoryFixtureV2();
    const hostFixture = createHostFixtureV2({
      operationalMetadataObserverWrappers: true,
    });
    const source = admittedSourceV2(repository);
    let dependencyPair:
      PlatformReleaseDependencyMaterializedPairV2
      | undefined;
    let firstOutputRoot = "";
    let secondOutputRoot = "";
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
      dependencyPair =
        await materializePlatformReleaseDependencyMaterializedPairForTestV2(
          compiledPair,
        );
      await withPlatformReleaseDependencyMaterializedPairForTestV2(
        dependencyPair,
        (outputRoots) => {
          firstOutputRoot = outputRoots.firstOutputRoot;
          secondOutputRoot = outputRoots.secondOutputRoot;
        },
      );
      const observer =
        hostFixture.compositionFiles["tools/xattr-observe"]!;
      const bytes = readFileSync(observer);
      try {
        unlinkSync(observer);
        writeFileSync(observer, bytes, { mode: 0o755 });
        chmodSync(observer, 0o755);
      } finally {
        bytes.fill(0);
      }
      await assert.rejects(
        observePlatformReleaseCompositionMetadataPairForTestV2(
          dependencyPair,
        ),
        {
          code:
            "PLATFORM_RELEASE_COMPOSITION_METADATA_PAIR_TEST_V2_PAIR_DRIFT",
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
      assert.throws(
        () => disposePlatformReleaseDependencyMaterializedPairV2(
          dependencyPair!,
        ),
        {
          code:
            "PLATFORM_RELEASE_DEPENDENCY_PAIR_V2_SOURCE_DRIFT",
        },
      );
      dependencyPair = undefined;
    } finally {
      if (dependencyPair) {
        try {
          disposePlatformReleaseDependencyMaterializedPairV2(
            dependencyPair,
          );
        } catch {
          // Drift assertions own any terminal cleanup failure.
        }
      } else {
        try {
          disposePlatformReleaseSourceStageV2(source);
        } catch {
          // Terminal drift may already have destroyed the source.
        }
      }
    }
  });

  it("terminally cleans a target changed while the installed observer child is in flight", {
    skip: process.platform !== "darwin",
  }, async () => {
    const synchronizationRoot = realpathSync(mkdtempSync(path.join(
      tmpdir(),
      "setfarm-metadata-pair-target-drift-v2-",
    )));
    roots.push(synchronizationRoot);
    const enteredPath = path.join(synchronizationRoot, "entered");
    const releasePath = path.join(synchronizationRoot, "release");
    const repository = createRepositoryFixtureV2();
    const hostFixture = createHostFixtureV2({
      operationalMetadataObserverWrappers: true,
    });
    const observer =
      hostFixture.compositionFiles["tools/xattr-observe"]!;
    chmodSync(observer, 0o755);
    writeFileSync(observer, [
      "#!/bin/sh",
      "set -efu",
      `: > '${enteredPath}'`,
      `while [ ! -e '${releasePath}' ]; do /bin/sleep 0.01; done`,
      "exec /usr/bin/xattr \"$@\"",
      "",
    ].join("\n"));
    chmodSync(observer, 0o755);
    const source = admittedSourceV2(repository);
    let dependencyPair:
      PlatformReleaseDependencyMaterializedPairV2
      | undefined;
    let firstOutputRoot = "";
    let secondOutputRoot = "";
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
      dependencyPair =
        await materializePlatformReleaseDependencyMaterializedPairForTestV2(
          compiledPair,
        );
      await withPlatformReleaseDependencyMaterializedPairForTestV2(
        dependencyPair,
        (outputRoots) => {
          firstOutputRoot = outputRoots.firstOutputRoot;
          secondOutputRoot = outputRoots.secondOutputRoot;
        },
      );
      const pending =
        observePlatformReleaseCompositionMetadataPairForTestV2(
          dependencyPair,
        );
      const deadline = Date.now() + 5_000;
      while (!existsSync(enteredPath)) {
        if (Date.now() >= deadline) {
          throw new Error(
            "Installed metadata observer did not enter its test fence",
          );
        }
        await new Promise<void>((resolve) => {
          setTimeout(resolve, 10);
        });
      }
      writeFileSync(
        path.join(firstOutputRoot, "rogue.txt"),
        "in-flight target drift\n",
        { mode: 0o444 },
      );
      writeFileSync(releasePath, "release\n", { mode: 0o600 });
      await assert.rejects(pending, {
        code:
          "PLATFORM_RELEASE_COMPOSITION_METADATA_PAIR_TEST_V2_PAIR_DRIFT",
      });
      assert.equal(
        existsSync(path.dirname(firstOutputRoot)),
        false,
      );
      assert.equal(
        existsSync(path.dirname(secondOutputRoot)),
        false,
      );
      assert.throws(
        () => disposePlatformReleaseDependencyMaterializedPairV2(
          dependencyPair!,
        ),
        {
          code:
            "PLATFORM_RELEASE_DEPENDENCY_PAIR_V2_SOURCE_DRIFT",
        },
      );
      dependencyPair = undefined;
    } finally {
      if (!existsSync(releasePath)) {
        writeFileSync(releasePath, "release\n", { mode: 0o600 });
      }
      if (dependencyPair) {
        try {
          disposePlatformReleaseDependencyMaterializedPairV2(
            dependencyPair,
          );
        } catch {
          // Drift assertions own any terminal cleanup failure.
        }
      } else {
        try {
          disposePlatformReleaseSourceStageV2(source);
        } catch {
          // Terminal drift may already have destroyed the source.
        }
      }
    }
  });

  it("keeps trusted wire emission and termination independent from hostile module global mutation", async () => {
    const repository = enableRequiredModuleBuildFixtureV2(
      createRepositoryFixtureV2(),
      "hostile-module-globals",
      undefined,
      [
        "import fs from 'node:fs';",
        "import { createHash as hostileCreateHash } from 'node:crypto';",
        "import { syncBuiltinESMExports } from 'node:module';",
        "process.stdout.write = () => { throw new Error('HOSTILE_STDOUT_USED'); };",
        "process.exit = () => { throw new Error('HOSTILE_EXIT_USED'); };",
        "process.exitCode = 93;",
        "Object.keys = () => { throw new Error('HOSTILE_OBJECT_KEYS_USED'); };",
        "JSON.stringify = () => { throw new Error('HOSTILE_JSON_USED'); };",
        "Buffer.alloc = () => { throw new Error('HOSTILE_BUFFER_USED'); };",
        "fs.writeSync = () => { throw new Error('HOSTILE_FS_WRITE_USED'); };",
        "Object.getPrototypeOf(hostileCreateHash('sha256')).update = () => { throw new Error('HOSTILE_HASH_USED'); };",
        "syncBuiltinESMExports();",
        "",
      ].join("\n"),
    );
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
      dependencyPair =
        await materializePlatformReleaseDependencyMaterializedPairForTestV2(
          compiledPair,
        );
      const inspection =
        await observePlatformReleaseCompositionModuleExportsForTestV2(
          dependencyPair,
        );
      assert.equal(inspection.probes.length, 17);
      assert.equal(inspection.productionAuthority, false);
      await revalidatePlatformReleaseDependencyMaterializedPairV2(
        dependencyPair,
      );
    } finally {
      if (dependencyPair) {
        disposePlatformReleaseDependencyMaterializedPairV2(
          dependencyPair,
        );
      } else {
        disposePlatformReleaseSourceStageV2(source);
      }
    }
  });

  it("keeps process binding and reallyExit mutation inside the nonce-isolated observer child", async () => {
    const repository = enableRequiredModuleBuildFixtureV2(
      createRepositoryFixtureV2(),
      "hostile-node-internals",
      undefined,
      [
        "const hostileFsBinding = process.binding('fs');",
        "const originalWriteBuffer = hostileFsBinding.writeBuffer;",
        "hostileFsBinding.writeBuffer = function (...args) {",
        "  const result = Reflect.apply(originalWriteBuffer, this, args);",
        "  Reflect.apply(originalWriteBuffer, this, args);",
        "  return result;",
        "};",
        "process.reallyExit = () => undefined;",
        "",
      ].join("\n"),
    );
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
      dependencyPair =
        await materializePlatformReleaseDependencyMaterializedPairForTestV2(
          compiledPair,
        );
      await assert.rejects(
        observePlatformReleaseCompositionModuleExportsForTestV2(
          dependencyPair,
        ),
        (error: unknown) => {
          assert.ok(
            error instanceof
              PlatformReleaseCompositionModuleExportsForTestErrorV2,
          );
          assert.equal(
            error.code,
            "PLATFORM_RELEASE_COMPOSITION_MODULE_EXPORTS_TEST_V2_OPERATION_REJECTED",
          );
          assert.match(
            error.message,
            /authenticated failure receipt/,
          );
          assert.doesNotMatch(
            error.message,
            /writeBuffer|reallyExit|hostile-node-internals/,
          );
          return true;
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
        disposePlatformReleaseSourceStageV2(source);
      }
    }
  });

  it("rejects a stable wrong export kind and releases the authentic pair lease after its post-fence", async () => {
    const firstDefinition =
      getPlatformReleaseRequiredModuleRequirementV2()
        .entries[0]!;
    const firstExport = firstDefinition.requiredExports[0]!;
    const repository = enableRequiredModuleBuildFixtureV2(
      createRepositoryFixtureV2(),
      "wrong-export-kind",
      {
        moduleLocator: firstDefinition.moduleLocator,
        name: firstExport.name,
        actualKind:
          firstExport.kind === "function"
            ? "string"
            : "function",
      },
    );
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
      dependencyPair =
        await materializePlatformReleaseDependencyMaterializedPairForTestV2(
          compiledPair,
        );
      await assert.rejects(
        observePlatformReleaseCompositionModuleExportsForTestV2(
          dependencyPair,
        ),
        (error: unknown) => {
          assert.ok(
            error instanceof
              PlatformReleaseCompositionModuleExportsForTestErrorV2,
          );
          assert.equal(
            error.code,
            "PLATFORM_RELEASE_COMPOSITION_MODULE_EXPORTS_TEST_V2_OPERATION_REJECTED",
          );
          assert.match(
            error.message,
            /authenticated failure receipt/,
          );
          return true;
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
        disposePlatformReleaseSourceStageV2(source);
      }
    }
  });

  it("rejects authenticated release-bootstrap command and output deviations without promoting the pair", async () => {
    const cases = [
      {
        label: "wrong-installed-command",
        executableSource: [
          "const directArgv = process.argv.slice(2);",
          "if (directArgv[0] !== 'wrong-module-export-command-v2') {",
          "  process.stderr.write('RELEASE_BOOTSTRAP_ARGV_INVALID\\n');",
          "  process.exitCode = 1;",
          "}",
          "",
        ].join("\n"),
        expectedCode:
          "PLATFORM_RELEASE_COMPOSITION_MODULE_EXPORTS_TEST_V2_PROCESS_FAILED",
      },
      {
        label: "invalid-installed-output",
        executableSource: [
          "const { readFileSync } = require('node:fs');",
          "readFileSync(3);",
          "process.stdout.write('{}\\n');",
          "",
        ].join("\n"),
        expectedCode:
          "PLATFORM_RELEASE_COMPOSITION_MODULE_EXPORTS_TEST_V2_OUTPUT_INVALID",
      },
    ] as const;

    for (const scenario of cases) {
      const repository = enableRequiredModuleBuildFixtureV2(
        createRepositoryFixtureV2(),
        scenario.label,
      );
      const hostFixture = createHostFixtureV2();
      const releaseBootstrap =
        hostFixture.compositionFiles["bin/release-bootstrap"]!;
      chmodSync(releaseBootstrap, 0o755);
      writeFileSync(
        releaseBootstrap,
        scenario.executableSource,
      );
      chmodSync(releaseBootstrap, 0o555);
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
        dependencyPair =
          await materializePlatformReleaseDependencyMaterializedPairForTestV2(
            compiledPair,
          );
        await assert.rejects(
          observePlatformReleaseCompositionModuleExportsForTestV2(
            dependencyPair,
          ),
          {
            code: scenario.expectedCode,
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
          disposePlatformReleaseSourceStageV2(source);
        }
      }
    }
  });

  it("claims one authentic pair before await and transfers exactly one pathless test slot", async () => {
    const repository = createRepositoryFixtureV2();
    const hostFixture = createHostFixtureV2();
    const source = admittedSourceV2(repository);
    let dependencyPair:
      PlatformReleaseDependencyMaterializedPairV2
      | undefined;
    let transfer:
      PlatformReleaseCompositionOwnershipTransferForTestV2
      | undefined;
    let transferDisposed = false;
    let sourceRetired = false;
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
      dependencyPair =
        await materializePlatformReleaseDependencyMaterializedPairForTestV2(
          compiledPair,
        );
      await withPlatformReleaseDependencyMaterializedPairForTestV2(
        dependencyPair,
        (roots) => {
          firstOutputRoot = roots.firstOutputRoot;
          secondOutputRoot = roots.secondOutputRoot;
        },
      );
      await assert.rejects(
        rehearsePlatformReleaseCompositionOwnershipTransferWithFaultForTestV2(
          dependencyPair,
          {
            checkpoint: "after_selected_slot_transfer",
            observePath() {},
            extra: true,
          } as never,
        ),
        {
          code:
            "PLATFORM_RELEASE_COMPOSITION_TRANSFER_TEST_V2_INPUT_INVALID",
        },
      );
      await assert.rejects(
        rehearsePlatformReleaseCompositionOwnershipTransferWithFaultForTestV2(
          dependencyPair,
          new Proxy({
            checkpoint: "after_selected_slot_transfer" as const,
            observePath() {},
          }, {}) as never,
        ),
        {
          code:
            "PLATFORM_RELEASE_COMPOSITION_TRANSFER_TEST_V2_INPUT_INVALID",
        },
      );
      assert.throws(
        () =>
          new PlatformReleaseCompositionOwnershipTransferForTestV2(
            {},
            {} as never,
          ),
        {
          code:
            "PLATFORM_RELEASE_COMPOSITION_TRANSFER_TEST_V2_HANDLE_UNAUTHENTICATED",
        },
      );

      const first =
        rehearsePlatformReleaseCompositionOwnershipTransferForTestV2(
          dependencyPair,
        );
      const second =
        rehearsePlatformReleaseCompositionOwnershipTransferForTestV2(
          dependencyPair,
        );
      await assert.rejects(second, {
        code:
          "PLATFORM_RELEASE_COMPOSITION_TRANSFER_TEST_V2_ALREADY_CLAIMED",
      });
      transfer = await first;

      const inspection =
        inspectPlatformReleaseCompositionOwnershipTransferForTestV2(
          transfer,
        );
      assert.deepEqual(
        PlatformReleaseCompositionOwnershipTransferForTestV2Schema
          .parse(inspection),
        inspection,
      );
      assert.equal(Object.isFrozen(inspection), true);
      assert.equal(Object.isFrozen(inspection.selectedSlot), true);
      assert.equal(inspection.productionAuthority, false);
      assert.equal(inspection.productionAdmission, "forbidden");
      assert.equal(
        inspection.terminalizationState,
        "not_performed_manifest_attestation_still_required",
      );
      assert.deepEqual(inspection.pairLifecycle, [
        "pair_ready",
        "pair_consuming",
        "selected_root_owned",
        "predecessors_consumed",
        "release_completed",
      ]);
      assert.equal(
        hashPlatformReleaseCompositionOwnershipTransferForTestV2(
          inspection,
        ),
        inspection.transactionHash,
      );
      const selectedStat = lstatSync(
        firstOutputRoot,
        { bigint: true },
      );
      assert.equal(
        inspection.selectedSlot.outputRoot.stableIdentity.device,
        selectedStat.dev.toString(10),
      );
      assert.equal(
        inspection.selectedSlot.outputRoot.stableIdentity.inode,
        selectedStat.ino.toString(10),
      );
      assert.equal(
        inspection.selectedSlot.outputRoot.mutableFingerprint.mode,
        "0700",
      );
      assert.equal(
        existsSync(path.dirname(sourceRoot)),
        false,
      );
      assert.equal(
        existsSync(path.dirname(secondOutputRoot)),
        false,
      );
      assert.equal(
        existsSync(path.dirname(firstOutputRoot)),
        true,
      );
      assert.doesNotMatch(
        JSON.stringify(inspection),
        /\/tmp\/|\/private\/|\/Users\//,
      );
      const promoted = structuredClone(inspection) as any;
      promoted.productionAuthority = true;
      promoted.transactionHash =
        hashPlatformReleaseCompositionOwnershipTransferForTestV2(
          promoted,
        );
      assert.equal(
        PlatformReleaseCompositionOwnershipTransferForTestV2Schema
          .safeParse(promoted).success,
        false,
      );
      assert.throws(
        () => inspectCompletedPlatformReleaseStageCandidateV2(
          transfer as never,
        ),
        { code: "COMPLETED_STAGE_UNAUTHENTICATED" },
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
        () => disposePlatformReleaseDependencyMaterializedPairV2(
          dependencyPair!,
        ),
        {
          code:
            "PLATFORM_RELEASE_DEPENDENCY_PAIR_V2_SOURCE_DRIFT",
        },
      );

      disposePlatformReleaseSourceStageV2(source);
      sourceRetired = true;
      assert.equal(
        existsSync(path.dirname(firstOutputRoot)),
        true,
      );
      disposePlatformReleaseCompositionOwnershipTransferForTestV2(
        transfer,
      );
      transferDisposed = true;
      assert.equal(
        existsSync(path.dirname(firstOutputRoot)),
        false,
      );
      assert.throws(
        () =>
          inspectPlatformReleaseCompositionOwnershipTransferForTestV2(
            transfer!,
          ),
        {
          code:
            "PLATFORM_RELEASE_COMPOSITION_TRANSFER_TEST_V2_HANDLE_DISPOSED",
        },
      );
      assert.throws(
        () =>
          disposePlatformReleaseCompositionOwnershipTransferForTestV2(
            transfer!,
          ),
        {
          code:
            "PLATFORM_RELEASE_COMPOSITION_TRANSFER_TEST_V2_HANDLE_DISPOSED",
        },
      );
    } finally {
      if (transfer && !transferDisposed) {
        try {
          disposePlatformReleaseCompositionOwnershipTransferForTestV2(
            transfer,
          );
        } catch {
          // The assertion path above reports the authoritative failure.
        }
      } else if (dependencyPair && !transfer) {
        try {
          disposePlatformReleaseDependencyMaterializedPairV2(
            dependencyPair,
          );
        } catch {
          // Failed transactions may already have destroyed the source context.
        }
      }
      if (!sourceRetired) {
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

  for (
    const checkpoint of [
      "after_claim_before_revalidation",
      "after_selected_slot_transfer",
      "after_second_output_cleanup",
      "after_source_context_cleanup_before_completion",
      "after_completion_before_return",
    ] as const satisfies readonly
      PlatformReleaseCompositionOwnershipTransferFaultForTestV2[
        "checkpoint"
      ][]
  ) {
    it(`leaves no unowned root at the ${checkpoint} ownership-transfer fault`, async () => {
      const repository = createRepositoryFixtureV2();
      const hostFixture = createHostFixtureV2();
      const source = admittedSourceV2(repository);
      let dependencyPair:
        PlatformReleaseDependencyMaterializedPairV2
        | undefined;
      let sourceRoot = "";
      let firstOutputRoot = "";
      let secondOutputRoot = "";
      let observedPath = "";
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
        dependencyPair =
          await materializePlatformReleaseDependencyMaterializedPairForTestV2(
            compiledPair,
          );
        await withPlatformReleaseDependencyMaterializedPairForTestV2(
          dependencyPair,
          (roots) => {
            firstOutputRoot = roots.firstOutputRoot;
            secondOutputRoot = roots.secondOutputRoot;
          },
        );
        await assert.rejects(
          rehearsePlatformReleaseCompositionOwnershipTransferWithFaultForTestV2(
            dependencyPair,
            {
              checkpoint,
              observePath(absolutePath) {
                observedPath = absolutePath;
              },
            },
          ),
          {
            code:
              "PLATFORM_RELEASE_COMPOSITION_TRANSFER_TEST_V2_OUTPUT_INVALID",
          },
        );
        assert.notEqual(observedPath, "");
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
          () => disposePlatformReleaseSourceStageV2(source),
          {
            code:
              "PLATFORM_RELEASE_SOURCE_V2_HANDLE_DISPOSED",
          },
        );
      } finally {
        if (dependencyPair) {
          try {
            disposePlatformReleaseDependencyMaterializedPairV2(
              dependencyPair,
            );
          } catch {
            // Injected failure owns terminal cleanup.
          }
        }
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
