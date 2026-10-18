// Proposed tests/installation/fresh-installation-spawner-retention.test.ts.
// Genuine source-body components with fake ports only; UNRUN candidate.
// No module import, child, signals, DB, filesystem effects or operational credit.
import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync, statSync } from "node:fs";
import { EventEmitter } from "node:events";
import ts from "typescript";

function fixedSource(relative:string) {
  const file=new URL(relative,import.meta.url);
  assert.ok(statSync(file).size<=2*1024*1024,"fixed source component read bound");
  const source=readFileSync(file,"utf8");
  return {source,tree:ts.createSourceFile(file.pathname,source,ts.ScriptTarget.ESNext,true,ts.ScriptKind.TS)};
}
const spawner=fixedSource("../../src/spawner.ts");
const controls=fixedSource("../../src/server/fresh-installation-service-controls-v1.ts");
function declaration(unit:typeof spawner,name:string):ts.FunctionDeclaration {
  const rows=unit.tree.statements.filter((n):n is ts.FunctionDeclaration=>ts.isFunctionDeclaration(n)&&n.name?.text===name);
  assert.equal(rows.length,1,"one exact top-level function: "+name);return rows[0]!;
}
function whole(unit:typeof spawner,name:string) {return declaration(unit,name).getText(unit.tree).replace(/^export\s+/,"");}
function compile(source:string) {return ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;}
function localVariable(name:string):ts.VariableStatement {
  const main=declaration(spawner,"main");assert.ok(main.body);
  const rows=main.body.statements.filter((n):n is ts.VariableStatement=>ts.isVariableStatement(n)&&n.declarationList.declarations.some(d=>ts.isIdentifier(d.name)&&d.name.text===name));
  assert.equal(rows.length,1,"one exact main-local declaration: "+name);return rows[0]!;
}

function leaseComponent() {
  const removed:string[]=[],written:string[]=[];
  const processPort=Object.assign(new EventEmitter(),{pid:12345,argv:["/node","/compiled/spawner.js"],exitCode:0});
  const context={s:{directory:"/component-install",paths:{root:"/component"},state:{origin:{sourceSha:"a".repeat(40)}}},paths:{directory:"/component/services",lockFile:"/component/services/spawner.lock",pidFile:"/component/services/spawner.pid"},script:"/compiled/spawner.js",executable:"/node"};
  let source=whole(controls,"acquireFreshServiceProcessV1");
  const locator="fileURLToPath(import.meta.url)";
  assert.equal(source.split(locator).length-1,1);
  // One disclosed fixture seam: source module locator, never entry authority.
  source=source.replace(locator,JSON.stringify("/component.js"));
  const ports={
    assertFreshInstallationOperationalEntryV1(){},currentContext:()=>context,
    fs:{realpathSync:(value:string)=>value,mkdirSync(){}},privateDirectory(){},readPair:()=>null,
    observeProcessIdentity:(pid:number)=>({pid,processGroupId:pid,source:"observed_os"}),
    writeExclusive(file:string,bytes:Buffer){written.push(file);return {file,bytes,identity:{}};},
    removeExact(pin:{file:string}){removed.push(pin.file);},
    refuse():never{throw Error("COMPONENT_REFUSED");},process:processPort,Buffer,
  };
  const acquire=new Function(...Object.keys(ports),compile(source)+";return acquireFreshServiceProcessV1;")(...Object.values(ports)) as (service:"spawner")=>Readonly<{release():void;retainOnExit():void}>;
  return {lease:acquire("spawner"),removed,written,processPort};
}

test("actual service lease preserves default exit cleanup",()=>{
  const c=leaseComponent();assert.equal(c.written.length,2);
  c.processPort.emit("exit",0);
  assert.deepEqual(c.removed,["/component/services/spawner.pid","/component/services/spawner.lock"]);
  c.lease.release();assert.equal(c.removed.length,2);
});
test("actual retained lease survives natural exit; explicit proven release remains possible",()=>{
  const c=leaseComponent();c.lease.retainOnExit();c.lease.retainOnExit();
  c.processPort.emit("exit",0);assert.deepEqual(c.removed,[]);
  c.lease.release();assert.deepEqual(c.removed,["/component/services/spawner.pid","/component/services/spawner.lock"]);
});

