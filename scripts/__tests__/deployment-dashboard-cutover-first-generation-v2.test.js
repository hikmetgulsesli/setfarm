import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { test as nodeTest } from "node:test";

const test = (name, body) => nodeTest(name, { skip: process.platform !== "darwin" }, body);
const moduleUrl = new URL("../deployment-dashboard-cutover-first-generation-v2.mjs", import.meta.url).href;
const input = { cutoverIntentHash: "a".repeat(64), ownerClaimHash: "b".repeat(64) };
const refusal = /DASHBOARD_FIRST_GENERATION_RESERVATION_REFUSED/;
const canonical = value => value === null || typeof value !== "object" ? JSON.stringify(value)
  : Array.isArray(value) ? `[${value.map(canonical).join(",")}]`
    : `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`;
async function fixture(body, setup = "") {
  const home = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "dashboard-first-generation-v2-")));
  fs.mkdirSync(path.join(home, "ai/setrox/data/internal-production-baseline"), { recursive: true, mode: 0o700 });
  const root = path.join(home, "ai/setrox/data/internal-production-baseline/restart-authority-retirement-v1");
  const program = `import fs from 'node:fs';import os from 'node:os';import cp from 'node:child_process';import{syncBuiltinESMExports}from'node:module';
const account=os.userInfo();os.userInfo=()=>({...account,homedir:${JSON.stringify(home)}});
const root=${JSON.stringify(root)},lock=root+'/physical-service-restart-authority.transition.lock',input=${JSON.stringify(input)};
const originalOpen=fs.openSync,originalStat=fs.fstatSync,originalClose=fs.closeSync,originalSpawn=cp.spawn;
let armed=false,api,ports=0,children=0,childClosed=0;const originals=[],closes=[];
for(const name of ['lstatSync','fstatSync','readSync','writeFileSync','fsyncSync','mkdirSync','readdirSync']){const original=fs[name];fs[name]=(...args)=>{ports++;return original(...args)}}
const originalAccount=os.userInfo;os.userInfo=(...args)=>{ports++;return originalAccount(...args)};
const originalOwnerPort=cp.spawnSync;cp.spawnSync=(...args)=>{ports++;return originalOwnerPort(...args)};
fs.openSync=(...args)=>{ports++;const fd=originalOpen(...args);if(armed)originals.push({fd,target:String(args[0])});return fd};
fs.closeSync=fd=>{if(armed&&originals.some(s=>s.fd===fd))closes.push(fd);return originalClose(fd)};
cp.spawn=(...args)=>{ports++;children++;const child=originalSpawn(...args);child.on('close',()=>childClosed++);return child};
const attempt=async callback=>{try{await callback();return null}catch(error){return error.message}};
const output={pid:process.pid};
${setup}
syncBuiltinESMExports();
try{api=await import(${JSON.stringify(moduleUrl)});armed=true;${body}}
catch(error){output.error=error.message}
output.children=children;output.childClosed=childClosed;output.closes=closes;output.originals=originals.map(s=>{let state;try{originalStat(s.fd);state='live'}catch(e){state=e.code}return{...s,state}});
process.stdout.write(JSON.stringify(output));`;
  // Retain actual test intent/result; do not infer child receipts from prose.
  const sourceHash = createHash("sha256").update(fs.readFileSync(new URL(moduleUrl))).digest("hex");
  fs.writeFileSync(home + "/intent.json", JSON.stringify({ program, node: process.execPath,
    moduleUrl, sourceHash, root }), { flag: "wx", mode: 0o600 });
  const child = spawn(process.execPath, ["--input-type=module", "-e", program], {
    cwd: "/", env: {}, stdio: ["ignore", "pipe", "pipe"],
  });
  let stdout = "", stderr = "", error, bytes = 0;
  const eof = { stdout: false, stderr: false };
  const closed = { stdout: false, stderr: false };
  child.on("error", e => { error ??= e; });
  for (const [stream, name] of [[child.stdout, "stdout"], [child.stderr, "stderr"]]) {
    stream.setEncoding("utf8"); stream.on("error", e => { error ??= e; });
    stream.on("end", () => { eof[name] = true; });
    stream.on("close", () => { closed[name] = true; });
    stream.on("data", data => {
      bytes += Buffer.byteLength(data); if (bytes > 1048576) { error ??= Error("CAPTURE_UNKNOWN"); return; }
      if (name === "stdout") stdout += data; else stderr += data;
    });
  }
  const [status, signal] = await new Promise(resolve => child.on("close", (...args) => resolve(args)));
  fs.writeFileSync(home + "/result.json", JSON.stringify({ stdout, stderr, status,
    signal, error: error?.message ?? null, eof, closed, program, sourceHash }), { flag: "wx", mode: 0o600 });
  console.log(JSON.stringify({ kind: "retained-first-generation-case", home, status, signal, eof, closed }));
  assert.equal(error, undefined); assert.equal(signal, null); assert.equal(status, 0, stderr);
  assert.deepEqual(eof, { stdout: true, stderr: true }); assert.equal(stderr, "");
  assert.deepEqual(closed, { stdout: true, stderr: true });
  // All fixture directories/publications retained; no cleanup or process signal.
  return { ...JSON.parse(stdout), root };
}

