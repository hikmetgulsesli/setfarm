import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { types } from "node:util";
import ts from "typescript";
import { test } from "node:test";

// Complete maintained module with explicitly MODELED acquisition/client/producer
// ports and monotonic clock. Native Promises/timers below are real; rows/FD/driver events remain models.
// No fixed-source, actual PostgreSQL, native-close or genesis grant is inferred.
const sourceUrl = new URL("../../src/internal-production/task6a-protected-postgres-backend-probe-v1.ts", import.meta.url);
const source = fs.existsSync(sourceUrl) ? fs.readFileSync(sourceUrl, "utf8") : "";
const literalQuery = 'SELECT self.pid AS pid, self.backend_start::text AS "backendStart", session_user AS session, current_user AS role, current_database() AS database, inet_client_addr() IS NULL AS socket FROM pg_catalog.pg_stat_activity self WHERE self.pid = pg_catalog.pg_backend_pid()';
const facts = { pid: 4217, backendStart: "2026-10-11 10:12:13.123456+00",
  session: "setfarm_runtime", role: "setfarm_runtime", database: "setfarm", socket: true };
const refused = /TASK6A_PROTECTED_POSTGRES_BACKEND_(?:PROBE|OWNER)_REFUSED/;
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
async function turns() { for (let i = 0; i < 48; i++) await Promise.resolve(); }
function observed<T>(original: Promise<T>): Promise<T> { void original.catch(() => {}); return original; }
function assertClosed(events: string[]) {
  for (const event of ["release", "client-close", "client-closed", "held-close"])
    assert.equal(events.filter(value => value === event).length, 1, event);
  assert.ok(events.indexOf("client-closed") < events.indexOf("held-close"));
}

