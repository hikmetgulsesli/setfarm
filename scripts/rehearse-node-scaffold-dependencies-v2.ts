import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
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
import { createArtifactIndexForTests as createArtifactIndex } from
  "../src/product-compiler/artifact-index.js";
import {
  createHybridArtifactStoreCapacityLeaseProviderV1,
} from "../src/product-compiler/artifact-store-authority.js";
import { ContentAddressedArtifactStore } from "../src/product-compiler/artifact-store.js";
import {
  createDeepByteBundleCasAuthorityV2,
} from "../src/product-compiler/deep-byte-bundle-verifier-v2.js";
import {
  createHostNodeToolchainAuthorityV2ForTest,
  inspectHostNodeToolchainReceiptV2,
} from "../src/product-compiler/host-node-toolchain-authority-v2.js";
import { IndexedArtifactPublisher } from
  "../src/product-compiler/indexed-artifact-publisher.js";
import {
  createNodeScaffoldExecutionEnvironmentV2ForTest,
  destroyNodeScaffoldExecutionEnvironmentV2,
  inspectNodeScaffoldExecutionEnvironmentReceiptV2,
  type NodeScaffoldExecutionEnvironmentV2,
} from "../src/product-compiler/node-scaffold-execution-environment-v2.js";
import {
  destroyNodeScaffoldPrivateStageV2,
  inspectScaffoldBaseMaterializationReceiptV2,
  materializeNodeScaffoldDependenciesV2ForOfficialRehearsal,
  materializeNodeScaffoldPrivateStageV2ForTest,
  revalidateNodeScaffoldDependenciesV2,
  type MaterializedNodeScaffoldPrivateStageV2,
} from "../src/product-compiler/node-scaffold-private-materializer-v2.js";
import {
  getCodeOwnedNodeScaffoldAssetPublicationV2,
  getCodeOwnedNodeScaffoldToolchainEntryV2,
  verifyCodeOwnedNodeScaffoldAssetByteBundleV2,
  type NodeScaffoldProfileIdV2,
} from "../src/product-compiler/node-scaffold-toolchain-catalog-v2.js";
import {
  getCodeOwnedNodeToolchainProvisionerRehearsalSourceV2,
  withNodeToolchainProvisionerRehearsalPrivateTreeV2,
} from "../src/product-compiler/node-toolchain-provisioner-rehearsal-source-v2.js";
import {
  disposeVerifiedNodeToolchainDistributionArchiveV2,
  inspectNodeToolchainDistributionVerificationReceiptV2,
  verifyNodeToolchainDistributionArchiveV2,
} from "../src/product-compiler/node-toolchain-distribution-authority-v2.js";
import {
  inspectNodeToolchainProvisioningReceiptV2,
  provisionNodeToolchainV2ForTest,
} from "../src/product-compiler/node-toolchain-provisioning-v2.js";
import { getCodeOwnedNodeToolchainTargetV2 } from
  "../src/product-compiler/node-toolchain-target-registry-v2.js";
import {
  NODE_SCAFFOLD_DEPENDENCY_REHEARSAL_AUTHORITY_REF_V2,
  NODE_SCAFFOLD_DEPENDENCY_REHEARSAL_RECEIPT_V2_SCHEMA,
  NODE_SCAFFOLD_DEPENDENCY_REHEARSAL_VERSION_V2,
  NodeScaffoldDependencyRehearsalReceiptV2Schema,
  hashNodeScaffoldDependencyRehearsalReceiptV2,
  type NodeScaffoldDependencyRehearsalReceiptHashPayloadV2,
} from "../src/product-compiler/schemas/node-scaffold-dependency-rehearsal-v2.js";
import { createIsolatedTestDatabase } from "../tests/execution-attempts/test-database.js";

const PROFILES = Object.freeze([
  "PROFILE_NODE_CLI_STATELESS_EXACT_V2",
  "PROFILE_NODE_EXPRESS_API_STATELESS_EXACT_V2",
] as const satisfies readonly NodeScaffoldProfileIdV2[]);
const LIMITS = Object.freeze({
  maxPayloadBytes: 4 * 1024 * 1024,
  rootQuotaBytes: 256 * 1024 * 1024,
  minFreeBytes: 0,
});

