import assert from "node:assert/strict";
import fs from "node:fs";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { test } from "node:test";

const index = process.execArgv.indexOf("--import");
const loader = index >= 0 ? process.execArgv[index + 1]! : createRequire(import.meta.url).resolve("tsx");
const source = new URL("../../src/internal-production/baseline-deployment-cutover-launcher-observation-v1.ts", import.meta.url).href;

async function exercise(body: string, setup = ""): Promise<void> {
  const home = fs.mkdtempSync("/private/tmp/setfarm-approved-definition-v4-");
  fs.chmodSync(home, 0o700);
  fs.mkdirSync(home + "/Library/LaunchAgents", { recursive: true, mode: 0o700 });
  fs.mkdirSync(home + "/ai/setrox/data/internal-production-baseline", { recursive: true, mode: 0o700 });
  const program = `import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';
import cp from 'node:child_process';import {syncBuiltinESMExports,registerHooks} from 'node:module';import {pathToFileURL} from 'node:url';
const out={};try{
const home=${JSON.stringify(home)},labels=['com.setrox.setfarm-spawner','com.setrox.setfarm-dashboard'];
const account=os.userInfo();os.userInfo=()=>({...account,homedir:home});
const env={PATH:'/usr/local/bin:/usr/bin:/bin',SETFARM_PG_URL:'postgresql://fixture_PG_SENTINEL@localhost/setfarm'};
const definitions=labels.map((Label,i)=>({Label,
ProgramArguments:[home+'/.local/bin/setfarm',...(i?['dashboard','start','--port','3333']:['spawner','start'])],
EnvironmentVariables:{...env,...(i?{SETFARM_OPERATIONAL_WRITE_TOKEN:'TOKEN_SENTINEL'}:{})},RunAtLoad:true,StartInterval:60,
StandardOutPath:home+'/.openclaw/logs/'+(i?'setfarm-dashboard.watch':'setfarm-spawner.watch')+'.log',
StandardErrorPath:home+'/.openclaw/logs/'+(i?'setfarm-dashboard.watch':'setfarm-spawner.watch')+'.err.log'}));
${setup}
const originalFiles=labels.map((label,i)=>{const path=home+'/Library/LaunchAgents/'+label+'.plist';
fs.writeFileSync(path,JSON.stringify(definitions[i]),{flag:'wx',mode:0o600});return {path,bytes:fs.readFileSync(path),ino:fs.statSync(path,{bigint:true}).ino}});
const block=(name,lines)=>'\\t'+name+' = {\\n'+lines.map(line=>'\\t\\t'+line+'\\n').join('')+'\\t}\\n';
const text=i=>'gui/'+process.getuid()+'/'+labels[i]+' = {\\n\\tpath = '+originalFiles[i].path+'\\n\\tprogram = '+definitions[i].ProgramArguments[0]+
'\\n\\tstate = not running\\n\\tactive count = 0\\n\\ttype = LaunchAgent\\n\\trun interval = 60 seconds\\n\\tproperties = runatload\\n'+
block('arguments',definitions[i].ProgramArguments)+block('environment',Object.entries({...definitions[i].EnvironmentVariables,OSLogRateLimit:'64',XPC_SERVICE_NAME:labels[i]}).map(([k,v])=>k+' => '+v))+
block('inherited environment',['SSH_AUTH_SOCK => /var/run/com.apple.launchd.Fixture/Listeners'])+block('default environment',['PATH => /usr/bin:/bin:/usr/sbin:/sbin'])+'}\\n';
const spawnSync=cp.spawnSync;let prints=0;cp.spawnSync=(file,args,options)=>{
if(file==='/bin/launchctl'){assert.equal(args[0],'print');const i=labels.findIndex(label=>args[1]==='gui/'+process.getuid()+'/'+label);
assert.ok(i>=0);prints++;return {status:0,signal:null,stdout:Buffer.from(text(i)),stderr:Buffer.alloc(0)}}
assert.equal(file,'/usr/bin/plutil');assert.deepEqual(args,['-convert','json','-o','-','-']);assert.ok(Buffer.isBuffer(options.input));
return spawnSync(file,args,options)};
for(const name of ['spawn','exec','execFile','fork','spawnSyncUnused','execSync','execFileSync'])cp[name]=()=>{throw Error('UNEXPECTED_PROCESS_'+name)};
globalThis.fetch=()=>{throw Error('UNEXPECTED_HTTP')};syncBuiltinESMExports();
fs.writeFileSync(home+'/pre32-port.mjs',\`export async function withHeldDashboardCutoverPre32DatabaseV2(url,callback){
globalThis.pre32Calls=(globalThis.pre32Calls??0)+1;
if(url!=='postgresql://fixture_PG_SENTINEL@localhost/setfarm')throw Error('UNEXPECTED_FIXTURE_URL');
const work=callback(Object.freeze(Object.create(null)),Object.freeze({activeRunCount:0}));
if(globalThis.earlyLoss){await globalThis.started;Promise.resolve(work).catch(()=>{});throw Error('INERT_DRIVER_LOSS')}
return await work}\`,{flag:'wx',mode:0o600});
registerHooks({resolve(specifier,context,next){
if(specifier.includes('baseline-legacy-database-census-v1'))return {url:pathToFileURL(home+'/pre32-port.mjs').href,shortCircuit:true};
if(specifier==='postgres'||specifier==='pg')throw Error('UNEXPECTED_DATABASE_IMPORT');return next(specifier,context)}});
const m=await import(${JSON.stringify(source)});
const rawHold=m.holdDashboardCutoverApprovedDefinitionV4,check=m.assertHeldDashboardCutoverApprovedDefinitionV4,
close=m.closeHeldDashboardCutoverApprovedDefinitionV4;
for(const [name,fn] of Object.entries({hold:rawHold,check,close}))assert.equal(typeof fn,'function','missing approved-definition interface '+name);
const original=m.holdDashboardCutoverLauncherMaterialV2();assert.equal(prints,4);
const open=fs.openSync,shut=fs.closeSync,opened=[],closed=[];let created,tracking=false;
const hold=(...args)=>{tracking=true;try{return rawHold(...args)}finally{tracking=false}};
fs.openSync=(...args)=>{const fd=open(...args);if(tracking){opened.push(fd);if(args[1]&fs.constants.O_CREAT)created=String(args[0])}return fd};
fs.closeSync=fd=>{if(opened.includes(fd))closed.push(fd);return shut(fd)};
syncBuiltinESMExports();const refused='DASHBOARD_CUTOVER_APPROVED_DEFINITION_REFUSED';
${body}
for(const original of originalFiles){assert.ok(fs.readFileSync(original.path).equals(original.bytes));assert.equal(fs.statSync(original.path,{bigint:true}).ino,original.ino)}
assert.equal(prints,4);out.passed=true}catch(e){out.error=e.message??String(e)}process.stdout.write(JSON.stringify(out));`;
  fs.writeFileSync(home + "/intent.json", JSON.stringify({ program, loader }), { flag: "wx", mode: 0o600 });
  const child = spawn(process.execPath, ["--import", loader, "--input-type=module", "-e", program],
    { cwd: home, env: {}, stdio: ["ignore", "pipe", "pipe"] });
  let stdout = "", stderr = "", unknown: Error | undefined;
  const ends = { stdout: false, stderr: false }, closes = { stdout: false, stderr: false };
  child.on("error", error => { unknown ??= error; });
  for (const [stream, name] of [[child.stdout, "stdout"], [child.stderr, "stderr"]] as const) {
    stream.on("error", error => { unknown ??= error; });stream.on("end", () => { ends[name] = true; });
    stream.on("close", () => { closes[name] = true; });stream.on("data", chunk => { if (name === "stdout") stdout += chunk; else stderr += chunk; });
  }
  const [status, signal] = await new Promise<[number | null, NodeJS.Signals | null]>(resolve => child.on("close", (code, sig) => resolve([code, sig])));
  fs.writeFileSync(home + "/result.json", JSON.stringify({ stdout, stderr, status, signal, ends, closes }), { flag: "wx", mode: 0o600 });
  console.log(JSON.stringify({ home, status, signal, ends, closes }));
  assert.equal(unknown, undefined);assert.equal(status, 0, stderr);assert.equal(signal, null);
  assert.deepEqual(ends, { stdout: true, stderr: true });assert.deepEqual(closes, { stdout: true, stderr: true });assert.equal(stderr, "");
  const result = JSON.parse(stdout);assert.equal(result.error, undefined, result.error);assert.equal(result.passed, true);
}

