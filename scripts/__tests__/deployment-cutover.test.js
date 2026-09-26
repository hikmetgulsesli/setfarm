import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";
import path from "node:path";
import { spawnSync, execFileSync } from "node:child_process";
import { fixture, run, write, git } from "./fixtures/deployment-cutover-bootstrap.mjs";
import { retainedFixture } from "./fixtures/deployment-cutover-retained-profile.mjs";

const task6aCatalogSource = kind => `import {createHash} from 'node:crypto';
  const canonical=value=>value===null||typeof value!=='object'?JSON.stringify(value)
    :Array.isArray(value)?'['+value.map(canonical).join(',')+']'
    :'{'+Object.keys(value).sort().map(key=>JSON.stringify(key)+':'+canonical(value[key])).join(',')+'}';
  const sealed=(body,key)=>Object.freeze({...body,[key]:createHash('sha256').update(canonical(body)).digest('hex')});
  export async function observeCodeOwnedTask6aWriterCatalogHostV2(){
    if(arguments.length)throw Error('UNEXPECTED_INPUT');
    const kind=${JSON.stringify(kind)};if(kind==='error')throw Error('PRIVATE_DATABASE_PASSWORD');
    const mission=sealed({schema:'setfarm.internal-production-task6a-mission-control-launcher.v2',
      authority:'diagnostic-only',cutoverAdmission:'not-granted',physicalIdentityProvenance:'unverified',
      label:'com.setrox.mission-control',state:'running',activeCount:1,databaseRole:'fixture'},'observationHash');
    const writer=sealed({schema:'setfarm.internal-production-task6a-writer-database-snapshot.v2',
      authority:'diagnostic-only',temporalScope:'catalog-snapshot-and-live-session-sample',
      cutoverAdmission:'not-granted',physicalIdentityProvenance:'unverified',
      database:Object.freeze({databaseName:'setfarm',databaseOwnerRole:'fixture',sessionRole:'fixture',
        effectiveRole:'fixture',login:kind==='malformed-writer-flag'?'true':true,superuser:true,bypassRls:true,createRole:true,
        createDatabase:true,otherSessionCount:1})},'snapshotHash');
    const pair=sealed({schema:'setfarm.internal-production-pre32-physical-database-pair.v7',
      authority:'diagnostic-only',physicalIdentityProvenance:'unverified',heldPair:Object.freeze({fixture:'held'}),
      pre32Database:Object.freeze({schema:'setfarm.internal-production-pre32-active-binding-snapshot.v7'})},'pairHash');
    const old=sealed({schema:'setfarm.internal-production-task6a-three-launcher-host.v2',
      authority:'diagnostic-only',cutoverAdmission:'not-granted',physicalIdentityProvenance:'unverified',
      temporalScope:'held-physical-two-pass-sequential-database-samples',roleAgreement:true,
      missionControlLauncher:mission,pre32HostPairV7:pair,writerDatabaseSnapshotV2:writer},'diagnosticHash');
    const names=['directMembership','directInherit','directSet','directAdmin','schema','ownedSchema',
      'relation','ownedRelation','sequence','ownedSequence','routine','ownedRoutine',
      'securityDefinerRoutine','selectedExplicitAclRow','defaultAcl','ownedDefaultAcl'];
    const counts=Object.freeze(Object.fromEntries(names.map(name=>[name,0])));
    const catalog=sealed({schema:'setfarm.internal-production-task6a-writer-catalog-topology.v2',
      authority:'diagnostic-only',cutoverAdmission:'not-granted',physicalIdentityProvenance:'unverified',
      temporalScope:'catalog-transaction-snapshot',membershipScope:'direct-only-non-transitive',
      catalogScope:'coarse-selected-catalog-row-counts-not-permission-proof',databaseName:'setfarm',
      sessionRole:kind==='crossed-role'?'other':'fixture',serverVersion:170010,counts},'topologyHash');
    const body={schema:'setfarm.internal-production-task6a-writer-catalog-host.v2',
      authority:kind==='self-consistent-cutover'?'cutover':'diagnostic-only',
      cutoverAdmission:'not-granted',physicalIdentityProvenance:'unverified',
      temporalScope:'held-physical-two-pass-sequential-catalog-sample',threeLauncherHostV2:old,
      writerCatalogTopologyV2:catalog};
    const result=sealed(body,'diagnosticHash');
    return kind==='tampered-hash'?Object.freeze({...result,diagnosticHash:'0'.repeat(64)}):result;
  }`;
const task6aCatalogSources = kind => ({ "internal-production/baseline-task6a-writer-catalog-host-v2": task6aCatalogSource(kind) });

test("bootstrap publishes only an authenticated no-write Task6A writer catalog diagnostic", () => fixture(root => {
  const result = run(root, ["inspect-task6a-writer-catalog-host-v2", "--json"]);
  assert.equal(result.status, 0, result.stderr);
  const observed = JSON.parse(result.stdout).task6aWriterCatalogHostV2;
  assert.equal(observed.authority, "diagnostic-only");
  assert.equal(observed.cutoverAdmission, "not-granted");
  assert.equal(observed.writerCatalogTopologyV2.counts.selectedExplicitAclRow, 0);
  assert.doesNotMatch(result.stdout, /PRIVATE_DATABASE_PASSWORD/);
}, source => source, { extraSources: task6aCatalogSources("valid") }));

for (const kind of ["tampered-hash", "self-consistent-cutover", "crossed-role", "malformed-writer-flag", "error"]) {
  test(`bootstrap refuses Task6A writer catalog ${kind} without leaking private cause`, () => fixture(root => {
    const result = run(root, ["inspect-task6a-writer-catalog-host-v2", "--json"]);
    assert.equal(result.status, 1);
    assert.equal(result.stdout, "");
    const lines = result.stderr.trimEnd().split("\n");
    assert.equal(lines[0], "DEPLOYMENT_CUTOVER_BOOTSTRAP_REFUSED");
    assert.equal(JSON.parse(lines[1]).stage, "task6a-writer-catalog-host");
    assert.equal(lines.length, 2);
    assert.doesNotMatch(result.stderr, /PRIVATE_DATABASE_PASSWORD/);
  }, source => source, { extraSources: task6aCatalogSources(kind) }));
}

const pre32Source = kind => `import fs from 'node:fs';import path from 'node:path';
  import {createHash} from 'node:crypto';
  const canonical=value=>value===null||typeof value!=='object'?JSON.stringify(value)
    :Array.isArray(value)?'['+value.map(canonical).join(',')+']'
    :'{'+Object.keys(value).sort().map(key=>JSON.stringify(key)+':'+canonical(value[key])).join(',')+'}';
  export async function observeCodeOwnedPositiveWorktreePre32HostPairV4(){
    if(arguments.length)throw Error('UNEXPECTED_INPUT');
    const kind=${JSON.stringify(kind)};
    if(kind==='transport-import'){
      const transport=await import('../../scripts/deployment-cutover-passive-home.mjs');
      if(typeof transport.monitorDeploymentCutoverPassiveProcessV1!=='function')throw Error('TRANSPORT_MISSING');
    }
    const marker=path.join(process.cwd(),'.setfarm','pre32-called');
    fs.mkdirSync(path.dirname(marker),{recursive:true});fs.appendFileSync(marker,'x');
    if(kind==='error')throw Error('PRIVATE_DATABASE_PASSWORD');
    if(['point-phase','bad-point-phase','crossed-point-phase','crossed-first-point','proxy-point-phase','accessor-point-phase'].includes(kind)){
      const error=Error('INTERNAL_PRODUCTION_POSITIVE_WORKTREE_PRE32_HOST_PAIR_INVALID');
      Object.defineProperty(error,'pre32PairPhase',{value:kind==='crossed-point-phase'?'database-callback':'physical-first-pass'});
      const point=Object.freeze({schema:'setfarm.internal-production-positive-worktree-physical-refusal-point.v1',
        operation:kind==='crossed-first-point'?'candidate-recheck-compare':'candidate-lsof',
        candidateOrdinal:kind==='bad-point-phase'?999:7});
      if(kind==='accessor-point-phase')Object.defineProperty(error,'pre32PhysicalPoint',{get(){throw Error('PRIVATE_DATABASE_PASSWORD')}});
      else Object.defineProperty(error,'pre32PhysicalPoint',{value:kind==='proxy-point-phase'?new Proxy(point,{}):point});
      throw Object.freeze(error);
    }
    const phases={'database-phase':'database-callback','physical-phase':'physical-second-pass',
      'cleanup-phase':'launcher-cleanup','spoofed-phase':'outside-contract','proxy-phase':'database-callback'};
    if(phases[kind]){
      const error=Error('INTERNAL_PRODUCTION_POSITIVE_WORKTREE_PRE32_HOST_PAIR_INVALID');
      Object.defineProperty(error,'pre32PairPhase',{value:phases[kind]});Object.freeze(error);
      throw kind==='proxy-phase'?new Proxy(error,{}):error;
    }
    if(kind==='accessor-phase'){
      const error=Error('INTERNAL_PRODUCTION_POSITIVE_WORKTREE_PRE32_HOST_PAIR_INVALID');
      Object.defineProperty(error,'pre32PairPhase',{get(){throw Error('PRIVATE_DATABASE_PASSWORD')}});
      throw error;
    }
    const body={schema:'setfarm.internal-production-pre32-physical-database-pair.v4',
      authority:kind==='self-consistent-cutover'?'cutover':'diagnostic-only',physicalIdentityProvenance:'unverified',
      heldPair:Object.freeze({fixture:'held'}),pre32Database:Object.freeze({fixture:'one-transaction'})};
    const pairHash=createHash('sha256').update(canonical(body)).digest('hex');
    return Object.freeze({...body,...(kind==='malformed'?{authority:'cutover'}:{}),pairHash});
  }
  export async function observeCodeOwnedPositiveWorktreePre32HostPairV5(){
    if(arguments.length)throw Error('UNEXPECTED_INPUT');
    const v4=await observeCodeOwnedPositiveWorktreePre32HostPairV4();
    const {pairHash,...old}=v4;
    const body={...old,schema:'setfarm.internal-production-pre32-physical-database-pair.v5'};
    return Object.freeze({...body,pairHash:createHash('sha256').update(canonical(body)).digest('hex')});
  }
  export async function observeCodeOwnedPositiveWorktreePre32HostPairV6(){
    if(arguments.length)throw Error('UNEXPECTED_INPUT');
    const v5=await observeCodeOwnedPositiveWorktreePre32HostPairV5();
    const {pairHash,...old}=v5;
    const body={...old,schema:'setfarm.internal-production-pre32-physical-database-pair.v6'};
    return Object.freeze({...body,pairHash:createHash('sha256').update(canonical(body)).digest('hex')});
  }
  export async function observeCodeOwnedPositiveWorktreePre32HostPairV7(){
    if(arguments.length)throw Error('UNEXPECTED_INPUT');
    const kind=${JSON.stringify(kind)};
    const v6=await observeCodeOwnedPositiveWorktreePre32HostPairV6();
    const {pairHash,...old}=v6;
    const body={...old,schema:'setfarm.internal-production-pre32-physical-database-pair.v7',
      pre32Database:Object.freeze({schema:'setfarm.internal-production-pre32-active-binding-snapshot.v7',
        authority:'diagnostic-only',tableLockScope:'fixed-pre32-legacy-superset',
        journalIdentity:kind==='wrong-journal-label'?'tail-ordinal-state-only'
          :'source-ordinal-name-checksum-state-1-through-31',lockState:'released-at-return'})};
    return Object.freeze({...body,pairHash:createHash('sha256').update(canonical(body)).digest('hex')});
  }
  export async function observeCodeOwnedPositiveWorktreeActiveBindingHostPairV1(){
    if(arguments.length)throw Error('UNEXPECTED_INPUT');
    const v6=await observeCodeOwnedPositiveWorktreePre32HostPairV6();
    const body={schema:'setfarm.internal-production-active-binding-physical-database-pair.v1',
      authority:v6.authority,physicalIdentityProvenance:v6.physicalIdentityProvenance,
      heldPair:v6.heldPair,activeBindingDatabase:Object.freeze({fixture:'active-binding'})};
    return Object.freeze({...body,pairHash:createHash('sha256').update(canonical(body)).digest('hex')});
  }
  export async function observeCodeOwnedPositiveWorktreeHeldBindingCandidatesV1(){
    if(arguments.length)throw Error('UNEXPECTED_INPUT');
    const kind=${JSON.stringify(kind)};
    if(kind==='held-candidate-error'){
      const error=Error('INTERNAL_PRODUCTION_POSITIVE_WORKTREE_ACTIVE_BINDING_HOST_PAIR_INVALID');
      Object.defineProperty(error,'activeBindingPairPhase',{value:'database-callback'});
      throw Object.freeze(error);
    }
    const pair=await observeCodeOwnedPositiveWorktreeActiveBindingHostPairV1();
    const joinedBody={schema:'setfarm.internal-production-held-binding-candidates.v1',
      authority:'diagnostic-only',physicalIdentityProvenance:'unverified',
      receiptStatus:kind==='wrong-receipt-label'?'verified':'required-unpublished',
      candidates:Object.freeze([]),unresolvedAttemptIds:Object.freeze([]),unresolvedSessionIds:Object.freeze([])};
    const joinedCandidates=Object.freeze({...joinedBody,
      projectionHash:createHash('sha256').update(canonical(joinedBody)).digest('hex')});
    const body={schema:'setfarm.internal-production-held-binding-physical-database-pair.v1',
      authority:'diagnostic-only',physicalIdentityProvenance:'unverified',
      heldActiveBindingPair:pair,joinedCandidates};
    return Object.freeze({...body,pairHash:createHash('sha256').update(canonical(body)).digest('hex')});
  }`;
