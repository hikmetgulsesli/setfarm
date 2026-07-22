import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  chmod,
  lstat,
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

import { canonicalJsonBytes } from "../../src/product-compiler/canonical-json.js";
import {
  createHostNodeToolchainAuthorityV2ForTest,
  inspectHostNodeToolchainReceiptV2,
  revalidateHostNodeToolchainAuthorityV2,
  type HostNodeToolchainProbeResultV2,
} from "../../src/product-compiler/host-node-toolchain-authority-v2.js";
import {
  inventoryVerifiedNodeToolchainDistributionArchiveV2,
} from "../../src/product-compiler/node-toolchain-archive-inventory-v2.js";
import {
  disposeMaterializedNodeToolchainPrivateTreeV2,
  materializeInventoriedNodeToolchainPrivateTreeV2ForTest,
  type MaterializedNodeToolchainPrivateTreeV2,
} from "../../src/product-compiler/node-toolchain-private-tree-v2.js";
import {
  inspectNodeToolchainProvisioningReceiptV2,
  isProductionProvisionedNodeToolchainV2,
  openProvisionedNodeToolchainV2ForTest,
  provisionNodeToolchainV2,
  provisionNodeToolchainV2ForTest,
  revalidateProvisionedNodeToolchainV2,
  type ProvisionedNodeToolchainV2,
} from "../../src/product-compiler/node-toolchain-provisioning-v2.js";
import {
  getCodeOwnedNodeToolchainTargetV2,
} from "../../src/product-compiler/node-toolchain-target-registry-v2.js";
import {
  disposeVerifiedNodeToolchainDistributionArchiveV2,
  verifyNodeToolchainDistributionArchiveV2ForTest,
  type VerifiedNodeToolchainDistributionArchiveV2,
} from "../../src/product-compiler/node-toolchain-distribution-authority-v2.js";
import {
  NodeToolchainDistributionArtifactV2Schema,
  hashNodeToolchainDistributionArtifactV2,
} from "../../src/product-compiler/schemas/node-toolchain-distribution-v2.js";
import {
  NodeToolchainProvisioningReceiptV2Schema,
  hashNodeToolchainProvisioningReceiptV2,
} from "../../src/product-compiler/schemas/node-toolchain-provisioning-v2.js";

const ARCHIVE_ROOT = "node-v22.23.1-darwin-arm64";
const roots: string[] = [];
const archives: VerifiedNodeToolchainDistributionArchiveV2[] = [];
const trees: MaterializedNodeToolchainPrivateTreeV2[] = [];
const provisioned: ProvisionedNodeToolchainV2[] = [];

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

async function privateTree(nodeBytes = "node-binary\n"): Promise<MaterializedNodeToolchainPrivateTreeV2> {
  const root = await mkdtemp(path.join(tmpdir(), "setfarm-node-provisioning-fixture-v2-"));
  roots.push(root);
  const source = path.join(root, "source", ARCHIVE_ROOT);
  const npmRoot = path.join(source, "lib", "node_modules", "npm");
  await mkdir(path.join(source, "bin"), { recursive: true });
  await mkdir(path.join(npmRoot, "bin"), { recursive: true });
  await writeFile(path.join(source, "bin", "node"), nodeBytes, { mode: 0o755 });
  await writeFile(path.join(npmRoot, "bin", "npm-cli.js"), "// npm cli\n", { mode: 0o755 });
  await writeFile(
    path.join(npmRoot, "package.json"),
    "{\"name\":\"npm\",\"version\":\"10.9.8\",\"bin\":{\"npm\":\"bin/npm-cli.js\"}}\n",
  );
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
  const scratchParent = path.join(root, "private-tree-scratch");
  await mkdir(scratchParent, { mode: 0o700 });
  await chmod(scratchParent, 0o700);
  const tree = await materializeInventoriedNodeToolchainPrivateTreeV2ForTest(
    await inventoryVerifiedNodeToolchainDistributionArchiveV2(archive),
    { scratchParent },
  );
  trees.push(tree);
  return tree;
}

async function privateParent(): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), "setfarm-node-provisioning-parent-v2-"));
  roots.push(root);
  await chmod(root, 0o700);
  return root;
}

async function makeDirectoriesWritable(root: string): Promise<void> {
  let stat;
  try {
    stat = await lstat(root);
  } catch {
    return;
  }
  if (stat.isSymbolicLink() || !stat.isDirectory()) return;
  await chmod(root, 0o700);
  for (const name of await readdir(root)) {
    const child = path.join(root, name);
    const childStat = await lstat(child);
    if (childStat.isDirectory() && !childStat.isSymbolicLink()) {
      await makeDirectoriesWritable(child);
    }
  }
}

