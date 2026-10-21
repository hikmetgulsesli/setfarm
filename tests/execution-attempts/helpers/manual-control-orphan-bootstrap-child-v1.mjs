import * as fs from 'node:fs';
import {spawn,spawnSync} from 'node:child_process';
import {createHash,randomBytes} from 'node:crypto';
import * as net from 'node:net';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {TextDecoder,types} from 'node:util';

export const MANUAL_ORPHAN_BASENAME_V1='manual-control-orphan-bootstrap-v1.integration.test.ts';
export const MANUAL_ORPHAN_VECTOR_V1=Object.freeze([
  'node','--import','tsx','--test','--test-isolation=none',
  'tests/execution-attempts/'+MANUAL_ORPHAN_BASENAME_V1,
]);

function validateCellsV1(cells){
  if(!Array.isArray(cells))throw Error('MANUAL_ORPHAN_FRAME_REFUSED');
  for(let index=0;index<cells.length;index++){
    if(!Object.hasOwn(cells,index)||typeof cells[index]!=='string'){
      throw Error('MANUAL_ORPHAN_FRAME_REFUSED');
    }
  }
}

export function mentionsManualOrphanFileV1(cells){
  validateCellsV1(cells);
  return cells.some(cell=>cell.toLowerCase().includes(MANUAL_ORPHAN_BASENAME_V1));
}

export function classifyManualOrphanVectorV1(cells){
  validateCellsV1(cells);
  const same=cells.length===MANUAL_ORPHAN_VECTOR_V1.length
    &&cells.every((cell,index)=>cell===MANUAL_ORPHAN_VECTOR_V1[index]);
  return same?'exact':mentionsManualOrphanFileV1(cells)?'near':'unrelated';
}

function probeFrameRefusalV1(){
  return Error('MANUAL_ORPHAN_FRAME_REFUSED');
}

// Inspect every own descriptor before reading values. Reject proxies before any
// reflective operation so validation cannot execute their property traps either.
function probeOwnDataV1(value,keys){
  if(value===null||typeof value!=='object'||types.isProxy(value)
    ||Object.getPrototypeOf(value)!==Object.prototype)throw probeFrameRefusalV1();
  const descriptors=Object.getOwnPropertyDescriptors(value);
  if(Reflect.ownKeys(descriptors).length!==keys.length)throw probeFrameRefusalV1();
  for(const key of keys){
    if(!Object.hasOwn(descriptors,key)||!descriptors[key].enumerable
      ||!Object.hasOwn(descriptors[key],'value'))throw probeFrameRefusalV1();
  }
  return Object.fromEntries(keys.map(key=>[key,descriptors[key].value]));
}

function probeHexV1(value){
  return typeof value==='string'&&value.length===64&&/^[0-9a-f]{64}$/.test(value);
}

function probeIntegerV1(value,minimum){
  return Number.isSafeInteger(value)&&value>=minimum&&value<=2147483647;
}

function probeTimestampV1(value){
  if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.000Z$/.test(value))return false;
  const date=new Date(value);
  return Number.isFinite(date.getTime())&&date.toISOString()===value;
}

function probeExecutableV1(value){
  // POSIX normalization is syntactic here; no path is resolved or opened.
  return typeof value==='string'&&value.length>1&&value.startsWith('/')
    &&Buffer.byteLength(value,'utf8')<=4096&&!/[\u0000-\u001f\u007f-\u009f]/.test(value)
    &&Buffer.from(value,'utf8').toString('utf8')===value
    &&value.split('/').slice(1).every(part=>part!==''&&part!=='.'&&part!=='..');
}

function orderedProbeProcessV1(value){
  const data=probeOwnDataV1(value,[
    'pid','ppid','uid','pgid','startedAtUTC','executable','executableSha256','commandSha256',
  ]);
  if(!probeIntegerV1(data.pid,1)||!probeIntegerV1(data.ppid,1)
    ||!probeIntegerV1(data.uid,0)||!probeIntegerV1(data.pgid,1)
    ||!probeTimestampV1(data.startedAtUTC)||!probeExecutableV1(data.executable)
    ||!probeHexV1(data.executableSha256)||!probeHexV1(data.commandSha256))throw probeFrameRefusalV1();
  return {
    pid:data.pid,ppid:data.ppid,uid:data.uid,pgid:data.pgid,
    startedAtUTC:data.startedAtUTC,executable:data.executable,
    executableSha256:data.executableSha256,commandSha256:data.commandSha256,
  };
}

function orderedProbeFrameV1(value){
  const data=probeOwnDataV1(value,['schema','nonce','parent','child','source']);
  if(data.schema!=='setfarm.manual-orphan-lifecycle-probe.v1'||!probeHexV1(data.nonce))throw probeFrameRefusalV1();
  const parent=orderedProbeProcessV1(data.parent),child=orderedProbeProcessV1(data.child);
  const source=probeOwnDataV1(data.source,['helperSha256','issuerTestSha256']);
  if(!probeHexV1(source.helperSha256)||!probeHexV1(source.issuerTestSha256))throw probeFrameRefusalV1();
  return {
    schema:data.schema,nonce:data.nonce,parent,child,
    source:{helperSha256:source.helperSha256,issuerTestSha256:source.issuerTestSha256},
  };
}

export function encodeManualOrphanProbeFrameV1(frame){
  try{
    const bytes=Buffer.from(JSON.stringify(orderedProbeFrameV1(frame))+'\n','utf8');
    if(bytes.length>16384)throw probeFrameRefusalV1();
    return bytes;
  }catch{
    throw probeFrameRefusalV1();
  }
}

export function decodeManualOrphanProbeFrameV1(bytes){
  try{
    if(types.isProxy(bytes)||!Buffer.isBuffer(bytes))throw probeFrameRefusalV1();
    // Read the actual view size, independent of any own length/byteLength data.
    const size=Object.getOwnPropertyDescriptor(Object.getPrototypeOf(Uint8Array.prototype),'byteLength').get.call(bytes);
    if(size<1||size>16384||bytes[size-1]!==0x0a)throw probeFrameRefusalV1();
    // Retain a BOM rather than stripping it; both parse and exact bytes remain
    // strict. Fatal decoding must precede JSON parsing to reject replacement UTF8.
    const text=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(bytes);
    const frame=orderedProbeFrameV1(JSON.parse(text.slice(0,-1)));
    if(Buffer.compare(bytes,encodeManualOrphanProbeFrameV1(frame))!==0)throw probeFrameRefusalV1();
    Object.freeze(frame.parent);Object.freeze(frame.child);Object.freeze(frame.source);
    return Object.freeze(frame);
  }catch{
    throw probeFrameRefusalV1();
  }
}

