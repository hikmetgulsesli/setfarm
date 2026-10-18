import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { test } from "node:test";
import postgres from "postgres";
import { createFreshInstallationTestFixtureV1 as create, freshTestAdminUrl } from "./fresh-installation-test-support.js";
import { freshSourceCheckoutFixture } from "./fresh-source-checkout-fixture.js";

const PACKET = "c".repeat(64), REPORT = "d".repeat(64), BASE = "e".repeat(40);
const TREE = "f".repeat(40), SLICE = "1".repeat(64), FENCE = "3".repeat(64);
const quote = (value: string) => `"${value.replaceAll('"', '""')}"`;
async function code(operation: () => Promise<unknown>, expected: string): Promise<void> {
  await assert.rejects(operation, (error: unknown) => (error as { code?: string })?.code === expected);
}

test("fresh runtime V25 lock privileges preserve exact immutable guards and permit published bindings", { timeout: 120_000 }, async t => {
  const installation = await create(t); await installation.initialize();
  const fixture = await freshSourceCheckoutFixture();
  const load = (name: string) => import(pathToFileURL(path.join(fixture.root, "src", name)).href);
  const protection = await load("installation/fresh-installation-provenance-v1.ts");
  const grants = await load("installation/fresh-installation-runtime-grants-v1.ts");
  const indexModule = await load("product-compiler/artifact-index.ts");
  const storeModule = await load("product-compiler/artifact-store.ts");
  const publisher = await load("product-compiler/indexed-artifact-publisher.ts");
  const capacity = await load("product-compiler/artifact-capacity.ts");
  const authorityModule = await load("execution/v3-preparation-claim-authority-v2.ts");
  const repository = await load("execution/v3-preparation-authority-v2-repository.ts");
  const ledger = await load("db/preparation-authority-v2-migration.ts");
  const endpoint = new URL(freshTestAdminUrl); endpoint.pathname = "/" + installation.databaseName;
  const owner = postgres(endpoint.href, { max: 1, connect_timeout: 3, onnotice() {} });
  try {
    await owner.begin(async tx => {
      await tx.unsafe("SELECT set_config('lock_timeout','1000ms',true),set_config('statement_timeout','15000ms',true)");
      await tx.unsafe(`SET LOCAL ROLE ${quote(installation.ownerRole)}`);
      // The adapter remains on this actual owner transaction: begin maps only to
      // its savepoint, not to a new client/autocommit/getSql connection.
      const sameConnection = { unsafe: tx.unsafe.bind(tx),
        begin: (work: (nested: postgres.TransactionSql) => Promise<unknown>) => tx.savepoint(work) };
      const index = indexModule.createArtifactIndex(sameConnection);
      const store = new storeModule.ContentAddressedArtifactStore(
        path.join(installation.directory, "runtime/product-compiler/artifacts/sha256"),
        { limits: capacity.DEFAULT_ARTIFACT_CAPACITY_LIMITS },
      );
      const bootstrapped = await publisher.bootstrapArtifactIndex({ index, store,
        quotaBytes: 536870912, maxPayloadBytes: 4194304 });
      assert.equal(bootstrapped.artifacts.length, 0);
      assert.equal(bootstrapped.capacity.state, "ready");
      assert.equal(bootstrapped.capacity.totalBytes, 0);
      assert.equal(bootstrapped.capacity.reservedBytes, 0);
      assert.deepEqual(store.limits, { maxPayloadBytes: 4194304,
        rootQuotaBytes: 536870912, minFreeBytes: 1073741824 });
      await protection.installFreshInstallationProvenanceProtectionV1(tx, installation.runtimeRole);
      await grants.installFreshInstallationRuntimeBusinessGrantsV1(tx, installation.runtimeRole);
    });
  } finally { await owner.end({ timeout: 3 }); }

  const credential = JSON.parse(readFileSync(path.join(installation.directory, "runtime-credentials.json"), "utf8"));
  const runtime = postgres(credential.runtimeUrl, { max: 1, connect_timeout: 3, onnotice() {} });
  try {
    await runtime.unsafe("SELECT set_config('lock_timeout','1000ms',false),set_config('statement_timeout','15000ms',false)");
    const principal = await runtime.unsafe("SELECT current_user AS role,current_database() AS database");
    assert.equal(principal[0].role, installation.runtimeRole);
    assert.equal(principal[0].database, installation.databaseName);
    await grants.verifyFreshInstallationRuntimeBusinessGrantsV1(runtime, installation.runtimeRole);
    const bypass = await runtime.unsafe("SELECT has_parameter_privilege(current_user,'session_replication_role','SET') AS allowed");
    assert.equal(bypass[0].allowed, false);
    await code(() => runtime.unsafe("UPDATE artifact_capacity SET quota_bytes=quota_bytes WHERE capacity_key='semantic-artifacts'"), "42501");
    // Inert data-only seed from maintained preparation-authority migration test.
    // No helper fabricates a V3 capability or disables any production trigger.
    const runId = "component-preparation-v25", storyId = "US-001";
    await runtime.unsafe(`INSERT INTO runs (id,workflow_id,task,status,protocol,protocol_version,
      compiler_release_sha,activation_preflight_hash)
      VALUES ($1,'feature-dev','V25 SQL component','running','shadow',1,$2,$3)`,
      [runId,fixture.sha,"2".repeat(64)]);
    // Match source-owned two-stage packet pointer publication: the ordinary run
    // INSERT contract does not authorize an initially supplied packet_hash.
    await runtime.unsafe("UPDATE runs SET packet_hash=$2,updated_at=NOW() WHERE id=$1",[runId,PACKET]);
    await runtime.unsafe(`INSERT INTO semantic_artifacts (artifact_hash,artifact_type,byte_length,producer_metadata)
      VALUES ($1,'setfarm.product-build-packet.v3',1,$2::text::jsonb)`,
      [PACKET,JSON.stringify({ pass:"V25-SQL-component",codeSha:fixture.sha,toolVersions:{setfarm:"component"} })]);
    await runtime.unsafe(`INSERT INTO product_packets (run_id,packet_hash,compiler_metadata)
      VALUES ($1,$2,$3::text::jsonb)`,[runId,PACKET,JSON.stringify({version:"3.0.0",codeSha:fixture.sha})]);
    const claimRows = await runtime.unsafe(`INSERT INTO claim_log (run_id,step_id,story_id,agent_id)
      VALUES ($1,'implement',$2,'feature-dev_developer') RETURNING id::text AS id`,[runId,storyId]);
    const claimId = Number(claimRows[0].id), attemptId = "ATT_v25-component-00000001";
    await runtime.unsafe(`INSERT INTO execution_attempts (
      attempt_id,claim_id,run_id,step_id,story_id,generation,fence_token,attempt_class,
      packet_hash,compilation_report_hash,slice_hash,source_before_sha,source_before_tree_hash,
      finding_set_hash,dedupe_key,role,agent_id,branch,worktree,lease_acquired_at,lease_expires_at,
      heartbeat_at,disposition,evidence_refs)
      VALUES ($1,$2,$3,'implement',$4,1,$5,'product_implementation',$6,$7,$8,$9,$10,$11,
      'v25-component-dedupe','developer','feature-dev_developer','setfarm/component','/tmp/setfarm-component',
      NOW(),NOW()+INTERVAL '5 minutes',NOW(),'claimed','[]')`,
      [attemptId,claimId,runId,storyId,FENCE,PACKET,REPORT,SLICE,BASE,TREE,"4".repeat(64)]);
    const authority = authorityModule.createV3PreparationClaimAuthorityV2({ stateVersion:1,
      runId,stepId:"implement",storyId,packetHash:PACKET,compilationReportHash:REPORT,
      baseRevision:{sha:BASE,treeHash:TREE},projectedDependencyIds:[],dependencyAttempts:[] });
    await runtime.begin(async tx => {
      assert.equal(await repository.publishV3PreparationAuthorityV2InTransaction(tx, authority), "published");
      assert.equal(await repository.bindV3PreparationAuthorityClaimV2InTransaction(tx,
        {authorityHash:authority.authorityHash,claimId}), "published");
      assert.equal(await repository.bindV3PreparationAuthorityAttemptV2InTransaction(tx,
        {authorityHash:authority.authorityHash,claimId,attemptId,sliceHash:SLICE}), "published");
    });
    assert.deepEqual(await repository.readV3PreparationAuthorityV2(runtime,authority.authorityHash),authority);
    const before = await runtime.unsafe(`SELECT a.created_at,c.claimed_at
      FROM v3_preparation_authorities_v2 a JOIN v3_preparation_authority_claims_v2 c USING(authority_hash)
      WHERE a.authority_hash=$1`,[authority.authorityHash]);
    for (const [table,column,guard] of [
      ["v3_preparation_authorities_v2","created_at","trg_v3_preparation_authorities_v2_immutable"],
      ["v3_preparation_authority_claims_v2","claimed_at","trg_v3_preparation_authority_claims_v2_binding"],
    ]) {
      await code(() => runtime.unsafe(`UPDATE ${table} SET ${column}=${column} WHERE authority_hash=$1`,[authority.authorityHash]),"23514");
      await code(() => runtime.unsafe(`UPDATE ${table} SET ${column}=${column}+INTERVAL '1 second' WHERE authority_hash=$1`,[authority.authorityHash]),"23514");
      await code(() => runtime.unsafe(`DELETE FROM ${table} WHERE authority_hash=$1`,[authority.authorityHash]),"42501");
      await code(() => runtime.unsafe(`TRUNCATE TABLE ${table}`),"42501");
      await code(() => runtime.unsafe(`ALTER TABLE ${table} DISABLE TRIGGER ${guard}`),"42501");
    }
    await code(() => runtime.unsafe("SET session_replication_role='replica'"),"42501");
    await code(() => runtime.unsafe(`CREATE OR REPLACE FUNCTION public.setfarm_enforce_v3_preparation_authority_v2_immutable()
      RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RETURN NEW; END; $$`),"42501");
    await code(() => runtime.unsafe("UPDATE v3_preparation_authority_attempts_v2 SET slice_hash=slice_hash"),"42501");
    const after = await runtime.unsafe(`SELECT a.created_at,c.claimed_at
      FROM v3_preparation_authorities_v2 a JOIN v3_preparation_authority_claims_v2 c USING(authority_hash)
      WHERE a.authority_hash=$1`,[authority.authorityHash]);
    assert.deepEqual(after,before);
    await ledger.verifyPreparationAuthorityV2Ledger(runtime);
    await grants.verifyFreshInstallationRuntimeBusinessGrantsV1(runtime, installation.runtimeRole);
  } finally { await runtime.end({ timeout: 3 }); }
});
