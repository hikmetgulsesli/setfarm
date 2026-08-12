import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  PLATFORM_RELEASE_BOOTSTRAP_CONTRACT_V2,
} from "../../src/execution/schemas/platform-release-bootstrap-contract-v2.js";
import {
  PLATFORM_RELEASE_BOOTSTRAP_PACKAGE_REFS_V2,
} from "../../src/execution/schemas/platform-release-bootstrap-operation-abis-v2.js";
import { canonicalJsonBytes, hashCanonicalJson } from "../../src/product-compiler/canonical-json.js";
import {
  NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_LIFECYCLE_IDENTITY_HASH_V2,
  NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_LIFECYCLE_SEMANTIC_VERIFIER_CONTRACT_HASH_V2,
  NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_LIFECYCLE_SEMANTIC_SNAPSHOT_V2_SCHEMA,
  NodeToolchainProvisionerBootstrapLifecycleSemanticSnapshotV2Schema,
  buildNodeToolchainProvisionerBootstrapLifecycleSemanticSnapshotV2,
  hashNodeToolchainProvisionerBootstrapLifecycleSemanticSnapshotV2,
  hashNodeToolchainProvisionerBootstrapRecursiveEvidenceV2,
  hashNodeToolchainProvisionerBootstrapRollbackBasenameBindingV2,
  parseNodeToolchainProvisionerBootstrapLifecycleSemanticSnapshotCandidateV2,
  type NodeToolchainProvisionerBootstrapLifecycleSemanticSnapshotHashPayloadV2,
  type NodeToolchainProvisionerBootstrapLifecycleSemanticSnapshotV2,
} from "../../src/product-compiler/node-toolchain-provisioner-bootstrap-lifecycle-semantic-snapshot-v2.js";
import {
  buildBootstrapFilesystemScopeIdentityV2,
  buildDirectoryMembershipIdentityV2,
  buildFsObservationFingerprintV2,
  buildNamespacePhysicalCensusV2,
  buildNamespacePhysicalEntryCaptureV2,
  buildPackageLifecyclePhysicalProjectionV2,
  buildStableFsObjectIdentityV2,
  type BootstrapFilesystemScopeIdentityV2,
  type DirectoryMembershipIdentityV2,
  type FsObservationFingerprintV2,
  type NamespacePhysicalEntryCaptureV2,
  type StableFsObjectIdentityV2,
} from "../../src/product-compiler/platform-release-bootstrap-physical-census-v2.js";
import {
  expectedPlatformReleaseBootstrapPackageLockRawContentHashV2,
  projectPlatformReleaseBootstrapRegistryClaimedPackageLifecycleV2,
} from "../../src/product-compiler/platform-release-bootstrap-registry-activation-v2.js";
import {
  classifyPlatformReleaseBootstrapNamespaceCensusV2,
  type PlatformReleaseBootstrapNamespaceClassificationV2,
} from "../../src/product-compiler/platform-release-bootstrap-registry-v2.js";
import {
  NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_RECEIPT_V2_SCHEMA,
  NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_LOCK_CONTENT_V2,
  NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_VERSION_V2,
  NodeToolchainProvisionerBootstrapInstallationReceiptV2Schema,
  buildNodeToolchainProvisionerBootstrapInstallationClaimV2,
  buildNodeToolchainProvisionerBootstrapInstallationIntentV2,
  buildNodeToolchainProvisionerBootstrapRollbackHistoryV2,
  hashNodeToolchainProvisionerBootstrapInstallationReceiptV2,
  hashNodeToolchainProvisionerBootstrapInstalledTreeV2,
  type NodeToolchainProvisionerBootstrapInstallationClaimV2,
  type NodeToolchainProvisionerBootstrapInstallationReceiptV2,
  type NodeToolchainProvisionerBootstrapRollbackHistoryV2,
} from "../../src/product-compiler/schemas/node-toolchain-provisioner-bootstrap-installation-state-v2.js";
import {
  NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_PREPARED_PACKAGE_AUTHORITY_REF_V2,
  NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_PREPARED_PACKAGE_RECEIPT_V2_SCHEMA,
  NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_PREPARED_PACKAGE_VERSION_V2,
  NodeToolchainProvisionerBootstrapPreparedPackageReceiptV2Schema,
  hashNodeToolchainProvisionerBootstrapPreparedPackageReceiptV2,
  hashNodeToolchainProvisionerBootstrapPreparedTreeV2,
  type NodeToolchainProvisionerBootstrapPreparedPackageReceiptV2,
} from "../../src/product-compiler/schemas/node-toolchain-provisioner-bootstrap-prepared-package-v2.js";
import {
  buildNodeToolchainProvisionerBootstrapRollbackClaimV2,
  buildNodeToolchainProvisionerBootstrapRollbackPlanV2,
  buildNodeToolchainProvisionerBootstrapRollbackReceiptV2,
  buildNodeToolchainProvisionerBootstrapRollbackTreeEntriesV2,
  type NodeToolchainProvisionerBootstrapRollbackReceiptV2,
} from "../../src/product-compiler/schemas/node-toolchain-provisioner-bootstrap-rollback-v2.js";

const NODE_PACKAGE_REF_V2 =
  PLATFORM_RELEASE_BOOTSTRAP_PACKAGE_REFS_V2.nodeToolchainProvisioner;
