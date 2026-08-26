import { spawnSync } from "node:child_process";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import {
  closeSync,
  constants,
  fsyncSync,
  fstatSync,
  linkSync,
  lstatSync,
  mkdirSync,
  openSync,
  readSync,
  readFileSync,
  readdirSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export type InternalProductionPhysicalServiceRestartAuthorityTransitionLeaseV1 = Readonly<{
  schema: "setfarm.internal-production-physical-service-restart-authority-transition-lease.v1";
}>;

export type InternalProductionPreSchemaSpawnerRebindHelperSettlementPairV1 = Readonly<{
  helperSettlementRef: string;
  helperSettlementHash: string;
}>;

export type InternalProductionBaselineServiceRestartOperationPairV1 = Readonly<{
  operationRef: string;
  operationHash: string;
}>;

export type InternalProductionBaselineServiceRestartHelperSettlementPairV1 = Readonly<{
  helperSettlementRef: string;
  helperSettlementHash: string;
}>;

export const MAX_INTERNAL_PRODUCTION_BASELINE_SERVICE_RESTART_HELPER_REGISTRY_HEAD_ENTRIES_V1 = 20_000 as const;
const MAX_INTERNAL_PRODUCTION_BASELINE_SERVICE_RESTART_HELPER_REGISTRATIONS_V1 = 10_000 as const;

export type InternalProductionBaselineServiceRestartHelperRegistryRegistrationPairV1 = Readonly<{ registrationRef: string; registrationHash: string }>;
export type InternalProductionBaselineServiceRestartHelperRegistryTerminalPairV1 = Readonly<{ terminalRef: string; terminalHash: string }>;
export type InternalProductionBaselineServiceRestartHelperRegistryHeadPairV1 = Readonly<{ headRef: string; headHash: string }>;

export type InternalProductionBaselineServiceRestartHelperRegistryRegistrationV1 = Readonly<{
  schema: "setfarm.internal-production-baseline-service-restart-helper-registry-registration.v1";
  registryOrdinal: number;
  predecessorHeadRef: string | null;
  predecessorHeadHash: string | null;
  service: "setfarm-spawner" | "setfarm-dashboard" | "mission-control";
  actionId: "a-restart-service-setfarm-spawner-v1" | "a-restart-service-setfarm-dashboard-v1" | "a-restart-service-mission-control-v1";
  authorizationRef: string; authorizationHash: string;
  operationRef: string; operationHash: string;
  outboxRef: string; outboxHash: string;
  registrationRef: string; registrationHash: string;
}>;

export type InternalProductionBaselineServiceRestartHelperRegistryTerminalV1 = Readonly<{
  schema: "setfarm.internal-production-baseline-service-restart-helper-registry-terminal.v1";
  registryOrdinal: number;
  predecessorHeadRef: string; predecessorHeadHash: string;
  registrationRef: string; registrationHash: string;
  helperJournalHash: string;
  outcome: "completed" | "ambiguous";
  helperSettlementRef: string | null; helperSettlementHash: string | null;
  terminalRef: string; terminalHash: string;
}>;

export type InternalProductionBaselineServiceRestartHelperRegistryHeadV1 = Readonly<{
  schema: "setfarm.internal-production-baseline-service-restart-helper-registry-head.v1";
  registryOrdinal: number;
  entryKind: "registration" | "terminal";
  entryRef: string; entryHash: string;
  predecessorHeadRef: string | null; predecessorHeadHash: string | null;
  headRef: string; headHash: string;
}>;

export type InternalProductionBaselineServiceRestartHelperJournalCensusV1 = Readonly<{
  schema: "setfarm.internal-production-baseline-service-restart-helper-journal-census.v1";
  preSchemaHelperState: "terminal";
  registeredBaselineHelperJournalCount: number;
  terminalBaselineHelperJournalCount: number;
  liveBaselineHelperJournalCount: number;
  ambiguousBaselineHelperJournalCount: number;
  helperJournalRegistryHeadRef: string | null;
  helperJournalRegistryHeadHash: string | null;
  retainedHelperJournalSettlementSetHash: string;
  censusHash: string;
}>;

type RestartEpochCommonV1 = Readonly<{
  schema: "setfarm.internal-production-physical-service-restart-authority-epoch.v1";
  services: readonly ["setfarm-spawner", "setfarm-dashboard", "mission-control"];
  epochRef: string; epochHash: string;
}>;
export type InternalProductionPhysicalServiceRestartAuthorityEpochV1 =
  | Readonly<RestartEpochCommonV1 & { epochOrdinal: 1; authorityOwner: "baseline-a"; predecessorEpochRef: null; predecessorEpochHash: null; retirementRef: null; retirementHash: null; startupHooksReadyRef: null; startupHooksReadyHash: null; successorActivationRef: null; successorActivationHash: null }>
  | Readonly<RestartEpochCommonV1 & { epochOrdinal: 2; authorityOwner: "recovery-d"; predecessorEpochRef: string; predecessorEpochHash: string; retirementRef: string; retirementHash: string; startupHooksReadyRef: string; startupHooksReadyHash: string; successorActivationRef: string; successorActivationHash: string }>;
type CutoverStatusShapeV1 = Readonly<{
  schema: "setfarm.internal-production-physical-service-restart-authority-cutover-status.v1";
  state: "baseline-a-active" | "pending-input" | "prepared" | "resuming" | "recovery-d-active";
  pendingInputRef: string | null; pendingInputHash: string | null;
  ownerAdmissionFenceRef: string | null; ownerAdmissionFenceHash: string | null;
  ownerAdmissionFenceReleaseRef: string | null; ownerAdmissionFenceReleaseHash: string | null;
  operationRef: string | null; operationHash: string | null;
  guardConsumed: boolean;
  physicalRestartEpochOrdinal: 1 | 2;
  physicalRestartAuthorityOwner: "baseline-a" | "recovery-d";
  startupHooksReadyRef: string | null; startupHooksReadyHash: string | null;
  baselineRetirementRef: string | null; baselineRetirementHash: string | null;
  activationRef: string | null; activationHash: string | null;
  cutoverRef: string | null; cutoverHash: string | null;
  statusHash: string;
}>;
type CutoverStatusBaseV1 = Readonly<{ schema: "setfarm.internal-production-physical-service-restart-authority-cutover-status.v1"; statusHash: string }>;
type CutoverStatusTerminalNullsV1 = Readonly<{ startupHooksReadyRef: null; startupHooksReadyHash: null; baselineRetirementRef: null; baselineRetirementHash: null; activationRef: null; activationHash: null; cutoverRef: null; cutoverHash: null }>;
export type InternalProductionPhysicalServiceRestartAuthorityCutoverStatusV1 =
  | Readonly<CutoverStatusBaseV1 & CutoverStatusTerminalNullsV1 & { state: "baseline-a-active"; pendingInputRef: null; pendingInputHash: null; ownerAdmissionFenceRef: null; ownerAdmissionFenceHash: null; ownerAdmissionFenceReleaseRef: null; ownerAdmissionFenceReleaseHash: null; operationRef: null; operationHash: null; guardConsumed: false; physicalRestartEpochOrdinal: 1; physicalRestartAuthorityOwner: "baseline-a" }>
  | Readonly<CutoverStatusBaseV1 & CutoverStatusTerminalNullsV1 & { state: "pending-input"; pendingInputRef: string; pendingInputHash: string; ownerAdmissionFenceRef: string | null; ownerAdmissionFenceHash: string | null; ownerAdmissionFenceReleaseRef: null; ownerAdmissionFenceReleaseHash: null; operationRef: null; operationHash: null; guardConsumed: false; physicalRestartEpochOrdinal: 1; physicalRestartAuthorityOwner: "baseline-a" }>
  | Readonly<CutoverStatusBaseV1 & CutoverStatusTerminalNullsV1 & { state: "prepared"; pendingInputRef: string; pendingInputHash: string; ownerAdmissionFenceRef: string; ownerAdmissionFenceHash: string; ownerAdmissionFenceReleaseRef: null; ownerAdmissionFenceReleaseHash: null; operationRef: string; operationHash: string; guardConsumed: false; physicalRestartEpochOrdinal: 1; physicalRestartAuthorityOwner: "baseline-a" }>
  | Readonly<CutoverStatusBaseV1 & CutoverStatusTerminalNullsV1 & { state: "resuming"; pendingInputRef: string; pendingInputHash: string; ownerAdmissionFenceRef: string; ownerAdmissionFenceHash: string; ownerAdmissionFenceReleaseRef: null; ownerAdmissionFenceReleaseHash: null; operationRef: string; operationHash: string; guardConsumed: true; physicalRestartEpochOrdinal: 1; physicalRestartAuthorityOwner: "baseline-a" }>
  | Readonly<CutoverStatusBaseV1 & { state: "recovery-d-active"; pendingInputRef: string; pendingInputHash: string; ownerAdmissionFenceRef: string; ownerAdmissionFenceHash: string; ownerAdmissionFenceReleaseRef: string; ownerAdmissionFenceReleaseHash: string; operationRef: string; operationHash: string; guardConsumed: true; physicalRestartEpochOrdinal: 2; physicalRestartAuthorityOwner: "recovery-d"; startupHooksReadyRef: string; startupHooksReadyHash: string; baselineRetirementRef: string; baselineRetirementHash: string; activationRef: string; activationHash: string; cutoverRef: string; cutoverHash: string }>;

type LeaseStateV1 = {
  descriptor: number;
  lockBytes: Buffer;
  phase: "held" | "released";
  authorityOwner: "baseline-a";
};

const leases = new WeakMap<object, LeaseStateV1>();
let abandonedAcquireV1: Readonly<{ descriptor: number; lockBytes: Buffer }> | null = null;
const SHA256 = /^[a-f0-9]{64}$/;
const PAIR_REF = /^setfarm:\/\/internal-production\/[a-z0-9-]+\/sha256\/[a-f0-9]{64}$/;
const HELPER_PREFIX = "setfarm://internal-production/pre-schema-spawner-rebind-helper-settlement/sha256/";
const BASELINE_HELPER_PREFIX = "setfarm://internal-production/baseline-service-restart-helper-settlement/sha256/";
const RECOVERY_FORWARD_ABI_HASH_V1 = "c3d88ba2dc7d9e70d773d0056d2fdeaced399f63adc7fd1c37eb423fa22d08d5";
const RECOVERY_FORWARD_ABI_V1 = Object.freeze([
  Object.freeze({ role: "restart-reservation", category: "restart-reservation", producerImplementationId: "d-restart-reservation-v1", expectedModuleRelativePath: "src/internal-production/internal-production-service-restart-authority-v1.ts", expectedExportName: "reserveInternalProductionServiceRestartDispatchOwnerV1" }),
  Object.freeze({ role: "service-restart-operation", category: "service-restart-operation", producerImplementationId: "d-service-restart-operation-v1", expectedModuleRelativePath: "src/internal-production/internal-production-service-restart-authority-v1.ts", expectedExportName: "reserveInternalProductionServiceRestartOperationOwnerV1" }),
  Object.freeze({ role: "launch-outbox", category: "launch-outbox", producerImplementationId: "d-service-restart-launch-outbox-v1", expectedModuleRelativePath: "src/internal-production/internal-production-service-restart-authority-v1.ts", expectedExportName: "publishInternalProductionServiceRestartLaunchOutboxUnderFenceV1" }),
  Object.freeze({ role: "helper-process", category: "process", producerImplementationId: "d-service-restart-helper-process-v1", expectedModuleRelativePath: "src/internal-production/internal-production-service-restart-authority-v1.ts", expectedExportName: "publishInternalProductionServiceRestartHelperProcessUnderFenceV1" }),
  Object.freeze({ role: "dispatch-child-process", category: "process", producerImplementationId: "d-service-restart-child-process-v1", expectedModuleRelativePath: "src/internal-production/internal-production-service-restart-authority-v1.ts", expectedExportName: "publishInternalProductionServiceRestartDispatchChildProcessUnderFenceV1" }),
  Object.freeze({ role: "startup-listener", category: "listener", producerImplementationId: "d-service-restart-startup-listener-v1", expectedModuleRelativePath: "src/internal-production/internal-production-service-restart-authority-v1.ts", expectedExportName: "publishInternalProductionServiceRestartStartupListenerUnderFenceV1" }),
  Object.freeze({ role: "replacement-process", category: "process", producerImplementationId: "d-service-restart-replacement-process-v1", expectedModuleRelativePath: "src/internal-production/internal-production-service-restart-authority-v1.ts", expectedExportName: "publishInternalProductionServiceRestartReplacementProcessUnderFenceV1" }),
]);
const OWNER_CATEGORIES_V1 = Object.freeze(["run", "claim", "execution-attempt", "runtime-session", "completion-owner", "mandatory-effect", "ordinary-service-start", "restart-reservation", "service-restart-operation", "launch-preparation", "prepared-launch", "staged-case", "fixture-attempt", "artifact-reservation", "artifact-publication", "docs-session", "docs-lease", "fleet-stage", "fleet-inflight", "fleet-review", "matrix-inflight", "launch-outbox", "termination", "finding", "recovery", "operational-delivery", "source-run", "cold-rehearsal", "compilation-lease", "execution-lease", "process", "listener", "worktree", "dirty-worktree", "stale-child"] as const);
const COMPLETE_ZERO_KEYS_V1 = Object.freeze(["activeRunCount", "openClaimCount", "executionAttemptCount", "activeRuntimeSessionCount", "activeCompletionOwnerCount", "unsettledMandatoryEffectCount", "ordinaryStartingCount", "restartReservationCount", "serviceRestartOperationCount", "launchPreparationCount", "preparedLaunchCount", "stagedCaseCount", "fixtureAttemptCount", "artifactReservationCount", "publicationBatchCount", "artifactPublicationCount", "docsSessionCount", "docsLeaseCount", "fleetStageCount", "fleetInflightCount", "fleetPendingReviewCount", "matrixInflightCount", "launchOutboxCount", "terminationOwnerCount", "findingOwnerCount", "recoveryOwnerCount", "operationalDeliveryCount", "sourceRunOwnerCount", "coldRehearsalOwnerCount", "compilationLeaseCount", "executionLeaseCount", "ownedProcessCount", "ownedListenerCount", "ownedWorktreeCount", "dirtyWorktreeCount", "staleChildCount"] as const);
const CUTOVER_PENDING_PREFIX = "setfarm://internal-production/physical-service-restart-authority-cutover-pending-input/sha256/";
const CUTOVER_GUARD_PREFIX = "setfarm://internal-production/baseline-zero-owner-mutation-guard/sha256/";
const CUTOVER_OPERATION_PREFIX = "setfarm://internal-production/physical-service-restart-authority-cutover-operation/sha256/";
const CUTOVER_CONSUMPTION_PREFIX = "setfarm://internal-production/baseline-physical-service-restart-authority-cutover-zero-owner-guard-consumption/sha256/";
const GLOBAL_FENCE_PREFIX = "setfarm://internal-production/global-owner-admission-fence/sha256/";
const GLOBAL_FENCE_RELEASE_PREFIX = "setfarm://internal-production/global-owner-admission-fence-release/sha256/";

function fail(message: string): never {
  throw new Error(`INTERNAL_PRODUCTION_RESTART_AUTHORITY_TRANSITION_INVALID:${message}`);
}

function canonical(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${canonical(record[key])}`).join(",")}}`;
}

function sha256(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

function repositoryRoot(): string {
  const current = path.dirname(fileURLToPath(import.meta.url));
  const source = path.dirname(current);
  if (!new Set(["src", "dist"]).has(path.basename(source))) fail("module root is invalid");
  return path.dirname(source);
}

type PrivateDirectoryGuardV1 = Readonly<{ assertStable: () => void; close: () => void }>;

function authenticatePrivateDirectoryChainV1(anchor: string, target: string): PrivateDirectoryGuardV1 {
  const relative = path.relative(anchor, target);
  if (relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) fail("authority directory escapes the repository root");
  const segments = relative === "" ? [] : relative.split(path.sep);
  const paths = [anchor, ...segments.map((_, index) => path.join(anchor, ...segments.slice(0, index + 1)))];
  const descriptors: number[] = [];
  const held: Array<ReturnType<typeof fstatSync>> = [];
  let closed = false;
  const assertStable = (): void => {
    if (closed) fail("authority directory guard is closed");
    for (const [index, current] of paths.entries()) {
      const after = lstatSync(current, { bigint: true });
      const descriptorAfter = fstatSync(descriptors[index]!, { bigint: true });
      const observed = held[index]!;
      if (
        !after.isDirectory() || after.isSymbolicLink() || !descriptorAfter.isDirectory()
        || after.dev !== observed.dev || after.ino !== observed.ino || after.mode !== observed.mode
        || descriptorAfter.dev !== observed.dev || descriptorAfter.ino !== observed.ino
        || descriptorAfter.mode !== observed.mode
      ) fail("authority directory changed while authenticated");
    }
  };
  try {
    for (const [index, current] of paths.entries()) {
      const before = lstatSync(current, { bigint: true });
      const descriptor = openSync(current, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_DIRECTORY);
      descriptors.push(descriptor);
      const observed = fstatSync(descriptor, { bigint: true });
      if (
        !before.isDirectory() || before.isSymbolicLink() || !observed.isDirectory()
        || before.dev !== observed.dev || before.ino !== observed.ino || before.mode !== observed.mode
        || before.nlink !== observed.nlink || before.nlink < 1n
        || (index > 0 && (observed.mode & 0o7777n) !== 0o700n)
        || (index > 0 && observed.dev !== held[0]!.dev)
      ) fail("authority directory identity is invalid");
      held.push(observed);
    }
    assertStable();
    return Object.freeze({
      assertStable,
      close: () => {
        if (closed) fail("authority directory guard is already closed");
        closed = true;
        for (const descriptor of descriptors.reverse()) closeSync(descriptor);
      },
    });
  } catch (error) {
    closed = true;
    for (const descriptor of descriptors.reverse()) closeSync(descriptor);
    throw error;
  }
}

function ensurePrivateAuthorityDirectoryV1(directory: string): PrivateDirectoryGuardV1 {
  const anchor = path.resolve(repositoryRoot());
  const target = path.resolve(directory);
  const relative = path.relative(anchor, target);
  if (relative === "" || relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) fail("authority directory escapes the repository root");
  let current = anchor;
  for (const segment of relative.split(path.sep)) {
    const parentGuard = authenticatePrivateDirectoryChainV1(anchor, current);
    current = path.join(current, segment);
    try {
      parentGuard.assertStable();
      try { mkdirSync(current, { mode: 0o700 }); }
      catch (error) {
        if (!(error instanceof Error) || !("code" in error) || error.code !== "EEXIST") throw error;
      }
      parentGuard.assertStable();
    } finally {
      parentGuard.close();
    }
    const createdGuard = authenticatePrivateDirectoryChainV1(anchor, current);
    createdGuard.close();
  }
  return authenticatePrivateDirectoryChainV1(anchor, target);
}

function rootPaths() {
  const root = path.join(repositoryRoot(), "data/internal-production-baseline/restart-authority-retirement-v1");
  return Object.freeze({
    root,
    lock: path.join(root, "physical-service-restart-authority.transition.lock"),
    epoch: path.join(root, "epoch-head.json"),
    journal: path.join(root, "pre-schema-helper-journal.json"),
    settlements: path.join(root, "pre-schema-helper-settlements", "sha256"),
    baselineJournals: path.join(root, "baseline-helper-journals", "sha256"),
    baselineSettlements: path.join(root, "baseline-helper-settlements", "sha256"),
    baselineRegistry: path.join(root, "baseline-helper-registry-v1"),
    cutover: path.join(root, "cutover-to-recovery-d-v1"),
  });
}

function exactOwnRecord(value: unknown, keys: readonly string[], label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype || Reflect.ownKeys(value).some((key) => typeof key !== "string") || JSON.stringify(Object.keys(value)) !== JSON.stringify(keys)) fail(`${label} shape is invalid`);
  return value as Record<string, unknown>;
}

function exactFrozenObserverRecordV1(value: unknown, keys: readonly string[], label: string): Readonly<Record<string, unknown>> {
  const record = exactOwnRecord(value, keys, label);
  const authenticate = (member: unknown, memberLabel: string): void => {
    if (!member || typeof member !== "object") return;
    if (!Object.isFrozen(member) || (!Array.isArray(member) && Object.getPrototypeOf(member) !== Object.prototype) || Reflect.ownKeys(member).some((key) => typeof key !== "string")) fail(`${memberLabel} is not recursively frozen data`);
    for (const key of Reflect.ownKeys(member) as string[]) {
      const descriptor = Object.getOwnPropertyDescriptor(member, key);
      if (Array.isArray(member) && key === "length") {
        if (!descriptor || descriptor.enumerable !== false || descriptor.configurable !== false || descriptor.writable !== false || descriptor.value !== member.length) fail(`${memberLabel} length descriptor is invalid`);
        continue;
      }
      if (!descriptor || descriptor.get || descriptor.set || descriptor.enumerable !== true || descriptor.configurable !== false || descriptor.writable !== false || !("value" in descriptor)) fail(`${memberLabel} descriptor is invalid`);
      authenticate(descriptor.value, `${memberLabel}.${key}`);
    }
  };
  authenticate(record, label);
  return record;
}

function exactCanonicalRecord(value: unknown, keys: readonly string[], label: string): Record<string, unknown> {
  const ordered = [...keys].sort((left, right) => Buffer.compare(Buffer.from(left), Buffer.from(right)));
  if (!value || typeof value !== "object" || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype || Reflect.ownKeys(value).some((key) => typeof key !== "string") || JSON.stringify(Object.keys(value)) !== JSON.stringify(ordered)) fail(`${label} shape is invalid`);
  return value as Record<string, unknown>;
}

function readStableRetirementBytes(file: string, label: string): Buffer {
  const guard = authenticatePrivateDirectoryChainV1(path.resolve(repositoryRoot()), path.dirname(file));
  try {
    guard.assertStable();
    const descriptor = openSync(file, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
    try {
      const before = fstatSync(descriptor, { bigint: true });
      if (!before.isFile() || before.isSymbolicLink() || before.nlink !== 1n || (before.mode & 0o7777n) !== 0o600n || before.size < 1n || before.size > 1_048_576n) fail(`${label} identity is invalid`);
      const bytes = readFileSync(descriptor);
      const after = fstatSync(descriptor, { bigint: true });
      const reopened = lstatSync(file, { bigint: true });
      if (before.dev !== after.dev || before.ino !== after.ino || before.mode !== after.mode || before.nlink !== after.nlink || before.size !== after.size || before.mtimeNs !== after.mtimeNs || before.ctimeNs !== after.ctimeNs || after.dev !== reopened.dev || after.ino !== reopened.ino || reopened.isSymbolicLink() || BigInt(bytes.length) !== after.size) fail(`${label} changed while read`);
      guard.assertStable();
      return bytes;
    } finally { closeSync(descriptor); }
  } finally {
    try { guard.assertStable(); } finally { guard.close(); }
  }
}

function pinStableCasPredecessorV1(file: string, label: string): Readonly<{ bytes: Buffer; assertStable: () => void; close: () => void }> {
  const descriptor = openSync(file, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  let closed = false;
  try {
    const identity = fstatSync(descriptor, { bigint: true });
    const atPath = lstatSync(file, { bigint: true });
    if (!identity.isFile() || identity.isSymbolicLink() || identity.nlink !== 1n || (identity.mode & 0o7777n) !== 0o600n || identity.size < 1n || identity.size > 1_048_576n || identity.dev !== atPath.dev || identity.ino !== atPath.ino) fail(`${label} pinned identity is invalid`);
    const bytes = Buffer.alloc(Number(identity.size));
    let offset = 0;
    while (offset < bytes.length) { const count = readSync(descriptor, bytes, offset, bytes.length - offset, offset); if (count < 1) fail(`${label} pinned bytes are truncated`); offset += count; }
    const assertStable = (): void => {
      if (closed) fail(`${label} pinned descriptor is closed`);
      const current = fstatSync(descriptor, { bigint: true });
      const currentPath = lstatSync(file, { bigint: true });
      if (!current.isFile() || current.isSymbolicLink() || current.nlink !== 1n || (current.mode & 0o7777n) !== 0o600n || current.dev !== identity.dev || current.ino !== identity.ino || current.mode !== identity.mode || current.size !== identity.size || current.mtimeNs !== identity.mtimeNs || current.ctimeNs !== identity.ctimeNs || currentPath.dev !== identity.dev || currentPath.ino !== identity.ino || currentPath.mode !== identity.mode || currentPath.nlink !== 1n || currentPath.size !== identity.size || currentPath.mtimeNs !== identity.mtimeNs || currentPath.ctimeNs !== identity.ctimeNs) fail(`${label} pinned predecessor changed`);
      const recheck = Buffer.alloc(bytes.length); let position = 0;
      while (position < recheck.length) { const count = readSync(descriptor, recheck, position, recheck.length - position, position); if (count < 1) fail(`${label} pinned predecessor is truncated`); position += count; }
      if (!recheck.equals(bytes)) fail(`${label} pinned predecessor bytes changed`);
    };
    assertStable();
    return Object.freeze({ bytes, assertStable, close: (): void => { if (!closed) { closed = true; closeSync(descriptor); } } });
  } catch (error) { if (!closed) closeSync(descriptor); throw error; }
}

function descriptorIdentity(descriptor: number): Readonly<{ devDecimal: string; inoDecimal: string }> {
  const stats = fstatSync(descriptor, { bigint: true });
  if (!stats.isFile() || stats.isSymbolicLink() || stats.nlink !== 1n) fail("capability descriptor identity is invalid");
  return Object.freeze({ devDecimal: stats.dev.toString(10), inoDecimal: stats.ino.toString(10) });
}

function boundedPsProcessIdentity(pid: number): Readonly<{
  pid: number;
  processStartTimeEpochMs: number;
  lstart: string;
  command: string;
  processIdentityHash: string;
}> | null {
  const observed = spawnSync("/bin/ps", ["-p", String(pid), "-o", "lstart=,command="], {
    env: Object.freeze({ PATH: "/usr/bin:/bin", LANG: "C", LC_ALL: "C" }),
    shell: false,
    encoding: "utf8",
    timeout: 2_000,
    maxBuffer: 65_536,
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (!observed.error && !observed.signal && observed.status === 1 && observed.stdout === "" && observed.stderr === "") return null;
  if (observed.error || observed.signal || observed.status !== 0 || observed.stderr !== "" || !observed.stdout.endsWith("\n") || observed.stdout.slice(0, -1).includes("\n")) fail("transition lock owner process observation is ambiguous");
  const row = observed.stdout.slice(0, -1);
  if (row.length < 26) fail("transition lock owner process observation is malformed");
  const lstart = row.slice(0, 24);
  const command = row.slice(24).trimStart();
  const processStartTimeEpochMs = Date.parse(lstart);
  if (!Number.isSafeInteger(processStartTimeEpochMs) || processStartTimeEpochMs < 1 || command.length < 1) fail("transition lock owner process identity is invalid");
  const body = { schema: "setfarm.internal-production-transition-lock-owner-process-identity.v1", pid, processStartTimeEpochMs, lstart, command };
  return Object.freeze({ pid, processStartTimeEpochMs, lstart, command, processIdentityHash: sha256(canonical(body)) });
}

function currentLockRecord(): Readonly<Record<string, unknown>> {
  const observed = boundedPsProcessIdentity(process.pid);
  if (!observed) fail("current transition lock owner process is absent");
  return Object.freeze({
    schema: "setfarm.internal-production-physical-service-restart-authority-transition-lock.v1",
    pid: observed.pid,
    processStartTimeEpochMs: observed.processStartTimeEpochMs,
    processIdentityHash: observed.processIdentityHash,
    leaseNonce: randomBytes(32).toString("hex"),
  });
}

function parseLockRecord(bytes: Buffer): Readonly<Record<string, unknown>> {
  let value: unknown;
  try { value = JSON.parse(bytes.toString("utf8")); } catch { return fail("transition lock record is not JSON"); }
  const record = exactCanonicalRecord(value, ["schema", "pid", "processStartTimeEpochMs", "processIdentityHash", "leaseNonce"], "transition lock");
  if (`${canonical(record)}\n` !== bytes.toString("utf8") || record.schema !== "setfarm.internal-production-physical-service-restart-authority-transition-lock.v1" || !Number.isSafeInteger(record.pid) || (record.pid as number) < 1 || !Number.isSafeInteger(record.processStartTimeEpochMs) || (record.processStartTimeEpochMs as number) < 1 || typeof record.processIdentityHash !== "string" || !SHA256.test(record.processIdentityHash) || typeof record.leaseNonce !== "string" || !SHA256.test(record.leaseNonce)) fail("transition lock record is invalid");
  return Object.freeze(record);
}

function fsyncParent(file: string): void {
  const descriptor = openSync(path.dirname(file), constants.O_RDONLY | constants.O_NOFOLLOW);
  try { fsyncSync(descriptor); } finally { closeSync(descriptor); }
}

function cleanupExactOwnedLock(lock: string, descriptor: number, expectedBytes: Buffer | null): void {
  const held = fstatSync(descriptor, { bigint: true });
  const atPath = lstatSync(lock, { bigint: true });
  const reopened = openSync(lock, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  try {
    const again = fstatSync(reopened, { bigint: true });
    const bytes = readFileSync(reopened);
    if (
      !held.isFile() || held.isSymbolicLink() || held.nlink !== 1n || (held.mode & 0o7777n) !== 0o600n
      || !atPath.isFile() || atPath.isSymbolicLink() || atPath.nlink !== 1n || (atPath.mode & 0o7777n) !== 0o600n
      || !again.isFile() || again.isSymbolicLink() || again.nlink !== 1n || (again.mode & 0o7777n) !== 0o600n
      || atPath.dev !== held.dev || atPath.ino !== held.ino || again.dev !== held.dev || again.ino !== held.ino
      || (expectedBytes !== null && !bytes.equals(expectedBytes))
    ) fail("owned transition lock cleanup identity differs");
    const finalPathStats = lstatSync(lock, { bigint: true });
    if (finalPathStats.dev !== held.dev || finalPathStats.ino !== held.ino || finalPathStats.nlink !== 1n || (finalPathStats.mode & 0o7777n) !== 0o600n) fail("owned transition lock changed immediately before cleanup");
    unlinkSync(lock);
    fsyncParent(lock);
  } finally { closeSync(reopened); }
}

function repairCompletedNoReplacePublication(file: string): void {
  const directory = path.dirname(file);
  const basename = path.basename(file);
  let candidates: string[];
  try { candidates = readdirSync(directory).filter((name) => name.startsWith(`.${basename}.`)); }
  catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") return;
    throw error;
  }
  if (candidates.some((name) => !new RegExp(`^\\.${basename.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\.[a-f0-9]{32}\\.tmp$`).test(name)) || candidates.length > 1) fail("durable retirement publication recovery inventory is invalid");
  if (candidates.length === 0) return;
  let finalStats: { dev: bigint; ino: bigint };
  try { finalStats = lstatSync(file, { bigint: true }); }
  catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") return;
    throw error;
  }
  const temporary = path.join(directory, candidates[0]!);
  const finalDescriptor = openSync(file, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  const temporaryDescriptor = openSync(temporary, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  try {
    const finalHeld = fstatSync(finalDescriptor, { bigint: true });
    const temporaryHeld = fstatSync(temporaryDescriptor, { bigint: true });
    const finalBytes = readFileSync(finalDescriptor);
    const temporaryBytes = readFileSync(temporaryDescriptor);
    const linked = finalHeld.nlink === 2n && temporaryHeld.nlink === 2n && finalHeld.dev === temporaryHeld.dev && finalHeld.ino === temporaryHeld.ino;
    const collision = finalHeld.nlink === 1n && temporaryHeld.nlink === 1n && finalHeld.dev !== temporaryHeld.dev && finalBytes.equals(temporaryBytes);
    if (!finalHeld.isFile() || !temporaryHeld.isFile() || (finalHeld.mode & 0o7777n) !== 0o600n || (temporaryHeld.mode & 0o7777n) !== 0o600n || finalStats.dev !== finalHeld.dev || finalStats.ino !== finalHeld.ino || (!linked && !collision) || !finalBytes.equals(temporaryBytes)) fail("durable retirement publication recovery is crossed");
    const finalPathStats = lstatSync(file, { bigint: true });
    const temporaryPathStats = lstatSync(temporary, { bigint: true });
    if (finalPathStats.dev !== finalHeld.dev || finalPathStats.ino !== finalHeld.ino || temporaryPathStats.dev !== temporaryHeld.dev || temporaryPathStats.ino !== temporaryHeld.ino) fail("durable retirement publication changed before recovery cleanup");
    unlinkSync(temporary);
    fsyncParent(file);
  } finally { closeSync(temporaryDescriptor); closeSync(finalDescriptor); }
}

function recoverExpectedNoReplacePublication(file: string, expectedBytes: Buffer): boolean {
  repairCompletedNoReplacePublication(file);
  try {
    if (!readStableRetirementBytes(file, "expected durable publication").equals(expectedBytes)) fail("expected durable publication differs");
    return true;
  } catch (error) {
    if (!(error instanceof Error) || !("code" in error) || error.code !== "ENOENT") throw error;
  }
  const directory = path.dirname(file);
  const basename = path.basename(file);
  let candidates: string[];
  try { candidates = readdirSync(directory).filter((name) => name.startsWith(`.${basename}.`)); }
  catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") return false;
    throw error;
  }
  if (candidates.length === 0) return false;
  if (candidates.length !== 1 || !new RegExp(`^\\.${basename.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\.[a-f0-9]{32}\\.tmp$`).test(candidates[0]!)) fail("expected durable publication recovery inventory is invalid");
  const temporary = path.join(directory, candidates[0]!);
  const temporaryDescriptor = openSync(temporary, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  try {
    const before = fstatSync(temporaryDescriptor, { bigint: true });
    const bytes = readFileSync(temporaryDescriptor);
    const atPath = lstatSync(temporary, { bigint: true });
    if (!before.isFile() || before.nlink !== 1n || (before.mode & 0o7777n) !== 0o600n || atPath.dev !== before.dev || atPath.ino !== before.ino || !bytes.equals(expectedBytes)) fail("expected durable publication recovery temporary differs");
    linkSync(temporary, file);
    fsyncParent(file);
    const finalDescriptor = openSync(file, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
    try {
      const finalStats = fstatSync(finalDescriptor, { bigint: true });
      const temporaryStats = fstatSync(temporaryDescriptor, { bigint: true });
      if (finalStats.dev !== before.dev || finalStats.ino !== before.ino || finalStats.nlink !== 2n || temporaryStats.nlink !== 2n || !readFileSync(finalDescriptor).equals(expectedBytes)) fail("expected durable publication promotion differs");
      const finalPathStats = lstatSync(file, { bigint: true });
      const temporaryPathStats = lstatSync(temporary, { bigint: true });
      if (finalPathStats.dev !== before.dev || finalPathStats.ino !== before.ino || temporaryPathStats.dev !== before.dev || temporaryPathStats.ino !== before.ino) fail("expected durable publication changed before temporary cleanup");
      unlinkSync(temporary);
      fsyncParent(file);
    } finally { closeSync(finalDescriptor); }
  } finally { closeSync(temporaryDescriptor); }
  if (!readStableRetirementBytes(file, "recovered durable publication").equals(expectedBytes)) fail("recovered durable publication differs");
  return true;
}

function openNewLock(lock: string): Readonly<{ descriptor: number; lockBytes: Buffer }> {
  const value = currentLockRecord();
  const lockBytes = Buffer.from(`${canonical(value)}\n`, "utf8");
  const descriptor = openSync(lock, constants.O_RDWR | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
  let exactBytesWritten = false;
  try {
    writeFileSync(descriptor, lockBytes);
    exactBytesWritten = true;
    fsyncSync(descriptor);
    fsyncParent(lock);
    const stats = fstatSync(descriptor, { bigint: true });
    if (!stats.isFile() || stats.isSymbolicLink() || stats.nlink !== 1n || (stats.mode & 0o7777n) !== 0o600n) fail("new transition lock identity is invalid");
    return Object.freeze({ descriptor, lockBytes });
  } catch (error) {
    try { cleanupExactOwnedLock(lock, descriptor, exactBytesWritten ? lockBytes : null); }
    finally { closeSync(descriptor); }
    throw error;
  }
}

function assertHelperJournalAllowsLockCleanup(
  transitionLock: Readonly<Record<string, unknown>>,
  currentLockIdentity: Readonly<{ devDecimal: string; inoDecimal: string }>,
): void {
  const paths = rootPaths();
  let bytes: Buffer;
  try { bytes = readStableRetirementBytes(paths.journal, "helper journal"); }
  catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      closeNormalHelperJournalsBeforeLockCleanupV1(transitionLock, currentLockIdentity);
      return;
    }
    throw error;
  }
  let value: unknown;
  try { value = JSON.parse(bytes.toString("utf8")); } catch { return fail("helper journal is not JSON during lock cleanup"); }
  const journal = exactCanonicalRecord(value, ["schema", "family", "operationSchema", "operationPurpose", "action", "currentEntryOperation", "restartAuthority", "transitionLock", "lockIdentity", "maximumDispatchCount", "journalHash"], "helper journal lock cleanup");
  const journalTransitionLock = parseLockRecord(Buffer.from(`${canonical(journal.transitionLock)}\n`, "utf8"));
  const journalLockIdentity = exactCanonicalRecord(journal.lockIdentity, ["devDecimal", "inoDecimal"], "helper journal lock identity");
  if (canonical(journalTransitionLock) !== canonical(transitionLock) || canonical(journalLockIdentity) !== canonical(currentLockIdentity)) {
    closeNormalHelperJournalsBeforeLockCleanupV1(transitionLock, currentLockIdentity);
    return;
  }
  const projection = { ...journal };
  delete projection.journalHash;
  if (
    `${canonical(journal)}\n` !== bytes.toString("utf8")
    || journal.schema !== "setfarm.internal-production-service-restart-helper-journal.v1"
    || journal.family !== "pre-schema-spawner-rebind"
    || journal.operationSchema !== "setfarm.internal-production-current-entry-operation.v1"
    || journal.operationPurpose !== "task6a-internal-production-current-entry-v1"
    || journal.action !== "task6a-pre-schema-setfarm-spawner-rebind-v1"
    || journal.maximumDispatchCount !== 1
    || typeof journal.journalHash !== "string" || !SHA256.test(journal.journalHash)
    || sha256(canonical(projection)) !== journal.journalHash
  ) fail("helper journal is crossed during lock cleanup");
  const currentEntryOperation = exactCanonicalRecord(journal.currentEntryOperation, ["operationRef", "operationHash"], "helper journal operation pair");
  const restartAuthority = exactCanonicalRecord(journal.restartAuthority, ["restartAuthorityRef", "restartAuthorityHash"], "helper journal restart pair");
  if (typeof currentEntryOperation.operationRef !== "string" || !PAIR_REF.test(currentEntryOperation.operationRef) || typeof currentEntryOperation.operationHash !== "string" || !SHA256.test(currentEntryOperation.operationHash) || !currentEntryOperation.operationRef.endsWith(currentEntryOperation.operationHash) || typeof restartAuthority.restartAuthorityRef !== "string" || !PAIR_REF.test(restartAuthority.restartAuthorityRef) || typeof restartAuthority.restartAuthorityHash !== "string" || !SHA256.test(restartAuthority.restartAuthorityHash) || !restartAuthority.restartAuthorityRef.endsWith(restartAuthority.restartAuthorityHash)) fail("helper journal pair is invalid during lock cleanup");
  const lockIdentity = journalLockIdentity;
  const settlementBody = {
    schema: "setfarm.internal-production-pre-schema-spawner-rebind-helper-settlement.v1",
    action: "task6a-pre-schema-setfarm-spawner-rebind-v1",
    currentEntryOperation,
    restartAuthority,
    journalHash: journal.journalHash,
    transitionLock,
    lockIdentity,
    dispatchCount: 1,
    disposition: "completed",
  };
  const helperSettlementHash = sha256(canonical(settlementBody));
  const helperSettlementRef = `${HELPER_PREFIX}${helperSettlementHash}`;
  const settlementPath = path.join(paths.settlements, helperSettlementHash.slice(0, 2), `${helperSettlementHash}.json`);
  recoverExpectedNoReplacePublication(
    settlementPath,
    Buffer.from(`${canonical({ ...settlementBody, helperSettlementRef, helperSettlementHash })}\n`, "utf8"),
  );
  let settlement: Readonly<Record<string, unknown>>;
  try { settlement = readSettlement(helperSettlementHash); }
  catch { return fail("HELPER_DISPATCH_SETTLEMENT_UNKNOWN"); }
  if (canonical(settlement) !== canonical({ ...settlementBody, helperSettlementRef, helperSettlementHash })) fail("helper settlement differs during lock cleanup");
  closeNormalHelperJournalsBeforeLockCleanupV1(transitionLock, currentLockIdentity);
}

function reclaimDeadLockOnce(lock: string): void {
  const descriptor = openSync(lock, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const first = fstatSync(descriptor, { bigint: true });
    if (!first.isFile() || first.isSymbolicLink() || first.nlink !== 1n || (first.mode & 0o7777n) !== 0o600n) fail("existing transition lock identity is invalid");
    const bytes = readFileSync(descriptor);
    if (bytes.length < 1 || bytes.length > 65_536) fail("transition lock record size is invalid");
    const record = parseLockRecord(bytes);
    const observed = boundedPsProcessIdentity(record.pid as number);
    if (observed) {
      if (observed.processStartTimeEpochMs !== record.processStartTimeEpochMs || observed.processIdentityHash !== record.processIdentityHash) fail("transition lock PID was reused or replaced");
      fail("restart transition lease is unavailable");
    }
    assertHelperJournalAllowsLockCleanup(record, descriptorIdentity(descriptor));
    const pathStats = lstatSync(lock, { bigint: true });
    const secondDescriptor = openSync(lock, constants.O_RDONLY | constants.O_NOFOLLOW);
    try {
      const second = fstatSync(secondDescriptor, { bigint: true });
      const secondBytes = readFileSync(secondDescriptor);
      if (pathStats.dev !== first.dev || pathStats.ino !== first.ino || pathStats.nlink !== 1n || second.dev !== first.dev || second.ino !== first.ino || second.nlink !== 1n || !secondBytes.equals(bytes)) fail("transition lock changed before dead-owner cleanup");
      const finalPathStats = lstatSync(lock, { bigint: true });
      if (finalPathStats.dev !== first.dev || finalPathStats.ino !== first.ino || finalPathStats.nlink !== 1n || (finalPathStats.mode & 0o7777n) !== 0o600n) fail("transition lock changed immediately before dead-owner cleanup");
      unlinkSync(lock);
      fsyncParent(lock);
    } finally { closeSync(secondDescriptor); }
  } finally { closeSync(descriptor); }
}

function writeNoReplace(file: string, value: unknown): boolean {
  const bytes = Buffer.from(`${canonical(value)}\n`, "utf8");
  const directoryGuard = ensurePrivateAuthorityDirectoryV1(path.dirname(file));
  try {
    directoryGuard.assertStable();
    const directory = path.dirname(file);
    const basename = path.basename(file);
    const prefix = `.${basename}.`;
    const escaped = basename.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const candidates = readdirSync(directory).filter((name) => name.startsWith(prefix));
    if (candidates.length > 1 || candidates.some((name) => !new RegExp(`^\\.${escaped}\\.[a-f0-9]{32}\\.tmp$`).test(name))) fail("retirement publication recovery inventory is invalid");
    let temporary: string;
    if (candidates.length === 1) {
      temporary = path.join(directory, candidates[0]!);
      const descriptor = openSync(temporary, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
      try {
        const stats = fstatSync(descriptor, { bigint: true });
        if (!stats.isFile() || stats.nlink < 1n || stats.nlink > 2n || (stats.mode & 0o7777n) !== 0o600n || !readFileSync(descriptor).equals(bytes)) fail("retirement publication recovery temporary differs");
      } finally { closeSync(descriptor); }
    } else {
      temporary = path.join(directory, `${prefix}${randomBytes(16).toString("hex")}.tmp`);
      const descriptor = openSync(temporary, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
      try { writeFileSync(descriptor, bytes); fsyncSync(descriptor); } finally { closeSync(descriptor); }
    }
    let created = true;
    try { linkSync(temporary, file); } catch (error) {
      if (!(error instanceof Error) || !("code" in error) || error.code !== "EEXIST") throw error;
      created = false;
    }
    const finalDescriptor = openSync(file, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
    const temporaryDescriptor = openSync(temporary, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
    try {
      const finalStats = fstatSync(finalDescriptor, { bigint: true });
      const temporaryStats = fstatSync(temporaryDescriptor, { bigint: true });
      const finalBytes = readFileSync(finalDescriptor);
      const temporaryBytes = readFileSync(temporaryDescriptor);
      const linked = finalStats.dev === temporaryStats.dev && finalStats.ino === temporaryStats.ino && finalStats.nlink === 2n && temporaryStats.nlink === 2n;
      const collision = finalStats.dev === temporaryStats.dev && finalStats.ino !== temporaryStats.ino && finalStats.nlink === 1n && temporaryStats.nlink === 1n && finalBytes.equals(temporaryBytes);
      if (!finalStats.isFile() || !temporaryStats.isFile() || (finalStats.mode & 0o7777n) !== 0o600n || (temporaryStats.mode & 0o7777n) !== 0o600n || !finalBytes.equals(bytes) || !temporaryBytes.equals(bytes) || (!linked && !collision)) fail("immutable retirement publication collision is crossed");
      const finalPathStats = lstatSync(file, { bigint: true });
      const temporaryPathStats = lstatSync(temporary, { bigint: true });
      if (finalPathStats.dev !== finalStats.dev || finalPathStats.ino !== finalStats.ino || temporaryPathStats.dev !== temporaryStats.dev || temporaryPathStats.ino !== temporaryStats.ino) fail("retirement publication changed before recovery cleanup");
      unlinkSync(temporary);
      fsyncParent(file);
    } finally { closeSync(temporaryDescriptor); closeSync(finalDescriptor); }
    const verifiedDescriptor = openSync(file, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
    try {
      const stats = fstatSync(verifiedDescriptor, { bigint: true });
      const atPath = lstatSync(file, { bigint: true });
      if (!stats.isFile() || stats.isSymbolicLink() || stats.nlink !== 1n || (stats.mode & 0o7777n) !== 0o600n || stats.dev !== atPath.dev || stats.ino !== atPath.ino || !readFileSync(verifiedDescriptor).equals(bytes)) fail("immutable retirement record differs");
    } finally { closeSync(verifiedDescriptor); }
    directoryGuard.assertStable();
    return created;
  } finally {
    try { directoryGuard.assertStable(); } finally { directoryGuard.close(); }
  }
}

function pair(value: unknown, refKey: string, hashKey: string): Readonly<Record<string, string>> {
  const result = exactOwnRecord(value, [refKey, hashKey], `${refKey} pair`);
  if (typeof result[refKey] !== "string" || !PAIR_REF.test(result[refKey] as string) || typeof result[hashKey] !== "string" || !SHA256.test(result[hashKey] as string) || !(result[refKey] as string).endsWith(result[hashKey] as string)) fail(`${refKey} pair is invalid`);
  return Object.freeze(result as Record<string, string>);
}

function assertEpochOneActive(): Readonly<Record<string, unknown>> {
  const { epoch } = rootPaths();
  const bytes = readStableRetirementBytes(epoch, "restart epoch");
  const value = JSON.parse(bytes.toString("utf8")) as unknown;
  const head = exactCanonicalRecord(value, [
    "schema", "epochOrdinal", "authorityOwner", "services", "predecessorEpochRef", "predecessorEpochHash",
    "retirementRef", "retirementHash", "startupHooksReadyRef", "startupHooksReadyHash",
    "successorActivationRef", "successorActivationHash", "epochRef", "epochHash",
  ], "restart epoch");
  const projection = { ...head };
  delete projection.epochRef;
  delete projection.epochHash;
  const epochHash = sha256(canonical(projection));
  if (head.authorityOwner === "recovery-d") {
    assertEpochTwoActive();
    fail("BASELINE_RESTART_AUTHORITY_RETIRED");
  }
  if (
    `${canonical(head)}\n` !== bytes.toString("utf8")
    || head.schema !== "setfarm.internal-production-physical-service-restart-authority-epoch.v1"
    || head.epochOrdinal !== 1
    || head.authorityOwner !== "baseline-a"
    || canonical(head.services) !== canonical(["setfarm-spawner", "setfarm-dashboard", "mission-control"])
    || [head.predecessorEpochRef, head.predecessorEpochHash, head.retirementRef, head.retirementHash, head.startupHooksReadyRef, head.startupHooksReadyHash, head.successorActivationRef, head.successorActivationHash].some((member) => member !== null)
    || head.epochHash !== epochHash
    || head.epochRef !== `setfarm://internal-production/physical-service-restart-authority-epoch/sha256/${epochHash}`
  ) fail("restart epoch is not unambiguous A-active");
  return Object.freeze(head);
}

function assertEpochTwoVisibleCandidateV1(): Readonly<Record<string, unknown>> {
  const bytes = readStableRetirementBytes(rootPaths().epoch, "restart epoch");
  let value: unknown;
  try { value = JSON.parse(bytes.toString("utf8")); } catch { return fail("restart epoch is not JSON"); }
  const head = exactCanonicalRecord(value, [
    "schema", "epochOrdinal", "authorityOwner", "services", "predecessorEpochRef", "predecessorEpochHash",
    "retirementRef", "retirementHash", "startupHooksReadyRef", "startupHooksReadyHash",
    "successorActivationRef", "successorActivationHash", "epochRef", "epochHash",
  ], "restart epoch");
  const projection = { ...head };
  delete projection.epochRef;
  delete projection.epochHash;
  const epochHash = sha256(canonical(projection));
  for (const [refKey, hashKey, prefix] of [
    ["predecessorEpochRef", "predecessorEpochHash", "setfarm://internal-production/physical-service-restart-authority-epoch/sha256/"],
    ["retirementRef", "retirementHash", "setfarm://internal-production/physical-service-restart-authority-retirement/sha256/"],
    ["startupHooksReadyRef", "startupHooksReadyHash", "setfarm://internal-production/physical-service-restart-startup-hooks-ready/sha256/"],
    ["successorActivationRef", "successorActivationHash", "setfarm://internal-production/physical-service-restart-authority-activation/sha256/"],
  ] as const) {
    if (typeof head[hashKey] !== "string" || !SHA256.test(head[hashKey] as string) || head[refKey] !== `${prefix}${head[hashKey]}`) fail("restart epoch two authority pair is invalid");
  }
  if (`${canonical(head)}\n` !== bytes.toString("utf8") || head.schema !== "setfarm.internal-production-physical-service-restart-authority-epoch.v1" || head.epochOrdinal !== 2 || head.authorityOwner !== "recovery-d" || canonical(head.services) !== canonical(["setfarm-spawner", "setfarm-dashboard", "mission-control"]) || head.epochHash !== epochHash || head.epochRef !== `setfarm://internal-production/physical-service-restart-authority-epoch/sha256/${epochHash}`) fail("restart epoch is not unambiguous D-active");
  const startup = readCutoverPairV1("03-startup-hooks-ready", "startupHooksReadyRef", "startupHooksReadyHash", "setfarm://internal-production/physical-service-restart-startup-hooks-ready/sha256/");
  const retirement = readCutoverPairV1("04-retirement", "retirementRef", "retirementHash", "setfarm://internal-production/physical-service-restart-authority-retirement/sha256/");
  const activation = readCutoverPairV1("05-activation", "activationRef", "activationHash", "setfarm://internal-production/physical-service-restart-authority-activation/sha256/");
  const successor = readCutoverPairV1("06-successor-epoch", "successorEpochRef", "successorEpochHash", "setfarm://internal-production/physical-service-restart-authority-epoch/sha256/");
  if (!startup || !retirement || !activation || !successor || startup.startupHooksReadyRef !== head.startupHooksReadyRef || startup.startupHooksReadyHash !== head.startupHooksReadyHash || retirement.retirementRef !== head.retirementRef || retirement.retirementHash !== head.retirementHash || activation.activationRef !== head.successorActivationRef || activation.activationHash !== head.successorActivationHash || successor.successorEpochRef !== head.epochRef || successor.successorEpochHash !== head.epochHash) fail("restart epoch two fixed prefix is crossed");
  assertCutoverTerminalChainV1(head, false);
  return Object.freeze(head);
}

function assertEpochTwoActive(): Readonly<Record<string, unknown>> {
  const head = assertEpochTwoVisibleCandidateV1();
  assertCutoverTerminalChainV1(head, true);
  return head;
}

function heldLease(lease: InternalProductionPhysicalServiceRestartAuthorityTransitionLeaseV1): LeaseStateV1 {
  const state = leases.get(lease);
  if (!state || state.phase !== "held" || Reflect.ownKeys(lease).length !== 1 || lease.schema !== "setfarm.internal-production-physical-service-restart-authority-transition-lease.v1") fail("lease is foreign, cloned, or released");
  return state;
}

async function acquireTransitionLeaseWithEpochAssertionV1(assertEpoch: () => Readonly<Record<string, unknown>>): Promise<InternalProductionPhysicalServiceRestartAuthorityTransitionLeaseV1> {
  assertEpoch();
  const paths = rootPaths();
  const rootGuard = ensurePrivateAuthorityDirectoryV1(paths.root);
  let rootGuardClosed = false;
  let opened: Readonly<{ descriptor: number; lockBytes: Buffer }> | null = null;
  try {
    rootGuard.assertStable();
    if (abandonedAcquireV1) {
      const abandoned = abandonedAcquireV1;
      cleanupExactOwnedLock(paths.lock, abandoned.descriptor, abandoned.lockBytes);
      closeSync(abandoned.descriptor);
      abandonedAcquireV1 = null;
      rootGuard.assertStable();
    }
    try {
      opened = openNewLock(paths.lock);
    } catch (error) {
      if (!(error instanceof Error) || !("code" in error) || error.code !== "EEXIST") throw error;
      reclaimDeadLockOnce(paths.lock);
      opened = openNewLock(paths.lock);
    }
    assertEpoch();
    const lease = Object.freeze({ schema: "setfarm.internal-production-physical-service-restart-authority-transition-lease.v1" as const });
    rootGuard.assertStable();
    rootGuard.close();
    rootGuardClosed = true;
    leases.set(lease, { descriptor: opened.descriptor, lockBytes: opened.lockBytes, phase: "held", authorityOwner: "baseline-a" });
    opened = null;
    return lease;
  } catch (error) {
    if (opened) {
      try {
        rootGuard.assertStable();
        cleanupExactOwnedLock(paths.lock, opened.descriptor, opened.lockBytes);
        closeSync(opened.descriptor);
      } catch {
        if (abandonedAcquireV1) fail("multiple abandoned transition-lock acquisitions are not permitted");
        abandonedAcquireV1 = opened;
      }
      opened = null;
    }
    throw error;
  } finally {
    if (!rootGuardClosed) rootGuard.close();
  }
}

export async function acquireInternalProductionPhysicalServiceRestartAuthorityTransitionLeaseV1(): Promise<InternalProductionPhysicalServiceRestartAuthorityTransitionLeaseV1> {
  return acquireTransitionLeaseWithEpochAssertionV1(assertEpochOneActive);
}

export async function releaseInternalProductionPhysicalServiceRestartAuthorityTransitionLeaseV1(
  lease: InternalProductionPhysicalServiceRestartAuthorityTransitionLeaseV1,
): Promise<void> {
  const state = heldLease(lease);
  const paths = rootPaths();
  const rootGuard = authenticatePrivateDirectoryChainV1(path.resolve(repositoryRoot()), paths.root);
  state.phase = "released";
  try {
    rootGuard.assertStable();
    assertHelperJournalAllowsLockCleanup(parseLockRecord(state.lockBytes), descriptorIdentity(state.descriptor));
    cleanupExactOwnedLock(paths.lock, state.descriptor, state.lockBytes);
    rootGuard.assertStable();
  } finally {
    try { rootGuard.assertStable(); }
    finally {
      rootGuard.close();
      closeSync(state.descriptor);
      leases.delete(lease);
    }
  }
}

function readSettlement(hash: string): Readonly<Record<string, unknown>> {
  const file = path.join(rootPaths().settlements, hash.slice(0, 2), `${hash}.json`);
  const bytes = readStableRetirementBytes(file, "helper settlement");
  const value = JSON.parse(bytes.toString("utf8")) as unknown;
  if (`${canonical(value)}\n` !== bytes.toString("utf8")) fail("helper settlement is not canonical");
  return exactCanonicalRecord(value, ["schema", "action", "currentEntryOperation", "restartAuthority", "journalHash", "transitionLock", "lockIdentity", "dispatchCount", "disposition", "helperSettlementRef", "helperSettlementHash"], "helper settlement");
}

function startupPrefixAlreadyPassedHelperV1(operationHash: string): boolean {
  const directory = path.join(repositoryRoot(), "data/internal-production-baseline/pre-schema-spawner-rebind-v1/operations/sha256", operationHash);
  for (const basename of [
    "04-predecessor-termination.pair.json", "05-replacement-process.pair.json",
    "06-post-termination-legacy-zero.pair.json", "07-sealed-admission.pair.json",
  ]) {
    const target = path.join(directory, basename);
    try {
      const observed = lstatSync(target, { bigint: true });
      if (!observed.isFile() || observed.isSymbolicLink() || observed.nlink !== 1n || (observed.mode & 0o7777n) !== 0o600n) fail("post-helper startup prefix identity is invalid");
      return true;
    } catch (error) {
      if (!(error instanceof Error) || !("code" in error) || error.code !== "ENOENT") throw error;
    }
  }
  return false;
}

export async function invokeInternalProductionPreSchemaSpawnerRebindHelperUnderTransitionLeaseV1(
  lease: InternalProductionPhysicalServiceRestartAuthorityTransitionLeaseV1,
  input: Readonly<{
    currentEntryOperation: Readonly<{ operationRef: string; operationHash: string }>;
    restartAuthority: Readonly<{ restartAuthorityRef: string; restartAuthorityHash: string }>;
  }>,
): Promise<InternalProductionPreSchemaSpawnerRebindHelperSettlementPairV1> {
  heldLease(lease);
  assertEpochOneActive();
  const exactInput = exactOwnRecord(input, ["currentEntryOperation", "restartAuthority"], "helper invoke input");
  const currentEntryOperation = pair(exactInput.currentEntryOperation, "operationRef", "operationHash");
  const restartAuthority = pair(exactInput.restartAuthority, "restartAuthorityRef", "restartAuthorityHash");
  const receipt = await import("./baseline-post-handoff-receipt-v1.js");
  const startup = await import("./baseline-spawner-startup-admission-v1.js");
  const resolvedOperation = await receipt.resolveInternalProductionCurrentEntryOperationV1(currentEntryOperation as { operationRef: string; operationHash: string }) as Readonly<Record<string, unknown>>;
  const resolvedRestart = await startup.resolveInternalProductionPreSchemaSpawnerRestartAuthorityV1(restartAuthority as { restartAuthorityRef: string; restartAuthorityHash: string }) as Readonly<Record<string, unknown>>;
  const uid = process.getuid?.();
  if (
    resolvedOperation.operationRef !== currentEntryOperation.operationRef
    || resolvedOperation.operationHash !== currentEntryOperation.operationHash
    || resolvedOperation.schema !== "setfarm.internal-production-current-entry-operation.v1"
    || resolvedOperation.purpose !== "task6a-internal-production-current-entry-v1"
    || resolvedRestart.restartAuthorityRef !== restartAuthority.restartAuthorityRef
    || resolvedRestart.restartAuthorityHash !== restartAuthority.restartAuthorityHash
    || resolvedRestart.currentEntryOperationRef !== currentEntryOperation.operationRef
    || resolvedRestart.currentEntryOperationHash !== currentEntryOperation.operationHash
    || resolvedRestart.schema !== "setfarm.internal-production-pre-schema-spawner-restart-authority.v1"
    || resolvedRestart.actionId !== "task6a-pre-schema-setfarm-spawner-rebind-v1"
    || resolvedRestart.service !== "setfarm-spawner"
    || resolvedRestart.uid !== uid
    || resolvedRestart.launchdLabel !== "com.setrox.setfarm-spawner"
    || resolvedRestart.executable !== "/bin/launchctl"
    || canonical(resolvedRestart.argv) !== canonical(["kickstart", "-k", `gui/${uid}/com.setrox.setfarm-spawner`])
  ) fail("helper invoke operation/restart relation or fixed action is crossed");
  const held = heldLease(lease);
  const currentLockIdentity = descriptorIdentity(held.descriptor);
  const currentTransitionLock = parseLockRecord(held.lockBytes);
  const paths = rootPaths();
  const settlementsGuard = ensurePrivateAuthorityDirectoryV1(paths.settlements);
  try {
  settlementsGuard.assertStable();
  let journal: Readonly<Record<string, unknown>>;
  let dispatchRequired: boolean;
  repairCompletedNoReplacePublication(paths.journal);
  try {
    const bytes = readStableRetirementBytes(paths.journal, "helper journal");
    const value = JSON.parse(bytes.toString("utf8")) as unknown;
    const existing = exactCanonicalRecord(value, ["schema", "family", "operationSchema", "operationPurpose", "action", "currentEntryOperation", "restartAuthority", "transitionLock", "lockIdentity", "maximumDispatchCount", "journalHash"], "helper journal");
    const projection = { ...existing };
    delete projection.journalHash;
    if (`${canonical(existing)}\n` !== bytes.toString("utf8") || existing.schema !== "setfarm.internal-production-service-restart-helper-journal.v1" || existing.family !== "pre-schema-spawner-rebind" || existing.operationSchema !== "setfarm.internal-production-current-entry-operation.v1" || existing.operationPurpose !== "task6a-internal-production-current-entry-v1" || existing.action !== "task6a-pre-schema-setfarm-spawner-rebind-v1" || canonical(existing.currentEntryOperation) !== canonical(currentEntryOperation) || canonical(existing.restartAuthority) !== canonical(restartAuthority) || canonical(existing.transitionLock) !== canonical(parseLockRecord(Buffer.from(`${canonical(existing.transitionLock)}\n`, "utf8"))) || canonical(existing.lockIdentity) !== canonical(exactCanonicalRecord(existing.lockIdentity, ["devDecimal", "inoDecimal"], "journal lock identity")) || existing.maximumDispatchCount !== 1 || typeof existing.journalHash !== "string" || !SHA256.test(existing.journalHash) || sha256(canonical(projection)) !== existing.journalHash) fail("helper journal is crossed or ambiguous");
    journal = Object.freeze(existing);
    dispatchRequired = false;
  } catch (error) {
    if (!(error instanceof Error) || !("code" in error) || error.code !== "ENOENT") throw error;
    if (startupPrefixAlreadyPassedHelperV1(currentEntryOperation.operationHash)) fail("HELPER_DISPATCH_SETTLEMENT_UNKNOWN");
    const journalBody = {
      schema: "setfarm.internal-production-service-restart-helper-journal.v1",
      family: "pre-schema-spawner-rebind",
      operationSchema: resolvedOperation.schema,
      operationPurpose: resolvedOperation.purpose,
      action: "task6a-pre-schema-setfarm-spawner-rebind-v1",
      currentEntryOperation,
      restartAuthority,
      transitionLock: currentTransitionLock,
      lockIdentity: currentLockIdentity,
      maximumDispatchCount: 1,
    };
    const journalHash = sha256(canonical(journalBody));
    journal = Object.freeze({ ...journalBody, journalHash });
    const freshCensus = await receipt.observeInternalProductionServiceCensusV1();
    const freshSpawner = exactOwnRecord(freshCensus.spawner, [
      "pid", "processStartTimeEpochMs", "processIdentityHash", "serviceIdentityHash", "generationHash",
      "loadedSourceSha", "loadedTreeHash", "loadedBuildHash", "processOwnerCount", "listener",
    ], "fresh predecessor spawner census");
    const freshProcessBody = {
      schema: "setfarm.internal-production-spawner-process-identity.v1",
      pid: freshSpawner.pid,
      processStartTimeEpochMs: freshSpawner.processStartTimeEpochMs,
      processIdentityHash: freshSpawner.processIdentityHash,
    };
    const freshProcessHash = sha256(canonical(freshProcessBody));
    if (
      freshSpawner.processOwnerCount !== 1
      || freshSpawner.listener !== null
      || !Number.isSafeInteger(freshSpawner.pid)
      || (freshSpawner.pid as number) < 1
      || !Number.isSafeInteger(freshSpawner.processStartTimeEpochMs)
      || (freshSpawner.processStartTimeEpochMs as number) < 1
      || typeof freshSpawner.processIdentityHash !== "string"
      || !SHA256.test(freshSpawner.processIdentityHash)
      || resolvedRestart.predecessorSpawnerProcessIdentityRef !== `setfarm://internal-production/spawner-process-identity/sha256/${freshProcessHash}`
      || resolvedRestart.predecessorSpawnerProcessIdentityHash !== freshProcessHash
      || resolvedRestart.predecessorSpawnerServiceIdentityHash !== freshSpawner.serviceIdentityHash
      || resolvedRestart.predecessorSpawnerGenerationHash !== freshSpawner.generationHash
      || resolvedRestart.targetSpawnerSourceSha !== freshSpawner.loadedSourceSha
      || resolvedRestart.targetSpawnerTreeHash !== freshSpawner.loadedTreeHash
      || resolvedRestart.targetSpawnerBuildHash !== freshSpawner.loadedBuildHash
    ) fail("fresh predecessor census identity is crossed before helper journal claim");
    dispatchRequired = writeNoReplace(paths.journal, journal);
  }
  const journalHash = journal.journalHash as string;
  const transitionLock = journal.transitionLock as Readonly<Record<string, unknown>>;
  const lockIdentity = journal.lockIdentity as Readonly<Record<string, unknown>>;
  const expectedBody = {
    schema: "setfarm.internal-production-pre-schema-spawner-rebind-helper-settlement.v1",
    action: "task6a-pre-schema-setfarm-spawner-rebind-v1",
    currentEntryOperation,
    restartAuthority,
    journalHash,
    transitionLock,
    lockIdentity,
    dispatchCount: 1,
    disposition: "completed",
  };
  const helperSettlementHash = sha256(canonical(expectedBody));
  const helperSettlementRef = `${HELPER_PREFIX}${helperSettlementHash}`;
  const settlementPath = path.join(paths.settlements, helperSettlementHash.slice(0, 2), `${helperSettlementHash}.json`);
  if (dispatchRequired) {
    const settlementDirectoryGuard = ensurePrivateAuthorityDirectoryV1(path.dirname(settlementPath));
    try {
      settlementDirectoryGuard.assertStable();
    const capabilityPath = path.join(paths.root, `.helper-capability.${randomUUID()}.json`);
    const journalDescriptor = openSync(paths.journal, constants.O_RDONLY | constants.O_NOFOLLOW);
    const frame = { schema: "setfarm.internal-production-pre-schema-spawner-rebind-restart-authority.v1", action: "task6a-pre-schema-setfarm-spawner-rebind-v1", currentEntryOperation, restartAuthority, journalHash, lockIdentity: currentLockIdentity, journalIdentity: descriptorIdentity(journalDescriptor) };
    const writable = openSync(capabilityPath, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
    try { writeFileSync(writable, canonical(frame)); fsyncSync(writable); } finally { closeSync(writable); }
    const descriptor = openSync(capabilityPath, constants.O_RDONLY | constants.O_NOFOLLOW);
    unlinkSync(capabilityPath);
    const helper = fileURLToPath(new URL("./baseline-service-restart-helper-v1.js", import.meta.url));
    const child = spawnSync(process.execPath, [helper], {
      env: Object.freeze({ PATH: "/usr/bin:/bin", LANG: "C", LC_ALL: "C" }),
      shell: false,
      stdio: ["ignore", "ignore", "ignore", descriptor, heldLease(lease).descriptor, journalDescriptor],
      timeout: 45_000,
    });
    closeSync(descriptor);
    closeSync(journalDescriptor);
    if (child.error || child.signal || child.status !== 0) fail("HELPER_DISPATCH_SETTLEMENT_UNKNOWN");
      settlementDirectoryGuard.assertStable();
    } finally {
      try { settlementDirectoryGuard.assertStable(); } finally { settlementDirectoryGuard.close(); }
    }
  }
  recoverExpectedNoReplacePublication(settlementPath, Buffer.from(`${canonical({ ...expectedBody, helperSettlementRef, helperSettlementHash })}\n`, "utf8"));
  let settled: Readonly<Record<string, unknown>>;
  try { settled = readSettlement(helperSettlementHash); } catch { return fail("HELPER_DISPATCH_SETTLEMENT_UNKNOWN"); }
  if (canonical(settled) !== canonical({ ...expectedBody, helperSettlementRef, helperSettlementHash })) fail("helper settlement differs");
  settlementsGuard.assertStable();
  return Object.freeze({ helperSettlementRef, helperSettlementHash });
  } finally {
    try { settlementsGuard.assertStable(); } finally { settlementsGuard.close(); }
  }
}

const BASELINE_SERVICE_ACTIONS_V1 = Object.freeze({
  "setfarm-spawner": "a-restart-service-setfarm-spawner-v1",
  "setfarm-dashboard": "a-restart-service-setfarm-dashboard-v1",
  "mission-control": "a-restart-service-mission-control-v1",
} as const);

const NORMAL_OPERATION_PREFIX = "setfarm://internal-production/baseline-service-restart-operation/sha256/";
const NORMAL_AUTHORIZATION_PREFIX = "setfarm://internal-production/baseline-service-restart-authorization/sha256/";
const NORMAL_OUTBOX_PREFIX = "setfarm://internal-production/baseline-service-restart-launch-outbox/sha256/";
const REGISTRATION_PREFIX = "setfarm://internal-production/baseline-service-restart-helper-registry-registration/sha256/";
const REGISTRY_TERMINAL_PREFIX = "setfarm://internal-production/baseline-service-restart-helper-registry-terminal/sha256/";
const REGISTRY_HEAD_PREFIX = "setfarm://internal-production/baseline-service-restart-helper-registry-head/sha256/";

function orderedFrozenV1<T extends Record<string, unknown>>(value: T): Readonly<T> {
  for (const member of Object.values(value)) if (member && typeof member === "object" && !Object.isFrozen(member)) Object.freeze(member);
  return Object.freeze(value);
}

function validateNormalOperationV1(value: unknown, expected: Readonly<Record<string, string>>): Readonly<Record<string, unknown>> {
  const operation = exactFrozenObserverRecordV1(value, ["schema", "service", "actionId", "authorizationRef", "authorizationHash", "operationRef", "operationHash"], "baseline restart operation");
  const service = operation.service as keyof typeof BASELINE_SERVICE_ACTIONS_V1;
  const core = { schema: operation.schema, service: operation.service, actionId: operation.actionId, authorizationRef: operation.authorizationRef, authorizationHash: operation.authorizationHash };
  if (operation.schema !== "setfarm.internal-production-baseline-service-restart-operation.v1" || !(service in BASELINE_SERVICE_ACTIONS_V1) || operation.actionId !== BASELINE_SERVICE_ACTIONS_V1[service] || typeof operation.authorizationHash !== "string" || !SHA256.test(operation.authorizationHash) || operation.authorizationRef !== `${NORMAL_AUTHORIZATION_PREFIX}${operation.authorizationHash}` || operation.operationHash !== sha256(canonical(core)) || operation.operationRef !== `${NORMAL_OPERATION_PREFIX}${operation.operationHash}` || operation.operationRef !== expected.operationRef || operation.operationHash !== expected.operationHash) fail("baseline restart operation is crossed");
  return operation;
}

function validateNormalOutboxV1(value: unknown, operation: Readonly<Record<string, unknown>>): Readonly<Record<string, unknown>> {
  const outbox = exactFrozenObserverRecordV1(value, ["schema", "service", "actionId", "authorizationRef", "authorizationHash", "operationRef", "operationHash", "maximumDispatchCount", "outboxRef", "outboxHash"], "baseline restart launch outbox");
  const core = { schema: outbox.schema, service: outbox.service, actionId: outbox.actionId, authorizationRef: outbox.authorizationRef, authorizationHash: outbox.authorizationHash, operationRef: outbox.operationRef, operationHash: outbox.operationHash, maximumDispatchCount: outbox.maximumDispatchCount };
  if (outbox.schema !== "setfarm.internal-production-baseline-service-restart-launch-outbox.v1" || outbox.service !== operation.service || outbox.actionId !== operation.actionId || outbox.authorizationRef !== operation.authorizationRef || outbox.authorizationHash !== operation.authorizationHash || outbox.operationRef !== operation.operationRef || outbox.operationHash !== operation.operationHash || outbox.maximumDispatchCount !== 1 || outbox.outboxHash !== sha256(canonical(core)) || outbox.outboxRef !== `${NORMAL_OUTBOX_PREFIX}${outbox.outboxHash}`) fail("baseline restart launch outbox is crossed");
  return outbox;
}

async function resolveNormalRestartTask12AuthoritiesV1(operationPair: Readonly<Record<string, string>>): Promise<Readonly<{ operation: Readonly<Record<string, unknown>>; outbox: Readonly<Record<string, unknown>> }>> {
  const receipt = await import("./baseline-post-handoff-receipt-v1.js") as Readonly<Record<string, unknown>>;
  const resolveOperation = receipt.resolveInternalProductionBaselineServiceRestartOperationV1;
  const observeOutbox = receipt.observePreparedInternalProductionBaselineServiceRestartLaunchOutboxV1;
  if (typeof resolveOperation !== "function" || typeof observeOutbox !== "function") fail("baseline restart operation/outbox authority is unavailable");
  const operation = validateNormalOperationV1(await (resolveOperation as (input: unknown) => Promise<unknown>)(operationPair), operationPair);
  const outbox = validateNormalOutboxV1(await (observeOutbox as (input: unknown) => Promise<unknown>)(operationPair), operation);
  return Object.freeze({ operation, outbox });
}

function registryPathsV1() {
  const root = rootPaths().baselineRegistry;
  return Object.freeze({ root, registrations: path.join(root, "registrations", "sha256"), terminals: path.join(root, "terminals", "sha256"), heads: path.join(root, "heads", "sha256"), current: path.join(root, "current-head.pair.json") });
}

function registryContentPathV1(kind: "registrations" | "terminals" | "heads", hash: string): string {
  return path.join(registryPathsV1()[kind], hash.slice(0, 2), `${hash}.json`);
}

function readRegistryContentV1(kind: "registrations" | "terminals" | "heads", hash: string, label: string): Record<string, unknown> {
  const bytes = readStableRetirementBytes(registryContentPathV1(kind, hash), label);
  let value: unknown;
  try { value = JSON.parse(bytes.toString("utf8")); } catch { return fail(`${label} is not JSON`); }
  if (`${canonical(value)}\n` !== bytes.toString("utf8")) fail(`${label} is not canonical`);
  return value as Record<string, unknown>;
}

function registrationPairV1(value: unknown): Readonly<Record<string, string>> {
  const exact = pair(value, "registrationRef", "registrationHash");
  if (exact.registrationRef !== `${REGISTRATION_PREFIX}${exact.registrationHash}`) fail("registry registration pair is crossed");
  return exact;
}

function terminalPairV1(value: unknown): Readonly<Record<string, string>> {
  const exact = pair(value, "terminalRef", "terminalHash");
  if (exact.terminalRef !== `${REGISTRY_TERMINAL_PREFIX}${exact.terminalHash}`) fail("registry terminal pair is crossed");
  return exact;
}

function headPairV1(value: unknown): Readonly<Record<string, string>> {
  const exact = pair(value, "headRef", "headHash");
  if (exact.headRef !== `${REGISTRY_HEAD_PREFIX}${exact.headHash}`) fail("registry head pair is crossed");
  return exact;
}

function resolveRegistrationDirectV1(input: Readonly<Record<string, string>>): InternalProductionBaselineServiceRestartHelperRegistryRegistrationV1 {
  const value = readRegistryContentV1("registrations", input.registrationHash!, "baseline helper registry registration");
  const record = exactCanonicalRecord(value, ["schema", "registryOrdinal", "predecessorHeadRef", "predecessorHeadHash", "service", "actionId", "authorizationRef", "authorizationHash", "operationRef", "operationHash", "outboxRef", "outboxHash", "registrationRef", "registrationHash"], "baseline helper registry registration");
  const core = { schema: record.schema, registryOrdinal: record.registryOrdinal, predecessorHeadRef: record.predecessorHeadRef, predecessorHeadHash: record.predecessorHeadHash, service: record.service, actionId: record.actionId, authorizationRef: record.authorizationRef, authorizationHash: record.authorizationHash, operationRef: record.operationRef, operationHash: record.operationHash, outboxRef: record.outboxRef, outboxHash: record.outboxHash };
  const service = record.service as keyof typeof BASELINE_SERVICE_ACTIONS_V1;
  if (record.schema !== "setfarm.internal-production-baseline-service-restart-helper-registry-registration.v1" || !Number.isSafeInteger(record.registryOrdinal) || (record.registryOrdinal as number) < 1 || !(service in BASELINE_SERVICE_ACTIONS_V1) || record.actionId !== BASELINE_SERVICE_ACTIONS_V1[service] || typeof record.authorizationHash !== "string" || !SHA256.test(record.authorizationHash) || record.authorizationRef !== `${NORMAL_AUTHORIZATION_PREFIX}${record.authorizationHash}` || typeof record.operationHash !== "string" || !SHA256.test(record.operationHash) || record.operationRef !== `${NORMAL_OPERATION_PREFIX}${record.operationHash}` || typeof record.outboxHash !== "string" || !SHA256.test(record.outboxHash) || record.outboxRef !== `${NORMAL_OUTBOX_PREFIX}${record.outboxHash}` || record.registrationHash !== sha256(canonical(core)) || record.registrationRef !== `${REGISTRATION_PREFIX}${record.registrationHash}` || record.registrationRef !== input.registrationRef || record.registrationHash !== input.registrationHash || ((record.registryOrdinal === 1) !== (record.predecessorHeadRef === null && record.predecessorHeadHash === null)) || (record.predecessorHeadRef !== null && (typeof record.predecessorHeadHash !== "string" || record.predecessorHeadRef !== `${REGISTRY_HEAD_PREFIX}${record.predecessorHeadHash}`))) fail("baseline helper registry registration is crossed");
  return orderedFrozenV1({ schema: record.schema, registryOrdinal: record.registryOrdinal, predecessorHeadRef: record.predecessorHeadRef, predecessorHeadHash: record.predecessorHeadHash, service: record.service, actionId: record.actionId, authorizationRef: record.authorizationRef, authorizationHash: record.authorizationHash, operationRef: record.operationRef, operationHash: record.operationHash, outboxRef: record.outboxRef, outboxHash: record.outboxHash, registrationRef: record.registrationRef, registrationHash: record.registrationHash } as unknown as InternalProductionBaselineServiceRestartHelperRegistryRegistrationV1);
}

function resolveHeadDirectV1(input: Readonly<Record<string, string>>): InternalProductionBaselineServiceRestartHelperRegistryHeadV1 {
  const value = readRegistryContentV1("heads", input.headHash!, "baseline helper registry head");
  const record = exactCanonicalRecord(value, ["schema", "registryOrdinal", "entryKind", "entryRef", "entryHash", "predecessorHeadRef", "predecessorHeadHash", "headRef", "headHash"], "baseline helper registry head");
  const core = { schema: record.schema, registryOrdinal: record.registryOrdinal, entryKind: record.entryKind, entryRef: record.entryRef, entryHash: record.entryHash, predecessorHeadRef: record.predecessorHeadRef, predecessorHeadHash: record.predecessorHeadHash };
  const entryPrefix = record.entryKind === "registration" ? REGISTRATION_PREFIX : record.entryKind === "terminal" ? REGISTRY_TERMINAL_PREFIX : "";
  if (record.schema !== "setfarm.internal-production-baseline-service-restart-helper-registry-head.v1" || !Number.isSafeInteger(record.registryOrdinal) || (record.registryOrdinal as number) < 1 || !entryPrefix || typeof record.entryHash !== "string" || !SHA256.test(record.entryHash) || record.entryRef !== `${entryPrefix}${record.entryHash}` || record.headHash !== sha256(canonical(core)) || record.headRef !== `${REGISTRY_HEAD_PREFIX}${record.headHash}` || record.headRef !== input.headRef || record.headHash !== input.headHash || ((record.registryOrdinal === 1) !== (record.predecessorHeadRef === null && record.predecessorHeadHash === null)) || (record.predecessorHeadRef !== null && (typeof record.predecessorHeadHash !== "string" || record.predecessorHeadRef !== `${REGISTRY_HEAD_PREFIX}${record.predecessorHeadHash}`))) fail("baseline helper registry head is crossed");
  return orderedFrozenV1({ schema: record.schema, registryOrdinal: record.registryOrdinal, entryKind: record.entryKind, entryRef: record.entryRef, entryHash: record.entryHash, predecessorHeadRef: record.predecessorHeadRef, predecessorHeadHash: record.predecessorHeadHash, headRef: record.headRef, headHash: record.headHash } as unknown as InternalProductionBaselineServiceRestartHelperRegistryHeadV1);
}

function resolveTerminalDirectV1(input: Readonly<Record<string, string>>): InternalProductionBaselineServiceRestartHelperRegistryTerminalV1 {
  const value = readRegistryContentV1("terminals", input.terminalHash!, "baseline helper registry terminal");
  const record = exactCanonicalRecord(value, ["schema", "registryOrdinal", "predecessorHeadRef", "predecessorHeadHash", "registrationRef", "registrationHash", "helperJournalHash", "outcome", "helperSettlementRef", "helperSettlementHash", "terminalRef", "terminalHash"], "baseline helper registry terminal");
  const core = { schema: record.schema, registryOrdinal: record.registryOrdinal, predecessorHeadRef: record.predecessorHeadRef, predecessorHeadHash: record.predecessorHeadHash, registrationRef: record.registrationRef, registrationHash: record.registrationHash, helperJournalHash: record.helperJournalHash, outcome: record.outcome, helperSettlementRef: record.helperSettlementRef, helperSettlementHash: record.helperSettlementHash };
  if (record.schema !== "setfarm.internal-production-baseline-service-restart-helper-registry-terminal.v1" || !Number.isSafeInteger(record.registryOrdinal) || (record.registryOrdinal as number) < 2 || typeof record.predecessorHeadHash !== "string" || record.predecessorHeadRef !== `${REGISTRY_HEAD_PREFIX}${record.predecessorHeadHash}` || typeof record.registrationHash !== "string" || record.registrationRef !== `${REGISTRATION_PREFIX}${record.registrationHash}` || typeof record.helperJournalHash !== "string" || !SHA256.test(record.helperJournalHash) || !new Set(["completed", "ambiguous"]).has(record.outcome as string) || (record.outcome === "completed" ? (typeof record.helperSettlementHash !== "string" || !SHA256.test(record.helperSettlementHash) || record.helperSettlementRef !== `${BASELINE_HELPER_PREFIX}${record.helperSettlementHash}`) : (record.helperSettlementRef !== null || record.helperSettlementHash !== null)) || record.terminalHash !== sha256(canonical(core)) || record.terminalRef !== `${REGISTRY_TERMINAL_PREFIX}${record.terminalHash}` || record.terminalRef !== input.terminalRef || record.terminalHash !== input.terminalHash) fail("baseline helper registry terminal is crossed");
  return orderedFrozenV1({ schema: record.schema, registryOrdinal: record.registryOrdinal, predecessorHeadRef: record.predecessorHeadRef, predecessorHeadHash: record.predecessorHeadHash, registrationRef: record.registrationRef, registrationHash: record.registrationHash, helperJournalHash: record.helperJournalHash, outcome: record.outcome, helperSettlementRef: record.helperSettlementRef, helperSettlementHash: record.helperSettlementHash, terminalRef: record.terminalRef, terminalHash: record.terminalHash } as unknown as InternalProductionBaselineServiceRestartHelperRegistryTerminalV1);
}

type RegistryWalkV1 = Readonly<{
  head: InternalProductionBaselineServiceRestartHelperRegistryHeadV1 | null;
  heads: readonly InternalProductionBaselineServiceRestartHelperRegistryHeadV1[];
  registrations: readonly InternalProductionBaselineServiceRestartHelperRegistryRegistrationV1[];
  terminals: readonly InternalProductionBaselineServiceRestartHelperRegistryTerminalV1[];
  orderedEntries: readonly Readonly<{ registryOrdinal: number; entryKind: "registration" | "terminal"; entryRef: string; entryHash: string }>[];
}>;

function readCurrentRegistryHeadPairV1(): Readonly<Record<string, string>> | null {
  let bytes: Buffer;
  try { bytes = readStableRetirementBytes(registryPathsV1().current, "baseline helper registry current head"); }
  catch (error) { if (error instanceof Error && "code" in error && error.code === "ENOENT") return null; throw error; }
  let value: unknown;
  try { value = JSON.parse(bytes.toString("utf8")); } catch { return fail("baseline helper registry current head is not JSON"); }
  const result = exactCanonicalRecord(value, ["headRef", "headHash"], "baseline helper registry current head");
  if (`${canonical(result)}\n` !== bytes.toString("utf8")) fail("baseline helper registry current head is not canonical");
  return headPairV1({ headRef: result.headRef, headHash: result.headHash });
}

function walkRegistryFromTipV1(tipPair: Readonly<Record<string, string>> | null): RegistryWalkV1 {
  if (!tipPair) return Object.freeze({ head: null, heads: Object.freeze([]), registrations: Object.freeze([]), terminals: Object.freeze([]), orderedEntries: Object.freeze([]) });
  const reverseHeads: InternalProductionBaselineServiceRestartHelperRegistryHeadV1[] = [];
  let currentPair: Readonly<Record<string, string>> | null = tipPair;
  let budget = MAX_INTERNAL_PRODUCTION_BASELINE_SERVICE_RESTART_HELPER_REGISTRY_HEAD_ENTRIES_V1;
  while (currentPair) {
    if (budget-- <= 0) fail("baseline helper registry exceeds its fixed head budget");
    const head = resolveHeadDirectV1(currentPair);
    if (reverseHeads.length === 0 && head.registryOrdinal > MAX_INTERNAL_PRODUCTION_BASELINE_SERVICE_RESTART_HELPER_REGISTRY_HEAD_ENTRIES_V1) fail("baseline helper registry tip exceeds its fixed head budget");
    reverseHeads.push(head);
    if (head.registryOrdinal !== reverseHeads[0]!.registryOrdinal - reverseHeads.length + 1) fail("baseline helper registry head ordinal chain is crossed");
    currentPair = head.predecessorHeadRef === null ? null : headPairV1({ headRef: head.predecessorHeadRef, headHash: head.predecessorHeadHash });
  }
  const heads = reverseHeads.reverse();
  if (heads[0]!.registryOrdinal !== 1 || heads.some((head, index) => head.registryOrdinal !== index + 1 || (index === 0 ? head.predecessorHeadRef !== null || head.predecessorHeadHash !== null : head.predecessorHeadRef !== heads[index - 1]!.headRef || head.predecessorHeadHash !== heads[index - 1]!.headHash))) fail("baseline helper registry predecessor chain is crossed");
  const registrations: InternalProductionBaselineServiceRestartHelperRegistryRegistrationV1[] = [];
  const terminals: InternalProductionBaselineServiceRestartHelperRegistryTerminalV1[] = [];
  const tupleKeys = new Map<string, InternalProductionBaselineServiceRestartHelperRegistryRegistrationV1>();
  const memberOwners = new Map<string, string>();
  const terminalByRegistration = new Map<string, InternalProductionBaselineServiceRestartHelperRegistryTerminalV1>();
  for (const [index, head] of heads.entries()) {
    if (head.entryKind === "registration") {
      const registration = resolveRegistrationDirectV1({ registrationRef: head.entryRef, registrationHash: head.entryHash });
      if (registration.registryOrdinal !== head.registryOrdinal || registration.predecessorHeadRef !== head.predecessorHeadRef || registration.predecessorHeadHash !== head.predecessorHeadHash) fail("baseline helper registry registration/head relation is crossed");
      const tuple = canonical({ authorizationRef: registration.authorizationRef, authorizationHash: registration.authorizationHash, operationRef: registration.operationRef, operationHash: registration.operationHash, outboxRef: registration.outboxRef, outboxHash: registration.outboxHash });
      if (tupleKeys.has(tuple)) fail("baseline helper registry duplicate tuple is visible");
      for (const member of [registration.authorizationRef, registration.authorizationHash, registration.operationRef, registration.operationHash, registration.outboxRef, registration.outboxHash]) {
        const owner = memberOwners.get(member);
        if (owner && owner !== tuple) fail("baseline helper registry crossed duplicate member is visible");
        memberOwners.set(member, tuple);
      }
      tupleKeys.set(tuple, registration);
      registrations.push(registration);
      if (registrations.length > MAX_INTERNAL_PRODUCTION_BASELINE_SERVICE_RESTART_HELPER_REGISTRATIONS_V1) fail("baseline helper registry registration cap is exceeded");
    } else {
      const terminal = resolveTerminalDirectV1({ terminalRef: head.entryRef, terminalHash: head.entryHash });
      if (terminal.registryOrdinal !== head.registryOrdinal || terminal.predecessorHeadRef !== head.predecessorHeadRef || terminal.predecessorHeadHash !== head.predecessorHeadHash) fail("baseline helper registry terminal/head relation is crossed");
      const registration = registrations.find((candidate) => candidate.registrationRef === terminal.registrationRef && candidate.registrationHash === terminal.registrationHash);
      if (!registration || terminalByRegistration.has(registration.registrationHash)) fail("baseline helper registry terminal relation is crossed");
      const journal = resolveRegisteredBaselineJournalV1(registration);
      if (journal.journalHash !== terminal.helperJournalHash) fail("registered baseline helper journal terminal relation is crossed");
      if (terminal.outcome === "completed") {
        const operation = Object.freeze({ actionId: registration.actionId });
        const expected = baselineSettlementV1(operation, Object.freeze({ operationRef: registration.operationRef, operationHash: registration.operationHash }), journal);
        const settlement = readBaselineSettlementV1(expected);
        if (settlement.helperSettlementRef !== terminal.helperSettlementRef || settlement.helperSettlementHash !== terminal.helperSettlementHash) fail("registered baseline helper completed settlement is crossed");
      }
      terminalByRegistration.set(registration.registrationHash, terminal);
      terminals.push(terminal);
    }
    if (head.registryOrdinal !== index + 1) fail("baseline helper registry ordinal is crossed");
  }
  return Object.freeze({ head: heads.at(-1)!, heads: Object.freeze(heads), registrations: Object.freeze(registrations), terminals: Object.freeze(terminals), orderedEntries: Object.freeze(heads.map((head) => Object.freeze({ registryOrdinal: head.registryOrdinal, entryKind: head.entryKind, entryRef: head.entryRef, entryHash: head.entryHash }))) });
}

function walkRegistryV1(): RegistryWalkV1 {
  return walkRegistryFromTipV1(readCurrentRegistryHeadPairV1());
}

export async function resolveInternalProductionBaselineServiceRestartHelperRegistryRegistrationV1(input: InternalProductionBaselineServiceRestartHelperRegistryRegistrationPairV1): Promise<InternalProductionBaselineServiceRestartHelperRegistryRegistrationV1> {
  const expected = registrationPairV1(input);
  const registration = resolveRegistrationDirectV1(expected);
  const predecessor = registration.predecessorHeadRef === null ? walkRegistryFromTipV1(null) : walkRegistryFromTipV1({ headRef: registration.predecessorHeadRef, headHash: registration.predecessorHeadHash! });
  validateRegistrationCandidateAgainstPredecessorV1(registration, predecessor);
  return registration;
}

export async function resolveInternalProductionBaselineServiceRestartHelperRegistryTerminalV1(input: InternalProductionBaselineServiceRestartHelperRegistryTerminalPairV1): Promise<InternalProductionBaselineServiceRestartHelperRegistryTerminalV1> {
  const expected = terminalPairV1(input);
  const terminal = resolveTerminalDirectV1(expected);
  const predecessor = walkRegistryFromTipV1({ headRef: terminal.predecessorHeadRef, headHash: terminal.predecessorHeadHash });
  const registration = validateTerminalCandidateAgainstPredecessorV1(terminal, predecessor);
  const journal = resolveRegisteredBaselineJournalV1(registration);
  if (journal.journalHash !== terminal.helperJournalHash) fail("baseline helper registry terminal journal is crossed");
  if (terminal.outcome === "completed") {
    const expectedSettlement = baselineSettlementV1(Object.freeze({ actionId: registration.actionId }), Object.freeze({ operationRef: registration.operationRef, operationHash: registration.operationHash }), journal);
    const settlement = readBaselineSettlementV1(expectedSettlement);
    if (settlement.helperSettlementRef !== terminal.helperSettlementRef || settlement.helperSettlementHash !== terminal.helperSettlementHash) fail("baseline helper registry terminal settlement is crossed");
  }
  return terminal;
}

export async function resolveInternalProductionBaselineServiceRestartHelperRegistryHeadV1(input: InternalProductionBaselineServiceRestartHelperRegistryHeadPairV1): Promise<InternalProductionBaselineServiceRestartHelperRegistryHeadV1> {
  const expected = headPairV1(input);
  return walkRegistryFromTipV1(expected).head ?? fail("baseline helper registry head is absent");
}

function replaceRegistryHeadV1(expected: InternalProductionBaselineServiceRestartHelperRegistryHeadV1 | null, nextPair: Readonly<Record<string, string>>): void {
  const target = registryPathsV1().current;
  if (!expected) {
    if (!writeNoReplace(target, nextPair)) {
      const current = readCurrentRegistryHeadPairV1();
      if (!current || canonical(current) !== canonical(nextPair)) fail("baseline helper registry first-head CAS lost");
    }
    return;
  }
  const alreadyVisible = readCurrentRegistryHeadPairV1();
  if (alreadyVisible && canonical(alreadyVisible) === canonical(nextPair)) return;
  const directoryGuard = ensurePrivateAuthorityDirectoryV1(path.dirname(target));
  let pinned: ReturnType<typeof pinStableCasPredecessorV1> | null = null;
  const temporary = path.join(path.dirname(target), `.${path.basename(target)}.${randomBytes(16).toString("hex")}.tmp`);
  const bytes = Buffer.from(`${canonical(nextPair)}\n`, "utf8");
  try {
    pinned = pinStableCasPredecessorV1(target, "baseline helper registry predecessor locator");
    if (pinned.bytes.toString("utf8") !== `${canonical({ headRef: expected.headRef, headHash: expected.headHash })}\n`) fail("baseline helper registry predecessor locator changed");
    const descriptor = openSync(temporary, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
    try { writeFileSync(descriptor, bytes); fsyncSync(descriptor); } finally { closeSync(descriptor); }
    directoryGuard.assertStable();
    pinned.assertStable();
    directoryGuard.assertStable();
    pinned.assertStable();
    renameSync(temporary, target);
    fsyncParent(target);
    if (!readStableRetirementBytes(target, "baseline helper registry successor locator").equals(bytes)) fail("baseline helper registry successor locator differs");
  } finally {
    pinned?.close();
    try { unlinkSync(temporary); } catch (error) { if (!(error instanceof Error) || !("code" in error) || error.code !== "ENOENT") throw error; }
    try { directoryGuard.assertStable(); } finally { directoryGuard.close(); }
  }
}

function publishRegistryHeadV1(entryKind: "registration" | "terminal", entryPair: Readonly<Record<string, string>>, predecessor: InternalProductionBaselineServiceRestartHelperRegistryHeadV1 | null): InternalProductionBaselineServiceRestartHelperRegistryHeadV1 {
  const core = { schema: "setfarm.internal-production-baseline-service-restart-helper-registry-head.v1", registryOrdinal: (predecessor?.registryOrdinal ?? 0) + 1, entryKind, entryRef: entryKind === "registration" ? entryPair.registrationRef : entryPair.terminalRef, entryHash: entryKind === "registration" ? entryPair.registrationHash : entryPair.terminalHash, predecessorHeadRef: predecessor?.headRef ?? null, predecessorHeadHash: predecessor?.headHash ?? null };
  if (core.registryOrdinal > MAX_INTERNAL_PRODUCTION_BASELINE_SERVICE_RESTART_HELPER_REGISTRY_HEAD_ENTRIES_V1) fail("baseline helper registry head cap is exceeded");
  const headHash = sha256(canonical(core));
  const value = { ...core, headRef: `${REGISTRY_HEAD_PREFIX}${headHash}`, headHash };
  writeNoReplace(registryContentPathV1("heads", headHash), value);
  const resolved = resolveHeadDirectV1({ headRef: value.headRef, headHash });
  replaceRegistryHeadV1(predecessor, { headRef: resolved.headRef, headHash: resolved.headHash });
  return resolved;
}

function registrationTupleV1(operation: Readonly<Record<string, unknown>>, outbox: Readonly<Record<string, unknown>>): string {
  return canonical({ authorizationRef: operation.authorizationRef, authorizationHash: operation.authorizationHash, operationRef: operation.operationRef, operationHash: operation.operationHash, outboxRef: outbox.outboxRef, outboxHash: outbox.outboxHash });
}

function validateRegistrationCandidateAgainstPredecessorV1(
  registration: InternalProductionBaselineServiceRestartHelperRegistryRegistrationV1,
  predecessor: RegistryWalkV1,
): void {
  const expectedOrdinal = (predecessor.head?.registryOrdinal ?? 0) + 1;
  if (registration.registryOrdinal !== expectedOrdinal || registration.predecessorHeadRef !== (predecessor.head?.headRef ?? null) || registration.predecessorHeadHash !== (predecessor.head?.headHash ?? null) || expectedOrdinal > MAX_INTERNAL_PRODUCTION_BASELINE_SERVICE_RESTART_HELPER_REGISTRY_HEAD_ENTRIES_V1 || predecessor.registrations.length >= MAX_INTERNAL_PRODUCTION_BASELINE_SERVICE_RESTART_HELPER_REGISTRATIONS_V1) fail("baseline helper registry registration candidate predecessor is crossed or capped");
  const tuple = canonical({ authorizationRef: registration.authorizationRef, authorizationHash: registration.authorizationHash, operationRef: registration.operationRef, operationHash: registration.operationHash, outboxRef: registration.outboxRef, outboxHash: registration.outboxHash });
  const members = [registration.authorizationRef, registration.authorizationHash, registration.operationRef, registration.operationHash, registration.outboxRef, registration.outboxHash];
  for (const prior of predecessor.registrations) {
    const priorTuple = canonical({ authorizationRef: prior.authorizationRef, authorizationHash: prior.authorizationHash, operationRef: prior.operationRef, operationHash: prior.operationHash, outboxRef: prior.outboxRef, outboxHash: prior.outboxHash });
    const priorMembers = [prior.authorizationRef, prior.authorizationHash, prior.operationRef, prior.operationHash, prior.outboxRef, prior.outboxHash];
    if (priorTuple === tuple || members.some((member) => priorMembers.includes(member))) fail("baseline helper registry registration candidate repeats a prior tuple member");
  }
}

function validateTerminalCandidateAgainstPredecessorV1(
  terminal: InternalProductionBaselineServiceRestartHelperRegistryTerminalV1,
  predecessor: RegistryWalkV1,
): InternalProductionBaselineServiceRestartHelperRegistryRegistrationV1 {
  const expectedOrdinal = (predecessor.head?.registryOrdinal ?? 0) + 1;
  if (!predecessor.head || terminal.registryOrdinal !== expectedOrdinal || terminal.predecessorHeadRef !== predecessor.head.headRef || terminal.predecessorHeadHash !== predecessor.head.headHash || expectedOrdinal > MAX_INTERNAL_PRODUCTION_BASELINE_SERVICE_RESTART_HELPER_REGISTRY_HEAD_ENTRIES_V1) fail("baseline helper registry terminal candidate predecessor is crossed or capped");
  const registration = predecessor.registrations.find((candidate) => candidate.registrationRef === terminal.registrationRef && candidate.registrationHash === terminal.registrationHash) ?? fail("baseline helper registry terminal registration is not in its predecessor chain");
  if (predecessor.terminals.some((candidate) => candidate.registrationRef === registration.registrationRef && candidate.registrationHash === registration.registrationHash)) fail("baseline helper registry registration already has a terminal");
  return registration;
}

function appendOrAdoptRegistrationV1(operation: Readonly<Record<string, unknown>>, outbox: Readonly<Record<string, unknown>>): InternalProductionBaselineServiceRestartHelperRegistryRegistrationV1 {
  const walk = walkRegistryV1();
  const tuple = registrationTupleV1(operation, outbox);
  const exact = walk.registrations.find((registration) => canonical({ authorizationRef: registration.authorizationRef, authorizationHash: registration.authorizationHash, operationRef: registration.operationRef, operationHash: registration.operationHash, outboxRef: registration.outboxRef, outboxHash: registration.outboxHash }) === tuple);
  if (exact) return exact;
  for (const registration of walk.registrations) {
    const oldMembers = [registration.authorizationRef, registration.authorizationHash, registration.operationRef, registration.operationHash, registration.outboxRef, registration.outboxHash];
    const newMembers = [operation.authorizationRef, operation.authorizationHash, operation.operationRef, operation.operationHash, outbox.outboxRef, outbox.outboxHash];
    if (newMembers.some((member) => oldMembers.includes(member as string))) fail("baseline helper registry tuple has a crossed duplicate member");
  }
  if (walk.registrations.length >= MAX_INTERNAL_PRODUCTION_BASELINE_SERVICE_RESTART_HELPER_REGISTRATIONS_V1) fail("baseline helper registry registration cap is exceeded");
  const predecessor = walk.head;
  if ((predecessor?.registryOrdinal ?? 0) + 1 > MAX_INTERNAL_PRODUCTION_BASELINE_SERVICE_RESTART_HELPER_REGISTRY_HEAD_ENTRIES_V1) fail("baseline helper registry head cap is exceeded before registration publication");
  const core = { schema: "setfarm.internal-production-baseline-service-restart-helper-registry-registration.v1", registryOrdinal: (predecessor?.registryOrdinal ?? 0) + 1, predecessorHeadRef: predecessor?.headRef ?? null, predecessorHeadHash: predecessor?.headHash ?? null, service: operation.service, actionId: operation.actionId, authorizationRef: operation.authorizationRef, authorizationHash: operation.authorizationHash, operationRef: operation.operationRef, operationHash: operation.operationHash, outboxRef: outbox.outboxRef, outboxHash: outbox.outboxHash };
  const registrationHash = sha256(canonical(core));
  const value = { ...core, registrationRef: `${REGISTRATION_PREFIX}${registrationHash}`, registrationHash };
  validateRegistrationCandidateAgainstPredecessorV1(value as InternalProductionBaselineServiceRestartHelperRegistryRegistrationV1, walk);
  writeNoReplace(registryContentPathV1("registrations", registrationHash), value);
  const registration = resolveRegistrationDirectV1({ registrationRef: value.registrationRef, registrationHash });
  publishRegistryHeadV1("registration", { registrationRef: registration.registrationRef, registrationHash: registration.registrationHash }, predecessor);
  return (walkRegistryV1().registrations.find((candidate) => candidate.registrationHash === registrationHash) ?? fail("baseline helper registry registration CAS is not visible"));
}

function appendOrAdoptTerminalV1(registration: InternalProductionBaselineServiceRestartHelperRegistryRegistrationV1, journalHash: string, outcome: "completed" | "ambiguous", settlement: Readonly<Record<string, unknown>> | null): InternalProductionBaselineServiceRestartHelperRegistryTerminalV1 {
  const walk = walkRegistryV1();
  const existing = walk.terminals.find((terminal) => terminal.registrationRef === registration.registrationRef && terminal.registrationHash === registration.registrationHash);
  const settlementRef = settlement?.helperSettlementRef ?? null;
  const settlementHash = settlement?.helperSettlementHash ?? null;
  if (existing) {
    if (existing.helperJournalHash !== journalHash || existing.outcome !== outcome || existing.helperSettlementRef !== settlementRef || existing.helperSettlementHash !== settlementHash) fail("baseline helper registry terminal already differs");
    return existing;
  }
  if (!walk.registrations.some((candidate) => candidate.registrationRef === registration.registrationRef && candidate.registrationHash === registration.registrationHash)) fail("baseline helper registry terminal registration is not visible");
  if (outcome === "completed" && !settlement) fail("completed baseline helper terminal lacks settlement");
  if (outcome === "ambiguous" && settlement) fail("ambiguous baseline helper terminal has settlement");
  const predecessor = walk.head ?? fail("baseline helper registry terminal lacks predecessor");
  const core = { schema: "setfarm.internal-production-baseline-service-restart-helper-registry-terminal.v1", registryOrdinal: predecessor.registryOrdinal + 1, predecessorHeadRef: predecessor.headRef, predecessorHeadHash: predecessor.headHash, registrationRef: registration.registrationRef, registrationHash: registration.registrationHash, helperJournalHash: journalHash, outcome, helperSettlementRef: settlementRef, helperSettlementHash: settlementHash };
  if (core.registryOrdinal > MAX_INTERNAL_PRODUCTION_BASELINE_SERVICE_RESTART_HELPER_REGISTRY_HEAD_ENTRIES_V1) fail("baseline helper registry head cap is exceeded");
  const terminalHash = sha256(canonical(core));
  const value = { ...core, terminalRef: `${REGISTRY_TERMINAL_PREFIX}${terminalHash}`, terminalHash };
  validateTerminalCandidateAgainstPredecessorV1(value as InternalProductionBaselineServiceRestartHelperRegistryTerminalV1, walk);
  writeNoReplace(registryContentPathV1("terminals", terminalHash), value);
  const terminal = resolveTerminalDirectV1({ terminalRef: value.terminalRef, terminalHash });
  publishRegistryHeadV1("terminal", { terminalRef: terminal.terminalRef, terminalHash: terminal.terminalHash }, predecessor);
  return (walkRegistryV1().terminals.find((candidate) => candidate.terminalHash === terminalHash) ?? fail("baseline helper registry terminal CAS is not visible"));
}

function closeNormalHelperJournalsBeforeLockCleanupV1(
  transitionLock: Readonly<Record<string, unknown>>,
  currentLockIdentity: Readonly<{ devDecimal: string; inoDecimal: string }>,
): void {
  const initial = walkRegistryV1();
  for (const registration of initial.registrations) {
    if (initial.terminals.some((terminal) => terminal.registrationRef === registration.registrationRef && terminal.registrationHash === registration.registrationHash)) continue;
    let journal: Readonly<Record<string, unknown>>;
    try { journal = resolveRegisteredBaselineJournalV1(registration); }
    catch (error) {
      if (error instanceof Error && "code" in error && error.code === "ENOENT") continue;
      throw error;
    }
    if (canonical(journal.transitionLock) !== canonical(transitionLock) || canonical(journal.lockIdentity) !== canonical(currentLockIdentity)) fail("live baseline helper journal is bound to another transition lock");
    const expected = baselineSettlementV1(Object.freeze({ actionId: registration.actionId }), Object.freeze({ operationRef: registration.operationRef, operationHash: registration.operationHash }), journal);
    try {
      const settlement = readBaselineSettlementV1(expected);
      appendOrAdoptTerminalV1(registration, journal.journalHash as string, "completed", settlement);
    } catch (error) {
      if (!(error instanceof Error) || !("code" in error) || error.code !== "ENOENT") throw error;
      appendOrAdoptTerminalV1(registration, journal.journalHash as string, "ambiguous", null);
    }
  }
}

function resolvePreSchemaRetainedClosureV1(): Readonly<{ preSchemaHelperJournalHash: string; preSchemaHelperSettlementRef: string; preSchemaHelperSettlementHash: string }> {
  const bytes = readStableRetirementBytes(rootPaths().journal, "pre-schema helper journal census");
  let value: unknown;
  try { value = JSON.parse(bytes.toString("utf8")); } catch { return fail("pre-schema helper journal census is not JSON"); }
  const journal = exactCanonicalRecord(value, ["schema", "family", "operationSchema", "operationPurpose", "action", "currentEntryOperation", "restartAuthority", "transitionLock", "lockIdentity", "maximumDispatchCount", "journalHash"], "pre-schema helper journal census");
  const core = { ...journal }; delete core.journalHash;
  if (`${canonical(journal)}\n` !== bytes.toString("utf8") || journal.schema !== "setfarm.internal-production-service-restart-helper-journal.v1" || journal.family !== "pre-schema-spawner-rebind" || journal.operationSchema !== "setfarm.internal-production-current-entry-operation.v1" || journal.operationPurpose !== "task6a-internal-production-current-entry-v1" || journal.action !== "task6a-pre-schema-setfarm-spawner-rebind-v1" || journal.maximumDispatchCount !== 1 || typeof journal.journalHash !== "string" || journal.journalHash !== sha256(canonical(core))) fail("pre-schema helper journal census is crossed");
  const currentEntryOperation = exactCanonicalRecord(journal.currentEntryOperation, ["operationRef", "operationHash"], "pre-schema helper census operation");
  const restartAuthority = exactCanonicalRecord(journal.restartAuthority, ["restartAuthorityRef", "restartAuthorityHash"], "pre-schema helper census restart");
  const lockIdentity = exactCanonicalRecord(journal.lockIdentity, ["devDecimal", "inoDecimal"], "pre-schema helper census lock identity");
  const transitionLock = parseLockRecord(Buffer.from(`${canonical(journal.transitionLock)}\n`, "utf8"));
  if (typeof currentEntryOperation.operationHash !== "string" || !SHA256.test(currentEntryOperation.operationHash) || currentEntryOperation.operationRef !== `setfarm://internal-production/current-entry-operation/sha256/${currentEntryOperation.operationHash}` || typeof restartAuthority.restartAuthorityHash !== "string" || !SHA256.test(restartAuthority.restartAuthorityHash) || restartAuthority.restartAuthorityRef !== `setfarm://internal-production/pre-schema-spawner-restart-authority/sha256/${restartAuthority.restartAuthorityHash}` || typeof lockIdentity.devDecimal !== "string" || !/^(0|[1-9][0-9]*)$/.test(lockIdentity.devDecimal) || typeof lockIdentity.inoDecimal !== "string" || !/^(0|[1-9][0-9]*)$/.test(lockIdentity.inoDecimal) || canonical(journal.transitionLock) !== canonical(transitionLock)) fail("pre-schema helper retained authority is crossed");
  const settlementBody = { schema: "setfarm.internal-production-pre-schema-spawner-rebind-helper-settlement.v1", action: "task6a-pre-schema-setfarm-spawner-rebind-v1", currentEntryOperation, restartAuthority, journalHash: journal.journalHash, transitionLock, lockIdentity, dispatchCount: 1, disposition: "completed" };
  const preSchemaHelperSettlementHash = sha256(canonical(settlementBody));
  const preSchemaHelperSettlementRef = `${HELPER_PREFIX}${preSchemaHelperSettlementHash}`;
  const settlement = readSettlement(preSchemaHelperSettlementHash);
  if (canonical(settlement) !== canonical({ ...settlementBody, helperSettlementRef: preSchemaHelperSettlementRef, helperSettlementHash: preSchemaHelperSettlementHash })) fail("pre-schema helper settlement census is crossed");
  return Object.freeze({ preSchemaHelperJournalHash: journal.journalHash as string, preSchemaHelperSettlementRef, preSchemaHelperSettlementHash });
}

export async function observeInternalProductionBaselineServiceRestartHelperJournalCensusV1(): Promise<InternalProductionBaselineServiceRestartHelperJournalCensusV1> {
  const preSchema = resolvePreSchemaRetainedClosureV1();
  const walk = walkRegistryV1();
  const registeredBaselineHelperJournalCount = walk.registrations.length;
  const terminalBaselineHelperJournalCount = walk.terminals.length;
  const ambiguousBaselineHelperJournalCount = walk.terminals.filter((terminal) => terminal.outcome === "ambiguous").length;
  const liveBaselineHelperJournalCount = registeredBaselineHelperJournalCount - terminalBaselineHelperJournalCount;
  if (terminalBaselineHelperJournalCount > registeredBaselineHelperJournalCount || liveBaselineHelperJournalCount < 0 || ambiguousBaselineHelperJournalCount > terminalBaselineHelperJournalCount) fail("baseline helper journal census arithmetic is crossed");
  const retainedHelperJournalSettlementSetHash = sha256(canonical({ schema: "setfarm.internal-production-baseline-service-restart-helper-retained-authority-set.v1", preSchemaHelperState: "terminal", ...preSchema, orderedRegistryEntries: walk.orderedEntries }));
  const body = { schema: "setfarm.internal-production-baseline-service-restart-helper-journal-census.v1", preSchemaHelperState: "terminal", registeredBaselineHelperJournalCount, terminalBaselineHelperJournalCount, liveBaselineHelperJournalCount, ambiguousBaselineHelperJournalCount, helperJournalRegistryHeadRef: walk.head?.headRef ?? null, helperJournalRegistryHeadHash: walk.head?.headHash ?? null, retainedHelperJournalSettlementSetHash };
  return orderedFrozenV1({ ...body, censusHash: sha256(canonical(body)) }) as InternalProductionBaselineServiceRestartHelperJournalCensusV1;
}

function baselineJournalPathV1(operationHash: string): string {
  return path.join(rootPaths().baselineJournals, operationHash.slice(0, 2), `${operationHash}.json`);
}

function resolveRegisteredBaselineJournalV1(registration: InternalProductionBaselineServiceRestartHelperRegistryRegistrationV1): Readonly<Record<string, unknown>> {
  const journalBytes = readStableRetirementBytes(baselineJournalPathV1(registration.operationHash), "registered baseline helper journal");
  let journalValue: unknown;
  try { journalValue = JSON.parse(journalBytes.toString("utf8")); } catch { return fail("registered baseline helper journal is not JSON"); }
  const journal = exactCanonicalRecord(journalValue, ["schema", "family", "operationSchema", "action", "restartOperation", "transitionLock", "lockIdentity", "maximumDispatchCount", "journalHash"], "registered baseline helper journal");
  const restartOperation = exactCanonicalRecord(journal.restartOperation, ["operationRef", "operationHash"], "registered baseline helper journal operation");
  const lockIdentity = exactCanonicalRecord(journal.lockIdentity, ["devDecimal", "inoDecimal"], "registered baseline helper journal lock identity");
  const transitionLock = parseLockRecord(Buffer.from(`${canonical(journal.transitionLock)}\n`, "utf8"));
  const projection = { ...journal }; delete projection.journalHash;
  if (
    `${canonical(journal)}\n` !== journalBytes.toString("utf8")
    || journal.schema !== "setfarm.internal-production-service-restart-helper-journal.v1"
    || journal.family !== "baseline-service-restart"
    || journal.operationSchema !== "setfarm.internal-production-baseline-service-restart-operation.v1"
    || journal.action !== registration.actionId
    || canonical(restartOperation) !== canonical({ operationRef: registration.operationRef, operationHash: registration.operationHash })
    || canonical(journal.transitionLock) !== canonical(transitionLock)
    || typeof lockIdentity.devDecimal !== "string" || !/^(0|[1-9][0-9]*)$/.test(lockIdentity.devDecimal)
    || typeof lockIdentity.inoDecimal !== "string" || !/^(0|[1-9][0-9]*)$/.test(lockIdentity.inoDecimal)
    || journal.maximumDispatchCount !== 1
    || typeof journal.journalHash !== "string" || !SHA256.test(journal.journalHash)
    || journal.journalHash !== sha256(canonical(projection))
  ) fail("registered baseline helper journal relation is crossed");
  return Object.freeze(journal);
}

function baselineSettlementV1(
  operation: Readonly<Record<string, unknown>>,
  restartOperation: Readonly<Record<string, string>>,
  journal: Readonly<Record<string, unknown>>,
): Readonly<{ body: Readonly<Record<string, unknown>>; value: Readonly<Record<string, unknown>>; path: string }> {
  const body = Object.freeze({
    schema: "setfarm.internal-production-baseline-service-restart-helper-settlement.v1",
    action: operation.actionId,
    restartOperation,
    journalHash: journal.journalHash,
    transitionLock: journal.transitionLock,
    lockIdentity: journal.lockIdentity,
    dispatchCount: 1,
    disposition: "completed",
  });
  const helperSettlementHash = sha256(canonical(body));
  const helperSettlementRef = `${BASELINE_HELPER_PREFIX}${helperSettlementHash}`;
  return Object.freeze({
    body,
    value: Object.freeze({ ...body, helperSettlementRef, helperSettlementHash }),
    path: path.join(rootPaths().baselineSettlements, helperSettlementHash.slice(0, 2), `${helperSettlementHash}.json`),
  });
}

function readBaselineSettlementV1(expected: ReturnType<typeof baselineSettlementV1>): Readonly<Record<string, unknown>> {
  const bytes = readStableRetirementBytes(expected.path, "baseline helper settlement");
  let value: unknown;
  try { value = JSON.parse(bytes.toString("utf8")); } catch { return fail("baseline helper settlement is not JSON"); }
  const settlement = exactCanonicalRecord(value, ["schema", "action", "restartOperation", "journalHash", "transitionLock", "lockIdentity", "dispatchCount", "disposition", "helperSettlementRef", "helperSettlementHash"], "baseline helper settlement");
  if (`${canonical(settlement)}\n` !== bytes.toString("utf8") || canonical(settlement) !== canonical(expected.value)) fail("baseline helper settlement differs");
  return Object.freeze(settlement);
}

export async function invokeInternalProductionBaselineServiceRestartHelperUnderTransitionLeaseV1(
  lease: InternalProductionPhysicalServiceRestartAuthorityTransitionLeaseV1,
  input: Readonly<{ restartOperation: InternalProductionBaselineServiceRestartOperationPairV1 }>,
): Promise<InternalProductionBaselineServiceRestartHelperSettlementPairV1> {
  const state = heldLease(lease);
  assertEpochOneActive();
  const exactInput = exactOwnRecord(input, ["restartOperation"], "baseline helper invoke input");
  const restartOperation = pair(exactInput.restartOperation, "operationRef", "operationHash");
  const { operation, outbox } = await resolveNormalRestartTask12AuthoritiesV1(restartOperation);
  const registration = appendOrAdoptRegistrationV1(operation, outbox);
  const priorTerminal = walkRegistryV1().terminals.find((candidate) => candidate.registrationRef === registration.registrationRef && candidate.registrationHash === registration.registrationHash);
  if (priorTerminal) {
    if (priorTerminal.outcome === "ambiguous") fail("HELPER_DISPATCH_SETTLEMENT_UNKNOWN");
    return Object.freeze({ helperSettlementRef: priorTerminal.helperSettlementRef!, helperSettlementHash: priorTerminal.helperSettlementHash! });
  }
  const operationHash = restartOperation.operationHash!;
  const held = heldLease(lease);
  const currentLockIdentity = descriptorIdentity(held.descriptor);
  const currentTransitionLock = parseLockRecord(held.lockBytes);
  const journalPath = baselineJournalPathV1(operationHash);
  const journalGuard = ensurePrivateAuthorityDirectoryV1(path.dirname(journalPath));
  try {
    journalGuard.assertStable();
    let journal: Readonly<Record<string, unknown>>;
    let dispatchRequired = false;
    try {
      const bytes = readStableRetirementBytes(journalPath, "baseline helper journal");
      let value: unknown;
      try { value = JSON.parse(bytes.toString("utf8")); } catch { return fail("baseline helper journal is not JSON"); }
      const existing = exactCanonicalRecord(value, ["schema", "family", "operationSchema", "action", "restartOperation", "transitionLock", "lockIdentity", "maximumDispatchCount", "journalHash"], "baseline helper journal");
      const projection = { ...existing };
      delete projection.journalHash;
      const journalTransitionLock = parseLockRecord(Buffer.from(`${canonical(existing.transitionLock)}\n`, "utf8"));
      const journalLockIdentity = exactCanonicalRecord(existing.lockIdentity, ["devDecimal", "inoDecimal"], "baseline helper journal lock identity");
      if (`${canonical(existing)}\n` !== bytes.toString("utf8") || existing.schema !== "setfarm.internal-production-service-restart-helper-journal.v1" || existing.family !== "baseline-service-restart" || existing.operationSchema !== "setfarm.internal-production-baseline-service-restart-operation.v1" || existing.action !== operation.actionId || canonical(existing.restartOperation) !== canonical(restartOperation) || canonical(existing.transitionLock) !== canonical(journalTransitionLock) || canonical(existing.lockIdentity) !== canonical(journalLockIdentity) || existing.maximumDispatchCount !== 1 || typeof existing.journalHash !== "string" || !SHA256.test(existing.journalHash) || sha256(canonical(projection)) !== existing.journalHash) fail("baseline helper journal is crossed or ambiguous");
      journal = Object.freeze(existing);
    } catch (error) {
      if (!(error instanceof Error) || !("code" in error) || error.code !== "ENOENT") throw error;
      const journalBody = {
        schema: "setfarm.internal-production-service-restart-helper-journal.v1",
        family: "baseline-service-restart",
        operationSchema: operation.schema,
        action: operation.actionId,
        restartOperation,
        transitionLock: currentTransitionLock,
        lockIdentity: currentLockIdentity,
        maximumDispatchCount: 1,
      };
      const journalHash = sha256(canonical(journalBody));
      journal = Object.freeze({ ...journalBody, journalHash });
      dispatchRequired = writeNoReplace(journalPath, journal);
    }
    const expected = baselineSettlementV1(operation, restartOperation, journal);
    if (dispatchRequired) {
      const settlementGuard = ensurePrivateAuthorityDirectoryV1(path.dirname(expected.path));
      try {
        settlementGuard.assertStable();
        const capabilityPath = path.join(rootPaths().root, `.baseline-helper-capability.${randomUUID()}.json`);
        const journalDescriptor = openSync(journalPath, constants.O_RDONLY | constants.O_NOFOLLOW);
        const frame = { schema: "setfarm.internal-production-baseline-service-restart-helper-capability.v1", restartOperation, journalHash: journal.journalHash, lockIdentity: currentLockIdentity, journalIdentity: descriptorIdentity(journalDescriptor) };
        const writable = openSync(capabilityPath, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
        try { writeFileSync(writable, canonical(frame)); fsyncSync(writable); } finally { closeSync(writable); }
        const descriptor = openSync(capabilityPath, constants.O_RDONLY | constants.O_NOFOLLOW);
        unlinkSync(capabilityPath);
        const helper = fileURLToPath(new URL("./baseline-service-restart-helper-v1.js", import.meta.url));
        const child = spawnSync(process.execPath, [helper], {
          env: Object.freeze({ PATH: "/usr/bin:/bin", LANG: "C", LC_ALL: "C" }), shell: false,
          stdio: ["ignore", "ignore", "ignore", descriptor, held.descriptor, journalDescriptor], timeout: 45_000,
        });
        closeSync(descriptor);
        closeSync(journalDescriptor);
        // A nonzero or indeterminate child outcome is not itself proof that the
        // helper failed before its durable settlement. The exact settlement is
        // reopened below before terminal ambiguity is published.
        settlementGuard.assertStable();
      } finally {
        try { settlementGuard.assertStable(); } finally { settlementGuard.close(); }
      }
    }
    let settlement: Readonly<Record<string, unknown>>;
    try { settlement = readBaselineSettlementV1(expected); }
    catch (error) {
      if (error instanceof Error && "code" in error && error.code === "ENOENT") {
        appendOrAdoptTerminalV1(registration, journal.journalHash as string, "ambiguous", null);
        fail("HELPER_DISPATCH_SETTLEMENT_UNKNOWN");
      }
      throw error;
    }
    appendOrAdoptTerminalV1(registration, journal.journalHash as string, "completed", settlement);
    journalGuard.assertStable();
    return Object.freeze({ helperSettlementRef: settlement.helperSettlementRef as string, helperSettlementHash: settlement.helperSettlementHash as string });
  } finally {
    try { journalGuard.assertStable(); } finally { journalGuard.close(); }
  }
}

function optionalRetirementBytesV1(file: string, label: string): Buffer | null {
  try { return readStableRetirementBytes(file, label); }
  catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") return null;
    throw error;
  }
}

async function observeCompleteCodeOwnedCutoverReadinessV1(): Promise<Readonly<Record<string, unknown>>> {
  const receipt = await import("./baseline-post-handoff-receipt-v1.js") as unknown as Readonly<Record<string, unknown>>;
  const sourceGateObserver = receipt.observeInternalProductionReviewedDSourceBuildGateV1;
  const readinessObserver = receipt.observeInternalProductionServiceRestartCutoverReadinessCandidateV1;
  if (typeof sourceGateObserver !== "function" || typeof readinessObserver !== "function") fail("complete code-owned cutover readiness lower authority is unavailable");
  const sourceGate = exactFrozenObserverRecordV1(await (sourceGateObserver as () => Promise<unknown>)(), ["schema", "reviewed", "setfarmSourceSha", "missionControlSourceSha", "setfarmBuildHash", "missionControlBuildHash", "recoveryProducerManifestActivationRef", "recoveryProducerManifestActivationHash", "missionControlHandoffRef", "missionControlHandoffHash"], "reviewed D source-build gate");
  if (sourceGate.schema !== "setfarm.internal-production-reviewed-d-source-build-gate.v1" || sourceGate.reviewed !== true) fail("reviewed D source-build gate is unavailable");
  for (const key of ["setfarmSourceSha", "missionControlSourceSha"] as const) if (typeof sourceGate[key] !== "string" || !/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(sourceGate[key] as string)) fail(`reviewed D ${key} is invalid`);
  for (const key of ["setfarmBuildHash", "missionControlBuildHash", "recoveryProducerManifestActivationHash", "missionControlHandoffHash"] as const) if (typeof sourceGate[key] !== "string" || !SHA256.test(sourceGate[key] as string)) fail(`reviewed D ${key} is invalid`);
  if (sourceGate.recoveryProducerManifestActivationRef !== `setfarm://internal-production/recovery-owner-producer-manifest-activation/sha256/${sourceGate.recoveryProducerManifestActivationHash}` || sourceGate.missionControlHandoffRef !== `setfarm://internal-production/recovery-mission-control-source-handoff/sha256/${sourceGate.missionControlHandoffHash}`) fail("reviewed D activation/handoff pair is crossed");
  const readiness = exactFrozenObserverRecordV1(await (readinessObserver as () => Promise<unknown>)(), ["schema", "setfarmSourceSha", "missionControlSourceSha", "setfarmBuildHash", "missionControlBuildHash", "migrationReceiptRef", "migrationReceiptHash", "migrationSourceSha", "migrationImplementationBlobHash", "orderedStatementsHash", "namedMigrationDigestEntryHash", "migrationDigest", "schemaProjectionHash", "physicalRestartEpochRef", "physicalRestartEpochHash", "physicalRestartEpochOrdinal", "physicalRestartAuthorityOwner", "dForwardIdentityRegistryHash", "dForwardImplementationIdentities", "spawnerHookImplementationId", "spawnerHookImplementationHash", "dashboardHookImplementationId", "dashboardHookImplementationHash", "missionControlHookImplementationId", "missionControlHookImplementationHash", "runtimeSourceProjectionHash", "recoveryPrepareState"], "cutover readiness candidate");
  if (readiness.schema !== "setfarm.internal-production-service-restart-startup-hooks-ready.v1" || readiness.physicalRestartEpochOrdinal !== 1 || readiness.physicalRestartAuthorityOwner !== "baseline-a" || readiness.dForwardIdentityRegistryHash !== RECOVERY_FORWARD_ABI_HASH_V1 || readiness.spawnerHookImplementationId !== "recovery-d-setfarm-spawner-startup-v1" || readiness.dashboardHookImplementationId !== "recovery-d-setfarm-dashboard-startup-v1" || readiness.missionControlHookImplementationId !== "recovery-d-mission-control-startup-v1" || readiness.recoveryPrepareState !== "disabled-by-baseline-epoch-one") fail("cutover readiness candidate fixed authority is invalid");
  for (const key of ["setfarmSourceSha", "missionControlSourceSha", "setfarmBuildHash", "missionControlBuildHash"] as const) if (readiness[key] !== sourceGate[key]) fail("cutover readiness candidate source/build differs from reviewed gate");
  for (const key of ["migrationReceiptHash", "orderedStatementsHash", "namedMigrationDigestEntryHash", "migrationDigest", "schemaProjectionHash", "physicalRestartEpochHash", "spawnerHookImplementationHash", "dashboardHookImplementationHash", "missionControlHookImplementationHash", "runtimeSourceProjectionHash"] as const) if (typeof readiness[key] !== "string" || !SHA256.test(readiness[key] as string)) fail(`cutover readiness ${key} is invalid`);
  for (const key of ["migrationSourceSha", "migrationImplementationBlobHash"] as const) if (typeof readiness[key] !== "string" || !/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(readiness[key] as string)) fail(`cutover readiness ${key} is invalid`);
  if (readiness.migrationReceiptRef !== `setfarm://internal-production/baseline-bootstrap-handoff-migration-receipt/sha256/${readiness.migrationReceiptHash}` || readiness.physicalRestartEpochRef !== `setfarm://internal-production/physical-service-restart-authority-epoch/sha256/${readiness.physicalRestartEpochHash}`) fail("cutover readiness migration/epoch pair is crossed");
  const epoch = assertEpochOneActive();
  if (readiness.physicalRestartEpochRef !== epoch.epochRef || readiness.physicalRestartEpochHash !== epoch.epochHash) fail("cutover readiness predecessor epoch is stale");
  if (!Array.isArray(readiness.dForwardImplementationIdentities) || readiness.dForwardImplementationIdentities.length !== RECOVERY_FORWARD_ABI_V1.length) fail("cutover readiness forward identity registry is incomplete");
  for (const [index, fixed] of RECOVERY_FORWARD_ABI_V1.entries()) {
    const identity = exactFrozenObserverRecordV1(readiness.dForwardImplementationIdentities[index], ["role", "category", "producerImplementationId", "expectedModuleRelativePath", "expectedExportName", "moduleBlobHash", "sourceSha", "buildHash"], `cutover readiness forward identity ${index}`);
    for (const key of ["role", "category", "producerImplementationId", "expectedModuleRelativePath", "expectedExportName"] as const) if (identity[key] !== fixed[key]) fail(`cutover readiness forward identity ${index} is crossed`);
    if (typeof identity.moduleBlobHash !== "string" || !/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(identity.moduleBlobHash) || identity.sourceSha !== sourceGate.setfarmSourceSha || identity.buildHash !== sourceGate.setfarmBuildHash) fail(`cutover readiness forward implementation ${index} is crossed`);
  }
  return readiness;
}

function cutoverLocatorV1(name: string): string {
  return path.join(rootPaths().cutover, `${name}.pair.json`);
}

function cutoverPendingPathV1(): string {
  return path.join(rootPaths().cutover, "cutover-pending-input.json");
}

const COMPLETE_ZERO_RECORD_KEYS_V1 = Object.freeze([
  "schema", "census", "ownerCategoryRegistryHash", "ownerCategoryCensusMapHash",
  "activeProducerManifestSetActivationRef", "activeProducerManifestSetActivationHash",
  "activeProducerManifestSetHash", "reservationIdentitySetHash", "ownerIdentitySetHash",
  "observationRef", "observationHash",
] as const);

function validateCompleteZeroOwnerCensusV1(value: unknown, expected?: Readonly<{ observationRef: string; observationHash: string }>): Readonly<Record<string, unknown>> {
  const record = exactFrozenObserverRecordV1(value, COMPLETE_ZERO_RECORD_KEYS_V1, "complete zero-owner census");
  if (record.schema !== "setfarm.internal-production-complete-zero-owner-census-observation.v1") fail("complete zero-owner census schema is invalid");
  const census = exactFrozenObserverRecordV1(record.census, COMPLETE_ZERO_KEYS_V1, "complete zero-owner census scalars");
  if (COMPLETE_ZERO_KEYS_V1.some((key) => census[key] !== 0)) fail("complete zero-owner census is nonzero");
  for (const key of ["ownerCategoryRegistryHash", "ownerCategoryCensusMapHash", "activeProducerManifestSetActivationHash", "activeProducerManifestSetHash", "reservationIdentitySetHash", "ownerIdentitySetHash", "observationHash"] as const) {
    if (typeof record[key] !== "string" || !SHA256.test(record[key] as string)) fail(`complete zero-owner census ${key} is invalid`);
  }
  if (record.activeProducerManifestSetActivationRef !== `setfarm://internal-production/owner-producer-manifest-set-activation/sha256/${record.activeProducerManifestSetActivationHash}`) fail("complete zero-owner census activation pair is crossed");
  const projection = { ...record };
  delete projection.observationRef;
  delete projection.observationHash;
  if (record.observationHash !== sha256(canonical(projection)) || record.observationRef !== `setfarm://internal-production/complete-zero-owner-census-observation/sha256/${record.observationHash}`) fail("complete zero-owner census self pair is crossed");
  if (expected && (record.observationRef !== expected.observationRef || record.observationHash !== expected.observationHash)) fail("complete zero-owner census pair differs from guard");
  return record;
}

function validateZeroOwnerGuardV1(value: unknown, expected: Readonly<{ zeroOwnerGuardRef: string; zeroOwnerGuardHash: string }>): Readonly<Record<string, unknown>> {
  const record = exactFrozenObserverRecordV1(value, ["schema", "completeZeroOwnerCensusObservationRef", "completeZeroOwnerCensusObservationHash", "baselineServiceRestartHelperJournalCensusHash", "guardNonce", "zeroOwnerGuardRef", "zeroOwnerGuardHash"], "zero-owner mutation guard");
  for (const key of ["completeZeroOwnerCensusObservationHash", "baselineServiceRestartHelperJournalCensusHash", "guardNonce", "zeroOwnerGuardHash"] as const) if (typeof record[key] !== "string" || !SHA256.test(record[key] as string)) fail(`zero-owner mutation guard ${key} is invalid`);
  const core = { ...record };
  delete core.zeroOwnerGuardRef;
  delete core.zeroOwnerGuardHash;
  if (record.schema !== "setfarm.internal-production-baseline-zero-owner-mutation-guard.v1" || record.zeroOwnerGuardHash !== sha256(canonical(core)) || record.zeroOwnerGuardRef !== `${CUTOVER_GUARD_PREFIX}${record.zeroOwnerGuardHash}` || record.zeroOwnerGuardRef !== expected.zeroOwnerGuardRef || record.zeroOwnerGuardHash !== expected.zeroOwnerGuardHash || record.completeZeroOwnerCensusObservationRef !== `setfarm://internal-production/complete-zero-owner-census-observation/sha256/${record.completeZeroOwnerCensusObservationHash}`) fail("zero-owner mutation guard is crossed");
  return record;
}

type GuardPortsV1 = Readonly<{
  resolveGuard: (input: Readonly<{ zeroOwnerGuardRef: string; zeroOwnerGuardHash: string }>) => Promise<unknown>;
  consumeGuard: (input: Readonly<{ zeroOwnerGuardRef: string; zeroOwnerGuardHash: string; operationRef: string; operationHash: string }>) => Promise<unknown>;
  resolveConsumption: (input: Readonly<{ consumptionRef: string; consumptionHash: string }>) => Promise<unknown>;
  resolveCompleteZero: (input: Readonly<{ observationRef: string; observationHash: string }>) => Promise<unknown>;
}>;

async function guardPortsV1(): Promise<GuardPortsV1> {
  const receipt = await import("./baseline-post-handoff-receipt-v1.js") as unknown as Record<string, unknown>;
  const resolveGuard = receipt.resolveInternalProductionBaselineZeroOwnerMutationGuardV1;
  const consumeGuard = receipt.consumeInternalProductionBaselinePhysicalServiceRestartAuthorityCutoverZeroOwnerGuardV1;
  const resolveConsumption = receipt.resolveInternalProductionBaselinePhysicalServiceRestartAuthorityCutoverZeroOwnerGuardConsumptionV1;
  const resolveCompleteZero = receipt.resolveInternalProductionCompleteZeroOwnerCensusObservationV1;
  if (typeof resolveGuard !== "function" || typeof consumeGuard !== "function" || typeof resolveConsumption !== "function" || typeof resolveCompleteZero !== "function") fail("cutover guard authority ports are unavailable");
  return Object.freeze({ resolveGuard, consumeGuard, resolveConsumption, resolveCompleteZero } as GuardPortsV1);
}

type FencePortsV1 = Readonly<{
  acquireFence: (input: Readonly<Record<string, unknown>>) => Promise<unknown>;
  reobserveFence: (input: Readonly<{ fenceRef: string; fenceHash: string }>) => Promise<unknown>;
  releaseFence: (input: Readonly<Record<string, unknown>>) => Promise<unknown>;
  resolveRelease: (input: Readonly<{ releaseRef: string; releaseHash: string }>) => Promise<unknown>;
}>;

async function fencePortsV1(): Promise<FencePortsV1> {
  const ownerAdmission = await import("./owner-admission-v1.js") as unknown as Record<string, unknown>;
  const acquireFence = ownerAdmission.acquireInternalProductionGlobalOwnerAdmissionFenceV1;
  const reobserveFence = ownerAdmission.reobserveInternalProductionGlobalOwnerAdmissionFenceV1;
  const releaseFence = ownerAdmission.releaseInternalProductionGlobalOwnerAdmissionFenceV1;
  const resolveRelease = ownerAdmission.resolveInternalProductionGlobalOwnerAdmissionFenceReleaseV1;
  if (typeof acquireFence !== "function" || typeof reobserveFence !== "function" || typeof releaseFence !== "function" || typeof resolveRelease !== "function") fail("global owner-admission fence ports are unavailable");
  return Object.freeze({ acquireFence, reobserveFence, releaseFence, resolveRelease } as FencePortsV1);
}

function validateFenceV1(value: unknown, pending: Readonly<{ pendingInputRef: string; pendingInputHash: string }>): Readonly<Record<string, unknown>> {
  const record = exactFrozenObserverRecordV1(value, ["schema", "purpose", "pendingInputRef", "pendingInputHash", "ownerCategories", "ownerCategoryRegistryHash", "ownerCategoryCensusMapHash", "targetFamily", "observedUnrelatedReservationCount", "observedUnrelatedOwnerCount", "ownerIdentitySetHash", "predecessorFenceHeadHash", "ownerAdmissionHeadHash", "fenceRef", "fenceHash"], "global owner-admission fence");
  const target = exactFrozenObserverRecordV1(record.targetFamily, ["kind", "targetFamilyHash"], "global owner-admission fence target family");
  if (record.schema !== "setfarm.internal-production-global-owner-admission-fence.v1" || record.purpose !== "recovery-d-physical-service-restart-authority-cutover-v1" || record.pendingInputRef !== pending.pendingInputRef || record.pendingInputHash !== pending.pendingInputHash || canonical(record.ownerCategories) !== canonical(OWNER_CATEGORIES_V1) || target.kind !== "none" || target.targetFamilyHash !== null || record.observedUnrelatedReservationCount !== 0 || record.observedUnrelatedOwnerCount !== 0) fail("global owner-admission fence authority is invalid");
  for (const key of ["ownerCategoryRegistryHash", "ownerCategoryCensusMapHash", "ownerIdentitySetHash", "ownerAdmissionHeadHash", "fenceHash"] as const) if (typeof record[key] !== "string" || !SHA256.test(record[key] as string)) fail(`global owner-admission fence ${key} is invalid`);
  if (record.predecessorFenceHeadHash !== null && (typeof record.predecessorFenceHeadHash !== "string" || !SHA256.test(record.predecessorFenceHeadHash as string))) fail("global owner-admission predecessor head is invalid");
  const core = { ...record };
  delete core.fenceRef;
  delete core.fenceHash;
  if (record.fenceHash !== sha256(canonical(core)) || record.fenceRef !== `${GLOBAL_FENCE_PREFIX}${record.fenceHash}`) fail("global owner-admission fence self pair is crossed");
  return record;
}

async function reobserveExactFenceV1(ports: FencePortsV1, fence: Readonly<Record<string, unknown>>, pending: Readonly<{ pendingInputRef: string; pendingInputHash: string }>): Promise<void> {
  const observed = validateFenceV1(await ports.reobserveFence({ fenceRef: fence.fenceRef as string, fenceHash: fence.fenceHash as string }), pending);
  if (canonical(observed) !== canonical(fence)) fail("global owner-admission fence changed while held");
}

function strictSequencePairV1(bytes: Buffer, refKey: string, hashKey: string, prefix: string, label: string): Readonly<Record<string, unknown>> {
  let parsed: unknown;
  try { parsed = JSON.parse(bytes.toString("utf8")); } catch { return fail(`${label} is not JSON`); }
  const pairValue = exactCanonicalRecord(parsed, [refKey, hashKey], label);
  const hash = pairValue[hashKey];
  if (`${canonical(pairValue)}\n` !== bytes.toString("utf8") || typeof hash !== "string" || !SHA256.test(hash) || pairValue[refKey] !== `${prefix}${hash}`) fail(`${label} is crossed`);
  return Object.freeze(pairValue);
}

function strictSequenceContentV1(root: string, store: string, pairValue: Readonly<Record<string, unknown>>, refKey: string, hashKey: string, prefix: string, keys: readonly string[], label: string): Readonly<Record<string, unknown>> {
  const hash = pairValue[hashKey] as string;
  const bytes = readStableRetirementBytes(path.join(root, store, "sha256", hash.slice(0, 2), `${hash}.json`), label);
  let parsed: unknown;
  try { parsed = JSON.parse(bytes.toString("utf8")); } catch { return fail(`${label} is not JSON`); }
  const record = exactCanonicalRecord(parsed, keys, label);
  const projection = { ...record }; delete projection[refKey]; delete projection[hashKey];
  if (`${canonical(record)}\n` !== bytes.toString("utf8") || record[hashKey] !== hash || record[refKey] !== `${prefix}${hash}` || sha256(canonical(projection)) !== hash) fail(`${label} content is crossed`);
  return Object.freeze(record);
}

function strictSequenceHeaderV1(sequenceRoot: string, intentKind: string, bytes: Buffer): Readonly<Record<string, unknown>> {
  const pairValue = strictSequencePairV1(bytes, "sequenceIntentRef", "sequenceIntentHash", "setfarm://internal-production/baseline-restart-sequence-intent/sha256/", `${intentKind} sequence intent locator`);
  const record = strictSequenceContentV1(sequenceRoot, "sequence-intents", pairValue, "sequenceIntentRef", "sequenceIntentHash", "setfarm://internal-production/baseline-restart-sequence-intent/sha256/", ["schema", "intentKind", "migrationReceiptRef", "migrationReceiptHash", "migrationSchemaProjectionHash", "initialRuntimeSourceProjectionHash", "orderedServiceActions", "sequenceIntentRef", "sequenceIntentHash"], `${intentKind} sequence intent`);
  const services = Object.entries(BASELINE_SERVICE_ACTIONS_V1).map(([service, actionId]) => ({ service, actionId }));
  if (record.schema !== "setfarm.internal-production-baseline-restart-sequence-intent.v1" || record.intentKind !== intentKind || canonical(record.orderedServiceActions) !== canonical(services)) fail(`${intentKind} sequence intent semantics are crossed`);
  for (const key of ["migrationReceiptHash", "migrationSchemaProjectionHash", "initialRuntimeSourceProjectionHash"] as const) if (typeof record[key] !== "string" || !SHA256.test(record[key] as string)) fail(`${intentKind} sequence intent ${key} is invalid`);
  if (record.migrationReceiptRef !== `setfarm://internal-production/baseline-bootstrap-handoff-migration-receipt/sha256/${record.migrationReceiptHash}`) fail(`${intentKind} sequence migration pair is crossed`);
  return record;
}

function strictSequenceAdvanceV1(sequenceRoot: string, intentKind: string, ordinal: number, bytes: Buffer, header: Readonly<Record<string, unknown>>, predecessor: Readonly<Record<string, unknown>> | null): Readonly<Record<string, unknown>> {
  const pairValue = strictSequencePairV1(bytes, "advanceRef", "advanceHash", "setfarm://internal-production/baseline-service-restart-advance/sha256/", `${intentKind} advance locator ${ordinal}`);
  const record = strictSequenceContentV1(sequenceRoot, "advances", pairValue, "advanceRef", "advanceHash", "setfarm://internal-production/baseline-service-restart-advance/sha256/", ["schema", "intentKind", "sequenceIntentHash", "ordinal", "service", "actionId", "migrationReceiptRef", "migrationReceiptHash", "initialRuntimeSourceProjectionHash", "authorizationRef", "authorizationHash", "authorityRef", "authorityHash", "priorAdvanceHash", "beforeRuntimeSourceProjectionHash", "afterRuntimeSourceProjectionHash", "completeZeroOwnerCensusHash", "advanceRef", "advanceHash"], `${intentKind} advance ${ordinal}`);
  const fixed = Object.entries(BASELINE_SERVICE_ACTIONS_V1)[ordinal]!;
  if (record.schema !== "setfarm.internal-production-baseline-service-restart-advance.v1" || record.intentKind !== intentKind || record.ordinal !== ordinal || record.service !== fixed[0] || record.actionId !== fixed[1] || record.sequenceIntentHash !== header.sequenceIntentHash || record.migrationReceiptRef !== header.migrationReceiptRef || record.migrationReceiptHash !== header.migrationReceiptHash || record.initialRuntimeSourceProjectionHash !== header.initialRuntimeSourceProjectionHash || record.priorAdvanceHash !== (predecessor?.advanceHash ?? null) || (ordinal === 0 && record.beforeRuntimeSourceProjectionHash !== header.initialRuntimeSourceProjectionHash) || (predecessor && record.beforeRuntimeSourceProjectionHash !== predecessor.afterRuntimeSourceProjectionHash)) fail(`${intentKind} advance ${ordinal} semantics are crossed`);
  for (const key of ["authorizationHash", "authorityHash", "beforeRuntimeSourceProjectionHash", "afterRuntimeSourceProjectionHash", "completeZeroOwnerCensusHash"] as const) if (typeof record[key] !== "string" || !SHA256.test(record[key] as string)) fail(`${intentKind} advance ${ordinal} ${key} is invalid`);
  if (record.authorizationRef !== `${NORMAL_AUTHORIZATION_PREFIX}${record.authorizationHash}` || record.authorityRef !== `setfarm://internal-production/baseline/service-restarts/${record.authorityHash}`) fail(`${intentKind} advance ${ordinal} composite pair is crossed`);
  return record;
}

function strictSequenceBlockedV1(sequenceRoot: string, intentKind: string, ordinal: number, bytes: Buffer, header: Readonly<Record<string, unknown>>, authorization: Readonly<Record<string, unknown>> | null): Readonly<Record<string, unknown>> {
  const pairValue = strictSequencePairV1(bytes, "blockedRef", "blockedHash", "setfarm://internal-production/baseline-restart-sequence-blocked/sha256/", `${intentKind} blocked locator ${ordinal}`);
  const record = strictSequenceContentV1(sequenceRoot, "blocked", pairValue, "blockedRef", "blockedHash", "setfarm://internal-production/baseline-restart-sequence-blocked/sha256/", ["schema", "intentKind", "sequenceIntentHash", "ordinal", "authorizationRef", "authorizationHash", "reason", "blockedRef", "blockedHash"], `${intentKind} blocked ${ordinal}`);
  if (record.schema !== "setfarm.internal-production-baseline-restart-sequence-blocked.v1" || record.intentKind !== intentKind || record.sequenceIntentHash !== header.sequenceIntentHash || record.ordinal !== ordinal || record.reason !== "HELPER_DISPATCH_SETTLEMENT_UNKNOWN" || !authorization || record.authorizationRef !== authorization.authorizationRef || record.authorizationHash !== authorization.authorizationHash) fail(`${intentKind} blocked ${ordinal} semantics are crossed`);
  return record;
}

function strictSequenceReceiptV1(sequenceRoot: string, intentKind: string, bytes: Buffer, header: Readonly<Record<string, unknown>>, advances: readonly Readonly<Record<string, unknown>>[]): Readonly<Record<string, unknown>> {
  const pairValue = strictSequencePairV1(bytes, "sequenceRef", "sequenceHash", "setfarm://internal-production/baseline/restart-sequences/", `${intentKind} sequence receipt locator`);
  const record = strictSequenceContentV1(sequenceRoot, "receipts", pairValue, "sequenceRef", "sequenceHash", "setfarm://internal-production/baseline/restart-sequences/", ["schema", "intentKind", "sequenceIntentHash", "migrationReceiptRef", "migrationReceiptHash", "migrationSchemaProjectionHash", "initialRuntimeSourceProjectionHash", "orderedServices", "authorityPairs", "orderedAdvanceHashes", "finalRuntimeSourceProjectionHash", "finalCompleteZeroOwnerCensusHash", "sequenceRef", "sequenceHash"], `${intentKind} sequence receipt`);
  if (record.schema !== "setfarm.internal-production-baseline-restart-sequence-receipt.v1" || record.intentKind !== intentKind || record.sequenceIntentHash !== header.sequenceIntentHash || record.migrationReceiptRef !== header.migrationReceiptRef || record.migrationReceiptHash !== header.migrationReceiptHash || record.migrationSchemaProjectionHash !== header.migrationSchemaProjectionHash || record.initialRuntimeSourceProjectionHash !== header.initialRuntimeSourceProjectionHash || canonical(record.orderedServices) !== canonical(Object.keys(BASELINE_SERVICE_ACTIONS_V1)) || canonical(record.orderedAdvanceHashes) !== canonical(advances.map((advance) => advance.advanceHash)) || record.finalRuntimeSourceProjectionHash !== advances[2]?.afterRuntimeSourceProjectionHash || typeof record.finalCompleteZeroOwnerCensusHash !== "string" || !SHA256.test(record.finalCompleteZeroOwnerCensusHash) || !Array.isArray(record.authorityPairs) || canonical(record.authorityPairs) !== canonical(advances.map((advance) => ({ service: advance.service, actionId: advance.actionId, authorityRef: advance.authorityRef, authorityHash: advance.authorityHash })))) fail(`${intentKind} terminal sequence semantics are crossed`);
  return record;
}

async function observeEmptyBaselineNormalAuthoritySetV1(): Promise<Readonly<{
  pendingBaselineRestartCount: 0;
  liveBaselineRestartCount: 0;
  activeBaselineSequenceCount: 0;
  liveBaselineHelperCount: 0;
  retainedHistoricalAuthoritySetHash: string;
}>> {
  const sequenceRoot = path.join(repositoryRoot(), "data/internal-production-baseline/baseline-service-restart-sequence-v1");
  const retained: Array<Readonly<{ intentKind: string; sequenceRef: string; sequenceHash: string; sequenceReceiptSemanticHash: string }>> = [];
  let pendingBaselineRestartCount = 0;
  let liveBaselineRestartCount = 0;
  let activeBaselineSequenceCount = 0;
  let liveSequenceHelperCount = 0;
  for (const intentKind of ["live-rebind", "d-startup-hook-load", "documentation-rollback"] as const) {
    const intentDirectoryHash = sha256(canonical({ schema: "setfarm.internal-production-baseline-restart-sequence-intent.v1", intentKind }));
    const intentDirectory = path.join(sequenceRoot, "intents", intentDirectoryHash);
    const headerBytes = optionalRetirementBytesV1(path.join(intentDirectory, "sequence-intent.pair.json"), `${intentKind} sequence intent locator`);
    const receipt = optionalRetirementBytesV1(path.join(intentDirectory, "03-sequence-receipt.pair.json"), `${intentKind} sequence receipt locator`);
    const header = headerBytes ? strictSequenceHeaderV1(sequenceRoot, intentKind, headerBytes) : null;
    if (!header && receipt) fail("baseline sequence receipt exists without intent");
    if (header && !receipt) activeBaselineSequenceCount += 1;
    const advances: Array<Readonly<Record<string, unknown>>> = [];
    for (let ordinal = 0; ordinal < 3; ordinal += 1) {
      const index = String(ordinal).padStart(2, "0");
      const operationBytes = optionalRetirementBytesV1(path.join(intentDirectory, `${index}-service-operation.pair.json`), `${intentKind} operation locator ${ordinal}`);
      const authorizationBytes = optionalRetirementBytesV1(path.join(intentDirectory, `${index}-service-authorization.pair.json`), `${intentKind} authorization locator ${ordinal}`);
      const advanceBytes = optionalRetirementBytesV1(path.join(intentDirectory, `${index}-service-advance.pair.json`), `${intentKind} advance locator ${ordinal}`);
      const blockedBytes = optionalRetirementBytesV1(path.join(intentDirectory, `${index}-blocked.pair.json`), `${intentKind} blocked locator ${ordinal}`);
      const operation = operationBytes ? strictSequencePairV1(operationBytes, "receiptRef", "receiptHash", "setfarm://internal-production/baseline/service-restarts/", `${intentKind} operation locator ${ordinal}`) : null;
      const authorization = authorizationBytes ? strictSequencePairV1(authorizationBytes, "authorizationRef", "authorizationHash", NORMAL_AUTHORIZATION_PREFIX, `${intentKind} authorization locator ${ordinal}`) : null;
      const advance = advanceBytes && header ? strictSequenceAdvanceV1(sequenceRoot, intentKind, ordinal, advanceBytes, header, advances[ordinal - 1] ?? null) : null;
      if (advance) advances.push(advance);
      const blocked = blockedBytes && header ? strictSequenceBlockedV1(sequenceRoot, intentKind, ordinal, blockedBytes, header, authorization) : null;
      if ((authorization || operation || advance || blocked) && !header) fail("baseline sequence operation exists without intent");
      if ((advance || blocked) && !authorization) fail("baseline sequence advance exists without authorization");
      if (advance && operation && (operation.receiptRef !== advance.authorityRef || operation.receiptHash !== advance.authorityHash)) fail("baseline sequence operation locator is crossed with advance");
      if (advance && (authorization!.authorizationRef !== advance.authorizationRef || authorization!.authorizationHash !== advance.authorizationHash)) fail("baseline sequence authorization locator is crossed with advance");
      if ((authorization || operation) && !advance) pendingBaselineRestartCount += 1;
      if ((authorization || operation) && !advance) liveBaselineRestartCount += 1;
      if (blocked && !advance) liveSequenceHelperCount += 1;
      if (receipt && !advance) fail("completed baseline sequence has nonterminal operation evidence");
    }
    if (!header) continue;
    if (receipt) {
      if (advances.length !== 3) fail("completed baseline sequence lacks its exact three advances");
      const resolvedReceipt = strictSequenceReceiptV1(sequenceRoot, intentKind, receipt, header, advances);
      retained.push(Object.freeze({ intentKind, sequenceRef: resolvedReceipt.sequenceRef as string, sequenceHash: resolvedReceipt.sequenceHash as string, sequenceReceiptSemanticHash: sha256(canonical(resolvedReceipt)) }));
    }
  }
  const helperCensus = await observeInternalProductionBaselineServiceRestartHelperJournalCensusV1();
  if (helperCensus.registeredBaselineHelperJournalCount !== helperCensus.terminalBaselineHelperJournalCount || helperCensus.liveBaselineHelperJournalCount !== 0 || helperCensus.ambiguousBaselineHelperJournalCount !== 0) fail("baseline helper journal census is not terminal and unambiguous");
  const liveBaselineHelperCount = liveSequenceHelperCount + helperCensus.liveBaselineHelperJournalCount;
  if (pendingBaselineRestartCount !== 0 || liveBaselineRestartCount !== 0 || activeBaselineSequenceCount !== 0 || liveBaselineHelperCount !== 0) fail("baseline A normal restart authority set is not empty");
  return Object.freeze({ pendingBaselineRestartCount: 0, liveBaselineRestartCount: 0, activeBaselineSequenceCount: 0, liveBaselineHelperCount: 0, retainedHistoricalAuthoritySetHash: sha256(canonical({ completedSequences: retained, retainedHelperJournalSettlementSetHash: helperCensus.retainedHelperJournalSettlementSetHash })) });
}

function validateConsumptionV1(value: unknown, expected: Readonly<{ consumptionRef: string; consumptionHash: string }>, guard: Readonly<Record<string, unknown>>, operation: Readonly<Record<string, unknown>>): Readonly<Record<string, unknown>> {
  const record = exactFrozenObserverRecordV1(value, ["schema", "purpose", "zeroOwnerGuardRef", "zeroOwnerGuardHash", "completeZeroOwnerCensusObservationRef", "completeZeroOwnerCensusObservationHash", "baselineServiceRestartHelperJournalCensusHash", "operationRef", "operationHash", "guardConsumed", "consumptionRef", "consumptionHash"], "zero-owner guard consumption");
  const core = { ...record };
  delete core.consumptionRef;
  delete core.consumptionHash;
  if (record.schema !== "setfarm.internal-production-baseline-physical-service-restart-authority-cutover-zero-owner-guard-consumption.v1" || record.purpose !== "recovery-d-physical-service-restart-authority-cutover-v1" || record.guardConsumed !== true) fail("zero-owner guard consumption fixed authority is crossed");
  if (record.zeroOwnerGuardRef !== guard.zeroOwnerGuardRef || record.zeroOwnerGuardHash !== guard.zeroOwnerGuardHash || record.completeZeroOwnerCensusObservationRef !== guard.completeZeroOwnerCensusObservationRef || record.completeZeroOwnerCensusObservationHash !== guard.completeZeroOwnerCensusObservationHash || record.baselineServiceRestartHelperJournalCensusHash !== guard.baselineServiceRestartHelperJournalCensusHash) fail("zero-owner guard consumption guard authority is crossed");
  if (record.operationRef !== operation.operationRef || record.operationHash !== operation.operationHash) fail("zero-owner guard consumption operation authority is crossed");
  if (record.consumptionHash !== sha256(canonical(core))) fail("zero-owner guard consumption hash is crossed");
  if (record.consumptionRef !== `${CUTOVER_CONSUMPTION_PREFIX}${record.consumptionHash}` || record.consumptionRef !== expected.consumptionRef || record.consumptionHash !== expected.consumptionHash) fail("zero-owner guard consumption pair is crossed");
  return record;
}

function publishPendingInputV1(guard: Readonly<Record<string, unknown>>): Readonly<Record<string, unknown>> {
  const core = Object.freeze({ schema: "setfarm.internal-production-physical-service-restart-authority-cutover-pending-input.v1", purpose: "recovery-d-physical-service-restart-authority-cutover-v1", zeroOwnerGuardRef: guard.zeroOwnerGuardRef, zeroOwnerGuardHash: guard.zeroOwnerGuardHash, ownerAdmissionFenceRef: null, ownerAdmissionFenceHash: null });
  const pendingInputHash = sha256(canonical(core));
  const record = Object.freeze({ ...core, pendingInputRef: `${CUTOVER_PENDING_PREFIX}${pendingInputHash}`, pendingInputHash });
  writeNoReplace(cutoverPendingPathV1(), record);
  return resolvePendingInputV1();
}

function resolvePendingInputV1(): Readonly<Record<string, unknown>> {
  const bytes = readStableRetirementBytes(cutoverPendingPathV1(), "cutover pending input");
  let value: unknown;
  try { value = JSON.parse(bytes.toString("utf8")); } catch { return fail("cutover pending input is not JSON"); }
  const record = exactCanonicalRecord(value, ["schema", "purpose", "zeroOwnerGuardRef", "zeroOwnerGuardHash", "ownerAdmissionFenceRef", "ownerAdmissionFenceHash", "pendingInputRef", "pendingInputHash"], "cutover pending input");
  const core = { ...record };
  delete core.pendingInputRef;
  delete core.pendingInputHash;
  if (`${canonical(record)}\n` !== bytes.toString("utf8") || record.schema !== "setfarm.internal-production-physical-service-restart-authority-cutover-pending-input.v1" || record.purpose !== "recovery-d-physical-service-restart-authority-cutover-v1" || record.ownerAdmissionFenceRef !== null || record.ownerAdmissionFenceHash !== null || typeof record.zeroOwnerGuardHash !== "string" || !SHA256.test(record.zeroOwnerGuardHash) || record.zeroOwnerGuardRef !== `${CUTOVER_GUARD_PREFIX}${record.zeroOwnerGuardHash}` || record.pendingInputHash !== sha256(canonical(core)) || record.pendingInputRef !== `${CUTOVER_PENDING_PREFIX}${record.pendingInputHash}`) fail("cutover pending input is crossed");
  return Object.freeze(record);
}

function readCutoverPairV1(name: string, refKey: string, hashKey: string, prefix: string): Readonly<Record<string, string>> | null {
  const bytes = optionalRetirementBytesV1(cutoverLocatorV1(name), `${name} cutover locator`);
  if (!bytes) return null;
  let value: unknown;
  try { value = JSON.parse(bytes.toString("utf8")); } catch { return fail(`${name} cutover locator is not JSON`); }
  if (`${canonical(value)}\n` !== bytes.toString("utf8")) fail(`${name} cutover locator is not canonical`);
  const result = exactCanonicalRecord(value, [refKey, hashKey], `${name} cutover pair`) as Record<string, string>;
  if (typeof result[refKey] !== "string" || typeof result[hashKey] !== "string" || !SHA256.test(result[hashKey]!) || !PAIR_REF.test(result[refKey]!)) fail(`${name} cutover pair is invalid`);
  if (result[refKey] !== `${prefix}${result[hashKey]}`) fail(`${name} cutover locator prefix is invalid`);
  return result;
}

function readSharedGuardConsumptionPairV1(zeroOwnerGuardHash: string): Readonly<Record<string, string>> | null {
  if (!SHA256.test(zeroOwnerGuardHash)) fail("shared guard consumption index hash is invalid");
  const file = path.join(repositoryRoot(), "data/internal-production-baseline/zero-owner-mutation-guard-v1/consumed-guards/sha256", zeroOwnerGuardHash.slice(0, 2), `${zeroOwnerGuardHash}.json`);
  const bytes = optionalRetirementBytesV1(file, "shared guard consumption index");
  if (!bytes) return null;
  let value: unknown;
  try { value = JSON.parse(bytes.toString("utf8")); } catch { return fail("shared guard consumption index is not JSON"); }
  const record = exactCanonicalRecord(value, ["consumptionRef", "consumptionHash"], "shared guard consumption index");
  if (`${canonical(record)}\n` !== bytes.toString("utf8") || typeof record.consumptionHash !== "string" || !SHA256.test(record.consumptionHash) || record.consumptionRef !== `${CUTOVER_CONSUMPTION_PREFIX}${record.consumptionHash}`) fail("shared guard consumption index is crossed");
  return Object.freeze({ consumptionRef: record.consumptionRef as string, consumptionHash: record.consumptionHash });
}

function publishCutoverRecordV1(
  kind: string,
  body: Readonly<Record<string, unknown>>,
  refKey: string,
  hashKey: string,
  prefix: string,
): Readonly<Record<string, string>> {
  const hash = sha256(canonical(body));
  const ref = `${prefix}${hash}`;
  const value = Object.freeze({ ...body, [refKey]: ref, [hashKey]: hash });
  writeNoReplace(path.join(rootPaths().cutover, kind, "sha256", hash.slice(0, 2), `${hash}.json`), value);
  return Object.freeze({ [refKey]: ref, [hashKey]: hash });
}

function resolveCutoverRecordV1(
  kind: string,
  expected: Readonly<Record<string, string>>,
  refKey: string,
  hashKey: string,
  prefix: string,
): Readonly<Record<string, unknown>> {
  const hash = expected[hashKey]!;
  const bytes = readStableRetirementBytes(path.join(rootPaths().cutover, kind, "sha256", hash.slice(0, 2), `${hash}.json`), `${kind} cutover record`);
  let value: unknown;
  try { value = JSON.parse(bytes.toString("utf8")); } catch { return fail(`${kind} cutover record is not JSON`); }
  const record = value as Record<string, unknown>;
  const projection = { ...record };
  delete projection[refKey];
  delete projection[hashKey];
  if (`${canonical(record)}\n` !== bytes.toString("utf8") || record[refKey] !== `${prefix}${hash}` || record[hashKey] !== hash || expected[refKey] !== record[refKey] || sha256(canonical(projection)) !== hash) fail(`${kind} cutover record is crossed`);
  return Object.freeze(record);
}

export async function resolveInternalProductionPhysicalServiceRestartAuthorityCutoverOperationV1(input: Readonly<{ operationRef: string; operationHash: string }>): Promise<Readonly<Record<string, unknown>>> {
  const expected = pair(input, "operationRef", "operationHash");
  const record = resolveCutoverRecordV1("operations", expected, "operationRef", "operationHash", CUTOVER_OPERATION_PREFIX);
  exactCanonicalRecord(record, ["schema", "pendingInputRef", "pendingInputHash", "ownerAdmissionFenceRef", "ownerAdmissionFenceHash", "predecessorPhysicalRestartEpochRef", "predecessorPhysicalRestartEpochHash", "predecessorPhysicalRestartEpochOrdinal", "zeroOwnerGuardRef", "zeroOwnerGuardHash", "codeOwnedHookObservationHash", "operationRef", "operationHash"], "cutover operation");
  const pending = resolvePendingInputV1();
  const fixed = fixedCutoverPrefixV1();
  if (!fixed.fence || !fixed.operation || fixed.operation.operationRef !== record.operationRef || fixed.operation.operationHash !== record.operationHash || record.schema !== "setfarm.internal-production-physical-service-restart-authority-cutover-operation.v1" || record.pendingInputRef !== pending.pendingInputRef || record.pendingInputHash !== pending.pendingInputHash || record.ownerAdmissionFenceRef !== fixed.fence.fenceRef || record.ownerAdmissionFenceHash !== fixed.fence.fenceHash || record.predecessorPhysicalRestartEpochOrdinal !== 1 || typeof record.predecessorPhysicalRestartEpochHash !== "string" || !SHA256.test(record.predecessorPhysicalRestartEpochHash) || record.predecessorPhysicalRestartEpochRef !== `setfarm://internal-production/physical-service-restart-authority-epoch/sha256/${record.predecessorPhysicalRestartEpochHash}` || record.zeroOwnerGuardRef !== pending.zeroOwnerGuardRef || record.zeroOwnerGuardHash !== pending.zeroOwnerGuardHash || typeof record.codeOwnedHookObservationHash !== "string" || !SHA256.test(record.codeOwnedHookObservationHash)) fail("cutover operation causal authority is crossed");
  return Object.freeze({ schema: record.schema, pendingInputRef: record.pendingInputRef, pendingInputHash: record.pendingInputHash, ownerAdmissionFenceRef: record.ownerAdmissionFenceRef, ownerAdmissionFenceHash: record.ownerAdmissionFenceHash, predecessorPhysicalRestartEpochRef: record.predecessorPhysicalRestartEpochRef, predecessorPhysicalRestartEpochHash: record.predecessorPhysicalRestartEpochHash, predecessorPhysicalRestartEpochOrdinal: record.predecessorPhysicalRestartEpochOrdinal, zeroOwnerGuardRef: record.zeroOwnerGuardRef, zeroOwnerGuardHash: record.zeroOwnerGuardHash, codeOwnedHookObservationHash: record.codeOwnedHookObservationHash, operationRef: record.operationRef, operationHash: record.operationHash });
}

export async function resolveInternalProductionServiceRestartStartupHooksReadyV1(input: Readonly<{ startupHooksReadyRef: string; startupHooksReadyHash: string }>): Promise<Readonly<Record<string, unknown>>> {
  const expected = pair(input, "startupHooksReadyRef", "startupHooksReadyHash");
  const record = resolveCutoverRecordV1("startup-hooks-ready", expected, "startupHooksReadyRef", "startupHooksReadyHash", "setfarm://internal-production/physical-service-restart-startup-hooks-ready/sha256/");
  exactCanonicalRecord(record, ["schema", "setfarmSourceSha", "missionControlSourceSha", "setfarmBuildHash", "missionControlBuildHash", "migrationReceiptRef", "migrationReceiptHash", "migrationSourceSha", "migrationImplementationBlobHash", "orderedStatementsHash", "namedMigrationDigestEntryHash", "migrationDigest", "schemaProjectionHash", "physicalRestartEpochRef", "physicalRestartEpochHash", "physicalRestartEpochOrdinal", "physicalRestartAuthorityOwner", "dForwardIdentityRegistryHash", "dForwardImplementationIdentities", "spawnerHookImplementationId", "spawnerHookImplementationHash", "dashboardHookImplementationId", "dashboardHookImplementationHash", "missionControlHookImplementationId", "missionControlHookImplementationHash", "runtimeSourceProjectionHash", "recoveryPrepareState", "startupHooksReadyRef", "startupHooksReadyHash"], "startup hooks ready authority");
  const prefix = fixedCutoverPrefixV1();
  if (!prefix.startup || !prefix.operation || prefix.startup.startupHooksReadyRef !== record.startupHooksReadyRef || prefix.startup.startupHooksReadyHash !== record.startupHooksReadyHash || record.schema !== "setfarm.internal-production-service-restart-startup-hooks-ready.v1" || record.physicalRestartEpochOrdinal !== 1 || record.physicalRestartAuthorityOwner !== "baseline-a" || record.recoveryPrepareState !== "disabled-by-baseline-epoch-one") fail("startup hooks ready authority is crossed");
  const operation = resolveCutoverRecordV1("operations", prefix.operation, "operationRef", "operationHash", CUTOVER_OPERATION_PREFIX);
  if (operation.codeOwnedHookObservationHash !== record.startupHooksReadyHash || record.physicalRestartEpochRef !== operation.predecessorPhysicalRestartEpochRef || record.physicalRestartEpochHash !== operation.predecessorPhysicalRestartEpochHash) fail("startup hooks ready operation authority is crossed");
  return record;
}

async function authenticateFixedGuardConsumptionV1(): Promise<Readonly<Record<string, unknown>>> {
  const prefix = fixedCutoverPrefixV1();
  if (!prefix.operation || !prefix.consumption) fail("guard consumption fixed prefix is incomplete");
  const operation = await resolveInternalProductionPhysicalServiceRestartAuthorityCutoverOperationV1({ operationRef: prefix.operation.operationRef!, operationHash: prefix.operation.operationHash! });
  const ports = await guardPortsV1();
  const guardPair = { zeroOwnerGuardRef: operation.zeroOwnerGuardRef as string, zeroOwnerGuardHash: operation.zeroOwnerGuardHash as string };
  const guard = validateZeroOwnerGuardV1(await ports.resolveGuard(guardPair), guardPair);
  const consumptionPair = prefix.consumption as unknown as Readonly<{ consumptionRef: string; consumptionHash: string }>;
  const consumption = validateConsumptionV1(await ports.resolveConsumption(consumptionPair), consumptionPair, guard, operation);
  validateCompleteZeroOwnerCensusV1(await ports.resolveCompleteZero({ observationRef: guard.completeZeroOwnerCensusObservationRef as string, observationHash: guard.completeZeroOwnerCensusObservationHash as string }), { observationRef: guard.completeZeroOwnerCensusObservationRef as string, observationHash: guard.completeZeroOwnerCensusObservationHash as string });
  const helperCensus = await observeInternalProductionBaselineServiceRestartHelperJournalCensusV1();
  if (helperCensus.registeredBaselineHelperJournalCount !== helperCensus.terminalBaselineHelperJournalCount || helperCensus.liveBaselineHelperJournalCount !== 0 || helperCensus.ambiguousBaselineHelperJournalCount !== 0 || helperCensus.censusHash !== guard.baselineServiceRestartHelperJournalCensusHash) fail("guard helper journal census authority changed");
  return consumption;
}

export async function resolveInternalProductionBaselineRestartAuthorityRetirementV1(input: Readonly<{ retirementRef: string; retirementHash: string }>): Promise<Readonly<Record<string, unknown>>> {
  const expected = pair(input, "retirementRef", "retirementHash");
  const record = resolveCutoverRecordV1("retirements", expected, "retirementRef", "retirementHash", "setfarm://internal-production/physical-service-restart-authority-retirement/sha256/");
  exactCanonicalRecord(record, ["schema", "disposition", "predecessorEpochRef", "predecessorEpochHash", "successorEpochOrdinal", "successorAuthorityOwner", "startupHooksReadyRef", "startupHooksReadyHash", "successorActivationRef", "successorActivationHash", "zeroOwnerGuardRef", "zeroOwnerGuardHash", "zeroOwnerGuardConsumptionRef", "zeroOwnerGuardConsumptionHash", "completeZeroOwnerCensusHash", "services", "pendingBaselineRestartCount", "liveBaselineRestartCount", "activeBaselineSequenceCount", "liveBaselineHelperCount", "retainedHistoricalAuthoritySetHash", "retirementRef", "retirementHash"], "baseline restart authority retirement");
  const consumption = await authenticateFixedGuardConsumptionV1();
  const prefix = fixedCutoverPrefixV1();
  const epoch = assertEpochTwoActive();
  const freshRetainedAuthoritySet = await observeEmptyBaselineNormalAuthoritySetV1();
  if (epoch.retirementRef !== record.retirementRef || epoch.retirementHash !== record.retirementHash) fail("baseline retirement is not terminally visible");
  const operation = prefix.operation ? resolveCutoverRecordV1("operations", prefix.operation, "operationRef", "operationHash", CUTOVER_OPERATION_PREFIX) : fail("baseline retirement operation is absent");
  if (record.schema !== "setfarm.internal-production-baseline-restart-authority-retirement.v1" || record.disposition !== "retired-to-recovery-d" || record.predecessorEpochRef !== operation.predecessorPhysicalRestartEpochRef || record.predecessorEpochHash !== operation.predecessorPhysicalRestartEpochHash || record.successorEpochOrdinal !== 2 || record.successorAuthorityOwner !== "recovery-d" || record.startupHooksReadyRef !== prefix.startup?.startupHooksReadyRef || record.startupHooksReadyHash !== prefix.startup?.startupHooksReadyHash || record.successorActivationRef !== prefix.activation?.activationRef || record.successorActivationHash !== prefix.activation?.activationHash || record.zeroOwnerGuardRef !== operation.zeroOwnerGuardRef || record.zeroOwnerGuardHash !== operation.zeroOwnerGuardHash || canonical(record.services) !== canonical(["setfarm-spawner", "setfarm-dashboard", "mission-control"]) || record.zeroOwnerGuardConsumptionRef !== consumption.consumptionRef || record.zeroOwnerGuardConsumptionHash !== consumption.consumptionHash || record.completeZeroOwnerCensusHash !== consumption.completeZeroOwnerCensusObservationHash || record.pendingBaselineRestartCount !== freshRetainedAuthoritySet.pendingBaselineRestartCount || record.liveBaselineRestartCount !== freshRetainedAuthoritySet.liveBaselineRestartCount || record.activeBaselineSequenceCount !== freshRetainedAuthoritySet.activeBaselineSequenceCount || record.liveBaselineHelperCount !== freshRetainedAuthoritySet.liveBaselineHelperCount || record.retainedHistoricalAuthoritySetHash !== freshRetainedAuthoritySet.retainedHistoricalAuthoritySetHash) fail("baseline restart authority retirement is crossed");
  return record;
}

export async function resolveInternalProductionServiceRestartAuthorityActivationV1(input: Readonly<{ activationRef: string; activationHash: string }>): Promise<Readonly<Record<string, unknown>>> {
  const expected = pair(input, "activationRef", "activationHash");
  const record = resolveCutoverRecordV1("activations", expected, "activationRef", "activationHash", "setfarm://internal-production/physical-service-restart-authority-activation/sha256/");
  exactCanonicalRecord(record, ["schema", "startupHooksReadyRef", "startupHooksReadyHash", "predecessorPhysicalRestartEpochRef", "predecessorPhysicalRestartEpochHash", "predecessorPhysicalRestartEpochOrdinal", "predecessorPhysicalRestartAuthorityOwner", "successorPhysicalRestartEpochOrdinal", "successorPhysicalRestartAuthorityOwner", "services", "activationRef", "activationHash"], "service restart authority activation");
  const prefix = fixedCutoverPrefixV1();
  const epoch = assertEpochTwoActive();
  if (epoch.successorActivationRef !== record.activationRef || epoch.successorActivationHash !== record.activationHash) fail("service restart activation is not terminally visible");
  const operation = prefix.operation ? resolveCutoverRecordV1("operations", prefix.operation, "operationRef", "operationHash", CUTOVER_OPERATION_PREFIX) : fail("activation operation is absent");
  if (record.schema !== "setfarm.internal-production-service-restart-authority-activation.v1" || record.startupHooksReadyRef !== prefix.startup?.startupHooksReadyRef || record.startupHooksReadyHash !== prefix.startup?.startupHooksReadyHash || record.predecessorPhysicalRestartEpochRef !== operation.predecessorPhysicalRestartEpochRef || record.predecessorPhysicalRestartEpochHash !== operation.predecessorPhysicalRestartEpochHash || record.predecessorPhysicalRestartEpochOrdinal !== 1 || record.predecessorPhysicalRestartAuthorityOwner !== "baseline-a" || record.successorPhysicalRestartEpochOrdinal !== 2 || record.successorPhysicalRestartAuthorityOwner !== "recovery-d" || canonical(record.services) !== canonical(["setfarm-spawner", "setfarm-dashboard", "mission-control"])) fail("service restart authority activation is crossed");
  return record;
}

export async function resolveInternalProductionServiceRestartAuthorityCutoverV1(input: Readonly<{ cutoverRef: string; cutoverHash: string }>): Promise<Readonly<Record<string, unknown>>> {
  const expected = pair(input, "cutoverRef", "cutoverHash");
  const record = resolveCutoverRecordV1("cutovers", expected, "cutoverRef", "cutoverHash", "setfarm://internal-production/physical-service-restart-authority-cutover/sha256/");
  exactCanonicalRecord(record, ["schema", "startupHooksReadyRef", "startupHooksReadyHash", "zeroOwnerGuardRef", "zeroOwnerGuardHash", "zeroOwnerGuardConsumptionRef", "zeroOwnerGuardConsumptionHash", "ownerAdmissionFenceRef", "ownerAdmissionFenceHash", "predecessorPhysicalRestartEpochRef", "predecessorPhysicalRestartEpochHash", "predecessorPhysicalRestartEpochOrdinal", "baselineRetirementRef", "baselineRetirementHash", "activationRef", "activationHash", "successorPhysicalRestartEpochRef", "successorPhysicalRestartEpochHash", "successorPhysicalRestartEpochOrdinal", "cutoverRef", "cutoverHash"], "service restart authority cutover");
  const consumption = await authenticateFixedGuardConsumptionV1();
  const prefix = fixedCutoverPrefixV1();
  assertEpochTwoActive();
  if (prefix.cutover?.cutoverRef !== record.cutoverRef || prefix.cutover?.cutoverHash !== record.cutoverHash || !prefix.release) fail("service restart cutover is not terminally visible");
  if (record.schema !== "setfarm.internal-production-service-restart-authority-cutover.v1" || record.zeroOwnerGuardConsumptionRef !== consumption.consumptionRef || record.zeroOwnerGuardConsumptionHash !== consumption.consumptionHash || record.ownerAdmissionFenceRef !== prefix.fence?.fenceRef || record.ownerAdmissionFenceHash !== prefix.fence?.fenceHash || record.baselineRetirementRef !== prefix.retirement?.retirementRef || record.baselineRetirementHash !== prefix.retirement?.retirementHash || record.activationRef !== prefix.activation?.activationRef || record.activationHash !== prefix.activation?.activationHash || record.successorPhysicalRestartEpochRef !== prefix.successor?.successorEpochRef || record.successorPhysicalRestartEpochHash !== prefix.successor?.successorEpochHash || record.predecessorPhysicalRestartEpochOrdinal !== 1 || record.successorPhysicalRestartEpochOrdinal !== 2) fail("service restart authority cutover is crossed");
  return record;
}

function fixedCutoverPrefixV1() {
  return Object.freeze({
    fence: readCutoverPairV1("00-owner-admission-fence", "fenceRef", "fenceHash", GLOBAL_FENCE_PREFIX),
    operation: readCutoverPairV1("01-active-operation", "operationRef", "operationHash", CUTOVER_OPERATION_PREFIX),
    consumption: readCutoverPairV1("02-guard-consumption", "consumptionRef", "consumptionHash", CUTOVER_CONSUMPTION_PREFIX),
    startup: readCutoverPairV1("03-startup-hooks-ready", "startupHooksReadyRef", "startupHooksReadyHash", "setfarm://internal-production/physical-service-restart-startup-hooks-ready/sha256/"),
    retirement: readCutoverPairV1("04-retirement", "retirementRef", "retirementHash", "setfarm://internal-production/physical-service-restart-authority-retirement/sha256/"),
    activation: readCutoverPairV1("05-activation", "activationRef", "activationHash", "setfarm://internal-production/physical-service-restart-authority-activation/sha256/"),
    successor: readCutoverPairV1("06-successor-epoch", "successorEpochRef", "successorEpochHash", "setfarm://internal-production/physical-service-restart-authority-epoch/sha256/"),
    cutover: readCutoverPairV1("07-cutover", "cutoverRef", "cutoverHash", "setfarm://internal-production/physical-service-restart-authority-cutover/sha256/"),
    release: readCutoverPairV1("08-fence-release", "releaseRef", "releaseHash", GLOBAL_FENCE_RELEASE_PREFIX),
  });
}

function assertContiguousCutoverPrefixV1(prefix: ReturnType<typeof fixedCutoverPrefixV1>): void {
  const ordered = [prefix.fence, prefix.operation, prefix.consumption, prefix.startup, prefix.retirement, prefix.activation, prefix.successor, prefix.cutover, prefix.release];
  const firstMissing = ordered.findIndex((member) => member === null);
  if (firstMissing >= 0 && ordered.slice(firstMissing + 1).some((member) => member !== null)) fail("cutover prefix has a gap");
}

function assertOperationV1(operation: Readonly<Record<string, unknown>>, pending: Readonly<Record<string, unknown>>, fence: Readonly<Record<string, unknown>>, epoch: Readonly<Record<string, unknown>>): void {
  const keys = ["schema", "pendingInputRef", "pendingInputHash", "ownerAdmissionFenceRef", "ownerAdmissionFenceHash", "predecessorPhysicalRestartEpochRef", "predecessorPhysicalRestartEpochHash", "predecessorPhysicalRestartEpochOrdinal", "zeroOwnerGuardRef", "zeroOwnerGuardHash", "codeOwnedHookObservationHash", "operationRef", "operationHash"];
  exactCanonicalRecord(operation, keys, "cutover operation");
  if (operation.schema !== "setfarm.internal-production-physical-service-restart-authority-cutover-operation.v1" || operation.pendingInputRef !== pending.pendingInputRef || operation.pendingInputHash !== pending.pendingInputHash || operation.ownerAdmissionFenceRef !== fence.fenceRef || operation.ownerAdmissionFenceHash !== fence.fenceHash || operation.predecessorPhysicalRestartEpochRef !== epoch.epochRef || operation.predecessorPhysicalRestartEpochHash !== epoch.epochHash || operation.predecessorPhysicalRestartEpochOrdinal !== 1 || operation.zeroOwnerGuardRef !== pending.zeroOwnerGuardRef || operation.zeroOwnerGuardHash !== pending.zeroOwnerGuardHash || typeof operation.codeOwnedHookObservationHash !== "string" || !SHA256.test(operation.codeOwnedHookObservationHash as string)) fail("cutover operation causal authority is crossed");
}

function assertCutoverTerminalChainV1(epoch: Readonly<Record<string, unknown>>, requireRelease = true): void {
  const pending = resolvePendingInputV1();
  const prefix = fixedCutoverPrefixV1();
  assertContiguousCutoverPrefixV1(prefix);
  if (!prefix.fence || !prefix.operation || !prefix.consumption || !prefix.startup || !prefix.retirement || !prefix.activation || !prefix.successor || !prefix.cutover || (requireRelease && !prefix.release)) fail("cutover terminal prefix is incomplete");
  const operation = resolveCutoverRecordV1("operations", prefix.operation, "operationRef", "operationHash", CUTOVER_OPERATION_PREFIX);
  const startup = resolveCutoverRecordV1("startup-hooks-ready", prefix.startup, "startupHooksReadyRef", "startupHooksReadyHash", "setfarm://internal-production/physical-service-restart-startup-hooks-ready/sha256/");
  const retirement = resolveCutoverRecordV1("retirements", prefix.retirement, "retirementRef", "retirementHash", "setfarm://internal-production/physical-service-restart-authority-retirement/sha256/");
  const activation = resolveCutoverRecordV1("activations", prefix.activation, "activationRef", "activationHash", "setfarm://internal-production/physical-service-restart-authority-activation/sha256/");
  const cutover = resolveCutoverRecordV1("cutovers", prefix.cutover, "cutoverRef", "cutoverHash", "setfarm://internal-production/physical-service-restart-authority-cutover/sha256/");
  if (operation.pendingInputRef !== pending.pendingInputRef || operation.pendingInputHash !== pending.pendingInputHash || operation.ownerAdmissionFenceRef !== prefix.fence.fenceRef || operation.ownerAdmissionFenceHash !== prefix.fence.fenceHash || startup.physicalRestartEpochRef !== operation.predecessorPhysicalRestartEpochRef || startup.physicalRestartEpochHash !== operation.predecessorPhysicalRestartEpochHash || retirement.disposition !== "retired-to-recovery-d" || retirement.predecessorEpochRef !== operation.predecessorPhysicalRestartEpochRef || retirement.predecessorEpochHash !== operation.predecessorPhysicalRestartEpochHash || retirement.startupHooksReadyRef !== prefix.startup.startupHooksReadyRef || retirement.startupHooksReadyHash !== prefix.startup.startupHooksReadyHash || retirement.zeroOwnerGuardConsumptionRef !== prefix.consumption.consumptionRef || retirement.zeroOwnerGuardConsumptionHash !== prefix.consumption.consumptionHash || activation.startupHooksReadyRef !== prefix.startup.startupHooksReadyRef || activation.startupHooksReadyHash !== prefix.startup.startupHooksReadyHash || prefix.successor.successorEpochRef !== epoch.epochRef || prefix.successor.successorEpochHash !== epoch.epochHash || cutover.zeroOwnerGuardConsumptionRef !== prefix.consumption.consumptionRef || cutover.zeroOwnerGuardConsumptionHash !== prefix.consumption.consumptionHash || cutover.ownerAdmissionFenceRef !== prefix.fence.fenceRef || cutover.ownerAdmissionFenceHash !== prefix.fence.fenceHash || cutover.baselineRetirementRef !== prefix.retirement.retirementRef || cutover.baselineRetirementHash !== prefix.retirement.retirementHash || cutover.activationRef !== prefix.activation.activationRef || cutover.activationHash !== prefix.activation.activationHash || cutover.successorPhysicalRestartEpochRef !== prefix.successor.successorEpochRef || cutover.successorPhysicalRestartEpochHash !== prefix.successor.successorEpochHash) fail("cutover terminal chain is crossed");
}

function replaceEpochHeadV1(value: Readonly<Record<string, unknown>>): void {
  const target = rootPaths().epoch;
  const guard = ensurePrivateAuthorityDirectoryV1(path.dirname(target));
  const temporary = path.join(path.dirname(target), `.epoch-head.json.${randomBytes(16).toString("hex")}.tmp`);
  const bytes = Buffer.from(`${canonical(value)}\n`, "utf8");
  let pinned: ReturnType<typeof pinStableCasPredecessorV1> | null = null;
  try {
    const predecessor = assertEpochOneActive();
    if (value.predecessorEpochRef !== predecessor.epochRef || value.predecessorEpochHash !== predecessor.epochHash) fail("replacement restart epoch predecessor is stale");
    guard.assertStable();
    pinned = pinStableCasPredecessorV1(target, "restart epoch CAS predecessor");
    if (!pinned.bytes.equals(Buffer.from(`${canonical(predecessor)}\n`, "utf8"))) fail("restart epoch pinned predecessor differs");
    const descriptor = openSync(temporary, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
    try { writeFileSync(descriptor, bytes); fsyncSync(descriptor); } finally { closeSync(descriptor); }
    guard.assertStable();
    const current = assertEpochOneActive();
    if (current.epochRef !== predecessor.epochRef || current.epochHash !== predecessor.epochHash) fail("restart epoch changed before visibility CAS");
    pinned.assertStable();
    guard.assertStable();
    pinned.assertStable();
    renameSync(temporary, target);
    fsyncParent(target);
    if (!readStableRetirementBytes(target, "replacement restart epoch").equals(bytes)) fail("replacement restart epoch differs");
    guard.assertStable();
  } finally {
    pinned?.close();
    try { unlinkSync(temporary); } catch (error) { if (!(error instanceof Error) || !("code" in error) || error.code !== "ENOENT") throw error; }
    try { guard.assertStable(); } finally { guard.close(); }
  }
}

function currentEpochOrdinalV1(): 1 | 2 {
  const bytes = readStableRetirementBytes(rootPaths().epoch, "restart epoch ordinal");
  let value: unknown;
  try { value = JSON.parse(bytes.toString("utf8")); } catch { return fail("restart epoch is not JSON"); }
  if (!value || typeof value !== "object" || Array.isArray(value)) fail("restart epoch shape is invalid");
  const ordinal = (value as Record<string, unknown>).epochOrdinal;
  if (ordinal !== 1 && ordinal !== 2) fail("restart epoch ordinal is invalid");
  return ordinal;
}

async function publishFenceReleaseAfterCutoverV1(fencePorts: FencePortsV1, fence: Readonly<Record<string, unknown>>, cutover: Readonly<Record<string, string>>): Promise<Readonly<Record<string, string>>> {
  const existing = readCutoverPairV1("08-fence-release", "releaseRef", "releaseHash", GLOBAL_FENCE_RELEASE_PREFIX);
  if (existing) {
    const resolved = await fencePorts.resolveRelease(existing as unknown as Readonly<{ releaseRef: string; releaseHash: string }>);
    if (!resolved || typeof resolved !== "object" || (resolved as Record<string, unknown>).fenceRef !== fence.fenceRef || (resolved as Record<string, unknown>).fenceHash !== fence.fenceHash) fail("global owner-admission fence release is crossed");
    return existing;
  }
  const releaseAuthority = Object.freeze({ purpose: "recovery-d-physical-service-restart-authority-cutover-v1", targetFamilyKind: "none", terminalCoreRef: null, terminalCoreHash: null, targetSetCloseRef: null, targetSetCloseHash: null, occurrenceRef: null, occurrenceHash: null, headRef: null, headHash: null, targetReservationPairCloseRef: null, targetReservationPairCloseHash: null, purposeTerminalKind: "recovery-d-physical-service-restart-authority-cutover-terminal", purposeTerminalRef: cutover.cutoverRef, purposeTerminalHash: cutover.cutoverHash });
  const released = exactOwnRecord(await fencePorts.releaseFence({ fenceRef: fence.fenceRef, fenceHash: fence.fenceHash, releaseAuthority }), ["schema", "fenceRef", "fenceHash", "releaseAuthority", "ownerAdmissionHeadPredecessorHash", "ownerAdmissionHeadSuccessorHash", "releaseRef", "releaseHash"], "global owner-admission fence release");
  if (typeof released.releaseRef !== "string" || typeof released.releaseHash !== "string" || !SHA256.test(released.releaseHash)) fail("global owner-admission fence release pair is invalid");
  const releasePair = Object.freeze({ releaseRef: released.releaseRef, releaseHash: released.releaseHash }) as Readonly<Record<string, string>>;
  const resolvedRelease = await fencePorts.resolveRelease(releasePair as unknown as Readonly<{ releaseRef: string; releaseHash: string }>);
  if (canonical(resolvedRelease) !== canonical(released) || releasePair.releaseRef !== `${GLOBAL_FENCE_RELEASE_PREFIX}${releasePair.releaseHash}`) fail("global owner-admission fence release is crossed");
  writeNoReplace(cutoverLocatorV1("08-fence-release"), releasePair);
  return releasePair;
}

export async function prepareInternalProductionPhysicalServiceRestartAuthorityCutoverToRecoveryDV1(
  input: Readonly<{ zeroOwnerGuardRef: string; zeroOwnerGuardHash: string }>,
): Promise<Readonly<{ operationRef: string; operationHash: string }>> {
  const exact = exactOwnRecord(input, ["zeroOwnerGuardRef", "zeroOwnerGuardHash"], "cutover prepare input");
  const zeroOwnerGuard = pair(exact, "zeroOwnerGuardRef", "zeroOwnerGuardHash");
  if (zeroOwnerGuard.zeroOwnerGuardRef !== `${CUTOVER_GUARD_PREFIX}${zeroOwnerGuard.zeroOwnerGuardHash}`) fail("cutover zero-owner guard prefix is invalid");
  const readiness = await observeCompleteCodeOwnedCutoverReadinessV1();
  const guardPorts = await guardPortsV1();
  const fencePorts = await fencePortsV1();
  const guardPair = zeroOwnerGuard as unknown as Readonly<{ zeroOwnerGuardRef: string; zeroOwnerGuardHash: string }>;
  const guard = validateZeroOwnerGuardV1(await guardPorts.resolveGuard(guardPair), guardPair);
  validateCompleteZeroOwnerCensusV1(await guardPorts.resolveCompleteZero({ observationRef: guard.completeZeroOwnerCensusObservationRef as string, observationHash: guard.completeZeroOwnerCensusObservationHash as string }), { observationRef: guard.completeZeroOwnerCensusObservationRef as string, observationHash: guard.completeZeroOwnerCensusObservationHash as string });
  const lease = await acquireInternalProductionPhysicalServiceRestartAuthorityTransitionLeaseV1();
  try {
    const epoch = assertEpochOneActive();
    const lockedReadiness = await observeCompleteCodeOwnedCutoverReadinessV1();
    if (canonical(lockedReadiness) !== canonical(readiness)) fail("cutover readiness changed before pending mutation");
    const helperCensus = await observeInternalProductionBaselineServiceRestartHelperJournalCensusV1();
    if (helperCensus.registeredBaselineHelperJournalCount !== helperCensus.terminalBaselineHelperJournalCount || helperCensus.liveBaselineHelperJournalCount !== 0 || helperCensus.ambiguousBaselineHelperJournalCount !== 0 || helperCensus.censusHash !== guard.baselineServiceRestartHelperJournalCensusHash) fail("cutover guard helper journal census is stale or nonterminal");
    await observeEmptyBaselineNormalAuthoritySetV1();
    const pending = publishPendingInputV1(guard);
    let fencePair = readCutoverPairV1("00-owner-admission-fence", "fenceRef", "fenceHash", GLOBAL_FENCE_PREFIX);
    let fence: Readonly<Record<string, unknown>>;
    if (!fencePair) {
      fence = validateFenceV1(await fencePorts.acquireFence({ purpose: "recovery-d-physical-service-restart-authority-cutover-v1", pendingInputRef: pending.pendingInputRef, pendingInputHash: pending.pendingInputHash, targetFamily: null }), pending as Readonly<{ pendingInputRef: string; pendingInputHash: string }>);
      fencePair = Object.freeze({ fenceRef: fence.fenceRef as string, fenceHash: fence.fenceHash as string });
      writeNoReplace(cutoverLocatorV1("00-owner-admission-fence"), fencePair);
    } else {
      fence = validateFenceV1(await fencePorts.reobserveFence(fencePair as unknown as Readonly<{ fenceRef: string; fenceHash: string }>), pending as Readonly<{ pendingInputRef: string; pendingInputHash: string }>);
    }
    await reobserveExactFenceV1(fencePorts, fence, pending as Readonly<{ pendingInputRef: string; pendingInputHash: string }>);
    await observeEmptyBaselineNormalAuthoritySetV1();
    const body = Object.freeze({
      schema: "setfarm.internal-production-physical-service-restart-authority-cutover-operation.v1",
      pendingInputRef: pending.pendingInputRef,
      pendingInputHash: pending.pendingInputHash,
      ownerAdmissionFenceRef: fence.fenceRef,
      ownerAdmissionFenceHash: fence.fenceHash,
      predecessorPhysicalRestartEpochRef: epoch.epochRef,
      predecessorPhysicalRestartEpochHash: epoch.epochHash,
      predecessorPhysicalRestartEpochOrdinal: 1,
      zeroOwnerGuardRef: zeroOwnerGuard.zeroOwnerGuardRef,
      zeroOwnerGuardHash: zeroOwnerGuard.zeroOwnerGuardHash,
      codeOwnedHookObservationHash: sha256(canonical(readiness)),
    });
    const operation = publishCutoverRecordV1("operations", body, "operationRef", "operationHash", "setfarm://internal-production/physical-service-restart-authority-cutover-operation/sha256/");
    writeNoReplace(cutoverLocatorV1("01-active-operation"), operation);
    assertOperationV1(resolveCutoverRecordV1("operations", operation, "operationRef", "operationHash", CUTOVER_OPERATION_PREFIX), pending, fence, epoch);
    return Object.freeze({ operationRef: operation.operationRef!, operationHash: operation.operationHash! });
  } finally {
    await releaseInternalProductionPhysicalServiceRestartAuthorityTransitionLeaseV1(lease);
  }
}

function cutoverStatusV1(body: Omit<CutoverStatusShapeV1, "schema" | "statusHash">): InternalProductionPhysicalServiceRestartAuthorityCutoverStatusV1 {
  const projection = Object.freeze({ schema: "setfarm.internal-production-physical-service-restart-authority-cutover-status.v1" as const, ...body });
  return Object.freeze({ ...projection, statusHash: sha256(canonical(projection)) }) as unknown as InternalProductionPhysicalServiceRestartAuthorityCutoverStatusV1;
}

export async function observeInternalProductionPhysicalServiceRestartAuthorityCutoverStatusV1(): Promise<InternalProductionPhysicalServiceRestartAuthorityCutoverStatusV1> {
  let pending: Readonly<Record<string, unknown>> | null = null;
  try { pending = resolvePendingInputV1(); } catch (error) { if (!(error instanceof Error) || !("code" in error) || error.code !== "ENOENT") throw error; }
  const prefix = fixedCutoverPrefixV1();
  if (!pending) {
    if (Object.values(prefix).some((value) => value !== null)) fail("cutover material exists without pending input");
    assertEpochOneActive();
    return cutoverStatusV1({ state: "baseline-a-active", pendingInputRef: null, pendingInputHash: null, ownerAdmissionFenceRef: null, ownerAdmissionFenceHash: null, ownerAdmissionFenceReleaseRef: null, ownerAdmissionFenceReleaseHash: null, operationRef: null, operationHash: null, guardConsumed: false, physicalRestartEpochOrdinal: 1, physicalRestartAuthorityOwner: "baseline-a", startupHooksReadyRef: null, startupHooksReadyHash: null, baselineRetirementRef: null, baselineRetirementHash: null, activationRef: null, activationHash: null, cutoverRef: null, cutoverHash: null });
  }
  assertContiguousCutoverPrefixV1(prefix);
  const epochOrdinal = currentEpochOrdinalV1();
  const base = { pendingInputRef: pending.pendingInputRef as string, pendingInputHash: pending.pendingInputHash as string, ownerAdmissionFenceRef: prefix.fence?.fenceRef ?? null, ownerAdmissionFenceHash: prefix.fence?.fenceHash ?? null, ownerAdmissionFenceReleaseRef: null, ownerAdmissionFenceReleaseHash: null, operationRef: prefix.operation?.operationRef ?? null, operationHash: prefix.operation?.operationHash ?? null };
  const sharedConsumption = readSharedGuardConsumptionPairV1(pending.zeroOwnerGuardHash as string);
  if (!prefix.fence || !prefix.operation) {
    if (epochOrdinal !== 1 || sharedConsumption) fail("pending cutover state conflicts with epoch or consumed guard index");
    return cutoverStatusV1({ state: "pending-input", ...base, operationRef: null, operationHash: null, guardConsumed: false, physicalRestartEpochOrdinal: 1, physicalRestartAuthorityOwner: "baseline-a", startupHooksReadyRef: null, startupHooksReadyHash: null, baselineRetirementRef: null, baselineRetirementHash: null, activationRef: null, activationHash: null, cutoverRef: null, cutoverHash: null });
  }
  if (!prefix.consumption) {
    if (epochOrdinal !== 1 || sharedConsumption) fail("prepared cutover state conflicts with epoch or consumed guard index");
    return cutoverStatusV1({ state: "prepared", ...base, guardConsumed: false, physicalRestartEpochOrdinal: 1, physicalRestartAuthorityOwner: "baseline-a", startupHooksReadyRef: null, startupHooksReadyHash: null, baselineRetirementRef: null, baselineRetirementHash: null, activationRef: null, activationHash: null, cutoverRef: null, cutoverHash: null });
  }
  if (!sharedConsumption || sharedConsumption.consumptionRef !== prefix.consumption.consumptionRef || sharedConsumption.consumptionHash !== prefix.consumption.consumptionHash) fail("cutover guard consumption locator and shared index differ");
  await authenticateFixedGuardConsumptionV1();
  if (prefix.release) {
    const fencePorts = await fencePortsV1();
    const release = await fencePorts.resolveRelease(prefix.release as unknown as Readonly<{ releaseRef: string; releaseHash: string }>);
    if (!release || typeof release !== "object" || (release as Record<string, unknown>).fenceRef !== prefix.fence.fenceRef || (release as Record<string, unknown>).fenceHash !== prefix.fence.fenceHash) fail("cutover terminal fence release is crossed");
    const epoch = assertEpochTwoActive();
    assertCutoverTerminalChainV1(epoch);
    return cutoverStatusV1({ state: "recovery-d-active", ...base, ownerAdmissionFenceReleaseRef: prefix.release.releaseRef!, ownerAdmissionFenceReleaseHash: prefix.release.releaseHash!, guardConsumed: true, physicalRestartEpochOrdinal: 2, physicalRestartAuthorityOwner: "recovery-d", startupHooksReadyRef: prefix.startup!.startupHooksReadyRef!, startupHooksReadyHash: prefix.startup!.startupHooksReadyHash!, baselineRetirementRef: prefix.retirement!.retirementRef!, baselineRetirementHash: prefix.retirement!.retirementHash!, activationRef: prefix.activation!.activationRef!, activationHash: prefix.activation!.activationHash!, cutoverRef: prefix.cutover!.cutoverRef!, cutoverHash: prefix.cutover!.cutoverHash! });
  }
  return cutoverStatusV1({ state: "resuming", ...base, guardConsumed: true, physicalRestartEpochOrdinal: 1, physicalRestartAuthorityOwner: "baseline-a", startupHooksReadyRef: null, startupHooksReadyHash: null, baselineRetirementRef: null, baselineRetirementHash: null, activationRef: null, activationHash: null, cutoverRef: null, cutoverHash: null });
}

export async function resumeActiveInternalProductionPhysicalServiceRestartAuthorityCutoverToRecoveryDV1(): Promise<Readonly<{
  operationRef: string; operationHash: string;
  startupHooksReadyRef: string; startupHooksReadyHash: string;
  retirementRef: string; retirementHash: string;
  activationRef: string; activationHash: string;
  successorEpochRef: string; successorEpochHash: string;
  cutoverRef: string; cutoverHash: string;
}>> {
  const current = await observeInternalProductionPhysicalServiceRestartAuthorityCutoverStatusV1();
  if (current.state === "baseline-a-active") fail("cutover input is absent");
  if (current.state === "recovery-d-active") {
    const operation = { operationRef: current.operationRef!, operationHash: current.operationHash! };
    const prefix = fixedCutoverPrefixV1();
    const startup = prefix.startup!;
    const retirement = prefix.retirement!;
    const activation = prefix.activation!;
    const successor = prefix.successor!;
    return Object.freeze({ ...operation, startupHooksReadyRef: startup.startupHooksReadyRef!, startupHooksReadyHash: startup.startupHooksReadyHash!, retirementRef: retirement.retirementRef!, retirementHash: retirement.retirementHash!, activationRef: activation.activationRef!, activationHash: activation.activationHash!, successorEpochRef: successor.successorEpochRef!, successorEpochHash: successor.successorEpochHash!, cutoverRef: current.cutoverRef!, cutoverHash: current.cutoverHash! });
  }
  if (current.state === "pending-input") {
    const pending = resolvePendingInputV1();
    await prepareInternalProductionPhysicalServiceRestartAuthorityCutoverToRecoveryDV1({
      zeroOwnerGuardRef: pending.zeroOwnerGuardRef as string,
      zeroOwnerGuardHash: pending.zeroOwnerGuardHash as string,
    });
    return resumeActiveInternalProductionPhysicalServiceRestartAuthorityCutoverToRecoveryDV1();
  }
  const visibleEpochOrdinal = currentEpochOrdinalV1();
  const lease = visibleEpochOrdinal === 2
    ? await acquireTransitionLeaseWithEpochAssertionV1(assertEpochTwoVisibleCandidateV1)
    : await acquireInternalProductionPhysicalServiceRestartAuthorityTransitionLeaseV1();
  try {
    const pending = resolvePendingInputV1();
    const prefix = fixedCutoverPrefixV1();
    assertContiguousCutoverPrefixV1(prefix);
    if (!prefix.fence || !prefix.operation) fail("cutover prepare prefix is incomplete");
    if (visibleEpochOrdinal === 2) {
      const visibleEpoch = assertEpochTwoVisibleCandidateV1();
      if (!prefix.cutover || !prefix.startup || !prefix.retirement || !prefix.activation || !prefix.successor) fail("visible cutover candidate prefix is incomplete");
      const fencePorts = await fencePortsV1();
      const fence = validateFenceV1(await fencePorts.reobserveFence(prefix.fence as unknown as Readonly<{ fenceRef: string; fenceHash: string }>), pending as Readonly<{ pendingInputRef: string; pendingInputHash: string }>);
      await publishFenceReleaseAfterCutoverV1(fencePorts, fence, prefix.cutover);
      assertCutoverTerminalChainV1(visibleEpoch, true);
      return Object.freeze({ operationRef: prefix.operation.operationRef!, operationHash: prefix.operation.operationHash!, startupHooksReadyRef: prefix.startup.startupHooksReadyRef!, startupHooksReadyHash: prefix.startup.startupHooksReadyHash!, retirementRef: prefix.retirement.retirementRef!, retirementHash: prefix.retirement.retirementHash!, activationRef: prefix.activation.activationRef!, activationHash: prefix.activation.activationHash!, successorEpochRef: prefix.successor.successorEpochRef!, successorEpochHash: prefix.successor.successorEpochHash!, cutoverRef: prefix.cutover.cutoverRef!, cutoverHash: prefix.cutover.cutoverHash! });
    }
    const operation = resolveCutoverRecordV1("operations", prefix.operation, "operationRef", "operationHash", CUTOVER_OPERATION_PREFIX);
    const epoch = assertEpochOneActive();
    const fencePorts = await fencePortsV1();
    const guardPorts = await guardPortsV1();
    const fence = validateFenceV1(await fencePorts.reobserveFence(prefix.fence as unknown as Readonly<{ fenceRef: string; fenceHash: string }>), pending as Readonly<{ pendingInputRef: string; pendingInputHash: string }>);
    await reobserveExactFenceV1(fencePorts, fence, pending as Readonly<{ pendingInputRef: string; pendingInputHash: string }>);
    assertOperationV1(operation, pending, fence, epoch);
    const readinessBody = await observeCompleteCodeOwnedCutoverReadinessV1();
    if (sha256(canonical(readinessBody)) !== operation.codeOwnedHookObservationHash || readinessBody.physicalRestartEpochRef !== epoch.epochRef || readinessBody.physicalRestartEpochHash !== epoch.epochHash) fail("cutover readiness changed after prepare");
    const guard = validateZeroOwnerGuardV1(await guardPorts.resolveGuard({ zeroOwnerGuardRef: operation.zeroOwnerGuardRef as string, zeroOwnerGuardHash: operation.zeroOwnerGuardHash as string }), { zeroOwnerGuardRef: operation.zeroOwnerGuardRef as string, zeroOwnerGuardHash: operation.zeroOwnerGuardHash as string });
    validateCompleteZeroOwnerCensusV1(await guardPorts.resolveCompleteZero({ observationRef: guard.completeZeroOwnerCensusObservationRef as string, observationHash: guard.completeZeroOwnerCensusObservationHash as string }), { observationRef: guard.completeZeroOwnerCensusObservationRef as string, observationHash: guard.completeZeroOwnerCensusObservationHash as string });
    const baselineAuthoritySet = await observeEmptyBaselineNormalAuthoritySetV1();
    let consumptionPair = prefix.consumption;
    if (!consumptionPair) {
      const candidate = exactOwnRecord(await guardPorts.consumeGuard({ zeroOwnerGuardRef: guard.zeroOwnerGuardRef as string, zeroOwnerGuardHash: guard.zeroOwnerGuardHash as string, operationRef: operation.operationRef as string, operationHash: operation.operationHash as string }), ["consumptionRef", "consumptionHash"], "guard consumption pair");
      consumptionPair = pair(candidate, "consumptionRef", "consumptionHash");
      writeNoReplace(cutoverLocatorV1("02-guard-consumption"), consumptionPair);
    }
    const typedConsumptionPair = consumptionPair as unknown as Readonly<{ consumptionRef: string; consumptionHash: string }>;
    const consumption = validateConsumptionV1(await guardPorts.resolveConsumption(typedConsumptionPair), typedConsumptionPair, guard, operation);
    const startup = publishCutoverRecordV1("startup-hooks-ready", readinessBody, "startupHooksReadyRef", "startupHooksReadyHash", "setfarm://internal-production/physical-service-restart-startup-hooks-ready/sha256/");
    writeNoReplace(cutoverLocatorV1("03-startup-hooks-ready"), startup);
    const activation = publishCutoverRecordV1("activations", Object.freeze({ schema: "setfarm.internal-production-service-restart-authority-activation.v1", startupHooksReadyRef: startup.startupHooksReadyRef, startupHooksReadyHash: startup.startupHooksReadyHash, predecessorPhysicalRestartEpochRef: epoch.epochRef, predecessorPhysicalRestartEpochHash: epoch.epochHash, predecessorPhysicalRestartEpochOrdinal: 1, predecessorPhysicalRestartAuthorityOwner: "baseline-a", successorPhysicalRestartEpochOrdinal: 2, successorPhysicalRestartAuthorityOwner: "recovery-d", services: ["setfarm-spawner", "setfarm-dashboard", "mission-control"] }), "activationRef", "activationHash", "setfarm://internal-production/physical-service-restart-authority-activation/sha256/");
    const retirement = publishCutoverRecordV1("retirements", Object.freeze({ schema: "setfarm.internal-production-baseline-restart-authority-retirement.v1", disposition: "retired-to-recovery-d", predecessorEpochRef: epoch.epochRef, predecessorEpochHash: epoch.epochHash, successorEpochOrdinal: 2, successorAuthorityOwner: "recovery-d", startupHooksReadyRef: startup.startupHooksReadyRef, startupHooksReadyHash: startup.startupHooksReadyHash, successorActivationRef: activation.activationRef, successorActivationHash: activation.activationHash, zeroOwnerGuardRef: guard.zeroOwnerGuardRef, zeroOwnerGuardHash: guard.zeroOwnerGuardHash, zeroOwnerGuardConsumptionRef: consumption.consumptionRef, zeroOwnerGuardConsumptionHash: consumption.consumptionHash, completeZeroOwnerCensusHash: guard.completeZeroOwnerCensusObservationHash, services: ["setfarm-spawner", "setfarm-dashboard", "mission-control"], ...baselineAuthoritySet }), "retirementRef", "retirementHash", "setfarm://internal-production/physical-service-restart-authority-retirement/sha256/");
    writeNoReplace(cutoverLocatorV1("04-retirement"), retirement);
    writeNoReplace(cutoverLocatorV1("05-activation"), activation);
    const successorBody = Object.freeze({ schema: "setfarm.internal-production-physical-service-restart-authority-epoch.v1", epochOrdinal: 2, authorityOwner: "recovery-d", services: ["setfarm-spawner", "setfarm-dashboard", "mission-control"], predecessorEpochRef: epoch.epochRef, predecessorEpochHash: epoch.epochHash, retirementRef: retirement.retirementRef, retirementHash: retirement.retirementHash, startupHooksReadyRef: startup.startupHooksReadyRef, startupHooksReadyHash: startup.startupHooksReadyHash, successorActivationRef: activation.activationRef, successorActivationHash: activation.activationHash });
    const successorEpochHash = sha256(canonical(successorBody));
    const successorEpochRef = `setfarm://internal-production/physical-service-restart-authority-epoch/sha256/${successorEpochHash}`;
    const successorEpoch = Object.freeze({ ...successorBody, epochRef: successorEpochRef, epochHash: successorEpochHash });
    writeNoReplace(path.join(rootPaths().cutover, "epochs", "sha256", successorEpochHash.slice(0, 2), `${successorEpochHash}.json`), successorEpoch);
    writeNoReplace(cutoverLocatorV1("06-successor-epoch"), { successorEpochRef, successorEpochHash });
    const cutover = publishCutoverRecordV1("cutovers", Object.freeze({ schema: "setfarm.internal-production-service-restart-authority-cutover.v1", startupHooksReadyRef: startup.startupHooksReadyRef, startupHooksReadyHash: startup.startupHooksReadyHash, zeroOwnerGuardRef: guard.zeroOwnerGuardRef, zeroOwnerGuardHash: guard.zeroOwnerGuardHash, zeroOwnerGuardConsumptionRef: consumption.consumptionRef, zeroOwnerGuardConsumptionHash: consumption.consumptionHash, ownerAdmissionFenceRef: fence.fenceRef, ownerAdmissionFenceHash: fence.fenceHash, predecessorPhysicalRestartEpochRef: epoch.epochRef, predecessorPhysicalRestartEpochHash: epoch.epochHash, predecessorPhysicalRestartEpochOrdinal: 1, baselineRetirementRef: retirement.retirementRef, baselineRetirementHash: retirement.retirementHash, activationRef: activation.activationRef, activationHash: activation.activationHash, successorPhysicalRestartEpochRef: successorEpochRef, successorPhysicalRestartEpochHash: successorEpochHash, successorPhysicalRestartEpochOrdinal: 2 }), "cutoverRef", "cutoverHash", "setfarm://internal-production/physical-service-restart-authority-cutover/sha256/");
    writeNoReplace(cutoverLocatorV1("07-cutover"), cutover);
    await reobserveExactFenceV1(fencePorts, fence, pending as Readonly<{ pendingInputRef: string; pendingInputHash: string }>);
    const freshReadinessBeforeVisibility = await observeCompleteCodeOwnedCutoverReadinessV1();
    if (canonical(freshReadinessBeforeVisibility) !== canonical(readinessBody) || sha256(canonical(freshReadinessBeforeVisibility)) !== operation.codeOwnedHookObservationHash) fail("cutover readiness changed before visibility CAS");
    if (canonical(await observeEmptyBaselineNormalAuthoritySetV1()) !== canonical(baselineAuthoritySet)) fail("baseline A normal restart authority set changed before visibility CAS");
    replaceEpochHeadV1(successorEpoch);
    await publishFenceReleaseAfterCutoverV1(fencePorts, fence, cutover);
    assertEpochTwoActive();
    return Object.freeze({ operationRef: operation.operationRef as string, operationHash: operation.operationHash as string, startupHooksReadyRef: startup.startupHooksReadyRef!, startupHooksReadyHash: startup.startupHooksReadyHash!, retirementRef: retirement.retirementRef!, retirementHash: retirement.retirementHash!, activationRef: activation.activationRef!, activationHash: activation.activationHash!, successorEpochRef, successorEpochHash, cutoverRef: cutover.cutoverRef!, cutoverHash: cutover.cutoverHash! });
  } finally {
    await releaseInternalProductionPhysicalServiceRestartAuthorityTransitionLeaseV1(lease);
  }
}
