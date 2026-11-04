import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { it } from "node:test";
import type { SubscriptionCodingWorkerOutputV1 } from "../../src/execution/subscription-coding-worker-v1.js";
// Exact DATA parser only; type-only worker import must not become a launch edge.
let api: Record<string, any> | undefined;
try { api = await import("../../src/execution/subscription-workflow-transport-v1.js"); }
catch (error) { const e = error as {code?:string;url?:string};
  if (e.code !== "ERR_MODULE_NOT_FOUND" || ![".js",".ts"].some(ext => e.url ===
    new URL("../../src/execution/subscription-workflow-transport-v1"+ext,import.meta.url).href)) throw error;
}
const identity = { attemptId:"ATT_00000000-0000-0000-0000-000000000901", generationId:"generation-7", modelRef:"minimax/MiniMax-M3.1-Flash" };
const sessionId = "sfsub-"+createHash("sha256").update(JSON.stringify([identity.attemptId,identity.generationId,identity.modelRef])).digest("hex");
function envelope(text="STATUS: done\nRESULT: exact SDK report") {
  // Shape read from original v8 stdout, not the unrelated gateway wrapper:
  // bare {payloads,meta}, mutation replayInvalid=true, livenessState=working.
  return { payloads:[{text,mediaUrl:null}], meta:{
    agentMeta:{sessionId,provider:"minimax",model:"MiniMax-M3.1-Flash"}, aborted:false,
    finalAssistantVisibleText:text, finalAssistantRawText:text, replayInvalid:true,livenessState:"working",stopReason:"stop",
    executionTrace:{winnerProvider:"minimax",winnerModel:"MiniMax-M3.1-Flash",
      attempts:[{provider:"minimax",model:"MiniMax-M3.1-Flash",result:"success",stage:"assistant"}],fallbackUsed:false,runner:"embedded"},
    completion:{stopReason:"stop",finishReason:"stop"},
  } };
}
function output(stdout=JSON.stringify(envelope())): SubscriptionCodingWorkerOutputV1 {
  return {stdout,stderr:"",stdoutBytes:Buffer.byteLength(stdout),stderrBytes:0,stdoutTruncated:false,stderrTruncated:false,
    exitCode:0,signal:null,processClosed:true,stdoutEnded:true,stderrEnded:true,stdoutClosed:true,stderrClosed:true,streamError:false,
    proofHash:"1".repeat(64),isolationHash:"2".repeat(64),materialHash:"3".repeat(64)};
}
function parse(value=output()) {
  assert.equal(typeof api?.decodeSubscriptionSdkWorkflowReportV1,"function","bounded actual bare-SDK report decoder required");
  return api!.decodeSubscriptionSdkWorkflowReportV1({identity,output:value});
}
it("extracts observed bare SDK successful payload while preserving unsafe-replay marker",()=>{
  assert.deepEqual(parse(),{assistantText:"STATUS: done\nRESULT: exact SDK report",replayInvalid:true});
  const multi=envelope(); multi.payloads.unshift({text:"I am inspecting the owned files.",mediaUrl:null});
  assert.deepEqual(parse(output(JSON.stringify(multi))),{assistantText:"STATUS: done\nRESULT: exact SDK report",replayInvalid:true});
});
it("stderr or a mixed transcript cannot supply a successful assistant payload",()=>{
  const fake=output(""); fake.stderr=JSON.stringify(envelope()); fake.stderrBytes=Buffer.byteLength(fake.stderr);
  assert.throws(()=>parse(fake),/REFUSED|INVALID|MISSING/);
  assert.throws(()=>parse(output(JSON.stringify(envelope())+"\n"+JSON.stringify(envelope("STATUS: retry")))),/REFUSED|INVALID|AMBIGUOUS/);
});
it("binds actual SDK session provider model and assistant winner to original worker identity",()=>{
  for(const change of ["session","provider","model","winner","fallback"]){
    const e=envelope();
    if(change==="session")e.meta.agentMeta.sessionId="sfsub-foreign";
    if(change==="provider")e.meta.agentMeta.provider="kimi";
    if(change==="model")e.meta.agentMeta.model="foreign-model";
    if(change==="winner")e.meta.executionTrace.winnerModel="foreign-model";
    if(change==="fallback")e.meta.executionTrace.fallbackUsed=true;
    assert.throws(()=>parse(output(JSON.stringify(e))),/REFUSED|MISMATCH|INVALID/);
  }
});
it("process zero exit cannot override abort failed assistant finish or payload ambiguity",()=>{
  const rows: any[]=[envelope(),envelope(),envelope(),envelope()];
  rows[0]!.meta.aborted=true; rows[1]!.meta.completion.finishReason="error";
  rows[2]!.meta.executionTrace.attempts[0]!.result="error";
  rows[3]!.payloads.push({text:"STATUS: retry",mediaUrl:null});
  delete rows[3]!.meta.finalAssistantRawText; delete rows[3]!.meta.finalAssistantVisibleText;
  for(const e of rows)assert.throws(()=>parse(output(JSON.stringify(e))),/REFUSED|INVALID|AMBIGUOUS/);
});
it("truncation missing original stream closure or failed process cannot produce a report",()=>{
  for(const change of [{stdoutTruncated:true},{stderrTruncated:true},{streamError:true},{processClosed:false},
    {stdoutEnded:false},{stderrClosed:false},{exitCode:17},{signal:"SIGTERM" as const}]){
    assert.throws(()=>parse({...output(),...change}),/REFUSED|INVALID|CLOSED/);
  }
});
it("gateway wrapper success may use the same exact SDK payload without mixing diagnostic truncation",()=>{
  const bare=envelope("STATUS: done\nRESULT: "+"x".repeat(1800));
  const value=output(JSON.stringify({runId:"sdk-run",status:"ok",result:bare}));
  assert.equal(parse(value).assistantText,bare.payloads[0]!.text);
});
