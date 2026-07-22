import { z } from "zod";

import { hashCanonicalJson } from "../canonical-json.js";
import { Sha256Schema } from "./common-v1.js";
import { NodeToolchainPrivateTreeReceiptV2Schema } from "./node-toolchain-private-tree-v2.js";
import {
  NodeToolchainProvisioningClaimV2Schema,
  NodeToolchainProvisioningIntentV2Schema,
  NodeToolchainProvisioningReceiptV2Schema,
} from "./node-toolchain-provisioning-v2.js";

export const NODE_TOOLCHAIN_PROVISIONER_INSPECTION_V2_SCHEMA =
  "setfarm.node-toolchain-provisioner-inspection.v2" as const;
export const NODE_TOOLCHAIN_PROVISIONER_PLAN_V2_SCHEMA =
  "setfarm.node-toolchain-provisioner-plan.v2" as const;
export const NODE_TOOLCHAIN_PROVISIONER_COMMAND_VERSION_V2 = "2.0.0" as const;
export const NODE_TOOLCHAIN_PROVISIONER_COMMAND_AUTHORITY_REF_V2 =
  "AUTH_NODE_TOOLCHAIN_PROVISIONER_COMMAND_V2" as const;

const PosixIdentityV2Schema = z.number().int().nonnegative().max(4_294_967_294);
const FilesystemIdentityNumberV2Schema = z.number().int().nonnegative().safe();
const FilesystemTimestampV2Schema = z.number().int().nonnegative().safe();
const ArchitectureV2Schema = z.enum(["arm64", "x64"]);
const AdmissionScopeV2Schema = z.enum(["production_root", "test_fixture"]);
const TargetRefV2Schema = z.enum([
  "SETFARM_ROOT_NODE_22_23_1_NPM_10_9_8_ARM64_V2",
  "SETFARM_ROOT_NODE_22_23_1_NPM_10_9_8_X64_V2",
]);

const AbsentFilesystemEntryV2Schema = z.object({
  state: z.literal("absent"),
}).strict();

const PresentFilesystemEntryV2Schema = z.object({
  state: z.literal("present"),
  type: z.enum(["directory", "regular_file", "symbolic_link", "other"]),
  device: FilesystemIdentityNumberV2Schema,
  inode: FilesystemIdentityNumberV2Schema,
  mode: z.string().regex(/^[0-7]{4}$/),
  ownerUid: PosixIdentityV2Schema,
  ownerGid: PosixIdentityV2Schema,
  linkCount: z.number().int().nonnegative().safe(),
  byteLength: z.number().int().nonnegative().safe(),
  modifiedMicroseconds: FilesystemTimestampV2Schema,
  changedMicroseconds: FilesystemTimestampV2Schema,
  contentHash: Sha256Schema.nullable(),
}).strict().superRefine((value, context) => {
  if (value.type !== "regular_file" && value.contentHash !== null) {
    context.addIssue({
      code: "custom",
      path: ["contentHash"],
      message: "Only a bounded regular file may carry a content hash",
    });
  }
});

export const NodeToolchainProvisionerFilesystemEntryV2Schema = z.discriminatedUnion(
  "state",
  [AbsentFilesystemEntryV2Schema, PresentFilesystemEntryV2Schema],
);

export type NodeToolchainProvisionerFilesystemEntryV2 = z.infer<
  typeof NodeToolchainProvisionerFilesystemEntryV2Schema
>;

const CanonicalReceiptStateV2Schema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("absent") }).strict(),
  z.object({
    status: z.literal("valid"),
    receipt: NodeToolchainProvisioningReceiptV2Schema,
  }).strict(),
  z.object({
    status: z.literal("invalid"),
    reason: z.enum(["not_regular_file", "identity_invalid", "too_large", "json_invalid", "schema_invalid"]),
  }).strict(),
]);

const CanonicalClaimStateV2Schema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("absent") }).strict(),
  z.object({
    status: z.literal("valid"),
    claim: NodeToolchainProvisioningClaimV2Schema,
  }).strict(),
  z.object({
    status: z.literal("invalid"),
    reason: z.enum(["not_regular_file", "identity_invalid", "too_large", "json_invalid", "schema_invalid"]),
  }).strict(),
]);

