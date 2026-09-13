import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import type { Readable } from "node:stream";
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
  opendirSync,
  readSync,
  readFileSync,
  readdirSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { authenticateInternalProductionBaselineWorkspaceAnchorV1 } from "./baseline-workspace-authority-path-v1.js";
import { resolveInternalProductionBaselineAuthorityPathV1, resolveInternalProductionBaselineWorkspaceRootV1 } from "./baseline-workspace-authority-path-v1.js";
import { fileURLToPath } from "node:url";
import type { BigIntStats } from "node:fs";
import { validateLegacyFindingPublicationInventoryV1 } from "../findings/legacy-finding-publication-inventory-v1.js";
import { readInternalProductionSpawnerUntrustedInheritedFrameV1, verifyInternalProductionSpawnerLaunchOutputCandidateV1 } from "./baseline-spawner-launch-environment-v1.js";

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
  | Readonly<Omit<RestartEpochCommonV1, "schema"> & { schema: "setfarm.internal-production-physical-service-restart-authority-epoch.v2"; epochOrdinal: 1; authorityOwner: "baseline-a"; predecessorEpochRef: null; predecessorEpochHash: null; retirementRef: null; retirementHash: null; startupHooksReadyRef: null; startupHooksReadyHash: null; successorActivationRef: null; successorActivationHash: null; genesisRef: string; genesisHash: string }>
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
type DirectTerminationPublicationV1 = {
  record: Readonly<Record<string, unknown>>;
  file: string;
  descriptor: number | null;
  identity: BigIntStats | null;
  started: boolean;
  synced: boolean;
};
type DirectSpawnerTerminationStateV1 = {
  rootGuard: PrivateDirectoryGuardV1;
  dispatch: DirectTerminationPublicationV1 | null;
  signalEntered: boolean;
  signalReturned: boolean;
  receipt: DirectTerminationPublicationV1 | null;
};
type DirectSpawnerRebindIntentStateV1 = {
  lease: InternalProductionPhysicalServiceRestartAuthorityTransitionLeaseV1;
  inputs: Awaited<ReturnType<typeof resolveDirectSpawnerRebindInputsUnderLeaseV1>>;
  intent: Readonly<Record<string, unknown>>;
  nonce: string;
  lockIdentity: BigIntStats;
  rootGuard: PrivateDirectoryGuardV1;
  epochPin: ReturnType<typeof pinStableCasPredecessorV1> | null;
  intentPin: ReturnType<typeof pinStableCasPredecessorV1> | null;
  publication: {
    temporary: string;
    descriptor: number | null;
    identity: BigIntStats | null;
    openAttempted: boolean;
    linkAttempted: boolean;
    unlinkAttempted: boolean;
    committed: boolean;
  };
  termination: DirectSpawnerTerminationStateV1 | null;
};
let retainedDirectSpawnerRebindIntentV1: DirectSpawnerRebindIntentStateV1 | null = null;
let directSpawnerRebindPreparationActiveV1 = false;
let directSpawnerTerminationActiveV1 = false;
type RawPhysicalTransitionLockV1 = Readonly<{
  schema: "setfarm.internal-production-raw-physical-transition-lock.v1";
}>;
type RawPhysicalTransitionLockStateV1 = Readonly<{
  descriptor: number;
  lockBytes: Buffer;
  rootGuard: PrivateDirectoryGuardV1;
  cleanup: { phase: "held" | "owned-unlink-completed"; identity: BigIntStats | null; unlinkSynced: boolean; rootGuardClosing: boolean; rootGuardClosed: boolean; descriptorClosed: boolean };
}>;
const rawPhysicalTransitionLocksV1 = new WeakMap<object, RawPhysicalTransitionLockStateV1>();
let retainedColdGenesisRawV1: RawPhysicalTransitionLockV1 | null = null;
let coldGenesisInvocationActiveV1 = false;
type ColdBootstrapIntentStateV1 = {
  lease: InternalProductionPhysicalServiceRestartAuthorityTransitionLeaseV1;
  phase: "intent-only" | "helper-may-have-run" | "claim-observed" | "settled" | "releasing";
  intent: Readonly<Record<string, unknown>>;
  environment: Readonly<Record<string, string>>;
  nonce: string;
  rootIdentity: BigIntStats | null;
  rootGuard: PrivateDirectoryGuardV1;
  helperInvocation?: ColdControllerHelperInvocationV1;
  release?: { lockIdentity: BigIntStats; lockUnlinked: boolean; unlinkSynced: boolean; rootGuardClosing: boolean; rootGuardClosed: boolean; descriptorClosed: boolean };
  settlement?: {
    record: Readonly<Record<string, unknown>>;
    bytes: Buffer;
    attempted: boolean;
    descriptor: number | null;
    identity: BigIntStats | null;
    linkAttempted: boolean;
    linked: boolean;
    unlinkAttempted: boolean;
    committed: boolean;
  };
};
type ColdControllerHelperInvocationV1 = {
  child: ChildProcess | null;
  completion: Promise<Readonly<Record<string, unknown>>> | null;
  failed: boolean;
  transportDescriptors: number[];
  authorityDescriptors: number[];
  guards: PrivateDirectoryGuardV1[];
  pins: Array<Readonly<{ path: string; stats: BigIntStats; bytes: Buffer; descriptor: number }>>;
};
let retainedColdBootstrapIntentV1: ColdBootstrapIntentStateV1 | null = null;
let retainedColdBootstrapPreparationV1: {
  lease: InternalProductionPhysicalServiceRestartAuthorityTransitionLeaseV1;
  rootGuard: PrivateDirectoryGuardV1 | null;
  lockIdentity: BigIntStats | null;
  epoch: Readonly<Record<string, unknown>> | null;
} | null = null;
let coldBootstrapIntentInvocationActiveV1 = false;
let coldControllerHelperInvocationActiveV1 = false;
let coldControllerSettlementActiveV1 = false;
let coldControllerReleaseActiveV1 = false;
let coldControllerFacadeActiveV1 = false;
const pendingColdHelperAuthenticationCleanupV1 = new Set<() => void>();
type ColdHelperContextStateV1 = {
  authentication: Awaited<ReturnType<typeof authenticateColdSpawnerHelperIntentV1>>;
  phase: "refreshing" | "ready" | "dispatch-publication" | "dispatch-owned" | "child-launch-handed-off" | "claimed" | "closing";
  observationHash: string | null;
};
const coldHelperContextsV1 = new WeakMap<object, ColdHelperContextStateV1>();
let coldHelperRuntimeContextV1: Readonly<{ close: () => void }> | null = null;
let coldHelperContextInvocationActiveV1 = false;
let coldHelperTransportAttemptedV1 = false;
let coldChildAuthenticationV1: ReturnType<typeof authenticateColdSpawnerChildCapabilityV1> | null = null;
let coldChildAuthenticationFailedV1 = false;
let directHelperAuthenticationV1: Awaited<ReturnType<typeof authenticateDirectSpawnerHelperIntentV1>> | null = null;
let directHelperAuthenticationFailedV1 = false;
let directHelperAuthenticationActiveV1 = false;
let directHelperTransportAttemptedV1 = false;
let directChildAuthenticationV1: ReturnType<typeof authenticateDirectSpawnerChildCapabilityV1> | null = null;
let directChildAuthenticationFailedV1 = false;
let directChildAdmissionAttemptedV1 = false;
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
  const workspaceAnchor = authenticateInternalProductionBaselineWorkspaceAnchorV1();
  const descriptors: number[] = [];
  const held: Array<ReturnType<typeof fstatSync>> = [];
  let closed = false;
  let closing = false;
  const close = (): void => {
    if (closed) fail("authority directory guard is already closed");
    closing = true;
    // Advance ownership only after each successful close. A caller retaining
    // this guard may finish an interrupted cleanup, but never authenticate it.
    while (descriptors.length > 0) {
      closeSync(descriptors[descriptors.length - 1]!);
      descriptors.pop(); held.pop();
    }
    workspaceAnchor.close();
    closed = true;
  };
  const assertStable = (): void => {
    if (closed || closing) fail("authority directory guard is closed");
    workspaceAnchor.assertStable();
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
    workspaceAnchor.assertStable();
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
      close,
    });
  } catch (error) {
    const cleanup = () => { close(); pendingColdHelperAuthenticationCleanupV1.delete(cleanup); };
    try { cleanup(); }
    catch {
      pendingColdHelperAuthenticationCleanupV1.add(cleanup);
      try { cleanup(); } catch { /* The unreturned guard remains owned until close completes. */ }
    }
    throw error;
  }
}

function ensurePrivateAuthorityDirectoryV1(directory: string): PrivateDirectoryGuardV1 {
  const anchor = resolveInternalProductionBaselineWorkspaceRootV1();
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
      const createdGuard = authenticatePrivateDirectoryChainV1(anchor, current);
      try {
        createdGuard.assertStable();
        // Existing prefixes may themselves follow an interrupted mkdir. Make
        // every authenticated directory link durable before publishing below it.
        fsyncParent(current);
        createdGuard.assertStable();
        parentGuard.assertStable();
      } finally { createdGuard.close(); }
    } finally {
      parentGuard.close();
    }
    const createdGuard = authenticatePrivateDirectoryChainV1(anchor, current);
    createdGuard.close();
  }
  return authenticatePrivateDirectoryChainV1(anchor, target);
}

function rootPaths() {
  const root = resolveInternalProductionBaselineAuthorityPathV1("data/internal-production-baseline/restart-authority-retirement-v1");
  return Object.freeze({
    root,
    lock: path.join(root, "physical-service-restart-authority.transition.lock"),
    epoch: path.join(root, "epoch-head.json"),
    genesis: path.join(root, "epoch-genesis", "sha256"),
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

function readStableRetirementBytes(file: string, label: string, maximumBytes = 1_048_576): Buffer {
  const guard = authenticatePrivateDirectoryChainV1(resolveInternalProductionBaselineWorkspaceRootV1(), path.dirname(file));
  try {
    guard.assertStable();
    const descriptor = openSync(file, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
    try {
      const before = fstatSync(descriptor, { bigint: true });
      if (!before.isFile() || before.isSymbolicLink() || before.nlink !== 1n || (before.mode & 0o7777n) !== 0o600n || before.size < 1n || before.size > BigInt(maximumBytes)) fail(`${label} identity is invalid`);
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
  let closed = false;
  const close = () => { if (closed) return; closeSync(descriptor); closed = true; pendingColdHelperAuthenticationCleanupV1.delete(close); };
  try { fsyncSync(descriptor); }
  finally {
    try { close(); }
    catch (error) {
      pendingColdHelperAuthenticationCleanupV1.add(close);
      try { close(); } catch { /* Keep the original parent descriptor reachable. */ }
      throw error;
    }
  }
}

function cleanupExactOwnedLock(lock: string, descriptor: number, expectedBytes: Buffer | null, onOwnedUnlink?: () => void): void {
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
    onOwnedUnlink?.();
    fsyncParent(lock);
  } finally { finishRetainedColdCleanupV1(() => closeSync(reopened)); }
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

export function observeInternalProductionColdSpawnerBootstrapJournalCensusV1(): Readonly<{
  schema: "setfarm.internal-production-cold-spawner-bootstrap-journal-census.v1";
  state: "absent"; incompleteOwnerCount: 0; absenceIdentityHash: string; censusHash: string;
} | {
  schema: "setfarm.internal-production-cold-spawner-bootstrap-journal-census.v1";
  state: "settled"; incompleteOwnerCount: 0; settlement: Readonly<Record<string, unknown>>; settlementIdentity: readonly string[]; censusHash: string;
}> {
  try { for (const close of pendingColdHelperAuthenticationCleanupV1) close(); }
  catch { return fail("COLD_BOOTSTRAP_UNSETTLED: prior cold cleanup is incomplete"); }
  const workspace = resolveInternalProductionBaselineWorkspaceRootV1();
  const target = path.join(rootPaths().root, "cold-spawner-bootstrap-v1");
  let nearest = path.dirname(target);
  let before: BigIntStats;
  for (;;) {
    try { before = lstatSync(nearest, { bigint: true }); break; }
    catch (error) {
      if (!(error instanceof Error) || !("code" in error) || error.code !== "ENOENT" || nearest === workspace) throw error;
      nearest = path.dirname(nearest);
      if (nearest !== workspace && !nearest.startsWith(`${workspace}${path.sep}`)) fail("cold journal ancestry escaped the workspace");
    }
  }
  const guard = authenticatePrivateDirectoryChainV1(workspace, nearest);
  try {
    guard.assertStable();
    if (!sameColdFileMetadataV1(before, lstatSync(nearest, { bigint: true }))) fail("cold journal absence ancestor changed");
    const siblings = nearest === path.dirname(target) ? readColdDirectoryMembersV1(nearest, 4096) : [];
    const finalName = "cold-spawner-bootstrap-controller-settlement-v1.json";
    if (siblings.some(name => name.startsWith(`.${finalName}.`))) fail("COLD_BOOTSTRAP_UNSETTLED: cold settlement publication is incomplete");
    if (siblings.includes(path.basename(target)) || siblings.includes(finalName)) {
      try {
        const settled = observeColdControllerSettlementHistoryV1();
        guard.assertStable();
        if (!sameColdFileMetadataV1(before, lstatSync(nearest, { bigint: true }))) fail("cold settlement ancestor changed");
        return settled;
      } catch { return fail("COLD_BOOTSTRAP_UNSETTLED: cold controller settlement chain is unauthenticated"); }
    }
    try { lstatSync(target); fail("COLD_BOOTSTRAP_UNSETTLED: cold history has no authenticated controller settlement"); }
    catch (error) { if (!(error instanceof Error) || !("code" in error) || error.code !== "ENOENT") throw error; }
    guard.assertStable();
    if (!sameColdFileMetadataV1(before, lstatSync(nearest, { bigint: true }))) fail("cold journal absence ancestor changed");
    const absenceIdentityHash = sha256(canonical({ ancestor: nearest,
      metadata: [before.dev, before.ino, before.mode, before.uid, before.gid, before.nlink, before.size, before.mtimeNs, before.ctimeNs].map(String) }));
    const body = { schema: "setfarm.internal-production-cold-spawner-bootstrap-journal-census.v1" as const, state: "absent" as const, incompleteOwnerCount: 0 as const, absenceIdentityHash };
    return Object.freeze({ ...body, censusHash: sha256(canonical(body)) });
  } finally { finishRetainedColdCleanupV1(() => guard.close()); }
}

// Terminal history proves only that cold transport ownership has settled.
// It never observes or authorizes the old live process, lock or mutable head.
function observeColdControllerSettlementHistoryV1() {
  const workspace = resolveInternalProductionBaselineWorkspaceRootV1(), parent = rootPaths().root;
  const root = path.join(parent, "cold-spawner-bootstrap-v1"), target = path.join(parent, "cold-spawner-bootstrap-controller-settlement-v1.json");
  const guards: PrivateDirectoryGuardV1[] = [], pins: Array<{ target: string; stats: BigIntStats; bytes: Buffer }> = [];
  try {
    guards.push(authenticatePrivateDirectoryChainV1(workspace, root));
    const journal = lstatSync(root, { bigint: true });
    const inventory = () => {
      for (const guard of guards) guard.assertStable();
      if (journal.uid !== BigInt(process.getuid!()) || !sameColdFileMetadataV1(journal, lstatSync(root, { bigint: true }))
        || canonical(readColdDirectoryMembersV1(root, 3).sort()) !== canonical(["claim.json", "dispatch.json", "intent.json"])
        || readColdDirectoryMembersV1(parent, 4096).some(name => name.startsWith(`.${path.basename(target)}.`))) fail("cold settlement inventory is crossed");
    };
    const read = (file: string, maximum: number, expected?: unknown) => {
      const stats = lstatSync(file, { bigint: true });
      if (stats.size > BigInt(maximum) || (expected !== undefined && canonical(coldFileIdentityTupleV1(stats)) !== canonical(expected))) fail("cold settlement original file identity is crossed");
      const bytes = readColdGenesisCandidateV1(file, stats);
      pins.push({ target: file, stats, bytes });
      return { stats, bytes };
    };
    inventory();
    const publication = read(target, 65_536);
    const record = coldRecordV1(JSON.parse(publication.bytes.toString("utf8")), ["schema", "purpose", "completion", "epochEvidence", "genesisIdentity", "serviceCensus", "settlementRef", "settlementHash"], "controller settlement");
    if (!publication.bytes.equals(Buffer.from(`${canonical(record)}\n`)) || record.schema !== "setfarm.internal-production-cold-spawner-controller-settlement.v1"
      || record.purpose !== "exact-poison-sealed-cold-spawner-v1"
      || record.settlementRef !== `setfarm://internal-production/cold-spawner-controller-settlement/sha256/${coldHashV1(record.settlementHash, "settlement")}`) fail("cold settlement binding is crossed");
    coldSelfHashV1(record, "settlementHash", ["settlementRef"]);
    const completion = coldRecordV1(record.completion, ["schema", "intentRef", "intentHash", "intentIdentity", "dispatchRef", "dispatchHash", "dispatchIdentity", "claimRef", "claimHash", "claimIdentity", "journalIdentity"], "settlement completion");
    if (completion.schema !== "setfarm.internal-production-cold-spawner-helper-completion.v1" || Buffer.byteLength(`${canonical(completion)}\n`) > 4096
      || canonical(completion.journalIdentity) !== canonical(coldFileIdentityTupleV1(journal))) fail("cold settlement completion is crossed");
    const intentFile = read(path.join(root, "intent.json"), COLD_GENESIS_MAX_BYTES_V1, completion.intentIdentity);
    const intent = parseColdSpawnerBootstrapIntentV1(intentFile.bytes);
    validateColdHistoricalLaunchProfileV1(intent);
    const dispatch = parseColdSpawnerBootstrapDispatchV1(read(path.join(root, "dispatch.json"), 65_536, completion.dispatchIdentity).bytes, intent,
      { devDecimal: String(intentFile.stats.dev), inoDecimal: String(intentFile.stats.ino) });
    const claim = parseColdSpawnerBootstrapClaimV1(read(path.join(root, "claim.json"), 65_536, completion.claimIdentity).bytes, intent, dispatch);
    for (const stem of ["intent", "dispatch", "claim"]) for (const suffix of ["Ref", "Hash"]) if (completion[`${stem}${suffix}`] !== claim[`${stem}${suffix}`]) fail("cold settlement completion pair is crossed");
    const genesisPath = coldGenesisReceiptPathV1(intent.genesisHash as string);
    guards.push(authenticatePrivateDirectoryChainV1(workspace, path.dirname(genesisPath)));
    const genesis = parseColdEpochGenesisReceiptV1(read(genesisPath, COLD_GENESIS_MAX_BYTES_V1, record.genesisIdentity).bytes);
    const epochEvidence = coldRecordV1(record.epochEvidence, ["record", "identity"], "settlement epoch evidence");
    const epochBytes = Buffer.from(`${canonical(epochEvidence.record)}\n`);
    const epoch = validateColdEpochOneHeadV1(epochEvidence.record, epochBytes, genesis);
    const epochIdentity = epochEvidence.identity;
    if (!Array.isArray(epochIdentity) || epochIdentity.length !== 10 || epochIdentity.some(value => typeof value !== "string" || !/^(?:0|[1-9][0-9]{0,29})$/.test(value))
      || epochIdentity[0] !== String(journal.dev) || BigInt(epochIdentity[1]) < 1n || epochIdentity[2] !== String(process.getuid!())
      || BigInt(epochIdentity[4]) !== BigInt(constants.S_IFREG | 0o600) || epochIdentity[5] !== "1" || epochIdentity[6] !== String(epochBytes.length)) fail("cold settlement historical epoch identity is invalid");
    if (["epochRef", "epochHash", "genesisRef", "genesisHash"].some(key => intent[key] !== epoch[key])
      || coldGenesisStableIdentityV1(intent.coldObservation as Record<string, unknown>) !== coldGenesisStableIdentityV1(genesis.coldObservation as Record<string, unknown>)) fail("cold settlement historical epoch is crossed");
    assertColdControllerServiceCensusV1(intent, claim, record.serviceCensus);
    inventory();
    for (const pin of pins) if (!pin.bytes.equals(readColdGenesisCandidateV1(pin.target, pin.stats))) fail("cold settlement history changed while read");
    inventory();
    const body = { schema: "setfarm.internal-production-cold-spawner-bootstrap-journal-census.v1" as const, state: "settled" as const,
      incompleteOwnerCount: 0 as const, settlement: record, settlementIdentity: coldFileIdentityTupleV1(publication.stats) };
    return freezeColdDataV1({ ...body, censusHash: sha256(canonical(body)) });
  } finally { finishRetainedColdCleanupV1(() => { while (guards.length > 0) { guards.at(-1)!.close(); guards.pop(); } }); }
}

function validateColdHistoricalLaunchProfileV1(intent: Readonly<Record<string, unknown>>): void {
  const profile = validateHistoricalSpawnerLaunchProfileV1(intent.launchProfile);
  const cold = intent.coldObservation as Record<string, any>;
  if (canonical(profile.source) !== canonical(cold.source)
    || cold.spawnerAbsence.entrypoint !== path.join(profile.repository as string, "dist/spawner.js")) fail("cold historical profile entry is crossed");
}

// Structural historical evidence only. Cold and operation-bound rebind callers
// must independently authenticate their own source, predecessor and lease chain.
function validateHistoricalSpawnerLaunchProfileV1(value: unknown): Readonly<Record<string, unknown>> {
  const profile = coldRecordV1(value, ["schema", "source", "uid", "home", "workspace", "repository", "rootIdentity", "hostDirectories", "executable", "arguments", "cwd", "environmentDirectory", "buildInfoBytesHash", "outputTreeBytesHash", "releaseManifestBytesHash", "plistBytesHash", "loadedLaunchProjectionHash", "environmentHash", "environmentFiles", "profileHash"], "historical launch profile");
  if (profile.schema !== "setfarm.internal-production-spawner-launch-profile.v1") fail("historical launch profile schema is invalid");
  coldSelfHashV1(profile, "profileHash");
  const source = coldRecordV1(profile.source, ["branch", "clean", "sha", "treeHash", "buildHash", "originMainSha"], "historical profile source");
  if (source.branch !== "main" || source.clean !== true || source.originMainSha !== source.sha
    || typeof source.sha !== "string" || !/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(source.sha)
    || typeof source.treeHash !== "string" || !/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(source.treeHash)) fail("historical profile source is not exact clean main");
  coldHashV1(source.buildHash, "historical profile source build");
  const absolute = (value: unknown): string => {
    if (typeof value !== "string" || value.includes("\0") || !path.isAbsolute(value) || path.normalize(value) !== value) fail("cold historical profile path is invalid");
    return value;
  };
  const identityKeys = ["devDecimal", "inoDecimal", "uid", "gid", "mode"];
  const identity = (value: Record<string, unknown>) => {
    if (typeof value.devDecimal !== "string" || !/^(?:0|[1-9][0-9]{0,19})$/.test(value.devDecimal)
      || typeof value.inoDecimal !== "string" || !/^[1-9][0-9]{0,19}$/.test(value.inoDecimal)
      || [value.uid, value.gid, value.mode].some(member => !Number.isSafeInteger(member) || (member as number) < 0)
      || (value.mode as number) > 0o7777) fail("cold historical profile identity is invalid");
  };
  const repository = absolute(profile.repository), environmentDirectory = absolute(profile.environmentDirectory);
  for (const key of ["home", "workspace", "cwd"]) absolute(profile[key]);
  if (profile.uid !== process.getuid!() || profile.workspace !== resolveInternalProductionBaselineWorkspaceRootV1() || profile.cwd !== repository
    || canonical(profile.arguments) !== canonical([path.join(repository, "dist/spawner.js")])) fail("cold historical profile entry is crossed");
  for (const key of ["buildInfoBytesHash", "outputTreeBytesHash", "releaseManifestBytesHash", "plistBytesHash", "loadedLaunchProjectionHash", "environmentHash"]) coldHashV1(profile[key], key);
  const executable = coldRecordV1(profile.executable, ["path", ...identityKeys, "bytesHash"], "historical executable");
  absolute(executable.path); identity(executable); coldHashV1(executable.bytesHash, "historical executable bytes");
  if (executable.uid !== profile.uid || ((executable.mode as number) & 0o111) === 0 || ((executable.mode as number) & 0o022) !== 0) fail("cold historical executable ownership is invalid");
  const rootIdentity = coldRecordV1(profile.rootIdentity, identityKeys, "historical repository identity"); identity(rootIdentity);
  if (!Array.isArray(profile.hostDirectories) || profile.hostDirectories.length < 1 || profile.hostDirectories.length > 128) fail("cold historical host directories are invalid");
  const directories = new Map<string, Record<string, unknown>>();
  const ordinaryRoots = [profile.home, profile.workspace, repository, environmentDirectory] as string[];
  const ordinaryPaths = [...ordinaryRoots, path.join(repository, "dist"), path.join(profile.home as string, "Library", "LaunchAgents")];
  const isAncestor = (ancestor: string, target: string) => target === ancestor || target.startsWith(ancestor.endsWith(path.sep) ? ancestor : `${ancestor}${path.sep}`);
  for (const value of profile.hostDirectories) {
    const directory = coldRecordV1(value, ["path", ...identityKeys], "historical host directory");
    const target = absolute(directory.path); identity(directory);
    if (directories.has(target) || (directory.uid !== 0 && directory.uid !== profile.uid)) fail("cold historical host directory is crossed");
    const trustedNodeAdminGroup = process.platform === "darwin" && directory.gid === 80
      && isAncestor(target, path.dirname(executable.path as string)) && !ordinaryPaths.some(root => isAncestor(target, root));
    if (((directory.mode as number) & (trustedNodeAdminGroup ? 0o002 : 0o022)) !== 0
      || (ordinaryRoots.includes(target) && directory.uid !== profile.uid)) fail("cold historical host ownership is invalid");
    const { path: _target, ...metadata } = directory; directories.set(target, metadata);
  }
  for (const value of [...ordinaryPaths, path.dirname(executable.path as string)]) {
    for (let target = value as string; ; target = path.dirname(target)) { if (!directories.has(target)) fail("cold historical host ancestry is incomplete"); if (path.dirname(target) === target) break; }
  }
  if (canonical(directories.get(repository)) !== canonical(rootIdentity)) fail("cold historical repository identity is crossed");
  if (!Array.isArray(profile.environmentFiles) || profile.environmentFiles.length !== 2) fail("cold historical environment file inventory is invalid");
  for (const [index, value] of profile.environmentFiles.entries()) {
    const present = value?.state === "present";
    const file = coldRecordV1(value, present ? ["path", "state", ...identityKeys, "bytesHash"] : ["path", "state"], "historical environment file");
    if (file.path !== path.join(environmentDirectory, [".env", ".env.local"][index]!) || (!present && file.state !== "absent")) fail("cold historical environment file is crossed");
    if (present) { identity(file); coldHashV1(file.bytesHash, "historical environment bytes"); if (file.uid !== profile.uid || ((file.mode as number) & 0o022) !== 0) fail("cold historical environment ownership is invalid"); }
  }
  return profile;
}

function parseDirectSpawnerRebindIntentV1(bytes: Buffer): Readonly<Record<string, unknown>> {
  if (bytes.length < 1 || bytes.length > 8_388_608) fail("direct rebind intent size is invalid");
  const intent = coldRecordV1(JSON.parse(bytes.toString("utf8")), ["schema", "purpose", "transport", "terminationSignal", "maximumTerminationDispatchCount", "maximumSpawnDispatchCount", "currentEntryOperation", "restartAuthority", "startupToken", "predecessorSpawnerProcessIdentity", "preMutationLoadedRuntimeServiceAuthority", "launchProfile", "epoch", "transitionLock", "lockIdentity", "nonceHash", "intentRef", "intentHash"], "direct rebind intent");
  if (!bytes.equals(Buffer.from(`${canonical(intent)}\n`)) || intent.schema !== "setfarm.internal-production-pre-schema-spawner-direct-rebind-intent.v1"
    || intent.purpose !== "operation-bound-pre-schema-spawner-rebind-v1" || intent.transport !== "direct-detached-node-v1"
    || intent.terminationSignal !== "SIGTERM" || intent.maximumTerminationDispatchCount !== 1 || intent.maximumSpawnDispatchCount !== 1
    || intent.intentRef !== `setfarm://internal-production/pre-schema-spawner-direct-rebind-intent/sha256/${coldHashV1(intent.intentHash, "direct intent")}`) fail("direct rebind intent binding is invalid");
  coldSelfHashV1(intent, "intentHash", ["intentRef"]);
  for (const [key, stem, domain] of [
    ["currentEntryOperation", "operation", "current-entry-operation"],
    ["restartAuthority", "restartAuthority", "pre-schema-spawner-restart-authority"],
    ["startupToken", "startupToken", "pre-schema-spawner-startup-token"],
    ["predecessorSpawnerProcessIdentity", "predecessorSpawnerProcessIdentity", "spawner-process-identity"],
    ["preMutationLoadedRuntimeServiceAuthority", "preMutationLoadedRuntimeServiceAuthority", "pre-mutation-loaded-runtime-service-authority"],
    ["epoch", "epoch", "physical-service-restart-authority-epoch"],
  ] as const) coldPairV1(intent[key], stem, `setfarm://internal-production/${domain}/sha256/`);
  validateHistoricalSpawnerLaunchProfileV1(intent.launchProfile);
  parseLockRecord(Buffer.from(`${canonical(intent.transitionLock)}\n`));
  const identity = coldRecordV1(intent.lockIdentity, ["devDecimal", "inoDecimal"], "direct intent lock identity");
  if (typeof identity.devDecimal !== "string" || !/^(?:0|[1-9][0-9]{0,19})$/.test(identity.devDecimal)
    || typeof identity.inoDecimal !== "string" || !/^[1-9][0-9]{0,19}$/.test(identity.inoDecimal)) fail("direct rebind lock identity is invalid");
  coldHashV1(intent.nonceHash, "direct intent nonce");
  return freezeColdDataV1(intent);
}

// Resolves evidence only. The caller still needs a retained, one-shot dispatch
// owner; neither this data nor an existing durable intent permits an effect.
function parseDirectSpawnerTerminationRecordsV1(
  dispatchBytes: Buffer, receiptBytes: Buffer, originalIntent: Readonly<Record<string, unknown>>,
) {
  const intent = parseDirectSpawnerRebindIntentV1(Buffer.from(`${canonical(originalIntent)}\n`));
  const parse = (bytes: Buffer, keys: readonly string[], stem: string, domain: string) => {
    if (bytes.length < 1 || bytes.length > 65_536) fail("direct termination history size is invalid");
    const record = coldRecordV1(JSON.parse(bytes.toString("utf8")), keys, "direct termination history");
    if (!bytes.equals(Buffer.from(`${canonical(record)}\n`)) || record.schema !== `setfarm.internal-production-${domain}.v1`
      || record.purpose !== "operation-bound-pre-schema-spawner-rebind-v1"
      || record[`${stem}Ref`] !== `setfarm://internal-production/${domain}/sha256/${coldHashV1(record[`${stem}Hash`], "direct termination history")}`
      || record.intentRef !== intent.intentRef || record.intentHash !== intent.intentHash || record.terminationSignal !== "SIGTERM") fail("direct termination history binding is crossed");
    coldSelfHashV1(record, `${stem}Hash`, [`${stem}Ref`]);
    return record;
  };
  const dispatch = parse(dispatchBytes, ["schema", "purpose", "intentRef", "intentHash", "intentIdentity", "controller", "target", "serviceCensusHash", "terminationSignal", "maximumTerminationDispatchCount", "dispatchRef", "dispatchHash"], "dispatch", "pre-schema-spawner-direct-termination-dispatch");
  const receipt = parse(receiptBytes, ["schema", "purpose", "intentRef", "intentHash", "dispatchRef", "dispatchHash", "controller", "predecessorSpawnerProcessIdentity", "terminationSignal", "signalDispatchCount", "signalCallOutcome", "observedProcessState", "observedListenerState", "terminationReceiptRef", "terminationReceiptHash"], "terminationReceipt", "pre-schema-spawner-direct-termination-receipt");
  const profile = intent.launchProfile as Record<string, any>, transition = intent.transitionLock as Record<string, unknown>;
  const controller = coldRecordV1(dispatch.controller, ["pid", "processStartTimeEpochMs", "processIdentityHash", "uid"], "direct termination controller");
  if (canonical(controller) !== canonical({ pid: transition.pid, processStartTimeEpochMs: transition.processStartTimeEpochMs, processIdentityHash: transition.processIdentityHash, uid: profile.uid })
    || canonical(receipt.controller) !== canonical(controller)) fail("direct termination controller is crossed");
  const identity = dispatch.intentIdentity;
  if (!Array.isArray(identity) || identity.length !== 10 || identity.some(value => typeof value !== "string" || !/^(?:0|[1-9][0-9]{0,29})$/.test(value))
    || BigInt(identity[1]) < 1n || identity[2] !== String(profile.uid) || identity[4] !== String(constants.S_IFREG | 0o600)
    || identity[5] !== "1" || identity[6] !== String(Buffer.byteLength(`${canonical(intent)}\n`))) fail("direct termination intent identity is invalid");
  coldHashV1(dispatch.serviceCensusHash, "direct termination service census");
  const target = coldRecordV1(dispatch.target, ["uid", "pid", "ppid", "pgid", "stat", "lstart", "command", "processStartTimeEpochMs", "processIdentityHash"], "direct termination target");
  if (!Number.isSafeInteger(target.pid) || (target.pid as number) < 1 || target.pid === controller.pid || target.uid !== profile.uid
    || target.ppid !== 1 || target.pgid !== target.pid || typeof target.lstart !== "string" || target.lstart.length !== 24
    || !Number.isSafeInteger(target.processStartTimeEpochMs) || (target.processStartTimeEpochMs as number) < 1 || Date.parse(target.lstart) !== target.processStartTimeEpochMs
    || target.processIdentityHash !== sha256(`${target.pid}\n${target.lstart}\n`) || typeof target.stat !== "string" || !/^[A-Za-z+<>]{1,16}$/.test(target.stat) || /[ZE]/.test(target.stat)
    || target.command !== `${profile.executable.path} ${profile.arguments[0]}`) fail("direct termination historical target is crossed");
  const predecessorHash = sha256(canonical({ schema: "setfarm.internal-production-spawner-process-identity.v1", pid: target.pid, processStartTimeEpochMs: target.processStartTimeEpochMs, processIdentityHash: target.processIdentityHash }));
  if (canonical(intent.predecessorSpawnerProcessIdentity) !== canonical({ predecessorSpawnerProcessIdentityRef: `setfarm://internal-production/spawner-process-identity/sha256/${predecessorHash}`, predecessorSpawnerProcessIdentityHash: predecessorHash })
    || canonical(receipt.predecessorSpawnerProcessIdentity) !== canonical(intent.predecessorSpawnerProcessIdentity)
    || dispatch.maximumTerminationDispatchCount !== 1 || receipt.signalDispatchCount !== 1
    || !["returned", "response-unknown"].includes(receipt.signalCallOutcome as string)
    || receipt.observedProcessState !== "terminal-and-not-running" || receipt.observedListenerState !== "absent"
    || receipt.dispatchRef !== dispatch.dispatchRef || receipt.dispatchHash !== dispatch.dispatchHash) fail("direct termination receipt relation is crossed");
  // Bytes prove historical relations only. Consumers must pin original files,
  // authenticate their issuer and freshly observe absence before any new grant.
  return freezeColdDataV1({ dispatch, receipt });
}

function parseDirectSpawnerTerminationChainV1(
  dispatchBytes: Buffer, receiptBytes: Buffer, originalIntent: Readonly<Record<string, unknown>>, preMutation: Readonly<Record<string, unknown>>,
) {
  const history = parseDirectSpawnerTerminationRecordsV1(dispatchBytes, receiptBytes, originalIntent);
  const predecessor = preMutation.spawner as Record<string, unknown>, target = history.dispatch.target as Record<string, unknown>;
  if (!predecessor || typeof predecessor !== "object" || Array.isArray(predecessor)
    || ["Ref", "Hash"].some(suffix => preMutation[`preMutationLoadedRuntimeServiceAuthority${suffix}`] !== (originalIntent.preMutationLoadedRuntimeServiceAuthority as Record<string, unknown>)[`preMutationLoadedRuntimeServiceAuthority${suffix}`])
    || ["pid", "processStartTimeEpochMs", "processIdentityHash"].some(key => target[key] !== predecessor[key])
    || predecessor.processOwnerCount !== 1 || predecessor.listener !== null) fail("direct termination original P3 is crossed");
  return history;
}

async function resolveDirectSpawnerRebindInputsUnderLeaseV1(
  lease: InternalProductionPhysicalServiceRestartAuthorityTransitionLeaseV1,
  input: Readonly<{ currentEntryOperation: Readonly<{ operationRef: string; operationHash: string }>; restartAuthority: Readonly<{ restartAuthorityRef: string; restartAuthorityHash: string }> }>,
) {
  const held = heldLease(lease), lockIdentity = fstatSync(held.descriptor, { bigint: true }), epoch = assertEpochOneActive();
  const assertOriginalAuthorityStable = () => {
    if (heldLease(lease) !== held || parseLockRecord(held.lockBytes).pid !== process.pid
      || !sameColdFileMetadataV1(lockIdentity, fstatSync(held.descriptor, { bigint: true }))
      || !sameColdFileMetadataV1(lockIdentity, lstatSync(rootPaths().lock, { bigint: true }))
      || !readColdGenesisCandidateV1(rootPaths().lock, lockIdentity).equals(held.lockBytes)
      || canonical(assertEpochOneActive()) !== canonical(epoch)) fail("direct rebind physical authority changed");
  };
  assertOriginalAuthorityStable();
  return resolveDirectSpawnerRebindEvidenceV1(input, epoch, assertOriginalAuthorityStable);
}

// Shared immutable evidence, never shared controller ownership. Only the two
// code-owned wrappers supply their distinct original-authority assertions.
async function resolveDirectSpawnerRebindEvidenceV1(
  input: Readonly<{ currentEntryOperation: Readonly<{ operationRef: string; operationHash: string }>; restartAuthority: Readonly<{ restartAuthorityRef: string; restartAuthorityHash: string }> }>,
  epoch: Readonly<Record<string, unknown>>,
  assertOriginalAuthorityStable: () => void,
) {
  assertOriginalAuthorityStable();
  const exact = coldRecordV1(input, ["currentEntryOperation", "restartAuthority"], "direct rebind input");
  const operationPair = coldPairV1(exact.currentEntryOperation, "operation", "setfarm://internal-production/current-entry-operation/sha256/");
  const restartPair = coldPairV1(exact.restartAuthority, "restartAuthority", "setfarm://internal-production/pre-schema-spawner-restart-authority/sha256/");
  const rootGuard = authenticatePrivateDirectoryChainV1(resolveInternalProductionBaselineWorkspaceRootV1(), rootPaths().root);
  let epochPin: ReturnType<typeof pinStableCasPredecessorV1> | null = null;
  let processGuard: PrivateDirectoryGuardV1 | null = null;
  let processPin: ReturnType<typeof pinStableCasPredecessorV1> | null = null;
  const assertStable = (): void => {
    assertOriginalAuthorityStable();
    rootGuard.assertStable();
    if (canonical(assertEpochOneActive()) !== canonical(epoch)) fail("direct rebind original epoch changed");
    epochPin?.assertStable(); processGuard?.assertStable(); processPin?.assertStable(); rootGuard.assertStable();
  };
  try {
    epochPin = pinStableCasPredecessorV1(rootPaths().epoch, "direct rebind epoch");
    if (!epochPin.bytes.equals(Buffer.from(`${canonical(epoch)}\n`))) fail("direct rebind original epoch is crossed");
    assertStable();
    const receipt = await import("./baseline-post-handoff-receipt-v1.js"); assertStable();
    const startupModule = await import("./baseline-spawner-startup-admission-v1.js"); assertStable();
    const operation = await receipt.resolveInternalProductionCurrentEntryOperationV1(operationPair as { operationRef: string; operationHash: string }); assertStable();
    const restart = await startupModule.resolveInternalProductionPreSchemaSpawnerRestartAuthorityV1(restartPair as { restartAuthorityRef: string; restartAuthorityHash: string }); assertStable();
    if (operation.schema !== "setfarm.internal-production-current-entry-operation.v1" || operation.purpose !== "task6a-internal-production-current-entry-v1"
      || operation.operationRef !== operationPair.operationRef || operation.operationHash !== operationPair.operationHash
      || restart.schema !== "setfarm.internal-production-pre-schema-spawner-restart-authority.v2" || restart.restartAuthorityRef !== restartPair.restartAuthorityRef || restart.restartAuthorityHash !== restartPair.restartAuthorityHash
      || restart.actionId !== "task6a-pre-schema-setfarm-spawner-rebind-v1" || restart.service !== "setfarm-spawner" || restart.uid !== process.getuid?.()
      || restart.transport !== "direct-detached-node-v1" || restart.terminationSignal !== "SIGTERM" || restart.maximumTerminationDispatchCount !== 1 || restart.maximumSpawnDispatchCount !== 1) fail("direct rebind operation or transport is crossed");
    const startup = await startupModule.resolveInternalProductionPreSchemaSpawnerStartupTokenV1({ startupTokenRef: restart.startupTokenRef, startupTokenHash: restart.startupTokenHash }); assertStable();
    const authorization = await startupModule.resolveInternalProductionPreSchemaSpawnerRebindAuthorizationV1({ authorizationRef: restart.preSchemaSpawnerRebindAuthorizationRef, authorizationHash: restart.preSchemaSpawnerRebindAuthorizationHash }); assertStable();
    const legacy = await receipt.resolveInternalProductionLegacyPreManifestZeroOwnerObservationV1({ observationRef: authorization.legacyZeroOwnerObservationRef, observationHash: authorization.legacyZeroOwnerObservationHash }); assertStable();
    const preMutation = await receipt.resolveInternalProductionHistoricalPreMutationRuntimeAuthorityV1({ operationRef: operation.operationRef, operationHash: operation.operationHash }); assertStable();
    for (const value of [restart, startup, authorization, preMutation]) if (value.currentEntryOperationRef !== operation.operationRef || value.currentEntryOperationHash !== operation.operationHash) fail("direct rebind historical operation relation is crossed");
    if (startup.schema !== "setfarm.internal-production-pre-schema-spawner-startup-token.v1" || startup.startupMode !== "pre-manifest-bootstrap-sealed"
      || startup.startupTokenRef !== restart.startupTokenRef || startup.startupTokenHash !== restart.startupTokenHash
      || startup.preSchemaSpawnerRebindAuthorizationRef !== restart.preSchemaSpawnerRebindAuthorizationRef || startup.preSchemaSpawnerRebindAuthorizationHash !== restart.preSchemaSpawnerRebindAuthorizationHash
      || authorization.schema !== "setfarm.internal-production-pre-schema-spawner-rebind-authorization.v1" || authorization.purpose !== "task6a-pre-schema-setfarm-spawner-rebind-v1" || authorization.service !== "setfarm-spawner"
      || authorization.authorizationRef !== restart.preSchemaSpawnerRebindAuthorizationRef || authorization.authorizationHash !== restart.preSchemaSpawnerRebindAuthorizationHash
      || preMutation.preMutationLoadedRuntimeServiceAuthorityRef !== restart.preMutationLoadedRuntimeServiceAuthorityRef || preMutation.preMutationLoadedRuntimeServiceAuthorityHash !== restart.preMutationLoadedRuntimeServiceAuthorityHash) fail("direct rebind startup or original predecessor pair is crossed");
    if (authorization.authorityV3Migration31AuditRef !== operation.authorityV3Migration31Audit.authorityV3Migration31AuditRef || authorization.authorityV3Migration31AuditHash !== operation.authorityV3Migration31Audit.authorityV3Migration31AuditHash
      || legacy.authorityV3Migration31AuditRef !== authorization.authorityV3Migration31AuditRef || legacy.authorityV3Migration31AuditHash !== authorization.authorityV3Migration31AuditHash
      || legacy.observationRef !== authorization.legacyZeroOwnerObservationRef || legacy.observationHash !== authorization.legacyZeroOwnerObservationHash
      || legacy.cleanSetfarmSourceSha !== operation.controllerSource.sha || legacy.cleanSetfarmTreeHash !== operation.controllerSource.treeHash || legacy.cleanSetfarmBuildHash !== operation.controllerSource.buildHash
      || legacy.observedSpawnerGenerationHash !== authorization.predecessorSpawnerGenerationHash) fail("direct rebind audit or legacy-zero relation is crossed");
    const spawner = preMutation.spawner as Readonly<Record<string, unknown>>;
    const predecessor = { schema: "setfarm.internal-production-spawner-process-identity.v1", pid: spawner.pid, processStartTimeEpochMs: spawner.processStartTimeEpochMs, processIdentityHash: spawner.processIdentityHash };
    const predecessorHash = sha256(canonical(predecessor));
    for (const value of [restart, startup]) if (value.predecessorSpawnerProcessIdentityHash !== predecessorHash || value.predecessorSpawnerProcessIdentityRef !== `setfarm://internal-production/spawner-process-identity/sha256/${predecessorHash}`) fail("direct rebind predecessor process pair is crossed");
    for (const value of [restart, startup, authorization]) if (value.predecessorSpawnerServiceIdentityHash !== spawner.serviceIdentityHash || value.predecessorSpawnerGenerationHash !== spawner.generationHash) fail("direct rebind predecessor service relation is crossed");
    if (!Number.isSafeInteger(spawner.pid) || (spawner.pid as number) < 1 || !Number.isSafeInteger(spawner.processStartTimeEpochMs) || (spawner.processStartTimeEpochMs as number) < 1
      || typeof spawner.processIdentityHash !== "string" || !SHA256.test(spawner.processIdentityHash) || spawner.processOwnerCount !== 1 || spawner.listener !== null) fail("direct rebind predecessor projection is invalid");
    const processPath = resolveInternalProductionBaselineAuthorityPathV1("data/internal-production-baseline/pre-schema-spawner-rebind-v1/records/process-identity/sha256", predecessorHash.slice(0, 2), `${predecessorHash}.json`);
    processGuard = authenticatePrivateDirectoryChainV1(resolveInternalProductionBaselineWorkspaceRootV1(), path.dirname(processPath));
    processPin = pinStableCasPredecessorV1(processPath, "direct rebind predecessor");
    if (!processPin.bytes.equals(Buffer.from(`${canonical(predecessor)}\n`)) || lstatSync(processPath).uid !== restart.uid) fail("direct rebind stored predecessor is crossed");
    assertStable();
    const candidate = await receipt.observeInternalProductionSpawnerLaunchProfileCandidateV1(); assertStable();
    const profile = validateHistoricalSpawnerLaunchProfileV1(candidate.profile);
    if (profile.profileHash !== restart.launchProfileHash || canonical(profile.source) !== canonical(operation.controllerSource)) fail("direct rebind launch profile is crossed");
    const source = operation.controllerSource;
    if (restart.targetSpawnerSourceSha !== source.sha || restart.targetSpawnerTreeHash !== source.treeHash || restart.targetSpawnerBuildHash !== source.buildHash
      || startup.task0SpawnerSourceSha !== source.sha || startup.task0SpawnerTreeHash !== source.treeHash || startup.task0SpawnerBuildHash !== source.buildHash
      || authorization.cleanSetfarmSourceSha !== source.sha || authorization.cleanSetfarmTreeHash !== source.treeHash || authorization.cleanSetfarmBuildHash !== source.buildHash) fail("direct rebind source relation is crossed");
    const environment = candidate.environment;
    if (!environment || typeof environment !== "object" || Array.isArray(environment) || (Object.getPrototypeOf(environment) !== null && Object.getPrototypeOf(environment) !== Object.prototype)
      || Reflect.ownKeys(environment).some(key => typeof key !== "string") || Object.values(environment).some(value => typeof value !== "string")
      || profile.environmentHash !== sha256(`setfarm.internal-production-spawner-launch-environment-candidate.v1\n${canonical(environment)}`)) fail("direct rebind environment is crossed");
    const finalPreMutation = await receipt.resolveInternalProductionHistoricalPreMutationRuntimeAuthorityV1({ operationRef: operation.operationRef, operationHash: operation.operationHash }); assertStable();
    if (canonical(finalPreMutation) !== canonical(preMutation)) fail("direct rebind original predecessor changed");
    const result = { operation, restart, startup, authorization, legacy, preMutation, profile, epoch } as Readonly<{
      operation: typeof operation; restart: typeof restart; startup: typeof startup; authorization: typeof authorization;
      legacy: typeof legacy; preMutation: typeof preMutation; profile: typeof profile; epoch: typeof epoch; environment: typeof environment;
    }>;
    Object.defineProperty(result, "environment", { value: freezeColdDataV1({ ...environment }), enumerable: false, writable: false, configurable: false });
    assertStable();
    return freezeColdDataV1(result);
  } finally {
    let cleanupError: unknown = null;
    for (const owner of [processPin, processGuard, epochPin, rootGuard]) {
      try { owner?.close(); } catch (error) { cleanupError ??= error; }
    }
    if (cleanupError !== null) throw cleanupError;
  }
}

function publishDirectSpawnerRebindIntentV1(state: DirectSpawnerRebindIntentStateV1): void {
  const publication = state.publication, target = rootPaths().journal;
  const bytes = Buffer.from(`${canonical(state.intent)}\n`);
  const at = (file: string): BigIntStats | null => {
    try { return lstatSync(file, { bigint: true }); }
    catch (error) { if (error instanceof Error && "code" in error && error.code === "ENOENT") return null; throw error; }
  };
  const assertOriginal = (): BigIntStats => {
    state.rootGuard.assertStable();
    if (publication.descriptor === null || publication.identity === null) return fail("direct intent original publication descriptor is unavailable");
    const held = fstatSync(publication.descriptor, { bigint: true });
    if (!sameColdFileMetadataV1(publication.identity, held)) fail("direct intent original publication identity changed");
    return held;
  };
  const assertPath = (file: string): void => {
    const held = assertOriginal(), visible = at(file);
    if (visible === null || !sameColdFileMetadataV1(held, visible)
      || !readColdGenesisCandidateV1(file, held, 2).equals(bytes)) fail("direct intent original publication path is crossed");
    assertOriginal();
  };
  const refreshOwnedLinkChange = (): void => {
    const before = publication.identity!, after = fstatSync(publication.descriptor!, { bigint: true });
    // Only our link/unlink may change nlink and ctime. Data, provenance and
    // every other identity field remain those of the retained descriptor.
    if (!sameColdFileMetadataV1({ ...before, nlink: after.nlink, ctimeNs: after.ctimeNs } as BigIntStats, after)
      || after.nlink < 1n || after.nlink > 2n) fail("direct intent publication changed during owned link transition");
    publication.identity = after;
  };
  state.rootGuard.assertStable();
  const candidates = readdirSync(path.dirname(target)).filter(name => name.startsWith(`.${path.basename(target)}.`));
  if (candidates.some(name => name !== path.basename(publication.temporary)) || candidates.length > 1) fail("direct intent publication inventory is crossed");
  if (!publication.openAttempted) {
    if (at(target) !== null || at(publication.temporary) !== null) fail("direct intent cannot adopt an unowned publication");
    publication.openAttempted = true;
    publication.descriptor = openSync(publication.temporary, constants.O_RDWR | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
    publication.identity = fstatSync(publication.descriptor, { bigint: true });
    // No repeat write after an entered write: a partial/unrecognized file is
    // fenced. A complete write with a lost response can proceed via this FD.
    try { writeFileSync(publication.descriptor, bytes); }
    finally { publication.identity = fstatSync(publication.descriptor, { bigint: true }); }
  }
  assertOriginal();
  if (publication.committed) {
    assertPath(target);
    if (at(publication.temporary) !== null) fail("direct intent completed publication has a temporary");
    return;
  }
  if (at(target) === null) {
    if (publication.unlinkAttempted) fail("direct intent published original disappeared");
    assertPath(publication.temporary);
    if (assertOriginal().nlink !== 1n) fail("direct intent temporary has an unknown link");
    fsyncSync(publication.descriptor!);
    assertPath(publication.temporary);
    publication.linkAttempted = true;
    try { linkSync(publication.temporary, target); }
    finally { refreshOwnedLinkChange(); }
  } else if (!publication.linkAttempted) fail("direct intent final publication is unowned");
  assertPath(target);
  fsyncSync(publication.descriptor!);
  if (at(publication.temporary) !== null) {
    assertPath(publication.temporary);
    if (assertOriginal().nlink !== 2n) fail("direct intent publication links are crossed");
    fsyncParent(target);
    assertPath(target); assertPath(publication.temporary);
    publication.unlinkAttempted = true;
    try { unlinkSync(publication.temporary); }
    finally { refreshOwnedLinkChange(); }
  } else if (!publication.unlinkAttempted) fail("direct intent temporary disappeared before owned cleanup");
  if (assertOriginal().nlink !== 1n) fail("direct intent final publication has an unknown link");
  // In particular, repeat this after final-only fsync response loss. Equal
  // bytes alone neither prove durability nor authorize a replacement inode.
  fsyncSync(publication.descriptor!);
  fsyncParent(target);
  assertPath(target);
  if (at(publication.temporary) !== null) fail("direct intent temporary reappeared after cleanup");
  publication.committed = true;
}

async function prepareDirectSpawnerRebindIntentV1(
  lease: InternalProductionPhysicalServiceRestartAuthorityTransitionLeaseV1,
  input: Parameters<typeof resolveDirectSpawnerRebindInputsUnderLeaseV1>[1],
): Promise<Readonly<Record<string, unknown>>> {
  if (directSpawnerRebindPreparationActiveV1) fail("direct rebind preparation is already active");
  directSpawnerRebindPreparationActiveV1 = true;
  try {
    const held = heldLease(lease);
    if (retainedDirectSpawnerRebindIntentV1 !== null && retainedDirectSpawnerRebindIntentV1.lease !== lease) fail("direct rebind preparation has another retained lease");
    const inputs = await resolveDirectSpawnerRebindInputsUnderLeaseV1(lease, input);
    if (retainedDirectSpawnerRebindIntentV1 === null) {
      const nonce = randomBytes(32).toString("hex");
      const body = {
        schema: "setfarm.internal-production-pre-schema-spawner-direct-rebind-intent.v1", purpose: "operation-bound-pre-schema-spawner-rebind-v1",
        transport: "direct-detached-node-v1", terminationSignal: "SIGTERM", maximumTerminationDispatchCount: 1, maximumSpawnDispatchCount: 1,
        currentEntryOperation: { operationRef: inputs.operation.operationRef, operationHash: inputs.operation.operationHash },
        restartAuthority: { restartAuthorityRef: inputs.restart.restartAuthorityRef, restartAuthorityHash: inputs.restart.restartAuthorityHash },
        startupToken: { startupTokenRef: inputs.startup.startupTokenRef, startupTokenHash: inputs.startup.startupTokenHash },
        predecessorSpawnerProcessIdentity: { predecessorSpawnerProcessIdentityRef: inputs.startup.predecessorSpawnerProcessIdentityRef, predecessorSpawnerProcessIdentityHash: inputs.startup.predecessorSpawnerProcessIdentityHash },
        preMutationLoadedRuntimeServiceAuthority: { preMutationLoadedRuntimeServiceAuthorityRef: inputs.preMutation.preMutationLoadedRuntimeServiceAuthorityRef, preMutationLoadedRuntimeServiceAuthorityHash: inputs.preMutation.preMutationLoadedRuntimeServiceAuthorityHash },
        launchProfile: inputs.profile, epoch: { epochRef: inputs.epoch.epochRef, epochHash: inputs.epoch.epochHash },
        transitionLock: parseLockRecord(held.lockBytes), lockIdentity: descriptorIdentity(held.descriptor), nonceHash: sha256(nonce),
      };
      const intentHash = sha256(canonical(body));
      const bytes = Buffer.from(`${canonical({ ...body, intentRef: `setfarm://internal-production/pre-schema-spawner-direct-rebind-intent/sha256/${intentHash}`, intentHash })}\n`);
      if (bytes.length > 1_048_576) fail("direct rebind intent exceeds its publication cap");
      const intent = parseDirectSpawnerRebindIntentV1(bytes);
      const lockIdentity = fstatSync(held.descriptor, { bigint: true });
      const temporary = path.join(rootPaths().root, `.${path.basename(rootPaths().journal)}.${randomBytes(16).toString("hex")}.tmp`);
      const rootGuard = authenticatePrivateDirectoryChainV1(resolveInternalProductionBaselineWorkspaceRootV1(), rootPaths().root);
      // Register before any publication attempt, including failures before the
      // intent becomes visible. Ordinary release must not discard this owner.
      retainedDirectSpawnerRebindIntentV1 = { lease, inputs, intent, nonce, lockIdentity, rootGuard, epochPin: null, intentPin: null, termination: null,
        publication: { temporary, descriptor: null, identity: null, openAttempted: false, linkAttempted: false, unlinkAttempted: false, committed: false } };
    }
    const state = retainedDirectSpawnerRebindIntentV1;
    if (canonical(inputs) !== canonical(state.inputs) || canonical(inputs.environment) !== canonical(state.inputs.environment)) fail("direct rebind original preparation inputs changed");
    const assertStable = (): void => {
      if (retainedDirectSpawnerRebindIntentV1 !== state || heldLease(lease) !== held) fail("direct rebind retained preparation changed");
      state.rootGuard.assertStable();
      if (!sameColdFileMetadataV1(state.lockIdentity, fstatSync(held.descriptor, { bigint: true }))
        || !sameColdFileMetadataV1(state.lockIdentity, lstatSync(rootPaths().lock, { bigint: true }))
        || !readColdGenesisCandidateV1(rootPaths().lock, state.lockIdentity).equals(held.lockBytes)
        || canonical(assertEpochOneActive()) !== canonical(state.inputs.epoch)) fail("direct rebind retained physical authority changed");
      state.epochPin?.assertStable(); state.intentPin?.assertStable(); state.rootGuard.assertStable();
    };
    assertStable();
    state.epochPin ??= pinStableCasPredecessorV1(rootPaths().epoch, "direct rebind retained epoch");
    if (!state.epochPin.bytes.equals(Buffer.from(`${canonical(state.inputs.epoch)}\n`))) fail("direct rebind retained epoch is crossed");
    assertStable();
    publishDirectSpawnerRebindIntentV1(state);
    if (state.intentPin === null) {
      const target = rootPaths().journal, bytes = Buffer.from(`${canonical(state.intent)}\n`);
      assertStable();
      state.intentPin = pinStableCasPredecessorV1(target, "direct rebind retained intent");
      if (!state.intentPin.bytes.equals(bytes)) fail("direct rebind retained intent is crossed");
    }
    // The separately opened final pin cannot replace the original publication
    // FD, and a completed intent does not waive pending-inventory checks.
    publishDirectSpawnerRebindIntentV1(state);
    assertStable();
    return state.intent;
  } finally { directSpawnerRebindPreparationActiveV1 = false; }
}

function observeDirectSpawnerTerminationTargetV1(pid: number) {
  if (!Number.isSafeInteger(pid) || pid < 1 || pid === process.pid) fail("direct termination target PID is invalid");
  const observed = spawnSync("/bin/ps", ["-ww", "-p", String(pid), "-o", "uid=,pid=,ppid=,pgid=,stat=,lstart=,command="], {
    env: { PATH: "/usr/bin:/bin", LANG: "C", LC_ALL: "C" }, shell: false, encoding: "utf8", timeout: 2000, maxBuffer: 65_536,
  });
  if (!observed.error && !observed.signal && observed.status === 1 && observed.stdout === "" && observed.stderr === "") return null;
  const match = /^\s*([0-9]+)\s+([0-9]+)\s+([0-9]+)\s+([0-9]+)\s+(\S+)\s+(.{24})\s+([^\r\n]+)\n$/.exec(observed.stdout);
  if (observed.error || observed.signal || observed.status !== 0 || observed.stderr !== "" || !match) return fail("direct termination process observation is ambiguous");
  const [uid, actualPid, ppid, pgid] = match.slice(1, 5).map(Number), lstart = match[6]!;
  const processStartTimeEpochMs = Date.parse(lstart);
  if ([uid, actualPid, ppid, pgid, processStartTimeEpochMs].some(value => !Number.isSafeInteger(value))
    || actualPid !== pid || processStartTimeEpochMs < 1) fail("direct termination process identity is malformed");
  return Object.freeze({ uid: uid!, pid, ppid: ppid!, pgid: pgid!, stat: match[5]!, lstart, command: match[7]!, processStartTimeEpochMs,
    processIdentityHash: sha256(`${pid}\n${lstart}\n`) });
}

function assertDirectSpawnerSignalTargetV1(state: DirectSpawnerRebindIntentStateV1) {
  const profile = state.inputs.profile as Record<string, any>, predecessor = state.inputs.preMutation.spawner as Record<string, any>;
  const current = observeDirectSpawnerTerminationTargetV1(predecessor.pid);
  if (!current || current.uid !== profile.uid || current.ppid !== 1 || current.pgid !== current.pid || /[ZE]/.test(current.stat)
    || current.processStartTimeEpochMs !== predecessor.processStartTimeEpochMs || current.processIdentityHash !== predecessor.processIdentityHash
    || current.command !== `${profile.executable.path} ${profile.arguments[0]}`) return fail("direct termination stored predecessor identity is crossed");
  const command = (executable: string, arguments_: string[]) => {
    const result = spawnSync(executable, arguments_, { env: { PATH: "/usr/bin:/bin", LANG: "C", LC_ALL: "C" }, shell: false, encoding: "utf8", timeout: 2000, maxBuffer: 65_536 });
    if (result.error || result.signal || result.status !== 0 || result.stderr !== "") fail("direct termination target executable/cwd observation failed");
    return result.stdout;
  };
  if (command("/bin/ps", ["-ww", "-p", String(current.pid), "-o", "comm="]) !== `${profile.executable.path}\n`) fail("direct termination executable is crossed");
  const cwd = command("/usr/sbin/lsof", ["-a", "-p", String(current.pid), "-d", "cwd", "-F0pcRfn"]);
  if (!cwd.endsWith("\0\n") || cwd.includes("\r")) fail("direct termination cwd is malformed");
  const fields = cwd.split("\0").map(field => field.replace(/^\n+/, "")).filter(Boolean);
  for (const [prefix, expected] of [["p", String(current.pid)], ["R", "1"], ["n", profile.cwd]] as const) {
    if (canonical(fields.filter(field => field.startsWith(prefix))) !== canonical([`${prefix}${expected}`])) fail("direct termination cwd is crossed");
  }
  const after = observeDirectSpawnerTerminationTargetV1(current.pid);
  if (!after || ["uid", "pid", "ppid", "pgid", "lstart", "command", "processIdentityHash"].some(key => after[key as keyof typeof after] !== current[key as keyof typeof current])
    || /[ZE]/.test(after.stat)) fail("direct termination target changed before signal");
  return current;
}

function assertDirectTerminationPublicationV1(publication: DirectTerminationPublicationV1): void {
  if (!publication.synced || publication.descriptor === null || publication.identity === null
    || !sameColdFileMetadataV1(publication.identity, fstatSync(publication.descriptor, { bigint: true }))
    || !readColdGenesisCandidateV1(publication.file, publication.identity).equals(Buffer.from(`${canonical(publication.record)}\n`))) fail("direct termination publication is uncertain or crossed");
}

function publishDirectTerminationRecordV1(publication: DirectTerminationPublicationV1, guard: PrivateDirectoryGuardV1): void {
  guard.assertStable();
  if (publication.started) { assertDirectTerminationPublicationV1(publication); guard.assertStable(); return; }
  publication.started = true;
  publication.descriptor = openSync(publication.file, constants.O_CREAT | constants.O_EXCL | constants.O_RDWR | constants.O_NOFOLLOW, 0o600);
  const created = fstatSync(publication.descriptor, { bigint: true });
  publication.identity = created;
  const bytes = Buffer.from(`${canonical(publication.record)}\n`);
  if (bytes.length > 1_048_576 || !created.isFile() || created.nlink !== 1n || created.uid !== BigInt(process.getuid!())
    || (created.mode & 0o7777n) !== 0o600n || created.size !== 0n
    || !sameColdFileMetadataV1(created, lstatSync(publication.file, { bigint: true }))) fail("direct termination publication creation is crossed");
  writeFileSync(publication.descriptor, bytes);
  fsyncSync(publication.descriptor);
  fsyncParent(publication.file);
  const written = fstatSync(publication.descriptor, { bigint: true });
  if (written.dev !== created.dev || written.ino !== created.ino || written.uid !== created.uid || written.gid !== created.gid
    || written.mode !== created.mode || written.birthtimeNs !== created.birthtimeNs || written.nlink !== 1n
    || !readColdGenesisCandidateV1(publication.file, written).equals(bytes)) fail("direct termination publication changed while written");
  publication.identity = written;
  publication.synced = true;
  assertDirectTerminationPublicationV1(publication); guard.assertStable();
}

async function terminateDirectSpawnerRebindPredecessorV1(
  lease: InternalProductionPhysicalServiceRestartAuthorityTransitionLeaseV1,
  input: Parameters<typeof prepareDirectSpawnerRebindIntentV1>[1],
): Promise<Readonly<Record<string, unknown>>> {
  if (directSpawnerTerminationActiveV1) fail("direct termination invocation is already active");
  directSpawnerTerminationActiveV1 = true;
  try {
    await prepareDirectSpawnerRebindIntentV1(lease, input);
    const state = retainedDirectSpawnerRebindIntentV1!;
    const root = path.join(rootPaths().root, "direct-spawner-rebind-v1");
    state.termination ??= { rootGuard: ensurePrivateAuthorityDirectoryV1(root), dispatch: null, signalEntered: false, signalReturned: false, receipt: null };
    const termination = state.termination, held = heldLease(lease), predecessor = state.inputs.preMutation.spawner as Record<string, any>;
    const assertStable = () => {
      if (retainedDirectSpawnerRebindIntentV1 !== state || state.lease !== lease || heldLease(lease) !== held) fail("direct termination retained owner changed");
      state.rootGuard.assertStable(); termination.rootGuard.assertStable(); state.epochPin!.assertStable(); state.intentPin!.assertStable();
      publishDirectSpawnerRebindIntentV1(state);
      if (!sameColdFileMetadataV1(state.lockIdentity, fstatSync(held.descriptor, { bigint: true }))
        || !readColdGenesisCandidateV1(rootPaths().lock, state.lockIdentity).equals(held.lockBytes)
        || canonical(assertEpochOneActive()) !== canonical(state.inputs.epoch)) fail("direct termination original lease changed");
      const members = [termination.dispatch === null ? null : "termination-dispatch.json", termination.receipt === null ? null : "termination-receipt.json"].filter(value => value !== null);
      if (canonical(readColdDirectoryMembersV1(root, 2).sort()) !== canonical(members)) fail("direct termination inventory is crossed");
      if (termination.dispatch !== null) assertDirectTerminationPublicationV1(termination.dispatch);
      if (termination.receipt !== null) assertDirectTerminationPublicationV1(termination.receipt);
      termination.rootGuard.assertStable(); state.rootGuard.assertStable();
    };
    assertStable();
    if (termination.receipt !== null) return termination.receipt.record;
    if (termination.dispatch === null) {
      const receipt = await import("./baseline-post-handoff-receipt-v1.js"); assertStable();
      const census = await receipt.observeInternalProductionServiceCensusV1(); assertStable();
      const fresh = census.spawner;
      if (["pid", "processStartTimeEpochMs", "processIdentityHash", "serviceIdentityHash", "generationHash", "processOwnerCount", "listener"].some(key => canonical(fresh[key as keyof typeof fresh]) !== canonical(predecessor[key]))
        || fresh.loadedSourceSha !== state.inputs.restart.targetSpawnerSourceSha || fresh.loadedTreeHash !== state.inputs.restart.targetSpawnerTreeHash
        || fresh.loadedBuildHash !== state.inputs.restart.targetSpawnerBuildHash) fail("direct termination fresh predecessor census is crossed");
      const profile = await receipt.observeInternalProductionSpawnerLaunchProfileCandidateV1(); assertStable();
      if (canonical(profile.profile) !== canonical(state.inputs.profile) || canonical(profile.environment) !== canonical(state.inputs.environment)) fail("direct termination source/profile changed");
      const target = assertDirectSpawnerSignalTargetV1(state); assertStable();
      const controller = parseLockRecord(held.lockBytes);
      const body = { schema: "setfarm.internal-production-pre-schema-spawner-direct-termination-dispatch.v1", purpose: "operation-bound-pre-schema-spawner-rebind-v1",
        intentRef: state.intent.intentRef, intentHash: state.intent.intentHash, intentIdentity: coldFileIdentityTupleV1(state.publication.identity!),
        controller: { pid: controller.pid, processStartTimeEpochMs: controller.processStartTimeEpochMs, processIdentityHash: controller.processIdentityHash, uid: process.getuid!() },
        target, serviceCensusHash: census.censusHash, terminationSignal: "SIGTERM", maximumTerminationDispatchCount: 1 };
      const dispatchHash = sha256(canonical(body));
      const record = freezeColdDataV1({ ...body, dispatchRef: `setfarm://internal-production/pre-schema-spawner-direct-termination-dispatch/sha256/${dispatchHash}`, dispatchHash });
      termination.dispatch = { record, file: path.join(root, "termination-dispatch.json"), descriptor: null, identity: null, started: false, synced: false };
      publishDirectTerminationRecordV1(termination.dispatch, termination.rootGuard);
      assertStable();
      const finalProfile = await receipt.observeInternalProductionSpawnerLaunchProfileCandidateV1(); assertStable();
      if (canonical(finalProfile.profile) !== canonical(state.inputs.profile) || canonical(finalProfile.environment) !== canonical(state.inputs.environment)) fail("direct termination source/profile changed after dispatch publication");
      assertDirectSpawnerSignalTargetV1(state); assertStable();
      // Retain entry BEFORE the syscall. Even a lost/failed response can never
      // turn a later invocation into permission for another signal.
      termination.signalEntered = true;
      process.kill(predecessor.pid, "SIGTERM");
      termination.signalReturned = true;
    }
    if (!termination.signalEntered) fail("DIRECT_TERMINATION_PENDING: published dispatch did not enter its signal call");
    for (let attempt = 0; attempt < 40; attempt++) {
      assertStable();
      const observed = observeDirectSpawnerTerminationTargetV1(predecessor.pid);
      if (observed === null) {
        assertStable();
        const dispatch = termination.dispatch!.record;
        const body = { schema: "setfarm.internal-production-pre-schema-spawner-direct-termination-receipt.v1", purpose: "operation-bound-pre-schema-spawner-rebind-v1",
          intentRef: state.intent.intentRef, intentHash: state.intent.intentHash, dispatchRef: dispatch.dispatchRef, dispatchHash: dispatch.dispatchHash,
          controller: dispatch.controller, predecessorSpawnerProcessIdentity: state.intent.predecessorSpawnerProcessIdentity,
          terminationSignal: "SIGTERM", signalDispatchCount: 1, signalCallOutcome: termination.signalReturned ? "returned" : "response-unknown",
          observedProcessState: "terminal-and-not-running", observedListenerState: "absent" };
        const terminationReceiptHash = sha256(canonical(body));
        const record = freezeColdDataV1({ ...body, terminationReceiptRef: `setfarm://internal-production/pre-schema-spawner-direct-termination-receipt/sha256/${terminationReceiptHash}`, terminationReceiptHash });
        termination.receipt = { record, file: path.join(root, "termination-receipt.json"), descriptor: null, identity: null, started: false, synced: false };
        publishDirectTerminationRecordV1(termination.receipt, termination.rootGuard); assertStable();
        return record;
      }
      if (observed.uid !== state.inputs.profile.uid || observed.pgid !== predecessor.pid || observed.processStartTimeEpochMs !== predecessor.processStartTimeEpochMs
        || observed.processIdentityHash !== predecessor.processIdentityHash) fail("direct termination original PID was reused or crossed");
      if (attempt < 39) await new Promise(resolve => setTimeout(resolve, 250));
    }
    return fail("DIRECT_TERMINATION_PENDING: original predecessor remains present");
  } finally { directSpawnerTerminationActiveV1 = false; }
}

// Transport preparation only. The controller must retain the returned handles
// in its one-shot helper invocation; this function never creates a helper grant.
function openDirectSpawnerHelperFrameV1(state: DirectSpawnerRebindIntentStateV1): Readonly<{ frameDescriptor: number; intentDescriptor: number }> {
  for (const pending of pendingColdHelperAuthenticationCleanupV1) pending();
  if (!state || state !== retainedDirectSpawnerRebindIntentV1 || !state.publication.committed || state.termination?.receipt === null
    || !state.termination?.signalEntered) fail("direct helper frame owner is invalid");
  const termination = state.termination!, dispatch = termination.dispatch!, receipt = termination.receipt!;
  const paths = rootPaths(), root = path.join(paths.root, "direct-spawner-rebind-v1"), held = heldLease(state.lease);
  const assertAuthority = () => {
    if (state !== retainedDirectSpawnerRebindIntentV1 || heldLease(state.lease) !== held) fail("direct helper frame owner changed");
    state.rootGuard.assertStable(); termination.rootGuard.assertStable(); state.epochPin!.assertStable(); state.intentPin!.assertStable();
    publishDirectSpawnerRebindIntentV1(state);
    if (!sameColdFileMetadataV1(state.lockIdentity, fstatSync(held.descriptor, { bigint: true }))
      || !readColdGenesisCandidateV1(paths.lock, state.lockIdentity).equals(held.lockBytes)
      || canonical(assertEpochOneActive()) !== canonical(state.inputs.epoch)) fail("direct helper frame original lease changed");
    assertDirectTerminationPublicationV1(dispatch); assertDirectTerminationPublicationV1(receipt);
    const history = parseDirectSpawnerTerminationChainV1(Buffer.from(`${canonical(dispatch.record)}\n`), Buffer.from(`${canonical(receipt.record)}\n`), state.intent, state.inputs.preMutation);
    if (canonical(history.dispatch.intentIdentity) !== canonical(coldFileIdentityTupleV1(state.publication.identity!))) fail("direct helper frame original intent identity changed");
    state.rootGuard.assertStable(); termination.rootGuard.assertStable();
  };
  const assertInventory = () => {
    if (canonical(readColdDirectoryMembersV1(root, 2).sort()) !== canonical(["termination-dispatch.json", "termination-receipt.json"])) fail("direct helper frame journal inventory is crossed");
  };
  assertAuthority(); assertInventory();
  if (observeDirectSpawnerTerminationTargetV1((state.inputs.preMutation.spawner as Record<string, any>).pid) !== null) fail("direct helper predecessor is present");
  assertAuthority(); assertInventory();
  const scratch = path.join(root, `.direct-helper-capability.${randomBytes(16).toString("hex")}.tmp`);
  let writer: number | undefined, reader: number | undefined, intentDescriptor: number | undefined, linkedIdentity: BigIntStats | undefined;
  let unlinked = false;
  const uncertainCloses = new Set<number>();
  const closeOriginal = (fd: number, expected: BigIntStats | undefined, completed: () => void) => {
    let current: BigIntStats;
    const done = () => { uncertainCloses.delete(fd); completed(); };
    try { current = fstatSync(fd, { bigint: true }); }
    catch (error) { if (error instanceof Error && "code" in error && error.code === "EBADF") { done(); return; } throw error; }
    if (!expected) fail("direct helper cleanup original identity is unavailable");
    // Own unlink/write operations may change size/timestamps. Inode equality
    // does NOT prove open-file-description equality after an uncertain close:
    // a foreign reopen of this same inode must not become ours to close again.
    if (["dev", "ino", "uid", "gid", "mode", "birthtimeNs"].some(key => current[key as keyof BigIntStats] !== expected[key as keyof BigIntStats])) {
      done(); fail("direct helper cleanup descriptor was reused");
    }
    if (uncertainCloses.has(fd)) fail("direct helper close outcome is ambiguous");
    uncertainCloses.add(fd);
    closeSync(fd); done();
  };
  try {
    intentDescriptor = openSync(paths.journal, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
    if (!sameColdFileMetadataV1(state.publication.identity!, fstatSync(intentDescriptor, { bigint: true }))) fail("direct helper frame inherited intent is crossed");
    const frame = { schema: "setfarm.internal-production-pre-schema-spawner-direct-rebind-helper-capability.v1",
      intentRef: state.intent.intentRef, intentHash: state.intent.intentHash, intentIdentity: coldFileIdentityTupleV1(state.publication.identity!),
      terminationDispatchRef: dispatch.record.dispatchRef, terminationDispatchHash: dispatch.record.dispatchHash, terminationDispatchIdentity: coldFileIdentityTupleV1(dispatch.identity!),
      terminationReceiptRef: receipt.record.terminationReceiptRef, terminationReceiptHash: receipt.record.terminationReceiptHash, terminationReceiptIdentity: coldFileIdentityTupleV1(receipt.identity!),
      lockIdentity: state.intent.lockIdentity, environment: state.inputs.environment, nonce: state.nonce };
    const bytes = Buffer.from(`${canonical(frame)}\n`);
    if (bytes.length < 1 || bytes.length > 1_048_576) fail("direct helper frame exceeds its cap");
    assertAuthority(); assertInventory();
    writer = openSync(scratch, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
    linkedIdentity = fstatSync(writer, { bigint: true });
    if (!linkedIdentity.isFile() || linkedIdentity.uid !== BigInt(process.getuid!()) || linkedIdentity.dev !== dispatch.identity!.dev
      || (linkedIdentity.mode & 0o7777n) !== 0o600n || linkedIdentity.nlink !== 1n || linkedIdentity.size !== 0n) fail("direct helper empty frame identity is invalid");
    reader = openSync(scratch, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
    assertAuthority();
    if (canonical(readColdDirectoryMembersV1(root, 3).sort()) !== canonical([path.basename(scratch), "termination-dispatch.json", "termination-receipt.json"].sort())
      || !sameColdFileMetadataV1(linkedIdentity, fstatSync(writer, { bigint: true }))
      || !sameColdFileMetadataV1(linkedIdentity, fstatSync(reader, { bigint: true }))
      || !sameColdFileMetadataV1(linkedIdentity, lstatSync(scratch, { bigint: true }))) fail("direct helper empty frame changed before unlink");
    unlinkSync(scratch); unlinked = true;
    const originalEmptyFrame = assertOriginalEmptyUnlinkedFrameV1(writer, reader, linkedIdentity);
    fsyncParent(scratch);
    assertAuthority(); assertInventory();
    assertOriginalEmptyUnlinkedFrameV1(writer, reader, originalEmptyFrame);
    // No nonce or environment value is written while a pathname names the file.
    writeFileSync(writer, bytes); fsyncSync(writer);
    const written = fstatSync(reader, { bigint: true });
    if (written.nlink !== 0n || written.size !== BigInt(bytes.length) || written.dev !== linkedIdentity.dev || written.ino !== linkedIdentity.ino
      || written.uid !== linkedIdentity.uid || written.gid !== linkedIdentity.gid || written.mode !== linkedIdentity.mode || written.birthtimeNs !== linkedIdentity.birthtimeNs
      || !sameColdFileMetadataV1(written, fstatSync(writer, { bigint: true }))) fail("direct helper frame write identity is crossed");
    const verified = Buffer.alloc(bytes.length);
    for (let offset = 0; offset < verified.length;) {
      const count = readSync(reader, verified, offset, Math.min(65_536, verified.length - offset), offset);
      if (count < 1) fail("direct helper frame read is partial");
      offset += count;
    }
    if (!verified.equals(bytes) || readSync(reader, Buffer.alloc(1), 0, 1, verified.length) !== 0
      || !sameColdFileMetadataV1(written, fstatSync(reader, { bigint: true }))) fail("direct helper frame read changed");
    closeOriginal(writer, linkedIdentity, () => { writer = undefined; });
    assertAuthority(); assertInventory();
    if (!sameColdFileMetadataV1(state.publication.identity!, fstatSync(intentDescriptor, { bigint: true }))) fail("direct helper inherited intent changed");
    if (!sameColdFileMetadataV1(written, fstatSync(reader, { bigint: true }))) fail("direct helper frame changed before handoff");
    for (let offset = 0; offset < verified.length;) {
      const count = readSync(reader, verified, offset, Math.min(65_536, verified.length - offset), offset);
      if (count < 1) fail("direct helper final frame read is partial");
      offset += count;
    }
    if (!verified.equals(bytes) || readSync(reader, Buffer.alloc(1), 0, 1, verified.length) !== 0
      || !sameColdFileMetadataV1(written, fstatSync(reader, { bigint: true }))) fail("direct helper final frame changed");
    const handles = Object.freeze({ frameDescriptor: reader, intentDescriptor });
    reader = undefined; intentDescriptor = undefined;
    return handles;
  } catch {
    if (!unlinked && linkedIdentity !== undefined) {
      try {
        state.rootGuard.assertStable(); termination.rootGuard.assertStable();
        const current = lstatSync(scratch, { bigint: true });
        if (sameColdFileMetadataV1(linkedIdentity, current) && current.nlink === 1n && current.size === 0n) { unlinkSync(scratch); fsyncParent(scratch); }
      } catch { /* Preserve foreign or ambiguous empty evidence and the lease. */ }
    }
    return fail("direct helper frame preparation failed");
  } finally {
    finishRetainedColdCleanupV1(() => {
      let failure: unknown = null;
      try { if (writer !== undefined) closeOriginal(writer, linkedIdentity, () => { writer = undefined; }); } catch (error) { failure ??= error; }
      try { if (reader !== undefined) closeOriginal(reader, linkedIdentity, () => { reader = undefined; }); } catch (error) { failure ??= error; }
      try { if (intentDescriptor !== undefined) closeOriginal(intentDescriptor, state.publication.identity ?? undefined, () => { intentDescriptor = undefined; }); } catch (error) { failure ??= error; }
      if (failure !== null) throw failure;
    });
  }
}

function assertHelperJournalAllowsLockCleanup(
  transitionLock: Readonly<Record<string, unknown>>,
  currentLockIdentity: Readonly<{ devDecimal: string; inoDecimal: string }>,
): void {
  observeInternalProductionColdSpawnerBootstrapJournalCensusV1();
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
  if ((value as Record<string, unknown> | null)?.schema === "setfarm.internal-production-pre-schema-spawner-direct-rebind-intent.v1") {
    parseDirectSpawnerRebindIntentV1(bytes);
    fail("DIRECT_REBIND_UNSETTLED: direct intent has no authenticated terminal");
  }
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
      // A recovered complete temporary may precede its original data fsync.
      // Sync both identities before removing recovery evidence or admitting a head.
      fsyncSync(temporaryDescriptor);
      fsyncSync(finalDescriptor);
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

const COLD_GENESIS_PREFIX_V1 = "setfarm://internal-production/cold-epoch-genesis/sha256/";
const COLD_GENESIS_MAX_BYTES_V1 = 8_388_608;
const COLD_INCIDENT_HASH_V1 = "90fc2fedc56db22bb013ad1b243e9dc386473d6b4284ede135e26fd1ab82fe3d";
const COLD_INCIDENT_BYTES_HASH_V1 = "ebcba187e953fda9e7962a0ce0cf4fc10feed881e9ce69b6d59140a9ef43d7f6";
const COLD_INCIDENT_FINGERPRINT_V1 = "9e07f9bd60955a9a681b7365a3c48cb087ff7d46459a5b9885283e0a3492ce65";
const COLD_EPOCH_SERVICES_V1 = ["setfarm-spawner", "setfarm-dashboard", "mission-control"] as const;
const COLD_SYNTHETIC_GIT_ABSENCE_V1 = [
  { repository: "setfarm", objectSha: "4fc67f20df0e935c703c4658a29dbbaa9aa0a956", objectType: "commit", state: "absent", networkAccess: "forbidden" },
  { repository: "mission-control", objectSha: "4ec5fc99a076453a87381c0c75e508d25dd8882d", objectType: "commit", state: "absent", networkAccess: "forbidden" },
] as const;

function coldRecordV1(value: unknown, keys: readonly string[], label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype
    || Reflect.ownKeys(value).some((key) => typeof key !== "string")
    || canonical(Object.keys(value).sort()) !== canonical([...keys].sort())
    || Object.values(Object.getOwnPropertyDescriptors(value)).some((descriptor) => !descriptor.enumerable || descriptor.get || descriptor.set || !("value" in descriptor))) fail(`cold ${label} shape is invalid`);
  return value as Record<string, unknown>;
}

function coldHashV1(value: unknown, label: string): string {
  if (typeof value !== "string" || !SHA256.test(value)) fail(`cold ${label} hash is invalid`);
  return value;
}

function coldPairV1(value: unknown, stem: string, prefix: string): Record<string, unknown> {
  const record = coldRecordV1(value, [`${stem}Ref`, `${stem}Hash`], `${stem} pair`);
  if (record[`${stem}Ref`] !== `${prefix}${coldHashV1(record[`${stem}Hash`], stem)}`) fail(`cold ${stem} pair is crossed`);
  return record;
}

function coldSelfHashV1(record: Record<string, unknown>, hashKey: string, excluded: readonly string[] = []): void {
  const body = { ...record }; delete body[hashKey];
  for (const key of excluded) delete body[key];
  if (coldHashV1(record[hashKey], hashKey) !== sha256(canonical(body))) fail(`cold ${hashKey} is crossed`);
}

function validateColdBootstrapObservationV1(value: unknown): Readonly<Record<string, unknown>> {
  const observation = coldRecordV1(value, ["schema", "operation", "operationBytesSha256", "contaminationFingerprintHash", "source",
    "authorityV3Migration31Audit", "pendingBootstrapHandoffMigration", "remainingServices", "spawnerAbsence", "physical", "census",
    "syntheticGitAbsence", "legacyFindingPublicationInventory", "observationHash"], "observation");
  if (observation.schema !== "setfarm.internal-production-cold-bootstrap-observation.v1"
    || observation.operationBytesSha256 !== COLD_INCIDENT_BYTES_HASH_V1 || observation.contaminationFingerprintHash !== COLD_INCIDENT_FINGERPRINT_V1) fail("cold incident fingerprint is invalid");
  const operation = coldPairV1(observation.operation, "operation", "setfarm://internal-production/current-entry-operation/sha256/");
  if (operation.operationHash !== COLD_INCIDENT_HASH_V1) fail("cold incident is not recognized");
  const source = coldRecordV1(observation.source, ["branch", "clean", "sha", "treeHash", "buildHash", "originMainSha"], "source");
  if (source.branch !== "main" || source.clean !== true || source.originMainSha !== source.sha
    || typeof source.sha !== "string" || !/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(source.sha)
    || typeof source.treeHash !== "string" || !/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(source.treeHash)) fail("cold source is not exact clean main");
  coldHashV1(source.buildHash, "source build");
  const loadedSource = { sha: source.sha, treeHash: source.treeHash, buildHash: source.buildHash };
  coldPairV1(observation.authorityV3Migration31Audit, "authorityV3Migration31Audit", "setfarm://internal-production/authority-v3-migration31-audit/sha256/");
  coldPairV1(observation.pendingBootstrapHandoffMigration, "pendingBootstrapHandoffMigration", "setfarm://internal-production/pending-bootstrap-handoff-migration/sha256/");
  const census = coldRecordV1(observation.census, COMPLETE_ZERO_KEYS_V1, "complete census");
  if (Object.values(census).some((count) => count !== 0)) fail("cold complete census is not zero");
  const physical = coldRecordV1(observation.physical, ["worktrees", "processes", "listeners", "stale", "ownedProcessCount", "ownedListenerCount", "ownedWorktreeCount", "dirtyWorktreeCount", "staleChildCount"], "physical inventory");
  for (const [key, member] of Object.entries(physical)) {
    if (["worktrees", "processes", "listeners", "stale"].includes(key) ? !Array.isArray(member) || member.length !== 0 : member !== 0) fail("cold physical inventory is not empty");
  }
  const services = coldRecordV1(observation.remainingServices, ["dashboard", "missionControl", "openClaw"], "remaining services");
  const pids = new Set<number>();
  for (const [key, label, port] of [["dashboard", "com.setrox.setfarm-dashboard", 3333], ["missionControl", "com.setrox.mission-control", 3080], ["openClaw", "ai.openclaw.gateway", 18789]] as const) {
    const service = coldRecordV1(services[key], ["pid", "processStartTimeEpochMs", "processIdentityHash", "serviceIdentityHash", "generationHash", "loadedSourceSha", "loadedTreeHash", "loadedBuildHash", "processOwnerCount", "listenerOwnerCount", "listener"], `${key} service`);
    if (!Number.isSafeInteger(service.pid) || (service.pid as number) < 1 || pids.has(service.pid as number)
      || !Number.isSafeInteger(service.processStartTimeEpochMs) || (service.processStartTimeEpochMs as number) < 1
      || service.processOwnerCount !== 1 || service.listenerOwnerCount !== 1) fail("cold service owner identity is invalid");
    pids.add(service.pid as number);
    const loaded = key === "openClaw" ? null : { sha: service.loadedSourceSha, treeHash: service.loadedTreeHash, buildHash: service.loadedBuildHash };
    if (loaded === null) {
      if (service.loadedSourceSha !== null || service.loadedTreeHash !== null || service.loadedBuildHash !== null) fail("cold OpenClaw source is crossed");
    } else {
      if (typeof loaded.sha !== "string" || !/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(loaded.sha)
        || typeof loaded.treeHash !== "string" || !/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(loaded.treeHash)) fail("cold service loaded source is invalid");
      coldHashV1(loaded.buildHash, "service build");
    }
    if (key === "dashboard" && canonical(loaded) !== canonical(loadedSource)) fail("cold dashboard source is crossed");
    coldHashV1(service.processIdentityHash, "service process");
    coldHashV1(service.serviceIdentityHash, "service identity");
    if (service.generationHash !== sha256(canonical({ schema: "setfarm.internal-production-loaded-service-generation.v1", label, serviceIdentityHash: service.serviceIdentityHash, source: loaded }))) fail("cold service generation is crossed");
    const listener = coldRecordV1(service.listener, ["host", "port", "listenerIdentityHash"], "listener");
    if (listener.host !== "127.0.0.1" || listener.port !== port) fail("cold service listener is crossed");
    coldHashV1(listener.listenerIdentityHash, "listener identity");
  }
  const absence = coldRecordV1(observation.spawnerAbsence, ["schema", "source", "uid", "globalSpawnerFamilyCount", "singletonLockState", "pidFile", "ancestors", "launcher", "entrypoint", "entrypointBytesSha256", "plistBytesSha256", "launchProjectionHash", "absenceHash"], "spawner absence");
  if (absence.schema !== "setfarm.internal-production-cold-spawner-absence.v1" || canonical(absence.source) !== canonical(loadedSource)
    || !Number.isSafeInteger(absence.uid) || (absence.uid as number) < 0 || absence.uid !== process.getuid?.()
    || absence.globalSpawnerFamilyCount !== 0 || absence.singletonLockState !== "absent") fail("cold spawner absence is invalid");
  const metadataKeys = ["dev", "ino", "uid", "mode", "nlink", "size", "mtimeNs", "ctimeNs"];
  const metadata = (member: Record<string, unknown>, regular: boolean) => {
    for (const key of metadataKeys.filter((key) => key !== "mode")) {
      if (typeof member[key] !== "string" || !/^(?:0|[1-9][0-9]*)$/.test(member[key] as string)) fail("cold filesystem metadata is invalid");
    }
    if (member.uid !== String(absence.uid) || BigInt(member.ino as string) < 1n || BigInt(member.nlink as string) < 1n
      || !Number.isSafeInteger(member.mode) || (member.mode as number) < 0 || (member.mode as number) > 0o7777
      || (regular && (member.nlink !== "1" || ((member.mode as number) & 0o022) !== 0))) fail("cold filesystem ownership is invalid");
  };
  if (!Array.isArray(absence.ancestors) || absence.ancestors.length !== 3) fail("cold singleton ancestors are incomplete");
  let home = "", device = "";
  for (const [index, value] of absence.ancestors.entries()) {
    const ancestor = coldRecordV1(value, ["path", ...metadataKeys], "singleton ancestor"); metadata(ancestor, false);
    if (typeof ancestor.path !== "string" || !path.isAbsolute(ancestor.path) || path.normalize(ancestor.path) !== ancestor.path
      || ((ancestor.mode as number) & 0o022) !== 0) fail("cold singleton ancestor path or mode is invalid");
    if (index === 0) { home = ancestor.path; device = ancestor.dev as string; }
    if (ancestor.path !== [home, path.join(home, ".openclaw"), path.join(home, ".openclaw", "setfarm")][index] || ancestor.dev !== device) fail("cold singleton ancestor chain is crossed");
  }
  const launcher = coldRecordV1(absence.launcher, ["path", "target", ...metadataKeys], "launcher"); metadata(launcher, false);
  if (launcher.nlink !== "1" || launcher.path !== path.join(home, ".local", "bin", "setfarm")
    || typeof absence.entrypoint !== "string" || !path.isAbsolute(absence.entrypoint) || path.normalize(absence.entrypoint) !== absence.entrypoint
    || path.basename(absence.entrypoint) !== "spawner.js" || path.basename(path.dirname(absence.entrypoint)) !== "dist"
    || launcher.target !== path.join(path.dirname(absence.entrypoint), "cli", "cli.js")) fail("cold launcher binding is crossed");
  for (const key of ["entrypointBytesSha256", "plistBytesSha256", "launchProjectionHash"]) coldHashV1(absence[key], key);
  const pidFile = absence.pidFile as Record<string, unknown> | null;
  if (pidFile?.state === "absent") coldRecordV1(pidFile, ["state"], "PID absence");
  else {
    const pid = coldRecordV1(pidFile, ["state", "pid", "bytesSha256", "identity"], "PID residue");
    if (pid.state !== "stale-dead-pid" || !Number.isSafeInteger(pid.pid) || (pid.pid as number) < 1 || (pid.pid as number) > 2_147_483_647 || pids.has(pid.pid as number)
      || pid.bytesSha256 !== sha256(String(pid.pid))) fail("cold PID residue is invalid");
    const identity = coldRecordV1(pid.identity, metadataKeys, "PID metadata"); metadata(identity, true);
    if (identity.dev !== device || identity.size !== String(String(pid.pid).length)) fail("cold PID metadata is crossed");
  }
  coldSelfHashV1(absence, "absenceHash");
  if (canonical(observation.syntheticGitAbsence) !== canonical(COLD_SYNTHETIC_GIT_ABSENCE_V1)) fail("cold synthetic Git evidence is crossed");
  validateLegacyFindingPublicationInventoryV1(observation.legacyFindingPublicationInventory);
  coldSelfHashV1(observation, "observationHash");
  return freezeColdDataV1(JSON.parse(canonical(observation)) as Record<string, unknown>);
}

function freezeColdDataV1<T>(value: T): Readonly<T> {
  if (value && typeof value === "object") {
    for (const member of Object.values(value)) freezeColdDataV1(member);
    Object.freeze(value);
  }
  return value;
}

function coldGenesisStableIdentityV1(observation: Readonly<Record<string, unknown>>): string {
  return canonical(Object.fromEntries(["operation", "operationBytesSha256", "contaminationFingerprintHash", "source", "authorityV3Migration31Audit", "pendingBootstrapHandoffMigration", "syntheticGitAbsence", "legacyFindingPublicationInventory"].map((key) => [key, observation[key]])));
}

function parseColdEpochGenesisReceiptV1(bytes: Buffer): Readonly<Record<string, unknown>> {
  if (bytes.length < 1 || bytes.length > COLD_GENESIS_MAX_BYTES_V1) fail("cold genesis receipt size is invalid");
  const record = coldRecordV1(JSON.parse(bytes.toString("utf8")), ["schema", "purpose", "epochOrdinal", "authorityOwner", "services", "coldObservation", "genesisRef", "genesisHash"], "genesis receipt");
  if (!bytes.equals(Buffer.from(`${canonical(record)}\n`)) || record.schema !== "setfarm.internal-production-cold-epoch-genesis-receipt.v1"
    || record.purpose !== "exact-poison-cold-recovery-epoch-one-v1" || record.epochOrdinal !== 1 || record.authorityOwner !== "baseline-a"
    || canonical(record.services) !== canonical(COLD_EPOCH_SERVICES_V1) || record.genesisRef !== `${COLD_GENESIS_PREFIX_V1}${coldHashV1(record.genesisHash, "genesis")}`) fail("cold genesis receipt is invalid");
  validateColdBootstrapObservationV1(record.coldObservation);
  coldSelfHashV1(record, "genesisHash", ["genesisRef"]);
  return freezeColdDataV1(record);
}

function coldGenesisReceiptPathV1(hash: string): string {
  coldHashV1(hash, "genesis locator");
  return path.join(rootPaths().genesis, hash.slice(0, 2), `${hash}.json`);
}

function validateColdEpochOneHeadV1(value: unknown, bytes: Buffer, receipt: Readonly<Record<string, unknown>>): Readonly<Record<string, unknown>> {
  const head = coldRecordV1(value, ["schema", "epochOrdinal", "authorityOwner", "services", "predecessorEpochRef", "predecessorEpochHash", "retirementRef", "retirementHash", "startupHooksReadyRef", "startupHooksReadyHash", "successorActivationRef", "successorActivationHash", "genesisRef", "genesisHash", "epochRef", "epochHash"], "epoch head");
  if (!bytes.equals(Buffer.from(`${canonical(head)}\n`)) || head.schema !== "setfarm.internal-production-physical-service-restart-authority-epoch.v2"
    || head.epochOrdinal !== 1 || head.authorityOwner !== "baseline-a" || canonical(head.services) !== canonical(COLD_EPOCH_SERVICES_V1)
    || [head.predecessorEpochRef, head.predecessorEpochHash, head.retirementRef, head.retirementHash, head.startupHooksReadyRef, head.startupHooksReadyHash, head.successorActivationRef, head.successorActivationHash].some((member) => member !== null)
    || head.epochRef !== `setfarm://internal-production/physical-service-restart-authority-epoch/sha256/${coldHashV1(head.epochHash, "epoch")}`) fail("cold epoch head is not bound A-active");
  coldSelfHashV1(head, "epochHash", ["epochRef"]);
  if (receipt.genesisRef !== head.genesisRef || receipt.genesisHash !== head.genesisHash) fail("cold epoch genesis binding is crossed");
  return orderedFrozenV1(head);
}

function sameColdFileMetadataV1(before: BigIntStats, after: BigIntStats): boolean {
  return before.dev === after.dev && before.ino === after.ino && before.uid === after.uid && before.gid === after.gid && before.mode === after.mode
    && before.nlink === after.nlink && before.size === after.size && before.birthtimeNs === after.birthtimeNs && before.mtimeNs === after.mtimeNs && before.ctimeNs === after.ctimeNs;
}

type PrivateFrameDescriptorV1 = { descriptor: number | null; identity: BigIntStats | null; closeEntered: boolean };

function closePrivateFrameDescriptorV1(pin: PrivateFrameDescriptorV1): void {
  if (pin.descriptor === null) return;
  let current: BigIntStats;
  try { current = fstatSync(pin.descriptor, { bigint: true }); }
  catch (error) { if (error instanceof Error && "code" in error && error.code === "EBADF") { pin.descriptor = null; return; } throw error; }
  if (pin.identity === null) fail("private frame original descriptor identity is unavailable");
  if (["dev", "ino", "uid", "gid", "mode", "birthtimeNs"].some(key => current[key as keyof BigIntStats] !== pin.identity![key as keyof BigIntStats])) {
    pin.descriptor = null; fail("private frame descriptor was reused");
  }
  // Inode equality is not open-file-description ownership after a lost close
  // response. Only absence or a different identity can resolve this fence.
  if (pin.closeEntered) fail("private frame close outcome is ambiguous");
  pin.closeEntered = true; closeSync(pin.descriptor); pin.descriptor = null;
}

function assertOriginalEmptyUnlinkedFrameV1(writer: number, reader: number, original: BigIntStats): BigIntStats {
  const current = fstatSync(writer, { bigint: true });
  if (!current.isFile() || current.uid !== BigInt(process.getuid!()) || (current.mode & 0o7777n) !== 0o600n || current.nlink !== 0n || current.size !== 0n
    || ["dev", "ino", "uid", "gid", "mode", "birthtimeNs", "mtimeNs"].some(key => current[key as keyof BigIntStats] !== original[key as keyof BigIntStats])
    || (original.nlink === 0n && !sameColdFileMetadataV1(original, current))
    || !sameColdFileMetadataV1(current, fstatSync(reader, { bigint: true }))) fail("original empty private frame changed before secret write");
  return current;
}

function coldFileIdentityTupleV1(stats: BigIntStats): readonly string[] {
  return Object.freeze([stats.dev, stats.ino, stats.uid, stats.gid, stats.mode, stats.nlink, stats.size, stats.birthtimeNs, stats.mtimeNs, stats.ctimeNs].map(String));
}

function readColdGenesisCandidateV1(target: string, expected: BigIntStats, maximumLinks = 1): Buffer {
  if (!expected.isFile() || expected.isSymbolicLink() || expected.uid !== BigInt(process.getuid!())
    || (expected.mode & 0o7777n) !== 0o600n || expected.nlink < 1n || expected.nlink > BigInt(maximumLinks)
    || expected.size < 1n || expected.size > BigInt(COLD_GENESIS_MAX_BYTES_V1)) fail("cold publication candidate identity is invalid");
  const descriptor = openSync(target, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  let descriptorClosed = false;
  const close = () => {
    if (descriptorClosed) return;
    closeSync(descriptor);
    descriptorClosed = true;
    pendingColdHelperAuthenticationCleanupV1.delete(close);
  };
  try {
    if (!sameColdFileMetadataV1(expected, fstatSync(descriptor, { bigint: true }))) fail("cold publication candidate changed while opened");
    const bytes = Buffer.alloc(Number(expected.size));
    let offset = 0;
    while (offset < bytes.length) {
      const count = readSync(descriptor, bytes, offset, Math.min(65_536, bytes.length - offset), offset);
      if (count < 1) fail("cold publication candidate is truncated");
      offset += count;
    }
    if (readSync(descriptor, Buffer.alloc(1), 0, 1, offset) !== 0
      || !sameColdFileMetadataV1(expected, fstatSync(descriptor, { bigint: true }))
      || !sameColdFileMetadataV1(expected, lstatSync(target, { bigint: true }))) fail("cold publication candidate changed while read");
    return bytes;
  } finally {
    try { close(); }
    catch (error) {
      pendingColdHelperAuthenticationCleanupV1.add(close);
      try { close(); } catch { /* Keep the exact unfinished reader reachable. */ }
      throw error;
    }
  }
}

function readColdDirectoryMembersV1(target: string, maximum: number): string[] {
  const directory = opendirSync(target, { bufferSize: 1 }), members: string[] = [];
  let closed = false;
  const close = () => {
    if (closed) return;
    directory.closeSync();
    closed = true;
    pendingColdHelperAuthenticationCleanupV1.delete(close);
  };
  try {
    for (let entry = directory.readSync(); entry !== null; entry = directory.readSync()) {
      if (members.length >= maximum) fail("cold journal prefix has extra members");
      members.push(entry.name);
    }
    return members;
  } finally {
    try { close(); }
    catch (error) {
      pendingColdHelperAuthenticationCleanupV1.add(close);
      try { close(); } catch { /* Retain the exact directory until cleanup can finish. */ }
      throw error;
    }
  }
}

function assertColdEpochOneHeadV1(value: unknown, bytes: Buffer): Readonly<Record<string, unknown>> {
  const target = coldGenesisReceiptPathV1((value as Record<string, unknown>)?.genesisHash as string);
  const guard = authenticatePrivateDirectoryChainV1(resolveInternalProductionBaselineWorkspaceRootV1(), path.dirname(target));
  try {
    guard.assertStable();
    const receipt = parseColdEpochGenesisReceiptV1(readColdGenesisCandidateV1(target, lstatSync(target, { bigint: true })));
    const head = validateColdEpochOneHeadV1(value, bytes, receipt);
    guard.assertStable();
    return head;
  } finally { guard.close(); }
}

function observeColdGenesisHistoryV1(raw: RawPhysicalTransitionLockV1 | null): Readonly<{
  receipt: Readonly<Record<string, unknown>> | null; receiptBytes: Buffer | null; headBytes: Buffer | null;
  identityWitness: string;
}> {
  const paths = rootPaths();
  const parent = path.dirname(paths.root);
  const parentGuard = authenticatePrivateDirectoryChainV1(resolveInternalProductionBaselineWorkspaceRootV1(), parent);
  try {
    parentGuard.assertStable();
    const parentBefore = lstatSync(parent, { bigint: true });
    for (const sibling of ["pre-schema-spawner-rebind-v1", "baseline-service-restart-v1", "baseline-service-restart-sequence-v1", "baseline-spawner-bootstrap-restart-v1"]) {
      try { lstatSync(path.join(parent, sibling)); fail(`cold genesis conflicting ${sibling} history is present`); }
      catch (error) { if (!(error instanceof Error) || !("code" in error) || error.code !== "ENOENT") throw error; }
    }
    let rootIdentity: BigIntStats;
    try { rootIdentity = lstatSync(paths.root, { bigint: true }); }
    catch (error) {
      if (!(error instanceof Error) || !("code" in error) || error.code !== "ENOENT" || raw !== null) throw error;
      parentGuard.assertStable();
      if (!sameColdFileMetadataV1(parentBefore, lstatSync(parent, { bigint: true }))) fail("cold genesis parent changed during absence observation");
      return Object.freeze({ receipt: null, receiptBytes: null, headBytes: null, identityWitness: "absent" });
    }
    const rootGuard = authenticatePrivateDirectoryChainV1(resolveInternalProductionBaselineWorkspaceRootV1(), paths.root);
    try {
      const members: Array<{ relative: string; target: string; stats: BigIntStats; bytes: Buffer | null }> = [];
      const walk = (directory: string, relative: string): void => {
        const names = readdirSync(directory).sort();
        if (names.length > 5) fail("cold genesis history is over cap");
        for (const name of names) {
          if (members.length >= 12) fail("cold genesis history is over cap");
          const locator = relative ? `${relative}/${name}` : name;
          const target = path.join(directory, name), stats = lstatSync(target, { bigint: true });
          if (stats.isSymbolicLink() || stats.uid !== BigInt(process.getuid!()) || stats.dev !== rootIdentity.dev) fail("cold genesis history ownership is invalid");
          if (stats.isDirectory()) {
            if ((stats.mode & 0o7777n) !== 0o700n || !/^(?:epoch-genesis|epoch-genesis\/sha256|epoch-genesis\/sha256\/[a-f0-9]{2})$/.test(locator)) fail("cold genesis conflicting directory history is present");
            members.push({ relative: locator, target, stats, bytes: null });
            walk(target, locator);
          } else {
            if (locator !== path.basename(paths.lock) && !/^(?:epoch-head\.json|\.epoch-head\.json\.[a-f0-9]{32}\.tmp|epoch-genesis\/sha256\/[a-f0-9]{2}\/(?:[a-f0-9]{64}\.json|\.[a-f0-9]{64}\.json\.[a-f0-9]{32}\.tmp))$/.test(locator)) fail("cold genesis conflicting file history is present");
            members.push({ relative: locator, target, stats, bytes: readColdGenesisCandidateV1(target, stats, locator === path.basename(paths.lock) ? 1 : 2) });
          }
        }
      };
      walk(paths.root, "");
      const lock = members.find((entry) => entry.relative === path.basename(paths.lock));
      if (lock) parseLockRecord(lock.bytes!);
      if (raw !== null) {
        const state = heldRawPhysicalTransitionLockV1(raw); assertRawPhysicalTransitionLockStableV1(state);
        if (!lock || !lock.bytes!.equals(state.lockBytes) || String(lock.stats.ino) !== descriptorIdentity(state.descriptor).inoDecimal) fail("cold genesis raw lock is crossed");
      }
      const receiptFiles = members.filter((entry) => entry.bytes !== null && entry.relative.startsWith("epoch-genesis/"));
      const headFiles = members.filter((entry) => entry.bytes !== null && /^(?:epoch-head\.json|\.epoch-head\.json\.)/.test(entry.relative));
      const requireOnePublication = (files: typeof members, finalName: string): Buffer | null => {
        if (files.length === 0) return null;
        if (files.length > 2 || files.filter((entry) => path.basename(entry.target) === finalName).length > 1
          || files.filter((entry) => path.basename(entry.target) !== finalName).length > 1) fail("cold genesis publication prefix is ambiguous");
        const first = files[0]!;
        for (const entry of files) {
          if (!entry.bytes!.equals(first.bytes!)) fail("cold genesis publication prefix bytes differ");
          if (entry.stats.nlink === 2n && (files.length !== 2 || files.some((other) => other.stats.ino !== entry.stats.ino || other.stats.dev !== entry.stats.dev))) fail("cold genesis publication link prefix is crossed");
        }
        return first.bytes;
      };
      let receipt: Readonly<Record<string, unknown>> | null = null, receiptBytes: Buffer | null = null;
      if (receiptFiles.length > 0) {
        receipt = parseColdEpochGenesisReceiptV1(receiptFiles[0]!.bytes!);
        const hash = receipt.genesisHash as string, name = `${hash}.json`;
        for (const entry of receiptFiles) {
          const basename = path.basename(entry.target);
          if (path.basename(path.dirname(entry.target)) !== hash.slice(0, 2)
            || (basename !== name && !new RegExp(`^\\.${hash}\\.json\\.[a-f0-9]{32}\\.tmp$`).test(basename))) fail("cold genesis receipt locator is crossed");
        }
        receiptBytes = requireOnePublication(receiptFiles, name);
      }
      const shards = members.filter((entry) => entry.stats.isDirectory() && /^epoch-genesis\/sha256\/[a-f0-9]{2}$/.test(entry.relative));
      if (shards.length > 1 || (shards.length === 1 && receipt === null)) fail("cold genesis shard has no authenticated candidate");
      const headBytes = requireOnePublication(headFiles, "epoch-head.json");
      if (headBytes !== null) {
        if (receipt === null) fail("cold genesis head has no receipt");
        if (!receiptFiles.some((entry) => path.basename(entry.target) === `${receipt.genesisHash}.json`)) fail("cold genesis head has no final receipt");
        validateColdEpochOneHeadV1(JSON.parse(headBytes.toString("utf8")), headBytes, receipt);
      }
      for (const entry of members) if (!sameColdFileMetadataV1(entry.stats, lstatSync(entry.target, { bigint: true }))) fail("cold genesis history changed while read");
      if (!sameColdFileMetadataV1(rootIdentity, lstatSync(paths.root, { bigint: true }))
        || !sameColdFileMetadataV1(parentBefore, lstatSync(parent, { bigint: true }))) fail("cold genesis history topology changed while read");
      rootGuard.assertStable(); parentGuard.assertStable();
      const identity = (stats: BigIntStats) => [stats.dev, stats.ino, stats.mode, stats.uid, stats.gid, stats.nlink, stats.size, stats.mtimeNs, stats.ctimeNs].map(String);
      const identityWitness = canonical({ parent: identity(parentBefore), root: identity(rootIdentity),
        members: members.map((entry) => ({ relative: entry.relative, identity: identity(entry.stats) })) });
      return Object.freeze({ receipt, receiptBytes, headBytes, identityWitness });
    } finally { rootGuard.close(); }
  } finally { parentGuard.close(); }
}

export async function acquireInternalProductionColdRecoveryEpochGenesisTransitionLeaseV1(): Promise<InternalProductionPhysicalServiceRestartAuthorityTransitionLeaseV1> {
  if (coldGenesisInvocationActiveV1) fail("cold genesis invocation is already active");
  coldGenesisInvocationActiveV1 = true;
  try { return await acquireColdGenesisTransitionLeaseOwnedV1(); }
  finally { coldGenesisInvocationActiveV1 = false; }
}

async function acquireColdGenesisTransitionLeaseOwnedV1(): Promise<InternalProductionPhysicalServiceRestartAuthorityTransitionLeaseV1> {
  observeColdGenesisHistoryV1(null);
  const observer = await import("./baseline-post-handoff-receipt-v1.js");
  const before = validateColdBootstrapObservationV1(await observer.observeInternalProductionColdBootstrapObservationV1());
  observeColdGenesisHistoryV1(null);
  if (retainedColdGenesisRawV1 !== null && heldRawPhysicalTransitionLockV1(retainedColdGenesisRawV1).cleanup.phase === "owned-unlink-completed") {
    // Finish this invocation's authenticated unlink; never mistake it for a
    // still-held fence, and never reclaim an externally removed held lock.
    const pending = retainedColdGenesisRawV1;
    try { releaseRawPhysicalTransitionLockV1(pending); }
    finally { if (!rawPhysicalTransitionLocksV1.has(pending)) retainedColdGenesisRawV1 = null; }
  }
  const raw = retainedColdGenesisRawV1 ?? await acquireRawPhysicalTransitionLockV1();
  try {
    let prefix = observeColdGenesisHistoryV1(raw);
    const fresh = validateColdBootstrapObservationV1(await observer.observeInternalProductionColdBootstrapObservationV1());
    if (coldGenesisStableIdentityV1(before) !== coldGenesisStableIdentityV1(fresh)) fail("cold genesis prerequisites changed under lock");
    const reobserved = observeColdGenesisHistoryV1(raw);
    if (prefix.identityWitness !== reobserved.identityWitness || canonical(prefix.receipt) !== canonical(reobserved.receipt) || !((prefix.headBytes === null && reobserved.headBytes === null)
      || (prefix.headBytes !== null && reobserved.headBytes !== null && prefix.headBytes.equals(reobserved.headBytes)))) fail("cold genesis prefix changed under lock");
    let receipt = prefix.receipt;
    if (receipt !== null) {
      if (coldGenesisStableIdentityV1(receipt.coldObservation as Readonly<Record<string, unknown>>) !== coldGenesisStableIdentityV1(fresh)) fail("cold genesis retained prerequisites are crossed");
    } else {
      const body = { schema: "setfarm.internal-production-cold-epoch-genesis-receipt.v1", purpose: "exact-poison-cold-recovery-epoch-one-v1", epochOrdinal: 1, authorityOwner: "baseline-a", services: COLD_EPOCH_SERVICES_V1, coldObservation: fresh };
      const genesisHash = sha256(canonical(body));
      receipt = parseColdEpochGenesisReceiptV1(Buffer.from(`${canonical({ ...body, genesisRef: `${COLD_GENESIS_PREFIX_V1}${genesisHash}`, genesisHash })}\n`));
    }
    const headBody = { schema: "setfarm.internal-production-physical-service-restart-authority-epoch.v2", epochOrdinal: 1, authorityOwner: "baseline-a", services: COLD_EPOCH_SERVICES_V1,
      predecessorEpochRef: null, predecessorEpochHash: null, retirementRef: null, retirementHash: null, startupHooksReadyRef: null, startupHooksReadyHash: null,
      successorActivationRef: null, successorActivationHash: null, genesisRef: receipt.genesisRef, genesisHash: receipt.genesisHash };
    const epochHash = sha256(canonical(headBody));
    const head = { ...headBody, epochRef: `setfarm://internal-production/physical-service-restart-authority-epoch/sha256/${epochHash}`, epochHash };
    const headBytes = Buffer.from(`${canonical(head)}\n`);
    if (prefix.headBytes !== null && !prefix.headBytes.equals(headBytes)) fail("cold genesis retained head is crossed");
    writeNoReplace(coldGenesisReceiptPathV1(receipt.genesisHash as string), receipt);
    prefix = observeColdGenesisHistoryV1(raw);
    if (canonical(prefix.receipt) !== canonical(receipt)) fail("cold genesis receipt changed after durable publication");
    writeNoReplace(rootPaths().epoch, head);
    prefix = observeColdGenesisHistoryV1(raw);
    if (!prefix.headBytes?.equals(headBytes) || canonical(prefix.receipt) !== canonical(receipt)) fail("cold genesis durable head is crossed");
    assertColdEpochOneHeadV1(head, headBytes);
    const lease = promoteRawPhysicalTransitionLockV1(raw, assertEpochOneActive);
    if (retainedColdGenesisRawV1 === raw) retainedColdGenesisRawV1 = null;
    return lease;
  } catch (error) {
    // Genesis publishes no dispatch journal. Retain every receipt/head prefix;
    // release only this exact physical owner, never erase partial authority.
    try {
      releaseRawPhysicalTransitionLockV1(raw);
      if (retainedColdGenesisRawV1 === raw) retainedColdGenesisRawV1 = null;
    } catch {
      // Never fall back to acquisition-only cleanup after publication. A
      // conflicting or indeterminate helper journal must keep its live fence.
      retainedColdGenesisRawV1 = rawPhysicalTransitionLocksV1.has(raw) ? raw : null;
    }
    throw error;
  }
}

function assertColdIntentLeaseV1(state: ColdBootstrapIntentStateV1): void {
  state.rootGuard.assertStable();
  const held = heldLease(state.lease);
  const lock = parseLockRecord(held.lockBytes);
  const identity = descriptorIdentity(held.descriptor);
  const atPath = lstatSync(rootPaths().lock, { bigint: true });
  if (lock.pid !== process.pid || identity.devDecimal !== String(atPath.dev) || identity.inoDecimal !== String(atPath.ino)
    || canonical(state.intent.transitionLock) !== canonical(lock) || canonical(state.intent.lockIdentity) !== canonical(identity)
    || !readColdGenesisCandidateV1(rootPaths().lock, atPath).equals(held.lockBytes)) fail("cold intent physical lease is crossed");
  const epoch = assertEpochOneActive();
  if (epoch.schema !== "setfarm.internal-production-physical-service-restart-authority-epoch.v2"
    || epoch.epochHash !== state.intent.epochHash || epoch.genesisHash !== state.intent.genesisHash) fail("cold intent genesis is crossed");
  state.rootGuard.assertStable();
}

function finishRetainedColdCleanupV1(close: () => void): void {
  const retry = () => { close(); pendingColdHelperAuthenticationCleanupV1.delete(retry); };
  try { retry(); }
  catch (error) {
    pendingColdHelperAuthenticationCleanupV1.add(retry);
    try { retry(); } catch { /* Remaining exact resources stay owned and fence acquisition. */ }
    throw error;
  }
}

function assertColdIntentOnlyPrefixV1(state: ColdBootstrapIntentStateV1, requireFinal: boolean): void {
  const target = path.join(rootPaths().root, "cold-spawner-bootstrap-v1");
  const guard = authenticatePrivateDirectoryChainV1(resolveInternalProductionBaselineWorkspaceRootV1(), target);
  try {
    guard.assertStable();
    const root = lstatSync(target, { bigint: true }), expected = state.rootIdentity;
    if (!expected || !root.isDirectory() || root.isSymbolicLink() || root.uid !== BigInt(process.getuid!())
      || (root.mode & 0o7777n) !== 0o700n || root.dev !== expected.dev || root.ino !== expected.ino) fail("cold intent root is crossed");
    const directory = opendirSync(target, { bufferSize: 1 });
    let directoryClosed = false;
    const entries: Array<{ name: string; stats: BigIntStats }> = [];
    try {
      for (let entry = directory.readSync(); entry !== null; entry = directory.readSync()) {
        if (entries.length >= 2 || (entry.name !== "intent.json" && !/^\.intent\.json\.[a-f0-9]{32}\.tmp$/.test(entry.name))) fail("cold intent prefix is not intent-only");
        const file = path.join(target, entry.name), stats = lstatSync(file, { bigint: true });
        if (stats.dev !== root.dev || !readColdGenesisCandidateV1(file, stats, 2).equals(Buffer.from(`${canonical(state.intent)}\n`))) fail("cold intent prefix bytes are crossed");
        entries.push({ name: entry.name, stats });
      }
    } finally { finishRetainedColdCleanupV1(() => { if (!directoryClosed) { directory.closeSync(); directoryClosed = true; } }); }
    if (requireFinal && !entries.some((entry) => entry.name === "intent.json")) fail("cold intent final record is absent");
    if (entries.filter((entry) => entry.name !== "intent.json").length > 1) fail("cold intent temporary count is crossed");
    if (entries.length === 2) {
      const [left, right] = entries;
      const linked = left!.stats.ino === right!.stats.ino && left!.stats.nlink === 2n && right!.stats.nlink === 2n;
      const collision = left!.stats.ino !== right!.stats.ino && left!.stats.nlink === 1n && right!.stats.nlink === 1n;
      if (!linked && !collision) fail("cold intent recovery links are crossed");
    } else if (entries.some((entry) => entry.stats.nlink !== 1n)) fail("cold intent member has a foreign link");
    for (const entry of entries) if (!sameColdFileMetadataV1(entry.stats, lstatSync(path.join(target, entry.name), { bigint: true }))) fail("cold intent member changed");
    if (!sameColdFileMetadataV1(root, lstatSync(target, { bigint: true }))) fail("cold intent prefix changed");
    guard.assertStable();
  } finally { finishRetainedColdCleanupV1(() => guard.close()); }
}

function assertColdPreparationLeaseV1(state: NonNullable<typeof retainedColdBootstrapPreparationV1>): void {
  if (state !== retainedColdBootstrapPreparationV1 || !state.rootGuard || !state.lockIdentity || !state.epoch) fail("cold preparation owner is unavailable");
  state.rootGuard.assertStable();
  const held = heldLease(state.lease), atPath = lstatSync(rootPaths().lock, { bigint: true });
  if (parseLockRecord(held.lockBytes).pid !== process.pid || !sameColdFileMetadataV1(state.lockIdentity, fstatSync(held.descriptor, { bigint: true }))
    || !sameColdFileMetadataV1(state.lockIdentity, atPath) || !readColdGenesisCandidateV1(rootPaths().lock, atPath).equals(held.lockBytes)
    || canonical(assertEpochOneActive()) !== canonical(state.epoch)) fail("cold preparation physical authority is crossed");
  state.rootGuard.assertStable();
}

// Preparation retains its promoted lease before the first fallible observation.
// A refusal cannot drop that owner or acquire a replacement on the next call.
async function prepareColdSpawnerBootstrapIntentV1() {
  if (coldBootstrapIntentInvocationActiveV1) fail("cold intent invocation is already active");
  coldBootstrapIntentInvocationActiveV1 = true;
  try {
    if (retainedColdBootstrapIntentV1 === null) {
      const observer = await import("./baseline-post-handoff-receipt-v1.js");
      if (retainedColdBootstrapPreparationV1 === null) {
        const lease = await acquireInternalProductionColdRecoveryEpochGenesisTransitionLeaseV1();
        retainedColdBootstrapPreparationV1 = { lease, rootGuard: null, lockIdentity: null, epoch: null };
      }
      const preparation = retainedColdBootstrapPreparationV1, lease = preparation.lease;
        for (const close of pendingColdHelperAuthenticationCleanupV1) close();
        preparation.rootGuard ??= authenticatePrivateDirectoryChainV1(resolveInternalProductionBaselineWorkspaceRootV1(), rootPaths().root);
        const rootGuard = preparation.rootGuard;
        const held = heldLease(lease);
        preparation.lockIdentity ??= fstatSync(held.descriptor, { bigint: true });
        preparation.epoch ??= assertEpochOneActive();
        assertColdPreparationLeaseV1(preparation);
        const profile = await observer.observeInternalProductionSpawnerLaunchProfileCandidateV1();
        assertColdPreparationLeaseV1(preparation);
        const cold = validateColdBootstrapObservationV1(await observer.observeInternalProductionColdBootstrapObservationV1());
        assertColdPreparationLeaseV1(preparation);
        const epoch = assertEpochOneActive();
        if (epoch.schema !== "setfarm.internal-production-physical-service-restart-authority-epoch.v2"
          || canonical(profile.profile.source) !== canonical(cold.source)) fail("cold intent launch source is crossed");
        const genesisPath = coldGenesisReceiptPathV1(epoch.genesisHash as string);
        const genesis = parseColdEpochGenesisReceiptV1(readColdGenesisCandidateV1(genesisPath, lstatSync(genesisPath, { bigint: true })));
        if (genesis.genesisRef !== epoch.genesisRef || genesis.genesisHash !== epoch.genesisHash) fail("cold intent genesis pair is crossed");
        if (coldGenesisStableIdentityV1(genesis.coldObservation as Readonly<Record<string, unknown>>) !== coldGenesisStableIdentityV1(cold)) fail("cold intent genesis prerequisites are crossed");
        rootGuard.assertStable();
        const nonce = randomBytes(32).toString("hex");
        const body = { schema: "setfarm.internal-production-cold-spawner-bootstrap-intent.v1", purpose: "exact-poison-sealed-cold-spawner-v1",
          coldObservation: cold, launchProfile: profile.profile, transitionLock: parseLockRecord(held.lockBytes), lockIdentity: descriptorIdentity(held.descriptor),
          epochRef: epoch.epochRef, epochHash: epoch.epochHash, genesisRef: epoch.genesisRef, genesisHash: epoch.genesisHash, nonceHash: sha256(nonce), maximumDispatchCount: 1 };
        const intentHash = sha256(canonical(body));
        const intent = freezeColdDataV1({ ...body, intentRef: `setfarm://internal-production/cold-spawner-bootstrap-intent/sha256/${intentHash}`, intentHash });
        if (Buffer.byteLength(`${canonical(intent)}\n`, "utf8") > COLD_GENESIS_MAX_BYTES_V1) fail("cold intent exceeds its record cap");
        // Retain the only usable lease and nonce before the first journal-root
        // mutation. Unsettled errors must never call ordinary lease release.
        retainedColdBootstrapIntentV1 = { lease, phase: "intent-only", intent, environment: profile.environment, nonce, rootIdentity: null, rootGuard };
        retainedColdBootstrapPreparationV1 = null;
    }
    const state = retainedColdBootstrapIntentV1;
    if (state.phase !== "intent-only") fail("cold intent is past the preparation-only boundary");
    assertColdIntentLeaseV1(state);
    const target = path.join(rootPaths().root, "cold-spawner-bootstrap-v1");
    if (state.rootIdentity === null) {
      state.rootGuard.assertStable();
      mkdirSync(target, { mode: 0o700 });
      state.rootIdentity = lstatSync(target, { bigint: true });
      state.rootGuard.assertStable();
    }
    fsyncParent(target);
    assertColdIntentOnlyPrefixV1(state, false);
    writeNoReplace(path.join(target, "intent.json"), state.intent);
    assertColdIntentOnlyPrefixV1(state, true);
    assertColdIntentLeaseV1(state);
    return state.intent;
  } finally { coldBootstrapIntentInvocationActiveV1 = false; }
}

function openColdSpawnerHelperFrameV1(state: ColdBootstrapIntentStateV1): Readonly<{ frameDescriptor: number; intentDescriptor: number }> {
  for (const pending of pendingColdHelperAuthenticationCleanupV1) pending();
  if (state !== retainedColdBootstrapIntentV1 || state.phase !== "intent-only") fail("cold helper frame owner is invalid");
  assertColdIntentLeaseV1(state);
  assertColdIntentOnlyPrefixV1(state, true);
  const root = path.join(rootPaths().root, "cold-spawner-bootstrap-v1");
  const intentPath = path.join(root, "intent.json");
  const scratch = path.join(root, `.cold-helper-capability.${randomBytes(16).toString("hex")}.tmp`);
  const guard = authenticatePrivateDirectoryChainV1(resolveInternalProductionBaselineWorkspaceRootV1(), root);
  let intentDescriptor: number | undefined, writer: number | undefined, reader: number | undefined;
  let linkedIdentity: BigIntStats | undefined;
  let writerPin: PrivateFrameDescriptorV1 | undefined, readerPin: PrivateFrameDescriptorV1 | undefined;
  let unlinked = false;
  let guardClosed = false;
  try {
    state.rootGuard.assertStable(); guard.assertStable();
    intentDescriptor = openSync(intentPath, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
    const intentStats = fstatSync(intentDescriptor, { bigint: true });
    if (!sameColdFileMetadataV1(intentStats, lstatSync(intentPath, { bigint: true }))
      || !readColdGenesisCandidateV1(intentPath, intentStats).equals(Buffer.from(`${canonical(state.intent)}\n`))) fail("cold helper frame intent is crossed");
    const frame = { schema: "setfarm.internal-production-cold-spawner-bootstrap-helper-capability.v1", intentRef: state.intent.intentRef,
      intentHash: state.intent.intentHash, lockIdentity: state.intent.lockIdentity, intentIdentity: descriptorIdentity(intentDescriptor), environment: state.environment, nonce: state.nonce };
    const bytes = Buffer.from(`${canonical(frame)}\n`);
    if (bytes.length < 1 || bytes.length > 1_048_576) fail("cold helper frame exceeds its cap");
    state.rootGuard.assertStable(); guard.assertStable();
    writer = openSync(scratch, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
    writerPin = { descriptor: writer, identity: null, closeEntered: false };
    linkedIdentity = writerPin.identity = fstatSync(writer, { bigint: true });
    if (!linkedIdentity.isFile() || linkedIdentity.uid !== BigInt(process.getuid!()) || linkedIdentity.dev !== state.rootIdentity!.dev
      || (linkedIdentity.mode & 0o7777n) !== 0o600n || linkedIdentity.nlink !== 1n || linkedIdentity.size !== 0n) fail("cold helper empty frame identity is invalid");
    reader = openSync(scratch, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
    readerPin = { descriptor: reader, identity: null, closeEntered: false };
    readerPin.identity = fstatSync(reader, { bigint: true });
    if (!sameColdFileMetadataV1(linkedIdentity, readerPin.identity)
      || !sameColdFileMetadataV1(linkedIdentity, lstatSync(scratch, { bigint: true }))) fail("cold helper empty frame was replaced");
    state.rootGuard.assertStable(); guard.assertStable();
    if (!sameColdFileMetadataV1(linkedIdentity, fstatSync(writer, { bigint: true }))
      || !sameColdFileMetadataV1(linkedIdentity, fstatSync(reader, { bigint: true }))
      || !sameColdFileMetadataV1(linkedIdentity, lstatSync(scratch, { bigint: true }))) fail("cold helper empty frame changed before unlink");
    unlinkSync(scratch);
    unlinked = true;
    const originalEmptyFrame = assertOriginalEmptyUnlinkedFrameV1(writer, reader, linkedIdentity);
    fsyncParent(scratch);
    state.rootGuard.assertStable(); guard.assertStable();
    // No secret byte reaches a pathname: both handles refer to an already
    // unlinked, durably unnamed inode before this first payload write.
    assertOriginalEmptyUnlinkedFrameV1(writer, reader, originalEmptyFrame);
    writeFileSync(writer, bytes);
    fsyncSync(writer);
    const before = fstatSync(reader, { bigint: true });
    if (before.nlink !== 0n || before.size !== BigInt(bytes.length) || before.ino !== linkedIdentity.ino || before.dev !== linkedIdentity.dev
      || before.uid !== linkedIdentity.uid || before.mode !== linkedIdentity.mode || !sameColdFileMetadataV1(before, fstatSync(writer, { bigint: true }))) fail("cold helper frame write identity is crossed");
    const verified = Buffer.alloc(bytes.length);
    let offset = 0;
    while (offset < verified.length) {
      const count = readSync(reader, verified, offset, Math.min(65536, verified.length - offset), offset);
      if (count < 1) fail("cold helper frame read is partial");
      offset += count;
    }
    if (!verified.equals(bytes) || readSync(reader, Buffer.alloc(1), 0, 1, offset) !== 0
      || !sameColdFileMetadataV1(before, fstatSync(reader, { bigint: true }))) fail("cold helper frame read changed");
    closePrivateFrameDescriptorV1(writerPin); writer = undefined;
    assertColdIntentLeaseV1(state); assertColdIntentOnlyPrefixV1(state, true);
    if (!sameColdFileMetadataV1(intentStats, fstatSync(intentDescriptor, { bigint: true }))
      || !sameColdFileMetadataV1(intentStats, lstatSync(intentPath, { bigint: true }))) fail("cold helper frame intent changed");
    state.rootGuard.assertStable(); guard.assertStable();
    guard.close(); guardClosed = true;
    const result = Object.freeze({ frameDescriptor: reader, intentDescriptor });
    reader = undefined; intentDescriptor = undefined;
    return result;
  } catch {
    // A pre-unlink failure can leave only the exact empty inode we created.
    // A foreign replacement/link is retained as an unsettled prefix, never removed.
    if (!unlinked && linkedIdentity !== undefined) {
      try {
        state.rootGuard.assertStable(); guard.assertStable();
        const atPath = lstatSync(scratch, { bigint: true });
        if (sameColdFileMetadataV1(linkedIdentity, atPath) && atPath.nlink === 1n && atPath.size === 0n) { unlinkSync(scratch); fsyncParent(scratch); }
      } catch { /* Preserve ambiguous empty evidence and the original lease. */ }
    }
    return fail("cold helper frame preparation failed");
  } finally {
    finishRetainedColdCleanupV1(() => {
      let primary: unknown = null;
      try { if (writer !== undefined) closePrivateFrameDescriptorV1(writerPin!); } catch (error) { primary ??= error; }
      finally { if (writerPin?.descriptor === null) writer = undefined; }
      try { if (reader !== undefined) closePrivateFrameDescriptorV1(readerPin!); } catch (error) { primary ??= error; }
      finally { if (readerPin?.descriptor === null) reader = undefined; }
      try { if (intentDescriptor !== undefined) { closeSync(intentDescriptor); intentDescriptor = undefined; } } catch (error) { primary ??= error; }
      try { if (!guardClosed) { guard.close(); guardClosed = true; } } catch (error) { primary ??= error; }
      if (primary !== null) throw primary;
    });
  }
}

// Decodes only the original helper's bounded transport. The controller must
// independently authenticate every returned pair and physical identity.
function captureDirectControllerHelperCompletionV1(child: ChildProcess): Promise<Readonly<Record<string, unknown>>> {
  return new Promise((resolve, reject) => {
    const pipe = child.stdout;
    let ended = false, exited = false, settled = false, count = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const chunks: Buffer[] = [];
    const ignoreLateError = () => {};
    const finish = (error?: Error) => {
      if (settled || (!error && (!ended || !exited))) return;
      settled = true; clearTimeout(timer);
      pipe?.removeListener("data", onData); pipe?.removeListener("end", onEnd); pipe?.removeListener("error", onError);
      child.removeListener("error", onError); child.removeListener("exit", onExit);
      // Keep only short-lived error ownership until the actual handles close.
      // Never close any inherited capability or lease descriptor here.
      if (pipe && !pipe.closed) {
        pipe.on("error", ignoreLateError);
        pipe.once("close", () => pipe.removeListener("error", ignoreLateError));
        pipe.destroy();
      }
      if (child.exitCode === null && child.signalCode === null) {
        child.on("error", ignoreLateError);
        child.once("close", () => child.removeListener("error", ignoreLateError));
      }
      child.unref();
      if (error) { reject(error); return; }
      try {
        const bytes = Buffer.concat(chunks, count);
        const value = coldRecordV1(JSON.parse(bytes.toString("utf8")), ["schema", "intentRef", "intentHash", "intentIdentity", "dispatchRef", "dispatchHash", "dispatchIdentity", "claimRef", "claimHash", "claimIdentity", "journalIdentity"], "direct helper completion");
        if (value.schema !== "setfarm.internal-production-direct-spawner-helper-completion.v1" || !bytes.equals(Buffer.from(`${canonical(value)}\n`))) fail("direct helper completion is crossed");
        resolve(freezeColdDataV1(value));
      } catch { reject(Error("direct helper completion is malformed")); }
    };
    const onData = (bytes: Buffer) => {
      if (bytes.length < 1 || count + bytes.length > 4096) { finish(Error("direct helper completion exceeds its cap")); return; }
      chunks.push(Buffer.from(bytes)); count += bytes.length;
    };
    const onError = () => finish(Error("direct helper completion failed"));
    const onEnd = () => { ended = true; finish(count < 1 ? Error("direct helper completion is absent") : undefined); };
    const onExit = (code: number | null, signal: NodeJS.Signals | null) => { exited = true; finish(code !== 0 || signal !== null ? Error("direct helper exit is uncertain") : undefined); };
    if (!pipe) { finish(Error("direct helper completion pipe is absent")); return; }
    timer = setTimeout(() => finish(Error("direct helper completion timed out")), 35_000);
    pipe.on("data", onData); pipe.once("end", onEnd); pipe.once("error", onError);
    child.once("error", onError); child.once("exit", onExit);
    if (child.exitCode !== null || child.signalCode !== null) onExit(child.exitCode, child.signalCode);
    if (!settled && pipe.readableEnded) onEnd();
  });
}

function captureColdControllerHelperCompletionV1(child: ChildProcess): Promise<Readonly<Record<string, unknown>>> {
  return new Promise((resolve, reject) => {
    const pipe = child.stdout;
    if (!pipe) { reject(Error("cold helper completion pipe is absent")); return; }
    let ended = false, exited = false, settled = false, count = 0;
    const chunks: Buffer[] = [];
    const finish = (error?: Error) => {
      if (settled || (!error && (!ended || !exited))) return;
      settled = true;
      pipe.removeListener("data", onData); pipe.removeListener("end", onEnd); pipe.removeListener("error", onError);
      child.removeListener("error", onError); child.removeListener("exit", onExit);
      pipe.on("error", () => {}); pipe.destroy(); child.on("error", () => {}); child.unref();
      if (error) { reject(error); return; }
      try {
        const bytes = Buffer.concat(chunks, count);
        const value = coldRecordV1(JSON.parse(bytes.toString("utf8")), ["schema", "intentRef", "intentHash", "intentIdentity", "dispatchRef", "dispatchHash", "dispatchIdentity", "claimRef", "claimHash", "claimIdentity", "journalIdentity"], "helper completion");
        if (value.schema !== "setfarm.internal-production-cold-spawner-helper-completion.v1" || !bytes.equals(Buffer.from(`${canonical(value)}\n`))) fail("cold helper completion is crossed");
        resolve(freezeColdDataV1(value));
      } catch { reject(Error("cold helper completion is malformed")); }
    };
    const onData = (bytes: Buffer) => {
      if (bytes.length < 1 || count + bytes.length > 4096) { finish(Error("cold helper completion exceeds its cap")); return; }
      chunks.push(Buffer.from(bytes)); count += bytes.length;
    };
    const onError = () => finish(Error("cold helper completion failed"));
    const onEnd = () => { ended = true; finish(count < 1 ? Error("cold helper completion is absent") : undefined); };
    const onExit = (code: number | null, signal: NodeJS.Signals | null) => { exited = true; finish(code !== 0 || signal !== null ? Error("cold helper exit is uncertain") : undefined); };
    pipe.on("data", onData); pipe.once("end", onEnd); pipe.once("error", onError);
    child.once("error", onError); child.once("exit", onExit);
  });
}

function assertColdControllerAuthorityPinsV1(state: ColdBootstrapIntentStateV1, invocation: ColdControllerHelperInvocationV1): void {
  assertColdIntentLeaseV1(state);
  for (const guard of invocation.guards) guard.assertStable();
  for (const pin of invocation.pins) {
    if (!sameColdFileMetadataV1(pin.stats, fstatSync(pin.descriptor, { bigint: true }))
      || !pin.bytes.equals(readColdGenesisCandidateV1(pin.path, pin.stats))
      || !sameColdFileMetadataV1(pin.stats, fstatSync(pin.descriptor, { bigint: true }))) fail("cold controller original authority changed");
  }
  for (const guard of invocation.guards) guard.assertStable();
  assertColdIntentLeaseV1(state);
}

function independentlyObserveColdControllerClaimV1(state: ColdBootstrapIntentStateV1, completion: Readonly<Record<string, unknown>>) {
  const invocation = state.helperInvocation, helper = invocation?.child;
  if (!invocation || invocation.failed || !helper || helper.exitCode !== 0 || helper.signalCode !== null || !Number.isSafeInteger(helper.pid)) fail("cold controller retained helper outcome is unavailable");
  const root = path.join(rootPaths().root, "cold-spawner-bootstrap-v1"), profile = state.intent.launchProfile as Record<string, any>;
  const assertOriginal = () => {
    assertColdControllerAuthorityPinsV1(state, invocation);
    const current = lstatSync(root, { bigint: true }), original = state.rootIdentity!;
    if (["dev", "ino", "uid", "gid", "mode", "birthtimeNs"].some(key => current[key as keyof BigIntStats] !== original[key as keyof BigIntStats])
      || canonical(coldFileIdentityTupleV1(current)) !== canonical(completion.journalIdentity)
      || canonical(readColdDirectoryMembersV1(root, 3).sort()) !== canonical(["claim.json", "dispatch.json", "intent.json"])) fail("cold controller journal is crossed");
    verifyInternalProductionSpawnerLaunchOutputCandidateV1({ rootIdentity: { devDecimal: profile.rootIdentity.devDecimal, inoDecimal: profile.rootIdentity.inoDecimal, uid: profile.rootIdentity.uid },
      sourceSha: profile.source.sha, sourceTreeHash: profile.source.treeHash, buildInfoBytesHash: profile.buildInfoBytesHash,
      outputTreeBytesHash: profile.outputTreeBytesHash, releaseManifestBytesHash: profile.releaseManifestBytesHash });
  };
  assertOriginal();
  const read = (stem: string) => {
    const target = path.join(root, `${stem}.json`), stats = lstatSync(target, { bigint: true });
    if (canonical(coldFileIdentityTupleV1(stats)) !== canonical(completion[`${stem}Identity`])) fail("cold controller completion file identity is crossed");
    return readColdGenesisCandidateV1(target, stats);
  };
  const intentBytes = read("intent");
  if (!intentBytes.equals(Buffer.from(`${canonical(state.intent)}\n`))) fail("cold controller original intent changed");
  const intentStats = invocation.pins.find(pin => pin.path === path.join(root, "intent.json"))!.stats;
  const dispatchBytes = read("dispatch"), dispatch = parseColdSpawnerBootstrapDispatchV1(dispatchBytes, state.intent, { devDecimal: String(intentStats.dev), inoDecimal: String(intentStats.ino) });
  const claimBytes = read("claim"), claim = parseColdSpawnerBootstrapClaimV1(claimBytes, state.intent, dispatch);
  for (const stem of ["intent", "dispatch", "claim"]) for (const suffix of ["Ref", "Hash"]) if (completion[`${stem}${suffix}`] !== claim[`${stem}${suffix}`]) fail("cold controller completion pair is crossed");
  if ((dispatch.helper as Record<string, unknown>).pid !== helper.pid) fail("cold controller claim belongs to another helper");
  const assertChild = () => {
    if (boundedPsProcessIdentity(helper.pid!) !== null) fail("cold controller helper has not departed");
    const child = claim.child as Record<string, any>, actual = boundedPsProcessIdentity(child.pid), ownership = observeColdProcessParentGroupV1(child.pid);
    if (!actual || canonical({ ...actual, ...ownership }) !== canonical({ ...child, ppid: 1 })) fail("cold controller detached child is crossed");
    const absence = (state.intent.coldObservation as Record<string, any>).spawnerAbsence;
    for (const ancestor of absence.ancestors) {
      const stats = lstatSync(ancestor.path, { bigint: true });
      if (!stats.isDirectory() || stats.isSymbolicLink() || String(stats.dev) !== ancestor.dev || String(stats.ino) !== ancestor.ino
        || String(stats.uid) !== ancestor.uid || Number(stats.mode & 0o7777n) !== ancestor.mode) fail("cold controller runtime ancestor changed");
    }
    const files = claim.startupFiles as Record<string, any>;
    for (const key of ["singleton", "pidFile"]) {
      const file = files[key], stats = lstatSync(file.path, { bigint: true });
      if (stats.size > 32n || sha256(canonical(coldFileIdentityTupleV1(stats))) !== file.identityHash
        || sha256(readColdGenesisCandidateV1(file.path, stats).toString()) !== file.bytesHash) fail("cold controller claimed startup file changed");
    }
  };
  assertChild(); assertOriginal();
  if (!intentBytes.equals(read("intent")) || !dispatchBytes.equals(read("dispatch")) || !claimBytes.equals(read("claim"))) fail("cold controller claim read changed");
  assertChild(); assertOriginal();
  return claim;
}

async function assertColdControllerLaunchProfileV1(state: ColdBootstrapIntentStateV1): Promise<void> {
  const profile = state.intent.launchProfile as Record<string, any>;
  const output = { rootIdentity: { devDecimal: profile.rootIdentity.devDecimal, inoDecimal: profile.rootIdentity.inoDecimal, uid: profile.rootIdentity.uid },
    sourceSha: profile.source.sha, sourceTreeHash: profile.source.treeHash, buildInfoBytesHash: profile.buildInfoBytesHash,
    outputTreeBytesHash: profile.outputTreeBytesHash, releaseManifestBytesHash: profile.releaseManifestBytesHash };
  assertColdIntentLeaseV1(state);
  verifyInternalProductionSpawnerLaunchOutputCandidateV1(output);
  const observer = await import("./baseline-post-handoff-receipt-v1.js");
  const current = await observer.observeInternalProductionSpawnerLaunchProfileCandidateV1();
  if (canonical(current.profile) !== canonical(profile) || canonical(current.environment) !== canonical(state.environment)) fail("cold controller original launch profile changed");
  verifyInternalProductionSpawnerLaunchOutputCandidateV1(output);
  assertColdIntentLeaseV1(state);
}

async function invokeColdSpawnerBootstrapHelperV1() {
  if (coldControllerHelperInvocationActiveV1) fail("cold controller invocation is already active");
  coldControllerHelperInvocationActiveV1 = true;
  try {
    if (retainedColdBootstrapIntentV1 === null) {
      if (observeInternalProductionColdSpawnerBootstrapJournalCensusV1().state !== "absent") fail("COLD_BOOTSTRAP_NOT_ABSENT");
      await prepareColdSpawnerBootstrapIntentV1();
    }
    const state = retainedColdBootstrapIntentV1!;
    if (state.phase === "intent-only") {
      await assertColdControllerLaunchProfileV1(state);
      const handles = openColdSpawnerHelperFrameV1(state);
      const invocation: ColdControllerHelperInvocationV1 = { child: null, completion: null, failed: false,
        transportDescriptors: [handles.frameDescriptor], authorityDescriptors: [handles.intentDescriptor], guards: [], pins: [] };
      state.helperInvocation = invocation;
      state.phase = "helper-may-have-run";
      try {
        const paths = rootPaths(), profile = state.intent.launchProfile as Record<string, any>;
        for (const [target, borrowed] of [[path.join(paths.root, "cold-spawner-bootstrap-v1/intent.json"), handles.intentDescriptor], [paths.lock, heldLease(state.lease).descriptor],
          [paths.epoch, undefined], [coldGenesisReceiptPathV1(state.intent.genesisHash as string), undefined]] as const) {
          invocation.guards.push(authenticatePrivateDirectoryChainV1(resolveInternalProductionBaselineWorkspaceRootV1(), path.dirname(target)));
          const descriptor = borrowed ?? openSync(target, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
          if (borrowed === undefined) invocation.authorityDescriptors.push(descriptor);
          const stats = fstatSync(descriptor, { bigint: true }), bytes = readColdGenesisCandidateV1(target, stats);
          invocation.pins.push({ path: target, stats, bytes, descriptor });
        }
        await assertColdControllerLaunchProfileV1(state);
        assertColdControllerAuthorityPinsV1(state, invocation);
        invocation.child = spawn(profile.executable.path, [path.join(profile.repository, "dist/internal-production/baseline-service-restart-helper-v1.js")], {
          cwd: profile.cwd, shell: false, env: { PATH: "/usr/bin:/bin", LANG: "C", LC_ALL: "C", SETFARM_INTERNAL_PRODUCTION_COLD_HELPER: "1" },
          stdio: ["ignore", "pipe", "ignore", handles.frameDescriptor, heldLease(state.lease).descriptor, handles.intentDescriptor],
        });
        invocation.completion = captureColdControllerHelperCompletionV1(invocation.child);
        void invocation.completion.catch(() => {});
      } catch { invocation.failed = true; }
    }
    const invocation = state.helperInvocation;
    if (!invocation || !["helper-may-have-run", "claim-observed"].includes(state.phase)) fail("cold controller retained invocation is unavailable");
    while (invocation.transportDescriptors.length > 0) { closeSync(invocation.transportDescriptors.at(-1)!); invocation.transportDescriptors.pop(); }
    if (invocation.failed || !invocation.completion) fail("cold controller helper outcome is uncertain");
    let timer: ReturnType<typeof setTimeout> | undefined;
    const completion = await Promise.race([invocation.completion, new Promise<never>((_resolve, reject) => { timer = setTimeout(() => reject(Error("cold controller helper outcome is uncertain")), 35_000); })]).finally(() => { if (timer) clearTimeout(timer); });
    const claim = independentlyObserveColdControllerClaimV1(state, completion);
    state.phase = "claim-observed";
    return claim;
  } finally { coldControllerHelperInvocationActiveV1 = false; }
}

function assertColdControllerServiceCensusV1(intent: Readonly<Record<string, unknown>>, claim: Readonly<Record<string, unknown>>, value: unknown): void {
  const census = coldRecordV1(value, ["schema", "spawner", "dashboard", "missionControl", "openClaw", "censusHash"], "settlement service census");
  if (census.schema !== "setfarm.internal-production-service-census.v1") fail("cold settlement service census schema is crossed");
  coldSelfHashV1(census, "censusHash");
  const child = claim.child as Record<string, any>, source = claim.source as Record<string, unknown>;
  const label = "com.setrox.setfarm-spawner";
  const serviceIdentityHash = sha256(canonical({ schema: "setfarm.internal-production-service-identity.v1", label, command: child.command }));
  const loaded = { sha: source.sha, treeHash: source.treeHash, buildHash: source.buildHash };
  const expected = { pid: child.pid, processStartTimeEpochMs: child.processStartTimeEpochMs,
    processIdentityHash: sha256(`${child.pid}\n${child.lstart}\n`), serviceIdentityHash,
    generationHash: sha256(canonical({ schema: "setfarm.internal-production-loaded-service-generation.v1", label, serviceIdentityHash, source: loaded })),
    loadedSourceSha: loaded.sha, loadedTreeHash: loaded.treeHash, loadedBuildHash: loaded.buildHash, processOwnerCount: 1, listener: null };
  if (canonical(census.spawner) !== canonical(expected)) fail("cold settlement ordinary spawner is not the retained child");
  const original = (intent.coldObservation as Record<string, any>).remainingServices;
  for (const key of ["dashboard", "missionControl", "openClaw"]) {
    if (canonical(census[key]) !== canonical(original[key]) || original[key].pid === child.pid) fail("cold settlement remaining service changed");
  }
}

async function settleColdSpawnerBootstrapV1(): Promise<Readonly<Record<string, unknown>>> {
  if (coldControllerSettlementActiveV1) fail("cold controller settlement is already active");
  coldControllerSettlementActiveV1 = true;
  try {
    for (const close of pendingColdHelperAuthenticationCleanupV1) close();
    if (retainedColdBootstrapIntentV1?.phase !== "settled") await invokeColdSpawnerBootstrapHelperV1();
    const state = retainedColdBootstrapIntentV1!, invocation = state.helperInvocation!;
    const completion = await invocation.completion!;
    const claim = independentlyObserveColdControllerClaimV1(state, completion);
    const target = path.join(rootPaths().root, "cold-spawner-bootstrap-controller-settlement-v1.json");
    const pending = path.join(path.dirname(target), `.${path.basename(target)}.pending`);
    const observer = await import("./baseline-post-handoff-receipt-v1.js");
    const first = await observer.observeInternalProductionServiceCensusV1();
    independentlyObserveColdControllerClaimV1(state, completion);
    assertColdControllerServiceCensusV1(state.intent, claim, first);
    const second = await observer.observeInternalProductionServiceCensusV1();
    independentlyObserveColdControllerClaimV1(state, completion);
    assertColdControllerServiceCensusV1(state.intent, claim, second);
    if (canonical(first) !== canonical(second)) fail("cold settlement service census changed across observation");
    if (state.settlement && canonical(first) !== canonical(state.settlement.record.serviceCensus)) fail("cold settlement retained service census changed");
    if (!state.settlement) {
      const epoch = invocation.pins.find(pin => pin.path === rootPaths().epoch)!;
      const genesis = invocation.pins.find(pin => pin.path === coldGenesisReceiptPathV1(state.intent.genesisHash as string))!;
      const body = { schema: "setfarm.internal-production-cold-spawner-controller-settlement.v1", purpose: "exact-poison-sealed-cold-spawner-v1",
        completion, epochEvidence: { record: JSON.parse(epoch.bytes.toString("utf8")), identity: coldFileIdentityTupleV1(epoch.stats) },
        genesisIdentity: coldFileIdentityTupleV1(genesis.stats), serviceCensus: first };
      const settlementHash = sha256(canonical(body));
      const record = freezeColdDataV1({ ...body, settlementRef: `setfarm://internal-production/cold-spawner-controller-settlement/sha256/${settlementHash}`, settlementHash });
      const bytes = Buffer.from(`${canonical(record)}\n`);
      if (bytes.length > 65_536) fail("cold settlement exceeds its cap");
      state.settlement = { record, bytes, attempted: false, descriptor: null, identity: null, linkAttempted: false, linked: false, unlinkAttempted: false, committed: false };
    }
    const settlement = state.settlement;
    if (!settlement.attempted) {
      settlement.attempted = true;
      const descriptor = openSync(pending, constants.O_RDWR | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
      settlement.descriptor = descriptor;
      invocation.authorityDescriptors.push(descriptor);
      const created = fstatSync(descriptor, { bigint: true }), atPath = lstatSync(pending, { bigint: true });
      if (!created.isFile() || created.uid !== BigInt(process.getuid!()) || created.nlink !== 1n || created.size !== 0n
        || (created.mode & 0o7777n) !== 0o600n || !sameColdFileMetadataV1(created, atPath)) fail("cold settlement new publication is crossed");
      writeFileSync(descriptor, settlement.bytes);
      settlement.identity = fstatSync(descriptor, { bigint: true });
    }
    // A failed/partial write cannot mint a new file or adopt a foreign path.
    // Only a complete same-inode body may retry its remaining sync/close steps.
    const acceptOwnedLinkTransition = (next: BigIntStats, links: bigint) => {
      const previous = settlement.identity;
      if (!previous || next.nlink !== links || ["dev", "ino", "uid", "gid", "mode", "size", "birthtimeNs", "mtimeNs"].some(key => previous[key as keyof BigIntStats] !== next[key as keyof BigIntStats])) fail("cold settlement link transition is crossed");
      settlement.identity = next;
    };
    if (settlement.unlinkAttempted && !settlement.committed) {
      let absent = false;
      try { lstatSync(pending); } catch (error) { if (!(error instanceof Error) || !("code" in error) || error.code !== "ENOENT") throw error; absent = true; }
      if (absent) { acceptOwnedLinkTransition(lstatSync(target, { bigint: true }), 1n); settlement.committed = true; }
    }
    if (settlement.linkAttempted && !settlement.linked) {
      let final: BigIntStats | null = null;
      try { final = lstatSync(target, { bigint: true }); } catch (error) { if (!(error instanceof Error) || !("code" in error) || error.code !== "ENOENT") throw error; }
      if (final) {
        acceptOwnedLinkTransition(final, 2n);
        if (!settlement.bytes.equals(readColdGenesisCandidateV1(pending, final, 2))) fail("cold settlement pending link is crossed");
        settlement.linked = true;
      }
    }
    const assertPublication = () => {
      if (settlement.committed) {
        try { lstatSync(pending); fail("cold settlement pending owner reappeared"); }
        catch (error) { if (!(error instanceof Error) || !("code" in error) || error.code !== "ENOENT") throw error; }
      }
      if (!settlement.identity) fail("cold settlement publication is uncertain");
      if (!settlement.bytes.equals(readColdGenesisCandidateV1(settlement.committed ? target : pending, settlement.identity, settlement.linked && !settlement.committed ? 2 : 1))) fail("cold settlement publication is uncertain");
      if (settlement.linked && !settlement.bytes.equals(readColdGenesisCandidateV1(target, settlement.identity, settlement.committed ? 1 : 2))) fail("cold settlement final link is crossed");
    };
    assertPublication();
    if (settlement.descriptor !== null) {
      if (!sameColdFileMetadataV1(settlement.identity!, fstatSync(settlement.descriptor, { bigint: true }))) fail("cold settlement retained publication changed");
      fsyncSync(settlement.descriptor);
      assertPublication();
      if (!settlement.linked) {
        settlement.linkAttempted = true;
        linkSync(pending, target);
        acceptOwnedLinkTransition(fstatSync(settlement.descriptor, { bigint: true }), 2n);
        settlement.linked = true;
      }
      assertPublication();
      independentlyObserveColdControllerClaimV1(state, completion);
      closeSync(settlement.descriptor);
      invocation.authorityDescriptors.splice(invocation.authorityDescriptors.indexOf(settlement.descriptor), 1);
      settlement.descriptor = null;
    }
    // Interrupted link adoption may have no writer left. Its final link must
    // still become durable before the filesystem-visible pending owner leaves.
    fsyncParent(target);
    independentlyObserveColdControllerClaimV1(state, completion);
    assertPublication();
    if (!settlement.committed) {
      if (!settlement.linked || settlement.descriptor !== null) fail("cold settlement has not finished publication cleanup");
      settlement.unlinkAttempted = true;
      unlinkSync(pending);
      acceptOwnedLinkTransition(lstatSync(target, { bigint: true }), 1n);
      settlement.committed = true;
    }
    fsyncParent(target);
    assertPublication();
    state.phase = "settled";
    return settlement.record;
  } catch (error) {
    const state = retainedColdBootstrapIntentV1, settlement = state?.settlement;
    if (state && settlement?.descriptor !== null && settlement?.descriptor !== undefined) {
      let resumable = false;
      try { resumable = settlement.identity !== null && settlement.bytes.equals(readColdGenesisCandidateV1(path.join(rootPaths().root, ".cold-spawner-bootstrap-controller-settlement-v1.json.pending"), settlement.identity, settlement.linked ? 2 : 1))
        && sameColdFileMetadataV1(settlement.identity, fstatSync(settlement.descriptor, { bigint: true })); } catch { /* Crossed or partial publication remains a fence, not a writable retry. */ }
      if (!resumable) finishRetainedColdCleanupV1(() => {
        if (settlement.descriptor === null) return;
        closeSync(settlement.descriptor);
        const owned = state.helperInvocation!.authorityDescriptors;
        owned.splice(owned.indexOf(settlement.descriptor), 1);
        settlement.descriptor = null;
      });
    }
    throw error;
  } finally { coldControllerSettlementActiveV1 = false; }
}

// Fixed controller only: no caller-selected paths, process identities or proof.
// Historical settlement removes transport ownership, not startup admission.
export async function ensureInternalProductionColdSpawnerBootstrapSettledV1(): Promise<Extract<ReturnType<typeof observeInternalProductionColdSpawnerBootstrapJournalCensusV1>, { state: "settled" }>> {
  if (coldControllerFacadeActiveV1 || coldGenesisInvocationActiveV1 || coldBootstrapIntentInvocationActiveV1
    || coldControllerHelperInvocationActiveV1 || coldControllerSettlementActiveV1 || coldControllerReleaseActiveV1) fail("cold controller facade is already active");
  coldControllerFacadeActiveV1 = true;
  try {
    for (const close of pendingColdHelperAuthenticationCleanupV1) close();
    if (retainedColdGenesisRawV1 !== null) {
      if (retainedColdBootstrapIntentV1 !== null || retainedColdBootstrapPreparationV1 !== null) fail("cold controller has crossed retained owners");
      const raw = retainedColdGenesisRawV1;
      if (heldRawPhysicalTransitionLockV1(raw).cleanup.phase === "owned-unlink-completed") {
        try { releaseRawPhysicalTransitionLockV1(raw); }
        finally { if (!rawPhysicalTransitionLocksV1.has(raw)) retainedColdGenesisRawV1 = null; }
      }
    }
    if (retainedColdBootstrapIntentV1 !== null && retainedColdBootstrapPreparationV1 !== null) fail("cold controller has crossed retained preparation");
    if (retainedColdBootstrapIntentV1 === null && retainedColdBootstrapPreparationV1 === null) {
      const history = observeInternalProductionColdSpawnerBootstrapJournalCensusV1();
      if (history.state === "settled") {
        if (retainedColdGenesisRawV1 !== null) fail("cold controller still owns an unsettled raw lock");
        return history;
      }
    }
    if (retainedColdBootstrapPreparationV1 !== null || retainedColdBootstrapIntentV1?.phase === "intent-only") await prepareColdSpawnerBootstrapIntentV1();
    if (!["settled", "releasing"].includes(retainedColdBootstrapIntentV1?.phase ?? "")) await settleColdSpawnerBootstrapV1();
    const state = retainedColdBootstrapIntentV1;
    if (!state?.settlement?.committed || !state.settlement.identity) fail("cold controller has no retained terminal");
    const record = state.settlement.record, identity = coldFileIdentityTupleV1(state.settlement.identity);
    await releaseInternalProductionPhysicalServiceRestartAuthorityTransitionLeaseV1(state.lease);
    const history = observeInternalProductionColdSpawnerBootstrapJournalCensusV1();
    if (history.state !== "settled" || canonical(history.settlement) !== canonical(record)
      || canonical(history.settlementIdentity) !== canonical(identity)) fail("cold controller terminal changed across release");
    return history;
  } finally { coldControllerFacadeActiveV1 = false; }
}

function parseColdSpawnerBootstrapIntentV1(bytes: Buffer): Readonly<Record<string, unknown>> {
  if (bytes.length < 1 || bytes.length > COLD_GENESIS_MAX_BYTES_V1) fail("cold intent size is invalid");
  const intent = coldRecordV1(JSON.parse(bytes.toString("utf8")), ["schema", "purpose", "coldObservation", "launchProfile", "transitionLock", "lockIdentity", "epochRef", "epochHash", "genesisRef", "genesisHash", "nonceHash", "maximumDispatchCount", "intentRef", "intentHash"], "intent");
  if (!bytes.equals(Buffer.from(`${canonical(intent)}\n`)) || intent.schema !== "setfarm.internal-production-cold-spawner-bootstrap-intent.v1"
    || intent.purpose !== "exact-poison-sealed-cold-spawner-v1" || intent.maximumDispatchCount !== 1
    || intent.intentRef !== `setfarm://internal-production/cold-spawner-bootstrap-intent/sha256/${coldHashV1(intent.intentHash, "intent")}`) fail("cold intent binding is crossed");
  coldSelfHashV1(intent, "intentHash", ["intentRef"]);
  coldHashV1(intent.nonceHash, "intent nonce");
  const identity = coldRecordV1(intent.lockIdentity, ["devDecimal", "inoDecimal"], "intent lock identity");
  if (Object.values(identity).some((value) => typeof value !== "string" || !/^(?:0|[1-9][0-9]*)$/.test(value))) fail("cold intent lock identity is malformed");
  parseLockRecord(Buffer.from(`${canonical(intent.transitionLock)}\n`));
  const cold = validateColdBootstrapObservationV1(intent.coldObservation);
  const profile = intent.launchProfile as Record<string, unknown>;
  if (!profile || typeof profile !== "object" || Array.isArray(profile) || profile.schema !== "setfarm.internal-production-spawner-launch-profile.v1"
    || canonical(profile.source) !== canonical(cold.source)) fail("cold intent profile is crossed");
  coldSelfHashV1(profile, "profileHash");
  for (const [stem, prefix] of [["epoch", "physical-service-restart-authority-epoch"], ["genesis", "cold-epoch-genesis"]]) {
    if (intent[`${stem}Ref`] !== `setfarm://internal-production/${prefix}/sha256/${coldHashV1(intent[`${stem}Hash`], stem!)}`) fail("cold intent history pair is crossed");
  }
  return freezeColdDataV1(intent);
}

function parseColdSpawnerBootstrapDispatchV1(bytes: Buffer, intent: Readonly<Record<string, unknown>>, intentIdentity: Readonly<{ devDecimal: string; inoDecimal: string }>) {
  if (bytes.length < 1 || bytes.length > 65_536) fail("cold dispatch size is invalid");
  const dispatch = coldRecordV1(JSON.parse(bytes.toString("utf8")), ["schema", "purpose", "intentRef", "intentHash", "observationHash", "profileHash", "source", "operation", "epochRef", "epochHash", "genesisRef", "genesisHash", "lockIdentity", "intentIdentity", "nonceHash", "controller", "helper", "maximumDispatchCount", "action", "dispatchRef", "dispatchHash"], "dispatch");
  if (!bytes.equals(Buffer.from(`${canonical(dispatch)}\n`)) || dispatch.schema !== "setfarm.internal-production-cold-spawner-bootstrap-dispatch.v1"
    || dispatch.purpose !== "exact-poison-sealed-cold-spawner-v1" || dispatch.maximumDispatchCount !== 1
    || dispatch.dispatchRef !== `setfarm://internal-production/cold-spawner-bootstrap-dispatch/sha256/${coldHashV1(dispatch.dispatchHash, "dispatch")}`) fail("cold dispatch binding is crossed");
  coldSelfHashV1(dispatch, "dispatchHash", ["dispatchRef"]);
  const cold = intent.coldObservation as Record<string, unknown>, profile = intent.launchProfile as Record<string, unknown>;
  const lock = intent.transitionLock as Record<string, unknown>, executable = profile.executable as Record<string, unknown>;
  for (const key of ["intentRef", "intentHash", "epochRef", "epochHash", "genesisRef", "genesisHash", "lockIdentity", "nonceHash"]) {
    if (canonical(dispatch[key]) !== canonical(intent[key])) fail("cold dispatch intent pair is crossed");
  }
  if (dispatch.observationHash !== cold.observationHash || dispatch.profileHash !== profile.profileHash
    || canonical(dispatch.source) !== canonical(cold.source) || canonical(dispatch.operation) !== canonical(cold.operation)
    || canonical(dispatch.intentIdentity) !== canonical(intentIdentity)
    || canonical(dispatch.controller) !== canonical({ pid: lock.pid, processStartTimeEpochMs: lock.processStartTimeEpochMs, processIdentityHash: lock.processIdentityHash })) fail("cold dispatch retained evidence is crossed");
  const helper = coldRecordV1(dispatch.helper, ["pid", "processStartTimeEpochMs", "lstart", "command", "processIdentityHash", "uid", "ppid"], "dispatch helper");
  if (!Number.isSafeInteger(helper.pid) || (helper.pid as number) < 1 || helper.pid === lock.pid || helper.uid !== profile.uid || helper.ppid !== lock.pid
    || !Number.isSafeInteger(helper.processStartTimeEpochMs) || (helper.processStartTimeEpochMs as number) < 1
    || typeof helper.lstart !== "string" || helper.lstart.length !== 24 || Date.parse(helper.lstart) !== helper.processStartTimeEpochMs
    || helper.command !== `${executable.path} ${path.join(profile.repository as string, "dist/internal-production/baseline-service-restart-helper-v1.js")}`
    || helper.processIdentityHash !== sha256(canonical({ schema: "setfarm.internal-production-transition-lock-owner-process-identity.v1", pid: helper.pid,
      processStartTimeEpochMs: helper.processStartTimeEpochMs, lstart: helper.lstart, command: helper.command }))) fail("cold dispatch helper identity is crossed");
  if (canonical(dispatch.action) !== canonical({ transport: "direct-detached-node-v1", executable: executable.path,
    arguments: [path.join(profile.repository as string, "dist/spawner.js")], cwd: profile.cwd, detached: true })) fail("cold dispatch action is crossed");
  return freezeColdDataV1(dispatch);
}

function parseColdSpawnerBootstrapClaimV1(bytes: Buffer, intent: Readonly<Record<string, unknown>>, dispatch: Readonly<Record<string, unknown>>) {
  if (bytes.length < 1 || bytes.length > 65_536) fail("cold claim size is invalid");
  const claim = coldRecordV1(JSON.parse(bytes.toString("utf8")), ["schema", "purpose", "intentRef", "intentHash", "dispatchRef", "dispatchHash", "epochRef", "epochHash", "genesisRef", "genesisHash", "source", "profileHash", "lockIdentity", "child", "startupFiles", "maximumClaimCount", "claimRef", "claimHash"], "claim");
  if (!bytes.equals(Buffer.from(`${canonical(claim)}\n`)) || claim.schema !== "setfarm.internal-production-cold-spawner-bootstrap-claim.v1"
    || claim.purpose !== "exact-poison-sealed-cold-spawner-v1" || claim.maximumClaimCount !== 1
    || claim.claimRef !== `setfarm://internal-production/cold-spawner-bootstrap-claim/sha256/${coldHashV1(claim.claimHash, "claim")}`) fail("cold claim binding is crossed");
  coldSelfHashV1(claim, "claimHash", ["claimRef"]);
  for (const key of ["intentRef", "intentHash", "epochRef", "epochHash", "genesisRef", "genesisHash", "lockIdentity"]) {
    if (canonical(claim[key]) !== canonical(intent[key])) fail("cold claim intent pair is crossed");
  }
  const profile = intent.launchProfile as Record<string, unknown>, helper = dispatch.helper as Record<string, unknown>;
  const executable = profile.executable as Record<string, unknown>, lock = intent.transitionLock as Record<string, unknown>;
  if (claim.dispatchRef !== dispatch.dispatchRef || claim.dispatchHash !== dispatch.dispatchHash
    || claim.profileHash !== profile.profileHash || canonical(claim.source) !== canonical(profile.source)) fail("cold claim dispatch evidence is crossed");
  const child = coldRecordV1(claim.child, ["pid", "processStartTimeEpochMs", "lstart", "command", "processIdentityHash", "uid", "ppid", "pgid"], "claim child");
  if (!Number.isSafeInteger(child.pid) || (child.pid as number) < 1 || (child.pid as number) > 2_147_483_647 || child.pid === helper.pid || child.pid === lock.pid
    || child.uid !== profile.uid || child.ppid !== helper.pid || child.pgid !== child.pid
    || !Number.isSafeInteger(child.processStartTimeEpochMs) || (child.processStartTimeEpochMs as number) < 1
    || typeof child.lstart !== "string" || child.lstart.length !== 24 || Date.parse(child.lstart) !== child.processStartTimeEpochMs
    || child.command !== `${executable.path} ${path.join(profile.repository as string, "dist/spawner.js")}`
    || child.processIdentityHash !== sha256(canonical({ schema: "setfarm.internal-production-transition-lock-owner-process-identity.v1", pid: child.pid,
      processStartTimeEpochMs: child.processStartTimeEpochMs, lstart: child.lstart, command: child.command }))) fail("cold claim child identity is crossed");
  const ownership = coldRecordV1(claim.startupFiles, ["schema", "pid", "uid", "singleton", "pidFile"], "claim startup ownership");
  if (ownership.schema !== "setfarm.internal-production-cold-spawner-startup-ownership.v1" || ownership.pid !== child.pid || ownership.uid !== child.uid) fail("cold claim startup owner is crossed");
  const runtime = (intent.coldObservation as Record<string, any>).spawnerAbsence.ancestors.at(-1).path as string;
  for (const [key, name, expected] of [["singleton", "spawner.lock", `${child.pid}\n`], ["pidFile", "spawner.pid", String(child.pid)]]) {
    const file = coldRecordV1(ownership[key!], ["path", "devDecimal", "inoDecimal", "uid", "mode", "byteLength", "bytesHash", "identityHash"], "claim startup file");
    coldHashV1(file.identityHash, "claim startup identity");
    if (file.path !== path.join(runtime, name!) || file.uid !== child.uid || file.mode !== 0o600 || file.byteLength !== Buffer.byteLength(expected!) || file.bytesHash !== sha256(expected!)
      || typeof file.devDecimal !== "string" || !/^(?:0|[1-9][0-9]{0,19})$/.test(file.devDecimal)
      || typeof file.inoDecimal !== "string" || !/^[1-9][0-9]{0,19}$/.test(file.inoDecimal)) fail("cold claim startup file is crossed");
  }
  return freezeColdDataV1(claim);
}

// This is independent authentication of the inherited controller capability,
// not a zero-owner census, dispatch permission or a public journal exception.
// The fixed helper will retain this evidence across its subsequent live bracket.
async function authenticateColdSpawnerHelperIntentV1() {
  const guards: PrivateDirectoryGuardV1[] = [];
  const ownedDescriptors: number[] = [];
  const frameDescriptors = new Map<number, PrivateFrameDescriptorV1>();
  let closing = false, closed = false;
  const close = (): void => {
    if (closed) return;
    closing = true;
    while (ownedDescriptors.length > 0) {
      const descriptor = ownedDescriptors[ownedDescriptors.length - 1]!, frame = frameDescriptors.get(descriptor);
      if (frame) {
        try { closePrivateFrameDescriptorV1(frame); }
        finally { if (frame.descriptor === null) { frameDescriptors.delete(descriptor); ownedDescriptors.pop(); } }
      } else { closeSync(descriptor); ownedDescriptors.pop(); }
    }
    while (guards.length > 0) { guards[guards.length - 1]!.close(); guards.pop(); }
    closed = true;
    pendingColdHelperAuthenticationCleanupV1.delete(close);
  };
  try {
    // A failed cleanup remains owned. Do not acquire further pins while an
    // earlier refusal still has unfinished cleanup in this helper process.
    for (const pending of pendingColdHelperAuthenticationCleanupV1) pending();
    const transport = await import("./baseline-spawner-launch-environment-v1.js");
    const frameBytes = transport.readInternalProductionSpawnerUntrustedInheritedFrameV1();
    const frameStats = fstatSync(3, { bigint: true });
    const frame = coldRecordV1(JSON.parse(frameBytes.toString("utf8")), ["schema", "intentRef", "intentHash", "lockIdentity", "intentIdentity", "environment", "nonce"], "helper frame");
    if (!frameBytes.equals(Buffer.from(`${canonical(frame)}\n`))
      || frame.schema !== "setfarm.internal-production-cold-spawner-bootstrap-helper-capability.v1"
      || typeof frame.nonce !== "string" || !SHA256.test(frame.nonce)) fail("cold helper frame is invalid");
    const paths = rootPaths();
    const root = path.join(paths.root, "cold-spawner-bootstrap-v1");
    const intentPath = path.join(root, "intent.json");
    guards.push(authenticatePrivateDirectoryChainV1(resolveInternalProductionBaselineWorkspaceRootV1(), root));
    const rootStats = lstatSync(root, { bigint: true });
    const uid = BigInt(process.getuid!());
    if (rootStats.uid !== uid) fail("cold helper intent root owner is crossed");
    const readInherited = (fd: number, target: string, maximum: number) => {
      const held = fstatSync(fd, { bigint: true });
      if (held.size > BigInt(maximum) || !sameColdFileMetadataV1(held, lstatSync(target, { bigint: true }))) fail("cold helper inherited identity is crossed");
      const bytes = readColdGenesisCandidateV1(target, held);
      if (!sameColdFileMetadataV1(held, fstatSync(fd, { bigint: true }))) fail("cold helper inherited file changed");
      return { stats: held, bytes };
    };
    const lockFile = readInherited(4, paths.lock, 65_536);
    const intentFile = readInherited(5, intentPath, COLD_GENESIS_MAX_BYTES_V1);
    const lock = parseLockRecord(lockFile.bytes);
    const intent = parseColdSpawnerBootstrapIntentV1(intentFile.bytes);
    if (intent.nonceHash !== sha256(frame.nonce) || intent.intentRef !== frame.intentRef || intent.intentHash !== frame.intentHash
      || canonical(lock) !== canonical(intent.transitionLock) || canonical(intent.lockIdentity) !== canonical(descriptorIdentity(4))
      || canonical(frame.lockIdentity) !== canonical(intent.lockIdentity) || canonical(frame.intentIdentity) !== canonical(descriptorIdentity(5))) fail("cold helper intent binding is crossed");
    const cold = validateColdBootstrapObservationV1(intent.coldObservation);
    const genesisPath = coldGenesisReceiptPathV1(coldHashV1(intent.genesisHash, "helper genesis"));
    guards.push(authenticatePrivateDirectoryChainV1(resolveInternalProductionBaselineWorkspaceRootV1(), path.dirname(genesisPath)));
    const genesisStats = lstatSync(genesisPath, { bigint: true });
    const genesisBytes = readColdGenesisCandidateV1(genesisPath, genesisStats);
    const genesis = parseColdEpochGenesisReceiptV1(genesisBytes);
    const epochStats = lstatSync(paths.epoch, { bigint: true });
    const epochBytes = readColdGenesisCandidateV1(paths.epoch, epochStats);
    const epoch = validateColdEpochOneHeadV1(JSON.parse(epochBytes.toString("utf8")), epochBytes, genesis);
    if (["epochRef", "epochHash", "genesisRef", "genesisHash"].some((key) => intent[key] !== epoch[key])
      || coldGenesisStableIdentityV1(cold) !== coldGenesisStableIdentityV1(genesis.coldObservation as Readonly<Record<string, unknown>>)) fail("cold helper genesis binding is crossed");
    let dispatchStarted = false;
    let dispatch: Readonly<{ record: Readonly<Record<string, unknown>>; rootStats: BigIntStats; stats: BigIntStats; bytes: Buffer; descriptor: number; frameDescriptor: number }> | null = null;
    let childHandedOff = false;
    let childClaim: Readonly<{ record: Readonly<Record<string, unknown>>; rootStats: BigIntStats; stats: BigIntStats; bytes: Buffer; descriptor: number }> | null = null;
    let childScratch: Readonly<{ path: string; stats: BigIntStats }> | null = null;
    const assertOriginalStable = (): void => {
      if (closing || closed) fail("cold helper authentication is closed");
      for (const guard of guards) guard.assertStable();
      const currentRoot = lstatSync(root, { bigint: true });
      if (["dev", "ino", "uid", "gid", "mode", "birthtimeNs"].some((key) => currentRoot[key as keyof BigIntStats] !== rootStats[key as keyof BigIntStats])) fail("cold helper original root identity changed");
      // APFS includes the newly created file in a directory's link count.
      // Permit only that single publication delta; exact members/full metadata
      // remain mandatory before intent use and after dispatch publication.
      const ownNewEntries = dispatchStarted ? 1n + (childScratch === null ? 0n : 1n) + (childHandedOff ? 1n : 0n) : 0n;
      if (currentRoot.nlink !== rootStats.nlink && currentRoot.nlink !== rootStats.nlink + ownNewEntries
        && !(childHandedOff && currentRoot.nlink === rootStats.nlink + 1n)) fail("cold helper original root link count changed");
      if (childScratch !== null && !sameColdFileMetadataV1(childScratch.stats, lstatSync(childScratch.path, { bigint: true }))) fail("cold child empty frame changed");
      for (const [fd, target, expected, maximum] of [[4, paths.lock, lockFile, 65_536], [5, intentPath, intentFile, COLD_GENESIS_MAX_BYTES_V1]] as const) {
        const current = readInherited(fd, target, maximum);
        if (!sameColdFileMetadataV1(expected.stats, current.stats) || !expected.bytes.equals(current.bytes)) fail("cold helper inherited authority drifted");
      }
      for (const [target, stats, bytes] of [[genesisPath, genesisStats, genesisBytes], [paths.epoch, epochStats, epochBytes]] as const) {
        if (!readColdGenesisCandidateV1(target, stats).equals(bytes)) fail("cold helper bound history drifted");
      }
      if (!sameColdFileMetadataV1(frameStats, fstatSync(3, { bigint: true }))
        || !frameBytes.equals(transport.readInternalProductionSpawnerUntrustedInheritedFrameV1())) fail("cold helper private frame changed");
      const parent = boundedPsProcessIdentity(lock.pid as number);
      if (process.ppid !== lock.pid || !parent || parent.processStartTimeEpochMs !== lock.processStartTimeEpochMs
        || parent.processIdentityHash !== lock.processIdentityHash) fail("cold helper controller parent is crossed");
      for (const guard of guards) guard.assertStable();
    };
    const assertStable = (): void => {
      assertOriginalStable();
      if (dispatchStarted && dispatch === null) fail("cold helper dispatch publication is uncertain");
      const expectedRoot = childClaim?.rootStats ?? dispatch?.rootStats ?? rootStats;
      if (!sameColdFileMetadataV1(expectedRoot, lstatSync(root, { bigint: true }))) fail("cold helper intent prefix changed");
      const entries = readColdDirectoryMembersV1(root, childClaim !== null ? 3 : dispatch === null ? 1 : 2);
      if (canonical(entries.sort()) !== canonical(childClaim !== null ? ["claim.json", "dispatch.json", "intent.json"] : dispatch === null ? ["intent.json"] : ["dispatch.json", "intent.json"])) fail("cold helper journal prefix is crossed");
      if (dispatch !== null) {
        if (!sameColdFileMetadataV1(dispatch.stats, fstatSync(dispatch.descriptor, { bigint: true }))
          || !dispatch.bytes.equals(readColdGenesisCandidateV1(path.join(root, "dispatch.json"), dispatch.stats))) fail("cold helper dispatch authority changed");
      }
      if (childClaim !== null && (!sameColdFileMetadataV1(childClaim.stats, fstatSync(childClaim.descriptor, { bigint: true }))
        || !childClaim.bytes.equals(readColdGenesisCandidateV1(path.join(root, "claim.json"), childClaim.stats)))) fail("cold helper retained child claim changed");
      assertOriginalStable();
      if (!sameColdFileMetadataV1(expectedRoot, lstatSync(root, { bigint: true }))) fail("cold helper intent prefix changed");
    };
    assertStable();
    const observer = await import("./baseline-post-handoff-receipt-v1.js");
    const observed = await observer.observeInternalProductionSpawnerLaunchProfileCandidateV1();
    const profile = observed.profile;
    if (canonical(profile) !== canonical(intent.launchProfile) || canonical(profile.source) !== canonical(cold.source)
      || canonical(observed.environment) !== canonical(frame.environment) || profile.uid !== Number(uid)
      || profile.repository !== repositoryRoot() || profile.cwd !== process.cwd() || profile.executable.path !== process.execPath
      || process.execArgv.length !== 0 || process.argv.length !== 2 || process.argv[1] !== path.join(profile.repository, "dist/internal-production/baseline-service-restart-helper-v1.js")
      || fileURLToPath(import.meta.url) !== path.join(profile.repository, "dist/internal-production/baseline-restart-authority-retirement-v1.js")) fail("cold helper launch profile or snapshot is crossed");
    assertStable();
    const publishDispatch = () => {
      assertStable();
      if (dispatchStarted) fail("cold helper dispatch was already attempted");
      const helper = boundedPsProcessIdentity(process.pid);
      if (!helper) fail("cold helper process identity is absent");
      const body = { schema: "setfarm.internal-production-cold-spawner-bootstrap-dispatch.v1", purpose: "exact-poison-sealed-cold-spawner-v1",
        intentRef: intent.intentRef, intentHash: intent.intentHash, observationHash: cold.observationHash,
        profileHash: profile.profileHash, source: cold.source, operation: cold.operation,
        epochRef: intent.epochRef, epochHash: intent.epochHash, genesisRef: intent.genesisRef, genesisHash: intent.genesisHash,
        lockIdentity: intent.lockIdentity, intentIdentity: descriptorIdentity(5), nonceHash: intent.nonceHash,
        controller: { pid: lock.pid, processStartTimeEpochMs: lock.processStartTimeEpochMs, processIdentityHash: lock.processIdentityHash },
        helper: { ...helper, uid: Number(uid), ppid: process.ppid }, maximumDispatchCount: 1,
        action: { transport: "direct-detached-node-v1", executable: profile.executable.path,
          arguments: [path.join(profile.repository, "dist/spawner.js")], cwd: profile.cwd, detached: true } };
      const dispatchHash = sha256(canonical(body));
      const record = freezeColdDataV1({ ...body, dispatchRef: `setfarm://internal-production/cold-spawner-bootstrap-dispatch/sha256/${dispatchHash}`, dispatchHash });
      const bytes = Buffer.from(`${canonical(record)}\n`);
      parseColdSpawnerBootstrapDispatchV1(bytes, intent, descriptorIdentity(5));
      assertStable();
      dispatchStarted = true;
      const target = path.join(root, "dispatch.json");
      // A partial final file is deliberately an unsettled owner. Never recover,
      // overwrite or adopt it as a fresh launch opportunity after response loss.
      const writer = openSync(target, constants.O_CREAT | constants.O_EXCL | constants.O_RDWR | constants.O_NOFOLLOW, 0o600);
      ownedDescriptors.push(writer);
      const created = fstatSync(writer, { bigint: true });
      if (!created.isFile() || created.nlink !== 1n || created.uid !== uid || created.size !== 0n || (created.mode & 0o7777n) !== 0o600n
        || !sameColdFileMetadataV1(created, lstatSync(target, { bigint: true }))) fail("cold helper dispatch creation identity is crossed");
      writeFileSync(writer, bytes);
      fsyncSync(writer);
      fsyncParent(target);
      assertOriginalStable();
      const written = fstatSync(writer, { bigint: true });
      if (written.dev !== created.dev || written.ino !== created.ino || written.uid !== created.uid || written.gid !== created.gid
        || written.mode !== created.mode || written.birthtimeNs !== created.birthtimeNs || written.size !== BigInt(bytes.length)
        || !bytes.equals(readColdGenesisCandidateV1(target, written))) fail("cold helper dispatch publication changed");
      const reader = openSync(target, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
      ownedDescriptors.push(reader);
      if (!sameColdFileMetadataV1(written, fstatSync(reader, { bigint: true }))) fail("cold helper dispatch reopen changed");
      closeSync(writer);
      ownedDescriptors.splice(ownedDescriptors.indexOf(writer), 1);
      const childFrame = { schema: "setfarm.internal-production-cold-spawner-bootstrap-child-capability.v1", dispatchRef: record.dispatchRef, dispatchHash,
        dispatchIdentity: descriptorIdentity(reader), lockIdentity: intent.lockIdentity, environment: observed.environment, nonce: frame.nonce };
      const childBytes = Buffer.from(`${canonical(childFrame)}\n`);
      if (childBytes.length < 1 || childBytes.length > 1_048_576) fail("cold child frame exceeds its cap");
      assertOriginalStable();
      const scratch = path.join(root, `.cold-child-capability.${randomBytes(16).toString("hex")}.tmp`);
      const frameWriter = openSync(scratch, constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY | constants.O_NOFOLLOW, 0o600);
      ownedDescriptors.push(frameWriter);
      const writerPin: PrivateFrameDescriptorV1 = { descriptor: frameWriter, identity: null, closeEntered: false };
      frameDescriptors.set(frameWriter, writerPin);
      const empty = writerPin.identity = fstatSync(frameWriter, { bigint: true });
      childScratch = { path: scratch, stats: empty };
      if (!empty.isFile() || empty.uid !== uid || empty.dev !== rootStats.dev || empty.nlink !== 1n || empty.size !== 0n || (empty.mode & 0o7777n) !== 0o600n) fail("cold child empty frame identity is invalid");
      const frameReader = openSync(scratch, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
      ownedDescriptors.push(frameReader);
      const readerPin: PrivateFrameDescriptorV1 = { descriptor: frameReader, identity: null, closeEntered: false };
      frameDescriptors.set(frameReader, readerPin); readerPin.identity = fstatSync(frameReader, { bigint: true });
      assertOriginalStable();
      if (!sameColdFileMetadataV1(empty, fstatSync(frameWriter, { bigint: true })) || !sameColdFileMetadataV1(empty, fstatSync(frameReader, { bigint: true }))
        || !sameColdFileMetadataV1(empty, lstatSync(scratch, { bigint: true }))) fail("cold child empty frame changed before unlink");
      unlinkSync(scratch);
      childScratch = null;
      const originalEmptyFrame = assertOriginalEmptyUnlinkedFrameV1(frameWriter, frameReader, empty);
      fsyncParent(scratch);
      assertOriginalStable();
      assertOriginalEmptyUnlinkedFrameV1(frameWriter, frameReader, originalEmptyFrame);
      writeFileSync(frameWriter, childBytes);
      fsyncSync(frameWriter);
      const frameWritten = fstatSync(frameReader, { bigint: true });
      if (frameWritten.dev !== empty.dev || frameWritten.ino !== empty.ino || frameWritten.uid !== empty.uid || frameWritten.mode !== empty.mode
        || frameWritten.nlink !== 0n || frameWritten.size !== BigInt(childBytes.length) || !sameColdFileMetadataV1(frameWritten, fstatSync(frameWriter, { bigint: true }))) fail("cold child frame write changed");
      const verified = Buffer.alloc(childBytes.length);
      let offset = 0;
      while (offset < verified.length) {
        const count = readSync(frameReader, verified, offset, Math.min(65_536, verified.length - offset), offset);
        if (count < 1) fail("cold child frame read is partial");
        offset += count;
      }
      if (!verified.equals(childBytes) || readSync(frameReader, Buffer.alloc(1), 0, 1, offset) !== 0
        || !sameColdFileMetadataV1(frameWritten, fstatSync(frameReader, { bigint: true }))) fail("cold child frame read changed");
      closePrivateFrameDescriptorV1(writerPin); frameDescriptors.delete(frameWriter);
      ownedDescriptors.splice(ownedDescriptors.indexOf(frameWriter), 1);
      dispatch = { record, rootStats: lstatSync(root, { bigint: true }), stats: written, bytes, descriptor: reader, frameDescriptor: frameReader };
      assertStable();
      return record;
    };
    const observeChildClaim = (child: ChildProcess, readiness: Readonly<Record<string, unknown>>) => {
      if (!childHandedOff || !dispatch || childClaim || !Number.isSafeInteger(child.pid) || child.exitCode !== null || child.signalCode !== null) fail("cold helper child claim phase is unavailable");
      assertOriginalStable();
      if (canonical(readColdDirectoryMembersV1(root, 3).sort()) !== canonical(["claim.json", "dispatch.json", "intent.json"])) fail("cold helper child claim prefix is crossed");
      if (!sameColdFileMetadataV1(dispatch.stats, fstatSync(dispatch.descriptor, { bigint: true }))
        || !dispatch.bytes.equals(readColdGenesisCandidateV1(path.join(root, "dispatch.json"), dispatch.stats))) fail("cold helper original dispatch changed");
      const target = path.join(root, "claim.json"), stats = lstatSync(target, { bigint: true });
      const assertJournalIdentity = () => {
        const observedRoot = lstatSync(root, { bigint: true });
        if (canonical(readiness.journalIdentity) !== canonical(coldFileIdentityTupleV1(observedRoot))) fail("cold helper journal identity differs from child readiness");
        return observedRoot;
      };
      assertJournalIdentity();
      const assertOutput = () => verifyInternalProductionSpawnerLaunchOutputCandidateV1({
        rootIdentity: { devDecimal: profile.rootIdentity.devDecimal, inoDecimal: profile.rootIdentity.inoDecimal, uid: profile.rootIdentity.uid },
        sourceSha: profile.source.sha, sourceTreeHash: profile.source.treeHash,
        buildInfoBytesHash: profile.buildInfoBytesHash, outputTreeBytesHash: profile.outputTreeBytesHash,
        releaseManifestBytesHash: profile.releaseManifestBytesHash,
      });
      assertOutput(); assertOriginalStable(); assertJournalIdentity();
      if (stats.size < 1n || stats.size > 65_536n) fail("cold helper claim size is invalid");
      if (canonical(readiness.claimIdentity) !== canonical(coldFileIdentityTupleV1(stats))) fail("cold helper claim identity differs from child readiness");
      const bytes = readColdGenesisCandidateV1(target, stats), record = parseColdSpawnerBootstrapClaimV1(bytes, intent, dispatch.record);
      if (readiness.claimRef !== record.claimRef || readiness.claimHash !== record.claimHash) fail("cold helper claim hash differs from child readiness");
      const claimedChild = record.child as Record<string, unknown>;
      if (claimedChild.pid !== child.pid) fail("cold helper claim belongs to another child");
      const assertChild = () => {
        if (child.exitCode !== null || child.signalCode !== null) fail("cold helper spawned child exited");
        const actual = boundedPsProcessIdentity(child.pid!), ownership = observeColdProcessParentGroupV1(child.pid!);
        if (!actual || canonical({ ...actual, ...ownership }) !== canonical(claimedChild) || ownership.ppid !== process.pid) fail("cold helper spawned child identity changed");
      };
      const assertStartup = () => {
        const absence = cold.spawnerAbsence as Record<string, any>;
        for (const ancestor of absence.ancestors as Array<Record<string, unknown>>) {
          const s = lstatSync(ancestor.path as string, { bigint: true });
          if (!s.isDirectory() || s.isSymbolicLink() || String(s.dev) !== ancestor.dev || String(s.ino) !== ancestor.ino || String(s.uid) !== ancestor.uid || Number(s.mode & 0o7777n) !== ancestor.mode) fail("cold helper original runtime ancestor changed");
        }
        const files = record.startupFiles as Record<string, any>;
        for (const key of ["singleton", "pidFile"]) {
          const file = files[key], s = lstatSync(file.path, { bigint: true });
          if (s.size > 32n || String(s.dev) !== file.devDecimal || String(s.ino) !== file.inoDecimal || Number(s.uid) !== file.uid || Number(s.mode & 0o7777n) !== file.mode
            || file.identityHash !== sha256(canonical(coldFileIdentityTupleV1(s)))
            || Number(s.size) !== file.byteLength || sha256(readColdGenesisCandidateV1(file.path, s).toString()) !== file.bytesHash) fail("cold helper claimed startup file changed");
        }
      };
      assertChild(); assertStartup();
      const descriptor = openSync(target, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
      ownedDescriptors.push(descriptor);
      if (!sameColdFileMetadataV1(stats, fstatSync(descriptor, { bigint: true })) || !bytes.equals(readColdGenesisCandidateV1(target, stats))) fail("cold helper claim reopen changed");
      childClaim = { record, rootStats: assertJournalIdentity(), stats, bytes, descriptor };
      assertStable(); assertChild(); assertStartup(); assertOutput(); assertStable(); assertJournalIdentity();
      return freezeColdDataV1(JSON.parse(canonical({ schema: "setfarm.internal-production-cold-spawner-helper-completion.v1",
        intentRef: intent.intentRef, intentHash: intent.intentHash, intentIdentity: coldFileIdentityTupleV1(intentFile.stats),
        dispatchRef: dispatch.record.dispatchRef, dispatchHash: dispatch.record.dispatchHash, dispatchIdentity: coldFileIdentityTupleV1(dispatch.stats),
        claimRef: record.claimRef, claimHash: record.claimHash, claimIdentity: coldFileIdentityTupleV1(childClaim.stats),
        journalIdentity: coldFileIdentityTupleV1(childClaim.rootStats),
      })) as Record<string, unknown>);
    };
    const authenticated = { intent: freezeColdDataV1(intent), assertStable, publishDispatch, observeChildClaim, close,
      childDescriptors: () => { assertStable(); if (!dispatch || childHandedOff) fail("cold child dispatch is absent or consumed"); childHandedOff = true; return Object.freeze({ frameDescriptor: dispatch.frameDescriptor, dispatchDescriptor: dispatch.descriptor }); } };
    Object.defineProperty(authenticated, "environment", { value: freezeColdDataV1(observed.environment), enumerable: false });
    return Object.freeze(authenticated) as typeof authenticated & Readonly<{ environment: Readonly<Record<string, string>> }>;
  } catch {
    try { close(); } catch {
      pendingColdHelperAuthenticationCleanupV1.add(close);
      // Finish a transient pre-close interruption when possible. Persistent
      // errors keep their exact remaining handles reachable and fence reentry.
      try { close(); } catch { /* Retained until cleanup succeeds or process exit. */ }
    }
    return fail("cold helper authentication failed");
  }
}

function heldColdHelperContextV1(context: unknown): ColdHelperContextStateV1 {
  const state = context && typeof context === "object" ? coldHelperContextsV1.get(context) : undefined;
  if (!state || state.phase === "closing" || context !== coldHelperRuntimeContextV1) fail("cold helper context is foreign, cloned or closed");
  state.authentication.assertStable();
  return state;
}

export function observeInternalProductionColdSpawnerHelperIntentPhaseV1(context: unknown) {
  const state = heldColdHelperContextV1(context);
  if (state.phase !== "refreshing") fail("cold helper context is not refreshing");
  const intent = state.authentication.intent;
  const root = lstatSync(path.join(rootPaths().root, "cold-spawner-bootstrap-v1"), { bigint: true });
  const body = { schema: "setfarm.internal-production-cold-helper-owned-intent-phase.v1", state: "authenticated-own-intent-only", ownedIntentCount: 1,
    intentRef: intent.intentRef, intentHash: intent.intentHash, epochRef: intent.epochRef, epochHash: intent.epochHash,
    genesisRef: intent.genesisRef, genesisHash: intent.genesisHash, lockIdentity: intent.lockIdentity, intentIdentity: descriptorIdentity(5),
    rootIdentity: [root.dev, root.ino, root.uid, root.gid, root.mode, root.nlink, root.size, root.birthtimeNs, root.mtimeNs, root.ctimeNs].map(String) };
  state.authentication.assertStable();
  return freezeColdDataV1({ ...body, phaseHash: sha256(canonical(body)) });
}

// Configuration-only port: no input, publication, launch or phase admission.
// Runtime configuration must separately require its code-owned cold selector.
export function resolveInternalProductionColdSpawnerHelperRuntimeSnapshotV1() {
  if (coldHelperRuntimeContextV1 === null) {
    // Historical fixed helpers never import runtime-config. A new helper that
    // reaches configuration before FD authentication must not load defaults.
    if (process.argv[1] === path.join(repositoryRoot(), "dist/internal-production/baseline-service-restart-helper-v1.js")) fail("cold helper runtime snapshot is unavailable");
    return null;
  }
  const state = heldColdHelperContextV1(coldHelperRuntimeContextV1);
  const snapshot = { schema: "setfarm.internal-production-cold-helper-runtime-snapshot.v1" };
  Object.defineProperty(snapshot, "environment", { value: state.authentication.environment, enumerable: false });
  return Object.freeze(snapshot) as typeof snapshot & Readonly<{ environment: Readonly<Record<string, string>> }>;
}

// Remains private until the complete fixed helper dispatch path is integrated.
async function acquireColdSpawnerHelperContextV1() {
  if (coldHelperContextInvocationActiveV1) fail("cold helper context invocation is already active");
  for (const pending of pendingColdHelperAuthenticationCleanupV1) pending();
  if (coldHelperRuntimeContextV1 !== null) fail("cold helper context is already retained");
  coldHelperContextInvocationActiveV1 = true;
  let close: (() => void) | null = null;
  try {
    const authentication = await authenticateColdSpawnerHelperIntentV1();
    const context = Object.freeze({ schema: "setfarm.internal-production-cold-helper-context.v1", close: () => close!() });
    const state: ColdHelperContextStateV1 = { authentication, phase: "refreshing", observationHash: null };
    close = () => {
      if (!coldHelperContextsV1.has(context)) return;
      state.phase = "closing";
      authentication.close();
      coldHelperContextsV1.delete(context);
      if (coldHelperRuntimeContextV1 === context) coldHelperRuntimeContextV1 = null;
      pendingColdHelperAuthenticationCleanupV1.delete(close!);
    };
    coldHelperContextsV1.set(context, state);
    coldHelperRuntimeContextV1 = context;
    const before = observeInternalProductionColdSpawnerHelperIntentPhaseV1(context);
    const observer = await import("./baseline-post-handoff-receipt-v1.js");
    const cold = validateColdBootstrapObservationV1(await observer.observeInternalProductionColdSpawnerHelperBootstrapObservationV1(context));
    const profile = await observer.observeInternalProductionSpawnerLaunchProfileCandidateV1();
    if (canonical(cold) !== canonical(authentication.intent.coldObservation)
      || canonical(profile.profile) !== canonical(authentication.intent.launchProfile)
      || canonical(profile.environment) !== canonical(authentication.environment)
      || canonical(before) !== canonical(observeInternalProductionColdSpawnerHelperIntentPhaseV1(context))) fail("cold helper fresh observation is crossed");
    state.observationHash = cold.observationHash as string;
    state.phase = "ready";
    return context;
  } catch {
    if (close) {
      try { close(); } catch { pendingColdHelperAuthenticationCleanupV1.add(close); try { close(); } catch { /* Keep cleanup reachable and authentication revoked. */ } }
    }
    return fail("cold helper context refresh failed");
  } finally { coldHelperContextInvocationActiveV1 = false; }
}

function publishColdSpawnerHelperDispatchV1(context: unknown) {
  const state = heldColdHelperContextV1(context);
  if (state.phase !== "ready" || state.observationHash !== (state.authentication.intent.coldObservation as Record<string, unknown>).observationHash) fail("cold helper dispatch requires one ready context");
  state.phase = "dispatch-publication";
  try {
    const dispatch = state.authentication.publishDispatch();
    state.phase = "dispatch-owned";
    return dispatch;
  } catch {
    state.phase = "closing";
    const close = () => {
      (context as { close(): void }).close();
      pendingColdHelperAuthenticationCleanupV1.delete(close);
    };
    try { close(); } catch { pendingColdHelperAuthenticationCleanupV1.add(close); try { close(); } catch { /* Keep failed cleanup owned. */ } }
    return fail("cold helper dispatch publication is uncertain");
  }
}

function takeColdSpawnerChildLaunchDescriptorsV1(context: unknown) {
  const state = heldColdHelperContextV1(context);
  if (state.phase !== "dispatch-owned") fail("cold child launch descriptors were already consumed or are unavailable");
  state.phase = "child-launch-handed-off";
  return state.authentication.childDescriptors();
}

export async function runInternalProductionColdSpawnerHelperV1(): Promise<Readonly<Record<string, unknown>>> {
  if (coldHelperTransportAttemptedV1) fail("cold helper transport was already attempted");
  coldHelperTransportAttemptedV1 = true;
  let context: Awaited<ReturnType<typeof acquireColdSpawnerHelperContextV1>> | undefined;
  let child: ChildProcess | undefined, readiness: Readable | undefined;
  let accepted = false, cleanupFailed = false;
  let completion: Readonly<Record<string, unknown>> | null = null;
  try {
    context = await acquireColdSpawnerHelperContextV1();
    const state = heldColdHelperContextV1(context);
    const profile = state.authentication.intent.launchProfile as Record<string, any>;
    publishColdSpawnerHelperDispatchV1(context);
    const handles = takeColdSpawnerChildLaunchDescriptorsV1(context);
    state.authentication.assertStable();
    child = spawn(profile.executable.path, [path.join(profile.repository, "dist/spawner.js")], {
      cwd: profile.cwd, detached: true, shell: false,
      env: { PATH: "/usr/bin:/bin", LANG: "C", LC_ALL: "C", SETFARM_INTERNAL_PRODUCTION_COLD_CHILD: "1" },
      stdio: ["ignore", "ignore", "ignore", handles.frameDescriptor, 4, handles.dispatchDescriptor, "pipe"],
    });
    readiness = (child.stdio as readonly unknown[])[6] as Readable | undefined;
    if (!readiness || typeof readiness.on !== "function") fail("cold child readiness pipe is unavailable");
    const spawned = child, pipe = readiness;
    const envelope = await new Promise<Readonly<Record<string, unknown>>>((resolve, reject) => {
      let settled = false, count = 0;
      const chunks: Buffer[] = [];
      const finish = (error?: Error) => {
        if (settled) return;
        settled = true; clearTimeout(timer);
        pipe.removeListener("data", onData); pipe.removeListener("end", onEnd); pipe.removeListener("error", onError);
        spawned.removeListener("error", onError); spawned.removeListener("exit", onExit);
        if (error) { reject(error); return; }
        try {
          const bytes = Buffer.concat(chunks, count);
          const value = coldRecordV1(JSON.parse(bytes.toString("utf8")), ["schema", "claimRef", "claimHash", "claimIdentity", "journalIdentity"], "child readiness");
          if (value.schema !== "setfarm.internal-production-cold-spawner-readiness.v1" || !bytes.equals(Buffer.from(`${canonical(value)}\n`))) fail("cold child readiness is crossed");
          resolve(freezeColdDataV1(value));
        } catch { reject(Error("cold child readiness is malformed")); }
      };
      const onError = () => finish(Error("cold child readiness failed"));
      const onExit = () => finish(Error("cold child exited before readiness"));
      const onData = (bytes: Buffer) => {
        if (bytes.length < 1 || count + bytes.length > 4096) return finish(Error("cold child readiness exceeds its cap"));
        chunks.push(Buffer.from(bytes)); count += bytes.length;
      };
      const onEnd = () => finish(count > 0 ? undefined : Error("cold child readiness is absent"));
      const timer = setTimeout(() => finish(Error("cold child readiness timed out")), 30_000);
      pipe.on("data", onData); pipe.once("end", onEnd); pipe.once("error", onError);
      spawned.once("error", onError); spawned.once("exit", onExit);
    });
    // Do not use the ordinary two-member context gate after a child may have
    // published. Only this private one-shot spawn can observe its third member.
    if (coldHelperContextsV1.get(context) !== state || state.phase !== "child-launch-handed-off") fail("cold helper claim phase changed");
    completion = state.authentication.observeChildClaim(child, envelope);
    state.phase = "claimed";
    state.authentication.assertStable();
    accepted = true;
  } catch { /* The durable dispatch fence remains the only retry evidence. */ }
  finally {
    if (readiness) { readiness.on("error", () => {}); readiness.destroy(); }
    if (child) { child.on("error", () => {}); child.unref(); }
    if (context) {
      const close = () => { context!.close(); pendingColdHelperAuthenticationCleanupV1.delete(close); };
      try { close(); }
      catch { cleanupFailed = true; pendingColdHelperAuthenticationCleanupV1.add(close); try { close(); } catch { /* Retain unfinished exact ownership. */ } }
    }
  }
  if (!accepted || cleanupFailed || completion === null || Buffer.byteLength(`${canonical(completion)}\n`) > 4096) fail("cold helper transport is uncertain");
  return completion;
}

function observeColdProcessParentGroupV1(pid: number) {
  const result = spawnSync("/bin/ps", ["-p", String(pid), "-o", "uid=,ppid=,pgid="], {
    env: { PATH: "/usr/bin:/bin", LANG: "C", LC_ALL: "C" }, shell: false, encoding: "utf8", timeout: 2_000, maxBuffer: 65_536,
  });
  const match = /^\s*([0-9]+)\s+([0-9]+)\s+([0-9]+)\n$/.exec(result.stdout);
  if (result.error || result.signal || result.status !== 0 || result.stderr !== "" || !match) fail("cold process ownership is ambiguous");
  const [uid, ppid, pgid] = match.slice(1).map(Number);
  if (![uid, ppid, pgid].every(Number.isSafeInteger)) fail("cold process ownership is malformed");
  return { uid, ppid, pgid };
}

function authenticateColdSpawnerChildCapabilityV1() {
  const guards: PrivateDirectoryGuardV1[] = [];
  const descriptors: number[] = [];
  let closed = false, closing = false;
  const close = () => {
    if (closed) return;
    closing = true;
    while (descriptors.length > 0) { closeSync(descriptors[descriptors.length - 1]!); descriptors.pop(); }
    while (guards.length > 0) { guards[guards.length - 1]!.close(); guards.pop(); }
    closed = true;
    pendingColdHelperAuthenticationCleanupV1.delete(close);
  };
  try {
    const frameBytes = readInternalProductionSpawnerUntrustedInheritedFrameV1(), frameStats = fstatSync(3, { bigint: true });
    const frame = coldRecordV1(JSON.parse(frameBytes.toString("utf8")), ["schema", "dispatchRef", "dispatchHash", "dispatchIdentity", "lockIdentity", "environment", "nonce"], "child frame");
    if (frame.schema !== "setfarm.internal-production-cold-spawner-bootstrap-child-capability.v1" || !frameBytes.equals(Buffer.from(`${canonical(frame)}\n`))) fail("cold child frame domain is crossed");
    coldHashV1(frame.nonce, "child nonce");
    const paths = rootPaths(), root = path.join(paths.root, "cold-spawner-bootstrap-v1");
    guards.push(authenticatePrivateDirectoryChainV1(resolveInternalProductionBaselineWorkspaceRootV1(), root));
    const rootStats = lstatSync(root, { bigint: true });
    const pinned = new Map<string, Readonly<{ stats: BigIntStats; bytes: Buffer }>>();
    const read = (target: string, maximum: number, inherited?: number) => {
      const stats = lstatSync(target, { bigint: true });
      if (stats.size > BigInt(maximum) || (inherited !== undefined && !sameColdFileMetadataV1(stats, fstatSync(inherited, { bigint: true })))) fail("cold child inherited identity is crossed");
      const bytes = readColdGenesisCandidateV1(target, stats);
      if (inherited !== undefined && !sameColdFileMetadataV1(stats, fstatSync(inherited, { bigint: true }))) fail("cold child inherited identity changed");
      pinned.set(target, { stats, bytes });
      return { stats, bytes };
    };
    const lockFile = read(paths.lock, 65_536, 4), lock = parseLockRecord(lockFile.bytes);
    const intentFile = read(path.join(root, "intent.json"), COLD_GENESIS_MAX_BYTES_V1), intent = parseColdSpawnerBootstrapIntentV1(intentFile.bytes);
    const intentIdentity = { devDecimal: String(intentFile.stats.dev), inoDecimal: String(intentFile.stats.ino) };
    const dispatchFile = read(path.join(root, "dispatch.json"), 65_536, 5), dispatch = parseColdSpawnerBootstrapDispatchV1(dispatchFile.bytes, intent, intentIdentity);
    if (canonical(lock) !== canonical(intent.transitionLock) || canonical(descriptorIdentity(4)) !== canonical(intent.lockIdentity)
      || canonical(frame.lockIdentity) !== canonical(intent.lockIdentity) || canonical(frame.dispatchIdentity) !== canonical(descriptorIdentity(5))
      || frame.dispatchRef !== dispatch.dispatchRef || frame.dispatchHash !== dispatch.dispatchHash || sha256(frame.nonce as string) !== intent.nonceHash) fail("cold child descriptor chain is crossed");
    const genesisPath = coldGenesisReceiptPathV1(intent.genesisHash as string);
    guards.push(authenticatePrivateDirectoryChainV1(resolveInternalProductionBaselineWorkspaceRootV1(), path.dirname(genesisPath)));
    const genesis = parseColdEpochGenesisReceiptV1(read(genesisPath, COLD_GENESIS_MAX_BYTES_V1).bytes);
    const epochBytes = read(paths.epoch, COLD_GENESIS_MAX_BYTES_V1).bytes;
    const epoch = validateColdEpochOneHeadV1(JSON.parse(epochBytes.toString("utf8")), epochBytes, genesis);
    if (["epochRef", "epochHash", "genesisRef", "genesisHash"].some((key) => intent[key] !== epoch[key])
      || coldGenesisStableIdentityV1(intent.coldObservation as Record<string, unknown>) !== coldGenesisStableIdentityV1(genesis.coldObservation as Record<string, unknown>)) fail("cold child history is crossed");
    const profile = coldRecordV1(intent.launchProfile, ["schema", "source", "uid", "home", "workspace", "repository", "rootIdentity", "hostDirectories", "executable", "arguments", "cwd", "environmentDirectory", "buildInfoBytesHash", "outputTreeBytesHash", "releaseManifestBytesHash", "plistBytesHash", "loadedLaunchProjectionHash", "environmentHash", "environmentFiles", "profileHash"], "child launch profile");
    const uid = process.getuid!();
    if (profile.uid !== uid || profile.workspace !== resolveInternalProductionBaselineWorkspaceRootV1() || profile.repository !== repositoryRoot() || profile.cwd !== process.cwd()
      || canonical(profile.arguments) !== canonical([path.join(repositoryRoot(), "dist/spawner.js")])
      || process.execArgv.length !== 0 || process.argv.length !== 2 || process.argv[1] !== path.join(repositoryRoot(), "dist/spawner.js")) fail("cold child runtime entry is crossed");
    const environment = frame.environment as Record<string, unknown>;
    if (!environment || typeof environment !== "object" || Array.isArray(environment) || Object.keys(environment).length > 1024
      || Buffer.byteLength(canonical(environment)) > 524_288) fail("cold child environment shape is invalid");
    for (const [key, value] of Object.entries(environment)) {
      if (!/^[A-Za-z_][A-Za-z0-9_]{0,127}$/.test(key) || typeof value !== "string" || value.includes("\0") || Buffer.byteLength(value) > 65_536
        || /^(?:NODE_|DYLD_|LD_|SETFARM_TEST_|SETFARM_INTERNAL_PRODUCTION_)/.test(key) || ["SETFARM_SKIP_RUNTIME_GUARD", "SETFARM_ALLOW_DIRTY_BUILD"].includes(key)) fail("cold child environment is invalid");
    }
    for (const key of ["HOME", "LANG", "LC_ALL", "PATH", "SETFARM_ENV_DIR", "SETFARM_PG_URL", "SETFARM_REPO_DIR"]) if (!environment[key]) fail("cold child base environment is absent");
    if (profile.environmentHash !== sha256(`setfarm.internal-production-spawner-launch-environment-candidate.v1\n${canonical(environment)}`)
      || environment.HOME !== profile.home || environment.SETFARM_REPO_DIR !== profile.repository || environment.SETFARM_ENV_DIR !== profile.environmentDirectory
      || environment.LANG !== "C" || environment.LC_ALL !== "C") fail("cold child environment commitment is crossed");
    const identity = (stats: BigIntStats) => ({ devDecimal: String(stats.dev), inoDecimal: String(stats.ino), uid: Number(stats.uid), gid: Number(stats.gid), mode: Number(stats.mode & 0o7777n) });
    const executable = coldRecordV1(profile.executable, ["path", "devDecimal", "inoDecimal", "uid", "gid", "mode", "bytesHash"], "child executable");
    if (executable.path !== process.execPath) fail("cold child Node path is crossed");
    const directories = new Map<string, BigIntStats>();
    if (!Array.isArray(profile.hostDirectories) || profile.hostDirectories.length < 1 || profile.hostDirectories.length > 128) fail("cold child host directories are invalid");
    for (const candidate of profile.hostDirectories) {
      const directory = coldRecordV1(candidate, ["path", "devDecimal", "inoDecimal", "uid", "gid", "mode"], "child host directory");
      if (typeof directory.path !== "string" || !path.isAbsolute(directory.path) || directories.has(directory.path)) fail("cold child host directory path is invalid");
      const stats = lstatSync(directory.path, { bigint: true });
      const { path: target, ...expected } = directory;
      if (!stats.isDirectory() || stats.isSymbolicLink() || canonical(expected) !== canonical(identity(stats))) fail("cold child host identity is crossed");
      directories.set(target as string, stats);
    }
    for (const value of [profile.home, profile.workspace, profile.repository, profile.environmentDirectory, path.dirname(process.execPath)]) {
      if (typeof value !== "string" || !path.isAbsolute(value)) fail("cold child host root is invalid");
      for (let target = value; ; target = path.dirname(target)) { if (!directories.has(target)) fail("cold child host ancestry is incomplete"); if (path.dirname(target) === target) break; }
    }
    if (canonical(profile.rootIdentity) !== canonical(identity(directories.get(repositoryRoot())!))) fail("cold child repository identity is crossed");
    const runtimeAncestors = ((intent.coldObservation as Record<string, any>).spawnerAbsence.ancestors as Array<Record<string, unknown>>).map((ancestor) => {
      const target = ancestor.path as string, stats = lstatSync(target, { bigint: true });
      if (!stats.isDirectory() || stats.isSymbolicLink() || String(stats.dev) !== ancestor.dev || String(stats.ino) !== ancestor.ino
        || String(stats.uid) !== ancestor.uid || Number(stats.mode & 0o7777n) !== ancestor.mode) fail("cold child original runtime ancestry is crossed");
      const descriptor = openSync(target, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_DIRECTORY);
      descriptors.push(descriptor);
      if (!sameColdFileMetadataV1(stats, fstatSync(descriptor, { bigint: true })) || !sameColdFileMetadataV1(stats, lstatSync(target, { bigint: true }))) fail("cold child runtime ancestor acquisition changed");
      return { target, stats, descriptor };
    });
    const nodeStats = lstatSync(process.execPath, { bigint: true }), node = openSync(process.execPath, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
    descriptors.push(node);
    try {
      const { path: nodePath, bytesHash, ...expected } = executable;
      if (!nodeStats.isFile() || nodeStats.isSymbolicLink() || nodeStats.nlink !== 1n || nodeStats.size < 1n || nodeStats.size > 268_435_456n
        || canonical(expected) !== canonical(identity(nodeStats)) || !sameColdFileMetadataV1(nodeStats, fstatSync(node, { bigint: true }))) fail("cold child Node identity is crossed");
      const hash = createHash("sha256"), buffer = Buffer.alloc(65_536);
      let offset = 0;
      while (offset < Number(nodeStats.size)) { const count = readSync(node, buffer, 0, Math.min(buffer.length, Number(nodeStats.size) - offset), offset); if (count < 1) fail("cold child Node read is partial"); hash.update(buffer.subarray(0, count)); offset += count; }
      if (hash.digest("hex") !== bytesHash || readSync(node, buffer, 0, 1, offset) !== 0 || !sameColdFileMetadataV1(nodeStats, fstatSync(node, { bigint: true }))) fail("cold child Node bytes changed");
    } finally { closeSync(node); descriptors.splice(descriptors.indexOf(node), 1); }
    const helper = dispatch.helper as Record<string, unknown>;
    let claimStarted = false;
    let claim: Readonly<{ record: Readonly<Record<string, unknown>>; rootStats: BigIntStats; stats: BigIntStats; bytes: Buffer; descriptor: number; observeStartupOwnership: () => unknown }> | null = null;
    const assertOriginalStable = () => {
      if (closed || closing) fail("cold child authentication is closed");
      for (const guard of guards) guard.assertStable();
      const currentRoot = lstatSync(root, { bigint: true });
      if (["dev", "ino", "uid", "gid", "mode", "birthtimeNs"].some((key) => currentRoot[key as keyof BigIntStats] !== rootStats[key as keyof BigIntStats])
        || (currentRoot.nlink !== rootStats.nlink && (!claimStarted || currentRoot.nlink !== rootStats.nlink + 1n))) fail("cold child original root changed");
      for (const [target, pin] of pinned) if (!pin.bytes.equals(readColdGenesisCandidateV1(target, pin.stats))) fail("cold child original authority changed");
      if (!sameColdFileMetadataV1(lockFile.stats, fstatSync(4, { bigint: true })) || !sameColdFileMetadataV1(dispatchFile.stats, fstatSync(5, { bigint: true }))
        || !sameColdFileMetadataV1(frameStats, fstatSync(3, { bigint: true })) || !frameBytes.equals(readInternalProductionSpawnerUntrustedInheritedFrameV1())) fail("cold child inherited descriptors changed");
      // The launch profile commits physical host identities, not ownership of
      // every sibling entry in shared host ancestors for this process lifetime.
      for (const [target, stats] of directories) {
        const current = lstatSync(target, { bigint: true });
        if (!current.isDirectory() || current.isSymbolicLink()
          || ["dev", "ino", "uid", "gid", "mode", "birthtimeNs"].some((key) => current[key as keyof BigIntStats] !== stats[key as keyof BigIntStats])) fail("cold child host ancestry changed");
      }
      // The original absence observation owns this directory chain. Own lock/PID
      // publication may change directory counters, never these physical identities.
      for (const pin of runtimeAncestors) for (const current of [lstatSync(pin.target, { bigint: true }), fstatSync(pin.descriptor, { bigint: true })]) {
        if (!current.isDirectory() || current.isSymbolicLink()
          || ["dev", "ino", "uid", "gid", "mode", "birthtimeNs"].some((key) => current[key as keyof BigIntStats] !== pin.stats[key as keyof BigIntStats])) fail("cold child original runtime ancestry changed");
      }
      if (!sameColdFileMetadataV1(nodeStats, lstatSync(process.execPath, { bigint: true }))) fail("cold child Node changed");
      const controller = boundedPsProcessIdentity(lock.pid as number), controllerOwnership = observeColdProcessParentGroupV1(lock.pid as number);
      let originalParent = false;
      try {
        const parent = boundedPsProcessIdentity(helper.pid as number);
        const parentOwnership = parent === null ? null : observeColdProcessParentGroupV1(helper.pid as number);
        originalParent = parent?.processIdentityHash === helper.processIdentityHash && parentOwnership?.uid === uid && parentOwnership.ppid === lock.pid;
      } catch (error) {
        // A helper can disappear between the two read-only process probes.
        // Only an owned claim and fresh proof of that exact PID's absence may
        // select the one allowed parent transition; other probe errors refuse.
        if (claim === null || boundedPsProcessIdentity(helper.pid as number) !== null) throw error;
      }
      const own = observeColdProcessParentGroupV1(process.pid);
      // Parent exit may occur after our own process row was read. Reobserve
      // only that one claimed helper -> pid-one transition, never a new owner.
      const parentPid = process.ppid;
      const settledOwn = claim !== null && own.ppid === helper.pid && parentPid === 1 ? observeColdProcessParentGroupV1(process.pid) : own;
      originalParent = originalParent && parentPid === helper.pid && settledOwn.ppid === helper.pid;
      const departedParent = claim !== null && parentPid === 1 && settledOwn.ppid === 1 && boundedPsProcessIdentity(helper.pid as number) === null;
      if ((!originalParent && !departedParent) || controller?.processIdentityHash !== lock.processIdentityHash
        || own.uid !== uid || own.pgid !== process.pid || settledOwn.uid !== uid || settledOwn.pgid !== process.pid || controllerOwnership.uid !== uid) fail("cold child live parent chain is crossed");
      for (const guard of guards) guard.assertStable();
    };
    const assertStable = () => {
      assertOriginalStable();
      if (claimStarted && claim === null) fail("cold child claim publication is uncertain");
      const expectedRoot = claim?.rootStats ?? rootStats;
      if (!sameColdFileMetadataV1(expectedRoot, lstatSync(root, { bigint: true }))) fail("cold child journal changed");
      const members = readColdDirectoryMembersV1(root, claim === null ? 2 : 3);
      if (canonical(members.sort()) !== canonical(claim === null ? ["dispatch.json", "intent.json"] : ["claim.json", "dispatch.json", "intent.json"])) fail("cold child journal prefix is crossed");
      if (claim !== null && (!sameColdFileMetadataV1(claim.stats, fstatSync(claim.descriptor, { bigint: true }))
        || !claim.bytes.equals(readColdGenesisCandidateV1(path.join(root, "claim.json"), claim.stats)))) fail("cold child claim changed");
      if (claim !== null && canonical(claim.observeStartupOwnership()) !== canonical(claim.record.startupFiles)) fail("cold child claimed startup ownership changed");
      assertOriginalStable();
      if (!sameColdFileMetadataV1(expectedRoot, lstatSync(root, { bigint: true }))) fail("cold child journal changed");
    };
    const source = profile.source as Record<string, string>, rootIdentity = profile.rootIdentity as { devDecimal: string; inoDecimal: string; uid: number };
    const output = { rootIdentity: { devDecimal: rootIdentity.devDecimal, inoDecimal: rootIdentity.inoDecimal, uid: rootIdentity.uid },
      sourceSha: source.sha!, sourceTreeHash: source.treeHash!, buildInfoBytesHash: profile.buildInfoBytesHash as string,
      outputTreeBytesHash: profile.outputTreeBytesHash as string, releaseManifestBytesHash: profile.releaseManifestBytesHash as string };
    const assertOutputStable = () => { assertStable(); verifyInternalProductionSpawnerLaunchOutputCandidateV1(output); assertStable(); };
    assertOutputStable();
    let residueAttempted = false, residueConsumed = false;
    const consumePidResidue = async () => {
      assertOutputStable();
      if (residueAttempted || claimStarted) fail("cold child PID residue was already attempted");
      residueAttempted = true;
      const startup = await import("../spawner.js");
      assertOutputStable();
      const absence = (intent.coldObservation as Record<string, any>).spawnerAbsence;
      const target = path.join(absence.ancestors.at(-1).path, "spawner.pid");
      const singleton = startup.observeInternalProductionColdSpawnerSingletonOwnershipV1();
      if (singleton.path !== path.join(path.dirname(target), "spawner.lock") || singleton.uid !== uid || singleton.mode !== 0o600
        || singleton.bytesHash !== sha256(`${process.pid}\n`)) fail("cold child PID residue singleton is crossed");
      const assertOwner = () => {
        assertOutputStable();
        if (canonical(startup.observeInternalProductionColdSpawnerSingletonOwnershipV1()) !== canonical(singleton)) fail("cold child PID residue singleton changed");
      };
      const assertAbsent = () => {
        try { lstatSync(target); }
        catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return; throw error; }
        fail("cold child PID residue is not absent");
      };
      const residue = absence.pidFile;
      if (residue.state === "absent") { assertOwner(); assertAbsent(); assertOwner(); assertAbsent(); residueConsumed = true; return; }
      const original = lstatSync(target, { bigint: true }), expected = residue.identity;
      if (!original.isFile() || original.isSymbolicLink() || original.nlink !== 1n || original.size < 1n || original.size > 32n
        || ["dev", "ino", "uid", "nlink", "size", "mtimeNs", "ctimeNs"].some((key) => String(original[key as keyof BigIntStats]) !== expected[key])
        || Number(original.mode & 0o7777n) !== expected.mode) fail("cold child original PID residue changed");
      const descriptor = openSync(target, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
      descriptors.push(descriptor);
      const assertResidue = () => {
        if (!sameColdFileMetadataV1(original, fstatSync(descriptor, { bigint: true })) || !sameColdFileMetadataV1(original, lstatSync(target, { bigint: true }))) fail("cold child PID residue identity changed");
        const bytes = Buffer.alloc(Number(original.size) + 1), count = readSync(descriptor, bytes, 0, bytes.length, 0);
        if (count !== Number(original.size) || !bytes.subarray(0, count).equals(Buffer.from(String(residue.pid)))
          || sha256(bytes.subarray(0, count).toString()) !== residue.bytesSha256
          || !sameColdFileMetadataV1(original, fstatSync(descriptor, { bigint: true })) || !sameColdFileMetadataV1(original, lstatSync(target, { bigint: true }))) fail("cold child PID residue bytes changed");
      };
      const assertDead = () => {
        try { process.kill(residue.pid, 0); }
        catch (error) { if ((error as NodeJS.ErrnoException).code === "ESRCH") return; throw error; }
        fail("cold child PID residue is live or reused");
      };
      assertOwner(); assertResidue(); assertDead();
      assertOwner(); assertResidue(); assertDead(); assertOwner(); assertResidue();
      unlinkSync(target);
      fsyncParent(target);
      assertAbsent();
      const unlinked = fstatSync(descriptor, { bigint: true });
      if (unlinked.nlink !== 0n || unlinked.dev !== original.dev || unlinked.ino !== original.ino || unlinked.uid !== original.uid
        || unlinked.gid !== original.gid || unlinked.mode !== original.mode || unlinked.size !== original.size
        || unlinked.birthtimeNs !== original.birthtimeNs || unlinked.mtimeNs !== original.mtimeNs) fail("cold child consumed PID inode changed");
      closeSync(descriptor); descriptors.splice(descriptors.indexOf(descriptor), 1);
      assertOwner(); assertAbsent();
      residueConsumed = true;
    };
    const publishClaim = async () => {
      assertOutputStable();
      if (!residueConsumed) fail("cold child PID residue has not been consumed");
      if (claimStarted) fail("cold child claim was already attempted");
      claimStarted = true;
      const main = await import("../spawner.js");
      assertOriginalStable();
      const ownership = main.observeInternalProductionColdSpawnerStartupOwnershipV1();
      const runtime = (intent.coldObservation as Record<string, any>).spawnerAbsence.ancestors.at(-1).path as string;
      if (ownership.pid !== process.pid || ownership.uid !== uid || ownership.singleton.path !== path.join(runtime, "spawner.lock")
        || ownership.pidFile.path !== path.join(runtime, "spawner.pid") || ownership.singleton.uid !== uid || ownership.pidFile.uid !== uid
        || ownership.singleton.mode !== 0o600 || ownership.pidFile.mode !== 0o600
        || ownership.singleton.bytesHash !== sha256(`${process.pid}\n`) || ownership.pidFile.bytesHash !== sha256(String(process.pid))) fail("cold child startup ownership is crossed");
      verifyInternalProductionSpawnerLaunchOutputCandidateV1(output);
      assertOriginalStable();
      if (!sameColdFileMetadataV1(rootStats, lstatSync(root, { bigint: true }))
        || canonical(readColdDirectoryMembersV1(root, 2).sort()) !== canonical(["dispatch.json", "intent.json"])) fail("cold child pre-claim prefix changed");
      const observedChild = boundedPsProcessIdentity(process.pid), processGroup = observeColdProcessParentGroupV1(process.pid);
      if (!observedChild || processGroup.uid !== uid || processGroup.ppid !== helper.pid || processGroup.pgid !== process.pid) fail("cold child claim process is crossed");
      const body = { schema: "setfarm.internal-production-cold-spawner-bootstrap-claim.v1", purpose: "exact-poison-sealed-cold-spawner-v1",
        intentRef: intent.intentRef, intentHash: intent.intentHash, dispatchRef: dispatch.dispatchRef, dispatchHash: dispatch.dispatchHash,
        epochRef: intent.epochRef, epochHash: intent.epochHash, genesisRef: intent.genesisRef, genesisHash: intent.genesisHash,
        source: profile.source, profileHash: profile.profileHash, lockIdentity: intent.lockIdentity,
        child: { ...observedChild, ...processGroup }, startupFiles: ownership, maximumClaimCount: 1 };
      const claimHash = sha256(canonical(body));
      const record = freezeColdDataV1({ ...body, claimRef: `setfarm://internal-production/cold-spawner-bootstrap-claim/sha256/${claimHash}`, claimHash });
      const bytes = Buffer.from(`${canonical(record)}\n`);
      if (bytes.length > 65_536) fail("cold child claim exceeds its cap");
      parseColdSpawnerBootstrapClaimV1(bytes, intent, dispatch);
      if (canonical(main.observeInternalProductionColdSpawnerStartupOwnershipV1()) !== canonical(ownership)) fail("cold child startup ownership changed");
      assertOriginalStable();
      const target = path.join(root, "claim.json"), writer = openSync(target, constants.O_CREAT | constants.O_EXCL | constants.O_RDWR | constants.O_NOFOLLOW, 0o600);
      descriptors.push(writer);
      const created = fstatSync(writer, { bigint: true });
      if (!created.isFile() || created.nlink !== 1n || created.uid !== BigInt(uid) || created.size !== 0n || (created.mode & 0o7777n) !== 0o600n
        || !sameColdFileMetadataV1(created, lstatSync(target, { bigint: true }))) fail("cold child claim creation changed");
      writeFileSync(writer, bytes); fsyncSync(writer); fsyncParent(target);
      const written = fstatSync(writer, { bigint: true });
      if (written.dev !== created.dev || written.ino !== created.ino || written.uid !== created.uid || written.gid !== created.gid
        || written.mode !== created.mode || written.birthtimeNs !== created.birthtimeNs || written.size !== BigInt(bytes.length)
        || !bytes.equals(readColdGenesisCandidateV1(target, written))) fail("cold child claim publication changed");
      const reader = openSync(target, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
      descriptors.push(reader);
      if (!sameColdFileMetadataV1(written, fstatSync(reader, { bigint: true }))) fail("cold child claim reopen changed");
      closeSync(writer); descriptors.splice(descriptors.indexOf(writer), 1);
      if (canonical(main.observeInternalProductionColdSpawnerStartupOwnershipV1()) !== canonical(ownership)) fail("cold child startup ownership changed");
      claim = { record, rootStats: lstatSync(root, { bigint: true }), stats: written, bytes, descriptor: reader, observeStartupOwnership: main.observeInternalProductionColdSpawnerStartupOwnershipV1 };
      assertOutputStable();
      return Object.freeze({ record, identity: coldFileIdentityTupleV1(written), journalIdentity: coldFileIdentityTupleV1(claim.rootStats) });
    };
    return Object.freeze({ intent, dispatch, environment: freezeColdDataV1(environment) as Readonly<Record<string, string>>, assertStable: assertOutputStable, consumePidResidue, publishClaim, close });
  } catch {
    try { close(); } catch { pendingColdHelperAuthenticationCleanupV1.add(close); try { close(); } catch { /* Retain unfinished pins without authenticating again. */ } }
    return fail("cold child authentication failed");
  }
}

function revokeColdSpawnerChildRuntimeV1(): void {
  coldChildAuthenticationFailedV1 = true;
  const authentication = coldChildAuthenticationV1;
  if (!authentication) return;
  const close = () => {
    authentication.close();
    if (coldChildAuthenticationV1 === authentication) coldChildAuthenticationV1 = null;
    pendingColdHelperAuthenticationCleanupV1.delete(close);
  };
  try { close(); } catch { pendingColdHelperAuthenticationCleanupV1.add(close); try { close(); } catch { /* Retain cleanup, never the grant. */ } }
}

export async function consumeInternalProductionColdSpawnerPidResidueV1(): Promise<void> {
  if (coldChildAuthenticationFailedV1 || coldChildAuthenticationV1 === null) fail("cold child PID residue authentication is unavailable");
  try { await coldChildAuthenticationV1.consumePidResidue(); }
  catch { revokeColdSpawnerChildRuntimeV1(); fail("cold child PID residue consumption is uncertain"); }
}

export async function publishInternalProductionColdSpawnerBootstrapClaimV1() {
  if (coldChildAuthenticationFailedV1 || coldChildAuthenticationV1 === null) fail("cold child claim authentication is unavailable");
  try {
    const published = await coldChildAuthenticationV1.publishClaim();
    return Object.freeze({ claimRef: published.record.claimRef as string, claimHash: published.record.claimHash as string, claimIdentity: published.identity, journalIdentity: published.journalIdentity, close: revokeColdSpawnerChildRuntimeV1 });
  } catch { revokeColdSpawnerChildRuntimeV1(); return fail("cold child claim publication is uncertain"); }
}

export function resolveInternalProductionColdSpawnerChildRuntimeSnapshotV1() {
  if (coldChildAuthenticationFailedV1) {
    for (const pending of pendingColdHelperAuthenticationCleanupV1) pending();
    fail("cold child authentication is revoked");
  }
  if (coldChildAuthenticationV1 === null) {
    if (process.argv[1] !== path.join(repositoryRoot(), "dist/spawner.js")) return null;
    try { if (!fstatSync(3).isFile()) return null; }
    catch (error) { if (error && typeof error === "object" && "code" in error && error.code === "EBADF") return null; throw error; }
    try { coldChildAuthenticationV1 = authenticateColdSpawnerChildCapabilityV1(); }
    catch { coldChildAuthenticationFailedV1 = true; return fail("cold child authentication failed"); }
  }
  try { coldChildAuthenticationV1.assertStable(); }
  catch {
    revokeColdSpawnerChildRuntimeV1();
    return fail("cold child authentication is revoked");
  }
  const snapshot = { schema: "setfarm.internal-production-cold-child-runtime-snapshot.v1" };
  Object.defineProperty(snapshot, "environment", { value: coldChildAuthenticationV1.environment, enumerable: false });
  Object.defineProperty(snapshot, "close", { value: revokeColdSpawnerChildRuntimeV1, enumerable: false });
  return Object.freeze(snapshot) as typeof snapshot & Readonly<{ environment: Readonly<Record<string, string>>; close: () => void }>;
}

// Immutable history only. Physical readers must still retain and compare every
// original file descriptor/identity; the helper row is not live process authority.
function parseDirectSpawnerSpawnDispatchV1(
  bytes: Buffer, intent: Readonly<Record<string, unknown>>, terminationDispatchBytes: Buffer, terminationReceiptBytes: Buffer,
) {
  if (bytes.length < 1 || bytes.length > 65_536) fail("direct spawn dispatch size is invalid");
  const history = parseDirectSpawnerTerminationRecordsV1(terminationDispatchBytes, terminationReceiptBytes, intent);
  const dispatch = coldRecordV1(JSON.parse(bytes.toString("utf8")), ["schema", "purpose", "intentRef", "intentHash", "intentIdentity", "terminationReceiptRef", "terminationReceiptHash", "terminationReceiptIdentity", "terminationDispatchIdentity", "controller", "helper", "lockIdentity", "action", "maximumSpawnDispatchCount", "dispatchRef", "dispatchHash"], "direct spawn dispatch");
  if (!bytes.equals(Buffer.from(`${canonical(dispatch)}\n`)) || dispatch.schema !== "setfarm.internal-production-pre-schema-spawner-direct-spawn-dispatch.v1"
    || dispatch.purpose !== "operation-bound-pre-schema-spawner-rebind-v1" || dispatch.maximumSpawnDispatchCount !== 1
    || dispatch.dispatchRef !== `setfarm://internal-production/pre-schema-spawner-direct-spawn-dispatch/sha256/${coldHashV1(dispatch.dispatchHash, "direct spawn dispatch")}`) fail("direct spawn dispatch binding is crossed");
  coldSelfHashV1(dispatch, "dispatchHash", ["dispatchRef"]);
  const profile = intent.launchProfile as Record<string, any>, lock = intent.transitionLock as Record<string, unknown>;
  if (dispatch.intentRef !== intent.intentRef || dispatch.intentHash !== intent.intentHash
    || canonical(dispatch.intentIdentity) !== canonical(history.dispatch.intentIdentity)
    || dispatch.terminationReceiptRef !== history.receipt.terminationReceiptRef || dispatch.terminationReceiptHash !== history.receipt.terminationReceiptHash
    || canonical(dispatch.controller) !== canonical(history.dispatch.controller) || canonical(dispatch.lockIdentity) !== canonical(intent.lockIdentity)
    || canonical(dispatch.action) !== canonical({ transport: "direct-detached-node-v1", executable: profile.executable.path, arguments: [path.join(profile.repository, "dist/spawner.js")], cwd: profile.cwd, detached: true })) fail("direct spawn dispatch original history is crossed");
  const intentIdentity = history.dispatch.intentIdentity as string[];
  for (const [key, originalBytes] of [["terminationDispatchIdentity", terminationDispatchBytes], ["terminationReceiptIdentity", terminationReceiptBytes]] as const) {
    const identity = dispatch[key];
    if (!Array.isArray(identity) || identity.length !== 10 || identity.some(value => typeof value !== "string" || !/^(?:0|[1-9][0-9]{0,29})$/.test(value))
      || identity[0] !== intentIdentity[0] || BigInt(identity[1]) < 1n || identity[2] !== String(profile.uid)
      || identity[4] !== String(constants.S_IFREG | 0o600) || identity[5] !== "1" || identity[6] !== String(originalBytes.length)) fail("direct spawn dispatch termination identity is crossed");
  }
  const publications = [intentIdentity, dispatch.terminationDispatchIdentity as string[], dispatch.terminationReceiptIdentity as string[]];
  if (new Set(publications.map(identity => `${identity[0]}:${identity[1]}`)).size !== 3) fail("direct spawn dispatch publication identities overlap");
  const helper = coldRecordV1(dispatch.helper, ["pid", "processStartTimeEpochMs", "lstart", "command", "processIdentityHash", "uid", "ppid"], "direct spawn helper");
  if (!Number.isSafeInteger(helper.pid) || (helper.pid as number) < 1 || (helper.pid as number) > 2_147_483_647 || helper.pid === lock.pid
    || helper.uid !== profile.uid || helper.ppid !== lock.pid || typeof helper.lstart !== "string" || helper.lstart.length !== 24
    || !Number.isSafeInteger(helper.processStartTimeEpochMs) || (helper.processStartTimeEpochMs as number) < 1 || Date.parse(helper.lstart) !== helper.processStartTimeEpochMs
    || helper.command !== `${profile.executable.path} ${path.join(profile.repository, "dist/internal-production/baseline-service-restart-helper-v1.js")}`
    || helper.processIdentityHash !== sha256(canonical({ schema: "setfarm.internal-production-transition-lock-owner-process-identity.v1", pid: helper.pid, processStartTimeEpochMs: helper.processStartTimeEpochMs, lstart: helper.lstart, command: helper.command }))) fail("direct spawn helper identity is crossed");
  return freezeColdDataV1(dispatch);
}

function parseDirectSpawnerClaimV1(bytes: Buffer, intent: Readonly<Record<string, unknown>>, dispatch: Readonly<Record<string, unknown>>) {
  if (bytes.length < 1 || bytes.length > 65_536) fail("direct claim size is invalid");
  const claim = coldRecordV1(JSON.parse(bytes.toString("utf8")), ["schema", "purpose", "intentRef", "intentHash", "dispatchRef", "dispatchHash", "currentEntryOperation", "startupToken", "epoch", "source", "profileHash", "lockIdentity", "child", "startupFiles", "maximumClaimCount", "claimRef", "claimHash"], "direct claim");
  if (!bytes.equals(Buffer.from(`${canonical(claim)}\n`)) || claim.schema !== "setfarm.internal-production-pre-schema-spawner-direct-claim.v1"
    || claim.purpose !== "operation-bound-pre-schema-spawner-rebind-v1" || claim.maximumClaimCount !== 1
    || claim.claimRef !== `setfarm://internal-production/pre-schema-spawner-direct-claim/sha256/${coldHashV1(claim.claimHash, "direct claim")}`) fail("direct claim binding is crossed");
  coldSelfHashV1(claim, "claimHash", ["claimRef"]);
  for (const key of ["intentRef", "intentHash", "currentEntryOperation", "startupToken", "epoch", "lockIdentity"]) {
    if (canonical(claim[key]) !== canonical(intent[key])) fail("direct claim original intent is crossed");
  }
  const profile = intent.launchProfile as Record<string, any>, helper = dispatch.helper as Record<string, unknown>, lock = intent.transitionLock as Record<string, unknown>;
  if (claim.dispatchRef !== dispatch.dispatchRef || claim.dispatchHash !== dispatch.dispatchHash
    || claim.profileHash !== profile.profileHash || canonical(claim.source) !== canonical(profile.source)) fail("direct claim original dispatch is crossed");
  const child = coldRecordV1(claim.child, ["pid", "processStartTimeEpochMs", "lstart", "command", "processIdentityHash", "uid", "ppid", "pgid"], "direct claim child");
  if (!Number.isSafeInteger(child.pid) || (child.pid as number) < 1 || (child.pid as number) > 2_147_483_647 || child.pid === helper.pid || child.pid === lock.pid
    || child.uid !== profile.uid || child.ppid !== helper.pid || child.pgid !== child.pid
    || !Number.isSafeInteger(child.processStartTimeEpochMs) || (child.processStartTimeEpochMs as number) < 1
    || typeof child.lstart !== "string" || child.lstart.length !== 24 || Date.parse(child.lstart) !== child.processStartTimeEpochMs
    || child.command !== `${profile.executable.path} ${path.join(profile.repository, "dist/spawner.js")}`
    || child.processIdentityHash !== sha256(canonical({ schema: "setfarm.internal-production-transition-lock-owner-process-identity.v1", pid: child.pid,
      processStartTimeEpochMs: child.processStartTimeEpochMs, lstart: child.lstart, command: child.command }))) fail("direct claim child identity is crossed");
  const ownership = coldRecordV1(claim.startupFiles, ["schema", "pid", "uid", "singleton", "pidFile"], "direct claim startup ownership");
  if (ownership.schema !== "setfarm.internal-production-direct-spawner-startup-ownership.v1" || ownership.pid !== child.pid || ownership.uid !== child.uid) fail("direct claim startup owner is crossed");
  const runtime = path.join(profile.home, ".openclaw/setfarm");
  for (const [key, name, expected] of [["singleton", "spawner.lock", `${child.pid}\n`], ["pidFile", "spawner.pid", String(child.pid)]]) {
    const file = coldRecordV1(ownership[key!], ["path", "devDecimal", "inoDecimal", "uid", "mode", "byteLength", "bytesHash", "identityHash"], "direct claim startup file");
    coldHashV1(file.identityHash, "direct claim startup identity");
    if (file.path !== path.join(runtime, name!) || file.uid !== child.uid || file.mode !== 0o600 || file.byteLength !== Buffer.byteLength(expected!) || file.bytesHash !== sha256(expected!)
      || typeof file.devDecimal !== "string" || !/^(?:0|[1-9][0-9]{0,19})$/.test(file.devDecimal)
      || typeof file.inoDecimal !== "string" || !/^[1-9][0-9]{0,19}$/.test(file.inoDecimal)) fail("direct claim startup file is crossed");
  }
  return freezeColdDataV1(claim);
}

async function authenticateDirectSpawnerHelperIntentV1() {
  const guards: PrivateDirectoryGuardV1[] = [];
  const pins: Array<{ descriptor: number | null; identity: BigIntStats | null; target: string; bytes: Buffer | null; closeEntered: boolean }> = [];
  const publicationPins: typeof pins = [];
  let nodePin: typeof pins[number] | null = null;
  let closing = false;
  const closePin = (pin: typeof pins[number]) => {
    if (pin.descriptor === null) return;
    let current: BigIntStats;
    try { current = fstatSync(pin.descriptor, { bigint: true }); }
    catch (error) { if (error instanceof Error && "code" in error && error.code === "EBADF") { pin.descriptor = null; return; } throw error; }
    if (pin.identity === null) fail("direct helper reader identity is unavailable");
    if (["dev", "ino", "uid", "gid", "mode", "birthtimeNs"].some(key => current[key as keyof BigIntStats] !== pin.identity![key as keyof BigIntStats])) {
      pin.descriptor = null; fail("direct helper reader descriptor was reused");
    }
    if (pin.closeEntered) fail("direct helper reader close outcome is ambiguous");
    pin.closeEntered = true; closeSync(pin.descriptor); pin.descriptor = null;
  };
  const close = () => {
    closing = true;
    let failure: unknown = null;
    for (const pin of [...publicationPins, ...pins]) try { closePin(pin); } catch (error) { failure ??= error; }
    for (let index = guards.length - 1; index >= 0; index--) {
      try { guards[index]!.close(); guards.splice(index, 1); } catch (error) { failure ??= error; }
    }
    if (failure !== null) throw failure;
    pendingColdHelperAuthenticationCleanupV1.delete(close);
  };
  try {
    for (const pending of pendingColdHelperAuthenticationCleanupV1) pending();
    const repository = repositoryRoot(), entry = path.join(repository, "dist/internal-production/baseline-service-restart-helper-v1.js");
    if (process.execArgv.length !== 0 || process.argv.length !== 2 || process.argv[1] !== entry
      || fileURLToPath(import.meta.url) !== path.join(repository, "dist/internal-production/baseline-restart-authority-retirement-v1.js")) fail("direct helper compiled entry is crossed");
    const frameIdentity = fstatSync(3, { bigint: true }), frameBytes = readInternalProductionSpawnerUntrustedInheritedFrameV1();
    const frame = coldRecordV1(JSON.parse(frameBytes.toString("utf8")), ["schema", "intentRef", "intentHash", "intentIdentity", "terminationDispatchRef", "terminationDispatchHash", "terminationDispatchIdentity", "terminationReceiptRef", "terminationReceiptHash", "terminationReceiptIdentity", "lockIdentity", "environment", "nonce"], "direct helper frame");
    if (!frameBytes.equals(Buffer.from(`${canonical(frame)}\n`)) || frame.schema !== "setfarm.internal-production-pre-schema-spawner-direct-rebind-helper-capability.v1"
      || typeof frame.nonce !== "string" || !SHA256.test(frame.nonce) || !sameColdFileMetadataV1(frameIdentity, fstatSync(3, { bigint: true }))) fail("direct helper private frame is crossed");
    const paths = rootPaths(), root = path.join(paths.root, "direct-spawner-rebind-v1");
    guards.push(authenticatePrivateDirectoryChainV1(resolveInternalProductionBaselineWorkspaceRootV1(), root));
    const rootIdentity = lstatSync(root, { bigint: true });
    const inherited = (descriptor: number, target: string, maximum: number) => {
      const identity = fstatSync(descriptor, { bigint: true });
      if (identity.size > BigInt(maximum) || !sameColdFileMetadataV1(identity, lstatSync(target, { bigint: true }))) fail("direct helper inherited identity is crossed");
      const bytes = readColdGenesisCandidateV1(target, identity);
      if (!sameColdFileMetadataV1(identity, fstatSync(descriptor, { bigint: true }))) fail("direct helper inherited identity changed");
      return { identity, bytes };
    };
    const lockFile = inherited(4, paths.lock, 65_536), intentFile = inherited(5, paths.journal, 1_048_576);
    const lock = parseLockRecord(lockFile.bytes), intent = parseDirectSpawnerRebindIntentV1(intentFile.bytes);
    if (canonical(lock) !== canonical(intent.transitionLock) || canonical(frame.lockIdentity) !== canonical(intent.lockIdentity)
      || canonical(frame.lockIdentity) !== canonical(descriptorIdentity(4)) || canonical(frame.intentIdentity) !== canonical(coldFileIdentityTupleV1(intentFile.identity))
      || frame.intentRef !== intent.intentRef || frame.intentHash !== intent.intentHash || sha256(frame.nonce) !== intent.nonceHash) fail("direct helper inherited intent binding is crossed");
    const readPinned = (target: string, expected: unknown, maximum: number) => {
      const pin = { descriptor: openSync(target, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK) as number | null, identity: null as BigIntStats | null, target, bytes: null as Buffer | null, closeEntered: false };
      pins.push(pin); pin.identity = fstatSync(pin.descriptor!, { bigint: true });
      if (pin.identity.size > BigInt(maximum) || (expected !== undefined && canonical(coldFileIdentityTupleV1(pin.identity)) !== canonical(expected))) fail("direct helper original publication identity is crossed");
      pin.bytes = readColdGenesisCandidateV1(target, pin.identity);
      if (!sameColdFileMetadataV1(pin.identity, fstatSync(pin.descriptor!, { bigint: true }))) fail("direct helper original reader changed");
      return pin.bytes;
    };
    const dispatchBytes = readPinned(path.join(root, "termination-dispatch.json"), frame.terminationDispatchIdentity, 65_536);
    const receiptBytes = readPinned(path.join(root, "termination-receipt.json"), frame.terminationReceiptIdentity, 65_536);
    const epochBytes = readPinned(paths.epoch, undefined, 65_536), epoch = assertEpochOneActive();
    if (!epochBytes.equals(Buffer.from(`${canonical(epoch)}\n`)) || (intent.epoch as Record<string, unknown>).epochRef !== epoch.epochRef
      || (intent.epoch as Record<string, unknown>).epochHash !== epoch.epochHash) fail("direct helper original epoch is crossed");
    let dispatchStarted = false, childHandedOff = false, claimObservationStarted = false;
    let spawnDispatch: { record: Readonly<Record<string, any>>; rootIdentity: BigIntStats; reader: typeof pins[number]; frameReader: typeof pins[number] } | null = null;
    let childClaim: { record: Readonly<Record<string, any>>; rootIdentity: BigIntStats; reader: typeof pins[number]; assertLive: () => void } | null = null;
    const startupDirectories = new Map<string, BigIntStats>();
    const assertOriginalStable = () => {
      if (closing) fail("direct helper authentication is closed");
      for (const [target, original] of startupDirectories) {
        const current = lstatSync(target, { bigint: true });
        if (!current.isDirectory() || current.isSymbolicLink()
          || ["dev", "ino", "uid", "gid", "mode", "birthtimeNs"].some(key => current[key as keyof BigIntStats] !== original[key as keyof BigIntStats])) fail("direct helper original startup directory changed");
      }
      for (const guard of guards) guard.assertStable();
      if (process.argv.length !== 2 || process.execArgv.length !== 0 || process.argv[1] !== entry || process.cwd() !== repository
        || ["dev", "ino", "uid", "gid", "mode", "birthtimeNs"].some(key => rootIdentity[key as keyof BigIntStats] !== lstatSync(root, { bigint: true })[key as keyof BigIntStats])) fail("direct helper entry or root identity changed");
      for (const [descriptor, target, original, maximum] of [[4, paths.lock, lockFile, 65_536], [5, paths.journal, intentFile, 1_048_576]] as const) {
        const current = inherited(descriptor, target, maximum);
        if (!sameColdFileMetadataV1(original.identity, current.identity) || !original.bytes.equals(current.bytes)) fail("direct helper original inherited authority changed");
      }
      for (const pin of pins) if (pin.descriptor === null || pin.identity === null || !sameColdFileMetadataV1(pin.identity, fstatSync(pin.descriptor, { bigint: true }))
        || (pin === nodePin ? !sameColdFileMetadataV1(pin.identity, lstatSync(pin.target, { bigint: true })) : !pin.bytes!.equals(readColdGenesisCandidateV1(pin.target, pin.identity)))) fail("direct helper original publication changed");
      if (!sameColdFileMetadataV1(frameIdentity, fstatSync(3, { bigint: true })) || !frameBytes.equals(readInternalProductionSpawnerUntrustedInheritedFrameV1())) fail("direct helper original private frame changed");
      const parent = boundedPsProcessIdentity(lock.pid as number);
      const parentOwner = observeColdProcessParentGroupV1(lock.pid as number);
      if (process.ppid !== lock.pid || !parent || parentOwner.uid !== process.getuid!() || parent.processStartTimeEpochMs !== lock.processStartTimeEpochMs || parent.processIdentityHash !== lock.processIdentityHash) fail("direct helper controller parent is crossed");
      for (const guard of guards) guard.assertStable();
    };
    const assertFrame = (pin: typeof pins[number]) => {
      if (pin.descriptor === null || pin.identity === null || pin.bytes === null || !sameColdFileMetadataV1(pin.identity, fstatSync(pin.descriptor, { bigint: true }))) fail("direct child original frame identity changed");
      const bytes = Buffer.alloc(pin.bytes.length);
      for (let offset = 0; offset < bytes.length;) {
        const count = readSync(pin.descriptor, bytes, offset, Math.min(65_536, bytes.length - offset), offset);
        if (count < 1) fail("direct child frame read is partial");
        offset += count;
      }
      if (!bytes.equals(pin.bytes) || readSync(pin.descriptor, Buffer.alloc(1), 0, 1, bytes.length) !== 0
        || !sameColdFileMetadataV1(pin.identity, fstatSync(pin.descriptor, { bigint: true }))) fail("direct child original frame bytes changed");
    };
    const assertDispatchStable = () => {
      if (spawnDispatch) {
        const pin = spawnDispatch.reader;
        if (pin.descriptor === null || pin.identity === null || !sameColdFileMetadataV1(pin.identity, fstatSync(pin.descriptor, { bigint: true }))
          || !pin.bytes!.equals(readColdGenesisCandidateV1(pin.target, pin.identity))) fail("direct helper original spawn dispatch changed");
        assertFrame(spawnDispatch.frameReader);
      }
    };
    const assertStable = () => {
      assertOriginalStable();
      if (dispatchStarted && spawnDispatch === null) fail("direct helper spawn publication is uncertain");
      if (claimObservationStarted && childClaim === null) fail("direct helper claim observation is uncertain");
      const expected = childClaim?.rootIdentity ?? spawnDispatch?.rootIdentity ?? rootIdentity;
      if (!sameColdFileMetadataV1(expected, lstatSync(root, { bigint: true }))
        || canonical(readColdDirectoryMembersV1(root, childClaim ? 4 : spawnDispatch ? 3 : 2).sort()) !== canonical([
          ...(childClaim ? ["claim.json"] : []), ...(spawnDispatch ? ["spawn-dispatch.json"] : []), "termination-dispatch.json", "termination-receipt.json"])) fail("direct helper journal prefix changed");
      assertDispatchStable();
      if (childClaim) {
        const pin = childClaim.reader;
        if (pin.descriptor === null || pin.identity === null || !sameColdFileMetadataV1(pin.identity, fstatSync(pin.descriptor, { bigint: true }))
          || !pin.bytes!.equals(readColdGenesisCandidateV1(pin.target, pin.identity))) fail("direct helper original child claim changed");
        childClaim.assertLive();
      }
      assertOriginalStable();
      if (!sameColdFileMetadataV1(expected, lstatSync(root, { bigint: true }))) fail("direct helper journal changed across validation");
    };
    assertStable();
    const evidence = await resolveDirectSpawnerRebindEvidenceV1({ currentEntryOperation: intent.currentEntryOperation, restartAuthority: intent.restartAuthority } as Parameters<typeof resolveDirectSpawnerRebindEvidenceV1>[0], epoch, assertStable);
    assertStable();
    const history = parseDirectSpawnerTerminationChainV1(dispatchBytes, receiptBytes, intent, evidence.preMutation);
    if (history.dispatch.dispatchRef !== frame.terminationDispatchRef || history.dispatch.dispatchHash !== frame.terminationDispatchHash
      || history.receipt.terminationReceiptRef !== frame.terminationReceiptRef || history.receipt.terminationReceiptHash !== frame.terminationReceiptHash
      || canonical(history.dispatch.intentIdentity) !== canonical(frame.intentIdentity) || canonical(evidence.profile) !== canonical(intent.launchProfile)
      || canonical(evidence.environment) !== canonical(frame.environment) || evidence.profile.repository !== repository || evidence.profile.cwd !== process.cwd()
      || (evidence.profile.executable as Record<string, unknown>).path !== process.execPath
      || canonical(intent.startupToken) !== canonical({ startupTokenRef: evidence.startup.startupTokenRef, startupTokenHash: evidence.startup.startupTokenHash })) fail("direct helper authenticated evidence is crossed");
    if (observeDirectSpawnerTerminationTargetV1((evidence.preMutation.spawner as Record<string, any>).pid) !== null) fail("direct helper original predecessor is present");
    assertStable();
    const profile = evidence.profile as Record<string, any>;
    const metadata = (stats: BigIntStats) => ({ devDecimal: String(stats.dev), inoDecimal: String(stats.ino), uid: Number(stats.uid), gid: Number(stats.gid), mode: Number(stats.mode & 0o7777n) });
    const hostDirectories = new Map<string, BigIntStats>();
    for (const directory of profile.hostDirectories as Array<Record<string, any>>) {
      const stats = lstatSync(directory.path, { bigint: true }), { path: target, ...expected } = directory;
      if (!stats.isDirectory() || stats.isSymbolicLink() || canonical(metadata(stats)) !== canonical(expected)) fail("direct helper physical host identity is crossed");
      hostDirectories.set(target, stats);
    }
    nodePin = { descriptor: openSync(process.execPath, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK), identity: null, target: process.execPath, bytes: null, closeEntered: false };
    pins.push(nodePin); nodePin.identity = fstatSync(nodePin.descriptor!, { bigint: true });
    const { path: nodePath, bytesHash, ...nodeExpected } = profile.executable, nodeStats = nodePin.identity;
    if (nodePath !== process.execPath || !nodeStats.isFile() || nodeStats.isSymbolicLink() || nodeStats.nlink !== 1n || nodeStats.size < 1n || nodeStats.size > 268_435_456n
      || canonical(metadata(nodeStats)) !== canonical(nodeExpected) || !sameColdFileMetadataV1(nodeStats, lstatSync(process.execPath, { bigint: true }))) fail("direct helper physical Node identity is crossed");
    const nodeHash = createHash("sha256"), buffer = Buffer.alloc(65_536);
    let offset = 0;
    while (offset < Number(nodeStats.size)) {
      const count = readSync(nodePin.descriptor!, buffer, 0, Math.min(buffer.length, Number(nodeStats.size) - offset), offset);
      if (count < 1) fail("direct helper Node read is partial");
      nodeHash.update(buffer.subarray(0, count)); offset += count;
    }
    if (nodeHash.digest("hex") !== bytesHash || readSync(nodePin.descriptor!, buffer, 0, 1, offset) !== 0) fail("direct helper Node bytes are crossed");
    const assertPhysicalRuntimeStable = () => {
      assertOriginalStable();
      for (const [target, original] of hostDirectories) {
        const current = lstatSync(target, { bigint: true });
        if (!current.isDirectory() || current.isSymbolicLink() || canonical(metadata(current)) !== canonical(metadata(original))) fail("direct helper physical host identity changed");
      }
      verifyInternalProductionSpawnerLaunchOutputCandidateV1({ rootIdentity: { devDecimal: profile.rootIdentity.devDecimal, inoDecimal: profile.rootIdentity.inoDecimal, uid: profile.uid },
        sourceSha: profile.source.sha, sourceTreeHash: profile.source.treeHash, buildInfoBytesHash: profile.buildInfoBytesHash,
        outputTreeBytesHash: profile.outputTreeBytesHash, releaseManifestBytesHash: profile.releaseManifestBytesHash });
      assertOriginalStable();
    };
    const assertRuntimeStable = () => { assertStable(); assertPhysicalRuntimeStable(); assertStable(); };
    assertRuntimeStable();
    const publishDispatch = () => {
      assertRuntimeStable();
      if (dispatchStarted) fail("direct helper spawn dispatch was already attempted");
      const helper = boundedPsProcessIdentity(process.pid), helperOwner = observeColdProcessParentGroupV1(process.pid);
      if (!helper || helperOwner.uid !== profile.uid || helperOwner.ppid !== lock.pid) fail("direct helper original process identity is crossed");
      if (observeDirectSpawnerTerminationTargetV1((evidence.preMutation.spawner as Record<string, any>).pid) !== null) fail("direct helper predecessor returned before dispatch");
      const body = { schema: "setfarm.internal-production-pre-schema-spawner-direct-spawn-dispatch.v1", purpose: "operation-bound-pre-schema-spawner-rebind-v1",
        intentRef: intent.intentRef, intentHash: intent.intentHash, intentIdentity: frame.intentIdentity,
        terminationReceiptRef: history.receipt.terminationReceiptRef, terminationReceiptHash: history.receipt.terminationReceiptHash,
        terminationReceiptIdentity: frame.terminationReceiptIdentity, terminationDispatchIdentity: frame.terminationDispatchIdentity,
        controller: history.dispatch.controller, helper: { ...helper, uid: helperOwner.uid, ppid: helperOwner.ppid }, lockIdentity: intent.lockIdentity,
        action: { transport: "direct-detached-node-v1", executable: profile.executable.path, arguments: [path.join(repository, "dist/spawner.js")], cwd: profile.cwd, detached: true }, maximumSpawnDispatchCount: 1 };
      const dispatchHash = sha256(canonical(body));
      const record = freezeColdDataV1({ ...body, dispatchRef: `setfarm://internal-production/pre-schema-spawner-direct-spawn-dispatch/sha256/${dispatchHash}`, dispatchHash });
      const bytes = Buffer.from(`${canonical(record)}\n`);
      if (bytes.length > 65_536) fail("direct helper spawn dispatch exceeds its cap");
      const target = path.join(root, "spawn-dispatch.json");
      const openOwned = (target: string, flags: number) => {
        const pin = { descriptor: openSync(target, flags, 0o600) as number | null, identity: null as BigIntStats | null, target, bytes: null as Buffer | null, closeEntered: false };
        publicationPins.push(pin); pin.identity = fstatSync(pin.descriptor!, { bigint: true });
        return pin;
      };
      const assertMembers = (scratch?: string) => {
        assertOriginalStable();
        const names = ["spawn-dispatch.json", "termination-dispatch.json", "termination-receipt.json", ...(scratch ? [path.basename(scratch)] : [])].sort();
        if (canonical(readColdDirectoryMembersV1(root, names.length).sort()) !== canonical(names)) fail("direct helper publishing prefix is crossed");
      };
      assertRuntimeStable();
      // This durable attempt can never be adopted by another helper or retried
      // after any partial write, fsync, reopen or ambiguous close outcome.
      dispatchStarted = true;
      const writer = openOwned(target, constants.O_RDWR | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW);
      const created = writer.identity!;
      if (!created.isFile() || created.uid !== rootIdentity.uid || created.dev !== rootIdentity.dev || created.nlink !== 1n || created.size !== 0n
        || (created.mode & 0o7777n) !== 0o600n || !sameColdFileMetadataV1(created, lstatSync(target, { bigint: true }))) fail("direct helper spawn creation identity is crossed");
      assertMembers();
      // Direct spawn publication has its own fault boundary; never alias cold.
      writeFileSync(writer.descriptor!, bytes); fsyncSync(writer.descriptor!); fsyncParent(target);
      const written = fstatSync(writer.descriptor!, { bigint: true });
      if (["dev", "ino", "uid", "gid", "mode", "birthtimeNs"].some(key => created[key as keyof BigIntStats] !== written[key as keyof BigIntStats])
        || written.size !== BigInt(bytes.length) || !bytes.equals(readColdGenesisCandidateV1(target, written))) fail("direct helper spawn publication changed");
      const reader = openOwned(target, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
      reader.bytes = bytes;
      if (!sameColdFileMetadataV1(written, reader.identity!)) fail("direct helper original dispatch reopen changed");
      closePin(writer); assertMembers(); assertPhysicalRuntimeStable();
      const childFrame = { schema: "setfarm.internal-production-pre-schema-spawner-direct-rebind-child-capability.v1", dispatchRef: record.dispatchRef, dispatchHash,
        dispatchIdentity: coldFileIdentityTupleV1(written), lockIdentity: intent.lockIdentity, environment: evidence.environment, nonce: frame.nonce };
      const childBytes = Buffer.from(`${canonical(childFrame)}\n`);
      if (childBytes.length < 1 || childBytes.length > 1_048_576) fail("direct child frame exceeds its cap");
      const scratch = path.join(root, `.direct-child-capability.${randomBytes(16).toString("hex")}.tmp`);
      const frameWriter = openOwned(scratch, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW), empty = frameWriter.identity!;
      if (!empty.isFile() || empty.uid !== rootIdentity.uid || empty.dev !== rootIdentity.dev || empty.nlink !== 1n || empty.size !== 0n || (empty.mode & 0o7777n) !== 0o600n) fail("direct child empty frame identity is crossed");
      const frameReader = openOwned(scratch, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
      assertMembers(scratch);
      if (!sameColdFileMetadataV1(empty, frameReader.identity!) || !sameColdFileMetadataV1(empty, fstatSync(frameWriter.descriptor!, { bigint: true }))
        || !sameColdFileMetadataV1(empty, lstatSync(scratch, { bigint: true }))) fail("direct child empty frame changed before unlink");
      unlinkSync(scratch);
      const unlinked = assertOriginalEmptyUnlinkedFrameV1(frameWriter.descriptor!, frameReader.descriptor!, empty);
      // No later operation owns a directory mutation. Retain this one snapshot
      // before parent fsync, original-authority reads and final output checking.
      const finalRootIdentity = lstatSync(root, { bigint: true });
      fsyncParent(scratch); assertMembers();
      if (!sameColdFileMetadataV1(finalRootIdentity, lstatSync(root, { bigint: true }))) fail("direct child original journal changed before secret write");
      assertOriginalEmptyUnlinkedFrameV1(frameWriter.descriptor!, frameReader.descriptor!, unlinked);
      // Child secrets are first written after their empty pathname is removed.
      writeFileSync(frameWriter.descriptor!, childBytes); fsyncSync(frameWriter.descriptor!);
      const frameWritten = fstatSync(frameReader.descriptor!, { bigint: true });
      if (["dev", "ino", "uid", "gid", "mode", "birthtimeNs"].some(key => empty[key as keyof BigIntStats] !== frameWritten[key as keyof BigIntStats])
        || frameWritten.nlink !== 0n || frameWritten.size !== BigInt(childBytes.length)
        || !sameColdFileMetadataV1(frameWritten, fstatSync(frameWriter.descriptor!, { bigint: true }))) fail("direct child frame write identity changed");
      frameReader.identity = frameWritten; frameReader.bytes = childBytes;
      assertFrame(frameReader); closePin(frameWriter);
      assertMembers(); assertPhysicalRuntimeStable(); assertMembers(); assertFrame(frameReader);
      if (!sameColdFileMetadataV1(finalRootIdentity, lstatSync(root, { bigint: true }))) fail("direct helper final journal identity changed");
      spawnDispatch = { record, rootIdentity: finalRootIdentity, reader, frameReader };
      assertRuntimeStable();
      return record;
    };
    const childDescriptors = () => {
      assertRuntimeStable();
      if (!spawnDispatch || childHandedOff) fail("direct child dispatch is absent or consumed");
      childHandedOff = true;
      // Permission is consumed here; cleanup ownership stays with this helper.
      return Object.freeze({ frameDescriptor: spawnDispatch.frameReader.descriptor!, dispatchDescriptor: spawnDispatch.reader.descriptor! });
    };
    const prepareChildStartup = () => {
      assertRuntimeStable();
      if (dispatchStarted || startupDirectories.size !== 0) fail("direct helper startup directory pin was already attempted");
      for (const target of [path.join(profile.home, ".openclaw"), path.join(profile.home, ".openclaw/setfarm")]) {
        const stats = lstatSync(target, { bigint: true });
        if (!stats.isDirectory() || stats.isSymbolicLink() || stats.uid !== BigInt(profile.uid)) fail("direct helper startup directory is invalid");
        startupDirectories.set(target, stats);
      }
      assertRuntimeStable();
    };
    const observeChildClaim = (child: ChildProcess, readiness: Readonly<Record<string, unknown>>) => {
      if (!childHandedOff || !spawnDispatch || startupDirectories.size !== 2 || claimObservationStarted || !Number.isSafeInteger(child.pid)
        || child.exitCode !== null || child.signalCode !== null) fail("direct helper claim phase is unavailable");
      claimObservationStarted = true;
      const assertOriginal = () => { assertOriginalStable(); assertDispatchStable(); assertPhysicalRuntimeStable(); assertOriginalStable(); assertDispatchStable(); };
      const assertJournal = () => {
        assertOriginal();
        const current = lstatSync(root, { bigint: true });
        if (canonical(readiness.journalIdentity) !== canonical(coldFileIdentityTupleV1(current))
          || canonical(readColdDirectoryMembersV1(root, 4).sort()) !== canonical(["claim.json", "spawn-dispatch.json", "termination-dispatch.json", "termination-receipt.json"])) fail("direct helper claim journal differs from readiness");
        return current;
      };
      const rootStats = assertJournal(), target = path.join(root, "claim.json");
      const bytes = readPinned(target, readiness.claimIdentity, 65_536), reader = pins.at(-1)!;
      const record = parseDirectSpawnerClaimV1(bytes, intent, spawnDispatch.record);
      if (readiness.claimRef !== record.claimRef || readiness.claimHash !== record.claimHash) fail("direct helper claim pair differs from readiness");
      const claimedChild = record.child as Record<string, unknown>;
      if (claimedChild.pid !== child.pid) fail("direct helper claim belongs to another child");
      const assertChild = () => {
        if (child.exitCode !== null || child.signalCode !== null) fail("direct helper spawned child exited");
        const actual = boundedPsProcessIdentity(child.pid!), ownership = observeColdProcessParentGroupV1(child.pid!);
        if (!actual || canonical({ ...actual, ...ownership }) !== canonical(claimedChild) || ownership.ppid !== process.pid) fail("direct helper spawned child identity changed");
      };
      const assertStartup = () => {
        const files = record.startupFiles as Record<string, any>;
        for (const key of ["singleton", "pidFile"]) {
          const file = files[key], stats = lstatSync(file.path, { bigint: true });
          if (stats.size > 32n || String(stats.dev) !== file.devDecimal || String(stats.ino) !== file.inoDecimal || Number(stats.uid) !== file.uid || Number(stats.mode & 0o7777n) !== file.mode
            || file.identityHash !== sha256(canonical(coldFileIdentityTupleV1(stats))) || Number(stats.size) !== file.byteLength
            || sha256(readColdGenesisCandidateV1(file.path, stats)) !== file.bytesHash) fail("direct helper claimed startup file changed");
        }
      };
      assertChild(); assertStartup(); assertJournal(); assertChild(); assertStartup(); assertJournal();
      childClaim = { record, rootIdentity: rootStats, reader, assertLive: () => { assertChild(); assertStartup(); } };
      assertRuntimeStable(); assertChild(); assertStartup(); assertRuntimeStable();
      return freezeColdDataV1({ schema: "setfarm.internal-production-direct-spawner-helper-completion.v1",
        intentRef: intent.intentRef, intentHash: intent.intentHash, intentIdentity: coldFileIdentityTupleV1(intentFile.identity),
        dispatchRef: spawnDispatch.record.dispatchRef, dispatchHash: spawnDispatch.record.dispatchHash, dispatchIdentity: coldFileIdentityTupleV1(spawnDispatch.reader.identity!),
        claimRef: record.claimRef, claimHash: record.claimHash, claimIdentity: coldFileIdentityTupleV1(reader.identity!), journalIdentity: coldFileIdentityTupleV1(rootStats) });
    };
    return Object.freeze({ intent, history, environment: evidence.environment, assertStable: assertRuntimeStable, prepareChildStartup, publishDispatch, childDescriptors, observeChildClaim, close });
  } catch {
    try { close(); } catch { pendingColdHelperAuthenticationCleanupV1.add(close); }
    return fail("direct helper authentication failed");
  }
}

function revokeDirectSpawnerHelperRuntimeV1(): void {
  directHelperAuthenticationFailedV1 = true;
  const authentication = directHelperAuthenticationV1;
  if (authentication === null) return;
  const close = () => { authentication.close(); if (directHelperAuthenticationV1 === authentication) directHelperAuthenticationV1 = null; pendingColdHelperAuthenticationCleanupV1.delete(close); };
  try { close(); } catch { pendingColdHelperAuthenticationCleanupV1.add(close); }
}

function publishDirectSpawnerHelperSpawnDispatchV1() {
  if (directHelperAuthenticationFailedV1 || directHelperAuthenticationV1 === null || spawnerInheritedRuntimeRefusedV1) fail("direct helper spawn authority is unavailable");
  try { return directHelperAuthenticationV1.publishDispatch(); }
  catch { revokeDirectSpawnerHelperRuntimeV1(); return fail("direct helper spawn publication is revoked"); }
}

function takeDirectSpawnerChildLaunchDescriptorsV1() {
  if (directHelperAuthenticationFailedV1 || directHelperAuthenticationV1 === null || spawnerInheritedRuntimeRefusedV1) fail("direct child handoff authority is unavailable");
  try { return directHelperAuthenticationV1.childDescriptors(); }
  catch { revokeDirectSpawnerHelperRuntimeV1(); return fail("direct child handoff is revoked"); }
}

async function acquireDirectSpawnerHelperContextV1() {
  if (directHelperAuthenticationActiveV1 || directHelperAuthenticationFailedV1 || directHelperAuthenticationV1 !== null || spawnerInheritedRuntimeRefusedV1) fail("direct helper authentication is already attempted or revoked");
  directHelperAuthenticationActiveV1 = true;
  try {
    directHelperAuthenticationV1 = await authenticateDirectSpawnerHelperIntentV1();
    if (directHelperAuthenticationFailedV1 || spawnerInheritedRuntimeRefusedV1) fail("direct helper authentication was revoked while pending");
    directHelperAuthenticationV1.assertStable();
    return Object.freeze({ schema: "setfarm.internal-production-direct-helper-context.v1", close: revokeDirectSpawnerHelperRuntimeV1 });
  } catch { revokeDirectSpawnerHelperRuntimeV1(); return fail("direct helper context authentication failed"); }
  finally { directHelperAuthenticationActiveV1 = false; }
}

function resolveDirectSpawnerHelperRuntimeSnapshotV1() {
  if (directHelperAuthenticationFailedV1 || directHelperAuthenticationV1 === null) fail("direct inherited runtime capability is not authenticated");
  try { directHelperAuthenticationV1.assertStable(); }
  catch { revokeDirectSpawnerHelperRuntimeV1(); return fail("direct helper authentication is revoked"); }
  return Object.freeze({ environment: directHelperAuthenticationV1.environment });
}

export async function runInternalProductionDirectSpawnerHelperV1(): Promise<Readonly<Record<string, unknown>>> {
  if (directHelperTransportAttemptedV1) fail("direct helper transport was already attempted");
  directHelperTransportAttemptedV1 = true;
  let context: Awaited<ReturnType<typeof acquireDirectSpawnerHelperContextV1>> | undefined;
  let child: ChildProcess | undefined, readiness: Readable | undefined;
  let completion: Readonly<Record<string, unknown>> | null = null;
  let accepted = false, effectEntered = false, cleanupFailed = false;
  try {
    context = await acquireDirectSpawnerHelperContextV1();
    if (resolveInternalProductionSpawnerInheritedRuntimeSnapshotV1()?.role !== "direct-helper") fail("direct helper runtime role is crossed");
    const authentication = directHelperAuthenticationV1!;
    const profile = authentication.intent.launchProfile as Record<string, any>;
    authentication.prepareChildStartup();
    publishDirectSpawnerHelperSpawnDispatchV1();
    const handles = takeDirectSpawnerChildLaunchDescriptorsV1();
    authentication.assertStable();
    effectEntered = true;
    child = spawn(profile.executable.path, [path.join(profile.repository, "dist/spawner.js")], {
      cwd: profile.cwd, detached: true, shell: false,
      env: { PATH: "/usr/bin:/bin", LANG: "C", LC_ALL: "C", SETFARM_INTERNAL_PRODUCTION_DIRECT_CHILD: "1" },
      stdio: ["ignore", "ignore", "ignore", handles.frameDescriptor, 4, handles.dispatchDescriptor, "pipe"],
    });
    readiness = (child.stdio as readonly unknown[])[6] as Readable | undefined;
    if (!readiness || typeof readiness.on !== "function") fail("direct child readiness pipe is unavailable");
    const spawned = child, pipe = readiness;
    const envelope = await new Promise<Readonly<Record<string, unknown>>>((resolve, reject) => {
      let settled = false, count = 0;
      const chunks: Buffer[] = [];
      const finish = (error?: Error) => {
        if (settled) return;
        settled = true; clearTimeout(timer);
        pipe.removeListener("data", onData); pipe.removeListener("end", onEnd); pipe.removeListener("error", onError);
        spawned.removeListener("error", onError); spawned.removeListener("exit", onExit);
        if (error) { reject(error); return; }
        try {
          const bytes = Buffer.concat(chunks, count);
          const value = coldRecordV1(JSON.parse(bytes.toString("utf8")), ["schema", "claimRef", "claimHash", "claimIdentity", "journalIdentity"], "direct child readiness");
          if (value.schema !== "setfarm.internal-production-direct-spawner-readiness.v1" || !bytes.equals(Buffer.from(`${canonical(value)}\n`))) fail("direct child readiness is crossed");
          resolve(freezeColdDataV1(value));
        } catch { reject(Error("direct child readiness is malformed")); }
      };
      const onError = () => finish(Error("direct child readiness failed"));
      const onExit = () => finish(Error("direct child exited before readiness"));
      const onData = (bytes: Buffer) => {
        if (bytes.length < 1 || count + bytes.length > 4096) return finish(Error("direct child readiness exceeds its cap"));
        chunks.push(Buffer.from(bytes)); count += bytes.length;
      };
      const onEnd = () => finish(count > 0 ? undefined : Error("direct child readiness is absent"));
      const timer = setTimeout(() => finish(Error("direct child readiness timed out")), 30_000);
      pipe.on("data", onData); pipe.once("end", onEnd); pipe.once("error", onError);
      spawned.once("error", onError); spawned.once("exit", onExit);
    });
    // Only this retained one-shot ChildProcess may authenticate member four.
    // The regular context still rejects an unowned claim prefix.
    if (directHelperAuthenticationV1 !== authentication || directHelperAuthenticationFailedV1 || spawnerInheritedRuntimeRefusedV1) fail("direct helper claim authority was revoked");
    completion = authentication.observeChildClaim(child, envelope);
    authentication.assertStable(); accepted = true;
  } catch { /* Never retry an entered spawn or erase its durable dispatch. */ }
  finally {
    if (readiness) { readiness.on("error", () => {}); readiness.destroy(); }
    if (child) { child.on("error", () => {}); child.unref(); }
    if (context) context.close();
    for (const close of pendingColdHelperAuthenticationCleanupV1) {
      cleanupFailed = true;
      try { close(); } catch { /* Preserve exact unresolved cleanup ownership. */ }
    }
  }
  if (!effectEntered || !accepted || cleanupFailed || completion === null || Buffer.byteLength(`${canonical(completion)}\n`) > 4096) fail("direct helper transport is uncertain");
  return completion;
}

// Configuration authentication is synchronous: importing runtime-config must
// never invent an independent P3 observation or enter the startup lifecycle.
function authenticateDirectSpawnerChildCapabilityV1() {
  const guards: PrivateDirectoryGuardV1[] = [];
  type Pin = PrivateFrameDescriptorV1 & { target: string; bytes: Buffer | null };
  const pins: Pin[] = [];
  const claimPins: Pin[] = [];
  let closing = false;
  const close = () => {
    closing = true;
    let failure: unknown = null;
    for (const pin of [...claimPins, ...pins]) try { closePrivateFrameDescriptorV1(pin); } catch (error) { failure ??= error; }
    for (let index = guards.length - 1; index >= 0; index--) {
      try { guards[index]!.close(); guards.splice(index, 1); } catch (error) { failure ??= error; }
    }
    if (failure !== null) throw failure;
    pendingColdHelperAuthenticationCleanupV1.delete(close);
  };
  try {
    const repository = repositoryRoot(), entry = path.join(repository, "dist/spawner.js");
    if (process.execArgv.length !== 0 || process.argv.length !== 2 || process.argv[1] !== entry || process.cwd() !== repository
      || fileURLToPath(import.meta.url) !== path.join(repository, "dist/internal-production/baseline-restart-authority-retirement-v1.js")) fail("direct child compiled entry is crossed");
    const frameIdentity = fstatSync(3, { bigint: true }), frameBytes = readInternalProductionSpawnerUntrustedInheritedFrameV1();
    const frame = coldRecordV1(JSON.parse(frameBytes.toString("utf8")), ["schema", "dispatchRef", "dispatchHash", "dispatchIdentity", "lockIdentity", "environment", "nonce"], "direct child frame");
    if (frame.schema !== "setfarm.internal-production-pre-schema-spawner-direct-rebind-child-capability.v1"
      || !frameBytes.equals(Buffer.from(`${canonical(frame)}\n`)) || !sameColdFileMetadataV1(frameIdentity, fstatSync(3, { bigint: true }))) fail("direct child frame is crossed");
    coldHashV1(frame.nonce, "direct child nonce");
    const paths = rootPaths(), root = path.join(paths.root, "direct-spawner-rebind-v1");
    guards.push(authenticatePrivateDirectoryChainV1(resolveInternalProductionBaselineWorkspaceRootV1(), root));
    const rootIdentity = lstatSync(root, { bigint: true });
    const inherited = (descriptor: number, target: string, maximum: number) => {
      const identity = fstatSync(descriptor, { bigint: true });
      if (identity.size > BigInt(maximum) || !sameColdFileMetadataV1(identity, lstatSync(target, { bigint: true }))) fail("direct child inherited identity is crossed");
      const bytes = readColdGenesisCandidateV1(target, identity);
      if (!sameColdFileMetadataV1(identity, fstatSync(descriptor, { bigint: true }))) fail("direct child inherited identity changed");
      return { identity, bytes };
    };
    const lockFile = inherited(4, paths.lock, 65_536), dispatchFile = inherited(5, path.join(root, "spawn-dispatch.json"), 65_536);
    const lock = parseLockRecord(lockFile.bytes);
    const dispatch = coldRecordV1(JSON.parse(dispatchFile.bytes.toString("utf8")), ["schema", "purpose", "intentRef", "intentHash", "intentIdentity", "terminationReceiptRef", "terminationReceiptHash", "terminationReceiptIdentity", "terminationDispatchIdentity", "controller", "helper", "lockIdentity", "action", "maximumSpawnDispatchCount", "dispatchRef", "dispatchHash"], "direct child spawn dispatch");
    if (!dispatchFile.bytes.equals(Buffer.from(`${canonical(dispatch)}\n`)) || dispatch.schema !== "setfarm.internal-production-pre-schema-spawner-direct-spawn-dispatch.v1"
      || dispatch.purpose !== "operation-bound-pre-schema-spawner-rebind-v1" || dispatch.maximumSpawnDispatchCount !== 1
      || dispatch.dispatchRef !== `setfarm://internal-production/pre-schema-spawner-direct-spawn-dispatch/sha256/${coldHashV1(dispatch.dispatchHash, "direct child dispatch")}`
      || frame.dispatchRef !== dispatch.dispatchRef || frame.dispatchHash !== dispatch.dispatchHash
      || canonical(frame.dispatchIdentity) !== canonical(coldFileIdentityTupleV1(dispatchFile.identity))) fail("direct child dispatch binding is crossed");
    coldSelfHashV1(dispatch, "dispatchHash", ["dispatchRef"]);
    const readPinned = (target: string, expected: unknown, maximum: number) => {
      const pin: Pin = { descriptor: openSync(target, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK), identity: null, target, bytes: null, closeEntered: false };
      pins.push(pin); pin.identity = fstatSync(pin.descriptor!, { bigint: true });
      if (pin.identity.size > BigInt(maximum) || (expected !== undefined && canonical(coldFileIdentityTupleV1(pin.identity)) !== canonical(expected))) fail("direct child original publication identity is crossed");
      pin.bytes = readColdGenesisCandidateV1(target, pin.identity);
      if (!sameColdFileMetadataV1(pin.identity, fstatSync(pin.descriptor!, { bigint: true }))) fail("direct child original reader changed");
      return pin.bytes;
    };
    const intentBytes = readPinned(paths.journal, dispatch.intentIdentity, 1_048_576), intent = parseDirectSpawnerRebindIntentV1(intentBytes);
    const terminationDispatchBytes = readPinned(path.join(root, "termination-dispatch.json"), dispatch.terminationDispatchIdentity, 65_536);
    const terminationReceiptBytes = readPinned(path.join(root, "termination-receipt.json"), dispatch.terminationReceiptIdentity, 65_536);
    const history = parseDirectSpawnerTerminationRecordsV1(terminationDispatchBytes, terminationReceiptBytes, intent);
    parseDirectSpawnerSpawnDispatchV1(dispatchFile.bytes, intent, terminationDispatchBytes, terminationReceiptBytes);
    const epochBytes = readPinned(paths.epoch, undefined, 65_536), epoch = assertEpochOneActive();
    const profile = intent.launchProfile as Record<string, any>;
    if (!epochBytes.equals(Buffer.from(`${canonical(epoch)}\n`)) || (intent.epoch as Record<string, unknown>).epochRef !== epoch.epochRef
      || (intent.epoch as Record<string, unknown>).epochHash !== epoch.epochHash || canonical(lock) !== canonical(intent.transitionLock)
      || canonical(intent.lockIdentity) !== canonical(descriptorIdentity(4)) || canonical(frame.lockIdentity) !== canonical(intent.lockIdentity)
      || canonical(dispatch.lockIdentity) !== canonical(intent.lockIdentity) || sha256(frame.nonce as string) !== intent.nonceHash
      || profile.repository !== repository || profile.cwd !== process.cwd() || profile.executable.path !== process.execPath) fail("direct child original authority chain is crossed");
    const helper = dispatch.helper as Record<string, unknown>;
    if (helper.pid === process.pid) fail("direct child helper identity is crossed");
    const environment = frame.environment as Record<string, unknown>;
    if (!environment || typeof environment !== "object" || Array.isArray(environment) || Object.keys(environment).length > 1024
      || Buffer.byteLength(canonical(environment)) > 524_288) fail("direct child environment shape is invalid");
    for (const [key, value] of Object.entries(environment)) {
      if (!/^[A-Za-z_][A-Za-z0-9_]{0,127}$/.test(key) || typeof value !== "string" || value.includes("\0") || Buffer.byteLength(value) > 65_536
        || /^(?:NODE_|DYLD_|LD_|SETFARM_TEST_|SETFARM_INTERNAL_PRODUCTION_)/.test(key) || ["SETFARM_SKIP_RUNTIME_GUARD", "SETFARM_ALLOW_DIRTY_BUILD"].includes(key)) fail("direct child environment is invalid");
    }
    for (const key of ["HOME", "LANG", "LC_ALL", "PATH", "SETFARM_ENV_DIR", "SETFARM_PG_URL", "SETFARM_REPO_DIR"]) if (!environment[key]) fail("direct child base environment is absent");
    if (profile.environmentHash !== sha256(`setfarm.internal-production-spawner-launch-environment-candidate.v1\n${canonical(environment)}`)
      || environment.HOME !== profile.home || environment.SETFARM_REPO_DIR !== repository || environment.SETFARM_ENV_DIR !== profile.environmentDirectory
      || environment.LANG !== "C" || environment.LC_ALL !== "C") fail("direct child environment commitment is crossed");
    const metadata = (stats: BigIntStats) => ({ devDecimal: String(stats.dev), inoDecimal: String(stats.ino), uid: Number(stats.uid), gid: Number(stats.gid), mode: Number(stats.mode & 0o7777n) });
    const directories = new Map<string, BigIntStats>();
    for (const directory of profile.hostDirectories as Array<Record<string, any>>) {
      const stats = lstatSync(directory.path, { bigint: true }), { path: target, ...expected } = directory;
      if (!stats.isDirectory() || stats.isSymbolicLink() || canonical(metadata(stats)) !== canonical(expected)) fail("direct child physical host identity is crossed");
      directories.set(target, stats);
    }
    const nodePin: Pin = { descriptor: openSync(process.execPath, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK), identity: null, target: process.execPath, bytes: null, closeEntered: false };
    pins.push(nodePin); nodePin.identity = fstatSync(nodePin.descriptor!, { bigint: true });
    const { path: nodePath, bytesHash, ...nodeExpected } = profile.executable, nodeStats = nodePin.identity;
    if (nodePath !== process.execPath || !nodeStats.isFile() || nodeStats.isSymbolicLink() || nodeStats.nlink !== 1n || nodeStats.size < 1n || nodeStats.size > 268_435_456n
      || canonical(metadata(nodeStats)) !== canonical(nodeExpected) || !sameColdFileMetadataV1(nodeStats, lstatSync(process.execPath, { bigint: true }))) fail("direct child physical Node identity is crossed");
    const hash = createHash("sha256"), buffer = Buffer.alloc(65_536);
    let offset = 0;
    while (offset < Number(nodeStats.size)) {
      const count = readSync(nodePin.descriptor!, buffer, 0, Math.min(buffer.length, Number(nodeStats.size) - offset), offset);
      if (count < 1) fail("direct child Node read is partial");
      hash.update(buffer.subarray(0, count)); offset += count;
    }
    if (hash.digest("hex") !== bytesHash || readSync(nodePin.descriptor!, buffer, 0, 1, offset) !== 0) fail("direct child Node bytes are crossed");
    const ownIdentity = boundedPsProcessIdentity(process.pid);
    if (!ownIdentity) fail("direct child own process identity is absent");
    let claimStarted = false;
    let claim: { record: Readonly<Record<string, any>>; reader: Pin; rootIdentity: BigIntStats; observeOwnership: () => unknown } | null = null;
    const assertOriginalStable = () => {
      if (closing) fail("direct child authentication is closed");
      for (const guard of guards) guard.assertStable();
      if (process.execArgv.length !== 0 || process.argv.length !== 2 || process.argv[1] !== entry || process.cwd() !== repository
        || ["dev", "ino", "uid", "gid", "mode", "birthtimeNs"].some(key => rootIdentity[key as keyof BigIntStats] !== lstatSync(root, { bigint: true })[key as keyof BigIntStats])) fail("direct child entry or journal changed");
      for (const [descriptor, target, original] of [[4, paths.lock, lockFile], [5, path.join(root, "spawn-dispatch.json"), dispatchFile]] as const) {
        const current = inherited(descriptor, target, 65_536);
        if (!sameColdFileMetadataV1(original.identity, current.identity) || !original.bytes.equals(current.bytes)) fail("direct child inherited authority changed");
      }
      for (const pin of pins) if (pin.descriptor === null || pin.identity === null || !sameColdFileMetadataV1(pin.identity, fstatSync(pin.descriptor, { bigint: true }))
        || (pin === nodePin ? !sameColdFileMetadataV1(pin.identity, lstatSync(pin.target, { bigint: true })) : !pin.bytes!.equals(readColdGenesisCandidateV1(pin.target, pin.identity)))) fail("direct child original publication changed");
      if (!sameColdFileMetadataV1(frameIdentity, fstatSync(3, { bigint: true })) || !frameBytes.equals(readInternalProductionSpawnerUntrustedInheritedFrameV1())) fail("direct child original private frame changed");
      for (const [target, original] of directories) {
        const current = lstatSync(target, { bigint: true });
        if (!current.isDirectory() || current.isSymbolicLink() || ["dev", "ino", "uid", "gid", "mode", "birthtimeNs"].some(key => current[key as keyof BigIntStats] !== original[key as keyof BigIntStats])) fail("direct child physical host identity changed");
      }
      const controller = boundedPsProcessIdentity(lock.pid as number), controllerOwner = observeColdProcessParentGroupV1(lock.pid as number);
      let originalParent = false;
      try {
        const parent = boundedPsProcessIdentity(helper.pid as number), owner = parent === null ? null : observeColdProcessParentGroupV1(helper.pid as number);
        originalParent = parent !== null && owner !== null && canonical({ ...parent, uid: owner.uid, ppid: owner.ppid }) === canonical(helper);
      } catch (error) { if (claim === null || boundedPsProcessIdentity(helper.pid as number) !== null) throw error; }
      const ownOwner = observeColdProcessParentGroupV1(process.pid), parentPid = process.ppid;
      const settledOwner = claim !== null && ownOwner.ppid === helper.pid && parentPid === 1 ? observeColdProcessParentGroupV1(process.pid) : ownOwner;
      originalParent = originalParent && parentPid === helper.pid && settledOwner.ppid === helper.pid;
      const departedParent = claim !== null && parentPid === 1 && settledOwner.ppid === 1 && boundedPsProcessIdentity(helper.pid as number) === null;
      if (!controller || controller.processStartTimeEpochMs !== lock.processStartTimeEpochMs || controller.processIdentityHash !== lock.processIdentityHash
        || controllerOwner.uid !== profile.uid || (!originalParent && !departedParent)
        || ownOwner.uid !== profile.uid || ownOwner.pgid !== process.pid || settledOwner.uid !== profile.uid || settledOwner.pgid !== process.pid
        || canonical(boundedPsProcessIdentity(process.pid)) !== canonical(ownIdentity)) fail("direct child live parent chain is crossed");
      for (const guard of guards) guard.assertStable();
    };
    const assertOutput = () => verifyInternalProductionSpawnerLaunchOutputCandidateV1({ rootIdentity: { devDecimal: profile.rootIdentity.devDecimal, inoDecimal: profile.rootIdentity.inoDecimal, uid: profile.uid },
      sourceSha: profile.source.sha, sourceTreeHash: profile.source.treeHash, buildInfoBytesHash: profile.buildInfoBytesHash,
      outputTreeBytesHash: profile.outputTreeBytesHash, releaseManifestBytesHash: profile.releaseManifestBytesHash });
    const assertPrefix = () => {
      if (claimStarted && claim === null) fail("direct child claim publication is uncertain");
      const expected = claim?.rootIdentity ?? rootIdentity;
      if (!sameColdFileMetadataV1(expected, lstatSync(root, { bigint: true }))
        || canonical(readColdDirectoryMembersV1(root, claim ? 4 : 3).sort()) !== canonical([...(claim ? ["claim.json"] : []), "spawn-dispatch.json", "termination-dispatch.json", "termination-receipt.json"])) fail("direct child journal prefix changed");
      if (claim && (claim.reader.descriptor === null || !sameColdFileMetadataV1(claim.reader.identity!, fstatSync(claim.reader.descriptor, { bigint: true }))
        || !claim.reader.bytes!.equals(readColdGenesisCandidateV1(claim.reader.target, claim.reader.identity!))
        || canonical(claim.observeOwnership()) !== canonical(claim.record.startupFiles))) fail("direct child original claim changed");
    };
    const assertStable = () => {
      assertOriginalStable(); assertPrefix(); assertOutput(); assertOriginalStable(); assertPrefix();
    };
    assertStable();
    if (observeDirectSpawnerTerminationTargetV1((history.dispatch.target as Record<string, any>).pid) !== null) fail("direct child predecessor is present");
    assertStable();
    const publishClaim = async () => {
      assertStable();
      if (claimStarted) fail("direct child claim was already attempted");
      claimStarted = true;
      const main = await import("../spawner.js");
      assertOriginalStable(); assertOutput(); assertOriginalStable();
      const ownership = main.observeInternalProductionDirectSpawnerStartupOwnershipV1();
      const runtime = path.join(profile.home, ".openclaw/setfarm");
      if (ownership.schema !== "setfarm.internal-production-direct-spawner-startup-ownership.v1" || ownership.pid !== process.pid || ownership.uid !== profile.uid
        || ownership.singleton.path !== path.join(runtime, "spawner.lock") || ownership.pidFile.path !== path.join(runtime, "spawner.pid")
        || ownership.singleton.uid !== profile.uid || ownership.pidFile.uid !== profile.uid || ownership.singleton.mode !== 0o600 || ownership.pidFile.mode !== 0o600
        || ownership.singleton.bytesHash !== sha256(`${process.pid}\n`) || ownership.pidFile.bytesHash !== sha256(String(process.pid))) fail("direct child startup ownership is crossed");
      const assertOwner = () => {
        assertOriginalStable();
        if (canonical(main.observeInternalProductionDirectSpawnerStartupOwnershipV1()) !== canonical(ownership)) fail("direct child startup ownership changed");
      };
      assertOwner();
      if (!sameColdFileMetadataV1(rootIdentity, lstatSync(root, { bigint: true }))
        || canonical(readColdDirectoryMembersV1(root, 3).sort()) !== canonical(["spawn-dispatch.json", "termination-dispatch.json", "termination-receipt.json"])) fail("direct child pre-claim journal changed");
      if (observeDirectSpawnerTerminationTargetV1((history.dispatch.target as Record<string, any>).pid) !== null) fail("direct child predecessor returned before claim");
      const own = boundedPsProcessIdentity(process.pid), owner = observeColdProcessParentGroupV1(process.pid);
      if (!own || canonical(own) !== canonical(ownIdentity) || owner.ppid !== helper.pid || owner.pgid !== process.pid || owner.uid !== profile.uid) fail("direct child claim process changed");
      const body = { schema: "setfarm.internal-production-pre-schema-spawner-direct-claim.v1", purpose: "operation-bound-pre-schema-spawner-rebind-v1",
        intentRef: intent.intentRef, intentHash: intent.intentHash, dispatchRef: dispatch.dispatchRef, dispatchHash: dispatch.dispatchHash,
        currentEntryOperation: intent.currentEntryOperation, startupToken: intent.startupToken, epoch: intent.epoch, source: profile.source,
        profileHash: profile.profileHash, lockIdentity: intent.lockIdentity, child: { ...own, ...owner }, startupFiles: ownership, maximumClaimCount: 1 };
      const claimHash = sha256(canonical(body)), record = freezeColdDataV1({ ...body, claimRef: `setfarm://internal-production/pre-schema-spawner-direct-claim/sha256/${claimHash}`, claimHash });
      const bytes = Buffer.from(`${canonical(record)}\n`);
      if (bytes.length > 65_536) fail("direct child claim exceeds its cap");
      const target = path.join(root, "claim.json");
      const openOwned = (flags: number) => {
        const pin: Pin = { descriptor: openSync(target, flags, 0o600), identity: null, target, bytes: null, closeEntered: false };
        claimPins.push(pin); pin.identity = fstatSync(pin.descriptor!, { bigint: true }); return pin;
      };
      assertOwner();
      if (!sameColdFileMetadataV1(rootIdentity, lstatSync(root, { bigint: true }))
        || canonical(readColdDirectoryMembersV1(root, 3).sort()) !== canonical(["spawn-dispatch.json", "termination-dispatch.json", "termination-receipt.json"])) fail("direct child journal changed before claim creation");
      const writer = openOwned(constants.O_RDWR | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW), created = writer.identity!;
      if (!created.isFile() || created.nlink !== 1n || created.uid !== rootIdentity.uid || created.dev !== rootIdentity.dev || created.size !== 0n || (created.mode & 0o7777n) !== 0o600n
        || !sameColdFileMetadataV1(created, lstatSync(target, { bigint: true }))) fail("direct child claim creation changed");
      const finalRootIdentity = lstatSync(root, { bigint: true });
      const assertPublishing = () => {
        assertOwner();
        if (!sameColdFileMetadataV1(finalRootIdentity, lstatSync(root, { bigint: true }))
          || canonical(readColdDirectoryMembersV1(root, 4).sort()) !== canonical(["claim.json", "spawn-dispatch.json", "termination-dispatch.json", "termination-receipt.json"])) fail("direct child claim publishing prefix changed");
      };
      assertPublishing();
      if (!sameColdFileMetadataV1(created, fstatSync(writer.descriptor!, { bigint: true })) || !sameColdFileMetadataV1(created, lstatSync(target, { bigint: true }))) fail("direct child original empty claim changed before write");
      writeFileSync(writer.descriptor!, bytes); fsyncSync(writer.descriptor!); fsyncParent(target);
      const written = fstatSync(writer.descriptor!, { bigint: true });
      if (["dev", "ino", "uid", "gid", "mode", "birthtimeNs"].some(key => created[key as keyof BigIntStats] !== written[key as keyof BigIntStats])
        || written.size !== BigInt(bytes.length) || !bytes.equals(readColdGenesisCandidateV1(target, written))) fail("direct child claim publication changed");
      const reader = openOwned(constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK); reader.bytes = bytes;
      if (!sameColdFileMetadataV1(written, reader.identity!)) fail("direct child original claim reopen changed");
      closePrivateFrameDescriptorV1(writer); assertPublishing(); assertOutput(); assertPublishing();
      claim = { record, reader, rootIdentity: finalRootIdentity, observeOwnership: main.observeInternalProductionDirectSpawnerStartupOwnershipV1 };
      assertStable();
      return Object.freeze({ claimRef: record.claimRef, claimHash, claimIdentity: coldFileIdentityTupleV1(written), journalIdentity: coldFileIdentityTupleV1(finalRootIdentity) });
    };
    return Object.freeze({ intent, epoch, terminationDispatchBytes, terminationReceiptBytes, environment: freezeColdDataV1(environment) as Readonly<Record<string, string>>, assertStable, publishClaim, close });
  } catch {
    try { close(); } catch { pendingColdHelperAuthenticationCleanupV1.add(close); }
    return fail("direct child authentication failed");
  }
}

function revokeDirectSpawnerChildRuntimeV1(): void {
  directChildAuthenticationFailedV1 = true;
  const authentication = directChildAuthenticationV1;
  if (authentication === null) return;
  const close = () => { authentication.close(); if (directChildAuthenticationV1 === authentication) directChildAuthenticationV1 = null; pendingColdHelperAuthenticationCleanupV1.delete(close); };
  try { close(); } catch { pendingColdHelperAuthenticationCleanupV1.add(close); }
}

function resolveDirectSpawnerChildRuntimeSnapshotV1() {
  if (directChildAuthenticationFailedV1) fail("direct child authentication is revoked");
  try {
    directChildAuthenticationV1 ??= authenticateDirectSpawnerChildCapabilityV1();
    directChildAuthenticationV1.assertStable();
    return Object.freeze({ environment: directChildAuthenticationV1.environment });
  } catch { revokeDirectSpawnerChildRuntimeV1(); return fail("direct child runtime authentication failed"); }
}

async function acquireDirectSpawnerChildStartupContextV1() {
  try {
    if (directChildAdmissionAttemptedV1 || directChildAuthenticationFailedV1 || directChildAuthenticationV1 === null || spawnerInheritedRuntimeRefusedV1) fail("direct child startup admission is unavailable");
    directChildAdmissionAttemptedV1 = true;
    const authentication = directChildAuthenticationV1, intent = authentication.intent;
    const assertStable = () => {
      if (directChildAuthenticationV1 !== authentication || directChildAuthenticationFailedV1 || spawnerInheritedRuntimeRefusedV1) fail("direct child startup admission is revoked");
      authentication.assertStable();
    };
    assertStable();
    const evidence = await resolveDirectSpawnerRebindEvidenceV1({ currentEntryOperation: intent.currentEntryOperation, restartAuthority: intent.restartAuthority } as Parameters<typeof resolveDirectSpawnerRebindEvidenceV1>[0], authentication.epoch, assertStable);
    assertStable();
    parseDirectSpawnerTerminationChainV1(authentication.terminationDispatchBytes, authentication.terminationReceiptBytes, intent, evidence.preMutation);
    if (canonical(evidence.profile) !== canonical(intent.launchProfile) || canonical(evidence.environment) !== canonical(authentication.environment)
      || canonical(intent.startupToken) !== canonical({ startupTokenRef: evidence.startup.startupTokenRef, startupTokenHash: evidence.startup.startupTokenHash })) fail("direct child original startup evidence is crossed");
    if (observeDirectSpawnerTerminationTargetV1((evidence.preMutation.spawner as Record<string, any>).pid) !== null) fail("direct child original predecessor returned");
    assertStable();
    const publishClaim = async () => {
      try { assertStable(); const result = await authentication.publishClaim(); assertStable(); return result; }
      catch { revokeDirectSpawnerChildRuntimeV1(); return fail("direct child claim publication is uncertain"); }
    };
    return Object.freeze({ schema: "setfarm.internal-production-direct-child-startup-context.v1", publishClaim, close: revokeDirectSpawnerChildRuntimeV1 });
  } catch { revokeDirectSpawnerChildRuntimeV1(); return fail("direct child startup admission failed"); }
}

export async function acquireInternalProductionDirectSpawnerChildStartupContextV1() {
  return acquireDirectSpawnerChildStartupContextV1();
}

type SpawnerInheritedRuntimeRoleV1 = "cold-helper" | "cold-child" | "direct-helper" | "direct-child";
let spawnerInheritedRuntimeSelectionV1: { role: SpawnerInheritedRuntimeRoleV1; entry: string; identity: BigIntStats; bytes: Buffer } | null = null;
let spawnerInheritedRuntimeRefusedV1 = false;

// Configuration authority only. A frame discriminator chooses the mandatory
// authenticator, never a grant, fallback mode, process effect or caller root.
export function resolveInternalProductionSpawnerInheritedRuntimeSnapshotV1(): Readonly<{
  schema: "setfarm.internal-production-spawner-inherited-runtime-snapshot.v1";
  role: SpawnerInheritedRuntimeRoleV1;
  environment: Readonly<Record<string, string>>;
}> | null {
  if (spawnerInheritedRuntimeRefusedV1 || directChildAuthenticationFailedV1) {
    for (const pending of pendingColdHelperAuthenticationCleanupV1) pending();
    fail("inherited spawner runtime authentication is revoked");
  }
  try {
    const entry = process.argv[1], helper = path.join(repositoryRoot(), "dist/internal-production/baseline-service-restart-helper-v1.js"), child = path.join(repositoryRoot(), "dist/spawner.js");
    if (entry !== helper && entry !== child) {
      if (spawnerInheritedRuntimeSelectionV1 !== null || coldHelperRuntimeContextV1 !== null || coldChildAuthenticationV1 !== null || coldChildAuthenticationFailedV1 || directHelperAuthenticationV1 !== null || directHelperAuthenticationFailedV1 || directHelperAuthenticationActiveV1) fail("inherited spawner runtime entry changed");
      return null;
    }
    let identity: BigIntStats;
    try { identity = fstatSync(3, { bigint: true }); }
    catch (error) {
      if (entry === child && spawnerInheritedRuntimeSelectionV1 === null && !coldChildAuthenticationFailedV1 && coldChildAuthenticationV1 === null && directHelperAuthenticationV1 === null && !directHelperAuthenticationFailedV1 && !directHelperAuthenticationActiveV1
        && error instanceof Error && "code" in error && error.code === "EBADF") return null;
      throw error;
    }
    if (!identity.isFile() && entry === child && spawnerInheritedRuntimeSelectionV1 === null && !coldChildAuthenticationFailedV1 && coldChildAuthenticationV1 === null && directHelperAuthenticationV1 === null && !directHelperAuthenticationFailedV1 && !directHelperAuthenticationActiveV1) return null;
    const bytes = readInternalProductionSpawnerUntrustedInheritedFrameV1();
    if (!sameColdFileMetadataV1(identity, fstatSync(3, { bigint: true }))) fail("inherited spawner frame changed while selected");
    const frame = JSON.parse(bytes.toString("utf8"));
    if (!frame || typeof frame !== "object" || Array.isArray(frame) || !bytes.equals(Buffer.from(`${canonical(frame)}\n`))) fail("inherited spawner frame is noncanonical");
    const roles: Record<string, SpawnerInheritedRuntimeRoleV1> = {
      "setfarm.internal-production-cold-spawner-bootstrap-helper-capability.v1": "cold-helper",
      "setfarm.internal-production-cold-spawner-bootstrap-child-capability.v1": "cold-child",
      "setfarm.internal-production-pre-schema-spawner-direct-rebind-helper-capability.v1": "direct-helper",
      "setfarm.internal-production-pre-schema-spawner-direct-rebind-child-capability.v1": "direct-child",
    };
    const role = Object.hasOwn(roles, frame.schema) ? roles[frame.schema] : undefined;
    if (!role || (role.endsWith("helper") ? entry !== helper : entry !== child)) fail("inherited spawner frame family or entry is crossed");
    const retained = spawnerInheritedRuntimeSelectionV1;
    if (retained !== null && (retained.role !== role || retained.entry !== entry || !sameColdFileMetadataV1(retained.identity, identity) || !retained.bytes.equals(bytes))) fail("inherited spawner original frame changed");
    spawnerInheritedRuntimeSelectionV1 ??= { role, entry, identity, bytes };
    // Direct roles must not borrow a cold authenticator. Their own issuer is
    // connected with the direct helper/child lifecycle before V2 emission.
    const authenticated = role === "cold-helper" ? resolveInternalProductionColdSpawnerHelperRuntimeSnapshotV1()
      : role === "cold-child" ? resolveInternalProductionColdSpawnerChildRuntimeSnapshotV1()
      : role === "direct-helper" ? resolveDirectSpawnerHelperRuntimeSnapshotV1()
      : resolveDirectSpawnerChildRuntimeSnapshotV1();
    if (authenticated === null || process.argv[1] !== entry || !sameColdFileMetadataV1(identity, fstatSync(3, { bigint: true }))
      || !readInternalProductionSpawnerUntrustedInheritedFrameV1().equals(bytes)) fail("inherited spawner configuration authentication changed");
    const snapshot = { schema: "setfarm.internal-production-spawner-inherited-runtime-snapshot.v1" as const, role };
    Object.defineProperty(snapshot, "environment", { value: authenticated.environment, enumerable: false });
    return Object.freeze(snapshot) as typeof snapshot & Readonly<{ environment: Readonly<Record<string, string>> }>;
  } catch (error) {
    spawnerInheritedRuntimeRefusedV1 = true;
    if (directChildAuthenticationV1 !== null || spawnerInheritedRuntimeSelectionV1?.role === "direct-child") revokeDirectSpawnerChildRuntimeV1();
    if (directHelperAuthenticationV1 !== null || directHelperAuthenticationActiveV1 || spawnerInheritedRuntimeSelectionV1?.role === "direct-helper") revokeDirectSpawnerHelperRuntimeV1();
    if (coldChildAuthenticationV1 !== null || spawnerInheritedRuntimeSelectionV1?.role === "cold-child") revokeColdSpawnerChildRuntimeV1();
    const helperContext = coldHelperRuntimeContextV1;
    if (helperContext !== null) {
      const close = () => { helperContext.close(); pendingColdHelperAuthenticationCleanupV1.delete(close); };
      try { close(); }
      catch { pendingColdHelperAuthenticationCleanupV1.add(close); }
    }
    throw error;
  }
}

function assertEpochOneActive(): Readonly<Record<string, unknown>> {
  const { epoch } = rootPaths();
  const bytes = readStableRetirementBytes(epoch, "restart epoch");
  const value = JSON.parse(bytes.toString("utf8")) as unknown;
  if (value && typeof value === "object" && !Array.isArray(value)
    && (value as Record<string, unknown>).schema === "setfarm.internal-production-physical-service-restart-authority-epoch.v2") return assertColdEpochOneHeadV1(value, bytes);
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

// Lock ownership alone is not restart or cold-genesis admission. A cold caller
// must authenticate its incident/history before reclaim and publish a bound
// genesis/head before promoting this same descriptor into ordinary authority.
async function acquireRawPhysicalTransitionLockV1(): Promise<RawPhysicalTransitionLockV1> {
  const paths = rootPaths();
  const rootGuard = ensurePrivateAuthorityDirectoryV1(paths.root);
  let rootGuardTransferred = false;
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
    const raw = Object.freeze({ schema: "setfarm.internal-production-raw-physical-transition-lock.v1" as const });
    rootGuard.assertStable();
    rawPhysicalTransitionLocksV1.set(raw, { ...opened, rootGuard, cleanup: { phase: "held", identity: null, unlinkSynced: false, rootGuardClosing: false, rootGuardClosed: false, descriptorClosed: false } });
    rootGuardTransferred = true;
    opened = null;
    return raw;
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
    if (!rootGuardTransferred) rootGuard.close();
  }
}

function heldRawPhysicalTransitionLockV1(raw: RawPhysicalTransitionLockV1): RawPhysicalTransitionLockStateV1 {
  const state = rawPhysicalTransitionLocksV1.get(raw);
  if (!state || Reflect.ownKeys(raw).length !== 1 || raw.schema !== "setfarm.internal-production-raw-physical-transition-lock.v1") {
    fail("raw lock is foreign, cloned, released or promoted");
  }
  return state;
}

function assertRawPhysicalTransitionLockStableV1(state: RawPhysicalTransitionLockStateV1): void {
  if (state.cleanup.phase !== "held") fail("raw physical transition lock is awaiting unlink durability");
  state.rootGuard.assertStable();
  const held = descriptorIdentity(state.descriptor);
  const atPath = lstatSync(rootPaths().lock, { bigint: true });
  if (held.devDecimal !== String(atPath.dev) || held.inoDecimal !== String(atPath.ino)
    || !readStableRetirementBytes(rootPaths().lock, "raw physical transition lock").equals(state.lockBytes)) {
    fail("raw physical transition lock changed");
  }
  state.rootGuard.assertStable();
}

function promoteRawPhysicalTransitionLockV1(
  raw: RawPhysicalTransitionLockV1,
  assertEpoch: () => Readonly<Record<string, unknown>>,
): InternalProductionPhysicalServiceRestartAuthorityTransitionLeaseV1 {
  const state = heldRawPhysicalTransitionLockV1(raw);
  assertRawPhysicalTransitionLockStableV1(state);
  assertEpoch();
  const lease = Object.freeze({ schema: "setfarm.internal-production-physical-service-restart-authority-transition-lease.v1" as const });
  assertRawPhysicalTransitionLockStableV1(state);
  state.rootGuard.close();
  leases.set(lease, { descriptor: state.descriptor, lockBytes: state.lockBytes, phase: "held", authorityOwner: "baseline-a" });
  rawPhysicalTransitionLocksV1.delete(raw);
  return lease;
}

function releaseRawPhysicalTransitionLockV1(raw: RawPhysicalTransitionLockV1): void {
  const state = heldRawPhysicalTransitionLockV1(raw);
  const cleanup = state.cleanup;
  for (const close of pendingColdHelperAuthenticationCleanupV1) close();
  if (state.cleanup.phase === "held") {
    assertRawPhysicalTransitionLockStableV1(state);
    cleanup.identity ??= fstatSync(state.descriptor, { bigint: true });
    if (!sameColdFileMetadataV1(cleanup.identity, fstatSync(state.descriptor, { bigint: true }))) fail("raw held lock changed during cleanup");
    assertHelperJournalAllowsLockCleanup(parseLockRecord(state.lockBytes), descriptorIdentity(state.descriptor));
    cleanupExactOwnedLock(rootPaths().lock, state.descriptor, state.lockBytes, () => { state.cleanup.phase = "owned-unlink-completed"; });
  }
  // Only a recorded owned unlink permits this metadata transition. A new
  // pathname owner is unrelated to draining the original unlinked capability.
  if (cleanup.identity?.nlink === 1n) {
    const unlinked = fstatSync(state.descriptor, { bigint: true });
    if (unlinked.nlink !== 0n || ["dev", "ino", "uid", "gid", "mode", "size", "birthtimeNs", "mtimeNs"].some(key => cleanup.identity![key as keyof BigIntStats] !== unlinked[key as keyof BigIntStats])) fail("raw owned unlink identity is crossed");
    cleanup.identity = unlinked;
  }
  if (!cleanup.identity || cleanup.identity.nlink !== 0n) fail("raw cleanup has no owned unlink identity");
  if (!cleanup.unlinkSynced) {
    state.rootGuard.assertStable();
    if (!sameColdFileMetadataV1(cleanup.identity, fstatSync(state.descriptor, { bigint: true }))) fail("raw completed unlink descriptor is crossed");
    fsyncParent(rootPaths().lock);
    state.rootGuard.assertStable();
    cleanup.unlinkSynced = true;
  }
  if (!cleanup.rootGuardClosed) {
    if (!cleanup.rootGuardClosing) state.rootGuard.assertStable();
    cleanup.rootGuardClosing = true;
    state.rootGuard.close();
    cleanup.rootGuardClosed = true;
  }
  if (!cleanup.descriptorClosed) {
    if (!sameColdFileMetadataV1(cleanup.identity, fstatSync(state.descriptor, { bigint: true }))) fail("raw cleanup descriptor is crossed before close");
    closeSync(state.descriptor);
    cleanup.descriptorClosed = true;
  }
  rawPhysicalTransitionLocksV1.delete(raw);
}

function abandonRawPhysicalTransitionLockV1(raw: RawPhysicalTransitionLockV1): void {
  const state = heldRawPhysicalTransitionLockV1(raw);
  try {
    try {
      state.rootGuard.assertStable();
      cleanupExactOwnedLock(rootPaths().lock, state.descriptor, state.lockBytes);
      closeSync(state.descriptor);
    } catch {
      if (abandonedAcquireV1) fail("multiple abandoned transition-lock acquisitions are not permitted");
      abandonedAcquireV1 = { descriptor: state.descriptor, lockBytes: state.lockBytes };
    }
  } finally { rawPhysicalTransitionLocksV1.delete(raw); state.rootGuard.close(); }
}

async function acquireTransitionLeaseWithEpochAssertionV1(assertEpoch: () => Readonly<Record<string, unknown>>): Promise<InternalProductionPhysicalServiceRestartAuthorityTransitionLeaseV1> {
  assertEpoch();
  const raw = await acquireRawPhysicalTransitionLockV1();
  try { return promoteRawPhysicalTransitionLockV1(raw, assertEpoch); }
  catch (error) { abandonRawPhysicalTransitionLockV1(raw); throw error; }
}

export async function acquireInternalProductionPhysicalServiceRestartAuthorityTransitionLeaseV1(): Promise<InternalProductionPhysicalServiceRestartAuthorityTransitionLeaseV1> {
  return acquireTransitionLeaseWithEpochAssertionV1(assertEpochOneActive);
}

export async function releaseInternalProductionPhysicalServiceRestartAuthorityTransitionLeaseV1(
  lease: InternalProductionPhysicalServiceRestartAuthorityTransitionLeaseV1,
): Promise<void> {
  if (retainedDirectSpawnerRebindIntentV1?.lease === lease) fail("DIRECT_REBIND_UNSETTLED: direct preparation retains its physical lease");
  if (retainedColdBootstrapIntentV1?.lease === lease) return releaseColdControllerTransitionLeaseV1(retainedColdBootstrapIntentV1);
  const state = heldLease(lease);
  const paths = rootPaths();
  const rootGuard = authenticatePrivateDirectoryChainV1(resolveInternalProductionBaselineWorkspaceRootV1(), paths.root);
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

function releaseColdControllerTransitionLeaseV1(state: ColdBootstrapIntentStateV1): void {
  if (coldControllerReleaseActiveV1 || coldControllerHelperInvocationActiveV1 || coldControllerSettlementActiveV1 || coldBootstrapIntentInvocationActiveV1) fail("cold controller ownership is active");
  coldControllerReleaseActiveV1 = true;
  try {
    const held = leases.get(state.lease), invocation = state.helperInvocation, settlement = state.settlement, paths = rootPaths();
    if (!held || !invocation || !settlement?.committed || !settlement.identity || settlement.descriptor !== null
      || !["settled", "releasing"].includes(state.phase)) fail("COLD_BOOTSTRAP_UNSETTLED: cold controller release has no retained terminal");
    for (const close of pendingColdHelperAuthenticationCleanupV1) close();
    const terminal = () => {
      const census = observeInternalProductionColdSpawnerBootstrapJournalCensusV1();
      if (census.state !== "settled" || canonical(census.settlement) !== canonical(settlement.record)
        || !settlement.bytes.equals(Buffer.from(`${canonical(census.settlement)}\n`))
        || canonical(census.settlementIdentity) !== canonical(coldFileIdentityTupleV1(settlement.identity!))) fail("cold release terminal is not the original owned publication");
    };
    const originalLock = invocation.pins.find(pin => pin.path === paths.lock);
    if (!originalLock || originalLock.descriptor !== held.descriptor || !originalLock.bytes.equals(held.lockBytes)
      || canonical(state.intent.transitionLock) !== canonical(parseLockRecord(held.lockBytes))
      || canonical(state.intent.lockIdentity) !== canonical({ devDecimal: String(originalLock.stats.dev), inoDecimal: String(originalLock.stats.ino) })) fail("cold release physical owner is crossed");
    const linkedLock = () => {
      state.rootGuard.assertStable();
      if (!sameColdFileMetadataV1(originalLock.stats, fstatSync(held.descriptor, { bigint: true }))
        || !held.lockBytes.equals(readColdGenesisCandidateV1(paths.lock, originalLock.stats))
        || !sameColdFileMetadataV1(originalLock.stats, fstatSync(held.descriptor, { bigint: true }))) fail("cold release physical lock changed");
      state.rootGuard.assertStable();
    };
    if (!state.release) {
      terminal(); linkedLock();
      // Revoke all effectful capabilities before the first owned resource closes.
      state.release = { lockIdentity: originalLock.stats, lockUnlinked: false, unlinkSynced: false, rootGuardClosing: false, rootGuardClosed: false, descriptorClosed: false };
      state.phase = "releasing"; held.phase = "released";
    }
    const release = state.release;
    if (!release.lockUnlinked) {
      terminal(); linkedLock();
      while (invocation.transportDescriptors.length > 0) { closeSync(invocation.transportDescriptors.at(-1)!); invocation.transportDescriptors.pop(); }
      while (invocation.authorityDescriptors.length > 0) { closeSync(invocation.authorityDescriptors.at(-1)!); invocation.authorityDescriptors.pop(); }
      while (invocation.guards.length > 0) { invocation.guards.at(-1)!.close(); invocation.guards.pop(); }
      terminal(); linkedLock();
      // The borrowed physical descriptor is not in either owned FD array.
      // Its final reader has closed successfully before this exact unlink.
      if (!sameColdFileMetadataV1(originalLock.stats, lstatSync(paths.lock, { bigint: true }))) fail("cold release lock changed immediately before unlink");
      unlinkSync(paths.lock);
      release.lockUnlinked = true;
    }
    if (!release.unlinkSynced) {
      state.rootGuard.assertStable();
      if (release.lockIdentity.nlink === 1n) {
        // Only our recorded successful unlink permits this one metadata
        // transition, including resumption after the syscall's return.
        const unlinked = fstatSync(held.descriptor, { bigint: true });
        if (unlinked.nlink !== 0n || ["dev", "ino", "uid", "gid", "mode", "size", "birthtimeNs", "mtimeNs"].some(key => unlinked[key as keyof BigIntStats] !== originalLock.stats[key as keyof BigIntStats])) fail("cold release owned unlink is crossed");
        release.lockIdentity = unlinked;
      }
      if (!sameColdFileMetadataV1(release.lockIdentity, fstatSync(held.descriptor, { bigint: true })) || release.lockIdentity.nlink !== 0n) fail("cold release unlinked owner changed");
      // Our successful unlink ended pathname ownership. A new owner may
      // already occupy that name; syncing this parent and closing only our
      // original unlinked descriptor must neither inspect nor remove it.
      fsyncParent(paths.lock);
      state.rootGuard.assertStable();
      release.unlinkSynced = true;
    }
    // Past durable unlink there is no physical fence. Only drain this exact
    // capability; never reacquire or inspect/close a newly reused descriptor.
    if (!release.rootGuardClosed) {
      if (!release.rootGuardClosing) { state.rootGuard.assertStable(); release.rootGuardClosing = true; }
      state.rootGuard.close(); release.rootGuardClosed = true;
    }
    if (!release.descriptorClosed) {
      if (!sameColdFileMetadataV1(release.lockIdentity, fstatSync(held.descriptor, { bigint: true }))) fail("cold release final descriptor changed");
      closeSync(held.descriptor); release.descriptorClosed = true;
    }
    leases.delete(state.lease);
    retainedColdBootstrapIntentV1 = null;
  } finally { coldControllerReleaseActiveV1 = false; }
}

function readSettlement(hash: string): Readonly<Record<string, unknown>> {
  const file = path.join(rootPaths().settlements, hash.slice(0, 2), `${hash}.json`);
  const bytes = readStableRetirementBytes(file, "helper settlement");
  const value = JSON.parse(bytes.toString("utf8")) as unknown;
  if (`${canonical(value)}\n` !== bytes.toString("utf8")) fail("helper settlement is not canonical");
  return exactCanonicalRecord(value, ["schema", "action", "currentEntryOperation", "restartAuthority", "journalHash", "transitionLock", "lockIdentity", "dispatchCount", "disposition", "helperSettlementRef", "helperSettlementHash"], "helper settlement");
}

function startupPrefixAlreadyPassedHelperV1(operationHash: string): boolean {
  const directory = resolveInternalProductionBaselineAuthorityPathV1("data/internal-production-baseline/pre-schema-spawner-rebind-v1/operations/sha256", operationHash);
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
  const receipt = await import("./baseline-post-handoff-receipt-v1.js") as Readonly<Record<string, unknown>>;
  const reobservePreparedProjection = receipt.reobserveInternalProductionBaselineServiceRestartPreparedRuntimeProjectionV1;
  if (typeof reobservePreparedProjection !== "function" || reobservePreparedProjection.length !== 1) fail("baseline restart prepared runtime projection port is unavailable");
  await (reobservePreparedProjection as (input: unknown) => Promise<unknown>)({ authorizationRef: operation.authorizationRef, authorizationHash: operation.authorizationHash });
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
  const database = await import("../db-pg.js") as unknown as Record<string, unknown>;
  const acquireFence = database.acquireInternalProductionGlobalOwnerAdmissionFenceV1;
  const reobserveFence = database.reobserveInternalProductionGlobalOwnerAdmissionFenceV1;
  const releaseFence = database.releaseInternalProductionGlobalOwnerAdmissionFenceV1;
  const resolveRelease = database.resolveInternalProductionGlobalOwnerAdmissionFenceReleaseV1;
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
  const sequenceRoot = resolveInternalProductionBaselineAuthorityPathV1("data/internal-production-baseline/baseline-service-restart-sequence-v1");
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
  const file = resolveInternalProductionBaselineAuthorityPathV1("data/internal-production-baseline/zero-owner-mutation-guard-v1/consumed-guards/sha256", zeroOwnerGuardHash.slice(0, 2), `${zeroOwnerGuardHash}.json`);
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
  const released = exactOwnRecord(await fencePorts.releaseFence({ fenceRef: fence.fenceRef, fenceHash: fence.fenceHash, releaseAuthority }), ["schema", "purpose", "fenceRef", "fenceHash", "releaseAuthority", "ownerAdmissionHeadPredecessorHash", "ownerAdmissionHeadSuccessorHash", "releaseRef", "releaseHash"], "global owner-admission fence release");
  if (released.purpose !== releaseAuthority.purpose || typeof released.releaseRef !== "string" || typeof released.releaseHash !== "string" || !SHA256.test(released.releaseHash)) fail("global owner-admission fence release pair is invalid");
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