test("opaque approved derivative preserves seven original values and only adds fixed job endpoint", async () => {
  await exercise(`const definition=hold(original);check(definition);
assert.equal(Object.getPrototypeOf(definition),null);assert.ok(Object.isFrozen(definition));assert.deepEqual(Reflect.ownKeys(definition),[]);
assert.ok(created.startsWith(home+'/ai/setrox/data/internal-production-baseline/dashboard-cutover-approved-definitions-v4/'));
assert.equal(created.split('/').at(-1),'com.setrox.setfarm-dashboard.plist');assert.equal(fs.statSync(created).mode&0o777,0o600);
const result=cp.spawnSync('/usr/bin/plutil',['-convert','json','-o','-','-'],{input:fs.readFileSync(created),encoding:'buffer'});
assert.equal(result.status,0);assert.equal(result.signal,null);assert.equal(result.stderr.length,0);
assert.deepEqual(JSON.parse(result.stdout),{...definitions[1],MachServices:{'com.setrox.setfarm.dashboard-cutover.job.v4':{ResetAtClose:true}}});
close(definition);assert.deepEqual(closed,[...opened].reverse());const count=closed.length;close(definition);assert.equal(closed.length,count);
m.assertHeldDashboardCutoverLauncherMaterialV2(original);`);
});

