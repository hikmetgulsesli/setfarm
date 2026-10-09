import assert from "node:assert/strict";
import fs from "node:fs";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { test } from "node:test";

const index = process.execArgv.indexOf("--import");
const loader = index >= 0 ? process.execArgv[index + 1]! : createRequire(import.meta.url).resolve("tsx");
const medic = new URL("../src/medic/medic-cron.ts", import.meta.url).href;
const registry = new URL("../src/internal-production/baseline-dashboard-cutover-local-producer-drain-v2.ts", import.meta.url).href;
const logger = new URL("../src/lib/logger.ts", import.meta.url).href;
// Resolve dependencies using the installed loader's package home, never install
// or change the production module. All business process ports below are inert.
const dependencies = createRequire(loader).resolve("json5");
async function exercise(body: string, setup = ""): Promise<void> {
  const fixture = fs.mkdtempSync("/private/tmp/setfarm-medic-owned-child-v3-");
  fs.mkdirSync(fixture + "/ai/setrox", { recursive: true });
  const program = `import assert from 'node:assert/strict';import cp from 'node:child_process';
import fsp from 'node:fs/promises';import os from 'node:os';import {promisify} from 'node:util';
import {syncBuiltinESMExports,registerHooks} from 'node:module';import {pathToFileURL} from 'node:url';
const out={};try{
registerHooks({resolve(specifier,context,next){if(specifier==='json5')return {url:pathToFileURL(${JSON.stringify(dependencies)}).href,shortCircuit:true};return next(specifier,context)}});
const fixture=${JSON.stringify(fixture)},calls=[],writes=[],reads=[],unhandled=[];
process.on('unhandledRejection',e=>unhandled.push(String(e)));
const user=os.userInfo();os.homedir=()=>fixture;os.userInfo=()=>({...user,homedir:fixture});
const originalRead=fsp.readFile;fsp.readFile=async(p,...args)=>{
if(String(p).startsWith(fixture+'/')){reads.push(String(p));return String(p).endsWith('/jobs.json')?'[]':'{}'}
return originalRead(p,...args)};
for(const name of ['mkdir','writeFile','chmod','rm','rename'])fsp[name]=async(...args)=>{
assert.ok(String(args[0]).startsWith(fixture+'/'),'business writes restricted to fixture');writes.push([name,...args])};
let execPort=(...args)=>{args.at(-1)(null,'','');return undefined};
for(const name of ['spawn','spawnSync','fork','exec','execSync','execFileSync'])cp[name]=()=>{throw Error('UNEXPECTED_PROCESS_'+name)};
cp.execFile=(...args)=>{calls.push(args);return execPort(...args)};
// Business-only builtin result shape double; NEVER copy Node's custom
// promisifier, whose closure would run the genuine systemctl primitive.
cp.execFile[promisify.custom]=(...args)=>{
let resolve,reject;const promise=new Promise((r,j)=>{resolve=r;reject=j});
promise.child=cp.execFile(...args,(error,stdout,stderr)=>{
if(error){error.stdout=stdout;error.stderr=stderr;reject(error)}else resolve({stdout,stderr})});return promise};
globalThis.fetch=()=>{throw Error('UNEXPECTED_HTTP')};syncBuiltinESMExports();
const {logger}=await import(${JSON.stringify(logger)});for(const k of ['info','warn','debug','error'])logger[k]=()=>{};
${setup}
const api=await import(${JSON.stringify(medic)}),local=await import(${JSON.stringify(registry)});
${body}
assert.deepEqual(unhandled,[]);out.passed=true}catch(e){out.error=e.message??String(e)}process.stdout.write(JSON.stringify(out));`;
  fs.writeFileSync(fixture + "/intent.json", JSON.stringify({ program, loader }), { flag: "wx", mode: 0o600 });
  const child = spawn(process.execPath, ["--import", loader, "--input-type=module", "-e", program],
    { cwd: fixture, env: {}, stdio: ["ignore", "pipe", "pipe"] });
  let stdout = "", stderr = "", unknown: Error | undefined;
  const ends = { stdout: false, stderr: false }, closes = { stdout: false, stderr: false };
  child.on("error", error => { unknown ??= error; });
  for (const [stream, name] of [[child.stdout, "stdout"], [child.stderr, "stderr"]] as const) {
    stream.on("error", error => { unknown ??= error; });
    stream.on("end", () => { ends[name] = true; });stream.on("close", () => { closes[name] = true; });
    stream.on("data", chunk => { if (name === "stdout") stdout += chunk; else stderr += chunk; });
  }
  const [status, signal] = await new Promise<[number | null, NodeJS.Signals | null]>(resolve =>
    child.on("close", (code, sig) => resolve([code, sig])));
  fs.writeFileSync(fixture + "/result.json", JSON.stringify({ stdout, stderr, status, signal, ends, closes }), { flag: "wx", mode: 0o600 });
  console.log(JSON.stringify({ fixture, status, signal, ends, closes }));
  assert.equal(unknown, undefined);assert.equal(status, 0, stderr);assert.equal(signal, null);
  assert.deepEqual(ends, { stdout: true, stderr: true });assert.deepEqual(closes, { stdout: true, stderr: true });
  assert.equal(stderr, "");const result = JSON.parse(stdout);assert.equal(result.error, undefined, result.error);assert.equal(result.passed, true);
}

