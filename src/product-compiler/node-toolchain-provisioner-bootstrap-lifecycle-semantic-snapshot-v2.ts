import { createHash } from "node:crypto";

import { z } from "zod";

import { PLATFORM_RELEASE_BOOTSTRAP_CONTRACT_V2 } from "../execution/schemas/platform-release-bootstrap-contract-v2.js";
import { PLATFORM_RELEASE_BOOTSTRAP_PACKAGE_REFS_V2 } from "../execution/schemas/platform-release-bootstrap-operation-abis-v2.js";
import {
  PLATFORM_RELEASE_COMPONENT_VERSION_V2,
  boundedPlatformReleaseJsonSnapshotV2,
  deepFreezePlatformReleaseJsonV2,
  platformReleaseCandidateFitsCanonicalCapV2,
} from "../execution/schemas/platform-release-common-v2.js";
import { canonicalJsonBytes, canonicalJsonStringify, hashCanonicalJson } from "./canonical-json.js";
import {
  BootstrapFilesystemScopeIdentityV2Schema,
  DirectoryMembershipIdentityV2Schema,
  FsObservationFingerprintV2Schema,
  NamespacePhysicalEntryCaptureV2Schema,
  PackageLifecyclePhysicalProjectionV2Schema,
  StableFsObjectIdentityV2Schema,
  buildDirectoryMembershipIdentityV2,
  filesystemObjectLocatorKeyV2,
  PLATFORM_RELEASE_BOOTSTRAP_DIRECTORY_MEMBERSHIP_IDENTITY_V2_SCHEMA,
  PLATFORM_RELEASE_BOOTSTRAP_FILESYSTEM_SCOPE_IDENTITY_V2_SCHEMA,
  PLATFORM_RELEASE_BOOTSTRAP_FS_OBSERVATION_FINGERPRINT_V2_SCHEMA,
  PLATFORM_RELEASE_BOOTSTRAP_NAMESPACE_PHYSICAL_ENTRY_CAPTURE_V2_SCHEMA,
  PLATFORM_RELEASE_BOOTSTRAP_PACKAGE_LIFECYCLE_PHYSICAL_PROJECTION_V2_SCHEMA,
  PLATFORM_RELEASE_BOOTSTRAP_STABLE_FS_OBJECT_IDENTITY_V2_SCHEMA,
} from "./platform-release-bootstrap-physical-census-v2.js";
import {
  PLATFORM_RELEASE_BOOTSTRAP_NAMESPACE_CENSUS_MAX_ENTRIES_V2,
  PlatformReleaseBootstrapNamespaceClassificationV2Schema,
} from "./platform-release-bootstrap-registry-v2.js";
import { Sha256Schema } from "./schemas/common-v1.js";
import {
  NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_LOCK_CONTENT_V2,
  NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_CLAIM_V2_SCHEMA,
  NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_RECEIPT_V2_SCHEMA,
  NodeToolchainProvisionerBootstrapInstallationClaimV2Schema,
  NodeToolchainProvisionerBootstrapInstallationReceiptV2Schema,
  NodeToolchainProvisionerBootstrapRollbackHistoryV2Schema,
  buildNodeToolchainProvisionerBootstrapRollbackHistoryV2,
  hashNodeToolchainProvisionerBootstrapInstalledTreeV2,
} from "./schemas/node-toolchain-provisioner-bootstrap-installation-state-v2.js";
import {
  NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_ROLLBACK_RECEIPT_V2_SCHEMA,
  NodeToolchainProvisionerBootstrapRollbackReceiptV2Schema,
  buildNodeToolchainProvisionerBootstrapRollbackTreeEntriesV2,
} from "./schemas/node-toolchain-provisioner-bootstrap-rollback-v2.js";

export const NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_LIFECYCLE_SEMANTIC_SNAPSHOT_V2_SCHEMA =
  "setfarm.node-toolchain-provisioner-bootstrap-lifecycle-semantic-snapshot.v2" as const;
export const NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_LIFECYCLE_SEMANTIC_SNAPSHOT_HASH_V2_DOMAIN =
  "setfarm.node-toolchain-provisioner-bootstrap-lifecycle-semantic-snapshot-hash.v2" as const;
export const NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_LIFECYCLE_SEMANTIC_SNAPSHOT_MAX_CANONICAL_BYTES_V2 =
  16 * 1024 * 1024;

const NODE_PACKAGE_REF_V2 =
  PLATFORM_RELEASE_BOOTSTRAP_PACKAGE_REFS_V2.nodeToolchainProvisioner;
const NODE_PACKAGE_CONTRACT_V2 = PLATFORM_RELEASE_BOOTSTRAP_CONTRACT_V2.packages.find(
  (entry) => entry.packageRef === NODE_PACKAGE_REF_V2,
);
if (!NODE_PACKAGE_CONTRACT_V2) {
  throw new TypeError("Code-owned bootstrap registry is missing the Node package contract");
}

