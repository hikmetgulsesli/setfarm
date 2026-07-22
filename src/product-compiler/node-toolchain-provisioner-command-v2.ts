import { createHash } from "node:crypto";
import {
  closeSync,
  constants,
  fstatSync,
  lstatSync,
  openSync,
  readSync,
  readdirSync,
  type Stats,
} from "node:fs";
import path from "node:path";
import { isProxy } from "node:util/types";

import { canonicalJsonBytes, hashCanonicalJson } from "./canonical-json.js";
import {
  inspectNodeToolchainPrivateTreeReceiptV2,
  type MaterializedNodeToolchainPrivateTreeV2,
} from "./node-toolchain-private-tree-v2.js";
import {
  openProductionProvisionedNodeToolchainV2,
  openProvisionedNodeToolchainV2ForTest,
  inspectNodeToolchainProvisioningReceiptV2,
  provisionNodeToolchainV2,
  provisionNodeToolchainV2ForTest,
  revalidateProvisionedNodeToolchainV2,
} from "./node-toolchain-provisioning-v2.js";
import {
  NODE_TOOLCHAIN_PROVISIONING_LOCK_BASENAME_V2,
  NODE_TOOLCHAIN_PROVISIONING_STAGING_BASENAME_V2,
  NODE_TOOLCHAIN_ROOT_PARENT_V2,
  getCodeOwnedNodeToolchainTargetV2,
  hashNodeToolchainOperationalLocatorV2,
  type NodeToolchainTargetArchitectureV2,
  type NodeToolchainTargetV2,
} from "./node-toolchain-target-registry-v2.js";
import {
  NODE_TOOLCHAIN_PROVISIONER_COMMAND_AUTHORITY_REF_V2,
  NODE_TOOLCHAIN_PROVISIONER_COMMAND_VERSION_V2,
  NODE_TOOLCHAIN_PROVISIONER_INSPECTION_V2_SCHEMA,
  NODE_TOOLCHAIN_PROVISIONER_OPERATION_RECEIPT_V2_SCHEMA,
  NODE_TOOLCHAIN_PROVISIONER_PLAN_V2_SCHEMA,
  NodeToolchainProvisionerInspectionV2Schema,
  NodeToolchainProvisionerOperationReceiptV2Schema,
  NodeToolchainProvisionerPlanV2Schema,
  hashNodeToolchainProvisionerInspectionV2,
  hashNodeToolchainProvisionerOperationReceiptV2,
  hashNodeToolchainProvisionerPlanV2,
  type NodeToolchainProvisionerConflictCodeV2,
  type NodeToolchainProvisionerFilesystemEntryV2,
  type NodeToolchainProvisionerInspectionHashPayloadV2,
  type NodeToolchainProvisionerInspectionV2,
  type NodeToolchainProvisionerOperationReceiptHashPayloadV2,
  type NodeToolchainProvisionerOperationReceiptV2,
  type NodeToolchainProvisionerPlanHashPayloadV2,
  type NodeToolchainProvisionerPlanV2,
} from "./schemas/node-toolchain-provisioner-command-v2.js";
import {
  NODE_TOOLCHAIN_PROVISIONING_AUTHORITY_REF_V2,
  NODE_TOOLCHAIN_PROVISIONING_INTENT_V2_SCHEMA,
  NODE_TOOLCHAIN_PROVISIONING_VERSION_V2,
  NodeToolchainProvisioningClaimV2Schema,
  NodeToolchainProvisioningIntentV2Schema,
  NodeToolchainProvisioningReceiptV2Schema,
  hashNodeToolchainProvisioningIntentV2,
  type NodeToolchainProvisioningClaimV2,
  type NodeToolchainProvisioningIntentHashPayloadV2,
  type NodeToolchainProvisioningIntentV2,
  type NodeToolchainProvisioningReceiptV2,
} from "./schemas/node-toolchain-provisioning-v2.js";

const CANONICAL_FILE_MAX_BYTES_V2 = 1024 * 1024;
const LOCK_FILE_BYTES_V2 = Buffer.from("setfarm.node-toolchain-provisioning-lock.v2\n", "utf8");

type AdmissionScopeV2 = "production_root" | "test_fixture";
type ExpectedOwnerV2 = Readonly<{ uid: number; gid: number }>;
type ConflictCodeV2 = NodeToolchainProvisionerConflictCodeV2;

type PathsV2 = Readonly<{
  parent: string;
  root: string;
  receipt: string;
  claim: string;
  lock: string;
  staging: string;
}>;

type InspectionStateV2 = Readonly<{
  admissionScope: AdmissionScopeV2;
  architecture: NodeToolchainTargetArchitectureV2;
  parent: string;
  expectedOwner: ExpectedOwnerV2;
  parentMode: 0o700 | 0o755;
  inspection: NodeToolchainProvisionerInspectionV2;
}>;

export type NodeToolchainProvisionerCommandErrorCodeV2 =
  | "NODE_TOOLCHAIN_PROVISIONER_V2_INPUT_INVALID"
  | "NODE_TOOLCHAIN_PROVISIONER_V2_PLATFORM_UNSUPPORTED"
  | "NODE_TOOLCHAIN_PROVISIONER_V2_ROOT_PRIVILEGE_REQUIRED"
  | "NODE_TOOLCHAIN_PROVISIONER_V2_INSPECTION_FAILED"
  | "NODE_TOOLCHAIN_PROVISIONER_V2_HANDLE_UNAUTHENTICATED"
  | "NODE_TOOLCHAIN_PROVISIONER_V2_PLAN_CONFLICT"
  | "NODE_TOOLCHAIN_PROVISIONER_V2_PLAN_INVALID"
  | "NODE_TOOLCHAIN_PROVISIONER_V2_PRECONDITION_CHANGED"
  | "NODE_TOOLCHAIN_PROVISIONER_V2_APPLY_FAILED"
  | "NODE_TOOLCHAIN_PROVISIONER_V2_VERIFY_FAILED"
  | "NODE_TOOLCHAIN_PROVISIONER_V2_SCHEMA_INVALID";

export class NodeToolchainProvisionerCommandErrorV2 extends Error {
  readonly code: NodeToolchainProvisionerCommandErrorCodeV2;
  override readonly cause?: unknown;

  constructor(
    code: NodeToolchainProvisionerCommandErrorCodeV2,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message.slice(0, 1_500), options);
    this.name = "NodeToolchainProvisionerCommandErrorV2";
    this.code = code;
    this.cause = options?.cause;
  }
}

const handleConstructorCapabilityV2 = Object.freeze({});
const inspectionStateV2 = new WeakMap<object, InspectionStateV2>();