test("foreign proxy and extra arguments refuse before artifact ports without consuming genuine material", async () => {
  await exercise(`let traps=0;const proxy=new Proxy({}, {get(){traps++;throw Error('TRAP')},getPrototypeOf(){traps++;throw Error('TRAP')}});
for(const input of [{},proxy])assert.throws(()=>hold(input),{message:refused});
assert.throws(()=>hold(original,{}),{message:refused});assert.equal(opened.length,0);
const definition=hold(original);const count=opened.length;
assert.throws(()=>check({...definition}),{message:refused});assert.throws(()=>check(proxy),{message:refused});
assert.throws(()=>close(proxy),{message:refused});assert.equal(opened.length,count);assert.equal(closed.length,0);assert.equal(traps,0);
check(definition);close(definition);m.assertHeldDashboardCutoverLauncherMaterialV2(original);`);
});

test("every V4 interface rejects wrong-instance and nonexact arity before consuming genuine custody", async () => {
  await exercise(`const other=await import(${JSON.stringify(source + "?independent-v4-instance")});
const definition=hold(original),own=[...opened];
for(const args of [[],[definition,{}]]){assert.throws(()=>check(...args),{message:refused});assert.throws(()=>close(...args),{message:refused})}
assert.throws(()=>hold(),{message:refused});assert.throws(()=>other.holdDashboardCutoverApprovedDefinitionV4(original),{message:refused});
assert.throws(()=>other.assertHeldDashboardCutoverApprovedDefinitionV4(definition),{message:refused});
assert.throws(()=>other.closeHeldDashboardCutoverApprovedDefinitionV4(definition),{message:refused});
assert.deepEqual(closed.filter(fd=>own.includes(fd)),[]);check(definition);close(definition);
assert.deepEqual(closed.filter(fd=>own.includes(fd)),own.reverse());m.assertHeldDashboardCutoverLauncherMaterialV2(original);`);
});

test("one derivative attempt cannot be repeated before or after original derivative close", async () => {
  await exercise(`const definition=hold(original),count=opened.length;
assert.throws(()=>hold(original),{message:refused});assert.equal(opened.length,count);check(definition);close(definition);
assert.throws(()=>hold(original),{message:refused});assert.equal(opened.length,count);m.assertHeldDashboardCutoverLauncherMaterialV2(original);`);
});

