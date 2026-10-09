// Fixed original-resource qualification only. Never dispatch native/service effects.
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {types} from 'node:util';
import {holdCurrentFinalizedSetfarmSourceBuildV1} from './build-generation-retention.mjs';

const ROOT=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const tokens=new WeakMap();
const originalThen=Promise.prototype.then;
const preparation={attempted:false,ready:false,revoked:false,source:null,imports:[],native:null,definition:null,census:null,censusAttempted:false,
  owner:null,reservation:null,ownerAttempted:false,localDrain:null,physical:null,activeBinding:null};
let active=null,operation=null,attempted=false;
function refuse(){throw Error('DASHBOARD_CUTOVER_JOINT_ORIGINAL_OPERATION_REFUSED')}
function revokeActive(){if(active===preparation)preparation.revoked=true;else if(active)active.revoked=true}
function checkPreparation(){if(active!==preparation||preparation.revoked)refuse()}
function checkOperation(record){
  if(active!==record||record!==operation||record.revoked)refuse();
  if(record.localDrain?.ready){
    try{
      preparation.localDrain.assertDashboardCutoverLocalProducerDrainV2(record.localDrain.js.value);
      preparation.localDrain.assertDashboardCutoverLocalChildDrainV3(record.localDrain.child.value);
    }catch{record.revoked=true;record.unknown=true;refuse()}
  }
  if(record.physical?.registered){
    try{preparation.census.assertHeldDashboardCutoverPre32PhysicalMetadataV4(record.pre32.scope,record.originalOwner,record.token)}
    catch{record.revoked=true;record.unknown=true;refuse()}
  }
  if(active!==record||record!==operation||record.revoked)refuse();
}
function sourceCheck(check){check();preparation.source.recheck();check()}
async function importOriginal(locator){
  const occurrence={locator,intent:true,promise:null,settled:false,value:null};
  preparation.imports.push(occurrence);checkPreparation();
  occurrence.promise=import(locator); // Retain original before await/observation.
  try{occurrence.value=await occurrence.promise;occurrence.settled=true}
  catch{occurrence.settled=true;preparation.revoked=true;refuse()}
  checkPreparation();sourceCheck(checkPreparation);return occurrence.value;
}
async function prepare(pre32,ownerReservation,quiet=false){
  if(preparation.ready)sourceCheck(checkPreparation);
  else{
    if(preparation.attempted||preparation.revoked)refuse();preparation.attempted=true;
    checkPreparation();preparation.source=holdCurrentFinalizedSetfarmSourceBuildV1();checkPreparation();
    sourceCheck(checkPreparation);
    preparation.native=await importOriginal(ROOT+'/scripts/dashboard-cutover-native-sidecar-v2.mjs');
    sourceCheck(checkPreparation);
    preparation.definition=await importOriginal(ROOT+'/dist/internal-production/baseline-deployment-cutover-launcher-observation-v1.js');
    sourceCheck(checkPreparation);preparation.ready=true;
  }
  if(pre32&&!preparation.census){
    if(preparation.censusAttempted)refuse();preparation.censusAttempted=true;
    preparation.census=await importOriginal(ROOT+'/dist/internal-production/baseline-legacy-database-census-v1.js');
    sourceCheck(checkPreparation);
  }
  if((ownerReservation||quiet)&&!preparation.owner){
    if(preparation.ownerAttempted)refuse();preparation.ownerAttempted=true;
    preparation.owner=await importOriginal(ROOT+'/scripts/deployment-cutover-owner.mjs');
    sourceCheck(checkPreparation);
  }
  if(ownerReservation&&!preparation.reservation){
    preparation.reservation=await importOriginal(ROOT+'/scripts/deployment-dashboard-cutover-first-generation-v2.mjs');
    sourceCheck(checkPreparation);
    preparation.localDrain=await importOriginal(ROOT+'/dist/internal-production/baseline-dashboard-cutover-local-producer-drain-v2.js');
    sourceCheck(checkPreparation);
    preparation.physical=await importOriginal(ROOT+'/dist/internal-production/baseline-positive-worktree-physical-catalog-v2.js');
    sourceCheck(checkPreparation);
    preparation.activeBinding=await importOriginal(ROOT+'/dist/internal-production/baseline-positive-worktree-active-binding-snapshot-v1.js');
    sourceCheck(checkPreparation);
  }
}
function bound(token,participant,kind,arity){
  if(arity!==2)refuse();const record=tokens.get(token);
  if(!record||record!==operation||record.token!==token||!record.published
    ||record[kind]!==participant)refuse();return record;
}
function liveToken(token,participant,kind,arity){
  const record=bound(token,participant,kind,arity);checkOperation(record);
  if(!['enrolling','working'].includes(record.stage))refuse();
  // The original owner composite may still be resolving its canonical adapter.
  // No participant port may race that provisional lifetime or import response.
  if(record.route==='reservation'&&record.reservation.invocationIntent&&!record.reservation.returned)refuse();
  if(record.route==='reservation'&&record.physical.intent&&!record.physical.returned)refuse();
  if(record.quiet?.invocationIntent&&!record.quiet.returned){record.revoked=true;record.unknown=true;refuse()}
  checkOperation(record);
}
function settlementsKnown(record){return (!record.quiet||(record.quiet.returned&&!record.quiet.unknown))
  &&record.enrollments.every(r=>r.returned&&r.authenticated&&r.scope!==null)
  &&!record.unknown&&record.pending.size===0}
