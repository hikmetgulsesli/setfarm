import assert from "node:assert/strict";
import { appendFileSync } from "node:fs";
import {
  chmod,
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  realpath,
  rename,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";

import {
  NODE_EXPRESS_API_PACKAGE_LOCK_JSON_TEXT_V2,
  NODE_CLI_PACKAGE_LOCK_JSON_TEXT_V2,
} from "../../src/product-compiler/node-scaffold-assets-v2.js";
import {
  deriveCodeOwnedNodeScaffoldProductionClosureV2,
} from "../../src/product-compiler/node-scaffold-production-closure-v2.js";
import {
  NODE_SCAFFOLD_PRODUCTION_MATERIALIZATION_CONTRACT_HASH_V2,
  NodeScaffoldProductionMaterializationErrorV2,
  assertRawNpmInstallObjectCurrentInternalV2,
  captureRawNpmInstallTreeInternalV2,
  getRawNpmInstallExactObjectIdentityInternalV2,
  materializeNodeScaffoldProductionDependenciesInternalV2,
  readExactNpmLockRegularFileInternalV2,
  removeRawNpmInstallExactOwnedObjectsInternalV2,
  revalidateNodeScaffoldProductionDependenciesInternalV2,
  sealNpmDependencyTreeInternalV2,
} from "../../src/product-compiler/node-scaffold-production-materialization-v2.js";

const CLI_PROFILE = "PROFILE_NODE_CLI_STATELESS_EXACT_V2";
const API_PROFILE = "PROFILE_NODE_EXPRESS_API_STATELESS_EXACT_V2";
const MATERIALIZATION_CONTRACT_HASH_GOLDEN_V2 =
  "ff500697916133a9961fb4dc6ab5317a99b8419e2ce96e194a951ecae2e7647b";

type LockV3 = Readonly<{
  name: string;
  version: string;
  packages: Readonly<Record<string, Readonly<Record<string, unknown>>>>;
}>;

function packageName(packagePath: string): string {
  const segments = packagePath.split("/");
  const index = segments.lastIndexOf("node_modules");
  return segments[index + 1]!.startsWith("@")
    ? `${segments[index + 1]}/${segments[index + 2]}`
    : segments[index + 1]!;
}

async function makeWritable(absolutePath: string): Promise<void> {
  let stat;
  try {
    stat = await lstat(absolutePath);
  } catch {
    return;
  }
  if (stat.isSymbolicLink()) return;
  if (stat.isDirectory()) {
    await chmod(absolutePath, 0o700);
    for (const name of await readdir(absolutePath)) {
      await makeWritable(path.join(absolutePath, name));
    }
  } else if (stat.isFile()) {
    await chmod(absolutePath, 0o600);
  }
}

async function createInstalledFixture(
  profileId: typeof CLI_PROFILE | typeof API_PROFILE,
): Promise<Readonly<{
  scratchRoot: string;
  bundleRoot: string;
  nodeModulesRoot: string;
  closure: ReturnType<typeof deriveCodeOwnedNodeScaffoldProductionClosureV2>;
}>> {
  const scratchRoot = await realpath(await mkdtemp(path.join(
    os.tmpdir(),
    "setfarm-production-materialization-v2-",
  )));
  const bundleRoot = path.join(scratchRoot, "candidate-bundle");
  const nodeModulesRoot = path.join(bundleRoot, "node_modules");
  await mkdir(nodeModulesRoot, { recursive: true, mode: 0o700 });
  await Promise.all([
    chmod(bundleRoot, 0o700),
    chmod(nodeModulesRoot, 0o700),
  ]);
  const lockText = profileId === CLI_PROFILE
    ? NODE_CLI_PACKAGE_LOCK_JSON_TEXT_V2
    : NODE_EXPRESS_API_PACKAGE_LOCK_JSON_TEXT_V2;
  await writeFile(path.join(bundleRoot, "package-lock.json"), lockText, {
    mode: 0o600,
  });
  await chmod(path.join(bundleRoot, "package-lock.json"), 0o444);
  const rootLock = JSON.parse(lockText) as LockV3;
  const closure = deriveCodeOwnedNodeScaffoldProductionClosureV2(profileId);
  const hiddenPackages: Record<string, Readonly<Record<string, unknown>>> = {};
  for (const node of closure.nodes) {
    const lockEntry = rootLock.packages[node.packagePath];
    assert.ok(lockEntry);
    hiddenPackages[node.packagePath] = structuredClone(lockEntry);
    const relativePackage = node.packagePath.slice("node_modules/".length);
    const packageRoot = path.join(nodeModulesRoot, ...relativePackage.split("/"));
    await mkdir(packageRoot, { recursive: true, mode: 0o700 });
    await chmod(packageRoot, 0o700);
    await writeFile(path.join(packageRoot, "package.json"), `${JSON.stringify({
      name: node.packageName,
      version: node.version,
    })}\n`, { mode: 0o600 });
    await writeFile(path.join(packageRoot, "runtime.js"),
      `export const packageName = ${JSON.stringify(node.packageName)};\n`, {
        mode: 0o600,
      });

    const rawBin = lockEntry.bin;
    const commands: Array<readonly [string, string]> = typeof rawBin === "string"
      ? [[packageName(node.packagePath).split("/").at(-1)!, rawBin]]
      : rawBin && typeof rawBin === "object" && !Array.isArray(rawBin)
        ? Object.entries(rawBin).map(([command, target]) =>
            [command, String(target)] as const)
        : [];
    const segments = node.packagePath.split("/");
    const nodeModulesIndex = segments.lastIndexOf("node_modules");
    const container = segments.slice(0, nodeModulesIndex + 1).join("/");
    for (const [command, target] of commands) {
      const targetPath = path.join(packageRoot, ...target.split("/"));
      await mkdir(path.dirname(targetPath), { recursive: true, mode: 0o700 });
      await writeFile(targetPath, "#!/usr/bin/env node\n", { mode: 0o700 });
      await chmod(targetPath, 0o700);
      const relativeContainer = container === "node_modules"
        ? ""
        : container.slice("node_modules/".length);
      const binRoot = relativeContainer
        ? path.join(nodeModulesRoot, ...relativeContainer.split("/"), ".bin")
        : path.join(nodeModulesRoot, ".bin");
      await mkdir(binRoot, { recursive: true, mode: 0o700 });
      await chmod(binRoot, 0o700);
      const fullTarget = `${node.packagePath}/${target}`;
      const fullLink = `${container}/.bin/${command}`;
      await symlink(
        path.posix.relative(path.posix.dirname(fullLink), fullTarget),
        path.join(binRoot, command),
      );
    }
  }
  await writeFile(path.join(nodeModulesRoot, ".package-lock.json"),
    `${JSON.stringify({
      name: rootLock.name,
      version: rootLock.version,
      lockfileVersion: 3,
      requires: true,
      packages: hiddenPackages,
    })}\n`, { mode: 0o600 });
  return Object.freeze({
    scratchRoot,
    bundleRoot,
    nodeModulesRoot,
    closure,
  });
}

async function cleanupFixture(scratchRoot: string): Promise<void> {
  await makeWritable(scratchRoot);
  await rm(scratchRoot, { recursive: true, force: true });
}

function expectCode(
  operation: () => unknown,
  code: NodeScaffoldProductionMaterializationErrorV2["code"],
): void {
  assert.throws(operation, (error: unknown) =>
    error instanceof NodeScaffoldProductionMaterializationErrorV2
    && error.code === code);
}

describe("Node scaffold production materialization V2", () => {
  it("bounds exact reads before allocation and preserves the growth and close causes", async () => {
    const root = await realpath(await mkdtemp(path.join(
      os.tmpdir(),
      "setfarm-production-exact-read-growth-v2-",
    )));
    const lockPath = path.join(root, "package-lock.json");
    try {
      await chmod(root, 0o700);
      await writeFile(lockPath, "bounded\n", { mode: 0o600 });
      assert.throws(
        () => readExactNpmLockRegularFileInternalV2({
          absolutePath: lockPath,
          label: "Injected exact lock",
          maxBytes: 1_024,
          beforeReadForTest: () => appendFileSync(lockPath, "growth\n"),
          afterDescriptorCloseForTest: () => {
            throw new Error("INJECTED_EXACT_READ_CLOSE_FAILURE");
          },
        }),
        (error: unknown) =>
          error instanceof NodeScaffoldProductionMaterializationErrorV2
          && error.code === "NODE_SCAFFOLD_PRODUCTION_MATERIALIZATION_V2_INSTALL_TREE_INVALID"
          && error.cause instanceof AggregateError
          && error.cause.errors.length === 2
          && error.cause.errors[0] instanceof NodeScaffoldProductionMaterializationErrorV2
          && /changed while it was captured/u.test(error.cause.errors[0].message)
          && error.cause.errors[1] instanceof Error
          && error.cause.errors[1].message === "INJECTED_EXACT_READ_CLOSE_FAILURE",
      );
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("stops a growing install file at its admitted size and still reports close failure", async () => {
    const root = await realpath(await mkdtemp(path.join(
      os.tmpdir(),
      "setfarm-production-hash-growth-v2-",
    )));
    const installedFile = path.join(root, "package.json");
    try {
      await chmod(root, 0o700);
      await writeFile(installedFile, "{}\n", { mode: 0o600 });
      assert.throws(
        () => captureRawNpmInstallTreeInternalV2(root, {
          beforeFileRead: (locator) => {
            if (locator === "package.json") appendFileSync(installedFile, "growth\n");
          },
          afterFileDescriptorClose: (locator) => {
            if (locator === "package.json") {
              throw new Error("INJECTED_HASH_CLOSE_FAILURE");
            }
          },
        }),
        (error: unknown) =>
          error instanceof NodeScaffoldProductionMaterializationErrorV2
          && error.code === "NODE_SCAFFOLD_PRODUCTION_MATERIALIZATION_V2_INSTALL_TREE_INVALID"
          && error.cause instanceof AggregateError
          && error.cause.errors.length === 2
          && error.cause.errors[0] instanceof NodeScaffoldProductionMaterializationErrorV2
          && /exceeded its admitted byte length/u.test(error.cause.errors[0].message)
          && error.cause.errors[1] instanceof Error
          && error.cause.errors[1].message === "INJECTED_HASH_CLOSE_FAILURE",
      );
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("bounds raw directory enumeration before materializing the full namespace", async () => {
    const root = await realpath(await mkdtemp(path.join(
      os.tmpdir(),
      "setfarm-production-directory-bound-v2-",
    )));
    try {
      await chmod(root, 0o700);
      await Promise.all([
        writeFile(path.join(root, "a"), "a", { mode: 0o600 }),
        writeFile(path.join(root, "b"), "b", { mode: 0o600 }),
      ]);
      assert.throws(
        () => captureRawNpmInstallTreeInternalV2(root, {
          maxDirectoryEntriesForTest: 1,
        }),
        (error: unknown) =>
          error instanceof NodeScaffoldProductionMaterializationErrorV2
          && /exceeded its fixed membership bound/u.test(error.message),
      );
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("preserves path-sync primary and descriptor-close failures in order", async () => {
    const root = await realpath(await mkdtemp(path.join(
      os.tmpdir(),
      "setfarm-production-sync-finalizer-v2-",
    )));
    const member = path.join(root, "member.js");
    try {
      await chmod(root, 0o700);
      await writeFile(member, "export {};\n", { mode: 0o600 });
      assert.throws(
        () => sealNpmDependencyTreeInternalV2(root, {
          beforePathSync: (absolutePath) => {
            if (absolutePath === member) throw new Error("INJECTED_SYNC_PRIMARY");
          },
          afterPathDescriptorClose: (absolutePath) => {
            if (absolutePath === member) throw new Error("INJECTED_SYNC_CLOSE");
          },
        }),
        (error: unknown) =>
          error instanceof NodeScaffoldProductionMaterializationErrorV2
          && error.cause instanceof AggregateError
          && error.cause.errors.length === 2
          && error.cause.errors[0] instanceof Error
          && error.cause.errors[0].message === "INJECTED_SYNC_PRIMARY"
          && error.cause.errors[1] instanceof Error
          && error.cause.errors[1].message === "INJECTED_SYNC_CLOSE",
      );
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("treats source-only empty cleanup selection as a census-free no-op", () => {
    assert.doesNotThrow(() => removeRawNpmInstallExactOwnedObjectsInternalV2({
      entries: Object.freeze([]),
      nodeModulesRoot: path.join(os.tmpdir(), "source-only-node-modules-not-created"),
      locators: [],
      onFailure: (message, cause) => {
        throw new Error(message, { cause });
      },
    }));
  });

  it("fences exact hidden-lock and bin targets after the raw snapshot", async () => {
    const root = await realpath(await mkdtemp(path.join(
      os.tmpdir(),
      "setfarm-production-census-v2-",
    )));
    const hiddenLock = path.join(root, ".package-lock.json");
    const binRoot = path.join(root, ".bin");
    const hiddenLockBackup = `${hiddenLock}.old`;
    const binRootBackup = `${binRoot}.old`;
    const rootBackup = `${root}.old`;
    try {
      await chmod(root, 0o700);
      await writeFile(hiddenLock, "original\n", { mode: 0o600 });
      await mkdir(binRoot, { mode: 0o700 });
      const entries = captureRawNpmInstallTreeInternalV2(root);
      const assertReplacement = (locator: string): void => {
        assertRawNpmInstallObjectCurrentInternalV2({
          entries,
          nodeModulesRoot: root,
          locator,
          expected: getRawNpmInstallExactObjectIdentityInternalV2(
            entries,
            locator,
          ),
          onFailure: (message) => {
            throw new Error(message);
          },
        });
      };
      await rename(hiddenLock, hiddenLockBackup);
      await writeFile(hiddenLock, "replacement\n", { mode: 0o600 });
      assert.throws(
        () => assertReplacement(".package-lock.json"),
        /was replaced or changed/,
      );
      await rename(binRoot, binRootBackup);
      await mkdir(binRoot, { mode: 0o700 });
      assert.throws(
        () => assertReplacement(".bin"),
        /was replaced or changed/,
      );
      await rename(root, rootBackup);
      await mkdir(root, { mode: 0o700 });
      assert.throws(
        () => assertReplacement(".bin"),
        /root was replaced or changed/,
      );
      await rm(root, { recursive: true, force: true });
      await rename(rootBackup, root);
    } finally {
      await rm(root, { recursive: true, force: true });
      await rm(rootBackup, { recursive: true, force: true });
    }
  });

  it("preserves a foreign bin descendant instead of recursively deleting it", async () => {
    const root = await realpath(await mkdtemp(path.join(
      os.tmpdir(),
      "setfarm-production-cleanup-census-v2-",
    )));
    const binRoot = path.join(root, ".bin");
    const owned = path.join(binRoot, "owned");
    const displaced = `${root}.owned`;
    const canary = path.join(owned, "foreign", "canary.txt");
    try {
      await chmod(root, 0o700);
      await mkdir(owned, { recursive: true, mode: 0o700 });
      await writeFile(path.join(owned, "payload.txt"), "owned\n", {
        mode: 0o600,
      });
      const entries = captureRawNpmInstallTreeInternalV2(root);
      await rename(owned, displaced);
      await mkdir(path.dirname(canary), { recursive: true, mode: 0o700 });
      await writeFile(canary, "foreign\n", { mode: 0o600 });

      assert.throws(
        () => removeRawNpmInstallExactOwnedObjectsInternalV2({
          entries,
          nodeModulesRoot: root,
          locators: [".bin"],
          onFailure: (message, cause) => {
            throw new Error(message, { cause });
          },
        }),
        /was replaced or changed/,
      );
      assert.equal(await readFile(canary, "utf8"), "foreign\n");
      assert.equal((await lstat(binRoot)).isDirectory(), true);
    } finally {
      await rm(root, { recursive: true, force: true });
      await rm(displaced, { recursive: true, force: true });
    }
  });

  it("removes an admitted 0555 bin tree through exact descriptor-bound chmod", async () => {
    const root = await realpath(await mkdtemp(path.join(
      os.tmpdir(),
      "setfarm-production-readonly-bin-v2-",
    )));
    const nodeModulesParent = path.join(root, "package", "node_modules");
    const packageRoot = path.join(root, "package");
    const binRoot = path.join(nodeModulesParent, ".bin");
    const sentinel = path.join(nodeModulesParent, "keep.txt");
    try {
      await chmod(root, 0o700);
      await mkdir(binRoot, { recursive: true, mode: 0o700 });
      await writeFile(path.join(binRoot, "tool"), "#!/bin/sh\n", { mode: 0o500 });
      await writeFile(sentinel, "keep\n", { mode: 0o600 });
      await chmod(binRoot, 0o555);
      await chmod(nodeModulesParent, 0o555);
      await chmod(packageRoot, 0o555);
      await chmod(root, 0o555);
      const entries = captureRawNpmInstallTreeInternalV2(root);

      removeRawNpmInstallExactOwnedObjectsInternalV2({
        entries,
        nodeModulesRoot: root,
        locators: ["package/node_modules/.bin"],
        onFailure: (message, cause) => {
          throw new Error(message, { cause });
        },
      });

      await assert.rejects(lstat(binRoot), { code: "ENOENT" });
      assert.equal(await readFile(sentinel, "utf8"), "keep\n");
      assert.equal((await lstat(nodeModulesParent)).mode & 0o7777, 0o555);
      assert.equal((await lstat(packageRoot)).mode & 0o7777, 0o555);
      assert.equal((await lstat(root)).mode & 0o7777, 0o555);
    } finally {
      await makeWritable(root);
      await rm(root, { recursive: true, force: true });
    }
  });

  it("restores every surviving directory mode when exact cleanup fails after chmod", async () => {
    const root = await realpath(await mkdtemp(path.join(
      os.tmpdir(),
      "setfarm-production-readonly-bin-failure-v2-",
    )));
    const packageRoot = path.join(root, "package");
    const nodeModulesParent = path.join(packageRoot, "node_modules");
    const binRoot = path.join(nodeModulesParent, ".bin");
    const tool = path.join(binRoot, "tool");
    try {
      await chmod(root, 0o700);
      await mkdir(binRoot, { recursive: true, mode: 0o700 });
      await writeFile(tool, "#!/bin/sh\n", { mode: 0o500 });
      await chmod(binRoot, 0o555);
      await chmod(nodeModulesParent, 0o555);
      await chmod(packageRoot, 0o555);
      await chmod(root, 0o555);
      const entries = captureRawNpmInstallTreeInternalV2(root);

      assert.throws(
        () => removeRawNpmInstallExactOwnedObjectsInternalV2({
          entries,
          nodeModulesRoot: root,
          locators: ["package/node_modules/.bin"],
          afterDirectoryWritableForTest: (locator) => {
            if (locator === "package/node_modules/.bin") {
              throw new Error("INJECTED_AFTER_DIRECTORY_CHMOD");
            }
          },
          onFailure: (message, cause) => {
            throw new Error(message, { cause });
          },
        }),
        /could not be made owner-writable through its exact descriptor/,
      );
      assert.equal(await readFile(tool, "utf8"), "#!/bin/sh\n");
      assert.equal((await lstat(binRoot)).mode & 0o7777, 0o555);
      assert.equal((await lstat(nodeModulesParent)).mode & 0o7777, 0o555);
      assert.equal((await lstat(packageRoot)).mode & 0o7777, 0o555);
      assert.equal((await lstat(root)).mode & 0o7777, 0o555);
    } finally {
      await makeWritable(root);
      await rm(root, { recursive: true, force: true });
    }
  });

  it("preserves chmod and descriptor-close failures while restoring every surviving mode", async () => {
    const root = await realpath(await mkdtemp(path.join(
      os.tmpdir(),
      "setfarm-production-readonly-bin-double-failure-v2-",
    )));
    const packageRoot = path.join(root, "package");
    const nodeModulesParent = path.join(packageRoot, "node_modules");
    const binRoot = path.join(nodeModulesParent, ".bin");
    const tool = path.join(binRoot, "tool");
    try {
      await chmod(root, 0o700);
      await mkdir(binRoot, { recursive: true, mode: 0o700 });
      await writeFile(tool, "#!/bin/sh\n", { mode: 0o500 });
      for (const directory of [binRoot, nodeModulesParent, packageRoot, root]) {
        await chmod(directory, 0o555);
      }
      const entries = captureRawNpmInstallTreeInternalV2(root);

      assert.throws(
        () => removeRawNpmInstallExactOwnedObjectsInternalV2({
          entries,
          nodeModulesRoot: root,
          locators: ["package/node_modules/.bin"],
          afterDirectoryWritableForTest: (locator) => {
            if (locator === "package/node_modules/.bin") {
              throw new Error("INJECTED_DIRECTORY_MUTATION_FAILURE");
            }
          },
          afterDirectoryDescriptorCloseForTest: (locator, phase) => {
            if (locator === "package/node_modules/.bin" && phase === "make_writable") {
              throw new Error("INJECTED_DESCRIPTOR_CLOSE_FAILURE");
            }
          },
          onFailure: (message, cause) => {
            throw new Error(message, { cause });
          },
        }),
        (error: unknown) =>
          error instanceof Error
          && error.cause instanceof AggregateError
          && error.cause.errors.length === 2
          && error.cause.errors[0] instanceof Error
          && error.cause.errors[0].message === "INJECTED_DIRECTORY_MUTATION_FAILURE"
          && error.cause.errors[1] instanceof Error
          && error.cause.errors[1].message === "INJECTED_DESCRIPTOR_CLOSE_FAILURE",
      );
      assert.equal(await readFile(tool, "utf8"), "#!/bin/sh\n");
      assert.equal((await lstat(binRoot)).mode & 0o7777, 0o555);
      assert.equal((await lstat(nodeModulesParent)).mode & 0o7777, 0o555);
      assert.equal((await lstat(packageRoot)).mode & 0o7777, 0o555);
      assert.equal((await lstat(root)).mode & 0o7777, 0o555);
    } finally {
      await makeWritable(root);
      await rm(root, { recursive: true, force: true });
    }
  });

  it("aggregates a restoration-close failure without losing the primary cleanup cause", async () => {
    const root = await realpath(await mkdtemp(path.join(
      os.tmpdir(),
      "setfarm-production-mode-restore-close-failure-v2-",
    )));
    const packageRoot = path.join(root, "package");
    const nodeModulesParent = path.join(packageRoot, "node_modules");
    const binRoot = path.join(nodeModulesParent, ".bin");
    const tool = path.join(binRoot, "tool");
    try {
      await chmod(root, 0o700);
      await mkdir(binRoot, { recursive: true, mode: 0o700 });
      await writeFile(tool, "#!/bin/sh\n", { mode: 0o500 });
      for (const directory of [binRoot, nodeModulesParent, packageRoot, root]) {
        await chmod(directory, 0o555);
      }
      const entries = captureRawNpmInstallTreeInternalV2(root);

      assert.throws(
        () => removeRawNpmInstallExactOwnedObjectsInternalV2({
          entries,
          nodeModulesRoot: root,
          locators: ["package/node_modules/.bin"],
          afterDirectoryWritableForTest: (locator) => {
            if (locator === "package/node_modules/.bin") {
              throw new Error("INJECTED_PRIMARY_CLEANUP_FAILURE");
            }
          },
          afterDirectoryDescriptorCloseForTest: (locator, phase) => {
            if (locator === "package/node_modules/.bin" && phase === "restore_mode") {
              throw new Error("INJECTED_MODE_RESTORE_CLOSE_FAILURE");
            }
          },
          onFailure: (message, cause) => {
            throw new Error(message, { cause });
          },
        }),
        (error: unknown) => {
          if (!(error instanceof Error) || !(error.cause instanceof AggregateError)) {
            return false;
          }
          const [primary, restoreClose] = error.cause.errors;
          return error.cause.errors.length === 2
            && primary instanceof Error
            && primary.cause instanceof Error
            && primary.cause.message === "INJECTED_PRIMARY_CLEANUP_FAILURE"
            && restoreClose instanceof Error
            && restoreClose.message === "INJECTED_MODE_RESTORE_CLOSE_FAILURE";
        },
      );
      assert.equal(await readFile(tool, "utf8"), "#!/bin/sh\n");
      assert.equal((await lstat(binRoot)).mode & 0o7777, 0o555);
      assert.equal((await lstat(nodeModulesParent)).mode & 0o7777, 0o555);
      assert.equal((await lstat(packageRoot)).mode & 0o7777, 0o555);
      assert.equal((await lstat(root)).mode & 0o7777, 0o555);
    } finally {
      await makeWritable(root);
      await rm(root, { recursive: true, force: true });
    }
  });

  it("seals and freshly reproduces the exact empty CLI production closure", async () => {
    const fixture = await createInstalledFixture(CLI_PROFILE);
    try {
      const materialized = materializeNodeScaffoldProductionDependenciesInternalV2({
        admissionScope: "test_fixture",
        nodeModulesRoot: fixture.nodeModulesRoot,
        productionClosure: fixture.closure,
      });
      assert.equal(
        NODE_SCAFFOLD_PRODUCTION_MATERIALIZATION_CONTRACT_HASH_V2,
        MATERIALIZATION_CONTRACT_HASH_GOLDEN_V2,
      );
      assert.equal(materialized.productionGraph.packageCount, 0);
      assert.deepEqual(materialized.productionGraph.packages, []);
      assert.equal(materialized.dependencyTree.fileCount, 0);
      assert.equal(materialized.dependencyTree.directoryCount, 0);
      assert.deepEqual(await readdir(fixture.nodeModulesRoot), []);
      assert.equal((await lstat(fixture.nodeModulesRoot)).mode & 0o7777, 0o555);
      const verified = revalidateNodeScaffoldProductionDependenciesInternalV2({
        admissionScope: "test_fixture",
        nodeModulesRoot: fixture.nodeModulesRoot,
        productionClosure: fixture.closure,
        dependencyTree: materialized.dependencyTree,
        productionGraph: materialized.productionGraph,
      });
      assert.equal(verified.productionGraph.resolutionGraphHash,
        materialized.productionGraph.resolutionGraphHash);
    } finally {
      await cleanupFixture(fixture.scratchRoot);
    }
  });

  it("derives every-and-only Express package graph from sealed package bytes", async () => {
    const fixture = await createInstalledFixture(API_PROFILE);
    try {
      const materialized = materializeNodeScaffoldProductionDependenciesInternalV2({
        admissionScope: "test_fixture",
        nodeModulesRoot: fixture.nodeModulesRoot,
        productionClosure: fixture.closure,
      });
      assert.equal(materialized.productionGraph.packageCount, 67);
      assert.equal(materialized.productionGraph.packages.length, 67);
      assert.equal(materialized.productionGraph.packages[0]?.packageLocator,
        "node_modules/accepts");
      assert.equal(materialized.productionGraph.packages.some((entry) =>
        entry.packageName === "typescript" || entry.packageName.startsWith("@types/")),
      false);
      const express = materialized.productionGraph.packages.find((entry) =>
        entry.packageLocator === "node_modules/express");
      assert.ok(express);
      assert.equal(express.version, "5.2.1");
      assert.equal(express.dependencyLocators.length > 10, true);
      assert.equal(new Set(materialized.productionGraph.packages.map((entry) =>
        entry.runtimeTreeHash)).size, 67);
      assert.equal((await lstat(path.join(
        fixture.nodeModulesRoot,
        "express",
        "package.json",
      ))).mode & 0o7777, 0o444);
      assert.equal((await readdir(fixture.nodeModulesRoot)).includes(
        ".package-lock.json"), false);
      const verified = revalidateNodeScaffoldProductionDependenciesInternalV2({
        admissionScope: "test_fixture",
        nodeModulesRoot: fixture.nodeModulesRoot,
        productionClosure: fixture.closure,
        dependencyTree: materialized.dependencyTree,
        productionGraph: materialized.productionGraph,
      });
      assert.equal(verified.dependencyTree.treeHash,
        materialized.dependencyTree.treeHash);
      assert.equal(verified.productionGraph.resolutionGraphHash,
        materialized.productionGraph.resolutionGraphHash);
    } finally {
      await cleanupFixture(fixture.scratchRoot);
    }
  });

  it("rejects incomplete lock membership, extra roots, source accessors and sealed drift", async () => {
    const incomplete = await createInstalledFixture(API_PROFILE);
    try {
      const hiddenPath = path.join(incomplete.nodeModulesRoot, ".package-lock.json");
      const hidden = JSON.parse(await readFile(hiddenPath, "utf8")) as {
        packages: Record<string, unknown>;
      };
      delete hidden.packages[Object.keys(hidden.packages).sort()[0]!];
      await writeFile(hiddenPath, `${JSON.stringify(hidden)}\n`, { mode: 0o600 });
      expectCode(
        () => materializeNodeScaffoldProductionDependenciesInternalV2({
          admissionScope: "test_fixture",
          nodeModulesRoot: incomplete.nodeModulesRoot,
          productionClosure: incomplete.closure,
        }),
        "NODE_SCAFFOLD_PRODUCTION_MATERIALIZATION_V2_LOCK_INVALID",
      );
    } finally {
      await cleanupFixture(incomplete.scratchRoot);
    }

    const extra = await createInstalledFixture(CLI_PROFILE);
    try {
      await mkdir(path.join(extra.nodeModulesRoot, "invented"), { mode: 0o700 });
      expectCode(
        () => materializeNodeScaffoldProductionDependenciesInternalV2({
          admissionScope: "test_fixture",
          nodeModulesRoot: extra.nodeModulesRoot,
          productionClosure: extra.closure,
        }),
        "NODE_SCAFFOLD_PRODUCTION_MATERIALIZATION_V2_INSTALL_TREE_INVALID",
      );
    } finally {
      await cleanupFixture(extra.scratchRoot);
    }

    let accessorRead = false;
    const accessor: Record<string, unknown> = {
      admissionScope: "test_fixture",
      nodeModulesRoot: "/tmp/candidate-bundle/node_modules",
    };
    Object.defineProperty(accessor, "productionClosure", {
      enumerable: true,
      get() {
        accessorRead = true;
        return deriveCodeOwnedNodeScaffoldProductionClosureV2(CLI_PROFILE);
      },
    });
    expectCode(
      () => materializeNodeScaffoldProductionDependenciesInternalV2(accessor),
      "NODE_SCAFFOLD_PRODUCTION_MATERIALIZATION_V2_INPUT_INVALID",
    );
    assert.equal(accessorRead, false);

    const drift = await createInstalledFixture(API_PROFILE);
    try {
      const materialized = materializeNodeScaffoldProductionDependenciesInternalV2({
        admissionScope: "test_fixture",
        nodeModulesRoot: drift.nodeModulesRoot,
        productionClosure: drift.closure,
      });
      const manifest = path.join(drift.nodeModulesRoot, "express", "package.json");
      await chmod(manifest, 0o600);
      await writeFile(manifest, "{\"name\":\"express\",\"version\":\"5.2.1\",\"drift\":true}\n");
      await chmod(manifest, 0o444);
      expectCode(
        () => revalidateNodeScaffoldProductionDependenciesInternalV2({
          admissionScope: "test_fixture",
          nodeModulesRoot: drift.nodeModulesRoot,
          productionClosure: drift.closure,
          dependencyTree: materialized.dependencyTree,
          productionGraph: materialized.productionGraph,
        }),
        "NODE_SCAFFOLD_PRODUCTION_MATERIALIZATION_V2_AUTHORITY_MISMATCH",
      );
    } finally {
      await cleanupFixture(drift.scratchRoot);
    }
  });
});
