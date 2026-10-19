import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { test } from "node:test";
import type postgres from "postgres";
import { fixture, snapshot } from "../evals/control-evidence-fixture-v1.js";
import { ContentAddressedEvalResultStore } from "../../src/evals/report.js";
import { createConvergenceResult } from "../../src/evals/result-schema.js";
import { convergenceArtifactRef } from "../../src/execution/v3-release-admission.js";
import { createV3ReleaseAdmissionRepository } from "../../src/execution/v3-release-admission-repository.js";
import { createIsolatedTestDatabase } from "./test-database.js";

// Root-only protected P3 execution. The shared fixture replaces only captured
// filesystem-selection facts. SQL, schema guards, promotion and commit visibility
// are real. This is not compiled selected-entry or provider/full8 qualification.
async function databaseSnapshot(owner: postgres.Sql) {
  return owner.begin("isolation level repeatable read read only", async sql => {
    const tables = await sql.unsafe<Array<{ name: string }>>(
      "SELECT tablename AS name FROM pg_catalog.pg_tables WHERE schemaname = 'public' ORDER BY tablename");
    const contents: Record<string, unknown> = {};
    for (const { name } of tables) {
      assert.match(name, /^[a-z0-9_]+$/);
      const rows = await sql.unsafe(`SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text), '[]'::jsonb) AS rows FROM public."${name}" t`);
      contents[name] = rows[0]!.rows;
    }
    const shape = await sql.unsafe("SELECT c.oid::text, c.relname, c.relkind, c.relfilenode::text FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' ORDER BY c.oid");
    return { contents, shape: [...shape] };
  });
}
function withBegin(owner: postgres.Sql, begin: (...args: any[]) => Promise<any>): postgres.Sql {
  return new Proxy(owner, { get(target, key) { return key === "begin" ? begin : Reflect.get(target, key); } });
}

