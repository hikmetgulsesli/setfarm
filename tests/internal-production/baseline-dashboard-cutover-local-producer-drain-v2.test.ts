import assert from "node:assert/strict";
import fs from "node:fs";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { test } from "node:test";

const importIndex = process.execArgv.indexOf("--import");
const loader = importIndex >= 0 ? process.execArgv[importIndex + 1]! : createRequire(import.meta.url).resolve("tsx");
const ts = createRequire(loader)("typescript") as typeof import("typescript");
const source = new URL("../../src/internal-production/baseline-dashboard-cutover-local-producer-drain-v2.ts", import.meta.url).href;
const refused = "DASHBOARD_CUTOVER_LOCAL_PRODUCER_DRAIN_REFUSED";

// Each case gets the genuine module's original one-lifetime state. No resets,
// cancellations or effectful provider fixtures; test children exit naturally.
async function exercise(body: string): Promise<void> {
  const program = `import assert from 'node:assert/strict';
const out={};try{const m=await import(${JSON.stringify(source)});
const sync=m.withDashboardCutoverLocalProducerSyncV2,async=m.withDashboardCutoverLocalProducerAsyncV2,
acquire=m.acquireDashboardCutoverLocalProducerDrainV2,check=m.assertDashboardCutoverLocalProducerDrainV2;
for(const fn of [sync,async,acquire,check])assert.equal(typeof fn,'function');
const refused=${JSON.stringify(refused)},tick=()=>new Promise(r=>setImmediate(r));
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b});return{promise,resolve,reject}};
${body}
out.passed=true}catch(e){out.error=e.message??String(e)}process.stdout.write(JSON.stringify(out));`;
  const child = spawn(process.execPath, ["--import", loader, "--input-type=module", "-e", program],
    { cwd: "/", env: {}, stdio: ["ignore", "pipe", "pipe"] });
  let stdout = "", stderr = "", unknown: Error | undefined, bytes = 0;
  const eof = { stdout: false, stderr: false };
  child.on("error", error => { unknown ??= error; });
  for (const [stream, name] of [[child.stdout, "stdout"], [child.stderr, "stderr"]] as const) {
    stream.on("error", error => { unknown ??= error; });
    stream.on("end", () => { eof[name] = true; });
    stream.on("data", (chunk: Buffer) => {
      bytes += chunk.length;
      if (bytes > 1048576) { unknown ??= Error("CAPTURE_UNKNOWN"); return; }
      if (name === "stdout") stdout += chunk; else stderr += chunk;
    });
  }
  const [status, signal] = await new Promise<[number | null, NodeJS.Signals | null]>(resolve =>
    child.on("close", (code, sig) => resolve([code, sig])));
  assert.equal(unknown, undefined);
  assert.equal(signal, null);
  assert.equal(status, 0, stderr);
  assert.deepEqual(eof, { stdout: true, stderr: true });
  assert.equal(stderr, "");
  const out = JSON.parse(stdout);
  assert.equal(out.error, undefined, out.error);
  assert.equal(out.passed, true);
}

test("original suspended invocation and nested sync work finish before local handle", async () => {
  await exercise(`const gate=deferred(),events=[];let held=false;
const original=async('medic-install',async()=>{events.push('entered');await gate.promise;
sync('atomic-configuration-write',()=>events.push('nested'));events.push('returned');return 17});
const pending=acquire().then(h=>{held=true;events.push('held');return h});events.push('sealed');
await tick();assert.equal(held,false);gate.resolve();assert.equal(await original,17);
const h=await pending;check(h);assert.deepEqual(events,['entered','sealed','nested','returned','held']);
assert.equal(Object.getPrototypeOf(h),null);assert.equal(Object.isFrozen(h),true);assert.deepEqual(Reflect.ownKeys(h),[]);`);
});

test("closed local admission denies new roots before caller body effects", async () => {
  await exercise(`const gate=deferred();const original=async('medic-install',async()=>gate.promise);
const pending=acquire();let effects=0;assert.throws(()=>sync('workspace-cleanup',()=>effects++),{message:refused});
await assert.rejects(async('workflow-uninstall',async()=>{effects++}),{message:refused});assert.equal(effects,0);
gate.resolve();await original;check(await pending);
assert.throws(()=>sync('workspace-cleanup',()=>effects++),{message:refused});assert.equal(effects,0);`);
});

