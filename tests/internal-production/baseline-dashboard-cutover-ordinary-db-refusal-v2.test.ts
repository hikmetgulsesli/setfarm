import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { test } from "node:test";

const production = new URL("../../src/db-pg.ts", import.meta.url).href;
const importIndex = process.execArgv.indexOf("--import");
const loader = importIndex >= 0 ? process.execArgv[importIndex + 1]! : "tsx";
const borrowed = [
  "resolveCurrentInternalProductionOwnerProducerManifestSetActivationInTransactionV1",
  "lockInternalProductionBaselineCompletionOwnerBootstrapTargetInTransactionV1",
  "lockInternalProductionBaselineCompletionOwnerBootstrapReleaseInTransactionV1",
  "beginOrAdoptInternalProductionOwnerReservationV1",
  "bindInternalProductionOwnerReservationV1",
  "closeInternalProductionOwnerReservationV1",
  "lockInternalProductionRecoverySourceBootstrapRunInsertionFenceV1",
  "bindInternalProductionRecoverySourceBootstrapRunInTransactionV1",
  "classifyInternalProductionRecoverySourceBootstrapRunPersistenceInTransactionV1",
  "assertInternalProductionRecoverySourceBootstrapRunDeliveryPendingInTransactionV1",
  "resolveInternalProductionRecoverySourceBootstrapActualRunTerminalInTransactionV1",
  "resolveInternalProductionWorkflowRunTerminalAuthorityPairInTransactionV1",
  ...["Claim", "ExecutionAttempt", "RuntimeSession", "CompletionOwner", "MandatoryEffect",
    "Termination", "Finding", "OperationalDelivery"].map(name => `resolveInternalProduction${name}TerminalAuthorityPairInTransactionV1`),
  "resolveInternalProductionOwnerReservationCloseInTransactionV1",
  "lockInternalProductionWorkflowRunInsertionFenceV1",
];
const generic = ["getSql", "pgConfigureIsolatedTestDatabase", "pgQuery", "pgGet", "pgRun", "pgExec", "pgBegin",
  "pgMigrate", "prepareTask6aRestrictedSpawnerDatabaseV1", "stageInternalProductionCurrentEntryMigration32InTransactionV1",
  "commitInternalProductionCurrentEntryMigration32TransactionV1"];