const pre32Sources = kind => ({ "internal-production/baseline-positive-worktree-host-pair-v2": pre32Source(kind) });
const pre32AnnotationSource = kind => `import fs from 'node:fs';import path from 'node:path';import {createHash} from 'node:crypto';
  const canonical=value=>value===null||typeof value!=='object'?JSON.stringify(value)
    :Array.isArray(value)?'['+value.map(canonical).join(',')+']'
    :'{'+Object.keys(value).sort().map(key=>JSON.stringify(key)+':'+canonical(value[key])).join(',')+'}';
  const hash=value=>createHash('sha256').update(canonical(value)).digest('hex');
  export async function observeCodeOwnedPositiveWorktreePre32AbsenceAnnotationV1(){
    if(arguments.length)throw Error('UNEXPECTED_INPUT');
    const marker=path.join(process.cwd(),'.setfarm','pre32-annotation-called');
    fs.mkdirSync(path.dirname(marker),{recursive:true});fs.appendFileSync(marker,'x');
    const kind=${JSON.stringify(kind)};if(kind==='error')throw Error('PRIVATE_DATABASE_PASSWORD');
    const heldPair=Object.freeze({schema:'setfarm.internal-production-positive-worktree-host-pair.v2',
      pairHash:'a'.repeat(64),physicalCatalog:Object.freeze({catalogHash:'b'.repeat(64),blockers:Object.freeze([])})});
    const pairBody={schema:'setfarm.internal-production-pre32-physical-database-pair.v6',
      authority:'diagnostic-only',physicalIdentityProvenance:'unverified',heldPair,
      pre32Database:Object.freeze({fixture:'one-transaction'})};
    const sourcePair=Object.freeze({...pairBody,pairHash:hash(pairBody)});
    const witnessBody={schema:'setfarm.internal-production-prunable-absence-witness.v3',
      authority:'diagnostic-only',temporalScope:'v2-bracketed-two-pass',hostPair:heldPair,
      sourcePairHash:kind==='crossed-witness'?'d'.repeat(64):heldPair.pairHash,
      sourceCatalogHash:heldPair.physicalCatalog.catalogHash,witnesses:Object.freeze([]),
      unwitnessedPrunableCount:0};
    const witness=Object.freeze({...witnessBody,witnessHash:hash(witnessBody)});
    const body={schema:'setfarm.internal-production-pre32-absent-git-record-annotation.v1',
      authority:kind==='cutover'?'cutover':'diagnostic-only',physicalIdentityProvenance:'unverified',
      sourcePair,witness,witnessedBlockers:Object.freeze([]),remainingBlockers:Object.freeze([])};
    return Object.freeze({...body,annotationHash:hash(body)});
  }`;
const pre32AnnotationSources = kind => ({
  "internal-production/baseline-positive-worktree-pre32-absence-annotation-v1": pre32AnnotationSource(kind),
});

const pre32AnnotationV2Source = kind => `import fs from 'node:fs';import path from 'node:path';import {createHash} from 'node:crypto';
  const canonical=value=>value===null||typeof value!=='object'?JSON.stringify(value)
    :Array.isArray(value)?'['+value.map(canonical).join(',')+']'
    :'{'+Object.keys(value).sort().map(key=>JSON.stringify(key)+':'+canonical(value[key])).join(',')+'}';
  const hash=value=>createHash('sha256').update(canonical(value)).digest('hex');
  export async function observeCodeOwnedPositiveWorktreePre32AbsenceAnnotationV2(){
    if(arguments.length)throw Error('UNEXPECTED_INPUT');
    const marker=path.join(process.cwd(),'.setfarm','pre32-v7-annotation-called');
    fs.mkdirSync(path.dirname(marker),{recursive:true});fs.appendFileSync(marker,'x');
    const kind=${JSON.stringify(kind)};if(kind==='error')throw Error('PRIVATE_DATABASE_PASSWORD');
    const base=path.join(process.cwd(),'runtime','story-worktrees');
    const root=base+'/a';
    const nonGitRoot=path.posix.join('/','home','fixture-user','ai','setrox','.worktrees','data');
    const residual=['bounded','pid-residual','unsorted-residual','duplicate-residual'].includes(kind);
    const blockers=[Object.freeze({root,reason:'prunable-git-worktree'}),
      ...(residual?[Object.freeze({root:nonGitRoot,reason:'non-git-child'})]:[])].sort((a,b)=>
        Buffer.compare(Buffer.from(a.root),Buffer.from(b.root)));
    if(kind==='unsorted-residual')blockers.reverse();
    if(kind==='duplicate-residual'){
      const index=blockers.findIndex(row=>row.reason==='non-git-child');
      blockers.splice(index,0,blockers[index]);
    }
    const catalogBody={schema:'setfarm.internal-production-positive-worktree-physical-catalog.v2',
      status:'unresolved',observerPidExcluded:1234,entries:Object.freeze(residual?[Object.freeze({
        root:nonGitRoot,zone:'retained-zone',kind:'unresolved',dev:'1',ino:'2',birthtimeNs:'3',
        gitPrimaryRoot:null,dirty:null,sourceBuildProvenance:'unverified',
        referencingPids:Object.freeze(kind==='pid-residual'?[4321]:[])})]:[]),
      absentBases:Object.freeze(kind==='forged-absence'?[]:[base]),incidentalFiles:Object.freeze([]),
      blockers:Object.freeze(blockers)};
    const physicalCatalog=Object.freeze({...catalogBody,
      catalogHash:kind==='wrong-catalog-hash'?'b'.repeat(64):hash(catalogBody)});
    const activeBody={schema:'setfarm.internal-production-positive-worktree-active-rows.v2',
      authority:'diagnostic-only',physicalIdentityProvenance:'unverified',activeRuns:Object.freeze([]),
      openClaims:Object.freeze([]),activeAttempts:Object.freeze([]),activeSessions:Object.freeze([]),
      counts:Object.freeze({runCount:0,claimCount:0,attemptCount:0,sessionCount:0})};
    const activeRows=Object.freeze({...activeBody,
      snapshotHash:kind==='wrong-active-hash'?'e'.repeat(64):hash(activeBody)});
    const heldBody={schema:'setfarm.internal-production-positive-worktree-host-pair.v2',
      authority:'diagnostic-only',physicalIdentityProvenance:'unverified',physicalCatalog,
      databaseSnapshot:activeRows};
    const heldPair=Object.freeze({...heldBody,pairHash:kind==='wrong-held-hash'?'a'.repeat(64):hash(heldBody)});
    const inventoryBody={schema:'setfarm.legacy-finding-publication-inventory.v1',entries:Object.freeze([])};
    const legacyFindingPublicationInventory=Object.freeze({...inventoryBody,inventoryHash:hash(inventoryBody)});
    const legacyCensus=Object.freeze({activeRunCount:0,openClaimCount:0,executionAttemptCount:0,
      activeRuntimeSessionCount:0,activeCompletionOwnerCount:0,unsettledMandatoryEffectCount:0,
      artifactReservationCount:0,publicationBatchCount:0,artifactPublicationCount:0,
      terminationOwnerCount:0,findingOwnerCount:0,recoveryOwnerCount:0,operationalDeliveryCount:0,
      ...(kind==='missing-census'?{}:{legacyFindingPublicationInventory})});
    const bindingBody={schema:'setfarm.internal-production-positive-worktree-binding-rows.v1',
      authority:kind==='binding-cutover'?'cutover':'diagnostic-only',
      physicalIdentityProvenance:'unverified',activeAttempts:Object.freeze([]),
      activeSessions:Object.freeze([]),counts:Object.freeze({attemptCount:kind==='wrong-binding-count'?1:0,
        sessionCount:0})};
    const bindingRows=Object.freeze({...bindingBody,
      snapshotHash:kind==='wrong-binding-hash'?'f'.repeat(64):hash(bindingBody)});
    const databaseBody={schema:'setfarm.internal-production-pre32-active-binding-snapshot.v7',
      authority:kind==='nested-cutover'?'cutover':'diagnostic-only',tableLockScope:'fixed-pre32-legacy-superset',
      journalIdentity:kind==='wrong-journal'?'unknown':'source-ordinal-name-checksum-state-1-through-31',
      lockState:kind==='wrong-lock'?'held-after-return':'released-at-return',
      legacyCensus,activeRows:kind==='crossed-active'?Object.freeze({...activeRows}):activeRows,
      bindingRows,quarantinedRuntimeSessionCount:0,
      ...(kind==='extra-db-field'?{cutoverReady:true}:{})};
    const pre32Database=Object.freeze({...databaseBody,snapshotHash:hash(databaseBody)});
    const pairBody={schema:'setfarm.internal-production-pre32-physical-database-pair.v7',
      authority:'diagnostic-only',physicalIdentityProvenance:'unverified',heldPair,pre32Database};
    const sourcePair=Object.freeze({...pairBody,pairHash:kind==='wrong-pair-hash'?'c'.repeat(64):hash(pairBody)});
    const witnessBody={schema:'setfarm.internal-production-prunable-absence-witness.v3',
      authority:'diagnostic-only',temporalScope:'v2-bracketed-two-pass',hostPair:heldPair,
      sourcePairHash:heldPair.pairHash,sourceCatalogHash:heldPair.physicalCatalog.catalogHash,
      witnesses:Object.freeze([Object.freeze({root,absentBase:base}),
        ...(kind==='extra-witness'?[Object.freeze({root:base+'/z',absentBase:base})]:[])]),
      unwitnessedPrunableCount:0};
    const witness=Object.freeze({...witnessBody,witnessHash:hash(witnessBody)});
    const body={schema:'setfarm.internal-production-pre32-absent-git-record-annotation.v2',
      authority:kind==='cutover'?'cutover':'diagnostic-only',physicalIdentityProvenance:'unverified',
      sourcePair,witness,witnessedBlockers:Object.freeze(blockers.filter(row=>row.reason==='prunable-git-worktree')),
      remainingBlockers:Object.freeze(blockers.filter(row=>row.reason==='non-git-child'))};
    return Object.freeze({...body,annotationHash:hash(body)});
  }`;
const pre32AnnotationV2Sources = kind => ({
  "internal-production/baseline-positive-worktree-pre32-absence-annotation-v2": pre32AnnotationV2Source(kind),
});

