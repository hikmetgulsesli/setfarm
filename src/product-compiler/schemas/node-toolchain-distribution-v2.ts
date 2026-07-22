import { z } from "zod";

import { hashCanonicalJson } from "../canonical-json.js";
import { Sha256Schema } from "./common-v1.js";

export const NODE_TOOLCHAIN_DISTRIBUTION_ARTIFACT_V2_SCHEMA =
  "setfarm.node-toolchain-distribution-artifact.v2" as const;
export const NODE_TOOLCHAIN_DISTRIBUTION_MANIFEST_V2_SCHEMA =
  "setfarm.node-toolchain-distribution-manifest.v2" as const;
export const NODE_TOOLCHAIN_DISTRIBUTION_VERIFICATION_RECEIPT_V2_SCHEMA =
  "setfarm.node-toolchain-distribution-verification-receipt.v2" as const;
export const NODE_TOOLCHAIN_DISTRIBUTION_VERSION_V2 = "2.0.0" as const;
export const NODE_TOOLCHAIN_DISTRIBUTION_MAX_ARCHIVE_BYTES_V2 = 64 * 1024 * 1024;

const StableRefV2Schema = z.string().min(1).max(200)
  .regex(/^[A-Z][A-Z0-9_]*_V2$/, "Expected one V2 stable reference");
const FileNameV2Schema = z.string().min(1).max(200)
  .regex(/^[A-Za-z0-9._+-]+$/, "Expected one portable archive filename");
const ArchiveRootV2Schema = z.string().min(1).max(200)
  .regex(/^[A-Za-z0-9._+-]+$/, "Expected one portable archive root");

const ExpectedRuntimeV2Schema = z.object({
  nodeVersion: z.literal("22.23.1"),
  modulesAbi: z.literal("127"),
  napiVersion: z.literal("10"),
  npmVersion: z.literal("10.9.8"),
  platform: z.literal("darwin"),
  architecture: z.enum(["arm64", "x64"]),
}).strict();

const NodeToolchainDistributionArtifactIdentityV2Schema = z.object({
  schema: z.literal(NODE_TOOLCHAIN_DISTRIBUTION_ARTIFACT_V2_SCHEMA),
  artifactRef: StableRefV2Schema,
  sourceAuthority: z.enum(["nodejs_primary_distribution", "test_fixture"]),
  architecture: z.enum(["arm64", "x64"]),
  origin: z.string().url().max(500),
  fileName: FileNameV2Schema,
  mediaType: z.literal("application/x-xz"),
  archiveFormat: z.literal("tar_xz"),
  archiveRoot: ArchiveRootV2Schema,
  byteLength: z.number().int().positive().max(NODE_TOOLCHAIN_DISTRIBUTION_MAX_ARCHIVE_BYTES_V2),
  sha256: Sha256Schema,
  expectedRuntime: ExpectedRuntimeV2Schema,
  selection: z.object({
    nodeExecutableLocator: z.literal("bin/node"),
    npmPackageRootLocator: z.literal("lib/node_modules/npm"),
    npmCliLocator: z.literal("lib/node_modules/npm/bin/npm-cli.js"),
    discardUnselectedArchiveEntries: z.literal(true),
  }).strict(),
}).strict().superRefine((value, context) => {
  if (value.expectedRuntime.architecture !== value.architecture) {
    context.addIssue({
      code: "custom",
      path: ["expectedRuntime", "architecture"],
      message: "Distribution runtime architecture must equal its artifact architecture",
    });
  }
  if (value.sourceAuthority === "nodejs_primary_distribution") {
    const expectedFile = `node-v22.23.1-darwin-${value.architecture}.tar.xz`;
    const expectedRoot = `node-v22.23.1-darwin-${value.architecture}`;
    if (
      value.fileName !== expectedFile
      || value.archiveRoot !== expectedRoot
      || value.origin !== `https://nodejs.org/dist/v22.23.1/${expectedFile}`
    ) {
      context.addIssue({
        code: "custom",
        message: "Primary Node distribution identity must use its exact official origin, file and archive root",
      });
    }
  }
});

