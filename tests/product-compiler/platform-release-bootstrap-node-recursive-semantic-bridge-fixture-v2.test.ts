import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { describe, it } from "node:test";

import {
  PLATFORM_RELEASE_BOOTSTRAP_CONTRACT_V2,
} from
  "../../src/execution/schemas/platform-release-bootstrap-contract-v2.js";
import {
  PLATFORM_RELEASE_BOOTSTRAP_PACKAGE_REFS_V2,
} from
  "../../src/execution/schemas/platform-release-bootstrap-operation-abis-v2.js";
import {
  canonicalJsonStringify,
  hashCanonicalJson,
} from "../../src/product-compiler/canonical-json.js";
import {
  NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_LIFECYCLE_SEMANTIC_VERIFIER_CONTRACT_HASH_V2,
  hashNodeToolchainProvisionerBootstrapRecursiveEvidenceV2,
} from
  "../../src/product-compiler/node-toolchain-provisioner-bootstrap-lifecycle-semantic-snapshot-v2.js";
import {
  PlatformReleaseBootstrapNodeRecursiveSemanticBridgeFixtureErrorV2,
  preparePlatformReleaseBootstrapNodeRecursiveSemanticBridgeFixtureV2,
} from
  "../../src/product-compiler/platform-release-bootstrap-node-recursive-semantic-bridge-fixture-v2.js";
import {
  buildBootstrapFilesystemScopeIdentityV2,
} from
  "../../src/product-compiler/platform-release-bootstrap-physical-census-v2.js";
import {
  NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_LOCK_CONTENT_V2,
  NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_RECEIPT_V2_SCHEMA,
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
} from
  "../../src/product-compiler/schemas/node-toolchain-provisioner-bootstrap-installation-state-v2.js";
import {
  NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_PREPARED_PACKAGE_AUTHORITY_REF_V2,
  NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_PREPARED_PACKAGE_RECEIPT_V2_SCHEMA,
  NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_PREPARED_PACKAGE_VERSION_V2,
  NodeToolchainProvisionerBootstrapPreparedPackageReceiptV2Schema,
  hashNodeToolchainProvisionerBootstrapPreparedPackageReceiptV2,
  hashNodeToolchainProvisionerBootstrapPreparedTreeV2,
  type NodeToolchainProvisionerBootstrapPreparedPackageReceiptV2,
} from
  "../../src/product-compiler/schemas/node-toolchain-provisioner-bootstrap-prepared-package-v2.js";
import {
  buildNodeToolchainProvisionerBootstrapRollbackClaimV2,
  buildNodeToolchainProvisionerBootstrapRollbackPlanV2,
  buildNodeToolchainProvisionerBootstrapRollbackReceiptV2,
  type NodeToolchainProvisionerBootstrapRollbackReceiptV2,
} from
  "../../src/product-compiler/schemas/node-toolchain-provisioner-bootstrap-rollback-v2.js";

const HEADER_SCHEMA_V3 =
  "setfarm.platform-release-bootstrap-darwin-aggregate-census-fixture-stream-header.v3";
const PARENT_SCHEMA =
  "setfarm.platform-release-bootstrap-darwin-aggregate-census-fixture-parent.v2";
const LOCKS_SCHEMA =
  "setfarm.platform-release-bootstrap-darwin-aggregate-census-fixture-locks.v2";
const ENTRY_SCHEMA =
  "setfarm.platform-release-bootstrap-darwin-aggregate-census-fixture-entry.v2";
const RECURSIVE_SCHEMA =
  "setfarm.platform-release-bootstrap-darwin-aggregate-census-fixture-node-recursive-evidence.v3";
const FOOTER_SCHEMA_V3 =
  "setfarm.platform-release-bootstrap-darwin-aggregate-census-fixture-stream-footer.v3";
const PREPARATION_HASH_DOMAIN =
  "setfarm.platform-release-bootstrap-node-recursive-semantic-preparation-fixture-hash.v2";
const LOCK_ORDER = [
  "shared_parent_lock",
  "registered_node_package_lock",
] as const;
const OWNER = Object.freeze({ uid: 501, gid: 20 });
const NODE_PACKAGE = PLATFORM_RELEASE_BOOTSTRAP_CONTRACT_V2.packages.find(
  (candidate) =>
    candidate.packageRef
      === PLATFORM_RELEASE_BOOTSTRAP_PACKAGE_REFS_V2.nodeToolchainProvisioner,
)!;
const FOREIGN_PACKAGE = PLATFORM_RELEASE_BOOTSTRAP_CONTRACT_V2.packages.find(
  (candidate) =>
    candidate.packageRef
      === PLATFORM_RELEASE_BOOTSTRAP_PACKAGE_REFS_V2.hostVerifier,
)!;

type Frame = Record<string, unknown>;

const hex = (character: string, length = 64): string =>
  character.repeat(length);