function fixture() {
  const events: string[] = [], queries: string[] = [];
  const state = { sourceRefuses: false, pendingReserve: false, pendingQuery: false,
    pendingClose: false, endingRejects: false, closeThrows: false, heldCloseThrows: false,
    afterQueryRefuses: false, factoryThrows: false, revokeThrows: false, releaseThrows: false,
    queryCount: 0, queriesSettled: 0, revoked: false, pendingStatement: "",
    rejectingStatement: "", producerRefuses: "", rollbackSettled: false,
    driftAfterStatement: "", lastSettledStatement: "", pendingImport: false,
    importRejects: false, driftAfterImport: false, importSettled: false,
    mintThrows: false, publicationThrows: false, repeatBaseQueries: 0,
    endingKind: "native" as "native" | "undefined" | "thenable" };
  let clock = process.hrtime.bigint(), recheckHook: (() => void) | undefined;
  const reserve = deferred<any>(), query = deferred<any>(), close = deferred<void>();
  const statement = deferred<any>();
  const loading = deferred<any>();
  observed(loading.promise); // RED old consumer may never request the gate.
  const frozenJournalParameters = Object.freeze([31]);
  const parameters: Array<unknown> = [];
  const rows: any[] = [[{ ...facts }], [{ ...facts }]];
  const transport = Object.freeze({ schema: "setfarm.postgres-socket-transport.v1",
    socketDirectory: "/Library/Application Support/Setfarm/PostgreSQL/run", port: 55439,
    database: "setfarm", user: "setfarm_runtime", osUid: 216 });
  const held = {
    read() { events.push("read"); return { descriptor: { transport, schemaOwner: "setfarm_owner" } }; },
    recheck() {
      events.push("recheck");
      recheckHook?.();
      if (state.afterQueryRefuses && state.queriesSettled) throw Error("TEST_ONLY_AUTHORITY_DRIFT");
      if (state.driftAfterStatement && state.driftAfterStatement === state.lastSettledStatement)
        throw Error("TEST_ONLY_AUTHORITY_DRIFT");
      if (state.driftAfterImport && state.importSettled) throw Error("TEST_ONLY_AUTHORITY_DRIFT");
    },
    close() { events.push("held-close"); if (state.heldCloseThrows) throw undefined; },
  };
  const reserved = {
    unsafe(sql: string, values?: unknown) {
      events.push("query"); queries.push(sql); parameters.push(values);
      const ordinal = sql === literalQuery ? state.queryCount++ : -1;
      const original = state.pendingStatement === sql ? statement.promise
        : state.rejectingStatement === sql ? Promise.reject(undefined)
        : state.pendingQuery && ordinal === 0 ? query.promise
        : Promise.resolve(ordinal < 0 ? [] : rows[ordinal] ?? [{ ...facts }]);
      return original.then(value => {
        state.queriesSettled++; events.push("query-settled");
        state.lastSettledStatement = sql;
        if (sql === "ROLLBACK") state.rollbackSettled = true;
        return value;
      });
    },
    release() { assert.equal(state.revoked, true); events.push("release"); if (state.releaseThrows) throw undefined; },
  };
  const client = {
    sql: { reserve() { events.push("reserve"); return state.pendingReserve ? reserve.promise : Promise.resolve(reserved); } },
    revoke() { state.revoked = true; events.push("revoke"); if (state.revokeThrows) throw undefined; },
    close() {
      events.push("client-close");
      if (state.closeThrows) throw undefined;
      if (state.endingKind === "undefined") return undefined;
      if (state.endingKind === "thenable") return { then(resolve: () => void) {
        events.push("non-native-assimilated"); resolve();
      } };
      const original = state.pendingClose ? close.promise : Promise.resolve();
      return original.then(() => {
        events.push("client-closed");
        if (state.endingRejects) throw undefined;
      });
    },
    observe() { return { nativeSocketCreations: 1, revoked: state.revoked }; },
  };
  const module = { exports: {} as Record<string, any> };
  // Explicitly armed MODELED issuer failures; neither is a production hook.
  const modeledObject = new Proxy(Object, { get(target, key) {
    if (key === "freeze") return (value: object) => {
      if (state.mintThrows && Object.getPrototypeOf(value) === null) throw undefined;
      return Object.freeze(value);
    };
    return Reflect.get(target, key);
  } });
  class ModeledWeakMap extends WeakMap<object, unknown> {
    override set(key: object, value: unknown) {
      if (state.publicationThrows) throw undefined;
      return super.set(key, value);
    }
  }
  const context = vm.createContext({ exports: module.exports, module, Object: modeledObject, Promise, Error, Set,
    WeakMap: ModeledWeakMap,
    process: { hrtime: { bigint: () => clock } },
    setTimeout, clearTimeout,
    require(name: string) {
      if (name === "node:timers") return { setTimeout, clearTimeout };
      if (name === "node:util") return { types };
      if (name === "./task6a-socket-physical-evidence-v1.js") return {
        holdTask6aProtectedPostgresSocketV1() {
          events.push("hold"); if (state.sourceRefuses) throw Error("TEST_ONLY_SOURCE_REFUSED"); return held;
        },
      };
      if (name === "./task6a-single-backend-socket-client-v1.js") return {
        createTask6aSingleBackendSocketClientV1(value: unknown) {
          assert.equal(value, transport); events.push("client");
          if (state.factoryThrows) throw undefined;
          state.revoked = false; return client;
        },
      };
      // Modeled namespaces only: real canonical initialization/native ESM are
      // separate controls. CommonJS dynamic import assimilates this gate; it
      // is NOT the production import Promise or proof of its object identity.
      if (name === "../db/contract-spine-migrations.js") {
        events.push("canonical-import");
        const original = state.pendingImport ? loading.promise
          : state.importRejects ? Promise.reject(undefined) : Promise.resolve(canonical);
        return original.then(value => { state.importSettled = true; return value; });
      }
      const producers: Record<string, readonly [string, string]> = {
        "../db/contract-spine-runtime-access-readonly-verifier-v1.js": ["verifyContractSpineRuntimeAccessInTransactionReadOnlyV1", "ACCESS"],
        "../db/base-schema-readonly-verifier-v1.js": ["verifyOrdinaryBaseSchemaCatalogInTransactionReadOnlyV1", "BASE"],
        "../db/public-object-owner-readonly-verifier-v1.js": ["verifyExpectedPublicObjectOwnerInTransactionReadOnlyV1", "OWNER"],
        "./task6a-cold-pre32-catalog-readonly-v1.js": ["requireColdPre32CatalogAbsenceInTransactionV1", "COLD"],
      };
      const producer = producers[name];
      if (producer) return { [producer[0]]: async (transaction: any, owner?: string) => {
        if (producer[1] === "OWNER") assert.equal(owner, "setfarm_owner");
        await transaction.unsafe(`TEST_ONLY_${producer[1]}_BODY`);
        if (producer[1] === "BASE") for (let i = 0; i < state.repeatBaseQueries; i++)
          await transaction.unsafe(`TEST_ONLY_BASE_BUDGET_${i}`);
        if (state.producerRefuses === producer[1]) throw undefined;
      } };
      throw Error(`UNQUALIFIED_TEST_IMPORT:${name}`);
    },
  });
  const canonical = { async verifyHeldPre32ContractSpineJournalIdentityV1(
    query: (sql: string, parameters: readonly number[]) => Promise<unknown>) {
    events.push("canonical-verifier");
    await query("TEST_ONLY_JOURNAL_BODY", frozenJournalParameters);
    if (state.producerRefuses === "JOURNAL") throw undefined;
  } };
  const compiled = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
  } }).outputText;
  vm.runInContext(compiled, context);
  assert.equal(events.length, 0, "module import must not acquire authority or a client");
  const probe = module.exports.probeTask6aProtectedPostgresBackendV1;
  assert.equal(typeof probe, "function", "missing closed backend consumer");

  return { probe: probe as (...args: unknown[]) => Promise<void>, state, events, queries, rows,
    reserve, query, close, statement, reserved, loading, canonical, parameters, frozenJournalParameters,
    hold: module.exports.holdTask6aProtectedPostgresBackendV2 as (...args: unknown[]) => Promise<object>,
    recheck: module.exports.recheckTask6aProtectedPostgresBackendV2 as (...args: unknown[]) => Promise<void>,
    closeOwner: module.exports.closeTask6aProtectedPostgresBackendV2 as (...args: unknown[]) => Promise<void>,
    exports: module.exports, advance(seconds: number) { clock += BigInt(seconds) * 1_000_000_000n; },
    // Inspect actual private records in this MODELED complete-module VM only.
    keeper() { return vm.runInContext("activeKeeper", context) as any; },
    onRecheck(hook: (() => void) | undefined) { recheckHook = hook; } };
}

