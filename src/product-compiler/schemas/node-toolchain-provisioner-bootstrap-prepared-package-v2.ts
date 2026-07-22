import { z } from "zod";

import { hashCanonicalJson } from "../canonical-json.js";
import { GitObjectHashSchema, Sha256Schema } from "./common-v1.js";
import {
  NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_BUNDLE_LOCATOR_V2,
  NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_LAUNCHER_LOCATOR_V2,
  NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_MANIFEST_LOCATOR_V2,
  NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_ROOT_V2,
  NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_RUNTIME_LOCATOR_V2,
} from "./node-toolchain-provisioner-bootstrap-v2.js";

export const NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_PREPARED_PACKAGE_RECEIPT_V2_SCHEMA =
  "setfarm.node-toolchain-provisioner-bootstrap-prepared-package-receipt.v2" as const;
export const NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_PREPARED_PACKAGE_VERSION_V2 = "2.0.0" as const;
export const NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_PREPARED_PACKAGE_AUTHORITY_REF_V2 =
  "AUTH_NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_PREPARED_PACKAGE_V2" as const;

const PosixIdentityV2Schema = z.number().int().nonnegative().max(2_147_483_647);
const ByteLengthV2Schema = z.number().int().positive();
const PackageVersionV2Schema = z.string().min(1).max(100)
  .regex(/^[0-9]+\.[0-9]+\.[0-9]+(?:-[0-9A-Za-z.-]+)?$/);
const AbsoluteTargetRootV2Schema = z.string().min(1).max(1_024)
  .regex(/^\/(?:[A-Za-z0-9 ._+-]+\/)*[A-Za-z0-9._+-]+$/)
  .refine((value) => !value.includes("//") && !value.split("/").includes(".."), {
    message: "Prepared bootstrap target must be one normalized absolute locator",
  });

const PreparedMemberBaseV2Schema = z.object({
  sha256: Sha256Schema,
  byteLength: ByteLengthV2Schema,
  linkCount: z.literal(1),
}).strict();

const PreparedManifestMemberV2Schema = PreparedMemberBaseV2Schema.safeExtend({
  artifactRef: z.literal("NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_MANIFEST_V2"),
  locator: z.literal(NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_MANIFEST_LOCATOR_V2),
  mediaType: z.literal("application/json"),
  storageMode: z.literal("0400"),
  targetMode: z.literal("0444"),
}).strict();

const PreparedLauncherMemberV2Schema = PreparedMemberBaseV2Schema.safeExtend({
  artifactRef: z.literal("NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_LAUNCHER_V2"),
  locator: z.literal(NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_LAUNCHER_LOCATOR_V2),
  mediaType: z.literal("text/x-shellscript"),
  storageMode: z.literal("0500"),
  targetMode: z.literal("0555"),
}).strict();

const PreparedBundleMemberV2Schema = PreparedMemberBaseV2Schema.safeExtend({
  artifactRef: z.literal("NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_BUNDLE_V2"),
  locator: z.literal(NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_BUNDLE_LOCATOR_V2),
  mediaType: z.literal("application/javascript"),
  storageMode: z.literal("0400"),
  targetMode: z.literal("0444"),
}).strict();

const PreparedRuntimeMemberV2Schema = PreparedMemberBaseV2Schema.safeExtend({
  artifactRef: z.literal("NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_RUNTIME_V2"),
  locator: z.literal(NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_RUNTIME_LOCATOR_V2),
  mediaType: z.literal("application/x-mach-binary"),
  storageMode: z.literal("0500"),
  targetMode: z.literal("0555"),
}).strict();

const PreparedMembersV2Schema = z.object({
  manifest: PreparedManifestMemberV2Schema,
  launcher: PreparedLauncherMemberV2Schema,
  bundle: PreparedBundleMemberV2Schema,
  bootstrapRuntime: PreparedRuntimeMemberV2Schema,
}).strict();

const PreparedStorageIdentityV2Schema = z.object({
  ownerUid: PosixIdentityV2Schema,
  ownerGid: PosixIdentityV2Schema,
  rootMode: z.literal("0700"),
  directoryMode: z.literal("0700"),
  immutableFileMode: z.literal("0400"),
  executableFileMode: z.literal("0500"),
  linkPolicy: z.literal("regular_files_only_no_links_v2"),
  allowedDirectories: z.tuple([
    z.literal("."),
    z.literal("bin"),
    z.literal("lib"),
    z.literal("runtime"),
  ]),
  allowedRootEntries: z.tuple([
    z.literal(NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_MANIFEST_LOCATOR_V2),
    z.literal("bin"),
    z.literal("lib"),
    z.literal("runtime"),
  ]),
  fileCount: z.literal(4),
  directoryCount: z.literal(4),
  totalBytes: ByteLengthV2Schema,
  treeHash: Sha256Schema,
}).strict();

type PreparedTreeHashInputV2 = Readonly<{
  storage: z.infer<typeof PreparedStorageIdentityV2Schema>;
  members: z.infer<typeof PreparedMembersV2Schema>;
}>;

export function hashNodeToolchainProvisionerBootstrapPreparedTreeV2(
  value: PreparedTreeHashInputV2,
): string {
  const storage = { ...value.storage } as Record<string, unknown>;
  delete storage.treeHash;
  return hashCanonicalJson({
    schema: "setfarm.node-toolchain-provisioner-bootstrap-prepared-tree-hash.v2",
    storage,
    members: value.members,
  });
}

