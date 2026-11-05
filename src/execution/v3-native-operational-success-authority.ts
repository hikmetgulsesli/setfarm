import type postgres from "postgres";
import { createHash } from "node:crypto";
import { z } from "zod";
import { canonicalJsonStringify } from "../product-compiler/canonical-json.js";
import { EvidenceBundleV2Schema, computeEvidenceBundleHash } from "../evidence/evidence-bundle-v2.js";
import { V3ImplementationAgentOutputV1Schema } from "./v3-implementation-output.js";
import { NativeOperationalRetryWitnessV1Schema } from "./v3-preparation-runtime-authority-v1.js";

type Query = Pick<postgres.Sql, "unsafe"> | Pick<postgres.TransactionSql, "unsafe">;
type Identity = Readonly<{ runId:string;stepId:string;storyId:string;packetHash:string;attemptId:string }>;
function refuse():never { throw Error("V3_NATIVE_OPERATIONAL_SUCCESS_AUTHORITY_MISMATCH"); }
function same(a:unknown,b:unknown) { return canonicalJsonStringify(a)===canonicalJsonStringify(b); }

/** SQL-only terminal authority, also used under existing run/story locks.
 * The predecessor remains inconclusive. The successor owns real model output,
 * accepted RCR/runtime and candidate evidence. No lease or initial binding is minted.
 * CAS directive/slice/plan authentication is performed by the native dependency
 * reader before its existing locked recheck; immutable custody uses this exact
 * accepted-successor relation without recursively loading the predecessor.
 */
