import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { chmodSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { it } from "node:test";
import { createV3StageClaimHandoffV1 } from "../../src/execution/v3-stage-execution-context.js";
import { createV3StageFailureV1, createV3StageRetrySourceV1, serializeV3StageFailureDiagnostic }
  from "../../src/execution/v3-stage-retry-authority.js";
import { compilePlanSemanticProposalV2 } from "../../src/product-compiler/producers/plan-semantic-proposal-v2.js";
import { ProductSpecV2Schema } from "../../src/product-compiler/schemas/product-spec-v2.js";
import { renderProductSpecV2Compatibility } from "../../src/product-compiler/renderers/product-spec-v2-compatibility.js";
import { CONTAINED_GAME_TASK, containedGamePlanProposalV2 } from "../product-compiler/fixtures/product-semantics-v2.js";
import type { ClaimEnvelopeV1 } from "../../src/execution/schemas/claim-envelope-v1.js";

// Direct inert DATA / owned temporary-file mechanics only. No selected profile,
// credential, SQL, broker, worker, SDK, subprocess or provider import/execution.
let api: Record<string, any> | undefined;
try { api = await import("../../src/execution/subscription-workflow-transport-v1.js"); }
catch (error) {
  const e = error as {code?: string; url?: string};
  if (e.code !== "ERR_MODULE_NOT_FOUND" || ![".js", ".ts"].some(ext => e.url ===
    new URL("../../src/execution/subscription-workflow-transport-v1" + ext, import.meta.url).href)) throw error;
}
function required(name: string): (...args: any[]) => any {
  assert.equal(typeof api?.[name], "function", `${name} implementation required`); return api![name];
}
const hash = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
const PAIRS = [
  ["plan", "planner"], ["design", "designer"], ["stories", "planner"], ["setup-repo", "setup-repo"],
  ["setup-build", "setup-build"], ["verify", "reviewer"], ["supervise", "supervisor"],
  ["security-gate", "security-gate"], ["qa-test", "qa-tester"], ["final-test", "tester"], ["deploy", "deployer"],
] as const;
function stage(step = "plan", role = "planner", workdir = "/project/claim-worktree", instructionContent = "Produce the exact existing stage report.", previousOutputContent?: string) {
  const claim: ClaimEnvelopeV1 = { schema: "setfarm.claim-envelope.v1", protocol: "v3", issuedAt: "2026-11-04T12:00:00.000Z",
    runId: "run-subscription-transport", stepId: "step-subscription-transport", workflowStepId: step,
    claimId: 41, claimGeneration: 0, claimAgentId: `feature-dev_${role}`, runtimeAgentId: `mapped-${role}`,
    workdir, repo: workdir, input: instructionContent };
  const failure = previousOutputContent === undefined ? undefined : createV3StageFailureV1({
    workflowStepId: step, kind: "output_contract_invalid", diagnostics: [{ code: "OUTPUT_INVALID", path: "/status", message: "Previous report rejected" }],
  });
  const retrySource = failure ? createV3StageRetrySourceV1({ workflowStepId: step, retryOrdinal: 1, maxRetries: 2,
    previousClaimId: 40, previousInstructionContent: instructionContent, previousOutputContent: previousOutputContent!,
    diagnostic: serializeV3StageFailureDiagnostic("V3_PLAN_OUTPUT_REJECTED", failure) }) : undefined;
  const authority = createV3StageClaimHandoffV1({ claimEnvelope: claim, workflow: "feature-dev", role, workdir,
    outputFile: "/tmp/legacy-transport-output.txt", instructionContent, ...(retrySource ? {retrySource} : {}) });
  return { claim, authority };
}
for (const [step, role] of PAIRS) it(`preserves ${step}/${role} exact stage report without inventing an attempt`, () => {
  const input = stage(step, role);
  required("assertSubscriptionWorkflowRoleV1")({ workflow: "feature-dev", role });
  const output = step === "supervise" ? "STATUS: done\nSUPERVISOR_DECISION: fixed\nAC_COVERAGE: checked 2/2 acceptance criteria\nCHANGES: exact owned file"
    : `STATUS: done\nRESULT: ${step} report for existing module validation`;
  assert.deepEqual(required("parseSubscriptionWorkflowReportV1")({ ...input, assistantText: output }), { output });
  assert.equal(input.claim.attempt, undefined);
});
it("role gate rejects unsupported workflow or role before a claim can be requested", () => {
  const gate = required("assertSubscriptionWorkflowRoleV1");
  for (const value of [{workflow: "unknown-workflow", role: "planner"}, {workflow: "feature-dev", role: "unknown-role"}])
    assert.throws(() => gate(value), /UNSUPPORTED|REFUSED/);
});
it("planned raw fragments reconstruct complete canonical bytes and decoded instruction bytes", () => {
  const input = stage("plan", "planner", "/project/claim-worktree", "é🧭\n".repeat(16000));
  const plan = required("planSubscriptionWorkflowHandoffV1")(input);
  const expected = Buffer.from(JSON.stringify(input.authority, null, 2) + "\n");
  const rows = plan.files.filter((f: any) => f.kind === "canonical").sort((a: any, b: any) => a.byteOffset - b.byteOffset);
  assert.ok(rows.length > 1); assert.deepEqual(Buffer.concat(rows.map((f: any) => Buffer.from(f.contents))), expected);
  assert.equal(plan.manifest.canonical.sha256, hash(expected)); assert.equal(plan.manifest.canonical.bytes, expected.length);
  const decoded = plan.files.filter((f: any) => f.kind === "instruction").sort((a: any, b: any) => a.byteOffset - b.byteOffset);
  assert.equal(decoded.map((f: any) => f.contents).join(""), input.authority.instructionContent);
  assert.ok(plan.files.length <= 256); assert.equal(plan.readOnlyControlPaths.length, plan.files.length);
  for (const file of plan.files) {
    assert.ok(file.path.startsWith("/project/claim-worktree/.setfarm/stage-executions/claim-41/subscription-handoff/"));
    assert.ok(Buffer.byteLength(file.contents) <= 12 * 1024,"protected file must fit the installed read-result character cap");
    assert.ok(file.contents.split("\n").length<=2000,"protected file must fit the installed default read line limit");
    assert.equal(file.sha256, hash(file.contents));
  }
});
it("complete readable retry preserves every prior-output byte under unchanged path caps", () => {
  const previous = "Aé🧭".repeat(32000), input = stage("plan", "planner", "/project/claim-worktree", "Plan instruction.\n".repeat(600), previous);
  const plan = required("planSubscriptionWorkflowHandoffV1")(input);
  assert.ok(plan.files.length <= 256);
  const rows = plan.files.filter((f: any) => f.kind === "previous-output").sort((a: any, b: any) => a.byteOffset - b.byteOffset);
  assert.equal(rows.map((f: any) => f.contents).join(""), previous);
  assert.equal(plan.manifest.previousOutput.sha256, hash(previous));
  for(const file of plan.files)assert.ok(Buffer.byteLength(file.contents)<=12288&&file.contents.split("\n").length<=2000);
});
it("dense short lines split losslessly before the default read line boundary",()=>{
  const input=stage("plan","planner","/project/claim-worktree","x\n".repeat(5000));
  const plan=required("planSubscriptionWorkflowHandoffV1")(input),rows=plan.files.filter((f:any)=>f.kind==="instruction");
  assert.ok(rows.length>=3);assert.equal(rows.map((f:any)=>f.contents).join(""),input.authority.instructionContent);
  for(const row of rows){assert.ok(row.contents.split("\n").length<=2000);assert.ok(Buffer.byteLength(row.contents)<=12288);}
  for(const row of plan.manifest.instruction.parts)assert.equal(row.lines,plan.files.find((f:any)=>f.path.endsWith("/"+row.path)).contents.split("\n").length);
});
it("complete 4MiB retry honestly refuses readable-part capacity before any materialization",()=>{
  const input=stage("plan","planner","/nonexistent-subscription-readable-capacity","Plan instruction.","A".repeat(4*1024*1024));
  assert.throws(()=>required("planSubscriptionWorkflowHandoffV1")(input),/CAPACITY/);
});
it("escaped worst-case expansion refuses pure planning before any filesystem or credential effects", () => {
  const input = stage("plan", "planner", "/nonexistent-subscription-capacity-worktree", "Plan instruction.", "\t".repeat(4 * 1024 * 1024));
  assert.throws(() => required("planSubscriptionWorkflowHandoffV1")(input), /CAPACITY/);
});
it("short prompt names the protected hash-bound handoff and line-based read tool without shell bootstrap", () => {
  const input = stage(), plan = required("planSubscriptionWorkflowHandoffV1")(input);
  const prompt = required("renderSubscriptionWorkflowPromptV1")({ ...input, handoffRef: plan.handoffRef });
  assert.ok(Buffer.byteLength(prompt) <= 65536); assert.ok(prompt.includes(plan.handoffRef.path));
  assert.ok(prompt.includes(plan.handoffRef.sha256)); assert.match(prompt, /path/); assert.match(prompt, /offset/); assert.match(prompt, /limit/);
  assert.match(prompt,/offset\s*:\s*1/);assert.match(prompt,/limit[^\n]*lines|lines[^\n]*limit/);
  assert.doesNotMatch(prompt, /\/tmp\/|setfarm step|setfarm-summary|bash -|node -|CLAIM_FILE|BOOTSTRAP_FILE/);
});
it("materializer exclusively writes private protected files with exact plan bytes", () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), "sf-workflow-handoff-"))); chmodSync(root, 0o700);
  try {
    const input = stage("plan", "planner", root), plan = required("planSubscriptionWorkflowHandoffV1")(input);
    const actual = required("materializeSubscriptionWorkflowHandoffV1")(input);
    assert.deepEqual(actual.handoffRef, plan.handoffRef);
    for (const file of plan.files) {
      assert.equal(lstatSync(file.path).mode & 0o777, 0o600); assert.equal(lstatSync(dirname(file.path)).mode & 0o777, 0o700);
      assert.deepEqual(readFileSync(file.path), Buffer.from(file.contents));
    }
    assert.throws(() => required("materializeSubscriptionWorkflowHandoffV1")(input), /EXIST|REFUSED/);
    for (const file of plan.files) assert.deepEqual(readFileSync(file.path), Buffer.from(file.contents));
  } finally { rmSync(root, {recursive:true,force:true}); }
});
it("materializer refuses a symlinked metadata ancestor without writing its target", () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), "sf-workflow-handoff-link-"))); chmodSync(root, 0o700);
  try {
    const outside = join(root, "outside"); mkdirSync(outside, {mode:0o700}); symlinkSync(outside, join(root, ".setfarm"));
    assert.throws(() => required("materializeSubscriptionWorkflowHandoffV1")(stage("plan", "planner", root)), /REFUSED|SYMLINK/);
    assert.throws(() => lstatSync(join(outside, "stage-executions")), /ENOENT/);
  } finally { rmSync(root, {recursive:true,force:true}); }
});
it("transport refuses crossed original claim and tampered stage authority", () => {
  const input = stage(), plan = required("planSubscriptionWorkflowHandoffV1")(input);
  for (const changed of [{ ...input, claim: {...input.claim, claimId:42} },
    { ...input, authority: {...input.authority, instructionContent:"changed after sealing"} }]) {
    assert.throws(() => required("renderSubscriptionWorkflowPromptV1")({...changed,handoffRef:plan.handoffRef}), /MISMATCH|REFUSED|hash|length/);
  }
});
it("stage report boundary rejects empty nul oversized and missing-status output", () => {
  const input = stage();
  for (const assistantText of ["", "STATUS: done\0", "x".repeat(65537), "I finished the work."]) {
    assert.throws(() => required("parseSubscriptionWorkflowReportV1")({...input,assistantText}), /REFUSED|SIZE|STATUS|INVALID/);
  }
});
it("typed PLAN payload remains exact for the existing ProductSpec compiler", () => {
  const compiled = compilePlanSemanticProposalV2({task:CONTAINED_GAME_TASK,proposal:containedGamePlanProposalV2()});
  assert.equal(compiled.status,"canonicalized");
  if(compiled.status!=="canonicalized") throw Error("complete ProductSpec fixture must compile");
  const spec=ProductSpecV2Schema.parse(compiled.productSpec), output=renderProductSpecV2Compatibility(spec);
  const transported=required("parseSubscriptionWorkflowReportV1")({...stage(),assistantText:output});
  assert.deepEqual(transported,{output});
  const canonicalFence=transported.output.match(/```product-spec-v2\n([\s\S]*?)\n```/);
  assert.ok(canonicalFence);assert.deepEqual(ProductSpecV2Schema.parse(JSON.parse(canonicalFence[1]!)),spec);
});

