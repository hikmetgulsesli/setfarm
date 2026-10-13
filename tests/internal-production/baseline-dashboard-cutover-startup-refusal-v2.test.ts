import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import ts from "typescript";

const root = new URL("../../src/", import.meta.url).href;
const importIndex = process.execArgv.indexOf("--import");
const loader = importIndex >= 0 ? process.execArgv[importIndex + 1]! : "tsx";
const cliSource = readFileSync(new URL("../../src/cli/cli.ts", import.meta.url), "utf8");
const cliTree = ts.createSourceFile("cli.ts", cliSource, ts.ScriptTarget.Latest, true);
let dashboardBranch = "";
function visit(node: ts.Node): void {
  if (ts.isIfStatement(node) && node.expression.getText(cliTree) === 'group === "dashboard"') dashboardBranch = node.getText(cliTree);
  ts.forEachChild(node, visit);
}
visit(cliTree); assert.ok(dashboardBranch);
const autoStart = cliSource.slice(cliSource.indexOf("// Auto-start dashboard if not already running"),
  cliSource.indexOf("    assertOrdinarySpawnerDeploymentCutoverAdmissionV1();", cliSource.indexOf("// Auto-start dashboard if not already running")));
assert.ok(autoStart.includes("isRunning().running"));
const snippets = [dashboardBranch, autoStart].map(source => ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
}).outputText);

