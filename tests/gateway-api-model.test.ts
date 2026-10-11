import { test } from "node:test";
import { exerciseGatewayConsumer } from "./helpers/gateway-api-safe-consumer.js";

// Every case imports the real module with inert config, HTTP and subprocess
// ports. In particular, fallback never creates/deletes a real cron job.
const job = `const job={name:'test/agent',schedule:{kind:'every',everyMs:300000},
sessionTarget:'isolated',agentId:'test-agent',payload:{kind:'agentTurn',message:'test'},enabled:true};`;
const http = `fetchPort=async()=>Response.json({ok:true,result:{id:'owned-job'}});`;

test("accepts payload with model parameter", async () => {
  await exerciseGatewayConsumer(`${job}job.payload.model='claude-sonnet-4-20250514';job.payload.timeoutSeconds=60;
assert.deepEqual(await api.createAgentCronJob(job),{ok:true,id:'owned-job'});
const body=JSON.parse(requests[0][1].body);assert.equal(body.args.job.payload.model,'claude-sonnet-4-20250514');
assert.equal(body.args.job.payload.timeoutSeconds,60);assert.equal(calls.length,0);`, http);
});

test("works without model parameter (backward compatible)", async () => {
  await exerciseGatewayConsumer(`${job}assert.deepEqual(await api.createAgentCronJob(job),{ok:true,id:'owned-job'});
assert.equal(JSON.parse(requests[0][1].body).args.job.payload.model,undefined);assert.equal(calls.length,0);`, http);
});

test("passes model in HTTP request body", async () => {
  await exerciseGatewayConsumer(`${job}job.payload.model='claude-haiku-3';
assert.equal((await api.createAgentCronJob(job)).ok,true);const body=JSON.parse(requests[0][1].body);
assert.equal(body.args.job.payload.model,'claude-haiku-3');assert.equal(body.tool,'cron');
assert.equal(body.args.action,'add');assert.equal(calls.length,0);`, http);
});

test("CLI fallback forwards exact model and timeout flags through inert port", async () => {
  await exerciseGatewayConsumer(`${job}job.payload.model='claude-sonnet-4-20250514';job.payload.timeoutSeconds=60;
job.delivery={mode:'none'};assert.deepEqual(await api.createAgentCronJob(job),{ok:true,id:'owned-cli-job'});
assert.equal(calls.length,1);assert.equal(calls[0][0],configured);
assert.deepEqual(calls[0][1],['cron','add','--json','--name','test/agent','--every','300000ms',
'--session','isolated','--agent','test-agent','--message','test','--timeout-seconds','60',
'--model','claude-sonnet-4-20250514','--no-deliver']);assert.deepEqual(calls[0][2],{timeout:30000});`,
    `accessPort=async()=>{};execPort=(bin,args,options,callback)=>{
callback(null,JSON.stringify({id:'owned-cli-job'}),'');return {}};`);
});

test("accepts delivery field alongside model", async () => {
  await exerciseGatewayConsumer(`${job}job.payload.model='claude-sonnet-4-20250514';job.delivery={mode:'none'};
assert.equal((await api.createAgentCronJob(job)).ok,true);const body=JSON.parse(requests[0][1].body);
assert.equal(body.args.job.payload.model,'claude-sonnet-4-20250514');
assert.deepEqual(body.args.job.delivery,{mode:'none'});assert.equal(calls.length,0);`, http);
});
