import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  chmod,
  link,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, it } from "node:test";

import {
  inventoryVerifiedNodeToolchainDistributionArchiveV2,
  type InventoriedNodeToolchainDistributionV2,
} from "../../src/product-compiler/node-toolchain-archive-inventory-v2.js";
import {
  copyMaterializedNodeToolchainPrivateTreeBundleV2,
  disposeMaterializedNodeToolchainPrivateTreeV2,
  inspectNodeToolchainPrivateTreeReceiptV2,
  materializeInventoriedNodeToolchainPrivateTreeV2,
  materializeInventoriedNodeToolchainPrivateTreeV2ForTest,
  type MaterializedNodeToolchainPrivateTreeV2,
  type NodeToolchainPrivateTreeExtractionResultV2,
} from "../../src/product-compiler/node-toolchain-private-tree-v2.js";
import {
  disposeVerifiedNodeToolchainDistributionArchiveV2,
  verifyNodeToolchainDistributionArchiveV2ForTest,
  type VerifiedNodeToolchainDistributionArchiveV2,
} from "../../src/product-compiler/node-toolchain-distribution-authority-v2.js";
import {
  NodeToolchainPrivateTreeReceiptV2Schema,
  hashNodeToolchainPrivateTreeReceiptV2,
} from "../../src/product-compiler/schemas/node-toolchain-private-tree-v2.js";
import {
  NodeToolchainDistributionArtifactV2Schema,
  hashNodeToolchainDistributionArtifactV2,
} from "../../src/product-compiler/schemas/node-toolchain-distribution-v2.js";

const ARCHIVE_ROOT = "node-v22.23.1-darwin-arm64";
const roots: string[] = [];
const archives: VerifiedNodeToolchainDistributionArchiveV2[] = [];
const trees: MaterializedNodeToolchainPrivateTreeV2[] = [];

function sha256(bytes: Uint8Array | string): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function testArtifact(bytes: Uint8Array) {
  const identity = {
    schema: "setfarm.node-toolchain-distribution-artifact.v2" as const,
    artifactRef: "TEST_NODE_TOOLCHAIN_DISTRIBUTION_ARM64_V2",
    sourceAuthority: "test_fixture" as const,
    architecture: "arm64" as const,
    origin: "https://example.invalid/node-test.tar.xz",
    fileName: "node-test.tar.xz",
    mediaType: "application/x-xz" as const,
    archiveFormat: "tar_xz" as const,
    archiveRoot: ARCHIVE_ROOT,
    byteLength: bytes.byteLength,
    sha256: sha256(bytes),
    expectedRuntime: {
      nodeVersion: "22.23.1" as const,
      modulesAbi: "127" as const,
      napiVersion: "10" as const,
      npmVersion: "10.9.8" as const,
      platform: "darwin" as const,
      architecture: "arm64" as const,
    },
    selection: {
      nodeExecutableLocator: "bin/node" as const,
      npmPackageRootLocator: "lib/node_modules/npm" as const,
      npmCliLocator: "lib/node_modules/npm/bin/npm-cli.js" as const,
      npmPackageJsonLocator: "lib/node_modules/npm/package.json" as const,
      npmBuiltinConfigLocator: "lib/node_modules/npm/npmrc" as const,
      npmBuiltinConfigExpectation: "absent" as const,
      discardUnselectedArchiveEntries: true as const,
    },
  };
  return NodeToolchainDistributionArtifactV2Schema.parse({
    ...identity,
    artifactHash: hashNodeToolchainDistributionArtifactV2(identity),
  });
}

