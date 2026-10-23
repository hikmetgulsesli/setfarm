import * as fs from 'node:fs';
import {spawn,spawnSync} from 'node:child_process';
import {createHash,randomBytes} from 'node:crypto';
import * as net from 'node:net';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {TextDecoder,types} from 'node:util';
import {userInfo} from 'node:os';

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
    'schema','run','constructor','runner','server','source','cluster','constructorAdminBackend','adminPassword',
  ]);
  ownedRequireV1(data.schema==='setfarm.manual-orphan-runner-setup.v1'&&probeHexV1(data.adminPassword));
  ownedGraphV1(data);
  const backend=probeOwnDataV1(data.constructorAdminBackend,['pid','backendStartedAtUTC']);
  ownedRequireV1(ownedIntegerV1(backend.pid,1)&&ownedMicrosecondTimestampV1(backend.backendStartedAtUTC)
    &&backend.backendStartedAtUTC.slice(0,4)!=='0000');
  data.constructorAdminBackend=backend;return data;
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
// Pure original/restored catalog DATA only; no session, Source or owner authority.
function ownedBaselineRowsV1(value,minimum,maximum){
  ownedRequireV1(value!==null&&typeof value==='object'&&!types.isProxy(value)
    &&Array.isArray(value)&&Object.getPrototypeOf(value)===Array.prototype);
  // Bound the actual own length before enumerating keys or inspecting indexes.
  const length=Object.getOwnPropertyDescriptor(value,'length');
  ownedRequireV1(length&&Object.hasOwn(length,'value')&&length.enumerable===false
    &&length.configurable===false&&ownedIntegerV1(length.value,minimum,maximum));
  ownedRequireV1(Reflect.ownKeys(value).length===length.value+1);
  const rows=[];
  for(let index=0;index<length.value;index++){
    const descriptor=Object.getOwnPropertyDescriptor(value,String(index));
    ownedRequireV1(descriptor&&descriptor.enumerable&&Object.hasOwn(descriptor,'value'));
    rows.push(descriptor.value);
  }
  return rows;
}
function ownedBaselineNameV1(value){
  return typeof value==='string'&&value.length>=1&&value.length<=63&&!value.includes('\0')
    &&Buffer.byteLength(value,'utf8')<=63&&Buffer.from(value,'utf8').toString('utf8')===value;
}
export function canonicalizeManualOrphanClusterBaselineV1(value){
  try{
    ownedRequireV1(arguments.length===1);
    const input=probeOwnDataV1(value,['databases','roles','memberships']);
    const databases=ownedBaselineRowsV1(input.databases,3,3).map(row=>{
      const data=probeOwnDataV1(row,['name','oid','ownerOid','allowConnections','connectionLimit']);
      ownedRequireV1((data.name==='postgres'||data.name==='template0'||data.name==='template1')
        &&ownedIntegerV1(data.oid,1,4294967295)&&ownedIntegerV1(data.ownerOid,1,4294967295)
        &&typeof data.allowConnections==='boolean'&&ownedIntegerV1(data.connectionLimit,-1));
      return data;
    });
    const roles=ownedBaselineRowsV1(input.roles,1,128).map(row=>{
      const data=probeOwnDataV1(row,[
        'name','oid','superuser','inherit','createRole','createDb','login','replication','bypassRls',
        'connectionLimit','validUntilUTC',
      ]);
      ownedRequireV1(ownedBaselineNameV1(data.name)&&ownedIntegerV1(data.oid,1,4294967295)
        &&['superuser','inherit','createRole','createDb','login','replication','bypassRls']
          .every(key=>typeof data[key]==='boolean')
        &&ownedIntegerV1(data.connectionLimit,-1)
        &&(data.validUntilUTC===null||data.validUntilUTC==='infinity'||data.validUntilUTC==='-infinity'
          ||(ownedMicrosecondTimestampV1(data.validUntilUTC)&&data.validUntilUTC.slice(0,4)!=='0000')));
      return data;
    });
    const memberships=ownedBaselineRowsV1(input.memberships,0,256).map(row=>{
      const data=probeOwnDataV1(row,['roleOid','memberOid','grantorOid','adminOption','inheritOption','setOption']);
      ownedRequireV1(ownedIntegerV1(data.roleOid,1,4294967295)&&ownedIntegerV1(data.memberOid,1,4294967295)
        &&ownedIntegerV1(data.grantorOid,1,4294967295)&&data.roleOid!==data.memberOid
        &&typeof data.adminOption==='boolean'&&typeof data.inheritOption==='boolean'&&typeof data.setOption==='boolean');
      return data;
    });
    const roleNames=new Set(),roleOids=new Set();
    for(const row of roles){
      ownedRequireV1(!roleNames.has(row.name)&&!roleOids.has(row.oid));
      roleNames.add(row.name);roleOids.add(row.oid);
    }
    const databaseNames=new Set(),databaseOids=new Set();
    for(const row of databases){
      ownedRequireV1(!databaseNames.has(row.name)&&!databaseOids.has(row.oid)&&roleOids.has(row.ownerOid));
      databaseNames.add(row.name);databaseOids.add(row.oid);
    }
    const membershipTriples=new Set();
    for(const row of memberships){
      const triple=row.roleOid+','+row.memberOid+','+row.grantorOid;
      ownedRequireV1(roleOids.has(row.roleOid)&&roleOids.has(row.memberOid)&&roleOids.has(row.grantorOid)
        &&!membershipTriples.has(triple));
      membershipTriples.add(triple);
    }
    const byNameOid=(left,right)=>Buffer.compare(Buffer.from(left.name,'utf8'),Buffer.from(right.name,'utf8'))
      ||left.oid-right.oid;
    databases.sort(byNameOid);roles.sort(byNameOid);
    memberships.sort((left,right)=>left.roleOid-right.roleOid||left.memberOid-right.memberOid||left.grantorOid-right.grantorOid);
    const databaseText=JSON.stringify(databases),roleText=JSON.stringify(roles),membershipText=JSON.stringify(memberships);
    const canonicalBytes=Buffer.byteLength(databaseText,'utf8')+Buffer.byteLength(roleText,'utf8')
      +Buffer.byteLength(membershipText,'utf8');
    ownedRequireV1(ownedIntegerV1(canonicalBytes,0,65536));
    const databaseBaselineSha256=createHash('sha256').update(databaseText,'utf8').digest('hex');
    const roleBaselineSha256=createHash('sha256').update(roleText,'utf8').digest('hex');
    const membershipBaselineSha256=createHash('sha256').update(membershipText,'utf8').digest('hex');
    ownedRequireV1(probeHexV1(databaseBaselineSha256)&&probeHexV1(roleBaselineSha256)&&probeHexV1(membershipBaselineSha256));
    return freezeOwnedDataV1({
      databases,roles,memberships,canonicalBytes,databaseBaselineSha256,roleBaselineSha256,membershipBaselineSha256,
    });
  }catch{throw probeFrameRefusalV1();}
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

// Fixed Source custody only. No frame, environment selection, private record,
// database or production-bootstrap adapter participates in this owner.
const ownedNodeV1='/opt/homebrew/Cellar/node/26.4.0/bin/node';
const ownedNodeHashV1='59cd4fb59cf5bc239f43d5db8c0cd8c23c22db79419612b92da3b7cf34de8553';
const ownedRetentionV1='scripts/build-generation-retention.mjs';
// Independently reviewed builtin-only initialization closure, including its
// guarded CLI entry. A new retention program requires a new Source review.
const ownedRetentionHashV1='b2e03e4b08142af562330a651b45ee1b9f79a19025c2a39c356cf73e5a08c097';
const ownedProfileV1='src/installation/manual-orphan-target-dependencies-v1.json';
const ownedProfileHashV1='77005216e1fbc83baa7e23c24517c3850e99463754dad42c5559c5ae08f2c64f';
const ownedComparisonLocatorsV1=Object.freeze([
  'scripts/run-private-postgres-tests.mjs','scripts/__tests__/private-postgres-test-cluster.test.js',
  'scripts/run-execution-attempt-tests.ts','scripts/run-isolated-postgres-tests.ts',
  'tests/execution-attempts/helpers/manual-control-orphan-bootstrap-child-v1.mjs',
  'scripts/__tests__/manual-orphan-bootstrap-owned-route-v1.test.js',
  'tests/execution-attempts/helpers/manual-control-orphan-bootstrap-fixture-v1.ts',
  'tests/execution-attempts/manual-control-orphan-bootstrap-v1.integration.test.ts',
  'scripts/private-postgres-test-journal-v1.mjs','scripts/finding-test-preflight.mjs',ownedProfileV1,
]);
const ownedMetadataV1=Object.freeze(['BUILD_INFO.json','PLATFORM_BUILD_OUTPUT_TREE.json','PLATFORM_RELEASE_MANIFEST.json']);
const ownedObserverV1='dist/internal-production/baseline-post-handoff-receipt-v1.js';
const ownedWorkspaceApiV1='dist/internal-production/baseline-workspace-authority-path-v1.js';
const ownedNormalizerV1='dist/internal-production/baseline-spawner-launch-environment-v1.js';
const ownedOrdinaryRootsV1=Object.freeze([
  'dist/installation/fresh-installation-entry-v1.js','dist/db-pg.js','dist/db/contract-spine-migrations.js',
  ownedObserverV1,'dist/cli/runtime-guard.js','dist/installation/fresh-installation-v1.js',
  'dist/installation/fresh-installation-activation-verifier-v1.js',
]);
const ownedSetupRootsV1=Object.freeze([
  ...ownedOrdinaryRootsV1,'dist/installation/fresh-installation-activation-v1.js',
  'dist/installation/fresh-installation-provenance-v1.js',
  'dist/installation/fresh-installation-mission-control-schema-v1.js',
  'dist/installation/fresh-installation-runtime-grants-v1.js',
  'dist/installation/fresh-installation-artifact-bootstrap-v1.js',
]);
const ownedOrdinaryDeltaV1=Object.freeze([
  'dist/cli/runtime-guard.js','dist/contracts/operational-active-run-status-v1.js','dist/db-pg.js',
  'dist/db/dashboard-core-readonly-profile-v2.js','dist/db/dashboard-core-response-v2.js',
  'dist/execution/process-identity.js','dist/execution/v3-seal-capacity.js','dist/findings/finding-publication-v1.js',
  'dist/installation/fresh-installation-activation-verifier-v1.js','dist/installation/fresh-installation-artifact-policy-v1.js',
  'dist/installation/fresh-installation-entry-v1.js','dist/installation/fresh-installation-owner-source-v1.js',
  'dist/installation/fresh-installation-selection-v1.js',
  'dist/internal-production/baseline-deployment-cutover-records-v1.js',
  'dist/internal-production/baseline-deployment-cutover-v1.js',
  'dist/internal-production/baseline-positive-worktree-active-binding-snapshot-v1.js',
  'dist/internal-production/baseline-positive-worktree-active-row-snapshot-v2.js',
  'dist/internal-production/baseline-positive-worktree-binding-rows-v1.js',
  'dist/internal-production/baseline-restart-authority-retirement-v1.js',
  'dist/internal-production/baseline-spawner-launch-environment-v1.js','dist/runtime-config.js',
  'dist/server/dashboard-core-projection-v2.js',
]);
const ownedSetupDeltaV1=Object.freeze([
  'dist/installation/fresh-installation-activation-v1.js','dist/installation/fresh-installation-artifact-bootstrap-v1.js',
  'dist/installation/fresh-installation-mission-control-schema-v1.js','dist/installation/fresh-installation-provenance-v1.js',
  'dist/installation/fresh-installation-runtime-grants-v1.js','dist/product-compiler/artifact-index.js',
  'dist/product-compiler/artifact-inventory-store.js','dist/product-compiler/artifact-store-authority.js',
  'dist/product-compiler/artifact-store.js','dist/product-compiler/indexed-artifact-publisher.js',
]);
const ownedGraphBuiltinsV1=new Set([
  'node:child_process','node:crypto','node:fs','node:fs/promises','node:http','node:os','node:path',
  'node:timers/promises','node:url','node:util','node:util/types',
]);
let ownedSourceCleanupUncertainV1=false;
function ownedSourceRefusalV1(){return Error(ownedSourceCleanupUncertainV1
  ?'MANUAL_ORPHAN_CLEANUP_UNKNOWN':'MANUAL_ORPHAN_OWNER_REFUSED');}
function ownedSourceRequireV1(value){if(!value)throw ownedSourceRefusalV1();}
function ownedSourceHashV1(value){return createHash('sha256').update(value).digest('hex');}
function ownedSourceLocatorV1(value){
  return typeof value==='string'&&Buffer.byteLength(value)<=1024&&!path.isAbsolute(value)
    &&path.posix.normalize(value)===value&&value.split('/').every(cell=>/^[A-Za-z0-9._-]+$/.test(cell)&&cell!=='.'&&cell!=='..');
}
function ownedSourceSameV1(a,b,file=false,tree=false){
  return ['dev','ino','uid','gid','mode','birthtimeNs',...(file?['nlink','size','mtimeNs','ctimeNs']:tree?['mtimeNs','ctimeNs']:[])]
    .every(key=>a[key]===b[key]);
}
function ownedSourceJsonV1(bytes){return JSON.parse(new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(bytes));}
function ownedSourceKeysV1(value,keys){
  ownedSourceRequireV1(value!==null&&typeof value==='object'&&!Array.isArray(value)
    &&JSON.stringify(Object.keys(value).sort())===JSON.stringify([...keys].sort()));
}
function ownedSourceAuditedCompiledV1(manifest,kind){
  try{
    ownedSourceRequireV1(!ownedSourceCleanupUncertainV1);
    // Independently reviewed M62 and fixed-T compiled bytes. Never refresh
    // these expectations from a current release or its metadata.
    const expected=kind==='maintenance'
      ?[143,'ec4d076a604601dff3618b4f7c54e8924d1d33b2b9177ac216aecce7e598a8de']
      :kind==='target'?[153,'ef3696ca8b4cfcd387eb3cc77000a13781fde1cb17da9550abe2b88ed7656d2b']:null;
    ownedSourceRequireV1(expected&&Array.isArray(manifest)&&manifest.length===expected[0]);
    const records=[];let previous;
    for(const entry of manifest){
      ownedSourceKeysV1(entry,['locator','sha256']);
      ownedSourceRequireV1(ownedSourceLocatorV1(entry.locator)&&entry.locator.startsWith('dist/')
        &&entry.locator.endsWith('.js')&&probeHexV1(entry.sha256));
      const locator=Buffer.from(entry.locator);
      ownedSourceRequireV1(previous===undefined||Buffer.compare(previous,locator)<0);previous=locator;
      records.push({locator:entry.locator,sha256:entry.sha256});
    }
    ownedSourceRequireV1(ownedSourceHashV1(JSON.stringify(records))===expected[1]);
  }catch{throw ownedSourceRefusalV1();}
}

function ownedSourceResourcesV1(){
  const resources=[];let closed=false;
  return {
    guard(){ownedSourceRequireV1(!closed&&!ownedSourceCleanupUncertainV1);},
    add(close){ownedSourceRequireV1(!closed);resources.push(close);},
    close(){
      if(!closed){
        closed=true;
        while(resources.length){const close=resources.pop();try{close();}catch{ownedSourceCleanupUncertainV1=true;}}
      }
      if(ownedSourceCleanupUncertainV1)throw ownedSourceRefusalV1();
    },
  };
}
function ownedSourcePinsV1(resources,home,sourceContext=()=>{}){
  const directories=new Map(),files=new Map(),absences=new Set();
  let custody=null,handoffStarted=false,invalid=false,reading=false,fixedUnit=null;
  const guard=()=>{resources.guard();ownedSourceRequireV1(!invalid);};
  // The handoff and reverse cleanup share this exact one-attempt closer.
  // Burn before the syscall: a thrown close may already have recycled the FD.
  const closer=fd=>{
    let attempted=false;
    return ()=>{
      if(attempted)return;attempted=true;
      try{fs.closeSync(fd);}catch{ownedSourceCleanupUncertainV1=true;throw ownedSourceRefusalV1();}
    };
  };
  const stockCheck=()=>{
    guard();ownedSourceRequireV1(custody&&(custody.state==='OVERLAP'||custody.state==='STOCK_HELD'));
    try{Reflect.apply(custody.check,custody.owner,[]);}catch{
      custody.state='UNKNOWN';ownedSourceCleanupUncertainV1=true;throw ownedSourceRefusalV1();
    }
  };
  const physical=locator=>ownedSourceRequireV1(fs.realpathSync(locator)===locator);
  const checkDirectory=pin=>{
    physical(pin.path);
    const named=fs.lstatSync(pin.path,{bigint:true}),held=fs.fstatSync(pin.fd,{bigint:true});
    ownedSourceRequireV1(named.isDirectory()&&!named.isSymbolicLink()&&held.isDirectory()&&!held.isSymbolicLink()
      &&ownedSourceSameV1(pin.stat,named,false,!!pin.members)&&ownedSourceSameV1(pin.stat,held,false,!!pin.members));
    if(pin.members)ownedSourceRequireV1(JSON.stringify(fs.readdirSync(pin.path).sort())===JSON.stringify(pin.members));
  };
  const directory=(locator,tree=false)=>{
    guard();ownedSourceRequireV1(path.isAbsolute(locator)&&path.normalize(locator)===locator);
    const cells=locator.split(path.sep).filter(Boolean);ownedSourceRequireV1(cells.length<=128);
    for(let index=0;index<=cells.length;index++){
      const current=path.join(path.parse(locator).root,...cells.slice(0,index));let pin=directories.get(current);
      if(!pin){
        physical(current);const stat=fs.lstatSync(current,{bigint:true});
        ownedSourceRequireV1(stat.isDirectory()&&!stat.isSymbolicLink()
          &&(!(current===home||current.startsWith(home+'/'))||(stat.uid===501n&&stat.gid===20n&&(stat.mode&0o022n)===0n)));
        const fd=fs.openSync(current,fs.constants.O_RDONLY|fs.constants.O_DIRECTORY|fs.constants.O_NOFOLLOW);
        resources.add(()=>fs.closeSync(fd));pin={path:current,fd,stat,members:null};directories.set(current,pin);
      }
      checkDirectory(pin);
      if(current===locator&&tree&&!pin.members){
        const names=fs.readdirSync(current).sort();ownedSourceRequireV1(names.length<=10000);
        pin.members=names;checkDirectory(pin);
      }
    }
    return directories.get(locator).stat;
  };
  const collect=pin=>{
    const buffer=Buffer.alloc(Number(pin.stat.size));
    return {buffer,destination:position=>position,accept:()=>{},eof:()=>Buffer.alloc(1),
      digest:()=>ownedSourceHashV1(buffer),result:buffer};
  };
  // Both private consumers share the physical, metadata, positional-read and
  // digest-acceptance algorithm. Only ordinary byte callers establish a hash.
  const read=(pin,fd,consumer)=>{
    guard();physical(pin.path);
    const metadata=()=>{
      const named=fs.lstatSync(pin.path,{bigint:true}),held=fs.fstatSync(fd,{bigint:true});
      ownedSourceRequireV1(named.isFile()&&!named.isSymbolicLink()&&held.isFile()&&!held.isSymbolicLink()
        &&ownedSourceSameV1(pin.stat,named,true)&&ownedSourceSameV1(pin.stat,held,true));
    };
    metadata();const sink=consumer(pin),size=Number(pin.stat.size);let offset=0;
    while(offset<size){
      const wanted=Math.min(65536,size-offset),n=fs.readSync(fd,sink.buffer,sink.destination(offset),wanted,offset);
      ownedSourceRequireV1(Number.isSafeInteger(n)&&n>0&&n<=wanted);sink.accept(n);offset+=n;
    }
    ownedSourceRequireV1(fs.readSync(fd,sink.eof(),0,1,offset)===0);metadata();
    const digest=sink.digest();
    if(pin.sha256!==undefined)ownedSourceRequireV1(digest===pin.sha256);
    else pin.sha256=digest;
    return sink.result;
  };
  const consume=(pin,consumer,stockChecked)=>{
    guard();
    if(pin.state==='H_HELD')return read(pin,pin.fd,consumer);
    ownedSourceRequireV1(pin.state==='STOCK_HELD'&&custody?.state==='STOCK_HELD'&&pin.sha256!==undefined);
    if(!stockChecked)stockCheck();
    ownedSourceRequireV1(!reading);reading=true;
    try{
      physical(pin.path);
      const fd=fs.openSync(pin.path,fs.constants.O_RDONLY|fs.constants.O_NOFOLLOW|fs.constants.O_NONBLOCK);
      const close=closer(fd);
      try{return read(pin,fd,consumer);}finally{close();}
    }catch{
      invalid=true;if(ownedSourceCleanupUncertainV1)custody.state='UNKNOWN';
      throw ownedSourceRefusalV1();
    }finally{reading=false;}
  };
  const bytes=(pin,stockChecked=false)=>consume(pin,collect,stockChecked);
  const file=(locator,cap=16777216,device,system=false)=>{
    guard();directory(path.dirname(locator));physical(locator);
    let pin=files.get(locator);
    if(!pin){
      const stat=fs.lstatSync(locator,{bigint:true}),systemGit=system&&locator==='/usr/bin/git';
      ownedSourceRequireV1(stat.isFile()&&!stat.isSymbolicLink()&&(systemGit?stat.nlink>=1n:stat.nlink===1n)
        &&(stat.mode&0o022n)===0n&&(stat.uid===501n||(system&&stat.uid===0n))
        &&(device===undefined||stat.dev===device)&&stat.size>=0n&&stat.size<=BigInt(cap));
      if(systemGit){
        ownedSourceRequireV1(stat.uid===0n&&(stat.mode&0o7777n)===0o755n&&stat.size>0n);
        for(const ancestor of ['/','/usr','/usr/bin']){
          const identity=directory(ancestor);ownedSourceRequireV1(identity.uid===0n&&(identity.mode&0o022n)===0n);
        }
      }
      const fd=fs.openSync(locator,fs.constants.O_RDONLY|fs.constants.O_NOFOLLOW|fs.constants.O_NONBLOCK);
      const close=closer(fd);resources.add(close);
      pin={path:locator,fd,stat,sha256:undefined,close,state:'H_HELD'};files.set(locator,pin);
    }
    ownedSourceRequireV1(pin.stat.size<=BigInt(cap)&&(device===undefined||pin.stat.dev===device));
    return {bytes:bytes(pin),stat:pin.stat,sha256:pin.sha256};
  };
  const absent=locator=>{
    guard();ownedSourceRequireV1(path.isAbsolute(locator)&&path.normalize(locator)===locator);
    const cells=locator.split(path.sep).filter(Boolean);ownedSourceRequireV1(cells.length<=128);let parent=path.parse(locator).root;
    directory(parent);
    for(let index=0;index<cells.length;index++){
      const current=path.join(parent,cells[index]);let stat;
      try{stat=fs.lstatSync(current,{bigint:true});}
      catch(error){
        if(error?.code!=='ENOENT')throw error;
        directory(parent,true);absences.add(current);return;
      }
      ownedSourceRequireV1(index<cells.length-1&&stat.isDirectory()&&!stat.isSymbolicLink());
      directory(current);parent=current;
    }
    throw ownedSourceRefusalV1();
  };
  const topology=()=>{
    for(const pin of directories.values())checkDirectory(pin);
    for(const locator of absences){
      try{fs.lstatSync(locator,{bigint:true});}catch(error){if(error?.code==='ENOENT')continue;throw error;}
      throw ownedSourceRefusalV1();
    }
  };
  const check=()=>{
    // Scratch is private to this synchronous pass and created only after the
    // first file's pre-read metadata gate. Each file has a fresh hash state.
    let scratch,eof;
    const verify=pin=>{
      ownedSourceRequireV1(pin.sha256!==undefined);
      if(scratch===undefined){scratch=Buffer.alloc(65536);eof=Buffer.alloc(1);}
      const hash=createHash('sha256');
      return {buffer:scratch,destination:()=>0,accept:n=>hash.update(scratch.subarray(0,n)),
        eof:()=>eof,digest:()=>hash.digest('hex'),result:undefined};
    };
    try{
      guard();if(custody?.state==='STOCK_HELD')stockCheck();
      topology();for(const pin of files.values())consume(pin,verify,true);
    }catch{invalid=true;throw ownedSourceRefusalV1();}
  };
  const handoffTargetOutput=(root,outputMap,retainedTarget)=>{
    guard();ownedSourceRequireV1(!handoffStarted);handoffStarted=true;let attempted=false;
    try{
      ownedSourceRequireV1(root===path.join(home,'ai','setrox','releases','setfarm-161297ff')
        &&retainedTarget!==null&&typeof retainedTarget==='object'&&typeof retainedTarget.check==='function'
        &&ownedSourceBuildDataV1(retainedTarget.expected).sha===ownedTargetShaV1);
      // Call the Map intrinsic: the only caller passes the already-audited
      // targetOutput; no caller-selected iterable can expand this batch.
      const entries=[...Map.prototype.entries.call(outputMap)],batch=[],selected=new Set();
      ownedSourceRequireV1(entries.length===911);
      for(const [locator,entry] of entries){
        ownedSourceKeysV1(entry,['locator','mode','byteLength','sha256']);
        ownedSourceRequireV1(ownedSourceLocatorV1(locator)&&locator.startsWith('dist/')&&entry.locator===locator);
        const absolute=path.join(root,locator),pin=files.get(absolute);
        ownedSourceRequireV1(pin&&pin.state==='H_HELD'&&pin.sha256!==undefined&&!selected.has(absolute)
          &&entry.byteLength===Number(pin.stat.size)&&entry.mode===Number(pin.stat.mode&0o7777n)&&entry.sha256===pin.sha256);
        selected.add(absolute);batch.push(pin);
      }
      for(const name of ownedMetadataV1){
        const absolute=path.join(root,'dist',name),pin=files.get(absolute);
        ownedSourceRequireV1(pin&&pin.state==='H_HELD'&&pin.sha256!==undefined&&!selected.has(absolute)
          &&(pin.stat.mode&0o7777n)===0o444n);
        selected.add(absolute);batch.push(pin);
      }
      ownedSourceRequireV1(batch.length===914);
      for(const locator of files.keys())if(locator.startsWith(root+'/dist/'))ownedSourceRequireV1(selected.has(locator));
      // Bind the SAME private retained wrapper and its complete stock recheck,
      // never a cached observation, replacement instance or borrowed descriptor.
      custody={owner:retainedTarget,check:retainedTarget.check,output:outputMap,state:'OVERLAP'};
      stockCheck();check(); // Complete held/named/content/topology batch BEFORE any close.
      for(const pin of batch){
        attempted=true;pin.state='HANDOFF_ATTEMPTED';
        try{pin.close();}catch{pin.state='UNKNOWN';custody.state='UNKNOWN';throw ownedSourceRefusalV1();}
        pin.state='STOCK_HELD';
      }
      custody.state='STOCK_HELD';stockCheck();
      topology();for(const pin of files.values())if(pin.state==='H_HELD')bytes(pin);
    }catch{
      invalid=true;
      // Failure after any retirement attempt leaves the custody transition unknown.
      if(attempted)ownedSourceCleanupUncertainV1=true;
      if(custody)custody.state=ownedSourceCleanupUncertainV1?'UNKNOWN':'INVALID';
      throw ownedSourceRefusalV1();
    }
  };
  // These three units are fixed, synchronous, and retain the SAME original T.
  // Ordinary file() always keeps its own stock proof; no mode flag changes it.
  const targetRead=(locator,output)=>{
    guard();ownedSourceRequireV1((fixedUnit==='setup'||fixedUnit==='observer')&&custody?.state==='STOCK_HELD'
      &&output===custody.output&&ownedSourceLocatorV1(locator)&&locator.startsWith('dist/')&&locator.endsWith('.js'));
    const root=path.join(home,'ai','setrox','releases','setfarm-161297ff'),absolute=path.join(root,locator);
    const entry=Map.prototype.get.call(output,locator),pin=files.get(absolute);
    ownedSourceRequireV1(entry&&pin&&pin.state==='STOCK_HELD'&&pin.stat.size<=33554432n);
    directory(path.dirname(absolute));const value=bytes(pin,true);
    ownedSourceRequireV1(value.length===entry.byteLength&&pin.sha256===entry.sha256&&Number(pin.stat.mode&0o7777n)===entry.mode);
    return value;
  };
  const targetSetupGraph=(output,groups)=>{
    let entered=false;
    try{
      guard();ownedSourceRequireV1(fixedUnit===null&&!reading&&custody?.state==='STOCK_HELD'&&output===custody.output);
      fixedUnit='setup';entered=true;stockCheck();topology();
      const graph=ownedSourceGraphV1(path.join(home,'ai','setrox','releases','setfarm-161297ff'),output,ownedSetupRootsV1,groups,
        locator=>targetRead(locator,output));
      ownedSourceRequireV1(graph.files.size===153&&graph.members.size===85);
      topology();stockCheck();guard();return graph;
    }catch{invalid=true;throw ownedSourceRefusalV1();}finally{if(entered)fixedUnit=null;}
  };
  const targetObserverGraph=(output,groups)=>{
    let entered=false;
    try{
      guard();ownedSourceRequireV1(fixedUnit===null&&!reading&&custody?.state==='STOCK_HELD'&&output===custody.output);
      fixedUnit='observer';entered=true;stockCheck();topology();
      const graph=ownedSourceGraphV1(path.join(home,'ai','setrox','releases','setfarm-161297ff'),output,[ownedObserverV1],groups,
        locator=>targetRead(locator,output));
      ownedSourceRequireV1(graph.files.size===121&&graph.members.size===79);
      topology();stockCheck();guard();return graph;
    }catch{invalid=true;throw ownedSourceRefusalV1();}finally{if(entered)fixedUnit=null;}
  };
  const targetMembership=groups=>{
    let entered=false;
    try{
      guard();ownedSourceRequireV1(fixedUnit===null&&!reading&&custody?.state==='STOCK_HELD'&&Array.isArray(groups));
      fixedUnit='membership';entered=true;stockCheck();topology();
      const root=path.join(home,'ai','setrox','releases','setfarm-161297ff'),device=directory(root).dev,memberships=new Set(),contexts=new Set();
      for(const {row,members} of groups){
        ownedSourceRequireV1(Array.isArray(row)&&row.length===4&&row[0]==='esm'&&ownedSourceLocatorV1(row[1])&&ownedSourceLocatorV1(row[3])
          &&Array.isArray(members)&&members.length>0&&members.includes(row[1]));
        const context=JSON.stringify([row[0],path.dirname(row[1]),row[2],row[3]]);ownedSourceRequireV1(!contexts.has(context));contexts.add(context);
        const original=directory(path.join(root,path.dirname(row[1])),true);
        for(const member of members){
          const key=member+':'+row[2];ownedSourceRequireV1(ownedSourceLocatorV1(member)&&member.startsWith('dist/')&&member.endsWith('.js')
            &&path.dirname(member)===path.dirname(row[1])&&!memberships.has(key));memberships.add(key);
          const locator=path.join(root,member),actual=directory(path.dirname(locator)),pin=files.get(locator);
          ownedSourceRequireV1(ownedSourceSameV1(original,actual)&&pin&&pin.state==='STOCK_HELD'&&pin.stat.size<=16777216n&&pin.stat.dev===device);
          bytes(pin,true);
        }
      }
      ownedSourceRequireV1(memberships.size===85);topology();stockCheck();guard();
    }catch{invalid=true;throw ownedSourceRefusalV1();}finally{if(entered)fixedUnit=null;}
  };
  const resolvePackages=(root,groups,accountHome,recheck)=>{
    let entered=false,localReading=false;
    try{
      guard();ownedSourceRequireV1(fixedUnit===null&&!reading&&custody?.state==='STOCK_HELD'&&accountHome===home
        &&path.dirname(root)===path.join(home,'ai','setrox','releases')&&/^setfarm-[a-f0-9]{8}$/.test(path.basename(root))
        &&Array.isArray(groups)&&typeof recheck==='function'&&typeof sourceContext==='function');
      fixedUnit='resolver';entered=true;
      const facade=Object.freeze({
        check(){
          try{
            guard();ownedSourceRequireV1(fixedUnit==='resolver'&&entered&&!localReading&&!reading);localReading=true;
            ownedSourceRequireV1(sourceContext()===undefined);topology();for(const pin of files.values())bytes(pin,true);
            ownedSourceRequireV1(sourceContext()===undefined);guard();
          }catch{invalid=true;throw ownedSourceRefusalV1();}finally{localReading=false;}
        },
        absent(locator){guard();ownedSourceRequireV1(fixedUnit==='resolver'&&entered&&!localReading&&!reading);absent(locator);},
      });
      // The only callee is the fixed builtin-only four-resolver body. Its two
      // full bookends remain ordinary H checks; the facade cannot escape here.
      const result=ownedSourceResolversV1(facade,root,groups,accountHome,recheck);
      ownedSourceRequireV1(result===undefined);guard();
    }catch{invalid=true;throw ownedSourceRefusalV1();}finally{if(entered){fixedUnit=null;entered=false;}}
  };
  return {directory,file,absent,check,handoffTargetOutput,targetSetupGraph,targetObserverGraph,targetMembership,resolvePackages};
}

// Read static edges as DATA. Mask strings/comments/regex first, so embedded
// dormant Node programs cannot be mistaken for this module's own declarations.
// Dynamic edges are separately represented by the fixed audited roots above;
// this is neither a JavaScript evaluator nor a recursive dynamic-import loader.
function ownedSourceImportsV1(bytes){
  const source=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(bytes),mask=Array(source.length).fill(' '),imports=[];
  let index=0,last='';
  const regexAfter=token=>!token||(token.length===1&&'([{:;,=!?&|+*%~<>^-'.includes(token))
    ||['return','throw','case','yield','await','void','typeof','delete','in','of','instanceof'].includes(token);
  const skipRegex=()=>{
    index++;let bracket=false,ended=false;
    while(index<source.length){
      const next=source[index++];if(next==='\\'){index++;continue;}
      if(next==='[')bracket=true;else if(next===']')bracket=false;
      else if(next==='/'&&!bracket){ended=true;break;}
      else if(next==='\n'||next==='\r')break;
    }
    ownedSourceRequireV1(ended);while(index<source.length&&/[a-z]/i.test(source[index]))index++;
  };
  const skipLiteral=()=>{
    const quote=source[index++];let ended=false;
    while(index<source.length){
      const next=source[index++];if(next==='\\'){index++;continue;}
      if(next===quote){ended=true;break;}
      if(quote==='`'&&next==='$'&&source[index]==='{'){index++;skipInterpolation();}
    }
    ownedSourceRequireV1(ended);
  };
  const skipInterpolation=()=>{
    let depth=1,previous='';
    while(index<source.length&&depth){
      const cell=source[index];if(/\s/.test(cell)){index++;continue;}
      if(source.startsWith('//',index)){const end=source.indexOf('\n',index+2);index=end<0?source.length:end;continue;}
      if(source.startsWith('/*',index)){const end=source.indexOf('*/',index+2);ownedSourceRequireV1(end>=0);index=end+2;continue;}
      if(cell==='"'||cell==="'"||cell==='`'){skipLiteral();previous='literal';continue;}
      if(cell==='/'&&regexAfter(previous)){skipRegex();previous='literal';continue;}
      if(/[A-Za-z0-9_$]/.test(cell)){
        const start=index;while(index<source.length&&/[A-Za-z0-9_$]/.test(source[index]))index++;
        previous=source.slice(start,index);continue;
      }
      if(cell==='{')depth++;else if(cell==='}')depth--;
      previous=cell;index++;
    }
    ownedSourceRequireV1(depth===0);
  };
  while(index<source.length){
    const start=index,cell=source[index];
    if(/\s/.test(cell)){mask[index]=cell;index++;continue;}
    if(source.startsWith('//',index)){const end=source.indexOf('\n',index+2);index=end<0?source.length:end;continue;}
    if(source.startsWith('/*',index)){const end=source.indexOf('*/',index+2);ownedSourceRequireV1(end>=0);index=end+2;continue;}
    if(cell==='"'||cell==="'"||cell==='`'){
      skipLiteral();last='literal';continue;
    }
    if(cell==='/'&&regexAfter(last)){skipRegex();last='literal';continue;}
    if(/[A-Za-z0-9_$]/.test(cell)){
      while(index<source.length&&/[A-Za-z0-9_$]/.test(source[index])){mask[index]=source[index];index++;}
      last=source.slice(start,index);continue;
    }
    mask[index]=cell;last=cell;index++;
  }
  const plain=mask.join('');
  for(const match of plain.matchAll(/\b(import|export)\b/g)){
    const at=match.index,kind=match[1],before=plain.slice(0,at).trimEnd().at(-1);
    if(before==='.'||before==='?')continue;
    const tail=plain.slice(at+kind.length),next=tail.trimStart()[0];
    if(kind==='import'&&(next==='('||next==='.'||next===':'))continue;
    if(kind==='export'&&next!=='{'&&next!=='*')continue;
    const end=plain.indexOf(';',at);ownedSourceRequireV1(end>=0);
    const statement=source.slice(at,end+1);
    if(kind==='export'&&!/\bfrom\s*["']/.test(statement))continue;
    const specifier=/^(?:import\s+(?:[\s\S]*?\s+from\s+)?|export\s+[\s\S]*?\s+from\s+)(["'])([^"'\\\r\n]+)\1\s*;$/.exec(statement);
    ownedSourceRequireV1(specifier);imports.push(specifier[2]);
  }
  return imports;
}

const ownedResolutionProgramV1=`import fs from 'node:fs';import {createRequire} from 'node:module';import {pathToFileURL,fileURLToPath} from 'node:url';
const input=JSON.parse(fs.readFileSync(0,'utf8'));
process.stdout.write(JSON.stringify(input.edges.map(([mode,parent,specifier])=>{
const url=pathToFileURL(parent),require=createRequire(url);
return input.phase==='paths'?require.resolve.paths(specifier):fileURLToPath(import.meta.resolve(specifier,url.href));
})));`;

function ownedSourceBuildDataV1(value){
  ownedSourceRequireV1(value!==null&&typeof value==='object'
    &&ownedGitShaV1(value.sha)&&ownedGitShaV1(value.treeHash)&&probeHexV1(value.buildHash));
  return Object.freeze({sha:value.sha,treeHash:value.treeHash,buildHash:value.buildHash});
}
function ownedSourceEqualBuildV1(actual,expected){
  const value=ownedSourceBuildDataV1(actual);
  return value.sha===expected.sha&&value.treeHash===expected.treeHash&&value.buildHash===expected.buildHash;
}
function ownedSourceSetEqualV1(actual,expected){
  return JSON.stringify([...actual].sort())===JSON.stringify([...expected].sort());
}
function ownedSourceValidateProfileV1(profile){
  ownedSourceKeysV1(profile,['schema','platform','arch','target','provenance','packages','targetResolution','targetAbsences','maintenanceObserver']);
  ownedSourceRequireV1(profile.schema==='setfarm.manual-orphan-target-dependencies.v1'&&profile.platform==='darwin'&&profile.arch==='arm64'
    &&profile.target.sourceSha===ownedTargetShaV1&&ownedGitShaV1(profile.target.sourceTreeHash)
    &&probeHexV1(profile.target.outputTreeHash)&&probeHexV1(profile.target.lockSha256));
  ownedSourceKeysV1(profile.target.metadata,ownedMetadataV1);
  for(const value of Object.values(profile.target.metadata))ownedSourceRequireV1(probeHexV1(value));
  ownedSourceRequireV1(profile.provenance.inventoryReceiptSha256==='8fc7961c767c849bafe1a38d067e5667e3e335264dd64f5249bd78e552b733ed'
    &&profile.provenance.archiveEqualityReceiptSha256==='b69b87d869068416b2ec7d31c15a474e69c10eb92a4831801c2dd510446f4065'
    &&Array.isArray(profile.packages)&&profile.packages.length===3&&profile.packages.length<=16);
  for(const [index,name,version,count,total] of [[0,'postgres','3.4.8',37,299870],[1,'zod','4.4.3',718,4558122],[2,'yaml','2.9.0',233,685953]]){
    const entry=profile.packages[index];
    ownedSourceKeysV1(entry,['locator','name','version','lockIntegrity','inventoryHash','fileCount','byteLength']);
    ownedSourceRequireV1(entry.name===name&&entry.version===version&&entry.locator==='node_modules/'+name
      &&entry.fileCount===count&&entry.byteLength===total&&probeHexV1(entry.inventoryHash)
      &&typeof entry.lockIntegrity==='string'&&entry.lockIntegrity.startsWith('sha512-'));
  }
  ownedSourceRequireV1(Array.isArray(profile.targetResolution)&&profile.targetResolution.length===14
    &&profile.targetResolution.reduce((sum,group)=>sum+group.members.length,0)===82
    &&Array.isArray(profile.targetAbsences)&&profile.targetAbsences.length===29&&new Set(profile.targetAbsences).size===29
    &&Array.isArray(profile.maintenanceObserver.resolution)&&profile.maintenanceObserver.resolution.length===12
    &&profile.maintenanceObserver.resolution.reduce((sum,group)=>sum+group.members.length,0)===79
    &&Array.isArray(profile.maintenanceObserver.absences)&&profile.maintenanceObserver.absences.length===27
    &&Array.isArray(profile.maintenanceObserver.sourceClosure)&&profile.maintenanceObserver.sourceClosure.length===121);
  const sourceLocators=new Set();
  for(const entry of profile.maintenanceObserver.sourceClosure){
    ownedSourceRequireV1(ownedSourceLocatorV1(entry.locator)&&entry.locator.startsWith('src/')&&entry.locator.endsWith('.ts')
      &&probeHexV1(entry.sha256)&&!sourceLocators.has(entry.locator));sourceLocators.add(entry.locator);
  }
  for(const locator of profile.targetAbsences)ownedSourceRequireV1(ownedSourceLocatorV1(locator));
}
function ownedSourceOutputV1(pins,root,expected,full,profile){
  const device=pins.directory(root).dev,metadata=new Map();
  for(const name of ownedMetadataV1){
    const pin=pins.file(path.join(root,'dist',name),4194304,device);
    ownedSourceRequireV1((pin.stat.mode&0o7777n)===0o444n);
    if(full)ownedSourceRequireV1(pin.sha256===profile.target.metadata[name]);
    metadata.set(name,pin.bytes);
  }
  const info=ownedSourceJsonV1(metadata.get('BUILD_INFO.json')),output=ownedSourceJsonV1(metadata.get('PLATFORM_BUILD_OUTPUT_TREE.json'));
  const manifest=ownedSourceJsonV1(metadata.get('PLATFORM_RELEASE_MANIFEST.json'));
  ownedSourceRequireV1(info.sha===expected.sha&&info.shortSha===expected.sha.slice(0,8)&&info.branch==='main'&&info.dirty===false
    &&manifest.releaseSha===expected.sha&&manifest.branch==='main'&&manifest.dirty===false
    &&output.schema==='setfarm.platform-build-output-tree.v1'&&output.sourceSha===expected.sha&&output.sourceTreeHash===expected.treeHash
    &&probeHexV1(output.outputTreeHash)&&Array.isArray(output.entries)&&output.entries.length>=3&&output.entries.length<=10000);
  if(full)ownedSourceRequireV1(output.outputTreeHash===profile.target.outputTreeHash);
  const entries=new Map(),folded=new Set();let total=0;
  for(const entry of output.entries){
    ownedSourceKeysV1(entry,['locator','mode','byteLength','sha256']);
    ownedSourceRequireV1(ownedSourceLocatorV1(entry.locator)&&entry.locator.startsWith('dist/')
      &&!entries.has(entry.locator)&&!folded.has(entry.locator.normalize('NFC').toLocaleLowerCase('en-US'))
      &&entry.mode===(entry.locator==='dist/cli/cli.js'?0o755:0o644)
      &&Number.isSafeInteger(entry.byteLength)&&entry.byteLength>=0&&entry.byteLength<=33554432&&probeHexV1(entry.sha256));
    total+=entry.byteLength;ownedSourceRequireV1(total<=536870912);
    folded.add(entry.locator.normalize('NFC').toLocaleLowerCase('en-US'));entries.set(entry.locator,entry);
    if(full){
      const pin=pins.file(path.join(root,entry.locator),33554432,device);
      ownedSourceRequireV1(pin.bytes.length===entry.byteLength&&pin.sha256===entry.sha256&&Number(pin.stat.mode&0o7777n)===entry.mode);
    }
  }
  ownedSourceRequireV1(JSON.stringify([...entries.keys()])===JSON.stringify([...entries.keys()].sort((a,b)=>Buffer.compare(Buffer.from(a),Buffer.from(b)))));
  if(full){
    const expectedFiles=new Set([...entries.keys(),...ownedMetadataV1.map(name=>'dist/'+name)]),actual=new Set();
    const expectedDirectories=new Set(['dist']),actualDirectories=new Set();let visited=0;
    for(const locator of expectedFiles){
      for(let parent=path.posix.dirname(locator);parent!=='.';parent=path.posix.dirname(parent))expectedDirectories.add(parent);
    }
    const walk=(locator,depth)=>{
      ownedSourceRequireV1(depth<=64);const directory=path.join(root,locator),stat=pins.directory(directory,true);
      ownedSourceRequireV1(stat.dev===device&&(stat.mode&0o7777n)===0o755n);
      ownedSourceRequireV1(expectedDirectories.has(locator));actualDirectories.add(locator);
      for(const name of fs.readdirSync(directory)){
        ownedSourceRequireV1(++visited<=10000&&/^[A-Za-z0-9._-]+$/.test(name)&&name!=='.'&&name!=='..');
        const relative=locator+'/'+name,target=path.join(root,relative),child=fs.lstatSync(target,{bigint:true});
        ownedSourceRequireV1(!child.isSymbolicLink());
        if(child.isDirectory())walk(relative,depth+1);
        else{ownedSourceRequireV1(child.isFile()&&expectedFiles.has(relative));actual.add(relative);}
      }
    };
    walk('dist',0);ownedSourceRequireV1(ownedSourceSetEqualV1(actual,expectedFiles)
      &&ownedSourceSetEqualV1(actualDirectories,expectedDirectories));
  }
  return entries;
}
function ownedSourceGraphV1(root,output,roots,groups,read){
  const files=new Set(),members=new Set(),todo=[...roots],expected=new Set();
  for(const group of groups)for(const locator of group.members){
    const key=locator+':'+group.row[2];ownedSourceRequireV1(!expected.has(key));expected.add(key);
  }
  while(todo.length){
    const locator=todo.pop();if(files.has(locator))continue;
    ownedSourceRequireV1(ownedSourceLocatorV1(locator)&&locator.startsWith('dist/')&&locator.endsWith('.js')&&output.has(locator));
    files.add(locator);ownedSourceRequireV1(files.size<=10000);
    for(const specifier of ownedSourceImportsV1(read(locator))){
      if(specifier.startsWith('node:')){ownedSourceRequireV1(ownedGraphBuiltinsV1.has(specifier));continue;}
      if(specifier.startsWith('./')||specifier.startsWith('../')){
        const child=path.posix.normalize(path.posix.join(path.posix.dirname(locator),specifier));
        ownedSourceRequireV1(ownedSourceLocatorV1(child)&&child.startsWith('dist/')&&child.endsWith('.js'));todo.push(child);
      }else{
        const key=locator+':'+specifier;ownedSourceRequireV1(expected.has(key)&&!members.has(key));members.add(key);
      }
    }
  }
  ownedSourceRequireV1(ownedSourceSetEqualV1(members,expected));return {files,members};
}
function ownedSourcePackagesV1(pins,root,profile,groups,absences,home,recheck){
  const device=pins.directory(root).dev,lock=ownedSourceJsonV1(pins.file(path.join(root,'package-lock.json'),16777216,device).bytes);
  pins.file(path.join(root,'package.json'),1048576,device);
  ownedSourceRequireV1(profile.packages.length>0&&profile.packages.length<=16&&groups.length>0&&groups.length<=64);
  let total=0,visited=0;const seen=new Set(),authenticated=new Set();
  for(const entry of profile.packages){
    ownedSourceRequireV1(/^node_modules\/[a-z][a-z0-9-]*$/.test(entry.locator)&&!seen.has(entry.locator)
      &&entry.locator==='node_modules/'+entry.name&&Number.isSafeInteger(entry.fileCount)&&entry.fileCount>0&&entry.fileCount<=2048
      &&lock.packages?.[entry.locator]?.version===entry.version&&lock.packages?.[entry.locator]?.integrity===entry.lockIntegrity);
    seen.add(entry.locator);const inventory=[],actualDirectories=new Set();
    const walk=(directory,relative,depth)=>{
      ownedSourceRequireV1(depth<=32&&pins.directory(directory,true).dev===device);
      actualDirectories.add(relative);
      const names=fs.readdirSync(directory).sort();ownedSourceRequireV1(names.length<=2048);
      for(const name of names){
        ownedSourceRequireV1(++visited<=8192&&/^[A-Za-z0-9._-]+$/.test(name)&&name!=='.'&&name!=='..'&&name!=='node_modules');
        const filename=path.join(directory,name),member=relative?relative+'/'+name:name,stat=fs.lstatSync(filename,{bigint:true});
        ownedSourceRequireV1(!stat.isSymbolicLink());
        if(stat.isDirectory())walk(filename,member,depth+1);
        else{
          const pin=pins.file(filename,16777216,device);total+=pin.bytes.length;ownedSourceRequireV1(total<=67108864);
          inventory.push({locator:member,byteLength:pin.bytes.length,sha256:pin.sha256});
          authenticated.add(entry.locator+'/'+member);ownedSourceRequireV1(inventory.length<=2048);
        }
      }
    };
    walk(path.join(root,entry.locator),'',0);inventory.sort((a,b)=>Buffer.compare(Buffer.from(a.locator),Buffer.from(b.locator)));
    const expectedDirectories=new Set(['']);
    for(const member of inventory){
      for(let parent=path.posix.dirname(member.locator);parent!=='.';parent=path.posix.dirname(parent))expectedDirectories.add(parent);
    }
    ownedSourceRequireV1(ownedSourceHashV1(JSON.stringify(inventory))===entry.inventoryHash&&inventory.length===entry.fileCount
      &&inventory.reduce((sum,item)=>sum+item.byteLength,0)===entry.byteLength&&ownedSourceSetEqualV1(actualDirectories,expectedDirectories));
    const metadata=ownedSourceJsonV1(pins.file(path.join(root,entry.locator,'package.json'),1048576,device).bytes);
    ownedSourceRequireV1(metadata.name===entry.name&&metadata.version===entry.version);
  }
  const memberships=new Set(),contexts=new Set();
  for(const {row,members} of groups){
    ownedSourceRequireV1(Array.isArray(row)&&row.length===4&&row[0]==='esm'&&ownedSourceLocatorV1(row[1])&&ownedSourceLocatorV1(row[3])
      &&seen.has('node_modules/'+row[2])&&authenticated.has(row[3])&&Array.isArray(members)&&members.length>0&&members.includes(row[1]));
    const context=JSON.stringify([row[0],path.dirname(row[1]),row[2],row[3]]);ownedSourceRequireV1(!contexts.has(context));contexts.add(context);
    const directory=pins.directory(path.join(root,path.dirname(row[1])),true);
    for(const member of members){
      const key=member+':'+row[2];ownedSourceRequireV1(ownedSourceLocatorV1(member)&&member.startsWith('dist/')&&member.endsWith('.js')
        &&path.dirname(member)===path.dirname(row[1])&&!memberships.has(key));memberships.add(key);
      const actual=pins.directory(path.dirname(path.join(root,member)));
      ownedSourceRequireV1(ownedSourceSameV1(directory,actual));
      if(root!==path.join(home,'ai','setrox','releases','setfarm-161297ff'))pins.file(path.join(root,member),16777216,device);
    }
  }
  if(root===path.join(home,'ai','setrox','releases','setfarm-161297ff'))pins.targetMembership(groups);
  for(const locator of absences){ownedSourceRequireV1(ownedSourceLocatorV1(locator));pins.absent(path.join(root,locator));}
  pins.resolvePackages(root,groups,home,recheck);
}

// Exactly four builtin-only resolver processes. No resolved package body is
// imported. The private pins facade supplies all nine full local pin proofs.
function ownedSourceResolversV1(pins,root,groups,home,recheck){
  recheck();
  const run=(phase,accountHome)=>{
    pins.check();const input=JSON.stringify({phase,edges:groups.map(({row})=>[row[0],path.join(root,row[1]),row[2]])});
    ownedSourceRequireV1(Buffer.byteLength(input)<=1048576);
    const child=spawnSync(ownedNodeV1,['--experimental-import-meta-resolve','--input-type=module','-e',ownedResolutionProgramV1],{
      input,encoding:'utf8',cwd:root,shell:false,timeout:5000,maxBuffer:1048576,
      env:{PATH:'/usr/bin:/bin',LANG:'C',LC_ALL:'C',...(accountHome?{HOME:home}:{})},
    });
    pins.check();ownedSourceRequireV1(!child.error&&!child.signal&&child.status===0&&child.stderr===''
      &&typeof child.stdout==='string'&&Buffer.byteLength(child.stdout)<=1048576);
    const result=JSON.parse(child.stdout);ownedSourceRequireV1(Array.isArray(result)&&result.length===groups.length);return result;
  };
  for(const accountHome of [false,true]){
    for(const [index,search] of run('paths',accountHome).entries()){
      ownedSourceRequireV1(Array.isArray(search)&&search.length>0&&search.length<=128);let found=false;
      for(const directory of search){
        ownedSourceRequireV1(typeof directory==='string'&&path.isAbsolute(directory)&&path.normalize(directory)===directory);
        if(directory===path.join(root,'node_modules')){found=true;break;}
        for(const suffix of ['','.js','.json','.node'])pins.absent(path.join(directory,groups[index].row[2]+suffix));
      }
      ownedSourceRequireV1(found);
    }
    for(const [index,result] of run('resolve',accountHome).entries())ownedSourceRequireV1(result===path.join(root,groups[index].row[3]));
  }
  pins.check();recheck();
}

export async function holdManualOrphanOwnedSourcesV1(){
  if(arguments.length||ownedSourceCleanupUncertainV1)throw ownedSourceRefusalV1();
  const resources=ownedSourceResourcesV1();let invalid=false,closed=false,ready=false;
  const owners=[],observers=[];let identityCheck=()=>{},contextCheck=()=>{};
  let pins,retainedTarget=null;
  const cleanup=()=>{closed=true;resources.close();};
  const check=()=>{
    let entered=false;
    try{
      ownedSourceRequireV1(!closed&&!invalid&&!check.active);check.active=true;entered=true;
      resources.guard();contextCheck();pins?.check();
      for(const owner of owners)if(owner!==retainedTarget)owner.check();identityCheck();
      for(const observer of observers){const actual=observer.read();ownedSourceRequireV1(ownedSourceEqualBuildV1(actual,observer.expected));}
      pins?.check();contextCheck();ownedSourceRequireV1(!invalid);
    }catch{invalid=true;throw ownedSourceRefusalV1();}finally{if(entered)check.active=false;}
  };
  const close=()=>{
    if(closed){resources.close();return;}
    let refused=invalid;
    if(!invalid)try{check();}catch{refused=true;}
    cleanup();if(refused)throw ownedSourceRefusalV1();
  };
  const registerOwner=(acquire,validate)=>{
    let raw;
    try{raw=acquire();}catch{ownedSourceCleanupUncertainV1=true;throw ownedSourceRefusalV1();}
    // Retain the returned value BEFORE any property/shape/observation access.
    resources.add(()=>raw.close());
    try{return validate(raw);}catch{
      if(raw===null||typeof raw!=='object'||typeof raw.close!=='function')ownedSourceCleanupUncertainV1=true;
      throw ownedSourceRefusalV1();
    }
  };
  try{
    const locators=probeSourceLocatorsV1(),suffix='/tests/execution-attempts/helpers/manual-control-orphan-bootstrap-child-v1.mjs';
    ownedSourceRequireV1(locators.helper.endsWith(suffix));
    const maintenanceRoot=locators.helper.slice(0,-suffix.length),account=userInfo();
    const home=account.homedir,workspace=path.join(home,'ai','setrox'),targetRoot=path.join(workspace,'releases/setfarm-161297ff');
    ownedSourceRequireV1(home==='/Users/setrox'&&account.uid===501&&account.gid===20
      &&process.getuid?.()===501&&process.geteuid?.()===501&&process.getgid?.()===20&&process.getegid?.()===20
      &&process.platform==='darwin'&&process.arch==='arm64'&&process.version==='v26.4.0'
      &&process.execPath===ownedNodeV1&&process.argv0===ownedNodeV1&&process.argv[0]===ownedNodeV1
      &&process.cwd()===maintenanceRoot&&path.dirname(maintenanceRoot)===path.join(workspace,'releases')
      &&/^setfarm-[a-f0-9]{8}$/.test(path.basename(maintenanceRoot))&&maintenanceRoot!==targetRoot
      &&process.argv[1]!==path.join(maintenanceRoot,ownedRetentionV1)&&process.argv[1]!==path.join(targetRoot,ownedRetentionV1));
    contextCheck=()=>ownedSourceRequireV1(process.getuid?.()===501&&process.geteuid?.()===501&&process.getgid?.()===20&&process.getegid?.()===20
      &&process.execPath===ownedNodeV1&&process.argv0===ownedNodeV1&&process.argv[0]===ownedNodeV1
      &&process.platform==='darwin'&&process.arch==='arm64'&&process.version==='v26.4.0'&&process.cwd()===maintenanceRoot);
    pins=ownedSourcePinsV1(resources,home,contextCheck);const device=pins.directory(maintenanceRoot).dev;
    ownedSourceRequireV1(fs.realpathSync(maintenanceRoot)===maintenanceRoot&&fs.realpathSync(locators.helper)===locators.helper
      &&fs.realpathSync(ownedNodeV1)===ownedNodeV1
      &&pins.file(ownedNodeV1,16777216,undefined,true).sha256===ownedNodeHashV1);
    pins.file('/usr/bin/git',16777216,undefined,true);
    const git=args=>{
      pins.check();
      const result=spawnSync('/usr/bin/git',['-c','core.hooksPath=/dev/null','-c','core.fsmonitor=false',...args],{
        cwd:maintenanceRoot,shell:false,timeout:10000,maxBuffer:16777216,
        env:{PATH:'/usr/bin:/bin',LANG:'C',LC_ALL:'C',GIT_CONFIG_NOSYSTEM:'1',GIT_CONFIG_GLOBAL:'/dev/null',
          GIT_NO_REPLACE_OBJECTS:'1',GIT_OPTIONAL_LOCKS:'0',GIT_TERMINAL_PROMPT:'0'},
      });
      pins.check();ownedSourceRequireV1(!result.error&&!result.signal&&result.status===0&&result.stderr.length===0&&Buffer.isBuffer(result.stdout));
      return result.stdout;
    };
    const head=git(['rev-parse','--verify','HEAD']).toString('utf8').trim();
    ownedSourceRequireV1(ownedGitShaV1(head)&&head!==ownedTargetShaV1&&path.basename(maintenanceRoot)==='setfarm-'+head.slice(0,8)
      &&git(['branch','--show-current']).toString('utf8')==='main\n'
      &&git(['rev-parse','--verify','refs/remotes/origin/main']).toString('utf8')===head+'\n'
      &&git(['status','--porcelain=v1','--untracked-files=all']).length===0);
    const authenticateRetention=(root,sha)=>{
      const bytes=pins.file(path.join(root,ownedRetentionV1),16777216).bytes;
      ownedSourceRequireV1(ownedSourceHashV1(bytes)===ownedRetentionHashV1
        &&bytes.equals(git([...(root===maintenanceRoot?[]:['-C',root]),'show',sha+':'+ownedRetentionV1])));
    };
    authenticateRetention(maintenanceRoot,head);check();
    const maintenanceApi=await import(pathToFileURL(path.join(maintenanceRoot,ownedRetentionV1)).href);check();
    const acquireBuild=(api)=>{
      ownedSourceRequireV1(typeof api.holdCurrentFinalizedSetfarmSourceBuildV1==='function'
        &&api.holdCurrentFinalizedSetfarmSourceBuildV1.length===0);
      return registerOwner(()=>api.holdCurrentFinalizedSetfarmSourceBuildV1(),raw=>{
        ownedSourceRequireV1(Object.isFrozen(raw)&&typeof raw.recheck==='function'&&typeof raw.close==='function');
        ownedSourceKeysV1(raw.observation.buildSource,['sha','treeHash','buildHash']);
        const expected=ownedSourceBuildDataV1(raw.observation?.buildSource);
        const sameCheckout=()=>{
          const checkout=raw.observation?.checkoutSource;
          ownedSourceRequireV1(checkout?.branch==='main'&&checkout.clean===true&&checkout.sha===expected.sha
            &&checkout.treeHash===expected.treeHash&&checkout.originMainSha===expected.sha);
        };
        sameCheckout();const retained={expected,check:()=>{
          // A started stock recheck can open temporary FDs that its retained
          // owner cannot certify closed after an opaque thrown close fault.
          try{raw.recheck();}catch{ownedSourceCleanupUncertainV1=true;throw ownedSourceRefusalV1();}
          sameCheckout();ownedSourceRequireV1(ownedSourceEqualBuildV1(raw.observation?.buildSource,expected));
        }};
        owners.push(retained);return retained;
      });
    };
    const maintenance=acquireBuild(maintenanceApi);ownedSourceRequireV1(maintenance.expected.sha===head);check();
    const profileBytes=pins.file(path.join(maintenanceRoot,ownedProfileV1),65536,device).bytes;
    ownedSourceRequireV1(profileBytes.equals(git(['show',head+':'+ownedProfileV1]))&&ownedSourceHashV1(profileBytes)===ownedProfileHashV1);
    const profile=ownedSourceJsonV1(profileBytes);ownedSourceValidateProfileV1(profile);
    const comparisonFiles={};
    for(let index=0;index<ownedComparisonLocatorsV1.length;index++){
      const pin=pins.file(path.join(maintenanceRoot,ownedComparisonLocatorsV1[index]),16777216,device);
      comparisonFiles[ownedSourceFileKeysV1[index]]=Object.freeze({dev:String(pin.stat.dev),ino:String(pin.stat.ino),
        uid:Number(pin.stat.uid),gid:Number(pin.stat.gid),mode:Number(pin.stat.mode&0o7777n),nlink:Number(pin.stat.nlink),
        bytes:Number(pin.stat.size),mtimeNs:String(pin.stat.mtimeNs),ctimeNs:String(pin.stat.ctimeNs),sha256:pin.sha256});
    }
    const maintenanceOutput=ownedSourceOutputV1(pins,maintenanceRoot,maintenance.expected,false);
    const compiled=(root,output,locator)=>{
      const entry=output.get(locator);ownedSourceRequireV1(entry);
      const pin=pins.file(path.join(root,locator),33554432);
      ownedSourceRequireV1(pin.bytes.length===entry.byteLength&&pin.sha256===entry.sha256
        &&Number(pin.stat.mode&0o7777n)===entry.mode);return pin.bytes;
    };
    const observerFiles=profile.maintenanceObserver.sourceClosure.map(entry=>entry.locator.replace(/^src\//,'dist/').replace(/\.ts$/,'.js'));
    const ordinaryFiles=[...observerFiles,...ownedOrdinaryDeltaV1],setupFiles=[...ordinaryFiles,...ownedSetupDeltaV1];
    ownedSourceRequireV1(new Set(observerFiles).size===121&&new Set(ordinaryFiles).size===143&&new Set(setupFiles).size===153);
    // Bind every admitted M body before the FIRST compiled import, using
    // actual own-M bytes authenticated against its retained build metadata.
    ownedSourceAuditedCompiledV1([...ordinaryFiles]
      .sort((a,b)=>Buffer.compare(Buffer.from(a),Buffer.from(b)))
      .map(locator=>({locator,sha256:ownedSourceHashV1(compiled(maintenanceRoot,maintenanceOutput,locator))})),'maintenance');
    for(const locator of [ownedWorkspaceApiV1,ownedNormalizerV1]){
      ownedSourceRequireV1(ownedSourceImportsV1(compiled(maintenanceRoot,maintenanceOutput,locator)).every(name=>ownedGraphBuiltinsV1.has(name)));
    }
    check();const workspaceApi=await import(pathToFileURL(path.join(maintenanceRoot,ownedWorkspaceApiV1)).href);check();
    ownedSourceRequireV1(typeof workspaceApi.resolveInternalProductionBaselineWorkspaceRootV1==='function'
      &&workspaceApi.resolveInternalProductionBaselineWorkspaceRootV1()===workspace
      &&typeof workspaceApi.authenticateInternalProductionBaselineWorkspaceAnchorV1==='function');
    const anchor=registerOwner(()=>workspaceApi.authenticateInternalProductionBaselineWorkspaceAnchorV1(),raw=>{
      ownedSourceRequireV1(Object.isFrozen(raw)&&typeof raw.assertStable==='function'&&typeof raw.close==='function');
      owners.push({check:()=>raw.assertStable()});return raw;
    });anchor.assertStable();check();
    const normalizer=await import(pathToFileURL(path.join(maintenanceRoot,ownedNormalizerV1)).href);check();
    const fixedPath=[path.dirname(ownedNodeV1),path.join(home,'.local','bin'),'/opt/homebrew/bin','/usr/local/bin','/usr/bin','/bin','/usr/sbin','/sbin'].join(path.delimiter);
    ownedSourceRequireV1(typeof normalizer.normalizeRuntimePathV1==='function'
      &&normalizer.normalizeRuntimePathV1(fixedPath,home,ownedNodeV1)===fixedPath);
    ownedSourceRequireV1(pins.directory(targetRoot).dev===device&&fs.realpathSync(targetRoot)===targetRoot);
    const common=root=>{
      const line=git([...(root===maintenanceRoot?[]:['-C',root]),'rev-parse','--git-common-dir']).toString('utf8');
      ownedSourceRequireV1(line.endsWith('\n')&&line.indexOf('\n')===line.length-1);
      const resolved=path.resolve(root,line.slice(0,-1));ownedSourceRequireV1(fs.realpathSync(resolved)===resolved);return resolved;
    };
    const maintenanceCommon=common(maintenanceRoot),targetCommon=common(targetRoot);
    pins.directory(maintenanceCommon);pins.directory(targetCommon);
    const identityGit=args=>{
      const target=args.length===4&&args[0]==='-C'&&args[1]===targetRoot;
      ownedSourceRequireV1(JSON.stringify(args)===JSON.stringify(target?['-C',targetRoot,'rev-parse','--git-common-dir']:['rev-parse','--git-common-dir']));
      const commonDirectory=target?targetCommon:maintenanceCommon;
      pins.file('/usr/bin/git',16777216,undefined,true);pins.directory(commonDirectory);
      const result=spawnSync('/usr/bin/git',['-c','core.hooksPath=/dev/null','-c','core.fsmonitor=false',...args],{
        cwd:maintenanceRoot,shell:false,timeout:10000,maxBuffer:16777216,
        env:{PATH:'/usr/bin:/bin',LANG:'C',LC_ALL:'C',GIT_CONFIG_NOSYSTEM:'1',GIT_CONFIG_GLOBAL:'/dev/null',
          GIT_NO_REPLACE_OBJECTS:'1',GIT_OPTIONAL_LOCKS:'0',GIT_TERMINAL_PROMPT:'0'},
      });
      pins.file('/usr/bin/git',16777216,undefined,true);pins.directory(commonDirectory);
      ownedSourceRequireV1(!result.error&&!result.signal&&result.status===0&&result.stderr.length===0&&Buffer.isBuffer(result.stdout));
      return result.stdout;
    };
    const identityCommon=root=>{
      const line=identityGit([...(root===maintenanceRoot?[]:['-C',root]),'rev-parse','--git-common-dir']).toString('utf8');
      ownedSourceRequireV1(line.endsWith('\n')&&line.indexOf('\n')===line.length-1);
      const resolved=path.resolve(root,line.slice(0,-1));ownedSourceRequireV1(fs.realpathSync(resolved)===resolved);return resolved;
    };
    ownedSourceRequireV1(maintenanceCommon!==targetCommon
      &&git(['-C',targetRoot,'rev-parse','--verify','HEAD']).toString('utf8')===ownedTargetShaV1+'\n'
      &&git(['-C',targetRoot,'rev-parse','--verify',ownedTargetShaV1+'^{tree}']).toString('utf8')===profile.target.sourceTreeHash+'\n');
    const targetOutput=ownedSourceOutputV1(pins,targetRoot,{sha:ownedTargetShaV1,treeHash:profile.target.sourceTreeHash},true,profile);
    ownedSourceRequireV1(pins.file(path.join(targetRoot,'package-lock.json'),16777216,device).sha256===profile.target.lockSha256);
    for(const name of ['package.json','package-lock.json'])ownedSourceRequireV1(
      pins.file(path.join(targetRoot,name),16777216,device).bytes.equals(git(['-C',targetRoot,'show',ownedTargetShaV1+':'+name])));
    authenticateRetention(targetRoot,ownedTargetShaV1);check();
    const targetApi=await import(pathToFileURL(path.join(targetRoot,ownedRetentionV1)).href);check();
    const target=acquireBuild(targetApi);
    ownedSourceRequireV1(target.expected.sha===ownedTargetShaV1&&target.expected.treeHash===profile.target.sourceTreeHash);check();
    // T is separately pinned and authenticated; M's digest or profile Source
    // hashes never substitute for these fixed-T compiled byte records.
    ownedSourceAuditedCompiledV1([...setupFiles]
      .sort((a,b)=>Buffer.compare(Buffer.from(a),Buffer.from(b)))
      .map(locator=>({locator,sha256:ownedSourceHashV1(compiled(targetRoot,targetOutput,locator))})),'target');
    pins.handoffTargetOutput(targetRoot,targetOutput,target);retainedTarget=target;check();
    identityCheck=()=>{
      ownedSourceRequireV1(identityCommon(maintenanceRoot)===maintenanceCommon&&identityCommon(targetRoot)===targetCommon);
    };
    const maintenanceGroups=profile.targetResolution.map(group=>({row:[...group.row],members:[...group.members]}));
    const targetGroups=profile.targetResolution.map(group=>({row:[...group.row],members:[...group.members]}));
    targetGroups[7].members.push('dist/installation/fresh-installation-activation-v1.js');
    targetGroups[10].members.push('dist/product-compiler/artifact-index.js','dist/product-compiler/artifact-store-authority.js');
    for(const [root,output,groups,roots,count,sites] of [
      [maintenanceRoot,maintenanceOutput,maintenanceGroups,ownedOrdinaryRootsV1,143,82],
      [targetRoot,targetOutput,targetGroups,ownedSetupRootsV1,153,85],
    ]){
      const graph=root===targetRoot?pins.targetSetupGraph(output,groups):ownedSourceGraphV1(root,output,roots,groups,(locator)=>compiled(root,output,locator));
      ownedSourceRequireV1(graph.files.size===count&&graph.members.size===sites
        &&ownedSourceSetEqualV1(graph.files,root===maintenanceRoot?ordinaryFiles:setupFiles));
      const observer=root===targetRoot?pins.targetObserverGraph(output,profile.maintenanceObserver.resolution):ownedSourceGraphV1(root,output,[ownedObserverV1],profile.maintenanceObserver.resolution,
        locator=>compiled(root,output,locator));
      ownedSourceRequireV1(observer.files.size===121&&observer.members.size===79
        &&ownedSourceSetEqualV1(observer.files,observerFiles)
        &&![...observer.files].some(locator=>locator==='dist/db-pg.js'||locator==='dist/runtime-config.js'
          ||locator.includes('fresh-installation-selection')));
      ownedSourcePackagesV1(pins,root,profile,groups,profile.targetAbsences,home,check);
    }
    check();
    // Every release's complete package inventory and finite resolution has now
    // qualified. These are the FIRST full-observer imports in this process.
    let source;
    for(const [root,expected] of [[maintenanceRoot,maintenance.expected],[targetRoot,target.expected]]){
      const api=await import(pathToFileURL(path.join(root,ownedObserverV1)).href);check();
      ownedSourceRequireV1(typeof api.observeCurrentInternalProductionCleanSetfarmSourceBuildV1==='function'
        &&api.observeCurrentInternalProductionCleanSetfarmSourceBuildV1.length===0);
      const read=()=>{
        let value;
        try{value=api.observeCurrentInternalProductionCleanSetfarmSourceBuildV1();}
        catch{
          // This point observer exposes no separate internal cleanup receipt.
          // A thrown invocation cannot certify its internally opened FDs closed.
          ownedSourceCleanupUncertainV1=true;throw ownedSourceRefusalV1();
        }
        ownedSourceRequireV1(value?.branch==='main'&&value.clean===true&&value.originMainSha===expected.sha);return value;
      };
      observers.push({read,expected});
      if(root===targetRoot){
        source=Object.freeze({maintenance:maintenance.expected,target:target.expected,
          profileSha256:ownedSourceHashV1(profileBytes),files:Object.freeze(comparisonFiles)});
        // Validate the exact public data shape without granting codec data authority.
        ownedSourcesV1(source);
      }
      check();
    }
    ready=true;
    return Object.freeze({source,check(){ownedSourceRequireV1(ready);check();},close});
  }catch{
    invalid=true;try{cleanup();}catch{ownedSourceCleanupUncertainV1=true;}
    throw ownedSourceRefusalV1();
  }
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

// Policies and clock are module-private observation DATA, never owner inputs.
const probeChildPolicyV1=Object.freeze({owned:false,purpose:null,deadline:10000,cap:65536,fd4:true});
const ownedChildPoliciesV1=Object.freeze(Object.fromEntries([
  ['initdb',60000,262144,false],['server',960000,262144,false],['runner',840000,262144,true],
  ['provision',300000,262144,true],['activate',180000,262144,true],['integration',300000,1048576,true],
  ['old_entry_positive',120000,262144,true],['new_entry_refusal',120000,262144,true],
].map(([purpose,deadline,cap,fd4])=>[purpose,Object.freeze({owned:true,purpose,deadline,cap,fd4})])));
const invalidOwnedChildPolicyV1=Object.freeze({owned:true,purpose:null,deadline:10000,cap:65536,fd4:true});

// Private bounded DATA consumer. It owns no child, handle, callback or effect
// authority. Construction is deliberately deferred until the engine has bound
// lifecycle/error slots and attempted pause on every obtainable channel.
function manualOrphanIntegrationScannerV1(){
  const stem='MANUAL_ORPHAN_INTEGRATION_RESULT',header=stem+' ',family='MANUAL_ORPHAN_';
  const passPrefix='✔ manual orphan bootstrap v1 preserves old entry and refuses maintenance source (';
  const labels=['tests','suites','pass','fail','cancelled','skipped','todo'];
  const counts=[1,0,1,0,0,0,0];
  const reserved=['TAP version','Bail out!','# Subtest:','# tests','# suites','# pass','# fail',
    '# cancelled','# skipped','# todo','# duration_ms'];
  const glyphs=[[226,156,148],[226,156,150],[226,156,147],[226,156,151],[226,132,185],[226,150,182],[226,150,186]];
  const decimal=/^(0|[1-9][0-9]{0,11})(\.[0-9]{1,12})?$/;
  const candidate=Buffer.alloc(16384),prefix=Buffer.alloc(256);
  const decoder=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true});
  let refused=false,finished=false,step=0,marker=null,summary={};
  let lineBytes=0,prefixBytes=0,leading=true,indented=false,candidateActive=false;
  let familyMatch=0,stemPossible=true,stemBytes=0,digitPlan=0;
  let utfNeed=0,utfMin=128,utfMax=191,utfValue=0;
  const refuse=()=>{refused=true;};
  const starts=text=>{
    if(prefixBytes<text.length)return false;
    for(let index=0;index<text.length;index++)if(prefix[index]!==text.charCodeAt(index))return false;
    return true;
  };
  const reservedPreamble=()=>{
    if(prefixBytes===0)return false;
    if(prefix[0]===45)return true;
    for(const glyph of glyphs)if(prefixBytes>=3&&prefix[0]===glyph[0]&&prefix[1]===glyph[1]&&prefix[2]===glyph[2])return true;
    for(const text of reserved)if(starts(text))return true;
    for(const text of ['ok','not ok'])if(starts(text)&&(prefixBytes===text.length||prefix[text.length]===32))return true;
    return false;
  };
  const resetLine=()=>{
    lineBytes=0;prefixBytes=0;leading=true;indented=false;candidateActive=false;
    familyMatch=0;stemPossible=true;stemBytes=0;digitPlan=0;
  };
  const finishLine=()=>{
    if(candidateActive){
      if(lineBytes<header.length||lineBytes+1>16384){refuse();return;}
      candidate[lineBytes]=10;
      // The whole-line bound is stricter than the shared codec's own bound.
      // ANY thrown actual decoder call propagates to the engine UNKNOWN guard;
      // its catch-all deliberately gives us no invalid/internal distinction.
      marker=decodeManualOrphanIntegrationResultV1(Buffer.from(Buffer.prototype.subarray.call(candidate,header.length,lineBytes+1)));
      step=1;
    }else if(stemPossible&&stemBytes>0&&stemBytes<stem.length){refuse();return;}
    else if(step===0){if(reservedPreamble())refuse();}
    else{
      if(indented||lineBytes>256){refuse();return;}
      const text=decoder.decode(Buffer.prototype.subarray.call(prefix,0,prefixBytes));
      if(step===1){
        if(!text.startsWith(passPrefix)||!text.endsWith('ms)')||!decimal.test(text.slice(passPrefix.length,-3))){refuse();return;}
        step=2;
      }else if(step>=2&&step<=8){
        const index=step-2,label='ℹ '+labels[index]+' ';
        if(text!==label+counts[index]){refuse();return;}
        summary[labels[index]]=Number(text.slice(label.length));step++;
      }else if(step===9){
        const label='ℹ duration_ms ';
        if(!text.startsWith(label)||!decimal.test(text.slice(label.length))){refuse();return;}
        summary=Object.freeze(summary);step=10;
      }else{refuse();return;}
    }
    resetLine();
  };
  const utf8=byte=>{
    if(utfNeed!==0){
      if(byte<utfMin||byte>utfMax){refuse();return;}
      utfValue=utfValue*64+(byte&63);utfNeed--;utfMin=128;utfMax=191;
      if(utfNeed===0&&utfValue===0xfeff)refuse();
    }else if(byte<128){if((byte<32&&byte!==10)||byte===127)refuse();}
    else if(byte>=194&&byte<=223){utfNeed=1;utfValue=byte&31;utfMin=128;utfMax=191;}
    else if(byte>=224&&byte<=239){
      utfNeed=2;utfValue=byte&15;utfMin=byte===224?160:128;utfMax=byte===237?159:191;
    }else if(byte>=240&&byte<=244){
      utfNeed=3;utfValue=byte&7;utfMin=byte===240?144:128;utfMax=byte===244?143:191;
    }else refuse();
  };
  const consume=(bytes,size)=>{
    // size is the engine's intrinsic typed-array byteLength, never .length or
    // a caller-overridable iterator/method. No incoming buffer/view is retained.
    for(let index=0;index<size&&!refused;index++){
      if(finished||step===10){refuse();break;}
      const byte=bytes[index];utf8(byte);if(refused)break;
      if(byte===10){finishLine();continue;}
      const column=lineBytes;lineBytes=Math.min(16385,lineBytes+1);
      if(leading&&byte===32)indented=true;
      else{
        if(leading){leading=false;digitPlan=byte>=48&&byte<=57?1:-1;}
        else if(digitPlan===1){if(byte===46)digitPlan=2;else if(byte<48||byte>57)digitPlan=-1;}
        else if(digitPlan===2){if(byte===46)refuse();digitPlan=-1;}
        if(prefixBytes<256)prefix[prefixBytes++]=byte;
      }
      if(stemPossible&&!(stemBytes===0&&byte===32)){
        if(stemBytes<stem.length&&byte===stem.charCodeAt(stemBytes))stemBytes++;
        else stemPossible=false;
      }
      if(byte===family.charCodeAt(familyMatch))familyMatch++;
      else familyMatch=byte===family.charCodeAt(0)?1:0;
      if(familyMatch===family.length){
        if(column+1!==family.length||step!==0)refuse();
        familyMatch=0;
      }
      if(column===0&&step===0&&byte===header.charCodeAt(0))candidateActive=true;
      if(candidateActive){
        if(column<header.length&&byte!==header.charCodeAt(column)){
          candidateActive=false;if(column>=family.length)refuse();
        }else if(column>=16384)refuse();
        else candidate[column]=byte;
      }
    }
  };
  return {consume,refuse,finish(){
    if(finished){refuse();return;}
    finished=true;if(utfNeed!==0||lineBytes!==0||step!==10)refuse();
  },facts(){return {refused,complete:finished&&!refused&&step===10,marker,summary};}};
}

function manualOrphanMonotonicClockV1(duration,onFault,onDeadline){
  let origin=null,last=null,unavailable=false;
  const check=(deadline=true)=>{
    if(unavailable)return false;
    let now;
    try{
      now=process.hrtime.bigint();
      if(typeof now!=='bigint'||now<0n||(last!==null&&now<last))throw Error('invalid monotonic clock');
    }catch{unavailable=true;onFault();return false;}
    if(origin===null)origin=now;
    last=now;
    if(deadline&&now-origin>=BigInt(duration)*1000000n){onDeadline();return false;}
    return true;
  };
  return {check,remaining(){return origin===null||last===null?duration:Math.max(0,duration-Number(last-origin)/1000000);}};
}

export function observeManualOrphanOriginalChildV1(child){
  return observeManualOrphanChildV1(child,probeChildPolicyV1);
}
export function observeManualOrphanOwnedChildV1(actualChild,purpose){
  // Only literal policy values enter retained closures. Never reflect/coerce a
  // caller's purpose object, proxy, extra argument or arguments object.
  const policy=arguments.length===2&&typeof purpose==='string'&&Object.hasOwn(ownedChildPoliciesV1,purpose)
    ?ownedChildPoliciesV1[purpose]:invalidOwnedChildPolicyV1;
  return observeManualOrphanChildV1(actualChild,policy);
}
export function observeManualOrphanOwnedIntegrationChildV1(actualChild){
  return observeManualOrphanChildV1(actualChild,ownedChildPoliciesV1.integration,true,arguments.length!==1);
}
function observeManualOrphanChildV1(child,policy,collectIntegration=false,invalidIntegrationArity=false){
  const owned=policy.owned;
  let state=owned&&(policy.purpose===null||invalidIntegrationArity)?'unknown':'pending',reason=state==='unknown'?'purpose':null;
  let integrationScanner=null,integrationFault=false;
  let exit=null,close=null,exitCount=0,closeCount=0,spawned=false;
  let timer=null,timerCleared=false,historyResolved=false,resolveHistory,bindingComplete=false,timelyComplete=false,clock=null;
  const settled=new Promise(resolve=>{resolveHistory=resolve;});
  const makeOutput=()=>({bytes:0,hash:null,hashUnavailable:false,end:false,close:false,chunks:[],retained:0});
  const stdout=makeOutput(),stderr=makeOutput(),fd4={finish:false,end:false,close:false};
  const markUnknown=code=>{if(state!=='unknown'){state='unknown';reason=code;}};
  const loseIntegration=()=>{integrationFault=true;integrationScanner=null;markUnknown('binding');};
  const finishIntegration=()=>{
    if(!collectIntegration)return;
    try{if(integrationScanner===null)loseIntegration();else integrationScanner.finish();}catch{loseIntegration();}
  };
  const checkClock=()=>{if(owned&&bindingComplete&&clock!==null)clock.check(!timelyComplete);};
  const loseHash=channel=>{channel.hash=null;channel.hashUnavailable=true;markUnknown('binding');};
  const outputFact=channel=>{
    let sha256=PROBE_EMPTY_OUTPUT_SHA256_V1;
    if(owned){
      if(channel.hashUnavailable)sha256=null;
      else if(channel.hash!==null){try{sha256=channel.hash.copy().digest('hex');}catch{loseHash(channel);sha256=null;}}
    }else sha256=channel.hash?channel.hash.copy().digest('hex'):PROBE_EMPTY_OUTPUT_SHA256_V1;
    return Object.freeze({bytes:channel.bytes,sha256,end:channel.end,close:channel.close});
  };
  const snapshotFacts=()=>{
    // Compute both fallible digests BEFORE reading state into the frozen result.
    // Hash loss marks uncertainty without recursively constructing a snapshot.
    const out=outputFact(stdout),err=outputFact(stderr);
    checkClock();
    const facts={state,exit:exit===null?null:Object.freeze({...exit}),close:close===null?null:Object.freeze({...close}),
      stdout:out,stderr:err,fd4:owned&&!policy.fd4?null:Object.freeze({...fd4}),reason};
    return Object.freeze(owned?{purpose:policy.purpose,...facts}:facts);
  };
  const clearOwnedTimer=()=>{
    if(timer!==null&&!timerCleared){timerCleared=true;try{clearTimeout(timer);}catch{markUnknown('binding');}}
  };
  const settle=(current=false)=>{
    if(owned&&!bindingComplete)return;
    checkClock();
    if(state==='pending'&&exitCount===1&&closeCount===1&&exit!==null&&close!==null
      &&stdout.end&&stdout.close&&stderr.end&&stderr.close&&(!policy.fd4||(fd4.finish&&fd4.end&&fd4.close))){
      state='observed';timelyComplete=true;
    }
    if(state!=='pending'&&!historyResolved){
      clearOwnedTimer();const facts=snapshotFacts();historyResolved=true;resolveHistory(facts);return facts;
    }
    if(current){
      let facts=snapshotFacts();
      if(state!=='pending'&&!historyResolved){
        // A current digest/clock fault can be the first uncertainty. Finish
        // timer cleanup and rebuild BEFORE returning/resolving immutable DATA.
        clearOwnedTimer();facts=snapshotFacts();historyResolved=true;resolveHistory(facts);
      }
      return facts;
    }
  };
  const fail=code=>{markUnknown(code);settle();};
  const eventValue=(code,signal)=>({code:typeof code==='number'&&Number.isFinite(code)?code:null,signal:typeof signal==='string'?signal:null});
  const normalExit=(code,signal)=>Number.isSafeInteger(code)&&code>=0&&signal===null;
  const snapshot=()=>settle(true);
  const witness=Object.freeze({settled,snapshot,output(){
    if(!collectIntegration){
      settle();return {stdout:Buffer.concat(stdout.chunks,stdout.retained),stderr:Buffer.concat(stderr.chunks,stderr.retained)};
    }
    try{
      // Copies may fail. Qualify CURRENT digests/clock/lifecycle only AFTER both
      // copies, and never publish a historical settled/accepted observation.
      const out=Buffer.concat(stdout.chunks,stdout.retained),err=Buffer.concat(stderr.chunks,stderr.retained);
      const current=snapshot(),data=integrationScanner===null?null:integrationScanner.facts();
      let integrationState='pending';
      if(current.state==='unknown'||integrationFault||data===null||data.refused
        ||(current.exit!==null&&current.exit.code!==0)||(current.close!==null&&current.close.code!==0))integrationState='refused';
      else if(current.state==='observed'){
        integrationState=data.complete&&current.exit?.code===0&&current.exit.signal===null
          &&current.close?.code===0&&current.close.signal===null&&current.stdout.end&&current.stdout.close
          &&current.stderr.end&&current.stderr.close&&current.stderr.bytes===0
          &&current.stdout.bytes<=1048576&&current.stderr.bytes<=1048576
          &&current.fd4?.finish&&current.fd4.end&&current.fd4.close?'observed':'refused';
      }
      const integration=Object.freeze({state:integrationState,marker:integrationState==='observed'?data.marker:null,
        summary:integrationState==='observed'?data.summary:null});
      return Object.freeze({stdout:out,stderr:err,integration});
    }catch{
      loseIntegration();try{settle();}catch{markUnknown('binding');}
      throw Error('MANUAL_ORPHAN_CLEANUP_UNKNOWN');
    }
  }});
  const originalBindings=[
    ['spawn',()=>{checkClock();if(owned&&spawned)fail('binding');spawned=true;settle();}],
    ['error',()=>{checkClock();fail(spawned?'child-error':'spawn-error');}],
    ['exit',(code,signal)=>{
      checkClock();exitCount++;if(exit===null)exit=eventValue(code,signal);
      if(exitCount!==1||closeCount!==0||!normalExit(code,signal))fail('exit-close');settle();
    }],
    ['close',(code,signal)=>{
      checkClock();closeCount++;if(close===null)close=eventValue(code,signal);
      if(closeCount!==1||exitCount!==1||!normalExit(code,signal)||exit===null||exit.code!==code||exit.signal!==signal)fail('exit-close');settle();
    }],
  ];
  const originalObject=child!==null&&typeof child==='object';
  if(!originalObject)fail('binding');
  else if(owned){
    for(const [event,handler] of originalBindings){try{child.on(event,handler);}catch{fail('binding');}}
  }else{
    // Preserve legacy early-return and no-clock policy on original binding fault.
    try{if(typeof child.on!=='function')throw Error('binding');for(const [event,handler] of originalBindings)child.on(event,handler);}
    catch{fail('binding');return witness;}
  }
  if(!originalObject){bindingComplete=true;settle();return witness;}

  const streams={stdout:null,stderr:null,fd4:null};
  try{streams.stdout=child.stdout;}catch{fail('binding');}
  if(streams.stdout==null)fail('stdout');
  try{streams.stderr=child.stderr;}catch{fail('binding');}
  if(streams.stderr==null)fail('stderr');
  try{const stdio=child.stdio;if(!Array.isArray(stdio))fail('binding');else streams.fd4=stdio[4];}catch{fail('binding');}
  if(streams.fd4==null){if(policy.fd4)fail('fd4');}
  else if(owned&&!policy.fd4)fail('binding');

  const present=[];
  const lifecycleBindings=(name,channel)=>name==='fd4'?[
    ['error',()=>{checkClock();fail('fd4');}],
    ['finish',()=>{checkClock();const invalid=fd4.finish||fd4.close;fd4.finish=true;if(invalid)fail('fd4');settle();}],
    ['end',()=>{checkClock();const invalid=fd4.end||fd4.close;fd4.end=true;if(invalid)fail('fd4');settle();}],
    ['close',()=>{checkClock();const invalid=fd4.close||!fd4.finish||!fd4.end;fd4.close=true;if(invalid)fail('fd4');settle();}],
  ]:[
    ['error',()=>{checkClock();fail(name);}],
    ['end',()=>{checkClock();const invalid=channel.end||channel.close;if(name==='stdout')finishIntegration();channel.end=true;if(invalid)fail(name);settle();}],
    ['close',()=>{checkClock();const invalid=channel.close||!channel.end;channel.close=true;if(invalid)fail(name);settle();}],
  ];
  for(const name of ['stdout','stderr','fd4']){
    const stream=streams[name];if(stream==null)continue;
    const record={name,stream,errorBound:false,dataBound:false};
    const bindings=lifecycleBindings(name,name==='stdout'?stdout:stderr);
    if(owned){
      // One unavailable lifecycle slot does not discard the remaining slots,
      // pause/data attempts or safe drain of this same channel.
      present.push(record);
      for(const [event,handler] of bindings){
        try{stream.on(event,handler);if(event==='error')record.errorBound=true;}catch{fail('binding');}
      }
    }else{
      // Preserve the strict legacy grouped binding/eligibility policy.
      try{
        if(typeof stream.on!=='function'||typeof stream.pause!=='function'||typeof stream.resume!=='function')throw Error('binding');
        for(const [event,handler] of bindings)stream.on(event,handler);
        present.push(record);
      }catch{fail('binding');}
    }
  }
  for(const {name,stream} of present){try{stream.pause();}catch{fail(name);}}
  if(collectIntegration){
    try{integrationScanner=manualOrphanIntegrationScannerV1();if(invalidIntegrationArity)integrationScanner.refuse();}
    catch{loseIntegration();}
  }
  for(const record of present){
    const {name,stream}=record;
    try{
      if(name==='fd4')stream.on('data',()=>{checkClock();fail('fd4');});
      else{
        const channel=name==='stdout'?stdout:stderr;
        stream.on('data',chunk=>{
          checkClock();if((owned&&types.isProxy(chunk))||!Buffer.isBuffer(chunk)){fail(name);return;}
          let invalid=channel.end||channel.close;
          let size;
          if(owned){
            try{size=Object.getOwnPropertyDescriptor(Object.getPrototypeOf(Uint8Array.prototype),'byteLength').get.call(chunk);}
            catch{fail(name);return;}
          }else size=chunk.length;
          channel.bytes+=size;
          // Unexpected synchronous data during binding must not later acquire
          // an empty/prefix digest from a newly initialized hash.
          if(owned&&channel.hash===null&&!channel.hashUnavailable)loseHash(channel);
          try{if(channel.hash)channel.hash.update(chunk);}catch{
            if(owned)loseHash(channel);else{channel.hash=null;invalid=true;}
          }
          const count=Math.min(65536-channel.retained,size);
          if(count>0){
            if(owned){try{channel.chunks.push(Buffer.from(Buffer.prototype.subarray.call(chunk,0,count)));channel.retained+=count;}catch{markUnknown('binding');}}
            else{channel.chunks.push(Buffer.from(chunk.subarray(0,count)));channel.retained+=count;}
          }
          if(collectIntegration&&integrationScanner!==null){
            try{if(name==='stdout')integrationScanner.consume(chunk,size);else if(size>0)integrationScanner.refuse();}
            catch{loseIntegration();}
          }
          if(invalid)fail(name);if(channel.bytes>policy.cap)fail('limit');settle();
        });
      }
      record.dataBound=true;
    }catch{fail('binding');}
  }
  bindingComplete=true;
  if(owned){clock=manualOrphanMonotonicClockV1(policy.deadline,()=>markUnknown('binding'),()=>markUnknown('deadline'));clock.check();
    for(const channel of [stdout,stderr]){
      if(channel.hashUnavailable)continue;
      try{const hash=createHash('sha256');if(!channel.hashUnavailable)channel.hash=hash;}catch{loseHash(channel);}
    }
  }else{try{stdout.hash=createHash('sha256');stderr.hash=createHash('sha256');}catch{fail('binding');}}
  checkClock();
  if(state==='pending'){
    try{timer=setTimeout(()=>{fail('deadline');},owned?clock.remaining():policy.deadline);}catch{fail('binding');}
    if(state!=='pending')clearOwnedTimer();
  }
  // Every independently bindable readable resumes even after clock/hash/purpose
  // uncertainty. Neither this witness nor its timer closes a foreign handle.
  for(const {name,stream,errorBound,dataBound} of present){
    // Resume needs known error/data coverage, not every terminal lifecycle slot.
    // A wholly unbindable channel stays uncertain without unsafe unhandled IO.
    if(owned&&(!errorBound||!dataBound))continue;
    try{stream.resume();}catch{fail(name);}
  }
  settle();return witness;
}

function ownedTransportUnknownV1(){return Error('MANUAL_ORPHAN_CLEANUP_UNKNOWN');}
const probeFd4PolicyV1=Object.freeze({owned:false,unknown:probeCloseUnknownV1});
const ownedFd4PolicyV1=Object.freeze({owned:true,unknown:ownedTransportUnknownV1});
let ownedInherited4ClaimV1=null;
export function observeManualOrphanOwnedFd4V1(){
  if(arguments.length!==0)throw probeOwnerRefusalV1();
  const claim=ownedInherited4ClaimV1;
  return Object.freeze({claimed:claim!==null,adopted:claim!==null&&claim.adopted,
    closed:claim!==null&&(claim.actualCloseSeen||!claim.adopted&&claim.rawCloseAttempted&&!claim.uncertain),
    unknown:claim!==null&&(claim.uncertain||claim.outputUncertain)});
}
function manualOrphanFd4ClaimV1(){
  return {attempted:true,adopted:false,rawCloseAttempted:false,socketCloseRequested:false,actualCloseSeen:false,
    uncertain:false,outputUncertain:false};
}
function reserveManualOrphanFd4V1(){
  if(ownedInherited4ClaimV1!==null)throw ownedInherited4ClaimV1.uncertain?ownedTransportUnknownV1():probeOwnerRefusalV1();
  ownedInherited4ClaimV1=manualOrphanFd4ClaimV1();return ownedInherited4ClaimV1;
}
function closeManualOrphanRaw4V1(claim){
  if(claim.adopted||claim.rawCloseAttempted)return;
  claim.rawCloseAttempted=true;
  try{fs.closeSync(4);}catch{claim.uncertain=true;}
}
function decodeManualOrphanIntegrationInputV1(bytes){
  const frame=decodeManualOrphanOwnedPhaseFrameV1(bytes);
  if(frame.purpose!=='integration')throw probeFrameRefusalV1();return frame;
}
function decodeManualOrphanEntryInputV1(bytes){
  try{return decodeManualOrphanProbeFrameV1(bytes);}catch{}
  const frame=decodeManualOrphanOwnedPhaseFrameV1(bytes);
  if(frame.purpose!=='provision'&&frame.purpose!=='activate'
    &&frame.purpose!=='old_entry_positive'&&frame.purpose!=='new_entry_refusal')throw probeFrameRefusalV1();
  return frame;
}
export function readManualOrphanProbeFd4V1(){
  return readManualOrphanFd4V1(probeFd4PolicyV1,decodeManualOrphanProbeFrameV1,manualOrphanFd4ClaimV1(),arguments.length!==0);
}
export async function readManualOrphanOwnedFd4V1(expectedReceiver){
  // Reservation precedes argument rejection, clock, fstat and all adoption work.
  // Repeats throw a fresh error before reaching any transport/clock/decoder IO.
  const claim=reserveManualOrphanFd4V1();
  const valid=arguments.length===1&&typeof expectedReceiver==='string'
    &&(expectedReceiver==='runner'||expectedReceiver==='integration');
  const decoder=valid?(expectedReceiver==='runner'?decodeManualOrphanRunnerSetupFrameV1:decodeManualOrphanIntegrationInputV1):null;
  return readManualOrphanFd4V1(ownedFd4PolicyV1,decoder,claim,!valid);
}
function readManualOrphanFd4V1(policy,decoder,claim,argumentFault=false){
  return new Promise((resolve,reject)=>{
    const refuseRaw=error=>{closeManualOrphanRaw4V1(claim);reject(claim.uncertain?policy.unknown():error);};
    if(policy.owned&&argumentFault){refuseRaw(probeFrameRefusalV1());return;}
    const clock=policy.owned?manualOrphanMonotonicClockV1(5000,()=>{claim.uncertain=true;},()=>{claim.uncertain=true;}):null;
    const checkClock=()=>clock===null||clock.check();
    if(!checkClock()){refuseRaw(policy.unknown());return;}
    let socket;
    try{
      const stat=fs.fstatSync(4);
      if(!checkClock()){refuseRaw(policy.unknown());return;}
      if(argumentFault||(!stat.isFIFO()&&!stat.isSocket())){refuseRaw(probeOwnerRefusalV1());return;}
    }catch{if(policy.owned)claim.uncertain=true;refuseRaw(probeOwnerRefusalV1());return;}
    try{socket=new net.Socket({fd:4,readable:true,writable:false});claim.adopted=true;}
    catch{claim.uncertain=true;refuseRaw(probeOwnerRefusalV1());return;}

    let eof=false,closeCount=0,frameFault=false,timer=null,timerCleared=false,scheduled=false,total=0;
    const chunks=[];
    const clearOwnedTimer=()=>{
      if(timer!==null&&!timerCleared){timerCleared=true;try{clearTimeout(timer);}catch{claim.uncertain=true;}}
    };
    const requestClose=()=>{
      if(!claim.socketCloseRequested){claim.socketCloseRequested=true;try{socket.destroy();}catch{claim.uncertain=true;}}
    };
    const failUnknown=()=>{claim.uncertain=true;requestClose();};
    const closed=hadError=>{
      closeCount++;claim.actualCloseSeen=true;
      if(closeCount!==1||hadError===true||(!eof&&!frameFault))claim.uncertain=true;
      checkClock();clearOwnedTimer();
      if(!scheduled){
        scheduled=true;
        // Only an actual Socket close can schedule terminal decoding. A
        // synchronous destroy->close->throw records uncertainty before this job.
        queueMicrotask(()=>{
          checkClock();
          if(claim.uncertain){reject(policy.unknown());return;}
          let frame=null;
          if(!frameFault){try{frame=decoder(Buffer.concat(chunks,total));}catch{frameFault=true;}}
          checkClock();
          if(claim.uncertain)reject(policy.unknown());
          else if(frameFault)reject(probeFrameRefusalV1());
          else resolve(frame);
        });
      }
    };
    try{
      socket.on('error',()=>{checkClock();failUnknown();});
      socket.on('end',()=>{
        if(eof||closeCount!==0)claim.uncertain=true;
        eof=true;checkClock();requestClose();
      });
      socket.on('close',closed);
      socket.pause();
      socket.on('data',chunk=>{
        if(!checkClock()){requestClose();return;}
        if(eof||closeCount!==0){failUnknown();return;}
        if(types.isProxy(chunk)||!Buffer.isBuffer(chunk)){frameFault=true;requestClose();return;}
        try{
          const size=Object.getOwnPropertyDescriptor(Object.getPrototypeOf(Uint8Array.prototype),'byteLength').get.call(chunk);
          if(size>16384-total){frameFault=true;requestClose();return;}
          if(size>0){total+=size;chunks.push(Buffer.from(chunk));}
        }catch{failUnknown();}
      });
      if(checkClock())timer=setTimeout(()=>{failUnknown();},clock===null?5000:clock.remaining());
      else requestClose();
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
  manualOrphanChildContextV1(context,path.dirname(context.node)+':/usr/bin:/bin');
}
const ownedTransportPathV1='/opt/homebrew/Cellar/node/26.4.0/bin:/Users/setrox/.local/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin';
function manualOrphanEntryPolicyV1(context){
  if(process.env.PATH===path.dirname(context.node)+':/usr/bin:/bin'){
    probeChildContextV1(context);return probeFd4PolicyV1;
  }
  if(process.env.PATH!==ownedTransportPathV1)throw probeOwnerRefusalV1();
  manualOrphanChildContextV1(context,ownedTransportPathV1);
  if(context.node!==ownedNodeV1||userInfo().homedir!=='/Users/setrox')throw probeOwnerRefusalV1();
  return ownedFd4PolicyV1;
}
function manualOrphanChildContextV1(context,expectedPath){
  if(process.execPath!==context.node||process.argv0!==context.node||!Array.isArray(process.execArgv)
    ||process.execArgv.length!==0||!Array.isArray(process.argv)||process.argv.length!==2
    ||process.argv[0]!==context.node||process.argv[1]!==context.helper||process.cwd()!==context.root){
    throw probeOwnerRefusalV1();
  }
  const expected={PATH:expectedPath,LANG:'C',LC_ALL:'C'};
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

function probeChildOutputV1(unknownError=probeCloseUnknownV1){
  let unknownWritten=false;
  const unknown=()=>{
    const error=unknownError(); // Retain the fault before any diagnostic write.
    process.exitCode=1;
    if(!unknownWritten){
      unknownWritten=true;
      try{process.stderr.write(error.message+'\n');}catch{}
    }
  };
  // Native output errors must not become an unhandled raw diagnostic. These
  // listeners are installed only in the direct child, never at module import.
  if(typeof process.stderr.on==='function')process.stderr.on('error',()=>{unknownError();process.exitCode=1;});
  if(typeof process.stdout.on==='function')process.stdout.on('error',unknown);
  return {unknown,writeFailure(error){
    process.exitCode=1;
    try{process.stderr.write(error.message+'\n');}catch{unknownError();}
  }};
}

function manualOrphanEntryErrorV1(error,policy){
  if(error?.message==='MANUAL_ORPHAN_CHILD_UNKNOWN'||error?.message==='MANUAL_ORPHAN_CLEANUP_UNKNOWN')return policy.unknown();
  if(error?.message==='MANUAL_ORPHAN_FRAME_REFUSED')return probeFrameRefusalV1();
  if(error?.message==='MANUAL_ORPHAN_SETUP_REFUSED')return Error('MANUAL_ORPHAN_SETUP_REFUSED');
  if(policy===ownedFd4PolicyV1&&error?.message==='MANUAL_ORPHAN_CASE_REFUSED')return Error('MANUAL_ORPHAN_CASE_REFUSED');
  return probeOwnerRefusalV1();
}
async function runManualOrphanProbeChildV1(){
  let claim;
  try{claim=reserveManualOrphanFd4V1();}
  catch(error){
    // Root's narrow terminal diagnostic exception: no output listeners, launch,
    // clock, Source work or FD4 cleanup on a repeated private entry invocation.
    const code=error.message==='MANUAL_ORPHAN_CLEANUP_UNKNOWN'?'MANUAL_ORPHAN_CLEANUP_UNKNOWN':'MANUAL_ORPHAN_OWNER_REFUSED';
    try{process.exitCode=1;process.stderr.write(code+'\n');}catch{}
    return;
  }
  let source=null,readerStarted=false,receipt=null,failure=null,output=null,policy=probeFd4PolicyV1;
  try{
    output=probeChildOutputV1(()=>{
      claim.outputUncertain=true;
      if(policy===ownedFd4PolicyV1)claim.uncertain=true;
      return policy.unknown();
    });
    const context=probeLaunchContextV1();policy=manualOrphanEntryPolicyV1(context);
    // An output error can precede policy resolution. Preserve legacy behavior,
    // but owned custody and any later reservation must retain that uncertainty.
    if(policy===ownedFd4PolicyV1&&claim.outputUncertain)claim.uncertain=true;
    readerStarted=true;
    const frame=await readManualOrphanFd4V1(policy,decodeManualOrphanEntryInputV1,claim);
    if(policy===ownedFd4PolicyV1&&claim.outputUncertain)throw ownedTransportUnknownV1();
    if(frame.schema!=='setfarm.manual-orphan-lifecycle-probe.v1'){
      receipt=await runManualOrphanOwnedPhaseV1(context,frame,policy);
    }else{
    // Probe data keeps its strict OLD context even when admitted/read under the
    // new transport profile. It never calls the public legacy reader again.
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
    }
  }catch(error){failure=manualOrphanEntryErrorV1(error,policy);}
  finally{
    if(!readerStarted)closeManualOrphanRaw4V1(claim);
    if(claim.uncertain||(policy===ownedFd4PolicyV1&&claim.outputUncertain))failure=policy.unknown();
    if(source){try{source.close();}catch{claim.uncertain=true;failure=policy.unknown();}}
  }
  // Recheck after cleanup, before any success exit/receipt decision. A later
  // output event still retains the same fact and forces exitCode back to one.
  if(policy===ownedFd4PolicyV1&&claim.outputUncertain)failure=ownedTransportUnknownV1();
  if(failure){
    if(output)output.writeFailure(failure);
    else{try{process.exitCode=1;process.stderr.write(failure.message+'\n');}catch{}}
    return;
  }
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

// Owned phases use private DATA consumers. Neither these comparisons nor a
// decoded frame supplies Source, process, filesystem or connection authority.
function requireManualOrphanOwnedHelperContextV1(context,frame,policy){
  try{
    // Old transport must refuse before even consulting the new account APIs.
    if(policy!==ownedFd4PolicyV1)throw probeOwnerRefusalV1();
    const c=probeOwnDataV1(context,['helper','issuer','root','node']);
    const workspace='/Users/setrox/ai/setrox',targetRoot=workspace+'/releases/setfarm-161297ff';
    if(!['provision','activate','old_entry_positive','new_entry_refusal'].includes(frame.purpose)
      ||c.node!==ownedNodeV1||path.dirname(c.root)!==workspace+'/releases'
      ||!/^setfarm-[a-f0-9]{8}$/.test(path.basename(c.root))||c.root===targetRoot
      ||c.helper!==c.root+'/tests/execution-attempts/helpers/manual-control-orphan-bootstrap-child-v1.mjs'
      ||c.issuer!==c.root+'/scripts/__tests__/manual-orphan-bootstrap-owned-route-v1.test.js')throw probeOwnerRefusalV1();
    manualOrphanChildContextV1(c,ownedTransportPathV1);
    const account=userInfo();
    if(account.homedir!=='/Users/setrox'||account.uid!==501||account.gid!==20
      ||process.getuid()!==501||process.geteuid()!==501||process.getgid()!==20||process.getegid()!==20
      ||process.platform!=='darwin'||process.arch!=='arm64'||process.version!=='v26.4.0'
      ||process.pid!==frame.child.pid||process.ppid!==frame.parent.pid
      ||path.basename(c.root)!=='setfarm-'+frame.source.maintenance.sha.slice(0,8))throw probeOwnerRefusalV1();
    return Object.freeze({maintenanceRoot:c.root,targetRoot,node:c.node,helper:c.helper,workspace});
  }catch{throw probeOwnerRefusalV1();}
}
function checkManualOrphanPhaseGraphV1(frame,observations,derived){
  try{
    const require=value=>{if(!value)throw probeOwnerRefusalV1();};
    const mechanical=frame.purpose==='old_entry_positive'||frame.purpose==='new_entry_refusal';
    const o=probeOwnDataV1(observations,['constructor','runner','parent','child','server']);
    for(const key of ['constructor','runner','parent','child','server']){
      const observation=probeOwnDataV1(o[key],['pin','rawCommand']);
      const pin=orderedProbeProcessV1(observation.pin);require(sameProbePinV1(pin,frame[key])&&pin.uid===501);
      require(typeof observation.rawCommand==='string'&&ownedSourceHashV1(observation.rawCommand)===pin.commandSha256);
      require(pin.executable===(key==='server'?derived.nativeTools.postgres.path:ownedNodeV1));
      require(pin.executableSha256===(key==='server'?derived.nativeTools.postgres.sha256:ownedNodeHashV1));
    }
    require(frame.runner.ppid===frame.constructor.pid&&frame.server.ppid===frame.constructor.pid
      &&frame.child.ppid===frame.parent.pid&&frame.child.pid!==frame.parent.pid
      &&frame.parent.pid===(mechanical?frame.parent.pid:frame.runner.pid)
      &&(!mechanical||frame.parent.ppid===frame.runner.pid));
    if(!mechanical)require(sameProbePinV1(frame.parent,frame.runner));
    require(new Set([frame.constructor.pid,frame.runner.pid,frame.server.pid,frame.child.pid,
      ...(mechanical?[frame.parent.pid]:[])]).size===(mechanical?5:4));
    const rootMatch=/^\/opt\/homebrew\/opt\/postgresql@17\/bin\/postgres -D (\/tmp\/setfarm-task6a-pg\.[A-Za-z0-9]+)\/data -h 127\.0\.0\.1 -p ([0-9]+) -k \1 -c unix_socket_permissions=0700 -c shared_buffers=32MB -c max_connections=50$/.exec(o.server.rawCommand);
    require(rootMatch!==null);const root=rootMatch[1],port=Number(rootMatch[2]),physicalRoot='/private'+root;
    require(String(port)===rootMatch[2]&&port===frame.cluster.port&&port!==5432&&port>=1024&&port<=65535
      &&root===derived.root&&port===derived.port&&physicalRoot===derived.physicalRoot
      &&derived.dataDirectory===root+'/data'&&derived.installationsDirectory===physicalRoot+'/installations');
    const runner=ownedNodeV1+' --import tsx scripts/run-isolated-postgres-tests.ts -- '+MANUAL_ORPHAN_VECTOR_V1.join(' ');
    require(o.constructor.rawCommand===ownedNodeV1+' '+derived.maintenanceRoot+'/scripts/run-private-postgres-tests.mjs manual-orphan-bootstrap'
      &&o.runner.rawCommand===runner&&o.child.rawCommand===ownedNodeV1+' '+derived.helper
      &&o.parent.rawCommand===(mechanical?ownedNodeV1+' --import tsx --test --test-isolation=none tests/execution-attempts/'+MANUAL_ORPHAN_BASENAME_V1:runner));
    return Object.freeze({...derived,root,physicalRoot,port});
  }catch{throw probeOwnerRefusalV1();}
}
function deriveManualOrphanPhaseEndpointV1(purpose,derived,input,preparedView){
  try{
    if(!ownedIntegerV1(derived.port,1024,65535)||derived.port===5432)throw probeOwnerRefusalV1();
    if(purpose==='provision'||purpose==='activate'){
      const data=probeOwnDataV1(input,purpose==='provision'?['adminPassword']:['adminPassword','installation']);
      if(!probeHexV1(data.adminPassword))throw probeOwnerRefusalV1();
      if(purpose==='activate')ownedInstallationV1(data.installation,false);
      return 'postgresql://postgres:'+data.adminPassword+'@127.0.0.1:'+derived.port+'/postgres';
    }
    if(purpose!=='old_entry_positive'&&purpose!=='new_entry_refusal')throw probeOwnerRefusalV1();
    const data=probeOwnDataV1(input,['installation']),installation=ownedInstallationV1(data.installation,true);
    const value=preparedView.runtimeUrl,endpoint=new URL(value);
    if(typeof value!=='string'||!['postgres:','postgresql:'].includes(endpoint.protocol)
      ||endpoint.hostname!=='127.0.0.1'||endpoint.port!==String(derived.port)||endpoint.username!==installation.runtimeRole
      ||endpoint.pathname!=='/'+installation.databaseName||!probeHexV1(endpoint.password)||endpoint.search||endpoint.hash
      ||endpoint.href!==value||preparedView.origin.installationId!==installation.installationId
      ||preparedView.origin.databaseOid!==installation.databaseOid||preparedView.runtimeOid!==installation.runtimeOid
      ||preparedView.ownerOid!==installation.ownerOid||preparedView.committed!==true)throw probeOwnerRefusalV1();
    return value;
  }catch{throw probeOwnerRefusalV1();}
}
function validateManualOrphanPhaseIdentityV1(rows,expected,retainedPair){
  try{
    const require=value=>{if(!value)throw probeOwnerRefusalV1();};
    const oid=value=>{require(typeof value==='string'&&/^[1-9][0-9]{0,9}$/.test(value));const n=Number(value);
      require(ownedIntegerV1(n,1,4294967295)&&String(n)===value);return n;};
    require(Array.isArray(rows)&&rows.length===1);const r=rows[0];
    const row=probeOwnDataV1(r,['systemIdentifier','postmasterStartedAtUTC','serverVersionNum','serverAddress','serverPort',
      'database','databaseOid','ownerOid','currentUser','sessionUser','runtimeOid','pid','backendStartedAtUTC','datid','usesysid']);
    const c=expected.cluster;
    const provisional=expected.databaseName==='postgres'&&expected.currentRole==='postgres'
      &&expected.sessionRole==='postgres'&&expected.runtimeOid===null
      &&expected.databaseOid===null&&expected.ownerOid===null&&expected.userOid===null;
    require(provisional||[expected.databaseOid,expected.ownerOid,expected.userOid].every(n=>ownedIntegerV1(n,1,4294967295)));
    const databaseOid=oid(row.databaseOid),ownerOid=oid(row.ownerOid),datid=oid(row.datid),userOid=oid(row.usesysid);
    require(typeof row.systemIdentifier==='string'&&/^[1-9][0-9]{0,19}$/.test(row.systemIdentifier)
      &&BigInt(row.systemIdentifier)<=18446744073709551615n&&row.systemIdentifier===c.systemIdentifier
      &&ownedMicrosecondTimestampV1(row.postmasterStartedAtUTC)&&row.postmasterStartedAtUTC===c.postmasterStartedAtUTC
      &&typeof row.serverVersionNum==='string'&&/^17[0-9]{4}$/.test(row.serverVersionNum)
      &&Number(row.serverVersionNum)===c.serverVersionNum&&row.serverAddress==='127.0.0.1'&&row.serverPort===c.port
      &&row.database===expected.databaseName&&(provisional?datid===databaseOid&&userOid===ownerOid:
        databaseOid===expected.databaseOid&&ownerOid===expected.ownerOid)
      &&row.currentUser===expected.currentRole&&row.sessionUser===expected.sessionRole
      &&(expected.runtimeOid===null?row.runtimeOid===null:oid(row.runtimeOid)===expected.runtimeOid)
      &&probeIntegerV1(row.pid,1)&&ownedMicrosecondTimestampV1(row.backendStartedAtUTC)
      &&(provisional||datid===expected.databaseOid&&userOid===expected.userOid));
    const pair={pid:row.pid,backendStartedAtUTC:row.backendStartedAtUTC,datid:oid(row.datid),usesysid:oid(row.usesysid)};
    if(retainedPair!==null){const old=probeOwnDataV1(retainedPair,['pid','backendStartedAtUTC','datid','usesysid']);
      require(Object.keys(pair).every(key=>old[key]===pair[key]));}
    return Object.freeze(pair);
  }catch{throw probeOwnerRefusalV1();}
}
function validateManualOrphanPhaseBaselineV1(rows,expected,installation){
  try{
    const require=value=>{if(!value)throw probeOwnerRefusalV1();};
    const input=probeOwnDataV1(rows,['databases','roles','memberships']);
    require(Array.isArray(input.databases)&&Array.isArray(input.roles)&&Array.isArray(input.memberships)
      &&input.databases.length<=(installation?4:3)&&input.roles.length<=(installation?130:128)&&input.memberships.length<=256);
    let databases=input.databases,roles=input.roles;
    if(installation!==null){
      const i=ownedInstallationV1(installation,Object.hasOwn(installation,'activationCatalogHash'));
      const db=databases.filter(r=>r.name===i.databaseName),owner=roles.filter(r=>r.name===i.ownerRole),runtime=roles.filter(r=>r.name===i.runtimeRole);
      require(db.length===1&&owner.length===1&&runtime.length===1&&db[0].oid===i.databaseOid&&db[0].ownerOid===i.ownerOid
        &&db[0].allowConnections===true&&db[0].connectionLimit===-1&&Object.keys(db[0]).length===5);
      for(const [row,oid,login] of [[owner[0],i.ownerOid,false],[runtime[0],i.runtimeOid,true]]){
        probeOwnDataV1(row,['name','oid','superuser','inherit','createRole','createDb','login','replication','bypassRls','connectionLimit','validUntilUTC']);
        require(row.oid===oid&&row.login===login&&row.superuser===false&&row.inherit===false&&row.createRole===false&&row.createDb===false
          &&row.replication===false&&row.bypassRls===false&&row.connectionLimit===-1&&row.validUntilUTC===null);
      }
      require(databases.filter(r=>r.oid===i.databaseOid).length===1
        &&roles.filter(r=>r.oid===i.ownerOid).length===1&&roles.filter(r=>r.oid===i.runtimeOid).length===1);
      require(input.memberships.every(r=>!['roleOid','memberOid','grantorOid'].some(key=>r[key]===i.ownerOid||r[key]===i.runtimeOid)));
      databases=databases.filter(r=>r!==db[0]);roles=roles.filter(r=>r!==owner[0]&&r!==runtime[0]);
    }
    const result=canonicalizeManualOrphanClusterBaselineV1({databases,roles,memberships:input.memberships});
    for(const key of ['databaseBaselineSha256','roleBaselineSha256','membershipBaselineSha256'])require(result[key]===expected[key]);
    return result;
  }catch{throw probeOwnerRefusalV1();}
}
function projectManualOrphanPhaseInstallationV1(recordView,expected,stage){
  try{
    const require=value=>{if(!value)throw probeOwnerRefusalV1();};
    require(['committed','before-activation','activated'].includes(stage));
    const v=probeOwnDataV1(recordView,['prepared','directory','activation','observedSchemaCatalogHash','observedActivationCatalogHash',
      'activationAbsenceObserved','staleAbsenceRefused','selectedDirectory','activationReturn']);
    const p=probeOwnDataV1(v.prepared,['origin','catalogHash','ownerOid','runtimeOid','runtimeUrl','committed','baseRecordBytes','baseRecordPins']);
    const o=probeOwnDataV1(p.origin,['schema','installationId','operationId','systemIdentifier','databaseOid','databaseName','ownerRole','runtimeRole','sourceSha','migrations']);
    require(o.schema==='setfarm.fresh-installation-origin.v1'&&o.systemIdentifier===expected.cluster.systemIdentifier
      &&o.sourceSha===expected.sourceSha&&p.committed===true&&p.catalogHash===v.observedSchemaCatalogHash
      &&Array.isArray(o.migrations)&&o.migrations.length===33&&Array.isArray(expected.migrations)&&expected.migrations.length===33);
    for(let index=0;index<33;index++){
      const m=probeOwnDataV1(o.migrations[index],['version','name','checksum','migrationClass']),e=expected.migrations[index];
      require(m.version===index+1&&m.migrationClass===(index===31?'guarded':'automatic')
        &&typeof m.name==='string'&&m.name.length>0&&probeHexV1(m.checksum)&&Object.keys(m).every(k=>m[k]===e[k]));
    }
    const directory=probeOwnDataV1(v.directory,['realpath','dev','ino','uid','gid','mode']);
    require(directory.realpath===expected.installationsDirectory+'/'+o.installationId&&v.selectedDirectory===directory.realpath);
    const result={installationId:o.installationId,operationId:o.operationId,directory:{dev:directory.dev,ino:directory.ino,
      uid:directory.uid,gid:directory.gid,mode:directory.mode},databaseName:o.databaseName,databaseOid:o.databaseOid,
      ownerRole:o.ownerRole,ownerOid:p.ownerOid,runtimeRole:o.runtimeRole,runtimeOid:p.runtimeOid,sourceSha:o.sourceSha,schemaCatalogHash:p.catalogHash};
    const pins=probeOwnDataV1(p.baseRecordPins,ownedCreatedRecordKeysV1);
    result.records=Object.fromEntries(ownedCreatedRecordKeysV1.map(key=>[key,ownedRecordV1(pins[key],key==='runtime-credentials.json'?4096:32768)]));
    const old=expected.installation;
    if(old!==null){
      const prior=ownedInstallationV1(old,false);
      for(const key of ['installationId','operationId','databaseName','databaseOid','ownerRole','ownerOid','runtimeRole','runtimeOid','sourceSha','schemaCatalogHash'])require(result[key]===prior[key]);
      require(Object.keys(result.directory).every(key=>result.directory[key]===prior.directory[key]));
      for(const key of ownedCreatedRecordKeysV1)require(result.records[key].bytes===prior.records[key].bytes&&result.records[key].sha256===prior.records[key].sha256);
    }
    if(stage==='activated'){
      const a=v.activation;require(a!==null&&a.acknowledged===true&&v.staleAbsenceRefused===true
        &&a.prepared.catalogHash===v.observedActivationCatalogHash&&a.prepared.catalogHash!==p.catalogHash
        &&JSON.stringify(a.prepared.directoryIdentity)===JSON.stringify(v.directory));
      // Stock records use canonical JSON key order; compare the actual facts,
      // not insertion order inherited from an earlier factory object.
      const activatedOrigin=probeOwnDataV1(a.prepared.origin,Object.keys(o));
      require(Object.keys(o).filter(key=>key!=='migrations').every(key=>activatedOrigin[key]===o[key])
        &&Array.isArray(activatedOrigin.migrations)&&activatedOrigin.migrations.length===33);
      for(let index=0;index<33;index++){
        const row=probeOwnDataV1(activatedOrigin.migrations[index],['version','name','checksum','migrationClass']);
        require(Object.keys(row).every(key=>row[key]===o.migrations[index][key]));
      }
      const activationPins=probeOwnDataV1(a.baseRecordPins,ownedCreatedRecordKeysV1);
      for(const key of ownedCreatedRecordKeysV1)require(activationPins[key].bytes===pins[key].bytes&&activationPins[key].sha256===pins[key].sha256);
      for(const key of ['schema-prepared.json','schema-committed.json'])require(a.prepared.schemaRecordPins[key].sha256===pins[key].sha256
        &&a.prepared.schemaRecordPins[key].bytes===pins[key].bytes);
      const returned=probeOwnDataV1(v.activationReturn,['schema','state','installationId','sourceSha','catalogHash']);
      require(returned.schema==='setfarm.fresh-installation-activation-verification.v1'&&returned.state==='activated'
        &&returned.installationId===o.installationId&&returned.sourceSha===o.sourceSha&&returned.catalogHash===a.prepared.catalogHash);
      result.activationCatalogHash=a.prepared.catalogHash;
      result.records['activation-prepared.json']=ownedRecordV1(a.preparedPin,32768);
      result.records['activated.json']=ownedRecordV1(a.activatedPin,32768);
    }else require(v.activation===null&&v.activationAbsenceObserved===true&&v.observedActivationCatalogHash===null&&v.activationReturn===null);
    return freezeOwnedDataV1(ownedInstallationV1(result,stage==='activated'));
  }catch{throw probeOwnerRefusalV1();}
}
function createManualOrphanPhaseSqlLedgerV1(){
  let pool=null,reserved=null,poolCaptured=false,reservationCaptured=false,pair=null,pending=null;
  let stopped=false,releaseAttempted=false,endAttempted=false,unknown=false,closed=false,closing=null;
  const clocks=[],mark=()=>{unknown=true;closed=false;};
  const sample=()=>{for(const item of clocks)item.clock.check(!item.done);};
  const current=()=>{sample();return Object.freeze({poolCaptured,reservationCaptured,pending:pending?.kind??null,
    stopped,releaseAttempted,endAttempted,unknown,closed,pair});};
  const refusal=()=>ownedTransportUnknownV1();
  const ready=()=>{sample();if(unknown||stopped||pending!==null){mark();throw refusal();}};
  async function collect(kind,start,retain){
    const item={clock:manualOrphanMonotonicClockV1(5000,mark,mark),done:false};clocks.push(item);
    // Cleanup still attempts end after preexisting faults, but a normal query
    // cannot start under an unavailable clock. Every started operation is joined.
    item.clock.check();if(unknown&&kind!=='end')throw refusal();
    const operation={kind,join:null};let timer=null,result,failed=false;
    pending=operation;
    try{
      let raw;
      try{raw=start();}catch{mark();failed=true;}
      if(!failed){
        operation.join=Promise.resolve(raw).then(value=>{if(retain)retain(value);return value;},()=>{mark();failed=true;});
        try{timer=setTimeout(mark,5000);}catch{mark();}
        result=await operation.join;
      }
    }catch{mark();}
    finally{
      item.clock.check();item.done=true;
      if(timer!==null)try{clearTimeout(timer);}catch{mark();}
      if(pending===operation)pending=null;sample();
    }
    if(unknown)throw refusal();return result;
  }
  const ownSql=`pg_backend_pid() AS pid,
    to_char(a.backend_start AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS "backendStartedAtUTC",
    a.datid::text AS datid,a.usesysid::text AS usesysid`;
  const identitySql=`SELECT ${ownSql},control.system_identifier::text AS "systemIdentifier",
    to_char(pg_postmaster_start_time() AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS "postmasterStartedAtUTC",
    current_setting('server_version_num') AS "serverVersionNum",host(inet_server_addr()) AS "serverAddress",
    inet_server_port() AS "serverPort",current_database() AS database,d.oid::text AS "databaseOid",d.datdba::text AS "ownerOid",
    current_user::text AS "currentUser",session_user::text AS "sessionUser",
    CASE WHEN current_user='postgres' THEN NULL ELSE r.oid::text END AS "runtimeOid"
    FROM pg_catalog.pg_stat_activity a JOIN pg_catalog.pg_database d ON d.oid=a.datid
    JOIN pg_catalog.pg_roles r ON r.oid=a.usesysid CROSS JOIN pg_catalog.pg_control_system() control WHERE a.pid=pg_backend_pid()`;
  const catalogSql={
    databases:`SELECT datname AS name,oid::float8 AS oid,datdba::float8 AS "ownerOid",datallowconn AS "allowConnections",datconnlimit AS "connectionLimit" FROM pg_catalog.pg_database ORDER BY datname COLLATE "C",oid LIMIT 5`,
    roles:`SELECT rolname AS name,oid::float8 AS oid,rolsuper AS superuser,rolinherit AS inherit,rolcreaterole AS "createRole",
      rolcreatedb AS "createDb",rolcanlogin AS login,rolreplication AS replication,rolbypassrls AS "bypassRls",rolconnlimit AS "connectionLimit",
      CASE WHEN rolvaliduntil IS NULL THEN NULL WHEN rolvaliduntil='infinity'::timestamptz THEN 'infinity'
      WHEN rolvaliduntil='-infinity'::timestamptz THEN '-infinity' ELSE to_char(rolvaliduntil AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') END AS "validUntilUTC"
      FROM pg_catalog.pg_roles ORDER BY rolname COLLATE "C",oid LIMIT 131`,
    memberships:`SELECT roleid::float8 AS "roleOid",member::float8 AS "memberOid",grantor::float8 AS "grantorOid",
      admin_option AS "adminOption",inherit_option AS "inheritOption",set_option AS "setOption" FROM pg_catalog.pg_auth_members ORDER BY roleid,member,grantor LIMIT 257`,
  };
  const rowKeys={databases:['name','oid','ownerOid','allowConnections','connectionLimit'],
    roles:['name','oid','superuser','inherit','createRole','createDb','login','replication','bypassRls','connectionLimit','validUntilUTC'],
    memberships:['roleOid','memberOid','grantorOid','adminOption','inheritOption','setOption']};
  return Object.freeze({
    capturePool(value){if(poolCaptured||stopped){mark();throw refusal();}pool=value;poolCaptured=true;},
    async reserve(){
      ready();if(!poolCaptured||reservationCaptured){mark();throw refusal();}
      try{
        await collect('reserve',()=>pool.reserve(),value=>{reserved=value;reservationCaptured=true;});
        if((typeof reserved!=='function'&&typeof reserved!=='object')||reserved===null
          ||typeof reserved.unsafe!=='function'||typeof reserved.release!=='function')throw refusal();
      }catch{mark();throw refusal();}
    },
    async query(kind,expected){
      ready();if(!reservationCaptured||!['identity','databases','roles','memberships'].includes(kind)
        ||(kind!=='identity'&&pair===null)){mark();throw refusal();}
      try{
        const sql=kind==='identity'?identitySql:`SELECT ${ownSql},COALESCE((SELECT json_agg(c) FROM (${catalogSql[kind]}) c),'[]'::json) AS rows FROM pg_catalog.pg_stat_activity a WHERE a.pid=pg_backend_pid()`;
        const result=await collect('query',()=>reserved.unsafe(sql));
        if(!Array.isArray(result)||result.length!==1)throw refusal();
        const row=result[0];
        if(kind==='identity'){
          const keys=['systemIdentifier','postmasterStartedAtUTC','serverVersionNum','serverAddress','serverPort','database','databaseOid',
            'ownerOid','currentUser','sessionUser','runtimeOid','pid','backendStartedAtUTC','datid','usesysid'];
          const normalized=Object.fromEntries(keys.map(key=>[key,row[key]]));
          const actual=validateManualOrphanPhaseIdentityV1([normalized],expected,pair);
          if(pair===null)pair=actual;return pair;
        }
        if(row.pid!==pair.pid||row.backendStartedAtUTC!==pair.backendStartedAtUTC
          ||row.datid!==String(pair.datid)||row.usesysid!==String(pair.usesysid)
          ||!Array.isArray(row.rows)||row.rows.length>({databases:4,roles:130,memberships:256}[kind]))throw refusal();
        const values=row.rows.map(value=>probeOwnDataV1(value,rowKeys[kind]));
        sample();if(unknown)throw refusal();return freezeOwnedDataV1(values);
      }catch{mark();throw refusal();}
    },
    close(){
      stopped=true;
      if(closing!==null)return closing.then(()=>{sample();if(unknown)throw refusal();});
      closing=(async()=>{
        // A pending reserve/query keeps custody until its real settlement,
        // including any late returned reservation; a deadline is not a join.
        const active=pending;if(active!==null&&active.join!==null)try{await active.join;}catch{mark();}
        // Let the operation's own completion/validation continuation finish.
        if(active!==null)await Promise.resolve();
        sample();
        if(poolCaptured&&!endAttempted){
          await collect('end',()=>{
            if(reservationCaptured&&!releaseAttempted){releaseAttempted=true;try{reserved.release();}catch{mark();}}
            endAttempted=true;return pool.end({timeout:5});
          }).catch(()=>{mark();});
        }
        sample();closed=!unknown&&poolCaptured&&endAttempted&&pending===null;
        if(unknown||!closed)throw refusal();
      })();return closing;
    },
    current,
    onclose(){if(!endAttempted)mark();},
  });
}
function captureManualOrphanPhaseDatabaseV1(actualDatabaseNamespace){
  const namespace=actualDatabaseNamespace;
  let closeAttempted=false,pending=false,unknown=false,closed=false,closing=null,clock=null,complete=false;
  const mark=()=>{unknown=true;closed=false;};
  const sample=()=>{if(clock!==null)clock.check(!complete);};
  const current=()=>{sample();return Object.freeze({closeAttempted,pending,unknown,closed});};
  return Object.freeze({current,close(){
    if(closing!==null)return closing.then(()=>{sample();if(unknown)throw ownedTransportUnknownV1();});
    // Allocate the outer promise before invoking fallible namespace properties.
    let finish,fail;closing=new Promise((resolve,reject)=>{finish=resolve;fail=reject;});
    clock=manualOrphanMonotonicClockV1(5000,mark,mark);clock.check();
    let timer=null,retained=null,getter,fulfilled=false;
    const fence=()=>{try{getter();mark();}catch(error){if(error?.message!=='FRESH_INSTALLATION_DATABASE_NOT_PREPARED'
      &&error?.message!=='FRESH_INSTALLATION_SELECTION_REFUSED')mark();}};
    closeAttempted=true;
    try{
      // Retain the actual returned promise BEFORE getter capture or fencing.
      const raw=namespace.pgClose();retained=Promise.resolve(raw);pending=true;
      getter=namespace.getSql;
      if(typeof getter!=='function')mark();else fence();
    }catch{mark();}
    if(retained!==null)try{timer=setTimeout(mark,5000);}catch{mark();}
    (async()=>{
      if(retained!==null){try{await retained;fulfilled=true;}catch{mark();}}
      sample();complete=true;pending=false;
      if(timer!==null)try{clearTimeout(timer);}catch{mark();}
      // No other public method is legal beyond this captured getter fence.
      if(fulfilled&&typeof getter==='function')fence();sample();
      closed=!unknown&&retained!==null;
      if(unknown||!closed)fail(ownedTransportUnknownV1());else finish();
    })().catch(()=>{mark();fail(ownedTransportUnknownV1());});
    return closing;
  }});
}

async function provisionManualOrphanOwnedPhaseV1(phase){
  const {frame,derived}=phase;
  const endpoint=deriveManualOrphanPhaseEndpointV1(frame.purpose,derived,frame.input,null);
  await phase.qualify(endpoint,null,null);
  const factory=await phase.load('factory');
  phase.check();phase.capacity();
  let owner;
  try{
    owner=await factory.createFreshInstallationV1({adminUrl:endpoint,baseDirectory:derived.installationsDirectory,
      sourceSha:phase.source.target.sha});
    phase.retainFactory(owner); // Before ANY returned property is inspected.
  }catch{phase.unknown();throw ownedTransportUnknownV1();}
  phase.check();
  if(owner===null||typeof owner!=='object'||typeof owner.initialize!=='function'
    ||typeof owner.verifyRuntime!=='function'||typeof owner.close!=='function')throw ownedTransportUnknownV1();
  const initialized=await phase.effect(()=>owner.initialize());
  phase.require(JSON.stringify(initialized)===JSON.stringify(owner.origin));
  const verification=await phase.effect(()=>owner.verifyRuntime());
  phase.require(verification===undefined);
  const prepared=phase.readPrepared(owner.directory,null);
  phase.require(owner.installationId===prepared.origin.installationId&&owner.directory===phase.directory
    &&owner.databaseName===prepared.origin.databaseName&&owner.ownerRole===prepared.origin.ownerRole
    &&owner.runtimeRole===prepared.origin.runtimeRole);
  const actualOrigin=probeOwnDataV1(owner.origin,['schema','installationId','operationId','systemIdentifier','databaseOid',
    'databaseName','ownerRole','runtimeRole','sourceSha','migrations']);
  phase.require(Object.keys(actualOrigin).filter(key=>key!=='migrations').every(key=>actualOrigin[key]===prepared.origin[key])
    &&Array.isArray(actualOrigin.migrations)&&actualOrigin.migrations.length===33);
  for(let index=0;index<33;index++)for(const key of ['version','name','checksum','migrationClass'])
    phase.require(actualOrigin.migrations[index][key]===prepared.origin.migrations[index][key]);
  const absent=phase.records.captureFreshInstallationActivationAbsenceV1(phase.directory);absent();
  const installation=phase.project('committed',null,null,true,false,null);
  // The same admin reservation/pair spans factory work; no qualification reconnect.
  await phase.catalog(installation);
  await phase.closeQualification();
  await phase.closeFactory();absent();phase.check();
  return {state:'schema-verified',installation,factoryOwnerClose:'fulfilled'};
}
async function activateManualOrphanOwnedPhaseV1(phase){
  const {frame,derived}=phase,installation=frame.input.installation;
  const prepared=phase.readPrepared(derived.installationsDirectory+'/'+installation.installationId,installation);
  const absent=phase.records.captureFreshInstallationActivationAbsenceV1(phase.directory);
  absent();phase.project('before-activation',installation,null,true,false,null);
  const endpoint=deriveManualOrphanPhaseEndpointV1(frame.purpose,derived,frame.input,prepared);
  await phase.qualify(endpoint,installation,null);
  await phase.closeQualification();
  const activation=await phase.load('activation');
  const selected=await phase.select(false);
  phase.require(selected.selection.freshInstallationSelectionV1.activation===null);
  selected.selection.assertFreshInstallationSelectionUnchangedV1();phase.unprepared(selected.database);
  absent();phase.check();phase.capacity();
  const returned=await phase.effect(()=>activation.activateFreshInstallationManifestAV1({directory:phase.directory,adminUrl:endpoint}));
  const verified=await phase.effect(()=>activation.verifyFreshInstallationActivationV1(phase.directory));
  phase.require(JSON.stringify(returned)===JSON.stringify(verified));
  phase.expectedRefusal(absent,'FRESH_INSTALLATION_RECORDS_REFUSED');
  phase.expectedRefusal(()=>selected.selection.assertFreshInstallationSelectionUnchangedV1(),'FRESH_INSTALLATION_SELECTION_REFUSED');
  const observed=phase.readActivation();
  const activated=phase.project('activated',installation,observed,false,true,verified);
  phase.check();await phase.closeDatabase();phase.check();
  return {state:'activation-verified',installation:activated,selectionBefore:'schema-committed-unactivated',
    selectionAfter:'stale-refused',databaseModuleClose:'fulfilled'};
}
async function oldEntryManualOrphanOwnedPhaseV1(phase){
  await phase.qualifyMechanical();
  await phase.select(false);
  await phase.prepareOldEntryTwice();
  await phase.closeDatabase();phase.check();
  return {state:'old-entry-verified',maintenance:phase.source.maintenance,target:phase.source.target,
    installationId:phase.frame.input.installation.installationId,sameClient:true,entryAssert:true,databaseAssert:true,
    close:'fulfilled',closedGetter:'refused'};
}
async function newEntryManualOrphanOwnedPhaseV1(phase){
  await phase.qualifyMechanical();
  phase.require(phase.source.maintenance.sha!==phase.prepared.origin.sourceSha
    &&phase.prepared.origin.sourceSha===phase.source.target.sha);
  const {database,entry}=await phase.select(true);
  phase.unprepared(database);phase.check();
  // Only this actual public invocation is the expected negative. Loader,
  // selection, record and qualification failures cannot satisfy the case.
  let refused=false;
  try{await entry.prepareFreshInstallationOperationalEntryV1();}
  catch(error){if(error?.message==='FRESH_INSTALLATION_OPERATIONAL_ENTRY_REFUSED')refused=true;
    else{phase.unknown();throw ownedTransportUnknownV1();}}
  phase.check();
  if(!refused)throw Error('MANUAL_ORPHAN_CASE_REFUSED');
  await phase.closeDatabase();phase.check();
  return {state:'source-mismatch-refused',maintenance:phase.source.maintenance,target:phase.source.target,
    installationId:phase.frame.input.installation.installationId,mismatch:'maintenance-sha-vs-target-origin',
    close:'fulfilled',closedGetter:'refused'};
}

async function runManualOrphanOwnedPhaseV1(context,frame,policy){
  // This is the sole construction site for the private phase context. Its
  // first gate intentionally precedes Source/process/native/package access.
  const admitted=requireManualOrphanOwnedHelperContextV1(context,frame,policy);
  const claim=ownedInherited4ClaimV1;
  if(claim===null||claim.uncertain||claim.outputUncertain||!claim.actualCloseSeen)throw ownedTransportUnknownV1();
  let holder=null,pins=null,resources=null,derived=null,observations=null;
  let unknown=false,finished=false,selectedDirectory=null,selectionMade=false;
  let sql=null,qualified=false,expectedIdentity=null,databaseClose=null,factory=null,factoryClose=null;
  let factoryCloseAttempted=false,prepared=null,directory=null,records=null,migrations=null;
  let activationState=null,result=null,failure=null,purposeTimer=null;
  const operationClocks=[],aliases=[],moduleCache=new Map();
  const initialEnvironment=Object.fromEntries(Object.keys(process.env).map(key=>[key,process.env[key]]));
  const burn=()=>{unknown=true;};
  const require=value=>{if(!value)throw probeOwnerRefusalV1();};
  const clock=manualOrphanMonotonicClockV1(ownedChildPoliciesV1[frame.purpose].deadline,burn,burn);
  const sample=()=>{
    clock.check(!finished);for(const operation of operationClocks)operation.clock.check(!operation.complete);
    if(claim.uncertain||claim.outputUncertain||ownedSourceCleanupUncertainV1)burn();
    if(sql?.current().unknown||databaseClose?.current().unknown)burn();
    if(unknown)throw ownedTransportUnknownV1();
  };
  const contextCurrent=()=>{
    const account=userInfo();
    require(account.homedir==='/Users/setrox'&&account.uid===501&&account.gid===20
      &&process.getuid()===501&&process.geteuid()===501&&process.getgid()===20&&process.getegid()===20
      &&process.platform==='darwin'&&process.arch==='arm64'&&process.version==='v26.4.0'
      &&process.execPath===admitted.node&&process.argv0===admitted.node&&process.execArgv.length===0
      &&process.argv.length===2&&process.argv[0]===admitted.node&&process.argv[1]===admitted.helper
      &&process.cwd()===admitted.maintenanceRoot&&process.pid===frame.child.pid&&process.ppid===frame.parent.pid);
    const keys=Object.keys(process.env),expected=Object.keys(initialEnvironment);
    require(keys.length===expected.length+(selectionMade?1:0)
      &&expected.every(key=>process.env[key]===initialEnvironment[key])
      &&keys.every(key=>Object.hasOwn(initialEnvironment,key)||(selectionMade&&key==='SETFARM_INSTALLATION_DIR'))
      &&(!selectionMade||process.env.SETFARM_INSTALLATION_DIR===selectedDirectory));
  };
  const localPhaseCheck=()=>{
    try{
      sample();contextCurrent();pins?.check();
      for(const alias of aliases){const stat=fs.lstatSync(alias.path,{bigint:true});
        require(stat.isSymbolicLink()&&ownedSourceSameV1(alias.stat,stat,true)&&fs.readlinkSync(alias.path)===alias.text
          &&fs.realpathSync(alias.path)===alias.physical);}
      if(observations!==null){
        const now={};for(const key of ['constructor','runner','parent','child','server']){
          now[key]=observeManualOrphanProcessV1(observations[key].pin.pid);
          require(sameProbeObservationV1(now[key],observations[key]));
        }
        checkManualOrphanPhaseGraphV1(frame,now,derived);
      }
      prepared?.assertUnchanged();activationState?.assertUnchanged();sample();
    }catch(error){if(holder!==null)burn();throw unknown?ownedTransportUnknownV1():error;}
  };
  const check=()=>{
    try{localPhaseCheck();holder?.check();localPhaseCheck();}
    catch(error){if(holder!==null)burn();throw unknown?ownedTransportUnknownV1():error;}
  };
  // All started calls are awaited to settlement. A purpose/deadline fault may
  // prevent the next effect, but cannot discard this actual pending promise.
  const effect=async start=>{
    check();require(qualified);let value;
    try{value=await start();}catch{burn();throw ownedTransportUnknownV1();}
    check();return value;
  };
  const joinClose=async start=>{
    const item={clock:manualOrphanMonotonicClockV1(5000,burn,burn),complete:false};operationClocks.push(item);
    let timer=null;
    try{
      item.clock.check();const pending=Promise.resolve(start());
      try{timer=setTimeout(burn,5000);}catch{burn();}
      await pending;
    }catch{burn();}
    finally{item.clock.check();item.complete=true;if(timer!==null)try{clearTimeout(timer);}catch{burn();}}
    sample();
  };
  const closeFactory=async()=>{
    if(factory===null)return;
    if(factoryClose===null){
      // Allocate before reading close, retain the one actual owner even if its
      // property is malformed. No retry after a thrown close or partial factory.
      factoryClose=(async()=>{if(factoryCloseAttempted){burn();throw ownedTransportUnknownV1();}
        factoryCloseAttempted=true;await joinClose(()=>factory.close());})();
    }
    await factoryClose;sample();
  };
  const closeQualification=async()=>{if(sql!==null){await sql.close();require(sql.current().closed);sample();}};
  const closeDatabase=async()=>{if(databaseClose!==null){await databaseClose.close();require(databaseClose.current().closed);sample();}};
  const detach=value=>JSON.parse(JSON.stringify(value));
  const directoryData=stat=>({dev:String(stat.dev),ino:String(stat.ino),uid:Number(stat.uid),gid:Number(stat.gid),mode:Number(stat.mode&0o7777n)});
  const privateDirectory=(locator,wanted)=>{
    const stat=pins.directory(locator),data=directoryData(stat);
    require(stat.uid===501n&&stat.gid===20n&&(stat.mode&0o7777n)===0o700n);
    if(wanted)require(Object.keys(data).every(key=>wanted[key]===data[key]));return data;
  };
  const capacity=()=>{const space=fs.statfsSync(derived.physicalRoot,{bigint:true});
    require(space.bavail*space.bsize>=8n*1024n**3n+64n*1024n**2n);};
  const loadNamespaceLocal=async key=>{
    localPhaseCheck();
    const paths={factory:admitted.targetRoot+'/dist/installation/fresh-installation-v1.js',
      records:admitted.targetRoot+'/dist/installation/fresh-installation-records-v1.js',
      migrations:admitted.targetRoot+'/dist/db/contract-spine-migrations.js',
      activation:admitted.targetRoot+'/dist/installation/fresh-installation-activation-v1.js',
      postgres:admitted.targetRoot+'/node_modules/postgres/src/index.js',
      targetDatabase:admitted.targetRoot+'/dist/db-pg.js',targetEntry:admitted.targetRoot+'/dist/installation/fresh-installation-entry-v1.js',
      targetSelection:admitted.targetRoot+'/dist/installation/fresh-installation-selection-v1.js',
      maintenanceDatabase:admitted.maintenanceRoot+'/dist/db-pg.js',maintenanceEntry:admitted.maintenanceRoot+'/dist/installation/fresh-installation-entry-v1.js',
      maintenanceSelection:admitted.maintenanceRoot+'/dist/installation/fresh-installation-selection-v1.js'};
    require(Object.hasOwn(paths,key));
    if(moduleCache.has(key))return moduleCache.get(key);
    const actual=await import(pathToFileURL(paths[key]).href);
    // Database namespace custody precedes any checkpoint or property access.
    if(key==='targetDatabase'||key==='maintenanceDatabase'){
      require(databaseClose===null);databaseClose=captureManualOrphanPhaseDatabaseV1(actual);
    }
    moduleCache.set(key,actual);localPhaseCheck();return actual;
  };
  const load=async key=>{check();const actual=await loadNamespaceLocal(key);check();return actual;};
  const loadRecordsAndMigrations=async()=>{
    check();capacity();const actualRecords=await loadNamespaceLocal('records');check();records=actualRecords;
    const journal=await loadNamespaceLocal('migrations');
    const actualMigrations=detach(journal.getContractSpineCurrentHeadJournalIdentitiesV1());
    require(actualMigrations.length===33);check();migrations=actualMigrations;
  };
  const recordPins=(names,expected)=>{
    for(const name of names){
      const file=pins.file(directory+'/'+name,name==='runtime-credentials.json'?4096:32768);
      require(file.stat.uid===501n&&file.stat.gid===20n&&(file.stat.mode&0o7777n)===0o600n
        &&file.bytes.length===expected[name].bytes&&file.sha256===expected[name].sha256);
    }
  };
  const readPreparedLocal=(locator,installation)=>{
    localPhaseCheck();require(typeof locator==='string'&&path.dirname(locator)===derived.installationsDirectory
      &&ownedUuidV1(path.basename(locator))&&(directory===null||directory===locator));
    directory=locator;privateDirectory(directory,installation?.directory);
    const actual=records.readFreshInstallationPreparedStateV1(directory,true);
    prepared=actual; // Retain the actual stock unchanged assertion as well as DATA.
    require(prepared.origin.installationId===path.basename(directory)&&prepared.origin.sourceSha===holder.source.target.sha);
    recordPins(ownedCreatedRecordKeysV1,prepared.baseRecordPins);prepared.assertUnchanged();localPhaseCheck();return prepared;
  };
  const readActivationLocal=()=>{
    localPhaseCheck();const actual=records.readFreshInstallationActivationStateV1(directory,'required');activationState=actual;
    require(actual!==null&&actual.acknowledged===true);
    recordPins(['activation-prepared.json','activated.json'],{'activation-prepared.json':actual.preparedPin,'activated.json':actual.activatedPin});
    actual.assertUnchanged();localPhaseCheck();return actual;
  };
  const readPrepared=(locator,installation)=>{check();const actual=readPreparedLocal(locator,installation);check();return actual;};
  const readActivation=()=>{check();const actual=readActivationLocal();check();return actual;};
  const readPreparedAndActivationForMechanical=()=>{
    check();const installation=frame.input.installation;
    const p=readPreparedLocal(derived.installationsDirectory+'/'+installation.installationId,installation);
    const active=readActivationLocal();check();return {prepared:p,activation:active};
  };
  const project=(stage,installation,activation,absence,stale,returned)=>{
    check();const p={};for(const key of ['origin','catalogHash','ownerOid','runtimeOid','runtimeUrl','committed','baseRecordBytes','baseRecordPins'])p[key]=prepared[key];
    const view={prepared:detach(p),directory:{realpath:directory,...privateDirectory(directory,installation?.directory)},
      activation:activation===null?null:detach({prepared:activation.prepared,preparedPin:activation.preparedPin,activatedPin:activation.activatedPin,
        acknowledged:activation.acknowledged,baseRecordPins:activation.baseRecordPins}),
      observedSchemaCatalogHash:prepared.catalogHash,observedActivationCatalogHash:activation?.prepared.catalogHash??null,
      activationAbsenceObserved:absence,staleAbsenceRefused:stale,selectedDirectory:directory,activationReturn:returned};
    return projectManualOrphanPhaseInstallationV1(view,{cluster:frame.cluster,sourceSha:holder.source.target.sha,migrations,
      installationsDirectory:derived.installationsDirectory,installation},stage);
  };
  const queryLocal=async(kind,expected)=>{localPhaseCheck();const value=await sql.query(kind,expected);localPhaseCheck();return value;};
  const readPhaseCatalogFactsLocal=async installation=>{
    require(sql!==null&&expectedIdentity!==null);
    const databases=await queryLocal('databases'),roles=await queryLocal('roles'),memberships=await queryLocal('memberships');
    const canonical=validateManualOrphanPhaseBaselineV1({databases,roles,memberships},frame.cluster,installation);
    // The baseline digests authenticate these independent exact names/security
    // facts. Initial admin OIDs must JOIN the already retained own pair.
    const pair=sql.current().pair,db=canonical.databases.filter(row=>row.name==='postgres'),role=canonical.roles.filter(row=>row.name==='postgres');
    require(db.length===1&&role.length===1&&db[0].ownerOid===role[0].oid&&db[0].allowConnections===true
      &&db[0].connectionLimit===-1&&role[0].superuser===true&&role[0].inherit===true&&role[0].createRole===true
      &&role[0].createDb===true&&role[0].login===true&&role[0].replication===true&&role[0].bypassRls===true
      &&role[0].connectionLimit===-1&&role[0].validUntilUTC===null);
    if(expectedIdentity.currentRole==='postgres'){
      require(pair.datid===db[0].oid&&pair.usesysid===role[0].oid);
      if(expectedIdentity.databaseOid===null)expectedIdentity=Object.freeze({...expectedIdentity,databaseOid:pair.datid,ownerOid:pair.usesysid,userOid:pair.usesysid});
      else require(expectedIdentity.databaseOid===pair.datid&&expectedIdentity.ownerOid===pair.usesysid&&expectedIdentity.userOid===pair.usesysid);
    }
    await queryLocal('identity',expectedIdentity);localPhaseCheck();return canonical;
  };
  const catalog=async installation=>{check();const actual=await readPhaseCatalogFactsLocal(installation);check();return actual;};
  const qualify=async(endpoint,installation,runtime)=>{
    require(sql===null&&!qualified);check();
    const driver=await loadNamespaceLocal('postgres');check();require(typeof driver.default==='function');
    sql=createManualOrphanPhaseSqlLedgerV1();
    let pool;
    try{pool=driver.default(endpoint,{max:1,connect_timeout:5,idle_timeout:0,max_lifetime:0,
      connection:{statement_timeout:5000,lock_timeout:5000},onclose:sql.onclose,onnotice(){}});
      sql.capturePool(pool);
    }catch{burn();throw ownedTransportUnknownV1();}
    check();await sql.reserve();localPhaseCheck();
    expectedIdentity=Object.freeze(runtime===null?{cluster:frame.cluster,databaseName:'postgres',databaseOid:null,ownerOid:null,
      currentRole:'postgres',sessionRole:'postgres',runtimeOid:null,userOid:null}:{cluster:frame.cluster,
      databaseName:installation.databaseName,databaseOid:installation.databaseOid,ownerOid:installation.ownerOid,
      currentRole:installation.runtimeRole,sessionRole:installation.runtimeRole,runtimeOid:installation.runtimeOid,userOid:installation.runtimeOid});
    await queryLocal('identity',expectedIdentity);
    // No phase/effect token is enabled by the provisional identity above.
    await readPhaseCatalogFactsLocal(installation);check();qualified=true;
  };
  const expectedRefusal=(call,code)=>{let refused=false;try{call();}catch(error){refused=error?.message===code;}
    if(!refused)throw Error('MANUAL_ORPHAN_CASE_REFUSED');};
  const unprepared=namespace=>expectedRefusal(()=>namespace.getSql(),'FRESH_INSTALLATION_DATABASE_NOT_PREPARED');
  const verifyMechanicalActivation=async()=>{
    check();
    const activation=await loadNamespaceLocal('activation');
    localPhaseCheck();localPhaseCheck();
    check();require(qualified);let verified;
    try{verified=await activation.verifyFreshInstallationActivationV1(directory);}
    catch{burn();throw ownedTransportUnknownV1();}
    check();return verified;
  };
  const prepareOldEntryTwice=async()=>{
    require(frame.purpose==='old_entry_positive'&&selectionMade);
    const database=moduleCache.get('targetDatabase'),entry=moduleCache.get('targetEntry');
    unprepared(database);
    localPhaseCheck();localPhaseCheck();
    await effect(()=>entry.prepareFreshInstallationOperationalEntryV1());
    const first=database.getSql();
    require(first!==null&&(typeof first==='function'||typeof first==='object'));
    entry.assertFreshInstallationOperationalEntryV1();database.assertSelectedFreshInstallationOperationalDatabaseV1();
    require(database.getSql()===first);
    localPhaseCheck();localPhaseCheck();
    await effect(()=>entry.prepareFreshInstallationOperationalEntryV1());
    entry.assertFreshInstallationOperationalEntryV1();database.assertSelectedFreshInstallationOperationalDatabaseV1();
    require(database.getSql()===first);check();
  };
  const qualifyMechanical=async()=>{
    const installation=frame.input.installation;
    const {prepared:p,activation:active}=readPreparedAndActivationForMechanical();
    // The real stock verifier below supplies the mechanical return observation.
    // Complete SQL identity/baseline qualification closes first.
    const endpoint=deriveManualOrphanPhaseEndpointV1(frame.purpose,derived,frame.input,p);
    await qualify(endpoint,installation,p);await closeQualification();
    const verified=await verifyMechanicalActivation();
    // A fresh mechanical phase never had an unactivated absence snapshot.
    // Join actual authenticated observations directly; do not fabricate the
    // transition-only staleAbsenceRefused input of the activation projector.
    const carried=ownedInstallationV1(installation,true),origin=p.origin;
    for(const key of ['installationId','operationId','databaseName','databaseOid','ownerRole','runtimeRole','sourceSha'])
      require(origin[key]===carried[key]);
    require(origin.systemIdentifier===frame.cluster.systemIdentifier&&p.ownerOid===carried.ownerOid
      &&p.runtimeOid===carried.runtimeOid&&p.catalogHash===carried.schemaCatalogHash
      &&active.prepared.catalogHash===carried.activationCatalogHash&&p.catalogHash!==active.prepared.catalogHash
      &&origin.migrations.length===33&&migrations.length===33);
    for(let index=0;index<33;index++)for(const key of ['version','name','checksum','migrationClass'])
      require(origin.migrations[index][key]===migrations[index][key]);
    const identity={realpath:directory,...privateDirectory(directory,carried.directory)};
    require(JSON.stringify(active.prepared.origin)===JSON.stringify(origin)
      &&JSON.stringify(active.prepared.directoryIdentity)===JSON.stringify(identity));
    for(const name of ownedCreatedRecordKeysV1){
      require(p.baseRecordPins[name].bytes===carried.records[name].bytes&&p.baseRecordPins[name].sha256===carried.records[name].sha256
        &&active.baseRecordPins[name].bytes===carried.records[name].bytes&&active.baseRecordPins[name].sha256===carried.records[name].sha256);
    }
    for(const name of ['schema-prepared.json','schema-committed.json'])require(active.prepared.schemaRecordPins[name].bytes===carried.records[name].bytes
      &&active.prepared.schemaRecordPins[name].sha256===carried.records[name].sha256);
    for(const [name,pin] of [['activation-prepared.json',active.preparedPin],['activated.json',active.activatedPin]])
      require(pin.bytes===carried.records[name].bytes&&pin.sha256===carried.records[name].sha256);
    const receipt=probeOwnDataV1(verified,['schema','state','installationId','sourceSha','catalogHash']);
    require(receipt.schema==='setfarm.fresh-installation-activation-verification.v1'&&receipt.state==='activated'
      &&receipt.installationId===carried.installationId&&receipt.sourceSha===carried.sourceSha&&receipt.catalogHash===carried.activationCatalogHash);
    check();
  };
  const select=async maintenance=>{
    require(qualified&&sql?.current().closed&&!selectionMade&&prepared!==null);check();
    selectionMade=true;selectedDirectory=directory;process.env.SETFARM_INSTALLATION_DIR=directory;
    check();
    const prefix=maintenance?'maintenance':'target';
    const database=await loadNamespaceLocal(prefix+'Database');check();
    const selection=await loadNamespaceLocal(prefix+'Selection');
    const selected=selection.freshInstallationSelectionV1;
    require(selected!==null&&selected.directory===directory);selection.assertFreshInstallationSelectionUnchangedV1();
    check();
    let entry=null;
    if(frame.purpose!=='activate'){entry=await loadNamespaceLocal(prefix+'Entry');check();}
    return {database,selection,entry};
  };
  try{
    clock.check();sample();
    try{purposeTimer=setTimeout(burn,ownedChildPoliciesV1[frame.purpose].deadline);}catch{burn();}
    sample();holder=await holdManualOrphanOwnedSourcesV1();
    // Returned Source is retained before any shape/source/property inspection.
    sample(); // A fault during Source acquisition forbids subsequent native work.
    require(holder!==null&&typeof holder.check==='function'&&typeof holder.close==='function');
    require(JSON.stringify(ownedSourcesV1(holder.source))===JSON.stringify(frame.source));
    resources=ownedSourceResourcesV1();pins=ownedSourcePinsV1(resources,'/Users/setrox');
    const alias=(locator,physical,text,uid)=>{
      const stat=fs.lstatSync(locator,{bigint:true});
      require(stat.isSymbolicLink()&&stat.uid===uid&&stat.nlink===1n&&fs.readlinkSync(locator)===text&&fs.realpathSync(locator)===physical);
      aliases.push({path:locator,physical,text,stat});
    };
    const pgAlias='/opt/homebrew/opt/postgresql@17',pgText=fs.readlinkSync(pgAlias);
    require(/^\.\.\/Cellar\/postgresql@17\/17\.[0-9]+(?:_[0-9]+)?$/.test(pgText));
    const pgPhysical=path.resolve(path.dirname(pgAlias),pgText);alias(pgAlias,pgPhysical,pgText,501n);
    const native=pins.file(pgPhysical+'/bin/postgres',536870912);
    require((native.stat.mode&0o111n)!==0n);
    const tmpText=fs.readlinkSync('/tmp');require(tmpText==='private/tmp'||tmpText==='/private/tmp');
    alias('/tmp','/private/tmp',tmpText,0n);
    const tmp=pins.directory('/private/tmp');require(tmp.uid===0n&&(tmp.mode&0o7777n)===0o1777n);
    observations={};for(const key of ['constructor','runner','parent','child','server'])observations[key]=observeManualOrphanProcessV1(frame[key].pid);
    const match=/^\/opt\/homebrew\/opt\/postgresql@17\/bin\/postgres -D (\/tmp\/setfarm-task6a-pg\.[A-Za-z0-9]+)\/data -h 127\.0\.0\.1 -p ([0-9]+) -k /.exec(observations.server.rawCommand);
    require(match!==null);const root=match[1],physicalRoot='/private'+root;
    derived={...admitted,nativeTools:{postgres:{path:pgPhysical+'/bin/postgres',sha256:native.sha256}},
      root,physicalRoot,dataDirectory:root+'/data',port:Number(match[2]),installationsDirectory:physicalRoot+'/installations'};
    derived=checkManualOrphanPhaseGraphV1(frame,observations,derived);
    privateDirectory(physicalRoot,frame.cluster.root);privateDirectory(physicalRoot+'/data',frame.cluster.data);
    privateDirectory(derived.installationsDirectory,frame.installations);
    await loadRecordsAndMigrations();
    const phase={frame,derived,source:holder.source,records,require,check,capacity,load,effect,unknown:burn,
      qualify,catalog,closeQualification,closeDatabase,closeFactory,readPrepared,readActivation,project,
      qualifyMechanical,select,prepareOldEntryTwice,unprepared,expectedRefusal,
      retainFactory(value){require(factory===null);factory=value;},get prepared(){return prepared;},get directory(){return directory;}};
    if(frame.purpose==='provision')result=await provisionManualOrphanOwnedPhaseV1(phase);
    else if(frame.purpose==='activate')result=await activateManualOrphanOwnedPhaseV1(phase);
    else if(frame.purpose==='old_entry_positive')result=await oldEntryManualOrphanOwnedPhaseV1(phase);
    else if(frame.purpose==='new_entry_refusal')result=await newEntryManualOrphanOwnedPhaseV1(phase);
    else throw probeFrameRefusalV1();
    check();
  }catch(error){
    if(sql!==null&&!sql.current().closed)burn();
    failure=manualOrphanEntryErrorV1(error,policy);
  }
  finally{
    // Every acquired obligation gets its one safe cleanup attempt even after a
    // failed checkpoint. No DROP, retry, reconnect, cancellation or state reset.
    for(const close of [closeQualification,closeFactory,closeDatabase])try{await close();}catch{burn();}
    if(holder!==null)try{check();}catch{burn();}
    if(resources!==null)try{resources.close();}catch{burn();}
    if(holder!==null)try{holder.close();}catch{burn();}
    clock.check();finished=true;
    if(purposeTimer!==null)try{clearTimeout(purposeTimer);}catch{burn();}
    try{sample();}catch{burn();}
  }
  if(unknown)throw ownedTransportUnknownV1();
  if(failure)throw failure;
  sample();
  return decodeManualOrphanOwnedPhaseResultV1(encodeManualOrphanOwnedPhaseResultV1({
    schema:'setfarm.manual-orphan-owned-phase-result.v1',run:frame.run,purpose:frame.purpose,
    frameSha256:ownedSourceHashV1(encodeManualOrphanOwnedPhaseFrameV1(frame)),pid:process.pid,parentPid:process.ppid,
    fd4Closed:true,sourcePinsClosed:true,result}));
}