export const NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_LIFECYCLE_IDENTITY_HASH_V2 =
  hashCanonicalJson({
    schema: "setfarm.platform-release-bootstrap-registry-node-lifecycle-identity.v2",
    registryContractHash: PLATFORM_RELEASE_BOOTSTRAP_CONTRACT_V2.contractHash,
    packageContract: NODE_PACKAGE_CONTRACT_V2,
  });

const REQUIRED_OBSERVATION_AUTHORITY_V2 =
  "captured_evidence_requires_live_native_session_receipt_v2" as const;

const LIFECYCLE_SEMANTIC_EVIDENCE_CONTRACT_IDS_V2 = Object.freeze([
  PLATFORM_RELEASE_BOOTSTRAP_FILESYSTEM_SCOPE_IDENTITY_V2_SCHEMA,
  PLATFORM_RELEASE_BOOTSTRAP_STABLE_FS_OBJECT_IDENTITY_V2_SCHEMA,
  PLATFORM_RELEASE_BOOTSTRAP_FS_OBSERVATION_FINGERPRINT_V2_SCHEMA,
  PLATFORM_RELEASE_BOOTSTRAP_DIRECTORY_MEMBERSHIP_IDENTITY_V2_SCHEMA,
  PLATFORM_RELEASE_BOOTSTRAP_NAMESPACE_PHYSICAL_ENTRY_CAPTURE_V2_SCHEMA,
  PLATFORM_RELEASE_BOOTSTRAP_PACKAGE_LIFECYCLE_PHYSICAL_PROJECTION_V2_SCHEMA,
  "setfarm.platform-release-bootstrap-registry-claimed-package-lifecycle-projection.v2",
  NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_CLAIM_V2_SCHEMA,
  NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_RECEIPT_V2_SCHEMA,
  NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_ROLLBACK_RECEIPT_V2_SCHEMA,
  "setfarm.node-toolchain-provisioner-bootstrap-recursive-evidence.v2",
  "setfarm.node-toolchain-provisioner-bootstrap-rollback-basename-binding.v2",
  "setfarm.node-toolchain-provisioner-bootstrap-live-observation-binding.v2",
] as const);

export const NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_LIFECYCLE_SEMANTIC_VERIFIER_CONTRACT_HASH_V2 =
  hashCanonicalJson({
    schema:
      "setfarm.node-toolchain-provisioner-bootstrap-lifecycle-semantic-verifier-contract-hash.v2",
    contract: {
      schema:
        "setfarm.node-toolchain-provisioner-bootstrap-lifecycle-semantic-verifier-contract.v2",
      version: PLATFORM_RELEASE_COMPONENT_VERSION_V2,
      lifecycleIdentityHash:
        NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_LIFECYCLE_IDENTITY_HASH_V2,
      requiredObservationAuthority: REQUIRED_OBSERVATION_AUTHORITY_V2,
      evidenceContractIds: LIFECYCLE_SEMANTIC_EVIDENCE_CONTRACT_IDS_V2,
    },
  });

const EXPECTED_PACKAGE_LOCK_RAW_CONTENT_HASH_V2 = createHash("sha256")
  .update(NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_LOCK_CONTENT_V2, "utf8")
  .digest("hex");

const PosixIdentityV2Schema = z.number().int().nonnegative().max(2_147_483_647);

const NodeLogicalProjectionIdentityV2Schema = z.object({
  schema: z.literal(
    "setfarm.platform-release-bootstrap-registry-claimed-package-lifecycle-projection.v2",
  ),
  version: z.literal(PLATFORM_RELEASE_COMPONENT_VERSION_V2),
  packageRef: z.literal(NODE_PACKAGE_REF_V2),
  entryCount: z.number().int().positive().max(
    PLATFORM_RELEASE_BOOTSTRAP_NAMESPACE_CENSUS_MAX_ENTRIES_V2,
  ),
  orderedEntries: z.array(PlatformReleaseBootstrapNamespaceClassificationV2Schema)
    .min(1).max(PLATFORM_RELEASE_BOOTSTRAP_NAMESPACE_CENSUS_MAX_ENTRIES_V2),
}).strict();

function hashNodeLogicalProjectionV2(value: Readonly<Record<string, unknown>>): string {
  const projection = { ...value };
  delete projection.censusHash;
  return hashCanonicalJson({
    schema:
      "setfarm.platform-release-bootstrap-registry-claimed-package-lifecycle-projection-hash.v2",
    projection,
  });
}

