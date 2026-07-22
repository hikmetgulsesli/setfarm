import { lstatSync, type Stats } from "node:fs";
import path from "node:path";

import { hashCanonicalJson } from "./canonical-json.js";
import {
  openNodeToolchainProvisionerBootstrapPackageV2ForTest,
  openProductionNodeToolchainProvisionerBootstrapPackageV2,
  revalidateNodeToolchainProvisionerBootstrapPackageV2,
} from "./node-toolchain-provisioner-bootstrap-package-v2.js";
import {
  inspectNodeToolchainProvisionerBootstrapPreparedPackageManifestV2,
  revalidateNodeToolchainProvisionerBootstrapPreparedPackageV2,
  type PreparedNodeToolchainProvisionerBootstrapPackageV2,
} from "./node-toolchain-provisioner-bootstrap-prepared-package-v2.js";
import {
  NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_ROOT_V2,
} from "./schemas/node-toolchain-provisioner-bootstrap-v2.js";
import {
  NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_AUTHORITY_REF_V2,
  NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_CLAIM_BASENAME_V2,
  NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_INSPECTION_V2_SCHEMA,
  NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_LOCK_BASENAME_V2,
  NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_PLAN_V2_SCHEMA,
  NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_RECEIPT_BASENAME_V2,
  NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_SETFARM_ROOT_V2,
  NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_STAGING_BASENAME_V2,
  NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_SYSTEM_ANCESTOR_V2,
  NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_VERSION_V2,
  NodeToolchainProvisionerBootstrapInstallationInspectionV2Schema,
  NodeToolchainProvisionerBootstrapInstallationPlanV2Schema,
  hashNodeToolchainProvisionerBootstrapInstallationInspectionV2,
  hashNodeToolchainProvisionerBootstrapInstallationLocatorV2,
  hashNodeToolchainProvisionerBootstrapInstallationPlanV2,
  type NodeToolchainProvisionerBootstrapInstallationEntryV2,
  type NodeToolchainProvisionerBootstrapInstallationInspectionHashPayloadV2,
  type NodeToolchainProvisionerBootstrapInstallationInspectionV2,
  type NodeToolchainProvisionerBootstrapInstallationPlanHashPayloadV2,
  type NodeToolchainProvisionerBootstrapInstallationPlanV2,
  type NodeToolchainProvisionerBootstrapInstallationLocatorRoleV2,
} from "./schemas/node-toolchain-provisioner-bootstrap-installation-plan-v2.js";

export type NodeToolchainProvisionerBootstrapInstallationPlanErrorCodeV2 =
  | "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_V2_INPUT_INVALID"
  | "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_V2_INSPECTION_FAILED"
  | "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_V2_SCHEMA_INVALID";

export class NodeToolchainProvisionerBootstrapInstallationPlanErrorV2 extends Error {
  readonly code: NodeToolchainProvisionerBootstrapInstallationPlanErrorCodeV2;
  override readonly cause?: unknown;

  constructor(
    code: NodeToolchainProvisionerBootstrapInstallationPlanErrorCodeV2,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message.slice(0, 1_500), options);
    this.name = "NodeToolchainProvisionerBootstrapInstallationPlanErrorV2";
    this.code = code;
    this.cause = options?.cause;
  }
}

type InstallationEntryV2 = NodeToolchainProvisionerBootstrapInstallationEntryV2;

type InstallationConflictV2 =
  | "system_ancestor_invalid"
  | "setfarm_root_invalid"
  | "package_parent_invalid"
  | "target_package_invalid"
  | "target_exact_but_unclaimed"
  | "installation_receipt_present_without_v2_authority"
  | "installation_claim_present_without_v2_authority"
  | "installation_lock_present_without_v2_authority"
  | "installation_staging_present_without_v2_authority";

type FingerprintV2 = Readonly<{
  device: number;
  inode: number;
  mode: number;
  ownerUid: number;
  ownerGid: number;
  linkCount: number;
  byteLength: number;
  modifiedMs: number;
  changedMs: number;
}>;

type InstallationPathsV2 = Readonly<{
  systemAncestor: string;
  setfarmRoot: string;
  parent: string;
  root: string;
  receipt: string;
  claim: string;
  lock: string;
  staging: string;
}>;