afterEach(async () => {
  provisioned.splice(0);
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
  await Promise.all(roots.splice(0).map(async (root) => {
    await makeDirectoriesWritable(root);
    await rm(root, { recursive: true, force: true });
  }));
});

describe("NodeToolchainProvisioningV2", () => {
  it("publishes one receipt-last pathless read-only tree and revalidates it", async () => {
    const parent = await privateParent();
    const handle = await provisionNodeToolchainV2ForTest(await privateTree(), { parent });
    provisioned.push(handle);
    const receipt = inspectNodeToolchainProvisioningReceiptV2(handle);
    const target = getCodeOwnedNodeToolchainTargetV2("arm64");
    const root = path.join(parent, target.rootBasename);
    const receiptPath = path.join(parent, target.receiptBasename);

    assert.equal(receipt.status, "provisioned_verified");
    assert.equal(receipt.admissionScope, "test_fixture");
    assert.equal(isProductionProvisionedNodeToolchainV2(handle), false);
    assert.equal(receipt.finalRoot.mode, "0555");
    assert.equal(receipt.finalRoot.treeHash, receipt.source.tree.treeHash);
    assert.equal(receipt.publisher.lockf.ownerUid, 0);
    assert.equal(receipt.publisher.lockHelper.ownerUid, 0);
    assert.doesNotMatch(JSON.stringify(receipt), /\/private\/|\/var\/|setfarm-node-provisioning-parent/);
    assert.deepEqual(await readFile(receiptPath), canonicalJsonBytes(receipt));
    assert.equal((await lstat(root)).mode & 0o7777, 0o555);
    assert.equal((await lstat(path.join(root, "bin", "node"))).mode & 0o7777, 0o555);
    assert.equal(
      (await lstat(path.join(root, "lib", "node_modules", "npm", "package.json"))).mode & 0o7777,
      0o444,
    );
    assert.equal((await readdir(parent)).includes(target.claimBasename), false);
    assert.deepEqual(
      await readdir(path.join(parent, ".setfarm-node-toolchain-provisioning-v2.staging")),
      [],
    );
    assert.equal((await revalidateProvisionedNodeToolchainV2(handle)).receiptHash, receipt.receiptHash);

    const reopened = await openProvisionedNodeToolchainV2ForTest({
      parent,
      architecture: "arm64",
    });
    provisioned.push(reopened);
    assert.notEqual(reopened, handle);
    assert.equal(
      inspectNodeToolchainProvisioningReceiptV2(reopened).receiptHash,
      receipt.receiptHash,
    );
    assert.equal(
      (await revalidateProvisionedNodeToolchainV2(reopened)).receiptHash,
      receipt.receiptHash,
    );
  });

  it("is idempotent and serializes concurrent identical publishers", async () => {
    const parent = await privateParent();
    const tree = await privateTree();
    const [left, right, thirdConcurrent, fourthConcurrent] = await Promise.all([
      provisionNodeToolchainV2ForTest(tree, { parent }),
      provisionNodeToolchainV2ForTest(tree, { parent }),
      provisionNodeToolchainV2ForTest(tree, { parent }),
      provisionNodeToolchainV2ForTest(tree, { parent }),
    ]);
    provisioned.push(left, right, thirdConcurrent, fourthConcurrent);
    const leftReceipt = inspectNodeToolchainProvisioningReceiptV2(left);
    const rightReceipt = inspectNodeToolchainProvisioningReceiptV2(right);
    assert.equal(leftReceipt.receiptHash, rightReceipt.receiptHash);
    assert.equal(leftReceipt.finalRoot.inode, rightReceipt.finalRoot.inode);
    assert.equal(
      inspectNodeToolchainProvisioningReceiptV2(thirdConcurrent).receiptHash,
      leftReceipt.receiptHash,
    );
    assert.equal(
      inspectNodeToolchainProvisioningReceiptV2(fourthConcurrent).receiptHash,
      leftReceipt.receiptHash,
    );

    const third = await provisionNodeToolchainV2ForTest(tree, { parent });
    provisioned.push(third);
    assert.equal(inspectNodeToolchainProvisioningReceiptV2(third).receiptHash, leftReceipt.receiptHash);
  });

  it("recovers exact claim-owned crashes at every publication boundary", async () => {
    const tree = await privateTree();
    const phases = [
      { afterClaimLink: () => { throw new Error("CRASH_AFTER_CLAIM_LINK"); } },
      { afterClaim: async () => { throw new Error("CRASH_AFTER_CLAIM"); } },
      { afterStage: async () => { throw new Error("CRASH_AFTER_STAGE"); } },
      {
        afterFileLink: async ({ linkedCount }: { linkedCount: number }) => {
          if (linkedCount === 2) throw new Error("CRASH_AFTER_LINK");
        },
      },
      { afterRootVerify: async () => { throw new Error("CRASH_AFTER_ROOT"); } },
      { afterReceiptLink: () => { throw new Error("CRASH_AFTER_RECEIPT_LINK"); } },
      { afterReceiptPublish: async () => { throw new Error("CRASH_AFTER_RECEIPT"); } },
    ];
    for (const hooks of phases) {
      const parent = await privateParent();
      await assert.rejects(provisionNodeToolchainV2ForTest(tree, { parent, hooks }), /CRASH_AFTER_/);
      const recovered = await provisionNodeToolchainV2ForTest(tree, { parent });
      provisioned.push(recovered);
      assert.equal((await revalidateProvisionedNodeToolchainV2(recovered)).status, "provisioned_verified");
      assert.equal(
        (await readdir(parent)).some((name) => name.includes(".claim.json")),
        false,
      );
    }
  });

  it("never adopts an unclaimed root or overwrites a different ready source", async () => {
    const parent = await privateParent();
    const target = getCodeOwnedNodeToolchainTargetV2("arm64");
    const foreignRoot = path.join(parent, target.rootBasename);
    await mkdir(foreignRoot, { mode: 0o700 });
    await writeFile(path.join(foreignRoot, "foreign"), "foreign");
    await assert.rejects(provisionNodeToolchainV2ForTest(await privateTree(), { parent }), {
      code: "NODE_TOOLCHAIN_PROVISIONING_V2_FINAL_ROOT_CONFLICT",
    });
    assert.equal(await readFile(path.join(foreignRoot, "foreign"), "utf8"), "foreign");

    const otherParent = await privateParent();
    const first = await provisionNodeToolchainV2ForTest(await privateTree("first-node\n"), {
      parent: otherParent,
    });
    provisioned.push(first);
    await assert.rejects(
      provisionNodeToolchainV2ForTest(await privateTree("second-node\n"), { parent: otherParent }),
      { code: "NODE_TOOLCHAIN_PROVISIONING_V2_RECEIPT_CONFLICT" },
    );
    assert.equal((await revalidateProvisionedNodeToolchainV2(first)).receiptHash, first.receiptHash);
  });

  it("rejects and preserves every foreign staging artifact", async () => {
    const parent = await privateParent();
    const tree = await privateTree();
    const handle = await provisionNodeToolchainV2ForTest(tree, { parent });
    provisioned.push(handle);
    const foreign = path.join(
      parent,
      ".setfarm-node-toolchain-provisioning-v2.staging",
      "foreign.tmp",
    );
    await writeFile(foreign, "foreign\n", { mode: 0o600 });

    await assert.rejects(revalidateProvisionedNodeToolchainV2(handle), {
      code: "NODE_TOOLCHAIN_PROVISIONING_V2_HOST_DRIFT",
    });
    await assert.rejects(provisionNodeToolchainV2ForTest(tree, { parent }), {
      code: "NODE_TOOLCHAIN_PROVISIONING_V2_STAGE_INVALID",
    });
    await assert.rejects(openProvisionedNodeToolchainV2ForTest({
      parent,
      architecture: "arm64",
    }), {
      code: "NODE_TOOLCHAIN_PROVISIONING_V2_RECEIPT_INVALID",
    });
    assert.equal(await readFile(foreign, "utf8"), "foreign\n");
  });

  it("rehydration rejects an every-and-only root with an added member", async () => {
    const parent = await privateParent();
    const handle = await provisionNodeToolchainV2ForTest(await privateTree(), { parent });
    provisioned.push(handle);
    const target = getCodeOwnedNodeToolchainTargetV2("arm64");
    const root = path.join(parent, target.rootBasename);
    await chmod(root, 0o700);
    await writeFile(path.join(root, "foreign"), "foreign\n", { mode: 0o444 });
    await chmod(root, 0o555);

    await assert.rejects(openProvisionedNodeToolchainV2ForTest({
      parent,
      architecture: "arm64",
    }), {
      code: "NODE_TOOLCHAIN_PROVISIONING_V2_FINAL_TREE_INVALID",
    });
  });

  it("joins a rehydrated provisioning receipt into host authority by physical root and tree hash", async () => {
    const parent = await privateParent();
    const provisionedHandle = await provisionNodeToolchainV2ForTest(await privateTree(), { parent });
    provisioned.push(provisionedHandle);
    const reopened = await openProvisionedNodeToolchainV2ForTest({
      parent,
      architecture: "arm64",
    });
    provisioned.push(reopened);
    const target = getCodeOwnedNodeToolchainTargetV2("arm64");
    const candidateRoot = path.join(parent, target.rootBasename);
    const dynamicLibrary = path.join(parent, "fixture-libnode.dylib");
    await writeFile(dynamicLibrary, "fixture-dylib\n", { mode: 0o555 });
    await chmod(dynamicLibrary, 0o555);
    const probeAdapter = async (invocation: Readonly<{ probeRef: string }>):
    Promise<HostNodeToolchainProbeResultV2> => invocation.probeRef === "HOST_NODE_RUNTIME_IDENTITY_PROBE_V2"
      ? {
          status: "exited",
          exitCode: 0,
          signal: null,
          stdout: `${JSON.stringify({
            version: "22.23.1",
            modulesAbi: "127",
            napiVersion: "10",
            platform: "darwin",
            architecture: "arm64",
            execPath: path.join(candidateRoot, "bin", "node"),
          })}\n`,
          stderr: "",
        }
      : {
          status: "exited",
          exitCode: 0,
          signal: null,
          stdout: "10.9.8\n",
          stderr: "",
        };
    const host = await createHostNodeToolchainAuthorityV2ForTest({
      profileId: "PROFILE_NODE_EXPRESS_API_STATELESS_EXACT_V2",
      fixture: {
        candidateRoot,
        host: {
          platform: "darwin",
          architecture: "arm64",
          macosProductVersion: "26.5.2",
          macosBuildVersion: "25F84",
          darwinKernelRelease: "25.5.0",
        },
        nonSystemDynamicLibraryPaths: [dynamicLibrary],
      },
      probeAdapter,
      provisionedToolchain: reopened,
    });
    const provisioningReceipt = inspectNodeToolchainProvisioningReceiptV2(reopened);
    const hostReceipt = inspectHostNodeToolchainReceiptV2(host);

    assert.equal(hostReceipt.provisioning.policy, "durable_provisioning_receipt_required_v2");
    if (hostReceipt.provisioning.policy !== "durable_provisioning_receipt_required_v2") {
      assert.fail("expected durable provisioning join");
    }
    assert.equal(hostReceipt.provisioning.receiptHash, provisioningReceipt.receiptHash);
    assert.equal(hostReceipt.provisioning.rootInode, hostReceipt.installationRoot.inode);
    assert.equal(
      hostReceipt.provisioning.npmTreeHash,
      hostReceipt.npm.packageTree.normalizedTreeHash,
    );
    assert.equal(
      (await revalidateHostNodeToolchainAuthorityV2(host)).receiptHash,
      hostReceipt.receiptHash,
    );
    const node = path.join(candidateRoot, "bin", "node");
    await chmod(node, 0o700);
    await writeFile(node, "mutated-after-join\n");
    await chmod(node, 0o555);
    await assert.rejects(revalidateHostNodeToolchainAuthorityV2(host), {
      code: "HOST_NODE_TOOLCHAIN_V2_HOST_DRIFT",
    });
  });

  it("rejects forged handles, schema drift, host drift and test-to-production promotion", async () => {
    const parent = await privateParent();
    const tree = await privateTree();
    await assert.rejects(provisionNodeToolchainV2(tree), {
      code: "NODE_TOOLCHAIN_PROVISIONING_V2_INPUT_INVALID",
    });
    const handle = await provisionNodeToolchainV2ForTest(tree, { parent });
    provisioned.push(handle);
    const receipt = inspectNodeToolchainProvisioningReceiptV2(handle);
    assert.throws(() => inspectNodeToolchainProvisioningReceiptV2(receipt as never), {
      code: "NODE_TOOLCHAIN_PROVISIONING_V2_HANDLE_UNAUTHENTICATED",
    });
    assert.throws(() => inspectNodeToolchainProvisioningReceiptV2(new Proxy(handle, {}) as never), {
      code: "NODE_TOOLCHAIN_PROVISIONING_V2_HANDLE_UNAUTHENTICATED",
    });

    const forged = structuredClone(receipt);
    forged.finalRoot.fileCount += 1;
    forged.receiptHash = hashNodeToolchainProvisioningReceiptV2(forged as never);
    assert.equal(NodeToolchainProvisioningReceiptV2Schema.safeParse(forged).success, false);

    const target = getCodeOwnedNodeToolchainTargetV2("arm64");
    const node = path.join(parent, target.rootBasename, "bin", "node");
    await chmod(node, 0o600);
    await writeFile(node, "mutated\n");
    await chmod(node, 0o555);
    await assert.rejects(revalidateProvisionedNodeToolchainV2(handle), {
      code: "NODE_TOOLCHAIN_PROVISIONING_V2_HOST_DRIFT",
    });
  });
});
