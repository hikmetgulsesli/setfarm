import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { hashCanonicalJson } from "../../src/product-compiler/canonical-json.js";

test("shared legacy census is import-inert and never adopts an ambient database URL", () => {
  const url = new URL("../../src/internal-production/baseline-legacy-database-census-v1.ts", import.meta.url).href;
  const result = spawnSync(process.execPath, ["--import", "tsx", "--input-type=module", "-e", `
    import fs from 'node:fs';import net from 'node:net';import {syncBuiltinESMExports,registerHooks} from 'node:module';
    let writes=0,connections=0;const dependencyLoads=[];
    registerHooks({resolve(specifier,context,next){
      if(specifier==='postgres'||/findings|db-pg|runtime-config|baseline-post-handoff-receipt/.test(specifier))dependencyLoads.push(specifier);
      return next(specifier,context);
    }});
    for(const name of ['writeFileSync','mkdirSync','renameSync','unlinkSync','rmdirSync','linkSync','chmodSync','fsyncSync'])fs[name]=()=>{writes++;throw Error('UNEXPECTED_CENSUS_WRITE')};
    net.Socket.prototype.connect=()=>{connections++;throw Error('UNEXPECTED_CENSUS_CONNECTION')};
    syncBuiltinESMExports();
    const module=await import(${JSON.stringify(url)});
    const importDependencyLoads=[...dependencyLoads];
    let error,combinedError;
    try{await module.observeLegacyDatabaseCensusV1(undefined,true)}catch(caught){error=caught.message}
    try{await module.observeLegacyDatabaseCensusAndActiveRowsInOneReadOnlyTransactionV4(undefined)}catch(caught){combinedError=caught.message}
    process.stdout.write(JSON.stringify({error,combinedError,writes,connections,importDependencyLoads,dependencyLoads}));
  `], { encoding: "utf8", timeout: 15000, env: { SETFARM_PG_URL: "postgresql://PRIVATE_AMBIENT_CANARY@127.0.0.1/setfarm" } });
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout), {
    error: "INTERNAL_PRODUCTION_CURRENT_ENTRY_INVALID:legacy zero-owner database is unavailable",
    combinedError: "INTERNAL_PRODUCTION_CURRENT_ENTRY_INVALID:legacy zero-owner database is unavailable",
    writes: 0, connections: 0,
    importDependencyLoads: [], dependencyLoads: ["postgres", "../findings/finding-publication-v1.js",
      "postgres", "../findings/finding-publication-v1.js"],
  });
});

for (const scenario of ["ambient-port", "ambiguous-host"]) {
  test(`cutover profile rejects ${scenario} before any real driver connection`, () => {
    const url = new URL("../../src/internal-production/baseline-legacy-database-census-v1.ts", import.meta.url).href;
    const databaseUrl = scenario === "ambiguous-host"
      ? "postgresql://u:p@remote.invalid,other.invalid@localhost/setfarm"
      : "postgresql://fixture:PRIVATE_PASSWORD@localhost/setfarm";
    const result = spawnSync(process.execPath, ["--import", "tsx", "--input-type=module", "-e", `
      import net from 'node:net';import{syncBuiltinESMExports}from'node:module';
      let connections=0;net.Socket.prototype.connect=()=>{connections++;throw Error('UNEXPECTED_DRIVER_CONNECTION')};syncBuiltinESMExports();
      const module=await import(${JSON.stringify(url)});let error,combinedError;
      try{await module.observeLegacyDatabaseCensusV1(${JSON.stringify(databaseUrl)},true,'cutover-local')}catch(caught){error=caught.message}
      try{await module.observeLegacyDatabaseCensusAndActiveRowsInOneReadOnlyTransactionV4(${JSON.stringify(databaseUrl)})}catch(caught){combinedError=caught.message}
      process.stdout.write(JSON.stringify({error,combinedError,connections}));
    `], { encoding: "utf8", timeout: 15000, env: scenario === "ambient-port" ? { PGPORT: "6543" } : {} });
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(JSON.parse(result.stdout), {
      error: "INTERNAL_PRODUCTION_CURRENT_ENTRY_INVALID:cutover database target is ambiguous",
      combinedError: "INTERNAL_PRODUCTION_CURRENT_ENTRY_INVALID:cutover database target is ambiguous",
      connections: 0,
    });
  });
}

