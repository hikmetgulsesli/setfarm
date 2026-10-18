import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import path from "node:path";
import postgres from "postgres";
import ts from "typescript";
import { createFreshInstallationTestFixtureV1 as create, freshTestAdminUrl } from "./fresh-installation-test-support.js";

// SQL component coverage only: execute the exact current production argument
// on real restricted PostgreSQL rows, without importing host cleanup/setup code
// or presenting these seed rows as an admitted workflow/claim.
function productionSql(relative: string, marker: string): string {
  const file=new URL("../../"+relative,import.meta.url),source=readFileSync(file,"utf8");
  const tree=ts.createSourceFile(file.pathname,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);
  const matches:string[]=[];
  const visit=(node:ts.Node):void=>{
    if(ts.isCallExpression(node)&&node.arguments[0]&&ts.isStringLiteralLike(node.arguments[0])) {
      const callee=node.expression;
      if(((ts.isIdentifier(callee)&&["pgRun","pgExec"].includes(callee.text))
        ||(ts.isPropertyAccessExpression(callee)&&callee.name.text==="unsafe"))
        &&node.arguments[0].text.includes(marker)) matches.push(node.arguments[0].text);
    }
    ts.forEachChild(node,visit);
  };
  visit(tree);assert.equal(matches.length,1,"production SQL must be uniquely identified: "+relative+" / "+marker);
  return matches[0]!;
}

