import path from "node:path";

import { z } from "zod";

import { hashCanonicalJson } from "../canonical-json.js";
import { Sha256Schema } from "./common-v1.js";
import {
  NodeToolchainProvisionerBootstrapPreparedPackageReceiptV2Schema,
  type NodeToolchainProvisionerBootstrapPreparedPackageReceiptV2,
} from "./node-toolchain-provisioner-bootstrap-prepared-package-v2.js";

export const NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_INTENT_V2_SCHEMA =
  "setfarm.node-toolchain-provisioner-bootstrap-installation-intent.v2" as const;
export const NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_CLAIM_V2_SCHEMA =
  "setfarm.node-toolchain-provisioner-bootstrap-installation-claim.v2" as const;
export const NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_RECEIPT_V2_SCHEMA =
  "setfarm.node-toolchain-provisioner-bootstrap-installation-receipt.v2" as const;
export const NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_VERSION_V2 = "2.0.0" as const;
export const NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_AUTHORITY_REF_V2 =
  "AUTH_NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_V2" as const;

export const NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_RECEIPT_BASENAME_V2 =
  "node-toolchain-provisioner-v2.installation-receipt.v2.json" as const;
export const NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_CLAIM_BASENAME_V2 =
  ".setfarm-node-toolchain-provisioner-installation-v2.claim.json" as const;
export const NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_LOCK_BASENAME_V2 =
  ".setfarm-node-toolchain-provisioner-installation-v2.lock" as const;
export const NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_LOCK_CONTENT_V2 =
  "setfarm.node-toolchain-provisioner-bootstrap-installation-lock.v2\n" as const;
export const NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_STAGING_PREFIX_V2 =
  ".setfarm-node-toolchain-provisioner-installation-v2.staging" as const;
export const NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_CLAIM_STAGE_BASENAME_V2 =
  "installation-claim.v2.json.stage" as const;
export const NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_RECEIPT_STAGE_BASENAME_V2 =
  "installation-receipt.v2.json.stage" as const;
export const NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_PAYLOAD_STAGE_BASENAME_V2 =
  "payload" as const;
export const NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_SYSTEM_ANCESTOR_V2 =
  "/Library/Application Support" as const;
export const NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_SETFARM_ROOT_V2 =
  "/Library/Application Support/Setfarm" as const;

export type NodeToolchainProvisionerBootstrapInstallationLocatorRoleV2 =
  | "systemAncestor"
  | "setfarmRoot"
  | "parent"
  | "root"
  | "receipt"
  | "claim"
  | "lock"
  | "staging";

export function hashNodeToolchainProvisionerBootstrapInstallationLocatorV2(
  role: NodeToolchainProvisionerBootstrapInstallationLocatorRoleV2,
  absoluteLocator: string,
): string {
  if (
    !path.isAbsolute(absoluteLocator)
    || path.normalize(absoluteLocator) !== absoluteLocator
    || absoluteLocator.includes("\0")
  ) {
    throw new TypeError("Bootstrap installation locator must be one normalized absolute path");
  }
  return hashCanonicalJson({
    schema: "setfarm.node-toolchain-provisioner-bootstrap-installation-locator-hash.v2",
    role,
    absoluteLocator,
  });
}

export type NodeToolchainProvisionerBootstrapInstallationPathsV2 = Readonly<{
  systemAncestor: string;
  setfarmRoot: string;
  parent: string;
  root: string;
  receipt: string;
  claim: string;
  lock: string;
  staging: string;
}>;

