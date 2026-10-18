import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { pathToFileURL } from "node:url";
import postgres from "postgres";
import ts from "typescript";
import { createFreshInstallationTestFixtureV1 as create, freshTestAdminUrl } from "./fresh-installation-test-support.js";
import { freshSourceCheckoutFixture } from "./fresh-source-checkout-fixture.js";

function productionSql(root: string, relative: string, marker: string): string {
  const file = path.join(root, relative), source = readFileSync(file, "utf8");
  const tree = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const matches: string[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)
      && node.expression.name.text === "unsafe" && node.arguments[0]
      && ts.isStringLiteralLike(node.arguments[0]) && node.arguments[0].text.includes(marker)) {
      matches.push(node.arguments[0].text);
    }
    ts.forEachChild(node, visit);
  };
  visit(tree);
  assert.equal(matches.length, 1, "unique actual SQL argument: " + marker);
  return matches[0]!;
}

// Extract whole declarations, retaining actual identity/hash/schema logic.
// Executing lockProjection supplies no terminal authority or reservation.
function productionProjections(root: string, dependencies: Record<string, unknown>) {
  const file = path.join(root, "src/db-pg.ts"), source = readFileSync(file, "utf8");
  const tree = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const categories = ["CLAIM", "EXECUTION_ATTEMPT", "RUNTIME_SESSION", "COMPLETION_OWNER", "MANDATORY_EFFECT", "TERMINATION"];
  const names = [...categories.filter(name => name !== "TERMINATION").map(name => name + "_TERMINAL_STATUSES_V1"),
    "CLAIM_OWNER_IMPLEMENTATION_IDS_V1", ...categories.map(name => name + "_TERMINAL_RESOLVER_CONFIG_V1")];
  const declarations = names.map(name => {
    const found = tree.statements.filter(statement => ts.isVariableStatement(statement)
      && statement.declarationList.declarations.some(declaration => ts.isIdentifier(declaration.name) && declaration.name.text === name));
    assert.equal(found.length, 1, "unique actual projection declaration: " + name);
    return found[0]!.getText(tree);
  });
  const sameJson = tree.statements.filter(statement => ts.isFunctionDeclaration(statement) && statement.name?.text === "sameJsonValueV1");
  assert.equal(sameJson.length, 1);
  const js = ts.transpileModule([...declarations, sameJson[0]!.getText(tree)].join("\n"), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
  }).outputText;
  return new Function(...Object.keys(dependencies), js + "\nreturn [" + categories.map(name => name + "_TERMINAL_RESOLVER_CONFIG_V1").join(",") + "];")(...Object.values(dependencies)) as Array<{
    category: string; lockProjection: (sql: postgres.TransactionSql, input: unknown) => Promise<{ status: string; identity: { ownerKey: string }; terminalOwnerHash: string }>;
  }>;
}

