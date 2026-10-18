// Real restricted-PG component only. The named hash inputs and owner-seeded
// FK run are test data, not a passing preflight, GO admission, ordinary run,
// compiled qualification or workflow readiness. No gate artifact is fabricated.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import postgres from "postgres";
import ts from "typescript";
import { createFreshInstallationTestFixtureV1 as create, freshTestAdminUrl } from "./fresh-installation-test-support.js";

function exactConsumptionSql(): string {
  const file=new URL("../../src/execution/run-persistence.ts",import.meta.url),source=readFileSync(file,"utf8");
  const tree=ts.createSourceFile(file.pathname,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);
  const matches:string[]=[];
  const visit=(node:ts.Node):void=>{
    if(ts.isCallExpression(node)&&ts.isPropertyAccessExpression(node.expression)
      &&node.expression.name.text==="unsafe"&&node.arguments[0]&&ts.isStringLiteralLike(node.arguments[0])
      &&node.arguments[0].text.includes("UPDATE v3_canary_admission_claims")) matches.push(node.arguments[0].text);
    ts.forEachChild(node,visit);
  };
  visit(tree);assert.equal(matches.length,1,"exact production canary consumption SQL must be unique");return matches[0]!;
}
const errorCode=(expected:string)=>(error:unknown):boolean=>!!error&&typeof error==="object"&&"code" in error&&error.code===expected;

