import { z } from "zod";

import { hashCanonicalJson } from "../canonical-json.js";
import { Sha256Schema } from "./common-v1.js";
import {
  NodeToolchainArchiveInventoryReceiptV2Schema,
} from "./node-toolchain-archive-inventory-v2.js";

export const NODE_TOOLCHAIN_PRIVATE_TREE_RECEIPT_V2_SCHEMA =
  "setfarm.node-toolchain-private-tree-receipt.v2" as const;
export const NODE_TOOLCHAIN_PRIVATE_TREE_VERSION_V2 = "2.0.0" as const;
export const NODE_TOOLCHAIN_PRIVATE_TREE_AUTHORITY_REF_V2 =
  "AUTH_NODE_TOOLCHAIN_PRIVATE_TREE_V2" as const;
export const NODE_TOOLCHAIN_PRIVATE_TREE_MAX_FILES_V2 = 20_000;
export const NODE_TOOLCHAIN_PRIVATE_TREE_MAX_DIRECTORIES_V2 = 5_000;
export const NODE_TOOLCHAIN_PRIVATE_TREE_MAX_TOTAL_BYTES_V2 = 512 * 1024 * 1024;
export const NODE_TOOLCHAIN_PRIVATE_TREE_EXTRACT_TIMEOUT_MS_V2 = 30_000;
export const NODE_TOOLCHAIN_PRIVATE_TREE_EXTRACT_MAX_STDOUT_BYTES_V2 = 4_096;
export const NODE_TOOLCHAIN_PRIVATE_TREE_EXTRACT_MAX_STDERR_BYTES_V2 = 16 * 1024;

const FileCountV2Schema = z.number().int().nonnegative()
  .max(NODE_TOOLCHAIN_PRIVATE_TREE_MAX_FILES_V2);
const DirectoryCountV2Schema = z.number().int().nonnegative()
  .max(NODE_TOOLCHAIN_PRIVATE_TREE_MAX_DIRECTORIES_V2);
const TotalBytesV2Schema = z.number().int().nonnegative()
  .max(NODE_TOOLCHAIN_PRIVATE_TREE_MAX_TOTAL_BYTES_V2);

export const NodeToolchainPrivateTreeExactFileV2Schema = z.object({
  contentHash: Sha256Schema,
  byteLength: z.number().int().nonnegative()
    .max(NODE_TOOLCHAIN_PRIVATE_TREE_MAX_TOTAL_BYTES_V2),
  mode: z.enum(["0444", "0555"]),
  linkCount: z.literal(1),
}).strict();

const NodeToolchainPrivateTreeReceiptIdentityV2Schema = z.object({
  schema: z.literal(NODE_TOOLCHAIN_PRIVATE_TREE_RECEIPT_V2_SCHEMA),
  receiptVersion: z.literal(NODE_TOOLCHAIN_PRIVATE_TREE_VERSION_V2),
  authorityRef: z.literal(NODE_TOOLCHAIN_PRIVATE_TREE_AUTHORITY_REF_V2),
  authorityVersion: z.literal(NODE_TOOLCHAIN_PRIVATE_TREE_VERSION_V2),
  status: z.literal("materialized_verified"),
  admissionScope: z.enum(["production_distribution", "test_fixture"]),
  inventory: NodeToolchainArchiveInventoryReceiptV2Schema,
  materializer: z.object({
    contractRef: z.literal("NODE_TOOLCHAIN_SELECTED_PRIVATE_MATERIALIZER_V2"),
    extractionToolRef: z.literal("MACOS_BSDTAR_V2"),
    extractionToolContentHash: Sha256Schema,
    extractionPolicy: z.literal("nul_exact_member_list_no_recursion_private_scratch_v2"),
    selectedMemberCount: z.number().int().positive().max(20_000),
    selectedMemberListHash: Sha256Schema,
    normalizationPolicy: z.literal("exclusive_copy_0444_0555_fsync_fresh_read_v2"),
    filesystemProtection: z.literal("private_0700_parent_process_owned_v2"),
  }).strict(),
  tree: z.object({
    rootMode: z.literal("0555"),
    fileCount: FileCountV2Schema.refine((value) => value > 0),
    directoryCount: DirectoryCountV2Schema.refine((value) => value > 0),
    totalBytes: TotalBytesV2Schema.refine((value) => value > 0),
    treeHash: Sha256Schema,
    node: NodeToolchainPrivateTreeExactFileV2Schema.extend({
      locator: z.literal("bin/node"),
      mode: z.literal("0555"),
    }).strict(),
    npm: z.object({
      rootLocator: z.literal("lib/node_modules/npm"),
      rootMode: z.literal("0555"),
      fileCount: FileCountV2Schema.refine((value) => value > 0),
      directoryCount: DirectoryCountV2Schema,
      totalBytes: TotalBytesV2Schema.refine((value) => value > 0),
      treeHash: Sha256Schema,
      cli: NodeToolchainPrivateTreeExactFileV2Schema.extend({
        locator: z.literal("bin/npm-cli.js"),
        mode: z.literal("0555"),
      }).strict(),
      packageJson: NodeToolchainPrivateTreeExactFileV2Schema.extend({
        locator: z.literal("package.json"),
        mode: z.literal("0444"),
      }).strict(),
      builtinNpmrc: z.object({
        locator: z.literal("npmrc"),
        status: z.literal("absent"),
      }).strict(),
    }).strict(),
  }).strict(),
}).strict();

