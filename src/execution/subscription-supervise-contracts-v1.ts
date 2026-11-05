import {getSql} from "../db-pg.js";
import type {ClaimEnvelopeV1} from "./schemas/claim-envelope-v1.js";
import {loadAndRevalidateV3StoryClaimRuntimeBindingV1} from "./v3-story-claim-runtime-binding-v1.js";
import {loadV3ImplementationAttemptContext} from "./v3-implementation-attempt.js";
import type {SubscriptionSuperviseContractV1} from "./subscription-supervise-scope-v1.js";
function frozen<T>(value:T):T{if(value&&typeof value==="object"){for(const child of Object.values(value))frozen(child);Object.freeze(value);}return value;}
function refuse():never{throw Error("SUBSCRIPTION_SUPERVISE_CONTRACTS_REFUSED");}
// Internal authenticated DATA reader. No grant, launch, completion or lease authority.
/** Fixed production resolver. Historical attempts supply contracts, never this stage's ownership. */
export async function readAuthenticatedSubscriptionSuperviseContractsV1(envelope:ClaimEnvelopeV1,runtimeSessionId:string){
  if(envelope.protocol!=="v3"||envelope.workflowStepId!=="supervise"||envelope.attempt)refuse();
  const resolved=await getSql().begin(async tx=>{
    const subject=await loadAndRevalidateV3StoryClaimRuntimeBindingV1(tx,{claimId:envelope.claimId,runtimeSessionId,
      runId:envelope.runId,stepDbId:envelope.stepId,workflowStepId:"supervise"});
    const rows=await tx.unsafe<Array<{story_db_id:string;story_id:string;story_claim_generation:number;attempt_id:string}>>(`
      SELECT b.story_db_id,b.story_id,b.story_claim_generation,r.attempt_id
      FROM v3_story_claim_runtime_bindings_v1 b
      JOIN v3_story_claim_runtime_bindings_v1 current_binding ON current_binding.claim_id=$3 AND current_binding.runtime_session_id=$4
        AND current_binding.run_id=b.run_id AND current_binding.workflow_step_id='supervise'
        AND current_binding.story_admission_receipt_hash=b.story_admission_receipt_hash
        AND current_binding.story_admission_subject_hash=b.story_admission_subject_hash
      JOIN stories s ON s.id=b.story_db_id AND s.run_id=b.run_id AND s.story_id=b.story_id
        AND s.story_index=b.story_index AND s.claim_generation=b.story_claim_generation AND s.status<>'skipped'
      JOIN claim_log c ON c.id=b.claim_id AND c.run_id=b.run_id AND c.step_id='implement' AND c.story_id=b.story_id
      JOIN runtime_sessions r ON r.session_id=b.runtime_session_id AND r.claim_id=b.claim_id AND r.run_id=b.run_id
        AND r.step_db_id=b.step_db_id AND r.workflow_step_id='implement' AND r.story_db_id=b.story_db_id AND r.story_id=b.story_id
        AND r.claim_agent_id=c.agent_id
      JOIN runtime_completion_requests q ON q.runtime_session_id=r.session_id AND q.claim_id=c.id AND q.run_id=b.run_id AND q.step_db_id=b.step_db_id AND q.attempt_id=r.attempt_id
      WHERE b.run_id=$1 AND b.workflow_step_id='implement' AND b.subject_kind='story_member'
        AND ($2::text IS NULL OR b.story_db_id=$2) AND c.outcome='completed' AND r.state='released'
        AND q.state='accepted' AND q.apply_phase='effects_committed' AND q.claim_outcome='completed'
      ORDER BY s.story_index,b.claim_id`,[envelope.runId,subject.kind==="story_member"?subject.storyDbId:null,envelope.claimId,runtimeSessionId]);
    const stories=await tx.unsafe<Array<{id:string}>>("SELECT id FROM stories WHERE run_id=$1 AND status<>'skipped' ORDER BY story_index,id",[envelope.runId]);
    if(rows.length!==(subject.kind==="story_member"?1:stories.length)||!rows.length
      ||new Set(rows.map(r=>r.story_db_id)).size!==rows.length)refuse();
    return{subject,rows};
  });
  const contexts:SubscriptionSuperviseContractV1[]=[];
  for(const row of resolved.rows){if(!row.attempt_id)refuse();
    const compiled=await loadV3ImplementationAttemptContext({runId:envelope.runId,storyId:row.story_id,attemptId:row.attempt_id});
    if(!["produced_delta","already_satisfied","verified"].includes(compiled.attempt.disposition))refuse();
    contexts.push({storyDbId:row.story_db_id,storyClaimGeneration:row.story_claim_generation,slice:compiled.slice,sliceHash:compiled.sliceHash,
      ...(compiled.slice.recovery?{allowedPaths:compiled.slice.schema==="setfarm.implementation-slice.v2"
        ?compiled.slice.recovery.expectedSourceDelta.changes.map(change=>change.path):compiled.slice.recovery.allowedPaths}: {})});
  }
  return frozen({subject:resolved.subject,rows:resolved.rows,contexts});
}
