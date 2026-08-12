import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import {
  chmod,
  lstat,
  mkdir,
  mkdtemp,
  readdir,
  realpath,
  rm,
} from "node:fs/promises";
import { release as osRelease, tmpdir } from "node:os";
import path from "node:path";

import { canonicalJsonBytes } from "../src/product-compiler/canonical-json.js";
import {
  createHostNodeToolchainAuthorityV2ForTest,
  inspectHostNodeToolchainReceiptV2,
} from "../src/product-compiler/host-node-toolchain-authority-v2.js";
import {
  createNodeScaffoldExecutionEnvironmentV2ForTest,
  destroyNodeScaffoldExecutionEnvironmentV2,
  inspectEffectiveNpmConfigReceiptV2,
  inspectNodeScaffoldExecutionEnvironmentReceiptV2,
  revalidateNodeScaffoldExecutionEnvironmentV2,
  type NodeScaffoldExecutionEnvironmentV2,
} from "../src/product-compiler/node-scaffold-execution-environment-v2.js";
import {
  getCodeOwnedNodeToolchainProvisionerRehearsalSourceV2,
  withNodeToolchainProvisionerRehearsalPrivateTreeV2,
} from "../src/product-compiler/node-toolchain-provisioner-rehearsal-source-v2.js";
import {
  inspectNodeToolchainDistributionVerificationReceiptV2,
  disposeVerifiedNodeToolchainDistributionArchiveV2,
  verifyNodeToolchainDistributionArchiveV2,
} from "../src/product-compiler/node-toolchain-distribution-authority-v2.js";
import {
  inspectNodeToolchainProvisioningReceiptV2,
  provisionNodeToolchainV2ForTest,
} from "../src/product-compiler/node-toolchain-provisioning-v2.js";
import { getCodeOwnedNodeToolchainTargetV2 } from
  "../src/product-compiler/node-toolchain-target-registry-v2.js";
import {
  NODE_SCAFFOLD_EXECUTION_ENVIRONMENT_REHEARSAL_AUTHORITY_REF_V2,
  NODE_SCAFFOLD_EXECUTION_ENVIRONMENT_REHEARSAL_RECEIPT_V2_SCHEMA,
  NODE_SCAFFOLD_EXECUTION_ENVIRONMENT_REHEARSAL_VERSION_V2,
  NodeScaffoldExecutionEnvironmentRehearsalReceiptV2Schema,
  hashNodeScaffoldExecutionEnvironmentRehearsalReceiptV2,
  type NodeScaffoldExecutionEnvironmentRehearsalReceiptHashPayloadV2,
} from "../src/product-compiler/schemas/node-scaffold-execution-environment-rehearsal-v2.js";

const PROFILE_ID = "PROFILE_NODE_CLI_STATELESS_EXACT_V2" as const;

function fail(message: string): never {
  throw new Error(message.slice(0, 2_000));
}

function renderErrorChain(error: unknown): string {
  const lines: string[] = [];
  const seen = new Set<unknown>();
  let current: unknown = error;
  while (current instanceof Error && !seen.has(current) && lines.length < 8) {
    seen.add(current);
    const code = "code" in current && typeof current.code === "string"
      ? ` [${current.code}]`
      : "";
    lines.push(`${current.name}${code}: ${current.message}`);
    current = "cause" in current ? current.cause : undefined;
  }
  if (lines.length === 0) lines.push(String(error));
  return lines.join("\ncaused by ");
}

function plistValue(key: "ProductUserVisibleVersion" | "ProductBuildVersion"): string {
  const source = readFileSync(
    "/System/Library/CoreServices/SystemVersion.plist",
    "utf8",
  );
  const match = new RegExp(`<key>${key}</key>\\s*<string>([^<]+)</string>`).exec(source);
  if (!match) return fail(`Current macOS ${key} is unavailable`);
  return match[1]!;
}