const pre32ResidualV3Source = kind => `import fs from 'node:fs';import path from 'node:path';import {createHash} from 'node:crypto';
  import {observeCodeOwnedPositiveWorktreePre32AbsenceAnnotationV2} from './baseline-positive-worktree-pre32-absence-annotation-v2.js';
  const canonical=value=>value===null||typeof value!=='object'?JSON.stringify(value)
    :Array.isArray(value)?'['+value.map(canonical).join(',')+']'
    :'{'+Object.keys(value).sort().map(key=>JSON.stringify(key)+':'+canonical(value[key])).join(',')+'}';
  const hash=value=>createHash('sha256').update(canonical(value)).digest('hex');
  export async function observeCodeOwnedPositiveWorktreePre32ResidualAbsenceAnnotationV3(){
    if(arguments.length)throw Error('UNEXPECTED_INPUT');
    const marker=path.join(process.cwd(),'.setfarm','pre32-v3-called');
    fs.mkdirSync(path.dirname(marker),{recursive:true});fs.appendFileSync(marker,'x');
    const kind=${JSON.stringify(kind)};if(kind==='error')throw Error('PRIVATE_DATABASE_PASSWORD');
    const sourceAnnotation=await observeCodeOwnedPositiveWorktreePre32AbsenceAnnotationV2();
    const bounded=kind==='proxy-array'?new Proxy(Object.freeze([]),{get(target,key,receiver){
      if(key==='toJSON')return ()=>[{root:'/forged',reason:'non-git-child'}];
      return Reflect.get(target,key,receiver)}})
      :kind==='array-tojson'?Object.freeze(Object.assign([],{
        toJSON(){return [{root:'/forged',reason:'non-git-child'}]}}))
      :Object.freeze(kind==='forged-bounded'?[sourceAnnotation.witnessedBlockers[0]]
        :['bounded','forged-pid-bounded','unsorted-residual','duplicate-residual'].includes(kind)
          ?[...sourceAnnotation.remainingBlockers]:[]);
    const body={schema:'setfarm.internal-production-pre32-residual-absence-annotation.v3',
      authority:kind==='cutover'?'cutover':'diagnostic-only',physicalIdentityProvenance:'unverified',
      temporalScope:kind==='wrong-temporal'?'continuous':'v7-held-two-pass',sourceAnnotation,
      boundedAbsenceBlockers:bounded,
      otherResidualBlockers:Object.freeze(kind==='pid-residual'?[...sourceAnnotation.remainingBlockers]:[]),
      ...(kind==='extra-field'?{zeroOwner:true}:{})};
    const result={...body,annotationHash:kind==='wrong-hash'?'a'.repeat(64):hash(body)};
    if(kind==='prototype-forgery')Object.setPrototypeOf(result,{toJSON(){return {...result,authority:'cutover'}}});
    return Object.freeze(result);
  }`;
const pre32ResidualV3Sources = (kind, nestedKind = "valid") => ({
  ...pre32AnnotationV2Sources(nestedKind),
  "internal-production/baseline-positive-worktree-pre32-residual-absence-annotation-v3": pre32ResidualV3Source(kind),
});

test("bootstrap exposes authenticated V3 bounded absence without ownership authority", () => fixture(root => {
  const result = run(root, ["inspect-pre32-residual-absence-annotation-v3", "--json"]);
  assert.equal(result.status, 0, result.stderr);
  const observed = JSON.parse(result.stdout);
  const annotation = observed.pre32ResidualAbsenceAnnotationV3;
  assert.equal(annotation.schema, "setfarm.internal-production-pre32-residual-absence-annotation.v3");
  assert.equal(annotation.authority, "diagnostic-only");
  assert.equal(annotation.physicalIdentityProvenance, "unverified");
  assert.equal(annotation.temporalScope, "v7-held-two-pass");
  assert.equal(annotation.sourceAnnotation.sourcePair.pre32Database.journalIdentity,
    "source-ordinal-name-checksum-state-1-through-31");
  assert.equal(annotation.sourceAnnotation.witnessedBlockers.length, 1);
  assert.deepEqual(annotation.boundedAbsenceBlockers, []);
  assert.deepEqual(annotation.otherResidualBlockers, []);
  assert.equal(Object.hasOwn(observed, "pre32AbsenceAnnotationV2"), false);
  assert.equal(fs.readFileSync(path.join(root, ".setfarm/pre32-v3-called"), "utf8"), "x");
}, undefined, { extraSources: pre32ResidualV3Sources("valid") }));

for (const [kind, expectedBounded, expectedOther] of [["bounded", 1, 0], ["pid-residual", 0, 1]]) {
  test(`V3 bootstrap preserves ${kind} partition by blocker identity`, () => fixture(root => {
    const result = run(root, ["inspect-pre32-residual-absence-annotation-v3", "--json"]);
    assert.equal(result.status, 0, result.stderr);
    const annotation = JSON.parse(result.stdout).pre32ResidualAbsenceAnnotationV3;
    assert.equal(annotation.boundedAbsenceBlockers.length, expectedBounded);
    assert.equal(annotation.otherResidualBlockers.length, expectedOther);
    assert.equal(annotation.sourceAnnotation.sourcePair.heldPair.physicalCatalog.blockers.length, 2);
  }, undefined, { extraSources: pre32ResidualV3Sources(kind, kind) }));
}

for (const [kind, nestedKind] of [["error", "valid"], ["cutover", "valid"],
  ["wrong-temporal", "valid"], ["wrong-hash", "valid"], ["extra-field", "valid"],
  ["prototype-forgery", "valid"], ["proxy-array", "valid"], ["array-tojson", "valid"],
  ["forged-bounded", "valid"], ["forged-pid-bounded", "pid-residual"],
  ["unsorted-residual", "unsorted-residual"], ["duplicate-residual", "duplicate-residual"],
  ["valid", "wrong-journal"], ["valid", "crossed-active"]]) {
  test(`V3 bootstrap refuses ${kind}/${nestedKind} without private cause`, () => fixture(root => {
    const result = run(root, ["inspect-pre32-residual-absence-annotation-v3", "--json"]);
    assert.equal(result.status, 1);
    assert.equal(result.stdout, "");
    assert.match(result.stderr, /^DEPLOYMENT_CUTOVER_BOOTSTRAP_REFUSED\n/);
    assert.doesNotMatch(result.stderr, /PRIVATE_DATABASE_PASSWORD/);
  }, undefined, { extraSources: pre32ResidualV3Sources(kind, nestedKind) }));
}

test("V3 bootstrap rejects extra argv before observer invocation", () => fixture(root => {
  const result = run(root, ["inspect-pre32-residual-absence-annotation-v3", "--json", "extra"]);
  assert.equal(result.status, 1);
  assert.equal(result.stdout, "");
  assert.equal(fs.existsSync(path.join(root, ".setfarm/pre32-v3-called")), false);
}, undefined, { extraSources: pre32ResidualV3Sources("valid") }));

test("V3 bootstrap rejects source tampering before observer invocation", () => fixture(root => {
  fs.appendFileSync(path.join(root, "src/internal-production/baseline-positive-worktree-pre32-residual-absence-annotation-v3.ts"),
    "\nthrow Error('PRIVATE_DATABASE_PASSWORD');\n");
  const result = run(root, ["inspect-pre32-residual-absence-annotation-v3", "--json"]);
  assert.equal(result.status, 1);
  assert.equal(result.stdout, "");
  assert.equal(fs.existsSync(path.join(root, ".setfarm/pre32-v3-called")), false);
  assert.doesNotMatch(result.stderr, /PRIVATE_DATABASE_PASSWORD/);
}, undefined, { extraSources: pre32ResidualV3Sources("valid") }));

test("bootstrap exposes exact-journal V7 absent-record annotation without authority", () => fixture(root => {
  const result = run(root, ["inspect-pre32-absence-annotation-v2", "--json"]);
  assert.equal(result.status, 0, result.stderr);
  const observed = JSON.parse(result.stdout);
  assert.equal(observed.pre32AbsenceAnnotationV2.schema,
    "setfarm.internal-production-pre32-absent-git-record-annotation.v2");
  assert.equal(observed.pre32AbsenceAnnotationV2.sourcePair.pre32Database.journalIdentity,
    "source-ordinal-name-checksum-state-1-through-31");
  assert.equal(observed.pre32AbsenceAnnotationV2.authority, "diagnostic-only");
  assert.equal(Object.hasOwn(observed, "pre32HostPairV7"), false);
  assert.equal(fs.readFileSync(path.join(root, ".setfarm/pre32-v7-annotation-called"), "utf8"), "x");
}, undefined, { extraSources: pre32AnnotationV2Sources("valid") }));

for (const kind of ["error", "cutover", "wrong-journal", "wrong-pair-hash",
  "wrong-catalog-hash", "wrong-active-hash", "wrong-held-hash", "crossed-active",
  "forged-absence", "extra-witness", "nested-cutover", "wrong-lock",
  "wrong-binding-hash", "binding-cutover", "wrong-binding-count", "missing-census",
  "extra-db-field"]) {
  test(`V7 annotation bootstrap refuses ${kind} without private cause`, () => fixture(root => {
    const result = run(root, ["inspect-pre32-absence-annotation-v2", "--json"]);
    assert.equal(result.status, 1);
    assert.equal(result.stdout, "");
    assert.match(result.stderr, /^DEPLOYMENT_CUTOVER_BOOTSTRAP_REFUSED\n/);
    assert.doesNotMatch(result.stderr, /PRIVATE_DATABASE_PASSWORD/);
  }, undefined, { extraSources: pre32AnnotationV2Sources(kind) }));
}

test("V7 annotation bootstrap rejects extra argv before observer invocation", () => fixture(root => {
  const result = run(root, ["inspect-pre32-absence-annotation-v2", "--json", "extra"]);
  assert.equal(result.status, 1);
  assert.equal(result.stdout, "");
  assert.equal(fs.existsSync(path.join(root, ".setfarm/pre32-v7-annotation-called")), false);
}, undefined, { extraSources: pre32AnnotationV2Sources("valid") }));

test("V7 annotation bootstrap rejects source tampering before observer invocation", () => fixture(root => {
  fs.appendFileSync(path.join(root, "src/internal-production/baseline-positive-worktree-pre32-absence-annotation-v2.ts"),
    "\nthrow Error('PRIVATE_DATABASE_PASSWORD');\n");
  const result = run(root, ["inspect-pre32-absence-annotation-v2", "--json"]);
  assert.equal(result.status, 1);
  assert.equal(result.stdout, "");
  assert.equal(fs.existsSync(path.join(root, ".setfarm/pre32-v7-annotation-called")), false);
  assert.doesNotMatch(result.stderr, /PRIVATE_DATABASE_PASSWORD/);
}, undefined, { extraSources: pre32AnnotationV2Sources("valid") }));

test("bootstrap exposes an authenticated V6 absent-record annotation without cutover authority", () => fixture(root => {
  const result = run(root, ["inspect-pre32-absence-annotation-v1", "--json"]);
  assert.equal(result.status, 0, result.stderr);
  const observed = JSON.parse(result.stdout);
  assert.equal(observed.pre32AbsenceAnnotationV1.schema,
    "setfarm.internal-production-pre32-absent-git-record-annotation.v1");
  assert.equal(observed.pre32AbsenceAnnotationV1.authority, "diagnostic-only");
  assert.equal(observed.pre32AbsenceAnnotationV1.witnessedBlockers.length, 0);
  assert.equal(Object.hasOwn(observed, "pre32HostPairV6"), false);
  assert.equal(fs.readFileSync(path.join(root, ".setfarm/pre32-annotation-called"), "utf8"), "x");
}, undefined, { extraSources: pre32AnnotationSources("valid") }));

for (const kind of ["error", "cutover", "crossed-witness"]) {
  test(`pre32 annotation bootstrap refuses ${kind} without leaking private cause`, () => fixture(root => {
    const result = run(root, ["inspect-pre32-absence-annotation-v1", "--json"]);
    assert.equal(result.status, 1);
    assert.equal(result.stdout, "");
    assert.match(result.stderr, /^DEPLOYMENT_CUTOVER_BOOTSTRAP_REFUSED\n/);
    assert.doesNotMatch(result.stderr, /PRIVATE_DATABASE_PASSWORD/);
  }, undefined, { extraSources: pre32AnnotationSources(kind) }));
}

test("pre32 annotation bootstrap rejects extra argv before observer invocation", () => fixture(root => {
  const result = run(root, ["inspect-pre32-absence-annotation-v1", "--json", "extra"]);
  assert.equal(result.status, 1);
  assert.equal(result.stdout, "");
  assert.equal(fs.existsSync(path.join(root, ".setfarm/pre32-annotation-called")), false);
}, undefined, { extraSources: pre32AnnotationSources("valid") }));

test("pre32 annotation bootstrap rejects source tampering before observer invocation", () => fixture(root => {
  fs.appendFileSync(path.join(root, "src/internal-production/baseline-positive-worktree-pre32-absence-annotation-v1.ts"),
    "\nthrow Error('PRIVATE_DATABASE_PASSWORD');\n");
  const result = run(root, ["inspect-pre32-absence-annotation-v1", "--json"]);
  assert.equal(result.status, 1);
  assert.equal(result.stdout, "");
  assert.equal(fs.existsSync(path.join(root, ".setfarm/pre32-annotation-called")), false);
  assert.doesNotMatch(result.stderr, /PRIVATE_DATABASE_PASSWORD/);
}, undefined, { extraSources: pre32AnnotationSources("valid") }));