function fail(
  code: NodeToolchainProvisionerBootstrapInstallationPlanErrorCodeV2,
  message: string,
  cause?: unknown,
): never {
  throw new NodeToolchainProvisionerBootstrapInstallationPlanErrorV2(
    code,
    message,
    cause === undefined ? undefined : { cause },
  );
}

function isNodeError(error: unknown, code: string): boolean {
  return error instanceof Error && "code" in error && error.code === code;
}

function fingerprint(stat: Stats): FingerprintV2 {
  return Object.freeze({
    device: stat.dev,
    inode: stat.ino,
    mode: stat.mode,
    ownerUid: stat.uid,
    ownerGid: stat.gid,
    linkCount: stat.nlink,
    byteLength: stat.size,
    modifiedMs: stat.mtimeMs,
    changedMs: stat.ctimeMs,
  });
}

function sameFingerprint(left: FingerprintV2, right: FingerprintV2): boolean {
  return left.device === right.device
    && left.inode === right.inode
    && left.mode === right.mode
    && left.ownerUid === right.ownerUid
    && left.ownerGid === right.ownerGid
    && left.linkCount === right.linkCount
    && left.byteLength === right.byteLength
    && left.modifiedMs === right.modifiedMs
    && left.changedMs === right.changedMs;
}

function modeText(stat: Stats): string {
  return (stat.mode & 0o7777).toString(8).padStart(4, "0");
}

function entryType(stat: Stats): "directory" | "file" | "symlink" | "other" {
  if (stat.isSymbolicLink()) return "symlink";
  if (stat.isDirectory()) return "directory";
  if (stat.isFile()) return "file";
  return "other";
}

function locatorHash(
  role: NodeToolchainProvisionerBootstrapInstallationLocatorRoleV2,
  absoluteLocator: string,
): string {
  try {
    return hashNodeToolchainProvisionerBootstrapInstallationLocatorV2(role, absoluteLocator);
  } catch (error) {
    return fail(
      "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_V2_INPUT_INVALID",
      "Bootstrap installation locator must be one normalized absolute path",
      error,
    );
  }
}

function captureEntry(
  role: NodeToolchainProvisionerBootstrapInstallationLocatorRoleV2,
  absoluteLocator: string,
): InstallationEntryV2 {
  const hash = locatorHash(role, absoluteLocator);
  try {
    const before = lstatSync(absoluteLocator);
    const after = lstatSync(absoluteLocator);
    if (!sameFingerprint(fingerprint(before), fingerprint(after))) {
      return fail(
        "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_V2_INSPECTION_FAILED",
        `Bootstrap installation ${role} changed during inspection`,
      );
    }
    return Object.freeze({
      state: "present" as const,
      locatorHash: hash,
      physicalFingerprint: hashCanonicalJson({
        schema: "setfarm.node-toolchain-provisioner-bootstrap-installation-physical-entry.v2",
        role,
        fingerprint: fingerprint(after),
      }),
      type: entryType(after),
      mode: modeText(after),
      ownerUid: after.uid,
      ownerGid: after.gid,
      linkCount: after.nlink,
      device: after.dev,
      inode: after.ino,
      byteLength: after.size,
    });
  } catch (error) {
    if (isNodeError(error, "ENOENT")) {
      try {
        lstatSync(absoluteLocator);
        return fail(
          "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_V2_INSPECTION_FAILED",
          `Bootstrap installation ${role} appeared during inspection`,
        );
      } catch (confirmationError) {
        if (isNodeError(confirmationError, "ENOENT")) {
          return Object.freeze({ state: "absent" as const, locatorHash: hash });
        }
        if (
          confirmationError
          instanceof NodeToolchainProvisionerBootstrapInstallationPlanErrorV2
        ) {
          throw confirmationError;
        }
        return fail(
          "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_V2_INSPECTION_FAILED",
          `Bootstrap installation ${role} absence could not be confirmed`,
          confirmationError,
        );
      }
    }
    if (error instanceof NodeToolchainProvisionerBootstrapInstallationPlanErrorV2) throw error;
    return fail(
      "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_V2_INSPECTION_FAILED",
      `Bootstrap installation ${role} could not be inspected`,
      error,
    );
  }
}