test("cutover profile validates real driver options before one read-only transaction and bounded close", () => {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "cutover-driver-")));
  try {
    const original = new URL("../../src/internal-production/baseline-legacy-database-census-v1.ts", import.meta.url);
    let source = fs.readFileSync(original, "utf8");
    const marker = 'const postgresModule = await import("postgres");';
    assert.equal(source.split(marker).length, 2);
    source = source.replace(marker, `
      const actualModule=await import(${JSON.stringify(new URL("../../node_modules/postgres/src/index.js", import.meta.url).href)});
      const postgresModule={default:(...args)=>{
        const sql=actualModule.default(...args),end=sql.end;
        globalThis.probe.target={host:sql.options.host,port:sql.options.port,database:sql.options.database};
        sql.begin=async mode=>{globalThis.probe.modes.push(mode);throw Error('TRANSACTION_BOUNDARY_REACHED')};
        sql.end=async options=>{globalThis.probe.closes.push(options);return end(options)};
        return sql;
      }};
    `).replace('await import("../findings/finding-publication-v1.js")',
      `await import(${JSON.stringify(new URL("../../src/findings/finding-publication-v1.ts", import.meta.url).href)})`);
    fs.writeFileSync(path.join(root, "package.json"), '{"type":"module"}');
    const file = path.join(root, "census.ts"); fs.writeFileSync(file, source);
    const result = spawnSync(process.execPath, ["--import", "tsx", "--input-type=module", "-e", `
      import net from 'node:net';import{syncBuiltinESMExports}from'node:module';
      globalThis.probe={modes:[],closes:[],connections:0};
      net.Socket.prototype.connect=()=>{globalThis.probe.connections++;throw Error('UNEXPECTED_CONNECTION')};syncBuiltinESMExports();
      const module=await import(${JSON.stringify(pathToFileURL(file).href)});let error;
      try{await module.observeLegacyDatabaseCensusV1('postgresql://fixture:PRIVATE_PASSWORD@localhost/setfarm',true,'cutover-local')}catch(caught){error=caught.message}
      process.stdout.write(JSON.stringify({error,...globalThis.probe}));
    `], { encoding: "utf8", timeout: 15000, env: {} });
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(JSON.parse(result.stdout), {
      error: "TRANSACTION_BOUNDARY_REACHED", modes: ["isolation level repeatable read read only"],
      closes: [{ timeout: 1 }], connections: 0, target: { host: ["localhost"], port: [5432], database: "setfarm" },
    });
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test("pre32 legacy census and active rows share one read-only transaction and bounded close", () => {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "pre32-same-transaction-")));
  try {
    const original = new URL("../../src/internal-production/baseline-legacy-database-census-v1.ts", import.meta.url);
    let source = fs.readFileSync(original, "utf8");
    const marker = 'const postgresModule = await import("postgres");';
    assert.equal(source.split(marker).length, 2);
    source = source.replace(marker, `
      const postgresModule={default:()=>{
        const tx=async strings=>{
          const statement=strings.join('');
          if(statement.startsWith('SET LOCAL')){globalThis.probe.queries.push('set-local');return []}
          if(statement.includes('WITH expected_tables(name)')){
            globalThis.probe.queries.push('cold-catalog');
            return [{laterJournalCount:'0',relationCount:'0',functionCount:'0',typeCount:'0',triggerCount:'0'}]
          }
          if(statement.includes('WITH required_columns(')){
            globalThis.probe.queries.push('legacy-aggregate');
            return [{catalogViolationCount:'0',aprbChildViolationCount:'0',ordinaryBatchViolationCount:'0',
              activeHeaderViolationCount:'0',ownerReservationsRelation:null,ownerAdmissionHeadRelation:null,
              producerSourceRelation:null,producerActivationRelation:null,producerActivationHeadRelation:null,
              producerCurrentRelation:null,activeRunCount:globalThis.probe.scenario==='nonzero-legacy'?'1':'0',
              openClaimCount:'0',executionAttemptCount:'0',
              activeRuntimeSessionCount:'0',activeCompletionOwnerCount:'0',unsettledMandatoryEffectCount:'0',
              artifactReservationCount:'0',publicationBatchCount:'0',artifactPublicationCount:'0',
              terminationOwnerCount:'0',findingOwnerCount:'0',recoveryOwnerCount:'0',operationalDeliveryCount:'0'}]
          }
          if(statement.includes('FROM public.finding_sets ORDER BY')){globalThis.probe.queries.push('finding-sets');return []}
          if(statement.includes('FROM public.findings ORDER BY')){globalThis.probe.queries.push('findings');return []}
          if(statement.includes('FROM public.runs')&&statement.includes('finding_sets')){
            globalThis.probe.queries.push('finding-runs');return []
          }
          throw Error('UNEXPECTED_TAGGED_QUERY')
        };
        class Result extends Array {}
        tx.unsafe=async statement=>{
          let label,rows=[];
          if(statement.includes('oversizedRunCount')){
            label='active-counts';rows=[{runCount:globalThis.probe.scenario==='malformed-active'?'01'
              :['count-mismatch','malformed-active-row'].includes(globalThis.probe.scenario)?'1':'0',
              claimCount:'0',attemptCount:'0',sessionCount:'0',
              oversizedRunCount:'0',oversizedClaimCount:'0',oversizedAttemptCount:'0',oversizedSessionCount:'0'}]
          }else if(statement.startsWith('SELECT id AS "runId"')){
            label='active-runs';
            if(globalThis.probe.scenario==='count-mismatch')rows=[{runId:'run-1',status:'running'}]
            if(globalThis.probe.scenario==='malformed-active-row')rows=[{runId:'run-1',status:'running',extra:true}]
          }
          else if(statement.startsWith('SELECT id::text AS "claimId"'))label='open-claims';
          else if(statement.startsWith('SELECT attempt_id AS "attemptId"'))label='active-attempts';
          else if(statement.startsWith('SELECT session_id AS "sessionId"'))label='active-sessions';
          else throw Error('UNEXPECTED_UNSAFE_QUERY');
          globalThis.probe.queries.push(label);
          const result=new Result(...rows);
          for(const key of ['count','state','command','columns','statement'])
            Object.defineProperty(result,key,{value:null,enumerable:false});
          return result
        };
        return {options:{host:['localhost'],port:[5432],database:'setfarm',user:'fixture'},
          begin:async(mode,operation)=>{
            globalThis.probe.modes.push(mode);
            if(globalThis.probe.scenario==='transaction-failure')throw Error('TRANSACTION_FAILURE');
            return operation(tx)
          },
          end:async options=>{
            globalThis.probe.closes.push(options);
            if(globalThis.probe.scenario==='close-failure')throw Error('CLOSE_FAILURE')
          }}
      }};
    `).replace('await import("../findings/finding-publication-v1.js")',
      `await import(${JSON.stringify(new URL("../../src/findings/finding-publication-v1.ts", import.meta.url).href)})`)
      .replace('await import("./baseline-positive-worktree-active-row-snapshot-v2.js")',
        `await import(${JSON.stringify(new URL("../../src/internal-production/baseline-positive-worktree-active-row-snapshot-v2.ts", import.meta.url).href)})`)
      .replace('await import("../product-compiler/canonical-json.js")',
        `await import(${JSON.stringify(new URL("../../src/product-compiler/canonical-json.ts", import.meta.url).href)})`);
    fs.writeFileSync(path.join(root, "package.json"), '{"type":"module"}');
    const file = path.join(root, "census.ts"); fs.writeFileSync(file, source);
    const script = `
      import net from 'node:net';import{syncBuiltinESMExports}from'node:module';
      globalThis.probe={modes:[],closes:[],queries:[],connections:0,
        scenario:process.env.FAKE_SCENARIO||'success'};
      net.Socket.prototype.connect=()=>{globalThis.probe.connections++;throw Error('UNEXPECTED_CONNECTION')};syncBuiltinESMExports();
      const module=await import(${JSON.stringify(pathToFileURL(file).href)});
      let snapshot,error;
      try{snapshot=globalThis.probe.scenario==='legacy-only'
        ?await module.observeLegacyDatabaseCensusV1('postgresql://fixture:PRIVATE_PASSWORD@localhost/setfarm',true,'cutover-local')
        :await module.observeLegacyDatabaseCensusAndActiveRowsInOneReadOnlyTransactionV4(
          'postgresql://fixture:PRIVATE_PASSWORD@localhost/setfarm')}catch(caught){error=caught.message}
      process.stdout.write(JSON.stringify({snapshot,error,...globalThis.probe}));
    `;
    const result = spawnSync(process.execPath, ["--import", "tsx", "--input-type=module", "-e", script],
      { encoding: "utf8", timeout: 15000, env: {} });
    assert.equal(result.status, 0, result.stderr);
    const observed = JSON.parse(result.stdout);
    assert.equal(observed.error, undefined);
    assert.deepEqual(observed.modes, ["isolation level repeatable read read only"]);
    assert.deepEqual(observed.closes, [{ timeout: 1 }]);
    assert.equal(observed.connections, 0);
    assert.deepEqual(observed.queries, ["set-local", "set-local", "cold-catalog", "legacy-aggregate",
      "finding-sets", "findings", "finding-runs", "active-counts", "active-runs", "open-claims",
      "active-attempts", "active-sessions"]);
    const { snapshotHash, ...body } = observed.snapshot;
    assert.equal(snapshotHash, hashCanonicalJson(body));
    assert.equal(body.schema, "setfarm.internal-production-pre32-active-owner-snapshot.v4");
    assert.equal(body.authority, "diagnostic-only");
    assert.deepEqual(body.activeRows.counts, { runCount: 0, claimCount: 0, attemptCount: 0, sessionCount: 0 });
    assert.equal(body.legacyCensus.activeRunCount, 0);
    for (const [scenario, expectedError, queryCount] of [
      ["malformed-active", "INTERNAL_PRODUCTION_POSITIVE_WORKTREE_ACTIVE_ROW_SNAPSHOT_INVALID", 8],
      ["malformed-active-row", "INTERNAL_PRODUCTION_POSITIVE_WORKTREE_ACTIVE_ROW_SNAPSHOT_INVALID", 9],
      ["nonzero-legacy", "INTERNAL_PRODUCTION_CURRENT_ENTRY_INVALID:activeRunCount is nonzero", 7],
      ["count-mismatch", "INTERNAL_PRODUCTION_CURRENT_ENTRY_INVALID:legacy and active-row counts disagree within one transaction", 12],
      ["transaction-failure", "TRANSACTION_FAILURE", 0],
      ["close-failure", "CLOSE_FAILURE", 12],
    ] as const) {
      const refusedResult = spawnSync(process.execPath, ["--import", "tsx", "--input-type=module", "-e", script],
        { encoding: "utf8", timeout: 15000, env: { FAKE_SCENARIO: scenario } });
      assert.equal(refusedResult.status, 0, `${scenario}: ${refusedResult.stderr}`);
      const refused = JSON.parse(refusedResult.stdout);
      assert.equal(refused.error, expectedError, scenario);
      assert.equal(refused.snapshot, undefined, scenario);
      assert.deepEqual(refused.modes, ["isolation level repeatable read read only"], scenario);
      assert.deepEqual(refused.closes, [{ timeout: 1 }], scenario);
      assert.equal(refused.queries.length, queryCount, scenario);
    }
    const legacyResult = spawnSync(process.execPath, ["--import", "tsx", "--input-type=module", "-e", script],
      { encoding: "utf8", timeout: 15000, env: { FAKE_SCENARIO: "legacy-only" } });
    assert.equal(legacyResult.status, 0, legacyResult.stderr);
    const legacy = JSON.parse(legacyResult.stdout);
    assert.equal(legacy.error, undefined);
    assert.deepEqual(legacy.snapshot, body.legacyCensus);
    assert.deepEqual(legacy.queries, observed.queries.slice(0, 7));
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
