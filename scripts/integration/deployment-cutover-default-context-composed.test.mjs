import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { retainedFixture } from "../__tests__/fixtures/deployment-cutover-retained-profile.mjs";
import { run, write } from "../__tests__/fixtures/deployment-cutover-bootstrap.mjs";

const countNames = ["activeRunCount", "openClaimCount", "executionAttemptCount", "activeRuntimeSessionCount", "activeCompletionOwnerCount",
  "unsettledMandatoryEffectCount", "artifactReservationCount", "publicationBatchCount", "artifactPublicationCount",
  "terminationOwnerCount", "findingOwnerCount", "recoveryOwnerCount", "operationalDeliveryCount"];

for (const fault of ["", "sample-refusal", "absence-after-sample", "absence-aba-after-sample", "acquire-cleanup-loss", "acquire-unknown", "acquire-config-cleanup-loss",
  "monitor-idle", "monitor-absence-idle", "monitor-absence-same", "monitor-absence-replacement", "monitor-absence-startup", "monitor-error", "monitor-malformed", "startup-state"]) test(`authenticated real default composition ${fault || "success"}`, () => {
  retainedFixture(({ root }) => {
    const result = run(root, ["inspect-default-context", "--json"]);
    if (fault && !["monitor-idle", "monitor-absence-idle", "startup-state"].includes(fault)) {
      assert.equal(result.status, 1, result.stdout);
      assert.equal(result.stdout, "");
      const lines = result.stderr.trimEnd().split("\n");
      assert.equal(lines[0], "DEPLOYMENT_CUTOVER_BOOTSTRAP_REFUSED");
      assert.deepEqual(JSON.parse(lines[1]), { schema: "setfarm.deployment-cutover-refusal.v1", scope: "default-owner",
        stage: fault.startsWith("acquire-") ? "acquire-launcher" : (fault === "sample-refusal" || fault.startsWith("monitor-")) ? "qualify" : "postqualify",
        ownerContext: fault.startsWith("absence-") ? "absence" : null,
        launcherStage: fault === "sample-refusal" ? "measure" : ["monitor-error", "monitor-malformed"].includes(fault) ? "sampled-native"
          : fault.startsWith("monitor-absence-") ? "sampled-postcheck" : null,
        cleanupFailed: fault === "acquire-unknown" ? null : ["acquire-cleanup-loss", "acquire-config-cleanup-loss"].includes(fault) });
      assert.doesNotMatch(result.stderr, /PRIVATE_(?:TOKEN|PASSWORD)|PRIVATESOCKET/);
      assert.equal(fs.existsSync(path.join(root, ".setfarm/census-called")), false);
    } else {
      assert.equal(result.status, 0, result.stderr);
      const context = JSON.parse(result.stdout).defaultContext;
      assert.equal(context.schema, "setfarm.internal-production-deployment-cutover-default-context.v1");
      assert.equal(context.passiveQualification.samples.length, 2);
      assert.equal(context.resolution.contexts.length, 2);
      assert.equal(context.databaseCensus.activeRunCount, 0);
      assert.ok(context.blockers.includes("controller-ownership-not-acquired"));
      assert.equal(fs.existsSync(path.join(root, ".setfarm/census-called")), true);
      assert.doesNotMatch(result.stdout, /PRIVATE_(?:TOKEN|PASSWORD)|PRIVATESOCKET/);
    }
  }, { resolution: true, bootstrapInstrument: source => source.replace('async function inspect() {', `
import cp from 'node:child_process';
const actualSpawn=cp.spawnSync, labels=['com.setrox.setfarm-spawner','com.setrox.setfarm-dashboard'];
let fixtureSamples=0,fixtureIdle=false;
let fixtureStarting=${JSON.stringify(fault)}==='startup-state',fixtureStartingScheduled=false;
let fixtureMonitorReplacement=false,fixtureMonitorStartup=false;
const actualClose=fs.closeSync;let fixtureConfigCloseLoss=false;
fs.closeSync=fd=>{actualClose(fd);if(fixtureConfigCloseLoss){fixtureConfigCloseLoss=false;throw Error('PRIVATE_PASSWORD')}};
cp.spawnSync=(executable,args,options)=>{
  const success=stdout=>({status:0,signal:null,stdout:Buffer.from(stdout),stderr:Buffer.alloc(0)});
  if(executable==='/usr/bin/plutil'&&${JSON.stringify(fault)}==='acquire-config-cleanup-loss'){fixtureConfigCloseLoss=true;throw Error('PRIVATE_PASSWORD')}
  if(executable==='/usr/bin/getconf')return success('/var/folders/fixture/T/\\n');
  if(executable==='/bin/launchctl'){
    const index=labels.findIndex(label=>args[1]==='gui/'+process.getuid()+'/'+label);
    if(index<0||args[0]!=='print')throw Error('UNEXPECTED_LABEL');
    let text=fs.readFileSync(path.join(root,'.setfarm/launcher-'+index),'utf8');
    if(!fixtureIdle&&globalThis.fixtureAllowRunning)text=text.replace('state = not running','state = running').replace('active count = 0','active count = 1').slice(0,-2)+'\\tpid = '+(12345+index)+'\\n}\\n';
    if(fixtureMonitorReplacement&&index===0)text=text.replace('pid = 12345','pid = 22345');
    if(fixtureMonitorStartup&&index===0)text=text.replace('state = running','state = xpcproxy');
    if(globalThis.fixtureAllowRunning&&fixtureStarting){
      text=text.replace('state = running','state = xpcproxy');
      if(!fixtureStartingScheduled){fixtureStartingScheduled=true;setTimeout(()=>{fixtureStarting=false},0)}
    }
    return success(text);
  }
  if(executable==='/usr/bin/python3'){
    if(fixtureStarting)throw Error('NATIVE_DURING_STARTUP');
    const request=JSON.parse(options.input),measurement=request.operation==='measure',monitor=request.operation==='monitor';
    if(monitor&&(request.expectedParentPid!==1||request.expectedStartSeconds!==1234||request.expectedStartMicroseconds!==56))throw Error('CROSSED_MONITOR_REQUEST');
    if(monitor&&fixtureSamples===2&&${JSON.stringify(fault)}==='monitor-idle')fixtureIdle=true;
    if(monitor&&fixtureSamples===2&&${JSON.stringify(fault)}==='monitor-error')return {status:1,signal:null,stdout:Buffer.alloc(0),stderr:Buffer.from('PRIVATE_PASSWORD')};
    if(measurement&&${JSON.stringify(fault)}==='sample-refusal')return {status:1,signal:null,stdout:Buffer.alloc(0),stderr:Buffer.from('PRIVATE_PASSWORD')};
    let value={schema:measurement?'setfarm.internal-production-passive-home-measurement.v1':'setfarm.internal-production-passive-process-identity.v1',
      pid:request.pid,ppid:1,uid:request.uid,gid:request.gid,startSeconds:1234,startMicroseconds:56,
      ...(measurement?{homeContext:'account',completeEnvironmentValidated:true,stableDoubleRead:true}:{})};
    if(monitor&&fixtureSamples===2&&${JSON.stringify(fault)}.startsWith('monitor-absence-')){
      if(${JSON.stringify(fault)}==='monitor-absence-idle')fixtureIdle=true;
      if(${JSON.stringify(fault)}==='monitor-absence-replacement')fixtureMonitorReplacement=true;
      if(${JSON.stringify(fault)}==='monitor-absence-startup')fixtureMonitorStartup=true;
      value={schema:'setfarm.internal-production-passive-process-absence.v1',pid:request.pid,evidence:'proc-pidinfo-esrch'};
    }
    if(monitor&&fixtureSamples===2&&${JSON.stringify(fault)}==='monitor-malformed')
      value={schema:'setfarm.internal-production-passive-process-absence.v1',pid:request.pid,evidence:'proc-pidinfo-esrch',extra:true};
    if(measurement){
      if(request.environment.HOME!==fixtureHome||request.environment.SETFARM_ENV_DIR!==undefined||request.expectedStartSeconds!==1234)throw Error('CROSSED_NATIVE_REQUEST');
      if(++fixtureSamples===2)setTimeout(()=>{
        fixtureIdle=true;
        if(['absence-after-sample','absence-aba-after-sample'].includes(${JSON.stringify(fault)})){
          fs.writeFileSync(path.join(root,'.env'),'PRIVATE_PASSWORD');
          if(${JSON.stringify(fault)}==='absence-aba-after-sample')fs.unlinkSync(path.join(root,'.env'));
        }
      },0);
    }
    return success(JSON.stringify(Object.fromEntries(Object.entries(value).sort(([a],[b])=>a<b?-1:a>b?1:0)))+'\\n');
  }
  if(executable==='/bin/ps')return success(process.getuid()+' '+process.pid+' 1 '+process.pid+' S Wed Sep 16 00:00:00 2026 /fixture/controller\\n');
  if(executable==='/usr/sbin/lsof')return {status:1,signal:null,stdout:Buffer.alloc(0),stderr:Buffer.alloc(0)};
  return actualSpawn(executable,args,options);
};syncBuiltinESMExports();
async function inspect() {`).replace('load(url, context, nextLoad) {',
      'load(url, context, nextLoad) { if(url.endsWith("/deployment-cutover-passive-home.mjs"))globalThis.fixtureAllowRunning=true;'), controllerOptions: {
    envAbsence: true,
    sourceInstrument: (locator, source) => locator.endsWith("baseline-deployment-cutover-node-path-v1")
      ? `let holds=0;export function holdDeploymentCutoverNodePathV1(){
        const fault=${JSON.stringify(fault)};if(fault==='acquire-unknown'||(fault==='acquire-cleanup-loss'&&++holds===2))throw Error('PRIVATE_PASSWORD');
        return Object.freeze({observation:Object.freeze({candidatePath:process.execPath,executablePath:process.execPath}),recheck(){},close(){if(fault==='acquire-cleanup-loss')throw Error('PRIVATE_PASSWORD')}})}` : source,
    extraSources: { "internal-production/baseline-legacy-database-census-v1": `
      import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';
      export async function observeLegacyDatabaseCensusV1(url,cold,profile){
        if(url!=='postgresql://fixture:PRIVATE_PASSWORD@localhost/setfarm'||cold!==true||profile!=='cutover-local')throw Error('CROSSED_DB');
        await Promise.resolve();fs.writeFileSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../.setfarm/census-called'),'fixture');
        return Object.freeze(${JSON.stringify({ ...Object.fromEntries(countNames.map(name => [name, 0])), legacyFindingPublicationInventory: { entries: [] } })});
      }` },
    prepare(root, home) {
      const labels = ["com.setrox.setfarm-spawner", "com.setrox.setfarm-dashboard"];
      labels.forEach((label, index) => {
        const program = path.join(home, ".local/bin/setfarm"), args = index ? [program, "dashboard", "start", "--port", "3333"] : [program, "spawner", "start"];
        const env = { PATH: "/usr/bin:/bin", SETFARM_PG_URL: "postgresql://fixture:PRIVATE_PASSWORD@localhost/setfarm", ...(index ? { SETFARM_OPERATIONAL_WRITE_TOKEN: "PRIVATE_TOKEN" } : {}) };
        const log = path.join(home, ".openclaw/logs", index ? "setfarm-dashboard.watch" : "setfarm-spawner.watch");
        const file = path.join(home, "Library/LaunchAgents", label + ".plist");
        write(home, path.relative(home, file), JSON.stringify({ Label: label, ProgramArguments: args, EnvironmentVariables: env,
          RunAtLoad: true, StartInterval: 60, StandardOutPath: log + ".log", StandardErrorPath: log + ".err.log" }), 0o600);
        const block = (name, values) => '\t' + name + ' = {\n' + values.map(value => '\t\t' + value + '\n').join('') + '\t}\n';
        const text = `gui/${process.getuid()}/${label} = {\n\tpath = ${file}\n\tprogram = ${program}\n\tstate = not running\n\tactive count = 0\n\ttype = LaunchAgent\n\trun interval = 60 seconds\n\tproperties = runatload\n`
          + block("arguments", args) + block("environment", Object.entries({ ...env, OSLogRateLimit: "64", XPC_SERVICE_NAME: label }).map(([key, value]) => `${key} => ${value}`))
          + block("inherited environment", ["SSH_AUTH_SOCK => /var/run/com.apple.launchd.PRIVATESOCKET/Listeners"])
          + block("default environment", ["PATH => /usr/bin:/bin:/usr/sbin:/sbin"]) + "}\n";
        write(root, `.setfarm/launcher-${index}`, text);
      });
    },
  } });
});