function preparedReceipt(): NodeToolchainProvisionerBootstrapPreparedPackageReceiptV2 {
  const members = {
    manifest: {
      artifactRef: "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_MANIFEST_V2" as const,
      locator: "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_MANIFEST.v2.json" as const,
      mediaType: "application/json" as const,
      storageMode: "0400" as const,
      targetMode: "0444" as const,
      sha256: hex("1"),
      byteLength: 101,
      linkCount: 1 as const,
    },
    launcher: {
      artifactRef: "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_LAUNCHER_V2" as const,
      locator: "bin/setfarm-node-toolchain-provisioner-v2" as const,
      mediaType: "text/x-shellscript" as const,
      storageMode: "0500" as const,
      targetMode: "0555" as const,
      sha256: hex("2"),
      byteLength: 102,
      linkCount: 1 as const,
    },
    bundle: {
      artifactRef: "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_BUNDLE_V2" as const,
      locator: "lib/node-toolchain-provisioner-v2.cjs" as const,
      mediaType: "application/javascript" as const,
      storageMode: "0400" as const,
      targetMode: "0444" as const,
      sha256: hex("3"),
      byteLength: 103,
      linkCount: 1 as const,
    },
    bootstrapRuntime: {
      artifactRef: "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_RUNTIME_V2" as const,
      locator: "runtime/node" as const,
      mediaType: "application/x-mach-binary" as const,
      storageMode: "0500" as const,
      targetMode: "0555" as const,
      sha256: hex("4"),
      byteLength: 104,
      linkCount: 1 as const,
    },
  };
  const storageWithoutHash = {
    ownerUid: OWNER.uid,
    ownerGid: OWNER.gid,
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
    receiptVersion:
      NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_PREPARED_PACKAGE_VERSION_V2,
    authorityRef:
      NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_PREPARED_PACKAGE_AUTHORITY_REF_V2,
    admissionScope: "test_fixture" as const,
    status: "prepared_payload_verified" as const,
    installationStatus: "not_installed_unprivileged_payload" as const,
    source: {
      codeSha: hex("a", 40),
      sourceTreeHash: hex("b", 40),
      packageVersion: "2.0.0",
      architecture: "arm64" as const,
      manifestHash: hex("9"),
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
      rootLocator: "/tmp/setfarm-semantic-bridge/node-toolchain-provisioner-v2",
      expectedOwnerUid: OWNER.uid,
      expectedOwnerGid: OWNER.gid,
      directoryMode: "0555" as const,
      manifestMode: "0444" as const,
      publicationPolicy:
        "root_owned_every_only_no_replace_fsync_manifest_last_v2" as const,
    },
    storage,
    members,
    publication: {
      policy:
        "exclusive_create_fsync_files_directories_manifest_last_v2" as const,
      manifestPublishedLast: true as const,
      reopenedAfterPublication: true as const,
      targetRootAccess: "none" as const,
    },
  };
  return NodeToolchainProvisionerBootstrapPreparedPackageReceiptV2Schema.parse({
    ...identity,
    receiptHash:
      hashNodeToolchainProvisionerBootstrapPreparedPackageReceiptV2(identity),
  });
}

const exactTool = (toolRef: "MACOS_LOCKF_V2" | "MACOS_CAT_LOCK_HELPER_V2") => ({
  toolRef,
  contentHash: hex(toolRef === "MACOS_LOCKF_V2" ? "e" : "f"),
  byteLength: 64,
  mode: "0755" as const,
  ownerUid: 0 as const,
  ownerGid: 0,
  linkCount: 1 as const,
});

function installationReceipt(
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
      lockf: exactTool("MACOS_LOCKF_V2"),
      lockHelper: exactTool("MACOS_CAT_LOCK_HELPER_V2"),
    },
    finalRoot: {
      rootLocatorHash: intent.target.rootLocatorHash,
      manifestHash: intent.source.source.manifestHash,
      architecture: intent.architecture,
      device: 7,
      inode,
      ownerUid: OWNER.uid,
      ownerGid: OWNER.gid,
      mode: "0555" as const,
      fileCount: 4 as const,
      directoryCount: 4 as const,
      totalBytes: intent.source.storage.totalBytes,
      treeHash:
        hashNodeToolchainProvisionerBootstrapInstalledTreeV2(intent.source),
    },
    claimFile: {
      locatorHash: intent.target.claimLocatorHash,
      mode: "0444" as const,
      ownerUid: OWNER.uid,
      ownerGid: OWNER.gid,
      linkCount: 1 as const,
    },
    receiptFile: {
      locatorHash: intent.target.receiptLocatorHash,
      mode: "0444" as const,
      ownerUid: OWNER.uid,
      ownerGid: OWNER.gid,
      linkCount: 1 as const,
      publicationPolicy:
        "canonical_stage_hard_link_no_replace_fsync_v2" as const,
    },
  };
  return NodeToolchainProvisionerBootstrapInstallationReceiptV2Schema.parse({
    ...identity,
    receiptHash:
      hashNodeToolchainProvisionerBootstrapInstallationReceiptV2(identity),
  });
}

