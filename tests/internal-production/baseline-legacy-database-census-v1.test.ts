import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { hashCanonicalJson } from "../../src/product-compiler/canonical-json.js";

test("pre32 fixed-table lock entry refuses an absent private database URL before connection", () => {
  const url = new URL("../../src/internal-production/baseline-legacy-database-census-v1.ts", import.meta.url).href;
  const result = spawnSync(process.execPath, ["--import", "tsx", "--input-type=module", "-e", `
    import net from 'node:net';import{syncBuiltinESMExports}from'node:module';
    let connections=0;net.Socket.prototype.connect=()=>{connections++;throw Error('UNEXPECTED_CONNECTION')};syncBuiltinESMExports();
    const module=await import(${JSON.stringify(url)});let error;
    try{await module.observeLegacyDatabaseCensusWithPre32ShareLocksV1(undefined)}catch(caught){error=caught.message}
    let v2Error;try{await module.observeLegacyDatabaseCensusWithPre32ShareLocksV2(undefined)}catch(caught){v2Error=caught.message}
    process.stdout.write(JSON.stringify({error,v2Error,connections}));
  `], { encoding: "utf8", timeout: 15000, env: {} });
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout), {
    error: "INTERNAL_PRODUCTION_CURRENT_ENTRY_INVALID:legacy zero-owner database is unavailable",
    v2Error: "INTERNAL_PRODUCTION_CURRENT_ENTRY_INVALID:legacy zero-owner database is unavailable",
    connections: 0,
  });
});