test("registered detached descendant remains held after original parent return", async () => {
  await exercise(`const gate=deferred();let descendant,held=false;
await async('medic-install',async()=>{descendant=async('configuration-write',async()=>{await gate.promise;
sync('atomic-configuration-write',()=>{});return 23});return 11});
const pending=acquire().then(h=>{held=true;return h});await tick();assert.equal(held,false);
gate.resolve();assert.equal(await descendant,23);check(await pending);`);
});

test("unregistered queued continuation under ended ancestry cannot enter after sealing", async () => {
  await exercise(`const gate=deferred();let late;let effects=0;
await async('medic-install',async()=>{late=gate.promise.then(()=>sync('configuration-write',()=>effects++))});
check(await acquire());gate.resolve();await assert.rejects(late,{message:refused});assert.equal(effects,0);`);
});

test("delayed ended ancestry remains a fresh ordinary root while admission is open", async () => {
  await exercise(`const gate=deferred();let late;let effects=0;
await async('medic-install',async()=>{late=gate.promise.then(()=>sync('configuration-write',()=>effects++))});
gate.resolve();await late;assert.equal(effects,1);check(await acquire());`);
});

test("self-drain refuses without deadlock or consuming outside acquisition", async () => {
  await exercise(`await async('medic-install',async()=>{await assert.rejects(acquire(),{message:refused});
sync('configuration-write',()=>{})});check(await acquire());`);
});

test("known original rejection terminates invocation but does not stand for effect settlement", async () => {
  await exercise(`const gate=deferred(),business=Error('BUSINESS_FAILURE');
const original=async('workflow-uninstall',async()=>{await gate.promise;throw business});
const observed=assert.rejects(original,e=>e===business);let held=false;
const pending=acquire().then(h=>{held=true;return h});await tick();assert.equal(held,false);
gate.resolve();await observed;check(await pending);`);
});

test("synchronous business throw preserves identity and accounts for body termination", async () => {
  await exercise(`const business=Error('SYNC_BUSINESS_FAILURE');
assert.throws(()=>sync('workspace-cleanup',()=>{throw business}),e=>e===business);check(await acquire());`);
});

test("async non-native return burns without observing a caller thenable", async () => {
  await exercise(`let traps=0;const thenable={get then(){traps++;throw Error('THENABLE_TRAP')}};
await assert.rejects(async('medic-install',()=>thenable),{message:refused});
assert.equal(traps,0);await assert.rejects(acquire(),{message:refused});`);
});

test("native constructor metadata uncertainty cannot release unsettled original custody", async () => {
  await exercise(`const gate=deferred();Object.defineProperty(gate.promise,'constructor',{get(){throw Error('CONSTRUCTOR_UNKNOWN')}});
const original=async('medic-install',()=>gate.promise);let failure;
try{await original}catch(e){failure=e}assert.ok(failure);await assert.rejects(acquire(),{message:refused});
assert.equal(failure.message,refused);gate.resolve();`);
});

test("spoofed native then cannot publish handle before original internal settlement", async () => {
  await exercise(`const gate=deferred();let traps=0,held=false;
Object.defineProperty(gate.promise,'constructor',{value:{}});gate.promise.then=resolve=>{traps++;resolve('FORGED')};
const original=async('medic-install',()=>gate.promise),pending=acquire().then(h=>{held=true;return h});
await tick();assert.equal(held,false);assert.equal(traps,0);gate.resolve(31);
assert.equal(await original,31);check(await pending);`);
});

test("mistaken sync native observer uncertainty keeps fixed refusal and burned custody", async () => {
  await exercise(`const gate=deferred();Object.defineProperty(gate.promise,'constructor',{get(){throw Error('CONSTRUCTOR_UNKNOWN')}});
assert.throws(()=>sync('configuration-write',()=>gate.promise),{message:refused});
await assert.rejects(acquire(),{message:refused});gate.resolve();`);
});

