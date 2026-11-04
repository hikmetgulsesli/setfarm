import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { it } from "node:test";
import ts from "typescript";
import { deriveSubscriptionCodingRuntimePathsV1,projectSubscriptionCodingRuntimeBindingV1,sameSubscriptionRuntimeDataV1,subscriptionRuntimeRefusedV1,subscriptionRuntimePreparationHashV1 } from "../../src/execution/subscription-coding-runtime-binding-v1.js";
import { createV3StageClaimHandoffV1,V3StageClaimHandoffV1Schema } from "../../src/execution/v3-stage-execution-context.js";
import { assertSubscriptionWorkflowRoleV1,planSubscriptionWorkflowHandoffV1,renderSubscriptionWorkflowPromptV1 } from "../../src/execution/subscription-workflow-transport-v1.js";
import { ClaimEnvelopeV1Schema } from "../../src/execution/schemas/claim-envelope-v1.js";

// Existing Source-DATA testing pattern: evaluate exact private production bodies
// in an owned dependency realm. No spawner/selected/credential module import or
// real DB, subprocess, SDK, provider, signal, listener or filesystem effect.
const source=(file:string)=>readFileSync(new URL("../../src/"+file,import.meta.url),"utf8");
function declaration(file:string,name:string){const text=source(file),tree=ts.createSourceFile(file,text,ts.ScriptTarget.Latest,true);
  const rows=tree.statements.filter((n):n is ts.FunctionDeclaration=>ts.isFunctionDeclaration(n)&&n.name?.text===name);
  assert.equal(rows.length,1,"private production function required: "+name);return rows[0]!.getText(tree).replace(/^export\s+/,"");}
