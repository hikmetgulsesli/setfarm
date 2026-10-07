import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { test } from "node:test";

const importIndex = process.execArgv.indexOf("--import");
const loader = importIndex >= 0 ? process.execArgv[importIndex + 1]! : createRequire(import.meta.url).resolve("tsx");
const ts = createRequire(loader)("typescript") as typeof import("typescript");
const source = new URL("../../src/internal-production/baseline-dashboard-cutover-configuration-refusal-v2.ts", import.meta.url).href;
const observer = new URL("../../src/internal-production/baseline-deployment-cutover-v1.ts", import.meta.url).href;
const records = new URL("../../src/internal-production/baseline-deployment-cutover-records-v1.ts", import.meta.url).href;
const refusal = "DASHBOARD_CUTOVER_ORDINARY_CONFIGURATION_REFUSED";

function body(relative: string, name: string): string {
  const file = new URL(relative, import.meta.url);
  const parsed = ts.createSourceFile(file.pathname, fs.readFileSync(file, "utf8"), ts.ScriptTarget.ES2022, true);
  const selected = parsed.statements.filter(node => ts.isFunctionDeclaration(node) && node.name?.text === name);
  assert.equal(selected.length, 1);
  const compiled = ts.transpileModule(selected[0].getText(parsed), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText;
  return `const {fs,path,validateConfig,logValidationErrors,logger,atomicWriteSync,
assertOrdinaryConfigurationDeploymentCutoverAdmissionV2,removeLegacyMedicCronJob,removeMedicAgent,
installSystemdMedicTimer,uninstallSystemdMedicTimer}=env;const exports={};return(function(){${compiled};return exports[${JSON.stringify(name)}]})();`;
}
const factories = {
  writer: body("../../src/installer/openclaw-config.ts", "writeOpenClawConfig"),
  atomic: body("../../src/installer/config-schema.ts", "atomicWriteSync"),
  install: body("../../src/medic/medic-cron.ts", "installMedicCron"),
  uninstall: body("../../src/medic/medic-cron.ts", "uninstallMedicCron"),
};

async function fixture(mode: string, action: string): Promise<any> {
  const home = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-config-refusal-v2-")));
  const program = `import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import{syncBuiltinESMExports}from'node:module';
const home=${JSON.stringify(home)},account=os.userInfo();os.userInfo=()=>({...account,homedir:home});os.homedir=()=>home;syncBuiltinESMExports();
const workspace=path.join(home,'ai/setrox');fs.mkdirSync(workspace,{recursive:true,mode:0o700});
const target=path.join(workspace,'data/internal-production-baseline/deployment-cutover-v1');
const records=await import(${JSON.stringify(records)});
const publish=()=>{const hash='a'.repeat(64),sha='b'.repeat(40),deployment={checkoutPath:'/fixture/source',checkoutDirectoryIdentityHash:hash,sourceSha:sha,sourceTreeHash:'c'.repeat(40),buildHash:hash};
const wire=records.encodeDeploymentCutoverIntentV1(records.createDeploymentCutoverIntentV1({oldDeployment:deployment,newDeployment:{...deployment,checkoutPath:'/fixture/new-source'},cliLinkObservationHash:hash,spawnerLauncherConfigurationHash:hash,dashboardLauncherConfigurationHash:hash,maintenanceIntentHash:hash,dashboardPort:3333}));
fs.mkdirSync(target,{recursive:true,mode:0o700});fs.writeFileSync(path.join(target,'intent.json'),wire,{mode:0o600,flag:'wx'});};
if(${JSON.stringify(mode)}==='open')publish();if(${JSON.stringify(mode)}==='unknown'){fs.mkdirSync(target,{recursive:true,mode:0o700});fs.writeFileSync(path.join(target,'unexpected'),'private-unknown')}
const out={effects:[],traps:0};const effect=name=>()=>{out.effects.push(name);throw Error('OWNED_EFFECT')};
let ports=0;const lstat=fs.lstatSync;fs.lstatSync=(...args)=>{ports++;return lstat(...args)};syncBuiltinESMExports();
try{const m=await import(${JSON.stringify(source)});const guard=m.assertOrdinaryConfigurationDeploymentCutoverAdmissionV2;
const bind=(factory,env)=>new Function('env',factory)({path,assertOrdinaryConfigurationDeploymentCutoverAdmissionV2:guard,...env});
const base={fs:{writeFileSync:effect('write'),renameSync:effect('rename')},validateConfig:effect('validate'),logValidationErrors:effect('log-errors'),logger:{warn:effect('warn')},atomicWriteSync:effect('atomic'),
removeLegacyMedicCronJob:effect('legacy-cron'),removeMedicAgent:effect('agent-config'),installSystemdMedicTimer:effect('install-timer'),uninstallSystemdMedicTimer:effect('uninstall-timer')};
${action}
}catch(e){out.error=e.message}
process.stdout.write(JSON.stringify(out));`;
  const child = spawn(process.execPath, ["--import", loader, "--input-type=module", "-e", program],
    { cwd: "/", env: {}, stdio: ["ignore", "pipe", "pipe"] });
  let stdout = "", stderr = "", unknown: Error | undefined, bytes = 0;
  const eof = { stdout: false, stderr: false };
  child.on("error", error => { unknown ??= error; });
  for (const [stream, name] of [[child.stdout, "stdout"], [child.stderr, "stderr"]] as const) {
    stream.on("error", error => { unknown ??= error; });
    stream.on("end", () => { eof[name] = true; });
    stream.on("data", (chunk: Buffer) => {
      bytes += chunk.length; if (bytes > 1048576) { unknown ??= Error("CAPTURE_UNKNOWN"); return; }
      if (name === "stdout") stdout += chunk; else stderr += chunk;
    });
  }
  const [status, signal] = await new Promise<[number | null, NodeJS.Signals | null]>(resolve => child.on("close", (code, sig) => resolve([code, sig])));
  assert.equal(unknown, undefined); assert.equal(signal, null); assert.equal(status, 0, stderr);
  assert.deepEqual(eof, { stdout: true, stderr: true }); assert.equal(stderr, "");
  return JSON.parse(stdout); // Preserve every private path; no process signals.
}

for (const mode of ["open", "unknown"]) {
  test(`${mode} configuration assertion permanently refuses without replacement observation`, async () => {
    const out = await fixture(mode, `try{guard()}catch(e){out.first=e.message}fs.renameSync(target,target+'-original');const before=ports;
try{guard()}catch(e){out.second=e.message}out.ports=ports-before;`);
    assert.equal(out.error, undefined, JSON.stringify(out)); assert.equal(out.first, refusal); assert.equal(out.second, refusal); assert.equal(out.ports, 0);
  });
}
test("known absent preserves repeated ordinary configuration assertions", async () => {
  const out = await fixture("absent", "guard();guard();out.returned=true;");
  assert.equal(out.error, undefined, JSON.stringify(out)); assert.equal(out.returned, true);
});
test("invalid idle arity touches no observation or caller traps and leaves valid assertion available", async () => {
  const out = await fixture("absent", `const proxy=new Proxy({},{get(){out.traps++;throw Error('TRAP')}}),before=ports;
try{guard(proxy)}catch(e){out.first=e.message}out.ports=ports-before;guard();out.returned=true;`);
  assert.equal(out.error, undefined, JSON.stringify(out)); assert.equal(out.first, refusal); assert.equal(out.ports, 0); assert.equal(out.traps, 0); assert.equal(out.returned, true);
});
test("swallowed observer reentry burns the original assertion before return", async () => {
  const out = await fixture("absent", `let nested=false;fs.lstatSync=(...args)=>{ports++;if(!nested){nested=true;try{guard()}catch(e){out.nested=e.message}}return lstat(...args)};syncBuiltinESMExports();
try{guard()}catch(e){out.first=e.message}const before=ports;try{guard()}catch(e){out.second=e.message}out.ports=ports-before;`);
  assert.equal(out.error, undefined, JSON.stringify(out)); assert.equal(out.first, refusal); assert.equal(out.nested, refusal); assert.equal(out.second, refusal); assert.equal(out.ports, 0);
});

for (const [kind, factory] of Object.entries(factories)) {
  for (const mode of ["open", "unknown", "absent"]) {
    test(`${kind} actual consumer ${mode} reaches only the allowed first boundary`, async () => {
      const out = await fixture(mode, `const fn=bind(${JSON.stringify(factory)},base),proxy=new Proxy({},{get(){out.traps++;throw Error('TRAP')}});
try{await fn(path.join(home,'owned-config.json'),proxy)}catch(e){out.refused=e.message}`);
      assert.equal(out.error, undefined, JSON.stringify(out));
      assert.equal(out.refused, mode === "absent" ? "OWNED_EFFECT" : refusal);
      assert.deepEqual(out.effects, mode === "absent" ? [kind === "writer" ? "validate" : kind === "atomic" ? "write" : "legacy-cron"] : []);
      assert.equal(out.traps, 0);
    });
  }
}
test("serialization publishing OPEN cannot use earlier absent writer observation for atomic mutation", async () => {
  const out = await fixture("absent", `const atomic=bind(${JSON.stringify(factories.atomic)},base);
const writer=bind(${JSON.stringify(factories.writer)},{...base,validateConfig:()=>[],atomicWriteSync:atomic});
const config={toJSON(){out.serialized=(out.serialized??0)+1;publish();return{agents:{list:[]}}}};
try{await writer(path.join(home,'owned-config.json'),config)}catch(e){out.refused=e.message}`);
  assert.equal(out.error, undefined, JSON.stringify(out)); assert.equal(out.refused, refusal); assert.equal(out.serialized, 1); assert.deepEqual(out.effects, []);
});
for (const kind of ["install", "uninstall"] as const) {
  for (const after of ["legacy", "config"]) {
    test(`${kind} refuses timer/config continuation when OPEN appears after ${after} await`, async () => {
      const out = await fixture("absent", `const env={...base,removeLegacyMedicCronJob:async()=>{out.effects.push('legacy-entered');${after === "legacy" ? "publish();" : ""}return{ok:true}},
removeMedicAgent:async()=>{out.effects.push('config-entered');${after === "legacy" ? "throw Error('OWNED_EFFECT');" : "publish();try{guard()}catch(e){out.swallowed=e.message}"}}};
try{await bind(${JSON.stringify(factories[kind])},env)()}catch(e){out.refused=e.message}`);
      assert.equal(out.error, undefined, JSON.stringify(out)); assert.equal(out.refused, refusal);
      assert.deepEqual(out.effects, after === "legacy" ? ["legacy-entered"] : ["legacy-entered", "config-entered"]);
      if (after === "config") assert.equal(out.swallowed, refusal);
    });
  }
}
