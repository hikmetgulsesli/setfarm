import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { transformSync } from "esbuild";

// Private compiled fixtures exercise ownership, not clean-main build qualification.
// The real source/build observer remains an external integration requirement.
const repo = new URL("../../", import.meta.url);
function fixture(body) {
  const home = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "cutover-capability-")));
  const checkout = path.join(home, "checkout");
  fs.mkdirSync(path.join(checkout, "scripts"), { recursive: true, mode: 0o700 });
  fs.mkdirSync(path.join(checkout, "dist", "internal-production"), { recursive: true, mode: 0o700 });
  fs.mkdirSync(path.join(checkout, "dist", "product-compiler"), { recursive: true, mode: 0o700 });
  fs.mkdirSync(path.join(home, "ai", "setrox", "data", "internal-production-baseline"), { recursive: true, mode: 0o700 });
  try {
    for (const name of ["deployment-cutover-owner.mjs", "deployment-cutover.mjs", "deployment-cutover-dependencies.mjs", "build-generation-maintenance-owner-observer.mjs", "build-generation-maintenance-journal.mjs"])
      fs.copyFileSync(new URL(`scripts/${name}`, repo), path.join(checkout, "scripts", name));
    for (const locator of ["internal-production/baseline-deployment-cutover-owner-store-v1", "internal-production/baseline-deployment-cutover-records-v1", "internal-production/baseline-deployment-cutover-publication-v1", "internal-production/baseline-deployment-cutover-v1", "internal-production/baseline-workspace-authority-path-v1", "product-compiler/canonical-json"])
      fs.writeFileSync(path.join(checkout, "dist", `${locator}.js`), transformSync(fs.readFileSync(new URL(`src/${locator}.ts`, repo), "utf8"), { loader: "ts", format: "esm", target: "node22" }).code, { mode: 0o600 });
    fs.writeFileSync(path.join(checkout, "package.json"), '{"type":"module"}', { mode: 0o600 });
    fs.writeFileSync(path.join(checkout, "scripts/build-generation-retention.mjs"), `
      export function observeCurrentFinalizedSetfarmSourceBuildV1(){return {branch:'main',clean:true,sha:'a'.repeat(40),treeHash:'b'.repeat(40),buildHash:'c'.repeat(64),originMainSha:'a'.repeat(40)}}`, { mode: 0o600 });
    body(home, checkout);
  } finally { fs.rmSync(home, { recursive: true, force: true }); }
}
function program(home, checkout, action) {
  return `
    import fs from 'node:fs';import os from 'node:os';import {syncBuiltinESMExports} from 'node:module';
    const actual=os.userInfo();os.userInfo=()=>({...actual,homedir:${JSON.stringify(home)}});os.homedir=()=>${JSON.stringify(home)};syncBuiltinESMExports();
    const module=await import(${JSON.stringify(path.join(checkout, "scripts/deployment-cutover-owner.mjs"))});
    const source=await module.observeDeploymentCutoverOwnerControllerSourceV1();
    const records=await import(${JSON.stringify(path.join(checkout, "dist/internal-production/baseline-deployment-cutover-records-v1.js"))});
    const plan={
      oldDeployment:{checkoutPath:'/old',checkoutDirectoryIdentityHash:'a'.repeat(64),sourceSha:'b'.repeat(40),sourceTreeHash:'c'.repeat(40),buildHash:'d'.repeat(64)},
      newDeployment:{checkoutPath:'/new',checkoutDirectoryIdentityHash:'e'.repeat(64),sourceSha:'f'.repeat(40),sourceTreeHash:'1'.repeat(40),buildHash:'2'.repeat(64)},
      cliLinkObservationHash:'3'.repeat(64),spawnerLauncherConfigurationHash:'4'.repeat(64),dashboardLauncherConfigurationHash:'5'.repeat(64),dashboardPort:3333};
    const maintenance=records.createDeploymentCutoverMaintenanceIntentV1({controllerSourceHash:source.controllerSourceHash,plan});
    const root=${JSON.stringify(path.join(home, "ai/setrox/data/internal-production-baseline/deployment-cutover-owner-v1"))};
    ${action}
  `;
}
function run(home, checkout, action) {
  const child = spawnSync(process.execPath, ["--input-type=module", "-e", program(home, checkout, action)], { encoding: "utf8", env: {}, timeout: 15000 });
  assert.equal(child.status, 0, child.stderr); return JSON.parse(child.stdout);
}
function freshOrdinaryStartResult(home, checkout) {
  const observer = path.join(checkout, "dist/internal-production/baseline-deployment-cutover-v1.js");
  const child = spawnSync(process.execPath, ["--input-type=module", "-e", `
    import os from 'node:os';import {syncBuiltinESMExports} from 'node:module';
    const actual=os.userInfo();os.userInfo=()=>({...actual,homedir:${JSON.stringify(home)}});syncBuiltinESMExports();
    const observer=await import(${JSON.stringify(observer)});
    try{observer.assertOrdinarySpawnerDeploymentCutoverAdmissionV1();process.stdout.write('admitted')}
    catch(error){process.stdout.write(error.message)}
  `], { encoding: "utf8", env: {}, timeout: 15000 });
  assert.equal(child.status, 0, child.stderr);
  return child.stdout;
}
test("owner controller source accepts legitimate partial source reads", () => fixture((home, checkout) => {
  const body = program(home, checkout, 'process.stdout.write(JSON.stringify({hash:source.controllerSourceHash}));')
    .replace('const module=await import', 'const read=fs.readSync;fs.readSync=(fd,buffer,offset,length,position)=>read(fd,buffer,offset,Math.min(length,127),position);const module=await import');
  const result = spawnSync(process.execPath, ["--input-type=module", "-e", body], { encoding: "utf8", env: {}, timeout: 15000 });
  assert.equal(result.status, 0, result.stderr); assert.match(JSON.parse(result.stdout).hash, /^[a-f0-9]{64}$/);
}));

