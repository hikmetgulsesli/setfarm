import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, lstatSync, realpathSync, rmSync } from "node:fs";
import { registerHooks } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import { test, type TestContext } from "node:test";
import { fileURLToPath } from "node:url";
import ts from "typescript";

import type { PgTransactionSql } from "../../src/db-pg.js";
import type { PersistWorkflowRunInputV1 } from "../../src/execution/run-persistence.js";
import { createV3ReleaseAdmissionRepository } from "../../src/execution/v3-release-admission-repository.js";
import { ContentAddressedEvalResultStore } from "../../src/evals/report.js";
import { loadConvergenceSuite, convergenceCaseHash } from "../../src/evals/suite-schema.js";
import { hashCanonicalJson } from "../../src/product-compiler/canonical-json.js";
import { seedCanonicalSetupBuildCompilerStoryAdmissionFixture } from "./helpers/compiler-story-admission-fixture.js";
import { createIsolatedTestDatabase } from "./test-database.js";

const SOURCE_SHA = "b".repeat(40);
const SOURCE_ROOT = realpathSync(fileURLToPath(new URL("../../", import.meta.url)));
const MANUAL_URL = new URL("../../src/execution/manual-test-admission-v1.js", import.meta.url);
const PERSISTENCE_URL = new URL("../../src/execution/run-persistence.js", import.meta.url);

/** Root-approved component scope: only the new module's immutable locator
 * observation is replaced. DB preparation, pgBegin, the common fence, run
 * persistence, canary validation/consumption and terminal settlement stay real.
 * This supplies no compiled selected-entry or privileged recovery authority. */
