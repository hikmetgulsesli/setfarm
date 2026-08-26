import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { chmodSync, existsSync, linkSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, renameSync, rmSync, statSync, symlinkSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { test } from "node:test";

const sourcePath = path.resolve(import.meta.dirname, "../../src/internal-production/baseline-restart-authority-retirement-v1.ts");

function canonical(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${canonical(record[key])}`).join(",")}}`;
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function recursivelyFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    for (const member of Object.values(value as Record<string, unknown>)) recursivelyFreeze(member);
    Object.freeze(value);
  }
  return value;
}

function cutoverReadinessFixture(fixture: string): Readonly<Record<string, unknown>> {
  const epoch = JSON.parse(readFileSync(path.join(fixture, "data/internal-production-baseline/restart-authority-retirement-v1/epoch-head.json"), "utf8"));
  const sourceSha = "a".repeat(40);
  const buildHash = "b".repeat(64);
  const forward = [
    ["restart-reservation", "restart-reservation", "d-restart-reservation-v1", "reserveInternalProductionServiceRestartDispatchOwnerV1"],
    ["service-restart-operation", "service-restart-operation", "d-service-restart-operation-v1", "reserveInternalProductionServiceRestartOperationOwnerV1"],
    ["launch-outbox", "launch-outbox", "d-service-restart-launch-outbox-v1", "publishInternalProductionServiceRestartLaunchOutboxUnderFenceV1"],
    ["helper-process", "process", "d-service-restart-helper-process-v1", "publishInternalProductionServiceRestartHelperProcessUnderFenceV1"],
    ["dispatch-child-process", "process", "d-service-restart-child-process-v1", "publishInternalProductionServiceRestartDispatchChildProcessUnderFenceV1"],
    ["startup-listener", "listener", "d-service-restart-startup-listener-v1", "publishInternalProductionServiceRestartStartupListenerUnderFenceV1"],
    ["replacement-process", "process", "d-service-restart-replacement-process-v1", "publishInternalProductionServiceRestartReplacementProcessUnderFenceV1"],
  ].map(([role, category, producerImplementationId, expectedExportName], index) => ({ role, category, producerImplementationId, expectedModuleRelativePath: "src/internal-production/internal-production-service-restart-authority-v1.ts", expectedExportName, moduleBlobHash: String(index + 1).repeat(40), sourceSha, buildHash }));
  const migrationReceiptHash = "c".repeat(64);
  return recursivelyFreeze({ schema: "setfarm.internal-production-service-restart-startup-hooks-ready.v1", setfarmSourceSha: sourceSha, missionControlSourceSha: "d".repeat(40), setfarmBuildHash: buildHash, missionControlBuildHash: "e".repeat(64), migrationReceiptRef: `setfarm://internal-production/baseline-bootstrap-handoff-migration-receipt/sha256/${migrationReceiptHash}`, migrationReceiptHash, migrationSourceSha: sourceSha, migrationImplementationBlobHash: "f".repeat(40), orderedStatementsHash: "1".repeat(64), namedMigrationDigestEntryHash: "2".repeat(64), migrationDigest: "3".repeat(64), schemaProjectionHash: "4".repeat(64), physicalRestartEpochRef: epoch.epochRef, physicalRestartEpochHash: epoch.epochHash, physicalRestartEpochOrdinal: 1, physicalRestartAuthorityOwner: "baseline-a", dForwardIdentityRegistryHash: "c3d88ba2dc7d9e70d773d0056d2fdeaced399f63adc7fd1c37eb423fa22d08d5", dForwardImplementationIdentities: forward, spawnerHookImplementationId: "recovery-d-setfarm-spawner-startup-v1", spawnerHookImplementationHash: "5".repeat(64), dashboardHookImplementationId: "recovery-d-setfarm-dashboard-startup-v1", dashboardHookImplementationHash: "6".repeat(64), missionControlHookImplementationId: "recovery-d-mission-control-startup-v1", missionControlHookImplementationHash: "7".repeat(64), runtimeSourceProjectionHash: "8".repeat(64), recoveryPrepareState: "disabled-by-baseline-epoch-one" });
}

function cutoverGateFixture(readiness: Readonly<Record<string, unknown>>): Readonly<Record<string, unknown>> {
  const recoveryProducerManifestActivationHash = "9".repeat(64);
  const missionControlHandoffHash = "a".repeat(64);
  return Object.freeze({
    schema: "setfarm.internal-production-reviewed-d-source-build-gate.v1",
    reviewed: true,
    setfarmSourceSha: readiness.setfarmSourceSha,
    missionControlSourceSha: readiness.missionControlSourceSha,
    setfarmBuildHash: readiness.setfarmBuildHash,
    missionControlBuildHash: readiness.missionControlBuildHash,
    recoveryProducerManifestActivationRef: `setfarm://internal-production/recovery-owner-producer-manifest-activation/sha256/${recoveryProducerManifestActivationHash}`,
    recoveryProducerManifestActivationHash,
    missionControlHandoffRef: `setfarm://internal-production/recovery-mission-control-source-handoff/sha256/${missionControlHandoffHash}`,
    missionControlHandoffHash,
  });
}

function completeZeroFixture(): Readonly<Record<string, unknown>> {
  const keys = ["activeRunCount", "openClaimCount", "executionAttemptCount", "activeRuntimeSessionCount", "activeCompletionOwnerCount", "unsettledMandatoryEffectCount", "ordinaryStartingCount", "restartReservationCount", "serviceRestartOperationCount", "launchPreparationCount", "preparedLaunchCount", "stagedCaseCount", "fixtureAttemptCount", "artifactReservationCount", "publicationBatchCount", "artifactPublicationCount", "docsSessionCount", "docsLeaseCount", "fleetStageCount", "fleetInflightCount", "fleetPendingReviewCount", "matrixInflightCount", "launchOutboxCount", "terminationOwnerCount", "findingOwnerCount", "recoveryOwnerCount", "operationalDeliveryCount", "sourceRunOwnerCount", "coldRehearsalOwnerCount", "compilationLeaseCount", "executionLeaseCount", "ownedProcessCount", "ownedListenerCount", "ownedWorktreeCount", "dirtyWorktreeCount", "staleChildCount"];
  const body = { schema: "setfarm.internal-production-complete-zero-owner-census-observation.v1", census: Object.fromEntries(keys.map((key) => [key, 0])), ownerCategoryRegistryHash: "1".repeat(64), ownerCategoryCensusMapHash: "2".repeat(64), activeProducerManifestSetActivationRef: `setfarm://internal-production/owner-producer-manifest-set-activation/sha256/${"3".repeat(64)}`, activeProducerManifestSetActivationHash: "3".repeat(64), activeProducerManifestSetHash: "4".repeat(64), reservationIdentitySetHash: "5".repeat(64), ownerIdentitySetHash: "6".repeat(64) };
  const observationHash = sha256(canonical(body));
  return recursivelyFreeze({ ...body, observationRef: `setfarm://internal-production/complete-zero-owner-census-observation/sha256/${observationHash}`, observationHash });
}

function seedPreSchemaHelperClosure(fixture: string): Readonly<Record<string, unknown>> {
  const root = path.join(fixture, "data/internal-production-baseline/restart-authority-retirement-v1");
  mkdirSync(root, { recursive: true, mode: 0o700 });
  const operationHash = "a".repeat(64);
  const restartAuthorityHash = "b".repeat(64);
  const currentEntryOperation = { operationRef: `setfarm://internal-production/current-entry-operation/sha256/${operationHash}`, operationHash };
  const restartAuthority = { restartAuthorityRef: `setfarm://internal-production/pre-schema-spawner-restart-authority/sha256/${restartAuthorityHash}`, restartAuthorityHash };
  const transitionLock = { schema: "setfarm.internal-production-physical-service-restart-authority-transition-lock.v1", pid: 1, processStartTimeEpochMs: 1, processIdentityHash: "c".repeat(64), leaseNonce: "d".repeat(64) };
  const lockIdentity = { devDecimal: "1", inoDecimal: "2" };
  const journalBody = { schema: "setfarm.internal-production-service-restart-helper-journal.v1", family: "pre-schema-spawner-rebind", operationSchema: "setfarm.internal-production-current-entry-operation.v1", operationPurpose: "task6a-internal-production-current-entry-v1", action: "task6a-pre-schema-setfarm-spawner-rebind-v1", currentEntryOperation, restartAuthority, transitionLock, lockIdentity, maximumDispatchCount: 1 };
  const preSchemaHelperJournalHash = sha256(canonical(journalBody));
  writeFileSync(path.join(root, "pre-schema-helper-journal.json"), `${canonical({ ...journalBody, journalHash: preSchemaHelperJournalHash })}\n`, { mode: 0o600 });
  const settlementBody = { schema: "setfarm.internal-production-pre-schema-spawner-rebind-helper-settlement.v1", action: journalBody.action, currentEntryOperation, restartAuthority, journalHash: preSchemaHelperJournalHash, transitionLock, lockIdentity, dispatchCount: 1, disposition: "completed" };
  const preSchemaHelperSettlementHash = sha256(canonical(settlementBody));
  const preSchemaHelperSettlementRef = `setfarm://internal-production/pre-schema-spawner-rebind-helper-settlement/sha256/${preSchemaHelperSettlementHash}`;
  const settlementDirectory = path.join(root, "pre-schema-helper-settlements/sha256", preSchemaHelperSettlementHash.slice(0, 2));
  mkdirSync(settlementDirectory, { recursive: true, mode: 0o700 });
  writeFileSync(path.join(settlementDirectory, `${preSchemaHelperSettlementHash}.json`), `${canonical({ ...settlementBody, helperSettlementRef: preSchemaHelperSettlementRef, helperSettlementHash: preSchemaHelperSettlementHash })}\n`, { mode: 0o600 });
  const retainedHelperJournalSettlementSetHash = sha256(canonical({ schema: "setfarm.internal-production-baseline-service-restart-helper-retained-authority-set.v1", preSchemaHelperState: "terminal", preSchemaHelperJournalHash, preSchemaHelperSettlementRef, preSchemaHelperSettlementHash, orderedRegistryEntries: [] }));
  const censusBody = { schema: "setfarm.internal-production-baseline-service-restart-helper-journal-census.v1", preSchemaHelperState: "terminal", registeredBaselineHelperJournalCount: 0, terminalBaselineHelperJournalCount: 0, liveBaselineHelperJournalCount: 0, ambiguousBaselineHelperJournalCount: 0, helperJournalRegistryHeadRef: null, helperJournalRegistryHeadHash: null, retainedHelperJournalSettlementSetHash };
  return Object.freeze({ ...censusBody, censusHash: sha256(canonical(censusBody)) });
}

function cutoverGuardFixture(completeZero: Readonly<Record<string, unknown>>, helperCensusHash: string): Readonly<Record<string, unknown>> {
  const core = {
    schema: "setfarm.internal-production-baseline-zero-owner-mutation-guard.v1",
    completeZeroOwnerCensusObservationRef: completeZero.observationRef,
    completeZeroOwnerCensusObservationHash: completeZero.observationHash,
    baselineServiceRestartHelperJournalCensusHash: helperCensusHash,
    guardNonce: "7".repeat(64),
  };
  const zeroOwnerGuardHash = sha256(canonical(core));
  return Object.freeze({ ...core, zeroOwnerGuardRef: `setfarm://internal-production/baseline-zero-owner-mutation-guard/sha256/${zeroOwnerGuardHash}`, zeroOwnerGuardHash });
}

function seedCompletedSequenceHistory(fixture: string, intentKind: "live-rebind" | "d-startup-hook-load" | "documentation-rollback", readiness: Readonly<Record<string, unknown>>, firstBeforeOverride?: string, finalZeroHash = "b".repeat(64)): Readonly<Record<string, string>> {
  const root = path.join(fixture, "data/internal-production-baseline/baseline-service-restart-sequence-v1");
  const intentDirectoryHash = sha256(canonical({ schema: "setfarm.internal-production-baseline-restart-sequence-intent.v1", intentKind }));
  const intentDirectory = path.join(root, "intents", intentDirectoryHash);
  const orderedServiceActions = [{ service: "setfarm-spawner", actionId: "a-restart-service-setfarm-spawner-v1" }, { service: "setfarm-dashboard", actionId: "a-restart-service-setfarm-dashboard-v1" }, { service: "mission-control", actionId: "a-restart-service-mission-control-v1" }];
  const headerBody = { schema: "setfarm.internal-production-baseline-restart-sequence-intent.v1", intentKind, migrationReceiptRef: readiness.migrationReceiptRef, migrationReceiptHash: readiness.migrationReceiptHash, migrationSchemaProjectionHash: readiness.schemaProjectionHash, initialRuntimeSourceProjectionHash: readiness.runtimeSourceProjectionHash, orderedServiceActions };
  const sequenceIntentHash = sha256(canonical(headerBody));
  const sequenceIntentRef = `setfarm://internal-production/baseline-restart-sequence-intent/sha256/${sequenceIntentHash}`;
  mkdirSync(intentDirectory, { recursive: true, mode: 0o700 });
  const headerStore = path.join(root, "sequence-intents/sha256", sequenceIntentHash.slice(0, 2)); mkdirSync(headerStore, { recursive: true, mode: 0o700 });
  writeFileSync(path.join(headerStore, `${sequenceIntentHash}.json`), `${canonical({ ...headerBody, sequenceIntentRef, sequenceIntentHash })}\n`, { mode: 0o600 });
  writeFileSync(path.join(intentDirectory, "sequence-intent.pair.json"), `${canonical({ sequenceIntentRef, sequenceIntentHash })}\n`, { mode: 0o600 });
  const advances: Array<Record<string, unknown>> = [];
  for (const [ordinal, fixed] of orderedServiceActions.entries()) {
    const authorizationHash = String(ordinal + 1).repeat(64); const authorizationRef = `setfarm://internal-production/baseline-service-restart-authorization/sha256/${authorizationHash}`;
    writeFileSync(path.join(intentDirectory, `${String(ordinal).padStart(2, "0")}-service-authorization.pair.json`), `${canonical({ authorizationRef, authorizationHash })}\n`, { mode: 0o600 });
    const authorityHash = String(ordinal + 4).repeat(64); const authorityRef = `setfarm://internal-production/baseline/service-restarts/${authorityHash}`;
    const before = ordinal === 0 ? (firstBeforeOverride ?? readiness.runtimeSourceProjectionHash) : advances[ordinal - 1]!.afterRuntimeSourceProjectionHash;
    const after = String(ordinal + 7).repeat(64);
    const body = { schema: "setfarm.internal-production-baseline-service-restart-advance.v1", intentKind, sequenceIntentHash, ordinal, ...fixed, migrationReceiptRef: readiness.migrationReceiptRef, migrationReceiptHash: readiness.migrationReceiptHash, initialRuntimeSourceProjectionHash: readiness.runtimeSourceProjectionHash, authorizationRef, authorizationHash, authorityRef, authorityHash, priorAdvanceHash: ordinal === 0 ? null : advances[ordinal - 1]!.advanceHash, beforeRuntimeSourceProjectionHash: before, afterRuntimeSourceProjectionHash: after, completeZeroOwnerCensusHash: "a".repeat(64) };
    const advanceHash = sha256(canonical(body)); const advanceRef = `setfarm://internal-production/baseline-service-restart-advance/sha256/${advanceHash}`; const value = { ...body, advanceRef, advanceHash }; advances.push(value);
    const store = path.join(root, "advances/sha256", advanceHash.slice(0, 2)); mkdirSync(store, { recursive: true, mode: 0o700 }); writeFileSync(path.join(store, `${advanceHash}.json`), `${canonical(value)}\n`, { mode: 0o600 });
    writeFileSync(path.join(intentDirectory, `${String(ordinal).padStart(2, "0")}-service-advance.pair.json`), `${canonical({ advanceRef, advanceHash })}\n`, { mode: 0o600 });
  }
  const receiptBody = { schema: "setfarm.internal-production-baseline-restart-sequence-receipt.v1", intentKind, sequenceIntentHash, migrationReceiptRef: readiness.migrationReceiptRef, migrationReceiptHash: readiness.migrationReceiptHash, migrationSchemaProjectionHash: readiness.schemaProjectionHash, initialRuntimeSourceProjectionHash: readiness.runtimeSourceProjectionHash, orderedServices: orderedServiceActions.map(({ service }) => service), authorityPairs: advances.map((advance) => ({ service: advance.service, actionId: advance.actionId, authorityRef: advance.authorityRef, authorityHash: advance.authorityHash })), orderedAdvanceHashes: advances.map((advance) => advance.advanceHash), finalRuntimeSourceProjectionHash: advances[2]!.afterRuntimeSourceProjectionHash, finalCompleteZeroOwnerCensusHash: finalZeroHash };
  const sequenceHash = sha256(canonical(receiptBody)); const sequenceRef = `setfarm://internal-production/baseline/restart-sequences/${sequenceHash}`; const receipt = { ...receiptBody, sequenceRef, sequenceHash };
  const receiptStore = path.join(root, "receipts/sha256", sequenceHash.slice(0, 2)); mkdirSync(receiptStore, { recursive: true, mode: 0o700 }); writeFileSync(path.join(receiptStore, `${sequenceHash}.json`), `${canonical(receipt)}\n`, { mode: 0o600 });
  writeFileSync(path.join(intentDirectory, "03-sequence-receipt.pair.json"), `${canonical({ sequenceRef, sequenceHash })}\n`, { mode: 0o600 });
  return Object.freeze({ intentKind, sequenceRef, sequenceHash, sequenceReceiptSemanticHash: sha256(canonical(receipt)) });
}