function sameEntry(left: InstallationEntryV2, right: InstallationEntryV2): boolean {
  return left.state === right.state
    && left.locatorHash === right.locatorHash
    && (left.state === "absent"
      || (right.state === "present"
        && left.physicalFingerprint === right.physicalFingerprint));
}

function exactDirectory(
  entry: InstallationEntryV2,
  expected: Readonly<{ uid: number; gid?: number; mode: "0700" | "0755" }>,
): boolean {
  return entry.state === "present"
    && entry.type === "directory"
    && entry.ownerUid === expected.uid
    && (expected.gid === undefined || entry.ownerGid === expected.gid)
    && entry.mode === expected.mode;
}

function pathsFor(input: Readonly<{
  admissionScope: "production_release" | "test_fixture";
  root: string;
}>): InstallationPathsV2 {
  if (
    !path.isAbsolute(input.root)
    || path.normalize(input.root) !== input.root
    || input.root.includes("\0")
  ) {
    return fail(
      "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_V2_INPUT_INVALID",
      "Prepared bootstrap target root is not one normalized absolute locator",
    );
  }
  const parent = path.dirname(input.root);
  const systemAncestor = input.admissionScope === "production_release"
    ? NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_SYSTEM_ANCESTOR_V2
    : parent;
  const setfarmRoot = input.admissionScope === "production_release"
    ? NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_SETFARM_ROOT_V2
    : parent;
  return Object.freeze({
    systemAncestor,
    setfarmRoot,
    parent,
    root: input.root,
    receipt: path.join(parent, NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_RECEIPT_BASENAME_V2),
    claim: path.join(parent, NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_CLAIM_BASENAME_V2),
    lock: path.join(parent, NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_LOCK_BASENAME_V2),
    staging: path.join(parent, NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_STAGING_BASENAME_V2),
  });
}

function deepFreezeJson<T>(value: T): T {
  if (value === null || typeof value !== "object") return value;
  const pending: object[] = [value as object];
  while (pending.length > 0) {
    const current = pending.pop()!;
    if (Object.isFrozen(current)) continue;
    for (const child of Object.values(current)) {
      if (child !== null && typeof child === "object" && !Object.isFrozen(child)) pending.push(child);
    }
    Object.freeze(current);
  }
  return value;
}