async function inventoriedFixture(): Promise<InventoriedNodeToolchainDistributionV2> {
  const root = await mkdtemp(path.join(tmpdir(), "setfarm-node-private-tree-fixture-v2-"));
  roots.push(root);
  const source = path.join(root, "source", ARCHIVE_ROOT);
  const npmRoot = path.join(source, "lib", "node_modules", "npm");
  await mkdir(path.join(source, "bin"), { recursive: true });
  await mkdir(path.join(npmRoot, "bin"), { recursive: true });
  await writeFile(path.join(source, "bin", "node"), "node-binary\n", { mode: 0o755 });
  await writeFile(path.join(npmRoot, "bin", "npm-cli.js"), "// npm cli\n", { mode: 0o755 });
  await writeFile(path.join(npmRoot, "package.json"), "{\"name\":\"npm\",\"version\":\"10.9.8\"}\n");
  await writeFile(path.join(npmRoot, ".npmrc"), "");
  await symlink("../lib/node_modules/npm/bin/npm-cli.js", path.join(source, "bin", "npm"));
  const archivePath = path.join(root, "fixture.tar.xz");
  execFileSync("/usr/bin/tar", ["-cJf", archivePath, "-C", path.dirname(source), ARCHIVE_ROOT], {
    env: { LANG: "C", LC_ALL: "C", TZ: "UTC" },
    stdio: "pipe",
  });
  await chmod(archivePath, 0o600);
  const bytes = await readFile(archivePath);
  const archive = await verifyNodeToolchainDistributionArchiveV2ForTest({
    archivePath,
    artifact: testArtifact(bytes),
    manifestHash: "a".repeat(64),
  });
  archives.push(archive);
  return inventoryVerifiedNodeToolchainDistributionArchiveV2(archive);
}

function track(tree: MaterializedNodeToolchainPrivateTreeV2): MaterializedNodeToolchainPrivateTreeV2 {
  trees.push(tree);
  return tree;
}

afterEach(async () => {
  await Promise.all(trees.splice(0).map(async (tree) => {
    try {
      await disposeMaterializedNodeToolchainPrivateTreeV2(tree);
    } catch {
      // Preserve the original test failure.
    }
  }));
  await Promise.all(archives.splice(0).map(async (archive) => {
    try {
      await disposeVerifiedNodeToolchainDistributionArchiveV2(archive);
    } catch {
      // Preserve the original test failure.
    }
  }));
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
  assert.deepEqual(
    (await readdir("/private/tmp")).filter((name) => name.startsWith("setfarm-node-toolchain-tree-v2-")),
    [],
  );
});

