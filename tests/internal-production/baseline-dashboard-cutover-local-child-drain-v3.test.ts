import assert from "node:assert/strict";
import fs from "node:fs";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { test } from "node:test";

const importIndex = process.execArgv.indexOf("--import");
const loader = importIndex >= 0 ? process.execArgv[importIndex + 1]! : createRequire(import.meta.url).resolve("tsx");
const source = new URL("../../src/internal-production/baseline-dashboard-cutover-local-producer-drain-v2.ts", import.meta.url).href;

// Fresh genuine module lifetime per case, bounded one-shot children only.
// Actual missing exports fail BEFORE dispatching any nested qualification child.
async function exercise(body: string, setup = ""): Promise<void> {
  const directory = fs.mkdtempSync("/private/tmp/setfarm-local-child-v3-");
  fs.chmodSync(directory, 0o700);
  const program = `import assert from 'node:assert/strict';
import cp from 'node:child_process';import {syncBuiltinESMExports} from 'node:module';
const out={};try{
${setup}
const m=await import(${JSON.stringify(source)});
const call=m.execFileDashboardCutoverLocalChildV3,run=m.execFileDashboardCutoverLocalChildAsyncV3,
acquireChild=m.acquireDashboardCutoverLocalChildDrainV3,checkChild=m.assertDashboardCutoverLocalChildDrainV3;
for(const [name,fn] of Object.entries({call,run,acquireChild,checkChild}))
 assert.equal(typeof fn,'function','missing source-owned child interface '+name);
const enter=m.withDashboardCutoverLocalProducerAsyncV2,acquire=m.acquireDashboardCutoverLocalProducerDrainV2,
check=m.assertDashboardCutoverLocalProducerDrainV2,tick=()=>new Promise(r=>setImmediate(r));
const refused='DASHBOARD_CUTOVER_LOCAL_CHILD_DRAIN_REFUSED',jsRefused='DASHBOARD_CUTOVER_LOCAL_PRODUCER_DRAIN_REFUSED';
${body}
out.passed=true}catch(e){out.error=e.message??String(e)}process.stdout.write(JSON.stringify(out));`;
  fs.writeFileSync(directory + "/intent.json", JSON.stringify({ program, loader }), { flag: "wx", mode: 0o600 });
  const child = spawn(process.execPath, ["--expose-gc", "--import", loader, "--input-type=module", "-e", program],
    { cwd: directory, env: {}, stdio: ["ignore", "pipe", "pipe"] });
  let stdout = "", stderr = "", bytes = 0, unknown: Error | undefined;
  const ends = { stdout: false, stderr: false }, closes = { stdout: false, stderr: false };
  child.on("error", error => { unknown ??= error; });
  for (const [stream, name] of [[child.stdout, "stdout"], [child.stderr, "stderr"]] as const) {
    stream.on("error", error => { unknown ??= error; });
    stream.on("end", () => { ends[name] = true; });
    stream.on("close", () => { closes[name] = true; });
    stream.on("data", (chunk: Buffer) => {
      bytes += chunk.length;
      if (bytes > 1048576) { unknown ??= Error("CAPTURE_UNKNOWN"); return; }
      if (name === "stdout") stdout += chunk; else stderr += chunk;
    });
  }
  const [status, signal] = await new Promise<[number | null, NodeJS.Signals | null]>(resolve =>
    child.on("close", (code, sig) => resolve([code, sig])));
  const result = { stdout, stderr, status, signal, ends, closes, unknown: unknown?.message };
  fs.writeFileSync(directory + "/result.json", JSON.stringify(result), { flag: "wx", mode: 0o600 });
  console.log(JSON.stringify({ directory, status, signal, ends, closes }));
  assert.equal(unknown, undefined); assert.equal(signal, null); assert.equal(status, 0, stderr);
  assert.deepEqual(ends, { stdout: true, stderr: true });
  assert.deepEqual(closes, { stdout: true, stderr: true }); assert.equal(stderr, "");
  const output = JSON.parse(stdout);
  assert.equal(output.error, undefined, output.error); assert.equal(output.passed, true);
  // Preserve all fixture/program/receipt files. No kill, timeout or deletion.
}