// Missing fixed parent interface is an API RED; source initialization is not
// claimed to be an owner/PG/ROOT acquisition or universal loader-FS absence.
test("fixed joint ROOT provider interfaces exist before reservation acquisition", async () => {
  const out = await fixture(`output.interfaceKinds=[
typeof api.acquireFirstGenerationDashboardCutoverJointReservationV4,
typeof api.assertFirstGenerationDashboardCutoverJointReservationV4];`);
  assert.equal(out.error, undefined);
  assert.equal(out.children, 0); assert.deepEqual(out.originals, []);
  assert.deepEqual(out.interfaceKinds, ["function", "function"], "MISSING_FIXED_JOINT_ROOT_PROVIDER");
});

// Break caught: original physical() accepts a sibling beside its own lock.
// Uses the actual old provider and actual Python leaf, no fabricated holder.
test("actual ROOT sibling insertion refuses original held reservation assertion", async () => {
  const out = await fixture(`const h=await api.acquireFirstGenerationDashboardCutoverReservationV2(input);
armed=false; // Oracle-created sibling is not a component-owned FD occurrence.
fs.writeFileSync(root+'/unexpected-sibling','preserved fault evidence',{flag:'wx',mode:0o600});
armed=true;
output.refused=await attempt(()=>api.assertFirstGenerationDashboardCutoverReservationV2(h));
armed=false; // External evidence reads are not parent-port disposal.
output.members=fs.readdirSync(root).sort();output.wire=fs.readFileSync(lock,'utf8');`);
  assert.equal(out.error, undefined, JSON.stringify(out));
  assert.equal(out.children, 1); assert.equal(out.childClosed, 1);
  assert.deepEqual(out.members, ["physical-service-restart-authority.transition.lock", "unexpected-sibling"]);
  assert.deepEqual(out.closes, []);
  assert.equal(out.refused, "DASHBOARD_FIRST_GENERATION_RESERVATION_REFUSED", "EXTRA_ROOT_MEMBER_WAS_ACCEPTED");
});