test("bootstrap invokes the authenticated pre32 diagnostic exactly once without caller input", () => fixture(root => {
  const result = run(root, ["inspect-pre32-host-pair", "--json"]);
  assert.equal(result.status, 0, result.stderr);
  const observed = JSON.parse(result.stdout);
  assert.equal(observed.pre32HostPair.schema, "setfarm.internal-production-pre32-physical-database-pair.v4");
  assert.equal(observed.pre32HostPair.authority, "diagnostic-only");
  assert.equal(observed.pre32HostPair.physicalIdentityProvenance, "unverified");
  assert.deepEqual(observed.pre32HostPair.heldPair, { fixture: "held" });
  assert.deepEqual(observed.pre32HostPair.pre32Database, { fixture: "one-transaction" });
  assert.equal(fs.readFileSync(path.join(root, ".setfarm/pre32-called"), "utf8"), "x");
  const other = run(root, ["inspect", "--json"]);
  assert.equal(other.status, 0, other.stderr);
  assert.equal(Object.hasOwn(JSON.parse(other.stdout), "pre32HostPair"), false);
}, undefined, { extraSources: pre32Sources("valid") }));

test("bootstrap exposes a separate authenticated V5 held diagnostic without changing V4", () => fixture(root => {
  const result = run(root, ["inspect-pre32-host-pair-v5", "--json"]);
  assert.equal(result.status, 0, result.stderr);
  const observed = JSON.parse(result.stdout);
  assert.equal(observed.pre32HostPairV5.schema, "setfarm.internal-production-pre32-physical-database-pair.v5");
  assert.equal(observed.pre32HostPairV5.authority, "diagnostic-only");
  assert.equal(observed.pre32HostPairV5.physicalIdentityProvenance, "unverified");
  assert.equal(Object.hasOwn(observed, "pre32HostPair"), false);
  assert.equal(fs.readFileSync(path.join(root, ".setfarm/pre32-called"), "utf8"), "x");
}, undefined, { extraSources: pre32Sources("valid") }));

test("bootstrap exposes a separate authenticated V6 held diagnostic without changing V4/V5", () => fixture(root => {
  const result = run(root, ["inspect-pre32-host-pair-v6", "--json"]);
  assert.equal(result.status, 0, result.stderr);
  const observed = JSON.parse(result.stdout);
  assert.equal(observed.pre32HostPairV6.schema, "setfarm.internal-production-pre32-physical-database-pair.v6");
  assert.equal(observed.pre32HostPairV6.authority, "diagnostic-only");
  assert.equal(observed.pre32HostPairV6.physicalIdentityProvenance, "unverified");
  assert.equal(Object.hasOwn(observed, "pre32HostPair"), false);
  assert.equal(Object.hasOwn(observed, "pre32HostPairV5"), false);
  assert.equal(fs.readFileSync(path.join(root, ".setfarm/pre32-called"), "utf8"), "x");
}, undefined, { extraSources: pre32Sources("valid") }));

test("bootstrap exposes a separate authenticated V7 held-journal diagnostic", () => fixture(root => {
  const result = run(root, ["inspect-pre32-host-pair-v7", "--json"]);
  assert.equal(result.status, 0, result.stderr);
  const observed = JSON.parse(result.stdout);
  assert.equal(observed.pre32HostPairV7.schema, "setfarm.internal-production-pre32-physical-database-pair.v7");
  assert.equal(observed.pre32HostPairV7.authority, "diagnostic-only");
  assert.equal(observed.pre32HostPairV7.physicalIdentityProvenance, "unverified");
  for (const key of ["pre32HostPair", "pre32HostPairV5", "pre32HostPairV6"])
    assert.equal(Object.hasOwn(observed, key), false);
  assert.equal(fs.readFileSync(path.join(root, ".setfarm/pre32-called"), "utf8"), "x");
}, undefined, { extraSources: pre32Sources("valid") }));

test("V7 bootstrap sanitizes database failure and preserves finite phase", () => fixture(root => {
  const result = run(root, ["inspect-pre32-host-pair-v7", "--json"]);
  assert.equal(result.status, 1);
  assert.equal(result.stdout, "");
  const lines = result.stderr.trimEnd().split("\n");
  assert.equal(lines[0], "DEPLOYMENT_CUTOVER_BOOTSTRAP_REFUSED");
  assert.deepEqual(JSON.parse(lines[1]), { schema: "setfarm.deployment-cutover-refusal.v1",
    scope: "bootstrap", stage: "pre32-host-pair", ownerContext: null, launcherStage: null,
    cleanupFailed: null, pre32FailurePhase: "database-callback" });
  assert.doesNotMatch(result.stderr, /PRIVATE_DATABASE_PASSWORD/);
}, undefined, { extraSources: pre32Sources("database-phase") }));

test("V7 bootstrap refuses a self-consistent wrong journal label", () => fixture(root => {
  const result = run(root, ["inspect-pre32-host-pair-v7", "--json"]);
  assert.equal(result.status, 1);
  assert.equal(result.stdout, "");
  assert.equal(result.stderr.split("\n")[0], "DEPLOYMENT_CUTOVER_BOOTSTRAP_REFUSED");
}, undefined, { extraSources: pre32Sources("wrong-journal-label") }));

test("V7 bootstrap rejects extra argv before observer invocation", () => fixture(root => {
  const result = run(root, ["inspect-pre32-host-pair-v7", "--json", "extra"]);
  assert.equal(result.status, 1);
  assert.equal(result.stdout, "");
  assert.equal(fs.existsSync(path.join(root, ".setfarm/pre32-called")), false);
}, undefined, { extraSources: pre32Sources("valid") }));

test("bootstrap exposes separate diagnostic held binding candidates", () => fixture(root => {
  const result = run(root, ["inspect-held-binding-candidates-v1", "--json"]);
  assert.equal(result.status, 0, result.stderr);
  const observed = JSON.parse(result.stdout);
  assert.equal(observed.heldBindingCandidatesV1.schema,
    "setfarm.internal-production-held-binding-physical-database-pair.v1");
  assert.equal(observed.heldBindingCandidatesV1.authority, "diagnostic-only");
  assert.equal(observed.heldBindingCandidatesV1.joinedCandidates.receiptStatus, "required-unpublished");
  assert.equal(Object.hasOwn(observed, "activeBindingHostPairV1"), false);
}, undefined, { extraSources: pre32Sources("valid") }));

test("held candidate bootstrap refuses self-consistent forged receipt authority", () => fixture(root => {
  const result = run(root, ["inspect-held-binding-candidates-v1", "--json"]);
  assert.equal(result.status, 1);
  assert.equal(result.stdout, "");
  assert.equal(result.stderr.split("\n")[0], "DEPLOYMENT_CUTOVER_BOOTSTRAP_REFUSED");
}, undefined, { extraSources: pre32Sources("wrong-receipt-label") }));

test("held candidate bootstrap sanitizes observer failure with finite phase", () => fixture(root => {
  const result = run(root, ["inspect-held-binding-candidates-v1", "--json"]);
  assert.equal(result.status, 1);
  assert.equal(result.stdout, "");
  assert.match(result.stderr, /"activeBindingFailurePhase":"database-callback"/);
  assert.doesNotMatch(result.stderr, /PRIVATE_DATABASE_PASSWORD/);
}, undefined, { extraSources: pre32Sources("held-candidate-error") }));

test("held candidate bootstrap rejects extra argv before observer invocation", () => fixture(root => {
  const result = run(root, ["inspect-held-binding-candidates-v1", "--json", "extra"]);
  assert.equal(result.status, 1);
  assert.equal(result.stdout, "");
  assert.equal(fs.existsSync(path.join(root, ".setfarm/pre32-called")), false);
}, undefined, { extraSources: pre32Sources("valid") }));

test("bootstrap exposes a distinct authenticated positive active-binding diagnostic", () => fixture(root => {
  const result = run(root, ["inspect-active-binding-host-pair-v1", "--json"]);
  assert.equal(result.status, 0, result.stderr);
  const observed = JSON.parse(result.stdout);
  assert.equal(observed.activeBindingHostPairV1.schema,
    "setfarm.internal-production-active-binding-physical-database-pair.v1");
  assert.equal(observed.activeBindingHostPairV1.authority, "diagnostic-only");
  assert.equal(observed.activeBindingHostPairV1.physicalIdentityProvenance, "unverified");
  assert.deepEqual(observed.activeBindingHostPairV1.activeBindingDatabase, { fixture: "active-binding" });
  assert.equal(Object.hasOwn(observed, "pre32HostPairV6"), false);
  assert.equal(fs.readFileSync(path.join(root, ".setfarm/pre32-called"), "utf8"), "x");
}, undefined, { extraSources: pre32Sources("valid") }));

test("positive active-binding bootstrap sanitizes a held observer failure", () => fixture(root => {
  const result = run(root, ["inspect-active-binding-host-pair-v1", "--json"]);
  assert.equal(result.status, 1);
  assert.equal(result.stdout, "");
  assert.equal(result.stderr.split("\n")[0], "DEPLOYMENT_CUTOVER_BOOTSTRAP_REFUSED");
  assert.doesNotMatch(result.stderr, /PRIVATE_DATABASE_PASSWORD/);
  assert.equal(fs.existsSync(path.join(root, ".setfarm/pre32-called")), true);
}, undefined, { extraSources: pre32Sources("error") }));

test("positive active-binding bootstrap refuses a self-consistent cutover authority", () => fixture(root => {
  const result = run(root, ["inspect-active-binding-host-pair-v1", "--json"]);
  assert.equal(result.status, 1);
  assert.equal(result.stdout, "");
  assert.equal(result.stderr.split("\n")[0], "DEPLOYMENT_CUTOVER_BOOTSTRAP_REFUSED");
  assert.doesNotMatch(result.stderr, /PRIVATE_DATABASE_PASSWORD/);
}, undefined, { extraSources: pre32Sources("self-consistent-cutover") }));

test("V6 bootstrap sanitizes database failure and preserves finite phase", () => fixture(root => {
  const result = run(root, ["inspect-pre32-host-pair-v6", "--json"]);
  assert.equal(result.status, 1);
  assert.equal(result.stdout, "");
  const lines = result.stderr.trimEnd().split("\n");
  assert.equal(lines[0], "DEPLOYMENT_CUTOVER_BOOTSTRAP_REFUSED");
  assert.deepEqual(JSON.parse(lines[1]), { schema: "setfarm.deployment-cutover-refusal.v1",
    scope: "bootstrap", stage: "pre32-host-pair", ownerContext: null, launcherStage: null,
    cleanupFailed: null, pre32FailurePhase: "database-callback" });
  assert.doesNotMatch(result.stderr, /PRIVATE_DATABASE_PASSWORD/);
}, undefined, { extraSources: pre32Sources("database-phase") }));

test("V6 bootstrap refuses modified authenticated source before invoking diagnostic", () => fixture(root => {
  fs.appendFileSync(path.join(root, "src/internal-production/baseline-positive-worktree-host-pair-v2.ts"),
    "\nthrow Error('PRIVATE_DATABASE_PASSWORD');\n");
  const result = run(root, ["inspect-pre32-host-pair-v6", "--json"]);
  assert.equal(result.status, 1);
  assert.equal(result.stdout, "");
  assert.equal(fs.existsSync(path.join(root, ".setfarm/pre32-called")), false);
  assert.doesNotMatch(result.stderr, /PRIVATE_DATABASE_PASSWORD/);
}, undefined, { extraSources: pre32Sources("valid") }));

test("V5 bootstrap refuses malformed diagnostic without leaking private cause", () => fixture(root => {
  const result = run(root, ["inspect-pre32-host-pair-v5", "--json"]);
  assert.equal(result.status, 1);
  assert.equal(result.stdout, "");
  const lines = result.stderr.trimEnd().split("\n");
  assert.equal(lines[0], "DEPLOYMENT_CUTOVER_BOOTSTRAP_REFUSED");
  assert.equal(JSON.parse(lines[1]).pre32FailurePhase, "unknown");
  assert.doesNotMatch(result.stderr, /PRIVATE_DATABASE_PASSWORD/);
}, undefined, { extraSources: pre32Sources("malformed") }));

