import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { pathToFileURL } from "node:url";

import { observeTask6aWriterCatalogTopologyV2, projectTask6aWriterCatalogTopologyInTransactionV2 } from "../../src/internal-production/baseline-task6a-writer-catalog-topology-v2.js";

const ERROR = "INTERNAL_PRODUCTION_TASK6A_WRITER_CATALOG_TOPOLOGY_INVALID";
const sourceUrl = new URL("../../src/internal-production/baseline-task6a-writer-catalog-topology-v2.ts", import.meta.url);
const localUrl = "postgresql://fixture:PRIVATE_PASSWORD@localhost/setfarm";
const counts = ["directMembership", "directInherit", "directSet", "directAdmin", "schema", "ownedSchema",
  "relation", "ownedRelation", "sequence", "ownedSequence", "routine", "ownedRoutine",
  "securityDefinerRoutine", "selectedExplicitAclRow", "defaultAcl", "ownedDefaultAcl"] as const;

function row(overrides: Record<string, unknown> = {}) {
  return { serverVersionText: "170006", databaseName: "setfarm", sessionRole: "fixture", effectiveRole: "fixture",
    ...Object.fromEntries(counts.map(key => [`${key}CountText`, "0"])), ...overrides };
}

test("one fixed read-only catalog projection is diagnostic only and hashes exact counts", async () => {
  const statements: string[] = [];
  const projected = await projectTask6aWriterCatalogTopologyInTransactionV2(async sql => {
    statements.push(sql);
    return [row({ relationCountText: "42", ownedRelationCountText: "21", directMembershipCountText: "3", directSetCountText: "2" })];
  });
  assert.equal(statements.length, 1);
  assert.match(statements[0]!, /FROM pg_auth_members/);
  assert.equal((statements[0]!.match(/count\(DISTINCT m\.roleid\)::text FROM pg_auth_members/g) ?? []).length, 4);
  assert.match(statements[0]!, /FROM pg_default_acl/);
  assert.match(statements[0]!, /FROM pg_attribute a/);
  assert.match(statements[0]!, /FROM pg_type t/);
  assert.match(statements[0]!, /FROM pg_database ad/);
  assert.match(statements[0]!, /FROM pg_proc/);
  assert.match(statements[0]!, /FROM pg_class/);
  assert.match(statements[0]!, /FROM pg_namespace/);
  assert.equal(projected.authority, "diagnostic-only");
  assert.equal(projected.cutoverAdmission, "not-granted");
  assert.equal(projected.physicalIdentityProvenance, "unverified");
  assert.equal(projected.membershipScope, "direct-only-non-transitive");
  assert.equal(projected.catalogScope, "coarse-selected-catalog-row-counts-not-permission-proof");
  assert.equal(projected.counts.relation, 42);
  assert.equal(projected.counts.ownedRelation, 21);
  assert.equal(projected.counts.directSet, 2);
  assert.match(projected.topologyHash, /^[a-f0-9]{64}$/);
  assert.ok(Object.isFrozen(projected));
  assert.ok(Object.isFrozen(projected.counts));
});

for (const [label, output] of [
  ["missing", []], ["duplicate", [row(), row()]], ["extra field", [row({ extra: "x" })]],
  ["wrong database", [row({ databaseName: "other" })]], ["crossed role", [row({ effectiveRole: "other" })]],
  ["old version", [row({ serverVersionText: "150000" })]], ["future version", [row({ serverVersionText: "200000" })]],
  ["negative", [row({ relationCountText: "-1" })]], ["unsafe", [row({ relationCountText: "9007199254740992" })]],
  ["number", [row({ relationCountText: 1 })]], ["impossible owned", [row({ ownedRelationCountText: "1" })]],
  ["impossible member option", [row({ directSetCountText: "1" })]],
] as const) {
  test(`refuses ${label}`, async () => {
    await assert.rejects(projectTask6aWriterCatalogTopologyInTransactionV2(async () => output), { message: ERROR });
  });
}

test("refuses hostile rows and sanitizes SQL failure", async () => {
  const accessor = row();
  Object.defineProperty(accessor, "sessionRole", { get: () => "fixture", enumerable: true });
  for (const output of [[new Proxy(row(), {})], [accessor], [Object.assign(Object.create(null), row())], new Proxy([row()], {})]) {
    await assert.rejects(projectTask6aWriterCatalogTopologyInTransactionV2(async () => output), { message: ERROR });
  }
  await assert.rejects(projectTask6aWriterCatalogTopologyInTransactionV2(async () => { throw Error("PRIVATE_SQL_ERROR"); }), { message: ERROR });
});

test("adapter import is inert and absent or ambient URL refuses before driver load", () => {
  const child = spawnSync(process.execPath, ["--import", "tsx", "--input-type=module", "-e", `
    import net from 'node:net';import{syncBuiltinESMExports,registerHooks}from'node:module';
    let connections=0;const loads=[];
    registerHooks({resolve(specifier,context,next){if(specifier==='postgres'||/db-pg|runtime-config/.test(specifier))loads.push(specifier);return next(specifier,context)}});
    net.Socket.prototype.connect=()=>{connections++;throw Error('UNEXPECTED_CONNECTION')};syncBuiltinESMExports();
    const module=await import(${JSON.stringify(sourceUrl.href)});const importLoads=[...loads];let error;
    try{await module.observeTask6aWriterCatalogTopologyV2(undefined)}catch(caught){error=caught.message}
    process.stdout.write(JSON.stringify({error,connections,importLoads,loads}));
  `], { encoding: "utf8", timeout: 15000, env: { SETFARM_PG_URL: "postgresql://PRIVATE_AMBIENT@localhost/setfarm" } });
  assert.equal(child.status, 0, child.stderr);
  assert.deepEqual(JSON.parse(child.stdout), { error: ERROR, connections: 0, importLoads: [], loads: [] });
});

