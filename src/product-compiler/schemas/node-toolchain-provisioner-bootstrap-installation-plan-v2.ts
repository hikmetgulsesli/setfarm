import { z } from "zod";

import { hashCanonicalJson } from "../canonical-json.js";
import { Sha256Schema } from "./common-v1.js";
import {
  NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_AUTHORITY_REF_V2,
  NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_CLAIM_BASENAME_V2,
  NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_LOCK_BASENAME_V2,
  NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_RECEIPT_BASENAME_V2,
  NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_SETFARM_ROOT_V2,
  NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_STAGING_PREFIX_V2,
  NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_SYSTEM_ANCESTOR_V2,
  NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_VERSION_V2,
  NodeToolchainProvisionerBootstrapInstallationIntentV2Schema,
  buildNodeToolchainProvisionerBootstrapInstallationClaimV2,
  hashNodeToolchainProvisionerBootstrapInstallationLocatorV2,
  type NodeToolchainProvisionerBootstrapInstallationLocatorRoleV2,
} from "./node-toolchain-provisioner-bootstrap-installation-state-v2.js";

export {
  NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_AUTHORITY_REF_V2,
  NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_CLAIM_BASENAME_V2,
  NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_LOCK_BASENAME_V2,
  NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_RECEIPT_BASENAME_V2,
  NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_SETFARM_ROOT_V2,
  NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_STAGING_PREFIX_V2,
  NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_SYSTEM_ANCESTOR_V2,
  NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_VERSION_V2,
  hashNodeToolchainProvisionerBootstrapInstallationLocatorV2,
  type NodeToolchainProvisionerBootstrapInstallationLocatorRoleV2,
} from "./node-toolchain-provisioner-bootstrap-installation-state-v2.js";

export const NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_INSPECTION_V2_SCHEMA =
  "setfarm.node-toolchain-provisioner-bootstrap-installation-inspection.v2" as const;
export const NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_PLAN_V2_SCHEMA =
  "setfarm.node-toolchain-provisioner-bootstrap-installation-plan.v2" as const;
const PosixIdentityV2Schema = z.number().int().nonnegative().max(2_147_483_647);
const FilesystemIdentityV2Schema = z.number().int().nonnegative().safe();
const ModeV2Schema = z.string().regex(/^[0-7]{4}$/);

const AbsentEntryV2Schema = z.object({
  state: z.literal("absent"),
  locatorHash: Sha256Schema,
}).strict();

const PresentEntryV2Schema = z.object({
  state: z.literal("present"),
  locatorHash: Sha256Schema,
  physicalFingerprint: Sha256Schema,
  type: z.enum(["directory", "file", "symlink", "other"]),
  mode: ModeV2Schema,
  ownerUid: PosixIdentityV2Schema,
  ownerGid: PosixIdentityV2Schema,
  linkCount: z.number().int().positive().safe(),
  device: FilesystemIdentityV2Schema,
  inode: FilesystemIdentityV2Schema,
  byteLength: z.number().int().nonnegative().safe(),
}).strict();

export const NodeToolchainProvisionerBootstrapInstallationEntryV2Schema =
  z.discriminatedUnion("state", [AbsentEntryV2Schema, PresentEntryV2Schema]);

export type NodeToolchainProvisionerBootstrapInstallationEntryV2 = z.infer<
  typeof NodeToolchainProvisionerBootstrapInstallationEntryV2Schema
>;

const ProductionBoundaryV2Schema = z.object({
  kind: z.literal("production_system_boundary"),
  systemAncestor: NodeToolchainProvisionerBootstrapInstallationEntryV2Schema,
  setfarmRoot: NodeToolchainProvisionerBootstrapInstallationEntryV2Schema,
  packageParent: NodeToolchainProvisionerBootstrapInstallationEntryV2Schema,
}).strict();

const TestBoundaryV2Schema = z.object({
  kind: z.literal("test_private_boundary"),
  packageParent: NodeToolchainProvisionerBootstrapInstallationEntryV2Schema,
}).strict();

