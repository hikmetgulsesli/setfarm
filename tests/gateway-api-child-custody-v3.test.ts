import { test } from "node:test";
import { exerciseGatewayConsumer } from "./helpers/gateway-api-safe-consumer.js";

test("actual gateway fresh CLI launch refuses before either child port after JS closure", async () => {
  await exerciseGatewayConsumer(`const js=await local.acquireDashboardCutoverLocalProducerDrainV2();
const result=await api.deleteCronJob('owned-job');assert.equal(result.ok,false);
assert.match(result.error,/DASHBOARD_CUTOVER_LOCAL_CHILD_DRAIN_REFUSED/);
assert.equal(calls.length,0);local.assertDashboardCutoverLocalChildDrainV3(await local.acquireDashboardCutoverLocalChildDrainV3(js));`,
    `execPort=(...args)=>{args.at(-1)(null,'{}','');return undefined};`);
});

test("actual gateway failed which preserves npx fallback after child-only burn while open", async () => {
  await exerciseGatewayConsumer(`assert.deepEqual(await api.deleteCronJob('owned-job'),{ok:true});
assert.equal(calls.length,2);assert.equal(calls[0][0],'which');assert.equal(calls[1][0],'npx');
assert.deepEqual(calls[1][1],['openclaw','cron','rm','owned-job','--json']);
assert.deepEqual(calls[1][2],{timeout:30000});
const js=await local.acquireDashboardCutoverLocalProducerDrainV2();local.assertDashboardCutoverLocalProducerDrainV2(js);
await assert.rejects(local.acquireDashboardCutoverLocalChildDrainV3(js),{message:'DASHBOARD_CUTOVER_LOCAL_CHILD_DRAIN_REFUSED'});
local.assertDashboardCutoverLocalProducerDrainV2(js);`,
    `execPort=(...args)=>{args.at(-1)(args[0]==='which'?Error('INERT_MISSING'):null,args[0]==='which'?'':'{}','');return undefined};`);
});