// Genuine schema-only restricted PG components; no admission, activation or
// terminal owner authority is fabricated. Root supplies the isolated endpoint.
test("fresh restricted runtime locks the actual empty recovery chain and settles no recovery owners", { timeout: 120_000 }, async t => {
  const installation = await create(t);
  await installation.initialize();
  const fixture = await freshSourceCheckoutFixture();
  const load = (relative: string) => import(pathToFileURL(path.join(fixture.root, relative)).href);
  const protection = await load("src/installation/fresh-installation-provenance-v1.ts");
  const business = await load("src/installation/fresh-installation-runtime-grants-v1.ts");
  const recovery = await load("src/recovery/v3-terminal-recovery-chain.ts");
  const endpoint = new URL(freshTestAdminUrl); endpoint.pathname = "/" + installation.databaseName;
  const control = postgres(endpoint.href, { max: 1, connect_timeout: 3, onnotice() {} });
  let runtime: ReturnType<typeof postgres> | undefined;
  try {
    const install = async (tx: postgres.TransactionSql) => {
      await tx.unsafe(`SET LOCAL ROLE "${installation.ownerRole}"`);
      await protection.installFreshInstallationProvenanceProtectionV1(tx, installation.runtimeRole);
      await business.installFreshInstallationRuntimeBusinessGrantsV1(tx, installation.runtimeRole);
    };
    const baseline = async () => (await control`SELECT t.oid::text,t.tgfoid::text,t.tgenabled,pg_get_triggerdef(t.oid) AS definition
      FROM pg_trigger t WHERE t.tgrelid='public.recovery_cases'::regclass AND NOT t.tgisinternal
      AND t.tgname='trg_recovery_cases_github_review_resolution_set_once'`)[0]!;
    const originalBaseline = await baseline();
    await t.test("owner installation rolls back guard and grants atomically and refuses collisions", async () => {
      await assert.rejects(control.begin(async tx => { await install(tx); throw Error("component rollback"); }), /component rollback/);
      const absent = async () => {
        const row = (await control`SELECT to_regprocedure('public.setfarm_fresh_recovery_case_lock_guard_v1()') AS guard,
          to_regprocedure('public.setfarm_fresh_recovery_delivery_lock_guard_v1()') AS delivery,
          has_any_column_privilege(${installation.runtimeRole},'public.recovery_cases','UPDATE') AS can_update`)[0]!;
        assert.equal(row.guard, null); assert.equal(row.delivery, null); assert.equal(row.can_update, false);
        assert.deepEqual(await baseline(), originalBaseline);
      };
      await absent();
      for (const collision of [
        "CREATE FUNCTION public.setfarm_fresh_recovery_case_lock_guard_v1() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN RETURN NULL; END$$",
        "CREATE FUNCTION public.setfarm_fresh_recovery_case_lock_guard_v1(integer) RETURNS trigger LANGUAGE plpgsql AS $$BEGIN RETURN NULL; END$$",
        "CREATE TRIGGER trg_setfarm_fresh_recovery_case_lock_v1 BEFORE UPDATE ON public.recovery_cases FOR EACH STATEMENT EXECUTE FUNCTION public.setfarm_enforce_github_review_resolution_pointer_set_once()",
        "CREATE TRIGGER component_unexpected_case_trigger BEFORE UPDATE ON public.recovery_cases FOR EACH ROW EXECUTE FUNCTION public.setfarm_enforce_github_review_resolution_pointer_set_once()",
      ]) {
        await assert.rejects(control.begin(async tx => {
          await tx.unsafe(`SET LOCAL ROLE "${installation.ownerRole}"`);
          await tx.unsafe(collision); await install(tx);
        }), /FRESH_INSTALLATION_RUNTIME_GRANTS_REFUSED/);
        await absent();
      }
    });
    await control.begin(install);
    const credential = JSON.parse(readFileSync(path.join(installation.directory, "runtime-credentials.json"), "utf8"));
    runtime = postgres(credential.runtimeUrl, { max: 1, connect_timeout: 3, onnotice() {} });
    const runId = "component-terminal-recovery-empty";
    // Default-protocol component row only. Calling the actual V3 helper here
    // proves its PG lock rights; it does not fabricate public V3 admission.
    await runtime`INSERT INTO runs(id,workflow_id,task) VALUES(${runId},'component','recovery lock component')`;
    await runtime.begin(async tx => {
      await tx.unsafe("SELECT id FROM runs WHERE id=$1 FOR UPDATE",[runId]);
      const snapshot = await recovery.lockV3TerminalRecoveryChainInTransaction(tx, runId);
      assert.equal(Object.isFrozen(snapshot), true);
      assert.equal(snapshot.deliveries.length, 0);
      assert.equal(snapshot.cases.length, 0);
      for (const status of ["failed", "cancelled", "completed"] as const) {
        const result = await recovery.settleV3TerminalRecoveryChainInTransaction(tx, {
          runId, status, diagnostic: "component only", transitionTime: new Date(), snapshot,
        });
        assert.equal(Object.isFrozen(result), true);
        assert.deepEqual(result, { closedDeliveries: 0, closedRecoveryCases: 0, decisionRefs: [] });
      }
    });
    assert.equal((await runtime`SELECT status FROM runs WHERE id=${runId}`)[0]!.status, "running");
    const sql = runtime;
    const asOwner = (body: (tx: postgres.TransactionSql) => Promise<unknown>) => control.begin(async tx => {
      await tx.unsafe(`SET LOCAL ROLE "${installation.ownerRole}"`); return body(tx);
    });
    const caseId = "RCV_" + "8".repeat(64), revisionId = "RREV_" + "9".repeat(64), dispatchId = "RDISP_" + "a".repeat(64);
    const findingHash = "7".repeat(64), findingId = "FSET_" + "b".repeat(64), story = "COMP-1";
    const packet = "3".repeat(64), slice = "6".repeat(64), sourceSha = "4".repeat(40), sourceTree = "5".repeat(40);
    await asOwner(async tx => {
      await tx.unsafe(`INSERT INTO finding_sets
        (finding_set_hash,finding_set_id,run_id,story_id,packet_hash,slice_hash,source_sha,source_tree_hash,finding_ids,payload)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'[]'::jsonb,$9::jsonb)`, [findingHash,findingId,runId,story,packet,slice,sourceSha,sourceTree,
        { schema:"setfarm.finding-set.v1",findingSetHash:findingHash,findingSetId:findingId,runId,storyId:story,packetHash:packet,sliceHash:slice,sourceRevision:{sha:sourceSha,treeHash:sourceTree} }]);
      await tx.unsafe(`INSERT INTO recovery_cases
        (recovery_case_id,dedupe_key,run_id,story_id,finding_set_hash,finding_ids,packet_hash,slice_hash,source_sha,source_tree_hash,
         owner,expected_delta,allowed_paths,evidence_plan,prior_attempt_refs,max_implement,max_supervisor_repair,max_evidence_only,used_evidence_only,status,decision_refs)
        VALUES ($1,$2,$3,$4,$5,'[]'::jsonb,$6,$7,$8,$9,'infrastructure','{"kind":"evidence_refresh"}'::jsonb,
          '[]'::jsonb,'[]'::jsonb,'[]'::jsonb,0,0,1,1,'evidencing','[]'::jsonb)`, [caseId,"c".repeat(64),runId,story,findingHash,packet,slice,sourceSha,sourceTree]);
      await tx.unsafe(`INSERT INTO recovery_case_revisions
        (revision_id,recovery_case_id,revision_number,revision_identity_key,run_id,story_id,finding_set_hash,finding_ids,
         packet_hash,contract_slice_hash,source_sha,source_tree_hash,owner,expected_delta,allowed_paths,evidence_plan)
        VALUES ($1,$2,1,$3,$4,$5,$6,'[]'::jsonb,$7,$8,$9,$10,'infrastructure','{"kind":"evidence_refresh"}'::jsonb,'[]'::jsonb,'[]'::jsonb)`,
        [revisionId,caseId,"d".repeat(64),runId,story,findingHash,packet,slice,sourceSha,sourceTree]);
      await tx.unsafe("UPDATE recovery_cases SET current_revision_id=$2 WHERE recovery_case_id=$1", [caseId,revisionId]);
    });
    const snapshotRows = async () => JSON.stringify(await sql`SELECT
      (SELECT jsonb_agg(to_jsonb(c) ORDER BY recovery_case_id) FROM recovery_cases c) AS cases,
      (SELECT jsonb_agg(to_jsonb(d) ORDER BY dispatch_id) FROM recovery_dispatch_deliveries d) AS deliveries,
      (SELECT jsonb_agg(to_jsonb(r) ORDER BY id) FROM runs r) AS runs,
      (SELECT jsonb_agg(to_jsonb(o) ORDER BY reservation_ref) FROM internal_production_owner_reservations_v1 o) AS owners`);
    const locked = (body: (tx: postgres.TransactionSql, snapshot: Awaited<ReturnType<typeof recovery.lockV3TerminalRecoveryChainInTransaction>>) => Promise<unknown>) => sql.begin(async tx => {
      await tx.unsafe("SELECT id FROM runs WHERE id=$1 FOR UPDATE",[runId]);
      return body(tx, await recovery.lockV3TerminalRecoveryChainInTransaction(tx, runId));
    });
    const settle = (status: "failed" | "cancelled" | "completed") => locked((tx,snapshot) => recovery.settleV3TerminalRecoveryChainInTransaction(tx, {
      runId,status,diagnostic:"component only",transitionTime:new Date(),snapshot,
    }));
    await t.test("only guarded timestamp lock privilege exists and runtime mutation and tamper stay denied", async () => {
      for (const table of ["recovery_cases", "recovery_dispatch_deliveries"]) {
        const columns = await sql.unsafe(`SELECT attname FROM pg_attribute WHERE attrelid=$1::regclass AND attnum>0 AND NOT attisdropped
          AND has_column_privilege(current_user,attrelid,attnum,'UPDATE') ORDER BY attname`, ["public." + table]);
        assert.deepEqual(Array.from(columns, row => row.attname), ["updated_at"]);
        const rights = (await sql.unsafe("SELECT has_table_privilege(current_user,$1,'UPDATE') AS u,has_table_privilege(current_user,$1,'INSERT') AS i,has_table_privilege(current_user,$1,'DELETE') AS d,has_table_privilege(current_user,$1,'TRUNCATE') AS t", ["public." + table]))[0]!;
        assert.deepEqual([rights.u,rights.i,rights.d,rights.t], [false,false,false,false]);
        const before = await snapshotRows();
        for (const statement of [
          `UPDATE ${table} SET updated_at=updated_at WHERE FALSE`,
          `UPDATE ${table} SET updated_at=updated_at`,
          `UPDATE ${table} SET updated_at=updated_at+INTERVAL '1 second'`,
          `DELETE FROM ${table}`, `TRUNCATE ${table}`,
        ]) await assert.rejects(sql.unsafe(statement), { code:"42501" });
        assert.equal(await snapshotRows(), before);
      }
      for (const column of ["status","current_revision_id","state_version","terminal","decision_refs","owner","recovery_case_id","run_id","story_id","finding_set_hash","packet_hash","used_implement","used_supervisor_repair","used_evidence_only","github_review_resolution_evidence_hash"]) {
        await assert.rejects(sql.unsafe(`UPDATE recovery_cases SET ${column}=${column}`), { code:"42501" });
      }
      await assert.rejects(sql.unsafe("INSERT INTO recovery_cases(recovery_case_id) VALUES ($1)", [caseId]), { code:"42501" });
      for (const statement of [
        "ALTER TABLE public.recovery_cases DISABLE TRIGGER trg_setfarm_fresh_recovery_case_lock_v1",
        "DROP TRIGGER trg_setfarm_fresh_recovery_case_lock_v1 ON public.recovery_cases",
        "ALTER FUNCTION public.setfarm_fresh_recovery_case_lock_guard_v1() SECURITY DEFINER",
        "CREATE OR REPLACE FUNCTION public.setfarm_fresh_recovery_case_lock_guard_v1() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN RETURN NULL; END$$",
        "SELECT public.setfarm_fresh_recovery_case_lock_guard_v1()", "SET session_replication_role='replica'",
      ]) await assert.rejects(sql.unsafe(statement), { code:"42501" });
      assert.equal((await sql`SELECT has_function_privilege(current_user,'public.setfarm_fresh_recovery_case_lock_guard_v1()','EXECUTE') AS allowed`)[0]!.allowed, false);
      assert.deepEqual(await baseline(), originalBaseline);
    });
    await t.test("actual case-only helper retains row contention and refuses populated settlement atomically", async () => {
      const second = postgres(credential.runtimeUrl, { max:1,connect_timeout:3,onnotice(){} });
      try {
        await locked(async (_tx,snapshot) => {
          assert.equal(snapshot.cases.length,1); assert.equal(snapshot.deliveries.length,0);
          await assert.rejects(second.begin(async tx => {
            await tx.unsafe("SET LOCAL lock_timeout='100ms'");
            await tx.unsafe("SELECT recovery_case_id FROM recovery_cases WHERE recovery_case_id=$1 FOR UPDATE",[caseId]);
          }), { code:"55P03" });
        });
        await second.begin(async tx => { assert.equal((await tx.unsafe("SELECT recovery_case_id FROM recovery_cases WHERE recovery_case_id=$1 FOR UPDATE",[caseId])).length,1); });
      } finally { await second.end({timeout:3}); }
      for (const status of ["failed","cancelled"] as const) {
        const before=await snapshotRows(); await assert.rejects(settle(status),{code:"42501"}); assert.equal(await snapshotRows(),before);
      }
      await assert.rejects(settle("completed"),/RUN_TERMINAL_ACTIVE_RECOVERY:deliveries=0:cases=1/);
      // Owner updates still pass the fresh guard and the published constraints.
      await asOwner(tx => tx.unsafe("UPDATE recovery_cases SET updated_at=updated_at+INTERVAL '1 second' WHERE recovery_case_id=$1",[caseId]));
    });
    await asOwner(async tx => {
      await tx.unsafe(`INSERT INTO recovery_revision_dispatches
        (dispatch_id,recovery_case_id,revision_id,dispatch_class,dispatch_dedupe_key,source_sha,source_tree_hash,
         packet_hash,contract_slice_hash,finding_set_hash,finding_ids,evidence_plan,authorized_at)
        VALUES ($1,$2,$3,'evidence_only',$4,$5,$6,$7,$8,$9,'[]'::jsonb,'[]'::jsonb,NOW())`,
        [dispatchId,caseId,revisionId,"e".repeat(64),sourceSha,sourceTree,packet,slice,findingHash]);
      await tx.unsafe(`INSERT INTO recovery_dispatch_deliveries(dispatch_id,recovery_case_id,revision_id,run_id,story_id,state,authorized_at)
        VALUES ($1,$2,$3,$4,$5,'authorized',NOW())`,[dispatchId,caseId,revisionId,runId,story]);
    });
    await t.test("actual helper retains delivery plus case locks, referenced terminal cases and mismatch refusal", async () => {
      const second=postgres(credential.runtimeUrl,{max:1,connect_timeout:3,onnotice(){}});
      try {
        await locked(async (_tx,snapshot) => {
          assert.equal(snapshot.deliveries.length,1);assert.equal(snapshot.cases.length,1);
          for (const table of ["recovery_dispatch_deliveries","recovery_cases"]) {
            await assert.rejects(second.begin(async tx => { await tx.unsafe("SET LOCAL lock_timeout='100ms'");await tx.unsafe(`SELECT * FROM ${table} FOR UPDATE`); }),{code:"55P03"});
          }
        });
        await second.begin(async tx => { await tx.unsafe("SELECT * FROM recovery_dispatch_deliveries FOR UPDATE");await tx.unsafe("SELECT * FROM recovery_cases FOR UPDATE"); });
      } finally { await second.end({timeout:3}); }
      const before=await snapshotRows();
      for(const assignment of ["updated_at=updated_at","updated_at=updated_at+INTERVAL '1 second'", "state=state", "dispatch_id=dispatch_id", "recovery_case_id=recovery_case_id", "revision_id=revision_id", "owner_instance_id=owner_instance_id", "lease_token=lease_token", "claim_id=claim_id", "attempt_id=attempt_id", "terminal_result=terminal_result"]) {
        await assert.rejects(sql.unsafe(`UPDATE recovery_dispatch_deliveries SET ${assignment} WHERE dispatch_id=$1`,[dispatchId]),{code:"42501"});
        assert.equal(await snapshotRows(),before);
      }
      for (const status of ["failed","cancelled"] as const) { await assert.rejects(settle(status),{code:"42501"});assert.equal(await snapshotRows(),before); }
      await assert.rejects(settle("completed"),/RUN_TERMINAL_ACTIVE_RECOVERY:deliveries=1:cases=1/);
      await asOwner(tx => tx.unsafe(`UPDATE recovery_cases SET status='blocked',terminal='{"owner":"infrastructure","outcome":"blocked","reasonCode":"evidence_inconclusive","evidenceBundleHashes":[]}'::jsonb WHERE recovery_case_id=$1`,[caseId]));
      await locked(async (_tx,snapshot) => { assert.equal(snapshot.cases.length,1);assert.equal(snapshot.cases[0].status,"blocked"); });
      await assert.rejects(control.begin(async tx => {
        await tx.unsafe(`SET LOCAL ROLE "${installation.ownerRole}"`);
        await tx.unsafe("UPDATE recovery_dispatch_deliveries SET story_id='component-mismatched' WHERE dispatch_id=$1",[dispatchId]);
        await tx.unsafe("SELECT id FROM runs WHERE id=$1 FOR UPDATE",[runId]);
        await recovery.lockV3TerminalRecoveryChainInTransaction(tx,runId);
      }),/RUN_TERMINAL_RECOVERY_CHAIN_MISMATCH/);
      assert.equal((await sql`SELECT story_id FROM recovery_dispatch_deliveries WHERE dispatch_id=${dispatchId}`)[0]!.story_id,story);
    });
    await t.test("ALWAYS guard denies runtime updates even when administrator first selects replica", async () => {
      const before=await snapshotRows();
      for (const statement of ["UPDATE recovery_cases SET updated_at=updated_at WHERE FALSE","UPDATE recovery_cases SET updated_at=updated_at","UPDATE recovery_cases SET updated_at=updated_at+INTERVAL '1 second'"]) {
        await assert.rejects(control.begin(async tx => {
          await tx.unsafe("SET LOCAL session_replication_role='replica'");
          await tx.unsafe(`SET LOCAL ROLE "${installation.runtimeRole}"`);await tx.unsafe(statement);
        }),{code:"42501"});
      }
      assert.equal(await snapshotRows(),before);
    });
    await t.test("read-only verifier refuses every guard and baseline catalog drift without repair", async () => {
      for (const statement of [
        "ALTER TABLE public.recovery_cases DISABLE TRIGGER trg_setfarm_fresh_recovery_case_lock_v1",
        "ALTER TABLE public.recovery_cases ENABLE TRIGGER trg_setfarm_fresh_recovery_case_lock_v1",
        "ALTER TABLE public.recovery_cases ENABLE ALWAYS TRIGGER trg_recovery_cases_github_review_resolution_set_once",
        "CREATE OR REPLACE FUNCTION public.setfarm_fresh_recovery_case_lock_guard_v1() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $$BEGIN RETURN NULL; END$$",
        "ALTER FUNCTION public.setfarm_fresh_recovery_case_lock_guard_v1() SET search_path=public",
        "CREATE FUNCTION public.setfarm_fresh_recovery_case_lock_guard_v1(integer) RETURNS trigger LANGUAGE plpgsql AS $$BEGIN RETURN NULL; END$$",
        "CREATE OR REPLACE FUNCTION public.setfarm_enforce_github_review_resolution_pointer_set_once() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN RETURN NEW; END$$",
        `GRANT EXECUTE ON FUNCTION public.setfarm_fresh_recovery_case_lock_guard_v1() TO "${installation.runtimeRole}"`,
        "ALTER FUNCTION public.setfarm_fresh_recovery_case_lock_guard_v1() SECURITY DEFINER",
        "CREATE TRIGGER component_unknown BEFORE UPDATE ON public.recovery_cases FOR EACH ROW EXECUTE FUNCTION public.setfarm_enforce_github_review_resolution_pointer_set_once()",
        "DROP TRIGGER trg_setfarm_fresh_recovery_case_lock_v1 ON public.recovery_cases; CREATE TRIGGER trg_setfarm_fresh_recovery_case_lock_v1 BEFORE UPDATE OF updated_at ON public.recovery_cases FOR EACH STATEMENT EXECUTE FUNCTION public.setfarm_fresh_recovery_case_lock_guard_v1(); ALTER TABLE public.recovery_cases ENABLE ALWAYS TRIGGER trg_setfarm_fresh_recovery_case_lock_v1",
        "DROP TRIGGER trg_setfarm_fresh_recovery_case_lock_v1 ON public.recovery_cases; CREATE TRIGGER trg_setfarm_fresh_recovery_case_lock_v1 BEFORE UPDATE ON public.recovery_cases FOR EACH ROW WHEN (OLD.updated_at IS DISTINCT FROM NEW.updated_at) EXECUTE FUNCTION public.setfarm_fresh_recovery_case_lock_guard_v1(); ALTER TABLE public.recovery_cases ENABLE ALWAYS TRIGGER trg_setfarm_fresh_recovery_case_lock_v1",
        "DROP TRIGGER trg_setfarm_fresh_recovery_case_lock_v1 ON public.recovery_cases; CREATE TRIGGER trg_setfarm_fresh_recovery_case_lock_v1 BEFORE UPDATE ON public.recovery_cases FOR EACH STATEMENT EXECUTE FUNCTION public.setfarm_fresh_recovery_case_lock_guard_v1('unexpected'); ALTER TABLE public.recovery_cases ENABLE ALWAYS TRIGGER trg_setfarm_fresh_recovery_case_lock_v1",
        "DROP TRIGGER trg_setfarm_fresh_recovery_case_lock_v1 ON public.recovery_cases; CREATE TRIGGER trg_setfarm_fresh_recovery_case_lock_v1 BEFORE UPDATE ON public.recovery_cases FOR EACH STATEMENT EXECUTE FUNCTION public.setfarm_enforce_github_review_resolution_pointer_set_once(); ALTER TABLE public.recovery_cases ENABLE ALWAYS TRIGGER trg_setfarm_fresh_recovery_case_lock_v1",
        "DROP TRIGGER trg_setfarm_fresh_recovery_case_lock_v1 ON public.recovery_cases; CREATE CONSTRAINT TRIGGER trg_setfarm_fresh_recovery_case_lock_v1 AFTER UPDATE ON public.recovery_cases DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.setfarm_fresh_recovery_case_lock_guard_v1(); ALTER TABLE public.recovery_cases ENABLE ALWAYS TRIGGER trg_setfarm_fresh_recovery_case_lock_v1",
        "DROP TRIGGER trg_recovery_cases_github_review_resolution_set_once ON public.recovery_cases; CREATE TRIGGER trg_recovery_cases_github_review_resolution_set_once BEFORE UPDATE OF updated_at ON public.recovery_cases FOR EACH ROW EXECUTE FUNCTION public.setfarm_enforce_github_review_resolution_pointer_set_once()",
        `GRANT UPDATE(status) ON public.recovery_cases TO "${installation.runtimeRole}"`,
      ]) {
        await assert.rejects(control.begin(async tx => {
          await tx.unsafe(`SET LOCAL ROLE "${installation.ownerRole}"`);
          await tx.unsafe(statement, [], {prepare:false});
          const before=await tx.unsafe("SELECT pg_get_triggerdef(oid) AS definition,tgenabled FROM pg_trigger WHERE tgrelid='public.recovery_cases'::regclass AND NOT tgisinternal ORDER BY tgname");
          await assert.rejects(business.verifyFreshInstallationRuntimeBusinessGrantsV1(tx,installation.runtimeRole),/FRESH_INSTALLATION_RUNTIME_GRANTS_REFUSED/);
          assert.deepEqual(await tx.unsafe("SELECT pg_get_triggerdef(oid) AS definition,tgenabled FROM pg_trigger WHERE tgrelid='public.recovery_cases'::regclass AND NOT tgisinternal ORDER BY tgname"),before);
          throw Error("drift rollback");
        }),/drift rollback/);
        await business.verifyFreshInstallationRuntimeBusinessGrantsV1(sql,installation.runtimeRole);
        assert.deepEqual(await baseline(),originalBaseline);
      }
      await assert.rejects(control.begin(async tx=>{
        await tx.unsafe(`ALTER FUNCTION public.setfarm_fresh_recovery_case_lock_guard_v1() OWNER TO "${installation.runtimeRole}"`);
        await tx.unsafe(`SET LOCAL ROLE "${installation.ownerRole}"`);
        await assert.rejects(business.verifyFreshInstallationRuntimeBusinessGrantsV1(tx,installation.runtimeRole),/FRESH_INSTALLATION_RUNTIME_GRANTS_REFUSED/);
        throw Error("owner drift rollback");
      }),/owner drift rollback/);
      await business.verifyFreshInstallationRuntimeBusinessGrantsV1(sql,installation.runtimeRole);
      const modes=await sql`SELECT tgname,tgenabled,tgtype::integer FROM pg_trigger WHERE tgrelid='public.recovery_cases'::regclass AND NOT tgisinternal ORDER BY tgname`;
      assert.deepEqual(Array.from(modes,row=>[row.tgname,row.tgenabled,row.tgtype]),[
        ["trg_recovery_cases_github_review_resolution_set_once","O",19],["trg_setfarm_fresh_recovery_case_lock_v1","A",18],
      ]);
    });
    await t.test("complete actual terminal lock SQL and six whole P3 projections execute as restricted PG components", async () => {
      const canonical = await load("src/product-compiler/canonical-json.ts");
      const identities = await load("src/internal-production/owner-admission-v1.ts");
      const schemas = await load("src/execution/schemas/runtime-completion-plan-v1.ts");
      const attemptId="ATT_component-terminal-projection-0001", sessionId="RTS_component-terminal-projection-0001";
      const requestId="RCR_component-terminal-projection-0001", emptyRequestId="RCR_component-terminal-projection-0002";
      const terminationId="RTR_component-terminal-projection-0001", effectKey="continuation/terminal_finalize/terminal_finalize";
      const now=new Date().toISOString(), outputHash="1".repeat(64);
      let claimId="", emptyClaimId="";
      await asOwner(async tx => {
        await tx.unsafe("INSERT INTO steps(id,run_id,step_id,agent_id,step_index,input_template,expects) VALUES('component-terminal-step',$1,'test','component',0,'component','component')",[runId]);
        claimId=String((await tx.unsafe("INSERT INTO claim_log(run_id,step_id,agent_id,outcome) VALUES($1,'test','component','failed') RETURNING id",[runId]))[0]!.id);
        emptyClaimId=String((await tx.unsafe("INSERT INTO claim_log(run_id,step_id,agent_id,outcome) VALUES($1,'test','component','failed') RETURNING id",[runId]))[0]!.id);
        await tx.unsafe(`INSERT INTO execution_attempts(attempt_id,claim_id,run_id,step_id,generation,fence_token,attempt_class,
          compilation_report_hash,source_before_sha,source_before_tree_hash,role,agent_id,lease_acquired_at,lease_expires_at,heartbeat_at,disposition)
          VALUES($1,$2,$3,'test',1,$4,'evidence_only',$5,$6,$7,'component','component',NOW(),NOW(),NOW(),'verified')`,
          [attemptId,Number(claimId),runId,"2".repeat(64),"3".repeat(64),sourceSha,sourceTree]);
        for (const [claim,session,attempt] of [[claimId,sessionId,attemptId],[emptyClaimId,"RTS_component-terminal-projection-0002",null]] as const) {
          await tx.unsafe(`INSERT INTO runtime_sessions(session_id,run_id,step_db_id,workflow_step_id,claim_id,attempt_id,
            claim_agent_id,runtime_agent_id,runtime_kind,owner_instance_id,state,heartbeat_at,drained_at,released_at)
            VALUES($1,$2,'component-terminal-step','test',$3,$4,'component','component','external_session','component','released',NOW(),NOW(),NOW())`,
            [session,runId,Number(claim),attempt]);
        }
        const plan={schema:"setfarm.runtime-completion-plan.v1",planVersion:1,requestId,claimId:Number(claimId),runId,
          stepDbId:"component-terminal-step",workflowStepId:"test",outputHash,kind:"terminal_transition",continuation:{type:"terminal_finalize"},
          effects:[{effectKey,ordinal:0,effectType:"terminal.finalize",mandatory:true,payload:{runStatus:"failed"}}],preparedAt:now};
        const planHash=canonical.hashCanonicalJson(plan);
        for (const [request,claim,session,prepared] of [
          [requestId,claimId,sessionId,true],[emptyRequestId,emptyClaimId,"RTS_component-terminal-projection-0002",false],
        ] as const) {
          await tx.unsafe(`INSERT INTO runtime_completion_requests(request_id,runtime_session_id,claim_id,run_id,step_db_id,workflow_step_id,
            claim_envelope,output,output_hash,requested_by,requested_at,state,rejected_at,completion_plan,completion_plan_hash,prepared_at)
            VALUES($1,$2,$3,$4,'component-terminal-step','test','{}'::jsonb,'component',$5,'component',NOW(),'rejected',NOW(),$6::jsonb,$7,$8)`,
            [request,session,Number(claim),runId,outputHash,prepared?JSON.stringify(plan):null,prepared?planHash:null,prepared?now:null]);
        }
        const effectInput={schema:"setfarm.runtime-completion-effect-input.v1",planHash,plan,effect:plan.effects[0]!.payload};
        await tx.unsafe(`INSERT INTO runtime_completion_effects(request_id,effect_key,ordinal,effect_type,input_hash,payload,mandatory,state,applied_at)
          VALUES($1,$2,0,'terminal.finalize',$3,$4::jsonb,TRUE,'applied',NOW())`,
          [requestId,effectKey,canonical.hashCanonicalJson(effectInput),JSON.stringify(effectInput)]);
        await tx.unsafe(`INSERT INTO run_termination_requests(request_id,run_id,target_status,state,requested_by,requested_at,drained_at,terminalized_at,diagnostic)
          VALUES($1,$2,'failed','terminalized','component',NOW(),NOW(),NOW(),'component')`,[terminationId,runId]);
      });
      const relative="src/execution/run-terminal-transition.ts";
      const exact=(marker:string)=>productionSql(fixture.root,relative,marker);
      // Frozen acquisition order from actual production SQL. The actual recovery
      // helper is called in its precise position. These components acquire locks
      // and read projections; they do not settle the populated recovery chain.
      const beforeRecovery=["SELECT id, status, protocol, context, packet_hash, accepted_candidate_hash, meta",
        "SELECT request_id,target_status,state FROM run_termination_requests", "SELECT session_id,state,claim_id FROM runtime_sessions",
        "SELECT attempt_id,claim_id::text,step_id,story_id,generation,fence_token,"];
      const afterRecovery=["SELECT id::text,step_id,story_id,agent_id,outcome FROM claim_log",
        "WHERE run_id = $1 ORDER BY request_id FOR UPDATE", "WHERE request.run_id = $1 AND effect.mandatory",
        "WHERE run_id=$1 ORDER BY request_id FOR UPDATE", "WHERE request.run_id=$1 AND effect.mandatory"];
      await sql.begin(async tx => {
        for (const marker of beforeRecovery) await tx.unsafe(exact(marker),[runId]);
        await recovery.lockV3TerminalRecoveryChainInTransaction(tx,runId);
        for (const marker of afterRecovery) {
          const rows=await tx.unsafe(exact(marker),[runId]);
          assert.ok(rows.length>0,"nonempty actual terminal inventory: "+marker);
        }
        const ownerLookup=exact("SELECT producer_implementation_id,category,owner_key,owner_key_hash,");
        const ownerHashes=[requestId,emptyRequestId].map(ownerKey=>canonical.hashCanonicalJson({
          schema:"setfarm.internal-production-owner-key.v1",ownerKeyDerivationId:"completion-request-id-v1",ownerKey,
        }));
        assert.equal((await tx.unsafe(ownerLookup,[[requestId,emptyRequestId],ownerHashes])).length,0,"schema component grants no reservation authority");
      });
      const normalization=exact("SELECT request.request_id,request.claim_id::text,claim.outcome");
      assert.equal((await sql.unsafe(normalization,[runId])).length,0);
      await assert.rejects(control.begin(async tx => {
        await tx.unsafe(`SET LOCAL ROLE "${installation.ownerRole}"`);
        await tx.unsafe("UPDATE runtime_completion_requests SET state='processing',processing_at=NOW(),rejected_at=NULL,apply_phase='executing' WHERE request_id=$1",[requestId]);
        await tx.unsafe(`SET LOCAL ROLE "${installation.runtimeRole}"`);
        const rows=await tx.unsafe(normalization,[runId]);assert.equal(rows.length,1);assert.equal(rows[0]!.request_id,requestId);
        throw Error("normalization component rollback");
      }),/normalization component rollback/);
      const configurations=productionProjections(fixture.root,{
        createInternalProductionClaimCanonicalOwnerIdentityV1:identities.createInternalProductionClaimCanonicalOwnerIdentityV1,
        createInternalProductionExecutionAttemptCanonicalOwnerIdentityV1:identities.createInternalProductionExecutionAttemptCanonicalOwnerIdentityV1,
        createInternalProductionRuntimeSessionCanonicalOwnerIdentityV1:identities.createInternalProductionRuntimeSessionCanonicalOwnerIdentityV1,
        createInternalProductionCompletionOwnerCanonicalOwnerIdentityV1:identities.createInternalProductionCompletionOwnerCanonicalOwnerIdentityV1,
        createInternalProductionMandatoryEffectCanonicalOwnerIdentityV1:identities.createInternalProductionMandatoryEffectCanonicalOwnerIdentityV1,
        createInternalProductionTerminationCanonicalOwnerIdentityV1:identities.createInternalProductionTerminationCanonicalOwnerIdentityV1,
        hashCanonicalJson:canonical.hashCanonicalJson,canonicalJsonStringify:canonical.canonicalJsonStringify,
        RuntimeCompletionPlanV1Schema:schemas.RuntimeCompletionPlanV1Schema,RuntimeCompletionEffectInputV1Schema:schemas.RuntimeCompletionEffectInputV1Schema,
      });
      const inputs=[{claimIdText:claimId},{attemptId},{sessionId},{requestId},{requestId,effectKey},{requestId:terminationId}];
      const expected=["failed","verified","released","rejected","applied","terminalized"];
      const projections=[];
      for (const [index,config] of configurations.entries()) {
        const row=await sql.begin(tx=>config.lockProjection(tx,inputs[index]));
        assert.equal(Object.isFrozen(row),true);assert.equal(row.status,expected[index]);projections.push(row);
      }
      const completion=configurations[3]!;
      assert.equal((await sql.begin(tx=>completion.lockProjection(tx,{requestId:emptyRequestId}))).status,"rejected");
      const hash=(body:unknown)=>createHash("sha256").update(JSON.stringify(body)).digest("hex");
      assert.equal(projections[0]!.terminalOwnerHash,hash({claimId,schema:"setfarm.internal-production-claim-terminal-owner.v1",status:"failed"}));
      assert.equal(projections[3]!.terminalOwnerHash,hash({requestId,schema:"setfarm.internal-production-completion-owner-terminal.v1",status:"rejected"}));
      // The complete actual completion projection validates nonempty manifests;
      // corruption must refuse and roll back rather than returning an authority.
      await assert.rejects(control.begin(async tx=>{
        await tx.unsafe(`SET LOCAL ROLE "${installation.ownerRole}"`);
        await tx.unsafe("UPDATE runtime_completion_effects SET input_hash=$2 WHERE request_id=$1",[requestId,"0".repeat(64)]);
        await tx.unsafe(`SET LOCAL ROLE "${installation.runtimeRole}"`);
        await completion.lockProjection(tx,{requestId});
      }),/INTERNAL_PRODUCTION_COMPLETION_OWNER_UNAVAILABLE/);
      const second=postgres(credential.runtimeUrl,{max:1,connect_timeout:3,onnotice(){}});
      try {
        for (const [index,config] of configurations.entries()) {
          await sql.begin(async tx=>{
            await config.lockProjection(tx,inputs[index]);
            await assert.rejects(second.begin(async other=>{
              await other.unsafe("SET LOCAL lock_timeout='100ms'");await config.lockProjection(other,inputs[index]);
            }),{code:"55P03"});
          });
          await second.begin(tx=>config.lockProjection(tx,inputs[index]));
        }
      } finally {await second.end({timeout:3});}
    });
    await t.test("schema-only selected installation preserves actual public terminal guard refusal before SQL", async () => {
      const environment={...process.env};
      for(const key of Object.keys(environment)) if(key.startsWith("SETFARM_")||key.startsWith("OPENCLAW_")
        ||["DATABASE_URL","PGHOST","PGPORT","PGUSER","PGPASSWORD","PGDATABASE","PROJECTS_DIR","SCRIPTS_DIR","CLI_PATH"].includes(key)) delete environment[key];
      const input={root:fixture.root,directory:installation.directory,runId};
      const child=spawnSync(process.execPath,["--import",import.meta.resolve("tsx"),"--input-type=module","-e","const input="+JSON.stringify(input)+`;\n
        import assert from "node:assert/strict";
        import {readFileSync} from "node:fs";
        import postgres from "postgres";
        const selected=await import(input.root+"/src/installation/fresh-installation-selection-v1.ts");
        assert.notEqual(selected.selectedFreshInstallationRootV1(),null);
        const terminal=await import(input.root+"/src/execution/run-terminal-transition.ts");
        const credential=JSON.parse(readFileSync(input.directory+"/runtime-credentials.json","utf8"));
        const sql=postgres(credential.runtimeUrl,{max:1,onnotice(){}});
        let statements=0;
        try {
          await assert.rejects(sql.begin(async tx=>{
            const observed=new Proxy(tx,{apply(target,receiver,args){statements++;return Reflect.apply(target,target,args);},get(target,key){
              const value=Reflect.get(target,key,target);return key==="unsafe"?(...args)=>{statements++;return Reflect.apply(value,target,args);}:value;
            }});
            await terminal.transitionRunToTerminalInTransaction(observed,{runId:input.runId,status:"failed",diagnostic:"component",unclaimedBootstrapFailure:true});
          }),{message:"DASHBOARD_CUTOVER_ORDINARY_DATABASE_REFUSED"});
          assert.equal(statements,0);
          console.log("RECOVERY_PUBLIC_SCHEMA_ONLY_GUARD_REFUSED");
        } finally {await sql.end({timeout:3});}
      `],{cwd:fixture.root,env:{...environment,SETFARM_INSTALLATION_DIR:installation.directory},encoding:"utf8",timeout:30_000,maxBuffer:65_536});
      assert.equal(child.error,undefined);assert.equal(child.signal,null);assert.equal(child.status,0,child.stderr);
      assert.match(child.stdout,/RECOVERY_PUBLIC_SCHEMA_ONLY_GUARD_REFUSED/);
    });
  } finally {
    await runtime?.end({ timeout: 3 });
    await control.end({ timeout: 3 });
  }
});