test("pre32 SHARE-lock diagnostic locks its fixed table set before journal and legacy count reads", () => {
  // Mutation caught: moving any lock after the first census read, omitting a
  // listed owner table, or retaining the old repeatable-read transaction mode.
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "pre32-writer-locks-")));
  try {
    let source = fs.readFileSync(new URL("../../src/internal-production/baseline-legacy-database-census-v1.ts", import.meta.url), "utf8");
    const marker = 'const postgresModule = await import("postgres");';
    assert.equal(source.split(marker).length, 2);
    source = source.replace(marker, `const postgresModule={default:()=>{
      const tx=async strings=>{
        const sql=strings.join('');
        if(sql.startsWith('SET LOCAL')){globalThis.probe.queries.push('set-local');return []}
        if(sql.includes('FROM public.setfarm_schema_migrations')&&sql.includes('ORDER BY version')){
          globalThis.probe.queries.push('journal-head');
          return [26,27,28,29,30,31,...(process.env.FAKE_SCENARIO==='future-head'?[32]:[])]
            .map(version=>({version,state:'applied'}))
        }
        if(sql.includes('WITH expected_tables(name)')){
          globalThis.probe.queries.push('cold-catalog');
          return [{laterJournalCount:'0',relationCount:'0',functionCount:'0',typeCount:'0',triggerCount:'0'}]
        }
        if(sql.includes('WITH required_columns(')){
          globalThis.probe.queries.push('legacy-aggregate');
          return [{catalogViolationCount:'0',aprbChildViolationCount:'0',ordinaryBatchViolationCount:'0',
            activeHeaderViolationCount:'0',ownerReservationsRelation:null,ownerAdmissionHeadRelation:null,
            producerSourceRelation:null,producerActivationRelation:null,producerActivationHeadRelation:null,
            producerCurrentRelation:null,activeRunCount:'0',openClaimCount:'0',executionAttemptCount:'0',
            activeRuntimeSessionCount:'0',activeCompletionOwnerCount:'0',unsettledMandatoryEffectCount:'0',
            artifactReservationCount:'0',publicationBatchCount:'0',artifactPublicationCount:'0',
            terminationOwnerCount:'0',findingOwnerCount:'0',recoveryOwnerCount:'0',operationalDeliveryCount:'0'}]
        }
        if(sql.includes('FROM public.finding_sets ORDER BY'))return [];
        if(sql.includes('FROM public.findings ORDER BY'))return [];
        if(sql.includes('FROM public.runs')&&sql.includes('finding_sets'))return [];
        throw Error('UNEXPECTED_TAGGED_QUERY');
      };
      tx.unsafe=async sql=>{
        globalThis.probe.queries.push(sql);
        if(process.env.FAKE_SCENARIO==='lock-failure'&&sql==='LOCK TABLE public.claim_log IN SHARE MODE')
          throw Error('PRIVATE_DATABASE_DETAIL');
        return []
      };
      return {options:{host:['localhost'],port:[5432],database:'setfarm',user:'fixture'},
        begin:async(mode,operation)=>{globalThis.probe.mode=mode;return operation(tx)},
        end:async options=>{globalThis.probe.close=options}};
    }};`).replace('await import("../findings/finding-publication-v1.js")',
      `await import(${JSON.stringify(new URL("../../src/findings/finding-publication-v1.ts", import.meta.url).href)})`);
    source = source.replace('await import("../db/contract-spine-migrations.js")', `await Promise.resolve({
      get verifyHeldPre32ContractSpineJournalIdentityV1(){
        globalThis.probe.queries.push('verifier-loaded');
        return async query=>{
          globalThis.probe.queries.push('full-journal-identity');
          await query('SELECT version, name, checksum, state FROM public.setfarm_schema_migrations WHERE version <= $1 ORDER BY version',[31]);
          if(process.env.FAKE_SCENARIO==='identity-failure')throw Error('PRIVATE_JOURNAL_DETAIL');
        }
      }
    })`);
    fs.writeFileSync(path.join(root, "package.json"), '{"type":"module"}');
    const file = path.join(root, "census.ts"); fs.writeFileSync(file, source);
    const result = spawnSync(process.execPath, ["--import", "tsx", "--input-type=module", "-e", `
      globalThis.probe={queries:[]};const module=await import(${JSON.stringify(pathToFileURL(file).href)});
      let snapshot,error;try{snapshot=await module.observeLegacyDatabaseCensusWithPre32ShareLocksV1(
        'postgresql://fixture:PRIVATE_PASSWORD@localhost/setfarm')}catch(caught){error=caught.message}
      process.stdout.write(JSON.stringify({snapshot,error,...globalThis.probe}));
    `], { encoding: "utf8", timeout: 15000, env: {} });
    assert.equal(result.status, 0, result.stderr);
    const observed = JSON.parse(result.stdout);
    assert.equal(observed.error, undefined);
    assert.equal(observed.mode, "isolation level read committed read only");
    assert.deepEqual(observed.close, { timeout: 1 });
    assert.equal(observed.snapshot.authority, "diagnostic-only");
    assert.equal(observed.snapshot.tableLockScope, "fixed-pre32-legacy-superset");
    assert.equal(observed.snapshot.journalIdentity, "tail-ordinal-state-only");
    assert.equal(observed.snapshot.lockState, "released-at-return");
    const locked = observed.queries.filter((query: string) => query.startsWith("LOCK TABLE "));
    const expected = [
      "artifact_capacity", "artifact_publication_batch_items", "artifact_publication_batch_plan_items",
      "artifact_publication_batch_plans", "artifact_publication_batches", "artifact_publication_reservations",
      "artifact_store_authorities",
      "claim_log", "execution_attempts", "finding_sets", "findings", "operational_event_deliveries",
      "operational_outbox", "platform_release_store_records_v3", "product_compilation_attempts", "product_packets",
      "recovery_cases", "recovery_dispatch_deliveries", "recovery_revision_dispatches", "run_termination_requests",
      "runs", "runtime_completion_effects", "runtime_completion_requests", "runtime_sessions",
      "semantic_artifacts", "setfarm_schema_migrations", "steps", "stories",
      "v3_canary_admission_claims", "v3_preparation_authorities_v2",
      "v3_preparation_authority_attempts_v2", "v3_preparation_authority_claims_v2",
      "v3_preparation_blocks", "v3_preparation_story_state", "v3_story_claim_runtime_binding_cutovers_v1",
      "v3_story_claim_runtime_bindings_v1",
    ].map(table => `LOCK TABLE public.${table} IN SHARE MODE`);
    assert.deepEqual(locked, expected);
    assert.ok(observed.queries.indexOf(locked.at(-1)) < observed.queries.indexOf("journal-head"));
    assert.ok(observed.queries.indexOf("journal-head") < observed.queries.indexOf("cold-catalog"));
    assert.ok(observed.queries.indexOf("cold-catalog") < observed.queries.indexOf("legacy-aggregate"));
    const v2 = spawnSync(process.execPath, ["--import", "tsx", "--input-type=module", "-e", `
      globalThis.probe={queries:[]};const module=await import(${JSON.stringify(pathToFileURL(file).href)});
      let snapshot,error;try{snapshot=await module.observeLegacyDatabaseCensusWithPre32ShareLocksV2(
        'postgresql://fixture:PRIVATE_PASSWORD@localhost/setfarm')}catch(caught){error=caught.message}
      process.stdout.write(JSON.stringify({snapshot,error,...globalThis.probe}));
    `], { encoding: "utf8", timeout: 15000, env: {} });
    assert.equal(v2.status, 0, v2.stderr);
    const exact = JSON.parse(v2.stdout);
    assert.equal(exact.error, undefined, v2.stdout);
    assert.equal(exact.mode, "isolation level read committed read only");
    assert.equal(exact.snapshot.schema, "setfarm.internal-production-pre32-locked-database-census.v2");
    assert.equal(exact.snapshot.authority, "diagnostic-only");
    assert.equal(exact.snapshot.journalIdentity, "source-ordinal-name-checksum-state-1-through-31");
    assert.equal(exact.snapshot.lockState, "released-at-return");
    assert.ok(exact.queries.indexOf("verifier-loaded") < exact.queries.indexOf("set-local"));
    const fullIdentity = exact.queries.indexOf("full-journal-identity");
    assert.ok(fullIdentity > exact.queries.indexOf(locked.at(-1)));
    assert.ok(fullIdentity < exact.queries.indexOf("journal-head"));
    assert.ok(exact.queries.indexOf("journal-head") < exact.queries.indexOf("cold-catalog"));
    const v2Refused = spawnSync(process.execPath, ["--import", "tsx", "--input-type=module", "-e", `
      globalThis.probe={queries:[]};const module=await import(${JSON.stringify(pathToFileURL(file).href)});
      let error;try{await module.observeLegacyDatabaseCensusWithPre32ShareLocksV2(
        'postgresql://fixture:PRIVATE_PASSWORD@localhost/setfarm')}catch(caught){error=caught.message}
      process.stdout.write(JSON.stringify({error,...globalThis.probe}));
    `], { encoding: "utf8", timeout: 15000, env: { FAKE_SCENARIO: "identity-failure" } });
    assert.equal(v2Refused.status, 0, v2Refused.stderr);
    const identityFailure = JSON.parse(v2Refused.stdout);
    assert.equal(identityFailure.error, "INTERNAL_PRODUCTION_CURRENT_ENTRY_INVALID:pre32 fixed-table lock census failed");
    assert.ok(!identityFailure.queries.includes("cold-catalog"));
    assert.ok(!v2Refused.stdout.includes("PRIVATE_JOURNAL_DETAIL"));
    const v2Future = spawnSync(process.execPath, ["--import", "tsx", "--input-type=module", "-e", `
      globalThis.probe={queries:[]};const module=await import(${JSON.stringify(pathToFileURL(file).href)});
      let error;try{await module.observeLegacyDatabaseCensusWithPre32ShareLocksV2(
        'postgresql://fixture:PRIVATE_PASSWORD@localhost/setfarm')}catch(caught){error=caught.message}
      process.stdout.write(JSON.stringify({error,...globalThis.probe}));
    `], { encoding: "utf8", timeout: 15000, env: { FAKE_SCENARIO: "future-head" } });
    assert.equal(v2Future.status, 0, v2Future.stderr);
    assert.equal(JSON.parse(v2Future.stdout).error,
      "INTERNAL_PRODUCTION_CURRENT_ENTRY_INVALID:pre32 fixed-table lock census failed");
    for (const scenario of ["lock-failure", "future-head"]) {
      const refused = spawnSync(process.execPath, ["--import", "tsx", "--input-type=module", "-e", `
        globalThis.probe={queries:[]};const module=await import(${JSON.stringify(pathToFileURL(file).href)});
        let error;try{await module.observeLegacyDatabaseCensusWithPre32ShareLocksV1(
          'postgresql://fixture:PRIVATE_PASSWORD@localhost/setfarm')}catch(caught){error=caught.message}
        process.stdout.write(JSON.stringify({error,...globalThis.probe}));
      `], { encoding: "utf8", timeout: 15000, env: { FAKE_SCENARIO: scenario } });
      assert.equal(refused.status, 0, `${scenario}: ${refused.stderr}`);
      const output = JSON.parse(refused.stdout);
      assert.equal(output.error, "INTERNAL_PRODUCTION_CURRENT_ENTRY_INVALID:pre32 fixed-table lock census failed", scenario);
      assert.ok(!output.queries.includes("cold-catalog"), scenario);
      assert.ok(!refused.stdout.includes("PRIVATE_DATABASE_DETAIL"), scenario);
    }
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

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
    let error,combinedError,quarantineError,bindingError;
    try{await module.observeLegacyDatabaseCensusV1(undefined,true)}catch(caught){error=caught.message}
    try{await module.observeLegacyDatabaseCensusAndActiveRowsInOneReadOnlyTransactionV4(undefined)}catch(caught){combinedError=caught.message}
    try{await module.observeLegacyDatabaseCensusAndActiveRowsWithQuarantineV5(undefined)}catch(caught){quarantineError=caught.message}
    try{await module.observeLegacyDatabaseCensusAndBindingRowsV6(undefined)}catch(caught){bindingError=caught.message}
    process.stdout.write(JSON.stringify({error,combinedError,quarantineError,bindingError,writes,connections,importDependencyLoads,dependencyLoads}));
  `], { encoding: "utf8", timeout: 15000, env: { SETFARM_PG_URL: "postgresql://PRIVATE_AMBIENT_CANARY@127.0.0.1/setfarm" } });
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout), {
    error: "INTERNAL_PRODUCTION_CURRENT_ENTRY_INVALID:legacy zero-owner database is unavailable",
    combinedError: "INTERNAL_PRODUCTION_CURRENT_ENTRY_INVALID:legacy zero-owner database is unavailable",
    quarantineError: "INTERNAL_PRODUCTION_CURRENT_ENTRY_INVALID:legacy zero-owner database is unavailable",
    bindingError: "INTERNAL_PRODUCTION_CURRENT_ENTRY_INVALID:legacy zero-owner database is unavailable",
    writes: 0, connections: 0,
    importDependencyLoads: [], dependencyLoads: ["postgres", "../findings/finding-publication-v1.js",
      "postgres", "../findings/finding-publication-v1.js", "postgres", "../findings/finding-publication-v1.js",
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
          if(globalThis.probe.queries.includes('quarantined-runtimes')){
            if(globalThis.probe.scenario==='binding-query-failure')throw Error('BINDING_QUERY_FAILURE');
            if(statement.includes('"oversizedSessionCount"')){
              label='binding-counts';rows=[{attemptCount:['binding-count-mismatch','binding-cross-count'].includes(globalThis.probe.scenario)?'1':'0',
                sessionCount:'0',oversizedAttemptCount:'0',oversizedSessionCount:'0'}]
            }else if(statement.includes('fence_token AS "fenceToken"')){
              label='binding-attempts';
              if(globalThis.probe.scenario==='binding-cross-count')rows=[{attemptId:'attempt-1',runId:'run-1',
                claimId:null,generation:1,fenceToken:'a'.repeat(64),sourceSha:'b'.repeat(40),
                sourceTreeHash:'c'.repeat(40),worktreeRoot:null,disposition:'running'}]
            }
            else if(statement.includes('FROM public.runtime_sessions'))label='binding-sessions';
            else throw Error('UNEXPECTED_BINDING_QUERY');
          }
          else if(statement.includes('oversizedRunCount')){
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
          else if(statement.includes('"quarantinedRuntimeSessionCount"')){
            label='quarantined-runtimes';
            if(globalThis.probe.scenario==='quarantine-query-failure')throw Error('QUARANTINE_QUERY_FAILURE');
            if(globalThis.probe.scenario!=='quarantine-missing')rows=[{
              quarantinedRuntimeSessionCount:globalThis.probe.scenario==='quarantine-positive'?'2'
                :globalThis.probe.scenario==='quarantine-malformed'?'01'
                :globalThis.probe.scenario==='quarantine-overflow'?'9007199254740992'
                :globalThis.probe.scenario==='quarantine-negative'?'-1':'0',
              ...(globalThis.probe.scenario==='quarantine-extra'?{extra:'PRIVATE_SENTINEL'}:{})}];
            if(globalThis.probe.scenario==='quarantine-duplicate')rows.push({...rows[0]});
            if(globalThis.probe.scenario==='quarantine-accessor')
              Object.defineProperty(rows[0],'quarantinedRuntimeSessionCount',
                {enumerable:true,get(){throw Error('PRIVATE_SENTINEL')}});
            if(globalThis.probe.scenario==='quarantine-proxy')
              rows[0]=new Proxy(rows[0],{get(){throw Error('PRIVATE_SENTINEL')}});
          }
          else throw Error('UNEXPECTED_UNSAFE_QUERY');
          globalThis.probe.queries.push(label);
          const result=new Result(...rows);
          for(const key of ['count','state','command','columns','statement'])
            Object.defineProperty(result,key,{value:null,enumerable:false});
          if(globalThis.probe.scenario==='binding-extra-metadata'&&label==='binding-counts')
            Object.defineProperty(result,'extra',{value:'PRIVATE_SENTINEL'});
          if(globalThis.probe.scenario==='quarantine-index-accessor'&&label==='quarantined-runtimes')
            Object.defineProperty(result,'0',{enumerable:true,get(){throw Error('PRIVATE_SENTINEL')}});
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
      .replaceAll('await import("./baseline-positive-worktree-active-row-snapshot-v2.js")',
        `await import(${JSON.stringify(new URL("../../src/internal-production/baseline-positive-worktree-active-row-snapshot-v2.ts", import.meta.url).href)})`)
      .replaceAll('await import("./baseline-positive-worktree-binding-rows-v1.js")',
        `await import(${JSON.stringify(new URL("../../src/internal-production/baseline-positive-worktree-binding-rows-v1.ts", import.meta.url).href)})`)
      .replaceAll('await import("../product-compiler/canonical-json.js")',
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
        :process.env.FAKE_V6==='1'
          ?await module.observeLegacyDatabaseCensusAndBindingRowsV6(
            'postgresql://fixture:PRIVATE_PASSWORD@localhost/setfarm')
        :process.env.FAKE_V5==='1'
          ?await module.observeLegacyDatabaseCensusAndActiveRowsWithQuarantineV5(
            'postgresql://fixture:PRIVATE_PASSWORD@localhost/setfarm')
          :await module.observeLegacyDatabaseCensusAndActiveRowsInOneReadOnlyTransactionV4(
            'postgresql://fixture:PRIVATE_PASSWORD@localhost/setfarm')}catch(caught){error=caught.message}
      process.stdout.write(JSON.stringify({snapshot,error,frozen:snapshot&&Object.isFrozen(snapshot),...globalThis.probe}));
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
    for (const [scenario, expectedCount, expectedError] of [
      ["success", 0, undefined],
      ["quarantine-positive", 2, undefined],
      ["quarantine-malformed", undefined, "INTERNAL_PRODUCTION_CURRENT_ENTRY_INVALID:quarantined runtime census invalid"],
      ["quarantine-overflow", undefined, "INTERNAL_PRODUCTION_CURRENT_ENTRY_INVALID:quarantined runtime census invalid"],
      ["quarantine-negative", undefined, "INTERNAL_PRODUCTION_CURRENT_ENTRY_INVALID:quarantined runtime census invalid"],
      ["quarantine-extra", undefined, "INTERNAL_PRODUCTION_CURRENT_ENTRY_INVALID:quarantined runtime census invalid"],
      ["quarantine-missing", undefined, "INTERNAL_PRODUCTION_CURRENT_ENTRY_INVALID:quarantined runtime census invalid"],
      ["quarantine-duplicate", undefined, "INTERNAL_PRODUCTION_CURRENT_ENTRY_INVALID:quarantined runtime census invalid"],
      ["quarantine-accessor", undefined, "INTERNAL_PRODUCTION_CURRENT_ENTRY_INVALID:quarantined runtime census invalid"],
      ["quarantine-index-accessor", undefined, "INTERNAL_PRODUCTION_CURRENT_ENTRY_INVALID:quarantined runtime census invalid"],
      ["quarantine-proxy", undefined, "INTERNAL_PRODUCTION_CURRENT_ENTRY_INVALID:quarantined runtime census invalid"],
      ["quarantine-query-failure", undefined, "QUARANTINE_QUERY_FAILURE"],
    ] as const) {
      const v5Result = spawnSync(process.execPath, ["--import", "tsx", "--input-type=module", "-e", script],
        { encoding: "utf8", timeout: 15000, env: { FAKE_V5: "1", FAKE_SCENARIO: scenario } });
      assert.equal(v5Result.status, 0, `${scenario}: ${v5Result.stderr}`);
      const v5 = JSON.parse(v5Result.stdout);
      assert.equal(v5.error, expectedError, scenario);
      assert.deepEqual(v5.modes, ["isolation level repeatable read read only"], scenario);
      assert.deepEqual(v5.closes, [{ timeout: 1 }], scenario);
      assert.deepEqual(v5.queries, scenario === "quarantine-query-failure" ? observed.queries
        : [...observed.queries, "quarantined-runtimes"], scenario);
      if (expectedError) assert.equal(v5.snapshot, undefined, scenario);
      else {
        const { snapshotHash: v5Hash, ...v5Body } = v5.snapshot;
        assert.equal(v5.frozen, true, scenario);
        assert.equal(v5Hash, hashCanonicalJson(v5Body), scenario);
        assert.deepEqual(v5Body, { schema: "setfarm.internal-production-pre32-active-owner-snapshot.v5",
          authority: "diagnostic-only", legacyCensus: body.legacyCensus,
          activeRows: body.activeRows, quarantinedRuntimeSessionCount: expectedCount }, scenario);
      }
    }
    for (const [scenario, expectedError] of [
      ["success", undefined],
      ["binding-count-mismatch", "INTERNAL_PRODUCTION_POSITIVE_WORKTREE_BINDING_ROWS_INVALID"],
      ["binding-cross-count", "INTERNAL_PRODUCTION_CURRENT_ENTRY_INVALID:active and binding-row counts disagree within one transaction"],
      ["binding-extra-metadata", "INTERNAL_PRODUCTION_POSITIVE_WORKTREE_ACTIVE_ROW_SNAPSHOT_INVALID"],
      ["binding-query-failure", "BINDING_QUERY_FAILURE"],
    ] as const) {
      const v6Result = spawnSync(process.execPath, ["--import", "tsx", "--input-type=module", "-e", script],
        { encoding: "utf8", timeout: 15000, env: { FAKE_V6: "1", FAKE_SCENARIO: scenario } });
      assert.equal(v6Result.status, 0, `${scenario}: ${v6Result.stderr}`);
      const v6 = JSON.parse(v6Result.stdout);
      assert.equal(v6.error, expectedError, scenario);
      assert.deepEqual(v6.modes, ["isolation level repeatable read read only"], scenario);
      assert.deepEqual(v6.closes, [{ timeout: 1 }], scenario);
      assert.equal(v6.connections, 0, scenario);
      if (expectedError) assert.equal(v6.snapshot, undefined, scenario);
      else {
        assert.deepEqual(v6.queries, [...observed.queries, "quarantined-runtimes", "binding-counts",
          "binding-attempts", "binding-sessions"]);
        const { snapshotHash: v6Hash, ...v6Body } = v6.snapshot;
        assert.equal(v6Hash, hashCanonicalJson(v6Body));
        assert.equal(v6Body.schema, "setfarm.internal-production-pre32-active-binding-snapshot.v6");
        assert.equal(v6Body.authority, "diagnostic-only");
        assert.deepEqual(v6Body.activeRows.counts, body.activeRows.counts);
        assert.deepEqual(v6Body.bindingRows.counts, { attemptCount: 0, sessionCount: 0 });
        assert.equal(v6Body.bindingRows.authority, "diagnostic-only");
      }
    }
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