for (const scenario of ["ambient-pg", "remote", "other-port", "query", "fragment", "wrong-database", "empty-user"]) {
  test(`adapter rejects ${scenario} before driver load`, () => {
    const input = scenario === "remote" ? "postgresql://fixture:PRIVATE_PASSWORD@remote.invalid/setfarm"
      : scenario === "other-port" ? "postgresql://fixture:PRIVATE_PASSWORD@localhost:5433/setfarm"
        : scenario === "query" ? `${localUrl}?sslmode=disable`
          : scenario === "fragment" ? `${localUrl}#x`
            : scenario === "wrong-database" ? "postgresql://fixture:PRIVATE_PASSWORD@localhost/other"
              : scenario === "empty-user" ? "postgresql://:PRIVATE_PASSWORD@localhost/setfarm" : localUrl;
    const child = spawnSync(process.execPath, ["--import", "tsx", "--input-type=module", "-e", `
      import{registerHooks}from'node:module';let loads=0;
      registerHooks({resolve(specifier,context,next){if(specifier==='postgres')loads++;return next(specifier,context)}});
      const module=await import(${JSON.stringify(sourceUrl.href)});let error;
      try{await module.observeTask6aWriterCatalogTopologyV2(${JSON.stringify(input)})}catch(caught){error=caught.message}
      process.stdout.write(JSON.stringify({error,loads}));
    `], { encoding: "utf8", timeout: 15000, env: scenario === "ambient-pg" ? { PGPORT: "6543" } : {} });
    assert.equal(child.status, 0, child.stderr);
    assert.deepEqual(JSON.parse(child.stdout), { error: ERROR, loads: 0 });
  });
}

test("adapter uses one bounded read-only transaction and sanitizes driver/cleanup failures", () => {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "task6a-writer-catalog-")));
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
            const tx=(strings)=>{globalThis.probe.locals.push(strings[0]);return []};
            tx.unsafe=async statement=>{globalThis.probe.statements.push(statement);
              if(globalThis.probe.failure)throw Error('PRIVATE_SQL_ERROR');
              class Result extends Array{};const result=new Result(globalThis.probe.row);
              for(const key of ['count','state','command','columns','statement'])Object.defineProperty(result,key,{value:null});
              return result};return operation(tx)},
          end:async options=>{globalThis.probe.closes.push(options);if(globalThis.probe.closeFailure)throw Error('PRIVATE_CLOSE_ERROR')}
        }} };`);
    fs.writeFileSync(path.join(root, "package.json"), '{"type":"module"}');
    const file = path.join(root, "observer.ts");fs.writeFileSync(file, source);
    const child = spawnSync(process.execPath, ["--import", "tsx", "--input-type=module", "-e", `
      const module=await import(${JSON.stringify(pathToFileURL(file).href)});
      const run=async flags=>{globalThis.probe={row:${JSON.stringify(row())},...flags,url:null,options:null,modes:[],locals:[],statements:[],closes:[]};let output,error;
        try{const value=await module.observeTask6aWriterCatalogTopologyV2(${JSON.stringify(localUrl)});output={authority:value.authority,sessionRole:value.sessionRole}}
        catch(caught){error=caught.message};const {probe}=globalThis;return{output,error,modes:probe.modes,locals:probe.locals,queries:probe.statements.length,closes:probe.closes,target:probe.options}};
      process.stdout.write(JSON.stringify({success:await run({}),failure:await run({failure:true}),
        wrongTarget:await run({wrongTarget:true}),wrongRole:await run({row:{...${JSON.stringify(row())},sessionRole:'other',effectiveRole:'other'}}),
        closeFailure:await run({closeFailure:true})}));
    `], { encoding: "utf8", timeout: 20000, env: {} });
    assert.equal(child.status, 0, child.stderr);
    const observed = JSON.parse(child.stdout);
    for (const entry of [observed.success, observed.failure, observed.wrongRole, observed.closeFailure]) {
      assert.deepEqual(entry.modes, ["isolation level repeatable read read only"]);
      assert.deepEqual(entry.closes, [{ timeout: 1 }]);
      assert.equal(entry.locals.length, 2);
      assert.equal(entry.target.max, 1);
      assert.equal(entry.target.connection.statement_timeout, 5000);
    }
    assert.deepEqual(observed.success.output, { authority: "diagnostic-only", sessionRole: "fixture" });
    assert.equal(observed.success.queries, 1);
    assert.equal(observed.failure.error, ERROR);
    assert.equal(observed.wrongRole.error, ERROR);
    assert.equal(observed.closeFailure.error, ERROR);
    assert.equal(observed.wrongTarget.error, ERROR);
    assert.deepEqual(observed.wrongTarget.modes, []);
    assert.deepEqual(observed.wrongTarget.closes, [{ timeout: 1 }]);
    assert.doesNotMatch(child.stdout, /PRIVATE_SQL_ERROR|PRIVATE_CLOSE_ERROR|PRIVATE_PASSWORD/);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
