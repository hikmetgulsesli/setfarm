import { z } from "zod";
import path from "node:path";

import { hashCanonicalJson } from "../canonical-json.js";
import { Sha256Schema } from "./common-v1.js";
import {
  NodeToolchainProvisionerBootstrapPreparedPackageReceiptV2Schema,
} from "./node-toolchain-provisioner-bootstrap-prepared-package-v2.js";

export const NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_INSPECTION_V2_SCHEMA =
  "setfarm.node-toolchain-provisioner-bootstrap-installation-inspection.v2" as const;
export const NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_PLAN_V2_SCHEMA =
  "setfarm.node-toolchain-provisioner-bootstrap-installation-plan.v2" as const;
export const NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_VERSION_V2 = "2.0.0" as const;
export const NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_AUTHORITY_REF_V2 =
  "AUTH_NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_V2" as const;
export const NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_RECEIPT_BASENAME_V2 =
  "node-toolchain-provisioner-v2.installation-receipt.v2.json" as const;
export const NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_CLAIM_BASENAME_V2 =
  ".setfarm-node-toolchain-provisioner-installation-v2.claim.json" as const;
export const NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_LOCK_BASENAME_V2 =
  ".setfarm-node-toolchain-provisioner-installation-v2.lock" as const;
export const NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_STAGING_BASENAME_V2 =
  ".setfarm-node-toolchain-provisioner-installation-v2.staging" as const;
export const NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_SYSTEM_ANCESTOR_V2 =
  "/Library/Application Support" as const;
export const NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_SETFARM_ROOT_V2 =
  "/Library/Application Support/Setfarm" as const;

export type NodeToolchainProvisionerBootstrapInstallationLocatorRoleV2 =
  | "systemAncestor"
  | "setfarmRoot"
  | "parent"
  | "root"
  | "receipt"
  | "claim"
  | "lock"
  | "staging";

export function hashNodeToolchainProvisionerBootstrapInstallationLocatorV2(
  role: NodeToolchainProvisionerBootstrapInstallationLocatorRoleV2,
  absoluteLocator: string,
): string {
  if (
    !path.isAbsolute(absoluteLocator)
    || path.normalize(absoluteLocator) !== absoluteLocator
    || absoluteLocator.includes("\0")
  ) {
    throw new TypeError("Bootstrap installation locator must be one normalized absolute path");
  }
  return hashCanonicalJson({
    schema: "setfarm.node-toolchain-provisioner-bootstrap-installation-locator-hash.v2",
    role,
    absoluteLocator,
  });
}

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
  package: PackageObservationV2Schema,
  classification: z.enum(["target_absent_clean", "target_exact_unclaimed", "conflict"]),
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
    if (value.package.status === "verified" && value.package.sourceMatch) {
      expectedConflicts.push("target_exact_but_unclaimed");
    } else if (value.package.status !== "absent") {
      expectedConflicts.push("target_package_invalid");
    }
    const operationalConflicts = [
      [value.filesystem.receipt, "installation_receipt_present_without_v2_authority"],
      [value.filesystem.claim, "installation_claim_present_without_v2_authority"],
      [value.filesystem.lock, "installation_lock_present_without_v2_authority"],
      [value.filesystem.staging, "installation_staging_present_without_v2_authority"],
    ] as const;
    for (const [entry, conflict] of operationalConflicts) {
      if (entry.state !== "absent") expectedConflicts.push(conflict);
    }
    expectedConflicts.sort();
    const derivedClassification = expectedConflicts.length === 0
      ? "target_absent_clean"
      : value.package.status === "verified"
        && value.package.sourceMatch
        && expectedConflicts.length === 1
        && expectedConflicts[0] === "target_exact_but_unclaimed"
        ? "target_exact_unclaimed"
        : "conflict";
    if (
      new Set(value.conflicts).size !== value.conflicts.length
      || expectedConflicts.length !== value.conflicts.length
      || expectedConflicts.some((entry, index) => entry !== value.conflicts[index])
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
  admissionScope: z.enum(["production_release", "test_fixture"]),
  source: NodeToolchainProvisionerBootstrapPreparedPackageReceiptV2Schema,
  inspection: NodeToolchainProvisionerBootstrapInstallationInspectionV2Schema,
  decision: z.enum(["publish_new", "no_mutation_blocked"]),
  protocol: z.object({
    serialization: z.literal("darwin_parent_descriptor_lockf_v2"),
    claim: z.literal("canonical_no_replace_claim_before_root_v2"),
    root: z.literal("exclusive_inaccessible_root_then_read_only_v2"),
    files: z.literal("exclusive_copy_fchown_fchmod_fsync_v2"),
    manifest: z.literal("manifest_last_v2"),
    receipt: z.literal("canonical_no_replace_receipt_after_verified_root_v2"),
    recovery: z.literal("exact_claim_bounded_rebuild_v2"),
  }).strict(),
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
    const root = value.source.target.rootLocator;
    const parent = path.dirname(root);
    const production = value.admissionScope === "production_release";
    const setfarmRoot = production
      ? NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_SETFARM_ROOT_V2
      : parent;
    const systemAncestor = production
      ? NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_SYSTEM_ANCESTOR_V2
      : parent;
    const expectedLocators = {
      rootLocatorHash: hashNodeToolchainProvisionerBootstrapInstallationLocatorV2("root", root),
      parentLocatorHash: hashNodeToolchainProvisionerBootstrapInstallationLocatorV2("parent", parent),
      setfarmRootLocatorHash: hashNodeToolchainProvisionerBootstrapInstallationLocatorV2(
        "setfarmRoot",
        setfarmRoot,
      ),
      systemAncestorLocatorHash: hashNodeToolchainProvisionerBootstrapInstallationLocatorV2(
        "systemAncestor",
        systemAncestor,
      ),
      receiptLocatorHash: hashNodeToolchainProvisionerBootstrapInstallationLocatorV2(
        "receipt",
        path.join(parent, NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_RECEIPT_BASENAME_V2),
      ),
      claimLocatorHash: hashNodeToolchainProvisionerBootstrapInstallationLocatorV2(
        "claim",
        path.join(parent, NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_CLAIM_BASENAME_V2),
      ),
      lockLocatorHash: hashNodeToolchainProvisionerBootstrapInstallationLocatorV2(
        "lock",
        path.join(parent, NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_LOCK_BASENAME_V2),
      ),
      stagingLocatorHash: hashNodeToolchainProvisionerBootstrapInstallationLocatorV2(
        "staging",
        path.join(parent, NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_STAGING_BASENAME_V2),
      ),
    };
    if (
      value.admissionScope !== value.source.admissionScope
      || value.admissionScope !== value.inspection.admissionScope
      || value.source.receiptHash !== value.inspection.source.preparedReceiptHash
      || value.source.source.manifestHash !== value.inspection.source.manifestHash
      || value.source.source.architecture !== value.inspection.source.architecture
      || Object.entries(expectedLocators).some(([key, hash]) =>
        value.inspection.target[key as keyof typeof expectedLocators] !== hash)
      || value.inspection.target.expectedOwnerUid !== value.source.target.expectedOwnerUid
      || value.inspection.target.expectedOwnerGid !== value.source.target.expectedOwnerGid
      || (value.decision === "publish_new"
        && value.inspection.classification !== "target_absent_clean")
      || (value.decision === "no_mutation_blocked"
        && value.inspection.classification === "target_absent_clean")
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