test("real current owner gets one opaque local capability without a spawner lock", () => fixture((home, checkout) => {
  const result = run(home, checkout, `const cap=await module.acquireDeploymentCutoverOwnerV1(maintenance);
    module.assertDeploymentCutoverOwnerV1(cap);let forged=false,second=false;
    try{module.assertDeploymentCutoverOwnerV1({...cap})}catch{forged=true}
    try{await module.acquireDeploymentCutoverOwnerV1(maintenance)}catch{second=true}
    process.stdout.write(JSON.stringify({forged,second,keys:Object.keys(cap),pid:process.pid,claim:JSON.parse(fs.readFileSync(root+'/owner-0001.json')),lock:fs.existsSync(${JSON.stringify(path.join(home, ".openclaw/setfarm/spawner.lock"))})}));`);
  assert.equal(result.forged, true); assert.equal(result.second, true); assert.deepEqual(result.keys, []);
  assert.equal(result.claim.owner.pid, result.pid); assert.equal(result.lock, false);
}));

test("current owner publishes only its matching durable intent and fresh ordinary startup refuses", () => fixture((home, checkout) => {
  const result = run(home, checkout, `const cap=await module.acquireDeploymentCutoverOwnerV1(maintenance);
    const intent=records.createDeploymentCutoverIntentV1({...plan,maintenanceIntentHash:maintenance.maintenanceIntentHash});
    const published=module.publishDeploymentCutoverIntentWithOwnerV1(cap,intent);
    process.stdout.write(JSON.stringify({publishedHash:published.cutoverIntentHash,expectedHash:intent.cutoverIntentHash,
      expectedBytes:records.encodeDeploymentCutoverIntentV1(intent).toString('base64')}));`);
  assert.equal(result.publishedHash, result.expectedHash);
  const intentPath = path.join(home, "ai/setrox/data/internal-production-baseline/deployment-cutover-v1/intent.json");
  const onDisk = fs.readFileSync(intentPath);
  assert.deepEqual(onDisk, Buffer.from(result.expectedBytes, "base64"));
  assert.equal(freshOrdinaryStartResult(home, checkout), "DEPLOYMENT_CUTOVER_ORDINARY_START_REFUSED");
}));