export function inspectNodeToolchainProvisionerBootstrapInstallationV2(
  preparedHandle: PreparedNodeToolchainProvisionerBootstrapPackageV2,
): NodeToolchainProvisionerBootstrapInstallationInspectionV2 {
  const source = revalidateNodeToolchainProvisionerBootstrapPreparedPackageV2(preparedHandle);
  const manifest = inspectNodeToolchainProvisionerBootstrapPreparedPackageManifestV2(preparedHandle);
  if (
    source.source.manifestHash !== manifest.manifestHash
    || source.target.rootLocator !== manifest.layout.rootLocator
    || source.target.expectedOwnerUid !== manifest.layout.expectedOwnerUid
    || source.target.expectedOwnerGid !== manifest.layout.expectedOwnerGid
    || source.source.architecture !== manifest.distribution.architecture
  ) {
    return fail(
      "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_V2_INPUT_INVALID",
      "Prepared bootstrap receipt and manifest do not identify one installation source",
    );
  }
  const paths = pathsFor({
    admissionScope: source.admissionScope,
    root: source.target.rootLocator,
  });
  if (
    source.admissionScope === "production_release"
    && paths.root !== NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_ROOT_V2
  ) {
    return fail(
      "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_V2_INPUT_INVALID",
      "Production prepared bootstrap target differs from its fixed code-owned root",
    );
  }
  const systemAncestor = captureEntry("systemAncestor", paths.systemAncestor);
  const setfarmRoot = captureEntry("setfarmRoot", paths.setfarmRoot);
  const packageParent = captureEntry("parent", paths.parent);
  const filesystem = {
    root: captureEntry("root", paths.root),
    receipt: captureEntry("receipt", paths.receipt),
    claim: captureEntry("claim", paths.claim),
    lock: captureEntry("lock", paths.lock),
    staging: captureEntry("staging", paths.staging),
  };
  const expectedOwner = {
    uid: source.target.expectedOwnerUid,
    gid: source.target.expectedOwnerGid,
  };
  const packageObservation = filesystem.root.state === "absent"
    ? Object.freeze({ status: "absent" as const })
    : (() => {
        if (filesystem.root.type !== "directory") {
          return Object.freeze({ status: "invalid" as const, failureKind: "not_directory" as const });
        }
        try {
          const handle = source.admissionScope === "production_release"
            ? openProductionNodeToolchainProvisionerBootstrapPackageV2()
            : openNodeToolchainProvisionerBootstrapPackageV2ForTest({
                root: paths.root,
                expectedOwner,
              });
          const installed = revalidateNodeToolchainProvisionerBootstrapPackageV2(handle);
          return Object.freeze({
            status: "verified" as const,
            manifestHash: installed.manifestHash,
            sourceMatch: installed.manifestHash === manifest.manifestHash,
          });
        } catch {
          return Object.freeze({
            status: "invalid" as const,
            failureKind: "package_contract_mismatch" as const,
          });
        }
      })();
  const recapturedEntries = {
    systemAncestor: captureEntry("systemAncestor", paths.systemAncestor),
    setfarmRoot: captureEntry("setfarmRoot", paths.setfarmRoot),
    packageParent: captureEntry("parent", paths.parent),
    root: captureEntry("root", paths.root),
    receipt: captureEntry("receipt", paths.receipt),
    claim: captureEntry("claim", paths.claim),
    lock: captureEntry("lock", paths.lock),
    staging: captureEntry("staging", paths.staging),
  };
  if (
    !sameEntry(systemAncestor, recapturedEntries.systemAncestor)
    || !sameEntry(setfarmRoot, recapturedEntries.setfarmRoot)
    || !sameEntry(packageParent, recapturedEntries.packageParent)
    || !sameEntry(filesystem.root, recapturedEntries.root)
    || !sameEntry(filesystem.receipt, recapturedEntries.receipt)
    || !sameEntry(filesystem.claim, recapturedEntries.claim)
    || !sameEntry(filesystem.lock, recapturedEntries.lock)
    || !sameEntry(filesystem.staging, recapturedEntries.staging)
  ) {
    return fail(
      "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_V2_INSPECTION_FAILED",
      "Bootstrap installation boundary changed during package inspection",
    );
  }
  const conflicts: InstallationConflictV2[] = [];
  if (source.admissionScope === "production_release") {
    if (!exactDirectory(systemAncestor, { uid: 0, mode: "0755" })) {
      conflicts.push("system_ancestor_invalid");
    }
    if (setfarmRoot.state !== "absent" && !exactDirectory(setfarmRoot, {
      uid: 0,
      gid: 0,
      mode: "0755",
    })) {
      conflicts.push("setfarm_root_invalid");
    }
    if (packageParent.state !== "absent" && !exactDirectory(packageParent, {
      uid: 0,
      gid: 0,
      mode: "0755",
    })) {
      conflicts.push("package_parent_invalid");
    }
  } else if (!exactDirectory(packageParent, {
    uid: expectedOwner.uid,
    gid: expectedOwner.gid,
    mode: "0700",
  })) {
    conflicts.push("package_parent_invalid");
  }
  if (packageObservation.status === "verified" && packageObservation.sourceMatch) {
    conflicts.push("target_exact_but_unclaimed");
  } else if (packageObservation.status !== "absent") {
    conflicts.push("target_package_invalid");
  }
  if (filesystem.receipt.state !== "absent") {
    conflicts.push("installation_receipt_present_without_v2_authority");
  }
  if (filesystem.claim.state !== "absent") {
    conflicts.push("installation_claim_present_without_v2_authority");
  }
  if (filesystem.lock.state !== "absent") {
    conflicts.push("installation_lock_present_without_v2_authority");
  }
  if (filesystem.staging.state !== "absent") {
    conflicts.push("installation_staging_present_without_v2_authority");
  }
  const sortedConflicts = [...new Set(conflicts)].sort();
  const classification = sortedConflicts.length === 0
    ? "target_absent_clean" as const
    : packageObservation.status === "verified"
      && packageObservation.sourceMatch
      && sortedConflicts.length === 1
      && sortedConflicts[0] === "target_exact_but_unclaimed"
      ? "target_exact_unclaimed" as const
      : "conflict" as const;
  const target = {
    rootLocatorHash: locatorHash("root", paths.root),
    parentLocatorHash: locatorHash("parent", paths.parent),
    setfarmRootLocatorHash: locatorHash("setfarmRoot", paths.setfarmRoot),
    systemAncestorLocatorHash: locatorHash("systemAncestor", paths.systemAncestor),
    receiptLocatorHash: locatorHash("receipt", paths.receipt),
    claimLocatorHash: locatorHash("claim", paths.claim),
    lockLocatorHash: locatorHash("lock", paths.lock),
    stagingLocatorHash: locatorHash("staging", paths.staging),
    expectedOwnerUid: expectedOwner.uid,
    expectedOwnerGid: expectedOwner.gid,
    expectedRootMode: "0555" as const,
    expectedDirectoryMode: "0555" as const,
    expectedManifestMode: "0444" as const,
  };
  const identity: NodeToolchainProvisionerBootstrapInstallationInspectionHashPayloadV2 = {
    schema: NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_INSPECTION_V2_SCHEMA,
    inspectionVersion: NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_VERSION_V2,
    authorityRef: NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_AUTHORITY_REF_V2,
    admissionScope: source.admissionScope,
    source: {
      preparedReceiptHash: source.receiptHash,
      manifestHash: manifest.manifestHash,
      architecture: source.source.architecture,
    },
    target,
    boundary: source.admissionScope === "production_release"
      ? {
          kind: "production_system_boundary",
          systemAncestor,
          setfarmRoot,
          packageParent,
        }
      : {
          kind: "test_private_boundary",
          packageParent,
        },
    filesystem,
    package: packageObservation,
    classification,
    conflicts: sortedConflicts,
  };
  const parsed = NodeToolchainProvisionerBootstrapInstallationInspectionV2Schema.safeParse({
    ...identity,
    inspectionHash: hashNodeToolchainProvisionerBootstrapInstallationInspectionV2(identity),
  });
  if (!parsed.success) {
    return fail(
      "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_V2_SCHEMA_INVALID",
      "Fresh bootstrap installation inspection failed its exact V2 schema",
      parsed.error,
    );
  }
  return deepFreezeJson(parsed.data);
}

