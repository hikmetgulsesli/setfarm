import assert from "node:assert/strict";
import { after, it } from "node:test";
import { ImplementationSliceV1Schema } from "../../src/product-compiler/schemas/implementation-slice-v1.js";
import { buildMinimalValidContracts } from "../product-compiler/fixtures/minimal-valid-contract.js";
let api: Record<string,any>|undefined;
try {api=await import("../../src/execution/subscription-workflow-transport-v1.js");}
catch(error){const e=error as {code?:string;url?:string};if(e.code!=="ERR_MODULE_NOT_FOUND"||![".js",".ts"].some(ext=>e.url===
  new URL("../../src/execution/subscription-workflow-transport-v1"+ext,import.meta.url).href))throw error;}
function project(input: unknown){assert.equal(typeof api?.projectSubscriptionSuperviseWritePathsV1,"function","bounded supervisor scope DATA projector required");
  return api!.projectSubscriptionSuperviseWritePathsV1(input);}
function fixture(){
  const slice=ImplementationSliceV1Schema.parse(buildMinimalValidContracts().implementationSlice);
  const files=[...slice.files,{...slice.files[0]!,pathRef:"PATH_READONLY",path:"src/readonly.ts",role:"shared_readonly" as const},
    {...slice.files[0]!,pathRef:"PATH_SHARED",path:"src/shared.ts",role:"shared_writable" as const}];
  const extended=ImplementationSliceV1Schema.parse({...slice,files});
  return {worktree:"/project/supervisor-worktree",subject:{kind:"story_member",storyDbId:"story-db-1",storyId:slice.storyId,storyIndex:1,storyClaimGeneration:4},
    contexts:[{storyDbId:"story-db-1",storyClaimGeneration:4,slice:extended,sliceHash:"a".repeat(64)}]};
}
it("supervisor DATA scope is exact owned/shared-writable files, never read-only or whole-worktree grants",()=>{
  assert.deepEqual(project(fixture()),["/project/supervisor-worktree/src/App.tsx","/project/supervisor-worktree/src/shared.ts"]);
});
it("final-product DATA scope is a sorted explicit union rather than a directory grant",()=>{
  const f=fixture(),second=structuredClone(f.contexts[0]!);
  second.storyDbId="story-db-2";second.slice.storyId="US-002";second.slice.story.id="US-002";
  second.slice.files[0]!.path="src/Second.tsx";
  assert.deepEqual(project({...f,subject:{kind:"final_product"},contexts:[f.contexts[0],second]}),
    ["/project/supervisor-worktree/src/App.tsx","/project/supervisor-worktree/src/Second.tsx","/project/supervisor-worktree/src/shared.ts"]);
});
it("missing ambiguous crossed generation or escaping scope DATA refuses",()=>{
  const f=fixture();
  for(const value of [{...f,contexts:[]},{...f,contexts:[f.contexts[0],f.contexts[0]]},
    {...f,subject:{...f.subject,storyClaimGeneration:5}},
    {...f,contexts:[{...f.contexts[0],slice:{...f.contexts[0]!.slice,files:[{...f.contexts[0]!.slice.files[0],path:"../escape.ts"}]}}]}]){
    assert.throws(()=>project(value),/REFUSED|MISMATCH|INVALID|normalized|relative/);
  }
});

// Exercise the complete authenticated reader body, with only SQL/other owned
// readers replaced by inert boundaries. The driver Result is real; no DB opens.
async function authenticatedContractsFixture(options:Readonly<{duplicate?:boolean;customRow?:boolean}>= {}) {
  const [{readFileSync},tsModule,driver]=await Promise.all([import("node:fs"),import("typescript"),
    import(new URL("./result.js",import.meta.resolve("postgres")).href)]);
  const ts=tsModule.default,Result=driver.default;
  const file=new URL("../../src/execution/subscription-supervise-contracts-v1.ts",import.meta.url),source=readFileSync(file,"utf8");
  const tree=ts.createSourceFile(file.pathname,source,ts.ScriptTarget.ESNext,true);
  const functions=["frozen","refuse","readAuthenticatedSubscriptionSuperviseContractsV1"].map(name=>{
    const node=tree.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text===name);
    assert.ok(node,"actual reader declaration exists");return node.getText(tree).replace(/^export\s+/,"");
  }).join("\n");
  const f=fixture(),subject=f.subject,slice=f.contexts[0]!.slice;
  const rowData={story_db_id:"story-db-1",story_id:slice.storyId,story_claim_generation:4,attempt_id:"ATT_supervise-contract-fixture-01"};
  const row=options.customRow?Object.assign(new class DriverUnrelatedRow{}(),rowData):rowData;
  const rows=new Result();rows.push(row);if(options.duplicate)rows.push({...rowData});
  const tx={unsafe:async(query:string,params:unknown[])=>{
    const result=new Result();
    if(query.includes("r.attempt_id\n      FROM v3_story_claim_runtime_bindings_v1")){
      assert.deepEqual(params,["run-supervise",subject.storyDbId,21,"RTS_supervise-fixture"]);return rows;
    }
    if(query.includes("source_claim_id"))return result;
    if(query.startsWith("SELECT id FROM stories")){result.push({id:"story-db-1"});return result;}
    throw Error("UNEXPECTED_CONTRACT_READER_QUERY");
  }};
  const ports={getSql:()=>({begin:async(body:(value:unknown)=>Promise<unknown>)=>body(tx)}),
    loadAndRevalidateV3StoryClaimRuntimeBindingV1:async()=>subject,
    readNativeEvidenceOnlySuccessAuthority:async()=>{throw Error("UNEXPECTED_NATIVE_VERIFIER");},
    loadV3ImplementationAttemptContext:async(input:unknown)=>{
      assert.deepEqual(input,{runId:"run-supervise",storyId:slice.storyId,attemptId:rowData.attempt_id});
      return {attempt:{disposition:"verified"},slice,sliceHash:"a".repeat(64)};
    }};
  const compiled=ts.transpileModule(functions,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
  const read=new Function(...Object.keys(ports),compiled+";return readAuthenticatedSubscriptionSuperviseContractsV1;")(...Object.values(ports));
  const envelope={protocol:"v3",workflowStepId:"supervise",claimId:21,runId:"run-supervise",stepId:"step-supervise"};
  return {read:()=>read(envelope,"RTS_supervise-fixture"),readForged:()=>read({...envelope,workflowStepId:"implement"},"RTS_supervise-fixture"),
    rows,expected:{subject,rows:[rowData],contexts:[{storyDbId:"story-db-1",storyClaimGeneration:4,slice,sliceHash:"a".repeat(64)}]}};
}

