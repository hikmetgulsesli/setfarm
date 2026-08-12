import path from "node:path";

import { z } from "zod";

import { hashCanonicalJson } from "../canonical-json.js";
import { Sha256Schema } from "./common-v1.js";
import {
  NodeToolchainProvisionerBootstrapInstallationReceiptV2Schema,
  getNodeToolchainProvisionerBootstrapInstallationPathsV2,
  type NodeToolchainProvisionerBootstrapInstallationReceiptV2,
} from "./node-toolchain-provisioner-bootstrap-installation-state-v2.js";
import {
  NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_BUNDLE_LOCATOR_V2,
  NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_LAUNCHER_LOCATOR_V2,
  NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_MANIFEST_LOCATOR_V2,
  NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_RUNTIME_LOCATOR_V2,
} from "./node-toolchain-provisioner-bootstrap-v2.js";

export const NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_ROLLBACK_PLAN_V2_SCHEMA =
  "setfarm.node-toolchain-provisioner-bootstrap-rollback-plan.v2" as const;
export const NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_ROLLBACK_CLAIM_V2_SCHEMA =
  "setfarm.node-toolchain-provisioner-bootstrap-rollback-claim.v2" as const;
export const NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_ROLLBACK_RECEIPT_V2_SCHEMA =
  "setfarm.node-toolchain-provisioner-bootstrap-rollback-receipt.v2" as const;
export const NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_ROLLBACK_VERSION_V2 = "2.0.0" as const;
export const NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_ROLLBACK_AUTHORITY_REF_V2 =
  "AUTH_NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_ROLLBACK_V2" as const;
export const NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_ROLLBACK_CLAIM_BASENAME_V2 =
  ".setfarm-node-toolchain-provisioner-installation-v2.rollback.claim.json" as const;
export const NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_ROLLBACK_STAGE_BASENAME_V2 =
  "rollback" as const;
export const NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_ROLLBACK_QUARANTINE_BASENAME_V2 =
  "node-toolchain-provisioner-v2" as const;
export const NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_ROLLBACK_CLAIM_STAGE_BASENAME_V2 =
  "rollback-claim.v2.json.stage" as const;
export const NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_ROLLBACK_RECEIPT_STAGE_BASENAME_V2 =
  "rollback-receipt.v2.json.stage" as const;
export const NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_ROLLBACK_RECEIPT_BASENAME_REGEX_V2 =
  "^\\.setfarm-node-toolchain-provisioner-installation-v2\\.rollback\\.[a-f0-9]{64}\\.receipt\\.json$" as const;

const PosixIdentityV2Schema = z.number().int().nonnegative().max(2_147_483_647);
const FilesystemIdentityV2Schema = z.number().int().nonnegative().safe();
const AdmissionScopeV2Schema = z.enum(["production_release", "test_fixture"]);
const ArchitectureV2Schema = z.enum(["arm64", "x64"]);

export type NodeToolchainProvisionerBootstrapRollbackLocatorRoleV2 =
  | "rollbackClaim"
  | "rollbackReceipt"
  | "rollbackStage"
  | "rollbackQuarantine"
  | "rollbackClaimStage"
  | "rollbackReceiptStage";

export function hashNodeToolchainProvisionerBootstrapRollbackLocatorV2(
  role: NodeToolchainProvisionerBootstrapRollbackLocatorRoleV2,
  absoluteLocator: string,
): string {
  if (
    !path.isAbsolute(absoluteLocator)
    || path.normalize(absoluteLocator) !== absoluteLocator
    || absoluteLocator.includes("\0")
  ) {
    throw new TypeError("Bootstrap rollback locator must be one normalized absolute path");
  }
  return hashCanonicalJson({
    schema: "setfarm.node-toolchain-provisioner-bootstrap-rollback-locator-hash.v2",
    role,
    absoluteLocator,
  });
}