test("callback child remains independently retained after its registered JS parent returns", async () => {
  await exercise(`const events=[];let callbackResolve;
const done=new Promise(r=>{callbackResolve=r});
await enter('medic-install',async()=>{call(process.execPath,['-e',
 'process.stdout.write("OUT");process.stderr.write("ERR");setTimeout(()=>{},120)'],
 (error,stdout,stderr)=>{assert.equal(error,null);assert.equal(stdout,'OUT');assert.equal(stderr,'ERR');
 events.push('callback');callbackResolve()});events.push('body-return')});
const js=await acquire();check(js);events.push('js-held');let held=false;
const pending=acquireChild(js).then(h=>{held=true;events.push('child-held');return h});
await tick();assert.equal(held,false);await done;
const h=await pending;checkChild(h);check(js);
assert.deepEqual(events,['body-return','js-held','callback','child-held']);
assert.equal(Object.getPrototypeOf(h),null);assert.ok(Object.isFrozen(h));assert.deepEqual(Reflect.ownKeys(h),[]);
assert.throws(()=>checkChild(js),{message:refused});`);
});

test("builtin promisified nonzero natural exit preserves stderr and rejection while custody terminates", async () => {
  await exercise(`const original=run(process.execPath,['-e',
 'process.stdout.write("FAIL_OUT");process.stderr.write("FAIL_ERR");setTimeout(()=>process.exit(7),70)'],{});
assert.equal(Object.hasOwn(original,'child'),false);
const rejection=assert.rejects(original,e=>e.code===7 && e.stdout==='FAIL_OUT' && e.stderr==='FAIL_ERR');
const js=await acquire(),pending=acquireChild(js);await rejection;const h=await pending;checkChild(h);check(js);`);
});

test("closed admission denies fresh callback and async launch ports before execFile", async () => {
  await exercise(`const js=await acquire();let callbacks=0;
assert.throws(()=>call(process.execPath,['-e',''],()=>{callbacks++}),{message:refused});
await assert.rejects(run(process.execPath,['-e',''],{}),{message:refused});
assert.equal(dispatches,0);assert.equal(callbacks,0);checkChild(await acquireChild(js));check(js);`,
    `let dispatches=0;cp.execFile=()=>{dispatches++;throw Error('UNEXPECTED_EXEC_FILE')};syncBuiltinESMExports();`);
});

test("inert missing child preserves ordinary callback result but burns only child authority", async () => {
  await exercise(`let result;
call('/inert',['arg'],(error,stdout,stderr)=>{result={error,stdout,stderr}});
assert.deepEqual(result,{error:null,stdout:'BUSINESS_OUT',stderr:'BUSINESS_ERR'});
const js=await acquire();check(js);await assert.rejects(acquireChild(js),{message:refused});check(js);`,
    `cp.execFile=(...args)=>{args.at(-1)(null,'BUSINESS_OUT','BUSINESS_ERR');return undefined};syncBuiltinESMExports();`);
});

test("JS prerequisite burn wakes pending child acquisition without waiting for original child closure", async () => {
  await exercise(`let callbackDone=false,resolveDone;const done=new Promise(r=>{resolveDone=r});
call(process.execPath,['-e','setTimeout(()=>{},200)'],()=>{callbackDone=true;resolveDone()});
const js=await acquire();let failure,held=false;
const pending=acquireChild(js).then(()=>{held=true},error=>{failure=error});
await assert.rejects(acquire(),{message:jsRefused});await tick();await tick();
assert.equal(callbackDone,false);assert.equal(held,false);assert.equal(failure?.message,refused);
await pending;await done;assert.throws(()=>check(js),{message:jsRefused});`);
});

test("minted child handle retains and revalidates the original JS prerequisite", async () => {
  await exercise(`const js=await acquire(),child=await acquireChild(js);checkChild(child);
await assert.rejects(acquire(),{message:jsRefused});assert.throws(()=>checkChild(child),{message:refused});`);
});

test("still-live ALS launches its original child while JS admission is closing", async () => {
  await exercise(`let release,done;const gate=new Promise(r=>{release=r}),callback=new Promise(r=>{done=r});
const original=enter('medic-install',async()=>{await gate;
call(process.execPath,['-e','setTimeout(()=>{},60)'],error=>{assert.equal(error,null);done()})});
const jsPending=acquire();release();await original;const js=await jsPending;
checkChild(await acquireChild(js));await callback;check(js);`);
});

