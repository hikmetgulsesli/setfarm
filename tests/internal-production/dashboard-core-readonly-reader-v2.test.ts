import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { test } from "node:test";

// Lifecycle component only: installed provider and qualification are inert
// fault ports; actual closed request/data/failure branding code is not mocked.
const production = new URL("../../src/db/dashboard-core-readonly-reader-v2.ts", import.meta.url).href;
const driver = [
  "import {randomUUID} from 'node:crypto';",
  "export default function postgres(url,options){",
  "const p=globalThis.probe;p.open++;if(p.scenario==='factory-reentry')p.owner.prepare().catch(()=>{});",
  "const opts={host:['localhost'],port:[5432],database:'setfarm',user:'fixture',pass:'',path:false,ssl:false,socket:undefined};",
  "if(p.scenario==='options-host')opts.host=['remote.invalid'];if(p.scenario==='options-port')opts.port=[5433];",
  // Fresh inert mismatch, never a configured/stored credential. Keep the
  // same-type equality oracle, separately from missing-option refusal.
  "if(p.scenario==='options-pass')opts.pass=randomUUID();if(p.scenario==='options-missing-pass')delete opts.pass;",
  "if(p.scenario==='options-ssl')opts.ssl=true;",
  "const tx=function(strings,...parameters){if(p.scenario==='tagged-reentry'){p.owner.refuse();return Promise.reject(Error('PRIVATE_TAGGED_DETAIL'))}return query(strings.join('?'),parameters,this===tx)};",
  "tx.unsafe=function(sql,parameters=[]){if(p.scenario==='query-reentry'){p.owner.refuse();",
  "return new class extends Promise{static get [Symbol.species](){return Promise}constructor(){super(()=>{})}then(resolve,reject){p.lazyActivated++;return Promise.resolve([]).then(resolve,reject)}}}",
  "if(p.scenario==='query-then-reentry')return new class extends Promise{static get [Symbol.species](){return Promise}constructor(){super(()=>{})}get then(){p.owner.refuse();return function(resolve,reject){p.lazyActivated++;return Promise.resolve([]).then(resolve,reject)}}};",
  "if(p.scenario==='query-rejected-reentry'){p.owner.refuse();return Promise.reject(Error('PRIVATE_REJECTED_QUERY'))}",
  "if(p.scenario==='query-rejected-then-throw'){const original=Promise.reject(Error('PRIVATE_REJECTED_QUERY'));Object.defineProperty(original,'then',{get(){p.owner.refuse();throw Error('PRIVATE_THEN_DETAIL')}});return original}",
  "return query(sql,parameters,this===tx)};",
  "async function query(sql,parameters,sameOriginal){",
  "p.events.push({sql,parameters,sameOriginal});p.queries++;if(p.failPort===p.queries)throw Error('PRIVATE_QUERY_DETAIL');",
  "if(sql==='FIXTURE_DETACHED_QUERY'){await new Promise(resolve=>p.resumeDetached=resolve);if(p.scenario==='detached-reject')throw Error('PRIVATE_DETACHED_DETAIL')}",
  "if(p.waitQuery&&sql==='FIXTURE_QUALIFICATION_READ'){p.waitQuery=false;await new Promise(resolve=>p.resumeQuery=resolve)}",
  "if(p.scenario==='unexpected-close'&&p.open===2&&sql==='FIXTURE_QUALIFICATION_READ')options.onclose(1);",
  "if(sql.startsWith('SELECT * FROM public.rules')){if(p.dataFail)throw Error('PRIVATE_DATA_DETAIL');",
  "if(p.capacity)return Array.from({length:4097},()=>({}));",
  "return[{id:'rule',title:'title',content:'content',category:'general',project_type:'all',source:null,severity:'info',applies_to:'all',enabled:true,readonly:false,sort_order:1,created_at:new Date(0),updated_at:new Date(0)}]}return[]}",
  "return{get options(){if(p.scenario==='options-reentry')p.owner.refuse();return opts},",
  "async begin(mode,callback){p.mode=mode;p.begins++;if(p.scenario==='begin-reject')throw Error('PRIVATE_BEGIN_DETAIL');",
  "if(p.scenario==='begin-no-callback')return Object.freeze({});",
  "const work=callback(tx);p.callback=work;p.callbackDone=false;work.then(()=>p.callbackDone=true,()=>p.callbackDone=true);",
  "if(p.scenario==='callback-then-reject')throw Error('PRIVATE_BEGIN_DETAIL');",
  "if(p.scenario==='early-loss'){await new Promise(resolve=>setTimeout(resolve,0));throw Error('PRIVATE_CONNECTION_DETAIL')}",
  "if(p.scenario==='early-success')return Object.freeze({});",
  "const result=await work;if(p.holdBegin&&p.open===2)await new Promise(resolve=>p.resumeBegin=resolve);",
  "if(p.scenario==='commit-reject')throw Error('PRIVATE_COMMIT_DETAIL');",
  "if(p.scenario==='copied-outcome')return{...result};return result},",
  "get end(){p.endLookups++;if(p.scenario==='end-getter-reentry')p.owner.refuse();",
  "if(p.scenario==='end-getter-throw')throw Error('PRIVATE_END_GETTER_DETAIL');",
  "if(p.scenario==='end-invoke-throw')return function(){p.close++;throw Error('PRIVATE_END_DETAIL')};",
  "return async function(endOptions){p.close++;p.endOptions=endOptions;if(p.scenario==='end-reject')throw Error('PRIVATE_END_DETAIL');",
  "options.onclose(1);if(p.holdEnd&&p.open===2)await new Promise(resolve=>p.resumeEnd=resolve);",
  "if(p.open===2&&(p.scenario==='late-refuse'||p.scenario==='capacity-late-refuse'))queueMicrotask(()=>queueMicrotask(()=>queueMicrotask(()=>queueMicrotask(()=>queueMicrotask(()=>p.owner.refuse())))))}}};}",
].join("\n");
const qualification = [
  "export async function observeDashboardCoreReadonlyQualificationV2(tx,previous){",
  "const p=globalThis.probe;p.qualifications++;if(p.scenario.startsWith('tagged-'))await tx`FIXTURE_QUALIFICATION_READ`;else await tx.unsafe('FIXTURE_QUALIFICATION_READ');",
  "p.previous.push(previous);if(p.qualifications===1)assertPrevious(previous,undefined);",
  "if(p.qualifications===2)assertPrevious(previous,p.preparedInitial);",
  "if(p.qualifications===3)assertPrevious(previous,p.preparedFinal);",
  "if(p.qualifications===4)assertPrevious(previous,p.readInitial);",
  "if(p.scenario==='baseline-drift'&&p.qualifications===3)throw Error('PRIVATE_PREPARED_BASELINE_DRIFT');",
  "if(p.qualifications===3&&p.scenario.startsWith('detached-'))void tx.unsafe('FIXTURE_DETACHED_QUERY').catch(()=>{});",
  "if(p.failQualification===p.qualifications)throw Error('PRIVATE_QUALIFICATION_DETAIL');",
  "if(p.swallowFailure){p.swallowFailure=false;try{await tx.unsafe('FIXTURE_SWALLOWED_FAILURE')}catch{}}",
  "const result=Object.freeze({schema:'setfarm.dashboard-core-readonly-qualification.v2',",
  "profile:Object.freeze({schema:'setfarm.dashboard-core-readonly-profile.v2',relationOids:Object.freeze({}),catalogHash:'a'.repeat(64)}),censusHash:'b'.repeat(64)});",
  "if(p.qualifications===1)p.preparedInitial=result;if(p.qualifications===2)p.preparedFinal=result;if(p.qualifications===3)p.readInitial=result;return result;}",
  "function assertPrevious(actual,expected){if(actual!==expected)throw Error('FIXTURE_PREVIOUS_IDENTITY_MISMATCH')}",
].join("\n");
function run(scenario: string) {
  const child = [
    "import assert from 'node:assert/strict';import{registerHooks}from'node:module';",
    "globalThis.probe={scenario:"+JSON.stringify(scenario)+",open:0,close:0,endLookups:0,begins:0,queries:0,qualifications:0,events:[],previous:[],lazyActivated:0,traps:0};",
    "const p=globalThis.probe;const rejections=[];process.on('unhandledRejection',error=>rejections.push(String(error)));",
    "const sources={postgres:"+JSON.stringify(driver)+",'./dashboard-core-readonly-qualification-v2.js':"+JSON.stringify(qualification)+"};",
    "registerHooks({resolve(specifier,context,next){if(Object.hasOwn(sources,specifier))return{url:'data:text/javascript,'+encodeURIComponent(sources[specifier]),shortCircuit:true};return next(specifier,context)}});",
    "let module;try{module=await import("+JSON.stringify(production)+")}catch(error){process.stdout.write(JSON.stringify({missingProduction:error.code,missingUrl:error.url}));process.exit(0)}assert.equal(typeof module.createDashboardCoreReadonlyReaderV2,'function','MISSING_PRIVATE_READER');",
    "const create=module.createDashboardCoreReadonlyReaderV2;let target='postgresql://fixture@localhost/setfarm';",
    "if(p.scenario==='target-remote')target='postgresql://fixture@remote.invalid/setfarm';",
    "if(p.scenario==='target-query')target+='?ssl=true';if(p.scenario==='target-whitespace')target+=' ';",
    "if(p.scenario==='target-surrogate')target+='\\ud800';if(p.scenario==='target-capacity')target='a'.repeat(65537);",
    "if(p.scenario==='target-capacity'){const original=Buffer.from;Buffer.from=function(value,...rest){if(typeof value==='string'&&value.length>65536)throw Error('PRIVATE_PRECAP_ALLOCATION');return Reflect.apply(original,Buffer,[value,...rest])}}",
    "if(p.scenario==='target-nul-credential')target='postgresql://fi%00xture@localhost/setfarm';",
    "if(p.scenario==='target-proxy')target=new Proxy({}, {get(){p.traps++;throw Error('TRAP')}});",
    "let error,prepared=false,returned,secondaryError,settled=false,nested;",
    "const waitFor=async predicate=>{for(let n=0;n<1000;n++){if(predicate())return;await new Promise(resolve=>setTimeout(resolve,1))}throw Error('FIXTURE_BARRIER_NOT_REACHED')};",
    "try{p.owner=create(target,...(p.scenario==='creator-arity'?[1]:[]));assert.ok(Object.isFrozen(p.owner));assert.deepEqual(Object.keys(p.owner),['prepare','read','refuse']);",
    "if(p.scenario==='creator-duplicate'){try{create(target)}catch(caught){secondaryError=caught.message}}",
    "if(p.scenario==='unprepared-read')await p.owner.read({kind:'rules'});if(p.scenario==='prepare-arity')await p.owner.prepare('control');",
    "if(p.scenario==='pg-before')process.env.PGHOST='remote.invalid';",
    "if(p.scenario==='early-loss'||p.scenario==='early-success')p.waitQuery=true;",
    "if(p.scenario==='preparing-duplicate'){p.waitQuery=true;const original=p.owner.prepare();original.catch(()=>{});await waitFor(()=>p.resumeQuery);",
    "try{await p.owner.prepare('extra')}catch(caught){secondaryError=caught.message}assert.equal(p.open,1);p.resumeQuery();await original}",
    "if(p.scenario.startsWith('utility-failure-'))p.failPort=Number(p.scenario.slice(16));",
    "if(p.scenario==='initial-qualification-failure')p.failQualification=1;if(p.scenario==='final-qualification-failure')p.failQualification=2;",
    "await p.owner.prepare();prepared=true;",
    "if(p.scenario==='refuse-arity')p.owner.refuse('control');",
    "if(p.scenario==='ready-duplicate'){try{await p.owner.prepare()}catch(caught){secondaryError=caught.message}}",
    "if(p.scenario==='invalid-request'||p.scenario==='read-arity'){const before=p.open;try{",
    "await p.owner.read(new Proxy({}, {get(){p.traps++;throw Error('TRAP')},ownKeys(){p.traps++;throw Error('TRAP')}}),...(p.scenario==='read-arity'?[1]:[]));",
    "}catch(caught){secondaryError=caught.message}assert.equal(p.open,before)}",
    "if(p.scenario==='pg-after')process.env.PGHOST='remote.invalid';if(p.scenario==='data-failure')p.dataFail=true;",
    "if(p.scenario==='capacity'||p.scenario==='capacity-final-failure'){p.capacity=true;if(p.scenario==='capacity-final-failure')p.failQualification=4}",
    "if(p.scenario==='capacity-late-refuse')p.capacity=true;",
    "if(p.scenario==='swallowed-query-failure'){p.swallowFailure=true;p.failPort=p.queries+6}",
    "if(p.scenario==='pending-end'||p.scenario==='capacity-pending-end'){p.holdEnd=true;p.capacity=p.scenario==='capacity-pending-end'}",
    "if(p.scenario==='busy'||p.scenario==='busy-invalid'||p.scenario==='refuse-pending-query')p.waitQuery=true;",
    "if(p.scenario==='pending-begin'||p.scenario==='refuse-pending-begin')p.holdBegin=true;",
    "if(p.scenario==='refuse-pending-end')p.holdEnd=true;",
    "if(p.scenario==='read-final-failure')p.failQualification=4;",
    "const work=p.owner.read({kind:'rules'});work.then(()=>settled=true,()=>settled=true);",
    "if(p.scenario.startsWith('detached-')){await waitFor(()=>p.resumeDetached&&p.qualifications===4);assert.equal(p.callbackDone,false);assert.equal(settled,false);assert.equal(p.close,1);",
    "const before=p.open;try{await p.owner.read({kind:'rules'})}catch(caught){secondaryError=caught.message}assert.equal(secondaryError,'DASHBOARD_CUTOVER_CORE_READER_BUSY');assert.equal(p.open,before);p.resumeDetached()}",
    "if(p.scenario==='busy'||p.scenario==='busy-invalid'||p.scenario==='refuse-pending-query'){await waitFor(()=>p.resumeQuery);const before=p.open;try{",
    "await p.owner.read(p.scenario==='busy-invalid'?new Proxy({}, {get(){p.traps++;throw Error('TRAP')}}):{kind:'rules'},...(p.scenario==='busy-invalid'?[1]:[]))}catch(caught){secondaryError=caught.message}",
    "assert.equal(secondaryError,'DASHBOARD_CUTOVER_CORE_READER_BUSY');assert.equal(p.open,before);try{await p.owner.prepare('extra')}catch(caught){nested=caught.message}",
    "assert.equal(nested,'DASHBOARD_CUTOVER_CORE_READER_DUPLICATE_PREPARATION_REFUSED');assert.equal(settled,false);",
    "if(p.scenario==='refuse-pending-query'){p.owner.refuse();await waitFor(()=>p.close===2);assert.equal(settled,false)}p.resumeQuery()}",
    "if(p.holdBegin){await waitFor(()=>p.resumeBegin);assert.equal(settled,false);const before=p.open;try{await p.owner.read({kind:'rules'})}catch(caught){secondaryError=caught.message}",
    "assert.equal(secondaryError,'DASHBOARD_CUTOVER_CORE_READER_BUSY');assert.equal(p.open,before);if(p.scenario==='refuse-pending-begin'){p.owner.refuse();await waitFor(()=>p.close===2);assert.equal(settled,false)}p.resumeBegin()}",
    "if(p.holdEnd){await waitFor(()=>p.resumeEnd);assert.equal(settled,false);const before=p.open;try{await p.owner.read({kind:'rules'})}catch(caught){secondaryError=caught.message}assert.equal(p.open,before);if(p.scenario==='refuse-pending-end'){p.owner.refuse();assert.equal(settled,false)}p.resumeEnd()}",
    "returned=await work}catch(caught){error=caught.message}",
    "if(p.resumeQuery&&(p.scenario==='early-loss'||p.scenario==='early-success')){const before=p.queries;p.resumeQuery();await p.callback.catch(()=>{});await new Promise(resolve=>setTimeout(resolve,0));assert.equal(p.queries,before,'no late source port after burn')}",
    "const before=p.open;let futureError;if(error&&p.scenario!=='capacity'&&p.scenario!=='capacity-pending-end'){try{await p.owner?.read({kind:'rules'})}catch(caught){futureError=caught.message}assert.equal(p.open,before)}",
    "if(p.scenario==='capacity'||p.scenario==='capacity-pending-end'){p.capacity=false;p.holdEnd=false;returned=await p.owner.read({kind:'rules'});assert.equal(p.open,before+1)}",
    "await new Promise(resolve=>setTimeout(resolve,0));process.stdout.write(JSON.stringify({prepared,returned,error,secondaryError,nested,futureError,settled,rejections,open:p.open,close:p.close,endLookups:p.endLookups,begins:p.begins,queries:p.queries,qualifications:p.qualifications,lazyActivated:p.lazyActivated,mode:p.mode,endOptions:p.endOptions,traps:p.traps,events:p.events}));",
  ].join("\n");
  const result=spawnSync(process.execPath,["--import","tsx","--input-type=module","-e",child],{
    encoding:"utf8",timeout:15000,maxBuffer:1024*1024,env:{PATH:"/usr/bin:/bin",LANG:"C",LC_ALL:"C"},
  });
  assert.equal(result.status,0,result.stderr);assert.equal(result.signal,null);
  assert.equal(result.stderr,"");assert.ok(!result.stdout.includes("PRIVATE_"));
  const observed=JSON.parse(result.stdout);
  assert.equal(observed.missingProduction,undefined,"MISSING_PRIVATE_READER:"+observed.missingProduction+" "+observed.missingUrl);
  return observed;
}
test("preparation and rules response preserve original receiver and checked-once cleanup",()=>{
  const p=run("success");assert.equal(p.error,undefined);assert.equal(p.prepared,true);assert.equal(p.returned[0].id,"rule");
  assert.equal(p.open,2);assert.equal(p.close,2);assert.equal(p.endLookups,2);
  assert.equal(p.mode,"isolation level repeatable read read only");assert.deepEqual(p.endOptions,{timeout:1});
  assert.ok(p.events.every((event:any)=>event.sameOriginal));assert.deepEqual(p.rejections,[]);
  assert.deepEqual(p.events.slice(0,4).map((event:any)=>event.sql),[
    "SET LOCAL statement_timeout = '5s'","SET LOCAL lock_timeout = '1s'","SET LOCAL search_path = pg_catalog",
    "LOCK TABLE ONLY public.runs, ONLY public.steps, ONLY public.stories, ONLY public.rules, ONLY public.run_observations IN ACCESS SHARE MODE",
  ]);
});
for(const scenario of ["target-remote","target-query","target-whitespace","target-surrogate","target-capacity","target-nul-credential","target-proxy","creator-arity","prepare-arity","unprepared-read","pg-before"])
  test(scenario+" refuses before factory",()=>{const p=run(scenario);assert.equal(p.error,"DASHBOARD_CUTOVER_CORE_READER_REFUSED");assert.equal(p.open,0);assert.equal(p.close,0);assert.equal(p.traps,0)});