function settlementToken(token,participant,kind,arity){
  const record=bound(token,participant,kind,arity);
  if(active!==record||record.stage!=='settling'||!settlementsKnown(record))refuse();
}
function releaseToken(token,participant,kind,arity){
  const record=bound(token,participant,kind,arity);
  if(record.route==='quiet')refuse();
  if(record.stage!=='terminal'||!settlementsKnown(record)
    ||!record.settlements.every(r=>r.returned))refuse();
}
export function assertDashboardCutoverJointNativeTokenV4(token,originalLoaded){liveToken(token,originalLoaded,'originalLoaded',arguments.length)}
export function assertDashboardCutoverJointDefinitionTokenV4(token,originalDefinition){liveToken(token,originalDefinition,'originalDefinition',arguments.length)}
export function assertDashboardCutoverJointOwnerTokenV4(token,originalOwner){
  const record=bound(token,originalOwner,'originalOwner',arguments.length);checkOperation(record);
  if(record.route!=='reservation'||record.stage!=='working'||!record.pre32.authenticated
    ||!record.reservation.invocationIntent)refuse();
  checkOperation(record);
}
export function assertDashboardCutoverJointQuietTokenV4(token,originalOwner,definitionScope){
  if(operation?.quiet?.checking){operation.revoked=true;operation.unknown=true;refuse()}
  if(arguments.length!==3)refuse();
  const record=bound(token,originalOwner,'originalOwner',2);
  if(record.route!=='quiet'||record.stage!=='working'||!record.quiet.invocationIntent
    ||record.enrollments[1].scope!==definitionScope)refuse();
  record.quiet.checking=true;
  try{checkOperation(record)}catch{record.revoked=true;record.unknown=true;refuse()}
  finally{record.quiet.checking=false}
}
export function assertDashboardCutoverJointPhysicalTokenV4(token,originalOwner,scope){
  if(arguments.length!==3)refuse();
  const record=bound(token,originalOwner,'originalOwner',2);checkOperation(record);
  if(record.route!=='reservation'||record.stage!=='working'||!record.pre32.authenticated
    ||record.pre32.scope!==scope||!record.physical.intent)refuse();
  preparation.census.assertHeldDashboardCutoverPre32PhysicalMetadataV4(scope,originalOwner,token);
  record.physical.registered=true;checkOperation(record);
}
export async function executeDashboardCutoverJointPhysicalOwnerReservationV4(token,originalOwner,scope){
  if(operation?.physical?.ownerChecking||operation?.physical?.ownerAttempted){
    operation.revoked=true;operation.unknown=true;refuse();
  }
  if(arguments.length!==3)refuse();
  const record=bound(token,originalOwner,'originalOwner',2);
  record.physical.ownerChecking=true;
  try{
    assertDashboardCutoverJointPhysicalTokenV4(token,originalOwner,scope);
    if(record.physical.ownerAttempted||record.reservation.invocationIntent)refuse();
    preparation.physical.assertHeldDashboardCutoverJointPhysicalOwnerEntryV4(scope,originalOwner,token);
    checkOperation(record);record.physical.ownerAttempted=true;
    record.physical.ownerChecking=false;
    record.reservation.invocationIntent=true;checkOperation(record);
    await originalOccurrence(record,()=>preparation.owner.reserveDeploymentCutoverFirstGenerationWithOwnerV4(originalOwner,token));
    record.reservation.returned=true;checkOperation(record);
    preparation.reservation.assertFirstGenerationDashboardCutoverJointReservationV4(token);checkOperation(record);
  }catch{record.revoked=true;record.unknown=true;refuse()}
  finally{record.physical.ownerChecking=false}
}
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