export type NodeToolchainDistributionArtifactHashPayloadV2 = z.infer<
  typeof NodeToolchainDistributionArtifactIdentityV2Schema
>;

export function hashNodeToolchainDistributionArtifactV2(
  value:
    | NodeToolchainDistributionArtifactHashPayloadV2
    | NodeToolchainDistributionArtifactV2,
): string {
  const artifact = { ...value } as Record<string, unknown>;
  delete artifact.artifactHash;
  return hashCanonicalJson({
    schema: "setfarm.node-toolchain-distribution-artifact-hash.v2",
    artifact,
  });
}

export const NodeToolchainDistributionArtifactV2Schema =
  NodeToolchainDistributionArtifactIdentityV2Schema.safeExtend({
    artifactHash: Sha256Schema,
  }).strict().superRefine((value, context) => {
    if (value.artifactHash !== hashNodeToolchainDistributionArtifactV2(value)) {
      context.addIssue({
        code: "custom",
        path: ["artifactHash"],
        message: "Node distribution artifact hash must bind its exact source and runtime identity",
      });
    }
  });

export type NodeToolchainDistributionArtifactV2 = z.infer<
  typeof NodeToolchainDistributionArtifactV2Schema
>;

const NodeToolchainDistributionManifestIdentityV2Schema = z.object({
  schema: z.literal(NODE_TOOLCHAIN_DISTRIBUTION_MANIFEST_V2_SCHEMA),
  manifestVersion: z.literal(NODE_TOOLCHAIN_DISTRIBUTION_VERSION_V2),
  source: z.object({
    provider: z.literal("nodejs.org"),
    releaseRef: z.literal("NODE_RELEASE_V22_23_1"),
    checksumIndexOrigin: z.literal("https://nodejs.org/dist/v22.23.1/SHASUMS256.txt"),
    evidenceObservedDate: z.literal("2026-07-21"),
  }).strict(),
  artifacts: z.tuple([
    NodeToolchainDistributionArtifactV2Schema,
    NodeToolchainDistributionArtifactV2Schema,
  ]),
  extraction: z.object({
    archiveInventory: z.literal("every_member_before_extraction_v2"),
    selectedClosure: z.literal("exact_node_and_bundled_npm_v2"),
    rejectPathTraversal: z.literal(true),
    rejectAbsolutePath: z.literal(true),
    rejectBackslash: z.literal(true),
    rejectSymlink: z.literal(true),
    rejectHardLink: z.literal(true),
    rejectSpecialFile: z.literal(true),
    rejectCaseFoldCollision: z.literal(true),
    finalFileModes: z.object({
      nonExecutable: z.literal("0444"),
      executable: z.literal("0555"),
    }).strict(),
    finalDirectoryMode: z.literal("0555"),
    publication: z.literal("private_stage_fsync_no_replace_root_owned_v2"),
  }).strict(),
}).strict().superRefine((value, context) => {
  if (
    value.artifacts[0].architecture !== "arm64"
    || value.artifacts[1].architecture !== "x64"
    || value.artifacts.some((artifact) => artifact.sourceAuthority !== "nodejs_primary_distribution")
  ) {
    context.addIssue({
      code: "custom",
      path: ["artifacts"],
      message: "Code-owned distribution manifest must contain official arm64 then x64 artifacts",
    });
  }
});

export type NodeToolchainDistributionManifestHashPayloadV2 = z.infer<
  typeof NodeToolchainDistributionManifestIdentityV2Schema
>;

export function hashNodeToolchainDistributionManifestV2(
  value:
    | NodeToolchainDistributionManifestHashPayloadV2
    | NodeToolchainDistributionManifestV2,
): string {
  const manifest = { ...value } as Record<string, unknown>;
  delete manifest.manifestHash;
  return hashCanonicalJson({
    schema: "setfarm.node-toolchain-distribution-manifest-hash.v2",
    manifest,
  });
}