// Owned-setup codecs validate data only. Their carried process/Source/catalog
// observations grant no permission and are never resolved, opened or adopted.
// Reuse only the probe's inert descriptor/string grammar, leaving its public
// numeric/arity/codec behavior unchanged.
const ownedTargetShaV1='161297ffca6adf2851918a93d492e1c9a77ce59d';
const ownedSourceFileKeysV1=Object.freeze([
  'constructor','constructorTests','wrapper','isolatedRunner','builtinChild','routeTests',
  'fixture','integration','journal','pgPreflight','profile',
]);
const ownedCreatedRecordKeysV1=Object.freeze([
  'planned.json','owner-created.json','runtime-created.json','database-created.json',
  'runtime-credentials.json','schema-prepared.json','schema-committed.json',
]);
const ownedActivatedRecordKeysV1=Object.freeze([
  ...ownedCreatedRecordKeysV1,'activation-prepared.json','activated.json',
]);

function ownedRequireV1(condition){if(!condition)throw probeFrameRefusalV1();}
function ownedIntegerV1(value,minimum=0,maximum=2147483647){
  return Number.isSafeInteger(value)&&!Object.is(value,-0)&&value>=minimum&&value<=maximum;
}
function ownedDecimalV1(value,maximum,nonzero=false){
  return typeof value==='string'&&value.length<=maximum.length&&/^(0|[1-9][0-9]*)$/.exec(value)?.[0]===value
    &&(!nonzero||value!=='0')&&(value.length<maximum.length||value<=maximum);
}
function ownedGitShaV1(value){return typeof value==='string'&&value.length===40&&/^[0-9a-f]{40}$/.test(value);}
function ownedUuidV1(value){
  return typeof value==='string'&&value.length===36&&/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(value);
}
function ownedMicrosecondTimestampV1(value){
  if(typeof value!=='string'||value.length!==27||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/.test(value))return false;
  const date=new Date(value);
  return Number.isFinite(date.getTime())&&date.toISOString()===value.slice(0,23)+'Z';
}
function ownedProcessV1(value){
  const data=probeOwnDataV1(value,[
    'pid','ppid','uid','pgid','startedAtUTC','executable','executableSha256','commandSha256',
  ]);
  ownedRequireV1(ownedIntegerV1(data.pid,1)&&ownedIntegerV1(data.ppid,1)
    &&ownedIntegerV1(data.uid)&&ownedIntegerV1(data.pgid,1)
    &&probeTimestampV1(data.startedAtUTC)&&probeExecutableV1(data.executable)
    &&probeHexV1(data.executableSha256)&&probeHexV1(data.commandSha256));
  return data;
}
function ownedDirectoryV1(value){
  const data=probeOwnDataV1(value,['dev','ino','uid','gid','mode']);
  ownedRequireV1(ownedDecimalV1(data.dev,'18446744073709551615')
    &&ownedDecimalV1(data.ino,'18446744073709551615')
    &&ownedIntegerV1(data.uid)&&data.uid===501&&ownedIntegerV1(data.gid)&&data.gid===20
    &&ownedIntegerV1(data.mode,0,4095)&&data.mode===448);
  return data;
}
function ownedFileV1(value){
  const data=probeOwnDataV1(value,[
    'dev','ino','uid','gid','mode','nlink','bytes','mtimeNs','ctimeNs','sha256',
  ]);
  ownedRequireV1(ownedDecimalV1(data.dev,'18446744073709551615')
    &&ownedDecimalV1(data.ino,'18446744073709551615')
    &&ownedIntegerV1(data.uid)&&data.uid===501&&ownedIntegerV1(data.gid)
    &&ownedIntegerV1(data.mode,0,4095)&&(data.mode&0o022)===0
    &&ownedIntegerV1(data.nlink,1,1)&&ownedIntegerV1(data.bytes,0,16777216)
    &&ownedDecimalV1(data.mtimeNs,'9223372036854775807')
    &&ownedDecimalV1(data.ctimeNs,'9223372036854775807')&&probeHexV1(data.sha256));
  return data;
}
function ownedReleaseV1(value){
  const data=probeOwnDataV1(value,['sha','treeHash','buildHash']);
  ownedRequireV1(ownedGitShaV1(data.sha)&&ownedGitShaV1(data.treeHash)&&probeHexV1(data.buildHash));
  return data;
}
function ownedReleasePairV1(maintenanceValue,targetValue){
  const maintenance=ownedReleaseV1(maintenanceValue),target=ownedReleaseV1(targetValue);
  ownedRequireV1(target.sha===ownedTargetShaV1&&maintenance.sha!==target.sha);
  return {maintenance,target};
}
function ownedSourcesV1(value){
  const data=probeOwnDataV1(value,['maintenance','target','profileSha256','files']);
  const {maintenance,target}=ownedReleasePairV1(data.maintenance,data.target);
  ownedRequireV1(probeHexV1(data.profileSha256));
  const files=probeOwnDataV1(data.files,ownedSourceFileKeysV1);
  for(const key of ownedSourceFileKeysV1)files[key]=ownedFileV1(files[key]);
  return {maintenance,target,profileSha256:data.profileSha256,files};
}
function ownedClusterV1(value){
  const data=probeOwnDataV1(value,[
    'root','data','port','postmasterStartedAtUTC','systemIdentifier','serverVersionNum',
    'databaseBaselineSha256','roleBaselineSha256','membershipBaselineSha256',
  ]);
  data.root=ownedDirectoryV1(data.root);data.data=ownedDirectoryV1(data.data);
  ownedRequireV1(ownedIntegerV1(data.port,1024,65535)&&data.port!==5432
    &&ownedMicrosecondTimestampV1(data.postmasterStartedAtUTC)
    &&ownedDecimalV1(data.systemIdentifier,'18446744073709551615',true)
    &&ownedIntegerV1(data.serverVersionNum,170000,179999)
    &&probeHexV1(data.databaseBaselineSha256)&&probeHexV1(data.roleBaselineSha256)
    &&probeHexV1(data.membershipBaselineSha256));
  return data;
}
function ownedRecordV1(value,maximum){
  const data=probeOwnDataV1(value,['bytes','sha256']);
  ownedRequireV1(ownedIntegerV1(data.bytes,1,maximum)&&probeHexV1(data.sha256));
  return data;
}
function ownedInstallationV1(value,activated){
  const keys=['installationId','operationId','directory','databaseName','databaseOid',
    'ownerRole','ownerOid','runtimeRole','runtimeOid','sourceSha','schemaCatalogHash'];
  if(activated)keys.push('activationCatalogHash');
  keys.push('records');
  const data=probeOwnDataV1(value,keys);
  ownedRequireV1(ownedUuidV1(data.installationId)&&ownedUuidV1(data.operationId));
  const suffix=data.installationId.replaceAll('-','');
  ownedRequireV1(data.databaseName==='setfarm_install_'+suffix&&data.ownerRole==='sf_owner_'+suffix
    &&data.runtimeRole==='sf_runtime_'+suffix&&ownedIntegerV1(data.databaseOid,1,4294967295)
    &&ownedIntegerV1(data.ownerOid,1,4294967295)&&ownedIntegerV1(data.runtimeOid,1,4294967295)
    &&data.ownerOid!==data.runtimeOid&&data.sourceSha===ownedTargetShaV1
    &&probeHexV1(data.schemaCatalogHash)&&(!activated||probeHexV1(data.activationCatalogHash)));
  // Database OIDs and role OIDs belong to different catalogs; no cross-catalog
  // inequality is imposed. Stage catalog hashes remain separate carried data.
  data.directory=ownedDirectoryV1(data.directory);
  const recordKeys=activated?ownedActivatedRecordKeysV1:ownedCreatedRecordKeysV1;
  data.records=probeOwnDataV1(data.records,recordKeys);
  for(const key of recordKeys)data.records[key]=ownedRecordV1(data.records[key],
    key==='runtime-credentials.json'?4096:32768);
  return data;
}
function ownedGraphV1(data){
  data.constructor=ownedProcessV1(data.constructor);data.runner=ownedProcessV1(data.runner);
  data.server=ownedProcessV1(data.server);
  ownedRequireV1(data.runner.ppid===data.constructor.pid&&data.server.ppid===data.constructor.pid);
  data.source=ownedSourcesV1(data.source);data.cluster=ownedClusterV1(data.cluster);
  ownedRequireV1(probeHexV1(data.run));
}
function orderedOwnedRunnerSetupV1(value){
  const data=probeOwnDataV1(value,[
    'schema','run','constructor','runner','server','source','cluster','adminPassword',
  ]);
  ownedRequireV1(data.schema==='setfarm.manual-orphan-runner-setup.v1'&&probeHexV1(data.adminPassword));
  ownedGraphV1(data);return data;
}
function orderedOwnedPhaseV1(value){
  const data=probeOwnDataV1(value,[
    'schema','run','constructor','runner','parent','child','server','source','cluster',
    'installations','purpose','input',
  ]);
  ownedRequireV1(data.schema==='setfarm.manual-orphan-owned-phase.v1');ownedGraphV1(data);
  data.parent=ownedProcessV1(data.parent);data.child=ownedProcessV1(data.child);
  data.installations=ownedDirectoryV1(data.installations);
  const mechanical=data.purpose==='old_entry_positive'||data.purpose==='new_entry_refusal';
  ownedRequireV1(data.purpose==='provision'||data.purpose==='activate'||data.purpose==='integration'||mechanical);
  ownedRequireV1(data.child.ppid===data.parent.pid&&(mechanical?data.parent.ppid===data.runner.pid:
    JSON.stringify(data.parent)===JSON.stringify(data.runner)));
  if(data.purpose==='provision'){
    data.input=probeOwnDataV1(data.input,['adminPassword']);
    ownedRequireV1(probeHexV1(data.input.adminPassword));
  }else if(data.purpose==='activate'){
    data.input=probeOwnDataV1(data.input,['adminPassword','installation']);
    ownedRequireV1(probeHexV1(data.input.adminPassword));
    data.input.installation=ownedInstallationV1(data.input.installation,false);
  }else{
    data.input=probeOwnDataV1(data.input,['installation']);
    data.input.installation=ownedInstallationV1(data.input.installation,true);
  }
  return data;
}
function ownedOldEntryResultV1(value){
  const data=probeOwnDataV1(value,[
    'state','maintenance','target','installationId','sameClient','entryAssert','databaseAssert','close','closedGetter',
  ]);
  ownedRequireV1(data.state==='old-entry-verified'&&ownedUuidV1(data.installationId)
    &&data.sameClient===true&&data.entryAssert===true&&data.databaseAssert===true
    &&data.close==='fulfilled'&&data.closedGetter==='refused');
  const pair=ownedReleasePairV1(data.maintenance,data.target);
  data.maintenance=pair.maintenance;data.target=pair.target;return data;
}
function ownedNewEntryResultV1(value){
  const data=probeOwnDataV1(value,[
    'state','maintenance','target','installationId','mismatch','close','closedGetter',
  ]);
  ownedRequireV1(data.state==='source-mismatch-refused'&&ownedUuidV1(data.installationId)
    &&data.mismatch==='maintenance-sha-vs-target-origin'&&data.close==='fulfilled'&&data.closedGetter==='refused');
  const pair=ownedReleasePairV1(data.maintenance,data.target);
  data.maintenance=pair.maintenance;data.target=pair.target;return data;
}
function orderedOwnedPhaseResultV1(value){
  const data=probeOwnDataV1(value,[
    'schema','run','purpose','frameSha256','pid','parentPid','fd4Closed','sourcePinsClosed','result',
  ]);
  ownedRequireV1(data.schema==='setfarm.manual-orphan-owned-phase-result.v1'
    &&probeHexV1(data.run)&&probeHexV1(data.frameSha256)&&ownedIntegerV1(data.pid,1)
    &&ownedIntegerV1(data.parentPid,1)&&data.fd4Closed===true&&data.sourcePinsClosed===true);
  if(data.purpose==='provision'){
    const result=probeOwnDataV1(data.result,['state','installation','factoryOwnerClose']);
    ownedRequireV1(result.state==='schema-verified'&&result.factoryOwnerClose==='fulfilled');
    result.installation=ownedInstallationV1(result.installation,false);data.result=result;
  }else if(data.purpose==='activate'){
    const result=probeOwnDataV1(data.result,[
      'state','installation','selectionBefore','selectionAfter','databaseModuleClose',
    ]);
    ownedRequireV1(result.state==='activation-verified'&&result.selectionBefore==='schema-committed-unactivated'
      &&result.selectionAfter==='stale-refused'&&result.databaseModuleClose==='fulfilled');
    result.installation=ownedInstallationV1(result.installation,true);data.result=result;
  }else if(data.purpose==='old_entry_positive')data.result=ownedOldEntryResultV1(data.result);
  else if(data.purpose==='new_entry_refusal')data.result=ownedNewEntryResultV1(data.result);
  else throw probeFrameRefusalV1();
  return data;
}
function ownedMechanicalPairV1(data){
  data.oldEntry=ownedOldEntryResultV1(data.oldEntry);data.newEntry=ownedNewEntryResultV1(data.newEntry);
  ownedRequireV1(data.oldEntry.installationId===data.newEntry.installationId
    &&JSON.stringify(data.oldEntry.maintenance)===JSON.stringify(data.newEntry.maintenance)
    &&JSON.stringify(data.oldEntry.target)===JSON.stringify(data.newEntry.target));
}
function ownedResultEnvelopeV1(data,schema){
  ownedRequireV1(data.schema===schema&&probeHexV1(data.run)&&probeHexV1(data.frameSha256)
    &&ownedIntegerV1(data.pid,1)&&ownedIntegerV1(data.parentPid,1)&&data.sourcePinsClosed===true);
  ownedMechanicalPairV1(data);
}
function orderedOwnedIntegrationResultV1(value){
  const data=probeOwnDataV1(value,[
    'schema','run','frameSha256','pid','parentPid','oldEntry','newEntry','sourcePinsClosed',
  ]);
  ownedResultEnvelopeV1(data,'setfarm.manual-orphan-integration-result.v1');return data;
}
function orderedOwnedRunnerResultV1(value){
  const data=probeOwnDataV1(value,[
    'schema','run','frameSha256','pid','parentPid','installationId','oldEntry','newEntry','cleanup','sourcePinsClosed',
  ]);
  ownedResultEnvelopeV1(data,'setfarm.manual-orphan-runner-result.v1');
  ownedRequireV1(ownedUuidV1(data.installationId)&&data.installationId===data.oldEntry.installationId);
  data.cleanup=probeOwnDataV1(data.cleanup,[
    'databaseAbsent','ownerRoleAbsent','runtimeRoleAbsent','baselineRestored','adminClose',
  ]);
  ownedRequireV1(data.cleanup.databaseAbsent===true&&data.cleanup.ownerRoleAbsent===true
    &&data.cleanup.runtimeRoleAbsent===true&&data.cleanup.baselineRestored===true&&data.cleanup.adminClose==='fulfilled');
  return data;
}
function encodeOwnedDataV1(value,normalize,arity){
  try{
    ownedRequireV1(arity===1);
    const bytes=Buffer.from(JSON.stringify(normalize(value))+'\n','utf8');
    ownedRequireV1(bytes.length<=16384);return bytes;
  }catch{throw probeFrameRefusalV1();}
}
function freezeOwnedDataV1(value){
  for(const item of Object.values(value))if(item!==null&&typeof item==='object')freezeOwnedDataV1(item);
  return Object.freeze(value);
}
function decodeOwnedDataV1(bytes,normalize,arity){
  try{
    ownedRequireV1(arity===1&&!types.isProxy(bytes)&&Buffer.isBuffer(bytes));
    const size=Object.getOwnPropertyDescriptor(Object.getPrototypeOf(Uint8Array.prototype),'byteLength').get.call(bytes);
    ownedRequireV1(size>=1&&size<=16384&&bytes[size-1]===0x0a);
    const text=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(bytes);
    const data=normalize(JSON.parse(text.slice(0,-1)));
    ownedRequireV1(Buffer.compare(bytes,encodeOwnedDataV1(data,normalize,1))===0);
    return freezeOwnedDataV1(data);
  }catch{throw probeFrameRefusalV1();}
}
export function encodeManualOrphanRunnerSetupFrameV1(value){
  return encodeOwnedDataV1(value,orderedOwnedRunnerSetupV1,arguments.length);
}
export function decodeManualOrphanRunnerSetupFrameV1(bytes){
  return decodeOwnedDataV1(bytes,orderedOwnedRunnerSetupV1,arguments.length);
}
export function encodeManualOrphanOwnedPhaseFrameV1(value){
  return encodeOwnedDataV1(value,orderedOwnedPhaseV1,arguments.length);
}
export function decodeManualOrphanOwnedPhaseFrameV1(bytes){
  return decodeOwnedDataV1(bytes,orderedOwnedPhaseV1,arguments.length);
}
export function encodeManualOrphanOwnedPhaseResultV1(value){
  return encodeOwnedDataV1(value,orderedOwnedPhaseResultV1,arguments.length);
}
export function decodeManualOrphanOwnedPhaseResultV1(bytes){
  return decodeOwnedDataV1(bytes,orderedOwnedPhaseResultV1,arguments.length);
}
export function encodeManualOrphanIntegrationResultV1(value){
  return encodeOwnedDataV1(value,orderedOwnedIntegrationResultV1,arguments.length);
}
export function decodeManualOrphanIntegrationResultV1(bytes){
  return decodeOwnedDataV1(bytes,orderedOwnedIntegrationResultV1,arguments.length);
}
export function encodeManualOrphanRunnerResultV1(value){
  return encodeOwnedDataV1(value,orderedOwnedRunnerResultV1,arguments.length);
}
export function decodeManualOrphanRunnerResultV1(bytes){
  return decodeOwnedDataV1(bytes,orderedOwnedRunnerResultV1,arguments.length);
}