function evaluate(file:string,name:string,ports:Record<string,any>){const body=ts.transpileModule(declaration(file,name),{
  compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
  return new Function(...Object.keys(ports),body+";return "+name+";")(...Object.values(ports));}
function deferred<T>(){let resolve!:(value:T)=>void;const promise=new Promise<T>(yes=>{resolve=yes;});return{promise,resolve};}

it("genuine selected facade derives fixed PLAN shaping only after authentic starting claim and ignores caller shaping",async()=>{
  const file="execution/subscription-coding-runtime-selected-v1.ts",name="startSelectedSubscriptionCodingRuntimeV1";
  let body=declaration(file,name);
  assert.equal(body.split("import.meta.url").length-1,1);
  // Disclosed module-locator DATA seam only; no selected graph/FS is imported.
  body=body.replace("import.meta.url",JSON.stringify("file:///component/selected-facade.js"));
  const compiled=ts.transpileModule(body,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
  for(const mode of ["plan","stories","design","starting-refused","crossed-stage","profile-model-mismatch"]){
    const step=mode==="stories"?"stories":mode==="design"?"design":"plan",role=step==="design"?"designer":"planner";
    const f=fixture(),events:string[]=[];
    const envelope={...f.input.claimEnvelope,workflowStepId:step,claimAgentId:`feature-dev_${role}`,runtimeAgentId:role};
    const authority=createV3StageClaimHandoffV1({claimEnvelope:envelope,workflow:"feature-dev",role,workdir:envelope.workdir,
      outputFile:"/tmp/component-unused-output",instructionContent:"Return the complete existing report."});
    const observed={...f.runtime.worker.processIdentity,pid:43100};
    let captured:any,capturedBroker:any,prepared:any;
    class ComponentStartupError extends Error{}
    const selected={paths:{root:"/installation/runtime"},directory:"/installation",state:{origin:{sourceSha:"a".repeat(40)}},
      activation:{acknowledged:true,preparedPin:{sha256:"b".repeat(64)},activatedPin:{sha256:"c".repeat(64)}},assertUnchanged(){}};
    const ports={process:{getuid:()=>501,pid:43100},ClaimEnvelopeV1Schema,V3StageClaimHandoffV1Schema,
      assertFreshInstallationSelectionUnchangedV1(){},assertFreshInstallationOperationalEntryV1(){},freshInstallationSelectionV1:selected,
      planSubscriptionWorkflowHandoffV1,renderSubscriptionWorkflowPromptV1,projectSubscriptionCodingRuntimeBindingV1,
      deriveSubscriptionCodingRuntimePathsV1,sameSubscriptionRuntimeDataV1,subscriptionRuntimeRefusedV1,
      readSelectedFreshExecutionProfileV1:()=>({schema:"setfarm.model-execution-profile.v1",providerId:mode==="profile-model-mismatch"?"kimi":"minimax",modelId:mode==="profile-model-mismatch"?"kimi/k3.1-pro":"minimax/MiniMax-M3.1-Flash",selection:"primary"}),
      getSql:()=>({componentData:true}),createRuntimeSessionRepository:()=>({async readAuthenticatedStartingClaim(actual:any){
        events.push("authenticated-starting");assert.deepEqual(actual.envelope,envelope);
        if(mode==="starting-refused")throw Error("COMPONENT_STARTING_REFUSED");return{};
      }}),observeProcessIdentity:()=>observed,hash:(bytes:string|Buffer)=>createHash("sha256").update(bytes).digest("hex"),
      ownedBytes:()=>Buffer.from("component-owned-policy"),fileURLToPath,URL,join:path.join,SUBSCRIPTION_CODING_WORKER_PRELOAD_V1:"component-preload",
      // Scope/FS effects are finite DATA ports. They confer no production grant
      // or selected success; the exact authentic reader/order is tested above.
      workerScope:()=>({writeGrants:[],readOnlyControlPaths:[]}),canonicalDirectory(){},
      prepareSubscriptionWriteParentsV1(){events.push("prepare-parents");},materializeSubscriptionWorkflowHandoffV1(){events.push("materialize");},prepareContainer(){events.push("container");},
      acquireSubscriptionCodingRuntimeV1:async(input:any,acquisition:any)=>{
        assert.ok(events.includes("authenticated-starting"));captured=input;events.push("acquire");
        const authority=await acquisition.deriveAuthority(input);
        prepared={phase:"prepared",authority,attachmentHash:subscriptionRuntimePreparationHashV1(input.binding,authority)};
        await acquisition.acquireBroker({identity:{attemptId:"stage-claim-41",generationId:"component-stage-runtime",modelRef:input.binding.modelRef},limits:{componentData:true},signal:input.signal});
        throw Error("COMPONENT_ACQUIRE_BOUNDARY");
      },
      subscriptionRuntimePreparationHashV1,readSubscriptionRuntimeAttachmentV1:()=>prepared,
      withSelectedSubscriptionCredentialV1:async(model:string,use:(credential:string)=>Promise<unknown>)=>{
        assert.ok(events.includes("authenticated-starting"));assert.equal(model,"minimax/MiniMax-M3.1-Flash");events.push("credential-data");
        return use("component-synthetic-plan-credential");
      },
      startSubscriptionAttemptBrokerV1:async(input:any)=>{capturedBroker=input;events.push("broker-data");throw Error("COMPONENT_ACQUIRE_BOUNDARY");},
      SubscriptionCodingRuntimeStartupErrorV1:ComponentStartupError,
    };
    const start=new Function(...Object.keys(ports),compiled+";return "+name+";")(...Object.values(ports));
    const input={envelope:mode==="crossed-stage"?{...envelope,workflowStepId:"stories"}:envelope,authority,
      runtimeSessionId:f.input.runtimeSessionId,ownerInstanceId:f.ownerInstanceId,signal:new AbortController().signal};
    Object.defineProperty(input,"requestProfile",{get(){throw Error("CALLER_SHAPING_AUTHORITY_READ");}});
    if(mode==="starting-refused"||mode==="crossed-stage"||mode==="profile-model-mismatch"){
      await assert.rejects(start(input),/COMPONENT_STARTING_REFUSED|REFUSED/);
      assert.equal(captured,undefined);assert.equal(events.includes("materialize"),false);
      assert.equal(events.includes("credential-data"),false);assert.equal(capturedBroker,undefined);
    }else{
      await assert.rejects(start(input),/COMPONENT_ACQUIRE_BOUNDARY/);
      assert.equal(captured.requestProfile,step==="plan"?"plan-report-v1":undefined);
      assert.equal(capturedBroker.requestProfile,step==="plan"?"plan-report-v1":undefined,"broker receives the same authenticated fixed profile");
      if(step!=="plan")for(const value of [captured,capturedBroker])assert.equal(Object.hasOwn(value,"requestProfile"),false,"other roles omit the profile entirely");
    }
  }
  const tree=ts.createSourceFile(file,body,ts.ScriptTarget.Latest,true),choices:number[]=[],reads:number[]=[];
  const visit=(node:ts.Node)=>{
    if(ts.isStringLiteral(node)&&node.text==="plan-report-v1")choices.push(node.getStart(tree));
    if(ts.isCallExpression(node)&&ts.isPropertyAccessExpression(node.expression)&&node.expression.name.text==="readAuthenticatedStartingClaim")reads.push(node.end);
    ts.forEachChild(node,visit);
  };visit(tree);
  assert.ok(choices.length>0&&reads.length>0);
  assert.ok(Math.min(...choices)>Math.min(...reads),"fixed profile choice must follow the genuine initial starting-claim authentication");
});
function fixture(){
  const runtimeSessionId="RTS_00000000-0000-0000-0000-000000000901",ownerInstanceId="fixture.local:43100:12345678-1234-4234-8234-123456789abc";
  const claimEnvelope={schema:"setfarm.claim-envelope.v1" as const,protocol:"v3" as const,issuedAt:"2026-11-04T12:00:00.000Z",
    runId:"run-source-data-spawner",stepId:"step-source-data-spawner",workflowStepId:"plan",claimId:41,
    claimAgentId:"feature-dev_planner",runtimeAgentId:"planner",workdir:"/project/worktree",repo:"/project/worktree",input:"Produce PLAN proposal."};
  const authority=createV3StageClaimHandoffV1({claimEnvelope,workflow:"feature-dev",role:"planner",workdir:claimEnvelope.workdir,
    outputFile:"/tmp/legacy-plan-output",instructionContent:claimEnvelope.input});
  const paths=deriveSubscriptionCodingRuntimePathsV1({runtimeRoot:"/installation/runtime",runtimeSessionId});
  const processIdentity={schema:"setfarm.process-identity.v1",pid:43200,processStartedAt:"2026-11-04T12:00:01.000Z",processGroupId:43000,source:"observed_os"};
  const events:string[]=[],activeProcesses=new Map(),drainingProcesses=new Map(),closed=deferred<any>(),output=deferred<any>();
  const child={pid:43200,exitCode:null,signalCode:null};
  const runtime={worker:{child,processIdentity,identity:{attemptId:"stage-claim-41",generationId:"stage-runtime-fixture",modelRef:"minimax/MiniMax-M3.1-Flash"},output:output.promise},
    attachmentHash:"a".repeat(64),closed:closed.promise,
    close:(_why:string)=>{events.push("close-pair");return closed.promise;},openGate:async()=>{events.push("gate");}};
  const input={key:"feature-dev:planner:planner",wfId:"feature-dev",role:"planner",agentId:"planner",claimEnvelope,authority,
    runtimeSessionId,sessionId:"spawner-session",sessionKey:"spawner-session-key"};
  let publishCount=0;
  const ports:Record<string,any>={
    SELECTED_SPAWNER_V1:{paths:{root:"/installation/runtime"}},SPAWNER_INSTANCE_ID:ownerInstanceId,
    AGENT_RUNTIME:"subscription",AGENT_TIMEOUT_SECONDS:1800,activeProcesses,drainingProcesses,
    claimingSpawns:new Set(),shuttingDown:false,path,Date,console:{log(){},warn(){}},
    setTimeout:()=>71,clearTimeout:()=>{},readProcessCpuTicks:()=>undefined,fileSize:()=>0,
    deriveSubscriptionCodingRuntimePathsV1,getSql:()=>({fixtureOnly:true}),assertSpawnerOperationalEntryV1:async()=>{},
    startSelectedSubscriptionCodingRuntimeV1:async(actual:any)=>{events.push("acquire-pair");assert.equal(events[0],"mark-starting");assert.deepEqual(actual.envelope,claimEnvelope);return runtime;},
    createRuntimeSessionRepository:()=>({
      markStarting:async()=>{events.push("mark-starting");return{sessionId:runtimeSessionId,ownerInstanceId,state:"starting",stateVersion:1};},
      markRunning:async(actual:any)=>{events.push("mark-running");const retained=activeProcesses.get(input.key);
        assert.equal(retained?.subscriptionRuntime,runtime,"actual pair retained before markRunning await");
        assert.deepEqual(retained?.claimEnvelope,claimEnvelope,"full original envelope retained, including issuedAt/input");
        assert.deepEqual(actual.envelope,claimEnvelope);assert.equal(actual.pid,43200);assert.deepEqual(actual.processIdentity,processIdentity);
        assert.equal(actual.runtimePath,paths.runtimePath);assert.equal(actual.worktree,claimEnvelope.workdir);assert.equal(actual.transcriptPath,paths.transcriptPath);
        return{status:"running",session:{sessionId:runtimeSessionId,ownerInstanceId,state:"running",stateVersion:3}};},
      findById:async()=>({sessionId:runtimeSessionId,ownerInstanceId,state:"starting",stateVersion:2}),quarantine:async()=>{events.push("quarantine");},
    }),
    decodeSubscriptionSdkWorkflowReportV1:()=>({assistantText:"STATUS: done\nRESULT: report",replayInvalid:true}),
    parseSubscriptionWorkflowReportV1:({assistantText}:any)=>({output:assistantText}),
    publishRuntimeCompletionProposal:async(_step:string,text:string,envelope:any)=>{publishCount++;events.push("publish");assert.equal(text,"STATUS: done\nRESULT: report");assert.deepEqual(envelope,claimEnvelope);return{managed:true};},
    terminateActiveProcess:()=>{events.push("terminate");void runtime.close("refused");},
    emitEvent:()=>{},recordSupervisorInfraEvent:async()=>{},settleExitedClaimAndRuntime:async()=>{events.push("settle-failure");},
  };
  return{input,ports,paths,runtime,events,activeProcesses,drainingProcesses,closed,output,ownerInstanceId,
    published:()=>publishCount};
}
it("real selected orchestration retains original pair before publication await and gates after markRunning",async()=>{
  const f=fixture(),start=evaluate("spawner.ts","startSelectedSubscriptionClaimV1",f.ports);
  await start(f.input);
  assert.deepEqual(f.events.slice(0,4),["mark-starting","acquire-pair","mark-running","gate"]);
  assert.equal(f.published(),0);
  f.output.resolve({stdout:"owned SDK stdout",stderr:"",exitCode:0});await new Promise(setImmediate);
  assert.equal(f.published(),0,"stdout success is not original joint closure");
  f.closed.resolve({status:"closed",broker:"closed",worker:"closed",evidenceRefs:["original-broker","original-process-and-streams"]});
  await new Promise(setImmediate);assert.equal(f.published(),1);
});
it("markRunning failure closes retained pair and never opens its worker gate",async()=>{
  const f=fixture(),repo=f.ports.createRuntimeSessionRepository();
  f.closed.resolve({status:"closed",broker:"closed",worker:"closed",evidenceRefs:[]});
  repo.markRunning=async()=>{f.events.push("mark-running-failed");throw Error("publication refused");};
  f.ports.createRuntimeSessionRepository=()=>repo;
  await assert.rejects(evaluate("spawner.ts","startSelectedSubscriptionClaimV1",f.ports)(f.input),/publication|REFUSED/);
  assert.ok(f.events.includes("close-pair"));assert.equal(f.events.includes("gate"),false);assert.equal(f.published(),0);
});
it("actual spawnAgentNow routes selected subscription to owned helper before legacy tmp files or spawn",async()=>{
  const f=fixture();let routed=0,legacy=0;
  const claim={found:true,stepId:f.input.claimEnvelope.stepId,workflowStepId:"plan",runId:f.input.claimEnvelope.runId,protocol:"v3",claimId:41,
    claimAgentId:"feature-dev_planner",runtimeSessionId:f.input.runtimeSessionId,runtimeOwnerInstanceId:f.ownerInstanceId,resolvedInput:f.input.claimEnvelope.input};
  Object.assign(f.ports,{hasTrackedClaimRuntime:()=>false,shouldDeferBackgroundWorkflow:async()=>false,trackedRuntimeCount:()=>0,MAX_CONCURRENT:2,
    pendingClaimInvocations:new Map(),newRuntimeSessionId:()=>f.input.runtimeSessionId,buildSessionKey:()=>f.input.sessionKey,agentSessionJsonlPath:()=>"/unused/session.jsonl",
    TRANSCRIPT_ROOT:"/legacy/transcripts",recoveryDispatchClassForRole:()=>undefined,
    assertSubscriptionWorkflowRoleV1,claimStep:async()=>claim,runtimeClaimEnvelope:()=>f.input.claimEnvelope,safeAgentCwdFromClaimInput:()=>f.input.claimEnvelope.workdir,
    AGENT_SAFE_CWD:"/scratch",claimRoleRequiresProjectCwd:()=>false,ensureClaimScopeParentDirs:()=>[],
    buildClaimSummary:()=>({canonicalStageClaimHandoff:f.input.authority}),completeInlineSecurityGateIfApplicable:async()=>false,
    fs:{unlinkSync(){legacy++;throw Error("legacy tmp cleanup reached");},mkdirSync(){legacy++;throw Error("legacy filesystem path reached");},writeFileSync(){legacy++;throw Error("legacy filesystem path reached");}},
    spawn:()=>{legacy++;throw Error("legacy spawn reached");},
    startSelectedSubscriptionClaimV1:async(actual:any)=>{routed++;assert.deepEqual(actual.claimEnvelope,f.input.claimEnvelope);assert.deepEqual(actual.authority,f.input.authority);},
    releaseUntransferredPostClaimOwnership:async()=>{throw Error("transferred subscription owner was discarded");},
  });
  await evaluate("spawner.ts","spawnAgentNow",f.ports)("planner","feature-dev","planner");
  assert.equal(routed,1);assert.equal(legacy,0);
});
it("actual selected caller refuses unsupported role before claimStep",async()=>{
  const f=fixture();let claims=0;
  Object.assign(f.ports,{hasTrackedClaimRuntime:()=>false,shouldDeferBackgroundWorkflow:async()=>false,trackedRuntimeCount:()=>0,MAX_CONCURRENT:2,
    buildSessionKey:()=>f.input.sessionKey,agentSessionJsonlPath:()=>"/unused/session.jsonl",newRuntimeSessionId:()=>f.input.runtimeSessionId,
    TRANSCRIPT_ROOT:"/legacy/transcripts",pendingClaimInvocations:new Map(),recoveryDispatchClassForRole:()=>undefined,
    fs:{unlinkSync(){}},
    assertSubscriptionWorkflowRoleV1,claimStep:async()=>{claims++;throw Error("must not claim");}});
  await assert.rejects(evaluate("spawner.ts","spawnAgentNow",f.ports)("unknown","feature-dev","unknown"),/UNSUPPORTED/);
  assert.equal(claims,0);
});
it("ordinary supervise uses its real stage handoff while implement retains canonical attempt requirement",()=>{
  const f=fixture(),build=evaluate("spawner-prompt.ts","buildClaimSummary",{path,ClaimEnvelopeV1Schema,createV3StageClaimHandoffV1});
  const claim={...f.input.claimEnvelope,workflowStepId:"supervise",claimAgentId:"feature-dev_supervisor",runtimeAgentId:"supervisor"};
  const params={wfId:"feature-dev",role:"supervisor",claimFile:"/tmp/legacy-claim",outputFile:"/tmp/legacy-output",bootstrapFile:"/tmp/legacy-bootstrap",
    stepId:claim.stepId,runId:claim.runId,workdir:claim.workdir,repo:claim.repo,claimEnvelope:claim,input:claim.input};
  const summary=build(params);
  assert.equal(summary.canonicalStageClaimHandoff.context.workflowStepId,"supervise");
  assert.equal(summary.canonicalImplementationContext,undefined);
  assert.equal(summary.canonicalStageClaimHandoff.context.story,undefined);
  assert.throws(()=>build({...params,role:"developer",storyId:"US-001",claimEnvelope:{...claim,workflowStepId:"implement",
    claimAgentId:"feature-dev_developer",storyId:"US-001",storyDbId:"story-db-001",claimGeneration:1,
    attempt:{attemptId:"ATT_00000000-0000-0000-0000-000000000901",generation:1,fenceToken:"f".repeat(64)}}}),/V3_IMPLEMENTATION_HANDOFF_MISSING/);
});
it("actual terminate path revokes original pair instead of generic process-tree or gateway operations",()=>{
  const f=fixture();let foreign=0;
  const terminate=evaluate("spawner.ts","terminateActiveProcess",{...f.ports,signalProcessIfIdentityMatches:()=>{foreign++;},
    cancelRuntimeTask:()=>{foreign++;},cleanupSpawnerDetachedToolChildren:()=>{foreign++;},cleanupProjectEphemera:()=>{foreign++;}});
  const active={...f.input,child:f.runtime.worker.child,processIdentity:f.runtime.worker.processIdentity,subscriptionRuntime:f.runtime};
  terminate(active,"owner-cancel");assert.ok(f.events.includes("close-pair"));assert.equal(foreign,0);
});
it("actual service start admits exact subscription with readiness and captured-runner drift fences",async()=>{
  for(const runner of ["codex","subscription"]){
    const events:string[]=[],env={SETFARM_AGENT_RUNTIME:runner};
    const child={pid:43200,exitCode:null,signalCode:null,connected:true,disconnect(){events.push("disconnect");},unref(){events.push("unref");}};
    const ports={process:{execPath:"/node",env},path,fs:{closeSync(){}},
      readSelectedFreshExecutionProfileV1:()=>({providerId:runner==="codex"?"codex":"minimax",modelId:runner==="codex"?"codex/model":"minimax/MiniMax-M3.1-Flash",selection:"primary"}),
      assertSelectedFreshExecutionProfileUnchangedV1:()=>{},prepareFreshInstallationOperationalEntryV1:async()=>{events.push("entry");},assertFreshInstallationOperationalEntryV1:()=>{},
      freshInstallationSelectionV1:{paths:{repository:"/source"},state:{origin:{sourceSha:"a".repeat(40)}}},
      inspectFreshServiceV1:()=>events.includes("ready")?{running:true,pid:43200}:{running:false},freshServicePathsV1:()=>({logFile:"/log"}),openFreshServiceLogV1:()=>71,
      freshServiceChildEnvironmentV1:()=>({}),spawn:(_cmd:any,_args:any,options:any)=>{assert.equal(options.env.SETFARM_AGENT_RUNTIME,runner);events.push("spawn");return child;},
      waitFreshStartingChildReadyV1:async()=>{events.push("ready");},setImmediate,stopHeldFreshStartingChildV1:async()=>{events.push("stop");}};
    assert.equal((await evaluate("server/spawnerctl.ts","startFreshSpawnerV1",ports)()).pid,43200);
    assert.ok(events.indexOf("ready")<events.indexOf("unref"));
    ports.prepareFreshInstallationOperationalEntryV1=async()=>{env.SETFARM_AGENT_RUNTIME=runner==="codex"?"subscription":"codex";};
    await assert.rejects(evaluate("server/spawnerctl.ts","startFreshSpawnerV1",ports)(),/CHANGED|REFUSED/);
  }
});
