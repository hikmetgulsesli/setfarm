import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { test } from "node:test";
import {
  ContractSpineMigrationError,
  contractSpinePre32SourceJournalIdentitiesV1,
} from "../../src/db/contract-spine-migrations.js";
import { canonicalOperationalFailureCauseAuthorityV3ConstraintIdentity }
  from "../../src/db/operational-failure-cause-authority-v3-migration.js";
import * as censusModule from "../../src/internal-production/baseline-legacy-database-census-v1.js";
import { parseTask6aPostgresSocketTransportV1, buildTask6aPostgresSocketOptionsV1 }
  from "../../src/internal-production/task6a-postgres-socket-transport-v1.js";

// External PG/schema boundaries are controlled here; the real new retained
// composition, existing deadline and SQL facades execute. The actual protected
// opt-in fixture, not these boundaries, must prove complete schema/audit truth.
function fixture(options: { unlock?: boolean; coreError?: Error; rollbackError?: Error;
  canonicalFailures?: readonly [Error, Error]; parallel?: {
    primary: Error; lateError?: Error; gate: Promise<void>; entered: () => void;
  } } = {}) {
  const source = fs.readFileSync(new URL("../../src/db/contract-spine-migrations.ts", import.meta.url), "utf8");
  const ast = ts.createSourceFile("migration.ts", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const names = ["currentAuthorityAuditDeadline", "remainingCurrentAuthorityAuditMilliseconds",
    "currentAuthorityAuditTimeout", "boundedCurrentAuthorityAuditResult",
    "currentAuthorityAuditV31ReservedFacade", "currentAuthorityAuditTransactionFacade",
    "currentAuthorityAuditAlreadySessionLockedTransactionFacade", "assertCurrentAuthorityAuditAtV31Head",
    "withHeldContractSpineV31DiagnosticV2"];
  const functions = names.map(name => ast.statements.find(statement => ts.isFunctionDeclaration(statement)
    && statement.name?.text === name));
  assert.ok(functions.at(-1), "held V31 composition is missing");
  assert.ok(functions.every(Boolean), "existing audit boundary declaration missing");
  const events: string[] = [];
  let canonicalDrops = 0;
  let parallelConfigurations = 0;
  const normalize = (text: string) => text.replace(/\s+/g, " ").trim().toLowerCase();
  const session = {
    unsafe: async (statement: string, parameters?: readonly unknown[]) => {
      const query = normalize(statement);
      events.push(query);
      if (options.parallel && events.includes("full-v31-core")) {
        if (query === "select failed branch") throw options.parallel.primary;
        if (query === "select set_config('statement_timeout', $1, true)"
          && ++parallelConfigurations === 2) {
          options.parallel.entered(); await options.parallel.gate;
          if (options.parallel.lateError) throw options.parallel.lateError;
        }
      }
      if (options.canonicalFailures) {
        if (query.startsWith("drop table if exists pg_temp.setfarm_operational_failure_cause_v3_canonical_identity_v3")) {
          if (++canonicalDrops === 2) throw options.canonicalFailures[1];
        }
        if (query.includes("from pg_constraint")) throw options.canonicalFailures[0];
      }
      if (query === "rollback" && options.rollbackError) throw options.rollbackError;
      if (query.includes("pg_advisory_unlock")) return [{ unlocked: options.unlock ?? true }];
      if (query.includes("from public.setfarm_schema_migrations")) {
        return contractSpinePre32SourceJournalIdentitiesV1().map(row => ({ ...row, state: "applied" }));
      }
      if (query.includes("pg_advisory_lock")) assert.deepEqual(Array.from(parameters ?? []), [1397117251]);
      return [];
    },
    reserve: () => { throw new Error("a second reservation is forbidden"); },
    release: () => { throw new Error("caller reservation must remain owned by caller"); },
    begin: () => { throw new Error("driver-owned automatic transaction is forbidden"); },
    end: () => { throw new Error("caller client must remain owned by caller"); },
  };
  const context = vm.createContext({ process, Object, Number, Math, Array, Promise, Error, AggregateError,
    ContractSpineMigrationError, contractSpineMigrationLockKey: 1397117251, normalizeSql: normalize,
    verifyOperationalFailureCauseAuthorityV3Constraint: async (sql: typeof session) => {
      events.push("source-v3-verification");
      await sql.unsafe("CREATE TEMP TABLE retained_boundary_probe(id integer)");
      await sql.unsafe("DROP TABLE retained_boundary_probe");
    },
    canonicalOperationalFailureCauseAuthorityV3ConstraintIdentity: options.canonicalFailures
      ? canonicalOperationalFailureCauseAuthorityV3ConstraintIdentity : async () => {
      events.push("source-canonical-identity"); return Object.freeze({ validated: true, expression: "canonical source" });
    },
    auditCurrentAuthorityAtV31OnTransaction: async (_sql: any, _deadline: unknown, identity: unknown) => {
      events.push("full-v31-core");
      assert.deepEqual(identity, { validated: true, expression: "canonical source" });
      if (options.coreError) throw options.coreError;
      if (options.parallel) await Promise.all([
        _sql.unsafe("SELECT failed branch"), _sql.unsafe("SELECT late branch"),
      ]);
      return Object.freeze({ headVersion: 31,
        artifactPublicationAuthorityLedger: Object.freeze({ productionAuthority: false, marker: "artifact" }),
        platformReleaseStoreRecordLedger: Object.freeze({ productionAuthority: false, marker: "platform" }),
        v3StoryClaimRuntimeBinding: Object.freeze({ productionAuthority: false, marker: "binding" }) });
    },
  });
  const registry = ast.statements.filter(statement => ts.isVariableStatement(statement)
    && statement.declarationList.declarations.some(declaration => ts.isIdentifier(declaration.name)
      && declaration.name.text === "task6aUsedHeldV31SessionsV2"));
  const bodies = [...registry, ...functions].map(node => node!.getText(ast).replace(/^export /, "")).join("\n");
  vm.runInContext(ts.transpileModule(bodies, { compilerOptions: { target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.None } }).outputText, context);
  return { events, session, invoke: context.withHeldContractSpineV31DiagnosticV2 as
    (sql: unknown, operation: (audit: any) => Promise<unknown>) => Promise<unknown> };
}

test("held V31 keeps its caller backend and lock through the continuation", async () => {
  // Moving COMMIT/unlock/release ahead of this continuation must fail.
  const { events, session, invoke } = fixture();
  const result = await invoke(session, async audit => {
    assert.equal(audit.productionAuthority, false);
    assert.equal(audit.productionAdmission, "forbidden");
    assert.equal(audit.artifactPublicationAuthorityLedger.marker, "artifact");
    assert.equal(audit.platformReleaseStoreRecordLedger.marker, "platform");
    assert.equal(audit.v3StoryClaimRuntimeBinding.marker, "binding");
    assert.equal(events.some(item => /^(commit|rollback)$|pg_advisory_unlock/.test(item)), false);
    assert.ok(events.indexOf("source-v3-verification") < events.indexOf("begin isolation level repeatable read read only"));
    assert.ok(events.indexOf("source-canonical-identity") < events.indexOf("full-v31-core"));
    assert.ok(events.includes("full-v31-core"));
    events.push("retained-continuation");
    return "actual continuation result";
  });
  assert.equal(result, "actual continuation result");
  assert.ok(events.indexOf("rollback") > events.indexOf("retained-continuation"));
  assert.ok(events.findIndex(item => item.includes("pg_advisory_unlock")) > events.indexOf("rollback"));
});

test("held V31 refuses failed full audit without yielding its continuation", async () => {
  // Returning a default positive result or swallowing the core failure must fail.
  const primary = new Error("full core refused");
  const { events, session, invoke } = fixture({ coreError: primary });
  let yielded = false;
  await assert.rejects(invoke(session, async () => { yielded = true; }), error => error === primary);
  assert.equal(yielded, false);
  assert.ok(events.includes("rollback"));
  assert.ok(events.some(item => item.includes("pg_advisory_unlock")));
});

test("held V31 preserves callback and cleanup errors instead of reporting success", async () => {
  // Swallowing unlock failure, or replacing the primary callback error, must fail.
  const primary = new Error("continuation failed");
  const { session, invoke } = fixture({ unlock: false });
  await assert.rejects(invoke(session, async () => { throw primary; }), error => {
    assert.ok(error instanceof AggregateError);
    assert.equal(error.errors[0], primary);
    assert.ok(error.errors.length >= 2);
    return true;
  });
});

test("held V31 cannot reuse its session object after a completed diagnostic", async () => {
  // Omitting irreversible one-use admission can reacquire the same session lock.
  const { events, session, invoke } = fixture();
  await invoke(session, async () => "first");
  const settled = events.length;
  await assert.rejects(invoke(session, async () => "forbidden second"), /TASK6A_HELD_V31_DIAGNOSTIC_REFUSED/);
  assert.equal(events.length, settled, "refusal must precede another setup/lock/TEMP effect");
});

test("held V31 rejects a concurrent invocation before reacquiring its session lock", async () => {
  // Admission must burn before the first await, not after the core completes.
  const { events, session, invoke } = fixture();
  let ready!: () => void, finish!: () => void;
  const entered = new Promise<void>(resolve => { ready = resolve; });
  const continuation = new Promise<void>(resolve => { finish = resolve; });
  const first = invoke(session, async () => { ready(); await continuation; });
  try {
    await entered;
    const before = events.length;
    await assert.rejects(invoke(session, async () => "concurrent effect"), /TASK6A_HELD_V31_DIAGNOSTIC_REFUSED/);
    assert.equal(events.length, before);
  } finally { finish(); await first; }
});

test("held V31 skips unlock/reset after failed rollback and preserves both errors", async () => {
  // Unknown transaction disposition must not be presented as restored/reusable.
  const primary = new Error("callback refused"), rollback = new Error("rollback unknown");
  const { events, session, invoke } = fixture({ rollbackError: rollback });
  await assert.rejects(invoke(session, async () => { throw primary; }), error => {
    assert.ok(error instanceof AggregateError);
    assert.deepEqual(error.errors, [primary, rollback]); return true;
  });
  assert.equal(events.some(item => item.includes("pg_advisory_unlock") || item.startsWith("reset ")), false);
});

test("held V31 retains actual canonical SELECT failure masked by its TEMP finally DROP", async () => {
  // The unchanged real canonical helper's finally masks the first driver error.
  // A tracked boundary must preserve both rather than change the frozen helper.
  const primary = new Error("canonical SELECT failed"), drop = new Error("TEMP DROP failed");
  const { session, invoke } = fixture({ canonicalFailures: [primary, drop] });
  let yielded = false;
  await assert.rejects(invoke(session, async () => { yielded = true; }), error => {
    assert.ok(error instanceof AggregateError);
    assert.deepEqual(error.errors, [primary, drop]); return true;
  });
  assert.equal(yielded, false);
});

for (const lateFails of [false, true]) test(`held V31 drains concurrent facade work before cleanup (${lateFails ? "late failure" : "late settlement"})`, async () => {
  // Fail-fast Promise.all must not allow a delayed sibling to issue a read
  // after rollback/reset or lose its later distinct driver failure.
  const primary = new Error("parallel primary"), lateError = new Error("parallel late setup");
  let enter!: () => void, release!: () => void;
  const entered = new Promise<void>(resolve => { enter = resolve; });
  const gate = new Promise<void>(resolve => { release = resolve; });
  const { session, events, invoke } = fixture({ parallel: {
    primary, ...(lateFails ? { lateError } : {}), gate, entered: enter,
  } });
  let settled = false, yielded = false;
  const pending = invoke(session, async () => { yielded = true; }).then(
    value => { settled = true; return { value }; }, error => { settled = true; return { error }; });
  try {
    await entered;
    await new Promise<void>(resolve => setImmediate(resolve));
    assert.equal(settled, false, "must retain session until in-flight driver work settles");
    assert.equal(events.includes("rollback"), false, "rollback must not race in-flight setup");
  } finally { release(); }
  const result = await pending;
  assert.equal(yielded, false);
  assert.equal(events.includes("select late branch"), false);
  assert.ok(events.includes("rollback"));
  assert.ok("error" in result);
  if (lateFails) {
    assert.ok(result.error instanceof AggregateError);
    assert.deepEqual(result.error.errors, [primary, lateError]);
  } else assert.equal(result.error, primary);
});

function censusFixture(coldCount = "0", activeRunCount = "0") {
  const queries: string[] = [];
  const connection = async (parts: TemplateStringsArray) => {
    const query = parts.join("?").replace(/\s+/g, " ").trim();
    queries.push(query);
    if (query.includes("WITH expected_tables")) return [{ laterJournalCount: coldCount,
      relationCount: "0", functionCount: "0", typeCount: "0", triggerCount: "0" }];
    if (query.includes("WITH required_columns")) return [{ catalogViolationCount: "0",
      aprbChildViolationCount: "0", ordinaryBatchViolationCount: "0", activeHeaderViolationCount: "0",
      ownerReservationsRelation: null, ownerAdmissionHeadRelation: null, producerSourceRelation: null,
      producerActivationRelation: null, producerActivationHeadRelation: null, producerCurrentRelation: null,
      activeRunCount, openClaimCount: "0", executionAttemptCount: "0", activeRuntimeSessionCount: "0",
      activeCompletionOwnerCount: "0", unsettledMandatoryEffectCount: "0", artifactReservationCount: "0",
      publicationBatchCount: "0", artifactPublicationCount: "0", terminationOwnerCount: "0",
      findingOwnerCount: "0", recoveryOwnerCount: "0", operationalDeliveryCount: "0" }];
    if (/FROM public\.(finding_sets|findings|runs)/.test(query)) return [];
    throw new Error(`unexpected held census query: ${query}`);
  };
  const invoke = (censusModule as any).observeHeldColdPre32LegacyDatabaseCensusV2;
  assert.equal(typeof invoke, "function", "connection-neutral held cold census is missing");
  return { connection, queries, invoke: invoke as (connection: unknown) => Promise<Record<string, any>> };
}

test("held cold census observes existing inventory on the caller connection without lifecycle effects", async () => {
  // Reopening a URL/transaction, omitting cold absence or returning default
  // counts instead of executing the actual shared body must fail.
  const { connection, queries, invoke } = censusFixture();
  const result = await invoke(connection);
  assert.equal(result.activeRunCount, 0);
  assert.equal(result.openClaimCount, 0);
  assert.equal(result.findingOwnerCount, 0);
  assert.ok(Object.isFrozen(result));
  assert.ok(Object.isFrozen(result.legacyFindingPublicationInventory));
  assert.equal(queries.length, 5);
  assert.ok(queries[0]!.includes("WHERE version >= 32"));
  assert.ok(queries[1]!.includes("catalog_violations"));
  assert.ok(queries[2]!.includes("FROM public.finding_sets"));
  assert.ok(queries[3]!.includes("FROM public.findings"));
  assert.ok(queries[4]!.includes("FROM public.runs"));
  assert.equal(queries.some(query => /BEGIN|COMMIT|ROLLBACK|CREATE|DROP|LOCK TABLE/.test(query)), false);
});

test("held cold census refuses later journal before any logical census", async () => {
  // Turning cold absence into optional/default success must fail.
  const { connection, queries, invoke } = censusFixture("1");
  await assert.rejects(invoke(connection), /cold bootstrap migration32\/33 catalog or journal is not absent/);
  assert.equal(queries.length, 1);
});

test("held cold census refuses actual nonzero ownership", async () => {
  // Returning a zero/default result despite the actual aggregate must fail.
  const { connection, invoke } = censusFixture("0", "1");
  await assert.rejects(invoke(connection), /activeRunCount is nonzero/);
});

function privateFixture(pending?: { phase: string; gate: Promise<void>; entered: () => void }) {
  const file = new URL("../../src/internal-production/task6a-held-pg31-diagnostic-v2.ts", import.meta.url);
  assert.ok(fs.existsSync(file), "bounded private held diagnostic is missing");
  const source = fs.readFileSync(file, "utf8");
  const ast = ts.createSourceFile("held.ts", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const code = ast.statements.filter(statement => !ts.isImportDeclaration(statement))
    .map(statement => statement.getText(ast).replace(/^export /, "")).join("\n");
  const events: string[] = [];
  const state = { allocations: 0, revoked: false, physicalClosed: false,
    physicalBad: false, otherCount: "0", backendStart: "2026-09-30 01:02:03+00",
    currentRole: "task6a_runtime", now: 0, cachedOther: "0", readsWithoutClear: 0, parallel: false,
    coreFailure: undefined as Error | undefined, aborted: false, physicalAdvance: 0, holdAdvance: 0,
    holdRecheck: false, pendingFailure: new Error("distinct disposed recheck query") };
  let expire: (() => void) | undefined;
  let cleared = false;
  let pendingEntered = false, disposal!: () => void;
  const disposedSignal = new Promise<void>(resolve => { disposal = resolve; });
  const hold = async (phase: string) => {
    if (pending && !pendingEntered && phase.includes(pending.phase)) {
      pendingEntered = true; pending.entered();
      if (pending.phase === "close") await pending.gate;
      else await Promise.race([pending.gate, disposedSignal.then(() => { throw state.pendingFailure; })]);
    }
  };
  const candidate = { schema: "setfarm.postgres-socket-transport.v1",
    socketDirectory: "/private/tmp/setfarm-task6a-protected-pg.Abc123/socket",
    port: 55439, database: "setfarm", user: "task6a_runtime", osUid: 70 };
  const census = censusFixture();
  const raw = async (query: string, parts?: TemplateStringsArray) => {
    events.push(query.replace(/\s+/g, " ").trim());
    await hold(state.holdRecheck && query.includes("pg_stat_clear_snapshot") ? "recheck" : query);
    if (state.revoked) throw Error("backend disposed");
    if (query === "ROLLBACK") state.aborted = false;
    else if (state.aborted) throw Error("25P02 current transaction is aborted");
    if (state.coreFailure && query.includes("source31 diagnostic core")) {
      state.aborted = true; throw state.coreFailure;
    }
    if (query.includes("pg_stat_clear_snapshot")) { cleared = true; state.cachedOther = state.otherCount; return []; }
    if (query.includes("pg_stat_activity")) {
      if (!cleared) state.readsWithoutClear++;
      cleared = false;
      return [{ backendPid: 4242, backendStart: state.backendStart, sessionRoleOid: "17000",
        sessionRoleName: "task6a_runtime", databaseOid: "17001", databaseName: "setfarm",
        effectiveRole: state.currentRole, clientAddress: null, clientPort: -1,
        backendType: "client backend", otherBackendCount: state.cachedOther }];
    }
    if (parts) return census.connection(parts);
    return [];
  };
  const reserved = Object.assign((parts: TemplateStringsArray) => raw(parts.join("?"), parts), {
    unsafe: (query: string) => raw(query), release: () => { events.push("release"); },
  });
  const context = vm.createContext({ Object, Array, Number, Math, String, RegExp, Promise, Set,
    Error, AggregateError, Reflect, Buffer,
    process: { env: {}, platform: "darwin", getuid: () => 70, geteuid: () => 70,
      getgid: () => 70, getegid: () => 70, hrtime: { bigint: () => BigInt(state.now) * 1000000n } },
    setTimeout: (fn: () => void, ms: number) => { assert.equal(ms, 60000); expire = fn; return 1; },
    clearTimeout: () => { expire = undefined; },
    parseTask6aPostgresSocketTransportV1, buildTask6aPostgresSocketOptionsV1,
    holdTask6aSocketPhysicalEvidenceV1: () => { state.now += state.holdAdvance; return { recheck: () => {
      state.now += state.physicalAdvance;
      if (state.physicalBad || state.physicalClosed) throw Error("physical drift");
    }, close: () => { state.physicalClosed = true; } }; },
    createTask6aSingleBackendSocketClientV1: () => {
      state.allocations++;
      return { sql: { reserve: async () => { events.push("reserve"); await hold("reserve"); return reserved; } },
        observe: () => ({ nativeSocketCreations: events.includes("reserve") ? 1 : 0, revoked: state.revoked }),
        revoke: () => { state.revoked = true; disposal(); },
        close: async () => { state.revoked = true; disposal(); events.push("close"); await hold("close"); } };
    },
    withHeldContractSpineV31DiagnosticV2: async (session: typeof reserved, continuation: () => Promise<unknown>) => {
      await session.unsafe("SELECT set_config('lock_timeout', '1000ms', false)");
      await session.unsafe("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
      try {
        if (state.parallel) await Promise.all([
          session.unsafe("SELECT parallel audit first"), session.unsafe("SELECT parallel audit second"),
        ]);
        await session.unsafe("SELECT source31 diagnostic core boundary"); return await continuation();
      }
      finally { await session.unsafe("ROLLBACK"); await session.unsafe("RESET search_path"); }
    },
    observeHeldColdPre32LegacyDatabaseCensusV2: census.invoke,
  });
  vm.runInContext(ts.transpileModule(code, { compilerOptions: { target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.None } }).outputText, context);
  return { state, events, candidate,
    invoke: context.withTask6aPrivateHeldPg31DiagnosticV2 as (...args: any[]) => Promise<any>,
    expire: () => { state.now = 60000; assert.ok(expire); expire(); } };
}

test("private held diagnostic retains one backend and brackets tagged census and all population reads", async () => {
  // A second backend, unguarded tagged SQL, omitted activity-cache clearing,
  // early disposal or raw SQL export must fail.
  const { state, events, candidate, invoke } = privateFixture();
  let captured: any;
  assert.equal(await invoke(candidate, 71, 70, async (held: any) => {
    captured = held;
    const observed = held.observe();
    assert.equal(observed.backendPid, 4242);
    assert.equal(observed.observingBackendCount, 1);
    assert.equal(observed.productionAuthority, false);
    assert.equal(observed.authority, "diagnostic-only");
    assert.equal(Object.isFrozen(held), true);
    assert.deepEqual(Object.keys(held).sort(), ["observe", "recheck", "revoke"]);
    assert.equal(state.revoked, false);
    await held.recheck(); await held.recheck();
    return "retained value";
  }), "retained value");
  assert.equal(state.allocations, 1);
  assert.equal(state.readsWithoutClear, 0);
  assert.ok(events.some(query => query.includes("WITH expected_tables")));
  assert.ok(events.indexOf("reserve") < events.findIndex(query => query.includes("pg_stat_activity")));
  assert.ok(events.findIndex(query => query.includes("pg_stat_activity"))
    < events.findIndex(query => query.includes("set_config")));
  assert.equal(state.revoked, true);
  assert.throws(() => captured.observe());
  await assert.rejects(captured.recheck());
});

test("private held diagnostic never shares a cached activity sample across concurrent audit branches", async () => {
  // Concurrent clears followed by concurrent reads reuse PG's cache. Each
  // separate clear/read bracket must settle without another sample intervening.
  const { state, candidate, invoke } = privateFixture();
  state.parallel = true;
  await invoke(candidate, 71, 70, async (held: any) => { await held.recheck(); });
  assert.equal(state.readsWithoutClear, 0);
});

test("private held diagnostic delivers rollback after a real query leaves the transaction aborted", async () => {
  // A SELECT population check before ROLLBACK is itself rejected by aborted PG
  // and must not prevent the fixed same-backend recovery command.
  const { state, events, candidate, invoke } = privateFixture();
  const primary = new Error("actual audit query refused"); state.coreFailure = primary;
  let yielded = false;
  await assert.rejects(invoke(candidate, 71, 70, async () => { yielded = true; }), error => {
    assert.ok(error === primary || error instanceof AggregateError && error.errors.includes(primary));
    return true;
  });
  assert.equal(yielded, false);
  assert.ok(events.includes("ROLLBACK"), "aborted transaction must receive actual rollback");
  assert.equal(state.aborted, false);
  assert.equal(state.revoked, true);
});

for (const changed of ["other backend", "backend lifetime", "effective role", "physical", "explicit revoke"]) {
  test(`private held diagnostic permanently refuses ${changed} during continuation`, async () => {
    // A sampled population/identity crossing or restored physical path cannot
    // revive the same holder, even if the callback catches the first refusal.
    const { state, candidate, invoke } = privateFixture();
    let entered = false, firstRefused = false, secondRefused = false;
    let revivedObservation: unknown;
    const outcome = await invoke(candidate, 71, 70, async (held: any) => {
      entered = true;
      if (changed === "other backend") state.otherCount = "1";
      if (changed === "backend lifetime") state.backendStart = "2026-09-30 02:03:04+00";
      if (changed === "effective role") state.currentRole = "other_role";
      if (changed === "physical") state.physicalBad = true;
      if (changed === "explicit revoke") held.revoke();
      try { await held.recheck(); } catch { firstRefused = true; }
      state.otherCount = "0"; state.backendStart = "2026-09-30 01:02:03+00";
      state.currentRole = "task6a_runtime"; state.physicalBad = false;
      try { revivedObservation = held.observe(); } catch {}
      try { await held.recheck(); } catch { secondRefused = true; }
      return "forbidden late success";
    }).then((value: unknown) => ({ value }), (error: unknown) => ({ error }));
    // Assertions are outside the callback: their AssertionError must never be
    // misclassified by an outer assert.rejects as the platform's own refusal.
    assert.equal(entered, true);
    assert.equal(firstRefused, true, "first changed boundary must reject recheck");
    assert.equal(revivedObservation, undefined, "restoration must not revive observation");
    assert.equal(secondRefused, true, "restoration must not revive recheck");
    assert.ok("error" in outcome, "revoked continuation must not return a value");
    assert.equal(state.revoked, true);
  });
}

test("private held diagnostic actively expires while its continuation remains pending", async () => {
  // Checking time only after callback settlement leaves a never-settling holder
  // live. The fixed timer must dispose it and deny late success independently.
  const { state, candidate, invoke, expire } = privateFixture();
  let enter!: () => void, release!: () => void, held: any;
  const entered = new Promise<void>(resolve => { enter = resolve; });
  const gate = new Promise<void>(resolve => { release = resolve; });
  const result = invoke(candidate, 71, 70, async (value: any) => {
    held = value; enter(); await gate; return "forbidden expired result";
  });
  try {
    await entered; expire();
    assert.equal(state.revoked, true);
    assert.throws(() => held.observe());
    await assert.rejects(result);
  } finally { release(); }
});

test("private held diagnostic refuses an observation crossing expiry inside synchronous physical inspection", async () => {
  // Synchronous ACL inspection can block the timer; after-inspection monotonic
  // checks must still refuse a positive observation past the common deadline.
  const { state, candidate, invoke } = privateFixture();
  let lateObservation: unknown;
  await assert.rejects(invoke(candidate, 71, 70, async (held: any) => {
    state.physicalAdvance = 60000;
    try { lateObservation = held.observe(); } catch {}
    return "forbidden late physical observation";
  }));
  assert.equal(lateObservation, undefined, "expired physical check must never yield an observation");
});

test("private held diagnostic never allocates a client after synchronous initial hold overruns expiry", async () => {
  // Expired physical setup is not permission to allocate another native holder.
  const { state, candidate, invoke } = privateFixture(); state.holdAdvance = 60000;
  await assert.rejects(invoke(candidate, 71, 70, async () => "forbidden"));
  assert.equal(state.allocations, 0);
});

test("private held diagnostic drains unawaited recheck before cleanup and preserves its distinct error", async () => {
  // A callback cannot return while its owned raw clear/sample still runs:
  // disposal must settle that work before final aggregation/control handoff.
  let enter!: () => void, release!: () => void;
  const entered = new Promise<void>(resolve => { enter = resolve; });
  const gate = new Promise<void>(resolve => { release = resolve; });
  const { state, events, candidate, invoke } = privateFixture({ phase: "recheck", gate, entered: enter });
  let recheck: Promise<void> | undefined;
  const result = invoke(candidate, 71, 70, async (held: any) => {
    state.holdRecheck = true;
    recheck = held.recheck().catch((error: unknown) => { events.push("recheck-settled"); throw error; });
    void recheck!.catch(() => {});
    await entered;
    return "forbidden unawaited result";
  });
  try {
    await assert.rejects(result, error => {
      const flatten = (value: unknown): unknown[] => value instanceof AggregateError
        ? value.errors.flatMap(flatten) : [value];
      assert.ok(flatten(error).includes(state.pendingFailure), "late owned recheck failure must be retained");
      return true;
    });
    await assert.rejects(recheck!);
    const rollback = events.indexOf("ROLLBACK"), settled = events.indexOf("recheck-settled");
    assert.ok(settled >= 0);
    assert.ok(rollback < 0 || rollback > settled, "cleanup must not race owned recheck");
  } finally { release(); }
});

test("private held diagnostic owns rejection of a genuinely abandoned recheck", async () => {
  // Tracking only an inner promise leaves an abandoned async public wrapper
  // unhandled, which can terminate the real observer under Node's default mode.
  let enter!: () => void, release!: () => void;
  const entered = new Promise<void>(resolve => { enter = resolve; });
  const gate = new Promise<void>(resolve => { release = resolve; });
  const { state, candidate, invoke } = privateFixture({ phase: "recheck", gate, entered: enter });
  try {
    await assert.rejects(invoke(candidate, 71, 70, async (held: any) => {
      state.holdRecheck = true;
      held.recheck(); // Deliberately neither await nor caller catch.
      await entered;
      return "abandoned result";
    }));
    await new Promise<void>(resolve => setImmediate(resolve));
    assert.equal(state.revoked, true);
  } finally { release(); }
});

test("private held diagnostic refuses nonprivate targets before client allocation", async () => {
  // Generic transport/production descriptor overrides must not enter this fixture adapter.
  const { state, candidate, invoke } = privateFixture();
  for (const bad of [{ ...candidate, database: "postgres" },
    { ...candidate, socketDirectory: "/Library/Application Support/Setfarm/postgres/socket" }]) {
    await assert.rejects(invoke(bad, 71, 70, async () => "forbidden"));
  }
  await assert.rejects(invoke(candidate, 70, 70, async () => "same UID"));
  await assert.rejects(invoke(candidate, 71, 70, async () => "extra", "forbidden override"));
  assert.equal(state.allocations, 0);
});

for (const phase of ["reserve", "pg_stat_clear_snapshot", "BEGIN ISOLATION",
  "source31 diagnostic core", "WITH required_columns", "ROLLBACK", "RESET search_path", "close"]) {
  test(`private held diagnostic expiry burns during pending ${phase}`, async () => {
    // Active deadline must include acquisition, audit, tagged census and fixed
    // cleanup; definite client disposal remains required before returning.
    let enter!: () => void, release!: () => void;
    const entered = new Promise<void>(resolve => { enter = resolve; });
    const gate = new Promise<void>(resolve => { release = resolve; });
    const { state, events, candidate, invoke, expire } = privateFixture({ phase, gate, entered: enter });
    let settled = false, yielded = false;
    const result = invoke(candidate, 71, 70, async () => { yielded = true; return "bounded result"; })
      .then((value: unknown) => { settled = true; return { value }; },
        (error: unknown) => { settled = true; return { error }; });
    try {
      await entered; expire();
      assert.equal(state.revoked, true);
      if (phase === "close") {
        await new Promise<void>(resolve => setImmediate(resolve));
        assert.equal(settled, false, "unknown disposal must not be reported settled");
        release();
      }
      const final = await result;
      assert.ok("error" in final, "expiry must never return the callback's positive result");
      assert.equal(events.includes("release"), false);
      assert.equal(state.allocations, 1);
      if (!["ROLLBACK", "RESET search_path", "close"].includes(phase)) assert.equal(yielded, false);
    } finally { release(); }
  });
}
