import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { describe, it } from "node:test";
import type postgres from "postgres";

import { createAttemptRepository } from "../../src/execution/attempt-repository.js";
import {
  insertAndBindInternalProductionClaimBirthV1,
  prepareInternalProductionClaimBirthV1,
} from "../../src/execution/claim-runtime-publication.js";
import {
  closeClaimAndBoundAttempt,
  closeClaimAndBoundAttemptInTransaction,
  closeExactSingleStepClaimInTransaction,
  completeSingleStepClaimAndState,
  completeStoryClaimAndBoundAttempt,
} from "../../src/execution/claim-attempt-transition.js";
import {
  acquireOrphanClaimRecoveryAuthorityInTransaction,
} from "../../src/execution/claim-recovery-authority.js";
import {
  createRuntimeCompletionRepository,
  isRuntimeCompletionRecoveryOwnerInstanceIdV1,
  markRuntimeCompletionOwnerCommittedInTransaction,
  quarantineExpiredRuntimeCompletionForRecoveryInTransaction,
  rejectRuntimeCompletionsForTerminalRunInTransaction,
  requestRuntimeCompletion,
  RuntimeCompletionSubmissionEvidenceV1Schema,
  terminalizeRuntimeCompletionForRunInTransactionV1,
} from "../../src/execution/runtime-completion.js";
import { createRuntimeCompletionEffectRepository } from "../../src/execution/runtime-completion-effect-repository.js";
import { runWithRuntimeCompletionOwner } from "../../src/execution/runtime-completion-owner-context.js";
import {
  createRuntimeSessionRepository,
} from "../../src/execution/runtime-session-repository.js";
import {
  createRunTerminationRepository,
  requestRunTermination,
  requestRunTerminationInTransaction,
} from "../../src/execution/run-termination.js";
import {
  transitionRunToTerminal,
  transitionRunToTerminalInTransaction,
} from "../../src/execution/run-terminal-transition.js";
import type { ClaimEnvelopeV1 } from "../../src/execution/schemas/claim-envelope-v1.js";
import { createSingleEffectCompletionPlanDescriptorV1 } from "../../src/execution/schemas/runtime-completion-plan-v1.js";
import {
  createInternalProductionCompletionOwnerCanonicalOwnerIdentityV1,
  createInternalProductionMandatoryEffectCanonicalOwnerIdentityV1,
} from "../../src/internal-production/owner-admission-v1.js";
import { exactProductReservation } from "./fixtures.js";
import { createIsolatedTestDatabase } from "./test-database.js";
import {
  beginOrAdoptInternalProductionOwnerReservationV1,
  bindInternalProductionOwnerReservationV1,
  createInternalProductionWorkflowRunCanonicalOwnerIdentityV1,
  type PgTransactionSql,
} from "../../src/db-pg.js";

const DRAIN_EVIDENCE = {
  schema: "setfarm.runtime-drain-evidence.v1" as const,
  observedAt: "2026-07-13T12:00:00.000Z",
  localProcessAbsent: true,
  openClawTaskAbsent: true,
  workspaceProcessAbsent: true,
  stableObservations: 2,
  evidenceRefs: ["setfarm://test/completion-drain-proof"],
};