export class InspectedNodeToolchainProvisionerStateV2 {
  readonly inspectionHash: string;

  constructor(capability: object, state: InspectionStateV2) {
    if (capability !== handleConstructorCapabilityV2) {
      throw new NodeToolchainProvisionerCommandErrorV2(
        "NODE_TOOLCHAIN_PROVISIONER_V2_HANDLE_UNAUTHENTICATED",
        "Node toolchain provisioner inspection constructor capability is unavailable",
      );
    }
    this.inspectionHash = state.inspection.inspectionHash;
    inspectionStateV2.set(this, state);
    Object.freeze(this);
  }
}

function fail(
  code: NodeToolchainProvisionerCommandErrorCodeV2,
  message: string,
  cause?: unknown,
): never {
  throw new NodeToolchainProvisionerCommandErrorV2(
    code,
    message,
    cause === undefined ? undefined : { cause },
  );
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

function defensiveCopy<T>(value: T): T {
  return deepFreezeJson(structuredClone(value));
}

function isNodeError(error: unknown, code: string): boolean {
  return error instanceof Error && "code" in error && error.code === code;
}

function closeQuietly(descriptor: number | undefined): void {
  if (descriptor === undefined) return;
  try {
    closeSync(descriptor);
  } catch {
    // Preserve the primary typed failure.
  }
}

function modeString(stat: Stats): string {
  return (stat.mode & 0o7777).toString(8).padStart(4, "0");
}

function entryType(stat: Stats): "directory" | "regular_file" | "symbolic_link" | "other" {
  if (stat.isDirectory()) return "directory";
  if (stat.isFile()) return "regular_file";
  if (stat.isSymbolicLink()) return "symbolic_link";
  return "other";
}

function microseconds(milliseconds: number): number {
  return Math.max(0, Math.trunc(milliseconds * 1_000));
}

function absentEntry(): NodeToolchainProvisionerFilesystemEntryV2 {
  return Object.freeze({ state: "absent" });
}

function optionalStat(absolutePath: string): Stats | undefined {
  try {
    return lstatSync(absolutePath);
  } catch (error) {
    if (isNodeError(error, "ENOENT")) return undefined;
    throw error;
  }
}

function hashBoundedRegularFile(absolutePath: string, expected: Stats): string | null {
  if (!expected.isFile() || expected.size > CANONICAL_FILE_MAX_BYTES_V2) return null;
  let descriptor: number | undefined;
  try {
    descriptor = openSync(
      absolutePath,
      constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK,
    );
    const before = fstatSync(descriptor);
    if (
      before.dev !== expected.dev
      || before.ino !== expected.ino
      || before.mode !== expected.mode
      || before.uid !== expected.uid
      || before.gid !== expected.gid
      || before.nlink !== expected.nlink
      || before.size !== expected.size
      || before.mtimeMs !== expected.mtimeMs
      || before.ctimeMs !== expected.ctimeMs
    ) {
      return fail(
        "NODE_TOOLCHAIN_PROVISIONER_V2_INSPECTION_FAILED",
        "Provisioner file identity changed before bounded inspection",
      );
    }
    const hash = createHash("sha256");
    const buffer = Buffer.allocUnsafe(64 * 1024);
    let byteLength = 0;
    while (true) {
      const count = readSync(descriptor, buffer, 0, buffer.byteLength, null);
      if (count === 0) break;
      byteLength += count;
      if (byteLength > expected.size) {
        return fail(
          "NODE_TOOLCHAIN_PROVISIONER_V2_INSPECTION_FAILED",
          "Provisioner file exceeded its bounded inspected length",
        );
      }
      hash.update(buffer.subarray(0, count));
    }
    const after = fstatSync(descriptor);
    const pathAfter = lstatSync(absolutePath);
    if (
      byteLength !== expected.size
      || after.dev !== before.dev
      || after.ino !== before.ino
      || after.mode !== before.mode
      || after.uid !== before.uid
      || after.gid !== before.gid
      || after.nlink !== before.nlink
      || after.size !== before.size
      || after.mtimeMs !== before.mtimeMs
      || after.ctimeMs !== before.ctimeMs
      || pathAfter.dev !== after.dev
      || pathAfter.ino !== after.ino
      || pathAfter.mode !== after.mode
      || pathAfter.uid !== after.uid
      || pathAfter.gid !== after.gid
      || pathAfter.nlink !== after.nlink
      || pathAfter.size !== after.size
      || pathAfter.mtimeMs !== after.mtimeMs
      || pathAfter.ctimeMs !== after.ctimeMs
    ) {
      return fail(
        "NODE_TOOLCHAIN_PROVISIONER_V2_INSPECTION_FAILED",
        "Provisioner file identity changed during bounded inspection",
      );
    }
    return hash.digest("hex");
  } finally {
    closeQuietly(descriptor);
  }
}

function inspectEntry(absolutePath: string): NodeToolchainProvisionerFilesystemEntryV2 {
  const stat = optionalStat(absolutePath);
  if (!stat) return absentEntry();
  const type = entryType(stat);
  return Object.freeze({
    state: "present",
    type,
    device: stat.dev,
    inode: stat.ino,
    mode: modeString(stat),
    ownerUid: stat.uid,
    ownerGid: stat.gid,
    linkCount: stat.nlink,
    byteLength: stat.size,
    modifiedMicroseconds: microseconds(stat.mtimeMs),
    changedMicroseconds: microseconds(stat.ctimeMs),
    contentHash: type === "regular_file" ? hashBoundedRegularFile(absolutePath, stat) : null,
  });
}

function samePresentEntry(
  left: NodeToolchainProvisionerFilesystemEntryV2,
  right: NodeToolchainProvisionerFilesystemEntryV2,
): boolean {
  return hashCanonicalJson(left) === hashCanonicalJson(right);
}

function expectedEntryIdentity(
  entry: NodeToolchainProvisionerFilesystemEntryV2,
  input: Readonly<{
    type: "directory" | "regular_file";
    expectedOwner: ExpectedOwnerV2;
    modes: readonly string[];
    linkCounts?: readonly number[];
  }>,
): boolean {
  return entry.state === "present"
    && entry.type === input.type
    && entry.ownerUid === input.expectedOwner.uid
    && entry.ownerGid === input.expectedOwner.gid
    && input.modes.includes(entry.mode)
    && (input.linkCounts === undefined || input.linkCounts.includes(entry.linkCount));
}

function pathsFor(parent: string, target: NodeToolchainTargetV2): PathsV2 {
  return Object.freeze({
    parent,
    root: path.join(parent, target.rootBasename),
    receipt: path.join(parent, target.receiptBasename),
    claim: path.join(parent, target.claimBasename),
    lock: path.join(parent, NODE_TOOLCHAIN_PROVISIONING_LOCK_BASENAME_V2),
    staging: path.join(parent, NODE_TOOLCHAIN_PROVISIONING_STAGING_BASENAME_V2),
  });
}

function readCanonicalState<T>(input: Readonly<{
  absolutePath: string;
  entry: NodeToolchainProvisionerFilesystemEntryV2;
  expectedOwner: ExpectedOwnerV2;
  expectedMode: "0444" | "0600";
  schema: { safeParse(value: unknown): { success: true; data: T } | { success: false } };
}>):
  | Readonly<{ status: "absent" }>
  | Readonly<{ status: "valid"; value: T }>
  | Readonly<{
    status: "invalid";
    reason: "not_regular_file" | "identity_invalid" | "too_large" | "json_invalid" | "schema_invalid";
  }> {
  if (input.entry.state === "absent") return Object.freeze({ status: "absent" });
  if (input.entry.type !== "regular_file") {
    return Object.freeze({ status: "invalid", reason: "not_regular_file" });
  }
  if (
    input.entry.ownerUid !== input.expectedOwner.uid
    || input.entry.ownerGid !== input.expectedOwner.gid
    || input.entry.mode !== input.expectedMode
    || input.entry.linkCount !== 1
  ) {
    return Object.freeze({ status: "invalid", reason: "identity_invalid" });
  }
  if (input.entry.byteLength > CANONICAL_FILE_MAX_BYTES_V2 || input.entry.contentHash === null) {
    return Object.freeze({ status: "invalid", reason: "too_large" });
  }
  let descriptor: number | undefined;
  try {
    descriptor = openSync(
      input.absolutePath,
      constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK,
    );
    const before = fstatSync(descriptor);
    if (
      before.dev !== input.entry.device
      || before.ino !== input.entry.inode
      || modeString(before) !== input.entry.mode
      || before.uid !== input.entry.ownerUid
      || before.gid !== input.entry.ownerGid
      || before.nlink !== input.entry.linkCount
      || before.size !== input.entry.byteLength
    ) {
      return Object.freeze({ status: "invalid", reason: "identity_invalid" });
    }
    const bytes = Buffer.allocUnsafeSlow(before.size);
    let offset = 0;
    while (offset < bytes.byteLength) {
      const count = readSync(descriptor, bytes, offset, bytes.byteLength - offset, null);
      if (count < 1) return Object.freeze({ status: "invalid", reason: "identity_invalid" });
      offset += count;
    }
    const after = fstatSync(descriptor);
    const pathAfter = inspectEntry(input.absolutePath);
    if (
      after.dev !== before.dev
      || after.ino !== before.ino
      || after.mode !== before.mode
      || after.uid !== before.uid
      || after.gid !== before.gid
      || after.nlink !== before.nlink
      || after.size !== before.size
      || after.mtimeMs !== before.mtimeMs
      || after.ctimeMs !== before.ctimeMs
      || !samePresentEntry(input.entry, pathAfter)
      || createHash("sha256").update(bytes).digest("hex") !== input.entry.contentHash
    ) {
      bytes.fill(0);
      return Object.freeze({ status: "invalid", reason: "identity_invalid" });
    }
    let raw: unknown;
    try {
      raw = JSON.parse(bytes.toString("utf8"));
    } catch {
      bytes.fill(0);
      return Object.freeze({ status: "invalid", reason: "json_invalid" });
    }
    const parsed = input.schema.safeParse(raw);
    if (!parsed.success) {
      bytes.fill(0);
      return Object.freeze({ status: "invalid", reason: "schema_invalid" });
    }
    const canonical = canonicalJsonBytes(parsed.data);
    const exact = canonical.equals(bytes);
    bytes.fill(0);
    if (!exact) return Object.freeze({ status: "invalid", reason: "schema_invalid" });
    return Object.freeze({ status: "valid", value: deepFreezeJson(parsed.data) });
  } finally {
    closeQuietly(descriptor);
  }
}

function inspectStaging(input: Readonly<{
  paths: PathsV2;
  entry: NodeToolchainProvisionerFilesystemEntryV2;
  expectedOwner: ExpectedOwnerV2;
  claim:
    | Readonly<{ status: "absent" }>
    | Readonly<{ status: "valid"; value: NodeToolchainProvisioningClaimV2 }>
    | Readonly<{ status: "invalid"; reason: string }>;
}>): Readonly<{
  status: "absent" | "empty" | "exact_interrupted" | "foreign_or_invalid";
  memberCount: number;
  memberNamesHash: string;
}> {
  const emptyHash = hashCanonicalJson({
    schema: "setfarm.node-toolchain-provisioner-staging-members.v2",
    names: [],
  });
  if (input.entry.state === "absent") {
    return Object.freeze({ status: "absent", memberCount: 0, memberNamesHash: emptyHash });
  }
  if (!expectedEntryIdentity(input.entry, {
    type: "directory",
    expectedOwner: input.expectedOwner,
    modes: ["0700"],
  })) {
    return Object.freeze({
      status: "foreign_or_invalid",
      memberCount: 0,
      memberNamesHash: emptyHash,
    });
  }
  const before = inspectEntry(input.paths.staging);
  const names = readdirSync(input.paths.staging).sort();
  const after = inspectEntry(input.paths.staging);
  if (!samePresentEntry(before, after) || names.length > 20_000) {
    return Object.freeze({
      status: "foreign_or_invalid",
      memberCount: Math.min(names.length, 20_000),
      memberNamesHash: hashCanonicalJson({
        schema: "setfarm.node-toolchain-provisioner-staging-members.v2",
        names: names.slice(0, 20_000),
      }),
    });
  }
  const memberNamesHash = hashCanonicalJson({
    schema: "setfarm.node-toolchain-provisioner-staging-members.v2",
    names,
  });
  if (names.length === 0) {
    return Object.freeze({ status: "empty", memberCount: 0, memberNamesHash });
  }
  if (input.claim.status !== "valid") {
    return Object.freeze({
      status: "foreign_or_invalid",
      memberCount: names.length,
      memberNamesHash,
    });
  }
  const intentHash = input.claim.value.intent.intentHash;
  const allowed = new Set([
    `${intentHash}.tree`,
    `${intentHash}.claim.tmp`,
    `${intentHash}.receipt.tmp`,
  ]);
  return Object.freeze({
    status: names.every((name) => allowed.has(name)) ? "exact_interrupted" : "foreign_or_invalid",
    memberCount: names.length,
    memberNamesHash,
  });
}

function authenticInspectionState(
  handle: InspectedNodeToolchainProvisionerStateV2,
): InspectionStateV2 {
  if (
    typeof handle !== "object"
    || handle === null
    || isProxy(handle)
    || Object.getPrototypeOf(handle) !== InspectedNodeToolchainProvisionerStateV2.prototype
  ) {
    return fail(
      "NODE_TOOLCHAIN_PROVISIONER_V2_HANDLE_UNAUTHENTICATED",
      "Provisioner operation requires one authentic inspection handle",
    );
  }
  const state = inspectionStateV2.get(handle);
  if (!state) {
    return fail(
      "NODE_TOOLCHAIN_PROVISIONER_V2_HANDLE_UNAUTHENTICATED",
      "Provisioner operation requires one authentic inspection handle",
    );
  }
  return state;
}

function targetLocatorProjection(paths: PathsV2, target: NodeToolchainTargetV2) {
  return Object.freeze({
    targetRef: target.targetRef,
    parentLocatorHash: hashNodeToolchainOperationalLocatorV2("parent", paths.parent),
    rootLocatorHash: hashNodeToolchainOperationalLocatorV2("root", paths.root),
    receiptLocatorHash: hashNodeToolchainOperationalLocatorV2("receipt", paths.receipt),
    claimLocatorHash: hashNodeToolchainOperationalLocatorV2("claim", paths.claim),
    lockLocatorHash: hashNodeToolchainOperationalLocatorV2("lock", paths.lock),
    stagingLocatorHash: hashNodeToolchainOperationalLocatorV2("staging", paths.staging),
  });
}

async function inspect(input: Readonly<{
  admissionScope: AdmissionScopeV2;
  architecture: NodeToolchainTargetArchitectureV2;
  parent: string;
  expectedOwner: ExpectedOwnerV2;
  parentMode: 0o700 | 0o755;
  parentMayBeAbsent: boolean;
}>): Promise<InspectedNodeToolchainProvisionerStateV2> {
  const target = getCodeOwnedNodeToolchainTargetV2(input.architecture);
  const paths = pathsFor(input.parent, target);
  const parentEntry = inspectEntry(paths.parent);
  if (parentEntry.state === "absent" && !input.parentMayBeAbsent) {
    return fail(
      "NODE_TOOLCHAIN_PROVISIONER_V2_INSPECTION_FAILED",
      "Provisioner test parent must exist before inspection",
    );
  }
  const parentValid = parentEntry.state === "absent" || expectedEntryIdentity(parentEntry, {
    type: "directory",
    expectedOwner: input.expectedOwner,
    modes: [input.parentMode.toString(8).padStart(4, "0")],
  });
  const rootEntry = parentEntry.state === "absent" ? absentEntry() : inspectEntry(paths.root);
  const receiptEntry = parentEntry.state === "absent" ? absentEntry() : inspectEntry(paths.receipt);
  const claimEntry = parentEntry.state === "absent" ? absentEntry() : inspectEntry(paths.claim);
  const lockEntry = parentEntry.state === "absent" ? absentEntry() : inspectEntry(paths.lock);
  const stagingEntry = parentEntry.state === "absent" ? absentEntry() : inspectEntry(paths.staging);

  const receiptRead = readCanonicalState({
    absolutePath: paths.receipt,
    entry: receiptEntry,
    expectedOwner: input.expectedOwner,
    expectedMode: "0444",
    schema: NodeToolchainProvisioningReceiptV2Schema,
  });
  const claimRead = readCanonicalState({
    absolutePath: paths.claim,
    entry: claimEntry,
    expectedOwner: input.expectedOwner,
    expectedMode: "0600",
    schema: NodeToolchainProvisioningClaimV2Schema,
  });
  const staging = inspectStaging({
    paths,
    entry: stagingEntry,
    expectedOwner: input.expectedOwner,
    claim: claimRead,
  });
  const lockValid = lockEntry.state === "absent" || (
    expectedEntryIdentity(lockEntry, {
      type: "regular_file",
      expectedOwner: input.expectedOwner,
      modes: ["0600"],
      linkCounts: [1],
    })
    && lockEntry.byteLength === LOCK_FILE_BYTES_V2.byteLength
    && lockEntry.contentHash === createHash("sha256").update(LOCK_FILE_BYTES_V2).digest("hex")
  );
  const rootTypeValid = rootEntry.state === "absent" || expectedEntryIdentity(rootEntry, {
    type: "directory",
    expectedOwner: input.expectedOwner,
    modes: ["0555", "0700"],
  });

  const conflicts = new Set<ConflictCodeV2>();
  if (!parentValid) conflicts.add("PARENT_IDENTITY_INVALID");
  if (!rootTypeValid) conflicts.add("ROOT_TYPE_INVALID");
  if (receiptRead.status === "invalid") conflicts.add("RECEIPT_INVALID");
  if (claimRead.status === "invalid") conflicts.add("CLAIM_INVALID");
  if (!lockValid) conflicts.add("LOCK_INVALID");
  if (staging.status === "foreign_or_invalid") {
    conflicts.add(stagingEntry.state === "present" && stagingEntry.type === "directory"
      ? "FOREIGN_STAGING_MEMBER"
      : "STAGING_INVALID");
  }

  const targetProjection = targetLocatorProjection(paths, target);
  const claimTargetsInspection = claimRead.status !== "valid" || (
    claimRead.value.intent.admissionScope === input.admissionScope
    && claimRead.value.intent.architecture === input.architecture
    && claimRead.value.intent.target.targetRef === target.targetRef
    && claimRead.value.intent.target.parentLocatorHash === targetProjection.parentLocatorHash
    && claimRead.value.intent.target.rootLocatorHash === targetProjection.rootLocatorHash
    && claimRead.value.intent.target.receiptLocatorHash === targetProjection.receiptLocatorHash
  );
  const receiptTargetsInspection = receiptRead.status !== "valid" || (
    receiptRead.value.admissionScope === input.admissionScope
    && receiptRead.value.intent.architecture === input.architecture
    && receiptRead.value.intent.target.targetRef === target.targetRef
    && receiptRead.value.intent.target.parentLocatorHash === targetProjection.parentLocatorHash
    && receiptRead.value.intent.target.rootLocatorHash === targetProjection.rootLocatorHash
    && receiptRead.value.intent.target.receiptLocatorHash === targetProjection.receiptLocatorHash
  );
  if (!claimTargetsInspection || !receiptTargetsInspection) {
    conflicts.add("INTERRUPTED_STATE_MISMATCH");
  }

  const rootAbsent = rootEntry.state === "absent";
  const receiptAbsent = receiptRead.status === "absent";
  const claimAbsent = claimRead.status === "absent";
  const stagingClean = staging.status === "absent" || staging.status === "empty";

  let classification: NodeToolchainProvisionerInspectionV2["classification"] = "conflict";
  if (
    conflicts.size === 0
    && rootAbsent
    && receiptAbsent
    && claimAbsent
    && stagingClean
  ) {
    classification = "target_absent";
  } else if (
    conflicts.size === 0
    && receiptRead.status === "valid"
    && rootEntry.state === "present"
    && rootEntry.type === "directory"
    && claimAbsent
    && stagingClean
  ) {
    try {
      const handle = input.admissionScope === "production_root"
        ? await openProductionProvisionedNodeToolchainV2()
        : await openProvisionedNodeToolchainV2ForTest({
            parent: input.parent,
            architecture: input.architecture,
          });
      const fresh = inspectNodeToolchainProvisioningReceiptV2(handle);
      if (fresh.receiptHash !== receiptRead.value.receiptHash) {
        conflicts.add("READY_REVALIDATION_FAILED");
      } else {
        classification = "ready_verified";
      }
    } catch {
      conflicts.add("READY_REVALIDATION_FAILED");
    }
  } else if (
    conflicts.size === 0
    && receiptAbsent
    && claimRead.status === "valid"
    && (stagingClean || staging.status === "exact_interrupted")
  ) {
    classification = "interrupted_claimed";
  } else {
    if (receiptRead.status === "valid" && rootAbsent) conflicts.add("RECEIPT_WITHOUT_ROOT");
    if (receiptRead.status === "valid" && claimRead.status === "valid") {
      conflicts.add("READY_RECEIPT_WITH_CLAIM");
    }
    if (!rootAbsent && receiptAbsent && claimRead.status !== "valid") {
      conflicts.add("ROOT_WITHOUT_EXACT_CLAIM");
    }
    if (conflicts.size === 0) conflicts.add("INTERRUPTED_STATE_MISMATCH");
  }

  const identity: NodeToolchainProvisionerInspectionHashPayloadV2 = {
    schema: NODE_TOOLCHAIN_PROVISIONER_INSPECTION_V2_SCHEMA,
    inspectionVersion: NODE_TOOLCHAIN_PROVISIONER_COMMAND_VERSION_V2,
    authorityRef: NODE_TOOLCHAIN_PROVISIONER_COMMAND_AUTHORITY_REF_V2,
    admissionScope: input.admissionScope,
    architecture: input.architecture,
    target: targetProjection,
    filesystem: {
      parent: parentEntry,
      root: rootEntry,
      receipt: receiptEntry,
      claim: claimEntry,
      lock: lockEntry,
      staging: stagingEntry,
    },
    canonical: {
      receipt: receiptRead.status === "valid"
        ? { status: "valid", receipt: receiptRead.value }
        : receiptRead,
      claim: claimRead.status === "valid"
        ? { status: "valid", claim: claimRead.value }
        : claimRead,
      lock: { status: lockEntry.state === "absent" ? "absent" : lockValid ? "valid" : "invalid" },
      staging,
    },
    classification,
    conflicts: [...conflicts].sort(),
  };
  const parsed = NodeToolchainProvisionerInspectionV2Schema.safeParse({
    ...identity,
    inspectionHash: hashNodeToolchainProvisionerInspectionV2(identity),
  });
  if (!parsed.success) {
    return fail(
      "NODE_TOOLCHAIN_PROVISIONER_V2_SCHEMA_INVALID",
      "Fresh provisioner inspection failed its strict canonical schema",
      parsed.error,
    );
  }
  const state: InspectionStateV2 = Object.freeze({
    admissionScope: input.admissionScope,
    architecture: input.architecture,
    parent: input.parent,
    expectedOwner: input.expectedOwner,
    parentMode: input.parentMode,
    inspection: deepFreezeJson(parsed.data),
  });
  return new InspectedNodeToolchainProvisionerStateV2(handleConstructorCapabilityV2, state);
}

function currentProcessOwner(): ExpectedOwnerV2 {
  if (typeof process.geteuid !== "function" || typeof process.getegid !== "function") {
    return fail(
      "NODE_TOOLCHAIN_PROVISIONER_V2_PLATFORM_UNSUPPORTED",
      "Node toolchain provisioner requires POSIX effective identity APIs",
    );
  }
  return Object.freeze({ uid: process.geteuid(), gid: process.getegid() });
}

function assertProductionSystemBoundary(): void {
  if (process.platform !== "darwin" || (process.arch !== "arm64" && process.arch !== "x64")) {
    return fail(
      "NODE_TOOLCHAIN_PROVISIONER_V2_PLATFORM_UNSUPPORTED",
      "Production Node toolchain provisioner supports Darwin arm64 or x64 only",
    );
  }
  if (typeof process.geteuid !== "function" || process.geteuid() !== 0) {
    return fail(
      "NODE_TOOLCHAIN_PROVISIONER_V2_ROOT_PRIVILEGE_REQUIRED",
      "Production Node toolchain provisioner commands require effective UID 0",
    );
  }
  const applicationSupport = inspectEntry("/Library/Application Support");
  if (
    applicationSupport.state !== "present"
    || applicationSupport.type !== "directory"
    || applicationSupport.ownerUid !== 0
    || applicationSupport.mode !== "0755"
  ) {
    return fail(
      "NODE_TOOLCHAIN_PROVISIONER_V2_INSPECTION_FAILED",
      "macOS Application Support ancestor does not satisfy the root-owned boundary",
    );
  }
  const setfarmRoot = path.dirname(NODE_TOOLCHAIN_ROOT_PARENT_V2);
  const setfarmEntry = inspectEntry(setfarmRoot);
  if (setfarmEntry.state !== "absent" && !expectedEntryIdentity(setfarmEntry, {
    type: "directory",
    expectedOwner: { uid: 0, gid: 0 },
    modes: ["0755"],
  })) {
    return fail(
      "NODE_TOOLCHAIN_PROVISIONER_V2_INSPECTION_FAILED",
      "Existing Setfarm system root does not satisfy exact root:wheel ownership",
    );
  }
}

export async function inspectProductionNodeToolchainProvisionerV2():
Promise<InspectedNodeToolchainProvisionerStateV2> {
  assertProductionSystemBoundary();
  return inspect({
    admissionScope: "production_root",
    architecture: process.arch as NodeToolchainTargetArchitectureV2,
    parent: NODE_TOOLCHAIN_ROOT_PARENT_V2,
    expectedOwner: { uid: 0, gid: 0 },
    parentMode: 0o755,
    parentMayBeAbsent: true,
  });
}

export async function inspectNodeToolchainProvisionerV2ForTest(input: Readonly<{
  parent: string;
  architecture: NodeToolchainTargetArchitectureV2;
}>): Promise<InspectedNodeToolchainProvisionerStateV2> {
  if (
    !input
    || typeof input !== "object"
    || typeof input.parent !== "string"
    || !path.isAbsolute(input.parent)
    || path.normalize(input.parent) !== input.parent
    || input.parent.includes("\0")
    || (input.architecture !== "arm64" && input.architecture !== "x64")
  ) {
    return fail(
      "NODE_TOOLCHAIN_PROVISIONER_V2_INPUT_INVALID",
      "Test provisioner inspection requires one normalized parent and architecture",
    );
  }
  return inspect({
    admissionScope: "test_fixture",
    architecture: input.architecture,
    parent: input.parent,
    expectedOwner: currentProcessOwner(),
    parentMode: 0o700,
    parentMayBeAbsent: false,
  });
}

export function inspectNodeToolchainProvisionerInspectionV2(
  handle: InspectedNodeToolchainProvisionerStateV2,
): NodeToolchainProvisionerInspectionV2 {
  return defensiveCopy(authenticInspectionState(handle).inspection);
}

function buildIntent(input: Readonly<{
  inspection: InspectionStateV2;
  source: ReturnType<typeof inspectNodeToolchainPrivateTreeReceiptV2>;
}>): NodeToolchainProvisioningIntentV2 {
  const target = getCodeOwnedNodeToolchainTargetV2(input.inspection.architecture);
  const paths = pathsFor(input.inspection.parent, target);
  const identity: NodeToolchainProvisioningIntentHashPayloadV2 = {
    schema: NODE_TOOLCHAIN_PROVISIONING_INTENT_V2_SCHEMA,
    intentVersion: NODE_TOOLCHAIN_PROVISIONING_VERSION_V2,
    authorityRef: NODE_TOOLCHAIN_PROVISIONING_AUTHORITY_REF_V2,
    admissionScope: input.inspection.admissionScope,
    architecture: input.inspection.architecture,
    source: {
      privateTreeReceiptHash: input.source.receiptHash,
      distributionManifestHash: input.source.inventory.distribution.manifest.manifestHash,
      distributionArtifactHash: input.source.inventory.distribution.artifact.artifactHash,
      archiveSha256: input.source.inventory.distribution.archive.sha256,
      treeHash: input.source.tree.treeHash,
    },
    target: {
      targetRef: target.targetRef,
      rootBasename: target.rootBasename,
      rootLocatorHash: hashNodeToolchainOperationalLocatorV2("root", paths.root),
      receiptBasename: target.receiptBasename,
      receiptLocatorHash: hashNodeToolchainOperationalLocatorV2("receipt", paths.receipt),
      parentLocatorHash: hashNodeToolchainOperationalLocatorV2("parent", paths.parent),
    },
    publication: {
      serializationPolicy: "darwin_parent_descriptor_lockf_v2",
      claimPolicy: "canonical_no_replace_claim_before_root_v2",
      directoryPolicy: "exclusive_inaccessible_root_then_read_only_v2",
      filePolicy: "same_filesystem_hard_link_no_replace_v2",
      receiptPolicy: "canonical_no_replace_receipt_last_v2",
      durabilityPolicy: "file_and_directory_fsync_v2",
      recoveryPolicy: "exact_claim_bounded_rebuild_v2",
      expectedOwnerUid: input.inspection.expectedOwner.uid,
      expectedOwnerGid: input.inspection.expectedOwner.gid,
      expectedRootMode: "0555",
    },
  };
  const parsed = NodeToolchainProvisioningIntentV2Schema.safeParse({
    ...identity,
    intentHash: hashNodeToolchainProvisioningIntentV2(identity),
  });
  if (!parsed.success) {
    return fail(
      "NODE_TOOLCHAIN_PROVISIONER_V2_SCHEMA_INVALID",
      "Provisioner could not derive the exact publisher intent",
      parsed.error,
    );
  }
  return deepFreezeJson(parsed.data);
}

export function planNodeToolchainProvisioningV2(
  inspectionHandle: InspectedNodeToolchainProvisionerStateV2,
  privateTree: MaterializedNodeToolchainPrivateTreeV2,
): NodeToolchainProvisionerPlanV2 {
  const state = authenticInspectionState(inspectionHandle);
  const source = inspectNodeToolchainPrivateTreeReceiptV2(privateTree);
  const expectedSourceScope = state.admissionScope === "production_root"
    ? "production_distribution"
    : "test_fixture";
  if (
    source.admissionScope !== expectedSourceScope
    || source.inventory.distribution.artifact.architecture !== state.architecture
  ) {
    return fail(
      "NODE_TOOLCHAIN_PROVISIONER_V2_INPUT_INVALID",
      "Provisioner source scope and architecture must equal the inspected target",
    );
  }
  const intent = buildIntent({ inspection: state, source });
  const inspection = state.inspection;
  let decision: "publish" | "recover_exact_claim" | "verify_existing";
  if (inspection.classification === "target_absent") {
    decision = "publish";
  } else if (
    inspection.classification === "interrupted_claimed"
    && inspection.canonical.claim.status === "valid"
    && inspection.canonical.claim.claim.intent.intentHash === intent.intentHash
  ) {
    decision = "recover_exact_claim";
  } else if (
    inspection.classification === "ready_verified"
    && inspection.canonical.receipt.status === "valid"
    && inspection.canonical.receipt.receipt.intent.intentHash === intent.intentHash
  ) {
    decision = "verify_existing";
  } else {
    return fail(
      "NODE_TOOLCHAIN_PROVISIONER_V2_PLAN_CONFLICT",
      "Apply plan cannot adopt a conflict or a different immutable source generation",
    );
  }
  const identity: NodeToolchainProvisionerPlanHashPayloadV2 = {
    schema: NODE_TOOLCHAIN_PROVISIONER_PLAN_V2_SCHEMA,
    planVersion: NODE_TOOLCHAIN_PROVISIONER_COMMAND_VERSION_V2,
    authorityRef: NODE_TOOLCHAIN_PROVISIONER_COMMAND_AUTHORITY_REF_V2,
    operation: "apply",
    admissionScope: state.admissionScope,
    architecture: state.architecture,
    inspection,
    source,
    intent,
    decision,
  };
  const parsed = NodeToolchainProvisionerPlanV2Schema.safeParse({
    ...identity,
    planHash: hashNodeToolchainProvisionerPlanV2(identity),
  });
  if (!parsed.success) {
    return fail(
      "NODE_TOOLCHAIN_PROVISIONER_V2_SCHEMA_INVALID",
      "Fresh apply plan failed its strict canonical schema",
      parsed.error,
    );
  }
  return defensiveCopy(parsed.data);
}

export function planNodeToolchainRollbackV2(
  inspectionHandle: InspectedNodeToolchainProvisionerStateV2,
): NodeToolchainProvisionerPlanV2 {
  const state = authenticInspectionState(inspectionHandle);
  const inspection = state.inspection;
  if (
    inspection.classification !== "ready_verified"
    || inspection.canonical.receipt.status !== "valid"
  ) {
    return fail(
      "NODE_TOOLCHAIN_PROVISIONER_V2_PLAN_CONFLICT",
      "Rollback plan requires one freshly verified ready generation",
    );
  }
  const receipt: NodeToolchainProvisioningReceiptV2 = inspection.canonical.receipt.receipt;
  const identity: NodeToolchainProvisionerPlanHashPayloadV2 = {
    schema: NODE_TOOLCHAIN_PROVISIONER_PLAN_V2_SCHEMA,
    planVersion: NODE_TOOLCHAIN_PROVISIONER_COMMAND_VERSION_V2,
    authorityRef: NODE_TOOLCHAIN_PROVISIONER_COMMAND_AUTHORITY_REF_V2,
    operation: "rollback",
    admissionScope: state.admissionScope,
    architecture: state.architecture,
    inspection,
    generation: {
      receiptHash: receipt.receiptHash,
      intentHash: receipt.intent.intentHash,
      targetRef: receipt.finalRoot.targetRef,
      rootDevice: receipt.finalRoot.device,
      rootInode: receipt.finalRoot.inode,
      treeHash: receipt.finalRoot.treeHash,
    },
    decision: "remove_exact_generation",
  };
  const parsed = NodeToolchainProvisionerPlanV2Schema.safeParse({
    ...identity,
    planHash: hashNodeToolchainProvisionerPlanV2(identity),
  });
  if (!parsed.success) {
    return fail(
      "NODE_TOOLCHAIN_PROVISIONER_V2_SCHEMA_INVALID",
      "Fresh rollback plan failed its strict canonical schema",
      parsed.error,
    );
  }
  return defensiveCopy(parsed.data);
}

function parseApplyPlan(input: unknown): Extract<NodeToolchainProvisionerPlanV2, {
  operation: "apply";
}> {
  let parsed: ReturnType<typeof NodeToolchainProvisionerPlanV2Schema.safeParse>;
  try {
    parsed = NodeToolchainProvisionerPlanV2Schema.safeParse(input);
  } catch (error) {
    return fail(
      "NODE_TOOLCHAIN_PROVISIONER_V2_PLAN_INVALID",
      "Apply requires one bounded strict provisioner plan",
      error,
    );
  }
  if (!parsed.success || parsed.data.operation !== "apply") {
    return fail(
      "NODE_TOOLCHAIN_PROVISIONER_V2_PLAN_INVALID",
      "Apply requires one strict apply plan",
      parsed.success ? undefined : parsed.error,
    );
  }
  return deepFreezeJson(parsed.data);
}

function exactGeneration(receipt: NodeToolchainProvisioningReceiptV2) {
  return Object.freeze({
    receiptHash: receipt.receiptHash,
    intentHash: receipt.intent.intentHash,
    targetRef: receipt.finalRoot.targetRef,
    rootDevice: receipt.finalRoot.device,
    rootInode: receipt.finalRoot.inode,
    treeHash: receipt.finalRoot.treeHash,
  });
}

function buildOperationReceipt(
  identity: NodeToolchainProvisionerOperationReceiptHashPayloadV2,
): NodeToolchainProvisionerOperationReceiptV2 {
  const parsed = NodeToolchainProvisionerOperationReceiptV2Schema.safeParse({
    ...identity,
    operationReceiptHash: hashNodeToolchainProvisionerOperationReceiptV2(identity),
  });
  if (!parsed.success) {
    return fail(
      "NODE_TOOLCHAIN_PROVISIONER_V2_SCHEMA_INVALID",
      "Fresh provisioner operation receipt failed its strict canonical schema",
      parsed.error,
    );
  }
  return defensiveCopy(parsed.data);
}

async function applyPlan(input: Readonly<{
  plan: unknown;
  privateTree: MaterializedNodeToolchainPrivateTreeV2;
  admissionScope: AdmissionScopeV2;
  architecture: NodeToolchainTargetArchitectureV2;
  inspectFresh: () => Promise<InspectedNodeToolchainProvisionerStateV2>;
  provision: () => ReturnType<typeof provisionNodeToolchainV2>;
}>): Promise<NodeToolchainProvisionerOperationReceiptV2> {
  const plan = parseApplyPlan(input.plan);
  if (plan.admissionScope !== input.admissionScope || plan.architecture !== input.architecture) {
    return fail(
      "NODE_TOOLCHAIN_PROVISIONER_V2_PLAN_INVALID",
      "Apply plan cannot cross its production/test scope or target architecture",
    );
  }
  const freshHandle = await input.inspectFresh();
  const fresh = authenticInspectionState(freshHandle).inspection;
  if (fresh.inspectionHash !== plan.inspection.inspectionHash) {
    return fail(
      "NODE_TOOLCHAIN_PROVISIONER_V2_PRECONDITION_CHANGED",
      "Provisioning target changed after the exact apply plan was issued",
    );
  }
  const reproduced = planNodeToolchainProvisioningV2(freshHandle, input.privateTree);
  if (reproduced.planHash !== plan.planHash) {
    return fail(
      "NODE_TOOLCHAIN_PROVISIONER_V2_PLAN_INVALID",
      "Apply plan does not equal the freshly reproduced source, intent and target decision",
    );
  }

  let receipt: NodeToolchainProvisioningReceiptV2;
  try {
    if (plan.decision === "verify_existing") {
      const ready = input.admissionScope === "production_root"
        ? await openProductionProvisionedNodeToolchainV2()
        : await openProvisionedNodeToolchainV2ForTest({
            parent: authenticInspectionState(freshHandle).parent,
            architecture: input.architecture,
          });
      receipt = await revalidateProvisionedNodeToolchainV2(ready);
    } else {
      const provisioned = await input.provision();
      receipt = await revalidateProvisionedNodeToolchainV2(provisioned);
    }
  } catch (error) {
    return fail(
      "NODE_TOOLCHAIN_PROVISIONER_V2_APPLY_FAILED",
      "Exact provisioner apply did not converge through the publisher authority",
      error,
    );
  }
  if (
    receipt.intent.intentHash !== plan.intent.intentHash
    || receipt.source.receiptHash !== plan.source.receiptHash
  ) {
    return fail(
      "NODE_TOOLCHAIN_PROVISIONER_V2_APPLY_FAILED",
      "Publisher returned a generation outside the exact apply plan",
    );
  }
  const afterHandle = await input.inspectFresh();
  const after = authenticInspectionState(afterHandle).inspection;
  if (
    after.classification !== "ready_verified"
    || after.canonical.receipt.status !== "valid"
    || after.canonical.receipt.receipt.receiptHash !== receipt.receiptHash
  ) {
    return fail(
      "NODE_TOOLCHAIN_PROVISIONER_V2_APPLY_FAILED",
      "Applied generation could not be reproduced by a fresh command inspection",
    );
  }
  const result = plan.decision === "publish"
    ? "applied_exact_generation" as const
    : plan.decision === "recover_exact_claim"
      ? "recovered_exact_generation" as const
      : "verified_existing_generation" as const;
  return buildOperationReceipt({
    schema: NODE_TOOLCHAIN_PROVISIONER_OPERATION_RECEIPT_V2_SCHEMA,
    operationVersion: NODE_TOOLCHAIN_PROVISIONER_COMMAND_VERSION_V2,
    authorityRef: NODE_TOOLCHAIN_PROVISIONER_COMMAND_AUTHORITY_REF_V2,
    operation: "apply",
    admissionScope: input.admissionScope,
    architecture: input.architecture,
    plan,
    beforeInspectionHash: fresh.inspectionHash,
    afterInspection: after,
    result,
    generation: exactGeneration(receipt),
  });
}

export async function applyProductionNodeToolchainProvisionerPlanV2(
  plan: unknown,
  privateTree: MaterializedNodeToolchainPrivateTreeV2,
): Promise<NodeToolchainProvisionerOperationReceiptV2> {
  assertProductionSystemBoundary();
  return applyPlan({
    plan,
    privateTree,
    admissionScope: "production_root",
    architecture: process.arch as NodeToolchainTargetArchitectureV2,
    inspectFresh: inspectProductionNodeToolchainProvisionerV2,
    provision: () => provisionNodeToolchainV2(privateTree),
  });
}

export async function applyNodeToolchainProvisionerPlanV2ForTest(input: Readonly<{
  parent: string;
  plan: unknown;
  privateTree: MaterializedNodeToolchainPrivateTreeV2;
}>): Promise<NodeToolchainProvisionerOperationReceiptV2> {
  const parsedPlan = parseApplyPlan(input?.plan);
  if (parsedPlan.admissionScope !== "test_fixture") {
    return fail(
      "NODE_TOOLCHAIN_PROVISIONER_V2_PLAN_INVALID",
      "Test apply requires one permanently test-scoped plan",
    );
  }
  return applyPlan({
    plan: parsedPlan,
    privateTree: input.privateTree,
    admissionScope: "test_fixture",
    architecture: parsedPlan.architecture,
    inspectFresh: () => inspectNodeToolchainProvisionerV2ForTest({
      parent: input.parent,
      architecture: parsedPlan.architecture,
    }),
    provision: () => provisionNodeToolchainV2ForTest(input.privateTree, { parent: input.parent }),
  });
}

async function verifyReady(input: Readonly<{
  admissionScope: AdmissionScopeV2;
  architecture: NodeToolchainTargetArchitectureV2;
  inspectFresh: () => Promise<InspectedNodeToolchainProvisionerStateV2>;
  openReady: () => ReturnType<typeof openProductionProvisionedNodeToolchainV2>;
}>): Promise<NodeToolchainProvisionerOperationReceiptV2> {
  const beforeHandle = await input.inspectFresh();
  const before = authenticInspectionState(beforeHandle).inspection;
  if (before.classification !== "ready_verified") {
    return fail(
      "NODE_TOOLCHAIN_PROVISIONER_V2_VERIFY_FAILED",
      "Verify requires one ready provisioned generation",
    );
  }
  let receipt: NodeToolchainProvisioningReceiptV2;
  try {
    receipt = await revalidateProvisionedNodeToolchainV2(await input.openReady());
  } catch (error) {
    return fail(
      "NODE_TOOLCHAIN_PROVISIONER_V2_VERIFY_FAILED",
      "Ready generation failed durable provisioning revalidation",
      error,
    );
  }
  const afterHandle = await input.inspectFresh();
  const after = authenticInspectionState(afterHandle).inspection;
  if (
    after.inspectionHash !== before.inspectionHash
    || after.classification !== "ready_verified"
    || after.canonical.receipt.status !== "valid"
    || after.canonical.receipt.receipt.receiptHash !== receipt.receiptHash
  ) {
    return fail(
      "NODE_TOOLCHAIN_PROVISIONER_V2_VERIFY_FAILED",
      "Verify observed target drift across its fresh reproduction window",
    );
  }
  return buildOperationReceipt({
    schema: NODE_TOOLCHAIN_PROVISIONER_OPERATION_RECEIPT_V2_SCHEMA,
    operationVersion: NODE_TOOLCHAIN_PROVISIONER_COMMAND_VERSION_V2,
    authorityRef: NODE_TOOLCHAIN_PROVISIONER_COMMAND_AUTHORITY_REF_V2,
    operation: "verify",
    admissionScope: input.admissionScope,
    architecture: input.architecture,
    plan: null,
    beforeInspectionHash: before.inspectionHash,
    afterInspection: after,
    result: "verified_exact_generation",
    generation: exactGeneration(receipt),
  });
}

export async function verifyProductionNodeToolchainProvisionerV2():
Promise<NodeToolchainProvisionerOperationReceiptV2> {
  assertProductionSystemBoundary();
  return verifyReady({
    admissionScope: "production_root",
    architecture: process.arch as NodeToolchainTargetArchitectureV2,
    inspectFresh: inspectProductionNodeToolchainProvisionerV2,
    openReady: openProductionProvisionedNodeToolchainV2,
  });
}

export async function verifyNodeToolchainProvisionerV2ForTest(input: Readonly<{
  parent: string;
  architecture: NodeToolchainTargetArchitectureV2;
}>): Promise<NodeToolchainProvisionerOperationReceiptV2> {
  return verifyReady({
    admissionScope: "test_fixture",
    architecture: input.architecture,
    inspectFresh: () => inspectNodeToolchainProvisionerV2ForTest(input),
    openReady: () => openProvisionedNodeToolchainV2ForTest(input),
  });
}
