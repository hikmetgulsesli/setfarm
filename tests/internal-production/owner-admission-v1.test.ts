import assert from "node:assert/strict";
import { execFileSync, spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { cpSync, chmodSync, existsSync, linkSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, statSync, symlinkSync, writeFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { createServer } from "node:net";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { Worker } from "node:worker_threads";
import test from "node:test";
import postgres from "postgres";

import { canonicalJsonStringify, hashCanonicalJson } from "../../src/product-compiler/canonical-json.js";
import * as ownerAdmissionApi from "../../src/internal-production/owner-admission-v1.js";
import { parseProductBuildAuthorityV2DeliveryEvidenceResponseV1 } from "../../src/internal-production/product-build-authority-v2-delivery-evidence-v1.js";
import {
  INTERNAL_PRODUCTION_OWNER_CATEGORY_CENSUS_MAP_V1,
  INTERNAL_PRODUCTION_OWNER_CATEGORY_CENSUS_MAP_HASH_V1,
  INTERNAL_PRODUCTION_OWNER_CATEGORY_REGISTRY_V1,
  INTERNAL_PRODUCTION_OWNER_CATEGORY_REGISTRY_HASH_V1,
  INTERNAL_PRODUCTION_OWNER_PRODUCER_MANIFEST_A_V1,
  INTERNAL_PRODUCTION_OWNER_PRODUCER_ROWS_A_V1,
  INTERNAL_PRODUCTION_RECOVERY_RESTART_TARGET_FAMILY_ABI_HASH_V1,
  INTERNAL_PRODUCTION_RECOVERY_RESTART_TARGET_FAMILY_ABI_V1,
  assembleInternalProductionOwnerProducerRegistryV1,
  createInternalProductionBoundOwnerReservationV1,
  createInternalProductionClaimCanonicalOwnerIdentityV1,
  createInternalProductionCompletionOwnerCanonicalOwnerIdentityV1,
  createInternalProductionExecutionAttemptCanonicalOwnerIdentityV1,
  createInternalProductionFindingCanonicalOwnerIdentityV1,
  createInternalProductionMandatoryEffectCanonicalOwnerIdentityV1,
  createInternalProductionOperationalDeliveryCanonicalOwnerIdentityV1,
  createInternalProductionOwnerReservationCloseV1,
  createInternalProductionOwnerReservationV1,
  createInternalProductionRuntimeSessionCanonicalOwnerIdentityV1,
  createInternalProductionSourceRunLaunchTargetFamilyV1,
  createInternalProductionRecoveryRestartTargetFamilyV1,
  createInternalProductionRecoveryRestartTargetSetCloseV1,
  createInternalProductionServiceRestartTerminalCoreV1,
  createInternalProductionGlobalOwnerAdmissionFenceV1,
  createInternalProductionGlobalOwnerAdmissionFenceReleaseV1,
  createInternalProductionGlobalOwnerAdmissionFenceTransitionV1,
  createInternalProductionGlobalOwnerAdmissionFenceReleaseTransitionV1,
  createInternalProductionSourceRunLaunchTargetReservationPairCloseV1,
  createInternalProductionTerminalOwnerAuthorityV1,
  createInternalProductionTerminationCanonicalOwnerIdentityV1,
  deriveInternalProductionTerminalOwnerAuthorityPairV1,
  validateInternalProductionBoundOwnerReservationV1,
  validateInternalProductionOwnerProducerManifestV1,
  validateInternalProductionOwnerProducerManifestSetActivationCurrentV1,
  validateInternalProductionOwnerProducerManifestSetActivationHeadV1,
  validateInternalProductionOwnerProducerManifestSetActivationReceiptV1,
  validateInternalProductionOwnerProducerSourceBuildAuthorityPairV1,
  validateInternalProductionOwnerProducerSourceBuildAuthorityV1,
  validateInternalProductionOwnerReservationCloseV1,
  validateInternalProductionOwnerReservationV1,
  validateInternalProductionCanonicalOwnerIdentityV1,
  validateInternalProductionTerminalOwnerAuthorityPairV1,
  validateInternalProductionTerminalOwnerAuthorityV1,
  validateInternalProductionSourceRunLaunchTargetFamilyV1,
  validateInternalProductionRecoveryRestartCoordinatorTargetAuthorityV1,
  validateInternalProductionRecoveryRestartTargetFamilyV1,
  validateInternalProductionRecoveryRestartTargetSetCloseV1,
  validateInternalProductionServiceRestartTerminalCoreV1,
  validateInternalProductionGlobalOwnerAdmissionFenceV1,
  validateInternalProductionGlobalOwnerAdmissionFenceReleaseV1,
  validateInternalProductionGlobalOwnerAdmissionFenceTransitionV1,
  validateInternalProductionGlobalOwnerAdmissionFenceReleaseTransitionV1,
  validateInternalProductionSourceRunLaunchTargetReservationPairCloseV1,
  type InternalProductionCanonicalOwnerIdentityV1,
  type InternalProductionOwnerProducerManifestV1,
  type InternalProductionOwnerProducerRowV1,
  type InternalProductionOwnerProducerSourceBuildAuthorityAV1,
  type InternalProductionResolvedOwnerTerminalCloseInputV1,
} from "../../src/internal-production/owner-admission-v1.js";

const SHA_A = "a".repeat(64);
const SHA_B = "b".repeat(64);
const SHA_C = "c".repeat(64);
const GIT_A = "a".repeat(40);
const GIT_B = "b".repeat(40);
const TERMINATION_REQUEST_ID_PATTERN = /^RTR_[A-Za-z0-9-]{16,160}$/;

type P4DeferredV1<T> = Readonly<{
  promise: Promise<T>;
  resolve: (value: T | PromiseLike<T>) => void;
  reject: (reason?: unknown) => void;
}>;

function p4DeferredV1<T>(): P4DeferredV1<T> {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return Object.freeze({ promise, resolve, reject });
}

async function loadP4Migration32TransactionKernelV1(dependencies: Readonly<{
  sql: Readonly<{ begin: (...args: any[]) => Promise<unknown> }>;
}>): Promise<Record<string, (...args: any[]) => any>> {
  const database = await import(
    `../../src/db-pg.ts?p4-transaction=${Date.now()}-${Math.random()}`
  );
  const sql = database.getSql() as unknown as { begin: (...args: any[]) => Promise<unknown> };
  sql.begin = dependencies.sql.begin;
  return database as unknown as Record<string, (...args: any[]) => any>;
}

function assertCanonicalTerminationRequestId(requestId: string): void {
  assert.match(requestId, TERMINATION_REQUEST_ID_PATTERN);
}

test("P4 source run launch fence authorities are exact pure values", () => {
  const [sourceRunProducer, runProducer] = INTERNAL_PRODUCTION_OWNER_PRODUCER_ROWS_A_V1.slice(-2);
  assert.equal(sourceRunProducer?.module, "src/db-pg.ts");
  assert.equal(runProducer?.module, "src/db-pg.ts");
  const sourceRunReservation = createInternalProductionOwnerReservationV1({
    producer: sourceRunProducer!,
    ownerKey: canonicalJsonStringify({ schema: "setfarm.internal-production-recovery-source-run-owner-key.v1", pendingInputRef: "setfarm://tests/p4/pending", pendingInputHash: SHA_A }),
    ownerAdmissionHeadPredecessorHash: SHA_A,
  });
  const runReservation = createInternalProductionOwnerReservationV1({
    producer: runProducer!,
    ownerKey: canonicalJsonStringify({ schema: "setfarm.internal-production-recovery-source-bootstrap-run-owner-key.v1", pendingInputRef: "setfarm://tests/p4/pending", pendingInputHash: SHA_A }),
    ownerAdmissionHeadPredecessorHash: SHA_A,
  });
  const targetRunLaunchCompositeHash = hashCanonicalJson({
    schema: "setfarm.internal-production-source-run-launch-target-composite.v1",
    pendingInputRef: "setfarm://tests/p4/pending",
    pendingInputHash: SHA_A,
    sourceRunOwnerKeyHash: hashCanonicalJson({
      schema: "setfarm.internal-production-recovery-source-run-owner-key.v1",
      pendingInputRef: "setfarm://tests/p4/pending",
      pendingInputHash: SHA_A,
    }),
    runOwnerKeyHash: hashCanonicalJson({
      schema: "setfarm.internal-production-recovery-source-bootstrap-run-owner-key.v1",
      pendingInputRef: "setfarm://tests/p4/pending",
      pendingInputHash: SHA_A,
    }),
  });
  const targetFamily = createInternalProductionSourceRunLaunchTargetFamilyV1({
    sourceRunReservation,
    runReservation,
    targetRunLaunchCompositeHash,
  });
  assert.deepEqual(Reflect.ownKeys(targetFamily), [
    "kind", "sourceRunReservation", "runReservation",
    "targetRunLaunchCompositeHash", "targetFamilyHash",
  ]);
  assert.ok(Object.isFrozen(targetFamily));
  assert.deepEqual(validateInternalProductionSourceRunLaunchTargetFamilyV1(structuredClone(targetFamily)), targetFamily);

  const fence = createInternalProductionGlobalOwnerAdmissionFenceV1({
    purpose: "recovery-d-source-delivery-v1",
    pendingInputRef: "setfarm://tests/p4/pending",
    pendingInputHash: SHA_A,
    targetFamily,
    observedUnrelatedReservationCount: 0,
    observedUnrelatedOwnerCount: 0,
    ownerIdentitySetHash: hashCanonicalJson([]),
    predecessorFenceHeadHash: SHA_A,
    ownerAdmissionHeadHash: SHA_B,
  });
  assert.equal(Reflect.ownKeys(fence).length, 15);
  assert.equal(fence.fenceRef, `setfarm://internal-production/global-owner-admission-fence/sha256/${fence.fenceHash}`);
  assert.deepEqual(validateInternalProductionGlobalOwnerAdmissionFenceV1(structuredClone(fence)), fence);

  const pairClose = createInternalProductionSourceRunLaunchTargetReservationPairCloseV1({
    fenceRef: fence.fenceRef,
    fenceHash: fence.fenceHash,
    targetRunLaunchCompositeHash,
    sourceRunReservationRef: sourceRunReservation.reservationRef,
    sourceRunReservationHash: sourceRunReservation.reservationHash,
    runReservationRef: runReservation.reservationRef,
    runReservationHash: runReservation.reservationHash,
    terminalSourceRunRef: "setfarm://tests/p4/source-terminal",
    terminalSourceRunHash: SHA_B,
    terminalRunLaunchRef: "setfarm://tests/p4/run-terminal",
    terminalRunLaunchHash: SHA_C,
    ownerAdmissionHeadPredecessorHash: SHA_B,
    ownerAdmissionHeadSuccessorHash: SHA_C,
    preservedFenceRef: fence.fenceRef,
    preservedFenceHash: fence.fenceHash,
  });
  assert.equal(Reflect.ownKeys(pairClose).length, 18);
  assert.deepEqual(validateInternalProductionSourceRunLaunchTargetReservationPairCloseV1(structuredClone(pairClose)), pairClose);

  const releaseAuthority = Object.freeze({
    purpose: "recovery-d-source-delivery-v1" as const,
    targetFamilyKind: "source-run-launch" as const,
    terminalCoreRef: null,
    terminalCoreHash: null,
    targetSetCloseRef: null,
    targetSetCloseHash: null,
    occurrenceRef: null,
    occurrenceHash: null,
    headRef: null,
    headHash: null,
    targetReservationPairCloseRef: pairClose.targetReservationPairCloseRef,
    targetReservationPairCloseHash: pairClose.targetReservationPairCloseHash,
    purposeTerminalKind: null,
    purposeTerminalRef: null,
    purposeTerminalHash: null,
  });
  const release = createInternalProductionGlobalOwnerAdmissionFenceReleaseV1({
    fenceRef: fence.fenceRef,
    fenceHash: fence.fenceHash,
    releaseAuthority,
    ownerAdmissionHeadPredecessorHash: SHA_C,
    ownerAdmissionHeadSuccessorHash: SHA_A,
  });
  assert.deepEqual(Reflect.ownKeys(release), [
    "schema", "fenceRef", "fenceHash", "releaseAuthority",
    "ownerAdmissionHeadPredecessorHash", "ownerAdmissionHeadSuccessorHash",
    "releaseRef", "releaseHash",
  ]);
  assert.deepEqual(validateInternalProductionGlobalOwnerAdmissionFenceReleaseV1(structuredClone(release)), release);

  assert.throws(
    () => validateInternalProductionGlobalOwnerAdmissionFenceV1({ ...fence, fenceHash: SHA_C }),
    /FENCE_DERIVATION_INVALID/,
  );
  assert.throws(
    () => validateInternalProductionSourceRunLaunchTargetReservationPairCloseV1({ ...pairClose, terminalRunLaunchHash: SHA_A }),
    /PAIR_CLOSE_DERIVATION_INVALID/,
  );
  assert.throws(
    () => validateInternalProductionSourceRunLaunchTargetFamilyV1({
      ...targetFamily,
      sourceRunReservation: {
        ...targetFamily.sourceRunReservation,
        reservationRef: `setfarm://tests/p4/reservations/${sourceRunReservation.reservationHash}`,
      },
    }),
    /RESERVATION_IDENTITY_REF_INVALID/,
  );
  assert.throws(
    () => createInternalProductionGlobalOwnerAdmissionFenceReleaseV1({
      fenceRef: fence.fenceRef,
      fenceHash: fence.fenceHash,
      releaseAuthority: {
        ...releaseAuthority,
        purpose: "golden-launch-operation-migration-release-v1",
        targetFamilyKind: "none",
      } as never,
      ownerAdmissionHeadPredecessorHash: SHA_C,
      ownerAdmissionHeadSuccessorHash: SHA_A,
    }),
    /RELEASE_AUTHORITY_BRANCH_INVALID/,
  );
});

test("P4 recovery restart forward ABI is import-free and mutation-unavailable", async () => {
  assert.equal(hashCanonicalJson(INTERNAL_PRODUCTION_RECOVERY_RESTART_TARGET_FAMILY_ABI_V1), INTERNAL_PRODUCTION_RECOVERY_RESTART_TARGET_FAMILY_ABI_HASH_V1);
  assert.equal(INTERNAL_PRODUCTION_RECOVERY_RESTART_TARGET_FAMILY_ABI_HASH_V1, "c3d88ba2dc7d9e70d773d0056d2fdeaced399f63adc7fd1c37eb423fa22d08d5");
  assert.deepEqual(Object.keys(INTERNAL_PRODUCTION_RECOVERY_RESTART_TARGET_FAMILY_ABI_V1), [
    "schema", "restartReservation", "serviceRestartOperationReservation", "launchOutboxReservation",
    "helperProcessReservation", "dispatchChildProcessReservation", "startupListenerReservation", "replacementProcessReservation",
  ]);
  const coordinator = validateInternalProductionRecoveryRestartCoordinatorTargetAuthorityV1({
    kind: "recovery-active-run",
    coordinatorAuthorityRef: "setfarm://tests/p4/coordinator",
    coordinatorAuthorityHash: SHA_A,
    activeTargetAuthorityRef: "setfarm://tests/p4/active-target",
    activeTargetAuthorityHash: SHA_B,
  });
  for (const kind of ["source-release-barrier", "cold-rehearsal", "documentation-handoff"] as const) {
    const value = validateInternalProductionRecoveryRestartCoordinatorTargetAuthorityV1({
      kind,
      coordinatorAuthorityRef: `setfarm://tests/p4/${kind}`,
      coordinatorAuthorityHash: SHA_A,
      activeTargetAuthorityRef: null,
      activeTargetAuthorityHash: null,
    });
    assert.equal(value.kind, kind);
  }
  assert.throws(() => validateInternalProductionRecoveryRestartCoordinatorTargetAuthorityV1({ ...coordinator, kind: "cold-rehearsal" }), /COORDINATOR_TARGET_AUTHORITY/);
  const identity = (key: Exclude<keyof typeof INTERNAL_PRODUCTION_RECOVERY_RESTART_TARGET_FAMILY_ABI_V1, "schema">, ordinal: number) => {
    const descriptor = INTERNAL_PRODUCTION_RECOVERY_RESTART_TARGET_FAMILY_ABI_V1[key];
    const reservationHash = String(ordinal).repeat(64);
    return Object.freeze({ category: descriptor.category, producerImplementationId: descriptor.producerImplementationId, ownerKeyHash: SHA_C, reservationRef: `setfarm://internal-production/owner-reservations/${reservationHash}`, reservationHash });
  };
  const targetFamily = createInternalProductionRecoveryRestartTargetFamilyV1({
    authorizationOperationRef: "setfarm://tests/p4/authorization-operation",
    authorizationOperationHash: SHA_A,
    namespace: "recovery-active-run",
    service: "setfarm-spawner",
    coordinationHash: SHA_B,
    coordinatorTargetAuthority: coordinator,
    restartReservation: identity("restartReservation", 1),
    serviceRestartOperationReservation: identity("serviceRestartOperationReservation", 2),
    launchOutboxReservation: identity("launchOutboxReservation", 3),
    helperProcessReservation: identity("helperProcessReservation", 4),
    dispatchChildProcessReservation: identity("dispatchChildProcessReservation", 5),
    startupListenerReservation: identity("startupListenerReservation", 6),
    replacementProcessReservation: identity("replacementProcessReservation", 7),
  });
  assert.deepEqual(validateInternalProductionRecoveryRestartTargetFamilyV1(structuredClone(targetFamily)), targetFamily);
  assert.equal(targetFamily.targetFamilyAbiHash, INTERNAL_PRODUCTION_RECOVERY_RESTART_TARGET_FAMILY_ABI_HASH_V1);
  const terminalCore = createInternalProductionServiceRestartTerminalCoreV1({
    namespace: targetFamily.namespace, service: targetFamily.service, coordinationHash: targetFamily.coordinationHash,
    authorizationOperationRef: targetFamily.authorizationOperationRef, authorizationOperationHash: targetFamily.authorizationOperationHash,
    operationRef: "setfarm://tests/p4/restart-operation", operationHash: SHA_B,
    authorizationConsumptionRef: "setfarm://tests/p4/authorization-consumption", authorizationConsumptionHash: SHA_C,
    restartReservationRef: targetFamily.restartReservation.reservationRef, restartReservationHash: targetFamily.restartReservation.reservationHash,
    serviceRestartOperationReservationRef: targetFamily.serviceRestartOperationReservation.reservationRef, serviceRestartOperationReservationHash: targetFamily.serviceRestartOperationReservation.reservationHash,
    launchOutboxReservationRef: targetFamily.launchOutboxReservation.reservationRef, launchOutboxReservationHash: targetFamily.launchOutboxReservation.reservationHash,
    helperProcessReservationRef: targetFamily.helperProcessReservation.reservationRef, helperProcessReservationHash: targetFamily.helperProcessReservation.reservationHash,
    dispatchChildProcessReservationRef: targetFamily.dispatchChildProcessReservation.reservationRef, dispatchChildProcessReservationHash: targetFamily.dispatchChildProcessReservation.reservationHash,
    startupListenerReservationRef: targetFamily.startupListenerReservation.reservationRef, startupListenerReservationHash: targetFamily.startupListenerReservation.reservationHash,
    replacementProcessReservationRef: targetFamily.replacementProcessReservation.reservationRef, replacementProcessReservationHash: targetFamily.replacementProcessReservation.reservationHash,
    terminalOwnerAuthorities: {
      restartReservationTerminalOwnerRef: "setfarm://tests/p4/t1", restartReservationTerminalOwnerHash: SHA_A,
      serviceRestartOperationTerminalOwnerRef: "setfarm://tests/p4/t2", serviceRestartOperationTerminalOwnerHash: SHA_A,
      launchOutboxTerminalOwnerRef: "setfarm://tests/p4/t3", launchOutboxTerminalOwnerHash: SHA_A,
      helperProcessTerminalOwnerRef: "setfarm://tests/p4/t4", helperProcessTerminalOwnerHash: SHA_A,
      dispatchChildProcessTerminalOwnerRef: "setfarm://tests/p4/t5", dispatchChildProcessTerminalOwnerHash: SHA_A,
      startupListenerTerminalOwnerRef: "setfarm://tests/p4/t6", startupListenerTerminalOwnerHash: SHA_A,
      replacementProcessTerminalOwnerRef: "setfarm://tests/p4/t7", replacementProcessTerminalOwnerHash: SHA_A,
    },
    disposition: { kind: "complete", completionKind: "executed", afterGenerationHash: SHA_C, failureCode: null, exactProcessAbsenceAuthorityHash: null },
    targetFamilyAbiHash: targetFamily.targetFamilyAbiHash, targetFamilyHash: targetFamily.targetFamilyHash,
  });
  assert.deepEqual(validateInternalProductionServiceRestartTerminalCoreV1(structuredClone(terminalCore)), terminalCore);
  const close = createInternalProductionRecoveryRestartTargetSetCloseV1({
    fenceRef: "setfarm://tests/p4/fence", fenceHash: SHA_A,
    authorizationOperationRef: targetFamily.authorizationOperationRef, authorizationOperationHash: targetFamily.authorizationOperationHash,
    restartReservationRef: targetFamily.restartReservation.reservationRef, restartReservationHash: targetFamily.restartReservation.reservationHash,
    serviceRestartOperationReservationRef: targetFamily.serviceRestartOperationReservation.reservationRef, serviceRestartOperationReservationHash: targetFamily.serviceRestartOperationReservation.reservationHash,
    launchOutboxReservationRef: targetFamily.launchOutboxReservation.reservationRef, launchOutboxReservationHash: targetFamily.launchOutboxReservation.reservationHash,
    helperProcessReservationRef: targetFamily.helperProcessReservation.reservationRef, helperProcessReservationHash: targetFamily.helperProcessReservation.reservationHash,
    dispatchChildProcessReservationRef: targetFamily.dispatchChildProcessReservation.reservationRef, dispatchChildProcessReservationHash: targetFamily.dispatchChildProcessReservation.reservationHash,
    startupListenerReservationRef: targetFamily.startupListenerReservation.reservationRef, startupListenerReservationHash: targetFamily.startupListenerReservation.reservationHash,
    replacementProcessReservationRef: targetFamily.replacementProcessReservation.reservationRef, replacementProcessReservationHash: targetFamily.replacementProcessReservation.reservationHash,
    terminalCoreRef: terminalCore.terminalCoreRef, terminalCoreHash: terminalCore.terminalCoreHash,
    targetFamilyAbiHash: targetFamily.targetFamilyAbiHash, targetFamilyHash: targetFamily.targetFamilyHash,
    ownerAdmissionHeadPredecessorHash: SHA_A, ownerAdmissionHeadSuccessorHash: SHA_B,
    preservedFenceRef: "setfarm://tests/p4/fence", preservedFenceHash: SHA_A,
  });
  assert.deepEqual(validateInternalProductionRecoveryRestartTargetSetCloseV1(structuredClone(close)), close);

  const database = await import(`../../src/db-pg.ts?p4-recovery-restart-unavailable=${Date.now()}-${Math.random()}`) as Record<string, (...args: any[]) => Promise<unknown>>;
  const databaseSource = readFileSync(new URL("../../src/db-pg.ts", import.meta.url), "utf8");
  const acquire = database.acquireInternalProductionRecoveryRestartOwnerAdmissionFenceV1;
  const closeTargets = database.closeInternalProductionRecoveryRestartTargetsUnderFenceV1;
  const resolveClose = database.resolveInternalProductionRecoveryRestartTargetSetCloseV1;
  assert.deepEqual([acquire.length, closeTargets.length, resolveClose.length], [1, 1, 1]);
  for (const input of [undefined, {}, { namespace: "recovery-active-run" }, { ...targetFamily, purpose: "recovery-d-physical-service-restart-operation-v1" }]) await assert.rejects(acquire(input), /^Error: BARRIER_AUTHORITY_UNAVAILABLE$/);
  await assert.rejects(closeTargets({ fenceRef: "setfarm://tests/p4/fence", fenceHash: SHA_A, terminalCoreRef: terminalCore.terminalCoreRef, terminalCoreHash: terminalCore.terminalCoreHash }), /^Error: BARRIER_AUTHORITY_UNAVAILABLE$/);
  await assert.rejects(resolveClose({ targetSetCloseRef: close.targetSetCloseRef, targetSetCloseHash: close.targetSetCloseHash }), /^Error: BARRIER_AUTHORITY_UNAVAILABLE$/);
  for (const name of ["acquireInternalProductionRecoveryRestartOwnerAdmissionFenceV1", "closeInternalProductionRecoveryRestartTargetsUnderFenceV1", "resolveInternalProductionRecoveryRestartTargetSetCloseV1"]) {
    const start = databaseSource.indexOf(`export async function ${name}`);
    const end = databaseSource.indexOf("\nexport async function ", start + 1);
    const body = databaseSource.slice(start, end);
    assert.ok(start >= 0 && end > start);
    assert.match(body, /throw new Error\("BARRIER_AUTHORITY_UNAVAILABLE"\)/);
    assert.doesNotMatch(body, /getSql|lockOwnerAdmissionHead|import\(|INSERT|UPDATE|DELETE|write|link|rename/);
  }
});

test("P4 fence head transitions bind private authority without runtime seams", () => {
  const targetFamilyHash = SHA_A;
  const fenceTransition = createInternalProductionGlobalOwnerAdmissionFenceTransitionV1({
    purpose: "recovery-d-source-delivery-v1",
    pendingInputRef: "setfarm://tests/p4/pending",
    pendingInputHash: SHA_B,
    targetFamilyHash,
    ownerIdentitySetHash: hashCanonicalJson([]),
  });
  assert.deepEqual(Reflect.ownKeys(fenceTransition), [
    "schema", "purpose", "pendingInputRef", "pendingInputHash",
    "targetFamilyHash", "ownerIdentitySetHash", "transitionRef", "transitionHash",
  ]);
  assert.deepEqual(
    validateInternalProductionGlobalOwnerAdmissionFenceTransitionV1(structuredClone(fenceTransition)),
    fenceTransition,
  );
  const releaseAuthority = Object.freeze({
    purpose: "recovery-d-source-delivery-v1" as const,
    targetFamilyKind: "source-run-launch" as const,
    terminalCoreRef: null,
    terminalCoreHash: null,
    targetSetCloseRef: null,
    targetSetCloseHash: null,
    occurrenceRef: null,
    occurrenceHash: null,
    headRef: null,
    headHash: null,
    targetReservationPairCloseRef: "setfarm://tests/p4/pair-close",
    targetReservationPairCloseHash: SHA_C,
    purposeTerminalKind: null,
    purposeTerminalRef: null,
    purposeTerminalHash: null,
  });
  const releaseTransition = createInternalProductionGlobalOwnerAdmissionFenceReleaseTransitionV1({
    fenceRef: "setfarm://tests/p4/fence",
    fenceHash: SHA_A,
    releaseAuthority,
  });
  assert.deepEqual(Reflect.ownKeys(releaseTransition), [
    "schema", "fenceRef", "fenceHash", "releaseAuthority", "transitionRef", "transitionHash",
  ]);
  assert.deepEqual(
    validateInternalProductionGlobalOwnerAdmissionFenceReleaseTransitionV1(structuredClone(releaseTransition)),
    releaseTransition,
  );
  for (const forbidden of [
    "acquireInternalProductionSourceRunLaunchOwnerAdmissionFenceV1",
    "reobserveInternalProductionGlobalOwnerAdmissionFenceV1",
    "closeInternalProductionSourceRunLaunchTargetReservationsUnderFenceV1",
    "releaseInternalProductionGlobalOwnerAdmissionFenceV1",
    "resolveInternalProductionGlobalOwnerAdmissionFenceReleaseV1",
    "reserveRecoverySourceRunOwnerV1",
    "reserveRecoverySourceBootstrapRunOwnerV1",
  ]) assert.equal(forbidden in ownerAdmissionApi, false, `${forbidden} must remain db-pg-owned/private`);
});

test("P4 db owns exact source run fence mutation ports", async () => {
  const source = readFileSync(new URL("../../src/db-pg.ts", import.meta.url), "utf8");
  const database = await import(`../../src/db-pg.ts?p4-fence-ports=${Date.now()}-${Math.random()}`);
  const ports = [
    "acquireInternalProductionSourceRunLaunchOwnerAdmissionFenceV1",
    "reobserveInternalProductionGlobalOwnerAdmissionFenceV1",
    "closeInternalProductionSourceRunLaunchTargetReservationsUnderFenceV1",
    "releaseInternalProductionGlobalOwnerAdmissionFenceV1",
    "resolveInternalProductionGlobalOwnerAdmissionFenceReleaseV1",
  ] as const;
  for (const name of ports) {
    assert.equal(typeof database[name], "function", `${name} must be db-pg-owned`);
    assert.equal(database[name].length, 1, `${name} has exact arity one`);
  }
  assert.match(source, /states\.every\(\(\{ state \}\) => state === "pending"\)[\s\S]*states\.every\(\(\{ state \}\) => state === "bound"\)[\s\S]*states\.every\(\(\{ state \}\) => state === "closed"\)/);
  assert.match(source, /head\.hash !== pairClose\.ownerAdmissionHeadSuccessorHash/);
  await assert.rejects(
    database.acquireInternalProductionSourceRunLaunchOwnerAdmissionFenceV1({
      purpose: "recovery-d-source-delivery-v1",
      pendingInputRef: "setfarm://tests/p4/pending",
      pendingInputHash: SHA_A,
      sourceRunOwnerKeyHash: SHA_B,
    } as never),
    /SOURCE_RUN_LAUNCH_FENCE_INPUT_KEYS_INVALID/,
  );
  await assert.rejects(
    database.closeInternalProductionSourceRunLaunchTargetReservationsUnderFenceV1({
      fenceRef: "setfarm://tests/p4/fence",
      fenceHash: SHA_A,
    } as never),
    /SOURCE_RUN_LAUNCH_PAIR_CLOSE_INPUT_KEYS_INVALID/,
  );
});

test("P4 completion bootstrap head barrier serializes target mint and atomic release", async () => {
  const source = readFileSync(new URL("../../src/db-pg.ts", import.meta.url), "utf8");
  const runtime = readFileSync(new URL("../../src/execution/runtime-completion.ts", import.meta.url), "utf8");
  const database = await import(`../../src/db-pg.ts?p4-bootstrap-head-barrier=${Date.now()}-${Math.random()}`);
  assert.equal(typeof database.lockInternalProductionBaselineCompletionOwnerBootstrapTargetInTransactionV1, "function");
  assert.equal(database.lockInternalProductionBaselineCompletionOwnerBootstrapTargetInTransactionV1.length, 2);
  assert.equal(typeof database.lockInternalProductionBaselineCompletionOwnerBootstrapReleaseInTransactionV1, "function");
  assert.equal(database.lockInternalProductionBaselineCompletionOwnerBootstrapReleaseInTransactionV1.length, 2);
  await assert.rejects(database.lockInternalProductionBaselineCompletionOwnerBootstrapTargetInTransactionV1({} as never, { requestId: "x", extra: true } as never), /BOOTSTRAP_TARGET_LOCK_INPUT_INVALID/);
  await assert.rejects(database.lockInternalProductionBaselineCompletionOwnerBootstrapReleaseInTransactionV1({} as never, { requestId: "x", extra: true } as never), /BOOTSTRAP_RELEASE_LOCK_INPUT_INVALID/);
  assert.match(source, /await observeInternalProductionCompletionBootstrapHeadBarrierV1\(sql\)/, "every owner-admission head lock performs the MVCC barrier read");
  const barrier = source.slice(source.indexOf("async function observeInternalProductionCompletionBootstrapHeadBarrierV1"), source.indexOf("async function lockOwnerAdmissionHeadV1"));
  assert.doesNotMatch(barrier, /FOR (?:SHARE|UPDATE)/, "the assertion is a plain MVCC read and never creates head-to-request lock inversion");
  assert.match(barrier, /createInternalProductionCompletionOwnerCanonicalOwnerIdentityV1/);
  assert.match(barrier, /INTERNAL_PRODUCTION_COMPLETION_BOOTSTRAP_TERMINAL_OWNER_CORRUPTION/);
  const guard = runtime.slice(runtime.indexOf("async function prepareInternalProductionBaselineCompletionOwnerBootstrapTargetGuardCoreV1"), runtime.indexOf("export async function authenticateInternalProductionBaselineCompletionOwnerBootstrapTargetGuardV1"));
  assert.ok(guard.indexOf("lockInternalProductionBaselineCompletionOwnerBootstrapTargetInTransactionV1") < guard.indexOf("SELECT request_id,claim_id,run_id"), "target lock order is head then request");
  const release = runtime.slice(runtime.indexOf("export async function recoverAndReleaseInternalProductionBaselineCompletionOwnerBootstrapTargetV1"), runtime.indexOf("export async function completeInternalProductionBaselineCompletionOwnerBootstrapForSequenceV1"));
  assert.ok(release.indexOf("lockInternalProductionBaselineCompletionOwnerBootstrapReleaseInTransactionV1") < release.indexOf("SELECT * FROM runtime_completion_requests WHERE request_id=$1 FOR UPDATE", release.indexOf('context.result.state === "owner_recovered"')), "release lock order is head then request");
  assert.match(release, /releaseDrainedRuntimeSessionInTransaction[\s\S]*state='accepted'[\s\S]*closeInternalProductionOwnerReservationV1[\s\S]*state: "owner_released"[\s\S]*owner release result CAS/, "session release, acceptance, owner close/head and lifecycle successor remain one transaction");
});

test("P4 completion bootstrap barrier executes tagged-SQL target, ordinary, source, adoption, and release races", async () => {
  const production = readFileSync(new URL("../../src/db-pg.ts", import.meta.url), "utf8");
  const start = production.indexOf("type InternalProductionCompletionBootstrapHeadLockModeV1");
  const end = production.indexOf("async function lockOwnerAdmissionHeadV1", start);
  const targetEnd = production.indexOf("export async function lockInternalProductionBaselineCompletionOwnerBootstrapReleaseInTransactionV1", end);
  assert.ok(start >= 0 && end > start && targetEnd > end);
  const fixture = mkdtempSync(path.join(tmpdir(), "setfarm-p4-c2-barrier-"));
  try {
    const modulePath = path.join(fixture, "barrier.ts");
    writeFileSync(modulePath, `
import {createHash} from "node:crypto";
type InternalProductionPgTransactionSql=any; type OwnerAdmissionHeadRowV1=any; type OwnerAdmissionMigrationApplicationV1=any;
const OWNER_ADMISSION_SHA256_V1=/^[a-f0-9]{64}$/;
const canonical=(v:any):string=>v===null||typeof v!=="object"?JSON.stringify(v):Array.isArray(v)?"["+v.map(canonical).join(",")+"]":"{"+Object.keys(v).sort().map(k=>JSON.stringify(k)+":"+canonical(v[k])).join(",")+"}";
const hashCanonicalJson=(v:any)=>createHash("sha256").update(canonical(v)).digest("hex");
const exactObjectKeys=(v:any,keys:readonly string[],message:string)=>{if(!v||typeof v!=="object"||Array.isArray(v)||Object.keys(v).length!==keys.length||!keys.every(k=>Object.prototype.hasOwnProperty.call(v,k)))throw new Error(message)};
const sameJsonValueV1=(a:any,b:any)=>canonical(a)===canonical(b);
const createInternalProductionCompletionOwnerCanonicalOwnerIdentityV1=({requestId}:{requestId:string})=>Object.freeze({schema:"setfarm.internal-production-canonical-owner-identity.v1",category:"completion-owner",ownerKey:requestId,ownerRef:"setfarm://runtime-completion/"+requestId,ownerHash:hashCanonicalJson({schema:"setfarm.internal-production-completion-owner.v1",requestId})});
const validateOwnerAdmissionMigrationApplicationV1=(value:any)=>value; const validateOwnerAdmissionAncestryToGenesisV1=async()=>[];
const resolveOwnerReservationInTransactionV1=async()=>(globalThis as any).__p4BarrierReservation;
${production.slice(start, end)}
${production.slice(end, targetEnd)}
export const p4Observe=observeInternalProductionCompletionBootstrapHeadBarrierV1;
export const p4LockHead=lockOwnerAdmissionHeadV1;
export const p4LockTarget=lockInternalProductionBaselineCompletionOwnerBootstrapTargetInTransactionV1;
export async function p4ObserveWithContext(sql:any,context:any){internalProductionCompletionBootstrapHeadLockContextsV1.set(sql,context);try{return await observeInternalProductionCompletionBootstrapHeadBarrierV1(sql)}finally{internalProductionCompletionBootstrapHeadLockContextsV1.delete(sql)}}
`, "utf8");
    const kernel = await import(`${pathToFileURL(modulePath).href}?p4=${Date.now()}`) as any;
    const requestId = "RCR_p4-barrier-request-0001";
    const guardHash = "a".repeat(64);
    const operationHash = "b".repeat(64);
    const result = Object.freeze({
      schema: "setfarm.internal-production-baseline-spawner-bootstrap-completion-result.v1",
      state: "guard_prepared",
      targetGuardReceiptRef: `setfarm://internal-production/baseline-completion-owner-bootstrap-target-guard-receipt/sha256/${guardHash}`,
      targetGuardReceiptHash: guardHash,
      operationRef: null,
      operationHash: null,
      targetGuardConsumptionRef: null,
      targetGuardConsumptionHash: null,
      recoveredOwnerGenerationHash: null,
      targetOwnerReleaseReceiptHash: null,
      sequenceRef: null,
      sequenceHash: null,
    });
    const identity = createInternalProductionCompletionOwnerCanonicalOwnerIdentityV1({ requestId });
    const ownerKeyHash = hashCanonicalJson({ schema: "setfarm.internal-production-owner-key.v1", ownerKeyDerivationId: "completion-request-id-v1", ownerKey: requestId });
    const activeRow = Object.freeze({
      request_id: requestId,
      request_state: "processing",
      apply_phase: "effects_committed",
      runtime_session_state: "drained",
      bootstrap_result: result,
      bootstrap_state: "guard_prepared",
      target_guard_receipt_ref: result.targetGuardReceiptRef,
      target_guard_receipt_hash: result.targetGuardReceiptHash,
      operation_ref: null,
      operation_hash: null,
      reservation_ref: "setfarm://tests/p4/completion-reservation",
      reservation_hash: "c".repeat(64),
      reservation_state: "bound",
      producer_implementation_id: "a-completion-owner-v1",
      owner_key: requestId,
      owner_key_hash: ownerKeyHash,
      reservation_payload: { ownerKey: requestId, ownerKeyHash },
      canonical_owner_identity: identity,
    });
    (globalThis as any).__p4BarrierReservation = Object.freeze({
      category: "completion-owner",
      producerImplementationId: "a-completion-owner-v1",
      ownerKey: requestId,
      ownerKeyHash,
      reservationRef: activeRow.reservation_ref,
      reservationHash: activeRow.reservation_hash,
    });
    const headRow = Object.freeze({
      head_version: "0",
      head_hash: "0".repeat(64),
      active_fence_ref: null,
      active_fence_hash: null,
      active_target_family_hash: null,
      migration_application_evidence_hash: "9".repeat(64),
      head_payload: { schema: "setfarm.internal-production-owner-admission-head.v1", version: 0, migrationApplication: { schema: "p4-migration" } },
    });
    let targetHoldsHead = false;
    const targetAcquired = p4DeferredV1<void>();
    const targetReleased = p4DeferredV1<void>();
    let visibleBarrierRows: readonly unknown[] = [];
    const productionSql = (role: "target" | "ordinary") => Object.assign(async (strings: TemplateStringsArray) => {
      const query = strings.join(" ").replace(/\s+/g, " ");
      if (query.includes("internal_production_owner_admission_head_v1") && query.includes("FOR UPDATE")) {
        if (role === "target") { targetHoldsHead = true; targetAcquired.resolve(); }
        else if (targetHoldsHead) await targetReleased.promise;
        return [headRow];
      }
      if (query.includes("runtime_completion_requests request")) return visibleBarrierRows;
      if (query.includes("category='completion-owner'") && query.includes("owner_key=")) return [{ reservation_ref: activeRow.reservation_ref, reservation_hash: activeRow.reservation_hash }];
      if (query.includes("canonical_owner_identity") && query.includes("state='bound'")) return [{ canonical_owner_identity: identity, binding_payload: {} }];
      if (query.includes("internal_production_owner_admission_authorities_v1")) return [];
      throw new Error(`P4_UNEXPECTED_BARRIER_SQL:${query}`);
    }, { unsafe: async () => { throw new Error("P4_UNEXPECTED_UNSAFE_SQL"); } });
    const productionTargetSql = productionSql("target");
    const productionOrdinarySql = productionSql("ordinary");
    const targetLock = kernel.p4LockTarget(productionTargetSql, { requestId });
    await targetAcquired.promise;
    const ordinaryLock = kernel.p4LockHead(productionOrdinarySql).then(
      () => { throw new Error("P4_ORDINARY_HEAD_LOCK_UNEXPECTED_SUCCESS"); },
      (error: unknown) => error,
    );
    await Promise.resolve();
    const targetProof = await targetLock;
    assert.deepEqual(targetProof, { ownerAdmissionHeadVersion: 0, ownerAdmissionHeadHash: "0".repeat(64), targetOwnerReservationRef: activeRow.reservation_ref, targetOwnerReservationHash: activeRow.reservation_hash });
    visibleBarrierRows = [activeRow];
    targetHoldsHead = false;
    targetReleased.resolve();
    assert.match(String(await ordinaryLock), /OWNER_ADMISSION_COMPLETION_BOOTSTRAP_FENCED/, "ordinary producer observes the committed target only after the production head lock releases");
    const taggedSql = (rows: readonly unknown[], gate?: Promise<void>) => Object.assign(async (_strings: TemplateStringsArray, ..._values: unknown[]) => { if (gate) await gate; return rows; }, { unsafe: async () => rows });
    const deferred = p4DeferredV1<void>();
    const targetSql = taggedSql([activeRow], deferred.promise);
    let targetSettled = false;
    const target = kernel.p4ObserveWithContext(targetSql, { mode: "target", requestId }).then(() => { targetSettled = true; });
    await Promise.resolve();
    assert.equal(targetSettled, false, "target waits behind the deferred head-lock observation");
    deferred.resolve();
    await target;
    assert.equal(targetSettled, true);
    for (const mode of ["ordinary", "source", "null-fence"]) {
      await assert.rejects(kernel.p4Observe(taggedSql([activeRow])), /OWNER_ADMISSION_COMPLETION_BOOTSTRAP_FENCED/, `${mode} producer loses after target publication`);
    }
    await kernel.p4ObserveWithContext(taggedSql([]), {
      mode: "ordinary-target-adoption",
      requestId: "ordinary-run-with-no-bootstrap-barrier",
      producerImplementationId: "a-runtime-run-v1",
    });
    await kernel.p4ObserveWithContext(taggedSql([activeRow]), { mode: "ordinary-target-adoption", requestId, producerImplementationId: "a-completion-owner-v1" });
    await assert.rejects(kernel.p4ObserveWithContext(taggedSql([activeRow]), { mode: "ordinary-target-adoption", requestId, producerImplementationId: "a-runtime-run-v1" }), /TARGET_ADOPTION_CROSSED/);
    const operationRef = `setfarm://internal-production/baseline-spawner-bootstrap-restart-operation/sha256/${operationHash}`;
    const releaseResult = { ...result, state: "owner_recovered", operationRef, operationHash, targetGuardConsumptionRef: `setfarm://internal-production/baseline-completion-owner-bootstrap-target-guard-consumption/sha256/${"d".repeat(64)}`, targetGuardConsumptionHash: "d".repeat(64), recoveredOwnerGenerationHash: "e".repeat(64) };
    const releaseRow = { ...activeRow, request_state: "accepted", runtime_session_state: "released", bootstrap_result: releaseResult, bootstrap_state: "owner_recovered", operation_ref: operationRef, operation_hash: operationHash };
    const releaseContext = { mode: "release", requestId, targetGuardReceiptRef: result.targetGuardReceiptRef, targetGuardReceiptHash: guardHash, operationRef, operationHash };
    await kernel.p4ObserveWithContext(taggedSql([releaseRow]), releaseContext);
    await assert.rejects(kernel.p4ObserveWithContext(taggedSql([{ ...releaseRow, operation_hash: "f".repeat(64) }]), releaseContext), /RELEASE_CAUSAL_CHAIN_CROSSED/);
    await kernel.p4ObserveWithContext(taggedSql([activeRow]), { mode: "target", requestId });
    for (const malformed of [{ ...activeRow, bootstrap_result: { ...result, extra: true } }, { ...activeRow, bootstrap_state: "unknown" }, { ...activeRow, reservation_payload: null }]) {
      await assert.rejects(kernel.p4ObserveWithContext(taggedSql([malformed]), { mode: "target", requestId }), /CORRUPTION/);
    }
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});

test("P4 transaction handle locks exact v31 and hides tentative result", async () => {
  const [guarded, checksumModule, digests, v31] = await Promise.all([
    import("../../src/db/bootstrap-main-claim-handoff-v1-migration.js"),
    import("../../src/db/contract-spine-migration-checksum.js"),
    import("../../src/db/contract-spine-migration-digests.generated.js"),
    import("../../src/db/operational-failure-cause-authority-v3-migration.js"),
  ]);
  const v31Checksum = checksumModule.computeContractSpineMigrationChecksumV1({
    version: 31,
    name: "031_operational_failure_cause_authority_v3",
    statements: v31.OPERATIONAL_FAILURE_CAUSE_AUTHORITY_V3_STATEMENTS,
    implementationDigest: digests.CONTRACT_SPINE_SEMANTIC_MIGRATION_DIGESTS[31],
  });
  const authenticEvidence = guarded.mintBootstrapMainClaimHandoffGuardedMigration32EvidenceForControllerV1({
    schema: "setfarm.bootstrap-main-claim-handoff-guarded-migration-32-evidence.v1",
    purpose: "task6a-guarded-migration-32-after-sealed-spawner-v1",
    currentEntryOperationRef: "setfarm://tests/p4/operation",
    currentEntryOperationHash: SHA_A,
    sealedSpawnerAdmissionRef: "setfarm://tests/p4/sealed",
    sealedSpawnerAdmissionHash: SHA_A,
    postPredecessorTerminationLegacyZeroOwnerObservationRef: "setfarm://tests/p4/postzero",
    postPredecessorTerminationLegacyZeroOwnerObservationHash: SHA_A,
    authorityV3Migration31AuditRef: "setfarm://tests/p4/v31-audit",
    authorityV3Migration31AuditHash: SHA_A,
    pendingBootstrapHandoffMigrationRef: "setfarm://tests/p4/pending-32",
    pendingBootstrapHandoffMigrationHash: SHA_A,
    cleanSetfarmSourceSha: GIT_A,
    cleanSetfarmTreeHash: GIT_A,
    cleanSetfarmBuildHash: SHA_A,
    migrationSourceSha: GIT_A,
    freshLegacyZeroOwnerObservationRef: "setfarm://tests/p4/fresh-zero",
    freshLegacyZeroOwnerObservationHash: SHA_A,
    preManifestMigration32AuthorizationRef: "setfarm://tests/p4/authorization",
    preManifestMigration32AuthorizationHash: SHA_A,
    preManifestMigration32AuthorizationConsumptionRef: "setfarm://tests/p4/consumption",
    preManifestMigration32AuthorizationConsumptionHash: SHA_A,
  });
  const tentativeResult = Object.freeze({
    schema: "setfarm.bootstrap-main-claim-handoff-guarded-migration-32-apply.v1",
    status: "applied",
  });

  function fakeTransaction(input: Readonly<{
    rows?: readonly Readonly<Record<string, unknown>>[];
    holdLock?: boolean;
    commitError?: Error;
    commitAck?: P4DeferredV1<void>;
    backendLoss?: P4DeferredV1<void>;
    stageError?: Error;
  }> = {}) {
    const lockStarted = p4DeferredV1<void>();
    const lockRelease = p4DeferredV1<void>();
    if (!input.holdLock) lockRelease.resolve(undefined);
    const events: string[] = [];
    let commits = 0;
    let rollbacks = 0;
    let savepoints = 0;
    let stagedResidue = false;
    let durableResidue = false;
    const transaction = Object.assign(
      async (strings: TemplateStringsArray) => {
        const normalized = strings.join("?").replace(/\s+/g, " ").trim();
        events.push(normalized);
        if (/WHERE version = 31 FOR UPDATE$/.test(normalized)) {
          lockStarted.resolve(undefined);
          await lockRelease.promise;
          return input.rows ?? [{
            version: 31,
            name: "031_operational_failure_cause_authority_v3",
            checksum: v31Checksum,
            state: "applied",
          }];
        }
        return [];
      },
      {
        unsafe: async (query: string) => {
          const normalized = query.replace(/\s+/g, " ").trim();
          events.push(normalized);
          if (/WHERE version = 31 FOR UPDATE$/.test(normalized)) {
            lockStarted.resolve(undefined);
            await lockRelease.promise;
            return input.rows ?? [{
              version: 31,
              name: "031_operational_failure_cause_authority_v3",
              checksum: "expected-v31-checksum",
              state: "applied",
            }];
          }
          return [];
        },
        savepoint: async (callback: (sql: unknown) => Promise<unknown>) => {
          savepoints += 1;
          stagedResidue = true;
          if (input.stageError) {
            stagedResidue = false;
            throw input.stageError;
          }
          void callback;
          return tentativeResult;
        },
      },
    );
    const sql = {
      begin: async (callback: (sql: unknown) => Promise<unknown>) => {
        try {
          const callbackResult = Promise.resolve(callback(transaction));
          const result = input.backendLoss
            ? await Promise.race([
                callbackResult,
                input.backendLoss.promise.then(() => {
                  throw new Error("P4_FAKE_BACKEND_LOSS");
                }),
              ])
            : await callbackResult;
          if (input.commitAck) await input.commitAck.promise;
          if (input.commitError) throw input.commitError;
          durableResidue = stagedResidue;
          stagedResidue = false;
          commits += 1;
          return result;
        } catch (error) {
          stagedResidue = false;
          rollbacks += 1;
          throw error;
        }
      },
    };
    return Object.freeze({
      sql,
      events,
      lockStarted,
      lockRelease,
      counts: () => Object.freeze({ commits, rollbacks, savepoints, stagedResidue, durableResidue }),
    });
  }

  const commitAck = p4DeferredV1<void>();
  const held = fakeTransaction({ holdLock: true, commitAck });
  const api = await loadP4Migration32TransactionKernelV1(held);
  let openSettled = false;
  const opening = api.openInternalProductionCurrentEntryMigration32TransactionV1()
    .finally(() => { openSettled = true; });
  await held.lockStarted.promise;
  assert.equal(openSettled, false, "handle escaped before exact v31 FOR UPDATE resolved");
  held.lockRelease.resolve(undefined);
  const handle = await opening;
  assert.deepEqual(Reflect.ownKeys(handle), ["schema"]);
  assert.equal(handle.schema, "setfarm.internal-production-current-entry-migration-32-transaction.v1");
  assert.ok(Object.isFrozen(handle));

  assert.equal(
    await api.stageInternalProductionCurrentEntryMigration32InTransactionV1(
      handle,
      authenticEvidence,
    ),
    undefined,
  );
  assert.deepEqual(held.counts(), {
    commits: 0, rollbacks: 0, savepoints: 1, stagedResidue: true, durableResidue: false,
  });
  await assert.rejects(
    api.stageInternalProductionCurrentEntryMigration32InTransactionV1(
      structuredClone(handle),
      authenticEvidence,
    ),
    /INTERNAL_PRODUCTION_MIGRATION_32_TRANSACTION_INVALID/,
  );
  await assert.rejects(
    api.stageInternalProductionCurrentEntryMigration32InTransactionV1(handle, authenticEvidence),
    /INTERNAL_PRODUCTION_MIGRATION_32_TRANSACTION_PHASE_INVALID/,
  );
  const otherApi = await loadP4Migration32TransactionKernelV1(fakeTransaction());
  await assert.rejects(
    otherApi.stageInternalProductionCurrentEntryMigration32InTransactionV1(handle, authenticEvidence),
    /INTERNAL_PRODUCTION_MIGRATION_32_TRANSACTION_INVALID/,
  );

  let commitSettled = false;
  const committing = api.commitInternalProductionCurrentEntryMigration32TransactionV1(handle)
    .finally(() => { commitSettled = true; });
  await Promise.resolve();
  assert.equal(commitSettled, false, "tentative result escaped before outer commit acknowledgement");
  await assert.rejects(
    api.abortInternalProductionCurrentEntryMigration32TransactionV1(handle),
    /INTERNAL_PRODUCTION_MIGRATION_32_TRANSACTION_PHASE_INVALID/,
  );
  commitAck.resolve(undefined);
  assert.equal(await committing, tentativeResult);
  assert.deepEqual(held.counts(), {
    commits: 1, rollbacks: 0, savepoints: 1, stagedResidue: false, durableResidue: true,
  });
  await assert.rejects(
    api.abortInternalProductionCurrentEntryMigration32TransactionV1(handle),
    /INTERNAL_PRODUCTION_MIGRATION_32_TRANSACTION_INVALID|INTERNAL_PRODUCTION_MIGRATION_32_TRANSACTION_PHASE_INVALID/,
  );

  const aborted = fakeTransaction();
  const abortApi = await loadP4Migration32TransactionKernelV1(aborted);
  const abortedHandle = await abortApi.openInternalProductionCurrentEntryMigration32TransactionV1();
  await abortApi.abortInternalProductionCurrentEntryMigration32TransactionV1(abortedHandle);
  assert.deepEqual(aborted.counts(), {
    commits: 0, rollbacks: 1, savepoints: 0, stagedResidue: false, durableResidue: false,
  });
  await assert.rejects(
    abortApi.commitInternalProductionCurrentEntryMigration32TransactionV1(abortedHandle),
    /INTERNAL_PRODUCTION_MIGRATION_32_TRANSACTION_INVALID|INTERNAL_PRODUCTION_MIGRATION_32_TRANSACTION_PHASE_INVALID/,
  );

  const replay = fakeTransaction();
  const replayApi = await loadP4Migration32TransactionKernelV1(replay);
  const clonedEvidenceHandle = await replayApi.openInternalProductionCurrentEntryMigration32TransactionV1();
  await assert.rejects(
    replayApi.stageInternalProductionCurrentEntryMigration32InTransactionV1(
      clonedEvidenceHandle,
      structuredClone(authenticEvidence),
    ),
    /rejects unauthenticated or cloned evidence/,
  );
  assert.deepEqual(replay.counts(), {
    commits: 0, rollbacks: 1, savepoints: 0, stagedResidue: false, durableResidue: false,
  });
  const identicalReplayHandle = await replayApi.openInternalProductionCurrentEntryMigration32TransactionV1();
  await replayApi.stageInternalProductionCurrentEntryMigration32InTransactionV1(
    identicalReplayHandle,
    authenticEvidence,
  );
  await replayApi.abortInternalProductionCurrentEntryMigration32TransactionV1(
    identicalReplayHandle,
  );
  assert.deepEqual(replay.counts(), {
    commits: 0, rollbacks: 2, savepoints: 1, stagedResidue: false, durableResidue: false,
  });
  const committedReplayHandle = await replayApi.openInternalProductionCurrentEntryMigration32TransactionV1();
  await replayApi.stageInternalProductionCurrentEntryMigration32InTransactionV1(
    committedReplayHandle,
    authenticEvidence,
  );
  assert.equal(
    await replayApi.commitInternalProductionCurrentEntryMigration32TransactionV1(
      committedReplayHandle,
    ),
    tentativeResult,
  );
  assert.deepEqual(replay.counts(), {
    commits: 1, rollbacks: 2, savepoints: 2, stagedResidue: false, durableResidue: true,
  });

  const invalidV31Rows = [
    [],
    [{ version: 31, name: "031_operational_failure_cause_authority_v3", checksum: v31Checksum, state: "adopted" }],
    [{ version: 31, name: "wrong", checksum: v31Checksum, state: "applied" }],
    [{ version: 31, name: "031_operational_failure_cause_authority_v3", checksum: "wrong", state: "applied" }],
    [{ version: 30, name: "031_operational_failure_cause_authority_v3", checksum: v31Checksum, state: "applied" }],
  ] as const;
  for (const rows of invalidV31Rows) {
    const invalid = fakeTransaction({ rows });
    const invalidApi = await loadP4Migration32TransactionKernelV1(invalid);
    await assert.rejects(
      invalidApi.openInternalProductionCurrentEntryMigration32TransactionV1(),
      /RUN_PERSISTENCE_MIGRATION_31_FENCE_(?:UNAVAILABLE|DRIFT)/,
    );
    assert.deepEqual(invalid.counts(), {
      commits: 0, rollbacks: 1, savepoints: 0, stagedResidue: false, durableResidue: false,
    });
  }

  const stageFailure = fakeTransaction({ stageError: new Error("P4_FAKE_STAGE_FAILURE") });
  const stageFailureApi = await loadP4Migration32TransactionKernelV1(stageFailure);
  const stageFailureHandle = await stageFailureApi.openInternalProductionCurrentEntryMigration32TransactionV1();
  await assert.rejects(
    stageFailureApi.stageInternalProductionCurrentEntryMigration32InTransactionV1(
      stageFailureHandle,
      authenticEvidence,
    ),
    /P4_FAKE_STAGE_FAILURE/,
  );
  assert.deepEqual(stageFailure.counts(), {
    commits: 0, rollbacks: 1, savepoints: 1, stagedResidue: false, durableResidue: false,
  });
  await assert.rejects(
    stageFailureApi.commitInternalProductionCurrentEntryMigration32TransactionV1(stageFailureHandle),
    /INTERNAL_PRODUCTION_MIGRATION_32_TRANSACTION_INVALID|INTERNAL_PRODUCTION_MIGRATION_32_TRANSACTION_PHASE_INVALID/,
  );

  const commitFailure = fakeTransaction({ commitError: new Error("P4_FAKE_COMMIT_FAILURE") });
  const commitFailureApi = await loadP4Migration32TransactionKernelV1(commitFailure);
  const commitFailureHandle = await commitFailureApi.openInternalProductionCurrentEntryMigration32TransactionV1();
  await commitFailureApi.stageInternalProductionCurrentEntryMigration32InTransactionV1(
    commitFailureHandle,
    authenticEvidence,
  );
  await assert.rejects(
    commitFailureApi.commitInternalProductionCurrentEntryMigration32TransactionV1(commitFailureHandle),
    /P4_FAKE_COMMIT_FAILURE/,
  );
  assert.deepEqual(commitFailure.counts(), {
    commits: 0, rollbacks: 1, savepoints: 1, stagedResidue: false, durableResidue: false,
  });

  const backendLoss = p4DeferredV1<void>();
  const lost = fakeTransaction({ backendLoss });
  const lostApi = await loadP4Migration32TransactionKernelV1(lost);
  const lostHandle = await lostApi.openInternalProductionCurrentEntryMigration32TransactionV1();
  await lostApi.stageInternalProductionCurrentEntryMigration32InTransactionV1(lostHandle, authenticEvidence);
  backendLoss.resolve(undefined);
  await new Promise((resolve) => setImmediate(resolve));
  await assert.rejects(
    lostApi.commitInternalProductionCurrentEntryMigration32TransactionV1(lostHandle),
    /P4_FAKE_BACKEND_LOSS/,
  );
  assert.deepEqual(lost.counts(), {
    commits: 0, rollbacks: 1, savepoints: 1, stagedResidue: false, durableResidue: false,
  });
});

type Task8ExpiryOwnerCloseWitnessV1 = Readonly<{
  category: string;
  state: string;
  close_ref: string | null;
  close_hash: string | null;
  updated_at: string;
}>;

type Task8SuccessorCanonicalSnapshotV1 = Readonly<{
  delivery: unknown;
  recoveryCase: unknown;
}>;

type Task8ExpiryFirstWitnessV1 = Readonly<{
  expiredDispatchId: string;
  successorDispatchId: string;
  expiredCaseId: string;
  successorCaseId: string;
  expiredDeliveryState: string;
  expiredCaseStatus: string;
  expiredDeliveryStateAfterCompound: string;
  expiredCaseStatusAfterCompound: string;
  expiredDeliveryStateAfterCompoundReplay: string;
  expiredCaseStatusAfterCompoundReplay: string;
  successorDeliveryState: string;
  sameDispatchRefusalCode: string;
  ownerHeadBeforeExpiry: string;
  ownerHeadAfterExpiry: string;
  ownerHeadBeforeCompound: string;
  ownerHeadAfterCompound: string;
  ownerHeadAfterCompoundReplay: string;
  expiryOwnerClosesBeforeCompound: readonly Task8ExpiryOwnerCloseWitnessV1[];
  expiryOwnerClosesAfterCompound: readonly Task8ExpiryOwnerCloseWitnessV1[];
  expiryOwnerClosesAfterCompoundReplay: readonly Task8ExpiryOwnerCloseWitnessV1[];
  successorBeforeCompound: Task8SuccessorCanonicalSnapshotV1;
  successorAfterCompound: Task8SuccessorCanonicalSnapshotV1;
  successorAfterCompoundReplay: Task8SuccessorCanonicalSnapshotV1;
}>;

function assertTask8ExpiryFirstWitnessV1(input: Task8ExpiryFirstWitnessV1): void {
  assert.notEqual(
    input.successorDispatchId,
    input.expiredDispatchId,
    "Task 8 requires one distinct successor dispatch",
  );
  assert.notEqual(
    input.successorCaseId,
    input.expiredCaseId,
    "Task 8 requires one distinct successor case",
  );
  assert.equal(input.expiredDeliveryState, "blocked", "expired delivery must remain blocked");
  assert.equal(input.expiredCaseStatus, "blocked", "expired case must remain blocked");
  assert.equal(
    input.expiredDeliveryStateAfterCompound,
    "blocked",
    "expired delivery must remain blocked after compound",
  );
  assert.equal(
    input.expiredCaseStatusAfterCompound,
    "blocked",
    "expired case must remain blocked after compound",
  );
  assert.equal(
    input.expiredDeliveryStateAfterCompoundReplay,
    "blocked",
    "expired delivery must remain blocked after compound replay",
  );
  assert.equal(
    input.expiredCaseStatusAfterCompoundReplay,
    "blocked",
    "expired case must remain blocked after compound replay",
  );
  assert.equal(input.successorDeliveryState, "leased", "distinct successor must remain constructible");
  assert.equal(
    input.sameDispatchRefusalCode,
    "V3_RECOVERY_AUTHORITY_DELIVERY_NOT_FOUND",
    "Task 8 same dispatch refusal differs",
  );
  assert.equal(
    BigInt(input.ownerHeadAfterExpiry),
    BigInt(input.ownerHeadBeforeExpiry) + 2n,
    "Task 8 requires exactly two expiry owner closes",
  );
  assert.equal(
    BigInt(input.ownerHeadAfterCompound),
    BigInt(input.ownerHeadBeforeCompound) + 2n,
    "Task 8 compound must close only termination and run owners after expiry",
  );
  assert.equal(
    input.ownerHeadAfterCompoundReplay,
    input.ownerHeadAfterCompound,
    "Task 8 compound replay advanced owner head",
  );
  assert.deepEqual(
    input.expiryOwnerClosesBeforeCompound.map((row) => [row.category, row.state]),
    [["claim", "closed"], ["runtime-session", "closed"]],
    "Task 8 expiry owner close category/state inventory differs",
  );
  for (const row of input.expiryOwnerClosesBeforeCompound) {
    assert.match(row.close_ref ?? "", /^setfarm:\/\/internal-production\/owner-reservation-closes\//);
    assert.match(row.close_hash ?? "", /^[a-f0-9]{64}$/);
    assert.notEqual(row.updated_at, "", "Task 8 expiry owner close timestamp is absent");
  }
  assert.deepEqual(
    input.expiryOwnerClosesAfterCompound,
    input.expiryOwnerClosesBeforeCompound,
    "Task 8 expiry owner closes changed during compound adoption",
  );
  assert.deepEqual(
    input.expiryOwnerClosesAfterCompoundReplay,
    input.expiryOwnerClosesBeforeCompound,
    "Task 8 expiry owner closes changed during compound replay",
  );
  assert.deepEqual(
    input.successorAfterCompound,
    input.successorBeforeCompound,
    "Task 8 successor delivery/case changed during compound",
  );
  assert.deepEqual(
    input.successorAfterCompoundReplay,
    input.successorBeforeCompound,
    "Task 8 successor delivery/case changed during compound replay",
  );
}

function p3TestGit(root: string, args: readonly string[], input?: string): string {
  const result = spawnSync("/usr/bin/git", args, {
    cwd: root,
    encoding: "utf8",
    input,
    env: {
      PATH: "/usr/bin:/bin",
      LANG: "C",
      LC_ALL: "C",
      GIT_CONFIG_NOSYSTEM: "1",
      GIT_CONFIG_GLOBAL: "/dev/null",
      GIT_CONFIG_SYSTEM: "/dev/null",
      GIT_CONFIG_COUNT: "0",
    },
  });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
}

function createP3RunnerRefusalFixture(): Readonly<{ root: string; cleanup: () => void }> {
  const container = mkdtempSync("/tmp/setfarm-p3-refusal-");
  const root = path.join(container, "setfarm");
  const cloned = spawnSync("/usr/bin/git", ["clone", "-q", "--shared", realpathSync(process.cwd()), root], {
    encoding: "utf8",
    env: {
      PATH: "/usr/bin:/bin",
      LANG: "C",
      LC_ALL: "C",
      GIT_CONFIG_NOSYSTEM: "1",
      GIT_CONFIG_GLOBAL: "/dev/null",
      GIT_CONFIG_SYSTEM: "/dev/null",
      GIT_CONFIG_COUNT: "0",
    },
  });
  assert.equal(cloned.status, 0, cloned.stderr);
  const currentByteLocators = [
    "scripts/run-isolated-postgres-tests.ts",
    "src/db-pg.ts",
    "src/internal-production/owner-admission-v1.ts",
    "src/installer/step-fail.ts",
    "src/installer/step-ops.ts",
    "tests/execution-attempts/helpers/compiler-story-admission-fixture.ts",
    "tests/execution-attempts/test-database.ts",
    "tests/execution-attempts/v3-platform-preclaim-claim.integration.test.ts",
    "tests/execution-attempts/v3-platform-preclaim-terminal.integration.test.ts",
    "tests/execution-attempts/v3-platform-preclaim-termination-race.integration.test.ts",
    "tests/execution-attempts/v3-setup-build-failure-cause.integration.test.ts",
    "tests/execution-attempts/v3-setup-build-untyped-build-failure.integration.test.ts",
    "tests/internal-production/owner-admission-v1.test.ts",
    "tests/internal-production/task-0-source-manifest.test.ts",
  ] as const;
  for (const locator of currentByteLocators) {
    cpSync(path.join(process.cwd(), locator), path.join(root, locator));
  }
  p3TestGit(root, ["config", "user.name", "Setfarm P3 Refusal Fixture"]);
  p3TestGit(root, ["config", "user.email", "setfarm-p3-refusal@invalid"]);
  p3TestGit(root, ["add", ...currentByteLocators]);
  if (p3TestGit(root, ["diff", "--cached", "--name-only"]) !== "") {
    p3TestGit(root, ["commit", "-qm", "P3 current-byte refusal fixture"]);
  }
  for (const entry of p3TestGit(root, ["ls-files", "--stage", "-z"]).split("\0").filter(Boolean)) {
    const match = /^(100644|100755) [a-f0-9]{40,64} 0\t(.+)$/.exec(entry);
    assert.ok(match, entry);
    chmodSync(path.join(root, match[2]!), match[1] === "100755" ? 0o755 : 0o644);
  }
  symlinkSync(realpathSync(path.join(process.cwd(), "node_modules")), path.join(root, "node_modules"), "dir");
  writeFileSync(path.join(root, ".git/info/exclude"), "node_modules\n");
  return Object.freeze({
    root,
    cleanup: () => rmSync(container, { recursive: true, force: true }),
  });
}

function runP3NestedRunner(root: string): Readonly<{ status: number | null; output: string }> {
  const ambientCwd = mkdtempSync(path.join(tmpdir(), "setfarm-p3-nested-cwd-"));
  const result = spawnSync(process.execPath, [
    "--import",
    realpathSync(path.join(process.cwd(), "node_modules/tsx/dist/loader.mjs")),
    path.join(root, "scripts/run-isolated-postgres-tests.ts"),
    "--",
    "node", "--import", "tsx", "--test", "--test-concurrency=1",
    "tests/internal-production/task-0-source-manifest.test.ts",
  ], {
    cwd: ambientCwd,
    encoding: "utf8",
    env: {
      PATH: "/usr/bin:/bin",
      LANG: "C",
      LC_ALL: "C",
      SETFARM_TEST_PG_ADMIN_URL:
        process.env.SETFARM_TEST_PG_ADMIN_URL ?? "postgresql://setrox@localhost:5432/postgres",
    },
  });
  rmSync(ambientCwd, { recursive: true, force: true });
  return Object.freeze({
    status: result.status,
    output: `${result.stdout ?? ""}${result.stderr ?? ""}`,
  });
}

function spawnP3NestedRunner(root: string): Readonly<{
  pid: number;
  temporaryRoot: string;
  completed: Promise<Readonly<{
    status: number | null;
    signal: NodeJS.Signals | null;
    output: string;
    temporaryEntries: readonly string[];
  }>>;
}> {
  const ambientCwd = mkdtempSync(path.join(tmpdir(), "setfarm-p3-nested-cwd-"));
  const temporaryRoot = mkdtempSync(path.join(tmpdir(), "setfarm-p3-nested-tmp-"));
  const child = spawn(process.execPath, [
    "--import",
    realpathSync(path.join(process.cwd(), "node_modules/tsx/dist/loader.mjs")),
    path.join(root, "scripts/run-isolated-postgres-tests.ts"),
    "--",
    "node", "--import", "tsx", "--test", "--test-concurrency=1",
    "tests/internal-production/task-0-source-manifest.test.ts",
  ], {
    cwd: ambientCwd,
    env: {
      PATH: "/usr/bin:/bin",
      LANG: "C",
      LC_ALL: "C",
      TMPDIR: temporaryRoot,
      SETFARM_TEST_PG_ADMIN_URL:
        process.env.SETFARM_TEST_PG_ADMIN_URL ?? "postgresql://setrox@localhost:5432/postgres",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  assert.ok(child.pid);
  let output = "";
  child.stdout!.setEncoding("utf8").on("data", (chunk) => { output += chunk; });
  child.stderr!.setEncoding("utf8").on("data", (chunk) => { output += chunk; });
  const completed = new Promise<Readonly<{
    status: number | null;
    signal: NodeJS.Signals | null;
    output: string;
    temporaryEntries: readonly string[];
  }>>((resolve, reject) => {
    child.once("error", reject);
    child.once("exit", (status, signal) => {
      const temporaryEntries = readdirSync(temporaryRoot).sort();
      rmSync(ambientCwd, { recursive: true, force: true });
      rmSync(temporaryRoot, { recursive: true, force: true });
      resolve(Object.freeze({ status, signal, output, temporaryEntries }));
    });
  });
  return Object.freeze({ pid: child.pid, temporaryRoot, completed });
}

async function waitForP3ConditionV1<T>(
  observe: () => Promise<T | null> | T | null,
  label: string,
): Promise<T> {
  const deadline = Date.now() + 45_000;
  while (Date.now() < deadline) {
    const value = await observe();
    if (value !== null) return value;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error(`P3_TEST_WAIT_TIMEOUT:${label}`);
}

async function p3DatabaseInventoryV1(
  admin: ReturnType<typeof postgres>,
): Promise<string[]> {
  const rows = await admin<Array<{ datname: string }>>`
    SELECT datname FROM pg_database
     WHERE datname ~ '^setfarm_p3_[a-f0-9]{24}_(template|primary|clone_[a-f0-9]{12}|empty_[a-f0-9]{12})$'
     ORDER BY datname
  `;
  return rows.map(({ datname }) => datname);
}

type P3SyntheticMarkerV1 = Readonly<{
  schema: "setfarm.p3-isolated-projection-marker.v1";
  projectionRoot: string;
  projectedHead: string;
  runDatabasePrefix: string;
  templateDatabaseName: string;
  adminUrlSha256: string;
  setupNonceSha256: string;
  testNonceSha256: string;
}>;

function p3Sha256(bytes: string | Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function writeP3SyntheticMarker(
  root: string,
  setupNonce: Buffer,
  testNonce: Buffer,
  mutation: (marker: P3SyntheticMarkerV1) => P3SyntheticMarkerV1 = (marker) => marker,
): P3SyntheticMarkerV1 {
  const admin = new URL(
    process.env.SETFARM_TEST_PG_ADMIN_URL ?? "postgresql://setrox@localhost:5432/postgres",
  );
  admin.pathname = "/postgres";
  const runDatabasePrefix = "setfarm_p3_1234567890abcdef12345678";
  const marker = mutation(Object.freeze({
    schema: "setfarm.p3-isolated-projection-marker.v1",
    projectionRoot: realpathSync(root),
    projectedHead: p3TestGit(root, ["rev-parse", "HEAD"]),
    runDatabasePrefix,
    templateDatabaseName: `${runDatabasePrefix}_template`,
    adminUrlSha256: p3Sha256(admin.toString()),
    setupNonceSha256: p3Sha256(setupNonce),
    testNonceSha256: p3Sha256(testNonce),
  }));
  writeFileSync(
    path.join(root, ".setfarm-p3-projection-marker.json"),
    `${JSON.stringify(marker)}\n`,
    { mode: 0o600 },
  );
  return marker;
}

async function runP3CapabilityChild(input: Readonly<{
  root: string;
  helperRoot?: string;
  frame?: Buffer;
  replay?: boolean;
  authenticateOnly?: boolean;
  entryPath?: string;
}>): Promise<Readonly<{ status: number | null; output: string }>> {
  const target = new URL(
    process.env.SETFARM_TEST_PG_ADMIN_URL ?? "postgresql://setrox@localhost:5432/postgres",
  );
  target.pathname = "/setfarm_p3_1234567890abcdef12345678_template";
  const helperPath = path.join(input.helperRoot ?? input.root, "tests/execution-attempts/test-database.ts");
  const args = input.entryPath !== undefined
    ? [
        "--import", realpathSync(path.join(process.cwd(), "node_modules/tsx/dist/loader.mjs")),
        input.entryPath,
      ]
    : input.replay || input.authenticateOnly
    ? [
        "--import", realpathSync(path.join(process.cwd(), "node_modules/tsx/dist/loader.mjs")),
        "--input-type=module", "--eval",
        `const m=await import(${JSON.stringify(pathToFileURL(helperPath).href)});m.authenticateP3ProjectedReadinessTestCapabilityV1();${input.replay ? "m.authenticateP3ProjectedReadinessTestCapabilityV1();" : ""}`,
      ]
    : ["--import", realpathSync(path.join(process.cwd(), "node_modules/tsx/dist/loader.mjs")), helperPath];
  const child = spawn(process.execPath, args, {
    cwd: input.root,
    stdio: ["ignore", "pipe", "pipe", "pipe"],
    env: {
      PATH: "/usr/bin:/bin",
      LANG: "C",
      LC_ALL: "C",
      SETFARM_PG_URL: target.toString(),
      SETFARM_TEST_PG_ADMIN_URL:
        process.env.SETFARM_TEST_PG_ADMIN_URL ?? "postgresql://setrox@localhost:5432/postgres",
    },
  });
  let output = "";
  child.stdout!.setEncoding("utf8").on("data", (chunk) => { output += chunk; });
  child.stderr!.setEncoding("utf8").on("data", (chunk) => { output += chunk; });
  child.stdio[3]!.end(input.frame ?? Buffer.alloc(0));
  return await new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("exit", (status) => resolve(Object.freeze({ status, output })));
  });
}

test("P3 runner projects authenticated current bytes from import meta root", async () => {
  const projectionRoot = realpathSync(process.cwd());
  const markerPath = path.join(projectionRoot, ".setfarm-p3-projection-marker.json");
  const marker = JSON.parse(readFileSync(markerPath, "utf8")) as Record<string, unknown>;
  assert.deepEqual(Reflect.ownKeys(marker), [
    "schema", "projectionRoot", "projectedHead", "runDatabasePrefix",
    "templateDatabaseName", "adminUrlSha256", "setupNonceSha256", "testNonceSha256",
  ]);
  assert.equal(marker.schema, "setfarm.p3-isolated-projection-marker.v1");
  assert.equal(marker.projectionRoot, projectionRoot);
  assert.match(String(marker.projectedHead), /^[a-f0-9]{40,64}$/);
  assert.match(String(marker.runDatabasePrefix), /^setfarm_p3_[a-f0-9]{24}$/);
  assert.equal(marker.templateDatabaseName, `${marker.runDatabasePrefix}_template`);
  for (const key of ["adminUrlSha256", "setupNonceSha256", "testNonceSha256"] as const) {
    assert.match(String(marker[key]), /^[a-f0-9]{64}$/);
  }
  assert.equal(execFileSync("git", ["rev-parse", "HEAD"], { cwd: projectionRoot, encoding: "utf8" }).trim(), marker.projectedHead);
  assert.match(execFileSync("git", ["rev-parse", "HEAD^"], { cwd: projectionRoot, encoding: "utf8" }).trim(), /^[a-f0-9]{40,64}$/);
  assert.equal(execFileSync("git", ["status", "--porcelain=v1", "--untracked-files=all"], { cwd: projectionRoot, encoding: "utf8" }), "");
  const indexEntries = execFileSync("git", ["ls-files", "--stage", "-z"], {
    cwd: projectionRoot,
  }).toString("utf8").split("\0").filter(Boolean).map((entry) => {
    const match = /^(100644|100755) [a-f0-9]{40,64} 0\t(.+)$/.exec(entry);
    assert.ok(match, entry);
    return { mode: match[1]!, locator: match[2]! };
  });
  assert.deepEqual([...new Set(indexEntries.map(({ mode }) => mode))].sort(), ["100644", "100755"]);
  const executable = indexEntries.find(({ mode }) => mode === "100755");
  assert.ok(executable);
  assert.equal(statSync(path.join(projectionRoot, executable.locator)).mode & 0o111, 0o111);
  assert.ok(execFileSync("git", ["show", "HEAD^:package.json"], { cwd: projectionRoot }).length > 0);
  assert.match(readFileSync(new URL(import.meta.url), "utf8"), /P3 runner projects authenticated current bytes/);
  const runnerSource = readFileSync(
    path.join(projectionRoot, "scripts/run-isolated-postgres-tests.ts"),
    "utf8",
  );
  const childEnvironmentSource = runnerSource.slice(
    runnerSource.indexOf("function childEnvironmentV1"),
    runnerSource.indexOf("async function cleanupDatabasesV1"),
  );
  assert.match(
    childEnvironmentSource,
    /NODE_OPTIONS:\s*"--test-isolation=none --import=\.\/\.setfarm-p3-test-capability-preload\.mjs"/,
  );
  assert.doesNotMatch(childEnvironmentSource, /\.\.\.process\.env|process\.env\.NODE_OPTIONS/);
  assert.doesNotMatch(
    childEnvironmentSource,
    /setupNonce|testNonce|SETFARM_P3_PROJECTION_CAPABILITY_V1|\brole\b/i,
  );
  assert.match(runnerSource, /stdio: \["inherit", "inherit", "inherit", "pipe"\]/);
  assert.doesNotMatch(runnerSource, /setfarm-p3-capability-|capabilityPath|capabilityFd/);

  if (process.env.SETFARM_PG_URL !== undefined) {
    const db = await import(`../../src/db-pg.ts?p3-primary-ready=${Date.now()}-${Math.random()}`);
    db.pgConfigureIsolatedTestDatabase(process.env.SETFARM_PG_URL);
    try {
      const current = await db.resolveCurrentInternalProductionOwnerProducerManifestSetActivationV1();
      assert.ok(current, "the primary clone must inherit the quiescent template activation");
      assert.equal(current.receipt.phase, "A");
      assert.equal(current.receipt.orderedPlans.join(","), "A");
    } finally {
      await db.pgClose();
    }
  }
});

test("P3 setup owns the generic successor apply and full verification slot before A", async () => {
  if (!process.env.SETFARM_PG_URL?.includes("/setfarm_p3_")) return;
  const helperSource = readFileSync(
    path.join(process.cwd(), "tests/execution-attempts/test-database.ts"),
    "utf8",
  );
  const helperStart = helperSource.indexOf("async function applyAndVerifyP3GenericSuccessorV1");
  const activationStart = helperSource.indexOf("async function activateP3TemplateAndWriteReadinessV1");
  const activationEnd = helperSource.indexOf("async function setupP3TemplateDirectV1");
  assert.ok(helperStart >= 0, "the code-owned generic successor helper must exist");
  assert.ok(activationStart > helperStart && activationEnd > activationStart);
  const helper = helperSource.slice(helperStart, activationStart);
  assert.match(helper, /await applyContractSpineMigrations\(db\.getSql\(\)\)/);
  assert.match(helper, /await verifyContractSpineMigrations\(db\.getSql\(\)\)/);
  assert.doesNotMatch(helper, /migration.?33|033_v3_recovery/i);
  const activation = helperSource.slice(activationStart, activationEnd);
  assert.match(helperSource, /prepareP3FixtureCurrentEntryOperationV1/);
  assert.match(
    helperSource,
    /P3 activation fixture must inherit exactly one projected workspace authority/,
  );
  assert.match(
    helperSource,
    /const CODE_OWNED_WORKSPACE_ROOT_V1 = path\.dirname\(fixedRepositoryRoot\(\)\);/,
  );
  const runnerSource = readFileSync(
    path.join(process.cwd(), "scripts/run-isolated-postgres-tests.ts"),
    "utf8",
  );
  const projectionStart = runnerSource.indexOf("function projectP3CurrentEntryWorkspaceAuthorityV1");
  const projectionEnd = runnerSource.indexOf("\n\nfunction readStableIndexedMemberV1", projectionStart);
  assert.ok(projectionStart >= 0 && projectionEnd > projectionStart);
  const projectionAuthority = runnerSource.slice(projectionStart, projectionEnd);
  assert.match(projectionAuthority, /locator !== "src\/internal-production\/baseline-post-handoff-receipt-v1\.ts"/);
  assert.match(projectionAuthority, /sourceParts\.length !== 2/);
  assert.match(projectionAuthority, /P3_CURRENT_ENTRY_WORKSPACE_PROJECTION_V1/);
  assert.doesNotMatch(projectionAuthority, /process\.env|callback|options|caller|HOME/);
  assert.doesNotMatch(activation, /prepareInternalProductionCurrentEntryOperationV1|observeInternalProductionServiceCensusV1|launchctl|lsof/);
  const guardedIndex = activation.indexOf("await applyBootstrapMainClaimHandoffGuardedMigration32V1");
  const successorIndex = activation.indexOf("await applyAndVerifyP3GenericSuccessorV1(db)");
  const activateIndex = activation.indexOf("await fixtureDb.activateInternalProductionOwnerProducerManifestSetV1");
  assert.ok(guardedIndex >= 0);
  assert.ok(successorIndex > guardedIndex);
  assert.ok(activateIndex > successorIndex);

  const sql = postgres(process.env.SETFARM_PG_URL, { max: 1, onnotice: () => {} });
  try {
    const journal = await sql<Array<{ current_version: string; migration_33_rows: string }>>`
      SELECT MAX(version)::text AS current_version,
             COUNT(*) FILTER (WHERE version=33)::text AS migration_33_rows
        FROM setfarm_schema_migrations
       WHERE state IN ('applied','adopted')
    `;
    assert.deepEqual(journal.map((row) => ({ ...row })), [
      { current_version: "33", migration_33_rows: "1" },
    ]);
  } finally {
    await sql.end({ timeout: 5 });
  }
});

test("P4 unmarked P3 database authority is rejected before an administrator connection", () => {
  const cwd = mkdtempSync(path.join(tmpdir(), "setfarm-p3-unmarked-"));
  try {
    const helperUrl = pathToFileURL(path.join(process.cwd(), "tests/execution-attempts/test-database.ts")).href;
    const program = `import(${JSON.stringify(`${helperUrl}?unmarked=${Date.now()}`)}).then(async(m)=>{try{const db=await m.createIsolatedTestDatabase();await db.cleanup?.();process.stdout.write('UNEXPECTED_SUCCESS')}catch(error){process.stdout.write(String(error))}})`;
    const result = spawnSync(process.execPath, ["--import", import.meta.resolve("tsx"), "--input-type=module", "-e", program], {
      cwd,
      encoding: "utf8",
      env: {
        PATH: process.env.PATH ?? "/usr/bin:/bin",
        HOME: process.env.HOME ?? tmpdir(),
        SETFARM_PG_URL: "postgresql://127.0.0.1:5432/setfarm_p3_0123456789abcdef01234567_primary",
        SETFARM_TEST_PG_ADMIN_URL: "postgresql://127.0.0.1:1/postgres",
      },
    });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /P3_PROJECTION_MARKER_REQUIRED/);
    assert.doesNotMatch(result.stdout, /ISOLATED_POSTGRES_UNAVAILABLE|UNEXPECTED_SUCCESS/);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("P3 isolated database names keep the exact loopback union", async () => {
  const importDb = async (label: string) => import(
    `../../src/db-pg.ts?p3-isolated-name=${encodeURIComponent(label)}-${Date.now()}-${Math.random()}`
  );
  const accepted = [
    "setfarm_contract_spine_test_1_0123456789ab",
    "setfarm_p3_0123456789abcdef01234567_template",
    "setfarm_p3_0123456789abcdef01234567_primary",
    "setfarm_p3_0123456789abcdef01234567_clone_0123456789ab",
    "setfarm_p3_0123456789abcdef01234567_empty_0123456789ab",
  ] as const;
  for (const [index, database] of accepted.entries()) {
    const db = await importDb(`accepted-${index}`);
    assert.doesNotThrow(() => db.pgConfigureIsolatedTestDatabase(
      `postgresql://setrox@127.0.0.1:5432/${database}`,
    ), database);
  }

  const rejected = [
    "setfarm_p3_0123456789abcdef0123456_template",
    "setfarm_p3_0123456789abcdef012345678_template",
    "setfarm_p3_0123456789abcdef01234567_TEMPLATE",
    "setfarm_p3_0123456789abcdef01234567_clone_0123456789a",
    "setfarm_p3_0123456789abcdef01234567_clone_0123456789abc",
    "setfarm_p3_0123456789abcdef01234567_primary_extra",
    "xsetfarm_p3_0123456789abcdef01234567_primary",
    "setfarm_contract_spine_test_1_0123456789ab_extra",
    "setfarm_contract_spine_test_1_0123456789AB",
  ] as const;
  for (const [index, database] of rejected.entries()) {
    const db = await importDb(`rejected-${index}`);
    assert.throws(() => db.pgConfigureIsolatedTestDatabase(
      `postgresql://setrox@127.0.0.1:5432/${database}`,
    ), /^Error: ISOLATED_TEST_DATABASE_URL_REJECTED$/, database);
  }

  for (const [index, url] of [
    "postgresql://setrox@example.com:5432/setfarm_p3_0123456789abcdef01234567_primary",
    "postgresql://setrox@127.0.0.1:5432/prefix/setfarm_p3_0123456789abcdef01234567_primary",
    "postgresql://setrox@127.0.0.1:5432/setfarm_p3_0123456789abcdef01234567_primary/",
  ].entries()) {
    const db = await importDb(`url-rejected-${index}`);
    assert.throws(() => db.pgConfigureIsolatedTestDatabase(url),
      /^Error: ISOLATED_TEST_DATABASE_URL_REJECTED$/);
  }
});

test("P3 runner carries each one-shot capability only through child FD3 pipe", () => {
  const source = readFileSync(
    path.join(process.cwd(), "scripts/run-isolated-postgres-tests.ts"),
    "utf8",
  );
  const capability = source.slice(
    source.indexOf("async function spawnWithCapabilityV1"),
    source.indexOf("function childEnvironmentV1"),
  );
  assert.match(capability, /stdio: \["inherit", "inherit", "inherit", "pipe"\]/);
  assert.match(capability, /child\.stdio\[3\].*\.end\(input\.frame\)/s);
  assert.doesNotMatch(capability, /writeFileSync|openSync|setfarm-p3-capability-/);
  assert.match(source, /SETFARM_P3_TEST_CAPABILITY_PRELOAD_V1/);
  assert.match(source, /process\.env\.NODE_OPTIONS = "--test-isolation=none"/);
  assert.doesNotMatch(source, /NODE_OPTIONS:[\s\S]{0,160}--import=tsx/);
});

test("P3 preload consumes FD3 and rejects descendant counterfeit authority before mutation", async () => {
  if (!process.env.SETFARM_PG_URL?.includes("/setfarm_p3_")) return;
  const adminUrl = process.env.SETFARM_TEST_PG_ADMIN_URL
    ?? "postgresql://setrox@localhost:5432/postgres";
  const admin = postgres(adminUrl, { max: 1, onnotice: () => {} });
  try {
    const replay = createP3RunnerRefusalFixture();
    try {
      const target = path.join(replay.root, "tests/internal-production/task-0-source-manifest.test.ts");
      writeFileSync(target, `
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { closeSync, readSync, realpathSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";
import postgres from "postgres";
test("grandchild cannot replay P3 FD3", async () => {
  const sql = postgres(process.env.SETFARM_PG_URL, { max: 1, onnotice: () => {} });
  try {
  const inventory = async () => (await sql.unsafe("SELECT current_revision::text,activation_ref,activation_hash,head_ref,head_hash FROM internal_production_owner_producer_manifest_set_current_v1 ORDER BY singleton_key")).map((row) => ({...row}));
  const before = await inventory();
  const frame = Buffer.alloc(256);
  let frameLength = 0;
  try { frameLength = readSync(3, frame, 0, frame.length, null); closeSync(3); } catch {}
  const stolen = frame.subarray(0, frameLength);
  const helper = path.join(process.cwd(), "tests/execution-attempts/test-database.ts");
  const child = spawn(process.execPath, ["--import", realpathSync(path.join(process.cwd(), "node_modules/tsx/dist/loader.mjs")), "--input-type=module", "--eval", "const m=await import(" + JSON.stringify(pathToFileURL(helper).href) + ");m.authenticateP3ProjectedReadinessTestCapabilityV1();"], { cwd: process.cwd(), env: process.env, stdio: ["ignore", "pipe", "pipe", "pipe"] });
  let stderr = "";
  child.stderr.setEncoding("utf8").on("data", (chunk) => { stderr += chunk; });
  const completed = new Promise((resolve, reject) => { child.once("error", reject); child.once("exit", resolve); });
  child.stdio[3].end(stolen);
  const status = await completed;
  assert.notEqual(status, 0, "grandchild authenticated the original one-shot FD3");
  assert.match(stderr, /P3_PROJECTION_CAPABILITY_INVALID|EBADF|ENXIO/);
  assert.deepEqual(await inventory(), before);
  const databaseInventory = async () => (await sql.unsafe("SELECT datname FROM pg_database WHERE datname LIKE 'setfarm_p3_%' ORDER BY datname")).map((row) => row.datname);
  const databaseBefore = await databaseInventory();
  const readiness = path.join(process.cwd(), "src/internal-production/baseline-spawner-startup-admission-v1.js");
  const counterfeitProgram = [
    'Object.defineProperty(globalThis,Symbol.for("setfarm.p3-test-capability-preload-state.v1"),{configurable:true,enumerable:false,value:"authenticated",writable:false});',
    'const m=await import(' + JSON.stringify(pathToFileURL(helper).href) + ');',
    'm.authenticateP3ProjectedReadinessTestCapabilityV1();',
    'const r=await import(' + JSON.stringify(pathToFileURL(readiness).href) + ');',
    'await r.observeInternalProductionPreSchemaSpawnerRebindStatusV1();',
    'await m.createIsolatedTestDatabase();',
    'process.exit(0);',
  ].join('');
  const counterfeit = spawn(process.execPath, ["--import", realpathSync(path.join(process.cwd(), "node_modules/tsx/dist/loader.mjs")), "--input-type=module", "--eval", counterfeitProgram], { cwd: process.cwd(), env: {...process.env, NODE_OPTIONS: "--test-isolation=none"}, stdio: ["ignore", "pipe", "pipe"] });
  let counterfeitStderr = "";
  counterfeit.stderr.setEncoding("utf8").on("data", (chunk) => { counterfeitStderr += chunk; });
  const counterfeitStatus = await new Promise((resolve, reject) => { counterfeit.once("error", reject); counterfeit.once("exit", resolve); });
  assert.notEqual(counterfeitStatus, 0, "grandchild forged the public Symbol.for sentinel without FD3");
  assert.match(counterfeitStderr, /P3_PROJECTION_CAPABILITY_INVALID|EBADF|ENXIO/);
  assert.deepEqual(await databaseInventory(), databaseBefore);
  assert.deepEqual(await inventory(), before);
  } finally { await sql.end({ timeout: 5 }); }
});
`);
      const result = await spawnP3NestedRunner(replay.root).completed;
      assert.equal(result.status, 0, result.output);
    } finally {
      replay.cleanup();
    }

    const baseline = await p3DatabaseInventoryV1(admin);
    const earlyClose = createP3RunnerRefusalFixture();
    try {
      const helperPath = path.join(earlyClose.root, "tests/execution-attempts/test-database.ts");
      const helperSource = readFileSync(helperPath, "utf8");
      const helperAnchor = "async function setupP3TemplateDirectV1(): Promise<void> {\n";
      assert.equal(helperSource.includes(helperAnchor), true);
      writeFileSync(helperPath, helperSource.replace(
        helperAnchor,
        `${helperAnchor}  closeSync(3);\n  process.exit(0);\n`,
      ));
      const runnerPath = path.join(earlyClose.root, "scripts/run-isolated-postgres-tests.ts");
      const runnerSource = readFileSync(runnerPath, "utf8");
      const writerAnchor = "  deliveryStarted = true;\n  writer.end(input.frame);\n";
      assert.equal(runnerSource.includes(writerAnchor), true);
      writeFileSync(runnerPath, runnerSource.replace(
        writerAnchor,
        "  await new Promise((resolve) => child.once(\"exit\", resolve));\n  deliveryStarted = true;\n  writer.end(input.frame);\n",
      ));
      p3TestGit(earlyClose.root, ["add", helperPath, runnerPath]);
      p3TestGit(earlyClose.root, ["commit", "-qm", "force early FD3 close"]);
      const running = spawnP3NestedRunner(earlyClose.root);
      const result = await running.completed;
      assert.notEqual(result.status, 0);
      assert.match(result.output, /P3_PROJECTION_CAPABILITY_DELIVERY_FAILED/);
      assert.deepEqual(
        result.temporaryEntries.filter((entry) => entry.startsWith("setfarm-p3-projection-")),
        [],
      );
      assert.deepEqual(await p3DatabaseInventoryV1(admin), baseline);
    } finally {
      earlyClose.cleanup();
    }
  } finally {
    await admin.end({ timeout: 5 });
  }
});

test("P3 database helper clones the activated template and bounds empty and migration31 fixtures", async () => {
  if (!process.env.SETFARM_PG_URL?.includes("/setfarm_p3_")) return;
  const originalUrl = process.env.SETFARM_PG_URL;
  const helper = await import("../execution-attempts/test-database.js");
  helper.authenticateP3ProjectedReadinessTestCapabilityV1();
  const normal = await helper.createIsolatedTestDatabase();
  try {
    assert.match(normal.database, /^setfarm_p3_[a-f0-9]{24}_clone_[a-f0-9]{12}$/);
    const current = await normal.db.resolveCurrentInternalProductionOwnerProducerManifestSetActivationV1();
    assert.ok(current);
    assert.equal(current.receipt.phase, "A");
    await normal.reset();
    const resetDatabase = await normal.sql<Array<{ current_database: string; live: number }>>`
      SELECT current_database() AS current_database, 1::int AS live
    `;
    assert.deepEqual(resetDatabase.map((row) => ({ ...row })), [
      { current_database: normal.database, live: 1 },
    ]);
    const resetCurrent = await normal.db.resolveCurrentInternalProductionOwnerProducerManifestSetActivationV1();
    assert.ok(resetCurrent);
    assert.equal(resetCurrent.receipt.activationHash, current.receipt.activationHash);
  } finally {
    await normal.cleanup();
    process.env.SETFARM_PG_URL = originalUrl;
  }

  const empty = await helper.createIsolatedTestDatabase({ migrate: false });
  try {
    assert.match(empty.database, /^setfarm_p3_[a-f0-9]{24}_empty_[a-f0-9]{12}$/);
    const rows = await empty.sql<Array<{ relation: string | null }>>`
      SELECT to_regclass('public.schema_migrations')::text AS relation
    `;
    assert.equal(rows[0]?.relation, null);
  } finally {
    await empty.cleanup();
    process.env.SETFARM_PG_URL = originalUrl;
  }

  const migration31 = await helper.createIsolatedMigration31TestDatabase();
  try {
    assert.match(migration31.database, /^setfarm_p3_[a-f0-9]{24}_empty_[a-f0-9]{12}$/);
    const current = await migration31.sql<Array<{ version: string | null; activation_relation: string | null }>>`
      SELECT MAX(version) FILTER (WHERE state='applied')::text AS version,
             to_regclass('public.internal_production_owner_producer_manifest_set_current_v1')::text
               AS activation_relation
        FROM setfarm_schema_migrations
    `;
    assert.deepEqual(current.map((row) => ({ ...row })), [
      { version: "31", activation_relation: null },
    ]);
  } finally {
    await migration31.cleanup();
    process.env.SETFARM_PG_URL = originalUrl;
  }
});

test("P4 owner fixtures separate real ts startup from p3 js shadow", async () => {
  const real = await import(`../../src/internal-production/baseline-spawner-startup-admission-v1.ts?p4-owner-real=${Date.now()}`);
  assert.equal(Object.keys(real).length, 11);
  assert.equal(typeof real.prepareInternalProductionPreSchemaSpawnerRebindAuthorizationV1, "function");
  assert.equal(typeof real.resolveInternalProductionPreSchemaSpawnerSealedAdmissionV1, "function");
  const resolutionFixture = mkdtempSync(path.join(tmpdir(), "setfarm-p4-tsx-shadow-resolution-"));
  try {
    writeFileSync(path.join(resolutionFixture, "package.json"), `${JSON.stringify({ type: "module" })}\n`);
    writeFileSync(path.join(resolutionFixture, "target.ts"), `export const marker = "real-ts";\n`);
    writeFileSync(path.join(resolutionFixture, "target.js"), `export const marker = "shadow-js";\n`);
    writeFileSync(path.join(resolutionFixture, "relative-parent.ts"), `const loaded = await import("./target.js"); process.stdout.write(loaded.marker);\n`);
    writeFileSync(path.join(resolutionFixture, "file-parent.ts"), `const loaded = await import(process.env.P4_TARGET_HREF); process.stdout.write(loaded.marker);\n`);
    for (const [parent, extraEnvironment] of [
      ["relative-parent.ts", {}],
      ["file-parent.ts", { P4_TARGET_HREF: pathToFileURL(path.join(resolutionFixture, "target.js")).href }],
    ] as const) {
      const result = spawnSync(process.execPath, ["--import", import.meta.resolve("tsx"), path.join(resolutionFixture, parent)], {
        cwd: resolutionFixture,
        encoding: "utf8",
        env: { PATH: process.env.PATH ?? "/usr/bin:/bin", ...extraEnvironment },
      });
      assert.equal(result.status, 0, result.stderr);
      assert.equal(result.stdout, "real-ts");
    }
  } finally {
    rmSync(resolutionFixture, { recursive: true, force: true });
  }
  const createAuthenticatedHookFixture = (extraImport = "") => {
    const fixture = createP3RunnerRefusalFixture();
    const setupNonce = Buffer.from("11".repeat(32), "hex");
    const testNonce = Buffer.from("22".repeat(32), "hex");
    const shadowPath = path.join(
      fixture.root,
      "src/internal-production/baseline-spawner-startup-admission-v1.js",
    );
    writeFileSync(shadowPath, `
import { authenticateP3ProjectedReadinessTestCapabilityV1 } from "../../tests/execution-attempts/test-database.ts";
import { pgConfigureIsolatedTestDatabase as readinessDbBoundary } from "../../src/db-pg.ts?p3-readiness=";
${extraImport}
export async function observeInternalProductionPreSchemaSpawnerRebindStatusV1(){ authenticateP3ProjectedReadinessTestCapabilityV1(); void readinessDbBoundary; return Object.freeze({state:"shadow-ready"}); }
export async function resolveInternalProductionTask0SpawnerAdmissionReadyV1(value){ authenticateP3ProjectedReadinessTestCapabilityV1(); return value; }
`, { mode: 0o600 });
    writeFileSync(
      path.join(fixture.root, "src/internal-production/p4-hook-sibling.js"),
      'export const marker = "sibling-js";\n',
    );
    const helperPath = path.join(fixture.root, "tests/execution-attempts/test-database.ts");
    const helperSource = readFileSync(helperPath, "utf8");
    const registerAnchor = "  register(hookUrl, {\n";
    assert.equal(helperSource.split(registerAnchor).length - 1, 1);
    const instrumentedHelperSource = helperSource.replace(
      registerAnchor,
      `  const p4HookTestState = globalThis as Record<string, unknown>;\n  p4HookTestState.__setfarmP4HookRegisterCount = Number(p4HookTestState.__setfarmP4HookRegisterCount ?? 0) + 1;\n${registerAnchor}`,
    );
    writeFileSync(
      helperPath,
      `${instrumentedHelperSource}\nexport async function p4TestImportP3ReadinessShadowV1(){ return importP3ReadinessShadowV1(); }\nexport function p4TestReadP3ReadinessShadowHookSourceV1(){ return P3_READINESS_SHADOW_HOOK_SOURCE_V1; }\n`,
    );
    const databasePath = path.join(fixture.root, "src/db-pg.ts");
    writeFileSync(
      databasePath,
      `${readFileSync(databasePath, "utf8")}\nexport async function p4TestImportRunPersistenceReadinessModuleV1(){ return import(RUN_PERSISTENCE_READINESS_MODULE_SPECIFIER_V1); }\n`,
    );
    writeP3SyntheticMarker(fixture.root, setupNonce, testNonce);
    return Object.freeze({
      ...fixture,
      shadowPath,
      frame: Buffer.from(`SETFARM_P3_PROJECTION_CAPABILITY_V1:test:${testNonce.toString("hex")}\n`, "ascii"),
    });
  };

  const hookFixture = createAuthenticatedHookFixture();
  try {
    const helperHref = pathToFileURL(path.join(
      hookFixture.root,
      "tests/execution-attempts/test-database.ts",
    )).href;
    const databaseHref = pathToFileURL(path.join(hookFixture.root, "src/db-pg.ts")).href;
    const shadowHref = pathToFileURL(hookFixture.shadowPath).href;
    const successProbe = path.join(
      hookFixture.root,
      "tests/execution-attempts/p4-hook-success-probe.ts",
    );
    writeFileSync(successProbe, `
import assert from "node:assert/strict";
const helper = await import(${JSON.stringify(helperHref)});
helper.authenticateP3ProjectedReadinessTestCapabilityV1();
assert.equal(Number((globalThis as Record<string, unknown>).__setfarmP4HookRegisterCount), 1);
helper.authenticateP3ProjectedReadinessTestCapabilityV1();
assert.equal(Number((globalThis as Record<string, unknown>).__setfarmP4HookRegisterCount), 1);
const absolute = await import(${JSON.stringify(shadowHref)});
const query = await import(${JSON.stringify(`${shadowHref}?delegated=1`)});
const hash = await import(${JSON.stringify(`${shadowHref}#delegated`)});
assert.equal(Object.keys(absolute).length, 11);
assert.equal(Object.keys(query).length, 11);
assert.equal(Object.keys(hash).length, 2);
assert.equal(await import(${JSON.stringify(shadowHref)}), absolute);
assert.equal(await import(${JSON.stringify(`${shadowHref}?delegated=1`)}), query);
assert.equal(await import(${JSON.stringify(`${shadowHref}#delegated`)}), hash);
const relative = await helper.p4TestImportP3ReadinessShadowV1();
assert.deepEqual(Object.keys(relative).sort(), ["observeInternalProductionPreSchemaSpawnerRebindStatusV1", "resolveInternalProductionTask0SpawnerAdmissionReadyV1"]);
assert.notEqual(relative, hash);
const database = await import(${JSON.stringify(`${databaseHref}?p4-hook-owner=1`)});
assert.equal(await database.p4TestImportRunPersistenceReadinessModuleV1(), relative);
assert.equal((await import("../../src/internal-production/p4-hook-sibling.js")).marker, "sibling-js");
assert.equal(typeof (await import("node:path")).resolve, "function");
process.stdout.write("HOOK_OK");
`);
    const success = await runP3CapabilityChild({
      root: hookFixture.root,
      frame: hookFixture.frame,
      entryPath: successProbe,
    });
    assert.equal(success.status, 0, success.output);
    assert.equal(success.output.startsWith("HOOK_OK"), true, success.output);

    const failureProbe = path.join(
      hookFixture.root,
      "tests/execution-attempts/p4-hook-auth-failure-probe.ts",
    );
    writeFileSync(failureProbe, `
import assert from "node:assert/strict";
const helper = await import(${JSON.stringify(helperHref)});
await assert.rejects(async () => helper.authenticateP3ProjectedReadinessTestCapabilityV1(), /P3_PROJECTION_CAPABILITY_INVALID/);
const unresolved = await import("../../src/internal-production/baseline-spawner-startup-admission-v1.js");
assert.equal(Object.keys(unresolved).length, 11);
process.stdout.write("NO_HOOK");
`);
    const failure = await runP3CapabilityChild({
      root: hookFixture.root,
      frame: Buffer.from("invalid\n", "ascii"),
      entryPath: failureProbe,
    });
    assert.equal(failure.status, 0, failure.output);
    assert.equal(failure.output, "NO_HOOK");

    const extraDataProbe = path.join(
      hookFixture.root,
      "tests/execution-attempts/p4-hook-extra-data-probe.ts",
    );
    writeFileSync(extraDataProbe, `
import assert from "node:assert/strict";
import { register } from "node:module";
const helper = await import(${JSON.stringify(helperHref)});
const hookSource = helper.p4TestReadP3ReadinessShadowHookSourceV1();
const hookUrl = "data:text/javascript;base64," + Buffer.from(hookSource).toString("base64");
assert.throws(() => register(hookUrl, { parentURL: import.meta.url, data: { targetUrl: ${JSON.stringify(shadowHref)}, source: "export {};", extra: true } }), /P3_READINESS_SHADOW_HOOK_DATA_INVALID/);
process.stdout.write("EXTRA_DATA_REFUSED");
`);
    const extraData = await runP3CapabilityChild({
      root: hookFixture.root,
      frame: Buffer.alloc(0),
      entryPath: extraDataProbe,
    });
    assert.equal(extraData.status, 0, extraData.output);
    assert.equal(extraData.output.startsWith("EXTRA_DATA_REFUSED"), true, extraData.output);
  } finally {
    hookFixture.cleanup();
  }

  const malformedFixture = createAuthenticatedHookFixture(
    'import "../../src/internal-production/p4-hook-sibling.js";',
  );
  try {
    const malformedProbe = path.join(malformedFixture.root, "p4-hook-malformed-probe.ts");
    writeFileSync(malformedProbe, `
import assert from "node:assert/strict";
const helper = await import(${JSON.stringify(pathToFileURL(path.join(
      malformedFixture.root,
      "tests/execution-attempts/test-database.ts",
    )).href)});
assert.throws(() => helper.authenticateP3ProjectedReadinessTestCapabilityV1());
process.stdout.write("MALFORMED_REFUSED");
`);
    const malformed = await runP3CapabilityChild({
      root: malformedFixture.root,
      frame: malformedFixture.frame,
      entryPath: malformedProbe,
    });
    assert.equal(malformed.status, 0, malformed.output);
    assert.equal(malformed.output, "MALFORMED_REFUSED");
  } finally {
    malformedFixture.cleanup();
  }
  const source = readFileSync(path.resolve(import.meta.dirname, "../../src/db-pg.ts"), "utf8");
  assert.match(source, /RUN_PERSISTENCE_READINESS_DECLARED_EXTRA_EXPORTS_V1/);
  assert.match(source, /RUN_PERSISTENCE_READINESS_MODULE_SPECIFIER_V1 = "\.\/internal-production\/baseline-spawner-startup-admission-v1\.js"/);
  const fixtureSource = readFileSync(path.resolve(import.meta.dirname, "../execution-attempts/test-database.ts"), "utf8");
  for (const literal of [
    "P3_READINESS_SHADOW_MAX_BYTES_V1 = 65_536",
    "constants.O_RDONLY | constants.O_NOFOLLOW",
    'import { register } from "node:module"',
    "P3_READINESS_SHADOW_HOOK_SOURCE_V1",
    "P3_READINESS_SHADOW_MODULE_SPECIFIER_V1",
    'format: "module", shortCircuit: true',
    'JSON.stringify(["targetUrl", "source"])',
    "data.source instanceof Uint8Array",
    'Buffer.from(source, "utf8")',
    "return nextResolve(specifier, context)",
    "return nextLoad(url, context)",
    "P3_READINESS_SHADOW_TEST_DATABASE_IMPORT_V1",
    "P3_READINESS_SHADOW_DB_IMPORT_V1",
  ]) assert.ok(fixtureSource.includes(literal), `missing fixed P3 shadow boundary ${literal}`);
});

test("P4 sealed spawner gate authenticates replacement and exits before normal startup", async () => {
  const productionSpawnerSource = readFileSync(path.resolve(import.meta.dirname, "../../src/spawner.ts"), "utf8");
  assert.doesNotMatch(productionSpawnerSource, /^export async function enforceInternalProductionPreSchemaSpawnerStartupGateV1/m);
  const fixture = mkdtempSync(path.join(tmpdir(), "setfarm-p4-private-spawner-gate-"));
  cpSync(path.resolve(import.meta.dirname, "../../src"), path.join(fixture, "src"), { recursive: true });
  symlinkSync(path.resolve(import.meta.dirname, "../../node_modules"), path.join(fixture, "node_modules"), "dir");
  const fixtureSpawner = path.join(fixture, "src/spawner.ts");
  writeFileSync(fixtureSpawner, productionSpawnerSource.replace("async function enforceInternalProductionPreSchemaSpawnerStartupGateV1(", "export async function enforceInternalProductionPreSchemaSpawnerStartupGateV1("));
  const spawner = await import(`${pathToFileURL(fixtureSpawner).href}?p4-sealed-gate=${Date.now()}`);
  const source = { sha: "1".repeat(40), treeHash: "2".repeat(40), buildHash: "3".repeat(64) };
  const operationHash = "4".repeat(64);
  const startupTokenHash = "5".repeat(64);
  const replacementHash = "6".repeat(64);
  const processIdentityHash = "7".repeat(64);
  const generationHash = "8".repeat(64);
  const calls: string[] = [];
  const status = Object.freeze({
    state: "pre_manifest_bootstrap_sealed",
    currentEntryOperation: Object.freeze({ operationRef: `setfarm://internal-production/current-entry-operation/sha256/${operationHash}`, operationHash }),
    startupToken: Object.freeze({ startupTokenRef: `setfarm://internal-production/pre-schema-spawner-startup-token/sha256/${startupTokenHash}`, startupTokenHash }),
    dispatchPrefix: Object.freeze({ replacementProcessObservation: Object.freeze({ replacementProcessObservationRef: `setfarm://internal-production/pre-schema-spawner-replacement-process-observation/sha256/${replacementHash}`, replacementProcessObservationHash: replacementHash }) }),
  });
  const dependencies = {
    startupAdmission: {
      observeInternalProductionPreSchemaSpawnerRebindStatusV1: async () => { calls.push("observe-status"); return status; },
      resolveInternalProductionPreSchemaSpawnerStartupTokenV1: async () => {
        calls.push("resolve-token");
        return Object.freeze({ startupMode: "pre-manifest-bootstrap-sealed", currentEntryOperationRef: status.currentEntryOperation.operationRef, currentEntryOperationHash: operationHash, task0SpawnerSourceSha: source.sha, task0SpawnerTreeHash: source.treeHash, task0SpawnerBuildHash: source.buildHash });
      },
      resolveInternalProductionPreSchemaSpawnerReplacementProcessObservationV1: async () => {
        calls.push("resolve-replacement");
        return Object.freeze({ replacementSpawnerProcessIdentityHash: processIdentityHash, actualSpawnerGenerationHash: generationHash, actualSpawnerSourceSha: source.sha, actualSpawnerTreeHash: source.treeHash, actualSpawnerBuildHash: source.buildHash });
      },
    },
    loadReceiptAuthority: async () => {
      calls.push("load-receipt");
      return {
        observeCurrentInternalProductionCleanSetfarmSourceBuildV1: () => { calls.push("observe-source"); return source; },
        observeInternalProductionServiceCensusV1: async () => { calls.push("observe-census"); return { spawner: { processIdentityHash, generationHash } }; },
      };
    },
    waitForStop: async () => { calls.push("wait-stop"); },
    cleanupSealedProcess: () => { calls.push("cleanup-lock-pid"); },
  };
  assert.equal(await spawner.enforceInternalProductionPreSchemaSpawnerStartupGateV1(dependencies), "sealed");
  assert.deepEqual(calls, ["observe-status", "resolve-token", "load-receipt", "observe-source", "resolve-replacement", "observe-census", "wait-stop", "cleanup-lock-pid"]);

  calls.length = 0;
  dependencies.startupAdmission.resolveInternalProductionPreSchemaSpawnerReplacementProcessObservationV1 = async () => ({
    replacementSpawnerProcessIdentityHash: "9".repeat(64), actualSpawnerGenerationHash: generationHash,
    actualSpawnerSourceSha: source.sha, actualSpawnerTreeHash: source.treeHash, actualSpawnerBuildHash: source.buildHash,
  });
  await assert.rejects(spawner.enforceInternalProductionPreSchemaSpawnerStartupGateV1(dependencies), /REPLACEMENT_IDENTITY_INVALID/);
  assert.equal(calls.includes("wait-stop"), false);
  assert.equal(calls.includes("cleanup-lock-pid"), false);

  const spawnerSource = readFileSync(path.resolve(import.meta.dirname, "../../src/spawner.ts"), "utf8");
  const main = spawnerSource.slice(spawnerSource.indexOf("async function main()"));
  const gateIndex = main.indexOf("await enforceInternalProductionPreSchemaSpawnerStartupGateV1");
  assert.ok(gateIndex >= 0);
  for (const normalBoundary of ["assertAgentRuntimeAvailable()", "await pgMigrate()", "postgres(pgUrl"]) {
    assert.ok(main.indexOf(normalBoundary) > gateIndex, `${normalBoundary} must remain after the sealed gate`);
  }
  rmSync(fixture, { recursive: true, force: true });
});

test("P4 real spawner main remains sealed until signal and cleans its lock and pid", async () => {
  const repository = path.resolve(import.meta.dirname, "../..");
  const fixture = mkdtempSync(path.join(tmpdir(), "setfarm-p4-real-sealed-spawner-"));
  const fixtureSource = path.join(fixture, "src");
  const pidFile = path.join(fixture, "state/spawner.pid");
  const lockFile = path.join(fixture, "state/spawner.lock");
  const normalMarker = path.join(fixture, "normal-startup-called");
  cpSync(path.join(repository, "src"), fixtureSource, { recursive: true });
  symlinkSync(path.join(repository, "node_modules"), path.join(fixture, "node_modules"), "dir");
  const operationHash = "a".repeat(64);
  const tokenHash = "b".repeat(64);
  const replacementHash = "c".repeat(64);
  const source = { sha: "d".repeat(40), treeHash: "e".repeat(40), buildHash: "f".repeat(64) };
  const processIdentityHash = "1".repeat(64);
  const generationHash = "2".repeat(64);
  writeFileSync(path.join(fixtureSource, "internal-production/baseline-spawner-startup-admission-v1.ts"), `
const operation={operationRef:${JSON.stringify(`setfarm://internal-production/current-entry-operation/sha256/${operationHash}`)},operationHash:${JSON.stringify(operationHash)}};
const startupToken={startupTokenRef:${JSON.stringify(`setfarm://internal-production/pre-schema-spawner-startup-token/sha256/${tokenHash}`)},startupTokenHash:${JSON.stringify(tokenHash)}};
const replacementProcessObservation={replacementProcessObservationRef:${JSON.stringify(`setfarm://internal-production/pre-schema-spawner-replacement-process-observation/sha256/${replacementHash}`)},replacementProcessObservationHash:${JSON.stringify(replacementHash)}};
export async function observeInternalProductionPreSchemaSpawnerRebindStatusV1(){return {state:"pre_manifest_bootstrap_sealed",currentEntryOperation:operation,startupToken,dispatchPrefix:{replacementProcessObservation}}}
export async function resolveInternalProductionPreSchemaSpawnerStartupTokenV1(){return {startupMode:"pre-manifest-bootstrap-sealed",currentEntryOperationRef:operation.operationRef,currentEntryOperationHash:operation.operationHash,task0SpawnerSourceSha:${JSON.stringify(source.sha)},task0SpawnerTreeHash:${JSON.stringify(source.treeHash)},task0SpawnerBuildHash:${JSON.stringify(source.buildHash)}}}
export async function resolveInternalProductionPreSchemaSpawnerReplacementProcessObservationV1(){return {replacementSpawnerProcessIdentityHash:${JSON.stringify(processIdentityHash)},actualSpawnerGenerationHash:${JSON.stringify(generationHash)},actualSpawnerSourceSha:${JSON.stringify(source.sha)},actualSpawnerTreeHash:${JSON.stringify(source.treeHash)},actualSpawnerBuildHash:${JSON.stringify(source.buildHash)}}}
`, "utf8");
  writeFileSync(path.join(fixtureSource, "internal-production/baseline-post-handoff-receipt-v1.ts"), `
export function observeCurrentInternalProductionCleanSetfarmSourceBuildV1(){return ${JSON.stringify(source)}}
export async function observeInternalProductionServiceCensusV1(){return {spawner:{processIdentityHash:${JSON.stringify(processIdentityHash)},generationHash:${JSON.stringify(generationHash)}}}}
`, "utf8");
  const spawnerPath = path.join(fixtureSource, "spawner.ts");
  let spawnerBytes = readFileSync(spawnerPath, "utf8")
    .replace('const PID_FILE = path.join(os.homedir(), ".openclaw", "setfarm", "spawner.pid");', `const PID_FILE = ${JSON.stringify(pidFile)};`)
    .replace('const LOCK_FILE = path.join(os.homedir(), ".openclaw", "setfarm", "spawner.lock");', `const LOCK_FILE = ${JSON.stringify(lockFile)};`)
    .replace("  assertAgentRuntimeAvailable();", `  fs.appendFileSync(${JSON.stringify(normalMarker)},"runtime\\n");\n  assertAgentRuntimeAvailable();`)
    .replace("  await pgMigrate();", `  fs.appendFileSync(${JSON.stringify(normalMarker)},"migration\\n");\n  await pgMigrate();`)
    .replace("  const listener = postgres(pgUrl, { max: 1 });", `  fs.appendFileSync(${JSON.stringify(normalMarker)},"listener\\n");\n  const listener = postgres(pgUrl, { max: 1 });`)
    .replace("if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {", "if (true) {");
  writeFileSync(spawnerPath, spawnerBytes);
  writeFileSync(path.join(fixture, "package.json"), `${JSON.stringify({ type: "module" })}\n`);
  const child = spawn(process.execPath, ["--import", import.meta.resolve("tsx"), spawnerPath], {
    cwd: fixture,
    env: { ...process.env, SETFARM_PG_URL: "postgresql://sealed.invalid/must-not-connect", SETFARM_AGENT_RUNTIME: "codex" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let stdout = "";
  let stderr = "";
  child.stdout.setEncoding("utf8"); child.stderr.setEncoding("utf8");
  child.stdout.on("data", (chunk: string) => { stdout += chunk; });
  child.stderr.on("data", (chunk: string) => { stderr += chunk; });
  try {
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error(`sealed spawner did not wait: ${stderr}`)), 10_000);
      const inspect = () => {
        if (!stdout.includes("Pre-manifest bootstrap sealed")) return;
        clearTimeout(timeout);
        resolve();
      };
      child.stdout.on("data", inspect);
      child.once("exit", (code, signal) => { clearTimeout(timeout); reject(new Error(`sealed spawner exited early code=${code} signal=${signal}: ${stderr}`)); });
    });
    assert.equal(existsSync(pidFile), true);
    assert.equal(existsSync(lockFile), true);
    assert.equal(existsSync(normalMarker), false);
    child.kill("SIGTERM");
    const exit = await new Promise<Readonly<{ code: number | null; signal: NodeJS.Signals | null }>>((resolve) => child.once("close", (code, signal) => resolve({ code, signal })));
    assert.deepEqual(exit, { code: 0, signal: null });
    assert.equal(existsSync(pidFile), false);
    assert.equal(existsSync(lockFile), false);
    assert.equal(existsSync(normalMarker), false);
  } finally {
    if (child.exitCode === null && child.signalCode === null) child.kill("SIGKILL");
    rmSync(fixture, { recursive: true, force: true });
  }
});

test("P3 runner freezes the complete secure physical-mode domain before projection", () => {
  const runner = readFileSync(path.join(process.cwd(), "scripts/run-isolated-postgres-tests.ts"), "utf8");
  const match = /function isAcceptedPinnedGitPhysicalModeV1\(gitMode: string, physicalMode: number\): boolean \{[\s\S]*?\n\}/.exec(runner);
  assert.ok(match, "runner private physical-mode predicate must remain source-visible");
  const executablePredicate = match[0].replace(
    "(gitMode: string, physicalMode: number): boolean",
    "(gitMode, physicalMode)",
  );
  const predicate = Function(`${executablePredicate}; return isAcceptedPinnedGitPhysicalModeV1;`)() as (
    gitMode: string,
    physicalMode: number,
  ) => boolean;
  for (const gitMode of ["100644", "100755"]) {
    const declaredMode = gitMode === "100755" ? 0o755 : 0o644;
    const requiredMode = gitMode === "100755" ? 0o500 : 0o400;
    for (let physicalMode = 0; physicalMode <= 0o7777; physicalMode += 1) {
      const expected = (physicalMode & (0o7777 ^ declaredMode)) === 0
        && (physicalMode & requiredMode) === requiredMode;
      assert.equal(predicate(gitMode, physicalMode), expected, `${gitMode}:${physicalMode.toString(8)}`);
    }
  }
  assert.equal(predicate("100600", 0o600), false);
  assert.match(runner, /sourcePhysicalMode: observed\.physicalMode/);
  assert.match(runner, /reopened\.physicalMode !== observation\.sourcePhysicalMode/);
  assert.match(runner, /writeFileSync\(target, bytes, \{ mode: expectedMode \}\)/);
  assert.match(runner, /chmodSync\(target, expectedMode\)/);
});

test("P3 runner refuses every constructible indexed and physical projection drift before child spawn", async () => {
  if (!process.env.SETFARM_PG_URL?.includes("/setfarm_p3_")) return;
  const member = "src/execution/attempt-repository.ts";
  const cases: ReadonlyArray<Readonly<{
    label: string;
    expected: RegExp;
    mutate: (root: string) => void;
  }>> = [
    {
      label: "foreign tracked modification",
      expected: /P3_PROJECTION_TRACKED_SCOPE_INVALID:package\.json/,
      mutate: (root) => writeFileSync(
        path.join(root, "package.json"),
        `${readFileSync(path.join(root, "package.json"), "utf8")} `,
      ),
    },
    {
      label: "unexpected nonignored P3 path",
      expected: /P3_PROJECTION_UNTRACKED_SCOPE_INVALID:src\/execution\/p3-unexpected\.ts/,
      mutate: (root) => writeFileSync(path.join(root, "src/execution/p3-unexpected.ts"), "export {};\n"),
    },
    {
      label: "missing tracked member",
      expected: /ENOENT|P3_PROJECTION_MEMBER_INVALID/,
      mutate: (root) => rmSync(path.join(root, member)),
    },
    {
      label: "worktree symlink",
      expected: /P3_PROJECTION_MEMBER_INVALID/,
      mutate: (root) => {
        rmSync(path.join(root, member));
        symlinkSync(path.join(root, "package.json"), path.join(root, member));
      },
    },
    {
      label: "worktree directory",
      expected: /P3_PROJECTION_MEMBER_INVALID/,
      mutate: (root) => {
        rmSync(path.join(root, member));
        mkdirSync(path.join(root, member));
      },
    },
    {
      label: "worktree FIFO",
      expected: /P3_PROJECTION_MEMBER_INVALID/,
      mutate: (root) => {
        rmSync(path.join(root, member));
        execFileSync("/usr/bin/mkfifo", [path.join(root, member)]);
      },
    },
    {
      label: "multiply-linked worktree member",
      expected: /P3_PROJECTION_MEMBER_INVALID/,
      mutate: (root) => linkSync(path.join(root, member), path.join(root, ".git/p3-hardlink-member")),
    },
    {
      label: "fixture-private wrong source uid",
      expected: /P3_PROJECTION_MEMBER_INVALID/,
      mutate: (root) => {
        const runnerPath = path.join(root, "scripts/run-isolated-postgres-tests.ts");
        const source = readFileSync(runnerPath, "utf8");
        const boundary = "const currentUid = process.getuid?.();";
        assert.equal(source.includes(boundary), true);
        writeFileSync(runnerPath, source.replace(boundary, "const currentUid = (process.getuid?.() ?? 0) + 1;"));
      },
    },
    {
      label: "fixture-private wrong source device",
      expected: /P3_PROJECTION_MEMBER_INVALID/,
      mutate: (root) => {
        const runnerPath = path.join(root, "scripts/run-isolated-postgres-tests.ts");
        const source = readFileSync(runnerPath, "utf8");
        const boundary = "const sourceDevice = lstatSync(SOURCE_ROOT, { bigint: true }).dev;";
        assert.equal(source.includes(boundary), true);
        writeFileSync(runnerPath, source.replace(boundary, `${boundary.slice(0, -1)} + 1n;`));
      },
    },
    {
      label: "executable bit drift",
      expected: /P3_PROJECTION_MEMBER_INVALID/,
      mutate: (root) => chmodSync(path.join(root, member), 0o755),
    },
    {
      label: "group-writable non-executable member",
      expected: /P3_PROJECTION_MEMBER_INVALID/,
      mutate: (root) => chmodSync(path.join(root, member), 0o660),
    },
    {
      label: "world-writable non-executable member",
      expected: /P3_PROJECTION_MEMBER_INVALID/,
      mutate: (root) => chmodSync(path.join(root, member), 0o602),
    },
    {
      label: "special-bit non-executable member",
      expected: /P3_PROJECTION_MEMBER_INVALID/,
      mutate: (root) => chmodSync(path.join(root, member), 0o4600),
    },
    {
      label: "indexed executable missing owner execute",
      expected: /P3_PROJECTION_MEMBER_INVALID/,
      mutate: (root) => {
        p3TestGit(root, ["update-index", "--chmod=+x", member]);
        chmodSync(path.join(root, member), 0o644);
      },
    },
    {
      label: "indexed executable with world write",
      expected: /P3_PROJECTION_MEMBER_INVALID/,
      mutate: (root) => {
        p3TestGit(root, ["update-index", "--chmod=+x", member]);
        chmodSync(path.join(root, member), 0o757);
      },
    },
    {
      label: "120000 index symlink",
      expected: /P3_PROJECTION_INDEX_ENTRY_INVALID/,
      mutate: (root) => {
        const blob = p3TestGit(root, ["hash-object", "-w", "--stdin"], "package.json\n");
        p3TestGit(root, ["update-index", "--add", "--cacheinfo", `120000,${blob},${member}`]);
      },
    },
    {
      label: "160000 index submodule",
      expected: /P3_PROJECTION_INDEX_ENTRY_INVALID/,
      mutate: (root) => {
        const commit = p3TestGit(root, ["rev-parse", "HEAD"]);
        p3TestGit(root, ["update-index", "--add", "--cacheinfo", `160000,${commit},${member}`]);
      },
    },
    {
      label: "non-stage-zero index",
      expected: /P3_PROJECTION_GIT_FAILED:status|P3_PROJECTION_INDEX_ENTRY_INVALID/,
      mutate: (root) => {
        const blob = p3TestGit(root, ["rev-parse", `HEAD:${member}`]);
        p3TestGit(root, ["update-index", "--force-remove", member]);
        p3TestGit(root, ["update-index", "--index-info"],
          `100644 ${blob} 1\t${member}\n100644 ${blob} 2\t${member}\n`);
      },
    },
  ];
  for (const fixtureCase of cases) {
    const fixture = createP3RunnerRefusalFixture();
    try {
      fixtureCase.mutate(fixture.root);
      const result = await spawnP3NestedRunner(fixture.root).completed;
      assert.notEqual(result.status, 0, fixtureCase.label);
      assert.match(result.output, fixtureCase.expected, fixtureCase.label);
      assert.doesNotMatch(result.output, /cloned setfarm_p3_|tests [0-9]+/i, fixtureCase.label);
      assert.deepEqual(
        result.temporaryEntries.filter((entry) => entry.startsWith("setfarm-p3-projection-")),
        [],
        fixtureCase.label,
      );
    } finally {
      fixture.cleanup();
    }
  }

  const socketFixture = createP3RunnerRefusalFixture();
  const socketPath = path.join(socketFixture.root, member);
  rmSync(socketPath);
  const server = createServer();
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(socketPath, resolve);
  });
  try {
    const result = await spawnP3NestedRunner(socketFixture.root).completed;
    assert.notEqual(result.status, 0);
    assert.match(result.output, /P3_PROJECTION_MEMBER_INVALID/);
    assert.doesNotMatch(result.output, /cloned setfarm_p3_|tests [0-9]+/i);
    assert.deepEqual(
      result.temporaryEntries.filter((entry) => entry.startsWith("setfarm-p3-projection-")),
      [],
    );
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    socketFixture.cleanup();
  }

  const runner = readFileSync(
    path.join(process.cwd(), "scripts/run-isolated-postgres-tests.ts"),
    "utf8",
  );
  assert.match(runner, /path\.isAbsolute\(locator\) \|\| locator\.split\("\/"\)\.includes\("\.\."\)/);
  assert.match(runner, /!first\.isFile\(\)/);
  assert.match(runner, /O_RDONLY \| fsConstants\.O_NOFOLLOW/);
  assert.match(runner, /sourcePhysicalMode: observed\.physicalMode/);
  assert.match(runner, /reopened\.physicalMode !== observation\.sourcePhysicalMode/);
  assert.doesNotMatch(runner, /chmodSync\(source[,)]/);
  for (const locator of [
    "scripts/build-generation-retention.mjs",
    "scripts/run-isolated-postgres-tests.ts",
    "scripts/write-build-info.mjs",
    "src/internal-production/baseline-post-handoff-receipt-v1.ts",
  ]) {
    const consumer = readFileSync(path.join(process.cwd(), locator), "utf8");
    assert.equal((consumer.match(/function isAcceptedPinnedGitPhysicalModeV1\(/g) ?? []).length, 1, locator);
    const predicateMatch = /function isAcceptedPinnedGitPhysicalModeV1\([^)]*\)(?:: boolean)? \{[\s\S]*?\n\}/.exec(consumer);
    assert.ok(predicateMatch, `${locator}: private physical-mode predicate must remain source-visible`);
    const executablePredicate = predicateMatch[0].replace(
      /function isAcceptedPinnedGitPhysicalModeV1\([^)]*\)(?:: boolean)? \{/,
      "function isAcceptedPinnedGitPhysicalModeV1(gitMode, physicalMode) {",
    );
    const predicate = Function(`${executablePredicate}; return isAcceptedPinnedGitPhysicalModeV1;`)() as (
      gitMode: string,
      physicalMode: number,
    ) => boolean;
    for (const gitMode of ["100644", "100755"] as const) {
      const declaredMode = gitMode === "100755" ? 0o755 : 0o644;
      const requiredMode = gitMode === "100755" ? 0o500 : 0o400;
      for (let physicalMode = 0; physicalMode <= 0o7777; physicalMode += 1) {
        const expected = (physicalMode & (0o7777 ^ declaredMode)) === 0
          && (physicalMode & requiredMode) === requiredMode;
        assert.equal(predicate(gitMode, physicalMode), expected, `${locator}:${gitMode}:${physicalMode.toString(8)}`);
      }
    }
    assert.equal(predicate("100600", 0o600), false, locator);
    assert.match(consumer, /0o7777 \^ (?:declaredMode|expectedMode)/, locator);
    assert.match(consumer, /requiredMode = .*0o500.*0o400/, locator);
    assert.match(consumer, /(?:observed\.stats|first)\.uid !== BigInt\((?:process\.getuid\(\)|currentUid)\)/, locator);
    assert.match(consumer, /process\.getuid/, locator);
    assert.match(consumer, /O_NOFOLLOW/, locator);
    assert.match(consumer, /(?:nlink|linkCounts|expectedLinkCount)/, locator);
    assert.match(consumer, /(?:device|expectedDevice|rootDevice)/, locator);
    assert.match(consumer, /\.ino|inoDecimal/, locator);
    assert.match(consumer, /\.size|byteLength/, locator);
    assert.match(consumer, /mtimeNs/, locator);
    assert.match(consumer, /ctimeNs/, locator);
    assert.doesNotMatch(consumer, /export\s+function isAcceptedPinnedGitPhysicalModeV1\(/, locator);
    assert.doesNotMatch(consumer, /process\.env\.[A-Z0-9_]*MODE|physicalMode\s*=\s*process\.env/, locator);
  }
});

test("P3 runner independently projects each new exact51 overlay after scope expansion", () => {
  const newlyAuthorized = [
    "src/db/contract-spine-migrations.ts",
    "src/db/contract-spine-migration-source-integrity.ts",
    "src/db/contract-spine-migration-digests.generated.ts",
    "tests/execution-attempts/migrations.test.ts",
    "tests/execution-attempts/migration-source-digests.test.ts",
  ] as const;
  for (const locator of newlyAuthorized) {
    const fixture = createP3RunnerRefusalFixture();
    try {
      writeFileSync(
        path.join(fixture.root, locator),
        `${readFileSync(path.join(fixture.root, locator), "utf8")}\n// exact51 GREEN: ${locator}\n`,
      );
      writeFileSync(
        path.join(fixture.root, "tests/internal-production/task-0-source-manifest.test.ts"),
        `import assert from "node:assert/strict";\nimport { readFileSync } from "node:fs";\nimport test from "node:test";\ntest("projects exact51 member", () => { assert.equal(readFileSync(${JSON.stringify(locator)}, "utf8").includes(${JSON.stringify(`// exact51 GREEN: ${locator}`)}), true); });\n`,
      );
      const result = runP3NestedRunner(fixture.root);
      assert.equal(result.status, 0, `${locator}\n${result.output}`);
      assert.doesNotMatch(result.output, /P3_PROJECTION_TRACKED_SCOPE_INVALID/, locator);
      assert.match(result.output, /cloned setfarm_p3_[a-f0-9]{24}_primary from setfarm_p3_[a-f0-9]{24}_template/, locator);
      assert.match(result.output, /tests 1/, locator);
    } finally {
      fixture.cleanup();
    }
  }
});

test("P3 marker and FD3 authentication reject malformed crossed stale and replayed authority", async () => {
  if (!process.env.SETFARM_PG_URL?.includes("/setfarm_p3_")) return;
  const setupNonce = Buffer.alloc(32, 0x31);
  const testNonce = Buffer.alloc(32, 0x32);
  const setupFrame = Buffer.from(
    `SETFARM_P3_PROJECTION_CAPABILITY_V1:setup:${setupNonce.toString("hex")}\n`,
    "ascii",
  );
  const testFrame = Buffer.from(
    `SETFARM_P3_PROJECTION_CAPABILITY_V1:test:${testNonce.toString("hex")}\n`,
    "ascii",
  );
  const rows: ReadonlyArray<Readonly<{
    label: string;
    frame: Buffer;
    mutate?: (marker: P3SyntheticMarkerV1) => P3SyntheticMarkerV1;
    replay?: boolean;
    authenticateOnly?: boolean;
    expected: RegExp;
  }>> = [
    { label: "malformed", frame: Buffer.from("invalid\n"), expected: /P3_PROJECTION_CAPABILITY_INVALID/ },
    { label: "duplicate/replayed frame", frame: Buffer.concat([setupFrame, setupFrame]), expected: /P3_PROJECTION_CAPABILITY_INVALID/ },
    { label: "trailing", frame: Buffer.concat([setupFrame, Buffer.from("x")]), expected: /P3_PROJECTION_CAPABILITY_INVALID/ },
    { label: "setup/test nonce crossing", frame: Buffer.from(`SETFARM_P3_PROJECTION_CAPABILITY_V1:setup:${testNonce.toString("hex")}\n`), expected: /P3_PROJECTION_CAPABILITY_INVALID/ },
    { label: "wrong direct role", frame: testFrame, expected: /'test'\s*!==\s*'setup'|Expected values to be strictly equal/ },
    { label: "wrong root", frame: setupFrame, mutate: (marker) => ({ ...marker, projectionRoot: path.dirname(marker.projectionRoot) }), expected: /projectionRoot|Expected values to be strictly equal/ },
    { label: "stale HEAD", frame: setupFrame, mutate: (marker) => ({ ...marker, projectedHead: "0".repeat(40) }), expected: /projectedHead|Expected values to be strictly equal/ },
    { label: "wrong template", frame: setupFrame, mutate: (marker) => ({ ...marker, templateDatabaseName: `${marker.runDatabasePrefix}_primary` }), expected: /templateDatabaseName|Expected values to be strictly equal/ },
    { label: "wrong prefix", frame: setupFrame, mutate: (marker) => ({ ...marker, runDatabasePrefix: "setfarm_p3_1234" }), expected: /runDatabasePrefix|match/ },
    { label: "wrong admin hash", frame: setupFrame, mutate: (marker) => ({ ...marker, adminUrlSha256: "0".repeat(64) }), expected: /P3_PROJECTION_ADMIN_URL_INVALID/ },
    { label: "same setup/test nonce digest", frame: Buffer.from(`SETFARM_P3_PROJECTION_CAPABILITY_V1:test:${setupNonce.toString("hex")}\n`), authenticateOnly: true, mutate: (marker) => ({ ...marker, testNonceSha256: marker.setupNonceSha256 }), expected: /P3_PROJECTION_CAPABILITY_NONCES_INVALID/ },
  ];
  for (const row of rows) {
    const fixture = createP3RunnerRefusalFixture();
    try {
      writeP3SyntheticMarker(fixture.root, setupNonce, testNonce, row.mutate);
      const result = await runP3CapabilityChild({
        root: fixture.root,
        frame: row.frame,
        replay: row.replay,
        authenticateOnly: row.authenticateOnly,
      });
      assert.notEqual(result.status, 0, row.label);
      assert.match(result.output, row.expected, row.label);
    } finally {
      fixture.cleanup();
    }
  }

  const noDescriptor = createP3RunnerRefusalFixture();
  try {
    writeP3SyntheticMarker(noDescriptor.root, setupNonce, testNonce);
    const result = await runP3CapabilityChild({ root: noDescriptor.root });
    assert.notEqual(result.status, 0);
    assert.match(result.output, /P3_PROJECTION_CAPABILITY_INVALID/);
  } finally {
    noDescriptor.cleanup();
  }

  const markerGraph = createP3RunnerRefusalFixture();
  const moduleGraph = createP3RunnerRefusalFixture();
  try {
    writeP3SyntheticMarker(markerGraph.root, setupNonce, testNonce);
    const result = await runP3CapabilityChild({
      root: markerGraph.root,
      helperRoot: moduleGraph.root,
      frame: testFrame,
      authenticateOnly: true,
    });
    assert.notEqual(result.status, 0);
    assert.match(result.output, /P3_PROJECTION_MODULE_ROOT_INVALID/);
  } finally {
    markerGraph.cleanup();
    moduleGraph.cleanup();
  }
});

test("P3 runner refuses primary readiness tamper and projection-time source drift", async () => {
  if (!process.env.SETFARM_PG_URL?.includes("/setfarm_p3_")) return;
  const tamperedPrimary = createP3RunnerRefusalFixture();
  try {
    const runnerPath = path.join(tamperedPrimary.root, "scripts/run-isolated-postgres-tests.ts");
    const source = readFileSync(runnerPath, "utf8");
    const anchor = "    await cloneDatabaseV1(adminUrl, primaryDatabaseName, templateDatabaseName);\n";
    assert.equal(source.includes(anchor), true);
    writeFileSync(runnerPath, source.replace(anchor, `${anchor}    const tamperSql = postgres(primaryUrl.toString(), { max: 1 });\n    await tamperSql.unsafe("SET session_replication_role=replica");\n    await tamperSql.unsafe("UPDATE internal_production_owner_producer_manifest_set_activations_v1 SET canonical_body='{}'");\n    await tamperSql.unsafe("SET session_replication_role=origin");\n    await tamperSql.end({ timeout: 5 });\n`));
    p3TestGit(tamperedPrimary.root, ["add", runnerPath]);
    p3TestGit(tamperedPrimary.root, ["commit", "-qm", "tamper primary before test spawn"]);
    const result = runP3NestedRunner(tamperedPrimary.root);
    assert.notEqual(result.status, 0);
    assert.match(result.output, /P3_PRIMARY_VERIFICATION_FAILED/);
  } finally {
    tamperedPrimary.cleanup();
  }

  const tamperedReadiness = createP3RunnerRefusalFixture();
  try {
    const runnerPath = path.join(tamperedReadiness.root, "scripts/run-isolated-postgres-tests.ts");
    const source = readFileSync(runnerPath, "utf8");
    const anchor = "    await cloneDatabaseV1(adminUrl, primaryDatabaseName, templateDatabaseName);\n";
    assert.equal(source.includes(anchor), true);
    writeFileSync(runnerPath, source.replace(anchor, `${anchor}    const readinessPath = path.join(projection.root, "src/internal-production/baseline-spawner-startup-admission-v1.js");\n    const readinessBytes = readFileSync(readinessPath, "utf8");\n    const crossedReadiness = readinessBytes.replace(/"admissionReadyHash":"[a-f0-9]{64}"/, '"admissionReadyHash":"${"0".repeat(64)}"');\n    if (crossedReadiness === readinessBytes) throw new Error("TEST_READINESS_TAMPER_NOT_APPLIED");\n    writeFileSync(readinessPath, crossedReadiness, { mode: 0o600 });\n`));
    p3TestGit(tamperedReadiness.root, ["add", runnerPath]);
    p3TestGit(tamperedReadiness.root, ["commit", "-qm", "cross readiness before test spawn"]);
    const result = runP3NestedRunner(tamperedReadiness.root);
    assert.notEqual(result.status, 0);
    assert.match(result.output, /P3_PRIMARY_VERIFICATION_FAILED/);
  } finally {
    tamperedReadiness.cleanup();
  }

  const driftingSource = createP3RunnerRefusalFixture();
  try {
    const ballast = path.join(driftingSource.root, "src/execution/attempt-repository.ts");
    writeFileSync(ballast, `${readFileSync(ballast, "utf8")}\n${"x".repeat(32 * 1024 * 1024)}\n`);
    p3TestGit(driftingSource.root, ["add", ballast]);
    p3TestGit(driftingSource.root, ["commit", "-qm", "slow projection copy"]);
    const running = spawnP3NestedRunner(driftingSource.root);
    await waitForP3ConditionV1(() => readdirSync(running.temporaryRoot).some((name) => name.startsWith("setfarm-p3-projection-")) || null, "projection creation");
    const late = path.join(driftingSource.root, "tests/steps/harness.ts");
    writeFileSync(late, `${readFileSync(late, "utf8")}\n// concurrent P3 drift\n`);
    const result = await running.completed;
    assert.notEqual(result.status, 0);
    assert.match(result.output, /P3_PROJECTION_SOURCE_CHANGED/);
  } finally {
    driftingSource.cleanup();
  }

  const driftingMode = createP3RunnerRefusalFixture();
  try {
    const ballast = path.join(driftingMode.root, "tests/steps/harness.ts");
    writeFileSync(ballast, `${readFileSync(ballast, "utf8")}\n${"x".repeat(32 * 1024 * 1024)}\n`);
    p3TestGit(driftingMode.root, ["add", ballast]);
    p3TestGit(driftingMode.root, ["commit", "-qm", "slow projection mode observation"]);
    const late = path.join(driftingMode.root, "package.json");
    chmodSync(late, 0o600);
    const running = spawnP3NestedRunner(driftingMode.root);
    await waitForP3ConditionV1(
      () => {
        const parent = readdirSync(running.temporaryRoot).find((name) => name.startsWith("setfarm-p3-projection-"));
        if (!parent) return null;
        const projected = path.join(running.temporaryRoot, parent, "setfarm", "package.json");
        return existsSync(projected) ? projected : null;
      },
      "projected package after first source mode observation",
    );
    chmodSync(late, 0o640);
    const result = await running.completed;
    assert.notEqual(result.status, 0);
    assert.match(result.output, /P3_PROJECTION_SOURCE_CHANGED/);
  } finally {
    driftingMode.cleanup();
  }
});

test("P3 runner cleans setup primary crash and signal failures without crossing a foreign prefix", async () => {
  if (!process.env.SETFARM_PG_URL?.includes("/setfarm_p3_")) return;
  const adminUrl = new URL(
    process.env.SETFARM_TEST_PG_ADMIN_URL ?? "postgresql://setrox@localhost:5432/postgres",
  );
  adminUrl.pathname = "/postgres";
  const admin = postgres(adminUrl.toString(), {
    max: 2,
    connect_timeout: 5,
    idle_timeout: 1,
    onnotice: () => {},
  });
  const foreignDatabase = "setfarm_p3_ffffffffffffffffffffffff_primary";
  try {
    await admin.unsafe(`DROP DATABASE IF EXISTS "${foreignDatabase}"`);
    await admin.unsafe(`CREATE DATABASE "${foreignDatabase}"`);
    const baseline = await p3DatabaseInventoryV1(admin);
    assert.equal(baseline.includes(foreignDatabase), true);

    const setupLoss = createP3RunnerRefusalFixture();
    try {
      const running = spawnP3NestedRunner(setupLoss.root);
      const template = await waitForP3ConditionV1(async () => {
        const current = await p3DatabaseInventoryV1(admin);
        return current.find((name) => !baseline.includes(name) && name.endsWith("_template")) ?? null;
      }, "setup template creation");
      const setupPid = await waitForP3ConditionV1(() => {
        const rows = execFileSync("/bin/ps", ["-axo", "pid=,ppid=,command="], { encoding: "utf8" });
        for (const row of rows.split("\n")) {
          const match = /^\s*([0-9]+)\s+([0-9]+)\s+(.+)$/.exec(row);
          if (
            match
            && Number(match[2]) === running.pid
            && match[3]!.includes("tests/execution-attempts/test-database.ts")
          ) return Number(match[1]);
        }
        return null;
      }, "setup child pid");
      process.kill(setupPid, "SIGKILL");
      const result = await running.completed;
      assert.notEqual(result.status, 0);
      assert.match(result.output, /ISOLATED_TEST_COMMAND_SIGNAL:SIGKILL|P3_TEMPLATE_SETUP_FAILED/);
      assert.match(template, /^setfarm_p3_[a-f0-9]{24}_template$/);
      assert.deepEqual(await p3DatabaseInventoryV1(admin), baseline);
    } finally {
      setupLoss.cleanup();
    }

    const moduleLoss = createP3RunnerRefusalFixture();
    try {
      const helperPath = path.join(moduleLoss.root, "tests/execution-attempts/test-database.ts");
      const helperSource = readFileSync(helperPath, "utf8");
      const holdAnchor = "      database,\n    );\n  } catch (error) {";
      assert.equal(helperSource.includes(holdAnchor), true);
      writeFileSync(helperPath, helperSource.replace(
        holdAnchor,
        "      database,\n    );\n    await new Promise((resolve) => setTimeout(resolve, 30_000));\n  } catch (error) {",
      ));
      p3TestGit(moduleLoss.root, ["add", helperPath]);
      p3TestGit(moduleLoss.root, ["commit", "-qm", "hold after readiness publication"]);
      const running = spawnP3NestedRunner(moduleLoss.root);
      const setupPid = await waitForP3ConditionV1(() => {
        const rows = execFileSync("/bin/ps", ["-axo", "pid=,ppid=,command="], { encoding: "utf8" });
        for (const row of rows.split("\n")) {
          const match = /^\s*([0-9]+)\s+([0-9]+)\s+(.+)$/.exec(row);
          if (match && Number(match[2]) === running.pid && match[3]!.includes("test-database.ts")) {
            return Number(match[1]);
          }
        }
        return null;
      }, "module-loss setup child");
      const readinessPath = await waitForP3ConditionV1(() => {
        const lsof = execFileSync("/usr/sbin/lsof", ["-a", "-p", String(setupPid), "-d", "cwd", "-Fn"], { encoding: "utf8" });
        const cwd = lsof.split("\n").find((line) => line.startsWith("n"))?.slice(1);
        if (!cwd) return null;
        const candidate = path.join(cwd, "src/internal-production/baseline-spawner-startup-admission-v1.js");
        return statSync(candidate, { throwIfNoEntry: false })?.isFile() ? candidate : null;
      }, "readiness module publication");
      assert.match(readinessPath, /baseline-spawner-startup-admission-v1\.js$/);
      process.kill(setupPid, "SIGKILL");
      const result = await running.completed;
      assert.notEqual(result.status, 0);
      assert.match(result.output, /ISOLATED_TEST_COMMAND_SIGNAL:SIGKILL|P3_TEMPLATE_SETUP_FAILED/);
      assert.deepEqual(await p3DatabaseInventoryV1(admin), baseline);
    } finally {
      moduleLoss.cleanup();
    }

    const primaryFailure = createP3RunnerRefusalFixture();
    try {
      const running = spawnP3NestedRunner(primaryFailure.root);
      const template = await waitForP3ConditionV1(async () => {
        const current = await p3DatabaseInventoryV1(admin);
        return current.find((name) => !baseline.includes(name) && name.endsWith("_template")) ?? null;
      }, "primary-failure template creation");
      const primary = template.replace(/_template$/, "_primary");
      await admin.unsafe(`CREATE DATABASE "${primary}"`);
      const result = await running.completed;
      assert.notEqual(result.status, 0);
      assert.match(result.output, /database .*_primary.* already exists/i);
      assert.deepEqual(await p3DatabaseInventoryV1(admin), baseline);
    } finally {
      primaryFailure.cleanup();
    }

    for (const [label, terminalSource, expected] of [
      [
        "test crash",
        `import test from "node:test"; test("P3 forced crash", () => process.exit(91));\n`,
        /P3 forced crash|dropped setfarm_p3_/,
      ],
      [
        "test signal",
        `import test from "node:test"; test("P3 forced signal", () => process.kill(process.pid, "SIGKILL"));\n`,
        /ISOLATED_TEST_COMMAND_SIGNAL:SIGKILL/,
      ],
    ] as const) {
      const fixture = createP3RunnerRefusalFixture();
      try {
        writeFileSync(
          path.join(fixture.root, "tests/internal-production/task-0-source-manifest.test.ts"),
          terminalSource,
        );
        const result = runP3NestedRunner(fixture.root);
        assert.notEqual(result.status, 0, label);
        assert.match(result.output, expected, label);
        assert.deepEqual(await p3DatabaseInventoryV1(admin), baseline, label);
      } finally {
        fixture.cleanup();
      }
    }
    assert.equal((await p3DatabaseInventoryV1(admin)).includes(foreignDatabase), true);
  } finally {
    await admin`SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname=${foreignDatabase} AND pid<>pg_backend_pid()`;
    await admin.unsafe(`DROP DATABASE IF EXISTS "${foreignDatabase}"`);
    await admin.end({ timeout: 5 });
  }
});

const DELIVERED_PATHS = [
  "server/routes/setfarm-operational.test.ts",
  "server/routes/setfarm-operational.ts",
  "server/services/setfarm-product-build-authority.ts",
  "server/services/setfarm-product-build-authority.test.ts",
  "src/lib/product-build-authority.ts",
  "src/components/run-detail/ProductBuildAuthority.tsx",
  "tests/product-build-authority-render.test.tsx",
  "contracts/vendor/setfarm/mission-control-contracts.v1.lock.json",
] as const;
const VENDOR_ARTIFACTS = [
  ["run-operational-snapshot.v1.compatibility.json", "run-operational-snapshot.v1.compatibility.json"],
  ["run-operational-snapshot.v1.schema.json", "run-operational-snapshot.v1.schema.json"],
  ["run-operational-snapshot.v2.compatibility.json", "run-operational-snapshot.v2.compatibility.json"],
  ["run-operational-snapshot.v2.schema.json", "run-operational-snapshot.v2.schema.json"],
  ["run-operational-snapshot.v3.compatibility.json", "run-operational-snapshot.v3.compatibility.json"],
  ["run-operational-snapshot.v3.schema.json", "run-operational-snapshot.v3.schema.json"],
  ["deployment-observation.v1.compatibility.json", "deployment-observation.v1.compatibility.json"],
  ["deployment-observation.v1.schema.json", "deployment-observation.v1.schema.json"],
  ["project-transfer-ack.v1.compatibility.json", "project-transfer-ack.v1.compatibility.json"],
  ["project-transfer-ack.v1.schema.json", "project-transfer-ack.v1.schema.json"],
  ["operational-active-run-status.v1.compatibility.json", "operational-active-run-status.v1.compatibility.json"],
  ["operational-active-run-status.v1.schema.json", "operational-active-run-status.v1.schema.json"],
] as const;

function completePbaObservation(vendorProducerCommit = GIT_A) {
  const deliveredPathBlobs = DELIVERED_PATHS.map((path, index) => ({ path, blobHash: String(index + 1).padStart(64, "0") }));
  const argv = ["node", "--import", "tsx", "--test", "server/routes/setfarm-operational.test.ts", "server/services/setfarm-product-build-authority.test.ts", "tests/product-build-authority-render.test.tsx"] as const;
  const focusedCore = {
    schema: "mission-control.product-build-authority-v2-focused-test-receipt.v1" as const,
    argv,
    commandContractHash: hashCanonicalJson({ argv }),
    testPathBlobs: [deliveredPathBlobs[0]!, deliveredPathBlobs[3]!, deliveredPathBlobs[6]!],
    exitCode: 0 as const,
    passed: true as const,
  };
  const focusedTestReceiptHash = hashCanonicalJson(focusedCore);
  const focusedTests = { ...focusedCore, focusedTestReceiptRef: `mission-control://internal-production/product-build-authority-v2-focused-test-receipt/sha256/${focusedTestReceiptHash}`, focusedTestReceiptHash };
  const artifacts = VENDOR_ARTIFACTS.map(([producer, vendored], index) => ({
    producerPath: `contracts/generated/mission-control/${producer}`,
    vendoredPath: `contracts/vendor/setfarm/${vendored}`,
    sha256: String(index + 20).padStart(64, "0"),
  }));
  const vendorCore = {
    schema: "mission-control.product-build-authority-v2-vendor-lock-projection.v1" as const,
    lockPath: "contracts/vendor/setfarm/mission-control-contracts.v1.lock.json" as const,
    producerRepository: "https://github.com/hikmetgulsesli/setfarm.git" as const,
    producerCommit: vendorProducerCommit,
    lockContentHash: deliveredPathBlobs[7]!.blobHash,
    artifacts,
    compatibilitySetHash: hashCanonicalJson({ schema: "mission-control.setfarm-contract-compatibility-set.v1", artifacts }),
  };
  const vendorLock = { ...vendorCore, vendorLockProjectionHash: hashCanonicalJson(vendorCore) };
  const evidenceCore = {
    schema: "mission-control.product-build-authority-v2-delivery-evidence.v1" as const,
    currentStatus: "current" as const,
    deliveryPrNumber: 19 as const,
    deliveryMergeSha: "240e779d78804843a1202cbf0440fe423b806b1a" as const,
    deliveryMergeAncestorOfCurrentSource: true as const,
    currentSource: { branch: "main" as const, clean: true as const, sha: vendorProducerCommit, treeHash: GIT_B, buildHash: SHA_C, originMainSha: vendorProducerCommit },
    deliveredPathBlobs,
    focusedTests,
    vendorLock,
  };
  const deliveryEvidenceHash = hashCanonicalJson(evidenceCore);
  const evidence = { ...evidenceCore, deliveryEvidenceRef: `mission-control://internal-production/product-build-authority-v2-delivery-evidence/sha256/${deliveryEvidenceHash}`, deliveryEvidenceHash };
  const response = { schema: "mission-control.product-build-authority-v2-delivery-evidence-response.v1" as const, currentStatus: "current" as const, deliveryEvidenceRef: evidence.deliveryEvidenceRef, deliveryEvidenceHash, evidence };
  parseProductBuildAuthorityV2DeliveryEvidenceResponseV1(response);
  return { schema: "setfarm.product-build-authority-v2-delivery-evidence-observation.v1" as const, observationTransport: "source-cli" as const, response } as ExactProductBuildObservation;
}

const activationFixtureSourceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function fixtureGit(root: string, args: readonly string[]): string {
  const result = spawnSync("/usr/bin/git", args, { cwd: root, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
}

function writeActivationFixtureFile(root: string, locator: string, bytes: string | Buffer, mode = 0o644): void {
  const target = path.join(root, locator);
  mkdirSync(path.dirname(target), { recursive: true, mode: 0o755 });
  writeFileSync(target, bytes);
  chmodSync(target, mode);
}

function materializeActivationFixtureBuildOutputs(root: string): void {
  const tracked = fixtureGit(root, ["ls-files", "-z"]).split("\0").filter(Boolean);
  for (const locator of tracked) {
    let output: string | null = null;
    if (locator.startsWith("src/") && locator.endsWith(".ts") && !/\.(?:d|m|c)\.ts$/.test(locator)) {
      output = `dist/${locator.slice(4, -3)}.js`;
    } else if (locator === "src/server/index.html" || locator === "src/installer/compat-rules.json" || /^src\/installer\/prompts\/[^/]+\.md$/.test(locator) || /^src\/installer\/steps\/.+\.md$/.test(locator)) {
      output = `dist/${locator.slice(4)}`;
    }
    if (output !== null) writeActivationFixtureFile(root, output, `// disposable activation fixture for ${locator}\n`, 0o600);
  }
}

function activationFixtureReceiptWithOperationPublisherV1(source: string): string {
  const start = source.indexOf("export async function prepareInternalProductionCurrentEntryOperationV1(): Promise<InternalProductionCurrentEntryOperationV1> {");
  const end = source.indexOf("\n\nexport async function resolveInternalProductionCurrentEntryOperationV1", start);
  assert.ok(start >= 0 && end > start, "activation fixture operation publisher boundary must remain exact");
  let continuationReplacements = 0;
  const fixturePublisher = source.slice(start, end)
    .replace(
      "prepareInternalProductionCurrentEntryOperationV1",
      "prepareActivationFixtureCurrentEntryOperationV1",
    )
    .replace(
      /\s+const controllerLock = await acquireTask12ControllerLockV1\(resolved\.operationHash\);\s+try \{ return await ensureTask12PreparedCurrentEntryStatusV1\(resolved\); \}\s+finally \{ releaseTask12ControllerLockV1\(controllerLock\); \}/g,
      () => {
        continuationReplacements += 1;
        return "\n    return resolved;";
      },
    );
  assert.equal(continuationReplacements, 2, "activation fixture publisher must stop at both status-continuation boundaries");
  assert.match(fixturePublisher, /export async function prepareActivationFixtureCurrentEntryOperationV1/);
  assert.doesNotMatch(fixturePublisher, /prepareInternalProductionCurrentEntryOperationV1|observeInternalProductionServiceCensusV1|ensureTask12PreparedCurrentEntryStatusV1|acquireTask12ControllerLockV1|launchctl|lsof/);
  return `${source}\n${fixturePublisher}\n`;
}

function createPreparedActivationRepositoryFixture(): Readonly<{ root: string; vendorCommit: string }> {
  const container = mkdtempSync(path.join(tmpdir(), "setfarm-activation-pg-"));
  const root = path.join(container, "setfarm");
  mkdirSync(root, { recursive: true, mode: 0o700 });
  cpSync(path.join(activationFixtureSourceRoot, "src"), path.join(root, "src"), { recursive: true });
  rmSync(path.join(
    root,
    "src/internal-production/baseline-spawner-startup-admission-v1.ts",
  ));
  for (const locator of ["package.json", "tsconfig.json", ".gitignore", "scripts/write-build-info.mjs", "scripts/build-generation-retention.mjs", "scripts/copy-step-assets.mjs", "scripts/stitch-to-jsx.mjs", "scripts/inject-version.js"]) {
    const source = path.join(activationFixtureSourceRoot, locator);
    if (readFileSync(source)) writeActivationFixtureFile(root, locator, readFileSync(source), locator.endsWith("copy-step-assets.mjs") ? 0o755 : 0o644);
  }
  fixtureGit(root, ["init", "-q", "-b", "main"]);
  fixtureGit(root, ["config", "user.name", "Setfarm Activation Test"]);
  fixtureGit(root, ["config", "user.email", "activation-test@example.invalid"]);
  fixtureGit(root, ["config", "commit.gpgsign", "false"]);
  const sourceCommonDir = fixtureGit(activationFixtureSourceRoot, ["rev-parse", "--git-common-dir"]);
  const sourceObjects = path.resolve(activationFixtureSourceRoot, sourceCommonDir, "objects");
  mkdirSync(path.join(root, ".git/objects/info"), { recursive: true });
  writeFileSync(path.join(root, ".git/objects/info/alternates"), `${sourceObjects}\n`);
  fixtureGit(root, ["update-ref", "refs/heads/main", "1d691c89760339ea905dfe17f8e9188e62603c1c"]);
  fixtureGit(root, ["reset", "--mixed", "HEAD"]);
  fixtureGit(root, ["remote", "add", "origin", "https://github.com/hikmetgulsesli/setfarm.git"]);
  fixtureGit(root, ["add", "."]);
  fixtureGit(root, ["commit", "-qm", "fixture vendor ancestor"]);
  const vendorCommit = fixtureGit(root, ["rev-parse", "HEAD"]);
  const observation = completePbaObservation(vendorCommit);
  writeActivationFixtureFile(root, "src/internal-production/product-build-authority-v2-delivery-evidence-v1.ts", `const observation=${JSON.stringify(observation)}; export async function observeCurrentProductBuildAuthorityV2DeliveryEvidenceV1(){return structuredClone(observation)} export function parseProductBuildAuthorityV2DeliveryEvidenceResponseV1(value){return value}\n`);
  const receiptLocator = "src/internal-production/baseline-post-handoff-receipt-v1.ts";
  writeActivationFixtureFile(
    root,
    receiptLocator,
    activationFixtureReceiptWithOperationPublisherV1(readFileSync(path.join(root, receiptLocator), "utf8")),
  );
  fixtureGit(root, ["add", "src/internal-production/product-build-authority-v2-delivery-evidence-v1.ts", receiptLocator]);
  fixtureGit(root, ["commit", "-qm", "fixture controller source"]);
  fixtureGit(root, ["update-ref", "refs/remotes/origin/main", "HEAD"]);
  for (const entry of fixtureGit(root, ["ls-files", "-s", "-z"]).split("\0").filter(Boolean)) {
    const match = /^(100644|100755) [a-f0-9]+ 0\t(.+)$/.exec(entry);
    assert.ok(match, `unexpected fixture Git entry: ${entry}`);
    chmodSync(path.join(root, match[2]!), match[1] === "100755" ? 0o755 : 0o644);
  }
  const prepared = spawnSync(process.execPath, ["scripts/write-build-info.mjs", "--prepare"], { cwd: root, encoding: "utf8" });
  assert.equal(prepared.status, 0, prepared.stderr);
  materializeActivationFixtureBuildOutputs(root);
  const finalized = spawnSync(process.execPath, ["scripts/write-build-info.mjs", "--finalize"], { cwd: root, encoding: "utf8" });
  assert.equal(finalized.status, 0, finalized.stderr);
  symlinkSync(path.join(activationFixtureSourceRoot, "node_modules"), path.join(root, "node_modules"), "dir");
  writeFileSync(path.join(root, ".git/info/exclude"), "node_modules\n");
  return Object.freeze({ root, vendorCommit });
}

let activatedOwnerAdmissionFixture: Readonly<{
  root: string;
  db: typeof import("../../src/db-pg.js");
  sql: ReturnType<typeof import("../../src/db-pg.js")["getSql"]>;
  backendWorker: Worker;
}> | null = null;

type ProductBuildObservationFromOwnerCore =
  InternalProductionOwnerProducerSourceBuildAuthorityAV1[
    "productBuildAuthorityV2Observation"
  ];

type ExactProductBuildObservation = import(
  "../../src/internal-production/product-build-authority-v2-delivery-evidence-v1.js"
).ProductBuildAuthorityV2DeliveryEvidenceObservationV1;
type AssertCompileTimeTrue<Value extends true> = Value;
type OwnerCorePbaObservationIsExact = AssertCompileTimeTrue<
  ProductBuildObservationFromOwnerCore extends ExactProductBuildObservation ? true : false
>;
type ExactPbaObservationIsOwnerCore = AssertCompileTimeTrue<
  ExactProductBuildObservation extends ProductBuildObservationFromOwnerCore ? true : false
>;
const exactPbaCompileAssertions: readonly [
  OwnerCorePbaObservationIsExact,
  ExactPbaObservationIsOwnerCore,
] = [true, true];
void exactPbaCompileAssertions;

test("workflow run canonical owner identity is byte exact", async () => {
  if (process.env.SETFARM_PG_URL === undefined) return;
  const db = await import("../../src/db-pg.js");
  assert.equal(
    "resolveBoundInternalProductionWorkflowRunOwnerInTransactionV1" in db,
    false,
    "the generic bind port must own its strict post-publication reopen",
  );
  for (const runId of ["run-plain", "run/with/slash", "run % unicode-✓"] as const) {
    const encodedRunId = encodeURIComponent(runId);
    assert.deepEqual(db.createInternalProductionWorkflowRunCanonicalOwnerIdentityV1(runId), {
      schema: "setfarm.internal-production-canonical-owner-identity.v1",
      category: "run",
      ownerKey: runId,
      ownerRef: `setfarm://runs/${encodedRunId}`,
      ownerHash: hashCanonicalJson({
        schema: "setfarm.internal-production-workflow-run-owner.v1",
        runId,
      }),
    });
  }
  assert.throws(
    () => db.createInternalProductionWorkflowRunCanonicalOwnerIdentityV1(""),
    /^TypeError: INTERNAL_PRODUCTION_WORKFLOW_RUN_ID_INVALID$/,
  );
  assert.throws(
    () => db.createInternalProductionWorkflowRunCanonicalOwnerIdentityV1("\ud800"),
    /^TypeError: INTERNAL_PRODUCTION_WORKFLOW_RUN_ID_INVALID$/,
  );
});

const COMPILE_PBA_REF = "mission-control://compile-fixture" as
  ExactProductBuildObservation["response"]["deliveryEvidenceRef"];
const COMPILE_PBA_HASH = SHA_A as
  ExactProductBuildObservation["response"]["deliveryEvidenceHash"];

const incompleteProductBuildObservationCompileFixture: ProductBuildObservationFromOwnerCore = {
  schema: "setfarm.product-build-authority-v2-delivery-evidence-observation.v1",
  observationTransport: "source-cli",
  response: {
    schema: "mission-control.product-build-authority-v2-delivery-evidence-response.v1",
    currentStatus: "current",
    deliveryEvidenceRef: COMPILE_PBA_REF,
    deliveryEvidenceHash: COMPILE_PBA_HASH,
    // @ts-expect-error owner-core ABI requires the complete delivered evidence body
    evidence: {},
  },
};
void incompleteProductBuildObservationCompileFixture;

const arbitraryProductBuildObservationCompileFixture: ProductBuildObservationFromOwnerCore = {
  schema: "setfarm.product-build-authority-v2-delivery-evidence-observation.v1",
  observationTransport: "source-cli",
  response: {
    schema: "mission-control.product-build-authority-v2-delivery-evidence-response.v1",
    currentStatus: "current",
    deliveryEvidenceRef: COMPILE_PBA_REF,
    deliveryEvidenceHash: COMPILE_PBA_HASH,
    // @ts-expect-error owner-core ABI rejects an arbitrary evidence substitute
    evidence: { unexpected: true },
  },
};
void arbitraryProductBuildObservationCompileFixture;

function authorityAInput() {
  const productBuildAuthorityV2Observation = completePbaObservation();
  const evidence = productBuildAuthorityV2Observation.response.evidence;
  return {
    schema: "setfarm.internal-production-owner-producer-source-build-authority-a.v1" as const,
    plan: "A" as const,
    manifestHash: INTERNAL_PRODUCTION_OWNER_PRODUCER_MANIFEST_A_V1.manifestHash,
    currentEntryOperationRef: `setfarm://internal-production/current-entry-operation/sha256/${SHA_B}`,
    currentEntryOperationHash: SHA_B,
    setfarmSource: { branch: "main" as const, clean: true as const, sha: GIT_B, treeHash: GIT_A, buildHash: SHA_C, originMainSha: GIT_B },
    productBuildAuthorityV2DeliveryEvidenceRef: evidence.deliveryEvidenceRef,
    productBuildAuthorityV2DeliveryEvidenceHash: evidence.deliveryEvidenceHash,
    productBuildAuthorityV2Observation,
    vendorProducerCommit: GIT_A,
    vendorProducerCommitAncestorProof: {
      schema: "setfarm.internal-production-vendor-ancestor-proof.v1" as const,
      vendorProducerCommit: GIT_A,
      setfarmSourceSha: GIT_B,
      mergeBase: GIT_A,
      verified: true as const,
    },
    ownerCategoryRegistryHash: INTERNAL_PRODUCTION_OWNER_CATEGORY_REGISTRY_HASH_V1,
    ownerCategoryCensusMapHash: INTERNAL_PRODUCTION_OWNER_CATEGORY_CENSUS_MAP_HASH_V1,
  };
}

function authorityA() {
  return completeAuthorityFromInput(authorityAInput());
}

function completeAuthorityFromInput(body: ReturnType<typeof authorityAInput>) {
  const sourceBuildAuthorityHash = hashCanonicalJson(body);
  return validateInternalProductionOwnerProducerSourceBuildAuthorityV1({
    ...body,
    sourceBuildAuthorityRef: `setfarm://internal-production/owner-producer-source-build-authority/A/sha256/${sourceBuildAuthorityHash}`,
    sourceBuildAuthorityHash,
  });
}

function resignPbaObservation(observation: ExactProductBuildObservation): ExactProductBuildObservation {
  const clone = structuredClone(observation) as unknown as Record<string, any>;
  const focused = clone.response.evidence.focusedTests;
  const { focusedTestReceiptRef: _focusedRef, focusedTestReceiptHash: _focusedHash, ...focusedCore } = focused;
  focused.focusedTestReceiptHash = hashCanonicalJson(focusedCore);
  focused.focusedTestReceiptRef = `mission-control://internal-production/product-build-authority-v2-focused-test-receipt/sha256/${focused.focusedTestReceiptHash}`;
  const evidence = clone.response.evidence;
  const { deliveryEvidenceRef: _evidenceRef, deliveryEvidenceHash: _evidenceHash, ...evidenceCore } = evidence;
  evidence.deliveryEvidenceHash = hashCanonicalJson(evidenceCore);
  evidence.deliveryEvidenceRef = `mission-control://internal-production/product-build-authority-v2-delivery-evidence/sha256/${evidence.deliveryEvidenceHash}`;
  clone.response.deliveryEvidenceRef = evidence.deliveryEvidenceRef;
  clone.response.deliveryEvidenceHash = evidence.deliveryEvidenceHash;
  return clone as ExactProductBuildObservation;
}

test("pure owner-admission parser rejects malformed authority", () => {
  const authority = authorityA();
  assert.deepEqual(validateInternalProductionOwnerProducerSourceBuildAuthorityV1(authority), authority);
  assertDeepFrozen(authority, "source authority A");
  assert.throws(
    () => validateInternalProductionOwnerProducerSourceBuildAuthorityV1({ ...authority, extra: true }),
    /SOURCE_BUILD_AUTHORITY_A_KEYS_INVALID/,
  );
  assert.throws(
    () => validateInternalProductionOwnerProducerSourceBuildAuthorityV1({
      ...authority,
      vendorProducerCommit: GIT_B,
      sourceBuildAuthorityHash: hashCanonicalJson({ crossed: true }),
    }),
    /SOURCE_BUILD_AUTHORITY_A_/,
  );
});

test("source boundary keeps owner-admission PostgreSQL imports lazy", async () => {
  const source = await readFile(new URL("../../src/internal-production/owner-admission-v1.ts", import.meta.url), "utf8");
  assert.deepEqual([...source.matchAll(/^import[^;]+from\s+["']([^"']+)["'];/gm)].map((match) => match[1]), ["postgres", "../product-compiler/canonical-json.js"]);
});

test("private fake derives owner-admission projection", () => {
  const value = authorityA();
  assert.equal(value.sourceBuildAuthorityHash, hashCanonicalJson(authorityAInput()));
  assert.equal(value.sourceBuildAuthorityRef, `setfarm://internal-production/owner-producer-source-build-authority/A/sha256/${value.sourceBuildAuthorityHash}`);
});

test("owner core exposes no complete source-authority body factory", () => {
  assert.equal(
    Object.hasOwn(ownerAdmissionApi, "createInternalProductionOwnerProducerSourceBuildAuthorityAV1"),
    false,
  );
});

test("pure owner parser recursively rejects a rehashed nested PBA extra", () => {
  const input = structuredClone(authorityAInput());
  (input.productBuildAuthorityV2Observation.response.evidence.focusedTests as Record<string, unknown>).extra = true;
  input.productBuildAuthorityV2Observation = resignPbaObservation(
    input.productBuildAuthorityV2Observation,
  );
  input.productBuildAuthorityV2DeliveryEvidenceRef =
    input.productBuildAuthorityV2Observation.response.deliveryEvidenceRef;
  input.productBuildAuthorityV2DeliveryEvidenceHash =
    input.productBuildAuthorityV2Observation.response.deliveryEvidenceHash;
  assert.throws(
    () => parseProductBuildAuthorityV2DeliveryEvidenceResponseV1(
      input.productBuildAuthorityV2Observation.response,
    ),
    /PRODUCT_BUILD_AUTHORITY_V2_DELIVERY_EVIDENCE_RESPONSE_INVALID/,
  );
  assert.throws(
    () => completeAuthorityFromInput(input),
    /SOURCE_BUILD_AUTHORITY_A_PBA_INVALID/,
  );
});

test("A authority binds its literal manifest synchronized source and exact ancestor merge base", () => {
  const cases = [
    ["manifest", (input: ReturnType<typeof authorityAInput>) => { input.manifestHash = SHA_A; }],
    ["origin", (input: ReturnType<typeof authorityAInput>) => { input.setfarmSource.originMainSha = GIT_A; }],
    ["merge-base", (input: ReturnType<typeof authorityAInput>) => { input.vendorProducerCommitAncestorProof.mergeBase = GIT_B; }],
  ] as const;
  for (const [label, mutate] of cases) {
    const input = structuredClone(authorityAInput());
    mutate(input);
    assert.throws(
      () => completeAuthorityFromInput(input),
      /SOURCE_BUILD_AUTHORITY_A_(?:MANIFEST|SOURCE|ANCESTRY)_INVALID/,
      label,
    );
  }
});

test("A authority requires a proper vendor ancestor distinct from the Setfarm source", () => {
  const input = structuredClone(authorityAInput());
  input.productBuildAuthorityV2Observation = completePbaObservation(input.setfarmSource.sha);
  input.productBuildAuthorityV2DeliveryEvidenceRef = input.productBuildAuthorityV2Observation.response.deliveryEvidenceRef;
  input.productBuildAuthorityV2DeliveryEvidenceHash = input.productBuildAuthorityV2Observation.response.deliveryEvidenceHash;
  input.vendorProducerCommit = input.setfarmSource.sha;
  input.vendorProducerCommitAncestorProof.vendorProducerCommit = input.setfarmSource.sha;
  input.vendorProducerCommitAncestorProof.mergeBase = input.setfarmSource.sha;
  assert.throws(
    () => completeAuthorityFromInput(input),
    /SOURCE_BUILD_AUTHORITY_A_ANCESTRY_INVALID/,
  );
});

test("future B-E activation is rejected before PostgreSQL observation", async () => {
  const db = await import("../../src/db-pg.js");
  await assert.rejects(
    db.activateInternalProductionOwnerProducerManifestSetV1({
      expectedPredecessor: null,
      manifests: [syntheticManifest("B", 10)],
      orderedSourceBuildAuthorities: [{ plan: "B", sourceBuildAuthorityRef: `setfarm://internal-production/owner-producer-source-build-authority/B/sha256/${SHA_A}`, sourceBuildAuthorityHash: SHA_A }],
    }),
    /ACTIVATION_PHASE_INVALID/,
  );
});

test("controller-only A database port rejects every caller authority seam before PostgreSQL", async () => {
  const db = await import("../../src/db-pg.js");
  const pair = {
    plan: "A" as const,
    sourceBuildAuthorityRef: `setfarm://internal-production/owner-producer-source-build-authority/A/sha256/${SHA_A}`,
    sourceBuildAuthorityHash: SHA_A,
  };
  const assertPortCorruption = async (promise: Promise<unknown>) => {
    let observed: unknown;
    try { await promise; } catch (error) { observed = error; }
    assert.ok(observed instanceof Error);
    assert.equal(observed.message, "CORRUPTION");
    assert.equal(Object.getPrototypeOf(observed), Error.prototype);
    assert.deepEqual(Reflect.ownKeys(observed).filter((key) => key !== "stack" && key !== "message"), []);
  };
  await assertPortCorruption(db.activateInternalProductionBaselineOwnerProducerManifestAFromControllerV1({ sourceBuildAuthority: pair, extra: true } as never));
  await assertPortCorruption(db.activateInternalProductionBaselineOwnerProducerManifestAFromControllerV1({ sourceBuildAuthority: { ...pair, plan: "B", sourceBuildAuthorityRef: `setfarm://internal-production/owner-producer-source-build-authority/B/sha256/${SHA_A}` } as never }));
  await assertPortCorruption(db.activateInternalProductionBaselineOwnerProducerManifestAFromControllerV1({ sourceBuildAuthority: { ...pair, sourceBuildAuthorityRef: `setfarm://internal-production/owner-producer-source-build-authority/A/sha256/${SHA_B}` } }));
  await assertPortCorruption(db.activateInternalProductionBaselineOwnerProducerManifestAFromControllerV1({ sourceBuildAuthority: pair, [Symbol("hidden")]: true } as never));
  const hidden = { sourceBuildAuthority: pair };
  Object.defineProperty(hidden, "extra", { value: true, enumerable: false });
  await assertPortCorruption(db.activateInternalProductionBaselineOwnerProducerManifestAFromControllerV1(hidden));
  const customPrototype = Object.assign(Object.create({ inherited: true }), { sourceBuildAuthority: pair });
  await assertPortCorruption(db.activateInternalProductionBaselineOwnerProducerManifestAFromControllerV1(customPrototype));
  let getterCalls = 0;
  const getterInput = {};
  Object.defineProperty(getterInput, "sourceBuildAuthority", { enumerable: true, get() { getterCalls += 1; return pair; } });
  await assertPortCorruption(db.activateInternalProductionBaselineOwnerProducerManifestAFromControllerV1(getterInput as never));
  assert.equal(getterCalls, 0);
});

test("generic and controller-only exports share one private core without an exported drift side channel", async () => {
  const source = await readFile(new URL("../../src/db-pg.ts", import.meta.url), "utf8");
  const controllerPort = source.slice(
    source.indexOf("export async function activateInternalProductionBaselineOwnerProducerManifestAFromControllerV1"),
    source.indexOf("/**\n * Read-only current-entry composition"),
  );
  assert.match(controllerPort, /exactObjectKeys\(input, \["sourceBuildAuthority"\]/);
  assert.match(controllerPort, /expectedPredecessor: null/);
  assert.match(controllerPort, /manifests: \[INTERNAL_PRODUCTION_OWNER_PRODUCER_MANIFEST_A_V1\]/);
  assert.match(controllerPort, /activateInternalProductionOwnerProducerManifestSetCoreV1/);
  assert.match(source, /const OWNER_PRODUCER_CURRENT_SOURCE_DRIFT = Symbol\("owner-producer-current-source-drift"\)/);
  assert.doesNotMatch(source, /Symbol\.for|privateCandidateDrift/);
  assert.doesNotMatch(source, /export (?:const|class).*CURRENT_SOURCE_DRIFT/);
});

test("database new-A candidate uses only the read-only prepared-operation accessor", async () => {
  const source = await readFile(new URL("../../src/db-pg.ts", import.meta.url), "utf8");
  const candidate = /async function deriveCurrentOwnerProducerSourceAuthorityAForDatabaseV1\(\)[\s\S]*?\n}\n/.exec(source)?.[0] ?? "";
  assert.match(candidate, /observePreparedInternalProductionCurrentEntryOperationV1\(\)/);
  assert.doesNotMatch(candidate, /prepareInternalProductionCurrentEntryOperationV1|lstatSync|CURRENT_ENTRY_OPERATION_PATH/);
});

test("database committed-current module graph has no static fresh observer or Git edge", async () => {
  const source = await readFile(new URL("../../src/db-pg.ts", import.meta.url), "utf8");
  const runtimeImports = [...source.matchAll(/^import(?!\s+type\b)[\s\S]*?from\s+["']([^"']+)["'];/gm)].map((match) => match[1]);
  assert.equal(runtimeImports.includes("./internal-production/baseline-post-handoff-receipt-v1.js"), false);
  assert.equal(runtimeImports.includes("./internal-production/product-build-authority-v2-delivery-evidence-v1.js"), false);
  assert.equal(runtimeImports.includes("./execution/v3-git-revision.js"), false);
});

test("database activation resolves source before deriving or querying target authority", async () => {
  const source = await readFile(new URL("../../src/db-pg.ts", import.meta.url), "utf8");
  const activation = source.slice(source.indexOf("async function activateInternalProductionOwnerProducerManifestSetCoreV1"));
  const sourceResolution = activation.indexOf("resolveOwnerProducerSourceInTransactionV1(sql, sourcePair, sourceCache)");
  const targetDerivation = activation.indexOf("const manifestSetBody");
  const targetQuery = activation.indexOf("FROM internal_production_owner_producer_manifest_set_activations_v1");
  assert.ok(sourceResolution >= 0 && targetDerivation >= 0 && targetQuery >= 0);
  assert.ok(sourceResolution < targetDerivation, "source resolution must precede target derivation");
  assert.ok(sourceResolution < targetQuery, "source resolution must precede target query");
});

test("database resolves activation and head as one cross-bound recursive chain", async () => {
  const source = await readFile(new URL("../../src/db-pg.ts", import.meta.url), "utf8");
  const chain = /async function resolveOwnerProducerActivationChainInTransactionV1\([\s\S]*?\n}\n/.exec(source)?.[0] ?? "";
  assert.match(chain, /receipt\.predecessorActivationRef/);
  assert.match(chain, /receipt\.predecessorHeadRef/);
  assert.match(chain, /head\.predecessorHeadRef/);
  assert.match(chain, /resolveOwnerProducerActivationChainInTransactionV1\(\s*sql,/);
  assert.doesNotMatch(chain, /Promise\.all/);
});

test("database classifies superseded only when the strict current chain contains target", async () => {
  const source = await readFile(new URL("../../src/db-pg.ts", import.meta.url), "utf8");
  const activation = source.slice(source.indexOf("async function activateInternalProductionOwnerProducerManifestSetCoreV1"));
  assert.match(activation, /currentChainContainsTarget/);
  assert.match(activation, /if \(currentChainContainsTarget\) throw new OwnerProducerActivationSupersededError\(\)/);
  assert.doesNotMatch(activation, /if \(current\) throw new OwnerProducerActivationSupersededError\(\)/);
});

test("database supersession reuses the one pinned cross-bound chain without a second phase read", async () => {
  const source = await readFile(new URL("../../src/db-pg.ts", import.meta.url), "utf8");
  const activation = source.slice(source.indexOf("async function activateInternalProductionOwnerProducerManifestSetCoreV1"));
  assert.doesNotMatch(activation, /currentChainContainsTargetInTransactionV1/);
  assert.match(activation, /currentResolution\.ancestry\.some/);
});

test("database target classification reuses an already resolved current-chain node", async () => {
  const source = await readFile(new URL("../../src/db-pg.ts", import.meta.url), "utf8");
  const activation = source.slice(source.indexOf("async function activateInternalProductionOwnerProducerManifestSetCoreV1"));
  assert.match(activation, /currentTargetNode = currentResolution\?\.nodes\.find/);
  assert.match(activation, /if \(currentTargetNode !== undefined\)/);
});

test("database shares one transaction-local resolved-source cache across target and current chain", async () => {
  const source = await readFile(new URL("../../src/db-pg.ts", import.meta.url), "utf8");
  const activation = source.slice(source.indexOf("async function activateInternalProductionOwnerProducerManifestSetCoreV1"));
  assert.match(activation, /const sourceCache = new Map/);
  assert.match(activation, /resolveOwnerProducerSourceInTransactionV1\(sql, sourcePair, sourceCache\)/);
  assert.match(activation, /resolveCurrentOwnerProducerManifestSetActivationWithChainInTransactionV1\(sql, true, sourceCache\)/);
});

test("database keeps the authenticated terminal-body close private behind the fixed controller", async () => {
  const source = await readFile(new URL("../../src/db-pg.ts", import.meta.url), "utf8");
  assert.match(source, /async function closeOwnerReservationInTransactionV1(?:<|\()/);
  assert.match(source, /closeInTransactionV1: closeOwnerReservationInTransactionV1/);
  assert.doesNotMatch(source, /export async function closeOwnerReservationInTransactionV1/);
  const privateClose = source.slice(
    source.indexOf("async function closeOwnerReservationInTransactionV1"),
    source.indexOf("const OWNER_TERMINAL_AUTHORITY_RESOLVERS_V1"),
  );
  assert.match(privateClose, /validateBoundOwnerReservationRowV1/);
  assert.match(privateClose, /validateClosedOwnerReservationRowV1/);
});

test("historical source rejects a self-consistent non-contract PBA before target scans", async () => {
  const db = await import("../../src/db-pg.js");
  const valid = authorityA();
  const invalidBody = structuredClone(authorityAInput());
  (invalidBody.productBuildAuthorityV2Observation.response.evidence.focusedTests as Record<string, unknown>).extra = true;
  invalidBody.productBuildAuthorityV2Observation = resignPbaObservation(
    invalidBody.productBuildAuthorityV2Observation,
  );
  invalidBody.productBuildAuthorityV2DeliveryEvidenceRef = invalidBody.productBuildAuthorityV2Observation.response.deliveryEvidenceRef;
  invalidBody.productBuildAuthorityV2DeliveryEvidenceHash = invalidBody.productBuildAuthorityV2Observation.response.deliveryEvidenceHash;
  const invalidHash = hashCanonicalJson(invalidBody);
  const authority = {
    ...invalidBody,
    sourceBuildAuthorityRef: `setfarm://internal-production/owner-producer-source-build-authority/A/sha256/${invalidHash}`,
    sourceBuildAuthorityHash: invalidHash,
  };
  const sql = db.getSql();
  await sql`
    INSERT INTO internal_production_owner_producer_source_build_authorities_v1 (
      source_build_authority_ref, source_build_authority_hash, plan, manifest_hash,
      owner_category_registry_hash, owner_category_census_map_hash, canonical_body
    ) VALUES (
      ${authority.sourceBuildAuthorityRef}, ${authority.sourceBuildAuthorityHash}, ${authority.plan},
      ${authority.manifestHash}, ${authority.ownerCategoryRegistryHash},
      ${authority.ownerCategoryCensusMapHash}, ${canonicalJsonStringify(authority)}
    )
  `;
  await assert.rejects(
    db.resolveInternalProductionOwnerProducerSourceBuildAuthorityV1({
      plan: "A",
      sourceBuildAuthorityRef: authority.sourceBuildAuthorityRef,
      sourceBuildAuthorityHash: authority.sourceBuildAuthorityHash,
    }),
    /SOURCE_BUILD_AUTHORITY_A_PBA_INVALID/,
  );
  await assert.rejects(
    db.activateInternalProductionOwnerProducerManifestSetV1({
      expectedPredecessor: null,
      manifests: [INTERNAL_PRODUCTION_OWNER_PRODUCER_MANIFEST_A_V1],
      orderedSourceBuildAuthorities: [{
        plan: "A",
        sourceBuildAuthorityRef: authority.sourceBuildAuthorityRef,
        sourceBuildAuthorityHash: authority.sourceBuildAuthorityHash,
      }],
    }),
    /^Error: INTERNAL_PRODUCTION_OWNER_PRODUCER_ACTIVATION_CORRUPTION$/,
  );
  void valid;
  await db.pgClose();
});

test("PostgreSQL source rows reject every noncanonical TEXT spelling before historical ports", async () => {
  if (process.env.SETFARM_PG_URL === undefined) return;
  const db = await import("../../src/db-pg.js");
  const sql = db.getSql();
  const bodies = [
    ' {"schema":"x"}',
    '{"z":0,"a":0}',
    '{"value":1.0}',
    '{"schema":"x","schema":"x"}',
  ] as const;
  for (const [index, canonicalBody] of bodies.entries()) {
    const hash = String(index + 40).padStart(64, "0");
    const ref = `setfarm://internal-production/owner-producer-source-build-authority/A/sha256/${hash}`;
    await sql`
      INSERT INTO internal_production_owner_producer_source_build_authorities_v1 (
        source_build_authority_ref, source_build_authority_hash, plan, manifest_hash,
        owner_category_registry_hash, owner_category_census_map_hash, canonical_body
      ) VALUES (
        ${ref}, ${hash}, 'A', ${INTERNAL_PRODUCTION_OWNER_PRODUCER_MANIFEST_A_V1.manifestHash},
        ${INTERNAL_PRODUCTION_OWNER_CATEGORY_REGISTRY_HASH_V1},
        ${INTERNAL_PRODUCTION_OWNER_CATEGORY_CENSUS_MAP_HASH_V1}, ${canonicalBody}
      )
    `;
    await assert.rejects(
      db.resolveInternalProductionOwnerProducerSourceBuildAuthorityV1({
        plan: "A", sourceBuildAuthorityRef: ref, sourceBuildAuthorityHash: hash,
      }),
      /^Error: INTERNAL_PRODUCTION_OWNER_PRODUCER_SOURCE_BUILD_AUTHORITY_CORRUPTION$/,
    );
  }
  await db.pgClose();
});

test("PostgreSQL target resolution rejects noncanonical activation bytes before source or head adoption", async () => {
  if (process.env.SETFARM_PG_URL === undefined) return;
  const db = await import("../../src/db-pg.js");
  const sql = db.getSql();
  const activationHash = "6".repeat(64);
  const headHash = "7".repeat(64);
  const activationRef = `setfarm://internal-production/owner-producer-manifest-set-activation/sha256/${activationHash}`;
  const headRef = `setfarm://internal-production/owner-producer-manifest-set-activation-head/sha256/${headHash}`;
  await sql`
    INSERT INTO internal_production_owner_producer_manifest_set_activations_v1 (
      activation_ref, activation_hash, phase, manifest_set_hash,
      owner_category_registry_hash, owner_category_census_map_hash,
      predecessor_activation_ref, predecessor_activation_hash,
      predecessor_head_ref, predecessor_head_hash, canonical_body
    ) VALUES (
      ${activationRef}, ${activationHash}, 'A', ${"8".repeat(64)},
      ${INTERNAL_PRODUCTION_OWNER_CATEGORY_REGISTRY_HASH_V1},
      ${INTERNAL_PRODUCTION_OWNER_CATEGORY_CENSUS_MAP_HASH_V1},
      NULL, NULL, NULL, NULL, ${' {"schema":"crossed"}'}
    )
  `;
  await sql`
    INSERT INTO internal_production_owner_producer_manifest_activation_heads_v1 (
      head_ref, head_hash, phase, activation_ref, activation_hash,
      predecessor_head_ref, predecessor_head_hash, canonical_body
    ) VALUES (${headRef}, ${headHash}, 'A', ${activationRef}, ${activationHash}, NULL, NULL, ${"{}"})
  `;
  await assert.rejects(
    db.resolveInternalProductionOwnerProducerManifestSetActivationV1({ activationRef, activationHash }),
    /^Error: INTERNAL_PRODUCTION_OWNER_PRODUCER_ACTIVATION_CORRUPTION$/,
  );
  await db.pgClose();
});

test("real PostgreSQL initial activation rolls back a write prefix then identical publishers converge and adopt response loss", async () => {
  if (process.env.SETFARM_PG_URL === undefined) return;
  const fixture = createPreparedActivationRepositoryFixture();
  try {
    const db = await import("../../src/db-pg.js");
    const migrations = await import("../../src/db/contract-spine-migrations.js");
    const guarded = await import("../../src/db/bootstrap-main-claim-handoff-v1-migration.js");
    const sql = db.getSql();
    await sql.unsafe("DROP SCHEMA public CASCADE");
    await sql.unsafe("CREATE SCHEMA public");
    const automatic = await migrations.applyContractSpineMigrations(sql);
    assert.deepEqual(automatic.guardedPending, ["contract-spine-bootstrap-main-claim-handoff-v1"]);

    const receiptUrl = pathToFileURL(path.join(fixture.root, "src/internal-production/baseline-post-handoff-receipt-v1.ts")).href;
    const fixtureReceipt = await import(`${receiptUrl}?prepare=${Date.now()}`);
    assert.equal(typeof fixtureReceipt.prepareActivationFixtureCurrentEntryOperationV1, "function");
    assert.equal(fixtureReceipt.prepareActivationFixtureCurrentEntryOperationV1.length, 0);
    const operation = await fixtureReceipt.prepareActivationFixtureCurrentEntryOperationV1();
    assert.deepEqual(await fixtureReceipt.prepareActivationFixtureCurrentEntryOperationV1(), operation);
    assert.deepEqual(await fixtureReceipt.observePreparedInternalProductionCurrentEntryOperationV1(), operation);
    assert.equal(fixtureGit(fixture.root, ["status", "--porcelain=v2", "--untracked-files=all"]), "");
    assert.equal(existsSync(path.join(fixture.root, "data")), false);
    assert.notEqual(fixture.vendorCommit, operation.controllerSource.sha);

    const fact = (name: string) => hashCanonicalJson({ schema: "setfarm.activation-fixture-fact.v1", name });
    const evidence = guarded.mintBootstrapMainClaimHandoffGuardedMigration32EvidenceForControllerV1({
      schema: "setfarm.bootstrap-main-claim-handoff-guarded-migration-32-evidence.v1",
      purpose: "task6a-guarded-migration-32-after-sealed-spawner-v1",
      currentEntryOperationRef: operation.operationRef,
      currentEntryOperationHash: operation.operationHash,
      sealedSpawnerAdmissionRef: "setfarm://tests/activation/sealed-spawner-admission",
      sealedSpawnerAdmissionHash: fact("sealed-spawner-admission"),
      postPredecessorTerminationLegacyZeroOwnerObservationRef: "setfarm://tests/activation/postzero",
      postPredecessorTerminationLegacyZeroOwnerObservationHash: fact("postzero"),
      authorityV3Migration31AuditRef: operation.authorityV3Migration31Audit.authorityV3Migration31AuditRef,
      authorityV3Migration31AuditHash: operation.authorityV3Migration31Audit.authorityV3Migration31AuditHash,
      pendingBootstrapHandoffMigrationRef: operation.pendingBootstrapHandoffMigration.pendingBootstrapHandoffMigrationRef,
      pendingBootstrapHandoffMigrationHash: operation.pendingBootstrapHandoffMigration.pendingBootstrapHandoffMigrationHash,
      cleanSetfarmSourceSha: operation.controllerSource.sha,
      cleanSetfarmTreeHash: operation.controllerSource.treeHash,
      cleanSetfarmBuildHash: operation.controllerSource.buildHash,
      migrationSourceSha: operation.controllerSource.sha,
      freshLegacyZeroOwnerObservationRef: "setfarm://tests/activation/fresh-zero",
      freshLegacyZeroOwnerObservationHash: fact("fresh-zero"),
      preManifestMigration32AuthorizationRef: "setfarm://tests/activation/migration-authorization",
      preManifestMigration32AuthorizationHash: fact("migration-authorization"),
      preManifestMigration32AuthorizationConsumptionRef: "setfarm://tests/activation/migration-consumption",
      preManifestMigration32AuthorizationConsumptionHash: fact("migration-consumption"),
    });
    await migrations.applyBootstrapMainClaimHandoffGuardedMigration32V1(sql, evidence);
    const successor = await migrations.applyContractSpineMigrations(sql);
    assert.deepEqual(successor.guardedPending, []);
    assert.equal((await migrations.verifyContractSpineMigrations(sql)).status, "verified");

    const response = operation.productBuildAuthorityV2Observation.response;
    const sourceBody = {
      schema: "setfarm.internal-production-owner-producer-source-build-authority-a.v1" as const,
      plan: "A" as const,
      manifestHash: INTERNAL_PRODUCTION_OWNER_PRODUCER_MANIFEST_A_V1.manifestHash,
      currentEntryOperationRef: operation.operationRef,
      currentEntryOperationHash: operation.operationHash,
      setfarmSource: operation.controllerSource,
      productBuildAuthorityV2DeliveryEvidenceRef: response.deliveryEvidenceRef,
      productBuildAuthorityV2DeliveryEvidenceHash: response.deliveryEvidenceHash,
      productBuildAuthorityV2Observation: operation.productBuildAuthorityV2Observation,
      vendorProducerCommit: fixture.vendorCommit,
      vendorProducerCommitAncestorProof: {
        schema: "setfarm.internal-production-vendor-ancestor-proof.v1" as const,
        vendorProducerCommit: fixture.vendorCommit,
        setfarmSourceSha: operation.controllerSource.sha,
        mergeBase: fixture.vendorCommit,
        verified: true as const,
      },
      ownerCategoryRegistryHash: INTERNAL_PRODUCTION_OWNER_CATEGORY_REGISTRY_HASH_V1,
      ownerCategoryCensusMapHash: INTERNAL_PRODUCTION_OWNER_CATEGORY_CENSUS_MAP_HASH_V1,
    };
    const sourceHash = hashCanonicalJson(sourceBody);
    const source = validateInternalProductionOwnerProducerSourceBuildAuthorityV1({
      ...sourceBody,
      sourceBuildAuthorityRef: `setfarm://internal-production/owner-producer-source-build-authority/A/sha256/${sourceHash}`,
      sourceBuildAuthorityHash: sourceHash,
    });
    const tempDbUrl = pathToFileURL(path.join(fixture.root, "src/db-pg.ts")).href;
    const fixtureDb = await import(`${tempDbUrl}?activation=${Date.now()}`);
    const fixtureSql = fixtureDb.getSql();
    const persistenceDb = await import(pathToFileURL(path.join(fixture.root, "src/db-pg.js")).href);
    await persistenceDb.pgBegin(async () => undefined);
    const input = {
      expectedPredecessor: null,
      manifests: [INTERNAL_PRODUCTION_OWNER_PRODUCER_MANIFEST_A_V1],
      orderedSourceBuildAuthorities: [{
        plan: "A" as const,
        sourceBuildAuthorityRef: source.sourceBuildAuthorityRef,
        sourceBuildAuthorityHash: source.sourceBuildAuthorityHash,
      }],
    };
    const assertEmptyActivationStore = async () => assert.deepEqual([...(await fixtureSql<Array<{ sources: string; activations: string; heads: string; revision: string }>>`
      SELECT
        (SELECT COUNT(*)::text FROM internal_production_owner_producer_source_build_authorities_v1) AS sources,
        (SELECT COUNT(*)::text FROM internal_production_owner_producer_manifest_set_activations_v1) AS activations,
        (SELECT COUNT(*)::text FROM internal_production_owner_producer_manifest_activation_heads_v1) AS heads,
        (SELECT current_revision::text FROM internal_production_owner_producer_manifest_set_current_v1 WHERE singleton_key=TRUE) AS revision
    `)], [{ sources: "0", activations: "0", heads: "0", revision: "0" }]);

    await assert.rejects(
      fixtureSql.begin((transaction) => fixtureDb.beginOrAdoptInternalProductionOwnerReservationV1(
        transaction,
        { producerImplementationId: "a-runtime-run-v1", ownerKey: "run-persistence-missing-a-ancestry" },
      )),
      /^Error: RUN_PERSISTENCE_ADMISSION_READY_IDENTITY_INVALID$/,
    );
    assert.equal((await fixtureSql<Array<{ count: string }>>`
      SELECT COUNT(*)::text AS count FROM internal_production_owner_reservations_v1
       WHERE owner_key='run-persistence-missing-a-ancestry'
    `)[0]!.count, "0");
    await assertEmptyActivationStore();

    const conflictingHash = `${source.sourceBuildAuthorityHash[0] === "a" ? "b" : "a"}${source.sourceBuildAuthorityHash.slice(1)}`;
    let publicGenericDriftError: unknown;
    try {
      await fixtureDb.activateInternalProductionOwnerProducerManifestSetV1({
        ...input,
        orderedSourceBuildAuthorities: [{
          plan: "A",
          sourceBuildAuthorityRef: `setfarm://internal-production/owner-producer-source-build-authority/A/sha256/${conflictingHash}`,
          sourceBuildAuthorityHash: conflictingHash,
        }],
      });
    } catch (error) {
      publicGenericDriftError = error;
    }
    assert.ok(publicGenericDriftError instanceof Error);
    assert.equal(publicGenericDriftError.message, "INTERNAL_PRODUCTION_OWNER_PRODUCER_ACTIVATION_CORRUPTION");
    assert.equal(Object.getPrototypeOf(publicGenericDriftError), Error.prototype);
    assert.equal(Object.hasOwn(publicGenericDriftError, "privateCandidateDrift"), false);
    assert.deepEqual(Object.getOwnPropertySymbols(publicGenericDriftError), []);
    assert.deepEqual(
      Reflect.ownKeys(publicGenericDriftError).filter((key) => key !== "stack" && key !== "message"),
      [],
    );
    await assertEmptyActivationStore();

    await fixtureSql.unsafe(`CREATE FUNCTION ip_op_test_fail_source_v1() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'TEST_SOURCE_INSERT_FAILURE'; END $$`);
    await fixtureSql.unsafe(`CREATE TRIGGER ip_op_test_fail_source_v1 BEFORE INSERT ON internal_production_owner_producer_source_build_authorities_v1 FOR EACH ROW EXECUTE FUNCTION ip_op_test_fail_source_v1()`);
    await assert.rejects(
      fixtureDb.activateInternalProductionOwnerProducerManifestSetV1(input),
      /^Error: INTERNAL_PRODUCTION_OWNER_PRODUCER_ACTIVATION_CORRUPTION$/,
    );
    await assertEmptyActivationStore();
    await fixtureSql.unsafe("DROP TRIGGER ip_op_test_fail_source_v1 ON internal_production_owner_producer_source_build_authorities_v1");
    await fixtureSql.unsafe("DROP FUNCTION ip_op_test_fail_source_v1()");

    await fixtureSql.unsafe(`CREATE FUNCTION ip_op_test_fail_activation_v1() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'TEST_ACTIVATION_INSERT_FAILURE'; END $$`);
    await fixtureSql.unsafe(`CREATE TRIGGER ip_op_test_fail_activation_v1 BEFORE INSERT ON internal_production_owner_producer_manifest_set_activations_v1 FOR EACH ROW EXECUTE FUNCTION ip_op_test_fail_activation_v1()`);
    await assert.rejects(
      fixtureDb.activateInternalProductionOwnerProducerManifestSetV1(input),
      /^Error: INTERNAL_PRODUCTION_OWNER_PRODUCER_ACTIVATION_CORRUPTION$/,
    );
    await assertEmptyActivationStore();
    await fixtureSql.unsafe("DROP TRIGGER ip_op_test_fail_activation_v1 ON internal_production_owner_producer_manifest_set_activations_v1");
    await fixtureSql.unsafe("DROP FUNCTION ip_op_test_fail_activation_v1()");

    await fixtureSql.unsafe(`CREATE FUNCTION ip_op_test_fail_head_v1() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'TEST_HEAD_INSERT_FAILURE'; END $$`);
    await fixtureSql.unsafe(`CREATE TRIGGER ip_op_test_fail_head_v1 BEFORE INSERT ON internal_production_owner_producer_manifest_activation_heads_v1 FOR EACH ROW EXECUTE FUNCTION ip_op_test_fail_head_v1()`);
    await assert.rejects(
      fixtureDb.activateInternalProductionOwnerProducerManifestSetV1(input),
      /^Error: INTERNAL_PRODUCTION_OWNER_PRODUCER_ACTIVATION_CORRUPTION$/,
    );
    await assertEmptyActivationStore();
    await fixtureSql.unsafe("DROP TRIGGER ip_op_test_fail_head_v1 ON internal_production_owner_producer_manifest_activation_heads_v1");
    await fixtureSql.unsafe("DROP FUNCTION ip_op_test_fail_head_v1()");

    await fixtureSql.unsafe(`CREATE FUNCTION ip_op_test_fail_current_v1() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'TEST_CURRENT_UPDATE_FAILURE'; END $$`);
    await fixtureSql.unsafe(`CREATE TRIGGER zz_ip_op_test_fail_current_v1 BEFORE UPDATE ON internal_production_owner_producer_manifest_set_current_v1 FOR EACH ROW EXECUTE FUNCTION ip_op_test_fail_current_v1()`);
    await assert.rejects(
      fixtureDb.activateInternalProductionOwnerProducerManifestSetV1(input),
      /^Error: INTERNAL_PRODUCTION_OWNER_PRODUCER_ACTIVATION_CORRUPTION$/,
    );
    await assertEmptyActivationStore();
    await fixtureSql.unsafe("DROP TRIGGER zz_ip_op_test_fail_current_v1 ON internal_production_owner_producer_manifest_set_current_v1");
    await fixtureSql.unsafe("DROP FUNCTION ip_op_test_fail_current_v1()");

    const [first, concurrent] = await Promise.all([
      fixtureDb.activateInternalProductionOwnerProducerManifestSetV1(input),
      fixtureDb.activateInternalProductionOwnerProducerManifestSetV1(input),
    ]);
    assert.deepEqual(concurrent, first);
    assert.deepEqual(await fixtureDb.activateInternalProductionOwnerProducerManifestSetV1(input), first);
    await assert.rejects(
      fixtureDb.activateInternalProductionOwnerProducerManifestSetV1({
        ...input,
        orderedSourceBuildAuthorities: [{
          plan: "A",
          sourceBuildAuthorityRef: `setfarm://internal-production/owner-producer-source-build-authority/A/sha256/${conflictingHash}`,
          sourceBuildAuthorityHash: conflictingHash,
        }],
      }),
      /^Error: INTERNAL_PRODUCTION_OWNER_PRODUCER_ACTIVATION_CORRUPTION$/,
    );
    assert.deepEqual([...(await fixtureSql<Array<{ sources: string; activations: string; heads: string; revision: string }>>`
      SELECT
        (SELECT COUNT(*)::text FROM internal_production_owner_producer_source_build_authorities_v1) AS sources,
        (SELECT COUNT(*)::text FROM internal_production_owner_producer_manifest_set_activations_v1) AS activations,
        (SELECT COUNT(*)::text FROM internal_production_owner_producer_manifest_activation_heads_v1) AS heads,
        (SELECT current_revision::text FROM internal_production_owner_producer_manifest_set_current_v1 WHERE singleton_key=TRUE) AS revision
    `)], [{ sources: "1", activations: "1", heads: "1", revision: "1" }]);

    await fixtureSql.unsafe(`CREATE SEQUENCE task2_nonrun_readiness_probe_v1 START 1`);
    await fixtureSql.unsafe(`CREATE FUNCTION task2_nonrun_readiness_probe_v1() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN PERFORM nextval('task2_nonrun_readiness_probe_v1'); RETURN NEW; END $$`);
    await fixtureSql.unsafe(`CREATE TRIGGER task2_nonrun_readiness_reservation_probe_v1 BEFORE INSERT ON internal_production_owner_reservations_v1 FOR EACH ROW EXECUTE FUNCTION task2_nonrun_readiness_probe_v1()`);
    await fixtureSql.unsafe(`CREATE TRIGGER task2_nonrun_readiness_claim_probe_v1 BEFORE INSERT ON claim_log FOR EACH ROW EXECUTE FUNCTION task2_nonrun_readiness_probe_v1()`);
    const readinessProbeState = async () => (await fixtureSql<Array<{
      last_value: string;
      is_called: boolean;
    }>>`SELECT last_value::text,is_called FROM task2_nonrun_readiness_probe_v1`)[0]!;
    const untouchedReadinessProbe = { last_value: "1", is_called: false };
    assert.deepEqual(await readinessProbeState(), untouchedReadinessProbe);

    const fixtureDbSourcePath = path.join(fixture.root, "src/db-pg.ts");
    const fixtureDbSource = readFileSync(fixtureDbSourcePath, "utf8");
    const beginStart = fixtureDbSource.indexOf(
      "async function beginOrAdoptOwnerReservationInTransactionV1(",
    );
    const beginEnd = fixtureDbSource.indexOf(
      "async function bindOwnerReservationInTransactionV1",
      beginStart,
    );
    const beginSource = fixtureDbSource.slice(beginStart, beginEnd);
    const readinessOrder = beginSource.indexOf("resolveActiveOwnerProducerV1(");
    const reservationLockOrder = beginSource.indexOf(
      "SELECT * FROM internal_production_owner_reservations_v1",
    );
    const reservationInsertOrder = beginSource.indexOf(
      "INSERT INTO internal_production_owner_reservations_v1",
    );
    assert.ok(beginStart >= 0 && beginEnd > beginStart);
    assert.ok(readinessOrder >= 0);
    assert.ok(reservationLockOrder > readinessOrder);
    assert.ok(reservationInsertOrder > reservationLockOrder);

    const beforeMissingReadiness = (await fixtureSql<Array<{
      head_version: string;
      reservations: string;
      runs: string;
      steps: string;
      claims: string;
    }>>`
      SELECT head.head_version::text,
             (SELECT COUNT(*)::text FROM internal_production_owner_reservations_v1) AS reservations,
             (SELECT COUNT(*)::text FROM runs) AS runs,
             (SELECT COUNT(*)::text FROM steps) AS steps,
             (SELECT COUNT(*)::text FROM claim_log) AS claims
        FROM internal_production_owner_admission_head_v1 head
       WHERE head.singleton=TRUE
    `)[0]!;
    await assert.rejects(
      fixtureSql.begin(async (transaction) => {
        await fixtureDb.beginOrAdoptInternalProductionOwnerReservationV1(transaction, {
          producerImplementationId: "a-runtime-run-v1",
          ownerKey: "run-persistence-missing-readiness-module",
        });
        throw new Error("TEST_ACCEPTED_MISSING_RUN_PERSISTENCE_READINESS_MODULE");
      }),
      /^Error: RUN_PERSISTENCE_ADMISSION_READY_UNAVAILABLE$/,
    );
    assert.deepEqual((await fixtureSql<typeof beforeMissingReadiness[]>`
      SELECT head.head_version::text,
             (SELECT COUNT(*)::text FROM internal_production_owner_reservations_v1) AS reservations,
             (SELECT COUNT(*)::text FROM runs) AS runs,
             (SELECT COUNT(*)::text FROM steps) AS steps,
             (SELECT COUNT(*)::text FROM claim_log) AS claims
        FROM internal_production_owner_admission_head_v1 head
       WHERE head.singleton=TRUE
    `)[0], beforeMissingReadiness);

    await assert.rejects(
      fixtureSql.begin(async (transaction) => {
        await transaction`SET LOCAL statement_timeout='2s'`;
        await fixtureDb.beginOrAdoptInternalProductionOwnerReservationV1(transaction, {
          producerImplementationId: "a-claim-single-runtime-v1",
          ownerKey: "9300001",
        });
        await transaction`
          INSERT INTO claim_log (
            id,run_id,step_id,story_id,agent_id,claimed_at,outcome,duration_ms,diagnostic
          ) VALUES (
            9300001,'task2-not-ready-run','task2-not-ready-step','',
            'task2-not-ready-agent',NOW(),'completed',1,'must not insert'
          )
        `;
        throw new Error("TEST_ACCEPTED_MISSING_NON_RUN_READINESS");
      }),
      /^Error: RUN_PERSISTENCE_ADMISSION_READY_UNAVAILABLE$/,
    );
    assert.deepEqual(await readinessProbeState(), untouchedReadinessProbe);
    assert.deepEqual((await fixtureSql<typeof beforeMissingReadiness[]>`
      SELECT head.head_version::text,
             (SELECT COUNT(*)::text FROM internal_production_owner_reservations_v1) AS reservations,
             (SELECT COUNT(*)::text FROM runs) AS runs,
             (SELECT COUNT(*)::text FROM steps) AS steps,
             (SELECT COUNT(*)::text FROM claim_log) AS claims
        FROM internal_production_owner_admission_head_v1 head
       WHERE head.singleton=TRUE
    `)[0], beforeMissingReadiness);

    const readinessHead = (await fixtureSql<Array<{ head_ref: string; head_hash: string }>>`
      SELECT head_ref,head_hash
        FROM internal_production_owner_producer_manifest_activation_heads_v1
       WHERE activation_ref=${first.activationRef}
         AND activation_hash=${first.activationHash}
    `)[0]!;
    const admissionReadyRef = "setfarm://tests/run-persistence/admission-ready";
    const admissionReadyHash = hashCanonicalJson({
      schema: "setfarm.test-run-persistence-admission-ready.v1",
      activationRef: first.activationRef,
      activationHash: first.activationHash,
    });
    const readinessModulePath = path.join(
      fixture.root,
      "src/internal-production/baseline-spawner-startup-admission-v1.ts",
    );
    writeFileSync(readinessModulePath, `
const deepFreeze = (value) => {
  if (value && typeof value === "object") {
    for (const nested of Object.values(value)) deepFreeze(nested);
    Object.freeze(value);
  }
  return value;
};
const READY = deepFreeze(${JSON.stringify({
      state: "normal-task0-admission-ready",
      admissionReadyRef,
      admissionReadyHash,
      manifestActivationRef: first.activationRef,
      manifestActivationHash: SHA_C,
      manifestHeadRef: readinessHead.head_ref,
      manifestHeadHash: readinessHead.head_hash,
    })});
const STATUS = deepFreeze({
  state: "normal_task0_admission_ready",
  admissionReady: {
    admissionReadyRef: READY.admissionReadyRef,
    admissionReadyHash: READY.admissionReadyHash,
  },
});
export async function observeInternalProductionPreSchemaSpawnerRebindStatusV1() {
  return STATUS;
}
export async function resolveInternalProductionTask0SpawnerAdmissionReadyV1(pair) {
  if (pair.admissionReadyRef !== READY.admissionReadyRef
    || pair.admissionReadyHash !== READY.admissionReadyHash) throw new Error("PAIR_INVALID");
  return READY;
}
`, "utf8");
    const wrongReadinessWorkerPath = path.join(fixture.root, "task2-wrong-readiness-worker.mjs");
    writeFileSync(wrongReadinessWorkerPath, `
import postgres from "postgres";
import * as db from "./src/db-pg.ts";
const sql = postgres(process.env.SETFARM_PG_URL, { max: 1 });
try {
  await sql.begin(async (transaction) => {
    await transaction\`SET LOCAL statement_timeout='2s'\`;
    await db.beginOrAdoptInternalProductionOwnerReservationV1(transaction, {
      producerImplementationId: "a-claim-single-runtime-v1",
      ownerKey: "9300002",
    });
    await transaction.unsafe("INSERT INTO claim_log (id,run_id,step_id,agent_id,claimed_at,outcome) VALUES (9300002,'task2-wrong-ready-run','task2-wrong-ready-step','task2',NOW(),'completed')");
  });
  process.stdout.write("TEST_ACCEPTED_WRONG_NON_RUN_READINESS");
  process.exitCode = 2;
} catch (error) {
  process.stdout.write(String(error));
} finally {
  await sql.end({ timeout: 1 });
}
`, "utf8");
    await fixtureSql`SELECT setval('task2_nonrun_readiness_probe_v1',1,FALSE)`;
    const wrongReadiness = spawnSync(process.execPath, [
      "--import", "tsx", wrongReadinessWorkerPath,
    ], {
      cwd: fixture.root,
      env: process.env,
      encoding: "utf8",
      timeout: 15_000,
    });
    assert.equal(wrongReadiness.signal, null, String(wrongReadiness.error));
    assert.equal(wrongReadiness.status, 0, wrongReadiness.stderr);
    assert.equal(
      wrongReadiness.stdout,
      "Error: RUN_PERSISTENCE_ADMISSION_READY_IDENTITY_INVALID",
    );
    assert.deepEqual(await readinessProbeState(), untouchedReadinessProbe);
    assert.deepEqual((await fixtureSql<typeof beforeMissingReadiness[]>`
      SELECT head.head_version::text,
             (SELECT COUNT(*)::text FROM internal_production_owner_reservations_v1) AS reservations,
             (SELECT COUNT(*)::text FROM runs) AS runs,
             (SELECT COUNT(*)::text FROM steps) AS steps,
             (SELECT COUNT(*)::text FROM claim_log) AS claims
        FROM internal_production_owner_admission_head_v1 head
       WHERE head.singleton=TRUE
    `)[0], beforeMissingReadiness);

    writeFileSync(readinessModulePath, `
const deepFreeze = (value) => {
  if (value && typeof value === "object") {
    for (const nested of Object.values(value)) deepFreeze(nested);
    Object.freeze(value);
  }
  return value;
};
const READY = deepFreeze(${JSON.stringify({
      state: "normal-task0-admission-ready",
      admissionReadyRef,
      admissionReadyHash,
      manifestActivationRef: first.activationRef,
      manifestActivationHash: first.activationHash,
      manifestHeadRef: readinessHead.head_ref,
      manifestHeadHash: readinessHead.head_hash,
    })});
const STATUS = deepFreeze({
  state: "normal_task0_admission_ready",
  admissionReady: {
    admissionReadyRef: READY.admissionReadyRef,
    admissionReadyHash: READY.admissionReadyHash,
  },
});
export async function observeInternalProductionPreSchemaSpawnerRebindStatusV1() {
  return STATUS;
}
export async function resolveInternalProductionTask0SpawnerAdmissionReadyV1(pair) {
  if (pair.admissionReadyRef !== READY.admissionReadyRef
    || pair.admissionReadyHash !== READY.admissionReadyHash) throw new Error("PAIR_INVALID");
  return READY;
}
`, "utf8");
    await fixtureSql.unsafe("DROP TRIGGER task2_nonrun_readiness_claim_probe_v1 ON claim_log");
    await fixtureSql.unsafe("DROP TRIGGER task2_nonrun_readiness_reservation_probe_v1 ON internal_production_owner_reservations_v1");
    await fixtureSql.unsafe("DROP FUNCTION task2_nonrun_readiness_probe_v1()");
    await fixtureSql.unsafe("DROP SEQUENCE task2_nonrun_readiness_probe_v1");
    assert.match(fixtureDbSource, /let _schemaReady = false;/);
    writeFileSync(
      fixtureDbSourcePath,
      fixtureDbSource.replace("let _schemaReady = false;", "let _schemaReady = true;"),
      "utf8",
    );
    const backendWorkerPath = path.join(fixture.root, "task2-backend-worker.mjs");
    writeFileSync(backendWorkerPath, `
import { parentPort } from "node:worker_threads";
parentPort.postMessage({ type: "ready" });
parentPort.on("message", async ({ input }) => {
  try {
    const persistence = await import("./src/execution/run-persistence.ts");
    const value = await persistence.persistWorkflowRun(input);
    parentPort.postMessage({ type: "result", status: "fulfilled", value });
  } catch (error) {
    parentPort.postMessage({ type: "result", status: "rejected", error: String(error) });
  }
});
`, "utf8");
    const backendWorker = new Worker(pathToFileURL(backendWorkerPath), {
      env: process.env,
      execArgv: ["--import", "tsx"],
    });
    await new Promise<void>((resolve, reject) => {
      backendWorker.once("error", reject);
      backendWorker.once("message", (message) => {
        if ((message as { type?: string }).type !== "ready") reject(new Error("TEST_BACKEND_WORKER_NOT_READY"));
        else resolve();
      });
    });
    activatedOwnerAdmissionFixture = { root: fixture.root, db: fixtureDb, sql: fixtureSql, backendWorker };
    await db.pgClose();
  } finally {
    if (activatedOwnerAdmissionFixture === null) {
      rmSync(path.dirname(fixture.root), { recursive: true, force: true });
    }
  }
});

test("real PostgreSQL run persistence fences before mutation and adopts an exact committed run", async (t) => {
  if (process.env.SETFARM_PG_URL === undefined) return;
  assert.ok(activatedOwnerAdmissionFixture, "the activated fixture must remain available");
  const { root, sql, backendWorker } = activatedOwnerAdmissionFixture;
  t.after(async () => { await backendWorker.terminate(); });
  const fixtureDb = await import(pathToFileURL(path.join(root, "src/db-pg.js")).href);
  const persistence = await import(`${pathToFileURL(path.join(root, "src/execution/run-persistence.ts")).href}?task2=${Date.now()}`);
  const input = {
    run: {
      id: "run-persistence-task2-exact-adoption",
      runNumber: 1801,
      workflowId: "feature-dev",
      task: "persist one authenticated ordinary run",
      context: "{}",
      notifyUrl: null,
      createdAt: "2026-08-21T00:00:00.000Z",
      protocol: {
        mode: "legacy" as const,
        version: 1 as const,
        compilerReleaseSha: "a".repeat(40),
        activationPreflightHash: null,
        releaseAdmissionHash: null,
        releaseAdmissionKind: null,
        canaryAdmission: null,
      },
    },
    steps: [{
      id: "run-persistence-task2-step",
      stepId: "plan",
      agentId: "feature-dev_planner",
      stepIndex: 0,
      inputTemplate: "task",
      expects: "plan",
      status: "pending",
      maxRetries: 2,
      type: "single",
      loopConfig: null,
    }, {
      id: "run-persistence-task2-step-design",
      stepId: "design",
      agentId: "feature-dev_designer",
      stepIndex: 1,
      inputTemplate: "plan",
      expects: "design",
      status: "waiting",
      maxRetries: 1,
      type: "single",
      loopConfig: null,
    }],
  };
  const snapshot = async () => (await sql<Array<{
    head_version: string;
    reservations: string;
    bindings: string;
    runs: string;
    steps: string;
  }>>`
    SELECT head.head_version::text,
           (SELECT COUNT(*)::text FROM internal_production_owner_reservations_v1) AS reservations,
           (SELECT COUNT(*)::text FROM internal_production_owner_admission_authorities_v1 WHERE authority_kind='binding') AS bindings,
           (SELECT COUNT(*)::text FROM runs) AS runs,
           (SELECT COUNT(*)::text FROM steps) AS steps
      FROM internal_production_owner_admission_head_v1 head
     WHERE head.singleton=TRUE
  `)[0]!;
  const beforeFence = await snapshot();
  await sql`UPDATE setfarm_schema_migrations SET state='adopted' WHERE version=31`;
  try {
    await assert.rejects(
      sql.begin((transaction) => persistence.persistWorkflowRunInTransaction(transaction, input)),
      /^Error: RUN_PERSISTENCE_MIGRATION_31_FENCE_DRIFT$/,
    );
    assert.deepEqual(await snapshot(), beforeFence);
  } finally {
    await sql`UPDATE setfarm_schema_migrations SET state='applied' WHERE version=31`;
  }

  const first = await sql.begin((transaction) => (
    persistence.persistWorkflowRunInTransaction(transaction, input)
  ));
  assert.equal(first.run.id, input.run.id);
  assert.equal(first.run.status, "running");
  assert.notEqual(first.run.createdAt, input.run.createdAt);
  assert.match(first.runOwnerReservationRef, /^setfarm:\/\/internal-production\/owner-reservations\//);
  assert.match(first.runOwnerReservationHash, /^[a-f0-9]{64}$/);
  assert.deepEqual([...(await sql<Array<{ runs: string; steps: string; reservations: string; bindings: string }>>`
    SELECT
      (SELECT COUNT(*)::text FROM runs WHERE id=${input.run.id}) AS runs,
      (SELECT COUNT(*)::text FROM steps WHERE run_id=${input.run.id}) AS steps,
      (SELECT COUNT(*)::text FROM internal_production_owner_reservations_v1 WHERE owner_key=${input.run.id} AND state='bound') AS reservations,
      (SELECT COUNT(*)::text FROM internal_production_owner_admission_authorities_v1 authority JOIN internal_production_owner_reservations_v1 reservation ON reservation.reservation_ref=authority.phase_key WHERE reservation.owner_key=${input.run.id} AND authority.authority_kind='binding') AS bindings
  `)], [{ runs: "1", steps: "2", reservations: "1", bindings: "1" }]);
  assert.deepEqual(
    [...await sql<Array<{ id: string; created_at: Date; updated_at: Date }>>`
      SELECT id,created_at,updated_at FROM steps WHERE run_id=${input.run.id} ORDER BY step_index,id
    `].map((step) => ({
      id: step.id,
      createdAt: step.created_at.toISOString(),
      updatedAt: step.updated_at.toISOString(),
    })),
    input.steps.map((step) => ({
      id: step.id,
      createdAt: first.run.createdAt,
      updatedAt: first.run.createdAt,
    })),
  );
  const beforeRetry = await snapshot();
  assert.deepEqual(
    await sql.begin((transaction) => persistence.persistWorkflowRunInTransaction(transaction, input)),
    first,
  );
  assert.deepEqual(await snapshot(), beforeRetry);

  const exactStoredInventory = async (ownerKey = input.run.id) => ({
    run: [...await sql`SELECT * FROM runs WHERE id=${ownerKey}`],
    steps: [...await sql`SELECT * FROM steps WHERE run_id=${ownerKey} ORDER BY step_index,id`],
    stories: [...await sql`SELECT * FROM stories WHERE run_id=${ownerKey} ORDER BY story_index,id`],
    reservation: [...await sql`SELECT * FROM internal_production_owner_reservations_v1 WHERE owner_key=${ownerKey}`],
    authorities: [...await sql`
      SELECT authority.*
        FROM internal_production_owner_admission_authorities_v1 authority
        JOIN internal_production_owner_reservations_v1 reservation
          ON reservation.reservation_ref=authority.phase_key
       WHERE reservation.owner_key=${ownerKey}
       ORDER BY authority.authority_kind,authority.authority_ref
    `],
    claims: [...await sql`SELECT * FROM claim_log WHERE run_id=${ownerKey} ORDER BY id`],
    attempts: [...await sql`SELECT * FROM execution_attempts WHERE run_id=${ownerKey} ORDER BY attempt_id`],
    runtimes: [...await sql`SELECT * FROM runtime_sessions WHERE run_id=${ownerKey} ORDER BY session_id`],
    completionRequests: [...await sql`SELECT * FROM runtime_completion_requests WHERE run_id=${ownerKey} ORDER BY request_id`],
    completionEffects: [...await sql`
      SELECT effect.*
        FROM runtime_completion_effects effect
        JOIN runtime_completion_requests request ON request.request_id=effect.request_id
       WHERE request.run_id=${ownerKey}
       ORDER BY effect.request_id,effect.ordinal,effect.effect_key
    `],
    terminationRequests: [...await sql`SELECT * FROM run_termination_requests WHERE run_id=${ownerKey} ORDER BY request_id`],
    outbox: [...await sql`
      SELECT * FROM operational_outbox
       WHERE aggregate_type='run' AND aggregate_id=${ownerKey}
       ORDER BY outbox_id
    `],
    head: [...await sql`SELECT * FROM internal_production_owner_admission_head_v1 WHERE singleton=TRUE`],
  });
  const crossedRuns = [
    { ...input, run: { ...input.run, runNumber: input.run.runNumber + 1 } },
    { ...input, run: { ...input.run, workflowId: "crossed-workflow" } },
    { ...input, run: { ...input.run, task: `${input.run.task} crossed` } },
    { ...input, run: { ...input.run, context: '{"crossed":true}' } },
    { ...input, run: { ...input.run, notifyUrl: "https://example.invalid/crossed" } },
    { ...input, run: { ...input.run, protocol: { ...input.run.protocol, version: 2 as 1 } } },
    { ...input, run: { ...input.run, protocol: { ...input.run.protocol, compilerReleaseSha: "b".repeat(40) } } },
  ];
  const crossedSteps = [
    { ...input, steps: [{ ...input.steps[0]!, id: "crossed-step-id" }, input.steps[1]!] },
    { ...input, steps: [{ ...input.steps[0]!, stepId: "crossed-step" }, input.steps[1]!] },
    { ...input, steps: [{ ...input.steps[0]!, agentId: "crossed_agent" }, input.steps[1]!] },
    { ...input, steps: [{ ...input.steps[0]!, stepIndex: 7 }, input.steps[1]!] },
    { ...input, steps: [{ ...input.steps[0]!, inputTemplate: "crossed input" }, input.steps[1]!] },
    { ...input, steps: [{ ...input.steps[0]!, expects: "crossed output" }, input.steps[1]!] },
    { ...input, steps: [{ ...input.steps[0]!, status: "waiting" }, input.steps[1]!] },
    { ...input, steps: [{ ...input.steps[0]!, maxRetries: 9 }, input.steps[1]!] },
    { ...input, steps: [{ ...input.steps[0]!, type: "loop" }, input.steps[1]!] },
    { ...input, steps: [{ ...input.steps[0]!, loopConfig: "{}" }, input.steps[1]!] },
    { ...input, steps: [...input.steps].reverse() },
    { ...input, steps: [...input.steps, { ...input.steps[1]!, id: "run-persistence-task2-extra-step", stepIndex: 2 }] },
    { ...input, steps: [] },
  ];
  for (const crossed of [...crossedRuns, ...crossedSteps]) {
    const beforeCrossedRetry = await exactStoredInventory();
    await assert.rejects(
      sql.begin((transaction) => persistence.persistWorkflowRunInTransaction(transaction, crossed)),
      /^Error: RUN_PERSISTENCE_ADOPTION_IDENTITY_INVALID$/,
    );
    assert.deepEqual(await exactStoredInventory(), beforeCrossedRetry);
  }
  await sql`UPDATE steps SET created_at=created_at + INTERVAL '1 second' WHERE id=${input.steps[0]!.id}`;
  const crossedTimestampInventory = await exactStoredInventory();
  await assert.rejects(
    sql.begin((transaction) => persistence.persistWorkflowRunInTransaction(transaction, input)),
    /^Error: RUN_PERSISTENCE_ADOPTION_IDENTITY_INVALID$/,
  );
  assert.deepEqual(await exactStoredInventory(), crossedTimestampInventory);
  await sql`UPDATE steps SET created_at=${first.run.createdAt},updated_at=${first.run.createdAt} WHERE id=${input.steps[0]!.id}`;

  for (const scenario of [
    {
      label: "pending",
      dropStateShape: true,
      disableAuthorityImmutability: false,
      mutation: `UPDATE internal_production_owner_reservations_v1 SET state='pending' WHERE owner_key='${input.run.id}' RETURNING state AS observed`,
      observed: "pending",
    },
    {
      label: "closed",
      dropStateShape: true,
      disableAuthorityImmutability: false,
      mutation: `UPDATE internal_production_owner_reservations_v1 SET state='closed' WHERE owner_key='${input.run.id}' RETURNING state AS observed`,
      observed: "closed",
    },
    {
      label: "crossed reservation",
      dropStateShape: false,
      disableAuthorityImmutability: false,
      mutation: `UPDATE internal_production_owner_reservations_v1 SET owner_key='crossed-owner' WHERE owner_key='${input.run.id}' RETURNING owner_key AS observed`,
      observed: "crossed-owner",
    },
    {
      label: "crossed binding",
      dropStateShape: false,
      disableAuthorityImmutability: false,
      mutation: `UPDATE internal_production_owner_reservations_v1 SET binding_payload=jsonb_set(binding_payload,'{canonicalOwnerIdentity,ownerHash}',to_jsonb(repeat('e',64))) WHERE owner_key='${input.run.id}' RETURNING binding_payload #>> '{canonicalOwnerIdentity,ownerHash}' AS observed`,
      observed: "e".repeat(64),
    },
    {
      label: "crossed authority",
      dropStateShape: false,
      disableAuthorityImmutability: true,
      mutation: `UPDATE internal_production_owner_admission_authorities_v1 SET authority_body=jsonb_set(authority_body,'{canonicalOwnerIdentity,ownerHash}',to_jsonb(repeat('d',64))) WHERE authority_kind='binding' AND phase_key='${first.runOwnerReservationRef}' RETURNING authority_body #>> '{canonicalOwnerIdentity,ownerHash}' AS observed`,
      observed: "d".repeat(64),
    },
  ] as const) {
    const beforeSidecarDrift = await exactStoredInventory();
    await assert.rejects(
      sql.begin(async (transaction) => {
        if (scenario.dropStateShape) {
          await transaction.unsafe(
            "ALTER TABLE internal_production_owner_reservations_v1 DROP CONSTRAINT internal_production_owner_reservation_state_shape_check",
          );
        }
        if (scenario.disableAuthorityImmutability) {
          await transaction.unsafe(
            "ALTER TABLE internal_production_owner_admission_authorities_v1 DISABLE TRIGGER trg_internal_production_owner_admission_authority_immutable",
          );
        }
        const changed = await transaction.unsafe<Array<{ observed: string }>>(scenario.mutation);
        assert.equal(changed.length, 1, `${scenario.label} setup must change exactly one row before persistence`);
        assert.equal(changed[0]!.observed, scenario.observed, `${scenario.label} setup must complete before persistence`);
        await persistence.persistWorkflowRunInTransaction(transaction, input);
        throw new Error(`TEST_ACCEPTED_${scenario.label.toUpperCase().replaceAll(" ", "_")}`);
      }),
      /^Error: INTERNAL_PRODUCTION_OWNER_RESERVATION_CORRUPTION$/,
    );
    assert.deepEqual(await exactStoredInventory(), beforeSidecarDrift);
  }

  await sql`
    INSERT INTO claim_log (run_id,step_id,story_id,agent_id,outcome)
    VALUES (${input.run.id},${input.steps[0]!.stepId},'US-TASK2-ADOPTION','task2-reviewer','test_terminal')
  `;
  const downstreamInventory = await exactStoredInventory();
  await assert.rejects(
    sql.begin((transaction) => persistence.persistWorkflowRunInTransaction(transaction, input)),
    /^RunActivationConflictError: RUN_ACTIVATION_CONFLICT:/,
  );
  assert.deepEqual(await exactStoredInventory(), downstreamInventory);
  await sql`DELETE FROM claim_log WHERE run_id=${input.run.id}`;

  await sql.unsafe(
    `INSERT INTO execution_attempts (
       attempt_id,run_id,step_id,story_id,generation,fence_token,attempt_class,
       compilation_report_hash,source_before_sha,source_before_tree_hash,role,
       lease_acquired_at,lease_expires_at,heartbeat_at,disposition
     ) VALUES ($1,$2,$3,'US-TASK2-ADOPTION',1,$4,'evidence_only',$5,$6,$7,
               'reviewer',NOW(),NOW(),NOW(),'verified')`,
    [
      "ATT_task2-adoption-downstream",
      input.run.id,
      input.steps[0]!.stepId,
      "f".repeat(64),
      "e".repeat(64),
      "d".repeat(40),
      "c".repeat(40),
    ],
  );
  const downstreamAttemptInventory = await exactStoredInventory();
  await assert.rejects(
    sql.begin((transaction) => persistence.persistWorkflowRunInTransaction(transaction, input)),
    /^RunActivationConflictError: RUN_ACTIVATION_CONFLICT:/,
  );
  assert.deepEqual(await exactStoredInventory(), downstreamAttemptInventory);
  await sql`DELETE FROM execution_attempts WHERE run_id=${input.run.id}`;

  const beforeSecondPair = await exactStoredInventory();
  await assert.rejects(
    sql.begin(async (transaction) => {
      await transaction.unsafe(
        "ALTER TABLE internal_production_owner_reservations_v1 DROP CONSTRAINT internal_production_owner_reservation_key_unique",
      );
      await transaction.unsafe(
        `INSERT INTO internal_production_owner_reservations_v1 (
           reservation_ref,reservation_hash,category,owner_key,owner_key_hash,
           producer_purpose_hash,producer_implementation_id,producer_implementation_hash,
           reservation_payload,reservation_head_predecessor_hash,state,
           canonical_owner_identity,binding_hash,binding_payload,head_version,
           created_at,updated_at
         ) SELECT $1,$2,category,owner_key,owner_key_hash,producer_purpose_hash,
                  producer_implementation_id,producer_implementation_hash,
                  reservation_payload,reservation_head_predecessor_hash,state,
                  canonical_owner_identity,binding_hash,binding_payload,head_version,
                  created_at,updated_at
             FROM internal_production_owner_reservations_v1
            WHERE owner_key=$3`,
        [
          "setfarm://tests/task2-second-run-owner-pair",
          "9".repeat(64),
          input.run.id,
        ],
      );
      await persistence.persistWorkflowRunInTransaction(transaction, input);
      throw new Error("TEST_ACCEPTED_SECOND_RUN_OWNER_PAIR");
    }),
    (error: unknown) => !String(error).includes("TEST_ACCEPTED_SECOND_RUN_OWNER_PAIR"),
  );
  assert.deepEqual(await exactStoredInventory(), beforeSecondPair);

  const ownerInventory = async (ownerKey: string) => (await sql<Array<{
    runs: string;
    steps: string;
    reservations: string;
    bindings: string;
  }>>`
    SELECT
      (SELECT COUNT(*)::text FROM runs WHERE id=${ownerKey}) AS runs,
      (SELECT COUNT(*)::text FROM steps WHERE run_id=${ownerKey}) AS steps,
      (SELECT COUNT(*)::text FROM internal_production_owner_reservations_v1 WHERE owner_key=${ownerKey}) AS reservations,
      (SELECT COUNT(*)::text
         FROM internal_production_owner_admission_authorities_v1 authority
         JOIN internal_production_owner_reservations_v1 reservation
           ON reservation.reservation_ref=authority.phase_key
        WHERE reservation.owner_key=${ownerKey} AND authority.authority_kind='binding') AS bindings
  `)[0]!;
  const emptyOwnerInventory = { runs: "0", steps: "0", reservations: "0", bindings: "0" };
  const forgedBindingInput = {
    ...input,
    run: { ...input.run, id: "run-persistence-task2-forged-binding", runNumber: 1802 },
    steps: input.steps.map((step, index) => ({ ...step, id: `run-persistence-task2-forged-binding-step-${index}` })),
  };
  await sql.unsafe(`CREATE FUNCTION ip_task2_forge_binding_v1() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      IF NEW.authority_kind='binding'
         AND NEW.authority_body #>> '{canonicalOwnerIdentity,ownerKey}' = 'run-persistence-task2-forged-binding' THEN
        NEW.authority_body = jsonb_set(
          NEW.authority_body,
          '{canonicalOwnerIdentity,ownerHash}',
          to_jsonb(repeat('f', 64))
        );
      END IF;
      RETURN NEW;
    END $$`);
  await sql.unsafe(`CREATE TRIGGER ip_task2_forge_binding_v1
    BEFORE INSERT ON internal_production_owner_admission_authorities_v1
    FOR EACH ROW EXECUTE FUNCTION ip_task2_forge_binding_v1()`);
  try {
    await assert.rejects(
      sql.begin(async (transaction) => {
        await persistence.persistWorkflowRunInTransaction(transaction, forgedBindingInput);
        throw new Error("TEST_ACCEPTED_FORGED_BINDING_AUTHORITY");
      }),
      /^Error: INTERNAL_PRODUCTION_OWNER_RESERVATION_CORRUPTION$/,
    );
    assert.deepEqual(await ownerInventory(forgedBindingInput.run.id), emptyOwnerInventory);
  } finally {
    await sql.unsafe("DROP TRIGGER ip_task2_forge_binding_v1 ON internal_production_owner_admission_authorities_v1");
    await sql.unsafe("DROP FUNCTION ip_task2_forge_binding_v1()");
  }
  const forgedReservationInput = {
    ...input,
    run: { ...input.run, id: "run-persistence-task2-forged-reservation", runNumber: 1803 },
    steps: input.steps.map((step, index) => ({ ...step, id: `run-persistence-task2-forged-reservation-step-${index}` })),
  };
  await sql.unsafe(`CREATE FUNCTION ip_task2_forge_reservation_on_bind_v1() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      IF OLD.state='pending'
         AND NEW.state='bound'
         AND NEW.owner_key='run-persistence-task2-forged-reservation' THEN
        NEW.owner_key = 'run-persistence-task2-forged-reservation-crossed';
      END IF;
      RETURN NEW;
    END $$`);
  await sql.unsafe(`CREATE TRIGGER ip_task2_forge_reservation_on_bind_v1
    BEFORE UPDATE ON internal_production_owner_reservations_v1
    FOR EACH ROW EXECUTE FUNCTION ip_task2_forge_reservation_on_bind_v1()`);
  try {
    await assert.rejects(
      sql.begin(async (transaction) => {
        await persistence.persistWorkflowRunInTransaction(transaction, forgedReservationInput);
        throw new Error("TEST_ACCEPTED_FORGED_RESERVATION_DURING_BIND");
      }),
      /^Error: INTERNAL_PRODUCTION_OWNER_RESERVATION_CORRUPTION$/,
    );
    assert.deepEqual(await ownerInventory(forgedReservationInput.run.id), emptyOwnerInventory);
  } finally {
    await sql.unsafe("DROP TRIGGER ip_task2_forge_reservation_on_bind_v1 ON internal_production_owner_reservations_v1");
    await sql.unsafe("DROP FUNCTION ip_task2_forge_reservation_on_bind_v1()");
  }
  const rollbackInput = {
    ...input,
    run: { ...input.run, id: "run-persistence-task2-rollback", runNumber: 1804 },
    steps: input.steps.map((step, index) => ({ ...step, id: `run-persistence-task2-rollback-step-${index}` })),
  };
  await assert.rejects(
    sql.begin(async (transaction) => {
      await persistence.persistWorkflowRunInTransaction(transaction, rollbackInput);
      throw new Error("TEST_ROLLBACK_AFTER_TENTATIVE_RESULT");
    }),
    /^Error: TEST_ROLLBACK_AFTER_TENTATIVE_RESULT$/,
  );
  assert.deepEqual(await ownerInventory(rollbackInput.run.id), emptyOwnerInventory);

  const commitRejectedInput = {
    ...input,
    run: { ...input.run, id: "run-persistence-task2-commit-rejected", runNumber: 1805 },
    steps: input.steps.map((step, index) => ({ ...step, id: `run-persistence-task2-commit-rejected-step-${index}` })),
  };
  await sql.unsafe(`CREATE FUNCTION ip_task2_reject_run_commit_v1() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      IF NEW.id = 'run-persistence-task2-commit-rejected' THEN
        RAISE EXCEPTION 'TEST_DEFERRED_RUN_COMMIT_REJECTED';
      END IF;
      RETURN NEW;
    END $$`);
  await sql.unsafe(`CREATE CONSTRAINT TRIGGER ip_task2_reject_run_commit_v1
    AFTER INSERT ON runs DEFERRABLE INITIALLY DEFERRED
    FOR EACH ROW EXECUTE FUNCTION ip_task2_reject_run_commit_v1()`);
  try {
    await assert.rejects(
      persistence.persistWorkflowRun(commitRejectedInput),
      /TEST_DEFERRED_RUN_COMMIT_REJECTED/,
    );
    assert.deepEqual(await ownerInventory(commitRejectedInput.run.id), emptyOwnerInventory);
  } finally {
    await sql.unsafe("DROP TRIGGER ip_task2_reject_run_commit_v1 ON runs");
    await sql.unsafe("DROP FUNCTION ip_task2_reject_run_commit_v1()");
  }

  const backendLossInput = {
    ...input,
    run: { ...input.run, id: "run-persistence-task2-backend-loss", runNumber: 1806 },
    steps: input.steps.map((step, index) => ({ ...step, id: `run-persistence-task2-backend-loss-step-${index}` })),
  };
  const advisoryKey = 882018;
  await sql.unsafe(`CREATE FUNCTION ip_task2_wait_reservation_v1() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      IF NEW.owner_key = 'run-persistence-task2-backend-loss' THEN
        PERFORM pg_advisory_xact_lock(${advisoryKey});
      END IF;
      RETURN NEW;
    END $$`);
  await sql.unsafe(`CREATE TRIGGER ip_task2_wait_reservation_v1
    BEFORE INSERT ON internal_production_owner_reservations_v1
    FOR EACH ROW EXECUTE FUNCTION ip_task2_wait_reservation_v1()`);
  let releaseAdvisoryHolder!: () => void;
  let reportAdvisoryHeld!: () => void;
  const advisoryHeld = new Promise<void>((resolve) => { reportAdvisoryHeld = resolve; });
  const releaseAdvisory = new Promise<void>((resolve) => { releaseAdvisoryHolder = resolve; });
  const advisoryHolder = sql.begin(async (transaction) => {
    await transaction.unsafe("SELECT pg_advisory_xact_lock($1)", [advisoryKey]);
    reportAdvisoryHeld();
    await releaseAdvisory;
  });
  await advisoryHeld;
  try {
    const publisher = new Promise<Readonly<{ type: string; status?: string; error?: string }>>((resolve) => {
      backendWorker.once("message", (message) => resolve(message as { type: string; status?: string; error?: string }));
      backendWorker.once("error", (error) => resolve({ type: "worker-error", error: String(error) }));
      backendWorker.once("exit", (code) => resolve({ type: "worker-exit", error: String(code) }));
    });
    backendWorker.postMessage({ input: backendLossInput });
    let blocked: Array<{ pid: number }> = [];
    for (let attempt = 0; attempt < 100; attempt += 1) {
      blocked = await sql<Array<{ pid: number }>>`
        SELECT pid
          FROM pg_stat_activity
         WHERE datname=current_database()
           AND pid <> pg_backend_pid()
           AND wait_event_type='Lock'
           AND wait_event='advisory'
           AND query LIKE '%internal_production_owner_reservations_v1%'
      `;
      if (blocked.length === 1) break;
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
    assert.equal(blocked.length, 1, `expected one exact blocked publisher, saw ${JSON.stringify(blocked)}`);
    assert.deepEqual(
      [...await sql`SELECT pg_terminate_backend(${blocked[0]!.pid}) AS terminated`],
      [{ terminated: true }],
    );
    const outcome = await publisher;
    assert.notEqual(outcome.status, "fulfilled");
  } finally {
    await backendWorker.terminate();
    releaseAdvisoryHolder();
    await advisoryHolder;
    await sql.unsafe("DROP TRIGGER ip_task2_wait_reservation_v1 ON internal_production_owner_reservations_v1");
    await sql.unsafe("DROP FUNCTION ip_task2_wait_reservation_v1()");
  }
  assert.deepEqual(await ownerInventory(backendLossInput.run.id), emptyOwnerInventory);

  const duplicateStepInput = {
    ...input,
    run: { ...input.run, id: "run-persistence-task2-duplicate-step", runNumber: 1807 },
    steps: [
      { ...input.steps[0]!, id: "run-persistence-task2-duplicate" },
      { ...input.steps[0]!, id: "run-persistence-task2-duplicate", stepIndex: 1 },
    ],
  };
  await assert.rejects(
    sql.begin((transaction) => persistence.persistWorkflowRunInTransaction(transaction, duplicateStepInput)),
  );
  assert.deepEqual(await ownerInventory(duplicateStepInput.run.id), emptyOwnerInventory);

  const fixtureTerminal = await import(`${pathToFileURL(path.join(root, "src/execution/run-terminal-transition.ts")).href}?task3=${Date.now()}`);
  const fixtureRunTermination = await import(
    `${pathToFileURL(path.join(root, "src/execution/run-termination.ts")).href}?task3=${Date.now()}`
  );
  const topologyInput = (state: "pending" | "bound" | "closed", runNumber: number) => {
    const runId = `run-persistence-task2-preexisting-${state}`;
    return {
      ...input,
      run: { ...input.run, id: runId, runNumber },
      steps: input.steps.map((step, index) => ({ ...step, id: `${runId}-step-${index}` })),
    };
  };
  for (const [state, runNumber] of [
    ["pending", 1810],
    ["bound", 1811],
    ["closed", 1812],
  ] as const) {
    const topology = topologyInput(state, runNumber);
    if (state === "closed") {
      await persistence.persistWorkflowRun(topology);
      await sql.begin((transaction) => fixtureTerminal.transitionRunToTerminalInTransaction(
        transaction,
        {
          runId: topology.run.id,
          status: "failed",
          diagnostic: "task2 pre-existing closed sidecar fixture",
          unclaimedBootstrapFailure: true,
        },
      ));
      const deleted = await sql<Array<{ id: string }>>`
        DELETE FROM runs WHERE id=${topology.run.id} RETURNING id
      `;
      assert.deepEqual(deleted.map((row) => row.id), [topology.run.id]);
    } else {
      await sql.begin(async (transaction) => {
        const reservation = await fixtureDb.beginOrAdoptInternalProductionOwnerReservationV1(
          transaction,
          { producerImplementationId: "a-runtime-run-v1", ownerKey: topology.run.id },
        );
        if (state === "bound") {
          await fixtureDb.bindInternalProductionOwnerReservationV1(transaction, {
            reservationRef: reservation.reservationRef,
            reservationHash: reservation.reservationHash,
            canonicalOwnerIdentity: fixtureDb.createInternalProductionWorkflowRunCanonicalOwnerIdentityV1(
              topology.run.id,
            ),
          });
        }
      });
    }
    assert.deepEqual(
      [...await sql<Array<{ runs: string; steps: string; reservations: string; state: string }>>`
        SELECT
          (SELECT COUNT(*)::text FROM runs WHERE id=${topology.run.id}) AS runs,
          (SELECT COUNT(*)::text FROM steps WHERE run_id=${topology.run.id}) AS steps,
          COUNT(*)::text AS reservations,
          MIN(state) AS state
        FROM internal_production_owner_reservations_v1
        WHERE owner_key=${topology.run.id}
      `],
      [{ runs: "0", steps: "0", reservations: "1", state }],
    );
    const beforeTopologyAttempt = await exactStoredInventory(topology.run.id);
    const insertProbe = `ip_task2_preexisting_${state}_insert_probe_v1`;
    await sql.unsafe(`CREATE SEQUENCE ${insertProbe} START WITH 1`);
    await sql.unsafe(`CREATE FUNCTION ${insertProbe}() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        IF NEW.id='${topology.run.id}' THEN PERFORM nextval('${insertProbe}'); END IF;
        RETURN NEW;
      END $$`);
    await sql.unsafe(`CREATE TRIGGER ${insertProbe}
      BEFORE INSERT ON runs FOR EACH ROW EXECUTE FUNCTION ${insertProbe}()`);
    try {
      await assert.rejects(
        sql.begin(async (transaction) => {
          await persistence.persistWorkflowRunInTransaction(transaction, topology);
          throw new Error(`TEST_ACCEPTED_PREEXISTING_${state.toUpperCase()}_OWNER`);
        }),
        /^Error: RUN_PERSISTENCE_PREEXISTING_OWNER_INVALID$/,
      );
      assert.deepEqual(
        [...await sql`SELECT last_value::text,is_called FROM ${sql(insertProbe)}`],
        [{ last_value: "1", is_called: false }],
        `${state} topology must reject before the run INSERT`,
      );
    } finally {
      await sql.unsafe(`DROP TRIGGER ${insertProbe} ON runs`);
      await sql.unsafe(`DROP FUNCTION ${insertProbe}()`);
      await sql.unsafe(`DROP SEQUENCE ${insertProbe}`);
    }
    assert.deepEqual(await exactStoredInventory(topology.run.id), beforeTopologyAttempt);
  }
  const sameTransactionTopology = topologyInput("pending", 1813);
  sameTransactionTopology.run.id = "run-persistence-task2-precreated-same-transaction";
  sameTransactionTopology.steps = sameTransactionTopology.steps.map((step, index) => ({
    ...step,
    id: `${sameTransactionTopology.run.id}-step-${index}`,
  }));
  const sameTransactionProbe = "ip_task2_same_transaction_insert_probe_v1";
  await sql.unsafe(`CREATE SEQUENCE ${sameTransactionProbe} START WITH 1`);
  await sql.unsafe(`CREATE FUNCTION ${sameTransactionProbe}() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      IF NEW.id='${sameTransactionTopology.run.id}' THEN PERFORM nextval('${sameTransactionProbe}'); END IF;
      RETURN NEW;
    END $$`);
  await sql.unsafe(`CREATE TRIGGER ${sameTransactionProbe}
    BEFORE INSERT ON runs FOR EACH ROW EXECUTE FUNCTION ${sameTransactionProbe}()`);
  try {
    await assert.rejects(
      sql.begin(async (transaction) => {
        await fixtureDb.beginOrAdoptInternalProductionOwnerReservationV1(transaction, {
          producerImplementationId: "a-runtime-run-v1",
          ownerKey: sameTransactionTopology.run.id,
        });
        await persistence.persistWorkflowRunInTransaction(transaction, sameTransactionTopology);
        throw new Error("TEST_ACCEPTED_SAME_TRANSACTION_PREEXISTING_OWNER");
      }),
      /^Error: RUN_PERSISTENCE_PREEXISTING_OWNER_INVALID$/,
    );
    assert.deepEqual(
      [...await sql`SELECT last_value::text,is_called FROM ${sql(sameTransactionProbe)}`],
      [{ last_value: "1", is_called: false }],
    );
  } finally {
    await sql.unsafe(`DROP TRIGGER ${sameTransactionProbe} ON runs`);
    await sql.unsafe(`DROP FUNCTION ${sameTransactionProbe}()`);
    await sql.unsafe(`DROP SEQUENCE ${sameTransactionProbe}`);
  }
  assert.deepEqual(
    await ownerInventory(sameTransactionTopology.run.id),
    emptyOwnerInventory,
  );
  const ownerHeadBeforeTerminal = (await sql<Array<{ head_version: string }>>`
    SELECT head_version::text FROM internal_production_owner_admission_head_v1 WHERE singleton=TRUE
  `)[0]!.head_version;
  const terminalResult = await sql.begin((transaction) => fixtureTerminal.transitionRunToTerminalInTransaction(
    transaction,
    {
      runId: input.run.id,
      status: "failed",
      diagnostic: "task3 exact owner close",
      unclaimedBootstrapFailure: true,
    },
  ));
  assert.equal(terminalResult.status, "failed");
  const terminalOwner = (await sql<Array<{
    run_status: string;
    owner_state: string;
    close_ref: string | null;
    close_hash: string | null;
    head_version: string;
  }>>`
    SELECT run.status AS run_status,reservation.state AS owner_state,
           reservation.close_ref,reservation.close_hash,head.head_version::text
      FROM runs run
      JOIN internal_production_owner_reservations_v1 reservation
        ON reservation.owner_key=run.id AND reservation.category='run'
      CROSS JOIN internal_production_owner_admission_head_v1 head
     WHERE run.id=${input.run.id} AND head.singleton=TRUE
  `)[0]!;
  assert.equal(terminalOwner.run_status, "failed");
  assert.equal(terminalOwner.owner_state, "closed");
  assert.match(terminalOwner.close_ref ?? "", /^setfarm:\/\/internal-production\/owner-reservation-closes\//);
  assert.match(terminalOwner.close_hash ?? "", /^[a-f0-9]{64}$/);
  assert.equal(BigInt(terminalOwner.head_version), BigInt(ownerHeadBeforeTerminal) + 1n);
  const beforeTerminalReplay = await exactStoredInventory();
  const replayedTerminal = await sql.begin((transaction) => fixtureTerminal.transitionRunToTerminalInTransaction(
    transaction,
    {
      runId: input.run.id,
      status: "failed",
      diagnostic: "task3 response-loss replay",
      unclaimedBootstrapFailure: true,
    },
  ));
  assert.equal(replayedTerminal.previousStatus, "failed");
  assert.deepEqual(await exactStoredInventory(), beforeTerminalReplay);

  const fixtureRuntimeCompletion = await import(
    `${pathToFileURL(path.join(root, "src/execution/runtime-completion.ts")).href}?task3=${Date.now()}`
  );
  const fixtureRuntimeSession = await import(
    `${pathToFileURL(path.join(root, "src/execution/runtime-session-repository.ts")).href}?task3=${Date.now()}`
  );
  const fixtureRuntimeCompletionOwner = await import(
    pathToFileURL(path.join(root, "src/execution/runtime-completion-owner-context.ts")).href
  );
  const fixtureRuntimeCompletionPlan = await import(
    `${pathToFileURL(path.join(root, "src/execution/schemas/runtime-completion-plan-v1.ts")).href}?task3=${Date.now()}`
  );
  const fixtureClaimRuntime = await import(
    `${pathToFileURL(path.join(root, "src/execution/claim-runtime-publication.ts")).href}?task3=${Date.now()}`
  );
  const fixtureRuntimeCompletionEffect = await import(
    `${pathToFileURL(path.join(root, "src/execution/runtime-completion-effect-repository.ts")).href}?task3=${Date.now()}`
  );
  const seedPopulatedTask3TerminalRun = async (runId: string, runNumber: number) => {
    const runInput = {
      ...input,
      run: { ...input.run, id: runId, runNumber },
      steps: input.steps.map((step, index) => ({ ...step, id: `${runId}-step-${index}` })),
    };
    await persistence.persistWorkflowRun(runInput);
    const step = runInput.steps[0]!;
    const storyDbId = `${runId}-story`;
    const storyId = "US-TASK3-ROLLBACK";
    await sql`UPDATE steps SET status='running',current_story_id=${storyDbId} WHERE id=${step.id}`;
    await sql`
      INSERT INTO stories (
        id,run_id,story_index,story_id,title,status,claimed_by,claim_generation
      ) VALUES (
        ${storyDbId},${runId},1,${storyId},'Task 3 terminal rollback','running',
        'feature-dev_developer',1
      )
    `;
    const claimId = await sql.begin(async (transaction) => {
      const idRows = await transaction.unsafe<Array<{ id: string }>>(
        "SELECT nextval(pg_get_serial_sequence('claim_log','id'))::bigint::text AS id",
      );
      const birth = await fixtureClaimRuntime.prepareInternalProductionClaimBirthV1(
        transaction,
        "a-claim-loop-runtime-v1",
        idRows,
      );
      return fixtureClaimRuntime.insertAndBindInternalProductionClaimBirthV1(
        transaction,
        birth,
        {
          runId,
          workflowStepId: step.stepId,
          storyId,
          claimAgentId: "feature-dev_developer",
          claimedAt: new Date(),
        },
      );
    });
    const sessions = fixtureRuntimeSession.createRuntimeSessionRepository(sql);
    const session = await sessions.reserve({
      sessionId: `RTS_${runId}`,
      runId,
      stepDbId: step.id,
      workflowStepId: step.stepId,
      storyDbId,
      storyId,
      claimId,
      claimAgentId: "feature-dev_developer",
      runtimeAgentId: "prism",
      runtimeKind: "openclaw_session",
      ownerInstanceId: "task3-owner",
    });
    await sessions.markStarting({ sessionId: session.sessionId, ownerInstanceId: "task3-owner" });
    await sessions.markRunning({
      sessionId: session.sessionId,
      ownerInstanceId: "task3-owner",
      sessionKey: `task3-${runId}`,
    });
    const requestId = `RCR_${runId}`;
    const requested = await fixtureRuntimeCompletion.requestRuntimeCompletion(sql, {
      envelope: {
        schema: "setfarm.claim-envelope.v1",
        protocol: "legacy",
        issuedAt: "2026-08-21T00:00:00.000Z",
        stepId: step.id,
        workflowStepId: step.stepId,
        runId,
        storyId,
        storyDbId,
        claimId,
        claimAgentId: "feature-dev_developer",
        runtimeAgentId: "prism",
      },
      output: "STATUS: failed\nERROR: Task 3 terminal rollback fixture",
      requestId,
    });
    assert.equal(requested.status, "requested");
    const completions = fixtureRuntimeCompletion.createRuntimeCompletionRepository(sql);
    await completions.claim({ requestId, ownerInstanceId: "task3-completion-owner" });
    await sessions.requestDrain({
      sessionId: session.sessionId,
      ownerInstanceId: "task3-owner",
      diagnostic: "Task 3 terminal fixture drain",
    });
    await sessions.markDrained({
      sessionId: session.sessionId,
      ownerInstanceId: "task3-owner",
      evidence: {
        schema: "setfarm.runtime-drain-evidence.v1",
        observedAt: "2026-08-21T00:00:00.000Z",
        localProcessAbsent: true,
        openClawTaskAbsent: true,
        workspaceProcessAbsent: true,
        stableObservations: 2,
        evidenceRefs: ["setfarm://tests/task3/runtime-drained"],
      },
    });
    await completions.markProcessing({ requestId, ownerInstanceId: "task3-completion-owner" });
    const owned = await completions.findById(requestId);
    assert.ok(owned?.ownerInstanceId && owned.leaseExpiresAt);
    await fixtureRuntimeCompletionOwner.runWithRuntimeCompletionOwner({
      requestId,
      ownerInstanceId: owned.ownerInstanceId,
      leaseExpiresAt: owned.leaseExpiresAt,
      ownerAttemptCount: owned.ownerAttemptCount,
    }, () => sql.begin(async (transaction) => {
      const closedClaims = await transaction.unsafe<Array<{ id: number }>>(
        `UPDATE claim_log
            SET outcome='failed',abandoned_at=NOW(),duration_ms=0,
                diagnostic='Task 3 processing completion owns terminal failure'
          WHERE id=$1 AND run_id=$2 AND outcome IS NULL
          RETURNING id::integer AS id`,
        [claimId, runId],
      );
      assert.equal(closedClaims.length, 1);
      assert.equal(closedClaims[0]!.id, claimId);
      await fixtureRuntimeCompletion.markRuntimeCompletionOwnerCommittedInTransaction(transaction, {
        claimId,
        claimOutcome: "failed",
        plan: fixtureRuntimeCompletionPlan.createSingleEffectCompletionPlanDescriptorV1({
          kind: "terminal_transition",
          continuation: { type: "terminal_finalize" },
          effectPayload: { runStatus: "failed" },
        }),
      });
    }));
    const effectResult = {
      runStatus: "failed",
      advanced: false,
      runCompleted: false,
      runFailed: true,
    };
    const effects = fixtureRuntimeCompletionEffect.createRuntimeCompletionEffectRepository(sql);
    const leasedEffect = await effects.claimNext({
      requestId,
      ownerInstanceId: owned.ownerInstanceId,
    });
    assert.ok(leasedEffect?.leaseToken);
    await effects.settle({
      requestId,
      effectKey: leasedEffect.effectKey,
      ownerInstanceId: owned.ownerInstanceId,
      leaseToken: leasedEffect.leaseToken,
      resolution: "applied",
      result: effectResult,
      evidence: { schema: "setfarm.task3-terminal-fixture-effect.v1" },
    });
    const effectsCommitted = await completions.markEffectsCommitted({
      requestId,
      ownerInstanceId: owned.ownerInstanceId,
      ownerAttemptCount: owned.ownerAttemptCount,
      result: effectResult,
    });
    assert.equal(effectsCommitted.applyPhase, "effects_committed");
    const terminationRequestId = `RTR_${runId}`;
    assertCanonicalTerminationRequestId(terminationRequestId);
    const requestedTermination = await fixtureRunTermination.requestRunTermination(sql, {
      runId,
      targetStatus: "failed",
      requestedBy: "task3-test",
      diagnostic: "Task 3 terminal rollback fixture",
      requestId: terminationRequestId,
    });
    assert.equal(requestedTermination.status, "requested");
    const terminations = fixtureRunTermination.createRunTerminationRepository(sql);
    const terminationOwnerInstanceId = `task3-${runNumber}-termination-owner`;
    const claimedTermination = await terminations.claim({
      requestId: terminationRequestId,
      ownerInstanceId: terminationOwnerInstanceId,
    });
    assert.equal(claimedTermination?.state, "draining");
    const drainedTermination = await terminations.markDrained({
      requestId: terminationRequestId,
      ownerInstanceId: terminationOwnerInstanceId,
      evidence: { proofRef: `setfarm://tests/task3/${runNumber}/termination-drain` },
    });
    assert.equal(drainedTermination.state, "drained");
    await sql`
      INSERT INTO operational_outbox (
        outbox_id,event_key,event_type,aggregate_type,aggregate_id,payload,state
      ) VALUES (
        ${`OUT_${runId}`},${`task3/${runId}/preexisting`},'task3.fixture','run',${runId},
        ${{ schema: "setfarm.task3-populated-terminal-fixture.v1", runId }},'pending'
      )
    `;
    return { runInput, terminationRequestId };
  };

  const statusDriftFixture = await seedPopulatedTask3TerminalRun(
    "run-persistence-task3-status-drift",
    1890,
  );
  await sql.unsafe(`CREATE FUNCTION ip_task3_cross_terminal_status_v1() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      IF OLD.id='run-persistence-task3-status-drift' AND NEW.status='failed' THEN
        NEW.status='cancelled';
      END IF;
      RETURN NEW;
    END $$`);
  await sql.unsafe(`CREATE TRIGGER ip_task3_cross_terminal_status_v1
    BEFORE UPDATE ON runs
    FOR EACH ROW EXECUTE FUNCTION ip_task3_cross_terminal_status_v1()`);
  try {
    const beforeStatusDrift = await exactStoredInventory(statusDriftFixture.runInput.run.id);
    await assert.rejects(
      sql.begin(async (transaction) => {
        await fixtureTerminal.transitionRunToTerminalInTransaction(transaction, {
          runId: statusDriftFixture.runInput.run.id,
          status: "failed",
          diagnostic: "task3 terminal status drift",
          drainedTerminationRequestId: statusDriftFixture.terminationRequestId,
        });
        throw new Error("TEST_ACCEPTED_CROSSED_TERMINAL_STATUS");
      }),
      /^Error: RUN_TERMINAL_RUN_CAS_LOST$/,
    );
    assert.deepEqual(
      await exactStoredInventory(statusDriftFixture.runInput.run.id),
      beforeStatusDrift,
    );
  } finally {
    await sql.unsafe("DROP TRIGGER ip_task3_cross_terminal_status_v1 ON runs");
    await sql.unsafe("DROP FUNCTION ip_task3_cross_terminal_status_v1()");
  }
  await sql`UPDATE runs SET status='completed' WHERE id=${statusDriftFixture.runInput.run.id}`;

  const runIdDriftFixture = await seedPopulatedTask3TerminalRun(
    "run-persistence-task3-run-id-drift",
    1891,
  );
  await sql.unsafe("CREATE SEQUENCE ip_task3_cross_run_id_fired_v1 START WITH 1");
  await sql.unsafe(`CREATE FUNCTION ip_task3_cross_run_id_v1() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      IF OLD.id='run-persistence-task3-run-id-drift' AND NEW.status='failed' THEN
        PERFORM nextval('ip_task3_cross_run_id_fired_v1');
        NEW.id='run-persistence-task3-run-id-crossed';
      END IF;
      RETURN NEW;
    END $$`);
  await sql.unsafe(`CREATE TRIGGER ip_task3_cross_run_id_v1
    BEFORE UPDATE ON runs
    FOR EACH ROW EXECUTE FUNCTION ip_task3_cross_run_id_v1()`);
  try {
    assert.deepEqual(
      [...await sql`SELECT last_value::text,is_called FROM ip_task3_cross_run_id_fired_v1`],
      [{ last_value: "1", is_called: false }],
    );
    const beforeRunIdDrift = await exactStoredInventory(runIdDriftFixture.runInput.run.id);
    await assert.rejects(
      sql.begin(async (transaction) => {
        const foreignKeyTriggers = await transaction.unsafe<Array<{
          table_name: string;
          trigger_name: string;
        }>>(
          `SELECT format('%I.%I',namespace.nspname,relation.relname) AS table_name,
                  quote_ident(trigger.tgname) AS trigger_name
             FROM pg_constraint constraint_row
             JOIN pg_trigger trigger ON trigger.tgconstraint=constraint_row.oid
             JOIN pg_class relation ON relation.oid=trigger.tgrelid
             JOIN pg_namespace namespace ON namespace.oid=relation.relnamespace
            WHERE constraint_row.contype='f'
              AND constraint_row.confrelid='runs'::regclass
            ORDER BY table_name,trigger_name`,
        );
        assert.ok(foreignKeyTriggers.length > 0);
        for (const trigger of foreignKeyTriggers) {
          await transaction.unsafe(
            `ALTER TABLE ${trigger.table_name} DISABLE TRIGGER ${trigger.trigger_name}`,
          );
        }
        await fixtureTerminal.transitionRunToTerminalInTransaction(transaction, {
          runId: runIdDriftFixture.runInput.run.id,
          status: "failed",
          diagnostic: "task3 stored run id drift",
          drainedTerminationRequestId: runIdDriftFixture.terminationRequestId,
        });
        throw new Error("TEST_ACCEPTED_CROSSED_STORED_RUN_ID");
      }),
      /^Error: RUN_TERMINAL_RUN_CAS_LOST$/,
    );
    assert.deepEqual(
      [...await sql`SELECT last_value::text,is_called FROM ip_task3_cross_run_id_fired_v1`],
      [{ last_value: "1", is_called: true }],
    );
    assert.deepEqual(
      await exactStoredInventory(runIdDriftFixture.runInput.run.id),
      beforeRunIdDrift,
    );
  } finally {
    await sql.unsafe("DROP TRIGGER ip_task3_cross_run_id_v1 ON runs");
    await sql.unsafe("DROP FUNCTION ip_task3_cross_run_id_v1()");
    await sql.unsafe("DROP SEQUENCE ip_task3_cross_run_id_fired_v1");
  }
  await sql`UPDATE runs SET status='completed' WHERE id=${runIdDriftFixture.runInput.run.id}`;

  const tamperFixture = await seedPopulatedTask3TerminalRun(
    "run-persistence-task3-tamper-matrix",
    1892,
  );
  type Task3TransactionSql = Parameters<
    typeof fixtureTerminal.transitionRunToTerminalInTransaction
  >[0];
  const noTask3FixtureCleanup = async () => {};
  for (const scenario of [
    {
      label: "crossed run identity",
      expected: /^Error: INTERNAL_PRODUCTION_WORKFLOW_RUN_OWNER_CORRUPTION$/,
      install: async () => noTask3FixtureCleanup,
      mutate: async (transaction: Task3TransactionSql) => {
        await transaction.unsafe(
          "ALTER TABLE internal_production_owner_reservations_v1 DISABLE TRIGGER USER",
        );
        const changed = await transaction.unsafe<Array<{ owner_key: string }>>(
          `UPDATE internal_production_owner_reservations_v1
              SET binding_payload=jsonb_set(
                    binding_payload,'{canonicalOwnerIdentity,ownerKey}',
                    to_jsonb('run-persistence-task3-crossed-run'::text)
                  )
            WHERE owner_key=$1
          RETURNING binding_payload #>> '{canonicalOwnerIdentity,ownerKey}' AS owner_key`,
          [tamperFixture.runInput.run.id],
        );
        assert.equal(changed.length, 1);
        assert.equal(changed[0]!.owner_key, "run-persistence-task3-crossed-run");
      },
    },
    {
      label: "crossed reservation pair",
      expected: /^Error: INTERNAL_PRODUCTION_WORKFLOW_RUN_OWNER_CORRUPTION$/,
      install: async () => noTask3FixtureCleanup,
      mutate: async (transaction: Task3TransactionSql) => {
        await transaction.unsafe(
          "ALTER TABLE internal_production_owner_reservations_v1 DISABLE TRIGGER USER",
        );
        const changed = await transaction.unsafe<Array<{ reservation_hash: string }>>(
          `UPDATE internal_production_owner_reservations_v1
              SET reservation_hash=repeat('8',64)
            WHERE owner_key=$1
          RETURNING reservation_hash`,
          [tamperFixture.runInput.run.id],
        );
        assert.equal(changed.length, 1);
        assert.equal(changed[0]!.reservation_hash, "8".repeat(64));
      },
    },
    {
      label: "missing binding authority",
      expected: /^Error: INTERNAL_PRODUCTION_WORKFLOW_RUN_OWNER_CORRUPTION$/,
      install: async () => noTask3FixtureCleanup,
      mutate: async (transaction: Task3TransactionSql) => {
        await transaction.unsafe(
          "ALTER TABLE internal_production_owner_admission_authorities_v1 DISABLE TRIGGER USER",
        );
        const removed = await transaction.unsafe<Array<{ authority_ref: string }>>(
          `DELETE FROM internal_production_owner_admission_authorities_v1 authority
            USING internal_production_owner_reservations_v1 reservation
           WHERE reservation.owner_key=$1
             AND authority.authority_kind='binding'
             AND authority.phase_key=reservation.reservation_ref
          RETURNING authority.authority_ref`,
          [tamperFixture.runInput.run.id],
        );
        assert.equal(removed.length, 1);
      },
    },
    {
      label: "crossed terminal hash",
      expected: /^Error: INTERNAL_PRODUCTION_OWNER_RESERVATION_CLOSE_CORRUPTION$/,
      install: async () => {
        await sql.unsafe(`CREATE FUNCTION ip_task3_cross_terminal_hash_v1() RETURNS trigger LANGUAGE plpgsql AS $$
          BEGIN
            IF OLD.owner_key='run-persistence-task3-tamper-matrix'
               AND OLD.state='bound' AND NEW.state='closed' THEN
              NEW.terminal_owner_hash=repeat('9',64);
            END IF;
            RETURN NEW;
          END $$`);
        await sql.unsafe(`CREATE TRIGGER ip_task3_cross_terminal_hash_v1
          BEFORE UPDATE ON internal_production_owner_reservations_v1
          FOR EACH ROW EXECUTE FUNCTION ip_task3_cross_terminal_hash_v1()`);
        return async () => {
          await sql.unsafe(
            "DROP TRIGGER ip_task3_cross_terminal_hash_v1 ON internal_production_owner_reservations_v1",
          );
          await sql.unsafe("DROP FUNCTION ip_task3_cross_terminal_hash_v1()");
        };
      },
      mutate: async (_transaction: Task3TransactionSql) => {},
    },
  ] as const) {
    const cleanup = await scenario.install();
    try {
      const beforeTamper = await exactStoredInventory(tamperFixture.runInput.run.id);
      await assert.rejects(
        sql.begin(async (transaction) => {
          await scenario.mutate(transaction);
          await fixtureTerminal.transitionRunToTerminalInTransaction(transaction, {
            runId: tamperFixture.runInput.run.id,
            status: "failed",
            diagnostic: `task3 ${scenario.label}`,
            drainedTerminationRequestId: tamperFixture.terminationRequestId,
          });
          throw new Error(`TEST_ACCEPTED_${scenario.label.toUpperCase().replaceAll(" ", "_")}`);
        }),
        scenario.expected,
        scenario.label,
      );
      assert.deepEqual(
        await exactStoredInventory(tamperFixture.runInput.run.id),
        beforeTamper,
        scenario.label,
      );
    } finally {
      await cleanup();
    }
  }
  await sql`UPDATE runs SET status='completed' WHERE id=${tamperFixture.runInput.run.id}`;

  const closeRollbackFixture = await seedPopulatedTask3TerminalRun(
    "run-persistence-task3-close-rollback",
    1893,
  );
  const closeRollbackInput = closeRollbackFixture.runInput;
  const beforeCloseRollback = await exactStoredInventory(closeRollbackInput.run.id);
  await sql.unsafe(`CREATE FUNCTION ip_task3_reject_owner_close_v1() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      IF OLD.owner_key='run-persistence-task3-close-rollback'
         AND OLD.state='bound' AND NEW.state='closed' THEN
        RAISE EXCEPTION 'TEST_TASK3_OWNER_CLOSE_REJECTED';
      END IF;
      RETURN NEW;
    END $$`);
  await sql.unsafe(`CREATE TRIGGER ip_task3_reject_owner_close_v1
    BEFORE UPDATE ON internal_production_owner_reservations_v1
    FOR EACH ROW EXECUTE FUNCTION ip_task3_reject_owner_close_v1()`);
  try {
    await assert.rejects(
      sql.begin((transaction) => fixtureTerminal.transitionRunToTerminalInTransaction(
        transaction,
        {
          runId: closeRollbackInput.run.id,
          status: "failed",
          diagnostic: "task3 close must roll back terminal update",
          drainedTerminationRequestId: closeRollbackFixture.terminationRequestId,
        },
      )),
      /TEST_TASK3_OWNER_CLOSE_REJECTED/,
    );
    assert.deepEqual(await exactStoredInventory(closeRollbackInput.run.id), beforeCloseRollback);
  } finally {
    await sql.unsafe("DROP TRIGGER ip_task3_reject_owner_close_v1 ON internal_production_owner_reservations_v1");
    await sql.unsafe("DROP FUNCTION ip_task3_reject_owner_close_v1()");
  }
  await sql`UPDATE runs SET status='completed' WHERE id=${closeRollbackInput.run.id}`;

  const canaryStoreRoot = mkdtempSync(path.join(tmpdir(), "setfarm-task2-canary-store-"));
  t.after(() => rmSync(canaryStoreRoot, { recursive: true, force: true }));
  const fixtureReport = await import(`${pathToFileURL(path.join(root, "src/evals/report.ts")).href}?task2canary=${Date.now()}`);
  const fixtureV3 = await import(`${pathToFileURL(path.join(root, "src/execution/v3-release-admission-repository.ts")).href}?task2canary=${Date.now()}`);
  const fixtureProtocol = await import(`${pathToFileURL(path.join(root, "src/execution/run-protocol.ts")).href}?task2canary=${Date.now()}`);
  const canaryRepository = fixtureV3.createV3ReleaseAdmissionRepository(
    sql,
    new fixtureReport.ContentAddressedEvalResultStore(canaryStoreRoot),
  );
  const canaryTask = "persist one owner-bound release canary";
  const canaryCreated = await canaryRepository.createCanary({
    releaseSha: "a".repeat(40),
    suiteHash: "b".repeat(64),
    preflightHash: "c".repeat(64),
    ttlMs: 60 * 60 * 1_000,
    slots: [1, 2].map((repetition) => ({
      caseHash: hashCanonicalJson({ case: "task2-owner-canary", repetition }),
      taskHash: hashCanonicalJson(canaryTask),
      repetition,
      slotToken: `task2-owner-canary-${repetition}-${"x".repeat(48)}`,
    })),
  });
  const canaryProtocolFor = async (index: number) => fixtureProtocol.resolveNewRunProtocol({
    requestedMode: "v3",
    compilerReleaseSha: "a".repeat(40),
    env: { SETFARM_V3_ACTIVATION: "enabled" },
    activationPreflight: { status: "pass", hash: "c".repeat(64), stored: true },
    releaseAdmission: await canaryRepository.verifyCanarySelection({
      releaseSha: "a".repeat(40),
      taskHash: hashCanonicalJson(canaryTask),
      context: canaryCreated.contexts[index]!,
    }),
  });
  const canaryInput = {
    ...input,
    run: {
      ...input.run,
      id: "run-persistence-task2-owner-canary",
      runNumber: 1808,
      task: canaryTask,
      protocol: await canaryProtocolFor(0),
    },
    steps: input.steps.map((step, index) => ({ ...step, id: `run-persistence-task2-owner-canary-step-${index}` })),
  };
  const canaryFirst = await persistence.persistWorkflowRun(canaryInput);
  assert.deepEqual(await persistence.persistWorkflowRun(canaryInput), canaryFirst);
  const crossedCanaryInput = {
    ...canaryInput,
    run: { ...canaryInput.run, protocol: await canaryProtocolFor(1) },
  };
  const beforeCrossedCanary = await exactStoredInventory(canaryInput.run.id);
  await assert.rejects(
    persistence.persistWorkflowRun(crossedCanaryInput),
    /^Error: RUN_CANARY_ADMISSION_SLOT_UNAVAILABLE$/,
  );
  assert.deepEqual(await exactStoredInventory(canaryInput.run.id), beforeCrossedCanary);
  await sql`UPDATE runs SET status='completed' WHERE id=${canaryInput.run.id}`;

  const completedInput = {
    ...input,
    run: { ...input.run, id: "run-persistence-task3-completed", runNumber: 1820 },
    steps: input.steps.map((step, index) => ({ ...step, id: `run-persistence-task3-completed-step-${index}` })),
  };
  await persistence.persistWorkflowRun(completedInput);
  await sql`UPDATE steps SET status='completed' WHERE run_id=${completedInput.run.id}`;
  await sql.begin((transaction) => fixtureTerminal.transitionRunToTerminalInTransaction(
    transaction,
    { runId: completedInput.run.id, status: "completed", diagnostic: "task3 completed close" },
  ));
  assert.deepEqual(
    { ...(await sql<Array<{ run_status: string; owner_state: string }>>`
      SELECT run.status AS run_status,reservation.state AS owner_state
        FROM runs run JOIN internal_production_owner_reservations_v1 reservation
          ON reservation.owner_key=run.id AND reservation.category='run'
       WHERE run.id=${completedInput.run.id}
    `)[0]! },
    { run_status: "completed", owner_state: "closed" },
  );

  const cancelledInput = {
    ...input,
    run: { ...input.run, id: "run-persistence-task3-cancelled", runNumber: 1821 },
    steps: input.steps.map((step, index) => ({ ...step, id: `run-persistence-task3-cancelled-step-${index}` })),
  };
  await persistence.persistWorkflowRun(cancelledInput);
  const cancelledRequestId = "RTR_task3-cancelled-v1";
  assertCanonicalTerminationRequestId(cancelledRequestId);
  const requestedCancellation = await fixtureRunTermination.requestRunTermination(sql, {
    runId: cancelledInput.run.id,
    targetStatus: "cancelled",
    requestedBy: "task3-test",
    diagnostic: "task3 cancelled close",
    requestId: cancelledRequestId,
  });
  assert.equal(requestedCancellation.status, "requested");
  const cancellations = fixtureRunTermination.createRunTerminationRepository(sql);
  const cancellationOwnerInstanceId = "task3-cancelled-termination-owner";
  const claimedCancellation = await cancellations.claim({
    requestId: cancelledRequestId,
    ownerInstanceId: cancellationOwnerInstanceId,
  });
  assert.equal(claimedCancellation?.state, "draining");
  assert.equal((await cancellations.markDrained({
    requestId: cancelledRequestId,
    ownerInstanceId: cancellationOwnerInstanceId,
    evidence: { proofRef: "setfarm://tests/task3/cancelled-drain" },
  })).state, "drained");
  assert.deepEqual(
    [...await sql`
      SELECT run.status AS run_status,request.state AS request_state,
             termination_owner.state AS termination_owner_state
        FROM runs run
        JOIN run_termination_requests request ON request.run_id=run.id
        JOIN internal_production_owner_reservations_v1 termination_owner
          ON termination_owner.category='termination'
         AND termination_owner.owner_key=request.request_id
       WHERE run.id=${cancelledInput.run.id}
    `],
    [{
      run_status: "cancelling",
      request_state: "drained",
      termination_owner_state: "bound",
    }],
  );
  await sql.begin(async (transaction) => {
    await fixtureTerminal.transitionRunToTerminalInTransaction(transaction, {
      runId: cancelledInput.run.id,
      status: "cancelled",
      diagnostic: "task3 cancelled close",
      drainedTerminationRequestId: cancelledRequestId,
    });
  });
  assert.deepEqual(
    { ...(await sql<Array<{
      run_status: string;
      owner_state: string;
      request_state: string;
      termination_owner_state: string;
    }>>`
      SELECT run.status AS run_status,reservation.state AS owner_state,request.state AS request_state,
             termination_owner.state AS termination_owner_state
        FROM runs run JOIN internal_production_owner_reservations_v1 reservation
          ON reservation.owner_key=run.id AND reservation.category='run'
        JOIN run_termination_requests request ON request.run_id=run.id
        JOIN internal_production_owner_reservations_v1 termination_owner
          ON termination_owner.category='termination'
         AND termination_owner.owner_key=request.request_id
       WHERE run.id=${cancelledInput.run.id}
    `)[0]! },
    {
      run_status: "cancelled",
      owner_state: "closed",
      request_state: "terminalized",
      termination_owner_state: "closed",
    },
  );

  const tamperedTerminalInput = {
    ...input,
    run: { ...input.run, id: "run-persistence-task3-tampered-terminal", runNumber: 1822 },
    steps: input.steps.map((step, index) => ({ ...step, id: `run-persistence-task3-tampered-terminal-step-${index}` })),
  };
  await persistence.persistWorkflowRun(tamperedTerminalInput);
  const beforeTamperedTerminal = await exactStoredInventory(tamperedTerminalInput.run.id);
  await assert.rejects(
    sql.begin(async (transaction) => {
      const changed = await transaction.unsafe<Array<{ reservation_ref: string }>>(
        `UPDATE internal_production_owner_reservations_v1
            SET binding_payload=jsonb_set(binding_payload,'{canonicalOwnerIdentity,ownerHash}',to_jsonb(repeat('7',64)))
          WHERE owner_key=$1
        RETURNING reservation_ref`,
        [tamperedTerminalInput.run.id],
      );
      assert.equal(changed.length, 1);
      await fixtureTerminal.transitionRunToTerminalInTransaction(transaction, {
        runId: tamperedTerminalInput.run.id,
        status: "failed",
        diagnostic: "task3 tampered terminal pair",
        unclaimedBootstrapFailure: true,
      });
      throw new Error("TEST_ACCEPTED_TAMPERED_TERMINAL_PAIR");
    }),
    /^Error: INTERNAL_PRODUCTION_WORKFLOW_RUN_OWNER_CORRUPTION$/,
  );
  assert.deepEqual(await exactStoredInventory(tamperedTerminalInput.run.id), beforeTamperedTerminal);
  await sql`UPDATE runs SET status='completed' WHERE id=${tamperedTerminalInput.run.id}`;

  const publisherInput = (id: string, runNumber: number, mode: "legacy" | "shadow") => ({
    ...input,
    run: {
      ...input.run,
      id,
      runNumber,
      task: `deterministic ${mode} publisher`,
      protocol: mode === "legacy" ? input.run.protocol : {
        mode: "shadow" as const,
        version: 1 as const,
        compilerReleaseSha: "a".repeat(40),
        activationPreflightHash: "b".repeat(64),
        releaseAdmissionHash: null,
        releaseAdmissionKind: null,
        canaryAdmission: null,
      },
    },
    steps: input.steps.map((step, index) => ({ ...step, id: `${id}-step-${index}` })),
  });
  for (const [round, winnerMode, loserMode] of [
    [0, "legacy", "shadow"],
    [1, "shadow", "legacy"],
  ] as const) {
    const winnerInput = publisherInput(`run-persistence-task2-race-${round}-winner`, 1810 + round * 2, winnerMode);
    const loserInput = publisherInput(`run-persistence-task2-race-${round}-loser`, 1811 + round * 2, loserMode);
    const roundKey = 882100 + round;
    const functionName = `ip_task2_wait_publisher_${round}_v1`;
    await sql.unsafe(`CREATE FUNCTION ${functionName}() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        IF NEW.owner_key = '${winnerInput.run.id}' THEN
          PERFORM pg_advisory_xact_lock(${roundKey});
        END IF;
        RETURN NEW;
      END $$`);
    await sql.unsafe(`CREATE TRIGGER ${functionName}
      BEFORE INSERT ON internal_production_owner_reservations_v1
      FOR EACH ROW EXECUTE FUNCTION ${functionName}()`);
    let releaseRound!: () => void;
    let reportRoundHeld!: () => void;
    const roundHeld = new Promise<void>((resolve) => { reportRoundHeld = resolve; });
    const roundRelease = new Promise<void>((resolve) => { releaseRound = resolve; });
    const holder = sql.begin(async (transaction) => {
      await transaction.unsafe("SELECT pg_advisory_xact_lock($1)", [roundKey]);
      reportRoundHeld();
      await roundRelease;
    });
    await roundHeld;
    try {
      const winner = persistence.persistWorkflowRun(winnerInput).then(
        (value) => ({ status: "fulfilled" as const, value }),
        (reason) => ({ status: "rejected" as const, reason }),
      );
      let blocked: Array<{ pid: number }> = [];
      for (let attempt = 0; attempt < 100; attempt += 1) {
        blocked = await sql<Array<{ pid: number }>>`
          SELECT pid FROM pg_stat_activity
           WHERE datname=current_database()
             AND pid <> pg_backend_pid()
             AND wait_event_type='Lock'
             AND wait_event='advisory'
             AND query LIKE '%internal_production_owner_reservations_v1%'
        `;
        if (blocked.length === 1) break;
        await new Promise((resolve) => setTimeout(resolve, 25));
      }
      assert.equal(blocked.length, 1);
      let loserSettled = false;
      const loser = persistence.persistWorkflowRun(loserInput).then(
        (value) => ({ status: "fulfilled" as const, value }),
        (reason) => ({ status: "rejected" as const, reason }),
      ).finally(() => { loserSettled = true; });
      await new Promise((resolve) => setTimeout(resolve, 100));
      assert.equal(loserSettled, false);
      releaseRound();
      const [winnerResult, loserResult] = await Promise.all([winner, loser]);
      assert.equal(
        winnerResult.status,
        "fulfilled",
        String("reason" in winnerResult ? winnerResult.reason : ""),
      );
      assert.equal(loserResult.status, "rejected");
      assert.match(String("reason" in loserResult ? loserResult.reason : ""), /RUN_ACTIVATION_CONFLICT/);
      assert.deepEqual(await ownerInventory(winnerInput.run.id), {
        runs: "1", steps: "2", reservations: "1", bindings: "1",
      });
      assert.deepEqual(await ownerInventory(loserInput.run.id), emptyOwnerInventory);
      await sql`UPDATE runs SET status='completed' WHERE id=${winnerInput.run.id}`;
    } finally {
      releaseRound();
      await holder;
      await sql.unsafe(`DROP TRIGGER ${functionName} ON internal_production_owner_reservations_v1`);
      await sql.unsafe(`DROP FUNCTION ${functionName}()`);
    }
  }
});

test("real PostgreSQL owner admission begins adopts binds and rejects an unauthenticated terminal pair", async () => {
  if (process.env.SETFARM_PG_URL === undefined) return;
  assert.ok(activatedOwnerAdmissionFixture, "the prior real activation fixture must remain available");
  const { db, sql, root } = activatedOwnerAdmissionFixture;
  try {
  const ownerKey = "run-owner-p1-real-pg";
  const begin = () => sql.begin((transaction) => db.beginOrAdoptInternalProductionOwnerReservationV1(
    transaction,
    { producerImplementationId: "a-runtime-run-v1", ownerKey },
  ));
  const [first, concurrent] = await Promise.all([begin(), begin()]);
  assert.deepEqual(concurrent, first);
  assert.deepEqual(await begin(), first);
  const storedCreationVersion = (await sql<Array<{ head_version: string }>>`
    SELECT head_version::text FROM internal_production_owner_reservations_v1
     WHERE reservation_ref=${first.reservationRef}
  `)[0]!.head_version;
  await sql`UPDATE internal_production_owner_reservations_v1 SET head_version=head_version+7 WHERE reservation_ref=${first.reservationRef}`;
  await assert.rejects(begin(), /^Error: INTERNAL_PRODUCTION_OWNER_RESERVATION_CORRUPTION$/);
  await sql`UPDATE internal_production_owner_reservations_v1 SET head_version=${storedCreationVersion} WHERE reservation_ref=${first.reservationRef}`;
  assert.deepEqual(await db.resolveInternalProductionOwnerReservationV1({
    reservationRef: first.reservationRef,
    reservationHash: first.reservationHash,
  }), first);

  const identity: InternalProductionCanonicalOwnerIdentityV1<"run"> = {
    schema: "setfarm.internal-production-canonical-owner-identity.v1",
    category: "run",
    ownerKey,
    ownerRef: "setfarm://runs/run-owner-p1-real-pg",
    ownerHash: SHA_B,
  };
  const bind = () => sql.begin((transaction) => db.bindInternalProductionOwnerReservationV1(
    transaction,
    {
      reservationRef: first.reservationRef,
      reservationHash: first.reservationHash,
      canonicalOwnerIdentity: identity,
    },
  ));
  const bound = await bind();
  assert.deepEqual(await bind(), bound);
  const bindingRef = `setfarm://internal-production/bound-owner-reservations/${bound.bindingHash}`;
  const bindingHead = (await sql<Array<{ predecessor_head_hash: string }>>`
    SELECT predecessor_head_hash
      FROM internal_production_owner_admission_authorities_v1
     WHERE authority_ref=${bindingRef} AND authority_hash=${bound.bindingHash}
  `)[0]!.predecessor_head_hash;
  await sql.unsafe("ALTER TABLE internal_production_owner_admission_authorities_v1 DISABLE TRIGGER trg_internal_production_owner_admission_authority_immutable");
  try {
    await sql`UPDATE internal_production_owner_admission_authorities_v1 SET predecessor_head_hash=${SHA_C},successor_head_hash=${SHA_C} WHERE authority_ref=${bindingRef}`;
    await assert.rejects(begin(), /^Error: INTERNAL_PRODUCTION_OWNER_RESERVATION_CORRUPTION$/);
    await sql`UPDATE internal_production_owner_admission_authorities_v1 SET predecessor_head_hash=${bindingHead},successor_head_hash=${bindingHead} WHERE authority_ref=${bindingRef}`;
  } finally {
    await sql.unsafe("ALTER TABLE internal_production_owner_admission_authorities_v1 ENABLE TRIGGER trg_internal_production_owner_admission_authority_immutable");
  }
  await assert.rejects(
    sql.begin((transaction) => db.bindInternalProductionOwnerReservationV1(transaction, {
      reservationRef: first.reservationRef,
      reservationHash: first.reservationHash,
      canonicalOwnerIdentity: { ...identity, ownerHash: SHA_C },
    })),
    /OWNER_IDENTITY_CONFLICT/,
  );

  const stalePending = await sql.begin((transaction) => (
    db.beginOrAdoptInternalProductionOwnerReservationV1(transaction, {
      producerImplementationId: "a-runtime-run-v1",
      ownerKey: "run-owner-stale-pending-bind",
    })
  ));
  await sql.begin((transaction) => db.beginOrAdoptInternalProductionOwnerReservationV1(
    transaction,
    { producerImplementationId: "a-runtime-run-v1", ownerKey: "run-owner-intervening-head" },
  ));
  const staleIdentity: InternalProductionCanonicalOwnerIdentityV1<"run"> = {
    schema: "setfarm.internal-production-canonical-owner-identity.v1",
    category: "run",
    ownerKey: stalePending.ownerKey,
    ownerRef: "setfarm://runs/run-owner-stale-pending-bind",
    ownerHash: SHA_B,
  };
  await assert.rejects(
    sql.begin((transaction) => db.bindInternalProductionOwnerReservationV1(transaction, {
      reservationRef: stalePending.reservationRef,
      reservationHash: stalePending.reservationHash,
      canonicalOwnerIdentity: staleIdentity,
    })),
    /^Error: INTERNAL_PRODUCTION_OWNER_ADMISSION_HEAD_CONFLICT$/,
  );
  assert.deepEqual([...(await sql<Array<{
    state: string;
    canonical_owner_identity: unknown | null;
    binding_hash: string | null;
    binding_payload: unknown | null;
    binding_authorities: string;
  }>>`
    SELECT reservation.state,reservation.canonical_owner_identity,reservation.binding_hash,
           reservation.binding_payload,COUNT(authority.authority_ref)::text AS binding_authorities
      FROM internal_production_owner_reservations_v1 reservation
      LEFT JOIN internal_production_owner_admission_authorities_v1 authority
        ON authority.phase_key=reservation.reservation_ref AND authority.authority_kind='binding'
     WHERE reservation.reservation_ref=${stalePending.reservationRef}
     GROUP BY reservation.reservation_ref
  `)], [{
    state: "pending",
    canonical_owner_identity: null,
    binding_hash: null,
    binding_payload: null,
    binding_authorities: "0",
  }]);

  const terminal = createInternalProductionTerminalOwnerAuthorityV1({
    canonicalOwnerIdentity: identity,
    terminalOwnerRef: "setfarm://runs/run-owner-p1-real-pg/terminal/completed",
    terminalOwnerHash: SHA_C,
  });
  const terminalPair = deriveInternalProductionTerminalOwnerAuthorityPairV1(terminal);
  const beforeUnavailable = await sql<Array<{ state: string; head_version: string }>>`
    SELECT reservation.state, head.head_version::text
      FROM internal_production_owner_reservations_v1 reservation
      CROSS JOIN internal_production_owner_admission_head_v1 head
     WHERE reservation.reservation_ref = ${first.reservationRef}
  `;
  await assert.rejects(
    sql.begin((transaction) => db.closeInternalProductionOwnerReservationV1(transaction, {
      reservationRef: first.reservationRef,
      reservationHash: first.reservationHash,
      ...terminalPair,
    })),
    /^Error: INTERNAL_PRODUCTION_TERMINAL_OWNER_AUTHORITY_UNAVAILABLE$/,
  );
  assert.deepEqual(await sql<Array<{ state: string; head_version: string }>>`
    SELECT reservation.state, head.head_version::text
      FROM internal_production_owner_reservations_v1 reservation
      CROSS JOIN internal_production_owner_admission_head_v1 head
     WHERE reservation.reservation_ref = ${first.reservationRef}
  `, beforeUnavailable);

  let rolledBackReservation: Awaited<ReturnType<typeof begin>> | undefined;
  await assert.rejects(
    sql.begin(async (transaction) => {
      rolledBackReservation = await db.beginOrAdoptInternalProductionOwnerReservationV1(
        transaction,
        { producerImplementationId: "a-runtime-run-v1", ownerKey: "run-owner-p1-rollback" },
      );
      throw new Error("ROLLBACK_AFTER_BEGIN");
    }),
    /ROLLBACK_AFTER_BEGIN/,
  );
  assert.ok(rolledBackReservation);
  await assert.rejects(
    db.resolveInternalProductionOwnerReservationV1({
      reservationRef: rolledBackReservation.reservationRef,
      reservationHash: rolledBackReservation.reservationHash,
    }),
    /^Error: INTERNAL_PRODUCTION_OWNER_RESERVATION_UNAVAILABLE$/,
  );

  await assert.rejects(
    sql.begin((transaction) => db.beginOrAdoptInternalProductionOwnerReservationV1(
      transaction,
      { producerImplementationId: "future-owner-v1", ownerKey: "future-owner" },
    )),
    /^Error: INTERNAL_PRODUCTION_OWNER_PRODUCER_IMPLEMENTATION_UNAVAILABLE$/,
  );

  const headBeforeTamper = (await sql<Array<{
    head_version: string;
    head_hash: string;
    migration_application_evidence_hash: string;
    head_payload: unknown;
  }>>`SELECT head_version::text,head_hash,migration_application_evidence_hash,head_payload FROM internal_production_owner_admission_head_v1 WHERE singleton=TRUE`)[0]!;
  const reservationCountBeforeTamper = (await sql<Array<{ count: string }>>`SELECT COUNT(*)::text AS count FROM internal_production_owner_reservations_v1`)[0]!.count;
  const headTampers = [
    { head_payload: sql.json({ schema: "setfarm.internal-production-owner-admission-head.v1", version: 99 }) },
    { migration_application_evidence_hash: SHA_C },
    { head_hash: SHA_C },
  ] as const;
  for (const [index, tamper] of headTampers.entries()) {
    if ("head_payload" in tamper) {
      await sql`UPDATE internal_production_owner_admission_head_v1 SET head_payload=${tamper.head_payload} WHERE singleton=TRUE`;
    } else if ("migration_application_evidence_hash" in tamper) {
      await sql`UPDATE internal_production_owner_admission_head_v1 SET migration_application_evidence_hash=${tamper.migration_application_evidence_hash} WHERE singleton=TRUE`;
    } else {
      await sql`UPDATE internal_production_owner_admission_head_v1 SET head_hash=${tamper.head_hash} WHERE singleton=TRUE`;
    }
    await assert.rejects(
      sql.begin((transaction) => db.beginOrAdoptInternalProductionOwnerReservationV1(
        transaction,
        { producerImplementationId: "a-runtime-run-v1", ownerKey: `head-tamper-${index}` },
      )),
      /^Error: INTERNAL_PRODUCTION_OWNER_ADMISSION_HEAD_CORRUPTION$/,
    );
    await sql`UPDATE internal_production_owner_admission_head_v1 SET head_version=${headBeforeTamper.head_version},head_hash=${headBeforeTamper.head_hash},migration_application_evidence_hash=${headBeforeTamper.migration_application_evidence_hash},head_payload=${sql.json(headBeforeTamper.head_payload as never)} WHERE singleton=TRUE`;
    assert.equal((await sql<Array<{ count: string }>>`SELECT COUNT(*)::text AS count FROM internal_production_owner_reservations_v1`)[0]!.count, reservationCountBeforeTamper);
  }
  const advancingAuthority = (await sql<Array<{ authority_ref: string; phase_key: string }>>`
    SELECT authority_ref,phase_key
      FROM internal_production_owner_admission_authorities_v1
     WHERE successor_head_hash=${headBeforeTamper.head_hash}
       AND predecessor_head_hash<>successor_head_hash
  `)[0]!;
  await sql.unsafe("ALTER TABLE internal_production_owner_admission_authorities_v1 DISABLE TRIGGER trg_internal_production_owner_admission_authority_immutable");
  try {
    await sql`UPDATE internal_production_owner_admission_authorities_v1 SET phase_key='setfarm://tests/crossed-phase' WHERE authority_ref=${advancingAuthority.authority_ref}`;
    await assert.rejects(
      sql.begin((transaction) => db.beginOrAdoptInternalProductionOwnerReservationV1(
        transaction,
        { producerImplementationId: "a-runtime-run-v1", ownerKey: "head-crossed-phase" },
      )),
      /^Error: INTERNAL_PRODUCTION_OWNER_ADMISSION_HEAD_CORRUPTION$/,
    );
    assert.equal((await sql<Array<{ count: string }>>`SELECT COUNT(*)::text AS count FROM internal_production_owner_reservations_v1`)[0]!.count, reservationCountBeforeTamper);
    await sql`UPDATE internal_production_owner_admission_authorities_v1 SET phase_key=${advancingAuthority.phase_key} WHERE authority_ref=${advancingAuthority.authority_ref}`;
  } finally {
    await sql.unsafe("ALTER TABLE internal_production_owner_admission_authorities_v1 ENABLE TRIGGER trg_internal_production_owner_admission_authority_immutable");
  }

  const missingBindingReservation = await sql.begin((transaction) => (
    db.beginOrAdoptInternalProductionOwnerReservationV1(transaction, {
      producerImplementationId: "a-runtime-run-v1",
      ownerKey: "run-owner-missing-binding-authority",
    })
  ));
  const missingBindingIdentity: InternalProductionCanonicalOwnerIdentityV1<"run"> = {
    schema: "setfarm.internal-production-canonical-owner-identity.v1",
    category: "run",
    ownerKey: missingBindingReservation.ownerKey,
    ownerRef: "setfarm://runs/run-owner-missing-binding-authority",
    ownerHash: SHA_B,
  };
  const missingBindingBody = createInternalProductionBoundOwnerReservationV1({
    reservation: missingBindingReservation,
    canonicalOwnerIdentity: missingBindingIdentity,
  });
  await sql`UPDATE internal_production_owner_reservations_v1 SET state='bound',canonical_owner_identity=${sql.json(missingBindingIdentity)},binding_hash=${missingBindingBody.bindingHash},binding_payload=${sql.json(missingBindingBody)} WHERE reservation_ref=${missingBindingReservation.reservationRef}`;
  await assert.rejects(
    sql.begin((transaction) => db.beginOrAdoptInternalProductionOwnerReservationV1(transaction, {
      producerImplementationId: missingBindingReservation.producerImplementationId,
      ownerKey: missingBindingReservation.ownerKey,
    })),
    /^Error: INTERNAL_PRODUCTION_OWNER_RESERVATION_CORRUPTION$/,
  );
  await assert.rejects(
    sql.begin((transaction) => db.bindInternalProductionOwnerReservationV1(transaction, {
      reservationRef: missingBindingReservation.reservationRef,
      reservationHash: missingBindingReservation.reservationHash,
      canonicalOwnerIdentity: missingBindingIdentity,
    })),
    /^Error: INTERNAL_PRODUCTION_OWNER_RESERVATION_CORRUPTION$/,
  );
  } catch (error) {
    await db.pgClose();
    rmSync(path.dirname(root), { recursive: true, force: true });
    activatedOwnerAdmissionFixture = null;
    throw error;
  }
});

test("real PostgreSQL workflow run owner pairs resolve only from authenticated stored state", async () => {
  if (process.env.SETFARM_PG_URL === undefined) return;
  assert.ok(activatedOwnerAdmissionFixture, "the owner-admission fixture must remain available");
  const { db, sql } = activatedOwnerAdmissionFixture;
  const createBoundRun = async (runId: string, status: string) => sql.begin(async (transaction) => {
    const reservation = await db.beginOrAdoptInternalProductionOwnerReservationV1(transaction, {
      producerImplementationId: "a-runtime-run-v1",
      ownerKey: runId,
    });
    await transaction`
      INSERT INTO runs (id,workflow_id,task,status)
      VALUES (${runId},'workflow-run-owner-task1','terminal fixture',${status})
    `;
    return db.bindInternalProductionOwnerReservationV1(transaction, {
      reservationRef: reservation.reservationRef,
      reservationHash: reservation.reservationHash,
      canonicalOwnerIdentity: db.createInternalProductionWorkflowRunCanonicalOwnerIdentityV1(runId),
    });
  });
  const snapshot = async () => (await sql<Array<{ reservations: string; head_version: string }>>`
    SELECT COUNT(reservation.reservation_ref)::text AS reservations,
           head.head_version::text AS head_version
      FROM internal_production_owner_reservations_v1 reservation
      CROSS JOIN internal_production_owner_admission_head_v1 head
     GROUP BY head.head_version
  `)[0]!;

  let completed: Awaited<ReturnType<typeof createBoundRun>> | null = null;
  for (const status of ["completed", "failed", "cancelled"] as const) {
    const runId = `run-owner-task1-${status}`;
    const identity = db.createInternalProductionWorkflowRunCanonicalOwnerIdentityV1(runId);
    const bound = await createBoundRun(runId, status);
    if (status === "completed") completed = bound;
    assert.deepEqual(await db.resolveBoundInternalProductionWorkflowRunOwnerV1({
      runOwnerReservationRef: bound.reservationRef,
      runOwnerReservationHash: bound.reservationHash,
    }), bound);
    assert.deepEqual(await db.recoverBoundInternalProductionWorkflowRunOwnerV1({ runId }), bound);
    const terminalOwnerRef = `setfarm://runs/${encodeURIComponent(runId)}/terminal/${status}`;
    const terminalOwnerHash = hashCanonicalJson({
      schema: "setfarm.internal-production-workflow-run-terminal-owner.v1",
      runId,
      status,
    });
    const expectedTerminalPair = deriveInternalProductionTerminalOwnerAuthorityPairV1(
      createInternalProductionTerminalOwnerAuthorityV1({
        canonicalOwnerIdentity: identity,
        terminalOwnerRef,
        terminalOwnerHash,
      }),
    );
    assert.deepEqual(await sql.begin((transaction) => (
      db.resolveInternalProductionWorkflowRunTerminalAuthorityPairInTransactionV1(
        transaction,
        { runId },
      )
    )), {
      runOwnerReservationRef: bound.reservationRef,
      runOwnerReservationHash: bound.reservationHash,
      ...expectedTerminalPair,
    });
  }
  assert.ok(completed);

  const beforeWrongPair = await snapshot();
  await assert.rejects(
    db.resolveBoundInternalProductionWorkflowRunOwnerV1({
      runOwnerReservationRef: completed.reservationRef,
      runOwnerReservationHash: SHA_A,
    }),
    /^Error: INTERNAL_PRODUCTION_WORKFLOW_RUN_OWNER_UNAVAILABLE$/,
  );
  assert.deepEqual(await snapshot(), beforeWrongPair);

  const secondMatchingRef = `setfarm://internal-production/owner-reservations/${SHA_C}`;
  await assert.rejects(
    sql.begin(async (transaction) => {
      await transaction`
        INSERT INTO internal_production_owner_reservations_v1 (
          reservation_ref,reservation_hash,category,owner_key,owner_key_hash,
          producer_purpose_hash,producer_implementation_id,producer_implementation_hash,
          reservation_payload,reservation_head_predecessor_hash,state,
          canonical_owner_identity,binding_hash,binding_payload,head_version
        )
        SELECT ${secondMatchingRef},${SHA_C},category,owner_key,${SHA_B},
               producer_purpose_hash,producer_implementation_id,producer_implementation_hash,
               reservation_payload,reservation_head_predecessor_hash,state,
               canonical_owner_identity,binding_hash,binding_payload,head_version
          FROM internal_production_owner_reservations_v1
         WHERE reservation_ref=${completed.reservationRef}
      `;
      return db.resolveInternalProductionWorkflowRunTerminalAuthorityPairInTransactionV1(
        transaction,
        { runId: "run-owner-task1-completed" },
      );
    }),
    /^Error: INTERNAL_PRODUCTION_WORKFLOW_RUN_OWNER_UNAVAILABLE$/,
  );
  assert.deepEqual(await snapshot(), beforeWrongPair);

  const crossedImplementationReservation = await sql.begin((transaction) => (
    db.beginOrAdoptInternalProductionOwnerReservationV1(transaction, {
      producerImplementationId: "a-recovery-source-bootstrap-run-v1",
      ownerKey: "run-owner-task1-crossed-implementation",
    })
  ));
  const crossedImplementationBound = await sql.begin((transaction) => (
    db.bindInternalProductionOwnerReservationV1(transaction, {
      reservationRef: crossedImplementationReservation.reservationRef,
      reservationHash: crossedImplementationReservation.reservationHash,
      canonicalOwnerIdentity: db.createInternalProductionWorkflowRunCanonicalOwnerIdentityV1(
        crossedImplementationReservation.ownerKey,
      ),
    })
  ));
  await assert.rejects(
    db.resolveBoundInternalProductionWorkflowRunOwnerV1({
      runOwnerReservationRef: crossedImplementationBound.reservationRef,
      runOwnerReservationHash: crossedImplementationBound.reservationHash,
    }),
    /^Error: INTERNAL_PRODUCTION_WORKFLOW_RUN_OWNER_CORRUPTION$/,
  );

  const pendingRunId = "run-owner-task1-pending";
  await sql.begin((transaction) => db.beginOrAdoptInternalProductionOwnerReservationV1(transaction, {
    producerImplementationId: "a-runtime-run-v1",
    ownerKey: pendingRunId,
  }));
  const beforePending = await snapshot();
  await assert.rejects(
    db.recoverBoundInternalProductionWorkflowRunOwnerV1({ runId: pendingRunId }),
    /^Error: INTERNAL_PRODUCTION_WORKFLOW_RUN_OWNER_UNAVAILABLE$/,
  );
  assert.deepEqual(await snapshot(), beforePending);

  const nonterminalRunId = "run-owner-task1-running";
  await createBoundRun(nonterminalRunId, "running");
  const beforeNonterminal = await snapshot();
  await assert.rejects(
    sql.begin((transaction) => db.resolveInternalProductionWorkflowRunTerminalAuthorityPairInTransactionV1(
      transaction,
      { runId: nonterminalRunId },
    )),
    /^Error: INTERNAL_PRODUCTION_WORKFLOW_RUN_TERMINAL_STATUS_INVALID$/,
  );
  assert.deepEqual(await snapshot(), beforeNonterminal);

  const invalidStatusRunId = "run-owner-task1-invalid-status";
  const invalidStatusBound = await createBoundRun(invalidStatusRunId, "terminal-ish");
  const beforeInvalidStatus = await snapshot();
  await assert.rejects(
    sql.begin((transaction) => db.resolveInternalProductionWorkflowRunTerminalAuthorityPairInTransactionV1(
      transaction,
      { runId: invalidStatusRunId },
    )),
    /^Error: INTERNAL_PRODUCTION_WORKFLOW_RUN_TERMINAL_STATUS_INVALID$/,
  );
  assert.deepEqual(await snapshot(), beforeInvalidStatus);

  const crossedIdentity = {
    ...db.createInternalProductionWorkflowRunCanonicalOwnerIdentityV1(invalidStatusRunId),
    ownerKey: `${invalidStatusRunId}-crossed`,
  };
  await assert.rejects(
    sql.begin(async (transaction) => {
      await transaction`
        UPDATE internal_production_owner_reservations_v1
           SET canonical_owner_identity=${transaction.json(crossedIdentity)}
         WHERE reservation_ref=${invalidStatusBound.reservationRef}
      `;
      return db.resolveInternalProductionWorkflowRunTerminalAuthorityPairInTransactionV1(
        transaction,
        { runId: invalidStatusRunId },
      );
    }),
    /^Error: INTERNAL_PRODUCTION_WORKFLOW_RUN_OWNER_CORRUPTION$/,
  );
  assert.deepEqual(await snapshot(), beforeInvalidStatus);

  for (const [label, expected, mutate] of [
    ["category", /^Error: INTERNAL_PRODUCTION_WORKFLOW_RUN_OWNER_UNAVAILABLE$/, async (transaction: typeof sql) => {
      await transaction`UPDATE internal_production_owner_reservations_v1 SET category='claim' WHERE reservation_ref=${invalidStatusBound.reservationRef}`;
    }],
    ["owner key", /^Error: INTERNAL_PRODUCTION_WORKFLOW_RUN_OWNER_UNAVAILABLE$/, async (transaction: typeof sql) => {
      await transaction`UPDATE internal_production_owner_reservations_v1 SET owner_key=${`${invalidStatusRunId}-crossed`} WHERE reservation_ref=${invalidStatusBound.reservationRef}`;
    }],
    ["binding body", /^Error: INTERNAL_PRODUCTION_WORKFLOW_RUN_OWNER_CORRUPTION$/, async (transaction: typeof sql) => {
      await transaction`UPDATE internal_production_owner_reservations_v1 SET binding_payload=binding_payload || '{"extra":true}'::jsonb WHERE reservation_ref=${invalidStatusBound.reservationRef}`;
    }],
  ] as const) {
    await assert.rejects(
      sql.begin(async (transaction) => {
        await mutate(transaction as typeof sql);
        return db.resolveInternalProductionWorkflowRunTerminalAuthorityPairInTransactionV1(
          transaction,
          { runId: invalidStatusRunId },
        );
      }),
      expected,
      label,
    );
    assert.deepEqual(await snapshot(), beforeInvalidStatus, label);
  }

  const completedRunId = "run-owner-task1-completed";
  const completedPair = await sql.begin((transaction) => (
    db.resolveInternalProductionWorkflowRunTerminalAuthorityPairInTransactionV1(
      transaction,
      { runId: completedRunId },
    )
  ));
  await sql.begin((transaction) => db.closeInternalProductionOwnerReservationV1(transaction, {
    reservationRef: completedPair.runOwnerReservationRef,
    reservationHash: completedPair.runOwnerReservationHash,
    terminalAuthorityRef: completedPair.terminalAuthorityRef,
    terminalAuthorityHash: completedPair.terminalAuthorityHash,
  }));
  await assert.rejects(
    db.recoverBoundInternalProductionWorkflowRunOwnerV1({ runId: completedRunId }),
    /^Error: INTERNAL_PRODUCTION_WORKFLOW_RUN_OWNER_UNAVAILABLE$/,
  );
  await assert.rejects(
    db.resolveBoundInternalProductionWorkflowRunOwnerV1({
      runOwnerReservationRef: completedPair.runOwnerReservationRef,
      runOwnerReservationHash: completedPair.runOwnerReservationHash,
    }),
    /^Error: INTERNAL_PRODUCTION_WORKFLOW_RUN_OWNER_UNAVAILABLE$/,
  );
  assert.deepEqual(await sql.begin((transaction) => (
    db.resolveInternalProductionWorkflowRunTerminalAuthorityPairInTransactionV1(
      transaction,
      { runId: completedRunId },
    )
  )), completedPair);

  const encodedRunId = "run/owner-task1-encoded";
  const encodedBound = await createBoundRun(encodedRunId, "completed");
  const encodedOwnerHash = hashCanonicalJson({
    schema: "setfarm.internal-production-workflow-run-terminal-owner.v1",
    runId: encodedRunId,
    status: "completed",
  });
  for (const terminalOwnerRef of [
    `setfarm://runs/${encodedRunId}/terminal/completed`,
    `setfarm://runs/${encodeURIComponent(encodedRunId).replace("%2F", "%2f")}/terminal/completed`,
  ]) {
    const noncanonicalPair = deriveInternalProductionTerminalOwnerAuthorityPairV1(
      createInternalProductionTerminalOwnerAuthorityV1({
        canonicalOwnerIdentity: db.createInternalProductionWorkflowRunCanonicalOwnerIdentityV1(encodedRunId),
        terminalOwnerRef,
        terminalOwnerHash: encodedOwnerHash,
      }),
    );
    const beforeNoncanonical = await snapshot();
    await assert.rejects(
      sql.begin((transaction) => db.closeInternalProductionOwnerReservationV1(transaction, {
        reservationRef: encodedBound.reservationRef,
        reservationHash: encodedBound.reservationHash,
        ...noncanonicalPair,
      })),
      /^Error: INTERNAL_PRODUCTION_TERMINAL_OWNER_AUTHORITY_UNAVAILABLE$/,
    );
    assert.deepEqual(await snapshot(), beforeNoncanonical);
  }

  const rawTerminal = deriveInternalProductionTerminalOwnerAuthorityPairV1(
    createInternalProductionTerminalOwnerAuthorityV1({
      canonicalOwnerIdentity: db.createInternalProductionWorkflowRunCanonicalOwnerIdentityV1(completedRunId),
      terminalOwnerRef: `setfarm://runs/${completedRunId}/terminal/failed`,
      terminalOwnerHash: hashCanonicalJson({
        schema: "setfarm.internal-production-workflow-run-terminal-owner.v1",
        runId: completedRunId,
        status: "failed",
      }),
    }),
  );
  const beforeCrossedTerminal = await snapshot();
  await assert.rejects(
    sql.begin((transaction) => db.closeInternalProductionOwnerReservationV1(transaction, {
      reservationRef: invalidStatusBound.reservationRef,
      reservationHash: invalidStatusBound.reservationHash,
      ...rawTerminal,
    })),
    /^Error: INTERNAL_PRODUCTION_TERMINAL_OWNER_AUTHORITY_UNAVAILABLE$/,
  );
  assert.deepEqual(await snapshot(), beforeCrossedTerminal);
});

test("real PostgreSQL terminal pair replay locks only its exact run", { timeout: 15_000 }, async () => {
  if (process.env.SETFARM_PG_URL === undefined) return;
  assert.ok(activatedOwnerAdmissionFixture, "the owner-admission fixture must remain available");
  const { db, sql } = activatedOwnerAdmissionFixture;
  const boundByRun = new Map<string, Awaited<ReturnType<typeof db.bindInternalProductionOwnerReservationV1>>>();
  for (const runId of ["run-owner-task1-concurrent-a", "run-owner-task1-concurrent-b"]) {
    const bound = await sql.begin(async (transaction) => {
      const reservation = await db.beginOrAdoptInternalProductionOwnerReservationV1(transaction, {
        producerImplementationId: "a-runtime-run-v1",
        ownerKey: runId,
      });
      await transaction`
        INSERT INTO runs (id,workflow_id,task,status)
        VALUES (${runId},'workflow-run-owner-task1','concurrent terminal fixture','running')
      `;
      return db.bindInternalProductionOwnerReservationV1(transaction, {
        reservationRef: reservation.reservationRef,
        reservationHash: reservation.reservationHash,
        canonicalOwnerIdentity: db.createInternalProductionWorkflowRunCanonicalOwnerIdentityV1(runId),
      });
    });
    boundByRun.set(runId, bound);
  }

  let arrivals = 0;
  let release!: () => void;
  const bothRunRowsLocked = new Promise<void>((resolve) => { release = resolve; });
  const transactionAttempts = new Map<string, number>();
  const replay = (runId: string) => sql.begin(async (transaction) => {
    transactionAttempts.set(runId, (transactionAttempts.get(runId) ?? 0) + 1);
    await transaction`UPDATE runs SET status='completed' WHERE id=${runId}`;
    arrivals += 1;
    if (arrivals === 2) release();
    await bothRunRowsLocked;
    return db.resolveInternalProductionWorkflowRunTerminalAuthorityPairInTransactionV1(
      transaction,
      { runId },
    );
  });
  const runIds = ["run-owner-task1-concurrent-a", "run-owner-task1-concurrent-b"] as const;
  const results = await Promise.allSettled(runIds.map(replay));
  assert.deepEqual(
    runIds.map((runId) => [runId, transactionAttempts.get(runId)]),
    runIds.map((runId) => [runId, 1]),
  );
  for (const [index, result] of results.entries()) {
    assert.equal(result.status, "fulfilled", result.status === "rejected" ? String(result.reason) : undefined);
    if (result.status !== "fulfilled") continue;
    const runId = runIds[index]!;
    const bound = boundByRun.get(runId)!;
    const expectedPair = deriveInternalProductionTerminalOwnerAuthorityPairV1(
      createInternalProductionTerminalOwnerAuthorityV1({
        canonicalOwnerIdentity: db.createInternalProductionWorkflowRunCanonicalOwnerIdentityV1(runId),
        terminalOwnerRef: `setfarm://runs/${encodeURIComponent(runId)}/terminal/completed`,
        terminalOwnerHash: hashCanonicalJson({
          schema: "setfarm.internal-production-workflow-run-terminal-owner.v1",
          runId,
          status: "completed",
        }),
      }),
    );
    assert.deepEqual(result.value, {
      runOwnerReservationRef: bound.reservationRef,
      runOwnerReservationHash: bound.reservationHash,
      ...expectedPair,
    });
  }

  let lockedUnrelated!: () => void;
  const unrelatedLocked = new Promise<void>((resolve) => { lockedUnrelated = resolve; });
  let releaseUnrelated!: () => void;
  const holdUnrelated = new Promise<void>((resolve) => { releaseUnrelated = resolve; });
  const unrelatedRunId = runIds[1];
  const unrelatedBlocker = sql.begin(async (transaction) => {
    await transaction`UPDATE runs SET status=status WHERE id=${unrelatedRunId}`;
    lockedUnrelated();
    await holdUnrelated;
  });
  await unrelatedLocked;
  let exactReplay: Awaited<ReturnType<typeof db.resolveInternalProductionWorkflowRunTerminalAuthorityPairInTransactionV1>>;
  try {
    exactReplay = await sql.begin(async (transaction) => {
      await transaction`SET LOCAL lock_timeout='250ms'`;
      return db.resolveInternalProductionWorkflowRunTerminalAuthorityPairInTransactionV1(
        transaction,
        { runId: runIds[0] },
      );
    });
  } finally {
    releaseUnrelated();
    await unrelatedBlocker;
  }
  assert.deepEqual(exactReplay, results[0]!.status === "fulfilled" ? results[0]!.value : null);
});

test("real PostgreSQL closed workflow run rejects terminal status drift without mutation", async () => {
  if (process.env.SETFARM_PG_URL === undefined) return;
  assert.ok(activatedOwnerAdmissionFixture, "the owner-admission fixture must remain available");
  const { db, sql } = activatedOwnerAdmissionFixture;
  const runId = "run-owner-task1-completed";
  const before = (await sql<Array<{
    status: string;
    state: string;
    terminal_owner_ref: string;
    terminal_owner_hash: string;
    close_ref: string;
    close_hash: string;
    head_version: string;
  }>>`
    SELECT run.status,reservation.state,reservation.terminal_owner_ref,
           reservation.terminal_owner_hash,reservation.close_ref,reservation.close_hash,
           head.head_version::text
      FROM runs run
      JOIN internal_production_owner_reservations_v1 reservation
        ON reservation.owner_key=run.id
      CROSS JOIN internal_production_owner_admission_head_v1 head
     WHERE run.id=${runId}
       AND reservation.producer_implementation_id='a-runtime-run-v1'
       AND reservation.category='run'
  `)[0]!;
  await assert.rejects(
    sql.begin(async (transaction) => {
      await transaction`UPDATE runs SET status='failed' WHERE id=${runId}`;
      await db.resolveInternalProductionWorkflowRunTerminalAuthorityPairInTransactionV1(
        transaction,
        { runId },
      );
      throw new Error("TEST_ACCEPTED_CLOSED_WORKFLOW_RUN_TERMINAL_DRIFT");
    }),
    /^Error: INTERNAL_PRODUCTION_WORKFLOW_RUN_OWNER_CORRUPTION$/,
  );
  assert.deepEqual((await sql<typeof before[]>`
    SELECT run.status,reservation.state,reservation.terminal_owner_ref,
           reservation.terminal_owner_hash,reservation.close_ref,reservation.close_hash,
           head.head_version::text
      FROM runs run
      JOIN internal_production_owner_reservations_v1 reservation
        ON reservation.owner_key=run.id
      CROSS JOIN internal_production_owner_admission_head_v1 head
     WHERE run.id=${runId}
       AND reservation.producer_implementation_id='a-runtime-run-v1'
       AND reservation.category='run'
  `)[0], before);
  await assert.rejects(
    sql.begin(async (transaction) => {
      await transaction`UPDATE runs SET status='failed' WHERE id=${runId}`;
      await db.resolveInternalProductionOwnerReservationCloseInTransactionV1(transaction, {
        closeRef: before.close_ref,
        closeHash: before.close_hash,
      });
      throw new Error("TEST_ACCEPTED_CLOSED_WORKFLOW_RUN_TERMINAL_OWNER_DRIFT");
    }),
    /^Error: INTERNAL_PRODUCTION_WORKFLOW_RUN_OWNER_CORRUPTION$/,
  );
  assert.deepEqual((await sql<typeof before[]>`
    SELECT run.status,reservation.state,reservation.terminal_owner_ref,
           reservation.terminal_owner_hash,reservation.close_ref,reservation.close_hash,
           head.head_version::text
      FROM runs run
      JOIN internal_production_owner_reservations_v1 reservation
        ON reservation.owner_key=run.id
      CROSS JOIN internal_production_owner_admission_head_v1 head
     WHERE run.id=${runId}
       AND reservation.producer_implementation_id='a-runtime-run-v1'
       AND reservation.category='run'
  `)[0], before);
});

test("real PostgreSQL persisted pre-P3 above-cap claim terminal authority fails closed", async () => {
  if (process.env.SETFARM_PG_URL === undefined) return;
  assert.ok(activatedOwnerAdmissionFixture, "the owner-admission fixture must remain available");
  const { db, sql } = activatedOwnerAdmissionFixture;
  for (const [index, claimIdText] of ["9007199254740992", "9223372036854775807"].entries()) {
    const persistedIdentity = validateInternalProductionCanonicalOwnerIdentityV1<"claim">({
      schema: "setfarm.internal-production-canonical-owner-identity.v1",
      category: "claim",
      ownerKey: claimIdText,
      ownerRef: `setfarm://claim-log/${claimIdText}`,
      ownerHash: hashCanonicalJson({
        schema: "setfarm.internal-production-claim-owner.v1",
        claimId: claimIdText,
      }),
    });
    await sql.begin(async (transaction) => {
      const reservation = await db.beginOrAdoptInternalProductionOwnerReservationV1(transaction, {
        producerImplementationId: "a-claim-single-runtime-v1",
        ownerKey: claimIdText,
      });
      await transaction`
        INSERT INTO claim_log (
          id,run_id,step_id,story_id,agent_id,claimed_at,outcome,duration_ms,diagnostic
        ) VALUES (
          ${claimIdText}::bigint,${`task2r-safe-cap-run-${index}`},${`task2r-safe-cap-step-${index}`},'',
          'task2r-safe-cap-agent',NOW(),'completed',1,'pre-P3 persisted above-cap claim'
        )
      `;
      await db.bindInternalProductionOwnerReservationV1(transaction, {
        reservationRef: reservation.reservationRef,
        reservationHash: reservation.reservationHash,
        canonicalOwnerIdentity: persistedIdentity,
      });
    });
    await assert.rejects(
      sql.begin((transaction) => db.resolveInternalProductionClaimTerminalAuthorityPairInTransactionV1(
        transaction,
        Object.freeze({ claimIdText }),
      )),
      (error: unknown) => error instanceof Error
        && error.message === "INTERNAL_PRODUCTION_CLAIM_ID_INVALID",
    );
  }
});

test("real PostgreSQL claim terminal port locks authenticates and returns only the exact close input", async () => {
  if (process.env.SETFARM_PG_URL === undefined) return;
  assert.ok(activatedOwnerAdmissionFixture, "the owner-admission fixture must remain available");
  const { db, sql } = activatedOwnerAdmissionFixture;
  const terminalPortNames = [
    "resolveInternalProductionClaimTerminalAuthorityPairInTransactionV1",
    "resolveInternalProductionExecutionAttemptTerminalAuthorityPairInTransactionV1",
    "resolveInternalProductionRuntimeSessionTerminalAuthorityPairInTransactionV1",
    "resolveInternalProductionCompletionOwnerTerminalAuthorityPairInTransactionV1",
    "resolveInternalProductionMandatoryEffectTerminalAuthorityPairInTransactionV1",
    "resolveInternalProductionTerminationTerminalAuthorityPairInTransactionV1",
    "resolveInternalProductionFindingTerminalAuthorityPairInTransactionV1",
    "resolveInternalProductionOperationalDeliveryTerminalAuthorityPairInTransactionV1",
  ] as const;
  for (const name of terminalPortNames) {
    assert.equal(typeof db[name], "function", `${name} must be exported`);
    assert.equal(db[name].length, 2, `${name} must retain exact arity two`);
  }
  for (const forbidden of [
    "createInternalProductionTerminalOwnerAuthorityFromRowsV1",
    "createInternalProductionTerminalAuthorityResolverV1",
    "OWNER_TERMINAL_AUTHORITY_RESOLVERS_V1",
    "resolveInternalProductionTerminalAuthorityPairInTransactionV1",
    "scanInternalProductionOwnerSidecarsV1",
  ]) assert.equal(forbidden in db, false, `${forbidden} must remain private`);

  const statuses = [
    "completed", "infra_retry", "failed", "skipped", "abandoned", "cancelled",
  ] as const;
  const implementationIds = [
    "a-claim-single-runtime-v1",
    "a-claim-loop-runtime-v1",
    "a-claim-v3-downstream-evidence-v1",
    "a-claim-v3-evidence-only-v1",
  ] as const;
  const outputs: InternalProductionResolvedOwnerTerminalCloseInputV1[] = [];
  for (const [index, status] of statuses.entries()) {
    const claimIdText = String(9_100_000 + index);
    const implementationId = implementationIds[index % implementationIds.length]!;
    const bound = await sql.begin(async (transaction) => {
      const reservation = await db.beginOrAdoptInternalProductionOwnerReservationV1(transaction, {
        producerImplementationId: implementationId,
        ownerKey: claimIdText,
      });
      await transaction`
        INSERT INTO claim_log (
          id,run_id,step_id,story_id,agent_id,claimed_at,outcome,abandoned_at,
          duration_ms,diagnostic
        ) VALUES (
          ${claimIdText}::bigint,${`task2-claim-run-${index}`},${`task2-claim-step-${index}`},
          ${`task2-claim-story-${index}`},'task2-claim-agent',NOW(),${status},
          ${status === "abandoned" ? new Date() : null},1,'task2 terminal fixture'
        )
      `;
      return db.bindInternalProductionOwnerReservationV1(transaction, {
        reservationRef: reservation.reservationRef,
        reservationHash: reservation.reservationHash,
        canonicalOwnerIdentity: createInternalProductionClaimCanonicalOwnerIdentityV1(
          Object.freeze({ claimIdText }),
        ),
      });
    });
    const expectedTerminal = createInternalProductionTerminalOwnerAuthorityV1({
      canonicalOwnerIdentity: createInternalProductionClaimCanonicalOwnerIdentityV1(
        Object.freeze({ claimIdText }),
      ),
      terminalOwnerRef: `${bound.canonicalOwnerIdentity.ownerRef}/terminal/${status}`,
      terminalOwnerHash: hashCanonicalJson({
        schema: "setfarm.internal-production-claim-terminal-owner.v1",
        claimId: claimIdText,
        status,
      }),
    });
    const expectedPair = deriveInternalProductionTerminalOwnerAuthorityPairV1(expectedTerminal);
    const resolved = await sql.begin(async (transaction) => {
      const issued = await db.resolveInternalProductionClaimTerminalAuthorityPairInTransactionV1(
        transaction,
        Object.freeze({ claimIdText }),
      );
      assert.deepEqual(Object.keys(issued), [
        "reservationRef", "reservationHash", "terminalAuthorityRef", "terminalAuthorityHash",
      ]);
      assert.deepEqual(issued, {
        reservationRef: bound.reservationRef,
        reservationHash: bound.reservationHash,
        terminalAuthorityRef: expectedPair.terminalAuthorityRef,
        terminalAuthorityHash: expectedPair.terminalAuthorityHash,
      });
      assertDeepFrozen(issued, `claim ${status} close input`);
      assert.throws(() => {
        (issued as { reservationRef: string }).reservationRef = "setfarm://mutated";
      }, TypeError);
      const close = await db.closeInternalProductionOwnerReservationV1(transaction, issued);
      assert.equal(close.terminalOwnerRef, expectedTerminal.terminalOwnerRef);
      assert.deepEqual(
        await db.resolveInternalProductionClaimTerminalAuthorityPairInTransactionV1(
          transaction,
          Object.freeze({ claimIdText }),
        ),
        issued,
      );
      return issued;
    });
    outputs.push(resolved);
  }
  assert.equal(new Set(outputs.map(({ reservationRef }) => reservationRef)).size, statuses.length);

  const bindAdditionalClaim = async (claimIdText: string) => sql.begin(async (transaction) => {
    const reservation = await db.beginOrAdoptInternalProductionOwnerReservationV1(transaction, {
      producerImplementationId: "a-claim-single-runtime-v1",
      ownerKey: claimIdText,
    });
    await transaction`
      INSERT INTO claim_log (
        id,run_id,step_id,story_id,agent_id,claimed_at,outcome,duration_ms,diagnostic
      ) VALUES (
        ${claimIdText}::bigint,'task2-issued-run','task2-issued-step','',
        'task2-issued-agent',NOW(),'completed',1,'task2 issued close fixture'
      )
    `;
    return db.bindInternalProductionOwnerReservationV1(transaction, {
      reservationRef: reservation.reservationRef,
      reservationHash: reservation.reservationHash,
      canonicalOwnerIdentity: createInternalProductionClaimCanonicalOwnerIdentityV1(
        Object.freeze({ claimIdText }),
      ),
    });
  });

  const issuedClaimIdText = "9180000";
  await bindAdditionalClaim(issuedClaimIdText);
  const issuedInPriorTransaction = await sql.begin((transaction) => (
    db.resolveInternalProductionClaimTerminalAuthorityPairInTransactionV1(
      transaction,
      Object.freeze({ claimIdText: issuedClaimIdText }),
    )
  ));
  await assert.rejects(
    sql.begin((transaction) => db.closeInternalProductionOwnerReservationV1(
      transaction,
      issuedInPriorTransaction,
    )),
    /CLOSE_INPUT_INVALID/,
  );
  await sql.begin(async (transaction) => {
    const issued = await db.resolveInternalProductionClaimTerminalAuthorityPairInTransactionV1(
      transaction,
      Object.freeze({ claimIdText: issuedClaimIdText }),
    );
    const reordered = Object.freeze({
      reservationHash: issued.reservationHash,
      reservationRef: issued.reservationRef,
      terminalAuthorityRef: issued.terminalAuthorityRef,
      terminalAuthorityHash: issued.terminalAuthorityHash,
    });
    const withExtra = Object.freeze({ ...issued, extra: true });
    const missing = Object.freeze({
      reservationRef: issued.reservationRef,
      reservationHash: issued.reservationHash,
      terminalAuthorityRef: issued.terminalAuthorityRef,
    });
    const symbol = Symbol("task2-close-input");
    const withSymbol = {
      reservationRef: issued.reservationRef,
      reservationHash: issued.reservationHash,
      terminalAuthorityRef: issued.terminalAuthorityRef,
      terminalAuthorityHash: issued.terminalAuthorityHash,
      [symbol]: true,
    };
    Object.freeze(withSymbol);
    let getterCalls = 0;
    const accessor = {};
    for (const key of Object.keys(issued) as Array<keyof typeof issued>) {
      Object.defineProperty(accessor, key, {
        enumerable: true,
        configurable: false,
        get() {
          getterCalls += 1;
          return issued[key];
        },
      });
    }
    Object.freeze(accessor);
    const mutable = { ...issued };
    const clone = Object.freeze({ ...issued });
    const crossedReservationRef = Object.freeze({
      ...issued,
      reservationRef: outputs[0]!.reservationRef,
    });
    const crossedReservationHash = Object.freeze({
      ...issued,
      reservationHash: outputs[0]!.reservationHash,
    });
    const crossedTerminalRef = Object.freeze({
      ...issued,
      terminalAuthorityRef: outputs[0]!.terminalAuthorityRef,
    });
    const crossedTerminalHash = Object.freeze({
      ...issued,
      terminalAuthorityHash: outputs[0]!.terminalAuthorityHash,
    });
    const crossedPair = Object.freeze({
      reservationRef: issued.reservationRef,
      reservationHash: issued.reservationHash,
      terminalAuthorityRef: outputs[0]!.terminalAuthorityRef,
      terminalAuthorityHash: outputs[0]!.terminalAuthorityHash,
    });
    for (const malformed of [
      clone, reordered, withExtra, missing, withSymbol, accessor, mutable,
      crossedReservationRef, crossedReservationHash, crossedTerminalRef,
      crossedTerminalHash, crossedPair,
    ]) {
      await assert.rejects(
        db.closeInternalProductionOwnerReservationV1(transaction, malformed as never),
        /CLOSE_INPUT_INVALID|OWNER_RESERVATION_UNAVAILABLE/,
      );
    }
    assert.equal(getterCalls, 0);
    await db.closeInternalProductionOwnerReservationV1(transaction, issued);
    assert.deepEqual(
      await db.resolveInternalProductionClaimTerminalAuthorityPairInTransactionV1(
        transaction,
        Object.freeze({ claimIdText: issuedClaimIdText }),
      ),
      issued,
    );
  });

  const exactCloseClaimIdText = "9180001";
  await bindAdditionalClaim(exactCloseClaimIdText);
  let unrelatedClaimLocked!: () => void;
  const unrelatedClaimIsLocked = new Promise<void>((resolve) => {
    unrelatedClaimLocked = resolve;
  });
  let releaseUnrelatedClaim!: () => void;
  const holdUnrelatedClaim = new Promise<void>((resolve) => {
    releaseUnrelatedClaim = resolve;
  });
  const unrelatedClaimBlocker = sql.begin(async (transaction) => {
    await transaction`SELECT id FROM claim_log WHERE id=9100000 FOR UPDATE`;
    unrelatedClaimLocked();
    await holdUnrelatedClaim;
  });
  await unrelatedClaimIsLocked;
  try {
    await sql.begin(async (transaction) => {
      await transaction`SET LOCAL lock_timeout='250ms'`;
      const issued = await db.resolveInternalProductionClaimTerminalAuthorityPairInTransactionV1(
        transaction,
        Object.freeze({ claimIdText: exactCloseClaimIdText }),
      );
      const close = await db.closeInternalProductionOwnerReservationV1(transaction, issued);
      assert.deepEqual(
        await db.resolveInternalProductionOwnerReservationCloseInTransactionV1(transaction, {
          closeRef: close.closeRef,
          closeHash: close.closeHash,
        }),
        close,
      );
    });
  } finally {
    releaseUnrelatedClaim();
    await unrelatedClaimBlocker;
  }

  const rollbackClaimIdText = "9180002";
  const rollbackBound = await bindAdditionalClaim(rollbackClaimIdText);
  const beforeRollback = (await sql<Array<{ head_version: string; state: string }>>`
    SELECT head.head_version::text,reservation.state
      FROM internal_production_owner_admission_head_v1 head
      JOIN internal_production_owner_reservations_v1 reservation
        ON reservation.reservation_ref=${rollbackBound.reservationRef}
     WHERE head.singleton=TRUE
  `)[0]!;
  await assert.rejects(
    sql.begin(async (transaction) => {
      const issued = await db.resolveInternalProductionClaimTerminalAuthorityPairInTransactionV1(
        transaction,
        Object.freeze({ claimIdText: rollbackClaimIdText }),
      );
      await assert.rejects(
        sql.begin(async (contender) => {
          await contender`SET LOCAL lock_timeout='250ms'`;
          await contender`UPDATE claim_log SET diagnostic=diagnostic
             WHERE id=${rollbackClaimIdText}::bigint`;
        }),
        /lock timeout/,
      );
      await db.closeInternalProductionOwnerReservationV1(transaction, issued);
      assert.deepEqual(
        await db.resolveInternalProductionClaimTerminalAuthorityPairInTransactionV1(
          transaction,
          Object.freeze({ claimIdText: rollbackClaimIdText }),
        ),
        issued,
      );
      throw new Error("TEST_ROLLBACK_ISSUED_CLOSE");
    }),
    /^Error: TEST_ROLLBACK_ISSUED_CLOSE$/,
  );
  assert.deepEqual((await sql<typeof beforeRollback[]>`
    SELECT head.head_version::text,reservation.state
      FROM internal_production_owner_admission_head_v1 head
      JOIN internal_production_owner_reservations_v1 reservation
        ON reservation.reservation_ref=${rollbackBound.reservationRef}
     WHERE head.singleton=TRUE
  `)[0], beforeRollback);

  const crossedClaimIdText = "9180003";
  const crossedBound = await bindAdditionalClaim(crossedClaimIdText);
  const crossedSnapshot = async () => (await sql<Array<{
    head_hash: string;
    head_payload: unknown;
    owner_key: string;
    outcome: string;
    state: string;
  }>>`
    SELECT head.head_hash,head.head_payload,reservation.owner_key,claim.outcome,reservation.state
      FROM internal_production_owner_admission_head_v1 head
      JOIN internal_production_owner_reservations_v1 reservation
        ON reservation.reservation_ref=${crossedBound.reservationRef}
      JOIN claim_log claim ON claim.id::text=${crossedClaimIdText}
     WHERE head.singleton=TRUE
  `)[0]!;
  const beforeCrossed = await crossedSnapshot();
  for (const [label, corrupt] of [
    ["status", async (transaction: Parameters<Parameters<typeof sql.begin>[0]>[0]) => {
      await transaction`UPDATE claim_log SET outcome='failed'
         WHERE id=${crossedClaimIdText}::bigint`;
    }],
    ["key", async (transaction: Parameters<Parameters<typeof sql.begin>[0]>[0]) => {
      await transaction`UPDATE internal_production_owner_reservations_v1
         SET owner_key='9180999' WHERE reservation_ref=${crossedBound.reservationRef}`;
    }],
    ["stale-head", async (transaction: Parameters<Parameters<typeof sql.begin>[0]>[0]) => {
      await transaction`UPDATE internal_production_owner_admission_head_v1
         SET head_payload=jsonb_set(head_payload,'{headVersion}','999999'::jsonb)
         WHERE singleton=TRUE`;
    }],
  ] as const) {
    await assert.rejects(
      sql.begin(async (transaction) => {
        const issued = await db.resolveInternalProductionClaimTerminalAuthorityPairInTransactionV1(
          transaction,
          Object.freeze({ claimIdText: crossedClaimIdText }),
        );
        await corrupt(transaction);
        await assert.rejects(
          db.closeInternalProductionOwnerReservationV1(transaction, issued),
        );
        throw new Error(`TEST_ROLLBACK_CROSSED_${label.toUpperCase()}`);
      }),
      new RegExp(`^Error: TEST_ROLLBACK_CROSSED_${label.toUpperCase()}$`),
    );
    assert.deepEqual(await crossedSnapshot(), beforeCrossed);
  }

  await assert.rejects(
    sql.begin((transaction) => db.resolveInternalProductionClaimTerminalAuthorityPairInTransactionV1(
      transaction,
      { claimIdText: "9100000", ownerReservationRef: outputs[0]!.reservationRef } as never,
    )),
    /INPUT_INVALID/,
  );
  await assert.rejects(
    sql.begin((transaction) => db.resolveInternalProductionClaimTerminalAuthorityPairInTransactionV1(
      transaction,
      Object.freeze({ claimIdText: "9223372036854775807" }),
    )),
    (error: unknown) => error instanceof Error
      && error.message === "INTERNAL_PRODUCTION_CLAIM_ID_INVALID",
  );

  const duplicateClaimIdText = "9199999";
  const duplicateIdentity = createInternalProductionClaimCanonicalOwnerIdentityV1(
    Object.freeze({ claimIdText: duplicateClaimIdText }),
  );
  const duplicateBound = await sql.begin(async (transaction) => {
    const reservation = await db.beginOrAdoptInternalProductionOwnerReservationV1(transaction, {
      producerImplementationId: "a-claim-loop-runtime-v1",
      ownerKey: duplicateClaimIdText,
    });
    await transaction`
      INSERT INTO claim_log (
        id,run_id,step_id,story_id,agent_id,claimed_at,outcome,duration_ms,diagnostic
      ) VALUES (
        ${duplicateClaimIdText}::bigint,'task2-duplicate-run','task2-duplicate-step','',
        'task2-duplicate-agent',NOW(),'completed',1,'task2 duplicate sidecar fixture'
      )
    `;
    return db.bindInternalProductionOwnerReservationV1(transaction, {
      reservationRef: reservation.reservationRef,
      reservationHash: reservation.reservationHash,
      canonicalOwnerIdentity: duplicateIdentity,
    });
  });
  try {
    await sql`
      UPDATE internal_production_owner_reservations_v1
         SET owner_key='9100000'
       WHERE reservation_ref=${duplicateBound.reservationRef}
    `;
    await assert.rejects(
      sql.begin((transaction) => db.resolveInternalProductionClaimTerminalAuthorityPairInTransactionV1(
        transaction,
        Object.freeze({ claimIdText: "9100000" }),
      )),
      /CLAIM_OWNER_UNAVAILABLE/,
    );
    await sql`
      UPDATE internal_production_owner_reservations_v1
         SET owner_key=${duplicateClaimIdText}
       WHERE reservation_ref=${duplicateBound.reservationRef}
    `;
  } finally {
    await sql`
      UPDATE internal_production_owner_reservations_v1
         SET owner_key=${duplicateClaimIdText}
       WHERE reservation_ref=${duplicateBound.reservationRef}
    `;
  }
});

test("real PostgreSQL remaining P3 terminal ports prove every status and fixed producer set", async () => {
  if (process.env.SETFARM_PG_URL === undefined) return;
  assert.ok(activatedOwnerAdmissionFixture, "the owner-admission fixture must remain available");
  const { db, sql } = activatedOwnerAdmissionFixture;
  const parent = (await sql<Array<{ run_id: string; step_id: string }>>`
    SELECT run.id AS run_id,step.id AS step_id
      FROM runs run JOIN steps step ON step.run_id=run.id
     ORDER BY run.id,step.id LIMIT 1
  `)[0]!;
  assert.ok(parent);
  let sequence = 0;
  const nextSuffix = () => String(++sequence).padStart(16, "0");
  const insertAttempt = async (
    transaction: Parameters<Parameters<typeof sql.begin>[0]>[0],
    attemptId: string,
    disposition: string,
    claimId: string | null = null,
  ) => {
    await transaction`
      INSERT INTO execution_attempts (
        attempt_id,run_id,step_id,story_id,generation,fence_token,attempt_class,
        compilation_report_hash,source_before_sha,source_before_tree_hash,role,
        lease_acquired_at,lease_expires_at,heartbeat_at,disposition,evidence_refs,claim_id
      ) VALUES (
        ${attemptId},${parent.run_id},${parent.step_id},'',1,${`fence-${attemptId}`},
        'evidence_only',${SHA_A},${GIT_A},${GIT_B},'implement',NOW(),
        NOW()+INTERVAL '1 hour',NOW(),${disposition},'[]',${claimId}::bigint
      )
    `;
  };
  const insertRuntimeChain = async (
    transaction: Parameters<Parameters<typeof sql.begin>[0]>[0],
    sessionId: string,
    state: "released" | "quarantined",
  ) => {
    const claimIdText = String(9_200_000 + sequence);
    const attemptId = `ATT_${nextSuffix()}`;
    await transaction`
      INSERT INTO claim_log (
        id,run_id,step_id,story_id,agent_id,claimed_at,outcome,duration_ms,diagnostic
      ) VALUES (
        ${claimIdText}::bigint,${parent.run_id},${parent.step_id},'',
        'task2-parent-claim',NOW(),'completed',1,'task2 runtime parent'
      )
    `;
    await insertAttempt(transaction, attemptId, "verified", claimIdText);
    await transaction`
      INSERT INTO runtime_sessions (
        session_id,run_id,step_db_id,workflow_step_id,story_db_id,story_id,claim_id,
        attempt_id,claim_agent_id,runtime_agent_id,runtime_kind,state,owner_instance_id,
        state_version,heartbeat_at,drained_at,released_at,diagnostic,drain_evidence,
        process_identity
      ) VALUES (
        ${sessionId},${parent.run_id},${parent.step_id},'implementation',NULL,NULL,
        ${claimIdText}::bigint,${attemptId},'task2-claim-agent','task2-runtime-agent',
        'external_session',${state},'task2-owner',1,NOW(),
        ${state === "released" ? new Date() : null},
        ${state === "released" ? new Date() : null},
        ${state === "quarantined" ? "task2 quarantine" : null},'{}'::jsonb,'{}'::jsonb
      )
    `;
    return Object.freeze({ claimIdText, attemptId });
  };
  const bindTerminalOwner = async <Category extends ownerAdmissionApi.InternalProductionOwnerCategoryV1>(
    implementationId: string,
    identity: InternalProductionCanonicalOwnerIdentityV1<Category>,
    insertTerminalRows: (
      transaction: Parameters<Parameters<typeof sql.begin>[0]>[0],
    ) => Promise<void>,
  ) => sql.begin(async (transaction) => {
    const reservation = await db.beginOrAdoptInternalProductionOwnerReservationV1(transaction, {
      producerImplementationId: implementationId,
      ownerKey: identity.ownerKey,
    });
    await insertTerminalRows(transaction);
    return db.bindInternalProductionOwnerReservationV1(transaction, {
      reservationRef: reservation.reservationRef,
      reservationHash: reservation.reservationHash,
      canonicalOwnerIdentity: identity,
    });
  });
  const assertPortAndClose = async <Category extends ownerAdmissionApi.InternalProductionOwnerCategoryV1>(
    bound: Awaited<ReturnType<typeof bindTerminalOwner<Category>>>,
    terminalOwnerHash: string,
    status: string,
    resolve: (
      transaction: Parameters<Parameters<typeof sql.begin>[0]>[0],
    ) => Promise<InternalProductionResolvedOwnerTerminalCloseInputV1>,
  ) => {
    const terminal = createInternalProductionTerminalOwnerAuthorityV1({
      canonicalOwnerIdentity: bound.canonicalOwnerIdentity,
      terminalOwnerRef: `${bound.canonicalOwnerIdentity.ownerRef}/terminal/${status}`,
      terminalOwnerHash,
    });
    const pair = deriveInternalProductionTerminalOwnerAuthorityPairV1(terminal);
    await sql.begin(async (transaction) => {
      const resolved = await resolve(transaction);
      assert.deepEqual(resolved, {
        reservationRef: bound.reservationRef,
        reservationHash: bound.reservationHash,
        terminalAuthorityRef: pair.terminalAuthorityRef,
        terminalAuthorityHash: pair.terminalAuthorityHash,
      });
      assert.deepEqual(Object.keys(resolved), [
        "reservationRef", "reservationHash", "terminalAuthorityRef", "terminalAuthorityHash",
      ]);
      assertDeepFrozen(resolved, `${bound.category} ${status} close input`);
      await db.closeInternalProductionOwnerReservationV1(transaction, resolved);
      assert.deepEqual(await resolve(transaction), resolved);
    });
  };

  for (const status of [
    "produced_delta", "already_satisfied", "no_progress", "inconclusive", "failed", "verified",
  ] as const) {
    const attemptId = `ATT_${nextSuffix()}`;
    const identity = createInternalProductionExecutionAttemptCanonicalOwnerIdentityV1(
      Object.freeze({ attemptId }),
    );
    const bound = await bindTerminalOwner("a-execution-attempt-v1", identity, (transaction) => (
      insertAttempt(transaction, attemptId, status)
    ));
    await assertPortAndClose(bound, hashCanonicalJson({
      schema: "setfarm.internal-production-execution-attempt-terminal-owner.v1",
      attemptId,
      status,
    }), status, (transaction) => (
      db.resolveInternalProductionExecutionAttemptTerminalAuthorityPairInTransactionV1(
        transaction,
        Object.freeze({ attemptId }),
      )
    ));
  }

  for (const status of ["released", "quarantined"] as const) {
    const sessionId = `RTS_${nextSuffix()}`;
    const identity = createInternalProductionRuntimeSessionCanonicalOwnerIdentityV1(
      Object.freeze({ sessionId }),
    );
    const bound = await bindTerminalOwner("a-runtime-session-v1", identity, async (transaction) => {
      await insertRuntimeChain(transaction, sessionId, status);
    });
    await assertPortAndClose(bound, hashCanonicalJson({
      schema: "setfarm.internal-production-runtime-session-terminal-owner.v1",
      sessionId,
      status,
    }), status, (transaction) => (
      db.resolveInternalProductionRuntimeSessionTerminalAuthorityPairInTransactionV1(
        transaction,
        Object.freeze({ sessionId }),
      )
    ));
  }

  const insertCompletion = async (
    transaction: Parameters<Parameters<typeof sql.begin>[0]>[0],
    requestId: string,
    status: "accepted" | "rejected" | "quarantined",
    effectKeyOverride?: string,
    effectStatus: "applied" | "reconciled" = "applied",
  ) => {
    const sessionId = `RTS_${nextSuffix()}`;
    const { claimIdText, attemptId } = await insertRuntimeChain(
      transaction,
      sessionId,
      "released",
    );
    const output = `task2 completion ${requestId}`;
    const outputHash = hashCanonicalJson({ output });
    if (status === "accepted") {
      const effectKey = effectKeyOverride ?? `accepted-${sequence}`;
      const preparedAt = new Date();
      const effect = {
        effectKey,
        ordinal: 0,
        effectType: "task2-test",
        mandatory: true,
        payload: { schema: "setfarm.task2-effect.v1" },
      };
      const completionPlan = {
        schema: "setfarm.runtime-completion-plan.v1",
        planVersion: 1,
        requestId,
        claimId: Number(claimIdText),
        runId: parent.run_id,
        stepDbId: parent.step_id,
        workflowStepId: "implementation",
        outputHash,
        kind: "legacy_recovery",
        continuation: { type: "legacy_receipt_only" },
        effects: [effect],
        preparedAt: preparedAt.toISOString(),
      };
      const completionPlanHash = hashCanonicalJson(completionPlan);
      const effectInput = {
        schema: "setfarm.runtime-completion-effect-input.v1",
        planHash: completionPlanHash,
        plan: completionPlan,
        effect: effect.payload,
      };
      await transaction`
        INSERT INTO runtime_completion_requests (
          request_id,runtime_session_id,claim_id,run_id,step_db_id,workflow_step_id,
          story_db_id,story_id,attempt_id,claim_envelope,output,output_hash,apply_phase,
          claim_outcome,claim_committed_at,state,requested_by,requested_at,processing_at,
          result,completion_plan,completion_plan_hash,prepared_at
        ) VALUES (
          ${requestId},${sessionId},${claimIdText}::bigint,${parent.run_id},${parent.step_id},
          'implementation',NULL,NULL,${attemptId},'{}'::jsonb,${output},${outputHash},
          'owner_committed','completed',NOW(),'processing','task2',NOW(),NOW(),'{}'::jsonb,
          ${transaction.json(completionPlan)},${completionPlanHash},${preparedAt}
        )
      `;
      await transaction`
        INSERT INTO runtime_completion_effects (
          request_id,effect_key,ordinal,effect_type,input_hash,payload,mandatory,state,
          result,evidence,applied_at,reconciled_at
        ) VALUES (
          ${requestId},${effectKey},0,'task2-test',${hashCanonicalJson(effectInput)},
          ${transaction.json(effectInput)},TRUE,${effectStatus},'{}'::jsonb,'{}'::jsonb,
          ${effectStatus === "applied" ? new Date() : null},
          ${effectStatus === "reconciled" ? new Date() : null}
        )
      `;
      await transaction`
        UPDATE runtime_completion_requests
           SET state='accepted',apply_phase='effects_committed',effects_committed_at=NOW(),
               accepted_at=NOW()
         WHERE request_id=${requestId}
      `;
    } else {
      await transaction`
        INSERT INTO runtime_completion_requests (
          request_id,runtime_session_id,claim_id,run_id,step_db_id,workflow_step_id,
          story_db_id,story_id,attempt_id,claim_envelope,output,output_hash,state,
          requested_by,requested_at,rejected_at,diagnostic,result
        ) VALUES (
          ${requestId},${sessionId},${claimIdText}::bigint,${parent.run_id},${parent.step_id},
          'implementation',NULL,NULL,${attemptId},'{}'::jsonb,${output},${outputHash},
          ${status},'task2',NOW(),${status === "rejected" ? new Date() : null},
          ${status === "quarantined" ? "task2 quarantine" : null},'{}'::jsonb
        )
      `;
    }
  };

  const completionInputs: Array<Readonly<{ requestId: string; status: string }>> = [];
  for (const status of ["accepted", "rejected", "quarantined"] as const) {
    const requestId = `RCR_${nextSuffix()}`;
    const identity = createInternalProductionCompletionOwnerCanonicalOwnerIdentityV1(
      Object.freeze({ requestId }),
    );
    const bound = await bindTerminalOwner("a-completion-owner-v1", identity, (transaction) => (
      insertCompletion(transaction, requestId, status)
    ));
    await assertPortAndClose(bound, hashCanonicalJson({
      schema: "setfarm.internal-production-completion-owner-terminal.v1",
      requestId,
      status,
    }), status, (transaction) => (
      db.resolveInternalProductionCompletionOwnerTerminalAuthorityPairInTransactionV1(
        transaction,
        Object.freeze({ requestId }),
      )
    ));
    completionInputs.push(Object.freeze({ requestId, status }));
  }

  const acceptedCompletion = completionInputs.find(({ status }) => status === "accepted")!;
  for (const [label, corrupt] of [
    ["partial", async (transaction: Parameters<Parameters<typeof sql.begin>[0]>[0]) => {
      await transaction`DELETE FROM runtime_completion_effects
         WHERE request_id=${acceptedCompletion.requestId}`;
    }],
    ["extra", async (transaction: Parameters<Parameters<typeof sql.begin>[0]>[0]) => {
      await transaction`
        INSERT INTO runtime_completion_effects (
          request_id,effect_key,ordinal,effect_type,input_hash,payload,mandatory,state,
          result,evidence,applied_at
        )
        SELECT request_id,'task2-extra-effect',1,effect_type,input_hash,payload,mandatory,state,
               result,evidence,applied_at
          FROM runtime_completion_effects
         WHERE request_id=${acceptedCompletion.requestId}
         LIMIT 1
      `;
    }],
    ["mismatch", async (transaction: Parameters<Parameters<typeof sql.begin>[0]>[0]) => {
      await transaction`UPDATE runtime_completion_effects SET effect_type='task2-crossed'
         WHERE request_id=${acceptedCompletion.requestId}`;
    }],
  ] as const) {
    await assert.rejects(
      sql.begin(async (transaction) => {
        await transaction`ALTER TABLE runtime_completion_effects DISABLE TRIGGER USER`;
        await corrupt(transaction);
        await db.resolveInternalProductionCompletionOwnerTerminalAuthorityPairInTransactionV1(
          transaction,
          Object.freeze({ requestId: acceptedCompletion.requestId }),
        );
        throw new Error(`TEST_ACCEPTED_${label.toUpperCase()}_COMPLETION_EFFECT_PROJECTION`);
      }),
      /COMPLETION_OWNER_UNAVAILABLE/,
    );
  }

  for (const status of ["applied", "reconciled"] as const) {
    const requestId = `RCR_${nextSuffix()}`;
    const effectKey = `effect-${sequence}`;
    const identity = createInternalProductionMandatoryEffectCanonicalOwnerIdentityV1(
      Object.freeze({ requestId, effectKey }),
    );
    const bound = await bindTerminalOwner("a-mandatory-effect-v1", identity, async (transaction) => {
      await insertCompletion(transaction, requestId, "accepted", effectKey, status);
    });
    await assertPortAndClose(bound, hashCanonicalJson({
      schema: "setfarm.internal-production-mandatory-effect-terminal-owner.v1",
      requestId,
      effectKey,
      status,
    }), status, (transaction) => (
      db.resolveInternalProductionMandatoryEffectTerminalAuthorityPairInTransactionV1(
        transaction,
        Object.freeze({ requestId, effectKey }),
      )
    ));
  }

  {
    const requestId = `RTR_${nextSuffix()}`;
    assertCanonicalTerminationRequestId(requestId);
    const identity = createInternalProductionTerminationCanonicalOwnerIdentityV1(
      Object.freeze({ requestId }),
    );
    const bound = await bindTerminalOwner("a-termination-v1", identity, async (transaction) => {
      await transaction`
        INSERT INTO run_termination_requests (
          request_id,run_id,target_status,state,requested_by,requested_at,drained_at,
          terminalized_at,diagnostic,evidence
        ) VALUES (
          ${requestId},${parent.run_id},'failed','terminalized','task2',NOW(),NOW(),NOW(),
          'task2 terminalized','{}'::jsonb
        )
      `;
    });
    await assertPortAndClose(bound, hashCanonicalJson({
      schema: "setfarm.internal-production-termination-terminal-owner.v1",
      requestId,
      status: "terminalized",
    }), "terminalized", (transaction) => (
      db.resolveInternalProductionTerminationTerminalAuthorityPairInTransactionV1(
        transaction,
        Object.freeze({ requestId }),
      )
    ));
  }

  const findingImplementations = [
    "a-finding-recovery-repository-v1",
    "a-finding-v3-downstream-evidence-v1",
    "a-finding-v3-evidence-only-v1",
  ] as const;
  const findingInputs: Array<Readonly<{ findingSetHash: string }>> = [];
  for (const implementationId of findingImplementations) {
    const findingSetHash = hashCanonicalJson({ implementationId, sequence: ++sequence });
    const findingSetId = `FSET_${findingSetHash}`;
    const findingId = `FIND_${hashCanonicalJson({ findingSetHash })}`;
    const identity = createInternalProductionFindingCanonicalOwnerIdentityV1(
      Object.freeze({ findingSetHash }),
    );
    const payload = {
      schema: "setfarm.finding-set.v1",
      findingSetHash,
      findingSetId,
      runId: parent.run_id,
      storyId: `task2-story-${sequence}`,
      packetHash: SHA_A,
      sliceHash: SHA_B,
      sourceRevision: { sha: GIT_A, treeHash: GIT_B },
    };
    const bound = await bindTerminalOwner(implementationId, identity, async (transaction) => {
      await transaction`
        INSERT INTO finding_sets (
          finding_set_hash,finding_set_id,run_id,story_id,packet_hash,slice_hash,
          source_sha,source_tree_hash,finding_ids,payload
        ) VALUES (
          ${findingSetHash},${findingSetId},${parent.run_id},${payload.storyId},${SHA_A},${SHA_B},
          ${GIT_A},${GIT_B},${transaction.json([findingId])},${transaction.json(payload)}
        )
      `;
      const findingPayload = {
        findingId,
        origin: "test",
        classification: "structured",
        invariantRef: "INV_TASK2",
        status: "satisfied",
      };
      await transaction`
        INSERT INTO findings (
          finding_set_hash,finding_id,origin,classification,invariant_ref,status,
          source_fingerprint,payload
        ) VALUES (
          ${findingSetHash},${findingId},'test','structured','INV_TASK2','satisfied',
          ${SHA_C},${transaction.json(findingPayload)}
        )
      `;
    });
    await assertPortAndClose(bound, hashCanonicalJson({
      schema: "setfarm.internal-production-finding-terminal-owner.v1",
      findingSetHash,
      status: "published",
    }), "published", (transaction) => (
      db.resolveInternalProductionFindingTerminalAuthorityPairInTransactionV1(
        transaction,
        Object.freeze({ findingSetHash }),
      )
    ));
    findingInputs.push(Object.freeze({ findingSetHash }));
  }

  for (const status of ["delivered", "skipped", "quarantined"] as const) {
    const eventKey = `task2-event-${nextSuffix()}`;
    const consumer = status === "skipped" ? "jsonl" as const : "webhook" as const;
    const identity = createInternalProductionOperationalDeliveryCanonicalOwnerIdentityV1(
      Object.freeze({ eventKey, consumer }),
    );
    const outboxId = `task2-outbox-${sequence}`;
    const deliveryHash = hashCanonicalJson({ eventKey, consumer });
    const bound = await bindTerminalOwner("a-operational-delivery-v1", identity, async (transaction) => {
      await transaction`
        INSERT INTO operational_outbox (
          outbox_id,event_key,event_type,aggregate_type,aggregate_id,payload,state,published_at
        ) VALUES (
          ${outboxId},${eventKey},'task2','task2',${parent.run_id},'{}'::jsonb,'published',NOW()
        )
      `;
      await transaction`
        INSERT INTO operational_events (
          event_key,outbox_id,event_type,aggregate_type,aggregate_id,run_id,payload,event_hash,
          source_created_at,committed_at
        ) VALUES (
          ${eventKey},${outboxId},'task2','task2',${parent.run_id},${parent.run_id},
          '{"schema":"setfarm.task2-event.v1"}'::jsonb,${SHA_A},NOW(),NOW()
        )
      `;
      await transaction`
        INSERT INTO operational_event_deliveries (
          event_key,consumer,delivery_id,input_hash,idempotency_key,state,attempt_count,
          delivered_at,diagnostic,result
        ) VALUES (
          ${eventKey},${consumer},${`OED_${deliveryHash}`},${SHA_B},${eventKey},${status},1,
          ${status === "delivered" || status === "skipped" ? new Date() : null},
          ${status === "quarantined" ? "task2 quarantine" : null},'{}'::jsonb
        )
      `;
    });
    await assertPortAndClose(bound, hashCanonicalJson({
      schema: "setfarm.internal-production-operational-delivery-terminal-owner.v1",
      eventKey,
      consumer,
      status,
    }), status, (transaction) => (
      db.resolveInternalProductionOperationalDeliveryTerminalAuthorityPairInTransactionV1(
        transaction,
        Object.freeze({ eventKey, consumer }),
      )
    ));
  }

  const realClaimReservation = (await sql<Array<{
    reservation_ref: string;
    reservation_hash: string;
    category: string;
    producer_implementation_id: string;
    producer_purpose_hash: string;
    producer_implementation_hash: string;
  }>>`
    SELECT reservation_ref,reservation_hash,category,producer_implementation_id,
           producer_purpose_hash,producer_implementation_hash
      FROM internal_production_owner_reservations_v1
     WHERE category='claim' AND owner_key='9100000' AND state='closed'
  `)[0]!;
  const realAttemptReservation = (await sql<typeof realClaimReservation[]>`
    SELECT reservation_ref,reservation_hash,category,producer_implementation_id,
           producer_purpose_hash,producer_implementation_hash
      FROM internal_production_owner_reservations_v1
     WHERE category='execution-attempt'
       AND producer_implementation_id='a-execution-attempt-v1'
       AND state='closed'
     ORDER BY owner_key LIMIT 1
  `)[0]!;
  assert.ok(realClaimReservation);
  assert.ok(realAttemptReservation);
  const crossedClaimRowSnapshot = async () => (await sql<Array<{
    head_version: string;
    head_hash: string;
    reservation_ref: string;
    reservation_hash: string;
    category: string;
    producer_implementation_id: string;
    producer_purpose_hash: string;
    producer_implementation_hash: string;
    state: string;
  }>>`
    SELECT head.head_version::text,head.head_hash,reservation.reservation_ref,
           reservation.reservation_hash,reservation.category,
           reservation.producer_implementation_id,reservation.producer_purpose_hash,
           reservation.producer_implementation_hash,reservation.state
      FROM internal_production_owner_admission_head_v1 head
      JOIN internal_production_owner_reservations_v1 reservation
        ON reservation.reservation_ref=${realClaimReservation.reservation_ref}
     WHERE head.singleton=TRUE
  `)[0]!;
  const beforeCrossedClaimRow = await crossedClaimRowSnapshot();
  for (const [label, crossRealRow] of [
    ["disallowed-implementation", async (
      transaction: Parameters<Parameters<typeof sql.begin>[0]>[0],
    ) => {
      await transaction`
        UPDATE internal_production_owner_reservations_v1
           SET producer_implementation_id=${realAttemptReservation.producer_implementation_id},
               producer_purpose_hash=${realAttemptReservation.producer_purpose_hash},
               producer_implementation_hash=${realAttemptReservation.producer_implementation_hash}
         WHERE reservation_ref=${realClaimReservation.reservation_ref}
      `;
    }],
    ["category", async (
      transaction: Parameters<Parameters<typeof sql.begin>[0]>[0],
    ) => {
      await transaction`
        UPDATE internal_production_owner_reservations_v1
           SET category=${realAttemptReservation.category}
         WHERE reservation_ref=${realClaimReservation.reservation_ref}
      `;
    }],
  ] as const) {
    await assert.rejects(
      sql.begin(async (transaction) => {
        await crossRealRow(transaction);
        await assert.rejects(
          db.resolveInternalProductionClaimTerminalAuthorityPairInTransactionV1(
            transaction,
            Object.freeze({ claimIdText: "9100000" }),
          ),
          /^Error: INTERNAL_PRODUCTION_CLAIM_OWNER_UNAVAILABLE$/,
        );
        throw new Error(`TEST_ROLLBACK_REAL_CROSSED_CLAIM_${label.toUpperCase()}`);
      }),
      new RegExp(`^Error: TEST_ROLLBACK_REAL_CROSSED_CLAIM_${label.toUpperCase()}$`),
    );
    assert.deepEqual(await crossedClaimRowSnapshot(), beforeCrossedClaimRow);
  }

  const zeroSidecarAttemptId = `ATT_${nextSuffix()}`;
  await insertAttempt(sql, zeroSidecarAttemptId, "verified");
  await assert.rejects(
    sql.begin((transaction) => (
      db.resolveInternalProductionExecutionAttemptTerminalAuthorityPairInTransactionV1(
        transaction,
        Object.freeze({ attemptId: zeroSidecarAttemptId }),
      )
    )),
    /EXECUTION_ATTEMPT_OWNER_UNAVAILABLE/,
  );

  const partialFindingSetHash = hashCanonicalJson({ partial: ++sequence });
  const partialFindingIdentity = createInternalProductionFindingCanonicalOwnerIdentityV1(
    Object.freeze({ findingSetHash: partialFindingSetHash }),
  );
  await assert.rejects(
    sql.begin(async (transaction) => {
      const reservation = await db.beginOrAdoptInternalProductionOwnerReservationV1(transaction, {
        producerImplementationId: "a-finding-recovery-repository-v1",
        ownerKey: partialFindingSetHash,
      });
      const firstFindingId = `FIND_${hashCanonicalJson({ partialFindingSetHash, index: 0 })}`;
      const missingFindingId = `FIND_${hashCanonicalJson({ partialFindingSetHash, index: 1 })}`;
      const findingSetId = `FSET_${partialFindingSetHash}`;
      const payload = {
        schema: "setfarm.finding-set.v1",
        findingSetHash: partialFindingSetHash,
        findingSetId,
        runId: parent.run_id,
        storyId: `task2-partial-story-${sequence}`,
        packetHash: SHA_A,
        sliceHash: SHA_B,
        sourceRevision: { sha: GIT_A, treeHash: GIT_B },
      };
      await transaction`
        INSERT INTO finding_sets (
          finding_set_hash,finding_set_id,run_id,story_id,packet_hash,slice_hash,
          source_sha,source_tree_hash,finding_ids,payload
        ) VALUES (
          ${partialFindingSetHash},${findingSetId},${parent.run_id},${payload.storyId},
          ${SHA_A},${SHA_B},${GIT_A},${GIT_B},
          ${transaction.json([firstFindingId, missingFindingId])},${transaction.json(payload)}
        )
      `;
      const findingPayload = {
        findingId: firstFindingId,
        origin: "test",
        classification: "structured",
        invariantRef: "INV_TASK2_PARTIAL",
        status: "satisfied",
      };
      await transaction`
        INSERT INTO findings (
          finding_set_hash,finding_id,origin,classification,invariant_ref,status,
          source_fingerprint,payload
        ) VALUES (
          ${partialFindingSetHash},${firstFindingId},'test','structured','INV_TASK2_PARTIAL',
          'satisfied',${SHA_C},${transaction.json(findingPayload)}
        )
      `;
      await db.bindInternalProductionOwnerReservationV1(transaction, {
        reservationRef: reservation.reservationRef,
        reservationHash: reservation.reservationHash,
        canonicalOwnerIdentity: partialFindingIdentity,
      });
      return db.resolveInternalProductionFindingTerminalAuthorityPairInTransactionV1(
        transaction,
        Object.freeze({ findingSetHash: partialFindingSetHash }),
      );
    }),
    /FINDING_OWNER_UNAVAILABLE/,
  );

  let unrelatedChildLocked!: () => void;
  const unrelatedChildIsLocked = new Promise<void>((resolve) => {
    unrelatedChildLocked = resolve;
  });
  let releaseUnrelatedChild!: () => void;
  const holdUnrelatedChild = new Promise<void>((resolve) => {
    releaseUnrelatedChild = resolve;
  });
  const unrelatedFindingBlocker = sql.begin(async (transaction) => {
    await transaction`
      SELECT finding_id FROM findings
       WHERE finding_set_hash=${findingInputs[1]!.findingSetHash}
       FOR UPDATE
    `;
    unrelatedChildLocked();
    await holdUnrelatedChild;
  });
  await unrelatedChildIsLocked;
  let exactFindingResult!: InternalProductionResolvedOwnerTerminalCloseInputV1;
  try {
    exactFindingResult = await sql.begin(async (transaction) => {
      await transaction`SET LOCAL lock_timeout='250ms'`;
      return db.resolveInternalProductionFindingTerminalAuthorityPairInTransactionV1(
        transaction,
        findingInputs[0]!,
      );
    });
  } finally {
    releaseUnrelatedChild();
    await unrelatedFindingBlocker;
  }
  assert.deepEqual(Object.keys(exactFindingResult), [
    "reservationRef", "reservationHash", "terminalAuthorityRef", "terminalAuthorityHash",
  ]);
});

test("real PostgreSQL close resolver rejects a bare historical row and unavailable terminal authority", async () => {
  if (process.env.SETFARM_PG_URL === undefined) return;
  assert.ok(activatedOwnerAdmissionFixture, "the owner-admission fixture must remain available");
  const { db, sql } = activatedOwnerAdmissionFixture;
  const row = INTERNAL_PRODUCTION_OWNER_PRODUCER_ROWS_A_V1[0];
  const currentHead = (await sql<Array<{
    head_version: string;
    head_hash: string;
    head_payload: { migrationApplication: unknown };
  }>>`SELECT head_version::text,head_hash,head_payload FROM internal_production_owner_admission_head_v1 WHERE singleton=TRUE`)[0]!;
  const reservation = createInternalProductionOwnerReservationV1({
    producer: row,
    ownerKey: "run-owner-canonical-historical-close",
    ownerAdmissionHeadPredecessorHash: currentHead.head_hash,
  });
  const identity: InternalProductionCanonicalOwnerIdentityV1<"run"> = {
    schema: "setfarm.internal-production-canonical-owner-identity.v1",
    category: "run",
    ownerKey: reservation.ownerKey,
    ownerRef: "setfarm://runs/run-owner-canonical-historical-close",
    ownerHash: SHA_B,
  };
  const bound = createInternalProductionBoundOwnerReservationV1({
    reservation,
    canonicalOwnerIdentity: identity,
  });
  const terminal = createInternalProductionTerminalOwnerAuthorityV1({
    canonicalOwnerIdentity: identity,
    terminalOwnerRef: "setfarm://runs/run-owner-canonical-historical-close/terminal/completed",
    terminalOwnerHash: SHA_C,
  });
  const reservationSuccessorPayload = {
    schema: "setfarm.internal-production-owner-admission-head.v1",
    version: Number(currentHead.head_version) + 1,
    predecessorHeadHash: currentHead.head_hash,
    transitionKind: "reservation",
    transitionRef: reservation.reservationRef,
    transitionHash: reservation.reservationHash,
    migrationApplication: currentHead.head_payload.migrationApplication,
  };
  const reservationSuccessorHash = hashCanonicalJson(reservationSuccessorPayload);
  const intermediateReservation = createInternalProductionOwnerReservationV1({
    producer: row,
    ownerKey: "run-owner-intermediate-head-transition",
    ownerAdmissionHeadPredecessorHash: reservationSuccessorHash,
  });
  const intermediateSuccessorPayload = {
    schema: "setfarm.internal-production-owner-admission-head.v1",
    version: reservationSuccessorPayload.version + 1,
    predecessorHeadHash: reservationSuccessorHash,
    transitionKind: "reservation",
    transitionRef: intermediateReservation.reservationRef,
    transitionHash: intermediateReservation.reservationHash,
    migrationApplication: currentHead.head_payload.migrationApplication,
  };
  const intermediateSuccessorHash = hashCanonicalJson(intermediateSuccessorPayload);
  const closeTransition = {
    schema: "setfarm.internal-production-owner-reservation-close-transition.v1",
    reservationRef: bound.reservationRef,
    reservationHash: bound.reservationHash,
    terminalOwnerRef: terminal.terminalOwnerRef,
    terminalOwnerHash: terminal.terminalOwnerHash,
  };
  const closeTransitionHash = hashCanonicalJson(closeTransition);
  const closeSuccessorPayload = {
    schema: "setfarm.internal-production-owner-admission-head.v1",
    version: intermediateSuccessorPayload.version + 1,
    predecessorHeadHash: intermediateSuccessorHash,
    transitionKind: "close",
    transitionRef: `setfarm://internal-production/owner-reservation-close-transitions/${closeTransitionHash}`,
    transitionHash: closeTransitionHash,
    migrationApplication: currentHead.head_payload.migrationApplication,
  };
  const closeSuccessorHash = hashCanonicalJson(closeSuccessorPayload);
  const close = createInternalProductionOwnerReservationCloseV1({
    closeKind: "ordinary",
    boundReservation: bound,
    terminalAuthority: terminal,
    ownerAdmissionHeadPredecessorHash: intermediateSuccessorHash,
    ownerAdmissionHeadSuccessorHash: closeSuccessorHash,
    preservedFenceRef: null,
    preservedFenceHash: null,
  });
  await sql`
    INSERT INTO internal_production_owner_reservations_v1 (
      reservation_ref, reservation_hash, category, owner_key, owner_key_hash,
      producer_purpose_hash, producer_implementation_id, producer_implementation_hash,
      reservation_payload, reservation_head_predecessor_hash, state,
      canonical_owner_identity, binding_hash, binding_payload, close_kind,
      terminal_owner_ref, terminal_owner_hash, close_head_predecessor_hash,
      close_head_successor_hash, preserved_fence_ref, preserved_fence_hash,
      close_ref, close_hash, close_payload, head_version
    ) VALUES (
      ${reservation.reservationRef}, ${reservation.reservationHash}, ${reservation.category},
      ${reservation.ownerKey}, ${reservation.ownerKeyHash}, ${reservation.producerPurposeHash},
      ${reservation.producerImplementationId}, ${reservation.producerImplementationHash},
      ${sql.json(reservation)}, ${reservation.ownerAdmissionHeadPredecessorHash},
      'closed', ${sql.json(identity)}, ${bound.bindingHash},
      ${sql.json(bound)}, ${close.closeKind}, ${close.terminalOwnerRef},
      ${close.terminalOwnerHash}, ${close.ownerAdmissionHeadPredecessorHash},
      ${close.ownerAdmissionHeadSuccessorHash}, NULL, NULL, ${close.closeRef}, ${close.closeHash},
      ${sql.json(close)}, ${closeSuccessorPayload.version}
    )
  `;
  await sql`
    INSERT INTO internal_production_owner_reservations_v1 (
      reservation_ref,reservation_hash,category,owner_key,owner_key_hash,
      producer_purpose_hash,producer_implementation_id,producer_implementation_hash,
      reservation_payload,reservation_head_predecessor_hash,state,head_version
    ) VALUES (
      ${intermediateReservation.reservationRef},${intermediateReservation.reservationHash},
      ${intermediateReservation.category},${intermediateReservation.ownerKey},
      ${intermediateReservation.ownerKeyHash},${intermediateReservation.producerPurposeHash},
      ${intermediateReservation.producerImplementationId},
      ${intermediateReservation.producerImplementationHash},${sql.json(intermediateReservation)},
      ${intermediateReservation.ownerAdmissionHeadPredecessorHash},'pending',
      ${intermediateSuccessorPayload.version}
    )
  `;
  await sql`
    INSERT INTO internal_production_owner_admission_authorities_v1 (
      authority_ref, authority_hash, authority_kind, phase_key,
      predecessor_head_hash, successor_head_hash, authority_body
    ) VALUES (
      ${reservation.reservationRef}, ${reservation.reservationHash}, 'reservation',
      ${reservation.reservationRef}, ${reservation.ownerAdmissionHeadPredecessorHash},
      ${reservationSuccessorHash}, ${sql.json(reservation)}
    ), (
      ${intermediateReservation.reservationRef}, ${intermediateReservation.reservationHash},
      'reservation', ${intermediateReservation.reservationRef},
      ${intermediateReservation.ownerAdmissionHeadPredecessorHash},
      ${intermediateSuccessorHash}, ${sql.json(intermediateReservation)}
    ), (
      ${close.closeRef}, ${close.closeHash}, 'close', ${reservation.reservationRef},
      ${close.ownerAdmissionHeadPredecessorHash}, ${close.ownerAdmissionHeadSuccessorHash},
      ${sql.json(close)}
    )
  `;
  await assert.rejects(
    db.resolveInternalProductionOwnerReservationV1({
      reservationRef: reservation.reservationRef,
      reservationHash: reservation.reservationHash,
    }),
    /^Error: INTERNAL_PRODUCTION_OWNER_RESERVATION_CORRUPTION$/,
  );
  await assert.rejects(
    db.resolveInternalProductionOwnerReservationCloseV1({
      closeRef: close.closeRef,
      closeHash: close.closeHash,
    }),
    /^Error: INTERNAL_PRODUCTION_OWNER_RESERVATION_CLOSE_CORRUPTION$/,
  );
  const bindingRef = `setfarm://internal-production/bound-owner-reservations/${bound.bindingHash}`;
  await sql`
    INSERT INTO internal_production_owner_admission_authorities_v1 (
      authority_ref, authority_hash, authority_kind, phase_key,
      predecessor_head_hash, successor_head_hash, authority_body
    ) VALUES (
      ${bindingRef}, ${bound.bindingHash}, 'binding', ${reservation.reservationRef},
      ${reservationSuccessorHash}, ${reservationSuccessorHash}, ${sql.json(bound)}
    )
  `;
  assert.deepEqual(await db.resolveInternalProductionOwnerReservationV1({
    reservationRef: reservation.reservationRef,
    reservationHash: reservation.reservationHash,
  }), reservation);
  const beginHistorical = () => sql.begin((transaction) => (
    db.beginOrAdoptInternalProductionOwnerReservationV1(transaction, {
      producerImplementationId: reservation.producerImplementationId,
      ownerKey: reservation.ownerKey,
    })
  ));
  await sql.unsafe("ALTER TABLE internal_production_owner_admission_authorities_v1 DISABLE TRIGGER trg_internal_production_owner_admission_authority_immutable");
  try {
    await sql`DELETE FROM internal_production_owner_admission_authorities_v1 WHERE authority_ref=${close.closeRef} AND authority_hash=${close.closeHash}`;
    await assert.rejects(beginHistorical(), /^Error: INTERNAL_PRODUCTION_OWNER_RESERVATION_CORRUPTION$/);
    await sql`
      INSERT INTO internal_production_owner_admission_authorities_v1 (
        authority_ref, authority_hash, authority_kind, phase_key,
        predecessor_head_hash, successor_head_hash, authority_body
      ) VALUES (
        ${close.closeRef}, ${close.closeHash}, 'close', ${reservation.reservationRef},
        ${close.ownerAdmissionHeadPredecessorHash}, ${close.ownerAdmissionHeadSuccessorHash},
        ${sql.json(close)}
      )
    `;
    await sql`UPDATE internal_production_owner_admission_authorities_v1 SET phase_key=${intermediateReservation.reservationRef} WHERE authority_ref=${close.closeRef}`;
    await assert.rejects(beginHistorical(), /^Error: INTERNAL_PRODUCTION_OWNER_RESERVATION_CORRUPTION$/);
    await sql`UPDATE internal_production_owner_admission_authorities_v1 SET phase_key=${reservation.reservationRef} WHERE authority_ref=${close.closeRef}`;
  } finally {
    await sql.unsafe("ALTER TABLE internal_production_owner_admission_authorities_v1 ENABLE TRIGGER trg_internal_production_owner_admission_authority_immutable");
  }
  assert.deepEqual(await beginHistorical(), reservation);
  await assert.rejects(
    db.resolveInternalProductionOwnerReservationCloseV1({
      closeRef: close.closeRef,
      closeHash: close.closeHash,
    }),
    /^Error: INTERNAL_PRODUCTION_WORKFLOW_RUN_OWNER_UNAVAILABLE$/,
  );
  const crossedReservation = createInternalProductionOwnerReservationV1({
    producer: row,
    ownerKey: "run-owner-crossed-reservation-successor",
    ownerAdmissionHeadPredecessorHash: currentHead.head_hash,
  });
  await sql`
    INSERT INTO internal_production_owner_reservations_v1 (
      reservation_ref,reservation_hash,category,owner_key,owner_key_hash,
      producer_purpose_hash,producer_implementation_id,producer_implementation_hash,
      reservation_payload,reservation_head_predecessor_hash,state,head_version
    ) VALUES (
      ${crossedReservation.reservationRef},${crossedReservation.reservationHash},
      ${crossedReservation.category},${crossedReservation.ownerKey},${crossedReservation.ownerKeyHash},
      ${crossedReservation.producerPurposeHash},${crossedReservation.producerImplementationId},
      ${crossedReservation.producerImplementationHash},${sql.json(crossedReservation)},
      ${crossedReservation.ownerAdmissionHeadPredecessorHash},'pending',
      ${reservationSuccessorPayload.version}
    )
  `;
  await sql`
    INSERT INTO internal_production_owner_admission_authorities_v1 (
      authority_ref,authority_hash,authority_kind,phase_key,
      predecessor_head_hash,successor_head_hash,authority_body
    ) VALUES (
      ${crossedReservation.reservationRef},${crossedReservation.reservationHash},'reservation',
      ${crossedReservation.reservationRef},${currentHead.head_hash},${SHA_C},
      ${sql.json(crossedReservation)}
    )
  `;
  await assert.rejects(
    db.resolveInternalProductionOwnerReservationV1({
      reservationRef: crossedReservation.reservationRef,
      reservationHash: crossedReservation.reservationHash,
    }),
    /^Error: INTERNAL_PRODUCTION_OWNER_RESERVATION_CORRUPTION$/,
  );
  await assert.rejects(
    db.resolveInternalProductionOwnerReservationV1({
      reservationRef: reservation.reservationRef,
      reservationHash: SHA_C,
    }),
    /^Error: INTERNAL_PRODUCTION_OWNER_RESERVATION_UNAVAILABLE$/,
  );
  await assert.rejects(
    db.resolveInternalProductionOwnerReservationCloseV1({
      closeRef: close.closeRef,
      closeHash: SHA_C,
    }),
    /^Error: INTERNAL_PRODUCTION_OWNER_RESERVATION_CLOSE_UNAVAILABLE$/,
  );
});

function assertDeepFrozen(value: unknown, label: string): void {
  if (value === null || typeof value !== "object") return;
  assert.equal(Object.isFrozen(value), true, `${label} must be frozen`);
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (descriptor && "value" in descriptor) {
      assertDeepFrozen(descriptor.value, `${label}.${String(key)}`);
    }
  }
}

const EXPECTED_CATEGORIES = [
  "run", "claim", "execution-attempt", "runtime-session", "completion-owner",
  "mandatory-effect", "ordinary-service-start", "restart-reservation",
  "service-restart-operation", "launch-preparation", "prepared-launch", "staged-case",
  "fixture-attempt", "artifact-reservation", "artifact-publication", "docs-session",
  "docs-lease", "fleet-stage", "fleet-inflight", "fleet-review", "matrix-inflight",
  "launch-outbox", "termination", "finding", "recovery", "operational-delivery",
  "source-run", "cold-rehearsal", "compilation-lease", "execution-lease", "process",
  "listener", "worktree", "dirty-worktree", "stale-child",
] as const;

const EXPECTED_CENSUS_KEYS = [
  "activeRunCount", "openClaimCount", "executionAttemptCount",
  "activeRuntimeSessionCount", "activeCompletionOwnerCount",
  "unsettledMandatoryEffectCount", "ordinaryStartingCount", "restartReservationCount",
  "serviceRestartOperationCount", "launchPreparationCount", "preparedLaunchCount",
  "stagedCaseCount", "fixtureAttemptCount", "artifactReservationCount",
  "publicationBatchCount", "artifactPublicationCount", "docsSessionCount",
  "docsLeaseCount", "fleetStageCount", "fleetInflightCount", "fleetPendingReviewCount",
  "matrixInflightCount", "launchOutboxCount", "terminationOwnerCount",
  "findingOwnerCount", "recoveryOwnerCount", "operationalDeliveryCount",
  "sourceRunOwnerCount", "coldRehearsalOwnerCount", "compilationLeaseCount",
  "executionLeaseCount", "ownedProcessCount", "ownedListenerCount",
  "ownedWorktreeCount", "dirtyWorktreeCount", "staleChildCount",
] as const;

const EXPECTED_A_TUPLES = [
  ["src/execution/run-persistence.ts", "persistWorkflowRunInTransaction", "a-runtime-run-v1", "run", "run-id-generation-v1", "activeRunCount"],
  ["src/execution/claim-runtime-publication.ts", "publishSingleClaimRuntime", "a-claim-single-runtime-v1", "claim", "claim-log-id-v1", "openClaimCount"],
  ["src/execution/claim-runtime-publication.ts", "publishLoopClaimRuntime", "a-claim-loop-runtime-v1", "claim", "claim-log-id-v1", "openClaimCount"],
  ["src/recovery/v3-downstream-evidence-publication.ts", "createV3DownstreamEvidencePublication.reserve", "a-claim-v3-downstream-evidence-v1", "claim", "claim-log-id-v1", "openClaimCount"],
  ["src/recovery/v3-evidence-only-publication.ts", "createV3EvidenceOnlyPublication.reserve", "a-claim-v3-evidence-only-v1", "claim", "claim-log-id-v1", "openClaimCount"],
  ["src/execution/attempt-repository.ts", "reserveAttemptInTransaction", "a-execution-attempt-v1", "execution-attempt", "execution-attempt-id-generation-v1", "executionAttemptCount"],
  ["src/execution/runtime-session-repository.ts", "reserveRuntimeSessionInTransaction", "a-runtime-session-v1", "runtime-session", "runtime-session-id-v1", "activeRuntimeSessionCount"],
  ["src/execution/runtime-completion.ts", "createRuntimeCompletionRepository.claim", "a-completion-owner-v1", "completion-owner", "completion-request-id-v1", "activeCompletionOwnerCount"],
  ["src/execution/runtime-completion.ts", "markRuntimeCompletionOwnerCommittedInTransaction", "a-mandatory-effect-v1", "mandatory-effect", "completion-request-id-effect-key-v1", "unsettledMandatoryEffectCount"],
  ["src/execution/run-termination.ts", "requestRunTerminationInTransaction", "a-termination-v1", "termination", "termination-request-id-v1", "terminationOwnerCount"],
  ["src/recovery/finding-recovery-repository.ts", "createFindingRecoveryRepository.putFindingSet", "a-finding-recovery-repository-v1", "finding", "finding-set-hash-v1", "findingOwnerCount"],
  ["src/recovery/v3-downstream-evidence-publication.ts", "putFindingSet", "a-finding-v3-downstream-evidence-v1", "finding", "finding-set-hash-v1", "findingOwnerCount"],
  ["src/recovery/v3-evidence-only-publication.ts", "putFindingSetInTransaction", "a-finding-v3-evidence-only-v1", "finding", "finding-set-hash-v1", "findingOwnerCount"],
  ["src/execution/operational-outbox-repository.ts", "createOperationalOutboxRepository.publish", "a-operational-delivery-v1", "operational-delivery", "operational-event-key-consumer-v1", "operationalDeliveryCount"],
  ["src/db-pg.ts", "reserveRecoverySourceRunOwnerV1", "a-recovery-source-run-v1", "source-run", "source-bootstrap-operation-run-v1", "sourceRunOwnerCount"],
  ["src/db-pg.ts", "reserveRecoverySourceBootstrapRunOwnerV1", "a-recovery-source-bootstrap-run-v1", "run", "source-bootstrap-reciprocal-run-v1", "activeRunCount"],
] as const;

test("freezes the exact 35-category registry and complete 36-counter census mapping", () => {
  assert.deepEqual(INTERNAL_PRODUCTION_OWNER_CATEGORY_REGISTRY_V1, EXPECTED_CATEGORIES);
  assert.equal(new Set(INTERNAL_PRODUCTION_OWNER_CATEGORY_REGISTRY_V1).size, 35);
  assert.deepEqual(Object.keys(INTERNAL_PRODUCTION_OWNER_CATEGORY_CENSUS_MAP_V1), EXPECTED_CATEGORIES);
  assert.deepEqual(
    [...new Set(Object.values(INTERNAL_PRODUCTION_OWNER_CATEGORY_CENSUS_MAP_V1).flat())].sort(),
    [...EXPECTED_CENSUS_KEYS].sort(),
  );
  assert.equal(Object.values(INTERNAL_PRODUCTION_OWNER_CATEGORY_CENSUS_MAP_V1).flat().length, 36);
  assert.deepEqual(INTERNAL_PRODUCTION_OWNER_CATEGORY_CENSUS_MAP_V1["artifact-publication"], [
    "publicationBatchCount", "artifactPublicationCount",
  ]);
});

test("freezes and hashes the exact sixteen A producer rows", () => {
  assert.equal(INTERNAL_PRODUCTION_OWNER_PRODUCER_ROWS_A_V1.length, 16);
  assert.deepEqual(
    INTERNAL_PRODUCTION_OWNER_PRODUCER_ROWS_A_V1.map((row) => [
      row.module, row.function, row.implementationId, row.category,
      row.ownerKeyDerivationId, row.censusKeys.join(","),
    ]),
    EXPECTED_A_TUPLES,
  );
  assert.deepEqual(
    INTERNAL_PRODUCTION_OWNER_PRODUCER_MANIFEST_A_V1.manifestHash,
    hashCanonicalJson({
      schema: "setfarm.internal-production-owner-producer-manifest.v1",
      plan: "A",
      rows: INTERNAL_PRODUCTION_OWNER_PRODUCER_ROWS_A_V1,
    }),
  );
  assert.deepEqual(
    validateInternalProductionOwnerProducerManifestV1(
      INTERNAL_PRODUCTION_OWNER_PRODUCER_MANIFEST_A_V1,
    ),
    INTERNAL_PRODUCTION_OWNER_PRODUCER_MANIFEST_A_V1,
  );
});

test("pins run persistence readiness to the exact current A manifest", async () => {
  const source = await readFile(new URL("../../src/db-pg.ts", import.meta.url), "utf8");
  const matches = [...source.matchAll(/const WORKFLOW_RUN_MANIFEST_A_HASH_V1 =\s*"([a-f0-9]{64})";/g)];
  assert.equal(matches.length, 1);
  const pinned = matches[0]![1];
  assert.equal(pinned, "470fae4c76397f54be2adfeaeec14adca9afe062a855833a50034b16aff975db");
  assert.equal(pinned, INTERNAL_PRODUCTION_OWNER_PRODUCER_MANIFEST_A_V1.manifestHash);
});

test("validates the stable source pair and schema-domain-separated activation chain", () => {
  assert.equal(INTERNAL_PRODUCTION_OWNER_CATEGORY_REGISTRY_HASH_V1, hashCanonicalJson({
    schema: "setfarm.internal-production-owner-category-registry.v1",
    categories: INTERNAL_PRODUCTION_OWNER_CATEGORY_REGISTRY_V1,
  }));
  assert.equal(INTERNAL_PRODUCTION_OWNER_CATEGORY_CENSUS_MAP_HASH_V1, hashCanonicalJson({
    schema: "setfarm.internal-production-owner-category-census-map.v1",
    entries: INTERNAL_PRODUCTION_OWNER_CATEGORY_REGISTRY_V1.map((category) => ({
      category,
      censusKeys: INTERNAL_PRODUCTION_OWNER_CATEGORY_CENSUS_MAP_V1[category],
    })),
  }));
  const source = validateInternalProductionOwnerProducerSourceBuildAuthorityPairV1({
    plan: "A",
    sourceBuildAuthorityRef:
      `setfarm://internal-production/owner-producer-source-build-authority/A/sha256/${SHA_A}`,
    sourceBuildAuthorityHash: SHA_A,
  });
  const manifestSetHash = hashCanonicalJson({
    schema: "setfarm.internal-production-owner-producer-manifest-set.v1",
    phase: "A",
    orderedPlans: ["A"],
    orderedManifestHashes: [INTERNAL_PRODUCTION_OWNER_PRODUCER_MANIFEST_A_V1.manifestHash],
    orderedSourceBuildAuthorities: [source],
    ownerCategoryRegistryHash: INTERNAL_PRODUCTION_OWNER_CATEGORY_REGISTRY_HASH_V1,
    ownerCategoryCensusMapHash: INTERNAL_PRODUCTION_OWNER_CATEGORY_CENSUS_MAP_HASH_V1,
  });
  const receiptBody = {
    schema: "setfarm.internal-production-owner-producer-manifest-set-activation.v1" as const,
    phase: "A" as const,
    orderedPlans: ["A"] as const,
    orderedManifestHashes: [INTERNAL_PRODUCTION_OWNER_PRODUCER_MANIFEST_A_V1.manifestHash],
    orderedSourceBuildAuthorities: [source],
    manifestSetHash,
    ownerCategoryRegistryHash: INTERNAL_PRODUCTION_OWNER_CATEGORY_REGISTRY_HASH_V1,
    ownerCategoryCensusMapHash: INTERNAL_PRODUCTION_OWNER_CATEGORY_CENSUS_MAP_HASH_V1,
    predecessorActivationRef: null,
    predecessorActivationHash: null,
    predecessorHeadRef: null,
    predecessorHeadHash: null,
  };
  const activationHash = hashCanonicalJson(receiptBody);
  const receipt = validateInternalProductionOwnerProducerManifestSetActivationReceiptV1({
    ...receiptBody,
    activationRef:
      `setfarm://internal-production/owner-producer-manifest-set-activation/sha256/${activationHash}`,
    activationHash,
  });
  const headBody = {
    schema: "setfarm.internal-production-owner-producer-manifest-set-activation-head.v1" as const,
    phase: "A" as const,
    activationRef: receipt.activationRef,
    activationHash: receipt.activationHash,
    predecessorHeadRef: null,
    predecessorHeadHash: null,
  };
  const headHash = hashCanonicalJson(headBody);
  const head = validateInternalProductionOwnerProducerManifestSetActivationHeadV1({
    ...headBody,
    headRef:
      `setfarm://internal-production/owner-producer-manifest-set-activation-head/sha256/${headHash}`,
    headHash,
  });
  const current = validateInternalProductionOwnerProducerManifestSetActivationCurrentV1({
    currentRevision: 1,
    head,
    receipt,
  });
  assert.equal(current.currentRevision, 1);
  assertDeepFrozen(current, "activation current");

  assert.throws(
    () => validateInternalProductionOwnerProducerSourceBuildAuthorityPairV1({
      ...source,
      plan: "B",
    }),
    /SOURCE_BUILD_AUTHORITY_REF_INVALID/,
  );
  assert.throws(
    () => validateInternalProductionOwnerProducerManifestSetActivationReceiptV1({
      ...receipt,
      activationHash: SHA_B,
    }),
    /ACTIVATION_DERIVATION_INVALID/,
  );
  assert.throws(
    () => validateInternalProductionOwnerProducerManifestSetActivationCurrentV1({
      currentRevision: 1,
      head: { ...head, activationHash: SHA_B },
      receipt,
    }),
    /ACTIVATION_HEAD_DERIVATION_INVALID|ACTIVATION_CURRENT_PAIR_INVALID/,
  );
});

test("manifest validation is strict and rejects hash, census, duplicate, and A-row drift", () => {
  const manifest = structuredClone(INTERNAL_PRODUCTION_OWNER_PRODUCER_MANIFEST_A_V1);
  assert.throws(
    () => validateInternalProductionOwnerProducerManifestV1({ ...manifest, extra: true }),
    /MANIFEST_KEYS_INVALID/,
  );
  assert.throws(
    () => validateInternalProductionOwnerProducerManifestV1({ ...manifest, manifestHash: SHA_A }),
    /MANIFEST_HASH_INVALID/,
  );
  const wrongCensus = structuredClone(manifest);
  // @ts-expect-error runtime rejection fixture deliberately mutates readonly caller input
  wrongCensus.rows[0]!.censusKeys = ["openClaimCount"];
  // @ts-expect-error runtime rejection fixture deliberately mutates readonly caller input
  wrongCensus.manifestHash = hashCanonicalJson({ schema: wrongCensus.schema, plan: wrongCensus.plan, rows: wrongCensus.rows });
  assert.throws(() => validateInternalProductionOwnerProducerManifestV1(wrongCensus), /ROW_CENSUS_KEYS_INVALID/);
  const duplicate = structuredClone(manifest);
  // @ts-expect-error runtime rejection fixture deliberately mutates readonly caller input
  duplicate.rows[1]!.implementationId = duplicate.rows[0]!.implementationId;
  // @ts-expect-error runtime rejection fixture deliberately mutates readonly caller input
  duplicate.manifestHash = hashCanonicalJson({ schema: duplicate.schema, plan: duplicate.plan, rows: duplicate.rows });
  assert.throws(() => validateInternalProductionOwnerProducerManifestV1(duplicate), /IMPLEMENTATION_ID_DUPLICATE/);
  const reorderedA = structuredClone(manifest);
  // @ts-expect-error runtime rejection fixture deliberately mutates readonly caller input
  reorderedA.rows.reverse();
  // @ts-expect-error runtime rejection fixture deliberately mutates readonly caller input
  reorderedA.manifestHash = hashCanonicalJson({ schema: reorderedA.schema, plan: reorderedA.plan, rows: reorderedA.rows });
  assert.throws(() => validateInternalProductionOwnerProducerManifestV1(reorderedA), /PLAN_A_ROWS_INVALID/);
});

function syntheticManifest(
  plan: "B" | "C" | "D" | "E",
  count: number,
): InternalProductionOwnerProducerManifestV1 {
  const rows: InternalProductionOwnerProducerRowV1[] = Array.from({ length: count }, (_, index) => {
    const category = EXPECTED_CATEGORIES[(index + plan.charCodeAt(0)) % EXPECTED_CATEGORIES.length]!;
    return {
      plan,
      module: `src/${plan.toLowerCase()}/producer-${index}.ts`,
      function: `produce${plan}${index}`,
      implementationId: `${plan.toLowerCase()}-producer-${index}-v1`,
      category,
      ownerKeyDerivationId: `${plan.toLowerCase()}-owner-key-${index}-v1`,
      censusKeys: INTERNAL_PRODUCTION_OWNER_CATEGORY_CENSUS_MAP_V1[category],
    };
  });
  return {
    schema: "setfarm.internal-production-owner-producer-manifest.v1",
    plan,
    rows,
    manifestHash: hashCanonicalJson({
      schema: "setfarm.internal-production-owner-producer-manifest.v1", plan, rows,
    }),
  };
}

test("assembles only the ordered 16/10/6/16/9 five-plan registry", () => {
  const manifests = [
    INTERNAL_PRODUCTION_OWNER_PRODUCER_MANIFEST_A_V1,
    syntheticManifest("B", 10), syntheticManifest("C", 6),
    syntheticManifest("D", 16), syntheticManifest("E", 9),
  ] as const;
  const assembled = assembleInternalProductionOwnerProducerRegistryV1({ manifests });
  assert.equal(assembled.rows.length, 57);
  assert.equal(assembled.registryHash, hashCanonicalJson({
    schema: "setfarm.internal-production-owner-producer-registry.v1",
    rows: assembled.rows,
  }));
  const wrong = [...manifests] as unknown as [
    InternalProductionOwnerProducerManifestV1,
    InternalProductionOwnerProducerManifestV1,
    InternalProductionOwnerProducerManifestV1,
    InternalProductionOwnerProducerManifestV1,
    InternalProductionOwnerProducerManifestV1,
  ];
  wrong[2] = syntheticManifest("C", 5);
  assert.throws(() => assembleInternalProductionOwnerProducerRegistryV1({ manifests: wrong }), /MANIFEST_ROW_COUNT_INVALID/);
});

function reservationFixture() {
  const row = INTERNAL_PRODUCTION_OWNER_PRODUCER_ROWS_A_V1[0];
  const reservation = createInternalProductionOwnerReservationV1({
    producer: row,
    ownerKey: "run-owner-admission-test-1",
    ownerAdmissionHeadPredecessorHash: SHA_A,
  });
  const identity: InternalProductionCanonicalOwnerIdentityV1<"run"> = {
    schema: "setfarm.internal-production-canonical-owner-identity.v1",
    category: "run",
    ownerKey: reservation.ownerKey,
    ownerRef: "setfarm://runs/run-owner-admission-test-1",
    ownerHash: SHA_B,
  };
  const bound = createInternalProductionBoundOwnerReservationV1({
    reservation,
    canonicalOwnerIdentity: identity,
  });
  const terminal = createInternalProductionTerminalOwnerAuthorityV1({
    canonicalOwnerIdentity: identity,
    terminalOwnerRef: "setfarm://runs/run-owner-admission-test-1/terminal/completed",
    terminalOwnerHash: SHA_C,
  });
  return { row, reservation, identity, bound, terminal };
}

function exactAsciiRef(length: number): string {
  const prefix = "setfarm://tests/";
  assert.ok(length >= prefix.length);
  return `${prefix}${"x".repeat(length - prefix.length)}`;
}

test("owner-core applies only the three exact P3 field maxima and preserves every 4000 default", () => {
  const row = INTERNAL_PRODUCTION_OWNER_PRODUCER_ROWS_A_V1[0];
  const reservationForOwnerKey = (length: number) => createInternalProductionOwnerReservationV1({
    producer: row,
    ownerKey: "k".repeat(length),
    ownerAdmissionHeadPredecessorHash: SHA_A,
  });

  for (const length of [8_461, 8_462]) {
    const reservation = reservationForOwnerKey(length);
    assert.equal(reservation.ownerKey.length, length);
    assert.equal(validateInternalProductionOwnerReservationV1(reservation, row).ownerKey.length, length);
    const identity: InternalProductionCanonicalOwnerIdentityV1<"run"> = {
      schema: "setfarm.internal-production-canonical-owner-identity.v1",
      category: "run",
      ownerKey: reservation.ownerKey,
      ownerRef: "setfarm://tests/owner-key-boundary",
      ownerHash: SHA_B,
    };
    assert.equal(
      ownerAdmissionApi.validateInternalProductionCanonicalOwnerIdentityV1(identity).ownerKey.length,
      length,
    );
    const bound = createInternalProductionBoundOwnerReservationV1({
      reservation,
      canonicalOwnerIdentity: identity,
    });
    assert.equal(validateInternalProductionBoundOwnerReservationV1(bound).ownerKey.length, length);
    const terminal = createInternalProductionTerminalOwnerAuthorityV1({
      canonicalOwnerIdentity: identity,
      terminalOwnerRef: "setfarm://tests/owner-key-boundary/terminal/completed",
      terminalOwnerHash: SHA_C,
    });
    const authenticatedTerminal = validateInternalProductionTerminalOwnerAuthorityV1(terminal);
    assert.equal(authenticatedTerminal.ownerKey.length, length);
    const terminalPair = deriveInternalProductionTerminalOwnerAuthorityPairV1(terminal);
    assert.deepEqual(
      validateInternalProductionTerminalOwnerAuthorityPairV1(terminalPair, terminal),
      terminalPair,
    );
    const close = createInternalProductionOwnerReservationCloseV1({
      closeKind: "ordinary",
      boundReservation: bound,
      terminalAuthority: terminal,
      ownerAdmissionHeadPredecessorHash: SHA_A,
      ownerAdmissionHeadSuccessorHash: SHA_B,
      preservedFenceRef: null,
      preservedFenceHash: null,
    });
    assert.equal(validateInternalProductionOwnerReservationCloseV1(close).terminalOwnerRef,
      terminal.terminalOwnerRef);
  }
  assert.throws(() => reservationForOwnerKey(8_463), /OWNER_KEY_INVALID/);

  const shortReservation = reservationForOwnerKey(32);
  for (const length of [12_498, 12_499]) {
    const ownerRef = exactAsciiRef(length);
    const identity: InternalProductionCanonicalOwnerIdentityV1<"run"> = {
      schema: "setfarm.internal-production-canonical-owner-identity.v1",
      category: "run",
      ownerKey: shortReservation.ownerKey,
      ownerRef,
      ownerHash: SHA_B,
    };
    assert.equal(ownerAdmissionApi.validateInternalProductionCanonicalOwnerIdentityV1(identity).ownerRef.length,
      length);
    const bound = createInternalProductionBoundOwnerReservationV1({
      reservation: shortReservation,
      canonicalOwnerIdentity: identity,
    });
    assert.equal(
      validateInternalProductionBoundOwnerReservationV1(bound).canonicalOwnerIdentity.ownerRef.length,
      length,
    );
    const terminal = createInternalProductionTerminalOwnerAuthorityV1({
      canonicalOwnerIdentity: identity,
      terminalOwnerRef: "setfarm://tests/owner-ref-boundary/terminal/completed",
      terminalOwnerHash: SHA_C,
    });
    assert.equal(validateInternalProductionTerminalOwnerAuthorityV1(terminal).ownerRef.length, length);
    const pair = deriveInternalProductionTerminalOwnerAuthorityPairV1(terminal);
    assert.deepEqual(validateInternalProductionTerminalOwnerAuthorityPairV1(pair, terminal), pair);
    const close = createInternalProductionOwnerReservationCloseV1({
      closeKind: "ordinary",
      boundReservation: bound,
      terminalAuthority: terminal,
      ownerAdmissionHeadPredecessorHash: SHA_A,
      ownerAdmissionHeadSuccessorHash: SHA_B,
      preservedFenceRef: null,
      preservedFenceHash: null,
    });
    assert.equal(validateInternalProductionOwnerReservationCloseV1(close).terminalOwnerRef,
      terminal.terminalOwnerRef);
  }
  assert.throws(
    () => ownerAdmissionApi.validateInternalProductionCanonicalOwnerIdentityV1({
      schema: "setfarm.internal-production-canonical-owner-identity.v1",
      category: "run",
      ownerKey: shortReservation.ownerKey,
      ownerRef: exactAsciiRef(12_500),
      ownerHash: SHA_B,
    }),
    /OWNER_REF_INVALID/,
  );

  const shortIdentity: InternalProductionCanonicalOwnerIdentityV1<"run"> = {
    schema: "setfarm.internal-production-canonical-owner-identity.v1",
    category: "run",
    ownerKey: shortReservation.ownerKey,
    ownerRef: "setfarm://tests/terminal-ref-boundary",
    ownerHash: SHA_B,
  };
  const shortBound = createInternalProductionBoundOwnerReservationV1({
    reservation: shortReservation,
    canonicalOwnerIdentity: shortIdentity,
  });
  for (const length of [12_518, 12_519]) {
    const terminal = createInternalProductionTerminalOwnerAuthorityV1({
      canonicalOwnerIdentity: shortIdentity,
      terminalOwnerRef: exactAsciiRef(length),
      terminalOwnerHash: SHA_C,
    });
    assert.equal(validateInternalProductionTerminalOwnerAuthorityV1(terminal).terminalOwnerRef.length,
      length);
    const pair = deriveInternalProductionTerminalOwnerAuthorityPairV1(terminal);
    assert.deepEqual(validateInternalProductionTerminalOwnerAuthorityPairV1(pair, terminal), pair);
    const close = createInternalProductionOwnerReservationCloseV1({
      closeKind: "ordinary",
      boundReservation: shortBound,
      terminalAuthority: terminal,
      ownerAdmissionHeadPredecessorHash: SHA_A,
      ownerAdmissionHeadSuccessorHash: SHA_B,
      preservedFenceRef: null,
      preservedFenceHash: null,
    });
    assert.equal(validateInternalProductionOwnerReservationCloseV1(close).terminalOwnerRef.length,
      length);
  }
  assert.throws(
    () => createInternalProductionTerminalOwnerAuthorityV1({
      canonicalOwnerIdentity: shortIdentity,
      terminalOwnerRef: exactAsciiRef(12_520),
      terminalOwnerHash: SHA_C,
    }),
    /TERMINAL_OWNER_REF_INVALID/,
  );

  const tooLongGeneric = "g".repeat(4_001);
  assert.throws(
    () => createInternalProductionOwnerReservationV1({
      producer: { ...row, implementationId: tooLongGeneric },
      ownerKey: "short-owner",
      ownerAdmissionHeadPredecessorHash: SHA_A,
    }),
    /IMPLEMENTATION_ID_INVALID/,
  );
  assert.throws(
    () => validateInternalProductionOwnerReservationV1({
      ...shortReservation,
      reservationRef: exactAsciiRef(4_001),
    }, row),
    /RESERVATION_REF_INVALID/,
  );
  assert.throws(
    () => createInternalProductionOwnerReservationCloseV1({
      closeKind: "fence-target",
      boundReservation: shortBound,
      terminalAuthority: createInternalProductionTerminalOwnerAuthorityV1({
        canonicalOwnerIdentity: shortIdentity,
        terminalOwnerRef: "setfarm://tests/short-terminal",
        terminalOwnerHash: SHA_C,
      }),
      ownerAdmissionHeadPredecessorHash: SHA_A,
      ownerAdmissionHeadSuccessorHash: SHA_B,
      preservedFenceRef: exactAsciiRef(4_001),
      preservedFenceHash: SHA_C,
    }),
    /PRESERVED_FENCE_REF_INVALID/,
  );

  for (const field of ["module", "function", "implementationId", "ownerKeyDerivationId"] as const) {
    const rows = structuredClone(INTERNAL_PRODUCTION_OWNER_PRODUCER_ROWS_A_V1) as unknown as
      Array<Record<string, unknown>>;
    rows[0]![field] = tooLongGeneric;
    assert.throws(
      () => validateInternalProductionOwnerProducerManifestV1({
        schema: "setfarm.internal-production-owner-producer-manifest.v1",
        plan: "A",
        rows,
        manifestHash: hashCanonicalJson({
          schema: "setfarm.internal-production-owner-producer-manifest.v1",
          plan: "A",
          rows,
        }),
      }),
      /OWNER_PRODUCER_ROW_.*INVALID/,
    );
  }
  assert.throws(
    () => validateInternalProductionOwnerReservationV1({
      ...shortReservation,
      producerImplementationId: tooLongGeneric,
    }, row),
    /PRODUCER_IMPLEMENTATION_ID_INVALID/,
  );
  assert.throws(
    () => createInternalProductionBoundOwnerReservationV1({
      reservation: { ...shortReservation, reservationRef: exactAsciiRef(4_001) },
      canonicalOwnerIdentity: shortIdentity,
    }),
    /RESERVATION_REF_INVALID/,
  );
  assert.throws(
    () => validateInternalProductionBoundOwnerReservationV1({
      ...shortBound,
      producerImplementationId: tooLongGeneric,
    }),
    /IMPLEMENTATION_ID_INVALID/,
  );
  assert.throws(
    () => validateInternalProductionBoundOwnerReservationV1({
      ...shortBound,
      reservationRef: exactAsciiRef(4_001),
    }),
    /RESERVATION_REF_INVALID/,
  );
  const shortTerminal = createInternalProductionTerminalOwnerAuthorityV1({
    canonicalOwnerIdentity: shortIdentity,
    terminalOwnerRef: "setfarm://tests/default-terminal",
    terminalOwnerHash: SHA_C,
  });
  const shortPair = deriveInternalProductionTerminalOwnerAuthorityPairV1(shortTerminal);
  assert.throws(
    () => validateInternalProductionTerminalOwnerAuthorityPairV1({
      ...shortPair,
      terminalAuthorityRef: exactAsciiRef(4_001),
    }, shortTerminal),
    /PAIR_REF_INVALID/,
  );
  const shortClose = createInternalProductionOwnerReservationCloseV1({
    closeKind: "ordinary",
    boundReservation: shortBound,
    terminalAuthority: shortTerminal,
    ownerAdmissionHeadPredecessorHash: SHA_A,
    ownerAdmissionHeadSuccessorHash: SHA_B,
    preservedFenceRef: null,
    preservedFenceHash: null,
  });
  assert.throws(
    () => validateInternalProductionOwnerReservationCloseV1({
      ...shortClose,
      closeRef: exactAsciiRef(4_001),
    }),
    /CLOSE_REF_INVALID/,
  );
  assert.throws(
    () => validateInternalProductionOwnerReservationCloseV1({
      ...shortClose,
      reservationRef: exactAsciiRef(4_001),
    }),
    /RESERVATION_REF_INVALID/,
  );
  const fenceClose = createInternalProductionOwnerReservationCloseV1({
    closeKind: "fence-target",
    boundReservation: shortBound,
    terminalAuthority: shortTerminal,
    ownerAdmissionHeadPredecessorHash: SHA_A,
    ownerAdmissionHeadSuccessorHash: SHA_B,
    preservedFenceRef: "setfarm://tests/preserved-fence",
    preservedFenceHash: SHA_C,
  });
  assert.throws(
    () => validateInternalProductionOwnerReservationCloseV1({
      ...fenceClose,
      preservedFenceRef: exactAsciiRef(4_001),
    }),
    /PRESERVED_FENCE_REF_INVALID/,
  );

  assert.throws(
    () => validateInternalProductionOwnerProducerSourceBuildAuthorityV1({
      ...authorityA(),
      currentEntryOperationRef: exactAsciiRef(4_001),
    }),
    /SOURCE_BUILD_AUTHORITY_A_OPERATION_INVALID/,
  );
  const sourcePairs = (["A", "B"] as const).map((plan, index) => ({
    plan,
    sourceBuildAuthorityRef:
      `setfarm://internal-production/owner-producer-source-build-authority/${plan}/sha256/${index === 0 ? SHA_A : SHA_B}`,
    sourceBuildAuthorityHash: index === 0 ? SHA_A : SHA_B,
  }));
  const predecessorManifestSetHash = hashCanonicalJson({
    schema: "setfarm.internal-production-owner-producer-manifest-set.v1",
    phase: "A+B",
    orderedPlans: ["A", "B"],
    orderedManifestHashes: [
      INTERNAL_PRODUCTION_OWNER_PRODUCER_MANIFEST_A_V1.manifestHash,
      SHA_C,
    ],
    orderedSourceBuildAuthorities: sourcePairs,
    ownerCategoryRegistryHash: INTERNAL_PRODUCTION_OWNER_CATEGORY_REGISTRY_HASH_V1,
    ownerCategoryCensusMapHash: INTERNAL_PRODUCTION_OWNER_CATEGORY_CENSUS_MAP_HASH_V1,
  });
  const predecessorReceipt = {
    schema: "setfarm.internal-production-owner-producer-manifest-set-activation.v1",
    phase: "A+B",
    orderedPlans: ["A", "B"],
    orderedManifestHashes: [
      INTERNAL_PRODUCTION_OWNER_PRODUCER_MANIFEST_A_V1.manifestHash,
      SHA_C,
    ],
    orderedSourceBuildAuthorities: sourcePairs,
    manifestSetHash: predecessorManifestSetHash,
    ownerCategoryRegistryHash: INTERNAL_PRODUCTION_OWNER_CATEGORY_REGISTRY_HASH_V1,
    ownerCategoryCensusMapHash: INTERNAL_PRODUCTION_OWNER_CATEGORY_CENSUS_MAP_HASH_V1,
    predecessorActivationRef: "setfarm://tests/predecessor-activation",
    predecessorActivationHash: SHA_A,
    predecessorHeadRef: "setfarm://tests/predecessor-head",
    predecessorHeadHash: SHA_B,
    activationRef: "setfarm://tests/activation",
    activationHash: SHA_C,
  };
  for (const field of ["predecessorActivationRef", "predecessorHeadRef"] as const) {
    assert.throws(
      () => validateInternalProductionOwnerProducerManifestSetActivationReceiptV1({
        ...predecessorReceipt,
        [field]: exactAsciiRef(4_001),
      }),
      /ACTIVATION_PREDECESSOR_INVALID/,
    );
  }
  assert.throws(
    () => validateInternalProductionOwnerProducerManifestSetActivationHeadV1({
      schema: "setfarm.internal-production-owner-producer-manifest-set-activation-head.v1",
      phase: "A",
      activationRef: exactAsciiRef(4_001),
      activationHash: SHA_A,
      predecessorHeadRef: null,
      predecessorHeadHash: null,
      headRef: "setfarm://tests/head",
      headHash: SHA_B,
    }),
    /HEAD_ACTIVATION_REF_INVALID/,
  );
  assert.throws(
    () => validateInternalProductionOwnerProducerManifestSetActivationHeadV1({
      schema: "setfarm.internal-production-owner-producer-manifest-set-activation-head.v1",
      phase: "A+B",
      activationRef: "setfarm://tests/activation",
      activationHash: SHA_A,
      predecessorHeadRef: exactAsciiRef(4_001),
      predecessorHeadHash: SHA_B,
      headRef: "setfarm://tests/head",
      headHash: SHA_C,
    }),
    /HEAD_PREDECESSOR_INVALID/,
  );
});

test("every owner maximum is forged independently at each construction and authentication site", () => {
  const row = INTERNAL_PRODUCTION_OWNER_PRODUCER_ROWS_A_V1[0];
  const shortReservation = createInternalProductionOwnerReservationV1({
    producer: row,
    ownerKey: "task2-independent-owner",
    ownerAdmissionHeadPredecessorHash: SHA_A,
  });
  const identity = (
    ownerKeyLength = shortReservation.ownerKey.length,
    ownerRefLength = "setfarm://tests/independent-owner".length,
  ): InternalProductionCanonicalOwnerIdentityV1<"run"> => ({
    schema: "setfarm.internal-production-canonical-owner-identity.v1",
    category: "run",
    ownerKey: ownerKeyLength === shortReservation.ownerKey.length
      ? shortReservation.ownerKey
      : "k".repeat(ownerKeyLength),
    ownerRef: ownerRefLength === "setfarm://tests/independent-owner".length
      ? "setfarm://tests/independent-owner"
      : exactAsciiRef(ownerRefLength),
    ownerHash: SHA_B,
  });
  const shortIdentity = identity();
  const shortBound = createInternalProductionBoundOwnerReservationV1({
    reservation: shortReservation,
    canonicalOwnerIdentity: shortIdentity,
  });
  const shortTerminal = createInternalProductionTerminalOwnerAuthorityV1({
    canonicalOwnerIdentity: shortIdentity,
    terminalOwnerRef: "setfarm://tests/independent-owner/terminal/completed",
    terminalOwnerHash: SHA_C,
  });
  const shortPair = deriveInternalProductionTerminalOwnerAuthorityPairV1(shortTerminal);
  const shortClose = createInternalProductionOwnerReservationCloseV1({
    closeKind: "ordinary",
    boundReservation: shortBound,
    terminalAuthority: shortTerminal,
    ownerAdmissionHeadPredecessorHash: SHA_A,
    ownerAdmissionHeadSuccessorHash: SHA_B,
    preservedFenceRef: null,
    preservedFenceHash: null,
  });
  const assertBoundarySite = (
    field: string,
    site: string,
    maximum: number,
    invoke: (length: number) => unknown,
    overError: RegExp,
  ) => {
    for (const length of [maximum - 1, maximum]) {
      assert.doesNotThrow(() => invoke(length), `${field} ${site} length ${length}`);
    }
    assert.throws(
      () => invoke(maximum + 1),
      overError,
      `${field} ${site} length ${maximum + 1}`,
    );
  };

  const ownerKeySites = [
    ["reservation construction", (length: number) => (
      createInternalProductionOwnerReservationV1({
        producer: row,
        ownerKey: "k".repeat(length),
        ownerAdmissionHeadPredecessorHash: SHA_A,
      })
    ), /OWNER_KEY_INVALID/],
    ["reservation authentication", (length: number) => (
      validateInternalProductionOwnerReservationV1(
        length <= 8_462
          ? createInternalProductionOwnerReservationV1({
            producer: row,
            ownerKey: "k".repeat(length),
            ownerAdmissionHeadPredecessorHash: SHA_A,
          })
          : { ...shortReservation, ownerKey: "k".repeat(length) },
        row,
      )
    ), /OWNER_KEY_INVALID/],
    ["canonical authentication", (length: number) => (
      ownerAdmissionApi.validateInternalProductionCanonicalOwnerIdentityV1(identity(length))
    ), /OWNER_KEY_INVALID/],
    ["bound construction", (length: number) => {
      const canonical = identity(length);
      const reservation = length <= 8_462
        ? createInternalProductionOwnerReservationV1({
          producer: row,
          ownerKey: canonical.ownerKey,
          ownerAdmissionHeadPredecessorHash: SHA_A,
        })
        : { ...shortReservation, ownerKey: canonical.ownerKey };
      return createInternalProductionBoundOwnerReservationV1({
        reservation: reservation as never,
        canonicalOwnerIdentity: canonical,
      });
    }, /OWNER_KEY_INVALID/],
    ["bound authentication", (length: number) => {
      if (length <= 8_462) {
        const reservation = createInternalProductionOwnerReservationV1({
          producer: row,
          ownerKey: "k".repeat(length),
          ownerAdmissionHeadPredecessorHash: SHA_A,
        });
        return validateInternalProductionBoundOwnerReservationV1(
          createInternalProductionBoundOwnerReservationV1({
            reservation,
            canonicalOwnerIdentity: identity(length),
          }),
        );
      }
      return validateInternalProductionBoundOwnerReservationV1({
        ...shortBound,
        ownerKey: "k".repeat(length),
      });
    }, /OWNER_KEY_INVALID/],
    ["terminal construction", (length: number) => (
      createInternalProductionTerminalOwnerAuthorityV1({
        canonicalOwnerIdentity: identity(length),
        terminalOwnerRef: shortTerminal.terminalOwnerRef,
        terminalOwnerHash: SHA_C,
      })
    ), /OWNER_KEY_INVALID/],
    ["terminal authentication", (length: number) => (
      validateInternalProductionTerminalOwnerAuthorityV1(
        length <= 8_462
          ? createInternalProductionTerminalOwnerAuthorityV1({
            canonicalOwnerIdentity: identity(length),
            terminalOwnerRef: shortTerminal.terminalOwnerRef,
            terminalOwnerHash: SHA_C,
          })
          : { ...shortTerminal, ownerKey: "k".repeat(length) },
      )
    ), /OWNER_KEY_INVALID/],
    ["pair construction", (length: number) => (
      deriveInternalProductionTerminalOwnerAuthorityPairV1(
        length <= 8_462
          ? createInternalProductionTerminalOwnerAuthorityV1({
            canonicalOwnerIdentity: identity(length),
            terminalOwnerRef: shortTerminal.terminalOwnerRef,
            terminalOwnerHash: SHA_C,
          })
          : { ...shortTerminal, ownerKey: "k".repeat(length) },
      )
    ), /OWNER_KEY_INVALID/],
    ["pair authentication", (length: number) => {
      const terminal = length <= 8_462
        ? createInternalProductionTerminalOwnerAuthorityV1({
          canonicalOwnerIdentity: identity(length),
          terminalOwnerRef: shortTerminal.terminalOwnerRef,
          terminalOwnerHash: SHA_C,
        })
        : { ...shortTerminal, ownerKey: "k".repeat(length) };
      const pair = length <= 8_462
        ? deriveInternalProductionTerminalOwnerAuthorityPairV1(terminal as never)
        : shortPair;
      return validateInternalProductionTerminalOwnerAuthorityPairV1(pair, terminal as never);
    }, /OWNER_KEY_INVALID/],
    ["close construction authentication", (length: number) => {
      if (length <= 8_462) {
        const reservation = createInternalProductionOwnerReservationV1({
          producer: row,
          ownerKey: "k".repeat(length),
          ownerAdmissionHeadPredecessorHash: SHA_A,
        });
        const canonical = identity(length);
        const bound = createInternalProductionBoundOwnerReservationV1({
          reservation,
          canonicalOwnerIdentity: canonical,
        });
        const terminal = createInternalProductionTerminalOwnerAuthorityV1({
          canonicalOwnerIdentity: canonical,
          terminalOwnerRef: shortTerminal.terminalOwnerRef,
          terminalOwnerHash: SHA_C,
        });
        return createInternalProductionOwnerReservationCloseV1({
          closeKind: "ordinary", boundReservation: bound, terminalAuthority: terminal,
          ownerAdmissionHeadPredecessorHash: SHA_A,
          ownerAdmissionHeadSuccessorHash: SHA_B,
          preservedFenceRef: null, preservedFenceHash: null,
        });
      }
      return createInternalProductionOwnerReservationCloseV1({
        closeKind: "ordinary",
        boundReservation: { ...shortBound, ownerKey: "k".repeat(length) },
        terminalAuthority: { ...shortTerminal, ownerKey: "k".repeat(length) },
        ownerAdmissionHeadPredecessorHash: SHA_A,
        ownerAdmissionHeadSuccessorHash: SHA_B,
        preservedFenceRef: null,
        preservedFenceHash: null,
      });
    }, /OWNER_KEY_INVALID/],
  ] as const;
  for (const [site, invoke, error] of ownerKeySites) {
    assertBoundarySite("ownerKey", site, 8_462, invoke, error);
  }

  const ownerRefIdentity = (length: number) => identity(
    shortReservation.ownerKey.length,
    length,
  );
  const ownerRefSites = [
    ["canonical authentication", (length: number) => (
      ownerAdmissionApi.validateInternalProductionCanonicalOwnerIdentityV1(
        ownerRefIdentity(length),
      )
    )],
    ["bound construction", (length: number) => (
      createInternalProductionBoundOwnerReservationV1({
        reservation: shortReservation,
        canonicalOwnerIdentity: ownerRefIdentity(length),
      })
    )],
    ["bound authentication", (length: number) => {
      if (length <= 12_499) {
        return validateInternalProductionBoundOwnerReservationV1(
          createInternalProductionBoundOwnerReservationV1({
            reservation: shortReservation,
            canonicalOwnerIdentity: ownerRefIdentity(length),
          }),
        );
      }
      return validateInternalProductionBoundOwnerReservationV1({
        ...shortBound,
        canonicalOwnerIdentity: ownerRefIdentity(length),
      });
    }],
    ["terminal construction", (length: number) => (
      createInternalProductionTerminalOwnerAuthorityV1({
        canonicalOwnerIdentity: ownerRefIdentity(length),
        terminalOwnerRef: shortTerminal.terminalOwnerRef,
        terminalOwnerHash: SHA_C,
      })
    )],
    ["terminal authentication", (length: number) => (
      validateInternalProductionTerminalOwnerAuthorityV1(
        length <= 12_499
          ? createInternalProductionTerminalOwnerAuthorityV1({
            canonicalOwnerIdentity: ownerRefIdentity(length),
            terminalOwnerRef: shortTerminal.terminalOwnerRef,
            terminalOwnerHash: SHA_C,
          })
          : { ...shortTerminal, ownerRef: exactAsciiRef(length) },
      )
    )],
    ["pair construction", (length: number) => (
      deriveInternalProductionTerminalOwnerAuthorityPairV1(
        length <= 12_499
          ? createInternalProductionTerminalOwnerAuthorityV1({
            canonicalOwnerIdentity: ownerRefIdentity(length),
            terminalOwnerRef: shortTerminal.terminalOwnerRef,
            terminalOwnerHash: SHA_C,
          })
          : { ...shortTerminal, ownerRef: exactAsciiRef(length) },
      )
    )],
    ["pair authentication", (length: number) => {
      const terminal = length <= 12_499
        ? createInternalProductionTerminalOwnerAuthorityV1({
          canonicalOwnerIdentity: ownerRefIdentity(length),
          terminalOwnerRef: shortTerminal.terminalOwnerRef,
          terminalOwnerHash: SHA_C,
        })
        : { ...shortTerminal, ownerRef: exactAsciiRef(length) };
      const pair = length <= 12_499
        ? deriveInternalProductionTerminalOwnerAuthorityPairV1(terminal as never)
        : shortPair;
      return validateInternalProductionTerminalOwnerAuthorityPairV1(pair, terminal as never);
    }],
    ["close construction authentication", (length: number) => {
      if (length <= 12_499) {
        const canonical = ownerRefIdentity(length);
        return createInternalProductionOwnerReservationCloseV1({
          closeKind: "ordinary",
          boundReservation: createInternalProductionBoundOwnerReservationV1({
            reservation: shortReservation,
            canonicalOwnerIdentity: canonical,
          }),
          terminalAuthority: createInternalProductionTerminalOwnerAuthorityV1({
            canonicalOwnerIdentity: canonical,
            terminalOwnerRef: shortTerminal.terminalOwnerRef,
            terminalOwnerHash: SHA_C,
          }),
          ownerAdmissionHeadPredecessorHash: SHA_A,
          ownerAdmissionHeadSuccessorHash: SHA_B,
          preservedFenceRef: null,
          preservedFenceHash: null,
        });
      }
      return createInternalProductionOwnerReservationCloseV1({
        closeKind: "ordinary",
        boundReservation: {
          ...shortBound,
          canonicalOwnerIdentity: ownerRefIdentity(length),
        },
        terminalAuthority: { ...shortTerminal, ownerRef: exactAsciiRef(length) },
        ownerAdmissionHeadPredecessorHash: SHA_A,
        ownerAdmissionHeadSuccessorHash: SHA_B,
        preservedFenceRef: null,
        preservedFenceHash: null,
      });
    }],
  ] as const;
  for (const [site, invoke] of ownerRefSites) {
    assertBoundarySite("ownerRef", site, 12_499, invoke, /OWNER_REF_INVALID/);
  }

  const terminalRefSites = [
    ["terminal construction", (length: number) => (
      createInternalProductionTerminalOwnerAuthorityV1({
        canonicalOwnerIdentity: shortIdentity,
        terminalOwnerRef: exactAsciiRef(length),
        terminalOwnerHash: SHA_C,
      })
    )],
    ["terminal authentication", (length: number) => (
      validateInternalProductionTerminalOwnerAuthorityV1(
        length <= 12_519
          ? createInternalProductionTerminalOwnerAuthorityV1({
            canonicalOwnerIdentity: shortIdentity,
            terminalOwnerRef: exactAsciiRef(length),
            terminalOwnerHash: SHA_C,
          })
          : { ...shortTerminal, terminalOwnerRef: exactAsciiRef(length) },
      )
    )],
    ["pair construction", (length: number) => (
      deriveInternalProductionTerminalOwnerAuthorityPairV1(
        length <= 12_519
          ? createInternalProductionTerminalOwnerAuthorityV1({
            canonicalOwnerIdentity: shortIdentity,
            terminalOwnerRef: exactAsciiRef(length),
            terminalOwnerHash: SHA_C,
          })
          : { ...shortTerminal, terminalOwnerRef: exactAsciiRef(length) },
      )
    )],
    ["pair authentication", (length: number) => {
      const terminal = length <= 12_519
        ? createInternalProductionTerminalOwnerAuthorityV1({
          canonicalOwnerIdentity: shortIdentity,
          terminalOwnerRef: exactAsciiRef(length),
          terminalOwnerHash: SHA_C,
        })
        : { ...shortTerminal, terminalOwnerRef: exactAsciiRef(length) };
      const pair = length <= 12_519
        ? deriveInternalProductionTerminalOwnerAuthorityPairV1(terminal as never)
        : shortPair;
      return validateInternalProductionTerminalOwnerAuthorityPairV1(pair, terminal as never);
    }],
    ["close construction authentication", (length: number) => (
      createInternalProductionOwnerReservationCloseV1({
        closeKind: "ordinary",
        boundReservation: shortBound,
        terminalAuthority: length <= 12_519
          ? createInternalProductionTerminalOwnerAuthorityV1({
            canonicalOwnerIdentity: shortIdentity,
            terminalOwnerRef: exactAsciiRef(length),
            terminalOwnerHash: SHA_C,
          })
          : { ...shortTerminal, terminalOwnerRef: exactAsciiRef(length) },
        ownerAdmissionHeadPredecessorHash: SHA_A,
        ownerAdmissionHeadSuccessorHash: SHA_B,
        preservedFenceRef: null,
        preservedFenceHash: null,
      })
    )],
    ["close authentication", (length: number) => (
      validateInternalProductionOwnerReservationCloseV1(
        length <= 12_519
          ? createInternalProductionOwnerReservationCloseV1({
            closeKind: "ordinary",
            boundReservation: shortBound,
            terminalAuthority: createInternalProductionTerminalOwnerAuthorityV1({
              canonicalOwnerIdentity: shortIdentity,
              terminalOwnerRef: exactAsciiRef(length),
              terminalOwnerHash: SHA_C,
            }),
            ownerAdmissionHeadPredecessorHash: SHA_A,
            ownerAdmissionHeadSuccessorHash: SHA_B,
            preservedFenceRef: null,
            preservedFenceHash: null,
          })
          : { ...shortClose, terminalOwnerRef: exactAsciiRef(length) },
      )
    )],
  ] as const;
  for (const [site, invoke] of terminalRefSites) {
    assertBoundarySite("terminalOwnerRef", site, 12_519, invoke, /TERMINAL_OWNER_REF_INVALID/);
  }
});

test("eight P3 canonical owner builders are byte exact and reject every noncanonical input", () => {
  const attemptId = `ATT_${"a".repeat(16)}`;
  const sessionId = `RTS_${"b".repeat(16)}`;
  const completionRequestId = `RCR_${"c".repeat(16)}`;
  const terminationRequestId = `RTR_${"d".repeat(16)}`;
  assertCanonicalTerminationRequestId(terminationRequestId);
  const findingSetHash = "e".repeat(64);
  const effectKey = "effect:key";
  const eventKey = "event/key";
  const completionEffectOwnerKey =
    "{\"effectKey\":\"effect:key\",\"requestId\":\"RCR_cccccccccccccccc\",\"schema\":\"setfarm.internal-production-completion-request-id-effect-key.v1\"}";
  const operationalOwnerKey =
    "{\"consumer\":\"webhook\",\"eventKey\":\"event/key\",\"schema\":\"setfarm.internal-production-operational-event-key-consumer.v1\"}";
  const rows = [
    {
      label: "claim",
      build: () => createInternalProductionClaimCanonicalOwnerIdentityV1(
        Object.freeze({ claimIdText: "9007199254740991" }),
      ),
      expected: {
        schema: "setfarm.internal-production-canonical-owner-identity.v1",
        category: "claim",
        ownerKey: "9007199254740991",
        ownerRef: "setfarm://claim-log/9007199254740991",
        ownerHash: hashCanonicalJson({
          schema: "setfarm.internal-production-claim-owner.v1",
          claimId: "9007199254740991",
        }),
      },
    },
    {
      label: "execution attempt",
      build: () => createInternalProductionExecutionAttemptCanonicalOwnerIdentityV1(
        Object.freeze({ attemptId }),
      ),
      expected: {
        schema: "setfarm.internal-production-canonical-owner-identity.v1",
        category: "execution-attempt",
        ownerKey: attemptId,
        ownerRef: `setfarm://execution-attempt/${attemptId}`,
        ownerHash: hashCanonicalJson({
          schema: "setfarm.internal-production-execution-attempt-owner.v1",
          attemptId,
        }),
      },
    },
    {
      label: "runtime session",
      build: () => createInternalProductionRuntimeSessionCanonicalOwnerIdentityV1(
        Object.freeze({ sessionId }),
      ),
      expected: {
        schema: "setfarm.internal-production-canonical-owner-identity.v1",
        category: "runtime-session",
        ownerKey: sessionId,
        ownerRef: `setfarm://runtime-session/${sessionId}`,
        ownerHash: hashCanonicalJson({
          schema: "setfarm.internal-production-runtime-session-owner.v1",
          sessionId,
        }),
      },
    },
    {
      label: "completion owner",
      build: () => createInternalProductionCompletionOwnerCanonicalOwnerIdentityV1(
        Object.freeze({ requestId: completionRequestId }),
      ),
      expected: {
        schema: "setfarm.internal-production-canonical-owner-identity.v1",
        category: "completion-owner",
        ownerKey: completionRequestId,
        ownerRef: `setfarm://runtime-completion/${completionRequestId}`,
        ownerHash: hashCanonicalJson({
          schema: "setfarm.internal-production-completion-owner.v1",
          requestId: completionRequestId,
        }),
      },
    },
    {
      label: "mandatory effect",
      build: () => createInternalProductionMandatoryEffectCanonicalOwnerIdentityV1(
        Object.freeze({ requestId: completionRequestId, effectKey }),
      ),
      expected: {
        schema: "setfarm.internal-production-canonical-owner-identity.v1",
        category: "mandatory-effect",
        ownerKey: completionEffectOwnerKey,
        ownerRef: `setfarm://runtime-completion/${completionRequestId}/mandatory-effect/effect%3Akey`,
        ownerHash: hashCanonicalJson({
          schema: "setfarm.internal-production-mandatory-effect-owner.v1",
          requestId: completionRequestId,
          effectKey,
        }),
      },
    },
    {
      label: "termination",
      build: () => createInternalProductionTerminationCanonicalOwnerIdentityV1(
        Object.freeze({ requestId: terminationRequestId }),
      ),
      expected: {
        schema: "setfarm.internal-production-canonical-owner-identity.v1",
        category: "termination",
        ownerKey: terminationRequestId,
        ownerRef: `setfarm://run-termination/${terminationRequestId}`,
        ownerHash: hashCanonicalJson({
          schema: "setfarm.internal-production-termination-owner.v1",
          requestId: terminationRequestId,
        }),
      },
    },
    {
      label: "finding",
      build: () => createInternalProductionFindingCanonicalOwnerIdentityV1(
        Object.freeze({ findingSetHash }),
      ),
      expected: {
        schema: "setfarm.internal-production-canonical-owner-identity.v1",
        category: "finding",
        ownerKey: findingSetHash,
        ownerRef: `setfarm://finding-set/${findingSetHash}`,
        ownerHash: hashCanonicalJson({
          schema: "setfarm.internal-production-finding-owner.v1",
          findingSetHash,
        }),
      },
    },
    {
      label: "operational delivery",
      build: () => createInternalProductionOperationalDeliveryCanonicalOwnerIdentityV1(
        Object.freeze({ eventKey, consumer: "webhook" }),
      ),
      expected: {
        schema: "setfarm.internal-production-canonical-owner-identity.v1",
        category: "operational-delivery",
        ownerKey: operationalOwnerKey,
        ownerRef: "setfarm://operational-event/event%2Fkey/delivery/webhook",
        ownerHash: hashCanonicalJson({
          schema: "setfarm.internal-production-operational-delivery-owner.v1",
          eventKey,
          consumer: "webhook",
        }),
      },
    },
  ] as const;
  for (const row of rows) {
    const actual = row.build();
    assert.deepEqual(Object.keys(actual), ["schema", "category", "ownerKey", "ownerRef", "ownerHash"],
      `${row.label} property order`);
    assert.deepEqual(actual, row.expected, row.label);
    assertDeepFrozen(actual, row.label);
  }

  assert.equal(completionEffectOwnerKey, canonicalJsonStringify({
    schema: "setfarm.internal-production-completion-request-id-effect-key.v1",
    requestId: completionRequestId,
    effectKey,
  }));
  assert.equal(operationalOwnerKey, canonicalJsonStringify({
    schema: "setfarm.internal-production-operational-event-key-consumer.v1",
    eventKey,
    consumer: "webhook",
  }));

  for (const claimIdText of ["1", "9007199254740991"]) {
    assert.equal(
      createInternalProductionClaimCanonicalOwnerIdentityV1(Object.freeze({ claimIdText })).ownerKey,
      claimIdText,
    );
  }
  for (const claimIdText of [
    "0", "01", "+1", "1.0", "9007199254740992", "9223372036854775807", 1, Number.MAX_SAFE_INTEGER,
  ]) {
    assert.throws(
      () => createInternalProductionClaimCanonicalOwnerIdentityV1(
        Object.freeze({ claimIdText }) as never,
      ),
      /CLAIM_ID_INVALID/,
    );
  }

  for (const [build, prefix] of [
    [(value: string) => createInternalProductionExecutionAttemptCanonicalOwnerIdentityV1(
      Object.freeze({ attemptId: value }),
    ), "ATT_"],
    [(value: string) => createInternalProductionRuntimeSessionCanonicalOwnerIdentityV1(
      Object.freeze({ sessionId: value }),
    ), "RTS_"],
    [(value: string) => createInternalProductionCompletionOwnerCanonicalOwnerIdentityV1(
      Object.freeze({ requestId: value }),
    ), "RCR_"],
    [(value: string) => createInternalProductionTerminationCanonicalOwnerIdentityV1(
      Object.freeze({ requestId: value }),
    ), "RTR_"],
  ] as const) {
    assert.equal(build(`${prefix}${"z".repeat(16)}`).ownerKey.length, 20);
    assert.equal(build(`${prefix}${"z".repeat(160)}`).ownerKey.length, 164);
    for (const invalid of [
      `${prefix}${"z".repeat(15)}`,
      `${prefix}${"z".repeat(161)}`,
      `${prefix.toLowerCase()}${"z".repeat(16)}`,
      `${prefix}${"z".repeat(15)}_`,
    ]) assert.throws(() => build(invalid), /_ID_INVALID/);
  }

  for (const key of ["!", "~".repeat(4_096)]) {
    assert.equal(createInternalProductionMandatoryEffectCanonicalOwnerIdentityV1(Object.freeze({
      requestId: completionRequestId,
      effectKey: key,
    })).ownerKey, canonicalJsonStringify({
      schema: "setfarm.internal-production-completion-request-id-effect-key.v1",
      requestId: completionRequestId,
      effectKey: key,
    }));
    assert.equal(createInternalProductionOperationalDeliveryCanonicalOwnerIdentityV1(Object.freeze({
      eventKey: key,
      consumer: "jsonl",
    })).ownerKey, canonicalJsonStringify({
      schema: "setfarm.internal-production-operational-event-key-consumer.v1",
      eventKey: key,
      consumer: "jsonl",
    }));
  }
  for (const invalidKey of ["", "x".repeat(4_097), " key", "key ", "key\n"]) {
    assert.throws(() => createInternalProductionMandatoryEffectCanonicalOwnerIdentityV1(
      Object.freeze({ requestId: completionRequestId, effectKey: invalidKey }),
    ), /EFFECT_KEY_INVALID/);
    assert.throws(() => createInternalProductionOperationalDeliveryCanonicalOwnerIdentityV1(
      Object.freeze({ eventKey: invalidKey, consumer: "jsonl" }),
    ), /EVENT_KEY_INVALID/);
  }
  for (const invalidHash of ["a".repeat(63), "a".repeat(65), "A".repeat(64), `${"a".repeat(63)}g`]) {
    assert.throws(
      () => createInternalProductionFindingCanonicalOwnerIdentityV1(
        Object.freeze({ findingSetHash: invalidHash }),
      ),
      /FINDING_SET_HASH_INVALID/,
    );
  }
  for (const consumer of ["jsonl", "webhook"] as const) {
    assert.equal(createInternalProductionOperationalDeliveryCanonicalOwnerIdentityV1(Object.freeze({
      eventKey: "consumer-boundary",
      consumer,
    })).ownerRef.endsWith(`/delivery/${consumer}`), true);
  }
  assert.throws(() => createInternalProductionOperationalDeliveryCanonicalOwnerIdentityV1(
    Object.freeze({ eventKey: "consumer-boundary", consumer: "queue" }) as never,
  ), /CONSUMER_INVALID/);

  const exactInputMutations = [
    () => createInternalProductionClaimCanonicalOwnerIdentityV1({ claimIdText: "1", extra: true } as never),
    () => createInternalProductionExecutionAttemptCanonicalOwnerIdentityV1({} as never),
    () => createInternalProductionRuntimeSessionCanonicalOwnerIdentityV1(
      Object.assign(Object.create(null), { sessionId }),
    ),
    () => {
      const input = { requestId: completionRequestId };
      Object.defineProperty(input, "hidden", { value: true, enumerable: false });
      return createInternalProductionCompletionOwnerCanonicalOwnerIdentityV1(input);
    },
    () => createInternalProductionMandatoryEffectCanonicalOwnerIdentityV1({ effectKey } as never),
    () => createInternalProductionTerminationCanonicalOwnerIdentityV1(
      Object.assign({ requestId: terminationRequestId }, { [Symbol("hidden")]: true }),
    ),
    () => createInternalProductionFindingCanonicalOwnerIdentityV1({ findingSetHash, extra: true } as never),
    () => {
      const input = { eventKey, consumer: "jsonl" };
      Object.defineProperty(input, "eventKey", { get: () => eventKey, enumerable: true });
      return createInternalProductionOperationalDeliveryCanonicalOwnerIdentityV1(input as never);
    },
  ];
  for (const mutate of exactInputMutations) assert.throws(mutate, /INPUT|INVALID/);

  const unequalCompositeKeys = [
    JSON.stringify({ schema: "setfarm.internal-production-completion-request-id-effect-key.v1",
      effectKey, requestId: completionRequestId }),
    `${completionRequestId}:${effectKey}`,
  ];
  const canonicalEffectIdentity = createInternalProductionMandatoryEffectCanonicalOwnerIdentityV1(
    Object.freeze({ requestId: completionRequestId, effectKey }),
  );
  const effectProducer = INTERNAL_PRODUCTION_OWNER_PRODUCER_ROWS_A_V1[8];
  for (const ownerKey of unequalCompositeKeys) {
    assert.notEqual(ownerKey, completionEffectOwnerKey);
    const reservation = createInternalProductionOwnerReservationV1({
      producer: effectProducer,
      ownerKey,
      ownerAdmissionHeadPredecessorHash: SHA_A,
    });
    assert.throws(() => createInternalProductionBoundOwnerReservationV1({
      reservation,
      canonicalOwnerIdentity: canonicalEffectIdentity,
    }), /OWNER_IDENTITY_MISMATCH/);
  }
  for (const ownerKey of [
    JSON.stringify({
      schema: "setfarm.internal-production-completion-request-id-effect-key.v1",
      requestId: completionRequestId,
      effectKey,
    }, null, 2),
    JSON.stringify(JSON.parse(completionEffectOwnerKey), null, 1),
  ]) {
    assert.throws(() => createInternalProductionOwnerReservationV1({
      producer: effectProducer,
      ownerKey,
      ownerAdmissionHeadPredecessorHash: SHA_A,
    }), /OWNER_KEY_INVALID/);
  }
});

test("Task 2R keeps claim authority textual and capped at the JavaScript safe integer", async () => {
  const [ownerCoreSource, databaseSource] = await Promise.all([
    readFile(new URL("../../src/internal-production/owner-admission-v1.ts", import.meta.url), "utf8"),
    readFile(new URL("../../src/db-pg.ts", import.meta.url), "utf8"),
  ]);
  assert.match(ownerCoreSource, /BigInt\(value\) > 9_007_199_254_740_991n/);
  const ownerCoreClaimBoundary = ownerCoreSource.slice(
    ownerCoreSource.indexOf("function canonicalClaimIdTextV1"),
    ownerCoreSource.indexOf("export function createInternalProductionExecutionAttemptCanonicalOwnerIdentityV1"),
  );
  const claimTerminalResolverBoundary = databaseSource.slice(
    databaseSource.indexOf("const CLAIM_TERMINAL_RESOLVER_CONFIG_V1"),
    databaseSource.indexOf("const EXECUTION_ATTEMPT_TERMINAL_RESOLVER_CONFIG_V1"),
  );
  const claimTerminalPortBoundary = databaseSource.slice(
    databaseSource.indexOf("export async function resolveInternalProductionClaimTerminalAuthorityPairInTransactionV1"),
    databaseSource.indexOf("export async function resolveInternalProductionExecutionAttemptTerminalAuthorityPairInTransactionV1"),
  );
  assert.match(ownerCoreClaimBoundary, /ownerKey: claimIdText/);
  assert.match(ownerCoreClaimBoundary, /ownerRef: `setfarm:\/\/claim-log\/\$\{claimIdText\}`/);
  assert.match(claimTerminalResolverBoundary, /claimIdText: identity\.ownerKey/);
  assert.match(claimTerminalResolverBoundary, /createInternalProductionClaimCanonicalOwnerIdentityV1\(input as never\)/);
  assert.match(claimTerminalPortBoundary, /resolveP3TerminalCloseInputInTransactionV1\(/);
  const assertTextualClaimAuthorityBoundary = (boundary: string): void => {
    assert.doesNotMatch(boundary, /\b(?:Number|parseInt)\s*\(/);
    assert.doesNotMatch(
      boundary,
      /(?:^|[=(:,;[{?]|\b(?:return|throw|case|delete|void|typeof|await|yield)\b|=>)\s*\+\s*(?=[A-Za-z_$({[\d"'`])/gm,
    );
  };
  for (const boundary of [
    ownerCoreClaimBoundary,
    claimTerminalResolverBoundary,
    claimTerminalPortBoundary,
  ]) {
    assertTextualClaimAuthorityBoundary(boundary);
    for (const forbidden of [
      "const claimId = Number(claimIdText);",
      "const claimId = parseInt(claimIdText, 10);",
      "const claimId = +claimIdText;",
    ]) assert.throws(() => assertTextualClaimAuthorityBoundary(`${boundary}\n${forbidden}`));
  }
});

test("constructs canonical reservation, binding, terminal authority, and pair", () => {
  const { row, reservation, bound, terminal } = reservationFixture();
  assert.deepEqual(validateInternalProductionOwnerReservationV1(reservation, row), reservation);
  assert.deepEqual(validateInternalProductionBoundOwnerReservationV1(bound), bound);
  assert.deepEqual(validateInternalProductionTerminalOwnerAuthorityV1(terminal), terminal);
  const pair = deriveInternalProductionTerminalOwnerAuthorityPairV1(terminal);
  assert.deepEqual(validateInternalProductionTerminalOwnerAuthorityPairV1(pair, terminal), pair);
  assert.match(reservation.reservationRef, /^setfarm:\/\/internal-production\/owner-reservations\/[a-f0-9]{64}$/);
  assert.match(bound.bindingHash, /^[a-f0-9]{64}$/);
});

test("strict body validators reject extras, crossed identities, and structural hash clones", () => {
  const { row, reservation, identity, bound, terminal } = reservationFixture();
  assert.throws(
    () => validateInternalProductionOwnerReservationV1({ ...reservation, extra: true }, row),
    /RESERVATION_KEYS_INVALID/,
  );
  assert.throws(
    () => validateInternalProductionOwnerReservationV1({ ...reservation, ownerKeyHash: SHA_C }, row),
    /RESERVATION_DERIVATION_INVALID/,
  );
  assert.throws(
    () => createInternalProductionBoundOwnerReservationV1({
      reservation,
      canonicalOwnerIdentity: { ...identity, ownerKey: "crossed" },
    }),
    /OWNER_IDENTITY_MISMATCH/,
  );
  assert.throws(
    () => validateInternalProductionBoundOwnerReservationV1({ ...bound, bindingHash: SHA_C }),
    /BINDING_HASH_INVALID/,
  );
  const pair = deriveInternalProductionTerminalOwnerAuthorityPairV1(terminal);
  assert.throws(
    () => validateInternalProductionTerminalOwnerAuthorityPairV1(
      { ...pair, terminalAuthorityHash: SHA_A }, terminal,
    ),
    /TERMINAL_OWNER_AUTHORITY_PAIR_INVALID/,
  );
});

test("constructs ordinary and fence-target closes with exact pair and hash rules", () => {
  const { bound, terminal } = reservationFixture();
  const ordinary = createInternalProductionOwnerReservationCloseV1({
    closeKind: "ordinary",
    boundReservation: bound,
    terminalAuthority: terminal,
    ownerAdmissionHeadPredecessorHash: SHA_A,
    ownerAdmissionHeadSuccessorHash: SHA_B,
    preservedFenceRef: null,
    preservedFenceHash: null,
  });
  assert.deepEqual(validateInternalProductionOwnerReservationCloseV1(ordinary), ordinary);
  assert.throws(
    () => validateInternalProductionOwnerReservationCloseV1({ ...ordinary, extra: true }),
    /CLOSE_KEYS_INVALID/,
  );
  assert.throws(
    () => createInternalProductionOwnerReservationCloseV1({
      closeKind: "ordinary",
      boundReservation: bound,
      terminalAuthority: terminal,
      ownerAdmissionHeadPredecessorHash: SHA_A,
      ownerAdmissionHeadSuccessorHash: SHA_B,
      preservedFenceRef: "setfarm://internal-production/fences/test",
      preservedFenceHash: SHA_C,
    }),
    /ORDINARY_CLOSE_PRESERVED_FENCE_FORBIDDEN/,
  );
  const fenced = createInternalProductionOwnerReservationCloseV1({
    closeKind: "fence-target",
    boundReservation: bound,
    terminalAuthority: terminal,
    ownerAdmissionHeadPredecessorHash: SHA_A,
    ownerAdmissionHeadSuccessorHash: SHA_B,
    preservedFenceRef: "setfarm://internal-production/fences/test",
    preservedFenceHash: SHA_C,
  });
  assert.deepEqual(validateInternalProductionOwnerReservationCloseV1(fenced), fenced);
});

test("exports and every successful construction or validation are detached and deeply immutable", () => {
  assertDeepFrozen(INTERNAL_PRODUCTION_OWNER_CATEGORY_REGISTRY_V1, "category registry");
  assertDeepFrozen(INTERNAL_PRODUCTION_OWNER_CATEGORY_CENSUS_MAP_V1, "census map");
  assertDeepFrozen(INTERNAL_PRODUCTION_OWNER_PRODUCER_ROWS_A_V1, "A rows");
  assertDeepFrozen(INTERNAL_PRODUCTION_OWNER_PRODUCER_MANIFEST_A_V1, "A manifest");

  const callerManifest = structuredClone(INTERNAL_PRODUCTION_OWNER_PRODUCER_MANIFEST_A_V1);
  const validatedManifest = validateInternalProductionOwnerProducerManifestV1(callerManifest);
  assertDeepFrozen(validatedManifest, "validated manifest");
  // @ts-expect-error runtime detachment fixture deliberately mutates readonly caller input
  callerManifest.rows[0]!.module = "src/caller-mutated.ts";
  assert.equal(validatedManifest.rows[0]!.module, "src/execution/run-persistence.ts");

  const manifests = [
    INTERNAL_PRODUCTION_OWNER_PRODUCER_MANIFEST_A_V1,
    syntheticManifest("B", 10), syntheticManifest("C", 6),
    syntheticManifest("D", 16), syntheticManifest("E", 9),
  ] as const;
  const assembled = assembleInternalProductionOwnerProducerRegistryV1({ manifests });
  assertDeepFrozen(assembled, "assembled registry");
  const originalB = manifests[1].rows[0] as { module: string };
  originalB.module = "src/caller-mutated-b.ts";
  assert.notEqual(assembled.rows[16]!.module, originalB.module);

  const { row, reservation, identity, bound, terminal } = reservationFixture();
  const callerReservation = structuredClone(reservation);
  const validatedReservation = validateInternalProductionOwnerReservationV1(callerReservation, row);
  const callerBound = structuredClone(bound);
  const validatedBound = validateInternalProductionBoundOwnerReservationV1(callerBound);
  const callerTerminal = structuredClone(terminal);
  const validatedTerminal = validateInternalProductionTerminalOwnerAuthorityV1(callerTerminal);
  const terminalPair = deriveInternalProductionTerminalOwnerAuthorityPairV1(terminal);
  const callerPair = structuredClone(terminalPair);
  const validatedPair = validateInternalProductionTerminalOwnerAuthorityPairV1(callerPair, terminal);
  const close = createInternalProductionOwnerReservationCloseV1({
    closeKind: "ordinary",
    boundReservation: bound,
    terminalAuthority: terminal,
    ownerAdmissionHeadPredecessorHash: SHA_A,
    ownerAdmissionHeadSuccessorHash: SHA_B,
    preservedFenceRef: null,
    preservedFenceHash: null,
  });
  const callerClose = structuredClone(close);
  const validatedClose = validateInternalProductionOwnerReservationCloseV1(callerClose);
  for (const [label, value] of [
    ["reservation", reservation], ["validated reservation", validatedReservation],
    ["binding", bound], ["validated binding", validatedBound],
    ["terminal", terminal], ["validated terminal", validatedTerminal],
    ["terminal pair", terminalPair], ["validated terminal pair", validatedPair],
    ["close", close], ["validated close", validatedClose],
  ] as const) assertDeepFrozen(value, label);
  assertDeepFrozen(validatedBound.canonicalOwnerIdentity, "validated nested owner identity");

  // @ts-expect-error runtime detachment fixture deliberately mutates readonly caller input
  callerReservation.ownerKey = "caller-mutated";
  // @ts-expect-error runtime detachment fixture deliberately mutates readonly caller input
  callerBound.canonicalOwnerIdentity.ownerKey = "caller-mutated";
  // @ts-expect-error runtime detachment fixture deliberately mutates readonly caller input
  callerTerminal.ownerKey = "caller-mutated";
  // @ts-expect-error runtime detachment fixture deliberately mutates readonly caller input
  callerPair.terminalAuthorityRef = "setfarm://caller-mutated";
  // @ts-expect-error runtime detachment fixture deliberately mutates readonly caller input
  callerClose.terminalOwnerRef = "setfarm://caller-mutated";
  assert.equal(validatedReservation.ownerKey, reservation.ownerKey);
  assert.equal(validatedBound.canonicalOwnerIdentity.ownerKey, identity.ownerKey);
  assert.equal(validatedTerminal.ownerKey, identity.ownerKey);
  assert.notEqual(validatedPair.terminalAuthorityRef, callerPair.terminalAuthorityRef);
  assert.notEqual(validatedClose.terminalOwnerRef, callerClose.terminalOwnerRef);

  assert.throws(() => {
    (validatedBound.canonicalOwnerIdentity as { ownerKey: string }).ownerKey = "forbidden";
  }, TypeError);
});

test("strict shapes reject symbols, non-enumerable fields, custom prototypes, and null prototypes", () => {
  const symbolManifest = structuredClone(INTERNAL_PRODUCTION_OWNER_PRODUCER_MANIFEST_A_V1) as
    Record<PropertyKey, unknown>;
  symbolManifest[Symbol("hidden")] = true;
  assert.throws(
    () => validateInternalProductionOwnerProducerManifestV1(symbolManifest),
    /MANIFEST_KEYS_INVALID/,
  );

  const { row, reservation, identity } = reservationFixture();
  const nonEnumerableReservation = structuredClone(reservation);
  Object.defineProperty(nonEnumerableReservation, "hidden", { value: true, enumerable: false });
  assert.throws(
    () => validateInternalProductionOwnerReservationV1(nonEnumerableReservation, row),
    /RESERVATION_KEYS_INVALID/,
  );

  class CustomTerminalAuthority {}
  const customPrototypeTerminal = Object.assign(
    new CustomTerminalAuthority(),
    createInternalProductionTerminalOwnerAuthorityV1({
      canonicalOwnerIdentity: identity,
      terminalOwnerRef: "setfarm://runs/run-owner-admission-test-1/terminal/completed",
      terminalOwnerHash: SHA_C,
    }),
  );
  assert.throws(
    () => validateInternalProductionTerminalOwnerAuthorityV1(customPrototypeTerminal),
    /TERMINAL_OWNER_AUTHORITY_INVALID/,
  );

  const nullPrototypeIdentity = Object.assign(Object.create(null), identity);
  assert.throws(
    () => createInternalProductionBoundOwnerReservationV1({
      reservation,
      canonicalOwnerIdentity: nullPrototypeIdentity,
    }),
    /CANONICAL_OWNER_IDENTITY_INVALID/,
  );
});

test("the core is import-inert and contains only the approved dependency edges", async () => {
  const source = await readFile(new URL("../../src/internal-production/owner-admission-v1.ts", import.meta.url), "utf8");
  const imports = [...source.matchAll(/^import[^;]+from\s+["']([^"']+)["'];/gm)].map((match) => match[1]);
  assert.deepEqual(imports, ["postgres", "../product-compiler/canonical-json.js"]);
  assert.doesNotMatch(source, /from\s+["'][^"']*(?:db-pg|receipt|restart|spawner|execution)[^"']*["']/);
  assert.doesNotMatch(source, /createInternalProductionOwnerAdmission(?:Repository|Controller)/);
  assert.doesNotMatch(source, /postgres\s*\(/);
});

test("the A source-build body exposes the complete exact PBA evidence ABI", async () => {
  const source = await readFile(
    new URL("../../src/internal-production/owner-admission-v1.ts", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(
    source,
    /evidence:\s*Readonly<Record<string, unknown>>/,
  );
  assert.match(
    source,
    /type InternalProductionProductBuildAuthorityV2DeliveryEvidenceObservationV1 = import\(\s*["']\.\/product-build-authority-v2-delivery-evidence-v1\.js["']\s*\)\.ProductBuildAuthorityV2DeliveryEvidenceObservationV1;/,
  );
});

test("Task 8 binds the fail-fast PostgreSQL matrix to its reviewed behavior witnesses", () => {
  const databaseWitnesses = [
    ["tests/claim-log-lifecycle.test.ts", [
      "installer publishes only the committed run owner pair",
    ]],
    ["tests/cleanup-ops.test.ts", [
      "stabilizes the exact source fingerprint only when cleanup runs before acceptance",
    ]],
    ["tests/execution-attempts/attempt-reconciler.test.ts", [
      "exact-adopts response loss, rejects a missing sidecar, and rolls insert/reread/bind failures back to the prior head",
    ]],
    ["tests/execution-attempts/claim-attempt-transition.test.ts", [
      "rolls both terminal rows and owner closes back when the attempt close is rejected",
    ]],
    ["tests/execution-attempts/claim-runtime-publication.test.ts", [
      "replays a committed single publication from its stable runtime session",
    ]],
    ["tests/execution-attempts/migration-source-digests.test.ts", [
      "binds guarded migration 32 without changing any historical digest",
      "binds ordinary migration 33 without changing migration 32 authority",
    ]],
    ["tests/execution-attempts/migrations.test.ts", [
      "rejects a live or non-isolated URL before a test connection can open",
    ]],
    ["tests/execution-attempts/operational-event-delivery.test.ts", [
      "exact-adopts terminal acknowledgement loss without lease identity or owner-head advance",
      "serializes terminal settlement against release and heartbeat without a partial close",
      "rolls the complete final-expiry close set back before selecting new work",
    ]],
    ["tests/execution-attempts/operational-outbox-repository.test.ts", [
      "keeps one deterministic published identity for idempotent event-key replay",
    ]],
    ["tests/execution-attempts/run-terminal-transition.test.ts", [
      "keeps attempt birth, recovery pair publication, m33 use, and terminal closes in the exact Task 4 inventory",
      "authenticates an applied Task 5 effect while atomically accepting its completion",
      "refuses to erase active shadow owners without a drained failure request",
    ]],
    ["tests/execution-attempts/run-termination.test.ts", [
      "binds the sole termination owner at request birth and exactly adopts ACK-loss replay",
    ]],
    ["tests/execution-attempts/runtime-completion-effect-runner.test.ts", [
      "reconciles an externally applied effect after a crash without applying twice",
    ]],
    ["tests/execution-attempts/runtime-completion.test.ts", [
      "rolls completion birth back at reread, bind, and commit and hides pre-ACK state",
    ]],
    ["tests/execution-attempts/runtime-hooks.test.ts", [
      "rolls back medic story reset when the exact claim owner close rejects",
    ]],
    ["tests/execution-attempts/runtime-session-repository.test.ts", [
      "serializes pre-attempt expiry with compound failure in both constructible lock orders",
    ]],
    ["tests/execution-attempts/v3-downstream-evidence-publication.test.ts", [
      "atomically owns one story-bound child attempt, publishes typed evidence, and replays unchanged source",
    ]],
    ["tests/findings/repository.test.ts", [
      "publishes one complete ordered finding set under one immediately closed owner",
      "rejects a preexisting parent with a missing ordered child set instead of repairing it",
      "rejects extra children and reordered parent identity without creating an owner",
    ]],
    ["tests/findings/v3-evidence-only-worker.test.ts", [
      "atomically publishes one non-model claim, attempt, and delivery under concurrent publishers",
      "rejects a positive model-publication candidate without parsing it and rolls child birth back",
      "rolls claim, attempt, both owner births, and delivery pair back when the pair CAS is rejected",
    ]],
    ["tests/findings/v3-recovery-lifecycle-reconciler.test.ts", [
      "rejects a caller-selected model slice before attempt birth and preserves the null delivery pair",
      "allows supervisor repair only for the supervisor owner and starting only as an exact complete replay",
      "linearizes attempt birth and pre-birth expiry in both run-lock orders and uses waiter-side database time",
      "terminally blocks an expired reserved publication before attempt birth without mutating m33",
    ]],
    ["tests/internal-production/owner-admission-v1.test.ts", [
      "P3 runner projects authenticated current bytes from import meta root",
    ]],
  ] as const;

  function assertDatabaseWitnesses(candidate: ReadonlyMap<string, string>): void {
    assert.equal(candidate.size, 20, "Task 8 must execute exactly twenty PostgreSQL files");
    for (const [relativePath, titles] of databaseWitnesses) {
      const source = candidate.get(relativePath);
      assert.notEqual(source, undefined, `missing PostgreSQL source ${relativePath}`);
      for (const title of titles) {
        assert.equal(
          source!.includes(`it("${title}"`) || source!.includes(`test("${title}"`),
          true,
          `${relativePath} lost reviewed PostgreSQL witness: ${title}`,
        );
      }
    }
  }

  assert.equal(databaseWitnesses.length, 20);
  assert.equal(new Set(databaseWitnesses.map(([relativePath]) => relativePath)).size, 20);
  const sources = new Map(databaseWitnesses.map(([relativePath]) => [
    relativePath,
    readFileSync(path.join(process.cwd(), relativePath), "utf8"),
  ]));
  assertDatabaseWitnesses(sources);

  const [mutatedPath, [mutatedTitle]] = databaseWitnesses[0];
  const mutatedSources = new Map(sources);
  mutatedSources.set(mutatedPath, sources.get(mutatedPath)!.replace(mutatedTitle, "removed-witness"));
  assert.throws(
    () => assertDatabaseWitnesses(mutatedSources),
    /lost reviewed PostgreSQL witness/,
  );

  const lifecycleSource = readFileSync(
    path.join(process.cwd(), "src/recovery/v3-recovery-lifecycle-reconciler.ts"),
    "utf8",
  );
  assert.match(lifecycleSource, /V3_RECOVERY_LIFECYCLE_RUN_NOT_ACTIVE/);
  assert.match(lifecycleSource, /V3_RECOVERY_LIFECYCLE_TERMINATION_PENDING/);
  assert.match(lifecycleSource, /Quarantine is deliberately a report-only result/);

  const terminalSource = readFileSync(
    path.join(process.cwd(), "src/execution/run-terminal-transition.ts"),
    "utf8",
  );
  assert.match(terminalSource, /RUN_TERMINAL_TERMINATION_PENDING/);
});

test("Task 8 expiry-first witness rejects successor aliasing and duplicate owner closes", () => {
  const closedOwners = [
    {
      category: "claim",
      state: "closed",
      close_ref: "setfarm://internal-production/owner-reservation-closes/claim",
      close_hash: SHA_A,
      updated_at: "2026-08-23T10:00:00.000Z",
    },
    {
      category: "runtime-session",
      state: "closed",
      close_ref: "setfarm://internal-production/owner-reservation-closes/runtime-session",
      close_hash: SHA_B,
      updated_at: "2026-08-23T10:00:01.000Z",
    },
  ] as const;
  const successorSnapshot: Task8SuccessorCanonicalSnapshotV1 = {
    delivery: {
      dispatchId: "RDD_successor",
      recoveryCaseId: "RC_successor",
      state: "leased",
      updatedAt: "2026-08-23T10:00:00.000Z",
    },
    recoveryCase: {
      recoveryCaseId: "RC_successor",
      status: "repairing",
      stateVersion: 2,
      updatedAt: "2026-08-23T10:00:00.000Z",
    },
  };
  const witness: Task8ExpiryFirstWitnessV1 = {
    expiredDispatchId: "RDD_expired",
    successorDispatchId: "RDD_successor",
    expiredCaseId: "RC_expired",
    successorCaseId: "RC_successor",
    expiredDeliveryState: "blocked",
    expiredCaseStatus: "blocked",
    expiredDeliveryStateAfterCompound: "blocked",
    expiredCaseStatusAfterCompound: "blocked",
    expiredDeliveryStateAfterCompoundReplay: "blocked",
    expiredCaseStatusAfterCompoundReplay: "blocked",
    successorDeliveryState: "leased",
    sameDispatchRefusalCode: "V3_RECOVERY_AUTHORITY_DELIVERY_NOT_FOUND",
    ownerHeadBeforeExpiry: "40",
    ownerHeadAfterExpiry: "42",
    ownerHeadBeforeCompound: "46",
    ownerHeadAfterCompound: "48",
    ownerHeadAfterCompoundReplay: "48",
    expiryOwnerClosesBeforeCompound: closedOwners,
    expiryOwnerClosesAfterCompound: closedOwners,
    expiryOwnerClosesAfterCompoundReplay: closedOwners,
    successorBeforeCompound: successorSnapshot,
    successorAfterCompound: successorSnapshot,
    successorAfterCompoundReplay: successorSnapshot,
  };
  assert.doesNotThrow(() => assertTask8ExpiryFirstWitnessV1(witness));
  assert.throws(() => assertTask8ExpiryFirstWitnessV1({
    ...witness,
    successorDispatchId: witness.expiredDispatchId,
  }), /distinct successor dispatch/);
  assert.throws(() => assertTask8ExpiryFirstWitnessV1({
    ...witness,
    sameDispatchRefusalCode: "accepted",
  }), /same dispatch refusal/);
  assert.throws(() => assertTask8ExpiryFirstWitnessV1({
    ...witness,
    ownerHeadAfterExpiry: "43",
  }), /exactly two expiry owner closes/);
  assert.throws(() => assertTask8ExpiryFirstWitnessV1({
    ...witness,
    expiryOwnerClosesAfterCompound: closedOwners.map((row) => ({
      ...row,
      updated_at: "2026-08-23T10:00:02.000Z",
    })),
  }), /expiry owner closes changed/);
  assert.throws(() => assertTask8ExpiryFirstWitnessV1({
    ...witness,
    ownerHeadAfterCompoundReplay: "49",
  }), /compound replay advanced owner head/);
  assert.throws(() => assertTask8ExpiryFirstWitnessV1({
    ...witness,
    successorAfterCompound: {
      ...successorSnapshot,
      delivery: { ...(successorSnapshot.delivery as object), state: "blocked" },
    },
  }), /successor delivery\/case changed during compound/);
  assert.throws(() => assertTask8ExpiryFirstWitnessV1({
    ...witness,
    successorAfterCompoundReplay: {
      ...successorSnapshot,
      recoveryCase: { ...(successorSnapshot.recoveryCase as object), status: "blocked" },
    },
  }), /successor delivery\/case changed during compound replay/);
  assert.throws(() => assertTask8ExpiryFirstWitnessV1({
    ...witness,
    expiredDeliveryStateAfterCompound: "leased",
  }), /expired delivery must remain blocked after compound/);
  assert.throws(() => assertTask8ExpiryFirstWitnessV1({
    ...witness,
    expiredCaseStatusAfterCompoundReplay: "repairing",
  }), /expired case must remain blocked after compound replay/);
});

test("Task 8 executes the three honest sequential compound and expiry rows", async () => {
  if (process.env.SETFARM_PG_URL === undefined) return;
  assert.ok(activatedOwnerAdmissionFixture, "the owner-admission fixture must remain available");
  const { db, sql, root } = activatedOwnerAdmissionFixture;
  try {
    const fixtureImport = async <Module>(relativePath: string): Promise<Module> => import(
    `${pathToFileURL(path.join(root, relativePath)).href}?task8=${Date.now()}-${Math.random()}`
  ) as Promise<Module>;
  const { createFindingSetV1 } = await fixtureImport<typeof import(
    "../../src/findings/finding-set.js"
  )>("src/findings/finding-set.ts");
  const { createFindingRecoveryRepository } = await fixtureImport<typeof import(
    "../../src/recovery/finding-recovery-repository.js"
  )>("src/recovery/finding-recovery-repository.ts");
  const { createRecoveryDeliveryRepository } = await fixtureImport<typeof import(
    "../../src/recovery/recovery-delivery-repository.js"
  )>("src/recovery/recovery-delivery-repository.ts");
  const { createV3RecoveryClaimAuthority } = await fixtureImport<typeof import(
    "../../src/recovery/v3-recovery-claim-authority.js"
  )>("src/recovery/v3-recovery-claim-authority.ts");
  const { createV3RecoveryLifecycleReconciler } = await fixtureImport<typeof import(
    "../../src/recovery/v3-recovery-lifecycle-reconciler.js"
  )>("src/recovery/v3-recovery-lifecycle-reconciler.ts");
  const {
    insertAndBindInternalProductionClaimBirthV1,
    prepareInternalProductionClaimBirthV1,
  } = await fixtureImport<typeof import(
    "../../src/execution/claim-runtime-publication.js"
  )>("src/execution/claim-runtime-publication.ts");
  const {
    createRuntimeSessionRepository,
    reserveRuntimeSessionInTransaction,
  } = await fixtureImport<typeof import(
    "../../src/execution/runtime-session-repository.js"
  )>("src/execution/runtime-session-repository.ts");
  const {
    createRunTerminationRepository,
    requestRunTermination,
  } = await fixtureImport<typeof import(
    "../../src/execution/run-termination.js"
  )>("src/execution/run-termination.ts");
  const { transitionRunToTerminal } = await fixtureImport<typeof import(
    "../../src/execution/run-terminal-transition.js"
  )>("src/execution/run-terminal-transition.ts");
  const { seedV3ReleaseGoAdmission } = await import(
    "../execution-attempts/test-database.js"
  );

  const drainEvidence = Object.freeze({
    schema: "setfarm.runtime-drain-evidence.v1" as const,
    observedAt: "2026-08-23T10:00:00.000Z",
    localProcessAbsent: true,
    openClawTaskAbsent: true,
    workspaceProcessAbsent: true,
    stableObservations: 2,
    evidenceRefs: ["setfarm://test/task8/compound-expiry-drain"],
  });

  async function seedPreAttemptPublication(label: string) {
    const runId = `run-task8-compound-expiry-${label}`;
    const stepDbId = `${runId}-step`;
    const storyDbId = `${runId}-story`;
    const storyId = "US-001";
    const sessionId = `RTS_task8-compound-expiry-${label}`;
    const packetHash = hashCanonicalJson({ schema: "setfarm.task8.packet.v1", label });
    const sliceHash = hashCanonicalJson({ schema: "setfarm.task8.slice.v1", label });
    const sourceSha = hashCanonicalJson({ schema: "setfarm.task8.source.v1", label });
    const sourceTreeHash = hashCanonicalJson({ schema: "setfarm.task8.tree.v1", label });
    const releaseSha = hashCanonicalJson({ schema: "setfarm.task8.release.v1", label }).slice(0, 40);
    const releaseAdmissionHash = await seedV3ReleaseGoAdmission(sql, releaseSha);
    await sql`
      INSERT INTO runs (
        id,workflow_id,task,status,context,protocol,protocol_version,
        compiler_release_sha,packet_hash,activation_preflight_hash,release_admission_hash
      ) VALUES (
        ${runId},'feature-dev','Task 8 compound expiry','running','{}'::jsonb,
        'v3',1,${releaseSha},${packetHash},${"e".repeat(64)},${releaseAdmissionHash}
      )
    `;
    await sql.begin(async (transaction) => {
      const identity = db.createInternalProductionWorkflowRunCanonicalOwnerIdentityV1(runId);
      const reservation = await db.beginOrAdoptInternalProductionOwnerReservationV1(
        transaction,
        { producerImplementationId: "a-runtime-run-v1", ownerKey: identity.ownerKey },
      );
      await db.bindInternalProductionOwnerReservationV1(transaction, {
        reservationRef: reservation.reservationRef,
        reservationHash: reservation.reservationHash,
        canonicalOwnerIdentity: identity,
      });
    });
    await sql`
      INSERT INTO steps (
        id,run_id,step_id,agent_id,step_index,input_template,expects,status,type,
        retry_count,max_retries,current_story_id
      ) VALUES (
        ${stepDbId},${runId},'implement','feature-dev_developer',1,'','',
        'running','loop',0,3,NULL
      )
    `;
    await sql`
      INSERT INTO stories (
        id,run_id,story_index,story_id,title,status,claimed_by,claim_generation
      ) VALUES (
        ${storyDbId},${runId},1,${storyId},'Task 8 story','failed',NULL,0
      )
    `;

    const findingSet = createFindingSetV1({
      runId,
      storyId,
      packetHash,
      sliceHash,
      sourceRevision: { sha: sourceSha, treeHash: sourceTreeHash },
      findings: [{
        origin: "runtime",
        classification: "structured",
        invariantRef: `INV_TASK8_${label.toUpperCase().replaceAll("-", "_")}`,
        sourceLocators: [{ path: "src/App.tsx", contentHash: SHA_A }],
        observedEvidenceRefs: [SHA_B],
        expectedPredicateRef: "EVID_TASK8_COMPOUND_EXPIRY",
        status: "open",
      }],
    });
    const findings = createFindingRecoveryRepository(sql);
    await findings.putFindingSet(findingSet);
    const opened = await findings.openRecoveryCase({
      runId,
      storyId,
      findingSetHash: findingSet.findingSetHash,
      findingIds: findingSet.findings.map((finding) => finding.findingId),
      packetHash,
      sliceHash,
      sourceRevision: findingSet.sourceRevision,
      owner: "implement",
      expectedDelta: {
        kind: "source_change",
        invariantRefs: [`INV_TASK8_${label.toUpperCase().replaceAll("-", "_")}`],
        requiredPaths: ["src/App.tsx"],
      },
      allowedPaths: ["src/App.tsx"],
      evidencePlan: ["EVID_TASK8_COMPOUND_EXPIRY"],
      priorAttemptRefs: [],
      budget: {
        limits: { implement: 1, supervisorRepair: 1, evidenceOnly: 1 },
        used: { implement: 0, supervisorRepair: 0, evidenceOnly: 0 },
      },
      status: "open",
      decisionRefs: [],
    });
    const deliveries = createRecoveryDeliveryRepository(sql);
    const revision = await deliveries.findCurrentRevision(opened.recoveryCase.recoveryCaseId);
    assert.ok(revision);
    const authorized = await deliveries.authorizeCurrentRevision({
      recoveryCaseId: opened.recoveryCase.recoveryCaseId,
      revisionId: revision.revisionId,
      expectedStateVersion: opened.recoveryCase.stateVersion,
      dispatchClass: "product_implementation",
    });
    assert.equal(authorized.status, "authorized");
    if (authorized.status !== "authorized") throw new Error("Task 8 authorization missing");
    const handoff = await createV3RecoveryClaimAuthority(sql).acquireRecoveryClaim({
      runId,
      storyId,
      ownerInstanceId: `task8-${label}-owner`,
      leaseMs: 10_000,
    });
    const publication = await sql.begin(async (transaction) => {
      const clock = await transaction.unsafe<Array<{ now: Date }>>(
        "SELECT clock_timestamp() AS now",
      );
      const boundAt = clock[0]!.now;
      const idRows = await transaction.unsafe<Array<{ id: string }>>(
        "SELECT nextval(pg_get_serial_sequence('claim_log','id'))::bigint::text AS id",
      );
      const birth = await prepareInternalProductionClaimBirthV1(
        transaction,
        "a-claim-loop-runtime-v1",
        idRows,
      );
      const claimId = await insertAndBindInternalProductionClaimBirthV1(
        transaction,
        birth,
        {
          runId,
          workflowStepId: "implement",
          storyId,
          claimAgentId: "feature-dev_developer",
          claimedAt: boundAt,
        },
      );
      await transaction`
        UPDATE stories
           SET status='running',claimed_by='feature-dev_developer',
               claimed_at=${boundAt},claim_generation=1,updated_at=${boundAt}
         WHERE id=${storyDbId} AND status='failed' AND claimed_by IS NULL
      `;
      await transaction`
        UPDATE steps SET current_story_id=${storyDbId},updated_at=${boundAt}
         WHERE id=${stepDbId} AND status='running' AND current_story_id IS NULL
      `;
      const runtime = await reserveRuntimeSessionInTransaction(transaction, {
        sessionId,
        runId,
        stepDbId,
        workflowStepId: "implement",
        storyDbId,
        storyId,
        claimId,
        claimAgentId: "feature-dev_developer",
        runtimeAgentId: "prism",
        runtimeKind: "openclaw_session",
        ownerInstanceId: handoff.lease.ownerInstanceId,
      });
      const handoffCanonicalJson = canonicalJsonStringify(handoff);
      const handoffHash = hashCanonicalJson(handoff);
      await transaction.unsafe(
        `INSERT INTO internal_production_v3_recovery_claim_publications_v1 (
           claim_id,runtime_session_id,run_id,step_db_id,workflow_step_id,
           story_db_id,story_id,story_index,recovery_case_id,revision_id,
           dispatch_id,status,handoff_canonical_json,handoff_hash,bound_at
         ) VALUES ($1::bigint,$2,$3,$4,$5,$6,$7,1,$8,$9,$10,$11,$12,$13,$14)`,
        [
          String(claimId),runtime.sessionId,runId,stepDbId,"implement",storyDbId,storyId,
          handoff.recoveryCaseId,handoff.revisionId,handoff.dispatchId,handoff.status,
          handoffCanonicalJson,handoffHash,boundAt,
        ],
      );
      return Object.freeze({ claimId, runtime });
    });
    return Object.freeze({
      runId,
      storyId,
      sessionId,
      claimId: publication.claimId,
      packetHash,
      sliceHash,
      sourceRevision: Object.freeze({ sha: sourceSha, treeHash: sourceTreeHash }),
      handoff,
      reconciler: createV3RecoveryLifecycleReconciler(sql),
      sessions: createRuntimeSessionRepository(sql),
    });
  }

  async function snapshot(runId: string) {
    const rows = await sql<Array<{
      run_status: string;
      claim_outcome: string | null;
      runtime_state: string;
      claim_owner_state: string;
      runtime_owner_state: string;
      delivery_state: string;
      case_status: string;
      termination_state: string | null;
    }>>`
      SELECT run.status AS run_status,claim.outcome AS claim_outcome,
             runtime.state AS runtime_state,claim_owner.state AS claim_owner_state,
             runtime_owner.state AS runtime_owner_state,delivery.state AS delivery_state,
             recovery_case.status AS case_status,termination.state AS termination_state
        FROM runs run
        JOIN claim_log claim ON claim.run_id=run.id
        JOIN runtime_sessions runtime ON runtime.claim_id=claim.id
        JOIN internal_production_owner_reservations_v1 claim_owner
          ON claim_owner.category='claim' AND claim_owner.owner_key=claim.id::text
        JOIN internal_production_owner_reservations_v1 runtime_owner
          ON runtime_owner.category='runtime-session' AND runtime_owner.owner_key=runtime.session_id
        JOIN recovery_dispatch_deliveries delivery ON delivery.run_id=run.id
        JOIN recovery_cases recovery_case ON recovery_case.recovery_case_id=delivery.recovery_case_id
        LEFT JOIN run_termination_requests termination ON termination.run_id=run.id
       WHERE run.id=${runId}
    `;
    assert.equal(rows.length, 1);
    return { ...rows[0]! };
  }

  async function expire(handoff: Readonly<{ dispatchId: string }>): Promise<void> {
    await sql.unsafe(
      `SELECT pg_sleep(GREATEST(
         EXTRACT(EPOCH FROM (
           (SELECT lease_expires_at FROM recovery_dispatch_deliveries WHERE dispatch_id=$1)
           - clock_timestamp()
         )) + 0.05,
         0
       ))`,
      [handoff.dispatchId],
    );
  }

  async function ownerHead(): Promise<string> {
    const rows = await sql<Array<{ head_version: string }>>`
      SELECT head_version::text
        FROM internal_production_owner_admission_head_v1
       WHERE singleton=TRUE
    `;
    assert.equal(rows.length, 1);
    return rows[0]!.head_version;
  }

  async function assertExactPreAttemptPublication(
    fixture: Awaited<ReturnType<typeof seedPreAttemptPublication>>,
  ): Promise<void> {
    const rows = await sql<Array<{
      claim_id: string;
      runtime_session_id: string;
      run_id: string;
      step_db_id: string;
      workflow_step_id: string;
      story_db_id: string;
      story_id: string;
      story_index: number;
      recovery_case_id: string;
      revision_id: string;
      dispatch_id: string;
      status: string;
      handoff_canonical_json: string;
      handoff_hash: string;
      bound_matches_claim: boolean;
    }>>`
      SELECT publication.claim_id::text,publication.runtime_session_id,publication.run_id,
             publication.step_db_id,publication.workflow_step_id,publication.story_db_id,
             publication.story_id,publication.story_index,publication.recovery_case_id,
             publication.revision_id,publication.dispatch_id,publication.status,
             publication.handoff_canonical_json,publication.handoff_hash,
             publication.bound_at=claim.claimed_at AS bound_matches_claim
        FROM internal_production_v3_recovery_claim_publications_v1 publication
        JOIN runtime_sessions runtime ON runtime.session_id=publication.runtime_session_id
        JOIN claim_log claim ON claim.id=publication.claim_id
       WHERE publication.claim_id=${String(fixture.claimId)}::bigint
    `;
    assert.deepEqual([...rows], [{
      claim_id: String(fixture.claimId),
      runtime_session_id: fixture.sessionId,
      run_id: fixture.runId,
      step_db_id: `${fixture.runId}-step`,
      workflow_step_id: "implement",
      story_db_id: `${fixture.runId}-story`,
      story_id: fixture.storyId,
      story_index: 1,
      recovery_case_id: fixture.handoff.recoveryCaseId,
      revision_id: fixture.handoff.revisionId,
      dispatch_id: fixture.handoff.dispatchId,
      status: fixture.handoff.status,
      handoff_canonical_json: canonicalJsonStringify(fixture.handoff),
      handoff_hash: hashCanonicalJson(fixture.handoff),
      bound_matches_claim: true,
    }], "termination-first pre-expiry publication differs");
  }

  async function terminationFirstImmutableBytes(
    fixture: Awaited<ReturnType<typeof seedPreAttemptPublication>>,
    requestId: string,
  ): Promise<Readonly<{
    delivery: string;
    recoveryCase: string;
    claim: string;
    runtime: string;
    owners: string;
    ownerHead: string;
  }>> {
    const rows = await sql<Array<{
      delivery: string | null;
      recovery_case: string | null;
      claim: string | null;
      runtime: string | null;
      owners: string;
      owner_head: string | null;
    }>>`
      SELECT
        (SELECT row_to_json(delivery_row)::text
           FROM (SELECT * FROM recovery_dispatch_deliveries
                  WHERE dispatch_id=${fixture.handoff.dispatchId}) delivery_row) AS delivery,
        (SELECT row_to_json(case_row)::text
           FROM (SELECT * FROM recovery_cases
                  WHERE recovery_case_id=${fixture.handoff.recoveryCaseId}) case_row) AS recovery_case,
        (SELECT row_to_json(claim_row)::text
           FROM (SELECT * FROM claim_log WHERE id=${String(fixture.claimId)}::bigint) claim_row) AS claim,
        (SELECT row_to_json(runtime_row)::text
           FROM (SELECT * FROM runtime_sessions WHERE session_id=${fixture.sessionId}) runtime_row) AS runtime,
        (SELECT COALESCE(json_agg(owner_row ORDER BY owner_row.category,owner_row.owner_key)::text,'[]')
           FROM (SELECT * FROM internal_production_owner_reservations_v1
                  WHERE (category='run' AND owner_key=${fixture.runId})
                     OR (category='claim' AND owner_key=${String(fixture.claimId)})
                     OR (category='runtime-session' AND owner_key=${fixture.sessionId})
                     OR (category='termination' AND owner_key=${requestId})) owner_row) AS owners,
        (SELECT head_version::text FROM internal_production_owner_admission_head_v1
          WHERE singleton=TRUE) AS owner_head
    `;
    assert.equal(rows.length, 1);
    const row = rows[0]!;
    assert.ok(row.delivery && row.recovery_case && row.claim && row.runtime && row.owner_head,
      "termination-first immutable byte snapshot is incomplete");
    return Object.freeze({
      delivery: row.delivery,
      recoveryCase: row.recovery_case,
      claim: row.claim,
      runtime: row.runtime,
      owners: row.owners,
      ownerHead: row.owner_head,
    });
  }

  async function expiryOwnerCloses(
    fixture: Awaited<ReturnType<typeof seedPreAttemptPublication>>,
  ): Promise<readonly Task8ExpiryOwnerCloseWitnessV1[]> {
    return sql<Array<Task8ExpiryOwnerCloseWitnessV1>>`
      SELECT category,state,close_ref,close_hash,updated_at::text AS updated_at
        FROM internal_production_owner_reservations_v1
       WHERE (category='claim' AND owner_key=${String(fixture.claimId)})
          OR (category='runtime-session' AND owner_key=${fixture.sessionId})
       ORDER BY category
    `;
  }

  async function terminateAfterDrain(
    fixture: Awaited<ReturnType<typeof seedPreAttemptPublication>>,
    label: string,
    observeBoundary?: (
      boundary: "after-compound" | "after-compound-replay",
    ) => Promise<void>,
    alreadyClaimed = false,
  ): Promise<Readonly<{
    ownerHeadBeforeCompound: string;
    ownerHeadAfterCompound: string;
    ownerHeadAfterCompoundReplay: string;
    expiryOwnerClosesAfterCompound: readonly Task8ExpiryOwnerCloseWitnessV1[];
    expiryOwnerClosesAfterCompoundReplay: readonly Task8ExpiryOwnerCloseWitnessV1[];
  }>> {
    const requestId = `RTR_task8-compound-expiry-${label}`;
    assertCanonicalTerminationRequestId(requestId);
    const diagnostic = `Task 8 ${label} termination`;
    const beforeRequests = await sql<Array<{
      request_id: string;
      target_status: string;
      requested_by: string;
      diagnostic: string;
    }>>`
      SELECT request_id,target_status,requested_by,diagnostic
        FROM run_termination_requests
       WHERE run_id=${fixture.runId}
       ORDER BY request_id
    `;
    assert.ok(beforeRequests.length === 0 || beforeRequests.length === 1);
    const requested = await requestRunTermination(sql, {
      runId: fixture.runId,
      targetStatus: "failed",
      requestedBy: "task8-compound-expiry",
      diagnostic,
      requestId,
    });
    assert.equal(requested.status, beforeRequests.length === 0 ? "requested" : "existing");
    if (requested.status === "already_terminal") throw new Error("Task 8 termination absent");
    assert.deepEqual(
      [...await sql`
        SELECT request_id,target_status,requested_by,diagnostic
          FROM run_termination_requests
         WHERE run_id=${fixture.runId}
         ORDER BY request_id
      `],
      [{
        request_id: requestId,
        target_status: "failed",
        requested_by: "task8-compound-expiry",
        diagnostic,
      }],
    );
    const terminations = createRunTerminationRepository(sql);
    const ownerInstanceId = `task8-${label}-termination-owner`;
    if (!alreadyClaimed) {
      const claimed = await terminations.claim({ requestId, ownerInstanceId });
      assert.ok(claimed);
    }
    const runtime = await fixture.sessions.findById(fixture.sessionId);
    assert.ok(runtime);
    if (runtime.state === "drain_requested") {
      await fixture.sessions.markDrained({
        sessionId: fixture.sessionId,
        ownerInstanceId: runtime.ownerInstanceId,
        evidence: drainEvidence,
      });
    }
    await terminations.markDrained({
      requestId,
      ownerInstanceId,
      evidence: { proofRef: `setfarm://test/task8/${label}` },
    });
    const ownerHeadBeforeCompound = await ownerHead();
    const terminal = await terminations.terminalize({ requestId });
    assert.equal(terminal.status, "failed");
    const ownerHeadAfterCompound = await ownerHead();
    const expiryOwnerClosesAfterCompound = await expiryOwnerCloses(fixture);
    await observeBoundary?.("after-compound");
    assert.equal((await terminations.terminalize({ requestId })).status, "failed");
    const ownerHeadAfterCompoundReplay = await ownerHead();
    const expiryOwnerClosesAfterCompoundReplay = await expiryOwnerCloses(fixture);
    await observeBoundary?.("after-compound-replay");
    return Object.freeze({
      ownerHeadBeforeCompound,
      ownerHeadAfterCompound,
      ownerHeadAfterCompoundReplay,
      expiryOwnerClosesAfterCompound,
      expiryOwnerClosesAfterCompoundReplay,
    });
  }

    const compoundFirst = await seedPreAttemptPublication("compound-first");
    const pristine = await snapshot(compoundFirst.runId);
    await assert.rejects(
      transitionRunToTerminal(sql, {
        runId: compoundFirst.runId,
        status: "failed",
        diagnostic: "Task 8 pristine compound-first",
      }),
      /RUN_TERMINAL_FAIL_DRAIN_PROOF_REQUIRED/,
    );
    assert.deepEqual(await snapshot(compoundFirst.runId), pristine);
    await expire(compoundFirst.handoff);
    const compoundFirstExpiry = await compoundFirst.reconciler.reconcileActive({
      runId: compoundFirst.runId,
    });
    assert.equal(
      compoundFirstExpiry.counts.rolledBackPublications,
      1,
      JSON.stringify(compoundFirstExpiry),
    );

    const terminationFirst = await seedPreAttemptPublication("termination-first");
    const terminationFirstRequestId = "RTR_task8-compound-expiry-termination-first";
    assertCanonicalTerminationRequestId(terminationFirstRequestId);
    const requested = await requestRunTermination(sql, {
      runId: terminationFirst.runId,
      targetStatus: "failed",
      requestedBy: "task8-compound-expiry",
      diagnostic: "Task 8 termination-first termination",
      requestId: terminationFirstRequestId,
    });
    assert.equal(requested.status, "requested");
    const terminationFirstTerminations = createRunTerminationRepository(sql);
    const terminationFirstOwnerInstanceId = "task8-termination-first-termination-owner";
    assert.ok(await terminationFirstTerminations.claim({
      requestId: terminationFirstRequestId,
      ownerInstanceId: terminationFirstOwnerInstanceId,
    }));
    assert.deepEqual([...await sql`
      SELECT run.status AS run_status,termination.state AS termination_state,
             termination.owner_instance_id,runtime.state AS runtime_state
        FROM runs run
        JOIN run_termination_requests termination ON termination.run_id=run.id
        JOIN runtime_sessions runtime ON runtime.run_id=run.id
       WHERE run.id=${terminationFirst.runId}
    `], [{
      run_status: "failing",
      termination_state: "draining",
      owner_instance_id: terminationFirstOwnerInstanceId,
      runtime_state: "drain_requested",
    }], "termination request/claim must own a nonactive run before delivery expiry");
    await assertExactPreAttemptPublication(terminationFirst);
    await expire(terminationFirst.handoff);
    const terminationFirstExpiryProof = await sql<Array<{
      expired: boolean;
    }>>`
      SELECT lease_expires_at <= clock_timestamp() AS expired
        FROM recovery_dispatch_deliveries
       WHERE dispatch_id=${terminationFirst.handoff.dispatchId}
    `;
    assert.deepEqual([...terminationFirstExpiryProof], [{ expired: true }],
      "termination-first delivery must expire by database time before reconciliation");
    const beforeReport = await terminationFirstImmutableBytes(
      terminationFirst,
      terminationFirstRequestId,
    );
    const reportOnly = await terminationFirst.reconciler.reconcileActive({
      runId: terminationFirst.runId,
    });
    assert.equal(reportOnly.counts.rolledBackPublications, 0, JSON.stringify(reportOnly));
    assert.ok(reportOnly.events.some((event) => (
      event.code === "V3_RECOVERY_LIFECYCLE_TERMINATION_PENDING"
      || event.code === "V3_RECOVERY_LIFECYCLE_RUN_NOT_ACTIVE"
    )));
    assert.deepEqual(
      await terminationFirstImmutableBytes(terminationFirst, terminationFirstRequestId),
      beforeReport,
      "termination-first report-only reconciliation changed delivery/case/claim/runtime/owners/head bytes",
    );
    await assertExactPreAttemptPublication(terminationFirst);
    await terminateAfterDrain(terminationFirst, "termination-first", undefined, true);
    assert.equal((await snapshot(terminationFirst.runId)).run_status, "failed");

    const expiryFirst = await seedPreAttemptPublication("expiry-first");
    await expire(expiryFirst.handoff);
    const ownerHeadBeforeExpiry = await ownerHead();
    const expiryCommitted = await expiryFirst.reconciler.reconcileActive({
      runId: expiryFirst.runId,
    });
    assert.equal(expiryCommitted.counts.rolledBackPublications, 1);
    const ownerHeadAfterExpiry = await ownerHead();
    assert.deepEqual(await snapshot(expiryFirst.runId), {
      run_status: "running",
      claim_outcome: "infra_retry",
      runtime_state: "released",
      claim_owner_state: "closed",
      runtime_owner_state: "closed",
      delivery_state: "blocked",
      case_status: "blocked",
      termination_state: null,
    });
    const expiryOwnerClosesBeforeCompound = await expiryOwnerCloses(expiryFirst);
    let sameDispatchRefusalCode = "";
    await assert.rejects(
      createV3RecoveryClaimAuthority(sql).acquireRecoveryClaim({
        runId: expiryFirst.runId,
        storyId: expiryFirst.storyId,
        ownerInstanceId: "task8-expiry-first-refused-owner",
        leaseMs: 60_000,
      }),
      (error: unknown) => {
        sameDispatchRefusalCode = String((error as { code?: unknown }).code ?? "");
        return sameDispatchRefusalCode === "V3_RECOVERY_AUTHORITY_DELIVERY_NOT_FOUND";
      },
    );
    assert.equal(await ownerHead(), ownerHeadAfterExpiry, "same-dispatch refusal advanced owner head");

    const successor = await seedPreAttemptPublication("expiry-first-successor");
    const successorFindings = createFindingRecoveryRepository(sql);
    const successorDeliveries = createRecoveryDeliveryRepository(sql);
    const successorHandoff = successor.handoff;
    assert.equal(successorHandoff.status, "lease_acquired");
    assert.notEqual(successor.runId, expiryFirst.runId, "Task 8 successor must use an isolated run");
    async function successorCanonicalSnapshot(): Promise<Task8SuccessorCanonicalSnapshotV1> {
      const [delivery, recoveryCase] = await Promise.all([
        successorDeliveries.findDelivery(successorHandoff.dispatchId),
        successorFindings.findRecoveryCase(successorHandoff.recoveryCaseId),
      ]);
      assert.ok(delivery, "Task 8 successor canonical delivery is missing");
      assert.ok(recoveryCase, "Task 8 successor canonical recovery case is missing");
      return structuredClone({ delivery, recoveryCase });
    }
    async function expiredTerminalState(): Promise<Readonly<{
      deliveryState: string;
      caseStatus: string;
    }>> {
      const [delivery, recoveryCases] = await Promise.all([
        successorDeliveries.findDelivery(expiryFirst.handoff.dispatchId),
        sql<Array<{ status: string }>>`
          SELECT status FROM recovery_cases WHERE recovery_case_id=${expiryFirst.handoff.recoveryCaseId}
        `,
      ]);
      assert.ok(delivery, "Task 8 expired delivery is missing");
      assert.equal(recoveryCases.length, 1, "Task 8 expired recovery case is missing");
      return Object.freeze({
        deliveryState: delivery.state,
        caseStatus: recoveryCases[0]!.status,
      });
    }
    const expiredDeliveryBeforeCompound = await successorDeliveries.findDelivery(expiryFirst.handoff.dispatchId);
    const successorDeliveryBeforeCompound = await successorDeliveries.findDelivery(successorHandoff.dispatchId);
    const expiredCaseBeforeCompound = await sql<Array<{ status: string }>>`
      SELECT status FROM recovery_cases WHERE recovery_case_id=${expiryFirst.handoff.recoveryCaseId}
    `;
    const successorBeforeCompound = await successorCanonicalSnapshot();
    let successorAfterCompound: Task8SuccessorCanonicalSnapshotV1 | undefined;
    let successorAfterCompoundReplay: Task8SuccessorCanonicalSnapshotV1 | undefined;
    let expiredAfterCompound: Awaited<ReturnType<typeof expiredTerminalState>> | undefined;
    let expiredAfterCompoundReplay: Awaited<ReturnType<typeof expiredTerminalState>> | undefined;
    const compoundHeads = await terminateAfterDrain(
      expiryFirst,
      "expiry-first",
      async (boundary) => {
        const [successor, expired] = await Promise.all([
          successorCanonicalSnapshot(),
          expiredTerminalState(),
        ]);
        if (boundary === "after-compound") {
          successorAfterCompound = successor;
          expiredAfterCompound = expired;
          return;
        }
        successorAfterCompoundReplay = successor;
        expiredAfterCompoundReplay = expired;
      },
    );
    assert.ok(successorAfterCompound, "Task 8 successor post-compound snapshot is missing");
    assert.ok(successorAfterCompoundReplay, "Task 8 successor replay snapshot is missing");
    assert.ok(expiredAfterCompound, "Task 8 expired post-compound snapshot is missing");
    assert.ok(expiredAfterCompoundReplay, "Task 8 expired replay snapshot is missing");
    assertTask8ExpiryFirstWitnessV1({
      expiredDispatchId: expiryFirst.handoff.dispatchId,
      successorDispatchId: successorHandoff.dispatchId,
      expiredCaseId: expiryFirst.handoff.recoveryCaseId,
      successorCaseId: successorHandoff.recoveryCaseId,
      expiredDeliveryState: expiredDeliveryBeforeCompound?.state ?? "missing",
      expiredCaseStatus: expiredCaseBeforeCompound[0]?.status ?? "missing",
      expiredDeliveryStateAfterCompound: expiredAfterCompound.deliveryState,
      expiredCaseStatusAfterCompound: expiredAfterCompound.caseStatus,
      expiredDeliveryStateAfterCompoundReplay: expiredAfterCompoundReplay.deliveryState,
      expiredCaseStatusAfterCompoundReplay: expiredAfterCompoundReplay.caseStatus,
      successorDeliveryState: successorDeliveryBeforeCompound?.state ?? "missing",
      sameDispatchRefusalCode,
      ownerHeadBeforeExpiry,
      ownerHeadAfterExpiry,
      ...compoundHeads,
      expiryOwnerClosesBeforeCompound,
      successorBeforeCompound,
      successorAfterCompound,
      successorAfterCompoundReplay,
    });
    assert.deepEqual(
      [...await sql`SELECT status FROM runs WHERE id=${expiryFirst.runId}`],
      [{ status: "failed" }],
    );
    await terminateAfterDrain(successor, "expiry-first-successor-cleanup");
    const successorCleanupRequestId = "RTR_task8-compound-expiry-expiry-first-successor-cleanup";
    const successorOwnerStates = await sql<Array<{ category: string; state: string }>>`
      SELECT category,state
        FROM internal_production_owner_reservations_v1
       WHERE (category='run' AND owner_key=${successor.runId})
          OR (category='claim' AND owner_key=${String(successor.claimId)})
          OR (category='runtime-session' AND owner_key=${successor.sessionId})
          OR (category='termination' AND owner_key=${successorCleanupRequestId})
       ORDER BY category
    `;
    assert.deepEqual([...successorOwnerStates], [
      { category: "claim", state: "closed" },
      { category: "run", state: "closed" },
      { category: "runtime-session", state: "closed" },
      { category: "termination", state: "closed" },
    ]);
  } finally {
    await db.pgClose();
    rmSync(path.dirname(root), { recursive: true, force: true });
    activatedOwnerAdmissionFixture = null;
  }
});