async function fixture(t: TestContext) {
  const root = realpathSync(mkdtempSync(path.join(tmpdir(), "setfarm-manual-admission-")));
  const rootPin = lstatSync(root);
  const runtime = path.join(root, "runtime");
  const evals = path.join(runtime, "evals");
  for (const directory of [runtime, evals, path.join(evals, "results")]) mkdirSync(directory, { mode: 0o700 });
  const fixtureId = randomUUID();
  const faults = { rollbackAfterCallback: false, censusOverlay: null as Record<string, unknown> | null };
  const faultKey = `setfarm.manual-test-fault.${fixtureId}`;
  Reflect.set(globalThis, Symbol.for(faultKey), faults);
  const selected = {
    directory: root,
    paths: { root: runtime, repository: SOURCE_ROOT, evals: path.join(evals, "results") },
    state: { origin: { sourceSha: SOURCE_SHA, installationId: fixtureId } },
    catalogHash: "c".repeat(64),
    activation: { acknowledged: true, preparedPin: { sha256: "e".repeat(64) }, activatedPin: { sha256: "f".repeat(64) } },
  };
  const selectionHash = hashCanonicalJson({
    schema: "setfarm.manual-control-selection.v1", installationId: fixtureId, sourceSha: SOURCE_SHA,
    installationDir: root, releaseDir: SOURCE_ROOT, catalogHash: selected.catalogHash,
    activationPreparedHash: selected.activation.preparedPin.sha256,
    activationAcknowledgedHash: selected.activation.activatedPin.sha256,
  });
  const selectionSource = `
    import {lstatSync} from 'node:fs';
    const selected=${JSON.stringify(selected)};
    const pins=[selected.directory,selected.paths.root,selected.paths.evals].map(path=>({path,stat:lstatSync(path)}));
    export function assertFreshInstallationSelectionUnchangedV1(){for(const pin of pins){const current=lstatSync(pin.path);if(!current.isDirectory()||current.isSymbolicLink()||current.dev!==pin.stat.dev||current.ino!==pin.stat.ino||current.uid!==pin.stat.uid||(current.mode&511)!==448)throw new Error('FIXTURE_SELECTED_LOCATOR_CHANGED')}}
    selected.assertUnchanged=assertFreshInstallationSelectionUnchangedV1;
    function freeze(value){if(value&&typeof value==='object'){for(const child of Object.values(value))freeze(child);Object.freeze(value)}}freeze(selected);
    export const freshInstallationSelectionV1=selected;
    export function selectedFreshInstallationRootV1(){assertFreshInstallationSelectionUnchangedV1();return selected.paths.root}
  `;
  const selectionUrl = `data:text/javascript;base64,${Buffer.from(selectionSource).toString("base64")}`;
  // Negative fault ports only: execute real SQL before corrupting a census,
  // or throw after the real transaction callback to cause a real rollback.
  const databaseUrl = new URL("../../src/db-pg.ts", import.meta.url).href;
  const faultSource = `
    export * from ${JSON.stringify(databaseUrl)};
    import * as db from ${JSON.stringify(databaseUrl)};
    const fault=globalThis[Symbol.for(${JSON.stringify(faultKey)})];
    export function pgBegin(callback){return db.pgBegin(async sql=>{
      const observed=new Proxy(sql,{get(target,key){if(key==='unsafe')return async(query,...args)=>{
        const rows=await target.unsafe(query,...args);
        if(fault.censusOverlay&&/AS\\s+active_runs/i.test(query))return rows.map(row=>({...row,...fault.censusOverlay}));
        return rows;
      };const value=Reflect.get(target,key);return typeof value==='function'?value.bind(target):value;}});
      const result=await callback(observed);
      if(fault.rollbackAfterCallback)throw new Error('INJECTED_MANUAL_TRANSACTION_ROLLBACK');
      return result;
    })}
  `;
  const faultUrl = `data:text/javascript;base64,${Buffer.from(faultSource).toString("base64")}`;
  const hooks = registerHooks({
    resolve(specifier, context, nextResolve) {
      const parent = context.parentURL ?? "";
      if (parent.includes(`manual-test-admission-v1.`) && parent.includes(`manual-fixture=${fixtureId}`)
        && /fresh-installation-selection-v1\.[jt]s$/.test(specifier)) {
        return { url: selectionUrl, shortCircuit: true };
      }
      if (parent.includes("manual-test-admission-v1.") && parent.includes(`manual-fixture=${fixtureId}`)
        && /(?:^|\/)db-pg\.[jt]s$/.test(specifier)) return { url: faultUrl, shortCircuit: true };
      if (parent.includes("run-persistence.") && parent.endsWith(`?manual-fixture=${fixtureId}`)
        && /manual-test-admission-v1\.[jt]s$/.test(specifier)) {
        return nextResolve(`${specifier}?manual-fixture=${fixtureId}`, context);
      }
      return nextResolve(specifier, context);
    },
  });
  t.after(() => {
    hooks.deregister();
    Reflect.deleteProperty(globalThis, Symbol.for(faultKey));
    const current = lstatSync(root);
    assert.equal(current.dev, rootPin.dev);
    assert.equal(current.ino, rootPin.ino);
    assert.equal(current.uid, rootPin.uid);
    assert.equal(current.isSymbolicLink(), false);
    rmSync(root, { recursive: true }); // Only this test's newly created, pinned temp root.
  });
  // Import before creating any DB: the initial RED is the absent implementation.
  const manual: typeof import("../../src/execution/manual-test-admission-v1.js") =
    await import(`${MANUAL_URL.href}?manual-fixture=${fixtureId}`);
  const persistence: typeof import("../../src/execution/run-persistence.js") =
    await import(`${PERSISTENCE_URL.href}?manual-fixture=${fixtureId}`);
  const database = await createIsolatedTestDatabase();
  t.after(() => database.cleanup());
  const db = await import("../../src/db-pg.js");
  await db.initializeInternalProductionCurrentEntryDatabaseV1();
  t.after(() => db.pgClose());
  const suite = await loadConvergenceSuite(path.join(SOURCE_ROOT, "evals/suites/product-convergence-codex-v1.json"));
  const input = () => ({ jobId: randomUUID(), kind: "convergence_full8" as const,
    selectionHash, sourceSha: SOURCE_SHA, suiteHash: suite.suiteHash });
  const ordinaryRunInput: PersistWorkflowRunInputV1 = {
    run: {
      id: randomUUID(), runNumber: 8101, workflowId: "feature-dev", task: suite.suite.cases[0]!.task,
      context: "{}", notifyUrl: null, createdAt: new Date().toISOString(),
      protocol: { mode: "v3", version: 1, compilerReleaseSha: SOURCE_SHA,
        activationPreflightHash: "d".repeat(64),
        releaseAdmissionHash: await database.seedV3ReleaseGoAdmission(SOURCE_SHA),
        releaseAdmissionKind: "release_go", canaryAdmission: null },
    },
    steps: [],
  };
  async function revision(jobId: string): Promise<number> {
    const matches: number[] = [];
    function visit(directory: string, depth: number): void {
      assert.ok(depth <= 4);
      for (const entry of readdirSync(directory, { withFileTypes: true })) {
        const locator = path.join(directory, entry.name);
        const stat = lstatSync(locator);
        assert.equal(stat.isSymbolicLink(), false);
        if (entry.isDirectory()) { assert.equal(stat.mode & 0o777, 0o700); visit(locator, depth + 1); }
        else if (entry.isFile() && entry.name.endsWith(".json")) {
          assert.equal(stat.mode & 0o777, 0o600);
          const record = JSON.parse(readFileSync(locator, "utf8"));
          const reservation = record.reservation ?? record;
          if (reservation.jobId === jobId && Number.isSafeInteger(reservation.revision)) matches.push(reservation.revision);
        }
      }
    }
    visit(evals, 0);
    assert.ok(matches.length > 0, "reservation must survive in the selected eval root");
    return Math.max(...matches);
  }
  const restart = async (): Promise<typeof manual> => import(`${MANUAL_URL.href}?manual-fixture=${fixtureId}&restart=${randomUUID()}`);
  return { manual, persistence, database, db, root, evals, suite, input, ordinaryRunInput, revision, faults, restart };
}

