import { z } from "zod";

import { hashCanonicalJson } from "../canonical-json.js";
import { Sha256Schema } from "./common-v1.js";
import { NodeToolchainPrivateTreeReceiptV2Schema } from "./node-toolchain-private-tree-v2.js";

export const NODE_TOOLCHAIN_PROVISIONING_INTENT_V2_SCHEMA =
  "setfarm.node-toolchain-provisioning-intent.v2" as const;
export const NODE_TOOLCHAIN_PROVISIONING_CLAIM_V2_SCHEMA =
  "setfarm.node-toolchain-provisioning-claim.v2" as const;
export const NODE_TOOLCHAIN_PROVISIONING_RECEIPT_V2_SCHEMA =
  "setfarm.node-toolchain-provisioning-receipt.v2" as const;
export const NODE_TOOLCHAIN_PROVISIONING_VERSION_V2 = "2.0.0" as const;
export const NODE_TOOLCHAIN_PROVISIONING_AUTHORITY_REF_V2 =
  "AUTH_NODE_TOOLCHAIN_PROVISIONING_V2" as const;

const PosixIdentityV2Schema = z.number().int().nonnegative().max(4_294_967_294);
const FilesystemIdentityNumberV2Schema = z.number().int().nonnegative().safe();
const ArchitectureV2Schema = z.enum(["arm64", "x64"]);
const AdmissionScopeV2Schema = z.enum(["production_root", "test_fixture"]);
const TargetRefV2Schema = z.enum([
  "SETFARM_ROOT_NODE_22_23_1_NPM_10_9_8_ARM64_V2",
  "SETFARM_ROOT_NODE_22_23_1_NPM_10_9_8_X64_V2",
]);
const RootBasenameV2Schema = z.enum([
  "node-22.23.1-npm-10.9.8-darwin-arm64",
  "node-22.23.1-npm-10.9.8-darwin-x64",
]);
const ReceiptBasenameV2Schema = z.enum([
  "node-22.23.1-npm-10.9.8-darwin-arm64.provisioning-v2.json",
  "node-22.23.1-npm-10.9.8-darwin-x64.provisioning-v2.json",
]);

function targetMatchesArchitecture(value: Readonly<{
  architecture: "arm64" | "x64";
  targetRef: string;
  rootBasename: string;
  receiptBasename: string;
}>): boolean {
  const suffix = value.architecture === "arm64" ? "arm64" : "x64";
  const refSuffix = value.architecture === "arm64" ? "ARM64_V2" : "X64_V2";
  return value.targetRef.endsWith(refSuffix)
    && value.rootBasename.endsWith(suffix)
    && value.receiptBasename === `${value.rootBasename}.provisioning-v2.json`;
}

const NodeToolchainProvisioningIntentIdentityV2Schema = z.object({
  schema: z.literal(NODE_TOOLCHAIN_PROVISIONING_INTENT_V2_SCHEMA),
  intentVersion: z.literal(NODE_TOOLCHAIN_PROVISIONING_VERSION_V2),
  authorityRef: z.literal(NODE_TOOLCHAIN_PROVISIONING_AUTHORITY_REF_V2),
  admissionScope: AdmissionScopeV2Schema,
  architecture: ArchitectureV2Schema,
  source: z.object({
    privateTreeReceiptHash: Sha256Schema,
    distributionManifestHash: Sha256Schema,
    distributionArtifactHash: Sha256Schema,
    archiveSha256: Sha256Schema,
    treeHash: Sha256Schema,
  }).strict(),
  target: z.object({
    targetRef: TargetRefV2Schema,
    rootBasename: RootBasenameV2Schema,
    rootLocatorHash: Sha256Schema,
    receiptBasename: ReceiptBasenameV2Schema,
    receiptLocatorHash: Sha256Schema,
    parentLocatorHash: Sha256Schema,
  }).strict(),
  publication: z.object({
    serializationPolicy: z.literal("darwin_parent_descriptor_lockf_v2"),
    claimPolicy: z.literal("canonical_no_replace_claim_before_root_v2"),
    directoryPolicy: z.literal("exclusive_inaccessible_root_then_read_only_v2"),
    filePolicy: z.literal("same_filesystem_hard_link_no_replace_v2"),
    receiptPolicy: z.literal("canonical_no_replace_receipt_last_v2"),
    durabilityPolicy: z.literal("file_and_directory_fsync_v2"),
    recoveryPolicy: z.literal("exact_claim_bounded_rebuild_v2"),
    expectedOwnerUid: PosixIdentityV2Schema,
    expectedOwnerGid: PosixIdentityV2Schema,
    expectedRootMode: z.literal("0555"),
  }).strict(),
}).strict();

export type NodeToolchainProvisioningIntentHashPayloadV2 = z.infer<
  typeof NodeToolchainProvisioningIntentIdentityV2Schema
>;