function rollbackReceipt(
  installed: NodeToolchainProvisionerBootstrapInstallationReceiptV2,
): NodeToolchainProvisionerBootstrapRollbackReceiptV2 {
  const plan = buildNodeToolchainProvisionerBootstrapRollbackPlanV2(installed);
  const claim = buildNodeToolchainProvisionerBootstrapRollbackClaimV2(plan);
  return buildNodeToolchainProvisionerBootstrapRollbackReceiptV2({
    claim,
    publisher: {
      executionPolicy: "exact_lockf_fd_then_exact_cat_pipe_v2",
      lockf: exactTool("MACOS_LOCKF_V2"),
      lockHelper: exactTool("MACOS_CAT_LOCK_HELPER_V2"),
    },
  });
}

function b64(value: string | Buffer): string {
  return Buffer.from(value).toString("base64");
}

function mutable(
  byteLength: number,
  mode: "0444" | "0555" | "0600" | "0755",
  linkCount = 1,
): Frame {
  return {
    ownerUid: OWNER.uid,
    ownerGid: OWNER.gid,
    mode,
    linkCount,
    byteLength,
    modifiedSeconds: "100",
    modifiedNanoseconds: "17",
    changedSeconds: "101",
    changedNanoseconds: "19",
  };
}

function orderedMembers(
  members: readonly Readonly<{
    basename: string;
    objectKind: "ordinary_file" | "directory";
  }>[],
): Frame[] {
  return [...members]
    .sort((left, right) =>
      Buffer.compare(Buffer.from(left.basename), Buffer.from(right.basename)))
    .map((member) => ({
      basenameBase64: b64(member.basename),
      objectKind: member.objectKind,
    }));
}

function topFile(
  basename: string,
  inode: string,
  bytes: Buffer,
  mode: "0444" | "0600" = "0444",
): Frame {
  return {
    schema: ENTRY_SCHEMA,
    basenameBase64: b64(basename),
    stable: { objectKind: "ordinary_file", device: "7", inode },
    mutable: mutable(bytes.byteLength, mode),
    content: {
      kind: "bounded_regular_file_bytes",
      byteLength: bytes.byteLength,
      contentBase64: b64(bytes),
    },
  };
}

function topDirectory(
  inode: string,
  members: Parameters<typeof orderedMembers>[0],
): Frame {
  return {
    schema: ENTRY_SCHEMA,
    basenameBase64: b64(NODE_PACKAGE.rootBasename),
    stable: { objectKind: "directory", device: "7", inode },
    mutable: mutable(128, "0555", 2),
    content: {
      kind: "directory_membership",
      members: orderedMembers(members),
    },
  };
}

function recursiveDirectory(
  role: string,
  parentRole: string,
  locator: string,
  inode: string,
  members: Parameters<typeof orderedMembers>[0],
): Frame {
  return {
    role,
    parentRole,
    locator,
    stable: { objectKind: "directory", device: "7", inode },
    mutable: mutable(128, "0555", 2),
    content: {
      kind: "directory_membership",
      members: orderedMembers(members),
    },
  };
}

function recursiveFile(
  role: string,
  parentRole: string,
  locator: string,
  inode: string,
  mode: "0444" | "0555",
  byteLength: number,
  sha256: string,
): Frame {
  return {
    role,
    parentRole,
    locator,
    stable: { objectKind: "ordinary_file", device: "7", inode },
    mutable: mutable(byteLength, mode),
    content: { kind: "sha256_regular_file", sha256 },
  };
}

type ReadyFixture = Readonly<{
  challenge: Buffer;
  frames: Frame[];
  claim: NodeToolchainProvisionerBootstrapInstallationClaimV2;
  receipt: NodeToolchainProvisionerBootstrapInstallationReceiptV2;
  rollback: NodeToolchainProvisionerBootstrapRollbackReceiptV2;
}>;