function run(entry: string, mode = "open") {
  const result = spawnSync(process.execPath, ["--import", loader, "--input-type=module", "-e", `
    import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';
    import path from 'node:path';import http from 'node:http';import cp from 'node:child_process';
    import {registerHooks,syncBuiltinESMExports} from 'node:module';
    const original={mkdir:fs.mkdirSync,write:fs.writeFileSync,open:fs.openSync,lstat:fs.lstatSync,rm:fs.rmSync,unlink:fs.unlinkSync};
    const home=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'dashboard-refusal-v2-')));
    const workspace=path.join(home,'ai/setrox');fs.mkdirSync(workspace,{recursive:true,mode:0o700});
    const account=os.userInfo();os.userInfo=()=>({...account,homedir:home});os.homedir=()=>home;syncBuiltinESMExports();
    // Advanced providers are outside this startup-only source fixture. Any call refuses.
    const unused={
      'product-build-authority.js':'export class ProductBuildAuthorityV2Error extends Error{};export function readVersionedProductBuildAuthority(){throw Error("UNQUALIFIED_ADVANCED_PORT")}',
      'run-operational-model.js':'export function getRunOperationalModel(){throw Error("UNQUALIFIED_ADVANCED_PORT")}',
      'run-operational-snapshot.js':'export function buildRunOperationalSnapshot(){throw Error("UNQUALIFIED_ADVANCED_PORT")};export const buildRunOperationalSnapshotInTransaction=buildRunOperationalSnapshot;',
      'runtime-artifact-reader.js':'export class RuntimeArtifactReaderError extends Error{};export function createRuntimeArtifactReader(){throw Error("UNQUALIFIED_ADVANCED_PORT")}',
      'v3-deploy-executor.js':'export function observeLocalV3Deployment(){throw Error("UNQUALIFIED_ADVANCED_PORT")}',
    };
    registerHooks({resolve(s,c,next){const name=s.split('/').at(-1);if(Object.hasOwn(unused,name))return{url:'data:text/javascript,'+encodeURIComponent(unused[name]),shortCircuit:true};return next(s,c)}});
    const records=await import(${JSON.stringify(root + 'internal-production/baseline-deployment-cutover-records-v1.ts')});
    const target=path.join(workspace,'data/internal-production-baseline/deployment-cutover-v1');
    const publish=()=>{
      const hash='a'.repeat(64),sha='b'.repeat(40);
      const deployment={checkoutPath:'/fixture/source',checkoutDirectoryIdentityHash:hash,sourceSha:sha,sourceTreeHash:'c'.repeat(40),buildHash:hash};
      const bytes=records.encodeDeploymentCutoverIntentV1(records.createDeploymentCutoverIntentV1({oldDeployment:deployment,newDeployment:{...deployment,checkoutPath:'/fixture/new-source'},cliLinkObservationHash:hash,spawnerLauncherConfigurationHash:hash,dashboardLauncherConfigurationHash:hash,maintenanceIntentHash:hash,dashboardPort:3333}));
      original.mkdir(target,{recursive:true,mode:0o700});original.write(path.join(target,'intent.json'),bytes,{mode:0o600,flag:'wx'});
    };
    const mode=${JSON.stringify(mode)},entry=${JSON.stringify(entry)};
    if(mode==='open')publish();if(mode==='unknown'){original.mkdir(target,{recursive:true,mode:0o700});original.write(path.join(target,'unexpected'),'invalid')}
    const p={mutations:0,creates:0,listens:0,spawns:0,pidLookups:0,unlinks:0};
    if(entry==='stale-parent'||entry==='running-parent'){
      const pidDir=path.join(home,'.openclaw/setfarm');original.mkdir(pidDir,{recursive:true});original.write(path.join(pidDir,'dashboard.pid'),'424242');
      process.kill=()=>{p.pidLookups++;if(entry==='stale-parent')throw Object.assign(Error('ESRCH'),{code:'ESRCH'});return true};
    }
    const refuseMutation=()=>{p.mutations++;throw Error('FORBIDDEN_MUTATION')};
    const servicePath=file=>String(file).startsWith(path.join(home,'.openclaw'));
    fs.mkdirSync=(file,...args)=>servicePath(file)?(mode==='late-open'?undefined:refuseMutation()):original.mkdir(file,...args);
    fs.writeFileSync=(file,...args)=>servicePath(file)?(mode==='late-open'?(p.mutations++,publish()):refuseMutation()):original.write(file,...args);
    fs.openSync=(file,flags,...args)=>{
      if(servicePath(file)&&(typeof flags==='string'||(flags&(fs.constants.O_WRONLY|fs.constants.O_RDWR|fs.constants.O_CREAT))))return refuseMutation();
      return original.open(file,flags,...args);
    };
    http.createServer=()=>{p.creates++;return{listen(){p.listens++}}};
    cp.spawn=()=>{p.spawns++;throw Error('FORBIDDEN_SPAWN')};syncBuiltinESMExports();
    fs.unlinkSync=(file,...args)=>{if(servicePath(file)){p.unlinks++;return refuseMutation()}return original.unlink(file,...args)};syncBuiltinESMExports();
    let error;
    try{
      if(entry==='assert'){
        const m=await import(${JSON.stringify(root + 'internal-production/baseline-deployment-cutover-v1.ts')});
        assert.equal(typeof m.assertOrdinaryDashboardDeploymentCutoverAdmissionV2,'function','MISSING_DASHBOARD_ASSERT');
        if(mode==='reentry'){
          let nested=false;fs.lstatSync=(...args)=>{if(!nested){nested=true;try{m.assertOrdinaryDashboardDeploymentCutoverAdmissionV2()}catch{}}return original.lstat(...args)};syncBuiltinESMExports();
        }
        m.assertOrdinaryDashboardDeploymentCutoverAdmissionV2();
      }else if(entry==='dashboard'){
        const m=await import(${JSON.stringify(root + 'server/dashboard.ts')});m.startDashboard(0);
      }else if(entry==='parent'||entry==='stale-parent'||entry==='running-parent'){
        const m=await import(${JSON.stringify(root + 'server/daemonctl.ts')});await m.startDaemon(3333);
      }else if(entry.startsWith('cli')){
        const m=await import(${JSON.stringify(root + 'internal-production/baseline-deployment-cutover-v1.ts')});
        const source=entry==='cli-auto'?${JSON.stringify(snippets[1])}:${JSON.stringify(snippets[0])};
        const AsyncFunction=Object.getPrototypeOf(async function(){}).constructor;
        const execute=new AsyncFunction('group','args','assertOrdinaryDashboardDeploymentCutoverAdmissionV2','isRunning','getDaemonStatus','startDaemon','console',source);
        await execute('dashboard',['dashboard',entry==='cli-implicit'?undefined:entry==='cli-legacy'?'4040':'start'],m.assertOrdinaryDashboardDeploymentCutoverAdmissionV2,
          ()=>{p.pidLookups++;return{running:true,pid:424242}},()=>{p.pidLookups++;return{running:true,pid:424242}},async()=>{p.spawns++;return{pid:424242,port:3333}},{log(){}});
      }else await import(${JSON.stringify(root + 'server/daemon.ts')});
    }catch(e){error=e.message}
    fs.lstatSync=original.lstat;syncBuiltinESMExports();
    if(entry==='assert'&&error==='DEPLOYMENT_CUTOVER_UNQUALIFIED_DASHBOARD_START_REFUSED'){
      if(mode==='open'||mode==='unknown')fs.renameSync(target,path.join(workspace,'preserved-test-intent'));
      const m=await import(${JSON.stringify(root + 'internal-production/baseline-deployment-cutover-v1.ts')});
      let second;try{m.assertOrdinaryDashboardDeploymentCutoverAdmissionV2()}catch(e){second=e.message}
      assert.equal(second,'DEPLOYMENT_CUTOVER_UNQUALIFIED_DASHBOARD_START_REFUSED');
    }
    original.rm(home,{recursive:true,force:true});process.stdout.write(JSON.stringify({...p,error}));
  `], { encoding: "utf8", timeout: 15000, maxBuffer: 1024 * 1024,
    env: { PATH: "/usr/bin:/bin", LANG: "C", LC_ALL: "C" } });
  assert.equal(result.status, 0, result.stderr); assert.equal(result.signal, null);
  assert.equal(result.stderr, ""); return JSON.parse(result.stdout);
}