test("V5 bootstrap preserves a finite failure phase without leaking private cause", () => fixture(root => {
  const result = run(root, ["inspect-pre32-host-pair-v5", "--json"]);
  assert.equal(result.status, 1);
  assert.equal(result.stdout, "");
  const lines = result.stderr.trimEnd().split("\n");
  assert.deepEqual(JSON.parse(lines[1]), { schema: "setfarm.deployment-cutover-refusal.v1",
    scope: "bootstrap", stage: "pre32-host-pair", ownerContext: null, launcherStage: null,
    cleanupFailed: null, pre32FailurePhase: "database-callback" });
  assert.doesNotMatch(result.stderr, /PRIVATE_DATABASE_PASSWORD/);
}, undefined, { extraSources: pre32Sources("database-phase") }));

test("V5 bootstrap refuses modified authenticated source before invoking diagnostic", () => fixture(root => {
  fs.appendFileSync(path.join(root, "src/internal-production/baseline-positive-worktree-host-pair-v2.ts"),
    "\nthrow Error('PRIVATE_DATABASE_PASSWORD');\n");
  const result = run(root, ["inspect-pre32-host-pair-v5", "--json"]);
  assert.equal(result.status, 1);
  assert.equal(result.stdout, "");
  assert.equal(fs.existsSync(path.join(root, ".setfarm/pre32-called")), false);
  assert.doesNotMatch(result.stderr, /PRIVATE_DATABASE_PASSWORD/);
}, undefined, { extraSources: pre32Sources("valid") }));

test("pre32 bootstrap provides the authenticated Python data-only loader to the diagnostic", () => fixture(root => {
  const result = run(root, ["inspect-pre32-host-pair", "--json"]);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(result.stdout).pre32HostPair.authority, "diagnostic-only");
}, undefined, { extraSources: pre32Sources("transport-import") }));

for (const args of [["inspect-pre32-host-pair"], ["inspect-pre32-host-pair", "--json", "extra"]]) {
  test(`pre32 bootstrap refuses unexpected argv ${args.length}`, () => fixture(root => {
    const result = run(root, args);
    assert.equal(result.status, 1);
    assert.equal(result.stdout, "");
    assert.equal(fs.existsSync(path.join(root, ".setfarm/pre32-called")), false);
  }, undefined, { extraSources: pre32Sources("valid") }));
}

for (const kind of ["malformed", "self-consistent-cutover", "error"]) test(`pre32 bootstrap sanitizes ${kind} result`, () => fixture(root => {
  const result = run(root, ["inspect-pre32-host-pair", "--json"]);
  assert.equal(result.status, 1);
  assert.equal(result.stdout, "");
  const lines = result.stderr.trimEnd().split("\n");
  assert.equal(lines[0], "DEPLOYMENT_CUTOVER_BOOTSTRAP_REFUSED");
  assert.equal(JSON.parse(lines[1]).stage, "pre32-host-pair");
  assert.equal(JSON.parse(lines[1]).pre32FailurePhase, "unknown");
  assert.doesNotMatch(result.stderr, /PRIVATE_DATABASE_PASSWORD/);
}, undefined, { extraSources: pre32Sources(kind) }));

for (const [kind, expected] of [["database-phase", "database-callback"], ["physical-phase", "physical-second-pass"],
  ["cleanup-phase", "launcher-cleanup"], ["spoofed-phase", "unknown"], ["proxy-phase", "unknown"],
  ["accessor-phase", "unknown"]]) test(`pre32 bootstrap publishes only finite ${expected} refusal from ${kind}`, () => fixture(root => {
  const result = run(root, ["inspect-pre32-host-pair", "--json"]);
  assert.equal(result.status, 1);
  assert.equal(result.stdout, "");
  const lines = result.stderr.trimEnd().split("\n");
  assert.deepEqual(JSON.parse(lines[1]), { schema: "setfarm.deployment-cutover-refusal.v1", scope: "bootstrap",
    stage: "pre32-host-pair", ownerContext: null, launcherStage: null, cleanupFailed: null,
    pre32FailurePhase: expected });
  assert.equal(lines.length, 2);
  assert.doesNotMatch(result.stderr, /PRIVATE_DATABASE_PASSWORD/);
}, undefined, { extraSources: pre32Sources(kind) }));

for (const [kind, phase, expectedPoint] of [
  ["point-phase", "physical-first-pass", { schema: "setfarm.internal-production-positive-worktree-physical-refusal-point.v1",
    operation: "candidate-lsof", candidateOrdinal: 7 }],
  ["bad-point-phase", "physical-first-pass", undefined],
  ["crossed-point-phase", "database-callback", undefined],
  ["crossed-first-point", "physical-first-pass", undefined],
  ["proxy-point-phase", "physical-first-pass", undefined],
  ["accessor-point-phase", "physical-first-pass", undefined],
]) test(`pre32 bootstrap publishes only validated physical point from ${kind}`, () => fixture(root => {
  const result = run(root, ["inspect-pre32-host-pair", "--json"]);
  assert.equal(result.status, 1);
  assert.equal(result.stdout, "");
  const lines = result.stderr.trimEnd().split("\n");
  assert.deepEqual(JSON.parse(lines[1]), { schema: "setfarm.deployment-cutover-refusal.v1", scope: "bootstrap",
    stage: "pre32-host-pair", ownerContext: null, launcherStage: null, cleanupFailed: null,
    pre32FailurePhase: phase, ...(expectedPoint ? { pre32PhysicalPoint: expectedPoint } : {}) });
  assert.equal(lines.length, 2);
  assert.doesNotMatch(result.stderr, /PRIVATE_DATABASE_PASSWORD/);
}, undefined, { extraSources: pre32Sources(kind) }));

for (const target of ["source", "output"]) test(`pre32 bootstrap refuses ${target} tamper before invocation`, () => fixture(root => {
  const file = target === "source" ? "src/internal-production/baseline-positive-worktree-host-pair-v2.ts"
    : "dist/internal-production/baseline-positive-worktree-host-pair-v2.js";
  fs.appendFileSync(path.join(root, file), "\nthrow Error('PRIVATE_DATABASE_PASSWORD');\n");
  const result = run(root, ["inspect-pre32-host-pair", "--json"]);
  assert.equal(result.status, 1);
  assert.equal(result.stdout, "");
  assert.equal(fs.existsSync(path.join(root, ".setfarm/pre32-called")), false);
  assert.doesNotMatch(result.stderr, /PRIVATE_DATABASE_PASSWORD/);
}, undefined, { extraSources: pre32Sources("valid") }));

test("pre32 bootstrap refuses ambient preload selector before invocation", () => fixture(root => {
  const result = run(root, ["inspect-pre32-host-pair", "--json"], { NODE_OPTIONS: "" });
  assert.equal(result.status, 1);
  assert.equal(result.stdout, "");
  assert.equal(fs.existsSync(path.join(root, ".setfarm/pre32-called")), false);
}, undefined, { extraSources: pre32Sources("valid") }));

test("bootstrap invokes authenticated default context without caller-supplied observations", () => fixture(root => {
  const result = run(root, ["inspect-default-context", "--json"]);
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout).defaultContext, { fixture: "owned-default-context" });
}, undefined, { prepare(root) {
  write(root, "scripts/deployment-cutover-default-context.mjs", `export async function observeDeploymentCutoverDefaultContextV1(){if(arguments.length)throw Error('UNEXPECTED_INPUT');return Object.freeze({fixture:'owned-default-context'})}`);
} }));

test("bootstrap refuses modified default owner before invoking it", () => fixture(root => {
  fs.appendFileSync(path.join(root, "scripts/deployment-cutover-default-context.mjs"), "\nthrow Error('PRIVATE_OWNER_CANARY');\n");
  const result = run(root, ["inspect-default-context", "--json"]);
  assert.equal(result.status, 1);
  assert.equal(result.stdout, "");
  const lines = result.stderr.trimEnd().split("\n");
  assert.equal(lines[0], "DEPLOYMENT_CUTOVER_BOOTSTRAP_REFUSED");
  assert.deepEqual(JSON.parse(lines[1]), { schema: "setfarm.deployment-cutover-refusal.v1", scope: "bootstrap", stage: "source-authentication", ownerContext: null, launcherStage: null, cleanupFailed: null });
}));

for (const kind of ["valid", "valid-context", "helper-context", "helper-acquire", "phase-context", "phase-acquire", "acquire-unknown", "unknown-stage", "unknown-context", "crossed-context", "extra-field", "accessor", "raw-error", "field-accessor", "context-accessor", "symbol-field", "foreign-prototype", "cleanup-type", "unknown-launcher", "crossed-launcher", "sampled-snapshot", "sampled-generation", "sampled-native", "sampled-bind", "sampled-postcheck"]) {
  test(`bootstrap default refusal sanitizes ${kind} diagnostic`, () => fixture(root => {
    const result = run(root, ["inspect-default-context", "--json"]);
    assert.equal(result.status, 1); assert.equal(result.stdout, "");
    const lines = result.stderr.trimEnd().split("\n");
    assert.equal(lines.length, 2); assert.equal(lines[0], "DEPLOYMENT_CUTOVER_BOOTSTRAP_REFUSED");
    const qualified = ["valid", "valid-context", "helper-context", "phase-context"].includes(kind) || kind.startsWith("sampled-");
    assert.deepEqual(JSON.parse(lines[1]), { schema: "setfarm.deployment-cutover-refusal.v1", scope: qualified || ["acquire-unknown", "helper-acquire", "phase-acquire"].includes(kind) ? "default-owner" : "bootstrap",
      stage: kind === "phase-acquire" ? "acquire-phase" : kind === "helper-acquire" ? "acquire-helper" : ["valid-context", "helper-context", "phase-context"].includes(kind) ? "postqualify" : qualified ? "qualify" : kind === "acquire-unknown" ? "acquire-launcher" : "default-context",
      ownerContext: kind === "phase-context" ? "phase" : kind === "helper-context" ? "helper" : kind === "valid-context" ? "absence" : null,
      launcherStage: kind === "valid" ? "measure" : kind.startsWith("sampled-") ? kind : null, cleanupFailed: qualified ? false : null });
    assert.doesNotMatch(result.stderr, /PRIVATE_SENTINEL|PRIVATE_PATH|SECRET_GETTER/);
  }, undefined, { prepare(root) {
    write(root, "scripts/deployment-cutover-default-context.mjs", `export async function observeDeploymentCutoverDefaultContextV1(){
      const error=Error('PRIVATE_SENTINEL /PRIVATE_PATH');
      const value={scope:'default-owner',stage:'qualify',ownerContext:null,launcherStage:'measure',cleanupFailed:false};
      const kind=${JSON.stringify(kind)};
      if(kind.startsWith('sampled-'))value.launcherStage=kind;
      if(kind==='valid-context'){value.stage='postqualify';value.ownerContext='absence';value.launcherStage=null;}
      if(kind==='helper-context'){value.stage='postqualify';value.ownerContext='helper';value.launcherStage=null;}
      if(kind==='helper-acquire'){value.stage='acquire-helper';value.launcherStage=null;value.cleanupFailed=null;}
      if(kind==='phase-context'){value.stage='postqualify';value.ownerContext='phase';value.launcherStage=null;}
      if(kind==='phase-acquire'){value.stage='acquire-phase';value.launcherStage=null;value.cleanupFailed=null;}
      if(kind==='acquire-unknown'){value.stage='acquire-launcher';value.launcherStage=null;value.cleanupFailed=null;}
      if(kind==='unknown-stage')value.stage='PRIVATE_SENTINEL';
      if(kind==='unknown-context')value.ownerContext='PRIVATE_SENTINEL';
      if(kind==='crossed-context')value.ownerContext='absence';
      if(kind==='extra-field')value.secret='PRIVATE_SENTINEL';
      if(kind==='field-accessor')Object.defineProperty(value,'stage',{get(){process.stdout.write('SECRET_GETTER');throw Error('SECRET_GETTER')}});
      if(kind==='context-accessor')Object.defineProperty(value,'ownerContext',{get(){process.stdout.write('SECRET_GETTER');throw Error('SECRET_GETTER')}});
      if(kind==='symbol-field')value[Symbol('PRIVATE_SENTINEL')]='PRIVATE_SENTINEL';
      if(kind==='foreign-prototype')Object.setPrototypeOf(value,{secret:'PRIVATE_SENTINEL'});
      if(kind==='cleanup-type')value.cleanupFailed='PRIVATE_SENTINEL';
      if(kind==='unknown-launcher')value.launcherStage='PRIVATE_SENTINEL';
      if(kind==='crossed-launcher')value.stage='census';
      if(kind==='accessor')Object.defineProperty(error,'cutoverRefusal',{get(){process.stdout.write('SECRET_GETTER');throw Error('SECRET_GETTER')}});
      else if(kind!=='raw-error')Object.defineProperty(error,'cutoverRefusal',{value});
      throw error;
    }`);
  } }));
}

