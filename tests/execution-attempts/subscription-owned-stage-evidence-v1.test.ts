import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import path from "node:path";
import {it} from "node:test";
import ts from "typescript";
import {compileEvidencePlanV1} from "../../src/evidence/evidence-plan-v1.js";
import {ImplementationSliceV1Schema} from "../../src/product-compiler/schemas/implementation-slice-v1.js";
import {buildMinimalValidContracts} from "../product-compiler/fixtures/minimal-valid-contract.js";

// Exact production bodies in a finite Source-DATA realm. No step-ops, installer,
// runtime driver, DB, selected profile, child process or provider module import.
const source=(file:string)=>readFileSync(new URL("../../src/"+file,import.meta.url),"utf8");
function declarations(file:string,names:string[],optional:string[]=[]){const text=source(file),tree=ts.createSourceFile(file,text,ts.ScriptTarget.Latest,true);
  const rows=tree.statements.filter((n):n is ts.FunctionDeclaration=>ts.isFunctionDeclaration(n)&&!!n.name&&[...names,...optional].includes(n.name.text));
  for(const name of names)assert.equal(rows.filter(n=>n.name?.text===name).length,1,"production function required: "+name);
  return rows.map(n=>n.getText(tree).replace(/^export\s+/,"")).join("\n");}
