import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {EventEmitter} from "node:events";
import {test} from "node:test";
import ts from "typescript";
const root=new URL("../../src/",import.meta.url);
const read=(name:string)=>readFileSync(new URL(name,root),"utf8");
function declaration(file:string,name:string):string{
 const source=read(file),tree=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true),rows=tree.statements.filter((n):n is ts.FunctionDeclaration=>ts.isFunctionDeclaration(n)&&n.name?.text===name);
 assert.equal(rows.length,1,"fixed source function missing/ambiguous: "+name);return rows[0]!.getText(tree);
}
const compile=(source:string)=>ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
test("selected status and stop precede all shared PID adoption and signals",()=>{
 for(const [file,name,marker] of [["server/daemonctl.ts","isRunning","const pidFile"],["server/daemonctl.ts","stopDaemon","const status"],["server/spawnerctl.ts","isSpawnerRunning","const pidFile"],["server/spawnerctl.ts","stopSpawner","const pids"]]){
  const source=declaration(file!,name!),gate=source.indexOf("if(selectedServiceControlV1())");assert.ok(gate>=0&&gate<source.indexOf(marker!));assert.doesNotMatch(source.slice(0,source.indexOf(marker!)),/prepareFreshInstallationOperationalEntryV1/);
 }
});
test("selected starts await actual admission before custody logs and child effects",()=>{
 for(const [file,name] of [["server/daemonctl.ts","startFreshDashboardDaemonV1"],["server/spawnerctl.ts","startFreshSpawnerV1"]]){
  const source=declaration(file!,name!),admit=source.indexOf("await prepareFreshInstallationOperationalEntryV1()");
  assert.ok(admit>=0&&admit<source.indexOf("inspectFreshServiceV1(")&&admit<source.indexOf("openFreshServiceLogV1(")&&admit<source.indexOf("spawn("));
  assert.match(source,/finally\s*\{\s*try\s*\{\s*fs\.closeSync\(log\);/);assert.match(source,/await waitFreshStartingChildReadyV1/);assert.match(source,/actual.pid!==child.pid/);
  assert.ok(source.indexOf("await waitFreshStartingChildReadyV1")<source.indexOf("child.unref()"));
 }
});
test("private readiness DATA component rejects wrong source PID port disconnect and exit",async()=>{
 for(const file of ["server/daemonctl.ts","server/spawnerctl.ts"]){
  const body=compile(declaration(file,"waitFreshStartingChildReadyV1"));
  const wait=new Function(body+";return waitFreshStartingChildReadyV1;")() as (c:unknown,s:string,sha:string,port?:number)=>Promise<void>;
  for(const failure of ["source","pid","port","extra","disconnect","exit"]){
   const child=Object.assign(new EventEmitter(),{pid:12345,exitCode:null as number|null,signalCode:null});
   const pending=wait(child,"dashboard","a".repeat(40),32123);
   const message={type:"setfarm.dashboard.ready.v1",pid:12345,sourceSha:"a".repeat(40),port:32123};
   if(failure==="disconnect")child.emit("disconnect");else if(failure==="exit"){child.exitCode=17;child.emit("exit",17,null);}else child.emit("message",failure==="extra"?{...message,unexpected:true}:{...message,[failure==="source"?"sourceSha":failure]:failure==="source"?"b".repeat(40):-1});
   await assert.rejects(pending,/FRESH_INSTALLATION_SERVICE_/);assert.equal(child.eventNames().length,0);
  }
 }
});
test("held spawner cleanup DATA component uses only TERM and retains unknown custody",async()=>{
 const body=compile(declaration("server/spawnerctl.ts","stopHeldFreshStartingChildV1"));let reclaimed=0;const signals:string[]=[];
 const stop=new Function("reclaimFreshServiceAfterHeldChildV1","setTimeout","clearTimeout",body+";return stopHeldFreshStartingChildV1;")(()=>{reclaimed++;},(fn:()=>void)=>setTimeout(fn,0),clearTimeout) as (c:unknown,s:string)=>Promise<void>;
 const child=Object.assign(new EventEmitter(),{pid:12345,exitCode:null,signalCode:null,kill(signal:string){signals.push(signal);return true;}});
 await assert.rejects(stop(child,"spawner"),/CLEANUP_UNCONFIRMED/);assert.deepEqual(signals,["SIGTERM"]);assert.equal(reclaimed,0);assert.equal(child.eventNames().length,0);
});

test("actual selected start bodies preserve spawn and log-close failures with held-child cleanup DATA",async()=>{
 for(const [file,name,service] of [["server/daemonctl.ts","startFreshDashboardDaemonV1","dashboard"],["server/spawnerctl.ts","startFreshSpawnerV1","spawner"]] as const){
  const body=compile(declaration(file,name));
  for(const mode of ["spawn-only","spawn-and-close","close-only","close-and-cleanup"] as const){
   const spawnFailure=new Error("component spawn failure"),closeFailure=new Error("component log close failure"),cleanupFailure=new Error("component held child cleanup failure");
   const child={pid:12345,exitCode:null,signalCode:null};let opened=0,spawned=0,closed=0,cleaned=0,waited=0;
   // Explicit DATA dependencies exercise this exact production function body;
   // no child process, filesystem, entry authority or selected success is real.
   const ports={
    prepareFreshInstallationOperationalEntryV1:async()=>{},assertFreshInstallationOperationalEntryV1:()=>{},
    freshInstallationSelectionV1:{paths:{repository:"/component/repository"},state:{origin:{sourceSha:"a".repeat(40)}}},
    inspectFreshServiceV1:()=>({running:false}),freshServicePathsV1:()=>({logFile:"/component/log"}),
    path:{join:(...parts:string[])=>parts.join("/")},process:{execPath:"/component/node",env:{SETFARM_AGENT_RUNTIME:"codex"}},
    freshServiceChildEnvironmentV1:()=>({}),openFreshServiceLogV1:(actual:string)=>{assert.equal(actual,service);opened++;return 71;},
    spawn:()=>{spawned++;if(mode==="spawn-only"||mode==="spawn-and-close")throw spawnFailure;return child;},
    fs:{closeSync:(fd:number)=>{assert.equal(fd,71);closed++;if(mode!=="spawn-only")throw closeFailure;}},
    waitFreshStartingChildReadyV1:async()=>{waited++;throw Error("component must fail before ready");},
    stopHeldFreshStartingChildV1:async(actual:unknown,kind:string)=>{assert.equal(actual,child);assert.equal(kind,service);cleaned++;if(mode==="close-and-cleanup")throw cleanupFailure;},
   };
   const start=new Function(...Object.keys(ports),body+";return "+name+";")(...Object.values(ports)) as (port?:number)=>Promise<unknown>;
   await assert.rejects(start(service==="dashboard"?32123:undefined),(error:unknown)=>{
    if(mode==="spawn-only")assert.equal(error,spawnFailure);
    else if(mode==="close-only")assert.equal(error,closeFailure);
    else{assert.ok(error instanceof AggregateError);assert.deepEqual(error.errors,mode==="spawn-and-close"?[spawnFailure,closeFailure]:[closeFailure,cleanupFailure]);}
    return true;
   });
   assert.equal(opened,1);assert.equal(spawned,1);assert.equal(closed,1);assert.equal(waited,0);
   assert.equal(cleaned,mode==="spawn-only"||mode==="spawn-and-close"?0:1);
  }
 }
});