function exactPrivateRecoveryComponent(bindings: Record<string, unknown>) {
  const source = readFileSync(new URL("../../src/execution/run-persistence.ts", import.meta.url), "utf8");
  const tree = ts.createSourceFile("run-persistence.ts", source, ts.ScriptTarget.Latest, true);
  const declaration = tree.statements.find(statement => ts.isFunctionDeclaration(statement)
    && statement.name?.text === "persistRecoverySourceBootstrapRunInTransactionV1");
  assert.ok(declaration, "complete production recovery insertion function must exist");
  const compiled = ts.transpileModule(declaration.getText(tree), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
  }).outputText;
  return new Function(...Object.keys(bindings), `${compiled};return persistRecoverySourceBootstrapRunInTransactionV1;`)
    (...Object.values(bindings)) as (sql: PgTransactionSql, candidate: unknown) => Promise<unknown>;
}

test("reservation-first denies the actual ordinary INSERT and private recovery INSERT before downstream authority", async t => {
  const f = await fixture(t);
  const held = await f.manual.acquireSelectedManualEvaluationV1(f.input());
  await assert.rejects(() => f.database.sql.begin(sql => f.persistence.persistWorkflowRunInTransaction(
    sql as PgTransactionSql, f.ordinaryRunInput)), /MANUAL_EVALUATION_RESERVED/);
  let downstreamAuthorityReads = 0;
  let fenceEntries = 0;
  const privateRecovery = exactPrivateRecoveryComponent({
    ...f.manual,
    async lockInternalProductionRecoverySourceBootstrapRunInsertionFenceV1(sql: PgTransactionSql) {
      await f.db.lockInternalProductionWorkflowRunInsertionFenceV1(sql);
      fenceEntries += 1;
      return new Proxy({}, { get() { downstreamAuthorityReads += 1; throw new Error("UNUSABLE_RECOVERY_AUTHORITY"); } });
    },
  });
  await assert.rejects(() => f.database.sql.begin(sql => privateRecovery(sql as PgTransactionSql, {
    operation: Object.freeze({}), // Deliberately supplies no recovery authority.
  })), /MANUAL_EVALUATION_RESERVED/);
  assert.equal(fenceEntries, 1);
  assert.equal(downstreamAuthorityReads, 0);
  assert.equal(await f.revision(held.jobId), held.revision);
  assert.deepEqual(await f.database.sql`SELECT id FROM runs`, []);
  await assert.rejects(() => f.persistence.persistInternalProductionRecoverySourceBootstrapRunV1({
    operationRef: "setfarm://tests/no-admitted-recovery-operation", operationHash: "e".repeat(64),
  }));
  assert.equal(await f.revision(held.jobId), held.revision);
});

