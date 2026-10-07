import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { test } from "node:test";

const production = new URL("../../src/internal-production/baseline-legacy-database-census-v1.ts", import.meta.url).href;
const importIndex = process.execArgv.indexOf("--import");
const loader = importIndex >= 0 ? process.execArgv[importIndex + 1]! : "tsx";
const fixture = String.raw`
  export default function postgres(url,options){
    const p=globalThis.probe;
    p.open++; p.credentialsPrivate=url==='postgresql://fixture_PRIVATE_CANARY@localhost/setfarm';
    const tx=async strings=>{
      p.events.push('query');
      if(p.failQuery)throw Error('PRIVATE_DRIVER_DETAIL');
      const q=strings.join('');
      if(q.startsWith('SET LOCAL'))return [];
      if(q.includes('FROM public.setfarm_schema_migrations')&&q.includes('ORDER BY version'))
        return [26,27,28,29,30,31].map(version=>({version,state:'applied'}));
      if(q.includes('WITH expected_tables(name)'))return [{laterJournalCount:'0',relationCount:'0',functionCount:'0',typeCount:'0',triggerCount:'0'}];
      if(q.includes('WITH required_columns('))return [{catalogViolationCount:'0',aprbChildViolationCount:'0',ordinaryBatchViolationCount:'0',activeHeaderViolationCount:'0',ownerReservationsRelation:null,ownerAdmissionHeadRelation:null,producerSourceRelation:null,producerActivationRelation:null,producerActivationHeadRelation:null,producerCurrentRelation:null,activeRunCount:p.drift?'1':'0',openClaimCount:'0',executionAttemptCount:'0',activeRuntimeSessionCount:'0',activeCompletionOwnerCount:'0',unsettledMandatoryEffectCount:'0',artifactReservationCount:'0',publicationBatchCount:'0',artifactPublicationCount:'0',terminationOwnerCount:'0',findingOwnerCount:'0',recoveryOwnerCount:'0',operationalDeliveryCount:'0'}];
      if(q.includes('FROM public.finding_sets ORDER BY')||q.includes('FROM public.findings ORDER BY')||q.includes('finding_sets'))return [];
      throw Error('UNEXPECTED_QUERY');
    };
    tx.unsafe=async q=>{
      p.events.push(q);if(p.failQuery)throw Error('PRIVATE_DRIVER_DETAIL');
      if(q==='FIXTURE_EXACT_JOURNAL'&&p.events.includes('consumer-enter')&&(p.scenario.startsWith('detached-')||p.scenario.startsWith('assertion-reentry-'))){
        await new Promise(resolve=>setTimeout(resolve,5));p.events.push('delayed-query-settled');
        if(p.scenario==='detached-reject')throw Error('PRIVATE_DRIVER_DETAIL');
      }
      return [];
    };
    return {options:{host:['localhost'],port:[5432],database:'setfarm',user:'fixture_PRIVATE_CANARY'},
      begin:async(mode,callback)=>{
        p.mode=mode;p.held=true;p.events.push('begin');
        try{const work=callback(tx);work.catch(()=>{});
          const result=await (p.scenario==='connection-loss'?Promise.race([work,new Promise((_,reject)=>setTimeout(()=>reject(Error('PRIVATE_CONNECTION_DETAIL')),5))]):work);
          p.events.push('callback-return');
          if(p.scenario==='commit-failure')throw Error('PRIVATE_COMMIT_DETAIL');return result;
        }finally{p.held=false;p.events.push('transaction-release')}
      },
      end:async()=>{p.events.push('end');p.closed++;
        if(p.scenario==='settlement-reentry')await p.nested();
        if(p.scenario==='end-failure')throw Error('PRIVATE_END_DETAIL')},
    };
  }
`;