test("fresh restricted role creates canonical canary records and consumes one slot without mutable admission rights",{timeout:120000},async t=>{
  const provenance=await import("../../src/installation/fresh-installation-provenance-v1.js");
  const grants=await import("../../src/installation/fresh-installation-runtime-grants-v1.js");
  const mc=await import("../../src/installation/fresh-installation-mission-control-schema-v1.js");
  const {createV3ReleaseAdmissionRepository}=await import("../../src/execution/v3-release-admission-repository.js");
  const {ContentAddressedEvalResultStore}=await import("../../src/evals/report.js");
  const installation=await create(t);await installation.initialize();
  const endpoint=new URL(freshTestAdminUrl);endpoint.pathname="/"+installation.databaseName;
  const owner=postgres(endpoint.href,{max:1,connect_timeout:3,onnotice(){}});
  const quote=(value:string)=>`"${value.replaceAll('"','""')}"`;
  let runtime:postgres.Sql|undefined;
  try{
    await owner.begin(async tx=>{
      await tx.unsafe(`SET LOCAL ROLE ${quote(installation.ownerRole)}`);
      await provenance.installFreshInstallationProvenanceProtectionV1(tx,installation.runtimeRole);
      await mc.installFreshInstallationMissionControlSchemaV1(tx,installation.runtimeRole);
      await grants.installFreshInstallationRuntimeBusinessGrantsV1(tx,installation.runtimeRole);
    });
    const credential=JSON.parse(readFileSync(path.join(installation.directory,"runtime-credentials.json"),"utf8"));
    const sql=runtime=postgres(credential.runtimeUrl,{max:1,connect_timeout:3,onnotice(){}});
    await sql`SELECT set_config('statement_timeout','15000ms',false),set_config('lock_timeout','1000ms',false)`;
    await grants.verifyFreshInstallationRuntimeBusinessGrantsV1(sql,installation.runtimeRole);
    const who=await sql`SELECT current_user AS role,current_database() AS database`;
    assert.equal(who[0]!.role,installation.runtimeRole);assert.equal(who[0]!.database,installation.databaseName);
    // Constructor is lexical only; createCanary never reads/writes this store.
    // No GO result/gate or preflight report is installed at this path.
    const store=new ContentAddressedEvalResultStore(path.join(installation.directory,"component-release-results-not-prepared"));
    const repository=createV3ReleaseAdmissionRepository(sql,store);
    const releaseSha="a".repeat(40),suiteHash="b".repeat(64),preflightHash="c".repeat(64);
    const taskHash="d".repeat(64),caseHash="e".repeat(64),token="component-"+randomUUID()+"-"+"x".repeat(48);
    const input={releaseSha,suiteHash,preflightHash,ttlMs:3600000,slots:[
      {caseHash,taskHash,repetition:1,slotToken:token+"-1"},
      {caseHash,taskHash,repetition:2,slotToken:token+"-2"}
    ]};
    const first=await repository.createCanary(input);
    assert.equal(first.admission.kind,"convergence_canary");assert.equal(first.contexts.length,2);
    assert.equal(first.admission.releaseSha,releaseSha);assert.equal(first.admission.preflightHash,preflightHash);
    assert.equal(first.admission.result.hash,null);assert.equal(first.admission.gate.hash,null);
    assert.deepEqual(await repository.createCanary(input),first,"exact creation replay must not create another admission or slot");
    const counts=await sql`SELECT (SELECT count(*)::integer FROM v3_release_admissions) AS admissions,(SELECT count(*)::integer FROM v3_canary_admission_claims) AS slots`;
    assert.deepEqual({...counts[0]!},{admissions:1,slots:2});
    const context=first.contexts[0]!;
    const selection=await repository.verifyCanarySelection({releaseSha,taskHash,context});
    assert.equal(selection.admissionHash,first.admission.admissionHash);assert.deepEqual(selection.canary,context);
    await assert.rejects(repository.verifyCanarySelection({releaseSha,taskHash,context:{...context,slotToken:context.slotToken+"-tampered"}}),errorCode("V3_CANARY_ADMISSION_INVALID"));
    await assert.rejects(repository.verifyCanarySelection({releaseSha,taskHash:"f".repeat(64),context}),errorCode("V3_CANARY_ADMISSION_INVALID"));

    // Seed only the owned component FK parent as the real owner. This is NOT
    // persistWorkflowRun, a source/owner-admitted V3 run, or normal qualification.
    // Its purpose is to execute the exact restricted slot UPDATE and deferred FK.
    const runId="component-canary-"+randomUUID();
    const seed=await owner.begin(async tx=>{
      await tx.unsafe(`SET LOCAL ROLE ${quote(installation.ownerRole)}`);
      const clock=await tx`SELECT clock_timestamp() AS now`;
      const now=clock[0]!.now as Date;
      const rows=await tx`INSERT INTO runs(id,workflow_id,task,status,context,protocol,protocol_version,compiler_release_sha,activation_preflight_hash,release_admission_hash,created_at,updated_at)
        VALUES (${runId},'release-admission-component','Component FK seed only','running','{}','v3',1,${releaseSha},${preflightHash},${first.admission.admissionHash},${now},${now}) RETURNING id,created_at`;
      assert.equal(rows.length,1);return rows[0]!;
    });
    const consume=exactConsumptionSql();
    const args=[runId,seed.created_at,context.slotHash,first.admission.admissionHash];
    const updated=await sql.begin(tx=>tx.unsafe(consume,args));
    assert.equal(updated.length,1);assert.equal(updated[0]!.slot_hash,context.slotHash);
    assert.equal((await sql.unsafe(consume,args)).length,0,"existing null-state CAS must reject a second consumption");
    const stored=await sql`SELECT slot_hash,admission_hash,run_id,consumed_at FROM v3_canary_admission_claims WHERE slot_hash=${context.slotHash}`;
    assert.equal(stored.length,1);assert.equal(stored[0]!.run_id,runId);
    assert.equal(stored[0]!.admission_hash,first.admission.admissionHash);
    assert.equal(new Date(stored[0]!.consumed_at).getTime(),new Date(seed.created_at).getTime());
    await assert.rejects(repository.verifyCanarySelection({releaseSha,taskHash,context}),errorCode("V3_CANARY_ADMISSION_SLOT_CONSUMED"));
    assert.equal((await repository.verifyCanarySelection({releaseSha,taskHash,context:first.contexts[1]!})).admissionHash,first.admission.admissionHash);

    // Only the two consume-once columns are UPDATE-capable. Identity columns
    // remain privilege-denied, and even an equal update of a consumed permitted
    // column is rejected by the unchanged published trigger.
    for(const column of ["slot_hash","admission_hash","admission_kind","case_hash","task_hash","repetition","selector_hash","run_id","consumed_at","created_at"]){
      const rows=await sql`SELECT pg_catalog.has_column_privilege(current_user,'public.v3_canary_admission_claims',${column},'UPDATE') AS permitted`;
      assert.equal(rows[0]!.permitted,column==="run_id"||column==="consumed_at",column);
    }
    await assert.rejects(sql`UPDATE v3_canary_admission_claims SET consumed_at=consumed_at WHERE slot_hash=${context.slotHash}`,errorCode("55000"));
    await assert.rejects(sql`UPDATE v3_canary_admission_claims SET task_hash=task_hash WHERE slot_hash=${context.slotHash}`,errorCode("42501"));
    for(const statement of [
      "UPDATE v3_release_admissions SET payload=payload WHERE FALSE",
      "DELETE FROM v3_release_admissions WHERE FALSE",
      "TRUNCATE v3_release_admissions",
      "DELETE FROM v3_canary_admission_claims WHERE FALSE",
      "TRUNCATE v3_canary_admission_claims",
      "ALTER TABLE v3_canary_admission_claims DISABLE TRIGGER trg_v3_canary_claim_consume_once",
      "ALTER TABLE v3_release_admissions DISABLE TRIGGER trg_v3_release_admissions_immutable"
    ])await assert.rejects(sql.unsafe(statement),errorCode("42501"));
    // A nominally well-formed extra slot still cannot escape the admission's
    // exact published payload binding. No extra permission or trigger bypass.
    assert.notEqual(context.slotHash,"0".repeat(64));
    await assert.rejects(sql`INSERT INTO v3_canary_admission_claims(slot_hash,admission_hash,admission_kind,case_hash,task_hash,repetition,selector_hash,created_at)
      VALUES (${"0".repeat(64)},${first.admission.admissionHash},'convergence_canary',${caseHash},${taskHash},1,${"0".repeat(64)},${seed.created_at})`,errorCode("23514"));
    assert.deepEqual((await sql`SELECT count(*)::integer AS count FROM v3_canary_admission_claims`)[0]!.count,2);
    await grants.verifyFreshInstallationRuntimeBusinessGrantsV1(sql,installation.runtimeRole);
    // No promoteReleaseGo/requireReleaseGo, preflight artifact, real run
    // producer/owner, scheduler, claim, process or service was qualified here.
  }finally{
    try{if(runtime)await runtime.end({timeout:3});}finally{await owner.end({timeout:3});}
  }
});