for(const scenario of ["creator-duplicate","ready-duplicate","invalid-request","read-arity","busy","busy-invalid","pending-begin","pending-end","detached-success"])
  test(scenario+" preserves original readiness",()=>{const p=run(scenario);assert.equal(p.error,undefined);assert.ok(p.secondaryError);assert.equal(p.returned[0].id,"rule");assert.equal(p.open,2);assert.equal(p.close,2);assert.equal(p.traps,0)});
for(const scenario of ["capacity","capacity-pending-end"])
  test(scenario+" refuses after cleanup then remains reusable",()=>{const p=run(scenario);assert.equal(p.error,"DASHBOARD_CORE_RESPONSE_CAPACITY_REFUSED");assert.equal(p.returned[0].id,"rule");assert.equal(p.open,3);assert.equal(p.close,3)});
for(const scenario of ["options-host","options-port","options-pass","options-missing-pass","options-ssl","options-reentry","factory-reentry",
  "begin-reject","callback-then-reject","begin-no-callback","early-loss","early-success","copied-outcome","commit-reject","end-getter-throw","end-getter-reentry","end-invoke-throw","end-reject",
  "initial-qualification-failure","final-qualification-failure","utility-failure-1","utility-failure-2","utility-failure-3","utility-failure-4",
  "data-failure","baseline-drift","read-final-failure","capacity-final-failure","unexpected-close","swallowed-query-failure","pg-after",
  "refuse-pending-query","refuse-pending-begin","refuse-pending-end","detached-reject","preparing-duplicate","refuse-arity","tagged-reentry"])
  test(scenario+" burns and consumes original cleanup once",()=>{const p=run(scenario);assert.equal(p.error,"DASHBOARD_CUTOVER_CORE_READER_REFUSED");assert.equal(p.returned,undefined);assert.equal(p.endLookups,p.open);
    assert.equal(p.close,scenario==="end-getter-throw"?0:p.open);assert.deepEqual(p.rejections,[])});