for (const mode of ["open", "unknown"]) for (const entry of ["assert", "dashboard", "parent", "stale-parent", "running-parent", "daemon"]) {
  test(`initial ${mode} refuses ${entry} before mutation, server or child ports`, () => {
    const result = run(entry, mode);
    assert.equal(result.error, "DEPLOYMENT_CUTOVER_UNQUALIFIED_DASHBOARD_START_REFUSED");
    assert.equal(result.mutations, 0); assert.equal(result.creates, 0);
    assert.equal(result.listens, 0); assert.equal(result.spawns, 0);
    assert.equal(result.pidLookups, 0); assert.equal(result.unlinks, 0);
  });
}
test("swallowed observer reentry cannot revive dashboard admission", () => {
  const result = run("assert", "reentry");
  assert.equal(result.error, "DEPLOYMENT_CUTOVER_UNQUALIFIED_DASHBOARD_START_REFUSED");
  assert.equal(result.mutations, 0); assert.equal(result.creates, 0);
});
test("absent ordinary dashboard still reaches its existing server/listener ports", () => {
  const result = run("dashboard", "absent");
  assert.equal(result.error, undefined); assert.equal(result.creates, 1); assert.equal(result.listens, 1);
});
test("late OPEN refuses subsequent listener but does not claim undo of earlier mocked PID-write port", () => {
  const result = run("daemon", "late-open");
  assert.equal(result.error, "DEPLOYMENT_CUTOVER_UNQUALIFIED_DASHBOARD_START_REFUSED");
  assert.equal(result.mutations, 1); assert.equal(result.creates, 0); assert.equal(result.listens, 0);
});
for (const entry of ["cli-start", "cli-implicit", "cli-legacy", "cli-auto"]) {
  test(`CLI source ${entry} refuses before running-status fast path`, () => {
    const result = run(entry);
    assert.equal(result.error, "DEPLOYMENT_CUTOVER_UNQUALIFIED_DASHBOARD_START_REFUSED");
    assert.equal(result.pidLookups, 0); assert.equal(result.spawns, 0);
  });
}