test("bootstrap preserves owner stage when its own cleanup also fails", () => fixture(root => {
  const result = run(root, ["inspect-default-context", "--json"]);
  assert.equal(result.status, 1); assert.equal(result.stdout, "");
  assert.deepEqual(JSON.parse(result.stderr.trimEnd().split("\n")[1]), {
    schema: "setfarm.deployment-cutover-refusal.v1", scope: "default-owner", stage: "qualify", ownerContext: null, launcherStage: "identity", cleanupFailed: true,
  });
  assert.doesNotMatch(result.stderr, /PRIVATE_SENTINEL/);
}, source => source.replace('try { fs.closeSync(pin.fd); } catch {', 'try { fs.closeSync(pin.fd); throw Error("PRIVATE_SENTINEL"); } catch {'), {
  prepare(root) {
    write(root, "scripts/deployment-cutover-default-context.mjs", `export async function observeDeploymentCutoverDefaultContextV1(){
      const error=Error('PRIVATE_SENTINEL');Object.defineProperty(error,'cutoverRefusal',{value:Object.freeze({scope:'default-owner',stage:'qualify',ownerContext:null,launcherStage:'identity',cleanupFailed:false})});throw error;
    }`);
  },
}));

test("bootstrap supplies authenticated Python bytes as data without evaluating them", () => fixture((root, expected) => {
  const result = run(root);
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout).sourceBuild, expected);
  assert.equal(fs.existsSync(path.join(root, "python-executed")), false);
}, source => source.replace('const verifier = await import', `const pythonData = await import('./deployment-cutover-passive-home.py');
  if(pythonData.default !== fs.readFileSync(path.join(root,'scripts/deployment-cutover-passive-home.py'),'utf8'))fail();
  const verifier = await import`), { prepare(root) {
  write(root, "scripts/deployment-cutover-passive-home.py", "raise Exception('PYTHON_MUST_NOT_EVALUATE')\n");
} }));

for (const fault of ["modified", "missing", "foreign-url"]) test(`bootstrap refuses ${fault} Python source data`, () => fixture(root => {
  if (fault === "modified") fs.appendFileSync(path.join(root, "scripts/deployment-cutover-passive-home.py"), "\nPRIVATE_SENTINEL\n");
  if (fault === "missing") fs.unlinkSync(path.join(root, "scripts/deployment-cutover-passive-home.py"));
  const result = run(root);
  assert.equal(result.status, 1);
  assert.equal(result.stdout, "");
  assert.equal(result.stderr, "DEPLOYMENT_CUTOVER_BOOTSTRAP_REFUSED\n");
}, source => source.replace('const verifier = await import',
  `await import(${JSON.stringify(fault === "foreign-url" ? "./foreign.py" : "./deployment-cutover-passive-home.py")});const verifier = await import`)));

test("load-time Python replacement cannot replace the already authenticated data bytes", () => fixture(root => {
  const result = run(root);
  assert.equal(result.status, 1);
  assert.equal(result.stdout, "");
  assert.equal(result.stderr, "DEPLOYMENT_CUTOVER_BOOTSTRAP_REFUSED\n");
  assert.match(fs.readFileSync(path.join(root, "scripts/deployment-cutover-passive-home.py"), "utf8"), /SWAPPED_PYTHON/);
}, source => source.replace('const source = entry.bytes.toString("utf8");',
  `fs.writeFileSync(entry.target,'SWAPPED_PYTHON');const source = entry.bytes.toString("utf8");`)
  .replace('const verifier = await import', `const data=await import('./deployment-cutover-passive-home.py');
    if(data.default==='SWAPPED_PYTHON')process.stdout.write('SWAPPED_DATA_ACCEPTED');const verifier = await import`)));

test("trusted retained inspection authenticates selected bytes without granting environment authority", () => retainedFixture(({ root }) => {
  const result = run(root, ["inspect-retained-profile", "--json"]); assert.equal(result.status, 0, result.stderr);
  const observed = JSON.parse(result.stdout);
  assert.equal(observed.retainedProfile.scope, "retained-startup-byte-inventory-only");
  assert.ok(observed.retainedProfile.blockers.includes("runtime-effective-environment-not-authenticated"));
  assert.ok(observed.retainedProfile.blockers.includes("module-resolution-not-authenticated"));
  assert.equal(Object.hasOwn(observed, "host"), false);
}, { genuine: true }));

for (const fault of ["profile-bytes", "observer-bytes", "selected-output", "retained-package"]) {
  test(`trusted retained inspection refuses ${fault} without evaluating retained code`, () => retainedFixture(({ root, selected }) => {
    if (fault === "profile-bytes") fs.appendFileSync(path.join(root, "scripts/deployment-cutover-retained-profile.v1.json"), " ");
    if (fault === "observer-bytes") fs.appendFileSync(path.join(root, "scripts/deployment-cutover-retained-profile.mjs"), '\nprocess.stdout.write("UNVERIFIED_PROFILE_EXECUTED");\n');
    if (fault === "selected-output") fs.appendFileSync(path.join(selected, "dist/cli/cli.js"), '\nprocess.stdout.write("UNVERIFIED_RETAINED_EXECUTED");\n');
    if (fault === "retained-package") fs.appendFileSync(path.join(selected, "node_modules/reviewed-fixture/index.js"), '\nprocess.stdout.write("UNVERIFIED_PACKAGE_EXECUTED");\n');
    const result = run(root, ["inspect-retained-profile", "--json"]);
    assert.equal(result.status, 1); assert.equal(result.stdout, ""); assert.equal(result.stderr, "DEPLOYMENT_CUTOVER_BOOTSTRAP_REFUSED\n");
  }, { genuine: true }));
}

function helperHistoryFixture(body) {
  fixture((root, expected, home) => {
    const baseline = path.join(home, "ai/setrox/data/internal-production-baseline");
    fs.mkdirSync(baseline, { recursive: true, mode: 0o700 });
    body(root, path.join(baseline, "restart-authority-retirement-v1"));
  }, source => source.replace("const closure = ", "import net from 'node:net';net.Socket.prototype.connect=()=>{throw Error('UNEXPECTED_CONNECTION')};syncBuiltinESMExports();const closure = "),
  { genuine: true, helpers: true });
}

test("trusted helper inspection authenticates real absent history and retains remaining blockers", () => helperHistoryFixture((root, history) => {
  const result = run(root, ["inspect-helpers", "--json"]); assert.equal(result.status, 0, result.stderr);
  const observed = JSON.parse(result.stdout);
  assert.equal(observed.helpers.scope, "helper-history-only");
  assert.equal(observed.helpers.coldState, "absent"); assert.equal(observed.helpers.preSchemaHelperState, "absent");
  assert.equal(observed.helpers.registeredHelperCount, 0); assert.equal(observed.helpers.terminalHelperCount, 0);
  assert.deepEqual(observed.helpers.blockers, ["filesystem-phase-zero-owner-not-observed", "runtime-effective-environment-not-authenticated",
    "database-zero-owner-not-observed", "controller-ownership-not-acquired"]);
  assert.equal(Object.hasOwn(observed, "host"), false); assert.equal(fs.existsSync(history), false);
}));

for (const fault of ["partial-history", "unsafe-history", "tampered-observer", "tampered-retirement"]) {
  test(`trusted helper inspection refuses ${fault} without output or history repair`, () => helperHistoryFixture((root, history) => {
    if (fault === "partial-history") {
      fs.mkdirSync(history, { mode: 0o700 });
      write(history, "pre-schema-helper-journal.json", "PRIVATE_HISTORY_CANARY\n", 0o600);
    }
    if (fault === "unsafe-history") fs.mkdirSync(history, { mode: 0o755 });
    if (fault.startsWith("tampered-")) {
      const name = fault === "tampered-observer" ? "baseline-deployment-cutover-helper-observation-v1" : "baseline-restart-authority-retirement-v1";
      fs.appendFileSync(path.join(root, `dist/internal-production/${name}.js`), '\nprocess.stdout.write("UNVERIFIED_HISTORY_EXECUTED");\n');
    }
    const result = run(root, ["inspect-helpers", "--json"]);
    assert.equal(result.status, 1); assert.equal(result.stdout, "");
    assert.equal(result.stderr, "DEPLOYMENT_CUTOVER_BOOTSTRAP_REFUSED\n");
    if (fault === "partial-history") assert.equal(fs.readFileSync(path.join(history, "pre-schema-helper-journal.json"), "utf8"), "PRIVATE_HISTORY_CANARY\n");
    if (fault === "unsafe-history") assert.equal(fs.statSync(history).mode & 0o777, 0o755);
    if (fault.startsWith("tampered-")) assert.equal(fs.existsSync(history), false);
  }));
}

function envAbsenceFixture(body) {
  fixture((root, expected, home) => {
    const old = path.join(home, "ai/setrox/old");
    write(old, "dist/cli/cli.js", "preserved entry\n");
    fs.mkdirSync(path.join(home, ".local/bin"), { recursive: true, mode: 0o755 });
    fs.symlinkSync(path.join(old, "dist/cli/cli.js"), path.join(home, ".local/bin/setfarm"));
    body(root, old, home);
  }, source => source.replace("const closure = ", "import net from 'node:net';net.Socket.prototype.connect=()=>{throw Error('UNEXPECTED_CONNECTION')};syncBuiltinESMExports();const closure = "),
  { genuine: true, envAbsence: true });
}

test("trusted env-file inspection reports only physical candidate absence and remaining blockers", () => envAbsenceFixture((root, old, home) => {
  const result = run(root, ["inspect-envfiles", "--json"]);
  assert.equal(result.status, 0, result.stderr);
  const observed = JSON.parse(result.stdout);
  assert.equal(observed.envFiles.scope, "default-candidate-absence-only");
  assert.equal(observed.envFiles.selectedCheckoutPath, old);
  assert.equal(observed.envFiles.currentCheckoutPath, root);
  assert.equal(observed.envFiles.candidates.length, 6);
  assert.deepEqual(observed.envFiles.blockers, ["runtime-effective-environment-not-authenticated", "controller-ownership-not-acquired"]);
  assert.equal(Object.hasOwn(observed, "host"), false);
  assert.equal(fs.existsSync(path.join(home, "ai/setrox/data")), false);
}));

for (const fault of ["present-selected-env", "present-home-env", "crossed-cli", "tampered-observer"]) {
  test(`trusted env-file inspection refuses ${fault} without output or authority`, () => envAbsenceFixture((root, old, home) => {
    if (fault === "present-selected-env") write(old, ".env", "PRIVATE_ENV_CANARY\n", 0o600);
    if (fault === "present-home-env") write(home, ".openclaw/setfarm/.env.local", "PRIVATE_ENV_CANARY\n", 0o600);
    if (fault === "crossed-cli") {
      const link = path.join(home, ".local/bin/setfarm"); fs.renameSync(link, `${link}.preserved`); fs.symlinkSync("missing-cli", link);
    }
    if (fault === "tampered-observer") fs.appendFileSync(path.join(root, "dist/internal-production/baseline-deployment-cutover-env-absence-v1.js"), '\nprocess.stdout.write("UNVERIFIED_ENV_OBSERVER_EXECUTED");\n');
    const result = run(root, ["inspect-envfiles", "--json"]);
    assert.equal(result.status, 1); assert.equal(result.stdout, "");
    assert.equal(result.stderr, "DEPLOYMENT_CUTOVER_BOOTSTRAP_REFUSED\n");
    assert.equal(fs.existsSync(path.join(home, "ai/setrox/data")), false);
    if (fault === "present-selected-env") assert.equal(fs.readFileSync(path.join(old, ".env"), "utf8"), "PRIVATE_ENV_CANARY\n");
    if (fault === "present-home-env") assert.equal(fs.readFileSync(path.join(home, ".openclaw/setfarm/.env.local"), "utf8"), "PRIVATE_ENV_CANARY\n");
    if (fault === "crossed-cli") assert.equal(fs.readlinkSync(path.join(home, ".local/bin/setfarm")), "missing-cli");
  }));
}