function probeOwnerRefusalV1(){return Error('MANUAL_ORPHAN_OWNER_REFUSED');}
function probeCloseUnknownV1(){return Error('MANUAL_ORPHAN_CHILD_UNKNOWN');}

// Capture each returned FD immediately. Closing burns its ownership before the
// syscall; an uncertain close can never be retried against a reused descriptor.
function probeDescriptorOwnerV1(){
  const descriptors=[];let closed=false,unknown=false;
  const guard=()=>{
    if(unknown)throw probeCloseUnknownV1();
    if(closed)throw probeOwnerRefusalV1();
  };
  return {
    guard,
    open(locator,flags){guard();const fd=fs.openSync(locator,flags);descriptors.push(fd);return fd;},
    close(){
      if(!closed){
        closed=true;
        for(let index=descriptors.length-1;index>=0;index--){
          try{fs.closeSync(descriptors[index]);}catch{unknown=true;}
        }
      }
      if(unknown)throw probeCloseUnknownV1();
    },
  };
}

function sameProbeFileV1(first,second){
  return ['dev','ino','uid','gid','mode','nlink','size','mtimeNs','ctimeNs']
    .every(key=>first[key]===second[key]);
}
function sameProbeDirectoryV1(first,second){
  return ['dev','ino','uid','mode'].every(key=>first[key]===second[key]);
}
function probeDirectoryShapeV1(stat){return stat.isDirectory()&&!stat.isSymbolicLink();}