const NodeLogicalProjectionV2Schema = NodeLogicalProjectionIdentityV2Schema.extend({
  censusHash: Sha256Schema,
}).strict().superRefine((value, context) => {
  if (
    value.entryCount !== value.orderedEntries.length
    || value.orderedEntries.some((entry, index) =>
      entry.ownerKind !== "package"
      || entry.ownerRef !== NODE_PACKAGE_REF_V2
      || (index > 0 && value.orderedEntries[index - 1]!.basename >= entry.basename))
    || !value.orderedEntries.some((entry) => entry.category === "package_lock")
    || value.censusHash !== hashNodeLogicalProjectionV2(value)
  ) {
    context.addIssue({
      code: "custom",
      message: "Node logical lifecycle projection must be exact, ordered, package-owned, and self-hashed",
    });
  }
});

const ExpectedOwnerV2Schema = z.object({
  uid: PosixIdentityV2Schema,
  gid: PosixIdentityV2Schema,
}).strict();

const HeldPackageLockV2Schema = z.object({
  objectIdentity: StableFsObjectIdentityV2Schema,
  fingerprint: FsObservationFingerprintV2Schema,
  rawContentHash: Sha256Schema,
}).strict();

function canonicalArtifactEvidenceSchema<T extends z.ZodType>(
  valueSchema: T,
) {
  return z.object({
    classification: PlatformReleaseBootstrapNamespaceClassificationV2Schema,
    entryCapture: NamespacePhysicalEntryCaptureV2Schema,
    rawBytesHash: Sha256Schema,
    value: valueSchema,
  }).strict();
}

const InstallationClaimEvidenceV2Schema = canonicalArtifactEvidenceSchema(
  NodeToolchainProvisionerBootstrapInstallationClaimV2Schema,
);
const InstallationReceiptEvidenceV2Schema = canonicalArtifactEvidenceSchema(
  NodeToolchainProvisionerBootstrapInstallationReceiptV2Schema,
);
const RollbackReceiptEvidenceV2Schema = canonicalArtifactEvidenceSchema(
  NodeToolchainProvisionerBootstrapRollbackReceiptV2Schema,
).safeExtend({
  rollbackBasenameBindingHash: Sha256Schema,
}).strict();

const RollbackTreeEntryV2Schema = z.object({
  locator: z.enum([
    ".",
    "bin",
    "lib",
    "runtime",
    "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_MANIFEST.v2.json",
    "bin/setfarm-node-toolchain-provisioner-v2",
    "lib/node-toolchain-provisioner-v2.cjs",
    "runtime/node",
  ]),
  type: z.enum(["directory", "file"]),
  mode: z.enum(["0444", "0555"]),
  byteLength: z.number().int().nonnegative().max(256 * 1024 * 1024),
  contentHash: Sha256Schema.nullable(),
}).strict();

const TreeRoleV2Schema = z.enum([
  "root_directory",
  "bin_directory",
  "launcher_file",
  "lib_directory",
  "bundle_file",
  "manifest_file",
  "runtime_directory",
  "bootstrap_runtime_file",
]);

const TreeEvidenceCommonV2 = {
  role: TreeRoleV2Schema,
  parentObjectIdentityHash: Sha256Schema,
  objectIdentity: StableFsObjectIdentityV2Schema,
  fingerprint: FsObservationFingerprintV2Schema,
  treeEntry: RollbackTreeEntryV2Schema,
} as const;

const DirectoryTreeEvidenceV2Schema = z.object({
  kind: z.literal("directory"),
  ...TreeEvidenceCommonV2,
  membership: DirectoryMembershipIdentityV2Schema,
}).strict();

const FileTreeEvidenceV2Schema = z.object({
  kind: z.literal("file"),
  ...TreeEvidenceCommonV2,
  rawContentHash: Sha256Schema,
}).strict();

const InstalledTreeMemberEvidenceV2Schema = z.discriminatedUnion("kind", [
  DirectoryTreeEvidenceV2Schema,
  FileTreeEvidenceV2Schema,
]);

const PackageRootEvidenceV2Schema = z.object({
  objectIdentity: StableFsObjectIdentityV2Schema,
  fingerprint: FsObservationFingerprintV2Schema,
}).strict();

const ReadyGenerationEvidenceV2Schema = z.object({
  claim: InstallationClaimEvidenceV2Schema,
  receipt: InstallationReceiptEvidenceV2Schema,
  packageRoot: PackageRootEvidenceV2Schema,
  orderedTreeEntries: z.array(InstalledTreeMemberEvidenceV2Schema).length(8),
}).strict();

