import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  chmod,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, it } from "node:test";

import {
  NodeToolchainArchiveInventoryErrorV2,
  inspectNodeToolchainArchiveInventoryReceiptV2,
  inventoryVerifiedNodeToolchainDistributionArchiveV2,
  inventoryVerifiedNodeToolchainDistributionArchiveV2ForTest,
  type NodeToolchainTarInventoryInvocationV2,
  type NodeToolchainTarInventoryResultV2,
} from "../../src/product-compiler/node-toolchain-archive-inventory-v2.js";
import {
  disposeVerifiedNodeToolchainDistributionArchiveV2,
  verifyNodeToolchainDistributionArchiveV2ForTest,
  type VerifiedNodeToolchainDistributionArchiveV2,
} from "../../src/product-compiler/node-toolchain-distribution-authority-v2.js";
import {
  NodeToolchainArchiveInventoryReceiptV2Schema,
  hashNodeToolchainArchiveInventoryReceiptV2,
} from "../../src/product-compiler/schemas/node-toolchain-archive-inventory-v2.js";
import {
  NodeToolchainDistributionArtifactV2Schema,
  hashNodeToolchainDistributionArtifactV2,
} from "../../src/product-compiler/schemas/node-toolchain-distribution-v2.js";

const roots: string[] = [];
const archives: VerifiedNodeToolchainDistributionArchiveV2[] = [];
const ARCHIVE_ROOT = "node-v22.23.1-darwin-arm64";

function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