test("forged owner and crossed maintenance plan cannot publish an intent", () => fixture((home, checkout) => {
  const result = run(home, checkout, `const cap=await module.acquireDeploymentCutoverOwnerV1(maintenance);
    const intent=records.createDeploymentCutoverIntentV1({...plan,maintenanceIntentHash:maintenance.maintenanceIntentHash});
    let forged=false,crossed=false;
    try{module.publishDeploymentCutoverIntentWithOwnerV1({...cap},intent)}catch{forged=true}
    const wrong=records.createDeploymentCutoverIntentV1({...plan,cliLinkObservationHash:'9'.repeat(64),maintenanceIntentHash:maintenance.maintenanceIntentHash});
    try{module.publishDeploymentCutoverIntentWithOwnerV1(cap,wrong)}catch{crossed=true}
    process.stdout.write(JSON.stringify({forged,crossed,exists:fs.existsSync(${JSON.stringify(path.join(home, "ai/setrox/data/internal-production-baseline/deployment-cutover-v1"))})}));`);
  assert.deepEqual(result, { forged: true, crossed: true, exists: false });
}));

test("owner replacement during publication never returns success or removes durable refusal", () => fixture((home, checkout) => {
  const result = run(home, checkout, `const cap=await module.acquireDeploymentCutoverOwnerV1(maintenance);
    const intent=records.createDeploymentCutoverIntentV1({...plan,maintenanceIntentHash:maintenance.maintenanceIntentHash});
    const ownerRoot=root,retained=root+'.retained',link=fs.linkSync;let replaced=false;
    fs.linkSync=(from,to)=>{const value=link(from,to);if(to.endsWith('/deployment-cutover-v1/intent.json')&&!replaced){
      replaced=true;fs.renameSync(ownerRoot,retained);fs.mkdirSync(ownerRoot,{mode:0o700});
    }return value};
    let refused=false;try{module.publishDeploymentCutoverIntentWithOwnerV1(cap,intent)}catch{refused=true}
    process.stdout.write(JSON.stringify({refused,replaced,intentExists:fs.existsSync(${JSON.stringify(path.join(home, "ai/setrox/data/internal-production-baseline/deployment-cutover-v1/intent.json"))})}));`);
  assert.deepEqual(result, { refused: true, replaced: true, intentExists: true });
  assert.equal(freshOrdinaryStartResult(home, checkout), "DEPLOYMENT_CUTOVER_ORDINARY_START_REFUSED");
}));
test("overlapping public acquisitions cannot mint two handles", () => fixture((home, checkout) => {
  const result = run(home, checkout, `const results=await Promise.allSettled([module.acquireDeploymentCutoverOwnerV1(maintenance),module.acquireDeploymentCutoverOwnerV1(maintenance)]);
    process.stdout.write(JSON.stringify(results.map(result=>result.status)));`);
  assert.deepEqual(result, ["fulfilled", "rejected"]);
}));
test("crossed controller commitment refuses before owner-store creation", () => fixture((home, checkout) => {
  const result = run(home, checkout, `const wrong=records.createDeploymentCutoverMaintenanceIntentV1({controllerSourceHash:'0'.repeat(64),plan});
    let refused=false;try{await module.acquireDeploymentCutoverOwnerV1(wrong)}catch{refused=true}
    process.stdout.write(JSON.stringify({refused,exists:fs.existsSync(root)}));`);
  assert.deepEqual(result, { refused: true, exists: false });
}));
test("owner physical replacement invalidates a previously valid handle permanently", () => fixture((home, checkout) => {
  const result = run(home, checkout, `const cap=await module.acquireDeploymentCutoverOwnerV1(maintenance);
    fs.renameSync(root,root+'.retained');fs.mkdirSync(root,{mode:0o700});let refused=false,restoredRefused=false;
    try{module.assertDeploymentCutoverOwnerV1(cap)}catch{refused=true}
    fs.rmdirSync(root);fs.renameSync(root+'.retained',root);
    try{module.assertDeploymentCutoverOwnerV1(cap)}catch{restoredRefused=true}
    process.stdout.write(JSON.stringify({refused,restoredRefused}));`);
  assert.deepEqual(result, { refused: true, restoredRefused: true });
}));