export const NodeToolchainDistributionManifestV2Schema =
  NodeToolchainDistributionManifestIdentityV2Schema.safeExtend({
    manifestHash: Sha256Schema,
  }).strict().superRefine((value, context) => {
    if (value.manifestHash !== hashNodeToolchainDistributionManifestV2(value)) {
      context.addIssue({
        code: "custom",
        path: ["manifestHash"],
        message: "Node distribution manifest hash must bind the exact code-owned catalog",
      });
    }
  });

export type NodeToolchainDistributionManifestV2 = z.infer<
  typeof NodeToolchainDistributionManifestV2Schema
>;

const NodeToolchainDistributionVerificationReceiptIdentityV2Schema = z.object({
  schema: z.literal(NODE_TOOLCHAIN_DISTRIBUTION_VERIFICATION_RECEIPT_V2_SCHEMA),
  receiptVersion: z.literal(NODE_TOOLCHAIN_DISTRIBUTION_VERSION_V2),
  status: z.literal("verified"),
  admissionScope: z.enum(["production_distribution", "test_fixture"]),
  verifier: z.object({
    contractRef: z.literal("NODE_TOOLCHAIN_DISTRIBUTION_ARCHIVE_VERIFIER_V2"),
    contractVersion: z.literal(NODE_TOOLCHAIN_DISTRIBUTION_VERSION_V2),
    sourceReadPolicy: z.literal("open_no_follow_single_link_stable_v2"),
    privateCopyPolicy: z.literal("exclusive_0600_fsync_rehash_v2"),
  }).strict(),
  manifest: z.object({
    schema: z.literal(NODE_TOOLCHAIN_DISTRIBUTION_MANIFEST_V2_SCHEMA),
    manifestHash: Sha256Schema,
  }).strict(),
  artifact: NodeToolchainDistributionArtifactV2Schema,
  archive: z.object({
    archiveFormat: z.literal("tar_xz"),
    byteLength: z.number().int().positive().max(NODE_TOOLCHAIN_DISTRIBUTION_MAX_ARCHIVE_BYTES_V2),
    sha256: Sha256Schema,
  }).strict(),
}).strict();

export type NodeToolchainDistributionVerificationReceiptHashPayloadV2 = z.infer<
  typeof NodeToolchainDistributionVerificationReceiptIdentityV2Schema
>;

export function hashNodeToolchainDistributionVerificationReceiptV2(
  value:
    | NodeToolchainDistributionVerificationReceiptHashPayloadV2
    | NodeToolchainDistributionVerificationReceiptV2,
): string {
  const receipt = { ...value } as Record<string, unknown>;
  delete receipt.receiptHash;
  return hashCanonicalJson({
    schema: "setfarm.node-toolchain-distribution-verification-receipt-hash.v2",
    receipt,
  });
}

export const NodeToolchainDistributionVerificationReceiptV2Schema =
  NodeToolchainDistributionVerificationReceiptIdentityV2Schema.safeExtend({
    receiptHash: Sha256Schema,
  }).strict().superRefine((value, context) => {
    if (
      value.archive.archiveFormat !== value.artifact.archiveFormat
      || value.archive.byteLength !== value.artifact.byteLength
      || value.archive.sha256 !== value.artifact.sha256
    ) {
      context.addIssue({
        code: "custom",
        path: ["archive"],
        message: "Verified archive identity must equal the exact selected distribution artifact",
      });
    }
    if (
      (value.admissionScope === "production_distribution"
        && value.artifact.sourceAuthority !== "nodejs_primary_distribution")
      || (value.admissionScope === "test_fixture"
        && value.artifact.sourceAuthority !== "test_fixture")
    ) {
      context.addIssue({
        code: "custom",
        path: ["admissionScope"],
        message: "Distribution receipt scope must match its source authority",
      });
    }
    if (value.receiptHash !== hashNodeToolchainDistributionVerificationReceiptV2(value)) {
      context.addIssue({
        code: "custom",
        path: ["receiptHash"],
        message: "Node distribution verification receipt hash must bind the exact receipt",
      });
    }
  });

export type NodeToolchainDistributionVerificationReceiptV2 = z.infer<
  typeof NodeToolchainDistributionVerificationReceiptV2Schema
>;