export function hashNodeToolchainProvisioningIntentV2(
  value: NodeToolchainProvisioningIntentHashPayloadV2 | NodeToolchainProvisioningIntentV2,
): string {
  const intent = { ...value } as Record<string, unknown>;
  delete intent.intentHash;
  return hashCanonicalJson({
    schema: "setfarm.node-toolchain-provisioning-intent-hash.v2",
    intent,
  });
}

export const NodeToolchainProvisioningIntentV2Schema =
  NodeToolchainProvisioningIntentIdentityV2Schema.safeExtend({
    intentHash: Sha256Schema,
  }).strict().superRefine((value, context) => {
    if (!targetMatchesArchitecture({ architecture: value.architecture, ...value.target })) {
      context.addIssue({
        code: "custom",
        path: ["target"],
        message: "Provisioning target must be the exact architecture-specific code-owned target",
      });
    }
    if (
      (value.admissionScope === "production_root"
        && (value.publication.expectedOwnerUid !== 0 || value.publication.expectedOwnerGid !== 0))
      || value.intentHash !== hashNodeToolchainProvisioningIntentV2(value)
    ) {
      context.addIssue({
        code: "custom",
        message: "Provisioning intent owner or canonical hash is invalid",
      });
    }
  });

export type NodeToolchainProvisioningIntentV2 = z.infer<
  typeof NodeToolchainProvisioningIntentV2Schema
>;

const NodeToolchainProvisioningClaimIdentityV2Schema = z.object({
  schema: z.literal(NODE_TOOLCHAIN_PROVISIONING_CLAIM_V2_SCHEMA),
  claimVersion: z.literal(NODE_TOOLCHAIN_PROVISIONING_VERSION_V2),
  status: z.literal("preparing"),
  intent: NodeToolchainProvisioningIntentV2Schema,
}).strict();

export type NodeToolchainProvisioningClaimHashPayloadV2 = z.infer<
  typeof NodeToolchainProvisioningClaimIdentityV2Schema
>;

export function hashNodeToolchainProvisioningClaimV2(
  value: NodeToolchainProvisioningClaimHashPayloadV2 | NodeToolchainProvisioningClaimV2,
): string {
  const claim = { ...value } as Record<string, unknown>;
  delete claim.claimHash;
  return hashCanonicalJson({
    schema: "setfarm.node-toolchain-provisioning-claim-hash.v2",
    claim,
  });
}

export const NodeToolchainProvisioningClaimV2Schema =
  NodeToolchainProvisioningClaimIdentityV2Schema.safeExtend({
    claimHash: Sha256Schema,
  }).strict().superRefine((value, context) => {
    if (value.claimHash !== hashNodeToolchainProvisioningClaimV2(value)) {
      context.addIssue({ code: "custom", path: ["claimHash"], message: "Provisioning claim hash mismatch" });
    }
  });

export type NodeToolchainProvisioningClaimV2 = z.infer<
  typeof NodeToolchainProvisioningClaimV2Schema
>;

const ExactSystemToolV2Schema = z.object({
  toolRef: z.enum(["MACOS_LOCKF_V2", "MACOS_CAT_LOCK_HELPER_V2"]),
  contentHash: Sha256Schema,
  byteLength: z.number().int().positive().max(4 * 1024 * 1024),
  mode: z.literal("0755"),
  ownerUid: z.literal(0),
  ownerGid: PosixIdentityV2Schema,
  linkCount: z.literal(1),
}).strict();

const NodeToolchainProvisioningReceiptIdentityV2Schema = z.object({
  schema: z.literal(NODE_TOOLCHAIN_PROVISIONING_RECEIPT_V2_SCHEMA),
  receiptVersion: z.literal(NODE_TOOLCHAIN_PROVISIONING_VERSION_V2),
  authorityRef: z.literal(NODE_TOOLCHAIN_PROVISIONING_AUTHORITY_REF_V2),
  authorityVersion: z.literal(NODE_TOOLCHAIN_PROVISIONING_VERSION_V2),
  status: z.literal("provisioned_verified"),
  admissionScope: AdmissionScopeV2Schema,
  intent: NodeToolchainProvisioningIntentV2Schema,
  source: NodeToolchainPrivateTreeReceiptV2Schema,
  publisher: z.object({
    contractRef: z.literal("NODE_TOOLCHAIN_ROOT_PUBLISHER_V2"),
    lockExecutionPolicy: z.literal("exact_lockf_fd_then_exact_cat_pipe_v2"),
    lockf: ExactSystemToolV2Schema.extend({ toolRef: z.literal("MACOS_LOCKF_V2") }).strict(),
    lockHelper: ExactSystemToolV2Schema.extend({ toolRef: z.literal("MACOS_CAT_LOCK_HELPER_V2") }).strict(),
    claimHash: Sha256Schema,
  }).strict(),
  finalRoot: z.object({
    targetRef: TargetRefV2Schema,
    rootLocatorHash: Sha256Schema,
    device: FilesystemIdentityNumberV2Schema,
    inode: FilesystemIdentityNumberV2Schema,
    ownerUid: PosixIdentityV2Schema,
    ownerGid: PosixIdentityV2Schema,
    mode: z.literal("0555"),
    fileCount: z.number().int().positive().max(20_000),
    directoryCount: z.number().int().positive().max(5_000),
    totalBytes: z.number().int().positive().max(512 * 1024 * 1024),
    treeHash: Sha256Schema,
    nodeContentHash: Sha256Schema,
    npmTreeHash: Sha256Schema,
  }).strict(),
  receiptFile: z.object({
    receiptLocatorHash: Sha256Schema,
    mode: z.literal("0444"),
    ownerUid: PosixIdentityV2Schema,
    ownerGid: PosixIdentityV2Schema,
    linkCount: z.literal(1),
    publicationPolicy: z.literal("canonical_stage_hard_link_no_replace_fsync_v2"),
  }).strict(),
}).strict();