const ConflictV2Schema = z.enum([
  "system_ancestor_invalid",
  "setfarm_root_invalid",
  "package_parent_invalid",
  "target_package_invalid",
  "target_exact_but_unclaimed",
  "installation_receipt_present_without_v2_authority",
  "installation_claim_present_without_v2_authority",
  "installation_lock_present_without_v2_authority",
  "installation_staging_present_without_v2_authority",
]);

const LockObservationV2Schema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("absent") }).strict(),
  z.object({ status: z.literal("verified") }).strict(),
  z.object({
    status: z.literal("invalid"),
    failureKind: z.enum(["metadata_mismatch", "content_mismatch"]),
  }).strict(),
]);

const ClaimObservationV2Schema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("absent") }).strict(),
  z.object({
    status: z.literal("verified"),
    claimHash: Sha256Schema,
    sourceMatch: z.boolean(),
  }).strict(),
  z.object({
    status: z.literal("invalid"),
    failureKind: z.enum(["metadata_mismatch", "contract_mismatch"]),
  }).strict(),
]);

const ReceiptObservationV2Schema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("absent") }).strict(),
  z.object({
    status: z.literal("verified"),
    receiptHash: Sha256Schema,
    claimHash: Sha256Schema,
    sourceMatch: z.boolean(),
  }).strict(),
  z.object({
    status: z.literal("invalid"),
    failureKind: z.enum(["metadata_mismatch", "contract_mismatch"]),
  }).strict(),
]);

const StagingObservationV2Schema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("absent") }).strict(),
  z.object({
    status: z.literal("claim_stage_verified"),
    claimHash: Sha256Schema,
    sourceMatch: z.boolean(),
  }).strict(),
  z.object({ status: z.literal("present_unverified") }).strict(),
]);

const PackageObservationV2Schema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("absent") }).strict(),
  z.object({
    status: z.literal("verified"),
    manifestHash: Sha256Schema,
    sourceMatch: z.boolean(),
  }).strict(),
  z.object({
    status: z.literal("invalid"),
    failureKind: z.enum(["not_directory", "package_contract_mismatch"]),
  }).strict(),
]);

const InspectionIdentityV2Schema = z.object({
  schema: z.literal(NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_INSPECTION_V2_SCHEMA),
  inspectionVersion: z.literal(NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_VERSION_V2),
  authorityRef: z.literal(NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_AUTHORITY_REF_V2),
  admissionScope: z.enum(["production_release", "test_fixture"]),
  source: z.object({
    preparedReceiptHash: Sha256Schema,
    manifestHash: Sha256Schema,
    architecture: z.enum(["arm64", "x64"]),
  }).strict(),
  target: z.object({
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
    expectedRootMode: z.literal("0555"),
    expectedDirectoryMode: z.literal("0555"),
    expectedManifestMode: z.literal("0444"),
  }).strict(),
  boundary: z.discriminatedUnion("kind", [ProductionBoundaryV2Schema, TestBoundaryV2Schema]),
  filesystem: z.object({
    root: NodeToolchainProvisionerBootstrapInstallationEntryV2Schema,
    receipt: NodeToolchainProvisionerBootstrapInstallationEntryV2Schema,
    claim: NodeToolchainProvisionerBootstrapInstallationEntryV2Schema,
    lock: NodeToolchainProvisionerBootstrapInstallationEntryV2Schema,
    staging: NodeToolchainProvisionerBootstrapInstallationEntryV2Schema,
  }).strict(),
  operational: z.object({
    lock: LockObservationV2Schema,
    claim: ClaimObservationV2Schema,
    receipt: ReceiptObservationV2Schema,
    staging: StagingObservationV2Schema,
  }).strict(),
  package: PackageObservationV2Schema,
  classification: z.enum([
    "target_absent_clean",
    "target_exact_unclaimed",
    "ready_verified",
    "claimed_recovery_candidate",
    "conflict",
  ]),
  conflicts: z.array(ConflictV2Schema).max(9),
}).strict();

export type NodeToolchainProvisionerBootstrapInstallationInspectionHashPayloadV2 = z.infer<
  typeof InspectionIdentityV2Schema
>;