for (const drift of ["account", "ancestor", "inode"]) test(`approved derivative ${drift} drift is sticky without adoption`, async () => {
  await exercise(`const definition=hold(original),own=[...opened];
if(${JSON.stringify(drift)}==='account'){os.userInfo=()=>({...account,homedir:home,username:'changed'});syncBuiltinESMExports()}
else if(${JSON.stringify(drift)}==='ancestor'){const ancestor=home+'/ai/setrox/data';
fs.renameSync(ancestor,ancestor+'.retained-original');fs.mkdirSync(ancestor,{mode:0o700})}
else{const bytes=fs.readFileSync(created);fs.renameSync(created,created+'.retained-original');fs.writeFileSync(created,bytes,{flag:'wx',mode:0o600})}
assert.throws(()=>check(definition),{message:refused});assert.throws(()=>check(definition),{message:refused});
close(definition);assert.deepEqual(closed,own.reverse());assert.throws(()=>hold(original),{message:refused});`);
});

test("finite short writes complete exact bytes before publication", async () => {
  await exercise(`const write=fs.writeSync,sync=fs.fsyncSync,syncs=[];let calls=0;fs.writeSync=(fd,bytes,offset,length,position)=>{
calls++;return write(fd,bytes,offset,Math.min(length,97),position)};
fs.fsyncSync=fd=>{syncs.push(fd);return sync(fd)};
const definition=hold(original);assert.ok(calls>1);assert.deepEqual(syncs,[...opened].slice(-4).reverse());check(definition);
const result=cp.spawnSync('/usr/bin/plutil',['-convert','json','-o','-','-'],{input:fs.readFileSync(created),encoding:'buffer'});
assert.equal(result.status,0);assert.deepEqual(JSON.parse(result.stdout),{...definitions[1],MachServices:{'com.setrox.setfarm.dashboard-cutover.job.v4':{ResetAtClose:true}}});close(definition);`);
});

test("fallible file sealing retains already returned original FDs and prevents publication", async () => {
  await exercise(`const fstat=fs.fstatSync;let fired=false;fs.fstatSync=(fd,...args)=>{
if(created&&opened.at(-1)===fd){fired=true;throw Error('INERT_FILE_SEAL_FAILURE')}return fstat(fd,...args)};
assert.throws(()=>hold(original),{message:refused});assert.equal(fired,true);assert.equal(closed.length,0);
fs.fstatSync=fstat;assert.equal(fs.statSync(created).size,0);for(const fd of opened)assert.doesNotThrow(()=>fs.fstatSync(fd));
const count=opened.length;assert.throws(()=>hold(original),{message:refused});assert.equal(opened.length,count);`);
});

for (const operation of ["hold", "check", "close"]) test(`swallowed ${operation} during derivative acquisition denies further original ports`, async () => {
  await exercise(`const fstat=fs.fstatSync;let fired=false,after=0,traps=0;
const foreign=new Proxy({}, {get(){traps++;throw Error('TRAP')}});
fs.fstatSync=(fd,...args)=>{if(!fired&&opened.includes(fd)){fired=true;
assert.throws(()=>${operation}(foreign),{message:refused})}else if(fired&&opened.includes(fd))after++;return fstat(fd,...args)};
assert.throws(()=>hold(original),{message:refused});assert.equal(fired,true);assert.equal(after,0);assert.equal(traps,0);
assert.equal(closed.length,0);fs.fstatSync=fstat;for(const fd of opened)assert.doesNotThrow(()=>fs.fstatSync(fd));`);
});

test("swallowed assertion during derivative cleanup consumes every original only once", async () => {
  await exercise(`const definition=hold(original),primitive=fs.closeSync;let fired=false;
fs.closeSync=fd=>{if(!fired){fired=true;assert.throws(()=>check(definition),{message:refused})}return primitive(fd)};
assert.throws(()=>close(definition),{message:refused});assert.equal(fired,true);assert.deepEqual(closed,[...opened].reverse());
const count=closed.length;close(definition);assert.equal(closed.length,count);assert.throws(()=>check(definition),{message:refused});`);
});