for(const scenario of ["late-refuse","capacity-late-refuse"])
  test(scenario+" revokes final public read publication",()=>{
    const p=run(scenario);assert.equal(p.error,"DASHBOARD_CUTOVER_CORE_READER_REFUSED");
    assert.equal(p.returned,undefined);assert.equal(p.open,2);assert.equal(p.close,2);assert.equal(p.endLookups,2);
  });
for(const scenario of ["query-reentry","query-then-reentry","query-rejected-reentry","query-rejected-then-throw"])
  test(scenario+" retains the original but refuses before lazy activation",()=>{
    const p=run(scenario);assert.equal(p.error,"DASHBOARD_CUTOVER_CORE_READER_REFUSED");
    assert.equal(p.open,1);assert.equal(p.close,1);assert.equal(p.endLookups,1);assert.equal(p.lazyActivated,0);
    assert.deepEqual(p.rejections,[]);
  });
test("prepared baseline drift refuses before every data SELECT",()=>{
  const p=run("baseline-drift");assert.equal(p.error,"DASHBOARD_CUTOVER_CORE_READER_REFUSED");
  assert.equal(p.events.filter((event:any)=>event.sql.startsWith("SELECT *")).length,0);
});
test("tagged qualification queries preserve the original callable receiver",()=>{
  const p=run("tagged-success");assert.equal(p.error,undefined);assert.equal(p.returned[0].id,"rule");
  assert.ok(p.events.every((event:any)=>event.sameOriginal));assert.equal(p.open,2);assert.equal(p.close,2);
});