export type NodeToolchainProvisionerBootstrapRollbackPathsV2 = Readonly<{
  parent: string;
  root: string;
  installationReceipt: string;
  installationClaim: string;
  lock: string;
  staging: string;
  rollbackClaim: string;
  rollbackReceipt: string;
  rollbackStage: string;
  quarantineRoot: string;
  rollbackClaimStage: string;
  rollbackReceiptStage: string;
}>;

export function getNodeToolchainProvisionerBootstrapRollbackPathsV2(
  installationReceipt: NodeToolchainProvisionerBootstrapInstallationReceiptV2,
): NodeToolchainProvisionerBootstrapRollbackPathsV2 {
  const parsed = NodeToolchainProvisionerBootstrapInstallationReceiptV2Schema.parse(
    installationReceipt,
  );
  const installation = getNodeToolchainProvisionerBootstrapInstallationPathsV2(
    parsed.claim.intent.source,
  );
  const rollbackReceiptBasename =
    `.setfarm-node-toolchain-provisioner-installation-v2.rollback.${parsed.receiptHash}.receipt.json`;
  const rollbackStage = path.join(
    installation.staging,
    NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_ROLLBACK_STAGE_BASENAME_V2,
  );
  return Object.freeze({
    parent: installation.parent,
    root: installation.root,
    installationReceipt: installation.receipt,
    installationClaim: installation.claim,
    lock: installation.lock,
    staging: installation.staging,
    rollbackClaim: path.join(
      installation.parent,
      NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_ROLLBACK_CLAIM_BASENAME_V2,
    ),
    rollbackReceipt: path.join(installation.parent, rollbackReceiptBasename),
    rollbackStage,
    quarantineRoot: path.join(
      rollbackStage,
      NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_ROLLBACK_QUARANTINE_BASENAME_V2,
    ),
    rollbackClaimStage: path.join(
      installation.staging,
      NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_ROLLBACK_CLAIM_STAGE_BASENAME_V2,
    ),
    rollbackReceiptStage: path.join(
      installation.staging,
      NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_ROLLBACK_RECEIPT_STAGE_BASENAME_V2,
    ),
  });
}

const ExactGenerationV2Schema = z.object({
  installationReceiptHash: Sha256Schema,
  installationClaimHash: Sha256Schema,
  installationIntentHash: Sha256Schema,
  preparedReceiptHash: Sha256Schema,
  predecessorRollbackReceiptCount: z.number().int().nonnegative().max(1_000_000),
  predecessorRollbackHistoryHash: Sha256Schema,
  manifestHash: Sha256Schema,
  architecture: ArchitectureV2Schema,
  rootLocatorHash: Sha256Schema,
  rootDevice: FilesystemIdentityV2Schema,
  rootInode: FilesystemIdentityV2Schema,
  treeHash: Sha256Schema,
}).strict();

function exactGeneration(
  receipt: NodeToolchainProvisionerBootstrapInstallationReceiptV2,
): z.infer<typeof ExactGenerationV2Schema> {
  return {
    installationReceiptHash: receipt.receiptHash,
    installationClaimHash: receipt.claim.claimHash,
    installationIntentHash: receipt.claim.intent.intentHash,
    preparedReceiptHash: receipt.claim.intent.source.receiptHash,
    predecessorRollbackReceiptCount: receipt.predecessorRollbackHistory.receiptCount,
    predecessorRollbackHistoryHash: receipt.predecessorRollbackHistory.historyHash,
    manifestHash: receipt.finalRoot.manifestHash,
    architecture: receipt.finalRoot.architecture,
    rootLocatorHash: receipt.finalRoot.rootLocatorHash,
    rootDevice: receipt.finalRoot.device,
    rootInode: receipt.finalRoot.inode,
    treeHash: receipt.finalRoot.treeHash,
  };
}