type DrainMode="reject"|"database-refusal"|"quarantined"|"retained_for_recovery"|"released";
function shutdownComponent(mode:DrainMode,listenerFailure=false) {
  const calls={retained:0,released:0,forcedExit:0,pgClose:0,drain:0},errors:string[]=[];
  const active={runtimeSessionId:"component-session",claimId:1,stepId:"component-step"};
  const activeProcesses=new Map([[active.runtimeSessionId,active]]),drainingProcesses=new Map();
  const processPort={exitCode:0,exit(){calls.forcedExit++;throw Error("COMPONENT_FORCE_EXIT");}};
  const ports={
    SELECTED_SPAWNER_V1:{},selectedSpawnerLeaseV1:{retainOnExit(){calls.retained++;},release(){calls.released++;}},
    selectedSpawnerListenerV1:{async end(){if(listenerFailure)throw Error("COMPONENT_LISTENER_CLOSE");}},legacySpawnerListenerV1:undefined,
    selectedSpawnerFailedV1:false,activeProcesses,drainingProcesses,inFlightSpawnPromises:new Set(),claimingSpawns:new Set(),
    runRecoveryCoordinator:{async join(){},async close(){}},
    releaseActiveProcessForShutdown:async()=>{calls.drain++;if(mode==="reject")throw Error("COMPONENT_DRAIN_REJECTED");return {status:mode,runtimeSessionId:active.runtimeSessionId,claimId:active.claimId};},
    getSql:()=>{if(mode==="database-refusal")throw Error("COMPONENT_ACTUAL_GETSQL_REFUSAL");return {};},
    createRuntimeSessionRepository:()=>({async listRecoverable(){return [];}}),
    SPAWNER_INSTANCE_ID:"component-instance",task6aV2UnboundPostClaimRefusals:0,task6aV2RetainedPostClaimRuntimes:new Map(),
    async pgClose(){calls.pgClose++;},process:processPort,clearInterval(){},
    console:{log(){},warn(){},error(message:string){errors.push(message);}},
    releaseSpawnerSingletonLock(){throw Error("COMPONENT_LEGACY_RELEASE_FORBIDDEN");},
  };
  const actualRelease=mode==="database-refusal"?whole(spawner,"releaseActiveProcessForShutdown"):"";
  // For DB refusal use the unchanged genuine function, whose getSql is before
  // its inner try. No downstream runtime/SQL body is replaced or executed.
  const bindings=Object.keys(ports).filter(key=>!(mode==="database-refusal"&&key==="releaseActiveProcessForShutdown"));
  const implementation=compile("let shuttingDown=false;let shutdownPromise:Promise<number>|undefined;const intervalHandles:unknown[]=[];"+whole(spawner,"releaseSpawnerProcessV1")+"\n"+actualRelease+"\n"+localVariable("shutdown").getText(spawner.tree));
  const shutdown=new Function(...bindings,implementation+";return shutdown;")(...bindings.map(key=>ports[key as keyof typeof ports])) as ()=>Promise<number>;
  return {shutdown,calls,activeProcesses,drainingProcesses,processPort,errors};
}
for(const mode of ["reject","database-refusal","quarantined","retained_for_recovery"] as const) {
  test("actual shutdown retains custody on "+mode+" without forced exit",async()=>{
    const c=shutdownComponent(mode);
    const first=c.shutdown();assert.equal(c.calls.retained,1,"retention before first awaited operation");
    assert.equal(await first,1);assert.equal(c.processPort.exitCode,1);
    assert.equal(c.calls.released,0);assert.equal(c.calls.forcedExit,0);assert.equal(c.activeProcesses.size,1);
    assert.equal(c.shutdown(),first,"same drain promise, no second attempt");
  });
}
test("listener close uncertainty also prevents explicit custody release",async()=>{
  const c=shutdownComponent("released",true);assert.equal(await c.shutdown(),1);
  assert.equal(c.calls.released,0);assert.equal(c.calls.forcedExit,0);assert.equal(c.activeProcesses.size,1);
});
test("actual shutdown releases only after complete component drain proof",async()=>{
  const c=shutdownComponent("released");assert.equal(await c.shutdown(),0);
  assert.equal(c.calls.retained,1);assert.equal(c.calls.released,1);assert.equal(c.calls.pgClose,1);
  assert.equal(c.activeProcesses.size,0);assert.equal(c.drainingProcesses.size,0);assert.equal(c.calls.forcedExit,0);
  // This fake success tests the closure's branching only; actual child drain
  // and DB/source authority remain separate genuine integration requirements.
});

test("selected global process sweep is harmless even in the existing timer callback",()=>{
  let reads=0;
  const sweep=new Function("SELECTED_SPAWNER_V1","execFileSync",compile(whole(spawner,"cleanupSpawnerDetachedToolChildren"))+";return cleanupSpawnerDetachedToolChildren;")({},()=>{reads++;return "";}) as (context:string)=>void;
  assert.doesNotThrow(()=>sweep("component"));assert.equal(reads,0);
  // The unchanged terminateActiveProcess timer has no catch: the actual helper
  // must return harmlessly even when called there, before any ambient ps.
  assert.ok(whole(spawner,"terminateActiveProcess").includes("cleanupSpawnerDetachedToolChildren(context)"));
  const poll=whole(spawner,"pollForPendingWork");
  assert.ok(poll.includes('if (!SELECTED_SPAWNER_V1) cleanupSpawnerDetachedToolChildren("poll-orphan-sweep");'));
});
test("fixed complete asset check brackets initial poll before IPC READY",()=>{
  const main=whole(spawner,"main"),poll='await pollForPendingWork();';
  assert.equal(main.split(poll).length-1,1);
  const [before,after]=main.split(poll);assert.ok(before&&after);
  const check='assertFreshInstallationPrivateAssetsV1(SELECTED_SPAWNER_V1.paths.root, SELECTED_SPAWNER_V1.state.origin.sourceSha);';
  assert.ok(before.lastIndexOf(check)>before.lastIndexOf('assertSelectedSpawnerStartupContinuesV1();'));
  assert.ok(after.indexOf(check)>=0&&after.indexOf(check)<after.indexOf('process.send!'));
});
