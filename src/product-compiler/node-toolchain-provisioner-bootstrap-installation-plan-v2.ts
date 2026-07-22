import {
  closeSync,
  constants,
  fstatSync,
  lstatSync,
  openSync,
  readdirSync,
  readSync,
  type Stats,
} from "node:fs";
import path from "node:path";

import { canonicalJsonBytes, hashCanonicalJson } from "./canonical-json.js";
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
  NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_INSPECTION_V2_SCHEMA,
  NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_PLAN_V2_SCHEMA,
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
import {
  NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_CLAIM_STAGE_BASENAME_V2,
  NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_LOCK_CONTENT_V2,
  NodeToolchainProvisionerBootstrapInstallationClaimV2Schema,
  NodeToolchainProvisionerBootstrapInstallationReceiptV2Schema,
  buildNodeToolchainProvisionerBootstrapRollbackHistoryV2,
  buildNodeToolchainProvisionerBootstrapInstallationClaimV2,
  buildNodeToolchainProvisionerBootstrapInstallationIntentV2,
  getNodeToolchainProvisionerBootstrapInstallationPathsV2,
  type NodeToolchainProvisionerBootstrapInstallationPathsV2,
  type NodeToolchainProvisionerBootstrapRollbackHistoryEntryV2,
  type NodeToolchainProvisionerBootstrapRollbackHistoryV2,
} from "./schemas/node-toolchain-provisioner-bootstrap-installation-state-v2.js";
import {
  NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_ROLLBACK_RECEIPT_BASENAME_REGEX_V2,
  NodeToolchainProvisionerBootstrapRollbackReceiptV2Schema,
  getNodeToolchainProvisionerBootstrapRollbackPathsV2,
} from "./schemas/node-toolchain-provisioner-bootstrap-rollback-v2.js";

const ROLLBACK_RECEIPT_BASENAME_PATTERN_V2 = new RegExp(
  NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_ROLLBACK_RECEIPT_BASENAME_REGEX_V2,
);

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
  | "installation_staging_present_without_v2_authority"
  | "rollback_history_invalid";

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

function readOperationalBytes(input: Readonly<{
  role: NodeToolchainProvisionerBootstrapInstallationLocatorRoleV2;
  absoluteLocator: string;
  entry: InstallationEntryV2;
  expectedOwner: Readonly<{ uid: number; gid: number }>;
  allowedModes: readonly number[];
  allowedLinks: readonly number[];
  maxBytes: number;
}>): Buffer {
  if (
    input.entry.state !== "present"
    || input.entry.type !== "file"
    || input.entry.ownerUid !== input.expectedOwner.uid
    || input.entry.ownerGid !== input.expectedOwner.gid
    || !input.allowedModes.includes(Number.parseInt(input.entry.mode, 8))
    || !input.allowedLinks.includes(input.entry.linkCount)
    || input.entry.byteLength < 1
    || input.entry.byteLength > input.maxBytes
  ) {
    throw new Error("operational metadata mismatch");
  }
  let descriptor: number | undefined;
  let bytes: Buffer | undefined;
  let released = false;
  try {
    const before = lstatSync(input.absoluteLocator);
    descriptor = openSync(
      input.absoluteLocator,
      constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK,
    );
    const opened = fstatSync(descriptor);
    if (!sameFingerprint(fingerprint(before), fingerprint(opened))) {
      throw new Error("operational file changed before read");
    }
    bytes = Buffer.allocUnsafeSlow(opened.size);
    let offset = 0;
    while (offset < bytes.byteLength) {
      const count = readSync(descriptor, bytes, offset, bytes.byteLength - offset, null);
      if (count < 1) throw new Error("operational file ended early");
      offset += count;
    }
    const eof = Buffer.allocUnsafe(1);
    if (readSync(descriptor, eof, 0, 1, null) !== 0) {
      throw new Error("operational file exceeded bound");
    }
    const after = fstatSync(descriptor);
    const pathAfter = lstatSync(input.absoluteLocator);
    const recaptured = captureEntry(input.role, input.absoluteLocator);
    if (
      !sameFingerprint(fingerprint(opened), fingerprint(after))
      || !sameFingerprint(fingerprint(after), fingerprint(pathAfter))
      || !sameEntry(input.entry, recaptured)
    ) {
      throw new Error("operational file changed during read");
    }
    released = true;
    return bytes;
  } finally {
    if (!released) bytes?.fill(0);
    if (descriptor !== undefined) closeSync(descriptor);
  }
}