it("exact nested owned file parents are prepared without files or symlink traversal",()=>{
  const root=realpathSync(mkdtempSync(join(tmpdir(),"sf-subscription-owned-parents-")));chmodSync(root,0o700);
  try{
    const file=join(root,"src","components","Nested.tsx");
    required("prepareSubscriptionWriteParentsV1")({worktree:root,paths:[file]});
    assert.ok(lstatSync(dirname(file)).isDirectory());assert.throws(()=>lstatSync(file),/ENOENT/);
    const outside=join(root,"outside");mkdirSync(outside,{mode:0o700});symlinkSync(outside,join(root,"linked"));
    assert.throws(()=>required("prepareSubscriptionWriteParentsV1")({worktree:root,paths:[join(root,"linked","nested","Escape.ts")]}),/REFUSED|SYMLINK/);
    assert.throws(()=>lstatSync(join(outside,"nested")),/ENOENT/);
  }finally{rmSync(root,{recursive:true,force:true});}
});

// Shared inert store fixture executes real accepted-source authority and bundle
// schemas; importing this test module also keeps its contract regressions active.
import { superviseEvidenceComponentFixture } from './subscription-supervise-scope-v1.test.js';

async function assembleSupervisorInput(options:Readonly<{runtime?:string;protocol?:string;stepId?:string;missingPair?:boolean;modulePrompt?:string;legacyPacketVersion?:1|2}>= {}) {
  const f=await superviseEvidenceComponentFixture(options.legacyPacketVersion?{legacyPacketVersion:options.legacyPacketVersion}:undefined),ts=f.ts;
  const file=new URL('../../src/installer/step-ops.ts',import.meta.url),source=readFileSync(file,'utf8');
  const tree=ts.createSourceFile(file.pathname,source,ts.ScriptTarget.ESNext,true);
  const candidates:any[]=[];
  function visit(node:any){if(ts.isBlock(node)){
    const statements=[...node.statements],start=statements.findIndex((statement:any)=>ts.isVariableStatement(statement)
      &&statement.declarationList.declarations.some((declaration:any)=>declaration.name.getText(tree)==='resolvedInput'
      &&declaration.initializer?.getText(tree).startsWith('resolveTemplate(')));
    const end=statements.findIndex((statement:any)=>ts.isVariableStatement(statement)
      &&statement.declarationList.declarations.some((declaration:any)=>declaration.name.getText(tree)==='allMissing'));
    if(start>=0&&end>start)candidates.push(statements.slice(start,end).map(statement=>statement.getText(tree)).join('\n'));
  }ts.forEachChild(node,visit);}visit(tree);
  assert.equal(candidates.length,1,'one genuine final single-step input assembly');
  const assembly=candidates[0]!.replace('await import("./steps/registry.js")','await registryPort()');
  const runtime=options.runtime??'subscription',protocol=options.protocol??'v3',stepId=options.stepId??'supervise';
  const oldRuntime=process.env.SETFARM_AGENT_RUNTIME;process.env.SETFARM_AGENT_RUNTIME=runtime;
  let reads=0;
  const runtimeIntent={sessionId:'RTS_supervise-fixture',runtimeAgentId:'mapped-supervisor',runtimeKind:'local_process',ownerInstanceId:'fixture-owner',
    sessionKey:'fixture-session',transcriptPath:'/fixture/attempt-workspaces/subscription/RTS_supervise-fixture/transcript.jsonl'};
  assert.equal(Object.hasOwn(runtimeIntent,'runtimePath'),false,'actual initial spawner intent has no published runtimePath');
  const ports={...f.promptContracts,...f.contextOps,canonicalJsonStringify:f.canonical.canonicalJsonStringify,
    registryPort:async()=>({get:()=>({id:'supervise',maxPromptSize:65536,buildPrompt:()=>options.modulePrompt??'MODULE SUPERVISOR PROMPT'})}),
    logger:{info:()=>{},warn:()=>{}},step:{step_id:stepId,run_id:f.envelope.runId,input_template:'TEMPLATE {{task}}'},
    prunedContextSingle:{task:'fixture task',implementation_context_protocol:protocol},runProtocol:{protocol},runtimeIntent,
    singleStepClaimEnvelope:options.missingPair?undefined:{...f.envelope,protocol,workflowStepId:stepId},
    singleStepRuntime:options.missingPair?undefined:{sessionId:'RTS_supervise-fixture'},
    readAuthenticatedSubscriptionSuperviseEvidenceV1:async(envelope:any,session:string)=>{reads++;return f.readers.evidence(envelope,session);}};
  try {
    const body=ts.transpileModule(assembly,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
    const execute=new Function(...Object.keys(ports),'return (async()=>{'+body+';return resolvedInput;})();');
    return {input:await execute(...Object.values(ports)),reads,f};
  }finally{if(oldRuntime===undefined)delete process.env.SETFARM_AGENT_RUNTIME;else process.env.SETFARM_AGENT_RUNTIME=oldRuntime;}
}

it('final supervisor module override retains exact accepted evidence in canonical and readable transport',async()=>{
  const {input,f}=await assembleSupervisorInput();
  assert.ok(input.includes(f.bundleHash),'final input includes accepted evidence bundle hash');
  assert.ok(input.includes(f.sourceAfter.sha),'final input includes accepted candidate SHA');
  assert.ok(input.includes(f.completionPlan.requestId),'final input includes actual accepted completion request');
  assert.ok(input.includes('MODULE SUPERVISOR PROMPT'));assert.ok(!input.includes('TEMPLATE fixture task'));assert.ok(input.indexOf('MODULE SUPERVISOR PROMPT')<input.indexOf('SETFARM_ACCEPTED_IMPLEMENTATION_EVIDENCE'));
  const root=realpathSync(mkdtempSync(join(tmpdir(),'sf-supervisor-evidence-')));chmodSync(root,0o700);
  try {
    const handed=stage('supervise','supervisor',root,input);
    const plan=required('planSubscriptionWorkflowHandoffV1')(handed);
    const materialized=required('materializeSubscriptionWorkflowHandoffV1')(handed);
    assert.deepEqual(materialized.handoffRef,plan.handoffRef);
    const contents=(kind:string)=>plan.files.filter((row:any)=>row.kind===kind).sort((a:any,b:any)=>a.byteOffset-b.byteOffset)
      .map((row:any)=>{const content=readFileSync(row.path,'utf8');assert.equal(hash(content),row.sha256);return content;}).join('');
    assert.equal(JSON.parse(contents('canonical')).instructionContent,input);assert.equal(contents('instruction'),input);
  }finally{rmSync(root,{recursive:true,force:true});}
});

it('other runtimes legacy and non-supervisor assembly preserve exact old input bytes without evidence reads',async()=>{
  const expected=(await assembleSupervisorInput({runtime:'codex'})).input;
  for(const options of [{runtime:'openclaw'},{runtime:'kimi'},{runtime:'opencode'},{protocol:'legacy'},{stepId:'verify'},{stepId:'implement'}]){
    const result=await assembleSupervisorInput(options);assert.equal(result.input,expected);assert.equal(result.reads,0);
  }
});
it('subscription supervisor assembly refuses an absent authenticated claim/runtime pair',async()=>{
  await assert.rejects(assembleSupervisorInput({missingPair:true}),/SUBSCRIPTION_SUPERVISE_EVIDENCE_CLAIM_REQUIRED/);
});

it('accepted evidence remains intact when complete assembly exceeds existing stage capacity',async()=>{
  const {input,f}=await assembleSupervisorInput({modulePrompt:'\t'.repeat(2*1024*1024)});
  assert.ok(input.includes(f.bundleHash));assert.ok(input.includes(f.completionPlan.requestId));
  assert.throws(()=>required('planSubscriptionWorkflowHandoffV1')(stage('supervise','supervisor','/nonexistent-supervisor-capacity',input)),/CAPACITY/);
});

for(const version of [1,2] as const)it(`accepted legacy packet v${version} final assembly keeps exact previous input bytes`,async()=>{
  const expected=(await assembleSupervisorInput({runtime:'codex',legacyPacketVersion:version})).input;
  const actual=await assembleSupervisorInput({legacyPacketVersion:version});
  assert.equal(actual.input,expected);assert.equal(actual.reads,1);
  assert.equal(actual.f.state.nativeAuthorityQueries,0);
  assert.ok(!actual.input.includes('SETFARM_ACCEPTED_IMPLEMENTATION_EVIDENCE'));
});
