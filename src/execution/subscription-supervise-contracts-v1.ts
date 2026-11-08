import {EvidenceBundleV2Schema,computeEvidenceBundleHash} from "../evidence/evidence-bundle-v2.js";
import {EvidencePlanV1Schema} from "../evidence/evidence-plan-v1.js";
import {EvidencePlanV2Schema} from "../evidence/evidence-plan-v2.js";
import {canonicalJsonStringify} from "../product-compiler/canonical-json.js";
import {getSql} from "../db-pg.js";
import {readNativeAcceptedModelSourceAuthority,readNativeEvidenceOnlySuccessAuthority} from "../recovery/v3-evidence-only-publication.js";
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
  // The driver Result is an Array subclass; retain its authenticated row data,
  // not the driver container/metadata, in the canonical contract seal.
  return frozen({subject:resolved.subject,rows:Array.from(resolved.rows),contexts});
}

/** Prior Setfarm-owned checks, bound to the authenticated subject and candidate.
 * Separate DATA projection: never changes the original write-scope contract seal. */
export async function readAuthenticatedSubscriptionSuperviseEvidenceV1(envelope:ClaimEnvelopeV1,runtimeSessionId:string) {
  const contracts=await readAuthenticatedSubscriptionSuperviseContractsV1(envelope,runtimeSessionId);
  const members=[];
  for(const row of contracts.rows) {
    const compiled=await loadV3ImplementationAttemptContext({runId:envelope.runId,storyId:row.story_id,attemptId:row.attempt_id});
    const attempt=compiled.attempt;
    const context=contracts.contexts.find(value=>value.storyDbId===row.story_db_id);
    const plan=compiled.evidencePlan.schema==="setfarm.evidence-plan.v2"
      ?EvidencePlanV2Schema.parse(compiled.evidencePlan):EvidencePlanV1Schema.parse(compiled.evidencePlan);
    if(!context||context.storyClaimGeneration!==row.story_claim_generation
      ||context.sliceHash!==compiled.sliceHash||canonicalJsonStringify(context.slice)!==canonicalJsonStringify(compiled.slice)
      ||attempt.attemptId!==row.attempt_id||attempt.runId!==envelope.runId||attempt.storyId!==row.story_id
      ||attempt.stepId!=="implement"||attempt.packetHash!==compiled.packetHash||attempt.sliceHash!==compiled.sliceHash
      ||!attempt.sourceAfter||plan.packetHash!==compiled.packetHash||plan.sliceHash!==compiled.sliceHash
      ||plan.storyId!==row.story_id)refuse();
    const member=await getSql().begin(async tx=>{
      const subject=await loadAndRevalidateV3StoryClaimRuntimeBindingV1(tx,{claimId:envelope.claimId,runtimeSessionId,
        runId:envelope.runId,stepDbId:envelope.stepId,workflowStepId:"supervise"});
      if(canonicalJsonStringify(subject)!==canonicalJsonStringify(contracts.subject))refuse();
      const locator={runId:envelope.runId,storyId:row.story_id,attemptId:row.attempt_id,packetHash:compiled.packetHash};
      // Model custody is not PASS. The evidence and actual story acceptance
      // below must independently reproduce this exact candidate and result.
      const authority=attempt.attemptClass==="evidence_only"
        ?await readNativeEvidenceOnlySuccessAuthority(tx,{...locator,stepId:"implement"})
        :await readNativeAcceptedModelSourceAuthority(tx,locator);
      const stored=await tx.unsafe<Array<{evidence_bundle_hash:string;evidence_id:string;run_id:string;story_id:string;
        attempt_id:string;packet_hash:string;slice_hash:string;source_sha:string;source_tree_hash:string;
        aggregate_verdict:string;payload:unknown;story_db_id:string;story_claim_generation:number;story_output:string;
        claim_id:string;generation:number}>>(`
        SELECT bundle.*,s.id AS story_db_id,s.claim_generation AS story_claim_generation,s.output AS story_output,
          a.claim_id::text,a.generation
        FROM evidence_bundles bundle
        JOIN execution_attempts a ON a.attempt_id=bundle.attempt_id AND a.run_id=bundle.run_id
          AND a.story_id=bundle.story_id AND a.packet_hash=bundle.packet_hash AND a.slice_hash=bundle.slice_hash
          AND a.source_after_sha=bundle.source_sha AND a.source_after_tree_hash=bundle.source_tree_hash
          AND a.evidence_refs::jsonb ? ('setfarm://evidence-bundle/' || bundle.evidence_bundle_hash)
        JOIN stories s ON s.id=$4 AND s.run_id=a.run_id AND s.story_id=a.story_id AND s.claim_generation=$5
          AND s.status IN ('done','verified')
        WHERE bundle.run_id=$1 AND bundle.story_id=$2 AND bundle.attempt_id=$3
      `,[envelope.runId,row.story_id,row.attempt_id,row.story_db_id,row.story_claim_generation]);
      if(stored.length!==1)refuse();
      const data=stored[0]!,bundle=EvidenceBundleV2Schema.parse(data.payload),bundleHash=computeEvidenceBundleHash(bundle);
      const source=attempt.sourceAfter!,refs=attempt.evidenceRefs.filter(ref=>ref.startsWith("setfarm://evidence-bundle/"));
      if(data.evidence_bundle_hash!==bundleHash||data.evidence_id!==bundle.evidenceId
        ||data.run_id!==envelope.runId||bundle.runId!==envelope.runId
        ||data.story_id!==row.story_id||bundle.storyId!==row.story_id
        ||data.story_db_id!==row.story_db_id||data.story_claim_generation!==row.story_claim_generation
        ||data.attempt_id!==attempt.attemptId||bundle.attemptId!==attempt.attemptId
        ||Number(data.claim_id)!==attempt.claimId||data.generation!==attempt.generation
        ||data.packet_hash!==compiled.packetHash||bundle.packetHash!==compiled.packetHash
        ||data.slice_hash!==compiled.sliceHash||bundle.sliceHash!==compiled.sliceHash
        ||data.source_sha!==source.sha||data.source_tree_hash!==source.treeHash
        ||canonicalJsonStringify(bundle.sourceRevision)!==canonicalJsonStringify(source)
        ||data.aggregate_verdict!==bundle.aggregateVerdict||bundle.aggregateVerdict!=="pass"
        ||canonicalJsonStringify(refs)!==canonicalJsonStringify([`setfarm://evidence-bundle/${bundleHash}`]))refuse();
      const required=compiled.slice.schema==="setfarm.implementation-slice.v2"
        ?compiled.slice.contract.product.evidencePredicates.filter(predicate=>predicate.required&&compiled.slice.story.evidenceRefs.includes(predicate.id))
        :compiled.slice.requiredEvidence;
      const requiredRefs=[...plan.predicateRefs,...plan.commands.map(command=>`EVID_COMMAND_${command.commandRef}`)];
      for(const predicateRef of plan.predicateRefs) {
        const predicate=required.find(value=>value.id===predicateRef),flows=plan.flows.filter(flow=>flow.predicateRefs.includes(predicateRef));
        const actionRefs=[...new Set(flows.map(flow=>flow.actionRef))],controlRefs=[...new Set(flows.map(flow=>flow.controlRef))];
        // The native runner aggregates one result across all physical flows.
        // Ambiguous physical identity is omitted there, never invented here.
        const actionRef=plan.schema==="setfarm.evidence-plan.v2"?(actionRefs.length===1?actionRefs[0]:undefined):flows[0]?.actionRef;
        const controlRef=plan.schema==="setfarm.evidence-plan.v2"?(controlRefs.length===1?controlRefs[0]:undefined):flows[0]?.controlRef;
        const results=bundle.predicates.filter(value=>value.predicateRef===predicateRef);
        if(!predicate||results.length!==1||!results[0]!.required||results[0]!.verdict!=="pass"
          ||results[0]!.invariantRef!==`INV_${predicate.kind.toUpperCase()}`
          ||results[0]!.actionRef!==actionRef||results[0]!.controlRef!==controlRef)refuse();
      }
      for(const command of plan.commands) {
        const results=bundle.predicates.filter(value=>value.predicateRef===`EVID_COMMAND_${command.commandRef}`);
        if(results.length!==1||!results[0]!.required||results[0]!.verdict!=="pass"
          ||results[0]!.invariantRef!==`INV_COMMAND_${command.kind.toUpperCase()}`
          ||!results[0]!.observationRefs.some(ref=>bundle.observations.some(observation=>observation.observationRef===ref
            &&observation.kind==="command"&&observation.commandRef===command.commandRef&&observation.exitCode===0)))refuse();
      }
      if(bundle.predicates.some(predicate=>predicate.required&&!requiredRefs.includes(predicate.predicateRef)))refuse();
      const acceptance=JSON.parse(data.story_output);
      if(acceptance.schema!=="setfarm.v3-story-acceptance-record.v1"||acceptance.storyId!==row.story_id
        ||acceptance.attemptId!==attempt.attemptId||acceptance.packetHash!==compiled.packetHash
        ||acceptance.sliceHash!==compiled.sliceHash||canonicalJsonStringify(acceptance.sourceRevision)!==canonicalJsonStringify(source)
        ||acceptance.evidenceBundleRef!==`setfarm://evidence-bundle/${bundleHash}`||acceptance.aggregateVerdict!==bundle.aggregateVerdict
        ||acceptance.findingSetRef!==null||acceptance.failureClass!==null)refuse();
      let provenance;
      if("sourceOwner" in authority) {
        if(authority.attemptId!==attempt.attemptId||authority.claimId!==attempt.claimId||authority.generation!==attempt.generation
          ||authority.storyDbId!==row.story_db_id||authority.storyClaimGeneration!==row.story_claim_generation
          ||authority.sliceHash!==compiled.sliceHash||authority.outputHash!==bundleHash
          ||canonicalJsonStringify(authority.sourceAfter)!==canonicalJsonStringify(source)
          ||authority.storyOutput!==data.story_output||authority.acceptanceOutput!==data.story_output)refuse();
        provenance={kind:"native_evidence_refresh",claimId:authority.claimId,sourceOwnerAttemptId:authority.sourceOwner.attemptId,
          sourceOwnerClaimId:authority.sourceOwner.claimId,evidenceRefresh:authority.evidenceRefresh};
      }else{
        if(authority.attempt_id!==attempt.attemptId||Number(authority.claim_id)!==attempt.claimId
          ||authority.generation!==attempt.generation||authority.story_db_id!==row.story_db_id
          ||authority.slice_hash!==compiled.sliceHash||authority.source_after_sha!==source.sha
          ||authority.source_after_tree_hash!==source.treeHash||authority.output_hash!==attempt.outputHash
          ||acceptance.agentOutputHash!==authority.output_hash
          ||canonicalJsonStringify(JSON.parse(authority.evidence_refs))!==canonicalJsonStringify(attempt.evidenceRefs))refuse();
        provenance={kind:"accepted_model",requestId:authority.request_id,claimId:attempt.claimId,
          outputHash:authority.output_hash,completionPlanHash:authority.completion_plan_hash};
      }
      return {storyDbId:row.story_db_id,storyId:row.story_id,storyClaimGeneration:row.story_claim_generation,
        attemptId:attempt.attemptId,attemptGeneration:attempt.generation,authority:provenance,
        evidenceBundleHash:bundleHash,requiredPredicateRefs:requiredRefs,bundle};
    });
    members.push(member);
  }
  // Canonical serialization rejects driver/custom prototypes; a JSON roundtrip
  // returns own DATA only, with no driver containers or authority capabilities.
  return frozen(JSON.parse(canonicalJsonStringify({subject:contracts.subject,members})));
}