const OperationalFileStateV2Schema = z.object({
  status: z.enum(["absent", "valid", "invalid"]),
}).strict();

const StagingStateV2Schema = z.object({
  status: z.enum(["absent", "empty", "exact_interrupted", "foreign_or_invalid"]),
  memberCount: z.number().int().nonnegative().max(20_000),
  memberNamesHash: Sha256Schema,
}).strict();

export const NodeToolchainProvisionerConflictCodeV2Schema = z.enum([
  "PARENT_IDENTITY_INVALID",
  "ROOT_TYPE_INVALID",
  "RECEIPT_INVALID",
  "CLAIM_INVALID",
  "LOCK_INVALID",
  "STAGING_INVALID",
  "FOREIGN_STAGING_MEMBER",
  "ROOT_WITHOUT_EXACT_CLAIM",
  "RECEIPT_WITHOUT_ROOT",
  "READY_RECEIPT_WITH_CLAIM",
  "READY_REVALIDATION_FAILED",
  "INTERRUPTED_STATE_MISMATCH",
]);

export type NodeToolchainProvisionerConflictCodeV2 = z.infer<
  typeof NodeToolchainProvisionerConflictCodeV2Schema
>;

const NodeToolchainProvisionerInspectionIdentityV2Schema = z.object({
  schema: z.literal(NODE_TOOLCHAIN_PROVISIONER_INSPECTION_V2_SCHEMA),
  inspectionVersion: z.literal(NODE_TOOLCHAIN_PROVISIONER_COMMAND_VERSION_V2),
  authorityRef: z.literal(NODE_TOOLCHAIN_PROVISIONER_COMMAND_AUTHORITY_REF_V2),
  admissionScope: AdmissionScopeV2Schema,
  architecture: ArchitectureV2Schema,
  target: z.object({
    targetRef: TargetRefV2Schema,
    parentLocatorHash: Sha256Schema,
    rootLocatorHash: Sha256Schema,
    receiptLocatorHash: Sha256Schema,
    claimLocatorHash: Sha256Schema,
    lockLocatorHash: Sha256Schema,
    stagingLocatorHash: Sha256Schema,
  }).strict(),
  filesystem: z.object({
    parent: NodeToolchainProvisionerFilesystemEntryV2Schema,
    root: NodeToolchainProvisionerFilesystemEntryV2Schema,
    receipt: NodeToolchainProvisionerFilesystemEntryV2Schema,
    claim: NodeToolchainProvisionerFilesystemEntryV2Schema,
    lock: NodeToolchainProvisionerFilesystemEntryV2Schema,
    staging: NodeToolchainProvisionerFilesystemEntryV2Schema,
  }).strict(),
  canonical: z.object({
    receipt: CanonicalReceiptStateV2Schema,
    claim: CanonicalClaimStateV2Schema,
    lock: OperationalFileStateV2Schema,
    staging: StagingStateV2Schema,
  }).strict(),
  classification: z.enum([
    "target_absent",
    "ready_verified",
    "interrupted_claimed",
    "conflict",
  ]),
  conflicts: z.array(NodeToolchainProvisionerConflictCodeV2Schema).max(16),
}).strict();

export type NodeToolchainProvisionerInspectionHashPayloadV2 = z.infer<
  typeof NodeToolchainProvisionerInspectionIdentityV2Schema
>;

export function hashNodeToolchainProvisionerInspectionV2(
  value: NodeToolchainProvisionerInspectionHashPayloadV2 | NodeToolchainProvisionerInspectionV2,
): string {
  const inspection = { ...value } as Record<string, unknown>;
  delete inspection.inspectionHash;
  return hashCanonicalJson({
    schema: "setfarm.node-toolchain-provisioner-inspection-hash.v2",
    inspection,
  });
}

