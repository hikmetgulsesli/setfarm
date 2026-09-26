import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { pathToFileURL } from "node:url";

import { observeTask6aWriterDatabaseSnapshotV2, projectTask6aWriterDatabaseSnapshotInTransactionV2 } from "../../src/internal-production/baseline-task6a-writer-database-snapshot-v2.js";

const ERROR = "INTERNAL_PRODUCTION_TASK6A_WRITER_DATABASE_SNAPSHOT_INVALID";
const sourceUrl = new URL("../../src/internal-production/baseline-task6a-writer-database-snapshot-v2.ts", import.meta.url);
const localUrl = "postgresql://fixture:PRIVATE_PASSWORD@localhost/setfarm";

function row(overrides: Record<string, unknown> = {}) {
  return {
    databaseName: "setfarm", databaseOwnerRole: "setrox", sessionRole: "fixture", effectiveRole: "fixture",
    login: true, superuser: false, bypassRls: false, createRole: false, createDatabase: false,
    otherSessionCountText: "0", ...overrides,
  };
}

test("projector makes one fixed, all-state, exact-database/session-role query and a diagnostic hash", async () => {
  const statements: string[] = [];
  const snapshot = await projectTask6aWriterDatabaseSnapshotInTransactionV2(async statement => {
    statements.push(statement);
    return [row({ otherSessionCountText: "2" })];
  });
  assert.equal(statements.length, 1);
  const sql = statements[0]!;
  assert.equal(sql.replace(/\s+/g, " ").trim(),
    'SELECT d.datname AS "databaseName", database_owner.rolname AS "databaseOwnerRole", session_role.rolname AS "sessionRole", current_user AS "effectiveRole", session_role.rolcanlogin AS "login", session_role.rolsuper AS "superuser", session_role.rolbypassrls AS "bypassRls", session_role.rolcreaterole AS "createRole", session_role.rolcreatedb AS "createDatabase", (SELECT count(*)::text FROM pg_stat_activity AS a WHERE a.datid = d.oid AND a.usesysid = session_role.oid AND a.pid <> pg_backend_pid()) AS "otherSessionCountText" FROM pg_database AS d JOIN pg_roles AS database_owner ON database_owner.oid = d.datdba JOIN pg_roles AS session_role ON session_role.rolname = session_user WHERE d.datname = current_database()');
  assert.equal(snapshot.authority, "diagnostic-only");
  assert.equal(snapshot.temporalScope, "catalog-snapshot-and-live-session-sample");
  assert.equal(snapshot.cutoverAdmission, "not-granted");
  assert.equal(snapshot.physicalIdentityProvenance, "unverified");
  assert.equal(snapshot.database.otherSessionCount, 2);
  assert.match(snapshot.snapshotHash, /^[0-9a-f]{64}$/);
  assert.ok(Object.isFrozen(snapshot));
  assert.ok(Object.isFrozen(snapshot.database));
  const again = await projectTask6aWriterDatabaseSnapshotInTransactionV2(async () => [row({ otherSessionCountText: "2" })]);
  assert.deepEqual(snapshot, again);
  const changed = await projectTask6aWriterDatabaseSnapshotInTransactionV2(async () => [row({ superuser: true, otherSessionCountText: "2" })]);
  assert.notEqual(changed.snapshotHash, snapshot.snapshotHash);
});

for (const [label, output] of [
  ["missing", []], ["duplicate", [row(), row()]], ["extra field", [row({ unexpected: "x" })]],
  ["wrong database", [row({ databaseName: "other" })]], ["crossed effective role", [row({ effectiveRole: "setrox" })]],
  ["bad role", [row({ sessionRole: "Bad-Role" })]], ["bad flag", [row({ bypassRls: "false" })]],
  ["leading zero count", [row({ otherSessionCountText: "02" })]],
  ["unsafe count", [row({ otherSessionCountText: "9007199254740992" })]],
  ["negative count", [row({ otherSessionCountText: "-1" })]],
  ["numeric count", [row({ otherSessionCountText: 1 })]],
] as const) {
  test(`projector refuses ${label}`, async () => {
    await assert.rejects(projectTask6aWriterDatabaseSnapshotInTransactionV2(async () => output), { message: ERROR });
  });
}

