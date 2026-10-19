import assert from "node:assert/strict";
import { randomUUID, createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, lstatSync, realpathSync, rmSync, writeFileSync, existsSync, chmodSync, renameSync } from "node:fs";
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
import { observeProcessIdentity } from "../../src/execution/process-identity.js";
import { createIsolatedTestDatabase } from "./test-database.js";

const SOURCE_SHA = "b".repeat(40);
const SOURCE_ROOT = realpathSync(fileURLToPath(new URL("../../", import.meta.url)));
const MANUAL_URL = new URL("../../src/execution/manual-test-admission-v1.js", import.meta.url);
const PERSISTENCE_URL = new URL("../../src/execution/run-persistence.js", import.meta.url);

/** Root-approved component scope: only the new module's immutable locator
 * observation is replaced. DB preparation, pgBegin, the common fence, run
 * persistence, canary validation/consumption and terminal settlement stay real.
 * This supplies no compiled selected-entry or privileged recovery authority. */
async function fixture(t: TestContext, entryKind: "worker" | "direct" = "worker") {
  const root = realpathSync(mkdtempSync(path.join(tmpdir(), "setfarm-manual-admission-")));
  const rootPin = lstatSync(root);
  const runtime = path.join(root, "runtime");
  const evals = path.join(runtime, "evals");
  for (const directory of [runtime, evals, path.join(evals, "results")]) mkdirSync(directory, { mode: 0o700 });
  const fixtureId = randomUUID(); let jobId: string = randomUUID();
  const identity = observeProcessIdentity(process.pid);
  assert.ok(identity && identity.source === "observed_os" && identity.processGroupId);
  const { schema: _schema, ...osIdentity } = identity;
  const executable = realpathSync(process.execPath);
  const script = path.join(SOURCE_ROOT, entryKind === "worker" ? "dist/cli/control-test-worker-v1.js" : "dist/evals/convergence-runner.js");
  const workerArgv = entryKind === "worker" ? [executable, script, "--job-id", jobId]
    : [executable, script, "--suite", path.join(SOURCE_ROOT, "evals/suites/product-convergence-codex-v1.json"), "--output-root", path.join(evals, "results")];
  const owner = Object.freeze({ ...osIdentity, executable, script, commandHash: createHash("sha256").update(workerArgv.join(" ")).digest("hex") });
  const faults = { rollbackAfterCallback: false, censusOverlay: null as Record<string, unknown> | null, transactionBackendPid: null as number | null };
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
      const identity=await sql.unsafe("SELECT pg_backend_pid() AS pid");
      fault.transactionBackendPid=identity[0].pid;
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
  const processUrl = `data:text/javascript;base64,${Buffer.from(`import real from 'node:process';export default new Proxy(real,{get(target,key){if(key==='argv')return Object.freeze(${JSON.stringify(workerArgv)});if(key==='execArgv')return Object.freeze([]);const value=Reflect.get(target,key);return typeof value==='function'?value.bind(target):value;}})`).toString("base64")}`;
  const entryUrl = `data:text/javascript;base64,${Buffer.from(`import {assertFreshInstallationSelectionUnchangedV1} from ${JSON.stringify(selectionUrl)};export function assertFreshInstallationOperationalEntryV1(){assertFreshInstallationSelectionUnchangedV1()}`).toString("base64")}`;
  const hooks = registerHooks({
    resolve(specifier, context, nextResolve) {
      const parent = context.parentURL ?? "";
      if (parent.includes(`manual-test-admission-v1.`) && parent.includes(`manual-fixture=${fixtureId}`)
        && /fresh-installation-selection-v1\.[jt]s$/.test(specifier)) {
        return { url: selectionUrl, shortCircuit: true };
      }
      if (parent.includes("manual-test-admission-v1.") && parent.includes(`manual-fixture=${fixtureId}`)) {
        if (specifier === "node:process") return { url: processUrl, shortCircuit: true };
        if (/fresh-installation-entry-v1\.[jt]s$/.test(specifier)) return { url: entryUrl, shortCircuit: true };
      }
      if (parent.includes("manual-test-admission-v1.") && parent.includes(`manual-fixture=${fixtureId}`)
        && /(?:^|\/)db-pg\.[jt]s$/.test(specifier)) return { url: faultUrl, shortCircuit: true };
      if (parent.includes("run-persistence.") && parent.includes(`manual-fixture=${fixtureId}`)
        && /manual-test-admission-v1\.[jt]s$/.test(specifier)) {
        return nextResolve(`${specifier}?manual-fixture=${fixtureId}${parent.includes("pre-worker") ? "&pre-worker" : ""}`, context);
      }
      return nextResolve(specifier, context);
    },
    load(url, context, nextLoad) {
      const loaded = nextLoad(url, context);
      if (!url.includes("/manual-test-admission-v1.") || !url.includes(`manual-fixture=${fixtureId}`)) return loaded;
      const source = typeof loaded.source === "string" ? loaded.source : new TextDecoder().decode(loaded.source!);
      const tree = ts.createSourceFile("observation-component.ts", source, ts.ScriptTarget.Latest, true);
      // These three complete observation functions alone receive immutable
      // component facts. Neither admission, persistence nor SQL is substituted.
      const replacements: Record<string, string> = {
        entryV1: `function entryV1(kind){if(kind!==${JSON.stringify(entryKind)})throw new Error('FIXTURE_ENTRY_REFUSED');return Object.freeze(${JSON.stringify(owner)})}`,
        processOwnerV1: `function processOwnerV1(pid,script,executable){const owner=Object.freeze(${JSON.stringify(owner)});if(pid!==owner.pid||script!==owner.script||executable!==owner.executable)throw new Error('FIXTURE_OS_OBSERVATION_UNKNOWN');return owner}`,
        psV1: `function psV1(args){if(JSON.stringify(args)!==JSON.stringify(['-ww','-axo','pid=,ppid=,pgid=,command=']))throw new Error('FIXTURE_PS_OBSERVATION_UNKNOWN');return ${JSON.stringify(url.includes("pre-worker") ? "" : `${owner.pid} ${process.ppid} ${owner.processGroupId} ${workerArgv.join(" ")}\n`)}}`,
      };
      const edits = tree.statements.filter(ts.isFunctionDeclaration).filter(node => node.name && replacements[node.name.text])
        .map(node => ({ start: node.getStart(tree), end: node.end, text: replacements[node.name!.text]! }));
      assert.equal(edits.length, 3);
      let changed = source;
      for (const edit of edits.sort((a, b) => b.start - a.start)) changed = changed.slice(0, edit.start) + edit.text + changed.slice(edit.end);
      return { ...loaded, source: changed };
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
  const db = await import("../../src/db-pg.js");
  t.after(async () => { await db.pgClose(); await database.cleanup(); });
  // The helper owns a query-suffixed client. Bind the real unsuffixed client
  // used by pgBegin and compiler continuations to that exact owned clone too.
  db.pgConfigureIsolatedTestDatabase(database.url);
  await db.initializeInternalProductionCurrentEntryDatabaseV1();
  const unsuffixedTs: typeof db = await import(new URL("../../src/db-pg.ts", import.meta.url).href);
  assert.equal(unsuffixedTs.getSql(), db.getSql());
  for (const sql of [database.sql, db.getSql()]) {
    const rows = await sql.unsafe<Array<{ database: string }>>("SELECT current_database() AS database");
    assert.equal(rows.length, 1); assert.equal(rows[0]!.database, database.database);
  }
  const suite = await loadConvergenceSuite(path.join(SOURCE_ROOT, "evals/suites/product-convergence-codex-v1.json"));
  const input = () => ({ jobId, kind: "convergence_full8" as const,
    selectionHash, sourceSha: SOURCE_SHA, suiteHash: suite.suiteHash });
  const nonce = "test_private_nonce_".repeat(4);
  let enrolled = false;
  async function enroll() {
    if (entryKind === "direct") {
      if (enrolled) return;
      const prepared = await manual.prepareSelectedDirectEvaluationIntentV1();
      jobId = prepared.jobId; assert.deepEqual(prepared, input()); enrolled = true; return;
    }
    if (!enrolled) {
      const jobDirectory = path.join(runtime, "mission-control", "controls", "jobs", jobId);
      mkdirSync(jobDirectory, { recursive: true, mode: 0o700 });
      const now = new Date().toISOString();
      writeFileSync(path.join(jobDirectory, "intent.json"), JSON.stringify({ schema: "mission-control.control-intent.v1",
        receipt: { schema: "mission-control.control-job.v1", ...input(), revision: 1, mcSourceSha: "c".repeat(40), mcBuildHash: "d".repeat(64),
          state: "accepted", requestedAt: now, startedAt: null, updatedAt: now, finishedAt: null, phase: "accepted", code: null,
          currentCaseId: null, ownedRunId: null, completedCases: 0, plannedCases: 8, reportRefs: {}, cancelRequested: false },
        installationDir: root, releaseDir: SOURCE_ROOT, nonceDigest: createHash("sha256").update(nonce).digest("hex"),
        fixedSuiteRelativePath: "evals/suites/product-convergence-codex-v1.json" }) + "\n", { mode: 0o600, flag: "wx" });
      enrolled = true;
    }
    await manual.registerSelectedManualWorkerCustodyV1({ schema: "mission-control.control-custody.v1", jobId, selectionHash, sourceSha: SOURCE_SHA,
      mcBuildHash: "d".repeat(64), nonce });
  }
  async function acquire() { await enroll(); return manual.acquireSelectedManualEvaluationV1(input()); }
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
  return { manual, persistence, database, db, root, evals, suite, input, ordinaryRunInput, revision, faults, restart, acquire, enroll, preWorkerManual: () => import(`${MANUAL_URL.href}?manual-fixture=${fixtureId}&pre-worker`) as Promise<typeof manual>, preWorkerPersistence: () => import(`${PERSISTENCE_URL.href}?manual-fixture=${fixtureId}&pre-worker`) as Promise<typeof persistence> };
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
  const held = await f.acquire();
  await assert.rejects(() => f.database.sql.begin(sql => f.persistence.persistWorkflowRunInTransaction(
    sql as PgTransactionSql, f.ordinaryRunInput)), /MANUAL_EVALUATION_RESERVED/);
  let downstreamAuthorityReads = 0;
  let fenceEntries = 0;
  const privateRecovery = exactPrivateRecoveryComponent({
    ...f.manual,
    async lockInternalProductionWorkflowRunInsertionFenceV1(sql: PgTransactionSql) {
      await f.db.lockInternalProductionWorkflowRunInsertionFenceV1(sql); fenceEntries += 1;
    },
    async lockInternalProductionRecoverySourceBootstrapRunInsertionFenceV1() {
      downstreamAuthorityReads += 1; throw new Error("UNUSABLE_RECOVERY_AUTHORITY");
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
    f.acquire(),
    f.acquire(),
  ]);
  const winners = results.filter(result => result.status === "fulfilled");
  assert.equal(winners.length, 1);
  assert.equal(results.filter(result => result.status === "rejected").length, 1);
  const held = winners[0]!.value;
  const restarted = await f.restart();
  const observed = await f.database.sql.begin(sql => restarted.observeSelectedManualEvaluationInTransactionV1(sql as PgTransactionSql));
  assert.equal(observed?.jobId, held.jobId);
  assert.equal(await f.revision(held.jobId), held.revision);
  await assert.rejects(() => f.acquire(), /MANUAL_EVALUATION_RESERVED|MANUAL_EVALUATION_OWNERSHIP_UNKNOWN/);
});

test("insertion-first holds the actual same-clone lock before evaluator readiness and refuses acquisition", async t => {
  const f = await fixture(t);
  let unlock!: () => void, locked!: () => void, failed!: (reason: unknown) => void;
  const atFence = new Promise<void>((resolve, reject) => { locked = resolve; failed = reject; });
  const hold = new Promise<void>(resolve => { unlock = resolve; });
  const beforeWorker = await f.preWorkerPersistence();
  let insertionPid = 0;
  const insertion = f.database.sql.begin(async sql => {
    insertionPid = Number((await sql.unsafe<Array<{ pid: number }>>("SELECT pg_backend_pid() AS pid"))[0]!.pid);
    await f.db.lockInternalProductionWorkflowRunInsertionFenceV1(sql as PgTransactionSql);
    const inserted = await beforeWorker.persistWorkflowRunInTransaction(sql as PgTransactionSql, f.ordinaryRunInput);
    locked(); await hold; return inserted;
  });
  void insertion.catch(failed);
  await atFence;
  f.faults.transactionBackendPid = null;
  const acquiring = f.acquire();
  const refused = assert.rejects(acquiring, /MANUAL_EVALUATION_ACTIVITY|MANUAL_EVALUATION_OWNERSHIP_UNKNOWN/);
  let blockingProven = false;
  try {
    const deadline = Date.now() + 10_000;
    while (Date.now() < deadline) {
      const pid: number | null = f.faults.transactionBackendPid;
      if (pid !== null) {
        assert.notEqual(pid, insertionPid);
        const rows: Array<{ blockers: number[]; database: string }> = await f.database.sql.unsafe<Array<{ blockers: number[]; database: string }>>(
          "SELECT pg_blocking_pids($1) AS blockers,current_database() AS database", [pid]);
        assert.equal(rows[0]!.database, f.database.database);
        if (rows[0]!.blockers.includes(insertionPid)) { blockingProven = true; break; }
      }
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    assert.equal(blockingProven, true, "actual acquirer backend must wait on the held insertion backend");
  } finally {
    unlock();
    await Promise.allSettled([insertion, refused]);
  }
  const inserted = await insertion; await refused;
  assert.equal(inserted.run.id, f.ordinaryRunInput.run.id);
});

test("canonical compiler fixture exposes real live run claim and runtime activity to acquisition", async t => {
  const f = await fixture(t);
  const runId = randomUUID();
  const fixtureRun = await seedCanonicalSetupBuildCompilerStoryAdmissionFixture(f.database, {
    runId, repo: path.join(f.root, "compiler-project"), setupBuildStepDbId: `${runId}-setup-build`,
    setupBuildClaimAgentId: "feature-dev_setup-build", releaseSha: SOURCE_SHA,
  });
  assert.ok(fixtureRun.claimId > 0);
  await assert.rejects(() => f.acquire(),
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
    await assert.rejects(() => f.acquire(),
      /MANUAL_EVALUATION_ACTIVITY|MANUAL_EVALUATION_OWNERSHIP_UNKNOWN/, status);
    assert.equal(existsSync(path.join(f.evals, "manual-controls", "reservation.json")), false,
      "failed readiness must not create a reservation; the enrolled worker remains owned");
    // Fixture-only rows in this exact private DB, never canonical live owners.
    await f.database.sql`DELETE FROM runs WHERE id=${runId}`;
  }
});

test("complete activity census refuses every nonzero family and missing invalid or negative observations", async t => {
  const f = await fixture(t);
  const families = [
    "active_runs", "open_claims", "active_attempts", "active_attempt_binding_conflicts",
    "active_runtimes", "active_runtime_completions", "active_completion_effects", "active_recovery_cases",
    "active_recovery_deliveries", "active_termination_requests", "active_compilations",
    "active_publications", "active_publication_batches", "active_outbox", "active_operational_deliveries", "active_owner_reservations",
  ];
  for (const family of families) {
    for (const value of [1, undefined, -1, 0.5, "0", null]) {
      f.faults.censusOverlay = { [family]: value };
      await assert.rejects(() => f.acquire(),
        /MANUAL_EVALUATION_ACTIVITY|MANUAL_EVALUATION_OWNERSHIP_UNKNOWN/,
        `${family}:${String(value)}`);
      assert.equal(existsSync(path.join(f.evals, "manual-controls", "reservation.json")), false);
    }
  }
  f.faults.censusOverlay = null;
});

test("rollback after durable publication retains a pending or unknown reservation across module restart", async t => {
  const f = await fixture(t);
  const input = f.input();
  f.faults.rollbackAfterCallback = true;
  await assert.rejects(() => f.acquire(), /INJECTED_MANUAL_TRANSACTION_ROLLBACK|MANUAL_EVALUATION_OWNERSHIP_UNKNOWN/);
  f.faults.rollbackAfterCallback = false;
  const restarted = await f.restart();
  const observed = await f.database.sql.begin(sql => restarted.observeSelectedManualEvaluationInTransactionV1(sql as PgTransactionSql));
  assert.ok(observed);
  assert.equal(observed.jobId, input.jobId);
  assert.ok(["pending", "ownership_unknown"].includes(observed.phase));
  assert.equal(await f.revision(input.jobId), observed.revision);
  await assert.rejects(() => restarted.acquireSelectedManualEvaluationV1(f.input()), /MANUAL_EVALUATION_RESERVED|MANUAL_EVALUATION_OWNERSHIP_UNKNOWN|MANUAL_EVALUATION_CUSTODY_REQUIRED/);
  await assert.rejects(() => f.database.sql.begin(sql => f.persistence.persistWorkflowRunInTransaction(sql as PgTransactionSql, f.ordinaryRunInput)),
    /MANUAL_EVALUATION_RESERVED|MANUAL_EVALUATION_OWNERSHIP_UNKNOWN/);
  await assert.rejects(() => restarted.releaseSelectedManualEvaluationV1(observed));
  await assert.rejects(() => f.manual.closeSelectedManualWorkerCustodyV1());
  assert.equal(existsSync(path.join(f.evals, "manual-controls", "closures", input.jobId + ".json")), false);
  assert.equal(await f.revision(input.jobId), observed.revision);
});

test("exact stored canary admits once and canonical terminal settlement remains usable under reservation", async t => {
  const f = await fixture(t);
  const held = await f.acquire();
  const entry = f.suite.suite.cases[0]!;
  const repository = createV3ReleaseAdmissionRepository(f.database.sql, new ContentAddressedEvalResultStore(path.join(f.evals, "results")));
  const canary = await repository.createCanary({
    releaseSha: SOURCE_SHA, suiteHash: f.suite.suiteHash, preflightHash: "d".repeat(64), ttlMs: 60_000,
    slots: [{ caseHash: convergenceCaseHash(entry), taskHash: hashCanonicalJson(entry.task), repetition: 1, slotToken: "test_private_selector_".repeat(3) }],
  });
  const context = canary.contexts[0]!;
  assert.equal(context.repetition, 1);
  const bound = await f.manual.bindSelectedManualCanaryV1({ reservation: held, admissionHash: canary.admission.admissionHash,
    slots: [{ admissionHash: context.admissionHash, slotHash: context.slotHash, caseHash: context.caseHash, taskHash: context.taskHash, repetition: 1 }] });
  await assert.rejects(() => f.manual.bindSelectedManualCanaryV1({ reservation: held,
    admissionHash: canary.admission.admissionHash,
    slots: [{ admissionHash: context.admissionHash, slotHash: context.slotHash, caseHash: context.caseHash, taskHash: context.taskHash, repetition: 1 }] }),
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
  await assert.rejects(() => f.manual.releaseSelectedManualEvaluationV1(bound), /MANUAL_EVALUATION_ACTIVITY/);
  const terminal = await import("../../src/execution/run-terminal-transition.js");
  await terminal.transitionRunToTerminal(f.database.sql, {
    runId: inserted.run.id, status: "failed", diagnostic: "Manual admission isolated pre-claim test",
    terminalFailure: true, unclaimedBootstrapFailure: true,
  });
  const current = await f.database.sql.begin(sql => f.manual.observeSelectedManualEvaluationInTransactionV1(sql as PgTransactionSql));
  assert.ok(current);
  await assert.rejects(() => f.database.sql.begin(sql => f.persistence.persistWorkflowRunInTransaction(sql as PgTransactionSql,
    { ...input, run: { ...input.run, id: randomUUID(), runNumber: 8102 } })), /CANARY|MANUAL_EVALUATION/);
  await assert.rejects(() => f.manual.releaseSelectedManualEvaluationV1(current), /MANUAL_EVALUATION_ACTIVITY/);
  // Canonical terminal SQL creates real outbox work. Drain only this pristine
  // owned fixture through its existing repositories; do not zero the census.
  const { createOperationalOutboxRepository } = await import("../../src/execution/operational-outbox-repository.js");
  const { createOperationalEventDeliveryRepository } = await import("../../src/execution/operational-event-delivery-repository.js");
  const outbox = createOperationalOutboxRepository(f.database.sql), deliveries = createOperationalEventDeliveryRepository(f.database.sql);
  const ownerInstanceId = "manual-admission-owned-fixture";
  for (let count = 0; ; count++) {
    assert.ok(count < 20);
    const item = await outbox.claimNext({ ownerInstanceId }); if (!item) break;
    await outbox.publish({ outboxId: item.outboxId, ownerInstanceId, leaseToken: item.leaseToken! });
  }
  for (const consumer of ["jsonl", "webhook"] as const) for (let count = 0; ; count++) {
    assert.ok(count < 40);
    const item = await deliveries.claimNext({ consumer, ownerInstanceId }); if (!item) break;
    await deliveries.settle({ eventKey: item.eventKey, consumer, ownerInstanceId, leaseToken: item.leaseToken!, outcome: "skipped", result: { reason: "private test fixture has no external consumer" } });
  }
  await f.manual.releaseSelectedManualEvaluationV1(current);
  // The immutable enrolled-worker snapshot still observes that process alive;
  // release is recorded, but public owner observation may not pretend it exited.
  assert.equal(await f.manual.observeSelectedEvaluatorOwnersV1(), "owned");
  assert.equal(await f.revision(current.jobId), current.revision + 1);
});

test("a bound canary that expires before insertion cannot consume its real stored claim", async t => {
  const f = await fixture(t);
  const held = await f.acquire();
  const entry = f.suite.suite.cases[0]!;
  const repository = createV3ReleaseAdmissionRepository(f.database.sql, new ContentAddressedEvalResultStore(path.join(f.evals, "results")));
  const canary = await repository.createCanary({ releaseSha: SOURCE_SHA,
    suiteHash: f.suite.suiteHash, preflightHash: "d".repeat(64), ttlMs: 1000,
    slots: [{ caseHash: convergenceCaseHash(entry), taskHash: hashCanonicalJson(entry.task), repetition: 1, slotToken: "expiry_private_selector_".repeat(3) }],
  });
  const context = canary.contexts[0]!;
  assert.equal(context.repetition, 1);
  await f.manual.bindSelectedManualCanaryV1({ reservation: held, admissionHash: context.admissionHash,
    slots: [{ admissionHash: context.admissionHash, slotHash: context.slotHash, caseHash: context.caseHash, taskHash: context.taskHash, repetition: 1 }] });
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


test("certain busy-owner refusal closes only the uninterrupted never-reserved intent", async t => {
  const f = await fixture(t), foreignId = randomUUID();
  await f.database.insertRun(foreignId);
  await assert.rejects(() => f.acquire(), /MANUAL_EVALUATION_ACTIVITY/);
  await f.manual.closeSelectedManualWorkerCustodyV1();
  const marker = JSON.parse(readFileSync(path.join(f.evals, "manual-controls", "closures", `${f.input().jobId}.json`), "utf8"));
  assert.deepEqual(marker.closure, { kind: "never_reserved" });
  assert.equal(marker.owner.source, "observed_os");
  assert.equal(existsSync(path.join(f.evals, "manual-controls", "reservation.json")), false);
  assert.equal((await f.database.sql`SELECT status FROM runs WHERE id=${foreignId}`)[0]?.status, "running");
  assert.equal(await f.manual.observeSelectedEvaluatorOwnersV1(), "owned", "a closure never hides the live enrolled worker");
  await f.manual.closeSelectedManualWorkerCustodyV1();
  await assert.rejects(() => f.acquire());
  const restarted = await f.restart();
  await assert.rejects(() => restarted.closeSelectedManualWorkerCustodyV1(), /MANUAL_EVALUATION_CUSTODY_REQUIRED/);
  const absentWorker = await f.preWorkerManual();
  assert.equal(await absentWorker.observeSelectedEvaluatorOwnersV1(), "none", "stable closure survives process exit without granting new custody");
});

test("held reservation cannot close before exact release and marker binds the retained released revision", async t => {
  const f = await fixture(t), held = await f.acquire();
  await assert.rejects(() => f.manual.closeSelectedManualWorkerCustodyV1(), /MANUAL_EVALUATION_RELEASE_REQUIRED/);
  await f.manual.releaseSelectedManualEvaluationV1(held);
  await f.manual.closeSelectedManualWorkerCustodyV1();
  const locator = path.join(f.evals, "manual-controls", "closures", `${held.jobId}.json`);
  const marker = JSON.parse(readFileSync(locator, "utf8"));
  assert.equal(marker.closure.kind, "reservation_released");
  assert.equal(marker.closure.revision, held.revision + 1);
  const archived = readFileSync(path.join(f.evals, "manual-controls", "revisions", `${String(marker.closure.revision).padStart(20, "0")}.json`));
  assert.equal(marker.closure.recordHash, createHash("sha256").update(archived).digest("hex"));
  await f.manual.closeSelectedManualWorkerCustodyV1();
  await assert.rejects(() => f.manual.releaseSelectedManualEvaluationV1(held));
  await assert.rejects(() => f.acquire());
  chmodSync(locator, 0o644);
  assert.equal(await (await f.preWorkerManual()).observeSelectedEvaluatorOwnersV1(), "unknown");
  await assert.rejects(() => f.manual.closeSelectedManualWorkerCustodyV1());
});

test("closure rollback and missing reservation history remain unknown without marker adoption", async t => {
  const f = await fixture(t);
  await f.enroll();
  f.faults.rollbackAfterCallback = true;
  await assert.rejects(() => f.manual.closeSelectedManualWorkerCustodyV1(), /INJECTED_MANUAL_TRANSACTION_ROLLBACK/);
  f.faults.rollbackAfterCallback = false;
  assert.ok(existsSync(path.join(f.evals, "manual-controls", "mutation.json")));
  assert.ok(existsSync(path.join(f.evals, "manual-controls", "closures", `${f.input().jobId}.json`)));
  assert.equal(await (await f.preWorkerManual()).observeSelectedEvaluatorOwnersV1(), "unknown");
  await assert.rejects(() => f.manual.closeSelectedManualWorkerCustodyV1());
  await assert.rejects(() => f.acquire());
});

test("an abandoned SF intent stays unknown while a strict UI fixture intent is separate", async t => {
  const f = await fixture(t); await f.enroll();
  const observer = await f.preWorkerManual();
  assert.equal(await observer.observeSelectedEvaluatorOwnersV1(), "unknown");
  const locator = path.join(f.root, "runtime", "mission-control", "controls", "jobs", f.input().jobId, "intent.json");
  const intent = JSON.parse(readFileSync(locator, "utf8"));
  // Deliberate negative/alternate-kind fixture mutation; no registered custody
  // may survive or adopt it, and production never performs this rewrite.
  intent.receipt.kind = "ui_regression"; intent.receipt.suiteHash = null; intent.receipt.plannedCases = 0; intent.fixedSuiteRelativePath = null;
  writeFileSync(locator, JSON.stringify(intent) + "\n");
  assert.equal(await observer.observeSelectedEvaluatorOwnersV1(), "none");
  await assert.rejects(() => f.manual.closeSelectedManualWorkerCustodyV1());
  intent.receipt.privateNonce = "forbidden"; writeFileSync(locator, JSON.stringify(intent) + "\n");
  assert.equal(await observer.observeSelectedEvaluatorOwnersV1(), "unknown");
});

test("missing or renamed retained revision forbids release and custody closure", async t => {
  const f = await fixture(t), held = await f.acquire();
  const directory = path.join(f.evals, "manual-controls", "revisions");
  renameSync(path.join(directory, "00000000000000000001.json"), path.join(directory, "retained-corrupt-name.json"));
  assert.equal(await f.manual.observeSelectedEvaluatorOwnersV1(), "unknown");
  await assert.rejects(() => f.manual.releaseSelectedManualEvaluationV1(held));
  await assert.rejects(() => f.manual.closeSelectedManualWorkerCustodyV1());
  assert.equal(existsSync(path.join(f.evals, "manual-controls", "closures", `${held.jobId}.json`)), false);
});


test("selected direct planning enrolls its own intent and uses common release and closure without MC fields", async t => {
  const f = await fixture(t, "direct"), held = await f.acquire();
  const intent = JSON.parse(readFileSync(path.join(f.evals, "manual-controls", "direct", `${held.jobId}.json`), "utf8"));
  assert.equal(intent.executionMode, "preflight");
  assert.equal(intent.mcBuildHash, undefined);
  await assert.rejects(() => f.manual.bindSelectedManualCanaryV1({ reservation: held, admissionHash: "a".repeat(64), slots: [] }), /MANUAL_EVALUATION_CANARY_REFUSED/);
  await f.manual.releaseSelectedManualEvaluationV1(held);
  await f.manual.closeSelectedManualWorkerCustodyV1();
  const marker = JSON.parse(readFileSync(path.join(f.evals, "manual-controls", "closures", `${held.jobId}.json`), "utf8"));
  assert.equal(marker.intentOrigin, "direct"); assert.equal(marker.executionMode, "preflight");
  assert.equal(marker.closure.kind, "reservation_released");
  assert.equal(existsSync(path.join(f.evals, "manual-controls", "direct", `${held.jobId}.released`)), false);
  assert.equal(await (await f.preWorkerManual()).observeSelectedEvaluatorOwnersV1(), "none");
});

test("later canary binds preserve earlier slots and missing cumulative history refuses release", async t => {
  const f = await fixture(t); let held = await f.acquire();
  const repository = createV3ReleaseAdmissionRepository(f.database.sql, new ContentAddressedEvalResultStore(path.join(f.evals, "results")));
  const hashes: string[] = [];
  for (const entry of f.suite.suite.cases.slice(0, 2)) {
    const created = await repository.createCanary({ releaseSha: SOURCE_SHA, suiteHash: f.suite.suiteHash,
      preflightHash: "d".repeat(64), ttlMs: 60_000,
      slots: [{ caseHash: convergenceCaseHash(entry), taskHash: hashCanonicalJson(entry.task), repetition: 1, slotToken: randomUUID() + randomUUID() }] });
    const context = created.contexts[0]!; hashes.push(context.slotHash);
    held = await f.manual.bindSelectedManualCanaryV1({ reservation: held, admissionHash: context.admissionHash,
      slots: [{ admissionHash: context.admissionHash, slotHash: context.slotHash, caseHash: context.caseHash, taskHash: context.taskHash, repetition: 1 }] });
  }
  const head = path.join(f.evals, "manual-controls", "reservation.json"), record = JSON.parse(readFileSync(head, "utf8"));
  assert.deepEqual(record.slots.map((slot: { slotHash: string }) => slot.slotHash), hashes);
  record.slots = record.slots.slice(1);
  const corrupted = JSON.stringify(record) + "\n";
  writeFileSync(head, corrupted);
  writeFileSync(path.join(f.evals, "manual-controls", "revisions", `${String(held.revision).padStart(20, "0")}.json`), corrupted);
  await assert.rejects(() => f.manual.releaseSelectedManualEvaluationV1(held));
  await assert.rejects(() => f.manual.closeSelectedManualWorkerCustodyV1());
  assert.equal(await f.manual.observeSelectedEvaluatorOwnersV1(), "unknown");
});

test("terminal status without the actual canonical closed run owner cannot release custody", async t => {
  const f = await fixture(t); let held = await f.acquire();
  const entry = f.suite.suite.cases[0]!;
  const repository = createV3ReleaseAdmissionRepository(f.database.sql, new ContentAddressedEvalResultStore(path.join(f.evals, "results")));
  const created = await repository.createCanary({ releaseSha: SOURCE_SHA, suiteHash: f.suite.suiteHash, preflightHash: "d".repeat(64), ttlMs: 60_000,
    slots: [{ caseHash: convergenceCaseHash(entry), taskHash: hashCanonicalJson(entry.task), repetition: 1, slotToken: randomUUID() + randomUUID() }] });
  const context = created.contexts[0]!;
  held = await f.manual.bindSelectedManualCanaryV1({ reservation: held, admissionHash: context.admissionHash,
    slots: [{ admissionHash: context.admissionHash, slotHash: context.slotHash, caseHash: context.caseHash, taskHash: context.taskHash, repetition: 1 }] });
  const input = { ...f.ordinaryRunInput, run: { ...f.ordinaryRunInput.run, protocol: { ...f.ordinaryRunInput.run.protocol,
    releaseAdmissionKind: "convergence_canary" as const, releaseAdmissionHash: context.admissionHash, canaryAdmission: context } } };
  await f.database.sql.begin(sql => f.persistence.persistWorkflowRunInTransaction(sql as PgTransactionSql, input));
  // Private negative fixture: a status write supplies no terminal lifecycle or
  // owner-close authority. It must not make this run releasable.
  await f.database.sql`UPDATE runs SET status='failed' WHERE id=${input.run.id}`;
  const owners = await f.database.sql`SELECT state FROM internal_production_owner_reservations_v1 WHERE category='run' AND owner_key=${input.run.id}`;
  assert.equal(owners[0]?.state, "bound");
  await assert.rejects(() => f.manual.releaseSelectedManualEvaluationV1(held), /MANUAL_EVALUATION_ACTIVITY|MANUAL_EVALUATION_CANONICAL/);
  await assert.rejects(() => f.manual.closeSelectedManualWorkerCustodyV1(), /MANUAL_EVALUATION_RELEASE_REQUIRED/);
});