export const NodeToolchainProvisionerInspectionV2Schema =
  NodeToolchainProvisionerInspectionIdentityV2Schema.safeExtend({
    inspectionHash: Sha256Schema,
  }).strict().superRefine((value, context) => {
    const receiptValid = value.canonical.receipt.status === "valid";
    const claimValid = value.canonical.claim.status === "valid";
    const rootDirectory = value.filesystem.root.state === "present"
      && value.filesystem.root.type === "directory";
    const rootAbsent = value.filesystem.root.state === "absent";
    const conflictsEmpty = value.conflicts.length === 0;
    if (
      (value.classification === "target_absent"
        && (!rootAbsent
          || value.canonical.receipt.status !== "absent"
          || value.canonical.claim.status !== "absent"
          || !conflictsEmpty))
      || (value.classification === "ready_verified"
        && (!rootDirectory || !receiptValid || value.canonical.claim.status !== "absent" || !conflictsEmpty))
      || (value.classification === "interrupted_claimed"
        && (!claimValid || value.canonical.receipt.status !== "absent" || !conflictsEmpty))
      || (value.classification === "conflict" && conflictsEmpty)
    ) {
      context.addIssue({
        code: "custom",
        path: ["classification"],
        message: "Provisioner classification must equal its canonical filesystem state",
      });
    }
    if (value.canonical.receipt.status === "valid") {
      const receipt = value.canonical.receipt.receipt;
      if (
        receipt.admissionScope !== value.admissionScope
        || receipt.intent.architecture !== value.architecture
        || receipt.intent.target.targetRef !== value.target.targetRef
        || receipt.intent.target.parentLocatorHash !== value.target.parentLocatorHash
        || receipt.intent.target.rootLocatorHash !== value.target.rootLocatorHash
        || receipt.intent.target.receiptLocatorHash !== value.target.receiptLocatorHash
      ) {
        context.addIssue({
          code: "custom",
          path: ["canonical", "receipt"],
          message: "Canonical receipt must bind the inspected target",
        });
      }
    }
    if (value.canonical.claim.status === "valid") {
      const claim = value.canonical.claim.claim;
      if (
        claim.intent.admissionScope !== value.admissionScope
        || claim.intent.architecture !== value.architecture
        || claim.intent.target.targetRef !== value.target.targetRef
        || claim.intent.target.parentLocatorHash !== value.target.parentLocatorHash
        || claim.intent.target.rootLocatorHash !== value.target.rootLocatorHash
        || claim.intent.target.receiptLocatorHash !== value.target.receiptLocatorHash
      ) {
        context.addIssue({
          code: "custom",
          path: ["canonical", "claim"],
          message: "Canonical claim must bind the inspected target",
        });
      }
    }
    if (value.inspectionHash !== hashNodeToolchainProvisionerInspectionV2(value)) {
      context.addIssue({
        code: "custom",
        path: ["inspectionHash"],
        message: "Node toolchain provisioner inspection hash mismatch",
      });
    }
  });

export type NodeToolchainProvisionerInspectionV2 = z.infer<
  typeof NodeToolchainProvisionerInspectionV2Schema
>;

const ApplyPlanIdentityV2Schema = z.object({
  schema: z.literal(NODE_TOOLCHAIN_PROVISIONER_PLAN_V2_SCHEMA),
  planVersion: z.literal(NODE_TOOLCHAIN_PROVISIONER_COMMAND_VERSION_V2),
  authorityRef: z.literal(NODE_TOOLCHAIN_PROVISIONER_COMMAND_AUTHORITY_REF_V2),
  operation: z.literal("apply"),
  admissionScope: AdmissionScopeV2Schema,
  architecture: ArchitectureV2Schema,
  inspection: NodeToolchainProvisionerInspectionV2Schema,
  source: NodeToolchainPrivateTreeReceiptV2Schema,
  intent: NodeToolchainProvisioningIntentV2Schema,
  decision: z.enum(["publish", "recover_exact_claim", "verify_existing"]),
}).strict();

const RollbackPlanIdentityV2Schema = z.object({
  schema: z.literal(NODE_TOOLCHAIN_PROVISIONER_PLAN_V2_SCHEMA),
  planVersion: z.literal(NODE_TOOLCHAIN_PROVISIONER_COMMAND_VERSION_V2),
  authorityRef: z.literal(NODE_TOOLCHAIN_PROVISIONER_COMMAND_AUTHORITY_REF_V2),
  operation: z.literal("rollback"),
  admissionScope: AdmissionScopeV2Schema,
  architecture: ArchitectureV2Schema,
  inspection: NodeToolchainProvisionerInspectionV2Schema,
  generation: z.object({
    receiptHash: Sha256Schema,
    intentHash: Sha256Schema,
    targetRef: TargetRefV2Schema,
    rootDevice: FilesystemIdentityNumberV2Schema,
    rootInode: FilesystemIdentityNumberV2Schema,
    treeHash: Sha256Schema,
  }).strict(),
  decision: z.literal("remove_exact_generation"),
}).strict();