const NODE_CONTRACT_V2 = PLATFORM_RELEASE_BOOTSTRAP_CONTRACT_V2.packages.find(
  (entry) => entry.packageRef === NODE_PACKAGE_REF_V2,
)!;
const OWNER_V2 = Object.freeze({ uid: 501, gid: 20 });

const hex = (character: string, length = 64): string => character.repeat(length);

function clone<T>(value: T): T {
  return structuredClone(value);
}

function preparedReceiptV2(seed: "a" | "b"): NodeToolchainProvisionerBootstrapPreparedPackageReceiptV2 {
  const hashes = seed === "a"
    ? ["1", "2", "3", "4"] as const
    : ["5", "6", "7", "8"] as const;
  const members = {
    manifest: {
      artifactRef: "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_MANIFEST_V2" as const,
      locator: "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_MANIFEST.v2.json" as const,
      mediaType: "application/json" as const,
      storageMode: "0400" as const,
      targetMode: "0444" as const,
      sha256: hex(hashes[0]),
      byteLength: 101,
      linkCount: 1 as const,
    },
    launcher: {
      artifactRef: "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_LAUNCHER_V2" as const,
      locator: "bin/setfarm-node-toolchain-provisioner-v2" as const,
      mediaType: "text/x-shellscript" as const,
      storageMode: "0500" as const,
      targetMode: "0555" as const,
      sha256: hex(hashes[1]),
      byteLength: 102,
      linkCount: 1 as const,
    },
    bundle: {
      artifactRef: "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_BUNDLE_V2" as const,
      locator: "lib/node-toolchain-provisioner-v2.cjs" as const,
      mediaType: "application/javascript" as const,
      storageMode: "0400" as const,
      targetMode: "0444" as const,
      sha256: hex(hashes[2]),
      byteLength: 103,
      linkCount: 1 as const,
    },
    bootstrapRuntime: {
      artifactRef: "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_RUNTIME_V2" as const,
      locator: "runtime/node" as const,
      mediaType: "application/x-mach-binary" as const,
      storageMode: "0500" as const,
      targetMode: "0555" as const,
      sha256: hex(hashes[3]),
      byteLength: 104,
      linkCount: 1 as const,
    },
  };
  const storageWithoutHash = {
    ownerUid: OWNER_V2.uid,
    ownerGid: OWNER_V2.gid,
    rootMode: "0700" as const,
    directoryMode: "0700" as const,
    immutableFileMode: "0400" as const,
    executableFileMode: "0500" as const,
    linkPolicy: "regular_files_only_no_links_v2" as const,
    allowedDirectories: [".", "bin", "lib", "runtime"] as const,
    allowedRootEntries: [
      "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_MANIFEST.v2.json",
      "bin",
      "lib",
      "runtime",
    ] as const,
    fileCount: 4 as const,
    directoryCount: 4 as const,
    totalBytes: 410,
  };
  const storage = {
    ...storageWithoutHash,
    treeHash: hashNodeToolchainProvisionerBootstrapPreparedTreeV2({
      storage: { ...storageWithoutHash, treeHash: hex("0") },
      members,
    }),
  };
  const identity = {
    schema: NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_PREPARED_PACKAGE_RECEIPT_V2_SCHEMA,
    receiptVersion: NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_PREPARED_PACKAGE_VERSION_V2,
    authorityRef: NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_PREPARED_PACKAGE_AUTHORITY_REF_V2,
    admissionScope: "test_fixture" as const,
    status: "prepared_payload_verified" as const,
    installationStatus: "not_installed_unprivileged_payload" as const,
    source: {
      codeSha: hex(seed, 40),
      sourceTreeHash: hex(seed === "a" ? "b" : "c", 40),
      packageVersion: "2.0.0",
      architecture: "arm64" as const,
      manifestHash: hex(seed === "a" ? "9" : "a"),
      manifestSha256: members.manifest.sha256,
      manifestByteLength: members.manifest.byteLength,
      buildContractHash: hex("b"),
      bundleAuthorityReceiptHash: hex("c"),
      launcherHash: members.launcher.sha256,
      launcherByteLength: members.launcher.byteLength,
      bundleOutputHash: members.bundle.sha256,
      bundleOutputByteLength: members.bundle.byteLength,
      privateTreeReceiptHash: hex("d"),
      privateTreeNodeHash: members.bootstrapRuntime.sha256,
      privateTreeNodeByteLength: members.bootstrapRuntime.byteLength,
    },
    target: {
      rootLocator: `/tmp/setfarm-semantic-${seed}/node-toolchain-provisioner-v2`,
      expectedOwnerUid: OWNER_V2.uid,
      expectedOwnerGid: OWNER_V2.gid,
      directoryMode: "0555" as const,
      manifestMode: "0444" as const,
      publicationPolicy: "root_owned_every_only_no_replace_fsync_manifest_last_v2" as const,
    },
    storage,
    members,
    publication: {
      policy: "exclusive_create_fsync_files_directories_manifest_last_v2" as const,
      manifestPublishedLast: true as const,
      reopenedAfterPublication: true as const,
      targetRootAccess: "none" as const,
    },
  };
  return NodeToolchainProvisionerBootstrapPreparedPackageReceiptV2Schema.parse({
    ...identity,
    receiptHash: hashNodeToolchainProvisionerBootstrapPreparedPackageReceiptV2(identity),
  });
}

