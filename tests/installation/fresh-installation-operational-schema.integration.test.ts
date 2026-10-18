import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import path from "node:path";
import postgres from "postgres";
import { createFreshInstallationTestFixtureV1 as create, freshTestAdminUrl } from "./fresh-installation-test-support.js";

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