function readyFixture(): ReadyFixture {
  const prepared = preparedReceipt();
  const claim = buildNodeToolchainProvisionerBootstrapInstallationClaimV2(
    buildNodeToolchainProvisionerBootstrapInstallationIntentV2(prepared),
  );
  const emptyHistory = buildNodeToolchainProvisionerBootstrapRollbackHistoryV2([]);
  const rollback = rollbackReceipt(installationReceipt(claim, emptyHistory, 700));
  const history = buildNodeToolchainProvisionerBootstrapRollbackHistoryV2([{
    installationReceiptHash:
      rollback.removedGeneration.installationReceiptHash,
    rollbackReceiptHash: rollback.receiptHash,
    rollbackReceiptLocatorHash: rollback.receiptFile.locatorHash,
  }]);
  const receipt = installationReceipt(claim, history, 701);
  const scope = buildBootstrapFilesystemScopeIdentityV2({
    scopeNonce: hex("a"),
  });
  const scopeBytes = Buffer.from(canonicalJsonStringify(scope));
  const claimBytes = Buffer.from(canonicalJsonStringify(claim));
  const receiptBytes = Buffer.from(canonicalJsonStringify(receipt));
  const rollbackBytes = Buffer.from(canonicalJsonStringify(rollback));
  const rootMembers = [
    {
      basename: "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_MANIFEST.v2.json",
      objectKind: "ordinary_file" as const,
    },
    { basename: "bin", objectKind: "directory" as const },
    { basename: "lib", objectKind: "directory" as const },
    { basename: "runtime", objectKind: "directory" as const },
  ];
  const root = topDirectory("701", rootMembers);
  const rollbackBasename =
    `.setfarm-node-toolchain-provisioner-installation-v2.rollback.${rollback.removedGeneration.installationReceiptHash}.receipt.json`;
  const entries = [
    topFile(
      PLATFORM_RELEASE_BOOTSTRAP_CONTRACT_V2.registry.filesystemScopeBasename,
      "101",
      scopeBytes,
    ),
    root,
    topFile(
      NODE_PACKAGE.lifecycle.packageLockBasename,
      "103",
      Buffer.from(NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_LOCK_CONTENT_V2),
      "0600",
    ),
    topFile(
      PLATFORM_RELEASE_BOOTSTRAP_CONTRACT_V2.registry.sharedLockBasename,
      "104",
      Buffer.from("setfarm.bootstrap-package-registry-parent-lock.v2\n"),
      "0600",
    ),
    topFile(NODE_PACKAGE.lifecycle.activeClaimBasename, "105", claimBytes),
    topFile(NODE_PACKAGE.lifecycle.activeReceiptBasename, "106", receiptBytes),
    topFile(rollbackBasename, "107", rollbackBytes),
  ].sort((left, right) =>
    Buffer.compare(
      Buffer.from(String(left.basenameBase64), "base64"),
      Buffer.from(String(right.basenameBase64), "base64"),
    ));
  const findEntry = (basename: string): Frame => entries.find((entry) =>
    Buffer.from(String(entry.basenameBase64), "base64").toString("utf8")
      === basename)!;
  const nodeLock = findEntry(NODE_PACKAGE.lifecycle.packageLockBasename);
  const sharedLock = findEntry(
    PLATFORM_RELEASE_BOOTSTRAP_CONTRACT_V2.registry.sharedLockBasename,
  );
  const members = prepared.members;
  const recursiveEntries = [
    {
      role: "root_directory",
      parentRole: "global_parent",
      locator: ".",
      stable: structuredClone(root.stable),
      mutable: structuredClone(root.mutable),
      content: structuredClone(root.content),
    },
    recursiveDirectory("bin_directory", "root_directory", "bin", "201", [
      {
        basename: "setfarm-node-toolchain-provisioner-v2",
        objectKind: "ordinary_file",
      },
    ]),
    recursiveFile(
      "launcher_file",
      "bin_directory",
      members.launcher.locator,
      "202",
      members.launcher.targetMode,
      members.launcher.byteLength,
      members.launcher.sha256,
    ),
    recursiveDirectory("lib_directory", "root_directory", "lib", "203", [
      {
        basename: "node-toolchain-provisioner-v2.cjs",
        objectKind: "ordinary_file",
      },
    ]),
    recursiveFile(
      "bundle_file",
      "lib_directory",
      members.bundle.locator,
      "204",
      members.bundle.targetMode,
      members.bundle.byteLength,
      members.bundle.sha256,
    ),
    recursiveFile(
      "manifest_file",
      "root_directory",
      members.manifest.locator,
      "205",
      members.manifest.targetMode,
      members.manifest.byteLength,
      members.manifest.sha256,
    ),
    recursiveDirectory(
      "runtime_directory",
      "root_directory",
      "runtime",
      "206",
      [{ basename: "node", objectKind: "ordinary_file" }],
    ),
    recursiveFile(
      "bootstrap_runtime_file",
      "runtime_directory",
      members.bootstrapRuntime.locator,
      "207",
      members.bootstrapRuntime.targetMode,
      members.bootstrapRuntime.byteLength,
      members.bootstrapRuntime.sha256,
    ),
  ];
  const frames = [
    {
      schema: HEADER_SCHEMA_V3,
      admissionScope: "test_fixture",
      capability:
        "darwin_read_only_aggregate_census_with_node_recursive_evidence_fixture_v3",
      productionAuthority: false,
      signingAuthority: "adhoc_or_unsigned_test_fixture",
      observationAuthority:
        "fixture_evidence_only_never_backend_capability_v2",
      capturePasses: 2,
      recursiveEvidencePolicy:
        "code_owned_exact_node_tree_descriptor_relative_v3",
      lockOrder: [...LOCK_ORDER],
    },
    {
      schema: PARENT_SCHEMA,
      stable: { objectKind: "directory", device: "7", inode: "100" },
      mutable: mutable(192, "0755", 2),
    },
    {
      schema: LOCKS_SCHEMA,
      lockOrder: [...LOCK_ORDER],
      sharedParentLock: {
        stable: structuredClone(sharedLock.stable),
        mutable: structuredClone(sharedLock.mutable),
      },
      registeredNodePackageLock: {
        stable: structuredClone(nodeLock.stable),
        mutable: structuredClone(nodeLock.mutable),
      },
    },
    ...entries,
    {
      schema: RECURSIVE_SCHEMA,
      admissionScope: "test_fixture",
      productionAuthority: false,
      joinStatus: "native_capture_only_requires_ts_aggregate_join_v2",
      rootBasename: NODE_PACKAGE.rootBasename,
      status: "complete",
      entryCount: 8,
      orderedEntries: recursiveEntries,
    },
    {
      schema: FOOTER_SCHEMA_V3,
      namespaceEntryCount: entries.length,
      recursiveFrameCount: 1,
      frameCount: entries.length + 5,
      completed: true,
    },
  ];
  return {
    challenge: Buffer.from(Array.from({ length: 32 }, (_, index) => index)),
    frames,
    claim,
    receipt,
    rollback,
  };
}