function pinProbeFileV1(locator,cap,kind,owner){
  owner.guard();
  if(!probeExecutableV1(locator)||fs.realpathSync(locator)!==locator)throw probeOwnerRefusalV1();
  const ancestors=[];
  for(let current=path.dirname(locator);;current=path.dirname(current)){
    if(ancestors.length>=128)throw probeOwnerRefusalV1();
    const first=fs.lstatSync(current,{bigint:true});
    if(!probeDirectoryShapeV1(first)||fs.realpathSync(current)!==current)throw probeOwnerRefusalV1();
    const fd=owner.open(current,fs.constants.O_RDONLY|fs.constants.O_DIRECTORY|fs.constants.O_NOFOLLOW);
    const opened=fs.fstatSync(fd,{bigint:true});
    if(!probeDirectoryShapeV1(opened)||!sameProbeDirectoryV1(first,opened))throw probeOwnerRefusalV1();
    ancestors.push({locator:current,first,fd});
    if(current===path.dirname(current))break;
  }
  const first=fs.lstatSync(locator,{bigint:true}),uid=process.getuid();
  if(!probeIntegerV1(uid,0)||!first.isFile()||first.isSymbolicLink()||first.nlink!==1n
    ||first.size<0n||first.size>BigInt(cap)||(first.mode&0o022n)!==0n
    ||(first.uid!==BigInt(uid)&&(kind!=='executable'||first.uid!==0n)))throw probeOwnerRefusalV1();
  const fd=owner.open(locator,fs.constants.O_RDONLY|fs.constants.O_NOFOLLOW);
  const metadata=()=>{
    owner.guard();
    if(fs.realpathSync(locator)!==locator)throw probeOwnerRefusalV1();
    for(const ancestor of ancestors){
      const named=fs.lstatSync(ancestor.locator,{bigint:true}),held=fs.fstatSync(ancestor.fd,{bigint:true});
      if(!probeDirectoryShapeV1(named)||!probeDirectoryShapeV1(held)
        ||!sameProbeDirectoryV1(ancestor.first,named)||!sameProbeDirectoryV1(ancestor.first,held)
        ||fs.realpathSync(ancestor.locator)!==ancestor.locator)throw probeOwnerRefusalV1();
    }
    const named=fs.lstatSync(locator,{bigint:true}),held=fs.fstatSync(fd,{bigint:true});
    if(!named.isFile()||named.isSymbolicLink()||!held.isFile()||held.isSymbolicLink()
      ||!sameProbeFileV1(first,named)||!sameProbeFileV1(first,held))throw probeOwnerRefusalV1();
  };
  const readHash=()=>{
    metadata();const hash=createHash('sha256'),size=Number(first.size);
    const bytes=Buffer.alloc(Math.min(size,65536));let position=0;
    while(position<size){
      const wanted=Math.min(bytes.length,size-position),count=fs.readSync(fd,bytes,0,wanted,position);
      if(!Number.isSafeInteger(count)||count<1||count>wanted)throw probeOwnerRefusalV1();
      hash.update(bytes.subarray(0,count));position+=count;
    }
    metadata();return hash.digest('hex');
  };
  const hash=readHash();
  return {hash,check(){if(readHash()!==hash)throw probeOwnerRefusalV1();}};
}