const exactToolV2 = (toolRef: "MACOS_LOCKF_V2" | "MACOS_CAT_LOCK_HELPER_V2") => ({
  toolRef,
  contentHash: hex(toolRef === "MACOS_LOCKF_V2" ? "e" : "f"),
  byteLength: 64,
  mode: "0755" as const,
  ownerUid: 0 as const,
  ownerGid: 0,
  linkCount: 1 as const,
});

function installationReceiptV2(
  claim: NodeToolchainProvisionerBootstrapInstallationClaimV2,
  history: NodeToolchainProvisionerBootstrapRollbackHistoryV2,
  inode: number,
): NodeToolchainProvisionerBootstrapInstallationReceiptV2 {
  const intent = claim.intent;
  const identity = {
    schema: NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_RECEIPT_V2_SCHEMA,
    receiptVersion: NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_VERSION_V2,
    authorityRef: intent.authorityRef,
    status: "installed_verified" as const,
    admissionScope: "test_fixture" as const,
    claim,
    predecessorRollbackHistory: history,
    publisher: {
      contractRef: "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLER_V2" as const,
      lockExecutionPolicy: "exact_lockf_fd_then_exact_cat_pipe_v2" as const,
      lockf: exactToolV2("MACOS_LOCKF_V2"),
      lockHelper: exactToolV2("MACOS_CAT_LOCK_HELPER_V2"),
    },
    finalRoot: {
      rootLocatorHash: intent.target.rootLocatorHash,
      manifestHash: intent.source.source.manifestHash,
      architecture: intent.architecture,
      device: 7,
      inode,
      ownerUid: OWNER_V2.uid,
      ownerGid: OWNER_V2.gid,
      mode: "0555" as const,
      fileCount: 4 as const,
      directoryCount: 4 as const,
      totalBytes: intent.source.storage.totalBytes,
      treeHash: hashNodeToolchainProvisionerBootstrapInstalledTreeV2(intent.source),
    },
    claimFile: {
      locatorHash: intent.target.claimLocatorHash,
      mode: "0444" as const,
      ownerUid: OWNER_V2.uid,
      ownerGid: OWNER_V2.gid,
      linkCount: 1 as const,
    },
    receiptFile: {
      locatorHash: intent.target.receiptLocatorHash,
      mode: "0444" as const,
      ownerUid: OWNER_V2.uid,
      ownerGid: OWNER_V2.gid,
      linkCount: 1 as const,
      publicationPolicy: "canonical_stage_hard_link_no_replace_fsync_v2" as const,
    },
  };
  return NodeToolchainProvisionerBootstrapInstallationReceiptV2Schema.parse({
    ...identity,
    receiptHash: hashNodeToolchainProvisionerBootstrapInstallationReceiptV2(identity),
  });
}

function rollbackReceiptV2(
  installed: NodeToolchainProvisionerBootstrapInstallationReceiptV2,
): NodeToolchainProvisionerBootstrapRollbackReceiptV2 {
  const plan = buildNodeToolchainProvisionerBootstrapRollbackPlanV2(installed);
  const claim = buildNodeToolchainProvisionerBootstrapRollbackClaimV2(plan);
  return buildNodeToolchainProvisionerBootstrapRollbackReceiptV2({
    claim,
    publisher: {
      executionPolicy: "exact_lockf_fd_then_exact_cat_pipe_v2",
      lockf: exactToolV2("MACOS_LOCKF_V2"),
      lockHelper: exactToolV2("MACOS_CAT_LOCK_HELPER_V2"),
    },
  });
}

function fingerprintV2(
  objectIdentity: StableFsObjectIdentityV2,
  mode: "0444" | "0555" | "0600",
  byteLength: number,
  owner = OWNER_V2,
): FsObservationFingerprintV2 {
  return buildFsObservationFingerprintV2({
    objectIdentity,
    ownerUid: owner.uid,
    ownerGid: owner.gid,
    mode,
    linkCount: 1,
    byteLength,
    modifiedTimeNanoseconds: "1000",
    changedTimeNanoseconds: "1001",
  });
}

function identityV2(
  scope: BootstrapFilesystemScopeIdentityV2,
  objectKind: "ordinary_file" | "directory",
  inode: number,
): StableFsObjectIdentityV2 {
  return buildStableFsObjectIdentityV2({
    filesystemScope: scope,
    objectKind,
    device: "7",
    inode: String(inode),
  });
}

function rootMembershipV2(): DirectoryMembershipIdentityV2 {
  return buildDirectoryMembershipIdentityV2({
    orderedEntries: [
      { basename: "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_MANIFEST.v2.json", objectKind: "ordinary_file" },
      { basename: "bin", objectKind: "directory" },
      { basename: "lib", objectKind: "directory" },
      { basename: "runtime", objectKind: "directory" },
    ],
  });
}

function artifactCaptureV2(
  classification: PlatformReleaseBootstrapNamespaceClassificationV2,
  scope: BootstrapFilesystemScopeIdentityV2,
  parent: StableFsObjectIdentityV2,
  value: unknown,
  inode: number,
): NamespacePhysicalEntryCaptureV2 {
  const objectIdentity = identityV2(scope, "ordinary_file", inode);
  const rawContentHash = hashCanonicalJson(value);
  return buildNamespacePhysicalEntryCaptureV2({
    classification,
    parentObjectIdentityHash: parent.objectIdentityHash,
    objectIdentity,
    fingerprint: fingerprintV2(objectIdentity, "0444", canonicalJsonBytes(value).byteLength),
    contentEvidence: { kind: "bounded_regular_file_bytes", rawContentHash },
  });
}