export function getNodeToolchainProvisionerBootstrapInstallationPathsV2(
  source: NodeToolchainProvisionerBootstrapPreparedPackageReceiptV2,
): NodeToolchainProvisionerBootstrapInstallationPathsV2 {
  const parsed = NodeToolchainProvisionerBootstrapPreparedPackageReceiptV2Schema.parse(source);
  const root = parsed.target.rootLocator;
  const parent = path.dirname(root);
  const production = parsed.admissionScope === "production_release";
  return Object.freeze({
    systemAncestor: production
      ? NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_SYSTEM_ANCESTOR_V2
      : parent,
    setfarmRoot: production
      ? NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_SETFARM_ROOT_V2
      : parent,
    parent,
    root,
    receipt: path.join(
      parent,
      NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_RECEIPT_BASENAME_V2,
    ),
    claim: path.join(
      parent,
      NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_CLAIM_BASENAME_V2,
    ),
    lock: path.join(
      parent,
      NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_LOCK_BASENAME_V2,
    ),
    staging: path.join(
      parent,
      `${NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_STAGING_PREFIX_V2}.${parsed.receiptHash}`,
    ),
  });
}

const PosixIdentityV2Schema = z.number().int().nonnegative().max(2_147_483_647);
const FilesystemIdentityV2Schema = z.number().int().nonnegative().safe();
const AdmissionScopeV2Schema = z.enum(["production_release", "test_fixture"]);
const ArchitectureV2Schema = z.enum(["arm64", "x64"]);

const InstallationTargetV2Schema = z.object({
  rootBasename: z.literal("node-toolchain-provisioner-v2"),
  receiptBasename: z.literal(
    NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_RECEIPT_BASENAME_V2,
  ),
  claimBasename: z.literal(NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_CLAIM_BASENAME_V2),
  lockBasename: z.literal(NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_LOCK_BASENAME_V2),
  stagingBasename: z.string().regex(
    /^\.setfarm-node-toolchain-provisioner-installation-v2\.staging\.[a-f0-9]{64}$/,
  ),
  rootLocatorHash: Sha256Schema,
  parentLocatorHash: Sha256Schema,
  setfarmRootLocatorHash: Sha256Schema,
  systemAncestorLocatorHash: Sha256Schema,
  receiptLocatorHash: Sha256Schema,
  claimLocatorHash: Sha256Schema,
  lockLocatorHash: Sha256Schema,
  stagingLocatorHash: Sha256Schema,
  expectedOwnerUid: PosixIdentityV2Schema,
  expectedOwnerGid: PosixIdentityV2Schema,
}).strict();

const InstallationPublicationV2Schema = z.object({
  serializationPolicy: z.literal("darwin_parent_descriptor_lockf_v2"),
  claimPolicy: z.literal("canonical_no_replace_claim_before_root_v2"),
  rootPolicy: z.literal("exclusive_inaccessible_root_then_read_only_v2"),
  filePolicy: z.literal("exclusive_copy_then_same_filesystem_hard_link_no_replace_v2"),
  manifestPolicy: z.literal("manifest_last_v2"),
  receiptPolicy: z.literal("canonical_no_replace_receipt_after_verified_root_v2"),
  durabilityPolicy: z.literal("file_and_directory_fsync_v2"),
  recoveryPolicy: z.literal("exact_claim_bounded_rebuild_v2"),
  expectedRootMode: z.literal("0555"),
  expectedDirectoryMode: z.literal("0555"),
  expectedManifestMode: z.literal("0444"),
}).strict();

function expectedTarget(
  source: NodeToolchainProvisionerBootstrapPreparedPackageReceiptV2,
): z.infer<typeof InstallationTargetV2Schema> {
  const paths = getNodeToolchainProvisionerBootstrapInstallationPathsV2(source);
  return {
    rootBasename: path.basename(paths.root) as "node-toolchain-provisioner-v2",
    receiptBasename: NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_RECEIPT_BASENAME_V2,
    claimBasename: NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_CLAIM_BASENAME_V2,
    lockBasename: NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_LOCK_BASENAME_V2,
    stagingBasename: path.basename(paths.staging),
    rootLocatorHash: hashNodeToolchainProvisionerBootstrapInstallationLocatorV2(
      "root",
      paths.root,
    ),
    parentLocatorHash: hashNodeToolchainProvisionerBootstrapInstallationLocatorV2(
      "parent",
      paths.parent,
    ),
    setfarmRootLocatorHash: hashNodeToolchainProvisionerBootstrapInstallationLocatorV2(
      "setfarmRoot",
      paths.setfarmRoot,
    ),
    systemAncestorLocatorHash: hashNodeToolchainProvisionerBootstrapInstallationLocatorV2(
      "systemAncestor",
      paths.systemAncestor,
    ),
    receiptLocatorHash: hashNodeToolchainProvisionerBootstrapInstallationLocatorV2(
      "receipt",
      paths.receipt,
    ),
    claimLocatorHash: hashNodeToolchainProvisionerBootstrapInstallationLocatorV2(
      "claim",
      paths.claim,
    ),
    lockLocatorHash: hashNodeToolchainProvisionerBootstrapInstallationLocatorV2(
      "lock",
      paths.lock,
    ),
    stagingLocatorHash: hashNodeToolchainProvisionerBootstrapInstallationLocatorV2(
      "staging",
      paths.staging,
    ),
    expectedOwnerUid: source.target.expectedOwnerUid,
    expectedOwnerGid: source.target.expectedOwnerGid,
  };
}

