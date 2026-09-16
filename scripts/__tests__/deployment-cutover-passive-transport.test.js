import assert from "node:assert/strict";
import fs from "node:fs";
import { spawnSync } from "node:child_process";
import { test } from "node:test";

const transport = new URL("../deployment-cutover-passive-home.mjs", import.meta.url);
const python = new URL("../deployment-cutover-passive-home.py", import.meta.url);
const request = { pid: 12345, uid: 501, gid: 20, executable: "/fixture/node", launchExecutable: "/fixture/node", argv: ["node", "cli.js"],
  environment: { HOME: "/fixture/account", SECRET: "PRIVATE_SENTINEL" } };
const measured = { schema: "setfarm.internal-production-passive-home-measurement.v1", pid: 12345, ppid: 1, uid: 501, gid: 20,
  startSeconds: 1234, startMicroseconds: 5678, homeContext: "account", completeEnvironmentValidated: true, stableDoubleRead: true };
function invoke(fault) {
  assert.ok(fs.existsSync(transport), "fixed authenticated passive transport must exist");
  const child = spawnSync(process.execPath, ["--input-type=module", "-e", `
import assert from 'node:assert/strict';import fs from 'node:fs';import cp from 'node:child_process';
import {registerHooks,syncBuiltinESMExports} from 'node:module';
const source=fs.readFileSync(new URL(${JSON.stringify(python.href)}),'utf8');
registerHooks({load(url,ctx,next){if(url===${JSON.stringify(python.href)})return {format:'module',source:'export default '+JSON.stringify(source),shortCircuit:true};return next(url,ctx)}});
const request=${JSON.stringify(request)}, measured=${JSON.stringify(measured)}, fault=${JSON.stringify(fault)};
cp.spawnSync=(executable,args,options)=>{
  assert.equal(executable,'/usr/bin/python3');assert.deepEqual(args.slice(0,4),['-I','-S','-B','-c']);assert.equal(args.length,5);assert.equal(args[4],source);
  assert.equal(options.cwd,'/');assert.equal(options.shell,false);assert.equal(options.timeout,2000);assert.equal(options.maxBuffer,4096);
  assert.deepEqual(options.env,{PATH:'/usr/bin:/bin',LANG:'C',LC_ALL:'C'});assert.deepEqual(JSON.parse(options.input.toString()),request);
  if(fault==='pid')measured.pid++;if(fault==='uid')measured.uid++;if(fault==='extra')measured.extra='PRIVATE_SENTINEL';
  if(fault==='not-qualified')measured.completeEnvironmentValidated=false;if(fault==='fractional-start')measured.startMicroseconds=0.5;
  const value=Object.fromEntries(Object.entries(measured).sort(([a],[b])=>a.localeCompare(b)));
  return {status:fault==='exit'?1:0,signal:null,error:fault==='timeout'?Error('PRIVATE_SENTINEL'):undefined,
    stdout:Buffer.from(fault==='malformed'?'PRIVATE_SENTINEL':JSON.stringify(value)+'\\n'),stderr:Buffer.from(fault==='stderr'?'PRIVATE_SENTINEL':'')};
};syncBuiltinESMExports();
try{const module=await import(${JSON.stringify(transport.href)});const value=module.measureDeploymentCutoverPassiveHomeV1(request);process.stdout.write(JSON.stringify({value,frozen:Object.isFrozen(value)}))}
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
for (const fault of ["pid", "uid", "extra", "not-qualified", "fractional-start", "exit", "timeout", "malformed", "stderr"]) {
  test(`passive transport refuses ${fault} without leaking private child details`, () => {
    assert.equal(invoke(fault), "DEPLOYMENT_CUTOVER_PASSIVE_HOME_REFUSED");
  });
}

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
  assert.equal((result.stdout.match(/# SKIP Darwin native process APIs required/g) ?? []).length, 10);
  assert.match(result.stdout, /ok [0-9]+ - native buffer qualifies exact private profile and preserves empty argv\n/);
});