test("a real exited owner permits an append-only successor with fresh death evidence", () => fixture((home, checkout) => {
  const first = run(home, checkout, `await module.acquireDeploymentCutoverOwnerV1(maintenance);process.stdout.write(fs.readFileSync(root+'/owner-0001.json'));`);
  const root = path.join(home, "ai/setrox/data/internal-production-baseline/deployment-cutover-owner-v1");
  const inode = fs.statSync(path.join(root, "owner-0001.json")).ino;
  const second = run(home, checkout, `const cap=await module.acquireDeploymentCutoverOwnerV1(maintenance);module.assertDeploymentCutoverOwnerV1(cap);process.stdout.write(fs.readFileSync(root+'/owner-0002.json'));`);
  assert.equal(second.ordinal, 2); assert.equal(second.previousOwnerClaimHash, first.ownerClaimHash);
  assert.notEqual(second.owner.pid, first.owner.pid); assert.match(second.previousOwnerDeathObservationHash, /^[a-f0-9]{64}$/);
  assert.equal(fs.statSync(path.join(root, "owner-0001.json")).ino, inode);
}));

test("a still-running owner refuses takeover and transferred capability", () => fixture((home, checkout) => {
  const childProgram = program(home, checkout, `const cap=await module.acquireDeploymentCutoverOwnerV1(maintenance);
    process.stdout.write(JSON.stringify(cap)+'\\n');process.stdin.resume();process.stdin.once('data',()=>process.exit(0));`);
  const result = run(home, checkout, `const {spawn}=await import('node:child_process');
    const child=spawn(process.execPath,['--input-type=module','-e',${JSON.stringify(childProgram)}],{env:{},stdio:['pipe','pipe','pipe']});
    const exit=new Promise(resolve=>child.once('exit',resolve));let errorText='';child.stderr.on('data',bytes=>errorText+=bytes);
    const transferred=await new Promise((resolve,reject)=>{let text='';child.stdout.on('data',bytes=>{text+=bytes;if(text.includes('\\n'))resolve(JSON.parse(text.trim()))});child.once('exit',()=>reject(Error(errorText||'owner exited early')))});
    let refused=false,transferRefused=false;
    try{module.assertDeploymentCutoverOwnerV1(transferred)}catch{transferRefused=true}
    try{await module.acquireDeploymentCutoverOwnerV1(maintenance)}catch{refused=true}
    child.stdin.end('done');await exit;process.stdout.write(JSON.stringify({refused,transferRefused,count:fs.readdirSync(root).filter(name=>/^owner-/.test(name)).length}));`);
  assert.deepEqual(result, { refused: true, transferRefused: true, count: 1 });
}));

test("a changed latest owner claim invalidates the old local capability", () => fixture((home, checkout) => {
  const result = run(home, checkout, `const cap=await module.acquireDeploymentCutoverOwnerV1(maintenance);
    const store=await import(${JSON.stringify(path.join(checkout, "dist/internal-production/baseline-deployment-cutover-owner-store-v1.js"))});
    const previous=JSON.parse(fs.readFileSync(root+'/owner-0001.json'));
    const other=records.createDeploymentCutoverOwnerClaimV1({maintenance,previous,owner:{...previous.owner,pid:previous.owner.pid+100000},previousOwnerDeathObservationHash:'e'.repeat(64)});
    store.publishDeploymentCutoverOwnerClaimV1(maintenance,other);let refused=false;
    try{module.assertDeploymentCutoverOwnerV1(cap)}catch{refused=true}
    process.stdout.write(JSON.stringify({refused,count:store.observeDeploymentCutoverOwnerHistoryV1().claims.length}));`);
  assert.deepEqual(result, { refused: true, count: 2 });
}));