const InstallationIntentIdentityV2Schema = z.object({
  schema: z.literal(NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_INTENT_V2_SCHEMA),
  intentVersion: z.literal(NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_VERSION_V2),
  authorityRef: z.literal(NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_AUTHORITY_REF_V2),
  admissionScope: AdmissionScopeV2Schema,
  architecture: ArchitectureV2Schema,
  source: NodeToolchainProvisionerBootstrapPreparedPackageReceiptV2Schema,
  target: InstallationTargetV2Schema,
  publication: InstallationPublicationV2Schema,
}).strict();

export type NodeToolchainProvisionerBootstrapInstallationIntentHashPayloadV2 = z.infer<
  typeof InstallationIntentIdentityV2Schema
>;

export function hashNodeToolchainProvisionerBootstrapInstallationIntentV2(
  value:
    | NodeToolchainProvisionerBootstrapInstallationIntentHashPayloadV2
    | NodeToolchainProvisionerBootstrapInstallationIntentV2,
): string {
  const intent = { ...value } as Record<string, unknown>;
  delete intent.intentHash;
  return hashCanonicalJson({
    schema: "setfarm.node-toolchain-provisioner-bootstrap-installation-intent-hash.v2",
    intent,
  });
}

export const NodeToolchainProvisionerBootstrapInstallationIntentV2Schema =
  InstallationIntentIdentityV2Schema.safeExtend({
    intentHash: Sha256Schema,
  }).strict().superRefine((value, context) => {
    const target = expectedTarget(value.source);
    if (
      value.admissionScope !== value.source.admissionScope
      || value.architecture !== value.source.source.architecture
      || Object.entries(target).some(([key, expected]) =>
        value.target[key as keyof typeof target] !== expected)
      || (value.admissionScope === "production_release"
        && (value.target.expectedOwnerUid !== 0 || value.target.expectedOwnerGid !== 0))
      || value.intentHash !== hashNodeToolchainProvisionerBootstrapInstallationIntentV2(value)
    ) {
      context.addIssue({
        code: "custom",
        message: "Bootstrap installation intent must equal one prepared source and fixed target",
      });
    }
  });

export type NodeToolchainProvisionerBootstrapInstallationIntentV2 = z.infer<
  typeof NodeToolchainProvisionerBootstrapInstallationIntentV2Schema
>;