test("fresh operational schema rolls back atomically and restricts runtime provenance and MC writes",{timeout:120000},async t=>{
  const provenance=await import("../../src/installation/fresh-installation-provenance-v1.js");
  const grants=await import("../../src/installation/fresh-installation-runtime-grants-v1.js");
  const mc=await import("../../src/installation/fresh-installation-mission-control-schema-v1.js");
  const installation=await create(t); await installation.initialize();
  const target=new URL(freshTestAdminUrl);target.pathname="/"+installation.databaseName;
  const owner=postgres(target.href,{max:1,onnotice(){}});
  const quote=(s:string)=>`"${s.replaceAll('"','""')}"`;
  const install=async(tx:postgres.TransactionSql)=>{
    await tx.unsafe(`SET LOCAL ROLE ${quote(installation.ownerRole)}`);
    const trace:unknown[]=[];
    const inspected={async unsafe(query:string,args?:unknown[]){let rows;try{rows=await tx.unsafe(query,args as never);}catch(error){const e=error as {code?:string;message?:string};t.diagnostic(JSON.stringify({code:e.code,message:e.message?.replace(/sf_(?:owner|runtime)_[a-f0-9]{32}/g,"<test-role>")}));throw error;}trace.push({count:rows.length,columns:Object.keys(rows[0]??{}),booleans:Object.fromEntries(Object.entries(rows[0]??{}).filter(([,v])=>typeof v==="boolean"))});return rows;}};
    try {await provenance.installFreshInstallationProvenanceProtectionV1(inspected as never,installation.runtimeRole);}
    catch(error){t.diagnostic(JSON.stringify(trace));throw error;}
    await mc.installFreshInstallationMissionControlSchemaV1(tx,installation.runtimeRole);
    await grants.installFreshInstallationRuntimeBusinessGrantsV1(tx,installation.runtimeRole);
  };
  try {
    await assert.rejects(owner.begin(async tx=>{await install(tx);throw Error("component rollback");}),/component rollback/);
    const absent=await owner`SELECT to_regclass('public.prds') AS relation,to_regprocedure('public.setfarm_fresh_owner_head_provenance_guard_v1()') AS function`;
    assert.equal(absent[0]?.relation,null);assert.equal(absent[0]?.function,null);
    await owner.begin(install);
    const credential=JSON.parse(readFileSync(path.join(installation.directory,"runtime-credentials.json"),"utf8"));
    const runtime=postgres(credential.runtimeUrl,{max:1,onnotice(){}});
    try {
      await provenance.verifyFreshInstallationProvenanceProtectionV1(runtime,installation.runtimeRole);
      await grants.verifyFreshInstallationRuntimeBusinessGrantsV1(runtime,installation.runtimeRole);
      await runtime`SELECT authority_hash FROM v3_preparation_authorities_v2 FOR KEY SHARE`;
      await runtime`SELECT authority_hash FROM v3_preparation_authority_claims_v2 FOR KEY SHARE`;
      await runtime`INSERT INTO runs(id,workflow_id,task) VALUES ('component-run','component','test')`;
      await runtime`INSERT INTO steps(id,run_id,step_id,agent_id,step_index,input_template,expects) VALUES ('component-step','component-run','test','test',0,'test','test')`;
      await runtime`INSERT INTO claim_log(run_id,step_id,agent_id) VALUES ('component-run','test','test')`;
      // These fixed rows are owned test-component data, not ordinary run/API
      // qualification. All former assertions below remain unchanged.
      await runtime`SELECT set_config('statement_timeout','15000ms',false),set_config('lock_timeout','1000ms',false)`;
      await runtime`INSERT INTO stories(id,run_id,story_index,story_id,title,description,acceptance_criteria)
        VALUES ('component-story','component-run',0,'COMP-1','Component scope','Component SQL permissions','[]')`;
      const childClaim=await runtime`INSERT INTO claim_log(run_id,step_id,story_id,agent_id)
        VALUES ('component-run','test','COMP-1','component-evidence') RETURNING id::text AS id`;
      assert.equal(childClaim.length,1);
      const attemptId='ATT_component-evidence-0001',oldFence='1'.repeat(64),newFence='2'.repeat(64);
      await runtime.unsafe(`INSERT INTO execution_attempts (
        attempt_id,claim_id,run_id,step_id,story_id,generation,fence_token,attempt_class,
        compilation_report_hash,source_before_sha,source_before_tree_hash,role,agent_id,
        lease_acquired_at,lease_expires_at,heartbeat_at,disposition,evidence_refs)
        VALUES ($1,$2,'component-run','test','COMP-1',1,$3,'evidence_only',$4,$5,$6,
        'downstream-evidence-orchestrator','component-evidence',
        NOW()-INTERVAL '2 minutes',NOW()-INTERVAL '1 minute',NOW()-INTERVAL '2 minutes','claimed','[]')`,
        [attemptId,Number(childClaim[0]!.id),oldFence,'3'.repeat(64),'4'.repeat(40),'5'.repeat(40)]);

      await t.test("runtime executes exact setup handoff skeleton and implementation-contract update",async()=>{
        const statement=productionSql("src/installer/setup-handoff.ts","UPDATE stories SET scope_files = $1");
        const skeletons=JSON.stringify({"src/component.ts":"export const value = 1;"});
        const contract=JSON.stringify({resolved_scope_roles:[{role:"component",path:"src/component.ts",source:"scope",editScope:"owned"}]});
        const changed=await runtime.unsafe(statement,[JSON.stringify(["src/component.ts"]),"[]",skeletons,contract,new Date().toISOString(),"component-run","COMP-1"]);
        assert.equal(changed.count,1);
        const rows=await runtime`SELECT file_skeletons,implementation_contract,scope_files,resolved_scope_files,shared_files
          FROM stories WHERE id='component-story'`;
        assert.equal(rows[0]!.file_skeletons,skeletons);assert.equal(rows[0]!.implementation_contract,contract);
        assert.equal(rows[0]!.scope_files,JSON.stringify(["src/component.ts"]));
        assert.equal(rows[0]!.resolved_scope_files,rows[0]!.scope_files);assert.equal(rows[0]!.shared_files,"[]");
      });
      await t.test("runtime executes exact story action-owner contract normalization",async()=>{
        const statement=productionSql("src/installer/steps/03-stories/guards.ts","UPDATE stories SET implementation_contract = $1");
        const contract=JSON.stringify({action_ownership:["component-action"]});
        const changed=await runtime.unsafe(statement,[contract,new Date().toISOString(),"component-run","COMP-1"]);
        assert.equal(changed.count,1);
        assert.equal((await runtime`SELECT implementation_contract FROM stories WHERE id='component-story'`)[0]!.implementation_contract,contract);
      });
      await t.test("runtime executes both exact abandoned-step bookkeeping branches",async()=>{
        const storyBranch=productionSql("src/installer/cleanup-ops.ts","UPDATE steps SET status=$1,current_story_id=NULL,abandoned_count=$2");
        assert.equal((await runtime.unsafe(storyBranch,["pending",1,new Date().toISOString(),"component-step",false])).count,1);
        const singleBranch=productionSql("src/installer/cleanup-ops.ts","UPDATE steps SET status=$1,output=CASE WHEN $1='failed' THEN $2 ELSE output END,");
        assert.equal((await runtime.unsafe(singleBranch,["pending","component abandonment",2,new Date().toISOString(),"component-step",false])).count,1);
        const row=(await runtime`SELECT abandoned_count,retry_count,current_story_id,status FROM steps WHERE id='component-step'`)[0]!;
        assert.equal(row.abandoned_count,2);assert.equal(row.retry_count,2);
        assert.equal(row.current_story_id,null);assert.equal(row.status,"pending");
      });
      await t.test("runtime executes exact expired downstream attempt fenced-adoption update",async()=>{
        const statement=productionSql("src/recovery/v3-downstream-evidence-publication.ts","SET generation = generation + 1,");
        const clock=(await runtime`SELECT clock_timestamp() AS now`)[0]!.now as Date;
        const acquired=new Date(clock.getTime()),expires=new Date(acquired.getTime()+60_000);
        const args=[attemptId,newFence,acquired,expires,1,oldFence,Number(childClaim[0]!.id)];
        const changed=await runtime.unsafe(statement,args);assert.equal(changed.length,1);
        assert.equal(changed[0]!.attempt_id,attemptId);
        const row=(await runtime.unsafe("SELECT generation,fence_token,lease_acquired_at,lease_expires_at,heartbeat_at,disposition FROM execution_attempts WHERE attempt_id=$1",[attemptId]))[0]!;
        assert.equal(row.generation,2);assert.equal(row.fence_token,newFence);assert.equal(row.disposition,"claimed");
        assert.equal(new Date(row.lease_acquired_at).getTime(),acquired.getTime());
        assert.equal(new Date(row.heartbeat_at).getTime(),acquired.getTime());
        assert.equal(new Date(row.lease_expires_at).getTime(),expires.getTime());
        // The existing production WHERE fence remains effective after adoption.
        assert.equal((await runtime.unsafe(statement,args)).length,0);
      });
      await t.test("runtime executes exact cleanup observation upsert and finalization without crossing runs",async()=>{
        const source="src/execution/recovery-source-bootstrap-repository-cleanup-v1.ts";
        const upsert=productionSql(source,"INSERT INTO public.run_observations (");
        const finalize=productionSql(source,"UPDATE public.run_observations observation");
        const receiptId="internal-production-recovery-source-bootstrap-repository-cleanup-v1:component-run";
        const args=[receiptId,"component-run","pass","component cleanup SQL qualification",false];
        const inserted=await runtime.unsafe(upsert,args);assert.equal(inserted.length,1);
        assert.equal(JSON.parse(inserted[0]!.metadata).completionReleased,false);
        const replay=await runtime.unsafe(upsert,args);assert.equal(replay.length,1);
        assert.equal(replay[0]!.status,"pass");
        assert.equal((await runtime.unsafe(finalize,[receiptId,"different-component-run"])).length,0);
        const finalized=await runtime.unsafe(finalize,[receiptId,"component-run"]);assert.equal(finalized.length,1);
        assert.equal(JSON.parse(finalized[0]!.metadata).completionReleased,true);
        assert.equal((await runtime.unsafe(finalize,[receiptId,"component-run"])).length,1);
        const row=(await runtime`SELECT status,summary,detail,metadata FROM run_observations WHERE id=${receiptId}`)[0]!;
        assert.equal(row.status,"pass");assert.equal(row.summary,args[3]);assert.equal(row.detail,args[3]);
        assert.equal(JSON.parse(row.metadata).completionReleased,true);
      });
      await t.test("runtime executes exact medic persistence and latest500 retention without UPDATE rights",async()=>{
        const insert=productionSql("src/medic/medic.ts","VALUES ($1, $2, $3, $4, $5, $6)");
        const retain=productionSql("src/medic/medic.ts","DELETE FROM medic_checks WHERE id NOT IN");
        assert.equal((await runtime`SELECT count(*)::integer AS count FROM medic_checks`)[0]!.count,0);
        await runtime.begin(async tx=>{
          for(let i=0;i<=500;i++) await tx.unsafe(insert,["component-medic-"+i,new Date(Date.UTC(2026,0,1)+i*1000).toISOString(),0,0,"Component health history","[]"]);
        });
        assert.equal((await runtime.unsafe(retain)).count,1);
        assert.equal((await runtime`SELECT count(*)::integer AS count FROM medic_checks`)[0]!.count,500);
        assert.equal((await runtime`SELECT id FROM medic_checks WHERE id='component-medic-0'`).length,0);
        assert.equal((await runtime`SELECT id FROM medic_checks WHERE id='component-medic-500'`).length,1);
        assert.equal((await runtime.unsafe(retain)).count,0);
        await assert.rejects(runtime`UPDATE medic_checks SET summary='changed' WHERE id='component-medic-500'`,/permission denied/);
        await assert.rejects(runtime`TRUNCATE medic_checks`,/permission denied/);
      });
      await t.test("runtime executes exact user rule create import toggle edit and delete SQL",async()=>{
        const source="src/server/dashboard.ts",ts=new Date().toISOString();
        const create=productionSql(source,"TRUE, 0, $8, $9)");
        const imported=productionSql(source,"$7, $8, 0, $9, $10)");
        const importUpdate=productionSql(source,"UPDATE rules SET content = $1");
        const toggle=productionSql(source,"UPDATE rules SET enabled = NOT enabled");
        const edit=productionSql(source,"UPDATE rules SET title = $1");
        const remove=productionSql(source,"DELETE FROM rules WHERE id = $1");
        const id="component-user-rule",other="component-imported-rule";
        assert.equal((await runtime.unsafe(create,[id,"Component rule","Initial component content","general","general","mandatory","implement",ts,ts])).count,1);
        assert.equal((await runtime.unsafe(imported,[other,"Imported component rule","Imported content","general","general","mandatory","implement",true,ts,ts])).count,1);
        assert.equal((await runtime.unsafe(importUpdate,["Updated import content","general","general","mandatory","implement",true,ts,other])).count,1);
        assert.equal((await runtime.unsafe(toggle,[ts,id])).count,1);
        assert.equal((await runtime`SELECT enabled FROM rules WHERE id=${id}`)[0]!.enabled,false);
        assert.equal((await runtime.unsafe(edit,["Edited component rule","Edited content","general","general","mandatory","implement",true,ts,id])).count,1);
        const row=(await runtime`SELECT title,content,enabled FROM rules WHERE id=${id}`)[0]!;
        assert.deepEqual({...row},{title:"Edited component rule",content:"Edited content",enabled:true});
        assert.equal((await runtime`SELECT content FROM rules WHERE id=${other}`)[0]!.content,"Updated import content");
        assert.equal((await runtime.unsafe(remove,[other])).count,1);
        assert.equal((await runtime.unsafe(remove,[other])).count,0);
        assert.equal((await runtime`SELECT id FROM rules WHERE id=${id}`).length,1);
        await assert.rejects(runtime`UPDATE rules SET id=id WHERE id=${id}`,/permission denied/);
        await assert.rejects(runtime`UPDATE rules SET readonly=TRUE WHERE id=${id}`,/permission denied/);
        await assert.rejects(runtime`TRUNCATE rules`,/permission denied/);
      });
      await t.test("normal claim exclusion locks recovery deliveries with only timestamp UPDATE privilege",async()=>{
        const statements=[
          [productionSql("src/execution/claim-mutation-authority.ts","SELECT dispatch_id, state, claim_id, attempt_id, revision_id"),["component-run","COMP-1"]],
          [productionSql("src/execution/pre-dispatch-withdrawal-authority.ts","SELECT delivery.dispatch_id, delivery.attempt_id, delivery.claim_id"),["component-run","COMP-1"]],
          [productionSql("src/execution/runtime-completion.ts","SELECT dispatch_id FROM recovery_dispatch_deliveries"),[attemptId,Number(childClaim[0]!.id)]],
        ] as const;
        for(const [statement,args] of statements) {
          assert.match(statement,/FOR UPDATE/);
          assert.equal((await runtime.unsafe(statement,[...args])).length,0);
        }
        const columns=await runtime`SELECT column_name FROM information_schema.column_privileges
          WHERE table_schema='public' AND table_name='recovery_dispatch_deliveries'
            AND grantee=current_user AND privilege_type='UPDATE' ORDER BY column_name`;
        assert.deepEqual(columns.map(row=>row.column_name),["updated_at"]);
        for(const statement of [
          "UPDATE recovery_dispatch_deliveries SET state=state",
          "UPDATE recovery_dispatch_deliveries SET dispatch_id=dispatch_id",
          "INSERT INTO recovery_dispatch_deliveries(dispatch_id) VALUES ('component-denied')",
          "DELETE FROM recovery_dispatch_deliveries",
          "TRUNCATE recovery_dispatch_deliveries",
        ]) await assert.rejects(runtime.unsafe(statement),{code:"42501"});
      });
      await t.test("populated recovery-delivery row locks contend while only updated_at is mutable",async()=>{
        // Owner-seeded SQL component only. These schema-valid FK rows are NOT
        // findings/recovery API authorization, admitted workflow or dispatch.
        const run="component-run",story="COMP-1",claimId=Number(childClaim[0]!.id);
        const findingHash="7".repeat(64),caseId="RCV_"+"8".repeat(64),revisionId="RREV_"+"9".repeat(64),dispatchId="RDISP_"+"a".repeat(64);
        const packet="3".repeat(64),slice="6".repeat(64),sourceSha="4".repeat(40),sourceTree="5".repeat(40);
        const now=new Date().toISOString(),expires=new Date(Date.now()+60_000).toISOString();
        const findingId="FSET_"+"b".repeat(64);
        const findingPayload={schema:"setfarm.finding-set.v1",findingSetHash:findingHash,findingSetId:findingId,runId:run,storyId:story,packetHash:packet,sliceHash:slice,sourceRevision:{sha:sourceSha,treeHash:sourceTree}};
        await owner.begin(async tx=>{
          await tx.unsafe(`SET LOCAL ROLE ${quote(installation.ownerRole)}`);
          await tx.unsafe(`INSERT INTO finding_sets
            (finding_set_hash,finding_set_id,run_id,story_id,packet_hash,slice_hash,source_sha,source_tree_hash,finding_ids,payload)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'[]'::jsonb,$9::jsonb)`,[findingHash,findingId,run,story,packet,slice,sourceSha,sourceTree,findingPayload]);
          await tx.unsafe(`INSERT INTO recovery_cases
            (recovery_case_id,dedupe_key,run_id,story_id,finding_set_hash,finding_ids,packet_hash,slice_hash,source_sha,source_tree_hash,
             owner,expected_delta,allowed_paths,evidence_plan,prior_attempt_refs,max_implement,max_supervisor_repair,max_evidence_only,used_evidence_only,status,decision_refs)
            VALUES ($1,$2,$3,$4,$5,'[]'::jsonb,$6,$7,$8,$9,'infrastructure','{"kind":"evidence_refresh"}'::jsonb,
              '[]'::jsonb,'[]'::jsonb,'[]'::jsonb,0,0,1,1,'evidencing','[]'::jsonb)`,[caseId,"c".repeat(64),run,story,findingHash,packet,slice,sourceSha,sourceTree]);
          await tx.unsafe(`INSERT INTO recovery_case_revisions
            (revision_id,recovery_case_id,revision_number,revision_identity_key,run_id,story_id,finding_set_hash,finding_ids,
             packet_hash,contract_slice_hash,source_sha,source_tree_hash,owner,expected_delta,allowed_paths,evidence_plan)
            VALUES ($1,$2,1,$3,$4,$5,$6,'[]'::jsonb,$7,$8,$9,$10,'infrastructure','{"kind":"evidence_refresh"}'::jsonb,'[]'::jsonb,'[]'::jsonb)`,
            [revisionId,caseId,"d".repeat(64),run,story,findingHash,packet,slice,sourceSha,sourceTree]);
          await tx.unsafe(`UPDATE recovery_cases SET current_revision_id=$2 WHERE recovery_case_id=$1`,[caseId,revisionId]);
          await tx.unsafe(`INSERT INTO recovery_revision_dispatches
            (dispatch_id,recovery_case_id,revision_id,dispatch_class,dispatch_dedupe_key,source_sha,source_tree_hash,
             packet_hash,contract_slice_hash,finding_set_hash,finding_ids,evidence_plan,authorized_at)
            VALUES ($1,$2,$3,'evidence_only',$4,$5,$6,$7,$8,$9,'[]'::jsonb,'[]'::jsonb,$10)`,
            [dispatchId,caseId,revisionId,"e".repeat(64),sourceSha,sourceTree,packet,slice,findingHash,now]);
          await tx.unsafe(`INSERT INTO recovery_dispatch_deliveries
            (dispatch_id,recovery_case_id,revision_id,run_id,story_id,state,owner_instance_id,lease_token,lease_expires_at,
             attempt_id,claim_id,attempt_count,terminal_result,authorized_at,created_at,updated_at)
            VALUES ($1,$2,$3,$4,$5,'attempt_reserved','component-lock-owner',$6,$7,$8,$9,1,'{}'::jsonb,$10,$10,$10)`,
            [dispatchId,caseId,revisionId,run,story,"f".repeat(64),expires,attemptId,claimId,now]);
        });
        const mutation=productionSql("src/execution/claim-mutation-authority.ts","SELECT dispatch_id, state, claim_id, attempt_id, revision_id");
        const withdrawal=productionSql("src/execution/pre-dispatch-withdrawal-authority.ts","SELECT delivery.dispatch_id, delivery.attempt_id, delivery.claim_id");
        const completion=productionSql("src/execution/runtime-completion.ts","SELECT dispatch_id FROM recovery_dispatch_deliveries");
        const recoveryCompletion=productionSql("src/execution/runtime-completion.ts","SELECT dispatch_id, lease_expires_at");
        const queries=[
          [mutation,[run,story]],[withdrawal,[run,story]],[completion,[attemptId,claimId]],
          [recoveryCompletion,[dispatchId,revisionId,run,story,attemptId,claimId]],
        ] as const;
        for(const [statement,args] of queries){
          assert.match(statement,/FOR UPDATE/);
          const rows=await runtime.unsafe(statement,[...args]);assert.equal(rows.length,1);assert.equal(rows[0]!.dispatch_id,dispatchId);
        }
        const columns=await runtime`SELECT attname,
          pg_catalog.has_column_privilege(current_user,attrelid,attnum,'UPDATE') AS can_update
          FROM pg_catalog.pg_attribute WHERE attrelid='public.recovery_dispatch_deliveries'::regclass
            AND attnum>0 AND NOT attisdropped ORDER BY attname`;
        assert.deepEqual(columns.filter(row=>row.can_update).map(row=>row.attname),["updated_at"]);
        const policy=(await runtime`SELECT
          has_table_privilege(current_user,'public.recovery_dispatch_deliveries','UPDATE') AS table_update,
          has_table_privilege(current_user,'public.recovery_dispatch_deliveries','INSERT') AS can_insert,
          has_table_privilege(current_user,'public.recovery_dispatch_deliveries','DELETE') AS can_delete,
          has_table_privilege(current_user,'public.recovery_dispatch_deliveries','TRUNCATE') AS can_truncate`)[0]!;
        assert.deepEqual({...policy},{table_update:false,can_insert:false,can_delete:false,can_truncate:false});
        // This is a real writable timestamp grant, not the immutable V25 case.
        const shifted=await runtime.unsafe("UPDATE recovery_dispatch_deliveries SET updated_at=updated_at+INTERVAL '1 second' WHERE dispatch_id=$1 RETURNING updated_at",[dispatchId]);
        assert.equal(shifted.length,1);assert.equal(new Date(shifted[0]!.updated_at).getTime(),new Date(now).getTime()+1000);
        const before=(await runtime.unsafe("SELECT * FROM recovery_dispatch_deliveries WHERE dispatch_id=$1",[dispatchId]))[0]!;
        for(const statement of [
          "UPDATE recovery_dispatch_deliveries SET state=state WHERE dispatch_id=$1",
          "UPDATE recovery_dispatch_deliveries SET dispatch_id=dispatch_id WHERE dispatch_id=$1",
          "UPDATE recovery_dispatch_deliveries SET lease_token=lease_token WHERE dispatch_id=$1",
          "UPDATE recovery_dispatch_deliveries SET claim_id=claim_id WHERE dispatch_id=$1",
          "INSERT INTO recovery_dispatch_deliveries(dispatch_id) VALUES ($1)",
          "DELETE FROM recovery_dispatch_deliveries WHERE dispatch_id=$1",
        ]) await assert.rejects(runtime.unsafe(statement,[dispatchId]),{code:"42501"});
        await assert.rejects(runtime.unsafe("TRUNCATE recovery_dispatch_deliveries"),{code:"42501"});
        assert.deepEqual((await runtime.unsafe("SELECT * FROM recovery_dispatch_deliveries WHERE dispatch_id=$1",[dispatchId]))[0],before);
        // Prove a genuine nonempty source-query row lock. A second restricted
        // connection must time out on the same row, then succeed after release.
        const contender=postgres(credential.runtimeUrl,{max:1,connect_timeout:3,onnotice(){}});
        try{
          await runtime.begin(async tx=>{
            assert.equal((await tx.unsafe(mutation,[run,story])).length,1);
            await assert.rejects(contender.begin(async other=>{
              await other.unsafe("SELECT set_config('lock_timeout','100ms',true),set_config('statement_timeout','1000ms',true)");
              await other.unsafe(completion,[attemptId,claimId]);
            }),{code:"55P03"});
          });
          assert.equal((await contender.unsafe(completion,[attemptId,claimId])).length,1);
        }finally{await contender.end({timeout:3});}
        // Re-seed this same owned component row as an unleased authorization:
        // no real dispatch transition or recovery authority is claimed.
        await owner.begin(async tx=>{
          await tx.unsafe(`SET LOCAL ROLE ${quote(installation.ownerRole)}`);
          await tx.unsafe(`UPDATE recovery_dispatch_deliveries SET state='authorized',
            owner_instance_id=NULL,lease_token=NULL,lease_expires_at=NULL,
            attempt_id=NULL,claim_id=NULL,attempt_count=0 WHERE dispatch_id=$1`,[dispatchId]);
        });
        const authority=await import("../../src/execution/claim-mutation-authority.js");
        const businessSnapshot=async()=>runtime.unsafe(`SELECT
          (SELECT to_jsonb(r) FROM runs r WHERE id=$1) AS run,
          (SELECT jsonb_agg(to_jsonb(c) ORDER BY id) FROM claim_log c WHERE run_id=$1) AS claims,
          (SELECT jsonb_agg(to_jsonb(a) ORDER BY attempt_id) FROM execution_attempts a WHERE run_id=$1) AS attempts,
          (SELECT jsonb_agg(to_jsonb(s) ORDER BY session_id) FROM runtime_sessions s WHERE run_id=$1) AS runtimes,
          (SELECT to_jsonb(d) FROM recovery_dispatch_deliveries d WHERE dispatch_id=$2) AS delivery`,[run,dispatchId]);
        const businessBefore=await businessSnapshot();
        await assert.rejects(runtime.begin(tx=>authority.acquireClaimMutationAuthorityInTransaction(tx,{
          claimId,runId:run,workflowStepId:"test",storyId:story,claimAgentId:"component-evidence",
        },"pre_dispatch_withdrawal")),(error:unknown)=>{
          assert.ok(error instanceof authority.ClaimMutationAuthorityError);
          assert.equal(error.ownerType,"recovery_dispatch");assert.equal(error.ownerId,dispatchId);
          assert.equal(error.ownerState,"authorized");return true;
        });
        assert.deepEqual(await businessSnapshot(),businessBefore,"actual owner-exclusion barrier must not mutate business state");
        await grants.verifyFreshInstallationRuntimeBusinessGrantsV1(runtime,installation.runtimeRole);
      });
      await runtime`UPDATE claim_log SET outcome='done' WHERE run_id='component-run'`;
      await runtime`UPDATE runs SET status='completed' WHERE id='component-run'`;
      assert.equal((await runtime`SELECT count(*)::integer AS count FROM prd_templates`)[0]?.count,9);
      await runtime`INSERT INTO tasks(id,title) VALUES ('component-task','test')`;
      await runtime`UPDATE tasks SET status='completed' WHERE id='component-task'`;
      await runtime`DELETE FROM tasks WHERE id='component-task'`;
      await runtime`UPDATE internal_production_owner_admission_head_v1 SET head_version=head_version WHERE singleton=TRUE`;
      await assert.rejects(runtime`UPDATE internal_production_owner_admission_head_v1 SET head_payload=jsonb_set(head_payload,'{migrationApplication,evidenceHash}',to_jsonb('wrong'::text)) WHERE singleton=TRUE`,/FRESH_INSTALLATION_HEAD_PROVENANCE_IMMUTABLE/);
      for(const sql of [
        "UPDATE internal_production_owner_admission_head_v1 SET migration_application_evidence_hash=repeat('a',64)",
        "DELETE FROM internal_production_owner_admission_head_v1",
        "TRUNCATE internal_production_owner_admission_head_v1",
        "ALTER TABLE internal_production_owner_admission_head_v1 DISABLE TRIGGER trg_setfarm_fresh_owner_head_provenance_v1",
        "UPDATE prd_templates SET name='changed'",
        "INSERT INTO internal_production_owner_producer_manifest_set_activations_v1(activation_ref) VALUES ('invalid')",
      ]) await assert.rejects(runtime.unsafe(sql),/permission denied|must be owner/);
      await runtime`INSERT INTO agent_feed(agent_id,agent_name,message,msg_hash) VALUES ('component','test','test','component-feed')`;
      await runtime`DELETE FROM agent_feed WHERE msg_hash='component-feed'`;
    } finally {await runtime.end({timeout:3});}
  } finally {await owner.end({timeout:3});}
});