export function hashNodeToolchainProvisionerBootstrapInstallationInspectionV2(
  value:
    | NodeToolchainProvisionerBootstrapInstallationInspectionHashPayloadV2
    | NodeToolchainProvisionerBootstrapInstallationInspectionV2,
): string {
  const inspection = { ...value } as Record<string, unknown>;
  delete inspection.inspectionHash;
  return hashCanonicalJson({
    schema: "setfarm.node-toolchain-provisioner-bootstrap-installation-inspection-hash.v2",
    inspection,
  });
}

export const NodeToolchainProvisionerBootstrapInstallationInspectionV2Schema =
  InspectionIdentityV2Schema.safeExtend({
    inspectionHash: Sha256Schema,
  }).strict().superRefine((value, context) => {
    const exactDirectory = (
      entry: NodeToolchainProvisionerBootstrapInstallationEntryV2,
      uid: number,
      gid: number | undefined,
      mode: "0700" | "0755",
    ): boolean => entry.state === "present"
      && entry.type === "directory"
      && entry.ownerUid === uid
      && (gid === undefined || entry.ownerGid === gid)
      && entry.mode === mode;
    const expectedConflicts: z.infer<typeof ConflictV2Schema>[] = [];
    if (value.boundary.kind === "production_system_boundary") {
      if (!exactDirectory(value.boundary.systemAncestor, 0, undefined, "0755")) {
        expectedConflicts.push("system_ancestor_invalid");
      }
      if (
        value.boundary.setfarmRoot.state !== "absent"
        && !exactDirectory(value.boundary.setfarmRoot, 0, 0, "0755")
      ) {
        expectedConflicts.push("setfarm_root_invalid");
      }
      if (
        value.boundary.packageParent.state !== "absent"
        && !exactDirectory(value.boundary.packageParent, 0, 0, "0755")
      ) {
        expectedConflicts.push("package_parent_invalid");
      }
    } else if (!exactDirectory(
      value.boundary.packageParent,
      value.target.expectedOwnerUid,
      value.target.expectedOwnerGid,
      "0700",
    )) {
      expectedConflicts.push("package_parent_invalid");
    }
    const matchingClaim = value.operational.claim.status === "verified"
      && value.operational.claim.sourceMatch;
    const matchingReceipt = value.operational.receipt.status === "verified"
      && value.operational.receipt.sourceMatch;
    const matchingStagedClaim = value.operational.staging.status === "claim_stage_verified"
      && value.operational.staging.sourceMatch;
    const matchingPackage = value.package.status === "verified" && value.package.sourceMatch;
    if (value.operational.lock.status === "invalid") {
      expectedConflicts.push("installation_lock_present_without_v2_authority");
    }
    if (
      value.operational.claim.status === "invalid"
      || (value.operational.claim.status === "verified" && !value.operational.claim.sourceMatch)
    ) {
      expectedConflicts.push("installation_claim_present_without_v2_authority");
    }
    if (
      value.operational.receipt.status === "invalid"
      || (value.operational.receipt.status === "verified" && !value.operational.receipt.sourceMatch)
    ) {
      expectedConflicts.push("installation_receipt_present_without_v2_authority");
    }
    if (
      value.filesystem.staging.state !== "absent"
      && !matchingClaim
      && !matchingStagedClaim
    ) {
      expectedConflicts.push("installation_staging_present_without_v2_authority");
    }
    if (matchingReceipt) {
      if (!matchingClaim) {
        expectedConflicts.push("installation_claim_present_without_v2_authority");
      }
      if (!matchingPackage) expectedConflicts.push("target_package_invalid");
    } else if (!matchingClaim) {
      if (matchingPackage) expectedConflicts.push("target_exact_but_unclaimed");
      else if (value.package.status !== "absent") expectedConflicts.push("target_package_invalid");
    }
    const normalizedExpectedConflicts = [...new Set(expectedConflicts)].sort();
    const derivedClassification = normalizedExpectedConflicts.length > 0
      ? normalizedExpectedConflicts.length === 1
        && normalizedExpectedConflicts[0] === "target_exact_but_unclaimed"
        ? "target_exact_unclaimed"
        : "conflict"
      : matchingReceipt && matchingClaim && matchingPackage
        ? value.filesystem.staging.state === "absent"
          ? "ready_verified"
          : "claimed_recovery_candidate"
        : (matchingClaim || matchingStagedClaim)
          && value.operational.receipt.status === "absent"
          ? "claimed_recovery_candidate"
          : value.package.status === "absent"
            && value.operational.claim.status === "absent"
            && value.operational.receipt.status === "absent"
            && value.filesystem.staging.state === "absent"
            ? "target_absent_clean"
            : "conflict";
    if (
      new Set(value.conflicts).size !== value.conflicts.length
      || normalizedExpectedConflicts.length !== value.conflicts.length
      || normalizedExpectedConflicts.some((entry, index) => entry !== value.conflicts[index])
    ) {
      context.addIssue({
        code: "custom",
        path: ["conflicts"],
        message: "Bootstrap installation conflicts must be one sorted unique exact set",
      });
    }
    if (
      (value.admissionScope === "production_release"
        && value.boundary.kind !== "production_system_boundary")
      || (value.admissionScope === "test_fixture"
        && value.boundary.kind !== "test_private_boundary")
      || value.filesystem.root.locatorHash !== value.target.rootLocatorHash
      || value.filesystem.receipt.locatorHash !== value.target.receiptLocatorHash
      || value.filesystem.claim.locatorHash !== value.target.claimLocatorHash
      || value.filesystem.lock.locatorHash !== value.target.lockLocatorHash
      || value.filesystem.staging.locatorHash !== value.target.stagingLocatorHash
      || (value.boundary.kind === "production_system_boundary"
        && (
          value.boundary.systemAncestor.locatorHash !== value.target.systemAncestorLocatorHash
          || value.boundary.setfarmRoot.locatorHash !== value.target.setfarmRootLocatorHash
          || value.boundary.packageParent.locatorHash !== value.target.parentLocatorHash
        ))
      || (value.boundary.kind === "test_private_boundary"
        && value.boundary.packageParent.locatorHash !== value.target.parentLocatorHash)
      || (value.filesystem.root.state === "absent" && value.package.status !== "absent")
      || (value.filesystem.root.state === "present" && value.package.status === "absent")
      || (value.filesystem.lock.state === "absent" && value.operational.lock.status !== "absent")
      || (value.filesystem.lock.state === "present" && value.operational.lock.status === "absent")
      || (value.filesystem.claim.state === "absent" && value.operational.claim.status !== "absent")
      || (value.filesystem.claim.state === "present" && value.operational.claim.status === "absent")
      || (value.filesystem.receipt.state === "absent"
        && value.operational.receipt.status !== "absent")
      || (value.filesystem.receipt.state === "present"
        && value.operational.receipt.status === "absent")
      || (value.operational.receipt.status === "verified"
        && value.operational.claim.status === "verified"
        && value.operational.receipt.claimHash !== value.operational.claim.claimHash)
      || (value.filesystem.staging.state === "absent"
        && value.operational.staging.status !== "absent")
      || (value.filesystem.staging.state === "present"
        && value.operational.staging.status === "absent")
      || value.classification !== derivedClassification
    ) {
      context.addIssue({
        code: "custom",
        path: ["classification"],
        message: "Bootstrap installation classification must equal its physical evidence",
      });
    }
    if (value.inspectionHash !== hashNodeToolchainProvisionerBootstrapInstallationInspectionV2(value)) {
      context.addIssue({
        code: "custom",
        path: ["inspectionHash"],
        message: "Bootstrap installation inspection hash mismatch",
      });
    }
  });

