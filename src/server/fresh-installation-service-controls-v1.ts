// Proposed src/server/fresh-installation-service-controls-v1.ts.
// Source candidate only: fixed private service custody, not DB/entry authority.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { performance } from "node:perf_hooks";
import type { ChildProcess } from "node:child_process";
import { freshInstallationSelectionV1 } from "../installation/fresh-installation-selection-v1.js";
import { assertFreshInstallationOperationalEntryV1 } from "../installation/fresh-installation-entry-v1.js";
import { observeProcessIdentity, signalProcessIfIdentityMatches } from "../execution/process-identity.js";
import { ProcessIdentityV1Schema, sameProcessIdentity, type ProcessIdentityV1 } from "../execution/schemas/process-identity-v1.js";

export type FreshServiceV1 = "dashboard" | "spawner";
type RecordV1 = Readonly<{ schema:"setfarm.fresh-service-process.v1"; service:FreshServiceV1; installationDirectory:string; sourceSha:string; executable:string; script:string; ownerIdentity:ProcessIdentityV1 }>;
type PinV1 = Readonly<{ file:string; bytes:Buffer; identity:fs.BigIntStats }>;
type PairV1 = Readonly<{ record:RecordV1; pid:PinV1; lock:PinV1 }>;
const identityKeys = ["dev","ino","mode","nlink","uid","gid","size","mtimeNs","ctimeNs"] as const;
function refuse():never { throw new Error("FRESH_INSTALLATION_SERVICE_CONTROL_REFUSED"); }
function selected() { const s=freshInstallationSelectionV1;if(!s?.activation?.acknowledged)refuse();s.assertUnchanged();return s; }
function serviceName(service:FreshServiceV1):void { if(service!=="dashboard"&&service!=="spawner")refuse(); }
export function freshServicePathsV1(service:FreshServiceV1) {
  serviceName(service);const s=selected(),directory=path.join(s.paths.root,"services");
  return Object.freeze({directory,pidFile:path.join(directory,service+".pid"),lockFile:path.join(directory,service+".lock"),logFile:path.join(directory,service+".log")});
}
function currentContext(service:FreshServiceV1) {
  const s=selected(),paths=freshServicePathsV1(service);
  const script=path.join(s.paths.repository,"dist",service==="dashboard"?"server/daemon.js":"spawner.js");
  if(fs.realpathSync(script)!==script)refuse();
  return {s,paths,script,executable:fs.realpathSync(process.execPath)};
}
function sameIdentity(a:fs.BigIntStats,b:fs.BigIntStats):boolean { return identityKeys.every(k=>a[k]===b[k]); }
function plainPrivateFile(stat:fs.BigIntStats,cap:number):boolean {return stat.isFile()&&!stat.isSymbolicLink()&&stat.uid===BigInt(process.getuid!())&&stat.nlink===1n&&(stat.mode&0o777n)===0o600n&&stat.size>0n&&stat.size<=BigInt(cap);}
function privateDirectory(directory:string):void {
  const stat=fs.lstatSync(directory);
  if(!stat.isDirectory()||stat.isSymbolicLink()||stat.uid!==process.getuid!()||(stat.mode&0o777)!==0o700||fs.realpathSync(directory)!==directory)refuse();
}
function readPin(file:string,cap:number):PinV1|null {
  let before:fs.BigIntStats;
  try{before=fs.lstatSync(file,{bigint:true});}catch(error){if((error as NodeJS.ErrnoException).code==="ENOENT")return null;throw error;}
  if(!plainPrivateFile(before,cap))refuse();
  let fd:number|undefined,primary:unknown,result:PinV1|undefined;
  try{
    fd=fs.openSync(file,fs.constants.O_RDONLY|fs.constants.O_NOFOLLOW|fs.constants.O_NONBLOCK);
    if(!sameIdentity(before,fs.fstatSync(fd,{bigint:true})))refuse();
    const bytes=Buffer.alloc(Number(before.size));
    if(fs.readSync(fd,bytes,0,bytes.length,0)!==bytes.length||fs.readSync(fd,Buffer.alloc(1),0,1,bytes.length)!==0)refuse();
    if(!sameIdentity(before,fs.fstatSync(fd,{bigint:true}))||!sameIdentity(before,fs.lstatSync(file,{bigint:true})))refuse();
    result={file,bytes,identity:before};
  }catch(error){primary=error;}
  finally{if(fd!==undefined)try{fs.closeSync(fd);}catch(error){primary??=error;}}
  if(primary!==undefined)throw primary;if(!result)refuse();return result;
}
function recordFrom(pin:PinV1,service:FreshServiceV1,context:ReturnType<typeof currentContext>):RecordV1 {
  const raw:unknown=JSON.parse(pin.bytes.toString("utf8"));
  if(!raw||typeof raw!=="object"||Array.isArray(raw))refuse();
  const r=raw as Record<string,unknown>;
  if(Object.keys(r).sort().join(",")!==["schema","service","installationDirectory","sourceSha","executable","script","ownerIdentity"].sort().join(",")
    ||r.schema!=="setfarm.fresh-service-process.v1"||r.service!==service||r.installationDirectory!==context.s.directory
    ||r.sourceSha!==context.s.state.origin.sourceSha||r.script!==context.script||r.executable!==context.executable)refuse();
  const identity=ProcessIdentityV1Schema.parse(r.ownerIdentity);
  if(identity.source!=="observed_os"||identity.processGroupId===undefined)refuse();
  if(Buffer.from(JSON.stringify(raw)+"\n").compare(pin.bytes)!==0)refuse();
  return {...r,ownerIdentity:identity} as RecordV1;
}
function ownerState(identity:ProcessIdentityV1):"alive"|"dead"|"unknown" {
  const observed=observeProcessIdentity(identity.pid);
  if(observed)return sameProcessIdentity(identity,observed)?"alive":"dead";
  try{process.kill(identity.pid,0);return "unknown";}catch(error){return (error as NodeJS.ErrnoException).code==="ESRCH"?"dead":"unknown";}
}
function readPair(service:FreshServiceV1):PairV1|null {
  const context=currentContext(service),{paths}=context;
  privateDirectory(context.s.paths.root);
  try{privateDirectory(paths.directory);}catch(error){if((error as NodeJS.ErrnoException).code==="ENOENT")return null;throw error;}
  const lock=readPin(paths.lockFile,8192),pid=readPin(paths.pidFile,32);
  if(!lock&&!pid)return null;if(!lock||!pid)refuse();
  const record=recordFrom(lock,service,context);
  if(pid.bytes.toString("utf8")!==String(record.ownerIdentity.pid))refuse();
  context.s.assertUnchanged();return {record,pid,lock};
}
function removeExact(pin:PinV1):void {
  const current=readPin(pin.file,pin.bytes.length);
  if(!current)return;
  if(!sameIdentity(current.identity,pin.identity)||!current.bytes.equals(pin.bytes))refuse();
  fs.unlinkSync(pin.file); // Same-owner private path check; not an atomic rename/unlink claim.
}
function removePair(pair:PairV1):void {
  let primary:unknown;
  for(const pin of [pair.pid,pair.lock])try{removeExact(pin);}catch(error){primary??=error;}
  if(primary!==undefined)throw primary;
}
export function inspectFreshServiceV1(service:FreshServiceV1):Readonly<{running:false}|{running:true;pid:number}> {
  const pair=readPair(service);if(!pair)return {running:false};
  const state=ownerState(pair.record.ownerIdentity);if(state==="unknown")refuse();
  return state==="alive"?{running:true,pid:pair.record.ownerIdentity.pid}:{running:false};
}
function writeExclusive(file:string,bytes:Buffer):PinV1 {
  if(bytes.length<1||bytes.length>8192)refuse();
  let fd:number|undefined,primary:unknown,result:PinV1|undefined;
  try{
    fd=fs.openSync(file,fs.constants.O_WRONLY|fs.constants.O_CREAT|fs.constants.O_EXCL|fs.constants.O_NOFOLLOW,0o600);
    if(fs.writeSync(fd,bytes,0,bytes.length)!==bytes.length)refuse();fs.fsyncSync(fd);
    const identity=fs.fstatSync(fd,{bigint:true});
    if(!plainPrivateFile(identity,8192)||!sameIdentity(identity,fs.lstatSync(file,{bigint:true})))refuse();
    result={file,bytes,identity};
  }catch(error){primary=error;}
  finally{if(fd!==undefined)try{fs.closeSync(fd);}catch(error){primary??=error;}}
  // A failed write with no complete identity stays as diagnostic residue and
  // blocks adoption; never remove an unproved name or retry/overwrite it.
  if(primary!==undefined)throw primary;if(!result)refuse();return result;
}
export function acquireFreshServiceProcessV1(service:FreshServiceV1):Readonly<{release():void;retainOnExit():void}> {
  assertFreshInstallationOperationalEntryV1();
  const context=currentContext(service),{s,paths}=context;
  if(!fileURLToPath(import.meta.url).endsWith(".js")||!process.argv[1]||fs.realpathSync(process.argv[1])!==context.script)refuse();
  privateDirectory(s.paths.root);
  try{fs.mkdirSync(paths.directory,{mode:0o700});}catch(error){if((error as NodeJS.ErrnoException).code!=="EEXIST")throw error;}
  privateDirectory(paths.directory);
  const previous=readPair(service);
  if(previous){if(ownerState(previous.record.ownerIdentity)!=="dead")refuse();removePair(previous);}
  const identity=observeProcessIdentity(process.pid);
  if(!identity||identity.source!=="observed_os"||identity.processGroupId===undefined)refuse();
  const record:RecordV1={schema:"setfarm.fresh-service-process.v1",service,installationDirectory:s.directory,sourceSha:s.state.origin.sourceSha,executable:context.executable,script:context.script,ownerIdentity:identity};
  const pins:PinV1[]=[];let released=false,retainedOnExit=false;
  const release=():void=>{
    if(released)return;released=true;process.off("exit",onExit);
    let primary:unknown;for(const pin of [...pins].reverse())try{removeExact(pin);}catch(error){primary??=error;}
    if(primary!==undefined)throw primary;
  };
  // Fixed zero-argument evidence retention, never a caller path/callback. An
  // unconfirmed spawner drain must not erase records even on natural exit.
  const retainOnExit=():void=>{if(released)return;retainedOnExit=true;process.off("exit",onExit);};
  const onExit=():void=>{if(retainedOnExit)return;try{release();}catch{process.exitCode=1;}};
  process.once("exit",onExit);
  try{
    assertFreshInstallationOperationalEntryV1();
    pins.push(writeExclusive(paths.lockFile,Buffer.from(JSON.stringify(record)+"\n")));
    pins.push(writeExclusive(paths.pidFile,Buffer.from(String(process.pid))));
    assertFreshInstallationOperationalEntryV1();
    return Object.freeze({release,retainOnExit});
  }catch(error){try{release();}catch{/* Original failure and residue remain. */}throw error;}
}
function plainPrivateLog(stat:fs.BigIntStats):boolean {return stat.isFile()&&!stat.isSymbolicLink()&&stat.uid===BigInt(process.getuid!())&&stat.nlink===1n&&(stat.mode&0o777n)===0o600n&&stat.size>=0n&&stat.size<=67108864n;}
/** Parent owns the returned FD and must close it once immediately after spawn. */
export function openFreshServiceLogV1(service:FreshServiceV1):number {
  assertFreshInstallationOperationalEntryV1();const {s,paths}=currentContext(service);
  privateDirectory(s.paths.root);
  try{fs.mkdirSync(paths.directory,{mode:0o700});}catch(error){if((error as NodeJS.ErrnoException).code!=="EEXIST")throw error;}
  privateDirectory(paths.directory);let fd:number|undefined,before:fs.BigIntStats|undefined;
  try{before=fs.lstatSync(paths.logFile,{bigint:true});}catch(error){if((error as NodeJS.ErrnoException).code!=="ENOENT")throw error;}
  if(before&&!plainPrivateLog(before))refuse();
  try{
    // NONBLOCK also refuses a FIFO replacement between lstat and open without
    // waiting for a reader. No log payload is written before identity checks.
    fd=fs.openSync(paths.logFile,fs.constants.O_WRONLY|fs.constants.O_APPEND|fs.constants.O_CREAT|fs.constants.O_NOFOLLOW|fs.constants.O_NONBLOCK,0o600);
    const stat=fs.fstatSync(fd,{bigint:true});
    if(!plainPrivateLog(stat)||(before&&!sameIdentity(before,stat))||!sameIdentity(stat,fs.lstatSync(paths.logFile,{bigint:true})))refuse();
    assertFreshInstallationOperationalEntryV1();return fd;
  }catch(error){if(fd!==undefined)try{fs.closeSync(fd);}catch{/* Preserve primary. */}throw error;}
}
export function freshServiceChildEnvironmentV1():NodeJS.ProcessEnv {
  const s=selected();return {...process.env,SETFARM_INSTALLATION_DIR:s.directory,SETFARM_REPO_DIR:s.paths.repository};
}
/** TERM only: the selected spawner's existing shutdown owns runtime drain. */
export function stopFreshServiceV1(service:FreshServiceV1):boolean {
  const began=performance.now(),deadline=began+30000,pair=readPair(service);if(!pair)return false;
  const identity=pair.record.ownerIdentity;
  if(identity.pid===process.pid)refuse(); // A synchronous control cannot await its own termination.
  const state=ownerState(identity);
  if(state==="unknown")refuse();
  if(state==="alive"&&!signalProcessIfIdentityMatches(identity,"SIGTERM")&&ownerState(identity)!=="dead")refuse();
  while(performance.now()<deadline){
    const observed=ownerState(identity);
    if(observed==="dead"){
      removePair(pair);
      if(performance.now()>deadline)throw new Error("FRESH_INSTALLATION_SERVICE_STOP_TIMED_OUT");
      return true;
    }
    if(observed==="unknown")refuse();
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,100);
  }
  // Do not kill a working/unknown spawner or unlink its live custody records.
  throw new Error("FRESH_INSTALLATION_SERVICE_STOP_NOT_CONFIRMED");
}

/** Only a genuinely held starting child may use this post-terminal cleanup. */
export function reclaimFreshServiceAfterHeldChildV1(service:FreshServiceV1,child:ChildProcess):void {
  if(child.pid===undefined)return;
  if(child.exitCode===null&&child.signalCode===null)refuse();
  const pair=readPair(service);if(!pair)return;
  if(pair.record.ownerIdentity.pid!==child.pid)return; // Never touch a foreign winner.
  if(ownerState(pair.record.ownerIdentity)!=="dead")refuse();
  removePair(pair);
}