const RollbackTargetV2Schema = z.object({
  rollbackClaimBasename: z.literal(
    NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_ROLLBACK_CLAIM_BASENAME_V2,
  ),
  rollbackReceiptBasename: z.string().regex(
    new RegExp(NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_ROLLBACK_RECEIPT_BASENAME_REGEX_V2),
  ),
  rollbackStageBasename: z.literal(
    NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_ROLLBACK_STAGE_BASENAME_V2,
  ),
  quarantineBasename: z.literal(
    NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_ROLLBACK_QUARANTINE_BASENAME_V2,
  ),
  rollbackClaimLocatorHash: Sha256Schema,
  rollbackReceiptLocatorHash: Sha256Schema,
  rollbackStageLocatorHash: Sha256Schema,
  quarantineLocatorHash: Sha256Schema,
  rollbackClaimStageLocatorHash: Sha256Schema,
  rollbackReceiptStageLocatorHash: Sha256Schema,
}).strict();

function rollbackTarget(
  receipt: NodeToolchainProvisionerBootstrapInstallationReceiptV2,
): z.infer<typeof RollbackTargetV2Schema> {
  const paths = getNodeToolchainProvisionerBootstrapRollbackPathsV2(receipt);
  return {
    rollbackClaimBasename: NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_ROLLBACK_CLAIM_BASENAME_V2,
    rollbackReceiptBasename: path.basename(paths.rollbackReceipt),
    rollbackStageBasename: NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_ROLLBACK_STAGE_BASENAME_V2,
    quarantineBasename: NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_ROLLBACK_QUARANTINE_BASENAME_V2,
    rollbackClaimLocatorHash: hashNodeToolchainProvisionerBootstrapRollbackLocatorV2(
      "rollbackClaim",
      paths.rollbackClaim,
    ),
    rollbackReceiptLocatorHash: hashNodeToolchainProvisionerBootstrapRollbackLocatorV2(
      "rollbackReceipt",
      paths.rollbackReceipt,
    ),
    rollbackStageLocatorHash: hashNodeToolchainProvisionerBootstrapRollbackLocatorV2(
      "rollbackStage",
      paths.rollbackStage,
    ),
    quarantineLocatorHash: hashNodeToolchainProvisionerBootstrapRollbackLocatorV2(
      "rollbackQuarantine",
      paths.quarantineRoot,
    ),
    rollbackClaimStageLocatorHash: hashNodeToolchainProvisionerBootstrapRollbackLocatorV2(
      "rollbackClaimStage",
      paths.rollbackClaimStage,
    ),
    rollbackReceiptStageLocatorHash: hashNodeToolchainProvisionerBootstrapRollbackLocatorV2(
      "rollbackReceiptStage",
      paths.rollbackReceiptStage,
    ),
  };
}

const RollbackPlanIdentityV2Schema = z.object({
  schema: z.literal(NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_ROLLBACK_PLAN_V2_SCHEMA),
  planVersion: z.literal(NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_ROLLBACK_VERSION_V2),
  authorityRef: z.literal(NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_ROLLBACK_AUTHORITY_REF_V2),
  operation: z.literal("rollback_bootstrap_installation"),
  admissionScope: AdmissionScopeV2Schema,
  installed: NodeToolchainProvisionerBootstrapInstallationReceiptV2Schema,
  generation: ExactGenerationV2Schema,
  target: RollbackTargetV2Schema,
  decision: z.literal("remove_exact_generation"),
}).strict();

export type NodeToolchainProvisionerBootstrapRollbackPlanHashPayloadV2 = z.infer<
  typeof RollbackPlanIdentityV2Schema
>;

export function hashNodeToolchainProvisionerBootstrapRollbackPlanV2(
  value:
    | NodeToolchainProvisionerBootstrapRollbackPlanHashPayloadV2
    | NodeToolchainProvisionerBootstrapRollbackPlanV2,
): string {
  const plan = { ...value } as Record<string, unknown>;
  delete plan.planHash;
  return hashCanonicalJson({
    schema: "setfarm.node-toolchain-provisioner-bootstrap-rollback-plan-hash.v2",
    plan,
  });
}