test("authenticated bootstrap accepts legitimate partial output-file reads", () => fixture(root => {
  const result = run(root); assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(result.stdout).sourceBuild.clean, true);
}, source => source.replace('const closure = ', `const partialFile=path.join(root,'dist/cli/cli.js'),partialInode=fs.statSync(partialFile).ino,originalRead=fs.readSync;
  fs.readSync=(fd,buffer,offset,length,position)=>originalRead(fd,buffer,offset,fs.fstatSync(fd).ino===partialInode?Math.min(length,7):length,position);
  syncBuiltinESMExports();const closure = `)));

for (const fault of ["installed-bytes", "installed-mode", "installed-symlink", "package-metadata", "lock-bytes", "helper-bytes"]) {
  test(`authenticated dependency boundary refuses ${fault} without evaluating packages`, () => fixture(root => {
    const entry = path.join(root, "node_modules/postgres/src/index.js");
    if (fault === "installed-bytes") fs.writeFileSync(entry, 'process.stdout.write("UNVERIFIED_PACKAGE_EXECUTED");');
    if (fault === "installed-mode") fs.chmodSync(entry, 0o666);
    if (fault === "installed-symlink") { fs.renameSync(entry, entry + ".preserved"); fs.symlinkSync(entry + ".preserved", entry); }
    if (fault === "package-metadata") fs.writeFileSync(path.join(root, "node_modules/postgres/package.json"), '{"type":"commonjs"}');
    if (fault === "lock-bytes") fs.appendFileSync(path.join(root, "package-lock.json"), " ");
    if (fault === "helper-bytes") fs.appendFileSync(path.join(root, "scripts/deployment-cutover-dependencies.mjs"), 'process.stdout.write("UNVERIFIED_HELPER_EXECUTED");');
    const result = run(root); assert.equal(result.status, 1); assert.equal(result.stdout, "");
    assert.equal(result.stderr, "DEPLOYMENT_CUTOVER_BOOTSTRAP_REFUSED\n");
  }));
}

for (const specifier of ["postgres/src/index.js", "zod/index.js", "zod/index.cjs", "foreign",
  "../node_modules/postgres/src/index.js?crossed", "../node_modules/zod/index.js#crossed", "../node_modules/zod/index.cjs"]) {
  test(`authenticated dependency boundary denies ${specifier} before module evaluation`, () => fixture(root => {
    const result = run(root); assert.equal(result.status, 1); assert.equal(result.stdout, "");
    assert.equal(result.stderr, "DEPLOYMENT_CUTOVER_BOOTSTRAP_REFUSED\n");
  }, source => source.replace('const owner = await import', `await import(${JSON.stringify(specifier)});const owner = await import`)
    .replace('check(); return { format: "module",', 'check(); if(entry.locator.startsWith("node_modules/"))process.stdout.write("UNEXPECTED_DEPENDENCY_EVALUATION"); return { format: "module",')));
}

test("authenticated dependency loading rejects a same-byte installed ancestor replacement", () => fixture(root => {
  const result = run(root); assert.equal(result.status, 1); assert.equal(result.stdout, "");
  assert.equal(result.stderr, "DEPLOYMENT_CUTOVER_BOOTSTRAP_REFUSED\n");
  assert.equal(fs.existsSync(path.join(root, "node_modules/postgres.preserved")), true);
}, source => source.replace('const owner = await import', `const packageRoot=path.join(root,'node_modules/postgres');
  fs.renameSync(packageRoot,packageRoot+'.preserved');fs.mkdirSync(packageRoot);
  for(const name of fs.readdirSync(packageRoot+'.preserved'))fs.renameSync(path.join(packageRoot+'.preserved',name),path.join(packageRoot,name));
  const owner = await import`)));

test("authenticated dependency loading never evaluates load-time replacement bytes", () => fixture(root => {
  const result = run(root); assert.equal(result.status, 1); assert.equal(result.stdout, "");
  assert.equal(result.stderr, "DEPLOYMENT_CUTOVER_BOOTSTRAP_REFUSED\n");
  assert.match(fs.readFileSync(path.join(root, "node_modules/postgres/src/index.js"), "utf8"), /SWAPPED_DEPENDENCY_EXECUTED/);
}, source => source.replace('const owner = await import', `await import('postgres');const owner = await import`)
  .replace('check(); return { format: "module",', `check(); if(entry.locator==='node_modules/postgres/src/index.js')fs.writeFileSync(entry.target,'process.stdout.write("SWAPPED_DEPENDENCY_EXECUTED");'); return { format: "module",`)));
test("bootstrap without synchronous hooks refuses before source reads instead of failing module instantiation", () => fixture(root => {
  const result = run(root);
  assert.equal(result.status, 1); assert.equal(result.stdout, "");
  assert.equal(result.stderr, "DEPLOYMENT_CUTOVER_BOOTSTRAP_REFUSED\n");
  assert.equal(fs.existsSync(path.join(root, "ai")), false);
}, source => source.replace('from "node:module";', 'from "data:text/javascript,export%20%7BisBuiltin%7D%20from%20%27node%3Amodule%27";')
  .replace('function sourceState() {', 'function sourceState() { process.stdout.write("unexpected-source-read");')));

test("fresh bootstrap authenticates source and finalized output without runtime writes", () => fixture((root, expected) => {
  const result = run(root); assert.equal(result.status, 0, result.stderr); assert.equal(result.stderr, "");
  const value = JSON.parse(result.stdout); assert.deepEqual(value.sourceBuild, expected);
  assert.match(value.controllerSourceHash, /^[a-f0-9]{64}$/); assert.equal(fs.existsSync(path.join(root, ".setfarm")), false);
  assert.equal(git(root, "status", "--porcelain"), "");
  assert.equal(fs.existsSync(path.join(root, "ai")), false);
}));
for (const fault of ["dirty-script", "wrong-origin", "output-bytes"]) test(`fresh bootstrap refuses ${fault} before reporting authority`, () => fixture(root => {
  if (fault === "dirty-script") fs.appendFileSync(path.join(root, "scripts/deployment-cutover-owner.mjs"), "\n");
  if (fault === "wrong-origin") git(root, "config", "remote.origin.url", "https://example.invalid/foreign.git");
  if (fault === "output-bytes") fs.appendFileSync(path.join(root, "dist/cli/cli.js"), "\n");
  const result = run(root); assert.notEqual(result.status, 0); assert.equal(result.stdout, "");
  assert.match(result.stderr, /DEPLOYMENT_CUTOVER_BOOTSTRAP_REFUSED/); assert.equal(fs.existsSync(path.join(root, ".setfarm")), false);
}));

for (const locator of ["scripts/build-generation-retention.mjs", "dist/internal-production/baseline-deployment-cutover-records-v1.js"]) {
  test(`load-time replacement of ${locator} never evaluates swapped bytes`, () => fixture(root => {
    const result = run(root); assert.notEqual(result.status, 0); assert.equal(result.stdout, "");
    assert.match(result.stderr, /^DEPLOYMENT_CUTOVER_BOOTSTRAP_REFUSED\n$/);
    assert.equal(fs.existsSync(path.join(root, "executed-marker")), false);
    assert.match(fs.readFileSync(path.join(root, locator), "utf8"), /executed-marker/);
    assert.equal(fs.existsSync(path.join(root, "ai")), false);
  }, source => source.replace('check(); return { format: "module", source: Buffer.from(entry.bytes), shortCircuit: true };',
    `check(); if(entry.locator===${JSON.stringify(locator)}){fs.writeFileSync(entry.target,"import fs from 'node:fs';fs.writeFileSync("+JSON.stringify(path.join(root,'executed-marker'))+",'executed');export const swapped=true;\\n");}
      return { format: "module", source: Buffer.from(entry.bytes), shortCircuit: true };`)));
}

for (const args of [[], ["prepare"], ["inspect"], ["inspect", "--json", "extra"]]) {
  test(`bootstrap rejects unsupported arguments ${JSON.stringify(args)} without runtime writes`, () => fixture(root => {
    const result = run(root, args); assert.notEqual(result.status, 0); assert.equal(result.stdout, "");
    assert.equal(result.stderr, "DEPLOYMENT_CUTOVER_BOOTSTRAP_REFUSED\n"); assert.equal(fs.existsSync(path.join(root, "ai")), false);
  }));
}

test("bootstrap rejects unexpected secret-bearing environment without disclosing it", () => fixture(root => {
  const result = run(root, ["inspect", "--json"], { SETFARM_PG_URL: "fixture-secret-never-print" });
  assert.notEqual(result.status, 0); assert.equal(result.stdout, "");
  assert.equal(result.stderr, "DEPLOYMENT_CUTOVER_BOOTSTRAP_REFUSED\n"); assert.doesNotMatch(result.stderr, /fixture-secret/);
  assert.equal(fs.existsSync(path.join(root, "ai")), false);
}));

test("bootstrap refuses being imported by an unsupported existing entry process", () => fixture(root => {
  const result = spawnSync(process.execPath, ["--input-type=module", "-e", `await import(${JSON.stringify(path.join(root, "scripts/deployment-cutover.mjs"))});`], {
    cwd: root, env: { PATH: "/usr/bin:/bin", LANG: "C", LC_ALL: "C", TZ: "UTC" }, encoding: "utf8", timeout: 30000,
  });
  assert.notEqual(result.status, 0); assert.equal(result.stdout, "");
  assert.equal(result.stderr, "DEPLOYMENT_CUTOVER_BOOTSTRAP_REFUSED\n"); assert.equal(fs.existsSync(path.join(root, "ai")), false);
}));