type FixtureV2 = Readonly<{
  snapshot: NodeToolchainProvisionerBootstrapLifecycleSemanticSnapshotV2;
  input: NodeToolchainProvisionerBootstrapLifecycleSemanticSnapshotHashPayloadV2;
}>;

function fixtureV2(
  status: "ready" | "empty_or_rolled_back",
  seed: "a" | "b" = "a",
  brokenRollbackPredecessor = false,
  rollbackCount: 1 | 2 = 1,
): FixtureV2 {
  const prepared = preparedReceiptV2(seed);
  const claim = buildNodeToolchainProvisionerBootstrapInstallationClaimV2(
    buildNodeToolchainProvisionerBootstrapInstallationIntentV2(prepared),
  );
  const emptyHistory = buildNodeToolchainProvisionerBootstrapRollbackHistoryV2([]);
  const fakePriorHistory = buildNodeToolchainProvisionerBootstrapRollbackHistoryV2([{
    installationReceiptHash: hex("1"),
    rollbackReceiptHash: hex("2"),
    rollbackReceiptLocatorHash: hex("3"),
  }]);
  const firstPriorReceipt = installationReceiptV2(
    claim,
    brokenRollbackPredecessor ? fakePriorHistory : emptyHistory,
    seed === "a" ? 700 : 800,
  );
  const firstRollback = rollbackReceiptV2(firstPriorReceipt);
  const firstHistory = buildNodeToolchainProvisionerBootstrapRollbackHistoryV2([{
    installationReceiptHash: firstRollback.removedGeneration.installationReceiptHash,
    rollbackReceiptHash: firstRollback.receiptHash,
    rollbackReceiptLocatorHash: firstRollback.receiptFile.locatorHash,
  }]);
  let secondPriorInode = seed === "a" ? 710 : 810;
  let secondRollback = rollbackReceiptV2(
    installationReceiptV2(claim, firstHistory, secondPriorInode),
  );
  let inversionAttempts = 0;
  while (
    rollbackCount === 2
    && secondRollback.removedGeneration.installationReceiptHash
      > firstRollback.removedGeneration.installationReceiptHash
    && inversionAttempts < 4_096
  ) {
    inversionAttempts += 1;
    secondPriorInode += 1;
    secondRollback = rollbackReceiptV2(
      installationReceiptV2(claim, firstHistory, secondPriorInode),
    );
  }
  if (
    rollbackCount === 2
    && secondRollback.removedGeneration.installationReceiptHash
      > firstRollback.removedGeneration.installationReceiptHash
  ) {
    throw new TypeError("Could not build a reverse lexical rollback chronology fixture");
  }
  const rollbacks = rollbackCount === 2
    ? [firstRollback, secondRollback]
    : [firstRollback];
  const rollbackHistory = buildNodeToolchainProvisionerBootstrapRollbackHistoryV2(
    rollbacks.map((rollback) => ({
      installationReceiptHash: rollback.removedGeneration.installationReceiptHash,
      rollbackReceiptHash: rollback.receiptHash,
      rollbackReceiptLocatorHash: rollback.receiptFile.locatorHash,
    })),
  );
  const activeReceipt = installationReceiptV2(claim, rollbackHistory, seed === "a" ? 701 : 801);
  const rollbackByBasename = new Map(rollbacks.map((rollback) => [
    `.setfarm-node-toolchain-provisioner-installation-v2.rollback.${rollback.removedGeneration.installationReceiptHash}.receipt.json`,
    rollback,
  ]));
  const rollbackBasenames = [...rollbackByBasename.keys()];
  const names = status === "ready"
    ? [
        NODE_CONTRACT_V2.lifecycle.packageLockBasename,
        NODE_CONTRACT_V2.rootBasename,
        NODE_CONTRACT_V2.lifecycle.activeClaimBasename,
        NODE_CONTRACT_V2.lifecycle.activeReceiptBasename,
        ...rollbackBasenames,
      ]
    : [NODE_CONTRACT_V2.lifecycle.packageLockBasename, ...rollbackBasenames];
  const logicalCensus = classifyPlatformReleaseBootstrapNamespaceCensusV2(names);
  const scope = buildBootstrapFilesystemScopeIdentityV2({
    scopeNonce: hex(seed === "a" ? "a" : "b"),
  });
  const parent = identityV2(scope, "directory", seed === "a" ? 100 : 110);
  const parentFingerprint = fingerprintV2(parent, "0555", 128);
  const rootMembership = rootMembershipV2();
  let nextInode = seed === "a" ? 200 : 300;
  const captures = logicalCensus.orderedEntries.map((classification) => {
    nextInode += 1;
    if (classification.category === "package_lock") {
      const objectIdentity = identityV2(scope, "ordinary_file", nextInode);
      return buildNamespacePhysicalEntryCaptureV2({
        classification,
        parentObjectIdentityHash: parent.objectIdentityHash,
        objectIdentity,
        fingerprint: fingerprintV2(
          objectIdentity,
          "0600",
          Buffer.byteLength(
            NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_LOCK_CONTENT_V2,
            "utf8",
          ),
        ),
        contentEvidence: {
          kind: "bounded_regular_file_bytes",
          rawContentHash: expectedPlatformReleaseBootstrapPackageLockRawContentHashV2(
            NODE_PACKAGE_REF_V2,
          ),
        },
      });
    }
    if (classification.category === "package_root") {
      const objectIdentity = buildStableFsObjectIdentityV2({
        filesystemScope: scope,
        objectKind: "directory",
        device: "7",
        inode: String(activeReceipt.finalRoot.inode),
      });
      return buildNamespacePhysicalEntryCaptureV2({
        classification,
        parentObjectIdentityHash: parent.objectIdentityHash,
        objectIdentity,
        fingerprint: fingerprintV2(objectIdentity, "0555", 128),
        contentEvidence: { kind: "directory_membership", membership: rootMembership },
      });
    }
    if (classification.category === "active_claim") {
      return artifactCaptureV2(classification, scope, parent, claim, nextInode);
    }
    if (classification.category === "active_receipt") {
      return artifactCaptureV2(classification, scope, parent, activeReceipt, nextInode);
    }
    if (classification.category === "rollback_receipt") {
      return artifactCaptureV2(
        classification,
        scope,
        parent,
        rollbackByBasename.get(classification.basename),
        nextInode,
      );
    }
    throw new TypeError(`Unexpected fixture category ${classification.category}`);
  });
  const physicalCensus = buildNamespacePhysicalCensusV2({
    filesystemScope: scope,
    logicalCensus,
    parentObjectIdentity: parent,
    parentFingerprint,
    orderedEntryCaptures: captures,
  });
  const nodePhysicalProjection = buildPackageLifecyclePhysicalProjectionV2(
    physicalCensus,
    NODE_PACKAGE_REF_V2,
  );
  const nodeLogicalProjection =
    projectPlatformReleaseBootstrapRegistryClaimedPackageLifecycleV2(
      logicalCensus,
      NODE_PACKAGE_REF_V2,
    );
  const lockCapture = captures.find((capture) =>
    capture.classification.category === "package_lock")!;
  const rollbackCaptures = captures.filter((capture) =>
    capture.classification.category === "rollback_receipt");
  const common = {
    schema: NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_LIFECYCLE_SEMANTIC_SNAPSHOT_V2_SCHEMA,
    version: "2.0.0" as const,
    packageRef: NODE_PACKAGE_REF_V2,
    admissionScope: "test_fixture" as const,
    productionAuthority: false as const,
    observationAuthority:
      "captured_evidence_requires_live_native_session_receipt_v2" as const,
    semanticVerifierContractHash:
      NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_LIFECYCLE_SEMANTIC_VERIFIER_CONTRACT_HASH_V2,
    nodeLifecycleIdentityHash:
      NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_LIFECYCLE_IDENTITY_HASH_V2,
    filesystemScope: scope,
    expectedOwner: OWNER_V2,
    sourceLogicalCensusHash: physicalCensus.logicalCensus.censusHash,
    sourcePhysicalCensusHash: physicalCensus.physicalCensusHash,
    nodeLogicalProjection,
    nodePhysicalProjection,
    nodePhysicalProjectionHash: nodePhysicalProjection.projectionHash,
    heldPackageLock: {
      objectIdentity: lockCapture.objectIdentity,
      fingerprint: lockCapture.fingerprint,
      rawContentHash: lockCapture.contentEvidence.kind === "bounded_regular_file_bytes"
        ? lockCapture.contentEvidence.rawContentHash
        : hex("0"),
    },
    rollbackReceipts: rollbackCaptures.map((rollbackCapture) => {
      const rollback = rollbackByBasename.get(rollbackCapture.classification.basename)!;
      return {
        classification: rollbackCapture.classification,
        entryCapture: rollbackCapture,
        rawBytesHash: hashCanonicalJson(rollback),
        value: rollback,
        rollbackBasenameBindingHash:
          hashNodeToolchainProvisionerBootstrapRollbackBasenameBindingV2({
            basename: rollbackCapture.classification.basename,
            rollbackReceiptHash: rollback.receiptHash,
            removedInstallationReceiptHash:
              rollback.removedGeneration.installationReceiptHash,
          }),
      };
    }),
    rollbackHistory,
  };

  let input: NodeToolchainProvisionerBootstrapLifecycleSemanticSnapshotHashPayloadV2;
  if (status === "empty_or_rolled_back") {
    input = {
      ...common,
      status,
      activeGeneration: null,
      liveObservationBinding: {
        sessionOccurrenceHash: hex("4"),
        observationTranscriptHash: hex("5"),
        globalPhysicalCensusHash: physicalCensus.physicalCensusHash,
        nodeRecursiveEvidenceHash:
          hashNodeToolchainProvisionerBootstrapRecursiveEvidenceV2({
            status,
            packageRoot: null,
            orderedTreeEntries: null,
          }),
        rollbackLocatorAuthority:
          "basename_binding_only_locator_hash_requires_live_native_session_receipt_v2",
      },
    };
  } else {
    const claimCapture = captures.find((capture) =>
      capture.classification.category === "active_claim")!;
    const receiptCapture = captures.find((capture) =>
      capture.classification.category === "active_receipt")!;
    const rootCapture = captures.find((capture) =>
      capture.classification.category === "package_root")!;
    const expectedTree = buildNodeToolchainProvisionerBootstrapRollbackTreeEntriesV2(activeReceipt);
    const root = rootCapture.objectIdentity;
    const bin = identityV2(scope, "directory", nextInode + 10);
    const launcher = identityV2(scope, "ordinary_file", nextInode + 11);
    const lib = identityV2(scope, "directory", nextInode + 12);
    const bundle = identityV2(scope, "ordinary_file", nextInode + 13);
    const manifest = identityV2(scope, "ordinary_file", nextInode + 14);
    const runtime = identityV2(scope, "directory", nextInode + 15);
    const runtimeFile = identityV2(scope, "ordinary_file", nextInode + 16);
    const memberships = [
      rootMembership,
      buildDirectoryMembershipIdentityV2({ orderedEntries: [{ basename: "setfarm-node-toolchain-provisioner-v2", objectKind: "ordinary_file" }] }),
      buildDirectoryMembershipIdentityV2({ orderedEntries: [{ basename: "node-toolchain-provisioner-v2.cjs", objectKind: "ordinary_file" }] }),
      buildDirectoryMembershipIdentityV2({ orderedEntries: [{ basename: "node", objectKind: "ordinary_file" }] }),
    ];
    const orderedTreeEntries = [
      {
        kind: "directory" as const,
        role: "root_directory" as const,
        parentObjectIdentityHash: parent.objectIdentityHash,
        objectIdentity: root,
        fingerprint: rootCapture.fingerprint,
        treeEntry: expectedTree[0]!,
        membership: memberships[0]!,
      },
      {
        kind: "directory" as const,
        role: "bin_directory" as const,
        parentObjectIdentityHash: root.objectIdentityHash,
        objectIdentity: bin,
        fingerprint: fingerprintV2(bin, "0555", 64),
        treeEntry: expectedTree[1]!,
        membership: memberships[1]!,
      },
      {
        kind: "file" as const,
        role: "launcher_file" as const,
        parentObjectIdentityHash: bin.objectIdentityHash,
        objectIdentity: launcher,
        fingerprint: fingerprintV2(launcher, "0555", expectedTree[2]!.byteLength),
        treeEntry: expectedTree[2]!,
        rawContentHash: expectedTree[2]!.contentHash!,
      },
      {
        kind: "directory" as const,
        role: "lib_directory" as const,
        parentObjectIdentityHash: root.objectIdentityHash,
        objectIdentity: lib,
        fingerprint: fingerprintV2(lib, "0555", 64),
        treeEntry: expectedTree[3]!,
        membership: memberships[2]!,
      },
      {
        kind: "file" as const,
        role: "bundle_file" as const,
        parentObjectIdentityHash: lib.objectIdentityHash,
        objectIdentity: bundle,
        fingerprint: fingerprintV2(bundle, "0444", expectedTree[4]!.byteLength),
        treeEntry: expectedTree[4]!,
        rawContentHash: expectedTree[4]!.contentHash!,
      },
      {
        kind: "file" as const,
        role: "manifest_file" as const,
        parentObjectIdentityHash: root.objectIdentityHash,
        objectIdentity: manifest,
        fingerprint: fingerprintV2(manifest, "0444", expectedTree[5]!.byteLength),
        treeEntry: expectedTree[5]!,
        rawContentHash: expectedTree[5]!.contentHash!,
      },
      {
        kind: "directory" as const,
        role: "runtime_directory" as const,
        parentObjectIdentityHash: root.objectIdentityHash,
        objectIdentity: runtime,
        fingerprint: fingerprintV2(runtime, "0555", 64),
        treeEntry: expectedTree[6]!,
        membership: memberships[3]!,
      },
      {
        kind: "file" as const,
        role: "bootstrap_runtime_file" as const,
        parentObjectIdentityHash: runtime.objectIdentityHash,
        objectIdentity: runtimeFile,
        fingerprint: fingerprintV2(runtimeFile, "0555", expectedTree[7]!.byteLength),
        treeEntry: expectedTree[7]!,
        rawContentHash: expectedTree[7]!.contentHash!,
      },
    ];
    const activeGeneration = {
      claim: {
        classification: claimCapture.classification,
        entryCapture: claimCapture,
        rawBytesHash: hashCanonicalJson(claim),
        value: claim,
      },
      receipt: {
        classification: receiptCapture.classification,
        entryCapture: receiptCapture,
        rawBytesHash: hashCanonicalJson(activeReceipt),
        value: activeReceipt,
      },
      packageRoot: {
        objectIdentity: rootCapture.objectIdentity,
        fingerprint: rootCapture.fingerprint,
      },
      orderedTreeEntries,
    };
    input = {
      ...common,
      status,
      activeGeneration,
      liveObservationBinding: {
        sessionOccurrenceHash: hex("4"),
        observationTranscriptHash: hex("5"),
        globalPhysicalCensusHash: physicalCensus.physicalCensusHash,
        nodeRecursiveEvidenceHash:
          hashNodeToolchainProvisionerBootstrapRecursiveEvidenceV2({
            status,
            packageRoot: activeGeneration.packageRoot,
            orderedTreeEntries: activeGeneration.orderedTreeEntries,
          }),
        rollbackLocatorAuthority:
          "basename_binding_only_locator_hash_requires_live_native_session_receipt_v2",
      },
    };
  }
  return Object.freeze({
    input,
    snapshot: buildNodeToolchainProvisionerBootstrapLifecycleSemanticSnapshotV2(input),
  });
}

