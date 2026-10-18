// Proposed tests/installation/fresh-installation-unit3-controls.test.ts.
// Source-body components ONLY: entry/build/database authority is stubbed here.
// No operational readiness or real PG transport qualification is asserted.
// Listener cases use fake SQL. Log cases own a temp FIFO and one bounded Node
// child executing extracted file-body code; no service/network/database launch.
import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import vm from "node:vm";
import { spawnSync } from "node:child_process";
import ts from "typescript";

const source = (relative:string):ts.SourceFile => {
  const file=path.join(process.cwd(),relative);
  return ts.createSourceFile(file,fs.readFileSync(file,"utf8"),ts.ScriptTarget.ESNext,true,ts.ScriptKind.TS);
};
function functionText(file:ts.SourceFile,name:string,optional=false):string {
  const rows=file.statements.filter((node):node is ts.FunctionDeclaration=>ts.isFunctionDeclaration(node)&&node.name?.text===name);
  if(optional&&rows.length===0)return "";
  assert.equal(rows.length,1,"exact top-level function "+name);
  return rows[0]!.getText(file).replace(/^export\s+/,"");
}
function variableText(file:ts.SourceFile,name:string):string {
  const rows=file.statements.filter((node):node is ts.VariableStatement=>ts.isVariableStatement(node)&&node.declarationList.declarations.some(d=>ts.isIdentifier(d.name)&&d.name.text===name));
  assert.equal(rows.length,1,"exact top-level constant "+name);return rows[0]!.getText(file);
}
function compile(text:string):string {
  return ts.transpileModule(text,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
}
function deferred(){let resolve!:()=>void;const promise=new Promise<void>(r=>{resolve=()=>r();});return {promise,resolve};}
const fixedChannels=["step_pending","story_pending","run_termination_requested","runtime_completion_requested"] as const;
type Listener={backendPid:number;listen(channel:string,callback:(payload:string)=>void):Promise<void>;arm():Promise<void>;closed:Promise<Error|null>;end():Promise<void>};
type DriverOptions={onnotify(channel:string,payload:string):void;onclose():void};
async function listenerComponent(){
  const file=source("src/installation/fresh-installation-spawner-listener-v1.ts");
  const original=functionText(file,"openFreshInstallationSpawnerListenerV1");
  const expression='await import("./fresh-installation-activation-verifier-v1.js")';
  assert.equal(original.split(expression).length-1,1,"one exact verifier import seam");
  // The one replacement is explicitly a transport-state component stub, never
  // a production verifier port or an operational positive authority.
  const body=original.replace(expression,"componentVerifier");
  const entered=deferred(),gates=new Map<string,ReturnType<typeof deferred>>();
  let options:DriverOptions|undefined,releases=0,ends=0,verifications=0;
  const activation={acknowledged:true},state={runtimeUrl:"postgresql://component@127.0.0.1/component"};
  const sql={
    async unsafe(statement:string){
      if(statement==='SELECT pg_backend_pid()::integer AS pid')return [{pid:43101}];
      if(statement.startsWith('LISTEN "')){
        const channel=statement.slice(8,-1);assert.ok(fixedChannels.includes(channel as typeof fixedChannels[number]));
        assert.equal(gates.has(channel),false);const gate=deferred();gates.set(channel,gate);
        if(gates.size===fixedChannels.length)entered.resolve();await gate.promise;return [];
      }
      assert.ok(statement==='BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY'||statement.startsWith("SELECT set_config(")||statement==='COMMIT'||statement==='ROLLBACK',statement);
      return [];
    },
    release(){releases++;},
  };
  const pool={async reserve(){return sql;},async end(){ends++;}};
  const open=vm.runInNewContext(compile(variableText(file,"channels")+"\n"+body+"\nopenFreshInstallationSpawnerListenerV1;"),{
    postgres(_url:string,actual:DriverOptions){assert.equal(_url,state.runtimeUrl);options=actual;return pool;},
    freshInstallationSelectionV1:{activation,state,assertUnchanged(){}},
    async prepareFreshInstallationOperationalEntryV1(){},assertFreshInstallationOperationalEntryV1(){},
    componentVerifier:{async verifyFreshInstallationActivatedDatabaseOnTransactionV1(actual:unknown,a:unknown,b:unknown,mode:unknown){assert.equal(actual,sql);assert.equal(a,activation);assert.equal(b,state);assert.equal(mode,"runtime");verifications++;}},
  }) as ()=>Promise<Listener>;
  const listener=await open();assert.equal(verifications,1);assert.equal(listener.backendPid,43101);
  assert.ok(options);
  return {listener,gates,entered,options,get releases(){return releases;},get ends(){return ends;}};
}
function subscriptions(f:Awaited<ReturnType<typeof listenerComponent>>,delivered:string[]){
  const promises=fixedChannels.map(channel=>f.listener.listen(channel,payload=>delivered.push(channel+":"+payload)));
  // Attach rejection observation before intentionally poisoning an early arm.
  const settled=Promise.allSettled(promises);return {promises,settled};
}

test("listener component: four registered but pending LISTENs cannot arm",{timeout:2000},async()=>{
  const f=await listenerComponent(),delivered:string[]=[],work=subscriptions(f,delivered);
  try{
    await f.entered.promise;
    await assert.rejects(f.listener.arm(),/FRESH_SPAWNER_LISTENER_REFUSED/);
    assert.match(String(await f.listener.closed),/FRESH_SPAWNER_LISTENER_REFUSED/);
    f.options.onnotify("step_pending","not-authority");assert.deepEqual(delivered,[]);
  }finally{for(const gate of f.gates.values())gate.resolve();await work.settled;await f.listener.end();}
  assert.equal(f.releases,1);assert.equal(f.ends,1);
});

test("listener component: three completed plus one pending LISTEN cannot arm",{timeout:2000},async()=>{
  const f=await listenerComponent(),work=subscriptions(f,[]);
  try{
    await f.entered.promise;
    for(const channel of fixedChannels.slice(0,3))f.gates.get(channel)!.resolve();
    await Promise.all(work.promises.slice(0,3));
    await assert.rejects(f.listener.arm(),/FRESH_SPAWNER_LISTENER_REFUSED/);
  }finally{for(const gate of f.gates.values())gate.resolve();await work.settled;await f.listener.end();}
});

test("listener component: all four completed same-backend subscriptions can arm",{timeout:2000},async()=>{
  const f=await listenerComponent(),delivered:string[]=[],work=subscriptions(f,delivered);
  try{
    await f.entered.promise;f.options.onnotify("step_pending","early");assert.deepEqual(delivered,[]);
    for(const gate of f.gates.values())gate.resolve();
    const rows=await work.settled;assert.ok(rows.every(row=>row.status==="fulfilled"));
    await f.listener.arm();f.options.onnotify("step_pending","after-arm");
    assert.deepEqual(delivered,["step_pending:after-arm"]);
  }finally{for(const gate of f.gates.values())gate.resolve();await work.settled;await f.listener.end();}
});

function logComponentProgram(root:string):string {
  const file=source("src/server/fresh-installation-service-controls-v1.ts");
  const declarations=[variableText(file,"identityKeys"),...['refuse','sameIdentity','privateDirectory'].map(name=>functionText(file,name)),functionText(file,"plainPrivateLog",true),functionText(file,"openFreshServiceLogV1")].join("\n");
  return [
    'import fs from "node:fs";import path from "node:path";',
    'const root='+JSON.stringify(root)+';',
    // Fixed owned fixture context is deliberately not an activation claim.
    'function assertFreshInstallationOperationalEntryV1(){}',
    'function currentContext(){return {s:{paths:{root}},paths:{directory:path.join(root,"services"),logFile:path.join(root,"services","dashboard.log")}};}',
    compile(declarations),
    'try{const fd=openFreshServiceLogV1("dashboard");fs.closeSync(fd);console.log(JSON.stringify({accepted:true}));}catch(error){console.log(JSON.stringify({accepted:false,error:error.message}));process.exitCode=2;}',
  ].join("\n");
}
function withLogFixture(fifo:boolean){
  const created=fs.mkdtempSync(path.join(os.tmpdir(),"setfarm-unit3-log-component-"));
  const root=fs.realpathSync(created);fs.chmodSync(root,0o700);
  try{
    const directory=path.join(root,"services");fs.mkdirSync(directory,{mode:0o700});
    const log=path.join(directory,"dashboard.log");
    if(fifo){
      const made=spawnSync("/usr/bin/mkfifo",["-m","600",log],{encoding:"utf8",timeout:2000,maxBuffer:8192});
      assert.equal(made.error,undefined);assert.equal(made.signal,null);assert.equal(made.status,0,made.stderr);
    }else fs.writeFileSync(log,"",{flag:"wx",mode:0o600});
    const program=path.join(root,"log-body.mjs");fs.writeFileSync(program,logComponentProgram(root),{flag:"wx",mode:0o600});
    const child=spawnSync(process.execPath,[program],{encoding:"utf8",timeout:1500,maxBuffer:8192,stdio:["ignore","pipe","pipe"]});
    // V1's blocking FIFO open times out here; V2 must refuse normally before it.
    assert.equal(child.error,undefined,"log body did not settle without blocking");assert.equal(child.signal,null);
    assert.equal(child.status,fifo?2:0,child.stderr);
    const result=JSON.parse(child.stdout);
    assert.equal(result.accepted,!fifo);
    if(fifo){assert.equal(result.error,"FRESH_INSTALLATION_SERVICE_CONTROL_REFUSED");assert.ok(fs.lstatSync(log).isFIFO());}
    else{const stat=fs.lstatSync(log);assert.ok(stat.isFile());assert.equal(stat.size,0);assert.equal(stat.mode&0o777,0o600);}
  }finally{
    assert.equal(fs.realpathSync(created),root);fs.rmSync(root,{recursive:true,force:true});
  }
}
test("log component: an owned private FIFO is refused before blocking open",{timeout:5000},()=>withLogFixture(true));
test("log component: an owned private empty regular log remains valid",{timeout:5000},()=>withLogFixture(false));