export async function readNativeOperationalSuccessAuthority(query:Query,input:Identity) {
  const rows=await query.unsafe<Array<{
    attempt_id:string;claim_id:string;generation:number;slice_hash:string;output_hash:string;output:string;
    compilation_report_hash:string;evidence_refs:string;branch:string;worktree:string;
    source_before_sha:string;source_before_tree_hash:string;source_after_sha:string;source_after_tree_hash:string;
    prior_attempt_id:string;prior_claim_id:string;prior_generation:number;prior_evidence_refs:string;
    authority_hash:string;story_output:string;bundle_hash:string;bundle_payload:unknown;
  }>>(`
    SELECT a.attempt_id,a.claim_id::text,a.generation,a.slice_hash,a.output_hash,q.output,
      a.compilation_report_hash,a.evidence_refs,a.branch,a.worktree,
      a.source_before_sha,a.source_before_tree_hash,a.source_after_sha,a.source_after_tree_hash,
      prior.attempt_id AS prior_attempt_id,prior.claim_id::text AS prior_claim_id,
      prior.generation AS prior_generation,prior.evidence_refs AS prior_evidence_refs,
      binding.authority_hash,story.output AS story_output,
      bundle.evidence_bundle_hash AS bundle_hash,bundle.payload AS bundle_payload
    FROM execution_attempts a
    JOIN claim_log claim ON claim.id=a.claim_id AND claim.run_id=a.run_id
      AND claim.step_id=a.step_id AND claim.story_id=a.story_id AND claim.agent_id=a.agent_id AND claim.outcome='completed'
    JOIN runtime_completion_requests q ON q.attempt_id=a.attempt_id AND q.claim_id=a.claim_id
      AND q.run_id=a.run_id AND q.workflow_step_id=a.step_id AND q.story_id=a.story_id
      AND q.output_hash=a.output_hash AND q.state='accepted' AND q.apply_phase='effects_committed' AND q.claim_outcome='completed'
    JOIN runtime_sessions runtime ON runtime.session_id=q.runtime_session_id AND runtime.claim_id=a.claim_id
      AND runtime.attempt_id=a.attempt_id AND runtime.run_id=a.run_id AND runtime.workflow_step_id=a.step_id
      AND runtime.step_db_id=q.step_db_id AND runtime.story_id=a.story_id AND runtime.claim_agent_id=a.agent_id
      AND runtime.state='released'
    JOIN v3_story_claim_runtime_bindings_v1 current_binding
      ON current_binding.claim_id=a.claim_id AND current_binding.runtime_session_id=runtime.session_id
      AND current_binding.run_id=a.run_id AND current_binding.step_db_id=q.step_db_id
      AND current_binding.workflow_step_id='implement' AND current_binding.subject_kind='story_member'
      AND current_binding.story_id=a.story_id AND current_binding.story_db_id=runtime.story_db_id
    JOIN stories story ON story.id=current_binding.story_db_id AND story.run_id=a.run_id AND story.story_id=a.story_id
      AND story.story_index=current_binding.story_index AND story.claim_generation=current_binding.story_claim_generation
      AND story.status IN ('done','verified') AND story.claimed_by IS NULL AND story.claimed_at IS NULL
    JOIN execution_attempts prior ON prior.run_id=a.run_id AND prior.step_id=a.step_id AND prior.story_id=a.story_id
      AND prior.packet_hash=a.packet_hash AND prior.compilation_report_hash=a.compilation_report_hash
      AND prior.generation+1=a.generation AND prior.slice_hash=a.slice_hash
      AND prior.source_before_sha=a.source_before_sha AND prior.source_before_tree_hash=a.source_before_tree_hash
      AND prior.attempt_class='product_implementation' AND prior.role='developer' AND prior.disposition='inconclusive'
      AND prior.recovery_dispatch_id IS NULL AND prior.recovery_case_revision_id IS NULL
    JOIN claim_log prior_claim ON prior_claim.id=prior.claim_id AND prior_claim.run_id=prior.run_id
      AND prior_claim.step_id=prior.step_id AND prior_claim.story_id=prior.story_id
      AND prior_claim.agent_id=prior.agent_id AND prior_claim.outcome='infra_retry'
    JOIN runtime_sessions prior_runtime ON prior_runtime.claim_id=prior.claim_id AND prior_runtime.attempt_id=prior.attempt_id
      AND prior_runtime.run_id=prior.run_id AND prior_runtime.workflow_step_id=prior.step_id
      AND prior_runtime.story_id=prior.story_id AND prior_runtime.story_db_id=current_binding.story_db_id
      AND prior_runtime.step_db_id=current_binding.step_db_id AND prior_runtime.claim_agent_id=prior.agent_id AND prior_runtime.state='released'
    JOIN v3_story_claim_runtime_bindings_v1 prior_binding ON prior_binding.claim_id=prior.claim_id
      AND prior_binding.runtime_session_id=prior_runtime.session_id AND prior_binding.run_id=a.run_id
      AND prior_binding.workflow_step_id='implement' AND prior_binding.subject_kind='story_member'
      AND prior_binding.step_db_id=prior_runtime.step_db_id
      AND prior_binding.story_db_id=current_binding.story_db_id AND prior_binding.story_id=a.story_id
      AND prior_binding.story_index=current_binding.story_index
      AND prior_binding.story_claim_generation+1=current_binding.story_claim_generation
      AND prior_binding.story_admission_receipt_hash=current_binding.story_admission_receipt_hash
      AND prior_binding.story_admission_subject_hash=current_binding.story_admission_subject_hash
    JOIN v3_preparation_authority_attempts_v2 binding ON binding.attempt_id=prior.attempt_id
      AND binding.claim_id=prior.claim_id AND binding.slice_hash=prior.slice_hash
    JOIN v3_preparation_authorities_v2 authority ON authority.authority_hash=binding.authority_hash
      AND authority.run_id=a.run_id AND authority.step_id=a.step_id AND authority.story_id=a.story_id
      AND authority.packet_hash=a.packet_hash AND authority.compilation_report_hash=a.compilation_report_hash
      AND authority.base_source_sha=a.source_before_sha AND authority.base_source_tree_hash=a.source_before_tree_hash
    JOIN evidence_bundles bundle ON bundle.run_id=a.run_id AND bundle.story_id=a.story_id AND bundle.attempt_id=a.attempt_id
      AND bundle.packet_hash=a.packet_hash AND bundle.slice_hash=a.slice_hash
      AND bundle.source_sha=a.source_after_sha AND bundle.source_tree_hash=a.source_after_tree_hash AND bundle.aggregate_verdict='pass'
      AND a.evidence_refs::jsonb ? ('setfarm://evidence-bundle/' || bundle.evidence_bundle_hash)
    JOIN semantic_artifacts packet ON packet.artifact_hash=a.packet_hash AND packet.artifact_type='setfarm.product-build-packet.v3'
    JOIN semantic_artifacts slice ON slice.artifact_hash=a.slice_hash AND slice.artifact_type='setfarm.implementation-slice.v2'
    JOIN runs run ON run.id=a.run_id AND run.protocol='v3' AND run.packet_hash=a.packet_hash AND run.status IN ('running','resuming')
    WHERE a.attempt_id=$1 AND a.run_id=$2 AND a.step_id=$3 AND a.story_id=$4 AND a.packet_hash=$5
      AND a.step_id='implement' AND a.attempt_class='infrastructure_retry' AND a.role='developer' AND a.disposition='verified'
      AND a.recovery_dispatch_id IS NULL AND a.recovery_case_revision_id IS NULL AND a.claim_id<>prior.claim_id
      AND NOT EXISTS (SELECT 1 FROM v3_preparation_authority_attempts_v2 b WHERE b.attempt_id=a.attempt_id OR b.claim_id=a.claim_id)
      AND NOT EXISTS (SELECT 1 FROM execution_attempts newer WHERE newer.run_id=a.run_id
        AND newer.step_id=a.step_id AND newer.story_id=a.story_id AND newer.generation>a.generation)
  `,[input.attemptId,input.runId,input.stepId,input.storyId,input.packetHash]);
  const row=rows[0];
  if(rows.length!==1||!row||!row.branch||!row.worktree)refuse();
  const refs=z.array(z.string()).parse(JSON.parse(row.evidence_refs));
  const priorRefs=z.array(z.string()).parse(JSON.parse(row.prior_evidence_refs));
  const refHash=(prefix:string) => {
    const values=refs.filter(ref=>ref.startsWith(prefix)).map(ref=>ref.slice(prefix.length));
    if(values.length!==1||!/^[a-f0-9]{64}$/.test(values[0]!))refuse();
    return values[0]!;
  };
  const directiveHash=refHash("setfarm://operational-retry/");
  const directiveArtifactHash=refHash("setfarm://operational-retry-artifact/");
  const originRef=`setfarm://preparation-authority-v2/${row.authority_hash}`;
  const custody=priorRefs.filter(ref=>ref.startsWith("setfarm://native-git-custody-v1/"));
  if(!same(refs.filter(ref=>ref.startsWith("setfarm://preparation-authority-v2/")),[originRef])
    ||!priorRefs.includes(originRef)||custody.length!==1
    ||!same(refs.filter(ref=>ref.startsWith("setfarm://native-git-custody-v1/")),custody)
    ||!refs.includes(`setfarm://artifact/${row.slice_hash}`)
    ||!refs.includes(`setfarm://artifact/${directiveArtifactHash}`))refuse();
  const artifacts=await query.unsafe<Array<{artifact_hash:string;artifact_type:string}>>(`
    SELECT a.artifact_hash,a.artifact_type FROM semantic_artifacts a
    WHERE (a.artifact_hash=$1 AND a.artifact_type='setfarm.operational-retry-directive.v1'
      AND EXISTS(SELECT 1 FROM run_artifact_refs ref WHERE ref.run_id=$2 AND ref.artifact_hash=a.artifact_hash AND ref.ref_key=$3))
      OR (a.artifact_type='setfarm.evidence-plan.v2' AND $4::text::jsonb ? ('setfarm://artifact/' || a.artifact_hash))
  `,[directiveArtifactHash,input.runId,`OPERATIONAL_RETRY_${directiveHash.slice(0,16).toUpperCase()}`,row.evidence_refs]);
  const plans=artifacts.filter(a=>a.artifact_type==="setfarm.evidence-plan.v2");
  if(artifacts.length!==2||plans.length!==1||!artifacts.some(a=>a.artifact_hash===directiveArtifactHash))refuse();
  const sourceBefore={sha:row.source_before_sha,treeHash:row.source_before_tree_hash};
  const sourceAfter={sha:row.source_after_sha,treeHash:row.source_after_tree_hash};
  const output=V3ImplementationAgentOutputV1Schema.parse(JSON.parse(row.output));
  const bundle=EvidenceBundleV2Schema.parse(row.bundle_payload);
  const expectedStoryOutput={schema:"setfarm.v3-story-acceptance-record.v1",storyId:input.storyId,
    attemptId:row.attempt_id,packetHash:input.packetHash,sliceHash:row.slice_hash,sourceRevision:sourceAfter,
    evidenceBundleRef:`setfarm://evidence-bundle/${row.bundle_hash}`,findingSetRef:null,
    aggregateVerdict:"pass",failureClass:null,agentOutputHash:row.output_hash};
  if(!Number.isSafeInteger(Number(row.claim_id))||Number(row.claim_id)<1
    ||sourceAfter.treeHash===sourceBefore.treeHash
    ||createHash("sha256").update(row.output,"utf8").digest("hex")!==row.output_hash
    ||output.disposition!=="ready_for_evidence"||output.attemptId!==row.attempt_id
    ||output.packetHash!==input.packetHash||output.sliceHash!==row.slice_hash||!same(output.sourceBefore,sourceBefore)
    ||computeEvidenceBundleHash(bundle)!==row.bundle_hash||bundle.aggregateVerdict!=="pass"
    ||bundle.attemptId!==row.attempt_id||bundle.runId!==input.runId||bundle.storyId!==input.storyId
    ||bundle.packetHash!==input.packetHash||bundle.sliceHash!==row.slice_hash||!same(bundle.sourceRevision,sourceAfter)
    ||!bundle.predicates.length||bundle.predicates.some(p=>p.required&&p.verdict!=="pass")
    ||row.story_output!==canonicalJsonStringify(expectedStoryOutput))refuse();
  const operationalRetry=NativeOperationalRetryWitnessV1Schema.parse({kind:"native_operational_retry",
    priorAttemptId:row.prior_attempt_id,priorClaimId:Number(row.prior_claim_id),priorGeneration:row.prior_generation,
    initialAuthorityHash:row.authority_hash,directiveHash,directiveArtifactHash,
    evidencePlanArtifactHash:plans[0]!.artifact_hash,evidenceBundleHash:row.bundle_hash});
  return Object.freeze({attemptId:row.attempt_id,claimId:Number(row.claim_id),generation:row.generation,
    sliceHash:row.slice_hash,outputHash:row.output_hash,output:row.output,compilationReportHash:row.compilation_report_hash,
    branch:row.branch,worktree:row.worktree,sourceBefore,sourceAfter,operationalRetry});
}
