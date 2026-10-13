import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const labels = ["com.setrox.setfarm-spawner", "com.setrox.setfarm-dashboard"];
const exportsV2 = ["holdDashboardCutoverLauncherMaterialV2", "assertHeldDashboardCutoverLauncherMaterialV2",
  "withHeldDashboardCutoverLauncherPre32V2", "closeHeldDashboardCutoverLauncherMaterialV2"];
// Private FS is real. Loaded launchctl output and the PG composition port are
// source-fault fixtures, NOT real phase/PG/source-build/effect qualification.
function fixture(action: string, setup = ""): any {
  const home = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "dashboard-material-v2-")));
  const directory = path.join(home, "Library", "LaunchAgents");
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  const texts = labels.map((label, index) => {
    const program = path.join(home, ".local", "bin", "setfarm");
    const args = index ? [program, "dashboard", "start", "--port", "3333"] : [program, "spawner", "start"];
    const env: Record<string, string> = { PATH: "/usr/local/bin:/usr/bin:/bin", SETFARM_PG_URL: "postgresql://fixture_PG_SENTINEL@localhost/setfarm" };
    if (index) env.SETFARM_OPERATIONAL_WRITE_TOKEN = "TOKEN_SENTINEL";
    const log = path.join(home, ".openclaw", "logs", index ? "setfarm-dashboard.watch" : "setfarm-spawner.watch");
    const target = path.join(directory, `${label}.plist`);
    fs.writeFileSync(target, execFileSync("/usr/bin/plutil", ["-convert", "xml1", "-o", "-", "-"], {
      input: JSON.stringify({ Label: label, ProgramArguments: args, EnvironmentVariables: env, RunAtLoad: true,
        StartInterval: 60, StandardOutPath: `${log}.log`, StandardErrorPath: `${log}.err.log` }),
    }), { mode: 0o600 });
    const block = (name: string, lines: string[]) => `\t${name} = {\n${lines.map(line => `\t\t${line}\n`).join("")}\t}\n`;
    return `gui/${process.getuid!()}/${label} = {\n\tpath = ${target}\n\tprogram = ${program}\n\tstate = not running\n\tactive count = 0\n\ttype = LaunchAgent\n\trun interval = 60 seconds\n\tproperties = runatload\n`
      + block("arguments", args) + block("environment", Object.entries({ ...env, OSLogRateLimit: "64", XPC_SERVICE_NAME: label }).map(([k, v]) => `${k} => ${v}`))
      + block("inherited environment", ["SSH_AUTH_SOCK => /var/run/com.apple.launchd.Fixture/Listeners"])
      + block("default environment", ["PATH => /usr/bin:/bin:/usr/sbin:/sbin"]) + "}\n";
  });
  try {
    const sourceUrl = new URL("../../src/internal-production/baseline-deployment-cutover-launcher-observation-v1.ts", import.meta.url);
    let source = fs.readFileSync(sourceUrl, "utf8");
    const marker = 'await import("./baseline-legacy-database-census-v1.js")';
    assert.equal(source.split(marker).length, 2);
    const port = path.join(home, "pre32-port.mjs");
    fs.writeFileSync(port, `export async function withHeldDashboardCutoverPre32DatabaseV2(url,callback){
      globalThis.dbCalls++;globalThis.urlMatched=url==='postgresql://fixture_PG_SENTINEL@localhost/setfarm';
      if(!globalThis.urlMatched)throw Error('PRIVATE_PG_SENTINEL_WRONG_URL');
      if(globalThis.dbFailure)throw Error('PRIVATE_PG_SENTINEL_FAILURE');
      const work=callback(Object.freeze(Object.create(null)),Object.freeze({activeRunCount:0}));
      if(globalThis.connectionLoss){await globalThis.started;Promise.resolve(work).catch(()=>{});throw Error('PRIVATE_PG_SENTINEL_CONNECTION_LOSS')}
      return await work;
    }`);
    source = source.replace(marker, `await import(${JSON.stringify(pathToFileURL(port).href)})`);
    for (const name of ["baseline-deployment-cutover-node-path-v1", "baseline-deployment-cutover-process-observation-v1"])
      source = source.replace(JSON.stringify(`./${name}.js`), JSON.stringify(new URL(`../../src/internal-production/${name}.ts`, import.meta.url).href));
    source = source.replace('"../product-compiler/canonical-json.js"', JSON.stringify(new URL("../../src/product-compiler/canonical-json.ts", import.meta.url).href));
    const fixturePath = path.join(home, "material-fixture.ts");
    fs.writeFileSync(path.join(home, "package.json"), '{"type":"module"}');
    fs.writeFileSync(fixturePath, source);
    const child = spawnSync(process.execPath, ["--import", "tsx", "--input-type=module", "-e", `
      import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import cp from 'node:child_process';
      import {syncBuiltinESMExports} from 'node:module';
      const home=${JSON.stringify(home)},texts=${JSON.stringify(texts)},labels=${JSON.stringify(labels)};
      const originalAccount=os.userInfo();let account={...originalAccount,homedir:home},onAccount=null;
      os.userInfo=()=>{onAccount?.();return {...account}};
      const spawn=cp.spawnSync;let prints=0,forbidPrint=false;
      cp.spawnSync=(command,args,options)=>{
        if(command==='/bin/launchctl'){
          assert.equal(forbidPrint,false,'MATERIAL_ASSERT_CALLED_LAUNCHCTL');
          assert.deepEqual(args,['print','gui/'+process.getuid()+'/'+labels[labels.findIndex(label=>args[1].endsWith('/'+label))]]);
          prints++;return{status:0,signal:null,stdout:Buffer.from(texts[labels.findIndex(label=>args[1].endsWith('/'+label))]),stderr:Buffer.alloc(0)};
        }
        assert.equal(command,'/usr/bin/plutil');return spawn(command,args,options);
      };
      syncBuiltinESMExports();
      const module=await import(${JSON.stringify(pathToFileURL(fixturePath).href)});
      for(const name of ${JSON.stringify(exportsV2)})if(typeof module[name]!=='function')throw Error('MISSING_LAUNCHER_MATERIAL_EXPORT');
      const rawHold=module.holdDashboardCutoverLauncherMaterialV2,check=module.assertHeldDashboardCutoverLauncherMaterialV2,
        bridge=module.withHeldDashboardCutoverLauncherPre32V2,close=module.closeHeldDashboardCutoverLauncherMaterialV2;
      const open=fs.openSync,shut=fs.closeSync,stat=fs.lstatSync;const originals=[],closed=[];let onStat=null,onClose=null,closeFault=false,tracking=false;
      const hold=(...args)=>{tracking=true;try{return rawHold(...args)}finally{tracking=false}};
      fs.openSync=(...args)=>{const fd=open(...args);if(tracking)originals.push(fd);return fd};
      fs.closeSync=fd=>{const original=originals.includes(fd);if(original){closed.push(fd);if(onClose){const callback=onClose;onClose=null;callback()}}const result=shut(fd);if(original&&closeFault){closeFault=false;throw Error('PRIVATE_CLOSE_RESPONSE_LOSS')}return result};
      fs.lstatSync=(...args)=>{if(onStat){const callback=onStat;onStat=null;callback()}return stat(...args)};
      syncBuiltinESMExports();globalThis.dbCalls=0;globalThis.urlMatched=false;
      ${setup}
      ${action}
      process.stdout.write(JSON.stringify({ok:true,prints,opens:originals.length,closes:closed.length,dbCalls:globalThis.dbCalls}));
    `], { encoding: "utf8", env: {}, timeout: 15000 });
    assert.equal(child.status, 0, child.stderr);
    const result = JSON.parse(child.stdout);
    assert.doesNotMatch(child.stdout, /PG_SENTINEL|TOKEN_SENTINEL|Fixture\/Listeners/);
    return result;
  } finally { fs.rmSync(home, { recursive: true, force: true }); }
}