test("a stable inert losing stage does not replace or invalidate the current owner", () => fixture((home, checkout) => {
  const result = run(home, checkout, `const cap=await module.acquireDeploymentCutoverOwnerV1(maintenance);
    fs.writeFileSync(root+'/.owner-0002.json.12345678-1234-4234-8234-123456789abc.tmp','partial',{mode:0o600});
    module.assertDeploymentCutoverOwnerV1(cap);process.stdout.write(JSON.stringify({retained:fs.readFileSync(root+'/.owner-0002.json.12345678-1234-4234-8234-123456789abc.tmp','utf8')}));`);
  assert.deepEqual(result, { retained: "partial" });
}));

test("helper source drift permanently refuses even after restoring old bytes", () => fixture((home, checkout) => {
  const helper = path.join(checkout, "scripts/build-generation-maintenance-owner-observer.mjs");
  const result = run(home, checkout, `const cap=await module.acquireDeploymentCutoverOwnerV1(maintenance);
    const helper=${JSON.stringify(helper)},bytes=fs.readFileSync(helper);fs.appendFileSync(helper,'\\n');let refused=false,restoredRefused=false;
    try{module.assertDeploymentCutoverOwnerV1(cap)}catch{refused=true}
    fs.writeFileSync(helper,bytes);try{module.assertDeploymentCutoverOwnerV1(cap)}catch{restoredRefused=true}
    process.stdout.write(JSON.stringify({refused,restoredRefused}));`);
  assert.deepEqual(result, { refused: true, restoredRefused: true });
}));

test("pending acquisition cannot substitute a caller-mutated valid maintenance plan", () => fixture((home, checkout) => {
  const result = run(home, checkout, `const mutable={...maintenance};const pending=module.acquireDeploymentCutoverOwnerV1(mutable);
    const changed=records.createDeploymentCutoverMaintenanceIntentV1({controllerSourceHash:source.controllerSourceHash,plan:{...plan,cliLinkObservationHash:'9'.repeat(64)}});
    Object.assign(mutable,changed);await pending;
    process.stdout.write(JSON.stringify({actual:JSON.parse(fs.readFileSync(root+'/intent.json')).maintenanceIntentHash,expected:maintenance.maintenanceIntentHash}));`);
  assert.equal(result.actual, result.expected);
}));

test("replacing a baseline ancestor cannot preserve a handle by moving the same owner root back", () => fixture((home, checkout) => {
  const result = run(home, checkout, `const cap=await module.acquireDeploymentCutoverOwnerV1(maintenance);
    const baseline=root.slice(0,root.lastIndexOf('/')),retained=baseline+'.retained';
    const original=fs.statSync(root).ino;fs.renameSync(baseline,retained);fs.mkdirSync(baseline,{mode:0o700});
    fs.renameSync(retained+'/deployment-cutover-owner-v1',root);let refused=false;
    try{module.assertDeploymentCutoverOwnerV1(cap)}catch{refused=true}
    process.stdout.write(JSON.stringify({refused,sameRoot:fs.statSync(root).ino===original}));`);
  assert.deepEqual(result, { refused: true, sameRoot: true });
}));

for (const hostile of ["getter", "proxy"]) test(`${hostile} maintenance refuses without evaluating caller code`, () => fixture((home, checkout) => {
  const result = run(home, checkout, `let traps=0;const input=${JSON.stringify(hostile)}==='getter'
    ? Object.defineProperty({...maintenance},'cutoverPlanHash',{enumerable:true,get(){traps++;return maintenance.cutoverPlanHash}})
    : new Proxy(maintenance,{getOwnPropertyDescriptor(){traps++;throw Error('TRAP')},getPrototypeOf(){traps++;throw Error('TRAP')},ownKeys(){traps++;throw Error('TRAP')}});
    let refused=false;try{await module.acquireDeploymentCutoverOwnerV1(input)}catch{refused=true}
    process.stdout.write(JSON.stringify({refused,traps,exists:fs.existsSync(root)}));`);
  assert.deepEqual(result, { refused: true, traps: 0, exists: false });
}));