it("P4 completion owner mints bootstrap target guard only in current context", async () => {
  const completion = await import("../../src/execution/runtime-completion.js");
  const required = [
    ["prepareInternalProductionBaselineCompletionOwnerBootstrapTargetGuardV1", 0],
    ["authenticateInternalProductionBaselineCompletionOwnerBootstrapTargetGuardV1", 1],
    ["resolveInternalProductionBaselineCompletionOwnerBootstrapTargetGuardReceiptV1", 1],
    ["consumeInternalProductionBaselineCompletionOwnerBootstrapTargetGuardForOperationV1", 1],
    ["resolveInternalProductionBaselineCompletionOwnerBootstrapTargetGuardConsumptionV1", 1],
    ["recoverAndReleaseInternalProductionBaselineCompletionOwnerBootstrapTargetV1", 1],
    ["observeInternalProductionBaselineCompletionOwnerBootstrapLifecycleV1", 1],
    ["completeInternalProductionBaselineCompletionOwnerBootstrapForSequenceV1", 1],
  ] as const;
  for (const [name, arity] of required) {
    const value = Reflect.get(completion, name);
    assert.equal(typeof value, "function", name);
    assert.equal((value as Function).length, arity, name);
  }
  await assert.rejects(
    (completion.prepareInternalProductionBaselineCompletionOwnerBootstrapTargetGuardV1 as () => Promise<unknown>)(),
    /CURRENT_CONTEXT|OWNER_CONTEXT|CAPABILITY/,
  );
  const source = readFileSync(new URL("../../src/execution/runtime-completion.ts", import.meta.url), "utf8");
  assert.match(source, /state:\s*"operation_bound"/, "request result must durably bind the operation before guard consumption");
  assert.match(source, /state:\s*"guard_consumed"/, "request result must durably record guard consumption after operation binding");
  assert.match(source, /FROM internal_production_owner_reservations_v1[\s\S]*FOR UPDATE/, "guard preparation must lock and authenticate the complete owner sidecar census");
  assert.match(source, /openOwnerRows\.length !== 1/, "the retained completion owner must be the sole open owner");
  assert.match(source, /unrelatedOwnerCount = openOwnerRows\.length - 1/, "the unrelated-owner count must come from the locked census");
  assert.match(source, /completionBootstrapConsumedPathV1\(String\(consumption\.targetGuardReceiptHash\)\)/, "consumption resolution must reopen the shared consumed-guard index");
  assert.doesNotMatch(source, /path\.resolve\(process\.cwd\(\), "data\/internal-production-baseline\/completion-owner-bootstrap-target-guard-v1"\)/, "guard authority root must not depend on ambient cwd");
  assert.match(source, /function authenticateCompletionBootstrapPrivateDirectoryChainV1\(/, "the authority store must pin its complete directory chain");
  assert.match(source, /function completionBootstrapRecoverNoReplacePublicationV1\(/, "guard publication adopts the exact temp-only or linked-temp crash prefix");
  assert.match(source, /function completionBootstrapHasExactStoredKeysV1\(/, "filesystem and JSONB authorities validate exact key sets independently of canonical wire order");
  assert.match(source, /index > 0[\s\S]*0o700n/, "the repository root is an anchor while every authority descendant is private");
  assert.match(source, /observed\.dev !== held\[0\]!\.dev/, "every authority descendant must stay on the repository device");
  assert.match(source, /parentGuard\.assertStable\(\)[\s\S]*mkdirSync\(current, \{ mode: 0o700 \}\)[\s\S]*parentGuard\.assertStable\(\)/, "directory creation must occur under a pinned stable parent");
  assert.match(source, /setfarm\.internal-production-baseline-completion-owner-bootstrap-lifecycle-observation\.v1/);
  assert.match(source, /"guard_consumed" \| "owner_recovered" \| "owner_released" \| "completed"/);
  assert.match(source, /targetGuardReceiptRef[\s\S]*targetGuardReceiptHash[\s\S]*operationRef[\s\S]*operationHash[\s\S]*targetGuardConsumptionRef[\s\S]*targetGuardConsumptionHash[\s\S]*startupAdmissionRef[\s\S]*startupAdmissionHash[\s\S]*startupClaimHash[\s\S]*restartAuthorityRef[\s\S]*restartAuthorityHash[\s\S]*recoveredOwnerGenerationHash[\s\S]*targetOwnerReleaseReceiptHash[\s\S]*sequenceRef[\s\S]*sequenceHash[\s\S]*observationHash/);
  assert.match(source, /requestIdHash !== hashCanonicalJson\([\s\S]*row\.request_id/, "lifecycle recovery authenticates the raw request identifier against the durable guard");
  assert.match(source, /claimIdHash !== hashCanonicalJson\([\s\S]*row\.claim_id/, "lifecycle recovery authenticates the claim identifier against the durable guard");
  assert.match(source, /runIdentityHash !== hashCanonicalJson\([\s\S]*row\.run_id/, "lifecycle recovery authenticates the run identifier against the durable guard");
  assert.match(source, /FROM runtime_sessions[\s\S]*state='released'/, "owner-release adoption freshly reopens the released runtime session");
  assert.match(source, /FROM internal_production_owner_reservations_v1[\s\S]*state='closed'/, "owner-release adoption freshly proves the target owner is closed");
  assert.match(source, /if \(!capability\)[\s\S]*completionBootstrapFindRequestV1[\s\S]*state !== "guard_consumed"[\s\S]*completionBootstrapConsumedPathV1/, "replacement adoption repairs only a durable content-plus-DB consumption prefix without reminting or reconsuming");
  assert.match(source, /state='drained'[\s\S]*producer_implementation_id='a-completion-owner-v1'[\s\S]*state='bound'/, "lifecycle context freshly proves the drained session and exact still-bound completion owner before recovery CAS");
  assert.match(source, /context\.result\.state !== "owner_released"\) completionBootstrapFailV1\("owner release terminal state"\)/, "the recovery port exposes only its owner-released terminal, never the later completed state");
  assert.doesNotMatch(source, /context\.result\.state !== "owner_released" && context\.result\.state !== "completed"/, "completed adoption belongs to the observer/finalizer, not the recovery mutation port");
});

it("P4 completion bootstrap clean-build selection is opaque and owner-bound", async () => {
  const completion = await import("../../src/execution/runtime-completion.js");
  assert.equal(typeof completion.createInternalProductionBaselineCompletionOwnerBootstrapCleanBuildVerificationV1, "function");
  assert.equal(completion.createInternalProductionBaselineCompletionOwnerBootstrapCleanBuildVerificationV1.length, 0);
  assert.equal(typeof completion.continueInternalProductionBaselineCompletionOwnerBootstrapAfterCleanBuildV1, "function");
  assert.equal(completion.continueInternalProductionBaselineCompletionOwnerBootstrapAfterCleanBuildV1.length, 1);
  await assert.rejects(
    completion.createInternalProductionBaselineCompletionOwnerBootstrapCleanBuildVerificationV1(),
    /OWNER_CONTEXT_REQUIRED/,
  );
  await assert.rejects(
    completion.continueInternalProductionBaselineCompletionOwnerBootstrapAfterCleanBuildV1({ verification: Object.freeze({}) as never }),
    /CAPABILITY|VERIFICATION/,
  );
  const source = readFileSync(new URL("../../src/execution/runtime-completion.ts", import.meta.url), "utf8");
  assert.match(source, /setfarm\.internal-production-baseline-completion-owner-bootstrap-eligibility\.v1/);
  assert.match(source, /selected-eligibility\.json/);
  assert.match(source, /const completionBootstrapCleanBuildCapabilitiesV1 = new WeakMap<object,/);
});

it("P4 expired selected bootstrap preserves owner generation and phase-recovers under the transition lease", async () => {
  const completion = await import("../../src/execution/runtime-completion.js");
  const source = readFileSync(new URL("../../src/execution/runtime-completion.ts", import.meta.url), "utf8");
  const spawner = readFileSync(new URL("../../src/spawner.ts", import.meta.url), "utf8");
  assert.equal(typeof completion.recoverSelectedInternalProductionBaselineCompletionOwnerBootstrapV1, "function");
  assert.equal(completion.recoverSelectedInternalProductionBaselineCompletionOwnerBootstrapV1.length, 0);
  assert.match(source, /completionBootstrapSelectedEligibilityMatchesRowV1\(request\)[\s\S]*status: "bootstrap_selected"/);
  assert.match(source, /completionBootstrapSelectedRecoveryCandidatesV1\.set\(token[\s\S]*completionBootstrapPendingSelectedRecoveryTokenV1 = token/);
  assert.match(source, /acquireInternalProductionPhysicalServiceRestartAuthorityTransitionLeaseV1[\s\S]*completionBootstrapSelectedRecoveryContextV1\.run\(candidate[\s\S]*completionBootstrapPreflightSelectedRecoveryUnderLeaseV1\(candidate\)/);
  assert.match(source, /completionBootstrapRequireSelectedEligibilityMatchesReceiptAndRowV1\(row, receipt\)/);
  assert.doesNotMatch(source, /WHERE state='processing' AND apply_phase='effects_committed' ORDER BY request_id/);
  assert.doesNotMatch(source, /recoverSelectedBootstrapGeneration/);
  assert.match(source, /\["operation_bound", "guard_consumed", "owner_recovered"\][\s\S]*executeOrRecoverInternalProductionBaselineSpawnerBootstrapRestartV1/);
  assert.match(source, /prepareInternalProductionBaselineSpawnerBootstrapRestartFromDurableTargetGuardReceiptForRecoveryV1/);
  assert.match(source, /failure\.status === 1[\s\S]*state: "dead"[\s\S]*state: "ambiguous"/, "runtime locator locks retain ambiguous ps owners and reclaim only explicit no-PID owners");
  assert.match(spawner, /recovered\.status === "bootstrap_selected"[\s\S]*recoverSelectedInternalProductionBaselineCompletionOwnerBootstrapV1/);
});

it("P4 clean-build selection and selected recovery execute every durable phase with fake PG and FS", async () => {
  const production = readFileSync(new URL("../../src/execution/runtime-completion.ts", import.meta.url), "utf8");
  const take = (start: string, end: string): string => {
    const from = production.indexOf(start);
    const to = production.indexOf(end, from + start.length);
    assert.ok(from >= 0 && to > from, `${start} slice`);
    return production.slice(from, to);
  };
  const fixture = mkdtempSync(path.join(tmpdir(), "setfarm-p4-completion-bootstrap-kernel-"));
  try {
    const execution = path.join(fixture, "src/execution");
    const internal = path.join(fixture, "src/internal-production");
    mkdirSync(execution, { recursive: true });
    mkdirSync(internal, { recursive: true });
    writeFileSync(path.join(internal, "baseline-post-handoff-receipt-v1.ts"), `
const g=globalThis;
export async function observeCurrentInternalProductionBaselineTask12P0DeliveryAuthorityV1(){return g.__p4Delivery}
export async function resolveInternalProductionBaselineTask12P0DeliveryAuthorityV1(input){if(input.deliveryAuthorityRef!==g.__p4Delivery.deliveryAuthorityRef||input.deliveryAuthorityHash!==g.__p4Delivery.deliveryAuthorityHash)throw new Error("crossed delivery");return g.__p4Delivery}
export async function observeInternalProductionCurrentEntryAuthorityStatusV1(){return g.__p4CurrentEntry}
export async function resolveInternalProductionCurrentEntryAuthorityV1(input){if(input.entryAuthorityRef!==g.__p4Entry.entryAuthorityRef||input.entryAuthorityHash!==g.__p4Entry.entryAuthorityHash)throw new Error("crossed entry");return g.__p4Entry}
export async function resolveInternalProductionBaselineBootstrapHandoffMigrationReceiptV1(input){if(input.migrationReceiptRef!==g.__p4Migration.migrationReceiptRef||input.migrationReceiptHash!==g.__p4Migration.migrationReceiptHash)throw new Error("crossed migration");return g.__p4Migration}
`);
    writeFileSync(path.join(internal, "baseline-restart-authority-retirement-v1.ts"), `
const g=globalThis;
export async function acquireInternalProductionPhysicalServiceRestartAuthorityTransitionLeaseV1(){g.__p4Counts.acquire+=1;return Object.freeze({lease:true})}
export async function releaseInternalProductionPhysicalServiceRestartAuthorityTransitionLeaseV1(_lease){g.__p4Counts.release+=1}
`);
    writeFileSync(path.join(internal, "baseline-service-restart-sequence-v1.ts"), `
const g=globalThis;
const operation=()=>Object.freeze({operationRef:"setfarm://internal-production/baseline-spawner-bootstrap-restart-operation/sha256/"+"8".repeat(64),operationHash:"8".repeat(64)});
export async function prepareInternalProductionBaselineSpawnerBootstrapRestartV1(_input){g.__p4Counts.prepare+=1;return operation()}
export async function prepareInternalProductionBaselineSpawnerBootstrapRestartFromDurableTargetGuardReceiptForRecoveryV1(_input){g.__p4Counts.prepareRecovery+=1;return operation()}
export async function executeOrRecoverInternalProductionBaselineSpawnerBootstrapRestartV1(_input){g.__p4Counts.execute+=1;g.__p4Phase={...g.__p4Phase,state:"completed",recoveredOwnerGenerationHash:"9".repeat(64),targetOwnerReleaseReceiptHash:"a".repeat(64),sequenceRef:"setfarm://internal-production/baseline-spawner-bootstrap-restart-sequence/sha256/"+"b".repeat(64),sequenceHash:"b".repeat(64)}}
`);
    const verificationKernel = take("function completionBootstrapCleanBuildVerificationV1(", "async function completionBootstrapReopenEligibilityAuthoritiesV1(");
    const reopenKernel = take("async function completionBootstrapReopenEligibilityAuthoritiesV1(", "export async function createInternalProductionBaselineCompletionOwnerBootstrapCleanBuildVerificationV1(");
    const createKernel = take("export async function createInternalProductionBaselineCompletionOwnerBootstrapCleanBuildVerificationV1(", "function completionBootstrapValidateAnyStoredResultV1(");
    const resultValidatorKernel = take("function completionBootstrapValidateAnyStoredResultV1(", "async function completionBootstrapBindOperationForOwnerV1(");
    const phaseKernel = take("async function completionBootstrapCurrentSelectedPhaseForOwnerV1(", "export async function continueInternalProductionBaselineCompletionOwnerBootstrapAfterCleanBuildV1(");
    const identityKernel = take("function completionBootstrapSelectedEligibilityMatchesRowV1(", "export {\n  RuntimeCompletionSubmissionEvidenceV1Schema");
    const continueKernel = take("export async function continueInternalProductionBaselineCompletionOwnerBootstrapAfterCleanBuildV1(", "async function completionBootstrapPreflightSelectedRecoveryUnderLeaseV1(");
    const preflightKernel = take("async function completionBootstrapPreflightSelectedRecoveryUnderLeaseV1(", "export async function recoverSelectedInternalProductionBaselineCompletionOwnerBootstrapV1(");
    const recoveryKernel = take("export async function recoverSelectedInternalProductionBaselineCompletionOwnerBootstrapV1(", "export async function resolveInternalProductionBaselineCompletionOwnerBootstrapTargetGuardReceiptV1(");
    const recoverMethodStart = production.indexOf("    async recoverExpiredProcessing(");
    const recoverMethodEnd = production.indexOf("    async heartbeatProcessing(", recoverMethodStart);
    assert.ok(recoverMethodStart >= 0 && recoverMethodEnd > recoverMethodStart, "production recoverExpiredProcessing method slice");
    const recoverMethod = production.slice(recoverMethodStart, recoverMethodEnd).replace(/,\s*$/, "");
    const harnessPath = path.join(execution, "runtime-completion-kernel.ts");
    writeFileSync(harnessPath, `
import {createHash} from "node:crypto";
import {AsyncLocalStorage} from "node:async_hooks";
import fs from "node:fs";
import path from "node:path";
type RuntimeCompletionRow=any; type PgTransactionSql=any; type InternalProductionBaselineCompletionOwnerBootstrapEligibilityV1=any; type InternalProductionBaselineCompletionOwnerBootstrapCleanBuildVerificationV1=any; type InternalProductionBaselineCompletionOwnerBootstrapTargetGuardV1=any; type InternalProductionBaselineCompletionOwnerBootstrapTargetGuardReceiptV1=any; type CompletionBootstrapSelectedRecoveryCandidateV1=any;
const g=globalThis as any; const SHA=/^[a-f0-9]{64}$/; const SHA256_V1=SHA; const COMPLETION_BOOTSTRAP_ELIGIBILITY_PREFIX_V1="setfarm://internal-production/baseline-completion-owner-bootstrap-eligibility/sha256/";
const canonical=(v:any):string=>v===null||typeof v!=="object"?JSON.stringify(v):Array.isArray(v)?"["+v.map(canonical).join(",")+"]":"{"+Object.keys(v).sort().map(k=>JSON.stringify(k)+":"+canonical(v[k])).join(",")+"}";
const hashCanonicalJson=(v:any)=>createHash("sha256").update(canonical(v)).digest("hex");
const recursivelyFreezeCompletionBootstrapV1=(v:any):any=>{if(v&&typeof v==="object"&&!Object.isFrozen(v)){for(const m of Object.values(v))recursivelyFreezeCompletionBootstrapV1(m);Object.freeze(v)}return v};
const completionBootstrapFailV1=(m:string):never=>{throw new Error("P4_BOOTSTRAP:"+m)};
const completionBootstrapHasExactStoredKeysV1=(value:Record<string,unknown>,keys:readonly string[])=>Object.keys(value).length===keys.length&&keys.every((key)=>Object.prototype.hasOwnProperty.call(value,key));
const completionBootstrapCleanBuildCapabilitiesV1=new WeakMap<object,any>(); const completionBootstrapSelectedRecoveryCandidatesV1=new WeakMap<object,any>(); let completionBootstrapPendingSelectedRecoveryTokenV1:object|null=null; const completionBootstrapSelectedRecoveryContextV1=new AsyncLocalStorage<any>();
const currentRuntimeCompletionOwnerCapability=()=>g.__p4Owner??null; const readDatabaseWallClock=async()=>new Date("2026-08-26T12:00:00.000Z"); const timestamp=(v:any)=>new Date(v).toISOString(); const validTime=()=>undefined;
const pgBegin=async(cb:any)=>cb({unsafe:async(q:string,p:any[])=>{if(q.includes("runtime_completion_requests"))return [g.__p4Row];if(q.includes("runtime_sessions"))return [{state:"drained"}];if(q.includes("owner_reservations"))return [{reservation_ref:"setfarm://tests/p4/target",reservation_hash:"c".repeat(64)}];throw new Error("unexpected SQL:"+q)}});
const lockRuntimeCompletionChainInTransaction=async()=>({request:g.__p4Row,runtimeState:"drained",claimOutcome:"done"}); const mapRequest=(row:any)=>({requestId:row.request_id,runtimeSessionId:row.runtime_session_id,claimId:Number(row.claim_id),runId:row.run_id,state:row.state,applyPhase:row.apply_phase,ownerInstanceId:row.owner_instance_id,ownerAttemptCount:row.owner_attempt_count,leaseExpiresAt:row.lease_expires_at,updatedAt:row.updated_at??"2026-08-26T11:00:00.000Z"});
const eligibilityRoot=path.join(import.meta.dirname,"durable-eligibility-store");fs.mkdirSync(eligibilityRoot,{recursive:true,mode:0o700});
const completionBootstrapEligibilityPathV1=(h:string)=>path.join(eligibilityRoot,"elig-"+h+".json"); const completionBootstrapSelectedEligibilityPathV1=()=>path.join(eligibilityRoot,"selected.json");
function completionBootstrapWriteNoReplaceV1(target:string,value:any){const bytes=canonical(value)+"\\n";try{fs.writeFileSync(target,bytes,{flag:"wx",mode:0o600})}catch(error){if(!(error instanceof Error)||!("code" in error)||error.code!=="EEXIST")throw error;if(fs.readFileSync(target,"utf8")!==bytes)throw new Error("collision")}}
const completionBootstrapReadSelectedEligibilityV1=()=>Object.freeze(JSON.parse(fs.readFileSync(completionBootstrapSelectedEligibilityPathV1(),"utf8")));
const completionBootstrapReadEligibilityV1=(pair:any)=>{const v=JSON.parse(fs.readFileSync(completionBootstrapEligibilityPathV1(pair.eligibilityHash),"utf8"));if(!v||v.eligibilityRef!==pair.eligibilityRef)throw new Error("eligibility crossed");return recursivelyFreezeCompletionBootstrapV1(v)};
const completionBootstrapOperationPairV1=(v:any)=>{if(v.operationRef!=="setfarm://internal-production/baseline-spawner-bootstrap-restart-operation/sha256/"+v.operationHash||!SHA.test(v.operationHash))throw new Error("operation crossed");return Object.freeze({...v})};
const lockInternalProductionBaselineCompletionOwnerBootstrapTargetInTransactionV1=async()=>({targetOwnerReservationRef:"setfarm://tests/p4/target",targetOwnerReservationHash:"c".repeat(64)});
async function resolveInternalProductionBaselineCompletionOwnerBootstrapTargetGuardReceiptV1(_pair:any){return g.__p4Receipt}
async function prepareInternalProductionBaselineCompletionOwnerBootstrapTargetGuardCoreV1(owner:any,_expired:boolean){g.__p4Counts.guard+=1;g.__p4Phase=g.__p4GuardPrepared;return {...g.__p4Guard}}
async function prepareInternalProductionBaselineCompletionOwnerBootstrapTargetGuardV1(){g.__p4Counts.guard+=1;g.__p4Phase=g.__p4GuardPrepared;return {...g.__p4Guard}}
async function completionBootstrapBindOperationForOwnerV1(_owner:any,_guard:any,operation:any){g.__p4Counts.bind+=1;g.__p4Phase={...g.__p4GuardPrepared,state:"operation_bound",operationRef:operation.operationRef,operationHash:operation.operationHash}}
${identityKernel}
${verificationKernel}
${reopenKernel}
${createKernel}
${resultValidatorKernel}
${phaseKernel}
${continueKernel}
${preflightKernel}
${recoveryKernel}
export function createRuntimeCompletionRepository(sql:any){return Object.freeze({
${recoverMethod}
})}
export function p4SetOwner(owner:any,row:any){g.__p4Owner=owner;g.__p4Row=row}
export function p4SetPhase(phase:any){g.__p4Phase=phase;g.__p4Row.result=phase===null?{}:{internalProductionBaselineSpawnerBootstrap:structuredClone(phase)}}
export function p4ResetCounts(){g.__p4Counts={guard:0,acquire:0,release:0,prepare:0,prepareRecovery:0,bind:0,execute:0}}
export function p4Counts(){return {...g.__p4Counts}}
export function p4RepositorySql(){return {begin:pgBegin}}
export function p4CorruptSelected(){fs.writeFileSync(completionBootstrapSelectedEligibilityPathV1(),canonical({eligibilityRef:"setfarm://internal-production/baseline-completion-owner-bootstrap-eligibility/sha256/"+"f".repeat(64),eligibilityHash:"f".repeat(64)})+"\\n",{mode:0o600})}
export function p4ResetDurableStore(){fs.rmSync(eligibilityRoot,{recursive:true,force:true});fs.mkdirSync(eligibilityRoot,{recursive:true,mode:0o700})}
`, "utf8");
    const sha = (n: string) => n.repeat(64);
    const delivery = { deliveryAuthorityRef: "setfarm://tests/p4/delivery", deliveryAuthorityHash: sha("1"), deliveryCommitSha: "1".repeat(40), deliveryTreeHash: "2".repeat(40), exact24PathBlobSetHash: sha("2"), currentSourceBuildHash: sha("3"), focusedVerificationHash: sha("4"), deliveryAncestorOfCurrentSource: true };
    const entry = { entryAuthorityRef: "setfarm://tests/p4/entry", entryAuthorityHash: sha("5") };
    const migration = { migrationReceiptRef: "setfarm://tests/p4/migration", migrationReceiptHash: sha("6") };
    Object.assign(globalThis as any, { __p4Delivery: delivery, __p4Entry: entry, __p4Migration: migration, __p4CurrentEntry: { state: "ready", entryAuthority: entry, migrationApplyingPhase: { migrationReceipt: migration } } });
    const harness = await import(`${pathToFileURL(harnessPath).href}?p4=${Date.now()}`) as any;
    const owner = { requestId: "request-one", ownerInstanceId: "owner-one", ownerAttemptCount: 3 };
    const row = { request_id: owner.requestId, runtime_session_id: "session-one", claim_id: "claim-one", run_id: "run-one", state: "processing", apply_phase: "effects_committed", owner_instance_id: owner.ownerInstanceId, owner_attempt_count: owner.ownerAttemptCount, lease_expires_at: "2026-08-26T13:00:00.000Z", drained_at: "2026-08-26T11:00:00.000Z", result: {} };
    harness.p4SetOwner(owner, row); harness.p4ResetCounts();
    const verification = await harness.createInternalProductionBaselineCompletionOwnerBootstrapCleanBuildVerificationV1();
    assert.ok(verification && Object.isFrozen(verification));
    const requestIdHash = createHash("sha256").update(JSON.stringify({ requestId: row.request_id, schema: "setfarm.internal-production-runtime-completion-request-id.v1" })).digest("hex");
    const claimIdHash = createHash("sha256").update(JSON.stringify({ claimId: row.claim_id, schema: "setfarm.internal-production-runtime-completion-claim-id.v1" })).digest("hex");
    const runIdentityHash = createHash("sha256").update(JSON.stringify({ runId: row.run_id, schema: "setfarm.internal-production-runtime-completion-run-identity.v1" })).digest("hex");
    const ownerGenerationHash = createHash("sha256").update(JSON.stringify({ ownerAttemptCount: row.owner_attempt_count, ownerInstanceId: row.owner_instance_id, schema: "setfarm.internal-production-runtime-completion-owner-generation.v1" })).digest("hex");
    const receipt = { targetGuardReceiptRef: "setfarm://internal-production/baseline-completion-owner-bootstrap-target-guard-receipt/sha256/" + sha("7"), targetGuardReceiptHash: sha("7"), targetGuardHash: sha("d"), kind: "authenticated-completion-owner-bootstrap-target", requestIdHash, claimIdHash, runIdentityHash, ownerGenerationHash, ownerFenced: true, ownerDrained: true, unrelatedOwnerCount: 0, unrelatedOwnerCensusHash: sha("e") };
    const guard = { ...receipt }; delete (guard as any).targetGuardReceiptHash; Object.assign(guard, { targetGuardReceiptHash: receipt.targetGuardReceiptHash });
    const guardPrepared = { schema: "setfarm.internal-production-baseline-spawner-bootstrap-completion-result.v1", state: "guard_prepared", targetGuardReceiptRef: receipt.targetGuardReceiptRef, targetGuardReceiptHash: receipt.targetGuardReceiptHash, operationRef: null, operationHash: null, targetGuardConsumptionRef: null, targetGuardConsumptionHash: null, recoveredOwnerGenerationHash: null, targetOwnerReleaseReceiptHash: null, sequenceRef: null, sequenceHash: null };
    Object.assign(globalThis as any, { __p4Receipt: receipt, __p4Guard: guard, __p4GuardPrepared: guardPrepared });
    const secondOwner = { requestId: "request-two", ownerInstanceId: "owner-two", ownerAttemptCount: 1 };
    const secondRow = { ...row, request_id: secondOwner.requestId, owner_instance_id: secondOwner.ownerInstanceId, owner_attempt_count: secondOwner.ownerAttemptCount };
    harness.p4SetOwner(secondOwner, secondRow);
    assert.equal(await harness.createInternalProductionBaselineCompletionOwnerBootstrapCleanBuildVerificationV1(), null, "a valid different selected request loses without replacing the winner");
    harness.p4CorruptSelected();
    await assert.rejects(harness.createInternalProductionBaselineCompletionOwnerBootstrapCleanBuildVerificationV1(), /eligibility crossed|ENOENT/);
    // A fresh kernel recreates the original durable winner for phase execution.
    harness.p4ResetDurableStore();
    const fresh = await import(`${pathToFileURL(harnessPath).href}?p4-fresh=${Date.now()}`) as any;
    fresh.p4SetOwner(owner, row); fresh.p4ResetCounts();
    const freshVerification = await fresh.createInternalProductionBaselineCompletionOwnerBootstrapCleanBuildVerificationV1();
    Object.assign(globalThis as any, { __p4Receipt: receipt, __p4Guard: guard, __p4GuardPrepared: guardPrepared });
    for (const phase of [null, guardPrepared, { ...guardPrepared, state: "operation_bound", operationRef: "setfarm://internal-production/baseline-spawner-bootstrap-restart-operation/sha256/" + sha("8"), operationHash: sha("8") }, { ...guardPrepared, state: "guard_consumed", operationRef: "setfarm://internal-production/baseline-spawner-bootstrap-restart-operation/sha256/" + sha("8"), operationHash: sha("8"), targetGuardConsumptionRef: "setfarm://internal-production/baseline-completion-owner-bootstrap-target-guard-consumption/sha256/" + sha("c"), targetGuardConsumptionHash: sha("c") }, { ...guardPrepared, state: "owner_recovered", operationRef: "setfarm://internal-production/baseline-spawner-bootstrap-restart-operation/sha256/" + sha("8"), operationHash: sha("8"), targetGuardConsumptionRef: "setfarm://internal-production/baseline-completion-owner-bootstrap-target-guard-consumption/sha256/" + sha("c"), targetGuardConsumptionHash: sha("c"), recoveredOwnerGenerationHash: sha("9") }]) {
      fresh.p4ResetCounts(); fresh.p4SetPhase(phase);
      await fresh.continueInternalProductionBaselineCompletionOwnerBootstrapAfterCleanBuildV1({ verification: freshVerification });
      assert.equal(fresh.p4Counts().execute, 1);
      assert.ok(fresh.p4Counts().prepare <= 1 && fresh.p4Counts().release <= 1);
    }
    const expiredRow = { ...row, lease_expires_at: "2026-08-26T11:30:00.000Z" };
    for (const phase of [null, guardPrepared, { ...guardPrepared, state: "operation_bound", operationRef: "setfarm://internal-production/baseline-spawner-bootstrap-restart-operation/sha256/" + sha("8"), operationHash: sha("8") }, { ...guardPrepared, state: "guard_consumed", operationRef: "setfarm://internal-production/baseline-spawner-bootstrap-restart-operation/sha256/" + sha("8"), operationHash: sha("8"), targetGuardConsumptionRef: "setfarm://internal-production/baseline-completion-owner-bootstrap-target-guard-consumption/sha256/" + sha("c"), targetGuardConsumptionHash: sha("c") }, { ...guardPrepared, state: "owner_recovered", operationRef: "setfarm://internal-production/baseline-spawner-bootstrap-restart-operation/sha256/" + sha("8"), operationHash: sha("8"), targetGuardConsumptionRef: "setfarm://internal-production/baseline-completion-owner-bootstrap-target-guard-consumption/sha256/" + sha("c"), targetGuardConsumptionHash: sha("c"), recoveredOwnerGenerationHash: sha("9") }]) {
      fresh.p4ResetCounts(); fresh.p4SetOwner(owner, expiredRow); fresh.p4SetPhase(phase);
      const decision = await fresh.createRuntimeCompletionRepository(fresh.p4RepositorySql()).recoverExpiredProcessing({ ownerInstanceId: "replacement-owner" });
      assert.equal(decision.status, "bootstrap_selected", "real repository recovery selects only the durable eligibility winner");
      await fresh.recoverSelectedInternalProductionBaselineCompletionOwnerBootstrapV1();
      const counts = fresh.p4Counts();
      assert.equal(counts.execute, 1); assert.equal(counts.release, 1); assert.ok(counts.guard <= 1 && counts.prepareRecovery <= 1 && counts.bind <= 1);
    }
  } finally { rmSync(fixture, { recursive: true, force: true }); }
});

it("P4 completion owner release rolls back session, acceptance, close, and result failures atomically", async () => {
  const production = readFileSync(new URL("../../src/execution/runtime-completion.ts", import.meta.url), "utf8");
  const start = production.indexOf("export async function recoverAndReleaseInternalProductionBaselineCompletionOwnerBootstrapTargetV1(");
  const end = production.indexOf("export async function completeInternalProductionBaselineCompletionOwnerBootstrapForSequenceV1(", start);
  assert.ok(start >= 0 && end > start);
  const fixture = mkdtempSync(path.join(tmpdir(), "setfarm-p4-completion-release-"));
  try {
    const modulePath = path.join(fixture, "release.ts");
    writeFileSync(modulePath, `
import {createHash} from "node:crypto";
type PgTransactionSql=any; type RuntimeCompletionRow=any; type InternalProductionBaselineCompletionOwnerBootstrapLifecycleObservationV1=any;
const g=globalThis as any;
const canonical=(v:any):string=>v===null||typeof v!=="object"?JSON.stringify(v):Array.isArray(v)?"["+v.map(canonical).join(",")+"]":"{"+Object.keys(v).sort().map(k=>JSON.stringify(k)+":"+canonical(v[k])).join(",")+"}";
const hashCanonicalJson=(v:any)=>createHash("sha256").update(canonical(v)).digest("hex");
const completionBootstrapFailV1=(m:string):never=>{throw new Error(m)};
const completionBootstrapOperationPairV1=(v:any)=>Object.freeze({...v});
const completionBootstrapStoredResultV1=(row:any)=>row.result.internalProductionBaselineSpawnerBootstrap;
const completionBootstrapLifecycleObservationV1=(context:any)=>Object.freeze({state:context.result.state,targetOwnerReleaseReceiptHash:context.result.targetOwnerReleaseReceiptHash});
const resolveCompletionBootstrapLifecycleContextV1=async()=>Object.freeze({row:structuredClone(g.__p4ReleaseState.row),result:structuredClone(g.__p4ReleaseState.row.result.internalProductionBaselineSpawnerBootstrap),startupClaim:{currentGenerationHash:"9".repeat(64)}});
const readDatabaseWallClock=async()=>new Date("2026-08-26T12:00:00.000Z");
const lockInternalProductionBaselineCompletionOwnerBootstrapReleaseInTransactionV1=async()=>({targetOwnerReservationRef:"setfarm://tests/p4/target",targetOwnerReservationHash:"a".repeat(64)});
const releaseDrainedRuntimeSessionInTransaction=async(tx:any)=>{tx.state.session="released";if(g.__p4ReleaseFailure==="session")throw new Error("INJECT_SESSION")};
const resolveInternalProductionCompletionOwnerTerminalAuthorityPairInTransactionV1=async()=>({reservationRef:"setfarm://tests/p4/target",reservationHash:"a".repeat(64),terminalAuthorityRef:"setfarm://tests/p4/terminal",terminalAuthorityHash:"b".repeat(64)});
const closeInternalProductionOwnerReservationV1=async(tx:any)=>{tx.state.owner="closed";if(g.__p4ReleaseFailure==="close")throw new Error("INJECT_CLOSE");return {closeRef:"setfarm://internal-production/owner-reservation-closes/sha256/"+"c".repeat(64),closeHash:"c".repeat(64)}};
const resolveInternalProductionOwnerReservationCloseInTransactionV1=async()=>({reservationRef:"setfarm://tests/p4/target",reservationHash:"a".repeat(64)});
const pgBegin=async(cb:any)=>{const txState=structuredClone(g.__p4ReleaseState);const tx:any={state:txState,unsafe:async(q:string,p:any[])=>{if(q.includes("SELECT * FROM runtime_completion_requests"))return [txState.row];if(q.includes("SET state='accepted'")){txState.row.state="accepted";txState.row.accepted_at=p[1];txState.row.lease_expires_at=null;if(g.__p4ReleaseFailure==="accept")throw new Error("INJECT_ACCEPT");return [{request_id:txState.row.request_id}]}if(q.includes("SET result=jsonb_set")){txState.row.result={internalProductionBaselineSpawnerBootstrap:JSON.parse(p[1])};if(g.__p4ReleaseFailure==="result")throw new Error("INJECT_RESULT");return [{request_id:txState.row.request_id}]}throw new Error("UNEXPECTED_SQL:"+q)}};const value=await cb(tx);g.__p4ReleaseState=txState;return value};
${production.slice(start, end)}
export function p4Seed(failure:string|null){g.__p4ReleaseFailure=failure;g.__p4ReleaseState={session:"drained",owner:"bound",row:{request_id:"RCR_p4-release-request-0001",runtime_session_id:"RTS_p4-release-session",claim_id:1,state:"processing",apply_phase:"effects_committed",drained_at:"2026-08-26T11:00:00.000Z",owner_instance_id:"owner",owner_attempt_count:2,lease_expires_at:"2026-08-26T13:00:00.000Z",accepted_at:null,result:{internalProductionBaselineSpawnerBootstrap:{schema:"setfarm.internal-production-baseline-spawner-bootstrap-completion-result.v1",state:"owner_recovered",targetGuardReceiptRef:"setfarm://internal-production/baseline-completion-owner-bootstrap-target-guard-receipt/sha256/"+"1".repeat(64),targetGuardReceiptHash:"1".repeat(64),operationRef:"setfarm://internal-production/baseline-spawner-bootstrap-restart-operation/sha256/"+"2".repeat(64),operationHash:"2".repeat(64),targetGuardConsumptionRef:"setfarm://internal-production/baseline-completion-owner-bootstrap-target-guard-consumption/sha256/"+"3".repeat(64),targetGuardConsumptionHash:"3".repeat(64),recoveredOwnerGenerationHash:"9".repeat(64),targetOwnerReleaseReceiptHash:null,sequenceRef:null,sequenceHash:null}}}}}
export function p4State(){return structuredClone(g.__p4ReleaseState)}
`, "utf8");
    const kernel = await import(`${pathToFileURL(modulePath).href}?p4=${Date.now()}`) as any;
    const operation = { operationRef: `setfarm://internal-production/baseline-spawner-bootstrap-restart-operation/sha256/${"2".repeat(64)}`, operationHash: "2".repeat(64) };
    for (const failure of ["session", "accept", "close", "result"]) {
      kernel.p4Seed(failure);
      const before = kernel.p4State();
      await assert.rejects(kernel.recoverAndReleaseInternalProductionBaselineCompletionOwnerBootstrapTargetV1(operation), new RegExp(`INJECT_${failure.toUpperCase()}`));
      assert.deepEqual(kernel.p4State(), before, `${failure} injection rolls the entire transaction back`);
    }
    kernel.p4Seed(null);
    const observation = await kernel.recoverAndReleaseInternalProductionBaselineCompletionOwnerBootstrapTargetV1(operation);
    assert.equal(observation.state, "owner_released");
    assert.deepEqual({ session: kernel.p4State().session, owner: kernel.p4State().owner, request: kernel.p4State().row.state }, { session: "released", owner: "closed", request: "accepted" });
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});

async function bindTestRunOwner(
  database: Awaited<ReturnType<typeof createIsolatedTestDatabase>>,
  runId: string,
): Promise<void> {
  await database.sql.begin(async (transaction) => {
    const identity = createInternalProductionWorkflowRunCanonicalOwnerIdentityV1(runId);
    const reservation = await beginOrAdoptInternalProductionOwnerReservationV1(
      transaction as PgTransactionSql,
      { producerImplementationId: "a-runtime-run-v1", ownerKey: identity.ownerKey },
    );
    await bindInternalProductionOwnerReservationV1(transaction as PgTransactionSql, {
      reservationRef: reservation.reservationRef,
      reservationHash: reservation.reservationHash,
      canonicalOwnerIdentity: identity,
    });
  });
}

async function asRuntimeCompletionOwner<T>(
  repository: ReturnType<typeof createRuntimeCompletionRepository>,
  requestId: string,
  action: () => Promise<T>,
): Promise<T> {
  const request = await repository.findById(requestId);
  if (!request?.ownerInstanceId || !request.leaseExpiresAt) {
    throw new Error("TEST_RUNTIME_COMPLETION_OWNER_CAPABILITY_MISSING");
  }
  return runWithRuntimeCompletionOwner({
    requestId: request.requestId,
    ownerInstanceId: request.ownerInstanceId,
    leaseExpiresAt: request.leaseExpiresAt,
    ownerAttemptCount: request.ownerAttemptCount,
  }, action);
}

async function seedManagedClaim(
  database: Awaited<ReturnType<typeof createIsolatedTestDatabase>>,
  runId: string,
  protocol: "shadow" | "v3" = "shadow",
) {
  const stepDbId = `${runId}-step`;
  const storyDbId = `${runId}-story`;
  if (protocol === "v3") {
    const releaseSha = "d".repeat(40);
    const releaseAdmissionHash = await database.seedV3ReleaseGoAdmission(releaseSha);
    await database.sql`
      INSERT INTO runs (
        id, workflow_id, task, status, context, protocol,
        compiler_release_sha, activation_preflight_hash, packet_hash,
        release_admission_hash
      ) VALUES (
        ${runId}, 'feature-dev', 'managed v3 completion test', 'running', '{}', 'v3',
        ${releaseSha}, ${"e".repeat(64)}, ${"a".repeat(64)}, ${releaseAdmissionHash}
      )
    `;
  } else {
    await database.insertRun(runId);
  }
  await bindTestRunOwner(database, runId);
  await database.sql`
    INSERT INTO steps
      (id, run_id, step_id, agent_id, step_index, input_template, expects, status, current_story_id)
    VALUES
      (${stepDbId}, ${runId}, 'implement', 'feature-dev_developer', 1, '', '', 'running', ${storyDbId})
  `;
  await database.sql`
    INSERT INTO stories
      (id, run_id, story_index, story_id, title, status, claimed_by, claim_generation)
    VALUES
      (${storyDbId}, ${runId}, 1, 'US-001', 'Story', 'running', 'feature-dev_developer', 1)
  `;
  const claimId = await database.sql.begin(async (transaction) => {
    const ids = await transaction<Array<{ id: unknown }>>`
      SELECT nextval(pg_get_serial_sequence('claim_log','id'))::bigint::text AS id
    `;
    const birth = await prepareInternalProductionClaimBirthV1(
      transaction as any,
      "a-claim-loop-runtime-v1",
      ids,
    );
    return insertAndBindInternalProductionClaimBirthV1(transaction as any, birth, {
      runId,
      workflowStepId: "implement",
      storyId: "US-001",
      claimAgentId: "feature-dev_developer",
      claimedAt: new Date(),
    });
  }) as number;
  const attempts = createAttemptRepository(database.sql, {
    attemptId: () => `ATT_${runId}-attempt`,
    fenceToken: () => "f".repeat(64),
  });
  const attempt = await attempts.reserve(exactProductReservation({
    claimId,
    runId,
    storyId: "US-001",
    agentId: "feature-dev_developer",
    evidenceRefs: [`setfarm://claim-log/${claimId}`],
  }));
  const sessions = createRuntimeSessionRepository(database.sql);
  const session = await sessions.reserve({
    sessionId: `RTS_${runId}-session`,
    runId,
    stepDbId,
    workflowStepId: "implement",
    storyDbId,
    storyId: "US-001",
    claimId,
    attemptId: attempt.attempt.attemptId,
    claimAgentId: "feature-dev_developer",
    runtimeAgentId: "prism",
    runtimeKind: "openclaw_session",
    ownerInstanceId: "spawner-a",
  });
  await sessions.markStarting({ sessionId: session.sessionId, ownerInstanceId: "spawner-a" });
  await sessions.markRunning({
    sessionId: session.sessionId,
    ownerInstanceId: "spawner-a",
    sessionKey: `key-${runId}`,
  });
  const envelope: ClaimEnvelopeV1 = {
    schema: "setfarm.claim-envelope.v1",
    protocol,
    issuedAt: "2026-07-13T12:00:00.000Z",
    stepId: stepDbId,
    workflowStepId: "implement",
    runId,
    storyId: "US-001",
    storyDbId,
    claimId,
    claimAgentId: "feature-dev_developer",
    runtimeAgentId: "prism",
    claimGeneration: 1,
    attempt: {
      attemptId: attempt.attempt.attemptId,
      generation: attempt.attempt.generation,
      fenceToken: attempt.attempt.fenceToken,
    },
  };
  return { stepDbId, storyDbId, claimId, attempts, attempt, sessions, session, envelope };
}

async function seedManagedSingleStepClaim(
  database: Awaited<ReturnType<typeof createIsolatedTestDatabase>>,
  runId: string,
) {
  const stepDbId = `${runId}-step`;
  await database.insertRun(runId);
  await bindTestRunOwner(database, runId);
  await database.sql`
    INSERT INTO steps
      (id, run_id, step_id, agent_id, step_index, input_template, expects, status)
    VALUES
      (${stepDbId}, ${runId}, 'verify', 'feature-dev_reviewer', 1, '', '', 'running')
  `;
  const claimId = await database.sql.begin(async (transaction) => {
    const ids = await transaction<Array<{ id: unknown }>>`
      SELECT nextval(pg_get_serial_sequence('claim_log','id'))::bigint::text AS id
    `;
    const birth = await prepareInternalProductionClaimBirthV1(
      transaction as any,
      "a-claim-single-runtime-v1",
      ids,
    );
    return insertAndBindInternalProductionClaimBirthV1(transaction as any, birth, {
      runId,
      workflowStepId: "verify",
      storyId: null,
      claimAgentId: "feature-dev_reviewer",
      claimedAt: new Date(),
    });
  }) as number;
  const sessions = createRuntimeSessionRepository(database.sql);
  const session = await sessions.reserve({
    sessionId: `RTS_${runId}-session`,
    runId,
    stepDbId,
    workflowStepId: "verify",
    claimId,
    claimAgentId: "feature-dev_reviewer",
    runtimeAgentId: "flux",
    runtimeKind: "openclaw_session",
    ownerInstanceId: "spawner-a",
  });
  await sessions.markStarting({ sessionId: session.sessionId, ownerInstanceId: "spawner-a" });
  await sessions.markRunning({
    sessionId: session.sessionId,
    ownerInstanceId: "spawner-a",
    sessionKey: `key-${runId}`,
  });
  const envelope: ClaimEnvelopeV1 = {
    schema: "setfarm.claim-envelope.v1",
    protocol: "shadow",
    issuedAt: "2026-07-13T12:00:00.000Z",
    stepId: stepDbId,
    workflowStepId: "verify",
    runId,
    claimId,
    claimAgentId: "feature-dev_reviewer",
    runtimeAgentId: "flux",
  };
  return { stepDbId, claimId, sessions, session, envelope };
}

async function waitForBlockedClaimTransition(
  database: Awaited<ReturnType<typeof createIsolatedTestDatabase>>,
): Promise<void> {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const rows = await database.sql<Array<{ blocked: boolean }>>`
      SELECT EXISTS (
        SELECT 1
          FROM pg_stat_activity
         WHERE datname = current_database()
           AND pid <> pg_backend_pid()
           AND wait_event_type = 'Lock'
           AND query ILIKE '%FROM claim_log%'
           AND query ILIKE '%FOR UPDATE%'
      ) AS blocked
    `;
    if (rows[0]?.blocked) return;
    await new Promise<void>((resolve) => setTimeout(resolve, 20));
  }
  throw new Error("TEST_BARRIER_SINGLE_STEP_COMPLETION_DID_NOT_BLOCK");
}

async function waitForBlockedTerminationPublication(
  database: Awaited<ReturnType<typeof createIsolatedTestDatabase>>,
): Promise<void> {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const rows = await database.sql<Array<{ blocked: boolean }>>`
      SELECT EXISTS (
        SELECT 1
          FROM pg_stat_activity
         WHERE datname = current_database()
           AND pid <> pg_backend_pid()
           AND wait_event_type = 'Lock'
           AND query ILIKE '%SELECT status FROM runs WHERE id = $1 FOR UPDATE%'
      ) AS blocked
    `;
    if (rows[0]?.blocked) return;
    await new Promise<void>((resolve) => setTimeout(resolve, 20));
  }
  throw new Error("TEST_BARRIER_TERMINATION_PUBLICATION_DID_NOT_BLOCK");
}

async function waitForBlockedRuntimeQuarantine(
  database: Awaited<ReturnType<typeof createIsolatedTestDatabase>>,
): Promise<void> {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const rows = await database.sql<Array<{ blocked: boolean }>>`
      SELECT EXISTS (
        SELECT 1
          FROM pg_stat_activity
         WHERE datname = current_database()
           AND pid <> pg_backend_pid()
           AND wait_event_type = 'Lock'
           AND query ILIKE '%runtime_sessions%'
      ) AS blocked
    `;
    if (rows[0]?.blocked) return;
    await new Promise<void>((resolve) => setTimeout(resolve, 20));
  }
  throw new Error("TEST_BARRIER_RUNTIME_QUARANTINE_DID_NOT_BLOCK");
}

async function waitForBlockedRecoveryAdvisoryLock(
  database: Awaited<ReturnType<typeof createIsolatedTestDatabase>>,
): Promise<void> {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const rows = await database.sql<Array<{ blocked: boolean }>>`
      SELECT EXISTS (
        SELECT 1
          FROM pg_stat_activity
         WHERE datname = current_database()
           AND pid <> pg_backend_pid()
           AND wait_event_type = 'Lock'
           AND query ILIKE '%pg_advisory_xact_lock(hashtextextended($1, 0))%'
      ) AS blocked
    `;
    if (rows[0]?.blocked) return;
    await new Promise<void>((resolve) => setTimeout(resolve, 20));
  }
  throw new Error("TEST_BARRIER_RECOVERY_ADVISORY_LOCK_DID_NOT_BLOCK");
}

async function expireRuntimeCompletionLease(
  database: Awaited<ReturnType<typeof createIsolatedTestDatabase>>,
  requestId: string,
): Promise<void> {
  const rows = await database.sql.unsafe<Array<{ request_id: string }>>(
    `UPDATE runtime_completion_requests
        SET lease_expires_at = date_trunc('milliseconds', clock_timestamp()) - INTERVAL '1 second'
      WHERE request_id = $1
        AND state IN ('draining', 'processing')
      RETURNING request_id`,
    [requestId],
  );
  assert.equal(rows.length, 1, "fixture must expire one exact completion lease");
}

async function installCompletionCloseRejection(
  database: Awaited<ReturnType<typeof createIsolatedTestDatabase>>,
  suffix: string,
): Promise<void> {
  const functionName = `task5_reject_completion_close_${suffix}`;
  await database.sql.unsafe(`
    CREATE FUNCTION ${functionName}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
      IF OLD.category='completion-owner' AND OLD.state='bound' AND NEW.state='closed' THEN
        RAISE EXCEPTION 'TEST_TASK5_COMPLETION_CLOSE_REJECTED';
      END IF;
      RETURN NEW;
    END $$
  `);
  await database.sql.unsafe(`
    CREATE TRIGGER ${functionName} BEFORE UPDATE OF state
    ON internal_production_owner_reservations_v1
    FOR EACH ROW EXECUTE FUNCTION ${functionName}()
  `);
}

async function completionAndOwnerState(
  database: Awaited<ReturnType<typeof createIsolatedTestDatabase>>,
  requestId: string,
): Promise<Readonly<{ request_state: string; owner_state: string }>> {
  const rows = await database.sql<Array<{ request_state: string; owner_state: string }>>`
    SELECT request.state AS request_state,owner.state AS owner_state
      FROM runtime_completion_requests request
      JOIN internal_production_owner_reservations_v1 owner
        ON owner.category='completion-owner'
       AND owner.reservation_payload->>'ownerKey'=request.request_id
     WHERE request.request_id=${requestId}
  `;
  if (rows.length !== 1) throw new Error("TEST_COMPLETION_OWNER_STATE_MISSING");
  return { ...rows[0]! };
}

type ManagedCompletionSeed =
  | Awaited<ReturnType<typeof seedManagedClaim>>
  | Awaited<ReturnType<typeof seedManagedSingleStepClaim>>;

async function drainManagedRuntime(seeded: ManagedCompletionSeed): Promise<void> {
  const draining = await seeded.sessions.requestDrain({
    sessionId: seeded.session.sessionId,
    ownerInstanceId: "spawner-a",
    diagnostic: "test manager proved the runtime quiescent before orphan recovery",
  });
  assert.equal(draining.state, "drain_requested");
  const drained = await seeded.sessions.markDrained({
    sessionId: seeded.session.sessionId,
    ownerInstanceId: "spawner-a",
    evidence: DRAIN_EVIDENCE,
  });
  assert.equal(drained.state, "drained");
}

async function publishCompletionInState(
  database: Awaited<ReturnType<typeof createIsolatedTestDatabase>>,
  seeded: ManagedCompletionSeed,
  state: "requested" | "draining" | "processing" | "quarantined",
  requestId: string,
): Promise<Readonly<{ requestId: string; output: string }>> {
  const output = "STATUS: done\nCHANGES: durable completion owns this exact claim";
  const requested = await requestRuntimeCompletion(database.sql, {
    envelope: seeded.envelope,
    output,
    requestId,
  });
  if (requested.status !== "requested") throw new Error("test completion request missing");
  if (state === "requested") return { requestId: requested.request.requestId, output };

  const completions = createRuntimeCompletionRepository(database.sql);
  const draining = await completions.claim({
    requestId: requested.request.requestId,
    ownerInstanceId: "completion-owner",
  });
  if (!draining) throw new Error("test completion drain owner missing");
  if (state === "draining") return { requestId: requested.request.requestId, output };
  if (state === "quarantined") {
    if (!draining.leaseExpiresAt) throw new Error("test completion lease missing");
    await completions.quarantine({
      requestId: draining.requestId,
      ownerInstanceId: "completion-owner",
      expectedState: "draining",
      expectedLeaseExpiresAt: draining.leaseExpiresAt,
      expectedUpdatedAt: draining.updatedAt,
      diagnostic: "test quarantined completion remains canonical",
    });
    return { requestId: requested.request.requestId, output };
  }

  await seeded.sessions.markDrained({
    sessionId: seeded.session.sessionId,
    ownerInstanceId: "spawner-a",
    evidence: DRAIN_EVIDENCE,
  });
  await completions.markProcessing({
    requestId: requested.request.requestId,
    ownerInstanceId: "completion-owner",
  });
  return { requestId: requested.request.requestId, output };
}

async function settleCompletionEffects(
  database: Awaited<ReturnType<typeof createIsolatedTestDatabase>>,
  requestId: string,
  ownerInstanceId: string,
  result: Record<string, unknown>,
): Promise<void> {
  const effects = createRuntimeCompletionEffectRepository(database.sql);
  for (;;) {
    const effect = await effects.claimNext({ requestId, ownerInstanceId });
    if (!effect) return;
    if (!effect.leaseToken) throw new Error("test effect lease token missing");
    await effects.settle({
      requestId,
      effectKey: effect.effectKey,
      ownerInstanceId,
      leaseToken: effect.leaseToken,
      resolution: "applied",
      result,
      evidence: { source: "runtime-completion-test" },
    });
  }
}

async function prepareFocusedCompletionEffect(
  database: Awaited<ReturnType<typeof createIsolatedTestDatabase>>,
  suffix: string,
  mandatory = false,
) {
  const requestId = `RCR_optional-${suffix}`;
  const runId = `run-optional-${suffix}`;
  const seeded = await seedManagedClaim(database, runId);
  const output = `STATUS: done\nCHANGES: optional effect ${suffix}`;
  const requested = await requestRuntimeCompletion(database.sql, {
    envelope: seeded.envelope,
    output,
    requestId,
  });
  if (requested.status !== "requested") throw new Error("optional completion request missing");
  const completions = createRuntimeCompletionRepository(database.sql);
  await completions.claim({ requestId, ownerInstanceId: "optional-manager" });
  await seeded.sessions.markDrained({
    sessionId: seeded.session.sessionId,
    ownerInstanceId: "spawner-a",
    evidence: DRAIN_EVIDENCE,
  });
  await completions.markProcessing({ requestId, ownerInstanceId: "optional-manager" });
  const effectKey = `telemetry/${suffix}`;
  const completionPlan = {
    kind: "story_completion" as const,
    continuation: { type: "story_loop_continue" as const },
    subject: { storyDbId: seeded.storyDbId, storyId: "US-001" },
    effects: [{
      effectKey,
      ordinal: 0,
      effectType: "story.telemetry",
      mandatory,
      payload: { suffix },
    }],
  };
  await asRuntimeCompletionOwner(completions, requestId, () => completeStoryClaimAndBoundAttempt(database.sql, {
    envelope: seeded.envelope,
    sourceAfter: { sha: "2".repeat(40), treeHash: "3".repeat(64) },
    outputHash: createHash("sha256").update(output, "utf8").digest("hex"),
    storyStatus: "done",
    storyOutput: output,
    stepStatus: "running",
    stepOutput: output,
    completionPlan,
  }));
  const effects = createRuntimeCompletionEffectRepository(database.sql);
  const effect = await effects.claimNext({ requestId, ownerInstanceId: "optional-manager" });
  if (!effect?.leaseToken || effect.effectKey !== effectKey || effect.mandatory !== mandatory) {
    throw new Error("focused completion effect lease missing");
  }
  return { requestId, effectKey, seeded, completions, effects, effect };
}

async function task5TerminalSnapshot(
  database: Awaited<ReturnType<typeof createIsolatedTestDatabase>>,
  requestId: string,
) {
  const rows = await database.sql<Array<{
    request_row: unknown;
    runtime_row: unknown;
    completion_owner_row: unknown;
    effect_rows: unknown;
    effect_owner_rows: unknown;
    admission_head_row: unknown;
  }>>`
    SELECT to_jsonb(request) AS request_row,
           to_jsonb(runtime) AS runtime_row,
           to_jsonb(completion_owner) AS completion_owner_row,
           (SELECT jsonb_agg(to_jsonb(effect) ORDER BY effect.effect_key)
              FROM runtime_completion_effects effect
             WHERE effect.request_id=request.request_id) AS effect_rows,
           (SELECT jsonb_agg(to_jsonb(effect_owner) ORDER BY effect_owner.reservation_ref)
              FROM internal_production_owner_reservations_v1 effect_owner
             WHERE effect_owner.reservation_payload->>'producerImplementationId'='a-mandatory-effect-v1'
               AND effect_owner.reservation_payload->>'ownerKey' LIKE ('%' || request.request_id || '%')) AS effect_owner_rows,
           to_jsonb(head) AS admission_head_row
      FROM runtime_completion_requests request
      JOIN runtime_sessions runtime ON runtime.session_id=request.runtime_session_id
      JOIN internal_production_owner_reservations_v1 completion_owner
        ON completion_owner.reservation_payload->>'producerImplementationId'='a-completion-owner-v1'
       AND completion_owner.reservation_payload->>'ownerKey'=request.request_id
      CROSS JOIN internal_production_owner_admission_head_v1 head
     WHERE request.request_id=${requestId} AND head.singleton
  `;
  if (rows.length !== 1) throw new Error("TEST_TASK5_TERMINAL_SNAPSHOT_MISSING");
  return { ...rows[0]! };
}

describe("manager-owned runtime completion", () => {
  it("admits only the exact durable recovery owner identity format", () => {
    assert.equal(
      isRuntimeCompletionRecoveryOwnerInstanceIdV1(
        "setfarm-runtime-completion-recovery:v1:123e4567-e89b-12d3-a456-426614174000",
      ),
      true,
    );
    for (const invalid of [
      "SPAWNER_INSTANCE_ID",
      "setfarm-runtime-completion-recovery:v1:",
      "setfarm-runtime-completion-recovery:v1:123e4567-e89b-12d3-a456-426614174000-suffix",
      "setfarm-runtime-completion-recovery:v1:123E4567-E89B-12D3-A456-426614174000",
      "prefix-setfarm-runtime-completion-recovery:v1:123e4567-e89b-12d3-a456-426614174000",
    ]) {
      assert.equal(isRuntimeCompletionRecoveryOwnerInstanceIdV1(invalid), false, invalid);
    }
  });

  it("rolls completion birth back at reread, bind, and commit and hides pre-ACK state", async () => {
    const database = await createIsolatedTestDatabase();
    const postgresClient = (await import("postgres")).default;
    const blocker = postgresClient(database.url, { max: 1 });
    try {
      const runId = "run-completion-birth-rollback";
      const seeded = await seedManagedSingleStepClaim(database, runId);
      const requested = await requestRuntimeCompletion(database.sql, {
        envelope: seeded.envelope,
        output: "STATUS: done\nSUMMARY: completion birth rollback matrix",
        requestId: "RCR_completion-birth-rollback1",
      });
      if (requested.status !== "requested") throw new Error("completion request missing");
      const completions = createRuntimeCompletionRepository(database.sql);
      const snapshot = async () => (await database.sql<Array<{
        request_state: string;
        owner_count: number;
        head_version: string;
        head_hash: string;
      }>>`
        SELECT request.state AS request_state,
               (SELECT COUNT(*)::integer
                  FROM internal_production_owner_reservations_v1 owner
                 WHERE owner.category='completion-owner'
                   AND owner.reservation_payload->>'ownerKey'=request.request_id) AS owner_count,
               head.head_version::text AS head_version,head.head_hash
          FROM runtime_completion_requests request
          CROSS JOIN internal_production_owner_admission_head_v1 head
         WHERE request.request_id=${requested.request.requestId} AND head.singleton
      `)[0]!;
      const before = await snapshot();

      await database.sql.unsafe(`
        CREATE FUNCTION task5_completion_reread_mismatch_v1() RETURNS trigger
        LANGUAGE plpgsql AS $$ BEGIN
          IF OLD.state='requested' AND NEW.state='draining' THEN
            UPDATE runtime_completion_requests
               SET diagnostic='TEST_TASK5_POST_CAS_REREAD_MISMATCH'
             WHERE request_id=NEW.request_id;
          END IF;
          RETURN NULL;
        END $$
      `);
      await database.sql.unsafe(`
        CREATE TRIGGER task5_completion_reread_mismatch_v1
        AFTER UPDATE OF state ON runtime_completion_requests
        FOR EACH ROW EXECUTE FUNCTION task5_completion_reread_mismatch_v1()
      `);
      await assert.rejects(
        completions.claim({ requestId: requested.request.requestId, ownerInstanceId: "reread-owner" }),
        /INTERNAL_PRODUCTION_COMPLETION_OWNER_REREAD_INVALID/,
      );
      assert.deepEqual({ ...await snapshot() }, { ...before });
      await database.sql.unsafe(`DROP TRIGGER task5_completion_reread_mismatch_v1 ON runtime_completion_requests`);

      await database.sql.unsafe(`
        CREATE FUNCTION task5_completion_bind_reject_v1() RETURNS trigger
        LANGUAGE plpgsql AS $$ BEGIN
          IF OLD.category='completion-owner' AND OLD.state='pending' AND NEW.state='bound' THEN
            RAISE EXCEPTION 'TEST_TASK5_COMPLETION_BIND_REJECTED';
          END IF;
          RETURN NEW;
        END $$
      `);
      await database.sql.unsafe(`
        CREATE TRIGGER task5_completion_bind_reject_v1
        BEFORE UPDATE OF state ON internal_production_owner_reservations_v1
        FOR EACH ROW EXECUTE FUNCTION task5_completion_bind_reject_v1()
      `);
      await assert.rejects(
        completions.claim({ requestId: requested.request.requestId, ownerInstanceId: "bind-owner" }),
        /TEST_TASK5_COMPLETION_BIND_REJECTED/,
      );
      assert.deepEqual({ ...await snapshot() }, { ...before });
      await database.sql.unsafe(`DROP TRIGGER task5_completion_bind_reject_v1 ON internal_production_owner_reservations_v1`);

      await database.sql.unsafe(`
        CREATE FUNCTION task5_completion_commit_reject_v1() RETURNS trigger
        LANGUAGE plpgsql AS $$ BEGIN
          IF NEW.category='completion-owner' AND NEW.state='bound' THEN
            RAISE EXCEPTION 'TEST_TASK5_COMPLETION_COMMIT_REJECTED';
          END IF;
          RETURN NEW;
        END $$
      `);
      await database.sql.unsafe(`
        CREATE CONSTRAINT TRIGGER task5_completion_commit_reject_v1
        AFTER UPDATE OF state ON internal_production_owner_reservations_v1
        DEFERRABLE INITIALLY DEFERRED FOR EACH ROW
        EXECUTE FUNCTION task5_completion_commit_reject_v1()
      `);
      await assert.rejects(
        completions.claim({ requestId: requested.request.requestId, ownerInstanceId: "commit-owner" }),
        /TEST_TASK5_COMPLETION_COMMIT_REJECTED/,
      );
      assert.deepEqual({ ...await snapshot() }, { ...before });
      await database.sql.unsafe(`DROP TRIGGER task5_completion_commit_reject_v1 ON internal_production_owner_reservations_v1`);

      await database.sql.unsafe("CREATE SEQUENCE task5_completion_preack_latch_v1");
      await database.sql.unsafe(`
        CREATE FUNCTION task5_completion_preack_latch_v1() RETURNS trigger
        LANGUAGE plpgsql AS $$ BEGIN
          IF OLD.category='completion-owner' AND OLD.state='pending' AND NEW.state='bound' THEN
            PERFORM nextval('task5_completion_preack_latch_v1');
            PERFORM pg_advisory_xact_lock(750051);
          END IF;
          RETURN NEW;
        END $$
      `);
      await database.sql.unsafe(`
        CREATE TRIGGER task5_completion_preack_latch_v1
        BEFORE UPDATE OF state ON internal_production_owner_reservations_v1
        FOR EACH ROW EXECUTE FUNCTION task5_completion_preack_latch_v1()
      `);
      let release!: () => void;
      const mayRelease = new Promise<void>((resolve) => { release = resolve; });
      let locked!: () => void;
      const blockerReady = new Promise<void>((resolve) => { locked = resolve; });
      const held = blocker.begin(async (transaction) => {
        await transaction.unsafe("SELECT pg_advisory_xact_lock(750051)");
        locked();
        await mayRelease;
      });
      await blockerReady;
      const claiming = completions.claim({ requestId: requested.request.requestId, ownerInstanceId: "ack-owner" });
      for (;;) {
        const latch = await database.sql<Array<{ is_called: boolean }>>`
          SELECT is_called FROM task5_completion_preack_latch_v1
        `;
        if (latch[0]?.is_called) break;
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
      assert.deepEqual({ ...await snapshot() }, { ...before }, "uncommitted birth is invisible pre-ACK");
      release();
      await held;
      const claimed = await claiming;
      assert.equal(claimed?.state, "draining");
      await database.sql.unsafe(`DROP TRIGGER task5_completion_preack_latch_v1 ON internal_production_owner_reservations_v1`);
      const committed = (await database.sql<Array<{
        reservation_ref: string;
        reservation_hash: string;
        owner_state: string;
        head_version: string;
        head_hash: string;
      }>>`
        SELECT owner.reservation_ref,owner.reservation_hash,owner.state AS owner_state,
               head.head_version::text AS head_version,head.head_hash
          FROM internal_production_owner_reservations_v1 owner
          CROSS JOIN internal_production_owner_admission_head_v1 head
         WHERE owner.category='completion-owner'
           AND owner.reservation_payload->>'ownerKey'=${requested.request.requestId}
           AND head.singleton
      `)[0]!;
      await expireRuntimeCompletionLease(database, requested.request.requestId);
      const adopted = await completions.claim({
        requestId: requested.request.requestId,
        ownerInstanceId: "ack-retry-owner",
      });
      assert.equal(adopted?.state, "draining");
      const afterAdoption = (await database.sql<Array<typeof committed>>`
        SELECT owner.reservation_ref,owner.reservation_hash,owner.state AS owner_state,
               head.head_version::text AS head_version,head.head_hash
          FROM internal_production_owner_reservations_v1 owner
          CROSS JOIN internal_production_owner_admission_head_v1 head
         WHERE owner.category='completion-owner'
           AND owner.reservation_payload->>'ownerKey'=${requested.request.requestId}
           AND head.singleton
      `)[0]!;
      assert.deepEqual({ ...afterAdoption }, { ...committed }, "ACK-loss adoption must not advance owner head");
    } finally {
      await blocker.end({ timeout: 5 });
      await database.cleanup();
    }
  });

  it("ignores valid cross-category owner-key collisions at optional settlement and completion close", async () => {
    const database = await createIsolatedTestDatabase();
    try {
      const prepared = await prepareFocusedCompletionEffect(database, "cross-category");
      const effectIdentity = createInternalProductionMandatoryEffectCanonicalOwnerIdentityV1({
        requestId: prepared.requestId,
        effectKey: prepared.effectKey,
      });
      await bindTestRunOwner(database, prepared.requestId);
      await bindTestRunOwner(database, effectIdentity.ownerKey);
      const result = { observed: true };
      const evidence = { source: "cross-category-owner-key" };
      const settled = await prepared.effects.settle({
        requestId: prepared.requestId,
        effectKey: prepared.effectKey,
        ownerInstanceId: "optional-manager",
        leaseToken: prepared.effect.leaseToken!,
        resolution: "applied",
        result,
        evidence,
      });
      assert.equal(settled.state, "applied");
      await prepared.completions.markEffectsCommitted({
        requestId: prepared.requestId,
        ownerInstanceId: "optional-manager",
        ownerAttemptCount: (await prepared.completions.findById(prepared.requestId))!.ownerAttemptCount,
        result,
      });
      const accepted = await prepared.completions.acceptAndRelease({
        requestId: prepared.requestId,
        ownerInstanceId: "optional-manager",
        ownerAttemptCount: (await prepared.completions.findById(prepared.requestId))!.ownerAttemptCount,
        result,
      });
      assert.equal(accepted.state, "accepted");
    } finally {
      await database.cleanup();
    }
  });

  it("ignores a valid cross-category owner-key collision when requested rejection has no completion owner", async () => {
    const database = await createIsolatedTestDatabase();
    try {
      const runId = "run-requested-cross-category";
      const requestId = "RCR_requested-cross-category1";
      const seeded = await seedManagedClaim(database, runId);
      const requested = await requestRuntimeCompletion(database.sql, {
        envelope: seeded.envelope,
        output: "STATUS: done\nCHANGES: cross-category requested rejection",
        requestId,
      });
      if (requested.status !== "requested") throw new Error("completion request missing");
      await bindTestRunOwner(database, requestId);
      await requestRunTermination(database.sql, {
        runId,
        targetStatus: "cancelled",
        requestedBy: "cli-user",
        diagnostic: "cross-category requested rejection",
        requestId: "RTR_requested-cross-category1",
      });
      const preempted = await createRuntimeCompletionRepository(database.sql).preemptForRunTermination({
        requestId,
        diagnostic: "termination owns requested rejection",
      });
      assert.equal(preempted.status, "preempted");
      const census = await database.sql<Array<{
        request_state: string;
        completion_owner_count: number;
        colliding_run_owner_state: string;
      }>>`
        SELECT request.state AS request_state,
               (SELECT COUNT(*)::integer
                  FROM internal_production_owner_reservations_v1 owner
                 WHERE owner.reservation_payload->>'producerImplementationId'='a-completion-owner-v1'
                   AND owner.reservation_payload->>'ownerKey'=request.request_id) AS completion_owner_count,
               run_owner.state AS colliding_run_owner_state
          FROM runtime_completion_requests request
          JOIN internal_production_owner_reservations_v1 run_owner
            ON run_owner.reservation_payload->>'producerImplementationId'='a-runtime-run-v1'
           AND run_owner.reservation_payload->>'ownerKey'=request.request_id
         WHERE request.request_id=${requestId}
      `;
      assert.deepEqual(census.map((row) => ({ ...row })), [{
        request_state: "rejected",
        completion_owner_count: 0,
        colliding_run_owner_state: "bound",
      }]);
    } finally {
      await database.cleanup();
    }
  });

  it("exactly replays a compound prebirth completion rejection without inventing an owner", async () => {
    const database = await createIsolatedTestDatabase();
    try {
      const runId = "run-compound-prebirth-replay";
      const requestId = "RCR_compound-prebirth-replay1";
      const terminationRequestId = "RTR_compound-prebirth-replay1";
      const seeded = await seedManagedClaim(database, runId);
      await publishCompletionInState(database, seeded, "requested", requestId);
      await requestRunTermination(database.sql, {
        runId,
        targetStatus: "cancelled",
        requestedBy: "task6-prebirth-replay",
        diagnostic: "compound rejects the prebirth completion",
        requestId: terminationRequestId,
      });
      const terminations = createRunTerminationRepository(database.sql);
      const claimed = await terminations.claim({
        requestId: terminationRequestId,
        ownerInstanceId: "task6-prebirth-replay",
      });
      assert.equal(claimed?.state, "draining");
      await seeded.sessions.markDrained({
        sessionId: seeded.session.sessionId,
        ownerInstanceId: "spawner-a",
        evidence: DRAIN_EVIDENCE,
      });
      await terminations.markDrained({
        requestId: terminationRequestId,
        ownerInstanceId: "task6-prebirth-replay",
        evidence: { task6PrebirthReplay: true },
      });

      await assert.rejects(
        database.sql.begin(async (transaction) => {
          const identity = createInternalProductionCompletionOwnerCanonicalOwnerIdentityV1({ requestId });
          const reservation = await beginOrAdoptInternalProductionOwnerReservationV1(
            transaction as PgTransactionSql,
            { producerImplementationId: "a-completion-owner-v1", ownerKey: identity.ownerKey },
          );
          await transaction.unsafe(
            `UPDATE internal_production_owner_reservations_v1
                SET owner_key=$2
              WHERE reservation_ref=$1`,
            [reservation.reservationRef, `${requestId}-crossed`],
          );
          await transitionRunToTerminalInTransaction(transaction, {
            runId,
            status: "cancelled",
            diagnostic: "crossed prebirth completion sidecar must reject",
            drainedTerminationRequestId: terminationRequestId,
          });
        }),
        /RUN_TERMINAL_COMPLETION_OWNER_INVALID/,
      );

      const terminal = await terminations.terminalize({ requestId: terminationRequestId });
      assert.equal(terminal.status, "cancelled");
      const replay = await terminations.terminalize({ requestId: terminationRequestId });
      assert.equal(replay.status, "cancelled");
      const census = await database.sql<Array<{
        completion_state: string;
        completion_owner_count: number;
      }>>`
        SELECT request.state AS completion_state,
               (SELECT COUNT(*)::integer
                  FROM internal_production_owner_reservations_v1 owner
                 WHERE owner.category='completion-owner'
                   AND owner.owner_key=request.request_id) AS completion_owner_count
          FROM runtime_completion_requests request
         WHERE request.request_id=${requestId}
      `;
      assert.deepEqual(census.map((row) => ({ ...row })), [{
        completion_state: "rejected",
        completion_owner_count: 0,
      }]);
      await database.sql`
        UPDATE runtime_completion_requests
           SET state='requested',rejected_at=NULL,diagnostic=NULL,result='{}'::jsonb,updated_at=NOW()
         WHERE request_id=${requestId}
      `;
      const historicalCompletionReconciliation = await transitionRunToTerminal(database.sql, {
        runId,
        status: "cancelled",
        diagnostic: "reconcile only historical prebirth completion residue",
        drainedTerminationRequestId: terminationRequestId,
      });
      assert.equal(historicalCompletionReconciliation.closedClaims, 0);
      assert.equal(historicalCompletionReconciliation.closedAttempts, 0);
      const historicalEvents = await database.sql<Array<{
        rejected_completions: number;
        released_runtimes: number;
        changed_steps: number;
        changed_stories: number;
      }>>`
        SELECT (payload->>'rejectedRuntimeCompletions')::integer AS rejected_completions,
               (payload->>'releasedRuntimes')::integer AS released_runtimes,
               (payload->>'changedSteps')::integer AS changed_steps,
               (payload->>'changedStories')::integer AS changed_stories
          FROM operational_outbox
         WHERE aggregate_type='run' AND aggregate_id=${runId}
           AND event_type='run.terminal'
           AND payload->>'reasonCode'='historical_terminal_residue_reconciled'
      `;
      assert.deepEqual(historicalEvents.map((row) => ({ ...row })), [{
        rejected_completions: 1,
        released_runtimes: 0,
        changed_steps: 0,
        changed_stories: 0,
      }]);
      await transitionRunToTerminal(database.sql, {
        runId,
        status: "cancelled",
        diagnostic: "exact historical completion replay",
        drainedTerminationRequestId: terminationRequestId,
      });
      assert.equal((await database.sql<Array<{ count: number }>>`
        SELECT COUNT(*)::integer AS count FROM operational_outbox
         WHERE aggregate_type='run' AND aggregate_id=${runId}
           AND event_type='run.terminal'
           AND payload->>'reasonCode'='historical_terminal_residue_reconciled'
      `)[0]!.count, 1);
    } finally {
      await database.cleanup();
    }
  });

  it("normalizes the exact Task 5 terminal contract before Task 6 accepts the completion", async () => {
    const database = await createIsolatedTestDatabase();
    try {
      const runId = "run-task5-terminal-normalization";
      const requestId = "RCR_task5-terminal-normalize1";
      const seeded = await seedManagedClaim(database, runId);
      await publishCompletionInState(database, seeded, "processing", requestId);
      const completions = createRuntimeCompletionRepository(database.sql);
      const closed = await asRuntimeCompletionOwner(completions, requestId, () => (
        closeClaimAndBoundAttempt(database.sql, {
          claimId: seeded.claimId,
          runId,
          stepId: "implement",
          storyId: "US-001",
          agentId: "feature-dev_developer",
          outcome: "completed",
          diagnostic: "Task 5 terminal contract prefix is canonical",
          abandoned: false,
        })
      ));
      assert.equal(closed.status, "closed");
      await database.sql`
        UPDATE stories SET status='done',claimed_by=NULL,updated_at=NOW()
         WHERE id=${seeded.storyDbId}
      `;
      await database.sql`
        UPDATE steps SET status='done',current_story_id=NULL,updated_at=NOW()
         WHERE id=${seeded.stepDbId}
      `;

      const terminal = await asRuntimeCompletionOwner(
        completions,
        requestId,
        () => transitionRunToTerminal(database.sql, {
          runId,
          status: "completed",
          diagnostic: "Task 5 normalized before Task 6 acceptance",
        }),
      );
      assert.equal(terminal.status, "completed");
      const rows = await database.sql<Array<{
        run_status: string;
        completion_state: string;
        apply_phase: string;
        completion_owner_state: string;
        effect_state: string;
        effect_owner_state: string;
      }>>`
        SELECT run_row.status AS run_status,request.state AS completion_state,
               request.apply_phase,completion_owner.state AS completion_owner_state,
               effect.state AS effect_state,effect_owner.state AS effect_owner_state
          FROM runs run_row
          JOIN runtime_completion_requests request ON request.run_id=run_row.id
          JOIN internal_production_owner_reservations_v1 completion_owner
            ON completion_owner.category='completion-owner'
           AND completion_owner.owner_key=request.request_id
          JOIN runtime_completion_effects effect ON effect.request_id=request.request_id
          JOIN internal_production_owner_reservations_v1 effect_owner
            ON effect_owner.category='mandatory-effect'
           AND effect_owner.owner_key::jsonb->>'requestId'=effect.request_id
           AND effect_owner.owner_key::jsonb->>'effectKey'=effect.effect_key
         WHERE request.request_id=${requestId}
      `;
      assert.deepEqual(rows.map((row) => ({ ...row })), [{
        run_status: "completed",
        completion_state: "accepted",
        apply_phase: "effects_committed",
        completion_owner_state: "closed",
        effect_state: "applied",
        effect_owner_state: "closed",
      }]);
      const replay = await transitionRunToTerminal(database.sql, {
        runId,
        status: "completed",
        diagnostic: "exact terminal replay adopts Task 5 effect close",
      });
      assert.equal(replay.status, "completed");
      await database.sql`
        UPDATE internal_production_owner_reservations_v1
           SET owner_key=jsonb_pretty(owner_key::jsonb)
         WHERE category='mandatory-effect'
           AND owner_key::jsonb->>'requestId'=${requestId}
      `;
      await assert.rejects(
        transitionRunToTerminal(database.sql, {
          runId,
          status: "completed",
          diagnostic: "tampered Task 5 effect close must not replay",
        }),
        /RUN_TERMINAL_MANDATORY_EFFECT_REPLAY_INVALID/,
      );
    } finally {
      await database.cleanup();
    }
  });

  it("keeps a compound-terminal completion owner bound until close-all and rolls the mutation back", async () => {
    const database = await createIsolatedTestDatabase();
    try {
      const runId = "run-completion-compound-barrier";
      const seeded = await seedManagedClaim(database, runId);
      const requestId = "RCR_completion-compound-barrier1";
      await publishCompletionInState(database, seeded, "draining", requestId);

      await assert.rejects(
        database.sql.begin(async (transaction) => {
          await terminalizeRuntimeCompletionForRunInTransactionV1(transaction, {
            requestId,
            runId,
            terminalRunStatus: "cancelled",
            transitionTime: new Date("2026-08-23T00:00:00.000Z"),
          });
          const inside = await transaction.unsafe<Array<{
            completion_state: string;
            owner_state: string;
          }>>(
            `SELECT request.state AS completion_state,owner.state AS owner_state
               FROM runtime_completion_requests request
               JOIN internal_production_owner_reservations_v1 owner
                 ON owner.category='completion-owner' AND owner.owner_key=request.request_id
              WHERE request.request_id=$1`,
            [requestId],
          );
          assert.deepEqual({ ...inside[0] }, {
            completion_state: "rejected",
            owner_state: "bound",
          });
          throw new Error("TEST_TASK6_AFTER_COMPLETION_MUTATION");
        }),
        /TEST_TASK6_AFTER_COMPLETION_MUTATION/,
      );
      const after = await createRuntimeCompletionRepository(database.sql).findById(requestId);
      assert.equal(after?.state, "draining");
      const owners = await database.sql<Array<{ state: string }>>`
        SELECT state FROM internal_production_owner_reservations_v1
         WHERE category='completion-owner' AND owner_key=${requestId}
      `;
      assert.deepEqual(owners.map((row) => ({ ...row })), [{ state: "bound" }]);
    } finally {
      await database.cleanup();
    }
  });

  it("rejects a scalar-key-tampered forbidden owner before optional settlement", async () => {
    const database = await createIsolatedTestDatabase();
    try {
      const prepared = await prepareFocusedCompletionEffect(database, "settle-tamper");
      const identity = createInternalProductionMandatoryEffectCanonicalOwnerIdentityV1({
        requestId: prepared.requestId,
        effectKey: prepared.effectKey,
      });
      await database.sql.begin(async (transaction) => {
        await beginOrAdoptInternalProductionOwnerReservationV1(
          transaction as PgTransactionSql,
          { producerImplementationId: "a-mandatory-effect-v1", ownerKey: identity.ownerKey },
        );
      });
      await database.sql`
        UPDATE internal_production_owner_reservations_v1
           SET owner_key=jsonb_pretty(owner_key::jsonb)
         WHERE reservation_payload->>'producerImplementationId'='a-mandatory-effect-v1'
           AND reservation_payload->>'ownerKey'=${identity.ownerKey}
      `;
      await assert.rejects(
        prepared.effects.settle({
          requestId: prepared.requestId,
          effectKey: prepared.effectKey,
          ownerInstanceId: "optional-manager",
          leaseToken: prepared.effect.leaseToken!,
          resolution: "applied",
          result: { observed: true },
          evidence: { source: "optional-settle-tamper" },
        }),
        /INTERNAL_PRODUCTION_OPTIONAL_EFFECT_OWNER_CORRUPTION/,
      );
      assert.equal((await prepared.effects.listForRequest(prepared.requestId))[0]?.state, "leased");
    } finally {
      await database.cleanup();
    }
  });

  it("rejects a scalar-key-tampered forbidden owner on optional terminal replay", async () => {
    const database = await createIsolatedTestDatabase();
    try {
      const prepared = await prepareFocusedCompletionEffect(database, "replay-tamper");
      const result = { observed: true };
      const evidence = { source: "optional-replay-tamper" };
      const settled = await prepared.effects.settle({
        requestId: prepared.requestId,
        effectKey: prepared.effectKey,
        ownerInstanceId: "optional-manager",
        leaseToken: prepared.effect.leaseToken!,
        resolution: "reconciled",
        result,
        evidence,
      });
      assert.equal(settled.state, "reconciled");
      const identity = createInternalProductionMandatoryEffectCanonicalOwnerIdentityV1({
        requestId: prepared.requestId,
        effectKey: prepared.effectKey,
      });
      await database.sql.begin(async (transaction) => {
        await beginOrAdoptInternalProductionOwnerReservationV1(
          transaction as PgTransactionSql,
          { producerImplementationId: "a-mandatory-effect-v1", ownerKey: identity.ownerKey },
        );
      });
      await database.sql`
        UPDATE internal_production_owner_reservations_v1
           SET owner_key=jsonb_pretty(owner_key::jsonb)
         WHERE reservation_payload->>'producerImplementationId'='a-mandatory-effect-v1'
           AND reservation_payload->>'ownerKey'=${identity.ownerKey}
      `;
      await assert.rejects(
        prepared.effects.settle({
          requestId: prepared.requestId,
          effectKey: prepared.effectKey,
          ownerInstanceId: "ack-loss-owner",
          leaseToken: "ack-loss-token",
          resolution: "reconciled",
          result,
          evidence,
        }),
        /INTERNAL_PRODUCTION_OPTIONAL_EFFECT_OWNER_CORRUPTION/,
      );
      assert.deepEqual(await prepared.effects.listForRequest(prepared.requestId), [settled]);
    } finally {
      await database.cleanup();
    }
  });

  it("excludes an optional effect from compound owner inventory and preserves it byte-for-byte", async () => {
    const database = await createIsolatedTestDatabase();
    try {
      const prepared = await prepareFocusedCompletionEffect(database, "compound-exclusion");
      await database.sql`
        UPDATE steps SET status='done',current_story_id=NULL,updated_at=NOW()
         WHERE id=${prepared.seeded.stepDbId}
      `;
      const completion = await prepared.completions.findById(prepared.requestId);
      assert.ok(completion);
      await prepared.completions.markEffectsCommitted({
        requestId: prepared.requestId,
        ownerInstanceId: "optional-manager",
        ownerAttemptCount: completion.ownerAttemptCount,
        result: { advanced: false, runCompleted: true },
      });
      const before = await task5TerminalSnapshot(database, prepared.requestId);
      const terminal = await asRuntimeCompletionOwner(
        prepared.completions,
        prepared.requestId,
        () => transitionRunToTerminal(database.sql, {
          runId: prepared.seeded.envelope.runId,
          status: "completed",
          diagnostic: "optional effect is outside Task 6 owner inventory",
        }),
      );
      assert.equal(terminal.status, "completed");
      const after = await task5TerminalSnapshot(database, prepared.requestId);
      assert.deepEqual(after.effect_rows, before.effect_rows);
      assert.equal(after.effect_owner_rows, null);
      assert.equal(before.effect_owner_rows, null);
    } finally {
      await database.cleanup();
    }
  });

  it("rolls completion terminal commit failure back and hides post-close state before ACK", async () => {
    const database = await createIsolatedTestDatabase();
    const postgresClient = (await import("postgres")).default;
    const blocker = postgresClient(database.url, { max: 1 });
    let releaseBlocker: (() => void) | undefined;
    try {
      const prepared = await prepareFocusedCompletionEffect(database, "completion-terminal");
      const result = { observed: true };
      await prepared.effects.settle({
        requestId: prepared.requestId,
        effectKey: prepared.effectKey,
        ownerInstanceId: "optional-manager",
        leaseToken: prepared.effect.leaseToken!,
        resolution: "applied",
        result,
        evidence: { source: "completion-terminal" },
      });
      await prepared.completions.markEffectsCommitted({
        requestId: prepared.requestId,
        ownerInstanceId: "optional-manager",
        ownerAttemptCount: (await prepared.completions.findById(prepared.requestId))!.ownerAttemptCount,
        result,
      });
      const before = await task5TerminalSnapshot(database, prepared.requestId);
      await database.sql.unsafe(`
        CREATE FUNCTION task5_completion_terminal_commit_reject_v1() RETURNS trigger
        LANGUAGE plpgsql AS $$ BEGIN
          IF NEW.category='completion-owner' AND NEW.state='closed' THEN
            RAISE EXCEPTION 'TEST_TASK5_COMPLETION_TERMINAL_COMMIT_REJECTED';
          END IF;
          RETURN NEW;
        END $$
      `);
      await database.sql.unsafe(`
        CREATE CONSTRAINT TRIGGER task5_completion_terminal_commit_reject_v1
        AFTER UPDATE OF state ON internal_production_owner_reservations_v1
        DEFERRABLE INITIALLY DEFERRED FOR EACH ROW
        EXECUTE FUNCTION task5_completion_terminal_commit_reject_v1()
      `);
      await assert.rejects(
        prepared.completions.acceptAndRelease({
          requestId: prepared.requestId,
          ownerInstanceId: "optional-manager",
          ownerAttemptCount: (await prepared.completions.findById(prepared.requestId))!.ownerAttemptCount,
          result,
        }),
        /TEST_TASK5_COMPLETION_TERMINAL_COMMIT_REJECTED/,
      );
      assert.deepEqual(await task5TerminalSnapshot(database, prepared.requestId), before);
      await database.sql.unsafe(`
        DROP TRIGGER task5_completion_terminal_commit_reject_v1
        ON internal_production_owner_reservations_v1
      `);

      await database.sql.unsafe("CREATE SEQUENCE task5_completion_terminal_preack_latch_v1");
      await database.sql.unsafe(`
        CREATE FUNCTION task5_completion_terminal_preack_latch_v1() RETURNS trigger
        LANGUAGE plpgsql AS $$ BEGIN
          PERFORM nextval('task5_completion_terminal_preack_latch_v1');
          PERFORM pg_advisory_xact_lock(750052);
          RETURN NEW;
        END $$
      `);
      await database.sql.unsafe(`
        CREATE TRIGGER task5_completion_terminal_preack_latch_v1
        AFTER UPDATE ON internal_production_owner_admission_head_v1
        FOR EACH ROW EXECUTE FUNCTION task5_completion_terminal_preack_latch_v1()
      `);
      let blockerReady!: () => void;
      const ready = new Promise<void>((resolve) => { blockerReady = resolve; });
      const release = new Promise<void>((resolve) => { releaseBlocker = resolve; });
      const held = blocker.begin(async (transaction) => {
        await transaction.unsafe("SELECT pg_advisory_xact_lock(750052)");
        blockerReady();
        await release;
      });
      await ready;
      const accepting = prepared.completions.acceptAndRelease({
        requestId: prepared.requestId,
        ownerInstanceId: "optional-manager",
        ownerAttemptCount: (await prepared.completions.findById(prepared.requestId))!.ownerAttemptCount,
        result,
      });
      for (;;) {
        const latch = await database.sql<Array<{ is_called: boolean }>>`
          SELECT is_called FROM task5_completion_terminal_preack_latch_v1
        `;
        if (latch[0]?.is_called) break;
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
      assert.deepEqual(
        await task5TerminalSnapshot(database, prepared.requestId),
        before,
        "post-close completion state is invisible before commit ACK",
      );
      releaseBlocker();
      releaseBlocker = undefined;
      await held;
      assert.equal((await accepting).state, "accepted");
    } finally {
      releaseBlocker?.();
      await blocker.end({ timeout: 5 });
      await database.cleanup();
    }
  });

  it("rolls mandatory effect terminal commit failure back and hides post-close state before ACK", async () => {
    const database = await createIsolatedTestDatabase();
    const postgresClient = (await import("postgres")).default;
    const blocker = postgresClient(database.url, { max: 1 });
    let releaseBlocker: (() => void) | undefined;
    try {
      const prepared = await prepareFocusedCompletionEffect(database, "effect-terminal", true);
      const result = { observed: true };
      const evidence = { source: "effect-terminal" };
      const before = await task5TerminalSnapshot(database, prepared.requestId);
      await database.sql.unsafe(`
        CREATE FUNCTION task5_effect_terminal_commit_reject_v1() RETURNS trigger
        LANGUAGE plpgsql AS $$ BEGIN
          IF NEW.category='mandatory-effect' AND NEW.state='closed' THEN
            RAISE EXCEPTION 'TEST_TASK5_EFFECT_TERMINAL_COMMIT_REJECTED';
          END IF;
          RETURN NEW;
        END $$
      `);
      await database.sql.unsafe(`
        CREATE CONSTRAINT TRIGGER task5_effect_terminal_commit_reject_v1
        AFTER UPDATE OF state ON internal_production_owner_reservations_v1
        DEFERRABLE INITIALLY DEFERRED FOR EACH ROW
        EXECUTE FUNCTION task5_effect_terminal_commit_reject_v1()
      `);
      await assert.rejects(
        prepared.effects.settle({
          requestId: prepared.requestId,
          effectKey: prepared.effectKey,
          ownerInstanceId: "optional-manager",
          leaseToken: prepared.effect.leaseToken!,
          resolution: "reconciled",
          result,
          evidence,
        }),
        /TEST_TASK5_EFFECT_TERMINAL_COMMIT_REJECTED/,
      );
      assert.deepEqual(await task5TerminalSnapshot(database, prepared.requestId), before);
      await database.sql.unsafe(`
        DROP TRIGGER task5_effect_terminal_commit_reject_v1
        ON internal_production_owner_reservations_v1
      `);

      await database.sql.unsafe("CREATE SEQUENCE task5_effect_terminal_preack_latch_v1");
      await database.sql.unsafe(`
        CREATE FUNCTION task5_effect_terminal_preack_latch_v1() RETURNS trigger
        LANGUAGE plpgsql AS $$ BEGIN
          PERFORM nextval('task5_effect_terminal_preack_latch_v1');
          PERFORM pg_advisory_xact_lock(750053);
          RETURN NEW;
        END $$
      `);
      await database.sql.unsafe(`
        CREATE TRIGGER task5_effect_terminal_preack_latch_v1
        AFTER UPDATE ON internal_production_owner_admission_head_v1
        FOR EACH ROW EXECUTE FUNCTION task5_effect_terminal_preack_latch_v1()
      `);
      let blockerReady!: () => void;
      const ready = new Promise<void>((resolve) => { blockerReady = resolve; });
      const release = new Promise<void>((resolve) => { releaseBlocker = resolve; });
      const held = blocker.begin(async (transaction) => {
        await transaction.unsafe("SELECT pg_advisory_xact_lock(750053)");
        blockerReady();
        await release;
      });
      await ready;
      const settling = prepared.effects.settle({
        requestId: prepared.requestId,
        effectKey: prepared.effectKey,
        ownerInstanceId: "optional-manager",
        leaseToken: prepared.effect.leaseToken!,
        resolution: "reconciled",
        result,
        evidence,
      });
      for (;;) {
        const latch = await database.sql<Array<{ is_called: boolean }>>`
          SELECT is_called FROM task5_effect_terminal_preack_latch_v1
        `;
        if (latch[0]?.is_called) break;
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
      assert.deepEqual(
        await task5TerminalSnapshot(database, prepared.requestId),
        before,
        "post-close mandatory effect state is invisible before commit ACK",
      );
      releaseBlocker();
      releaseBlocker = undefined;
      await held;
      assert.equal((await settling).state, "reconciled");
    } finally {
      releaseBlocker?.();
      await blocker.end({ timeout: 5 });
      await database.cleanup();
    }
  });

  it("keeps claim and product state active until exact runtime drain is accepted", async () => {
    const database = await createIsolatedTestDatabase();
    try {
      const runId = "run-managed-completion";
      const seeded = await seedManagedClaim(database, runId);
      const output = "STATUS: done\nCHANGES: exact scoped delta";
      const requested = await requestRuntimeCompletion(database.sql, {
        envelope: seeded.envelope,
        output,
        requestId: "RCR_managed-completion01",
      });
      assert.equal(requested.status, "requested");
      if (requested.status !== "requested") throw new Error("completion request missing");
      const beforeDrain = await database.sql<Array<{
        claim_outcome: string | null;
        story_status: string;
        step_status: string;
        attempt_disposition: string;
        runtime_state: string;
        request_state: string;
      }>>`
        SELECT cl.outcome AS claim_outcome, st.status AS story_status,
               s.status AS step_status, ea.disposition AS attempt_disposition,
               rs.state AS runtime_state, rcr.state AS request_state
          FROM claim_log cl
          JOIN stories st ON st.run_id = cl.run_id AND st.story_id = cl.story_id
          JOIN steps s ON s.id = ${seeded.stepDbId}
          JOIN execution_attempts ea ON ea.claim_id = cl.id
          JOIN runtime_sessions rs ON rs.claim_id = cl.id
          JOIN runtime_completion_requests rcr ON rcr.claim_id = cl.id
         WHERE cl.id = ${seeded.claimId}
      `;
      assert.deepEqual({ ...beforeDrain[0] }, {
        claim_outcome: null,
        story_status: "running",
        step_status: "running",
        attempt_disposition: "running",
        runtime_state: "drain_requested",
        request_state: "requested",
      });

      const duplicate = await requestRuntimeCompletion(database.sql, {
        envelope: seeded.envelope,
        output,
      });
      assert.equal(duplicate.status, "existing");
      await assert.rejects(
        requestRuntimeCompletion(database.sql, {
          envelope: seeded.envelope,
          output: `${output}\nDIFFERENT: true`,
        }),
        /RUNTIME_COMPLETION_REQUEST_CONFLICT/,
      );

      const completions = createRuntimeCompletionRepository(database.sql);
      const owned = await completions.claim({
        requestId: requested.request.requestId,
        ownerInstanceId: "spawner-a",
      });
      assert.equal(owned?.state, "draining");
      const completionOwner = await database.sql<Array<{
        category: string;
        owner_key: string;
        state: string;
      }>>`
        SELECT category, owner_key, state
          FROM internal_production_owner_reservations_v1
         WHERE producer_implementation_id = 'a-completion-owner-v1'
           AND owner_key = ${requested.request.requestId}
      `;
      assert.deepEqual(completionOwner.map((row) => ({ ...row })), [{
        category: "completion-owner",
        owner_key: requested.request.requestId,
        state: "bound",
      }]);
      await assert.rejects(
        completions.markProcessing({
          requestId: requested.request.requestId,
          ownerInstanceId: "spawner-a",
        }),
        /RUNTIME_COMPLETION_RUNTIME_NOT_DRAINED/,
      );
      await seeded.sessions.markDrained({
        sessionId: seeded.session.sessionId,
        ownerInstanceId: "spawner-a",
        evidence: DRAIN_EVIDENCE,
      });
      assert.equal((await completions.markProcessing({
        requestId: requested.request.requestId,
        ownerInstanceId: "spawner-a",
      })).state, "processing");

      const completionPlan = {
        kind: "story_completion" as const,
        continuation: { type: "story_loop_continue" as const },
        subject: { storyDbId: seeded.storyDbId, storyId: "US-001" },
        effects: [{
          effectKey: "continuation/story/mandatory",
          ordinal: 0,
          effectType: "story.loop.continue",
          mandatory: true,
          payload: { route: "next" },
        }, {
          effectKey: "continuation/story/mandatory-audit",
          ordinal: 1,
          effectType: "story.audit.persist",
          mandatory: true,
          payload: { audit: "completion" },
        }, {
          effectKey: "telemetry/story/optional",
          ordinal: 2,
          effectType: "story.telemetry",
          mandatory: false,
          payload: { metric: "completion" },
        }],
      };
      await asRuntimeCompletionOwner(completions, requested.request.requestId, () => completeStoryClaimAndBoundAttempt(database.sql, {
        envelope: seeded.envelope,
        sourceAfter: { sha: "2".repeat(40), treeHash: "3".repeat(64) },
        outputHash: createHash("sha256").update(output, "utf8").digest("hex"),
        storyStatus: "done",
        storyOutput: output,
        stepStatus: "running",
        stepOutput: output,
        completionPlan,
      }));
      const ownerCommitted = await database.sql<Array<{
        completion_state: string;
        effect_state: string;
        effect_owner_state: string;
      }>>`
        SELECT completion_owner.state AS completion_state,
               effect.state AS effect_state,
               effect_owner.state AS effect_owner_state
          FROM runtime_completion_requests completion
          JOIN internal_production_owner_reservations_v1 completion_owner
            ON completion_owner.producer_implementation_id = 'a-completion-owner-v1'
           AND completion_owner.owner_key = completion.request_id
          JOIN runtime_completion_effects effect
            ON effect.request_id = completion.request_id AND effect.mandatory
          JOIN internal_production_owner_reservations_v1 effect_owner
            ON effect_owner.producer_implementation_id = 'a-mandatory-effect-v1'
           AND effect_owner.category = 'mandatory-effect'
           AND effect_owner.owner_key::jsonb->>'requestId' = effect.request_id
           AND effect_owner.owner_key::jsonb->>'effectKey' = effect.effect_key
         WHERE completion.request_id = ${requested.request.requestId}
      `;
      assert.deepEqual(ownerCommitted.map((row) => ({ ...row })), [{
        completion_state: "bound",
        effect_state: "pending",
        effect_owner_state: "bound",
      }, {
        completion_state: "bound",
        effect_state: "pending",
        effect_owner_state: "bound",
      }]);
      const ownerCensus = await database.sql<Array<{
        effect_count: number;
        mandatory_count: number;
        owner_count: number;
      }>>`
        SELECT (SELECT COUNT(*)::integer FROM runtime_completion_effects
                 WHERE request_id = ${requested.request.requestId}) AS effect_count,
               (SELECT COUNT(*)::integer FROM runtime_completion_effects
                 WHERE request_id = ${requested.request.requestId} AND mandatory) AS mandatory_count,
               (SELECT COUNT(*)::integer FROM internal_production_owner_reservations_v1
                 WHERE producer_implementation_id = 'a-mandatory-effect-v1') AS owner_count
      `;
      assert.deepEqual({ ...ownerCensus[0] }, {
        effect_count: 3,
        mandatory_count: 2,
        owner_count: 2,
      });
      const completionResult = { advanced: false, runCompleted: false };
      await settleCompletionEffects(
        database,
        requested.request.requestId,
        "spawner-a",
        completionResult,
      );
      const afterEffect = await database.sql<Array<{
        completion_state: string;
        effect_state: string;
        effect_owner_state: string;
      }>>`
        SELECT completion_owner.state AS completion_state,
               effect.state AS effect_state,
               effect_owner.state AS effect_owner_state
          FROM runtime_completion_requests completion
          JOIN internal_production_owner_reservations_v1 completion_owner
            ON completion_owner.producer_implementation_id = 'a-completion-owner-v1'
           AND completion_owner.owner_key = completion.request_id
          JOIN runtime_completion_effects effect
            ON effect.request_id = completion.request_id AND effect.mandatory
          JOIN internal_production_owner_reservations_v1 effect_owner
            ON effect_owner.producer_implementation_id = 'a-mandatory-effect-v1'
           AND effect_owner.category = 'mandatory-effect'
           AND effect_owner.owner_key::jsonb->>'requestId' = effect.request_id
           AND effect_owner.owner_key::jsonb->>'effectKey' = effect.effect_key
         WHERE completion.request_id = ${requested.request.requestId}
      `;
      assert.deepEqual(afterEffect.map((row) => ({ ...row })), [{
        completion_state: "bound",
        effect_state: "applied",
        effect_owner_state: "closed",
      }, {
        completion_state: "bound",
        effect_state: "applied",
        effect_owner_state: "closed",
      }]);
      await completions.markEffectsCommitted({
        requestId: requested.request.requestId,
        ownerInstanceId: "spawner-a",
        ownerAttemptCount: (await completions.findById(requested.request.requestId))!.ownerAttemptCount,
        result: completionResult,
      });
      await database.sql.unsafe(`
        CREATE FUNCTION reject_task5_completion_close_v1() RETURNS trigger
        LANGUAGE plpgsql AS $$ BEGIN
          IF OLD.category='completion-owner' AND OLD.state='bound' AND NEW.state='closed' THEN
            RAISE EXCEPTION 'TEST_TASK5_COMPLETION_CLOSE_REJECTED';
          END IF;
          RETURN NEW;
        END $$
      `);
      await database.sql.unsafe(`
        CREATE TRIGGER reject_task5_completion_close_v1
        BEFORE UPDATE OF state ON internal_production_owner_reservations_v1
        FOR EACH ROW EXECUTE FUNCTION reject_task5_completion_close_v1()
      `);
      await assert.rejects(
        completions.acceptAndRelease({
          requestId: requested.request.requestId,
          ownerInstanceId: "spawner-a",
          ownerAttemptCount: (await completions.findById(requested.request.requestId))!.ownerAttemptCount,
          result: completionResult,
        }),
        /TEST_TASK5_COMPLETION_CLOSE_REJECTED/,
      );
      const acceptRolledBack = await database.sql<Array<{
        request_state: string;
        apply_phase: string;
        owner_state: string;
        runtime_state: string;
      }>>`
        SELECT request.state AS request_state,request.apply_phase,
               owner.state AS owner_state,runtime.state AS runtime_state
          FROM runtime_completion_requests request
          JOIN runtime_sessions runtime ON runtime.session_id=request.runtime_session_id
          JOIN internal_production_owner_reservations_v1 owner
            ON owner.category='completion-owner' AND owner.owner_key=request.request_id
         WHERE request.request_id=${requested.request.requestId}
      `;
      assert.deepEqual(acceptRolledBack.map((row) => ({ ...row })), [{
        request_state: "processing",
        apply_phase: "effects_committed",
        owner_state: "bound",
        runtime_state: "drained",
      }]);
      await database.sql.unsafe(`
        DROP TRIGGER reject_task5_completion_close_v1
        ON internal_production_owner_reservations_v1
      `);
      const accepted = await completions.acceptAndRelease({
        requestId: requested.request.requestId,
        ownerInstanceId: "spawner-a",
        ownerAttemptCount: (await completions.findById(requested.request.requestId))!.ownerAttemptCount,
        result: completionResult,
      });
      assert.equal(accepted.state, "accepted");
      const acceptedOwner = await database.sql<Array<{ state: string }>>`
        SELECT state FROM internal_production_owner_reservations_v1
         WHERE producer_implementation_id = 'a-completion-owner-v1'
           AND owner_key = ${requested.request.requestId}
      `;
      assert.deepEqual(acceptedOwner.map((row) => ({ ...row })), [{ state: "closed" }]);
      const acceptedCloseReceipt = (await database.sql<Array<{
        reservation_ref: string;
        reservation_hash: string;
        close_ref: string;
        close_hash: string;
        owner_updated_at: string;
        head_version: string;
        head_hash: string;
      }>>`
        SELECT owner.reservation_ref,owner.reservation_hash,owner.close_ref,owner.close_hash,
               owner.updated_at::text AS owner_updated_at,
               head.head_version::text AS head_version,head.head_hash
          FROM internal_production_owner_reservations_v1 owner
          CROSS JOIN internal_production_owner_admission_head_v1 head
         WHERE owner.category='completion-owner'
           AND owner.owner_key=${requested.request.requestId}
           AND head.singleton
      `)[0]!;
      const acceptedReplay = await completions.acceptAndRelease({
        requestId: requested.request.requestId,
        ownerInstanceId: "ack-loss-retry-does-not-select-owner",
        ownerAttemptCount: accepted.ownerAttemptCount,
        result: completionResult,
      });
      assert.deepEqual(acceptedReplay, accepted);
      const afterAcceptedReplay = (await database.sql<Array<typeof acceptedCloseReceipt>>`
        SELECT owner.reservation_ref,owner.reservation_hash,owner.close_ref,owner.close_hash,
               owner.updated_at::text AS owner_updated_at,
               head.head_version::text AS head_version,head.head_hash
          FROM internal_production_owner_reservations_v1 owner
          CROSS JOIN internal_production_owner_admission_head_v1 head
         WHERE owner.category='completion-owner'
           AND owner.owner_key=${requested.request.requestId}
           AND head.singleton
      `)[0]!;
      assert.deepEqual(
        { ...afterAcceptedReplay },
        { ...acceptedCloseReceipt },
        "terminal ACK-loss replay adopts the exact close without head advance",
      );
      assert.equal((await seeded.sessions.findById(seeded.session.sessionId))?.state, "released");
      const finalOwner = await database.sql<Array<{
        claim_outcome: string;
        attempt_disposition: string;
        story_status: string;
      }>>`
        SELECT cl.outcome AS claim_outcome, ea.disposition AS attempt_disposition,
               st.status AS story_status
          FROM claim_log cl
          JOIN execution_attempts ea ON ea.claim_id = cl.id
          JOIN stories st ON st.run_id = cl.run_id AND st.story_id = cl.story_id
         WHERE cl.id = ${seeded.claimId}
      `;
      assert.deepEqual({ ...finalOwner[0] }, {
        claim_outcome: "completed",
        attempt_disposition: "produced_delta",
        story_status: "done",
      });
      const forbiddenOptionalIdentity = createInternalProductionMandatoryEffectCanonicalOwnerIdentityV1({
        requestId: requested.request.requestId,
        effectKey: "telemetry/story/optional",
      });
      await database.sql.begin(async (transaction) => {
        await beginOrAdoptInternalProductionOwnerReservationV1(
          transaction as PgTransactionSql,
          {
            producerImplementationId: "a-mandatory-effect-v1",
            ownerKey: forbiddenOptionalIdentity.ownerKey,
          },
        );
      });
      await database.sql`
        UPDATE internal_production_owner_reservations_v1
           SET owner_key = jsonb_pretty(owner_key::jsonb)
         WHERE producer_implementation_id = 'a-mandatory-effect-v1'
           AND reservation_payload->>'ownerKey' = ${forbiddenOptionalIdentity.ownerKey}
      `;
      await assert.rejects(
        database.sql.begin((transaction) => markRuntimeCompletionOwnerCommittedInTransaction(
          transaction,
          { claimId: seeded.claimId, claimOutcome: "completed", plan: completionPlan },
        )),
        /INTERNAL_PRODUCTION_(?:MANDATORY_EFFECT_OWNER_CORRUPTION|OPTIONAL_EFFECT_OWNER_FORBIDDEN)/,
      );
    } finally {
      await database.cleanup();
    }
  });

  it("rejects caller-asserted compiler evidence before publishing any runtime drain", async () => {
    const database = await createIsolatedTestDatabase();
    try {
      const seeded = await seedManagedClaim(database, "run-compiled-completion-submission", "v3");
      const output = "{\"schema\":\"setfarm.v3-implementation-agent-proposal.v1\"}";
      const outputHash = createHash("sha256").update(output, "utf8").digest("hex");
      const forgedInput = {
        envelope: seeded.envelope,
        output,
        submissionEvidence: {
          schema: "setfarm.runtime-completion-submission-evidence.v1" as const,
          compiler: "setfarm.v3-implementation-output-compilation.v1" as const,
          sourceSchema: "setfarm.v3-implementation-agent-output.v1" as const,
          sourceProposalHash: outputHash,
          canonicalOutputHash: outputHash,
          ignoredFieldPaths: ["/commands"],
        },
        sourceProposal: output,
      };
      await assert.rejects(
        requestRuntimeCompletion(database.sql, forgedInput),
        /RUNTIME_COMPLETION_CALLER_COMPILER_EVIDENCE_NOT_AUTHORIZED/,
      );
      await assert.rejects(
        requestRuntimeCompletion(database.sql, {
          envelope: seeded.envelope,
          output,
        }),
        /invalid_union|Invalid input/i,
      );
      const untouched = await database.sql<Array<{ request_count: number; runtime_state: string }>>`
        SELECT (SELECT COUNT(*)::integer FROM runtime_completion_requests WHERE claim_id = ${seeded.claimId}) AS request_count,
               state AS runtime_state
          FROM runtime_sessions
         WHERE claim_id = ${seeded.claimId}
      `;
      assert.deepEqual({ ...untouched[0] }, { request_count: 0, runtime_state: "running" });
    } finally {
      await database.cleanup();
    }
  });

  it("keeps the compiler receipt schema strict and hash-bound", () => {
    const evidence = {
      schema: "setfarm.runtime-completion-submission-evidence.v1" as const,
        compiler: "setfarm.v3-implementation-output-compilation.v1" as const,
        sourceSchema: "setfarm.v3-implementation-agent-output.v1" as const,
        sourceProposalHash: "a".repeat(64),
        canonicalOutputHash: "b".repeat(64),
        ignoredFieldPaths: ["/commands"],
    };
    assert.deepEqual(
      RuntimeCompletionSubmissionEvidenceV1Schema.parse(evidence),
      evidence,
    );
    assert.throws(
      () => RuntimeCompletionSubmissionEvidenceV1Schema.parse({
        ...evidence,
        ignoredFieldPaths: ["/z", "/a"],
      }),
      /canonical/i,
    );
  });

  it("fails closed before publication when a managed v3 runtime owner is missing", async () => {
    const database = await createIsolatedTestDatabase();
    try {
      const seeded = await seedManagedClaim(database, "run-v3-missing-runtime-owner", "v3");
      const envelope = seeded.envelope;
      const output = JSON.stringify({
        schema: "setfarm.v3-implementation-agent-proposal.v1",
        disposition: "ready_for_evidence",
        handoffHash: "a".repeat(64),
        attemptId: envelope.attempt!.attemptId,
        packetHash: "b".repeat(64),
        sliceHash: "c".repeat(64),
        sourceBefore: { sha: "d".repeat(40), treeHash: "e".repeat(64) },
        summary: "bounded transport proposal",
        changes: [{ path: "src/App.tsx", summary: "exact" }],
      });
      await database.sql`DELETE FROM runtime_sessions WHERE claim_id = ${seeded.claimId}`;

      await assert.rejects(
        requestRuntimeCompletion(database.sql, { envelope, output }),
        /RUNTIME_COMPLETION_MANAGED_RUNTIME_REQUIRED/,
      );
      const state = await database.sql<Array<{
        completion_count: number;
        claim_outcome: string | null;
        story_status: string;
        step_status: string;
        attempt_disposition: string;
      }>>`
        SELECT (SELECT COUNT(*)::integer FROM runtime_completion_requests WHERE claim_id = cl.id) AS completion_count,
               cl.outcome AS claim_outcome, st.status AS story_status, s.status AS step_status,
               ea.disposition AS attempt_disposition
          FROM claim_log cl
          JOIN stories st ON st.run_id = cl.run_id AND st.story_id = cl.story_id
          JOIN steps s ON s.id = ${seeded.stepDbId}
          JOIN execution_attempts ea ON ea.claim_id = cl.id
         WHERE cl.id = ${seeded.claimId}
      `;
      assert.deepEqual({ ...state[0] }, {
        completion_count: 0,
        claim_outcome: null,
        story_status: "running",
        step_status: "running",
        attempt_disposition: "running",
      });
    } finally {
      await database.cleanup();
    }
  });

  it("lets canonical cancellation preempt a requested completion without mixed ownership", async () => {
    const database = await createIsolatedTestDatabase();
    try {
      const runId = "run-complete-cancel-race";
      const seeded = await seedManagedClaim(database, runId);
      const completion = await requestRuntimeCompletion(database.sql, {
        envelope: seeded.envelope,
        output: "STATUS: done\nCHANGES: pending acceptance",
        requestId: "RCR_complete-cancel-race1",
      });
      if (completion.status !== "requested") throw new Error("completion request missing");
      const cancellation = await requestRunTermination(database.sql, {
        runId,
        targetStatus: "cancelled",
        requestedBy: "cli-user",
        diagnostic: "operator cancellation won before completion acceptance",
        requestId: "RTR_complete-cancel-race1",
      });
      if (cancellation.status !== "requested") throw new Error("termination request missing");
      const terminations = createRunTerminationRepository(database.sql);
      await terminations.claim({
        requestId: cancellation.request.requestId,
        ownerInstanceId: "spawner-a",
      });
      await seeded.sessions.markDrained({
        sessionId: seeded.session.sessionId,
        ownerInstanceId: "spawner-a",
        evidence: DRAIN_EVIDENCE,
      });
      await terminations.markDrained({
        requestId: cancellation.request.requestId,
        ownerInstanceId: "spawner-a",
      });
      await terminations.terminalize({ requestId: cancellation.request.requestId });

      const rows = await database.sql<Array<{
        run_status: string;
        claim_outcome: string;
        attempt_disposition: string;
        runtime_state: string;
        completion_state: string;
        termination_state: string;
      }>>`
        SELECT r.status AS run_status, cl.outcome AS claim_outcome,
               ea.disposition AS attempt_disposition, rs.state AS runtime_state,
               rcr.state AS completion_state, rtr.state AS termination_state
          FROM runs r
          JOIN claim_log cl ON cl.run_id = r.id
          JOIN execution_attempts ea ON ea.claim_id = cl.id
          JOIN runtime_sessions rs ON rs.claim_id = cl.id
          JOIN runtime_completion_requests rcr ON rcr.claim_id = cl.id
          JOIN run_termination_requests rtr ON rtr.run_id = r.id
         WHERE r.id = ${runId}
      `;
      assert.deepEqual({ ...rows[0] }, {
        run_status: "cancelled",
        claim_outcome: "cancelled",
        attempt_disposition: "inconclusive",
        runtime_state: "released",
        completion_state: "rejected",
        termination_state: "terminalized",
      });
    } finally {
      await database.cleanup();
    }
  });

  it("rolls requested rejection back when an unexpected completion sidecar exists", async () => {
    const database = await createIsolatedTestDatabase();
    try {
      const runId = "run-requested-sidecar-reject";
      const seeded = await seedManagedClaim(database, runId);
      const completion = await requestRuntimeCompletion(database.sql, {
        envelope: seeded.envelope,
        output: "STATUS: done\nCHANGES: reject unexpected sidecar",
        requestId: "RCR_requested-sidecar-reject1",
      });
      if (completion.status !== "requested") throw new Error("completion request missing");
      const identity = createInternalProductionCompletionOwnerCanonicalOwnerIdentityV1({
        requestId: completion.request.requestId,
      });
      await database.sql.begin(async (transaction) => {
        await beginOrAdoptInternalProductionOwnerReservationV1(
          transaction as PgTransactionSql,
          { producerImplementationId: "a-completion-owner-v1", ownerKey: identity.ownerKey },
        );
      });
      await database.sql`
        UPDATE internal_production_owner_reservations_v1
           SET owner_key = jsonb_pretty(to_jsonb(owner_key))
         WHERE producer_implementation_id = 'a-completion-owner-v1'
           AND reservation_payload->>'ownerKey' = ${completion.request.requestId}
      `;
      await requestRunTermination(database.sql, {
        runId,
        targetStatus: "cancelled",
        requestedBy: "cli-user",
        diagnostic: "reject requested completion",
        requestId: "RTR_requested-sidecar-reject1",
      });

      await assert.rejects(
        createRuntimeCompletionRepository(database.sql).preemptForRunTermination({
          requestId: completion.request.requestId,
          diagnostic: "termination owns rejection",
        }),
        /INTERNAL_PRODUCTION_COMPLETION_OWNER_(?:ADOPTION_INVALID|CORRUPTION|OWNER_UNAVAILABLE|UNAVAILABLE)/,
      );
      const state = await database.sql<Array<{
        request_state: string;
        owner_state: string;
        owner_key_is_canonical: boolean;
      }>>`
        SELECT request.state AS request_state, owner.state AS owner_state,
               owner.owner_key = request.request_id AS owner_key_is_canonical
          FROM runtime_completion_requests request
          JOIN internal_production_owner_reservations_v1 owner
            ON owner.producer_implementation_id = 'a-completion-owner-v1'
           AND owner.reservation_payload->>'ownerKey' = request.request_id
         WHERE request.request_id = ${completion.request.requestId}
      `;
      assert.deepEqual(state.map((row) => ({ ...row })), [{
        request_state: "requested",
        owner_state: "pending",
        owner_key_is_canonical: false,
      }]);
    } finally {
      await database.cleanup();
    }
  });

  it("rolls preempt and repository-quarantine writers back when completion close rejects", async () => {
    const database = await createIsolatedTestDatabase();
    try {
      const preemptRunId = "run-preempt-close-rollback";
      const preemptSeed = await seedManagedSingleStepClaim(database, preemptRunId);
      const preempt = await publishCompletionInState(
        database,
        preemptSeed,
        "draining",
        "RCR_preempt-close-rollback1",
      );
      await requestRunTermination(database.sql, {
        runId: preemptRunId,
        targetStatus: "cancelled",
        requestedBy: "task5-test",
        diagnostic: "preempt close rollback",
        requestId: "RTR_preempt-close-rollback1",
      });
      await installCompletionCloseRejection(database, "preempt_quarantine_v1");
      await assert.rejects(
        createRuntimeCompletionRepository(database.sql).preemptForRunTermination({
          requestId: preempt.requestId,
          diagnostic: "preempt must close atomically",
        }),
        /TEST_TASK5_COMPLETION_CLOSE_REJECTED/,
      );
      assert.deepEqual(await completionAndOwnerState(database, preempt.requestId), {
        request_state: "draining",
        owner_state: "bound",
      });

      const quarantineRunId = "run-quarantine-close-rollback";
      const quarantineSeed = await seedManagedSingleStepClaim(database, quarantineRunId);
      const quarantine = await publishCompletionInState(
        database,
        quarantineSeed,
        "draining",
        "RCR_quarantine-close-rollback1",
      );
      const repository = createRuntimeCompletionRepository(database.sql);
      const draining = await repository.findById(quarantine.requestId);
      if (!draining?.ownerInstanceId || !draining.leaseExpiresAt) {
        throw new Error("test draining owner missing");
      }
      await assert.rejects(
        repository.quarantine({
          requestId: quarantine.requestId,
          ownerInstanceId: draining.ownerInstanceId,
          expectedState: "draining",
          expectedLeaseExpiresAt: draining.leaseExpiresAt,
          expectedUpdatedAt: draining.updatedAt,
          diagnostic: "quarantine must close atomically",
        }),
        /TEST_TASK5_COMPLETION_CLOSE_REJECTED/,
      );
      assert.deepEqual(await completionAndOwnerState(database, quarantine.requestId), {
        request_state: "draining",
        owner_state: "bound",
      });
    } finally {
      await database.cleanup();
    }
  });

  it("rolls recovery quarantine back when completion close rejects", async () => {
    const database = await createIsolatedTestDatabase();
    try {
      const runId = "run-recovery-quarantine-close";
      const seeded = await seedManagedSingleStepClaim(database, runId);
      const completion = await publishCompletionInState(
        database,
        seeded,
        "processing",
        "RCR_recovery-quarantine-close1",
      );
      await expireRuntimeCompletionLease(database, completion.requestId);
      const expired = await createRuntimeCompletionRepository(database.sql).findById(completion.requestId);
      if (!expired?.ownerInstanceId || !expired.leaseExpiresAt) throw new Error("expired owner missing");
      await installCompletionCloseRejection(database, "recovery_quarantine_v1");
      await assert.rejects(
        database.sql.begin((transaction) => quarantineExpiredRuntimeCompletionForRecoveryInTransaction(
          transaction,
          {
            requestId: completion.requestId,
            expectedOwnerInstanceId: expired.ownerInstanceId!,
            expectedLeaseExpiresAt: expired.leaseExpiresAt!,
            expectedUpdatedAt: expired.updatedAt,
            expectedApplyPhase: expired.applyPhase,
            diagnostic: "recovery quarantine must close atomically",
          },
        )),
        /TEST_TASK5_COMPLETION_CLOSE_REJECTED/,
      );
      assert.deepEqual(await completionAndOwnerState(database, completion.requestId), {
        request_state: "processing",
        owner_state: "bound",
      });
    } finally {
      await database.cleanup();
    }
  });

  it("rolls expired-processing rejection back when completion close rejects", async () => {
    const database = await createIsolatedTestDatabase();
    try {
      const runId = "run-recovery-reject-close";
      const seeded = await seedManagedSingleStepClaim(database, runId);
      const completion = await publishCompletionInState(
        database,
        seeded,
        "processing",
        "RCR_recovery-reject-close01",
      );
      await requestRunTermination(database.sql, {
        runId,
        targetStatus: "cancelled",
        requestedBy: "task5-test",
        diagnostic: "recovery rejection close rollback",
        requestId: "RTR_recovery-reject-close01",
      });
      await expireRuntimeCompletionLease(database, completion.requestId);
      await installCompletionCloseRejection(database, "recovery_reject_v1");
      await assert.rejects(
        createRuntimeCompletionRepository(database.sql).recoverExpiredProcessing({
          ownerInstanceId: "recovery-close-test",
        }),
        /TEST_TASK5_COMPLETION_CLOSE_REJECTED/,
      );
      assert.deepEqual(await completionAndOwnerState(database, completion.requestId), {
        request_state: "processing",
        owner_state: "bound",
      });
    } finally {
      await database.cleanup();
    }
  });

  it("rolls the terminal-run bulk rejection writer back when completion close rejects", async () => {
    const database = await createIsolatedTestDatabase();
    try {
      const runId = "run-bulk-reject-close-rollback";
      const seeded = await seedManagedSingleStepClaim(database, runId);
      const completion = await publishCompletionInState(
        database,
        seeded,
        "draining",
        "RCR_bulk-reject-close-rollback1",
      );
      await installCompletionCloseRejection(database, "bulk_reject_v1");
      await assert.rejects(
        database.sql.begin((transaction) => rejectRuntimeCompletionsForTerminalRunInTransaction(
          transaction,
          { runId, diagnostic: "bulk rejection must close atomically" },
        )),
        /TEST_TASK5_COMPLETION_CLOSE_REJECTED/,
      );
      assert.deepEqual(await completionAndOwnerState(database, completion.requestId), {
        request_state: "draining",
        owner_state: "bound",
      });
    } finally {
      await database.cleanup();
    }
  });

  it("elects only one run-scoped drain owner when cancellation races a claimed completion", async () => {
    const database = await createIsolatedTestDatabase();
    try {
      const runId = "run-completion-drain-cancel-race";
      const seeded = await seedManagedClaim(database, runId);
      const completion = await requestRuntimeCompletion(database.sql, {
        envelope: seeded.envelope,
        output: "STATUS: done\nCHANGES: drain ownership race",
        requestId: "RCR_completion-drain-race1",
      });
      if (completion.status !== "requested") throw new Error("completion request missing");
      const cancellation = await requestRunTermination(database.sql, {
        runId,
        targetStatus: "cancelled",
        requestedBy: "cli-user",
        diagnostic: "operator cancellation raced completion drain ownership",
        requestId: "RTR_completion-drain-race1",
      });
      if (cancellation.status !== "requested") throw new Error("termination request missing");

      const completions = createRuntimeCompletionRepository(database.sql);
      const terminations = createRunTerminationRepository(database.sql);
      const [completionOwner, terminationOwner] = await Promise.all([
        completions.claim({
          requestId: completion.request.requestId,
          ownerInstanceId: "completion-manager",
        }),
        terminations.claim({
          requestId: cancellation.request.requestId,
          ownerInstanceId: "termination-manager",
        }),
      ]);

      assert.equal(
        Number(completionOwner !== undefined) + Number(terminationOwner !== undefined),
        1,
        "completion and cancellation must never both acquire run-scoped drain ownership",
      );
      const owners = await database.sql<Array<{
        completion_state: string;
        termination_state: string;
      }>>`
        SELECT rcr.state AS completion_state, rtr.state AS termination_state
          FROM runtime_completion_requests rcr
          JOIN run_termination_requests rtr ON rtr.run_id = rcr.run_id
         WHERE rcr.request_id = ${completion.request.requestId}
           AND rtr.request_id = ${cancellation.request.requestId}
      `;
      const states = [owners[0]?.completion_state, owners[0]?.termination_state];
      assert.equal(
        states.filter((state) => state === "draining" || state === "processing").length,
        1,
        "the durable request rows must name exactly one active drain owner",
      );
      assert.equal(states.includes("quarantined"), false);
    } finally {
      await database.cleanup();
    }
  });

  it("durably defers cancellation during completion processing and then lets cancellation win", async () => {
    const database = await createIsolatedTestDatabase();
    try {
      const runId = "run-processing-cancel";
      const seeded = await seedManagedClaim(database, runId);
      const requested = await requestRuntimeCompletion(database.sql, {
        envelope: seeded.envelope,
        output: "STATUS: done\nCHANGES: processing race",
        requestId: "RCR_processing-cancel01",
      });
      if (requested.status !== "requested") throw new Error("completion request missing");
      const completions = createRuntimeCompletionRepository(database.sql);
      await completions.claim({
        requestId: requested.request.requestId,
        ownerInstanceId: "spawner-a",
      });
      await seeded.sessions.markDrained({
        sessionId: seeded.session.sessionId,
        ownerInstanceId: "spawner-a",
        evidence: DRAIN_EVIDENCE,
      });
      await completions.markProcessing({
        requestId: requested.request.requestId,
        ownerInstanceId: "spawner-a",
      });

      const cancellation = await requestRunTermination(database.sql, {
        runId,
        targetStatus: "cancelled",
        requestedBy: "cli-user",
        diagnostic: "cancel while completion coordinator is processing",
        requestId: "RTR_processing-cancel01",
      });
      if (cancellation.status !== "requested") throw new Error("termination request missing");
      assert.equal((await database.sql<Array<{ status: string }>>`
        SELECT status FROM runs WHERE id = ${runId}
      `)[0]?.status, "running");
      const terminations = createRunTerminationRepository(database.sql);
      assert.equal(await terminations.claim({
        requestId: cancellation.request.requestId,
        ownerInstanceId: "spawner-a",
      }), undefined);
      await assert.rejects(
        completeStoryClaimAndBoundAttempt(database.sql, {
          envelope: seeded.envelope,
          sourceAfter: { sha: "2".repeat(40), treeHash: "3".repeat(64) },
          storyStatus: "done",
          storyOutput: "STATUS: done",
          stepStatus: "running",
          stepOutput: "STATUS: done",
        }),
        /CLAIM_MUTATION_DURABLE_OWNER_ACTIVE:run_termination:requested:/,
      );
      const preempted = await completions.preemptForRunTermination({
        requestId: requested.request.requestId,
        diagnostic: "Completion preempted by canonical cancellation",
      });
      assert.equal(preempted.status, "preempted");
      assert.equal((await terminations.claim({
        requestId: cancellation.request.requestId,
        ownerInstanceId: "spawner-a",
      }))?.state, "draining");
      assert.equal((await database.sql<Array<{ status: string }>>`
        SELECT status FROM runs WHERE id = ${runId}
      `)[0]?.status, "cancelling");
      await terminations.markDrained({
        requestId: cancellation.request.requestId,
        ownerInstanceId: "spawner-a",
      });
      await terminations.terminalize({ requestId: cancellation.request.requestId });
      const final = await database.sql<Array<{
        run_status: string;
        completion_state: string;
        termination_state: string;
        completion_owner_state: string;
      }>>`
        SELECT r.status AS run_status, rcr.state AS completion_state,
               rtr.state AS termination_state,owner.state AS completion_owner_state
          FROM runs r
          JOIN runtime_completion_requests rcr ON rcr.run_id = r.id
          JOIN run_termination_requests rtr ON rtr.run_id = r.id
          JOIN internal_production_owner_reservations_v1 owner
            ON owner.category='completion-owner' AND owner.owner_key=rcr.request_id
         WHERE r.id = ${runId}
      `;
      assert.deepEqual({ ...final[0] }, {
        run_status: "cancelled",
        completion_state: "rejected",
        termination_state: "terminalized",
        completion_owner_state: "closed",
      });
    } finally {
      await database.cleanup();
    }
  });

  it("fences single-step completion after canonical cancellation is requested", async () => {
    const database = await createIsolatedTestDatabase();
    try {
      const runId = "run-single-step-cancel-fence";
      const seeded = await seedManagedSingleStepClaim(database, runId);
      const cancellation = await requestRunTermination(database.sql, {
        runId,
        targetStatus: "cancelled",
        requestedBy: "cli-user",
        diagnostic: "cancel before the single-step worker publishes completion",
        requestId: "RTR_single-step-cancel01",
      });
      assert.equal(cancellation.status, "requested");

      await assert.rejects(
        completeSingleStepClaimAndState(database.sql, {
          envelope: seeded.envelope,
          stepStatus: "done",
          stepOutput: "STATUS: done\nSUMMARY: stale worker output",
        }),
        /CLAIM_MUTATION_DURABLE_OWNER_ACTIVE:run_termination:requested:|SINGLE_STEP_CLAIM_RUN_NOT_ACTIVE/,
      );
      const state = await database.sql<Array<{
        claim_outcome: string | null;
        step_status: string;
        run_status: string;
      }>>`
        SELECT cl.outcome AS claim_outcome, s.status AS step_status,
               r.status AS run_status
          FROM claim_log cl
          JOIN steps s ON s.id = ${seeded.stepDbId}
          JOIN runs r ON r.id = cl.run_id
         WHERE cl.id = ${seeded.claimId}
      `;
      assert.deepEqual({ ...state[0] }, {
        claim_outcome: null,
        step_status: "running",
        run_status: "cancelling",
      });
    } finally {
      await database.cleanup();
    }
  });

  it("keeps a processing completion authoritative when its result terminally fails the run", async () => {
    const database = await createIsolatedTestDatabase();
    try {
      const runId = "run-processing-terminal-failure";
      const seeded = await seedManagedSingleStepClaim(database, runId);
      const requested = await requestRuntimeCompletion(database.sql, {
        envelope: seeded.envelope,
        output: "STATUS: failed\nERROR: acceptance gate failed",
        requestId: "RCR_processing-failure01",
      });
      if (requested.status !== "requested") throw new Error("completion request missing");
      const completions = createRuntimeCompletionRepository(database.sql);
      await completions.claim({
        requestId: requested.request.requestId,
        ownerInstanceId: "spawner-a",
      });
      await seeded.sessions.markDrained({
        sessionId: seeded.session.sessionId,
        ownerInstanceId: "spawner-a",
        evidence: DRAIN_EVIDENCE,
      });
      await completions.markProcessing({
        requestId: requested.request.requestId,
        ownerInstanceId: "spawner-a",
      });

      const failure = await asRuntimeCompletionOwner(completions, requested.request.requestId, () => database.sql.begin(async (transaction) => {
        await closeExactSingleStepClaimInTransaction(transaction, {
          envelope: seeded.envelope,
          outcome: "failed",
          diagnostic: "completion-owned acceptance gate failed",
        });
        await transaction.unsafe(
          "UPDATE steps SET status = 'failed', output = $2, updated_at = NOW() WHERE id = $1",
          [seeded.stepDbId, "completion-owned acceptance gate failed"],
        );
        await markRuntimeCompletionOwnerCommittedInTransaction(transaction, {
          claimId: seeded.claimId,
          claimOutcome: "failed",
          plan: createSingleEffectCompletionPlanDescriptorV1({
            kind: "single_failure",
            continuation: { type: "failure_finalize" },
            effectPayload: { runTerminal: true },
          }),
        });
        return requestRunTerminationInTransaction(transaction, {
          runId,
          targetStatus: "failed",
          requestedBy: "runtime-completion-test",
          diagnostic: "completion-owned acceptance gate failed",
        });
      }));
      assert.equal(failure.status, "requested");
      const completionResult = { advanced: false, runCompleted: false, runFailed: true };
      await settleCompletionEffects(database, requested.request.requestId, "spawner-a", completionResult);
      await completions.markEffectsCommitted({
        requestId: requested.request.requestId,
        ownerInstanceId: "spawner-a",
        ownerAttemptCount: (await completions.findById(requested.request.requestId))!.ownerAttemptCount,
        result: completionResult,
      });
      let completionAfterFailure = await completions.acceptAndRelease({
        requestId: requested.request.requestId,
        ownerInstanceId: "spawner-a",
        ownerAttemptCount: (await completions.findById(requested.request.requestId))!.ownerAttemptCount,
        result: completionResult,
      });
      assert.equal(completionAfterFailure?.state, "accepted");
      assert.equal((await seeded.sessions.findById(seeded.session.sessionId))?.state, "released");

      if (failure.status !== "requested") throw new Error("failure request missing");
      const terminations = createRunTerminationRepository(database.sql);
      await terminations.claim({
        requestId: failure.request.requestId,
        ownerInstanceId: "termination-manager",
      });
      await terminations.markDrained({
        requestId: failure.request.requestId,
        ownerInstanceId: "termination-manager",
      });
      await terminations.terminalize({ requestId: failure.request.requestId });
      assert.equal((await database.sql<Array<{ status: string }>>`
        SELECT status FROM runs WHERE id = ${runId}
      `)[0]?.status, "failed");
    } finally {
      await database.cleanup();
    }
  });

  it("returns the durable accepted result when identical completion is replayed after run terminalization", async () => {
    const database = await createIsolatedTestDatabase();
    try {
      const runId = "run-terminal-completion-replay";
      const seeded = await seedManagedSingleStepClaim(database, runId);
      const output = "STATUS: done\nSUMMARY: exact accepted completion";
      const requested = await requestRuntimeCompletion(database.sql, {
        envelope: seeded.envelope,
        output,
        requestId: "RCR_terminal-replay001",
      });
      if (requested.status !== "requested") throw new Error("completion request missing");
      const completions = createRuntimeCompletionRepository(database.sql);
      await completions.claim({
        requestId: requested.request.requestId,
        ownerInstanceId: "spawner-a",
      });
      await seeded.sessions.markDrained({
        sessionId: seeded.session.sessionId,
        ownerInstanceId: "spawner-a",
        evidence: DRAIN_EVIDENCE,
      });
      await completions.markProcessing({
        requestId: requested.request.requestId,
        ownerInstanceId: "spawner-a",
      });
      await asRuntimeCompletionOwner(completions, requested.request.requestId, () => completeSingleStepClaimAndState(database.sql, {
        envelope: seeded.envelope,
        stepStatus: "done",
        stepOutput: output,
      }));
      const completionResult = { advanced: true, runCompleted: true };
      await settleCompletionEffects(
        database,
        requested.request.requestId,
        "spawner-a",
        completionResult,
      );
      await completions.markEffectsCommitted({
        requestId: requested.request.requestId,
        ownerInstanceId: "spawner-a",
        ownerAttemptCount: (await completions.findById(requested.request.requestId))!.ownerAttemptCount,
        result: completionResult,
      });
      await completions.acceptAndRelease({
        requestId: requested.request.requestId,
        ownerInstanceId: "spawner-a",
        ownerAttemptCount: (await completions.findById(requested.request.requestId))!.ownerAttemptCount,
        result: completionResult,
      });
      await transitionRunToTerminal(database.sql, {
        runId,
        status: "completed",
        diagnostic: "all work accepted",
      });

      const replay = await requestRuntimeCompletion(database.sql, {
        envelope: seeded.envelope,
        output,
      });
      assert.equal(replay.status, "existing");
      if (replay.status !== "existing") throw new Error("durable completion replay missing");
      assert.equal(replay.request.state, "accepted");
      assert.deepEqual(replay.request.result, { advanced: true, runCompleted: true });
    } finally {
      await database.cleanup();
    }
  });

  it("does not grant cancellation a second drain owner after completion already claimed the run", async () => {
    const database = await createIsolatedTestDatabase();
    try {
      const runId = "run-after-completion-claim-race";
      const seeded = await seedManagedClaim(database, runId);
      const completion = await requestRuntimeCompletion(database.sql, {
        envelope: seeded.envelope,
        output: "STATUS: done\nCHANGES: completion already owns drain",
        requestId: "RCR_after-claim-race001",
      });
      if (completion.status !== "requested") throw new Error("completion request missing");
      const completions = createRuntimeCompletionRepository(database.sql);
      assert.equal((await completions.claim({
        requestId: completion.request.requestId,
        ownerInstanceId: "completion-manager",
      }))?.state, "draining");

      const cancellation = await requestRunTermination(database.sql, {
        runId,
        targetStatus: "cancelled",
        requestedBy: "cli-user",
        diagnostic: "cancellation arrived after completion acquired drain ownership",
        requestId: "RTR_after-claim-race001",
      });
      if (cancellation.status !== "requested") throw new Error("termination request missing");
      const terminationOwner = await createRunTerminationRepository(database.sql).claim({
        requestId: cancellation.request.requestId,
        ownerInstanceId: "termination-manager",
      });

      assert.equal(
        terminationOwner,
        undefined,
        "a committed draining completion must remain the sole run-scoped drain owner until it yields or reaches a durable phase boundary",
      );
    } finally {
      await database.cleanup();
    }
  });

  it("serializes cancellation behind the completion owner that already holds the canonical run lock", async () => {
    const database = await createIsolatedTestDatabase();
    let releaseClaimTableLock: (() => void) | undefined;
    let tableLocker: Promise<unknown> | undefined;
    try {
      const runId = "run-single-step-lock-barrier";
      const seeded = await seedManagedSingleStepClaim(database, runId);
      const completionRequest = await requestRuntimeCompletion(database.sql, {
        envelope: seeded.envelope,
        output: "STATUS: done\nSUMMARY: raced by deferred cancellation",
        requestId: "RCR_single-step-barrier1",
      });
      if (completionRequest.status !== "requested") throw new Error("completion request missing");
      const completions = createRuntimeCompletionRepository(database.sql);
      await completions.claim({
        requestId: completionRequest.request.requestId,
        ownerInstanceId: "completion-manager",
      });
      await seeded.sessions.markDrained({
        sessionId: seeded.session.sessionId,
        ownerInstanceId: "spawner-a",
        evidence: DRAIN_EVIDENCE,
      });
      await completions.markProcessing({
        requestId: completionRequest.request.requestId,
        ownerInstanceId: "completion-manager",
      });

      let claimTableLocked!: () => void;
      const claimTableLockReady = new Promise<void>((resolve) => { claimTableLocked = resolve; });
      const holdClaimTableLock = new Promise<void>((resolve) => { releaseClaimTableLock = resolve; });
      tableLocker = database.sql.begin(async (transaction) => {
        await transaction.unsafe("LOCK TABLE claim_log IN ACCESS EXCLUSIVE MODE");
        claimTableLocked();
        await holdClaimTableLock;
      });
      await claimTableLockReady;

      const completion = asRuntimeCompletionOwner(completions, completionRequest.request.requestId, () => completeSingleStepClaimAndState(database.sql, {
        envelope: seeded.envelope,
        stepStatus: "done",
        stepOutput: "STATUS: done\nSUMMARY: raced by deferred cancellation",
      }));
      void completion.catch(() => {});
      await waitForBlockedClaimTransition(database);

      const cancellationPromise = requestRunTermination(database.sql, {
        runId,
        targetStatus: "cancelled",
        requestedBy: "cli-user",
        diagnostic: "requested after the completion owner acquired the canonical run lock",
        requestId: "RTR_single-step-barrier1",
      });
      await waitForBlockedTerminationPublication(database);

      releaseClaimTableLock();
      releaseClaimTableLock = undefined;
      await tableLocker;
      await completion;

      const cancellation = await cancellationPromise;
      assert.equal(cancellation.status, "requested");
      assert.equal((await database.sql<Array<{ outcome: string | null }>>`
        SELECT outcome FROM claim_log WHERE id = ${seeded.claimId}
      `)[0]?.outcome, "completed");
      assert.equal((await database.sql<Array<{ status: string }>>`
        SELECT status FROM runs WHERE id = ${runId}
      `)[0]?.status, "running", "owner-committed completion keeps later cancellation deferred");
    } finally {
      releaseClaimTableLock?.();
      await tableLocker?.catch(() => {});
      await database.cleanup();
    }
  });

  it("never leaves a deferred termination request open behind a terminal run", async () => {
    const database = await createIsolatedTestDatabase();
    try {
      const runId = "run-terminal-deferred-request";
      const seeded = await seedManagedSingleStepClaim(database, runId);
      const completionRequest = await requestRuntimeCompletion(database.sql, {
        envelope: seeded.envelope,
        output: "STATUS: failed\nERROR: terminal acceptance failure",
        requestId: "RCR_terminal-deferred01",
      });
      if (completionRequest.status !== "requested") throw new Error("completion request missing");
      const completions = createRuntimeCompletionRepository(database.sql);
      await completions.claim({
        requestId: completionRequest.request.requestId,
        ownerInstanceId: "completion-manager",
      });
      await seeded.sessions.markDrained({
        sessionId: seeded.session.sessionId,
        ownerInstanceId: "spawner-a",
        evidence: DRAIN_EVIDENCE,
      });
      await completions.markProcessing({
        requestId: completionRequest.request.requestId,
        ownerInstanceId: "completion-manager",
      });
      const cancellation = await requestRunTermination(database.sql, {
        runId,
        targetStatus: "cancelled",
        requestedBy: "cli-user",
        diagnostic: "deferred while completion owns product transition",
        requestId: "RTR_terminal-deferred01",
      });
      assert.equal(cancellation.status, "requested");

      try {
        await transitionRunToTerminal(database.sql, {
          runId,
          status: "failed",
          diagnostic: "completion-owned gate terminalized the run",
        });
      } catch {
        // Refusing the terminal transition is safe too; the invariant below
        // only forbids publishing terminal state while recovery work is open.
      }

      const state = await database.sql<Array<{ run_status: string; termination_state: string }>>`
        SELECT r.status AS run_status, rtr.state AS termination_state
          FROM runs r
          JOIN run_termination_requests rtr ON rtr.run_id = r.id
         WHERE r.id = ${runId}
      `;
      const terminal = ["completed", "failed", "cancelled"].includes(state[0]?.run_status ?? "");
      const openTermination = state[0]?.termination_state !== "terminalized";
      assert.equal(
        terminal && openTermination,
        false,
        `terminal run stranded ${state[0]?.termination_state ?? "missing"} termination ownership`,
      );
    } finally {
      await database.cleanup();
    }
  });

  it("does not false-accept an expired processing request from claim outcome alone", async () => {
    const database = await createIsolatedTestDatabase();
    try {
      const runId = "run-expired-missing-effect-receipt";
      const seeded = await seedManagedSingleStepClaim(database, runId);
      const startedAt = new Date();
      const requested = await requestRuntimeCompletion(database.sql, {
        envelope: seeded.envelope,
        output: "STATUS: done\nSUMMARY: claim closes before routing receipt",
        requestId: "RCR_missing-receipt001",
        now: startedAt,
      });
      if (requested.status !== "requested") throw new Error("completion request missing");
      const completions = createRuntimeCompletionRepository(database.sql);
      await completions.claim({
        requestId: requested.request.requestId,
        ownerInstanceId: "crashed-manager",
        now: startedAt,
      });
      await seeded.sessions.markDrained({
        sessionId: seeded.session.sessionId,
        ownerInstanceId: "spawner-a",
        evidence: DRAIN_EVIDENCE,
        now: startedAt,
      });
      const staleOwner = await completions.markProcessing({
        requestId: requested.request.requestId,
        ownerInstanceId: "crashed-manager",
        leaseMs: 60_000,
        now: startedAt,
      });

      await asRuntimeCompletionOwner(completions, requested.request.requestId, () => database.sql.begin((transaction) => closeExactSingleStepClaimInTransaction(transaction, {
        envelope: seeded.envelope,
        outcome: "completed",
        diagnostic: "simulated crash after claim close but before step/routing receipt",
        now: new Date(startedAt.getTime() + 1_000),
      })));
      assert.equal((await database.sql<Array<{ status: string }>>`
        SELECT status FROM steps WHERE id = ${seeded.stepDbId}
      `)[0]?.status, "running", "fixture must stop before the product/routing effect is durably acknowledged");

      await expireRuntimeCompletionLease(database, requested.request.requestId);

      const recovered = await completions.recoverExpiredProcessing({
        ownerInstanceId: "recovery-manager",
        now: new Date(startedAt.getTime() + 120_000),
      });
      assert.notEqual(
        recovered.status,
        "finalize",
        "a terminal claim is not proof that step state, routing, advance, and external effects all committed",
      );
      assert.equal(recovered.status, "quarantined");
    } finally {
      await database.cleanup();
    }
  });

  it("adopts an expired executing owner with a drained runtime and active exact claim", async () => {
    const database = await createIsolatedTestDatabase();
    try {
      const runId = "run-expired-resume-owner";
      const seeded = await seedManagedSingleStepClaim(database, runId);
      const startedAt = new Date("2026-07-13T12:00:00.000Z");
      const requested = await requestRuntimeCompletion(database.sql, {
        envelope: seeded.envelope,
        output: "STATUS: done\nSUMMARY: resume exact owner",
        requestId: "RCR_resume-owner0001",
        now: startedAt,
      });
      if (requested.status !== "requested") throw new Error("completion request missing");
      const completions = createRuntimeCompletionRepository(database.sql);
      await completions.claim({
        requestId: requested.request.requestId,
        ownerInstanceId: "crashed-manager",
        now: startedAt,
      });
      await seeded.sessions.markDrained({
        sessionId: seeded.session.sessionId,
        ownerInstanceId: "spawner-a",
        evidence: DRAIN_EVIDENCE,
        now: startedAt,
      });
      const staleOwner = await completions.markProcessing({
        requestId: requested.request.requestId,
        ownerInstanceId: "crashed-manager",
        leaseMs: 60_000,
        now: startedAt,
      });

      await expireRuntimeCompletionLease(database, requested.request.requestId);

      const recovered = await completions.recoverExpiredProcessing({
        ownerInstanceId: "recovery-manager",
        now: new Date(startedAt.getTime() + 120_000),
      });
      assert.equal(recovered.status, "resume_owner");
      assert.equal(recovered.request?.ownerInstanceId, "recovery-manager");
      assert.equal(recovered.request?.applyPhase, "executing");
      assert.equal(recovered.request?.ownerAttemptCount, 2);
      assert.equal((await database.sql<Array<{ outcome: string | null }>>`
        SELECT outcome FROM claim_log WHERE id = ${seeded.claimId}
      `)[0]?.outcome, null);
    } finally {
      await database.cleanup();
    }
  });

  it("prevents a stale completion owner from quarantining an adopted live lease", async () => {
    const database = await createIsolatedTestDatabase();
    try {
      const runId = "run-completion-quarantine-fence";
      const seeded = await seedManagedSingleStepClaim(database, runId);
      const startedAt = new Date("2026-07-13T12:00:00.000Z");
      const requested = await requestRuntimeCompletion(database.sql, {
        envelope: seeded.envelope,
        output: "STATUS: done\nSUMMARY: quarantine fencing",
        requestId: "RCR_quarantine-fence001",
        now: startedAt,
      });
      if (requested.status !== "requested") throw new Error("completion request missing");
      const completions = createRuntimeCompletionRepository(database.sql);
      await completions.claim({
        requestId: requested.request.requestId,
        ownerInstanceId: "stale-manager",
        leaseMs: 60_000,
        now: startedAt,
      });
      await seeded.sessions.markDrained({
        sessionId: seeded.session.sessionId,
        ownerInstanceId: "spawner-a",
        evidence: DRAIN_EVIDENCE,
        now: new Date(startedAt.getTime() + 1_000),
      });
      const stale = await completions.markProcessing({
        requestId: requested.request.requestId,
        ownerInstanceId: "stale-manager",
        leaseMs: 60_000,
        now: new Date(startedAt.getTime() + 2_000),
      });
      assert.ok(stale.leaseExpiresAt);

      const adoptedAt = new Date(startedAt.getTime() + 63_000);
      await expireRuntimeCompletionLease(database, stale.requestId);
      await assert.rejects(
        completions.quarantine({
          requestId: stale.requestId,
          ownerInstanceId: "stale-manager",
          expectedState: "processing",
          expectedLeaseExpiresAt: stale.leaseExpiresAt,
          expectedUpdatedAt: stale.updatedAt,
          diagnostic: "an expired owner cannot quarantine through maintenance",
          now: adoptedAt,
        }),
        /RUNTIME_COMPLETION_QUARANTINE_AUTHORITY_LOST/,
      );
      const afterExpiry = await completions.findById(stale.requestId);
      assert.equal(afterExpiry?.state, "processing");
      assert.notEqual(afterExpiry?.leaseExpiresAt, stale.leaseExpiresAt);
      assert.equal(afterExpiry?.updatedAt, stale.updatedAt);

      const adopted = await completions.recoverExpiredProcessing({
        ownerInstanceId: "current-manager",
        leaseMs: 60_000,
        now: adoptedAt,
      });
      assert.equal(adopted.status, "resume_owner");
      assert.ok(adopted.request?.leaseExpiresAt);

      await assert.rejects(
        completions.quarantine({
          requestId: stale.requestId,
          ownerInstanceId: "stale-manager",
          expectedState: "processing",
          expectedLeaseExpiresAt: stale.leaseExpiresAt,
          expectedUpdatedAt: stale.updatedAt,
          diagnostic: "stale manager must not quarantine adopted completion",
          now: new Date(adoptedAt.getTime() + 1_000),
        }),
        /RUNTIME_COMPLETION_QUARANTINE_AUTHORITY_LOST/,
      );
      const afterStale = await completions.findById(stale.requestId);
      assert.equal(afterStale?.state, "processing");
      assert.equal(afterStale?.ownerInstanceId, "current-manager");
      assert.equal(afterStale?.leaseExpiresAt, adopted.request?.leaseExpiresAt);
      assert.equal(afterStale?.updatedAt, adopted.request?.updatedAt);

      if (!afterStale?.leaseExpiresAt) throw new Error("current completion lease missing");
      const quarantined = await completions.quarantine({
        requestId: afterStale.requestId,
        ownerInstanceId: "current-manager",
        expectedState: "processing",
        expectedLeaseExpiresAt: afterStale.leaseExpiresAt,
        expectedUpdatedAt: afterStale.updatedAt,
        diagnostic: "current owner exhausted bounded work",
        now: new Date(adoptedAt.getTime() + 2_000),
      });
      assert.equal(quarantined.state, "quarantined");
      assert.equal(quarantined.ownerInstanceId, "current-manager");
      assert.equal(quarantined.leaseExpiresAt, undefined);
      assert.deepEqual((await database.sql<Array<{ state: string }>>`
        SELECT state FROM internal_production_owner_reservations_v1
         WHERE category='completion-owner' AND owner_key=${quarantined.requestId}
      `).map((row) => ({ ...row })), [{ state: "closed" }]);
    } finally {
      await database.cleanup();
    }
  });

  it("quarantines owner execution after three unchanged completion attempts", async () => {
    const database = await createIsolatedTestDatabase();
    try {
      const runId = "run-owner-attempt-budget";
      const seeded = await seedManagedSingleStepClaim(database, runId);
      const startedAt = new Date("2026-07-13T12:00:00.000Z");
      const requested = await requestRuntimeCompletion(database.sql, {
        envelope: seeded.envelope,
        output: "STATUS: done\nSUMMARY: deterministic owner keeps crashing",
        requestId: "RCR_owner-budget00001",
        now: startedAt,
      });
      if (requested.status !== "requested") throw new Error("completion request missing");
      const completions = createRuntimeCompletionRepository(database.sql);
      await completions.claim({
        requestId: requested.request.requestId,
        ownerInstanceId: "owner-1",
        now: startedAt,
      });
      await seeded.sessions.markDrained({
        sessionId: seeded.session.sessionId,
        ownerInstanceId: "spawner-a",
        evidence: DRAIN_EVIDENCE,
        now: startedAt,
      });
      const initial = await completions.markProcessing({
        requestId: requested.request.requestId,
        ownerInstanceId: "owner-1",
        leaseMs: 60_000,
        now: startedAt,
      });
      assert.equal(initial.ownerAttemptCount, 1);

      await expireRuntimeCompletionLease(database, requested.request.requestId);
      const second = await completions.recoverExpiredProcessing({
        ownerInstanceId: "owner-2",
        leaseMs: 60_000,
        now: new Date(startedAt.getTime() + 120_000),
      });
      assert.equal(second.status, "resume_owner");
      assert.equal(second.request?.ownerAttemptCount, 2);

      await expireRuntimeCompletionLease(database, requested.request.requestId);
      const third = await completions.recoverExpiredProcessing({
        ownerInstanceId: "owner-3",
        leaseMs: 60_000,
        now: new Date(startedAt.getTime() + 240_000),
      });
      assert.equal(third.status, "resume_owner");
      assert.equal(third.request?.ownerAttemptCount, 3);

      await expireRuntimeCompletionLease(database, requested.request.requestId);
      const exhausted = await completions.recoverExpiredProcessing({
        ownerInstanceId: "owner-4",
        leaseMs: 60_000,
        now: new Date(startedAt.getTime() + 360_000),
      });
      assert.equal(exhausted.status, "quarantined");
      assert.equal(exhausted.request?.ownerAttemptCount, 3);
      assert.match(exhausted.request?.diagnostic ?? "", /OWNER_ATTEMPT_BUDGET_EXHAUSTED/);
      assert.equal((await database.sql<Array<{ outcome: string | null }>>`
        SELECT outcome FROM claim_log WHERE id = ${seeded.claimId}
      `)[0]?.outcome, null, "bounded recovery must not fabricate product completion");
    } finally {
      await database.cleanup();
    }
  });

  it("adopts owner-committed work at the exact effects continuation phase", async () => {
    const database = await createIsolatedTestDatabase();
    try {
      const runId = "run-expired-resume-effects";
      const seeded = await seedManagedSingleStepClaim(database, runId);
      const startedAt = new Date();
      const output = "STATUS: done\nSUMMARY: resume deterministic effects";
      const requested = await requestRuntimeCompletion(database.sql, {
        envelope: seeded.envelope,
        output,
        requestId: "RCR_resume-effects01",
        now: startedAt,
      });
      if (requested.status !== "requested") throw new Error("completion request missing");
      const completions = createRuntimeCompletionRepository(database.sql);
      await completions.claim({
        requestId: requested.request.requestId,
        ownerInstanceId: "crashed-manager",
        now: startedAt,
      });
      await seeded.sessions.markDrained({
        sessionId: seeded.session.sessionId,
        ownerInstanceId: "spawner-a",
        evidence: DRAIN_EVIDENCE,
        now: startedAt,
      });
      const staleOwner = await completions.markProcessing({
        requestId: requested.request.requestId,
        ownerInstanceId: "crashed-manager",
        leaseMs: 60_000,
        now: startedAt,
      });
      await asRuntimeCompletionOwner(completions, requested.request.requestId, () => completeSingleStepClaimAndState(database.sql, {
        envelope: seeded.envelope,
        stepStatus: "done",
        stepOutput: output,
        now: new Date(startedAt.getTime() + 1_000),
      }));

      await expireRuntimeCompletionLease(database, requested.request.requestId);

      const recovered = await completions.recoverExpiredProcessing({
        ownerInstanceId: "crashed-manager",
        now: new Date(startedAt.getTime() + 120_000),
      });
      assert.equal(recovered.status, "resume_effects");
      assert.equal(
        isRuntimeCompletionRecoveryOwnerInstanceIdV1(recovered.request?.ownerInstanceId ?? ""),
        true,
      );
      assert.notEqual(recovered.request?.ownerInstanceId, "crashed-manager");
      assert.equal(recovered.request?.ownerAttemptCount, staleOwner.ownerAttemptCount);
      assert.equal(recovered.request?.applyPhase, "owner_committed");
      assert.equal(recovered.request?.claimOutcome, "completed");
      await assert.rejects(
        completions.markEffectsCommitted({
          requestId: requested.request.requestId,
          ownerInstanceId: "crashed-manager",
          ownerAttemptCount: staleOwner.ownerAttemptCount,
          result: { advanced: true, runCompleted: false },
        }),
        /RUNTIME_COMPLETION_EFFECTS_COMMIT_OWNER_MISMATCH/,
      );
      await assert.rejects(
        completions.acceptAndRelease({
          requestId: requested.request.requestId,
          ownerInstanceId: "crashed-manager",
          ownerAttemptCount: staleOwner.ownerAttemptCount,
          result: { advanced: true, runCompleted: false },
        }),
        /RUNTIME_COMPLETION_PROCESSING_OWNER_MISMATCH/,
      );
    } finally {
      await database.cleanup();
    }
  });

  it("rotates durable recovery owners beyond the pre-commit budget and fences stale effect leases", async () => {
    const database = await createIsolatedTestDatabase();
    try {
      const runId = "run-durable-recovery-generations";
      const seeded = await seedManagedSingleStepClaim(database, runId);
      const startedAt = new Date("2026-07-13T12:00:00.000Z");
      const output = "STATUS: done\nSUMMARY: durable recovery generations remain live";
      const requestId = "RCR_durable-recovery-budget01";
      const requested = await requestRuntimeCompletion(database.sql, {
        envelope: seeded.envelope,
        output,
        requestId,
        now: startedAt,
      });
      if (requested.status !== "requested") throw new Error("completion request missing");
      const completions = createRuntimeCompletionRepository(database.sql);
      await completions.claim({ requestId, ownerInstanceId: "pre-owner-1", now: startedAt });
      await seeded.sessions.markDrained({
        sessionId: seeded.session.sessionId,
        ownerInstanceId: "spawner-a",
        evidence: DRAIN_EVIDENCE,
        now: startedAt,
      });
      await completions.markProcessing({
        requestId,
        ownerInstanceId: "pre-owner-1",
        leaseMs: 60_000,
        now: startedAt,
      });
      for (const [index, ownerInstanceId] of ["pre-owner-2", "pre-owner-3"].entries()) {
        await expireRuntimeCompletionLease(database, requestId);
        const recovered = await completions.recoverExpiredProcessing({
          ownerInstanceId,
          leaseMs: 60_000,
          now: new Date(startedAt.getTime() + ((index + 1) * 120_000)),
        });
        assert.equal(recovered.status, "resume_owner");
        assert.equal(recovered.request?.ownerInstanceId, ownerInstanceId);
        assert.equal(recovered.request?.ownerAttemptCount, index + 2);
      }
      await asRuntimeCompletionOwner(completions, requestId, () => completeSingleStepClaimAndState(
        database.sql,
        {
          envelope: seeded.envelope,
          stepStatus: "done",
          stepOutput: output,
          now: new Date(startedAt.getTime() + 300_000),
        },
      ));

      await expireRuntimeCompletionLease(database, requestId);
      const firstDurable = await completions.recoverExpiredProcessing({
        ownerInstanceId: "caller-selected-owner-is-not-authority",
        leaseMs: 60_000,
      });
      assert.equal(firstDurable.status, "resume_effects");
      assert.ok(firstDurable.request?.ownerInstanceId);
      assert.equal(
        isRuntimeCompletionRecoveryOwnerInstanceIdV1(firstDurable.request.ownerInstanceId),
        true,
      );
      assert.notEqual(
        firstDurable.request.ownerInstanceId,
        "caller-selected-owner-is-not-authority",
      );
      assert.equal(firstDurable.request.ownerAttemptCount, 3);

      const effects = createRuntimeCompletionEffectRepository(database.sql);
      const firstEffect = await effects.claimNext({
        requestId,
        ownerInstanceId: firstDurable.request.ownerInstanceId,
        leaseMs: 30 * 60_000,
      });
      assert.ok(firstEffect?.leaseToken);

      await expireRuntimeCompletionLease(database, requestId);
      const secondDurable = await completions.recoverExpiredProcessing({
        ownerInstanceId: "same-caller-still-does-not-select-token",
        leaseMs: 60_000,
      });
      assert.equal(secondDurable.status, "resume_effects");
      assert.ok(secondDurable.request?.ownerInstanceId);
      assert.notEqual(secondDurable.request.ownerInstanceId, firstDurable.request.ownerInstanceId);
      assert.equal(secondDurable.request.ownerAttemptCount, 3);
      assert.equal(await completions.heartbeatProcessing({
        requestId,
        ownerInstanceId: firstDurable.request.ownerInstanceId,
        ownerAttemptCount: 3,
      }), false);
      assert.equal(await effects.heartbeat({
        requestId,
        effectKey: firstEffect.effectKey,
        ownerInstanceId: firstDurable.request.ownerInstanceId,
        leaseToken: firstEffect.leaseToken,
      }), false);
      await assert.rejects(
        effects.assertLease({
          requestId,
          effectKey: firstEffect.effectKey,
          ownerInstanceId: firstDurable.request.ownerInstanceId,
          leaseToken: firstEffect.leaseToken,
        }),
        /RUNTIME_COMPLETION_EFFECT_LEASE_LOST/,
      );
      await assert.rejects(
        effects.releaseForRetry({
          requestId,
          effectKey: firstEffect.effectKey,
          ownerInstanceId: firstDurable.request.ownerInstanceId,
          leaseToken: firstEffect.leaseToken,
          diagnostic: "stale effect owner must not release",
        }),
        /RUNTIME_COMPLETION_EFFECT_RETRY_FENCE_LOST/,
      );
      await assert.rejects(
        effects.quarantine({
          requestId,
          effectKey: firstEffect.effectKey,
          ownerInstanceId: firstDurable.request.ownerInstanceId,
          leaseToken: firstEffect.leaseToken,
          diagnostic: "stale effect owner must not quarantine",
        }),
        /RUNTIME_COMPLETION_EFFECT_QUARANTINE_FENCE_LOST/,
      );
      await assert.rejects(
        effects.settle({
          requestId,
          effectKey: firstEffect.effectKey,
          ownerInstanceId: firstDurable.request.ownerInstanceId,
          leaseToken: firstEffect.leaseToken,
          resolution: "applied",
          result: {},
          evidence: {},
        }),
        /RUNTIME_COMPLETION_EFFECT_SETTLE_FENCE_LOST/,
      );
      await assert.rejects(
        completions.markEffectsCommitted({
          requestId,
          ownerInstanceId: firstDurable.request.ownerInstanceId,
          ownerAttemptCount: 3,
          result: { advanced: true, runCompleted: false },
        }),
        /RUNTIME_COMPLETION_EFFECTS_COMMIT_OWNER_MISMATCH/,
      );
      await assert.rejects(
        completions.acceptAndRelease({
          requestId,
          ownerInstanceId: firstDurable.request.ownerInstanceId,
          ownerAttemptCount: 3,
          result: { advanced: true, runCompleted: false },
        }),
        /RUNTIME_COMPLETION_PROCESSING_OWNER_MISMATCH/,
      );

      let latest = secondDurable.request;
      for (let generation = 0; generation < 2; generation += 1) {
        await expireRuntimeCompletionLease(database, requestId);
        const recovered = await completions.recoverExpiredProcessing({
          ownerInstanceId: `ignored-durable-caller-${generation}`,
          leaseMs: 60_000,
        });
        assert.equal(recovered.status, "resume_effects");
        assert.ok(recovered.request?.ownerInstanceId);
        assert.equal(isRuntimeCompletionRecoveryOwnerInstanceIdV1(recovered.request.ownerInstanceId), true);
        assert.notEqual(recovered.request.ownerInstanceId, latest.ownerInstanceId);
        assert.equal(recovered.request.ownerAttemptCount, 3);
        latest = recovered.request;
      }

      const latestEffect = await effects.claimNext({
        requestId,
        ownerInstanceId: latest.ownerInstanceId!,
      });
      assert.ok(latestEffect?.leaseToken);
      assert.notEqual(latestEffect.leaseToken, firstEffect.leaseToken);
      await effects.settle({
        requestId,
        effectKey: latestEffect.effectKey,
        ownerInstanceId: latest.ownerInstanceId!,
        leaseToken: latestEffect.leaseToken,
        resolution: "reconciled",
        result: { advanced: true, runCompleted: false },
        evidence: { source: "latest durable recovery generation" },
      });
      const result = { advanced: true, runCompleted: false };
      const effectsCommitted = await completions.markEffectsCommitted({
        requestId,
        ownerInstanceId: latest.ownerInstanceId!,
        ownerAttemptCount: latest.ownerAttemptCount,
        result,
      });
      let finalizer = effectsCommitted;
      for (let generation = 0; generation < 2; generation += 1) {
        await expireRuntimeCompletionLease(database, requestId);
        const recovered = await completions.recoverExpiredProcessing({
          ownerInstanceId: `ignored-finalizer-caller-${generation}`,
          leaseMs: 60_000,
        });
        assert.equal(recovered.status, "finalize");
        assert.ok(recovered.request?.ownerInstanceId);
        assert.equal(isRuntimeCompletionRecoveryOwnerInstanceIdV1(recovered.request.ownerInstanceId), true);
        assert.notEqual(recovered.request.ownerInstanceId, finalizer.ownerInstanceId);
        assert.equal(recovered.request.ownerAttemptCount, 3);
        finalizer = recovered.request;
      }
      const accepted = await completions.acceptAndRelease({
        requestId,
        ownerInstanceId: finalizer.ownerInstanceId!,
        ownerAttemptCount: finalizer.ownerAttemptCount,
        result,
      });
      assert.equal(accepted.state, "accepted");
      assert.equal(accepted.ownerAttemptCount, 3);
    } finally {
      await database.cleanup();
    }
  });

  it("adopts consecutive expired durable receipts without head-of-line blocking at count three", async () => {
    const database = await createIsolatedTestDatabase();
    try {
      const completions = createRuntimeCompletionRepository(database.sql);
      const seedDurableReceipt = async (
        runId: string,
        requestId: string,
        requestedAt: Date,
      ): Promise<void> => {
        const seeded = await seedManagedSingleStepClaim(database, runId);
        const output = `STATUS: done\nSUMMARY: durable receipt ${requestId}`;
        const requested = await requestRuntimeCompletion(database.sql, {
          envelope: seeded.envelope,
          output,
          requestId,
          now: requestedAt,
        });
        if (requested.status !== "requested") throw new Error("completion request missing");
        await completions.claim({ requestId, ownerInstanceId: `owner-${requestId}`, now: requestedAt });
        await seeded.sessions.markDrained({
          sessionId: seeded.session.sessionId,
          ownerInstanceId: "spawner-a",
          evidence: DRAIN_EVIDENCE,
          now: requestedAt,
        });
        await completions.markProcessing({
          requestId,
          ownerInstanceId: `owner-${requestId}`,
          leaseMs: 60_000,
          now: requestedAt,
        });
        await asRuntimeCompletionOwner(completions, requestId, () => completeSingleStepClaimAndState(
          database.sql,
          {
            envelope: seeded.envelope,
            stepStatus: "done",
            stepOutput: output,
            now: new Date(requestedAt.getTime() + 1_000),
          },
        ));
        const rows = await database.sql.unsafe<Array<{ request_id: string }>>(
          `UPDATE runtime_completion_requests
              SET owner_attempt_count = 3,
                  lease_expires_at = clock_timestamp() - INTERVAL '1 second'
            WHERE request_id = $1
              AND state = 'processing'
              AND apply_phase = 'owner_committed'
            RETURNING request_id`,
          [requestId],
        );
        assert.equal(rows.length, 1);
      };

      const firstRequestId = "RCR_durable-hol-first0001";
      const secondRequestId = "RCR_durable-hol-second001";
      const startedAt = new Date("2026-07-13T12:00:00.000Z");
      await seedDurableReceipt("run-durable-hol-first", firstRequestId, startedAt);
      await seedDurableReceipt(
        "run-durable-hol-second",
        secondRequestId,
        new Date(startedAt.getTime() + 1_000),
      );

      const first = await completions.recoverExpiredProcessing({ ownerInstanceId: "recovery-loop" });
      assert.equal(first.status, "resume_effects");
      assert.equal(first.request?.requestId, firstRequestId);
      assert.equal(first.request?.ownerAttemptCount, 3);
      const second = await completions.recoverExpiredProcessing({ ownerInstanceId: "recovery-loop" });
      assert.equal(second.status, "resume_effects");
      assert.equal(second.request?.requestId, secondRequestId);
      assert.equal(second.request?.ownerAttemptCount, 3);
      assert.notEqual(second.request?.ownerInstanceId, first.request?.ownerInstanceId);
    } finally {
      await database.cleanup();
    }
  });

  it("preserves owner and effects commit receipts when cancellation arrives after canonical commit", async () => {
    const database = await createIsolatedTestDatabase();
    try {
      for (const phase of ["owner_committed", "effects_committed"] as const) {
        const runId = `run-cancel-after-${phase.replaceAll("_", "-")}`;
        const seeded = await seedManagedSingleStepClaim(database, runId);
        const requestId = phase === "owner_committed"
          ? "RCR_cancel-after-owner-commit"
          : "RCR_cancel-after-effects-commit";
        const output = `STATUS: done\nSUMMARY: canonical ${phase} receipt`;
        const requested = await requestRuntimeCompletion(database.sql, {
          envelope: seeded.envelope,
          output,
          requestId,
        });
        if (requested.status !== "requested") throw new Error("completion request missing");
        const completions = createRuntimeCompletionRepository(database.sql);
        await completions.claim({ requestId, ownerInstanceId: "manager-a" });
        await seeded.sessions.markDrained({
          sessionId: seeded.session.sessionId,
          ownerInstanceId: "spawner-a",
          evidence: DRAIN_EVIDENCE,
        });
        await completions.markProcessing({ requestId, ownerInstanceId: "manager-a" });
        await asRuntimeCompletionOwner(completions, requestId, () => completeSingleStepClaimAndState(database.sql, {
          envelope: seeded.envelope,
          stepStatus: "done",
          stepOutput: output,
        }));

        if (phase === "effects_committed") {
          const effects = createRuntimeCompletionEffectRepository(database.sql);
          const effect = await effects.claimNext({
            requestId,
            ownerInstanceId: "manager-a",
          });
          assert.ok(effect?.leaseToken);
          await effects.settle({
            requestId,
            effectKey: effect.effectKey,
            ownerInstanceId: "manager-a",
            leaseToken: effect.leaseToken,
            resolution: "reconciled",
            result: { advanced: true, runCompleted: false },
            evidence: { source: "cancellation-race-fixture" },
          });
          const owner = await completions.findById(requestId);
          assert.ok(owner);
          await completions.markEffectsCommitted({
            requestId,
            ownerInstanceId: "manager-a",
            ownerAttemptCount: owner.ownerAttemptCount,
            result: { advanced: true, runCompleted: false },
          });
        }

        const canonical = await completions.findById(requestId);
        assert.ok(canonical?.ownerInstanceId);
        assert.ok(canonical?.leaseExpiresAt);
        assert.equal(canonical.applyPhase, phase);
        const cancellation = await requestRunTermination(database.sql, {
          runId,
          targetStatus: "cancelled",
          requestedBy: "test.cancellation-race",
          diagnostic: `cancellation arrived after ${phase}`,
          requestId: phase === "owner_committed"
            ? "RTR_cancel-after-owner-commit"
            : "RTR_cancel-after-effects-commit",
        });
        assert.equal(cancellation.status, "requested");

        const preemption = await completions.preemptForRunTermination({
          requestId,
          diagnostic: `must not reject canonical ${phase}`,
        });
        assert.equal(
          preemption.status,
          phase === "owner_committed" ? "resume_effects" : "finalize",
        );
        assert.equal(preemption.request.state, "processing");
        assert.equal(preemption.request.applyPhase, phase);
        await assert.rejects(
          completions.quarantine({
            requestId,
            ownerInstanceId: canonical.ownerInstanceId,
            expectedState: "processing",
            expectedLeaseExpiresAt: canonical.leaseExpiresAt,
            expectedUpdatedAt: canonical.updatedAt,
            diagnostic: "generic owner failure must not erase canonical receipt",
          }),
          /RUNTIME_COMPLETION_QUARANTINE_CANONICAL_CONTINUATION_REQUIRED/,
        );
        const retained = await completions.findById(requestId);
        assert.equal(retained?.state, "processing");
        assert.equal(retained?.applyPhase, phase);
        assert.equal((await database.sql<Array<{ outcome: string | null }>>`
          SELECT outcome FROM claim_log WHERE id = ${seeded.claimId}
        `)[0]?.outcome, "completed");
      }
    } finally {
      await database.cleanup();
    }
  });

  it("heartbeats processing ownership so a live coordinator cannot be adopted", async () => {
    const database = await createIsolatedTestDatabase();
    try {
      const runId = "run-processing-heartbeat";
      const seeded = await seedManagedSingleStepClaim(database, runId);
      const startedAt = new Date();
      const requested = await requestRuntimeCompletion(database.sql, {
        envelope: seeded.envelope,
        output: "STATUS: done\nSUMMARY: long-running acceptance gates",
        requestId: "RCR_processing-heart01",
        now: startedAt,
      });
      if (requested.status !== "requested") throw new Error("completion request missing");
      const completions = createRuntimeCompletionRepository(database.sql);
      await completions.claim({ requestId: requested.request.requestId, ownerInstanceId: "live-manager", now: startedAt });
      await seeded.sessions.markDrained({
        sessionId: seeded.session.sessionId,
        ownerInstanceId: "spawner-a",
        evidence: DRAIN_EVIDENCE,
        now: startedAt,
      });
      await completions.markProcessing({
        requestId: requested.request.requestId,
        ownerInstanceId: "live-manager",
        leaseMs: 60_000,
        now: startedAt,
      });
      assert.equal(await completions.heartbeatProcessing({
        requestId: requested.request.requestId,
        ownerInstanceId: "live-manager",
        ownerAttemptCount: 1,
        leaseMs: 60_000,
        now: new Date(startedAt.getTime() + 45_000),
      }), true);
      assert.deepEqual(await completions.recoverExpiredProcessing({
        ownerInstanceId: "other-manager",
        now: new Date(startedAt.getTime() + 90_000),
      }), { status: "none" });
    } finally {
      await database.cleanup();
    }
  });

  it("rejects a pre-seeded effect before atomically committing the completion owner", async () => {
    const database = await createIsolatedTestDatabase();
    try {
      const runId = "run-effect-preseed-fence";
      const seeded = await seedManagedSingleStepClaim(database, runId);
      const output = "STATUS: done\nSUMMARY: pre-seeded effect fence";
      const requested = await requestRuntimeCompletion(database.sql, {
        envelope: seeded.envelope,
        output,
        requestId: "RCR_effect-preseed-fence01",
      });
      if (requested.status !== "requested") throw new Error("completion request missing");
      const completions = createRuntimeCompletionRepository(database.sql);
      await completions.claim({
        requestId: requested.request.requestId,
        ownerInstanceId: "manager-a",
      });
      await seeded.sessions.markDrained({
        sessionId: seeded.session.sessionId,
        ownerInstanceId: "spawner-a",
        evidence: DRAIN_EVIDENCE,
      });
      await completions.markProcessing({
        requestId: requested.request.requestId,
        ownerInstanceId: "manager-a",
      });
      await assert.rejects(
        database.sql`
          INSERT INTO runtime_completion_effects (
            request_id, effect_key, ordinal, effect_type, input_hash,
            payload, mandatory, state
          ) VALUES (
            ${requested.request.requestId}, 'preseeded-effect', 0,
            'single.pipeline.advance', ${"a".repeat(64)},
            ${database.sql.json({ forged: true })}, TRUE, 'pending'
          )
        `,
        /RUNTIME_COMPLETION_EFFECT_PARENT_BINDING_INVALID/,
      );

      await asRuntimeCompletionOwner(
        completions,
        requested.request.requestId,
        () => completeSingleStepClaimAndState(database.sql, {
          envelope: seeded.envelope,
          stepStatus: "done",
          stepOutput: output,
        }),
      );

      const state = await database.sql<Array<{
        claim_outcome: string | null;
        step_status: string;
        apply_phase: string;
        effect_count: number;
      }>>`
        SELECT cl.outcome AS claim_outcome,
               s.status AS step_status,
               rcr.apply_phase,
               COUNT(rce.effect_key)::integer AS effect_count
          FROM claim_log cl
          JOIN steps s ON s.id = ${seeded.stepDbId}
          JOIN runtime_completion_requests rcr ON rcr.claim_id = cl.id
          LEFT JOIN runtime_completion_effects rce
            ON rce.request_id = rcr.request_id
         WHERE cl.id = ${seeded.claimId}
         GROUP BY cl.outcome, s.status, rcr.apply_phase
      `;
      assert.deepEqual({ ...state[0] }, {
        claim_outcome: "completed",
        step_status: "done",
        apply_phase: "owner_committed",
        effect_count: 1,
      });
      await assert.rejects(
        database.sql`
          UPDATE runtime_completion_effects
             SET ordinal = ordinal + 1
           WHERE request_id = ${requested.request.requestId}
        `,
        /RUNTIME_COMPLETION_EFFECT_IDENTITY_IMMUTABLE/,
      );
      const exactPlan = createSingleEffectCompletionPlanDescriptorV1({
        kind: "single_completion",
        continuation: { type: "single_pipeline_advance" },
      });
      assert.equal(await asRuntimeCompletionOwner(
        completions,
        requested.request.requestId,
        () => database.sql.begin((transaction) => markRuntimeCompletionOwnerCommittedInTransaction(
          transaction,
          { claimId: seeded.claimId, claimOutcome: "completed", plan: exactPlan },
        )),
      ), true, "exact owner-commit replay adopts without mutation");
      await database.sql`
        UPDATE internal_production_owner_reservations_v1
           SET owner_key = jsonb_pretty(owner_key::jsonb)
         WHERE producer_implementation_id = 'a-mandatory-effect-v1'
      `;
      await assert.rejects(
        asRuntimeCompletionOwner(
          completions,
          requested.request.requestId,
          () => database.sql.begin((transaction) => markRuntimeCompletionOwnerCommittedInTransaction(
            transaction,
            { claimId: seeded.claimId, claimOutcome: "completed", plan: exactPlan },
          )),
        ),
        /INTERNAL_PRODUCTION_MANDATORY_EFFECT_OWNER_CORRUPTION/,
      );
    } finally {
      await database.cleanup();
    }
  });

  it("fences mandatory continuation effects and refuses aggregate acceptance before receipts", async () => {
    const database = await createIsolatedTestDatabase();
    try {
      const runId = "run-effect-fence";
      const seeded = await seedManagedSingleStepClaim(database, runId);
      const startedAt = new Date();
      const output = "STATUS: done\nSUMMARY: effect lease fencing";
      const requested = await requestRuntimeCompletion(database.sql, {
        envelope: seeded.envelope,
        output,
        requestId: "RCR_effect-fence0001",
        now: startedAt,
      });
      if (requested.status !== "requested") throw new Error("completion request missing");
      const completions = createRuntimeCompletionRepository(database.sql);
      await completions.claim({ requestId: requested.request.requestId, ownerInstanceId: "manager-a", now: startedAt });
      await seeded.sessions.markDrained({
        sessionId: seeded.session.sessionId,
        ownerInstanceId: "spawner-a",
        evidence: DRAIN_EVIDENCE,
        now: startedAt,
      });
      await completions.markProcessing({
        requestId: requested.request.requestId,
        ownerInstanceId: "manager-a",
        now: startedAt,
      });
      await asRuntimeCompletionOwner(completions, requested.request.requestId, () => completeSingleStepClaimAndState(database.sql, {
        envelope: seeded.envelope,
        stepStatus: "done",
        stepOutput: output,
        now: new Date(startedAt.getTime() + 1_000),
      }));

      await assert.rejects(
        completions.markEffectsCommitted({
          requestId: requested.request.requestId,
          ownerInstanceId: "manager-a",
          ownerAttemptCount: (await completions.findById(requested.request.requestId))!.ownerAttemptCount,
          result: { advanced: true, runCompleted: false },
        }),
        /RUNTIME_COMPLETION_MANDATORY_EFFECTS_PENDING/,
      );
      const effects = createRuntimeCompletionEffectRepository(database.sql);
      const first = await effects.claimNext({
        requestId: requested.request.requestId,
        ownerInstanceId: "manager-a",
        leaseMs: 30_000,
        now: new Date("2999-01-01T00:00:00.000Z"),
      });
      assert.equal(first?.state, "leased");
      assert.equal(first?.mandatory, true);
      assert.equal((await effects.claimNext({
        requestId: requested.request.requestId,
        ownerInstanceId: "effect-owner-b",
        now: new Date("2999-01-01T00:00:00.000Z"),
      })), undefined);
      assert.equal(await effects.heartbeat({
        requestId: requested.request.requestId,
        effectKey: first!.effectKey,
        ownerInstanceId: "manager-a",
        leaseToken: first!.leaseToken!,
        leaseMs: 30_000,
        now: new Date("1900-01-01T00:00:00.000Z"),
      }), true);
      await database.sql`
        UPDATE runtime_completion_effects
           SET lease_expires_at = clock_timestamp() - interval '1 second'
         WHERE request_id = ${requested.request.requestId}
           AND effect_key = ${first!.effectKey}
      `;
      assert.equal(await effects.heartbeat({
        requestId: requested.request.requestId,
        effectKey: first!.effectKey,
        ownerInstanceId: "manager-a",
        leaseToken: first!.leaseToken!,
        leaseMs: 30_000,
        now: new Date("1900-01-01T00:00:00.000Z"),
      }), false);
      const adopted = await effects.claimNext({
        requestId: requested.request.requestId,
        ownerInstanceId: "manager-a",
        leaseMs: 30_000,
        now: new Date("1900-01-01T00:00:00.000Z"),
      });
      assert.equal(adopted?.state, "leased");
      assert.notEqual(adopted?.leaseToken, first?.leaseToken);
      await assert.rejects(
        effects.settle({
          requestId: requested.request.requestId,
          effectKey: first!.effectKey,
          ownerInstanceId: "manager-a",
          leaseToken: first!.leaseToken!,
          resolution: "applied",
          result: {},
          evidence: {},
          now: new Date("2999-01-01T00:00:00.000Z"),
        }),
        /RUNTIME_COMPLETION_EFFECT_SETTLE_FENCE_LOST/,
      );
      await effects.releaseForRetry({
        requestId: requested.request.requestId,
        effectKey: adopted!.effectKey,
        ownerInstanceId: "manager-a",
        leaseToken: adopted!.leaseToken!,
        diagnostic: "retry preserves the mandatory owner",
        now: new Date("1900-01-01T00:00:00.000Z"),
      });
      assert.equal((await effects.listForRequest(requested.request.requestId))[0]?.state, "pending");
      assert.deepEqual((await database.sql<Array<{ state: string }>>`
        SELECT state FROM internal_production_owner_reservations_v1
         WHERE producer_implementation_id = 'a-mandatory-effect-v1'
      `).map((row) => ({ ...row })), [{ state: "bound" }]);
      const reclaimed = await effects.claimNext({
        requestId: requested.request.requestId,
        ownerInstanceId: "manager-a",
        leaseMs: 30_000,
        now: new Date("1900-01-01T00:00:01.000Z"),
      });
      assert.ok(reclaimed?.leaseToken);
      assert.notEqual(reclaimed.leaseToken, adopted?.leaseToken);
      const reconciledResult = { advanced: true, runCompleted: false };
      const reconciledEvidence = { source: "canonical-state-reconciliation" };
      await database.sql.unsafe(`
        CREATE FUNCTION reject_task5_settle_close_v1() RETURNS trigger
        LANGUAGE plpgsql AS $$ BEGIN
          IF OLD.category='mandatory-effect' AND OLD.state='bound' AND NEW.state='closed' THEN
            RAISE EXCEPTION 'TEST_TASK5_SETTLE_CLOSE_REJECTED';
          END IF;
          RETURN NEW;
        END $$
      `);
      await database.sql.unsafe(`
        CREATE TRIGGER reject_task5_settle_close_v1
        BEFORE UPDATE OF state ON internal_production_owner_reservations_v1
        FOR EACH ROW EXECUTE FUNCTION reject_task5_settle_close_v1()
      `);
      await assert.rejects(
        effects.settle({
          requestId: requested.request.requestId,
          effectKey: reclaimed.effectKey,
          ownerInstanceId: "manager-a",
          leaseToken: reclaimed.leaseToken,
          resolution: "reconciled",
          result: reconciledResult,
          evidence: reconciledEvidence,
          now: new Date("2999-01-01T00:00:00.000Z"),
        }),
        /TEST_TASK5_SETTLE_CLOSE_REJECTED/,
      );
      const settleRolledBack = await database.sql<Array<{
        effect_state: string;
        owner_state: string;
      }>>`
        SELECT effect.state AS effect_state,owner.state AS owner_state
          FROM runtime_completion_effects effect
          JOIN internal_production_owner_reservations_v1 owner
            ON owner.category='mandatory-effect'
           AND owner.owner_key::jsonb->>'requestId'=effect.request_id
           AND owner.owner_key::jsonb->>'effectKey'=effect.effect_key
         WHERE effect.request_id=${requested.request.requestId}
      `;
      assert.deepEqual(settleRolledBack.map((row) => ({ ...row })), [{
        effect_state: "leased",
        owner_state: "bound",
      }]);
      await database.sql.unsafe(`
        DROP TRIGGER reject_task5_settle_close_v1
        ON internal_production_owner_reservations_v1
      `);
      const settled = await effects.settle({
        requestId: requested.request.requestId,
        effectKey: reclaimed.effectKey,
        ownerInstanceId: "manager-a",
        leaseToken: reclaimed.leaseToken,
        resolution: "reconciled",
        result: reconciledResult,
        evidence: reconciledEvidence,
        now: new Date("2999-01-01T00:00:00.000Z"),
      });
      const replayed = await effects.settle({
        requestId: requested.request.requestId,
        effectKey: reclaimed.effectKey,
        ownerInstanceId: "manager-a",
        leaseToken: reclaimed.leaseToken,
        resolution: "reconciled",
        result: reconciledResult,
        evidence: reconciledEvidence,
        now: new Date("2999-01-01T00:00:00.000Z"),
      });
      assert.deepEqual(replayed, settled);
      const effectOwner = await database.sql<Array<{ state: string }>>`
        SELECT state FROM internal_production_owner_reservations_v1
         WHERE producer_implementation_id = 'a-mandatory-effect-v1'
      `;
      assert.deepEqual(effectOwner.map((row) => ({ ...row })), [{ state: "closed" }]);
      assert.equal(await effects.allMandatorySettled(requested.request.requestId), true);
      const effectsCommitted = await completions.markEffectsCommitted({
        requestId: requested.request.requestId,
        ownerInstanceId: "manager-a",
        ownerAttemptCount: (await completions.findById(requested.request.requestId))!.ownerAttemptCount,
        result: { advanced: true, runCompleted: false },
        now: new Date(startedAt.getTime() + 42_000),
      });
      assert.equal(effectsCommitted.applyPhase, "effects_committed");
      const beforeCompound = (await database.sql<Array<{
        effect_state: string;
        effect_updated_at: string;
        owner_state: string;
        close_ref: string;
        close_hash: string;
        owner_updated_at: string;
      }>>`
        SELECT effect.state AS effect_state,effect.updated_at::text AS effect_updated_at,
               owner.state AS owner_state,owner.close_ref,owner.close_hash,
               owner.updated_at::text AS owner_updated_at
          FROM runtime_completion_effects effect
          JOIN internal_production_owner_reservations_v1 owner
            ON owner.category='mandatory-effect'
           AND owner.owner_key::jsonb->>'requestId'=effect.request_id
           AND owner.owner_key::jsonb->>'effectKey'=effect.effect_key
         WHERE effect.request_id=${requested.request.requestId}
      `)[0]!;
      if (!effectsCommitted.ownerInstanceId || !effectsCommitted.leaseExpiresAt) {
        throw new Error("reconciled completion owner capability missing");
      }
      const [compound, managerReplay] = await Promise.all([
        runWithRuntimeCompletionOwner({
          requestId: effectsCommitted.requestId,
          ownerInstanceId: effectsCommitted.ownerInstanceId,
          leaseExpiresAt: effectsCommitted.leaseExpiresAt,
          ownerAttemptCount: effectsCommitted.ownerAttemptCount,
        }, () => transitionRunToTerminal(database.sql, {
          runId,
          status: "completed",
          diagnostic: "Task 6 exact-adopts reconciled Task 5 effect",
        })),
        completions.acceptAndRelease({
          requestId: effectsCommitted.requestId,
          ownerInstanceId: effectsCommitted.ownerInstanceId,
          ownerAttemptCount: effectsCommitted.ownerAttemptCount,
          result: { advanced: true, runCompleted: false },
        }),
      ]);
      assert.equal(compound.status, "completed");
      assert.equal(managerReplay.state, "accepted");
      await assert.rejects(
        completions.acceptAndRelease({
          requestId: effectsCommitted.requestId,
          ownerInstanceId: effectsCommitted.ownerInstanceId,
          ownerAttemptCount: effectsCommitted.ownerAttemptCount,
          result: {
            advanced: true,
            runCompleted: false,
            terminalRunStatus: "failed",
          },
        }),
        /RUNTIME_COMPLETION_ACCEPT_TERMINAL_CONFLICT/,
      );
      const exactExplicitTerminalReplay = await completions.acceptAndRelease({
        requestId: effectsCommitted.requestId,
        ownerInstanceId: effectsCommitted.ownerInstanceId,
        ownerAttemptCount: effectsCommitted.ownerAttemptCount,
        result: {
          advanced: true,
          runCompleted: false,
          terminalRunStatus: "completed",
        },
      });
      assert.equal(exactExplicitTerminalReplay.state, "accepted");
      const afterCompound = (await database.sql<Array<{
        effect_state: string;
        effect_updated_at: string;
        owner_state: string;
        close_ref: string;
        close_hash: string;
        owner_updated_at: string;
      }>>`
        SELECT effect.state AS effect_state,effect.updated_at::text AS effect_updated_at,
               owner.state AS owner_state,owner.close_ref,owner.close_hash,
               owner.updated_at::text AS owner_updated_at
          FROM runtime_completion_effects effect
          JOIN internal_production_owner_reservations_v1 owner
            ON owner.category='mandatory-effect'
           AND owner.owner_key::jsonb->>'requestId'=effect.request_id
           AND owner.owner_key::jsonb->>'effectKey'=effect.effect_key
         WHERE effect.request_id=${requested.request.requestId}
      `)[0]!;
      assert.deepEqual({ ...afterCompound }, { ...beforeCompound });
    } finally {
      await database.cleanup();
    }
  });

  it("leaves a processing/executing completion unchanged when cancellation lacks Task 5 normalization", async () => {
    const database = await createIsolatedTestDatabase();
    try {
      const runId = "run-task5-terminal-normalization-required";
      const requestId = "RCR_task5-normalization-required1";
      const seeded = await seedManagedClaim(database, runId);
      await publishCompletionInState(database, seeded, "processing", requestId);
      const before = await task5TerminalSnapshot(database, requestId);
      await assert.rejects(
        database.sql.begin((transaction) => terminalizeRuntimeCompletionForRunInTransactionV1(
          transaction,
          {
            requestId,
            runId,
            terminalRunStatus: "cancelled",
            transitionTime: new Date("2026-07-13T12:05:00.000Z"),
          },
        )),
        /RUN_TERMINAL_COMPLETION_STATE_OPEN:processing:executing/,
      );
      assert.deepEqual(await task5TerminalSnapshot(database, requestId), before);
    } finally {
      await database.cleanup();
    }
  });

  it("keeps a quarantined mandatory effect and its nonterminal completion owner bound", async () => {
    const database = await createIsolatedTestDatabase();
    try {
      const runId = "run-effect-quarantine-open";
      const seeded = await seedManagedSingleStepClaim(database, runId);
      const output = "STATUS: done\nSUMMARY: effect quarantine remains open";
      const requested = await requestRuntimeCompletion(database.sql, {
        envelope: seeded.envelope,
        output,
        requestId: "RCR_effect-quarantine-open1",
      });
      if (requested.status !== "requested") throw new Error("completion request missing");
      const completions = createRuntimeCompletionRepository(database.sql);
      await completions.claim({
        requestId: requested.request.requestId,
        ownerInstanceId: "quarantine-manager",
      });
      await seeded.sessions.markDrained({
        sessionId: seeded.session.sessionId,
        ownerInstanceId: "spawner-a",
        evidence: DRAIN_EVIDENCE,
      });
      await completions.markProcessing({
        requestId: requested.request.requestId,
        ownerInstanceId: "quarantine-manager",
      });
      await asRuntimeCompletionOwner(
        completions,
        requested.request.requestId,
        () => completeSingleStepClaimAndState(database.sql, {
          envelope: seeded.envelope,
          stepStatus: "done",
          stepOutput: output,
        }),
      );
      const effects = createRuntimeCompletionEffectRepository(database.sql);
      const leased = await effects.claimNext({
        requestId: requested.request.requestId,
        ownerInstanceId: "quarantine-manager",
      });
      assert.ok(leased?.leaseToken);
      const quarantined = await effects.quarantine({
        requestId: requested.request.requestId,
        effectKey: leased.effectKey,
        ownerInstanceId: "quarantine-manager",
        leaseToken: leased.leaseToken,
        diagnostic: "effect exhausted retry budget",
        evidence: { source: "task5-quarantine-proof" },
      });
      assert.equal(quarantined.state, "quarantined");
      const owners = await database.sql<Array<{
        completion_state: string;
        effect_state: string;
      }>>`
        SELECT completion_owner.state AS completion_state,
               effect_owner.state AS effect_state
          FROM internal_production_owner_reservations_v1 completion_owner
          JOIN internal_production_owner_reservations_v1 effect_owner
            ON effect_owner.producer_implementation_id='a-mandatory-effect-v1'
           AND effect_owner.owner_key::jsonb->>'requestId'=${requested.request.requestId}
         WHERE completion_owner.producer_implementation_id='a-completion-owner-v1'
           AND completion_owner.owner_key=${requested.request.requestId}
      `;
      assert.deepEqual(owners.map((row) => ({ ...row })), [{
        completion_state: "bound",
        effect_state: "bound",
      }]);
      assert.equal(await effects.allMandatorySettled(requested.request.requestId), false);
    } finally {
      await database.cleanup();
    }
  });

  it("keeps every active completion state authoritative over loop and single orphan recovery", async () => {
    const database = await createIsolatedTestDatabase();
    try {
      const states = ["requested", "draining", "processing", "quarantined"] as const;
      let canonicalProcessingLoop:
        | Readonly<{ seeded: Awaited<ReturnType<typeof seedManagedClaim>>; output: string }>
        | undefined;

      for (const kind of ["loop", "single"] as const) {
        for (const state of states) {
          const runId = `run-orphan-fence-${kind}-${state}`;
          const seeded = kind === "loop"
            ? await seedManagedClaim(database, runId)
            : await seedManagedSingleStepClaim(database, runId);
          const completion = await publishCompletionInState(
            database,
            seeded,
            state,
            `RCR_orphan-fence-${kind}-${state}`,
          );

          const recovery = kind === "loop"
            ? closeClaimAndBoundAttempt(database.sql, {
                claimId: seeded.claimId,
                runId,
                stepId: "implement",
                storyId: "US-001",
                agentId: "feature-dev_developer",
                outcome: "infra_retry",
                diagnostic: "generic loop orphan recovery must lose",
                recoveryAuthority: "orphan_recovery",
              })
            : database.sql.begin((transaction) => closeExactSingleStepClaimInTransaction(transaction, {
                envelope: seeded.envelope,
                outcome: "infra_retry",
                diagnostic: "generic single orphan recovery must lose",
                recoveryAuthority: "orphan_recovery",
              }));
          await assert.rejects(
            recovery,
            (error: unknown) => error instanceof Error
              && error.message.includes(
                `CLAIM_MUTATION_DURABLE_OWNER_ACTIVE:runtime_completion:${state}:`,
              ),
          );

          const owner = await database.sql<Array<{
            outcome: string | null;
            completion_state: string;
          }>>`
            SELECT cl.outcome, completion.state AS completion_state
              FROM claim_log cl
              JOIN runtime_completion_requests completion ON completion.claim_id = cl.id
             WHERE cl.id = ${seeded.claimId}
          `;
          assert.deepEqual({ ...owner[0] }, { outcome: null, completion_state: state });
          if (kind === "loop") {
            assert.equal((await seeded.attempts.findActive({
              runId,
              stepId: "implement",
              storyId: "US-001",
            }))?.disposition, "running");
            if (state === "processing") {
              canonicalProcessingLoop = { seeded, output: completion.output };
            }
          }
        }
      }

      if (!canonicalProcessingLoop) throw new Error("processing loop fixture missing");
      const canonicalCompletions = createRuntimeCompletionRepository(database.sql);
      const canonicalRequest = await canonicalCompletions.findByClaimId(canonicalProcessingLoop.seeded.claimId);
      if (!canonicalRequest) throw new Error("canonical processing request missing");
      await asRuntimeCompletionOwner(canonicalCompletions, canonicalRequest.requestId, () => completeStoryClaimAndBoundAttempt(database.sql, {
        envelope: canonicalProcessingLoop.seeded.envelope,
        sourceAfter: { sha: "2".repeat(40), treeHash: "3".repeat(64) },
        outputHash: createHash("sha256").update(canonicalProcessingLoop.output, "utf8").digest("hex"),
        storyStatus: "done",
        storyOutput: canonicalProcessingLoop.output,
        stepStatus: "running",
        stepOutput: canonicalProcessingLoop.output,
      }));
      assert.equal((await database.sql<Array<{ outcome: string }>>`
        SELECT outcome FROM claim_log
         WHERE id = ${canonicalProcessingLoop.seeded.claimId}
      `)[0]?.outcome, "completed", "the canonical completion owner must remain able to commit");
    } finally {
      await database.cleanup();
    }
  });

  it("allows exact loop and single orphan recovery only when no durable owner exists", async () => {
    const database = await createIsolatedTestDatabase();
    try {
      const loop = await seedManagedClaim(database, "run-orphan-no-owner-loop");
      await drainManagedRuntime(loop);
      const loopClosed = await closeClaimAndBoundAttempt(database.sql, {
        claimId: loop.claimId,
        runId: loop.envelope.runId,
        stepId: loop.envelope.workflowStepId,
        storyId: loop.envelope.storyId!,
        agentId: loop.envelope.claimAgentId,
        outcome: "infra_retry",
        diagnostic: "loop orphan recovery acquired exact authority",
        recoveryAuthority: "orphan_recovery",
      });
      assert.equal(loopClosed.status, "closed");

      const single = await seedManagedSingleStepClaim(database, "run-orphan-no-owner-single");
      await drainManagedRuntime(single);
      await database.sql.begin((transaction) => closeExactSingleStepClaimInTransaction(transaction, {
        envelope: single.envelope,
        outcome: "infra_retry",
        diagnostic: "single orphan recovery acquired exact authority",
        recoveryAuthority: "orphan_recovery",
      }));
      const outcomes = await database.sql<Array<{ run_id: string; outcome: string }>>`
        SELECT run_id, outcome FROM claim_log
         WHERE id IN (${loop.claimId}, ${single.claimId})
         ORDER BY run_id
      `;
      assert.deepEqual(outcomes.map((row) => ({ ...row })), [
        { run_id: "run-orphan-no-owner-loop", outcome: "infra_retry" },
        { run_id: "run-orphan-no-owner-single", outcome: "infra_retry" },
      ]);
    } finally {
      await database.cleanup();
    }
  });

  it("refuses to acquire orphan authority through an autocommit/base Sql capability", async () => {
    const database = await createIsolatedTestDatabase();
    try {
      const seeded = await seedManagedSingleStepClaim(database, "run-orphan-autocommit-rejected");
      await assert.rejects(
        acquireOrphanClaimRecoveryAuthorityInTransaction(
          database.sql as unknown as postgres.TransactionSql,
          {
            claimId: seeded.claimId,
            runId: seeded.envelope.runId,
            workflowStepId: seeded.envelope.workflowStepId,
            storyId: null,
            claimAgentId: seeded.envelope.claimAgentId,
          },
        ),
        /CLAIM_MUTATION_TRANSACTION_REQUIRED/,
      );
      assert.equal((await database.sql<Array<{ outcome: string | null }>>`
        SELECT outcome FROM claim_log WHERE id = ${seeded.claimId}
      `)[0]?.outcome, null);
    } finally {
      await database.cleanup();
    }
  });

  it("serializes competing story orphan owners on the shared recovery advisory identity before run locking", async () => {
    const database = await createIsolatedTestDatabase();
    try {
      const seeded = await seedManagedClaim(database, "run-orphan-advisory-order");
      await drainManagedRuntime(seeded);
      const identity = {
        claimId: seeded.claimId,
        runId: seeded.envelope.runId,
        workflowStepId: seeded.envelope.workflowStepId,
        storyId: seeded.envelope.storyId!,
        claimAgentId: seeded.envelope.claimAgentId,
      } as const;
      let releaseFirst!: () => void;
      let firstAcquired!: () => void;
      const release = new Promise<void>((resolve) => { releaseFirst = resolve; });
      const acquired = new Promise<void>((resolve) => { firstAcquired = resolve; });
      const first = database.sql.begin(async (transaction) => {
        await acquireOrphanClaimRecoveryAuthorityInTransaction(transaction, identity);
        firstAcquired();
        await release;
        return closeClaimAndBoundAttemptInTransaction(transaction, {
          claimId: seeded.claimId,
          runId: seeded.envelope.runId,
          stepId: seeded.envelope.workflowStepId,
          storyId: seeded.envelope.storyId!,
          agentId: seeded.envelope.claimAgentId,
          outcome: "infra_retry",
          diagnostic: "first advisory owner won",
        });
      });
      await acquired;
      const second = database.sql.begin((transaction) =>
        acquireOrphanClaimRecoveryAuthorityInTransaction(transaction, identity)
      );
      await waitForBlockedRecoveryAdvisoryLock(database);
      releaseFirst();
      assert.equal((await first).status, "closed");
      await assert.rejects(second, /CLAIM_MUTATION_CLAIM_TERMINAL/);
    } finally {
      await database.cleanup();
    }
  });

  it("fences active termination and runtime quarantine owners before orphan claim mutation", async () => {
    const database = await createIsolatedTestDatabase();
    try {
      const termination = await seedManagedSingleStepClaim(database, "run-orphan-termination-owner");
      await database.sql`
        INSERT INTO run_termination_requests (
          request_id, run_id, target_status, state, requested_by,
          requested_at, diagnostic
        ) VALUES (
          'RTR_orphan-termination-owner', ${termination.envelope.runId},
          'cancelled', 'requested', 'test-owner', NOW(), 'durable termination owner'
        )
      `;
      await assert.rejects(
        database.sql.begin((transaction) => closeExactSingleStepClaimInTransaction(transaction, {
          envelope: termination.envelope,
          outcome: "infra_retry",
          diagnostic: "must not steal termination",
          recoveryAuthority: "orphan_recovery",
        })),
        /CLAIM_MUTATION_DURABLE_OWNER_ACTIVE:run_termination:requested:/,
      );

      const quarantine = await seedManagedSingleStepClaim(database, "run-orphan-runtime-quarantine");
      const liveRuntime = await quarantine.sessions.findById(quarantine.session.sessionId);
      if (!liveRuntime) throw new Error("runtime fixture missing");
      await quarantine.sessions.quarantine({
        sessionId: liveRuntime.sessionId,
        expectedOwnerInstanceId: liveRuntime.ownerInstanceId,
        expectedStateVersion: liveRuntime.stateVersion,
        diagnostic: "runtime quarantine owns recovery",
      });
      await assert.rejects(
        database.sql.begin((transaction) => closeExactSingleStepClaimInTransaction(transaction, {
          envelope: quarantine.envelope,
          outcome: "infra_retry",
          diagnostic: "must not steal quarantine",
          recoveryAuthority: "orphan_recovery",
        })),
        /CLAIM_MUTATION_DURABLE_OWNER_ACTIVE:runtime_quarantine:quarantined:/,
      );
      const claims = await database.sql<Array<{ id: string; outcome: string | null }>>`
        SELECT id::text, outcome FROM claim_log
         WHERE id IN (${termination.claimId}, ${quarantine.claimId})
         ORDER BY id
      `;
      assert.deepEqual(claims.map((claim) => claim.outcome), [null, null]);
    } finally {
      await database.cleanup();
    }
  });

  it("linearizes recovery-first completion publication to one terminal claim owner", async () => {
    const database = await createIsolatedTestDatabase();
    try {
      const seeded = await seedManagedSingleStepClaim(database, "run-orphan-completion-race");
      await drainManagedRuntime(seeded);
      let releaseRecovery!: () => void;
      let authorityAcquired!: () => void;
      const release = new Promise<void>((resolve) => { releaseRecovery = resolve; });
      const acquired = new Promise<void>((resolve) => { authorityAcquired = resolve; });
      const recovery = database.sql.begin(async (transaction) => {
        await acquireOrphanClaimRecoveryAuthorityInTransaction(transaction, {
          claimId: seeded.claimId,
          runId: seeded.envelope.runId,
          workflowStepId: seeded.envelope.workflowStepId,
          storyId: null,
          claimAgentId: seeded.envelope.claimAgentId,
        });
        authorityAcquired();
        await release;
        await closeExactSingleStepClaimInTransaction(transaction, {
          envelope: seeded.envelope,
          outcome: "infra_retry",
          diagnostic: "recovery won the run and claim fence",
        });
      });
      await acquired;
      const completion = requestRuntimeCompletion(database.sql, {
        envelope: seeded.envelope,
        output: "STATUS: done\nSUMMARY: completion lost the authority race",
        requestId: "RCR_orphan-completion-race",
      });
      await waitForBlockedTerminationPublication(database);
      releaseRecovery();
      await recovery;
      await assert.rejects(completion, /RUNTIME_COMPLETION_OWNER_NOT_ACTIVE/);
      const owner = await database.sql<Array<{ outcome: string; request_count: number }>>`
        SELECT cl.outcome,
               (SELECT COUNT(*)::integer FROM runtime_completion_requests rcr
                 WHERE rcr.claim_id = cl.id) AS request_count
          FROM claim_log cl
         WHERE cl.id = ${seeded.claimId}
      `;
      assert.deepEqual({ ...owner[0] }, { outcome: "infra_retry", request_count: 0 });
    } finally {
      await database.cleanup();
    }
  });

  it("invalidates an already-waiting quarantine CAS when orphan recovery wins first", async () => {
    const database = await createIsolatedTestDatabase();
    try {
      const seeded = await seedManagedSingleStepClaim(database, "run-orphan-quarantine-race");
      await drainManagedRuntime(seeded);
      const runtimeBefore = await seeded.sessions.findById(seeded.session.sessionId);
      if (!runtimeBefore) throw new Error("runtime fixture missing");
      let releaseRecovery!: () => void;
      let authorityAcquired!: () => void;
      const release = new Promise<void>((resolve) => { releaseRecovery = resolve; });
      const acquired = new Promise<void>((resolve) => { authorityAcquired = resolve; });
      const recovery = database.sql.begin(async (transaction) => {
        await acquireOrphanClaimRecoveryAuthorityInTransaction(transaction, {
          claimId: seeded.claimId,
          runId: seeded.envelope.runId,
          workflowStepId: seeded.envelope.workflowStepId,
          storyId: null,
          claimAgentId: seeded.envelope.claimAgentId,
        });
        authorityAcquired();
        await release;
        await closeExactSingleStepClaimInTransaction(transaction, {
          envelope: seeded.envelope,
          outcome: "infra_retry",
          diagnostic: "recovery won before runtime quarantine",
        });
      });
      await acquired;
      const quarantine = seeded.sessions.quarantine({
        sessionId: runtimeBefore.sessionId,
        expectedOwnerInstanceId: runtimeBefore.ownerInstanceId,
        expectedStateVersion: runtimeBefore.stateVersion,
        diagnostic: "stale quarantine CAS must lose",
      });
      await waitForBlockedRuntimeQuarantine(database);
      releaseRecovery();
      await recovery;
      await assert.rejects(quarantine, /RUNTIME_SESSION_QUARANTINE_CAS_LOST/);
      const owner = await database.sql<Array<{
        outcome: string;
        runtime_state: string;
        state_version: number;
      }>>`
        SELECT cl.outcome, runtime.state AS runtime_state, runtime.state_version
          FROM claim_log cl
          JOIN runtime_sessions runtime ON runtime.claim_id = cl.id
         WHERE cl.id = ${seeded.claimId}
      `;
      assert.deepEqual({ ...owner[0] }, {
        outcome: "infra_retry",
        runtime_state: "drained",
        state_version: runtimeBefore.stateVersion + 1,
      });
    } finally {
      await database.cleanup();
    }
  });
});