async function originalOccurrence(record,invoke){
  const occurrence={intent:true,returned:false,promise:null,settled:false};
  try{
    record.originals.push(occurrence);checkOperation(record);
    record.pending.add(occurrence);checkOperation(record);
    occurrence.promise=invoke();occurrence.returned=true;
    if(!types.isPromise(occurrence.promise))refuse();
    // Observe the SAME native promise; a lost response never invents settlement.
    void occurrence.promise.then(()=>{occurrence.settled=true;record.pending.delete(occurrence)},
      ()=>{occurrence.settled=true;record.pending.delete(occurrence);record.revoked=true;record.unknown=true});
    checkOperation(record);await occurrence.promise;checkOperation(record);
  }catch{record.revoked=true;record.unknown=true;refuse()}
}

async function acquireLocalDrainOriginal(record,kind){
  const occurrence=record.localDrain[kind];occurrence.intent=true;checkOperation(record);
  try{
    record.pending.add(occurrence);checkOperation(record);
    occurrence.promise=kind==='js'
      ?preparation.localDrain.acquireDashboardCutoverLocalProducerDrainV2()
      :preparation.localDrain.acquireDashboardCutoverLocalChildDrainV3(record.localDrain.js.value);
    if(!types.isPromise(occurrence.promise))refuse();
    Reflect.apply(originalThen,occurrence.promise,[value=>{
      // Preserve actual fulfilled custody BEFORE any pending-set/liveness cut.
      occurrence.value=value;occurrence.returned=true;occurrence.settled=true;
      record.pending.delete(occurrence);
    },()=>{
      occurrence.settled=true;record.pending.delete(occurrence);
      record.revoked=true;record.unknown=true;
    }]);
    await occurrence.promise;checkOperation(record);
    if(!occurrence.returned)refuse();
    if(kind==='js')preparation.localDrain.assertDashboardCutoverLocalProducerDrainV2(occurrence.value);
    else preparation.localDrain.assertDashboardCutoverLocalChildDrainV3(occurrence.value);
    occurrence.authenticated=true;checkOperation(record);
  }catch{record.revoked=true;record.unknown=true;refuse()}
}

export async function executeDashboardCutoverJointPre32AssertionsV4(token,originalDefinition,scope){
  if(operation?.pre32?.checking){operation.revoked=true;refuse()}
  if(arguments.length!==3||scope===null||typeof scope!=='object'||types.isProxy(scope))refuse();
  const record=bound(token,originalDefinition,'originalDefinition',2);checkOperation(record);
  if(!['pre32','reservation'].includes(record.route)||record.stage!=='working'||!record.pre32.invocationIntent||record.pre32.helperAttempted)refuse();
  const state=record.pre32;state.helperAttempted=true;state.checking=true;state.scope=scope;
  try{
    await originalOccurrence(record,()=>preparation.census.assertHeldDashboardCutoverPre32DatabaseV2(scope));
    state.authenticated=true;sourceCheck(()=>checkOperation(record));
    preparation.native.assertHeldDashboardCutoverLoadedJobOperationV4(record.enrollments[0].scope);checkOperation(record);
    preparation.definition.assertHeldDashboardCutoverApprovedDefinitionOperationV4(record.enrollments[1].scope);checkOperation(record);
    sourceCheck(()=>checkOperation(record));
    preparation.native.assertHeldDashboardCutoverLoadedJobOperationV4(record.enrollments[0].scope);checkOperation(record);
    preparation.definition.assertHeldDashboardCutoverApprovedDefinitionOperationV4(record.enrollments[1].scope);checkOperation(record);
    if(record.route==='reservation'){
      record.physical.intent=true;checkOperation(record);
      await originalOccurrence(record,()=>preparation.census.runHeldDashboardCutoverPre32PhysicalReservationV4(scope,record.originalOwner,record.token));
      record.physical.returned=true;checkOperation(record);
      if(!record.reservation.returned)refuse();
    }
    await originalOccurrence(record,()=>preparation.census.assertHeldDashboardCutoverPre32DatabaseV2(scope));
  }catch{record.revoked=true;record.unknown=true;refuse()}
  finally{state.checking=false;state.helperSettled=true}
}