function fail(message: string): never {
  throw new Error(message.slice(0, 2_000));
}

function renderErrorChain(error: unknown): string {
  const lines: string[] = [];
  const seen = new Set<unknown>();
  let current: unknown = error;
  while (current instanceof Error && !seen.has(current) && lines.length < 10) {
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
  const source = readFileSync("/System/Library/CoreServices/SystemVersion.plist", "utf8");
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
  if (stat.isSymbolicLink()) return;
  if (!stat.isDirectory()) return;
  await chmod(root, 0o700);
  for (const name of await readdir(root)) await makeWritable(path.join(root, name));
}

async function removeRoot(root: string): Promise<void> {
  await makeWritable(root);
  await rm(root, { recursive: true, force: false });
  if (existsSync(root)) return fail("Dependency rehearsal root remained after exact cleanup");
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
      "Usage: rehearse-node-scaffold-dependencies-v2.ts --archive /absolute/node.tar.xz",
    );
  }
  if (
    process.platform !== "darwin"
    || (process.arch !== "arm64" && process.arch !== "x64")
    || typeof process.getuid !== "function"
    || process.getuid() === 0
  ) {
    return fail("Dependency rehearsal requires one unprivileged Darwin arm64 or x64 process");
  }
  const architecture = process.arch;
  const archivePath = argv[1]!;
  const officialArchive = await verifyNodeToolchainDistributionArchiveV2({
    architecture,
    archivePath,
  });
  const officialReceipt = inspectNodeToolchainDistributionVerificationReceiptV2(officialArchive);
  await disposeVerifiedNodeToolchainDistributionArchiveV2(officialArchive);
  const source = getCodeOwnedNodeToolchainProvisionerRehearsalSourceV2(architecture);
  assert.equal(officialReceipt.admissionScope, "production_distribution");
  assert.equal(officialReceipt.manifest.manifestHash, source.officialManifestHash);
  assert.equal(officialReceipt.artifact.artifactHash, source.officialArtifactHash);

  const database = await createIsolatedTestDatabase();
  const rehearsalRoot = await realpath(await mkdtemp(
    path.join(tmpdir(), "setfarm-node-scaffold-dependency-rehearsal-v2-"),
  ));
  await chmod(rehearsalRoot, 0o700);
  const parents = {
    artifact: path.join(rehearsalRoot, "artifacts"),
    environment: path.join(rehearsalRoot, "environment"),
    provisioner: path.join(rehearsalRoot, "toolchains"),
    scratch: path.join(rehearsalRoot, "scratch"),
    stage: path.join(rehearsalRoot, "stage"),
  };
  for (const directory of Object.values(parents)) {
    await mkdir(directory, { mode: 0o700 });
    await chmod(directory, 0o700);
  }

  let evidence: Readonly<{
    provisioning: NodeScaffoldDependencyRehearsalReceiptHashPayloadV2["provisioning"];
    profiles: NodeScaffoldDependencyRehearsalReceiptHashPayloadV2["profiles"];
  }> | undefined;
  try {
    const index = createArtifactIndex(database.sql);
    await index.bootstrap({
      artifacts: [],
      quotaBytes: LIMITS.rootQuotaBytes,
      maxPayloadBytes: LIMITS.maxPayloadBytes,
    });
    const artifactRoot = path.join(parents.artifact, "sha256");
    await mkdir(path.dirname(artifactRoot), { recursive: true });
    const writer = new ContentAddressedArtifactStore(artifactRoot, {
      limits: LIMITS,
      capacityLeaseProvider: createHybridArtifactStoreCapacityLeaseProviderV1({
        sql: database.sql,
        artifactRoot,
        purpose: "writer",
      }),
    });
    for (const batch of getCodeOwnedNodeScaffoldAssetPublicationV2().batches) {
      const publisher = new IndexedArtifactPublisher({
        index,
        store: writer,
        ownerInstanceId: `dependency-rehearsal-${randomUUID()}`,
        publicationAuthority: "hybrid-required",
      });
      await publisher.putBatch({ batchReservationId: randomUUID(), plan: batch.plan });
    }
    const casAuthority = createDeepByteBundleCasAuthorityV2({
      sql: database.sql,
      artifactRoot,
      artifactLimits: LIMITS,
    });

    evidence = await withNodeToolchainProvisionerRehearsalPrivateTreeV2({
      archivePath,
      architecture,
      scratchParent: parents.scratch,
    }, async (tree) => {
      const provisioned = await provisionNodeToolchainV2ForTest(tree, {
        parent: parents.provisioner,
      });
      const provisioningReceipt = inspectNodeToolchainProvisioningReceiptV2(provisioned);
      const target = getCodeOwnedNodeToolchainTargetV2(architecture);
      const profiles: Array<NodeScaffoldDependencyRehearsalReceiptHashPayloadV2["profiles"][number]>
        = [];
      for (const profileId of PROFILES) {
        const host = await createHostNodeToolchainAuthorityV2ForTest({
          profileId,
          fixture: {
            candidateRoot: path.join(parents.provisioner, target.rootBasename),
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
        let stage: MaterializedNodeScaffoldPrivateStageV2 | undefined;
        try {
          environment = await createNodeScaffoldExecutionEnvironmentV2ForTest({
            profileId,
            hostToolchain: host,
            scratchParent: parents.environment,
          });
          const environmentReceipt = inspectNodeScaffoldExecutionEnvironmentReceiptV2(environment);
          const packageManifest = await verifyCodeOwnedNodeScaffoldAssetByteBundleV2({
            authority: casAuthority,
            profileId,
            role: "package_manifest",
          });
          const dependencyLockManifest = await verifyCodeOwnedNodeScaffoldAssetByteBundleV2({
            authority: casAuthority,
            profileId,
            role: "dependency_lock_manifest",
          });
          const typescriptCompilerConfig = await verifyCodeOwnedNodeScaffoldAssetByteBundleV2({
            authority: casAuthority,
            profileId,
            role: "typescript_compiler_config",
          });
          stage = await materializeNodeScaffoldPrivateStageV2ForTest({
            environment,
            scratchParent: parents.stage,
            packageManifest,
            dependencyLockManifest,
            typescriptCompilerConfig,
          });
          const baseReceipt = inspectScaffoldBaseMaterializationReceiptV2(stage);
          const dependencyReceipt = await materializeNodeScaffoldDependenciesV2ForOfficialRehearsal(
            stage,
          );
          const replay = await revalidateNodeScaffoldDependenciesV2(stage);
          const entry = getCodeOwnedNodeScaffoldToolchainEntryV2(profileId)!;
          assert.equal(dependencyReceipt.dependencyCapsuleAuthority.metadataProbe,
            "code_owned_darwin_acl_nonprovenance_xattr_probe_v2");
          profiles.push({
            profileId,
            entryRef: entry.entryRef,
            entryHash: entry.entryHash,
            graphHash: entry.dependencyGraph.graphHash,
            nodeCount: entry.dependencyGraph.nodeCount,
            edgeCount: entry.dependencyGraph.edgeCount,
            hostToolchainReceiptHash: hostReceipt.receiptHash,
            environmentReceiptHash: environmentReceipt.receiptHash,
            effectiveConfigHash: environmentReceipt.effectiveNpmConfig.effectiveConfigHash,
            scaffoldBaseReceiptHash: baseReceipt.receiptHash,
            scaffoldSemanticInputHash: baseReceipt.semanticInputHash,
            dependencyReceiptHash: dependencyReceipt.receiptHash,
            dependencyIdentityHash: dependencyReceipt.dependencyIdentityHash,
            install: {
              projectScopeHash: dependencyReceipt.installExecution.projectScopeHash,
              stdoutHash: dependencyReceipt.installExecution.stdoutHash,
              stdoutBytes: dependencyReceipt.installExecution.stdoutBytes,
              stderrHash: dependencyReceipt.installExecution.stderrHash,
              stderrBytes: dependencyReceipt.installExecution.stderrBytes,
            },
            rawInstall: {
              fileCount: dependencyReceipt.rawInstallTree.fileCount,
              directoryCount: dependencyReceipt.rawInstallTree.directoryCount,
              symbolicLinkCount: dependencyReceipt.rawInstallTree.symbolicLinkCount,
              totalBytes: dependencyReceipt.rawInstallTree.totalBytes,
              membershipHash: dependencyReceipt.rawInstallTree.membershipHash,
            },
            installedBinCount: dependencyReceipt.installedBins.count,
            capsule: {
              treeHash: dependencyReceipt.dependencyCapsule.treeHash,
              payloadHash: dependencyReceipt.dependencyCapsule.payloadHash,
              fileCount: dependencyReceipt.dependencyCapsule.fileCount,
              directoryCount: dependencyReceipt.dependencyCapsule.directoryCount,
              totalBytes: dependencyReceipt.dependencyCapsule.totalBytes,
              metadataProbe: "code_owned_darwin_acl_nonprovenance_xattr_probe_v2",
              metadataNormalization:
                "code_owned_darwin_writable_copy_acl_xattr_clear_provenance_exclusion_readonly_seal_fsync_v2",
              hostMetadataExclusion:
                "com.apple.provenance_only_not_in_canonical_tree_v2",
            },
            revalidationReceiptHash: replay.receiptHash,
            cleanup: {
              stageRoot: "absent_after_authenticated_destroy",
              environmentRoot: "absent_after_authenticated_destroy",
            },
          });
          destroyNodeScaffoldPrivateStageV2(stage);
          stage = undefined;
          destroyNodeScaffoldExecutionEnvironmentV2(environment);
          environment = undefined;
          assert.deepEqual(await readdir(parents.stage), []);
          assert.deepEqual(await readdir(parents.environment), []);
        } finally {
          if (stage) destroyNodeScaffoldPrivateStageV2(stage);
          if (environment) destroyNodeScaffoldExecutionEnvironmentV2(environment);
        }
      }
      return {
        provisioning: {
          receiptHash: provisioningReceipt.receiptHash,
          treeHash: provisioningReceipt.finalRoot.treeHash,
          targetRef: provisioningReceipt.finalRoot.targetRef,
        },
        profiles: profiles as NodeScaffoldDependencyRehearsalReceiptHashPayloadV2["profiles"],
      };
    });
  } finally {
    await removeRoot(rehearsalRoot);
    await database.cleanup();
  }
  if (!evidence) return fail("Dependency rehearsal completed without canonical evidence");
  const identity: NodeScaffoldDependencyRehearsalReceiptHashPayloadV2 = {
    schema: NODE_SCAFFOLD_DEPENDENCY_REHEARSAL_RECEIPT_V2_SCHEMA,
    receiptVersion: NODE_SCAFFOLD_DEPENDENCY_REHEARSAL_VERSION_V2,
    authorityRef: NODE_SCAFFOLD_DEPENDENCY_REHEARSAL_AUTHORITY_REF_V2,
    status: "rehearsal_passed",
    admissionScope: "test_fixture",
    architecture,
    officialSource: {
      manifestHash: source.officialManifestHash,
      artifactHash: source.officialArtifactHash,
      verificationReceiptHash: officialReceipt.receiptHash,
      archiveSha256: officialReceipt.archive.sha256,
      archiveByteLength: officialReceipt.archive.byteLength,
    },
    provisioning: evidence.provisioning,
    profiles: evidence.profiles,
    finalState: {
      rehearsalRoot: "removed_exactly",
      productionToolchainRoot: "untouched",
      profileCount: 2,
    },
  };
  const receipt = NodeScaffoldDependencyRehearsalReceiptV2Schema.parse({
    ...identity,
    receiptHash: hashNodeScaffoldDependencyRehearsalReceiptV2(identity),
  });
  process.stdout.write(canonicalJsonBytes(receipt));
}

void main().catch((error: unknown) => {
  process.stderr.write(`${renderErrorChain(error)}\n`);
  process.exitCode = 1;
});