export function buildNodeToolchainProvisionerBootstrapInstallationIntentV2(
  source: NodeToolchainProvisionerBootstrapPreparedPackageReceiptV2,
): NodeToolchainProvisionerBootstrapInstallationIntentV2 {
  const parsedSource = NodeToolchainProvisionerBootstrapPreparedPackageReceiptV2Schema.parse(source);
  const identity: NodeToolchainProvisionerBootstrapInstallationIntentHashPayloadV2 = {
    schema: NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_INTENT_V2_SCHEMA,
    intentVersion: NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_VERSION_V2,
    authorityRef: NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_AUTHORITY_REF_V2,
    admissionScope: parsedSource.admissionScope,
    architecture: parsedSource.source.architecture,
    source: parsedSource,
    target: expectedTarget(parsedSource),
    publication: {
      serializationPolicy: "darwin_parent_descriptor_lockf_v2",
      claimPolicy: "canonical_no_replace_claim_before_root_v2",
      rootPolicy: "exclusive_inaccessible_root_then_read_only_v2",
      filePolicy: "exclusive_copy_then_same_filesystem_hard_link_no_replace_v2",
      manifestPolicy: "manifest_last_v2",
      receiptPolicy: "canonical_no_replace_receipt_after_verified_root_v2",
      durabilityPolicy: "file_and_directory_fsync_v2",
      recoveryPolicy: "exact_claim_bounded_rebuild_v2",
      expectedRootMode: "0555",
      expectedDirectoryMode: "0555",
      expectedManifestMode: "0444",
    },
  };
  return NodeToolchainProvisionerBootstrapInstallationIntentV2Schema.parse({
    ...identity,
    intentHash: hashNodeToolchainProvisionerBootstrapInstallationIntentV2(identity),
  });
}

const InstallationClaimIdentityV2Schema = z.object({
  schema: z.literal(NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_CLAIM_V2_SCHEMA),
  claimVersion: z.literal(NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_VERSION_V2),
  status: z.literal("preparing"),
  intent: NodeToolchainProvisionerBootstrapInstallationIntentV2Schema,
}).strict();

export type NodeToolchainProvisionerBootstrapInstallationClaimHashPayloadV2 = z.infer<
  typeof InstallationClaimIdentityV2Schema
>;

export function hashNodeToolchainProvisionerBootstrapInstallationClaimV2(
  value:
    | NodeToolchainProvisionerBootstrapInstallationClaimHashPayloadV2
    | NodeToolchainProvisionerBootstrapInstallationClaimV2,
): string {
  const claim = { ...value } as Record<string, unknown>;
  delete claim.claimHash;
  return hashCanonicalJson({
    schema: "setfarm.node-toolchain-provisioner-bootstrap-installation-claim-hash.v2",
    claim,
  });
}

export const NodeToolchainProvisionerBootstrapInstallationClaimV2Schema =
  InstallationClaimIdentityV2Schema.safeExtend({
    claimHash: Sha256Schema,
  }).strict().superRefine((value, context) => {
    if (value.claimHash !== hashNodeToolchainProvisionerBootstrapInstallationClaimV2(value)) {
      context.addIssue({
        code: "custom",
        path: ["claimHash"],
        message: "Bootstrap installation claim hash mismatch",
      });
    }
  });

export type NodeToolchainProvisionerBootstrapInstallationClaimV2 = z.infer<
  typeof NodeToolchainProvisionerBootstrapInstallationClaimV2Schema
>;

export function buildNodeToolchainProvisionerBootstrapInstallationClaimV2(
  intent: NodeToolchainProvisionerBootstrapInstallationIntentV2,
): NodeToolchainProvisionerBootstrapInstallationClaimV2 {
  const parsedIntent = NodeToolchainProvisionerBootstrapInstallationIntentV2Schema.parse(intent);
  const identity: NodeToolchainProvisionerBootstrapInstallationClaimHashPayloadV2 = {
    schema: NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_CLAIM_V2_SCHEMA,
    claimVersion: NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_VERSION_V2,
    status: "preparing",
    intent: parsedIntent,
  };
  return NodeToolchainProvisionerBootstrapInstallationClaimV2Schema.parse({
    ...identity,
    claimHash: hashNodeToolchainProvisionerBootstrapInstallationClaimV2(identity),
  });
}

export function hashNodeToolchainProvisionerBootstrapInstalledTreeV2(
  source: NodeToolchainProvisionerBootstrapPreparedPackageReceiptV2,
): string {
  const parsed = NodeToolchainProvisionerBootstrapPreparedPackageReceiptV2Schema.parse(source);
  return hashCanonicalJson({
    schema: "setfarm.node-toolchain-provisioner-bootstrap-installed-tree.v2",
    directories: [".", "bin", "lib", "runtime"].map((locator) => ({
      locator,
      mode: "0555",
      ownerUid: parsed.target.expectedOwnerUid,
      ownerGid: parsed.target.expectedOwnerGid,
    })),
    files: [
      parsed.members.manifest,
      parsed.members.launcher,
      parsed.members.bundle,
      parsed.members.bootstrapRuntime,
    ].map((member) => ({
      locator: member.locator,
      sha256: member.sha256,
      byteLength: member.byteLength,
      mode: member.targetMode,
      ownerUid: parsed.target.expectedOwnerUid,
      ownerGid: parsed.target.expectedOwnerGid,
      linkCount: 1,
    })),
  });
}

