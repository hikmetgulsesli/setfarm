// Proposed tests/installation/fresh-installation-private-agent-cron.test.ts.
// Actual source bodies with DATA ports only: no production module imports,
// SQL, gateway, child, prompt file, HOME, environment or real timers are used.
import assert from "node:assert/strict";
import {test} from "node:test";
import {readFileSync,statSync} from "node:fs";
import ts from "typescript";
const file=new URL("../../src/installer/agent-cron.ts",import.meta.url);
assert.ok(statSync(file).size<=131072,"fixed source read bound");
const source=readFileSync(file,"utf8"),tree=ts.createSourceFile(file.pathname,source,ts.ScriptTarget.ESNext,true,ts.ScriptKind.TS);
const names=["setupAgentCrons","removeAgentCrons","ensureWorkflowCrons","teardownWorkflowCronsIfIdle","repairAgentCrons","syncActiveCrons","recoverActiveWorkflowCrons","actualCronCount"] as const;
type Name=typeof names[number];
function rows(name:string){return tree.statements.filter((n):n is ts.FunctionDeclaration=>ts.isFunctionDeclaration(n)&&n.name?.text===name);}
function whole(name:string){const matches=rows(name);assert.equal(matches.length,1,"exact top-level declaration: "+name);return matches[0]!.getText(tree).replace(/^export\s+/,"");}
function fixture(selection:unknown,modeError?:Error){
 const effects={sql:0,prompt:0,list:0,create:0,deleteOne:[] as string[],deletePrefix:[] as string[],tool:0,log:0,params:0,env:0,mode:0};
 // Omit a missing new private helper when running the genuine old functions for
 // RED. No substitute/fallback implementation is supplied or modeled.
 const helper=rows("useSharedGatewayCronLifecycleV1");assert.ok(helper.length<=1);
 const bodies=[...names,"gatewayAgentCronsEnabled","countActiveRuns","expectedCronCount"].map(whole);
 if(helper.length===1)bodies.push(helper[0]!.getText(tree));
 const ports={
  freshInstallationSelectionV1:selection,
  assertFreshInstallationSelectionUnchangedV1(){effects.mode++;if(modeError)throw modeError;},
  process:{env:new Proxy({},{get(){effects.env++;return "0";}})},
  async pgGet(){effects.sql++;return {cnt:0};},async pgQuery(){effects.sql++;return [];},
  async listCronJobs(){effects.list++;return {ok:true,jobs:[{id:"owned-a",name:"setfarm/component/developer"},{id:"owned-b",name:"setfarm/component/planner"},{id:"foreign",name:"setfarm/other/developer"}]};},
  async deleteAgentCronJobs(prefix:string){effects.deletePrefix.push(prefix);},
  async deleteCronJob(id:string){effects.deleteOne.push(id);},
  async createAgentCronJob(){effects.create++;return {ok:true};},
  async checkCronToolAvailable(){effects.tool++;return {ok:true};},
  buildPollingPrompt(){effects.prompt++;return "COMPONENT_ONLY";},
  logger:{info(){effects.log++;},warn(){effects.log++;},error(){effects.log++;}},
  PARALLEL_AGENTS_SET:new Set(["developer","reviewer","verifier"]),
 };
 const code=ts.transpileModule(bodies.join("\n"),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
 const api=new Function(...Object.keys(ports),code+";return {"+[...names,"expectedCronCount"].join(",")+"};")(...Object.values(ports)) as Record<Name|"expectedCronCount",(...args:unknown[])=>unknown>;
 const opaque=new Proxy({},{get(_target,key){effects.params++;if(key===Symbol.toPrimitive)return ()=>"component";if(key==="id")return "component";if(key==="agents")return [];if(key==="graceMs")return 0;return undefined;}});
 const args=(name:Name):unknown[]=>name==="recoverActiveWorkflowCrons"?[]:name==="syncActiveCrons"?[opaque,opaque]:name==="teardownWorkflowCronsIfIdle"?[opaque,opaque]:[opaque];
 const noSharedEffects=()=>{
  assert.equal(effects.sql,0);assert.equal(effects.prompt,0);assert.equal(effects.list,0);assert.equal(effects.create,0);assert.equal(effects.tool,0);
  assert.deepEqual(effects.deleteOne,[]);assert.deepEqual(effects.deletePrefix,[]);assert.equal(effects.log,0);assert.equal(effects.params,0);assert.equal(effects.env,0);
 };
 return {api,effects,args,opaque,noSharedEffects};
}

test("actual selected disabled sync never deletes the shared workflow prefix (cloud P1)",async()=>{
 const c=fixture({});await c.api.syncActiveCrons("component-run","component");
 // On the genuine old source this records [setfarm/component/], reproducing
 // the false-disabled cleanup branch without any real gateway request.
 assert.deepEqual(c.effects.deletePrefix,[]);assert.equal(c.effects.sql,0);assert.equal(c.effects.list,0);
});
for(const name of names){
 test("selected "+name+" returns before argument properties SQL prompt or gateway DATA",async()=>{
  const c=fixture({}),result=await c.api[name](...c.args(name));
  assert.deepEqual(result,name==="repairAgentCrons"?{added:0,removed:0}:name==="actualCronCount"?0:undefined);
  c.noSharedEffects();assert.equal(c.effects.mode,1);
 });
}
test("existing selected expected count remains zero before workflow property reads",()=>{
 const c=fixture({});assert.equal(c.api.expectedCronCount(c.opaque),0);c.noSharedEffects();assert.equal(c.effects.mode,1);
});
for(const name of ["syncActiveCrons","ensureWorkflowCrons","repairAgentCrons","removeAgentCrons"] as const){
 test("legacy disabled "+name+" still deletes only its exact existing prefix",async()=>{
  const c=fixture(null),workflow={id:"component",agents:[]};
  const result=await c.api[name](...(name==="syncActiveCrons"?["component-run","component"]:name==="removeAgentCrons"?["component"]:[workflow]));
  assert.deepEqual(c.effects.deletePrefix,["setfarm/component/"]);assert.deepEqual(c.effects.deleteOne,[]);
  assert.equal(c.effects.sql,0);assert.equal(c.effects.list,0);assert.equal(c.effects.create,0);assert.equal(c.effects.prompt,0);
  assert.deepEqual(result,name==="repairAgentCrons"?{added:0,removed:0}:undefined);
 });
}
test("legacy disabled setup recovery teardown and actual count retain old behavior",async()=>{
 const c=fixture(null),workflow={id:"component",agents:[]};
 await c.api.setupAgentCrons(workflow);await c.api.recoverActiveWorkflowCrons();await c.api.teardownWorkflowCronsIfIdle("component",{graceMs:0});
 assert.equal(c.effects.sql,1,"legacy teardown still checks active runs");assert.equal(c.effects.list,0);assert.deepEqual(c.effects.deletePrefix,[]);assert.deepEqual(c.effects.deleteOne,[]);
 assert.equal(await c.api.actualCronCount("component"),2,"legacy actual count still scans its exact prefix even when cron creation is disabled");assert.equal(c.effects.list,1);
 assert.equal(c.api.expectedCronCount(workflow),0);
});
test("captured-selection refusal escapes every public catch before shared work",async()=>{
 for(const name of names){
  const refusal=new Error("COMPONENT_CAPTURED_SELECTION_REFUSAL"),c=fixture(null,refusal);
  await assert.rejects(Promise.resolve().then(()=>c.api[name](...c.args(name))),(error:unknown)=>error===refusal);
  c.noSharedEffects();assert.equal(c.effects.mode,1,name);
 }
});
