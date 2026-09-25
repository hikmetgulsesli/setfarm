import assert from "node:assert/strict";
import { test } from "node:test";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

const sourceUrl = new URL("../../src/internal-production/baseline-positive-worktree-active-binding-cutover-database-v1.ts", import.meta.url);
const localUrl = "postgresql://fixture:PRIVATE_PASSWORD@localhost/setfarm";

test("cutover-local observer is import-inert and refuses an absent or ambient URL", () => {
  const result = spawnSync(process.execPath, ["--import", "tsx", "--input-type=module", "-e", `
    import net from 'node:net';import{syncBuiltinESMExports,registerHooks}from'node:module';
    let connections=0;const loads=[];
    registerHooks({resolve(specifier,context,next){if(specifier==='postgres'||/db-pg|runtime-config/.test(specifier))loads.push(specifier);return next(specifier,context)}});
    net.Socket.prototype.connect=()=>{connections++;throw Error('UNEXPECTED_CONNECTION')};syncBuiltinESMExports();
    const module=await import(${JSON.stringify(sourceUrl.href)});const importLoads=[...loads];let error;
    try{await module.observePositiveWorktreeActiveBindingCutoverDatabaseV1(undefined)}catch(caught){error=caught.message}
    process.stdout.write(JSON.stringify({error,connections,importLoads,loads}));
  `], { encoding: "utf8", timeout: 15000, env: { SETFARM_PG_URL: "postgresql://PRIVATE_AMBIENT@127.0.0.1/setfarm" } });
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout), { error: "INTERNAL_PRODUCTION_POSITIVE_WORKTREE_CUTOVER_DATABASE_INVALID",
    connections: 0, importLoads: [], loads: [] });
});

for (const scenario of ["ambient-pg", "remote-host", "query", "multiple-host", "wrong-database"]) {
  test(`cutover-local observer refuses ${scenario} before driver load`, () => {
    const input = scenario === "remote-host" ? "postgresql://fixture:PRIVATE_PASSWORD@remote.invalid/setfarm"
      : scenario === "query" ? `${localUrl}?sslmode=disable`
        : scenario === "multiple-host" ? "postgresql://fixture:PRIVATE_PASSWORD@localhost,remote.invalid/setfarm"
          : scenario === "wrong-database" ? "postgresql://fixture:PRIVATE_PASSWORD@localhost/other" : localUrl;
    const result = spawnSync(process.execPath, ["--import", "tsx", "--input-type=module", "-e", `
      import{registerHooks}from'node:module';let loads=0;
      registerHooks({resolve(specifier,context,next){if(specifier==='postgres')loads++;return next(specifier,context)}});
      const module=await import(${JSON.stringify(sourceUrl.href)});let error;
      try{await module.observePositiveWorktreeActiveBindingCutoverDatabaseV1(${JSON.stringify(input)})}catch(caught){error=caught.message}
      process.stdout.write(JSON.stringify({error,loads}));
    `], { encoding: "utf8", timeout: 15000, env: scenario === "ambient-pg" ? { PGPORT: "6543" } : {} });
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(JSON.parse(result.stdout), { error: "INTERNAL_PRODUCTION_POSITIVE_WORKTREE_CUTOVER_DATABASE_INVALID", loads: 0 });
  });
}

