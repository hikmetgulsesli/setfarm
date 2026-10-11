import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { test } from "node:test";

const production = new URL("../../src/db-pg.ts", import.meta.url).href;
const response = new URL("../../src/db/dashboard-core-response-v2.ts", import.meta.url).href;
const importIndex = process.execArgv.indexOf("--import");
const loader = importIndex >= 0 ? process.execArgv[importIndex + 1]! : "tsx";
const coldFlags = {
  sql: "_sql={end:async()=>{}}", schema: "_schemaReady=true",
  schemaPromise: "_schemaReadyPromise=Promise.resolve()", migrating: "_isMigrating=true",
  verification: "_verificationOnlyMode=true", isolated: "_isolatedTestPgUrl='inert'",
  task6a: "_task6aNoDefaultMigration=true", closing: "_task6aRestrictedClosing=true",
  epoch: "_task6aRestrictedConnectionEpoch=1", ordinaryUsed: "_dashboardCutoverOrdinaryUsedV2=true",
  ordinaryRefused: "_dashboardCutoverRefusedV2=true", observing: "_dashboardCutoverObservationActiveV2=true",
} as const;

// Each child loads real db-pg state and the actual request/failure authority.
// Only configuration, intent and lifecycle/provider effects are inert ports.
// Cold-flag injection appends a test-only lexical setter in memory, never to disk.
function run(body: string, settings: Record<string, unknown> = {}) {
  const source = `
    import assert from 'node:assert/strict';import{registerHooks}from'node:module';
    const p=globalThis.probe={imports:0,creates:0,prepares:0,reads:0,refuses:0,driver:0,traps:0,observations:0,mode:'open',...${JSON.stringify(settings)}};
    const config={setfarmPgUrl:'postgresql://test@localhost/setfarm',setfarmDir:'/inert/setfarm'};
    p.config=p.proxyConfig?new Proxy(config,{getOwnPropertyDescriptor(){p.traps++;throw Error('CONFIG_TRAP')},get(){p.traps++;throw Error('CONFIG_TRAP')}}):config;process.env.SETFARM_PG_URL=config.setfarmPgUrl;
    const runtimeSource='export const runtimeConfig=globalThis.probe.config;export const expandRuntimePath=x=>x;export const loadRuntimeEnv=()=>{};export const resolveProductArtifactDir=()=>"/inert";export const resolveConvergenceEvalResultDir=()=>"/inert";export const resolveProductArtifactCapacity=()=>0;export const resolveArtifactStorePublicationAuthorityMode=()=>"disabled";export const resolveV3SealCapacity=()=>0;export const missionControlApi=()=>{throw Error("INERT_CONFIGURATION_PORT")};';
    const intentSource='export function observeDeploymentCutoverIntentV1(){const p=globalThis.probe;p.observations++;if(p.observerHook)p.observerHook();if(p.mode==="unknown")throw Error("PRIVATE_INTENT");return {state:p.mode}}';
    const readerSource='const p=globalThis.probe;p.imports++;if(p.importFailure)throw Error("PRIVATE_IMPORT");if(p.blockImport)await new Promise(r=>p.resumeImport=r);export function createDashboardCoreReadonlyReaderV2(url){const p=globalThis.probe;p.creates++;p.captured=url;if(p.createHook)p.createHook();if(p.createFailure)throw Error("PRIVATE_CREATE");return p.owner={prepare:async()=>{p.prepares++;if(p.prepareHook)p.prepareHook();if(p.blockPrepare)await new Promise(r=>p.resumePrepare=r);if(p.prepareFailure)throw Error("PRIVATE_PREPARE")},read:async request=>{p.reads++;assertRequest(request);if(p.readHook)p.readHook();if(p.blockRead)await new Promise(r=>p.resumeRead=r);if(p.readFailure)throw p.readFailure;return {value:23}},refuse:()=>{p.refuses++;if(p.refuseHook)p.refuseHook()}}}function assertRequest(r){if(!Object.isFrozen(r)||r.kind!=="runs"||r.includeTerminal!==false)throw Error("UNQUALIFIED_REQUEST_COPY")}';
    registerHooks({resolve(s,c,next){
      if(s.endsWith('/runtime-config.js'))return{url:'data:text/javascript,'+encodeURIComponent(runtimeSource),shortCircuit:true};
      if(s.endsWith('/baseline-deployment-cutover-v1.js'))return{url:'data:text/javascript,'+encodeURIComponent(intentSource),shortCircuit:true};
      if(s.endsWith('/dashboard-core-readonly-reader-v2.js'))return{url:'data:text/javascript,'+encodeURIComponent(readerSource),shortCircuit:true};
      if(s==='postgres')return{url:'data:text/javascript,'+encodeURIComponent('export default function(){globalThis.probe.driver++;return{end:async()=>{if(globalThis.probe.endFailure)throw Error("PRIVATE_END")}}}'),shortCircuit:true};
      return next(s,c);
    },load(url,c,next){const result=next(url,c);if(url===${JSON.stringify(production)})return {...result,source:result.source+'\\nexport function testColdFlagV2(name){'+${JSON.stringify(Object.entries(coldFlags).map(([key, statement]) => `if(name===${JSON.stringify(key)}){${statement};return;}`).join(""))}+'throw Error("UNKNOWN_FIXTURE_FLAG")}'};return result}});
    const m=await import(${JSON.stringify(production)});
    assert.equal(typeof m.prepareDashboardCutoverCoreReaderV2,'function','missing cold public preparation');
    assert.equal(typeof m.readDashboardCoreResponseV2,'function','missing closed public reader');
    const authority=await import(${JSON.stringify(response)});
    const refused='DASHBOARD_CUTOVER_CORE_READER_REFUSED',duplicate='DASHBOARD_CUTOVER_CORE_READER_DUPLICATE_PREPARATION_REFUSED',busy='DASHBOARD_CUTOVER_CORE_READER_BUSY';
    const request={kind:'runs'};
    const proxy=new Proxy({}, {get(){p.traps++;throw Error('CALLER_TRAP')},getPrototypeOf(){p.traps++;throw Error('CALLER_TRAP')},ownKeys(){p.traps++;throw Error('CALLER_TRAP')}});
    async function error(work,code){let seen;try{await work()}catch(e){seen=e;assert.equal(e.message,code)}assert.ok(seen,'expected refusal');return seen}
    async function ready(){await m.prepareDashboardCutoverCoreReaderV2();assert.equal(p.prepares,1)}
    async function waitFor(name){for(let i=0;i<100&&!p[name];i++)await new Promise(r=>setImmediate(r));assert.equal(typeof p[name],'function')}
    async function sticky(){const counts=[p.imports,p.creates,p.prepares,p.reads,p.observations];await error(()=>m.prepareDashboardCutoverCoreReaderV2(proxy),refused);await error(()=>m.readDashboardCoreResponseV2(proxy),refused);assert.deepEqual([p.imports,p.creates,p.prepares,p.reads,p.observations],counts);assert.equal(p.traps,0)}
    ${body}
    assert.equal(p.driver,p.expectedDriver??0);assert.equal(p.traps,0);
    process.stdout.write(JSON.stringify({imports:p.imports,creates:p.creates,prepares:p.prepares,reads:p.reads,refuses:p.refuses,driver:p.driver,traps:p.traps}));
  `;
  const result = spawnSync(process.execPath, ["--import", loader, "--input-type=module", "-e", source], {
    encoding: "utf8", timeout: 15000, maxBuffer: 1024 * 1024,
    env: { PATH: "/usr/bin:/bin", LANG: "C", LC_ALL: "C" },
  });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.signal, null); assert.equal(result.stderr, "");
  return JSON.parse(result.stdout);
}