export type NodeToolchainProvisionerBootstrapInstallationInspectionV2 = z.infer<
  typeof NodeToolchainProvisionerBootstrapInstallationInspectionV2Schema
>;

const PlanIdentityV2Schema = z.object({
  schema: z.literal(NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_PLAN_V2_SCHEMA),
  planVersion: z.literal(NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_VERSION_V2),
  authorityRef: z.literal(NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_AUTHORITY_REF_V2),
  operation: z.literal("install_bootstrap_package"),
  intent: NodeToolchainProvisionerBootstrapInstallationIntentV2Schema,
  inspection: NodeToolchainProvisionerBootstrapInstallationInspectionV2Schema,
  decision: z.enum([
    "publish_new",
    "return_ready",
    "recover_claimed",
    "no_mutation_blocked",
  ]),
}).strict();

export type NodeToolchainProvisionerBootstrapInstallationPlanHashPayloadV2 = z.infer<
  typeof PlanIdentityV2Schema
>;

export function hashNodeToolchainProvisionerBootstrapInstallationPlanV2(
  value:
    | NodeToolchainProvisionerBootstrapInstallationPlanHashPayloadV2
    | NodeToolchainProvisionerBootstrapInstallationPlanV2,
): string {
  const plan = { ...value } as Record<string, unknown>;
  delete plan.planHash;
  return hashCanonicalJson({
    schema: "setfarm.node-toolchain-provisioner-bootstrap-installation-plan-hash.v2",
    plan,
  });
}