for (const key of ["MachServices", "Sockets"]) test(`old V1/V2 material parsing still rejects ${key}`, async () => {
  await exercise(`const target=originalFiles[1],bytes=fs.readFileSync(target.path);
fs.writeFileSync(target.path,JSON.stringify({...definitions[1],${JSON.stringify(key)}:{unexpected:true}}));
assert.throws(()=>m.observeDeploymentCutoverLauncherConfigurationV1());
const other=await import(${JSON.stringify(source)}+'?old-parser-'+${JSON.stringify(key)});
assert.throws(()=>other.holdDashboardCutoverLauncherMaterialV2());fs.writeFileSync(target.path,bytes);
assert.equal(created,undefined);`, "");
});

test("unsupported XML control in genuine original material refuses before derivative artifact ports", async () => {
  await exercise(`assert.throws(()=>hold(original),{message:refused});assert.equal(opened.length,0);assert.equal(created,undefined);`,
    `definitions[1].EnvironmentVariables.SETFARM_OPERATIONAL_WRITE_TOKEN='TOKEN'+String.fromCharCode(1);`);
});

test("escaped derivative exceeding fixed byte bound refuses before artifact ports", async () => {
  await exercise(`assert.throws(()=>hold(original),{message:refused});assert.equal(opened.length,0);assert.equal(created,undefined);`,
    `definitions[1].EnvironmentVariables.SETFARM_OPERATIONAL_WRITE_TOKEN='&'.repeat(215000);`);
});

test("zero-progress write refuses without a loop or replacement acquisition", async () => {
  await exercise(`let calls=0;fs.writeSync=()=>{calls++;return 0};
assert.throws(()=>hold(original),{message:refused});assert.equal(calls,1);assert.equal(fs.statSync(created).size,0);
assert.equal(closed.length,0);assert.throws(()=>hold(original),{message:refused});assert.equal(calls,1);`);
});

test("missing required baseline is not silently created by derivative preparation", async () => {
  await exercise(`const baseline=home+'/ai/setrox/data/internal-production-baseline';fs.renameSync(baseline,baseline+'.retained-original');
assert.throws(()=>hold(original),{message:refused});assert.equal(fs.existsSync(baseline),false);assert.equal(created,undefined);
assert.equal(closed.length,0);assert.throws(()=>hold(original),{message:refused});assert.equal(fs.existsSync(baseline),false);`);
});

test("private XML renderer mechanics reject malformed surrogates and preserve CR without claiming genuine V2 input", async () => {
  await exercise(`let rendererSource=fs.readFileSync(new URL(${JSON.stringify(source)}),'utf8');
for(const [specifier,file] of [
['./baseline-deployment-cutover-node-path-v1.js','../../src/internal-production/baseline-deployment-cutover-node-path-v1.ts'],
['./baseline-deployment-cutover-process-observation-v1.js','../../src/internal-production/baseline-deployment-cutover-process-observation-v1.ts'],
['../product-compiler/canonical-json.js','../../src/product-compiler/canonical-json.ts']]){
const target=new URL(file,${JSON.stringify(new URL("./", import.meta.url).href)}).href;
assert.ok(rendererSource.includes(JSON.stringify(specifier)));rendererSource=rendererSource.replace(JSON.stringify(specifier),JSON.stringify(target))}
fs.writeFileSync(home+'/package.json','{"type":"module"}',{flag:'wx',mode:0o600});
const copied=home+'/private-renderer-fixture.ts';fs.writeFileSync(copied,rendererSource+'\\nexport {approvedDefinitionXmlV4 as fixtureRendererOnly};\\n',{flag:'wx',mode:0o600});
const {fixtureRendererOnly:render}=await import(pathToFileURL(copied).href);
for(const value of [String.fromCharCode(0),String.fromCharCode(0xd800),String.fromCharCode(0xdc00),String.fromCharCode(0xfffe)])
assert.throws(()=>render({value}),{message:refused});
const input={value:'CR'+String.fromCharCode(13,10,9)+' & < > 漢🙂',truth:true,interval:60};
const bytes=render(input),result=cp.spawnSync('/usr/bin/plutil',['-convert','json','-o','-','-'],{input:bytes,encoding:'buffer'});
assert.equal(result.status,0);assert.equal(result.signal,null);assert.equal(result.stderr.length,0);
assert.deepEqual(JSON.parse(result.stdout),input);assert.ok(bytes.includes(Buffer.from('&#13;')));
assert.throws(()=>render({value:'&'.repeat(215000)}),{message:refused});
assert.equal(opened.length,0);assert.equal(created,undefined);m.assertHeldDashboardCutoverLauncherMaterialV2(original);`);
});

