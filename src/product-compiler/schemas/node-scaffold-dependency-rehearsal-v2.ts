import { z } from "zod";

import { hashCanonicalJson } from "../canonical-json.js";
import { Sha256Schema } from "./common-v1.js";

export const NODE_SCAFFOLD_DEPENDENCY_REHEARSAL_RECEIPT_V2_SCHEMA =
  "setfarm.node-scaffold-dependency-rehearsal-receipt.v2" as const;
export const NODE_SCAFFOLD_DEPENDENCY_REHEARSAL_AUTHORITY_REF_V2 =
  "AUTH_NODE_SCAFFOLD_DEPENDENCY_REHEARSAL_V2" as const;
export const NODE_SCAFFOLD_DEPENDENCY_REHEARSAL_VERSION_V2 = "2.0.0" as const;

const ProfileEvidenceV2Schema = z.object({
  profileId: z.enum([
    "PROFILE_NODE_CLI_STATELESS_EXACT_V2",
    "PROFILE_NODE_EXPRESS_API_STATELESS_EXACT_V2",
  ]),
  entryRef: z.enum([
    "NODE_SCAFFOLD_TOOLCHAIN_NODE_CLI_V2",
    "NODE_SCAFFOLD_TOOLCHAIN_NODE_EXPRESS_API_V2",
  ]),
  entryHash: Sha256Schema,
  graphHash: Sha256Schema,
  nodeCount: z.number().int().positive().max(1_000),
  edgeCount: z.number().int().positive().max(4_000),
  hostToolchainReceiptHash: Sha256Schema,
  environmentReceiptHash: Sha256Schema,
  effectiveConfigHash: Sha256Schema,
  scaffoldBaseReceiptHash: Sha256Schema,
  scaffoldSemanticInputHash: Sha256Schema,
  dependencyReceiptHash: Sha256Schema,
  dependencyIdentityHash: Sha256Schema,
  install: z.object({
    projectScopeHash: Sha256Schema,
    stdoutHash: Sha256Schema,
    stdoutBytes: z.number().int().nonnegative().max(65_536),
    stderrHash: Sha256Schema,
    stderrBytes: z.number().int().nonnegative().max(65_536),
  }).strict(),
  rawInstall: z.object({
    fileCount: z.number().int().positive().max(100_000),
    directoryCount: z.number().int().positive().max(20_000),
    symbolicLinkCount: z.number().int().nonnegative().max(2_000),
    totalBytes: z.number().int().positive().max(2 * 1024 * 1024 * 1024),
    membershipHash: Sha256Schema,
  }).strict(),
  installedBinCount: z.number().int().nonnegative().max(2_000),
  capsule: z.object({
    treeHash: Sha256Schema,
    payloadHash: Sha256Schema,
    fileCount: z.number().int().positive().max(100_000),
    directoryCount: z.number().int().positive().max(20_000),
    totalBytes: z.number().int().positive().max(2 * 1024 * 1024 * 1024),
    metadataProbe: z.literal("code_owned_darwin_acl_nonprovenance_xattr_probe_v2"),
    metadataNormalization: z.literal(
      "code_owned_darwin_writable_copy_acl_xattr_clear_provenance_exclusion_readonly_seal_fsync_v2",
    ),
    hostMetadataExclusion: z.literal(
      "com.apple.provenance_only_not_in_canonical_tree_v2",
    ),
  }).strict(),
  revalidationReceiptHash: Sha256Schema,
  cleanup: z.object({
    stageRoot: z.literal("absent_after_authenticated_destroy"),
    environmentRoot: z.literal("absent_after_authenticated_destroy"),
  }).strict(),
}).strict().superRefine((value, context) => {
  const expectedEntry = value.profileId === "PROFILE_NODE_CLI_STATELESS_EXACT_V2"
    ? "NODE_SCAFFOLD_TOOLCHAIN_NODE_CLI_V2"
    : "NODE_SCAFFOLD_TOOLCHAIN_NODE_EXPRESS_API_V2";
  if (value.entryRef !== expectedEntry) {
    context.addIssue({
      code: "custom",
      path: ["entryRef"],
      message: "Dependency rehearsal profile must join its exact catalog entry",
    });
  }
  if (value.dependencyReceiptHash !== value.revalidationReceiptHash) {
    context.addIssue({
      code: "custom",
      path: ["revalidationReceiptHash"],
      message: "Dependency rehearsal must freshly replay the issued receipt",
    });
  }
});