test("two acquisitions have one durable owner and a fresh module observes that same reservation", async t => {
  const f = await fixture(t);
  const results = await Promise.allSettled([
    f.manual.acquireSelectedManualEvaluationV1(f.input()),
    f.manual.acquireSelectedManualEvaluationV1(f.input()),
  ]);
  const winners = results.filter(result => result.status === "fulfilled");
  assert.equal(winners.length, 1);
  assert.equal(results.filter(result => result.status === "rejected").length, 1);
  const held = winners[0]!.value;
  const restarted = await f.restart();
  const observed = await f.database.sql.begin(sql => restarted.observeSelectedManualEvaluationInTransactionV1(sql as PgTransactionSql));
  assert.equal(observed?.jobId, held.jobId);
  assert.equal(await f.revision(held.jobId), held.revision);
  await assert.rejects(() => f.manual.acquireSelectedManualEvaluationV1(f.input()), /MANUAL_EVALUATION_RESERVED|MANUAL_EVALUATION_OWNERSHIP_UNKNOWN/);
});

test("insertion-first commits under the real fence before evaluator readiness and refuses acquisition", async t => {
  const f = await fixture(t);
  let unlock!: () => void;
  let locked!: () => void;
  const atFence = new Promise<void>(resolve => { locked = resolve; });
  const hold = new Promise<void>(resolve => { unlock = resolve; });
  const insertion = f.database.sql.begin(async sql => {
    await f.db.lockInternalProductionWorkflowRunInsertionFenceV1(sql as PgTransactionSql);
    locked();
    await hold;
    return f.persistence.persistWorkflowRunInTransaction(sql as PgTransactionSql, f.ordinaryRunInput);
  });
  await atFence;
  const acquiring = f.manual.acquireSelectedManualEvaluationV1(f.input());
  // Attach rejection handling before releasing the competing transaction.
  const refused = assert.rejects(acquiring, /MANUAL_EVALUATION_ACTIVITY|MANUAL_EVALUATION_OWNERSHIP_UNKNOWN/);
  unlock();
  const inserted = await insertion;
  assert.equal(inserted.run.id, f.ordinaryRunInput.run.id);
  await refused;
  const rows = await f.database.sql`SELECT id,status FROM runs WHERE id=${inserted.run.id}`;
  assert.equal(rows[0]?.status, "running");
});

test("canonical compiler fixture exposes real live run claim and runtime activity to acquisition", async t => {
  const f = await fixture(t);
  const runId = randomUUID();
  const fixtureRun = await seedCanonicalSetupBuildCompilerStoryAdmissionFixture(f.database, {
    runId, repo: path.join(f.root, "compiler-project"), setupBuildStepDbId: `${runId}-setup-build`,
    setupBuildClaimAgentId: "feature-dev_setup-build", releaseSha: SOURCE_SHA,
  });
  assert.ok(fixtureRun.claimId > 0);
  await assert.rejects(() => f.manual.acquireSelectedManualEvaluationV1(f.input()),
    /MANUAL_EVALUATION_ACTIVITY|MANUAL_EVALUATION_OWNERSHIP_UNKNOWN/);
  const rows = await f.database.sql`SELECT outcome FROM claim_log WHERE id=${fixtureRun.claimId}`;
  assert.equal(rows[0]?.outcome, null);
});

test("all nonterminal run states block acquisition including cancellation and failure drain", async t => {
  const f = await fixture(t);
  for (const status of ["running", "resuming", "cancelling", "failing"]) {
    const runId = randomUUID();
    await f.database.insertRun(runId);
    await f.database.sql`UPDATE runs SET status=${status} WHERE id=${runId}`;
    await assert.rejects(() => f.manual.acquireSelectedManualEvaluationV1(f.input()),
      /MANUAL_EVALUATION_ACTIVITY|MANUAL_EVALUATION_OWNERSHIP_UNKNOWN/, status);
    const observed = await f.database.sql.begin(sql => f.manual.observeSelectedManualEvaluationInTransactionV1(sql as PgTransactionSql));
    assert.equal(observed, null, "failed readiness must not create an evaluator owner");
    // Fixture-only rows in this exact private DB, never canonical live owners.
    await f.database.sql`DELETE FROM runs WHERE id=${runId}`;
  }
});