export const NodeToolchainProvisionerBootstrapInstallationPlanV2Schema =
  PlanIdentityV2Schema.safeExtend({
    planHash: Sha256Schema,
  }).strict().superRefine((value, context) => {
    const expectedLocators = {
      rootLocatorHash: value.intent.target.rootLocatorHash,
      parentLocatorHash: value.intent.target.parentLocatorHash,
      setfarmRootLocatorHash: value.intent.target.setfarmRootLocatorHash,
      systemAncestorLocatorHash: value.intent.target.systemAncestorLocatorHash,
      receiptLocatorHash: value.intent.target.receiptLocatorHash,
      claimLocatorHash: value.intent.target.claimLocatorHash,
      lockLocatorHash: value.intent.target.lockLocatorHash,
      stagingLocatorHash: value.intent.target.stagingLocatorHash,
    };
    const expectedClaimHash =
      buildNodeToolchainProvisionerBootstrapInstallationClaimV2(value.intent).claimHash;
    const claimMatchIsExact = value.inspection.operational.claim.status !== "verified"
      || value.inspection.operational.claim.sourceMatch
        === (value.inspection.operational.claim.claimHash === expectedClaimHash);
    const receiptMatchIsExact = value.inspection.operational.receipt.status !== "verified"
      || value.inspection.operational.receipt.sourceMatch
        === (value.inspection.operational.receipt.claimHash === expectedClaimHash);
    const stagingMatchIsExact =
      value.inspection.operational.staging.status !== "claim_stage_verified"
      || value.inspection.operational.staging.sourceMatch
        === (value.inspection.operational.staging.claimHash === expectedClaimHash);
    const packageMatchIsExact = value.inspection.package.status !== "verified"
      || value.inspection.package.sourceMatch
        === (value.inspection.package.manifestHash === value.intent.source.source.manifestHash);
    if (
      value.intent.admissionScope !== value.inspection.admissionScope
      || value.intent.source.receiptHash !== value.inspection.source.preparedReceiptHash
      || value.intent.source.source.manifestHash !== value.inspection.source.manifestHash
      || value.intent.source.source.architecture !== value.inspection.source.architecture
      || Object.entries(expectedLocators).some(([key, hash]) =>
        value.inspection.target[key as keyof typeof expectedLocators] !== hash)
      || value.inspection.target.expectedOwnerUid !== value.intent.target.expectedOwnerUid
      || value.inspection.target.expectedOwnerGid !== value.intent.target.expectedOwnerGid
      || !claimMatchIsExact
      || !receiptMatchIsExact
      || !stagingMatchIsExact
      || !packageMatchIsExact
      || value.decision !== (
        value.inspection.classification === "target_absent_clean"
          ? "publish_new"
          : value.inspection.classification === "ready_verified"
            ? "return_ready"
            : value.inspection.classification === "claimed_recovery_candidate"
              ? "recover_claimed"
              : "no_mutation_blocked"
      )
      || value.planHash !== hashNodeToolchainProvisionerBootstrapInstallationPlanV2(value)
    ) {
      context.addIssue({
        code: "custom",
        message: "Bootstrap installation plan must bind one source, inspection and decision",
      });
    }
  });

export type NodeToolchainProvisionerBootstrapInstallationPlanV2 = z.infer<
  typeof NodeToolchainProvisionerBootstrapInstallationPlanV2Schema
>;