test("sustained owner exposes only the nominated additive interface (mechanical RED is not genesis)", () => {
  const f = fixture();
  assert.deepEqual(Object.keys(f.exports).sort(), ["closeTask6aProtectedPostgresBackendV2",
    "holdTask6aProtectedPostgresBackendV2", "probeTask6aProtectedPostgresBackendV1",
    "recheckTask6aProtectedPostgresBackendV2"].sort());
});

test("sustained owner retains its reservation after initialization and an actual await", async () => {
  const f = fixture(); let owner: object | undefined;
  try {
    owner = await f.hold(); await new Promise<void>(resolve => setTimeout(resolve, 10));
    assert.equal(Object.isFrozen(owner), true); assert.deepEqual(Reflect.ownKeys(owner), []);
    assert.equal(f.queries.includes("ROLLBACK"), false);
    for (const event of ["release", "client-close", "held-close"]) assert.equal(f.events.includes(event), false);
    assert.equal(f.queries.filter(sql => sql.startsWith("BEGIN")).length, 1);
    const before = f.queries.length; await f.recheck(owner);
    assert.deepEqual(f.queries.slice(before), [literalQuery]);
    assert.equal(f.events.filter(e => e === "reserve").length, 1);
  } finally { if (owner) await f.closeOwner(owner); }
  assertClosed(f.events); assert.equal(f.queries.filter(sql => sql === "ROLLBACK").length, 1);
});

test("sustained owner close returns its identical original and retains physical custody while ending", async () => {
  const f = fixture(); const owner = await f.hold(); f.state.pendingClose = true;
  const first = observed(f.closeOwner(owner)), second = f.closeOwner(owner); assert.equal(first, second);
  try {
    await turns(); assert.equal(f.events.filter(e => e === "client-close").length, 1);
    assert.equal(f.events.includes("held-close"), false);
    await assert.rejects(f.recheck(owner), refused);
  } finally { f.close.resolve(); await first; }
  assert.equal(f.closeOwner(owner), first); assertClosed(f.events);
});