test("retained material survives loaded-job changes without launchctl or credential exposure", () => {
  const result = fixture(`const cap=hold();assert(Object.isFrozen(cap));assert.equal(Object.getPrototypeOf(cap),null);assert.deepEqual(Reflect.ownKeys(cap),[]);
    assert.equal(prints,4);forbidPrint=true;check(cap);
    const answer=await bridge(cap,async(scope,census)=>{assert(Object.isFrozen(scope));assert(Object.isFrozen(census));await Promise.resolve();return 42});
    assert.equal(answer,42);assert.equal(globalThis.urlMatched,true);check(cap);close(cap);
    assert.deepEqual(closed,[...originals].reverse());for(const fd of originals)assert.throws(()=>fs.fstatSync(fd),{code:'EBADF'});`);
  assert.equal(result.prints, 4); assert.equal(result.dbCalls, 1);
});

test("zero-input and idle hostile handles refuse before ports without consuming valid custody", () => fixture(`
  assert.throws(()=>hold({}));assert.equal(originals.length,0);const cap=hold();let traps=0;
  const proxy=new Proxy({}, {get(){traps++;throw Error('TRAP')},getPrototypeOf(){traps++;throw Error('TRAP')},ownKeys(){traps++;throw Error('TRAP')}});
  const before=originals.length;for(const foreign of [null,undefined,0,proxy,{...cap}]){assert.throws(()=>check(foreign));assert.throws(()=>close(foreign));await assert.rejects(bridge(foreign,()=>0))}
  const continuation=new Proxy(()=>0,{apply(){traps++;throw Error('TRAP')},get(){traps++;throw Error('TRAP')}});
  await assert.rejects(bridge(cap,continuation));assert.equal(traps,0);assert.equal(globalThis.dbCalls,0);assert.equal(originals.length,before);
  check(cap);assert.throws(()=>hold());close(cap);const count=closed.length;close(cap);assert.equal(closed.length,count);`));