test("actual retained reservation publishes one complete ROOT and closes every original once without unlink", async () => {
  const out = await fixture(`const h=await api.acquireFirstGenerationDashboardCutoverReservationV2(input);
output.opaque=Object.isFrozen(h)&&Object.getPrototypeOf(h)===null&&Reflect.ownKeys(h).length===0;
api.assertFirstGenerationDashboardCutoverReservationV2(h);output.wire=fs.readFileSync(lock,'utf8');
api.closeFirstGenerationDashboardCutoverReservationV2(h);output.persisted=fs.readFileSync(lock,'utf8')===output.wire;`);
  assert.equal(out.error, undefined, JSON.stringify(out)); assert.equal(out.opaque, true); assert.equal(out.persisted, true);
  assert.equal(out.children, 1); assert.equal(out.childClosed, 1);
  assert.ok(out.originals.length >= 11); assert.equal(new Set(out.originals.map(s => s.fd)).size, out.originals.length);
  assert.deepEqual(out.closes, out.originals.map(s => s.fd).reverse());
  for (const s of out.originals) assert.equal(s.state, "EBADF");
  const record = JSON.parse(out.wire), { lockHash, ...body } = record;
  assert.equal(body.schema, "setfarm.internal-production-dashboard-cutover-serialization-lock.v2");
  assert.equal(body.purpose, "preserved-dashboard-cutover"); assert.equal(body.owner.pid, out.pid);
  assert.equal(body.cutoverIntentHash, input.cutoverIntentHash); assert.equal(body.ownerClaimHash, input.ownerClaimHash);
  assert.equal(lockHash, createHash("sha256").update(canonical(body)).digest("hex"));
  assert.equal(out.wire, canonical(record) + "\n"); assert.equal(fs.lstatSync(out.root).mode & 0o7777, 0o700);
});
for (const kind of ["directory", "file", "symlink"]) {
  test(`existing canonical ${kind} refuses before staging or Python and preserves original`, async () => {
    const out = await fixture(`const before=fs.lstatSync(root,{bigint:true});output.refused=await attempt(()=>api.acquireFirstGenerationDashboardCutoverReservationV2(input));
output.same=fs.lstatSync(root,{bigint:true}).ino===before.ino;output.members=fs.readdirSync(root.substring(0,root.lastIndexOf('/')));`,
    kind === "directory" ? "fs.mkdirSync(root,{mode:0o700});" : kind === "file" ? "fs.writeFileSync(root,'old');" : "fs.symlinkSync('/unresolved-owned-fixture',root);");
    assert.equal(out.error, undefined, JSON.stringify(out)); assert.match(out.refused, refusal);
    assert.equal(out.same, true); assert.equal(out.children, 0); assert.deepEqual(out.members, ["restart-authority-retirement-v1"]);
    assert.deepEqual(out.closes, []); for (const s of out.originals) assert.equal(s.state, "live");
  });
}
test("invalid idle inputs invoke zero traps/ports and preserve the valid attempt", async () => {
  const out = await fixture(`let traps=0;const trap=()=>{traps++;throw Error('TRAP')};const get={...input};Object.defineProperty(get,'ownerClaimHash',{enumerable:true,get:trap});
const before=ports;output.bad=[];for(const value of [null,{...input,extra:1},Object.assign(Object.create(null),input),new Proxy(input,{get:trap,getPrototypeOf:trap,ownKeys:trap}),get])output.bad.push(await attempt(()=>api.acquireFirstGenerationDashboardCutoverReservationV2(value)));
output.portDelta=ports-before;output.traps=traps;const h=await api.acquireFirstGenerationDashboardCutoverReservationV2(input);api.closeFirstGenerationDashboardCutoverReservationV2(h);`);
  assert.equal(out.error, undefined, JSON.stringify(out)); for (const e of out.bad) assert.match(e, refusal);
  assert.equal(out.portDelta, 0); assert.equal(out.traps, 0); assert.equal(out.children, 1);
});
test("foreign and proxy handles touch zero traps/ports without burning the authentic handle", async () => {
  const out = await fixture(`const h=await api.acquireFirstGenerationDashboardCutoverReservationV2(input);let traps=0;const trap=()=>{traps++;throw Error('TRAP')};const before=ports;
output.bad=[];for(const v of [{},new Proxy(h,{get:trap,getPrototypeOf:trap,ownKeys:trap})])for(const name of ['assertFirstGenerationDashboardCutoverReservationV2','closeFirstGenerationDashboardCutoverReservationV2'])output.bad.push(await attempt(()=>api[name](v)));
output.portDelta=ports-before;output.traps=traps;api.assertFirstGenerationDashboardCutoverReservationV2(h);api.closeFirstGenerationDashboardCutoverReservationV2(h);`);
  assert.equal(out.error, undefined, JSON.stringify(out)); for (const e of out.bad) assert.match(e, refusal);
  assert.equal(out.portDelta, 0); assert.equal(out.traps, 0); for (const s of out.originals) assert.equal(s.state, "EBADF");
});
test("post-spawn swallowed reentry drains returned original child before refusing, retains every parent FD", async () => {
  const out = await fixture(`output.refused=await attempt(()=>api.acquireFirstGenerationDashboardCutoverReservationV2(input));output.childAtRefusal=childClosed;
output.retry=await attempt(()=>api.acquireFirstGenerationDashboardCutoverReservationV2(input));output.persisted=fs.existsSync(lock);`,
  `cp.spawn=(...args)=>{ports++;children++;const child=originalSpawn(...args);child.on('close',()=>childClosed++);try{api.assertFirstGenerationDashboardCutoverReservationV2({})}catch{}return child};`);
  assert.equal(out.error, undefined, JSON.stringify(out)); assert.match(out.refused, refusal); assert.match(out.retry, refusal);
  assert.equal(out.childAtRefusal, 1); assert.equal(out.children, 1); assert.equal(out.persisted, true);
  assert.deepEqual(out.closes, []); for (const s of out.originals) assert.equal(s.state, "live");
});
for (const fault of ["write", "sync", "unsealed-fstat", "close-before", "close-after"]) {
  test(`${fault} refuses permanently and retains original evidence without implicit cleanup`, async () => {
    const closeFault = fault.startsWith("close-");
    const setup = fault === "write" ? "const write=fs.writeFileSync;fs.writeFileSync=(...args)=>{if(armed&&typeof args[0]==='number')throw Error('OWNED_WRITE');return write(...args)};"
      : fault === "sync" ? "const sync=fs.fsyncSync;fs.fsyncSync=fd=>{if(armed)throw Error('OWNED_SYNC');return sync(fd)};"
      : fault === "unsealed-fstat" ? "fs.fstatSync=(fd,...args)=>{if(armed&&originals.length)throw Error('OWNED_FSTAT');return originalStat(fd,...args)};"
      : `fs.closeSync=fd=>{if(armed&&originals.some(s=>s.fd===fd)){closes.push(fd);${fault === "close-after" ? "originalClose(fd);" : ""}throw Error('OWNED_CLOSE')}return originalClose(fd)};`;
    const out = await fixture(closeFault ? `const h=await api.acquireFirstGenerationDashboardCutoverReservationV2(input);output.refused=await attempt(()=>api.closeFirstGenerationDashboardCutoverReservationV2(h));output.retry=await attempt(()=>api.closeFirstGenerationDashboardCutoverReservationV2(h));output.persisted=fs.existsSync(lock);`
      : `output.refused=await attempt(()=>api.acquireFirstGenerationDashboardCutoverReservationV2(input));output.retry=await attempt(()=>api.acquireFirstGenerationDashboardCutoverReservationV2(input));`, setup);
    assert.equal(out.error, undefined, JSON.stringify(out)); assert.match(out.refused, refusal); assert.match(out.retry, refusal);
    assert.equal(out.closes.length, closeFault ? 1 : 0);
    if (closeFault) { assert.equal(out.persisted, true); assert.equal(out.children, 1); }
    else assert.equal(out.children, 0);
    assert.ok(out.originals.length > 0);
    for (const [index, s] of out.originals.entries()) assert.equal(s.state, fault === "close-after" && index === out.originals.length - 1 ? "EBADF" : "live");
  });
}
test("late original lock metadata drift before first close refuses without any close or repin", async () => {
  const out = await fixture(`const h=await api.acquireFirstGenerationDashboardCutoverReservationV2(input);closing=true;
output.refused=await attempt(()=>api.closeFirstGenerationDashboardCutoverReservationV2(h));output.persisted=fs.existsSync(lock);output.triggered=lockChecks;`,
  `let closing=false,lockChecks=0;fs.fstatSync=(fd,...args)=>{if(closing&&originals.some(s=>s.fd===fd&&s.target.endsWith('/physical-service-restart-authority.transition.lock'))){lockChecks++;if(lockChecks===3)fs.appendFileSync(lock,'owned-drift')}return originalStat(fd,...args)};`);
  assert.equal(out.error, undefined, JSON.stringify(out)); assert.match(out.refused, refusal);
  assert.equal(out.triggered, 3); assert.equal(out.persisted, true); assert.deepEqual(out.closes, []);
  for (const s of out.originals) assert.equal(s.state, "live");
});
test("consistently short interpreter original refuses before staging or child birth", async () => {
  const out = await fixture(`output.refused=await attempt(()=>api.acquireFirstGenerationDashboardCutoverReservationV2(input));
output.reads=shortReads;output.members=fs.readdirSync(root.substring(0,root.lastIndexOf('/')));`,
  `let shortReads=0;const read=fs.readSync;fs.readSync=(fd,buffer,offset,length,position)=>{if(armed&&originals.some(s=>s.fd===fd&&s.target==='/usr/bin/python3')){shortReads++;return position===0?read(fd,buffer,offset,1,0):0}return read(fd,buffer,offset,length,position)};`);
  assert.equal(out.error, undefined, JSON.stringify(out)); assert.match(out.refused, refusal);
  assert.equal(out.children, 0); assert.deepEqual(out.members, []); assert.equal(out.reads, 2);
  assert.deepEqual(out.closes, []); for (const s of out.originals) assert.equal(s.state, "live");
});
// Removing the capture burn, output/EOF validation or awaited settlement must
// fail these cases. Only transport events are faulted; the actual fixed helper
// is spawned once, runs its native publication and exits naturally.
for (const fault of ["stdout-error", "stderr-error", "overflow", "malformed", "missing-EOF"]) {
  test(`parent ${fault} capture retains originals and drains the actual child before permanent refusal`, async () => {
    const injection = fault.endsWith("-error")
      ? `queueMicrotask(()=>child.${fault.startsWith("stdout") ? "stdout" : "stderr"}.emit('error',Error('OWNED_CAPTURE')));`
      : fault === "overflow" ? "queueMicrotask(()=>child.stdout.emit('data',Buffer.alloc(16385,0x78)));"
      : `const on=child.stdout.on.bind(child.stdout);child.stdout.on=(name,callback)=>{
if(name==='${fault === "malformed" ? "data" : "end"}')return on(name,${fault === "malformed" ? "chunk=>callback(Buffer.concat([chunk,Buffer.from('extra')]))" : "()=>{suppressedEOF++}"});return on(name,callback)};`;
    const out = await fixture(`output.refused=await attempt(()=>api.acquireFirstGenerationDashboardCutoverReservationV2(input));
output.childAtRefusal=childClosed;output.suppressedEOF=suppressedEOF;const before=ports;
output.retry=await attempt(()=>api.acquireFirstGenerationDashboardCutoverReservationV2(input));output.retryPorts=ports-before;
output.persisted=fs.existsSync(lock);`,
    `let suppressedEOF=0;cp.spawn=(...args)=>{ports++;children++;const child=originalSpawn(...args);child.on('close',()=>childClosed++);${injection}return child};`);
    assert.equal(out.error, undefined, JSON.stringify(out)); assert.match(out.refused, refusal); assert.match(out.retry, refusal);
    assert.equal(out.childAtRefusal, 1); assert.equal(out.childClosed, 1); assert.equal(out.children, 1);
    assert.equal(out.retryPorts, 0); assert.equal(out.persisted, true); assert.deepEqual(out.closes, []);
    if (fault === "missing-EOF") assert.equal(out.suppressedEOF, 1);
    for (const s of out.originals) assert.equal(s.state, "live");
  });
}
test("closed authentic reservation is permanently spent and subsequent calls perform zero ports", async () => {
  const out = await fixture(`const h=await api.acquireFirstGenerationDashboardCutoverReservationV2(input);api.closeFirstGenerationDashboardCutoverReservationV2(h);
const before=ports;output.bad=[await attempt(()=>api.acquireFirstGenerationDashboardCutoverReservationV2(input)),
await attempt(()=>api.assertFirstGenerationDashboardCutoverReservationV2(h)),await attempt(()=>api.closeFirstGenerationDashboardCutoverReservationV2(h))];
output.portDelta=ports-before;output.persisted=fs.existsSync(lock);`);
  assert.equal(out.error, undefined, JSON.stringify(out)); for (const e of out.bad) assert.match(e, refusal);
  assert.equal(out.portDelta, 0); assert.equal(out.persisted, true); assert.equal(out.children, 1);
  assert.deepEqual(out.closes, out.originals.map(s => s.fd).reverse());
  for (const s of out.originals) assert.equal(s.state, "EBADF");
});
