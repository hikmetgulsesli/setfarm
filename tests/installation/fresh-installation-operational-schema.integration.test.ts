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
