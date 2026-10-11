import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { test } from "node:test";

// Complete real consumer module; ONLY its two imported owner boundaries are
// modeled. These controls do not authenticate a fixed descriptor or native PG.
const sourceUrl = new URL("../../src/internal-production/task6a-protected-postgres-backend-probe-v1.ts", import.meta.url);
const source = fs.existsSync(sourceUrl) ? fs.readFileSync(sourceUrl, "utf8") : "";
const literalQuery = 'SELECT self.pid AS pid, self.backend_start::text AS "backendStart", session_user AS session, current_user AS role, current_database() AS database, inet_client_addr() IS NULL AS socket FROM pg_catalog.pg_stat_activity self WHERE self.pid = pg_catalog.pg_backend_pid()';
const facts = { pid: 4217, backendStart: "2026-10-11 10:12:13.123456+00",
  session: "setfarm_runtime", role: "setfarm_runtime", database: "setfarm", socket: true };
const refused = /TASK6A_PROTECTED_POSTGRES_BACKEND_PROBE_REFUSED/;
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
async function turns() { for (let i = 0; i < 12; i++) await Promise.resolve(); }
function observed<T>(original: Promise<T>): Promise<T> { void original.catch(() => {}); return original; }

function fixture() {
  const events: string[] = [], queries: string[] = [];
  const state = { sourceRefuses: false, pendingReserve: false, pendingQuery: false,
    pendingClose: false, endingRejects: false, closeThrows: false, heldCloseThrows: false,
    afterQueryRefuses: false, factoryThrows: false, revokeThrows: false, releaseThrows: false,
    queryCount: 0, queriesSettled: 0, revoked: false };
  const reserve = deferred<any>(), query = deferred<any>(), close = deferred<void>();
  const rows: any[] = [[{ ...facts }], [{ ...facts }]];
  const transport = Object.freeze({ schema: "setfarm.postgres-socket-transport.v1",
    socketDirectory: "/Library/Application Support/Setfarm/PostgreSQL/run", port: 55439,
    database: "setfarm", user: "setfarm_runtime", osUid: 216 });
  const held = {
    read() { events.push("read"); return { descriptor: { transport } }; },
    recheck() {
      events.push("recheck");
      if (state.afterQueryRefuses && state.queriesSettled) throw Error("TEST_ONLY_AUTHORITY_DRIFT");
    },
    close() { events.push("held-close"); if (state.heldCloseThrows) throw undefined; },
  };
  const reserved = {
    unsafe(sql: string) {
      events.push("query"); queries.push(sql);
      const ordinal = state.queryCount++;
      return (state.pendingQuery && ordinal === 0 ? query.promise : Promise.resolve(rows[ordinal]))
        .then(value => { state.queriesSettled++; events.push("query-settled"); return value; });
    },
    release() { assert.equal(state.revoked, true); events.push("release"); if (state.releaseThrows) throw undefined; },
  };
  const client = {
    sql: { reserve() { events.push("reserve"); return state.pendingReserve ? reserve.promise : Promise.resolve(reserved); } },
    revoke() { state.revoked = true; events.push("revoke"); if (state.revokeThrows) throw undefined; },
    close() {
      events.push("client-close");
      if (state.closeThrows) throw undefined;
      const original = state.pendingClose ? close.promise : Promise.resolve();
      return original.then(() => {
        events.push("client-closed");
        if (state.endingRejects) throw undefined;
      });
    },
    observe() { return { nativeSocketCreations: 1, revoked: state.revoked }; },
  };
  const module = { exports: {} as Record<string, any> };
  const context = vm.createContext({ exports: module.exports, module, Object, Promise, Error, Set,
    require(name: string) {
      if (name === "./task6a-socket-physical-evidence-v1.js") return {
        holdTask6aProtectedPostgresSocketV1() {
          events.push("hold"); if (state.sourceRefuses) throw Error("TEST_ONLY_SOURCE_REFUSED"); return held;
        },
      };
      if (name === "./task6a-single-backend-socket-client-v1.js") return {
        createTask6aSingleBackendSocketClientV1(value: unknown) {
          assert.equal(value, transport); events.push("client");
          if (state.factoryThrows) throw undefined;
          return client;
        },
      };
      throw Error(`UNQUALIFIED_TEST_IMPORT:${name}`);
    },
  });
  const compiled = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
  } }).outputText;
  vm.runInContext(compiled, context);
  assert.equal(events.length, 0, "module import must not acquire authority or a client");
  const probe = module.exports.probeTask6aProtectedPostgresBackendV1;
  assert.equal(typeof probe, "function", "missing closed backend consumer");
  assert.deepEqual(Object.keys(module.exports), ["probeTask6aProtectedPostgresBackendV1"]);
  return { probe: probe as (...args: unknown[]) => Promise<void>, state, events, queries, rows,
    reserve, query, close, reserved };
}