const SnapshotCommonShapeV2 = {
  schema: z.literal(NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_LIFECYCLE_SEMANTIC_SNAPSHOT_V2_SCHEMA),
  version: z.literal(PLATFORM_RELEASE_COMPONENT_VERSION_V2),
  packageRef: z.literal(NODE_PACKAGE_REF_V2),
  admissionScope: z.literal("test_fixture"),
  productionAuthority: z.literal(false),
  observationAuthority: z.literal(
    REQUIRED_OBSERVATION_AUTHORITY_V2,
  ),
  semanticVerifierContractHash: z.literal(
    NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_LIFECYCLE_SEMANTIC_VERIFIER_CONTRACT_HASH_V2,
  ),
  nodeLifecycleIdentityHash: z.literal(
    NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_LIFECYCLE_IDENTITY_HASH_V2,
  ),
  filesystemScope: BootstrapFilesystemScopeIdentityV2Schema,
  expectedOwner: ExpectedOwnerV2Schema,
  sourceLogicalCensusHash: Sha256Schema,
  sourcePhysicalCensusHash: Sha256Schema,
  nodeLogicalProjection: NodeLogicalProjectionV2Schema,
  nodePhysicalProjection: PackageLifecyclePhysicalProjectionV2Schema,
  nodePhysicalProjectionHash: Sha256Schema,
  liveObservationBinding: z.object({
    sessionOccurrenceHash: Sha256Schema,
    observationTranscriptHash: Sha256Schema,
    globalPhysicalCensusHash: Sha256Schema,
    nodeRecursiveEvidenceHash: Sha256Schema,
    rollbackLocatorAuthority: z.literal(
      "basename_binding_only_locator_hash_requires_live_native_session_receipt_v2",
    ),
  }).strict(),
  heldPackageLock: HeldPackageLockV2Schema,
  rollbackReceipts: z.array(RollbackReceiptEvidenceV2Schema)
    .max(PLATFORM_RELEASE_BOOTSTRAP_NAMESPACE_CENSUS_MAX_ENTRIES_V2),
  rollbackHistory: NodeToolchainProvisionerBootstrapRollbackHistoryV2Schema,
} as const;

const ReadySnapshotIdentityV2Schema = z.object({
  ...SnapshotCommonShapeV2,
  status: z.literal("ready"),
  activeGeneration: ReadyGenerationEvidenceV2Schema,
}).strict();

const EmptySnapshotIdentityV2Schema = z.object({
  ...SnapshotCommonShapeV2,
  status: z.literal("empty_or_rolled_back"),
  activeGeneration: z.null(),
}).strict();

const SnapshotIdentityV2Schema = z.discriminatedUnion("status", [
  ReadySnapshotIdentityV2Schema,
  EmptySnapshotIdentityV2Schema,
]);

type SnapshotIdentityV2 = z.infer<typeof SnapshotIdentityV2Schema>;

function sameCanonicalV2(left: unknown, right: unknown): boolean {
  return canonicalJsonStringify(left) === canonicalJsonStringify(right);
}

function physicalDecimalMatchesSafeIntegerV2(decimal: string, value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0 && decimal === String(value);
}

const UINT64_MAX_V2 = (1n << 64n) - 1n;

function isUint64DecimalV2(value: string): boolean {
  try {
    return /^(?:0|[1-9][0-9]*)$/.test(value) && BigInt(value) <= UINT64_MAX_V2;
  } catch {
    return false;
  }
}

export function hashNodeToolchainProvisionerBootstrapRollbackBasenameBindingV2(
  input: Readonly<{
    basename: string;
    rollbackReceiptHash: string;
    removedInstallationReceiptHash: string;
  }>,
): string {
  return hashCanonicalJson({
    schema:
      "setfarm.node-toolchain-provisioner-bootstrap-rollback-basename-binding.v2",
    binding: input,
  });
}

export function hashNodeToolchainProvisionerBootstrapRecursiveEvidenceV2(
  input: Readonly<{
    status: "ready" | "empty_or_rolled_back";
    packageRoot: unknown | null;
    orderedTreeEntries: unknown | null;
  }>,
): string {
  return hashCanonicalJson({
    schema:
      "setfarm.node-toolchain-provisioner-bootstrap-recursive-evidence.v2",
    evidence: input,
  });
}

function evidenceMatchesCaptureV2(
  evidence: Readonly<{
    classification: z.infer<typeof PlatformReleaseBootstrapNamespaceClassificationV2Schema>;
    entryCapture: z.infer<typeof NamespacePhysicalEntryCaptureV2Schema>;
    rawBytesHash: string;
    value: unknown;
  }>,
  expectedCategory: "active_claim" | "active_receipt" | "rollback_receipt",
): boolean {
  return evidence.classification.ownerKind === "package"
    && evidence.classification.ownerRef === NODE_PACKAGE_REF_V2
    && evidence.classification.category === expectedCategory
    && sameCanonicalV2(evidence.classification, evidence.entryCapture.classification)
    && evidence.entryCapture.objectIdentity.objectKind === "ordinary_file"
    && evidence.entryCapture.contentEvidence.kind === "bounded_regular_file_bytes"
    && evidence.entryCapture.contentEvidence.rawContentHash === evidence.rawBytesHash
    && evidence.rawBytesHash === hashCanonicalJson(evidence.value)
    && evidence.entryCapture.fingerprint.byteLength === canonicalJsonBytes(evidence.value).byteLength
    && evidence.entryCapture.fingerprint.mode === "0444"
    && evidence.entryCapture.fingerprint.linkCount === 1;
}