test("complete activity census refuses every nonzero family and missing invalid or negative observations", async t => {
  const f = await fixture(t);
  const families = [
    "active_runs", "open_claims", "active_attempts", "active_attempt_binding_conflicts",
    "active_runtimes", "active_runtime_completions", "active_recovery_cases",
    "active_recovery_deliveries", "active_termination_requests", "active_evaluator_owners",
    "active_build_owners", "active_publication_owners",
  ];
  for (const family of families) {
    for (const value of [1, undefined, -1, 0.5, "0", null]) {
      f.faults.censusOverlay = { [family]: value };
      await assert.rejects(() => f.manual.acquireSelectedManualEvaluationV1(f.input()),
        /MANUAL_EVALUATION_ACTIVITY|MANUAL_EVALUATION_OWNERSHIP_UNKNOWN/,
        `${family}:${String(value)}`);
      assert.equal(await f.database.sql.begin(sql => f.manual.observeSelectedManualEvaluationInTransactionV1(sql as PgTransactionSql)), null);
    }
  }
  f.faults.censusOverlay = null;
});

test("rollback after durable publication retains a pending or unknown reservation across module restart", async t => {
  const f = await fixture(t);
  const input = f.input();
  f.faults.rollbackAfterCallback = true;
  await assert.rejects(() => f.manual.acquireSelectedManualEvaluationV1(input), /INJECTED_MANUAL_TRANSACTION_ROLLBACK|MANUAL_EVALUATION_OWNERSHIP_UNKNOWN/);
  f.faults.rollbackAfterCallback = false;
  const restarted = await f.restart();
  const observed = await f.database.sql.begin(sql => restarted.observeSelectedManualEvaluationInTransactionV1(sql as PgTransactionSql));
  assert.ok(observed);
  assert.equal(observed.jobId, input.jobId);
  assert.ok(["pending", "ownership_unknown"].includes(observed.phase));
  assert.equal(await f.revision(input.jobId), observed.revision);
  await assert.rejects(() => restarted.acquireSelectedManualEvaluationV1(f.input()), /MANUAL_EVALUATION_RESERVED|MANUAL_EVALUATION_OWNERSHIP_UNKNOWN/);
  await assert.rejects(() => f.database.sql.begin(sql => f.persistence.persistWorkflowRunInTransaction(sql as PgTransactionSql, f.ordinaryRunInput)),
    /MANUAL_EVALUATION_RESERVED|MANUAL_EVALUATION_OWNERSHIP_UNKNOWN/);
  await assert.rejects(() => restarted.releaseSelectedManualEvaluationV1(observed));
  assert.equal(await f.revision(input.jobId), observed.revision);
});

