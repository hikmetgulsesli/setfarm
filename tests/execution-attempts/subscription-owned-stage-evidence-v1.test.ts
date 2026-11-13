import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import path from "node:path";
import {it} from "node:test";
import crypto from "node:crypto";
import {canonicalJsonStringify,hashCanonicalJson} from "../../src/product-compiler/canonical-json.js";
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
  const owners=tree.statements.filter((node):node is ts.FunctionDeclaration=>ts.isFunctionDeclaration(node)&&node.name?.text==="handleVerifyEachCompletion");
  assert.equal(owners.length,1,"actual handleVerifyEachCompletion must remain unique");
  visit(owners[0]!);assert.equal(rows.length,1,"actual verify OPEN merge clause must remain unique inside handleVerifyEachCompletion");return rows[0]!.getText(tree);}
function verify(failCommand?:string,options:{driftAfterTest?:boolean;storyTestFails?:boolean}={}){
  const events:string[]=[],repos:string[]=[],mergeArguments:unknown[][]=[];let head="1".repeat(40);
  const context:Record<string,string>={repo:"/product-base",story_workdir:"/product-story",build_cmd:"npm run build",test_cmd:"npm test",lint_cmd:"npm run lint"};
  const ports:Record<string,any>={path,context,verifiedStoryId:"US-001",verifiedRow:{id:"story-db-1",pr_url:"https://example.invalid/pr/1",story_branch:"story-1"},
    verifyStep:{id:"step-db",run_id:"run-verify",step_id:"verify",step_index:6},
    prReviewSettleComplete:()=>true,logger:{info(){},warn(){}},
    claimEnvelope:{schema:"setfarm.claim-envelope.v1",protocol:"v3",issuedAt:"2026-11-04T12:00:00.000Z",runId:"run-verify",stepId:"step-db",workflowStepId:"verify",
      claimId:902,claimAgentId:"feature-dev_reviewer",runtimeAgentId:"reviewer",workdir:"/product-story"},
    reviewedHeadSha:"1".repeat(40),getPRHeadBranch:()=>"story-1",
    fs:{existsSync:()=>true},execFileSync:(_command:string,args:string[],opts:any)=>{
      assert.deepEqual(args,["branch","--show-current"]);assert.equal(opts.cwd,"/product-story");return "story-1";},
    pgGet:async()=>({id:"story-db-1",story_id:"US-001",story_branch:"story-1",pr_url:"https://example.invalid/pr/1",run_id:"run-verify"}),
    readDefaultGithubReview:async()=>({prState:"OPEN",headSha:"1".repeat(40),actionableThreads:[]}),
    execPlatformGit:(args:string[],opts:any)=>{assert.equal(opts.cwd,"/product-story");
      if(args[0]==="rev-parse")return head;if(args[0]==="status")return "";throw Error("unexpected git command");},
    captureV3GitCommitRevision:(input:any)=>({sha:input.commitSha,treeHash:"2".repeat(40)}),canonicalJsonStringify,
    parseGitStatusPaths:()=>[],isPlatformNonStoryCommitPath:()=>false,
    runPostMergeBuildGate:(repo:string,command:string)=>{events.push(command);repos.push(repo);
      if(command==="npm test"&&options.driftAfterTest)head="3".repeat(40);
      return{ok:command!==failCommand&&!(options.storyTestFails&&repo==="/product-story"&&command==="npm test"),output:"owned command output",failure:"current configured command failed"};},
    updateRunContext:async()=>{},setStepStatus:async()=>{},routeVerifyScopeFailureToImplement:async()=>true,
    tryAutoMergePR:(...args:unknown[])=>{events.push("merge");mergeArguments.push(args);return true;},invalidatePRStateCache:()=>{},fetchFreshPrStateName:async()=>"MERGED"};
  const helper=declarations("installer/step-ops.ts",["assertExactGitBranchWorktree","runOwnedPreMergeVerificationV1"],["authenticateOwnedPreMergeCheckoutV1"]);
  ports.runOwnedPreMergeVerificationV1=evaluate(helper,ports,"runOwnedPreMergeVerificationV1");
  if(helper.includes("function authenticateOwnedPreMergeCheckoutV1"))ports.authenticateOwnedPreMergeCheckoutV1=evaluate(helper,ports,"authenticateOwnedPreMergeCheckoutV1");
  const route=evaluate('async function route(){let prState="OPEN";'+openMergeClause()+'}',ports,"route");
  return{events,repos,mergeArguments,context,route};
}
it("actual verify merge clause runs current configured build test and lint before merging",async()=>{
  const f=verify();await f.route();assert.deepEqual(f.events,["npm run build","npm test","npm run lint","merge"]);
});
it("actual verify merge clause refuses a failed configured test before irreversible merge",async()=>{
  const f=verify("npm test");await f.route();assert.deepEqual(f.events,["npm run build","npm test"]);assert.match(f.context.previous_failure||"",/failed|FAIL|test/i);
});
it("actual premerge checks use the authenticated story checkout instead of a passing base repo",async()=>{
  const f=verify(undefined,{storyTestFails:true});await f.route();
  assert.deepEqual(f.repos,["/product-story","/product-story"]);assert.equal(f.events.includes("merge"),false);
});
it("a changed reviewed story head during configured checks refuses merge",async()=>{
  const f=verify(undefined,{driftAfterTest:true});await f.route();
  assert.equal(f.events.includes("merge"),false);assert.match(f.context.previous_failure||"",/HEAD|SOURCE|CHANGED|MISMATCH/);
});
it("actual verify caller passes the authenticated tested source SHA into merge",async()=>{
  const f=verify();await f.route();
  assert.deepEqual(f.mergeArguments,[["https://example.invalid/pr/1","US-001","run-verify","1".repeat(40)]]);
});
function mergeFixture(options:{protectionOnce?:boolean;headMismatch?:boolean;capturedHead?:string}={}){
  const url="https://example.invalid/pr/1",sha="1".repeat(40),calls:Array<{command:string;args:string[];options:unknown}>=[];
  let merges=0,invalidated=0;
  const ports={GH_CLI_TIMEOUT:17001,GH_MERGE_TIMEOUT:37001,logger:{info(){},warn(){}},
    invalidatePRStateCache:(pr:string)=>{assert.equal(pr,url);invalidated++;},
    execFileSync:(command:string,args:string[],opts:unknown)=>{calls.push({command,args,options:opts});
      if(args[1]==="view")return options.capturedHead===undefined?sha:options.capturedHead;
      merges++;if(options.headMismatch)throw Error("Head commit does not match --match-head-commit");
      if(options.protectionOnce&&merges===1)throw Error("required status check");return "";},
  };
  const merge=evaluate(declarations("installer/pr-state.ts",["tryAutoMergePR"]),ports,"tryAutoMergePR");
  return{url,sha,calls,merge,invalidated:()=>invalidated};
}
it("both normal and existing admin merge attempts enforce the same exact expected head",()=>{
  for(const protectionOnce of [false,true]){
    const f=mergeFixture({protectionOnce});assert.equal(f.merge(f.url,"US-001","run-verify",f.sha),true);
    const base=["pr","merge",f.url,"--squash","--delete-branch","--match-head-commit",f.sha];
    assert.deepEqual(f.calls,protectionOnce?[
      {command:"gh",args:base,options:{timeout:37001,stdio:"pipe"}},
      {command:"gh",args:[...base,"--admin"],options:{timeout:37001,stdio:"pipe"}},
    ]:[{command:"gh",args:base,options:{timeout:37001,stdio:"pipe"}}]);
    assert.equal(f.invalidated(),1);
  }
});
it("merge head mismatch has no admin bypass and invalid explicit SHA has zero effects",()=>{
  const mismatch=mergeFixture({headMismatch:true});assert.equal(mismatch.merge(mismatch.url,"US-001","run-verify",mismatch.sha),false);
  assert.equal(mismatch.calls.length,1);assert.deepEqual(mismatch.calls[0]!.args,["pr","merge",mismatch.url,"--squash","--delete-branch","--match-head-commit",mismatch.sha]);
  const invalid=mergeFixture();assert.equal(invalid.merge(invalid.url,"US-001","run-verify","not-a-full-sha"),false);assert.deepEqual(invalid.calls,[]);
});
it("legacy merge captures current head once then pins that same head in both attempts",()=>{
  const f=mergeFixture({protectionOnce:true});assert.equal(f.merge(f.url,"US-001","run-legacy"),true);
  const base=["pr","merge",f.url,"--squash","--delete-branch","--match-head-commit",f.sha];
  assert.deepEqual(f.calls,[
    {command:"gh",args:["pr","view",f.url,"--json","headRefOid","--jq",".headRefOid"],options:{timeout:17001,stdio:"pipe"}},
    {command:"gh",args:base,options:{timeout:37001,stdio:"pipe"}},
    {command:"gh",args:[...base,"--admin"],options:{timeout:37001,stdio:"pipe"}},
  ]);
  const missing=mergeFixture({capturedHead:""});assert.equal(missing.merge(missing.url,"US-001","run-legacy"),false);
  assert.equal(missing.calls.length,1);assert.equal(missing.calls[0]!.args[1],"view");
});
function supervisorStageCandidate(subject:"story_member"|"final_product"){
  const envelope={schema:"setfarm.claim-envelope.v1",protocol:"v3",issuedAt:"2026-11-04T12:00:00.000Z",runId:"run-stage",stepId:"step-supervise",workflowStepId:"supervise",
    claimId:901,claimAgentId:"feature-dev_supervisor",runtimeAgentId:"supervisor",workdir:"/product-story"};
  const output="STATUS: done\nSUPERVISOR_DECISION: pass",outputHash=crypto.createHash("sha256").update(output).digest("hex");
  const boundSubject=subject==="story_member"?{kind:subject,storyDbId:"story-db-1",storyId:"US-001",storyIndex:1,storyClaimGeneration:4}:{kind:subject};
  const events:string[]=[];let captures=0;
  const tx={unsafe:async()=>[{claim_envelope:envelope,output_hash:outputHash,lease_expires_at:"2099-11-04T12:00:00.000Z"}]};
  const ports:Record<string,any>={crypto,canonicalJsonStringify,hashCanonicalJson,
    currentRuntimeCompletionOwnerCapability:()=>({requestId:"RCR_stage-1",ownerInstanceId:"owner-1",ownerAttemptCount:1}),
    getSql:()=>({begin:(action:any)=>action(tx)}),acquireClaimMutationAuthorityInTransaction:async()=>{},assertClaimAuthority:async()=>{},
    readDatabaseWallClock:async()=>new Date("2026-11-04T12:01:00.000Z"),loadAndRevalidateV3StoryClaimRuntimeBindingV1:async()=>boundSubject,
    readAuthenticatedSubscriptionSuperviseContractsV1:async()=>({subject:boundSubject,contexts:[]}),
    authenticatedV3SupervisorStoryWorktree:async()=>{throw Error("V3_SUPERVISE_BOUND_WORKTREE_BRANCH_MISMATCH");},
    revalidateAuthenticatedV3SupervisorStoryWorktree:async()=>{},assertExactGitBranchWorktree:()=>{if(subject==="story_member")throw Error("V3_SUPERVISE_BOUND_WORKTREE_BRANCH_MISMATCH");},
    resolveV3DownstreamSourceContext:()=>({worktree:envelope.workdir,branch:"main"}),
    execPlatformGit:(args:string[])=>{events.push(args[0]!);if(args[0]==="rev-parse")return "1".repeat(40);if(args[0]==="status")return "";throw Error("UNAUTHENTICATED_GIT_EFFECT");},
    captureV3GitCommitRevision:()=>{if(++captures===2)throw Error("READ_ONLY_CANDIDATE_READY");return{sha:"1".repeat(40),treeHash:"2".repeat(40)};},
    parseGitStatusPaths:()=>[],isPlatformNonStoryCommitPath:()=>false,
    commitStoryWorktreeScopeIfNeeded:()=>{events.push("reset-add-commit");throw Error("UNAUTHENTICATED_GIT_EFFECT");},
  };
  const run=evaluate(declarations("installer/step-ops.ts",["runOwnedSuperviseStageEvidenceV1"]),ports,"runOwnedSuperviseStageEvidenceV1");
  return{events,run:()=>run({envelope,runtimeSessionId:"RTS_stage-1",boundSubject,output,context:{repo:envelope.workdir,branch:"main"}})};
}
it("actual owned supervisor stage refuses wrong story branch before any candidate Git effects",async()=>{
  const f=supervisorStageCandidate("story_member");await assert.rejects(f.run(),/WORKTREE.*BRANCH|BRANCH.*MISMATCH/);
  assert.deepEqual(f.events,[]);
});
it("unchanged final-product audit reaches evidence without reset add or commit on main",async()=>{
  const f=supervisorStageCandidate("final_product");await assert.rejects(f.run(),/READ_ONLY_CANDIDATE_READY/);
  assert.equal(f.events.includes("reset-add-commit"),false);
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
    const run=evaluate(declarations("installer/implement-evidence-runner.ts",["exactPlanInteractions","runImplementEvidenceIfRequested"]),ports,"runImplementEvidenceIfRequested");
    const result=await run({runId:envelope.runId,storyId:slice.storyId,workdir:"/product",v3:{slice,sliceHash,stageClaim,sourceRevision:stageClaim.sourceBefore}});
    assert.equal(result.attempted,true);assert.equal(result.ok,false);assert.ok(events.includes("owned-command"));
    assert.equal(artifacts[0].visualEvidence.status,visualGate==="off"?"disabled":"skipped");assert.equal(artifacts[0].visualEvidence.mode,visualGate);assert.equal(artifacts[0].visualEvidence.provider,"none");
  }
});