export type NodeToolchainProvisioningReceiptHashPayloadV2 = z.infer<
  typeof NodeToolchainProvisioningReceiptIdentityV2Schema
>;

export function hashNodeToolchainProvisioningReceiptV2(
  value: NodeToolchainProvisioningReceiptHashPayloadV2 | NodeToolchainProvisioningReceiptV2,
): string {
  const receipt = { ...value } as Record<string, unknown>;
  delete receipt.receiptHash;
  return hashCanonicalJson({
    schema: "setfarm.node-toolchain-provisioning-receipt-hash.v2",
    receipt,
  });
}

export const NodeToolchainProvisioningReceiptV2Schema =
  NodeToolchainProvisioningReceiptIdentityV2Schema.safeExtend({
    receiptHash: Sha256Schema,
  }).strict().superRefine((value, context) => {
    const source = value.source;
    const expectedClaimHash = hashNodeToolchainProvisioningClaimV2({
      schema: NODE_TOOLCHAIN_PROVISIONING_CLAIM_V2_SCHEMA,
      claimVersion: NODE_TOOLCHAIN_PROVISIONING_VERSION_V2,
      status: "preparing",
      intent: value.intent,
    });
    if (
      value.admissionScope !== value.intent.admissionScope
      || value.intent.architecture !== source.inventory.distribution.artifact.architecture
      || value.intent.source.privateTreeReceiptHash !== source.receiptHash
      || value.intent.source.distributionManifestHash !== source.inventory.distribution.manifest.manifestHash
      || value.intent.source.distributionArtifactHash !== source.inventory.distribution.artifact.artifactHash
      || value.intent.source.archiveSha256 !== source.inventory.distribution.archive.sha256
      || value.intent.source.treeHash !== source.tree.treeHash
      || (value.admissionScope === "production_root" && source.admissionScope !== "production_distribution")
      || (value.admissionScope === "test_fixture" && source.admissionScope !== "test_fixture")
    ) {
      context.addIssue({
        code: "custom",
        path: ["source"],
        message: "Provisioning receipt must join one exact private tree source and admission scope",
      });
    }
    if (
      value.publisher.claimHash !== expectedClaimHash
      || value.finalRoot.targetRef !== value.intent.target.targetRef
      || value.finalRoot.rootLocatorHash !== value.intent.target.rootLocatorHash
      || value.finalRoot.ownerUid !== value.intent.publication.expectedOwnerUid
      || value.finalRoot.ownerGid !== value.intent.publication.expectedOwnerGid
      || value.finalRoot.fileCount !== source.tree.fileCount
      || value.finalRoot.directoryCount !== source.tree.directoryCount
      || value.finalRoot.totalBytes !== source.tree.totalBytes
      || value.finalRoot.treeHash !== source.tree.treeHash
      || value.finalRoot.nodeContentHash !== source.tree.node.contentHash
      || value.finalRoot.npmTreeHash !== source.tree.npm.treeHash
      || value.receiptFile.receiptLocatorHash !== value.intent.target.receiptLocatorHash
      || value.receiptFile.ownerUid !== value.intent.publication.expectedOwnerUid
      || value.receiptFile.ownerGid !== value.intent.publication.expectedOwnerGid
    ) {
      context.addIssue({
        code: "custom",
        path: ["finalRoot"],
        message: "Final root and durable receipt must equal the exact provisioning intent and source tree",
      });
    }
    if (value.receiptHash !== hashNodeToolchainProvisioningReceiptV2(value)) {
      context.addIssue({
        code: "custom",
        path: ["receiptHash"],
        message: "Node toolchain provisioning receipt hash mismatch",
      });
    }
  });

export type NodeToolchainProvisioningReceiptV2 = z.infer<
  typeof NodeToolchainProvisioningReceiptV2Schema
>;