it("authenticated PostgreSQL Result contracts seal as immutable canonical own-data arrays",async()=>{
  const {hashCanonicalJson}=await import("../../src/product-compiler/canonical-json.js"),f=await authenticatedContractsFixture();
  assert.notEqual(Object.getPrototypeOf(f.rows),Array.prototype,"fixture uses the genuine driver Result subclass");
  const contracts=await f.read();
  assert.equal(hashCanonicalJson(contracts),hashCanonicalJson(f.expected));
  assert.equal(Object.getPrototypeOf(contracts.rows),Array.prototype);
  assert.ok(Object.isFrozen(contracts)&&Object.isFrozen(contracts.rows)&&Object.isFrozen(contracts.rows[0]));
  assert.throws(()=>contracts.rows.push({}),TypeError);
});

it("contract row conversion retains canonical rejection of custom row prototypes",async()=>{
  const {hashCanonicalJson}=await import("../../src/product-compiler/canonical-json.js"),f=await authenticatedContractsFixture({customRow:true});
  const contracts=await f.read();
  assert.throws(()=>hashCanonicalJson(contracts),(error:any)=>error.code==="CANONICAL_JSON_UNSUPPORTED_PROTOTYPE"&&error.path==="$/rows/0");
});

it("authenticated contract reader still refuses duplicate membership and forged stage",async()=>{
  const duplicate=await authenticatedContractsFixture({duplicate:true});
  await assert.rejects(duplicate.read(),/SUBSCRIPTION_SUPERVISE_CONTRACTS_REFUSED/);
  const valid=await authenticatedContractsFixture();
  await assert.rejects(valid.readForged(),/SUBSCRIPTION_SUPERVISE_CONTRACTS_REFUSED/);
});

let nativeComponentFixture:Promise<any>|undefined;
async function defaultNativeComponentFixture() {
  nativeComponentFixture??=import('../evidence/native-packet-v3-evidence-fixture.js').then(api=>api.nativeBrowserFixture());
  return nativeComponentFixture;
}
after(async()=>{if(nativeComponentFixture)(await nativeComponentFixture).cleanup();});

/** Component boundary: genuine readers/schema/hash/plan, inert SQL and artifact
 * storage. This proves projection integrity, not live database join authority. */