test("sustained owner shared occupancy refuses overlapping hold and finite probe without poisoning", async () => {
  const f = fixture(); const owner = await f.hold();
  try {
    const before = [...f.events]; await assert.rejects(f.hold(), refused); await assert.rejects(f.probe(), refused);
    assert.deepEqual(f.events, before); await f.recheck(owner);
  } finally { await f.closeOwner(owner); }
  assertClosed(f.events);
});

test("sustained owner cannot be reconstructed from a DTO, proxy or another issuer", async () => {
  const f = fixture(), other = fixture(); const owner = await f.hold(), foreign = await other.hold(); let callbacks = 0;
  const proxy = new Proxy({}, { get() { callbacks++; throw Error("CALLER_CALLBACK"); }, ownKeys() { callbacks++; return []; } });
  try {
    const before = [...f.events];
    for (const candidate of [{}, { ...owner }, proxy, foreign, null, "ready"])
      await assert.rejects(f.recheck(candidate), refused);
    assert.deepEqual(f.events, before); assert.equal(callbacks, 0); await f.recheck(owner);
  } finally { await Promise.all([f.closeOwner(owner), other.closeOwner(foreign)]); }
});

test("sustained owner arity refusal starts no new effect", async () => {
  const f = fixture(); await assert.rejects(f.hold("borrowed"), refused); assert.deepEqual(f.events, []);
  const owner = await f.hold();
  try {
    const before = [...f.events]; await assert.rejects(f.recheck(owner, "extra"), refused);
    assert.throws(() => f.closeOwner(owner, "extra"), refused); assert.deepEqual(f.events, before);
  } finally { await f.closeOwner(owner); }
});

test("sustained owner pending recheck is joined before rollback and physical close", async () => {
  const f = fixture(); const owner = await f.hold(); f.state.pendingStatement = literalQuery;
  const checking = observed(f.recheck(owner)); await turns(); const closing = observed(f.closeOwner(owner));
  try {
    await turns(); assert.equal(f.queries.includes("ROLLBACK"), false); assert.equal(f.events.includes("held-close"), false);
  } finally {
    f.statement.resolve([{ ...facts }]); await Promise.allSettled([checking]); await closing;
  }
  assertClosed(f.events); assert.equal(f.queries.filter(sql => sql === "ROLLBACK").length, 1);
});

test("sustained owner loses positive use on tuple drift but retains cleanup custody", async () => {
  const f = fixture(); const owner = await f.hold(); f.rows[1][0].pid++;
  try {
    await assert.rejects(f.recheck(owner), refused); const before = [...f.events];
    await assert.rejects(f.recheck(owner), refused); assert.deepEqual(f.events, before);
    assert.equal(f.events.includes("held-close"), false);
  } finally { await f.closeOwner(owner); }
  assertClosed(f.events);
});

test("sustained owner counts attempts before dispatch and preserves terminal slots", async () => {
  const f = fixture(); const owner = await f.hold();
  try {
    for (let i = 0; i < 64; i++) await f.recheck(owner);
    const before = [...f.queries]; await assert.rejects(f.recheck(owner), refused); assert.deepEqual(f.queries, before);
  } finally { await f.closeOwner(owner); }
  assertClosed(f.events); assert.equal(f.queries.filter(sql => sql === "ROLLBACK").length, 1);
});

test("sustained owner pre-BEGIN tuple failure does not invent rollback", async () => {
  const f = fixture(); f.rows[0][0].session = "wrong";
  await assert.rejects(f.hold(), refused); assert.equal(f.queries.includes("ROLLBACK"), false); assertClosed(f.events);
});

test("sustained owner unknown client construction preserves holder and excludes reacquisition", async () => {
  const f = fixture(); f.state.factoryThrows = true; await assert.rejects(f.hold(), refused);
  assert.equal(f.events.includes("held-close"), false); const before = [...f.events];
  await assert.rejects(f.hold(), refused); await assert.rejects(f.probe(), refused); assert.deepEqual(f.events, before);
});