function stream(frames: readonly Frame[]): Buffer {
  return Buffer.from(
    `${frames.map((frame) => JSON.stringify(frame)).join("\n")}\n`,
  );
}

function cloneFrames(frames: readonly Frame[]): Frame[] {
  return structuredClone(frames) as Frame[];
}

function topEntry(frames: readonly Frame[], basename: string): Frame {
  return frames.find((frame) =>
    frame.schema === ENTRY_SCHEMA
    && Buffer.from(String(frame.basenameBase64), "base64").toString("utf8")
      === basename)!;
}

function recursiveFrame(frames: readonly Frame[]): Frame {
  return frames.at(-2)!;
}

function recursiveEntry(frames: readonly Frame[], index: number): Frame {
  return (recursiveFrame(frames).orderedEntries as Frame[])[index]!;
}

function replaceEntryBytes(entry: Frame, bytes: Buffer): void {
  const content = entry.content as Frame;
  const mutableFrame = entry.mutable as Frame;
  content.byteLength = bytes.byteLength;
  content.contentBase64 = b64(bytes);
  mutableFrame.byteLength = bytes.byteLength;
}

function removeTopEntry(frames: Frame[], basename: string): void {
  const index = frames.findIndex((frame) =>
    frame.schema === ENTRY_SCHEMA
    && Buffer.from(String(frame.basenameBase64), "base64").toString("utf8")
      === basename);
  assert.notEqual(index, -1);
  frames.splice(index, 1);
  const footer = frames.at(-1)!;
  footer.namespaceEntryCount = Number(footer.namespaceEntryCount) - 1;
  footer.frameCount = frames.length;
}

function addTopEntries(frames: Frame[], additions: readonly Frame[]): void {
  const namespaceCount = frames.length - 5;
  const entries = [
    ...frames.slice(3, 3 + namespaceCount),
    ...additions,
  ].sort((left, right) =>
    Buffer.compare(
      Buffer.from(String(left.basenameBase64), "base64"),
      Buffer.from(String(right.basenameBase64), "base64"),
    ));
  frames.splice(3, namespaceCount, ...entries);
  frames.at(-1)!.namespaceEntryCount = entries.length;
  frames.at(-1)!.frameCount = frames.length;
}

function assertInvalidInput(input: unknown): void {
  assert.throws(
    () =>
      preparePlatformReleaseBootstrapNodeRecursiveSemanticBridgeFixtureV2(
        input,
      ),
    PlatformReleaseBootstrapNodeRecursiveSemanticBridgeFixtureErrorV2,
  );
}

function assertInvalidFrames(
  frames: readonly Frame[],
  challenge = readyFixture().challenge,
): void {
  assertInvalidInput({
    challenge,
    aggregateRecursiveEvidenceStream: stream(frames),
  });
}