async function makeWritable(root: string): Promise<void> {
  let stat;
  try {
    stat = await lstat(root);
  } catch {
    return;
  }
  if (stat.isSymbolicLink()) return fail("Environment rehearsal cleanup encountered a symbolic link");
  if (!stat.isDirectory()) return;
  await chmod(root, 0o700);
  for (const name of await readdir(root)) await makeWritable(path.join(root, name));
}

async function removeRehearsalRoot(root: string): Promise<void> {
  await makeWritable(root);
  await rm(root, { recursive: true, force: false });
  if (existsSync(root)) return fail("Environment rehearsal root remained after exact cleanup");
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  if (
    argv.length !== 2
    || argv[0] !== "--archive"
    || !path.isAbsolute(argv[1]!)
    || path.normalize(argv[1]!) !== argv[1]
  ) {
    return fail(
      "Usage: rehearse-node-scaffold-execution-environment-v2.ts --archive /absolute/node.tar.xz",
    );
  }
  if (
    process.platform !== "darwin"
    || (process.arch !== "arm64" && process.arch !== "x64")
    || typeof process.getuid !== "function"
    || process.getuid() === 0
  ) {
    return fail("Environment rehearsal requires one unprivileged Darwin arm64 or x64 process");
  }
  const architecture = process.arch;
  const archivePath = argv[1]!;
  const officialArchive = await verifyNodeToolchainDistributionArchiveV2({
    architecture,
    archivePath,
  });
  const officialReceipt = inspectNodeToolchainDistributionVerificationReceiptV2(officialArchive);
  await disposeVerifiedNodeToolchainDistributionArchiveV2(officialArchive);
  assert.equal(officialReceipt.admissionScope, "production_distribution");
  const source = getCodeOwnedNodeToolchainProvisionerRehearsalSourceV2(architecture);
  assert.equal(officialReceipt.manifest.manifestHash, source.officialManifestHash);
  assert.equal(officialReceipt.artifact.artifactHash, source.officialArtifactHash);

  const rehearsalRoot = await realpath(await mkdtemp(
    path.join(tmpdir(), "setfarm-node-scaffold-environment-rehearsal-v2-"),
  ));
  await chmod(rehearsalRoot, 0o700);
  const provisionerParent = path.join(rehearsalRoot, "toolchains");
  const scratchParent = path.join(rehearsalRoot, "scratch");
  const environmentParent = path.join(rehearsalRoot, "environment");
  for (const directory of [provisionerParent, scratchParent, environmentParent]) {
    await mkdir(directory, { mode: 0o700 });
    await chmod(directory, 0o700);
  }

  let evidence: Omit<
    NodeScaffoldExecutionEnvironmentRehearsalReceiptHashPayloadV2,
    "schema" | "receiptVersion" | "authorityRef" | "status" | "admissionScope" | "architecture"
  > | undefined;
  try {
    evidence = await withNodeToolchainProvisionerRehearsalPrivateTreeV2({
      archivePath,
      architecture,
      scratchParent,
    }, async (tree) => {
      const provisioned = await provisionNodeToolchainV2ForTest(tree, {
        parent: provisionerParent,
      });
      const provisioningReceipt = inspectNodeToolchainProvisioningReceiptV2(provisioned);
      const target = getCodeOwnedNodeToolchainTargetV2(architecture);
      const host = await createHostNodeToolchainAuthorityV2ForTest({
        profileId: PROFILE_ID,
        fixture: {
          candidateRoot: path.join(provisionerParent, target.rootBasename),
          host: {
            platform: "darwin",
            architecture,
            macosProductVersion: plistValue("ProductUserVisibleVersion"),
            macosBuildVersion: plistValue("ProductBuildVersion"),
            darwinKernelRelease: osRelease(),
          },
        },
        provisionedToolchain: provisioned,
      });
      const hostReceipt = inspectHostNodeToolchainReceiptV2(host);
      let environment: NodeScaffoldExecutionEnvironmentV2 | undefined;
      try {
        environment = await createNodeScaffoldExecutionEnvironmentV2ForTest({
          profileId: PROFILE_ID,
          hostToolchain: host,
          scratchParent: environmentParent,
        });
        const environmentReceipt = inspectNodeScaffoldExecutionEnvironmentReceiptV2(environment);
        const effectiveConfigReceipt = inspectEffectiveNpmConfigReceiptV2(environment);
        const replay = await revalidateNodeScaffoldExecutionEnvironmentV2(environment);
        assert.equal(replay.receiptHash, environmentReceipt.receiptHash);
        assert.equal(effectiveConfigReceipt.effectiveConfig.registry, "https://registry.npmjs.org");
        assert.equal(environmentReceipt.executionProjectNpmrc.evidenceStatus, "pending_file_tree_join");
        destroyNodeScaffoldExecutionEnvironmentV2(environment);
        environment = undefined;
        assert.deepEqual(await readdir(environmentParent), []);
        return {
          officialSource: {
            manifestHash: source.officialManifestHash,
            artifactHash: source.officialArtifactHash,
            verificationReceiptHash: officialReceipt.receiptHash,
            archiveSha256: officialReceipt.archive.sha256,
            archiveByteLength: officialReceipt.archive.byteLength,
          },
          provisioning: {
            receiptSchema: provisioningReceipt.schema,
            receiptHash: provisioningReceipt.receiptHash,
            treeHash: provisioningReceipt.finalRoot.treeHash,
            targetRef: provisioningReceipt.finalRoot.targetRef,
          },
          hostToolchain: {
            receiptSchema: hostReceipt.schema,
            receiptHash: hostReceipt.receiptHash,
            nodeVersion: hostReceipt.node.version as "22.23.1",
            modulesAbi: hostReceipt.node.modulesAbi as "127",
            napiVersion: hostReceipt.node.napiVersion as "10",
            npmVersion: hostReceipt.npm.version as "10.9.8",
            nodeIdentityHash: hostReceipt.node.identityHash,
            npmClosureHash: hostReceipt.npm.closureHash,
          },
          environment: {
            receiptSchema: environmentReceipt.schema,
            receiptHash: environmentReceipt.receiptHash,
            effectiveConfigReceiptSchema: effectiveConfigReceipt.schema,
            effectiveConfigReceiptHash: effectiveConfigReceipt.receiptHash,
            effectiveConfigHash: effectiveConfigReceipt.effectiveConfigHash,
            environmentHash: environmentReceipt.environment.environmentHash,
            revalidationReceiptHash: replay.receiptHash,
            registry: effectiveConfigReceipt.effectiveConfig.registry,
            projectNpmrcEvidence: environmentReceipt.executionProjectNpmrc.evidenceStatus,
          },
          finalState: {
            environmentRoot: "absent_after_authenticated_destroy" as const,
            rehearsalRoot: "removed_exactly" as const,
            productionToolchainRoot: "untouched" as const,
          },
        };
      } finally {
        if (environment) destroyNodeScaffoldExecutionEnvironmentV2(environment);
      }
    });
  } finally {
    await removeRehearsalRoot(rehearsalRoot);
  }
  if (!evidence) return fail("Environment rehearsal completed without canonical evidence");
  const identity: NodeScaffoldExecutionEnvironmentRehearsalReceiptHashPayloadV2 = {
    schema: NODE_SCAFFOLD_EXECUTION_ENVIRONMENT_REHEARSAL_RECEIPT_V2_SCHEMA,
    receiptVersion: NODE_SCAFFOLD_EXECUTION_ENVIRONMENT_REHEARSAL_VERSION_V2,
    authorityRef: NODE_SCAFFOLD_EXECUTION_ENVIRONMENT_REHEARSAL_AUTHORITY_REF_V2,
    status: "rehearsal_passed",
    admissionScope: "test_fixture",
    architecture,
    ...evidence,
  };
  const receipt = NodeScaffoldExecutionEnvironmentRehearsalReceiptV2Schema.parse({
    ...identity,
    receiptHash: hashNodeScaffoldExecutionEnvironmentRehearsalReceiptV2(identity),
  });
  process.stdout.write(canonicalJsonBytes(receipt));
}

void main().catch((error: unknown) => {
  process.stderr.write(`${renderErrorChain(error)}\n`);
  process.exitCode = 1;
});