export async function superviseEvidenceComponentFixture(native?:{slice?:any;sliceHash?:string;compilerInput?:any;legacyPacketVersion?:1|2}) {
  const [{readFileSync},tsModule,crypto,canonical,bundles,plans,modelAuthority,promptContracts,contextOps]=await Promise.all([
    import('node:fs'),import('typescript'),import('node:crypto'),import('../../src/product-compiler/canonical-json.js'),
    import('../../src/evidence/evidence-bundle-v2.js'),import('../../src/evidence/evidence-plan-v1.js'),
    import('../../src/recovery/v3-evidence-only-publication.js'),import('../../src/installer/prompt-contracts.js'),
    import('../../src/installer/context-ops.js')]);
  const digest=(text:string)=>crypto.createHash('sha256').update(text).digest('hex');
  const legacy=native?.legacyPacketVersion?await legacyCompiledSuperviseContext(native.legacyPacketVersion):undefined;
  if(!legacy&&!native?.slice)native=await defaultNativeComponentFixture();
  const f=fixture(),slice=legacy?.compiled.slice??native?.slice??f.contexts[0]!.slice,runId='run-supervise',attemptId='ATT_supervise-evidence-00001';
  const sliceHash=legacy?.compiled.sliceHash??native?.sliceHash??'a'.repeat(64),packetHash=slice.packetHash;
  const plansV2=await import('../../src/evidence/evidence-plan-v2.js');
  const evidencePlan=slice.schema==='setfarm.implementation-slice.v2'?plansV2.compileEvidencePlanV2({slice,sliceHash}):plans.compileEvidencePlanV1({slice,sliceHash});
  const sourceBefore={sha:'1'.repeat(40),treeHash:'2'.repeat(40)},sourceAfter={sha:'3'.repeat(40),treeHash:'4'.repeat(40)};
  const startedAt='2026-11-08T20:00:00.000Z',completedAt='2026-11-08T20:01:00.000Z';
  const flowObservations=evidencePlan.flows.map(flow=>({kind:'control' as const,owner:'setfarm-orchestrator' as const,startedAt,completedAt,
    actionRef:flow.actionRef,controlRef:flow.controlRef!,beforeArtifactHash:'b'.repeat(64),afterArtifactHash:'c'.repeat(64)}));
  const commandObservations=evidencePlan.commands.map(command=>({kind:'command' as const,owner:'setfarm-orchestrator' as const,startedAt,completedAt,
    commandRef:command.commandRef,exitCode:0,stdoutArtifactHash:'d'.repeat(64)}));
  const required=slice.schema==='setfarm.implementation-slice.v2'?slice.contract.product.evidencePredicates.filter((p:any)=>p.required&&slice.story.evidenceRefs.includes(p.id)):slice.requiredEvidence;
  const predicates=evidencePlan.predicateRefs.map(predicateRef=>{
    const flows=evidencePlan.flows.filter(flow=>flow.predicateRefs.includes(predicateRef));
    const actions=[...new Set(flows.map(flow=>flow.actionRef))],controls=[...new Set(flows.map(flow=>flow.controlRef))];
    return {invariantRef:'INV_'+required.find((p:any)=>p.id===predicateRef).kind.toUpperCase(),predicateRef,
      ...(actions.length===1?{actionRef:actions[0]}:{}),...(controls.length===1&&controls[0]?{controlRef:controls[0]}:{}),
      required:true,verdict:'pass' as const,observationRefs:flows.map(flow=>bundles.computeObservationRef(flowObservations[evidencePlan.flows.indexOf(flow)]!))};
  });
  const commandPredicates=evidencePlan.commands.map((command,index)=>({invariantRef:'INV_COMMAND_'+command.kind.toUpperCase(),
    predicateRef:'EVID_COMMAND_'+command.commandRef,required:true,verdict:'pass' as const,
    observationRefs:[bundles.computeObservationRef(commandObservations[index]!)]}));
  const bundle=bundles.createEvidenceBundleV2({runId,storyId:slice.storyId,packetHash,sliceHash,sourceRevision:sourceAfter,
    attemptId,predicates:[...predicates,...commandPredicates],observations:[...flowObservations,...commandObservations],
    artifacts:[{hash:'b'.repeat(64),mediaType:'image/png',locator:'evidence/before.png'},
      {hash:'c'.repeat(64),mediaType:'image/png',locator:'evidence/after.png'},
      ...(commandObservations.length?[{hash:'d'.repeat(64),mediaType:'text/plain',locator:'evidence/command.log'}]:[])],
    runner:{id:'setfarm-owned-runner',version:'1',environmentHash:'d'.repeat(64)},startedAt,completedAt});
  const bundleHash=bundles.computeEvidenceBundleHash(bundle),authorityHash='e'.repeat(64),custody='setfarm://native-git-custody-v1/'+'f'.repeat(64);
  const evidenceRefs=[custody,`setfarm://preparation-authority-v2/${authorityHash}`,`setfarm://evidence-bundle/${bundleHash}`];
  const output=JSON.stringify({schema:'setfarm.v3-implementation-agent-proposal.v1',disposition:'ready_for_evidence',
    handoffHash:'0'.repeat(64),attemptId,packetHash,sliceHash,sourceBefore,summary:'Candidate',changes:[]});
  const completionPlan={schema:'setfarm.runtime-completion-plan.v1',planVersion:1,requestId:'RCR_supervise-evidence-00001',
    claimId:11,runId,stepDbId:'step-implement',workflowStepId:'implement',outputHash:digest(output),kind:'story_completion',
    continuation:{type:'story_route_supervise'},subject:{storyId:slice.storyId,storyDbId:f.subject.storyDbId,sourceSha:sourceAfter.sha},
    effects:[{effectKey:'continue/supervise',ordinal:0,effectType:'story.route.supervise',mandatory:true,payload:{}}],preparedAt:completedAt};
  const model:any={attempt_id:attemptId,claim_id:'11',generation:1,slice_hash:sliceHash,compilation_report_hash:'7'.repeat(64),
    branch:'fixture-branch',worktree:'/project/fixture',source_before_sha:sourceBefore.sha,source_before_tree_hash:sourceBefore.treeHash,
    source_after_sha:sourceAfter.sha,source_after_tree_hash:sourceAfter.treeHash,output_hash:digest(output),output,
    evidence_refs:JSON.stringify(evidenceRefs),completion_plan:completionPlan,completion_plan_hash:canonical.hashCanonicalJson(completionPlan),
    request_id:completionPlan.requestId,step_db_id:completionPlan.stepDbId,story_db_id:f.subject.storyDbId,authority_hash:authorityHash,
    initial_attempt_id:attemptId,initial_claim_id:'11',initial_branch:'fixture-branch',initial_worktree:'/project/fixture',
    initial_sha:sourceBefore.sha,initial_tree_hash:sourceBefore.treeHash,initial_evidence_refs:JSON.stringify(evidenceRefs)};
  const acceptance={schema:'setfarm.v3-story-acceptance-record.v1',storyId:slice.storyId,attemptId,packetHash,sliceHash,
    sourceRevision:sourceAfter,evidenceBundleRef:`setfarm://evidence-bundle/${bundleHash}`,aggregateVerdict:'pass',
    findingSetRef:null,failureClass:null,agentOutputHash:model.output_hash};
  const attempt:any={attemptId,runId,storyId:slice.storyId,stepId:'implement',claimId:11,generation:1,disposition:'produced_delta',
    attemptClass:'product_implementation',sourceBefore,sourceAfter,packetHash,sliceHash,outputHash:model.output_hash,evidenceRefs};
  const member={story_db_id:f.subject.storyDbId,story_id:slice.storyId,story_claim_generation:4,attempt_id:attemptId};
  const stored:any={evidence_bundle_hash:bundleHash,evidence_id:bundle.evidenceId,run_id:runId,story_id:slice.storyId,
    attempt_id:attemptId,packet_hash:packetHash,slice_hash:sliceHash,source_sha:sourceAfter.sha,source_tree_hash:sourceAfter.treeHash,
    aggregate_verdict:'pass',payload:bundle,story_db_id:f.subject.storyDbId,story_claim_generation:4,
    story_output:canonical.canonicalJsonStringify(acceptance),claim_id:'11',generation:1};
  const state={subject:f.subject as any,members:[member],bundles:[stored],model,attempt,acceptance,
    rcrState:'accepted',applyPhase:'effects_committed',runtimeState:'released',compiled:{kind:'native-dispatch-ready',attempt,slice,sliceHash,packetHash,evidencePlan},
    nativeRow:undefined as any,nativeSource:undefined as any,nativeCandidate:undefined as any,nativeAuthorityQueries:0,compiledByAttempt:undefined as Map<string,any>|undefined};
  if(legacy){state.compiled=legacy.compiled as any;state.model.evidence_refs=JSON.stringify(legacy.compiled.attempt.evidenceRefs);
    state.model.initial_evidence_refs=state.model.evidence_refs;}
  const tx={unsafe:async(query:string,params:unknown[])=>{
    if(query.includes('bundle.payload AS bundle_payload')&&query.includes('delivery.terminal_result'))return state.nativeRow?[state.nativeRow]:[];
    if(query.includes('WITH RECURSIVE source_revision_history'))return state.nativeSource?[state.nativeSource]:[];
    if(query.includes('initial.attempt_id AS initial_attempt_id')) {
      state.nativeAuthorityQueries++;
      assert.deepEqual(params.slice(0,4),[attemptId,runId,slice.storyId,packetHash]);
      return state.rcrState==='accepted'&&state.applyPhase==='effects_committed'&&state.runtimeState==='released'?[state.model]:[];
    }
    if(query.includes('r.attempt_id\n      FROM v3_story_claim_runtime_bindings_v1'))return state.members;
    if(query.includes('source_claim_id'))return state.nativeCandidate?[state.nativeCandidate]:[];
    if(query.startsWith('SELECT id FROM stories'))return state.members.map(row=>({id:row.story_db_id}));
    if(query.includes('FROM evidence_bundles'))return state.bundles;
    throw Error('UNEXPECTED_EVIDENCE_COMPONENT_SQL:'+query);
  }};
  const ts=tsModule.default,source=readFileSync(new URL('../../src/execution/subscription-supervise-contracts-v1.ts',import.meta.url),'utf8');
  const tree=ts.createSourceFile('contracts.ts',source,ts.ScriptTarget.ESNext,true);
  const functions=tree.statements.filter(ts.isFunctionDeclaration).map(node=>node.getText(tree).replace(/^export\s+/, '')).join('\n');
  const ports={getSql:()=>({begin:async(body:any)=>body(tx)}),loadAndRevalidateV3StoryClaimRuntimeBindingV1:async()=>state.subject,
    loadV3ImplementationAttemptContext:async(input:any)=>state.compiledByAttempt?.get(input.attemptId)??state.compiled,...canonical,...bundles,...plans,...plansV2,
    readNativeAcceptedModelSourceAuthority:modelAuthority.readNativeAcceptedModelSourceAuthority,
    readNativeEvidenceOnlySuccessAuthority:modelAuthority.readNativeEvidenceOnlySuccessAuthority};
  const compiled=ts.transpileModule(functions,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
  const readers=new Function(...Object.keys(ports),compiled+';return {contracts:readAuthenticatedSubscriptionSuperviseContractsV1,evidence:typeof readAuthenticatedSubscriptionSuperviseEvidenceV1 === "function" ? readAuthenticatedSubscriptionSuperviseEvidenceV1 : undefined};')(...Object.values(ports));
  const envelope={protocol:'v3',workflowStepId:'supervise',claimId:21,runId,stepId:'step-supervise'};
  async function enableNativeVerifier() {
    const verifierId='ATT_native-supervise-verifier-00001',planArtifact='8'.repeat(64);
    const {schema:_schema,evidenceId:_id,aggregateVerdict:_verdict,observations,...draft}=bundle;
    const drafts=observations.map(({observationRef:_ref,...observation})=>observation);
    const original=bundles.createEvidenceBundleV2({...draft,predicates:draft.predicates.map(p=>({...p,verdict:'inconclusive' as const})),observations:drafts});
    const originalHash=bundles.computeEvidenceBundleHash(original);
    const verified=bundles.createEvidenceBundleV2({...draft,attemptId:verifierId,observations:drafts});
    const verifiedHash=bundles.computeEvidenceBundleHash(verified);
    const findings=await import('../../src/findings/finding-set.js');
    const findingSet=findings.createFindingSetV1({runId,storyId:slice.storyId,packetHash,sliceHash,sourceRevision:sourceAfter,
      findings:[{origin:'runtime',classification:'structured',invariantRef:'INV_RUNTIME',expectedPredicateRef:evidencePlan.predicateRefs[0],
        sourceLocators:[{path:'src/App.tsx',contentHash:'a'.repeat(64)}],observedEvidenceRefs:[originalHash],status:'open'}]});
    state.model.evidence_refs=JSON.stringify([custody,`setfarm://preparation-authority-v2/${authorityHash}`,
      `setfarm://evidence-bundle/${originalHash}`,`setfarm://artifact/${planArtifact}`]);
    state.model.initial_evidence_refs=state.model.evidence_refs;
    const refresh={kind:'native_evidence_refresh',sourceOwnerAttemptId:attemptId,sourceOwnerGeneration:1,
      sourceOwnerOutputHash:model.output_hash,sourceOwnerClaimOutcome:'completed',initialAuthorityHash:authorityHash,
      recoveryCaseId:'RCV_'+'1'.repeat(64),revisionId:'RREV_'+'2'.repeat(64),dispatchId:'RDISP_'+'3'.repeat(64),
      evidencePlanArtifactHash:planArtifact,evidenceBundleHash:verifiedHash};
    const nativeAcceptance={schema:'setfarm.v3-story-acceptance-record.v1',kind:'native_evidence_refresh',storyId:slice.storyId,
      attemptId:verifierId,packetHash,sliceHash,sourceRevision:sourceAfter,evidenceBundleRef:`setfarm://evidence-bundle/${verifiedHash}`,
      aggregateVerdict:'pass',findingSetRef:null,failureClass:null,sourceOwnerAttemptId:attemptId,agentOutputHash:model.output_hash,evidenceRefresh:refresh};
    const storyOutput=canonical.canonicalJsonStringify(nativeAcceptance);
    const eventHash=canonical.hashCanonicalJson({schema:'setfarm.v3-recovery-coordinator-event.v1',value:{kind:'recovery_evidence',
      recoveryCaseId:refresh.recoveryCaseId,revisionId:refresh.revisionId,dispatchId:refresh.dispatchId,attemptId:verifierId,evidenceBundleHash:verifiedHash}});
    const decisionRef=canonical.hashCanonicalJson({schema:'setfarm.recovery-delivery-decision.v1',value:{kind:'recovery_evidence_satisfied',coordinatorEventHash:eventHash}});
    const verifierRefs=[custody,`setfarm://preparation-authority-v2/${authorityHash}`,`setfarm://artifact/${sliceHash}`,
      `setfarm://artifact/${planArtifact}`,`setfarm://evidence-bundle/${verifiedHash}`];
    state.nativeRow={attempt_id:verifierId,claim_id:'22',generation:2,slice_hash:sliceHash,output_hash:verifiedHash,
      delivery_state:'succeeded',case_status:'resolved',fence_token:'fixture-native-fence',compilation_report_hash:model.compilation_report_hash,
      branch:model.branch,worktree:model.worktree,evidence_refs:JSON.stringify(verifierRefs),source_sha:sourceAfter.sha,source_tree_hash:sourceAfter.treeHash,
      recovery_case_id:refresh.recoveryCaseId,revision_id:refresh.revisionId,dispatch_id:refresh.dispatchId,finding_set_hash:findingSet.findingSetHash,
      evidence_plan_artifact_hash:planArtifact,evidence_plan:[...evidencePlan.predicateRefs],bundle_payload:verified,
      terminal_result:{schema:'setfarm.v3-recovery-coordinator-result.v1',eventHash,evidenceBundleHash:verifiedHash,attemptId:verifierId,verdict:'pass'},
      case_terminal:{owner:'infrastructure',outcome:'resolved',reasonCode:'evidence_satisfied',evidenceBundleHashes:[verifiedHash]},decision_refs:[decisionRef],
      source_owner_attempt_id:attemptId,source_owner_claim_id:'11',source_owner_generation:1,source_owner_output_hash:model.output_hash,
      source_owner_output:model.output,source_owner_claim_outcome:'completed',source_owner_plan:model.completion_plan,
      source_owner_plan_hash:model.completion_plan_hash,source_owner_request_id:model.request_id,source_owner_step_db_id:model.step_db_id,
      original_bundle_hash:originalHash,original_bundle_payload:original,original_finding_payload:findingSet,
      source_owner_before_sha:sourceBefore.sha,source_owner_before_tree_hash:sourceBefore.treeHash,
      source_owner_evidence_refs:state.model.evidence_refs,authority_hash:authorityHash,
      story_db_id:f.subject.storyDbId,story_status:'done',story_output:storyOutput,story_claim_generation:4};
    state.nativeSource={attempt_id:attemptId,generation:1,authority_hash:authorityHash,compilation_report_hash:model.compilation_report_hash,
      branch:model.branch,worktree:model.worktree,evidence_refs:model.evidence_refs,evidence_plan_artifact_hash:planArtifact};
    state.nativeCandidate={story_db_id:f.subject.storyDbId,story_id:slice.storyId,story_claim_generation:4,
      source_claim_id:'11',attempt_id:verifierId,packet_hash:packetHash};
    state.compiled.attempt={...attempt,attemptId:verifierId,claimId:22,generation:2,disposition:'verified',attemptClass:'evidence_only',
      sourceBefore:sourceAfter,outputHash:verifiedHash,evidenceRefs:verifierRefs};
    state.bundles=[{...stored,evidence_bundle_hash:verifiedHash,evidence_id:verified.evidenceId,attempt_id:verifierId,
      payload:verified,claim_id:'22',generation:2,story_output:storyOutput}];
    return {verifierId,verifiedHash};
  }
  return {state,readers,envelope,enableNativeVerifier,legacyPacket:legacy?.packet,nativePacket:native?.compilerInput?.packet,read:()=>readers.evidence(envelope,'RTS_supervise-fixture'),bundle,bundleHash,completionPlan,sourceAfter,
    canonical,bundles,ports,promptContracts,contextOps,ts};
}

it('authenticated evidence preserves actual bundle, accepted RCR, candidate tree and immutable own DATA',async()=>{
  const f=await superviseEvidenceComponentFixture(),old=await f.readers.contracts(f.envelope,'RTS_supervise-fixture');
  const oldSeal=f.canonical.hashCanonicalJson(old),data=await f.read();
  assert.equal(data.members[0].evidenceBundleHash,f.bundleHash);
  assert.equal(data.members[0].authority.requestId,'RCR_supervise-evidence-00001');
  assert.equal(data.members[0].authority.kind,'accepted_model');
  assert.deepEqual(data.members[0].bundle,f.bundle);
  assert.deepEqual(data.members[0].bundle.sourceRevision,{sha:'3'.repeat(40),treeHash:'4'.repeat(40)});
  assert.equal(data.members[0].storyClaimGeneration,4);
  assert.equal(data.members[0].attemptGeneration,1);
  assert.ok(Object.isFrozen(data)&&Object.isFrozen(data.members)&&Object.isFrozen(data.members[0].bundle.predicates));
  assert.equal(f.canonical.hashCanonicalJson(await f.readers.contracts(f.envelope,'RTS_supervise-fixture')),oldSeal,'evidence read leaves original contract seal unchanged');
  assert.doesNotMatch(f.canonical.canonicalJsonStringify(data),/Candidate|ready_for_evidence|completion_plan|stdout[^A]/);
});

it('authenticated evidence refuses absent duplicate crossed or tampered bundle and source bindings',async()=>{
  const mutations:ReadonlyArray<readonly[string,(f:Awaited<ReturnType<typeof superviseEvidenceComponentFixture>>)=>void]>=[
    ['missing bundle',f=>{f.state.bundles=[];}],['duplicate bundle',f=>{f.state.bundles.push({...f.state.bundles[0]});}],
    ['crossed run',f=>{f.state.bundles[0].run_id='foreign-run';}],
    ['crossed story',f=>{f.state.bundles[0].story_id='US-999';}],
    ['crossed generation',f=>{f.state.bundles[0].story_claim_generation=5;}],
    ['crossed attempt',f=>{f.state.bundles[0].attempt_id='ATT_foreign-attempt-00001';}],
    ['crossed claim',f=>{f.state.bundles[0].claim_id='99';}],
    ['crossed attempt generation',f=>{f.state.bundles[0].generation=8;}],
    ['crossed packet',f=>{f.state.bundles[0].packet_hash='9'.repeat(64);}],
    ['crossed slice',f=>{f.state.bundles[0].slice_hash='9'.repeat(64);}],
    ['crossed source',f=>{f.state.bundles[0].source_sha='9'.repeat(40);}],
    ['crossed tree',f=>{f.state.bundles[0].source_tree_hash='9'.repeat(40);}],
    ['changed bundle hash',f=>{f.state.bundles[0].evidence_bundle_hash='9'.repeat(64);}],
    ['tampered payload',f=>{f.state.bundles[0].payload={...f.bundle,runner:{...f.bundle.runner,version:'tampered'}};}],
    ['crossed RCR',f=>{f.state.model.request_id='RCR_crossed-request-00001';}],
    ['unaccepted RCR',f=>{f.state.rcrState='requested';}],
    ['effects not committed',f=>{f.state.applyPhase='owner_committed';}],
    ['runtime not released',f=>{f.state.runtimeState='drained';}],
    ['contradictory acceptance',f=>{f.state.bundles[0].story_output=f.canonical.canonicalJsonStringify({...f.state.acceptance,evidenceBundleRef:'setfarm://evidence-bundle/'+'9'.repeat(64)});}],
    ['missing required predicate',f=>{f.state.compiled.evidencePlan={...f.state.compiled.evidencePlan,predicateRefs:[...f.state.compiled.evidencePlan.predicateRefs,'EVID_MISSING']};}],
  ];
  for(const[label,mutate]of mutations){const f=await superviseEvidenceComponentFixture();mutate(f);await assert.rejects(f.read(),undefined,label);}
});

it('fail and inconclusive evidence cannot inherit PASS from accepted model custody',async()=>{
  for(const verdict of ['fail','inconclusive'] as const){const f=await superviseEvidenceComponentFixture();
    const {schema:_schema,evidenceId:_id,aggregateVerdict:_aggregate,observations,...draft}=f.bundle;
    const bundle=f.bundles.createEvidenceBundleV2({...draft,predicates:draft.predicates.map(p=>({...p,verdict})),
      observations:observations.map(({observationRef:_ref,...observation})=>observation)});
    const hash=f.bundles.computeEvidenceBundleHash(bundle),ref=`setfarm://evidence-bundle/${hash}`;
    Object.assign(f.state.bundles[0],{payload:bundle,evidence_bundle_hash:hash,evidence_id:bundle.evidenceId,aggregate_verdict:verdict,
      story_output:f.canonical.canonicalJsonStringify({...f.state.acceptance,evidenceBundleRef:ref,aggregateVerdict:verdict})});
    f.state.attempt.evidenceRefs=f.state.attempt.evidenceRefs.map((value:string)=>value.startsWith('setfarm://evidence-bundle/')?ref:value);
    f.state.model.evidence_refs=JSON.stringify(f.state.attempt.evidenceRefs);
    await assert.rejects(f.read(),/REFUSED|INVALID|MISMATCH/);
  }
});

it('final product and story member use the same exact authenticated evidence membership',async()=>{
  const f=await superviseEvidenceComponentFixture();f.state.subject={kind:'final_product'};
  const data=await f.read();assert.deepEqual(data.subject,{kind:'final_product'});assert.equal(data.members.length,1);
  f.state.members.push({...f.state.members[0]!});await assert.rejects(f.read(),/REFUSED/);
});

it('native evidence-only success projects its genuine verifier authority without inventing a model RCR',async()=>{
  const f=await superviseEvidenceComponentFixture(),native=await f.enableNativeVerifier();
  const data=await f.read(),member=data.members[0];
  assert.equal(member.attemptId,'ATT_native-supervise-verifier-00001');
  assert.equal(member.authority.kind,'native_evidence_refresh');
  assert.equal(member.authority.claimId,22);assert.equal(member.authority.sourceOwnerClaimId,11);
  assert.equal(member.evidenceBundleHash,native.verifiedHash);assert.equal(member.bundle.aggregateVerdict,'pass');
  assert.equal(Object.hasOwn(member.authority,'requestId'),false);
  f.state.nativeRow.delivery_state='running';await assert.rejects(f.read(),/V3_NATIVE_EVIDENCE_SUCCESS_MISSING/);
});
it('native evidence-only rejects crossed source owner and tampered terminal result',async()=>{
  for(const mutate of [(f:any)=>{f.state.nativeRow.source_owner_attempt_id='ATT_crossed-native-owner-00001';},
    (f:any)=>{f.state.nativeRow.terminal_result.verdict='fail';},(f:any)=>{f.state.nativeRow.source_tree_hash='9'.repeat(40);},
    (f:any)=>{f.state.nativeRow.story_claim_generation=5;}]){
    const f=await superviseEvidenceComponentFixture();await f.enableNativeVerifier();mutate(f);await assert.rejects(f.read(),/MISMATCH|REFUSED/);
  }
});
it('native compiled multi-control plan retains aggregated predicate and required command coverage',async()=>{
  const {nativeBrowserFixture}=await import('../evidence/native-packet-v3-evidence-fixture.js'),native=await nativeBrowserFixture({twoPlacements:true});
  try{const f=await superviseEvidenceComponentFixture(native),data=await f.read();
    assert.equal(data.members[0].bundle.aggregateVerdict,'pass');
    assert.ok(data.members[0].bundle.predicates.some((p:any)=>p.invariantRef.startsWith('INV_COMMAND_')));
    assert.ok(data.members[0].bundle.predicates.some((p:any)=>!p.invariantRef.startsWith('INV_COMMAND_')&&!p.controlRef));
  }finally{(await import('node:fs')).rmSync(native.workdir,{recursive:true,force:true});}
});

it('canonical passing bundles cannot omit required coverage or cross predicate identities',async()=>{
  for(const change of ['missing','optional','wrong invariant','wrong action','missing command'] as const){
    const f=await superviseEvidenceComponentFixture();
    const {schema:_schema,evidenceId:_id,aggregateVerdict:_aggregate,observations,...draft}=f.bundle;
    const product=draft.predicates.find(p=>!p.invariantRef.startsWith('INV_COMMAND_'))!;
    const predicates=draft.predicates.flatMap(p=>{
      if(change==='missing command'&&p.invariantRef.startsWith('INV_COMMAND_'))return [];
      if(p!==product)return [p];
      if(change==='missing')return [];
      if(change==='wrong action'){const {controlRef:_control,...rest}=p;return [{...rest,actionRef:'ACT_FOREIGN'}];}
      return [{...p,...(change==='optional'?{required:false}:change==='wrong invariant'?{invariantRef:'INV_FOREIGN'}:{})}];
    });
    const refs=new Set(predicates.flatMap(p=>p.observationRefs));
    const bundle=f.bundles.createEvidenceBundleV2({...draft,predicates,
      observations:observations.filter(o=>refs.has(o.observationRef)).map(({observationRef:_ref,...o})=>o)});
    assert.equal(bundle.aggregateVerdict,'pass','negative fixture remains schema-valid PASS before exact coverage check');
    const hash=f.bundles.computeEvidenceBundleHash(bundle),ref=`setfarm://evidence-bundle/${hash}`;
    Object.assign(f.state.bundles[0],{payload:bundle,evidence_bundle_hash:hash,evidence_id:bundle.evidenceId,
      story_output:f.canonical.canonicalJsonStringify({...f.state.acceptance,evidenceBundleRef:ref})});
    f.state.attempt.evidenceRefs=f.state.attempt.evidenceRefs.map((value:string)=>value.startsWith('setfarm://evidence-bundle/')?ref:value);
    f.state.model.evidence_refs=JSON.stringify(f.state.attempt.evidenceRefs);
    await assert.rejects(f.read(),/REFUSED/,change);
  }
});

/** Actual legacy context loader with inert packet/artifact/attempt storage. The
 * sealed packet port is schema-checked; no native preparation/custody exists. */
async function legacyCompiledSuperviseContext(version:1|2,storyId='US-001',attemptId='ATT_supervise-evidence-00001') {
  const [api,canonical,planApi,v1,v2]=await Promise.all([import('../../src/execution/v3-implementation-attempt.js'),
    import('../../src/product-compiler/canonical-json.js'),import('../../src/evidence/evidence-plan-v1.js'),
    import('../../src/product-compiler/schemas/product-build-packet-v1.js'),import('../../src/product-compiler/schemas/product-build-packet-v2.js')]);
  const values=buildMinimalValidContracts(),producer={pass:'legacy-packet-compiler',codeSha:'5840ae3',toolVersions:{}};
  const packet=version===1?v1.ProductBuildPacketV1Schema.parse(values.packet):v2.ProductBuildPacketV2Schema.parse({
    ...values.packet,schema:'setfarm.product-build-packet.v2',packetVersion:2,designSourceClosureHash:'8'.repeat(64)});
  const packetHash=canonical.hashCanonicalJson({schema:'setfarm.semantic-artifact-envelope.v1',artifactType:packet.schema,producer,payload:packet});
  const slice=ImplementationSliceV1Schema.parse({...values.implementationSlice,packetHash,storyId,story:{...values.implementationSlice.story,id:storyId}});
  const sliceEnvelope={schema:'setfarm.semantic-artifact-envelope.v1',artifactType:slice.schema,producer,payload:slice};
  const sliceHash=canonical.hashCanonicalJson(sliceEnvelope),plan=planApi.compileEvidencePlanV1({slice,sliceHash});
  const planEnvelope={schema:'setfarm.semantic-artifact-envelope.v1',artifactType:plan.schema,producer,payload:plan};
  const planHash=canonical.hashCanonicalJson(planEnvelope),now='2026-11-08T20:00:00.000Z';
  const {ExecutionAttemptV1Schema}=await import('../../src/execution/schemas/execution-attempt-v1.js');
  const attempt=ExecutionAttemptV1Schema.parse({schema:'setfarm.execution-attempt.v1',attemptId,claimId:11,
    runId:'run-supervise',stepId:'implement',storyId:slice.storyId,generation:1,fenceToken:'1'.repeat(64),attemptClass:'product_implementation',
    packetHash,compilationReportHash:'7'.repeat(64),sliceHash,sourceBefore:{sha:'1'.repeat(40),treeHash:'2'.repeat(40)},
    sourceAfter:{sha:'3'.repeat(40),treeHash:'4'.repeat(40)},role:'developer',agentId:'feature-dev_developer',branch:'fixture-branch',
    worktree:'/project/fixture',lease:{acquiredAt:now,expiresAt:now,heartbeatAt:now},disposition:'produced_delta',
    outputHash:'9'.repeat(64),evidenceRefs:['setfarm://claim-log/11',`setfarm://artifact/${sliceHash}`,`setfarm://artifact/${planHash}`],createdAt:now,updatedAt:now});
  const sealed={runId:attempt.runId,packetHash,producer,packet,productSpec:values.productSpec,designGraph:values.designGraph,
    buildTopology:values.buildTopology,storyPlan:values.storyPlan,refs:{compilationReport:attempt.compilationReportHash}};
  const compiler=api.createV3ImplementationAttemptCompiler({readPacket:async()=>sealed,findAttempt:async()=>attempt,
    readArtifact:async(hash:string)=>{if(hash===sliceHash)return sliceEnvelope;if(hash===planHash)return planEnvelope;throw Error('UNEXPECTED_LEGACY_ARTIFACT');},
    publish:async()=>{throw Error('UNEXPECTED_LEGACY_PUBLICATION');},addRunRef:async()=>{throw Error('UNEXPECTED_LEGACY_REF');},
    reserveAttempt:async()=>{throw Error('UNEXPECTED_LEGACY_RESERVATION');},captureSource:async()=>{throw Error('UNEXPECTED_LEGACY_SOURCE');},
    readDependencies:async()=>{throw Error('UNEXPECTED_LEGACY_DEPENDENCIES');}} as any);
  const compiled=await compiler.loadAttemptContext({runId:attempt.runId,storyId:attempt.storyId,attemptId:attempt.attemptId});
  assert.equal(compiled.kind,undefined);assert.equal(compiled.slice.schema,'setfarm.implementation-slice.v1');
  assert.equal(compiled.attempt.evidenceRefs.some(ref=>ref.includes('native-git-custody')||ref.includes('preparation-authority-v2')),false);
  return {packet,compiled};
}

for(const version of [1,2] as const)it(`accepted legacy packet v${version} preserves supervisor input compatibility without native custody`,async()=>{
  const f=await superviseEvidenceComponentFixture({legacyPacketVersion:version});
  assert.equal(f.legacyPacket?.schema,`setfarm.product-build-packet.v${version}`);
  const old=await f.readers.contracts(f.envelope,'RTS_supervise-fixture');
  assert.equal(old.rows.length,1,'existing authenticated membership accepts this legacy lane');
  assert.equal(await f.read(),undefined,'supported legacy context has no new native evidence snapshot');
  assert.equal(f.state.nativeAuthorityQueries,0,'legacy family must not invoke native-only accepted-source authority');
});

it('native packet missing custody or tampered preparation family still refuses without compatibility fallback',async()=>{
  for(const mutate of [(f:any)=>{f.state.model.initial_evidence_refs='[]';},
    (f:any)=>{f.state.model.authority_hash='9'.repeat(64);},(f:any)=>{delete f.state.compiled.kind;}]){
    const f=await superviseEvidenceComponentFixture();assert.equal(f.nativePacket.schema,'setfarm.product-build-packet.v3');
    mutate(f);await assert.rejects(f.read(),/PROVENANCE_INVALID|REFUSED/);
  }
});
it('final product refuses mixed native and legacy compiled members without a partial evidence snapshot',async()=>{
  const f=await superviseEvidenceComponentFixture(),legacy=await legacyCompiledSuperviseContext(2,'US-002','ATT_legacy-second-member-00001');
  f.state.subject={kind:'final_product'};
  f.state.members.push({story_db_id:'story-db-2',story_id:'US-002',story_claim_generation:4,attempt_id:legacy.compiled.attempt.attemptId});
  f.state.compiledByAttempt=new Map([[f.state.compiled.attempt.attemptId,f.state.compiled],[legacy.compiled.attempt.attemptId,legacy.compiled]]);
  await assert.rejects(f.read(),/SUBSCRIPTION_SUPERVISE_CONTRACTS_REFUSED/);
  assert.equal(f.state.nativeAuthorityQueries,0,'mixed-family preflight refuses before selecting partial native evidence');
});
