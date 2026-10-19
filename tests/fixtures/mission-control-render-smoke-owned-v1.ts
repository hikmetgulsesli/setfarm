/** Closed Task4 fixture. Importing this module performs no operational work. */
import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import { test } from "node:test";
import { spawn, spawnSync } from "node:child_process";
import { Socket } from "node:net";
import { tmpdir } from "node:os";
import { EventEmitter } from "node:events";
function verifyTask4FinalFilesystemV1(ledger:Readonly<RecordV1>,artifacts:ReadonlyMap<string,Readonly<RecordV1>>):void {
  const pins:Array<{check():void;close():void}>=[];
  try {
    for(const row of ledger.snapshots.filter((item:RecordV1)=>item.phase==="after_server_close")){
      const root=pinTask4DirectoryV1(row.rootPin.path,true);pins.push(root);requireV1(sameV1(root.value,row.rootPin));
      const expected=task4ArtifactV1(artifacts,row.entries),entries:RecordV1[]=[];let total=0;
      const visit=(directory:string)=>{const names=fs.readdirSync(directory).sort();requireV1(entries.length+names.length<=4096);
        for(const name of names){const locator=path.join(directory,name),stat=fs.lstatSync(locator,{bigint:true}),relative=path.relative(row.rootPin.path,locator);
          const entry:RecordV1={relative,kind:stat.isDirectory()?"directory":stat.isFile()?"file":stat.isSymbolicLink()?"symlink":"unknown",uid:Number(stat.uid),mode:Number(stat.mode&0o777n),dev:String(stat.dev),ino:String(stat.ino),bytes:stat.isDirectory()?0:Number(stat.size),sha256:null,linkHash:null};
          requireV1(entry.kind!=="unknown");if(entry.kind==="directory"){const pin=pinTask4DirectoryV1(locator);pins.push(pin);entries.push(entry);visit(locator);}
          else if(entry.kind==="file"){total+=entry.bytes;requireV1(total<=536870912);const file=pinTask4FileV1(locator,536870912);try{entry.sha256=file.hash;file.check();}finally{file.close();}entries.push(entry);}
          else {entry.linkHash=hashV1(fs.readlinkSync(locator));const after=fs.lstatSync(locator,{bigint:true});requireV1(after.dev===stat.dev&&after.ino===stat.ino&&after.ctimeNs===stat.ctimeNs);entries.push(entry);}
        }requireV1(sameV1(names,fs.readdirSync(directory).sort()));
      };visit(row.rootPin.path);entries.sort((a,b)=>a.relative<b.relative?-1:a.relative>b.relative?1:0);requireV1(sameV1(entries,expected.entries));root.check();
    }
    for(const pin of pins)pin.check();
  }catch{return refuseV1("TASK4_RESOURCE_REFUSED");}finally{for(const pin of pins.reverse())pin.close();}
}
function assertTask4ConsumedArtifactsV1(result:Readonly<RecordV1>,artifacts:ReadonlyMap<string,Readonly<RecordV1>>,extraRefs:ReadonlyArray<unknown>):void {
  try {
    const seen=new Set<string>(),png=new Set<string>(result.artifacts.png.map((ref:Task4RefV1)=>ref.sha256));
    const visit=(value:unknown,depth=0)=>{requireV1(depth<=32);if(!value||typeof value!=="object")return;
      if(!Array.isArray(value)&&sameV1(Object.keys(value).sort(),["bytes","sha256"])){
        proofRefV1(value,16777216);if(png.has(value.sha256))return;if(seen.has(value.sha256))return;
        const artifact=task4ArtifactV1(artifacts,value);seen.add(value.sha256);visit(artifact,depth+1);return;
      }for(const child of Object.values(value))visit(child,depth+1);
    };
    visit([result.observations,result.render,result.cleanup,result.artifacts.native,extraRefs]);
    for(const [hash,value] of artifacts)if(["mission-control.task4-inner-query-ledger.v1","mission-control.ui-native-absence-witness.v1"].includes(value.schema)){
      visit({sha256:hash,bytes:Buffer.byteLength(task4CanonicalV1(value)+"\n")});
    }
    requireV1(seen.size===artifacts.size&&[...artifacts.keys()].every(hash=>seen.has(hash)));
  }catch{return refuseV1("TASK4_INTEGRITY_FAILED");}
}
function validateTask4PolicyOutcomesV1(original:Readonly<RecordV1>):void {
  try {
    for(const key of ["allowed","denied"]){keysV1(original[key],"startedAt finishedAt outcome errno");timeV1(original[key].startedAt);timeV1(original[key].finishedAt);
      requireV1(original[key].finishedAt>=original[key].startedAt&&Date.parse(original[key].finishedAt)-Date.parse(original[key].startedAt)<=5000);}
    requireV1(original.allowed.outcome==="connected"&&original.allowed.errno===null&&original.denied.outcome==="denied"&&["EPERM","EACCES"].includes(original.denied.errno));
    keysV1(original.exit,"code signal exitObserved closeObserved");requireV1(original.exit.code===0&&original.exit.signal===null&&original.exit.exitObserved===true&&original.exit.closeObserved===true);
    requireV1(typeof original.stdout==="string"&&Buffer.byteLength(original.stdout)<=1024&&original.stderr===""&&original.stdoutHash===hashV1(original.stdout)&&original.stderrHash===hashV1(""));
    requireV1(original.stdout===JSON.stringify({schema:"mission-control.task4-policy-probe-output.v1",
      allowed:{startedAt:original.allowed.startedAt,finishedAt:original.allowed.finishedAt,outcome:original.allowed.outcome,errno:original.allowed.errno},
      denied:{startedAt:original.denied.startedAt,finishedAt:original.denied.finishedAt,outcome:original.denied.outcome,errno:original.denied.errno}})+"\n");
  }catch{return refuseV1("TASK4_NETWORK_REFUSED");}
}
async function validateTask4PolicyProbeV1(root:string,ready:Readonly<RecordV1>,innerOwner:Readonly<RecordV1>,network:Readonly<RecordV1>,artifacts:ReadonlyMap<string,Readonly<RecordV1>>):Promise<void> {
  const pins:Array<{check():void;close():void}>=[];
  try {
    const policy=pinTask4FileV1(path.join(root,"server-launch-policy.sb"),65536),launcher=pinTask4FileV1("/usr/bin/sandbox-exec",16777216,"executable");pins.push(policy,launcher);
    requireV1((fs.lstatSync(path.join(root,"server-launch-policy.sb")).mode&0o777)===0o600&&policy.hash===network.osFence.policyHash&&launcher.hash===network.osFence.launcherHash);
    const result=readTask4FixedJsonV1(root,"policy-probe.json"),original=readTask4FixedJsonV1(root,"policy-probe-original.json"),mock=readTask4FixedJsonV1(root,"policy-probe-mock.json");
    keysV1(result,"schema executionId setupDescriptorHash readyDescriptorHash policyHash launcherHash owner allowed denied exit closeObserved original");
    keysV1(original,"schema executionId setupDescriptorHash readyDescriptorHash owner parentOwner policyHash launcherHash executableHash commandHash exit allowed denied stdout stderr stdoutHash stderrHash canaryBefore canaryAfter canaryClosed");
    keysV1(mock,"schema executionId setupDescriptorHash readyDescriptorHash owner before after acceptedConnections sockets");
    for(const v of [result,original,mock])artifactBindingV1(v,ready);
    requireV1(result.schema==="mission-control.task4-network-policy-probe.v1"&&original.schema==="mission-control.task4-policy-probe-original.v1"&&mock.schema==="mission-control.task4-policy-probe-mock.v1"
      &&sameV1(result.owner,original.owner)&&sameV1(original.parentOwner,ready.setup.owner)&&sameV1(mock.owner,innerOwner));
    for(const v of [result,original])requireV1(v.policyHash===policy.hash&&v.launcherHash===launcher.hash);
    processV1(original.owner);requireV1(original.owner.ppid===ready.setup.owner.pid&&original.owner.executable===innerOwner.executable&&original.owner.executableHash===innerOwner.executableHash
      &&original.executableHash===innerOwner.executableHash&&original.commandHash===original.owner.commandHash);
    validateTask4PolicyOutcomesV1(original);keysV1(result.exit,"code signal");requireV1(sameV1(result.exit,{code:0,signal:null})&&result.closeObserved===true);
    keysV1(mock.sockets,"opened closed active");requireV1(mock.acceptedConnections===1&&sameV1(mock.sockets,{opened:1,closed:1,active:0}));
    for(const relative of ["outer","outer/artifacts"])pins.push(pinTask4DirectoryV1(path.join(root,relative),true));
    const outer=(ref:unknown)=>{proofRefV1(ref,65536);const file=pinTask4FileV1(path.join(root,"outer/artifacts",ref.sha256+".json"),65536);pins.push(file);
      requireV1((fs.lstatSync(path.join(root,"outer/artifacts",ref.sha256+".json")).mode&0o777)===0o600&&file.hash===ref.sha256&&file.bytes.length===ref.bytes);
      const v=JSON.parse(file.bytes.toString("utf8"));requireV1(Buffer.from(task4CanonicalV1(v)+"\n").equals(file.bytes));return v;};
    requireV1(sameV1(outer(result.original),original));
    const innerListener=(ref:unknown)=>{const v=task4ArtifactV1(artifacts,ref);keysV1(v,"schema executionId setupDescriptorHash readyDescriptorHash endpointRole host port at state owner original");artifactBindingV1(v,ready);
      requireV1(v.schema==="mission-control.task4-listener.v1"&&v.endpointRole==="mock"&&v.host==="127.0.0.1"&&v.state==="listening"&&sameV1(v.owner,innerOwner)
        &&sameV1(v.original,{method:"owned_http_server",observed:true}));integerV1(v.port,1024,65535);timeV1(v.at);return v;};
    const before=innerListener(mock.before),after=innerListener(mock.after);requireV1(before.port===after.port&&after.at>=before.at);
    const canary=(ref:unknown,state:string)=>{const v=outer(ref);keysV1(v,"schema executionId setupDescriptorHash readyDescriptorHash endpointRole host port at state owner acceptedConnections original");artifactBindingV1(v,ready);
      requireV1(v.schema==="mission-control.task4-policy-probe-listener.v1"&&v.endpointRole==="owned_denied_canary"&&v.host==="127.0.0.1"&&v.state===state
        &&sameV1(v.owner,ready.setup.owner)&&v.acceptedConnections===0&&sameV1(v.original,{method:"owned_http_server",observed:true}));integerV1(v.port,1024,65535);timeV1(v.at);return v;};
    const deniedBefore=canary(original.canaryBefore,"listening"),deniedAfter=canary(original.canaryAfter,"listening"),deniedClosed=canary(original.canaryClosed,"absent");
    const serverPort=task4BoundServerPortV1(task4ArtifactV1(artifacts,network.policy.serverLaunchRef),ready,artifacts);
    requireV1(deniedBefore.port===deniedAfter.port&&deniedBefore.port===deniedClosed.port&&deniedAfter.at>=deniedBefore.at&&deniedClosed.at>=deniedAfter.at
      &&serverPort!==before.port&&![serverPort,before.port,ready.setup.postgres.port,3080,3333,5432,13081,18789].includes(deniedBefore.port));
    for(const [key,endpointRole,first,last,count] of [["allowed","owned_allowed_mock",mock.before,mock.after,1],["denied","owned_denied_canary",original.canaryBefore,original.canaryAfter,0]] as const){
      keysV1(result[key],"endpointRole startedAt finishedAt outcome errno listenerBefore listenerAfter acceptedConnections");
      requireV1(result[key].endpointRole===endpointRole&&result[key].acceptedConnections===count&&sameV1(result[key].listenerBefore,first)&&sameV1(result[key].listenerAfter,last));
      for(const field of ["startedAt","finishedAt","outcome","errno"])requireV1(result[key][field]===original[key][field]);
    }
    requireV1(before.at<=original.allowed.startedAt&&after.at>=original.allowed.finishedAt&&deniedBefore.at<=original.denied.startedAt&&deniedAfter.at>=original.denied.finishedAt);
    const source=pinTask4FileV1(path.join(ready.setup.missionControl.source.root,"scripts/render-smoke-owned-fixture.mjs"),16777216);pins.push(source);requireV1(source.hash===ready.setup.missionControl.source.harness.ownedFixtureHash);
    const ts=await import("typescript");for(const pin of pins)pin.check();const ast=ts.createSourceFile("owned.mjs",source.bytes.toString("utf8"),ts.ScriptTarget.Latest,true,ts.ScriptKind.JS),values:string[]=[];
    for(const statement of ast.statements)if(ts.isVariableStatement(statement))for(const declaration of statement.declarationList.declarations)
      if(ts.isIdentifier(declaration.name)&&declaration.name.text==="TASK4_POLICY_PROBE_PROGRAM"&&declaration.initializer&&(ts.isStringLiteral(declaration.initializer)||ts.isNoSubstitutionTemplateLiteral(declaration.initializer)))values.push(declaration.initializer.text);
    requireV1(values.length===1&&!/[\r\n]/.test(values[0]!)&&values[0]!.length<=16384);
    requireV1(original.commandHash===hashV1([innerOwner.executable,"-e",values[0]!,String(before.port),String(deniedBefore.port)].join(" ")));
    for(const pin of pins)pin.check();
  }catch{return refuseV1("TASK4_NETWORK_REFUSED");}finally{for(const pin of pins.reverse())pin.close();}
}
type Task4ContextV1=Awaited<ReturnType<typeof prepareTask4ContextV1>>;
type Task4IssuedV1={queryId:string;statement:string;kind:string;applicationName:string;clientPid:number};
function pinTask4PgAppendV1(root:string) {
  const directory=pinTask4DirectoryV1(root,true),locator=path.join(root,"postgres.stderr.log");
  let fd:number|undefined;
  try {
    fd=fs.openSync(locator,fs.constants.O_RDONLY|fs.constants.O_NOFOLLOW);const original=fs.fstatSync(fd,{bigint:true});
    requireV1(original.isFile()&&original.nlink===1n&&original.uid===BigInt(process.getuid!())&&(original.mode&0o777n)===0o600n&&original.size<=8388608n,"TASK4_SQL_ORIGINALS_UNKNOWN");
    const prefix=Buffer.alloc(Number(original.size));requireV1(fs.readSync(fd,prefix,0,prefix.length,0)===prefix.length&&(!prefix.length||prefix.at(-1)===10),"TASK4_SQL_ORIGINALS_UNKNOWN");
    const descriptor=fd;let closed=false;
    return {startOffset:prefix.length,initialPrefixHash:hashV1(prefix),read(){
      requireV1(!closed,"TASK4_SQL_ORIGINALS_UNKNOWN");directory.check();const current=fs.fstatSync(descriptor,{bigint:true}),named=fs.lstatSync(locator,{bigint:true});
      requireV1(current.dev===original.dev&&current.ino===original.ino&&current.nlink===1n&&current.mode===original.mode&&current.uid===original.uid
        &&named.dev===current.dev&&named.ino===current.ino&&named.nlink===1n&&current.size>=original.size&&current.size-original.size<=8388608n,"TASK4_SQL_ORIGINALS_UNKNOWN");
      const all=Buffer.alloc(Number(current.size));requireV1(fs.readSync(descriptor,all,0,all.length,0)===all.length&&all.subarray(0,prefix.length).equals(prefix),"TASK4_SQL_ORIGINALS_UNKNOWN");
      directory.check();return all.subarray(prefix.length);
    },close(){if(!closed){closed=true;fs.closeSync(descriptor);directory.close();}}};
  }catch(error){if(fd!==undefined)fs.closeSync(fd);directory.close();throw error;}
}
function writeTask4PrivateBytesV1(directory:string,name:string,bytes:Buffer):void {
  requireV1(/^[a-z0-9._-]{1,160}$/.test(name)&&bytes.length<=8388608,"TASK4_RESOURCE_REFUSED");const dir=pinTask4DirectoryV1(directory,true);
  let fd:number|undefined;
  try {dir.check();fd=fs.openSync(path.join(directory,name),fs.constants.O_CREAT|fs.constants.O_EXCL|fs.constants.O_WRONLY|fs.constants.O_NOFOLLOW,0o600);
    const stat=fs.fstatSync(fd);requireV1(stat.isFile()&&stat.nlink===1&&stat.uid===process.getuid!()&&(stat.mode&0o777)===0o600);
    let offset=0;while(offset<bytes.length){const written=fs.writeSync(fd,bytes,offset,bytes.length-offset,offset);requireV1(written>0);offset+=written;}fs.fsyncSync(fd);dir.check();
  }finally{if(fd!==undefined)fs.closeSync(fd);dir.close();}
}
function retainTask4PgChunksV1(root:string,bytes:Buffer,rows:ReadonlyArray<Readonly<RecordV1>>):ReadonlyArray<Readonly<RecordV1>> {
  requireV1(bytes.length>0&&bytes.length<=8388608&&rows.length>0,"TASK4_SQL_ORIGINALS_UNKNOWN");let start=0,end=0;const result:RecordV1[]=[];
  const flush=()=>{if(end===start)return;const chunk=bytes.subarray(start,end),sha256=hashV1(chunk),seq=result.length+1;
    writeTask4PrivateBytesV1(path.join(root,"parent/originals"),String(seq).padStart(3,"0")+"-"+sha256+".log",chunk);result.push({seq,sha256,bytes:chunk.length,start});start=end;};
  for(const row of rows){requireV1(row.offset===end&&row.length<=524288,"TASK4_SQL_ORIGINALS_UNKNOWN");if(end-start+row.length>524288)flush();end+=row.length;}
  flush();requireV1(end===bytes.length&&result.length<=64,"TASK4_SQL_ORIGINALS_UNKNOWN");return freezeV1(result);
}
function readTask4FixedJsonV1(root:string,name:"policy-probe.json"|"policy-probe-mock.json"|"policy-probe-original.json"):Readonly<RecordV1> {
  const directory=pinTask4DirectoryV1(root,true),file=pinTask4FileV1(path.join(root,name),65536);
  try {requireV1((fs.lstatSync(path.join(root,name)).mode&0o777)===0o600);const value=JSON.parse(file.bytes.toString("utf8"));
    requireV1(Buffer.from(task4CanonicalV1(value)+"\n").equals(file.bytes));file.check();directory.check();return freezeV1(value);
  }finally{file.close();directory.close();}
}
const TASK4_FAILURE_STAGES_V1=Object.freeze(["initialization","initial_backend_census","initial_probes","inner_validation","after_probes","after_audit","after_audit_equal","watcher_settle","observer_release","observer_end","probe_release","probe_end","final_backend_census","watcher_success","restricted_absence","pg_prefix_first","pg_prefix_second","pg_prefix_equal","pg_parse","pg_chunks","pg_events","parent_query_match","inner_query_match","audit_publish","probe_calibration","sql_publish","parent_cleanup","database_cleanup","role_cleanup","finalizer_observer_release","finalizer_observer_end","finalizer_probe_release","finalizer_probe_end","finalizer_fixture_close","finalizer_admin_end","backend_census"]);
const TASK4_FAILURE_PREDICATES_V1=Object.freeze(["none","audit_equal","watcher_success","restricted_absence","prefix_equal","census_query","census_cap","census_lsof","census_socket_parse","census_socket_unique","census_parent_identity","census_process","census_server_identity","census_backend_binding","census_existing_identity","census_backend_cap","census_server_cap","parse_identity","parse_bytes","parse_utf8","parse_message_cap","parse_continuation","parse_coverage","parse_session","parse_time","parse_scope","parse_severity","parse_backend_unique","parse_candidate_unique","parse_error_pair","parent_query_owner","parent_query_event","inner_query_event"]);
type Task4FailureDetailV1=Readonly<{stage:string;predicate:string;cause:string}>;
function task4FailureDetailV1(stage:string,predicate:string,error:unknown):Task4FailureDetailV1 {
  const message=error instanceof Error?error.message:"";
  return freezeV1({stage:TASK4_FAILURE_STAGES_V1.includes(stage)?stage:"initialization",predicate:TASK4_FAILURE_PREDICATES_V1.includes(predicate)?predicate:"none",
    cause:message==="TASK4_SQL_ORIGINALS_UNKNOWN"||TASK4_CODES_V1.includes(message)?message:"UNCLASSIFIED"});
}
function publishTask4ParentFailureV1(root:string,executionId:string,first:Task4FailureDetailV1,watcher:Task4FailureDetailV1|null):void {
  // Diagnostic publication never replaces the original refusal or changes finalizer authority.
  try {hexV1(executionId,32);const value={schema:"setfarm.task4-parent-failure.v1",executionId,...first,watcherFailure:watcher};
    const bytes=Buffer.from(task4CanonicalV1(value)+"\n");requireV1(bytes.length<=2048);
    writeTask4PrivateBytesV1(path.join(root,"parent/originals"),"parent-failure.json",bytes);
  }catch{/* Preserve the first core failure and continue the original finalizer. */}
}
function task4BackendFailureCanonicalV1(value:Readonly<RecordV1>):string {
  // Keep the shared 1MiB canonical guard unchanged; only this fixed base64 field may be larger.
  const encoded=value.original.stdoutBase64;
  requireV1(typeof encoded==="string"&&encoded.length<=1398104&&/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(encoded));
  const bytes=Buffer.from(encoded,"base64");requireV1(bytes.length<=1048576&&bytes.length===value.original.stdoutBytes&&bytes.toString("base64")===encoded&&hashV1(bytes)===value.original.stdoutHash);
  const marker='"stdoutBase64":""',base=task4CanonicalV1({...value,original:{...value.original,stdoutBase64:""}});requireV1(base.split(marker).length===2);
  const result=base.replace(marker,'"stdoutBase64":'+JSON.stringify(encoded));requireV1(Buffer.byteLength(result+"\n")<=2097152);return result;
}
type Task4BackendDiagnosticV1={predicate:string;origin?:"main"|"watcher";failure?:Readonly<RecordV1>|null};
function task4BackendFailureSnapshotV1(setup:Readonly<RecordV1>,ready:Readonly<RecordV1>,owner:Readonly<RecordV1>,origin:unknown,
  invocationStartedAt:string,rows:ReadonlyArray<RecordV1>,raw:RecordV1,parser:Task4SocketDiagnosticV1):Readonly<RecordV1>|null {
  // Every operation here is diagnostic-only; construction failure preserves the original parser rejection.
  try {
    hexV1(ready.executionId,32);processV1(owner);timeV1(invocationStartedAt);integerV1(setup.postgres.port,1024,65535);
    requireV1(origin==="main"||origin==="watcher");requireV1(ready.database.role==="mc_task4_"+ready.executionId&&/^setfarm_p3_[a-f0-9]{24}_clone_[a-f0-9]{12}$/.test(ready.database.name));
    requireV1(Array.isArray(rows)&&rows.length<=64&&typeof raw.stdout==="string"&&Buffer.byteLength(raw.stdout)<=1048576
      &&!raw.error&&raw.status===0&&raw.signal===null&&raw.stderr==="");
    requireV1(TASK4_SOCKET_PREDICATES_V1.includes(parser.predicate));integerV1(parser.line,0,1048577);integerV1(parser.endpointLine,0,parser.line);
    const field=(value:unknown,valid:boolean)=>{let sha256:string|null=null;
      if(value===null||typeof value==="boolean"||(typeof value==="number"&&Number.isFinite(value))||(typeof value==="string"&&Buffer.byteLength(value)<=4096))sha256=hashV1(task4CanonicalV1(value));
      return {valid,value:valid?value:null,sha256};};
    const selected=rows.map(row=>{requireV1(row!==null&&typeof row==="object"&&!Array.isArray(row));return {
      pid:field(row.pid,Number.isSafeInteger(row.pid)&&row.pid>0),
      startedAt:field(row.startedAt,typeof row.startedAt==="string"&&/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{6}Z$/.test(row.startedAt)),
      role:field(row.role,row.role===ready.database.role),database:field(row.database,row.database===ready.database.name),
      applicationName:field(row.applicationName,["task4_mc_","task4_observer_","task4_probe_"].some(prefix=>row.applicationName===prefix+ready.executionId)),
      host:field(row.host,row.host==="127.0.0.1"),port:field(row.port,Number.isSafeInteger(row.port)&&row.port>=1024&&row.port<=65535),
    };});
    const stdout=Buffer.from(raw.stdout,"utf8"),value={schema:"setfarm.task4-backend-census-failure.v1",executionId:ready.executionId,fixtureOwner:{...owner},origin,
      invocationStartedAt,observedAt:new Date().toISOString(),postgresPort:setup.postgres.port,parser:{predicate:parser.predicate,line:parser.line,endpointLine:parser.endpointLine},rows:selected,
      original:{executable:"/usr/sbin/lsof",argv:["-nP","-iTCP:"+setup.postgres.port,"-F","pfnT"],status:raw.status,signal:raw.signal,
        stdoutBase64:stdout.toString("base64"),stdoutBytes:stdout.length,stdoutHash:hashV1(stdout),stderrBytes:0,stderrHash:hashV1("")}};
    task4BackendFailureCanonicalV1(value);return freezeV1(value);
  }catch{return null;}
}
function publishTask4BackendFailureV1(root:string,value:Readonly<RecordV1>|null):void {
  try {if(!value)return;const bytes=Buffer.from(task4BackendFailureCanonicalV1(value)+"\n");
    writeTask4PrivateBytesV1(path.join(root,"parent/originals"),"backend-census-failure.json",bytes);
  }catch{/* Preserve the same original failure and the existing finalizer. */}
}
async function runTask4OwnedFixtureV1(setup:Readonly<RecordV1>,context:Task4ContextV1,adminUrl:string):Promise<void> {
  const root=setup.resourceRoot.path,id=setup.executionId,sourceSha=setup.setfarm.source.sourceSha;
  let fixture:any=null,ready:Readonly<RecordV1>|null=null,projection:Readonly<RecordV1>|null=null,innerOwner:Readonly<RecordV1>|null=null,
    innerExit:Readonly<RecordV1>|null=null,innerRef:Task4RefV1|null=null,innerResult:Readonly<RecordV1>|null=null,serverOwner:Readonly<RecordV1>|null=null;
  let observer:any=null,probe:any=null,observerConnection:any=null,probeConnection:any=null,admin:any=null,originalChild:Promise<Readonly<RecordV1>|null>|null=null;
  let watcher:Promise<void>|null=null,stopWatcher=false,watchFailure=false,capture:ReturnType<typeof pinTask4PgAppendV1>|null=null;
  let cleanupAttempted=false;
  let stage="initialization",predicate="none",firstFailure:Task4FailureDetailV1|null=null,watcherFailure:Task4FailureDetailV1|null=null,backendFailure:Readonly<RecordV1>|null=null,backendFailureLatched=false;
  let databaseAbsent:boolean|null=null,roleAbsent:boolean|null=null,auditComplete=false,sqlComplete=false,networkComplete=false,failed=false,code="TASK4_INTEGRITY_FAILED";
  const pins:Array<{check():void;close():void}>=[],published=new Map<string,Task4RefV1>(),issued:Task4IssuedV1[]=[],backends=new Map<number,RecordV1>(),censuses:RecordV1[]=[],probeResults:RecordV1[]=[],parentCalls:RecordV1[]=[];
  let finalAudit:RecordV1|null=null;
  const readers={opened:0,closed:0,pending:0},evidence:RecordV1={readinessBefore:null,readinessAfter:null,auditBefore:null,auditAfter:null,untouchedBefore:null,untouchedAfter:null,sqlLedger:null};
  const check=()=>{context.check();for(const pin of pins)pin.check();};
  const put=(value:unknown)=>{check();const hash=hashV1(task4CanonicalV1(value)+"\n");const prior=published.get(hash);if(prior)return prior;
    const ref=publishTask4ProofV1(root,"artifact",value);published.set(hash,ref);check();return ref;};
  const tracked=(client:QueryPortV1,kind:string,applicationName:string):QueryPortV1=>({async unsafe(statement,parameters=[]){
    requireV1(issued.length<256,"TASK4_SQL_ORIGINALS_UNKNOWN");const queryId=kind+"_"+hashV1(statement).slice(0,16);
    if(!issued.some(q=>q.statement===statement&&q.applicationName===applicationName))issued.push({queryId,statement,kind,applicationName,clientPid:context.owner.pid});
    requireV1(parentCalls.length<256,"TASK4_SQL_ORIGINALS_UNKNOWN");
    const call:RecordV1={queryId,applicationName,statementHash:hashV1(statement),parametersHash:hashV1(task4CanonicalV1(parameters)),startedAt:new Date().toISOString(),finishedAt:null,outcome:"pending",sqlstate:null,rowCount:null,resultHash:null};parentCalls.push(call);
    check();try{const rows=await client.unsafe(statement,parameters);call.outcome="rows";call.rowCount=rows.length;call.resultHash=hashV1(task4CanonicalV1(Array.from(rows)));return rows;}
    catch(error){call.outcome="error";const code=(error as {code?:unknown}).code;call.sqlstate=typeof code==="string"&&/^[A-Z0-9]{5}$/.test(code)?code:null;throw error;}
    finally{call.finishedAt=new Date().toISOString();check();}
  }});
  const closeReader=async(client:any,connection:any)=>{if(!client)return;try{if(connection)await connection.release();
    if(stage==="observer_release")stage="observer_end";else if(stage==="probe_release")stage="probe_end";
    else if(stage==="finalizer_observer_release")stage="finalizer_observer_end";else if(stage==="finalizer_probe_release")stage="finalizer_probe_end";
    await client.end({timeout:5});readers.closed++;
  }catch(error){firstFailure??=task4FailureDetailV1(stage,predicate,error);failed=true;code="TASK4_CLEANUP_UNKNOWN";}};
  let observerPort:QueryPortV1|null=null,probePort:QueryPortV1|null=null;
  const observeBackends=async(diagnostic:Task4BackendDiagnosticV1={predicate:"none"})=>{
    if(!ready||!admin)return;const at=new Date().toISOString();
    diagnostic.predicate="census_query";const rows=await admin.unsafe(`SELECT pid,to_char(backend_start AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS "startedAt",
      usename AS role,datname AS database,application_name AS "applicationName",host(client_addr) AS host,client_port AS port
      FROM pg_stat_activity WHERE usename=$1 OR (datname=$2 AND application_name LIKE 'task4_%') ORDER BY pid LIMIT 65`,[ready.database.role,ready.database.name]);
    diagnostic.predicate="census_cap";requireV1(rows.length<=64&&censuses.length<4096,"TASK4_SQL_ORIGINALS_UNKNOWN");
    diagnostic.predicate="census_lsof";const raw=spawnSync("/usr/sbin/lsof",["-nP","-iTCP:"+setup.postgres.port,"-F","pfnT"],{encoding:"utf8",timeout:5000,maxBuffer:1048576,env:{PATH:"/usr/bin:/bin:/usr/sbin:/sbin",LANG:"C",LC_ALL:"C",TZ:"UTC"}});
    requireV1(!raw.error&&raw.signal===null&&raw.status===0&&raw.stderr==="","TASK4_SQL_ORIGINALS_UNKNOWN");
    diagnostic.predicate="census_socket_parse";const parser:Task4SocketDiagnosticV1={predicate:"port",line:0,endpointLine:0};let sockets:ReturnType<typeof parseTask4SocketsV1>;
    const parentTimeWait:Task4ParentTimeWaitSocketV1[]=[];
    try{sockets=parseTask4SocketsV1(raw.stdout,setup.postgres.port,parser,{fixturePid:context.owner.pid,selectedPorts:rows.map((row:any)=>row?.port),parentTimeWait});}catch(error){
      try{diagnostic.failure=task4BackendFailureSnapshotV1(setup,ready,context.owner,diagnostic.origin,at,rows,raw,parser);}catch{/* Preserve the same original parser rejection. */}throw error;
    }const owners=new Map<number,Readonly<RecordV1>>();
    if(parentTimeWait.length){diagnostic.predicate="census_parent_identity";const current=observeTask4ProcessV1(context.owner.pid).pin;
      requireV1(sameV1(current,context.owner),"TASK4_SQL_ORIGINALS_UNKNOWN");owners.set(context.owner.pid,current);}
    for(const row of rows){diagnostic.predicate="census_socket_unique";const matches=sockets.filter(s=>s.port===row.port);requireV1(matches.length===1,"TASK4_SQL_ORIGINALS_UNKNOWN");const pid=matches[0]!.pid;
      diagnostic.predicate="census_process";let owner=owners.get(pid);if(!owner){owner=observeTask4ProcessV1(pid).pin;owners.set(pid,owner!);}
      if(row.applicationName==="task4_mc_"+id){diagnostic.predicate="census_server_identity";requireV1(innerOwner!==null&&owner!.ppid===innerOwner.pid&&owner!.executable===context.owner.executable
        &&owner!.executableHash===context.owner.executableHash&&owner!.commandHash===hashV1([context.owner.executable,path.join(setup.missionControl.source.root,"dist-server/index.js")].join(" ")),"TASK4_SQL_ORIGINALS_UNKNOWN");
        if(serverOwner)requireV1(sameV1(serverOwner,owner),"TASK4_SQL_ORIGINALS_UNKNOWN");else serverOwner=owner!;}
      diagnostic.predicate="census_backend_binding";const bound=bindTask4BackendV1(row,ready,context.owner,innerOwner,serverOwner,sockets,owners),prior=backends.get(row.pid);
      if(prior){diagnostic.predicate="census_existing_identity";const {firstObservedAt,lastObservedAt,...identity}=prior;requireV1(sameV1(identity,bound),"TASK4_SQL_ORIGINALS_UNKNOWN");prior.lastObservedAt=at;}
      else {diagnostic.predicate="census_backend_cap";requireV1(backends.size<64,"TASK4_SQL_ORIGINALS_UNKNOWN");backends.set(row.pid,{...bound,firstObservedAt:at,lastObservedAt:at});}
    }
    diagnostic.predicate="census_server_cap";requireV1([...backends.values()].filter(b=>b.clientRole==="mc").length<=10,"TASK4_SQL_ORIGINALS_UNKNOWN");
    censuses.push({at,rows,sockets,parentTimeWait:parentTimeWait.length?{owner:owners.get(context.owner.pid),sockets:parentTimeWait}:null,stdoutHash:hashV1(raw.stdout),exit:{code:raw.status,signal:raw.signal}});
  };
  const observeMainBackends=async()=>{
    const diagnostic:Task4BackendDiagnosticV1={predicate:"none",origin:"main"};
    try{await observeBackends(diagnostic);}catch(error){if(!backendFailureLatched){backendFailureLatched=true;backendFailure=diagnostic.failure??null;}predicate=diagnostic.predicate;throw error;}
  };
  const observeAudit=async(phase:"Before"|"After")=>{
    check();requireV1(observerPort!==null,"TASK4_DATABASE_REFUSED");let grants:Readonly<RecordV1>;
    await observerPort.unsafe("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    try {await observerPort.unsafe("SET LOCAL statement_timeout = '5s'");grants=await observeTask4GrantsV1(observerPort,fixture.database,"mc_task4_"+id);await observerPort.unsafe("COMMIT");}
    catch(error){try{await observerPort.unsafe("ROLLBACK");}catch{/* Keep original refusal and retain custody. */}throw error;}
    check();const privileged=await fixture.sql.begin("isolation level repeatable read read only",async(tx:QueryPortV1)=>{
      await tx.unsafe("SET LOCAL statement_timeout = '5s'");const seed=await observeTask4SeedV1(tx,sourceSha),catalog=await observeTask4ParentCatalogV1(tx,"mc_task4_"+id),untouched=await observeTask4UntouchedV1(tx);
      const optional=await tx.unsafe("SELECT to_regclass('public.step_metrics')::text AS relation");requireV1(sameV1(optional,[{relation:null}]),"TASK4_DATABASE_REFUSED");return {seed,catalog,untouched,optional};
    });const value={...privileged,grants};check();evidence["untouched"+phase]=put(value.untouched);
    const audit={schema:"setfarm.task4-parent-audit.v1",executionId:id,phase:phase.toLowerCase(),seed:value.seed,grants:value.grants,catalog:value.catalog,optionalStepMetrics:value.optional,backendCensuses:phase==="After"?censuses:[],parentQueries:phase==="After"?parentCalls:[],capture:null};
    if(phase==="After")finalAudit=audit;else evidence.auditBefore=put(audit);
    const readiness=await fixture.observeOwnedP3ReadinessV1();check();evidence["readiness"+phase]=put(readiness);return {...value,readiness};
  };
  const untouched=async()=>{check();const value=await fixture.sql.begin("isolation level repeatable read read only",async(tx:QueryPortV1)=>{
    await tx.unsafe("SET LOCAL statement_timeout = '5s'");return observeTask4UntouchedV1(tx);});check();return put(value);};
  const probes=async()=>{
    requireV1(probePort!==null&&ready!==null,"TASK4_DATABASE_REFUSED");
    for(const entry of task4ProbesV1(id)){
      check();const before=await untouched(),startedAt=new Date().toISOString();check();
      const outcome=await executeTask4ProbeV1(probePort,entry);check();const finishedAt=new Date().toISOString(),after=await untouched();
      requireV1(outcome.sqlstate==="42501"&&outcome.rollbackObserved===true&&sameV1(before,after),"TASK4_DATABASE_REFUSED");
      probeResults.push({...outcome,beforeRef:before,afterRef:after,startedAt,finishedAt});await observeMainBackends();
    }
  };
  try {
    check();for(const relative of ["parent","parent/artifacts","parent/originals"]){const locator=path.join(root,relative);fs.mkdirSync(locator,{mode:0o700});pins.push(pinTask4DirectoryV1(locator,true));}check();
    capture=pinTask4PgAppendV1(root);
    const projectionRoot=fs.realpathSync(fileURLToPath(new URL("../../",import.meta.url))),projectionPin=pinTask4DirectoryV1(projectionRoot,true);pins.push(projectionPin);
    const markerPin=pinTask4FileV1(path.join(projectionRoot,".setfarm-p3-projection-marker.json"),16384);pins.push(markerPin);const marker=JSON.parse(markerPin.bytes.toString("utf8"));
    requireV1(marker.schema==="setfarm.p3-isolated-projection-marker.v1"&&marker.projectionRoot===projectionRoot&&marker.adminUrlSha256===setup.postgres.adminUrlHash,"TASK4_BINDING_REFUSED");
    const projected=measureTask4SourceV1(projectionRoot);pins.push(projected);requireV1(projected.value.sourceSha===marker.projectedHead,"TASK4_SOURCE_DRIFT");
    projection=freezeV1({root:projectionPin.value,projectedHead:marker.projectedHead,inputManifestHash:setup.setfarm.source.inputManifestHash,projectedManifestHash:projected.value.inputManifestHash,markerHash:markerPin.hash,runDatabasePrefix:marker.runDatabasePrefix});
    check();const helper=await import(new URL("../execution-attempts/test-database.ts",import.meta.url).href);check();
    readers.opened+=2;fixture=await helper.createOwnedTask4TestDatabaseV1();check();
    requireV1(new RegExp("^"+marker.runDatabasePrefix+"_clone_[a-f0-9]{12}$").test(fixture.database),"TASK4_BINDING_REFUSED");
    const auxiliary=pinTask4FileV1(path.join(projectionRoot,"src/installation/fresh-installation-mission-control-schema-v1.ts"),262144);pins.push(auxiliary);
    await fixture.sql.begin(async(tx:QueryPortV1)=>{check();await installTask4AuxiliaryV1(tx,auxiliary.bytes.toString("utf8"));check();});check();
    await fixture.seedV3ReleaseGoAdmission(sourceSha);check();const seed=task4SeedV1(sourceSha);
    await fixture.sql.begin(async(tx:QueryPortV1)=>{for(const row of seed.runs){const columns=Object.keys(row).sort();
      await tx.unsafe(`INSERT INTO public.runs (${columns.map(k=>'"'+k+'"').join(',')}) VALUES (${columns.map((_,i)=>'$'+(i+1)).join(',')})`,columns.map(k=>row[k]));}check();});check();
    const password=randomBytes(32).toString("hex"),role="mc_task4_"+id;
    await fixture.sql.begin(async(tx:QueryPortV1)=>{await createTask4ReadRoleV1(tx,id,fixture.database,marker.runDatabasePrefix,password);check();});check();
    const restricted=new URL(adminUrl);restricted.username=role;restricted.password=password;restricted.pathname="/"+fixture.database;
    const database={name:fixture.database,role,restrictedUrl:restricted.toString(),restrictedUrlHash:hashV1(restricted.toString())};
    const {default:postgres}=await import("postgres");check();
    admin=postgres(adminUrl,{max:1,connect_timeout:5,idle_timeout:0,onnotice:()=>{},connection:{statement_timeout:5000,application_name:"task4_parent_"+id}});readers.opened++;
    observer=postgres(database.restrictedUrl,{max:1,connect_timeout:5,idle_timeout:0,onnotice:()=>{},connection:{application_name:"task4_observer_"+id}});readers.opened++;
    probe=postgres(database.restrictedUrl,{max:1,connect_timeout:5,idle_timeout:0,onnotice:()=>{},connection:{application_name:"task4_probe_"+id}});readers.opened++;
    observerConnection=await observer.reserve();check();probeConnection=await probe.reserve();check();
    observerPort=tracked(observerConnection,"parent_observer","task4_observer_"+id);probePort=tracked(probeConnection,"parent_probe","task4_probe_"+id);
    const settings=await observerPort.unsafe(TASK4_PG_SETTINGS_SQL_V1);requireV1(settings.length===1,"TASK4_SQL_ORIGINALS_UNKNOWN");validateTask4PgSettingsV1(settings[0],true);
    const before=await observeAudit("Before");ready=buildTask4ReadyV1(setup,context.owner,projection,database,before.readiness,before.seed,before.grants);check();
    stage="initial_backend_census";await observeMainBackends();stage="initial_probes";await probes();check();stage="inner_validation";
    const mc=await import(pathToFileURL(path.join(setup.missionControl.source.root,"scripts/render-smoke-owned-fixture.mjs")).href);check();
    const networkBuild=mc.captureTask4BuildV1(setup.missionControl.source.root);networkBuild.check();check();
    requireV1(networkBuild.identity.sourceSha===setup.missionControl.source.sourceSha&&networkBuild.identity.treeHash===setup.missionControl.source.treeHash
      &&networkBuild.identity.buildHash===setup.missionControl.source.buildHash&&networkBuild.identityHash===setup.missionControl.source.buildIdentityHash,"TASK4_SOURCE_DRIFT");
    const queryRecipes=mc.task4ObserverSqlRecipesV1(),networkRecipes=mc.task4NetworkRecipesV1(networkBuild);networkBuild.check();check();
    requireV1(Array.isArray(queryRecipes)&&queryRecipes.length<=128,"TASK4_SOURCE_DRIFT");
    const node=context.owner.executable,entry=path.join(setup.missionControl.source.root,"scripts/render-smoke.mjs");
    const child=spawn(node,[entry,"--owned-fixture-ready-v1"],{cwd:setup.missionControl.source.root,env:{HOME:context.home,TMPDIR:context.tmp,PATH:"/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin",LANG:"C",LC_ALL:"C",TZ:"UTC"},stdio:["ignore","pipe","pipe","ignore","pipe"]});
    originalChild=observeTask4OriginalChildV1(child).then(value=>value,()=>{failed=true;code="TASK4_CLEANUP_UNKNOWN";return null;});let outputOverflow=false;const outputs:Array<{name:string;chunks:Buffer[];bytes:number}>=[];
    for(const [name,stream] of [["inner.stdout.log",child.stdout!],["inner.stderr.log",child.stderr!]] as const){const output={name,chunks:[] as Buffer[],bytes:0};outputs.push(output);
      stream.on("data",(chunk:Buffer)=>{output.bytes+=chunk.length;if(output.bytes<=1048576)output.chunks.push(Buffer.from(chunk));else outputOverflow=true;});}
    let deliveryError=false;const writer=child.stdio[4] as import("node:stream").Writable;
    const delivered=new Promise<void>(resolve=>{let finished=false;writer.once("finish",()=>{finished=true;resolve();});writer.once("error",()=>{deliveryError=true;resolve();});
      writer.once("close",()=>{if(!finished)deliveryError=true;resolve();});});
    try {
      requireV1(Number.isInteger(child.pid),"TASK4_BINDING_REFUSED");innerOwner=observeTask4ProcessV1(child.pid!).pin;
      requireV1(innerOwner!.ppid===context.owner.pid&&innerOwner!.executable===node&&innerOwner!.executableHash===context.owner.executableHash
        &&innerOwner!.commandHash===hashV1([node,entry,"--owned-fixture-ready-v1"].join(" ")),"TASK4_BINDING_REFUSED");check();
      for(const recipe of queryRecipes)issued.push({queryId:"inner_"+recipe.queryId,statement:recipe.statement,kind:"inner_observer",applicationName:"task4_observer_"+id,clientPid:innerOwner!.pid});
      watcher=(async()=>{while(!stopWatcher){const diagnostic:Task4BackendDiagnosticV1={predicate:"none",origin:"watcher"};try{await observeBackends(diagnostic);}catch(error){if(!backendFailureLatched){backendFailureLatched=true;backendFailure=diagnostic.failure??null;}watcherFailure??=task4FailureDetailV1("backend_census",diagnostic.predicate,error);watchFailure=true;stopWatcher=true;}if(!stopWatcher)await new Promise(resolve=>setTimeout(resolve,100));}})();
      writer.end(Buffer.from(task4CanonicalV1(ready)+"\n"));
    }catch(error){deliveryError=true;if(!writer.destroyed&&!writer.writableEnded)writer.end();throw error;}
    finally {await delivered;innerExit=await originalChild;originalChild=null;for(const output of outputs)writeTask4PrivateBytesV1(path.join(root,"parent/originals"),output.name,Buffer.concat(output.chunks));}
    check();requireV1(!deliveryError&&!outputOverflow,"TASK4_CLEANUP_UNKNOWN");
    const observed=readTask4ProofV1(root,"inner-result.json");innerRef=observed.ref;innerResult=validateTask4InnerEnvelopeV1(observed.value,ready,innerOwner!,innerExit!,context.scenario);
    requireV1(innerResult.outcome!=="unknown","TASK4_CLEANUP_UNKNOWN");
    const artifacts=readTask4InnerArtifactsV1(root,innerResult.artifacts),cleanup=task4ArtifactV1(artifacts,innerResult.cleanup),render=task4ArtifactV1(artifacts,innerResult.render);
    validateTask4CleanupV1(cleanup,ready,innerOwner!,artifacts);validateTask4InnerRenderV1(render,ready,innerResult.outcome);
    const protocol=await import(pathToFileURL(path.join(setup.missionControl.source.root,"dist-server/services/control-ui-worker-protocol.js")).href);check();
    const lifecycle=await import(pathToFileURL(path.join(setup.missionControl.source.root,"scripts/ui-regression-lifecycle.mjs")).href);check();const native=lifecycle.resolveUiNativeDescriptorV1();native.check();
    validateTask4NativeChainV1(innerResult,cleanup,ready,artifacts,protocol.UiWorkerLifecycleRecordV1Schema,native);native.check();check();
    const pair={activationRef:before.readiness.ready.manifestActivationRef,activationHash:before.readiness.ready.manifestActivationHash,headRef:before.readiness.ready.manifestHeadRef,headHash:before.readiness.ready.manifestHeadHash,admissionReadyHash:before.readiness.ready.admissionReadyHash};
    for(const phase of ["before","after"] as const)validateTask4InnerObservationV1(task4ArtifactV1(artifacts,innerResult.observations[phase]),ready,phase,pair);
    const queryLedgers=[...artifacts.values()].filter(v=>v.schema==="mission-control.task4-inner-query-ledger.v1");requireV1(queryLedgers.length===1,"TASK4_DATABASE_REFUSED");
    validateTask4QueryLedgerV1(queryLedgers[0],ready,innerResult.observations,queryRecipes);
    const network=task4ArtifactV1(artifacts,render.network),filesystem=task4ArtifactV1(artifacts,render.filesystem);
    networkBuild.check();check();validateTask4NetworkV1(network,ready,cleanup,artifacts,networkRecipes);networkBuild.check();check();validateTask4FilesystemV1(filesystem,ready,artifacts);verifyTask4FinalFilesystemV1(filesystem,artifacts);
    await validateTask4PolicyProbeV1(root,ready,innerOwner!,network,artifacts);check();networkComplete=true;
    const mockReceipt=readTask4FixedJsonV1(root,"policy-probe-mock.json");assertTask4ConsumedArtifactsV1(innerResult,artifacts,[mockReceipt.before,mockReceipt.after]);
    if(serverOwner)requireV1(sameV1(task4ArtifactV1(artifacts,cleanup.server.observed).owner,serverOwner),"TASK4_SQL_ORIGINALS_UNKNOWN");
    stage="after_probes";predicate="none";await probes();stage="after_audit";const after=await observeAudit("After");check();
    stage="after_audit_equal";predicate="audit_equal";
    requireV1(sameV1(before.seed,after.seed)&&sameV1(before.grants,after.grants)&&sameV1(before.catalog,after.catalog)
      &&sameV1(evidence.readinessBefore,evidence.readinessAfter)&&sameV1(evidence.untouchedBefore,evidence.untouchedAfter),"TASK4_DATABASE_REFUSED");auditComplete=true;
    stage="watcher_settle";predicate="none";stopWatcher=true;if(watcher){await watcher;watcher=null;}
    stage="observer_release";await closeReader(observer,observerConnection);observer=null;observerConnection=null;
    stage="probe_release";await closeReader(probe,probeConnection);probe=null;probeConnection=null;
    stage="final_backend_census";await observeMainBackends();check();stage="watcher_success";predicate="watcher_success";requireV1(!watchFailure&&!failed,"TASK4_SQL_ORIGINALS_UNKNOWN");
    stage="restricted_absence";predicate="restricted_absence";const live=await admin.unsafe("SELECT pid FROM pg_stat_activity WHERE usename=$1 OR (datname=$2 AND application_name LIKE 'task4_%') LIMIT 1",[role,fixture.database]);check();requireV1(live.length===0,"TASK4_SQL_ORIGINALS_UNKNOWN");
    stage="pg_prefix_first";predicate="none";const firstPrefix=capture.read();await new Promise(resolve=>setTimeout(resolve,100));check();
    stage="pg_prefix_second";const raw=capture.read();stage="pg_prefix_equal";predicate="prefix_equal";requireV1(raw.equals(firstPrefix),"TASK4_SQL_ORIGINALS_UNKNOWN");
    stage="pg_parse";predicate="none";const parsing={predicate:"none"};let parsed:ReadonlyArray<Readonly<RecordV1>>;
    try{parsed=parseTask4PgLogV1(raw,id,fixture.database,issued,[...backends.values()],parsing);}finally{predicate=parsing.predicate;}
    stage="pg_chunks";predicate="none";const chunks=retainTask4PgChunksV1(root,raw,parsed);
    stage="pg_events";const events=settleTask4PgEventsV1(parsed,[...backends.values()],chunks);
    // Actual source-issued observer/probe calls must each be represented by their own received PG record.
    const used=new Set<number>();
    stage="parent_query_match";for(const call of parentCalls){
      predicate="parent_query_owner";
      const owners=[...backends.values()].filter(b=>b.applicationName===call.applicationName&&sameV1(b.clientIdentity,context.owner));requireV1(owners.length===1&&call.finishedAt!==null,"TASK4_SQL_ORIGINALS_UNKNOWN");
      predicate="parent_query_event";const matches=events.filter(e=>!used.has(e.seq)&&e.backendPid===owners[0]!.pid&&e.backendStartedAt===owners[0]!.startedAt&&e.statementHash===call.statementHash
        &&e.at>=call.startedAt&&e.at<=call.finishedAt&&(call.outcome==="error"?e.kind==="error"&&e.sqlstate===call.sqlstate:e.kind==="statement"&&e.sqlstate===null));
      requireV1(matches.length>=1,"TASK4_SQL_ORIGINALS_UNKNOWN");used.add(matches[0]!.seq);
    }
    stage="inner_query_match";predicate="inner_query_event";for(const query of queryLedgers[0]!.queries){
      const matches=events.filter(e=>!used.has(e.seq)&&e.backendPid===query.backendPid&&e.backendStartedAt===query.backendStartedAt&&e.statementHash===query.statementHash
        &&e.kind==="statement"&&e.sqlstate===null&&e.at>=query.startedAt&&e.at<=query.finishedAt);
      requireV1(matches.length>=1,"TASK4_SQL_ORIGINALS_UNKNOWN");used.add(matches[0]!.seq);
    }
    stage="audit_publish";predicate="none";requireV1(finalAudit!==null,"TASK4_SQL_ORIGINALS_UNKNOWN");
    evidence.auditAfter=put({...finalAudit as RecordV1,backendCensuses:censuses,parentQueries:parentCalls,capture:{scope:"closed_restricted_sessions_original_pg_prefix",startOffset:capture.startOffset,
      initialPrefixHash:capture.initialPrefixHash,bytes:raw.length,sha256:hashV1(raw),stableReads:2,restrictedBackendsAbsent:true,postmasterStreamClosed:false}});
    stage="probe_calibration";const settledProbes=probeResults.map(value=>{const {startedAt,finishedAt,...proof}=value;const originalEvents=events.filter(e=>e.backendPid===value.backendPid&&e.backendStartedAt===value.backendStartedAt&&e.clientRole==="probe"&&e.statementHash===value.statementHash&&e.at>=startedAt&&e.at<=finishedAt).map(e=>e.seq);
      requireV1(originalEvents.some(seq=>events[seq-1]!.kind==="error"&&events[seq-1]!.sqlstate==="42501"),"TASK4_SQL_ORIGINALS_UNKNOWN");return {...proof,originalEvents};});
    requireV1(settledProbes.length===14,"TASK4_SQL_ORIGINALS_UNKNOWN");
    const errorStatementsCaptured=settledProbes.every(p=>p.originalEvents.some((seq:number)=>events[seq-1]!.kind==="statement"&&events[seq-1]!.sqlstate==="42501"));
    requireV1(errorStatementsCaptured,"TASK4_SQL_ORIGINALS_UNKNOWN");
    stage="sql_publish";evidence.sqlLedger=put({schema:"setfarm.task4-parent-sql-ledger.v1",executionId:id,setupDescriptorHash:ready.setupDescriptorHash,readyDescriptorHash:hashV1(task4CanonicalV1(ready)+"\n"),
      settings:{restrictedRole:role,logStatement:"all",parameterMaxLength:0,errorParameterMaxLength:0,errorStatementsCaptured},backends:[...backends.values()].sort((a,b)=>a.pid-b.pid),
      originals:chunks.map(({start,...ref})=>ref),events,probes:settledProbes,complete:true});sqlComplete=true;
    // All restricted readers are closed. The two helper clients and owned admin remain for the one guarded cleanup.
    stage="parent_cleanup";requireV1(task4ParentCleanupSafeV1({outcome:innerResult.outcome,integrity:innerResult.integrity,owner:innerOwner,exit:innerExit,auditComplete,sqlComplete,networkComplete,
      readers:{opened:2,closed:readers.closed,pending:0}}),"TASK4_CLEANUP_UNKNOWN");check();
    stage="database_cleanup";cleanupAttempted=true;await fixture.cleanup();readers.closed+=2;check();
    const absent=await admin.unsafe("SELECT datname FROM pg_database WHERE datname=$1",[fixture.database]);check();requireV1(absent.length===0,"TASK4_CLEANUP_UNKNOWN");databaseAbsent=true;
    stage="role_cleanup";await admin.unsafe(`DROP ROLE "${role}"`);check();const removed=await admin.unsafe("SELECT rolname FROM pg_roles WHERE rolname=$1",[role]);check();requireV1(removed.length===0,"TASK4_CLEANUP_UNKNOWN");roleAbsent=true;
  }catch(error){firstFailure??=task4FailureDetailV1(stage,predicate,error);
    failed=true;const message=error instanceof Error?error.message:"";code=TASK4_CODES_V1.includes(message)?message:"TASK4_INTEGRITY_FAILED";}
  finally {
    if(originalChild){innerExit=await originalChild;originalChild=null;}
    stopWatcher=true;if(watcher){await watcher;watcher=null;}
    stage="finalizer_observer_release";predicate="none";await closeReader(observer,observerConnection);stage="finalizer_probe_release";await closeReader(probe,probeConnection);
    if(fixture&&!cleanupAttempted){stage="finalizer_fixture_close";try{await fixture.db.pgClose();readers.closed++;}catch(error){firstFailure??=task4FailureDetailV1(stage,predicate,error);failed=true;code="TASK4_CLEANUP_UNKNOWN";}}
    stage="finalizer_admin_end";await closeReader(admin,null);capture?.close();
    readers.pending=readers.opened-readers.closed;
    if(firstFailure){publishTask4ParentFailureV1(root,id,firstFailure,watcherFailure);publishTask4BackendFailureV1(root,backendFailure);}
    try {if(ready&&projection&&fixture){check();const outcome=failed?"unknown":innerResult?.outcome??"unknown";
      const value={schema:"setfarm.task4-parent-result.v1",executionId:id,setupDescriptorHash:ready.setupDescriptorHash,readyDescriptorHash:hashV1(task4CanonicalV1(ready)+"\n"),fixtureOwner:context.owner,
        outcome,code:outcome==="pass"?null:failed?code:innerResult!.code,integrity:failed?"failed":"verified",projection,database:{name:fixture.database,role:ready.database.role},
        inner:{owner:innerOwner,exit:innerExit,result:innerRef},evidence,cleanup:{readers,databaseAbsent,roleAbsent}};
      validateTask4ParentEnvelopeV1(value,setup,context.owner);publishTask4ProofV1(root,"parent-result.json",value);check();}}
    finally{for(const pin of pins.reverse())pin.close();context.close();}
  }
  if(failed||innerResult?.outcome!=="pass")throw new Error(failed?code:innerResult!.code);
}
function settleTask4PgEventsV1(parsed:ReadonlyArray<Readonly<RecordV1>>,backends:ReadonlyArray<Readonly<RecordV1>>,originals:ReadonlyArray<Readonly<RecordV1>>):ReadonlyArray<Readonly<RecordV1>> {
  try {
    requireV1(parsed.length<=8192&&backends.length<=64&&originals.length<=64);const events:RecordV1[]=[];
    for(const row of parsed){
      if(row.scope==="postmaster")continue;
      requireV1(row.scope==="restricted"&&row.queryId!=="unknown"&&row.classification!=="unknown"&&!row.classification.startsWith("forbidden_")&&!row.classification.startsWith("dormant_"));
      const matches=backends.filter(b=>b.pid===row.pid);requireV1(matches.length===1);const backend=matches[0]!;
      requireV1(backend.applicationName===row.applicationName&&Math.floor(Date.parse(backend.startedAt)/1000)===Number.parseInt(row.session.split(".")[0],16));
      const original=originals.filter(o=>row.offset>=o.start&&row.offset+row.length<=o.start+o.bytes);requireV1(original.length===1);
      requireV1(["LOG","ERROR","STATEMENT"].includes(row.kind));
      if(backend.clientRole==="mc"){
        requireV1(row.queryId.startsWith("mc_"));
        if(row.kind==="ERROR"||row.kind==="STATEMENT")requireV1((row.classification==="optional_read"&&row.sqlstate==="42P01")
          ||(row.classification.startsWith("known_")&&["25006","42501"].includes(row.sqlstate)));
        if(row.classification.startsWith("known_")&&row.kind==="LOG")requireV1(parsed.some(other=>other.pid===row.pid&&other.session===row.session&&other.statementHash===row.statementHash
          &&other.kind==="ERROR"&&["25006","42501"].includes(other.sqlstate)&&other.capturedAt>=row.capturedAt));
      }else if(backend.clientRole==="probe"){
        requireV1(["parent_probe","parent_transaction","parent_identity","driver_startup"].includes(row.classification));
        if(row.kind!=="LOG")requireV1(row.classification==="parent_probe"&&row.sqlstate==="42501");
      }else {requireV1(backend.clientRole==="observer"&&["parent_observer","inner_observer","driver_startup"].includes(row.classification)&&row.kind==="LOG");}
      events.push({seq:events.length+1,backendPid:backend.pid,backendStartedAt:backend.startedAt,clientRole:backend.clientRole,at:row.capturedAt,
        kind:row.kind==="LOG"||row.kind==="STATEMENT"?"statement":"error",queryId:row.queryId,statementHash:row.statementHash,sqlstate:row.sqlstate==="00000"?null:row.sqlstate,
        originalSeq:original[0]!.seq,originalOffset:row.offset-original[0]!.start,originalLength:row.length});
    }
    return freezeV1(events);
  }catch{return refuseV1("TASK4_SQL_ORIGINALS_UNKNOWN");}
}
function task4ParentCleanupSafeV1(value:Readonly<RecordV1>):boolean {
  return ["pass","fail","cancelled"].includes(value.outcome)&&value.integrity==="verified"&&value.owner!==null
    &&value.exit?.exitObserved===true&&value.exit?.closeObserved===true&&value.exit?.signal===null
    &&value.exit?.code===({pass:0,fail:1,cancelled:130} as Record<string,number>)[value.outcome]
    &&value.auditComplete===true&&value.sqlComplete===true&&value.networkComplete===true
    &&value.readers?.pending===0&&Number.isSafeInteger(value.readers?.opened)&&value.readers.opened===value.readers.closed;
}
const TASK4_SOCKET_PREDICATES_V1=Object.freeze(["port","input_size_or_termination","pid","fd_owner","endpoint_owner_or_duplicate","state_duplicate","client_established","client_port","endpoint_shape","field_tag","row_cap","parent_scope","parent_time_wait_unique"]);
type Task4SocketDiagnosticV1={predicate:string;line:number;endpointLine:number};
type Task4ParentTimeWaitSocketV1={pid:number;port:number;state:"TIME_WAIT";endpointLine:number};
type Task4ParentSocketScopeV1={fixturePid:number;selectedPorts:readonly unknown[];parentTimeWait:Task4ParentTimeWaitSocketV1[]};
function parseTask4SocketsV1(text:string,postgresPort:number,diagnostic?:Task4SocketDiagnosticV1,scope?:Task4ParentSocketScopeV1):ReadonlyArray<Readonly<{pid:number;port:number}>> {
  try {
    let lineNumber=0,endpointLine=0;
    const note=(predicate:string)=>{if(diagnostic){diagnostic.predicate=predicate;diagnostic.line=lineNumber;diagnostic.endpointLine=endpointLine;}};
    note("port");integerV1(postgresPort,1024,65535);note("input_size_or_termination");requireV1(Buffer.byteLength(text)<=1048576&&(!text||text.endsWith("\n")));
    const rows:Array<{pid:number;port:number}>=[],tails:Task4ParentTimeWaitSocketV1[]=[];let pid=0,endpoint:string|null=null,state:string|null=null;
    const validateScope=()=>{if(scope){note("parent_scope");integerV1(scope.fixturePid);requireV1(Array.isArray(scope.selectedPorts)&&scope.selectedPorts.length<=64&&Array.isArray(scope.parentTimeWait)&&scope.parentTimeWait.length===0);
      for(const port of scope.selectedPorts)integerV1(port,1024,65535);requireV1(new Set(scope.selectedPorts).size===scope.selectedPorts.length);}};
    const flush=()=>{if(endpoint!==null){const match=/^127\.0\.0\.1:([1-9][0-9]*)->127\.0\.0\.1:([1-9][0-9]*)$/.exec(endpoint);
      if(match&&Number(match[2])===postgresPort){
        if(state==="TIME_WAIT"&&scope){validateScope();note("client_established");requireV1(pid===scope.fixturePid&&!scope.selectedPorts.includes(Number(match[1])));
          const port=Number(match[1]);note("client_port");integerV1(port,1024,65535);tails.push({pid,port,state:"TIME_WAIT",endpointLine});
        }else{note("client_established");requireV1(state==="ESTABLISHED");const port=Number(match[1]);note("client_port");integerV1(port,1024,65535);rows.push({pid,port});}}
      else {note("endpoint_shape");requireV1(endpoint===`127.0.0.1:${postgresPort}`||new RegExp(`^127\\.0\\.0\\.1:${postgresPort}->127\\.0\\.0\\.1:[1-9][0-9]*$`).test(endpoint));}}
      endpoint=null;state=null;endpointLine=0;};
    const lines=text.split("\n");
    for(const entry of lines.map((line,index)=>({line,index})).filter(entry=>Boolean(entry.line))){
      const {line,index}=entry;lineNumber=index+1;
      if(/^p[1-9][0-9]*$/.test(line)){flush();pid=Number(line.slice(1));note("pid");integerV1(pid);}
      else if(/^f[0-9]+[a-z]*$/.test(line)){flush();note("fd_owner");requireV1(pid>0);}
      else if(line.startsWith("n")){note("endpoint_owner_or_duplicate");requireV1(endpoint===null&&pid>0);endpoint=line.slice(1);endpointLine=lineNumber;}
      else if(line.startsWith("TST=")){note("state_duplicate");requireV1(state===null);state=line.slice(4);}
      else {note("field_tag");requireV1(/^T(?:QR|QS|SO|SS)=/.test(line));}
    }lineNumber=lines.length;flush();note("row_cap");requireV1(rows.length+tails.length<=64);validateScope();
    note("parent_time_wait_unique");for(const tail of tails)requireV1(tails.filter(row=>row.port===tail.port).length===1&&!rows.some(row=>row.port===tail.port));
    if(scope)scope.parentTimeWait.push(...freezeV1(tails));return freezeV1(rows);
  }catch{return refuseV1("TASK4_SQL_ORIGINALS_UNKNOWN");}
}
function bindTask4BackendV1(row:Readonly<RecordV1>,ready:Readonly<RecordV1>,parent:Readonly<RecordV1>,inner:Readonly<RecordV1>|null,server:Readonly<RecordV1>|null,
  sockets:ReadonlyArray<Readonly<{pid:number;port:number}>>,processes:ReadonlyMap<number,Readonly<RecordV1>>):Readonly<RecordV1> {
  try {
    keysV1(row,"pid startedAt role database applicationName host port");integerV1(row.pid);integerV1(row.port,1024,65535);
    requireV1(/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{6}Z$/.test(row.startedAt)&&row.role===ready.database.role&&row.database===ready.database.name&&row.host==="127.0.0.1");
    const candidates=sockets.filter(s=>s.port===row.port);requireV1(candidates.length===1);const owner=processes.get(candidates[0]!.pid);requireV1(owner);processV1(owner);
    let clientRole:string;if(row.applicationName==="task4_mc_"+ready.executionId){requireV1(server!==null&&sameV1(owner,server));clientRole="mc";}
    else if(row.applicationName==="task4_probe_"+ready.executionId){requireV1(sameV1(owner,parent));clientRole="probe";}
    else {requireV1(row.applicationName==="task4_observer_"+ready.executionId&&(sameV1(owner,parent)||(inner!==null&&sameV1(owner,inner))));clientRole="observer";}
    return freezeV1({pid:row.pid,startedAt:row.startedAt,role:row.role,database:row.database,applicationName:row.applicationName,clientRole,clientIdentity:owner});
  }catch{return refuseV1("TASK4_SQL_ORIGINALS_UNKNOWN");}
}
function task4UiOwnerV1(owner:Readonly<RecordV1>,mcRoot:string):Readonly<RecordV1> {
  processV1(owner);return Object.freeze({pid:owner.pid,processStartedAt:owner.startedAt,processGroupId:owner.pgid,source:"observed_os",
    executable:owner.executable,script:path.join(mcRoot,"scripts/render-smoke.mjs"),commandHash:owner.commandHash});
}
function task4ArtifactV1(artifacts:ReadonlyMap<string,Readonly<RecordV1>>,ref:unknown):Readonly<RecordV1> {
  proofRefV1(ref);const value=artifacts.get(ref.sha256);requireV1(value!==undefined);
  const bytes=Buffer.from(task4CanonicalV1(value)+"\n");requireV1(bytes.length===ref.bytes&&hashV1(bytes)===ref.sha256);return value;
}
function task4BoundServerPortV1(observed:Readonly<RecordV1>,ready:Readonly<RecordV1>,artifacts:ReadonlyMap<string,Readonly<RecordV1>>):number {
  keysV1(observed,"schema executionId setupDescriptorHash readyDescriptorHash intent owner listener");artifactBindingV1(observed,ready);
  requireV1(observed.schema==="mission-control.task4-server-observed.v1");proofRefV1(observed.intent);processV1(observed.owner);
  const listener=task4ArtifactV1(artifacts,observed.listener);
  keysV1(listener,"schema executionId setupDescriptorHash readyDescriptorHash endpointRole host port at state owner original");artifactBindingV1(listener,ready);
  requireV1(listener.schema==="mission-control.task4-listener.v1"&&listener.endpointRole==="mc"&&listener.host==="127.0.0.1"&&listener.state==="listening"
    &&sameV1(listener.owner,observed.owner)&&sameV1(listener.original,{method:"owned_child_socket_census",observed:true}));timeV1(listener.at);
  integerV1(listener.port,1024,65535);requireV1(![3080,3333,5432,13081,18789,ready.setup.postgres.port].includes(listener.port));return listener.port;
}
function validateTask4CleanupV1(value:unknown,ready:Readonly<RecordV1>,innerOwner:Readonly<RecordV1>,artifacts:ReadonlyMap<string,Readonly<RecordV1>>):void {
  try {
    keysV1(value,"schema executionId setupDescriptorHash readyDescriptorHash ownerHash nativeAudit mock server readers contexts complete");
    requireV1(value.schema==="mission-control.render-smoke-inner-cleanup.v1"&&value.complete===true);artifactBindingV1(value,ready);
    const uiOwner=task4UiOwnerV1(innerOwner,ready.setup.missionControl.source.root);
    // Existing UI helper convention: C(owner), with NO LF. File references use F.
    requireV1(value.ownerHash===hashV1(task4CanonicalV1(uiOwner)));
    keysV1(value.nativeAudit,"jobId intentHash owner state children");const native=value.nativeAudit;
    requireV1(/^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(native.jobId)
      &&native.intentHash===value.readyDescriptorHash&&sameV1(native.owner,uiOwner)&&["not_started","closed"].includes(native.state)
      &&Array.isArray(native.children)&&native.children.length<=1);
    for(const child of native.children){keysV1(child,"spawnId owner state");requireV1(["not_started","closed"].includes(child.state));}
    if(native.state==="not_started")requireV1(native.children.every((c:RecordV1)=>c.state==="not_started"));
    if(native.state==="closed")requireV1(native.children.length===1&&native.children[0].state==="closed");
    // The separate native-chain validator uses the measured unchanged MC protocol schema.
    for(const [key,cap] of [["readers",16],["contexts",6]] as const){keysV1(value[key],"opened closed pending");
      for(const n of Object.values(value[key]))integerV1(n,0,cap);requireV1(value[key].pending===0&&value[key].opened===value[key].closed);}
    const listener=(ref:unknown,role:string,state:string,owner:Readonly<RecordV1>|null)=>{
      const v=task4ArtifactV1(artifacts,ref);keysV1(v,"schema executionId setupDescriptorHash readyDescriptorHash endpointRole host port at state owner original");
      artifactBindingV1(v,ready);requireV1(v.schema==="mission-control.task4-listener.v1"&&v.endpointRole===role&&v.host==="127.0.0.1"&&v.state===state&&sameV1(v.owner,owner));
      integerV1(v.port,1024,65535);requireV1(![3080,3333,5432,13081,18789,ready.setup.postgres.port].includes(v.port));timeV1(v.at);
      keysV1(v.original,"method observed");requireV1(v.original.observed===true&&v.original.method===(role==="mc"?"owned_child_socket_census":"owned_http_server"));return v;
    };
    keysV1(value.mock,"state listen closeCallback acceptedConnections closedConnections listenerAfter");const mock=value.mock;
    requireV1(["not_started","closed"].includes(mock.state));integerV1(mock.acceptedConnections,0,4096);integerV1(mock.closedConnections,0,4096);
    if(mock.state==="closed"){
      requireV1(mock.closeCallback===true&&mock.acceptedConnections===mock.closedConnections);
      const a=listener(mock.listen,"mock","listening",innerOwner),b=listener(mock.listenerAfter,"mock","absent",null);requireV1(a.port===b.port&&b.at>=a.at);
    }else requireV1(mock.listen===null&&mock.listenerAfter===null&&mock.closeCallback===false&&mock.acceptedConnections===0&&mock.closedConnections===0);
    keysV1(value.server,"state intent observed settled");const server=value.server;requireV1(["not_started","closed"].includes(server.state));
    if(server.state==="not_started")requireV1(server.intent===null&&server.observed===null&&server.settled===null);
    else {
      const intent=task4ArtifactV1(artifacts,server.intent),observed=task4ArtifactV1(artifacts,server.observed),settled=task4ArtifactV1(artifacts,server.settled);
      keysV1(intent,"schema executionId setupDescriptorHash readyDescriptorHash parentOwner executable executableHash entry entryHash argvHash environmentHash policyHash launcherHash");
      keysV1(observed,"schema executionId setupDescriptorHash readyDescriptorHash intent owner listener");
      keysV1(settled,"schema executionId setupDescriptorHash readyDescriptorHash intent observed owner exit stop listenerBefore listenerAfter");
      for(const v of [intent,observed,settled])artifactBindingV1(v,ready);
      requireV1(intent.schema==="mission-control.task4-server-intent.v1"&&observed.schema==="mission-control.task4-server-observed.v1"&&settled.schema==="mission-control.task4-server-settled.v1");
      requireV1(sameV1(intent.parentOwner,innerOwner)&&intent.executable===innerOwner.executable&&intent.executableHash===innerOwner.executableHash
        &&intent.entry===path.join(ready.setup.missionControl.source.root,"dist-server/index.js")&&intent.argvHash===hashV1(task4CanonicalV1([intent.entry])));
      for(const key of ["entryHash","environmentHash","policyHash","launcherHash"])hexV1(intent[key]);
      requireV1(sameV1(observed.intent,server.intent)&&sameV1(settled.intent,server.intent)&&sameV1(settled.observed,server.observed)
        &&sameV1(observed.owner,settled.owner)&&sameV1(observed.listener,settled.listenerBefore));processV1(observed.owner);
      requireV1(observed.owner.ppid===innerOwner.pid&&observed.owner.executable===innerOwner.executable&&observed.owner.executableHash===innerOwner.executableHash
        &&observed.owner.commandHash===hashV1([innerOwner.executable,intent.entry].join(" ")));
      keysV1(settled.exit,"code signal exitObserved closeObserved");requireV1(settled.exit.exitObserved===true&&settled.exit.closeObserved===true);
      if(settled.stop==="original_child_sigterm")requireV1((settled.exit.code===null&&settled.exit.signal==="SIGTERM")||(settled.exit.code===0&&settled.exit.signal===null));
      else requireV1(settled.stop==="exited_before_stop"&&Number.isSafeInteger(settled.exit.code)&&settled.exit.signal===null);
      const serverPort=task4BoundServerPortV1(observed,ready,artifacts);
      const a=listener(settled.listenerBefore,"mc","listening",observed.owner),b=listener(settled.listenerAfter,"mc","absent",null);
      requireV1(a.port===serverPort&&b.port===serverPort&&b.at>=a.at);
      if(mock.state==="closed")requireV1(serverPort!==task4ArtifactV1(artifacts,mock.listen).port);
    }
  }catch{return refuseV1("TASK4_CLEANUP_UNKNOWN");}
}

function validateTask4NativeChainV1(result:Readonly<RecordV1>,cleanup:Readonly<RecordV1>,ready:Readonly<RecordV1>,artifacts:ReadonlyMap<string,Readonly<RecordV1>>,schema:{parse(value:unknown):unknown},descriptor:Readonly<RecordV1>):void {
  try {
    const chains=result.artifacts.native,audit=cleanup.nativeAudit;requireV1(Array.isArray(chains)&&chains.length<=1&&Array.isArray(audit.children)&&chains.length===audit.children.length);
    const argv=['--headless','--user-data-dir='+path.join(ready.setup.resourceRoot.path,'inner/profile'),'--no-first-run','--no-default-browser-check','--disable-background-networking','--disable-extensions','--disable-component-update','--disable-sync','--metrics-recording-only','--disable-default-apps','--disable-features=MediaRouter,OptimizationHints,Translate','--use-mock-keychain','--password-store=basic','--remote-debugging-address=127.0.0.1','--remote-debugging-port=0','about:blank'];
    requireV1(audit.intentHash===hashV1(task4CanonicalV1(ready)+"\n"));
    if(chains.length===0)requireV1(audit.state==="not_started");
    for(const chain of chains){
      keysV1(chain,"spawnId intent observed settled closed notStarted");
      const child=audit.children.find((c:RecordV1)=>c.spawnId===chain.spawnId);requireV1(child!==undefined);
      const leaf=(key:string,suffix:string)=>{const value=task4ArtifactV1(artifacts,chain[key]);schema.parse(value);
        requireV1(value.schema==="mission-control.ui-worker-child-"+suffix+".v1"&&value.jobId===audit.jobId&&value.intentHash===audit.intentHash&&value.spawnId===chain.spawnId);return value;};
      const intent=leaf("intent","intent");requireV1(intent.ownerHash===cleanup.ownerHash&&intent.expectedExecutable===descriptor.executable
        &&intent.executableHash===descriptor.executableHash&&intent.playwrightVersion===descriptor.playwrightVersion&&intent.browsersJsonHash===descriptor.browsersJsonHash
        &&intent.launchArgsHash===hashV1(task4CanonicalV1(argv)));
      if(chain.notStarted!==null){
        const never=leaf("notStarted","not-started");requireV1(never.launchIntentHash===chain.intent.sha256&&never.disposition==="never_invoked"
          &&chain.observed===null&&chain.settled===null&&chain.closed===null&&child.owner===null&&child.state==="not_started"&&audit.state==="not_started");
      }else {
        const observed=leaf("observed","observed"),settled=leaf("settled","settled"),closed=leaf("closed","closed");
        requireV1(audit.state==="closed"&&child.state==="closed"&&sameV1(child.owner,observed.owner)&&observed.parentPid===audit.owner.pid
          &&observed.launchIntentHash===chain.intent.sha256&&observed.owner.executable===descriptor.executable
          &&observed.owner.commandHash===hashV1([descriptor.executable,...argv].join(" "))&&settled.observedHash===chain.observed.sha256
          &&closed.observedHash===chain.observed.sha256&&closed.settlementHash===chain.settled.sha256);
        const root=settled.cohort.filter((c:RecordV1)=>c.owner.pid===observed.owner.pid);requireV1(root.length===1&&sameV1(root[0].owner,observed.owner)&&root[0].parentPidAtFirstObservation===audit.owner.pid);
        requireV1(settled.emptyCensuses[0].capturedAt>=observed.owner.processStartedAt);
      }
    }
    const reconciled=new Set<number>();
    for(const v of artifacts.values()){
      if(v.schema==="mission-control.ui-native-close-diagnostic.v1")refuseV1("TASK4_CLEANUP_UNKNOWN");
      if(v.schema!=="mission-control.ui-native-absence-witness.v1")continue;
      keysV1(v,"schema jobId intentHash ownerHash spawnId launchIntentHash observedHash owner censusRow previousCensus absenceCensus substep helper prefix");
      const chain=chains.find((c:RecordV1)=>c.spawnId===v.spawnId);requireV1(chain!==undefined&&chain.settled!==null&&chain.observed!==null&&chain.closed!==null
        &&v.jobId===audit.jobId&&v.intentHash===audit.intentHash&&v.ownerHash===cleanup.ownerHash&&v.launchIntentHash===chain.intent.sha256&&v.observedHash===chain.observed.sha256);
      const observed=task4ArtifactV1(artifacts,chain.observed),settled=task4ArtifactV1(artifacts,chain.settled);
      requireV1(v.owner.pid!==observed.owner.pid&&!reconciled.has(v.owner.pid)&&reconciled.size<256);reconciled.add(v.owner.pid);
      const retained=settled.cohort.filter((c:RecordV1)=>sameV1(c.owner,v.owner));requireV1(retained.length===1&&v.owner.executable===descriptor.executable&&v.owner.processGroupId===observed.owner.processGroupId);
      keysV1(v.censusRow,"pid ppid uid startedAt pgid");requireV1(v.censusRow.pid===v.owner.pid&&v.censusRow.pgid===v.owner.processGroupId
        &&v.censusRow.startedAt===v.owner.processStartedAt&&v.censusRow.uid===ready.fixtureOwner.uid);integerV1(v.censusRow.ppid,0);
      keysV1(v.previousCensus,"capturedAt metadataHash");keysV1(v.absenceCensus,"capturedAt metadataHash rowCount");
      for(const item of [v.previousCensus,v.absenceCensus]){timeV1(item.capturedAt);hexV1(item.metadataHash);}integerV1(v.absenceCensus.rowCount,1,32768);
      requireV1(v.previousCensus.capturedAt>=v.owner.processStartedAt&&v.absenceCensus.capturedAt>=v.previousCensus.capturedAt&&settled.emptyCensuses[0].capturedAt>=v.absenceCensus.capturedAt);
      requireV1(["args_before","comm","args_after"].includes(v.substep));
      keysV1(v.helper,"target classification fault exitObserved closeObserved exitCode exitSignal closeCode closeSignal stdoutBytes stderrBytes stdoutHash stderrHash");
      keysV1(v.helper.target,"pid form");requireV1(v.helper.target.pid===v.owner.pid&&v.helper.target.form===(v.substep==="comm"?"comm":"args")
        &&v.helper.classification==="clean_absence"&&v.helper.fault===null&&v.helper.exitObserved===true&&v.helper.closeObserved===true
        &&v.helper.exitCode===1&&v.helper.closeCode===1&&v.helper.exitSignal===null&&v.helper.closeSignal===null&&v.helper.stdoutBytes===0&&v.helper.stderrBytes===0
        &&v.helper.stdoutHash===hashV1("")&&v.helper.stderrHash===hashV1(""));
      keysV1(v.prefix,"metadata executableHash");
      if(v.substep==="args_before")requireV1(v.prefix.metadata===null&&v.prefix.executableHash===null);
      else {
        keysV1(v.prefix.metadata,"pid ppid uid startedAt pgid commandHash");
        for(const key of ["pid","ppid","uid","startedAt","pgid"])requireV1(v.prefix.metadata[key]===v.censusRow[key]);
        requireV1(v.prefix.metadata.commandHash===v.owner.commandHash&&v.prefix.executableHash===(v.substep==="comm"?null:hashV1(descriptor.executable)));
      }
    }
  }catch{return refuseV1("TASK4_CLEANUP_UNKNOWN");}
}

function readTask4InnerArtifactsV1(root:string,inventory:Readonly<RecordV1>):ReadonlyMap<string,Readonly<RecordV1>> {
  const pins:Array<{check():void;close():void}>=[];
  try {
    keysV1(inventory,"json png native totalBytes");requireV1(Array.isArray(inventory.json)&&inventory.json.length<=64&&Array.isArray(inventory.png)&&inventory.png.length<=6
      &&Array.isArray(inventory.native)&&inventory.native.length<=1);integerV1(inventory.totalBytes,0,168886272);
    for(const relative of ["","inner","inner/artifacts","inner/children"])pins.push(pinTask4DirectoryV1(path.join(root,relative),true));
    const expected=new Map<string,{ref:Task4RefV1;json:boolean;cap:number}>();let total=0;
    const add=(relative:string,ref:unknown,json:boolean,cap:number)=>{proofRefV1(ref,cap);requireV1(!expected.has(relative));expected.set(relative,{ref,json,cap});total+=ref.bytes;};
    for(const [kind,cap] of [["json",1048576],["png",16777216]] as const){let previous="";
      for(const ref of inventory[kind]){proofRefV1(ref,cap);requireV1(ref.sha256>previous);previous=ref.sha256;add("artifacts/"+ref.sha256+"."+kind,ref,kind==="json",cap);}}
    for(const chain of inventory.native){keysV1(chain,"spawnId intent observed settled closed notStarted");requireV1(/^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(chain.spawnId));
      for(const key of ["intent","observed","settled","closed","notStarted"])if(chain[key]!==null)add("children/"+chain.spawnId+"."+(key==="notStarted"?"not-started":key)+".json",chain[key],true,key==="settled"?1048576:16384);}
    requireV1(total===inventory.totalBytes);
    const actual:string[]=[];for(const dir of ["artifacts","children"]){const names=fs.readdirSync(path.join(root,"inner",dir));requireV1(names.length<=75);for(const name of names)actual.push(dir+"/"+name);}
    requireV1(sameV1(actual.sort(),[...expected.keys()].sort()));const values=new Map<string,Readonly<RecordV1>>();
    for(const [relative,item] of expected){
      for(const pin of pins)pin.check();const file=pinTask4FileV1(path.join(root,"inner",relative),item.cap);
      try {
        requireV1((fs.lstatSync(path.join(root,"inner",relative)).mode&0o777)===0o600&&file.hash===item.ref.sha256&&file.bytes.length===item.ref.bytes);
        if(item.json){const text=new TextDecoder("utf-8",{fatal:true,ignoreBOM:true}).decode(file.bytes),value=JSON.parse(text);
          requireV1(text===task4CanonicalV1(value)+"\n"&&value&&typeof value==="object"&&!Array.isArray(value));
          if(values.has(file.hash))requireV1(sameV1(values.get(file.hash),value));values.set(file.hash,freezeV1(value));
        }else requireV1(file.bytes.length>=24&&file.bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))&&file.bytes.subarray(12,16).toString("ascii")==="IHDR"
          &&file.bytes.readUInt32BE(16)===1440&&file.bytes.readUInt32BE(20)>=950&&file.bytes.readUInt32BE(20)<=32768);
        file.check();
      }finally{file.close();}
    }
    const finalNames:string[]=[];for(const dir of ["artifacts","children"])for(const name of fs.readdirSync(path.join(root,"inner",dir)))finalNames.push(dir+"/"+name);
    requireV1(sameV1(finalNames.sort(),[...expected.keys()].sort()));for(const pin of pins)pin.check();return values;
  }catch{return refuseV1("TASK4_INTEGRITY_FAILED");}finally{for(const pin of pins.reverse())pin.close();}
}

function validateTask4NetworkV1(value:unknown,ready:Readonly<RecordV1>,cleanup:Readonly<RecordV1>,artifacts:ReadonlyMap<string,Readonly<RecordV1>>,recipes:Readonly<RecordV1>):void {
  try {
    keysV1(value,"schema executionId setupDescriptorHash readyDescriptorHash policy browser mock osFence complete");artifactBindingV1(value,ready);
    requireV1(value.schema==="mission-control.task4-network-ledger.v1"&&value.complete===true);keysV1(recipes,"browser mock");
    const recipe=(kind:string,id:string,method:string)=>recipes[kind].find((v:RecordV1)=>v.pathId===id&&v.method===method);
    for(const kind of ["browser","mock"]){requireV1(Array.isArray(recipes[kind])&&recipes[kind].length>0&&recipes[kind].length<=512);const ids=new Set<string>();
      for(const v of recipes[kind]){keysV1(v,"pathId method path query");requireV1(typeof v.pathId==="string"&&/^[a-z][a-z0-9_]{0,63}$/.test(v.pathId)&&!ids.has(v.pathId+":"+v.method));ids.add(v.pathId+":"+v.method);
        requireV1(["GET","HEAD"].includes(v.method)&&typeof v.path==="string"&&v.path.startsWith("/")&&!v.path.startsWith("//")&&!/[?#\\\x00-\x20]/.test(v.path)
          &&typeof v.query==="string"&&v.query.length<=1024&&!/[#\x00-\x20]/.test(v.query));}}
    keysV1(value.policy,"recipeHash browserInstalledAt serverPolicyHash serverLaunchRef");timeV1(value.policy.browserInstalledAt);
    const intent=task4ArtifactV1(artifacts,cleanup.server.intent),observed=task4ArtifactV1(artifacts,cleanup.server.observed);
    const serverPort=task4BoundServerPortV1(observed,ready,artifacts),mockListen=task4ArtifactV1(artifacts,cleanup.mock.listen);
    integerV1(mockListen.port,1024,65535);requireV1(serverPort!==mockListen.port);
    requireV1(value.policy.recipeHash===hashV1(task4CanonicalV1(recipes))&&sameV1(value.policy.serverLaunchRef,cleanup.server.observed)
      &&value.policy.serverPolicyHash===intent.policyHash&&sameV1(observed.intent,cleanup.server.intent));
    keysV1(value.osFence,"coverage policyHash launcherHash serverOwner probe actualAllowed denialTelemetry");const fence=value.osFence;
    requireV1(fence.coverage==="server_launch_policy_bound_parent_probe_required"&&fence.policyHash===intent.policyHash&&fence.launcherHash===intent.launcherHash
      &&sameV1(fence.serverOwner,observed.owner)&&fence.probe==="parent_originals_required"&&fence.denialTelemetry==="unavailable");
    keysV1(fence.actualAllowed,"proxy sql");requireV1(fence.actualAllowed.sql==="parent_originals_required");
    const proxy=task4ArtifactV1(artifacts,fence.actualAllowed.proxy),expected=task4SeedV1(ready.setup.setfarm.source.sourceSha).productResponse;
    keysV1(proxy,"schema executionId setupDescriptorHash readyDescriptorHash at method pathId status bodyHash parsedHash authorityHash packetHash");artifactBindingV1(proxy,ready);timeV1(proxy.at);
    requireV1(proxy.schema==="mission-control.task4-proxy-observation.v1"&&proxy.method==="GET"&&recipe("browser",proxy.pathId,"GET")&&proxy.status===200
      &&proxy.parsedHash===hashV1(task4CanonicalV1(expected))&&proxy.authorityHash===expected.authorityHash&&proxy.packetHash===expected.packetAuthority.packetHash);hexV1(proxy.bodyHash);
    requireV1(Array.isArray(value.browser)&&value.browser.length>0&&value.browser.length<=4096&&Array.isArray(value.mock)&&value.mock.length>0&&value.mock.length<=4096);
    const requests=new Map<number,RecordV1>(),contexts=new Set<number>(),ended=new Set<number>();let nextRequest=1,nextContext=1;
    for(const [index,row] of value.browser.entries()){
      keysV1(row,"seq requestId contextId route at stage method target pathId urlHash decision status bodyHash failureCode");requireV1(row.seq===index+1&&TASK4_ROUTES_V1.includes(row.route));
      integerV1(row.requestId,1,4096);integerV1(row.contextId,1,6);timeV1(row.at);requireV1(row.at>=value.policy.browserInstalledAt&&row.target==="mc");
      const known=recipe("browser",row.pathId,row.method);requireV1(known!==undefined&&row.urlHash===hashV1("http://127.0.0.1:"+serverPort+known.path+(known.query?"?"+known.query:"")));
      if(!contexts.has(row.contextId)){requireV1(row.contextId===nextContext++);contexts.add(row.contextId);}
      if(row.stage==="intercept"){
        requireV1(row.requestId===nextRequest++&&!requests.has(row.requestId)&&row.decision==="continue"&&row.status===null&&row.bodyHash===null&&row.failureCode===null);requests.set(row.requestId,row);
      }else {
        const original=requests.get(row.requestId);requireV1(original!==undefined&&!ended.has(row.requestId)&&row.at>=original.at&&row.contextId===original.contextId&&row.route===original.route
          &&row.method===original.method&&row.pathId===original.pathId&&row.urlHash===original.urlHash&&row.decision==="observe");
        requireV1(row.stage==="response"&&row.failureCode===null);
        const legacyId="ac8cea43-7686-4d27-8092-1e3dd9207ca4";
        if(row.status===409)requireV1(row.method==="GET"&&row.route===`/setfarm/runs/${legacyId}`&&known.path===`/api/setfarm/runs/${legacyId}/product-build-authority`&&known.query===""
          &&row.bodyHash===hashV1(JSON.stringify({status:"unavailable",code:"SETFARM_PRODUCT_BUILD_AUTHORITY_NOT_READY",reason:"not_ready",upstreamStatus:409,upstreamCode:"RUNTIME_PACKET_RUN_NOT_V3"})));
        else integerV1(row.status,200,399);
        if(known.path==="/api/setfarm/runs/ad47fe65-4ec4-4fb5-89da-fff71eb4e79a/product-build-authority")requireV1(row.status===200);
        if(row.bodyHash!==null)hexV1(row.bodyHash);ended.add(row.requestId);
      }
    }
    requireV1(requests.size>0&&requests.size===ended.size);
    const mockRequests=new Set<number>();
    for(const [index,row] of value.mock.entries()){
      keysV1(row,"seq connectionId requestId at method pathId urlHash decision status responseHash finished closed");requireV1(row.seq===index+1);integerV1(row.connectionId,1,4096);integerV1(row.requestId,1,4096);timeV1(row.at);
      requireV1(!mockRequests.has(row.requestId)&&row.requestId===mockRequests.size+1&&row.connectionId<=cleanup.mock.acceptedConnections);mockRequests.add(row.requestId);
      const known=recipe("mock",row.pathId,row.method);requireV1(known!==undefined&&row.urlHash===hashV1("http://127.0.0.1:"+mockListen.port+known.path+(known.query?"?"+known.query:""))
        &&row.decision==="accepted"&&row.finished===true&&row.closed===true);hexV1(row.responseHash);
      if(row.status===409)requireV1(row.method==="GET"&&known.path==="/api/runs/ac8cea43-7686-4d27-8092-1e3dd9207ca4/product-build-authority"&&known.query===""
        &&row.responseHash===hashV1(JSON.stringify({code:"RUNTIME_PACKET_RUN_NOT_V3"})));
      else requireV1(row.status===200);
    }
    // This binds actual launch and permitted operations; the outer original policy probe is still required.
  }catch{return refuseV1("TASK4_NETWORK_REFUSED");}
}

function validateTask4FilesystemV1(value:unknown,ready:Readonly<RecordV1>,artifacts:ReadonlyMap<string,Readonly<RecordV1>>):void {
  try {
    keysV1(value,"schema executionId setupDescriptorHash readyDescriptorHash scope snapshots syncState operations complete");artifactBindingV1(value,ready);
    requireV1(value.schema==="mission-control.task4-filesystem-ledger.v1"&&value.scope==="owned_private_roots_and_explicit_source_pins"&&value.complete===true);
    requireV1(Array.isArray(value.snapshots)&&value.snapshots.length<=24);const roots:Record<string,string>={server_home:"server-home",server_runtime:"server-runtime",native_home:"home",native_profile:"profile",native_tmp:"tmp"};
    const first=new Map<string,RecordV1>(),last=new Map<string,RecordV1>(),pins=new Map<string,RecordV1>();
    for(const [index,row] of value.snapshots.entries()){
      keysV1(row,"seq phase at rootId rootPin entries");requireV1(row.seq===index+1&&Object.hasOwn(roots,row.rootId)&&["before_server","after_route","after_server_close"].includes(row.phase));timeV1(row.at);directoryV1(row.rootPin,true);
      requireV1(row.rootPin.path===path.join(ready.setup.resourceRoot.path,"inner",roots[row.rootId]!)&&row.rootPin.uid===ready.setup.resourceRoot.uid);
      if(pins.has(row.rootId))requireV1(sameV1(pins.get(row.rootId),row.rootPin));else pins.set(row.rootId,row.rootPin);
      const snapshot=task4ArtifactV1(artifacts,row.entries);keysV1(snapshot,"schema executionId setupDescriptorHash readyDescriptorHash rootId rootPin at entries");artifactBindingV1(snapshot,ready);
      requireV1(snapshot.schema==="mission-control.task4-filesystem-snapshot.v1"&&snapshot.rootId===row.rootId&&sameV1(snapshot.rootPin,row.rootPin)&&snapshot.at===row.at
        &&Array.isArray(snapshot.entries)&&snapshot.entries.length<=4096);
      let previous="";const directories=new Set<string>([""]);
      for(const entry of snapshot.entries){keysV1(entry,"relative kind uid mode dev ino bytes sha256 linkHash");requireV1(typeof entry.relative==="string"&&entry.relative.length>0&&entry.relative.length<=2048
          &&/^[\x21-\x7e ]+$/.test(entry.relative)&&!entry.relative.includes("\\")&&!path.isAbsolute(entry.relative)&&path.normalize(entry.relative)===entry.relative
          &&!entry.relative.split("/").some((part:string)=>part===".."||part==="."||part==="")&&entry.relative>previous);previous=entry.relative;
        requireV1(directories.has(path.dirname(entry.relative)==="."?"":path.dirname(entry.relative)));integerV1(entry.uid,0);integerV1(entry.mode,0,511);integerV1(entry.bytes,0,536870912);
        requireV1(entry.uid===row.rootPin.uid&&typeof entry.dev==="string"&&/^(0|[1-9][0-9]*)$/.test(entry.dev)&&typeof entry.ino==="string"&&/^[1-9][0-9]*$/.test(entry.ino));
        if(entry.kind==="file"){hexV1(entry.sha256);requireV1(entry.linkHash===null&&(entry.mode&0o022)===0);}
        else if(entry.kind==="directory"){requireV1(entry.sha256===null&&entry.linkHash===null&&entry.bytes===0&&(entry.mode&0o022)===0);directories.add(entry.relative);}
        else {requireV1(entry.kind==="symlink"&&entry.sha256===null);hexV1(entry.linkHash);}
      }
      if(row.phase==="before_server"){requireV1(!first.has(row.rootId)&&!last.has(row.rootId));first.set(row.rootId,snapshot);}
      if(row.phase==="after_server_close"){requireV1(!last.has(row.rootId));last.set(row.rootId,snapshot);}
      if(row.phase==="after_route")requireV1(!last.has(row.rootId));
    }
    requireV1(first.has("server_home")&&first.has("server_runtime")&&Object.keys(roots).every(id=>last.has(id)));
    for(const row of value.snapshots){
      if(!["server_home","server_runtime"].includes(row.rootId)||row.phase==="before_server")continue;
      const original=first.get(row.rootId)!,observed=task4ArtifactV1(artifacts,row.entries);
      if(row.rootId==="server_home")requireV1(sameV1(original.entries,observed.entries));
      else {
        const baseline=new Map<string,RecordV1>(original.entries.map((e:RecordV1)=>[e.relative,e]));
        const mutable=new Set(["setfarm/mc-sync-state.json","setfarm/mc-sync-state.json.tmp"]);
        for(const entry of observed.entries){
          if(mutable.has(entry.relative)){requireV1(entry.kind==="file");continue;}
          if(entry.relative==="setfarm"&&!baseline.has("setfarm")){requireV1(entry.kind==="directory");continue;}
          requireV1(baseline.has(entry.relative)&&sameV1(baseline.get(entry.relative),entry));
        }
        for(const entry of original.entries)if(!mutable.has(entry.relative))requireV1(observed.entries.some((e:RecordV1)=>sameV1(e,entry)));
      }
    }
    keysV1(value.syncState,"pathId before checkpoints after tmpAfter");const sync=value.syncState;requireV1(sync.pathId==="pipeline_sync_state"&&sync.tmpAfter==="absent"
      &&Array.isArray(sync.checkpoints)&&sync.checkpoints.length>0&&sync.checkpoints.length<=24&&sync.after!==null);
    const state=(v:unknown,checkpoint=false)=>{keysV1(v,checkpoint?"sha256 bytes finishedIds runningIds savedAt at route":"sha256 bytes finishedIds runningIds savedAt");
      requireV1(sameV1(v.finishedIds,[])&&Array.isArray(v.runningIds)&&sameV1([...v.runningIds].sort(),["ac8cea43-7686-4d27-8092-1e3dd9207ca4","ad47fe65-4ec4-4fb5-89da-fff71eb4e79a"]));timeV1(v.savedAt);
      const bytes=Buffer.from(JSON.stringify({finishedIds:v.finishedIds,runningIds:v.runningIds,savedAt:v.savedAt}));requireV1(v.bytes===bytes.length&&v.sha256===hashV1(bytes));
      if(checkpoint){timeV1(v.at);requireV1(v.at>=v.savedAt&&TASK4_ROUTES_V1.includes(v.route));}
    };
    if(sync.before!==null)state(sync.before);state(sync.after);for(const item of sync.checkpoints)state(item,true);
    const syncFile=(snapshot:RecordV1)=>snapshot.entries.filter((e:RecordV1)=>e.relative==="setfarm/mc-sync-state.json");
    const initial=syncFile(first.get("server_runtime")!),final=syncFile(last.get("server_runtime")!);
    requireV1(sync.before===null?initial.length===0:initial.length===1&&initial[0].sha256===sync.before.sha256&&initial[0].bytes===sync.before.bytes);
    requireV1(final.length===1&&final[0].kind==="file"&&final[0].sha256===sync.after.sha256&&final[0].bytes===sync.after.bytes
      &&!last.get("server_runtime")!.entries.some((e:RecordV1)=>e.relative==="setfarm/mc-sync-state.json.tmp"));
    requireV1(Array.isArray(value.operations)&&value.operations.length<=4096);
    for(const [index,row] of value.operations.entries()){
      keysV1(row,"seq at actor operation targetId outcome errno");timeV1(row.at);requireV1(row.seq===index+1&&row.actor==="inner"&&["create","write","publish","close"].includes(row.operation)
        &&["inner_root","server_home","server_runtime","mock","server","native","json_artifact","png_artifact","inner_result","sql_client","browser_context"].includes(row.targetId)
        &&row.outcome==="ok"&&row.errno===null);
    }
  }catch{return refuseV1("TASK4_RESOURCE_REFUSED");}
}

function validateTask4QueryLedgerV1(value:unknown,ready:Readonly<RecordV1>,observations:Readonly<RecordV1>,recipes:ReadonlyArray<Readonly<RecordV1>>):void {
  try {
    keysV1(value,"schema executionId setupDescriptorHash readyDescriptorHash scope queries complete");artifactBindingV1(value,ready);
    requireV1(value.schema==="mission-control.task4-inner-query-ledger.v1"&&value.scope==="inner_observer"&&value.complete===true&&Array.isArray(value.queries)&&value.queries.length<=256);
    requireV1(Array.isArray(recipes)&&recipes.length>0&&recipes.length<=128);const definitions=new Map<string,Readonly<RecordV1>>();
    const parameters:Record<string,string>={role:ready.database.role,database:ready.database.name,source_sha:ready.setup.setfarm.source.sourceSha};
    for(const row of recipes){keysV1(row,"queryId statement parametersRule requiredPhases");requireV1(typeof row.queryId==="string"&&/^[a-z][a-z0-9_]{0,63}$/.test(row.queryId)&&!definitions.has(row.queryId)
        &&typeof row.statement==="string"&&Buffer.byteLength(row.statement)>0&&Buffer.byteLength(row.statement)<=16384&&Array.isArray(row.parametersRule)&&row.parametersRule.length<=8
        &&row.parametersRule.every((key:unknown)=>typeof key==="string"&&Object.hasOwn(parameters,key))&&sameV1(row.requiredPhases,["before","after"]));definitions.set(row.queryId,row);}
    for(const id of ["identity","settings","current_pair","optional_step_metrics"])requireV1(definitions.has(id));
    requireV1(definitions.get("optional_step_metrics")!.statement==="SELECT to_regclass('public.step_metrics')::text AS relation"&&definitions.get("optional_step_metrics")!.parametersRule.length===0);
    const begin="BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY",commit="COMMIT",local="SET LOCAL statement_timeout = '5s'";
    let phaseIndex=0,active=false,backend:string|null=null,started=0,previousFinish="";const seen=new Set<string>();
    for(const [index,row] of value.queries.entries()){
      keysV1(row,"seq queryId phase backendPid backendStartedAt applicationName startedAt finishedAt statementHash parametersHash outcome sqlstate rowCount resultHash observation");
      requireV1(row.seq===index+1&&phaseIndex<2&&row.phase===["before","after"][phaseIndex]);integerV1(row.backendPid);
      requireV1(typeof row.backendStartedAt==="string"&&/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{6}Z$/.test(row.backendStartedAt)&&row.applicationName==="task4_observer_"+ready.executionId);
      timeV1(row.startedAt);timeV1(row.finishedAt);requireV1(row.finishedAt>=row.startedAt&&row.startedAt>=previousFinish);previousFinish=row.finishedAt;
      const recipe=definitions.get(row.queryId);requireV1(recipe!==undefined&&row.statementHash===hashV1(recipe.statement)
        &&row.parametersHash===hashV1(task4CanonicalV1(recipe.parametersRule.map((key:string)=>parameters[key]))));
      const key=row.phase+":"+row.queryId;requireV1(!seen.has(key));seen.add(key);const currentBackend=row.backendPid+":"+row.backendStartedAt;
      if(recipe.statement===begin){requireV1(!active&&recipe.parametersRule.length===0);active=true;backend=currentBackend;started=Date.parse(row.startedAt);}
      else requireV1(active&&backend===currentBackend);
      requireV1(row.sqlstate===null&&Date.parse(row.finishedAt)-started<=5000);
      if([begin,commit,local].includes(recipe.statement))requireV1(row.outcome==="command"&&row.rowCount===null&&row.resultHash===null&&row.observation===null&&recipe.parametersRule.length===0);
      else {requireV1(row.outcome==="rows");integerV1(row.rowCount,0,65536);hexV1(row.resultHash);proofRefV1(row.observation);requireV1(sameV1(row.observation,observations[row.phase]));}
      if(row.queryId==="optional_step_metrics")requireV1(row.rowCount===1&&row.resultHash===hashV1(task4CanonicalV1([{relation:null}])));
      if(recipe.statement===commit){for(const id of definitions.keys())requireV1(seen.has(row.phase+":"+id));active=false;backend=null;phaseIndex++;}
    }
    requireV1(phaseIndex===2&&!active);
  }catch{return refuseV1("TASK4_DATABASE_REFUSED");}
}

function buildTask4ReadyV1(setup:Readonly<RecordV1>,owner:Readonly<RecordV1>,projection:Readonly<RecordV1>,database:Readonly<RecordV1>,readiness:Readonly<RecordV1>,seed:Readonly<RecordV1>,grants:Readonly<RecordV1>):Readonly<RecordV1> {
  try {
    keysV1(readiness,"schema database parentPid projectionRoot projectedHead markerHash sourcePins status ready descriptorHash");
    requireV1(readiness.schema==="setfarm.owned-p3-readiness-observation.v1"&&readiness.database===database.name&&readiness.parentPid===owner.pid
      &&readiness.projectionRoot===projection.root.path&&readiness.projectedHead===projection.projectedHead&&readiness.markerHash===projection.markerHash);
    const {descriptorHash,...body}=readiness;requireV1(descriptorHash===hashV1(task4CanonicalV1(body)));
    const inventory=["src/db-pg.ts","tests/execution-attempts/test-database.ts","tests/execution-attempts/manual-test-admission-v1.isolated-pg.test.ts","src/internal-production/baseline-spawner-startup-admission-v1.js"];
    requireV1(Array.isArray(readiness.sourcePins)&&readiness.sourcePins.length===inventory.length);
    for(const [index,pin] of readiness.sourcePins.entries()){keysV1(pin,"relative sha256");requireV1(pin.relative===inventory[index]);hexV1(pin.sha256);}
    keysV1(readiness.status,"state admissionReady");keysV1(readiness.status.admissionReady,"admissionReadyHash admissionReadyRef");
    const r=readiness.ready;keysV1(r,"state admissionReadyRef admissionReadyHash manifestActivationRef manifestActivationHash manifestHeadRef manifestHeadHash");
    requireV1(readiness.status.state==="normal_task0_admission_ready"&&r.state==="normal-task0-admission-ready"
      &&r.admissionReadyHash===readiness.status.admissionReady.admissionReadyHash&&r.admissionReadyRef===readiness.status.admissionReady.admissionReadyRef
      &&r.admissionReadyRef==="setfarm://tests/p3/admission-ready/sha256/"+r.admissionReadyHash);
    for(const key of ["admissionReadyHash","manifestActivationHash","manifestHeadHash"])hexV1(r[key]);
    requireV1(typeof r.manifestActivationRef==="string"&&typeof r.manifestHeadRef==="string"
      &&r.admissionReadyHash===hashV1(JSON.stringify({activationHash:r.manifestActivationHash,activationRef:r.manifestActivationRef,headHash:r.manifestHeadHash,headRef:r.manifestHeadRef,schema:"setfarm.p3-projected-admission-ready.v1"})));
    validateTask4SeedV1(seed,setup.setfarm.source.sourceSha);validateTask4GrantsV1(grants,database.name,database.role);
    const ready={schema:"mission-control.render-smoke-fixture-ready.v1",executionId:setup.executionId,setup,setupDescriptorHash:hashV1(task4CanonicalV1(setup)+"\n"),fixtureOwner:owner,projection,database,
      fixture:{seedDigest:hashV1(task4CanonicalV1(seed)),privilegeDigest:hashV1(task4CanonicalV1(grants)),readinessDigest:descriptorHash,
        admissionReadyHash:r.admissionReadyHash,manifestActivationHash:r.manifestActivationHash,manifestHeadHash:r.manifestHeadHash}};
    readyV1(ready);return freezeV1(ready);
  }catch{return refuseV1("TASK4_BINDING_REFUSED");}
}

const TASK4_PG_SETTINGS_SQL_V1=`SELECT current_setting('log_destination') AS destination,current_setting('logging_collector') AS collector,
  current_setting('log_line_prefix') AS prefix,current_setting('log_error_verbosity') AS verbosity,current_setting('log_timezone') AS log_timezone,
  current_setting('TimeZone') AS timezone,current_setting('lc_messages') AS messages,current_setting('log_statement') AS statement,
  current_setting('log_min_error_statement') AS error_statement,current_setting('log_parameter_max_length') AS parameters,
  current_setting('log_parameter_max_length_on_error') AS error_parameters`;
function validateTask4PgSettingsV1(value:unknown,restricted:boolean):void {
  try {requireV1(sameV1(value,{destination:"stderr",collector:"off",prefix:"%m|%p|%c|%u|%d|%a|%e| ",verbosity:"terse",log_timezone:"UTC",timezone:"UTC",messages:"C",
    statement:restricted?"all":"none",error_statement:restricted?"error":"panic",parameters:"0",error_parameters:"0"}));}
  catch{return refuseV1("TASK4_SQL_ORIGINALS_UNKNOWN");}
}

type Task4RefV1=Readonly<{sha256:string;bytes:number}>;
// Exact pinned ordinary MC/driver statement material; classification is not permission.
const TASK4_MC_SQL_V1=Object.freeze([{"queryId":"mc_Q01","kind":"route_read","statement":"SELECT * FROM runs ORDER BY created_at DESC LIMIT 50","statementHash":"e01492f5584dd4f6a61d4e888b56bac9d3a1469f668c8d265c2d4dc4c0e448cc"},{"queryId":"mc_Q02","kind":"route_read","statement":"SELECT * FROM steps WHERE run_id = ANY($1) ORDER BY step_index","statementHash":"27adeb017cce39e867262016ce00fd444fa51f109cfcd1d40a563a76ef55df92"},{"queryId":"mc_Q03","kind":"route_read","statement":"SELECT run_id, status, COUNT(*)::int as cnt FROM stories WHERE run_id = ANY($1) GROUP BY run_id, status","statementHash":"8c2c9126aa0de43b0e9e55e8cf63fbd3b3246a468d181a108aa734d6a3d04506"},{"queryId":"mc_Q04","kind":"route_read","statement":"\n                SELECT run_id, story_index, story_id, title, status, retry_count, max_retries, output\n                FROM stories\n                WHERE run_id = ANY($1)\n                ORDER BY story_index\n            ","statementHash":"00d2e6860c196e5ae8b0be63981212164a54189e20801684de31d5d8135629a3"},{"queryId":"mc_Q05","kind":"route_read","statement":"\n            SELECT ro.created_at AS ts, ro.status, ro.summary, ro.detail, ro.step_id, ro.agent_id, ro.run_id, r.workflow_id\n            FROM run_observations ro\n            LEFT JOIN runs r ON r.id = ro.run_id\n            ORDER BY ro.created_at DESC\n            LIMIT $1\n        ","statementHash":"444ad00ab39cfa74fee1caa1798a8d0f63bc81787632cdbc2420b3ede6d97221"},{"queryId":"mc_Q06","kind":"route_read","statement":"\n                SELECT ro.created_at AS ts, ro.status, ro.summary, ro.detail, ro.step_id, ro.agent_id, ro.run_id, r.workflow_id\n                FROM run_observations ro\n                LEFT JOIN runs r ON r.id = ro.run_id\n                ORDER BY ro.created_at DESC\n                LIMIT $1\n            ","statementHash":"4aa247daf036f9fe2a52ab1edb0c1187d0cb9e86913af24d0572b88324dca65b"},{"queryId":"mc_Q07","kind":"optional_read","statement":"SELECT agent_id, AVG(duration_ms) as avg_dur FROM step_metrics GROUP BY agent_id","statementHash":"613e5a2da38c460faf215dc5c47bce82faf83e6fcf92cdcd10b2efbc204454cd"},{"queryId":"mc_Q08","kind":"route_read","statement":"\n            SELECT ro.created_at AS ts, ro.summary, ro.detail, ro.step_id, ro.run_id, r.workflow_id\n            FROM run_observations ro\n            LEFT JOIN runs r ON r.id = ro.run_id\n            WHERE ro.status = 'fail'\n            ORDER BY ro.created_at DESC\n            LIMIT 20\n        ","statementHash":"ca625dc1feb6a64586e0717e30b80c9228464885802d0a23915cbe235b2aa352"},{"queryId":"mc_Q09","kind":"project_read","statement":"\n    SELECT id, run_number, protocol, status, updated_at\n    FROM runs\n    WHERE id = ANY($1) OR run_number = ANY($2)\n    ORDER BY run_number DESC, id ASC\n  ","statementHash":"228bec12e2380decceace59fb8ea3fb7d8bcdbe18d5d0de9f5bf2d9e61103564"},{"queryId":"mc_Q10","kind":"detail_read","statement":"SELECT * FROM runs WHERE id = $1","statementHash":"128d2fce2adfaac5b17e693c406eca718c9305498ddcb22228d179cbf8389448"},{"queryId":"mc_Q11","kind":"detail_read","statement":"SELECT * FROM steps WHERE run_id = $1 ORDER BY step_index","statementHash":"e13d080b64fbf4beeb72d391cb2d08ab93867623644aeed5842e58e22aa099fc"},{"queryId":"mc_Q12","kind":"detail_read","statement":"SELECT * FROM stories WHERE run_id = $1 ORDER BY story_index","statementHash":"66e4eba5602426b960c7feada2ee168418b942c6f89627dd9625c0c84dd0cd74"},{"queryId":"mc_Q13","kind":"known_feed_setup_attempt","statement":"\n    CREATE TABLE IF NOT EXISTS agent_feed (\n      id SERIAL PRIMARY KEY,\n      agent_id TEXT NOT NULL,\n      agent_name TEXT NOT NULL,\n      message TEXT NOT NULL,\n      session_id TEXT,\n      msg_hash TEXT UNIQUE,\n      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()\n    )\n  ","statementHash":"c95b18c499c98878888c6db76bb389c102b10cae0c89d0b52196b7714cb6684f"},{"queryId":"mc_Q14","kind":"known_feed_setup_attempt","statement":"CREATE INDEX IF NOT EXISTS idx_agent_feed_created ON agent_feed(created_at DESC)","statementHash":"9b0e27bc5e0089ddfa32218378ba040fa68f7853bb25fa616206c97e97112731"},{"queryId":"mc_Q15","kind":"forbidden_feed_ingest","statement":"\n      INSERT INTO agent_feed (agent_id, agent_name, message, session_id, msg_hash)\n      VALUES ($1, $2, $3, $4, $5)\n      ON CONFLICT (msg_hash) DO NOTHING\n    ","statementHash":"a0156f6213083e5db5f6eb889dce9cf20f60de05bbce1269fac420cecf808262"},{"queryId":"mc_Q16","kind":"conditional_feed_read","statement":"SELECT * FROM agent_feed ORDER BY created_at DESC LIMIT $1","statementHash":"97e384d611bd129807a2ed33193becef1e5ba2bfa23b6e574866acfe2065fe7c"},{"queryId":"mc_Q17","kind":"known_feed_prune_attempt","statement":"\n    DELETE FROM agent_feed WHERE id NOT IN (\n      SELECT id FROM agent_feed ORDER BY created_at DESC LIMIT $1\n    )\n  ","statementHash":"07bf59b93c5aa56748310370e04a0b0d5337b98f00363b98bd605c47cadd842d"},{"queryId":"mc_Q18","kind":"pipeline_read","statement":"\n    SELECT run_id, status, COUNT(*)::INTEGER as cnt\n    FROM stories\n    WHERE run_id = ANY($1)\n    GROUP BY run_id, status\n  ","statementHash":"1076ff21e4fb633bdab8acb9c8b04c12b5d874a09d05dd8f227af5f00e587ff9"},{"queryId":"mc_Q19","kind":"scheduled_read","statement":"\n      SELECT r.id, r.status, r.protocol, r.workflow_id, r.run_number,\n             r.updated_at AS cursor_timestamp\n        FROM runs r\n       WHERE r.protocol = 'v3'\n         AND lower(r.status) IN ('completed', 'done')\n         AND r.workflow_id = 'feature-dev'\n         AND r.accepted_candidate_hash IS NOT NULL\n         AND r.deploy_receipt_hash IS NOT NULL\n         AND r.project_transfer_ack_hash IS NULL\n         AND ($1::timestamptz IS NULL OR (r.updated_at, r.id) > ($1::timestamptz, $2::text))\n       ORDER BY r.updated_at ASC, r.id ASC\n       LIMIT $3\n    ","statementHash":"41ba8391da905d5e96f3e50445838165ed7980658ecad15c32ffa930e37f9216"},{"queryId":"mc_Q20","kind":"scheduled_read","statement":"\n      SELECT r.id, r.status, r.protocol, r.workflow_id, r.run_number,\n             ack.created_at AS cursor_timestamp,\n             ack.project_id, ack.projection_hash, ack.project_record_hash, ack.persisted_at\n        FROM runs r\n        JOIN v3_project_transfer_acks ack\n          ON ack.run_id = r.id\n         AND ack.ack_hash = r.project_transfer_ack_hash\n       WHERE r.protocol = 'v3'\n         AND lower(r.status) IN ('completed', 'done')\n         AND r.workflow_id = 'feature-dev'\n         AND ($1::timestamptz IS NULL OR (ack.created_at, r.id) > ($1::timestamptz, $2::text))\n       ORDER BY ack.created_at ASC, r.id ASC\n       LIMIT $3\n    ","statementHash":"d32669ad0d56ca51ed13fde7ad8016e170e55f20b81a69c3294faff532be2b44"},{"queryId":"mc_Q21","kind":"dormant_manual_read","statement":"\n      SELECT r.id, r.status, r.protocol, r.workflow_id, r.run_number,\n             r.updated_at AS cursor_timestamp\n        FROM runs r\n       WHERE r.id = $1\n         AND r.protocol = 'v3'\n         AND lower(r.status) IN ('completed', 'done')\n         AND r.workflow_id = 'feature-dev'\n       LIMIT 1\n    ","statementHash":"248f1bc5c83bee8647ca8cee146c114b49ea6bbc4897e13f06393ed63b3829e9"},{"queryId":"mc_Q22","kind":"known_startup_setup_attempt","statement":"\n    CREATE TABLE IF NOT EXISTS public.live_events (\n      id TEXT PRIMARY KEY,\n      ts TIMESTAMPTZ NOT NULL,\n      agent TEXT NOT NULL,\n      model TEXT,\n      tool TEXT,\n      action TEXT NOT NULL,\n      summary TEXT,\n      file TEXT,\n      status TEXT NOT NULL DEFAULT 'completed',\n      duration_ms INTEGER,\n      exit_code INTEGER,\n      cwd TEXT,\n      project TEXT,\n      detail TEXT,\n      output TEXT,\n      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()\n    )\n  ","statementHash":"897bf9ec7f8650e31ea17083474ed1f517e939b768fa5afd04d2bc5861e5fd56"},{"queryId":"mc_Q23","kind":"known_startup_setup_attempt","statement":"CREATE INDEX IF NOT EXISTS idx_live_events_ts ON public.live_events(ts)","statementHash":"2930be870a3845296fedec922a13c26e732a3d8d7e6779ff174f707d592a9bab"},{"queryId":"mc_Q24","kind":"known_startup_setup_attempt","statement":"CREATE INDEX IF NOT EXISTS idx_live_events_status ON public.live_events(status)","statementHash":"b00275158ddcbd45859db9c85fd7e0d5538582a103a4b51edb9d0e57ca0d2230"},{"queryId":"mc_Q25","kind":"known_startup_setup_attempt","statement":"CREATE INDEX IF NOT EXISTS idx_live_events_project ON public.live_events(project)","statementHash":"3c3f17bb731f92e33535a6d7a131c81cab6e135355a433b465357c911e09c0b5"},{"queryId":"mc_Q26","kind":"known_startup_setup_attempt","statement":"CREATE INDEX IF NOT EXISTS idx_live_events_agent ON public.live_events(agent)","statementHash":"98a0bc21d5d7dc2582a095577128811e7857d0dd3fd0e51c3bef88b2d7b530f9"},{"queryId":"mc_Q27","kind":"known_startup_setup_attempt","statement":"CREATE INDEX IF NOT EXISTS idx_live_events_action ON public.live_events(action)","statementHash":"c7e53752aaac5ad1b2fd4ac8189ac24c31b33de045a6bcc2804cdd9501294489"},{"queryId":"mc_Q28","kind":"known_startup_setup_attempt","statement":"CREATE INDEX IF NOT EXISTS idx_live_events_error ON public.live_events(exit_code) WHERE exit_code IS NOT NULL AND exit_code != 0","statementHash":"6104dde35a5522dcd8f5377d79375b4e793cd68e39b22cb9699d28956ee50a4e"},{"queryId":"mc_Q29","kind":"forbidden_live_ingest","statement":"\n        INSERT INTO public.live_events (id, ts, agent, model, tool, action, summary, file, status, duration_ms, exit_code, cwd, project, detail, output)\n        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)\n        ON CONFLICT (id) DO NOTHING\n      ","statementHash":"f947f365e4bfd18a84ed821f926a5fbe82227b86a6f356b4e30a9847b6a606e4"},{"queryId":"mc_Q30","kind":"known_startup_delete_attempt","statement":"DELETE FROM public.live_events WHERE ts < NOW() - INTERVAL '30 days'","statementHash":"6b57edcd7f4ad086d7215d82b3f4155a57f9b990094e8cfce1ed72316f661652"},{"queryId":"mc_Q31","kind":"optional_health_read","statement":"SELECT COUNT(*)::int AS count FROM runs","statementHash":"e41bb5009d727b21998f2653f8d15289fa8f7f607f24cb1c3386cdd794e7da38"},{"queryId":"mc_Q32","kind":"driver_startup","statement":"\n      select b.oid, b.typarray\n      from pg_catalog.pg_type a\n      left join pg_catalog.pg_type b on b.oid = a.typelem\n      where a.typcategory = 'A'\n      group by b.oid, b.typarray\n      order by b.oid\n    ","statementHash":"b74ea9a62275c375d9cdfa66c6d29960fcff6bf8402579596b758651187a9e18"},{"queryId":"mc_Q33","kind":"conditional_driver_state","statement":"\n      show transaction_read_only;\n      select pg_catalog.pg_is_in_recovery()\n    ","statementHash":"5bb8b384061332c5c94e582c34c760c484e74cea5fb05e533fbdff1004467ec9"},{"queryId":"mc_Q34","kind":"detail_read","statement":"SELECT * FROM runs WHERE id = $1 LIMIT 1","statementHash":"0ccb92fceba3d566a30f86f604474baab50c3f713cb93f962f1bda7ec3450b36"}].map(row=>Object.freeze(row)));
function parseTask4PgLogV1(bytes:Uint8Array,executionId:string,database:string,issued:ReadonlyArray<Task4IssuedV1>=[],backends:ReadonlyArray<Readonly<RecordV1>>=[],diagnostic?:{predicate:string}):ReadonlyArray<Readonly<RecordV1>> {
  try {
    if(diagnostic)diagnostic.predicate="parse_identity";hexV1(executionId,32);requireV1(/^setfarm_p3_[a-f0-9]{24}_clone_[a-f0-9]{12}$/.test(database));
    if(diagnostic)diagnostic.predicate="parse_bytes";const raw=Buffer.from(bytes);requireV1(raw.length>0&&raw.length<=8388608&&raw[raw.length-1]===10);
    if(diagnostic)diagnostic.predicate="parse_utf8";const text=new TextDecoder("utf-8",{fatal:true}).decode(raw);requireV1(Buffer.from(text).equals(raw));
    const prefix=/^(\d{4}-\d\d-\d\d \d\d:\d\d:\d\d\.\d{3} UTC)\|([1-9]\d*)\|([a-f0-9]+\.[a-f0-9]+)\|([^|\r\n]*)\|([^|\r\n]*)\|([^|\r\n]*)\|([0-9A-Z]{5})\| /;
    const messages:Array<{offset:number;length:number;head:RegExpMatchArray;body:string}>=[];
    let offset=0;
    for(const line of text.split("\n").slice(0,-1)){
      const length=Buffer.byteLength(line)+1,head=line.match(prefix);
      if(head){if(diagnostic)diagnostic.predicate="parse_message_cap";requireV1(messages.length<8192);messages.push({offset,length,head,body:line.slice(head[0].length)});}
      else {if(diagnostic)diagnostic.predicate="parse_continuation";const last=messages.at(-1);requireV1(last!==undefined&&!line.includes("\r")&&!/^\d{4}-\d\d-\d\d /.test(line));last.length+=length;last.body+="\n"+line;}
      offset+=length;
    }
    if(diagnostic)diagnostic.predicate="parse_coverage";requireV1(messages.length>0&&offset===raw.length);
    const results:RecordV1[]=[],errors=new Map<string,RecordV1>();
    for(const message of messages){
      const h=message.head,pid=Number(h[2]),session=h[3]!,role=h[4]!,db=h[5]!,app=h[6]!,sqlstate=h[7]!;
      if(diagnostic)diagnostic.predicate="parse_session";integerV1(pid);requireV1(Number.parseInt(session.split(".")[1]!,16)===pid);
      if(diagnostic)diagnostic.predicate="parse_time";const capturedAt=h[1]!.replace(" ","T").replace(" UTC","Z");timeV1(capturedAt);
      if(diagnostic)diagnostic.predicate="parse_scope";const restricted=role==="mc_task4_"+executionId;
      if(restricted)requireV1(db===database&&["task4_mc_","task4_observer_","task4_probe_"].some(p=>app===p+executionId));
      else requireV1(role===""&&db===""&&app==="");
      if(diagnostic)diagnostic.predicate="parse_severity";const severity=/^(LOG|ERROR|STATEMENT|DETAIL|HINT|WARNING|FATAL|PANIC|CONTEXT):  /.exec(message.body);requireV1(severity!==null);
      const kind=severity[1]!,content=message.body.slice(severity[0].length);
      const envelope=kind==="STATEMENT"?content:kind==="LOG"?/^(?:execute (?:<unnamed>|[a-zA-Z0-9_]+)|statement): ([\s\S]*)$/.exec(content)?.[1]:undefined;
      // PostgreSQL's stderr continuation tab is envelope formatting, not SQL normalization.
      if(diagnostic)diagnostic.predicate="parse_backend_unique";const owners=backends.filter(b=>b.pid===pid);requireV1(owners.length<=1);
      const candidates=[...TASK4_MC_SQL_V1.filter(q=>app==="task4_mc_"+executionId||q.kind==="driver_startup"),...issued.filter(q=>q.applicationName===app&&owners.length===1&&q.clientPid===owners[0]!.clientIdentity.pid).map(q=>({queryId:q.queryId,kind:q.kind,statement:q.statement,statementHash:hashV1(q.statement)}))];
      const matches=envelope===undefined?[]:candidates.filter(q=>envelope===q.statement||envelope===q.statement.replaceAll("\n","\n\t"));
      if(diagnostic)diagnostic.predicate="parse_candidate_unique";requireV1(matches.length<=1);const known=matches[0];
      const row:RecordV1={offset:message.offset,length:message.length,rawHash:hashV1(raw.subarray(message.offset,message.offset+message.length)),
        capturedAt,pid,session,scope:restricted?"restricted":"postmaster",applicationName:app,kind,sqlstate,
        queryId:known?.queryId??"unknown",statementHash:known?.statementHash??(envelope===undefined?null:hashV1(envelope)),classification:known?.kind??"unknown"};
      const key=pid+":"+session;
      if(kind==="ERROR")errors.set(key,row);
      if(kind==="STATEMENT"){
        if(diagnostic)diagnostic.predicate="parse_error_pair";const prior=errors.get(key);requireV1(prior!==undefined&&prior.sqlstate===sqlstate);
        prior.queryId=row.queryId;prior.statementHash=row.statementHash;prior.classification=row.classification;errors.delete(key);
      }
      results.push(row);
    }
    return freezeV1(results);
  }catch{return refuseV1("TASK4_SQL_ORIGINALS_UNKNOWN");}
}

async function executeTask4ProbeV1(sql:QueryPortV1,probe:Readonly<{id:string;statement:string}>):Promise<Readonly<RecordV1>> {
  keysV1(probe,"id statement");const executionId=/task4_denied_([a-f0-9]{32})/.exec(probe.statement)?.[1]??"0".repeat(32);
  requireV1(task4ProbesV1(executionId).some(known=>sameV1(known,probe)),"TASK4_DATABASE_REFUSED");
  const identity=await sql.unsafe(`/*task4:probe-identity*/ SELECT pg_backend_pid() AS pid,
    to_char(backend_start AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS started_at FROM pg_stat_activity WHERE pid=pg_backend_pid()`);
  requireV1(identity.length===1,"TASK4_DATABASE_REFUSED");keysV1(identity[0],"pid started_at");integerV1(identity[0].pid);
  requireV1(/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{6}Z$/.test(identity[0].started_at),"TASK4_DATABASE_REFUSED");
  let entered=false,sqlstate:string|null=null,rollbackObserved=false;
  try {
    await sql.unsafe("BEGIN READ WRITE");entered=true;
    try {await sql.unsafe(probe.statement);}catch(error){
      const code=(error as {code?:unknown}).code;if(typeof code==="string"&&/^[0-9A-Z]{5}$/.test(code))sqlstate=code;
    }
  }catch{return refuseV1("TASK4_DATABASE_REFUSED");}
  finally{try{await sql.unsafe("ROLLBACK");rollbackObserved=true;}catch{/* Original statement SQLSTATE stays separate from rollback uncertainty. */}}
  requireV1(entered,"TASK4_DATABASE_REFUSED");
  return Object.freeze({probeId:probe.id,backendPid:identity[0].pid,backendStartedAt:identity[0].started_at,statementHash:hashV1(probe.statement),sqlstate,rollbackObserved});
}
export function validateTask4RunnerEnvelopeV1(input:unknown,setup:Readonly<RecordV1>,owner:Readonly<RecordV1>,parent:Readonly<RecordV1>|null,parentRef:Task4RefV1|null):Readonly<RecordV1> {
  try {
    keysV1(input,"schema executionId setupDescriptorHash owner outcome code children parentResult projection cleanup");const v=input;
    requireV1(v.schema==="setfarm.task4-runner-result.v1"&&v.executionId===setup.executionId&&v.setupDescriptorHash===hashV1(task4CanonicalV1(setup)+"\n")
      &&sameV1(v.owner,owner));processV1(owner);requireV1(owner.ppid===setup.owner.pid);
    requireV1(["pass","fail","cancelled","unknown"].includes(v.outcome)&&(v.code===null||TASK4_CODES_V1.includes(v.code)));
    requireV1(Array.isArray(v.children)&&v.children.length<=2);
    for(const [i,child] of v.children.entries()){
      keysV1(child,"role owner exit fd3 fd4");requireV1(child.role===["setup","test"][i]&&["finished","unknown"].includes(child.fd3)
        &&(child.role==="setup"?child.fd4==="not_applicable":["finished","unknown"].includes(child.fd4)));
      if(child.owner!==null){processV1(child.owner);requireV1(child.owner.ppid===owner.pid&&child.owner.executable===owner.executable&&child.owner.executableHash===owner.executableHash);}
      if(child.exit!==null){keysV1(child.exit,"code signal exitObserved closeObserved");requireV1(child.exit.code===null||Number.isInteger(child.exit.code));
        requireV1(child.exit.signal===null||typeof child.exit.signal==="string");requireV1(typeof child.exit.exitObserved==="boolean"&&typeof child.exit.closeObserved==="boolean");}
    }
    if(v.parentResult!==null)proofRefV1(v.parentResult,16384);requireV1(sameV1(v.parentResult,parentRef));
    if(v.projection!==null){keysV1(v.projection,"root projectedHead");directoryV1(v.projection.root,true);hexV1(v.projection.projectedHead,40);
      requireV1(/^setfarm-p3-projection-[A-Za-z0-9_-]+\/setfarm$/.test(path.relative(path.join(setup.resourceRoot.path,"tmp"),v.projection.root.path)));}
    keysV1(v.cleanup,"databasesAbsent projectionAbsent");for(const flag of Object.values(v.cleanup))requireV1(flag===null||typeof flag==="boolean");
    if(v.outcome!=="unknown"){
      requireV1(parent!==null&&parentRef!==null&&v.projection!==null&&v.children.length===2&&v.cleanup.databasesAbsent===true&&v.cleanup.projectionAbsent===true
        &&parent.outcome===v.outcome&&sameV1(parent.fixtureOwner,v.children[1].owner)&&sameV1(parent.projection.root,v.projection.root)&&parent.projection.projectedHead===v.projection.projectedHead);
      for(const child of v.children)requireV1(child.owner!==null&&child.exit!==null&&child.fd3==="finished"&&child.exit.exitObserved===true&&child.exit.closeObserved===true&&child.exit.signal===null);
      requireV1(v.children[0].exit.code===0&&v.children[1].fd4==="finished"&&v.children[1].exit.code===(v.outcome==="pass"?0:1));
    }
    if(v.outcome==="pass")requireV1(v.code===null);else requireV1(v.code!==null);
    if(v.outcome==="cancelled")requireV1(v.code==="TASK4_CANCELLED");return freezeV1(v);
  }catch{return refuseV1("TASK4_INTEGRITY_FAILED");}
}
export function validateTask4ParentEnvelopeV1(input:unknown,setup:Readonly<RecordV1>,owner:Readonly<RecordV1>):Readonly<RecordV1> {
  try {
    setupV1(setup);processV1(owner);
    keysV1(input,"schema executionId setupDescriptorHash readyDescriptorHash fixtureOwner outcome code integrity projection database inner evidence cleanup");
    const v=input;requireV1(v.schema==="setfarm.task4-parent-result.v1"&&v.executionId===setup.executionId
      &&v.setupDescriptorHash===hashV1(task4CanonicalV1(setup)+"\n")&&sameV1(v.fixtureOwner,owner));hexV1(v.readyDescriptorHash);
    requireV1(["pass","fail","cancelled","unknown"].includes(v.outcome)&&["verified","failed"].includes(v.integrity)
      &&(v.code===null||TASK4_CODES_V1.includes(v.code)));
    keysV1(v.projection,"root projectedHead inputManifestHash projectedManifestHash markerHash runDatabasePrefix");directoryV1(v.projection.root,true);
    hexV1(v.projection.projectedHead,40);for(const key of ["inputManifestHash","projectedManifestHash","markerHash"])hexV1(v.projection[key]);
    requireV1(v.projection.inputManifestHash===setup.setfarm.source.inputManifestHash&&/^setfarm_p3_[a-f0-9]{24}$/.test(v.projection.runDatabasePrefix)
      &&/^setfarm-p3-projection-[A-Za-z0-9_-]+\/setfarm$/.test(path.relative(path.join(setup.resourceRoot.path,"tmp"),v.projection.root.path)));
    keysV1(v.database,"name role");requireV1(v.database.role==="mc_task4_"+setup.executionId
      &&new RegExp(`^${v.projection.runDatabasePrefix}_clone_[a-f0-9]{12}$`).test(v.database.name));
    keysV1(v.inner,"owner exit result");if(v.inner.owner!==null){processV1(v.inner.owner);requireV1(v.inner.owner.ppid===owner.pid);}
    if(v.inner.exit!==null){keysV1(v.inner.exit,"code signal exitObserved closeObserved");
      requireV1(v.inner.exit.code===null||Number.isInteger(v.inner.exit.code));requireV1(v.inner.exit.signal===null||typeof v.inner.exit.signal==="string");
      requireV1(typeof v.inner.exit.exitObserved==="boolean"&&typeof v.inner.exit.closeObserved==="boolean");}
    if(v.inner.result!==null)proofRefV1(v.inner.result,16384);
    keysV1(v.evidence,"readinessBefore readinessAfter auditBefore auditAfter untouchedBefore untouchedAfter sqlLedger");
    for(const ref of Object.values(v.evidence))if(ref!==null)proofRefV1(ref);
    keysV1(v.cleanup,"readers databaseAbsent roleAbsent");keysV1(v.cleanup.readers,"opened closed pending");
    for(const count of Object.values(v.cleanup.readers))integerV1(count,0,64);
    requireV1(v.cleanup.readers.closed<=v.cleanup.readers.opened&&v.cleanup.readers.pending<=v.cleanup.readers.opened);
    for(const flag of [v.cleanup.databaseAbsent,v.cleanup.roleAbsent])requireV1(flag===null||typeof flag==="boolean");
    if(v.outcome!=="unknown"){
      requireV1(v.integrity==="verified"&&v.cleanup.databaseAbsent===true&&v.cleanup.roleAbsent===true&&v.cleanup.readers.pending===0
        &&v.cleanup.readers.opened===v.cleanup.readers.closed&&Object.values(v.evidence).every(ref=>ref!==null)
        &&v.inner.owner!==null&&v.inner.result!==null&&v.inner.exit!==null&&v.inner.exit.exitObserved===true&&v.inner.exit.closeObserved===true&&v.inner.exit.signal===null
        &&v.inner.exit.code===({pass:0,fail:1,cancelled:130} as Record<string,number>)[v.outcome]);
      for(const kind of ["readiness","untouched"])requireV1(sameV1(v.evidence[kind+"Before"],v.evidence[kind+"After"]));
    }
    if(v.outcome==="pass")requireV1(v.code===null);else requireV1(v.code!==null);
    if(v.outcome==="cancelled")requireV1(v.code==="TASK4_CANCELLED");
    return freezeV1(v);
  }catch{return refuseV1("TASK4_INTEGRITY_FAILED");}
}
export function validateTask4InnerRenderV1(value:unknown,ready:Readonly<RecordV1>,outcome:string):void {
  try {
    keysV1(value,"schema executionId setupDescriptorHash readyDescriptorHash viewport preflight routes network filesystem stop");
    requireV1(value.schema==="mission-control.render-smoke-inner-render.v1"&&sameV1(value.viewport,{width:1440,height:950}));artifactBindingV1(value,ready);
    const expected=task4SeedV1(ready.setup.setfarm.source.sourceSha).productResponse;
    const product=(v:unknown)=>{keysV1(v,"status bodyHash parsedHash authorityHash packetHash");hexV1(v.bodyHash);
      requireV1(v.status===200&&v.parsedHash===hashV1(task4CanonicalV1(expected))&&v.authorityHash===expected.authorityHash&&v.packetHash===expected.packetAuthority.packetHash);};
    if(value.preflight!==null)product(value.preflight);
    requireV1(Array.isArray(value.routes)&&value.routes.length===6);let stopped=false,passes=0;const pngs=new Set<string>();
    for(const [i,row] of value.routes.entries()){
      keysV1(row,"route status code screenshot dom productResponse");requireV1(row.route===TASK4_ROUTES_V1[i]&&["not_started","pass","fail"].includes(row.status)
        &&(row.code===null||TASK4_CODES_V1.includes(row.code)));
      if(row.screenshot!==null){proofRefV1(row.screenshot,16777216);requireV1(!pngs.has(row.screenshot.sha256));pngs.add(row.screenshot.sha256);}
      if(row.dom!==null){keysV1(row.dom,"rootWidth rootHeight textLength visibleElements");for(const number of Object.values(row.dom))integerV1(number,0,10000000);}
      if(row.productResponse!==null){requireV1(i===5);product(row.productResponse);}
      if(row.status==="pass"){
        requireV1(!stopped&&row.code===null&&row.screenshot!==null&&row.dom!==null&&row.dom.rootWidth>=100&&row.dom.rootHeight>=100&&row.dom.textLength>=40&&row.dom.visibleElements>=2);
        requireV1(i===5?row.productResponse!==null:row.productResponse===null);passes++;
      }else{
        if(stopped)requireV1(row.status==="not_started");stopped=true;
        if(row.status==="not_started")requireV1(row.code===null&&row.screenshot===null&&row.dom===null&&row.productResponse===null);
        else requireV1(row.code!==null);
      }
    }
    for(const ref of [value.network,value.filesystem])if(ref!==null)proofRefV1(ref);
    keysV1(value.stop,"kind afterRoute");requireV1(["complete","failure","cancelled","unknown"].includes(value.stop.kind)
      &&(value.stop.afterRoute===null||TASK4_ROUTES_V1.includes(value.stop.afterRoute)));
    if(outcome==="pass")requireV1(passes===6&&value.preflight!==null&&sameV1(value.preflight,value.routes[5].productResponse)
      &&value.network!==null&&value.filesystem!==null&&value.stop.kind==="complete"&&value.stop.afterRoute===TASK4_ROUTES_V1[5]);
    if(outcome==="cancelled")requireV1(value.stop.kind==="cancelled"&&passes===1&&value.stop.afterRoute===TASK4_ROUTES_V1[0]);
    if(outcome==="fail")requireV1(value.stop.kind==="failure");
  }catch{return refuseV1("TASK4_INTEGRITY_FAILED");}
}
const TASK4_ROUTES_V1=Object.freeze(["/","/setfarm","/setfarm/active","/projects","/setfarm/runs/ac8cea43-7686-4d27-8092-1e3dd9207ca4","/setfarm/runs/ad47fe65-4ec4-4fb5-89da-fff71eb4e79a"]);
function artifactBindingV1(value:RecordV1,ready:Readonly<RecordV1>):void {
  requireV1(value.executionId===ready.executionId&&value.setupDescriptorHash===ready.setupDescriptorHash
    &&value.readyDescriptorHash===hashV1(task4CanonicalV1(ready)+"\n"));
}
export function validateTask4InnerObservationV1(value:unknown,ready:Readonly<RecordV1>,phase:"before"|"after",pair:Readonly<RecordV1>):void {
  try {
    keysV1(value,"schema executionId setupDescriptorHash readyDescriptorHash phase observedAt databaseIdentity seed grants currentPair syncState");
    requireV1(value.schema==="mission-control.render-smoke-inner-observation.v1"&&value.phase===phase);artifactBindingV1(value,ready);timeV1(value.observedAt);
    requireV1(sameV1(value.databaseIdentity,{database:ready.database.name,currentUser:ready.database.role,sessionUser:ready.database.role,
      host:"127.0.0.1",port:ready.setup.postgres.port,serverVersionNum:170010,serverStartedAt:ready.setup.postgres.serverStartedAt}));
    validateTask4SeedV1(value.seed,ready.setup.setfarm.source.sourceSha);validateTask4GrantsV1(value.grants,ready.database.name,ready.database.role);
    requireV1(hashV1(task4CanonicalV1(value.seed))===ready.fixture.seedDigest&&hashV1(task4CanonicalV1(value.grants))===ready.fixture.privilegeDigest);
    keysV1(pair,"activationRef activationHash headRef headHash admissionReadyHash");requireV1(sameV1(value.currentPair,pair)
      &&pair.activationHash===ready.fixture.manifestActivationHash&&pair.headHash===ready.fixture.manifestHeadHash&&pair.admissionReadyHash===ready.fixture.admissionReadyHash);
    keysV1(value.syncState,"beforeHash afterHash ledger");for(const hash of [value.syncState.beforeHash,value.syncState.afterHash])if(hash!==null)hexV1(hash);
    proofRefV1(value.syncState.ledger);
  }catch{return refuseV1("TASK4_INTEGRITY_FAILED");}
}
const TASK4_CODES_V1=Object.freeze(["TASK4_ASSERTION_FAILED","TASK4_DATABASE_REFUSED","TASK4_BINDING_REFUSED","TASK4_SOURCE_DRIFT","TASK4_NETWORK_REFUSED",
  "TASK4_RESOURCE_REFUSED","TASK4_CANCELLED","TASK4_QUALIFICATION_ASSERTION_FAILURE","TASK4_CLEANUP_UNKNOWN","TASK4_INTEGRITY_FAILED","TASK4_RESULT_PUBLICATION_FAILED"]);
function timeV1(value:unknown):void {requireV1(typeof value==="string"&&/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(value)
  &&Number.isFinite(Date.parse(value))&&new Date(value).toISOString()===value);}
function sameV1(left:unknown,right:unknown):boolean{return task4CanonicalV1(left)===task4CanonicalV1(right);}
export function validateTask4InnerEnvelopeV1(input:unknown,ready:Readonly<RecordV1>,owner:Readonly<RecordV1>,exit:Readonly<RecordV1>,scenario:string):Readonly<RecordV1> {
  try {
    readyV1(ready);processV1(owner);keysV1(exit,"code signal exitObserved closeObserved");
    requireV1(exit.exitObserved===true&&exit.closeObserved===true&&exit.signal===null&&Number.isInteger(exit.code));
    keysV1(input,"schema executionId binding owner scenario startedAt finishedAt outcome code integrity observations render cleanup artifacts diagnostics");
    const v=input;requireV1(v.schema==="mission-control.render-smoke-inner-result.v1"&&v.executionId===ready.executionId&&sameV1(v.owner,owner)
      &&owner.ppid===ready.fixtureOwner.pid&&v.scenario===scenario&&["pass","assertion_failure","owned_cancel"].includes(scenario));
    const binding={setupDescriptorHash:ready.setupDescriptorHash,readyDescriptorHash:hashV1(task4CanonicalV1(ready)+"\n"),resourceRoot:ready.setup.resourceRoot,
      missionControl:ready.setup.missionControl.source,setfarm:ready.setup.setfarm.source,projection:ready.projection,
      database:{name:ready.database.name,role:ready.database.role,restrictedUrlHash:ready.database.restrictedUrlHash},fixture:ready.fixture,fixtureOwner:ready.fixtureOwner};
    requireV1(sameV1(v.binding,binding));timeV1(v.startedAt);timeV1(v.finishedAt);requireV1(v.finishedAt>=v.startedAt&&v.startedAt>=owner.startedAt);
    const exits:Record<string,number>={pass:0,fail:1,cancelled:130,unknown:2};requireV1(Object.hasOwn(exits,v.outcome)&&exit.code===exits[v.outcome]);
    requireV1(["verified","failed"].includes(v.integrity)&&(v.code===null||TASK4_CODES_V1.includes(v.code)));
    if(v.outcome!=="unknown")requireV1(v.integrity==="verified");
    if(v.outcome==="pass")requireV1(v.code===null&&scenario==="pass");else requireV1(v.code!==null);
    if(v.outcome==="cancelled")requireV1(v.code==="TASK4_CANCELLED"&&scenario==="owned_cancel");
    keysV1(v.observations,"before after");keysV1(v.artifacts,"json png native totalBytes");
    const json=v.artifacts.json,png=v.artifacts.png,native=v.artifacts.native;
    requireV1(Array.isArray(json)&&json.length<=64&&Array.isArray(png)&&png.length<=6&&Array.isArray(native)&&native.length<=1);
    let total=0;
    for(const [values,cap] of [[json,1048576],[png,16777216]] as const){let previous="";
      for(const ref of values){proofRefV1(ref,cap);requireV1(ref.sha256>previous);previous=ref.sha256;total+=ref.bytes;}}
    for(const chain of native){keysV1(chain,"spawnId intent observed settled closed notStarted");
      requireV1(typeof chain.spawnId==="string"&&/^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(chain.spawnId));
      for(const key of ["intent","observed","settled","closed","notStarted"]){if(chain[key]!==null){proofRefV1(chain[key],key==="settled"?1048576:16384);total+=chain[key].bytes;}}
      requireV1(chain.intent!==null);
      if(v.outcome!=="unknown")requireV1(chain.notStarted!==null?chain.observed===null&&chain.settled===null&&chain.closed===null
        :chain.observed!==null&&chain.settled!==null&&chain.closed!==null);
    }
    integerV1(v.artifacts.totalBytes,0,168886272);requireV1(total===v.artifacts.totalBytes);
    for(const ref of [v.observations.before,v.observations.after,v.render,v.cleanup])if(ref!==null){proofRefV1(ref);requireV1(json.some((known:Task4RefV1)=>sameV1(known,ref)));}
    requireV1(Array.isArray(v.diagnostics)&&v.diagnostics.length<=16&&new Set(v.diagnostics).size===v.diagnostics.length
      &&v.diagnostics.every((code:unknown)=>typeof code==="string"&&TASK4_CODES_V1.includes(code)));
    if(v.outcome==="pass")requireV1(v.observations.before!==null&&v.observations.after!==null&&v.render!==null&&v.cleanup!==null
      &&png.length===6&&native.length===1&&native[0].closed!==null&&native[0].notStarted===null);
    if(v.outcome!=="unknown")requireV1(v.cleanup!==null);
    task4CanonicalV1(v);return freezeV1(v);
  }catch{return refuseV1("TASK4_INTEGRITY_FAILED");}
}
async function createTask4ReadRoleV1(sql:QueryPortV1,executionId:string,database:string,prefix:string,password:string):Promise<void> {
  hexV1(executionId,32);requireV1(/^setfarm_p3_[a-f0-9]{24}$/.test(prefix)
    &&new RegExp(`^${prefix}_clone_[a-f0-9]{12}$`).test(database)&&/^[a-f0-9]{64}$/.test(password),"TASK4_DATABASE_REFUSED");
  const role="mc_task4_"+executionId;
  const identity=await sql.unsafe("/*task4:role-database*/ SELECT current_database() AS name");
  requireV1(identity.length===1&&identity[0].name===database,"TASK4_DATABASE_REFUSED");
  const databases=await sql.unsafe("/*task4:role-cluster*/ SELECT datname AS name,datdba=(SELECT oid FROM pg_roles WHERE rolname=current_user) AS owned FROM pg_database ORDER BY datname COLLATE \"C\" LIMIT 7");
  const names=["postgres","template0","template1",prefix+"_template",prefix+"_primary",database].sort();
  requireV1(databases.length===6&&databases.every(row=>row.owned===true)
    &&task4CanonicalV1(databases.map(row=>row.name).sort())===task4CanonicalV1(names),"TASK4_DATABASE_REFUSED");
  const existing=await sql.unsafe("/*task4:role-exists*/ SELECT rolname FROM pg_roles WHERE rolname=$1",[role]);
  requireV1(existing.length===0,"TASK4_DATABASE_REFUSED");
  // Global log_min_error_statement=panic is independently checked by the caller before this credential statement.
  await sql.unsafe(`CREATE ROLE "${role}" LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS PASSWORD '${password}'`);
  for(const name of names)await sql.unsafe(`REVOKE CONNECT,TEMPORARY ON DATABASE "${name}" FROM PUBLIC`);
  await sql.unsafe(`GRANT CONNECT ON DATABASE "${database}" TO "${role}"`);
  await sql.unsafe(`REVOKE ALL ON SCHEMA public FROM PUBLIC,"${role}"`);
  await sql.unsafe(`GRANT USAGE ON SCHEMA public TO "${role}"`);
  await sql.unsafe(`REVOKE ALL ON ALL TABLES IN SCHEMA public FROM "${role}"`);
  await sql.unsafe(`REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM PUBLIC,"${role}"`);
  await sql.unsafe(`REVOKE EXECUTE ON ALL ROUTINES IN SCHEMA public FROM PUBLIC,"${role}"`);
  for(const row of task4GrantsV1(database,role).relationGrants)await sql.unsafe(`GRANT SELECT ON TABLE public."${row.name}" TO "${role}"`);
  for(const [key,value] of [["default_transaction_read_only","on"],["lo_compat_privileges","off"],["log_statement","all"],
    ["log_min_error_statement","error"],["log_parameter_max_length","0"],["log_parameter_max_length_on_error","0"],
    ["timezone","UTC"],["statement_timeout","5000"],["idle_in_transaction_session_timeout","5000"]])
    await sql.unsafe(`ALTER ROLE "${role}" SET ${key} = '${value}'`);
}
export async function installTask4AuxiliaryV1(sql:QueryPortV1,source:string):Promise<void> {
  requireV1(hashV1(source)==="914c608236bd44ae4b0b19804b292d4810d2d3b185a726c334ccf2ff94cd4e9f","TASK4_AUXILIARY_SOURCE_REFUSED");
  const data=await extractTask4AuxiliaryV1(source);
  const relations=[...data.tables,"tasks_pkey","prds_pkey","prd_templates_pkey","agent_feed_pkey","agent_feed_msg_hash_key","agent_feed_id_seq",
    "idx_agent_feed_created","live_events_pkey","idx_live_events_ts","idx_live_events_status","idx_live_events_project","idx_live_events_agent","idx_live_events_action","idx_live_events_error"];
  const types=data.tables.flatMap(name=>[name,"_"+name]);requireV1(relations.length===19&&types.length===10);
  const existingRelations=await sql.unsafe(`/*task4:aux-relation*/ SELECT c.relname AS name FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relname=ANY($1::text[]) ORDER BY c.relname COLLATE "C" LIMIT 20`,[relations]);
  const existingTypes=await sql.unsafe(`/*task4:aux-type*/ SELECT t.typname AS name FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace
    WHERE n.nspname='public' AND t.typname=ANY($1::text[]) ORDER BY t.typname COLLATE "C" LIMIT 11`,[types]);
  requireV1(existingRelations.length===0&&existingTypes.length===0,"TASK4_DATABASE_REFUSED");
  for(const statement of data.statements)await sql.unsafe(statement);
  for(const row of data.templates)await sql.unsafe("INSERT INTO public.prd_templates (id,name,category,platform,prd_content,description,created_at) VALUES ($1,$2,$3,$4,$5,$6,$7)",
    [row.id,row.name,row.category,row.platform,row.prd_content,row.description,row.created_at]);
}
export async function observeTask4ParentCatalogV1(sql:QueryPortV1,role:string):Promise<Readonly<RecordV1>> {
  requireV1(/^mc_task4_[a-f0-9]{32}$/.test(role),"TASK4_DATABASE_REFUSED");
  const read=async(id:string,query:string,parameters:readonly unknown[]=[])=>{
    const rows=await sql.unsafe(`/*task4:${id}*/ ${query} LIMIT 4097`,parameters);
    requireV1(rows.length<=4096,"TASK4_DATABASE_REFUSED");task4CanonicalV1([...rows]);return [...rows];
  };
  const memberships=await read("parent-memberships",`SELECT r.rolname AS role,m.rolname AS member,a.admin_option,a.inherit_option,a.set_option
    FROM pg_auth_members a JOIN pg_roles r ON r.oid=a.roleid JOIN pg_roles m ON m.oid=a.member
    WHERE r.rolname=$1 OR m.rolname=$1 ORDER BY r.rolname COLLATE "C",m.rolname COLLATE "C"`,[role]);
  const ownedObjects=await read("parent-owned",`SELECT 'database' AS kind,d.datname AS name FROM pg_database d JOIN pg_roles r ON r.oid=d.datdba WHERE r.rolname=$1
    UNION ALL SELECT 'schema',n.nspname FROM pg_namespace n JOIN pg_roles r ON r.oid=n.nspowner WHERE r.rolname=$1
    UNION ALL SELECT 'relation',n.nspname||'.'||c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace JOIN pg_roles r ON r.oid=c.relowner WHERE r.rolname=$1
    UNION ALL SELECT 'routine',n.nspname||'.'||p.proname||'('||pg_get_function_identity_arguments(p.oid)||')' FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace JOIN pg_roles r ON r.oid=p.proowner WHERE r.rolname=$1
    UNION ALL SELECT 'type',n.nspname||'.'||t.typname FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace JOIN pg_roles r ON r.oid=t.typowner WHERE r.rolname=$1 ORDER BY 1,2`,[role]);
  requireV1(memberships.length===0&&ownedObjects.length===0,"TASK4_DATABASE_REFUSED");
  const databaseAcls=await read("parent-database-acls",`SELECT d.datname AS object,pg_get_userbyid(a.grantor) AS grantor,
    CASE WHEN a.grantee=0 THEN 'PUBLIC' ELSE pg_get_userbyid(a.grantee) END AS grantee,a.privilege_type AS privilege,a.is_grantable AS grantable
    FROM pg_database d CROSS JOIN LATERAL aclexplode(COALESCE(d.datacl,acldefault('d',d.datdba))) a ORDER BY 1,2,3,4`);
  const schemaAcls=await read("parent-schema-acls",`SELECT n.nspname AS object,pg_get_userbyid(a.grantor) AS grantor,
    CASE WHEN a.grantee=0 THEN 'PUBLIC' ELSE pg_get_userbyid(a.grantee) END AS grantee,a.privilege_type AS privilege,a.is_grantable AS grantable
    FROM pg_namespace n CROSS JOIN LATERAL aclexplode(COALESCE(n.nspacl,acldefault('n',n.nspowner))) a
    WHERE n.nspname NOT IN ('pg_catalog','information_schema') AND n.nspname NOT LIKE 'pg\\_%' ESCAPE '\\' ORDER BY 1,2,3,4`);
  const defaultAcls=await read("parent-default-acls",`SELECT pg_get_userbyid(d.defaclrole) AS owner,COALESCE(n.nspname,'') AS schema,d.defaclobjtype::text AS "objectType",
    pg_get_userbyid(a.grantor) AS grantor,CASE WHEN a.grantee=0 THEN 'PUBLIC' ELSE pg_get_userbyid(a.grantee) END AS grantee,a.privilege_type AS privilege,a.is_grantable AS grantable
    FROM pg_default_acl d LEFT JOIN pg_namespace n ON n.oid=d.defaclnamespace CROSS JOIN LATERAL aclexplode(d.defaclacl) a ORDER BY 1,2,3,4,5,6`);
  for(const row of [...databaseAcls,...schemaAcls]){keysV1(row,"object grantor grantee privilege grantable");
    requireV1([row.object,row.grantor,row.grantee,row.privilege].every(v=>typeof v==="string")&&typeof row.grantable==="boolean","TASK4_DATABASE_REFUSED");}
  for(const row of defaultAcls){keysV1(row,"owner schema objectType grantor grantee privilege grantable");
    requireV1([row.owner,row.schema,row.objectType,row.grantor,row.grantee,row.privilege].every(v=>typeof v==="string")&&typeof row.grantable==="boolean","TASK4_DATABASE_REFUSED");}
  const routineSelect=`SELECT n.nspname AS schema,p.proname AS name,pg_get_function_identity_arguments(p.oid) AS identity,p.prokind::text AS kind,
    pg_get_userbyid(p.proowner) AS owner,p.prosecdef AS "securityDefiner",has_function_privilege($1,p.oid,'EXECUTE') AS execute,
    CASE WHEN p.prokind='a' THEN NULL ELSE pg_get_functiondef(p.oid) END AS definition,COALESCE(p.proconfig,ARRAY[]::text[]) AS config
    FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace`;
  const applicationRoutines=await read("parent-routines",routineSelect+` WHERE n.nspname NOT IN ('pg_catalog','information_schema') AND n.nspname NOT LIKE 'pg\\_%' ESCAPE '\\' ORDER BY 1,2,3`,[role]);
  const reachableSecurityDefiners=await read("parent-definers",routineSelect+` WHERE p.prosecdef AND has_function_privilege($1,p.oid,'EXECUTE') ORDER BY 1,2,3`,[role]);
  requireV1(reachableSecurityDefiners.length===0,"TASK4_DATABASE_REFUSED");
  const normalized=applicationRoutines.map(row=>{
    try {keysV1(row,"schema name identity kind owner securityDefiner execute definition config");
      requireV1(row.execute===false&&typeof row.securityDefiner==="boolean"&&typeof row.definition==="string"
        &&[row.schema,row.name,row.identity,row.kind,row.owner].every(v=>typeof v==="string")&&Array.isArray(row.config)
        &&row.config.every((v:unknown)=>typeof v==="string"),"TASK4_DATABASE_REFUSED");
      const {definition,...rest}=row;return {...rest,definitionHash:hashV1(definition)};
    }catch{return refuseV1("TASK4_DATABASE_REFUSED");}
  });
  return freezeV1({memberships,ownedObjects,databaseAcls,schemaAcls,defaultAcls,applicationRoutines:normalized,reachableSecurityDefiners});
}
function proofRefV1(ref:unknown,cap=1048576):asserts ref is Task4RefV1 {keysV1(ref,"sha256 bytes");hexV1(ref.sha256);integerV1(ref.bytes,1,cap);}
export function publishTask4ProofV1(root:string,name:"parent-result.json"|"runner-result.json"|"artifact",value:unknown):Task4RefV1 {
  const pins:Array<ReturnType<typeof pinTask4DirectoryV1>>=[];let fd:number|undefined;
  try {
    requireV1(["parent-result.json","runner-result.json","artifact"].includes(name));pins.push(pinTask4DirectoryV1(root,true));
    const bytes=Buffer.from(task4CanonicalV1(value)+"\n"),sha256=hashV1(bytes);requireV1(bytes.length<=(name==="artifact"?1048576:16384));
    const directory=name==="artifact"?path.join(root,"parent/artifacts"):root;
    if(name==="artifact"){pins.push(pinTask4DirectoryV1(path.join(root,"parent"),true));pins.push(pinTask4DirectoryV1(directory,true));}
    const locator=path.join(directory,name==="artifact"?sha256+".json":name);
    for(const pin of pins)pin.check();
    fd=fs.openSync(locator,fs.constants.O_WRONLY|fs.constants.O_CREAT|fs.constants.O_EXCL|fs.constants.O_NOFOLLOW,0o600);
    const original=fs.fstatSync(fd,{bigint:true});requireV1(original.isFile()&&original.nlink===1n&&original.uid===BigInt(process.getuid!())&&(original.mode&0o777n)===0o600n);
    let offset=0;while(offset<bytes.length){const count=fs.writeSync(fd,bytes,offset,bytes.length-offset,offset);requireV1(count>0);offset+=count;}
    fs.fsyncSync(fd);const after=fs.fstatSync(fd,{bigint:true}),named=fs.lstatSync(locator,{bigint:true});
    requireV1(after.dev===original.dev&&after.ino===original.ino&&after.nlink===1n&&after.size===BigInt(bytes.length)
      &&named.dev===after.dev&&named.ino===after.ino&&named.mode===after.mode&&named.uid===after.uid);
    fs.closeSync(fd);fd=undefined;
    const dir=fs.openSync(directory,fs.constants.O_RDONLY|fs.constants.O_DIRECTORY|fs.constants.O_NOFOLLOW);try{fs.fsyncSync(dir);}finally{fs.closeSync(dir);}
    for(const pin of pins)pin.check();const ref=Object.freeze({sha256,bytes:bytes.length});readTask4ProofV1(root,name,ref);return ref;
  }catch{return refuseV1("TASK4_RESULT_PUBLICATION_FAILED");}
  finally{if(fd!==undefined)try{fs.closeSync(fd);}catch{}for(const pin of pins.reverse())pin.close();}
}
export function readTask4ProofV1(root:string,name:"parent-result.json"|"runner-result.json"|"inner-result.json"|"artifact",ref?:Task4RefV1):Readonly<{value:RecordV1;ref:Task4RefV1}> {
  const pins:Array<{check:()=>void;close:()=>void}>=[];
  try {
    requireV1(["parent-result.json","runner-result.json","inner-result.json","artifact"].includes(name));
    pins.push(pinTask4DirectoryV1(root,true));const cap=name==="artifact"?1048576:16384;if(ref)proofRefV1(ref,cap);
    if(name==="artifact"){requireV1(ref);pins.push(pinTask4DirectoryV1(path.join(root,"parent"),true));pins.push(pinTask4DirectoryV1(path.join(root,"parent/artifacts"),true));}
    const locator=path.join(root,name==="artifact"?"parent/artifacts/"+ref!.sha256+".json":name);
    const file=pinTask4FileV1(locator,cap);pins.push(file);requireV1((fs.lstatSync(locator).mode&0o777)===0o600);
    const text=new TextDecoder("utf-8",{fatal:true,ignoreBOM:true}).decode(file.bytes),value=JSON.parse(text);
    requireV1(text===task4CanonicalV1(value)+"\n"&&value&&typeof value==="object"&&!Array.isArray(value));
    const observed=Object.freeze({sha256:file.hash,bytes:file.bytes.length});if(ref)requireV1(task4CanonicalV1(ref)===task4CanonicalV1(observed));
    for(const pin of pins)pin.check();return freezeV1({value,ref:observed});
  }catch{return refuseV1("TASK4_INTEGRITY_FAILED");}finally{for(const pin of pins.reverse())pin.close();}
}
export function task4ProbesV1(executionId:string):ReadonlyArray<Readonly<{id:string;statement:string}>> {
  hexV1(executionId,32);const name="task4_denied_"+executionId;
  return freezeV1([
    {id:"insert",statement:"INSERT INTO public.runs (id,workflow_id,task,status) SELECT 'task4_denied','feature-dev','Task4 denied probe','running' WHERE false"},
    {id:"update",statement:"UPDATE public.runs SET task = task WHERE false"},
    {id:"delete",statement:"DELETE FROM public.runs WHERE false"},
    {id:"create_table",statement:`CREATE TABLE public.${name} (id integer)`},
    {id:"create_temp",statement:`CREATE TEMP TABLE ${name} (id integer)`},
    {id:"create_schema",statement:`CREATE SCHEMA ${name}`},
    {id:"create_function",statement:`CREATE FUNCTION public.${name}() RETURNS integer LANGUAGE sql AS 'SELECT 1'`},
  ]);
}
export async function observeTask4UntouchedV1(sql:QueryPortV1):Promise<Readonly<RecordV1>> {
  const rows=await sql.unsafe(`/*task4:untouched-catalog*/ SELECT c.relname AS name,c.relkind::text AS kind
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public'
    AND c.relkind IN ('r','p','v','m','f','S') ORDER BY c.relname COLLATE "C" LIMIT 4097`);
  requireV1(rows.length<=4096,"TASK4_DATABASE_REFUSED");
  const tables:RecordV1[]=[],sequences:RecordV1[]=[],seen=new Set<string>();
  for(const row of rows){keysV1(row,"name kind");requireV1(typeof row.name==="string"&&/^[a-z_][a-z0-9_]{0,62}$/.test(row.name)
    &&!seen.has(row.name)&&(row.kind==="r"||row.kind==="S"),"TASK4_DATABASE_REFUSED");seen.add(row.name);
    if(row.kind==="S"){
      const state=await sql.unsafe(`/*task4:untouched-sequence*/ SELECT last_value::text AS last_value,is_called FROM public."${row.name}"`);
      requireV1(state.length===1,"TASK4_DATABASE_REFUSED");keysV1(state[0],"last_value is_called");
      requireV1(/^-?[0-9]{1,20}$/.test(state[0].last_value)&&typeof state[0].is_called==="boolean","TASK4_DATABASE_REFUSED");sequences.push({name:row.name,...state[0]});
    }else{
      const data=await sql.unsafe(`/*task4:untouched-table*/ SELECT to_jsonb(t) AS row FROM public."${row.name}" t ORDER BY to_jsonb(t)::text COLLATE "C" LIMIT 4097`);
      requireV1(data.length<=4096,"TASK4_DATABASE_REFUSED");for(const record of data)keysV1(record,"row");
      tables.push({name:row.name,rows:data.map(record=>record.row)});
    }
  }
  const observation={schema:"setfarm.task4-untouched-database.v1",tables,sequences};task4CanonicalV1(observation);return freezeV1(observation);
}
const TASK4_VECTOR_V1=Object.freeze(["node","--import","tsx","--test","--test-concurrency=1","tests/fixtures/mission-control-render-smoke-owned-v1.ts"]);
function task4GitV1(root:string,args:readonly string[]):string {
  const result=spawnSync("/usr/bin/git",["-C",root,...args],{encoding:"utf8",timeout:5000,maxBuffer:16777216,
    env:{PATH:"/usr/bin:/bin",LANG:"C",LC_ALL:"C",GIT_CONFIG_NOSYSTEM:"1",GIT_CONFIG_GLOBAL:"/dev/null",GIT_CONFIG_SYSTEM:"/dev/null",GIT_CONFIG_COUNT:"0",GIT_TERMINAL_PROMPT:"0"}});
  requireV1(!result.error&&result.status===0&&result.signal===null&&!result.stderr,"TASK4_SOURCE_DRIFT");return result.stdout;
}
export function measureTask4SourceV1(root:string) {
  const directory=pinTask4DirectoryV1(root);let closed=false;
  const scan=()=>{
    directory.check();const head=task4GitV1(root,["rev-parse","HEAD"]).trim(),tree=task4GitV1(root,["rev-parse","HEAD^{tree}"]).trim();
    hexV1(head,40);hexV1(tree,40);requireV1(task4GitV1(root,["status","--porcelain=v1","--untracked-files=no"])==="","TASK4_SOURCE_DRIFT");
    const index=task4GitV1(root,["ls-files","--stage","-z"]),members:Array<{path:string;sha256:string}>=[],stamps:string[]=[];
    const rows=index.split("\0").filter(Boolean);requireV1(rows.length<=4096);
    for(const row of rows){const match=/^(100644|100755) [a-f0-9]{40,64} 0\t([^\u0000-\u001f\u007f]+)$/.exec(row);requireV1(match,"TASK4_SOURCE_DRIFT");
      const name=match[2]!;requireV1(!path.isAbsolute(name)&&path.normalize(name)===name&&!name.split("/").some(p=>p===".."||p==="."||!p),"TASK4_SOURCE_DRIFT");
      const pin=pinTask4FileV1(path.join(root,name),16777216);try{
        const s=fs.lstatSync(path.join(root,name),{bigint:true});requireV1(Number(s.mode&0o777n)===(match[1]==="100755"?0o755:0o644),"TASK4_SOURCE_DRIFT");
        members.push({path:name,sha256:pin.hash});stamps.push([name,s.dev,s.ino,s.uid,s.mode,s.nlink,s.size,s.mtimeNs,s.ctimeNs].join(":"));pin.check();
      }finally{pin.close();}}
    requireV1(task4GitV1(root,["rev-parse","HEAD"]).trim()===head&&task4GitV1(root,["ls-files","--stage","-z"])===index,"TASK4_SOURCE_DRIFT");directory.check();
    return {root,sourceSha:head,treeHash:tree,inputManifestHash:task4InputManifestV1(index,members),stamps:hashV1(JSON.stringify(stamps))};
  };
  try {const first=scan(),{stamps,...value}=first;return Object.freeze({value:Object.freeze(value),check(){
    requireV1(!closed&&task4CanonicalV1(scan())===task4CanonicalV1(first),"TASK4_SOURCE_DRIFT");},close(){if(!closed){closed=true;directory.close();}}});
  }catch{directory.close();return refuseV1("TASK4_SOURCE_DRIFT");}
}
export function observeTask4ProcessV1(pid:number):Readonly<RecordV1> {
  integerV1(pid);
  const ps=(args:string[])=>{const result=spawnSync("/bin/ps",args,{encoding:"utf8",timeout:2000,maxBuffer:16384,env:{PATH:"/usr/bin:/bin",LANG:"C",LC_ALL:"C",TZ:"UTC"}});
    requireV1(!result.error&&result.status===0&&result.signal===null&&!result.stderr,"TASK4_BINDING_REFUSED");return result.stdout;};
  const args=["-ww","-p",String(pid),"-o","pid=","-o","ppid=","-o","uid=","-o","lstart=","-o","pgid=","-o","args="];
  const before=ps(args),comm=ps(["-ww","-p",String(pid),"-o","comm="]),after=ps(args);
  const executable=/^([^\r\n]+)\n$/.exec(comm)?.[1];requireV1(executable,"TASK4_BINDING_REFUSED");
  const pin=pinTask4FileV1(executable,536870912,"executable");try{return parseTask4ProcessV1(pid,before,comm,after,pin.hash);}finally{pin.close();}
}
export async function prepareTask4ContextV1(input:unknown,role:"runner"|"fixture",adminUrl:string) {
  const setup=parseTask4FrameV1(Buffer.from(task4CanonicalV1(input)+"\n"),"setup");
  const local=fs.realpathSync(fileURLToPath(new URL("../../",import.meta.url)));
  requireV1(role==="runner"?local===setup.setfarm.source.root:local.startsWith(path.join(setup.resourceRoot.path,"tmp")+"/"),"TASK4_BINDING_REFUSED");
  const admin=new URL(adminUrl);
  requireV1(admin.toString()===adminUrl&&admin.protocol==="postgres:"&&admin.hostname==="127.0.0.1"&&admin.port===String(setup.postgres.port)
    &&admin.pathname==="/postgres"&&!admin.search&&!admin.hash&&hashV1(adminUrl)===setup.postgres.adminUrlHash,"TASK4_BINDING_REFUSED");
  const pins:Array<{check:()=>void;close:()=>void}>=[];let closed=false;
  try {
    for(const expected of [setup.resourceRoot,setup.setfarm.rootPin,setup.missionControl.rootPin,setup.postgres.data,setup.postgres.socket]){
      const pin=pinTask4DirectoryV1(expected.path,expected.mode===0o700);pins.push(pin);
      requireV1(task4CanonicalV1(pin.value)===task4CanonicalV1(expected),"TASK4_BINDING_REFUSED");}
    const home=path.join(setup.resourceRoot.path,"home"),tmp=path.join(setup.resourceRoot.path,"tmp");
    for(const dir of [home,tmp])pins.push(pinTask4DirectoryV1(dir,true));
    requireV1(process.env.HOME===home&&process.env.TMPDIR===tmp&&tmpdir()===tmp,"TASK4_BINDING_REFUSED");
    const sf=measureTask4SourceV1(setup.setfarm.source.root);pins.push(sf);
    requireV1(task4CanonicalV1(sf.value)===task4CanonicalV1(setup.setfarm.source),"TASK4_SOURCE_DRIFT");
    const mc=measureTask4SourceV1(setup.missionControl.source.root);pins.push(mc);
    requireV1(mc.value.sourceSha===setup.missionControl.source.sourceSha&&mc.value.treeHash===setup.missionControl.source.treeHash,"TASK4_SOURCE_DRIFT");
    const build=measureTask4BuildV1(setup.missionControl.source.root);pins.push(build);
    requireV1(build.identity.sourceSha===mc.value.sourceSha&&build.identity.treeHash===mc.value.treeHash
      &&build.identity.buildHash===setup.missionControl.source.buildHash&&build.identityHash===setup.missionControl.source.buildIdentityHash,"TASK4_SOURCE_DRIFT");
    const fixed=[
      [setup.setfarm.source.root,"scripts/run-isolated-postgres-tests.ts",setup.setfarm.runnerHash],
      [setup.setfarm.source.root,"tests/fixtures/mission-control-render-smoke-owned-v1.ts",setup.setfarm.fixtureHash],
      [setup.setfarm.source.root,"src/db/contract-spine-migrations.ts",setup.setfarm.migrationHash],
      [setup.missionControl.source.root,"scripts/render-smoke.mjs",setup.missionControl.source.harness.renderSmokeHash],
      [setup.missionControl.source.root,"scripts/render-smoke-owned-fixture.mjs",setup.missionControl.source.harness.ownedFixtureHash],
      [setup.missionControl.source.root,"tests/fixtures/render-smoke-product-authority.mjs",setup.missionControl.source.harness.productAuthorityFixtureHash],
    ];
    for(const [root,member,expected] of fixed){const pin=pinTask4FileV1(path.join(root,member),16777216);pins.push(pin);requireV1(pin.hash===expected,"TASK4_SOURCE_DRIFT");}
    const node=fs.realpathSync(process.execPath),owner=observeTask4ProcessV1(process.pid);
    requireV1(owner.pin.executable===node&&owner.pin.uid===process.getuid!(),"TASK4_BINDING_REFUSED");
    const runnerCommand=[node,"--import","tsx",path.join(setup.setfarm.source.root,"scripts/run-isolated-postgres-tests.ts"),"--",...TASK4_VECTOR_V1].join(" ");
    if(role==="runner")requireV1(owner.rawCommand===runnerCommand&&owner.pin.ppid===setup.owner.pid,"TASK4_BINDING_REFUSED");
    else {const parent=observeTask4ProcessV1(process.ppid);requireV1(parent.rawCommand===runnerCommand&&parent.pin.ppid===setup.owner.pid
      &&owner.rawCommand===[node,...TASK4_VECTOR_V1.slice(1)].join(" "),"TASK4_BINDING_REFUSED");}
    const outer=observeTask4ProcessV1(setup.owner.pid);requireV1(task4CanonicalV1(outer.pin)===task4CanonicalV1(setup.owner),"TASK4_BINDING_REFUSED");
    const scenario=task4ScenarioV1(outer.rawCommand,node,setup.missionControl.source.root);
    const check=()=>{
      requireV1(!closed,"TASK4_BINDING_REFUSED");for(const pin of pins)pin.check();
      for(const expected of [setup.owner,setup.postgres.process,owner.pin])requireV1(task4CanonicalV1(observeTask4ProcessV1(expected.pid).pin)===task4CanonicalV1(expected),"TASK4_BINDING_REFUSED");
    };
    check();
    const {default:postgres}=await import("postgres");check();
    const sql=postgres(adminUrl,{max:1,connect_timeout:5,idle_timeout:1,onnotice:()=>{},connection:{statement_timeout:5000,application_name:"task4_parent_"+setup.executionId}});
    try {
      await sql.begin("read only",async tx=>{
        const rows=await tx.unsafe(`SELECT current_database() AS database, current_setting('data_directory') AS data_directory,
          current_setting('port')::int AS port, current_setting('server_version_num')::int AS version,
          to_char(pg_postmaster_start_time() AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS started_at`);
        requireV1(rows.length===1&&rows[0]!.database==="postgres"&&rows[0]!.data_directory===setup.postgres.data.path
          &&rows[0]!.port===setup.postgres.port&&rows[0]!.version===170010&&rows[0]!.started_at===setup.postgres.serverStartedAt,"TASK4_DATABASE_REFUSED");
        check();const settings=await tx.unsafe(TASK4_PG_SETTINGS_SQL_V1);check();requireV1(settings.length===1,"TASK4_SQL_ORIGINALS_UNKNOWN");validateTask4PgSettingsV1(settings[0],false);
      });check();
    }finally{await sql.end({timeout:5});}
    check();return Object.freeze({check,close(){if(!closed){closed=true;for(const pin of pins.reverse())pin.close();}},scenario,owner:owner.pin,home,tmp});
  }catch(error){for(const pin of pins.reverse())pin.close();throw error;}
}
export function measureTask4BuildV1(root:string):Readonly<{identity:RecordV1;identityHash:string;check:()=>void;close:()=>void}> {
  const rootPin=pinTask4DirectoryV1(root);let closed=false;
  const scan=()=>{
    const members:Array<{name:string;hash:string;stat:string}>=[],dirs:Array<{name:string;stat:string}>=[];
    const bytesHash=createHash("sha256").update("mission-control.internal-production-build-content.v1\0");
    const names:string[]=[];let total=0;
    const visit=(directory:string,depth:number)=>{
      requireV1(depth<=32&&dirs.length<4096,"TASK4_SOURCE_DRIFT");
      const pin=pinTask4DirectoryV1(directory);try{
        dirs.push({name:path.relative(root,directory),stat:task4CanonicalV1(pin.value)});
        for(const item of fs.readdirSync(directory,{withFileTypes:true})){
          const name=path.join(directory,item.name);
          if(item.isDirectory())visit(name,depth+1);
          else {requireV1(item.isFile()&&names.length<8192,"TASK4_SOURCE_DRIFT");names.push(path.relative(root,name));}
        }pin.check();
      }finally{pin.close();}
    };
    rootPin.check();visit(path.join(root,"dist"),0);visit(path.join(root,"dist-server"),0);
    names.sort();let identity:RecordV1|undefined,identityHash:string|undefined;
    for(const name of names){const pin=pinTask4FileV1(path.join(root,name),536870912);try{
      total+=pin.bytes.length;requireV1(total<=1073741824,"TASK4_SOURCE_DRIFT");
      const stat=fs.lstatSync(path.join(root,name),{bigint:true});
      members.push({name,hash:pin.hash,stat:[stat.dev,stat.ino,stat.mode,stat.uid,stat.size,stat.nlink,stat.mtimeNs,stat.ctimeNs].join(":")});
      if(name==="dist-server/internal-production-build-identity.v1.json"){
        requireV1(pin.bytes.length<=16384);identity=JSON.parse(pin.bytes.toString("utf8"));identityHash=pin.hash;
      }else bytesHash.update(name).update("\0").update(String(pin.bytes.length)).update("\0").update(pin.bytes).update("\0");
      pin.check();
    }finally{pin.close();}}
    keysV1(identity,"schema sourceSha treeHash buildHash");hexV1(identity.sourceSha,40);hexV1(identity.treeHash,40);hexV1(identity.buildHash);
    requireV1(identity.schema==="mission-control.internal-production-build-identity.v1"&&identity.buildHash===bytesHash.digest("hex")
      &&["dist/index.html","dist-server/index.js","dist-server/services/setfarm-product-build-authority.js","dist-server/scripts/ui-regression-lifecycle.mjs"].every(name=>names.includes(name)),"TASK4_SOURCE_DRIFT");
    rootPin.check();return {identity,identityHash:identityHash!,fingerprint:hashV1(JSON.stringify({members,dirs}))};
  };
  try {
    const first=scan();
    return Object.freeze({identity:freezeV1(first.identity),identityHash:first.identityHash,check(){try{
      requireV1(!closed&&scan().fingerprint===first.fingerprint,"TASK4_SOURCE_DRIFT");
    }catch{return refuseV1("TASK4_SOURCE_DRIFT");}},close(){if(!closed){closed=true;rootPin.close();}}});
  }catch{rootPin.close();return refuseV1("TASK4_SOURCE_DRIFT");}
}

export function parseTask4ProcessV1(pid:number,before:string,comm:string,after:string,executableHash:string):Readonly<RecordV1> {
  try {
    integerV1(pid);hexV1(executableHash);requireV1(before===after&&Buffer.byteLength(before)<=16384);
    const row=/^\s*(\d+)\s+(\d+)\s+(\d+)\s+([A-Z][a-z]{2} [A-Z][a-z]{2}\s+\d{1,2} \d\d:\d\d:\d\d \d{4})\s+(\d+)\s+([^\r\n]+)\n$/.exec(before);
    const executable=/^([^\r\n]+)\n$/.exec(comm)?.[1];requireV1(row&&executable&&Number(row[1])===pid);pathV1(executable);
    const date=/^([A-Z][a-z]{2}) ([A-Z][a-z]{2})\s+(\d{1,2}) (\d\d):(\d\d):(\d\d) (\d{4})$/.exec(row[4]!);requireV1(date);
    const month=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"].indexOf(date[2]!);
    const day=Number(date[3]),hour=Number(date[4]),minute=Number(date[5]),second=Number(date[6]),year=Number(date[7]);
    requireV1(month>=0&&year>=1970&&day>=1&&day<=31&&hour<=23&&minute<=59&&second<=59);
    const actual=new Date(Date.UTC(year,month,day,hour,minute,second));
    requireV1(actual.getUTCFullYear()===year&&actual.getUTCMonth()===month&&actual.getUTCDate()===day
      &&["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][actual.getUTCDay()]===date[1]);
    const startedAt=actual.toISOString();
    const pin={pid,ppid:Number(row[2]),uid:Number(row[3]),startedAt,pgid:Number(row[5]),executable,executableHash,commandHash:hashV1(row[6]!)};
    processV1(pin);return freezeV1({pin,rawCommand:row[6]!});
  }catch{return refuseV1("TASK4_BINDING_REFUSED");}
}
export function pinTask4DirectoryV1(locator:string,privateMode=false):Readonly<{value:RecordV1;check:()=>void;close:()=>void}> {
  let fd:number|undefined;
  try {
    pathV1(locator);requireV1(fs.realpathSync(locator)===locator);
    const ancestors:Array<{path:string;dev:bigint;ino:bigint;uid:bigint;mode:bigint}>=[];
    for(let current=locator;;current=path.dirname(current)){
      const stat=fs.lstatSync(current,{bigint:true});requireV1(stat.isDirectory()&&!stat.isSymbolicLink());
      ancestors.push({path:current,dev:stat.dev,ino:stat.ino,uid:stat.uid,mode:stat.mode});
      if(current===path.dirname(current))break;requireV1(ancestors.length<128);
    }
    const first=ancestors[0]!;const value={path:locator,dev:String(first.dev),ino:String(first.ino),uid:Number(first.uid),mode:Number(first.mode&0o777n)};
    directoryV1(value,privateMode);requireV1(value.uid===process.getuid!());
    fd=fs.openSync(locator,fs.constants.O_RDONLY|fs.constants.O_DIRECTORY|fs.constants.O_NOFOLLOW);let closed=false;
    const check=()=>{try{
      requireV1(!closed&&fs.realpathSync(locator)===locator);
      for(const old of ancestors){const now=fs.lstatSync(old.path,{bigint:true});requireV1(now.isDirectory()&&!now.isSymbolicLink()
        &&now.dev===old.dev&&now.ino===old.ino&&now.uid===old.uid&&now.mode===old.mode);}
      const opened=fs.fstatSync(fd!,{bigint:true});requireV1(opened.dev===first.dev&&opened.ino===first.ino&&opened.mode===first.mode&&opened.uid===first.uid);
    }catch{return refuseV1("TASK4_SOURCE_DRIFT");}};
    check();return Object.freeze({value:Object.freeze(value),check,close(){if(!closed){closed=true;fs.closeSync(fd!);}}});
  }catch{if(fd!==undefined)try{fs.closeSync(fd);}catch{}return refuseV1("TASK4_SOURCE_DRIFT");}
}

export function task4ScenarioV1(command:string,node:string,root:string):"pass"|"assertion_failure"|"owned_cancel" {
  pathV1(node);pathV1(root);
  const base=node+" "+path.join(root,"scripts/render-smoke.mjs");
  if(command===base||command===base+" --owned-fixture-v1")return "pass";
  if(command===base+" --owned-fixture-assertion-failure-v1")return "assertion_failure";
  if(command===base+" --owned-fixture-owned-cancel-v1")return "owned_cancel";
  return refuseV1("TASK4_BINDING_REFUSED");
}
export function observeTask4OriginalChildV1(child:import("node:child_process").ChildProcess):Promise<Readonly<{code:number|null;signal:string|null;exitObserved:boolean;closeObserved:boolean}>> {
  return new Promise((resolve,reject)=>{
    let exit:{code:number|null;signal:string|null}|null=null,failed=false;
    // Keep the original error listener until close; an error is never a replacement exit observation.
    child.on("error",()=>{failed=true;});
    child.once("exit",(code,signal)=>{exit={code,signal};});
    child.once("close",(code,signal)=>{
      if(failed||!exit||exit.code!==code||exit.signal!==signal)reject(new Error("TASK4_CHILD_UNKNOWN"));
      else resolve(Object.freeze({...exit,exitObserved:true,closeObserved:true}));
    });
  });
}

export function pinTask4FileV1(locator:string,cap:number,kind:"source"|"executable"="source") {
  let fd:number|undefined;
  const failure=():never=>refuseV1("TASK4_SOURCE_DRIFT");
  try {
    pathV1(locator);requireV1(Number.isSafeInteger(cap)&&cap>0&&cap<=536870912);
    const parents:Array<{path:string;stat:fs.BigIntStats}>=[];
    for(let parent=path.dirname(locator);;parent=path.dirname(parent)) {
      const stat=fs.lstatSync(parent,{bigint:true});if(!stat.isDirectory()||stat.isSymbolicLink())failure();
      parents.push({path:parent,stat});if(parent===path.dirname(parent))break;if(parents.length>128)failure();
    }
    const first=fs.lstatSync(locator,{bigint:true});
    const same=(a:fs.BigIntStats,b:fs.BigIntStats)=>["dev","ino","mode","uid","gid","size","nlink","mtimeNs","ctimeNs"]
      .every(key=>a[key as keyof fs.BigIntStats]===b[key as keyof fs.BigIntStats]);
    if(!first.isFile()||first.isSymbolicLink()||first.nlink!==1n||first.size>BigInt(cap)||first.mode&0o022n
      ||(kind==="source"&&first.uid!==BigInt(process.getuid!()))||fs.realpathSync(locator)!==locator)failure();
    fd=fs.openSync(locator,fs.constants.O_RDONLY|fs.constants.O_NOFOLLOW);
    const read=()=>{
      const opened=fs.fstatSync(fd!,{bigint:true});if(!same(first,opened))failure();
      const bytes=Buffer.alloc(Number(first.size));let offset=0;
      while(offset<bytes.length){const count=fs.readSync(fd!,bytes,offset,bytes.length-offset,offset);if(!count)failure();offset+=count;}
      if(!same(first,fs.fstatSync(fd!,{bigint:true}))||!same(first,fs.lstatSync(locator,{bigint:true})))failure();
      return bytes;
    };
    const bytes=read(),hash=hashV1(bytes);let closed=false;
    const check=()=>{
      try {
        if(closed||fs.realpathSync(locator)!==locator)failure();
        for(const parent of parents){const now=fs.lstatSync(parent.path,{bigint:true});
          if(!now.isDirectory()||now.isSymbolicLink()||now.dev!==parent.stat.dev||now.ino!==parent.stat.ino||now.mode!==parent.stat.mode||now.uid!==parent.stat.uid)failure();}
        if(hashV1(read())!==hash)failure();
      }catch{return failure();}
    };
    check();return Object.freeze({bytes,hash,check,close(){if(!closed){closed=true;fs.closeSync(fd!);}}});
  }catch {if(fd!==undefined)try{fs.closeSync(fd);}catch{}return failure();}
}

export function isTask4CommandV1(value: readonly string[]): boolean {
  const fixed=["node","--import","tsx","--test","--test-concurrency=1","tests/fixtures/mission-control-render-smoke-owned-v1.ts"];
  return value.length===fixed.length&&value.every((cell,index)=>cell===fixed[index]);
}
export async function readTask4Fd4V1(kind: FrameKindV1): Promise<Readonly<RecordV1>> {
  let stat:fs.Stats;
  try {stat=fs.fstatSync(4);} catch {return refuseV1("TASK4_FRAME_MISSING");}
  if(!stat.isFIFO()&&!stat.isSocket()) {fs.closeSync(4);return refuseV1("TASK4_FRAME_INVALID");}
  let socket:Socket;
  try {socket=new Socket({fd:4,readable:true,writable:false});}
  catch {try{fs.closeSync(4);}catch{}return refuseV1("TASK4_FRAME_INVALID");}
  const chunks:Buffer[]=[];let size=0,eof=false,failure:string|null=null;
  return await new Promise<Readonly<RecordV1>>((resolve,reject)=>{
    const timer=setTimeout(()=>{failure="TASK4_FRAME_TIMEOUT";socket.destroy();reject(new Error(failure));},5000);
    socket.on("data",(chunk:Buffer)=>{
      size+=chunk.length;
      if(size>16384){failure="TASK4_FRAME_TOO_LARGE";socket.destroy();return;}
      chunks.push(chunk);
    });
    socket.once("error",()=>{failure??="TASK4_FRAME_INVALID";socket.destroy();});
    socket.once("end",()=>{eof=true;socket.destroy();});
    socket.once("close",()=>{
      clearTimeout(timer);
      if(failure||!eof){reject(new Error(failure??"TASK4_FRAME_INVALID"));return;}
      try{resolve(parseTask4FrameV1(Buffer.concat(chunks,size),kind));}catch(error){reject(error);}
    });
  });
}

type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
type RecordV1 = { [key: string]: any };
type QueryPortV1 = { unsafe(query:string,parameters?:readonly unknown[]):Promise<any[]> };
export function task4InputManifestV1(index:string,members:readonly {path:string;sha256:string}[]):string {
  try {
    requireV1(typeof index==="string"&&Buffer.byteLength(index)<=16777216&&index.endsWith("\0"));
    const rows=index.slice(0,-1).split("\0");requireV1(rows.length>0&&rows.length<=4096&&members.length===rows.length);
    const observed=new Map<string,string>();
    for(const member of members){keysV1(member,"path sha256");hexV1(member.sha256);requireV1(!observed.has(member.path));observed.set(member.path,member.sha256);}
    const paths=new Set<string>();
    const entries=rows.map(row=>{
      const match=/^(100644|100755) [a-f0-9]{40,64} 0\t([^\u0000-\u001f\u007f]+)$/.exec(row);requireV1(match);
      const name=match[2]!;requireV1(!path.isAbsolute(name)&&path.normalize(name)===name&&!name.split("/").some(p=>!p||p===".."||p===".")
        &&!paths.has(name)&&observed.has(name));paths.add(name);
      return {path:name,gitMode:match[1]!,sha256:observed.get(name)!};
    }).sort((a,b)=>Buffer.compare(Buffer.from(a.path),Buffer.from(b.path)));
    return hashV1(task4CanonicalV1({schema:"setfarm.task4.source-input-manifest.v1",entries}));
  } catch {return refuseV1("TASK4_SOURCE_DRIFT");}
}
export async function observeTask4GrantsV1(sql:QueryPortV1,database:string,role:string):Promise<Readonly<RecordV1>> {
  const fail=()=>refuseV1("TASK4_DATABASE_REFUSED");
  const read=async(tag:string,query:string,cap=4096)=>{
    const rows=await sql.unsafe(`/*task4:${tag}*/ ${query} LIMIT ${cap+1}`);
    if(!Array.isArray(rows)||rows.length>cap)return fail();return rows;
  };
  const ordinary="n.nspname NOT IN ('pg_catalog','information_schema') AND n.nspname !~ '^pg_'";
  const roleRows=await read("role",`SELECT rolname AS name,current_user::text AS "currentUser",session_user::text AS "sessionUser",
    rolcanlogin AS "canLogin",rolsuper AS superuser,rolcreatedb AS "createDatabase",rolcreaterole AS "createRole",rolinherit AS inherit,
    rolreplication AS replication,rolbypassrls AS "bypassRls" FROM pg_catalog.pg_roles WHERE rolname=current_user`);
  const settingRows=await read("settings",`SELECT current_database()::text AS database,current_setting('default_transaction_read_only') AS "defaultTransactionReadOnly",
    current_setting('lo_compat_privileges')::boolean AS "loCompatPrivileges",pg_is_in_recovery() AS recovery`);
  if(roleRows.length!==1||settingRows.length!==1||settingRows[0]!.database!==database)return fail();
  const memberships=await read("memberships",`SELECT parent.rolname AS role,m.admin_option AS "adminOption",m.inherit_option AS "inheritOption",m.set_option AS "setOption"
    FROM pg_catalog.pg_auth_members m JOIN pg_catalog.pg_roles member ON member.oid=m.member
    JOIN pg_catalog.pg_roles parent ON parent.oid=m.roleid WHERE member.rolname=current_user ORDER BY parent.rolname COLLATE "C"`);
  const ownedDataObjects=await read("owned",`SELECT * FROM (
    SELECT 'database'::text AS kind,''::text AS schema,d.datname AS name,d.datname::text AS identity FROM pg_catalog.pg_database d JOIN pg_catalog.pg_roles r ON r.oid=d.datdba WHERE r.rolname=current_user
    UNION ALL SELECT 'schema',n.nspname,n.nspname,n.nspname::text FROM pg_catalog.pg_namespace n JOIN pg_catalog.pg_roles r ON r.oid=n.nspowner WHERE r.rolname=current_user
    UNION ALL SELECT 'relation',n.nspname,c.relname,n.nspname||'.'||c.relname FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace JOIN pg_catalog.pg_roles r ON r.oid=c.relowner WHERE r.rolname=current_user
    UNION ALL SELECT 'routine',n.nspname,p.proname,n.nspname||'.'||p.proname||'('||pg_get_function_identity_arguments(p.oid)||')' FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace JOIN pg_catalog.pg_roles r ON r.oid=p.proowner WHERE r.rolname=current_user
    UNION ALL SELECT 'type',n.nspname,t.typname,n.nspname||'.'||t.typname FROM pg_catalog.pg_type t JOIN pg_catalog.pg_namespace n ON n.oid=t.typnamespace JOIN pg_catalog.pg_roles r ON r.oid=t.typowner WHERE r.rolname=current_user
    ) owned ORDER BY kind COLLATE "C",schema COLLATE "C",name COLLATE "C",identity COLLATE "C"`);
  const privileges=(fn:string,oid:string,names:readonly string[])=>names.map(name=>`${fn}(current_user,${oid},'${name}') AS "${name}"`).join(",");
  const databaseRows=await read("databases",`SELECT datname AS name,${privileges("has_database_privilege","oid",["CONNECT","CREATE","TEMPORARY"])} FROM pg_catalog.pg_database ORDER BY datname COLLATE "C"`);
  const schemaRows=await read("schemas",`SELECT n.nspname AS name,${privileges("has_schema_privilege","n.oid",["USAGE","CREATE"])} FROM pg_catalog.pg_namespace n WHERE ${ordinary} ORDER BY n.nspname COLLATE "C"`);
  const tableNames=["SELECT","INSERT","UPDATE","DELETE","TRUNCATE","REFERENCES","TRIGGER","MAINTAIN"];
  const relationRows=await read("relations",`SELECT n.nspname AS schema,c.relname AS name,c.relkind AS kind,${privileges("has_table_privilege","c.oid",tableNames)}
    FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace WHERE ${ordinary} AND c.relkind IN ('r','p','v','m','f') ORDER BY n.nspname COLLATE "C",c.relname COLLATE "C",c.relkind`);
  const columnNames=["SELECT","INSERT","UPDATE","REFERENCES"];
  const columnRows=await read("columns",`SELECT n.nspname AS schema,c.relname AS relation,a.attname AS column,
    ${columnNames.map(name=>`has_column_privilege(current_user,c.oid,a.attnum,'${name}') AS "${name}",has_table_privilege(current_user,c.oid,'${name}') AS "table${name}"`).join(",")}
    FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace JOIN pg_catalog.pg_attribute a ON a.attrelid=c.oid
    WHERE ${ordinary} AND c.relkind IN ('r','p','v','m','f') AND a.attnum>0 AND NOT a.attisdropped
    ORDER BY n.nspname COLLATE "C",c.relname COLLATE "C",a.attname COLLATE "C"`,65536);
  const sequenceRows=await read("sequences",`SELECT n.nspname AS schema,c.relname AS name,${privileges("has_sequence_privilege","c.oid",["USAGE","SELECT","UPDATE"])}
    FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace WHERE ${ordinary} AND c.relkind='S' ORDER BY n.nspname COLLATE "C",c.relname COLLATE "C"`);
  const routineRows=await read("routines",`SELECT n.nspname AS schema,p.proname AS name,pg_get_function_identity_arguments(p.oid) AS identity,p.prokind AS kind,p.prosecdef AS "securityDefiner",
    has_function_privilege(current_user,p.oid,'EXECUTE') AS "EXECUTE" FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
    WHERE ${ordinary} ORDER BY n.nspname COLLATE "C",p.proname COLLATE "C",pg_get_function_identity_arguments(p.oid) COLLATE "C",p.prokind`);
  const positive=(rows:RecordV1[],identity:string[],names:string[])=>{
    const result:RecordV1[]=[];
    for(const row of rows){
      for(const key of identity)if(typeof row[key]!=="string"||Buffer.byteLength(row[key])>2048)return fail();
      for(const name of names){if(typeof row[name]!=="boolean")return fail();if(row[name])result.push({...Object.fromEntries(identity.map(k=>[k,row[k]])),privilege:name});}
    }
    return result.sort((a,b)=>{for(const key of [...identity,"privilege"]){if(a[key]<b[key])return -1;if(a[key]>b[key])return 1;}return 0;});
  };
  const additionalColumnGrants:RecordV1[]=[];
  for(const row of columnRows){
    for(const key of ["schema","relation","column"])if(typeof row[key]!=="string")return fail();
    for(const name of columnNames){if(typeof row[name]!=="boolean"||typeof row["table"+name]!=="boolean")return fail();
      if(row[name]&&!row["table"+name])additionalColumnGrants.push({schema:row.schema,relation:row.relation,column:row.column,privilege:name});}
  }
  const applicationRoutineGrants=[];
  for(const row of routineRows){
    if(typeof row.EXECUTE!=="boolean"||typeof row.securityDefiner!=="boolean"||!["f","p","a","w"].includes(row.kind))return fail();
    if(row.EXECUTE)applicationRoutineGrants.push({schema:row.schema,name:row.name,identity:row.identity,kind:row.kind,securityDefiner:row.securityDefiner});
  }
  const {database:ignored,...settings}=settingRows[0]!;
  const observed={schema:"mission-control.task4-effective-data-read-grants.v1",database,role:roleRows[0],settings,memberships,ownedDataObjects,
    databaseGrants:positive(databaseRows,["name"],["CONNECT","CREATE","TEMPORARY"]),schemaGrants:positive(schemaRows,["name"],["USAGE","CREATE"]),
    relationGrants:positive(relationRows,["schema","name","kind"],tableNames),additionalColumnGrants,
    sequenceGrants:positive(sequenceRows,["schema","name"],["USAGE","SELECT","UPDATE"]),applicationRoutineGrants};
  validateTask4GrantsV1(observed,database,role);return freezeV1(observed);
}
export async function observeTask4SeedV1(sql:QueryPortV1,sourceSha:string):Promise<Readonly<RecordV1>> {
  const fail=()=>refuseV1("TASK4_DATABASE_REFUSED");
  const expected=task4SeedV1(sourceSha);
  const tables=["runs","v3_release_admissions","prd_templates",...expected.emptyRelations.map((r:RecordV1)=>r.name)].sort();
  const catalog=await sql.unsafe(`SELECT c.relname AS name,c.relkind AS kind,c.relrowsecurity AS rls,c.relforcerowsecurity AS "forceRls",
    jsonb_agg(jsonb_build_object('name',a.attname,'type',t.typname) ORDER BY a.attname COLLATE "C") AS columns
    FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
    JOIN pg_catalog.pg_attribute a ON a.attrelid=c.oid AND a.attnum>0 AND NOT a.attisdropped
    JOIN pg_catalog.pg_type t ON t.oid=a.atttypid WHERE n.nspname='public' AND c.relname=ANY($1::text[])
    GROUP BY c.relname,c.relkind,c.relrowsecurity,c.relforcerowsecurity ORDER BY c.relname COLLATE "C" LIMIT 4097`,[tables]);
  if(catalog.length!==tables.length)return fail();
  const projections:Record<string,RecordV1>={runs:expected.runs[0],v3_release_admissions:expected.releaseAdmissions[0],prd_templates:expected.templateRows[0]};
  for(const [index,row]of catalog.entries()) {
    if(row.name!==tables[index]||row.kind!=="r"||row.rls!==false||row.forceRls!==false||!Array.isArray(row.columns)||!row.columns.length)return fail();
    const sample=projections[row.name];
    if(sample){
      const columns=Object.keys(sample).sort().map(name=>({name,type:["created_at","updated_at","expires_at"].includes(name)?"timestamptz":name==="payload"?"jsonb":["run_number","protocol_version"].includes(name)?"int4":"text"}));
      if(task4CanonicalV1(row.columns)!==task4CanonicalV1(columns))return fail();
    }
  }
  const read=async(name:string,sample:RecordV1,order:string)=>{
    const columns=Object.keys(sample).sort(),times=columns.filter(k=>["created_at","updated_at","expires_at"].includes(k));
    const values=columns.map(k=>`'${k}',${times.includes(k)?`CASE WHEN "${k}" IS NULL THEN NULL ELSE to_char("${k}" AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') END`:`"${k}"`}`).join(",");
    const precision=times.map(k=>`("${k}" IS NULL OR "${k}"=date_trunc('milliseconds',"${k}"))`).join(" AND ");
    const rows=await sql.unsafe(`SELECT jsonb_build_object(${values}) AS row,(${precision}) AS precision_ok FROM public."${name}" ORDER BY "${order}" COLLATE "C" LIMIT 4097`);
    if(rows.length>4096||rows.some(row=>row.precision_ok!==true))return fail();return rows.map(row=>row.row);
  };
  const runs=await read("runs",projections.runs!,"id"),releaseAdmissions=await read("v3_release_admissions",projections.v3_release_admissions!,"admission_hash");
  const templateRows=await read("prd_templates",projections.prd_templates!,"id");
  const emptyRelations=[];
  for(const entry of expected.emptyRelations){
    const rows=await sql.unsafe(`SELECT to_jsonb(t) AS row FROM public."${entry.name}" t ORDER BY to_jsonb(t)::text COLLATE "C" LIMIT 4097`);
    if(rows.length)return fail();emptyRelations.push({schema:"public",name:entry.name,rows:[]});
  }
  const observed={schema:expected.schema,sourceSha,runs,releaseAdmissions,templateRows,emptyRelations,productResponse:expected.productResponse};
  validateTask4SeedV1(observed,sourceSha);return freezeV1(observed);
}
type FrameKindV1 = "launch" | "setup" | "ready";
function refuseV1(code = "TASK4_SHAPE_INVALID"): never { throw new Error(code); }
function requireV1(ok: unknown, code?: string): asserts ok { if (!ok) refuseV1(code); }
function hashV1(value: string | Uint8Array): string { return createHash("sha256").update(value).digest("hex"); }
function freezeV1<T>(value: T): T {
  if (value && typeof value === "object") { for (const child of Object.values(value)) freezeV1(child); Object.freeze(value); }
  return value;
}
export function task4CanonicalV1(value: unknown): string {
  const visit = (v: unknown, depth: number): Json => {
    requireV1(depth <= 16);
    if (v === null || typeof v === "boolean") return v;
    if (typeof v === "number") { requireV1(Number.isSafeInteger(v)); return v; }
    if (typeof v === "string") {
      requireV1(Buffer.byteLength(v) <= 16384 && !/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u.test(v)); return v;
    }
    if (Array.isArray(v)) { requireV1(v.length <= 4096); return v.map(x => visit(x, depth + 1)); }
    requireV1(v && typeof v === "object" && Object.getPrototypeOf(v) === Object.prototype);
    const keys = Object.keys(v).sort(); requireV1(keys.length <= 32 && keys.every(k => /^[\x20-\x7e]+$/.test(k)));
    const result: Record<string, Json> = {};
    for (const key of keys) {
      requireV1(key !== "__proto__" && Object.getOwnPropertyDescriptor(v, key)?.get === undefined);
      result[key] = visit((v as Record<string, unknown>)[key], depth + 1);
    }
    return result;
  };
  const result = JSON.stringify(visit(value, 0)); requireV1(Buffer.byteLength(result) <= 1048576); return result;
}
function keysV1(v: unknown, keys: string): asserts v is RecordV1 {
  requireV1(v && typeof v === "object" && !Array.isArray(v)
    && Object.keys(v).sort().join("|") === keys.split(" ").sort().join("|"));
}
function hexV1(v: unknown, length = 64) { requireV1(typeof v === "string" && new RegExp(`^[a-f0-9]{${length}}$`).test(v)); }
function integerV1(v: unknown, min = 1, max = 2147483647) { requireV1(Number.isSafeInteger(v) && Number(v) >= min && Number(v) <= max); }
function pathV1(v: unknown) {
  requireV1(typeof v === "string" && Buffer.byteLength(v) <= 1024 && path.isAbsolute(v) && path.normalize(v) === v
    && !/[\u0000-\u001f\u007f]/.test(v) && !v.endsWith("/") && !v.split("/").slice(1).some(x => !x || x === "." || x === ".."));
}
function directoryV1(v: unknown, privateMode = false) {
  keysV1(v,"path uid dev ino mode"); pathV1(v.path); integerV1(v.uid); integerV1(v.mode,0,511);
  for (const n of [v.dev,v.ino]) requireV1(typeof n === "string" && /^[1-9][0-9]{0,19}$/.test(n));
  requireV1((v.mode & 0o022) === 0 && (!privateMode || v.mode === 0o700));
}
function processV1(v: unknown) {
  keysV1(v,"pid ppid pgid uid startedAt executable executableHash commandHash");
  for (const k of ["pid","ppid","pgid","uid"]) integerV1(v[k]);
  requireV1(typeof v.startedAt === "string" && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(v.startedAt)
    && Number.isFinite(Date.parse(v.startedAt)) && new Date(v.startedAt).toISOString() === v.startedAt);
  pathV1(v.executable); hexV1(v.executableHash); hexV1(v.commandHash);
}
function sourceSfV1(v: unknown) {
  keysV1(v,"root sourceSha treeHash inputManifestHash"); pathV1(v.root); hexV1(v.sourceSha,40);hexV1(v.treeHash,40);hexV1(v.inputManifestHash);
}
function sourceMcV1(v: unknown) {
  keysV1(v,"root sourceSha treeHash buildIdentityHash buildHash harness"); pathV1(v.root);hexV1(v.sourceSha,40);hexV1(v.treeHash,40);
  hexV1(v.buildIdentityHash);hexV1(v.buildHash);keysV1(v.harness,"renderSmokeHash ownedFixtureHash productAuthorityFixtureHash");
  for (const h of Object.values(v.harness)) hexV1(h);
}
function setupV1(v: unknown) {
  keysV1(v,"schema executionId owner resourceRoot setfarm missionControl postgres");
  requireV1(v.schema === "setfarm.mc-render-smoke-setup.v1");hexV1(v.executionId,32);processV1(v.owner);directoryV1(v.resourceRoot,true);
  requireV1(path.basename(v.resourceRoot.path) === `task4-${v.executionId}`,"TASK4_BINDING_REFUSED");
  keysV1(v.setfarm,"source rootPin runnerHash fixtureHash migrationHash");sourceSfV1(v.setfarm.source);directoryV1(v.setfarm.rootPin);
  hexV1(v.setfarm.runnerHash);hexV1(v.setfarm.fixtureHash);hexV1(v.setfarm.migrationHash);
  keysV1(v.missionControl,"source rootPin");sourceMcV1(v.missionControl.source);directoryV1(v.missionControl.rootPin);
  requireV1(v.setfarm.rootPin.path === v.setfarm.source.root && v.missionControl.rootPin.path === v.missionControl.source.root,"TASK4_BINDING_REFUSED");
  keysV1(v.postgres,"host port major versionNum process data socket serverStartedAt adminUrlHash");
  const pg=v.postgres;requireV1(pg.host === "127.0.0.1" && pg.major === 17 && pg.versionNum === 170010);
  integerV1(pg.port,1024,65535);requireV1(![3080,3333,5432,13081,18789].includes(pg.port));processV1(pg.process);
  directoryV1(pg.data,true);directoryV1(pg.socket,true);hexV1(pg.adminUrlHash);
  requireV1(typeof pg.serverStartedAt === "string" && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{6}Z$/.test(pg.serverStartedAt)
    && Number.isFinite(Date.parse(pg.serverStartedAt)));
  requireV1(pg.process.ppid === v.owner.pid && pg.process.uid === v.owner.uid && v.resourceRoot.uid === v.owner.uid
    && pg.data.path === path.join(v.resourceRoot.path,"postgres-data") && pg.socket.path === path.join(v.resourceRoot.path,"postgres-socket")
    && pg.data.uid === v.owner.uid && pg.socket.uid === v.owner.uid
    && pg.process.executable === "/Users/setrox/ai/setrox/.task4-toolchain-v1/Cellar/postgresql@17/17.10/bin/postgres"
    && pg.process.executableHash === "38c50336c63ae8b73b799a8c0ebc4f948e311eee882a633c8286d1ca4110b502","TASK4_BINDING_REFUSED");
}
function readyV1(v: unknown) {
  keysV1(v,"schema executionId setup setupDescriptorHash fixtureOwner projection database fixture");
  requireV1(v.schema === "mission-control.render-smoke-fixture-ready.v1");hexV1(v.executionId,32);setupV1(v.setup);
  hexV1(v.setupDescriptorHash);processV1(v.fixtureOwner);
  requireV1(v.executionId === v.setup.executionId && v.setupDescriptorHash === hashV1(task4CanonicalV1(v.setup)+"\n"),"TASK4_BINDING_REFUSED");
  keysV1(v.projection,"root projectedHead inputManifestHash projectedManifestHash markerHash runDatabasePrefix");
  directoryV1(v.projection.root,true);hexV1(v.projection.projectedHead,40);
  for(const k of ["inputManifestHash","projectedManifestHash","markerHash"])hexV1(v.projection[k]);
  requireV1(/^setfarm_p3_[a-f0-9]{24}$/.test(v.projection.runDatabasePrefix));
  const relative=path.relative(path.join(v.setup.resourceRoot.path,"tmp"),v.projection.root.path);
  requireV1(/^setfarm-p3-projection-[A-Za-z0-9_-]+\/setfarm$/.test(relative)
    && v.projection.inputManifestHash === v.setup.setfarm.source.inputManifestHash
    && v.fixtureOwner.uid === v.setup.owner.uid && v.projection.root.uid === v.setup.owner.uid,"TASK4_BINDING_REFUSED");
  keysV1(v.database,"name role restrictedUrl restrictedUrlHash");hexV1(v.database.restrictedUrlHash);
  requireV1(typeof v.database.name === "string" && new RegExp(`^${v.projection.runDatabasePrefix}_clone_[a-f0-9]{12}$`).test(v.database.name)
    && v.database.role === `mc_task4_${v.executionId}`,"TASK4_BINDING_REFUSED");
  let url:URL;try{url=new URL(v.database.restrictedUrl);}catch{refuseV1("TASK4_BINDING_REFUSED");}
  requireV1(url.toString() === v.database.restrictedUrl && url.protocol === "postgres:" && url.hostname === "127.0.0.1"
    && url.port === String(v.setup.postgres.port) && url.pathname === "/"+v.database.name && !url.search && !url.hash
    && decodeURIComponent(url.username) === v.database.role && url.password.length > 0
    && v.database.restrictedUrlHash === hashV1(v.database.restrictedUrl),"TASK4_BINDING_REFUSED");
  keysV1(v.fixture,"seedDigest privilegeDigest readinessDigest admissionReadyHash manifestActivationHash manifestHeadHash");
  for(const h of Object.values(v.fixture))hexV1(h);
}
export function parseTask4FrameV1(bytes: Uint8Array, kind: FrameKindV1): Readonly<RecordV1> {
  requireV1(bytes instanceof Uint8Array,"TASK4_FRAME_INVALID");
  requireV1(bytes.byteLength <= 16384,"TASK4_FRAME_TOO_LARGE");
  let text:string,v:unknown;
  try {text=new TextDecoder("utf-8",{fatal:true,ignoreBOM:true}).decode(bytes);v=JSON.parse(text);
    requireV1(text === task4CanonicalV1(v)+"\n");}catch{refuseV1("TASK4_FRAME_INVALID");}
  const cap=(x:unknown,d=0):void=>{requireV1(d<=12);if(typeof x==="string")requireV1(Buffer.byteLength(x)<=2048);
    if(x&&typeof x==="object"){requireV1(Array.isArray(x)?x.length<=8:Object.keys(x).length<=16);for(const c of Object.values(x))cap(c,d+1);}};
  cap(v);
  if(kind === "launch") {keysV1(v,"schema setfarm missionControl");requireV1(v.schema === "mission-control.render-smoke-launch.v1");sourceSfV1(v.setfarm);sourceMcV1(v.missionControl);}
  else if(kind === "setup")setupV1(v);else if(kind === "ready")readyV1(v);else refuseV1();
  return freezeV1(v as RecordV1);
}
export function task4SeedV1(sourceSha: string): Readonly<RecordV1> {
  hexV1(sourceSha,40);
  const seed=JSON.parse(GOLDEN_SEED_V1);seed.sourceSha=sourceSha;
  const authority=seed.productResponse.packetAuthority,producer=authority.producer;producer.codeSha=sourceSha;
  const hash=(v:unknown)=>hashV1(task4CanonicalV1(v));
  const artifact=(payload:RecordV1)=>hash({schema:"setfarm.semantic-artifact-envelope.v1",artifactType:payload.schema,producer,payload});
  const hashes:Record<string,string>={};
  for(const key of ["productSpec","designGraph","buildTopology","storyPlan"])hashes[key]=artifact(authority[key]);
  authority.packet.compiler.codeSha=sourceSha;
  for(const key of Object.keys(hashes))authority.packet[key+"Hash"]=hashes[key];
  authority.packetHash=artifact(authority.packet);
  authority.compilationReport.compiler.codeSha=sourceSha;authority.compilationReport.packetHash=authority.packetHash;
  authority.compilationReport.artifactHashes=hashes;authority.refs={...hashes,packet:authority.packetHash,compilationReport:artifact(authority.compilationReport)};
  delete authority.authorityHash;authority.authorityHash=hash(authority);
  delete seed.productResponse.authorityHash;seed.productResponse.authorityHash=hash(seed.productResponse);
  const suiteHash=hash({fixture:"v3-release-admission",releaseSha:sourceSha}),resultHash=hash({fixture:"v3-release-result",releaseSha:sourceSha});
  const gateHash=hash({fixture:"v3-release-gate",releaseSha:sourceSha,resultHash}),preflightHash=hash({fixture:"v3-release-preflight",releaseSha:sourceSha});
  const ref=(h:string)=>`sha256/${h.slice(0,2)}/${h}.json`;
  const payload:RecordV1={schema:"setfarm.v3-release-admission.v1",kind:"release_go",releaseSha:sourceSha,suiteHash,
    result:{hash:resultHash,ref:ref(resultHash)},gate:{hash:gateHash,ref:ref(gateHash)},preflightHash,slots:[],issuedAt:"2026-07-13T00:00:00.000Z",expiresAt:null};
  payload.admissionHash=hash(payload);
  seed.releaseAdmissions=[{admission_hash:payload.admissionHash,kind:"release_go",release_sha:sourceSha,suite_hash:suiteHash,
    result_hash:resultHash,result_ref:ref(resultHash),gate_hash:gateHash,gate_ref:ref(gateHash),payload,created_at:payload.issuedAt,expires_at:null}];
  Object.assign(seed.runs[1],{compiler_release_sha:sourceSha,packet_hash:authority.packetHash,activation_preflight_hash:preflightHash,release_admission_hash:payload.admissionHash});
  return freezeV1(seed);
}
export function validateTask4SeedV1(value: unknown, sourceSha: string): void {
  requireV1(task4CanonicalV1(value) === task4CanonicalV1(task4SeedV1(sourceSha)),"TASK4_DATABASE_REFUSED");
}
export function task4GrantsV1(database:string,role:string):Readonly<RecordV1> {
  requireV1(/^setfarm_p3_[a-f0-9]{24}_clone_[a-f0-9]{12}$/.test(database)&&/^mc_task4_[a-f0-9]{32}$/.test(role));
  const grants=JSON.parse(GOLDEN_GRANTS_V1);grants.database=database;grants.databaseGrants[0].name=database;
  grants.role.name=role;grants.role.currentUser=role;grants.role.sessionUser=role;return freezeV1(grants);
}
export function validateTask4GrantsV1(value:unknown,database:string,role:string):void {
  requireV1(task4CanonicalV1(value) === task4CanonicalV1(task4GrantsV1(database,role)),"TASK4_DATABASE_REFUSED");
}
export async function extractTask4AuxiliaryV1(source:string):Promise<Readonly<{tables:string[];statements:string[];templates:RecordV1[]}>> {
  const fail=():never=>refuseV1("TASK4_AUXILIARY_SOURCE_REFUSED");
  try {
    requireV1(typeof source === "string" && Buffer.byteLength(source) <= 131072);
    const ts=await import("typescript");
    const tree=ts.createSourceFile("fixed-auxiliary.ts",source,ts.ScriptTarget.Latest,true);
    const literal=(node:import("typescript").Expression):any=>{
      if(ts.isStringLiteral(node)||ts.isNoSubstitutionTemplateLiteral(node))return node.text;
      if(ts.isArrayLiteralExpression(node))return node.elements.map(item=>literal(item));
      if(ts.isObjectLiteralExpression(node)){
        const value:RecordV1={};for(const item of node.properties){
          if(!ts.isPropertyAssignment(item)||!ts.isStringLiteral(item.name)||Object.hasOwn(value,item.name.text))return fail();
          value[item.name.text]=literal(item.initializer);
        }return value;
      }
      if(ts.isCallExpression(node)&&ts.isPropertyAccessExpression(node.expression)&&ts.isIdentifier(node.expression.expression)
        &&node.expression.expression.text==="Object"&&node.expression.name.text==="freeze"&&node.arguments.length===1
        &&(ts.isArrayLiteralExpression(node.arguments[0]!)||ts.isObjectLiteralExpression(node.arguments[0]!)))return literal(node.arguments[0]!);
      return fail();
    };
    const get=(name:string)=>{
      const found=tree.statements.flatMap(statement=>ts.isVariableStatement(statement)?statement.declarationList.declarations
        .filter(item=>ts.isIdentifier(item.name)&&item.name.text===name).map(item=>({statement,item})):[]);
      if(found.length!==1)return fail();const {statement,item}=found[0]!;
      if(!(statement.declarationList.flags&ts.NodeFlags.Const)||!item.initializer||!ts.isCallExpression(item.initializer))return fail();
      if(name === "TEMPLATE_SEEDS") {
        const rows=item.initializer.arguments[0];
        if(!rows||!ts.isArrayLiteralExpression(rows)||rows.elements.some(row=>!ts.isCallExpression(row)))return fail();
      }
      return literal(item.initializer);
    };
    const tables=get("TABLES"),statements=get("SCHEMA_STATEMENTS"),contents=get("TEMPLATE_CONTENTS"),seeds=get("TEMPLATE_SEEDS");
    requireV1(task4CanonicalV1(tables)===task4CanonicalV1(["tasks","prds","prd_templates","agent_feed","live_events"])
      &&Array.isArray(statements)&&statements.length===12&&statements.every((x:unknown)=>typeof x==="string"));
    requireV1(hashV1(task4CanonicalV1(statements)) === "8d92f68a499be0da73ae8061acdf1a217fdfc7af138edcc9b9645abce83fbce0");
    const expectedNames=[...tables,"idx_agent_feed_created","idx_live_events_ts","idx_live_events_status","idx_live_events_project","idx_live_events_agent","idx_live_events_action","idx_live_events_error"];
    for(const [i,sql] of statements.entries())requireV1(i<5?sql.startsWith(`CREATE TABLE public.${expectedNames[i]} (`):sql.startsWith(`CREATE INDEX ${expectedNames[i]} ON public.`));
    requireV1(Array.isArray(seeds)&&seeds.length===9&&Object.keys(contents).length===9);
    const templates=seeds.map((row:RecordV1)=>{keysV1(row,"id name category platform description");for(const value of Object.values(row))requireV1(typeof value==="string");
      requireV1(typeof contents[row.id]==="string");return {...row,prd_content:contents[row.id],created_at:"2026-10-19T00:00:00.000Z"};}).sort((a:any,b:any)=>a.id<b.id?-1:a.id>b.id?1:0);
    requireV1(task4CanonicalV1(templates)===task4CanonicalV1(JSON.parse(GOLDEN_SEED_V1).templateRows));
    return freezeV1({tables,statements,templates});
  } catch {return fail();}
}
const GOLDEN_LAUNCH_V1 = "{\"missionControl\":{\"buildHash\":\"7777777777777777777777777777777777777777777777777777777777777777\",\"buildIdentityHash\":\"6666666666666666666666666666666666666666666666666666666666666666\",\"harness\":{\"ownedFixtureHash\":\"9999999999999999999999999999999999999999999999999999999999999999\",\"productAuthorityFixtureHash\":\"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\",\"renderSmokeHash\":\"8888888888888888888888888888888888888888888888888888888888888888\"},\"root\":\"/fixture/mc\",\"sourceSha\":\"4444444444444444444444444444444444444444\",\"treeHash\":\"5555555555555555555555555555555555555555\"},\"schema\":\"mission-control.render-smoke-launch.v1\",\"setfarm\":{\"inputManifestHash\":\"3333333333333333333333333333333333333333333333333333333333333333\",\"root\":\"/fixture/sf\",\"sourceSha\":\"1111111111111111111111111111111111111111\",\"treeHash\":\"2222222222222222222222222222222222222222\"}}";
const GOLDEN_SETUP_V1 = "{\"executionId\":\"0123456789abcdef0123456789abcdef\",\"missionControl\":{\"rootPin\":{\"dev\":\"1\",\"ino\":\"102\",\"mode\":493,\"path\":\"/fixture/mc\",\"uid\":501},\"source\":{\"buildHash\":\"7777777777777777777777777777777777777777777777777777777777777777\",\"buildIdentityHash\":\"6666666666666666666666666666666666666666666666666666666666666666\",\"harness\":{\"ownedFixtureHash\":\"9999999999999999999999999999999999999999999999999999999999999999\",\"productAuthorityFixtureHash\":\"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\",\"renderSmokeHash\":\"8888888888888888888888888888888888888888888888888888888888888888\"},\"root\":\"/fixture/mc\",\"sourceSha\":\"4444444444444444444444444444444444444444\",\"treeHash\":\"5555555555555555555555555555555555555555\"}},\"owner\":{\"commandHash\":\"cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc\",\"executable\":\"/fixture/node\",\"executableHash\":\"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb\",\"pgid\":41001,\"pid\":41001,\"ppid\":41000,\"startedAt\":\"2026-10-19T09:00:00.000Z\",\"uid\":501},\"postgres\":{\"adminUrlHash\":\"1111111111111111111111111111111111111111111111111111111111111111\",\"data\":{\"dev\":\"1\",\"ino\":\"103\",\"mode\":448,\"path\":\"/fixture/task4-0123456789abcdef0123456789abcdef/postgres-data\",\"uid\":501},\"host\":\"127.0.0.1\",\"major\":17,\"port\":15432,\"process\":{\"commandHash\":\"dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd\",\"executable\":\"/Users/setrox/ai/setrox/.task4-toolchain-v1/Cellar/postgresql@17/17.10/bin/postgres\",\"executableHash\":\"38c50336c63ae8b73b799a8c0ebc4f948e311eee882a633c8286d1ca4110b502\",\"pgid\":41002,\"pid\":41002,\"ppid\":41001,\"startedAt\":\"2026-10-19T09:00:00.000Z\",\"uid\":501},\"serverStartedAt\":\"2026-10-19T09:00:01.000000Z\",\"socket\":{\"dev\":\"1\",\"ino\":\"104\",\"mode\":448,\"path\":\"/fixture/task4-0123456789abcdef0123456789abcdef/postgres-socket\",\"uid\":501},\"versionNum\":170010},\"resourceRoot\":{\"dev\":\"1\",\"ino\":\"100\",\"mode\":448,\"path\":\"/fixture/task4-0123456789abcdef0123456789abcdef\",\"uid\":501},\"schema\":\"setfarm.mc-render-smoke-setup.v1\",\"setfarm\":{\"fixtureHash\":\"ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff\",\"migrationHash\":\"0000000000000000000000000000000000000000000000000000000000000000\",\"rootPin\":{\"dev\":\"1\",\"ino\":\"101\",\"mode\":493,\"path\":\"/fixture/sf\",\"uid\":501},\"runnerHash\":\"eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee\",\"source\":{\"inputManifestHash\":\"3333333333333333333333333333333333333333333333333333333333333333\",\"root\":\"/fixture/sf\",\"sourceSha\":\"1111111111111111111111111111111111111111\",\"treeHash\":\"2222222222222222222222222222222222222222\"}}}";
const GOLDEN_READY_V1 = "{\"database\":{\"name\":\"setfarm_p3_222222222222222222222222_clone_333333333333\",\"restrictedUrl\":\"postgres://mc_task4_0123456789abcdef0123456789abcdef:vector-only@127.0.0.1:15432/setfarm_p3_222222222222222222222222_clone_333333333333\",\"restrictedUrlHash\":\"76c9fb63956e114750941817da5948e1ebb4cac206892bf7ef3ff02c95db23b4\",\"role\":\"mc_task4_0123456789abcdef0123456789abcdef\"},\"executionId\":\"0123456789abcdef0123456789abcdef\",\"fixture\":{\"admissionReadyHash\":\"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\",\"manifestActivationHash\":\"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb\",\"manifestHeadHash\":\"cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc\",\"privilegeDigest\":\"8888888888888888888888888888888888888888888888888888888888888888\",\"readinessDigest\":\"9999999999999999999999999999999999999999999999999999999999999999\",\"seedDigest\":\"7777777777777777777777777777777777777777777777777777777777777777\"},\"fixtureOwner\":{\"commandHash\":\"4444444444444444444444444444444444444444444444444444444444444444\",\"executable\":\"/fixture/node\",\"executableHash\":\"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb\",\"pgid\":41004,\"pid\":41005,\"ppid\":41004,\"startedAt\":\"2026-10-19T09:00:00.000Z\",\"uid\":501},\"projection\":{\"inputManifestHash\":\"3333333333333333333333333333333333333333333333333333333333333333\",\"markerHash\":\"6666666666666666666666666666666666666666666666666666666666666666\",\"projectedHead\":\"6666666666666666666666666666666666666666\",\"projectedManifestHash\":\"5555555555555555555555555555555555555555555555555555555555555555\",\"root\":{\"dev\":\"1\",\"ino\":\"105\",\"mode\":448,\"path\":\"/fixture/task4-0123456789abcdef0123456789abcdef/tmp/setfarm-p3-projection-vector/setfarm\",\"uid\":501},\"runDatabasePrefix\":\"setfarm_p3_222222222222222222222222\"},\"schema\":\"mission-control.render-smoke-fixture-ready.v1\",\"setup\":{\"executionId\":\"0123456789abcdef0123456789abcdef\",\"missionControl\":{\"rootPin\":{\"dev\":\"1\",\"ino\":\"102\",\"mode\":493,\"path\":\"/fixture/mc\",\"uid\":501},\"source\":{\"buildHash\":\"7777777777777777777777777777777777777777777777777777777777777777\",\"buildIdentityHash\":\"6666666666666666666666666666666666666666666666666666666666666666\",\"harness\":{\"ownedFixtureHash\":\"9999999999999999999999999999999999999999999999999999999999999999\",\"productAuthorityFixtureHash\":\"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\",\"renderSmokeHash\":\"8888888888888888888888888888888888888888888888888888888888888888\"},\"root\":\"/fixture/mc\",\"sourceSha\":\"4444444444444444444444444444444444444444\",\"treeHash\":\"5555555555555555555555555555555555555555\"}},\"owner\":{\"commandHash\":\"cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc\",\"executable\":\"/fixture/node\",\"executableHash\":\"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb\",\"pgid\":41001,\"pid\":41001,\"ppid\":41000,\"startedAt\":\"2026-10-19T09:00:00.000Z\",\"uid\":501},\"postgres\":{\"adminUrlHash\":\"1111111111111111111111111111111111111111111111111111111111111111\",\"data\":{\"dev\":\"1\",\"ino\":\"103\",\"mode\":448,\"path\":\"/fixture/task4-0123456789abcdef0123456789abcdef/postgres-data\",\"uid\":501},\"host\":\"127.0.0.1\",\"major\":17,\"port\":15432,\"process\":{\"commandHash\":\"dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd\",\"executable\":\"/Users/setrox/ai/setrox/.task4-toolchain-v1/Cellar/postgresql@17/17.10/bin/postgres\",\"executableHash\":\"38c50336c63ae8b73b799a8c0ebc4f948e311eee882a633c8286d1ca4110b502\",\"pgid\":41002,\"pid\":41002,\"ppid\":41001,\"startedAt\":\"2026-10-19T09:00:00.000Z\",\"uid\":501},\"serverStartedAt\":\"2026-10-19T09:00:01.000000Z\",\"socket\":{\"dev\":\"1\",\"ino\":\"104\",\"mode\":448,\"path\":\"/fixture/task4-0123456789abcdef0123456789abcdef/postgres-socket\",\"uid\":501},\"versionNum\":170010},\"resourceRoot\":{\"dev\":\"1\",\"ino\":\"100\",\"mode\":448,\"path\":\"/fixture/task4-0123456789abcdef0123456789abcdef\",\"uid\":501},\"schema\":\"setfarm.mc-render-smoke-setup.v1\",\"setfarm\":{\"fixtureHash\":\"ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff\",\"migrationHash\":\"0000000000000000000000000000000000000000000000000000000000000000\",\"rootPin\":{\"dev\":\"1\",\"ino\":\"101\",\"mode\":493,\"path\":\"/fixture/sf\",\"uid\":501},\"runnerHash\":\"eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee\",\"source\":{\"inputManifestHash\":\"3333333333333333333333333333333333333333333333333333333333333333\",\"root\":\"/fixture/sf\",\"sourceSha\":\"1111111111111111111111111111111111111111\",\"treeHash\":\"2222222222222222222222222222222222222222\"}}},\"setupDescriptorHash\":\"0514fad6df757332d6e7ef2e14cd3a428a01af15a8f804203f8306b27d612fcd\"}";
const GOLDEN_SEED_V1 = "{\"emptyRelations\":[{\"name\":\"accepted_candidates\",\"rows\":[],\"schema\":\"public\"},{\"name\":\"agent_feed\",\"rows\":[],\"schema\":\"public\"},{\"name\":\"claim_log\",\"rows\":[],\"schema\":\"public\"},{\"name\":\"execution_attempts\",\"rows\":[],\"schema\":\"public\"},{\"name\":\"live_events\",\"rows\":[],\"schema\":\"public\"},{\"name\":\"operational_event_deliveries\",\"rows\":[],\"schema\":\"public\"},{\"name\":\"operational_events\",\"rows\":[],\"schema\":\"public\"},{\"name\":\"operational_outbox\",\"rows\":[],\"schema\":\"public\"},{\"name\":\"prds\",\"rows\":[],\"schema\":\"public\"},{\"name\":\"product_packets\",\"rows\":[],\"schema\":\"public\"},{\"name\":\"run_observations\",\"rows\":[],\"schema\":\"public\"},{\"name\":\"runtime_sessions\",\"rows\":[],\"schema\":\"public\"},{\"name\":\"steps\",\"rows\":[],\"schema\":\"public\"},{\"name\":\"stories\",\"rows\":[],\"schema\":\"public\"},{\"name\":\"tasks\",\"rows\":[],\"schema\":\"public\"},{\"name\":\"v3_canary_admission_claims\",\"rows\":[],\"schema\":\"public\"},{\"name\":\"v3_deploy_receipts\",\"rows\":[],\"schema\":\"public\"},{\"name\":\"v3_project_transfer_acks\",\"rows\":[],\"schema\":\"public\"}],\"productResponse\":{\"authorityHash\":\"3d2c672d27bf99e31965342861be16e1f753a76295c97cd5b12ebc192ea16307\",\"disposition\":\"sealed_packet\",\"packetAuthority\":{\"authorityHash\":\"bb8f13479bfe66e147f4a61d38f0001031e728c932be039c28739d04417890df\",\"buildTopology\":{\"schema\":\"setfarm.build-topology.v1\"},\"compilationReport\":{\"artifactHashes\":{\"buildTopology\":\"ecea5f9291d61028208e5e43e1ae345fce8ab97485ce4203da4cc0b1224fabbe\",\"designGraph\":\"55506752be34099840567d0d00188621adbf7ff9bdfa1f8170fe66cfbe4f6f15\",\"productSpec\":\"01351d873c4cf75cdc148d9454db372c8b877ae9932918097f8083e70d8a6325\",\"storyPlan\":\"fafc4c6e6a46b3a10370fa50e54624f46989974fedb446e6ab13017bff7ccfc1\"},\"compiler\":{\"codeSha\":\"1111111111111111111111111111111111111111\",\"version\":\"3.5.0\"},\"diagnostics\":[],\"inputHashes\":[\"0000000000000000000000000000000000000000000000000000000000000008\"],\"packetHash\":\"9530fba29e2f1aba456ba213e0a856e030465956cb430f2245c63f7fdc03def2\",\"schema\":\"setfarm.product-compilation-report.v1\",\"status\":\"sealed\",\"validationIds\":[\"VALIDATE_PACKET\"]},\"designGraph\":{\"bindings\":[],\"controls\":[],\"schema\":\"setfarm.design-interaction-graph.v1\",\"surfaces\":[]},\"packet\":{\"buildTopologyHash\":\"ecea5f9291d61028208e5e43e1ae345fce8ab97485ce4203da4cc0b1224fabbe\",\"compiler\":{\"codeSha\":\"1111111111111111111111111111111111111111\",\"version\":\"3.5.0\"},\"designGraphHash\":\"55506752be34099840567d0d00188621adbf7ff9bdfa1f8170fe66cfbe4f6f15\",\"packetVersion\":1,\"parentPacketHashes\":[],\"productSpecHash\":\"01351d873c4cf75cdc148d9454db372c8b877ae9932918097f8083e70d8a6325\",\"schema\":\"setfarm.product-build-packet.v1\",\"storyPlanHash\":\"fafc4c6e6a46b3a10370fa50e54624f46989974fedb446e6ab13017bff7ccfc1\",\"validationIds\":[\"VALIDATE_PACKET\"]},\"packetHash\":\"9530fba29e2f1aba456ba213e0a856e030465956cb430f2245c63f7fdc03def2\",\"producer\":{\"codeSha\":\"1111111111111111111111111111111111111111\",\"pass\":\"setup-build\",\"toolVersions\":{\"node\":\"22.13.0\"}},\"productSpec\":{\"actions\":[],\"routes\":[],\"schema\":\"setfarm.product-spec.v1\",\"surfaces\":[]},\"refs\":{\"buildTopology\":\"ecea5f9291d61028208e5e43e1ae345fce8ab97485ce4203da4cc0b1224fabbe\",\"compilationReport\":\"8f0e8b708c8d94f0e13b9f5a2486c4f2711edead8d9661f5765f75b771e166bc\",\"designGraph\":\"55506752be34099840567d0d00188621adbf7ff9bdfa1f8170fe66cfbe4f6f15\",\"packet\":\"9530fba29e2f1aba456ba213e0a856e030465956cb430f2245c63f7fdc03def2\",\"productSpec\":\"01351d873c4cf75cdc148d9454db372c8b877ae9932918097f8083e70d8a6325\",\"storyPlan\":\"fafc4c6e6a46b3a10370fa50e54624f46989974fedb446e6ab13017bff7ccfc1\"},\"runId\":\"ad47fe65-4ec4-4fb5-89da-fff71eb4e79a\",\"schema\":\"setfarm.product-build-authority.v1\",\"storyPlan\":{\"schema\":\"setfarm.story-plan.v1\",\"stories\":[]}},\"refusal\":null,\"runId\":\"ad47fe65-4ec4-4fb5-89da-fff71eb4e79a\",\"schema\":\"setfarm.product-build-authority.v2\"},\"releaseAdmissions\":[{\"admission_hash\":\"00cc494ab034ad23e93995bb0058ed9f7925c0b4522bfb1bb5e57e7cd4a6d385\",\"created_at\":\"2026-07-13T00:00:00.000Z\",\"expires_at\":null,\"gate_hash\":\"241cc90624864a2571197184cc615508fd3e3f9c40439ff67526905aaa26ee7e\",\"gate_ref\":\"sha256/24/241cc90624864a2571197184cc615508fd3e3f9c40439ff67526905aaa26ee7e.json\",\"kind\":\"release_go\",\"payload\":{\"admissionHash\":\"00cc494ab034ad23e93995bb0058ed9f7925c0b4522bfb1bb5e57e7cd4a6d385\",\"expiresAt\":null,\"gate\":{\"hash\":\"241cc90624864a2571197184cc615508fd3e3f9c40439ff67526905aaa26ee7e\",\"ref\":\"sha256/24/241cc90624864a2571197184cc615508fd3e3f9c40439ff67526905aaa26ee7e.json\"},\"issuedAt\":\"2026-07-13T00:00:00.000Z\",\"kind\":\"release_go\",\"preflightHash\":\"57fc751e81715104b94b09692ed5c3c5ae897c6c40feeac6225147c1484728d0\",\"releaseSha\":\"1111111111111111111111111111111111111111\",\"result\":{\"hash\":\"93ce3d7fb77f828943cc8ae7f84e3bdbefc92bcdbad5a49792ccc01d3234aba7\",\"ref\":\"sha256/93/93ce3d7fb77f828943cc8ae7f84e3bdbefc92bcdbad5a49792ccc01d3234aba7.json\"},\"schema\":\"setfarm.v3-release-admission.v1\",\"slots\":[],\"suiteHash\":\"25f108e57ff5a978c88ea7ea84c22cb157daef02332d53b39e3967ab0db8229c\"},\"release_sha\":\"1111111111111111111111111111111111111111\",\"result_hash\":\"93ce3d7fb77f828943cc8ae7f84e3bdbefc92bcdbad5a49792ccc01d3234aba7\",\"result_ref\":\"sha256/93/93ce3d7fb77f828943cc8ae7f84e3bdbefc92bcdbad5a49792ccc01d3234aba7.json\",\"suite_hash\":\"25f108e57ff5a978c88ea7ea84c22cb157daef02332d53b39e3967ab0db8229c\"}],\"runs\":[{\"accepted_candidate_hash\":null,\"activation_preflight_hash\":null,\"assigned_developer\":null,\"compiler_release_sha\":null,\"context\":\"{}\",\"created_at\":\"2026-10-19T00:00:00.000Z\",\"deploy_receipt_hash\":null,\"id\":\"ac8cea43-7686-4d27-8092-1e3dd9207ca4\",\"meta\":null,\"notify_url\":null,\"packet_hash\":null,\"project_transfer_ack_hash\":null,\"protocol\":\"legacy\",\"protocol_version\":1,\"release_admission_hash\":null,\"run_number\":1,\"status\":\"running\",\"task\":\"Task4 render smoke legacy fixture\",\"updated_at\":\"2026-10-19T00:00:00.000Z\",\"workflow_id\":\"feature-dev\"},{\"accepted_candidate_hash\":null,\"activation_preflight_hash\":\"57fc751e81715104b94b09692ed5c3c5ae897c6c40feeac6225147c1484728d0\",\"assigned_developer\":null,\"compiler_release_sha\":\"1111111111111111111111111111111111111111\",\"context\":\"{}\",\"created_at\":\"2026-10-19T00:00:00.000Z\",\"deploy_receipt_hash\":null,\"id\":\"ad47fe65-4ec4-4fb5-89da-fff71eb4e79a\",\"meta\":null,\"notify_url\":null,\"packet_hash\":\"9530fba29e2f1aba456ba213e0a856e030465956cb430f2245c63f7fdc03def2\",\"project_transfer_ack_hash\":null,\"protocol\":\"v3\",\"protocol_version\":1,\"release_admission_hash\":\"00cc494ab034ad23e93995bb0058ed9f7925c0b4522bfb1bb5e57e7cd4a6d385\",\"run_number\":2,\"status\":\"running\",\"task\":\"Task4 render smoke V3 fixture\",\"updated_at\":\"2026-10-19T00:00:00.000Z\",\"workflow_id\":\"feature-dev\"}],\"schema\":\"mission-control.task4-seed-observation.v1\",\"sourceSha\":\"1111111111111111111111111111111111111111\",\"templateRows\":[{\"category\":\"admin\",\"created_at\":\"2026-10-19T00:00:00.000Z\",\"description\":\"CRUD admin panel with users, content management, and settings\",\"id\":\"tpl-admin\",\"name\":\"Admin Panel\",\"platform\":\"web\",\"prd_content\":\"# PRD - Admin Panel\\n\\n## 1. Project Overview\\nBuild a full CRUD admin system with authentication, user management, content management, categories, settings, and audit-friendly tables.\\n\\n**Tech Stack:** React + TypeScript + Tailwind CSS + shadcn/ui + TanStack Table\\n\\n## 2. Design System\\n- Background: #FFFFFF, Sidebar: #F8FAFC, Card: #FFFFFF\\n- Primary: #0F172A, Accent: #2563EB, Border: #E2E8F0\\n- Font: Inter, 14px base\\n- Spacing: 4px grid\\n- Dark mode via CSS custom properties\\n\\n## 3. Pages\\n1. **Login** (/login) - Auth form and password recovery\\n2. **Dashboard** (/) - Metrics, recent activity, quick actions\\n3. **Users** (/users) - User data table and create/edit dialog\\n4. **Content** (/content) - Content data table and editor form\\n5. **Categories** (/categories) - Category table and sorting\\n6. **Settings** (/settings) - General, email, security, backup settings\\n\\n## 4. Page Requirements\\n- Login: centered form, logo, email, password, login button, forgot-password link, error alert.\\n- Dashboard: four metric cards, recent activity list, quick action buttons.\\n- Users: selectable rows, avatar/name, email, role badge, status switch, actions menu, filters.\\n- Content: title, category, author, date, status, create/edit full-page form.\\n- Categories: table with order controls, create/edit dialog, parent category select.\\n- Settings: grouped forms with tabs.\\n\\n## 5. Data Model\\n- User: id, name, email, role, status, avatar, createdAt\\n- Content: id, title, slug, body, categoryId, authorId, status, coverImage, seoTitle, seoDescription, createdAt, updatedAt\\n- Category: id, name, slug, parentId, sortOrder\\n- Setting: key, value, group\\n\"},{\"category\":\"blog\",\"created_at\":\"2026-10-19T00:00:00.000Z\",\"description\":\"Blog site with article list, article details, categories, and search\",\"id\":\"tpl-blog\",\"name\":\"Blog\",\"platform\":\"web\",\"prd_content\":\"# PRD - Blog Platform\\n\\n## 1. Project Overview\\nBuild a modern publishing platform with article discovery, categories, search, article detail pages, author pages, and newsletter capture.\\n\\n**Tech Stack:** React + TypeScript + Tailwind CSS\\n\\n## 2. Design System\\n- Background: #FFFFFF, Card: #F9FAFB\\n- Text: #111827 heading, #4B5563 body, #9CA3AF muted\\n- Primary: #3B82F6, Accent: #8B5CF6, Border: #E5E7EB, Code background: #1F2937\\n- Fonts: Merriweather for editorial headings, Source Sans 3 for body, Fira Code for code\\n- Motion: 300ms page fade, 200ms card hover, 500ms lazy-image blur\\n\\n## 3. Pages\\n1. **Home** (/) - Featured article, latest posts, categories, newsletter\\n2. **Blog** (/blog) - Search, filters, post grid, pagination\\n3. **Category** (/category/:slug) - Category feed and sidebar\\n4. **Article** (/blog/:slug) - Cover, content, table of contents, author box, related posts\\n5. **About** (/about) - Author profile and site mission\\n6. **Contact** (/contact) - Contact form\\n\\n## 4. Page Requirements\\n- Home: featured post card with cover image, category badge, author/date, latest post grid.\\n- Blog: category buttons, search input, post cards, pagination, popular posts sidebar.\\n- Article: large title, author metadata, cover image, markdown rendering, code blocks, blockquotes, TOC, comments.\\n- About: author bio, social links, metrics.\\n- Contact: name, email, subject, message, submit state.\\n\\n## 5. Data Model\\n- Post: id, title, slug, content, excerpt, coverImage, category, tags, author, publishedAt, readingTime\\n- Category: id, name, slug, postCount\\n- Author: id, name, bio, avatar, socialLinks\\n- Comment: id, postId, name, email, content, createdAt\\n\"},{\"category\":\"dashboard\",\"created_at\":\"2026-10-19T00:00:00.000Z\",\"description\":\"Analytics dashboard with charts, tables, metrics, filters, and reports\",\"id\":\"tpl-dashboard\",\"name\":\"Dashboard\",\"platform\":\"web\",\"prd_content\":\"# PRD - Analytics Dashboard\\n\\n## 1. Project Overview\\nBuild a data dashboard with metric cards, charts, tables, filters, reports, and real-time activity visibility.\\n\\n**Tech Stack:** React + TypeScript + Tailwind CSS + Recharts\\n**Default Theme:** Dark\\n\\n## 2. Design System\\n- Background: #09090B, Card: #18181B, Elevated: #27272A\\n- Text: #FAFAFA primary, #A1A1AA secondary, #71717A muted\\n- Primary: #3B82F6, Success: #22C55E, Warning: #EAB308, Error: #EF4444\\n- Chart palette: #3B82F6, #22C55E, #EAB308, #A855F7, #EC4899, #06B6D4\\n- Fonts: Inter for UI, JetBrains Mono for dense tables\\n- Motion: 800ms chart draw, 1.5s counter animation, 200ms card hover\\n\\n## 3. Pages\\n1. **Dashboard** (/) - Date controls, metric cards, charts, latest activity\\n2. **Analytics** (/analytics) - Detailed charts and comparisons\\n3. **Users** (/users) - User table, filters, detail sheet\\n4. **Reports** (/reports) - Report list and report builder\\n5. **Settings** (/settings) - Profile, notifications, integrations, theme\\n\\n## 4. Page Requirements\\n- Dashboard: date range picker, refresh button, four KPI cards, area chart, bar chart, pie chart, transactions table, live activity.\\n- Analytics: multi-series line chart, stacked bar chart, category/country/date filters, comparison overlay.\\n- Users: searchable table with avatar, email, status, last activity, detail sheet.\\n- Reports: report card grid, create-report form with type/date/format fields.\\n- Settings: tabbed forms and switches.\\n\\n## 5. Data Model\\n- Metric: key, value, change, changePercent, period\\n- ChartData: timestamp, values\\n- User: id, name, email, avatar, status, createdAt, lastActive\\n- Transaction: id, userId, type, amount, status, createdAt\\n- Report: id, title, type, dateRange, format, url, createdAt\\n\"},{\"category\":\"docs\",\"created_at\":\"2026-10-19T00:00:00.000Z\",\"description\":\"Documentation site with sidebar navigation, Markdown rendering, and search\",\"id\":\"tpl-docs\",\"name\":\"Documentation\",\"platform\":\"web\",\"prd_content\":\"# PRD - Documentation Site\\n\\n## 1. Project Overview\\nBuild a technical documentation site with sidebar navigation, Markdown rendering, search, code blocks, callouts, and table of contents.\\n\\n**Tech Stack:** React + TypeScript + Tailwind CSS\\n\\n## 2. Design System\\n- Background: #FFFFFF light, #0F1117 dark\\n- Sidebar: #F6F6F7 light, #1A1A24 dark\\n- Code background: #F6F8FA light, #161B22 dark\\n- Primary: #2563EB, Border: #E5E7EB light, #30363D dark\\n- Text: #1F2328 light, #E6EDF3 dark\\n- Fonts: Inter for UI, Fira Code or JetBrains Mono for code\\n- Motion: 200ms sidebar expand, 200ms command dialog scale + opacity\\n\\n## 3. Pages\\n1. **Docs Home** (/) - Intro, quick starts, popular docs\\n2. **Guide** (/docs/:slug) - Markdown content with TOC\\n3. **Search** (/search) - Command palette results\\n4. **Changelog** (/changelog) - Release notes\\n\\n## 4. Page Requirements\\n- Sidebar: logo, search trigger, nav groups, active state, collapsible groups, theme toggle, version badge.\\n- Content: breadcrumb, title, markdown body, headings, lists, tables, images, code blocks with copy button.\\n- Callouts: note, warning, tip, danger with colored left border and icon.\\n- Right TOC: sticky heading list with active scroll-spy.\\n- Search: keyboard shortcut, input, result list, highlighted matches, arrow-key navigation.\\n- Footer nav: previous/next links, edit-on-GitHub link, last updated date.\\n\\n## 5. Data Model\\n- Page: id, slug, title, content, section, order, updatedAt\\n- NavSection: id, title, pages\\n- SearchResult: pageId, title, excerpt, url\\n\"},{\"category\":\"ecommerce\",\"created_at\":\"2026-10-19T00:00:00.000Z\",\"description\":\"Full e-commerce site with product discovery, cart, checkout, and account flows\",\"id\":\"tpl-ecommerce\",\"name\":\"E-Commerce\",\"platform\":\"web\",\"prd_content\":\"# PRD - E-Commerce Platform\\n\\n## 1. Project Overview\\nBuild a modern responsive commerce experience with product discovery, filtering, cart management, checkout, account history, and order tracking.\\n\\n**Tech Stack:** React + TypeScript + Tailwind CSS + shadcn/ui\\n**Goal:** Fast, accessible, SEO-friendly, mobile-first shopping flow.\\n\\n## 2. Design System\\n- Primary: #2563EB, Secondary: #7C3AED, Accent: #F59E0B\\n- Background: #FFFFFF light, #0F172A dark\\n- Text: #1E293B light, #F8FAFC dark\\n- Destructive: #EF4444, Border: #E2E8F0, Muted: #F1F5F9\\n- Fonts: Inter for UI, JetBrains Mono for code/order identifiers\\n- Spacing: 4px base grid, 16px mobile page padding, 32px desktop page padding\\n- Motion: 200ms hover feedback, 300ms page fade, 200ms modal opacity + translateY\\n\\n## 3. Pages\\n1. **Home** (/) - Hero, category grid, featured products, campaign banner, footer\\n2. **Products** (/products) - Filters, sorting, product grid, pagination\\n3. **Product Detail** (/products/:id) - Gallery, variant selection, stock, tabs, related products\\n4. **Cart** (/cart) - Item list, quantity controls, order summary, empty state\\n5. **Checkout** (/checkout) - Address, payment, review, submit order\\n6. **Account** (/account) - Orders, addresses, favorites, settings\\n\\n## 4. Page Requirements\\n- Home: full-width product hero with primary CTA, 4-column desktop category grid, horizontal featured carousel, campaign banner, footer link groups.\\n- Products: sidebar filters for price, category, brand, color, and size; responsive grid; favorite and add-to-cart controls.\\n- Product Detail: image gallery with thumbnails, zoom interaction, price display, variant controls, quantity stepper, add-to-cart animation.\\n- Cart: editable quantities, remove actions, subtotal, shipping, total, checkout CTA, empty-state recovery CTA.\\n- Checkout: 3-step progress indicator, validated form fields, masked card input, sticky desktop summary, mobile accordion summary.\\n- Account: tabbed order/address/favorites/settings sections with order detail dialog.\\n\\n## 5. Data Model\\n- Product: id, title, slug, description, price, salePrice, images, category, brand, variants, stock, rating\\n- Cart: items, total, itemCount\\n- Order: id, items, address, payment, status, total, createdAt\\n- User: id, name, email, phone, addresses, orders\\n\\n## 6. API\\n- GET /api/products\\n- GET /api/products/:id\\n- GET /api/categories\\n- POST /api/cart/add\\n- PATCH /api/cart/update\\n- DELETE /api/cart/remove/:itemId\\n- POST /api/orders\\n- GET /api/orders/:id\\n\"},{\"category\":\"game\",\"created_at\":\"2026-10-19T00:00:00.000Z\",\"description\":\"Canvas/WebGL game with menu, gameplay screen, settings, and score state\",\"id\":\"tpl-game\",\"name\":\"Game\",\"platform\":\"web\",\"prd_content\":\"# PRD - Web Game\\n\\n## 1. Project Overview\\nBuild a browser-based 2D arcade/casual game with menu, gameplay, pause, game over, leaderboard, settings, and persistent high scores.\\n\\n**Tech Stack:** React + TypeScript + HTML5 Canvas\\n**Genre:** 2D arcade/casual\\n\\n## 2. Design System\\n- Background: #0A0A0A, Game area: #1A1A2E\\n- Primary: #E94560, Secondary: #0F3460, Accent: #16C79A\\n- Text: #EAEAEA, Score: #FFD700\\n- Fonts: Press Start 2P for arcade UI or Rajdhani for readable HUD\\n- Motion: 3s menu title float, 200ms button glow, 500ms game-over shake, particle effects\\n\\n## 3. Screens\\n1. **Main Menu** (/) - Logo, play, leaderboard, settings\\n2. **Game** (/play) - Canvas, HUD, controls, pause\\n3. **Pause** (/pause) - Overlay with resume, restart, main menu\\n4. **Game Over** (/game-over) - Final score, high score, replay, main menu\\n5. **Leaderboard** (/leaderboard) - Stored scores\\n6. **Settings** (/settings) - Audio, difficulty, controls\\n\\n## 4. Gameplay Requirements\\n- Canvas target: 60fps requestAnimationFrame loop.\\n- Controls: keyboard arrows/WASD plus mobile touch controls.\\n- State: menu, playing, paused, gameover.\\n- Entities: player, enemies, projectiles, particles, pickups.\\n- Collision: AABB or circle-circle with deterministic rules.\\n- Score: points, combo multiplier, bonus pickups.\\n- Persistence: localStorage high scores and settings.\\n\\n## 5. Data Model\\n- GameState: score, lives, level, entities, timestamp\\n- HighScore: name, score, date\\n- Settings: volume, musicOn, difficulty\\n\"},{\"category\":\"mobile\",\"created_at\":\"2026-10-19T00:00:00.000Z\",\"description\":\"React Native mobile app with tab navigation, lists, details, and profile\",\"id\":\"tpl-mobile\",\"name\":\"Mobile App\",\"platform\":\"mobile\",\"prd_content\":\"# PRD - Mobile Application\\n\\n## 1. Project Overview\\nBuild a React Native + Expo mobile app with tab navigation, searchable lists, detail screens, notifications, profile, and settings.\\n\\n**Tech Stack:** React Native + Expo + TypeScript + NativeWind\\n**Platform:** iOS + Android\\n\\n## 2. Design System\\n- Background: #FFFFFF light, #000000 dark\\n- Card: #F2F2F7 light, #1C1C1E dark\\n- Primary: #007AFF, Destructive: #FF3B30, Success: #34C759\\n- Text: #000000 light, #FFFFFF dark, Secondary text: #8E8E93\\n- Fonts: SF Pro on iOS, Roboto on Android\\n- Motion: 350ms slide transitions, 200ms tab cross-fade, 100ms press feedback\\n\\n## 3. Screens\\n1. **Home** (/) - Header, carousel, feed list, pull-to-refresh\\n2. **Explore** (/explore) - Search, category chips, result list\\n3. **Detail** (/detail/:id) - Image, content, fixed CTA\\n4. **Notifications** (/notifications) - Grouped notification list\\n5. **Profile** (/profile) - Avatar, bio, stats, menu\\n6. **Settings** (/settings) - Switches, selects, destructive account action\\n\\n## 4. Screen Requirements\\n- Bottom tabs: Home, Explore, Notifications, Profile with active/inactive colors.\\n- Home: title, notification icon, horizontal carousel, vertical item cards.\\n- Explore: sticky search bar, horizontal category filter chips, FlatList results.\\n- Detail: top image, back overlay, title, metadata, body, safe-area CTA bar.\\n- Notifications: sectioned groups, unread state, time labels.\\n- Profile: avatar, name, bio, stats row, grouped menu list.\\n- Settings: grouped list with switch/select/button items.\\n\\n## 5. Data Model\\n- Item: id, title, subtitle, image, category, content, createdAt\\n- Notification: id, type, title, message, read, createdAt\\n- User: id, name, avatar, bio, stats\\n\"},{\"category\":\"portfolio\",\"created_at\":\"2026-10-19T00:00:00.000Z\",\"description\":\"Personal portfolio with projects, about, experience, and contact sections\",\"id\":\"tpl-portfolio\",\"name\":\"Portfolio\",\"platform\":\"web\",\"prd_content\":\"# PRD - Portfolio Site\\n\\n## 1. Project Overview\\nBuild a polished personal portfolio that presents identity, work, skills, experience, and contact paths in a single-page or light multi-page experience.\\n\\n**Tech Stack:** React + TypeScript + Tailwind CSS\\n**Goal:** Minimal, memorable, fast, accessible, and responsive.\\n\\n## 2. Design System\\n- Background: #FAFAFA light, #09090B dark\\n- Foreground: #09090B light, #FAFAFA dark\\n- Accent: #6366F1, Muted: #F4F4F5 light, #27272A dark\\n- Fonts: Space Grotesk for headings, Inter for body\\n- Motion: 600ms scroll reveal, 200ms card hover, staggered page load\\n\\n## 3. Pages\\n1. **Home** (/) - Hero, about, projects, experience, contact, footer\\n2. **Projects** (/projects) - Filterable project gallery and project details\\n3. **About** (/about) - Profile, skills, experience, values\\n4. **Contact** (/contact) - Contact form and social links\\n\\n## 4. Page Requirements\\n- Hero: first viewport identity statement, role, short positioning copy, project/contact CTAs, subtle interactive background.\\n- About: profile image, bio, skills grouped by category, progress or proficiency indicators.\\n- Projects: responsive cards with screenshot, title, description, tags, GitHub and live demo links; detail modal with gallery.\\n- Experience: vertical timeline with date, company, role, and impact bullets.\\n- Contact: name, email, subject, message, submit state, GitHub/LinkedIn/email links.\\n\\n## 5. Data Model\\n- Project: id, title, description, image, tags, githubUrl, liveUrl, category\\n- Skill: name, level, category\\n- Experience: company, role, startDate, endDate, description\\n- ContactForm: name, email, subject, message\\n\"},{\"category\":\"saas\",\"created_at\":\"2026-10-19T00:00:00.000Z\",\"description\":\"SaaS landing page with hero, features, pricing, testimonials, and CTA\",\"id\":\"tpl-saas\",\"name\":\"SaaS Landing\",\"platform\":\"web\",\"prd_content\":\"# PRD - SaaS Landing Page\\n\\n## 1. Project Overview\\nBuild a conversion-focused SaaS landing page with product positioning, feature proof, pricing, testimonials, FAQ, and a clear acquisition funnel.\\n\\n**Tech Stack:** React + TypeScript + Tailwind CSS\\n**Goal:** High-conversion, fast, accessible, analytics-ready marketing site.\\n\\n## 2. Design System\\n- Primary: #6366F1, Primary hover: #4F46E5\\n- Background: #FFFFFF, Alternate section: #F8FAFC, Dark section: #0F172A\\n- Text: #0F172A heading, #475569 body, #94A3B8 muted\\n- Success: #10B981, Warning: #F59E0B, Error: #EF4444\\n- Fonts: Cal Sans or Inter for headings, Inter for body\\n- Motion: 500ms scroll reveal, button glow, 2s counter animation\\n\\n## 3. Pages\\n1. **Home** (/) - Sticky nav, hero, logos, features, pricing, testimonials, FAQ, CTA, footer\\n2. **Pricing** (/pricing) - Plan comparison and billing toggle\\n3. **Docs Preview** (/docs) - Product education preview and onboarding CTA\\n4. **Contact Sales** (/contact) - Lead form and qualification fields\\n\\n## 4. Page Requirements\\n- Navbar: logo, nav links, login, primary CTA, mobile sheet.\\n- Hero: clear headline, benefit copy, primary CTA, secondary demo CTA, product screenshot.\\n- Features: 3-column card grid and alternating detailed feature sections.\\n- Pricing: monthly/yearly toggle, three plan cards, popular plan highlight, feature comparison.\\n- Testimonials: carousel cards with quote, name, role, company, avatar.\\n- FAQ: accordion with 6-8 objections handled.\\n- CTA Banner: full-width conversion section with strong copy and CTA.\\n\\n## 5. Data Model\\n- Plan: id, name, price, yearlyPrice, features, cta, popular\\n- Feature: id, title, description, icon\\n- Testimonial: id, text, author, role, company, avatar\\n- FAQ: id, question, answer\\n\"}]}";
const GOLDEN_GRANTS_V1 = "{\"additionalColumnGrants\":[],\"applicationRoutineGrants\":[],\"database\":\"setfarm_p3_222222222222222222222222_clone_333333333333\",\"databaseGrants\":[{\"name\":\"setfarm_p3_222222222222222222222222_clone_333333333333\",\"privilege\":\"CONNECT\"}],\"memberships\":[],\"ownedDataObjects\":[],\"relationGrants\":[{\"kind\":\"r\",\"name\":\"accepted_candidates\",\"privilege\":\"SELECT\",\"schema\":\"public\"},{\"kind\":\"r\",\"name\":\"agent_feed\",\"privilege\":\"SELECT\",\"schema\":\"public\"},{\"kind\":\"r\",\"name\":\"claim_log\",\"privilege\":\"SELECT\",\"schema\":\"public\"},{\"kind\":\"r\",\"name\":\"execution_attempts\",\"privilege\":\"SELECT\",\"schema\":\"public\"},{\"kind\":\"r\",\"name\":\"internal_production_owner_producer_manifest_activation_heads_v1\",\"privilege\":\"SELECT\",\"schema\":\"public\"},{\"kind\":\"r\",\"name\":\"internal_production_owner_producer_manifest_set_activations_v1\",\"privilege\":\"SELECT\",\"schema\":\"public\"},{\"kind\":\"r\",\"name\":\"internal_production_owner_producer_manifest_set_current_v1\",\"privilege\":\"SELECT\",\"schema\":\"public\"},{\"kind\":\"r\",\"name\":\"live_events\",\"privilege\":\"SELECT\",\"schema\":\"public\"},{\"kind\":\"r\",\"name\":\"operational_event_deliveries\",\"privilege\":\"SELECT\",\"schema\":\"public\"},{\"kind\":\"r\",\"name\":\"operational_events\",\"privilege\":\"SELECT\",\"schema\":\"public\"},{\"kind\":\"r\",\"name\":\"operational_outbox\",\"privilege\":\"SELECT\",\"schema\":\"public\"},{\"kind\":\"r\",\"name\":\"prd_templates\",\"privilege\":\"SELECT\",\"schema\":\"public\"},{\"kind\":\"r\",\"name\":\"prds\",\"privilege\":\"SELECT\",\"schema\":\"public\"},{\"kind\":\"r\",\"name\":\"product_packets\",\"privilege\":\"SELECT\",\"schema\":\"public\"},{\"kind\":\"r\",\"name\":\"run_observations\",\"privilege\":\"SELECT\",\"schema\":\"public\"},{\"kind\":\"r\",\"name\":\"runs\",\"privilege\":\"SELECT\",\"schema\":\"public\"},{\"kind\":\"r\",\"name\":\"runtime_sessions\",\"privilege\":\"SELECT\",\"schema\":\"public\"},{\"kind\":\"r\",\"name\":\"steps\",\"privilege\":\"SELECT\",\"schema\":\"public\"},{\"kind\":\"r\",\"name\":\"stories\",\"privilege\":\"SELECT\",\"schema\":\"public\"},{\"kind\":\"r\",\"name\":\"tasks\",\"privilege\":\"SELECT\",\"schema\":\"public\"},{\"kind\":\"r\",\"name\":\"v3_canary_admission_claims\",\"privilege\":\"SELECT\",\"schema\":\"public\"},{\"kind\":\"r\",\"name\":\"v3_deploy_receipts\",\"privilege\":\"SELECT\",\"schema\":\"public\"},{\"kind\":\"r\",\"name\":\"v3_project_transfer_acks\",\"privilege\":\"SELECT\",\"schema\":\"public\"},{\"kind\":\"r\",\"name\":\"v3_release_admissions\",\"privilege\":\"SELECT\",\"schema\":\"public\"}],\"role\":{\"bypassRls\":false,\"canLogin\":true,\"createDatabase\":false,\"createRole\":false,\"currentUser\":\"mc_task4_0123456789abcdef0123456789abcdef\",\"inherit\":false,\"name\":\"mc_task4_0123456789abcdef0123456789abcdef\",\"replication\":false,\"sessionUser\":\"mc_task4_0123456789abcdef0123456789abcdef\",\"superuser\":false},\"schema\":\"mission-control.task4-effective-data-read-grants.v1\",\"schemaGrants\":[{\"name\":\"public\",\"privilege\":\"USAGE\"}],\"sequenceGrants\":[],\"settings\":{\"defaultTransactionReadOnly\":\"on\",\"loCompatPrivileges\":false,\"recovery\":false}}";

const direct = process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;
if (direct && process.execArgv.some(arg=>arg.startsWith("--test-name-pattern=^descriptor "))) {
  test("descriptor Task4 helper retains acknowledged clone on initialization uncertainty and authenticates before effects",async()=>{
    const ts=await import("typescript"),source=fs.readFileSync(new URL("../execution-attempts/test-database.ts",import.meta.url),"utf8");
    const ast=ts.createSourceFile("test-database.ts",source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);
    const fn=(name:string)=>{const node=ast.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text===name);assert.ok(node&&ts.isFunctionDeclaration(node)&&node.body,name);return node as import("typescript").FunctionDeclaration;};
    const special=fn("createOwnedTask4TestDatabaseV1"),ordinary=fn("createIsolatedTestDatabase"),implementation=fn("createIsolatedTestDatabaseImplementationV1");
    const evaluate=(node:import("typescript").FunctionDeclaration,bindings:RecordV1)=>{
      const js=ts.transpileModule(node.getText(ast).replace(/^export /,""),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
      return new Function(...Object.keys(bindings),js+";return "+node.name!.text)(...Object.values(bindings));};
    const calls:string[]=[],sentinel=new Error("owned original initialization failure");
    const implementationSpy=async(_options:unknown,retain:boolean)=>{calls.push(retain?"retain":"ordinary");return retain;};
    const authenticated=evaluate(special,{authenticateP3ProjectedReadinessTestCapabilityV1:()=>calls.push("authenticate"),readP3MarkerV1:()=>{calls.push("marker");return {};},createIsolatedTestDatabaseImplementationV1:implementationSpy});
    assert.equal(await authenticated(),true);assert.deepEqual(calls,["authenticate","marker","retain"]);calls.length=0;
    const denied=evaluate(special,{authenticateP3ProjectedReadinessTestCapabilityV1:()=>{throw sentinel;},readP3MarkerV1:()=>calls.push("marker"),createIsolatedTestDatabaseImplementationV1:implementationSpy});
    await assert.rejects(denied(),error=>error===sentinel);assert.equal(calls.length,0);await assert.rejects(authenticated({}),{message:"P3_TASK4_FACTORY_INPUT_REFUSED"});
    assert.equal(await evaluate(ordinary,{createIsolatedTestDatabaseImplementationV1:implementationSpy})(),false);assert.deepEqual(calls,["ordinary"]);
    const catches=implementation.body!.statements.filter(ts.isTryStatement).filter(n=>n.catchClause);assert.equal(catches.length,2);
    const body=catches[1]!.catchClause!.block.getText(ast),js=ts.transpileModule("async function originalCatch(error:unknown,retainInitializationFailure:boolean){"+body.slice(1,-1)+"}",{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
    const admin=Object.assign(async()=>{calls.push("terminate");},{unsafe:async()=>{calls.push("drop");},end:async()=>{calls.push("end");}});
    const originalCatch=new Function("admin","database",js+";return originalCatch")(admin,"owned_component_clone");
    calls.length=0;await assert.rejects(originalCatch(sentinel,true),error=>error===sentinel);assert.equal(calls.length,0);
    await assert.rejects(originalCatch(sentinel,false),error=>error===sentinel);assert.deepEqual(calls,["terminate","drop","end"]);
  });
  test("descriptor backend attribution requires exact established original loopback socket and process identity",()=>{
    const ready=JSON.parse(GOLDEN_READY_V1),parent=ready.fixtureOwner,inner={...parent,pid:parent.pid+10,ppid:parent.pid},server={...parent,pid:parent.pid+11,ppid:inner.pid};
    const row={pid:123,startedAt:"2026-10-19T09:00:00.123456Z",role:ready.database.role,database:ready.database.name,applicationName:"task4_mc_"+ready.executionId,host:"127.0.0.1",port:49152};
    const sockets=parseTask4SocketsV1("p"+server.pid+"\nf20u\nn127.0.0.1:49152->127.0.0.1:"+ready.setup.postgres.port+"\nTST=ESTABLISHED\n",ready.setup.postgres.port);
    assert.deepEqual(sockets,[{pid:server.pid,port:49152}]);
    const result=bindTask4BackendV1(row,ready,parent,inner,server,sockets,new Map([[server.pid,server]]));assert.equal(result.clientRole,"mc");assert.deepEqual(result.clientIdentity,server);
    for(const changed of [{...row,host:"::1"},{...row,port:49153},{...row,applicationName:"task4_observer_"+ready.executionId},{...row,database:row.database+"x"}])
      assert.throws(()=>bindTask4BackendV1(changed,ready,parent,inner,server,sockets,new Map([[server.pid,server]])),{message:"TASK4_SQL_ORIGINALS_UNKNOWN"});
    assert.throws(()=>bindTask4BackendV1(row,ready,parent,inner,server,[...sockets,...sockets],new Map([[server.pid,server]])),{message:"TASK4_SQL_ORIGINALS_UNKNOWN"});
    assert.throws(()=>parseTask4SocketsV1("p1\nf2u\nn127.0.0.1:49152->127.0.0.1:"+ready.setup.postgres.port+"\nTST=SYN_SENT\n",ready.setup.postgres.port),{message:"TASK4_SQL_ORIGINALS_UNKNOWN"});
  });
  test("descriptor parent cleanup gate requires complete original closure and independent evidence",()=>{
    const base={outcome:"pass",integrity:"verified",owner:{pid:1},exit:{code:0,signal:null,exitObserved:true,closeObserved:true},auditComplete:true,sqlComplete:true,networkComplete:true,readers:{opened:3,closed:3,pending:0}};
    assert.equal(task4ParentCleanupSafeV1(base),true);
    for(const patch of [{outcome:"unknown"},{integrity:"failed"},{auditComplete:false},{sqlComplete:false},{networkComplete:false},{owner:null},
      {exit:{...base.exit,closeObserved:false}},{exit:{...base.exit,code:1}},{readers:{opened:3,closed:2,pending:1}}])assert.equal(task4ParentCleanupSafeV1({...base,...patch}),false);
    assert.equal(task4ParentCleanupSafeV1({...base,outcome:"cancelled",exit:{...base.exit,code:130}}),true);
    assert.equal(task4ParentCleanupSafeV1({...base,outcome:"fail",exit:{...base.exit,code:1}}),true);
  });
  test("descriptor exact maintained supervisor recipe settles retained frame without widening SQL",()=>{
    // Original pass11 frame152, offset64052 in chunk8e7b5499; backend below is component setup, not historical heap.
    const frame=Buffer.from("2026-10-19 18:13:03.785 UTC|15122|6ad65da7.3b12|mc_task4_214515ea366224237ed657b9ea575f88|setfarm_p3_460b54c5988eca731290c1e4_clone_3a3d21b0ad6e|task4_mc_214515ea366224237ed657b9ea575f88|00000| LOG:  execute r31en3h9rga10: SELECT * FROM runs WHERE id = $1 LIMIT 1\n"),statement="SELECT * FROM runs WHERE id = $1 LIMIT 1";
    assert.equal(frame.length,264);assert.equal(hashV1(frame),"9c83821b0981046745dcd119565640cce1a8602ac1f28d643c1c68854c1b0233");
    assert.equal(Buffer.byteLength(statement),40);assert.equal(hashV1(statement),"0ccb92fceba3d566a30f86f604474baab50c3f713cb93f962f1bda7ec3450b36");
    const header=frame.toString().split("|");const executionId=header[5]!.slice("task4_mc_".length),database=header[4]!,pid=Number(header[1]),session=header[2]!;
    const backend={pid,startedAt:new Date(Number.parseInt(session.split(".")[0]!,16)*1000).toISOString(),applicationName:header[5]!,clientRole:"mc",clientIdentity:JSON.parse(GOLDEN_READY_V1).fixtureOwner};
    const originals=[{seq:1,sha256:hashV1(frame),bytes:frame.length,start:0}];
    const parsed=parseTask4PgLogV1(frame,executionId,database,[],[backend]);
    const events=settleTask4PgEventsV1(parsed,[backend],originals);
    assert.equal(parsed.length,1);assert.equal(parsed[0]!.queryId,"mc_Q34");assert.equal(parsed[0]!.classification,"detail_read");
    assert.equal(events.length,1);assert.equal(events[0]!.queryId,"mc_Q34");assert.equal(events[0]!.statementHash,hashV1(statement));
    assert.equal(events[0]!.backendPid,pid);assert.equal(events[0]!.originalSeq,1);assert.equal(events[0]!.originalOffset,0);assert.equal(events[0]!.originalLength,264);
    for(const changed of [statement.replace("LIMIT 1","LIMIT 2"),statement.replace("$1","$2"),statement.replace("SELECT ","SELECT  ")]){
      const bytes=Buffer.from(frame.toString().replace(statement,changed)),rows=parseTask4PgLogV1(bytes,executionId,database,[],[backend]);
      assert.equal(rows[0]!.queryId,"unknown");assert.throws(()=>settleTask4PgEventsV1(rows,[backend],[{...originals[0],bytes:bytes.length,sha256:hashV1(bytes)}]),{message:"TASK4_SQL_ORIGINALS_UNKNOWN"});}
    const foreign=Buffer.from(frame.toString().replace(header[5]!,"task4_observer_"+executionId)),foreignRows=parseTask4PgLogV1(foreign,executionId,database,[],[backend]);
    assert.equal(foreignRows[0]!.queryId,"unknown");assert.throws(()=>settleTask4PgEventsV1(foreignRows,[backend],[{...originals[0],bytes:foreign.length,sha256:hashV1(foreign)}]),{message:"TASK4_SQL_ORIGINALS_UNKNOWN"});
    for(const owners of [[],[{...backend,pid:pid+1}],[backend,backend],[{...backend,applicationName:"task4_observer_"+executionId}],
      [{...backend,startedAt:new Date(Date.parse(backend.startedAt)+1000).toISOString()}]])assert.throws(()=>settleTask4PgEventsV1(parsed,owners,originals),{message:"TASK4_SQL_ORIGINALS_UNKNOWN"});
    for(const chunks of [[],[{...originals[0],bytes:263}],[{...originals[0],start:1}],[originals[0],originals[0]]])
      assert.throws(()=>settleTask4PgEventsV1(parsed,[backend],chunks),{message:"TASK4_SQL_ORIGINALS_UNKNOWN"});
  });
  test("descriptor parent SQL settlement refuses unknown statements missing original attribution and hidden required errors",()=>{
    const ready=JSON.parse(GOLDEN_READY_V1),at="2026-10-19T10:00:00.000Z",backend={pid:123,startedAt:"2026-10-19T09:00:00.000000Z",role:ready.database.role,database:ready.database.name,applicationName:"task4_mc_"+ready.executionId,clientRole:"mc",clientIdentity:ready.fixtureOwner,firstObservedAt:at,lastObservedAt:at};
    const event={offset:0,length:100,rawHash:"a".repeat(64),capturedAt:at,pid:123,session:(Date.parse(backend.startedAt.slice(0,23)+"Z")/1000).toString(16)+".7b",scope:"restricted",applicationName:backend.applicationName,kind:"LOG",sqlstate:"00000",queryId:"mc_Q01",statementHash:TASK4_MC_SQL_V1[0]!.statementHash,classification:"route_read"};
    const originals=[{seq:1,sha256:"b".repeat(64),bytes:100,start:0}];
    const events=settleTask4PgEventsV1([event],[backend],originals);assert.equal(events[0]!.backendStartedAt,backend.startedAt);assert.equal(events[0]!.originalSeq,1);
    for(const changed of [{...event,queryId:"unknown",classification:"unknown"},{...event,pid:124},{...event,applicationName:"task4_probe_"+ready.executionId},
      {...event,kind:"ERROR",sqlstate:"42501"},{...event,classification:"forbidden_feed_ingest"}])assert.throws(()=>settleTask4PgEventsV1([changed],[backend],originals),{message:"TASK4_SQL_ORIGINALS_UNKNOWN"});
    assert.throws(()=>settleTask4PgEventsV1([event],[backend,{...backend,startedAt:"2026-10-19T09:00:01.000000Z"}],originals),{message:"TASK4_SQL_ORIGINALS_UNKNOWN"});
    assert.throws(()=>settleTask4PgEventsV1([event],[backend],[{...originals[0],bytes:99}]),{message:"TASK4_SQL_ORIGINALS_UNKNOWN"});
  });
  test("descriptor network policy probe requires original allowed connect denied permission and exit close",()=>{
    const span={startedAt:"2026-10-19T10:00:00.000Z",finishedAt:"2026-10-19T10:00:00.001Z"},allowed={...span,outcome:"connected",errno:null},denied={...span,outcome:"denied",errno:"EPERM"};
    const stdout=JSON.stringify({schema:"mission-control.task4-policy-probe-output.v1",allowed,denied})+"\n";
    const original={allowed,denied,stdout,stderr:"",stdoutHash:hashV1(stdout),stderrHash:hashV1(""),exit:{code:0,signal:null,exitObserved:true,closeObserved:true}};
    validateTask4PolicyOutcomesV1(original);
    for(const change of [(v:any)=>{v.denied.errno="ECONNREFUSED";},(v:any)=>{v.denied.outcome="unknown";},(v:any)=>{v.exit.closeObserved=false;},(v:any)=>{v.stderr="unexpected";},(v:any)=>{v.stdoutHash="0".repeat(64);}]){
      const value=structuredClone(original);change(value);assert.throws(()=>validateTask4PolicyOutcomesV1(value),{message:"TASK4_NETWORK_REFUSED"});
    }
  });
  test("descriptor policy stdout preserves fixed program bytes after canonical receipt roundtrip",async(t)=>{
    const make=(errno="EPERM")=>{
      const stdout='{"schema":"mission-control.task4-policy-probe-output.v1","allowed":{"startedAt":"2026-10-19T10:00:00.000Z","finishedAt":"2026-10-19T10:00:00.001Z","outcome":"connected","errno":null},"denied":{"startedAt":"2026-10-19T10:00:00.000Z","finishedAt":"2026-10-19T10:00:00.001Z","outcome":"denied","errno":"'+errno+'"}}\n';
      const output=JSON.parse(stdout);
      return JSON.parse(task4CanonicalV1({allowed:output.allowed,denied:output.denied,stdout,stderr:"",stdoutHash:hashV1(stdout),stderrHash:hashV1(""),
        exit:{code:0,signal:null,exitObserved:true,closeObserved:true}})+"\n");
    };
    for(const errno of ["EPERM","EACCES"])await t.test("canonical receipt retains "+errno+" program stdout",()=>{
      const value=make(errno);assert.deepEqual(Object.keys(value.allowed),["errno","finishedAt","outcome","startedAt"]);
      validateTask4PolicyOutcomesV1(value);
    });
    const changes:ReadonlyArray<readonly [string,(v:any)=>void]>=[
      ["canonicalized raw stdout",v=>{v.stdout=task4CanonicalV1(JSON.parse(v.stdout))+"\n";v.stdoutHash=hashV1(v.stdout);}],
      ["reordered nested raw stdout",v=>{v.stdout=JSON.stringify({schema:"mission-control.task4-policy-probe-output.v1",allowed:v.allowed,denied:v.denied})+"\n";v.stdoutHash=hashV1(v.stdout);}],
      ["changed stdout hash",v=>{v.stdoutHash="0".repeat(64);}],
      ["extra nested key",v=>{v.allowed.extra=true;}],
      ["missing nested key",v=>{delete v.allowed.errno;}],
      ["receipt time drift",v=>{v.allowed.finishedAt="2026-10-19T10:00:00.002Z";}],
      ["raw value drift with matching hash",v=>{v.stdout=v.stdout.replace('"errno":"EPERM"','"errno":"EACCES"');v.stdoutHash=hashV1(v.stdout);}],
    ];
    for(const [name,change] of changes)await t.test(name,()=>{const value=make();change(value);assert.throws(()=>validateTask4PolicyOutcomesV1(value),{message:"TASK4_NETWORK_REFUSED"});});
  });
  test("descriptor fd4 deadline refuses without inventing an unobserved socket close",async()=>{
    const ts=await import("typescript"),source=fs.readFileSync(fileURLToPath(import.meta.url),"utf8"),ast=ts.createSourceFile("fixture.ts",source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);
    const node=ast.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text==="readTask4Fd4V1")!;
    const js=ts.transpileModule(node.getText(ast).replace(/^export /,""),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
    let deadline:()=>void=()=>{},destroyed=0,closed=0;
    class OriginalSocket extends EventEmitter{destroy(){destroyed++;return this;}}
    const read=new Function("fs","Socket","setTimeout","clearTimeout","refuseV1","parseTask4FrameV1",js+";return readTask4Fd4V1")(
      {fstatSync:()=>({isFIFO:()=>true,isSocket:()=>false}),closeSync:()=>closed++},OriginalSocket,(fn:()=>void)=>{deadline=fn;return 1;},()=>{},refuseV1,parseTask4FrameV1);
    let rejection:string|null=null;const pending=read("setup").catch((error:Error)=>{rejection=error.message;});deadline();await Promise.resolve();await Promise.resolve();
    assert.equal(rejection,"TASK4_FRAME_TIMEOUT");assert.equal(destroyed,1);assert.equal(closed,0);await pending;
  });
  test("descriptor aggregate artifact acceptance rejects orphan evidence even with a valid canonical hash",()=>{
    const rows=new Map<string,Readonly<RecordV1>>();const put=(v:RecordV1)=>{const bytes=Buffer.from(task4CanonicalV1(v)+"\n"),ref={sha256:hashV1(bytes),bytes:bytes.length};rows.set(ref.sha256,v);return ref;};
    const leaf=put({schema:"component.leaf",value:1}),root=put({schema:"component.root",child:leaf});
    const result={observations:{before:root,after:root},render:null,cleanup:null,artifacts:{native:[],png:[]}};
    assertTask4ConsumedArtifactsV1(result,rows,[]);put({schema:"component.orphan",value:2});
    assert.throws(()=>assertTask4ConsumedArtifactsV1(result,rows,[]),{message:"TASK4_INTEGRITY_FAILED"});
  });
  test("descriptor actual parent audit reconstructs grants on the restricted original connection",async()=>{
    const ts=await import("typescript"),source=fs.readFileSync(fileURLToPath(import.meta.url),"utf8"),ast=ts.createSourceFile("fixture.ts",source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);
    const main=ast.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text==="runTask4OwnedFixtureV1") as import("typescript").FunctionDeclaration;
    const statement=main.body!.statements.find(n=>ts.isVariableStatement(n)&&n.declarationList.declarations.some(d=>ts.isIdentifier(d.name)&&d.name.text==="observeAudit"))!;
    const js=ts.transpileModule(statement.getText(ast),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
    const calls:string[]=[],admin={identity:"admin",unsafe:async()=>[{relation:null}]},restricted={identity:"restricted",unsafe:async(query:string)=>{calls.push(query);return [];}};
    const bindings={check(){},fixture:{database:"component_clone",sql:{begin:async(_mode:string,fn:(p:unknown)=>unknown)=>fn(admin)},observeOwnedP3ReadinessV1:async()=>({actualComponentObservation:true})},
      sourceSha:"a".repeat(40),id:"b".repeat(32),observerPort:restricted,requireV1,sameV1,observeTask4SeedV1:async()=>({}),observeTask4ParentCatalogV1:async()=>({}),observeTask4UntouchedV1:async()=>({}),
      observeTask4GrantsV1:async(port:any)=>{assert.equal(port.identity,"restricted");return {restricted:true};},put:(v:unknown)=>v,evidence:{},finalAudit:null,censuses:[],parentCalls:[]};
    const observe=new Function(...Object.keys(bindings),js+";return observeAudit")(...Object.values(bindings));const result=await observe("Before");
    assert.deepEqual(result.grants,{restricted:true});assert.equal(calls[0],"BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");assert.equal(calls.at(-1),"COMMIT");
  });
  test("descriptor parent joins the original census watcher before closing its socket owners",async()=>{
    const ts=await import("typescript"),source=fs.readFileSync(fileURLToPath(import.meta.url),"utf8"),start=source.indexOf('auditComplete=true;')+'auditComplete=true;'.length,end=source.indexOf('    stage="restricted_absence";',start);
    assert.ok(start>0&&end>start);const fragment=source.slice(start,end),js=ts.transpileModule("async function settle(){"+fragment+"}",{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
    let joined=false;const watcher={then(resolve:()=>void){joined=true;resolve();}},calls:string[]=[];
    const bindings={stage:"watcher_settle",predicate:"none",watcher,stopWatcher:false,observer:{},observerConnection:{},probe:{},probeConnection:{},watchFailure:false,failed:false,check(){},requireV1,
      closeReader:async()=>{assert.equal(joined,true);calls.push("close");},observeMainBackends:async()=>{calls.push("final");}};
    await new Function(...Object.keys(bindings),js+";return settle")(...Object.values(bindings))();assert.deepEqual(calls,["close","close","final"]);
  });
  test("descriptor identical observer SQL is classified by original backend and client identity",()=>{
    const ready=JSON.parse(GOLDEN_READY_V1),id=ready.executionId,app="task4_observer_"+id,statement="BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY";
    const issued=[{queryId:"parent_begin",statement,kind:"parent_observer",applicationName:app,clientPid:100},{queryId:"inner_begin",statement,kind:"inner_observer",applicationName:app,clientPid:101}];
    const bytes=Buffer.from("2026-10-19 10:00:00.000 UTC|123|68f4b340.7b|"+ready.database.role+"|"+ready.database.name+"|"+app+"|00000| LOG:  statement: "+statement+"\n");
    const parent=parseTask4PgLogV1(bytes,id,ready.database.name,issued,[{pid:123,clientIdentity:{pid:100}}]);assert.equal(parent[0]!.queryId,"parent_begin");
    const inner=parseTask4PgLogV1(bytes,id,ready.database.name,issued,[{pid:123,clientIdentity:{pid:101}}]);assert.equal(inner[0]!.queryId,"inner_begin");
    assert.equal(parseTask4PgLogV1(bytes,id,ready.database.name,issued,[{pid:123,clientIdentity:{pid:999}}])[0]!.queryId,"unknown");
    assert.throws(()=>parseTask4PgLogV1(bytes,id,ready.database.name,issued,[{pid:123,clientIdentity:{pid:100}},{pid:123,clientIdentity:{pid:101}}]),{message:"TASK4_SQL_ORIGINALS_UNKNOWN"});
  });
  test("descriptor fixed PostgreSQL material admits only the staged path with unchanged identity",async(t)=>{
    const staged="/Users/setrox/ai/setrox/.task4-toolchain-v1/Cellar/postgresql@17/17.10/bin/postgres";
    const base=JSON.parse(GOLDEN_SETUP_V1);base.postgres.process.executable=staged;
    const frame=(value:unknown)=>Buffer.from(task4CanonicalV1(value)+"\n");
    await t.test("exact staged setup and ready",()=>{
      assert.deepEqual(parseTask4FrameV1(frame(base),"setup"),base);
      const ready=JSON.parse(GOLDEN_READY_V1);ready.setup=base;ready.setupDescriptorHash=hashV1(frame(base));
      assert.deepEqual(parseTask4FrameV1(frame(ready),"ready"),ready);
    });
    const changes:Array<[string,string,(value:RecordV1)=>void]>=[
      ["original Cellar","TASK4_BINDING_REFUSED",v=>{v.postgres.process.executable="/opt/homebrew/Cellar/postgresql@17/17.10/bin/postgres";}],
      ["alternate private root","TASK4_BINDING_REFUSED",v=>{v.postgres.process.executable=staged.replace("toolchain-v1","toolchain-v2");}],
      ["relative alias","TASK4_SHAPE_INVALID",v=>{v.postgres.process.executable="./postgres";}],
      ["noncanonical alias","TASK4_SHAPE_INVALID",v=>{v.postgres.process.executable=staged.replace("/bin/","/bin/../bin/");}],
      ["crossed executable hash","TASK4_BINDING_REFUSED",v=>{v.postgres.process.executableHash="0".repeat(64);}],
      ["crossed original parent","TASK4_BINDING_REFUSED",v=>{v.postgres.process.ppid++;}],
      ["crossed owner","TASK4_BINDING_REFUSED",v=>{v.postgres.process.uid++;}],
      ["crossed version","TASK4_SHAPE_INVALID",v=>{v.postgres.versionNum=170009;}],
    ];
    for(const [name,code,change] of changes)await t.test(name,()=>{
      const value=structuredClone(base);change(value);
      assert.throws(()=>parseTask4FrameV1(frame(value),"setup"),{message:code});
      const ready=JSON.parse(GOLDEN_READY_V1);ready.setup=value;ready.setupDescriptorHash=hashV1(frame(value));
      assert.throws(()=>parseTask4FrameV1(frame(ready),"ready"),{message:code});
    });
  });
  test("descriptor shared canonical wire vectors retain exact shapes and hashes", () => {
    for (const [kind, bytes, length, hash] of [
      ["launch", GOLDEN_LAUNCH_V1, 876, "156d0ba4ec740d1e73f68770e95e2c2111efff0467cbd7e5493e5687abc3ad98"],
      ["setup", GOLDEN_SETUP_V1, 2564, "0514fad6df757332d6e7ef2e14cd3a428a01af15a8f804203f8306b27d612fcd"],
      ["ready", GOLDEN_READY_V1, 4504, "859c26f23616f5a4f458d6177eb9629afefce65cd82fd1831fd5c6a6c79cf5dd"],
    ] as const) {
      const frame=Buffer.from(bytes+"\n");
      assert.equal(frame.length,length);assert.equal(createHash("sha256").update(frame).digest("hex"),hash);
      const parsed=parseTask4FrameV1(frame,kind);
      assert.deepEqual(parsed,JSON.parse(bytes));assert.equal(Object.isFrozen(parsed),true);
    }
  });
  test("descriptor framing and nested bindings reject malformed or crossed input", () => {
    for(const bytes of [GOLDEN_SETUP_V1,GOLDEN_SETUP_V1+"\n\n"," "+GOLDEN_SETUP_V1+"\n",
      GOLDEN_SETUP_V1.replace('{"executionId":','{"schema":"setfarm.mc-render-smoke-setup.v1","executionId":')+"\n"]) {
      assert.throws(()=>parseTask4FrameV1(Buffer.from(bytes),"setup"),{message:"TASK4_FRAME_INVALID"});
    }
    assert.throws(()=>parseTask4FrameV1(Buffer.alloc(16385),"setup"),{message:"TASK4_FRAME_TOO_LARGE"});
    assert.throws(()=>parseTask4FrameV1(Buffer.from([255,10]),"setup"),{message:"TASK4_FRAME_INVALID"});
    for(const mutate of [(v:any)=>{v.argv=[];},(v:any)=>{v.postgres.port=5432;},(v:any)=>{v.owner.uid=0;},
      (v:any)=>{v.resourceRoot.mode=511;},(v:any)=>{v.resourceRoot.ino="01";},
      (v:any)=>{v.setfarm.rootPin.path="/foreign";},(v:any)=>{v.postgres.data.path+="/../foreign";}]) {
      const v=JSON.parse(GOLDEN_SETUP_V1);mutate(v);assert.throws(()=>parseTask4FrameV1(Buffer.from(task4CanonicalV1(v)+"\n"),"setup"));
    }
    for(const mutate of [(v:any)=>{v.setupDescriptorHash="0".repeat(64);},(v:any)=>{v.executionId="0".repeat(32);},
      (v:any)=>{v.database.restrictedUrl+="?option=bad";},(v:any)=>{v.projection.inputManifestHash="0".repeat(64);}]) {
      const v=JSON.parse(GOLDEN_READY_V1);mutate(v);assert.throws(()=>parseTask4FrameV1(Buffer.from(task4CanonicalV1(v)+"\n"),"ready"));
    }
  });
  test("descriptor full seed and grant vectors match independent final canonical bytes",()=>{
    const seed=task4SeedV1("1".repeat(40));assert.equal(task4CanonicalV1(seed),GOLDEN_SEED_V1);
    assert.equal(Buffer.byteLength(GOLDEN_SEED_V1),24563);
    assert.equal(createHash("sha256").update(GOLDEN_SEED_V1).digest("hex"),"acbdd5a51a633eb5317d678cb0b9869114461a038efdce5c3b143c372d3bb429");
    validateTask4SeedV1(seed,"1".repeat(40));
    const e=JSON.parse(GOLDEN_GRANTS_V1),grants=task4GrantsV1(e.database,e.role.name);
    assert.equal(task4CanonicalV1(grants),GOLDEN_GRANTS_V1);assert.equal(Buffer.byteLength(GOLDEN_GRANTS_V1),2803);
    assert.equal(createHash("sha256").update(GOLDEN_GRANTS_V1).digest("hex"),"656d4a9282e79c0c694d5fd542d8c46a78fb735e5d10c640f0dd2b1db000a476");
    validateTask4GrantsV1(grants,e.database,e.role.name);
  });
  test("descriptor dataset guards reject foreign full rows privileges and changed content",()=>{
    for(const mutate of [(v:any)=>v.runs.push({...v.runs[0],id:"foreign"}),(v:any)=>{v.runs[0].context={};},
      (v:any)=>v.emptyRelations[0].rows.push({id:"foreign"}),(v:any)=>{v.templateRows[0].prd_content+="changed";},
      (v:any)=>{v.releaseAdmissions[0].payload.gate.hash="f".repeat(64);},(v:any)=>v.runs.reverse()]) {
      const v=JSON.parse(GOLDEN_SEED_V1);mutate(v);assert.throws(()=>validateTask4SeedV1(v,"1".repeat(40)),{message:"TASK4_DATABASE_REFUSED"});
    }
    assert.throws(()=>validateTask4SeedV1(task4SeedV1("2".repeat(40)),"1".repeat(40)),{message:"TASK4_DATABASE_REFUSED"});
    for(const mutate of [(v:any)=>v.relationGrants.push({schema:"public",name:"runs",kind:"r",privilege:"UPDATE"}),
      (v:any)=>v.applicationRoutineGrants.push({schema:"public",name:"unsafe",identity:"",kind:"f",securityDefiner:true}),
      (v:any)=>{v.role.inherit=true;},(v:any)=>{v.database="foreign";},(v:any)=>v.relationGrants.reverse()]) {
      const v=JSON.parse(GOLDEN_GRANTS_V1);mutate(v);const e=JSON.parse(GOLDEN_GRANTS_V1);
      assert.throws(()=>validateTask4GrantsV1(v,e.database,e.role.name),{message:"TASK4_DATABASE_REFUSED"});
    }
  });
  test("descriptor pinned auxiliary grammar reads literals and refuses expressions without execution",async()=>{
    const source=fs.readFileSync(new URL("../../src/installation/fresh-installation-mission-control-schema-v1.ts",import.meta.url),"utf8");
    const data=await extractTask4AuxiliaryV1(source);
    assert.equal(data.statements.length,12);assert.equal(data.tables.length,5);assert.equal(data.templates.length,9);
    assert.deepEqual(data.templates,JSON.parse(GOLDEN_SEED_V1).templateRows);
    for(const changed of [source.replace('Object.freeze(["tasks"','Object.freeze([evil(),"tasks"'),
      source.replace('Object.freeze(["tasks"','Object.freeze([...evil,"tasks"'),
      source.replace('"tpl-ecommerce": `# PRD','"tpl-ecommerce": `${evil()}# PRD'),
      source.replace('"tpl-ecommerce": `# PRD','[evil()]: `# PRD'),
      source+'\nconst TABLES=Object.freeze([]);',source.replace('const TABLES =','const OTHER =')]) {
      await assert.rejects(()=>extractTask4AuxiliaryV1(changed),{message:"TASK4_AUXILIARY_SOURCE_REFUSED"});
    }
  });
  test("descriptor auxiliary statements and freeze wrappers cannot be replaced by similar executable material",async()=>{
    const source=fs.readFileSync(new URL("../../src/installation/fresh-installation-mission-control-schema-v1.ts",import.meta.url),"utf8");
    for(const changed of [source.replace("CREATE INDEX idx_live_events_ts ON public.live_events(ts)","CREATE INDEX idx_live_events_ts ON public.live_events(ts); DROP TABLE public.runs"),
      source.replace('Object.freeze({"id": "tpl-ecommerce"','({"id": "tpl-ecommerce"')]) {
      await assert.rejects(()=>extractTask4AuxiliaryV1(changed),{message:"TASK4_AUXILIARY_SOURCE_REFUSED"});
    }
  });
  test("descriptor special vector is exactly six cells and import has no private input or operational graph effects",()=>{
    const vector=["node","--import","tsx","--test","--test-concurrency=1","tests/fixtures/mission-control-render-smoke-owned-v1.ts"];
    assert.equal(isTask4CommandV1(vector),true);
    for(let i=0;i<vector.length;i++){const changed=[...vector];changed[i]+="x";assert.equal(isTask4CommandV1(changed),false);}
    assert.equal(isTask4CommandV1([...vector,"extra"]),false);assert.equal(isTask4CommandV1(vector.slice(1)),false);
    const target=import.meta.url;
    const child=spawnSync(process.execPath,["--import","tsx","--input-type=module","-e",
      `import{registerHooks}from'node:module';const target=${JSON.stringify(target)};const hook=registerHooks({resolve(s,c,n){if(!s.startsWith('node:')&&s!==target)throw Error('UNEXPECTED_IMPORT');return n(s,c);}});await import(target);hook.deregister();process.stdout.write('SAFE_IMPORT\\n');`],
      {env:{PATH:"/usr/bin:/bin",LANG:"C",LC_ALL:"C",TSX_DISABLE_CACHE:"1"},encoding:"utf8",timeout:5000,maxBuffer:4096});
    assert.equal(child.error,undefined);assert.equal(child.signal,null);assert.equal(child.status,0,child.stderr);
    assert.equal(child.stdout,"SAFE_IMPORT\n");assert.equal(child.stderr,"");
  });
  test("descriptor fd4 requires bounded LF and EOF and closes its original pipe on every result",async()=>{
    for(const [mode,expected] of [["valid","OK"],["trailing","TASK4_FRAME_INVALID"],["missing","TASK4_FRAME_MISSING"],["timeout","TASK4_FRAME_TIMEOUT"]] as const) {
      const script=`import fs from'node:fs';const api=await import(${JSON.stringify(import.meta.url)});if(${JSON.stringify(mode)}==='missing')fs.closeSync(4);let result;try{await api.readTask4Fd4V1('setup');result='OK';}catch(e){result=/^TASK4_[A-Z_]+$/.test(e.message)?e.message:'UNEXPECTED';}let closed=false;try{fs.fstatSync(4);}catch{closed=true;}process.stdout.write(result+':'+closed+'\\n');`;
      const child=spawn(process.execPath,["--import","tsx","--input-type=module","-e",script],{
        env:{PATH:"/usr/bin:/bin",LANG:"C",LC_ALL:"C",TSX_DISABLE_CACHE:"1"},stdio:["ignore","pipe","pipe","ignore","pipe"],
      });
      let output="",errors="",exited=false,forced=false;
      const timer=setTimeout(()=>{forced=true;child.kill("SIGKILL");},8000);
      child.stdout!.on("data",chunk=>{output+=chunk;if(output.length>4096){forced=true;child.kill("SIGKILL");}});
      child.stderr!.on("data",chunk=>{errors+=chunk;if(errors.length>4096){forced=true;child.kill("SIGKILL");}});
      child.once("exit",()=>{exited=true;});
      const writer=child.stdio[4] as import("node:stream").Writable|null;
      writer?.on("error",()=>{});
      if(mode!=="missing"&&mode!=="timeout")writer!.end(GOLDEN_SETUP_V1+"\n"+(mode==="trailing"?"x":""));
      const outcome=await new Promise<{code:number|null;signal:NodeJS.Signals|null}>((resolve,reject)=>{
        child.once("error",reject);child.once("close",(code,signal)=>resolve({code,signal}));
      }).finally(()=>{clearTimeout(timer);writer?.destroy();});
      assert.equal(forced,false);assert.equal(exited,true);assert.deepEqual(outcome,{code:0,signal:null});assert.equal(errors,"");
      assert.equal(output,expected+":true\n");
    }
  });
  test("descriptor retained original file pins refuse replacement links mode drift and byte overflow",()=>{
    const root=fs.realpathSync(fs.mkdtempSync(path.join(tmpdir(),"task4-file-component-")));
    const file=path.join(root,"fixed.json");let pin:ReturnType<typeof pinTask4FileV1>|undefined;
    try {
      fs.writeFileSync(file,"owned\n",{mode:0o600});pin=pinTask4FileV1(file,6);pin.check();assert.equal(pin.bytes.toString(),"owned\n");
      fs.writeFileSync(file,"changed\n");assert.throws(()=>pin!.check(),{message:"TASK4_SOURCE_DRIFT"});pin.close();pin=undefined;
      assert.throws(()=>pinTask4FileV1(file,6),{message:"TASK4_SOURCE_DRIFT"});
      fs.writeFileSync(file,"owned\n");pin=pinTask4FileV1(file,6);fs.renameSync(file,file+".old");fs.writeFileSync(file,"owned\n",{mode:0o600});
      assert.throws(()=>pin!.check(),{message:"TASK4_SOURCE_DRIFT"});pin.close();pin=undefined;
      fs.linkSync(file,file+".link");assert.throws(()=>pinTask4FileV1(file,6),{message:"TASK4_SOURCE_DRIFT"});fs.unlinkSync(file+".link");
      fs.symlinkSync(file,file+".symlink");assert.throws(()=>pinTask4FileV1(file+".symlink",6),{message:"TASK4_SOURCE_DRIFT"});
      pin=pinTask4FileV1(file,6);fs.chmodSync(file,0o666);assert.throws(()=>pin!.check(),{message:"TASK4_SOURCE_DRIFT"});
    } finally {pin?.close();fs.rmSync(root,{recursive:true});}
  });
  test("descriptor seed observation reads complete fixed rowsets and refuses foreign rows or precision loss",async()=>{
    const expected=JSON.parse(GOLDEN_SEED_V1);
    const runColumns=Object.keys(expected.runs[0]);const admissionColumns=Object.keys(expected.releaseAdmissions[0]);
    const templateColumns=Object.keys(expected.templateRows[0]);
    for(const mutation of ["none","extra_run","foreign_empty","missing_relation","precision","unknown_column","wrong_type","overflow"]){
      const queries:string[]=[];
      const sql:QueryPortV1={unsafe:async query=>{
        queries.push(query);
        if(query.includes("pg_catalog.pg_class")) {
          const names=["runs","v3_release_admissions","prd_templates",...expected.emptyRelations.map((r:any)=>r.name)].sort();
          return names.filter(name=>mutation!=="missing_relation"||name!=="stories").map(name=>({name,kind:"r",rls:false,forceRls:false,
            columns:(name==="runs"?[...runColumns,...(mutation==="unknown_column"?["unknown"]:[])].sort():name==="v3_release_admissions"?admissionColumns.sort():name==="prd_templates"?templateColumns.sort():["id"])
              .map(column=>({name:column,type:mutation==="wrong_type"&&column==="context"?"jsonb":["created_at","updated_at","expires_at"].includes(column)?"timestamptz":column==="payload"?"jsonb":["run_number","protocol_version"].includes(column)?"int4":"text"}))}));
        }
        assert.doesNotMatch(query,/\bWHERE\b|\bLIMIT 1\b|\bFOR UPDATE\b/i);assert.match(query,/LIMIT 4097$/);
        if(query.includes('FROM public."runs"')){
          if(mutation==="overflow")return Array.from({length:4097},()=>({row:expected.runs[0],precision_ok:true}));
          return [...expected.runs,...(mutation==="extra_run"?[{...expected.runs[0],id:"foreign"}]:[])].map(row=>({row,precision_ok:mutation!=="precision"}));
        }
        if(query.includes('FROM public."v3_release_admissions"'))return expected.releaseAdmissions.map((row:any)=>({row,precision_ok:true}));
        if(query.includes('FROM public."prd_templates"'))return expected.templateRows.map((row:any)=>({row,precision_ok:true}));
        if(mutation==="foreign_empty"&&query.includes('FROM public."stories"'))return [{row:{id:"foreign"}}];
        return [];
      }};
      if(mutation==="none"){
        assert.deepEqual(await observeTask4SeedV1(sql,"1".repeat(40)),expected);
        assert.equal(queries.length,22);
        for(const name of expected.emptyRelations.map((r:any)=>r.name))assert.equal(queries.filter(q=>q.includes(`FROM public."${name}"`)).length,1);
      }else await assert.rejects(()=>observeTask4SeedV1(sql,"1".repeat(40)),{message:"TASK4_DATABASE_REFUSED"});
    }
  });
  test("descriptor effective grant observation inventories every object before selecting positive privileges",async()=>{
    const expected=JSON.parse(GOLDEN_GRANTS_V1);
    for(const mutation of ["none","public_update","foreign_connect","column_insert","routine_execute","null_privilege","overflow","wrong_user"]){
      const seen:string[]=[];
      const sql:QueryPortV1={unsafe:async query=>{
        const tag=/\/\*task4:([a-z]+)\*\//.exec(query)?.[1];assert.ok(tag);seen.push(tag);
        if(tag==="role")return [{...expected.role,currentUser:mutation==="wrong_user"?"foreign":expected.role.currentUser}];
        if(tag==="settings")return [{database:expected.database,...expected.settings}];
        if(tag==="memberships"||tag==="owned")return [];
        if(tag==="databases")return [{name:expected.database,CONNECT:true,CREATE:false,TEMPORARY:false},
          {name:"postgres",CONNECT:mutation==="foreign_connect",CREATE:false,TEMPORARY:false}];
        if(tag==="schemas")return [{name:"public",USAGE:true,CREATE:false}];
        if(tag==="relations"){
          if(mutation==="overflow")return Array.from({length:4097},()=>({}));
          return expected.relationGrants.map((r:any)=>({schema:r.schema,name:r.name,kind:r.kind,
            SELECT:mutation==="null_privilege"?null:true,INSERT:false,UPDATE:mutation==="public_update"&&r.name==="runs",
            DELETE:false,TRUNCATE:false,REFERENCES:false,TRIGGER:false,MAINTAIN:false}));
        }
        if(tag==="columns")return [{schema:"public",relation:"runs",column:"task",SELECT:true,INSERT:mutation==="column_insert",UPDATE:false,REFERENCES:false,
          tableSELECT:true,tableINSERT:false,tableUPDATE:false,tableREFERENCES:false}];
        if(tag==="sequences")return [{schema:"public",name:"runs_run_number_seq",USAGE:false,SELECT:false,UPDATE:false}];
        if(tag==="routines")return [{schema:"public",name:"fixed_guard",identity:"",kind:"f",securityDefiner:true,EXECUTE:mutation==="routine_execute"}];
        throw Error("unexpected query");
      }};
      if(mutation==="none"){
        assert.deepEqual(await observeTask4GrantsV1(sql,expected.database,expected.role.name),expected);
        assert.deepEqual(seen,["role","settings","memberships","owned","databases","schemas","relations","columns","sequences","routines"]);
      }else await assert.rejects(()=>observeTask4GrantsV1(sql,expected.database,expected.role.name),{message:"TASK4_DATABASE_REFUSED"});
    }
  });
  test("descriptor input manifest binds every stage-zero current byte member and rejects omission or symlink modes",()=>{
    const index=`100644 ${"a".repeat(40)} 0\ta.ts\0`+`100755 ${"b".repeat(40)} 0\tb.ts\0`;
    const members=[{path:"a.ts",sha256:"1".repeat(64)},{path:"b.ts",sha256:"2".repeat(64)}];
    const expected='{"entries":[{"gitMode":"100644","path":"a.ts","sha256":"'+"1".repeat(64)+'"},{"gitMode":"100755","path":"b.ts","sha256":"'+"2".repeat(64)+'"}],"schema":"setfarm.task4.source-input-manifest.v1"}';
    assert.equal(task4InputManifestV1(index,members),createHash("sha256").update(expected).digest("hex"));
    assert.equal(task4InputManifestV1(index,[...members].reverse()),task4InputManifestV1(index,members));
    for(const invalid of [index.replace("100644","120000"),index.replace(" 0\t"," 2\t"),index+index.split("\0")[0]+"\0",index.replace("a.ts","../a.ts")]) {
      assert.throws(()=>task4InputManifestV1(invalid,members),{message:"TASK4_SOURCE_DRIFT"});
    }
    for(const invalid of [members.slice(1),[...members,{path:"extra.ts",sha256:"3".repeat(64)}],[members[0]!,members[0]!]]) {
      assert.throws(()=>task4InputManifestV1(index,invalid),{message:"TASK4_SOURCE_DRIFT"});
    }
    assert.notEqual(task4InputManifestV1(index,[members[0]!,{path:"b.ts",sha256:"3".repeat(64)}]),task4InputManifestV1(index,members));
  });
  test("descriptor original child requires distinct exit and close without adopting handles",async()=>{
    const child=new EventEmitter() as import("node:child_process").ChildProcess;
    let done=false;const settled=observeTask4OriginalChildV1(child).then(value=>{done=true;return value;});
    child.emit("exit",0,null);await Promise.resolve();assert.equal(done,false);
    child.emit("close",0,null);assert.deepEqual(await settled,{code:0,signal:null,exitObserved:true,closeObserved:true});
    for(const events of [[["close",0,null]],[["exit",0,null],["close",1,null]],[["error",new Error("private detail")],["close",-2,null]]]) {
      const other=new EventEmitter() as import("node:child_process").ChildProcess;
      const result=observeTask4OriginalChildV1(other);for(const [name,...args] of events)other.emit(name as string,...args);
      await assert.rejects(result,{message:"TASK4_CHILD_UNKNOWN"});
    }
  });
  test("descriptor four outer forms preserve exact raw command and refuse arbitrary selectors",()=>{
    const node="/owned/node",root="/owned/mc",base=node+" "+root+"/scripts/render-smoke.mjs";
    for(const [suffix,scenario] of [["","pass"],[" --owned-fixture-v1","pass"],[" --owned-fixture-assertion-failure-v1","assertion_failure"],[" --owned-fixture-owned-cancel-v1","owned_cancel"]]) {
      assert.equal(task4ScenarioV1(base+suffix,node,root),scenario);
    }
    for(const command of [base+" ",base+" --owned-fixture-ready-v1",base+" --owned-fixture-v1 extra",node+" --import loader "+base,base.replace("/owned/mc","/foreign")])
      assert.throws(()=>task4ScenarioV1(command,node,root),{message:"TASK4_BINDING_REFUSED"});
  });
  test("descriptor process census binds exact metadata executable raw command and complete snapshots",()=>{
    const row=" 123 100 501 Mon Oct 19 10:00:00 2026 123 /owned/node /owned/entry\n";
    const parsed=parseTask4ProcessV1(123,row,"/owned/node\n",row,"a".repeat(64));
    assert.equal(parsed.pin.pid,123);assert.equal(parsed.pin.ppid,100);assert.equal(parsed.pin.pgid,123);
    assert.equal(parsed.pin.commandHash,hashV1("/owned/node /owned/entry"));assert.equal(parsed.rawCommand,"/owned/node /owned/entry");
    for(const [pid,a,b,c] of [[124,row,"/owned/node\n",row],[123,row,"relative\n",row],
      [123,row,"/owned/node\n",row.replace("100","101")],[123,row+row,"/owned/node\n",row+row],
      [123,row.replace("501","-1"),"/owned/node\n",row.replace("501","-1")]])
      assert.throws(()=>parseTask4ProcessV1(pid as number,a as string,b as string,c as string,"a".repeat(64)),{message:"TASK4_BINDING_REFUSED"});
  });
  test("descriptor process start time is explicit UTC with strict calendar and weekday validation",()=>{
    const old=process.env.TZ;try{process.env.TZ="Europe/Istanbul";
      const row=" 123 100 501 Mon Oct 19 10:00:00 2026 123 /owned/node /owned/entry\n";
      assert.equal(parseTask4ProcessV1(123,row,"/owned/node\n",row,"a".repeat(64)).pin.startedAt,"2026-10-19T10:00:00.000Z");
      for(const bad of [row.replace("Mon Oct 19","Mon Feb 30"),row.replace("Mon Oct 19","Sun Oct 19"),row.replace("10:00:00","25:00:00")])
        assert.throws(()=>parseTask4ProcessV1(123,bad,"/owned/node\n",bad,"a".repeat(64)),{message:"TASK4_BINDING_REFUSED"});
    }finally{if(old===undefined)delete process.env.TZ;else process.env.TZ=old;}
  });
  test("descriptor retained directory identity refuses replacement symlink and mode drift",()=>{
    const root=fs.realpathSync(fs.mkdtempSync(path.join(tmpdir(),"task4-directory-test-")));fs.chmodSync(root,0o700);
    try {
      const pin=pinTask4DirectoryV1(root,true);assert.equal(pin.value.path,root);pin.check();
      fs.chmodSync(root,0o755);assert.throws(()=>pin.check(),{message:"TASK4_SOURCE_DRIFT"});pin.close();
      fs.chmodSync(root,0o700);const child=path.join(root,"child");fs.mkdirSync(child,{mode:0o700});
      const second=pinTask4DirectoryV1(child,true);fs.renameSync(child,path.join(root,"original"));fs.mkdirSync(child,{mode:0o700});
      assert.throws(()=>second.check(),{message:"TASK4_SOURCE_DRIFT"});second.close();
      fs.symlinkSync(child,path.join(root,"link"));assert.throws(()=>pinTask4DirectoryV1(path.join(root,"link"),true));
    }finally{fs.rmSync(root,{recursive:true,force:true});}
  });
  test("descriptor actual special runner refuses empty setup before admin or projection effects",async()=>{
    const runner=fileURLToPath(new URL("../../scripts/run-isolated-postgres-tests.ts",import.meta.url));
    const source=`process.argv=[process.execPath,${JSON.stringify(runner)},'--','node','--import','tsx','--test','--test-concurrency=1','tests/fixtures/mission-control-render-smoke-owned-v1.ts'];await import(${JSON.stringify(pathToFileURL(runner).href)});`;
    const child=spawn(process.execPath,["--import","tsx","--input-type=module","-e",source],{
      cwd:path.dirname(path.dirname(runner)),env:{PATH:"/usr/bin:/bin",LANG:"C",LC_ALL:"C",TSX_DISABLE_CACHE:"1"},stdio:["ignore","pipe","pipe","ignore","pipe"]});
    const settled=observeTask4OriginalChildV1(child);let output="";let overflow=false;
    for(const stream of [child.stdout,child.stderr])stream!.on("data",chunk=>{if(output.length+chunk.length>16384)overflow=true;else output+=chunk;});
    (child.stdio[4] as import("node:stream").Writable).on("error",()=>{});
    (child.stdio[4] as import("node:stream").Writable).end();
    const exit=await settled;assert.equal(overflow,false);assert.equal(exit.code,1);assert.equal(output,"TASK4_FRAME_INVALID\n");
  });
  test("descriptor network build binding checks the actual capture and exact identity before deriving recipes",async()=>{
    const ts=await import("typescript"),source=fs.readFileSync(fileURLToPath(import.meta.url),"utf8");
    const anchor='const mc=await import(pathToFileURL(path.join(setup.missionControl.source.root,"scripts/render-smoke-owned-fixture.mjs")).href);check();';
    const start=source.indexOf(anchor)+anchor.length,end=source.indexOf('    const node=context.owner.executable',start);
    assert.ok(start>anchor.length&&end>start);
    const js=ts.transpileModule(source.slice(start,end),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText;
    const expected={root:"/owned/component",sourceSha:"a".repeat(40),treeHash:"b".repeat(40),buildHash:"c".repeat(64),buildIdentityHash:"d".repeat(64)};
    const execute=(change:Record<string,string>={},driftAt=0)=>{
      const calls:string[]=[];let checks=0;const build={identity:{schema:"mission-control.internal-production-build-identity.v1",sourceSha:expected.sourceSha,treeHash:expected.treeHash,buildHash:expected.buildHash,...change},identityHash:change.identityHash??expected.buildIdentityHash,check(){calls.push("build");if(++checks===driftAt)throw new Error("TASK4_SOURCE_DRIFT");}};
      const mc={captureTask4BuildV1(root:string){assert.equal(root,expected.root);calls.push("capture");return build;},task4ObserverSqlRecipesV1(){return [];},task4NetworkRecipesV1(input:unknown){assert.equal(input,build);calls.push("derive");return [{pathId:"asset_js",method:"GET",path:"/assets/index-component.js",query:""}];}};
      const run=new Function("mc","setup","check","requireV1",js+";return networkRecipes;");
      return {calls,run:()=>run(mc,{missionControl:{source:expected}},()=>calls.push("context"),requireV1)};
    };
    const valid=execute();assert.equal(valid.run()[0].path,"/assets/index-component.js");assert.deepEqual(valid.calls,["capture","build","context","derive","build","context"]);
    for(const [key,value] of [["sourceSha","e".repeat(40)],["treeHash","e".repeat(40)],["buildHash","e".repeat(64)],["identityHash","e".repeat(64)]]){
      const crossed=execute({[key!]:value!});assert.throws(crossed.run,{message:"TASK4_SOURCE_DRIFT"});assert.equal(crossed.calls.includes("derive"),false);
    }
    for(const at of [1,2])assert.throws(execute({},at).run,{message:"TASK4_SOURCE_DRIFT"});
  });
  test("descriptor network qualification retains build and context checks around the actual ledger validator",async()=>{
    const ts=await import("typescript"),source=fs.readFileSync(fileURLToPath(import.meta.url),"utf8"),anchor='const network=task4ArtifactV1(artifacts,render.network),filesystem=task4ArtifactV1(artifacts,render.filesystem);';
    const start=source.indexOf(anchor)+anchor.length,end=source.indexOf('validateTask4FilesystemV1(filesystem',start);assert.ok(start>anchor.length&&end>start);
    const js=ts.transpileModule(source.slice(start,end),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText;
    for(const driftAt of [0,1,2]){const calls:string[]=[];let n=0;const build={check(){calls.push("build");if(++n===driftAt)throw new Error("TASK4_SOURCE_DRIFT");}};
      const run=()=>new Function("networkBuild","check","validateTask4NetworkV1","network","ready","cleanup","artifacts","networkRecipes",js)(build,()=>calls.push("context"),()=>calls.push("validate"),{}, {}, {},new Map(),[]);
      if(driftAt)assert.throws(run,{message:"TASK4_SOURCE_DRIFT"});else{run();assert.deepEqual(calls,["build","context","validate","build","context"]);}
      if(driftAt===1)assert.equal(calls.includes("validate"),false);
    }
  });
  test("descriptor measured build uses stock bytes recipe and rejects added replaced or missing members",()=>{
    const root=fs.realpathSync(fs.mkdtempSync(path.join(tmpdir(),"task4-build-test-")));fs.chmodSync(root,0o700);
    try {
      const entries=["dist/index.html","dist-server/index.js","dist-server/services/setfarm-product-build-authority.js","dist-server/scripts/ui-regression-lifecycle.mjs"].sort();
      const digest=createHash("sha256").update("mission-control.internal-production-build-content.v1\0");
      for(const name of entries){const bytes=Buffer.from(name);fs.mkdirSync(path.dirname(path.join(root,name)),{recursive:true,mode:0o700});
        fs.writeFileSync(path.join(root,name),bytes,{mode:0o600});digest.update(name).update("\0").update(String(bytes.length)).update("\0").update(bytes).update("\0");}
      const identity={schema:"mission-control.internal-production-build-identity.v1",sourceSha:"a".repeat(40),treeHash:"b".repeat(40),buildHash:digest.digest("hex")};
      const identityPath=path.join(root,"dist-server/internal-production-build-identity.v1.json");fs.writeFileSync(identityPath,JSON.stringify(identity),{mode:0o600});
      const measured=measureTask4BuildV1(root);assert.deepEqual(measured.identity,identity);measured.check();
      const extra=path.join(root,"dist/extra.js");fs.writeFileSync(extra,"extra",{mode:0o600});assert.throws(()=>measured.check(),{message:"TASK4_SOURCE_DRIFT"});
      fs.unlinkSync(extra);measured.check();fs.appendFileSync(path.join(root,"dist/index.html"),"changed");assert.throws(()=>measured.check());measured.close();
      assert.throws(()=>measureTask4BuildV1(root));
    }finally{fs.rmSync(root,{recursive:true,force:true});}
  });
  test("descriptor runtime binding refuses crossed local source or admin before SQL and filesystem effects",async()=>{
    const setup=JSON.parse(GOLDEN_SETUP_V1);
    await assert.rejects(prepareTask4ContextV1(setup,"runner","postgres://user:private@127.0.0.1:15432/postgres"),{message:"TASK4_BINDING_REFUSED"});
    setup.setfarm.source.root=path.resolve(fileURLToPath(new URL("../../",import.meta.url)));
    await assert.rejects(prepareTask4ContextV1(setup,"runner","postgres://user:private@127.0.0.1:5432/postgres"),{message:"TASK4_BINDING_REFUSED"});
  });
  test("descriptor privilege probes use seven fixed rollback-contained statements without outside effects",()=>{
    const probes=task4ProbesV1("a".repeat(32));assert.equal(probes.length,7);
    assert.deepEqual(probes.map(p=>p.id),["insert","update","delete","create_table","create_temp","create_schema","create_function"]);
    for(const probe of probes){assert.equal(Object.isFrozen(probe),true);assert.doesNotMatch(probe.statement,/ALTER SYSTEM|DROP DATABASE|COPY|nextval|setval|terminate_backend/i);}
    assert.match(probes[0]!.statement,/WHERE false$/);assert.match(probes[1]!.statement,/WHERE false$/);assert.match(probes[2]!.statement,/WHERE false$/);
    assert.throws(()=>task4ProbesV1("a;DROP"));
  });
  test("descriptor untouched snapshot inventories every public relation and refuses unknown kinds or overflow",async()=>{
    const queries:string[]=[];const sql={async unsafe(query:string){queries.push(query);
      if(query.includes("task4:untouched-catalog"))return [{name:"runs",kind:"r"},{name:"schema_migrations",kind:"r"},{name:"agent_feed_id_seq",kind:"S"}];
      if(query.includes("task4:untouched-sequence"))return [{last_value:"1",is_called:false}];
      return query.includes('"runs"')?[{row:{id:"fixture"}}]:[{row:{version:33}}];}};
    const observed=await observeTask4UntouchedV1(sql);assert.equal(observed.tables.length,2);assert.equal(observed.sequences.length,1);
    assert.equal(queries.length,4);assert.equal(queries.every(q=>!q.includes("WHERE id")&&!q.includes("LIMIT 1")),true);
    await assert.rejects(observeTask4UntouchedV1({async unsafe(){return [{name:"foreign_view",kind:"v"}];}}),{message:"TASK4_DATABASE_REFUSED"});
    await assert.rejects(observeTask4UntouchedV1({async unsafe(){return Array.from({length:4097},()=>({name:"runs",kind:"r"}));}}),{message:"TASK4_DATABASE_REFUSED"});
  });
  test("descriptor proof publication is canonical exclusive private stable and exact-reference bound",()=>{
    const root=fs.realpathSync(fs.mkdtempSync(path.join(tmpdir(),"task4-proof-test-")));fs.chmodSync(root,0o700);
    try {
      fs.mkdirSync(path.join(root,"parent"),{mode:0o700});fs.mkdirSync(path.join(root,"parent/artifacts"),{mode:0o700});
      const body={schema:"component-proof",value:1},ref=publishTask4ProofV1(root,"parent-result.json",body);
      assert.deepEqual(readTask4ProofV1(root,"parent-result.json",ref).value,body);
      assert.equal(ref.sha256,hashV1(task4CanonicalV1(body)+"\n"));assert.equal(fs.statSync(path.join(root,"parent-result.json")).mode&0o777,0o600);
      assert.throws(()=>publishTask4ProofV1(root,"parent-result.json",body),{message:"TASK4_RESULT_PUBLICATION_FAILED"});
      assert.throws(()=>readTask4ProofV1(root,"parent-result.json",{...ref,bytes:ref.bytes+1}),{message:"TASK4_INTEGRITY_FAILED"});
      const artifact=publishTask4ProofV1(root,"artifact",body);assert.deepEqual(readTask4ProofV1(root,"artifact",artifact).value,body);
      const target=path.join(root,"parent-result.json");fs.chmodSync(target,0o644);assert.throws(()=>readTask4ProofV1(root,"parent-result.json"));
      fs.chmodSync(target,0o600);fs.appendFileSync(target,"\n");assert.throws(()=>readTask4ProofV1(root,"parent-result.json"));
      fs.unlinkSync(target);fs.symlinkSync(path.join(root,"parent/artifacts",artifact.sha256+".json"),target);assert.throws(()=>readTask4ProofV1(root,"parent-result.json"));
    }finally{fs.rmSync(root,{recursive:true,force:true});}
  });
  test("descriptor parent catalog audit records ACL defaults and refuses executable application or security-definer reachability",async()=>{
    const role="mc_task4_"+"a".repeat(32),queries:string[]=[];
    const sql={async unsafe(query:string){queries.push(query);return [];}};
    const value=await observeTask4ParentCatalogV1(sql,role);assert.equal(value.defaultAcls.length,0);
    assert.equal(queries.some(q=>q.includes("pg_default_acl")),true);assert.equal(queries.some(q=>q.includes("aclexplode")),true);
    for(const branch of ["parent-routines","parent-definers","parent-owned","parent-memberships"]){
      await assert.rejects(observeTask4ParentCatalogV1({async unsafe(query){return query.includes(`task4:${branch}`)?[{execute:true}]:[];}},role),{message:"TASK4_DATABASE_REFUSED"});
    }
  });
  test("descriptor auxiliary transaction refuses preexisting targets before exact twelve statements and nine seeds",async()=>{
    const source=fs.readFileSync(fileURLToPath(new URL("../../src/installation/fresh-installation-mission-control-schema-v1.ts",import.meta.url)),"utf8");
    const calls:Array<{q:string;p:readonly unknown[]|undefined}>=[];
    await installTask4AuxiliaryV1({async unsafe(q,p){calls.push({q,p});return [];}},source);
    assert.equal(calls.length,23);assert.equal(calls.filter(c=>c.q.startsWith("CREATE ")).length,12);
    assert.equal(calls.filter(c=>c.q.startsWith("INSERT INTO public.prd_templates")).length,9);
    for(const occupied of ["relation","type"]){let writes=0;
      await assert.rejects(installTask4AuxiliaryV1({async unsafe(q){if(q.startsWith("CREATE")||q.startsWith("INSERT"))writes++;return q.includes(`task4:aux-${occupied}`)?[{name:"occupied"}]:[];}},source),{message:"TASK4_DATABASE_REFUSED"});
      assert.equal(writes,0);
    }
  });
  test("descriptor restricted role setup refuses foreign cluster inventory before any grant mutation",async()=>{
    const id="a".repeat(32),prefix="setfarm_p3_"+"b".repeat(24),database=prefix+"_clone_"+"c".repeat(12);
    const known=["postgres","template0","template1",prefix+"_template",prefix+"_primary",database];
    const exercise=async(foreign:boolean)=>{const writes:string[]=[];
      const sql={async unsafe(q:string){if(q.includes("task4:role-cluster"))return [...known,...(foreign?["unowned"]:[])].map(name=>({name,owned:true}));
        if(q.includes("task4:role-exists"))return [];if(q.includes("task4:role-database"))return [{name:database}];writes.push(q);return [];}};
      if(foreign)await assert.rejects(createTask4ReadRoleV1(sql,id,database,prefix,"d".repeat(64)),{message:"TASK4_DATABASE_REFUSED"});
      else await createTask4ReadRoleV1(sql,id,database,prefix,"d".repeat(64));return writes;};
    assert.equal((await exercise(true)).length,0);const writes=await exercise(false);
    assert.equal(writes.filter(q=>q.startsWith("GRANT SELECT ON TABLE")).length,24);
    assert.equal(writes.some(q=>q.includes("GRANT INSERT")||q.includes("GRANT EXECUTE")||q.includes("GRANT CREATE")),false);
    assert.equal(writes.some(q=>q.includes("log_min_error_statement = 'error'")),true);
  });
  test("descriptor inner envelope binds original close outcome current ready and complete reference inventory",()=>{
    const ready=JSON.parse(GOLDEN_READY_V1),owner={...ready.fixtureOwner,pid:41006,ppid:ready.fixtureOwner.pid};
    const exit={code:2,signal:null,exitObserved:true,closeObserved:true};
    const value={schema:"mission-control.render-smoke-inner-result.v1",executionId:ready.executionId,
      binding:{setupDescriptorHash:ready.setupDescriptorHash,readyDescriptorHash:hashV1(GOLDEN_READY_V1+"\n"),resourceRoot:ready.setup.resourceRoot,
        missionControl:ready.setup.missionControl.source,setfarm:ready.setup.setfarm.source,projection:ready.projection,
        database:{name:ready.database.name,role:ready.database.role,restrictedUrlHash:ready.database.restrictedUrlHash},fixture:ready.fixture,fixtureOwner:ready.fixtureOwner},
      owner,scenario:"pass",startedAt:"2026-10-19T09:01:00.000Z",finishedAt:"2026-10-19T09:01:01.000Z",outcome:"unknown",code:"TASK4_CLEANUP_UNKNOWN",integrity:"failed",
      observations:{before:null,after:null},render:null,cleanup:null,artifacts:{json:[],png:[],native:[],totalBytes:0},diagnostics:["TASK4_CLEANUP_UNKNOWN"]};
    assert.equal(validateTask4InnerEnvelopeV1(value,ready,owner,exit,"pass").outcome,"unknown");
    for(const mutate of [(v:any)=>{v.binding.database.restrictedUrl="forbidden";},(v:any)=>{v.binding.readyDescriptorHash="f".repeat(64);},
      (v:any)=>{v.owner.ppid++;},(v:any)=>{v.outcome="pass";v.code=null;v.integrity="verified";},(v:any)=>{v.artifacts.totalBytes=1;},
      (v:any)=>{v.diagnostics.push("arbitrary");},(v:any)=>{v.finishedAt="2026-10-19T09:00:00.000Z";}]) {
      const altered=structuredClone(value);mutate(altered);assert.throws(()=>validateTask4InnerEnvelopeV1(altered,ready,owner,exit,"pass"),{message:"TASK4_INTEGRITY_FAILED"});
    }
    for(const altered of [{...exit,closeObserved:false},{...exit,code:0},{...exit,signal:"SIGTERM"}])
      assert.throws(()=>validateTask4InnerEnvelopeV1(value,ready,owner,altered,"pass"),{message:"TASK4_INTEGRITY_FAILED"});
  });
  test("descriptor inner observations compare complete datasets and independently bound current pair",()=>{
    const ready=JSON.parse(GOLDEN_READY_V1),seed=task4SeedV1(ready.setup.setfarm.source.sourceSha),grants=task4GrantsV1(ready.database.name,ready.database.role);
    ready.fixture.seedDigest=hashV1(task4CanonicalV1(seed));ready.fixture.privilegeDigest=hashV1(task4CanonicalV1(grants));
    const pair={activationRef:"activation",activationHash:ready.fixture.manifestActivationHash,headRef:"head",headHash:ready.fixture.manifestHeadHash,admissionReadyHash:ready.fixture.admissionReadyHash};
    const value={schema:"mission-control.render-smoke-inner-observation.v1",executionId:ready.executionId,setupDescriptorHash:ready.setupDescriptorHash,
      readyDescriptorHash:hashV1(task4CanonicalV1(ready)+"\n"),phase:"before",observedAt:"2026-10-19T09:01:00.000Z",
      databaseIdentity:{database:ready.database.name,currentUser:ready.database.role,sessionUser:ready.database.role,host:"127.0.0.1",port:ready.setup.postgres.port,
        serverVersionNum:170010,serverStartedAt:ready.setup.postgres.serverStartedAt},seed,grants,currentPair:pair,
      syncState:{beforeHash:null,afterHash:null,ledger:{sha256:"a".repeat(64),bytes:1}}};
    validateTask4InnerObservationV1(value,ready,"before",pair);
    for(const mutate of [(v:any)=>{v.seed.runs[0].status="completed";},(v:any)=>{v.databaseIdentity.currentUser="postgres";},
      (v:any)=>{v.currentPair.headRef="foreign";},(v:any)=>{v.phase="after";},(v:any)=>{v.grants.settings.defaultTransactionReadOnly="off";},
      (v:any)=>{v.seed.emptyRelations[0].rows=[{foreign:true}];}]){
      const altered=structuredClone(value);mutate(altered);assert.throws(()=>validateTask4InnerObservationV1(altered,ready,"before",pair),{message:"TASK4_INTEGRITY_FAILED"});
    }
  });
  test("descriptor six-route render requires ordered actual geometry screenshots and both strict sealed responses",()=>{
    const ready=JSON.parse(GOLDEN_READY_V1),body=task4SeedV1(ready.setup.setfarm.source.sourceSha).productResponse;
    const product={status:200,bodyHash:"f".repeat(64),parsedHash:hashV1(task4CanonicalV1(body)),authorityHash:body.authorityHash,packetHash:body.packetAuthority.packetHash};
    const ref={sha256:"e".repeat(64),bytes:10};
    const render={schema:"mission-control.render-smoke-inner-render.v1",executionId:ready.executionId,setupDescriptorHash:ready.setupDescriptorHash,
      readyDescriptorHash:hashV1(task4CanonicalV1(ready)+"\n"),viewport:{width:1440,height:950},preflight:product,
      routes:TASK4_ROUTES_V1.map((route,i)=>({route,status:"pass",code:null,screenshot:{sha256:String(i+1).repeat(64),bytes:100},
        dom:{rootWidth:1440,rootHeight:950,textLength:40,visibleElements:2},productResponse:i===5?product:null})),network:ref,filesystem:ref,stop:{kind:"complete",afterRoute:TASK4_ROUTES_V1[5]}};
    validateTask4InnerRenderV1(render,ready,"pass");
    for(const change of [(v:any)=>{v.routes.reverse();},(v:any)=>{v.routes.pop();},(v:any)=>{v.routes[0].dom.textLength=39;},
      (v:any)=>{v.preflight.status=202;},(v:any)=>{v.routes[5].productResponse.authorityHash="a".repeat(64);},
      (v:any)=>{v.routes[0].screenshot=null;},(v:any)=>{v.network=null;},(v:any)=>{v.stop.kind="unknown";}]){
      const altered=structuredClone(render);change(altered);assert.throws(()=>validateTask4InnerRenderV1(altered,ready,"pass"),{message:"TASK4_INTEGRITY_FAILED"});
    }
  });
  test("descriptor parent private failure retains the actual catch cause without changing public outcomes",async()=>{
    const ts=await import("typescript"),source=fs.readFileSync(fileURLToPath(import.meta.url),"utf8"),ast=ts.createSourceFile("fixture.ts",source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);
    const fn=ast.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text==="runTask4OwnedFixtureV1") as import("typescript").FunctionDeclaration;
    const attempt=fn.body!.statements.find(n=>ts.isTryStatement(n)&&n.catchClause?.getText(ast).includes("TASK4_CODES_V1.includes")) as import("typescript").TryStatement;
    const detail=ast.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text==="task4FailureDetailV1");
    const declarations=ast.statements.filter(n=>ts.isVariableStatement(n)&&n.declarationList.declarations.some(d=>["TASK4_FAILURE_STAGES_V1","TASK4_FAILURE_PREDICATES_V1"].includes(d.name.getText(ast))));
    const prelude=declarations.map(n=>n.getText(ast)).join("\n")+(detail?detail.getText(ast):"");
    const js=ts.transpileModule(prelude+';let failed=false,code="",firstFailure=prior;'+attempt.catchClause!.block.getText(ast)+';return {failed,code,firstFailure};',{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
    const run=(error:unknown,prior:unknown=null,stage="pg_parse",predicate="parse_candidate_unique")=>new Function("error","prior","stage","predicate","TASK4_CODES_V1","freezeV1",js)(error,prior,stage,predicate,TASK4_CODES_V1,freezeV1);
    const sql=run(new Error("TASK4_SQL_ORIGINALS_UNKNOWN"));assert.equal(sql.code,"TASK4_INTEGRITY_FAILED");assert.equal(sql.failed,true);
    assert.deepEqual(sql.firstFailure,{stage:"pg_parse",predicate:"parse_candidate_unique",cause:"TASK4_SQL_ORIGINALS_UNKNOWN"});assert.equal(Object.isFrozen(sql.firstFailure),true);
    for(const stage of ["initial_backend_census","after_probes","final_backend_census"])assert.deepEqual(run(new Error("TASK4_SQL_ORIGINALS_UNKNOWN"),null,stage,"census_lsof").firstFailure,{stage,predicate:"census_lsof",cause:"TASK4_SQL_ORIGINALS_UNKNOWN"});
    const unknown=run(new Error("postgres://secret@private SELECT password"));assert.deepEqual(unknown.firstFailure,{stage:"pg_parse",predicate:"parse_candidate_unique",cause:"UNCLASSIFIED"});
    assert.doesNotMatch(JSON.stringify(unknown),/secret|password|postgres:/);
    const first=sql.firstFailure;assert.equal(run(new Error("TASK4_DATABASE_REFUSED"),first).firstFailure,first);assert.equal(run(new Error("TASK4_DATABASE_REFUSED")).code,"TASK4_DATABASE_REFUSED");
  });
  test("descriptor private parser predicate identifies original refusal without changing error",()=>{
    const diagnostic={stage:"pg_parse",predicate:"none"};
    assert.throws(()=>Reflect.apply(parseTask4PgLogV1,null,[Buffer.from("not-a-pg-frame\n"),"a".repeat(32),"setfarm_p3_"+"b".repeat(24)+"_clone_"+"c".repeat(12),[],[],diagnostic]),{message:"TASK4_SQL_ORIGINALS_UNKNOWN"});
    assert.equal(diagnostic.predicate,"parse_continuation");
  });
  test("descriptor parent private diagnostic is exclusive canonical private and absent on success",async()=>{
    const ts=await import("typescript"),source=fs.readFileSync(fileURLToPath(import.meta.url),"utf8"),start=source.indexOf('    readers.pending=readers.opened-readers.closed;'),end=source.indexOf('    try {if(ready&&projection&&fixture)',start);
    assert.ok(start>0&&end>start);const js=ts.transpileModule(source.slice(start,end),{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
    const root=fs.realpathSync(fs.mkdtempSync(path.join(tmpdir(),"task4-private-diagnostic-")));fs.chmodSync(root,0o700);
    fs.mkdirSync(path.join(root,"parent/originals"),{recursive:true,mode:0o700});const file=path.join(root,"parent/originals/parent-failure.json"),id="a".repeat(32);
    const first=task4FailureDetailV1("pg_parse","parse_candidate_unique",new Error("TASK4_SQL_ORIGINALS_UNKNOWN")),watcher=task4FailureDetailV1("backend_census","census_socket_unique",new Error("TASK4_SQL_ORIGINALS_UNKNOWN"));
    let finalized=0;const invoke=(failure:Task4FailureDetailV1|null)=>{try{new Function("readers","firstFailure","publishTask4ParentFailureV1","root","id","watcherFailure","publishTask4BackendFailureV1","backendFailure",js)({opened:5,closed:4,pending:0},failure,publishTask4ParentFailureV1,root,id,watcher,publishTask4BackendFailureV1,null);}finally{finalized++;}};
    try {
      invoke(null);assert.equal(fs.existsSync(file),false);invoke(first);assert.equal(finalized,2);
      const bytes=fs.readFileSync(file),value=JSON.parse(bytes.toString());assert.equal(bytes.toString(),task4CanonicalV1(value)+"\n");assert.ok(bytes.length<=2048);
      assert.deepEqual(value,{schema:"setfarm.task4-parent-failure.v1",executionId:id,...first,watcherFailure:watcher});
      const stat=fs.lstatSync(file);assert.equal(stat.mode&0o777,0o600);assert.equal(stat.nlink,1);assert.equal(stat.uid,process.getuid!());
      invoke(task4FailureDetailV1("after_audit_equal","audit_equal",new Error("TASK4_DATABASE_REFUSED")));assert.equal(finalized,3);assert.deepEqual(fs.readFileSync(file),bytes);
      const absent=path.join(root,"missing");assert.doesNotThrow(()=>publishTask4ParentFailureV1(absent,id,first,watcher));assert.equal(fs.existsSync(absent),false);
    }finally{fs.rmSync(root,{recursive:true,force:true});}
  });
  test("descriptor parent watcher retains its first actual bounded census predicate",async()=>{
    const ts=await import("typescript"),source=fs.readFileSync(fileURLToPath(import.meta.url),"utf8"),ast=ts.createSourceFile("fixture.ts",source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);
    let census:import("typescript").VariableDeclaration|undefined,watcherCatch:import("typescript").CatchClause|undefined;
    const visit=(node:import("typescript").Node)=>{if(ts.isVariableDeclaration(node)&&node.name.getText(ast)==="observeBackends")census=node;
      if(ts.isCatchClause(node)&&node.getText(ast).includes('watcherFailure??='))watcherCatch=node;ts.forEachChild(node,visit);};visit(ast);assert.ok(census&&watcherCatch);
    const body='const diagnostic={predicate:"none"};const '+census!.getText(ast)+';return observeBackends(diagnostic).then(()=>null,error=>({error,predicate:diagnostic.predicate}));';
    const js=ts.transpileModule(body,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
    const outcome=await new Function("ready","admin","setup","requireV1","spawnSync","censuses",js)({database:{role:"component",name:"component"}}, {unsafe:async()=>[]},{postgres:{port:15432}},requireV1,()=>({error:undefined,signal:null,status:1,stderr:""}),[]);
    assert.equal(outcome.error.message,"TASK4_SQL_ORIGINALS_UNKNOWN");assert.equal(outcome.predicate,"census_lsof");
    const catchJs=ts.transpileModule(watcherCatch!.block.getText(ast),{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
    const retain=new Function("task4FailureDetailV1","first","second",'let watcherFailure=null,backendFailure=null,backendFailureLatched=false,watchFailure=false,stopWatcher=false;const diagnostic={predicate:"census_lsof"};let error=first;'+catchJs+';const retained=watcherFailure;diagnostic.predicate="census_socket_unique";error=second;'+catchJs+';return {retained,watcherFailure,watchFailure,stopWatcher};');
    const state=retain(task4FailureDetailV1,outcome.error,new Error("postgres://private"));assert.equal(state.retained,state.watcherFailure);assert.equal(Object.isFrozen(state.watcherFailure),true);
    assert.deepEqual(state.watcherFailure,{stage:"backend_census",predicate:"census_lsof",cause:"TASK4_SQL_ORIGINALS_UNKNOWN"});assert.equal(state.watchFailure,true);assert.equal(state.stopWatcher,true);
  });
  test("descriptor owned parent TIME_WAIT remains nonbinding through actual census",async()=>{
    // Exact pass10 decoded lsof input; no live SQL/process inspection in this component.
    const raw="p28897\nf5\nn127.0.0.1:56086\nTST=LISTEN\nTQR=0\nTQS=0\np35643\nf46\nn127.0.0.1:57190->127.0.0.1:56086\nTST=TIME_WAIT\nTQR=0\nTQS=0\nf47\nn127.0.0.1:56555->127.0.0.1:56086\nTST=ESTABLISHED\nTQR=0\nTQS=0\nf48\nn127.0.0.1:56557->127.0.0.1:56086\nTST=ESTABLISHED\nTQR=0\nTQS=0\nf49\nn127.0.0.1:56659->127.0.0.1:56086\nTST=ESTABLISHED\nTQR=0\nTQS=0\np37465\nf9\nn127.0.0.1:56086->127.0.0.1:56555\nTST=ESTABLISHED\nTQR=0\nTQS=0\np37527\nf9\nn127.0.0.1:56086->127.0.0.1:56557\nTST=ESTABLISHED\nTQR=0\nTQS=0\np41051\nf9\nn127.0.0.1:56086->127.0.0.1:56659\nTST=ESTABLISHED\nTQR=0\nTQS=0\n";
    assert.equal(Buffer.byteLength(raw),535);assert.equal(hashV1(raw),"adec7ea4744b9486a90fe0e9f1d57e0d7f2fd48e33763866b251babf692e833a");
    const ts=await import("typescript"),source=fs.readFileSync(fileURLToPath(import.meta.url),"utf8"),ast=ts.createSourceFile("fixture.ts",source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);
    let census:import("typescript").VariableDeclaration|undefined;
    const visit=(n:import("typescript").Node)=>{if(ts.isVariableDeclaration(n)&&n.name.getText(ast)==="observeBackends")census=n;ts.forEachChild(n,visit);};visit(ast);assert.ok(census);
    const js=ts.transpileModule('const '+census!.getText(ast)+';return observeBackends(diagnostic);',{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
    const ready=JSON.parse(GOLDEN_READY_V1),owner={...ready.fixtureOwner,pid:35643},setup={...ready.setup,postgres:{...ready.setup.postgres,port:56086}};
    const rows=[56555,56557].map((port,i)=>({pid:[37465,37527][i],startedAt:"2026-10-19T17:49:41.894590Z",role:ready.database.role,database:ready.database.name,
      applicationName:(i===0?"task4_observer_":"task4_probe_")+ready.executionId,host:"127.0.0.1",port}));
    const run=async(input=raw,selected:any[]=rows,current:any=owner)=>{
      const censuses:any[]=[],backends=new Map(),seen:number[]=[],diagnostic={predicate:"none"};
      const ports={ready,admin:{unsafe:async()=>selected},setup,context:{owner},id:ready.executionId,innerOwner:null,serverOwner:null,
        requireV1,integerV1,sameV1,freezeV1,parseTask4SocketsV1,bindTask4BackendV1,task4BackendFailureSnapshotV1,hashV1,path,
        censuses,backends,diagnostic,spawnSync:()=>({error:undefined,signal:null,status:0,stderr:"",stdout:input}),
        observeTask4ProcessV1:(pid:number)=>{seen.push(pid);if(current===null)throw new Error("TASK4_SOURCE_DRIFT");return {pin:current};}};
      await new Function(...Object.keys(ports),js)(...Object.values(ports));return {censuses,backends,seen};
    };
    const result=await run();assert.equal(result.backends.size,2);assert.deepEqual(result.seen,[35643]);
    assert.deepEqual(result.censuses[0].sockets,[{pid:35643,port:56555},{pid:35643,port:56557},{pid:35643,port:56659}]);
    assert.deepEqual(result.censuses[0].parentTimeWait,{owner,sockets:[{pid:35643,port:57190,state:"TIME_WAIT",endpointLine:9}]});
    assert.equal(result.censuses[0].stdoutHash,hashV1(raw));assert.throws(()=>parseTask4SocketsV1(raw,56086),{message:"TASK4_SQL_ORIGINALS_UNKNOWN"});
    for(const field of ["pid","ppid","pgid","uid","startedAt","executable","executableHash","commandHash"]){
      const drift={...owner,[field]:typeof owner[field]==="number"?owner[field]+1:owner[field]+"x"};await assert.rejects(run(raw,rows,drift),{message:"TASK4_SQL_ORIGINALS_UNKNOWN"});}
    await assert.rejects(run(raw,rows,null),{message:"TASK4_SOURCE_DRIFT"});
    const negatives=[raw.replace("TIME_WAIT","CLOSE_WAIT"),raw.replace("TIME_WAIT","SYN_SENT"),raw.replace("TIME_WAIT","UNKNOWN"),raw.replace("p35643\n","p35644\n"),
      raw.replace("57190","56555"),raw+"p35643\nf50\nn127.0.0.1:57190->127.0.0.1:56086\nTST=TIME_WAIT\n",
      raw+"p35643\nf50\nn127.0.0.1:57190->127.0.0.1:56086\nTST=ESTABLISHED\n",
      raw+"p35644\nf50\nn127.0.0.1:57190->127.0.0.1:56086\nTST=ESTABLISHED\n",
      raw.replace("127.0.0.1:57190","127.0.0.2:57190")];
    for(const input of negatives)await assert.rejects(run(input),{message:"TASK4_SQL_ORIGINALS_UNKNOWN"});
    for(const port of [57190,"56555",0,65536,1.5,NaN])await assert.rejects(run(raw,[{...rows[0],port}]),{message:"TASK4_SQL_ORIGINALS_UNKNOWN"});
    const extra=(n:number)=>Array.from({length:n},(_,i)=>"p35643\nf"+(100+i)+"\nn127.0.0.1:"+(58000+i)+"->127.0.0.1:56086\nTST=TIME_WAIT\n").join("");
    assert.equal((await run(raw+extra(60))).censuses[0].parentTimeWait.sockets.length,61);
    await assert.rejects(run(raw+extra(61)),{message:"TASK4_SQL_ORIGINALS_UNKNOWN"});
    // Retired sockets alone cannot satisfy a selected live-row join.
    await assert.rejects(run(raw.replace("56555","56556")),{message:"TASK4_SQL_ORIGINALS_UNKNOWN"});
  });
  test("descriptor socket parser retains exact original line predicates without widening acceptance",()=>{
    const port=15432,prefix="p41\n\nf3u\nn127.0.0.1:49152->127.0.0.1:15432\n";
    const cases=[
      {text:prefix+"TST=SYN_SENT\n",predicate:"client_established",line:6,endpointLine:4},
      {text:"p41\nf3u\nn127.0.0.2:49152->127.0.0.1:15432\nTST=ESTABLISHED\n",predicate:"endpoint_shape",line:5,endpointLine:3},
      {text:"p41\n\nxunexpected\n",predicate:"field_tag",line:3,endpointLine:0},
      {text:prefix+"TST=ESTABLISHED\nTST=ESTABLISHED\n",predicate:"state_duplicate",line:6,endpointLine:4},
      {text:"p41",predicate:"input_size_or_termination",line:0,endpointLine:0},
    ];
    for(const row of cases){const diagnostic={predicate:"none",line:0,endpointLine:0};
      assert.throws(()=>Reflect.apply(parseTask4SocketsV1,null,[row.text,port,diagnostic]),{message:"TASK4_SQL_ORIGINALS_UNKNOWN"});
      assert.deepEqual(diagnostic,{predicate:row.predicate,line:row.line,endpointLine:row.endpointLine});}
    assert.deepEqual(parseTask4SocketsV1(prefix+"TST=ESTABLISHED\n",port),[{pid:41,port:49152}]);
  });
  test("descriptor socket failure snapshot redacts unsafe rows and publishes only private first failure",async()=>{
    const ready=JSON.parse(GOLDEN_READY_V1),parser={predicate:"field_tag",line:1,endpointLine:0},raw={error:undefined,status:0,signal:null,stderr:"",stdout:"xunknown\n"},at="2026-10-19T10:00:00.000Z";
    const secret="postgres://private:credential@unowned SELECT secret",row={pid:NaN,startedAt:secret,role:secret,database:secret,applicationName:secret,host:secret,port:secret};
    const make=(rows:any=[row],input:any=raw)=>task4BackendFailureSnapshotV1(ready.setup,ready,ready.fixtureOwner,"watcher",at,rows,input,parser);
    const record=make();assert.ok(record);assert.deepEqual(Object.keys(record).sort(),"schema executionId fixtureOwner origin invocationStartedAt observedAt postgresPort parser rows original".split(" ").sort());
    for(const value of Object.values(record.rows[0]) as any[]){assert.equal(value.valid,false);assert.equal(value.value,null);}
    assert.equal(record.rows[0].pid.sha256,null);assert.equal(record.rows[0].applicationName.sha256,hashV1(task4CanonicalV1(secret)));
    assert.doesNotMatch(task4CanonicalV1(record),/credential|SELECT|postgres:|restrictedUrl/);assert.equal(Object.isFrozen(record.rows[0].applicationName),true);
    assert.equal(make([null]),null);assert.equal(make(Array(65).fill(row)),null);assert.equal(make([], {...raw,stdout:"x".repeat(1048577)}),null);
    assert.equal(make([], {...raw,stderr:secret}),null);assert.equal(make([], {...raw,get stdout(){throw new Error(secret);}}),null);
    const largest=make([], {...raw,stdout:"x".repeat(1048576)});assert.ok(largest);assert.ok(Buffer.byteLength(task4BackendFailureCanonicalV1(largest)+"\n")<=2097152);
    const ts=await import("typescript"),source=fs.readFileSync(fileURLToPath(import.meta.url),"utf8"),start=source.indexOf('    readers.pending=readers.opened-readers.closed;'),end=source.indexOf('    try {if(ready&&projection&&fixture)',start);
    assert.ok(start>0&&end>start);const js=ts.transpileModule(source.slice(start,end),{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
    const root=fs.realpathSync(fs.mkdtempSync(path.join(tmpdir(),"task4-census-diagnostic-")));fs.chmodSync(root,0o700);fs.mkdirSync(path.join(root,"parent/originals"),{recursive:true,mode:0o700});
    const file=path.join(root,"parent/originals/backend-census-failure.json"),first=task4FailureDetailV1("watcher_success","watcher_success",new Error("TASK4_SQL_ORIGINALS_UNKNOWN"));let finalized=0;
    const invoke=(failure:Task4FailureDetailV1|null)=>{try{new Function("readers","firstFailure","publishTask4ParentFailureV1","root","id","watcherFailure","publishTask4BackendFailureV1","backendFailure",js)(
      {opened:5,closed:4,pending:0},failure,publishTask4ParentFailureV1,root,ready.executionId,first,publishTask4BackendFailureV1,record);}finally{finalized++;}};
    try {
      publishTask4BackendFailureV1(root,{...record,padding:"x".repeat(2097152)});assert.equal(fs.existsSync(file),false);
      invoke(null);assert.equal(fs.existsSync(file),false);invoke(first);assert.equal(finalized,2);
      const bytes=fs.readFileSync(file);assert.equal(bytes.toString(),task4CanonicalV1(record)+"\n");assert.ok(bytes.length<=2097152);
      const stat=fs.lstatSync(file);assert.equal(stat.mode&0o777,0o600);assert.equal(stat.nlink,1);assert.equal(stat.uid,process.getuid!());
      publishTask4BackendFailureV1(root,{...record,origin:"main"});assert.deepEqual(fs.readFileSync(file),bytes);
      assert.doesNotThrow(()=>publishTask4BackendFailureV1(path.join(root,"missing"),record));assert.equal(fs.existsSync(path.join(root,"missing")),false);
      const original=new Error("TASK4_SQL_ORIGINALS_UNKNOWN");let caught:unknown;try{try{throw original;}finally{invoke(first);}}catch(error){caught=error;}
      assert.equal(caught,original);assert.equal(finalized,3);assert.deepEqual(fs.readFileSync(file),bytes);
    }finally{fs.rmSync(root,{recursive:true,force:true});}
  });
  test("descriptor failed socket census retains its original input across overlapping main and watcher calls",async(t)=>{
    const ts=await import("typescript"),source=fs.readFileSync(fileURLToPath(import.meta.url),"utf8"),ast=ts.createSourceFile("fixture.ts",source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);
    const fn=ast.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text==="runTask4OwnedFixtureV1") as import("typescript").FunctionDeclaration;
    const snapshot=ast.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text==="task4BackendFailureSnapshotV1");
    const declarations=new Map<string,string>();let watcher:import("typescript").BinaryExpression|undefined;
    const visit=(node:import("typescript").Node)=>{if(ts.isVariableDeclaration(node)&&["observeBackends","observeMainBackends"].includes(node.name.getText(ast)))declarations.set(node.name.getText(ast),node.getText(ast));
      if(ts.isBinaryExpression(node)&&node.left.getText(ast)==="watcher"&&node.right.getText(ast).includes("while(!stopWatcher)"))watcher=node;ts.forEachChild(node,visit);};visit(fn);
    assert.equal(declarations.size,2);assert.ok(watcher);
    const formatter=ast.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text==="task4BackendFailureCanonicalV1");
    const body=(formatter?formatter.getText(ast):"")+(snapshot?snapshot.getText(ast):"")+';return (async()=>{let predicate="none",watcher=null,watcherFailure=null,backendFailure=null,backendFailureLatched=false,watchFailure=false,stopWatcher=false;'+
      'const setTimeout=(resolve)=>{stopWatcher=true;resolve();};const '+declarations.get("observeBackends")+';const '+declarations.get("observeMainBackends")+';'+
      watcher!.getText(ast)+';const other=observeMainBackends().then(()=>null,error=>error);release();const error=await other;await watcher;return {error,backendFailure,watcherFailure};})();';
    const js=ts.transpileModule(body,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
    for(const mode of ["watcher","main","both","construction_throw","first_construction_throw","first_malformed_row"])await t.test(mode,async()=>{
      const ready=JSON.parse(GOLDEN_READY_V1),pending:Array<(rows:unknown[])=>void>=[],originals:Error[]=[],raws:string[]=[],censuses:unknown[]=[];let calls=0,constructionThrows=0;
      const rows=[1,2].map(n=>({pid:400+n,startedAt:"2026-10-19T10:00:00.000001Z",role:ready.database.role,database:ready.database.name,applicationName:"task4_observer_"+ready.executionId,host:"127.0.0.1",port:49000+n}));
      const fails=(n:number)=>(mode==="both"||mode==="construction_throw"||mode==="first_construction_throw"||mode==="first_malformed_row")||n===(mode==="watcher"?1:2);
      const ports={ready,context:{owner:ready.fixtureOwner},admin:{unsafe:()=>new Promise(resolve=>pending.push(resolve))},setup:ready.setup,
        requireV1,integerV1,hexV1,processV1,timeV1,hashV1,task4CanonicalV1,TASK4_SOCKET_PREDICATES_V1,
        freezeV1:(value:unknown)=>{if((mode==="construction_throw"||(mode==="first_construction_throw"&&(value as any)?.origin==="watcher"))&&(value as any)?.schema==="setfarm.task4-backend-census-failure.v1"){constructionThrows++;throw new Error("private construction failure");}return freezeV1(value);},
        spawnSync:()=>{calls++;const stdout=fails(calls)?"p"+(40+calls)+"\n\nf3u\nn127.0.0.1:"+(49000+calls)+"->127.0.0.1:"+ready.setup.postgres.port+"\nTST=SYN_SENT\n":"";raws.push(stdout);return {error:undefined,signal:null,status:0,stderr:"",stdout};},
        parseTask4SocketsV1:(...args:unknown[])=>{try{return Reflect.apply(parseTask4SocketsV1,null,args);}catch(error){originals.push(error as Error);throw error;}},
        censuses,backends:new Map(),task4FailureDetailV1,release:()=>{assert.equal(pending.length,2);pending[0]!(fails(1)?[mode==="first_malformed_row"?null:rows[0]]:[]);pending[1]!(fails(2)?[rows[1]]:[]);}};
      const result=await new Function(...Object.keys(ports),js)(...Object.values(ports));
      assert.equal(calls,2);assert.equal(originals.length,fails(1)&&fails(2)?2:1);
      if(fails(2))assert.equal(result.error,originals.at(-1));else assert.equal(result.error,null);
      if(mode==="construction_throw"||mode==="first_construction_throw"||mode==="first_malformed_row"){if(mode!=="first_malformed_row")assert.equal(constructionThrows,mode==="construction_throw"?2:1);assert.equal(result.backendFailure,null);assert.equal(result.watcherFailure.cause,"TASK4_SQL_ORIGINALS_UNKNOWN");return;}
      assert.ok(result.backendFailure,"first original failed parser input must be retained");const record=result.backendFailure,index=mode==="main"?1:0;
      assert.equal(record.origin,mode==="main"?"main":"watcher");assert.deepEqual(record.parser,{predicate:"client_established",line:6,endpointLine:4});
      assert.equal(Buffer.from(record.original.stdoutBase64,"base64").toString("utf8"),raws[index]);assert.equal(record.original.stdoutHash,hashV1(raws[index]!));
      assert.equal(record.original.stdoutBytes,Buffer.byteLength(raws[index]!));assert.equal(record.original.status,0);assert.equal(record.original.signal,null);
      assert.equal(record.rows[0].pid.value,rows[index]!.pid);assert.equal(Object.isFrozen(record),true);assert.equal(Object.isFrozen(record.rows[0]),true);
      rows[index]!.pid=999;assert.notEqual(record.rows[0].pid.value,999);
    });
  });
  test("descriptor concurrent census rejection keeps its own original watcher and main predicate",async(t)=>{
    const ts=await import("typescript"),source=fs.readFileSync(fileURLToPath(import.meta.url),"utf8"),ast=ts.createSourceFile("fixture.ts",source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);
    const fn=ast.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text==="runTask4OwnedFixtureV1") as import("typescript").FunctionDeclaration;
    let census:import("typescript").VariableDeclaration|undefined,main:import("typescript").VariableDeclaration|undefined,watcher:import("typescript").BinaryExpression|undefined;
    const visit=(node:import("typescript").Node)=>{if(ts.isVariableDeclaration(node)&&node.name.getText(ast)==="observeBackends")census=node;
      if(ts.isVariableDeclaration(node)&&node.name.getText(ast)==="observeMainBackends")main=node;
      if(ts.isBinaryExpression(node)&&node.left.getText(ast)==="watcher"&&node.right.getText(ast).includes("while(!stopWatcher)"))watcher=node;
      ts.forEachChild(node,visit);};visit(fn);assert.ok(census&&watcher);
    // Execute the original census and watcher. Only SQL/OS ports and the timer are component inputs.
    const body='return (async()=>{let backendPredicate="none",predicate="none",watcher=null,watcherFailure=null,backendFailure=null,backendFailureLatched=false,watchFailure=false,stopWatcher=false;'+
      'const setTimeout=(resolve)=>{stopWatcher=true;resolve();};const '+census!.getText(ast)+';'+
      (main?'const '+main.getText(ast)+';':'const observeMainBackends=observeBackends;')+
      watcher!.getText(ast)+';const second=observeMainBackends().then(()=>({error:null,predicate}),error=>({error,predicate}));'+
      'release();const result=await second;await watcher;return {result,watcherFailure,watchFailure,stopWatcher};})();';
    const js=ts.transpileModule(body,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
    for(const failingCall of [1,2])await t.test(failingCall===1?"watcher rejects while main completes":"main rejects while watcher completes",async()=>{
      const pending:Array<(rows:unknown[])=>void>=[],censuses:unknown[]=[],original=new Error("TASK4_SQL_ORIGINALS_UNKNOWN"),trace:string[]=[];let calls=0,retainedError:unknown=null;
      const ports={context:{owner:{pid:41}},ready:{database:{role:"component",name:"component"}},admin:{unsafe:()=>new Promise(resolve=>pending.push(resolve))},setup:{postgres:{port:15432}},
        requireV1:(ok:unknown)=>{if(!ok)throw original;},spawnSync:()=>{calls++;trace.push("census_"+calls);return {error:undefined,signal:null,status:calls===failingCall?1:0,stderr:"",stdout:""};},
        censuses,parseTask4SocketsV1:()=>[],backends:new Map(),hashV1,
        task4FailureDetailV1:(stage:string,predicate:string,error:unknown)=>{retainedError=error;trace.push("watcher_catch");return task4FailureDetailV1(stage,predicate,error);},
        release:()=>{assert.equal(pending.length,2);pending[0]!([]);pending[1]!([]);}};
      const state=await new Function(...Object.keys(ports),js)(...Object.values(ports));
      assert.equal(calls,2);assert.equal(censuses.length,1);
      if(failingCall===1){assert.deepEqual(trace,["census_1","census_2","watcher_catch"]);assert.equal(retainedError,original);
        assert.deepEqual(state.watcherFailure,{stage:"backend_census",predicate:"census_lsof",cause:"TASK4_SQL_ORIGINALS_UNKNOWN"});
        assert.equal(Object.isFrozen(state.watcherFailure),true);assert.equal(state.result.error,null);assert.equal(state.result.predicate,"none");assert.equal(state.watchFailure,true);
      }else{assert.equal(state.result.error,original);assert.equal(state.result.predicate,"census_lsof");assert.equal(state.watcherFailure,null);assert.equal(state.watchFailure,false);}
    });
  });
  test("descriptor parent envelope binds fixture owner and refuses incomplete cleanup or crossed evidence",()=>{
    const ready=JSON.parse(GOLDEN_READY_V1),ref={sha256:"a".repeat(64),bytes:100},innerOwner={...ready.fixtureOwner,pid:41006,ppid:ready.fixtureOwner.pid};
    const value={schema:"setfarm.task4-parent-result.v1",executionId:ready.executionId,setupDescriptorHash:ready.setupDescriptorHash,
      readyDescriptorHash:hashV1(GOLDEN_READY_V1+"\n"),fixtureOwner:ready.fixtureOwner,outcome:"pass",code:null,integrity:"verified",projection:ready.projection,
      database:{name:ready.database.name,role:ready.database.role},inner:{owner:innerOwner,exit:{code:0,signal:null,exitObserved:true,closeObserved:true},result:ref},
      evidence:{readinessBefore:ref,readinessAfter:ref,auditBefore:ref,auditAfter:ref,untouchedBefore:ref,untouchedAfter:ref,sqlLedger:ref},
      cleanup:{readers:{opened:8,closed:8,pending:0},databaseAbsent:true,roleAbsent:true}};
    validateTask4ParentEnvelopeV1(value,ready.setup,ready.fixtureOwner);
    for(const change of [(v:any)=>{v.cleanup.databaseAbsent=null;},(v:any)=>{v.cleanup.readers.pending=1;},(v:any)=>{v.inner.exit.closeObserved=false;},
      (v:any)=>{v.inner.exit.code=1;},(v:any)=>{v.evidence.sqlLedger=null;},(v:any)=>{v.fixtureOwner.pid++;},(v:any)=>{v.database.url="forbidden";}]){
      const changed=structuredClone(value);change(changed);assert.throws(()=>validateTask4ParentEnvelopeV1(changed,ready.setup,ready.fixtureOwner),{message:"TASK4_INTEGRITY_FAILED"});
    }
  });
  test("descriptor runner envelope requires both original children close and exact parent exit mapping",()=>{
    const ready=JSON.parse(GOLDEN_READY_V1),owner={...ready.fixtureOwner,pid:41004,ppid:ready.setup.owner.pid},ref={sha256:"a".repeat(64),bytes:100};
    const child=(role:string,pid:number)=>({role,owner:{...owner,pid,ppid:owner.pid},exit:{code:0,signal:null,exitObserved:true,closeObserved:true},fd3:"finished",fd4:role==="test"?"finished":"not_applicable"});
    const parent={outcome:"pass",fixtureOwner:child("test",41005).owner,projection:ready.projection};
    const value={schema:"setfarm.task4-runner-result.v1",executionId:ready.executionId,setupDescriptorHash:ready.setupDescriptorHash,owner,outcome:"pass",code:null,
      children:[child("setup",41003),child("test",41005)],parentResult:ref,projection:{root:ready.projection.root,projectedHead:ready.projection.projectedHead},cleanup:{databasesAbsent:true,projectionAbsent:true}};
    validateTask4RunnerEnvelopeV1(value,ready.setup,owner,parent,ref);
    for(const change of [(v:any)=>{v.children[1].exit.closeObserved=false;},(v:any)=>{v.children[0].fd4="finished";},(v:any)=>{v.cleanup.databasesAbsent=null;},
      (v:any)=>{v.children[1].exit.code=1;},(v:any)=>{v.parentResult.sha256="b".repeat(64);},(v:any)=>{v.children.reverse();}]){
      const changed=structuredClone(value);change(changed);assert.throws(()=>validateTask4RunnerEnvelopeV1(changed,ready.setup,owner,parent,ref),{message:"TASK4_INTEGRITY_FAILED"});
    }
  });
  test("descriptor probes preserve first SQLSTATE and independent rollback instead of accepting readonly or cleanup failures",async()=>{
    const probe=task4ProbesV1("a".repeat(32))[0]!;
    for(const state of ["42501","25006",null])for(const rollbackFails of [false,true]){
      const calls:string[]=[];const value=await executeTask4ProbeV1({async unsafe(q){calls.push(q);
        if(q.includes("task4:probe-identity"))return [{pid:123,started_at:"2026-10-19T10:00:00.123456Z"}];
        if(q===probe.statement&&state)throw Object.assign(new Error("private"),{code:state});
        if(q==="ROLLBACK"&&rollbackFails)throw new Error("private cleanup");return [];}},probe);
      assert.equal(value.sqlstate,state);assert.equal(value.rollbackObserved,!rollbackFails);
      assert.deepEqual(calls.slice(1),["BEGIN READ WRITE",probe.statement,"ROLLBACK"]);
    }
    let statement=false;await assert.rejects(executeTask4ProbeV1({async unsafe(q){if(q.includes("task4:probe-identity"))return [{pid:123,started_at:"2026-10-19T10:00:00.123456Z"}];
      if(q==="BEGIN READ WRITE")throw Object.assign(new Error("denied"),{code:"42501"});if(q===probe.statement)statement=true;return [];}},probe),{message:"TASK4_DATABASE_REFUSED"});
    assert.equal(statement,false);
  });
  test("descriptor runner preserves resources before every uncertain settlement and cleans only definite bound closure",async(t)=>{
    const ts=await import("typescript"),source=fs.readFileSync(new URL("../../scripts/run-isolated-postgres-tests.ts",import.meta.url),"utf8");
    const ast=ts.createSourceFile("runner.ts",source,ts.ScriptTarget.Latest,true);
    const main=ast.statements.find((s):s is import("typescript").FunctionDeclaration=>ts.isFunctionDeclaration(s)&&s.name?.text==="main")!;
    const outer=main.body!.statements.find(s=>ts.isTryStatement(s)) as import("typescript").TryStatement;
    const block=outer.finallyBlock!.getText(ast);
    const js=ts.transpileModule("async function run()"+block+"; return run();",{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText;
    const ready=JSON.parse(GOLDEN_READY_V1),ref={sha256:"a".repeat(64),bytes:100};
    const runnerOwner={...ready.fixtureOwner,pid:ready.fixtureOwner.ppid,ppid:ready.setup.owner.pid};
    const make=()=>({schema:"setfarm.task4-parent-result.v1",executionId:ready.executionId,setupDescriptorHash:ready.setupDescriptorHash,
      readyDescriptorHash:hashV1(GOLDEN_READY_V1+"\n"),fixtureOwner:ready.fixtureOwner,outcome:"pass",code:null as string|null,integrity:"verified",projection:structuredClone(ready.projection),
      database:{name:ready.database.name,role:ready.database.role},inner:{owner:{...ready.fixtureOwner,pid:41006,ppid:ready.fixtureOwner.pid},exit:{code:0,signal:null,exitObserved:true,closeObserved:true},result:ref},
      evidence:{readinessBefore:ref,readinessAfter:ref,auditBefore:ref,auditAfter:ref,untouchedBefore:ref,untouchedAfter:ref,sqlLedger:ref},
      cleanup:{readers:{opened:8,closed:8,pending:0},databaseAbsent:true as boolean|null,roleAbsent:true}});
    for(const mode of ["missing","malformed","unknown","unclosed","drift","child_unclosed","child_mismatch","inner_missing","inner_drift","database_cleanup_rejected","database_remaining","pass","fail","cancelled"]){
      await t.test(mode,async()=>{
      const parent=make(),children=[{role:"setup",owner:{...runnerOwner,pid:41003,ppid:runnerOwner.pid},exit:{code:0,signal:null,exitObserved:true,closeObserved:true},fd3:"finished",fd4:"not_applicable"},
        {role:"test",owner:ready.fixtureOwner,exit:{code:0,signal:null,exitObserved:true,closeObserved:true},fd3:"finished",fd4:"finished"}];
      if(mode==="unknown"){parent.outcome="unknown";parent.code="TASK4_CLEANUP_UNKNOWN";parent.cleanup.databaseAbsent=null;}
      if(mode==="unclosed")parent.inner.exit.closeObserved=false;
      if(mode==="drift")parent.projection.projectedHead="f".repeat(40);
      if(mode==="child_unclosed")children[1]!.exit.closeObserved=false;
      if(mode==="child_mismatch")children[1]!.exit.code=1;
      if(mode==="fail"||mode==="cancelled"){parent.outcome=mode;parent.code=mode==="fail"?"TASK4_ASSERTION_FAILED":"TASK4_CANCELLED";parent.inner.exit.code=mode==="fail"?1:130;children[1]!.exit.code=1;}
      let sqlEffects=0,fsEffects=0,published:any=null;
      const deps={task4Setup:ready.setup,task4Context:{owner:runnerOwner,check(){},close(){}},task4Children:children,task4BodyFailed:false,
        projection:{root:ready.projection.root.path,head:ready.projection.projectedHead},prefix:ready.projection.runDatabasePrefix,adminUrl:"private-not-used",path,
        pinTask4DirectoryV1:()=>({value:ready.projection.root,check(){},close(){}}),
        readTask4ProofV1:(_root:string,name:string)=>{if(mode==="missing"||(mode==="inner_missing"&&name==="inner-result.json"))throw Error("missing");
          if(name==="inner-result.json")return {value:{outcome:parent.outcome,integrity:"verified",owner:parent.inner.owner,
            binding:{setupDescriptorHash:parent.setupDescriptorHash,readyDescriptorHash:mode==="inner_drift"?"0".repeat(64):parent.readyDescriptorHash}},ref};
          return {value:mode==="malformed"?{}:parent,ref};},
        validateTask4ParentEnvelopeV1,validateTask4RunnerEnvelopeV1,task4CanonicalV1,sha256:hashV1,
        cleanupDatabasesV1:async()=>{sqlEffects++;if(mode==="database_cleanup_rejected")throw Error("cleanup refused");},
        postgres:()=>({unsafe:async()=>mode==="database_remaining"?[{datname:"owned-remaining"}]:[],end:async()=>{}}),
        rmSync:()=>{fsEffects++;},lstatSync:()=>{throw Object.assign(Error("absent"),{code:"ENOENT"});},
        publishTask4ProofV1:(_root:string,_name:string,v:any)=>{published=v;},process:{exitCode:0,stderr:{write(){}}}};
      await new Function(...Object.keys(deps),js)(...Object.values(deps));
      const definite=["pass","fail","cancelled"].includes(mode);
      const cleanupAdmitted=definite||mode==="database_cleanup_rejected"||mode==="database_remaining";
      assert.equal(sqlEffects,cleanupAdmitted?1:0,mode+": administrative cleanup");assert.equal(fsEffects,definite?1:0,mode+": projection cleanup");
      assert.equal(published.outcome,definite?mode:"unknown",mode);
      assert.deepEqual(published.cleanup,{databasesAbsent:definite?true:mode==="database_remaining"?false:null,projectionAbsent:definite?true:null});
      });
    }
  });
  test("descriptor PG originals retain byte offsets exact query identity and first error without exposing raw messages",()=>{
    const id="a".repeat(32),db="setfarm_p3_"+"b".repeat(24)+"_clone_"+"c".repeat(12),role="mc_task4_"+id;
    const prefix=(state:string)=>`2026-10-19 10:00:00.000 UTC|123|68f4a9c0.7b|${role}|${db}|task4_mc_${id}|${state}| `;
    const sql="SELECT COUNT(*)::int AS count FROM runs";
    const first=prefix("00000")+"LOG:  execute named: "+sql+"\n";
    const second=prefix("42501")+"ERROR:  private message must not escape\n";
    const third=prefix("42501")+"STATEMENT:  "+sql+"\n";
    const rows=parseTask4PgLogV1(Buffer.from(first+second+third),id,db);
    assert.equal(rows.length,3);assert.equal(rows[0]!.queryId,"mc_Q31");assert.equal(rows[0]!.statementHash,hashV1(sql));
    assert.equal(rows[1]!.sqlstate,"42501");assert.equal(rows[1]!.queryId,"mc_Q31");assert.equal(rows[2]!.offset,Buffer.byteLength(first+second));
    assert.equal(JSON.stringify(rows).includes("private message"),false);
    const unknown=parseTask4PgLogV1(Buffer.from(prefix("00000")+"LOG:  statement: SELECT 1; DELETE FROM runs\n"),id,db);
    assert.equal(unknown[0]!.queryId,"unknown");
    assert.throws(()=>parseTask4PgLogV1(Buffer.from(first.replace(db,"foreign")),id,db),{message:"TASK4_SQL_ORIGINALS_UNKNOWN"});
    assert.throws(()=>parseTask4PgLogV1(Buffer.from(first.trimEnd()),id,db),{message:"TASK4_SQL_ORIGINALS_UNKNOWN"});
  });
  // Rehash every changed leaf and its dependent references, so port negatives reach semantic guards.
  function rewritePortGraph(rows:ReadonlyMap<string,Readonly<RecordV1>>,patch:(row:RecordV1)=>void){
    const rewritten=new Map<string,Readonly<RecordV1>>(),refs=new Map<string,RecordV1>();
    const remap=(v:any):any=>Array.isArray(v)?v.map(remap):v&&typeof v==="object"?
      Object.keys(v).sort().join(" ")==="bytes sha256"?(refs.get(v.sha256)??v):Object.fromEntries(Object.entries(v).map(([k,x])=>[k,remap(x)])):v;
    for(const [old,row] of rows){const changed=remap(structuredClone(row));patch(changed);const bytes=Buffer.from(task4CanonicalV1(changed)+"\n"),ref={sha256:hashV1(bytes),bytes:bytes.length};
      rewritten.set(ref.sha256,changed);refs.set(old,ref);}
    return {rows:rewritten,remap};
  }
  test("descriptor policy probe rejects the actual bound server port as denied canary",async()=>{
    const ts=await import("typescript"),source=fs.readFileSync(fileURLToPath(import.meta.url),"utf8"),ast=ts.createSourceFile("fixture.ts",source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);
    const fn=ast.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text==="validateTask4PolicyProbeV1") as import("typescript").FunctionDeclaration;
    const body=fn.body!.statements.find(ts.isTryStatement)!.tryBlock.statements;
    const guard=body.find(n=>ts.isExpressionStatement(n)&&n.getText(ast).startsWith("requireV1(deniedBefore.port==="))!;
    const check=new Function("requireV1","deniedBefore","deniedAfter","deniedClosed","before","ready","serverPort",guard.getText(ast));
    const ready=JSON.parse(GOLDEN_READY_V1),at="2026-10-19T10:00:00.000Z",canary={port:23903,at};
    check(requireV1,canary,canary,canary,{port:23456},ready,23901);
    for(const port of [23901,23456,ready.setup.postgres.port,3080,3333,5432,13081,18789]){
      const crossed={...canary,port};assert.throws(()=>check(requireV1,crossed,crossed,crossed,{port:23456},ready,23901));
    }
    assert.throws(()=>check(requireV1,canary,{...canary,port:23904},canary,{port:23456},ready,23901));
  });
  test("descriptor cleanup binds no-LF helper owner hash and original server listener closure",()=>{
    const ready=JSON.parse(GOLDEN_READY_V1),owner={...ready.fixtureOwner,pid:41006,ppid:ready.fixtureOwner.pid};
    const binding={executionId:ready.executionId,setupDescriptorHash:ready.setupDescriptorHash,readyDescriptorHash:hashV1(GOLDEN_READY_V1+"\n")};
    const ui={pid:owner.pid,processStartedAt:owner.startedAt,processGroupId:owner.pgid,source:"observed_os",executable:owner.executable,
      script:path.join(ready.setup.missionControl.source.root,"scripts/render-smoke.mjs"),commandHash:owner.commandHash};
    const rows=new Map<string,Readonly<RecordV1>>();const put=(v:RecordV1)=>{const bytes=Buffer.from(task4CanonicalV1(v)+"\n"),ref={sha256:hashV1(bytes),bytes:bytes.length};rows.set(ref.sha256,v);return ref;};
    const node=owner.executable,entry=path.join(ready.setup.missionControl.source.root,"dist-server/index.js"),serverOwner={...owner,pid:41007,ppid:owner.pid,commandHash:hashV1([node,entry].join(" "))};
    const listener=(endpointRole:string,state:string,who:RecordV1|null)=>put({schema:"mission-control.task4-listener.v1",...binding,
      endpointRole,host:"127.0.0.1",port:endpointRole==="mc"?23901:23456,at:"2026-10-19T10:00:00.000Z",state,owner:who,
      original:{method:endpointRole==="mc"?"owned_child_socket_census":"owned_http_server",observed:true}});
    const before=listener("mc","listening",serverOwner),after=listener("mc","absent",null),mock=listener("mock","listening",owner),mockAfter=listener("mock","absent",null);
    const intent=put({schema:"mission-control.task4-server-intent.v1",...binding,parentOwner:owner,executable:node,executableHash:owner.executableHash,
      entry,entryHash:"a".repeat(64),argvHash:hashV1(task4CanonicalV1([entry])),environmentHash:"b".repeat(64),policyHash:"c".repeat(64),launcherHash:"d".repeat(64)});
    const observed=put({schema:"mission-control.task4-server-observed.v1",...binding,intent,owner:serverOwner,listener:before});
    const settled=put({schema:"mission-control.task4-server-settled.v1",...binding,intent,observed,owner:serverOwner,
      exit:{code:null,signal:"SIGTERM",exitObserved:true,closeObserved:true},stop:"original_child_sigterm",listenerBefore:before,listenerAfter:after});
    const cleanup={schema:"mission-control.render-smoke-inner-cleanup.v1",...binding,ownerHash:hashV1(task4CanonicalV1(ui)),
      nativeAudit:{jobId:"12345678-1234-4234-8234-123456789abc",intentHash:binding.readyDescriptorHash,owner:ui,state:"not_started",children:[]},
      mock:{state:"closed",listen:mock,closeCallback:true,acceptedConnections:2,closedConnections:2,listenerAfter:mockAfter},
      server:{state:"closed",intent,observed,settled},readers:{opened:2,closed:2,pending:0},contexts:{opened:0,closed:0,pending:0},complete:true};
    validateTask4CleanupV1(cleanup,ready,owner,rows);
    const another=rewritePortGraph(rows,row=>{if(row.endpointRole==="mc")row.port=23902;});
    validateTask4CleanupV1(another.remap(cleanup),ready,owner,another.rows);
    const changes:Array<(row:RecordV1)=>void>=[
      row=>{if(row.endpointRole==="mc"&&row.state==="absent")row.port=23902;},
      row=>{if(row.endpointRole==="mc"&&row.state==="listening")row.owner={...row.owner,pid:row.owner.pid+1};},
      row=>{if(row.endpointRole==="mc")row.original.method="owned_http_server";},
      row=>{if(row.endpointRole==="mc")row.host="127.0.0.2";},
      ...[1023,65536,3080,3333,5432,13081,18789,23456,ready.setup.postgres.port].map(port=>(row:RecordV1)=>{if(row.endpointRole==="mc")row.port=port;})];
    for(const patch of changes){const crossed=rewritePortGraph(rows,patch);assert.throws(()=>validateTask4CleanupV1(crossed.remap(cleanup),ready,owner,crossed.rows),{message:"TASK4_CLEANUP_UNKNOWN"});}
    for(const change of [(v:any)=>{v.ownerHash=hashV1(task4CanonicalV1(ui)+"\n");},(v:any)=>{v.mock.closedConnections=1;},
      (v:any)=>{v.readers.pending=1;},(v:any)=>{v.nativeAudit.owner.pid++;},(v:any)=>{v.server.settled=null;},(v:any)=>{v.mock.closeCallback=false;}]){
      const v=structuredClone(cleanup);change(v);assert.throws(()=>validateTask4CleanupV1(v,ready,owner,rows),{message:"TASK4_CLEANUP_UNKNOWN"});
    }
    for(const change of [(v:any)=>{v.exit.closeObserved=false;},(v:any)=>{v.exit.signal="SIGKILL";},(v:any)=>{v.listenerAfter=before;},(v:any)=>{v.owner.pid++;}]){
      const v=structuredClone(rows.get(settled.sha256)!);change(v);const altered=new Map(rows);altered.set(settled.sha256,v);
      assert.throws(()=>validateTask4CleanupV1(cleanup,ready,owner,altered),{message:"TASK4_CLEANUP_UNKNOWN"});
    }
  });
  test("descriptor native proof reuses current schema and binds every original leaf to ready owner and descriptor",async t=>{
    const protocolPath=path.resolve(fileURLToPath(new URL("../../",import.meta.url)),"../mission-control-operator-workspace-20261019-v1/server/services/control-ui-worker-protocol.ts");
    const protocolBytes=fs.readFileSync(protocolPath),protocolHash=hashV1(protocolBytes),protocol=await import(pathToFileURL(protocolPath).href);
    assert.equal(hashV1(fs.readFileSync(protocolPath)),protocolHash);t.diagnostic("Actual MC protocol Source SHA256 "+protocolHash);
    const ready=JSON.parse(GOLDEN_READY_V1),jobId="12345678-1234-4234-8234-123456789abc",spawnId="22345678-1234-4234-8234-123456789abc",ownerHash="a".repeat(64);
    const base={jobId,intentHash:hashV1(GOLDEN_READY_V1+"\n"),spawnId},owner={kind:"native_browser",pid:42000,processStartedAt:"2026-10-19T10:00:00.000Z",processGroupId:42000,source:"observed_os",executable:"/fixture/browser",commandHash:"b".repeat(64)};
    const descriptor={executable:owner.executable,executableHash:"c".repeat(64),playwrightVersion:"1.60.0",browsersJsonHash:"d".repeat(64)};
    const argv=['--headless','--user-data-dir='+path.join(ready.setup.resourceRoot.path,'inner/profile'),'--no-first-run','--no-default-browser-check','--disable-background-networking','--disable-extensions','--disable-component-update','--disable-sync','--metrics-recording-only','--disable-default-apps','--disable-features=MediaRouter,OptimizationHints,Translate','--use-mock-keychain','--password-store=basic','--remote-debugging-address=127.0.0.1','--remote-debugging-port=0','about:blank'];
    owner.commandHash=hashV1([descriptor.executable,...argv].join(" "));
    const rows=new Map<string,Readonly<RecordV1>>(),put=(v:RecordV1)=>{const bytes=Buffer.from(task4CanonicalV1(v)+"\n"),ref={sha256:hashV1(bytes),bytes:bytes.length};rows.set(ref.sha256,v);return ref;};
    const intent=put({schema:"mission-control.ui-worker-child-intent.v1",...base,ownerHash,kind:"chromium",family:"chromium-headless-shell",expectedExecutable:descriptor.executable,
      executableHash:descriptor.executableHash,playwrightVersion:descriptor.playwrightVersion,browsersJsonHash:descriptor.browsersJsonHash,launchArgsHash:hashV1(task4CanonicalV1(argv))});
    const observed=put({schema:"mission-control.ui-worker-child-observed.v1",...base,launchIntentHash:intent.sha256,owner,parentPid:41006});
    const settled=put({schema:"mission-control.ui-worker-child-settled.v1",...base,observedHash:observed.sha256,method:"owned-child-process-group-v1",rootExit:{code:0,signal:null},rootExitObserved:true,rootCloseObserved:true,transport:"closed",
      cohort:[{owner,parentPidAtFirstObservation:41006,finalState:"absent_after_owned_close"}],emptyCensuses:[{capturedAt:"2026-10-19T10:01:00.000Z",metadataHash:"e".repeat(64),groupMemberCount:0,retainedOwnerCount:0},{capturedAt:"2026-10-19T10:01:00.100Z",metadataHash:"f".repeat(64),groupMemberCount:0,retainedOwnerCount:0}]});
    const closed=put({schema:"mission-control.ui-worker-child-closed.v1",...base,observedHash:observed.sha256,settlementHash:settled.sha256,close:"confirmed"});
    const cleanup={ownerHash,nativeAudit:{jobId,intentHash:base.intentHash,owner:{pid:41006},state:"closed",children:[{spawnId,owner,state:"closed"}]}},result={artifacts:{native:[{spawnId,intent,observed,settled,closed,notStarted:null}]}};
    validateTask4NativeChainV1(result,cleanup,ready,rows,protocol.UiWorkerLifecycleRecordV1Schema,descriptor);
    for(const [key,change] of [["settled",(v:any)=>{v.rootCloseObserved=false;}],["closed",(v:any)=>{v.settlementHash="0".repeat(64);}],["intent",(v:any)=>{v.ownerHash="0".repeat(64);}],["observed",(v:any)=>{v.parentPid++;}]] as const){
      const v=structuredClone(rows.get(result.artifacts.native[0]![key].sha256)!);change(v);const altered=structuredClone(result);altered.artifacts.native[0]![key]=put(v);
      assert.throws(()=>validateTask4NativeChainV1(altered,cleanup,ready,rows,protocol.UiWorkerLifecycleRecordV1Schema,descriptor),{message:"TASK4_CLEANUP_UNKNOWN"});
    }
    assert.throws(()=>validateTask4NativeChainV1(result,cleanup,ready,rows,protocol.UiWorkerLifecycleRecordV1Schema,{...descriptor,executableHash:"0".repeat(64)}),{message:"TASK4_CLEANUP_UNKNOWN"});
    const extraOwner={...owner,pid:42001},updatedSettled=structuredClone(rows.get(settled.sha256)!);updatedSettled.cohort.push({owner:extraOwner,parentPidAtFirstObservation:42000,finalState:"absent_after_owned_close"});
    const extraSettled=put(updatedSettled),extraClosed=put({...rows.get(closed.sha256),settlementHash:extraSettled.sha256}),withWitness=structuredClone(result);
    withWitness.artifacts.native[0]!.settled=extraSettled;withWitness.artifacts.native[0]!.closed=extraClosed;
    const witness={schema:"mission-control.ui-native-absence-witness.v1",...base,ownerHash,launchIntentHash:intent.sha256,observedHash:observed.sha256,owner:extraOwner,
      censusRow:{pid:42001,ppid:42000,uid:501,startedAt:extraOwner.processStartedAt,pgid:42000},previousCensus:{capturedAt:"2026-10-19T10:00:01.000Z",metadataHash:"1".repeat(64)},
      absenceCensus:{capturedAt:"2026-10-19T10:00:01.100Z",metadataHash:"2".repeat(64),rowCount:12},substep:"args_before",
      helper:{target:{pid:42001,form:"args"},classification:"clean_absence",fault:null,exitObserved:true,closeObserved:true,exitCode:1,exitSignal:null,closeCode:1,closeSignal:null,stdoutBytes:0,stderrBytes:0,stdoutHash:hashV1(""),stderrHash:hashV1("")},prefix:{metadata:null,executableHash:null}};
    const witnessRef=put(witness);validateTask4NativeChainV1(withWitness,cleanup,ready,rows,protocol.UiWorkerLifecycleRecordV1Schema,descriptor);
    for(const change of [(v:any)=>{v.helper.closeObserved=false;},(v:any)=>{v.helper.stdoutBytes=1;},(v:any)=>{v.owner.pid=42000;},(v:any)=>{v.censusRow.uid=0;},(v:any)=>{v.observedHash="0".repeat(64);}]){
      const bad=structuredClone(witness);change(bad);const altered=new Map(rows);altered.delete(witnessRef.sha256);const bytes=Buffer.from(task4CanonicalV1(bad)+"\n");altered.set(hashV1(bytes),bad);
      assert.throws(()=>validateTask4NativeChainV1(withWitness,cleanup,ready,altered,protocol.UiWorkerLifecycleRecordV1Schema,descriptor),{message:"TASK4_CLEANUP_UNKNOWN"});
    }
  });
  test("descriptor inner artifact inventory reads only exact private canonical originals and refuses residue",()=>{
    const root=fs.realpathSync(fs.mkdtempSync(path.join(tmpdir(),"task4-artifacts-")));fs.chmodSync(root,0o700);
    fs.mkdirSync(path.join(root,"inner"),{mode:0o700});fs.mkdirSync(path.join(root,"inner/artifacts"),{mode:0o700});fs.mkdirSync(path.join(root,"inner/children"),{mode:0o700});
    const v={schema:"mission-control.task4-inner-query-ledger.v1"},bytes=Buffer.from(task4CanonicalV1(v)+"\n"),ref={sha256:hashV1(bytes),bytes:bytes.length},target=path.join(root,"inner/artifacts",ref.sha256+".json");
    const inventory={json:[ref],png:[],native:[],totalBytes:bytes.length};
    try {
      fs.writeFileSync(target,bytes,{mode:0o600,flag:"wx"});assert.deepEqual(readTask4InnerArtifactsV1(root,inventory).get(ref.sha256),v);
      fs.chmodSync(target,0o644);assert.throws(()=>readTask4InnerArtifactsV1(root,inventory),{message:"TASK4_INTEGRITY_FAILED"});fs.chmodSync(target,0o600);
      const extra=path.join(root,"inner/artifacts/extra.json");fs.writeFileSync(extra,"{}\n",{mode:0o600,flag:"wx"});assert.throws(()=>readTask4InnerArtifactsV1(root,inventory),{message:"TASK4_INTEGRITY_FAILED"});fs.unlinkSync(extra);
      fs.renameSync(target,extra);fs.symlinkSync(extra,target);assert.throws(()=>readTask4InnerArtifactsV1(root,inventory),{message:"TASK4_INTEGRITY_FAILED"});fs.unlinkSync(target);fs.renameSync(extra,target);
      fs.writeFileSync(target,bytes.subarray(0,bytes.length-1));assert.throws(()=>readTask4InnerArtifactsV1(root,inventory),{message:"TASK4_INTEGRITY_FAILED"});
    }finally{fs.rmSync(root,{recursive:true,force:true});}
  });
  test("descriptor network ledger refuses unmatched requests foreign paths and unsupported OS claims",()=>{
    const ready=JSON.parse(GOLDEN_READY_V1),binding={executionId:ready.executionId,setupDescriptorHash:ready.setupDescriptorHash,readyDescriptorHash:hashV1(GOLDEN_READY_V1+"\n")};
    const owner={...ready.fixtureOwner,pid:41007,ppid:41006},rows=new Map<string,Readonly<RecordV1>>();const put=(v:RecordV1)=>{const bytes=Buffer.from(task4CanonicalV1(v)+"\n"),ref={sha256:hashV1(bytes),bytes:bytes.length};rows.set(ref.sha256,v);return ref;};
    const policyHash="a".repeat(64),launcherHash="b".repeat(64),intent=put({policyHash,launcherHash});
    const listener=put({schema:"mission-control.task4-listener.v1",...binding,endpointRole:"mc",host:"127.0.0.1",port:23901,at:"2026-10-19T10:00:00.000Z",state:"listening",owner,original:{method:"owned_child_socket_census",observed:true}});
    const observed=put({schema:"mission-control.task4-server-observed.v1",...binding,intent,owner,listener}),cleanup={server:{intent,observed},mock:{listen:put({port:23456}),acceptedConnections:1,closedConnections:1}};
    const expected=task4SeedV1(ready.setup.setfarm.source.sourceSha).productResponse;
    const proxy=put({schema:"mission-control.task4-proxy-observation.v1",...binding,at:"2026-10-19T10:00:00.000Z",method:"GET",pathId:"product_v3",status:200,
      bodyHash:"c".repeat(64),parsedHash:hashV1(task4CanonicalV1(expected)),authorityHash:expected.authorityHash,packetHash:expected.packetAuthority.packetHash});
    const recipes={browser:[{pathId:"root",method:"GET",path:"/",query:""},{pathId:"product_v3",method:"GET",path:"/api/product",query:""}],mock:[{pathId:"product_v3",method:"GET",path:"/api/product",query:""}]};
    const common={requestId:1,contextId:1,route:"/",at:"2026-10-19T10:00:00.000Z",method:"GET",target:"mc",pathId:"root",urlHash:hashV1("http://127.0.0.1:23901/"),status:null,bodyHash:null,failureCode:null};
    const value={schema:"mission-control.task4-network-ledger.v1",...binding,
      policy:{recipeHash:hashV1(task4CanonicalV1(recipes)),browserInstalledAt:common.at,serverPolicyHash:policyHash,serverLaunchRef:observed},
      browser:[{...common,seq:1,stage:"intercept",decision:"continue"},{...common,seq:2,stage:"response",decision:"observe",status:200,bodyHash:"d".repeat(64)}],
      mock:[{seq:1,connectionId:1,requestId:1,at:common.at,method:"GET",pathId:"product_v3",urlHash:hashV1("http://127.0.0.1:23456/api/product"),decision:"accepted",status:200,responseHash:"e".repeat(64),finished:true,closed:true}],osFence:{coverage:"server_launch_policy_bound_parent_probe_required",policyHash,launcherHash,serverOwner:owner,probe:"parent_originals_required",actualAllowed:{proxy,sql:"parent_originals_required"},denialTelemetry:"unavailable"},complete:true};
    validateTask4NetworkV1(value,ready,cleanup,rows,recipes);
    for(const port of [23902,3080,3333,5432,13081,18789,23456,ready.setup.postgres.port]){
      const changed=rewritePortGraph(rows,row=>{if(row.endpointRole==="mc")row.port=port;}),ledger=changed.remap(value),boundCleanup=changed.remap(cleanup);
      for(const row of ledger.browser)row.urlHash=hashV1("http://127.0.0.1:"+port+"/");
      if(port===23902)validateTask4NetworkV1(ledger,ready,boundCleanup,changed.rows,recipes);
      else assert.throws(()=>validateTask4NetworkV1(ledger,ready,boundCleanup,changed.rows,recipes),{message:"TASK4_NETWORK_REFUSED"});
    }
    const crossed=rewritePortGraph(rows,row=>{if(row.endpointRole==="mc")row.port=23902;});
    assert.throws(()=>validateTask4NetworkV1(crossed.remap(value),ready,crossed.remap(cleanup),crossed.rows,recipes),{message:"TASK4_NETWORK_REFUSED"});
    const assetRecipes=structuredClone(recipes),assetLedger=structuredClone(value);
    assetRecipes.browser.push({pathId:"asset_js",method:"GET",path:"/assets/index-current1.js",query:""});assetLedger.policy.recipeHash=hashV1(task4CanonicalV1(assetRecipes));
    const assetRequest={...common,requestId:2,pathId:"asset_js",urlHash:hashV1("http://127.0.0.1:23901/assets/index-current1.js")};
    assetLedger.browser.push({...assetRequest,seq:3,stage:"intercept",decision:"continue"},{...assetRequest,seq:4,stage:"response",decision:"observe",status:200,bodyHash:"a".repeat(64)});
    validateTask4NetworkV1(assetLedger,ready,cleanup,rows,assetRecipes);
    for(const row of assetLedger.browser.slice(2))row.urlHash=hashV1("http://127.0.0.1:23901/assets/index-obsolete.js");
    assert.throws(()=>validateTask4NetworkV1(assetLedger,ready,cleanup,rows,assetRecipes),{message:"TASK4_NETWORK_REFUSED"});
    const legacy=structuredClone(value),legacyRecipes=structuredClone(recipes),id="ac8cea43-7686-4d27-8092-1e3dd9207ca4",browserPath=`/api/setfarm/runs/${id}/product-build-authority`,mockPath=`/api/runs/${id}/product-build-authority`;
    legacyRecipes.browser.push({pathId:"legacy_authority",method:"GET",path:browserPath,query:""});legacyRecipes.mock.push({pathId:"legacy_authority",method:"GET",path:mockPath,query:""});legacy.policy.recipeHash=hashV1(task4CanonicalV1(legacyRecipes));
    const request={...common,requestId:2,route:`/setfarm/runs/${id}`,pathId:"legacy_authority",urlHash:hashV1("http://127.0.0.1:23901"+browserPath)};
    legacy.browser.push({...request,seq:3,stage:"intercept",decision:"continue"},{...request,seq:4,stage:"response",decision:"observe",status:409,
      bodyHash:hashV1(JSON.stringify({status:"unavailable",code:"SETFARM_PRODUCT_BUILD_AUTHORITY_NOT_READY",reason:"not_ready",upstreamStatus:409,upstreamCode:"RUNTIME_PACKET_RUN_NOT_V3"}))});
    legacy.mock.push({seq:2,connectionId:1,requestId:2,at:common.at,method:"GET",pathId:"legacy_authority",urlHash:hashV1("http://127.0.0.1:23456"+mockPath),decision:"accepted",status:409,responseHash:hashV1(JSON.stringify({code:"RUNTIME_PACKET_RUN_NOT_V3"})),finished:true,closed:true});
    validateTask4NetworkV1(legacy,ready,cleanup,rows,legacyRecipes);
    for(const change of [(v:any)=>{v.browser[3].bodyHash="0".repeat(64);},(v:any)=>{v.browser[2].route="/";v.browser[3].route="/";},(v:any)=>{v.mock[1].responseHash="0".repeat(64);},(v:any)=>{v.browser[3].status=404;}]){
      const changed=structuredClone(legacy);change(changed);assert.throws(()=>validateTask4NetworkV1(changed,ready,cleanup,rows,legacyRecipes),{message:"TASK4_NETWORK_REFUSED"});
    }
    for(const change of [(v:any)=>{v.browser.pop();},(v:any)=>{v.browser[0].target="other";},(v:any)=>{v.browser[0].pathId="unknown";},
      (v:any)=>{v.browser[1].urlHash="0".repeat(64);},(v:any)=>{v.osFence.coverage="unqualified";},(v:any)=>{v.osFence.denialTelemetry="native_closed";},
      (v:any)=>{v.browser[1].requestId=2;},(v:any)=>{v.mock.push({seq:1,connectionId:1,requestId:1,at:common.at,method:"GET",pathId:"product_v3",urlHash:"e".repeat(64),decision:"accepted",status:200,responseHash:"f".repeat(64),finished:true,closed:false});}]){
      const changed=structuredClone(value);change(changed);assert.throws(()=>validateTask4NetworkV1(changed,ready,cleanup,rows,recipes),{message:"TASK4_NETWORK_REFUSED"});
    }
  });
  test("descriptor filesystem ledger binds owned roots complete snapshots and actual pipeline JSON bytes",()=>{
    const ready=JSON.parse(GOLDEN_READY_V1),binding={executionId:ready.executionId,setupDescriptorHash:ready.setupDescriptorHash,readyDescriptorHash:hashV1(GOLDEN_READY_V1+"\n")};
    const rows=new Map<string,Readonly<RecordV1>>(),put=(v:RecordV1)=>{const bytes=Buffer.from(task4CanonicalV1(v)+"\n"),ref={sha256:hashV1(bytes),bytes:bytes.length};rows.set(ref.sha256,v);return ref;};
    const raw={finishedIds:[],runningIds:["ac8cea43-7686-4d27-8092-1e3dd9207ca4","ad47fe65-4ec4-4fb5-89da-fff71eb4e79a"],savedAt:"2026-10-19T10:00:00.000Z"},text=JSON.stringify(raw),state={sha256:hashV1(text),bytes:Buffer.byteLength(text),...raw};
    const paths={server_home:"server-home",server_runtime:"server-runtime",native_home:"home",native_profile:"profile",native_tmp:"tmp"};let seq=0;
    const snapshots=Object.entries(paths).flatMap(([rootId,name])=>(rootId.startsWith("server_")?["before_server","after_server_close"]:["after_server_close"]).map(phase=>{
      const rootPin={...ready.setup.resourceRoot,path:path.join(ready.setup.resourceRoot.path,"inner",name)},entries=rootId==="server_runtime"&&phase==="after_server_close"
        ?[{relative:"setfarm",kind:"directory",uid:rootPin.uid,mode:448,dev:"1",ino:"100",bytes:0,sha256:null,linkHash:null},
          {relative:"setfarm/mc-sync-state.json",kind:"file",uid:rootPin.uid,mode:384,dev:"1",ino:"101",bytes:state.bytes,sha256:state.sha256,linkHash:null}]:[];
      const at="2026-10-19T10:00:01.000Z",ref=put({schema:"mission-control.task4-filesystem-snapshot.v1",...binding,rootId,rootPin,at,entries});
      return {seq:++seq,phase,at,rootId,rootPin,entries:ref};
    }));
    const value={schema:"mission-control.task4-filesystem-ledger.v1",...binding,scope:"owned_private_roots_and_explicit_source_pins",snapshots,
      syncState:{pathId:"pipeline_sync_state",before:null,checkpoints:[{...state,at:"2026-10-19T10:00:00.000Z",route:"/"}],after:state,tmpAfter:"absent"},operations:[],complete:true};
    validateTask4FilesystemV1(value,ready,rows);
    for(const rootId of ["server_runtime","server_home"]){
      const changed=structuredClone(value),row=changed.snapshots.find(v=>v.rootId===rootId&&v.phase==="after_server_close")!,snapshot=structuredClone(rows.get(row.entries.sha256)!);
      snapshot.entries.push({relative:"projects",kind:"directory",uid:501,mode:448,dev:"1",ino:"102",bytes:0,sha256:null,linkHash:null},
        {relative:"projects/foreign.json",kind:"file",uid:501,mode:384,dev:"1",ino:"103",bytes:3,sha256:hashV1("{}\n"),linkHash:null});
      snapshot.entries.sort((a:RecordV1,b:RecordV1)=>a.relative<b.relative?-1:1);row.entries=put(snapshot);
      assert.throws(()=>validateTask4FilesystemV1(changed,ready,rows),{message:"TASK4_RESOURCE_REFUSED"});
    }
    for(const change of [(v:any)=>{v.scope="all_host";},(v:any)=>{v.syncState.tmpAfter="present";},(v:any)=>{v.syncState.after=null;},
      (v:any)=>{v.syncState.after.runningIds=["foreign"];},(v:any)=>{v.snapshots.pop();},(v:any)=>{v.snapshots[0].rootPin.path="/foreign";},
      (v:any)=>{v.syncState.after.sha256="0".repeat(64);},(v:any)=>{v.syncState.checkpoints=[];}]){
      const changed=structuredClone(value);change(changed);assert.throws(()=>validateTask4FilesystemV1(changed,ready,rows),{message:"TASK4_RESOURCE_REFUSED"});
    }
  });
  test("descriptor query ledger binds actual transaction backend parameters and explicit optional absence",()=>{
    const ready=JSON.parse(GOLDEN_READY_V1),binding={executionId:ready.executionId,setupDescriptorHash:ready.setupDescriptorHash,readyDescriptorHash:hashV1(GOLDEN_READY_V1+"\n")},ref={sha256:"a".repeat(64),bytes:100};
    const recipes=[{queryId:"begin",statement:"BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY",parametersRule:[],requiredPhases:["before","after"]},
      ...["identity","settings","current_pair","optional_step_metrics"].map(queryId=>({queryId,statement:queryId==="optional_step_metrics"?"SELECT to_regclass('public.step_metrics')::text AS relation":"SELECT '"+queryId+"' AS component",parametersRule:[],requiredPhases:["before","after"]})),
      {queryId:"commit",statement:"COMMIT",parametersRule:[],requiredPhases:["before","after"]}];
    let seq=0;const queries=["before","after"].flatMap(phase=>recipes.map(recipe=>({seq:++seq,queryId:recipe.queryId,phase,backendPid:123,backendStartedAt:"2026-10-19T09:59:00.000000Z",applicationName:"task4_observer_"+ready.executionId,
      startedAt:new Date(Date.parse("2026-10-19T10:00:00.000Z")+(seq-1)*100).toISOString(),finishedAt:new Date(Date.parse("2026-10-19T10:00:00.000Z")+seq*100).toISOString(),statementHash:hashV1(recipe.statement),parametersHash:hashV1(task4CanonicalV1([])),
      outcome:["begin","commit"].includes(recipe.queryId)?"command":"rows",sqlstate:null,rowCount:["begin","commit"].includes(recipe.queryId)?null:1,
      resultHash:["begin","commit"].includes(recipe.queryId)?null:hashV1(task4CanonicalV1(recipe.queryId==="optional_step_metrics"?[{relation:null}]:[{component:recipe.queryId}])),
      observation:["begin","commit"].includes(recipe.queryId)?null:ref})));
    const value={schema:"mission-control.task4-inner-query-ledger.v1",...binding,scope:"inner_observer",queries,complete:true},observations={before:ref,after:ref};
    validateTask4QueryLedgerV1(value,ready,observations,recipes);
    for(const change of [(v:any)=>{v.queries[2].backendPid++;},(v:any)=>{v.queries[2].parametersHash="0".repeat(64);},(v:any)=>{v.queries[2].queryId="unknown";},
      (v:any)=>{v.queries[2].applicationName="task4_mc_"+ready.executionId;},(v:any)=>{v.queries.pop();},(v:any)=>{v.queries[4].resultHash=hashV1(task4CanonicalV1([{relation:"step_metrics"}]));},
      (v:any)=>{v.queries[2].outcome="error";v.queries[2].sqlstate="42501";}]){
      const changed=structuredClone(value);change(changed);assert.throws(()=>validateTask4QueryLedgerV1(changed,ready,observations,recipes),{message:"TASK4_DATABASE_REFUSED"});
    }
  });
  test("descriptor ready projection binds authenticated parent observation without reminting its digest",()=>{
    const golden=JSON.parse(GOLDEN_READY_V1),seed=task4SeedV1(golden.setup.setfarm.source.sourceSha),grants=task4GrantsV1(golden.database.name,golden.database.role);
    const pair={activationRef:"setfarm://fixture/activation",activationHash:"a".repeat(64),headRef:"setfarm://fixture/head",headHash:"b".repeat(64)};
    const admissionReadyHash=hashV1(JSON.stringify({activationHash:pair.activationHash,activationRef:pair.activationRef,headHash:pair.headHash,headRef:pair.headRef,schema:"setfarm.p3-projected-admission-ready.v1"}));
    const ready={state:"normal-task0-admission-ready",admissionReadyRef:"setfarm://tests/p3/admission-ready/sha256/"+admissionReadyHash,admissionReadyHash,
      manifestActivationRef:pair.activationRef,manifestActivationHash:pair.activationHash,manifestHeadRef:pair.headRef,manifestHeadHash:pair.headHash};
    const body={schema:"setfarm.owned-p3-readiness-observation.v1",database:golden.database.name,parentPid:golden.fixtureOwner.pid,projectionRoot:golden.projection.root.path,
      projectedHead:golden.projection.projectedHead,markerHash:golden.projection.markerHash,
      sourcePins:["src/db-pg.ts","tests/execution-attempts/test-database.ts","tests/execution-attempts/manual-test-admission-v1.isolated-pg.test.ts","src/internal-production/baseline-spawner-startup-admission-v1.js"].map(relative=>({relative,sha256:"c".repeat(64)})),
      status:{state:"normal_task0_admission_ready",admissionReady:{admissionReadyHash,admissionReadyRef:ready.admissionReadyRef}},ready};
    const observed={...body,descriptorHash:hashV1(task4CanonicalV1(body))};
    const result=buildTask4ReadyV1(golden.setup,golden.fixtureOwner,golden.projection,golden.database,observed,seed,grants);
    assert.equal(result.fixture.readinessDigest,observed.descriptorHash);assert.equal(result.fixture.seedDigest,hashV1(task4CanonicalV1(seed)));assert.equal(result.fixture.admissionReadyHash,admissionReadyHash);
    assert.equal(Object.isFrozen(result),true);
    for(const change of [(v:any)=>{v.parentPid++;},(v:any)=>{v.database+="foreign";},(v:any)=>{v.ready.manifestHeadHash="f".repeat(64);},(v:any)=>{v.descriptorHash="f".repeat(64);},(v:any)=>{v.markerHash="f".repeat(64);}]){
      const altered=structuredClone(observed);change(altered);assert.throws(()=>buildTask4ReadyV1(golden.setup,golden.fixtureOwner,golden.projection,golden.database,altered,seed,grants),{message:"TASK4_BINDING_REFUSED"});
    }
  });
  test("descriptor PG logging settings separate global credential protection from restricted statement evidence",()=>{
    const base={destination:"stderr",collector:"off",prefix:"%m|%p|%c|%u|%d|%a|%e| ",verbosity:"terse",log_timezone:"UTC",timezone:"UTC",messages:"C",statement:"none",error_statement:"panic",parameters:"0",error_parameters:"0"};
    validateTask4PgSettingsV1(base,false);validateTask4PgSettingsV1({...base,statement:"all",error_statement:"error"},true);
    for(const change of [(v:any)=>{v.statement="all";},(v:any)=>{v.error_statement="error";},(v:any)=>{v.parameters="-1";},(v:any)=>{v.log_timezone="Europe/Istanbul";},(v:any)=>{v.collector="on";},(v:any)=>{v.prefix+="%q";}]){
      const changed=structuredClone(base);change(changed);assert.throws(()=>validateTask4PgSettingsV1(changed,false),{message:"TASK4_SQL_ORIGINALS_UNKNOWN"});
    }
    assert.throws(()=>validateTask4PgSettingsV1(base,true),{message:"TASK4_SQL_ORIGINALS_UNKNOWN"});
  });
  if(process.execArgv.some(arg=>arg.startsWith("--test-name-pattern=^descriptor ")))test("descriptor direct actual entry refuses empty fd4 before registering offline component tests",async()=>{
    const child=spawn(process.execPath,["--import","tsx","--test","--test-concurrency=1",fileURLToPath(import.meta.url)],{
      env:{PATH:"/usr/bin:/bin",LANG:"C",LC_ALL:"C",TSX_DISABLE_CACHE:"1",NODE_OPTIONS:"--test-isolation=none"},stdio:["ignore","pipe","pipe","ignore","pipe"]});
    let text="",overflow=false;for(const stream of [child.stdout!,child.stderr!])stream.on("data",chunk=>{text+=chunk;if(text.length>65536)overflow=true;});
    const ended=observeTask4OriginalChildV1(child);(child.stdio[4] as import("node:stream").Writable).end();const exit=await ended;
    assert.equal(overflow,false);assert.equal(exit.closeObserved,true);assert.notEqual(exit.code,0);
    assert.equal(text.includes("descriptor shared canonical"),false);assert.equal(text.includes("TASK4_FRAME_INVALID"),true);
    assert.equal(text.includes("TASK4_INTEGRATION_NOT_IMPLEMENTED"),false);
  });
}
if(direct&&!process.execArgv.some(arg=>arg.startsWith("--test-name-pattern=^descriptor "))){
  // The actual fixed entry consumes its one private frame before test registration or effects.
  const setup=await readTask4Fd4V1("setup");
  const adminUrl=process.env.SETFARM_TEST_PG_ADMIN_URL;
  requireV1(typeof adminUrl==="string","TASK4_BINDING_REFUSED");
  const context=await prepareTask4ContextV1(setup,"fixture",adminUrl);
  test("owned server-port current-schema smoke",async()=>{await runTask4OwnedFixtureV1(setup,context,adminUrl);});
}