test("protected P3 observes only actual committed production promotion and performs read-only evidence reads", { timeout: 90_000 }, async t => {
  const database = await createIsolatedTestDatabase();
  t.after(() => database.cleanup());
  const owner = database.sql;
  assert.strictEqual(owner, database.db.getSql());
  const identity = await owner.unsafe<Array<{ name: string }>>("SELECT current_database() AS name");
  assert.equal(identity[0]!.name, database.database);
  assert.equal(decodeURIComponent(new URL(database.url).pathname.slice(1)), database.database);
  const f = await fixture(t); const runs = f.runs(); const stored = f.storeResult(f.result(runs, "execute"));
  const store = new ContentAddressedEvalResultStore(f.evals);
  // Store-only fixture setup precedes all filesystem/data snapshots.
  for (const run of runs) await store.put(run);
  const hooks = f.hooksFactory();
  let adapter: typeof import("../../src/evals/control-evidence-admission-reader-v1.js");
  try { adapter = await import(f.adapterUrl); } finally { hooks.deregister(); }
  const read = (sql: postgres.Sql = owner) => adapter.readSelectedControlEvidenceWithAdmissionV1(f.input, sql);
  const promotion = { releaseSha: f.input.releaseSha, suiteHash: f.input.suiteHash,
    resultHash: stored.result.resultHash, resultRef: convergenceArtifactRef(stored.result.resultHash),
    gateHash: stored.gate.gateHash, gateRef: convergenceArtifactRef(stored.gate.gateHash) };
  const repository = createV3ReleaseAdmissionRepository(owner, store);

  await t.test("GO files before real promotion are available and unqualified; missing canary prerequisites cannot promote", async () => {
    const before = await read(); assert.equal(before.evaluation.availability.code, "CONTROL_RELEASE_ADMISSION_MISSING");
    assert.equal(before.evaluation.report?.qualification, "unqualified"); assert.equal(before.evaluation.report?.gateDecision, "go");
    await assert.rejects(repository.promoteReleaseGo(promotion), (error: any) => error.code === "V3_RELEASE_ADMISSION_ARTIFACT_INVALID");
    assert.equal((await read()).evaluation.availability.code, "CONTROL_RELEASE_ADMISSION_MISSING");
  });

  const canary = await repository.createCanary({ releaseSha: f.input.releaseSha, suiteHash: f.input.suiteHash,
    preflightHash: stored.result.preflight.preflightHash, ttlMs: 60 * 60 * 1000,
    slots: runs.map(run => ({ caseHash: run.caseHash, taskHash: run.taskHash, repetition: 1, slotToken: randomBytes(32).toString("hex") })) });
  // Exact stored production-promotion prerequisites, with actual one-time claim
  // consumption. No release_go row is inserted by the test.
  await owner.begin(async sql => {
    for (const run of runs) {
      const item = f.suite.cases.find(item => item.caseId === run.caseId)!;
      const context = canary.contexts.find(context => context.caseHash === run.caseHash)!;
      await sql.unsafe(`INSERT INTO runs
        (id,run_number,workflow_id,task,status,context,notify_url,protocol,protocol_version,compiler_release_sha,activation_preflight_hash,release_admission_hash,created_at,updated_at)
        VALUES ($1,$2,$3,$4,'running','{}',NULL,'v3',1,$5,$6,$7,clock_timestamp(),clock_timestamp())`,
      [run.runId, run.runNumber, f.suite.workflowId, item.task, f.input.releaseSha, stored.result.preflight.preflightHash, canary.admission.admissionHash]);
      const consumed = await sql.unsafe(`UPDATE v3_canary_admission_claims SET run_id=$1,consumed_at=clock_timestamp()
        WHERE slot_hash=$2 AND admission_hash=$3 AND run_id IS NULL AND consumed_at IS NULL RETURNING slot_hash`,
      [run.runId, context.slotHash, canary.admission.admissionHash]);
      assert.equal(consumed.length, 1);
      await sql.unsafe("UPDATE runs SET status=$1 WHERE id=$2", [run.disposition, run.runId]);
    }
  });

  await t.test("production promotion rolled back after its actual SQL callback remains unqualified", async () => {
    const rollback = withBegin(owner, callback => owner.begin(async tx => { await callback(tx); throw new Error("INJECTED_ACTUAL_PROMOTION_ROLLBACK"); }));
    await assert.rejects(createV3ReleaseAdmissionRepository(rollback, store).promoteReleaseGo(promotion));
    assert.equal((await read()).evaluation.availability.code, "CONTROL_RELEASE_ADMISSION_MISSING");
  });

  await t.test("another actual backend cannot observe uncommitted production promotion", async () => {
    let signal!: () => void, release!: () => void;
    const inserted = new Promise<void>(resolve => { signal = resolve; });
    const held = new Promise<void>(resolve => { release = resolve; });
    let promotionPid: number | undefined;
    const paused = withBegin(owner, callback => owner.begin(async tx => {
      await callback(tx); promotionPid = (await tx.unsafe("SELECT pg_backend_pid() AS pid"))[0]!.pid;
      signal(); await held; throw new Error("INJECTED_UNCOMMITTED_PROMOTION_ROLLBACK");
    }));
    const attempt = createV3ReleaseAdmissionRepository(paused, store).promoteReleaseGo(promotion);
    // Attach rejection immediately so failed prerequisites cannot leave a hanging hold.
    const settled = attempt.then(() => assert.fail("held promotion unexpectedly committed"), error => error);
    try {
      await Promise.race([inserted, settled.then(error => { throw error; }), new Promise<never>((_, reject) => {
        const timer = setTimeout(() => reject(new Error("PROMOTION_HOLD_TIMEOUT")), 5000); timer.unref();
      })]);
      const observedOwner = withBegin(owner, (options, callback) => owner.begin(options, async tx => {
        const facts = await tx.unsafe("SELECT current_database() AS name,pg_backend_pid() AS pid");
        assert.equal(facts[0]!.name, database.database); assert.notEqual(facts[0]!.pid, promotionPid);
        return callback(tx);
      }));
      assert.equal((await read(observedOwner)).evaluation.availability.code, "CONTROL_RELEASE_ADMISSION_MISSING");
    } finally { release(); await settled; }
  });

  await t.test("actual commit survives lost return acknowledgement and independent observation qualifies", async () => {
    const lostReturn = withBegin(owner, async callback => { await owner.begin(callback); throw new Error("INJECTED_LOST_COMMITTED_RETURN"); });
    await assert.rejects(createV3ReleaseAdmissionRepository(lostReturn, store).promoteReleaseGo(promotion));
    const actual = await repository.promoteReleaseGo(promotion);
    const rows = await owner.unsafe("SELECT admission_hash FROM public.v3_release_admissions WHERE kind='release_go' AND release_sha=$1", [f.input.releaseSha]);
    assert.equal(rows.length, 1); assert.equal(rows[0]!.admission_hash, actual.admissionHash);
    const result = await read(); assert.equal(result.evaluation.report?.qualification, "qualified"); assert.equal(result.evaluation.availability.code, null);
  });

  await t.test("adapter owns an enforced read-only snapshot with zero filesystem or DB data/DDL changes", async () => {
    const fsBefore = snapshot(f.root), dbBefore = await databaseSnapshot(owner);
    const observedOwner = withBegin(owner, (options, callback) => owner.begin(options, async tx => {
      const facts = await tx.unsafe("SELECT current_database() AS name,current_setting('transaction_read_only') AS readonly,current_setting('transaction_isolation') AS isolation");
      assert.equal(facts[0]!.name, database.database); assert.equal(facts[0]!.readonly, "on"); assert.equal(facts[0]!.isolation, "repeatable read");
      await assert.rejects(tx.savepoint(async inner => { await inner.unsafe("CREATE TABLE public.control_reader_forbidden(id integer)"); }), (error: any) => error.code === "25006");
      await assert.rejects(tx.savepoint(async inner => { await inner.unsafe("UPDATE public.runs SET status=status WHERE false"); }), (error: any) => error.code === "25006");
      const result = await callback(tx);
      const timeouts = await tx.unsafe("SELECT current_setting('lock_timeout') AS lock_timeout,current_setting('statement_timeout') AS statement_timeout");
      assert.equal(timeouts[0]!.lock_timeout, "1s"); assert.equal(timeouts[0]!.statement_timeout, "5s");
      return result;
    }));
    const result = await read(observedOwner); assert.equal(result.evaluation.report?.qualification, "qualified");
    assert.deepEqual(snapshot(f.root), fsBefore); assert.deepEqual(await databaseSnapshot(owner), dbBefore);
  });

  await t.test("a genuine admission for another exact result cannot qualify new refs", async () => {
    const { resultHash: _, ...payload } = stored.result;
    f.storeResult(createConvergenceResult({ ...payload, finishedAt: "2026-10-19T00:00:01.000Z" }));
    const result = await read(); assert.equal(result.evaluation.availability.code, "CONTROL_RELEASE_ADMISSION_INVALID");
    assert.equal(result.evaluation.report?.qualification, "unqualified"); assert.equal(result.evaluation.report?.resultStatus, "pass"); assert.equal(result.evaluation.report?.gateDecision, "go");
  });
});