const ExactSystemToolV2Schema = z.object({
  toolRef: z.enum(["MACOS_LOCKF_V2", "MACOS_CAT_LOCK_HELPER_V2"]),
  contentHash: Sha256Schema,
  byteLength: z.number().int().positive().max(4 * 1024 * 1024),
  mode: z.literal("0755"),
  ownerUid: z.literal(0),
  ownerGid: PosixIdentityV2Schema,
  linkCount: z.literal(1),
}).strict();

export const NodeToolchainProvisionerBootstrapRollbackHistoryEntryV2Schema = z.object({
  installationReceiptHash: Sha256Schema,
  rollbackReceiptHash: Sha256Schema,
  rollbackReceiptLocatorHash: Sha256Schema,
}).strict();

export type NodeToolchainProvisionerBootstrapRollbackHistoryEntryV2 = z.infer<
  typeof NodeToolchainProvisionerBootstrapRollbackHistoryEntryV2Schema
>;

export const NodeToolchainProvisionerBootstrapRollbackHistoryV2Schema = z.object({
  receiptCount: z.number().int().nonnegative().max(1_000_000),
  historyHash: Sha256Schema,
}).strict();

export type NodeToolchainProvisionerBootstrapRollbackHistoryV2 = z.infer<
  typeof NodeToolchainProvisionerBootstrapRollbackHistoryV2Schema
>;

export function buildNodeToolchainProvisionerBootstrapRollbackHistoryV2(
  input: readonly NodeToolchainProvisionerBootstrapRollbackHistoryEntryV2[],
): NodeToolchainProvisionerBootstrapRollbackHistoryV2 {
  const entries = input
    .map((entry) => NodeToolchainProvisionerBootstrapRollbackHistoryEntryV2Schema.parse(entry))
    .sort((left, right) =>
      left.rollbackReceiptLocatorHash < right.rollbackReceiptLocatorHash
        ? -1
        : left.rollbackReceiptLocatorHash > right.rollbackReceiptLocatorHash
          ? 1
          : 0);
  if (
    new Set(entries.map((entry) => entry.rollbackReceiptLocatorHash)).size !== entries.length
    || new Set(entries.map((entry) => entry.rollbackReceiptHash)).size !== entries.length
    || new Set(entries.map((entry) => entry.installationReceiptHash)).size !== entries.length
  ) {
    throw new TypeError("Bootstrap rollback history entries must identify unique generations");
  }
  return NodeToolchainProvisionerBootstrapRollbackHistoryV2Schema.parse({
    receiptCount: entries.length,
    historyHash: hashCanonicalJson({
      schema: "setfarm.node-toolchain-provisioner-bootstrap-rollback-history.v2",
      entries,
    }),
  });
}

