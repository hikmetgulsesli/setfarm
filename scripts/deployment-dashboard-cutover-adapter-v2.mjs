// Fixed original-resource qualification only. Never dispatch native/service effects.
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {types} from 'node:util';
import {holdCurrentFinalizedSetfarmSourceBuildV1} from './build-generation-retention.mjs';

const ROOT=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const tokens=new WeakMap();
const preparation={attempted:false,ready:false,revoked:false,source:null,imports:[],native:null,definition:null};
let active=null,operation=null,attempted=false;
function refuse(){throw Error('DASHBOARD_CUTOVER_JOINT_ORIGINAL_OPERATION_REFUSED')}
function revokeActive(){if(active===preparation)preparation.revoked=true;else if(active)active.revoked=true}
function checkPreparation(){if(active!==preparation||preparation.revoked)refuse()}
function checkOperation(record){if(active!==record||record!==operation||record.revoked)refuse()}
function sourceCheck(check){check();preparation.source.recheck();check()}
async function importOriginal(locator){
  const occurrence={locator,intent:true,promise:null,settled:false,value:null};
  preparation.imports.push(occurrence);checkPreparation();
  occurrence.promise=import(locator); // Retain original before await/observation.
  try{occurrence.value=await occurrence.promise;occurrence.settled=true}
  catch{occurrence.settled=true;preparation.revoked=true;refuse()}
  checkPreparation();sourceCheck(checkPreparation);return occurrence.value;
}
async function prepare(){
  if(preparation.ready){sourceCheck(checkPreparation);return}
  if(preparation.attempted||preparation.revoked)refuse();preparation.attempted=true;
  checkPreparation();preparation.source=holdCurrentFinalizedSetfarmSourceBuildV1();checkPreparation();
  sourceCheck(checkPreparation);
  preparation.native=await importOriginal(ROOT+'/scripts/dashboard-cutover-native-sidecar-v2.mjs');
  sourceCheck(checkPreparation);
  preparation.definition=await importOriginal(ROOT+'/dist/internal-production/baseline-deployment-cutover-launcher-observation-v1.js');
  sourceCheck(checkPreparation);preparation.ready=true;
}
function bound(token,participant,kind,arity){
  if(arity!==2)refuse();const record=tokens.get(token);
  if(!record||record!==operation||record.token!==token||!record.published
    ||record[kind]!==participant)refuse();return record;
}
function liveToken(token,participant,kind,arity){
  const record=bound(token,participant,kind,arity);checkOperation(record);
  if(!['enrolling','working'].includes(record.stage))refuse();
  checkOperation(record);
}
function settlementsKnown(record){return record.enrollments.every(r=>r.returned&&r.authenticated&&r.scope!==null)
  &&!record.unknown&&record.pending.size===0}
function settlementToken(token,participant,kind,arity){
  const record=bound(token,participant,kind,arity);
  if(active!==record||record.stage!=='settling'||!settlementsKnown(record))refuse();
}
function releaseToken(token,participant,kind,arity){
  const record=bound(token,participant,kind,arity);
  if(record.stage!=='terminal'||!settlementsKnown(record)
    ||!record.settlements.every(r=>r.returned))refuse();
}
export function assertDashboardCutoverJointNativeTokenV4(token,originalLoaded){liveToken(token,originalLoaded,'originalLoaded',arguments.length)}
export function assertDashboardCutoverJointDefinitionTokenV4(token,originalDefinition){liveToken(token,originalDefinition,'originalDefinition',arguments.length)}
export function assertDashboardCutoverJointNativeSettlementTokenV4(token,originalLoaded){settlementToken(token,originalLoaded,'originalLoaded',arguments.length)}
export function assertDashboardCutoverJointDefinitionSettlementTokenV4(token,originalDefinition){settlementToken(token,originalDefinition,'originalDefinition',arguments.length)}
export function assertDashboardCutoverJointNativeReleaseTokenV4(token,originalLoaded){releaseToken(token,originalLoaded,'originalLoaded',arguments.length)}
export function assertDashboardCutoverJointDefinitionReleaseTokenV4(token,originalDefinition){releaseToken(token,originalDefinition,'originalDefinition',arguments.length)}
export function revokeDashboardCutoverJointTokenV4(token){
  if(arguments.length!==1)refuse();const record=tokens.get(token);
  if(!record||record!==operation||record.token!==token)refuse();
  // Genuine notification is nonthrowing, including unpublished/revoked originals.
  record.revoked=true;
}
function enroll(record,index,begin,verify,participant){
  const occurrence=record.enrollments[index];occurrence.intent=true;checkOperation(record);
  try{occurrence.scope=begin(participant,record.token);occurrence.returned=true;
    // A recovered return is not proof of the provider's published WeakMap original.
    verify(occurrence.scope);occurrence.authenticated=true;
  }
  catch{record.unknown=true;record.revoked=true;throw Error('DASHBOARD_CUTOVER_JOINT_ORIGINAL_OPERATION_REFUSED')}
  checkOperation(record);
}
function settle(record,index,finish){
  const occurrence=record.settlements[index];occurrence.intent=true;
  try{finish(record.enrollments[index].scope);occurrence.returned=true}
  catch{record.unknown=true;record.revoked=true;refuse()}
}

