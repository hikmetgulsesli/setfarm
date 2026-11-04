import {createHash} from "node:crypto";
import type {SubscriptionAttemptIdentityV1} from "./subscription-attempt-launch-material-v1.js";
import type {SubscriptionCodingWorkerOutputV1} from "./subscription-coding-worker-v1.js";
function refuse():never{throw Error("SUBSCRIPTION_SDK_WORKFLOW_REPORT_REFUSED");}
/** Decode terminal original stdout, never the mixed diagnostic transcript. */
export function decodeSubscriptionSdkWorkflowReportV1(input:Readonly<{identity:SubscriptionAttemptIdentityV1;output:SubscriptionCodingWorkerOutputV1}>):Readonly<{assistantText:string;replayInvalid:boolean}>{
  const o=input.output;
  if(o.exitCode!==0||o.signal!==null||o.stdoutTruncated||o.stderrTruncated||o.streamError
    ||![o.processClosed,o.stdoutEnded,o.stderrEnded,o.stdoutClosed,o.stderrClosed].every(x=>x===true)
    ||Buffer.byteLength(o.stdout)!==o.stdoutBytes||Buffer.byteLength(o.stderr)!==o.stderrBytes)refuse();
  let root:any;try{root=JSON.parse(o.stdout);}catch{refuse();}
  const value=root?.result===undefined?root:(root.status==="ok"?root.result:undefined),m=value?.meta;
  const [provider,...modelParts]=input.identity.modelRef.split("/"),model=modelParts.join("/");
  const sessionId="sfsub-"+createHash("sha256").update(JSON.stringify([input.identity.attemptId,input.identity.generationId,input.identity.modelRef])).digest("hex");
  const trace=m?.executionTrace;
  if(!m||m.aborted!==false||m.agentMeta?.sessionId!==sessionId||m.agentMeta?.provider!==provider||m.agentMeta?.model!==model
    ||m.stopReason!=="stop"||m.completion?.stopReason!=="stop"||m.completion?.finishReason!=="stop"
    ||trace?.winnerProvider!==provider||trace?.winnerModel!==model||trace?.runner!=="embedded"
    ||!Array.isArray(trace.attempts)||trace.attempts.length<1||trace.attempts.length>161
    ||!Array.isArray(value.payloads))refuse();
  const last=trace.attempts[trace.attempts.length-1],history=trace.attempts.slice(0,-1);
  if(last.stage!=="assistant"||last.result!=="success"||last.provider!==provider||last.model!==model
    ||history.some((a:any)=>a.provider!==provider||a.model!==model||!["prompt","assistant"].includes(a.stage)
      ||!["timeout","rotate_profile"].includes(a.result)))refuse();
  // The pinned producer calls any nonempty retry trace fallbackUsed, including
  // same-model timeout/profile retries. It does not by itself prove model fallback.
  // All five push sites use prompt/assistant; compaction adds no trace entry.
  if(trace.fallbackUsed!==(history.length>0))refuse();
  const payloads=value.payloads.filter((p:any)=>p&&typeof p.text==="string"&&p.text.trim());
  // The pinned producer may emit tool progress and final reply items. Its final
  // assistant selector identifies the report; payload cardinality does not.
  const rawFinal=m.finalAssistantRawText;
  const final=typeof rawFinal==="string"&&rawFinal.trim()?rawFinal:m.finalAssistantVisibleText;
  let assistantText:string;
  if(typeof final==="string"&&final.trim()){
    // Delivery payloads apply reply/media directives to these bytes. The
    // authenticated producer's final metadata is the canonical report.
    assistantText=final;
  }else{if(payloads.length!==1)refuse();assistantText=payloads[0].text;}
  return{assistantText,replayInvalid:m.replayInvalid===true};
}
