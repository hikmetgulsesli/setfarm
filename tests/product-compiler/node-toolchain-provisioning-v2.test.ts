import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import {
  chmod,
  link,
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  readdir,
  rm,
  symlink,
  unlink,
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
  copyMaterializedNodeToolchainPrivateTreeBundleV2,
  disposeMaterializedNodeToolchainPrivateTreeV2,
  inspectNodeToolchainPrivateTreeReceiptV2,
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
  NODE_TOOLCHAIN_PROVISIONING_STAGING_BASENAME_V2,
  getCodeOwnedNodeToolchainTargetV2,
} from "../../src/product-compiler/node-toolchain-target-registry-v2.js";
import {
  CompiledNodeToolchainProvisionerBootstrapV2,
  NodeToolchainProvisionerBootstrapAuthorityErrorV2,
  compileNodeToolchainProvisionerBootstrapV2,
  compileNodeToolchainProvisionerBootstrapV2ForTest,
  compileNodeToolchainProvisionerBootstrapV2ForTestFromAuthority,
  copyCompiledNodeToolchainProvisionerBootstrapV2,
  disposeCompiledNodeToolchainProvisionerBootstrapV2,
  inspectCompiledNodeToolchainProvisionerBootstrapManifestV2,
  renderNodeToolchainProvisionerBootstrapLauncherV2,
} from "../../src/product-compiler/node-toolchain-provisioner-bootstrap-v2.js";
import {
  BuiltNodeToolchainProvisionerBundleV2,
  NodeToolchainProvisionerBundleAuthorityErrorV2,
  buildNodeToolchainProvisionerBundleAuthorityV2,
  buildNodeToolchainProvisionerBundleAuthorityV2ForTest,
  copyBuiltNodeToolchainProvisionerBundleV2,
  inspectNodeToolchainProvisionerBundleAuthorityReceiptV2,
  type NodeToolchainProvisionerBundleBuilderAdapterV2,
} from "../../src/product-compiler/node-toolchain-provisioner-bundle-authority-v2.js";
import {
  NodeToolchainProvisionerBootstrapPackageErrorV2,
  inspectNodeToolchainProvisionerBootstrapPackageV2,
  openNodeToolchainProvisionerBootstrapPackageV2ForTest,
  revalidateNodeToolchainProvisionerBootstrapPackageV2,
} from "../../src/product-compiler/node-toolchain-provisioner-bootstrap-package-v2.js";
import {
  PreparedNodeToolchainProvisionerBootstrapPackageV2,
  NodeToolchainProvisionerBootstrapPreparedPackageErrorV2,
  copyNodeToolchainProvisionerBootstrapPreparedPackageV2,
  disposeNodeToolchainProvisionerBootstrapPreparedPackageV2,
  inspectNodeToolchainProvisionerBootstrapPreparedPackageReceiptV2,
  prepareNodeToolchainProvisionerBootstrapPackageV2,
  prepareNodeToolchainProvisionerBootstrapPackageV2ForTest,
  revalidateNodeToolchainProvisionerBootstrapPreparedPackageV2,
} from "../../src/product-compiler/node-toolchain-provisioner-bootstrap-prepared-package-v2.js";
import {
  InstalledNodeToolchainProvisionerBootstrapV2,
  NodeToolchainProvisionerBootstrapInstallationErrorV2,
  inspectNodeToolchainProvisionerBootstrapInstallationReceiptV2,
  installNodeToolchainProvisionerBootstrapV2,
  installNodeToolchainProvisionerBootstrapV2ForTest,
  openInstalledNodeToolchainProvisionerBootstrapV2ForTest,
  planNodeToolchainProvisionerBootstrapRollbackV2,
  revalidateInstalledNodeToolchainProvisionerBootstrapV2,
  revalidateNodeToolchainProvisionerBootstrapRollbackReceiptV2,
  rollbackNodeToolchainProvisionerBootstrapV2,
  rollbackNodeToolchainProvisionerBootstrapV2ForTest,
  type NodeToolchainProvisionerBootstrapInstallationTestHooksV2,
  type NodeToolchainProvisionerBootstrapRollbackTestHooksV2,
} from "../../src/product-compiler/node-toolchain-provisioner-bootstrap-installation-v2.js";
import {
  inspectNodeToolchainProvisionerBootstrapInstallationV2,
  planNodeToolchainProvisionerBootstrapInstallationV2,
} from "../../src/product-compiler/node-toolchain-provisioner-bootstrap-installation-plan-v2.js";
import {
  runNodeToolchainProvisionerCliV2,
  type NodeToolchainProvisionerCliOperationsV2,
} from "../../src/product-compiler/node-toolchain-provisioner-cli-v2.js";
import {
  applyNodeToolchainProvisionerPlanV2ForTest,
  inspectNodeToolchainProvisionerInspectionV2,
  inspectNodeToolchainProvisionerV2ForTest,
  planNodeToolchainProvisioningV2,
  planNodeToolchainRollbackV2,
  rollbackNodeToolchainProvisionerPlanV2ForTest,
  verifyNodeToolchainProvisionerV2ForTest,
} from "../../src/product-compiler/node-toolchain-provisioner-command-v2.js";
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
import {
  NodeToolchainProvisionerCliFailureV2Schema,
  hashNodeToolchainProvisionerCliFailureV2,
} from "../../src/product-compiler/schemas/node-toolchain-provisioner-cli-v2.js";
import {
  NodeToolchainProvisionerBootstrapFailureV2Schema,
  NodeToolchainProvisionerBootstrapManifestV2Schema,
  hashNodeToolchainProvisionerBootstrapBuildV2,
  hashNodeToolchainProvisionerBootstrapManifestV2,
} from "../../src/product-compiler/schemas/node-toolchain-provisioner-bootstrap-v2.js";
import {
  NodeToolchainProvisionerBootstrapPreparedPackageReceiptV2Schema,
  hashNodeToolchainProvisionerBootstrapPreparedPackageReceiptV2,
} from "../../src/product-compiler/schemas/node-toolchain-provisioner-bootstrap-prepared-package-v2.js";
import {
  NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_LOCK_BASENAME_V2,
  NodeToolchainProvisionerBootstrapInstallationInspectionV2Schema,
  NodeToolchainProvisionerBootstrapInstallationPlanV2Schema,
  hashNodeToolchainProvisionerBootstrapInstallationPlanV2,
} from "../../src/product-compiler/schemas/node-toolchain-provisioner-bootstrap-installation-plan-v2.js";
import {
  NodeToolchainProvisionerBootstrapInstallationClaimV2Schema,
  NodeToolchainProvisionerBootstrapInstallationIntentV2Schema,
  NodeToolchainProvisionerBootstrapInstallationReceiptV2Schema,
  buildNodeToolchainProvisionerBootstrapInstallationClaimV2,
  buildNodeToolchainProvisionerBootstrapInstallationIntentV2,
  getNodeToolchainProvisionerBootstrapInstallationPathsV2,
  hashNodeToolchainProvisionerBootstrapInstallationReceiptV2,
} from "../../src/product-compiler/schemas/node-toolchain-provisioner-bootstrap-installation-state-v2.js";
import {
  NodeToolchainProvisionerBootstrapRollbackClaimV2Schema,
  NodeToolchainProvisionerBootstrapRollbackPlanV2Schema,
  NodeToolchainProvisionerBootstrapRollbackReceiptV2Schema,
  getNodeToolchainProvisionerBootstrapRollbackPathsV2,
  hashNodeToolchainProvisionerBootstrapRollbackClaimV2,
  hashNodeToolchainProvisionerBootstrapRollbackPlanV2,
  hashNodeToolchainProvisionerBootstrapRollbackReceiptV2,
  hashNodeToolchainProvisionerBootstrapRollbackTreeEntriesV2,
} from "../../src/product-compiler/schemas/node-toolchain-provisioner-bootstrap-rollback-v2.js";
import {
  NodeToolchainProvisionerBundleAuthorityReceiptV2Schema,
  hashNodeToolchainProvisionerBundleAuthorityReceiptV2,
  hashNodeToolchainProvisionerBundleDependencyClosureV2,
} from "../../src/product-compiler/schemas/node-toolchain-provisioner-bundle-authority-v2.js";
import {
  NodeToolchainProvisionerOperationReceiptV2Schema,
  NodeToolchainProvisionerPlanV2Schema,
  hashNodeToolchainProvisionerRollbackClaimV2,
  hashNodeToolchainProvisionerRollbackReceiptV2,
  hashNodeToolchainProvisionerRollbackTreeEntriesV2,
  hashNodeToolchainProvisionerOperationReceiptV2,
  hashNodeToolchainProvisionerPlanV2,
} from "../../src/product-compiler/schemas/node-toolchain-provisioner-command-v2.js";

const ARCHIVE_ROOT = "node-v22.23.1-darwin-arm64";
const roots: string[] = [];
const archives: VerifiedNodeToolchainDistributionArchiveV2[] = [];
const trees: MaterializedNodeToolchainPrivateTreeV2[] = [];
const provisioned: ProvisionedNodeToolchainV2[] = [];