function installRetirementFixture(fixture: string, source: string): string {
  const internal = path.join(fixture, "src/internal-production");
  mkdirSync(internal, { recursive: true });
  const fixtureModulePath = path.join(internal, "baseline-restart-authority-retirement-v1.ts");
  const censusReturn = "return orderedFrozenV1({ ...body, censusHash: sha256(canonical(body)) }) as InternalProductionBaselineServiceRestartHelperJournalCensusV1;";
  const instrumentedSource = source.replace(censusReturn, `if ((globalThis as Record<string, unknown>).__p4HelperCensusDriftAfterConsumption && (globalThis as Record<string, unknown>).__p4GuardConsumption) { const drifted = { ...body, retainedHelperJournalSettlementSetHash: "f".repeat(64) }; return orderedFrozenV1({ ...drifted, censusHash: sha256(canonical(drifted)) }) as InternalProductionBaselineServiceRestartHelperJournalCensusV1; } ${censusReturn}`);
  assert.notEqual(instrumentedSource, source, "fixture installs only the exact helper-census drift hook");
  writeFileSync(fixtureModulePath, instrumentedSource);
  writeFileSync(path.join(internal, "baseline-post-handoff-receipt-v1.ts"), `
import {createHash} from "node:crypto";
import {mkdirSync,writeFileSync} from "node:fs";
import path from "node:path";
const canonical=(value)=>value===null||typeof value!=="object"?JSON.stringify(value):Array.isArray(value)?\`[\${value.map(canonical).join(",")}]\`:\`{\${Object.keys(value).sort().map((key)=>\`\${JSON.stringify(key)}:\${canonical(value[key])}\`).join(",")}\`+"}";
const hash=(value)=>createHash("sha256").update(canonical(value)).digest("hex");
export async function resolveInternalProductionCurrentEntryOperationV1(value){return {...value,schema:"setfarm.internal-production-current-entry-operation.v1",purpose:"task6a-internal-production-current-entry-v1"}}
export async function observeInternalProductionServiceCensusV1(){return globalThis.__p4ServiceCensus}
export async function resolveInternalProductionBaselineServiceRestartOperationV1(input){const value=globalThis.__p4BaselineOperation;if(!value||value.operationRef!==input.operationRef||value.operationHash!==input.operationHash)throw new Error("crossed fixture baseline operation");return value}
export async function observePreparedInternalProductionBaselineServiceRestartLaunchOutboxV1(input){const value=globalThis.__p4BaselineOutbox;if(!value||value.operationRef!==input.operationRef||value.operationHash!==input.operationHash)throw new Error("crossed fixture baseline outbox");return value}
export async function observeInternalProductionReviewedDSourceBuildGateV1(){if(!globalThis.__p4CutoverGate)throw new Error("complete code-owned cutover readiness gate is unavailable");return globalThis.__p4CutoverGate}
export async function observeInternalProductionServiceRestartCutoverReadinessCandidateV1(){if(!globalThis.__p4CutoverReadiness)throw new Error("complete code-owned cutover readiness observer is unavailable");if(globalThis.__p4ReadinessDriftAfterConsumption&&globalThis.__p4GuardConsumption)return Object.freeze({...globalThis.__p4CutoverReadiness,runtimeSourceProjectionHash:${JSON.stringify("f".repeat(64))}});return globalThis.__p4CutoverReadiness}
export async function observeCompleteInternalProductionZeroOwnerCensusV1(){if(!globalThis.__p4CompleteZero)throw new Error("complete zero unavailable");return globalThis.__p4CompleteZero}
export async function resolveInternalProductionCompleteZeroOwnerCensusObservationV1(input){const value=globalThis.__p4CompleteZero;if(!value||value.observationRef!==input.observationRef||value.observationHash!==input.observationHash)throw new Error("crossed complete zero pair");return value}
export async function resolveInternalProductionBaselineZeroOwnerMutationGuardV1(input){const value=globalThis.__p4CutoverGuard;if(!value||value.zeroOwnerGuardRef!==input.zeroOwnerGuardRef||value.zeroOwnerGuardHash!==input.zeroOwnerGuardHash)throw new Error("crossed guard pair");return value}
export async function consumeInternalProductionBaselinePhysicalServiceRestartAuthorityCutoverZeroOwnerGuardV1(input){
  globalThis.__p4GuardConsumeCalls=(globalThis.__p4GuardConsumeCalls??0)+1;
  const guard=await resolveInternalProductionBaselineZeroOwnerMutationGuardV1({zeroOwnerGuardRef:input.zeroOwnerGuardRef,zeroOwnerGuardHash:input.zeroOwnerGuardHash});
  if(globalThis.__p4OwnerFenceReobservations<1)throw new Error("guard consumed without fresh held fence reobservation");
  const body={schema:"setfarm.internal-production-baseline-physical-service-restart-authority-cutover-zero-owner-guard-consumption.v1",purpose:"recovery-d-physical-service-restart-authority-cutover-v1",zeroOwnerGuardRef:guard.zeroOwnerGuardRef,zeroOwnerGuardHash:guard.zeroOwnerGuardHash,completeZeroOwnerCensusObservationRef:guard.completeZeroOwnerCensusObservationRef,completeZeroOwnerCensusObservationHash:guard.completeZeroOwnerCensusObservationHash,baselineServiceRestartHelperJournalCensusHash:guard.baselineServiceRestartHelperJournalCensusHash,operationRef:input.operationRef,operationHash:input.operationHash,guardConsumed:true};
  const consumptionHash=hash(body);const value=Object.freeze({...body,consumptionRef:"setfarm://internal-production/baseline-physical-service-restart-authority-cutover-zero-owner-guard-consumption/sha256/"+consumptionHash,consumptionHash});
  if(globalThis.__p4GuardConsumption&&canonical(globalThis.__p4GuardConsumption)!==canonical(value))throw new Error("cross-purpose guard consumption");
  const root=path.resolve(import.meta.dirname,"../..");const indexDirectory=path.join(root,"data/internal-production-baseline/zero-owner-mutation-guard-v1/consumed-guards/sha256",guard.zeroOwnerGuardHash.slice(0,2));mkdirSync(indexDirectory,{recursive:true,mode:0o700});writeFileSync(path.join(indexDirectory,guard.zeroOwnerGuardHash+".json"),canonical({consumptionRef:value.consumptionRef,consumptionHash})+String.fromCharCode(10),{mode:0o600});
  globalThis.__p4GuardConsumption=value;return Object.freeze({consumptionRef:value.consumptionRef,consumptionHash});
}
export async function resolveInternalProductionBaselinePhysicalServiceRestartAuthorityCutoverZeroOwnerGuardConsumptionV1(input){const value=globalThis.__p4GuardConsumption;if(!value||value.consumptionRef!==input.consumptionRef||value.consumptionHash!==input.consumptionHash)throw new Error("crossed consumption pair");return value}
`);
  writeFileSync(path.join(internal, "owner-admission-v1.ts"), `
import {createHash} from "node:crypto";
const canonical=(value)=>value===null||typeof value!=="object"?JSON.stringify(value):Array.isArray(value)?\`[\${value.map(canonical).join(",")}]\`:\`{\${Object.keys(value).sort().map((key)=>\`\${JSON.stringify(key)}:\${canonical(value[key])}\`).join(",")}}\`;
const hash=(value)=>createHash("sha256").update(canonical(value)).digest("hex");
const freeze=(value)=>{if(value&&typeof value==="object"&&!Object.isFrozen(value)){for(const member of Object.values(value))freeze(member);Object.freeze(value)}return value};
const categories=${JSON.stringify(["run", "claim", "execution-attempt", "runtime-session", "completion-owner", "mandatory-effect", "ordinary-service-start", "restart-reservation", "service-restart-operation", "launch-preparation", "prepared-launch", "staged-case", "fixture-attempt", "artifact-reservation", "artifact-publication", "docs-session", "docs-lease", "fleet-stage", "fleet-inflight", "fleet-review", "matrix-inflight", "launch-outbox", "termination", "finding", "recovery", "operational-delivery", "source-run", "cold-rehearsal", "compilation-lease", "execution-lease", "process", "listener", "worktree", "dirty-worktree", "stale-child"])};
export async function acquireInternalProductionGlobalOwnerAdmissionFenceV1(input){const body={schema:"setfarm.internal-production-global-owner-admission-fence.v1",purpose:input.purpose,pendingInputRef:input.pendingInputRef,pendingInputHash:input.pendingInputHash,ownerCategories:categories,ownerCategoryRegistryHash:${JSON.stringify("1".repeat(64))},ownerCategoryCensusMapHash:${JSON.stringify("2".repeat(64))},targetFamily:{kind:"none",targetFamilyHash:null},observedUnrelatedReservationCount:0,observedUnrelatedOwnerCount:0,ownerIdentitySetHash:${JSON.stringify("3".repeat(64))},predecessorFenceHeadHash:null,ownerAdmissionHeadHash:${JSON.stringify("4".repeat(64))}};const fenceHash=hash(body);const value=freeze({...body,fenceRef:\`setfarm://internal-production/global-owner-admission-fence/sha256/\${fenceHash}\`,fenceHash});globalThis.__p4OwnerFence=value;globalThis.__p4OwnerFenceReobservations=0;return value}
export async function reobserveInternalProductionGlobalOwnerAdmissionFenceV1(input){const value=globalThis.__p4OwnerFence;if(!value||value.fenceRef!==input.fenceRef||value.fenceHash!==input.fenceHash)throw new Error("crossed fixture fence");globalThis.__p4OwnerFenceReobservations=(globalThis.__p4OwnerFenceReobservations??0)+1;if(globalThis.__p4FenceDriftAfterConsumption&&globalThis.__p4GuardConsumption)return freeze({...value,ownerIdentitySetHash:${JSON.stringify("f".repeat(64))}});return value}
export async function releaseInternalProductionGlobalOwnerAdmissionFenceV1(input){const body={schema:"setfarm.internal-production-global-owner-admission-fence-release.v1",fenceRef:input.fenceRef,fenceHash:input.fenceHash,releaseAuthority:input.releaseAuthority,ownerAdmissionHeadPredecessorHash:${JSON.stringify("4".repeat(64))},ownerAdmissionHeadSuccessorHash:${JSON.stringify("5".repeat(64))}};const releaseHash=hash(body);const value=freeze({...body,releaseRef:\`setfarm://internal-production/global-owner-admission-fence-release/sha256/\${releaseHash}\`,releaseHash});globalThis.__p4FenceRelease=value;return value}
export async function resolveInternalProductionGlobalOwnerAdmissionFenceReleaseV1(input){const value=globalThis.__p4FenceRelease;if(!value||value.releaseRef!==input.releaseRef||value.releaseHash!==input.releaseHash)throw new Error("crossed fixture fence release");return value}
`);
  writeFileSync(path.join(internal, "baseline-spawner-startup-admission-v1.ts"), "export async function resolveInternalProductionPreSchemaSpawnerRestartAuthorityV1(value){const uid=process.getuid?.();return {...value,schema:'setfarm.internal-production-pre-schema-spawner-restart-authority.v1',actionId:'task6a-pre-schema-setfarm-spawner-rebind-v1',service:'setfarm-spawner',currentEntryOperationRef:globalThis.__p4CurrentEntryOperation.operationRef,currentEntryOperationHash:globalThis.__p4CurrentEntryOperation.operationHash,uid,launchdLabel:'com.setrox.setfarm-spawner',executable:'/bin/launchctl',argv:['kickstart','-k',`gui/${uid}/com.setrox.setfarm-spawner`],...(globalThis.__p4RestartOverrides??{})}}\n");
  writeFileSync(path.join(internal, "baseline-service-restart-sequence-v1.ts"), `
import {createHash} from "node:crypto";import {existsSync} from "node:fs";import path from "node:path";
const canonical=(value)=>value===null||typeof value!=="object"?JSON.stringify(value):Array.isArray(value)?\`[\${value.map(canonical).join(",")} ]\`.replace(" ]","]"):\`{\${Object.keys(value).sort().map((key)=>\`\${JSON.stringify(key)}:\${canonical(value[key])}\`).join(",")} }\`.replace(" }","}");
const hash=(value)=>createHash("sha256").update(canonical(value)).digest("hex");
export async function observeInternalProductionBaselineRestartSequenceStatusV1({intentKind}){const root=path.resolve(import.meta.dirname,"../..","data/internal-production-baseline/baseline-service-restart-sequence-v1");const intentHash=hash({schema:"setfarm.internal-production-baseline-restart-sequence-intent.v1",intentKind});const dir=path.join(root,"intents",intentHash);const header=existsSync(path.join(dir,"sequence-intent.pair.json"));const receipt=existsSync(path.join(dir,"03-sequence-receipt.pair.json"));return Object.freeze({intentKind,state:receipt?"completed":header?"in_progress":"absent"})}
export async function resolveInternalProductionBaselineRestartSequenceReceiptV1(input){const value=globalThis.__p4ResolvedSequenceReceipt;if(!value||value.sequenceRef!==input.sequenceRef||value.sequenceHash!==input.sequenceHash)throw new Error("crossed fixture sequence receipt");return value}
`);
  const epochRoot = path.join(fixture, "data/internal-production-baseline/restart-authority-retirement-v1");
  mkdirSync(epochRoot, { recursive: true, mode: 0o700 });
  const epochBody = {
    schema: "setfarm.internal-production-physical-service-restart-authority-epoch.v1",
    epochOrdinal: 1,
    authorityOwner: "baseline-a",
    services: ["setfarm-spawner", "setfarm-dashboard", "mission-control"],
    predecessorEpochRef: null,
    predecessorEpochHash: null,
    retirementRef: null,
    retirementHash: null,
    startupHooksReadyRef: null,
    startupHooksReadyHash: null,
    successorActivationRef: null,
    successorActivationHash: null,
  };
  const epochHash = sha256(canonical(epochBody));
  writeFileSync(path.join(epochRoot, "epoch-head.json"), `${canonical({ ...epochBody, epochRef: `setfarm://internal-production/physical-service-restart-authority-epoch/sha256/${epochHash}`, epochHash })}\n`, { mode: 0o600 });
  return fixtureModulePath;
}

test("P4 restart transition lease authenticates epoch one", async () => {
  const module = await import(`../../src/internal-production/baseline-restart-authority-retirement-v1.js?p4-lease=${Date.now()}`);
  assert.deepEqual(Object.keys(module), [
    "MAX_INTERNAL_PRODUCTION_BASELINE_SERVICE_RESTART_HELPER_REGISTRY_HEAD_ENTRIES_V1",
    "acquireInternalProductionPhysicalServiceRestartAuthorityTransitionLeaseV1",
    "invokeInternalProductionBaselineServiceRestartHelperUnderTransitionLeaseV1",
    "invokeInternalProductionPreSchemaSpawnerRebindHelperUnderTransitionLeaseV1",
    "observeInternalProductionBaselineServiceRestartHelperJournalCensusV1",
    "observeInternalProductionPhysicalServiceRestartAuthorityCutoverStatusV1",
    "prepareInternalProductionPhysicalServiceRestartAuthorityCutoverToRecoveryDV1",
    "releaseInternalProductionPhysicalServiceRestartAuthorityTransitionLeaseV1",
    "resolveInternalProductionBaselineRestartAuthorityRetirementV1",
    "resolveInternalProductionBaselineServiceRestartHelperRegistryHeadV1",
    "resolveInternalProductionBaselineServiceRestartHelperRegistryRegistrationV1",
    "resolveInternalProductionBaselineServiceRestartHelperRegistryTerminalV1",
    "resolveInternalProductionPhysicalServiceRestartAuthorityCutoverOperationV1",
    "resolveInternalProductionServiceRestartAuthorityActivationV1",
    "resolveInternalProductionServiceRestartAuthorityCutoverV1",
    "resolveInternalProductionServiceRestartStartupHooksReadyV1",
    "resumeActiveInternalProductionPhysicalServiceRestartAuthorityCutoverToRecoveryDV1",
  ]);
  assert.equal(module.acquireInternalProductionPhysicalServiceRestartAuthorityTransitionLeaseV1.length, 0);
  assert.equal(module.releaseInternalProductionPhysicalServiceRestartAuthorityTransitionLeaseV1.length, 1);
  assert.equal(module.invokeInternalProductionPreSchemaSpawnerRebindHelperUnderTransitionLeaseV1.length, 2);
  const source = readFileSync(sourcePath, "utf8");
  assert.doesNotMatch(source, /process\.env|globalThis|forTests|dependencies\s*:/);
  assert.match(source, /WeakMap/);
  assert.match(source, /authorityOwner:\s*"baseline-a"/);
  assert.match(source, /held.*released/s);
  assert.match(source, /resolveInternalProductionBaselineServiceRestartOperationV1/);
  assert.match(source, /observePreparedInternalProductionBaselineServiceRestartLaunchOutboxV1/);
  assert.match(source, /setfarm\.internal-production-baseline-service-restart-helper-registry-registration\.v1/);
  assert.match(source, /setfarm\.internal-production-baseline-service-restart-helper-journal-census\.v1/);

  const fixture = mkdtempSync(path.join(tmpdir(), "setfarm-p4-retirement-lease-"));
  try {
    const fixtureModulePath = installRetirementFixture(fixture, source);
    const isolated = await import(`${pathToFileURL(fixtureModulePath).href}?lease=${Date.now()}`);
    const lease = await isolated.acquireInternalProductionPhysicalServiceRestartAuthorityTransitionLeaseV1();
    assert.deepEqual(Reflect.ownKeys(lease), ["schema"]);
    assert.equal(Object.isFrozen(lease), true);
    await assert.rejects(isolated.releaseInternalProductionPhysicalServiceRestartAuthorityTransitionLeaseV1(structuredClone(lease)), /foreign, cloned, or released/);
    await isolated.releaseInternalProductionPhysicalServiceRestartAuthorityTransitionLeaseV1(lease);
    await assert.rejects(isolated.releaseInternalProductionPhysicalServiceRestartAuthorityTransitionLeaseV1(lease), /foreign, cloned, or released/);
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});

test("P4 retirement rejects insecure authority-store ancestors", async () => {
  const captureAcquireFailure = async (fixture: string): Promise<unknown> => {
    const modulePath = path.join(fixture, "src/internal-production/baseline-restart-authority-retirement-v1.ts");
    const isolated = await import(`${pathToFileURL(modulePath).href}?ancestor=${Date.now()}-${Math.random()}`);
    let lease: Awaited<ReturnType<typeof isolated.acquireInternalProductionPhysicalServiceRestartAuthorityTransitionLeaseV1>> | undefined;
    try {
      lease = await isolated.acquireInternalProductionPhysicalServiceRestartAuthorityTransitionLeaseV1();
      return undefined;
    } catch (error) {
      return error;
    } finally {
      if (lease) await isolated.releaseInternalProductionPhysicalServiceRestartAuthorityTransitionLeaseV1(lease);
    }
  };

  const wrongModeFixture = mkdtempSync(path.join(tmpdir(), "setfarm-p4-retirement-bad-mode-"));
  try {
    installRetirementFixture(wrongModeFixture, readFileSync(sourcePath, "utf8"));
    chmodSync(path.join(wrongModeFixture, "data"), 0o755);
    assert.match(String(await captureAcquireFailure(wrongModeFixture)), /directory|mode|ancestor/i);
    chmodSync(path.join(wrongModeFixture, "data"), 0o1700);
    assert.match(String(await captureAcquireFailure(wrongModeFixture)), /directory|mode|ancestor/i, "special permission bits must not pass an exact 0700 check");
  } finally {
    rmSync(wrongModeFixture, { recursive: true, force: true });
  }

  const symlinkFixture = mkdtempSync(path.join(tmpdir(), "setfarm-p4-retirement-symlink-"));
  try {
    installRetirementFixture(symlinkFixture, readFileSync(sourcePath, "utf8"));
    const authorityBase = path.join(symlinkFixture, "data/internal-production-baseline");
    const held = `${authorityBase}.held`;
    renameSync(authorityBase, held);
    symlinkSync(held, authorityBase);
    assert.match(String(await captureAcquireFailure(symlinkFixture)), /directory|symbolic|ancestor/i);
  } finally {
    rmSync(symlinkFixture, { recursive: true, force: true });
  }

  const raceFixture = mkdtempSync(path.join(tmpdir(), "setfarm-p4-retirement-directory-race-"));
  try {
    const originalSource = readFileSync(sourcePath, "utf8");
    const raceSource = originalSource.replace(
      "  try {\n    rootGuard.assertStable();\n    if (abandonedAcquireV1)",
      "  try {\n    const directoryRaceHook = Reflect.get(globalThis, '__setfarmP4RetirementDirectoryRaceHook');\n    if (typeof directoryRaceHook === 'function') directoryRaceHook();\n    rootGuard.assertStable();\n    if (abandonedAcquireV1)",
    );
    assert.notEqual(raceSource, originalSource, "retirement directory-race fixture must replace the exact post-authentication boundary");
    installRetirementFixture(raceFixture, raceSource);
    const raceRoot = path.join(raceFixture, "data/internal-production-baseline/restart-authority-retirement-v1");
    const heldRaceRoot = `${raceRoot}.held`;
    const externalRaceRoot = path.join(raceFixture, "external-retirement-store");
    mkdirSync(externalRaceRoot, { mode: 0o700 });
    Reflect.set(globalThis, "__setfarmP4RetirementDirectoryRaceHook", () => {
      renameSync(raceRoot, heldRaceRoot);
      symlinkSync(externalRaceRoot, raceRoot);
    });
    try {
      assert.match(String(await captureAcquireFailure(raceFixture)), /directory.*changed|symbolic|identity/i);
      assert.throws(
        () => readFileSync(path.join(externalRaceRoot, "physical-service-restart-authority.transition.lock")),
        /ENOENT/,
        "a raced external directory must receive no lock bytes",
      );
    } finally {
      Reflect.deleteProperty(globalThis, "__setfarmP4RetirementDirectoryRaceHook");
    }
  } finally {
    rmSync(raceFixture, { recursive: true, force: true });
  }
});

test("P4 retirement recovers an exact abandoned acquisition after a post-lock directory race", async () => {
  const fixture = mkdtempSync(path.join(tmpdir(), "setfarm-p4-retirement-post-lock-race-"));
  try {
    const originalSource = readFileSync(sourcePath, "utf8");
    const raceSource = originalSource.replace(
      "const lease = Object.freeze({ schema: \"setfarm.internal-production-physical-service-restart-authority-transition-lease.v1\" as const });",
      "const postLockRaceHook = Reflect.get(globalThis, '__setfarmP4RetirementPostLockRaceHook');\n  if (typeof postLockRaceHook === 'function') postLockRaceHook();\n  const lease = Object.freeze({ schema: \"setfarm.internal-production-physical-service-restart-authority-transition-lease.v1\" as const });",
    );
    assert.notEqual(raceSource, originalSource, "post-lock race fixture must replace the exact pre-registration boundary");
    const modulePath = installRetirementFixture(fixture, raceSource);
    const isolated = await import(`${pathToFileURL(modulePath).href}?post-lock-race=${Date.now()}`);
    const root = path.join(fixture, "data/internal-production-baseline/restart-authority-retirement-v1");
    const heldRoot = `${root}.held`;
    const externalRoot = path.join(fixture, "external-post-lock-retirement-store");
    const lock = path.join(root, "physical-service-restart-authority.transition.lock");
    mkdirSync(externalRoot, { mode: 0o700 });
    const descriptorsBefore = readdirSync("/dev/fd").length;
    Reflect.set(globalThis, "__setfarmP4RetirementPostLockRaceHook", () => {
      renameSync(root, heldRoot);
      symlinkSync(externalRoot, root);
    });
    try {
      await assert.rejects(isolated.acquireInternalProductionPhysicalServiceRestartAuthorityTransitionLeaseV1(), /directory.*changed|symbolic|identity/i);
    } finally {
      Reflect.deleteProperty(globalThis, "__setfarmP4RetirementPostLockRaceHook");
    }
    unlinkSync(root);
    renameSync(heldRoot, root);
    const retryLease = await isolated.acquireInternalProductionPhysicalServiceRestartAuthorityTransitionLeaseV1();
    await isolated.releaseInternalProductionPhysicalServiceRestartAuthorityTransitionLeaseV1(retryLease);
    assert.equal(existsSync(lock), false, "retry release must leave no transition lock");
    assert.equal(readdirSync("/dev/fd").length, descriptorsBefore, "abandoned acquisition must not leak a descriptor");
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});

test("P4 retirement refuses an absent epoch head instead of synthesizing A authority", async () => {
  const fixture = mkdtempSync(path.join(tmpdir(), "setfarm-p4-retirement-absent-epoch-"));
  try {
    const fixtureModulePath = installRetirementFixture(fixture, readFileSync(sourcePath, "utf8"));
    rmSync(path.join(fixture, "data/internal-production-baseline/restart-authority-retirement-v1/epoch-head.json"));
    const isolated = await import(`${pathToFileURL(fixtureModulePath).href}?absent-epoch=${Date.now()}`);
    await assert.rejects(isolated.acquireInternalProductionPhysicalServiceRestartAuthorityTransitionLeaseV1(), /epoch/i);
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});

test("P4 retirement reclaims only a proven dead exact lock owner", async () => {
  const fixture = mkdtempSync(path.join(tmpdir(), "setfarm-p4-retirement-dead-lock-"));
  try {
    const fixtureModulePath = installRetirementFixture(fixture, readFileSync(sourcePath, "utf8"));
    const lockRoot = path.join(fixture, "data/internal-production-baseline/restart-authority-retirement-v1");
    mkdirSync(lockRoot, { recursive: true });
    const lockBody = {
      schema: "setfarm.internal-production-physical-service-restart-authority-transition-lock.v1",
      pid: 99_999,
      processStartTimeEpochMs: 1,
      processIdentityHash: "0".repeat(64),
      leaseNonce: "1".repeat(64),
    };
    const lockPath = path.join(lockRoot, "physical-service-restart-authority.transition.lock");
    writeFileSync(lockPath, `${canonical(lockBody)}\n`, { mode: 0o600 });
    const isolated = await import(`${pathToFileURL(fixtureModulePath).href}?dead-lock=${Date.now()}`);
    const lease = await isolated.acquireInternalProductionPhysicalServiceRestartAuthorityTransitionLeaseV1();
    await isolated.releaseInternalProductionPhysicalServiceRestartAuthorityTransitionLeaseV1(lease);

    const ps = spawnSync("/bin/ps", ["-p", String(process.pid), "-o", "lstart=,command="], { encoding: "utf8" });
    assert.equal(ps.status, 0, ps.stderr);
    const row = ps.stdout.slice(0, -1);
    const lstart = row.slice(0, 24);
    const command = row.slice(24).trimStart();
    const processStartTimeEpochMs = Date.parse(lstart);
    const processIdentityHash = sha256(canonical({ schema: "setfarm.internal-production-transition-lock-owner-process-identity.v1", pid: process.pid, processStartTimeEpochMs, lstart, command }));
    const liveBody = { schema: lockBody.schema, pid: process.pid, processStartTimeEpochMs, processIdentityHash, leaseNonce: "2".repeat(64) };
    const liveBytes = `${canonical(liveBody)}\n`;
    writeFileSync(lockPath, liveBytes, { mode: 0o600 });
    await assert.rejects(isolated.acquireInternalProductionPhysicalServiceRestartAuthorityTransitionLeaseV1(), /lease is unavailable/);
    assert.equal(readFileSync(lockPath, "utf8"), liveBytes);

    writeFileSync(lockPath, `${canonical({ ...liveBody, processStartTimeEpochMs: 1, processIdentityHash: "3".repeat(64) })}\n`, { mode: 0o600 });
    await assert.rejects(isolated.acquireInternalProductionPhysicalServiceRestartAuthorityTransitionLeaseV1(), /PID was reused or replaced/);
    assert.equal(statSync(lockPath).isFile(), true);

    writeFileSync(lockPath, "not-json\n", { mode: 0o600 });
    await assert.rejects(isolated.acquireInternalProductionPhysicalServiceRestartAuthorityTransitionLeaseV1(), /not JSON/);
    assert.equal(readFileSync(lockPath, "utf8"), "not-json\n");

    unlinkSync(lockPath);
    const held = `${lockPath}.held`;
    writeFileSync(held, `${canonical(lockBody)}\n`, { mode: 0o600 });
    symlinkSync(held, lockPath);
    await assert.rejects(isolated.acquireInternalProductionPhysicalServiceRestartAuthorityTransitionLeaseV1(), /ELOOP|symbolic|identity/i);
    assert.equal(statSync(held).isFile(), true);
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});

test("P4 retirement adopts a later exact settlement without redispatch", async () => {
  const fixture = mkdtempSync(path.join(tmpdir(), "setfarm-p4-retirement-settlement-"));
  try {
    const source = readFileSync(sourcePath, "utf8");
    const fixtureModulePath = installRetirementFixture(fixture, source);
    const helperPath = path.join(fixture, "src/internal-production/baseline-service-restart-helper-v1.ts");
    writeFileSync(helperPath, "throw new Error('SECOND_DISPATCH_FORBIDDEN')\n");
    const isolated = await import(`${pathToFileURL(fixtureModulePath).href}?settlement=${Date.now()}`);
    const lease = await isolated.acquireInternalProductionPhysicalServiceRestartAuthorityTransitionLeaseV1();
    const operationHash = "a".repeat(64);
    const restartAuthorityHash = "b".repeat(64);
    const currentEntryOperation = { operationRef: `setfarm://internal-production/current-entry-operation/sha256/${operationHash}`, operationHash };
    (globalThis as Record<string, unknown>).__p4CurrentEntryOperation = currentEntryOperation;
    const restartAuthority = { restartAuthorityRef: `setfarm://internal-production/pre-schema-spawner-restart-authority/sha256/${restartAuthorityHash}`, restartAuthorityHash };
    const root = path.join(fixture, "data/internal-production-baseline/restart-authority-retirement-v1");
    const lockStats = statSync(path.join(root, "physical-service-restart-authority.transition.lock"), { bigint: true });
    const lockIdentity = { devDecimal: lockStats.dev.toString(10), inoDecimal: lockStats.ino.toString(10) };
    const transitionLock = JSON.parse(readFileSync(path.join(root, "physical-service-restart-authority.transition.lock"), "utf8"));
    const journalBody = { schema: "setfarm.internal-production-service-restart-helper-journal.v1", family: "pre-schema-spawner-rebind", operationSchema: "setfarm.internal-production-current-entry-operation.v1", operationPurpose: "task6a-internal-production-current-entry-v1", action: "task6a-pre-schema-setfarm-spawner-rebind-v1", currentEntryOperation, restartAuthority, transitionLock, lockIdentity, maximumDispatchCount: 1 };
    const journalHash = sha256(canonical(journalBody));
    const journal = { ...journalBody, journalHash };
    const journalPath = path.join(root, "pre-schema-helper-journal.json");
    writeFileSync(journalPath, `${canonical(journal)}\n`, { mode: 0o600 });
    const journalCrashTemp = path.join(root, `.pre-schema-helper-journal.json.${"a".repeat(32)}.tmp`);
    linkSync(journalPath, journalCrashTemp);

    await assert.rejects(
      isolated.invokeInternalProductionPreSchemaSpawnerRebindHelperUnderTransitionLeaseV1(lease, { currentEntryOperation, restartAuthority }),
      /HELPER_DISPATCH_SETTLEMENT_UNKNOWN/,
    );
    assert.equal(existsSync(journalCrashTemp), false, "linked journal crash temp must be repaired");

    const settlementBody = { schema: "setfarm.internal-production-pre-schema-spawner-rebind-helper-settlement.v1", action: "task6a-pre-schema-setfarm-spawner-rebind-v1", currentEntryOperation, restartAuthority, journalHash, transitionLock, lockIdentity, dispatchCount: 1, disposition: "completed" };
    const helperSettlementHash = sha256(canonical(settlementBody));
    const helperSettlementRef = `setfarm://internal-production/pre-schema-spawner-rebind-helper-settlement/sha256/${helperSettlementHash}`;
    const settlementDirectory = path.join(root, "pre-schema-helper-settlements/sha256", helperSettlementHash.slice(0, 2));
    mkdirSync(settlementDirectory, { recursive: true });
    const settlementPath = path.join(settlementDirectory, `${helperSettlementHash}.json`);
    writeFileSync(settlementPath, `${canonical({ ...settlementBody, helperSettlementRef, helperSettlementHash })}\n`, { mode: 0o600 });
    const settlementTempOnly = path.join(settlementDirectory, `.${helperSettlementHash}.json.${"b".repeat(32)}.tmp`);
    linkSync(settlementPath, settlementTempOnly);
    unlinkSync(settlementPath);
    const adopted = await isolated.invokeInternalProductionPreSchemaSpawnerRebindHelperUnderTransitionLeaseV1(lease, { currentEntryOperation, restartAuthority });
    assert.deepEqual(adopted, { helperSettlementRef, helperSettlementHash });
    assert.equal(existsSync(settlementPath), true, "retirement must promote an exact temp-only settlement");
    assert.equal(existsSync(settlementTempOnly), false);
    const settlementLinkedTemp = path.join(settlementDirectory, `.${helperSettlementHash}.json.${"c".repeat(32)}.tmp`);
    linkSync(settlementPath, settlementLinkedTemp);
    const linkedAdopted = await isolated.invokeInternalProductionPreSchemaSpawnerRebindHelperUnderTransitionLeaseV1(lease, { currentEntryOperation, restartAuthority });
    assert.deepEqual(linkedAdopted, adopted);
    assert.equal(existsSync(settlementLinkedTemp), false, "retirement must clean exact final+temp settlement crash state");
    await isolated.releaseInternalProductionPhysicalServiceRestartAuthorityTransitionLeaseV1(lease);
    const retryLease = await isolated.acquireInternalProductionPhysicalServiceRestartAuthorityTransitionLeaseV1();
    const retryAdopted = await isolated.invokeInternalProductionPreSchemaSpawnerRebindHelperUnderTransitionLeaseV1(retryLease, { currentEntryOperation, restartAuthority });
    assert.deepEqual(retryAdopted, adopted);
    await isolated.releaseInternalProductionPhysicalServiceRestartAuthorityTransitionLeaseV1(retryLease);
    assert.equal(existsSync(path.join(root, "physical-service-restart-authority.transition.lock")), false);
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});

test("P4 retirement preserves a dead-owner lock while dispatch settlement is unknown", async () => {
  const fixture = mkdtempSync(path.join(tmpdir(), "setfarm-p4-retirement-pending-journal-lock-"));
  try {
    const modulePath = installRetirementFixture(fixture, readFileSync(sourcePath, "utf8"));
    const isolated = await import(`${pathToFileURL(modulePath).href}?pending-journal-lock=${Date.now()}`);
    const root = path.join(fixture, "data/internal-production-baseline/restart-authority-retirement-v1");
    const lockPath = path.join(root, "physical-service-restart-authority.transition.lock");
    const transitionLock = { schema: "setfarm.internal-production-physical-service-restart-authority-transition-lock.v1", pid: 99_999, processStartTimeEpochMs: 1, processIdentityHash: "1".repeat(64), leaseNonce: "2".repeat(64) };
    writeFileSync(lockPath, `${canonical(transitionLock)}\n`, { mode: 0o600 });
    const lockStats = statSync(lockPath, { bigint: true });
    const lockIdentity = { devDecimal: lockStats.dev.toString(10), inoDecimal: lockStats.ino.toString(10) };
    const operationHash = "3".repeat(64);
    const restartAuthorityHash = "4".repeat(64);
    const currentEntryOperation = { operationRef: `setfarm://internal-production/current-entry-operation/sha256/${operationHash}`, operationHash };
    const restartAuthority = { restartAuthorityRef: `setfarm://internal-production/pre-schema-spawner-restart-authority/sha256/${restartAuthorityHash}`, restartAuthorityHash };
    const journalBody = { schema: "setfarm.internal-production-service-restart-helper-journal.v1", family: "pre-schema-spawner-rebind", operationSchema: "setfarm.internal-production-current-entry-operation.v1", operationPurpose: "task6a-internal-production-current-entry-v1", action: "task6a-pre-schema-setfarm-spawner-rebind-v1", currentEntryOperation, restartAuthority, transitionLock, lockIdentity, maximumDispatchCount: 1 };
    const journalHash = sha256(canonical(journalBody));
    writeFileSync(path.join(root, "pre-schema-helper-journal.json"), `${canonical({ ...journalBody, journalHash })}\n`, { mode: 0o600 });
    await assert.rejects(isolated.acquireInternalProductionPhysicalServiceRestartAuthorityTransitionLeaseV1(), /HELPER_DISPATCH_SETTLEMENT_UNKNOWN/);
    assert.deepEqual(JSON.parse(readFileSync(lockPath, "utf8")), transitionLock);
    const settlementBody = { schema: "setfarm.internal-production-pre-schema-spawner-rebind-helper-settlement.v1", action: "task6a-pre-schema-setfarm-spawner-rebind-v1", currentEntryOperation, restartAuthority, journalHash, transitionLock, lockIdentity, dispatchCount: 1, disposition: "completed" };
    const helperSettlementHash = sha256(canonical(settlementBody));
    const helperSettlementRef = `setfarm://internal-production/pre-schema-spawner-rebind-helper-settlement/sha256/${helperSettlementHash}`;
    const settlementDirectory = path.join(root, "pre-schema-helper-settlements/sha256", helperSettlementHash.slice(0, 2));
    mkdirSync(settlementDirectory, { recursive: true });
    const settlementPath = path.join(settlementDirectory, `${helperSettlementHash}.json`);
    const settlementTemporary = path.join(settlementDirectory, `.${helperSettlementHash}.json.${"5".repeat(32)}.tmp`);
    writeFileSync(settlementPath, `${canonical({ ...settlementBody, helperSettlementRef, helperSettlementHash })}\n`, { mode: 0o600 });
    linkSync(settlementPath, settlementTemporary);
    const recoveredLease = await isolated.acquireInternalProductionPhysicalServiceRestartAuthorityTransitionLeaseV1();
    assert.equal(existsSync(settlementTemporary), false, "dead-lock reclaim must recover an exact linked helper settlement temporary");
    await isolated.releaseInternalProductionPhysicalServiceRestartAuthorityTransitionLeaseV1(recoveredLease);
    assert.equal(existsSync(lockPath), false);
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});

test("P4 retirement classifies every post-claim helper failure as settlement unknown", async () => {
  const fixture = mkdtempSync(path.join(tmpdir(), "setfarm-p4-retirement-helper-loss-"));
  try {
    const marker = path.join(fixture, "dispatch-count");
    const fixtureModulePath = installRetirementFixture(fixture, readFileSync(sourcePath, "utf8"));
    writeFileSync(path.join(fixture, "src/internal-production/baseline-service-restart-helper-v1.js"), `import{appendFileSync}from"node:fs";appendFileSync(${JSON.stringify(marker)},"x");process.exit(7);\n`);
    const isolated = await import(`${pathToFileURL(fixtureModulePath).href}?helper-loss=${Date.now()}`);
    const lease = await isolated.acquireInternalProductionPhysicalServiceRestartAuthorityTransitionLeaseV1();
    const operationHash = "c".repeat(64);
    const restartAuthorityHash = "d".repeat(64);
    const input = {
      currentEntryOperation: { operationRef: `setfarm://internal-production/current-entry-operation/sha256/${operationHash}`, operationHash },
      restartAuthority: { restartAuthorityRef: `setfarm://internal-production/pre-schema-spawner-restart-authority/sha256/${restartAuthorityHash}`, restartAuthorityHash },
    };
    (globalThis as Record<string, unknown>).__p4CurrentEntryOperation = input.currentEntryOperation;
    const source = { sha: "5".repeat(40), treeHash: "6".repeat(40), buildHash: "7".repeat(64) };
    const predecessorProcess = { schema: "setfarm.internal-production-spawner-process-identity.v1", pid: 101, processStartTimeEpochMs: 1, processIdentityHash: "8".repeat(64) };
    const predecessorProcessHash = sha256(canonical(predecessorProcess));
    (globalThis as Record<string, unknown>).__p4RestartOverrides = {
      predecessorSpawnerProcessIdentityRef: `setfarm://internal-production/spawner-process-identity/sha256/${predecessorProcessHash}`,
      predecessorSpawnerProcessIdentityHash: predecessorProcessHash,
      predecessorSpawnerServiceIdentityHash: "9".repeat(64), predecessorSpawnerGenerationHash: "a".repeat(64),
      targetSpawnerSourceSha: source.sha, targetSpawnerTreeHash: source.treeHash, targetSpawnerBuildHash: source.buildHash,
    };
    (globalThis as Record<string, unknown>).__p4ServiceCensus = { spawner: { pid: predecessorProcess.pid, processStartTimeEpochMs: predecessorProcess.processStartTimeEpochMs, processIdentityHash: predecessorProcess.processIdentityHash, serviceIdentityHash: "9".repeat(64), generationHash: "a".repeat(64), loadedSourceSha: source.sha, loadedTreeHash: source.treeHash, loadedBuildHash: source.buildHash, processOwnerCount: 1, listener: null } };
    await assert.rejects(isolated.invokeInternalProductionPreSchemaSpawnerRebindHelperUnderTransitionLeaseV1(lease, input), /HELPER_DISPATCH_SETTLEMENT_UNKNOWN/);
    assert.equal(readFileSync(marker, "utf8"), "x");
    await assert.rejects(isolated.invokeInternalProductionPreSchemaSpawnerRebindHelperUnderTransitionLeaseV1(lease, input), /HELPER_DISPATCH_SETTLEMENT_UNKNOWN/);
    assert.equal(readFileSync(marker, "utf8"), "x", "durable claim must prevent redispatch");
    const root = path.join(fixture, "data/internal-production-baseline/restart-authority-retirement-v1");
    const journal = JSON.parse(readFileSync(path.join(root, "pre-schema-helper-journal.json"), "utf8"));
    const settlementBody = { schema: "setfarm.internal-production-pre-schema-spawner-rebind-helper-settlement.v1", action: "task6a-pre-schema-setfarm-spawner-rebind-v1", currentEntryOperation: input.currentEntryOperation, restartAuthority: input.restartAuthority, journalHash: journal.journalHash, transitionLock: journal.transitionLock, lockIdentity: journal.lockIdentity, dispatchCount: 1, disposition: "completed" };
    const helperSettlementHash = sha256(canonical(settlementBody));
    const helperSettlementRef = `setfarm://internal-production/pre-schema-spawner-rebind-helper-settlement/sha256/${helperSettlementHash}`;
    const settlementDirectory = path.join(root, "pre-schema-helper-settlements/sha256", helperSettlementHash.slice(0, 2));
    mkdirSync(settlementDirectory, { recursive: true });
    const settlementTemporary = path.join(settlementDirectory, `.${helperSettlementHash}.json.${"e".repeat(32)}.tmp`);
    writeFileSync(settlementTemporary, `${canonical({ ...settlementBody, helperSettlementRef, helperSettlementHash })}\n`, { mode: 0o600 });
    await isolated.releaseInternalProductionPhysicalServiceRestartAuthorityTransitionLeaseV1(lease);
    assert.equal(existsSync(settlementTemporary), false, "release must recover an exact helper settlement temporary after helper loss");
    assert.equal(readFileSync(marker, "utf8"), "x", "settlement recovery must not redispatch");
  } finally {
    delete (globalThis as Record<string, unknown>).__p4RestartOverrides;
    delete (globalThis as Record<string, unknown>).__p4ServiceCensus;
    rmSync(fixture, { recursive: true, force: true });
  }
});

test("P4 retirement refuses a crossed fixed restart action before journal claim", async () => {
  const fixture = mkdtempSync(path.join(tmpdir(), "setfarm-p4-retirement-crossed-action-"));
  try {
    const fixtureModulePath = installRetirementFixture(fixture, readFileSync(sourcePath, "utf8"));
    const isolated = await import(`${pathToFileURL(fixtureModulePath).href}?crossed-action=${Date.now()}`);
    const lease = await isolated.acquireInternalProductionPhysicalServiceRestartAuthorityTransitionLeaseV1();
    const operationHash = "e".repeat(64);
    const restartAuthorityHash = "f".repeat(64);
    const input = {
      currentEntryOperation: { operationRef: `setfarm://internal-production/current-entry-operation/sha256/${operationHash}`, operationHash },
      restartAuthority: { restartAuthorityRef: `setfarm://internal-production/pre-schema-spawner-restart-authority/sha256/${restartAuthorityHash}`, restartAuthorityHash },
    };
    (globalThis as Record<string, unknown>).__p4CurrentEntryOperation = input.currentEntryOperation;
    (globalThis as Record<string, unknown>).__p4RestartOverrides = { uid: (process.getuid?.() ?? 0) + 1 };
    await assert.rejects(isolated.invokeInternalProductionPreSchemaSpawnerRebindHelperUnderTransitionLeaseV1(lease, input), /fixed action is crossed/);
    assert.equal(existsSync(path.join(fixture, "data/internal-production-baseline/restart-authority-retirement-v1/pre-schema-helper-journal.json")), false);
    delete (globalThis as Record<string, unknown>).__p4RestartOverrides;
    await isolated.releaseInternalProductionPhysicalServiceRestartAuthorityTransitionLeaseV1(lease);
  } finally {
    delete (globalThis as Record<string, unknown>).__p4RestartOverrides;
    rmSync(fixture, { recursive: true, force: true });
  }
});

test("P4 retirement refuses fresh predecessor drift before journal claim", async () => {
  const fixture = mkdtempSync(path.join(tmpdir(), "setfarm-p4-retirement-preclaim-drift-"));
  try {
    const fixtureModulePath = installRetirementFixture(fixture, readFileSync(sourcePath, "utf8"));
    const isolated = await import(`${pathToFileURL(fixtureModulePath).href}?preclaim-drift=${Date.now()}`);
    const lease = await isolated.acquireInternalProductionPhysicalServiceRestartAuthorityTransitionLeaseV1();
    const operationHash = "7".repeat(64);
    const restartAuthorityHash = "8".repeat(64);
    const input = {
      currentEntryOperation: { operationRef: `setfarm://internal-production/current-entry-operation/sha256/${operationHash}`, operationHash },
      restartAuthority: { restartAuthorityRef: `setfarm://internal-production/pre-schema-spawner-restart-authority/sha256/${restartAuthorityHash}`, restartAuthorityHash },
    };
    const source = { sha: "a".repeat(40), treeHash: "b".repeat(40), buildHash: "c".repeat(64) };
    const oldProcess = { schema: "setfarm.internal-production-spawner-process-identity.v1", pid: 101, processStartTimeEpochMs: 1, processIdentityHash: "d".repeat(64) };
    const oldProcessHash = sha256(canonical(oldProcess));
    (globalThis as Record<string, unknown>).__p4CurrentEntryOperation = input.currentEntryOperation;
    (globalThis as Record<string, unknown>).__p4RestartOverrides = {
      predecessorSpawnerProcessIdentityRef: `setfarm://internal-production/spawner-process-identity/sha256/${oldProcessHash}`,
      predecessorSpawnerProcessIdentityHash: oldProcessHash,
      predecessorSpawnerServiceIdentityHash: "e".repeat(64), predecessorSpawnerGenerationHash: "f".repeat(64),
      targetSpawnerSourceSha: source.sha, targetSpawnerTreeHash: source.treeHash, targetSpawnerBuildHash: source.buildHash,
    };
    const validSpawner = { pid: oldProcess.pid, processStartTimeEpochMs: oldProcess.processStartTimeEpochMs, processIdentityHash: oldProcess.processIdentityHash, serviceIdentityHash: "e".repeat(64), generationHash: "f".repeat(64), loadedSourceSha: source.sha, loadedTreeHash: source.treeHash, loadedBuildHash: source.buildHash, processOwnerCount: 1, listener: null };
    for (const [label, mutation] of [
      ["pid", { pid: 202 }], ["start", { processStartTimeEpochMs: 2 }], ["process hash", { processIdentityHash: "1".repeat(64) }],
      ["service", { serviceIdentityHash: "2".repeat(64) }], ["generation", { generationHash: "3".repeat(64) }],
      ["source", { loadedSourceSha: "4".repeat(40) }], ["tree", { loadedTreeHash: "5".repeat(40) }], ["build", { loadedBuildHash: "6".repeat(64) }],
      ["owner count", { processOwnerCount: 0 }], ["listener", { listener: { port: 1 } }],
    ] as const) {
      (globalThis as Record<string, unknown>).__p4ServiceCensus = { spawner: { ...validSpawner, ...mutation } };
      await assert.rejects(isolated.invokeInternalProductionPreSchemaSpawnerRebindHelperUnderTransitionLeaseV1(lease, input), /predecessor|census|identity/i, `${label} drift must refuse`);
      assert.equal(existsSync(path.join(fixture, "data/internal-production-baseline/restart-authority-retirement-v1/pre-schema-helper-journal.json")), false, `${label} drift must not claim journal`);
    }
    await isolated.releaseInternalProductionPhysicalServiceRestartAuthorityTransitionLeaseV1(lease);
  } finally {
    delete (globalThis as Record<string, unknown>).__p4RestartOverrides;
    delete (globalThis as Record<string, unknown>).__p4ServiceCensus;
    rmSync(fixture, { recursive: true, force: true });
  }
});

test("P4 retirement removes only its exact lock after acquire faults", async () => {
  const original = readFileSync(sourcePath, "utf8");
  const injections = [
    ["write", "    writeFileSync(descriptor, lockBytes);", "    writeFileSync(descriptor, lockBytes); throw new Error('P4_ACQUIRE_WRITE_FAULT');"],
    ["fsync", "    fsyncSync(descriptor);", "    fsyncSync(descriptor); throw new Error('P4_ACQUIRE_FSYNC_FAULT');"],
    ["parent-fsync", "    fsyncParent(lock);\n    const stats = fstatSync(descriptor, { bigint: true });", "    fsyncParent(lock); throw new Error('P4_ACQUIRE_PARENT_FSYNC_FAULT');\n    const stats = fstatSync(descriptor, { bigint: true });"],
    ["fstat", "    const stats = fstatSync(descriptor, { bigint: true });", "    throw new Error('P4_ACQUIRE_FSTAT_FAULT');\n    const stats = fstatSync(descriptor, { bigint: true });"],
    ["second-epoch", "    assertEpoch();\n    const lease", "    throw new Error('P4_ACQUIRE_SECOND_EPOCH_FAULT');\n    const lease"],
  ] as const;
  for (const [name, needle, replacement] of injections) {
    assert.equal(original.includes(needle), true, `${name} injection target exists`);
    const fixture = mkdtempSync(path.join(tmpdir(), `setfarm-p4-retirement-acquire-${name}-`));
    try {
      const modulePath = installRetirementFixture(fixture, original.replace(needle, replacement));
      const isolated = await import(`${pathToFileURL(modulePath).href}?acquire-fault=${name}-${Date.now()}`);
      await assert.rejects(isolated.acquireInternalProductionPhysicalServiceRestartAuthorityTransitionLeaseV1(), /P4_ACQUIRE_/);
      assert.equal(existsSync(path.join(fixture, "data/internal-production-baseline/restart-authority-retirement-v1/physical-service-restart-authority.transition.lock")), false, `${name} must not leave an owned lock`);
    } finally {
      rmSync(fixture, { recursive: true, force: true });
    }
  }

  const fixture = mkdtempSync(path.join(tmpdir(), "setfarm-p4-retirement-acquire-foreign-swap-"));
  try {
    const needle = "    writeFileSync(descriptor, lockBytes);";
    const replacement = "    writeFileSync(descriptor, lockBytes); unlinkSync(lock); writeFileSync(lock, 'foreign-lock\\n', { mode: 0o600 }); throw new Error('P4_ACQUIRE_FOREIGN_SWAP');";
    const modulePath = installRetirementFixture(fixture, original.replace(needle, replacement));
    const isolated = await import(`${pathToFileURL(modulePath).href}?acquire-foreign=${Date.now()}`);
    await assert.rejects(isolated.acquireInternalProductionPhysicalServiceRestartAuthorityTransitionLeaseV1(), /P4_ACQUIRE_FOREIGN_SWAP|cleanup/i);
    const lock = path.join(fixture, "data/internal-production-baseline/restart-authority-retirement-v1/physical-service-restart-authority.transition.lock");
    assert.equal(readFileSync(lock, "utf8"), "foreign-lock\n");
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }

  const lateFixture = mkdtempSync(path.join(tmpdir(), "setfarm-p4-retirement-release-late-swap-"));
  try {
    const injected = original
      .replace("  readFileSync,", "  readFileSync,\n  renameSync,")
      .replace("    const finalPathStats = lstatSync(lock, { bigint: true });", "    renameSync(lock, `${lock}.owned`); writeFileSync(lock, 'late-foreign-lock\\n', { mode: 0o600 });\n    const finalPathStats = lstatSync(lock, { bigint: true });");
    const modulePath = installRetirementFixture(lateFixture, injected);
    const isolated = await import(`${pathToFileURL(modulePath).href}?release-late-swap=${Date.now()}`);
    const lease = await isolated.acquireInternalProductionPhysicalServiceRestartAuthorityTransitionLeaseV1();
    await assert.rejects(isolated.releaseInternalProductionPhysicalServiceRestartAuthorityTransitionLeaseV1(lease), /changed immediately before cleanup/);
    const lock = path.join(lateFixture, "data/internal-production-baseline/restart-authority-retirement-v1/physical-service-restart-authority.transition.lock");
    assert.equal(readFileSync(lock, "utf8"), "late-foreign-lock\n");
  } finally {
    rmSync(lateFixture, { recursive: true, force: true });
  }
});

test("P4 retirement invoke bridges held lease to empty helper", () => {
  const source = readFileSync(sourcePath, "utf8");
  assert.match(source, /baseline-service-restart-helper-v1\.js/);
  assert.match(source, /stdio:\s*\["ignore",\s*"ignore",\s*"ignore",\s*descriptor,\s*heldLease\(lease\)\.descriptor,\s*journalDescriptor\]/s);
  assert.match(source, /shell:\s*false/);
  assert.match(source, /pre-schema-spawner-rebind-helper-settlement\/sha256\//);
  assert.match(source, /currentEntryOperation,\s*restartAuthority/s);
});

test("P4 baseline helper registry closes an indeterminate journal without redispatch", async () => {
  const fixture = mkdtempSync(path.join(tmpdir(), "setfarm-p4-baseline-helper-registry-"));
  try {
    const fixtureModulePath = installRetirementFixture(fixture, readFileSync(sourcePath, "utf8"));
    seedPreSchemaHelperClosure(fixture);
    const isolated = await import(`${pathToFileURL(fixtureModulePath).href}?registry=${Date.now()}`);
    const lease = await isolated.acquireInternalProductionPhysicalServiceRestartAuthorityTransitionLeaseV1();
    const authorizationHash = "4".repeat(64);
    const authorizationRef = `setfarm://internal-production/baseline-service-restart-authorization/sha256/${authorizationHash}`;
    const operationBody = { schema: "setfarm.internal-production-baseline-service-restart-operation.v1", service: "setfarm-spawner", actionId: "a-restart-service-setfarm-spawner-v1", authorizationRef, authorizationHash };
    const operationHash = sha256(canonical(operationBody));
    const operationRef = `setfarm://internal-production/baseline-service-restart-operation/sha256/${operationHash}`;
    const restartOperation = { operationRef, operationHash };
    const operation = recursivelyFreeze({ ...operationBody, operationRef, operationHash });
    const outboxBody = { schema: "setfarm.internal-production-baseline-service-restart-launch-outbox.v1", service: operation.service, actionId: operation.actionId, authorizationRef, authorizationHash, operationRef, operationHash, maximumDispatchCount: 1 };
    const outboxHash = sha256(canonical(outboxBody));
    const outboxRef = `setfarm://internal-production/baseline-service-restart-launch-outbox/sha256/${outboxHash}`;
    (globalThis as Record<string, unknown>).__p4BaselineOperation = operation;
    (globalThis as Record<string, unknown>).__p4BaselineOutbox = recursivelyFreeze({ ...outboxBody, outboxRef, outboxHash });
    const root = path.join(fixture, "data/internal-production-baseline/restart-authority-retirement-v1");
    const registryRoot = path.join(root, "baseline-helper-registry-v1");
    const journalPath = path.join(root, "baseline-helper-journals/sha256", operationHash.slice(0, 2), `${operationHash}.json`);
    (globalThis as Record<string, unknown>).__p4BaselineOperation = structuredClone(operation);
    await assert.rejects(isolated.invokeInternalProductionBaselineServiceRestartHelperUnderTransitionLeaseV1(lease, { restartOperation }), /recursively frozen/);
    (globalThis as Record<string, unknown>).__p4BaselineOperation = operation;
    (globalThis as Record<string, unknown>).__p4BaselineOutbox = recursivelyFreeze({ ...outboxBody, unexpected: true, outboxRef, outboxHash });
    await assert.rejects(isolated.invokeInternalProductionBaselineServiceRestartHelperUnderTransitionLeaseV1(lease, { restartOperation }), /shape is invalid/);
    const wrongCountBody = { ...outboxBody, maximumDispatchCount: 2 };
    const wrongCountHash = sha256(canonical(wrongCountBody));
    (globalThis as Record<string, unknown>).__p4BaselineOutbox = recursivelyFreeze({ ...wrongCountBody, outboxRef: `setfarm://internal-production/baseline-service-restart-launch-outbox/sha256/${wrongCountHash}`, outboxHash: wrongCountHash });
    await assert.rejects(isolated.invokeInternalProductionBaselineServiceRestartHelperUnderTransitionLeaseV1(lease, { restartOperation }), /outbox.*crossed/);
    assert.equal(existsSync(registryRoot), false, "Task12 operation/outbox refusal precedes registry mutation");
    assert.equal(existsSync(journalPath), false, "Task12 operation/outbox refusal precedes journal mutation");
    (globalThis as Record<string, unknown>).__p4BaselineOutbox = recursivelyFreeze({ ...outboxBody, outboxRef, outboxHash });
    const lockPath = path.join(root, "physical-service-restart-authority.transition.lock");
    const transitionLock = JSON.parse(readFileSync(lockPath, "utf8"));
    const lockStats = statSync(lockPath, { bigint: true });
    const lockIdentity = { devDecimal: lockStats.dev.toString(10), inoDecimal: lockStats.ino.toString(10) };
    const journalBody = { schema: "setfarm.internal-production-service-restart-helper-journal.v1", family: "baseline-service-restart", operationSchema: operation.schema, action: operation.actionId, restartOperation, transitionLock, lockIdentity, maximumDispatchCount: 1 };
    const journalHash = sha256(canonical(journalBody));
    const journalDirectory = path.join(root, "baseline-helper-journals/sha256", operationHash.slice(0, 2));
    mkdirSync(journalDirectory, { recursive: true, mode: 0o700 });
    writeFileSync(journalPath, `${canonical({ ...journalBody, journalHash })}\n`, { mode: 0o600 });
    await assert.rejects(isolated.invokeInternalProductionBaselineServiceRestartHelperUnderTransitionLeaseV1(lease, { restartOperation }), /HELPER_DISPATCH_SETTLEMENT_UNKNOWN/);
    const census = await isolated.observeInternalProductionBaselineServiceRestartHelperJournalCensusV1();
    assert.deepEqual(Reflect.ownKeys(census), ["schema", "preSchemaHelperState", "registeredBaselineHelperJournalCount", "terminalBaselineHelperJournalCount", "liveBaselineHelperJournalCount", "ambiguousBaselineHelperJournalCount", "helperJournalRegistryHeadRef", "helperJournalRegistryHeadHash", "retainedHelperJournalSettlementSetHash", "censusHash"]);
    assert.deepEqual([census.registeredBaselineHelperJournalCount, census.terminalBaselineHelperJournalCount, census.liveBaselineHelperJournalCount, census.ambiguousBaselineHelperJournalCount], [1, 1, 0, 1]);
    const terminalHead = await isolated.resolveInternalProductionBaselineServiceRestartHelperRegistryHeadV1({ headRef: census.helperJournalRegistryHeadRef, headHash: census.helperJournalRegistryHeadHash });
    assert.equal(terminalHead.entryKind, "terminal");
    const terminal = await isolated.resolveInternalProductionBaselineServiceRestartHelperRegistryTerminalV1({ terminalRef: terminalHead.entryRef, terminalHash: terminalHead.entryHash });
    assert.equal(terminal.outcome, "ambiguous");
    const registrationHead = await isolated.resolveInternalProductionBaselineServiceRestartHelperRegistryHeadV1({ headRef: terminal.predecessorHeadRef, headHash: terminal.predecessorHeadHash });
    const registration = await isolated.resolveInternalProductionBaselineServiceRestartHelperRegistryRegistrationV1({ registrationRef: registrationHead.entryRef, registrationHash: registrationHead.entryHash });
    assert.equal(registration.operationHash, operationHash);
    await assert.rejects(isolated.invokeInternalProductionBaselineServiceRestartHelperUnderTransitionLeaseV1(lease, { restartOperation }), /HELPER_DISPATCH_SETTLEMENT_UNKNOWN/, "terminal ambiguity must be adopted without another helper attempt");
    const settlementBody = { schema: "setfarm.internal-production-baseline-service-restart-helper-settlement.v1", action: operation.actionId, restartOperation, journalHash, transitionLock, lockIdentity, dispatchCount: 1, disposition: "completed" };
    const helperSettlementHash = sha256(canonical(settlementBody));
    const helperSettlementRef = `setfarm://internal-production/baseline-service-restart-helper-settlement/sha256/${helperSettlementHash}`;
    const settlementDirectory = path.join(root, "baseline-helper-settlements/sha256", helperSettlementHash.slice(0, 2));
    mkdirSync(settlementDirectory, { recursive: true, mode: 0o700 });
    writeFileSync(path.join(settlementDirectory, `${helperSettlementHash}.json`), `${canonical({ ...settlementBody, helperSettlementRef, helperSettlementHash })}\n`, { mode: 0o600 });
    await assert.rejects(isolated.invokeInternalProductionBaselineServiceRestartHelperUnderTransitionLeaseV1(lease, { restartOperation }), /HELPER_DISPATCH_SETTLEMENT_UNKNOWN/, "a late settlement cannot rewrite terminal ambiguity");
    const secondAuthorizationHash = "5".repeat(64);
    const secondAuthorizationRef = `setfarm://internal-production/baseline-service-restart-authorization/sha256/${secondAuthorizationHash}`;
    const secondOperationBody = { ...operationBody, authorizationRef: secondAuthorizationRef, authorizationHash: secondAuthorizationHash };
    const secondOperationHash = sha256(canonical(secondOperationBody));
    const secondOperationRef = `setfarm://internal-production/baseline-service-restart-operation/sha256/${secondOperationHash}`;
    const secondRestartOperation = { operationRef: secondOperationRef, operationHash: secondOperationHash };
    const secondOperation = recursivelyFreeze({ ...secondOperationBody, operationRef: secondOperationRef, operationHash: secondOperationHash });
    const secondOutboxBody = { schema: outboxBody.schema, service: secondOperation.service, actionId: secondOperation.actionId, authorizationRef: secondAuthorizationRef, authorizationHash: secondAuthorizationHash, operationRef: secondOperationRef, operationHash: secondOperationHash, maximumDispatchCount: 1 };
    const secondOutboxHash = sha256(canonical(secondOutboxBody));
    const secondOutboxRef = `setfarm://internal-production/baseline-service-restart-launch-outbox/sha256/${secondOutboxHash}`;
    (globalThis as Record<string, unknown>).__p4BaselineOperation = secondOperation;
    (globalThis as Record<string, unknown>).__p4BaselineOutbox = recursivelyFreeze({ ...secondOutboxBody, outboxRef: secondOutboxRef, outboxHash: secondOutboxHash });
    const secondJournalBody = { ...journalBody, restartOperation: secondRestartOperation };
    const secondJournalHash = sha256(canonical(secondJournalBody));
    const secondJournalDirectory = path.join(root, "baseline-helper-journals/sha256", secondOperationHash.slice(0, 2));
    mkdirSync(secondJournalDirectory, { recursive: true, mode: 0o700 });
    writeFileSync(path.join(secondJournalDirectory, `${secondOperationHash}.json`), `${canonical({ ...secondJournalBody, journalHash: secondJournalHash })}\n`, { mode: 0o600 });
    const secondSettlementBody = { ...settlementBody, restartOperation: secondRestartOperation, journalHash: secondJournalHash };
    const secondSettlementHash = sha256(canonical(secondSettlementBody));
    const secondSettlementRef = `setfarm://internal-production/baseline-service-restart-helper-settlement/sha256/${secondSettlementHash}`;
    const secondSettlementDirectory = path.join(root, "baseline-helper-settlements/sha256", secondSettlementHash.slice(0, 2));
    mkdirSync(secondSettlementDirectory, { recursive: true, mode: 0o700 });
    writeFileSync(path.join(secondSettlementDirectory, `${secondSettlementHash}.json`), `${canonical({ ...secondSettlementBody, helperSettlementRef: secondSettlementRef, helperSettlementHash: secondSettlementHash })}\n`, { mode: 0o600 });
    assert.deepEqual(await isolated.invokeInternalProductionBaselineServiceRestartHelperUnderTransitionLeaseV1(lease, { restartOperation: secondRestartOperation }), { helperSettlementRef: secondSettlementRef, helperSettlementHash: secondSettlementHash });
    const completedCensus = await isolated.observeInternalProductionBaselineServiceRestartHelperJournalCensusV1();
    assert.deepEqual([completedCensus.registeredBaselineHelperJournalCount, completedCensus.terminalBaselineHelperJournalCount, completedCensus.liveBaselineHelperJournalCount, completedCensus.ambiguousBaselineHelperJournalCount], [2, 2, 0, 1]);
    const completedHead = await isolated.resolveInternalProductionBaselineServiceRestartHelperRegistryHeadV1({ headRef: completedCensus.helperJournalRegistryHeadRef, headHash: completedCensus.helperJournalRegistryHeadHash });
    const completedTerminal = await isolated.resolveInternalProductionBaselineServiceRestartHelperRegistryTerminalV1({ terminalRef: completedHead.entryRef, terminalHash: completedHead.entryHash });
    assert.equal(completedTerminal.outcome, "completed");
    const currentHeadPath = path.join(registryRoot, "current-head.pair.json");
    const completedHeadPairBytes = readFileSync(currentHeadPath);
    writeFileSync(currentHeadPath, `${canonical({ headRef: registrationHead.headRef, headHash: registrationHead.headHash })}\n`, { mode: 0o600 });
    const registrationOnlyCensus = await isolated.observeInternalProductionBaselineServiceRestartHelperJournalCensusV1();
    assert.deepEqual(
      [registrationOnlyCensus.registeredBaselineHelperJournalCount, registrationOnlyCensus.terminalBaselineHelperJournalCount, registrationOnlyCensus.liveBaselineHelperJournalCount, registrationOnlyCensus.ambiguousBaselineHelperJournalCount],
      [1, 0, 1, 0],
      "registration-only authority is live and can never be observed as an empty helper census",
    );
    writeFileSync(currentHeadPath, completedHeadPairBytes, { mode: 0o600 });
    const registrationStore = path.join(registryRoot, "registrations/sha256");
    const crossedRegistrationCore = { schema: "setfarm.internal-production-baseline-service-restart-helper-registry-registration.v1", registryOrdinal: completedHead.registryOrdinal + 1, predecessorHeadRef: completedHead.headRef, predecessorHeadHash: completedHead.headHash, service: "setfarm-spawner", actionId: "a-restart-service-setfarm-spawner-v1", authorizationRef: `setfarm://internal-production/baseline-service-restart-authorization/sha256/${"6".repeat(64)}`, authorizationHash: "6".repeat(64), operationRef: secondOperationRef, operationHash: secondOperationHash, outboxRef: `setfarm://internal-production/baseline-service-restart-launch-outbox/sha256/${"7".repeat(64)}`, outboxHash: "7".repeat(64) };
    const crossedRegistrationHash = sha256(canonical(crossedRegistrationCore));
    const crossedRegistrationRef = `setfarm://internal-production/baseline-service-restart-helper-registry-registration/sha256/${crossedRegistrationHash}`;
    const crossedRegistrationDirectory = path.join(registrationStore, crossedRegistrationHash.slice(0, 2));
    mkdirSync(crossedRegistrationDirectory, { recursive: true, mode: 0o700 });
    writeFileSync(path.join(crossedRegistrationDirectory, `${crossedRegistrationHash}.json`), `${canonical({ ...crossedRegistrationCore, registrationRef: crossedRegistrationRef, registrationHash: crossedRegistrationHash })}\n`, { mode: 0o600 });
    await assert.rejects(isolated.resolveInternalProductionBaselineServiceRestartHelperRegistryRegistrationV1({ registrationRef: crossedRegistrationRef, registrationHash: crossedRegistrationHash }), /repeats a prior tuple member/);
    const gapRegistrationCore = { ...crossedRegistrationCore, registryOrdinal: completedHead.registryOrdinal + 2, authorizationRef: `setfarm://internal-production/baseline-service-restart-authorization/sha256/${"8".repeat(64)}`, authorizationHash: "8".repeat(64), operationRef: `setfarm://internal-production/baseline-service-restart-operation/sha256/${"9".repeat(64)}`, operationHash: "9".repeat(64), outboxRef: `setfarm://internal-production/baseline-service-restart-launch-outbox/sha256/${"a".repeat(64)}`, outboxHash: "a".repeat(64) };
    const gapRegistrationHash = sha256(canonical(gapRegistrationCore));
    const gapRegistrationRef = `setfarm://internal-production/baseline-service-restart-helper-registry-registration/sha256/${gapRegistrationHash}`;
    const gapRegistrationDirectory = path.join(registrationStore, gapRegistrationHash.slice(0, 2));
    mkdirSync(gapRegistrationDirectory, { recursive: true, mode: 0o700 });
    writeFileSync(path.join(gapRegistrationDirectory, `${gapRegistrationHash}.json`), `${canonical({ ...gapRegistrationCore, registrationRef: gapRegistrationRef, registrationHash: gapRegistrationHash })}\n`, { mode: 0o600 });
    await assert.rejects(isolated.resolveInternalProductionBaselineServiceRestartHelperRegistryRegistrationV1({ registrationRef: gapRegistrationRef, registrationHash: gapRegistrationHash }), /predecessor is crossed/);
    const duplicateTerminalCore = { schema: "setfarm.internal-production-baseline-service-restart-helper-registry-terminal.v1", registryOrdinal: completedHead.registryOrdinal + 1, predecessorHeadRef: completedHead.headRef, predecessorHeadHash: completedHead.headHash, registrationRef: completedTerminal.registrationRef, registrationHash: completedTerminal.registrationHash, helperJournalHash: secondJournalHash, outcome: "ambiguous", helperSettlementRef: null, helperSettlementHash: null };
    const duplicateTerminalHash = sha256(canonical(duplicateTerminalCore));
    const duplicateTerminalRef = `setfarm://internal-production/baseline-service-restart-helper-registry-terminal/sha256/${duplicateTerminalHash}`;
    const duplicateTerminalDirectory = path.join(registryRoot, "terminals/sha256", duplicateTerminalHash.slice(0, 2));
    mkdirSync(duplicateTerminalDirectory, { recursive: true, mode: 0o700 });
    writeFileSync(path.join(duplicateTerminalDirectory, `${duplicateTerminalHash}.json`), `${canonical({ ...duplicateTerminalCore, terminalRef: duplicateTerminalRef, terminalHash: duplicateTerminalHash })}\n`, { mode: 0o600 });
    await assert.rejects(isolated.resolveInternalProductionBaselineServiceRestartHelperRegistryTerminalV1({ terminalRef: duplicateTerminalRef, terminalHash: duplicateTerminalHash }), /already has a terminal/);
    await isolated.releaseInternalProductionPhysicalServiceRestartAuthorityTransitionLeaseV1(lease);
    const registryInventory = (): ReadonlyArray<string> => {
      const visit = (directory: string): Array<string> => readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
        const member = path.join(directory, entry.name);
        return entry.isDirectory() ? visit(member) : [`${path.relative(registryRoot, member)}:${sha256(readFileSync(member, "utf8"))}`];
      });
      return visit(registryRoot).sort();
    };
    const inventoryBeforeCaps = registryInventory();
    const thirdAuthorizationHash = "b".repeat(64);
    const thirdAuthorizationRef = `setfarm://internal-production/baseline-service-restart-authorization/sha256/${thirdAuthorizationHash}`;
    const thirdOperationBody = { ...operationBody, authorizationRef: thirdAuthorizationRef, authorizationHash: thirdAuthorizationHash };
    const thirdOperationHash = sha256(canonical(thirdOperationBody));
    const thirdOperationRef = `setfarm://internal-production/baseline-service-restart-operation/sha256/${thirdOperationHash}`;
    const thirdRestartOperation = { operationRef: thirdOperationRef, operationHash: thirdOperationHash };
    (globalThis as Record<string, unknown>).__p4BaselineOperation = recursivelyFreeze({ ...thirdOperationBody, operationRef: thirdOperationRef, operationHash: thirdOperationHash });
    const thirdOutboxBody = { ...outboxBody, authorizationRef: thirdAuthorizationRef, authorizationHash: thirdAuthorizationHash, operationRef: thirdOperationRef, operationHash: thirdOperationHash };
    const thirdOutboxHash = sha256(canonical(thirdOutboxBody));
    (globalThis as Record<string, unknown>).__p4BaselineOutbox = recursivelyFreeze({ ...thirdOutboxBody, outboxRef: `setfarm://internal-production/baseline-service-restart-launch-outbox/sha256/${thirdOutboxHash}`, outboxHash: thirdOutboxHash });
    const internal = path.join(fixture, "src/internal-production");
    const registrationCapSource = readFileSync(sourcePath, "utf8").replace("MAX_INTERNAL_PRODUCTION_BASELINE_SERVICE_RESTART_HELPER_REGISTRATIONS_V1 = 10_000", "MAX_INTERNAL_PRODUCTION_BASELINE_SERVICE_RESTART_HELPER_REGISTRATIONS_V1 = 2");
    const registrationCapPath = path.join(internal, "baseline-restart-authority-retirement-registration-cap-v1.ts");
    writeFileSync(registrationCapPath, registrationCapSource);
    const registrationCapModule = await import(`${pathToFileURL(registrationCapPath).href}?registration-cap=${Date.now()}`);
    assert.equal((await registrationCapModule.observeInternalProductionBaselineServiceRestartHelperJournalCensusV1()).registeredBaselineHelperJournalCount, 2);
    const registrationCapLease = await registrationCapModule.acquireInternalProductionPhysicalServiceRestartAuthorityTransitionLeaseV1();
    await assert.rejects(registrationCapModule.invokeInternalProductionBaselineServiceRestartHelperUnderTransitionLeaseV1(registrationCapLease, { restartOperation: thirdRestartOperation }), /registration cap is exceeded/);
    await registrationCapModule.releaseInternalProductionPhysicalServiceRestartAuthorityTransitionLeaseV1(registrationCapLease);
    assert.deepEqual(registryInventory(), inventoryBeforeCaps, "registration-cap refusal precedes every registry entry/head/current mutation");
    const headCapSource = readFileSync(sourcePath, "utf8").replace("MAX_INTERNAL_PRODUCTION_BASELINE_SERVICE_RESTART_HELPER_REGISTRY_HEAD_ENTRIES_V1 = 20_000", "MAX_INTERNAL_PRODUCTION_BASELINE_SERVICE_RESTART_HELPER_REGISTRY_HEAD_ENTRIES_V1 = 4");
    const headCapPath = path.join(internal, "baseline-restart-authority-retirement-head-cap-v1.ts");
    writeFileSync(headCapPath, headCapSource);
    const headCapModule = await import(`${pathToFileURL(headCapPath).href}?head-cap=${Date.now()}`);
    assert.equal((await headCapModule.observeInternalProductionBaselineServiceRestartHelperJournalCensusV1()).registeredBaselineHelperJournalCount, 2);
    const headCapLease = await headCapModule.acquireInternalProductionPhysicalServiceRestartAuthorityTransitionLeaseV1();
    await assert.rejects(headCapModule.invokeInternalProductionBaselineServiceRestartHelperUnderTransitionLeaseV1(headCapLease, { restartOperation: thirdRestartOperation }), /head cap is exceeded|tip exceeds its fixed head budget/);
    await headCapModule.releaseInternalProductionPhysicalServiceRestartAuthorityTransitionLeaseV1(headCapLease);
    assert.deepEqual(registryInventory(), inventoryBeforeCaps, "head-cap refusal precedes every registry entry/head/current mutation");
    (globalThis as Record<string, unknown>).__p4ServiceCensus = Object.freeze({ censusHash: "9".repeat(64) });
    (globalThis as Record<string, unknown>).__p4CutoverReadiness = cutoverReadinessFixture(fixture);
    (globalThis as Record<string, unknown>).__p4CutoverGate = cutoverGateFixture((globalThis as Record<string, unknown>).__p4CutoverReadiness as Readonly<Record<string, unknown>>);
    (globalThis as Record<string, unknown>).__p4CompleteZero = completeZeroFixture();
    (globalThis as Record<string, unknown>).__p4CutoverGuard = cutoverGuardFixture((globalThis as Record<string, unknown>).__p4CompleteZero as Readonly<Record<string, unknown>>, completedCensus.censusHash);
    const ambiguousGuard = (globalThis as Record<string, unknown>).__p4CutoverGuard as Readonly<Record<string, string>>;
    await assert.rejects(isolated.prepareInternalProductionPhysicalServiceRestartAuthorityCutoverToRecoveryDV1({ zeroOwnerGuardRef: ambiguousGuard.zeroOwnerGuardRef!, zeroOwnerGuardHash: ambiguousGuard.zeroOwnerGuardHash! }), /helper journal census.*(?:stale|nonterminal)|terminal and unambiguous/);
    assert.equal(existsSync(path.join(root, "cutover-to-recovery-d-v1/cutover-pending-input.json")), false, "ambiguous helper census refuses before cutover pending bytes");
  } finally {
    Reflect.deleteProperty(globalThis, "__p4BaselineOperation");
    Reflect.deleteProperty(globalThis, "__p4BaselineOutbox");
    for (const key of ["__p4ServiceCensus", "__p4CutoverReadiness", "__p4CutoverGate", "__p4CompleteZero", "__p4CutoverGuard"]) Reflect.deleteProperty(globalThis, key);
    rmSync(fixture, { recursive: true, force: true });
  }
});

test("P4 cutover refuses an absent complete code-owned readiness tuple before mutation", async () => {
  const fixture = mkdtempSync(path.join(tmpdir(), "setfarm-p4-cutover-readiness-absent-"));
  try {
    const fixtureModulePath = installRetirementFixture(fixture, readFileSync(sourcePath, "utf8"));
    const isolated = await import(`${pathToFileURL(fixtureModulePath).href}?cutover-readiness=${Date.now()}`);
    const zeroOwnerGuardHash = "8".repeat(64);
    await assert.rejects(
      isolated.prepareInternalProductionPhysicalServiceRestartAuthorityCutoverToRecoveryDV1({ zeroOwnerGuardRef: `setfarm://internal-production/baseline-zero-owner-mutation-guard/sha256/${zeroOwnerGuardHash}`, zeroOwnerGuardHash }),
      /complete code-owned cutover readiness.*unavailable/i,
    );
    assert.equal(existsSync(path.join(fixture, "data/internal-production-baseline/restart-authority-retirement-v1/cutover-to-recovery-d-v1/cutover-pending-input.json")), false);
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});

test("P4 restart authority cutover is one-way", async () => {
  const module = await import(`../../src/internal-production/baseline-restart-authority-retirement-v1.js?p4-cutover=${Date.now()}`);
  assert.equal(typeof module.invokeInternalProductionBaselineServiceRestartHelperUnderTransitionLeaseV1, "function");
  assert.equal(module.invokeInternalProductionBaselineServiceRestartHelperUnderTransitionLeaseV1.length, 2);
  assert.equal(typeof module.prepareInternalProductionPhysicalServiceRestartAuthorityCutoverToRecoveryDV1, "function");
  assert.equal(module.prepareInternalProductionPhysicalServiceRestartAuthorityCutoverToRecoveryDV1.length, 1);
  assert.equal(typeof module.resumeActiveInternalProductionPhysicalServiceRestartAuthorityCutoverToRecoveryDV1, "function");
  assert.equal(module.resumeActiveInternalProductionPhysicalServiceRestartAuthorityCutoverToRecoveryDV1.length, 0);
  assert.equal(typeof module.observeInternalProductionPhysicalServiceRestartAuthorityCutoverStatusV1, "function");
  assert.equal(module.observeInternalProductionPhysicalServiceRestartAuthorityCutoverStatusV1.length, 0);

  const source = readFileSync(sourcePath, "utf8");
  assert.match(source, /authorityOwner:\s*"recovery-d"/);
  assert.match(source, /BASELINE_RESTART_AUTHORITY_RETIRED/);
  assert.match(source, /baseline-service-restart-helper-settlement\/sha256\//);

  const fixture = mkdtempSync(path.join(tmpdir(), "setfarm-p4-retirement-cutover-"));
  try {
    const fixtureModulePath = installRetirementFixture(fixture, source);
    (globalThis as Record<string, unknown>).__p4ServiceCensus = Object.freeze({ censusHash: "9".repeat(64) });
    (globalThis as Record<string, unknown>).__p4CutoverReadiness = cutoverReadinessFixture(fixture);
    (globalThis as Record<string, unknown>).__p4CutoverGate = cutoverGateFixture((globalThis as Record<string, unknown>).__p4CutoverReadiness as Readonly<Record<string, unknown>>);
    (globalThis as Record<string, unknown>).__p4CompleteZero = completeZeroFixture();
    const emptyHelperCensus = seedPreSchemaHelperClosure(fixture);
    (globalThis as Record<string, unknown>).__p4CutoverGuard = cutoverGuardFixture((globalThis as Record<string, unknown>).__p4CompleteZero as Readonly<Record<string, unknown>>, emptyHelperCensus.censusHash as string);
    (globalThis as Record<string, unknown>).__p4GuardConsumeCalls = 0;
    const isolated = await import(`${pathToFileURL(fixtureModulePath).href}?cutover=${Date.now()}`);
    const retirementRoot = path.join(fixture, "data/internal-production-baseline/restart-authority-retirement-v1");
    const completedHistory = seedCompletedSequenceHistory(fixture, "documentation-rollback", (globalThis as Record<string, unknown>).__p4CutoverReadiness as Readonly<Record<string, unknown>>);
    const guard = (globalThis as Record<string, unknown>).__p4CutoverGuard as Readonly<Record<string, string>>;
    const zeroOwnerGuardHash = guard.zeroOwnerGuardHash!;
    const zeroOwnerGuardRef = guard.zeroOwnerGuardRef!;
    const sequenceRoot = path.join(fixture, "data/internal-production-baseline/baseline-service-restart-sequence-v1");
    const readiness = (globalThis as Record<string, unknown>).__p4CutoverReadiness as Readonly<Record<string, unknown>>;
    const forgedIntentKind = "d-startup-hook-load";
    const forgedIntentDirectory = path.join(sequenceRoot, "intents", sha256(canonical({ schema: "setfarm.internal-production-baseline-restart-sequence-intent.v1", intentKind: forgedIntentKind })));
    seedCompletedSequenceHistory(fixture, forgedIntentKind, readiness, "f".repeat(64));
    await assert.rejects(isolated.prepareInternalProductionPhysicalServiceRestartAuthorityCutoverToRecoveryDV1({ zeroOwnerGuardRef, zeroOwnerGuardHash }), /advance 0 semantics are crossed/, "a self-consistent rehashed chain cannot cross pair0.before with the initial runtime projection");
    rmSync(forgedIntentDirectory, { recursive: true, force: true });
    seedCompletedSequenceHistory(fixture, forgedIntentKind, readiness, undefined, "not-a-sha256");
    await assert.rejects(isolated.prepareInternalProductionPhysicalServiceRestartAuthorityCutoverToRecoveryDV1({ zeroOwnerGuardRef, zeroOwnerGuardHash }), /terminal sequence semantics are crossed/, "terminal retained history requires a SHA-256 final complete-zero census hash");
    rmSync(forgedIntentDirectory, { recursive: true, force: true });
    assert.equal(existsSync(path.join(retirementRoot, "cutover-to-recovery-d-v1/cutover-pending-input.json")), false, "forged retained history refuses before cutover pending bytes");
    const intentKind = "live-rebind";
    const intentDirectoryHash = sha256(canonical({ schema: "setfarm.internal-production-baseline-restart-sequence-intent.v1", intentKind }));
    const sequenceIntentBody = { schema: "setfarm.internal-production-baseline-restart-sequence-intent.v1", intentKind, migrationReceiptRef: readiness.migrationReceiptRef, migrationReceiptHash: readiness.migrationReceiptHash, migrationSchemaProjectionHash: readiness.schemaProjectionHash, initialRuntimeSourceProjectionHash: readiness.runtimeSourceProjectionHash, orderedServiceActions: [{ service: "setfarm-spawner", actionId: "a-restart-service-setfarm-spawner-v1" }, { service: "setfarm-dashboard", actionId: "a-restart-service-setfarm-dashboard-v1" }, { service: "mission-control", actionId: "a-restart-service-mission-control-v1" }] };
    const sequenceIntentHash = sha256(canonical(sequenceIntentBody));
    const sequenceIntentRef = `setfarm://internal-production/baseline-restart-sequence-intent/sha256/${sequenceIntentHash}`;
    const intentDirectory = path.join(sequenceRoot, "intents", intentDirectoryHash);
    mkdirSync(intentDirectory, { recursive: true, mode: 0o700 });
    const sequenceIntentStore = path.join(sequenceRoot, "sequence-intents/sha256", sequenceIntentHash.slice(0, 2));
    mkdirSync(sequenceIntentStore, { recursive: true, mode: 0o700 });
    writeFileSync(path.join(sequenceIntentStore, `${sequenceIntentHash}.json`), `${canonical({ ...sequenceIntentBody, sequenceIntentRef, sequenceIntentHash })}\n`, { mode: 0o600 });
    writeFileSync(path.join(intentDirectory, "sequence-intent.pair.json"), `${canonical({ sequenceIntentRef, sequenceIntentHash })}\n`, { mode: 0o600 });
    await assert.rejects(isolated.prepareInternalProductionPhysicalServiceRestartAuthorityCutoverToRecoveryDV1({ zeroOwnerGuardRef, zeroOwnerGuardHash }), /normal restart authority set is not empty/, "sequence-wins must block cutover before pending birth");
    assert.equal(existsSync(path.join(retirementRoot, "cutover-to-recovery-d-v1/cutover-pending-input.json")), false, "sequence-wins leaves zero cutover pending bytes");
    assert.equal(existsSync(path.join(retirementRoot, "cutover-to-recovery-d-v1/00-owner-admission-fence.pair.json")), false, "sequence-wins acquires no owner fence");
    const headerContentPath = path.join(sequenceIntentStore, `${sequenceIntentHash}.json`);
    const exactHeaderContent = readFileSync(headerContentPath);
    unlinkSync(headerContentPath);
    await assert.rejects(isolated.prepareInternalProductionPhysicalServiceRestartAuthorityCutoverToRecoveryDV1({ zeroOwnerGuardRef, zeroOwnerGuardHash }), /ENOENT/, "missing named sequence content refuses before cutover mutation");
    writeFileSync(headerContentPath, exactHeaderContent, { mode: 0o600 });
    writeFileSync(headerContentPath, Buffer.from(exactHeaderContent.toString("utf8").replace("live-rebind", "documentation-rollback")), { mode: 0o600 });
    await assert.rejects(isolated.prepareInternalProductionPhysicalServiceRestartAuthorityCutoverToRecoveryDV1({ zeroOwnerGuardRef, zeroOwnerGuardHash }), /content is crossed|semantics are crossed/, "tampered named sequence content refuses before cutover mutation");
    writeFileSync(headerContentPath, exactHeaderContent, { mode: 0o600 });
    const headerLocatorPath = path.join(intentDirectory, "sequence-intent.pair.json");
    const exactHeaderLocator = readFileSync(headerLocatorPath);
    const crossedHeaderHash = "f".repeat(64);
    writeFileSync(headerLocatorPath, `${canonical({ sequenceIntentRef: `setfarm://internal-production/baseline-restart-sequence-intent/sha256/${crossedHeaderHash}`, sequenceIntentHash: crossedHeaderHash })}\n`, { mode: 0o600 });
    await assert.rejects(isolated.prepareInternalProductionPhysicalServiceRestartAuthorityCutoverToRecoveryDV1({ zeroOwnerGuardRef, zeroOwnerGuardHash }), /ENOENT/, "crossed fixed sequence locator refuses before cutover mutation");
    writeFileSync(headerLocatorPath, exactHeaderLocator, { mode: 0o600 });
    rmSync(intentDirectory, { recursive: true, force: true });
    const operation = await isolated.prepareInternalProductionPhysicalServiceRestartAuthorityCutoverToRecoveryDV1({ zeroOwnerGuardRef, zeroOwnerGuardHash });
    assert.deepEqual(Reflect.ownKeys(operation), ["operationRef", "operationHash"]);
    const resolvedOperation = await isolated.resolveInternalProductionPhysicalServiceRestartAuthorityCutoverOperationV1(operation);
    assert.deepEqual(Reflect.ownKeys(resolvedOperation), ["schema", "pendingInputRef", "pendingInputHash", "ownerAdmissionFenceRef", "ownerAdmissionFenceHash", "predecessorPhysicalRestartEpochRef", "predecessorPhysicalRestartEpochHash", "predecessorPhysicalRestartEpochOrdinal", "zeroOwnerGuardRef", "zeroOwnerGuardHash", "codeOwnedHookObservationHash", "operationRef", "operationHash"]);
    assert.equal(resolvedOperation.zeroOwnerGuardRef, zeroOwnerGuardRef);
    assert.equal(resolvedOperation.zeroOwnerGuardHash, zeroOwnerGuardHash);
    const pendingLocatorPath = path.join(fixture, "data/internal-production-baseline/restart-authority-retirement-v1/cutover-to-recovery-d-v1/cutover-pending-input.json");
    const linkedRecoveryTemporary = path.join(path.dirname(pendingLocatorPath), `.${path.basename(pendingLocatorPath)}.${"a".repeat(32)}.tmp`);
    linkSync(pendingLocatorPath, linkedRecoveryTemporary);
    assert.deepEqual(await isolated.prepareInternalProductionPhysicalServiceRestartAuthorityCutoverToRecoveryDV1({ zeroOwnerGuardRef, zeroOwnerGuardHash }), operation, "linked final+temp crash state must recover byte-identically");
    assert.equal(existsSync(linkedRecoveryTemporary), false);
    const collisionRecoveryTemporary = path.join(path.dirname(pendingLocatorPath), `.${path.basename(pendingLocatorPath)}.${"b".repeat(32)}.tmp`);
    writeFileSync(collisionRecoveryTemporary, readFileSync(pendingLocatorPath), { mode: 0o600 });
    assert.deepEqual(await isolated.prepareInternalProductionPhysicalServiceRestartAuthorityCutoverToRecoveryDV1({ zeroOwnerGuardRef, zeroOwnerGuardHash }), operation, "EEXIST collision final+temp crash state must recover byte-identically");
    assert.equal(existsSync(collisionRecoveryTemporary), false);
    const pendingStatus = await isolated.observeInternalProductionPhysicalServiceRestartAuthorityCutoverStatusV1();
    assert.deepEqual(Reflect.ownKeys(pendingStatus), ["schema", "state", "pendingInputRef", "pendingInputHash", "ownerAdmissionFenceRef", "ownerAdmissionFenceHash", "ownerAdmissionFenceReleaseRef", "ownerAdmissionFenceReleaseHash", "operationRef", "operationHash", "guardConsumed", "physicalRestartEpochOrdinal", "physicalRestartAuthorityOwner", "startupHooksReadyRef", "startupHooksReadyHash", "baselineRetirementRef", "baselineRetirementHash", "activationRef", "activationHash", "cutoverRef", "cutoverHash", "statusHash"]);
    assert.equal(pendingStatus.state, "prepared");
    assert.equal(pendingStatus.guardConsumed, false);
    (globalThis as Record<string, unknown>).__p4ReadinessDriftAfterConsumption = true;
    await assert.rejects(isolated.resumeActiveInternalProductionPhysicalServiceRestartAuthorityCutoverToRecoveryDV1(), /readiness.*changed/i, "fresh exact10/exact27 readiness drift must prevent the epoch CAS");
    assert.equal(JSON.parse(readFileSync(path.join(fixture, "data/internal-production-baseline/restart-authority-retirement-v1/epoch-head.json"), "utf8")).epochOrdinal, 1, "readiness drift must leave A epoch one visible");
    assert.equal((globalThis as Record<string, unknown>).__p4GuardConsumeCalls, 1, "readiness drift must preserve the sole guard CAS");
    Reflect.deleteProperty(globalThis, "__p4ReadinessDriftAfterConsumption");
    (globalThis as Record<string, unknown>).__p4HelperCensusDriftAfterConsumption = true;
    await assert.rejects(isolated.resumeActiveInternalProductionPhysicalServiceRestartAuthorityCutoverToRecoveryDV1(), /helper journal census authority changed|normal restart authority set changed/i, "a fresh terminal and unambiguous helper census hash drift must prevent epoch CAS");
    assert.equal(JSON.parse(readFileSync(path.join(fixture, "data/internal-production-baseline/restart-authority-retirement-v1/epoch-head.json"), "utf8")).epochOrdinal, 1);
    Reflect.deleteProperty(globalThis, "__p4HelperCensusDriftAfterConsumption");
    (globalThis as Record<string, unknown>).__p4FenceDriftAfterConsumption = true;
    await assert.rejects(isolated.resumeActiveInternalProductionPhysicalServiceRestartAuthorityCutoverToRecoveryDV1(), /fence.*(?:changed|invalid|crossed)/i, "fence identity drift after guard consumption must prevent the epoch CAS");
    assert.equal((globalThis as Record<string, unknown>).__p4GuardConsumeCalls, 1, "post-consumption fence drift must preserve the sole guard CAS");
    assert.equal(JSON.parse(readFileSync(path.join(fixture, "data/internal-production-baseline/restart-authority-retirement-v1/epoch-head.json"), "utf8")).epochOrdinal, 1, "fence drift must leave A epoch one visible");
    Reflect.deleteProperty(globalThis, "__p4FenceDriftAfterConsumption");
    const completed = await isolated.resumeActiveInternalProductionPhysicalServiceRestartAuthorityCutoverToRecoveryDV1();
    assert.deepEqual(await isolated.resumeActiveInternalProductionPhysicalServiceRestartAuthorityCutoverToRecoveryDV1(), completed);
    const terminalStatus = await isolated.observeInternalProductionPhysicalServiceRestartAuthorityCutoverStatusV1();
    assert.equal(terminalStatus.state, "recovery-d-active");
    assert.equal(terminalStatus.guardConsumed, true);
    assert.equal(typeof terminalStatus.ownerAdmissionFenceReleaseRef, "string");
    assert.equal((globalThis as Record<string, unknown>).__p4GuardConsumeCalls, 1, "terminal replay must not consume the guard twice");
    const retirement = await isolated.resolveInternalProductionBaselineRestartAuthorityRetirementV1({ retirementRef: completed.retirementRef, retirementHash: completed.retirementHash });
    assert.deepEqual(Object.keys(retirement), ["activeBaselineSequenceCount", "completeZeroOwnerCensusHash", "disposition", "liveBaselineHelperCount", "liveBaselineRestartCount", "pendingBaselineRestartCount", "predecessorEpochHash", "predecessorEpochRef", "retainedHistoricalAuthoritySetHash", "retirementHash", "retirementRef", "schema", "services", "startupHooksReadyHash", "startupHooksReadyRef", "successorActivationHash", "successorActivationRef", "successorAuthorityOwner", "successorEpochOrdinal", "zeroOwnerGuardConsumptionHash", "zeroOwnerGuardConsumptionRef", "zeroOwnerGuardHash", "zeroOwnerGuardRef"].sort());
    assert.equal(retirement.zeroOwnerGuardConsumptionRef.endsWith(retirement.zeroOwnerGuardConsumptionHash), true);
    assert.equal(retirement.retainedHistoricalAuthoritySetHash, sha256(canonical({ completedSequences: [completedHistory], retainedHelperJournalSettlementSetHash: emptyHelperCensus.retainedHelperJournalSettlementSetHash })), "retirement binds the exact three-domain terminal sequence history and helper settlement authority set");
    const cutover = await isolated.resolveInternalProductionServiceRestartAuthorityCutoverV1({ cutoverRef: completed.cutoverRef, cutoverHash: completed.cutoverHash });
    assert.equal(cutover.zeroOwnerGuardConsumptionRef, retirement.zeroOwnerGuardConsumptionRef);
    assert.equal(cutover.zeroOwnerGuardConsumptionHash, retirement.zeroOwnerGuardConsumptionHash);
    const head = JSON.parse(readFileSync(path.join(fixture, "data/internal-production-baseline/restart-authority-retirement-v1/epoch-head.json"), "utf8"));
    assert.equal(head.epochOrdinal, 2);
    assert.equal(head.authorityOwner, "recovery-d");
    assert.equal(head.predecessorEpochRef.endsWith(head.predecessorEpochHash), true);
    await assert.rejects(isolated.acquireInternalProductionPhysicalServiceRestartAuthorityTransitionLeaseV1(), /BASELINE_RESTART_AUTHORITY_RETIRED/);
  } finally {
    delete (globalThis as Record<string, unknown>).__p4ServiceCensus;
    delete (globalThis as Record<string, unknown>).__p4CutoverReadiness;
    delete (globalThis as Record<string, unknown>).__p4CutoverGate;
    delete (globalThis as Record<string, unknown>).__p4CompleteZero;
    delete (globalThis as Record<string, unknown>).__p4CutoverGuard;
    delete (globalThis as Record<string, unknown>).__p4GuardConsumption;
    delete (globalThis as Record<string, unknown>).__p4GuardConsumeCalls;
    delete (globalThis as Record<string, unknown>).__p4OwnerFenceReobservations;
    delete (globalThis as Record<string, unknown>).__p4OwnerFence;
    delete (globalThis as Record<string, unknown>).__p4FenceRelease;
    delete (globalThis as Record<string, unknown>).__p4FenceDriftAfterConsumption;
    delete (globalThis as Record<string, unknown>).__p4ReadinessDriftAfterConsumption;
    delete (globalThis as Record<string, unknown>).__p4HelperCensusDriftAfterConsumption;
    delete (globalThis as Record<string, unknown>).__p4BaselineOperation;
    delete (globalThis as Record<string, unknown>).__p4BaselineOutbox;
    rmSync(fixture, { recursive: true, force: true });
  }

  const crashFixture = mkdtempSync(path.join(tmpdir(), "setfarm-p4-retirement-cutover-crash-"));
  try {
    const injected = source.replace(
      "    replaceEpochHeadV1(successorEpoch);",
      "    const cutoverCrashHook = Reflect.get(globalThis, '__p4CutoverBeforeEpochReplace');\n    if (typeof cutoverCrashHook === 'function') cutoverCrashHook();\n    replaceEpochHeadV1(successorEpoch);",
    );
    assert.notEqual(injected, source, "cutover crash fixture must inject at the exact epoch CAS boundary");
    const fixtureModulePath = installRetirementFixture(crashFixture, injected);
    (globalThis as Record<string, unknown>).__p4ServiceCensus = Object.freeze({ censusHash: "9".repeat(64) });
    (globalThis as Record<string, unknown>).__p4CutoverReadiness = cutoverReadinessFixture(crashFixture);
    (globalThis as Record<string, unknown>).__p4CutoverGate = cutoverGateFixture((globalThis as Record<string, unknown>).__p4CutoverReadiness as Readonly<Record<string, unknown>>);
    (globalThis as Record<string, unknown>).__p4CompleteZero = completeZeroFixture();
    const helperCensus = seedPreSchemaHelperClosure(crashFixture);
    (globalThis as Record<string, unknown>).__p4CutoverGuard = cutoverGuardFixture((globalThis as Record<string, unknown>).__p4CompleteZero as Readonly<Record<string, unknown>>, helperCensus.censusHash as string);
    (globalThis as Record<string, unknown>).__p4GuardConsumeCalls = 0;
    const isolated = await import(`${pathToFileURL(fixtureModulePath).href}?cutover-crash=${Date.now()}`);
    const guard = (globalThis as Record<string, unknown>).__p4CutoverGuard as Readonly<Record<string, string>>;
    const zeroOwnerGuardHash = guard.zeroOwnerGuardHash!;
    const zeroOwnerGuardRef = guard.zeroOwnerGuardRef!;
    await isolated.prepareInternalProductionPhysicalServiceRestartAuthorityCutoverToRecoveryDV1({ zeroOwnerGuardRef, zeroOwnerGuardHash });
    Reflect.set(globalThis, "__p4CutoverBeforeEpochReplace", () => { throw new Error("CUTOVER_BEFORE_EPOCH_REPLACE"); });
    await assert.rejects(isolated.resumeActiveInternalProductionPhysicalServiceRestartAuthorityCutoverToRecoveryDV1(), /CUTOVER_BEFORE_EPOCH_REPLACE/);
    assert.equal((await isolated.observeInternalProductionPhysicalServiceRestartAuthorityCutoverStatusV1()).state, "resuming");
    const preCasRoot = path.join(crashFixture, "data/internal-production-baseline/restart-authority-retirement-v1/cutover-to-recovery-d-v1");
    const storedPreCasRetirement = JSON.parse(readFileSync(path.join(preCasRoot, "04-retirement.pair.json"), "utf8"));
    const storedPreCasActivation = JSON.parse(readFileSync(path.join(preCasRoot, "05-activation.pair.json"), "utf8"));
    const storedPreCasCutover = JSON.parse(readFileSync(path.join(preCasRoot, "07-cutover.pair.json"), "utf8"));
    const preCasRetirement = { retirementRef: storedPreCasRetirement.retirementRef, retirementHash: storedPreCasRetirement.retirementHash };
    const preCasActivation = { activationRef: storedPreCasActivation.activationRef, activationHash: storedPreCasActivation.activationHash };
    const preCasCutover = { cutoverRef: storedPreCasCutover.cutoverRef, cutoverHash: storedPreCasCutover.cutoverHash };
    await assert.rejects(isolated.resolveInternalProductionBaselineRestartAuthorityRetirementV1(preCasRetirement), /terminal|epoch/i, "pre-CAS retirement candidate must remain invisible");
    await assert.rejects(isolated.resolveInternalProductionServiceRestartAuthorityActivationV1(preCasActivation), /terminal|epoch/i, "pre-CAS activation candidate must remain invisible");
    await assert.rejects(isolated.resolveInternalProductionServiceRestartAuthorityCutoverV1(preCasCutover), /terminal|epoch/i, "pre-CAS cutover candidate must remain invisible");
    Reflect.deleteProperty(globalThis, "__p4CutoverBeforeEpochReplace");
    const recovered = await isolated.resumeActiveInternalProductionPhysicalServiceRestartAuthorityCutoverToRecoveryDV1();
    assert.equal((await isolated.observeInternalProductionPhysicalServiceRestartAuthorityCutoverStatusV1()).state, "recovery-d-active");
    assert.equal(recovered.successorEpochRef.endsWith(recovered.successorEpochHash), true);
  } finally {
    Reflect.deleteProperty(globalThis, "__p4CutoverBeforeEpochReplace");
    delete (globalThis as Record<string, unknown>).__p4ServiceCensus;
    delete (globalThis as Record<string, unknown>).__p4CutoverReadiness;
    delete (globalThis as Record<string, unknown>).__p4CutoverGate;
    delete (globalThis as Record<string, unknown>).__p4CompleteZero;
    delete (globalThis as Record<string, unknown>).__p4CutoverGuard;
    delete (globalThis as Record<string, unknown>).__p4GuardConsumption;
    delete (globalThis as Record<string, unknown>).__p4GuardConsumeCalls;
    delete (globalThis as Record<string, unknown>).__p4OwnerFenceReobservations;
    delete (globalThis as Record<string, unknown>).__p4OwnerFence;
    delete (globalThis as Record<string, unknown>).__p4FenceRelease;
    rmSync(crashFixture, { recursive: true, force: true });
  }

  const postCasFixture = mkdtempSync(path.join(tmpdir(), "setfarm-p4-retirement-cutover-post-cas-crash-"));
  try {
    const injected = source.replace(
      "    replaceEpochHeadV1(successorEpoch);",
      "    replaceEpochHeadV1(successorEpoch);\n    const cutoverAfterCasHook = Reflect.get(globalThis, '__p4CutoverAfterEpochReplace');\n    if (typeof cutoverAfterCasHook === 'function') cutoverAfterCasHook();",
    );
    assert.notEqual(injected, source, "post-CAS cutover crash fixture must inject after the exact epoch CAS boundary");
    const fixtureModulePath = installRetirementFixture(postCasFixture, injected);
    (globalThis as Record<string, unknown>).__p4ServiceCensus = Object.freeze({ censusHash: "9".repeat(64) });
    (globalThis as Record<string, unknown>).__p4CutoverReadiness = cutoverReadinessFixture(postCasFixture);
    (globalThis as Record<string, unknown>).__p4CutoverGate = cutoverGateFixture((globalThis as Record<string, unknown>).__p4CutoverReadiness as Readonly<Record<string, unknown>>);
    (globalThis as Record<string, unknown>).__p4CompleteZero = completeZeroFixture();
    const helperCensus = seedPreSchemaHelperClosure(postCasFixture);
    (globalThis as Record<string, unknown>).__p4CutoverGuard = cutoverGuardFixture((globalThis as Record<string, unknown>).__p4CompleteZero as Readonly<Record<string, unknown>>, helperCensus.censusHash as string);
    (globalThis as Record<string, unknown>).__p4GuardConsumeCalls = 0;
    const isolated = await import(`${pathToFileURL(fixtureModulePath).href}?cutover-post-cas=${Date.now()}`);
    const guard = (globalThis as Record<string, unknown>).__p4CutoverGuard as Readonly<Record<string, string>>;
    await isolated.prepareInternalProductionPhysicalServiceRestartAuthorityCutoverToRecoveryDV1({ zeroOwnerGuardRef: guard.zeroOwnerGuardRef!, zeroOwnerGuardHash: guard.zeroOwnerGuardHash! });
    Reflect.set(globalThis, "__p4CutoverAfterEpochReplace", () => { throw new Error("CUTOVER_AFTER_EPOCH_REPLACE"); });
    await assert.rejects(isolated.resumeActiveInternalProductionPhysicalServiceRestartAuthorityCutoverToRecoveryDV1(), /CUTOVER_AFTER_EPOCH_REPLACE/);
    assert.equal((await isolated.observeInternalProductionPhysicalServiceRestartAuthorityCutoverStatusV1()).state, "resuming");
    const postCasRoot = path.join(postCasFixture, "data/internal-production-baseline/restart-authority-retirement-v1/cutover-to-recovery-d-v1");
    const storedPostCasCutover = JSON.parse(readFileSync(path.join(postCasRoot, "07-cutover.pair.json"), "utf8"));
    const postCasCutover = { cutoverRef: storedPostCasCutover.cutoverRef, cutoverHash: storedPostCasCutover.cutoverHash };
    await assert.rejects(isolated.resolveInternalProductionServiceRestartAuthorityCutoverV1(postCasCutover), /terminal|release/i, "post-CAS cutover candidate must remain invisible until fence release");
    Reflect.deleteProperty(globalThis, "__p4CutoverAfterEpochReplace");
    const recovered = await isolated.resumeActiveInternalProductionPhysicalServiceRestartAuthorityCutoverToRecoveryDV1();
    assert.equal((await isolated.observeInternalProductionPhysicalServiceRestartAuthorityCutoverStatusV1()).state, "recovery-d-active");
    assert.equal(recovered.cutoverRef.endsWith(recovered.cutoverHash), true);
    assert.equal((globalThis as Record<string, unknown>).__p4GuardConsumeCalls, 1, "post-CAS recovery must not consume the guard twice");
  } finally {
    Reflect.deleteProperty(globalThis, "__p4CutoverAfterEpochReplace");
    for (const key of ["__p4ServiceCensus", "__p4CutoverReadiness", "__p4CutoverGate", "__p4CompleteZero", "__p4CutoverGuard", "__p4GuardConsumption", "__p4GuardConsumeCalls", "__p4OwnerFenceReobservations", "__p4OwnerFence", "__p4FenceRelease"]) Reflect.deleteProperty(globalThis, key);
    rmSync(postCasFixture, { recursive: true, force: true });
  }
});

test("P4 cutover resumes pending-only and fence-only crash prefixes", async () => {
  const original = readFileSync(sourcePath, "utf8");
  const crashes = [
    [
      "pending-only",
      "    const pending = publishPendingInputV1(guard);",
      "    const pending = publishPendingInputV1(guard);\n    if (!Reflect.get(globalThis, '__p4PendingOnlyCrash')) { Reflect.set(globalThis, '__p4PendingOnlyCrash', true); throw new Error('P4_PENDING_ONLY_CRASH'); }",
    ],
    [
      "fence-only",
      "      writeNoReplace(cutoverLocatorV1(\"00-owner-admission-fence\"), fencePair);",
      "      writeNoReplace(cutoverLocatorV1(\"00-owner-admission-fence\"), fencePair);\n      if (!Reflect.get(globalThis, '__p4FenceOnlyCrash')) { Reflect.set(globalThis, '__p4FenceOnlyCrash', true); throw new Error('P4_FENCE_ONLY_CRASH'); }",
    ],
  ] as const;
  for (const [name, needle, replacement] of crashes) {
    const fixture = mkdtempSync(path.join(tmpdir(), `setfarm-p4-cutover-${name}-`));
    try {
      assert.equal(original.includes(needle), true, `${name} injection target exists`);
      const fixtureModulePath = installRetirementFixture(fixture, original.replace(needle, replacement));
      (globalThis as Record<string, unknown>).__p4ServiceCensus = Object.freeze({ censusHash: "9".repeat(64) });
      (globalThis as Record<string, unknown>).__p4CutoverReadiness = cutoverReadinessFixture(fixture);
      (globalThis as Record<string, unknown>).__p4CutoverGate = cutoverGateFixture((globalThis as Record<string, unknown>).__p4CutoverReadiness as Readonly<Record<string, unknown>>);
      (globalThis as Record<string, unknown>).__p4CompleteZero = completeZeroFixture();
      const helperCensus = seedPreSchemaHelperClosure(fixture);
      (globalThis as Record<string, unknown>).__p4CutoverGuard = cutoverGuardFixture((globalThis as Record<string, unknown>).__p4CompleteZero as Readonly<Record<string, unknown>>, helperCensus.censusHash as string);
      (globalThis as Record<string, unknown>).__p4GuardConsumeCalls = 0;
      const isolated = await import(`${pathToFileURL(fixtureModulePath).href}?cutover-prefix=${name}-${Date.now()}`);
      const guard = (globalThis as Record<string, unknown>).__p4CutoverGuard as Readonly<Record<string, string>>;
      await assert.rejects(
        isolated.prepareInternalProductionPhysicalServiceRestartAuthorityCutoverToRecoveryDV1({ zeroOwnerGuardRef: guard.zeroOwnerGuardRef, zeroOwnerGuardHash: guard.zeroOwnerGuardHash }),
        new RegExp(`P4_${name.replace("-", "_").toUpperCase()}_CRASH`),
      );
      const recovered = await isolated.resumeActiveInternalProductionPhysicalServiceRestartAuthorityCutoverToRecoveryDV1();
      assert.equal(recovered.cutoverRef.endsWith(recovered.cutoverHash), true, `${name} prefix reaches the one terminal cutover`);
      assert.equal((await isolated.observeInternalProductionPhysicalServiceRestartAuthorityCutoverStatusV1()).state, "recovery-d-active");
    } finally {
      for (const key of ["__p4ServiceCensus", "__p4CutoverReadiness", "__p4CutoverGate", "__p4CompleteZero", "__p4CutoverGuard", "__p4GuardConsumption", "__p4GuardConsumeCalls", "__p4OwnerFenceReobservations", "__p4OwnerFence", "__p4FenceRelease", "__p4PendingOnlyCrash", "__p4FenceOnlyCrash"]) Reflect.deleteProperty(globalThis, key);
      rmSync(fixture, { recursive: true, force: true });
    }
  }
});