function expectedMembershipsV2(receipt: z.infer<
  typeof NodeToolchainProvisionerBootstrapInstallationReceiptV2Schema
>) {
  const source = receipt.claim.intent.source;
  return [
    buildDirectoryMembershipIdentityV2({
      orderedEntries: [
        { basename: source.members.manifest.locator, objectKind: "ordinary_file" },
        { basename: "bin", objectKind: "directory" },
        { basename: "lib", objectKind: "directory" },
        { basename: "runtime", objectKind: "directory" },
      ],
    }),
    buildDirectoryMembershipIdentityV2({
      orderedEntries: [{ basename: "setfarm-node-toolchain-provisioner-v2", objectKind: "ordinary_file" }],
    }),
    buildDirectoryMembershipIdentityV2({
      orderedEntries: [{ basename: "node-toolchain-provisioner-v2.cjs", objectKind: "ordinary_file" }],
    }),
    buildDirectoryMembershipIdentityV2({
      orderedEntries: [{ basename: "node", objectKind: "ordinary_file" }],
    }),
  ] as const;
}

function validateTreeV2(value: SnapshotIdentityV2 & { status: "ready" }): boolean {
  const active = value.activeGeneration;
  const receipt = active.receipt.value;
  const expectedEntries = buildNodeToolchainProvisionerBootstrapRollbackTreeEntriesV2(receipt);
  const expectedRoles = [
    "root_directory",
    "bin_directory",
    "launcher_file",
    "lib_directory",
    "bundle_file",
    "manifest_file",
    "runtime_directory",
    "bootstrap_runtime_file",
  ] as const;
  const actual = active.orderedTreeEntries;
  const treeLocatorKeys = actual.map((entry) =>
    filesystemObjectLocatorKeyV2(entry.objectIdentity));
  const globalLocatorKeys = new Set(
    value.nodePhysicalProjection.orderedEntryCaptures.map((capture) =>
      filesystemObjectLocatorKeyV2(capture.objectIdentity)),
  );
  if (
    actual.some((entry, index) =>
      entry.role !== expectedRoles[index]
      || !sameCanonicalV2(entry.treeEntry, expectedEntries[index])
      || entry.objectIdentity.filesystemScopeIdentityHash !== value.filesystemScope.scopeIdentityHash
      || entry.fingerprint.objectIdentityHash !== entry.objectIdentity.objectIdentityHash
      || entry.fingerprint.ownerUid !== value.expectedOwner.uid
      || entry.fingerprint.ownerGid !== value.expectedOwner.gid
      || entry.fingerprint.mode !== entry.treeEntry.mode
      || entry.objectIdentity.objectKind
        !== (entry.kind === "file" ? "ordinary_file" : "directory"))
    || new Set(treeLocatorKeys).size !== treeLocatorKeys.length
    || actual.some((entry) =>
      !isUint64DecimalV2(entry.objectIdentity.device)
      || !isUint64DecimalV2(entry.objectIdentity.inode))
    || actual.slice(1).some((entry) =>
      globalLocatorKeys.has(filesystemObjectLocatorKeyV2(entry.objectIdentity)))
  ) return false;

  const [root, bin, launcher, lib, bundle, manifest, runtime, runtimeFile] = actual;
  if (
    !root || root.kind !== "directory"
    || !bin || bin.kind !== "directory"
    || !launcher || launcher.kind !== "file"
    || !lib || lib.kind !== "directory"
    || !bundle || bundle.kind !== "file"
    || !manifest || manifest.kind !== "file"
    || !runtime || runtime.kind !== "directory"
    || !runtimeFile || runtimeFile.kind !== "file"
  ) return false;

  const rootCapture = value.nodePhysicalProjection.orderedEntryCaptures.filter(
    (capture) => capture.classification.category === "package_root",
  );
  const memberships = expectedMembershipsV2(receipt);
  if (
    !sameCanonicalV2(root.membership, memberships[0])
    || !sameCanonicalV2(bin.membership, memberships[1])
    || !sameCanonicalV2(lib.membership, memberships[2])
    || !sameCanonicalV2(runtime.membership, memberships[3])
    || root.parentObjectIdentityHash !== rootCapture[0]?.parentObjectIdentityHash
    || bin.parentObjectIdentityHash !== root.objectIdentity.objectIdentityHash
    || lib.parentObjectIdentityHash !== root.objectIdentity.objectIdentityHash
    || runtime.parentObjectIdentityHash !== root.objectIdentity.objectIdentityHash
    || launcher.parentObjectIdentityHash !== bin.objectIdentity.objectIdentityHash
    || bundle.parentObjectIdentityHash !== lib.objectIdentity.objectIdentityHash
    || manifest.parentObjectIdentityHash !== root.objectIdentity.objectIdentityHash
    || runtimeFile.parentObjectIdentityHash !== runtime.objectIdentity.objectIdentityHash
    || actual.some((entry) => entry.objectIdentity.device !== root.objectIdentity.device)
  ) return false;

  for (const file of [launcher, bundle, manifest, runtimeFile]) {
    if (
      file.rawContentHash !== file.treeEntry.contentHash
      || file.fingerprint.byteLength !== file.treeEntry.byteLength
      || file.fingerprint.linkCount !== 1
    ) return false;
  }

  return rootCapture.length === 1
    && rootCapture[0]!.contentEvidence.kind === "directory_membership"
    && sameCanonicalV2(rootCapture[0]!.objectIdentity, active.packageRoot.objectIdentity)
    && sameCanonicalV2(rootCapture[0]!.fingerprint, active.packageRoot.fingerprint)
    && sameCanonicalV2(rootCapture[0]!.objectIdentity, root.objectIdentity)
    && sameCanonicalV2(rootCapture[0]!.fingerprint, root.fingerprint)
    && sameCanonicalV2(rootCapture[0]!.contentEvidence.membership, root.membership)
    && physicalDecimalMatchesSafeIntegerV2(
      root.objectIdentity.device,
      receipt.finalRoot.device,
    )
    && physicalDecimalMatchesSafeIntegerV2(
      root.objectIdentity.inode,
      receipt.finalRoot.inode,
    )
    && receipt.finalRoot.fileCount === 4
    && receipt.finalRoot.directoryCount === 4
    && receipt.finalRoot.totalBytes === [launcher, bundle, manifest, runtimeFile]
      .reduce((sum, entry) => sum + entry.fingerprint.byteLength, 0)
    && receipt.finalRoot.manifestHash === receipt.claim.intent.source.source.manifestHash
    && receipt.finalRoot.treeHash ===
      hashNodeToolchainProvisionerBootstrapInstalledTreeV2(receipt.claim.intent.source);
}

