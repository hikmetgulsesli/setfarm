import { z } from "zod";

import { hashCanonicalJson } from "../canonical-json.js";
import { Sha256Schema } from "./common-v1.js";
import {
  NodeToolchainDistributionVerificationReceiptV2Schema,
} from "./node-toolchain-distribution-v2.js";

export const NODE_TOOLCHAIN_ARCHIVE_INVENTORY_RECEIPT_V2_SCHEMA =
  "setfarm.node-toolchain-archive-inventory-receipt.v2" as const;
export const NODE_TOOLCHAIN_ARCHIVE_INVENTORY_VERSION_V2 = "2.0.0" as const;
export const NODE_TOOLCHAIN_ARCHIVE_INVENTORY_AUTHORITY_REF_V2 =
  "AUTH_NODE_TOOLCHAIN_ARCHIVE_INVENTORY_V2" as const;
export const NODE_TOOLCHAIN_ARCHIVE_INVENTORY_MAX_MEMBERS_V2 = 20_000;
export const NODE_TOOLCHAIN_ARCHIVE_INVENTORY_MAX_LISTING_BYTES_V2 = 16 * 1024 * 1024;
export const NODE_TOOLCHAIN_ARCHIVE_INVENTORY_MAX_STDERR_BYTES_V2 = 16 * 1024;
export const NODE_TOOLCHAIN_ARCHIVE_INVENTORY_TIMEOUT_MS_V2 = 15_000;

const PosixIdentityV2Schema = z.number().int().nonnegative().max(4_294_967_294);
const CountV2Schema = z.number().int().nonnegative()
  .max(NODE_TOOLCHAIN_ARCHIVE_INVENTORY_MAX_MEMBERS_V2);

const NodeToolchainArchiveInventoryReceiptIdentityV2Schema = z.object({
  schema: z.literal(NODE_TOOLCHAIN_ARCHIVE_INVENTORY_RECEIPT_V2_SCHEMA),
  receiptVersion: z.literal(NODE_TOOLCHAIN_ARCHIVE_INVENTORY_VERSION_V2),
  authorityRef: z.literal(NODE_TOOLCHAIN_ARCHIVE_INVENTORY_AUTHORITY_REF_V2),
  authorityVersion: z.literal(NODE_TOOLCHAIN_ARCHIVE_INVENTORY_VERSION_V2),
  status: z.literal("inventoried_verified"),
  admissionScope: z.enum(["production_distribution", "test_fixture"]),
  distribution: NodeToolchainDistributionVerificationReceiptV2Schema,
  tarTool: z.object({
    toolRef: z.literal("MACOS_BSDTAR_V2"),
    executionPolicy: z.literal("direct_exact_path_deny_all_environment_v2"),
    contentHash: Sha256Schema,
    byteLength: z.number().int().positive().max(4 * 1024 * 1024),
    mode: z.literal("0755"),
    ownerUid: z.literal(0),
    ownerGid: PosixIdentityV2Schema,
    linkCount: z.literal(1),
  }).strict(),
  inventory: z.object({
    policy: z.literal("every_addressable_member_before_extraction_v2"),
    memberCount: z.number().int().positive()
      .max(NODE_TOOLCHAIN_ARCHIVE_INVENTORY_MAX_MEMBERS_V2),
    fileCount: CountV2Schema,
    directoryCount: CountV2Schema,
    symlinkCount: CountV2Schema,
    hardLinkCount: CountV2Schema,
    specialCount: CountV2Schema,
    inventoryHash: Sha256Schema,
  }).strict(),
  selected: z.object({
    policy: z.literal("exact_node_and_bundled_npm_v2"),
    nodeExecutableType: z.literal("file"),
    npmPackageRootType: z.literal("directory"),
    npmMemberCount: z.number().int().positive()
      .max(NODE_TOOLCHAIN_ARCHIVE_INVENTORY_MAX_MEMBERS_V2),
    npmClosureHash: Sha256Schema,
    npmCliType: z.literal("file"),
    packageJsonType: z.literal("file"),
    builtinNpmrcStatus: z.literal("absent"),
    unselectedPolicy: z.literal("inventory_then_discard_without_extraction_v2"),
    discardedUnselectedMemberCount: CountV2Schema,
    discardedUnselectedSymlinkCount: CountV2Schema,
  }).strict(),
}).strict();

export type NodeToolchainArchiveInventoryReceiptHashPayloadV2 = z.infer<
  typeof NodeToolchainArchiveInventoryReceiptIdentityV2Schema
>;

export function hashNodeToolchainArchiveInventoryReceiptV2(
  value:
    | NodeToolchainArchiveInventoryReceiptHashPayloadV2
    | NodeToolchainArchiveInventoryReceiptV2,
): string {
  const receipt = { ...value } as Record<string, unknown>;
  delete receipt.receiptHash;
  return hashCanonicalJson({
    schema: "setfarm.node-toolchain-archive-inventory-receipt-hash.v2",
    receipt,
  });
}

export const NodeToolchainArchiveInventoryReceiptV2Schema =
  NodeToolchainArchiveInventoryReceiptIdentityV2Schema.safeExtend({
    receiptHash: Sha256Schema,
  }).strict().superRefine((value, context) => {
    const countedMembers = value.inventory.fileCount
      + value.inventory.directoryCount
      + value.inventory.symlinkCount
      + value.inventory.hardLinkCount
      + value.inventory.specialCount;
    if (countedMembers !== value.inventory.memberCount) {
      context.addIssue({
        code: "custom",
        path: ["inventory", "memberCount"],
        message: "Archive inventory type counts must equal its exact member count",
      });
    }
    if (value.admissionScope !== value.distribution.admissionScope) {
      context.addIssue({
        code: "custom",
        path: ["admissionScope"],
        message: "Archive inventory scope must equal its authenticated distribution scope",
      });
    }
    if (
      value.selected.discardedUnselectedMemberCount >= value.inventory.memberCount
      || value.selected.discardedUnselectedSymlinkCount > value.inventory.symlinkCount
      || value.selected.discardedUnselectedSymlinkCount
        > value.selected.discardedUnselectedMemberCount
    ) {
      context.addIssue({
        code: "custom",
        path: ["selected"],
        message: "Discarded archive counts must remain inside the exact inventory bounds",
      });
    }
    if (value.receiptHash !== hashNodeToolchainArchiveInventoryReceiptV2(value)) {
      context.addIssue({
        code: "custom",
        path: ["receiptHash"],
        message: "Node archive inventory receipt hash must bind the exact receipt",
      });
    }
  });

export type NodeToolchainArchiveInventoryReceiptV2 = z.infer<
  typeof NodeToolchainArchiveInventoryReceiptV2Schema
>;