async function qualifyOriginals(originalLoaded,originalDefinition,arity,route,originalOwner){
  // Pending preparation and original work are fenced BEFORE all input parsing.
  if(active){revokeActive();refuse()}
  const ownerRoute=route==='reservation'||route==='quiet';
  if(arity!==(ownerRoute?3:2)||originalLoaded===null||typeof originalLoaded!=='object'
    ||originalDefinition===null||typeof originalDefinition!=='object'
    ||types.isProxy(originalLoaded)||types.isProxy(originalDefinition)
    ||(ownerRoute&&(originalOwner===null||typeof originalOwner!=='object'||types.isProxy(originalOwner))))refuse();
  if(attempted||preparation.revoked)refuse();
  active=preparation;
  try{
    await prepare(route==='pre32'||route==='reservation',route==='reservation',route==='quiet');checkPreparation();
    // Fixed provider assertions own their WeakMaps; no caller-supplied ports.
    preparation.native.assertHeldDashboardCutoverLoadedJobPeerV4(originalLoaded);checkPreparation();
    preparation.definition.assertHeldDashboardCutoverApprovedDefinitionV4(originalDefinition);checkPreparation();
    if(ownerRoute){preparation.owner.assertDeploymentCutoverOwnerV1(originalOwner);checkPreparation()}
    sourceCheck(checkPreparation);
  }catch{
    if(!preparation.ready)preparation.revoked=true;
    if(preparation.imports.every(r=>r.settled))active=null;
    refuse();
  }
  attempted=true;
  const record={originalLoaded,originalDefinition,originalOwner,route,stage:'enrolling',revoked:false,published:false,
    token:null,pending:new Set(),originals:[],unknown:false,
    enrollments:[{intent:false,returned:false,authenticated:false,scope:null},
      {intent:false,returned:false,authenticated:false,scope:null}],
    settlements:[{intent:false,returned:false},{intent:false,returned:false}],
    pre32:{invocationIntent:false,helperAttempted:false,helperSettled:false,checking:false,scope:null,authenticated:false},
    reservation:{invocationIntent:false,returned:false},
    physical:{intent:false,registered:false,returned:false,ownerAttempted:false,ownerChecking:false},
    quiet:route==='quiet'?{invocationIntent:false,returned:false,unknown:true,checking:false}:null,
    localDrain:{ready:false,
      js:{intent:false,promise:null,returned:false,settled:false,value:null,authenticated:false},
      child:{intent:false,promise:null,returned:false,settled:false,value:null,authenticated:false}}};
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
    if(route==='reservation'){
      record.stage='draining';checkOperation(record);
      await acquireLocalDrainOriginal(record,'js');
      await acquireLocalDrainOriginal(record,'child');
      if(!record.localDrain.js.authenticated||!record.localDrain.child.authenticated)refuse();
      record.localDrain.ready=true;checkOperation(record);
    }
    record.stage='working';
    if(route==='pre32'||route==='reservation'){
      record.pre32.invocationIntent=true;
      await originalOccurrence(record,()=>preparation.definition.runHeldDashboardCutoverApprovedDefinitionOperationPre32V4(record.enrollments[1].scope));
      if(!record.pre32.authenticated||!record.pre32.helperSettled)refuse();
    }
    if(route==='quiet'){
      record.quiet.invocationIntent=true;checkOperation(record);
      await originalOccurrence(record,()=>preparation.owner.quietDeploymentCutoverLaunchersWithOwnerV4(
        originalOwner,token,record.enrollments[1].scope));
      record.quiet.returned=true;record.quiet.unknown=false;checkOperation(record);
    }
    const check=()=>checkOperation(record);
    sourceCheck(check);
    preparation.native.assertHeldDashboardCutoverLoadedJobOperationV4(record.enrollments[0].scope);check();
    if(route!=='quiet')preparation.definition.assertHeldDashboardCutoverApprovedDefinitionOperationV4(record.enrollments[1].scope);check();
    sourceCheck(check);
    preparation.native.assertHeldDashboardCutoverLoadedJobOperationV4(record.enrollments[0].scope);check();
    if(route!=='quiet')preparation.definition.assertHeldDashboardCutoverApprovedDefinitionOperationV4(record.enrollments[1].scope);check();
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

export async function qualifyHeldDashboardCutoverJointOriginalOperationV4(originalLoaded,originalDefinition){
  return qualifyOriginals(originalLoaded,originalDefinition,arguments.length,'original');
}
export async function qualifyHeldDashboardCutoverJointPre32OperationV4(originalLoaded,originalDefinition){
  return qualifyOriginals(originalLoaded,originalDefinition,arguments.length,'pre32');
}
export async function reserveHeldDashboardCutoverJointFirstGenerationV4(originalLoaded,originalDefinition,originalOwner){
  return qualifyOriginals(originalLoaded,originalDefinition,arguments.length,'reservation',originalOwner);
}
export async function quietHeldDashboardCutoverJointLaunchersV4(originalLoaded,originalDefinition,originalOwner){
  return qualifyOriginals(originalLoaded,originalDefinition,arguments.length,'quiet',originalOwner);
}