function probeSourceLocatorsV1(){
  const helper=fileURLToPath(import.meta.url),root=path.resolve(path.dirname(helper),'../../..');
  if(helper!==path.join(root,'tests','execution-attempts','helpers','manual-control-orphan-bootstrap-child-v1.mjs')){
    throw probeOwnerRefusalV1();
  }
  return {helper,issuer:path.join(root,'scripts','__tests__','manual-orphan-bootstrap-owned-route-v1.test.js')};
}

export function pinManualOrphanProbeSourcesV1(){
  const owner=probeDescriptorOwnerV1();
  try{
    const locators=probeSourceLocatorsV1();
    const helper=pinProbeFileV1(locators.helper,16777216,'source',owner);
    const issuer=pinProbeFileV1(locators.issuer,16777216,'source',owner);
    const check=()=>{
      try{owner.guard();helper.check();issuer.check();}
      catch{owner.close();throw probeOwnerRefusalV1();}
    };
    check();
    return Object.freeze({
      hashes:Object.freeze({helperSha256:helper.hash,issuerTestSha256:issuer.hash}),
      check,close(){owner.close();},
    });
  }catch{
    owner.close();throw probeOwnerRefusalV1();
  }
}

function readProbePsV1(args){
  const result=spawnSync('/bin/ps',args,{encoding:'utf8',timeout:2000,maxBuffer:16384,
    env:{PATH:'/usr/bin:/bin',LANG:'C',LC_ALL:'C',TZ:'UTC'}});
  if(result.error!=null||result.status!==0||result.signal!==null||result.stderr!==''
    ||typeof result.stdout!=='string'||Buffer.byteLength(result.stdout,'utf8')>16384)throw probeOwnerRefusalV1();
  return result.stdout;
}

