import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, linkSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { pathToFileURL } from "node:url";

const sourcePath = path.resolve(import.meta.dirname, "../../src/internal-production/baseline-service-restart-sequence-v1.ts");

function canonical(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${canonical(record[key])}`).join(",")}}`;
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

test("restart sequence exposes the fixed public surface", async () => {
  const module = await import("../../src/internal-production/baseline-service-restart-sequence-v1.js");
  assert.deepEqual(Object.keys(module), [
    "observeInternalProductionBaselineRestartSequenceStatusV1",
    "resolveInternalProductionBaselineRestartSequenceReceiptV1",
    "resumeInternalProductionBaselineRestartSequenceV1",
  ]);
  assert.equal(module.resumeInternalProductionBaselineRestartSequenceV1.length, 1);
  assert.equal(module.observeInternalProductionBaselineRestartSequenceStatusV1.length, 1);
  assert.equal(module.resolveInternalProductionBaselineRestartSequenceReceiptV1.length, 1);

  const fixture = mkdtempSync(path.join(tmpdir(), "setfarm-sequence-public-surface-"));
  try {
    const internal = path.join(fixture, "src/internal-production");
    mkdirSync(internal, { recursive: true });
    const modulePath = path.join(internal, "baseline-service-restart-sequence-v1.ts");
    writeFileSync(modulePath, readFileSync(sourcePath, "utf8"));
    writeFileSync(path.join(internal, "baseline-post-handoff-receipt-v1.ts"), `throw new Error("receipt module imported eagerly");\nexport function observeCurrentInternalProductionCleanSetfarmSourceBuildV1(){throw new Error("absent status must not observe source")}\n`);
    writeFileSync(path.join(internal, "baseline-restart-authority-retirement-v1.ts"), `export async function acquireInternalProductionPhysicalServiceRestartAuthorityTransitionLeaseV1(){return Object.freeze({})}\nexport async function releaseInternalProductionPhysicalServiceRestartAuthorityTransitionLeaseV1(){}\nexport async function observeInternalProductionPhysicalServiceRestartAuthorityCutoverStatusV1(){return Object.freeze({state:"baseline-a-active",operation:null,cutover:null})}\n`);
    const isolated = await import(`${pathToFileURL(modulePath).href}?surface=${Date.now()}`);
    for (const intentKind of ["live-rebind", "d-startup-hook-load", "documentation-rollback"] as const) {
      const status = await isolated.observeInternalProductionBaselineRestartSequenceStatusV1({ intentKind });
      assert.equal(status.state, "absent");
      assert.equal(status.intentKind, intentKind);
      assert.equal(status.schema, "setfarm.internal-production-baseline-restart-sequence-status.v1");
      assert.equal(status.migrationReceiptRef, null);
      assert.equal(status.migrationReceiptHash, null);
      assert.equal(status.activeOrdinal, null);
      assert.equal(status.sequenceRef, null);
      assert.equal(status.statusRef.endsWith(status.statusHash), true);
      assert.equal(Object.isFrozen(status), true);
    }
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});

test("P4 restart sequence requires the exact terminal migration receipt before mutation", async () => {
  const fixture = mkdtempSync(path.join(tmpdir(), "setfarm-p4-restart-sequence-terminal-receipt-"));
  try {
    const internal = path.join(fixture, "src/internal-production");
    mkdirSync(internal, { recursive: true });
    const modulePath = path.join(internal, "baseline-service-restart-sequence-v1.ts");
    writeFileSync(modulePath, readFileSync(sourcePath, "utf8"));
    writeFileSync(path.join(internal, "baseline-post-handoff-receipt-v1.ts"), `
export function observeCurrentInternalProductionCleanSetfarmSourceBuildV1(){return Object.freeze({sha:${JSON.stringify("a".repeat(40))},treeHash:${JSON.stringify("b".repeat(40))},buildHash:${JSON.stringify("4".repeat(64))}})}
export async function observeCurrentInternalProductionAuthorityV3Migration31AuditV1(){return Object.freeze({authorityV3Migration31AuditRef:${JSON.stringify(`setfarm://internal-production/authority-v3-migration31-audit/sha256/${"1".repeat(64)}`)},authorityV3Migration31AuditHash:${JSON.stringify("1".repeat(64))}})}
export async function observeCurrentInternalProductionPendingBootstrapHandoffMigrationV1(){return Object.freeze({pendingBootstrapHandoffMigrationRef:${JSON.stringify(`setfarm://internal-production/pending-bootstrap-handoff-migration/sha256/${"2".repeat(64)}`)},pendingBootstrapHandoffMigrationHash:${JSON.stringify("2".repeat(64))}})}
export async function observeInternalProductionLegacyPreManifestZeroOwnerV1(){throw new Error("must not reach zero observer")}
export async function observeCompleteInternalProductionZeroOwnerCensusV1(){throw new Error("must not reach complete zero observer")}
`);
    writeFileSync(path.join(internal, "baseline-restart-authority-retirement-v1.ts"), `
export async function acquireInternalProductionPhysicalServiceRestartAuthorityTransitionLeaseV1(){globalThis.__p4SequenceMutation=(globalThis.__p4SequenceMutation??0)+1;return Object.freeze({})}
export async function releaseInternalProductionPhysicalServiceRestartAuthorityTransitionLeaseV1(_lease){}
export async function observeInternalProductionPhysicalServiceRestartAuthorityCutoverStatusV1(){return Object.freeze({state:"baseline-a-active"})}
export async function invokeInternalProductionBaselineServiceRestartHelperUnderTransitionLeaseV1(){throw new Error("must not dispatch")}
`);
    Reflect.set(globalThis, "__p4SequenceMutation", 0);
    const isolated = await import(`${pathToFileURL(modulePath).href}?terminal-receipt=${Date.now()}`);
    await assert.rejects(
      isolated.resumeInternalProductionBaselineRestartSequenceV1({ intentKind: "live-rebind" }),
      /terminal bootstrap-handoff migration receipt.*unavailable/i,
    );
    assert.equal(Reflect.get(globalThis, "__p4SequenceMutation"), 0);
    assert.equal(existsSync(path.join(fixture, "data/internal-production-baseline/baseline-service-restart-sequence-v1")), false, "missing terminal migration authority must leave zero sequence bytes");
  } finally {
    Reflect.deleteProperty(globalThis, "__p4SequenceMutation");
    rmSync(fixture, { recursive: true, force: true });
  }
});

test("P4 restart sequence resumes every durable prefix", async () => {
  const source = readFileSync(sourcePath, "utf8");
  assert.doesNotMatch(source, /^import[\s\S]*?from "\.\/baseline-post-handoff-receipt-v1\.js";/m, "sequence has no eager receipt-module edge");
  assert.match(source, /await import\("\.\/baseline-post-handoff-receipt-v1\.js"\)/, "receipt authority is loaded only at an invoked function-local boundary");
  const compositePublicationAnchor = "if (!storedAuthority) publish(operationLocatorPath(intentKind, ordinal), authorityPair);";
  const crashableSource = source.replace(compositePublicationAnchor, `${compositePublicationAnchor}\n      if ((globalThis as Record<string, unknown>).__p4CrashAfterComposite && !(globalThis as Record<string, unknown>).__p4CompositeCrashed) { (globalThis as Record<string, unknown>).__p4CompositeCrashed = true; throw new Error("P4_AFTER_COMPOSITE_CRASH"); }`);
  assert.notEqual(crashableSource, source, "composite crash fixture instruments the exact post-publication boundary");
  const lockPublicationAnchor = "writeFileSync(descriptor, bytes); fsyncSync(descriptor); directoryGuard.assertStable();";
  const liveWaitAnchor = "if (publication === \"in-progress\") { await new Promise<void>((resolve) => setTimeout(resolve, 5)); continue; }";
  const instrumentedSource = crashableSource
    .replace(lockPublicationAnchor, `${lockPublicationAnchor}\n      if ((globalThis as Record<string, unknown>).__p4LockPublishBarrier && !(globalThis as Record<string, unknown>).__p4LockPublisherPaused) { (globalThis as Record<string, unknown>).__p4LockPublisherPaused = true; await new Promise<void>((resolve) => setTimeout(resolve, 75)); }`)
    .replace(liveWaitAnchor, `if (publication === "in-progress") { (globalThis as Record<string, unknown>).__p4LiveLockWaits = Number((globalThis as Record<string, unknown>).__p4LiveLockWaits ?? 0) + 1; await new Promise<void>((resolve) => setTimeout(resolve, 5)); continue; }`);
  assert.notEqual(instrumentedSource, crashableSource, "lock fixture instruments the exact temp-fsync/pre-link and live-wait boundaries");
  assert.doesNotMatch(source, /^import .*baseline-restart-authority-retirement-v1/m, "sequence must not create an eager retirement-module cycle");
  assert.match(source, /await import\("\.\/baseline-restart-authority-retirement-v1\.js"\)/, "transition authority is loaded only at the function-local intent-birth boundary");
  assert.doesNotMatch(source, /invokeInternalProductionBaselineServiceRestartHelperUnderTransitionLeaseV1/, "sequence never bypasses Task12's composite restart authority");
  assert.match(source, /module\.restartInternalProductionBaselineServiceV1/);
  assert.doesNotMatch(source, /module\.restartInternalProductionBaselineServiceRestartV1/);
  assert.match(source, /authority\.migrationSchemaProjectionHash\s*!==\s*header\.migrationSchemaProjectionHash/);
  assert.match(source, /authority\.zeroOwnerGuardRef\s*!==\s*authorization\.zeroOwnerGuardRef/);
  assert.match(source, /receipt\.finalRuntimeSourceProjectionHash\s*!==\s*finalAdvance\.afterRuntimeSourceProjectionHash/);
  for (const failAt of [1, 2, 3]) {
    const fixture = mkdtempSync(path.join(tmpdir(), `setfarm-p4-restart-sequence-${failAt}-`));
    try {
      const internal = path.join(fixture, "src/internal-production");
      mkdirSync(internal, { recursive: true });
      const modulePath = path.join(internal, "baseline-service-restart-sequence-v1.ts");
      writeFileSync(modulePath, instrumentedSource);
      const v31Hash = "1".repeat(64);
      const pendingHash = "2".repeat(64);
      const zeroHash = "3".repeat(64);
      const migrationBytes = Buffer.from("export const migration = true;\n", "utf8");
      const migrationBlobHash = createHash("sha1").update(`blob ${migrationBytes.length}\0`).update(migrationBytes).digest("hex");
      mkdirSync(path.join(fixture, "src/db"), { recursive: true });
      writeFileSync(path.join(fixture, "src/db/bootstrap-main-claim-handoff-v1-migration.ts"), migrationBytes);
      const migrationSourceSha = "a".repeat(40);
      const refFor = (kind: string, hash: string) => `setfarm://internal-production/${kind}/sha256/${hash}`;
      const causalHash = (digit: string) => digit.repeat(64);
      const migrationReceiptBody = {
        schema: "setfarm.internal-production-baseline-bootstrap-handoff-migration-receipt.v1", migrationId: "contract-spine-bootstrap-main-claim-handoff-v1",
        predecessorAuthorityV3Migration31AuditRef: refFor("authority-v3-migration31-audit", causalHash("1")), predecessorAuthorityV3Migration31AuditHash: causalHash("1"),
        pendingBootstrapHandoffMigrationRef: refFor("pending-bootstrap-handoff-migration", causalHash("2")), pendingBootstrapHandoffMigrationHash: causalHash("2"),
        migrationSourceSha, migrationImplementationBlobHash: migrationBlobHash, orderedStatementsHash: "ccfcfdb6ed9e9d87add9e28394b2e67bf9ed55347841fe0529cdde4d6a5b34c9", namedMigrationDigestEntryHash: "81d9164ca0f2c0be1cece391fc654a854c28ccfce905b87c3ad680202f95557c", migrationDigest: "8cbaab0c47bf3639033442d2df9a1c15d421eb34adbab72fa82951712cafe4e2", schemaProjectionHash: "9f44b6312ba62fb7b48da153e70fa7f19ce543dbeec500b9111d750847a7eed1",
        currentEntryOperationRef: refFor("current-entry-operation", causalHash("3")), currentEntryOperationHash: causalHash("3"), preSchemaSpawnerRebindAuthorizationRef: refFor("pre-schema-spawner-rebind-authorization", causalHash("4")), preSchemaSpawnerRebindAuthorizationHash: causalHash("4"), preSchemaSpawnerStartupTokenRef: refFor("pre-schema-spawner-startup-token", causalHash("5")), preSchemaSpawnerStartupTokenHash: causalHash("5"), preSchemaSpawnerRestartAuthorityRef: refFor("pre-schema-spawner-restart-authority", causalHash("6")), preSchemaSpawnerRestartAuthorityHash: causalHash("6"), predecessorTerminationObservationRef: refFor("predecessor-termination-observation", causalHash("7")), predecessorTerminationObservationHash: causalHash("7"), replacementProcessObservationRef: refFor("replacement-process-observation", causalHash("8")), replacementProcessObservationHash: causalHash("8"), preSchemaSpawnerSealedAdmissionRef: refFor("pre-schema-spawner-sealed-admission", causalHash("9")), preSchemaSpawnerSealedAdmissionHash: causalHash("9"), postPredecessorTerminationLegacyZeroOwnerObservationRef: refFor("legacy-pre-manifest-zero-owner-observation", causalHash("a")), postPredecessorTerminationLegacyZeroOwnerObservationHash: causalHash("a"), freshLegacyZeroOwnerObservationRef: refFor("legacy-pre-manifest-zero-owner-observation", causalHash("b")), freshLegacyZeroOwnerObservationHash: causalHash("b"), preManifestMigration32AuthorizationRef: refFor("pre-manifest-migration-32-authorization", causalHash("c")), preManifestMigration32AuthorizationHash: causalHash("c"), preManifestMigration32AuthorizationConsumptionRef: refFor("pre-manifest-migration-32-authorization-consumption", causalHash("d")), preManifestMigration32AuthorizationConsumptionHash: causalHash("d"),
        planStatus: "exact-pending-migration", applyStatus: "applied", verifyStatus: "verified", bootstrapHandoffOperationTablePresent: true, bootstrapHandoffOperationIdUnique: true, bootstrapHandoffClaimIdUnique: true, terminalReceiptPairColumnsPresent: true, ownerReservationSidecarPresent: true, ownerAdmissionHeadPresent: true,
      };
      const migrationReceiptHash = sha256(canonical(migrationReceiptBody));
      const migrationReceipt = { ...migrationReceiptBody, migrationReceiptRef: refFor("baseline-bootstrap-handoff-migration-receipt", migrationReceiptHash), migrationReceiptHash };
      const terminalStatusBody = { schema: "setfarm.internal-production-pre-manifest-migration-32-authorization-status.v1", state: "terminal", currentEntryOperation: { operationRef: migrationReceipt.currentEntryOperationRef, operationHash: migrationReceipt.currentEntryOperationHash }, authorization: { authorizationRef: migrationReceipt.preManifestMigration32AuthorizationRef, authorizationHash: migrationReceipt.preManifestMigration32AuthorizationHash }, consumption: { consumptionRef: migrationReceipt.preManifestMigration32AuthorizationConsumptionRef, consumptionHash: migrationReceipt.preManifestMigration32AuthorizationConsumptionHash }, migrationReceipt: { migrationReceiptRef: migrationReceipt.migrationReceiptRef, migrationReceiptHash }, refusalCode: null };
      const terminalStatusHash = sha256(canonical(terminalStatusBody));
      const terminalStatus = { ...terminalStatusBody, statusRef: refFor("pre-manifest-migration-32-authorization-status", terminalStatusHash), statusHash: terminalStatusHash };
      writeFileSync(path.join(internal, "baseline-post-handoff-receipt-v1.ts"), `
import {createHash} from "node:crypto";
const canonical=(value)=>value===null||typeof value!=="object"?JSON.stringify(value):Array.isArray(value)?\`[\${value.map(canonical).join(",")}]\`:\`{\${Object.keys(value).sort().map((key)=>\`\${JSON.stringify(key)}:\${canonical(value[key])}\`).join(",")}}\`;
const sha256=(value)=>createHash("sha256").update(value).digest("hex");
export function observeCurrentInternalProductionCleanSetfarmSourceBuildV1(){globalThis.__p4SourceObservations=(globalThis.__p4SourceObservations??0)+1;return Object.freeze({sha:${JSON.stringify(migrationSourceSha)},treeHash:${JSON.stringify("b".repeat(40))},buildHash:globalThis.__p4BuildHash??${JSON.stringify("4".repeat(64))}})}
const migrationReceipt=Object.freeze(${JSON.stringify(migrationReceipt)});
const terminalStatus=Object.freeze(${JSON.stringify(terminalStatus)});
export async function observeInternalProductionPreManifestMigration32AuthorizationStatusV1(){globalThis.__p4TerminalObservations=(globalThis.__p4TerminalObservations??0)+1;return terminalStatus}
export async function resolveInternalProductionBaselineBootstrapHandoffMigrationReceiptV1(pair){if(pair.migrationReceiptRef!==migrationReceipt.migrationReceiptRef||pair.migrationReceiptHash!==migrationReceipt.migrationReceiptHash)throw new Error("crossed fixture migration pair");return migrationReceipt}
const completeZeroKeys=${JSON.stringify(["activeRunCount", "openClaimCount", "executionAttemptCount", "activeRuntimeSessionCount", "activeCompletionOwnerCount", "unsettledMandatoryEffectCount", "ordinaryStartingCount", "restartReservationCount", "serviceRestartOperationCount", "launchPreparationCount", "preparedLaunchCount", "stagedCaseCount", "fixtureAttemptCount", "artifactReservationCount", "publicationBatchCount", "artifactPublicationCount", "docsSessionCount", "docsLeaseCount", "fleetStageCount", "fleetInflightCount", "fleetPendingReviewCount", "matrixInflightCount", "launchOutboxCount", "terminationOwnerCount", "findingOwnerCount", "recoveryOwnerCount", "operationalDeliveryCount", "sourceRunOwnerCount", "coldRehearsalOwnerCount", "compilationLeaseCount", "executionLeaseCount", "ownedProcessCount", "ownedListenerCount", "ownedWorktreeCount", "dirtyWorktreeCount", "staleChildCount"])};
export async function observeCompleteInternalProductionZeroOwnerCensusV1(){const body={schema:"setfarm.internal-production-complete-zero-owner-census-observation.v1",census:Object.freeze(Object.fromEntries(completeZeroKeys.map((key)=>[key,0]))),ownerCategoryRegistryHash:${JSON.stringify("1".repeat(64))},ownerCategoryCensusMapHash:${JSON.stringify("2".repeat(64))},activeProducerManifestSetActivationRef:${JSON.stringify(refFor("owner-producer-manifest-set-activation", "3".repeat(64)))},activeProducerManifestSetActivationHash:${JSON.stringify("3".repeat(64))},activeProducerManifestSetHash:${JSON.stringify("4".repeat(64))},reservationIdentitySetHash:${JSON.stringify("5".repeat(64))},ownerIdentitySetHash:${JSON.stringify("6".repeat(64))}};const observationHash=sha256(canonical(body));return Object.freeze({...body,observationRef:"setfarm://internal-production/complete-zero-owner-census-observation/sha256/"+observationHash,observationHash})}
export async function resolveInternalProductionCompleteZeroOwnerCensusObservationV1(input){globalThis.__p4CompleteZeroResolutions=(globalThis.__p4CompleteZeroResolutions??0)+1;const value=await observeCompleteInternalProductionZeroOwnerCensusV1();if(value.observationRef!==input.observationRef||value.observationHash!==input.observationHash)throw new Error("crossed complete zero fixture pair");return value}
export async function observeInternalProductionReviewedDSourceBuildGateV1(){return Object.freeze({schema:"setfarm.internal-production-reviewed-d-source-build-gate.v1",reviewed:true,setfarmSourceSha:${JSON.stringify(migrationSourceSha)},missionControlSourceSha:${JSON.stringify("c".repeat(40))},setfarmBuildHash:${JSON.stringify("4".repeat(64))},missionControlBuildHash:${JSON.stringify("5".repeat(64))},recoveryProducerManifestActivationRef:${JSON.stringify(refFor("recovery-owner-producer-manifest-activation", "6".repeat(64)))},recoveryProducerManifestActivationHash:${JSON.stringify("6".repeat(64))},missionControlHandoffRef:${JSON.stringify(refFor("recovery-mission-control-source-handoff", "7".repeat(64)))},missionControlHandoffHash:${JSON.stringify("7".repeat(64))}})}
const actions={"setfarm-spawner":"a-restart-service-setfarm-spawner-v1","setfarm-dashboard":"a-restart-service-setfarm-dashboard-v1","mission-control":"a-restart-service-mission-control-v1"};
const authorizations=new Map();const authorities=new Map();const unknownSettlements=new Set();
const initialProjection=()=>{const body={schema:"setfarm.internal-production-baseline-runtime-source-projection.v1",setfarmSha:${JSON.stringify(migrationSourceSha)},missionControlSha:${JSON.stringify("c".repeat(40))},setfarmBuildInfoHash:${JSON.stringify("4".repeat(64))},spawnerBuildHash:${JSON.stringify("4".repeat(64))},spawnerServiceIdentityHash:${JSON.stringify("8".repeat(64))},dashboardBuildHash:${JSON.stringify("4".repeat(64))},dashboardServiceIdentityHash:${JSON.stringify("9".repeat(64))},missionControlBuildHash:${JSON.stringify("5".repeat(64))},missionControlServiceIdentityHash:${JSON.stringify("a".repeat(64))}};return Object.freeze({...body,projectionHash:sha256(canonical(body))})};
export async function observeInternalProductionServiceCensusV1(){const projection=globalThis.__p4RuntimeProjection??initialProjection();return Object.freeze({schema:"setfarm.internal-production-service-census.v1",spawner:Object.freeze({loadedSourceSha:projection.setfarmSha,loadedBuildHash:projection.spawnerBuildHash,serviceIdentityHash:projection.spawnerServiceIdentityHash}),dashboard:Object.freeze({loadedSourceSha:projection.setfarmSha,loadedBuildHash:projection.dashboardBuildHash,serviceIdentityHash:projection.dashboardServiceIdentityHash}),missionControl:Object.freeze({loadedSourceSha:projection.missionControlSha,loadedBuildHash:projection.missionControlBuildHash,serviceIdentityHash:projection.missionControlServiceIdentityHash}),openClaw:Object.freeze({}),censusHash:${JSON.stringify("f".repeat(64))}})}
export async function prepareInternalProductionBaselineServiceRestartV1(input){const projection=globalThis.__p4RuntimeProjection??initialProjection();const body={schema:"setfarm.internal-production-baseline-service-restart-authorization.v1",service:input.service,migrationReceiptRef:migrationReceipt.migrationReceiptRef,migrationReceiptHash:migrationReceipt.migrationReceiptHash,zeroOwnerGuardRef:${JSON.stringify(refFor("complete-zero-owner-observation", "d".repeat(64)))},zeroOwnerGuardHash:${JSON.stringify("d".repeat(64))},completeZeroOwnerCensusHash:${JSON.stringify(zeroHash)},preparedRuntimeSourceProjectionHash:projection.projectionHash};const authorizationHash=sha256(canonical(body));const value=Object.freeze({...body,authorizationRef:\`setfarm://internal-production/baseline-service-restart-authorization/sha256/\${authorizationHash}\`,authorizationHash});authorizations.set(authorizationHash,value);return Object.freeze({authorizationRef:value.authorizationRef,authorizationHash})}
export async function resolveInternalProductionBaselineServiceRestartAuthorizationV1(input){const value=authorizations.get(input.authorizationHash);if(!value||value.authorizationRef!==input.authorizationRef)throw new Error("crossed fixture authorization pair");return value}
export async function restartInternalProductionBaselineServiceV1(input){const authorization=authorizations.get(input.authorizationHash);if(!authorization||authorization.authorizationRef!==input.authorizationRef)throw new Error("crossed fixture authorization");if(unknownSettlements.has(input.authorizationHash)){if(!globalThis.__p4SettleUnknown)throw new Error("HELPER_DISPATCH_SETTLEMENT_UNKNOWN");unknownSettlements.delete(input.authorizationHash)}else{globalThis.__p4SequenceCalls=(globalThis.__p4SequenceCalls??0)+1;globalThis.__p4SequenceActions=[...(globalThis.__p4SequenceActions??[]),actions[authorization.service]];if(globalThis.__p4SequenceFailAt===globalThis.__p4SequenceCalls&&!globalThis.__p4SequenceFailed){globalThis.__p4SequenceFailed=true;unknownSettlements.add(input.authorizationHash);throw new Error("HELPER_DISPATCH_SETTLEMENT_UNKNOWN")}}const before=globalThis.__p4RuntimeProjection??initialProjection();const changedKey=authorization.service==="mission-control"?"missionControlServiceIdentityHash":authorization.service==="setfarm-dashboard"?"dashboardServiceIdentityHash":"spawnerServiceIdentityHash";const afterBody={...before,[changedKey]:sha256(authorization.service+String(globalThis.__p4SequenceCalls))};delete afterBody.projectionHash;const after=Object.freeze({...afterBody,projectionHash:sha256(canonical(afterBody))});globalThis.__p4RuntimeProjection=after;const body={schema:"setfarm.internal-production-baseline-service-restart-authority.v1",service:authorization.service,actionId:actions[authorization.service],operationId:sha256(authorization.authorizationHash),migrationReceiptRef:migrationReceipt.migrationReceiptRef,migrationReceiptHash:migrationReceipt.migrationReceiptHash,migrationSchemaProjectionHash:migrationReceipt.schemaProjectionHash,before,after,postRuntimeSourceProjectionHash:after.projectionHash,restart:{disposition:"performed",reservationHash:${JSON.stringify("1".repeat(64))},operationHash:${JSON.stringify("2".repeat(64))},outboxHash:${JSON.stringify("3".repeat(64))},helperClaimHash:${JSON.stringify("4".repeat(64))},helperProcessIdentityHash:${JSON.stringify("5".repeat(64))},startupMarkerHash:${JSON.stringify("6".repeat(64))},completionSettlementHash:${JSON.stringify("7".repeat(64))},beforeGenerationHash:${JSON.stringify("8".repeat(64))},afterGenerationHash:${JSON.stringify("9".repeat(64))},beforeServiceAuthorityHash:${JSON.stringify("a".repeat(64))},afterServiceAuthorityHash:${JSON.stringify("b".repeat(64))},dispatchReceiptHash:${JSON.stringify("c".repeat(64))}},guardKind:"complete-zero-owner",zeroOwnerGuardRef:${JSON.stringify(refFor("complete-zero-owner-observation", "d".repeat(64)))},zeroOwnerGuardHash:${JSON.stringify("d".repeat(64))},cleanup:{guardConsumed:true,restartSettled:true,observedGlobalZero:true,completeZeroOwnerCensusHash:${JSON.stringify(zeroHash)}}};const receiptHash=sha256(canonical(body));const receiptRef=\`setfarm://internal-production/baseline/service-restarts/\${receiptHash}\`;const authority=Object.freeze({...body,receiptRef,receiptHash});authorities.set(receiptHash,authority);return Object.freeze({receiptRef,receiptHash})}
export async function resolveInternalProductionBaselineServiceRestartAuthorityV1(input){const value=authorities.get(input.receiptHash);if(!value||value.receiptRef!==input.receiptRef)throw new Error("crossed fixture service restart authority");return value}
`.replace("export async function prepareInternalProductionBaselineServiceRestartV1(input){", "export async function prepareInternalProductionBaselineServiceRestartV1(input){globalThis.__p4PrepareCalls=(globalThis.__p4PrepareCalls??0)+1;if(globalThis.__p4RaceBarrier)await new Promise((resolve)=>setTimeout(resolve,75));if(globalThis.__p4SequenceLeaseHeld)throw new Error('nested transition lease');").replace("export async function restartInternalProductionBaselineServiceV1(input){", "export async function restartInternalProductionBaselineServiceV1(input){if(globalThis.__p4SequenceLeaseHeld)throw new Error('nested transition lease');"));
      writeFileSync(path.join(internal, "baseline-restart-authority-retirement-v1.ts"), `
import {createHash} from "node:crypto";
import {mkdirSync,readFileSync,writeFileSync} from "node:fs";
import path from "node:path";
const canonical=(value)=>value===null||typeof value!=="object"?JSON.stringify(value):Array.isArray(value)?\`[\${value.map(canonical).join(",")}]\`:\`{\${Object.keys(value).sort().map((key)=>\`\${JSON.stringify(key)}:\${canonical(value[key])}\`).join(",")}}\`;
const sha256=(value)=>createHash("sha256").update(value).digest("hex");
export async function acquireInternalProductionPhysicalServiceRestartAuthorityTransitionLeaseV1(){while(globalThis.__p4SequenceLeaseHeld)await new Promise((resolve)=>setTimeout(resolve,5));globalThis.__p4SequenceLeaseHeld=true;globalThis.__p4SequenceLeaseAcquires=(globalThis.__p4SequenceLeaseAcquires??0)+1;return Object.freeze({schema:"fixture-lease"})}
export async function releaseInternalProductionPhysicalServiceRestartAuthorityTransitionLeaseV1(_lease){if(!globalThis.__p4SequenceLeaseHeld)throw new Error("lease not held");globalThis.__p4SequenceLeaseHeld=false;globalThis.__p4SequenceLeaseReleases=(globalThis.__p4SequenceLeaseReleases??0)+1;if(globalThis.__p4ReleaseFail){globalThis.__p4ReleaseFail=false;throw new Error("P4_SEQUENCE_RELEASE_FAILURE")}}
export async function observeInternalProductionPhysicalServiceRestartAuthorityCutoverStatusV1(){return Object.freeze({state:globalThis.__p4CutoverState??"baseline-a-active",operation:null,cutover:null})}
export async function invokeInternalProductionBaselineServiceRestartHelperUnderTransitionLeaseV1(_lease,input){
  throw new Error("sequence must not invoke the physical helper directly");
  /* legacy fixture path intentionally unreachable
  globalThis.__p4SequenceCalls=(globalThis.__p4SequenceCalls??0)+1;
  const hash=input.restartOperation.operationHash;
  const root=path.resolve(import.meta.dirname,"../..");
  const operation=JSON.parse(readFileSync(path.join(root,"data/internal-production-baseline/baseline-service-restart-sequence-v1/operations/sha256",hash.slice(0,2),\`\${hash}.json\`),"utf8"));
  globalThis.__p4SequenceActions=[...(globalThis.__p4SequenceActions??[]),operation.actionId];
  if(globalThis.__p4SequenceFailAt===globalThis.__p4SequenceCalls&&!globalThis.__p4SequenceFailed){globalThis.__p4SequenceFailed=true;throw new Error("HELPER_DISPATCH_SETTLEMENT_UNKNOWN")}
  const settlementBody={schema:"setfarm.internal-production-baseline-service-restart-helper-settlement.v1",action:operation.actionId,restartOperation:input.restartOperation,journalHash:${JSON.stringify("e".repeat(64))},transitionLock:{schema:"fixture-lock"},lockIdentity:{devDecimal:"1",inoDecimal:"2"},dispatchCount:1,disposition:"completed"};
  const helperSettlementHash=sha256(canonical(settlementBody));
  const helperSettlementRef=\`setfarm://internal-production/baseline-service-restart-helper-settlement/sha256/\${helperSettlementHash}\`;
  const settlementDirectory=path.join(root,"data/internal-production-baseline/restart-authority-retirement-v1/baseline-helper-settlements/sha256",helperSettlementHash.slice(0,2));
  mkdirSync(settlementDirectory,{recursive:true,mode:0o700});
  writeFileSync(path.join(settlementDirectory,\`\${helperSettlementHash}.json\`),canonical({...settlementBody,helperSettlementRef,helperSettlementHash})+String.fromCharCode(10),{mode:0o600});
  return Object.freeze({helperSettlementRef,helperSettlementHash}); */
}
`);
      Object.assign(globalThis, { __p4SequenceCalls: 0, __p4PrepareCalls: 0, __p4SequenceActions: [], __p4SequenceFailAt: failAt, __p4SequenceFailed: false, __p4TerminalObservations: 0, __p4SourceObservations: 0, __p4CompleteZeroResolutions: 0 });
      const intentKind = failAt === 1 ? "d-startup-hook-load" : "live-rebind";
      if (failAt === 1) {
        const receiptSourcePath = path.join(internal, "baseline-post-handoff-receipt-v1.ts");
        const receiptSource = readFileSync(receiptSourcePath, "utf8");
        const missingReceiptSource = receiptSource.replace("export async function restartInternalProductionBaselineServiceV1", "async function restartInternalProductionBaselineServiceV1");
        assert.notEqual(missingReceiptSource, receiptSource, "missing-port fixture removes only the exact canonical Task12 restart export");
        writeFileSync(path.join(internal, "baseline-post-handoff-receipt-missing-normal-v1.ts"), missingReceiptSource);
        const missingSequenceSource = source.replaceAll("./baseline-post-handoff-receipt-v1.js", "./baseline-post-handoff-receipt-missing-normal-v1.js");
        const missingSequencePath = path.join(internal, "baseline-service-restart-sequence-missing-normal-v1.ts");
        writeFileSync(missingSequencePath, missingSequenceSource);
        const missingPortModule = await import(`${pathToFileURL(missingSequencePath).href}?missing-normal=${Date.now()}`);
        await assert.rejects(missingPortModule.resumeInternalProductionBaselineRestartSequenceV1({ intentKind: "live-rebind" }), /normal baseline restart composite authority is unavailable:restart/);
        assert.equal(existsSync(path.join(fixture, "data/internal-production-baseline/baseline-service-restart-sequence-v1")), false, "missing future Task12 port must refuse before the first sequence byte");

        const childIntentHash = sha256(canonical({ schema: "setfarm.internal-production-baseline-restart-sequence-intent.v1", intentKind }));
        const childIntentDirectory = path.join(fixture, "data/internal-production-baseline/baseline-service-restart-sequence-v1/intents", childIntentHash);
        mkdirSync(childIntentDirectory, { recursive: true, mode: 0o700 });
        const childLock = path.join(childIntentDirectory, "00-ordinal-transition.lock");
        const childTemporary = path.join(childIntentDirectory, `.00-ordinal-transition.lock.${"b".repeat(32)}.tmp`);
        const childStaleBody = { schema: "setfarm.internal-production-baseline-restart-sequence-ordinal-transition-lock.v1", intentKind, ordinal: 0, pid: 99_999, processIdentityHash: "e".repeat(64), nonce: "f".repeat(64) };
        writeFileSync(childTemporary, `${canonical(childStaleBody)}\n`, { mode: 0o600 }); linkSync(childTemporary, childLock);
        const childScript = `globalThis.__p4SequenceCalls=0;globalThis.__p4PrepareCalls=0;globalThis.__p4SequenceFailAt=1;globalThis.__p4SequenceFailed=false;const module=await import(${JSON.stringify(`${pathToFileURL(modulePath).href}?fresh-lock-process=${Date.now()}`)});try{await module.resumeInternalProductionBaselineRestartSequenceV1({intentKind:${JSON.stringify(intentKind)}});throw new Error("expected settlement uncertainty")}catch(error){if(!(error instanceof Error)||!error.message.includes("HELPER_DISPATCH_SETTLEMENT_UNKNOWN"))throw error}`;
        const child = spawnSync(process.execPath, ["--import", import.meta.resolve("tsx"), "--input-type=module", "--eval", childScript], { cwd: fixture, env: { PATH: process.env.PATH ?? "/usr/bin:/bin", LANG: "C", LC_ALL: "C" }, encoding: "utf8", timeout: 20_000, maxBuffer: 1_048_576, shell: false });
        assert.equal(child.status, 0, `fresh process must recover the exact post-link lock crash: ${child.stderr}`);
        assert.equal(existsSync(childLock), false, "fresh-process recovery releases its replacement ordinal lock");
        assert.equal(existsSync(childTemporary), false, "fresh-process recovery removes the exact linked crash temporary");
        rmSync(path.join(fixture, "data/internal-production-baseline/baseline-service-restart-sequence-v1"), { recursive: true, force: true });
      }
      const fixtureModule = await import(`${pathToFileURL(modulePath).href}?prefix=${failAt}-${Date.now()}`);
      (globalThis as Record<string, unknown>).__p4CutoverState = "pending-input";
      await assert.rejects(fixtureModule.resumeInternalProductionBaselineRestartSequenceV1({ intentKind }), /BASELINE_RESTART_AUTHORITY_RETIRED/, "a visible cutover pending input must win before sequence intent bytes");
      assert.equal(existsSync(path.join(fixture, "data/internal-production-baseline/baseline-service-restart-sequence-v1")), false, "cutover-wins leaves zero sequence bytes");
      assert.equal((globalThis as Record<string, unknown>).__p4SequenceCalls, 0, "cutover-wins calls no Task12 restart port");
      assert.equal((globalThis as Record<string, unknown>).__p4SequenceLeaseHeld, false, "cutover-wins releases the transition lease");
      Reflect.deleteProperty(globalThis, "__p4CutoverState");
      if (failAt === 1) {
        (globalThis as Record<string, unknown>).__p4ReleaseFail = true;
        await assert.rejects(fixtureModule.resumeInternalProductionBaselineRestartSequenceV1({ intentKind }), /P4_SEQUENCE_RELEASE_FAILURE/, "release failure must surface after durable header birth");
        const releaseFailureIntentHash = sha256(canonical({ schema: "setfarm.internal-production-baseline-restart-sequence-intent.v1", intentKind }));
        const releaseFailureHeader = path.join(fixture, "data/internal-production-baseline/baseline-service-restart-sequence-v1/intents", releaseFailureIntentHash, "sequence-intent.pair.json");
        assert.equal(existsSync(releaseFailureHeader), true, "release failure occurs only after the exact intent header is durable and visible");
        assert.equal((globalThis as Record<string, unknown>).__p4PrepareCalls, 0, "release failure must not call Task12 prepare");
        assert.equal((globalThis as Record<string, unknown>).__p4SequenceCalls, 0, "release failure calls neither Task12 prepare nor restart");
        assert.equal((globalThis as Record<string, unknown>).__p4SequenceLeaseHeld, false);
        const driftedBody = { schema: "setfarm.internal-production-baseline-runtime-source-projection.v1", setfarmSha: migrationSourceSha, missionControlSha: "e".repeat(40), setfarmBuildInfoHash: "4".repeat(64), spawnerBuildHash: "4".repeat(64), spawnerServiceIdentityHash: "8".repeat(64), dashboardBuildHash: "4".repeat(64), dashboardServiceIdentityHash: "9".repeat(64), missionControlBuildHash: "5".repeat(64), missionControlServiceIdentityHash: "a".repeat(64) };
        (globalThis as Record<string, unknown>).__p4RuntimeProjection = Object.freeze({ ...driftedBody, projectionHash: sha256(canonical(driftedBody)) });
        await assert.rejects(fixtureModule.resumeInternalProductionBaselineRestartSequenceV1({ intentKind }), /reviewed D.*not loaded/i, "D startup-hook load must refuse a loaded Mission Control source different from the reviewed handoff");
        assert.equal((globalThis as Record<string, unknown>).__p4SequenceCalls, 0, "reviewed-D source drift must precede restart authorization/dispatch");
        Reflect.deleteProperty(globalThis, "__p4RuntimeProjection");

        const liveLockModulePath = path.join(internal, "baseline-service-restart-sequence-live-temp-v1.ts");
        const shortWaitSource = crashableSource.replace("attempt < 1_000", "attempt < 3");
        assert.notEqual(shortWaitSource, crashableSource, "live-temp fixture only bounds the copied lock wait");
        writeFileSync(liveLockModulePath, shortWaitSource);
        const liveIntentHash = sha256(canonical({ schema: "setfarm.internal-production-baseline-restart-sequence-intent.v1", intentKind }));
        const liveIntentDirectory = path.join(fixture, "data/internal-production-baseline/baseline-service-restart-sequence-v1/intents", liveIntentHash);
        const liveTemporary = path.join(liveIntentDirectory, `.00-ordinal-transition.lock.${"d".repeat(32)}.tmp`);
        const sleeper = spawn(process.execPath, ["--eval", "setTimeout(()=>{},20000)"], { stdio: "ignore" });
        try {
          const ps = spawnSync("/bin/ps", ["-p", String(sleeper.pid), "-o", "lstart=,command="], { env: { PATH: "/usr/bin:/bin", LANG: "C", LC_ALL: "C" }, encoding: "utf8", shell: false });
          assert.equal(ps.status, 0, ps.stderr);
          const liveIdentityHash = sha256(canonical({ schema: "setfarm.internal-production-baseline-restart-sequence-lock-process-identity.v1", pid: sleeper.pid, psIdentity: ps.stdout.trim() }));
          const liveBody = { schema: "setfarm.internal-production-baseline-restart-sequence-ordinal-transition-lock.v1", intentKind, ordinal: 0, pid: sleeper.pid, processIdentityHash: liveIdentityHash, nonce: "9".repeat(64) };
          writeFileSync(liveTemporary, `${canonical(liveBody)}\n`, { mode: 0o600 });
          const liveLockModule = await import(`${pathToFileURL(liveLockModulePath).href}?live-temp=${Date.now()}`);
          await assert.rejects(liveLockModule.resumeInternalProductionBaselineRestartSequenceV1({ intentKind }), /ordinal transition lock is unavailable/, "a live publisher's temp-only lock is never promoted or reclaimed by another resumer");
          assert.equal(existsSync(path.join(liveIntentDirectory, "00-ordinal-transition.lock")), false, "live temp-only publication remains pre-visibility");
          assert.equal(existsSync(liveTemporary), true, "live publisher retains sole ownership of its temporary inode");
          assert.equal((globalThis as Record<string, unknown>).__p4PrepareCalls, 0, "live temp-only refusal precedes Task12 prepare");
        } finally {
          sleeper.kill("SIGTERM");
          await new Promise<void>((resolve) => sleeper.once("exit", () => resolve()));
          rmSync(liveTemporary, { force: true });
        }
      }
      const ordinalIntentHash = sha256(canonical({ schema: "setfarm.internal-production-baseline-restart-sequence-intent.v1", intentKind }));
      const ordinalDirectory = path.join(fixture, "data/internal-production-baseline/baseline-service-restart-sequence-v1/intents", ordinalIntentHash);
      mkdirSync(ordinalDirectory, { recursive: true, mode: 0o700 });
      const staleLock = path.join(ordinalDirectory, "00-ordinal-transition.lock");
      const staleTemporary = path.join(ordinalDirectory, `.00-ordinal-transition.lock.${"c".repeat(32)}.tmp`);
      const staleBody = { schema: "setfarm.internal-production-baseline-restart-sequence-ordinal-transition-lock.v1", intentKind, ordinal: 0, pid: 99_999, processIdentityHash: "e".repeat(64), nonce: "f".repeat(64) };
      const staleBytes = `${canonical(staleBody)}\n`;
      if (failAt === 1) {
        writeFileSync(staleTemporary, staleBytes, { mode: 0o600 }); linkSync(staleTemporary, staleLock);
        assert.equal(existsSync(staleLock), true, "post-link/pre-unlink crash leaves the fixed lock visible");
        assert.equal(existsSync(staleTemporary), true, "post-link/pre-unlink crash retains the second hard link");
      } else if (failAt === 2) {
        writeFileSync(staleTemporary, staleBytes, { mode: 0o600 });
        assert.equal(existsSync(staleLock), false, "temp-only crash precedes fixed lock visibility");
      } else {
        writeFileSync(staleLock, staleBytes, { mode: 0o600 });
        writeFileSync(staleTemporary, `${canonical({ ...staleBody, nonce: "a".repeat(64) })}\n`, { mode: 0o600 });
        assert.notEqual(readFileSync(staleLock).toString("utf8"), readFileSync(staleTemporary).toString("utf8"), "EEXIST crash fixture retains a distinct losing inode/body");
      }
      if (failAt === 1) {
        (globalThis as Record<string, unknown>).__p4RaceBarrier = true;
        (globalThis as Record<string, unknown>).__p4LockPublishBarrier = true;
        const raced = await Promise.allSettled([fixtureModule.resumeInternalProductionBaselineRestartSequenceV1({ intentKind }), fixtureModule.resumeInternalProductionBaselineRestartSequenceV1({ intentKind })]);
        assert.equal(raced.every((result) => result.status === "rejected" && result.reason instanceof Error && /HELPER_DISPATCH_SETTLEMENT_UNKNOWN/.test(result.reason.message)), true, raced.map((result) => result.status === "rejected" ? String(result.reason) : "fulfilled").join(" | "));
        assert.equal((globalThis as Record<string, unknown>).__p4PrepareCalls, 1, "two ordinal resumptions prepare exactly one authorization");
        assert.equal((globalThis as Record<string, unknown>).__p4SequenceCalls, 1, "two ordinal resumptions physically invoke the restart exactly once");
        assert.equal(Number((globalThis as Record<string, unknown>).__p4LiveLockWaits) >= 1, true, "the losing resumer observes the winner's live temp-only publication and waits without promoting it");
        Reflect.deleteProperty(globalThis, "__p4RaceBarrier");
        Reflect.deleteProperty(globalThis, "__p4LockPublishBarrier");
      } else await assert.rejects(fixtureModule.resumeInternalProductionBaselineRestartSequenceV1({ intentKind }), /HELPER_DISPATCH_SETTLEMENT_UNKNOWN/);
      assert.equal(Number((globalThis as Record<string, unknown>).__p4SequenceLeaseAcquires), Number((globalThis as Record<string, unknown>).__p4SequenceLeaseReleases), "every sequence lock attempt completes release before Task12 work");
      assert.equal((globalThis as Record<string, unknown>).__p4SequenceLeaseHeld, false, "Task12 restart work runs only after the sequence lease is released");
      const intentHash = sha256(canonical({ schema: "setfarm.internal-production-baseline-restart-sequence-intent.v1", intentKind }));
      const headerLocator = path.join(fixture, "data/internal-production-baseline/baseline-service-restart-sequence-v1/intents", intentHash, "sequence-intent.pair.json");
      assert.equal(existsSync(headerLocator), true, "sequence-wins makes its fixed header visible before Task12 restart work");
      const storedHeaderPair = JSON.parse(readFileSync(headerLocator, "utf8"));
      const storedHeader = JSON.parse(readFileSync(path.join(fixture, "data/internal-production-baseline/baseline-service-restart-sequence-v1/sequence-intents/sha256", storedHeaderPair.sequenceIntentHash.slice(0, 2), `${storedHeaderPair.sequenceIntentHash}.json`), "utf8"));
      assert.deepEqual(storedHeader.orderedServiceActions, [{ service: "setfarm-spawner", actionId: "a-restart-service-setfarm-spawner-v1" }, { service: "setfarm-dashboard", actionId: "a-restart-service-setfarm-dashboard-v1" }, { service: "mission-control", actionId: "a-restart-service-mission-control-v1" }]);
      const interrupted = await fixtureModule.observeInternalProductionBaselineRestartSequenceStatusV1({ intentKind });
      assert.equal(interrupted.state, "blocked");
      assert.equal(interrupted.activeOrdinal, failAt - 1);
      assert.equal(interrupted.refusalCode, null);
      const dispatchCountAtUnknown = (globalThis as Record<string, unknown>).__p4SequenceCalls;
      await assert.rejects(fixtureModule.resumeInternalProductionBaselineRestartSequenceV1({ intentKind }), /HELPER_DISPATCH_SETTLEMENT_UNKNOWN/, "durable journal without settlement must remain blocked");
      assert.equal((globalThis as Record<string, unknown>).__p4SequenceCalls, dispatchCountAtUnknown, "unknown settlement replay must not physically redispatch");
      (globalThis as Record<string, unknown>).__p4SettleUnknown = true;
      let completingModule = fixtureModule;
      if (failAt === 1) {
        (globalThis as Record<string, unknown>).__p4CrashAfterComposite = true;
        await assert.rejects(fixtureModule.resumeInternalProductionBaselineRestartSequenceV1({ intentKind }), /P4_AFTER_COMPOSITE_CRASH/, "a crash after the durable composite locator precedes advance publication");
        const compositeLocator = path.join(fixture, "data/internal-production-baseline/baseline-service-restart-sequence-v1/intents", intentHash, "00-service-operation.pair.json");
        const advanceLocator = path.join(fixture, "data/internal-production-baseline/baseline-service-restart-sequence-v1/intents", intentHash, "00-service-advance.pair.json");
        assert.equal(existsSync(compositeLocator), true, "the composite pair is durable at the crash boundary");
        assert.equal(existsSync(advanceLocator), false, "the advance is absent at the crash boundary");
        completingModule = await import(`${pathToFileURL(modulePath).href}?post-composite-reentry=${Date.now()}`);
      }
      const pair = await completingModule.resumeInternalProductionBaselineRestartSequenceV1({ intentKind });
      const receipt = await fixtureModule.resolveInternalProductionBaselineRestartSequenceReceiptV1(pair);
      assert.equal(Number((globalThis as Record<string, unknown>).__p4CompleteZeroResolutions) >= 1, true, "receipt resolution must reopen the exact final complete-zero observation");
      assert.equal(Number((globalThis as Record<string, unknown>).__p4TerminalObservations) >= 4, true, "status, mutation, and receipt resolution must freshly reopen terminal migration authority");
      assert.notEqual(receipt.initialRuntimeSourceProjectionHash, receipt.finalRuntimeSourceProjectionHash);
      assert.deepEqual(receipt.orderedServices, ["setfarm-spawner", "setfarm-dashboard", "mission-control"]);
      assert.deepEqual(receipt.authorityPairs.map((entry: { actionId: string }) => entry.actionId), [
        "a-restart-service-setfarm-spawner-v1",
        "a-restart-service-setfarm-dashboard-v1",
        "a-restart-service-mission-control-v1",
      ]);
      assert.equal(Object.isFrozen(receipt), true);
      assert.equal((globalThis as Record<string, unknown>).__p4SequenceCalls, 3, "settlement adoption reaches completion with exactly one physical dispatch per ordinal");
      if (failAt === 1) assert.equal(((globalThis as Record<string, unknown>).__p4SequenceActions as string[]).filter((action) => action === "a-restart-service-setfarm-spawner-v1").length, 1, "durable composite recovery never repeats the first physical restart");
      const callsAfterCompletion = (globalThis as Record<string, unknown>).__p4SequenceCalls;
      assert.deepEqual(await fixtureModule.resumeInternalProductionBaselineRestartSequenceV1({ intentKind }), pair);
      assert.equal((globalThis as Record<string, unknown>).__p4SequenceCalls, callsAfterCompletion, "completed replay must not dispatch");
    } finally {
      delete (globalThis as Record<string, unknown>).__p4SequenceCalls;
      delete (globalThis as Record<string, unknown>).__p4PrepareCalls;
      delete (globalThis as Record<string, unknown>).__p4RaceBarrier;
      delete (globalThis as Record<string, unknown>).__p4SequenceActions;
      delete (globalThis as Record<string, unknown>).__p4SequenceFailAt;
      delete (globalThis as Record<string, unknown>).__p4SequenceFailed;
      delete (globalThis as Record<string, unknown>).__p4SettleUnknown;
      delete (globalThis as Record<string, unknown>).__p4TerminalObservations;
      delete (globalThis as Record<string, unknown>).__p4SourceObservations;
      delete (globalThis as Record<string, unknown>).__p4CompleteZeroResolutions;
      delete (globalThis as Record<string, unknown>).__p4BuildHash;
      delete (globalThis as Record<string, unknown>).__p4RuntimeProjection;
      delete (globalThis as Record<string, unknown>).__p4CutoverState;
      delete (globalThis as Record<string, unknown>).__p4SequenceLeaseHeld;
      delete (globalThis as Record<string, unknown>).__p4SequenceLeaseAcquires;
      delete (globalThis as Record<string, unknown>).__p4SequenceLeaseReleases;
      delete (globalThis as Record<string, unknown>).__p4ReleaseFail;
      delete (globalThis as Record<string, unknown>).__p4CrashAfterComposite;
      delete (globalThis as Record<string, unknown>).__p4CompositeCrashed;
      delete (globalThis as Record<string, unknown>).__p4LockPublishBarrier;
      delete (globalThis as Record<string, unknown>).__p4LockPublisherPaused;
      delete (globalThis as Record<string, unknown>).__p4LiveLockWaits;
      rmSync(fixture, { recursive: true, force: true });
    }
  }
});
