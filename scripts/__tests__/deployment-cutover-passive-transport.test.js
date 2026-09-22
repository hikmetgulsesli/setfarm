import assert from "node:assert/strict";
import fs from "node:fs";
import { spawnSync } from "node:child_process";
import { test } from "node:test";

const transport = new URL("../deployment-cutover-passive-home.mjs", import.meta.url);
const python = new URL("../deployment-cutover-passive-home.py", import.meta.url);
const request = { pid: 12345, uid: 501, gid: 20, executable: "/fixture/node", launchExecutable: "/fixture/node", argv: ["node", "cli.js"],
  expectedStartSeconds: 1234, expectedStartMicroseconds: 5678, environment: { HOME: "/fixture/account", SECRET: "PRIVATE_SENTINEL" } };
const measured = { schema: "setfarm.internal-production-passive-home-measurement.v1", pid: 12345, ppid: 1, uid: 501, gid: 20,
  startSeconds: 1234, startMicroseconds: 5678, homeContext: "account", completeEnvironmentValidated: true, stableDoubleRead: true };
const absent = { schema: "setfarm.internal-production-passive-process-absence.v1", pid: 12345, evidence: "proc-pidinfo-esrch" };
function invoke(fault, operation = "measure") {
  assert.ok(fs.existsSync(transport), "fixed authenticated passive transport must exist");
  const child = spawnSync(process.execPath, ["--input-type=module", "-e", `
import assert from 'node:assert/strict';import fs from 'node:fs';import cp from 'node:child_process';
import {registerHooks,syncBuiltinESMExports} from 'node:module';
const source=fs.readFileSync(new URL(${JSON.stringify(python.href)}),'utf8');
registerHooks({load(url,ctx,next){if(url===${JSON.stringify(python.href)})return {format:'module',source:'export default '+JSON.stringify(source),shortCircuit:true};return next(url,ctx)}});
const operation=${JSON.stringify(operation)}, fullRequest=${JSON.stringify(request)}, measured=${JSON.stringify(measured)}, absent=${JSON.stringify(absent)}, fault=${JSON.stringify(fault)};
const request=operation==='measure'?fullRequest:operation==='identify'?Object.fromEntries(["pid","uid","gid","executable"].map(key=>[key,fullRequest[key]])):
  {...Object.fromEntries(["pid","uid","gid","executable"].map(key=>[key,fullRequest[key]])),expectedParentPid:measured.ppid,
    expectedStartSeconds:measured.startSeconds,expectedStartMicroseconds:measured.startMicroseconds};
if(operation!=='measure'){measured.schema='setfarm.internal-production-passive-process-identity.v1';delete measured.homeContext;delete measured.completeEnvironmentValidated;delete measured.stableDoubleRead}
cp.spawnSync=(executable,args,options)=>{
  assert.equal(executable,'/usr/bin/python3');assert.deepEqual(args.slice(0,4),['-I','-S','-B','-c']);assert.equal(args.length,5);assert.equal(args[4],source);
  assert.equal(options.cwd,'/');assert.equal(options.shell,false);assert.equal(options.timeout,2000);assert.equal(options.maxBuffer,4096);
  assert.deepEqual(options.env,{PATH:'/usr/bin:/bin',LANG:'C',LC_ALL:'C'});assert.deepEqual(JSON.parse(options.input.toString()),{...request,operation});
  const value=fault.startsWith('absence')?{...absent}:{...measured};
  if(fault==='pid'||fault==='absence-pid')value.pid++;if(fault==='uid')value.uid++;if(fault==='extra'||fault==='absence-extra')value.extra='PRIVATE_SENTINEL';
  if(fault==='gid')value.gid++;if(fault==='microsecond')value.startMicroseconds++;if(fault==='schema')value.schema='PRIVATE_SENTINEL';
  if(fault==='not-qualified')value.completeEnvironmentValidated=false;if(fault==='fractional-start')value.startMicroseconds=0.5;
  if(fault==='generation')value.startSeconds++;if(fault==='parent')value.ppid++;if(fault==='absence-evidence')value.evidence='PRIVATE_SENTINEL';
  if(fault==='absence-missing')delete value.evidence;if(fault==='absence-crossed-identity')value.schema='setfarm.internal-production-passive-process-identity.v1';
  if(fault==='crossed-absence-schema')value.schema='setfarm.internal-production-passive-process-absence.v1';
  const ordered=Object.fromEntries(Object.entries(value).sort(([a],[b])=>a.localeCompare(b)));
  return {status:fault==='exit'?1:0,signal:null,error:fault==='timeout'?Error('PRIVATE_SENTINEL'):undefined,
    stdout:Buffer.from(fault==='malformed'?'PRIVATE_SENTINEL':JSON.stringify(fault==='absence-noncanonical'?value:ordered)+(fault==='absence-no-newline'?'':'\\n')),
    stderr:Buffer.from(fault==='stderr'?'PRIVATE_SENTINEL':'')};
};syncBuiltinESMExports();
try{const module=await import(${JSON.stringify(transport.href)});const names={measure:'measureDeploymentCutoverPassiveHomeV1',identify:'identifyDeploymentCutoverPassiveProcessV1',monitor:'monitorDeploymentCutoverPassiveProcessV1'};
  const value=module[names[operation]](request);process.stdout.write(JSON.stringify({value,frozen:Object.isFrozen(value)}))}
catch(error){process.stdout.write(error.message)}
`], { encoding: "utf8", env: { PATH: "/usr/bin:/bin" }, timeout: 5000, maxBuffer: 8192 });
  assert.equal(child.status, 0, child.stderr);
  assert.equal(child.stderr, "");
  assert.doesNotMatch(child.stdout, /PRIVATE_SENTINEL|fixture\/account/);
  return child.stdout;
}
test("passive transport uses isolated fixed authenticated source and private stdin", () => {
  assert.deepEqual(JSON.parse(invoke("none")), { value: measured, frozen: true });
});
test("identity-only transport returns a separate generation commitment", () => {
  const { homeContext, completeEnvironmentValidated, stableDoubleRead, ...identity } = measured;
  identity.schema = "setfarm.internal-production-passive-process-identity.v1";
  assert.deepEqual(JSON.parse(invoke("none", "identify")), { value: identity, frozen: true });
});
test("sampled monitor transport returns the bound live identity", () => {
  const { homeContext, completeEnvironmentValidated, stableDoubleRead, ...identity } = measured;
  identity.schema = "setfarm.internal-production-passive-process-identity.v1";
  assert.deepEqual(JSON.parse(invoke("none", "monitor")), { value: identity, frozen: true });
});
test("sampled monitor transport returns only exact typed lookup absence", () => {
  assert.deepEqual(JSON.parse(invoke("absence", "monitor")), { value: absent, frozen: true });
});
for (const fault of ["pid", "uid", "extra", "not-qualified", "fractional-start", "generation", "exit", "timeout", "malformed", "stderr"]) {
  test(`passive transport refuses ${fault} without leaking private child details`, () => {
    assert.equal(invoke(fault), "DEPLOYMENT_CUTOVER_PASSIVE_HOME_REFUSED");
  });
}
for (const fault of ["pid", "uid", "gid", "extra", "fractional-start", "generation", "microsecond", "parent", "schema", "crossed-absence-schema",
  "exit", "timeout", "malformed", "stderr", "absence-pid", "absence-evidence", "absence-extra", "absence-missing", "absence-crossed-identity",
  "absence-noncanonical", "absence-no-newline"]) {
  test(`sampled monitor transport refuses ${fault} without crossing identity and absence schemas`, () => {
    assert.equal(invoke(fault, "monitor"), "DEPLOYMENT_CUTOVER_PASSIVE_HOME_REFUSED");
  });
}
test("strict identify transport refuses the sampled-only absence schema", () => {
  assert.equal(invoke("absence", "identify"), "DEPLOYMENT_CUTOVER_PASSIVE_HOME_REFUSED");
});
test("strict measurement transport refuses the sampled-only absence schema", () => {
  assert.equal(invoke("absence", "measure"), "DEPLOYMENT_CUTOVER_PASSIVE_HOME_REFUSED");
});