function run(scenario: string) {
  const result = spawnSync(process.execPath, ["--import", loader, "--input-type=module", "-e", `
    import{registerHooks}from'node:module';
    import assert from 'node:assert/strict';
    globalThis.probe={scenario:${JSON.stringify(scenario)},events:[],open:0,closed:0,held:false};
    const p=globalThis.probe;
    const rejections=[];process.on('unhandledRejection',error=>rejections.push(String(error)));
    const sources={
      postgres:${JSON.stringify(fixture)},
      '../findings/finding-publication-v1.js':'export const observeLegacyFindingPublicationInventoryV1=()=>Object.freeze({authority:"diagnostic-only"});',
      '../db/contract-spine-migrations.js':'export async function verifyHeldPre32ContractSpineJournalIdentityV1(query){globalThis.probe.events.push("exact-journal");await query("FIXTURE_EXACT_JOURNAL",[31]);}',
    };
    registerHooks({resolve(specifier,context,next){
      if(Object.hasOwn(sources,specifier))return{url:'data:text/javascript,'+encodeURIComponent(sources[specifier]),shortCircuit:true};
      return next(specifier,context);
    }});
    const module=await import(${JSON.stringify(production)});
    assert.equal(typeof module.withHeldDashboardCutoverPre32DatabaseV2,'function','MISSING_PROVIDER_EXPORT');
    assert.equal(typeof module.assertHeldDashboardCutoverPre32DatabaseV2,'function','MISSING_ASSERT_EXPORT');
    const enter=module.withHeldDashboardCutoverPre32DatabaseV2,check=module.assertHeldDashboardCutoverPre32DatabaseV2;
    // A nonsecret canary username keeps URL privacy assertions without a fake password.
    const url='postgresql://fixture_PRIVATE_CANARY@localhost/setfarm';
    let leaked,returned,error,lateRefused=false,traps=0,nestedRefused=false;
    p.nested=async()=>{try{await enter(url,async()=>{})}catch{nestedRefused=true}};
    if(p.scenario==='invalid-input'){
      const proxy=new Proxy(()=>{}, {get(){traps++;throw Error('TRAP')},apply(){traps++;throw Error('TRAP')}});
      for(const callback of [null,{},proxy]){let refused=false;try{await enter(url,callback)}catch{refused=true}assert.ok(refused)}
      for(const value of [undefined,'postgresql://fixture_PRIVATE_CANARY@remote.invalid/setfarm']){let refused=false;try{await enter(value,async()=>{})}catch{refused=true}assert.ok(refused)}
    }else{
      try{returned=await enter(url,async(scope,census)=>{
        leaked=scope;p.events.push('consumer-enter');assert.equal(p.held,true);
        assert.equal(Object.getPrototypeOf(scope),null);assert.deepEqual(Reflect.ownKeys(scope),[]);assert.ok(Object.isFrozen(scope));assert.ok(Object.isFrozen(census));
        assert.equal(census.activeRunCount,0);
        if(p.scenario==='final-owner-drift'){p.drift=true;return 'forbidden'}
        if(p.scenario==='final-query-failure'){p.failQuery=true;return 'forbidden'}
        if(p.scenario.startsWith('assertion-reentry-')){
          const pending=check(scope);pending.catch(()=>{});
          const other=p.scenario==='assertion-reentry-valid'?scope:new Proxy({}, {get(){traps++;throw Error('TRAP')},getPrototypeOf(){traps++;throw Error('TRAP')}});
          try{await check(other)}catch{};
          await pending;return 'forbidden';
        }
        if(p.scenario==='connection-loss'){
          await new Promise(resolve=>{p.resume=resolve});
          await check(scope);p.events.push('forbidden-late-consumer');return 'late';
        }
        if(p.scenario.startsWith('detached-')){
          check(scope).catch(()=>{});
          if(p.scenario==='detached-throw')throw Error('PRIVATE_CALLBACK_DETAIL');
          return 'detached';
        }
        if(p.scenario==='callback-failure')throw Error('PRIVATE_CALLBACK_DETAIL');
        if(p.scenario==='query-failure')p.failQuery=true;
        if(p.scenario==='owner-drift')p.drift=true;
        if(p.scenario==='swallowed-reentry'){
          try{await enter(url,async()=>{})}catch{};
        }
        if(p.scenario==='foreign-scope'){
          const proxy=new Proxy({}, {get(){traps++;throw Error('TRAP')},getPrototypeOf(){traps++;throw Error('TRAP')}});
          for(const foreign of [Object.freeze(Object.create(null)),proxy]){let refused=false;try{await check(foreign)}catch{refused=true}assert.ok(refused)}
        }
        if(p.scenario==='bounded-rechecks'){
          for(let i=0;i<32;i++)await check(scope);
          try{await check(scope)}catch{};
        }else await check(scope);
        assert.equal(p.held,true);p.events.push('consumer-return');return 'callback-result';
      })}catch(caught){error=caught.message}
      if(p.scenario==='connection-loss'){p.resume();await new Promise(resolve=>setTimeout(resolve,10))}
      try{await check(leaked)}catch{lateRefused=true}
      if(error){p.futureRefused=false;try{await enter(url,async()=>{})}catch{p.futureRefused=true}}
    }
    await new Promise(resolve=>setTimeout(resolve,1));
    process.stdout.write(JSON.stringify({...p,returned,error,lateRefused,traps,nestedRefused,rejections}));
  `], { env: { PATH: "/usr/bin:/bin", LANG: "C", LC_ALL: "C" }, encoding: "utf8", timeout: 15000, maxBuffer: 1024 * 1024 });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.signal, null);
  assert.equal(result.stderr, "");
  assert.ok(!result.stdout.includes("PRIVATE_CANARY"));
  assert.ok(!result.stdout.includes("PRIVATE_DRIVER_DETAIL"));
  assert.ok(!result.stdout.includes("PRIVATE_COMMIT_DETAIL"));
  assert.ok(!result.stdout.includes("PRIVATE_END_DETAIL"));
  assert.ok(!result.stdout.includes("PRIVATE_CALLBACK_DETAIL"));
  assert.ok(!result.stdout.includes("PRIVATE_CONNECTION_DETAIL"));
  return JSON.parse(result.stdout);
}