describe("Node recursive semantic bridge fixture", () => {
  it("prepares one frozen self-hashed ready snapshot and accepting ACK from the same V3 bytes", () => {
    const fixture = readyFixture();
    const evidence = stream(fixture.frames);
    const retainedChallenge = Buffer.from(fixture.challenge);
    const retainedEvidence = Buffer.from(evidence);
    const prepared =
      preparePlatformReleaseBootstrapNodeRecursiveSemanticBridgeFixtureV2({
        challenge: fixture.challenge,
        aggregateRecursiveEvidenceStream: evidence,
      });

    assert.equal(prepared.productionAuthority, false);
    assert.equal(prepared.mapping.semanticReady, false);
    assert.equal(prepared.mapping.recursiveEvidence.status, "complete");
    assert.equal(prepared.semanticSnapshot.status, "ready");
    assert.equal(prepared.semanticSnapshot.rollbackReceipts.length, 1);
    assert.equal(
      prepared.semanticSnapshot.activeGeneration?.claim.value.claimHash,
      fixture.claim.claimHash,
    );
    assert.equal(
      prepared.semanticSnapshot.activeGeneration?.receipt.value.receiptHash,
      fixture.receipt.receiptHash,
    );
    assert.equal(
      prepared.semanticSnapshot.rollbackReceipts[0]?.value.receiptHash,
      fixture.rollback.receiptHash,
    );
    assert.equal(
      prepared.semanticSnapshot.liveObservationBinding
        .observationTranscriptHash,
      prepared.observation.transcriptHash,
    );
    assert.equal(
      prepared.observation.nodeRecursiveEvidence.evidenceHash,
      hashNodeToolchainProvisionerBootstrapRecursiveEvidenceV2({
        status: "ready",
        packageRoot:
          prepared.semanticSnapshot.activeGeneration?.packageRoot ?? null,
        orderedTreeEntries:
          prepared.semanticSnapshot.activeGeneration?.orderedTreeEntries ?? null,
      }),
    );
    assert.equal(
      prepared.acknowledgement.semanticVerifierContractHash,
      NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_LIFECYCLE_SEMANTIC_VERIFIER_CONTRACT_HASH_V2,
    );
    assert.equal(prepared.semanticAckSha256, prepared.acknowledgement.frameHash);
    const preparationHashPreimage = {
      schema: PREPARATION_HASH_DOMAIN,
      preparation: {
        schema: prepared.schema,
        admissionScope: prepared.admissionScope,
        productionAuthority: prepared.productionAuthority,
        authority: prepared.authority,
        mappingHash: prepared.mapping.mappingHash,
        openFrameHash: prepared.open.frameHash,
        openTranscriptHash: prepared.open.transcriptHash,
        observationFrameHash: prepared.observation.frameHash,
        observationTranscriptHash: prepared.observation.transcriptHash,
        semanticSnapshotHash: prepared.semanticSnapshot.snapshotHash,
        semanticVerifierContractHash:
          prepared.semanticSnapshot.semanticVerifierContractHash,
        semanticStatus: prepared.semanticSnapshot.status,
        acknowledgementFrameHash: prepared.acknowledgement.frameHash,
        acknowledgementTranscriptHash:
          prepared.acknowledgement.transcriptHash,
        semanticAckSha256: prepared.semanticAckSha256,
      },
    };
    const expectedPreparationHash = hashCanonicalJson(preparationHashPreimage);
    assert.equal(prepared.preparationHash, expectedPreparationHash);
    assert.ok(Object.isFrozen(prepared));
    assert.ok(Object.isFrozen(prepared.semanticSnapshot));
    assert.deepEqual(fixture.challenge, retainedChallenge);
    assert.deepEqual(evidence, retainedEvidence);
    assert.equal(
      createHash("sha256").update(evidence).digest("hex"),
      prepared.mapping.rawStreamHash,
    );

    const transcriptFields = [
      "openTranscriptHash",
      "observationTranscriptHash",
      "acknowledgementTranscriptHash",
    ] as const;
    for (const [index, field] of transcriptFields.entries()) {
      const tampered = structuredClone(preparationHashPreimage);
      tampered.preparation[field] = hex(String(index + 5));
      assert.notEqual(hashCanonicalJson(tampered), prepared.preparationHash);
    }
  });

  it("ignores code-owned foreign package lifecycle artifacts after positional capture join", () => {
    const fixture = readyFixture();
    const baseline =
      preparePlatformReleaseBootstrapNodeRecursiveSemanticBridgeFixtureV2({
        challenge: fixture.challenge,
        aggregateRecursiveEvidenceStream: stream(fixture.frames),
      });
    const coexistence = cloneFrames(fixture.frames);
    addTopEntries(coexistence, [
      topFile(
        FOREIGN_PACKAGE.lifecycle.activeClaimBasename,
        "108",
        Buffer.from('{"opaque":"foreign-package-claim"}'),
      ),
      topFile(
        FOREIGN_PACKAGE.lifecycle.activeReceiptBasename,
        "109",
        Buffer.from([0xff, 0x00, 0x0a]),
      ),
    ]);
    const prepared =
      preparePlatformReleaseBootstrapNodeRecursiveSemanticBridgeFixtureV2({
        challenge: fixture.challenge,
        aggregateRecursiveEvidenceStream: stream(coexistence),
      });

    const foreignCaptures = prepared.mapping.aggregateObservation.physicalCensus
      .orderedEntryCaptures.filter((capture) =>
        capture.classification.ownerKind === "package"
        && capture.classification.ownerRef === FOREIGN_PACKAGE.packageRef);
    assert.deepEqual(
      foreignCaptures.map((capture) => capture.classification.category),
      ["active_claim", "active_receipt"],
    );
    assert.deepEqual(
      prepared.mapping.aggregateObservation.nodeLogicalProjection.orderedEntries,
      baseline.mapping.aggregateObservation.nodeLogicalProjection.orderedEntries,
    );
    assert.equal(
      prepared.semanticSnapshot.activeGeneration?.claim.value.claimHash,
      baseline.semanticSnapshot.activeGeneration?.claim.value.claimHash,
    );
    assert.equal(
      prepared.semanticSnapshot.activeGeneration?.receipt.value.receiptHash,
      baseline.semanticSnapshot.activeGeneration?.receipt.value.receiptHash,
    );
    assert.equal(prepared.semanticSnapshot.status, "ready");
  });

  it("rejects V2, incomplete recursive statuses, and a non-0755 parent", () => {
    const fixture = readyFixture();

    const v2 = cloneFrames(fixture.frames);
    v2[0]!.schema =
      "setfarm.platform-release-bootstrap-darwin-aggregate-census-fixture-stream-header.v2";
    assertInvalidFrames(v2, fixture.challenge);

    const rootAbsent = cloneFrames(fixture.frames);
    removeTopEntry(rootAbsent, NODE_PACKAGE.rootBasename);
    const absentRecursive = recursiveFrame(rootAbsent);
    absentRecursive.status = "root_absent";
    absentRecursive.entryCount = 0;
    absentRecursive.orderedEntries = [];
    assertInvalidFrames(rootAbsent, fixture.challenge);

    const layout = cloneFrames(fixture.frames);
    (topEntry(layout, NODE_PACKAGE.rootBasename).mutable as Frame).mode = "0700";
    const layoutRecursive = recursiveFrame(layout);
    layoutRecursive.status = "layout_not_exact";
    layoutRecursive.entryCount = 0;
    layoutRecursive.orderedEntries = [];
    assertInvalidFrames(layout, fixture.challenge);

    const wrongParentMode = cloneFrames(fixture.frames);
    (wrongParentMode[1]!.mutable as Frame).mode = "0555";
    assertInvalidFrames(wrongParentMode, fixture.challenge);
  });

  it("rejects noncanonical, invalid, missing, duplicated, and spliced lifecycle documents", () => {
    const fixture = readyFixture();

    const noncanonical = cloneFrames(fixture.frames);
    replaceEntryBytes(
      topEntry(noncanonical, NODE_PACKAGE.lifecycle.activeClaimBasename),
      Buffer.from(JSON.stringify(fixture.claim, null, 2)),
    );
    assertInvalidFrames(noncanonical, fixture.challenge);

    const invalid = cloneFrames(fixture.frames);
    replaceEntryBytes(
      topEntry(invalid, NODE_PACKAGE.lifecycle.activeReceiptBasename),
      Buffer.from("{"),
    );
    assertInvalidFrames(invalid, fixture.challenge);

    const missing = cloneFrames(fixture.frames);
    removeTopEntry(missing, NODE_PACKAGE.lifecycle.activeReceiptBasename);
    assertInvalidFrames(missing, fixture.challenge);

    const duplicate = cloneFrames(fixture.frames);
    const duplicateClaim = structuredClone(
      topEntry(duplicate, NODE_PACKAGE.lifecycle.activeClaimBasename),
    );
    duplicate.splice(-2, 0, duplicateClaim);
    duplicate.at(-1)!.namespaceEntryCount =
      Number(duplicate.at(-1)!.namespaceEntryCount) + 1;
    duplicate.at(-1)!.frameCount = duplicate.length;
    assertInvalidFrames(duplicate, fixture.challenge);

    const spliced = cloneFrames(fixture.frames);
    replaceEntryBytes(
      topEntry(spliced, NODE_PACKAGE.lifecycle.activeClaimBasename),
      Buffer.from(canonicalJsonStringify(fixture.receipt)),
    );
    assertInvalidFrames(spliced, fixture.challenge);

    const invalidRollback = cloneFrames(fixture.frames);
    const rollbackEntry = invalidRollback.find((frame) =>
      frame.schema === ENTRY_SCHEMA
      && Buffer.from(String(frame.basenameBase64), "base64").toString("utf8")
        .includes(".rollback."))!;
    replaceEntryBytes(rollbackEntry, Buffer.from("{}"));
    assertInvalidFrames(invalidRollback, fixture.challenge);

    const missingRollback = cloneFrames(fixture.frames);
    removeTopEntry(
      missingRollback,
      Buffer.from(String(rollbackEntry.basenameBase64), "base64").toString("utf8"),
    );
    assertInvalidFrames(missingRollback, fixture.challenge);
  });

  it("rejects tree hash, membership, metadata, lock, and projection mismatches", () => {
    const fixture = readyFixture();

    const contentHash = cloneFrames(fixture.frames);
    (recursiveEntry(contentHash, 2).content as Frame).sha256 = hex("8");
    assertInvalidFrames(contentHash, fixture.challenge);

    const membership = cloneFrames(fixture.frames);
    ((recursiveEntry(membership, 1).content as Frame).members as Frame[]).pop();
    assertInvalidFrames(membership, fixture.challenge);

    const metadata = cloneFrames(fixture.frames);
    (recursiveEntry(metadata, 2).mutable as Frame).byteLength = 103;
    assertInvalidFrames(metadata, fixture.challenge);

    const lock = cloneFrames(fixture.frames);
    const nodeLock = topEntry(lock, NODE_PACKAGE.lifecycle.packageLockBasename);
    replaceEntryBytes(nodeLock, Buffer.from("foreign-lock\n"));
    (lock[2]!.registeredNodePackageLock as Frame).mutable =
      structuredClone(nodeLock.mutable);
    assertInvalidFrames(lock, fixture.challenge);

    const projection = cloneFrames(fixture.frames);
    topEntry(
      projection,
      NODE_PACKAGE.lifecycle.activeClaimBasename,
    ).basenameBase64 = b64("foreign-node-document.json");
    assertInvalidFrames(projection, fixture.challenge);
  });

  it("rejects challenge shape, accessors, proxies, and byte-array shadows without invoking getters", () => {
    const fixture = readyFixture();
    const evidence = stream(fixture.frames);
    assertInvalidInput({
      challenge: Buffer.alloc(31),
      aggregateRecursiveEvidenceStream: evidence,
    });

    let recordGetterCalls = 0;
    const accessorInput = {
      get challenge() {
        recordGetterCalls += 1;
        return fixture.challenge;
      },
      aggregateRecursiveEvidenceStream: evidence,
    };
    assertInvalidInput(accessorInput);
    assert.equal(recordGetterCalls, 0);

    assertInvalidInput(new Proxy({
      challenge: fixture.challenge,
      aggregateRecursiveEvidenceStream: evidence,
    }, {}));

    const shadowedChallenge = Buffer.from(fixture.challenge);
    let shadowGetterCalls = 0;
    Object.defineProperty(shadowedChallenge, "byteLength", {
      configurable: true,
      get() {
        shadowGetterCalls += 1;
        return 32;
      },
    });
    try {
      assertInvalidInput({
        challenge: shadowedChallenge,
        aggregateRecursiveEvidenceStream: evidence,
      });
      assert.equal(shadowGetterCalls, 0);
    } finally {
      delete (shadowedChallenge as unknown as Frame).byteLength;
    }

    const shadowedBufferEvidence = Buffer.from(evidence);
    let bufferGetterCalls = 0;
    Object.defineProperty(shadowedBufferEvidence.buffer, "byteLength", {
      configurable: true,
      get() {
        bufferGetterCalls += 1;
        return 0;
      },
    });
    try {
      assertInvalidInput({
        challenge: fixture.challenge,
        aggregateRecursiveEvidenceStream: shadowedBufferEvidence,
      });
      assert.equal(bufferGetterCalls, 0);
    } finally {
      delete (shadowedBufferEvidence.buffer as unknown as Frame).byteLength;
    }
  });

  it("binds every challenge byte and rejects partial, hostile, and oversized stream bytes", () => {
    const fixture = readyFixture();
    const evidence = stream(fixture.frames);
    const first =
      preparePlatformReleaseBootstrapNodeRecursiveSemanticBridgeFixtureV2({
        challenge: fixture.challenge,
        aggregateRecursiveEvidenceStream: evidence,
      });
    const changedChallenge = Buffer.from(fixture.challenge);
    changedChallenge[31] ^= 0xff;
    const changed =
      preparePlatformReleaseBootstrapNodeRecursiveSemanticBridgeFixtureV2({
        challenge: changedChallenge,
        aggregateRecursiveEvidenceStream: evidence,
      });
    assert.notEqual(first.open.sessionOccurrenceHash, changed.open.sessionOccurrenceHash);
    assert.notEqual(first.preparationHash, changed.preparationHash);

    assertInvalidInput({
      challenge: fixture.challenge,
      aggregateRecursiveEvidenceStream: evidence.subarray(0, -1),
    });
    assertInvalidInput({
      challenge: fixture.challenge,
      aggregateRecursiveEvidenceStream: Buffer.from([0xff, 0x0a]),
    });
    assertInvalidInput({
      challenge: fixture.challenge,
      aggregateRecursiveEvidenceStream: Buffer.alloc(64 * 1024 * 1024 + 1),
    });
  });
});