export const NodeToolchainProvisionerBootstrapRollbackPlanV2Schema =
  RollbackPlanIdentityV2Schema.safeExtend({
    planHash: Sha256Schema,
  }).strict().superRefine((value, context) => {
    const generation = exactGeneration(value.installed);
    const target = rollbackTarget(value.installed);
    if (
      value.admissionScope !== value.installed.admissionScope
      || Object.entries(generation).some(([key, expected]) =>
        value.generation[key as keyof typeof generation] !== expected)
      || Object.entries(target).some(([key, expected]) =>
        value.target[key as keyof typeof target] !== expected)
      || value.planHash !== hashNodeToolchainProvisionerBootstrapRollbackPlanV2(value)
    ) {
      context.addIssue({
        code: "custom",
        message: "Bootstrap rollback plan must bind one exact installed physical generation",
      });
    }
  });

export type NodeToolchainProvisionerBootstrapRollbackPlanV2 = z.infer<
  typeof NodeToolchainProvisionerBootstrapRollbackPlanV2Schema
>;

export function buildNodeToolchainProvisionerBootstrapRollbackPlanV2(
  installed: NodeToolchainProvisionerBootstrapInstallationReceiptV2,
): NodeToolchainProvisionerBootstrapRollbackPlanV2 {
  const receipt = NodeToolchainProvisionerBootstrapInstallationReceiptV2Schema.parse(installed);
  const identity: NodeToolchainProvisionerBootstrapRollbackPlanHashPayloadV2 = {
    schema: NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_ROLLBACK_PLAN_V2_SCHEMA,
    planVersion: NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_ROLLBACK_VERSION_V2,
    authorityRef: NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_ROLLBACK_AUTHORITY_REF_V2,
    operation: "rollback_bootstrap_installation",
    admissionScope: receipt.admissionScope,
    installed: receipt,
    generation: exactGeneration(receipt),
    target: rollbackTarget(receipt),
    decision: "remove_exact_generation",
  };
  return NodeToolchainProvisionerBootstrapRollbackPlanV2Schema.parse({
    ...identity,
    planHash: hashNodeToolchainProvisionerBootstrapRollbackPlanV2(identity),
  });
}

const RollbackTreeEntryV2Schema = z.object({
  locator: z.enum([
    ".",
    "bin",
    "lib",
    "runtime",
    NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_LAUNCHER_LOCATOR_V2,
    NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_BUNDLE_LOCATOR_V2,
    NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_MANIFEST_LOCATOR_V2,
    NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_RUNTIME_LOCATOR_V2,
  ]),
  type: z.enum(["directory", "file"]),
  mode: z.enum(["0444", "0555"]),
  byteLength: z.number().int().nonnegative().max(256 * 1024 * 1024),
  contentHash: Sha256Schema.nullable(),
}).strict().superRefine((value, context) => {
  if (
    (value.type === "directory"
      && (value.mode !== "0555" || value.byteLength !== 0 || value.contentHash !== null))
    || (value.type === "file" && value.contentHash === null)
  ) {
    context.addIssue({
      code: "custom",
      message: "Bootstrap rollback tree entry must be one exact directory or file",
    });
  }
});

export type NodeToolchainProvisionerBootstrapRollbackTreeEntryV2 = z.infer<
  typeof RollbackTreeEntryV2Schema
>;