test("retained pre32 callback and recheck occur before the original transaction releases", () => {
  const p = run("success");
  assert.equal(p.returned, "callback-result"); assert.equal(p.error, undefined);
  assert.equal(p.mode, "isolation level read committed read only");
  assert.equal(p.open, 1); assert.equal(p.closed, 1); assert.equal(p.held, false);
  assert.equal(p.lateRefused, true);
  const locks = p.events.filter((event: string) => event.startsWith("LOCK TABLE "));
  assert.deepEqual(locks, [
    "artifact_capacity", "artifact_publication_batch_items", "artifact_publication_batch_plan_items",
    "artifact_publication_batch_plans", "artifact_publication_batches", "artifact_publication_reservations",
    "artifact_store_authorities", "claim_log", "execution_attempts", "finding_sets", "findings",
    "operational_event_deliveries", "operational_outbox", "platform_release_store_records_v3",
    "product_compilation_attempts", "product_packets", "recovery_cases", "recovery_dispatch_deliveries",
    "recovery_revision_dispatches", "run_termination_requests", "runs", "runtime_completion_effects",
    "runtime_completion_requests", "runtime_sessions", "semantic_artifacts", "setfarm_schema_migrations",
    "steps", "stories", "v3_canary_admission_claims", "v3_preparation_authorities_v2",
    "v3_preparation_authority_attempts_v2", "v3_preparation_authority_claims_v2", "v3_preparation_blocks",
    "v3_preparation_story_state", "v3_story_claim_runtime_binding_cutovers_v1", "v3_story_claim_runtime_bindings_v1",
  ].map(table => `LOCK TABLE public.${table} IN SHARE MODE`));
  assert.ok(p.events.indexOf(locks[35]) < p.events.indexOf("exact-journal"));
  assert.ok(p.events.indexOf("exact-journal") < p.events.indexOf("consumer-enter"));
  assert.equal(p.events.filter((event: string) => event === "exact-journal").length, 3);
  assert.ok(p.events.indexOf("consumer-return") < p.events.indexOf("transaction-release"));
  assert.ok(p.events.indexOf("transaction-release") < p.events.indexOf("end"));
});