export async function qualifyHeldDashboardCutoverJointOriginalOperationV4(originalLoaded,originalDefinition){
  // Pending preparation and original work are fenced BEFORE all input parsing.
  if(active){revokeActive();refuse()}
  if(arguments.length!==2||originalLoaded===null||typeof originalLoaded!=='object'
    ||originalDefinition===null||typeof originalDefinition!=='object'
    ||types.isProxy(originalLoaded)||types.isProxy(originalDefinition))refuse();
  if(attempted||preparation.revoked)refuse();
  active=preparation;
  try{
    await prepare();checkPreparation();
    // Fixed provider assertions own their WeakMaps; no caller-supplied ports.
    preparation.native.assertHeldDashboardCutoverLoadedJobPeerV4(originalLoaded);checkPreparation();
    preparation.definition.assertHeldDashboardCutoverApprovedDefinitionV4(originalDefinition);checkPreparation();
    sourceCheck(checkPreparation);
  }catch{
    if(!preparation.ready)preparation.revoked=true;
    if(preparation.imports.every(r=>r.settled))active=null;
    refuse();
  }
  attempted=true;
  const record={originalLoaded,originalDefinition,stage:'enrolling',revoked:false,published:false,
    token:null,pending:new Set(),unknown:false,
    enrollments:[{intent:false,returned:false,authenticated:false,scope:null},
      {intent:false,returned:false,authenticated:false,scope:null}],
    settlements:[{intent:false,returned:false},{intent:false,returned:false}]};
  // Construction may have swallowed active-first reentry. Never discard that burn.
  checkPreparation();operation=active=record;
  let failed=false;
  try{
    const token=Object.create(null);record.token=token;tokens.set(token,record);checkOperation(record);
    Object.freeze(token);checkOperation(record);record.published=true;
    enroll(record,0,preparation.native.beginHeldDashboardCutoverLoadedJobOperationV4,
      preparation.native.assertHeldDashboardCutoverLoadedJobOperationV4,originalLoaded);
    enroll(record,1,preparation.definition.beginHeldDashboardCutoverApprovedDefinitionOperationV4,
      preparation.definition.assertHeldDashboardCutoverApprovedDefinitionOperationV4,originalDefinition);
    record.stage='working';
    const check=()=>checkOperation(record);
    sourceCheck(check);
    preparation.native.assertHeldDashboardCutoverLoadedJobOperationV4(record.enrollments[0].scope);check();
    preparation.definition.assertHeldDashboardCutoverApprovedDefinitionOperationV4(record.enrollments[1].scope);check();
    sourceCheck(check);
    preparation.native.assertHeldDashboardCutoverLoadedJobOperationV4(record.enrollments[0].scope);check();
    preparation.definition.assertHeldDashboardCutoverApprovedDefinitionOperationV4(record.enrollments[1].scope);check();
    check();
    preparation.native.assertHeldDashboardCutoverLoadedJobOperationCacheV4(record.enrollments[0].scope);check();
  }catch{record.revoked=true;failed=true}
  // No generic finally: unreturned enrollment or pending original remains held.
  if(!settlementsKnown(record))refuse();
  record.stage='settling';
  settle(record,0,preparation.native.settleHeldDashboardCutoverLoadedJobOperationV4);
  settle(record,1,preparation.definition.settleHeldDashboardCutoverApprovedDefinitionOperationV4);
  record.stage='terminal';active=null;
  if(failed||record.revoked)refuse();
}