test("fresh successor refuses a predecessor PID that has been reused", () => fixture((home, checkout) => {
  const previous = run(home, checkout, `await module.acquireDeploymentCutoverOwnerV1(maintenance);process.stdout.write(fs.readFileSync(root+'/owner-0001.json'));`);
  const result = run(home, checkout, `const cp=await import('node:child_process');const original=cp.default.spawnSync;
    cp.default.spawnSync=(file,args,options)=>file==='/bin/ps'&&args[1]===${JSON.stringify(String(previous.owner.pid))}
      ? {status:0,signal:null,stdout:Buffer.from(' '+process.getuid()+' Mon Jan  1 00:00:00 2024 1234 S\\n'),stderr:Buffer.alloc(0)}:original(file,args,options);
    let refused=false;try{await module.acquireDeploymentCutoverOwnerV1(maintenance)}catch{refused=true}
    process.stdout.write(JSON.stringify({refused,second:fs.existsSync(root+'/owner-0002.json')}));`);
  assert.deepEqual(result, { refused: true, second: false });
}));

test("ambiguous current process observation revokes an existing handle", () => fixture((home, checkout) => {
  const result = run(home, checkout, `const cap=await module.acquireDeploymentCutoverOwnerV1(maintenance);
    const cp=await import('node:child_process');const original=cp.default.spawnSync;
    cp.default.spawnSync=(file,args,options)=>file==='/bin/ps'?{status:0,signal:null,stdout:Buffer.from('malformed\\n'),stderr:Buffer.alloc(0)}:original(file,args,options);
    let refused=false,restoredRefused=false;try{module.assertDeploymentCutoverOwnerV1(cap)}catch{refused=true}
    cp.default.spawnSync=original;try{module.assertDeploymentCutoverOwnerV1(cap)}catch{restoredRefused=true}
    process.stdout.write(JSON.stringify({refused,restoredRefused}));`);
  assert.deepEqual(result, { refused: true, restoredRefused: true });
}));

test("actual child exit after owner link leaves recoverable immutable history", () => fixture((home, checkout) => {
  const child = spawnSync(process.execPath, ["--input-type=module", "-e", program(home, checkout, `
    const link=fs.linkSync;fs.linkSync=(from,to)=>{const result=link(from,to);if(to.endsWith('/owner-0001.json'))process.exit(17);return result;};
    await module.acquireDeploymentCutoverOwnerV1(maintenance);`)], { encoding: "utf8", env: {}, timeout: 15000 });
  assert.equal(child.status, 17, child.stderr);
  const root = path.join(home, "ai/setrox/data/internal-production-baseline/deployment-cutover-owner-v1");
  const original = fs.readFileSync(path.join(root, "owner-0001.json")), inode = fs.statSync(path.join(root, "owner-0001.json")).ino;
  const successor = run(home, checkout, `await module.acquireDeploymentCutoverOwnerV1(maintenance);process.stdout.write(fs.readFileSync(root+'/owner-0002.json'));`);
  assert.equal(successor.previousOwnerClaimHash, JSON.parse(original).ownerClaimHash);
  assert.deepEqual(fs.readFileSync(path.join(root, "owner-0001.json")), original);
  assert.equal(fs.statSync(path.join(root, "owner-0001.json")).ino, inode);
}));