const RehearsalIdentityV2Schema = z.object({
  schema: z.literal(NODE_SCAFFOLD_DEPENDENCY_REHEARSAL_RECEIPT_V2_SCHEMA),
  receiptVersion: z.literal(NODE_SCAFFOLD_DEPENDENCY_REHEARSAL_VERSION_V2),
  authorityRef: z.literal(NODE_SCAFFOLD_DEPENDENCY_REHEARSAL_AUTHORITY_REF_V2),
  status: z.literal("rehearsal_passed"),
  admissionScope: z.literal("test_fixture"),
  architecture: z.enum(["arm64", "x64"]),
  officialSource: z.object({
    manifestHash: Sha256Schema,
    artifactHash: Sha256Schema,
    verificationReceiptHash: Sha256Schema,
    archiveSha256: Sha256Schema,
    archiveByteLength: z.number().int().positive(),
  }).strict(),
  provisioning: z.object({
    receiptHash: Sha256Schema,
    treeHash: Sha256Schema,
    targetRef: z.enum([
      "SETFARM_ROOT_NODE_22_23_1_NPM_10_9_8_ARM64_V2",
      "SETFARM_ROOT_NODE_22_23_1_NPM_10_9_8_X64_V2",
    ]),
  }).strict(),
  profiles: z.tuple([ProfileEvidenceV2Schema, ProfileEvidenceV2Schema]),
  finalState: z.object({
    rehearsalRoot: z.literal("removed_exactly"),
    productionToolchainRoot: z.literal("untouched"),
    profileCount: z.literal(2),
  }).strict(),
}).strict().superRefine((value, context) => {
  const expectedProfiles = [
    "PROFILE_NODE_CLI_STATELESS_EXACT_V2",
    "PROFILE_NODE_EXPRESS_API_STATELESS_EXACT_V2",
  ];
  if (value.profiles.some((profile, index) => profile.profileId !== expectedProfiles[index])) {
    context.addIssue({
      code: "custom",
      path: ["profiles"],
      message: "Dependency rehearsal profiles must be every-and-only and canonically ordered",
    });
  }
});

export type NodeScaffoldDependencyRehearsalReceiptHashPayloadV2 = z.infer<
  typeof RehearsalIdentityV2Schema
>;

export function hashNodeScaffoldDependencyRehearsalReceiptV2(
  value:
    | NodeScaffoldDependencyRehearsalReceiptHashPayloadV2
    | NodeScaffoldDependencyRehearsalReceiptV2,
): string {
  const payload = { ...value } as Record<string, unknown>;
  delete payload.receiptHash;
  return hashCanonicalJson({
    schema: "setfarm.node-scaffold-dependency-rehearsal-receipt-hash.v2",
    receipt: payload,
  });
}

export const NodeScaffoldDependencyRehearsalReceiptV2Schema =
  RehearsalIdentityV2Schema.extend({
    receiptHash: Sha256Schema,
  }).strict().superRefine((value, context) => {
    if (value.receiptHash !== hashNodeScaffoldDependencyRehearsalReceiptV2(value)) {
      context.addIssue({
        code: "custom",
        path: ["receiptHash"],
        message: "Dependency rehearsal receipt hash must bind all canonical evidence",
      });
    }
  });

export type NodeScaffoldDependencyRehearsalReceiptV2 = z.infer<
  typeof NodeScaffoldDependencyRehearsalReceiptV2Schema
>;