function parseCanonicalOperational<T>(input: Readonly<{
  bytes: Buffer;
  schema: { safeParse(value: unknown): { success: true; data: T } | { success: false } };
}>): T | undefined {
  try {
    const raw = JSON.parse(input.bytes.toString("utf8"));
    const parsed = input.schema.safeParse(raw);
    if (!parsed.success || !input.bytes.equals(canonicalJsonBytes(parsed.data))) return undefined;
    return parsed.data;
  } catch {
    return undefined;
  }
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

type RollbackHistoryObservationV2 =
  | Readonly<{
      status: "verified";
      summary: NodeToolchainProvisionerBootstrapRollbackHistoryV2;
    }>
  | Readonly<{
      status: "invalid";
      failureKind:
        | "metadata_mismatch"
        | "contract_mismatch"
        | "foreign_member"
        | "changing_census";
    }>;

function invalidRollbackHistory(
  failureKind: Extract<RollbackHistoryObservationV2, { status: "invalid" }>["failureKind"],
): RollbackHistoryObservationV2 {
  return Object.freeze({ status: "invalid" as const, failureKind });
}

function inspectPredecessorRollbackHistory(input: Readonly<{
  paths: NodeToolchainProvisionerBootstrapInstallationPathsV2;
  packageParent: InstallationEntryV2;
  expectedOwner: Readonly<{ uid: number; gid: number }>;
  parentMode: "0700" | "0755";
}>): RollbackHistoryObservationV2 {
  if (input.packageParent.state === "absent") {
    return Object.freeze({
      status: "verified" as const,
      summary: buildNodeToolchainProvisionerBootstrapRollbackHistoryV2([]),
    });
  }
  if (
    input.packageParent.type !== "directory"
    || input.packageParent.ownerUid !== input.expectedOwner.uid
    || input.packageParent.ownerGid !== input.expectedOwner.gid
    || input.packageParent.mode !== input.parentMode
  ) {
    return invalidRollbackHistory("metadata_mismatch");
  }
  try {
    const before = lstatSync(input.paths.parent);
    const namesBefore = readdirSync(input.paths.parent).sort();
    const allowed = new Set([
      path.basename(input.paths.root),
      path.basename(input.paths.receipt),
      path.basename(input.paths.claim),
      path.basename(input.paths.lock),
      path.basename(input.paths.staging),
    ]);
    const historyEntries: NodeToolchainProvisionerBootstrapRollbackHistoryEntryV2[] = [];
    const historyCaptures: Readonly<{
      absolutePath: string;
      entry: InstallationEntryV2;
    }>[] = [];
    for (const name of namesBefore) {
      if (allowed.has(name)) continue;
      if (!ROLLBACK_RECEIPT_BASENAME_PATTERN_V2.test(name)) {
        return invalidRollbackHistory("foreign_member");
      }
      const absolutePath = path.join(input.paths.parent, name);
      const entry = captureEntry("receipt", absolutePath);
      let bytes: Buffer | undefined;
      try {
        bytes = readOperationalBytes({
          role: "receipt",
          absoluteLocator: absolutePath,
          entry,
          expectedOwner: input.expectedOwner,
          allowedModes: [0o444],
          allowedLinks: [1],
          maxBytes: 16 * 1024 * 1024,
        });
      } catch {
        return invalidRollbackHistory("metadata_mismatch");
      }
      try {
        const rollbackReceipt = parseCanonicalOperational({
          bytes,
          schema: NodeToolchainProvisionerBootstrapRollbackReceiptV2Schema,
        });
        if (!rollbackReceipt) return invalidRollbackHistory("contract_mismatch");
        const receiptPaths = getNodeToolchainProvisionerBootstrapRollbackPathsV2(
          rollbackReceipt.claim.plan.installed,
        );
        if (
          receiptPaths.parent !== input.paths.parent
          || receiptPaths.rollbackReceipt !== absolutePath
          || rollbackReceipt.receiptFile.ownerUid !== input.expectedOwner.uid
          || rollbackReceipt.receiptFile.ownerGid !== input.expectedOwner.gid
        ) {
          return invalidRollbackHistory("contract_mismatch");
        }
        historyEntries.push({
          installationReceiptHash:
            rollbackReceipt.removedGeneration.installationReceiptHash,
          rollbackReceiptHash: rollbackReceipt.receiptHash,
          rollbackReceiptLocatorHash: rollbackReceipt.receiptFile.locatorHash,
        });
        historyCaptures.push({ absolutePath, entry });
      } finally {
        bytes.fill(0);
      }
    }
    const namesAfter = readdirSync(input.paths.parent).sort();
    const after = lstatSync(input.paths.parent);
    if (
      !sameFingerprint(fingerprint(before), fingerprint(after))
      || namesBefore.length !== namesAfter.length
      || namesBefore.some((name, index) => name !== namesAfter[index])
      || historyCaptures.some((capture) =>
        !sameEntry(capture.entry, captureEntry("receipt", capture.absolutePath)))
    ) {
      return invalidRollbackHistory("changing_census");
    }
    try {
      return Object.freeze({
        status: "verified" as const,
        summary: buildNodeToolchainProvisionerBootstrapRollbackHistoryV2(historyEntries),
      });
    } catch {
      return invalidRollbackHistory("contract_mismatch");
    }
  } catch {
    return invalidRollbackHistory("metadata_mismatch");
  }
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
  const intent = buildNodeToolchainProvisionerBootstrapInstallationIntentV2(source);
  const expectedClaim = buildNodeToolchainProvisionerBootstrapInstallationClaimV2(intent);
  const paths = getNodeToolchainProvisionerBootstrapInstallationPathsV2(source);
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
  const predecessorRollbackHistory = inspectPredecessorRollbackHistory({
    paths,
    packageParent,
    expectedOwner,
    parentMode: source.admissionScope === "production_release" ? "0755" : "0700",
  });
  const lockObservation = filesystem.lock.state === "absent"
    ? Object.freeze({ status: "absent" as const })
    : (() => {
        let bytes: Buffer | undefined;
        try {
          bytes = readOperationalBytes({
            role: "lock",
            absoluteLocator: paths.lock,
            entry: filesystem.lock,
            expectedOwner,
            allowedModes: [0o600],
            allowedLinks: [1],
            maxBytes: 4_096,
          });
          return bytes.equals(Buffer.from(
            NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_LOCK_CONTENT_V2,
            "utf8",
          ))
            ? Object.freeze({ status: "verified" as const })
            : Object.freeze({
                status: "invalid" as const,
                failureKind: "content_mismatch" as const,
              });
        } catch {
          return Object.freeze({
            status: "invalid" as const,
            failureKind: "metadata_mismatch" as const,
          });
        } finally {
          bytes?.fill(0);
        }
      })();
  const claimObservation = filesystem.claim.state === "absent"
    ? Object.freeze({ status: "absent" as const })
    : (() => {
        let bytes: Buffer | undefined;
        try {
          bytes = readOperationalBytes({
            role: "claim",
            absoluteLocator: paths.claim,
            entry: filesystem.claim,
            expectedOwner,
            allowedModes: [0o444],
            allowedLinks: [1, 2],
            maxBytes: 16 * 1024 * 1024,
          });
          const claim = parseCanonicalOperational({
            bytes,
            schema: NodeToolchainProvisionerBootstrapInstallationClaimV2Schema,
          });
          return claim
            ? Object.freeze({
                status: "verified" as const,
                claimHash: claim.claimHash,
                sourceMatch: claim.claimHash === expectedClaim.claimHash,
              })
            : Object.freeze({
                status: "invalid" as const,
                failureKind: "contract_mismatch" as const,
              });
        } catch {
          return Object.freeze({
            status: "invalid" as const,
            failureKind: "metadata_mismatch" as const,
          });
        } finally {
          bytes?.fill(0);
        }
      })();
  const receiptObservation = filesystem.receipt.state === "absent"
    ? Object.freeze({ status: "absent" as const })
    : (() => {
        let bytes: Buffer | undefined;
        try {
          bytes = readOperationalBytes({
            role: "receipt",
            absoluteLocator: paths.receipt,
            entry: filesystem.receipt,
            expectedOwner,
            allowedModes: [0o444],
            allowedLinks: [1, 2],
            maxBytes: 16 * 1024 * 1024,
          });
          const receipt = parseCanonicalOperational({
            bytes,
            schema: NodeToolchainProvisionerBootstrapInstallationReceiptV2Schema,
          });
          return receipt
            ? Object.freeze({
                status: "verified" as const,
                receiptHash: receipt.receiptHash,
                claimHash: receipt.claim.claimHash,
                sourceMatch: receipt.claim.claimHash === expectedClaim.claimHash,
              })
            : Object.freeze({
                status: "invalid" as const,
                failureKind: "contract_mismatch" as const,
              });
        } catch {
          return Object.freeze({
            status: "invalid" as const,
            failureKind: "metadata_mismatch" as const,
          });
        } finally {
          bytes?.fill(0);
        }
      })();
  const stagingObservation = filesystem.staging.state === "absent"
    ? Object.freeze({ status: "absent" as const })
    : (() => {
        let bytes: Buffer | undefined;
        try {
          if (
            filesystem.staging.type !== "directory"
            || filesystem.staging.ownerUid !== expectedOwner.uid
            || filesystem.staging.ownerGid !== expectedOwner.gid
            || filesystem.staging.mode !== "0700"
          ) {
            return Object.freeze({ status: "present_unverified" as const });
          }
          const names = readdirSync(paths.staging).sort();
          if (
            names.length !== 1
            || names[0]
              !== NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_CLAIM_STAGE_BASENAME_V2
          ) {
            return Object.freeze({ status: "present_unverified" as const });
          }
          const claimStagePath = path.join(
            paths.staging,
            NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_CLAIM_STAGE_BASENAME_V2,
          );
          const claimStageEntry = captureEntry("staging", claimStagePath);
          bytes = readOperationalBytes({
            role: "staging",
            absoluteLocator: claimStagePath,
            entry: claimStageEntry,
            expectedOwner,
            allowedModes: [0o444],
            allowedLinks: [1],
            maxBytes: 16 * 1024 * 1024,
          });
          const stagedClaim = parseCanonicalOperational({
            bytes,
            schema: NodeToolchainProvisionerBootstrapInstallationClaimV2Schema,
          });
          return stagedClaim
            ? Object.freeze({
                status: "claim_stage_verified" as const,
                claimHash: stagedClaim.claimHash,
                sourceMatch: stagedClaim.claimHash === expectedClaim.claimHash,
              })
            : Object.freeze({ status: "present_unverified" as const });
        } catch {
          return Object.freeze({ status: "present_unverified" as const });
        } finally {
          bytes?.fill(0);
        }
      })();
  const operational = {
    lock: lockObservation,
    claim: claimObservation,
    receipt: receiptObservation,
    staging: stagingObservation,
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
  const matchingClaim = operational.claim.status === "verified"
    && operational.claim.sourceMatch;
  const matchingReceipt = operational.receipt.status === "verified"
    && operational.receipt.sourceMatch;
  const matchingStagedClaim = operational.staging.status === "claim_stage_verified"
    && operational.staging.sourceMatch;
  const matchingPackage = packageObservation.status === "verified"
    && packageObservation.sourceMatch;
  if (operational.lock.status === "invalid") {
    conflicts.push("installation_lock_present_without_v2_authority");
  }
  if (predecessorRollbackHistory.status === "invalid") {
    conflicts.push("rollback_history_invalid");
  }
  if (
    operational.claim.status === "invalid"
    || (operational.claim.status === "verified" && !operational.claim.sourceMatch)
  ) {
    conflicts.push("installation_claim_present_without_v2_authority");
  }
  if (
    operational.receipt.status === "invalid"
    || (operational.receipt.status === "verified" && !operational.receipt.sourceMatch)
  ) {
    conflicts.push("installation_receipt_present_without_v2_authority");
  }
  if (
    filesystem.staging.state !== "absent"
    && !matchingClaim
    && !matchingStagedClaim
  ) {
    conflicts.push("installation_staging_present_without_v2_authority");
  }
  if (matchingReceipt) {
    if (!matchingClaim) conflicts.push("installation_claim_present_without_v2_authority");
    if (!matchingPackage) conflicts.push("target_package_invalid");
  } else if (!matchingClaim) {
    if (matchingPackage) conflicts.push("target_exact_but_unclaimed");
    else if (packageObservation.status !== "absent") conflicts.push("target_package_invalid");
  }
  const sortedConflicts = [...new Set(conflicts)].sort();
  const classification = sortedConflicts.length > 0
    ? sortedConflicts.length === 1 && sortedConflicts[0] === "target_exact_but_unclaimed"
      ? "target_exact_unclaimed" as const
      : "conflict" as const
    : matchingReceipt && matchingClaim && matchingPackage
      ? filesystem.staging.state === "absent"
        ? "ready_verified" as const
        : "claimed_recovery_candidate" as const
      : (matchingClaim || matchingStagedClaim)
        && operational.receipt.status === "absent"
        ? "claimed_recovery_candidate" as const
        : packageObservation.status === "absent"
          && operational.claim.status === "absent"
          && operational.receipt.status === "absent"
          && filesystem.staging.state === "absent"
          ? "target_absent_clean" as const
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
    operational,
    predecessorRollbackHistory,
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
  const intent = buildNodeToolchainProvisionerBootstrapInstallationIntentV2(source);
  const inspection = inspectNodeToolchainProvisionerBootstrapInstallationV2(preparedHandle);
  const identity: NodeToolchainProvisionerBootstrapInstallationPlanHashPayloadV2 = {
    schema: NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_PLAN_V2_SCHEMA,
    planVersion: NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_VERSION_V2,
    authorityRef: NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_AUTHORITY_REF_V2,
    operation: "install_bootstrap_package",
    intent,
    inspection,
    decision: inspection.classification === "target_absent_clean"
      ? "publish_new"
      : inspection.classification === "ready_verified"
        ? "return_ready"
        : inspection.classification === "claimed_recovery_candidate"
          ? "recover_claimed"
          : "no_mutation_blocked",
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