function parseProbeProcessV1(pid,before,comm,after){
  if(before!==after)throw probeOwnerRefusalV1();
  const row=/^[ \t]*(\d+)[ \t]+(\d+)[ \t]+(\d+)[ \t]+([A-Z][a-z]{2} [A-Z][a-z]{2}[ \t]+\d{1,2} \d\d:\d\d:\d\d \d{4})[ \t]+(\d+)[ \t]+([^\r\n]+)\n$/.exec(before);
  const command=/^([^\r\n]+)\n$/.exec(comm);
  if(!row||row[0]!==before||!command||command[0]!==comm||Number(row[1])!==pid
    ||!probeExecutableV1(command[1]))throw probeOwnerRefusalV1();
  const ppid=Number(row[2]),uid=Number(row[3]),pgid=Number(row[5]);
  if(!probeIntegerV1(ppid,1)||!probeIntegerV1(uid,0)||!probeIntegerV1(pgid,1))throw probeOwnerRefusalV1();
  const date=/^([A-Z][a-z]{2}) ([A-Z][a-z]{2})[ \t]+(\d{1,2}) (\d\d):(\d\d):(\d\d) (\d{4})$/.exec(row[4]);
  if(!date)throw probeOwnerRefusalV1();
  const month=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'].indexOf(date[2]);
  const day=Number(date[3]),hour=Number(date[4]),minute=Number(date[5]),second=Number(date[6]),year=Number(date[7]);
  if(month<0||year<1970||day<1||day>31||hour>23||minute>59||second>59)throw probeOwnerRefusalV1();
  const actual=new Date(Date.UTC(year,month,day,hour,minute,second));
  if(actual.getUTCFullYear()!==year||actual.getUTCMonth()!==month||actual.getUTCDate()!==day
    ||['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][actual.getUTCDay()]!==date[1])throw probeOwnerRefusalV1();
  return {ppid,uid,pgid,startedAtUTC:actual.toISOString(),executable:command[1],rawCommand:row[6]};
}

export function observeManualOrphanProcessV1(pid){
  if(!probeIntegerV1(pid,1))throw probeOwnerRefusalV1();
  const owner=probeDescriptorOwnerV1();
  try{
    const args=['-ww','-p',String(pid),'-o','pid=','-o','ppid=','-o','uid=','-o','lstart=','-o','pgid=','-o','args='];
    const before=readProbePsV1(args),comm=readProbePsV1(['-ww','-p',String(pid),'-o','comm=']),after=readProbePsV1(args);
    const facts=parseProbeProcessV1(pid,before,comm,after);
    // This path comes only from the independent ps comm observation, never a frame.
    const executable=pinProbeFileV1(facts.executable,536870912,'executable',owner);
    executable.check();
    const pin=Object.freeze({pid,ppid:facts.ppid,uid:facts.uid,pgid:facts.pgid,
      startedAtUTC:facts.startedAtUTC,executable:facts.executable,executableSha256:executable.hash,
      commandSha256:createHash('sha256').update(facts.rawCommand,'utf8').digest('hex')});
    const result=Object.freeze({pin,rawCommand:facts.rawCommand});
    owner.close();return result;
  }catch{
    owner.close();throw probeOwnerRefusalV1();
  }
}

const PROBE_EMPTY_OUTPUT_SHA256_V1='e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';

export function observeManualOrphanOriginalChildV1(child){
  let state='pending',reason=null,exit=null,close=null,exitCount=0,closeCount=0,spawned=false;
  let timer=null,timerCleared=false,historyResolved=false,resolveHistory;
  const settled=new Promise(resolve=>{resolveHistory=resolve;});
  const makeOutput=()=>({bytes:0,hash:null,end:false,close:false,chunks:[],retained:0});
  const stdout=makeOutput(),stderr=makeOutput(),fd4={finish:false,end:false,close:false};
  const outputFact=channel=>Object.freeze({bytes:channel.bytes,
    sha256:channel.hash?channel.hash.copy().digest('hex'):PROBE_EMPTY_OUTPUT_SHA256_V1,
    end:channel.end,close:channel.close});
  const snapshot=()=>Object.freeze({state,
    exit:exit===null?null:Object.freeze({...exit}),close:close===null?null:Object.freeze({...close}),
    stdout:outputFact(stdout),stderr:outputFact(stderr),fd4:Object.freeze({...fd4}),reason});
  const clearOwnedTimer=()=>{
    if(timer!==null&&!timerCleared){
      timerCleared=true;
      try{clearTimeout(timer);}catch{state='unknown';if(reason===null)reason='binding';}
    }
  };
  const settle=()=>{
    if(state==='pending'&&exitCount===1&&closeCount===1&&exit!==null&&close!==null
      &&stdout.end&&stdout.close&&stderr.end&&stderr.close&&fd4.finish&&fd4.end&&fd4.close){
      state='observed';
    }
    if(state!=='pending'&&!historyResolved){
      historyResolved=true;clearOwnedTimer();resolveHistory(snapshot());
    }
  };
  const fail=code=>{
    if(state!=='unknown'){state='unknown';reason=code;}
    settle();
  };
  const eventValue=(code,signal)=>({
    code:typeof code==='number'&&Number.isFinite(code)?code:null,
    signal:typeof signal==='string'?signal:null,
  });
  const normalExit=(code,signal)=>Number.isSafeInteger(code)&&code>=0&&signal===null;
  const witness=Object.freeze({settled,snapshot,output(){
    return {stdout:Buffer.concat(stdout.chunks,stdout.retained),stderr:Buffer.concat(stderr.chunks,stderr.retained)};
  }});

  // Bind the given original before reading streams or creating hashes/timers.
  try{
    if(child===null||typeof child!=='object'||typeof child.on!=='function'){
      fail('binding');return witness;
    }
    child.on('spawn',()=>{spawned=true;});
    child.on('error',()=>{fail(spawned?'child-error':'spawn-error');});
    child.on('exit',(code,signal)=>{
      exitCount++;
      if(exit===null)exit=eventValue(code,signal);
      if(exitCount!==1||closeCount!==0||!normalExit(code,signal))fail('exit-close');
      settle();
    });
    child.on('close',(code,signal)=>{
      closeCount++;
      if(close===null)close=eventValue(code,signal);
      if(closeCount!==1||exitCount!==1||!normalExit(code,signal)
        ||exit===null||exit.code!==code||exit.signal!==signal)fail('exit-close');
      settle();
    });
  }catch{fail('binding');return witness;}

  const streams={stdout:null,stderr:null,fd4:null};
  // Each inspection is independent: a missing channel must not prevent binding
  // and bounded draining of the other channels after UNKNOWN has been recorded.
  try{streams.stdout=child.stdout;}catch{fail('binding');}
  if(streams.stdout==null)fail('stdout');
  try{streams.stderr=child.stderr;}catch{fail('binding');}
  if(streams.stderr==null)fail('stderr');
  try{
    const stdio=child.stdio;
    if(!Array.isArray(stdio))fail('binding');
    else streams.fd4=stdio[4];
  }catch{fail('binding');}
  if(streams.fd4==null)fail('fd4');

  const present=[];
  const attachOutput=(name,channel,stream)=>{
    stream.on('error',()=>{fail(name);});
    stream.on('end',()=>{
      const invalid=channel.end||channel.close;channel.end=true;
      if(invalid)fail(name);settle();
    });
    stream.on('close',()=>{
      const invalid=channel.close||!channel.end;channel.close=true;
      if(invalid)fail(name);settle();
    });
  };
  for(const name of ['stdout','stderr','fd4']){
    const stream=streams[name];if(stream==null)continue;
    try{
      if(typeof stream.on!=='function'||typeof stream.pause!=='function'||typeof stream.resume!=='function'){
        fail('binding');continue;
      }
      if(name!=='fd4')attachOutput(name,name==='stdout'?stdout:stderr,stream);
      else{
        stream.on('error',()=>{fail('fd4');});
        stream.on('finish',()=>{const invalid=fd4.finish||fd4.close;fd4.finish=true;if(invalid)fail('fd4');settle();});
        stream.on('end',()=>{const invalid=fd4.end||fd4.close;fd4.end=true;if(invalid)fail('fd4');settle();});
        stream.on('close',()=>{
          const invalid=fd4.close||!fd4.finish||!fd4.end;fd4.close=true;if(invalid)fail('fd4');settle();
        });
      }
      present.push({name,stream});
    }catch{fail('binding');}
  }
  // Pause before adding data listeners (Readable.on('data') otherwise resumes).
  // All channel handlers are installed before any deliberate readable resume.
  for(const {name,stream} of present){try{stream.pause();}catch{fail(name);}}
  for(const {name,stream} of present){
    try{
      if(name==='fd4')stream.on('data',()=>{fail('fd4');});
      else{
        const channel=name==='stdout'?stdout:stderr;
        stream.on('data',chunk=>{
          if(!Buffer.isBuffer(chunk)){fail(name);return;}
          let invalid=channel.end||channel.close;
          channel.bytes+=chunk.length;
          try{if(channel.hash)channel.hash.update(chunk);}catch{channel.hash=null;invalid=true;}
          const count=Math.min(65536-channel.retained,chunk.length);
          if(count>0){channel.chunks.push(Buffer.from(chunk.subarray(0,count)));channel.retained+=count;}
          if(invalid)fail(name);
          if(channel.bytes>65536)fail('limit');
        });
      }
    }catch{fail('binding');}
  }
  try{stdout.hash=createHash('sha256');stderr.hash=createHash('sha256');}catch{fail('binding');}
  if(state==='pending'){
    try{timer=setTimeout(()=>{fail('deadline');},10000);}catch{fail('binding');}
    if(state!=='pending')clearOwnedTimer();
  }
  for(const {name,stream} of present){try{stream.resume();}catch{fail(name);}}
  settle();return witness;
}

export function readManualOrphanProbeFd4V1(){
  const extraArguments=arguments.length!==0;
  return new Promise((resolve,reject)=>{
    // Raw4 belongs here until a Socket has actually been returned. A failed
    // constructor leaves adoption uncertain, so its result is always UNKNOWN.
    const refuseRaw=unknown=>{
      try{fs.closeSync(4);}catch{unknown=true;}
      reject(unknown?probeCloseUnknownV1():probeOwnerRefusalV1());
    };
    let socket;
    try{
      const stat=fs.fstatSync(4);
      if(extraArguments||(!stat.isFIFO()&&!stat.isSocket())){refuseRaw(false);return;}
    }catch{refuseRaw(false);return;}
    try{socket=new net.Socket({fd:4,readable:true,writable:false});}
    catch{refuseRaw(true);return;}

    let eof=false,closeCount=0,destroyAttempted=false,unknown=false,frameFault=false;
    let timer=null,timerCleared=false,scheduled=false,total=0;
    const chunks=[];
    const clearOwnedTimer=()=>{
      if(timer!==null&&!timerCleared){
        timerCleared=true;
        try{clearTimeout(timer);}catch{unknown=true;}
      }
    };
    const requestClose=()=>{
      if(!destroyAttempted){
        destroyAttempted=true;
        try{socket.destroy();}catch{unknown=true;}
      }
    };
    const failUnknown=()=>{unknown=true;requestClose();};
    const closed=hadError=>{
      closeCount++;
      // An already known syntax/limit fault may refuse after our own destroy,
      // without inventing EOF. A fault-free close without EOF is UNKNOWN.
      if(closeCount!==1||hadError===true||(!eof&&!frameFault))unknown=true;
      clearOwnedTimer();
      if(!scheduled){
        scheduled=true;
        // A synchronous destroy->close->throw must finish recording uncertainty
        // before a positive can resolve. No close is invented by this microtask.
        queueMicrotask(()=>{
          if(unknown){reject(probeCloseUnknownV1());return;}
          if(frameFault){reject(probeFrameRefusalV1());return;}
          try{resolve(decodeManualOrphanProbeFrameV1(Buffer.concat(chunks,total)));}
          catch{reject(probeFrameRefusalV1());}
        });
      }
    };
    try{
      socket.on('error',()=>{failUnknown();});
      socket.on('end',()=>{
        if(eof||closeCount!==0)unknown=true;
        eof=true;requestClose();
      });
      socket.on('close',closed);
      socket.pause();
      socket.on('data',chunk=>{
        if(eof||closeCount!==0){failUnknown();return;}
        if(types.isProxy(chunk)||!Buffer.isBuffer(chunk)){frameFault=true;requestClose();return;}
        try{
          const size=Object.getOwnPropertyDescriptor(Object.getPrototypeOf(Uint8Array.prototype),'byteLength').get.call(chunk);
          if(size>16384-total){frameFault=true;requestClose();return;}
          if(size>0){total+=size;chunks.push(Buffer.from(chunk));}
        }catch{failUnknown();}
      });
      timer=setTimeout(()=>{failUnknown();},5000);
      socket.resume();
    }catch{failUnknown();}
  });
}

function probeSanitizedErrorV1(error,allowFrame=false){
  if(error?.message==='MANUAL_ORPHAN_CHILD_UNKNOWN')return probeCloseUnknownV1();
  if(allowFrame&&error?.message==='MANUAL_ORPHAN_FRAME_REFUSED')return probeFrameRefusalV1();
  return probeOwnerRefusalV1();
}

function probeLaunchContextV1(){
  const locators=probeSourceLocatorsV1(),root=path.resolve(path.dirname(locators.helper),'../../..');
  if(fs.realpathSync(locators.helper)!==locators.helper||fs.realpathSync(locators.issuer)!==locators.issuer
    ||fs.realpathSync(root)!==root)throw probeOwnerRefusalV1();
  const node=fs.realpathSync(process.execPath);
  if(!probeExecutableV1(node))throw probeOwnerRefusalV1();
  return {...locators,root,node};
}

function probeChildContextV1(context){
  if(process.execPath!==context.node||process.argv0!==context.node||!Array.isArray(process.execArgv)
    ||process.execArgv.length!==0||!Array.isArray(process.argv)||process.argv.length!==2
    ||process.argv[0]!==context.node||process.argv[1]!==context.helper||process.cwd()!==context.root){
    throw probeOwnerRefusalV1();
  }
  const expected={PATH:path.dirname(context.node)+':/usr/bin:/bin',LANG:'C',LC_ALL:'C'};
  const metadata='__CF_USER_TEXT_ENCODING',keys=Reflect.ownKeys(process.env);
  const hasMetadata=Object.hasOwn(process.env,metadata);
  if(keys.length!==(hasMetadata?4:3)||keys.some(key=>typeof key!=='string'
    ||(key!==metadata&&(!Object.hasOwn(expected,key)||process.env[key]!==expected[key])))){
    throw probeOwnerRefusalV1();
  }
  if(hasMetadata){
    const uid=process.getuid(),value=process.env[metadata];
    if(process.platform!=='darwin'||!Number.isSafeInteger(uid)||uid<0||uid>0xFFFFFFFF
      ||typeof value!=='string')throw probeOwnerRefusalV1();
    const fields=value.split(':');
    if(fields.length!==3||fields.some(field=>{
      const match=/^0x(?:0|[1-9A-F][0-9A-F]{0,7})$/.exec(field);
      return match===null||match[0]!==field;
    })||fields[0]!=='0x'+uid.toString(16).toUpperCase())throw probeOwnerRefusalV1();
  }
}

function sameProbePinV1(first,second){
  return ['pid','ppid','uid','pgid','startedAtUTC','executable','executableSha256','commandSha256']
    .every(key=>first[key]===second[key]);
}
function sameProbeObservationV1(first,second){
  return sameProbePinV1(first.pin,second.pin)&&first.rawCommand===second.rawCommand;
}
function probeObservedPairV1(context,parent,child,parentPid,childPid){
  if(parent.pin.pid!==parentPid||child.pin.pid!==childPid||child.pin.ppid!==parentPid
    ||parent.pin.uid!==process.getuid()||child.pin.uid!==parent.pin.uid
    ||parent.pin.executable!==context.node||child.pin.executable!==context.node
    ||parent.pin.executableSha256!==child.pin.executableSha256
    ||child.rawCommand!==context.node+' '+context.helper)throw probeOwnerRefusalV1();
}
function probeReceiptV1(digest,pid,parentPid){
  return {schema:'setfarm.manual-orphan-lifecycle-probe-result.v1',frameSha256:digest,
    pid,parentPid,fd4Closed:true,sourcePinsClosed:true};
}

function probeChildOutputV1(){
  let unknownWritten=false;
  const unknown=()=>{
    process.exitCode=1;
    if(!unknownWritten){
      unknownWritten=true;
      try{process.stderr.write('MANUAL_ORPHAN_CHILD_UNKNOWN\n');}catch{}
    }
  };
  // Native output errors must not become an unhandled raw diagnostic. These
  // listeners are installed only in the direct child, never at module import.
  if(typeof process.stderr.on==='function')process.stderr.on('error',()=>{process.exitCode=1;});
  if(typeof process.stdout.on==='function')process.stdout.on('error',unknown);
  return {unknown,writeFailure(error){
    process.exitCode=1;
    try{process.stderr.write(error.message+'\n');}catch{}
  }};
}

async function runManualOrphanProbeChildV1(){
  let source=null,readerStarted=false,receipt=null,failure=null;
  const output=probeChildOutputV1();
  try{
    const context=probeLaunchContextV1();probeChildContextV1(context);
    readerStarted=true;
    const frame=await readManualOrphanProbeFd4V1();
    probeChildContextV1(context);
    source=pinManualOrphanProbeSourcesV1();
    const parent=observeManualOrphanProcessV1(process.ppid),self=observeManualOrphanProcessV1(process.pid);
    probeObservedPairV1(context,parent,self,process.ppid,process.pid);
    if(!sameProbePinV1(frame.parent,parent.pin)||!sameProbePinV1(frame.child,self.pin)
      ||frame.child.ppid!==frame.parent.pid||frame.parent.pid!==process.ppid
      ||source.hashes.helperSha256!==frame.source.helperSha256
      ||source.hashes.issuerTestSha256!==frame.source.issuerTestSha256)throw probeOwnerRefusalV1();
    const digest=createHash('sha256').update(encodeManualOrphanProbeFrameV1(frame)).digest('hex');
    source.check();
    if(!sameProbeObservationV1(parent,observeManualOrphanProcessV1(process.ppid))
      ||!sameProbeObservationV1(self,observeManualOrphanProcessV1(process.pid)))throw probeOwnerRefusalV1();
    probeChildContextV1(context);source.check();
    receipt=probeReceiptV1(digest,process.pid,process.ppid);
  }catch(error){failure=probeSanitizedErrorV1(error,true);}
  finally{
    if(!readerStarted){
      // A launch-guard refusal still closes only this child's inherited4 once.
      try{fs.closeSync(4);}catch{failure=probeCloseUnknownV1();}
    }
    if(source){try{source.close();}catch{failure=probeCloseUnknownV1();}}
  }
  if(failure){output.writeFailure(failure);return;}
  process.exitCode=0;
  try{process.stdout.write(JSON.stringify(receipt)+'\n');}catch{output.unknown();}
}

function probeCurrentPendingV1(witness){
  try{
    const current=witness.snapshot();
    if(current.state!=='pending'||current.exit!==null||current.close!==null)throw probeCloseUnknownV1();
  }catch{throw probeCloseUnknownV1();}
}
function probeCurrentObservedV1(witness){
  try{
    const current=witness.snapshot();
    if(current.state!=='observed')throw probeCloseUnknownV1();
    return current;
  }catch{throw probeCloseUnknownV1();}
}
function probeUnknownRefusalV1(witness,current){
  return current.exit?.code===1&&witness.output().stderr.equals(Buffer.from('MANUAL_ORPHAN_CHILD_UNKNOWN\n'));
}
function probeIssuedReceiptV1(witness,current,expected){
  const output=witness.output(),bytes=Buffer.from(JSON.stringify(expected)+'\n');
  if(probeUnknownRefusalV1(witness,current))throw probeCloseUnknownV1();
  if(current.exit?.code!==0||current.exit.signal!==null||current.close?.code!==0||current.close.signal!==null
    ||!current.fd4.finish||!current.fd4.end||!current.fd4.close
    ||!current.stdout.end||!current.stdout.close||!current.stderr.end||!current.stderr.close
    ||current.stdout.bytes!==bytes.length||current.stderr.bytes!==0
    ||!output.stdout.equals(bytes)||output.stderr.length!==0)throw probeOwnerRefusalV1();
}

export async function runManualOrphanLifecycleProbeV1(){
  let source=null,child=null,witness=null,writer=null,endAttempted=false,receipt=null,failure=null;
  const endOwnedWriter=bytes=>{
    if(!endAttempted){
      endAttempted=true;
      try{
        if(writer===null)writer=child.stdio[4];
        writer.end(bytes);
      }catch{throw probeCloseUnknownV1();}
    }
  };
  try{
    if(arguments.length!==0)throw probeOwnerRefusalV1();
    const context=probeLaunchContextV1();
    if(!Array.isArray(process.argv)||process.argv.length!==2||typeof process.argv[1]!=='string'
      ||path.resolve(process.argv[1])!==context.issuer)throw probeOwnerRefusalV1();
    source=pinManualOrphanProbeSourcesV1();
    const parent=observeManualOrphanProcessV1(process.pid);
    if(parent.pin.pid!==process.pid||parent.pin.uid!==process.getuid()||parent.pin.executable!==context.node){
      throw probeOwnerRefusalV1();
    }
    child=spawn(context.node,[context.helper],{cwd:context.root,argv0:context.node,shell:false,detached:false,
      env:{PATH:path.dirname(context.node)+':/usr/bin:/bin',LANG:'C',LC_ALL:'C'},
      stdio:['ignore','pipe','pipe','ignore','pipe']});
    witness=observeManualOrphanOriginalChildV1(child);
    writer=child.stdio[4];probeCurrentPendingV1(witness);
    const childObservation=observeManualOrphanProcessV1(child.pid);
    probeObservedPairV1(context,parent,childObservation,process.pid,child.pid);
    const frame={schema:'setfarm.manual-orphan-lifecycle-probe.v1',nonce:randomBytes(32).toString('hex'),
      parent:parent.pin,child:childObservation.pin,
      source:{helperSha256:source.hashes.helperSha256,issuerTestSha256:source.hashes.issuerTestSha256}};
    const issued=encodeManualOrphanProbeFrameV1(frame);
    receipt=probeReceiptV1(createHash('sha256').update(issued).digest('hex'),child.pid,process.pid);
    source.check();
    if(!sameProbeObservationV1(parent,observeManualOrphanProcessV1(process.pid))
      ||!sameProbeObservationV1(childObservation,observeManualOrphanProcessV1(child.pid)))throw probeOwnerRefusalV1();
    probeCurrentPendingV1(witness);endOwnedWriter(issued);
    await witness.settled;
    let current=probeCurrentObservedV1(witness);
    source.check();current=probeCurrentObservedV1(witness);
    probeIssuedReceiptV1(witness,current,receipt);
  }catch(error){
    failure=probeSanitizedErrorV1(error);
    if(child!==null){
      try{endOwnedWriter();}catch{failure=probeCloseUnknownV1();}
      if(witness!==null){
        try{
          await witness.settled;
          const current=probeCurrentObservedV1(witness);
          if(probeUnknownRefusalV1(witness,current))failure=probeCloseUnknownV1();
          if(source)source.check();
          probeCurrentObservedV1(witness);
        }catch(errorAfterJoin){
          const joinedFailure=probeSanitizedErrorV1(errorAfterJoin);
          if(joinedFailure.message==='MANUAL_ORPHAN_CHILD_UNKNOWN')failure=joinedFailure;
        }
      }else failure=probeCloseUnknownV1();
    }
  }finally{
    if(child!==null){
      try{probeCurrentObservedV1(witness);}catch{failure=probeCloseUnknownV1();}
    }
    if(source){try{source.close();}catch{failure=probeCloseUnknownV1();}}
    if(child!==null){
      try{probeCurrentObservedV1(witness);}catch{failure=probeCloseUnknownV1();}
    }
  }
  if(failure)throw probeSanitizedErrorV1(failure);
  probeCurrentObservedV1(witness);
  return Object.freeze(receipt);
}

if(import.meta.main)void runManualOrphanProbeChildV1().catch(()=>{process.stderr.write('MANUAL_ORPHAN_CHILD_UNKNOWN\n');process.exitCode=1;});