const NodeToolchainProvisionerPlanIdentityV2Schema = z.discriminatedUnion(
  "operation",
  [ApplyPlanIdentityV2Schema, RollbackPlanIdentityV2Schema],
);

export type NodeToolchainProvisionerPlanHashPayloadV2 = z.infer<
  typeof NodeToolchainProvisionerPlanIdentityV2Schema
>;

export function hashNodeToolchainProvisionerPlanV2(
  value: NodeToolchainProvisionerPlanHashPayloadV2 | NodeToolchainProvisionerPlanV2,
): string {
  const plan = { ...value } as Record<string, unknown>;
  delete plan.planHash;
  return hashCanonicalJson({
    schema: "setfarm.node-toolchain-provisioner-plan-hash.v2",
    plan,
  });
}

export const NodeToolchainProvisionerPlanV2Schema =
  NodeToolchainProvisionerPlanIdentityV2Schema.and(z.object({
    planHash: Sha256Schema,
  }).strict()).superRefine((value, context) => {
    if (
      value.admissionScope !== value.inspection.admissionScope
      || value.architecture !== value.inspection.architecture
    ) {
      context.addIssue({
        code: "custom",
        path: ["inspection"],
        message: "Provisioner plan scope and architecture must equal its inspection",
      });
    }
    if (value.operation === "apply") {
      const expectedSourceScope = value.admissionScope === "production_root"
        ? "production_distribution"
        : "test_fixture";
      const claim = value.inspection.canonical.claim;
      const receipt = value.inspection.canonical.receipt;
      const decisionMatches =
        (value.decision === "publish" && value.inspection.classification === "target_absent")
        || (value.decision === "recover_exact_claim"
          && value.inspection.classification === "interrupted_claimed"
          && claim.status === "valid"
          && claim.claim.intent.intentHash === value.intent.intentHash)
        || (value.decision === "verify_existing"
          && value.inspection.classification === "ready_verified"
          && receipt.status === "valid"
          && receipt.receipt.intent.intentHash === value.intent.intentHash);
      if (
        value.source.admissionScope !== expectedSourceScope
        || value.intent.admissionScope !== value.admissionScope
        || value.intent.architecture !== value.architecture
        || value.intent.source.privateTreeReceiptHash !== value.source.receiptHash
        || value.intent.target.targetRef !== value.inspection.target.targetRef
        || value.intent.target.parentLocatorHash !== value.inspection.target.parentLocatorHash
        || value.intent.target.rootLocatorHash !== value.inspection.target.rootLocatorHash
        || value.intent.target.receiptLocatorHash !== value.inspection.target.receiptLocatorHash
        || !decisionMatches
      ) {
        context.addIssue({
          code: "custom",
          path: ["decision"],
          message: "Apply plan must bind one exact source, intent, inspection and decision",
        });
      }
    } else {
      const receipt = value.inspection.canonical.receipt;
      if (
        value.inspection.classification !== "ready_verified"
        || receipt.status !== "valid"
        || value.generation.receiptHash !== receipt.receipt.receiptHash
        || value.generation.intentHash !== receipt.receipt.intent.intentHash
        || value.generation.targetRef !== receipt.receipt.finalRoot.targetRef
        || value.generation.rootDevice !== receipt.receipt.finalRoot.device
        || value.generation.rootInode !== receipt.receipt.finalRoot.inode
        || value.generation.treeHash !== receipt.receipt.finalRoot.treeHash
      ) {
        context.addIssue({
          code: "custom",
          path: ["generation"],
          message: "Rollback plan must bind one exact ready provisioning generation",
        });
      }
    }
    if (value.planHash !== hashNodeToolchainProvisionerPlanV2(value)) {
      context.addIssue({
        code: "custom",
        path: ["planHash"],
        message: "Node toolchain provisioner plan hash mismatch",
      });
    }
  });

export type NodeToolchainProvisionerPlanV2 = z.infer<
  typeof NodeToolchainProvisionerPlanV2Schema
>;