test("known descendant burn wakes original pending drain without releasing unknown custody", async () => {
  await exercise(`const first=deferred(),unknown=deferred();let refusal,held=false;
const parent=async('medic-install',async()=>{await first.promise;
assert.throws(()=>sync('configuration-write',()=>unknown.promise),{message:refused});});
const pending=acquire().then(()=>{held=true},e=>{refusal=e});first.resolve();await parent;await tick();
assert.equal(held,false);assert.equal(refusal?.message,refused);await pending;unknown.resolve();
await tick();assert.throws(()=>sync('configuration-write',()=>{}),{message:refused});`);
});

test("invalid idle arity and foreign handles cannot invoke caller traps or close admission", async () => {
  await exercise(`let traps=0;const hostile=new Proxy({}, {get(){traps++;throw Error('TRAP')},getPrototypeOf(){traps++;throw Error('TRAP')}});
await assert.rejects(acquire(hostile),{message:refused});assert.throws(()=>check(hostile),{message:refused});
assert.throws(()=>sync(hostile,()=>{}),{message:refused});sync('configuration-write',()=>{});
const h=await acquire();for(const fake of [{},Object.freeze(Object.create(null)),new Proxy(h,{get(){traps++}})]){
assert.throws(()=>check(fake),{message:refused})}assert.throws(()=>check(h,hostile),{message:refused});check(h);assert.equal(traps,0);`);
});

test("second acquisition burns pending generation even when refusal is swallowed", async () => {
  await exercise(`const gate=deferred();const original=async('medic-install',async()=>gate.promise);
const pending=acquire();const observed=assert.rejects(pending,{message:refused});
await assert.rejects(acquire(),{message:refused});gate.resolve();await original;await observed;
let effects=0;assert.throws(()=>sync('configuration-write',()=>effects++),{message:refused});assert.equal(effects,0);`);
});

test("second acquisition also invalidates the original already-held handle", async () => {
  await exercise(`const h=await acquire();check(h);await assert.rejects(acquire(),{message:refused});
assert.throws(()=>check(h),{message:refused});`);
});

test("separate ESM instance never accepts another instance original local handle", async () => {
  await exercise(`const h=await acquire(),other=await import(${JSON.stringify(source + "?independent-local-instance")});
const foreign=await other.acquireDashboardCutoverLocalProducerDrainV2();other.assertDashboardCutoverLocalProducerDrainV2(foreign);
assert.throws(()=>other.assertDashboardCutoverLocalProducerDrainV2(h),{message:refused});
assert.throws(()=>check(foreign),{message:refused});check(h);`);
});

test("sync body returning native promise burns instead of prematurely declaring drain", async () => {
  await exercise(`const gate=deferred();assert.throws(()=>sync('configuration-write',()=>gate.promise),{message:refused});
await assert.rejects(acquire(),{message:refused});gate.resolve();`);
});

test("mistaken sync promise original rejection stays observed after permanent burn", async () => {
  await exercise(`const gate=deferred(),unhandled=[];process.on('unhandledRejection',e=>unhandled.push(e));
assert.throws(()=>sync('configuration-write',()=>gate.promise),{message:refused});
gate.reject(Error('ORIGINAL_REJECTION'));await tick();await tick();assert.deepEqual(unhandled,[]);
await assert.rejects(acquire(),{message:refused});`);
});

const consumers = [
  ["../../src/installer/openclaw-config.ts", "writeOpenClawConfig", "writer( hostile,hostile )"],
  ["../../src/installer/config-schema.ts", "atomicWriteSync", "writer( hostile,hostile )"],
  ["../../src/medic/medic-cron.ts", "installMedicCron", "writer()"],
  ["../../src/medic/medic-cron.ts", "uninstallMedicCron", "writer()"],
  ["../../src/installer/uninstall.ts", "uninstallWorkflow", "writer(hostile)"],
  ["../../src/installer/uninstall.ts", "uninstallAllWorkflows", "writer()"],
  ["../../src/installer/worktree-ops.ts", "cleanAgentWorkspace", "writer(hostile)"],
] as const;