test("exact stored canary admits once and canonical terminal settlement remains usable under reservation", async t => {
  const f = await fixture(t);
  const held = await f.manual.acquireSelectedManualEvaluationV1(f.input());
  const entry = f.suite.suite.cases[0]!;
  const repository = createV3ReleaseAdmissionRepository(f.database.sql, new ContentAddressedEvalResultStore(path.join(f.evals, "results")));
  const canary = await repository.createCanary({
    releaseSha: SOURCE_SHA, suiteHash: f.suite.suiteHash, preflightHash: "d".repeat(64), ttlMs: 60_000,
    slots: [{ caseHash: convergenceCaseHash(entry), taskHash: hashCanonicalJson(entry.task), repetition: 1, slotToken: "test_private_selector_".repeat(3) }],
  });
  const context = canary.contexts[0]!;
  await f.manual.bindSelectedManualCanaryV1({ reservation: held, admissionHash: canary.admission.admissionHash,
    slots: [{ admissionHash: context.admissionHash, slotHash: context.slotHash, caseHash: context.caseHash, taskHash: context.taskHash, repetition: context.repetition }] });
  await assert.rejects(() => f.manual.bindSelectedManualCanaryV1({ reservation: held,
    admissionHash: canary.admission.admissionHash,
    slots: [{ admissionHash: context.admissionHash, slotHash: context.slotHash, caseHash: context.caseHash, taskHash: context.taskHash, repetition: context.repetition }] }),
  /MANUAL_EVALUATION_REVISION|MANUAL_EVALUATION_CONFLICT/);
  const input: PersistWorkflowRunInputV1 = {
    ...f.ordinaryRunInput,
    run: { ...f.ordinaryRunInput.run, protocol: { ...f.ordinaryRunInput.run.protocol,
      releaseAdmissionKind: "convergence_canary", releaseAdmissionHash: context.admissionHash, canaryAdmission: context } },
  };
  for (const altered of [
    { ...context, slotToken: "foreign_selector_".repeat(3) },
    { ...context, admissionHash: "f".repeat(64) },
    { ...context, caseHash: "f".repeat(64) },
    { ...context, taskHash: "f".repeat(64) },
    { ...context, repetition: 2 },
    { slotHash: context.slotHash },
  ]) {
    await assert.rejects(() => f.database.sql.begin(sql => f.persistence.persistWorkflowRunInTransaction(sql as PgTransactionSql,
      { ...input, run: { ...input.run, protocol: { ...input.run.protocol, canaryAdmission: altered as typeof context } } })));
    assert.deepEqual(await f.database.sql`SELECT id FROM runs`, []);
    const claim = await f.database.sql`SELECT run_id,consumed_at FROM v3_canary_admission_claims WHERE slot_hash=${context.slotHash}`;
    assert.equal(claim[0]?.run_id, null);
    assert.equal(claim[0]?.consumed_at, null);
  }
  const inserted = await f.database.sql.begin(sql => f.persistence.persistWorkflowRunInTransaction(sql as PgTransactionSql, input));
  const claim = await f.database.sql`SELECT run_id,consumed_at FROM v3_canary_admission_claims WHERE slot_hash=${context.slotHash}`;
  assert.equal(claim[0]?.run_id, inserted.run.id);
  assert.ok(claim[0]?.consumed_at);
  await assert.rejects(() => f.manual.releaseSelectedManualEvaluationV1(held));
  const terminal = await import("../../src/execution/run-terminal-transition.js");
  await terminal.transitionRunToTerminal(f.database.sql, {
    runId: inserted.run.id, status: "failed", diagnostic: "Manual admission isolated pre-claim test",
    terminalFailure: true, unclaimedBootstrapFailure: true,
  });
  const current = await f.database.sql.begin(sql => f.manual.observeSelectedManualEvaluationInTransactionV1(sql as PgTransactionSql));
  assert.ok(current);
  await assert.rejects(() => f.database.sql.begin(sql => f.persistence.persistWorkflowRunInTransaction(sql as PgTransactionSql,
    { ...input, run: { ...input.run, id: randomUUID(), runNumber: 8102 } })), /CANARY|MANUAL_EVALUATION/);
  await f.manual.releaseSelectedManualEvaluationV1(current);
  assert.equal(await f.database.sql.begin(sql => f.manual.observeSelectedManualEvaluationInTransactionV1(sql as PgTransactionSql)), null);
});

test("a bound canary that expires before insertion cannot consume its real stored claim", async t => {
  const f = await fixture(t);
  const held = await f.manual.acquireSelectedManualEvaluationV1(f.input());
  const entry = f.suite.suite.cases[0]!;
  const repository = createV3ReleaseAdmissionRepository(f.database.sql, new ContentAddressedEvalResultStore(path.join(f.evals, "results")));
  const canary = await repository.createCanary({ releaseSha: SOURCE_SHA,
    suiteHash: f.suite.suiteHash, preflightHash: "d".repeat(64), ttlMs: 1000,
    slots: [{ caseHash: convergenceCaseHash(entry), taskHash: hashCanonicalJson(entry.task), repetition: 1, slotToken: "expiry_private_selector_".repeat(3) }],
  });
  const context = canary.contexts[0]!;
  await f.manual.bindSelectedManualCanaryV1({ reservation: held, admissionHash: context.admissionHash,
    slots: [{ admissionHash: context.admissionHash, slotHash: context.slotHash, caseHash: context.caseHash, taskHash: context.taskHash, repetition: context.repetition }] });
  await f.database.sql`SELECT pg_sleep(1.1)`;
  await assert.rejects(() => f.database.sql.begin(sql => f.persistence.persistWorkflowRunInTransaction(sql as PgTransactionSql, {
    ...f.ordinaryRunInput,
    run: { ...f.ordinaryRunInput.run, protocol: { ...f.ordinaryRunInput.run.protocol,
      releaseAdmissionKind: "convergence_canary", releaseAdmissionHash: context.admissionHash, canaryAdmission: context } },
  })), /CANARY|MANUAL_EVALUATION/);
  assert.deepEqual(await f.database.sql`SELECT id FROM runs`, []);
  const rows = await f.database.sql`SELECT run_id,consumed_at FROM v3_canary_admission_claims WHERE slot_hash=${context.slotHash}`;
  assert.equal(rows[0]?.run_id, null);
  assert.equal(rows[0]?.consumed_at, null);
});