const InstallationReceiptIdentityV2Schema = z.object({
  schema: z.literal(NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_RECEIPT_V2_SCHEMA),
  receiptVersion: z.literal(NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_VERSION_V2),
  authorityRef: z.literal(NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_AUTHORITY_REF_V2),
  status: z.literal("installed_verified"),
  admissionScope: AdmissionScopeV2Schema,
  claim: NodeToolchainProvisionerBootstrapInstallationClaimV2Schema,
  predecessorRollbackHistory: NodeToolchainProvisionerBootstrapRollbackHistoryV2Schema,
  publisher: z.object({
    contractRef: z.literal("NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLER_V2"),
    lockExecutionPolicy: z.literal("exact_lockf_fd_then_exact_cat_pipe_v2"),
    lockf: ExactSystemToolV2Schema.extend({ toolRef: z.literal("MACOS_LOCKF_V2") }).strict(),
    lockHelper: ExactSystemToolV2Schema.extend({
      toolRef: z.literal("MACOS_CAT_LOCK_HELPER_V2"),
    }).strict(),
  }).strict(),
  finalRoot: z.object({
    rootLocatorHash: Sha256Schema,
    manifestHash: Sha256Schema,
    architecture: ArchitectureV2Schema,
    device: FilesystemIdentityV2Schema,
    inode: FilesystemIdentityV2Schema,
    ownerUid: PosixIdentityV2Schema,
    ownerGid: PosixIdentityV2Schema,
    mode: z.literal("0555"),
    fileCount: z.literal(4),
    directoryCount: z.literal(4),
    totalBytes: z.number().int().positive().max(256 * 1024 * 1024),
    treeHash: Sha256Schema,
  }).strict(),
  claimFile: z.object({
    locatorHash: Sha256Schema,
    mode: z.literal("0444"),
    ownerUid: PosixIdentityV2Schema,
    ownerGid: PosixIdentityV2Schema,
    linkCount: z.literal(1),
  }).strict(),
  receiptFile: z.object({
    locatorHash: Sha256Schema,
    mode: z.literal("0444"),
    ownerUid: PosixIdentityV2Schema,
    ownerGid: PosixIdentityV2Schema,
    linkCount: z.literal(1),
    publicationPolicy: z.literal("canonical_stage_hard_link_no_replace_fsync_v2"),
  }).strict(),
}).strict();

export type NodeToolchainProvisionerBootstrapInstallationReceiptHashPayloadV2 = z.infer<
  typeof InstallationReceiptIdentityV2Schema
>;

export function hashNodeToolchainProvisionerBootstrapInstallationReceiptV2(
  value:
    | NodeToolchainProvisionerBootstrapInstallationReceiptHashPayloadV2
    | NodeToolchainProvisionerBootstrapInstallationReceiptV2,
): string {
  const receipt = { ...value } as Record<string, unknown>;
  delete receipt.receiptHash;
  return hashCanonicalJson({
    schema: "setfarm.node-toolchain-provisioner-bootstrap-installation-receipt-hash.v2",
    receipt,
  });
}

export const NodeToolchainProvisionerBootstrapInstallationReceiptV2Schema =
  InstallationReceiptIdentityV2Schema.safeExtend({
    receiptHash: Sha256Schema,
  }).strict().superRefine((value, context) => {
    const intent = value.claim.intent;
    const source = intent.source;
    if (
      value.admissionScope !== intent.admissionScope
      || value.finalRoot.rootLocatorHash !== intent.target.rootLocatorHash
      || value.finalRoot.manifestHash !== source.source.manifestHash
      || value.finalRoot.architecture !== intent.architecture
      || value.finalRoot.ownerUid !== intent.target.expectedOwnerUid
      || value.finalRoot.ownerGid !== intent.target.expectedOwnerGid
      || value.finalRoot.totalBytes !== source.storage.totalBytes
      || value.finalRoot.treeHash !== hashNodeToolchainProvisionerBootstrapInstalledTreeV2(source)
      || value.claimFile.locatorHash !== intent.target.claimLocatorHash
      || value.claimFile.ownerUid !== intent.target.expectedOwnerUid
      || value.claimFile.ownerGid !== intent.target.expectedOwnerGid
      || value.receiptFile.locatorHash !== intent.target.receiptLocatorHash
      || value.receiptFile.ownerUid !== intent.target.expectedOwnerUid
      || value.receiptFile.ownerGid !== intent.target.expectedOwnerGid
      || value.receiptHash !== hashNodeToolchainProvisionerBootstrapInstallationReceiptV2(value)
    ) {
      context.addIssue({
        code: "custom",
        message: "Bootstrap installation receipt must equal its claim, source and installed root",
      });
    }
  });

export type NodeToolchainProvisionerBootstrapInstallationReceiptV2 = z.infer<
  typeof NodeToolchainProvisionerBootstrapInstallationReceiptV2Schema
>;