for (const drift of ["bytes", "replacement", "account"]) test(`material ${drift} drift is sticky without loaded rechecks`, () => fixture(`
  const cap=hold();forbidPrint=true;const target=home+'/Library/LaunchAgents/'+labels[0]+'.plist',bytes=fs.readFileSync(target);
  const previous=account;
  if(${JSON.stringify(drift)}==='bytes')fs.appendFileSync(target,'\\n');
  else if(${JSON.stringify(drift)}==='replacement'){fs.renameSync(target,target+'.original');fs.writeFileSync(target,bytes,{mode:0o600})}
  else account={...account,username:'changed'};
  assert.throws(()=>check(cap));
  if(${JSON.stringify(drift)}==='bytes')fs.writeFileSync(target,bytes);else if(${JSON.stringify(drift)}==='replacement'){fs.unlinkSync(target);fs.renameSync(target+'.original',target)}else account=previous;
  assert.throws(()=>check(cap));await assert.rejects(bridge(cap,()=>0));assert.equal(globalThis.dbCalls,0);close(cap);assert.deepEqual(closed,[...originals].reverse());`));

test("private bridge failure is sanitized and burns material custody", () => fixture(`const cap=hold();globalThis.dbFailure=true;
  await assert.rejects(bridge(cap,()=>0),error=>{assert.doesNotMatch(String(error),/PG_SENTINEL/);return true});
  assert.equal(globalThis.dbCalls,1);globalThis.dbFailure=false;assert.throws(()=>check(cap));await assert.rejects(bridge(cap,()=>0));assert.equal(globalThis.dbCalls,1);close(cap);`));

test("callback settlement cannot return after original plist drift", () => fixture(`const cap=hold();const target=home+'/Library/LaunchAgents/'+labels[1]+'.plist';
  await assert.rejects(bridge(cap,async()=>{await Promise.resolve();fs.appendFileSync(target,'\\n');return 1}));assert.throws(()=>check(cap));close(cap);`));

for (const foreign of [false, true]) test(`swallowed ${foreign ? "foreign-proxy" : "original"} assertion reentry burns before bridge`, () => fixture(`
  const cap=hold();let nested=false,traps=0;const other=${foreign}?new Proxy({}, {get(){traps++;throw Error('TRAP')}}):cap;
  onStat=()=>{try{check(other)}catch{nested=true}};assert.throws(()=>check(cap));assert(nested);assert.equal(traps,0);
  await assert.rejects(bridge(cap,()=>0));assert.equal(globalThis.dbCalls,0);close(cap);`));

test("active close burns without closing originals under a trusted continuation", () => fixture(`const cap=hold();
  await assert.rejects(bridge(cap,async()=>{assert.throws(()=>close(cap));assert.equal(closed.length,0);await Promise.resolve();return 1}));
  assert.throws(()=>check(cap));assert.equal(closed.length,0);close(cap);assert.deepEqual(closed,[...originals].reverse());`));

test("early PG failure retains original callback custody until genuine settlement", () => fixture(`const cap=hold();let release,started,finished;
  globalThis.started=new Promise(resolve=>{started=resolve});const wait=new Promise(resolve=>{release=resolve});
  const done=new Promise(resolve=>{finished=resolve});globalThis.connectionLoss=true;
  await assert.rejects(bridge(cap,async()=>{started();await wait;finished();return 1}));
  assert.throws(()=>close(cap));assert.equal(closed.length,0);assert.throws(()=>check(cap));
  release();await done;await new Promise(resolve=>setImmediate(resolve));
  close(cap);assert.deepEqual(closed,[...originals].reverse());const count=closed.length;close(cap);assert.equal(closed.length,count);`));