test("projector refuses proxies, accessors, nonplain rows, and query errors without leaking details", async () => {
  const accessor = row();
  Object.defineProperty(accessor, "databaseName", { get: () => "setfarm", enumerable: true });
  for (const output of [[new Proxy(row(), {})], [accessor], [Object.assign(Object.create(null), row())], new Proxy([row()], {})]) {
    await assert.rejects(projectTask6aWriterDatabaseSnapshotInTransactionV2(async () => output), { message: ERROR });
  }
  await assert.rejects(projectTask6aWriterDatabaseSnapshotInTransactionV2(async () => { throw Error("PRIVATE_QUERY_PASSWORD"); }),
    { message: ERROR });
});

test("adapter import is inert, and absent or ambient URL refuses before driver load", () => {
  const result = spawnSync(process.execPath, ["--import", "tsx", "--input-type=module", "-e", `
    import net from 'node:net';import{syncBuiltinESMExports,registerHooks}from'node:module';
    let connections=0;const loads=[];
    registerHooks({resolve(specifier,context,next){if(specifier==='postgres'||/db-pg|runtime-config/.test(specifier))loads.push(specifier);return next(specifier,context)}});
    net.Socket.prototype.connect=()=>{connections++;throw Error('UNEXPECTED_CONNECTION')};syncBuiltinESMExports();
    const module=await import(${JSON.stringify(sourceUrl.href)});const importLoads=[...loads];let error;
    try{await module.observeTask6aWriterDatabaseSnapshotV2(undefined)}catch(caught){error=caught.message}
    process.stdout.write(JSON.stringify({error,connections,importLoads,loads}));
  `], { encoding: "utf8", timeout: 15000, env: { SETFARM_PG_URL: "postgresql://PRIVATE_AMBIENT@127.0.0.1/setfarm" } });
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout), { error: ERROR, connections: 0, importLoads: [], loads: [] });
});

for (const scenario of ["ambient-pg", "remote-host", "other-port", "query", "fragment", "multiple-host", "wrong-database", "empty-user"]) {
  test(`adapter refuses ${scenario} before driver load`, () => {
    const input = scenario === "remote-host" ? "postgresql://fixture:PRIVATE_PASSWORD@remote.invalid/setfarm"
      : scenario === "other-port" ? "postgresql://fixture:PRIVATE_PASSWORD@localhost:5433/setfarm"
        : scenario === "query" ? `${localUrl}?sslmode=disable`
          : scenario === "fragment" ? `${localUrl}#x`
            : scenario === "multiple-host" ? "postgresql://fixture:PRIVATE_PASSWORD@localhost,remote.invalid/setfarm"
              : scenario === "wrong-database" ? "postgresql://fixture:PRIVATE_PASSWORD@localhost/other"
                : scenario === "empty-user" ? "postgresql://:PRIVATE_PASSWORD@localhost/setfarm" : localUrl;
    const result = spawnSync(process.execPath, ["--import", "tsx", "--input-type=module", "-e", `
      import{registerHooks}from'node:module';let loads=0;
      registerHooks({resolve(specifier,context,next){if(specifier==='postgres')loads++;return next(specifier,context)}});
      const module=await import(${JSON.stringify(sourceUrl.href)});let error;
      try{await module.observeTask6aWriterDatabaseSnapshotV2(${JSON.stringify(input)})}catch(caught){error=caught.message}
      process.stdout.write(JSON.stringify({error,loads}));
    `], { encoding: "utf8", timeout: 15000, env: scenario === "ambient-pg" ? { PGPORT: "6543" } : {} });
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(JSON.parse(result.stdout), { error: ERROR, loads: 0 });
  });
}