// Only external OS service/process responses are simulated. The compiled
// observers, physical files, plist conversion and authenticated loader are real.
function hostCommandFixture(root, home, fault, cp, fs, path) {
  const original = cp.spawnSync, labels = ["com.setrox.setfarm-spawner", "com.setrox.setfarm-dashboard"];
  const oldRoot = path.join(home, "ai/setrox/old"), node = fs.realpathSync(process.execPath);
  let scans = 0, prints = 0;
  const row = (pid, command, ppid = 1, pgid = pid) => `${process.getuid()} ${pid} ${ppid} ${pgid} S Wed Sep 16 01:02:03 2026 ${command}\n`;
  const reply = (stdout, status = 0) => ({ status, signal: null, stdout: Buffer.from(stdout), stderr: Buffer.alloc(0) });
  cp.spawnSync = (command, args, options) => {
    if (command === "/usr/bin/git" || command === "/usr/bin/plutil") return original(command, args, options);
    if (command === "/bin/launchctl") {
      if (args.length !== 2 || args[0] !== "print") throw Error("unexpected service mutation");
      const label = labels.find(item => args[1] === `gui/${process.getuid()}/${item}`);
      if (!label) throw Error("unexpected service target");
      prints++;
      const plistPath = path.join(home, "Library/LaunchAgents", `${label}.plist`);
      const converted = original("/usr/bin/plutil", ["-convert", "json", "-o", "-", "-"], { input: fs.readFileSync(plistPath) });
      const plist = JSON.parse(converted.stdout), program = plist.ProgramArguments[0];
      const block = (name, lines) => `\t${name} = {\n${lines.map(line => `\t\t${line}\n`).join("")}\t}\n`;
      const state = fault === "launcher-drift" && prints > 4 ? "spawn scheduled" : "not running";
      return reply(`gui/${process.getuid()}/${label} = {\n\tpath = ${plistPath}\n\tprogram = ${program}\n\tstate = ${state}\n\tactive count = 0\n\ttype = LaunchAgent\n\trun interval = 60 seconds\n\tproperties = runatload\n`
        + block("arguments", plist.ProgramArguments)
        + block("environment", Object.entries({ ...plist.EnvironmentVariables, OSLogRateLimit: "64", XPC_SERVICE_NAME: label }).map(([k, v]) => `${k} => ${v}`))
        + block("inherited environment", [`SETFARM_ENV_DIR => ${home}/ai/setrox/setfarm/scripts`, "SSH_AUTH_SOCK => /var/run/com.apple.launchd.Fixture/Listeners"])
        + block("default environment", ["PATH => /usr/bin:/bin:/usr/sbin:/sbin"]) + "}\n");
    }
    if (command === "/bin/ps" && JSON.stringify(args) === JSON.stringify(["-ww", "-axo", "uid=,pid=,ppid=,pgid=,stat=,lstart=,command="])) {
      scans++;
      if (fault === "cli-drift" && scans === 1) {
        const link = path.join(home, ".local/bin/setfarm"); fs.renameSync(link, `${link}.preserved`); fs.symlinkSync(`${oldRoot}/dist/cli/cli.js`, link);
      }
      const dashboardRoot = fault === "mixed-root" ? root : oldRoot;
      return reply(row(process.pid, `${node} /fixture/controller.mjs`, process.ppid, process.pid)
        + row(4103, `${node} ${dashboardRoot}/dist/server/daemon.js 3333`)
        + (fault === "starter" || (fault === "family-drift" && scans > 2) ? row(4105, `${node} ${oldRoot}/dist/cli/cli.js spawner start`, 4100, 4100) : ""));
    }
    if (command === "/bin/ps" && JSON.stringify(args) === JSON.stringify(["-ww", "-p", "4103", "-o", "comm="])) return reply(`${node}\n`);
    if (command === "/usr/sbin/lsof" && JSON.stringify(args) === JSON.stringify(["-nP", "-iTCP:3333", "-sTCP:LISTEN", "-F0pcfn"])) return reply("p4103\0cnode\0\nf21\0n127.0.0.1:3333\0\n");
    throw Error("unexpected host command");
  };
}
function hostFixture(body, fault = "", options = {}) {
  fixture((root, expected, home) => {
    const oldRoot = path.join(home, "ai/setrox/old");
    fs.mkdirSync(path.dirname(oldRoot), { recursive: true, mode: 0o755 });
    fixture(historicalRoot => {
      fs.renameSync(historicalRoot, oldRoot);
      write(oldRoot, "checkout-note.md", "New checkout retains the previous finalized build.\n");
      git(oldRoot, "add", "checkout-note.md"); git(oldRoot, "commit", "-qm", "new source retains build");
      git(oldRoot, "update-ref", "refs/remotes/origin/main", "HEAD");
    });
    fs.mkdirSync(path.join(home, ".local/bin"), { recursive: true, mode: 0o755 });
    fs.symlinkSync(path.join(oldRoot, "dist/cli/cli.js"), path.join(home, ".local/bin/setfarm"));
    for (const [index, label] of ["com.setrox.setfarm-spawner", "com.setrox.setfarm-dashboard"].entries()) {
      const program = path.join(home, ".local/bin/setfarm"), log = path.join(home, ".openclaw/logs", index ? "setfarm-dashboard.watch" : "setfarm-spawner.watch");
      const plist = { Label: label, ProgramArguments: index ? [program, "dashboard", "start", "--port", "3333"] : [program, "spawner", "start"],
        EnvironmentVariables: { PATH: "/usr/bin:/bin", SETFARM_PG_URL: "postgresql://fixture:PG_SECRET_SENTINEL@localhost/setfarm", ...(index ? { SETFARM_OPERATIONAL_WRITE_TOKEN: "TOKEN_SECRET_SENTINEL" } : {}) },
        RunAtLoad: true, StartInterval: 60, StandardOutPath: `${log}.log`, StandardErrorPath: `${log}.err.log` };
      write(home, `Library/LaunchAgents/${label}.plist`, execFileSync("/usr/bin/plutil", ["-convert", "xml1", "-o", "-", "-"], { input: JSON.stringify(plist) }), 0o600);
    }
    body(root, oldRoot, home);
  }, source => source.replace("const closure = ", `import cp from 'node:child_process';\n${options.census ? "import net from 'node:net';net.Socket.prototype.connect=()=>{throw Error('UNEXPECTED_DATABASE_CONNECTION')};" : ""}\n(${hostCommandFixture.toString()})(root,fixtureHome,${JSON.stringify(fault)},cp,fs,path);syncBuiltinESMExports();\nconst closure = `), options);
}

function censusTransport(locator, source) {
  if (locator !== "internal-production/baseline-legacy-database-census-v1") return source;
  const marker = 'const postgresModule = await import("postgres");';
  assert.equal(source.split(marker).length, 2);
  return source.replace(marker, `
    const actualPostgres=await import('postgres');
    const postgresModule={default:(url,options)=>{
      const sql=actualPostgres.default(url,options),close=sql.end;let calls=0;
      const tokens=["SET LOCAL statement_timeout = '5s'","SET LOCAL lock_timeout = '1s'","WITH expected_tables",
        "WITH required_columns","FROM public.finding_sets","FROM public.findings","FROM public.runs"];
      sql.begin=async(mode,body)=>{
        if(mode!=='isolation level repeatable read read only')throw Error('WRONG_SNAPSHOT');
        return body(async strings=>{
          const query=Array.from(strings).join('?');if(!query.includes(tokens[calls]??'UNEXPECTED_QUERY'))throw Error('WRONG_QUERY_ORDER');calls++;
          if(calls===3)return [{laterJournalCount:'0',relationCount:'0',functionCount:'0',typeCount:'0',triggerCount:'0'}];
          if(calls===4)return [{catalogViolationCount:'0',aprbChildViolationCount:'0',ordinaryBatchViolationCount:'0',activeHeaderViolationCount:'0',
            ownerReservationsRelation:null,ownerAdmissionHeadRelation:null,producerSourceRelation:null,producerActivationRelation:null,producerActivationHeadRelation:null,producerCurrentRelation:null,
            activeRunCount:'0',openClaimCount:'0',executionAttemptCount:'0',activeRuntimeSessionCount:'0',activeCompletionOwnerCount:'0',unsettledMandatoryEffectCount:'0',
            artifactReservationCount:'0',publicationBatchCount:'0',artifactPublicationCount:'0',terminationOwnerCount:'0',findingOwnerCount:'0',recoveryOwnerCount:'0',operationalDeliveryCount:'0'}];
          return [];
        });
      };
      sql.end=async options=>{if(calls!==7||options.timeout!==1)throw Error('INCOMPLETE_CENSUS');return close(options)};
      return sql;
    }};
  `);
}

test("trusted database inspection executes full pre32 census but retains remaining ownership blockers", () => hostFixture((root, oldRoot, home) => {
  const result = run(root, ["inspect-database", "--json"]);
  assert.equal(result.status, 0, result.stderr);
  const host = JSON.parse(result.stdout).host;
  assert.equal(host.database.databaseCensus.activeRunCount, 0);
  assert.equal(Object.keys(host.database.databaseCensus).length, 14);
  assert.deepEqual(host.database.databaseCensus.legacyFindingPublicationInventory.entries, []);
  assert.deepEqual(host.database.launcherObservation, host.launchers);
  assert.deepEqual(host.blockers, ["filesystem-helper-phase-zero-owner-not-observed", "controller-ownership-not-acquired",
    "runtime-effective-environment-not-authenticated"]);
  assert.equal(host.cli.checkoutPath, oldRoot);
  assert.equal(fs.existsSync(path.join(home, "ai/setrox/data")), false);
  assert.doesNotMatch(result.stdout + result.stderr, /SECRET_SENTINEL/);
}, "", { genuine: true, census: true, sourceInstrument: censusTransport }));

for (const fault of ["nonzero-owner", "close-secret", "cli-drift-during-census"]) {
  test(`trusted database inspection refuses ${fault} without output or authority`, () => hostFixture((root, oldRoot, home) => {
    const result = run(root, ["inspect-database", "--json"]);
    assert.equal(result.status, 1); assert.equal(result.stdout, "");
    assert.equal(result.stderr, "DEPLOYMENT_CUTOVER_BOOTSTRAP_REFUSED\n");
    assert.equal(fs.existsSync(path.join(home, "ai/setrox/data")), false);
    if (fault === "cli-drift-during-census") assert.equal(fs.existsSync(path.join(home, ".local/bin/setfarm.preserved")), true);
  }, "", { genuine: true, census: true, sourceInstrument(locator, source) {
    const transformed = censusTransport(locator, source);
    if (locator !== "internal-production/baseline-legacy-database-census-v1") return transformed;
    const marker = fault === "nonzero-owner" ? "activeRunCount:'0'"
      : fault === "close-secret" ? "return close(options)" : "calls++;";
    assert.equal(transformed.split(marker).length, 2);
    return transformed.replace(marker, fault === "nonzero-owner" ? "activeRunCount:'1'"
      : fault === "close-secret" ? "await close(options);throw Error('PG_SECRET_SENTINEL',{cause:Error('TOKEN_SECRET_SENTINEL')})"
      : `calls++;if(calls===1){const fs=await import('node:fs'),os=await import('node:os');const link=os.userInfo().homedir+'/.local/bin/setfarm';const target=fs.readlinkSync(link);fs.renameSync(link,link+'.preserved');fs.symlinkSync(target,link)}`);
  } }));
}

test("trusted host inspection joins real diagnostics without publishing authority", () => hostFixture((root, oldRoot, home) => {
  const link = path.join(home, ".local/bin/setfarm"), inode = fs.lstatSync(link).ino;
  const originalTarget = fs.readlinkSync(link), targetBytes = fs.readFileSync(link);
  const plistPaths = ["com.setrox.setfarm-spawner", "com.setrox.setfarm-dashboard"].map(label => path.join(home, "Library/LaunchAgents", `${label}.plist`));
  const plistsBefore = plistPaths.map(file => ({ bytes: fs.readFileSync(file), inode: fs.lstatSync(file).ino }));
  const result = run(root, ["inspect-host", "--json"]); assert.equal(result.status, 0, result.stderr);
  const host = JSON.parse(result.stdout).host;
  assert.equal(host.cli.checkoutPath, oldRoot); assert.equal(host.newCheckoutPath, root);
  assert.equal(host.launchers.launchers.length, 2); assert.equal(host.processes.listener.pid, 4103);
  assert.deepEqual(host.blockers, ["database-zero-owner-not-observed", "controller-ownership-not-acquired"]);
  assert.deepEqual(host.selectedDeployment.cli, host.cli);
  assert.notEqual(host.selectedDeployment.buildSource.sha, host.selectedDeployment.checkoutSource.sha);
  assert.match(host.hostObservationHash, /^[a-f0-9]{64}$/);
  assert.equal(fs.lstatSync(link).ino, inode); assert.equal(fs.existsSync(path.join(home, "ai/setrox/data")), false);
  assert.equal(fs.readlinkSync(link), originalTarget); assert.deepEqual(fs.readFileSync(link), targetBytes);
  assert.deepEqual(plistPaths.map(file => ({ bytes: fs.readFileSync(file), inode: fs.lstatSync(file).ino })), plistsBefore);
  assert.doesNotMatch(result.stdout + result.stderr, /SECRET_SENTINEL/);
  assert.equal(git(root, "status", "--porcelain"), "");
}));

for (const fault of ["cli-drift", "launcher-drift", "family-drift"]) test(`host inspection rejects cross-observer ${fault}`, () => hostFixture((root, oldRoot, home) => {
  const result = run(root, ["inspect-host", "--json"]); assert.notEqual(result.status, 0); assert.equal(result.stdout, "");
  assert.equal(result.stderr, "DEPLOYMENT_CUTOVER_BOOTSTRAP_REFUSED\n");
  assert.equal(fs.existsSync(path.join(home, "ai/setrox/data")), false);
}, fault));

for (const [fault, blocker] of [["mixed-root", "dashboard-cli-root-disagreement"], ["starter", "non-dashboard-process-family"]]) {
  test(`host inspection reports ${fault} as a blocker, never ready authority`, () => hostFixture((root, oldRoot, home) => {
    const result = run(root, ["inspect-host", "--json"]); assert.equal(result.status, 0, result.stderr);
    const host = JSON.parse(result.stdout).host; assert.ok(host.blockers.includes(blocker));
    assert.ok(host.blockers.includes("database-zero-owner-not-observed"));
    assert.equal(fs.existsSync(path.join(home, "ai/setrox/data")), false);
  }, fault));
}

test("trusted host inspection refuses a tampered selected build without evaluating it", () => hostFixture((root, oldRoot, home) => {
  const target = path.join(oldRoot, "dist/cli/cli.js");
  fs.writeFileSync(target, `import fs from 'node:fs';fs.writeFileSync(${JSON.stringify(path.join(root, "old-code-executed"))},'bad');\n`);
  const result = run(root, ["inspect-host", "--json"]);
  assert.notEqual(result.status, 0); assert.equal(result.stdout, "");
  assert.equal(result.stderr, "DEPLOYMENT_CUTOVER_BOOTSTRAP_REFUSED\n");
  assert.equal(fs.existsSync(path.join(root, "old-code-executed")), false);
  assert.equal(fs.existsSync(path.join(home, "ai/setrox/data")), false);
}));
