import {getSql} from "../db-pg.js";
import {readNativeEvidenceOnlySuccessAuthority} from "../recovery/v3-evidence-only-publication.js";
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
    // Original admission membership is inherited through its genuine model
    // binding. The independent verifier has no runtime binding or model RCR.
    const verified=await tx.unsafe<Array<{story_db_id:string;story_id:string;story_claim_generation:number;
      source_claim_id:string;attempt_id:string;packet_hash:string}>>(`
      SELECT b.story_db_id,b.story_id,b.story_claim_generation,b.claim_id::text AS source_claim_id,
        a.attempt_id,a.packet_hash
      FROM v3_story_claim_runtime_bindings_v1 b
      JOIN v3_story_claim_runtime_bindings_v1 current_binding
        ON current_binding.claim_id=$3 AND current_binding.runtime_session_id=$4
        AND current_binding.run_id=b.run_id AND current_binding.workflow_step_id='supervise'
        AND current_binding.story_admission_receipt_hash=b.story_admission_receipt_hash
        AND current_binding.story_admission_subject_hash=b.story_admission_subject_hash
      JOIN stories s ON s.id=b.story_db_id AND s.run_id=b.run_id AND s.story_id=b.story_id
        AND s.story_index=b.story_index AND s.claim_generation=b.story_claim_generation
        AND s.status IN ('done','verified')
      JOIN execution_attempts original ON original.claim_id=b.claim_id AND original.run_id=b.run_id
        AND original.story_id=b.story_id AND original.step_id='implement'
      JOIN recovery_cases c ON c.run_id=b.run_id AND c.story_id=b.story_id
        AND c.prior_attempt_refs::jsonb ? original.attempt_id AND c.status='resolved'
      JOIN recovery_dispatch_deliveries d ON d.recovery_case_id=c.recovery_case_id
        AND d.revision_id=c.current_revision_id AND d.state='succeeded'
      JOIN execution_attempts a ON a.attempt_id=d.attempt_id AND a.claim_id=d.claim_id
        AND a.recovery_dispatch_id=d.dispatch_id AND a.recovery_case_revision_id=d.revision_id
        AND a.attempt_class='evidence_only' AND a.disposition='verified'
      WHERE b.run_id=$1 AND b.workflow_step_id='implement' AND b.subject_kind='story_member'
        AND ($2::text IS NULL OR b.story_db_id=$2)
      ORDER BY s.story_index,a.attempt_id
    `,[envelope.runId,subject.kind==="story_member"?subject.storyDbId:null,envelope.claimId,runtimeSessionId]);
    for(const candidate of verified) {
      const success=await readNativeEvidenceOnlySuccessAuthority(tx,{runId:envelope.runId,stepId:"implement",
        storyId:candidate.story_id,packetHash:candidate.packet_hash,attemptId:candidate.attempt_id});
      if(success.sourceOwner.claimId!==Number(candidate.source_claim_id)
        ||success.storyDbId!==candidate.story_db_id||success.storyClaimGeneration!==candidate.story_claim_generation
        ||!["done","verified"].includes(success.storyStatus)||success.storyOutput!==success.acceptanceOutput)refuse();
      // A genuine inconclusive model owner can have claimOutcome=completed.
      // Replace only that authenticated original contract row with its actual
      // verifier; never count the original as another successful story owner.
      const originalIndex=rows.findIndex(row=>row.story_db_id===success.storyDbId
        &&row.attempt_id===success.sourceOwner.attemptId);
      if(originalIndex>=0) rows.splice(originalIndex,1);
      rows.push({story_db_id:candidate.story_db_id,story_id:candidate.story_id,
        story_claim_generation:candidate.story_claim_generation,attempt_id:success.attemptId});
    }
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
