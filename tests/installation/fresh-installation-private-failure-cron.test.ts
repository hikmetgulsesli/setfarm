// Proposed tests/installation/fresh-installation-private-failure-cron.test.ts.
// Actual source-body DATA components. No production module import, DB, child,
// cron, HOME, environment reads or operational/source authority are exercised.
import assert from "node:assert/strict";
import {test} from "node:test";
import {readFileSync,statSync} from "node:fs";
import ts from "typescript";
const file=new URL("../../src/installer/step-fail.ts",import.meta.url);
assert.ok(statSync(file).size<=131072,"fixed component source bound");
const source=readFileSync(file,"utf8"),tree=ts.createSourceFile(file.pathname,source,ts.ScriptTarget.ESNext,true,ts.ScriptKind.TS);
function declaration(name:string):ts.FunctionDeclaration {
 const rows=tree.statements.filter((n):n is ts.FunctionDeclaration=>ts.isFunctionDeclaration(n)&&n.name?.text===name);
 assert.equal(rows.length,1,"one exact top-level function: "+name);return rows[0]!;
}
function whole(name:string){return declaration(name).getText(tree).replace(/^export\s+/,"");}
const compile=(s:string)=>ts.transpileModule(s,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
test("actual failStep fixed entry rejects before any DB or failure-body access",async()=>{
 const body=declaration("failStep");assert.equal(body.body?.statements[0]?.getText(tree),"assertStepFailureInstallationV1();");
 const refusal=new Error("COMPONENT_ACTUAL_ENTRY_REFUSAL");let calls=0;
 const fail=new Function("assertStepFailureInstallationV1",compile(whole("failStep"))+";return failStep;")(()=>{calls++;throw refusal;}) as (...args:unknown[])=>Promise<unknown>;
 await assert.rejects(fail("component-step","component-error"),(error:unknown)=>error===refusal);assert.equal(calls,1);
});
function component(selected:unknown,modeRefusal?:Error,execFailure?:Error,refuseAt=1) {
 const calls={selection:0,entry:0,workflow:0,cli:[] as Array<{command:string;args:string[];options:unknown}>,prompt:[] as unknown[][],warn:0,transitions:[] as unknown[][],states:[] as unknown[],refresh:[] as unknown[][]};
 const ports={
  freshInstallationSelectionV1:selected,
  assertFreshInstallationSelectionUnchangedV1(){calls.selection++;if(modeRefusal&&calls.selection>=refuseAt)throw modeRefusal;},
  assertFreshInstallationOperationalEntryV1(){calls.entry++;},
  async getWorkflowId(runId:string){assert.equal(runId,"component-run");calls.workflow++;return "component-workflow";},
  DEFAULT_DEVELOPER_AGENTS:["component-fallback"],STORY_FALLBACK_MODEL:"component-model",STORY_FALLBACK_RETRY_THRESHOLD:2,
  buildPollingPrompt(...args:unknown[]){calls.prompt.push(args);return "component polling prompt";},
  Date:{now:()=>12345},process:{env:{}},path:{join:(...args:string[])=>args.join("/")},homedir:()=>"/component-home",
  execFileSync(command:string,args:string[],options:unknown){calls.cli.push({command,args,options});if(execFailure)throw execFailure;},
  logger:{info(){},warn(){calls.warn++;}},
  async prepareShadowAttemptFailure(){return {status:"not_prepared"};},
  async pgGet(){return {id:"component-story-db",retry_count:1,max_retries:5,output:"component prior"};},
  async getStoryInfo(){return {story_id:"component-story",title:"Component title"};},
  preserveActionableStoryRetryOutput:(prior:string,error:string)=>prior+" | "+error,
  async terminalizeLoopClaimAndState(value:unknown){calls.states.push(value);},
  async recordStepTransition(...args:unknown[]){calls.transitions.push(args);},
  async refreshRunContractSafe(...args:unknown[]){calls.refresh.push(args);},
 };
 const names=["assertStepFailureInstallationV1","useLegacyFailureCronV1","fireFallbackRetryCron","isTransientAgentInfrastructureFailure","handleLoopStepFailurePG"];
 const api=new Function(...Object.keys(ports),compile(names.map(whole).join("\n"))+";return {fireFallbackRetryCron,handleLoopStepFailurePG};")(...Object.values(ports)) as {
  fireFallbackRetryCron(step:unknown,story:unknown,retry:number):Promise<void>;
  handleLoopStepFailurePG(stepId:string,step:unknown,error:string):Promise<{retrying:boolean;runFailed:boolean}>;
 };
 return {...api,calls};
}
const step={run_id:"component-run",step_id:"implement",step_index:1,retry_count:0,max_retries:5,type:"loop",current_story_id:"component-story-db",agent_id:"component_implement"};
const story={story_id:"component-story",title:"Component title"};
test("selected direct cron helper returns before workflow prompt HOME or CLI access",async()=>{
 const c=component({});await c.fireFallbackRetryCron(step,story,2);
 assert.equal(c.calls.selection,1);assert.equal(c.calls.entry,1);assert.equal(c.calls.workflow,0);assert.deepEqual(c.calls.prompt,[]);assert.deepEqual(c.calls.cli,[]);assert.equal(c.calls.warn,0);
});
test("late mode refusal stays outside the legacy best-effort catch",async()=>{
 const refusal=new Error("COMPONENT_STICKY_MODE_REFUSAL"),c=component(null,refusal);
 await assert.rejects(c.fireFallbackRetryCron(step,story,2),(error:unknown)=>error===refusal);
 assert.equal(c.calls.workflow,0);assert.deepEqual(c.calls.cli,[]);assert.equal(c.calls.warn,0);
});
test("legacy cron actual argument construction remains intact",async()=>{
 const c=component(null);await c.fireFallbackRetryCron(step,story,2);
 assert.equal(c.calls.entry,0);assert.equal(c.calls.workflow,1);assert.deepEqual(c.calls.prompt,[["component-workflow","implement","component-fallback"]]);
 assert.deepEqual(c.calls.cli,[{command:"/component-home/.local/bin/openclaw",args:["cron","add","--name","setfarm/fallback-retry/12345-component-story-r2","--agent","component-fallback","--model","component-model","--at","+10s","--delete-after-run","--exact","--session","isolated","--payload",JSON.stringify({kind:"agentTurn",message:"component polling prompt",timeoutSeconds:1800})],options:{timeout:15000,stdio:"pipe"}}]);
});
test("actual loop retry preserves pending state and retry return without selected shared cron",async()=>{
 const selected=component({}),legacy=component(null);
 for(const c of [selected,legacy])assert.deepEqual(await c.handleLoopStepFailurePG("component-step-db",step,"component product failure"),{retrying:true,runFailed:false});
 // The unawaited legacy helper's existing internal await must also settle.
 await Promise.resolve();
 assert.deepEqual(selected.calls.states,legacy.calls.states);assert.deepEqual(selected.calls.transitions,legacy.calls.transitions);assert.deepEqual(selected.calls.refresh,legacy.calls.refresh);
 assert.equal(selected.calls.states.length,1);assert.deepEqual((selected.calls.states[0] as {state:unknown}).state,{storyStatus:"pending",storyOutput:"component prior | component product failure",storyRetryCount:2,clearStoryClaim:true,stepStatus:"pending",stepOutput:"component product failure"});
 assert.equal(selected.calls.workflow,0);assert.deepEqual(selected.calls.cli,[]);assert.equal(legacy.calls.cli.length,1);
});
test("legacy cron creation failure retains existing normal retry behavior",async()=>{
 const c=component(null,undefined,new Error("COMPONENT_CLI_FAILURE"));
 await c.fireFallbackRetryCron(step,story,2);assert.equal(c.calls.cli.length,1);assert.equal(c.calls.warn,1);
});

test("captured absence is rechecked after workflow await before prompt or shared CLI",async()=>{
 const refusal=new Error("COMPONENT_POST_AWAIT_MODE_REFUSAL"),c=component(null,refusal,undefined,2);
 await c.fireFallbackRetryCron(step,story,2);
 assert.equal(c.calls.selection,2);assert.equal(c.calls.workflow,1);
 assert.deepEqual(c.calls.prompt,[]);assert.deepEqual(c.calls.cli,[]);assert.equal(c.calls.warn,1);
});