test("close response loss is sticky and every original close is attempted only once", () => fixture(`const cap=hold();closeFault=true;
  assert.throws(()=>close(cap));assert.deepEqual(closed,[...originals].reverse());const before=closed.length;close(cap);assert.equal(closed.length,before);
  assert.throws(()=>check(cap));assert.throws(()=>hold());`));

for (const operation of ["hold", "assert", "bridge", "close"]) test(`swallowed ${operation} during acquisition burns before minting`, () => fixture(`
  let fired=false,pending=Promise.resolve(),traps=0;const foreign=new Proxy({}, {get(){traps++;throw Error('TRAP')}});
  onStat=()=>{fired=true;const operation=${JSON.stringify(operation)};
    if(operation==='bridge')pending=assert.rejects(bridge(foreign,()=>0));
    else assert.throws(()=>operation==='hold'?hold():operation==='assert'?check(foreign):close(foreign));
  };assert.throws(()=>hold());await pending;assert(fired);assert.equal(traps,0);assert.equal(globalThis.dbCalls,0);
  assert.deepEqual(closed,[...originals].reverse());assert.throws(()=>hold());`));

for (const foreign of [false, true]) test(`active bridge ${foreign ? "foreign-proxy" : "original"} recursion burns original scope`, () => fixture(`
  const cap=hold();let fired=false,traps=0;const other=${foreign}?new Proxy({}, {get(){traps++;throw Error('TRAP')}}):cap;
  await assert.rejects(bridge(cap,async()=>{await assert.rejects(bridge(other,()=>0));fired=true;return 1}));
  assert(fired);assert.equal(traps,0);assert.equal(globalThis.dbCalls,1);assert.throws(()=>check(cap));close(cap);assert.deepEqual(closed,[...originals].reverse());`));

for (const operation of ["hold", "bridge"]) test(`swallowed ${operation} during close consumes cleanup once`, () => fixture(`
  const cap=hold();let fired=false,pending=Promise.resolve();onClose=()=>{fired=true;
    if(${JSON.stringify(operation)}==='bridge')pending=assert.rejects(bridge(cap,()=>0));else assert.throws(()=>hold());
  };assert.throws(()=>close(cap));await pending;assert(fired);assert.deepEqual(closed,[...originals].reverse());
  const count=closed.length;close(cap);assert.equal(closed.length,count);assert.throws(()=>check(cap));assert.equal(globalThis.dbCalls,0);`));

test("material ancestor replacement burns without reacquiring the original pins", () => fixture(`
  const cap=hold();const target=home+'/Library';fs.renameSync(target,target+'.original');fs.mkdirSync(target,{mode:0o700});
  assert.throws(()=>check(cap));fs.rmdirSync(target);fs.renameSync(target+'.original',target);assert.throws(()=>check(cap));
  close(cap);assert.deepEqual(closed,[...originals].reverse());`));

test("crossed privately configured URLs refuse before handle mint or PG acquisition", () => fixture(`
  const target=home+'/Library/LaunchAgents/'+labels[1]+'.plist';
  fs.writeFileSync(target,fs.readFileSync(target,'utf8').replace('localhost/setfarm','localhost/other'));
  texts[1]=texts[1].replace('localhost/setfarm','localhost/other');assert.throws(()=>hold());assert.equal(globalThis.dbCalls,0);
  assert.deepEqual(closed,[...originals].reverse());assert.throws(()=>hold());`));

test("swallowed final account-composite reentry cannot return assertion success", () => fixture(`
  const cap=hold();let accountCalls=0,fired=false;
  onAccount=()=>{accountCalls++;if(accountCalls===2){fired=true;assert.throws(()=>check(cap))}};
  assert.throws(()=>check(cap));assert(fired);onAccount=null;assert.throws(()=>check(cap));close(cap);`));

test("acquisition account reentry burns before any configuration resource is acquired", () => fixture(`
  let fired=false;onAccount=()=>{if(!fired){fired=true;assert.throws(()=>hold())}};
  assert.throws(()=>hold());assert(fired);assert.equal(originals.length,0);assert.equal(prints,0);assert.equal(globalThis.dbCalls,0);`));