test("closed probe performs two own-backend reads then releases only after client close", async () => {
  const f = fixture();
  assert.equal(await f.probe(), undefined);
  assert.deepEqual(f.queries, [literalQuery, literalQuery]);
  assert.equal(f.events.filter(event => event === "client").length, 1);
  assert.equal(f.events.filter(event => event === "reserve").length, 1);
  assert.ok(f.events.indexOf("hold") < f.events.indexOf("client"));
  assert.ok(f.events.indexOf("client-closed") < f.events.indexOf("held-close"));
});
test("closed probe rejects foreign proxy arguments without inspecting them or acquiring", async () => {
  const f = fixture(); let traps = 0;
  const foreign = new Proxy({}, { get() { traps++; throw Error("FOREIGN_INPUT"); } });
  await assert.rejects(async () => f.probe(foreign), refused);
  assert.equal(traps, 0); assert.deepEqual(f.events, []);
});
test("fixed source refusal cannot allocate a backend client", async () => {
  const f = fixture(); f.state.sourceRefuses = true;
  await assert.rejects(f.probe(), refused);
  assert.deepEqual(f.events, ["hold"]);
});
test("pending original reserve retains authority and rejects concurrent entry", async () => {
  const f = fixture(); f.state.pendingReserve = true;
  let completed = false; const original = observed(f.probe().finally(() => { completed = true; }));
  try {
    await turns(); const before = [...f.events];
    await assert.rejects(f.probe(), refused); assert.deepEqual(f.events, before);
    assert.equal(completed, false); assert.equal(f.events.includes("held-close"), false);
  } finally { f.reserve.resolve(f.reserved); await original; }
  assert.equal(completed, true);
});
test("pending original query cannot release held authority", async () => {
  const f = fixture(); f.state.pendingQuery = true;
  let completed = false; const original = observed(f.probe().finally(() => { completed = true; }));
  try {
    await turns(); assert.equal(f.state.queryCount, 1);
    assert.equal(completed, false); assert.equal(f.events.includes("held-close"), false);
  } finally { f.query.resolve([{ ...facts }]); await original; }
});
for (const operation of ["reserve", "query"] as const) {
  test(`original ${operation} rejection with undefined is not converted into success`, async () => {
    const f = fixture();
    if (operation === "reserve") f.state.pendingReserve = true;
    else f.state.pendingQuery = true;
    const original = observed(assert.rejects(f.probe(), refused));
    try { await turns(); assert.equal(f.events.includes("held-close"), false); }
    finally { f[operation].reject(undefined); await original; }
    assert.ok(f.events.indexOf("client-closed") < f.events.indexOf("held-close"));
  });
}
for (const rows of [[], [{ ...facts }, { ...facts }], [{ ...facts, unexpected: true }]]) {
  test(`own-backend malformed row cardinality/shape ${JSON.stringify(rows)} refuses`, async () => {
    const f = fixture(); f.rows[0] = rows;
    await assert.rejects(f.probe(), refused); assert.equal(f.state.queryCount, 1);
  });
}
test("pending native-driver close retains FDs even after query authority drift", async () => {
  const f = fixture(); f.state.afterQueryRefuses = true; f.state.pendingClose = true;
  let completed = false;
  const original = observed(assert.rejects(f.probe(), refused).finally(() => { completed = true; }));
  try {
    await turns(); assert.equal(f.state.revoked, true);
    assert.equal(f.events.includes("client-close"), true);
    assert.equal(completed, false); assert.equal(f.events.includes("held-close"), false);
  } finally { f.close.resolve(); await original; }
  assert.ok(f.events.indexOf("client-closed") < f.events.indexOf("held-close"));
});
test("ending rejection with undefined remains failure after close settlement and is sticky", async () => {
  const f = fixture(); f.state.pendingClose = true; f.state.endingRejects = true;
  let completed = false;
  const original = observed(assert.rejects(f.probe(), refused).finally(() => { completed = true; }));
  try { await turns(); assert.equal(completed, false); assert.equal(f.events.includes("held-close"), false); }
  finally { f.close.resolve(); await original; }
  assert.ok(f.events.indexOf("client-closed") < f.events.indexOf("held-close"));
  const before = [...f.events]; await assert.rejects(f.probe(), refused); assert.deepEqual(f.events, before);
});
test("unknown synchronous close preserves held custody without retry or future acquisition", async () => {
  const f = fixture(); f.state.closeThrows = true;
  await assert.rejects(f.probe(), refused);
  assert.equal(f.events.includes("held-close"), false);
  const before = [...f.events]; await assert.rejects(f.probe(), refused); assert.deepEqual(f.events, before);
});
test("unknown client-construction cleanup retains acquired authority and quarantines future entry", async () => {
  const f = fixture(); f.state.factoryThrows = true;
  await assert.rejects(f.probe(), refused);
  assert.equal(f.events.includes("held-close"), false);
  const before = [...f.events]; await assert.rejects(f.probe(), refused); assert.deepEqual(f.events, before);
});
for (const fault of ["revokeThrows", "releaseThrows"] as const) {
  test(`${fault} cannot skip the native-driver close join`, async () => {
    const f = fixture(); f.state[fault] = true; f.state.pendingClose = true;
    let completed = false;
    const original = observed(assert.rejects(f.probe(), refused).finally(() => { completed = true; }));
    try {
      await turns(); assert.equal(completed, false);
      assert.equal(f.events.includes("client-close"), true);
      assert.equal(f.events.includes("held-close"), false);
    } finally { f.close.resolve(); await original; }
    assert.ok(f.events.indexOf("client-closed") < f.events.indexOf("held-close"));
  });
}
test("FD close failure with undefined is sticky and never retried", async () => {
  const f = fixture(); f.state.heldCloseThrows = true;
  await assert.rejects(f.probe(), refused);
  assert.equal(f.events.filter(event => event === "held-close").length, 1);
  const before = [...f.events]; await assert.rejects(f.probe(), refused); assert.deepEqual(f.events, before);
});
test("same PID with one-microsecond backend lifetime drift refuses", async () => {
  const f = fixture(); f.rows[1][0].backendStart = "2026-10-11 10:12:13.123457+00";
  await assert.rejects(f.probe(), refused);
  assert.equal(f.state.queryCount, 2);
  assert.ok(f.events.indexOf("client-closed") < f.events.indexOf("held-close"));
});
for (const [field, value] of [["role", "setfarm_owner"], ["session", "postgres"],
  ["database", "postgres"], ["socket", false], ["pid", 0], ["backendStart", "invalid"]] as const) {
  test(`own-backend ${field} mismatch refuses before the second query`, async () => {
    const f = fixture(); f.rows[0][0][field] = value;
    await assert.rejects(f.probe(), refused); assert.equal(f.state.queryCount, 1);
    assert.ok(f.events.indexOf("client-closed") < f.events.indexOf("held-close"));
  });
}

test("actual imported probe refuses caller input before fixed authority acquisition", async () => {
  const { probeTask6aProtectedPostgresBackendV1 } = await import("../../src/internal-production/task6a-protected-postgres-backend-probe-v1.js");
  let traps = 0;
  const foreign = new Proxy({}, { get() { traps++; throw Error("FOREIGN_INPUT"); } });
  await assert.rejects(Reflect.apply(probeTask6aProtectedPostgresBackendV1, undefined, [foreign]), refused);
  assert.equal(traps, 0);
});
test("actual imported probe refuses missing fixed authority without installing it", {
  skip: fs.existsSync("/Library/Application Support/Setfarm/authority/platform-postgres-endpoint-v1.json"),
}, async () => {
  const { probeTask6aProtectedPostgresBackendV1 } = await import("../../src/internal-production/task6a-protected-postgres-backend-probe-v1.js");
  await assert.rejects(probeTask6aProtectedPostgresBackendV1(), refused);
});