function rehashV2(candidate: Record<string, unknown>): Record<string, unknown> {
  candidate.snapshotHash =
    hashNodeToolchainProvisionerBootstrapLifecycleSemanticSnapshotV2(candidate);
  return candidate;
}

function refreshRecursiveBindingV2(candidate: Record<string, unknown>): void {
  const status = candidate.status as "ready" | "empty_or_rolled_back";
  const binding = candidate.liveObservationBinding as Record<string, unknown>;
  binding.nodeRecursiveEvidenceHash =
    hashNodeToolchainProvisionerBootstrapRecursiveEvidenceV2({
      status,
      packageRoot: status === "ready"
        ? (candidate.activeGeneration as { packageRoot: unknown }).packageRoot
        : null,
      orderedTreeEntries: status === "ready"
        ? (candidate.activeGeneration as { orderedTreeEntries: unknown }).orderedTreeEntries
        : null,
    });
}

function rejectsCandidateV2(candidate: unknown): void {
  assert.throws(() =>
    parseNodeToolchainProvisionerBootstrapLifecycleSemanticSnapshotCandidateV2(candidate));
}

describe("node toolchain bootstrap lifecycle semantic snapshot v2", () => {
  it("builds strict, frozen, nonauthoritative ready and empty snapshots", () => {
    const ready = fixtureV2("ready").snapshot;
    const empty = fixtureV2("empty_or_rolled_back").snapshot;

    assert.equal(ready.status, "ready");
    assert.equal(empty.status, "empty_or_rolled_back");
    assert.equal(ready.admissionScope, "test_fixture");
    assert.equal(ready.productionAuthority, false);
    assert.equal(
      ready.semanticVerifierContractHash,
      NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_LIFECYCLE_SEMANTIC_VERIFIER_CONTRACT_HASH_V2,
    );
    assert.equal(
      ready.observationAuthority,
      "captured_evidence_requires_live_native_session_receipt_v2",
    );
    assert.ok(Object.isFrozen(ready));
    assert.ok(Object.isFrozen(ready.nodePhysicalProjection));
    assert.deepEqual(
      NodeToolchainProvisionerBootstrapLifecycleSemanticSnapshotV2Schema.parse(ready),
      ready,
    );
    assert.equal(empty.activeGeneration, null);
    assert.equal(empty.rollbackHistory.receiptCount, 1);
  });

  it("rejects transplant, wrong-claim, tree, metadata, root, history, lock, source and status attacks after rehash", () => {
    const ready = fixtureV2("ready", "a").snapshot;
    const foreign = fixtureV2("ready", "b").snapshot;

    const transplanted = clone(ready) as unknown as Record<string, unknown>;
    (transplanted.activeGeneration as Record<string, unknown>).claim =
      clone(foreign.activeGeneration!.claim);
    rejectsCandidateV2(rehashV2(transplanted));

    const wrongTree = clone(ready) as unknown as Record<string, unknown>;
    const wrongTreeEntries = (wrongTree.activeGeneration as { orderedTreeEntries: Array<Record<string, unknown>> })
      .orderedTreeEntries;
    wrongTreeEntries[2]!.rawContentHash = hex("0");
    rejectsCandidateV2(rehashV2(wrongTree));

    const wrongMetadata = clone(ready) as unknown as Record<string, unknown>;
    const metadataEntry = (wrongMetadata.activeGeneration as { orderedTreeEntries: Array<Record<string, unknown>> })
      .orderedTreeEntries[4]!;
    const oldIdentity = metadataEntry.objectIdentity as StableFsObjectIdentityV2;
    metadataEntry.fingerprint = fingerprintV2(
      oldIdentity,
      "0444",
      (metadataEntry.treeEntry as { byteLength: number }).byteLength,
      { uid: OWNER_V2.uid + 1, gid: OWNER_V2.gid },
    );
    rejectsCandidateV2(rehashV2(wrongMetadata));

    const wrongRoot = clone(ready) as unknown as Record<string, unknown>;
    const wrongRootActive = wrongRoot.activeGeneration as {
      packageRoot: Record<string, unknown>;
      orderedTreeEntries: Array<Record<string, unknown>>;
    };
    const replacementRoot = buildStableFsObjectIdentityV2({
      filesystemScope: ready.filesystemScope,
      objectKind: "directory",
      device: "7",
      inode: "9999",
    });
    const replacementFingerprint = fingerprintV2(replacementRoot, "0555", 128);
    wrongRootActive.packageRoot.objectIdentity = replacementRoot;
    wrongRootActive.packageRoot.fingerprint = replacementFingerprint;
    wrongRootActive.orderedTreeEntries[0]!.objectIdentity = replacementRoot;
    wrongRootActive.orderedTreeEntries[0]!.fingerprint = replacementFingerprint;
    rejectsCandidateV2(rehashV2(wrongRoot));

    const wrongHistory = clone(ready) as unknown as Record<string, unknown>;
    wrongHistory.rollbackHistory = buildNodeToolchainProvisionerBootstrapRollbackHistoryV2([]);
    rejectsCandidateV2(rehashV2(wrongHistory));

    const wrongOwner = clone(ready) as unknown as Record<string, unknown>;
    wrongOwner.expectedOwner = { uid: OWNER_V2.uid + 1, gid: OWNER_V2.gid };
    rejectsCandidateV2(rehashV2(wrongOwner));

    const wrongRootParent = clone(ready) as unknown as Record<string, unknown>;
    const wrongRootParentEntry = (wrongRootParent.activeGeneration as {
      orderedTreeEntries: Array<Record<string, unknown>>;
    }).orderedTreeEntries[0]!;
    wrongRootParentEntry.parentObjectIdentityHash = hex("0");
    rejectsCandidateV2(rehashV2(wrongRootParent));

    const aliasedTree = clone(ready) as unknown as Record<string, unknown>;
    const aliasedEntries = (aliasedTree.activeGeneration as {
      orderedTreeEntries: Array<Record<string, unknown>>;
    }).orderedTreeEntries;
    aliasedEntries[4]!.objectIdentity = clone(aliasedEntries[5]!.objectIdentity);
    aliasedEntries[4]!.fingerprint = clone(aliasedEntries[5]!.fingerprint);
    rejectsCandidateV2(rehashV2(aliasedTree));

    const wrongLock = clone(ready) as unknown as Record<string, unknown>;
    (wrongLock.heldPackageLock as Record<string, unknown>).rawContentHash = hex("0");
    rejectsCandidateV2(rehashV2(wrongLock));

    const wrongScope = clone(ready) as unknown as Record<string, unknown>;
    wrongScope.filesystemScope = buildBootstrapFilesystemScopeIdentityV2({
      scopeNonce: hex("c"),
    });
    rejectsCandidateV2(rehashV2(wrongScope));

    const wrongLogicalSource = clone(ready) as unknown as Record<string, unknown>;
    wrongLogicalSource.sourceLogicalCensusHash = hex("0");
    rejectsCandidateV2(rehashV2(wrongLogicalSource));

    const wrongPhysicalSource = clone(ready) as unknown as Record<string, unknown>;
    wrongPhysicalSource.sourcePhysicalCensusHash = hex("0");
    rejectsCandidateV2(rehashV2(wrongPhysicalSource));

    const statusSwap = clone(ready) as unknown as Record<string, unknown>;
    statusSwap.status = "empty_or_rolled_back";
    statusSwap.activeGeneration = null;
    rejectsCandidateV2(rehashV2(statusSwap));

    assert.throws(() => fixtureV2("empty_or_rolled_back", "a", true));
  });

  it("takes a hostile snapshot before parsing and rejects proxies, extra fields and stale hashes", () => {
    const ready = fixtureV2("ready").snapshot;
    rejectsCandidateV2(new Proxy(ready, {
      ownKeys() {
        throw new Error("hostile-ownKeys");
      },
    }));

    const extra = clone(ready) as unknown as Record<string, unknown>;
    extra.absoluteLocator = "/must-not-enter-the-snapshot-surface";
    rejectsCandidateV2(rehashV2(extra));

    const stale = clone(ready) as unknown as Record<string, unknown>;
    stale.nodePhysicalProjectionHash = hex("0");
    rejectsCandidateV2(stale);
  });

  it("binds live observation hashes, uint64 identities, cross-aliases, rollback basenames and chronology", () => {
    const ready = fixtureV2("ready").snapshot;

    const globalHash = clone(ready) as unknown as Record<string, unknown>;
    (globalHash.liveObservationBinding as Record<string, unknown>)
      .globalPhysicalCensusHash = hex("0");
    rejectsCandidateV2(rehashV2(globalHash));

    const recursiveHash = clone(ready) as unknown as Record<string, unknown>;
    (recursiveHash.liveObservationBinding as Record<string, unknown>)
      .nodeRecursiveEvidenceHash = hex("0");
    rejectsCandidateV2(rehashV2(recursiveHash));

    const basenameBinding = clone(ready) as unknown as Record<string, unknown>;
    ((basenameBinding.rollbackReceipts as Array<Record<string, unknown>>)[0]!)
      .rollbackBasenameBindingHash = hex("0");
    rejectsCandidateV2(rehashV2(basenameBinding));

    const oversizedTree = clone(ready) as unknown as Record<string, unknown>;
    const oversizedEntry = (oversizedTree.activeGeneration as {
      orderedTreeEntries: Array<Record<string, unknown>>;
    }).orderedTreeEntries[4]!;
    const oversizedIdentity = buildStableFsObjectIdentityV2({
      filesystemScope: ready.filesystemScope,
      objectKind: "ordinary_file",
      device: "18446744073709551616",
      inode: "18446744073709551616",
    });
    oversizedEntry.objectIdentity = oversizedIdentity;
    oversizedEntry.fingerprint = fingerprintV2(
      oversizedIdentity,
      "0444",
      (oversizedEntry.treeEntry as { byteLength: number }).byteLength,
    );
    refreshRecursiveBindingV2(oversizedTree);
    rejectsCandidateV2(rehashV2(oversizedTree));

    const globalAlias = clone(ready) as unknown as Record<string, unknown>;
    const aliasEntry = (globalAlias.activeGeneration as {
      orderedTreeEntries: Array<Record<string, unknown>>;
    }).orderedTreeEntries[5]!;
    const lockIdentity = ready.heldPackageLock.objectIdentity;
    aliasEntry.objectIdentity = clone(lockIdentity);
    aliasEntry.fingerprint = fingerprintV2(
      lockIdentity,
      "0444",
      (aliasEntry.treeEntry as { byteLength: number }).byteLength,
    );
    refreshRecursiveBindingV2(globalAlias);
    rejectsCandidateV2(rehashV2(globalAlias));

    const reverseChronology = fixtureV2("ready", "a", false, 2).snapshot;
    assert.deepEqual(
      reverseChronology.rollbackReceipts.map((evidence) =>
        evidence.value.removedGeneration.predecessorRollbackReceiptCount),
      [1, 0],
    );
    assert.equal(reverseChronology.rollbackHistory.receiptCount, 2);
  });
});