test("approved derivative XML independently preserves entity characters and supplementary Unicode", async () => {
  await exercise(`const definition=hold(original);check(definition);
const result=cp.spawnSync('/usr/bin/plutil',['-convert','json','-o','-','-'],{input:fs.readFileSync(created),encoding:'buffer'});
assert.equal(result.status,0);assert.equal(JSON.parse(result.stdout).EnvironmentVariables.SETFARM_OPERATIONAL_WRITE_TOKEN,
'TOKEN & < > \\" \\' 漢🙂');close(definition);`,
    `definitions[1].EnvironmentVariables.SETFARM_OPERATIONAL_WRITE_TOKEN='TOKEN & < > \\" \\' 漢🙂';`);
});

test("swallowed assertion reentry from a new FD observation denies the next derivative port", async () => {
  await exercise(`const definition=hold(original),fstat=fs.fstatSync,lstat=fs.lstatSync;let fired=false,after=0;
fs.fstatSync=(fd,...args)=>{if(!fired&&opened.includes(fd)){fired=true;assert.throws(()=>check(definition),{message:refused})}
else if(fired&&opened.includes(fd))after++;return fstat(fd,...args)};
fs.lstatSync=(...args)=>{if(fired)after++;return lstat(...args)};
assert.throws(()=>check(definition),{message:refused});assert.equal(fired,true);assert.equal(after,0,'no next derivative port after burn');
fs.fstatSync=fstat;fs.lstatSync=lstat;close(definition);`);
});

test("same-size corruption after a partial write refuses before the first sync port", async () => {
  await exercise(`const write=fs.writeSync,sync=fs.fsyncSync;let corrupt=false,syncs=0;
fs.writeSync=(fd,bytes,offset,length,position)=>{const count=write(fd,bytes,offset,length,position);
if(!corrupt){corrupt=true;write(fd,Buffer.from('X'),0,1,0)}return count};
fs.fsyncSync=(...args)=>{syncs++;return sync(...args)};
assert.throws(()=>hold(original),{message:refused});assert.equal(corrupt,true);assert.equal(syncs,0);
assert.ok(created);assert.equal(closed.length,0);for(const fd of opened)assert.doesNotThrow(()=>fs.fstatSync(fd));
assert.throws(()=>hold(original),{message:refused});`);
});

test("staged timestamp drift during file sync cannot be adopted into the sealed original", async () => {
  await exercise(`const sync=fs.fsyncSync;let touched=false;
fs.fsyncSync=(fd)=>{const result=sync(fd);if(!touched){touched=true;const stat=fs.fstatSync(fd);
fs.futimesSync(fd,new Date(stat.atimeMs),new Date(stat.mtimeMs+1000))}return result};
assert.throws(()=>hold(original),{message:refused});assert.equal(touched,true);
assert.equal(closed.length,0);assert.throws(()=>hold(original),{message:refused});`);
});

test("existing collection with special permission bits is not exact private mode", async () => {
  await exercise(`const collection=home+'/ai/setrox/data/internal-production-baseline/dashboard-cutover-approved-definitions-v4';
fs.mkdirSync(collection,{mode:0o700});fs.chmodSync(collection,0o4700);
assert.throws(()=>hold(original),{message:refused});assert.equal(created,undefined);assert.equal(closed.length,0);`);
});