export type NodeToolchainPrivateTreeReceiptHashPayloadV2 = z.infer<
  typeof NodeToolchainPrivateTreeReceiptIdentityV2Schema
>;

export function hashNodeToolchainPrivateTreeReceiptV2(
  value: NodeToolchainPrivateTreeReceiptHashPayloadV2 | NodeToolchainPrivateTreeReceiptV2,
): string {
  const receipt = { ...value } as Record<string, unknown>;
  delete receipt.receiptHash;
  return hashCanonicalJson({
    schema: "setfarm.node-toolchain-private-tree-receipt-hash.v2",
    receipt,
  });
}

export const NodeToolchainPrivateTreeReceiptV2Schema =
  NodeToolchainPrivateTreeReceiptIdentityV2Schema.safeExtend({
    receiptHash: Sha256Schema,
  }).strict().superRefine((value, context) => {
    const retainedCount = value.inventory.inventory.memberCount
      - value.inventory.selected.discardedUnselectedMemberCount;
    if (
      value.admissionScope !== value.inventory.admissionScope
      || value.materializer.extractionToolContentHash !== value.inventory.tarTool.contentHash
      || value.materializer.selectedMemberCount !== retainedCount
      || value.tree.fileCount + value.tree.directoryCount + 1
        !== value.materializer.selectedMemberCount
    ) {
      context.addIssue({
        code: "custom",
        message: "Private tree receipt must join one exact inventory, tool and selected topology",
      });
    }
    if (
      value.tree.npm.fileCount > value.tree.fileCount
      || value.tree.npm.directoryCount > value.tree.directoryCount
      || value.tree.npm.totalBytes > value.tree.totalBytes
    ) {
      context.addIssue({
        code: "custom",
        path: ["tree", "npm"],
        message: "Private npm closure counts must remain inside the exact normalized tree",
      });
    }
    if (
      value.tree.node.byteLength < 1
      || value.tree.npm.cli.byteLength < 1
      || value.tree.npm.packageJson.byteLength < 1
      || value.tree.fileCount !== value.tree.npm.fileCount + 1
      || value.tree.directoryCount !== value.tree.npm.directoryCount + 4
      || value.tree.totalBytes !== value.tree.npm.totalBytes + value.tree.node.byteLength
    ) {
      context.addIssue({
        code: "custom",
        path: ["tree"],
        message: "Normalized tree must contain exactly Node plus the complete npm closure and ancestors",
      });
    }
    if (value.receiptHash !== hashNodeToolchainPrivateTreeReceiptV2(value)) {
      context.addIssue({
        code: "custom",
        path: ["receiptHash"],
        message: "Node private tree receipt hash must bind the exact receipt",
      });
    }
  });

export type NodeToolchainPrivateTreeReceiptV2 = z.infer<
  typeof NodeToolchainPrivateTreeReceiptV2Schema
>;
