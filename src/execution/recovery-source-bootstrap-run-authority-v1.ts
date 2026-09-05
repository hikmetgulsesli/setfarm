import {
  INTERNAL_PRODUCTION_OWNER_PRODUCER_ROWS_A_V1,
  type InternalProductionSourceRunLaunchTargetReservationPairCloseV1,
  validateInternalProductionBoundOwnerReservationV1,
  validateInternalProductionGlobalOwnerAdmissionFenceReleaseV1,
  validateInternalProductionGlobalOwnerAdmissionFenceV1,
  validateInternalProductionOwnerReservationV1,
  validateInternalProductionOwnerReservationCloseV1,
  validateInternalProductionSourceRunLaunchTargetReservationPairCloseV1,
} from "../internal-production/owner-admission-v1.js";
import { canonicalJsonStringify, hashCanonicalJson } from "../product-compiler/canonical-json.js";

const SHA256_V1 = /^[0-9a-f]{64}$/;
const GIT_SHA_V1 = /^[0-9a-f]{40}$/;
const CANONICAL_REF_V1 = /^setfarm:\/\/[A-Za-z0-9._~!$&'()*+,;=:@%/-]+$/;
const RECOVERY_SOURCE_BOOTSTRAP_SOURCE_TASK_V1 =
  "Implement Tasks 1 and 2 from docs/superpowers/plans/2026-08-13-internal-production-recovery-mc-reconciliation-plan.md exactly as written.";

const OPERATION_KEYS_V1 = Object.freeze([
  "schema", "purpose", "repository", "workflow", "protocol", "promptManifestHash",
  "pendingInputRef", "pendingInputHash", "baseSourceSha", "baseSourceTreeHash", "buildHash",
  "activationPreflightHash", "releaseAdmissionHash", "targetSourceRunReservationRef",
  "targetSourceRunReservationHash", "targetRunReservationRef", "targetRunReservationHash",
  "targetRunLaunchCompositeHash", "ownerAdmissionFenceRef", "ownerAdmissionFenceHash",
  "startIntentRef", "startIntentHash", "startOutboxRef", "startOutboxHash", "operationRef",
  "operationHash",
] as const);

export type InternalProductionRecoverySourceBootstrapRunOperationAuthorityV1 = Readonly<{
  schema: "setfarm.internal-production-recovery-source-bootstrap-operation.v1";
  purpose: "recovery-d-source-delivery-v1";
  repository: "setfarm";
  workflow: "feature-dev";
  protocol: "v3";
  promptManifestHash: string;
  pendingInputRef: string;
  pendingInputHash: string;
  baseSourceSha: string;
  baseSourceTreeHash: string;
  buildHash: string;
  activationPreflightHash: string;
  releaseAdmissionHash: string;
  targetSourceRunReservationRef: string;
  targetSourceRunReservationHash: string;
  targetRunReservationRef: string;
  targetRunReservationHash: string;
  targetRunLaunchCompositeHash: string;
  ownerAdmissionFenceRef: string;
  ownerAdmissionFenceHash: string;
  startIntentRef: string;
  startIntentHash: string;
  startOutboxRef: string;
  startOutboxHash: string;
  operationRef: string;
  operationHash: string;
}>;

export type InternalProductionRecoverySourceBootstrapRunPersistenceV1 =
  | Readonly<{ state: "absent" }>
  | Readonly<{
      state: "active";
      workflowState: "running" | "resuming" | "cancelling" | "failing";
      runId: string;
      operationRunBindingHash: string;
      reciprocalRunOperationBindingHash: string;
    }>
  | Readonly<{
      state: "pair_closed";
      workflowState: "running" | "resuming" | "cancelling" | "failing" | "completed" | "failed" | "cancelled";
      runId: string;
      operationRunBindingHash: string;
      reciprocalRunOperationBindingHash: string;
      terminalOwnerRef: string;
      terminalOwnerHash: string;
      terminalSourceRunRef: string;
      terminalSourceRunHash: string;
      terminalRunLaunchRef: string;
      terminalRunLaunchHash: string;
      targetReservationPairClose: InternalProductionSourceRunLaunchTargetReservationPairCloseV1;
    }>
  | Readonly<{
      state: "released";
      workflowState: "running" | "resuming" | "cancelling" | "failing" | "completed" | "failed" | "cancelled";
      runId: string;
      operationRunBindingHash: string;
      reciprocalRunOperationBindingHash: string;
      terminalOwnerRef: string;
      terminalOwnerHash: string;
      terminalSourceRunRef: string;
      terminalSourceRunHash: string;
      terminalRunLaunchRef: string;
      terminalRunLaunchHash: string;
      targetReservationPairCloseRef: string;
      targetReservationPairCloseHash: string;
      fenceReleaseRef: string;
      fenceReleaseHash: string;
      sourceRunRef: string;
      sourceRunHash: string;
    }>;

type UnknownRowV1 = Readonly<Record<string, unknown>>;

function fail(message: string): never {
  throw new Error(message);
}

function row(value: unknown, message: string): UnknownRowV1 {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail(message);
  return value as UnknownRowV1;
}

function exactKeys(value: UnknownRowV1, keys: readonly string[], message: string): void {
  const actual = Reflect.ownKeys(value);
  if (actual.some((key) => typeof key !== "string") || actual.length !== keys.length) fail(message);
  const expected = new Set(keys);
  if (actual.some((key) => !expected.has(key as string))) fail(message);
}

function requireString(value: unknown, message: string): string {
  if (typeof value !== "string" || value.length === 0) fail(message);
  return value;
}

function requireHash(value: unknown, message: string): string {
  const hash = requireString(value, message);
  if (!SHA256_V1.test(hash)) fail(message);
  return hash;
}

function same(left: unknown, right: unknown): boolean {
  return canonicalJsonStringify(left) === canonicalJsonStringify(right);
}

export function createInternalProductionRecoverySourceBootstrapRunOperationAuthorityV1(
  input: Readonly<Record<string, unknown>>,
): InternalProductionRecoverySourceBootstrapRunOperationAuthorityV1 {
  const operation = row(input, "RECOVERY_SOURCE_BOOTSTRAP_OPERATION_AUTHORITY_INVALID");
  exactKeys(operation, OPERATION_KEYS_V1, "RECOVERY_SOURCE_BOOTSTRAP_OPERATION_AUTHORITY_INVALID");
  if (
    operation.schema !== "setfarm.internal-production-recovery-source-bootstrap-operation.v1"
    || operation.purpose !== "recovery-d-source-delivery-v1"
    || operation.repository !== "setfarm"
    || operation.workflow !== "feature-dev"
    || operation.protocol !== "v3"
  ) fail("RECOVERY_SOURCE_BOOTSTRAP_OPERATION_AUTHORITY_INVALID");
  for (const key of [
    "promptManifestHash", "pendingInputHash", "buildHash", "activationPreflightHash",
    "releaseAdmissionHash", "targetSourceRunReservationHash", "targetRunReservationHash",
    "targetRunLaunchCompositeHash", "ownerAdmissionFenceHash", "startIntentHash", "startOutboxHash",
    "operationHash",
  ] as const) requireHash(operation[key], "RECOVERY_SOURCE_BOOTSTRAP_OPERATION_AUTHORITY_INVALID");
  for (const key of ["baseSourceSha", "baseSourceTreeHash"] as const) {
    if (typeof operation[key] !== "string" || !GIT_SHA_V1.test(operation[key] as string)) {
      fail("RECOVERY_SOURCE_BOOTSTRAP_OPERATION_AUTHORITY_INVALID");
    }
  }
  for (const key of [
    "pendingInputRef", "targetSourceRunReservationRef", "targetRunReservationRef",
    "ownerAdmissionFenceRef", "startIntentRef", "startOutboxRef", "operationRef",
  ] as const) requireString(operation[key], "RECOVERY_SOURCE_BOOTSTRAP_OPERATION_AUTHORITY_INVALID");
  const expectedPromptManifestHash = hashCanonicalJson({
    schema: "setfarm.internal-production-recovery-source-bootstrap-prompt-manifest.v1",
    planPath: "docs/superpowers/plans/2026-08-13-internal-production-recovery-mc-reconciliation-plan.md",
    taskOrdinals: [1, 2],
    task: RECOVERY_SOURCE_BOOTSTRAP_SOURCE_TASK_V1,
  });
  if (
    operation.promptManifestHash !== expectedPromptManifestHash
    || operation.pendingInputRef !== `setfarm://internal-production/recovery-source-bootstrap-pending-input/sha256/${String(operation.pendingInputHash)}`
    || operation.targetSourceRunReservationRef !== `setfarm://internal-production/owner-reservations/${String(operation.targetSourceRunReservationHash)}`
    || operation.targetRunReservationRef !== `setfarm://internal-production/owner-reservations/${String(operation.targetRunReservationHash)}`
    || operation.ownerAdmissionFenceRef !== `setfarm://internal-production/global-owner-admission-fence/sha256/${String(operation.ownerAdmissionFenceHash)}`
    || operation.startIntentRef !== `setfarm://internal-production/recovery-source-bootstrap-start-intent/sha256/${String(operation.startIntentHash)}`
    || operation.startOutboxRef !== `setfarm://internal-production/recovery-source-bootstrap-start-outbox/sha256/${String(operation.startOutboxHash)}`
    || operation.operationRef !== `setfarm://internal-production/recovery-source-bootstrap-operation/sha256/${String(operation.operationHash)}`
  ) fail("RECOVERY_SOURCE_BOOTSTRAP_OPERATION_AUTHORITY_CROSSED");
  const { operationRef: _operationRef, operationHash, ...body } = operation;
  const expectedHash = hashCanonicalJson(body);
  if (operationHash !== expectedHash) fail("RECOVERY_SOURCE_BOOTSTRAP_OPERATION_AUTHORITY_CROSSED");
  return Object.freeze({ ...operation }) as InternalProductionRecoverySourceBootstrapRunOperationAuthorityV1;
}

function producer(implementationId: "a-recovery-source-run-v1" | "a-recovery-source-bootstrap-run-v1") {
  const value = INTERNAL_PRODUCTION_OWNER_PRODUCER_ROWS_A_V1.find((candidate) => (
    candidate.implementationId === implementationId
  ));
  if (!value) fail("RECOVERY_SOURCE_BOOTSTRAP_OWNER_PRODUCER_UNAVAILABLE");
  return value;
}

function expectedRunContextV1(
  operation: InternalProductionRecoverySourceBootstrapRunOperationAuthorityV1,
  runId: string,
  operationRunBindingHash: string,
  reciprocalRunOperationBindingHash: string,
): UnknownRowV1 {
  const runOwnerRef = `setfarm://runs/${encodeURIComponent(runId)}`;
  const runOwnerHash = hashCanonicalJson({ schema: "setfarm.internal-production-workflow-run-owner.v1", runId });
  return Object.freeze({
    schema: "setfarm.internal-production-recovery-source-bootstrap-run-context.v1",
    task: RECOVERY_SOURCE_BOOTSTRAP_SOURCE_TASK_V1,
    purpose: operation.purpose,
    repository: operation.repository,
    workflow: operation.workflow,
    protocol: operation.protocol,
    promptManifestHash: operation.promptManifestHash,
    baseSourceSha: operation.baseSourceSha,
    baseSourceTreeHash: operation.baseSourceTreeHash,
    buildHash: operation.buildHash,
    activationPreflightHash: operation.activationPreflightHash,
    releaseAdmissionHash: operation.releaseAdmissionHash,
    pendingInputRef: operation.pendingInputRef,
    pendingInputHash: operation.pendingInputHash,
    startIntentRef: operation.startIntentRef,
    startIntentHash: operation.startIntentHash,
    startOutboxRef: operation.startOutboxRef,
    startOutboxHash: operation.startOutboxHash,
    operationRef: operation.operationRef,
    operationHash: operation.operationHash,
    targetSourceRunReservationRef: operation.targetSourceRunReservationRef,
    targetSourceRunReservationHash: operation.targetSourceRunReservationHash,
    targetRunReservationRef: operation.targetRunReservationRef,
    targetRunReservationHash: operation.targetRunReservationHash,
    targetRunLaunchCompositeHash: operation.targetRunLaunchCompositeHash,
    sourceRunOwnerRef: operation.operationRef,
    sourceRunOwnerHash: operation.operationHash,
    runOwnerRef,
    runOwnerHash,
    operationRunBindingHash,
    reciprocalRunOperationBindingHash,
  });
}

function validateExpectedRunV1(
  operation: InternalProductionRecoverySourceBootstrapRunOperationAuthorityV1,
  expectedRunId: string,
  expectedRun: UnknownRowV1,
): Readonly<{
  workflowState: "running" | "resuming" | "cancelling" | "failing" | "completed" | "failed" | "cancelled";
  operationRunBindingHash: string;
  reciprocalRunOperationBindingHash: string;
}> {
  if (
    expectedRun.state !== undefined
    && expectedRun.status !== undefined
    && expectedRun.state !== expectedRun.status
  ) fail("RECOVERY_SOURCE_BOOTSTRAP_RUN_STATE_ALIAS_CROSSED");
  const workflowState = requireString(expectedRun.state ?? expectedRun.status, "RECOVERY_SOURCE_BOOTSTRAP_RUN_INVALID");
  if (!["running", "resuming", "cancelling", "failing", "completed", "failed", "cancelled"].includes(workflowState)) {
    fail("RECOVERY_SOURCE_BOOTSTRAP_RUN_STATE_INVALID");
  }
  const runId = requireString(expectedRun.runId ?? expectedRun.id, "RECOVERY_SOURCE_BOOTSTRAP_RUN_INVALID");
  let observedRunContext: UnknownRowV1;
  try {
    const context = expectedRun.context ?? expectedRun.runContext;
    observedRunContext = row(typeof context === "string" ? JSON.parse(context) : context, "RECOVERY_SOURCE_BOOTSTRAP_RUN_CONTEXT_INVALID");
  } catch {
    fail("RECOVERY_SOURCE_BOOTSTRAP_RUN_CONTEXT_INVALID");
  }
  const operationRunBindingHash = requireHash(observedRunContext.operationRunBindingHash, "RECOVERY_SOURCE_BOOTSTRAP_RUN_BINDING_INVALID");
  const reciprocalRunOperationBindingHash = requireHash(observedRunContext.reciprocalRunOperationBindingHash, "RECOVERY_SOURCE_BOOTSTRAP_RUN_BINDING_INVALID");
  const expectedRunContext = expectedRunContextV1(operation, expectedRunId, operationRunBindingHash, reciprocalRunOperationBindingHash);
  if (runId !== expectedRunId) fail("RECOVERY_SOURCE_BOOTSTRAP_RUN_ID_CROSSED");
  for (const [key, value] of Object.entries(expectedRunContext)) {
    if (observedRunContext[key] !== value) fail("RECOVERY_SOURCE_BOOTSTRAP_RUN_CONTEXT_CROSSED");
  }
  if (
    expectedRun.workflowId !== "feature-dev"
    || expectedRun.task !== RECOVERY_SOURCE_BOOTSTRAP_SOURCE_TASK_V1
    || expectedRun.notifyUrl !== null
    || expectedRun.protocol !== "v3"
    || expectedRun.protocolVersion !== 1
    || expectedRun.compilerReleaseSha !== operation.baseSourceSha
    || expectedRun.activationPreflightHash !== operation.activationPreflightHash
    || expectedRun.releaseAdmissionHash !== operation.releaseAdmissionHash
  ) fail("RECOVERY_SOURCE_BOOTSTRAP_RUN_AUTHORITY_CROSSED");
  const createdAt = typeof expectedRun.createdAt === "string" ? Date.parse(expectedRun.createdAt) : Number.NaN;
  const updatedAt = typeof expectedRun.updatedAt === "string" ? Date.parse(expectedRun.updatedAt) : Number.NaN;
  if (!Number.isFinite(createdAt) || !Number.isFinite(updatedAt) || createdAt > updatedAt) {
    fail("RECOVERY_SOURCE_BOOTSTRAP_RUN_TIMESTAMP_INVALID");
  }
  const runOwnerRef = `setfarm://runs/${encodeURIComponent(expectedRunId)}`;
  const runOwnerHash = hashCanonicalJson({ schema: "setfarm.internal-production-workflow-run-owner.v1", runId: expectedRunId });
  const expectedOperationRunBindingHash = hashCanonicalJson({
    schema: "setfarm.internal-production-recovery-source-bootstrap-operation-run-binding.v1",
    operationRef: operation.operationRef,
    operationHash: operation.operationHash,
    targetRunLaunchCompositeHash: operation.targetRunLaunchCompositeHash,
    sourceRunReservationRef: operation.targetSourceRunReservationRef,
    sourceRunReservationHash: operation.targetSourceRunReservationHash,
    sourceRunOwnerRef: operation.operationRef,
    sourceRunOwnerHash: operation.operationHash,
    runReservationRef: operation.targetRunReservationRef,
    runReservationHash: operation.targetRunReservationHash,
    runId: expectedRunId,
    runOwnerRef,
    runOwnerHash,
  });
  const expectedReciprocalRunOperationBindingHash = hashCanonicalJson({
    schema: "setfarm.internal-production-recovery-source-bootstrap-run-operation-binding.v1",
    runId: expectedRunId,
    runOwnerRef,
    runOwnerHash,
    runReservationRef: operation.targetRunReservationRef,
    runReservationHash: operation.targetRunReservationHash,
    operationRef: operation.operationRef,
    operationHash: operation.operationHash,
    sourceRunOwnerRef: operation.operationRef,
    sourceRunOwnerHash: operation.operationHash,
    sourceRunReservationRef: operation.targetSourceRunReservationRef,
    sourceRunReservationHash: operation.targetSourceRunReservationHash,
    targetRunLaunchCompositeHash: operation.targetRunLaunchCompositeHash,
    operationRunBindingHash: expectedOperationRunBindingHash,
  });
  if (
    operationRunBindingHash !== expectedOperationRunBindingHash
    || reciprocalRunOperationBindingHash !== expectedReciprocalRunOperationBindingHash
  ) fail("RECOVERY_SOURCE_BOOTSTRAP_RUN_BINDING_CROSSED");
  return Object.freeze({
    workflowState: workflowState as "running" | "resuming" | "cancelling" | "failing" | "completed" | "failed" | "cancelled",
    operationRunBindingHash,
    reciprocalRunOperationBindingHash,
  });
}

function authorityKeyV1(authorityRef: unknown, authorityHash: unknown): string {
  return `${requireString(authorityRef, "RECOVERY_SOURCE_BOOTSTRAP_AUTHORITY_REF_INVALID")}\u0000${requireHash(authorityHash, "RECOVERY_SOURCE_BOOTSTRAP_AUTHORITY_HASH_INVALID")}`;
}

function requireAuthorityRowV1(
  authority: UnknownRowV1,
  expected: Readonly<{
    authorityRef: string;
    authorityHash: string;
    authorityKind: "fence" | "reservation" | "binding" | "close" | "release";
    phaseKey: string;
    predecessorHeadHash: string | null;
    successorHeadHash: string;
    authorityBody: unknown;
  }>,
): void {
  if (
    authority.authorityRef !== expected.authorityRef
    || authority.authorityHash !== expected.authorityHash
    || authority.authorityKind !== expected.authorityKind
    || authority.phaseKey !== expected.phaseKey
    || authority.predecessorHeadHash !== expected.predecessorHeadHash
    || authority.successorHeadHash !== expected.successorHeadHash
    || !same(authority.authorityBody, expected.authorityBody)
  ) fail("RECOVERY_SOURCE_BOOTSTRAP_AUTHORITY_BODY_EDGE_CROSSED");
}

function requireReservationRowV1(
  reservationRow: UnknownRowV1,
  reservation: ReturnType<typeof validateInternalProductionOwnerReservationV1>,
  expectedState: "pending" | "bound" | "closed",
  reservationAuthority: UnknownRowV1,
): void {
  if (
    reservationRow.category !== reservation.category
    || reservationRow.state !== expectedState
    || reservationRow.ownerKey !== reservation.ownerKey
    || reservationRow.ownerKeyHash !== reservation.ownerKeyHash
    || reservationRow.producerPurposeHash !== reservation.producerPurposeHash
    || reservationRow.producerImplementationId !== reservation.producerImplementationId
    || reservationRow.producerImplementationHash !== reservation.producerImplementationHash
    || reservationRow.reservationHeadPredecessorHash !== reservation.ownerAdmissionHeadPredecessorHash
    || reservationRow.reservationRef !== reservation.reservationRef
    || reservationRow.reservationHash !== reservation.reservationHash
    || !same(reservationRow.reservationBody, reservation)
    || reservationRow.authorityRef !== reservationAuthority.authorityRef
    || reservationRow.authorityHash !== reservationAuthority.authorityHash
    || reservationRow.authorityKind !== reservationAuthority.authorityKind
    || reservationRow.phaseKey !== reservationAuthority.phaseKey
    || reservationRow.authorityPredecessorHeadHash !== reservationAuthority.predecessorHeadHash
    || reservationRow.authoritySuccessorHeadHash !== reservationAuthority.successorHeadHash
    || !same(reservationRow.authorityBody, reservationAuthority.authorityBody)
  ) fail("RECOVERY_SOURCE_BOOTSTRAP_RESERVATION_ROW_CROSSED");
}

function validateHeadV1(
  value: unknown,
  expectedVersion: 1 | 2 | 3 | 4,
): UnknownRowV1 {
  const head = row(value, "RECOVERY_SOURCE_BOOTSTRAP_HEAD_HISTORY_INVALID");
  const headPayload = row(head.headPayload, "RECOVERY_SOURCE_BOOTSTRAP_HEAD_PAYLOAD_INVALID");
  const migrationApplication = row(headPayload.migrationApplication, "RECOVERY_SOURCE_BOOTSTRAP_HEAD_MIGRATION_INVALID");
  exactKeys(migrationApplication, [
    "schema", "evidenceHash", "authorizationRef", "authorizationHash",
    "authorizationConsumptionRef", "authorizationConsumptionHash", "applicationHash",
  ], "RECOVERY_SOURCE_BOOTSTRAP_HEAD_MIGRATION_INVALID");
  const migrationApplicationBody = {
    schema: migrationApplication.schema,
    evidenceHash: migrationApplication.evidenceHash,
    authorizationRef: migrationApplication.authorizationRef,
    authorizationHash: migrationApplication.authorizationHash,
    authorizationConsumptionRef: migrationApplication.authorizationConsumptionRef,
    authorizationConsumptionHash: migrationApplication.authorizationConsumptionHash,
  };
  if (
    head.headVersion !== expectedVersion
    || headPayload.schema !== "setfarm.internal-production-owner-admission-head.v1"
    || headPayload.version !== expectedVersion
    || head.headHash !== hashCanonicalJson(headPayload)
    || migrationApplication.schema !== "setfarm.bootstrap-main-claim-handoff-guarded-migration-32-application.v1"
    || head.migrationApplicationEvidenceHash !== migrationApplication.evidenceHash
    || !SHA256_V1.test(String(migrationApplication.evidenceHash))
    || migrationApplication.evidenceHash === "0".repeat(64)
    || !CANONICAL_REF_V1.test(String(migrationApplication.authorizationRef))
    || !SHA256_V1.test(String(migrationApplication.authorizationHash))
    || !CANONICAL_REF_V1.test(String(migrationApplication.authorizationConsumptionRef))
    || !SHA256_V1.test(String(migrationApplication.authorizationConsumptionHash))
    || !SHA256_V1.test(String(migrationApplication.applicationHash))
    || migrationApplication.applicationHash !== hashCanonicalJson(migrationApplicationBody)
  ) fail("RECOVERY_SOURCE_BOOTSTRAP_HEAD_HISTORY_CROSSED");
  return head;
}

export function requireExactInternalProductionRecoverySourceBootstrapRunPersistenceV1(
  input: Readonly<{
    recoveryState: string;
    recoveryOperationAuthority: InternalProductionRecoverySourceBootstrapRunOperationAuthorityV1;
    ownerRows: readonly UnknownRowV1[];
    reservationRows: readonly UnknownRowV1[];
    expectedRunRows: readonly UnknownRowV1[];
    activeRunRows: readonly UnknownRowV1[];
  }>,
): InternalProductionRecoverySourceBootstrapRunPersistenceV1 {
  const operation = createInternalProductionRecoverySourceBootstrapRunOperationAuthorityV1(input.recoveryOperationAuthority);
  if (input.recoveryState !== "prepared" && input.recoveryState !== "terminal") {
    fail("RECOVERY_SOURCE_BOOTSTRAP_RECOVERY_STATE_INVALID");
  }
  const expectedRunId = hashCanonicalJson({
    schema: "setfarm.internal-production-recovery-source-bootstrap-run-owner-key.v1",
    pendingInputRef: operation.pendingInputRef,
    pendingInputHash: operation.pendingInputHash,
  });
  if (input.ownerRows.length !== 1) fail("RECOVERY_SOURCE_BOOTSTRAP_OWNER_INVENTORY_INVALID");
  const owner = row(input.ownerRows[0], "RECOVERY_SOURCE_BOOTSTRAP_OWNER_INVENTORY_INVALID");
  if (owner.unrelatedAuthorityCount !== 0) fail("RECOVERY_SOURCE_BOOTSTRAP_UNRELATED_AUTHORITY_OWNER_RUN");
  const allAuthorityRows = Array.isArray(owner.allAuthorityRows)
    ? owner.allAuthorityRows.map((value) => row(value, "RECOVERY_SOURCE_BOOTSTRAP_AUTHORITY_INVALID"))
    : fail("RECOVERY_SOURCE_BOOTSTRAP_AUTHORITY_INVALID");
  const authorityRowsByKey = new Map<string, UnknownRowV1>();
  for (const authority of allAuthorityRows) {
    const key = authorityKeyV1(authority.authorityRef, authority.authorityHash);
    if (authorityRowsByKey.has(key)) fail("RECOVERY_SOURCE_BOOTSTRAP_AUTHORITY_DUPLICATE");
    authorityRowsByKey.set(key, authority);
  }
  const sourceProducer = producer("a-recovery-source-run-v1");
  const runProducer = producer("a-recovery-source-bootstrap-run-v1");
  const reservations = input.reservationRows.map((value) => row(value, "RECOVERY_SOURCE_BOOTSTRAP_RESERVATION_INVALID"));
  const sourceRow = reservations.find((value) => value.reservationRef === operation.targetSourceRunReservationRef && value.reservationHash === operation.targetSourceRunReservationHash);
  const runRow = reservations.find((value) => value.reservationRef === operation.targetRunReservationRef && value.reservationHash === operation.targetRunReservationHash);
  if (!sourceRow || !runRow || sourceRow === runRow) fail("RECOVERY_SOURCE_BOOTSTRAP_RESERVATION_MISSING");
  const sourceReservation = validateInternalProductionOwnerReservationV1(sourceRow.reservationBody, sourceProducer);
  const runReservation = validateInternalProductionOwnerReservationV1(runRow.reservationBody, runProducer);
  const expectedSourceOwnerKey = hashCanonicalJson({
    schema: "setfarm.internal-production-recovery-source-run-owner-key.v1",
    pendingInputRef: operation.pendingInputRef,
    pendingInputHash: operation.pendingInputHash,
  });
  if (
    sourceReservation.category !== "source-run"
    || sourceReservation.producerImplementationId !== "a-recovery-source-run-v1"
    || sourceReservation.ownerKey !== expectedSourceOwnerKey
    || sourceReservation.reservationRef !== operation.targetSourceRunReservationRef
    || sourceReservation.reservationHash !== operation.targetSourceRunReservationHash
    || runReservation.category !== "run"
    || runReservation.producerImplementationId !== "a-recovery-source-bootstrap-run-v1"
    || runReservation.ownerKey !== expectedRunId
    || runReservation.reservationRef !== operation.targetRunReservationRef
    || runReservation.reservationHash !== operation.targetRunReservationHash
  ) fail("RECOVERY_SOURCE_BOOTSTRAP_RESERVATION_CROSSED");

  const preparedPending = sourceRow.state === "pending" && runRow.state === "pending";
  const preparedBound = sourceRow.state === "bound" && runRow.state === "bound";
  const terminalClosed = sourceRow.state === "closed" && runRow.state === "closed";
  if (![preparedPending, preparedBound, terminalClosed].some(Boolean)) fail("RECOVERY_SOURCE_BOOTSTRAP_RESERVATION_STATE_CROSSED");
  if ((!terminalClosed && input.recoveryState !== "prepared") || (terminalClosed && !["prepared", "terminal"].includes(input.recoveryState))) {
    fail("RECOVERY_SOURCE_BOOTSTRAP_RECOVERY_STATE_PHASE_CROSSED");
  }

  const expectedAuthority = new Set<string>();
  const headHistory = Array.isArray(owner.headHistory)
    ? owner.headHistory.map((value) => row(value, "RECOVERY_SOURCE_BOOTSTRAP_HEAD_HISTORY_INVALID"))
    : fail("RECOVERY_SOURCE_BOOTSTRAP_HEAD_HISTORY_INVALID");
  const authorityHistory = Array.isArray(owner.authorityHistory)
    ? owner.authorityHistory.map((value) => row(value, "RECOVERY_SOURCE_BOOTSTRAP_AUTHORITY_HISTORY_INVALID"))
    : fail("RECOVERY_SOURCE_BOOTSTRAP_AUTHORITY_HISTORY_INVALID");
  const pairClosed = terminalClosed && headHistory.length === 3;
  const terminalReleased = terminalClosed && headHistory.length === 4;
  if (terminalClosed && !pairClosed && !terminalReleased) fail("RECOVERY_SOURCE_BOOTSTRAP_CLOSED_HISTORY_INVALID");
  if (pairClosed && input.recoveryState !== "prepared") fail("RECOVERY_SOURCE_BOOTSTRAP_RECOVERY_STATE_PHASE_CROSSED");
  const h1 = validateHeadV1(headHistory[0], 1);
  const h1Payload = row(h1.headPayload, "RECOVERY_SOURCE_BOOTSTRAP_HEAD_PAYLOAD_INVALID");
  const h1Hash = requireHash(h1.headHash, "RECOVERY_SOURCE_BOOTSTRAP_H1_INVALID");
  const fenceAuthority = authorityRowsByKey.get(authorityKeyV1(operation.ownerAdmissionFenceRef, operation.ownerAdmissionFenceHash));
  if (!fenceAuthority) fail("RECOVERY_SOURCE_BOOTSTRAP_FENCE_AUTHORITY_MISSING");
  const fence = validateInternalProductionGlobalOwnerAdmissionFenceV1(fenceAuthority.authorityBody);
  if (
    fence.purpose !== operation.purpose
    || fence.pendingInputRef !== operation.pendingInputRef
    || fence.pendingInputHash !== operation.pendingInputHash
    || fence.fenceRef !== operation.ownerAdmissionFenceRef
    || fence.fenceHash !== operation.ownerAdmissionFenceHash
    || fence.predecessorFenceHeadHash !== "0".repeat(64)
    || fence.ownerAdmissionHeadHash !== h1Hash
    || fence.targetFamily.kind !== "source-run-launch"
    || fence.targetFamily.targetRunLaunchCompositeHash !== operation.targetRunLaunchCompositeHash
    || !same(fence.targetFamily.sourceRunReservation, {
      category: sourceReservation.category,
      producerImplementationId: sourceReservation.producerImplementationId,
      ownerKeyHash: sourceReservation.ownerKeyHash,
      reservationRef: sourceReservation.reservationRef,
      reservationHash: sourceReservation.reservationHash,
    })
    || !same(fence.targetFamily.runReservation, {
      category: runReservation.category,
      producerImplementationId: runReservation.producerImplementationId,
      ownerKeyHash: runReservation.ownerKeyHash,
      reservationRef: runReservation.reservationRef,
      reservationHash: runReservation.reservationHash,
    })
  ) fail("RECOVERY_SOURCE_BOOTSTRAP_FENCE_CROSSED");
  if (
    sourceReservation.ownerAdmissionHeadPredecessorHash !== fence.predecessorFenceHeadHash
    || runReservation.ownerAdmissionHeadPredecessorHash !== fence.predecessorFenceHeadHash
  ) fail("RECOVERY_SOURCE_BOOTSTRAP_RESERVATION_HEAD_CROSSED");
  requireAuthorityRowV1(fenceAuthority, {
    authorityRef: fence.fenceRef,
    authorityHash: fence.fenceHash,
    authorityKind: "fence",
    phaseKey: fence.pendingInputRef,
    predecessorHeadHash: fence.predecessorFenceHeadHash,
    successorHeadHash: h1Hash,
    authorityBody: fence,
  });
  expectedAuthority.add(authorityKeyV1(fence.fenceRef, fence.fenceHash));
  const h1TransitionHash = hashCanonicalJson({
    schema: "setfarm.internal-production-global-owner-admission-fence-transition.v1",
    purpose: fence.purpose,
    pendingInputRef: fence.pendingInputRef,
    pendingInputHash: fence.pendingInputHash,
    targetFamilyHash: fence.targetFamily.targetFamilyHash,
    ownerIdentitySetHash: fence.ownerIdentitySetHash,
  });
  if (
    h1Payload.predecessorHeadHash !== fence.predecessorFenceHeadHash
    || h1Payload.transitionKind !== "fence"
    || h1Payload.transitionHash !== h1TransitionHash
    || h1Payload.transitionRef !== `setfarm://internal-production/global-owner-admission-fence-transition/sha256/${h1TransitionHash}`
    || h1.activeFenceRef !== fence.fenceRef
    || h1.activeFenceHash !== fence.fenceHash
    || h1.activeTargetFamilyHash !== fence.targetFamily.targetFamilyHash
  ) fail("RECOVERY_SOURCE_BOOTSTRAP_H1_CROSSED");

  const sourceReservationAuthority = authorityRowsByKey.get(authorityKeyV1(sourceReservation.reservationRef, sourceReservation.reservationHash));
  const runReservationAuthority = authorityRowsByKey.get(authorityKeyV1(runReservation.reservationRef, runReservation.reservationHash));
  if (!sourceReservationAuthority || !runReservationAuthority) fail("RECOVERY_SOURCE_BOOTSTRAP_RESERVATION_AUTHORITY_MISSING");
  for (const [reservation, reservationAuthority] of [
    [sourceReservation, sourceReservationAuthority],
    [runReservation, runReservationAuthority],
  ] as const) {
    requireAuthorityRowV1(reservationAuthority, {
      authorityRef: reservation.reservationRef,
      authorityHash: reservation.reservationHash,
      authorityKind: "reservation",
      phaseKey: reservation.reservationRef,
      predecessorHeadHash: reservation.ownerAdmissionHeadPredecessorHash,
      successorHeadHash: h1Hash,
      authorityBody: reservation,
    });
    expectedAuthority.add(authorityKeyV1(reservation.reservationRef, reservation.reservationHash));
  }
  requireReservationRowV1(sourceRow, sourceReservation, sourceRow.state as "pending" | "bound" | "closed", sourceReservationAuthority);
  requireReservationRowV1(runRow, runReservation, runRow.state as "pending" | "bound" | "closed", runReservationAuthority);

  const validateBinding = (reservationRow: UnknownRowV1, category: "source-run" | "run") => {
    const validatedBound = validateInternalProductionBoundOwnerReservationV1(reservationRow.bindingBody);
    const expectedIdentity = category === "source-run" ? Object.freeze({
      schema: "setfarm.internal-production-canonical-owner-identity.v1",
      category,
      ownerKey: sourceReservation.ownerKey,
      ownerRef: operation.operationRef,
      ownerHash: operation.operationHash,
    }) : Object.freeze({
      schema: "setfarm.internal-production-canonical-owner-identity.v1",
      category,
      ownerKey: expectedRunId,
      ownerRef: `setfarm://runs/${encodeURIComponent(expectedRunId)}`,
      ownerHash: hashCanonicalJson({ schema: "setfarm.internal-production-workflow-run-owner.v1", runId: expectedRunId }),
    });
    if (
      validatedBound.category !== category
      || validatedBound.producerImplementationId !== (category === "source-run" ? "a-recovery-source-run-v1" : "a-recovery-source-bootstrap-run-v1")
      || validatedBound.reservationRef !== reservationRow.reservationRef
      || validatedBound.reservationHash !== reservationRow.reservationHash
      || !same(validatedBound.canonicalOwnerIdentity, expectedIdentity)
      || reservationRow.bindingHash !== validatedBound.bindingHash
      || !same(reservationRow.canonicalOwnerIdentity, expectedIdentity)
    ) fail("RECOVERY_SOURCE_BOOTSTRAP_BOUND_OWNER_CROSSED");
    const authorityRef = `setfarm://internal-production/bound-owner-reservations/${validatedBound.bindingHash}`;
    const authority = authorityRowsByKey.get(authorityKeyV1(authorityRef, validatedBound.bindingHash));
    if (!authority) fail("RECOVERY_SOURCE_BOOTSTRAP_BINDING_AUTHORITY_MISSING");
    requireAuthorityRowV1(authority, {
      authorityRef,
      authorityHash: validatedBound.bindingHash,
      authorityKind: "binding",
      phaseKey: validatedBound.reservationRef,
      predecessorHeadHash: h1Hash,
      successorHeadHash: h1Hash,
      authorityBody: validatedBound,
    });
    if (
      reservationRow.bindingHash !== validatedBound.bindingHash
      || !same(reservationRow.bindingBody, validatedBound)
    ) fail("RECOVERY_SOURCE_BOOTSTRAP_BOUND_ROW_CROSSED");
    expectedAuthority.add(authorityKeyV1(authorityRef, validatedBound.bindingHash));
    return validatedBound;
  };
  let sourceBound: ReturnType<typeof validateInternalProductionBoundOwnerReservationV1> | null = null;
  let runBound: ReturnType<typeof validateInternalProductionBoundOwnerReservationV1> | null = null;
  if (preparedBound || terminalClosed) {
    sourceBound = validateBinding(sourceRow, "source-run");
    runBound = validateBinding(runRow, "run");
  }

  let pairClosedAuthority: Readonly<{
    terminalOwnerRef: string;
    terminalOwnerHash: string;
    terminalSourceRunRef: string;
    terminalSourceRunHash: string;
    terminalRunLaunchRef: string;
    terminalRunLaunchHash: string;
    targetReservationPairClose: InternalProductionSourceRunLaunchTargetReservationPairCloseV1;
  }> | null = null;
  let releasedAuthority: Readonly<{
    terminalOwnerRef: string;
    terminalOwnerHash: string;
    terminalSourceRunRef: string;
    terminalSourceRunHash: string;
    terminalRunLaunchRef: string;
    terminalRunLaunchHash: string;
    targetReservationPairCloseRef: string;
    targetReservationPairCloseHash: string;
    fenceReleaseRef: string;
    fenceReleaseHash: string;
    sourceRunRef: string;
    sourceRunHash: string;
  }> | null = null;
  if (terminalClosed) {
    if ((headHistory.length !== 3 && headHistory.length !== 4) || sourceBound === null || runBound === null) {
      fail("RECOVERY_SOURCE_BOOTSTRAP_CLOSED_HISTORY_INVALID");
    }
    const h2 = validateHeadV1(headHistory[1], 2);
    const h3 = validateHeadV1(headHistory[2], 3);
    const h4 = terminalReleased ? validateHeadV1(headHistory[3], 4) : null;
    const h2Hash = requireHash(h2.headHash, "RECOVERY_SOURCE_BOOTSTRAP_H2_INVALID");
    const h3Hash = requireHash(h3.headHash, "RECOVERY_SOURCE_BOOTSTRAP_H3_INVALID");
    const h4Hash = h4 === null ? null : requireHash(h4.headHash, "RECOVERY_SOURCE_BOOTSTRAP_H4_INVALID");
    const h1MigrationApplication = row(h1Payload.migrationApplication, "RECOVERY_SOURCE_BOOTSTRAP_HEAD_MIGRATION_INVALID");
    if (headHistory.some((head) => (
      head.migrationApplicationEvidenceHash !== h1.migrationApplicationEvidenceHash
      || !same(row(head.headPayload, "RECOVERY_SOURCE_BOOTSTRAP_HEAD_PAYLOAD_INVALID").migrationApplication, h1MigrationApplication)
    ))) fail("RECOVERY_SOURCE_BOOTSTRAP_HEAD_MIGRATION_CROSSED");
    const sourceClose = validateInternalProductionOwnerReservationCloseV1(sourceRow.closeBody);
    const runClose = validateInternalProductionOwnerReservationCloseV1(runRow.closeBody);
    if (
      sourceClose.closeKind !== "fence-target"
      || sourceClose.reservationRef !== sourceReservation.reservationRef
      || sourceClose.reservationHash !== sourceReservation.reservationHash
      || sourceClose.ownerAdmissionHeadPredecessorHash !== h1Hash
      || sourceClose.ownerAdmissionHeadSuccessorHash !== h2Hash
      || sourceClose.preservedFenceRef !== fence.fenceRef
      || sourceClose.preservedFenceHash !== fence.fenceHash
      || runClose.closeKind !== "fence-target"
      || runClose.reservationRef !== runReservation.reservationRef
      || runClose.reservationHash !== runReservation.reservationHash
      || runClose.ownerAdmissionHeadPredecessorHash !== h2Hash
      || runClose.ownerAdmissionHeadSuccessorHash !== h3Hash
      || runClose.preservedFenceRef !== fence.fenceRef
      || runClose.preservedFenceHash !== fence.fenceHash
    ) fail("RECOVERY_SOURCE_BOOTSTRAP_CLOSE_CROSSED");
    for (const [reservationRow, close, expectedHeadVersion] of [
      [sourceRow, sourceClose, 2],
      [runRow, runClose, 3],
    ] as const) {
      if (
        reservationRow.closeKind !== close.closeKind
        || reservationRow.terminalOwnerRef !== close.terminalOwnerRef
        || reservationRow.terminalOwnerHash !== close.terminalOwnerHash
        || reservationRow.closeHeadPredecessorHash !== close.ownerAdmissionHeadPredecessorHash
        || reservationRow.closeHeadSuccessorHash !== close.ownerAdmissionHeadSuccessorHash
        || reservationRow.preservedFenceRef !== close.preservedFenceRef
        || reservationRow.preservedFenceHash !== close.preservedFenceHash
        || reservationRow.closeRef !== close.closeRef
        || reservationRow.closeHash !== close.closeHash
        || reservationRow.headVersion !== expectedHeadVersion
        || !same(reservationRow.closeBody, close)
      ) fail("RECOVERY_SOURCE_BOOTSTRAP_CLOSE_ROW_CROSSED");
      const closeAuthority = authorityRowsByKey.get(authorityKeyV1(close.closeRef, close.closeHash));
      if (!closeAuthority) fail("RECOVERY_SOURCE_BOOTSTRAP_CLOSE_AUTHORITY_MISSING");
      requireAuthorityRowV1(closeAuthority, {
        authorityRef: close.closeRef,
        authorityHash: close.closeHash,
        authorityKind: "close",
        phaseKey: close.reservationRef,
        predecessorHeadHash: close.ownerAdmissionHeadPredecessorHash,
        successorHeadHash: close.ownerAdmissionHeadSuccessorHash,
        authorityBody: close,
      });
      if (!same(reservationRow.closeAuthority, closeAuthority)) fail("RECOVERY_SOURCE_BOOTSTRAP_CLOSE_AUTHORITY_CROSSED");
      expectedAuthority.add(authorityKeyV1(close.closeRef, close.closeHash));
    }
    const sourceTransitionHash = hashCanonicalJson({
      schema: "setfarm.internal-production-owner-reservation-close-transition.v1",
      reservationRef: sourceClose.reservationRef,
      reservationHash: sourceClose.reservationHash,
      terminalOwnerRef: sourceClose.terminalOwnerRef,
      terminalOwnerHash: sourceClose.terminalOwnerHash,
    });
    const runTransitionHash = hashCanonicalJson({
      schema: "setfarm.internal-production-owner-reservation-close-transition.v1",
      reservationRef: runClose.reservationRef,
      reservationHash: runClose.reservationHash,
      terminalOwnerRef: runClose.terminalOwnerRef,
      terminalOwnerHash: runClose.terminalOwnerHash,
    });
    const h2Payload = row(h2.headPayload, "RECOVERY_SOURCE_BOOTSTRAP_H2_INVALID");
    const h3Payload = row(h3.headPayload, "RECOVERY_SOURCE_BOOTSTRAP_H3_INVALID");
    if (
      h2Payload.predecessorHeadHash !== h1Hash
      || h2Payload.transitionKind !== "close"
      || h2Payload.transitionHash !== sourceTransitionHash
      || h2Payload.transitionRef !== `setfarm://internal-production/owner-reservation-close-transitions/${sourceTransitionHash}`
      || h3Payload.predecessorHeadHash !== h2Hash
      || h3Payload.transitionKind !== "close"
      || h3Payload.transitionHash !== runTransitionHash
      || h3Payload.transitionRef !== `setfarm://internal-production/owner-reservation-close-transitions/${runTransitionHash}`
      || h2.activeFenceRef !== fence.fenceRef
      || h2.activeFenceHash !== fence.fenceHash
      || h3.activeFenceRef !== fence.fenceRef
      || h3.activeFenceHash !== fence.fenceHash
      || h2.activeTargetFamilyHash !== fence.targetFamily.targetFamilyHash
      || h3.activeTargetFamilyHash !== fence.targetFamily.targetFamilyHash
    ) fail("RECOVERY_SOURCE_BOOTSTRAP_CLOSE_HEAD_CROSSED");

    const pairCloseProjection = {
      schema: "setfarm.internal-production-source-run-launch-target-reservation-pair-close.v1" as const,
      fenceRef: fence.fenceRef,
      fenceHash: fence.fenceHash,
      targetRunLaunchCompositeHash: operation.targetRunLaunchCompositeHash,
      sourceRunReservationRef: sourceReservation.reservationRef,
      sourceRunReservationHash: sourceReservation.reservationHash,
      runReservationRef: runReservation.reservationRef,
      runReservationHash: runReservation.reservationHash,
      terminalSourceRunRef: sourceClose.terminalOwnerRef,
      terminalSourceRunHash: sourceClose.terminalOwnerHash,
      terminalRunLaunchRef: runClose.terminalOwnerRef,
      terminalRunLaunchHash: runClose.terminalOwnerHash,
      ownerAdmissionHeadPredecessorHash: h1Hash,
      ownerAdmissionHeadSuccessorHash: h3Hash,
      preservedFenceRef: fence.fenceRef,
      preservedFenceHash: fence.fenceHash,
    };
    const targetReservationPairCloseHash = hashCanonicalJson(pairCloseProjection);
    const pairClose = validateInternalProductionSourceRunLaunchTargetReservationPairCloseV1({
      schema: pairCloseProjection.schema,
      fenceRef: pairCloseProjection.fenceRef,
      fenceHash: pairCloseProjection.fenceHash,
      targetRunLaunchCompositeHash: pairCloseProjection.targetRunLaunchCompositeHash,
      sourceRunReservationRef: pairCloseProjection.sourceRunReservationRef,
      sourceRunReservationHash: pairCloseProjection.sourceRunReservationHash,
      runReservationRef: pairCloseProjection.runReservationRef,
      runReservationHash: pairCloseProjection.runReservationHash,
      terminalSourceRunRef: pairCloseProjection.terminalSourceRunRef,
      terminalSourceRunHash: pairCloseProjection.terminalSourceRunHash,
      terminalRunLaunchRef: pairCloseProjection.terminalRunLaunchRef,
      terminalRunLaunchHash: pairCloseProjection.terminalRunLaunchHash,
      ownerAdmissionHeadPredecessorHash: pairCloseProjection.ownerAdmissionHeadPredecessorHash,
      ownerAdmissionHeadSuccessorHash: pairCloseProjection.ownerAdmissionHeadSuccessorHash,
      preservedFenceRef: pairCloseProjection.preservedFenceRef,
      preservedFenceHash: pairCloseProjection.preservedFenceHash,
      targetReservationPairCloseRef: `setfarm://internal-production/source-run-launch-target-reservation-pair-close/sha256/${targetReservationPairCloseHash}`,
      targetReservationPairCloseHash,
    });
    let release: ReturnType<typeof validateInternalProductionGlobalOwnerAdmissionFenceReleaseV1> | null = null;
    if (terminalReleased) {
      if (h4 === null || h4Hash === null) fail("RECOVERY_SOURCE_BOOTSTRAP_H4_HISTORY_INVALID");
      const releaseAuthorityRow = allAuthorityRows.find((candidate) => candidate.authorityKind === "release");
      if (!releaseAuthorityRow) fail("RECOVERY_SOURCE_BOOTSTRAP_RELEASE_AUTHORITY_MISSING");
      release = validateInternalProductionGlobalOwnerAdmissionFenceReleaseV1(releaseAuthorityRow.authorityBody);
      const releaseAuthority = row(release.releaseAuthority, "RECOVERY_SOURCE_BOOTSTRAP_RELEASE_AUTHORITY_INVALID");
      if (
        release.fenceRef !== fence.fenceRef
        || release.fenceHash !== fence.fenceHash
        || release.ownerAdmissionHeadPredecessorHash !== h3Hash
        || release.ownerAdmissionHeadSuccessorHash !== h4Hash
        || releaseAuthority.purpose !== "recovery-d-source-delivery-v1"
        || releaseAuthority.targetFamilyKind !== "source-run-launch"
        || releaseAuthority.targetReservationPairCloseRef !== pairClose.targetReservationPairCloseRef
        || releaseAuthority.targetReservationPairCloseHash !== pairClose.targetReservationPairCloseHash
      ) fail("RECOVERY_SOURCE_BOOTSTRAP_RELEASE_CROSSED");
      requireAuthorityRowV1(releaseAuthorityRow, {
        authorityRef: release.releaseRef,
        authorityHash: release.releaseHash,
        authorityKind: "release",
        phaseKey: fence.fenceRef,
        predecessorHeadHash: h3Hash,
        successorHeadHash: h4Hash,
        authorityBody: release,
      });
      expectedAuthority.add(authorityKeyV1(release.releaseRef, release.releaseHash));
      const h4Payload = row(h4.headPayload, "RECOVERY_SOURCE_BOOTSTRAP_H4_INVALID");
      const releaseTransitionHash = hashCanonicalJson({
        schema: "setfarm.internal-production-global-owner-admission-fence-release-transition.v1",
        fenceRef: fence.fenceRef,
        fenceHash: fence.fenceHash,
        releaseAuthority: release.releaseAuthority,
      });
      if (
        h4Payload.predecessorHeadHash !== h3Hash
        || h4Payload.transitionKind !== "release"
        || h4Payload.transitionHash !== releaseTransitionHash
        || h4Payload.transitionRef !== `setfarm://internal-production/global-owner-admission-fence-release-transition/sha256/${releaseTransitionHash}`
        || h4.activeFenceRef !== null
        || h4.activeFenceHash !== null
        || h4.activeTargetFamilyHash !== null
      ) fail("RECOVERY_SOURCE_BOOTSTRAP_H4_CROSSED");
    } else if (allAuthorityRows.some((candidate) => candidate.authorityKind === "release")) {
      fail("RECOVERY_SOURCE_BOOTSTRAP_H3_RELEASE_AUTHORITY_INVALID");
    }

    const validatedRunForTerminal = input.expectedRunRows.length === 1
      ? validateExpectedRunV1(operation, expectedRunId, row(input.expectedRunRows[0], "RECOVERY_SOURCE_BOOTSTRAP_BOUND_RUN_INVALID"))
      : fail("RECOVERY_SOURCE_BOOTSTRAP_BOUND_RUN_MISSING");
    const exactTerminalOwnerHash = hashCanonicalJson({
      schema: "setfarm.internal-production-recovery-source-run-terminal-owner.v1",
      operationRef: operation.operationRef,
      operationHash: operation.operationHash,
      runId: expectedRunId,
      operationRunBindingHash: validatedRunForTerminal.operationRunBindingHash,
      reciprocalRunOperationBindingHash: validatedRunForTerminal.reciprocalRunOperationBindingHash,
    });
    const terminalOwnerRef = `setfarm://internal-production/recovery-source-run-terminal-owner/sha256/${exactTerminalOwnerHash}`;
    pairClosedAuthority = Object.freeze({
      terminalOwnerRef,
      terminalOwnerHash: exactTerminalOwnerHash,
      terminalSourceRunRef: pairClose.terminalSourceRunRef,
      terminalSourceRunHash: pairClose.terminalSourceRunHash,
      terminalRunLaunchRef: pairClose.terminalRunLaunchRef,
      terminalRunLaunchHash: pairClose.terminalRunLaunchHash,
      targetReservationPairClose: pairClose,
    });
    if (release !== null) {
      const receiptBody = {
      schema: "setfarm.internal-production-recovery-source-bootstrap-run-receipt.v1" as const,
      purpose: operation.purpose,
      pendingInputRef: operation.pendingInputRef,
      pendingInputHash: operation.pendingInputHash,
      operationRef: operation.operationRef,
      operationHash: operation.operationHash,
      targetSourceRunReservationRef: operation.targetSourceRunReservationRef,
      targetSourceRunReservationHash: operation.targetSourceRunReservationHash,
      targetRunReservationRef: operation.targetRunReservationRef,
      targetRunReservationHash: operation.targetRunReservationHash,
      targetRunLaunchCompositeHash: operation.targetRunLaunchCompositeHash,
      ownerAdmissionFenceRef: operation.ownerAdmissionFenceRef,
      ownerAdmissionFenceHash: operation.ownerAdmissionFenceHash,
      startIntentRef: operation.startIntentRef,
      startIntentHash: operation.startIntentHash,
      startOutboxRef: operation.startOutboxRef,
      startOutboxHash: operation.startOutboxHash,
      runId: expectedRunId,
      operationRunBindingHash: validatedRunForTerminal.operationRunBindingHash,
      reciprocalRunOperationBindingHash: validatedRunForTerminal.reciprocalRunOperationBindingHash,
      terminalOwnerRef,
      terminalOwnerHash: exactTerminalOwnerHash,
      terminalSourceRunRef: pairClose.terminalSourceRunRef,
      terminalSourceRunHash: pairClose.terminalSourceRunHash,
      terminalRunLaunchRef: pairClose.terminalRunLaunchRef,
      terminalRunLaunchHash: pairClose.terminalRunLaunchHash,
      targetReservationPairCloseRef: pairClose.targetReservationPairCloseRef,
      targetReservationPairCloseHash: pairClose.targetReservationPairCloseHash,
      fenceReleaseRef: release.releaseRef,
      fenceReleaseHash: release.releaseHash,
      };
      const sourceRunHash = hashCanonicalJson(receiptBody);
      releasedAuthority = Object.freeze({
        terminalOwnerRef,
        terminalOwnerHash: exactTerminalOwnerHash,
        terminalSourceRunRef: pairClose.terminalSourceRunRef,
        terminalSourceRunHash: pairClose.terminalSourceRunHash,
        terminalRunLaunchRef: pairClose.terminalRunLaunchRef,
        terminalRunLaunchHash: pairClose.terminalRunLaunchHash,
        targetReservationPairCloseRef: pairClose.targetReservationPairCloseRef,
        targetReservationPairCloseHash: pairClose.targetReservationPairCloseHash,
        fenceReleaseRef: release.releaseRef,
        fenceReleaseHash: release.releaseHash,
        sourceRunRef: `setfarm://internal-production/recovery-source-bootstrap-run-receipt/sha256/${sourceRunHash}`,
        sourceRunHash,
      });
    }
  } else {
    if (headHistory.length !== 1) fail("RECOVERY_SOURCE_BOOTSTRAP_H1_HISTORY_INVALID");
    if (
      owner.activeFenceCount !== 1
      || owner.activeFenceRef !== fence.fenceRef
      || owner.activeFenceHash !== fence.fenceHash
      || !same(owner.activeFenceBody, fence)
    ) fail("RECOVERY_SOURCE_BOOTSTRAP_H1_ACTIVE_FENCE_CROSSED");
  }

  const terminalHead = headHistory[headHistory.length - 1]!;
  if (
    owner.headVersion !== terminalHead.headVersion
    || owner.headHash !== terminalHead.headHash
    || owner.headActiveFenceRef !== terminalHead.activeFenceRef
    || owner.headActiveFenceHash !== terminalHead.activeFenceHash
    || owner.activeTargetFamilyHash !== terminalHead.activeTargetFamilyHash
    || owner.migrationApplicationEvidenceHash !== terminalHead.migrationApplicationEvidenceHash
    || !same(owner.headPayload, terminalHead.headPayload)
  ) fail("RECOVERY_SOURCE_BOOTSTRAP_OWNER_HEAD_CROSSED");
  if (terminalClosed) {
    if (terminalReleased) {
      if (owner.activeFenceCount !== 0 || owner.activeFenceRef !== null || owner.activeFenceHash !== null || owner.activeFenceBody !== null) {
        fail("RECOVERY_SOURCE_BOOTSTRAP_H4_ACTIVE_FENCE_INVALID");
      }
    } else if (
      owner.activeFenceCount !== 1
      || owner.activeFenceRef !== fence.fenceRef
      || owner.activeFenceHash !== fence.fenceHash
      || !same(owner.activeFenceBody, fence)
    ) {
      fail("RECOVERY_SOURCE_BOOTSTRAP_H3_ACTIVE_FENCE_INVALID");
    }
    if (pairClosed && (authorityHistory.length !== 5 || allAuthorityRows.length !== 7)) {
      fail("RECOVERY_SOURCE_BOOTSTRAP_H3_AUTHORITY_HISTORY_INVALID");
    }
    if (terminalReleased && (authorityHistory.length !== 6 || allAuthorityRows.length !== 8)) {
      fail("RECOVERY_SOURCE_BOOTSTRAP_H4_AUTHORITY_HISTORY_INVALID");
    }
    const expectedHistory = [
      fenceAuthority,
      sourceReservationAuthority,
      runReservationAuthority,
      authorityRowsByKey.get(authorityKeyV1(sourceRow.closeRef, sourceRow.closeHash)),
      authorityRowsByKey.get(authorityKeyV1(runRow.closeRef, runRow.closeHash)),
      ...(terminalReleased ? [allAuthorityRows.find((candidate) => candidate.authorityKind === "release")] : []),
    ];
    if (expectedHistory.some((value) => value === undefined) || !same(authorityHistory, expectedHistory)) {
      fail("RECOVERY_SOURCE_BOOTSTRAP_AUTHORITY_HISTORY_CROSSED");
    }
  } else if (!same(authorityHistory, [fenceAuthority, sourceReservationAuthority, runReservationAuthority])) {
    fail("RECOVERY_SOURCE_BOOTSTRAP_AUTHORITY_HISTORY_CROSSED");
  }
  const unrelatedAuthority = allAuthorityRows.filter((authority) => !expectedAuthority.has(authorityKeyV1(authority.authorityRef, authority.authorityHash)));
  const unrelatedOwner = reservations.filter((reservation) => reservation !== sourceRow && reservation !== runRow);
  const activeStates = new Set(["running", "resuming", "cancelling", "failing"]);
  const unrelatedActiveRun = input.activeRunRows.filter((candidate) => String(candidate.runId ?? candidate.id) !== expectedRunId);
  if (unrelatedAuthority.length !== 0 || unrelatedOwner.length !== 0 || allAuthorityRows.length !== expectedAuthority.size) {
    fail("RECOVERY_SOURCE_BOOTSTRAP_UNRELATED_AUTHORITY_OWNER_RUN");
  }
  if (preparedPending) {
    if (input.expectedRunRows.length !== 0 || input.activeRunRows.length !== 0) fail("RECOVERY_SOURCE_BOOTSTRAP_PENDING_RUN_INVALID");
    return Object.freeze({ state: "absent" });
  }
  if (input.expectedRunRows.length !== 1) fail("RECOVERY_SOURCE_BOOTSTRAP_BOUND_RUN_MISSING");
  const expectedRun = row(input.expectedRunRows[0], "RECOVERY_SOURCE_BOOTSTRAP_BOUND_RUN_INVALID");
  const validatedRun = validateExpectedRunV1(operation, expectedRunId, expectedRun);
  if (["completed", "failed", "cancelled"].includes(validatedRun.workflowState)) {
    if (!terminalClosed) fail("RECOVERY_SOURCE_BOOTSTRAP_DELIVERY_PENDING");
    if (
      input.activeRunRows.some((candidate) => String(candidate.runId ?? candidate.id) === expectedRunId)
      || (!terminalReleased && unrelatedActiveRun.length !== 0)
    ) fail("RECOVERY_SOURCE_BOOTSTRAP_TERMINAL_ACTIVE_RUN_INVALID");
  } else {
    if (!activeStates.has(validatedRun.workflowState)) fail("RECOVERY_SOURCE_BOOTSTRAP_RUN_STATE_INVALID");
    if (input.activeRunRows.length !== 1 || !same(input.activeRunRows[0], input.expectedRunRows[0])) {
      fail("RECOVERY_SOURCE_BOOTSTRAP_BOUND_ACTIVE_RUN_INVALID");
    }
  }
  if (pairClosed) {
    if (pairClosedAuthority === null) fail("RECOVERY_SOURCE_BOOTSTRAP_PAIR_CLOSED_AUTHORITY_MISSING");
    return Object.freeze({
      state: "pair_closed",
      workflowState: validatedRun.workflowState,
      runId: expectedRunId,
      operationRunBindingHash: validatedRun.operationRunBindingHash,
      reciprocalRunOperationBindingHash: validatedRun.reciprocalRunOperationBindingHash,
      terminalOwnerRef: pairClosedAuthority.terminalOwnerRef,
      terminalOwnerHash: pairClosedAuthority.terminalOwnerHash,
      terminalSourceRunRef: pairClosedAuthority.terminalSourceRunRef,
      terminalSourceRunHash: pairClosedAuthority.terminalSourceRunHash,
      terminalRunLaunchRef: pairClosedAuthority.terminalRunLaunchRef,
      terminalRunLaunchHash: pairClosedAuthority.terminalRunLaunchHash,
      targetReservationPairClose: pairClosedAuthority.targetReservationPairClose,
    });
  }
  if (terminalReleased) {
    if (releasedAuthority === null) fail("RECOVERY_SOURCE_BOOTSTRAP_RELEASED_AUTHORITY_MISSING");
    return Object.freeze({
      state: "released",
      workflowState: validatedRun.workflowState,
      runId: expectedRunId,
      operationRunBindingHash: validatedRun.operationRunBindingHash,
      reciprocalRunOperationBindingHash: validatedRun.reciprocalRunOperationBindingHash,
      terminalOwnerRef: releasedAuthority.terminalOwnerRef,
      terminalOwnerHash: releasedAuthority.terminalOwnerHash,
      terminalSourceRunRef: releasedAuthority.terminalSourceRunRef,
      terminalSourceRunHash: releasedAuthority.terminalSourceRunHash,
      terminalRunLaunchRef: releasedAuthority.terminalRunLaunchRef,
      terminalRunLaunchHash: releasedAuthority.terminalRunLaunchHash,
      targetReservationPairCloseRef: releasedAuthority.targetReservationPairCloseRef,
      targetReservationPairCloseHash: releasedAuthority.targetReservationPairCloseHash,
      fenceReleaseRef: releasedAuthority.fenceReleaseRef,
      fenceReleaseHash: releasedAuthority.fenceReleaseHash,
      sourceRunRef: releasedAuthority.sourceRunRef,
      sourceRunHash: releasedAuthority.sourceRunHash,
    });
  }
  const run = Object.freeze({ state: validatedRun.workflowState });
  return Object.freeze({
    state: "active",
    workflowState: run.state as "running" | "resuming" | "cancelling" | "failing",
    runId: expectedRunId,
    operationRunBindingHash: validatedRun.operationRunBindingHash,
    reciprocalRunOperationBindingHash: validatedRun.reciprocalRunOperationBindingHash,
  });
}