test("invalid continuation or URL invokes no caller proxy and no driver", () => {
  const p = run("invalid-input");
  assert.equal(p.open, 0); assert.equal(p.closed, 0); assert.equal(p.traps, 0);
});

test("foreign or proxy scope cannot touch a valid original scope", () => {
  const p = run("foreign-scope");
  assert.equal(p.returned, "callback-result"); assert.equal(p.error, undefined);
  assert.equal(p.traps, 0); assert.equal(p.lateRefused, true);
});

for (const scenario of ["callback-failure", "query-failure", "owner-drift", "swallowed-reentry", "bounded-rechecks", "commit-failure", "end-failure", "detached-return", "detached-throw", "detached-reject", "connection-loss", "settlement-reentry", "assertion-reentry-valid", "assertion-reentry-proxy", "final-owner-drift", "final-query-failure"]) {
  test(`retained pre32 scope refuses and expires on ${scenario}`, () => {
    const p = run(scenario);
    assert.equal(p.returned, undefined); assert.match(p.error, /dashboard retained pre32/);
    assert.equal(p.open, 1); assert.equal(p.closed, 1); assert.equal(p.held, false);
    assert.equal(p.lateRefused, true);
    assert.equal(p.futureRefused, true);
    assert.deepEqual(p.rejections, []);
    if (scenario === "swallowed-reentry") {
      const tail = p.events.slice(p.events.indexOf("consumer-enter") + 1);
      assert.deepEqual(tail, ["transaction-release", "end"]);
    }
    if (scenario.startsWith("detached-") || scenario.startsWith("assertion-reentry-")) {
      const settled = p.events.indexOf("delayed-query-settled");
      assert.ok(settled > p.events.indexOf("consumer-enter"));
      assert.ok(settled < p.events.indexOf("transaction-release"));
      assert.deepEqual(p.events.slice(settled + 1), ["transaction-release", "end"]);
      assert.equal(p.traps, 0);
    }
    if (scenario === "connection-loss") {
      assert.ok(!p.events.includes("forbidden-late-consumer"));
      assert.deepEqual(p.events.slice(p.events.indexOf("consumer-enter") + 1), ["transaction-release", "end"]);
    }
    if (scenario === "settlement-reentry") assert.equal(p.nestedRefused, true);
    if (scenario === "bounded-rechecks") assert.equal(p.events.filter((event: string) => event === "exact-journal").length, 33);
  });
}

test("a second entry during the first acquisition burns before any driver query", () => {
  const result = spawnSync(process.execPath, ["--import", loader, "--input-type=module", "-e", `
    import assert from 'node:assert/strict';import{registerHooks}from'node:module';
    let queries=0;globalThis.driverOpens=0;
    registerHooks({resolve(specifier,context,next){if(specifier==='postgres')return{url:'data:text/javascript,'+encodeURIComponent('export default function(){globalThis.driverOpens++;throw Error("FORBIDDEN_DRIVER") }'),shortCircuit:true};return next(specifier,context)}});
    const module=await import(${JSON.stringify(production)});
    assert.equal(typeof module.withHeldDashboardCutoverPre32DatabaseV2,'function','MISSING_PROVIDER_EXPORT');
    const enter=module.withHeldDashboardCutoverPre32DatabaseV2;
    const first=enter('postgresql://fixture_PRIVATE_CANARY@localhost/setfarm',async()=>{queries++});
    const second=enter('postgresql://fixture_PRIVATE_CANARY@localhost/setfarm',async()=>{queries++});
    const results=await Promise.allSettled([first,second]);
    assert.ok(results.every(x=>x.status==='rejected'&&/dashboard retained pre32/.test(x.reason.message)));
    assert.equal(queries,0);assert.equal(globalThis.driverOpens,0);process.stdout.write('acquiring-reentry-refused');
  `], { env: { PATH: "/usr/bin:/bin", LANG: "C", LC_ALL: "C" }, encoding: "utf8", timeout: 15000, maxBuffer: 1024 * 1024 });
  assert.equal(result.status, 0, result.stderr); assert.equal(result.stderr, "");
  assert.equal(result.stdout, "acquiring-reentry-refused");
});