export function buildNodeToolchainProvisionerBootstrapRollbackTreeEntriesV2(
  receipt: NodeToolchainProvisionerBootstrapInstallationReceiptV2,
): readonly NodeToolchainProvisionerBootstrapRollbackTreeEntryV2[] {
  const parsed = NodeToolchainProvisionerBootstrapInstallationReceiptV2Schema.parse(receipt);
  return Object.freeze([
    { locator: ".", type: "directory", mode: "0555", byteLength: 0, contentHash: null },
    { locator: "bin", type: "directory", mode: "0555", byteLength: 0, contentHash: null },
    {
      locator: parsed.claim.intent.source.members.launcher.locator,
      type: "file",
      mode: parsed.claim.intent.source.members.launcher.targetMode,
      byteLength: parsed.claim.intent.source.members.launcher.byteLength,
      contentHash: parsed.claim.intent.source.members.launcher.sha256,
    },
    { locator: "lib", type: "directory", mode: "0555", byteLength: 0, contentHash: null },
    {
      locator: parsed.claim.intent.source.members.bundle.locator,
      type: "file",
      mode: parsed.claim.intent.source.members.bundle.targetMode,
      byteLength: parsed.claim.intent.source.members.bundle.byteLength,
      contentHash: parsed.claim.intent.source.members.bundle.sha256,
    },
    {
      locator: parsed.claim.intent.source.members.manifest.locator,
      type: "file",
      mode: parsed.claim.intent.source.members.manifest.targetMode,
      byteLength: parsed.claim.intent.source.members.manifest.byteLength,
      contentHash: parsed.claim.intent.source.members.manifest.sha256,
    },
    { locator: "runtime", type: "directory", mode: "0555", byteLength: 0, contentHash: null },
    {
      locator: parsed.claim.intent.source.members.bootstrapRuntime.locator,
      type: "file",
      mode: parsed.claim.intent.source.members.bootstrapRuntime.targetMode,
      byteLength: parsed.claim.intent.source.members.bootstrapRuntime.byteLength,
      contentHash: parsed.claim.intent.source.members.bootstrapRuntime.sha256,
    },
  ].map((entry) => Object.freeze(RollbackTreeEntryV2Schema.parse(entry))));
}

export function hashNodeToolchainProvisionerBootstrapRollbackTreeEntriesV2(
  entries: readonly NodeToolchainProvisionerBootstrapRollbackTreeEntryV2[],
): string {
  return hashCanonicalJson({
    schema: "setfarm.node-toolchain-provisioner-bootstrap-rollback-tree-entries.v2",
    entries,
  });
}

const RollbackClaimIdentityV2Schema = z.object({
  schema: z.literal(NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_ROLLBACK_CLAIM_V2_SCHEMA),
  claimVersion: z.literal(NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_ROLLBACK_VERSION_V2),
  authorityRef: z.literal(NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_ROLLBACK_AUTHORITY_REF_V2),
  status: z.literal("removing_exact_generation"),
  plan: NodeToolchainProvisionerBootstrapRollbackPlanV2Schema,
  generation: ExactGenerationV2Schema,
  treeEntries: z.array(RollbackTreeEntryV2Schema).length(8),
  treeEntriesHash: Sha256Schema,
  protocol: z.object({
    serializationPolicy: z.literal("darwin_parent_descriptor_lockf_v2"),
    claimPolicy: z.literal("canonical_no_replace_rollback_claim_before_rename_v2"),
    quarantinePolicy: z.literal("claimed_root_private_stage_atomic_rename_v2"),
    removalPolicy: z.literal("every_only_restartable_bottom_up_v2"),
    completionPolicy: z.literal("content_addressed_tombstone_then_claim_last_v2"),
  }).strict(),
}).strict();

export type NodeToolchainProvisionerBootstrapRollbackClaimHashPayloadV2 = z.infer<
  typeof RollbackClaimIdentityV2Schema
>;

export function hashNodeToolchainProvisionerBootstrapRollbackClaimV2(
  value:
    | NodeToolchainProvisionerBootstrapRollbackClaimHashPayloadV2
    | NodeToolchainProvisionerBootstrapRollbackClaimV2,
): string {
  const claim = { ...value } as Record<string, unknown>;
  delete claim.claimHash;
  return hashCanonicalJson({
    schema: "setfarm.node-toolchain-provisioner-bootstrap-rollback-claim-hash.v2",
    claim,
  });
}