const PreparedReceiptIdentityV2Schema = z.object({
  schema: z.literal(NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_PREPARED_PACKAGE_RECEIPT_V2_SCHEMA),
  receiptVersion: z.literal(NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_PREPARED_PACKAGE_VERSION_V2),
  authorityRef: z.literal(NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_PREPARED_PACKAGE_AUTHORITY_REF_V2),
  admissionScope: z.enum(["production_release", "test_fixture"]),
  status: z.literal("prepared_payload_verified"),
  installationStatus: z.literal("not_installed_unprivileged_payload"),
  source: z.object({
    codeSha: GitObjectHashSchema,
    sourceTreeHash: GitObjectHashSchema,
    packageVersion: PackageVersionV2Schema,
    architecture: z.enum(["arm64", "x64"]),
    manifestHash: Sha256Schema,
    manifestSha256: Sha256Schema,
    manifestByteLength: ByteLengthV2Schema,
    buildContractHash: Sha256Schema,
    bundleAuthorityReceiptHash: Sha256Schema,
    launcherHash: Sha256Schema,
    launcherByteLength: ByteLengthV2Schema,
    bundleOutputHash: Sha256Schema,
    bundleOutputByteLength: ByteLengthV2Schema,
    privateTreeReceiptHash: Sha256Schema,
    privateTreeNodeHash: Sha256Schema,
    privateTreeNodeByteLength: ByteLengthV2Schema,
  }).strict(),
  target: z.object({
    rootLocator: AbsoluteTargetRootV2Schema,
    expectedOwnerUid: PosixIdentityV2Schema,
    expectedOwnerGid: PosixIdentityV2Schema,
    directoryMode: z.literal("0555"),
    manifestMode: z.literal("0444"),
    publicationPolicy: z.literal("root_owned_every_only_no_replace_fsync_manifest_last_v2"),
  }).strict(),
  storage: PreparedStorageIdentityV2Schema,
  members: PreparedMembersV2Schema,
  publication: z.object({
    policy: z.literal("exclusive_create_fsync_files_directories_manifest_last_v2"),
    manifestPublishedLast: z.literal(true),
    reopenedAfterPublication: z.literal(true),
    targetRootAccess: z.literal("none"),
  }).strict(),
}).strict();

export type NodeToolchainProvisionerBootstrapPreparedPackageReceiptHashPayloadV2 = z.infer<
  typeof PreparedReceiptIdentityV2Schema
>;

export function hashNodeToolchainProvisionerBootstrapPreparedPackageReceiptV2(
  value:
    | NodeToolchainProvisionerBootstrapPreparedPackageReceiptHashPayloadV2
    | NodeToolchainProvisionerBootstrapPreparedPackageReceiptV2,
): string {
  const receipt = { ...value } as Record<string, unknown>;
  delete receipt.receiptHash;
  return hashCanonicalJson({
    schema: "setfarm.node-toolchain-provisioner-bootstrap-prepared-package-receipt-hash.v2",
    receipt,
  });
}

export const NodeToolchainProvisionerBootstrapPreparedPackageReceiptV2Schema =
  PreparedReceiptIdentityV2Schema.safeExtend({
    receiptHash: Sha256Schema,
  }).strict().superRefine((value, context) => {
    const memberValues = [
      value.members.manifest,
      value.members.launcher,
      value.members.bundle,
      value.members.bootstrapRuntime,
    ];
    const runtime = value.members.bootstrapRuntime;
    const manifest = value.members.manifest;
    if (
      value.source.manifestSha256 !== manifest.sha256
      || value.source.manifestByteLength !== manifest.byteLength
      || value.source.launcherHash !== value.members.launcher.sha256
      || value.source.launcherByteLength !== value.members.launcher.byteLength
      || value.source.bundleOutputHash !== value.members.bundle.sha256
      || value.source.bundleOutputByteLength !== value.members.bundle.byteLength
      || value.source.privateTreeNodeHash !== runtime.sha256
      || value.source.privateTreeNodeByteLength !== runtime.byteLength
      || memberValues.reduce((sum, member) => sum + member.byteLength, 0)
        !== value.storage.totalBytes
      || value.storage.treeHash !== hashNodeToolchainProvisionerBootstrapPreparedTreeV2(value)
    ) {
      context.addIssue({
        code: "custom",
        message: "Prepared bootstrap storage must exactly bind its manifest, runtime and member tree",
      });
    }
    if (
      (value.admissionScope === "production_release"
        && (
          value.target.rootLocator !== NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_ROOT_V2
          || value.target.expectedOwnerUid !== 0
          || value.target.expectedOwnerGid !== 0
        ))
      || (value.admissionScope === "test_fixture"
        && value.target.rootLocator === NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_ROOT_V2)
    ) {
      context.addIssue({
        code: "custom",
        path: ["admissionScope"],
        message: "Prepared bootstrap scope must equal its future target without claiming installation",
      });
    }
    if (value.receiptHash !== hashNodeToolchainProvisionerBootstrapPreparedPackageReceiptV2(value)) {
      context.addIssue({
        code: "custom",
        path: ["receiptHash"],
        message: "Prepared bootstrap receipt hash must bind the complete payload identity",
      });
    }
  });

export type NodeToolchainProvisionerBootstrapPreparedPackageReceiptV2 = z.infer<
  typeof NodeToolchainProvisionerBootstrapPreparedPackageReceiptV2Schema
>;