async function makeArchive(input: Readonly<{
  selectedCliSymlink?: boolean;
  builtinNpmrc?: boolean;
}> = {}): Promise<Readonly<{
  archivePath: string;
  artifact: ReturnType<typeof testArtifact>;
}>> {
  const root = await mkdtemp(path.join(tmpdir(), "setfarm-node-inventory-v2-"));
  roots.push(root);
  const source = path.join(root, "source", ARCHIVE_ROOT);
  const npmRoot = path.join(source, "lib", "node_modules", "npm");
  await mkdir(path.join(source, "bin"), { recursive: true });
  await mkdir(path.join(npmRoot, "bin"), { recursive: true });
  await writeFile(path.join(source, "bin", "node"), "node-binary\n", { mode: 0o755 });
  await writeFile(path.join(npmRoot, "package.json"), "{\"name\":\"npm\",\"version\":\"10.9.8\"}\n");
  await writeFile(path.join(npmRoot, ".npmrc"), "");
  if (input.builtinNpmrc) await writeFile(path.join(npmRoot, "npmrc"), "prefix=/fixture\n");
  if (input.selectedCliSymlink) {
    await symlink("../package.json", path.join(npmRoot, "bin", "npm-cli.js"));
  } else {
    await writeFile(path.join(npmRoot, "bin", "npm-cli.js"), "// npm cli\n", { mode: 0o755 });
  }
  await symlink("../lib/node_modules/npm/bin/npm-cli.js", path.join(source, "bin", "npm"));
  const archivePath = path.join(root, "fixture.tar.xz");
  execFileSync("/usr/bin/tar", ["-cJf", archivePath, "-C", path.dirname(source), ARCHIVE_ROOT], {
    env: { LANG: "C", LC_ALL: "C", TZ: "UTC" },
    stdio: "pipe",
  });
  await chmod(archivePath, 0o600);
  const bytes = await readFile(archivePath);
  return { archivePath, artifact: testArtifact(bytes) };
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

async function verifiedArchive(input: Readonly<{
  selectedCliSymlink?: boolean;
  builtinNpmrc?: boolean;
}> = {}): Promise<VerifiedNodeToolchainDistributionArchiveV2> {
  const fixture = await makeArchive(input);
  const handle = await verifyNodeToolchainDistributionArchiveV2ForTest({
    archivePath: fixture.archivePath,
    artifact: fixture.artifact,
    manifestHash: "a".repeat(64),
  });
  archives.push(handle);
  return handle;
}

afterEach(async () => {
  await Promise.all(archives.splice(0).map(async (handle) => {
    try {
      await disposeVerifiedNodeToolchainDistributionArchiveV2(handle);
    } catch {
      // Preserve the original test failure.
    }
  }));
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("NodeToolchainArchiveInventoryV2", () => {
  it("inventories every archive member and selects only exact Node/npm closure", async () => {
    const archive = await verifiedArchive();
    const inventoried = await inventoryVerifiedNodeToolchainDistributionArchiveV2(archive);
    const receipt = inspectNodeToolchainArchiveInventoryReceiptV2(inventoried);

    assert.equal(receipt.status, "inventoried_verified");
    assert.equal(receipt.admissionScope, "test_fixture");
    assert.equal(receipt.inventory.memberCount, 11);
    assert.equal(receipt.inventory.symlinkCount, 1);
    assert.equal(receipt.selected.nodeExecutableType, "file");
    assert.equal(receipt.selected.npmPackageRootType, "directory");
    assert.equal(receipt.selected.npmMemberCount, 4);
    assert.equal(receipt.selected.builtinNpmrcStatus, "absent");
    assert.equal(receipt.selected.discardedUnselectedSymlinkCount, 1);
    assert.equal(receipt.tarTool.ownerUid, 0);
    assert.equal(NodeToolchainArchiveInventoryReceiptV2Schema.parse(receipt).receiptHash, receipt.receiptHash);
    assert.equal(Object.isFrozen(receipt), true);
    assert.doesNotMatch(JSON.stringify(receipt), /setfarm-node-inventory|fixture\.tar|\/private\/|\/var\//);
  });

  it("rejects a symlink inside the selected npm closure while allowing discarded links", async () => {
    await assert.rejects(
      inventoryVerifiedNodeToolchainDistributionArchiveV2(await verifiedArchive({ selectedCliSymlink: true })),
      { code: "NODE_TOOLCHAIN_ARCHIVE_V2_SELECTED_TYPE_REJECTED" },
    );
  });

  it("rejects an unadmitted builtin npmrc inside the selected closure", async () => {
    await assert.rejects(
      inventoryVerifiedNodeToolchainDistributionArchiveV2(await verifiedArchive({ builtinNpmrc: true })),
      { code: "NODE_TOOLCHAIN_ARCHIVE_V2_SELECTED_CLOSURE_UNEXPECTED" },
    );
  });

  it("rejects traversal, case collision, duplicate and incomplete selected closure", async () => {
    const archive = await verifiedArchive();
    const base = [
      `${ARCHIVE_ROOT}/`,
      `${ARCHIVE_ROOT}/bin/`,
      `${ARCHIVE_ROOT}/bin/node`,
      `${ARCHIVE_ROOT}/lib/`,
      `${ARCHIVE_ROOT}/lib/node_modules/`,
      `${ARCHIVE_ROOT}/lib/node_modules/npm/`,
      `${ARCHIVE_ROOT}/lib/node_modules/npm/bin/`,
      `${ARCHIVE_ROOT}/lib/node_modules/npm/bin/npm-cli.js`,
      `${ARCHIVE_ROOT}/lib/node_modules/npm/package.json`,
      `${ARCHIVE_ROOT}/lib/node_modules/npm/.npmrc`,
    ];
    const types = ["d", "d", "-", "d", "d", "d", "d", "-", "-", "-"];
    const cases: Array<readonly [string[], string[], string]> = [
      [[...base, `${ARCHIVE_ROOT}/../escape`], [...types, "-"], "NODE_TOOLCHAIN_ARCHIVE_V2_PATH_INVALID"],
      [[...base, `${ARCHIVE_ROOT}/README`, `${ARCHIVE_ROOT}/readme`], [...types, "-", "-"],
        "NODE_TOOLCHAIN_ARCHIVE_V2_CASE_COLLISION"],
      [[...base, base[2]!], [...types, "-"], "NODE_TOOLCHAIN_ARCHIVE_V2_DUPLICATE_MEMBER"],
      [base.filter((entry) => !entry.endsWith("/package.json")), types.filter((_entry, index) => index !== 8),
        "NODE_TOOLCHAIN_ARCHIVE_V2_SELECTED_CLOSURE_INCOMPLETE"],
    ];
    for (const [names, typeChars, code] of cases) {
      const adapter = async (_invocation: NodeToolchainTarInventoryInvocationV2):
      Promise<NodeToolchainTarInventoryResultV2> => ({
        status: "exited",
        exitCode: 0,
        signal: null,
        namesOutput: `${names.join("\n")}\n`,
        verboseOutput: `${typeChars.join(" fixture\n")} fixture\n`,
        stderr: "",
      });
      await assert.rejects(
        inventoryVerifiedNodeToolchainDistributionArchiveV2ForTest(archive, { tarAdapter: adapter }),
        { code },
      );
    }
  });

  it("classifies tar timeout, output, signal, nonzero and malformed listing", async () => {
    const archive = await verifiedArchive();
    const failures: Array<readonly [NodeToolchainTarInventoryResultV2, string]> = [
      [{ status: "timed_out", namesOutput: "", verboseOutput: "", stderr: "" },
        "NODE_TOOLCHAIN_ARCHIVE_V2_TAR_TIMEOUT"],
      [{ status: "output_limit_exceeded", namesOutput: "", verboseOutput: "", stderr: "" },
        "NODE_TOOLCHAIN_ARCHIVE_V2_TAR_OUTPUT_LIMIT"],
      [{ status: "spawn_failed", namesOutput: "", verboseOutput: "", stderr: "" },
        "NODE_TOOLCHAIN_ARCHIVE_V2_TAR_SPAWN_FAILED"],
      [{ status: "exited", exitCode: null, signal: "SIGKILL", namesOutput: "", verboseOutput: "", stderr: "" },
        "NODE_TOOLCHAIN_ARCHIVE_V2_TAR_SIGNALLED"],
      [{ status: "exited", exitCode: 2, signal: null, namesOutput: "", verboseOutput: "", stderr: "bad" },
        "NODE_TOOLCHAIN_ARCHIVE_V2_TAR_NONZERO"],
      [{ status: "exited", exitCode: 0, signal: null, namesOutput: "a\n", verboseOutput: "", stderr: "" },
        "NODE_TOOLCHAIN_ARCHIVE_V2_LISTING_MALFORMED"],
    ];
    for (const [result, code] of failures) {
      await assert.rejects(inventoryVerifiedNodeToolchainDistributionArchiveV2ForTest(archive, {
        tarAdapter: async () => result,
      }), { code });
    }
  });

  it("rejects private archive mutation during inventory and removes its stage", async () => {
    const archive = await verifiedArchive();
    await assert.rejects(inventoryVerifiedNodeToolchainDistributionArchiveV2ForTest(archive, {
      tarAdapter: async (invocation) => {
        await writeFile(invocation.namesArgv[1], "changed");
        return {
          status: "exited",
          exitCode: 0,
          signal: null,
          namesOutput: `${ARCHIVE_ROOT}/\n`,
          verboseOutput: "d fixture\n",
          stderr: "",
        };
      },
    }), { code: "NODE_TOOLCHAIN_ARCHIVE_V2_PRIVATE_COPY_INVALID" });
  });

  it("keeps inventory authority handle-only even for a self-rehashed receipt", async () => {
    const inventoried = await inventoryVerifiedNodeToolchainDistributionArchiveV2(await verifiedArchive());
    const receipt = inspectNodeToolchainArchiveInventoryReceiptV2(inventoried);
    assert.throws(() => inspectNodeToolchainArchiveInventoryReceiptV2(receipt as never), {
      code: "NODE_TOOLCHAIN_ARCHIVE_V2_HANDLE_UNAUTHENTICATED",
    });
    assert.throws(() => inspectNodeToolchainArchiveInventoryReceiptV2(new Proxy(inventoried, {}) as never), {
      code: "NODE_TOOLCHAIN_ARCHIVE_V2_HANDLE_UNAUTHENTICATED",
    });
    const { receiptHash: _receiptHash, ...payload } = receipt;
    const forged = {
      ...payload,
      inventory: { ...payload.inventory, inventoryHash: "b".repeat(64) },
      receiptHash: "c".repeat(64),
    };
    forged.receiptHash = hashNodeToolchainArchiveInventoryReceiptV2(forged);
    assert.equal(NodeToolchainArchiveInventoryReceiptV2Schema.safeParse(forged).success, true);
    assert.throws(() => inspectNodeToolchainArchiveInventoryReceiptV2(forged as never), {
      code: "NODE_TOOLCHAIN_ARCHIVE_V2_HANDLE_UNAUTHENTICATED",
    });
  });
});