export const NodeToolchainProvisionerBootstrapRollbackClaimV2Schema =
  RollbackClaimIdentityV2Schema.safeExtend({
    claimHash: Sha256Schema,
  }).strict().superRefine((value, context) => {
    const expectedEntries = buildNodeToolchainProvisionerBootstrapRollbackTreeEntriesV2(
      value.plan.installed,
    );
    if (
      Object.entries(value.plan.generation).some(([key, expected]) =>
        value.generation[key as keyof typeof value.generation] !== expected)
      || hashCanonicalJson(value.treeEntries) !== hashCanonicalJson(expectedEntries)
      || value.treeEntriesHash
        !== hashNodeToolchainProvisionerBootstrapRollbackTreeEntriesV2(value.treeEntries)
      || value.claimHash !== hashNodeToolchainProvisionerBootstrapRollbackClaimV2(value)
    ) {
      context.addIssue({
        code: "custom",
        message: "Bootstrap rollback claim must bind every member of its exact plan generation",
      });
    }
  });

export type NodeToolchainProvisionerBootstrapRollbackClaimV2 = z.infer<
  typeof NodeToolchainProvisionerBootstrapRollbackClaimV2Schema
>;

export function buildNodeToolchainProvisionerBootstrapRollbackClaimV2(
  plan: NodeToolchainProvisionerBootstrapRollbackPlanV2,
): NodeToolchainProvisionerBootstrapRollbackClaimV2 {
  const parsedPlan = NodeToolchainProvisionerBootstrapRollbackPlanV2Schema.parse(plan);
  const treeEntries = buildNodeToolchainProvisionerBootstrapRollbackTreeEntriesV2(
    parsedPlan.installed,
  );
  const identity: NodeToolchainProvisionerBootstrapRollbackClaimHashPayloadV2 = {
    schema: NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_ROLLBACK_CLAIM_V2_SCHEMA,
    claimVersion: NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_ROLLBACK_VERSION_V2,
    authorityRef: NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_ROLLBACK_AUTHORITY_REF_V2,
    status: "removing_exact_generation",
    plan: parsedPlan,
    generation: parsedPlan.generation,
    treeEntries: [...treeEntries],
    treeEntriesHash: hashNodeToolchainProvisionerBootstrapRollbackTreeEntriesV2(treeEntries),
    protocol: {
      serializationPolicy: "darwin_parent_descriptor_lockf_v2",
      claimPolicy: "canonical_no_replace_rollback_claim_before_rename_v2",
      quarantinePolicy: "claimed_root_private_stage_atomic_rename_v2",
      removalPolicy: "every_only_restartable_bottom_up_v2",
      completionPolicy: "content_addressed_tombstone_then_claim_last_v2",
    },
  };
  return NodeToolchainProvisionerBootstrapRollbackClaimV2Schema.parse({
    ...identity,
    claimHash: hashNodeToolchainProvisionerBootstrapRollbackClaimV2(identity),
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

const RollbackReceiptIdentityV2Schema = z.object({
  schema: z.literal(NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_ROLLBACK_RECEIPT_V2_SCHEMA),
  receiptVersion: z.literal(NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_ROLLBACK_VERSION_V2),
  authorityRef: z.literal(NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_ROLLBACK_AUTHORITY_REF_V2),
  status: z.literal("rolled_back_verified"),
  admissionScope: AdmissionScopeV2Schema,
  planHash: Sha256Schema,
  claim: NodeToolchainProvisionerBootstrapRollbackClaimV2Schema,
  removedGeneration: ExactGenerationV2Schema,
  publisher: z.object({
    contractRef: z.literal("NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_ROLLBACK_V2"),
    lockExecutionPolicy: z.literal("exact_lockf_fd_then_exact_cat_pipe_v2"),
    lockf: ExactSystemToolV2Schema.extend({ toolRef: z.literal("MACOS_LOCKF_V2") }).strict(),
    lockHelper: ExactSystemToolV2Schema.extend({
      toolRef: z.literal("MACOS_CAT_LOCK_HELPER_V2"),
    }).strict(),
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

export type NodeToolchainProvisionerBootstrapRollbackReceiptHashPayloadV2 = z.infer<
  typeof RollbackReceiptIdentityV2Schema
>;

export function hashNodeToolchainProvisionerBootstrapRollbackReceiptV2(
  value:
    | NodeToolchainProvisionerBootstrapRollbackReceiptHashPayloadV2
    | NodeToolchainProvisionerBootstrapRollbackReceiptV2,
): string {
  const receipt = { ...value } as Record<string, unknown>;
  delete receipt.receiptHash;
  return hashCanonicalJson({
    schema: "setfarm.node-toolchain-provisioner-bootstrap-rollback-receipt-hash.v2",
    receipt,
  });
}

export const NodeToolchainProvisionerBootstrapRollbackReceiptV2Schema =
  RollbackReceiptIdentityV2Schema.safeExtend({
    receiptHash: Sha256Schema,
  }).strict().superRefine((value, context) => {
    const plan = value.claim.plan;
    if (
      value.admissionScope !== plan.admissionScope
      || value.planHash !== plan.planHash
      || Object.entries(value.claim.generation).some(([key, expected]) =>
        value.removedGeneration[key as keyof typeof value.removedGeneration] !== expected)
      || value.receiptFile.locatorHash !== plan.target.rollbackReceiptLocatorHash
      || value.receiptFile.ownerUid !== plan.installed.claim.intent.target.expectedOwnerUid
      || value.receiptFile.ownerGid !== plan.installed.claim.intent.target.expectedOwnerGid
      || value.receiptHash !== hashNodeToolchainProvisionerBootstrapRollbackReceiptV2(value)
    ) {
      context.addIssue({
        code: "custom",
        message: "Bootstrap rollback receipt must retain one exact removed generation and claim",
      });
    }
  });

export type NodeToolchainProvisionerBootstrapRollbackReceiptV2 = z.infer<
  typeof NodeToolchainProvisionerBootstrapRollbackReceiptV2Schema
>;

export function buildNodeToolchainProvisionerBootstrapRollbackReceiptV2(input: Readonly<{
  claim: NodeToolchainProvisionerBootstrapRollbackClaimV2;
  publisher: Readonly<{
    executionPolicy: "exact_lockf_fd_then_exact_cat_pipe_v2";
    lockf: z.infer<typeof ExactSystemToolV2Schema> & { toolRef: "MACOS_LOCKF_V2" };
    lockHelper: z.infer<typeof ExactSystemToolV2Schema> & {
      toolRef: "MACOS_CAT_LOCK_HELPER_V2";
    };
  }>;
}>): NodeToolchainProvisionerBootstrapRollbackReceiptV2 {
  const claim = NodeToolchainProvisionerBootstrapRollbackClaimV2Schema.parse(input.claim);
  const intent = claim.plan.installed.claim.intent;
  const identity: NodeToolchainProvisionerBootstrapRollbackReceiptHashPayloadV2 = {
    schema: NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_ROLLBACK_RECEIPT_V2_SCHEMA,
    receiptVersion: NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_ROLLBACK_VERSION_V2,
    authorityRef: NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_ROLLBACK_AUTHORITY_REF_V2,
    status: "rolled_back_verified",
    admissionScope: claim.plan.admissionScope,
    planHash: claim.plan.planHash,
    claim,
    removedGeneration: claim.generation,
    publisher: {
      contractRef: "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_ROLLBACK_V2",
      lockExecutionPolicy: input.publisher.executionPolicy,
      lockf: input.publisher.lockf,
      lockHelper: input.publisher.lockHelper,
    },
    receiptFile: {
      locatorHash: claim.plan.target.rollbackReceiptLocatorHash,
      mode: "0444",
      ownerUid: intent.target.expectedOwnerUid,
      ownerGid: intent.target.expectedOwnerGid,
      linkCount: 1,
      publicationPolicy: "canonical_stage_hard_link_no_replace_fsync_v2",
    },
  };
  return NodeToolchainProvisionerBootstrapRollbackReceiptV2Schema.parse({
    ...identity,
    receiptHash: hashNodeToolchainProvisionerBootstrapRollbackReceiptV2(identity),
  });
}
