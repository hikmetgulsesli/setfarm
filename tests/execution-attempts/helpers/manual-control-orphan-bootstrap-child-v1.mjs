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
function ownedSourcePinsV1(resources,home){
  const directories=new Map(),files=new Map(),absences=new Set();
  const physical=locator=>ownedSourceRequireV1(fs.realpathSync(locator)===locator);
  const checkDirectory=pin=>{
    physical(pin.path);
    const named=fs.lstatSync(pin.path,{bigint:true}),held=fs.fstatSync(pin.fd,{bigint:true});
    ownedSourceRequireV1(named.isDirectory()&&!named.isSymbolicLink()&&held.isDirectory()&&!held.isSymbolicLink()
      &&ownedSourceSameV1(pin.stat,named,false,!!pin.members)&&ownedSourceSameV1(pin.stat,held,false,!!pin.members));
    if(pin.members)ownedSourceRequireV1(JSON.stringify(fs.readdirSync(pin.path).sort())===JSON.stringify(pin.members));
  };
  const directory=(locator,tree=false)=>{
    resources.guard();ownedSourceRequireV1(path.isAbsolute(locator)&&path.normalize(locator)===locator);
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
  const bytes=pin=>{
    resources.guard();physical(pin.path);
    const metadata=()=>{
      const named=fs.lstatSync(pin.path,{bigint:true}),held=fs.fstatSync(pin.fd,{bigint:true});
      ownedSourceRequireV1(named.isFile()&&!named.isSymbolicLink()&&held.isFile()&&!held.isSymbolicLink()
        &&ownedSourceSameV1(pin.stat,named,true)&&ownedSourceSameV1(pin.stat,held,true));
    };
    metadata();const result=Buffer.alloc(Number(pin.stat.size));let offset=0;
    while(offset<result.length){
      const wanted=Math.min(65536,result.length-offset),n=fs.readSync(pin.fd,result,offset,wanted,offset);
      ownedSourceRequireV1(Number.isSafeInteger(n)&&n>0&&n<=wanted);offset+=n;
    }
    ownedSourceRequireV1(fs.readSync(pin.fd,Buffer.alloc(1),0,1,offset)===0);metadata();
    const digest=ownedSourceHashV1(result);
    if(pin.sha256!==undefined)ownedSourceRequireV1(digest===pin.sha256);
    else pin.sha256=digest;
    return result;
  };
  const file=(locator,cap=16777216,device,system=false)=>{
    resources.guard();directory(path.dirname(locator));physical(locator);
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
      resources.add(()=>fs.closeSync(fd));pin={path:locator,fd,stat,sha256:undefined};files.set(locator,pin);
    }
    ownedSourceRequireV1(pin.stat.size<=BigInt(cap)&&(device===undefined||pin.stat.dev===device));
    return {bytes:bytes(pin),stat:pin.stat,sha256:pin.sha256};
  };
  const absent=locator=>{
    resources.guard();ownedSourceRequireV1(path.isAbsolute(locator)&&path.normalize(locator)===locator);
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
  return {directory,file,absent,check(){
    resources.guard();for(const pin of directories.values())checkDirectory(pin);
    for(const pin of files.values())bytes(pin);
    for(const locator of absences){
      try{fs.lstatSync(locator,{bigint:true});}catch(error){if(error?.code==='ENOENT')continue;throw error;}
      throw ownedSourceRefusalV1();
    }
  }};
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
      ownedSourceRequireV1(ownedSourceSameV1(directory,actual));pins.file(path.join(root,member),16777216,device);
    }
  }
  for(const locator of absences){ownedSourceRequireV1(ownedSourceLocatorV1(locator));pins.absent(path.join(root,locator));}
  const run=(phase,accountHome)=>{
    recheck();pins.check();const input=JSON.stringify({phase,edges:groups.map(({row})=>[row[0],path.join(root,row[1]),row[2]])});
    ownedSourceRequireV1(Buffer.byteLength(input)<=1048576);
    const child=spawnSync(ownedNodeV1,['--experimental-import-meta-resolve','--input-type=module','-e',ownedResolutionProgramV1],{
      input,encoding:'utf8',cwd:root,shell:false,timeout:5000,maxBuffer:1048576,
      env:{PATH:'/usr/bin:/bin',LANG:'C',LC_ALL:'C',...(accountHome?{HOME:home}:{})},
    });
    recheck();pins.check();ownedSourceRequireV1(!child.error&&!child.signal&&child.status===0&&child.stderr===''
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
  recheck();pins.check();
}

export async function holdManualOrphanOwnedSourcesV1(){
  if(arguments.length||ownedSourceCleanupUncertainV1)throw ownedSourceRefusalV1();
  const resources=ownedSourceResourcesV1();let invalid=false,closed=false,ready=false;
  const owners=[],observers=[];let identityCheck=()=>{},contextCheck=()=>{};
  let pins;
  const cleanup=()=>{closed=true;resources.close();};
  const check=()=>{
    try{
      ownedSourceRequireV1(!closed&&!invalid);resources.guard();contextCheck();pins?.check();
      for(const owner of owners)owner.check();identityCheck();
      for(const observer of observers){const actual=observer.read();ownedSourceRequireV1(ownedSourceEqualBuildV1(actual,observer.expected));}
      pins?.check();contextCheck();
    }catch{invalid=true;throw ownedSourceRefusalV1();}
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
    pins=ownedSourcePinsV1(resources,home);const device=pins.directory(maintenanceRoot).dev;
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
    identityCheck=()=>{
      ownedSourceRequireV1(common(maintenanceRoot)===maintenanceCommon&&common(targetRoot)===targetCommon);
    };
    const maintenanceGroups=profile.targetResolution.map(group=>({row:[...group.row],members:[...group.members]}));
    const targetGroups=profile.targetResolution.map(group=>({row:[...group.row],members:[...group.members]}));
    targetGroups[7].members.push('dist/installation/fresh-installation-activation-v1.js');
    targetGroups[10].members.push('dist/product-compiler/artifact-index.js','dist/product-compiler/artifact-store-authority.js');
    for(const [root,output,groups,roots,count,sites] of [
      [maintenanceRoot,maintenanceOutput,maintenanceGroups,ownedOrdinaryRootsV1,143,82],
      [targetRoot,targetOutput,targetGroups,ownedSetupRootsV1,153,85],
    ]){
      const graph=ownedSourceGraphV1(root,output,roots,groups,(locator)=>compiled(root,output,locator));
      ownedSourceRequireV1(graph.files.size===count&&graph.members.size===sites
        &&ownedSourceSetEqualV1(graph.files,root===maintenanceRoot?ordinaryFiles:setupFiles));
      const observer=ownedSourceGraphV1(root,output,[ownedObserverV1],profile.maintenanceObserver.resolution,
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
      ownedSourceRequireV1(ownedSourceEqualBuildV1(read(),expected));observers.push({read,expected});check();
    }
    const source=Object.freeze({maintenance:maintenance.expected,target:target.expected,
      profileSha256:ownedSourceHashV1(profileBytes),files:Object.freeze(comparisonFiles)});
    // Validate the exact public data shape without granting codec data authority.
    ownedSourcesV1(source);check();ready=true;
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
function observeManualOrphanChildV1(child,policy){
  const owned=policy.owned;
  let state=owned&&policy.purpose===null?'unknown':'pending',reason=state==='unknown'?'purpose':null;
  let exit=null,close=null,exitCount=0,closeCount=0,spawned=false;
  let timer=null,timerCleared=false,historyResolved=false,resolveHistory,bindingComplete=false,timelyComplete=false,clock=null;
  const settled=new Promise(resolve=>{resolveHistory=resolve;});
  const makeOutput=()=>({bytes:0,hash:null,hashUnavailable:false,end:false,close:false,chunks:[],retained:0});
  const stdout=makeOutput(),stderr=makeOutput(),fd4={finish:false,end:false,close:false};
  const markUnknown=code=>{if(state!=='unknown'){state='unknown';reason=code;}};
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
    settle();return {stdout:Buffer.concat(stdout.chunks,stdout.retained),stderr:Buffer.concat(stderr.chunks,stderr.retained)};
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
    ['end',()=>{checkClock();const invalid=channel.end||channel.close;channel.end=true;if(invalid)fail(name);settle();}],
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
function manualOrphanFd4ClaimV1(){
  return {attempted:true,adopted:false,rawCloseAttempted:false,socketCloseRequested:false,actualCloseSeen:false,uncertain:false};
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
    process.exitCode=1;
    if(!unknownWritten){
      unknownWritten=true;
      try{process.stderr.write(unknownError().message+'\n');}catch{}
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

function manualOrphanEntryErrorV1(error,policy){
  if(error?.message==='MANUAL_ORPHAN_CHILD_UNKNOWN'||error?.message==='MANUAL_ORPHAN_CLEANUP_UNKNOWN')return policy.unknown();
  if(error?.message==='MANUAL_ORPHAN_FRAME_REFUSED')return probeFrameRefusalV1();
  if(error?.message==='MANUAL_ORPHAN_SETUP_REFUSED')return Error('MANUAL_ORPHAN_SETUP_REFUSED');
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
    output=probeChildOutputV1(()=>policy.unknown());
    const context=probeLaunchContextV1();policy=manualOrphanEntryPolicyV1(context);
    readerStarted=true;
    const frame=await readManualOrphanFd4V1(policy,decodeManualOrphanEntryInputV1,claim);
    if(frame.schema!=='setfarm.manual-orphan-lifecycle-probe.v1'){
      // Explicit unavailable capability, AFTER canonical union decoding and
      // known inherited-input closure. No Source holder, role, server, module,
      // SQL, release selection or provision/activation handler is reachable.
      throw Error('MANUAL_ORPHAN_SETUP_REFUSED');
    }
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
  }catch(error){failure=manualOrphanEntryErrorV1(error,policy);}
  finally{
    if(!readerStarted)closeManualOrphanRaw4V1(claim);
    if(claim.uncertain)failure=policy.unknown();
    if(source){try{source.close();}catch{claim.uncertain=true;failure=policy.unknown();}}
  }
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