describe("NodeToolchainPrivateTreeV2", () => {
  it("extracts only selected members and produces one normalized pathless tree", async () => {
    const tree = track(await materializeInventoriedNodeToolchainPrivateTreeV2(await inventoriedFixture()));
    const receipt = inspectNodeToolchainPrivateTreeReceiptV2(tree);
    assert.equal(receipt.status, "materialized_verified");
    assert.equal(receipt.admissionScope, "test_fixture");
    assert.equal(receipt.tree.rootMode, "0555");
    assert.equal(receipt.tree.fileCount, 4);
    assert.equal(receipt.tree.directoryCount, 5);
    assert.equal(receipt.materializer.selectedMemberCount, 10);
    assert.equal(receipt.tree.node.mode, "0555");
    assert.equal(receipt.tree.node.contentHash, sha256("node-binary\n"));
    assert.equal(receipt.tree.npm.builtinNpmrc.status, "absent");
    assert.equal(NodeToolchainPrivateTreeReceiptV2Schema.parse(receipt).receiptHash, receipt.receiptHash);
    assert.equal(Object.isFrozen(receipt), true);
    assert.doesNotMatch(JSON.stringify(receipt), /setfarm-node-private-tree|fixture\.tar|\/private\/|\/var\//);

    const bundle = await copyMaterializedNodeToolchainPrivateTreeBundleV2(tree);
    assert.deepEqual(bundle.entries.map((entry) => entry.locator), [
      ".",
      "bin",
      "bin/node",
      "lib",
      "lib/node_modules",
      "lib/node_modules/npm",
      "lib/node_modules/npm/.npmrc",
      "lib/node_modules/npm/bin",
      "lib/node_modules/npm/bin/npm-cli.js",
      "lib/node_modules/npm/package.json",
    ]);
    assert.equal(bundle.entries.find((entry) => entry.locator === "bin/node")?.mode, "0555");
    assert.equal(bundle.entries.find((entry) => entry.locator.endsWith("package.json"))?.mode, "0444");
    const node = bundle.entries.find((entry) => entry.locator === "bin/node");
    assert.ok(node?.bytes);
    node.bytes.fill(0);
    const second = await copyMaterializedNodeToolchainPrivateTreeBundleV2(tree);
    const secondNode = second.entries.find((entry) => entry.locator === "bin/node");
    assert.equal(secondNode?.contentHash, sha256("node-binary\n"));
    assert.deepEqual(secondNode?.bytes, Buffer.from("node-binary\n"));
  });

  it("classifies bounded extraction failures before a tree exists", async () => {
    const inventory = await inventoriedFixture();
    const failures: Array<readonly [NodeToolchainPrivateTreeExtractionResultV2, string]> = [
      [{ status: "timed_out", stdout: "", stderr: "" }, "NODE_TOOLCHAIN_PRIVATE_TREE_V2_EXTRACT_TIMEOUT"],
      [{ status: "output_limit_exceeded", stdout: "", stderr: "" },
        "NODE_TOOLCHAIN_PRIVATE_TREE_V2_EXTRACT_OUTPUT_LIMIT"],
      [{ status: "spawn_failed", stdout: "", stderr: "" },
        "NODE_TOOLCHAIN_PRIVATE_TREE_V2_EXTRACT_SPAWN_FAILED"],
      [{ status: "exited", exitCode: null, signal: "SIGKILL", stdout: "", stderr: "" },
        "NODE_TOOLCHAIN_PRIVATE_TREE_V2_EXTRACT_SIGNALLED"],
      [{ status: "exited", exitCode: 2, signal: null, stdout: "", stderr: "bad" },
        "NODE_TOOLCHAIN_PRIVATE_TREE_V2_EXTRACT_NONZERO"],
    ];
    for (const [result, code] of failures) {
      await assert.rejects(materializeInventoriedNodeToolchainPrivateTreeV2ForTest(inventory, {
        extractorAdapter: async () => result,
      }), { code });
    }
  });

  it("rejects raw extra, symlink and hard-link entries after real extraction", async () => {
    const inventory = await inventoriedFixture();
    await assert.rejects(materializeInventoriedNodeToolchainPrivateTreeV2ForTest(inventory, {
      testHooks: {
        afterExtraction: async ({ rawArchiveRoot }) => {
          await writeFile(path.join(rawArchiveRoot, "extra"), "extra");
        },
      },
    }), { code: "NODE_TOOLCHAIN_PRIVATE_TREE_V2_RAW_TREE_INVALID" });

    await assert.rejects(materializeInventoriedNodeToolchainPrivateTreeV2ForTest(inventory, {
      testHooks: {
        afterExtraction: async ({ rawArchiveRoot }) => {
          const packageJson = path.join(rawArchiveRoot, "lib", "node_modules", "npm", "package.json");
          await rm(packageJson);
          await symlink("bin/npm-cli.js", packageJson);
        },
      },
    }), { code: "NODE_TOOLCHAIN_PRIVATE_TREE_V2_RAW_TREE_INVALID" });

    await assert.rejects(materializeInventoriedNodeToolchainPrivateTreeV2ForTest(inventory, {
      testHooks: {
        afterExtraction: async ({ rawArchiveRoot }) => {
          const node = path.join(rawArchiveRoot, "bin", "node");
          const packageJson = path.join(rawArchiveRoot, "lib", "node_modules", "npm", "package.json");
          await rm(packageJson);
          await link(node, packageJson);
        },
      },
    }), { code: "NODE_TOOLCHAIN_PRIVATE_TREE_V2_RAW_TREE_INVALID" });
  });

  it("rejects archive and selected-list mutation during extraction", async () => {
    const inventory = await inventoriedFixture();
    await assert.rejects(materializeInventoriedNodeToolchainPrivateTreeV2ForTest(inventory, {
      extractorAdapter: async (invocation) => {
        await writeFile(invocation.argv[1]!, "changed");
        return { status: "exited", exitCode: 0, signal: null, stdout: "", stderr: "" };
      },
    }), { code: "NODE_TOOLCHAIN_PRIVATE_TREE_V2_STAGE_INVALID" });

    await assert.rejects(materializeInventoriedNodeToolchainPrivateTreeV2ForTest(inventory, {
      extractorAdapter: async (invocation) => {
        await writeFile(invocation.argv.at(-1)!, "changed");
        return { status: "exited", exitCode: 0, signal: null, stdout: "", stderr: "" };
      },
    }), { code: "NODE_TOOLCHAIN_PRIVATE_TREE_V2_STAGE_INVALID" });
  });

  it("rejects normalized tree mutation before issuing authority", async () => {
    await assert.rejects(materializeInventoriedNodeToolchainPrivateTreeV2ForTest(await inventoriedFixture(), {
      testHooks: {
        afterNormalized: async ({ treeRoot }) => {
          const node = path.join(treeRoot, "bin", "node");
          await chmod(node, 0o755);
          await writeFile(node, "mutated\n");
          await chmod(node, 0o555);
        },
      },
    }), { code: "NODE_TOOLCHAIN_PRIVATE_TREE_V2_NORMALIZED_TREE_INVALID" });
  });

  it("keeps tree authority handle-only and disposal exact and idempotent", async () => {
    const tree = track(await materializeInventoriedNodeToolchainPrivateTreeV2(await inventoriedFixture()));
    const receipt = inspectNodeToolchainPrivateTreeReceiptV2(tree);
    assert.throws(() => inspectNodeToolchainPrivateTreeReceiptV2(receipt as never), {
      code: "NODE_TOOLCHAIN_PRIVATE_TREE_V2_HANDLE_UNAUTHENTICATED",
    });
    await assert.rejects(copyMaterializedNodeToolchainPrivateTreeBundleV2(receipt as never), {
      code: "NODE_TOOLCHAIN_PRIVATE_TREE_V2_HANDLE_UNAUTHENTICATED",
    });
    assert.throws(() => inspectNodeToolchainPrivateTreeReceiptV2(new Proxy(tree, {}) as never), {
      code: "NODE_TOOLCHAIN_PRIVATE_TREE_V2_HANDLE_UNAUTHENTICATED",
    });
    const { receiptHash: _receiptHash, ...payload } = receipt;
    const forged = {
      ...payload,
      tree: { ...payload.tree, treeHash: "b".repeat(64) },
      receiptHash: "c".repeat(64),
    };
    forged.receiptHash = hashNodeToolchainPrivateTreeReceiptV2(forged);
    assert.equal(NodeToolchainPrivateTreeReceiptV2Schema.safeParse(forged).success, true);
    assert.throws(() => inspectNodeToolchainPrivateTreeReceiptV2(forged as never), {
      code: "NODE_TOOLCHAIN_PRIVATE_TREE_V2_HANDLE_UNAUTHENTICATED",
    });
    const wrongMode = structuredClone(receipt);
    (wrongMode.tree.node as { mode: string }).mode = "0444";
    wrongMode.receiptHash = hashNodeToolchainPrivateTreeReceiptV2(wrongMode as never);
    assert.equal(NodeToolchainPrivateTreeReceiptV2Schema.safeParse(wrongMode).success, false);
    const wrongTopology = structuredClone(receipt);
    wrongTopology.tree.directoryCount += 1;
    wrongTopology.receiptHash = hashNodeToolchainPrivateTreeReceiptV2(wrongTopology as never);
    assert.equal(NodeToolchainPrivateTreeReceiptV2Schema.safeParse(wrongTopology).success, false);
    await disposeMaterializedNodeToolchainPrivateTreeV2(tree);
    assert.throws(() => inspectNodeToolchainPrivateTreeReceiptV2(tree), {
      code: "NODE_TOOLCHAIN_PRIVATE_TREE_V2_HANDLE_DISPOSED",
    });
    await disposeMaterializedNodeToolchainPrivateTreeV2(tree);
  });

  it("materializes concurrent private stages with one deterministic receipt", async () => {
    const inventory = await inventoriedFixture();
    const [left, right] = await Promise.all([
      materializeInventoriedNodeToolchainPrivateTreeV2(inventory),
      materializeInventoriedNodeToolchainPrivateTreeV2(inventory),
    ]);
    trees.push(left, right);
    assert.notEqual(left, right);
    assert.equal(
      inspectNodeToolchainPrivateTreeReceiptV2(left).receiptHash,
      inspectNodeToolchainPrivateTreeReceiptV2(right).receiptHash,
    );
  });
});