test("sustained owner pending canonical initialization retains the original and shared slot", async () => {
  const f = fixture(); f.state.pendingImport = true; const original = observed(f.hold()); let owner: object | undefined;
  try {
    await turns(); assert.equal(f.events.includes("canonical-import"), true); assert.equal(f.events.includes("held-close"), false);
    const before = [...f.events]; await assert.rejects(f.probe(), refused); assert.deepEqual(f.events, before);
  } finally { f.loading.resolve(f.canonical); owner = await original; await f.closeOwner(owner); }
  assertClosed(f.events);
});

test("sustained owner original monotonic budget burns use without renewal or early release", async () => {
  const f = fixture(); const owner = await f.hold();
  try {
    f.advance(179); await f.recheck(owner); f.advance(2);
    const before = [...f.queries]; await assert.rejects(f.recheck(owner), refused);
    assert.deepEqual(f.queries, before); assert.equal(f.events.includes("held-close"), false);
  } finally { await f.closeOwner(owner); }
  assertClosed(f.events);
});

test("sustained owner reserves recheck custody before a swallowed producer reentry", async () => {
  const f = fixture(); const owner = await f.hold(); let second: Promise<void> | undefined;
  f.onRecheck(() => { f.onRecheck(undefined); second = observed(f.recheck(owner)); });
  try {
    const before = [...f.queries]; await assert.rejects(f.recheck(owner), refused);
    await assert.rejects(second!, refused); assert.deepEqual(f.queries, before);
  } finally { f.onRecheck(undefined); await f.closeOwner(owner); }
  assertClosed(f.events);
});

test("sustained owner close during producer check joins that published original", async () => {
  const f = fixture(); const owner = await f.hold(); let closing: Promise<void> | undefined;
  f.onRecheck(() => { f.onRecheck(undefined); closing = observed(f.closeOwner(owner)); });
  const checking = observed(f.recheck(owner));
  try { await assert.rejects(checking, refused); }
  finally { f.onRecheck(undefined); await closing; }
  assert.equal(f.closeOwner(owner), closing); assertClosed(f.events);
  assert.equal(f.queries.filter(sql => sql === "ROLLBACK").length, 1);
});

test("sustained owner caller assertion loss cannot surrender its in-progress close", async () => {
  const f = fixture(); const original = observed(f.hold()); let owner: object | undefined, closing: Promise<void> | undefined;
  try {
    owner = await original; f.state.pendingClose = true; closing = observed(f.closeOwner(owner));
    await turns(); assert.equal(f.events.includes("held-close"), false);
    assert.throws(() => { throw Error("OWNED_CALLER_ASSERTION_LOSS"); }, /OWNED_CALLER_ASSERTION_LOSS/);
    const before = [...f.events]; await assert.rejects(f.hold(), refused); assert.deepEqual(f.events, before);
  } finally { f.close.resolve(); if (closing) await closing; else if (owner) await f.closeOwner(owner); }
  assertClosed(f.events);
});

test("sustained owner retains eight private cleanup intents and actual originals", async () => {
  const f = fixture(); const owner = await f.hold(), keeper = f.keeper();
  f.state.pendingClose = true; const closing = observed(f.closeOwner(owner));
  try {
    await turns();
    assert.equal(keeper.cleanup.ending.state, "started");
    assert.equal(keeper.cleanup.ending.attempted, true);
    assert.equal(types.isPromise(keeper.cleanup.ending.original), true);
    assert.equal(keeper.cleanup.physical.state, "unused");
  } finally { f.close.resolve(); await closing; }
  assert.deepEqual(Object.keys(keeper.cleanup), ["join", "rollback", "lifetime", "revoke", "release", "ending", "physical", "timer"]);
  for (const slot of Object.values(keeper.cleanup) as any[]) {
    assert.equal(slot.attempted, true); assert.equal(slot.state, "fulfilled");
    assert.equal(slot.uncertain, false);
    assert.equal(Object.hasOwn(slot, "original"), true);
  }
  assert.equal(keeper.cleanup.ending.original, keeper.cleanup.ending.completion);
  assert.equal(f.closeOwner(owner), closing); assertClosed(f.events);
});