function run(name: string, mode = "open") {
  const result = spawnSync(process.execPath, ["--import", loader, "--input-type=module", "-e", `
    import assert from 'node:assert/strict';import {registerHooks} from 'node:module';
    const p=globalThis.probe={driver:0,traps:0,observation:0,ends:0,mode:${JSON.stringify(mode)}};
    registerHooks({resolve(s,c,next){
      if(s.endsWith('/baseline-deployment-cutover-v1.js'))return{url:'data:text/javascript,'+encodeURIComponent(
        'export function observeDeploymentCutoverIntentV1(){const p=globalThis.probe;p.observation++;if(p.nested){const f=p.nested;p.nested=null;try{f()}catch{}}if(p.mode==="unknown")throw Error("PRIVATE_OBSERVER_DETAIL");return {state:p.mode};}'),shortCircuit:true};
      if(s==='postgres')return{url:'data:text/javascript,'+encodeURIComponent(
        'export default function(){const p=globalThis.probe;p.driver++;const client={end:async function(){p.ends++;p.sameOriginal=this===p.original;if(p.failEnd)throw Error("PRIVATE_END_DETAIL");p.closed=true}};p.original=client;return client;}'),shortCircuit:true};
      return next(s,c);
    }});
    const m=await import(${JSON.stringify(production)});
    const proxy=new Proxy(function(){},{get(){p.traps++;throw Error('CALLER_TRAP')},apply(){p.traps++;throw Error('CALLER_TRAP')},getPrototypeOf(){p.traps++;throw Error('CALLER_TRAP')},ownKeys(){p.traps++;throw Error('CALLER_TRAP')}});
    let error,returned,closeRejected=false;
    if(p.mode==='absent'){
      m.pgConfigureIsolatedTestDatabase('postgresql://fixture@localhost/setfarm_contract_spine_test_1_aaaaaaaaaaaa');
      const sql=m.getSql();assert.ok(sql);await m.pgClose();assert.equal(p.closed,true);assert.equal(p.ends,1);assert.equal(p.sameOriginal,true);returned=true;
    }else if(p.mode.startsWith('warm-')){
      p.failEnd=p.mode==='warm-end-failure';p.mode='absent';m.getSql();assert.equal(p.driver,1);
      p.mode='open';try{m.getSql()}catch(e){error=e.message}
      assert.equal(error,'DASHBOARD_CUTOVER_ORDINARY_DATABASE_REFUSED');
      try{await m.pgClose()}catch{closeRejected=true}
      assert.equal(closeRejected,p.failEnd===true);assert.equal(p.ends,1);assert.equal(p.sameOriginal,true);
      assert.equal(p.closed,p.failEnd?undefined:true);
      const observations=p.observation;p.mode='absent';
      let future;try{m.getSql()}catch(e){future=e.message}
      assert.equal(future,'DASHBOARD_CUTOVER_ORDINARY_DATABASE_REFUSED');assert.equal(p.driver,1);assert.equal(p.observation,observations);
    }else{
      if(p.mode==='reentry'){p.mode='absent';p.nested=()=>m.getSql()}
      try{await m[${JSON.stringify(name)}](proxy,proxy,proxy)}catch(e){error=e.message}
      assert.equal(error,'DASHBOARD_CUTOVER_ORDINARY_DATABASE_REFUSED');
      assert.equal(p.driver,0);assert.equal(p.traps,0);
      const observations=p.observation;p.mode='absent';await m.pgClose();
      for(const f of ['getSql','pgMigrate','pgConfigureIsolatedTestDatabase']){
        let caught;try{await m[f](proxy)}catch(e){caught=e.message}
        assert.equal(caught,'DASHBOARD_CUTOVER_ORDINARY_DATABASE_REFUSED');
      }
      assert.equal(p.observation,observations);assert.equal(p.driver,0);assert.equal(p.traps,0);
    }
    assert.equal(m.isExactAppliedBootstrapMainClaimHandoffMigration32JournalRowV1(undefined),false);
    assert.equal(typeof m.now(),'string');
    process.stdout.write(JSON.stringify({driver:p.driver,traps:p.traps,observation:p.observation,ends:p.ends,sameOriginal:p.sameOriginal,closeRejected,returned,error}));
  `], { encoding: "utf8", timeout: 15000, maxBuffer: 1024 * 1024,
    env: { PATH: "/usr/bin:/bin", LANG: "C", LC_ALL: "C" } });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.signal, null); assert.equal(result.stderr, "");
  assert.ok(!result.stdout.includes("PRIVATE_OBSERVER_DETAIL"));
  assert.ok(!result.stdout.includes("PRIVATE_END_DETAIL"));
  return JSON.parse(result.stdout);
}

for (const name of [...generic, ...borrowed]) {
  test(`OPEN intent refuses ${name} before caller or database ports and remains latched`, () => {
    const result = run(name); assert.equal(result.observation, 1);
  });
}
test("unknown intent permanently refuses without disclosing observer details", () => run("getSql", "unknown"));
test("swallowed observation reentry burns before original driver construction", () => run("getSql", "reentry"));
test("known absent preserves ordinary configuration, driver and original close", () => {
  const result = run("getSql", "absent"); assert.equal(result.returned, true); assert.equal(result.driver, 1);
});
for (const mode of ["warm-close", "warm-end-failure"]) test(`warm original cleanup remains available and fenced on ${mode}`, () => {
  const result = run("getSql", mode); assert.equal(result.ends, 1); assert.equal(result.sameOriginal, true);
});