function factory(relative: string, name: string): string {
  const file = new URL(relative, import.meta.url);
  const parsed = ts.createSourceFile(file.pathname, fs.readFileSync(file, "utf8"), ts.ScriptTarget.ES2022, true);
  const selected = parsed.statements.filter(node => ts.isFunctionDeclaration(node) && node.name?.text === name);
  assert.equal(selected.length, 1);
  const compiled = ts.transpileModule(selected[0].getText(parsed), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
    transformers: { before: [context => root => {
      const visit = (node: import("typescript").Node): import("typescript").VisitResult<import("typescript").Node> =>
        ts.isMetaProperty(node) ? ts.factory.createIdentifier("importMeta") : ts.visitEachChild(node, visit, context);
      return ts.visitNode(root, visit) as import("typescript").SourceFile;
    }] },
  }).outputText;
  return `const{withDashboardCutoverLocalProducerSyncV2,withDashboardCutoverLocalProducerAsyncV2,
assertOrdinaryConfigurationDeploymentCutoverAdmissionV2,validateConfig,atomicWriteSync,fs,path,logger,
removeLegacyMedicCronJob,removeMedicAgent,installSystemdMedicTimer,uninstallSystemdMedicTimer,
resolveWorkflowDir,resolveWorkflowWorkspaceDir,readOpenClawConfig,getAgentWorkspacePath}=env;
const importMeta={dirname:'/unused-qualified-entry'};const exports={};
return(function(){${compiled};return exports[${JSON.stringify(name)}]})();`;
}

for (const [relative, name, invocation] of consumers) {
  test(`actual ${name} refuses held local admission before first body observation`, async () => {
    const body = factory(relative, name);
    await exercise(`check(await acquire());let effects=0,traps=0;
const effect=()=>{effects++;throw Error('BODY_EFFECT')};
const hostile=new Proxy({}, {get(){traps++;throw Error('CALLER_TRAP')}});
const writer=new Function('env',${JSON.stringify(body)})({
withDashboardCutoverLocalProducerSyncV2:sync,withDashboardCutoverLocalProducerAsyncV2:async,
assertOrdinaryConfigurationDeploymentCutoverAdmissionV2:effect,validateConfig:effect,atomicWriteSync:effect,
fs:{writeFileSync:effect},path:{dirname:effect},logger:{warn:effect},removeLegacyMedicCronJob:effect,
removeMedicAgent:effect,installSystemdMedicTimer:effect,uninstallSystemdMedicTimer:effect,
resolveWorkflowDir:effect,resolveWorkflowWorkspaceDir:effect,readOpenClawConfig:effect,getAgentWorkspacePath:effect});
try{await ${invocation};assert.fail('EXPECTED_LOCAL_REFUSAL')}catch(e){assert.equal(e.message,refused)}
assert.equal(effects,0);assert.equal(traps,0);`);
  });
}

test("actual Medic body retains both first-await and original returned timer promise", async () => {
  const body = factory("../../src/medic/medic-cron.ts", "installMedicCron");
  await exercise(`const first=deferred(),timer=deferred(),events=[];let held=false;
const writer=new Function('env',${JSON.stringify(body)})({withDashboardCutoverLocalProducerSyncV2:sync,
withDashboardCutoverLocalProducerAsyncV2:async,assertOrdinaryConfigurationDeploymentCutoverAdmissionV2:()=>{},
removeLegacyMedicCronJob:async()=>{events.push('legacy');await first.promise;return{ok:true}},
removeMedicAgent:async()=>{sync('configuration-write',()=>events.push('config'))},
installSystemdMedicTimer:()=>{events.push('timer');return timer.promise}});
const original=writer(),pending=acquire().then(h=>{held=true;events.push('held');return h});
await tick();assert.equal(held,false);first.resolve();await tick();assert.equal(held,false);
assert.deepEqual(events,['legacy','config','timer']);timer.resolve({ok:true});assert.deepEqual(await original,{ok:true});
check(await pending);assert.deepEqual(events,['legacy','config','timer','held']);`);
});