function sha256(bytes: Uint8Array | string): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function errorChainContains(error: unknown, pattern: RegExp): boolean {
  let current = error;
  const seen = new Set<unknown>();
  while (current instanceof Error && !seen.has(current)) {
    if (pattern.test(current.message)) return true;
    seen.add(current);
    current = "cause" in current ? current.cause : undefined;
  }
  return false;
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

function provisionerBundleBuilderAdapter(
  bundleForExecution: (executionRef: "first" | "second") => Buffer = () =>
    Buffer.from("'use strict';\nprocess.stdout.write('{}');\n"),
): NodeToolchainProvisionerBundleBuilderAdapterV2 {
  return async (invocation) => {
    const bundle = bundleForExecution(invocation.executionRef);
    const metadata = canonicalJsonBytes({
      schema: "setfarm.node-toolchain-provisioner-bundle-build-metadata.v2",
      esbuildVersion: "0.28.1",
      inputLocators: [
        "src/product-compiler/node-toolchain-provisioner-bootstrap-entry-v2.ts",
      ],
      externalNodeBuiltins: ["node:fs"],
      bundle: {
        sha256: sha256(bundle),
        byteLength: bundle.byteLength,
      },
    });
    await writeFile(invocation.outputLocator, bundle, { flag: "wx", mode: 0o600 });
    await writeFile(invocation.metadataLocator, metadata, { flag: "wx", mode: 0o600 });
    return {
      status: "exited",
      exitCode: 0,
      signal: null,
      stdout: Buffer.alloc(0),
      stderr: Buffer.alloc(0),
    };
  };
}

function executingProvisionerBundleBuilderAdapter(): NodeToolchainProvisionerBundleBuilderAdapterV2 {
  return async (invocation) => {
    const argv = [...invocation.argv];
    argv[2] = process.execPath;
    const result = spawnSync(process.execPath, argv, {
      cwd: invocation.cwd,
      env: { ...invocation.env },
      encoding: "buffer",
      maxBuffer: Math.max(invocation.maxStdoutBytes, invocation.maxStderrBytes),
      timeout: invocation.timeoutMs,
      shell: false,
    });
    return {
      status: result.error ? "spawn_failed" : "exited",
      exitCode: result.status,
      signal: result.signal,
      stdout: Buffer.from(result.stdout ?? Buffer.alloc(0)),
      stderr: Buffer.from(result.stderr ?? Buffer.alloc(0)),
    };
  };
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

describe("NodeToolchainProvisionerCommandV2 inspection and planning", () => {
  it("turns absent and ready targets into pathless exact apply and rollback plans", async () => {
    const parent = await privateParent();
    const tree = await privateTree();
    const absentHandle = await inspectNodeToolchainProvisionerV2ForTest({
      parent,
      architecture: "arm64",
    });
    const absent = inspectNodeToolchainProvisionerInspectionV2(absentHandle);
    assert.equal(absent.classification, "target_absent");
    assert.deepEqual(absent.conflicts, []);
    assert.doesNotMatch(JSON.stringify(absent), /setfarm-node-provisioning-parent-v2-/);

    const publishPlan = planNodeToolchainProvisioningV2(absentHandle, tree);
    assert.equal(publishPlan.operation, "apply");
    if (publishPlan.operation !== "apply") assert.fail("expected apply plan");
    assert.equal(publishPlan.decision, "publish");
    assert.equal(publishPlan.inspection.inspectionHash, absent.inspectionHash);
    assert.equal(publishPlan.intent.source.privateTreeReceiptHash, publishPlan.source.receiptHash);
    assert.equal(NodeToolchainProvisionerPlanV2Schema.safeParse(publishPlan).success, true);

    const provisionedHandle = await provisionNodeToolchainV2ForTest(tree, { parent });
    provisioned.push(provisionedHandle);
    const readyHandle = await inspectNodeToolchainProvisionerV2ForTest({
      parent,
      architecture: "arm64",
    });
    const ready = inspectNodeToolchainProvisionerInspectionV2(readyHandle);
    assert.equal(ready.classification, "ready_verified");
    assert.equal(ready.canonical.receipt.status, "valid");

    const verifyPlan = planNodeToolchainProvisioningV2(readyHandle, tree);
    assert.equal(verifyPlan.operation, "apply");
    if (verifyPlan.operation !== "apply") assert.fail("expected apply plan");
    assert.equal(verifyPlan.decision, "verify_existing");

    const rollbackPlan = planNodeToolchainRollbackV2(readyHandle);
    assert.equal(rollbackPlan.operation, "rollback");
    if (rollbackPlan.operation !== "rollback") assert.fail("expected rollback plan");
    assert.equal(rollbackPlan.decision, "remove_exact_generation");
    assert.equal(
      rollbackPlan.generation.receiptHash,
      inspectNodeToolchainProvisioningReceiptV2(provisionedHandle).receiptHash,
    );
    assert.doesNotMatch(JSON.stringify(rollbackPlan), /setfarm-node-provisioning-parent-v2-/);
  });

  it("plans recovery only for the exact immutable claim and source", async () => {
    const parent = await privateParent();
    const tree = await privateTree();
    await assert.rejects(
      provisionNodeToolchainV2ForTest(tree, {
        parent,
        hooks: { afterClaim: async () => { throw new Error("CRASH_AFTER_EXACT_CLAIM"); } },
      }),
      /CRASH_AFTER_EXACT_CLAIM/,
    );
    const interruptedHandle = await inspectNodeToolchainProvisionerV2ForTest({
      parent,
      architecture: "arm64",
    });
    const interrupted = inspectNodeToolchainProvisionerInspectionV2(interruptedHandle);
    assert.equal(interrupted.classification, "interrupted_claimed");
    assert.equal(interrupted.canonical.claim.status, "valid");
    const recoveryPlan = planNodeToolchainProvisioningV2(interruptedHandle, tree);
    assert.equal(recoveryPlan.operation, "apply");
    if (recoveryPlan.operation !== "apply") assert.fail("expected apply plan");
    assert.equal(recoveryPlan.decision, "recover_exact_claim");

    const differentTree = await privateTree("different-node-binary\n");
    assert.throws(
      () => planNodeToolchainProvisioningV2(interruptedHandle, differentTree),
      { code: "NODE_TOOLCHAIN_PROVISIONER_V2_PLAN_CONFLICT" },
    );
  });

  it("recovers the exact receipt-link crash tail instead of misclassifying it as ready conflict", async () => {
    const parent = await privateParent();
    const tree = await privateTree();
    await assert.rejects(
      provisionNodeToolchainV2ForTest(tree, {
        parent,
        hooks: { afterReceiptLink: () => { throw new Error("CRASH_AFTER_RECEIPT_LINK"); } },
      }),
      /CRASH_AFTER_RECEIPT_LINK/,
    );

    const interruptedHandle = await inspectNodeToolchainProvisionerV2ForTest({
      parent,
      architecture: "arm64",
    });
    const interrupted = inspectNodeToolchainProvisionerInspectionV2(interruptedHandle);
    assert.equal(interrupted.classification, "interrupted_claimed");
    assert.equal(interrupted.canonical.claim.status, "valid");
    assert.equal(interrupted.canonical.receipt.status, "valid");

    const recoveryPlan = planNodeToolchainProvisioningV2(interruptedHandle, tree);
    assert.equal(recoveryPlan.operation, "apply");
    if (recoveryPlan.operation !== "apply") assert.fail("expected apply plan");
    assert.equal(recoveryPlan.decision, "recover_exact_claim");
    const recovered = await applyNodeToolchainProvisionerPlanV2ForTest({
      parent,
      plan: recoveryPlan,
      privateTree: tree,
    });
    assert.equal(recovered.operation, "apply");
    assert.equal(recovered.result, "recovered_exact_generation");
    assert.equal(recovered.afterInspection.classification, "ready_verified");
  });

  it("preserves conflicts, rejects forged handles and rejects self-rehashed decision drift", async () => {
    const parent = await privateParent();
    const target = getCodeOwnedNodeToolchainTargetV2("arm64");
    await mkdir(path.join(parent, target.rootBasename), { mode: 0o700 });
    const conflictHandle = await inspectNodeToolchainProvisionerV2ForTest({
      parent,
      architecture: "arm64",
    });
    const conflict = inspectNodeToolchainProvisionerInspectionV2(conflictHandle);
    assert.equal(conflict.classification, "conflict");
    assert.equal(conflict.conflicts.includes("ROOT_WITHOUT_EXACT_CLAIM"), true);
    const tree = await privateTree();
    assert.throws(
      () => planNodeToolchainProvisioningV2(conflictHandle, tree),
      { code: "NODE_TOOLCHAIN_PROVISIONER_V2_PLAN_CONFLICT" },
    );
    assert.throws(
      () => inspectNodeToolchainProvisionerInspectionV2(conflict as never),
      { code: "NODE_TOOLCHAIN_PROVISIONER_V2_HANDLE_UNAUTHENTICATED" },
    );

    await rm(path.join(parent, target.rootBasename), { recursive: true });
    const absentHandle = await inspectNodeToolchainProvisionerV2ForTest({
      parent,
      architecture: "arm64",
    });
    const plan = planNodeToolchainProvisioningV2(absentHandle, tree);
    assert.equal(plan.operation, "apply");
    if (plan.operation !== "apply") assert.fail("expected apply plan");
    const forged = structuredClone(plan);
    forged.decision = "verify_existing";
    forged.planHash = hashNodeToolchainProvisionerPlanV2(forged);
    assert.equal(NodeToolchainProvisionerPlanV2Schema.safeParse(forged).success, false);
  });

  it("rechecks exact preconditions before apply and emits fresh canonical operation evidence", async () => {
    const parent = await privateParent();
    const tree = await privateTree();
    const absentHandle = await inspectNodeToolchainProvisionerV2ForTest({
      parent,
      architecture: "arm64",
    });
    const publishPlan = planNodeToolchainProvisioningV2(absentHandle, tree);
    const applied = await applyNodeToolchainProvisionerPlanV2ForTest({
      parent,
      plan: publishPlan,
      privateTree: tree,
    });
    assert.equal(applied.operation, "apply");
    assert.equal(applied.result, "applied_exact_generation");
    assert.equal(applied.afterInspection.classification, "ready_verified");
    assert.equal(applied.generation.intentHash, publishPlan.operation === "apply"
      ? publishPlan.intent.intentHash
      : "");
    assert.equal(NodeToolchainProvisionerOperationReceiptV2Schema.safeParse(applied).success, true);

    await assert.rejects(
      applyNodeToolchainProvisionerPlanV2ForTest({
        parent,
        plan: publishPlan,
        privateTree: tree,
      }),
      { code: "NODE_TOOLCHAIN_PROVISIONER_V2_PRECONDITION_CHANGED" },
    );

    const readyHandle = await inspectNodeToolchainProvisionerV2ForTest({
      parent,
      architecture: "arm64",
    });
    const verifyPlan = planNodeToolchainProvisioningV2(readyHandle, tree);
    const replay = await applyNodeToolchainProvisionerPlanV2ForTest({
      parent,
      plan: verifyPlan,
      privateTree: tree,
    });
    assert.equal(replay.result, "verified_existing_generation");
    assert.equal(replay.generation.receiptHash, applied.generation.receiptHash);

    const verified = await verifyNodeToolchainProvisionerV2ForTest({
      parent,
      architecture: "arm64",
    });
    assert.equal(verified.operation, "verify");
    assert.equal(verified.result, "verified_exact_generation");
    assert.equal(verified.generation.receiptHash, applied.generation.receiptHash);

    const forged = structuredClone(verified);
    forged.generation.treeHash = "f".repeat(64);
    forged.operationReceiptHash = hashNodeToolchainProvisionerOperationReceiptV2(forged);
    assert.equal(
      NodeToolchainProvisionerOperationReceiptV2Schema.safeParse(forged).success,
      false,
    );
  });

  it("rejects stale and source-substituted plans before the publisher mutates the target", async () => {
    const parent = await privateParent();
    const tree = await privateTree();
    const absentHandle = await inspectNodeToolchainProvisionerV2ForTest({
      parent,
      architecture: "arm64",
    });
    const plan = planNodeToolchainProvisioningV2(absentHandle, tree);
    const differentTree = await privateTree("source-substitution\n");
    await assert.rejects(
      applyNodeToolchainProvisionerPlanV2ForTest({
        parent,
        plan,
        privateTree: differentTree,
      }),
      { code: "NODE_TOOLCHAIN_PROVISIONER_V2_PLAN_INVALID" },
    );
    const target = getCodeOwnedNodeToolchainTargetV2("arm64");
    await assert.rejects(lstat(path.join(parent, target.rootBasename)), { code: "ENOENT" });

    await writeFile(path.join(parent, "operator-created-after-plan"), "state changed\n", {
      mode: 0o600,
    });
    await assert.rejects(
      applyNodeToolchainProvisionerPlanV2ForTest({
        parent,
        plan,
        privateTree: tree,
      }),
      { code: "NODE_TOOLCHAIN_PROVISIONER_V2_PRECONDITION_CHANGED" },
    );
    await assert.rejects(lstat(path.join(parent, target.rootBasename)), { code: "ENOENT" });
  });

  it("applies an exact interrupted recovery plan and does not relabel it as a new publish", async () => {
    const parent = await privateParent();
    const tree = await privateTree();
    await assert.rejects(
      provisionNodeToolchainV2ForTest(tree, {
        parent,
        hooks: { afterStage: async () => { throw new Error("CRASH_AFTER_COMMAND_STAGE"); } },
      }),
      /CRASH_AFTER_COMMAND_STAGE/,
    );
    const interrupted = await inspectNodeToolchainProvisionerV2ForTest({
      parent,
      architecture: "arm64",
    });
    const plan = planNodeToolchainProvisioningV2(interrupted, tree);
    assert.equal(plan.operation, "apply");
    if (plan.operation !== "apply") assert.fail("expected apply plan");
    assert.equal(plan.decision, "recover_exact_claim");
    const recovered = await applyNodeToolchainProvisionerPlanV2ForTest({
      parent,
      plan,
      privateTree: tree,
    });
    assert.equal(recovered.result, "recovered_exact_generation");
    assert.equal(recovered.afterInspection.classification, "ready_verified");
  });

  it("lets concurrent holders of one unchanged apply plan converge to one physical generation", async () => {
    const parent = await privateParent();
    const tree = await privateTree();
    const inspection = await inspectNodeToolchainProvisionerV2ForTest({
      parent,
      architecture: "arm64",
    });
    const plan = planNodeToolchainProvisioningV2(inspection, tree);
    const [left, right] = await Promise.all([
      applyNodeToolchainProvisionerPlanV2ForTest({ parent, plan, privateTree: tree }),
      applyNodeToolchainProvisionerPlanV2ForTest({ parent, plan, privateTree: tree }),
    ]);
    assert.equal(left.result, "applied_exact_generation");
    assert.equal(right.result, "applied_exact_generation");
    assert.equal(left.generation.receiptHash, right.generation.receiptHash);
    assert.equal(left.generation.rootDevice, right.generation.rootDevice);
    assert.equal(left.generation.rootInode, right.generation.rootInode);
  });

  it("rolls back only the planned physical generation and replays through its durable tombstone", async () => {
    const parent = await privateParent();
    const tree = await privateTree();
    const provisionedHandle = await provisionNodeToolchainV2ForTest(tree, { parent });
    provisioned.push(provisionedHandle);
    const ready = await inspectNodeToolchainProvisionerV2ForTest({
      parent,
      architecture: "arm64",
    });
    const rollbackPlan = planNodeToolchainRollbackV2(ready);
    const rolledBack = await rollbackNodeToolchainProvisionerPlanV2ForTest({
      parent,
      plan: rollbackPlan,
    });
    assert.equal(rolledBack.operation, "rollback");
    assert.equal(rolledBack.result, "rolled_back_exact_generation");
    assert.equal(rolledBack.executionInspection.classification, "ready_verified");
    assert.equal(rolledBack.beforeInspectionHash, rolledBack.executionInspection.inspectionHash);
    assert.equal(rolledBack.afterInspection.classification, "target_absent");
    assert.equal(rolledBack.durableRollback.planHash, rollbackPlan.planHash);
    assert.equal(
      rolledBack.durableRollback.removedGeneration.receiptHash,
      rollbackPlan.operation === "rollback" ? rollbackPlan.generation.receiptHash : "",
    );
    assert.equal(
      NodeToolchainProvisionerOperationReceiptV2Schema.safeParse(rolledBack).success,
      true,
    );

    const replay = await rollbackNodeToolchainProvisionerPlanV2ForTest({
      parent,
      plan: rollbackPlan,
    });
    assert.equal(replay.result, "verified_existing_rollback");
    assert.equal(replay.executionInspection.classification, "target_absent");
    assert.equal(replay.beforeInspectionHash, replay.executionInspection.inspectionHash);
    assert.equal(replay.durableRollback.receiptHash, rolledBack.durableRollback.receiptHash);

    const forged = structuredClone(rolledBack);
    if (forged.operation !== "rollback") assert.fail("expected rollback receipt");
    const executable = forged.durableRollback.claim.treeEntries.find(
      (entry) => entry.locator === "bin/node" && entry.type === "file",
    );
    if (!executable) assert.fail("expected exact node rollback member");
    executable.contentHash = "f".repeat(64);
    forged.durableRollback.claim.treeEntriesHash =
      hashNodeToolchainProvisionerRollbackTreeEntriesV2(
        forged.durableRollback.claim.treeEntries,
      );
    forged.durableRollback.claim.claimHash = hashNodeToolchainProvisionerRollbackClaimV2(
      forged.durableRollback.claim,
    );
    forged.durableRollback.receiptHash = hashNodeToolchainProvisionerRollbackReceiptV2(
      forged.durableRollback,
    );
    forged.operationReceiptHash = hashNodeToolchainProvisionerOperationReceiptV2(forged);
    assert.equal(NodeToolchainProvisionerOperationReceiptV2Schema.safeParse(forged).success, false);
  });

  it("recovers the exact rollback claim at every destructive crash boundary", async () => {
    const phases = [
      { afterRollbackClaimLink: () => { throw new Error("CRASH_ROLLBACK_CLAIM_LINK"); } },
      { afterRollbackClaim: async () => { throw new Error("CRASH_ROLLBACK_CLAIM"); } },
      { afterQuarantineCreate: async () => { throw new Error("CRASH_ROLLBACK_QUARANTINE"); } },
      { afterRootWritable: async () => { throw new Error("CRASH_ROLLBACK_ROOT_WRITABLE"); } },
      { afterRootRename: async () => { throw new Error("CRASH_ROLLBACK_RENAME"); } },
      {
        afterProvisioningReceiptRemove: async () => {
          throw new Error("CRASH_ROLLBACK_PROVISIONING_RECEIPT");
        },
      },
      {
        afterRemovedEntry: async ({ removedCount }: { removedCount: number }) => {
          if (removedCount === 1) throw new Error("CRASH_ROLLBACK_PARTIAL_DELETE");
        },
      },
      { afterRollbackReceiptLink: () => { throw new Error("CRASH_ROLLBACK_RECEIPT_LINK"); } },
      {
        afterRollbackReceiptPublish: async () => {
          throw new Error("CRASH_ROLLBACK_RECEIPT_PUBLISH");
        },
      },
      {
        afterRollbackClaimRemove: async () => {
          throw new Error("CRASH_ROLLBACK_CLAIM_REMOVE");
        },
      },
    ];
    for (const hooks of phases) {
      const parent = await privateParent();
      const tree = await privateTree();
      const provisionedHandle = await provisionNodeToolchainV2ForTest(tree, { parent });
      provisioned.push(provisionedHandle);
      const ready = await inspectNodeToolchainProvisionerV2ForTest({
        parent,
        architecture: "arm64",
      });
      const rollbackPlan = planNodeToolchainRollbackV2(ready);
      await assert.rejects(
        rollbackNodeToolchainProvisionerPlanV2ForTest({ parent, plan: rollbackPlan, hooks }),
        (error) => errorChainContains(error, /CRASH_ROLLBACK_/),
      );
      const interrupted = inspectNodeToolchainProvisionerInspectionV2(
        await inspectNodeToolchainProvisionerV2ForTest({ parent, architecture: "arm64" }),
      );
      assert.equal(
        interrupted.classification === "rollback_interrupted"
          || interrupted.classification === "target_absent",
        true,
      );
      const recovered = await rollbackNodeToolchainProvisionerPlanV2ForTest({
        parent,
        plan: rollbackPlan,
      });
      assert.equal(
        recovered.result === "recovered_exact_rollback"
          || recovered.result === "verified_existing_rollback",
        true,
      );
      assert.equal(recovered.beforeInspectionHash, recovered.executionInspection.inspectionHash);
      assert.equal(
        recovered.executionInspection.classification === "rollback_interrupted"
          || recovered.executionInspection.classification === "target_absent",
        true,
      );
      assert.equal(recovered.afterInspection.classification, "target_absent");
    }
  });

  it("never lets an old rollback plan delete a later physical generation", async () => {
    const parent = await privateParent();
    const tree = await privateTree();
    const first = await provisionNodeToolchainV2ForTest(tree, { parent });
    provisioned.push(first);
    const firstReady = await inspectNodeToolchainProvisionerV2ForTest({
      parent,
      architecture: "arm64",
    });
    const oldPlan = planNodeToolchainRollbackV2(firstReady);
    await rollbackNodeToolchainProvisionerPlanV2ForTest({ parent, plan: oldPlan });

    const second = await provisionNodeToolchainV2ForTest(tree, { parent });
    provisioned.push(second);
    const secondReceipt = inspectNodeToolchainProvisioningReceiptV2(second);
    assert.notEqual(
      secondReceipt.finalRoot.inode,
      oldPlan.operation === "rollback" ? oldPlan.generation.rootInode : -1,
    );
    await assert.rejects(
      rollbackNodeToolchainProvisionerPlanV2ForTest({ parent, plan: oldPlan }),
      { code: "NODE_TOOLCHAIN_PROVISIONER_V2_PRECONDITION_CHANGED" },
    );
    assert.equal(
      (await revalidateProvisionedNodeToolchainV2(second)).receiptHash,
      secondReceipt.receiptHash,
    );
  });

  it("preserves a live generation that loses a claimed member before quarantine", async () => {
    const parent = await privateParent();
    const tree = await privateTree();
    const provisionedHandle = await provisionNodeToolchainV2ForTest(tree, { parent });
    provisioned.push(provisionedHandle);
    const target = getCodeOwnedNodeToolchainTargetV2("arm64");
    const root = path.join(parent, target.rootBasename);
    const ready = await inspectNodeToolchainProvisionerV2ForTest({
      parent,
      architecture: "arm64",
    });
    const plan = planNodeToolchainRollbackV2(ready);
    await assert.rejects(
      rollbackNodeToolchainProvisionerPlanV2ForTest({
        parent,
        plan,
        hooks: { afterRootWritable: async () => { throw new Error("CRASH_ROOT_WRITABLE"); } },
      }),
      (error) => errorChainContains(error, /CRASH_ROOT_WRITABLE/),
    );
    await chmod(path.join(root, "bin"), 0o700);
    await rm(path.join(root, "bin", "node"));

    await assert.rejects(
      rollbackNodeToolchainProvisionerPlanV2ForTest({ parent, plan }),
      (error) => errorChainContains(error, /lost a claimed member/),
    );
    assert.equal((await lstat(root)).isDirectory(), true);
    assert.equal(
      (await lstat(path.join(root, "lib", "node_modules", "npm", "package.json"))).isFile(),
      true,
    );
    assert.equal((await lstat(path.join(parent, target.receiptBasename))).isFile(), true);
  });

  it("rejects and preserves a foreign quarantine member during exact rollback recovery", async () => {
    const parent = await privateParent();
    const tree = await privateTree();
    const provisionedHandle = await provisionNodeToolchainV2ForTest(tree, { parent });
    provisioned.push(provisionedHandle);
    const target = getCodeOwnedNodeToolchainTargetV2("arm64");
    const ready = await inspectNodeToolchainProvisionerV2ForTest({
      parent,
      architecture: "arm64",
    });
    const plan = planNodeToolchainRollbackV2(ready);
    if (plan.operation !== "rollback") assert.fail("expected rollback plan");
    const quarantineRoot = path.join(
      parent,
      NODE_TOOLCHAIN_PROVISIONING_STAGING_BASENAME_V2,
      `${plan.planHash}.rollback`,
      target.rootBasename,
    );
    await assert.rejects(
      rollbackNodeToolchainProvisionerPlanV2ForTest({
        parent,
        plan,
        hooks: { afterRootRename: async () => { throw new Error("CRASH_ROOT_RENAMED"); } },
      }),
      (error) => errorChainContains(error, /CRASH_ROOT_RENAMED/),
    );
    const foreign = path.join(quarantineRoot, "foreign-member");
    await writeFile(foreign, "foreign\n", { mode: 0o600 });

    await assert.rejects(
      rollbackNodeToolchainProvisionerPlanV2ForTest({ parent, plan }),
      (error) => errorChainContains(error, /foreign entry/),
    );
    assert.equal(await readFile(foreign, "utf8"), "foreign\n");
    assert.equal((await lstat(path.join(parent, target.receiptBasename))).isFile(), true);
  });

  it("serializes concurrent exact rollbacks and returns one durable tombstone", async () => {
    const parent = await privateParent();
    const tree = await privateTree();
    const provisionedHandle = await provisionNodeToolchainV2ForTest(tree, { parent });
    provisioned.push(provisionedHandle);
    const ready = await inspectNodeToolchainProvisionerV2ForTest({
      parent,
      architecture: "arm64",
    });
    const plan = planNodeToolchainRollbackV2(ready);
    const [left, right] = await Promise.all([
      rollbackNodeToolchainProvisionerPlanV2ForTest({ parent, plan }),
      rollbackNodeToolchainProvisionerPlanV2ForTest({ parent, plan }),
    ]);
    assert.equal(
      new Set([left.result, right.result]).has("rolled_back_exact_generation"),
      true,
    );
    assert.equal(left.durableRollback.receiptHash, right.durableRollback.receiptHash);
    assert.equal(left.afterInspection.classification, "target_absent");
    assert.equal(right.afterInspection.classification, "target_absent");
  });

  it("executes the pathless CLI protocol through canonical plan files and durable replay", async () => {
    const parent = await privateParent();
    const commandFiles = await privateParent();
    const tree = await privateTree();
    const archiveCandidate = path.join(commandFiles, "candidate-node-archive.tar.xz");
    let operationCalls = 0;
    const operations: NodeToolchainProvisionerCliOperationsV2 = Object.freeze({
      inspect: () => {
        operationCalls += 1;
        return inspectNodeToolchainProvisionerV2ForTest({
          parent,
          architecture: "arm64",
        });
      },
      inspectArtifact: (handle) => {
        operationCalls += 1;
        return inspectNodeToolchainProvisionerInspectionV2(handle);
      },
      withPrivateTree: async <T>(
        observedArchivePath: string,
        use: (source: MaterializedNodeToolchainPrivateTreeV2) => Promise<T> | T,
      ): Promise<T> => {
        operationCalls += 1;
        assert.equal(observedArchivePath, archiveCandidate);
        return use(tree);
      },
      planApply: (inspection, source) => {
        operationCalls += 1;
        return planNodeToolchainProvisioningV2(inspection, source);
      },
      planRollback: (inspection) => {
        operationCalls += 1;
        return planNodeToolchainRollbackV2(inspection);
      },
      apply: (plan, source) => {
        operationCalls += 1;
        return applyNodeToolchainProvisionerPlanV2ForTest({
          parent,
          plan,
          privateTree: source,
        });
      },
      verify: () => {
        operationCalls += 1;
        return verifyNodeToolchainProvisionerV2ForTest({
          parent,
          architecture: "arm64",
        });
      },
      rollback: (plan) => {
        operationCalls += 1;
        return rollbackNodeToolchainProvisionerPlanV2ForTest({ parent, plan });
      },
    });
    const stdout: Buffer[] = [];
    const stderr: string[] = [];
    const invoke = async (argv: unknown) => {
      stdout.length = 0;
      stderr.length = 0;
      const exitCode = await runNodeToolchainProvisionerCliV2(argv, operations, {
        writeStdout: (bytes) => stdout.push(Buffer.from(bytes)),
        writeStderr: (text) => stderr.push(text),
      });
      assert.equal(stdout.length, 1);
      return { exitCode, bytes: stdout[0]!, diagnostics: [...stderr] };
    };

    const inspected = await invoke(["inspect"]);
    assert.equal(inspected.exitCode, 0);
    assert.equal(JSON.parse(inspected.bytes.toString("utf8")).classification, "target_absent");
    assert.equal(inspected.bytes.at(-1), "}".charCodeAt(0));

    const applyPlanOutput = await invoke(["plan", "apply", "--archive", archiveCandidate]);
    assert.equal(applyPlanOutput.exitCode, 0);
    const applyPlan = NodeToolchainProvisionerPlanV2Schema.parse(
      JSON.parse(applyPlanOutput.bytes.toString("utf8")),
    );
    assert.equal(applyPlan.operation, "apply");
    assert.doesNotMatch(applyPlanOutput.bytes.toString("utf8"), /setfarm-node-provisioning-parent/);
    const applyPlanPath = path.join(commandFiles, "apply-plan.json");
    await writeFile(applyPlanPath, applyPlanOutput.bytes, { mode: 0o600 });

    const callsBeforeInvalidOrder = operationCalls;
    const invalidOrder = await invoke([
      "apply",
      "--archive",
      archiveCandidate,
      "--plan-file",
      applyPlanPath,
    ]);
    assert.equal(invalidOrder.exitCode, 64);
    assert.equal(operationCalls, callsBeforeInvalidOrder);

    const symlinkPlanPath = path.join(commandFiles, "symlink-plan.json");
    await symlink(applyPlanPath, symlinkPlanPath);
    const symlinkRefused = await invoke([
      "apply",
      "--plan-file",
      symlinkPlanPath,
      "--archive",
      archiveCandidate,
    ]);
    assert.equal(symlinkRefused.exitCode, 64);

    const hardlinkSourcePath = path.join(commandFiles, "hardlink-plan-source.json");
    const hardlinkAliasPath = path.join(commandFiles, "hardlink-plan-alias.json");
    await writeFile(hardlinkSourcePath, applyPlanOutput.bytes, { mode: 0o600 });
    await link(hardlinkSourcePath, hardlinkAliasPath);
    const hardlinkRefused = await invoke([
      "apply",
      "--plan-file",
      hardlinkAliasPath,
      "--archive",
      archiveCandidate,
    ]);
    assert.equal(hardlinkRefused.exitCode, 64);
    await unlink(hardlinkAliasPath);
    await unlink(hardlinkSourcePath);

    const nestedDrift = JSON.parse(applyPlanOutput.bytes.toString("utf8"));
    nestedDrift.inspection.inspectionHash = "f".repeat(64);
    nestedDrift.planHash = hashNodeToolchainProvisionerPlanV2(nestedDrift);
    const nestedDriftPath = path.join(commandFiles, "nested-drift-plan.json");
    await writeFile(nestedDriftPath, canonicalJsonBytes(nestedDrift), { mode: 0o600 });
    const nestedDriftRefused = await invoke([
      "apply",
      "--plan-file",
      nestedDriftPath,
      "--archive",
      archiveCandidate,
    ]);
    assert.equal(nestedDriftRefused.exitCode, 64);

    const noncanonicalPlanPath = path.join(commandFiles, "noncanonical-plan.json");
    await writeFile(
      noncanonicalPlanPath,
      Buffer.concat([applyPlanOutput.bytes, Buffer.from("\n")]),
      { mode: 0o600 },
    );
    const refused = await invoke([
      "apply",
      "--plan-file",
      noncanonicalPlanPath,
      "--archive",
      archiveCandidate,
    ]);
    assert.equal(refused.exitCode, 64);
    const failure = NodeToolchainProvisionerCliFailureV2Schema.parse(
      JSON.parse(refused.bytes.toString("utf8")),
    );
    assert.equal(failure.commandRef, "apply");
    assert.equal(failure.errorCode, "NODE_TOOLCHAIN_PROVISIONER_CLI_V2_PLAN_FILE_INVALID");
    assert.equal(failure.failureKind, "invocation_rejected");
    assert.equal(refused.diagnostics.length, 1);
    const exitDrift = {
      ...failure,
      exitCode: 70 as const,
    };
    assert.throws(() => NodeToolchainProvisionerCliFailureV2Schema.parse({
      ...exitDrift,
      failureHash: hashNodeToolchainProvisionerCliFailureV2(exitDrift),
    }));
    const target = getCodeOwnedNodeToolchainTargetV2("arm64");
    await assert.rejects(lstat(path.join(parent, target.rootBasename)), { code: "ENOENT" });

    const applied = await invoke([
      "apply",
      "--plan-file",
      applyPlanPath,
      "--archive",
      archiveCandidate,
    ]);
    assert.equal(applied.exitCode, 0);
    assert.equal(JSON.parse(applied.bytes.toString("utf8")).result, "applied_exact_generation");
    const verified = await invoke(["verify"]);
    assert.equal(verified.exitCode, 0);
    assert.equal(JSON.parse(verified.bytes.toString("utf8")).result, "verified_exact_generation");

    const rollbackPlanOutput = await invoke(["plan", "rollback"]);
    assert.equal(rollbackPlanOutput.exitCode, 0);
    const rollbackPlan = NodeToolchainProvisionerPlanV2Schema.parse(
      JSON.parse(rollbackPlanOutput.bytes.toString("utf8")),
    );
    assert.equal(rollbackPlan.operation, "rollback");
    const rollbackPlanPath = path.join(commandFiles, "rollback-plan.json");
    await writeFile(rollbackPlanPath, rollbackPlanOutput.bytes, { mode: 0o600 });
    const rolledBack = await invoke(["rollback", "--plan-file", rollbackPlanPath]);
    assert.equal(rolledBack.exitCode, 0);
    assert.equal(JSON.parse(rolledBack.bytes.toString("utf8")).result, "rolled_back_exact_generation");
    const replay = await invoke(["rollback", "--plan-file", rollbackPlanPath]);
    assert.equal(replay.exitCode, 0);
    assert.equal(JSON.parse(replay.bytes.toString("utf8")).result, "verified_existing_rollback");

    const hostileArgv = new Proxy(["inspect"], {});
    const hostile = await invoke(hostileArgv);
    assert.equal(hostile.exitCode, 64);
    assert.equal(
      NodeToolchainProvisionerCliFailureV2Schema.parse(
        JSON.parse(hostile.bytes.toString("utf8")),
      ).commandRef,
      "invalid_invocation",
    );
  });

  it("issues bundle, compile and prepared authority only from one exact source join", async () => {
    const tree = await privateTree();
    const handle = await buildNodeToolchainProvisionerBundleAuthorityV2ForTest(
      tree,
      executingProvisionerBundleBuilderAdapter(),
    );
    const receipt = inspectNodeToolchainProvisionerBundleAuthorityReceiptV2(handle);
    const snapshot = copyBuiltNodeToolchainProvisionerBundleV2(handle);

    assert.equal(receipt.admissionScope, "test_fixture");
    assert.equal(receipt.status, "built_reproducible_verified");
    assert.equal(receipt.dependencyClosure.esbuild.version, "0.28.1");
    assert.equal(receipt.dependencyClosure.zod.version, "4.4.3");
    assert.equal(receipt.build.executionAuthority, "test_adapter");
    assert.equal(receipt.runtime.sourcePrivateTree.receiptHash, inspectNodeToolchainPrivateTreeReceiptV2(tree).receiptHash);
    assert.equal(receipt.build.executions[0].outputHash, receipt.build.executions[1].outputHash);
    assert.equal(receipt.output.sha256, sha256(snapshot.bundleBytes));
    assert.ok(receipt.output.inputLocators.some((locator) => locator.startsWith("node_modules/zod/")));
    assert.ok(snapshot.bundleBytes.byteLength > 100_000);
    assert.doesNotMatch(snapshot.bundleBytes.toString("utf8"), /require\(["'](?:zod|esbuild)["']\)/);
    assert.deepEqual(
      NodeToolchainProvisionerBundleAuthorityReceiptV2Schema.parse(receipt),
      receipt,
    );
    const bootstrapParent = await realpath(await privateParent());
    const bootstrapRoot = path.join(bootstrapParent, "node-toolchain-provisioner-v2");
    const compiledHandle = await compileNodeToolchainProvisionerBootstrapV2ForTestFromAuthority(
      handle,
      tree,
      bootstrapRoot,
    );
    const compiled = copyCompiledNodeToolchainProvisionerBootstrapV2(compiledHandle);
    assert.equal(compiledHandle.manifestHash, compiled.manifest.manifestHash);
    assert.equal(compiledHandle.admissionScope, "test_fixture");
    assert.equal(
      inspectCompiledNodeToolchainProvisionerBootstrapManifestV2(compiledHandle).manifestHash,
      compiled.manifest.manifestHash,
    );
    assert.equal(compiled.manifest.build.authority.kind, "authenticated_bundle");
    assert.equal(compiled.manifest.release.branch, receipt.release.branch);
    assert.equal(compiled.manifest.release.dirty, receipt.release.dirty);
    if (compiled.manifest.build.authority.kind === "authenticated_bundle") {
      assert.equal(compiled.manifest.build.authority.receipt.receiptHash, receipt.receiptHash);
    }
    assert.equal(compiled.manifest.files.bundle.sha256, receipt.output.sha256);
    assert.deepEqual(compiled.bundleBytes, snapshot.bundleBytes);
    compiled.bundleBytes.fill(0);
    assert.equal(
      copyCompiledNodeToolchainProvisionerBootstrapV2(compiledHandle).manifest.files.bundle.sha256,
      receipt.output.sha256,
    );
    assert.throws(
      () => copyCompiledNodeToolchainProvisionerBootstrapV2(
        Object.create(CompiledNodeToolchainProvisionerBootstrapV2.prototype),
      ),
      (error: unknown) => error instanceof NodeToolchainProvisionerBootstrapAuthorityErrorV2,
    );
    const preparedParent = await realpath(await privateParent());
    assert.throws(
      () => prepareNodeToolchainProvisionerBootstrapPackageV2ForTest(
        compiledHandle,
        {
          scratchParent: preparedParent,
          testHooks: {
            beforeManifest: () => {
              throw new Error("injected-before-manifest-crash");
            },
          },
        },
      ),
      (error: unknown) =>
        error instanceof NodeToolchainProvisionerBootstrapPreparedPackageErrorV2
        && error.code === "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_PREPARED_V2_PUBLICATION_FAILED",
    );
    assert.deepEqual(await readdir(preparedParent), []);
    let preparedPayloadRoot = "";
    const prepared = prepareNodeToolchainProvisionerBootstrapPackageV2ForTest(
      compiledHandle,
      {
        scratchParent: preparedParent,
        testHooks: {
          beforeManifest: ({ payloadRoot }) => {
            preparedPayloadRoot = payloadRoot;
            assert.equal(
              existsSync(path.join(
                payloadRoot,
                "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_MANIFEST.v2.json",
              )),
              false,
            );
          },
        },
      },
    );
    const preparedReceipt =
      inspectNodeToolchainProvisionerBootstrapPreparedPackageReceiptV2(prepared);
    assert.equal(prepared.receiptHash, preparedReceipt.receiptHash);
    assert.equal(prepared.admissionScope, "test_fixture");
    assert.equal(preparedReceipt.status, "prepared_payload_verified");
    assert.equal(preparedReceipt.installationStatus, "not_installed_unprivileged_payload");
    assert.equal(preparedReceipt.target.rootLocator, bootstrapRoot);
    assert.equal(preparedReceipt.source.architecture, compiled.manifest.distribution.architecture);
    assert.equal(preparedReceipt.storage.rootMode, "0700");
    assert.equal(preparedReceipt.members.bundle.storageMode, "0400");
    assert.equal(preparedReceipt.members.bundle.targetMode, "0444");
    assert.equal(preparedReceipt.publication.manifestPublishedLast, true);
    assert.equal(preparedReceipt.publication.targetRootAccess, "none");
    assert.equal(preparedReceipt.source.bundleAuthorityReceiptHash, receipt.receiptHash);
    assert.equal(
      NodeToolchainProvisionerBootstrapPreparedPackageReceiptV2Schema.parse(preparedReceipt)
        .receiptHash,
      preparedReceipt.receiptHash,
    );
    assert.equal(
      revalidateNodeToolchainProvisionerBootstrapPreparedPackageV2(prepared).receiptHash,
      preparedReceipt.receiptHash,
    );
    assert.equal(existsSync(bootstrapRoot), false);
    const cleanInspection = inspectNodeToolchainProvisionerBootstrapInstallationV2(prepared);
    assert.equal(cleanInspection.classification, "target_absent_clean");
    assert.deepEqual(cleanInspection.conflicts, []);
    assert.equal(cleanInspection.boundary.kind, "test_private_boundary");
    assert.equal(cleanInspection.filesystem.root.state, "absent");
    assert.deepEqual(
      NodeToolchainProvisionerBootstrapInstallationInspectionV2Schema.parse(cleanInspection),
      cleanInspection,
    );
    const cleanPlan = planNodeToolchainProvisionerBootstrapInstallationV2(prepared);
    assert.equal(cleanPlan.decision, "publish_new");
    assert.equal(cleanPlan.intent.source.receiptHash, preparedReceipt.receiptHash);
    assert.equal(cleanPlan.inspection.inspectionHash, cleanInspection.inspectionHash);
    assert.deepEqual(
      NodeToolchainProvisionerBootstrapInstallationPlanV2Schema.parse(cleanPlan),
      cleanPlan,
    );
    const rehashedPlanDrift = structuredClone(cleanPlan);
    rehashedPlanDrift.decision = "no_mutation_blocked";
    rehashedPlanDrift.planHash =
      hashNodeToolchainProvisionerBootstrapInstallationPlanV2(rehashedPlanDrift);
    assert.equal(
      NodeToolchainProvisionerBootstrapInstallationPlanV2Schema
        .safeParse(rehashedPlanDrift).success,
      false,
    );

    const lockPath = path.join(
      bootstrapParent,
      NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_LOCK_BASENAME_V2,
    );
    await writeFile(lockPath, "foreign-lock\n", { mode: 0o600 });
    const lockConflict = planNodeToolchainProvisionerBootstrapInstallationV2(prepared);
    assert.equal(lockConflict.decision, "no_mutation_blocked");
    assert.deepEqual(
      lockConflict.inspection.conflicts,
      ["installation_lock_present_without_v2_authority"],
    );
    await unlink(lockPath);

    await writeFile(bootstrapRoot, "foreign-target\n", { mode: 0o600 });
    const foreignTarget = planNodeToolchainProvisionerBootstrapInstallationV2(prepared);
    assert.equal(foreignTarget.decision, "no_mutation_blocked");
    assert.deepEqual(foreignTarget.inspection.conflicts, ["target_package_invalid"]);
    await unlink(bootstrapRoot);

    const installable = copyCompiledNodeToolchainProvisionerBootstrapV2(compiledHandle);
    await mkdir(bootstrapRoot, { mode: 0o700 });
    await mkdir(path.join(bootstrapRoot, "bin"), { mode: 0o700 });
    await mkdir(path.join(bootstrapRoot, "lib"), { mode: 0o700 });
    await mkdir(path.join(bootstrapRoot, "runtime"), { mode: 0o700 });
    await writeFile(
      path.join(bootstrapRoot, installable.manifest.files.launcher.locator),
      installable.launcherBytes,
      { mode: 0o555 },
    );
    await writeFile(
      path.join(bootstrapRoot, installable.manifest.files.bundle.locator),
      installable.bundleBytes,
      { mode: 0o444 },
    );
    await writeFile(
      path.join(bootstrapRoot, installable.manifest.files.bootstrapRuntime.locator),
      installable.runtimeBytes,
      { mode: 0o555 },
    );
    await writeFile(
      path.join(bootstrapRoot, installable.manifest.layout.manifestLocator),
      installable.manifestBytes,
      { mode: 0o444 },
    );
    await chmod(path.join(bootstrapRoot, installable.manifest.files.launcher.locator), 0o555);
    await chmod(path.join(bootstrapRoot, installable.manifest.files.bundle.locator), 0o444);
    await chmod(
      path.join(bootstrapRoot, installable.manifest.files.bootstrapRuntime.locator),
      0o555,
    );
    await chmod(path.join(bootstrapRoot, installable.manifest.layout.manifestLocator), 0o444);
    await chmod(path.join(bootstrapRoot, "bin"), 0o555);
    await chmod(path.join(bootstrapRoot, "lib"), 0o555);
    await chmod(path.join(bootstrapRoot, "runtime"), 0o555);
    await chmod(bootstrapRoot, 0o555);
    installable.manifestBytes.fill(0);
    installable.launcherBytes.fill(0);
    installable.bundleBytes.fill(0);
    installable.runtimeBytes.fill(0);
    const exactUnclaimed = planNodeToolchainProvisionerBootstrapInstallationV2(prepared);
    assert.equal(exactUnclaimed.decision, "no_mutation_blocked");
    assert.equal(exactUnclaimed.inspection.classification, "target_exact_unclaimed");
    assert.deepEqual(exactUnclaimed.inspection.conflicts, ["target_exact_but_unclaimed"]);
    assert.equal(
      exactUnclaimed.inspection.package.status === "verified"
        ? exactUnclaimed.inspection.package.manifestHash
        : "",
      preparedReceipt.source.manifestHash,
    );
    await chmod(bootstrapRoot, 0o700);
    await chmod(path.join(bootstrapRoot, "bin"), 0o700);
    await chmod(path.join(bootstrapRoot, "lib"), 0o700);
    await chmod(path.join(bootstrapRoot, "runtime"), 0o700);
    await rm(bootstrapRoot, { recursive: true, force: true });
    assert.equal(existsSync(bootstrapRoot), false);

    await writeFile(bootstrapRoot, "unclaimed-install-target\n", { mode: 0o600 });
    await assert.rejects(
      installNodeToolchainProvisionerBootstrapV2ForTest({
        preparedHandle: prepared,
        plan: cleanPlan,
      }),
      (error: unknown) =>
        error instanceof NodeToolchainProvisionerBootstrapInstallationErrorV2
        && error.code === "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_V2_CONFLICT",
    );
    assert.equal(await readFile(bootstrapRoot, "utf8"), "unclaimed-install-target\n");
    await unlink(bootstrapRoot);

    const preparedCopy = copyNodeToolchainProvisionerBootstrapPreparedPackageV2(prepared);
    const preparedBundleHash = sha256(preparedCopy.bundleBytes);
    preparedCopy.bundleBytes.fill(0);
    preparedCopy.manifestBytes.fill(0);
    preparedCopy.launcherBytes.fill(0);
    preparedCopy.runtimeBytes.fill(0);
    const preparedCopyAgain = copyNodeToolchainProvisionerBootstrapPreparedPackageV2(prepared);
    assert.equal(sha256(preparedCopyAgain.bundleBytes), preparedBundleHash);
    preparedCopyAgain.manifestBytes.fill(0);
    preparedCopyAgain.launcherBytes.fill(0);
    preparedCopyAgain.bundleBytes.fill(0);
    preparedCopyAgain.runtimeBytes.fill(0);

    const installationIntent =
      buildNodeToolchainProvisionerBootstrapInstallationIntentV2(preparedReceipt);
    const installationClaim =
      buildNodeToolchainProvisionerBootstrapInstallationClaimV2(installationIntent);
    assert.equal(
      NodeToolchainProvisionerBootstrapInstallationIntentV2Schema.parse(installationIntent)
        .intentHash,
      cleanPlan.intent.intentHash,
    );
    assert.equal(
      NodeToolchainProvisionerBootstrapInstallationClaimV2Schema.parse(installationClaim)
        .intent.intentHash,
      installationIntent.intentHash,
    );
    assert.ok(installationIntent.target.stagingBasename.endsWith(preparedReceipt.receiptHash));
    await assert.rejects(
      installNodeToolchainProvisionerBootstrapV2ForTest({
        preparedHandle: prepared,
        plan: cleanPlan,
        testHooks: {
          afterSecondMemberLinked: () => {
            throw new Error("injected-after-second-member-link");
          },
        },
      }),
      (error: unknown) =>
        error instanceof NodeToolchainProvisionerBootstrapInstallationErrorV2
        && error.code
          === "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_V2_PUBLICATION_FAILED",
    );
    const installed = await installNodeToolchainProvisionerBootstrapV2ForTest({
      preparedHandle: prepared,
      plan: cleanPlan,
    });
    const installationReceipt =
      inspectNodeToolchainProvisionerBootstrapInstallationReceiptV2(installed);
    assert.equal(installed.admissionScope, "test_fixture");
    assert.equal(installationReceipt.status, "installed_verified");
    assert.equal(installationReceipt.claim.claimHash, installationClaim.claimHash);
    assert.equal(installationReceipt.finalRoot.manifestHash, preparedReceipt.source.manifestHash);
    assert.deepEqual(
      NodeToolchainProvisionerBootstrapInstallationReceiptV2Schema.parse(installationReceipt),
      installationReceipt,
    );
    assert.equal(
      revalidateInstalledNodeToolchainProvisionerBootstrapV2(installed).receiptHash,
      installationReceipt.receiptHash,
    );
    const readyPlan = planNodeToolchainProvisionerBootstrapInstallationV2(prepared);
    assert.equal(readyPlan.inspection.classification, "ready_verified");
    assert.equal(readyPlan.decision, "return_ready");
    const reopened = openInstalledNodeToolchainProvisionerBootstrapV2ForTest({
      root: bootstrapRoot,
      expectedOwner: {
        uid: process.getuid?.() ?? 0,
        gid: process.getgid?.() ?? 0,
      },
    });
    assert.equal(
      inspectNodeToolchainProvisionerBootstrapInstallationReceiptV2(reopened).receiptHash,
      installationReceipt.receiptHash,
    );
    const concurrentReady = await Promise.all([
      installNodeToolchainProvisionerBootstrapV2ForTest({
        preparedHandle: prepared,
        plan: readyPlan,
      }),
      installNodeToolchainProvisionerBootstrapV2ForTest({
        preparedHandle: prepared,
        plan: readyPlan,
      }),
    ]);
    assert.deepEqual(
      concurrentReady.map((handle) =>
        inspectNodeToolchainProvisionerBootstrapInstallationReceiptV2(handle).receiptHash),
      [installationReceipt.receiptHash, installationReceipt.receiptHash],
    );
    await assert.rejects(
      installNodeToolchainProvisionerBootstrapV2(prepared, cleanPlan),
      (error: unknown) =>
        error instanceof NodeToolchainProvisionerBootstrapInstallationErrorV2
        && error.code === "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_V2_SCOPE_INVALID",
    );
    assert.throws(
      () => inspectNodeToolchainProvisionerBootstrapInstallationReceiptV2(
        Object.create(InstalledNodeToolchainProvisionerBootstrapV2.prototype),
      ),
      (error: unknown) =>
        error instanceof NodeToolchainProvisionerBootstrapInstallationErrorV2
        && error.code
          === "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_V2_HANDLE_UNAUTHENTICATED",
    );
    const installedBundlePath = path.join(
      bootstrapRoot,
      compiled.manifest.files.bundle.locator,
    );
    await chmod(installedBundlePath, 0o644);
    await writeFile(
      installedBundlePath,
      Buffer.alloc(compiled.manifest.files.bundle.byteLength, 0x61),
    );
    await chmod(installedBundlePath, 0o444);
    assert.throws(
      () => revalidateInstalledNodeToolchainProvisionerBootstrapV2(installed),
      (error: unknown) =>
        error instanceof NodeToolchainProvisionerBootstrapInstallationErrorV2,
    );
    const installationPaths = getNodeToolchainProvisionerBootstrapInstallationPathsV2(
      preparedReceipt,
    );
    await chmod(bootstrapRoot, 0o700);
    await chmod(path.join(bootstrapRoot, "bin"), 0o700);
    await chmod(path.join(bootstrapRoot, "lib"), 0o700);
    await chmod(path.join(bootstrapRoot, "runtime"), 0o700);
    await rm(bootstrapRoot, { recursive: true, force: true });
    await unlink(installationPaths.claim);
    await unlink(installationPaths.receipt);
    await assert.rejects(
      installNodeToolchainProvisionerBootstrapV2ForTest({
        preparedHandle: prepared,
        plan: readyPlan,
      }),
      (error: unknown) =>
        error instanceof NodeToolchainProvisionerBootstrapInstallationErrorV2
        && error.code
          === "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_V2_PRECONDITION_CHANGED",
    );
    assert.equal(existsSync(bootstrapRoot), false);
    assert.equal(existsSync(installationPaths.claim), false);
    assert.equal(existsSync(installationPaths.receipt), false);
    assert.throws(
      () => prepareNodeToolchainProvisionerBootstrapPackageV2(compiledHandle),
      (error: unknown) =>
        error instanceof NodeToolchainProvisionerBootstrapPreparedPackageErrorV2
        && error.code === "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_PREPARED_V2_INPUT_INVALID",
    );
    assert.throws(
      () => prepareNodeToolchainProvisionerBootstrapPackageV2ForTest(
        compiled as never,
        { scratchParent: preparedParent },
      ),
      (error: unknown) =>
        error instanceof NodeToolchainProvisionerBootstrapPreparedPackageErrorV2
        && error.code === "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_PREPARED_V2_INPUT_INVALID",
    );
    assert.throws(
      () => inspectNodeToolchainProvisionerBootstrapPreparedPackageReceiptV2(
        Object.create(PreparedNodeToolchainProvisionerBootstrapPackageV2.prototype),
      ),
      (error: unknown) =>
        error instanceof NodeToolchainProvisionerBootstrapPreparedPackageErrorV2
        && error.code
          === "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_PREPARED_V2_HANDLE_UNAUTHENTICATED",
    );
    const rehashedPreparedDrift = structuredClone(preparedReceipt);
    rehashedPreparedDrift.source.manifestSha256 = "9".repeat(64);
    rehashedPreparedDrift.receiptHash =
      hashNodeToolchainProvisionerBootstrapPreparedPackageReceiptV2(rehashedPreparedDrift);
    assert.equal(
      NodeToolchainProvisionerBootstrapPreparedPackageReceiptV2Schema
        .safeParse(rehashedPreparedDrift).success,
      false,
    );
    assert.ok(preparedPayloadRoot.startsWith(preparedParent));
    disposeNodeToolchainProvisionerBootstrapPreparedPackageV2(prepared);
    assert.deepEqual(await readdir(preparedParent), []);
    assert.throws(
      () => revalidateNodeToolchainProvisionerBootstrapPreparedPackageV2(prepared),
      (error: unknown) =>
        error instanceof NodeToolchainProvisionerBootstrapPreparedPackageErrorV2
        && error.code === "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_PREPARED_V2_HANDLE_DISPOSED",
    );
    disposeNodeToolchainProvisionerBootstrapPreparedPackageV2(prepared);

    let driftPayloadRoot = "";
    const driftPrepared = prepareNodeToolchainProvisionerBootstrapPackageV2ForTest(
      compiledHandle,
      {
        scratchParent: preparedParent,
        testHooks: {
          beforeManifest: ({ payloadRoot }) => {
            driftPayloadRoot = payloadRoot;
          },
        },
      },
    );
    assert.equal(
      inspectNodeToolchainProvisionerBootstrapPreparedPackageReceiptV2(driftPrepared).receiptHash,
      preparedReceipt.receiptHash,
    );
    const preparedBundlePath = path.join(
      driftPayloadRoot,
      "lib/node-toolchain-provisioner-v2.cjs",
    );
    await chmod(preparedBundlePath, 0o600);
    await writeFile(
      preparedBundlePath,
      Buffer.alloc(preparedReceipt.members.bundle.byteLength, 0x61),
    );
    await chmod(preparedBundlePath, 0o400);
    assert.throws(
      () => revalidateNodeToolchainProvisionerBootstrapPreparedPackageV2(driftPrepared),
      (error: unknown) =>
        error instanceof NodeToolchainProvisionerBootstrapPreparedPackageErrorV2
        && error.code === "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_PREPARED_V2_PACKAGE_INVALID",
    );
    const joinedSourceDrift = structuredClone(compiled.manifest);
    joinedSourceDrift.build.packageLockSource.hash = "d".repeat(64);
    joinedSourceDrift.build.buildContractHash = hashNodeToolchainProvisionerBootstrapBuildV2(
      joinedSourceDrift.build,
    );
    joinedSourceDrift.manifestHash = hashNodeToolchainProvisionerBootstrapManifestV2(
      joinedSourceDrift,
    );
    assert.equal(
      NodeToolchainProvisionerBootstrapManifestV2Schema.safeParse(joinedSourceDrift).success,
      false,
    );
    await assert.rejects(
      compileNodeToolchainProvisionerBootstrapV2(handle, tree),
      (error: unknown) => error instanceof NodeToolchainProvisionerBootstrapAuthorityErrorV2,
    );

    const rehashedDrift = structuredClone(receipt);
    rehashedDrift.output.sha256 = "f".repeat(64);
    rehashedDrift.receiptHash = hashNodeToolchainProvisionerBundleAuthorityReceiptV2(
      rehashedDrift,
    );
    assert.equal(
      NodeToolchainProvisionerBundleAuthorityReceiptV2Schema.safeParse(rehashedDrift).success,
      false,
    );
    const dependencyDrift = structuredClone(receipt);
    dependencyDrift.dependencyClosure.zod.registryTarballSha256 = "e".repeat(64);
    dependencyDrift.dependencyClosure.closureHash =
      hashNodeToolchainProvisionerBundleDependencyClosureV2(
        dependencyDrift.dependencyClosure,
      );
    dependencyDrift.receiptHash = hashNodeToolchainProvisionerBundleAuthorityReceiptV2(
      dependencyDrift,
    );
    assert.equal(
      NodeToolchainProvisionerBundleAuthorityReceiptV2Schema.safeParse(dependencyDrift).success,
      false,
    );
    assert.throws(
      () => inspectNodeToolchainProvisionerBundleAuthorityReceiptV2(
        Object.create(BuiltNodeToolchainProvisionerBundleV2.prototype),
      ),
      (error: unknown) => error instanceof NodeToolchainProvisionerBundleAuthorityErrorV2
        && error.code === "NODE_TOOLCHAIN_PROVISIONER_BUNDLE_V2_HANDLE_UNAUTHENTICATED",
    );
    await assert.rejects(
      buildNodeToolchainProvisionerBundleAuthorityV2(tree),
      (error: unknown) => error instanceof NodeToolchainProvisionerBundleAuthorityErrorV2
        && error.code === "NODE_TOOLCHAIN_PROVISIONER_BUNDLE_V2_INPUT_INVALID",
    );
    await assert.rejects(
      buildNodeToolchainProvisionerBundleAuthorityV2ForTest(
        tree,
        provisionerBundleBuilderAdapter((executionRef) => Buffer.from(
          executionRef === "first" ? "first\n" : "second\n",
        )),
      ),
      (error: unknown) => error instanceof NodeToolchainProvisionerBundleAuthorityErrorV2
        && error.code === "NODE_TOOLCHAIN_PROVISIONER_BUNDLE_V2_NONDETERMINISTIC",
    );
    disposeCompiledNodeToolchainProvisionerBootstrapV2(compiledHandle);
    assert.throws(
      () => copyCompiledNodeToolchainProvisionerBootstrapV2(compiledHandle),
      (error: unknown) => error instanceof NodeToolchainProvisionerBootstrapAuthorityErrorV2,
    );
    disposeCompiledNodeToolchainProvisionerBootstrapV2(compiledHandle);
  });

  it("recovers every bootstrap installation publication crash under one exact claim", async () => {
    const tree = await privateTree();
    const bundleHandle = await buildNodeToolchainProvisionerBundleAuthorityV2ForTest(
      tree,
      executingProvisionerBundleBuilderAdapter(),
    );
    const crashBoundaries = [
      "afterClaimStage",
      "afterClaimPublished",
      "afterPayloadStaged",
      "afterRootCreated",
      "afterSecondMemberLinked",
      "afterRootVerified",
      "afterReceiptStage",
      "afterReceiptPublished",
    ] as const satisfies readonly (keyof NodeToolchainProvisionerBootstrapInstallationTestHooksV2)[];

    for (const crashBoundary of crashBoundaries) {
      const bootstrapParent = await realpath(await privateParent());
      const bootstrapRoot = path.join(bootstrapParent, "node-toolchain-provisioner-v2");
      const compiledHandle = await compileNodeToolchainProvisionerBootstrapV2ForTestFromAuthority(
        bundleHandle,
        tree,
        bootstrapRoot,
      );
      const preparedParent = await realpath(await privateParent());
      const prepared = prepareNodeToolchainProvisionerBootstrapPackageV2ForTest(
        compiledHandle,
        { scratchParent: preparedParent },
      );
      const preparedReceipt =
        inspectNodeToolchainProvisionerBootstrapPreparedPackageReceiptV2(prepared);
      const plan = planNodeToolchainProvisionerBootstrapInstallationV2(prepared);
      const testHooks = {
        [crashBoundary]: () => {
          throw new Error(`injected-${crashBoundary}`);
        },
      } as NodeToolchainProvisionerBootstrapInstallationTestHooksV2;
      await assert.rejects(
        installNodeToolchainProvisionerBootstrapV2ForTest({
          preparedHandle: prepared,
          plan,
          testHooks,
        }),
        (error: unknown) =>
          error instanceof NodeToolchainProvisionerBootstrapInstallationErrorV2
          && error.code
            === "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_V2_PUBLICATION_FAILED",
      );
      const recoveryPlan = planNodeToolchainProvisionerBootstrapInstallationV2(prepared);
      assert.equal(recoveryPlan.inspection.classification, "claimed_recovery_candidate");
      assert.equal(recoveryPlan.decision, "recover_claimed");
      const recovered = await installNodeToolchainProvisionerBootstrapV2ForTest({
        preparedHandle: prepared,
        plan: recoveryPlan,
      });
      const receipt = inspectNodeToolchainProvisionerBootstrapInstallationReceiptV2(recovered);
      assert.equal(receipt.finalRoot.manifestHash, preparedReceipt.source.manifestHash);
      assert.equal(
        revalidateInstalledNodeToolchainProvisionerBootstrapV2(recovered).receiptHash,
        receipt.receiptHash,
      );
      const paths = getNodeToolchainProvisionerBootstrapInstallationPathsV2(preparedReceipt);
      assert.equal(existsSync(paths.staging), false);
      const readyPlan = planNodeToolchainProvisionerBootstrapInstallationV2(prepared);
      assert.equal(readyPlan.decision, "return_ready");
      assert.deepEqual((await readdir(bootstrapParent)).sort(), [
        path.basename(paths.claim),
        path.basename(paths.lock),
        path.basename(paths.receipt),
        path.basename(paths.root),
      ].sort());
      disposeNodeToolchainProvisionerBootstrapPreparedPackageV2(prepared);
      disposeCompiledNodeToolchainProvisionerBootstrapV2(compiledHandle);
    }

    const foreignParent = await realpath(await privateParent());
    const foreignRoot = path.join(foreignParent, "node-toolchain-provisioner-v2");
    const foreignCompiled = await compileNodeToolchainProvisionerBootstrapV2ForTestFromAuthority(
      bundleHandle,
      tree,
      foreignRoot,
    );
    const foreignPreparedParent = await realpath(await privateParent());
    const foreignPrepared = prepareNodeToolchainProvisionerBootstrapPackageV2ForTest(
      foreignCompiled,
      { scratchParent: foreignPreparedParent },
    );
    const foreignPlan = planNodeToolchainProvisionerBootstrapInstallationV2(foreignPrepared);
    const foreignPaths = getNodeToolchainProvisionerBootstrapInstallationPathsV2(
      inspectNodeToolchainProvisionerBootstrapPreparedPackageReceiptV2(foreignPrepared),
    );
    await mkdir(foreignPaths.staging, { mode: 0o700 });
    const foreignMember = path.join(foreignPaths.staging, "foreign-member");
    await writeFile(foreignMember, "preserve\n", { mode: 0o600 });
    const blocked = planNodeToolchainProvisionerBootstrapInstallationV2(foreignPrepared);
    assert.equal(blocked.decision, "no_mutation_blocked");
    assert.deepEqual(
      blocked.inspection.conflicts,
      ["installation_staging_present_without_v2_authority"],
    );
    await assert.rejects(
      installNodeToolchainProvisionerBootstrapV2ForTest({
        preparedHandle: foreignPrepared,
        plan: foreignPlan,
      }),
      (error: unknown) =>
        error instanceof NodeToolchainProvisionerBootstrapInstallationErrorV2
        && error.code === "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_V2_CONFLICT",
    );
    assert.equal(await readFile(foreignMember, "utf8"), "preserve\n");
    disposeNodeToolchainProvisionerBootstrapPreparedPackageV2(foreignPrepared);
    disposeCompiledNodeToolchainProvisionerBootstrapV2(foreignCompiled);
  });

  it("rolls back only one bootstrap generation across every destructive crash boundary", async () => {
    const tree = await privateTree();
    const bundleHandle = await buildNodeToolchainProvisionerBundleAuthorityV2ForTest(
      tree,
      executingProvisionerBundleBuilderAdapter(),
    );
    const crashBoundaries = [
      "afterRollbackClaimStage",
      "afterRollbackClaimPublished",
      "afterQuarantineCreated",
      "afterRootWritable",
      "afterRootRenamed",
      "afterInstallationReceiptRemoved",
      "afterInstallationClaimRemoved",
      "afterFirstRemovedEntry",
      "afterRollbackReceiptStage",
      "afterRollbackReceiptPublished",
      "afterRollbackClaimRemoved",
    ] as const;

    for (const crashBoundary of crashBoundaries) {
      const bootstrapParent = await realpath(await privateParent());
      const bootstrapRoot = path.join(bootstrapParent, "node-toolchain-provisioner-v2");
      const compiledHandle = await compileNodeToolchainProvisionerBootstrapV2ForTestFromAuthority(
        bundleHandle,
        tree,
        bootstrapRoot,
      );
      const preparedParent = await realpath(await privateParent());
      const prepared = prepareNodeToolchainProvisionerBootstrapPackageV2ForTest(
        compiledHandle,
        { scratchParent: preparedParent },
      );
      const installPlan = planNodeToolchainProvisionerBootstrapInstallationV2(prepared);
      const installed = await installNodeToolchainProvisionerBootstrapV2ForTest({
        preparedHandle: prepared,
        plan: installPlan,
      });
      const rollbackPlan = planNodeToolchainProvisionerBootstrapRollbackV2(installed);
      assert.deepEqual(
        NodeToolchainProvisionerBootstrapRollbackPlanV2Schema.parse(rollbackPlan),
        rollbackPlan,
      );
      const injected = (): never => {
        throw new Error(`injected-${crashBoundary}`);
      };
      const testHooks: NodeToolchainProvisionerBootstrapRollbackTestHooksV2 =
        crashBoundary === "afterFirstRemovedEntry"
          ? {
              afterRemovedEntry: ({ removedCount }) => {
                if (removedCount === 1) injected();
              },
            }
          : { [crashBoundary]: injected };
      await assert.rejects(
        rollbackNodeToolchainProvisionerBootstrapV2ForTest({
          plan: rollbackPlan,
          testHooks,
        }),
        (error: unknown) =>
          error instanceof NodeToolchainProvisionerBootstrapInstallationErrorV2
          && error.code
            === "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_V2_ROLLBACK_FAILED",
      );
      const recovered = await rollbackNodeToolchainProvisionerBootstrapV2ForTest({
        plan: rollbackPlan,
      });
      assert.equal(recovered.disposition, "recovered");
      assert.deepEqual(
        NodeToolchainProvisionerBootstrapRollbackReceiptV2Schema.parse(
          recovered.rollbackReceipt,
        ),
        recovered.rollbackReceipt,
      );
      assert.deepEqual(
        NodeToolchainProvisionerBootstrapRollbackClaimV2Schema.parse(
          recovered.rollbackReceipt.claim,
        ),
        recovered.rollbackReceipt.claim,
      );
      assert.equal(
        revalidateNodeToolchainProvisionerBootstrapRollbackReceiptV2(rollbackPlan).receiptHash,
        recovered.rollbackReceipt.receiptHash,
      );
      const paths = getNodeToolchainProvisionerBootstrapRollbackPathsV2(
        rollbackPlan.installed,
      );
      for (const absentPath of [
        paths.root,
        paths.installationReceipt,
        paths.installationClaim,
        paths.rollbackClaim,
        paths.rollbackStage,
        paths.staging,
      ]) {
        assert.equal(existsSync(absentPath), false, absentPath);
      }
      assert.equal(existsSync(paths.rollbackReceipt), true);
      const replay = await rollbackNodeToolchainProvisionerBootstrapV2ForTest({
        plan: rollbackPlan,
      });
      assert.equal(replay.disposition, "already_complete");
      assert.equal(replay.rollbackReceipt.receiptHash, recovered.rollbackReceipt.receiptHash);
      assert.deepEqual((await readdir(bootstrapParent)).sort(), [
        path.basename(paths.lock),
        path.basename(paths.rollbackReceipt),
      ].sort());
      await assert.rejects(
        rollbackNodeToolchainProvisionerBootstrapV2(rollbackPlan),
        (error: unknown) =>
          error instanceof NodeToolchainProvisionerBootstrapInstallationErrorV2
          && error.code
            === "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_V2_ROLLBACK_CONFLICT",
      );
      disposeNodeToolchainProvisionerBootstrapPreparedPackageV2(prepared);
      disposeCompiledNodeToolchainProvisionerBootstrapV2(compiledHandle);
    }
  });

  it("serializes bootstrap rollback and preserves changed or foreign claimed state", async () => {
    const tree = await privateTree();
    const bundleHandle = await buildNodeToolchainProvisionerBundleAuthorityV2ForTest(
      tree,
      executingProvisionerBundleBuilderAdapter(),
    );
    const installedFixture = async () => {
      const bootstrapParent = await realpath(await privateParent());
      const bootstrapRoot = path.join(bootstrapParent, "node-toolchain-provisioner-v2");
      const compiledHandle = await compileNodeToolchainProvisionerBootstrapV2ForTestFromAuthority(
        bundleHandle,
        tree,
        bootstrapRoot,
      );
      const preparedParent = await realpath(await privateParent());
      const prepared = prepareNodeToolchainProvisionerBootstrapPackageV2ForTest(
        compiledHandle,
        { scratchParent: preparedParent },
      );
      const installed = await installNodeToolchainProvisionerBootstrapV2ForTest({
        preparedHandle: prepared,
        plan: planNodeToolchainProvisionerBootstrapInstallationV2(prepared),
      });
      const plan = planNodeToolchainProvisionerBootstrapRollbackV2(installed);
      return { bootstrapParent, compiledHandle, prepared, plan };
    };

    const concurrent = await installedFixture();
    const concurrentResults = await Promise.all([
      rollbackNodeToolchainProvisionerBootstrapV2ForTest({ plan: concurrent.plan }),
      rollbackNodeToolchainProvisionerBootstrapV2ForTest({ plan: concurrent.plan }),
    ]);
    assert.equal(
      concurrentResults[0]!.rollbackReceipt.receiptHash,
      concurrentResults[1]!.rollbackReceipt.receiptHash,
    );
    assert.deepEqual(
      new Set(concurrentResults.map((result) => result.disposition)),
      new Set(["rolled_back", "already_complete"]),
    );
    disposeNodeToolchainProvisionerBootstrapPreparedPackageV2(concurrent.prepared);
    disposeCompiledNodeToolchainProvisionerBootstrapV2(concurrent.compiledHandle);

    const missing = await installedFixture();
    await assert.rejects(
      rollbackNodeToolchainProvisionerBootstrapV2ForTest({
        plan: missing.plan,
        testHooks: {
          afterRollbackClaimPublished: () => {
            throw new Error("injected-before-missing-member");
          },
        },
      }),
      (error: unknown) =>
        error instanceof NodeToolchainProvisionerBootstrapInstallationErrorV2
        && error.code
          === "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_V2_ROLLBACK_FAILED",
    );
    const missingPaths = getNodeToolchainProvisionerBootstrapRollbackPathsV2(
      missing.plan.installed,
    );
    const missingMember = path.join(
      missingPaths.root,
      missing.plan.installed.claim.intent.source.members.bundle.locator,
    );
    await chmod(path.dirname(missingMember), 0o700);
    await unlink(missingMember);
    await assert.rejects(
      rollbackNodeToolchainProvisionerBootstrapV2ForTest({ plan: missing.plan }),
      (error: unknown) =>
        error instanceof NodeToolchainProvisionerBootstrapInstallationErrorV2
        && error.code
          === "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_V2_ROLLBACK_CONFLICT",
    );
    assert.equal(existsSync(missingPaths.root), true);
    assert.equal(existsSync(missingMember), false);
    disposeNodeToolchainProvisionerBootstrapPreparedPackageV2(missing.prepared);
    disposeCompiledNodeToolchainProvisionerBootstrapV2(missing.compiledHandle);

    const foreign = await installedFixture();
    await assert.rejects(
      rollbackNodeToolchainProvisionerBootstrapV2ForTest({
        plan: foreign.plan,
        testHooks: {
          afterRootRenamed: () => {
            throw new Error("injected-before-foreign-quarantine-member");
          },
        },
      }),
      (error: unknown) =>
        error instanceof NodeToolchainProvisionerBootstrapInstallationErrorV2
        && error.code
          === "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_V2_ROLLBACK_FAILED",
    );
    const foreignPaths = getNodeToolchainProvisionerBootstrapRollbackPathsV2(
      foreign.plan.installed,
    );
    const foreignMember = path.join(foreignPaths.quarantineRoot, "foreign-member");
    await writeFile(foreignMember, "preserve\n", { mode: 0o600 });
    await assert.rejects(
      rollbackNodeToolchainProvisionerBootstrapV2ForTest({ plan: foreign.plan }),
      (error: unknown) =>
        error instanceof NodeToolchainProvisionerBootstrapInstallationErrorV2
        && error.code
          === "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_V2_ROLLBACK_CONFLICT",
    );
    assert.equal(await readFile(foreignMember, "utf8"), "preserve\n");
    disposeNodeToolchainProvisionerBootstrapPreparedPackageV2(foreign.prepared);
    disposeCompiledNodeToolchainProvisionerBootstrapV2(foreign.compiledHandle);

    const aliased = await installedFixture();
    await assert.rejects(
      rollbackNodeToolchainProvisionerBootstrapV2ForTest({
        plan: aliased.plan,
        testHooks: {
          afterQuarantineCreated: () => {
            throw new Error("injected-before-external-claim-alias");
          },
        },
      }),
      (error: unknown) =>
        error instanceof NodeToolchainProvisionerBootstrapInstallationErrorV2
        && error.code
          === "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_V2_ROLLBACK_FAILED",
    );
    const aliasedPaths = getNodeToolchainProvisionerBootstrapRollbackPathsV2(
      aliased.plan.installed,
    );
    const aliasParent = await realpath(await privateParent());
    const claimAlias = path.join(aliasParent, "rollback-claim-alias");
    await link(aliasedPaths.rollbackClaim, claimAlias);
    await assert.rejects(
      rollbackNodeToolchainProvisionerBootstrapV2ForTest({ plan: aliased.plan }),
      (error: unknown) =>
        error instanceof NodeToolchainProvisionerBootstrapInstallationErrorV2
        && error.code
          === "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_V2_ROLLBACK_CONFLICT",
    );
    assert.equal(existsSync(claimAlias), true);
    assert.equal(existsSync(aliasedPaths.root), true);
    disposeNodeToolchainProvisionerBootstrapPreparedPackageV2(aliased.prepared);
    disposeCompiledNodeToolchainProvisionerBootstrapV2(aliased.compiledHandle);

    const lockless = await installedFixture();
    const locklessPaths = getNodeToolchainProvisionerBootstrapRollbackPathsV2(
      lockless.plan.installed,
    );
    await unlink(locklessPaths.lock);
    await assert.rejects(
      rollbackNodeToolchainProvisionerBootstrapV2ForTest({ plan: lockless.plan }),
      (error: unknown) =>
        error instanceof NodeToolchainProvisionerBootstrapInstallationErrorV2
        && error.code
          === "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_V2_ROLLBACK_CONFLICT",
    );
    assert.equal(existsSync(locklessPaths.lock), false);
    assert.equal(existsSync(locklessPaths.root), true);
    disposeNodeToolchainProvisionerBootstrapPreparedPackageV2(lockless.prepared);
    disposeCompiledNodeToolchainProvisionerBootstrapV2(lockless.compiledHandle);

    const lostQuarantine = await installedFixture();
    await assert.rejects(
      rollbackNodeToolchainProvisionerBootstrapV2ForTest({
        plan: lostQuarantine.plan,
        testHooks: {
          afterInstallationReceiptRemoved: () => {
            throw new Error("injected-before-quarantine-loss");
          },
        },
      }),
      (error: unknown) =>
        error instanceof NodeToolchainProvisionerBootstrapInstallationErrorV2
        && error.code
          === "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_V2_ROLLBACK_FAILED",
    );
    const lostQuarantinePaths = getNodeToolchainProvisionerBootstrapRollbackPathsV2(
      lostQuarantine.plan.installed,
    );
    for (const locator of ["runtime", "lib", "bin", "."] as const) {
      await chmod(
        locator === "."
          ? lostQuarantinePaths.quarantineRoot
          : path.join(lostQuarantinePaths.quarantineRoot, locator),
        0o700,
      );
    }
    await rm(lostQuarantinePaths.quarantineRoot, { recursive: true, force: true });
    await assert.rejects(
      rollbackNodeToolchainProvisionerBootstrapV2ForTest({ plan: lostQuarantine.plan }),
      (error: unknown) =>
        error instanceof NodeToolchainProvisionerBootstrapInstallationErrorV2
        && error.code
          === "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_V2_ROLLBACK_CONFLICT",
    );
    assert.equal(existsSync(lostQuarantinePaths.installationReceipt), false);
    assert.equal(existsSync(lostQuarantinePaths.installationClaim), true);
    assert.equal(existsSync(lostQuarantinePaths.rollbackClaim), true);
    disposeNodeToolchainProvisionerBootstrapPreparedPackageV2(lostQuarantine.prepared);
    disposeCompiledNodeToolchainProvisionerBootstrapV2(lostQuarantine.compiledHandle);
  });

  it("retains exact rollback history across reinstall generations and rejects transplanted tombstones", async () => {
    const tree = await privateTree();
    const bundleHandle = await buildNodeToolchainProvisionerBundleAuthorityV2ForTest(
      tree,
      executingProvisionerBundleBuilderAdapter(),
    );
    const bootstrapParent = await realpath(await privateParent());
    const bootstrapRoot = path.join(bootstrapParent, "node-toolchain-provisioner-v2");
    const compiledHandle = await compileNodeToolchainProvisionerBootstrapV2ForTestFromAuthority(
      bundleHandle,
      tree,
      bootstrapRoot,
    );
    const preparedParent = await realpath(await privateParent());
    const prepared = prepareNodeToolchainProvisionerBootstrapPackageV2ForTest(
      compiledHandle,
      { scratchParent: preparedParent },
    );

    const firstInstallPlan = planNodeToolchainProvisionerBootstrapInstallationV2(prepared);
    const firstInstalled = await installNodeToolchainProvisionerBootstrapV2ForTest({
      preparedHandle: prepared,
      plan: firstInstallPlan,
    });
    const firstRollbackPlan = planNodeToolchainProvisionerBootstrapRollbackV2(firstInstalled);
    const rehashedPlanDrift = structuredClone(firstRollbackPlan);
    rehashedPlanDrift.generation.rootInode += 1;
    rehashedPlanDrift.planHash =
      hashNodeToolchainProvisionerBootstrapRollbackPlanV2(rehashedPlanDrift);
    assert.equal(
      NodeToolchainProvisionerBootstrapRollbackPlanV2Schema.safeParse(rehashedPlanDrift).success,
      false,
    );
    const firstRollback = await rollbackNodeToolchainProvisionerBootstrapV2ForTest({
      plan: firstRollbackPlan,
    });
    const rehashedReceiptDrift = structuredClone(firstRollback.rollbackReceipt);
    const driftedMember = rehashedReceiptDrift.claim.treeEntries.find(
      (entry) => entry.type === "file" && entry.locator.endsWith(".cjs"),
    );
    if (!driftedMember) assert.fail("expected bootstrap rollback bundle member");
    driftedMember.contentHash = "f".repeat(64);
    rehashedReceiptDrift.claim.treeEntriesHash =
      hashNodeToolchainProvisionerBootstrapRollbackTreeEntriesV2(
        rehashedReceiptDrift.claim.treeEntries,
      );
    rehashedReceiptDrift.claim.claimHash =
      hashNodeToolchainProvisionerBootstrapRollbackClaimV2(rehashedReceiptDrift.claim);
    rehashedReceiptDrift.receiptHash =
      hashNodeToolchainProvisionerBootstrapRollbackReceiptV2(rehashedReceiptDrift);
    assert.equal(
      NodeToolchainProvisionerBootstrapRollbackReceiptV2Schema
        .safeParse(rehashedReceiptDrift).success,
      false,
    );
    const firstRollbackPaths = getNodeToolchainProvisionerBootstrapRollbackPathsV2(
      firstRollbackPlan.installed,
    );

    await assert.rejects(
      installNodeToolchainProvisionerBootstrapV2ForTest({
        preparedHandle: prepared,
        plan: firstInstallPlan,
      }),
      (error: unknown) =>
        error instanceof NodeToolchainProvisionerBootstrapInstallationErrorV2
        && error.code
          === "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_V2_PRECONDITION_CHANGED",
    );
    assert.equal(existsSync(firstRollbackPaths.root), false);
    const postRollbackInspection =
      inspectNodeToolchainProvisionerBootstrapInstallationV2(prepared);
    assert.equal(postRollbackInspection.predecessorRollbackHistory.status, "verified");
    if (postRollbackInspection.predecessorRollbackHistory.status !== "verified") {
      assert.fail("expected verified predecessor rollback history");
    }
    assert.equal(postRollbackInspection.predecessorRollbackHistory.summary.receiptCount, 1);

    const reinstallPlan = planNodeToolchainProvisionerBootstrapInstallationV2(prepared);
    assert.equal(reinstallPlan.decision, "publish_new");
    const secondInstalled = await installNodeToolchainProvisionerBootstrapV2ForTest({
      preparedHandle: prepared,
      plan: reinstallPlan,
    });
    assert.equal(existsSync(firstRollbackPaths.rollbackReceipt), true);
    const firstInstallationReceipt = firstRollbackPlan.installed;
    const secondInstallationReceipt =
      inspectNodeToolchainProvisionerBootstrapInstallationReceiptV2(secondInstalled);
    assert.equal(firstInstallationReceipt.predecessorRollbackHistory.receiptCount, 0);
    assert.equal(secondInstallationReceipt.predecessorRollbackHistory.receiptCount, 1);
    assert.notEqual(
      firstInstallationReceipt.predecessorRollbackHistory.historyHash,
      secondInstallationReceipt.predecessorRollbackHistory.historyHash,
    );
    const simulatedInodeReuse = structuredClone(secondInstallationReceipt);
    simulatedInodeReuse.finalRoot.device = firstInstallationReceipt.finalRoot.device;
    simulatedInodeReuse.finalRoot.inode = firstInstallationReceipt.finalRoot.inode;
    simulatedInodeReuse.receiptHash =
      hashNodeToolchainProvisionerBootstrapInstallationReceiptV2(simulatedInodeReuse);
    assert.equal(
      NodeToolchainProvisionerBootstrapInstallationReceiptV2Schema
        .safeParse(simulatedInodeReuse).success,
      true,
    );
    assert.notEqual(simulatedInodeReuse.receiptHash, firstInstallationReceipt.receiptHash);
    assert.equal(
      revalidateInstalledNodeToolchainProvisionerBootstrapV2(secondInstalled).receiptHash,
      secondInstallationReceipt.receiptHash,
    );
    const predecessorTombstoneBytes = await readFile(firstRollbackPaths.rollbackReceipt);
    await unlink(firstRollbackPaths.rollbackReceipt);
    await assert.rejects(
      Promise.resolve().then(() =>
        revalidateInstalledNodeToolchainProvisionerBootstrapV2(secondInstalled)),
      (error: unknown) =>
        error instanceof NodeToolchainProvisionerBootstrapInstallationErrorV2
        && error.code
          === "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_V2_RECEIPT_INVALID",
    );
    await writeFile(
      firstRollbackPaths.rollbackReceipt,
      predecessorTombstoneBytes,
      { flag: "wx", mode: 0o444 },
    );
    await chmod(firstRollbackPaths.rollbackReceipt, 0o444);
    assert.equal(
      revalidateInstalledNodeToolchainProvisionerBootstrapV2(secondInstalled).receiptHash,
      secondInstallationReceipt.receiptHash,
    );

    const secondRollbackPlan = planNodeToolchainProvisionerBootstrapRollbackV2(secondInstalled);
    assert.notEqual(
      firstRollbackPlan.generation.installationReceiptHash,
      secondRollbackPlan.generation.installationReceiptHash,
    );
    const secondRollbackPaths = getNodeToolchainProvisionerBootstrapRollbackPathsV2(
      secondRollbackPlan.installed,
    );
    assert.notEqual(firstRollbackPaths.rollbackReceipt, secondRollbackPaths.rollbackReceipt);
    await rollbackNodeToolchainProvisionerBootstrapV2ForTest({ plan: secondRollbackPlan });
    assert.equal(
      revalidateNodeToolchainProvisionerBootstrapRollbackReceiptV2(firstRollbackPlan).planHash,
      firstRollbackPlan.planHash,
    );
    assert.equal(
      revalidateNodeToolchainProvisionerBootstrapRollbackReceiptV2(secondRollbackPlan).planHash,
      secondRollbackPlan.planHash,
    );
    assert.deepEqual((await readdir(bootstrapParent)).sort(), [
      path.basename(firstRollbackPaths.lock),
      path.basename(firstRollbackPaths.rollbackReceipt),
      path.basename(secondRollbackPaths.rollbackReceipt),
    ].sort());

    const foreignParent = await realpath(await privateParent());
    const foreignRoot = path.join(foreignParent, "node-toolchain-provisioner-v2");
    const foreignCompiled = await compileNodeToolchainProvisionerBootstrapV2ForTestFromAuthority(
      bundleHandle,
      tree,
      foreignRoot,
    );
    const foreignPreparedParent = await realpath(await privateParent());
    const foreignPrepared = prepareNodeToolchainProvisionerBootstrapPackageV2ForTest(
      foreignCompiled,
      { scratchParent: foreignPreparedParent },
    );
    const foreignInstalled = await installNodeToolchainProvisionerBootstrapV2ForTest({
      preparedHandle: foreignPrepared,
      plan: planNodeToolchainProvisionerBootstrapInstallationV2(foreignPrepared),
    });
    const transplantedPath = path.join(
      foreignParent,
      path.basename(firstRollbackPaths.rollbackReceipt),
    );
    const transplantedBytes = await readFile(firstRollbackPaths.rollbackReceipt);
    await writeFile(transplantedPath, transplantedBytes, { flag: "wx", mode: 0o444 });
    await chmod(transplantedPath, 0o444);
    const transplantedPlan = planNodeToolchainProvisionerBootstrapInstallationV2(
      foreignPrepared,
    );
    assert.equal(transplantedPlan.decision, "no_mutation_blocked");
    assert.equal(transplantedPlan.inspection.conflicts.includes("rollback_history_invalid"), true);
    await assert.rejects(
      Promise.resolve().then(() =>
        revalidateInstalledNodeToolchainProvisionerBootstrapV2(foreignInstalled)),
      (error: unknown) =>
        error instanceof NodeToolchainProvisionerBootstrapInstallationErrorV2
        && error.code === "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_V2_CONFLICT",
    );
    assert.deepEqual(await readFile(transplantedPath), transplantedBytes);

    disposeNodeToolchainProvisionerBootstrapPreparedPackageV2(foreignPrepared);
    disposeCompiledNodeToolchainProvisionerBootstrapV2(foreignCompiled);
    disposeNodeToolchainProvisionerBootstrapPreparedPackageV2(prepared);
    disposeCompiledNodeToolchainProvisionerBootstrapV2(compiledHandle);
  });

  it("compiles one exact bootstrap manifest and a fail-closed root launcher", async () => {
    const packageRootAlias = await privateParent();
    const packageRoot = await realpath(packageRootAlias);
    const tree = await privateTree();
    const privateBundle = await copyMaterializedNodeToolchainPrivateTreeBundleV2(tree);
    const runtimeEntry = privateBundle.entries.find((entry) => entry.locator === "bin/node");
    assert.ok(runtimeEntry?.bytes);
    const input = {
      codeSha: "1".repeat(40),
      sourceTreeHash: "2".repeat(40),
      packageVersion: "2.3.79",
      entrypointSourceBytes: Buffer.from("export {};\n"),
      packageJsonSourceBytes: Buffer.from("{\"name\":\"setfarm\",\"version\":\"2.3.79\"}\n"),
      packageLockSourceBytes: Buffer.from("{\"lockfileVersion\":3}\n"),
      bundleBytes: Buffer.from("process.stdout.write('{}');\n"),
      runtimeBytes: runtimeEntry.bytes,
      sourcePrivateTree: inspectNodeToolchainPrivateTreeReceiptV2(tree),
    };
    const first = compileNodeToolchainProvisionerBootstrapV2ForTest(input, packageRoot);
    const second = compileNodeToolchainProvisionerBootstrapV2ForTest(input, packageRoot);

    assert.deepEqual(second.manifest, first.manifest);
    assert.equal(first.manifest.release.branch, "test_fixture");
    assert.equal(first.manifest.release.dirty, true);
    assert.deepEqual(second.launcherBytes, first.launcherBytes);
    assert.deepEqual(first.manifestBytes, canonicalJsonBytes(first.manifest));
    assert.equal(first.manifestBytes.at(-1), "}".charCodeAt(0));
    assert.equal(
      NodeToolchainProvisionerBootstrapManifestV2Schema.parse(first.manifest).manifestHash,
      first.manifest.manifestHash,
    );
    assert.equal(first.manifest.files.bootstrapRuntime.sha256, runtimeEntry.contentHash);
    assert.equal(first.manifest.files.bootstrapRuntime.byteLength, runtimeEntry.byteLength);
    assert.equal(first.manifest.distribution.sourcePrivateTree.receiptHash, privateBundle.receipt.receiptHash);
    assert.match(first.launcherBytes.toString("utf8"), /^#!\/bin\/sh\n/);
    assert.match(first.launcherBytes.toString("utf8"), /exec \/usr\/bin\/env -i/);
    assert.doesNotMatch(first.launcherBytes.toString("utf8"), /command -v|\/opt\/homebrew|\/usr\/local|\bPATH=/);

    const promotedFixture = structuredClone(first.manifest);
    promotedFixture.admissionScope = "production_root";
    promotedFixture.manifestHash = hashNodeToolchainProvisionerBootstrapManifestV2(promotedFixture);
    assert.equal(
      NodeToolchainProvisionerBootstrapManifestV2Schema.safeParse(promotedFixture).success,
      false,
    );
    assert.throws(
      () => compileNodeToolchainProvisionerBootstrapV2ForTest(
        { ...input, runtimeBytes: Buffer.from("different-runtime\n") },
        packageRoot,
      ),
      (error: unknown) => error instanceof NodeToolchainProvisionerBootstrapAuthorityErrorV2,
    );

    const rehashedDrift = structuredClone(first.manifest);
    rehashedDrift.files.bootstrapRuntime.sha256 = "f".repeat(64);
    rehashedDrift.manifestHash = hashNodeToolchainProvisionerBootstrapManifestV2(rehashedDrift);
    assert.equal(
      NodeToolchainProvisionerBootstrapManifestV2Schema.safeParse(rehashedDrift).success,
      false,
    );

    const wrongOwnerLauncher = renderNodeToolchainProvisionerBootstrapLauncherV2({
      rootLocator: packageRoot,
      expectedOwnerUid: (process.getuid?.() ?? 0) + 1,
      expectedOwnerGid: process.getgid?.() ?? 0,
      bundleSha256: "a".repeat(64),
      bundleByteLength: 1,
      runtimeSha256: "b".repeat(64),
      runtimeByteLength: 1,
    });
    const launcherPath = path.join(packageRoot, "wrong-owner-launcher");
    await writeFile(launcherPath, wrongOwnerLauncher, { mode: 0o700 });
    const rejected = spawnSync("/bin/sh", [launcherPath, "inspect"], {
      encoding: "utf8",
      env: { PATH: "/hostile", NODE_OPTIONS: "--definitely-invalid" },
    });
    assert.equal(rejected.status, 70, rejected.stderr);
    const failure = NodeToolchainProvisionerBootstrapFailureV2Schema.parse(
      JSON.parse(rejected.stdout),
    );
    assert.equal(failure.failureCode, "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_V2_ROOT_REQUIRED");
    assert.equal(rejected.stdout.endsWith("\n"), false);
    await unlink(launcherPath);

    await mkdir(path.join(packageRoot, "bin"), { mode: 0o700 });
    await mkdir(path.join(packageRoot, "lib"), { mode: 0o700 });
    await mkdir(path.join(packageRoot, "runtime"), { mode: 0o700 });
    await writeFile(
      path.join(packageRoot, first.manifest.files.launcher.locator),
      first.launcherBytes,
      { mode: 0o555 },
    );
    await writeFile(
      path.join(packageRoot, first.manifest.files.bundle.locator),
      first.bundleBytes,
      { mode: 0o444 },
    );
    await writeFile(
      path.join(packageRoot, first.manifest.files.bootstrapRuntime.locator),
      first.runtimeBytes,
      { mode: 0o555 },
    );
    await writeFile(
      path.join(packageRoot, first.manifest.layout.manifestLocator),
      first.manifestBytes,
      { mode: 0o444 },
    );
    await chmod(path.join(packageRoot, first.manifest.files.launcher.locator), 0o555);
    await chmod(path.join(packageRoot, first.manifest.files.bundle.locator), 0o444);
    await chmod(path.join(packageRoot, first.manifest.files.bootstrapRuntime.locator), 0o555);
    await chmod(path.join(packageRoot, first.manifest.layout.manifestLocator), 0o444);
    await chmod(path.join(packageRoot, "bin"), 0o555);
    await chmod(path.join(packageRoot, "lib"), 0o555);
    await chmod(path.join(packageRoot, "runtime"), 0o555);
    await chmod(packageRoot, 0o555);

    const handle = openNodeToolchainProvisionerBootstrapPackageV2ForTest({
      root: packageRoot,
      expectedOwner: {
        uid: process.getuid?.() ?? 0,
        gid: process.getgid?.() ?? 0,
      },
    });
    assert.equal(
      inspectNodeToolchainProvisionerBootstrapPackageV2(handle).manifestHash,
      first.manifest.manifestHash,
    );
    assert.equal(
      revalidateNodeToolchainProvisionerBootstrapPackageV2(handle).manifestHash,
      first.manifest.manifestHash,
    );
    assert.throws(
      () => inspectNodeToolchainProvisionerBootstrapPackageV2(first.manifest as never),
      (error: unknown) => error instanceof NodeToolchainProvisionerBootstrapPackageErrorV2
        && error.code === "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_V2_HANDLE_UNAUTHENTICATED",
    );

    const bundlePath = path.join(packageRoot, first.manifest.files.bundle.locator);
    await chmod(bundlePath, 0o644);
    await writeFile(bundlePath, Buffer.alloc(first.bundleBytes.byteLength, 0x61));
    await chmod(bundlePath, 0o444);
    assert.throws(
      () => revalidateNodeToolchainProvisionerBootstrapPackageV2(handle),
      (error: unknown) => error instanceof NodeToolchainProvisionerBootstrapPackageErrorV2
        && error.code === "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_V2_FILE_MISMATCH",
    );
  });
});