test("passive transport cannot spawn outside authenticated source bootstrap", () => {
  const result = spawnSync(process.execPath, ["--input-type=module", "-e", `
import cp from 'node:child_process';import {syncBuiltinESMExports} from 'node:module';
cp.spawnSync=()=>{process.stdout.write('UNAUTHENTICATED_CHILD');throw Error('unexpected')};syncBuiltinESMExports();
try{await import(${JSON.stringify(transport.href)});process.stdout.write('UNAUTHENTICATED_IMPORT')}
catch(error){process.stdout.write(error.code==='ERR_UNKNOWN_FILE_EXTENSION'?'REFUSED':'UNEXPECTED_ERROR')}
`], { encoding: "utf8", env: { PATH: "/usr/bin:/bin" }, timeout: 5000, maxBuffer: 4096 });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, "REFUSED");
  assert.equal(result.stderr, "");
});

test("non-Darwin test selection skips only native process API cases", () => {
  const tests = new URL("./deployment-cutover-passive-home.test.js", import.meta.url);
  const result = spawnSync(process.execPath, ["--test-reporter=tap", "--input-type=module", "-e", `
Object.defineProperty(process,'platform',{value:'linux'});await import(${JSON.stringify(tests.href)});
`], { encoding: "utf8", env: { PATH: "/usr/bin:/bin" }, timeout: 15000, maxBuffer: 65536 });
  assert.equal(result.status, 0, result.stderr);
  const nativeLines = result.stdout.split("\n").filter(line => /^ok [0-9]+ - native bridge /.test(line));
  assert.ok(nativeLines.length >= 2);
  assert.ok(nativeLines.every(line => line.endsWith("# SKIP Darwin native process APIs required")));
  assert.match(result.stdout, /ok [0-9]+ - native buffer qualifies exact private profile and preserves empty argv\n/);
});