function validateSnapshotRelationsV2(value: SnapshotIdentityV2, context: z.RefinementCtx): void {
  const physical = value.nodePhysicalProjection;
  const logical = value.nodeLogicalProjection;
  const captures = physical.orderedEntryCaptures;
  const captureCategories = captures.map((capture) => capture.classification.category);
  const logicalCategories = logical.orderedEntries.map((entry) => entry.category);
  const lockCaptures = captures.filter((capture) => capture.classification.category === "package_lock");
  const physicalLocatorKeys = captures.map((capture) => filesystemObjectLocatorKeyV2(capture.objectIdentity));
  const expectedHistory = buildNodeToolchainProvisionerBootstrapRollbackHistoryV2(
    value.rollbackReceipts.map((evidence) => ({
      installationReceiptHash: evidence.value.removedGeneration.installationReceiptHash,
      rollbackReceiptHash: evidence.value.receiptHash,
      rollbackReceiptLocatorHash: evidence.value.receiptFile.locatorHash,
    })),
  );
  const rollbackCaptures = captures.filter(
    (capture) => capture.classification.category === "rollback_receipt",
  );
  const rollbackEvidenceOrdered = value.rollbackReceipts.every((evidence, index) =>
    index === 0 || value.rollbackReceipts[index - 1]!.classification.basename
      < evidence.classification.basename);
  const rollbackPredecessorCounts = value.rollbackReceipts.map(
    (evidence) => evidence.value.removedGeneration.predecessorRollbackReceiptCount,
  );
  const rollbackChronologyIsComplete =
    new Set(rollbackPredecessorCounts).size === value.rollbackReceipts.length
    && [...rollbackPredecessorCounts].sort((left, right) => left - right)
      .every((count, index) => count === index);
  const rollbackEvidenceMatches = value.rollbackReceipts.every((evidence, index) =>
    evidenceMatchesCaptureV2(evidence, "rollback_receipt")
    && sameCanonicalV2(evidence.entryCapture, rollbackCaptures[index])
    && evidence.entryCapture.fingerprint.ownerUid === value.expectedOwner.uid
    && evidence.entryCapture.fingerprint.ownerGid === value.expectedOwner.gid
    && evidence.value.receiptFile.ownerUid === value.expectedOwner.uid
    && evidence.value.receiptFile.ownerGid === value.expectedOwner.gid
    && evidence.value.admissionScope === "test_fixture"
    && evidence.classification.basename
      === `.setfarm-node-toolchain-provisioner-installation-v2.rollback.${evidence.value.removedGeneration.installationReceiptHash}.receipt.json`
    && evidence.rollbackBasenameBindingHash
      === hashNodeToolchainProvisionerBootstrapRollbackBasenameBindingV2({
        basename: evidence.classification.basename,
        rollbackReceiptHash: evidence.value.receiptHash,
        removedInstallationReceiptHash:
          evidence.value.removedGeneration.installationReceiptHash,
      })
    && sameCanonicalV2(
      evidence.value.claim.plan.installed.predecessorRollbackHistory,
      buildNodeToolchainProvisionerBootstrapRollbackHistoryV2(
        value.rollbackReceipts.filter((prior) =>
          prior.value.removedGeneration.predecessorRollbackReceiptCount
            < evidence.value.removedGeneration.predecessorRollbackReceiptCount)
          .map((prior) => ({
          installationReceiptHash:
            prior.value.removedGeneration.installationReceiptHash,
          rollbackReceiptHash: prior.value.receiptHash,
          rollbackReceiptLocatorHash: prior.value.receiptFile.locatorHash,
        })),
      ),
    ));

  const commonValid =
    value.filesystemScope.scopeIdentityHash === physical.orderedEntryCaptures[0]
      ?.objectIdentity.filesystemScopeIdentityHash
    && physical.packageRef === NODE_PACKAGE_REF_V2
    && logical.packageRef === NODE_PACKAGE_REF_V2
    && value.sourceLogicalCensusHash === physical.sourceLogicalCensusHash
    && value.sourcePhysicalCensusHash === physical.sourcePhysicalCensusHash
    && value.nodePhysicalProjectionHash === physical.projectionHash
    && value.liveObservationBinding.globalPhysicalCensusHash
      === value.sourcePhysicalCensusHash
    && value.liveObservationBinding.nodeRecursiveEvidenceHash
      === hashNodeToolchainProvisionerBootstrapRecursiveEvidenceV2({
        status: value.status,
        packageRoot: value.activeGeneration?.packageRoot ?? null,
        orderedTreeEntries: value.activeGeneration?.orderedTreeEntries ?? null,
      })
    && logical.entryCount === physical.entryCount
    && sameCanonicalV2(logical.orderedEntries, captures.map((capture) => capture.classification))
    && sameCanonicalV2(logicalCategories, captureCategories)
    && new Set(physicalLocatorKeys).size === physicalLocatorKeys.length
    && captures.every((capture) =>
      capture.objectIdentity.filesystemScopeIdentityHash === value.filesystemScope.scopeIdentityHash
      && isUint64DecimalV2(capture.objectIdentity.device)
      && isUint64DecimalV2(capture.objectIdentity.inode))
    && lockCaptures.length === 1
    && lockCaptures[0]!.contentEvidence.kind === "bounded_regular_file_bytes"
    && sameCanonicalV2(lockCaptures[0]!.objectIdentity, value.heldPackageLock.objectIdentity)
    && sameCanonicalV2(lockCaptures[0]!.fingerprint, value.heldPackageLock.fingerprint)
    && lockCaptures[0]!.contentEvidence.rawContentHash === value.heldPackageLock.rawContentHash
    && value.heldPackageLock.rawContentHash === EXPECTED_PACKAGE_LOCK_RAW_CONTENT_HASH_V2
    && value.heldPackageLock.objectIdentity.objectKind === "ordinary_file"
    && isUint64DecimalV2(value.heldPackageLock.objectIdentity.device)
    && isUint64DecimalV2(value.heldPackageLock.objectIdentity.inode)
    && value.heldPackageLock.fingerprint.objectIdentityHash
      === value.heldPackageLock.objectIdentity.objectIdentityHash
    && value.heldPackageLock.fingerprint.ownerUid === value.expectedOwner.uid
    && value.heldPackageLock.fingerprint.ownerGid === value.expectedOwner.gid
    && value.heldPackageLock.fingerprint.mode === "0600"
    && value.heldPackageLock.fingerprint.linkCount === 1
    && value.heldPackageLock.fingerprint.byteLength
      === Buffer.byteLength(
        NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_LOCK_CONTENT_V2,
        "utf8",
      )
    && rollbackEvidenceOrdered
    && rollbackChronologyIsComplete
    && rollbackEvidenceMatches
    && rollbackCaptures.length === value.rollbackReceipts.length
    && sameCanonicalV2(value.rollbackHistory, expectedHistory);

  let statusValid = false;
  if (value.status === "ready") {
    const claim = value.activeGeneration.claim;
    const receipt = value.activeGeneration.receipt;
    const categoryCount = (category: string) => captureCategories.filter((entry) => entry === category).length;
    statusValid =
      categoryCount("package_lock") === 1
      && categoryCount("package_root") === 1
      && categoryCount("active_claim") === 1
      && categoryCount("active_receipt") === 1
      && categoryCount("generation_staging") === 0
      && categoryCount("rollback_claim") === 0
      && evidenceMatchesCaptureV2(claim, "active_claim")
      && evidenceMatchesCaptureV2(receipt, "active_receipt")
      && claim.entryCapture.fingerprint.ownerUid === value.expectedOwner.uid
      && claim.entryCapture.fingerprint.ownerGid === value.expectedOwner.gid
      && receipt.entryCapture.fingerprint.ownerUid === value.expectedOwner.uid
      && receipt.entryCapture.fingerprint.ownerGid === value.expectedOwner.gid
      && claim.value.intent.admissionScope === "test_fixture"
      && claim.value.intent.target.expectedOwnerUid === value.expectedOwner.uid
      && claim.value.intent.target.expectedOwnerGid === value.expectedOwner.gid
      && receipt.value.admissionScope === "test_fixture"
      && sameCanonicalV2(receipt.value.claim, claim.value)
      && receipt.value.claim.claimHash === claim.value.claimHash
      && sameCanonicalV2(receipt.value.predecessorRollbackHistory, expectedHistory)
      && sameCanonicalV2(
        claim.entryCapture,
        captures.find((capture) => capture.classification.category === "active_claim"),
      )
      && sameCanonicalV2(
        receipt.entryCapture,
        captures.find((capture) => capture.classification.category === "active_receipt"),
      )
      && validateTreeV2(value);
  } else {
    statusValid = captureCategories.every((category) =>
      category === "package_lock" || category === "rollback_receipt");
  }

  if (!commonValid || !statusValid) {
    context.addIssue({
      code: "custom",
      message:
        "Node lifecycle semantic snapshot must exactly join its source projections, held lock, canonical artifacts, rollback history, and status-specific tree evidence",
    });
  }
}