test("actual Medic status launch is denied at the child port after local JS closure", async () => {
  await exercise(`const js=await local.acquireDashboardCutoverLocalProducerDrainV2();
assert.equal(await api.isMedicCronInstalled(),false);assert.equal(calls.length,0);
local.assertDashboardCutoverLocalChildDrainV3(await local.acquireDashboardCutoverLocalChildDrainV3(js));`);
});
test("actual Medic install preserves show result, systemctl options and unit writes after child-only burn", async () => {
  await exercise(`assert.deepEqual(await api.installMedicCron(),{ok:true});
assert.deepEqual(calls.map(c=>[c[0],c[1]]),[['systemctl',['--user','show','setfarm-spawner.service','-p','Environment','--value']],
['systemctl',['--user','daemon-reload']],['systemctl',['--user','enable','--now','setfarm-medic.timer']]]);
for(const call of calls){assert.equal(call[2].timeout,30000);assert.equal(call[2].env.XDG_RUNTIME_DIR,'/run/user/'+user.uid);
assert.equal(call[2].env.DBUS_SESSION_BUS_ADDRESS,'unix:path=/run/user/'+user.uid+'/bus')}
assert.ok(writes.some(w=>w[0]==='writeFile'&&w[1]===fixture+'/.openclaw/setfarm-medic.env'&&w[2]==='SETFARM_PG_URL=postgresql://fixture/fixture\\n'));
const js=await local.acquireDashboardCutoverLocalProducerDrainV2();local.assertDashboardCutoverLocalProducerDrainV2(js);
await assert.rejects(local.acquireDashboardCutoverLocalChildDrainV3(js),{message:'DASHBOARD_CUTOVER_LOCAL_CHILD_DRAIN_REFUSED'});`,
    `execPort=(...args)=>{args.at(-1)(null,args[1][1]==='show'?'SETFARM_PG_URL=postgresql://fixture/fixture':'','');return undefined};`);
});

test("actual Medic failed show stays best-effort and installation continues", async () => {
  await exercise(`assert.deepEqual(await api.installMedicCron(),{ok:true});
assert.deepEqual(calls.map(c=>c[1][1]),['show','daemon-reload','enable']);
assert.equal(writes.some(w=>String(w[1]).endsWith('setfarm-medic.env')),false);`,
    `execPort=(...args)=>{args.at(-1)(args[1][1]==='show'?Error('INERT_SHOW'):null,'','');return undefined};`);
});

for (const phase of ["daemon-reload", "enable"]) test(`actual Medic ${phase} rejection preserves ordinary error`, async () => {
  await exercise(`assert.deepEqual(await api.installMedicCron(),{ok:false,error:'INERT_FAILURE'});
assert.deepEqual(calls.map(c=>c[1][1]),${JSON.stringify(phase === "enable" ? ["show", "daemon-reload", "enable"] : ["show", "daemon-reload"])});`,
    `execPort=(...args)=>{args.at(-1)(args[1][1]===${JSON.stringify(phase)}?Error('INERT_FAILURE'):null,'OUT','ERR');return undefined};`);
});

test("actual Medic uninstall still swallows disable error and removes both unit paths before reload", async () => {
  await exercise(`assert.deepEqual(await api.uninstallMedicCron(),{ok:true});
assert.deepEqual(calls.map(c=>c[1]),[['--user','disable','--now','setfarm-medic.timer'],['--user','daemon-reload']]);
assert.deepEqual(writes.filter(w=>w[0]==='rm').map(w=>w.slice(1)),[
[fixture+'/.config/systemd/user/setfarm-medic.timer',{force:true}],
[fixture+'/.config/systemd/user/setfarm-medic.service',{force:true}]]);`,
    `execPort=(...args)=>{args.at(-1)(args[1][1]==='disable'?Error('INERT_DISABLE'):null,'','');return undefined};`);
});

test("actual Medic open status succeeds without registered ancestry and burns only child custody", async () => {
  await exercise(`assert.equal(await api.isMedicCronInstalled(),true);
assert.deepEqual(calls[0][1],['--user','is-enabled','--quiet','setfarm-medic.timer']);
assert.equal(calls[0][2].env.FIXTURE_ENV,'public-marker');
const js=await local.acquireDashboardCutoverLocalProducerDrainV2();
await assert.rejects(local.acquireDashboardCutoverLocalChildDrainV3(js),{message:'DASHBOARD_CUTOVER_LOCAL_CHILD_DRAIN_REFUSED'});
local.assertDashboardCutoverLocalProducerDrainV2(js);`, `process.env.FIXTURE_ENV='public-marker';`);
});

test("actual Medic held install and uninstall refuse before any business filesystem or child port", async () => {
  await exercise(`await local.acquireDashboardCutoverLocalProducerDrainV2();
for(const call of [api.installMedicCron,api.uninstallMedicCron])await assert.rejects(call(),
{message:'DASHBOARD_CUTOVER_LOCAL_PRODUCER_DRAIN_REFUSED'});
assert.deepEqual(calls,[]);assert.deepEqual(writes,[]);assert.deepEqual(reads,[]);`);
});