test("cold OPEN facade captures original URL and returns closed reader data", () => run(`await ready();assert.equal(p.captured,'postgresql://test@localhost/setfarm');assert.deepEqual(await m.readDashboardCoreResponseV2(request),{value:23});assert.equal(p.reads,1);await error(()=>m.getSql(),'DASHBOARD_CUTOVER_ORDINARY_DATABASE_REFUSED')`));
for (const mode of ["absent", "unknown", "closed"]) test(`${mode} intent burns before private import`, () => run(`await error(()=>m.prepareDashboardCutoverCoreReaderV2(),refused);assert.equal(p.imports,0);await sticky()`, { mode }));
for (const flag of Object.keys(coldFlags)) test(`prior ${flag} independently refuses cold admission before observation`, () => run(`m.testColdFlagV2(${JSON.stringify(flag)});await error(()=>m.prepareDashboardCutoverCoreReaderV2(),refused);assert.equal(p.observations,0);assert.equal(p.imports,0);await sticky()`));
test("selection reserves before observer ordinary reentry and swallowed refusal", () => run(`p.observerHook=()=>{assert.throws(()=>m.getSql(),{message:'DASHBOARD_CUTOVER_ORDINARY_DATABASE_REFUSED'})};await ready();assert.deepEqual(await m.readDashboardCoreResponseV2(request),{value:23});assert.equal(p.driver,0)`));
test("observer duplicate preparation burns original selection before import", () => run(`let nested;p.observerHook=()=>{p.observerHook=null;nested=m.prepareDashboardCutoverCoreReaderV2(proxy)};await error(()=>m.prepareDashboardCutoverCoreReaderV2(),refused);await error(()=>nested,duplicate);assert.equal(p.imports,0);await sticky()`));
test("observer close revokes selection before import", () => run(`p.observerHook=()=>{p.close=m.pgClose()};await error(()=>m.prepareDashboardCutoverCoreReaderV2(),refused);await p.close;assert.equal(p.imports,0);await sticky()`));
test("fresh extra preparation arguments burn without inspecting arguments", () => run(`await error(()=>m.prepareDashboardCutoverCoreReaderV2(proxy),refused);assert.equal(p.observations,0);assert.equal(p.imports,0);await sticky()`));
for (const configure of [
  "config.setfarmPgUrl='postgresql://test@localhost/setfarm ';",
  "process.env.SETFARM_PG_URL='';",
  "process.env.SETFARM_PG_URL+=' ignored';",
  "delete process.env.SETFARM_PG_URL;",
  "config.setfarmPgUrl=23;",
  "Object.defineProperty(config,'setfarmPgUrl',{get(){p.traps++;throw Error('CONFIG_TRAP')}});",
]) test(`config capture refuses mismatch or hostile descriptor: ${configure.split(';')[0]}`, () => run(`${configure}await error(()=>m.prepareDashboardCutoverCoreReaderV2(),refused);assert.equal(p.imports,0);await sticky()`));
test("configuration proxy is rejected without descriptor or property traps", () => run(`await error(()=>m.prepareDashboardCutoverCoreReaderV2(),refused);assert.equal(p.imports,0);await sticky()`, { proxyConfig: true }));
test("absent raw configuration requires the exact ordinary source default", () => run(`delete process.env.SETFARM_PG_URL;config.setfarmPgUrl='postgresql://postgres@localhost:5432/setfarm';await ready();assert.equal(p.captured,'postgresql://postgres@localhost:5432/setfarm')`));
test("reads retain capture instead of revisiting mutable runtime configuration", () => run(`await ready();config.setfarmPgUrl=proxy;process.env.SETFARM_PG_URL='changed';assert.deepEqual(await m.readDashboardCoreResponseV2(request),{value:23});assert.equal(p.captured,'postgresql://test@localhost/setfarm')`));
test("unprepared read burns without caller inspection or import", () => run(`await error(()=>m.readDashboardCoreResponseV2(proxy),refused);assert.equal(p.imports,0);await sticky()`));
test("READY duplicate preparation is nonburning before arity inspection", () => run(`await ready();await error(()=>m.prepareDashboardCutoverCoreReaderV2(proxy),duplicate);assert.deepEqual(await m.readDashboardCoreResponseV2(request),{value:23})`));
test("PREPARING duplicate burns with original import still pending", () => run(`const first=m.prepareDashboardCutoverCoreReaderV2();await waitFor('resumeImport');await error(()=>m.prepareDashboardCutoverCoreReaderV2(proxy),duplicate);await sticky();p.resumeImport();await error(()=>first,refused);assert.equal(p.creates,0)`, { blockImport: true }));
test("pgClose during import permanently prevents construction after original settles", () => run(`const first=m.prepareDashboardCutoverCoreReaderV2();await waitFor('resumeImport');await m.pgClose();await sticky();p.resumeImport();await error(()=>first,refused);assert.equal(p.creates,0)`, { blockImport: true }));
test("constructor close retains and refuses returned original owner once", () => run(`p.createHook=()=>{p.close=m.pgClose()};await error(()=>m.prepareDashboardCutoverCoreReaderV2(),refused);await p.close;assert.equal(p.refuses,1);assert.equal(p.prepares,0);await m.pgClose();assert.equal(p.refuses,1);await sticky()`));
test("close during original preparation does not publish later readiness", () => run(`const first=m.prepareDashboardCutoverCoreReaderV2();await waitFor('resumePrepare');await m.pgClose();assert.equal(p.refuses,1);await sticky();p.resumePrepare();await error(()=>first,refused);await m.pgClose();assert.equal(p.refuses,1)`, { blockPrepare: true }));
for (const fault of ["importFailure", "createFailure", "prepareFailure"]) test(`${fault} burns without retry or private detail`, () => run(`await error(()=>m.prepareDashboardCutoverCoreReaderV2(),refused);await sticky();assert.equal(p.refuses,p.creates&& !p.createFailure?1:0)`, { [fault]: true }));
test("READY close is permanent and uses original source refuse at most once", () => run(`await ready();p.refuseHook=()=>{p.refuseHook=null;p.nestedClose=m.pgClose()};await m.pgClose();await p.nestedClose;await m.pgClose();assert.equal(p.refuses,1);await sticky()`));
test("throwing source refusal keeps its consumed mark and permanent fence", () => run(`await ready();p.refuseHook=()=>{throw Error('PRIVATE_REFUSE')};await m.pgClose();await m.pgClose();assert.equal(p.refuses,1);await sticky()`));
test("read during pending import burns the preparation before caller controls", () => run(`const first=m.prepareDashboardCutoverCoreReaderV2();await waitFor('resumeImport');await error(()=>m.readDashboardCoreResponseV2(proxy),refused);await sticky();p.resumeImport();await error(()=>first,refused);assert.equal(p.creates,0)`, { blockImport: true }));
test("BUSY precedes hostile caller inspection and READY duplicate is nonburning", () => run(`await ready();const first=m.readDashboardCoreResponseV2(request);await waitFor('resumeRead');await error(()=>m.readDashboardCoreResponseV2(proxy,proxy),busy);await error(()=>m.prepareDashboardCutoverCoreReaderV2(proxy),duplicate);assert.equal(p.reads,1);p.resumeRead();assert.deepEqual(await first,{value:23})`, { blockRead: true }));
test("close during original read denies late data publication", () => run(`await ready();const first=m.readDashboardCoreResponseV2(request);await waitFor('resumeRead');await m.pgClose();await sticky();p.resumeRead();await error(()=>first,refused);assert.equal(p.refuses,1)`, { blockRead: true }));
test("idle invalid or extra request arguments are authentic nonburning operation refusals", () => run(`await ready();for(const f of [()=>m.readDashboardCoreResponseV2(proxy),()=>m.readDashboardCoreResponseV2(request,proxy)]){const e=await error(f,'DASHBOARD_CORE_REQUEST_REFUSED');assert.equal(authority.classifyDashboardCoreResponseFailureV2(e).disposition,'operation-refusal')}assert.equal(p.reads,0);assert.deepEqual(await m.readDashboardCoreResponseV2(request),{value:23});assert.equal(p.refuses,0)`));
test("authentic capacity is nonburning only after original read settlement", () => run(`await ready();try{await authority.readDashboardCoreResponseInTransactionV2({unsafe:async()=>Array.from({length:257},()=>null)},request)}catch(e){p.readFailure=e}assert.equal(authority.classifyDashboardCoreResponseFailureV2(p.readFailure).disposition,'operation-refusal');await error(()=>m.readDashboardCoreResponseV2(request),'DASHBOARD_CORE_RESPONSE_CAPACITY_REFUSED');p.readFailure=null;assert.deepEqual(await m.readDashboardCoreResponseV2(request),{value:23});assert.equal(p.refuses,0)`));
test("close during original capacity refusal overrides the operation refusal", () => run(`await ready();try{await authority.readDashboardCoreResponseInTransactionV2({unsafe:async()=>Array.from({length:257},()=>null)},request)}catch(e){p.readFailure=e}const first=m.readDashboardCoreResponseV2(request);await waitFor('resumeRead');await m.pgClose();p.resumeRead();await error(()=>first,refused);await sticky()`, { blockRead: true }));
test("forged capacity message burns instead of qualifying operation refusal", () => run(`await ready();p.readFailure=Error('DASHBOARD_CORE_RESPONSE_CAPACITY_REFUSED');await error(()=>m.readDashboardCoreResponseV2(request),refused);assert.equal(p.refuses,1);await sticky()`));
test("unexpected private BUSY burns instead of releasing facade custody", () => run(`await ready();p.readFailure=Error(busy);await error(()=>m.readDashboardCoreResponseV2(request),refused);assert.equal(p.reads,1);assert.equal(p.refuses,1);await sticky()`));
test("source preparation reentry into read burns before inspecting caller", () => run(`let nested;p.prepareHook=()=>{nested=m.readDashboardCoreResponseV2(proxy)};await error(()=>m.prepareDashboardCutoverCoreReaderV2(),refused);await error(()=>nested,refused);assert.equal(p.refuses,1);await sticky()`));
test("untouched cold close does not itself select or warm a reader", () => run(`await m.pgClose();await ready();assert.deepEqual(await m.readDashboardCoreResponseV2(request),{value:23})`));
for (const failEnd of [false, true]) test(`ordinary history remains warm after original close (failure=${failEnd})`, () => run(`p.mode='absent';m.getSql();p.expectedDriver=1;p.endFailure=${failEnd};if(p.endFailure)await error(()=>m.pgClose(),'PRIVATE_END');else await m.pgClose();p.mode='open';await error(()=>m.prepareDashboardCutoverCoreReaderV2(),refused);assert.equal(p.imports,0);await sticky()`));