test("ended queued ALS child launch refuses before dispatch after JS closure", async () => {
  await exercise(`let release,queued;const gate=new Promise(r=>{release=r});
await enter('medic-install',async()=>{queued=gate.then(()=>assert.throws(
()=>call('/inert',[],()=>{}),{message:refused}))});
const js=await acquire();release();await queued;assert.equal(dispatches,0);checkChild(await acquireChild(js));`,
    `let dispatches=0;cp.execFile=()=>{dispatches++;throw Error('UNEXPECTED_DISPATCH')};syncBuiltinESMExports();`);
});

test("early ordinary callback does not release its still-live original child", async () => {
  await exercise(`let callback=false;call('/inert',[],()=>{callback=true});assert.equal(callback,true);
const js=await acquire();let held=false;const pending=acquireChild(js).then(h=>{held=true;return h});
await tick();assert.equal(held,false);checkChild(await pending);check(js);`,
    `const primitive=cp.execFile;cp.execFile=(...args)=>{
const child=primitive(process.execPath,['-e','setTimeout(()=>{},120)'],()=>{});
args.at(-1)(null,'EARLY','');return child};syncBuiltinESMExports();`);
});

test("output close without EOF promptly burns pending child authority but preserves JS", async () => {
  await exercise(`let callbackDone;const done=new Promise(r=>{callbackDone=r});
call('/inert',[],()=>{callbackDone()});const js=await acquire();
const failure=assert.rejects(acquireChild(js),{message:refused});
originalChild.stdout.destroy();await failure;check(js);await done;`,
    `const primitive=cp.execFile;let originalChild;cp.execFile=(...args)=>{
originalChild=primitive(process.execPath,['-e','setTimeout(()=>{},120)'],args.at(-1));return originalChild};syncBuiltinESMExports();`);
});

test("foreign, proxy, arity and cross-instance handles cannot mint child authority", async () => {
  await exercise(`let traps=0;const proxy=new Proxy({}, {get(){traps++;throw Error('TRAP')}});
for(const handle of [{},proxy])await assert.rejects(acquireChild(handle),{message:refused});
await assert.rejects(acquireChild(),{message:refused});assert.throws(()=>checkChild(proxy),{message:refused});
const other=await import(${JSON.stringify(source)}+'?child-isolated-instance');
const foreign=await other.acquireDashboardCutoverLocalProducerDrainV2();
await assert.rejects(acquireChild(foreign),{message:refused});
const js=await acquire(),h=await acquireChild(js);checkChild(h);assert.equal(traps,0);
assert.throws(()=>checkChild(h,{}),{message:refused});checkChild(h);check(js);`);
});

test("repeated child acquisition burns only child generation", async () => {
  await exercise(`const js=await acquire(),h=await acquireChild(js);checkChild(h);
await assert.rejects(acquireChild(js),{message:refused});assert.throws(()=>checkChild(h),{message:refused});check(js);`);
});

test("constructed but never-spawned ChildProcess cannot mint custody from synthetic terminal events", async () => {
  await exercise(`let callback=false;call('/fake',[],()=>{callback=true});assert.equal(callback,true);
const js=await acquire();await assert.rejects(acquireChild(js),{message:refused});check(js);`,
    `const {PassThrough}=await import('node:stream');cp.execFile=(...args)=>{
const fake=new cp.ChildProcess();fake.stdout=new PassThrough();fake.stderr=new PassThrough();
args.at(-1)(null,'FAKE','');setImmediate(()=>{
fake.stdout.emit('end');fake.stderr.emit('end');fake.stdout.emit('close');fake.stderr.emit('close');
fake.emit('exit',0,null);fake.emit('close',0,null)});return fake};syncBuiltinESMExports();`);
});

test("child-only burn does not indefinitely retain later independently known natural children", async () => {
  await exercise(`call('/unknown',[],()=>{});await new Promise(resolve=>call('/known',[],()=>resolve()));
await tick();for(let i=0;i<20;i++){globalThis.gc();await tick()}
assert.equal(known.deref()===undefined,true,'a known completed later original must not leak into unknown custody');
const js=await acquire();await assert.rejects(acquireChild(js),{message:refused});check(js);`,
    `const primitive=cp.execFile;let known;cp.execFile=(...args)=>{
if(args[0]==='/unknown'){args.at(-1)(null,'','');return undefined}
const child=primitive(process.execPath,['-e',''],args.at(-1));known=new WeakRef(child);return child};syncBuiltinESMExports();`);
});
