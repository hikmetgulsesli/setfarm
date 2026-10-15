import { test } from "node:test";
import { exerciseGatewayConsumer } from "./helpers/gateway-api-safe-consumer.js";

// Reintroducing an async Promise executor leaves the genuine public caller and
// its registered local body pending on these two failures. Ports are inert.
const settleFailure = `let settled=false,result,held=false;
const original=local.withDashboardCutoverLocalProducerAsyncV2('medic-uninstall',()=>api.deleteCronJob('owned-job'));
original.then(value=>{settled=true;result=value});
const pending=local.acquireDashboardCutoverLocalProducerDrainV2().then(h=>{held=true;return h});
for(let i=0;i<4;i++)await tick();
assert.equal(settled,true,'actual deleteCronJob caller must settle after port failure');
assert.equal(result.ok,false);assert.match(result.error,/CLI fallback failed: Error: SENTINEL/);
assert.equal(held,true,'registered original body must terminate');
local.assertDashboardCutoverLocalProducerDrainV2(await pending);await original;
assert.equal(calls.length,1);`;

test("binary lookup throw settles original delete caller and registered body", async () => {
  await exerciseGatewayConsumer(settleFailure + `assert.equal(calls[0][0],'which');`,
    `execPort=()=>{throw Error('SENTINEL_LOOKUP')};`);
});

test("post-lookup synchronous invocation throw settles original delete caller", async () => {
  await exerciseGatewayConsumer(settleFailure + `assert.equal(calls[0][0],configured);`,
    `accessPort=async()=>{};execPort=()=>{throw Error('SENTINEL_INVOCATION')};`);
});

test("disabled fallback settles refusal without binary discovery or CLI ports", async () => {
  await exerciseGatewayConsumer(`const result=await api.deleteCronJob('owned-job');
assert.equal(result.ok,false);assert.match(result.error,/OpenClaw CLI fallback disabled for this process/);
assert.equal(accesses.length,0);assert.equal(calls.length,0);assert.equal(requests.length,1);`, "", true);
});

test("configured binary preference, cache, timeout and literal arguments survive", async () => {
  await exerciseGatewayConsumer(`assert.deepEqual(await api.deleteCronJob('owned-one'),{ok:true});
assert.deepEqual(await api.deleteCronJob('owned-two'),{ok:true});
assert.deepEqual(accesses,[{path:configured,mode:1}]);assert.equal(calls.length,2);
for(const [i,call] of calls.entries()){
assert.equal(call[0],configured);assert.deepEqual(call[1],['cron','rm',i===0?'owned-one':'owned-two','--json']);
assert.deepEqual(call[2],{timeout:30000});}`, `accessPort=async()=>{};
execPort=(bin,args,options,callback)=>{callback(null,'{}','');return {}};`);
});

test("PATH selection keeps direct arguments and existing timeout", async () => {
  await exerciseGatewayConsumer(`assert.deepEqual(await api.deleteCronJob('owned-job'),{ok:true});
assert.equal(calls.length,2);assert.equal(calls[0][0],'which');assert.deepEqual(calls[0][1],['openclaw']);
assert.equal(calls[1][0],fixture+'/path-openclaw');
assert.deepEqual(calls[1][1],['cron','rm','owned-job','--json']);assert.deepEqual(calls[1][2],{timeout:30000});`,
    `execPort=(bin,args,options,callback)=>{
if(bin==='which')options(null,fixture+'/path-openclaw\\n','');else callback(null,'{}','');return {}};`);
});

test("npx fallback prefixes openclaw without modifying cron arguments", async () => {
  await exerciseGatewayConsumer(`assert.deepEqual(await api.deleteCronJob('owned-job'),{ok:true});
assert.equal(calls.length,2);assert.equal(calls[0][0],'which');assert.equal(calls[1][0],'npx');
assert.deepEqual(calls[1][1],['openclaw','cron','rm','owned-job','--json']);
assert.deepEqual(calls[1][2],{timeout:30000});`, `execPort=(bin,args,options,callback)=>{
if(bin==='which')options(Error('INERT_MISSING'),'','');else callback(null,'{}','');return {}};`);
});

for (const stderr of ["INERT_STDERR", ""]) {
  test(`callback failure preserves ${stderr ? "stderr precedence" : "error message fallback"}`, async () => {
    await exerciseGatewayConsumer(`const result=await api.deleteCronJob('owned-job');
assert.equal(result.ok,false);assert.match(result.error,/CLI fallback failed: Error: ${stderr || "INERT_EXEC_ERROR"}/);
${stderr ? "assert.doesNotMatch(result.error,/INERT_EXEC_ERROR/);" : ""}
assert.equal(calls.length,1);`, `accessPort=async()=>{};
execPort=(bin,args,options,callback)=>{callback(Error('INERT_EXEC_ERROR'),'',${JSON.stringify(stderr)});return {}};`);
  });
}

test("HTTP success never discovers or invokes CLI", async () => {
  await exerciseGatewayConsumer(`assert.deepEqual(await api.deleteCronJob('owned-job'),{ok:true});
assert.equal(requests.length,1);assert.equal(accesses.length,0);assert.equal(calls.length,0);`,
    `fetchPort=async()=>Response.json({ok:true,result:{}});`);
});