const ValidatedSnapshotIdentityV2Schema = SnapshotIdentityV2Schema.superRefine(
  validateSnapshotRelationsV2,
);

const ReadySnapshotV2Schema = ReadySnapshotIdentityV2Schema.extend({
  snapshotHash: Sha256Schema,
}).strict();
const EmptySnapshotV2Schema = EmptySnapshotIdentityV2Schema.extend({
  snapshotHash: Sha256Schema,
}).strict();

export type NodeToolchainProvisionerBootstrapLifecycleSemanticSnapshotHashPayloadV2 =
  z.infer<typeof SnapshotIdentityV2Schema>;

export function hashNodeToolchainProvisionerBootstrapLifecycleSemanticSnapshotV2(
  value:
    | NodeToolchainProvisionerBootstrapLifecycleSemanticSnapshotHashPayloadV2
    | Readonly<Record<string, unknown>>,
): string {
  const snapshot = { ...value } as Record<string, unknown>;
  delete snapshot.snapshotHash;
  return hashCanonicalJson({
    schema: NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_LIFECYCLE_SEMANTIC_SNAPSHOT_HASH_V2_DOMAIN,
    snapshot,
  });
}

export const NodeToolchainProvisionerBootstrapLifecycleSemanticSnapshotV2Schema =
  z.discriminatedUnion("status", [ReadySnapshotV2Schema, EmptySnapshotV2Schema])
    .superRefine((value, context) => {
      validateSnapshotRelationsV2(value, context);
      if (
        !platformReleaseCandidateFitsCanonicalCapV2(
          value,
          NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_LIFECYCLE_SEMANTIC_SNAPSHOT_MAX_CANONICAL_BYTES_V2,
        )
        || value.snapshotHash
          !== hashNodeToolchainProvisionerBootstrapLifecycleSemanticSnapshotV2(value)
      ) {
        context.addIssue({
          code: "custom",
          path: ["snapshotHash"],
          message: "Node lifecycle semantic snapshot must fit its cap and bind every evidence field",
        });
      }
    });