test("original material close invalidates derivative assertion but permits own once-only cleanup", async () => {
  await exercise(`const definition=hold(original),own=[...opened];m.closeHeldDashboardCutoverLauncherMaterialV2(original);
const before=closed.length;assert.throws(()=>check(definition),{message:refused});close(definition);
assert.deepEqual(closed.slice(before),own.reverse());const count=closed.length;close(definition);assert.equal(closed.length,count);
assert.throws(()=>m.assertHeldDashboardCutoverLauncherMaterialV2(original));`);
});

test("derivative byte drift permanently refuses assertion without repairing the artifact", async () => {
  await exercise(`const definition=hold(original);fs.appendFileSync(created,'\\n');
assert.throws(()=>check(definition),{message:refused});assert.throws(()=>check(definition),{message:refused});
close(definition);assert.deepEqual(closed,[...opened].reverse());assert.ok(fs.readFileSync(created).at(-1)===10);`);
});

test("partial write response loss retains actual FDs and artifact and forbids reacquisition", async () => {
  await exercise(`const write=fs.writeSync;let partial=false;
fs.writeSync=(fd,bytes,offset,length,position)=>{write(fd,bytes,offset,Math.min(length,3),position);partial=true;throw Error('INERT_WRITE_RESPONSE_LOSS')};
assert.throws(()=>hold(original),{message:refused});assert.equal(partial,true);assert.equal(fs.statSync(created).size,3);
assert.equal(closed.length,0);for(const fd of opened)assert.doesNotThrow(()=>fs.fstatSync(fd));const count=opened.length;
assert.throws(()=>hold(original),{message:refused});assert.equal(opened.length,count);`);
});

test("sync response loss retains originals without publication or a replacement attempt", async () => {
  await exercise(`const sync=fs.fsyncSync;let syncs=0;fs.fsyncSync=fd=>{syncs++;sync(fd);throw Error('INERT_SYNC_RESPONSE_LOSS')};
assert.throws(()=>hold(original),{message:refused});assert.equal(syncs,1);assert.equal(closed.length,0);assert.ok(created);
for(const fd of opened)assert.doesNotThrow(()=>fs.fstatSync(fd));assert.throws(()=>hold(original),{message:refused});assert.equal(syncs,1);`);
});

test("derivative close response loss consumes each own original once and never retries", async () => {
  await exercise(`const definition=hold(original),primitive=fs.closeSync;let fault=true;
fs.closeSync=fd=>{const result=primitive(fd);if(fault){fault=false;throw Error('INERT_CLOSE_RESPONSE_LOSS')}return result};
assert.throws(()=>close(definition),{message:refused});assert.deepEqual(closed,[...opened].reverse());
const count=closed.length;close(definition);assert.equal(closed.length,count);
assert.throws(()=>check(definition),{message:refused});for(const fd of opened)assert.throws(()=>fs.fstatSync(fd),{code:'EBADF'});`);
});

for (const earlyLoss of [false, true]) test(`V4 public calls retain pending pre32 callback custody${earlyLoss ? " after early driver loss" : ""}`, async () => {
  await exercise(`const definition=hold(original),own=[...opened];let release,entered;const gate=new Promise(r=>{release=r});
globalThis.started=new Promise(r=>{entered=r});globalThis.earlyLoss=${earlyLoss};
const work=m.withHeldDashboardCutoverLauncherPre32V2(original,async()=>{entered();await gate;return 42});
const rejected=assert.rejects(work);await globalThis.started;
${earlyLoss ? "await rejected;" : ""}
assert.throws(()=>hold(original),{message:refused});assert.throws(()=>check(definition),{message:refused});
assert.throws(()=>close(definition),{message:refused});assert.deepEqual(closed.filter(fd=>own.includes(fd)),[]);
release();await rejected;await new Promise(r=>setImmediate(r));close(definition);
assert.deepEqual(closed.filter(fd=>own.includes(fd)),own.reverse());assert.equal(globalThis.pre32Calls,1);`);
});