test("sustained owner records unknown construction and skipped cleanup without guessed effects", async () => {
  const f = fixture(); f.state.factoryThrows = true; await assert.rejects(f.hold(), refused);
  const slots = f.keeper().cleanup;
  for (const name of ["rollback", "lifetime", "revoke", "release", "ending"])
    assert.equal(slots[name].state, "skipped", name);
  assert.equal(slots.physical.state, "blocked"); assert.equal(slots.physical.attempted, false);
  assert.equal(slots.physical.uncertain, true);
  assert.equal(slots.join.state, "fulfilled"); assert.equal(slots.timer.state, "fulfilled");
});

for (const failure of ["mintThrows", "publicationThrows"] as const)
  test(`sustained owner MODELED ${failure} retains custody through pending original ending`, async () => {
    const f = fixture(); f.state[failure] = true; f.state.pendingClose = true;
    const holding = observed(f.hold());
    try {
      for (let i = 0; i < 8 && !f.events.includes("client-close"); i++) await turns();
      assert.equal(f.events.includes("client-close"), true);
      assert.equal(f.events.includes("held-close"), false);
      const before = [...f.events]; await assert.rejects(f.hold(), refused);
      assert.deepEqual(f.events, before);
    } finally { f.close.resolve(); await assert.rejects(holding, refused); }
    assertClosed(f.events); f.state[failure] = false;
    const next = await f.hold(); await f.closeOwner(next);
    assert.equal(f.events.filter(e => e === "held-close").length, 2);
  });

test("sustained owner MODELED 8192-positive quota refuses before dispatch and retains cleanup slots", async () => {
  const f = fixture(); f.state.repeatBaseQueries = 8192;
  await assert.rejects(f.hold(), refused);
  // One reserve plus8191 queries spend exactly8192 positive occurrences.
  assert.equal(f.events.filter(e => e === "reserve").length, 1);
  assert.equal(f.queries.length, 8192); // The last occurrence is the independent ROLLBACK.
  assert.equal(f.queries.at(-1), "ROLLBACK");
  assert.equal(f.queries.filter(q => q.startsWith("TEST_ONLY_BASE_BUDGET_")).length, 8187);
  assert.equal(f.queries.includes("TEST_ONLY_BASE_BUDGET_8187"), false);
  assert.equal(f.events.includes("canonical-import"), false); assertClosed(f.events);
});

test("sustained owner privately observes cached close rejection when caller loses its handler", async () => {
  const f = fixture(); const owner = await f.hold(); f.state.endingRejects = true;
  const closing = f.closeOwner(owner); // Intentionally no caller rejection handler yet.
  await new Promise<void>(resolve => setTimeout(resolve, 20));
  assert.equal(f.closeOwner(owner), closing); await assert.rejects(closing, refused);
  const before = [...f.events]; await assert.rejects(f.hold(), refused);
  assert.deepEqual(f.events, before); assertClosed(f.events);
  const slot = f.keeper().cleanup.ending;
  assert.equal(slot.state, "rejected"); assert.equal(Object.hasOwn(slot, "error"), true);
  assert.equal(slot.uncertain, true);
  assert.equal(slot.error, undefined);
});

for (const kind of ["undefined", "thenable"] as const)
  test(`sustained owner MODELED ${kind} ending cannot authorize physical release`, async () => {
    const f = fixture(); const owner = await f.hold(); f.state.endingKind = kind;
    const closing = f.closeOwner(owner); await assert.rejects(closing, refused);
    assert.equal(f.closeOwner(owner), closing);
    assert.equal(f.events.includes("held-close"), false);
    assert.equal(f.events.includes("non-native-assimilated"), false);
    const before = [...f.events]; await assert.rejects(f.hold(), refused); await assert.rejects(f.probe(), refused);
    assert.deepEqual(f.events, before);
    const slot = f.keeper().cleanup.ending;
    assert.equal(slot.attempted, true); assert.equal(Object.hasOwn(slot, "original"), true);
    assert.equal(slot.uncertain, true);
  });