test("one read-only transaction normalizes eight postgres.js Results and closes on success or failure", () => {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "cutover-active-binding-")));
  try {
    let source = fs.readFileSync(sourceUrl, "utf8");
    const marker = 'const postgresModule = await import("postgres");';
    assert.equal(source.split(marker).length, 2);
    source = source.replace('from "./baseline-positive-worktree-active-binding-snapshot-v1.js"',
      `from ${JSON.stringify(new URL("../../src/internal-production/baseline-positive-worktree-active-binding-snapshot-v1.ts", import.meta.url).href)}`)
      .replace('from "./baseline-positive-worktree-active-row-snapshot-v2.js"',
        `from ${JSON.stringify(new URL("../../src/internal-production/baseline-positive-worktree-active-row-snapshot-v2.ts", import.meta.url).href)}`)
      .replace(marker, `const postgresModule={default:(url,options)=>{
        globalThis.probe.url=url;globalThis.probe.options=options;
        return {options:{host:[globalThis.probe.wrongTarget?'remote.invalid':'localhost'],port:[5432],database:'setfarm',user:'fixture'},
          begin:async(mode,operation)=>{globalThis.probe.modes.push(mode);
            const tx=(strings)=>{globalThis.probe.locals.push(strings[0]);return []};
            tx.unsafe=async statement=>{globalThis.probe.statements.push(statement);
              if(globalThis.probe.failure&&globalThis.probe.statements.length===3)throw Error('PRIVATE_QUERY_PASSWORD');
              const rows=globalThis.probe.rows[globalThis.probe.statements.length-1];
              class Result extends Array{};const result=new Result(...rows);
              for(const key of ['count','state','command','columns','statement'])Object.defineProperty(result,key,{value:null});
              return result};return operation(tx)},
          end:async options=>{globalThis.probe.closes.push(options);if(globalThis.probe.closeFailure)throw Error('PRIVATE_CLOSE_PASSWORD')}
        }} };`);
    fs.writeFileSync(path.join(root, "package.json"), '{"type":"module"}');
    const file = path.join(root, "observer.ts"); fs.writeFileSync(file, source);
    const result = spawnSync(process.execPath, ["--import", "tsx", "--input-type=module", "-e", `
      const module=await import(${JSON.stringify(pathToFileURL(file).href)});
      const rows=[[{runCount:'0',claimCount:'0',attemptCount:'0',sessionCount:'0',oversizedRunCount:'0',oversizedClaimCount:'0',oversizedAttemptCount:'0',oversizedSessionCount:'0'}],[],[],[],[],[{attemptCount:'0',sessionCount:'0',oversizedAttemptCount:'0',oversizedSessionCount:'0'}],[],[]];
      const run=async flags=>{globalThis.probe={...flags,rows,url:null,options:null,modes:[],locals:[],statements:[],closes:[]};let output,error;
        try{const snapshot=await module.observePositiveWorktreeActiveBindingCutoverDatabaseV1(${JSON.stringify(localUrl)});output={authority:snapshot.authority,attemptCount:snapshot.bindingRows.counts.attemptCount}}
        catch(caught){error=caught.message};const {probe}=globalThis;return{output,error,modes:probe.modes,locals:probe.locals,queries:probe.statements.length,closes:probe.closes,url:probe.url,target:probe.options}};
      process.stdout.write(JSON.stringify({success:await run({}),failure:await run({failure:true}),
        wrongTarget:await run({wrongTarget:true}),closeFailure:await run({closeFailure:true})}));
    `], { encoding: "utf8", timeout: 15000, env: {} });
    assert.equal(result.status, 0, result.stderr);
    const observed = JSON.parse(result.stdout);
    for (const entry of [observed.success, observed.failure, observed.closeFailure]) {
      assert.deepEqual(entry.modes, ["isolation level repeatable read read only"]);
      assert.deepEqual(entry.closes, [{ timeout: 1 }]);
      assert.equal(entry.locals.length, 2);
      assert.equal(entry.url, localUrl);
      assert.equal(entry.target.max, 1);
      assert.equal(entry.target.connect_timeout, 5);
    }
    assert.deepEqual(observed.success.output, { authority: "diagnostic-only", attemptCount: 0 });
    assert.equal(observed.success.queries, 8);
    assert.equal(observed.failure.error, "INTERNAL_PRODUCTION_POSITIVE_WORKTREE_CUTOVER_DATABASE_INVALID");
    assert.equal(observed.failure.queries, 3);
    assert.equal(observed.wrongTarget.error, "INTERNAL_PRODUCTION_POSITIVE_WORKTREE_CUTOVER_DATABASE_INVALID");
    assert.deepEqual(observed.wrongTarget.modes, []);
    assert.deepEqual(observed.wrongTarget.closes, [{ timeout: 1 }]);
    assert.equal(observed.closeFailure.error, "INTERNAL_PRODUCTION_POSITIVE_WORKTREE_CUTOVER_DATABASE_INVALID");
    assert.deepEqual(observed.closeFailure.closes, [{ timeout: 1 }]);
    assert.equal(result.stdout.includes("PRIVATE_QUERY_PASSWORD"), false);
    assert.equal(result.stdout.includes("PRIVATE_CLOSE_PASSWORD"), false);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
