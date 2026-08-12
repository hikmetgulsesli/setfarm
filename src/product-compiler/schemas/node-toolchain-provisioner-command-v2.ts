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
export const NODE_TOOLCHAIN_PROVISIONER_OPERATION_RECEIPT_V2_SCHEMA =
  "setfarm.node-toolchain-provisioner-operation-receipt.v2" as const;
export const NODE_TOOLCHAIN_PROVISIONER_ROLLBACK_CLAIM_V2_SCHEMA =
  "setfarm.node-toolchain-provisioner-rollback-claim.v2" as const;
export const NODE_TOOLCHAIN_PROVISIONER_ROLLBACK_RECEIPT_V2_SCHEMA =
  "setfarm.node-toolchain-provisioner-rollback-receipt.v2" as const;
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

const RollbackClaimObservationV2Schema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("absent") }).strict(),
  z.object({
    status: z.literal("valid"),
    claimHash: Sha256Schema,
    planHash: Sha256Schema,
    generationReceiptHash: Sha256Schema,
  }).strict(),
  z.object({
    status: z.literal("invalid"),
    reason: z.enum(["not_regular_file", "identity_invalid", "too_large", "json_invalid", "schema_invalid"]),
  }).strict(),
]);

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
  "ROLLBACK_CLAIM_INVALID",
  "LOCK_INVALID",
  "STAGING_INVALID",
  "FOREIGN_STAGING_MEMBER",
  "ROOT_WITHOUT_EXACT_CLAIM",
  "RECEIPT_WITHOUT_ROOT",
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
    rollbackClaimLocatorHash: Sha256Schema,
    lockLocatorHash: Sha256Schema,
    stagingLocatorHash: Sha256Schema,
  }).strict(),
  filesystem: z.object({
    parent: NodeToolchainProvisionerFilesystemEntryV2Schema,
    root: NodeToolchainProvisionerFilesystemEntryV2Schema,
    receipt: NodeToolchainProvisionerFilesystemEntryV2Schema,
    claim: NodeToolchainProvisionerFilesystemEntryV2Schema,
    rollbackClaim: NodeToolchainProvisionerFilesystemEntryV2Schema,
    lock: NodeToolchainProvisionerFilesystemEntryV2Schema,
    staging: NodeToolchainProvisionerFilesystemEntryV2Schema,
  }).strict(),
  canonical: z.object({
    receipt: CanonicalReceiptStateV2Schema,
    claim: CanonicalClaimStateV2Schema,
    rollbackClaim: RollbackClaimObservationV2Schema,
    lock: OperationalFileStateV2Schema,
    staging: StagingStateV2Schema,
  }).strict(),
  classification: z.enum([
    "target_absent",
    "ready_verified",
    "interrupted_claimed",
    "rollback_interrupted",
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
    const rollbackClaimValid = value.canonical.rollbackClaim.status === "valid";
    const rootDirectory = value.filesystem.root.state === "present"
      && value.filesystem.root.type === "directory";
    const rootAbsent = value.filesystem.root.state === "absent";
    const conflictsEmpty = value.conflicts.length === 0;
    const receiptClaimCrashTailMatches = value.canonical.receipt.status !== "valid"
      ? true
      : value.canonical.claim.status === "valid"
        && value.canonical.receipt.receipt.publisher.claimHash
          === value.canonical.claim.claim.claimHash
        && value.canonical.receipt.receipt.intent.intentHash
          === value.canonical.claim.claim.intent.intentHash
        && value.filesystem.root.state === "present"
        && value.filesystem.root.type === "directory"
        && value.filesystem.root.device === value.canonical.receipt.receipt.finalRoot.device
        && value.filesystem.root.inode === value.canonical.receipt.receipt.finalRoot.inode
        && value.filesystem.root.mode === value.canonical.receipt.receipt.finalRoot.mode
        && value.filesystem.root.ownerUid === value.canonical.receipt.receipt.finalRoot.ownerUid
        && value.filesystem.root.ownerGid === value.canonical.receipt.receipt.finalRoot.ownerGid;
    if (
      (value.classification === "target_absent"
        && (!rootAbsent
          || value.canonical.receipt.status !== "absent"
          || value.canonical.claim.status !== "absent"
          || value.canonical.rollbackClaim.status !== "absent"
          || !conflictsEmpty))
      || (value.classification === "ready_verified"
        && (!rootDirectory
          || !receiptValid
          || value.canonical.claim.status !== "absent"
          || value.canonical.rollbackClaim.status !== "absent"
          || !conflictsEmpty))
      || (value.classification === "interrupted_claimed"
        && (!claimValid
          || (value.canonical.receipt.status !== "absent" && !receiptValid)
          || !receiptClaimCrashTailMatches
          || value.canonical.rollbackClaim.status !== "absent"
          || !conflictsEmpty))
      || (value.classification === "rollback_interrupted"
        && (!rollbackClaimValid || value.canonical.claim.status !== "absent" || !conflictsEmpty))
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

const ExactGenerationV2Schema = z.object({
  receiptHash: Sha256Schema,
  intentHash: Sha256Schema,
  targetRef: TargetRefV2Schema,
  rootDevice: FilesystemIdentityNumberV2Schema,
  rootInode: FilesystemIdentityNumberV2Schema,
  treeHash: Sha256Schema,
}).strict();

const RollbackTreeEntryV2Schema = z.object({
  locator: z.string().min(1).max(4_096),
  type: z.enum(["directory", "file"]),
  mode: z.enum(["0444", "0555"]),
  byteLength: z.number().int().nonnegative().max(512 * 1024 * 1024),
  contentHash: Sha256Schema.nullable(),
}).strict().superRefine((value, context) => {
  const segments = value.locator === "." ? [] : value.locator.split("/");
  if (
    (value.locator !== "." && (segments.length < 1 || segments.length > 64))
    || segments.some((segment) => !/^[A-Za-z0-9._@+-]+$/.test(segment))
  ) {
    context.addIssue({ code: "custom", path: ["locator"], message: "Invalid rollback tree locator" });
  }
  if (
    (value.type === "directory"
      && (value.mode !== "0555" || value.byteLength !== 0 || value.contentHash !== null))
    || (value.type === "file" && value.contentHash === null)
  ) {
    context.addIssue({
      code: "custom",
      message: "Rollback tree entry must preserve exact normalized file or directory identity",
    });
  }
});

export function hashNodeToolchainProvisionerRollbackTreeEntriesV2(
  entries: readonly z.infer<typeof RollbackTreeEntryV2Schema>[],
): string {
  return hashCanonicalJson({
    schema: "setfarm.node-toolchain-provisioner-rollback-tree-entries.v2",
    entries,
  });
}

function normalizedTreeHashV2(entries: readonly z.infer<typeof RollbackTreeEntryV2Schema>[]): string {
  return hashCanonicalJson({
    schema: "setfarm.node-toolchain-normalized-private-tree.v2",
    entries: entries.map((entry) => ({
      locator: entry.locator,
      type: entry.type,
      mode: entry.mode,
      ...(entry.type === "file"
        ? { byteLength: entry.byteLength, contentHash: entry.contentHash }
        : {}),
    })),
  });
}

const NodeToolchainProvisionerRollbackClaimIdentityV2Schema = z.object({
  schema: z.literal(NODE_TOOLCHAIN_PROVISIONER_ROLLBACK_CLAIM_V2_SCHEMA),
  claimVersion: z.literal(NODE_TOOLCHAIN_PROVISIONER_COMMAND_VERSION_V2),
  authorityRef: z.literal(NODE_TOOLCHAIN_PROVISIONER_COMMAND_AUTHORITY_REF_V2),
  status: z.literal("removing_exact_generation"),
  plan: NodeToolchainProvisionerPlanV2Schema,
  generation: ExactGenerationV2Schema,
  treeEntries: z.array(RollbackTreeEntryV2Schema).min(2).max(25_001),
  treeEntriesHash: Sha256Schema,
  protocol: z.object({
    serializationPolicy: z.literal("darwin_parent_descriptor_lockf_v2"),
    claimPolicy: z.literal("canonical_no_replace_rollback_claim_before_rename_v2"),
    quarantinePolicy: z.literal("claimed_root_writable_then_private_stage_atomic_rename_v2"),
    removalPolicy: z.literal("every_only_restartable_bottom_up_v2"),
    completionPolicy: z.literal("content_addressed_tombstone_then_claim_last_v2"),
  }).strict(),
}).strict();

export type NodeToolchainProvisionerRollbackClaimHashPayloadV2 = z.infer<
  typeof NodeToolchainProvisionerRollbackClaimIdentityV2Schema
>;

export function hashNodeToolchainProvisionerRollbackClaimV2(
  value:
    | NodeToolchainProvisionerRollbackClaimHashPayloadV2
    | NodeToolchainProvisionerRollbackClaimV2,
): string {
  const claim = { ...value } as Record<string, unknown>;
  delete claim.claimHash;
  return hashCanonicalJson({
    schema: "setfarm.node-toolchain-provisioner-rollback-claim-hash.v2",
    claim,
  });
}

export const NodeToolchainProvisionerRollbackClaimV2Schema =
  NodeToolchainProvisionerRollbackClaimIdentityV2Schema.safeExtend({
    claimHash: Sha256Schema,
  }).strict().superRefine((value, context) => {
    const plan = value.plan;
    const locators = value.treeEntries.map((entry) => entry.locator);
    const fileCount = value.treeEntries.filter((entry) => entry.type === "file").length;
    const directoryCount = value.treeEntries.filter((entry) =>
      entry.type === "directory" && entry.locator !== ".").length;
    const totalBytes = value.treeEntries.reduce((sum, entry) => sum + entry.byteLength, 0);
    const provisioned = plan.inspection.canonical.receipt;
    if (
      plan.operation !== "rollback"
      || provisioned.status !== "valid"
      || value.generation.receiptHash !== plan.generation.receiptHash
      || value.generation.intentHash !== plan.generation.intentHash
      || value.generation.targetRef !== plan.generation.targetRef
      || value.generation.rootDevice !== plan.generation.rootDevice
      || value.generation.rootInode !== plan.generation.rootInode
      || value.generation.treeHash !== plan.generation.treeHash
      || locators[0] !== "."
      || new Set(locators).size !== locators.length
      || locators.some((locator, index) => index > 0 && locator <= locators[index - 1]!)
      || fileCount !== provisioned.receipt.finalRoot.fileCount
      || directoryCount !== provisioned.receipt.finalRoot.directoryCount
      || totalBytes !== provisioned.receipt.finalRoot.totalBytes
      || normalizedTreeHashV2(value.treeEntries) !== provisioned.receipt.finalRoot.treeHash
      || value.treeEntriesHash !== hashNodeToolchainProvisionerRollbackTreeEntriesV2(value.treeEntries)
    ) {
      context.addIssue({
        code: "custom",
        path: ["treeEntries"],
        message: "Rollback claim must bind every exact member of its ready generation",
      });
    }
    if (value.claimHash !== hashNodeToolchainProvisionerRollbackClaimV2(value)) {
      context.addIssue({
        code: "custom",
        path: ["claimHash"],
        message: "Node toolchain rollback claim hash mismatch",
      });
    }
  });

export type NodeToolchainProvisionerRollbackClaimV2 = z.infer<
  typeof NodeToolchainProvisionerRollbackClaimV2Schema
>;

const NodeToolchainProvisionerRollbackReceiptIdentityV2Schema = z.object({
  schema: z.literal(NODE_TOOLCHAIN_PROVISIONER_ROLLBACK_RECEIPT_V2_SCHEMA),
  receiptVersion: z.literal(NODE_TOOLCHAIN_PROVISIONER_COMMAND_VERSION_V2),
  authorityRef: z.literal(NODE_TOOLCHAIN_PROVISIONER_COMMAND_AUTHORITY_REF_V2),
  status: z.literal("rolled_back_verified"),
  admissionScope: AdmissionScopeV2Schema,
  architecture: ArchitectureV2Schema,
  planHash: Sha256Schema,
  claim: NodeToolchainProvisionerRollbackClaimV2Schema,
  removedGeneration: ExactGenerationV2Schema,
  receiptFile: z.object({
    receiptLocatorHash: Sha256Schema,
    mode: z.literal("0444"),
    ownerUid: PosixIdentityV2Schema,
    ownerGid: PosixIdentityV2Schema,
    linkCount: z.literal(1),
    publicationPolicy: z.literal("content_addressed_canonical_no_replace_fsync_v2"),
  }).strict(),
}).strict();

export type NodeToolchainProvisionerRollbackReceiptHashPayloadV2 = z.infer<
  typeof NodeToolchainProvisionerRollbackReceiptIdentityV2Schema
>;

export function hashNodeToolchainProvisionerRollbackReceiptV2(
  value:
    | NodeToolchainProvisionerRollbackReceiptHashPayloadV2
    | NodeToolchainProvisionerRollbackReceiptV2,
): string {
  const receipt = { ...value } as Record<string, unknown>;
  delete receipt.receiptHash;
  return hashCanonicalJson({
    schema: "setfarm.node-toolchain-provisioner-rollback-receipt-hash.v2",
    receipt,
  });
}

export const NodeToolchainProvisionerRollbackReceiptV2Schema =
  NodeToolchainProvisionerRollbackReceiptIdentityV2Schema.safeExtend({
    receiptHash: Sha256Schema,
  }).strict().superRefine((value, context) => {
    if (
      value.planHash !== value.claim.plan.planHash
      || value.admissionScope !== value.claim.plan.admissionScope
      || value.architecture !== value.claim.plan.architecture
      || value.removedGeneration.receiptHash !== value.claim.generation.receiptHash
      || value.removedGeneration.intentHash !== value.claim.generation.intentHash
      || value.removedGeneration.targetRef !== value.claim.generation.targetRef
      || value.removedGeneration.rootDevice !== value.claim.generation.rootDevice
      || value.removedGeneration.rootInode !== value.claim.generation.rootInode
      || value.removedGeneration.treeHash !== value.claim.generation.treeHash
    ) {
      context.addIssue({
        code: "custom",
        path: ["claim"],
        message: "Rollback receipt must retain its complete exact claim and removed generation",
      });
    }
    if (value.receiptHash !== hashNodeToolchainProvisionerRollbackReceiptV2(value)) {
      context.addIssue({
        code: "custom",
        path: ["receiptHash"],
        message: "Node toolchain rollback receipt hash mismatch",
      });
    }
  });

export type NodeToolchainProvisionerRollbackReceiptV2 = z.infer<
  typeof NodeToolchainProvisionerRollbackReceiptV2Schema
>;

const ApplyOperationReceiptIdentityV2Schema = z.object({
  schema: z.literal(NODE_TOOLCHAIN_PROVISIONER_OPERATION_RECEIPT_V2_SCHEMA),
  operationVersion: z.literal(NODE_TOOLCHAIN_PROVISIONER_COMMAND_VERSION_V2),
  authorityRef: z.literal(NODE_TOOLCHAIN_PROVISIONER_COMMAND_AUTHORITY_REF_V2),
  operation: z.literal("apply"),
  admissionScope: AdmissionScopeV2Schema,
  architecture: ArchitectureV2Schema,
  plan: NodeToolchainProvisionerPlanV2Schema,
  beforeInspectionHash: Sha256Schema,
  afterInspection: NodeToolchainProvisionerInspectionV2Schema,
  result: z.enum([
    "applied_exact_generation",
    "recovered_exact_generation",
    "verified_existing_generation",
  ]),
  generation: ExactGenerationV2Schema,
}).strict();

const VerifyOperationReceiptIdentityV2Schema = z.object({
  schema: z.literal(NODE_TOOLCHAIN_PROVISIONER_OPERATION_RECEIPT_V2_SCHEMA),
  operationVersion: z.literal(NODE_TOOLCHAIN_PROVISIONER_COMMAND_VERSION_V2),
  authorityRef: z.literal(NODE_TOOLCHAIN_PROVISIONER_COMMAND_AUTHORITY_REF_V2),
  operation: z.literal("verify"),
  admissionScope: AdmissionScopeV2Schema,
  architecture: ArchitectureV2Schema,
  plan: z.null(),
  beforeInspectionHash: Sha256Schema,
  afterInspection: NodeToolchainProvisionerInspectionV2Schema,
  result: z.literal("verified_exact_generation"),
  generation: ExactGenerationV2Schema,
}).strict();

const RollbackOperationReceiptIdentityV2Schema = z.object({
  schema: z.literal(NODE_TOOLCHAIN_PROVISIONER_OPERATION_RECEIPT_V2_SCHEMA),
  operationVersion: z.literal(NODE_TOOLCHAIN_PROVISIONER_COMMAND_VERSION_V2),
  authorityRef: z.literal(NODE_TOOLCHAIN_PROVISIONER_COMMAND_AUTHORITY_REF_V2),
  operation: z.literal("rollback"),
  admissionScope: AdmissionScopeV2Schema,
  architecture: ArchitectureV2Schema,
  plan: NodeToolchainProvisionerPlanV2Schema,
  beforeInspectionHash: Sha256Schema,
  executionInspection: NodeToolchainProvisionerInspectionV2Schema,
  afterInspection: NodeToolchainProvisionerInspectionV2Schema,
  result: z.enum([
    "rolled_back_exact_generation",
    "recovered_exact_rollback",
    "verified_existing_rollback",
  ]),
  generation: ExactGenerationV2Schema,
  durableRollback: NodeToolchainProvisionerRollbackReceiptV2Schema,
}).strict();

const NodeToolchainProvisionerOperationReceiptIdentityV2Schema = z.discriminatedUnion(
  "operation",
  [
    ApplyOperationReceiptIdentityV2Schema,
    VerifyOperationReceiptIdentityV2Schema,
    RollbackOperationReceiptIdentityV2Schema,
  ],
);

export type NodeToolchainProvisionerOperationReceiptHashPayloadV2 = z.infer<
  typeof NodeToolchainProvisionerOperationReceiptIdentityV2Schema
>;

export function hashNodeToolchainProvisionerOperationReceiptV2(
  value:
    | NodeToolchainProvisionerOperationReceiptHashPayloadV2
    | NodeToolchainProvisionerOperationReceiptV2,
): string {
  const receipt = { ...value } as Record<string, unknown>;
  delete receipt.operationReceiptHash;
  return hashCanonicalJson({
    schema: "setfarm.node-toolchain-provisioner-operation-receipt-hash.v2",
    receipt,
  });
}

export const NodeToolchainProvisionerOperationReceiptV2Schema =
  NodeToolchainProvisionerOperationReceiptIdentityV2Schema.and(z.object({
    operationReceiptHash: Sha256Schema,
  }).strict()).superRefine((value, context) => {
    const after = value.afterInspection;
    const canonicalReceipt = after.canonical.receipt;
    if (value.admissionScope !== after.admissionScope || value.architecture !== after.architecture) {
      context.addIssue({
        code: "custom",
        path: ["afterInspection"],
        message: "Operation receipt scope and architecture must equal its fresh after-inspection",
      });
    }
    if (value.operation === "apply" || value.operation === "verify") {
      if (after.classification !== "ready_verified" || canonicalReceipt.status !== "valid") {
        context.addIssue({
          code: "custom",
          path: ["afterInspection"],
          message: "Successful apply or verify must end at one freshly verified ready generation",
        });
      } else if (
        value.generation.receiptHash !== canonicalReceipt.receipt.receiptHash
        || value.generation.intentHash !== canonicalReceipt.receipt.intent.intentHash
        || value.generation.targetRef !== canonicalReceipt.receipt.finalRoot.targetRef
        || value.generation.rootDevice !== canonicalReceipt.receipt.finalRoot.device
        || value.generation.rootInode !== canonicalReceipt.receipt.finalRoot.inode
        || value.generation.treeHash !== canonicalReceipt.receipt.finalRoot.treeHash
      ) {
        context.addIssue({
          code: "custom",
          path: ["generation"],
          message: "Operation generation must equal the fresh durable provisioning receipt",
        });
      }
    }
    if (value.operation === "apply") {
      const expectedResult = value.plan.operation === "apply"
        ? value.plan.decision === "publish"
          ? "applied_exact_generation"
          : value.plan.decision === "recover_exact_claim"
            ? "recovered_exact_generation"
            : "verified_existing_generation"
        : null;
      if (
        value.plan.operation !== "apply"
        || value.plan.admissionScope !== value.admissionScope
        || value.plan.architecture !== value.architecture
        || value.beforeInspectionHash !== value.plan.inspection.inspectionHash
        || value.result !== expectedResult
        || value.generation.intentHash !== value.plan.intent.intentHash
      ) {
        context.addIssue({
          code: "custom",
          path: ["plan"],
          message: "Apply operation receipt must equal its exact precondition, decision and intent",
        });
      }
    } else if (value.operation === "verify"
      && value.beforeInspectionHash !== value.afterInspection.inspectionHash) {
      context.addIssue({
        code: "custom",
        path: ["beforeInspectionHash"],
        message: "Read-only verify must reproduce one unchanged inspection",
      });
    } else if (value.operation === "rollback") {
      const plan = value.plan;
      const execution = value.executionInspection;
      const exactReadyStart = plan.operation === "rollback"
        && execution.classification === "ready_verified"
        && execution.inspectionHash === plan.inspection.inspectionHash;
      const exactInterruptedStart = plan.operation === "rollback"
        && execution.classification === "rollback_interrupted"
        && execution.canonical.rollbackClaim.status === "valid"
        && execution.canonical.rollbackClaim.planHash === plan.planHash
        && execution.canonical.rollbackClaim.generationReceiptHash === plan.generation.receiptHash;
      const exactCompletedStart = execution.classification === "target_absent";
      if (
        plan.operation !== "rollback"
        || plan.admissionScope !== value.admissionScope
        || plan.architecture !== value.architecture
        || execution.admissionScope !== value.admissionScope
        || execution.architecture !== value.architecture
        || value.beforeInspectionHash !== execution.inspectionHash
        || (!exactReadyStart && !exactInterruptedStart && !exactCompletedStart)
        || after.classification !== "target_absent"
        || after.canonical.receipt.status !== "absent"
        || after.canonical.claim.status !== "absent"
        || value.generation.receiptHash !== plan.generation.receiptHash
        || value.generation.intentHash !== plan.generation.intentHash
        || value.generation.targetRef !== plan.generation.targetRef
        || value.generation.rootDevice !== plan.generation.rootDevice
        || value.generation.rootInode !== plan.generation.rootInode
        || value.generation.treeHash !== plan.generation.treeHash
        || value.durableRollback.planHash !== plan.planHash
        || value.durableRollback.removedGeneration.receiptHash !== plan.generation.receiptHash
      ) {
        context.addIssue({
          code: "custom",
          path: ["durableRollback"],
          message: "Rollback operation must end absent and bind its exact durable removed generation",
        });
      }
    }
    if (value.operationReceiptHash !== hashNodeToolchainProvisionerOperationReceiptV2(value)) {
      context.addIssue({
        code: "custom",
        path: ["operationReceiptHash"],
        message: "Node toolchain provisioner operation receipt hash mismatch",
      });
    }
  });

export type NodeToolchainProvisionerOperationReceiptV2 = z.infer<
  typeof NodeToolchainProvisionerOperationReceiptV2Schema
>;