function evaluate(code:string,ports:Record<string,any>,result:string){const js=ts.transpileModule(code,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
  return new Function(...Object.keys(ports),js+";return "+result+";")(...Object.values(ports));}
function setup(freshOk:boolean,staleOk:boolean){
  const events:string[]=[],reportPath="/product/.setfarm/setup/DESIGN_IMPORT_VALIDATE.json";
  let report:any={ok:staleOk,status:staleOk?"pass":"fail",failures:["old validation failure"]};
  const files:Record<string,string>={["/product/package.json"]:JSON.stringify({scripts:{build:"vite build"}})};
  const context:Record<string,string>={repo:"/product",baseline_fail:"previous design import validation failed",failure_category:"design_import_failure"};
  const ports={path,process:{env:{}},Buffer,DESIGN_IMPORT_REPORT_REL:".setfarm/setup/DESIGN_IMPORT_VALIDATE.json",
    fs:{existsSync:(file:string)=>file===reportPath||Object.hasOwn(files,file)||file==="/platform/generated-screen-validator.mjs",
      readFileSync:(file:string)=>file===reportPath?JSON.stringify(report):files[file],rmSync:(file:string)=>{assert.equal(file,reportPath);events.push("remove-stale-report");report=undefined;}},
    resolvePlatformScript:(name:string)=>{assert.equal(name,"generated-screen-validator.mjs");return "/platform/"+name;},
    execFileSync:(command:string,args:string[])=>{if(command==="node"){
      assert.deepEqual(args,["/platform/generated-screen-validator.mjs","/product","--fix"]);events.push("fresh-validator");
      report={ok:freshOk,status:freshOk?"pass":"fail",failures:["current generated screen invalid"]};
      if(!freshOk)throw Object.assign(Error("current generated screen invalid"),{status:1,stderr:"current generated screen invalid"});
    }else {assert.equal(command,"npm");assert.deepEqual(args,["run","build"]);events.push("build");}return "";},
    materializeSetupBuildContracts:async()=>{events.push("contracts");return{manifest:{resolvedTargets:[]},certificate:{}};},
  };
  const code=declarations("installer/steps/05-setup-build/guards.ts",["cleanProcessText","formatProcessFailure","resolveRepo","clearPreclaimFailureContext",
    "appendSetupQualityWarning","refreshCompatFailure","refreshBaselineFailure","onComplete"],["refreshSetupBuildDesignValidationV1"]);
  return{events,context,complete:evaluate(code,ports,"onComplete")};
}
it("setup-build retry reruns owned screen validator and refuses a fresh failure despite stale pass",async()=>{
  const f=setup(false,true);await assert.rejects(f.complete({runId:"run-fresh-setup",parsed:{status:"done"},context:f.context}),/DESIGN_IMPORT_VALIDATE|current generated screen/);
  assert.ok(f.events.includes("fresh-validator"));assert.equal(f.events.includes("build"),false);assert.equal(f.events.includes("contracts"),false);
});
it("setup-build retry replaces stale validator failure before current build and contract publication",async()=>{
  const f=setup(true,false);await f.complete({runId:"run-fresh-setup",parsed:{status:"done"},context:f.context});
  assert.deepEqual(f.events,["remove-stale-report","fresh-validator","build","contracts"]);assert.equal(f.context.baseline_fail,undefined);
});
function openMergeClause(){const file="installer/step-ops.ts",text=source(file),tree=ts.createSourceFile(file,text,ts.ScriptTarget.Latest,true),rows:ts.IfStatement[]=[];
  const visit=(node:ts.Node)=>{if(ts.isIfStatement(node)&&node.expression.getText(tree)==='prState === "OPEN"'
    &&node.thenStatement.getText(tree).includes("tryAutoMergePR(")&&node.thenStatement.getText(tree).includes("prReviewSettleComplete("))rows.push(node);ts.forEachChild(node,visit);};
  visit(tree);assert.equal(rows.length,1,"actual verify OPEN merge clause must remain unique");return rows[0]!.getText(tree);}
function verify(failCommand?:string){
  const events:string[]=[],context:Record<string,string>={repo:"/product",build_cmd:"npm run build",test_cmd:"npm test",lint_cmd:"npm run lint"};
  const ports:Record<string,any>={context,verifiedStoryId:"US-001",verifiedRow:{pr_url:"https://example.invalid/pr/1",story_branch:"story-1"},
    verifyStep:{id:"step-db",run_id:"run-verify",step_id:"verify",step_index:6},
    prReviewSettleComplete:()=>true,logger:{info(){},warn(){}},
    runPostMergeBuildGate:(_repo:string,command:string)=>{events.push(command);return{ok:command!==failCommand,output:"owned command output",failure:"current configured command failed"};},
    updateRunContext:async()=>{},setStepStatus:async()=>{},routeVerifyScopeFailureToImplement:async()=>true,
    tryAutoMergePR:()=>{events.push("merge");return true;},invalidatePRStateCache:()=>{},fetchFreshPrStateName:async()=>"MERGED"};
  const helper=declarations("installer/step-ops.ts",[],["runOwnedPreMergeVerificationV1"]);
  if(helper)ports.runOwnedPreMergeVerificationV1=evaluate(helper,ports,"runOwnedPreMergeVerificationV1");
  const route=evaluate('async function route(){let prState="OPEN";'+openMergeClause()+'}',ports,"route");
  return{events,context,route};
}
it("actual verify merge clause runs current configured build test and lint before merging",async()=>{
  const f=verify();await f.route();assert.deepEqual(f.events,["npm run build","npm test","npm run lint","merge"]);
});
it("actual verify merge clause refuses a failed configured test before irreversible merge",async()=>{
  const f=verify("npm test");await f.route();assert.deepEqual(f.events,["npm run build","npm test"]);assert.match(f.context.previous_failure||"",/failed|FAIL|test/i);
});
it("mandatory stage candidate commands remain owned with gate off and preserve disabled/advisory visual reporting",async()=>{
  const slice=ImplementationSliceV1Schema.parse(buildMinimalValidContracts().implementationSlice),sliceHash="f".repeat(64);
  const envelope={schema:"setfarm.claim-envelope.v1",protocol:"v3",issuedAt:"2026-11-04T12:00:00.000Z",runId:"run-stage",stepId:"step-supervise",workflowStepId:"supervise",
    claimId:901,claimAgentId:"feature-dev_supervisor",runtimeAgentId:"supervisor",workdir:"/product"};
  const stageClaim={workflowStepId:"supervise",claimId:901,runtimeSessionId:"RTS_00000000-0000-0000-0000-000000000901",requestId:"RCR_00000000-0000-0000-0000-000000000901",
    ownerAttemptCount:1,outputHash:"9".repeat(64),envelope,boundSubject:{kind:"story_member",storyDbId:"story-db",storyId:slice.storyId,storyIndex:1,storyClaimGeneration:4},
    sourceBefore:{sha:"1".repeat(40),treeHash:"2".repeat(40)}};
  for(const visualGate of ["off","advisory"]){
    const events:string[]=[],artifacts:any[]=[],config={mode:"off",visualGate,visualProvider:"none"};
    const ports:Record<string,any>={path,Date,readImplementEvidenceConfig:()=>config,compileEvidencePlanV1,
      implementEvidenceArtifactPaths:()=>({evidence:"/product/.setfarm/IMPLEMENT_EVIDENCE.json",request:"/product/request.json"}),
      writeV3EvidenceArtifacts:()=>{events.push("sealed-plan");return[];},hasPackageScript:()=>true,readJson:()=>({}),flattenEvidencePlanInteractions:()=>[],
      runDeclaredCommand:(_repo:string,command:any)=>{events.push("owned-command");return{...command,cmd:"npm test",exitCode:1,summary:"fresh test failed",stdout:"",stderr:"fail",startedAt:new Date().toISOString(),completedAt:new Date().toISOString()};},
      createCanonicalEvidenceBundleV2:(actual:any)=>{assert.deepEqual(actual.stageClaim,stageClaim);assert.equal(Object.hasOwn(actual,"attemptId"),false);return{bundle:{aggregateVerdict:"fail"}};},
      fs:{mkdirSync(){},writeFileSync:(_file:string,contents:string)=>artifacts.push(JSON.parse(contents))}};
    ports.currentVisualEvidenceResult=evaluate(declarations("installer/implement-evidence-writer.ts",["currentVisualEvidenceResult"]),ports,"currentVisualEvidenceResult");
    ports.writeImplementEvidenceArtifact=evaluate(declarations("installer/implement-evidence-writer.ts",["writeImplementEvidenceArtifact"]),ports,"writeImplementEvidenceArtifact");
    const run=evaluate(declarations("installer/implement-evidence-runner.ts",["runImplementEvidenceIfRequested"]),ports,"runImplementEvidenceIfRequested");
    const result=await run({runId:envelope.runId,storyId:slice.storyId,workdir:"/product",v3:{slice,sliceHash,stageClaim,sourceRevision:stageClaim.sourceBefore}});
    assert.equal(result.attempted,true);assert.equal(result.ok,false);assert.ok(events.includes("owned-command"));
    assert.equal(artifacts[0].visualEvidence.status,visualGate==="off"?"disabled":"skipped");assert.equal(artifacts[0].visualEvidence.mode,visualGate);assert.equal(artifacts[0].visualEvidence.provider,"none");
  }
});