test("publication cannot adopt a baseline replaced after the last owner observation closes", () => fixture((home, checkout) => {
  run(home, checkout, `await module.acquireDeploymentCutoverOwnerV1(maintenance);process.stdout.write('{}');`);
  const result = run(home, checkout, `const baseline=root.slice(0,root.lastIndexOf('/')),open=fs.openSync,close=fs.closeSync;
    let opens=0,chosen=null,replaced=false;
    fs.openSync=(target,...args)=>{const fd=open(target,...args);if(target===baseline&&++opens===2)chosen=fd;return fd};
    fs.closeSync=fd=>{const result=close(fd);if(fd===chosen&&!replaced){replaced=true;
      fs.renameSync(baseline,baseline+'.retained');fs.mkdirSync(baseline,{mode:0o700});
      fs.renameSync(baseline+'.retained/deployment-cutover-owner-v1',root);}return result};
    let refused=false;try{await module.acquireDeploymentCutoverOwnerV1(maintenance)}catch{refused=true}
    process.stdout.write(JSON.stringify({refused,replaced,second:fs.existsSync(root+'/owner-0002.json')}));`);
  assert.deepEqual(result, { refused: true, replaced: true, second: false });
}));

test("missing compiled owner records cannot fall back to source code", () => fixture((home, checkout) => {
  fs.unlinkSync(path.join(checkout, "dist/internal-production/baseline-deployment-cutover-records-v1.js"));
  const child = spawnSync(process.execPath, ["--input-type=module", "-e", program(home, checkout, "")], { encoding: "utf8", env: {}, timeout: 15000 });
  assert.notEqual(child.status, 0); assert.match(child.stderr, /DEPLOYMENT_CUTOVER_OWNER_REFUSED/);
  assert.equal(fs.existsSync(path.join(home, "ai/setrox/data/internal-production-baseline/deployment-cutover-owner-v1")), false);
}));

test("two real concurrent controllers cannot both hold a current owner capability", () => fixture((home, checkout) => {
  const childProgram = program(home, checkout, `let success=false;try{await module.acquireDeploymentCutoverOwnerV1(maintenance);success=true}catch{}
    process.stdout.write(JSON.stringify({success})+'\\n');if(success){process.stdin.resume();process.stdin.once('data',()=>process.exit(0))}`);
  const result = run(home, checkout, `const {spawn}=await import('node:child_process');
    const children=[0,1].map(()=>{const child=spawn(process.execPath,['--input-type=module','-e',${JSON.stringify(childProgram)}],{env:{},stdio:['pipe','pipe','pipe']});
      child.stdin.on('error',()=>{});const exit=new Promise(resolve=>child.once('exit',resolve));let stderr='';child.stderr.on('data',bytes=>stderr+=bytes);
      const result=new Promise((resolve,reject)=>{let text='';child.stdout.on('data',bytes=>{text+=bytes;if(text.includes('\\n'))resolve(JSON.parse(text.trim()))});child.once('exit',()=>{if(!text.includes('\\n'))reject(Error(stderr||'early exit'))})});return {child,exit,result}});
    const results=await Promise.all(children.map(child=>child.result));
    const count=fs.existsSync(root)?fs.readdirSync(root).filter(name=>/^owner-/.test(name)).length:0;
    for(const value of children)value.child.stdin.end('done');await Promise.all(children.map(child=>child.exit));
    process.stdout.write(JSON.stringify({successes:results.filter(value=>value.success).length,count}));`);
  assert.ok(result.successes <= 1, JSON.stringify(result)); assert.ok(result.count <= 1, JSON.stringify(result));
}));

test("first publication refuses changed absent-store ancestry before creating a root", () => fixture((home, checkout) => {
  const result = run(home, checkout, `const baseline=root.slice(0,root.lastIndexOf('/')),open=fs.openSync,close=fs.closeSync;
    let opens=0,chosen=null,replaced=false;
    fs.openSync=(target,...args)=>{const fd=open(target,...args);if(target===baseline&&++opens===2)chosen=fd;return fd};
    fs.closeSync=fd=>{const result=close(fd);if(fd===chosen&&!replaced){replaced=true;
      fs.renameSync(baseline,baseline+'.retained');fs.mkdirSync(baseline,{mode:0o700});}return result};
    let refused=false;try{await module.acquireDeploymentCutoverOwnerV1(maintenance)}catch{refused=true}
    process.stdout.write(JSON.stringify({refused,replaced,exists:fs.existsSync(root)}));`);
  assert.deepEqual(result, { refused: true, replaced: true, exists: false });
}));
