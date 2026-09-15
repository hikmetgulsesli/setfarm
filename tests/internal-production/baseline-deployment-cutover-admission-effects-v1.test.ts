import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import ts from "typescript";

const source = fs.readFileSync(new URL("../../src/spawner.ts", import.meta.url), "utf8");
const tree = ts.createSourceFile("spawner.ts", source, ts.ScriptTarget.Latest, true);
const functions = ["claimInternalProductionBaselineSpawnerStartupAdmissionV1", "awaitInternalProductionBaselineSpawnerRestartAuthorityV1", "task12ExactInputV1", "task12CanonicalV1", "task12HashV1"].map(name => {
  const node = tree.statements.find(item => ts.isFunctionDeclaration(item) && item.name?.text === name);
  assert.ok(node, name); return node.getText(tree);
}).join("\n");
const variables = ["task12StartupAdmissionCapabilitiesV1", "TASK12_STARTUP_ADMISSION_ROOT_V1", "TASK12_STARTUP_ADMISSION_PREFIX_V1", "TASK12_SHA256_V1"].map(name => {
  const node = tree.statements.find(item => ts.isVariableStatement(item) && item.declarationList.declarations.some(declaration => ts.isIdentifier(declaration.name) && declaration.name.text === name));
  assert.ok(node, name); return node.getText(tree);
}).join("\n");
const cutoverUrl = new URL("../../src/internal-production/baseline-deployment-cutover-v1.ts", import.meta.url).href;
const recordsUrl = new URL("../../src/internal-production/baseline-deployment-cutover-records-v1.ts", import.meta.url).href;
const workspaceUrl = new URL("../../src/internal-production/baseline-workspace-authority-path-v1.ts", import.meta.url).href;

