import assert from "node:assert/strict";
import {
  chmod,
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  realpath,
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
  materializeNodeScaffoldProductionDependenciesInternalV2,
  revalidateNodeScaffoldProductionDependenciesInternalV2,
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