export function planNodeToolchainProvisionerBootstrapInstallationV2(
  preparedHandle: PreparedNodeToolchainProvisionerBootstrapPackageV2,
): NodeToolchainProvisionerBootstrapInstallationPlanV2 {
  const source = revalidateNodeToolchainProvisionerBootstrapPreparedPackageV2(preparedHandle);
  const inspection = inspectNodeToolchainProvisionerBootstrapInstallationV2(preparedHandle);
  const identity: NodeToolchainProvisionerBootstrapInstallationPlanHashPayloadV2 = {
    schema: NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_PLAN_V2_SCHEMA,
    planVersion: NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_VERSION_V2,
    authorityRef: NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_AUTHORITY_REF_V2,
    operation: "install_bootstrap_package",
    admissionScope: source.admissionScope,
    source,
    inspection,
    decision: inspection.classification === "target_absent_clean"
      ? "publish_new"
      : "no_mutation_blocked",
    protocol: {
      serialization: "darwin_parent_descriptor_lockf_v2",
      claim: "canonical_no_replace_claim_before_root_v2",
      root: "exclusive_inaccessible_root_then_read_only_v2",
      files: "exclusive_copy_fchown_fchmod_fsync_v2",
      manifest: "manifest_last_v2",
      receipt: "canonical_no_replace_receipt_after_verified_root_v2",
      recovery: "exact_claim_bounded_rebuild_v2",
    },
  };
  const parsed = NodeToolchainProvisionerBootstrapInstallationPlanV2Schema.safeParse({
    ...identity,
    planHash: hashNodeToolchainProvisionerBootstrapInstallationPlanV2(identity),
  });
  if (!parsed.success) {
    return fail(
      "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_V2_SCHEMA_INVALID",
      "Fresh bootstrap installation plan failed its exact V2 schema",
      parsed.error,
    );
  }
  return deepFreezeJson(parsed.data);
}