for (const mode of ["claim-absent", "claim-open", "claim-late", "claim-clone", "claim-extra", "claim-crossed-capability", "bootstrap-absent", "bootstrap-open", "bootstrap-late", "bootstrap-clone", "bootstrap-extra"]) {
  test(`${mode} preserves the ordinary admission effect boundary`, () => {
    const home = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "cutover-admission-effect-")));
    try {
      fs.mkdirSync(path.join(home, "ai/setrox"), { recursive: true, mode: 0o700 });
      const internal = path.join(home, "internal-production"); fs.mkdirSync(internal);
      fs.writeFileSync(path.join(home, "package.json"), '{"type":"module"}');
      fs.writeFileSync(path.join(internal, "baseline-post-handoff-receipt-v1.js"), `
export async function observeInternalProductionServiceCensusV1(){await Promise.resolve();if(globalThis.fixtureMode==='claim-late')globalThis.publishCutover();const a=globalThis.fixtureAdmission;return {spawner:{pid:process.pid,loadedSourceSha:a.expectedSetfarmSha,loadedBuildHash:a.expectedSpawnerBuildHash,processIdentityHash:'7'.repeat(64),processStartTimeEpochMs:1234}};}
`);
      fs.writeFileSync(path.join(internal, "baseline-service-restart-sequence-v1.js"), `
if(globalThis.fixtureMode==='bootstrap-late')globalThis.publishCutover();
export async function executeOrRecoverInternalProductionBaselineSpawnerBootstrapRestartV1(){globalThis.fixtureDispatches++;throw Error('FIXTURE_BOOTSTRAP_DISPATCH_REACHED');}
`);
      const runner = path.join(home, "runner.mjs");
      fs.writeFileSync(runner, ts.transpileModule(`
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import crypto from 'node:crypto';import {syncBuiltinESMExports} from 'node:module';
const identity=os.userInfo();os.userInfo=()=>({...identity,homedir:${JSON.stringify(home)}});syncBuiltinESMExports();
const {assertOrdinarySpawnerDeploymentCutoverAdmissionV1}=await import(${JSON.stringify(cutoverUrl)});
const {createDeploymentCutoverIntentV1,encodeDeploymentCutoverIntentV1}=await import(${JSON.stringify(recordsUrl)});
const {resolveInternalProductionBaselineAuthorityPathV1}=await import(${JSON.stringify(workspaceUrl)});
${variables}
${functions}
const mode=globalThis.fixtureMode=${JSON.stringify(mode)};let writes=0,resolutions=0;globalThis.fixtureDispatches=0;
const hash='a'.repeat(64),prefix='setfarm://internal-production/fixture/sha256/';
const admission=globalThis.fixtureAdmission=Object.freeze({kind:'authenticated-internal-production-baseline-spawner-startup-admission',admissionMode:'ordinary-manifest-backed',service:'setfarm-spawner',actionId:'a-restart-service-setfarm-spawner-v1',operationId:hash,bootstrapOperationRef:prefix+hash,bootstrapOperationHash:hash,restartLaunchOutboxHash:hash,expectedRuntimeSourceProjectionHash:hash,expectedSetfarmSha:'b'.repeat(40),expectedSpawnerBuildHash:'c'.repeat(64),migrationReceiptRef:prefix+hash,migrationReceiptHash:hash,manifestActivationRef:prefix+hash,manifestActivationHash:hash,genericFullVerifyRequired:true,beforeGenerationHash:'d'.repeat(64),admissionHash:hash});
task12StartupAdmissionCapabilitiesV1.set(admission,{startupAdmissionRef:TASK12_STARTUP_ADMISSION_PREFIX_V1+hash,startupAdmissionHash:mode==='claim-crossed-capability'?'e'.repeat(64):hash,operationRef:prefix+hash,operationHash:hash});
async function resolveInternalProductionBaselineSpawnerStartupAdmissionV1(){resolutions++;await Promise.resolve();return admission;}
async function resolveInternalProductionBaselineSpawnerStartupClaimV1(){return {schema:'setfarm.internal-production-baseline-spawner-startup-claim.v1',startupAdmissionRef:TASK12_STARTUP_ADMISSION_PREFIX_V1+hash,startupAdmissionHash:hash,operationId:hash,currentGenerationHash:'7'.repeat(64),pid:process.pid,processStartTimeEpochMs:1234,processIdentityHash:'7'.repeat(64),startupClaimHash:hash};}
function task12WriteNoReplaceV1(target,body){writes++;fs.mkdirSync(path.dirname(target),{recursive:true,mode:0o700});fs.writeFileSync(target,JSON.stringify(body),{mode:0o600,flag:'wx'});}
const root=resolveInternalProductionBaselineAuthorityPathV1('data/internal-production-baseline/deployment-cutover-v1'),intentPath=path.join(root,'intent.json');let intentBytes,originalInode;
globalThis.publishCutover=()=>{
 intentBytes=encodeDeploymentCutoverIntentV1(createDeploymentCutoverIntentV1({oldDeployment:{checkoutPath:'/fixture/old',checkoutDirectoryIdentityHash:hash,sourceSha:'b'.repeat(40),sourceTreeHash:'c'.repeat(40),buildHash:hash},newDeployment:{checkoutPath:'/fixture/new',checkoutDirectoryIdentityHash:hash,sourceSha:'b'.repeat(40),sourceTreeHash:'c'.repeat(40),buildHash:hash},cliLinkObservationHash:hash,spawnerLauncherConfigurationHash:hash,dashboardLauncherConfigurationHash:hash,maintenanceIntentHash:hash,dashboardPort:3333}));
 fs.mkdirSync(root,{recursive:true,mode:0o700});fs.writeFileSync(intentPath,intentBytes,{mode:0o600,flag:'wx'});originalInode=fs.lstatSync(intentPath).ino;
};
const input={admission:mode.endsWith('-clone')?{...admission}:admission};if(mode.startsWith('bootstrap'))input.startupClaimHash=hash;if(mode.endsWith('-extra'))input.extra=true;
if(mode.endsWith('-open'))globalThis.publishCutover();
let error=null;try{if(mode.startsWith('claim'))await claimInternalProductionBaselineSpawnerStartupAdmissionV1(input);else await awaitInternalProductionBaselineSpawnerRestartAuthorityV1(input);}catch(cause){error=cause.message;}
process.stdout.write(JSON.stringify({error,writes,resolutions,dispatches:globalThis.fixtureDispatches,preserved:intentBytes?fs.readFileSync(intentPath).equals(intentBytes)&&fs.lstatSync(intentPath).ino===originalInode:null}));
`, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText);
      const child = spawnSync(process.execPath, ["--import", import.meta.resolve("tsx"), runner], { encoding: "utf8", timeout: 15000, env: {} });
      assert.equal(child.status, 0, child.stderr);
      const result = JSON.parse(child.stdout);
      if (mode.endsWith("-late") || mode.endsWith("-open")) {
        assert.equal(result.error, "DEPLOYMENT_CUTOVER_ORDINARY_START_REFUSED");
        assert.equal(result.preserved, true);
        assert.equal(result.writes, 0); assert.equal(result.dispatches, 0);
        if (mode.endsWith("-open")) assert.equal(result.resolutions, 0);
      } else if (mode === "claim-absent") {
        assert.equal(result.error, null); assert.equal(result.writes, 1); assert.equal(result.dispatches, 0);
      } else if (mode === "bootstrap-absent") {
        assert.equal(result.error, "FIXTURE_BOOTSTRAP_DISPATCH_REACHED");
        assert.equal(result.writes, 0); assert.equal(result.dispatches, 1);
      } else {
        assert.match(result.error, /CAPABILITY_INVALID/);
        assert.equal(result.writes, 0); assert.equal(result.dispatches, 0); assert.equal(result.resolutions, 0);
      }
    } finally { fs.rmSync(home, { recursive: true, force: true }); }
  });
}