export type NodeToolchainProvisionerBootstrapLifecycleSemanticSnapshotV2 = z.infer<
  typeof NodeToolchainProvisionerBootstrapLifecycleSemanticSnapshotV2Schema
>;

export function buildNodeToolchainProvisionerBootstrapLifecycleSemanticSnapshotV2(
  input: NodeToolchainProvisionerBootstrapLifecycleSemanticSnapshotHashPayloadV2,
): NodeToolchainProvisionerBootstrapLifecycleSemanticSnapshotV2 {
  const snapshot = boundedPlatformReleaseJsonSnapshotV2(
    input,
    NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_LIFECYCLE_SEMANTIC_SNAPSHOT_MAX_CANONICAL_BYTES_V2,
  );
  const identity = ValidatedSnapshotIdentityV2Schema.parse(snapshot);
  return parseNodeToolchainProvisionerBootstrapLifecycleSemanticSnapshotCandidateV2({
    ...identity,
    snapshotHash: hashNodeToolchainProvisionerBootstrapLifecycleSemanticSnapshotV2(identity),
  });
}

export function parseNodeToolchainProvisionerBootstrapLifecycleSemanticSnapshotCandidateV2(
  input: unknown,
): NodeToolchainProvisionerBootstrapLifecycleSemanticSnapshotV2 {
  const snapshot = boundedPlatformReleaseJsonSnapshotV2(
    input,
    NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_LIFECYCLE_SEMANTIC_SNAPSHOT_MAX_CANONICAL_BYTES_V2,
  );
  return deepFreezePlatformReleaseJsonV2(
    NodeToolchainProvisionerBootstrapLifecycleSemanticSnapshotV2Schema.parse(snapshot),
  );
}