test("adapter uses one bounded read-only transaction and closes on every driver path", () => {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "task6a-writer-db-")));
  try {
    let source = fs.readFileSync(sourceUrl, "utf8");
    const marker = 'const postgresModule = await import("postgres");';
    assert.equal(source.split(marker).length, 2);
    source = source.replace('from "../product-compiler/canonical-json.js"',
      `from ${JSON.stringify(new URL("../../src/product-compiler/canonical-json.ts", import.meta.url).href)}`)
      .replace(marker, `const postgresModule={default:(url,options)=>{
        globalThis.probe.url=url;globalThis.probe.options=options;
        return {options:{host:[globalThis.probe.wrongTarget?'remote.invalid':'localhost'],port:[5432],database:'setfarm',user:'fixture'},
          begin:async(mode,operation)=>{globalThis.probe.modes.push(mode);
            if(globalThis.probe.hangBegin)return new Promise(()=>{});
            const tx=(strings)=>{globalThis.probe.locals.push(strings[0]);return []};
            tx.unsafe=async statement=>{globalThis.probe.statements.push(statement);
              if(globalThis.probe.failure)throw Error('PRIVATE_QUERY_PASSWORD');
              class Result extends Array{};const result=new Result(globalThis.probe.row);
              for(const key of ['count','state','command','columns','statement'])Object.defineProperty(result,key,{value:null});
              return result};return operation(tx)},
          end:async options=>{globalThis.probe.closes.push(options);if(globalThis.probe.closeFailure)throw Error('PRIVATE_CLOSE_PASSWORD')}
        }} };`);
    fs.writeFileSync(path.join(root, "package.json"), '{"type":"module"}');
    const file = path.join(root, "observer.ts"); fs.writeFileSync(file, source);
    const result = spawnSync(process.execPath, ["--import", "tsx", "--input-type=module", "-e", `
      const module=await import(${JSON.stringify(pathToFileURL(file).href)});
      const run=async (flags,url=${JSON.stringify(localUrl)})=>{globalThis.probe={row:${JSON.stringify(row())},...flags,url:null,options:null,modes:[],locals:[],statements:[],closes:[]};let output,error;
        try{const snapshot=await module.observeTask6aWriterDatabaseSnapshotV2(url);output={authority:snapshot.authority,sessionRole:snapshot.database.sessionRole}}
        catch(caught){error=caught.message};const {probe}=globalThis;return{output,error,modes:probe.modes,locals:probe.locals,queries:probe.statements.length,closes:probe.closes,url:probe.url,target:probe.options}};
      process.stdout.write(JSON.stringify({success:await run({}),passwordlessLocal:await run({},'postgresql://fixture@localhost:5432/setfarm'),failure:await run({failure:true}),
        wrongTarget:await run({wrongTarget:true}),wrongRole:await run({row:{...${JSON.stringify(row())},sessionRole:'setrox',effectiveRole:'setrox'}}),
        closeFailure:await run({closeFailure:true}),hungBegin:await run({hangBegin:true})}));
    `], { encoding: "utf8", timeout: 20000, env: {} });
    assert.equal(result.status, 0, result.stderr);
    const observed = JSON.parse(result.stdout);
    for (const entry of [observed.success, observed.failure, observed.wrongRole, observed.closeFailure]) {
      assert.deepEqual(entry.modes, ["isolation level repeatable read read only"]);
      assert.deepEqual(entry.closes, [{ timeout: 1 }]);
      assert.equal(entry.locals.length, 2);
      assert.equal(entry.url, localUrl);
      assert.equal(entry.target.max, 1);
      assert.equal(entry.target.connect_timeout, 5);
    }
    assert.deepEqual(observed.success.output, { authority: "diagnostic-only", sessionRole: "fixture" });
    assert.deepEqual(observed.passwordlessLocal.output, { authority: "diagnostic-only", sessionRole: "fixture" });
    assert.equal(observed.passwordlessLocal.queries, 1);
    assert.equal(observed.success.queries, 1);
    assert.equal(observed.failure.error, ERROR);
    assert.equal(observed.wrongRole.error, ERROR);
    assert.equal(observed.wrongTarget.error, ERROR);
    assert.deepEqual(observed.wrongTarget.modes, []);
    assert.deepEqual(observed.wrongTarget.closes, [{ timeout: 1 }]);
    assert.equal(observed.closeFailure.error, ERROR);
    assert.equal(observed.hungBegin.error, ERROR);
    assert.deepEqual(observed.hungBegin.modes, ["isolation level repeatable read read only"]);
    assert.deepEqual(observed.hungBegin.closes, [{ timeout: 1 }]);
    assert.equal(observed.hungBegin.target.connection.statement_timeout, 5000);
    assert.equal(observed.hungBegin.target.connection.lock_timeout, 1000);
    assert.equal(result.stdout.includes("PRIVATE_QUERY_PASSWORD"), false);
    assert.equal(result.stdout.includes("PRIVATE_CLOSE_PASSWORD"), false);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
