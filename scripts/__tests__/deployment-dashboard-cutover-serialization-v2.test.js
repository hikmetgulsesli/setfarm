import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { test } from "node:test";

const moduleUrl = new URL("../deployment-dashboard-cutover-serialization-v2.mjs", import.meta.url).href;
const input = { cutoverIntentHash: "a".repeat(64), ownerClaimHash: "b".repeat(64) };
const refused = /DASHBOARD_CUTOVER_SERIALIZATION_REFUSED/;
const canonical = value => value === null || typeof value !== "object" ? JSON.stringify(value)
  : Array.isArray(value) ? `[${value.map(canonical).join(",")}]`
    : `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`;
function fixture(body) {
  const home = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "dashboard-serialization-v2-")));
  const baseline = path.join(home, "ai/setrox/data/internal-production-baseline");
  fs.mkdirSync(baseline, { recursive: true, mode: 0o700 });
  const root = path.join(baseline, "restart-authority-retirement-v1");
  // Owned private fixtures are retained; never touch existing live authority.
  return body({ home, root, lock: path.join(root, "physical-service-restart-authority.transition.lock") });
}
function run(home, body, setup = "") {
  const script = `
    import fs from "node:fs";import os from "node:os";import childProcess from "node:child_process";
    import {syncBuiltinESMExports} from "node:module";
    const identity=os.userInfo();os.userInfo=()=>({...identity,homedir:${JSON.stringify(home)}});
    const root=${JSON.stringify(path.join(home, "ai/setrox/data/internal-production-baseline/restart-authority-retirement-v1"))};
    const lock=root+"/physical-service-restart-authority.transition.lock";
    const input=${JSON.stringify(input)},output={pid:process.pid};let api;
    const attempt=callback=>{try{callback();return null;}catch(error){return error.message;}};
    ${setup}
    syncBuiltinESMExports();
    try{api=await import(${JSON.stringify(moduleUrl)});${body}}
    catch(error){output.error=error.message;output.code=error.code??null;}
    process.stdout.write(JSON.stringify(output));
  `;
  const child = spawnSync(process.execPath, ["--input-type=module", "-e", script],
    { env: {}, encoding: "utf8", timeout: 15000, maxBuffer: 1048576 });
  assert.equal(child.error, undefined, String(child.error));
  assert.equal(child.signal, null, child.stderr);
  assert.equal(child.status, 0, child.stderr);
  return JSON.parse(child.stdout);
}

test("actual owner acquires exact distinct-schema reservation without epoch/genesis/dashboard", () => fixture(({ home, root, lock }) => {
  const result = run(home, `
    const handle=api.acquireDashboardCutoverSerializationV2(input);
    output.opaque=Object.isFrozen(handle)&&Object.getPrototypeOf(handle)===null&&Reflect.ownKeys(handle).length===0;
    api.assertDashboardCutoverSerializationV2(handle);
    output.wire=fs.readFileSync(lock,"utf8");
    output.mode=fs.lstatSync(lock).mode&0o7777;output.links=fs.lstatSync(lock).nlink;
    output.epoch=fs.existsSync(root+"/epoch-head.json");output.genesis=fs.existsSync(root+"/epoch-genesis");
  `);
  assert.equal(result.error, undefined, JSON.stringify(result));
  assert.equal(result.opaque, true);
  const record = JSON.parse(result.wire), { lockHash, ...body } = record;
  assert.deepEqual(Object.keys(record).sort(), ["cutoverIntentHash", "lockHash", "owner", "ownerClaimHash", "purpose", "schema"]);
  assert.equal(body.schema, "setfarm.internal-production-dashboard-cutover-serialization-lock.v2");
  assert.equal(body.purpose, "preserved-dashboard-cutover");
  assert.equal(body.cutoverIntentHash, input.cutoverIntentHash);
  assert.equal(body.ownerClaimHash, input.ownerClaimHash);
  assert.equal(body.owner.pid, result.pid);
  assert.equal(body.owner.uid, process.getuid());
  assert.deepEqual(Object.keys(body.owner).sort(), ["bootSessionHash", "pid", "processGroupId", "processLstart", "reservationNonce", "uid"]);
  assert.match(body.owner.reservationNonce, /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/);
  assert.match(body.owner.bootSessionHash, /^[a-f0-9]{64}$/);
  assert.equal(lockHash, createHash("sha256").update(canonical(body)).digest("hex"));
  assert.equal(result.wire, canonical(record) + "\n");
  assert.equal(result.mode, 0o600);
  assert.equal(result.links, 1);
  assert.equal(fs.lstatSync(root).mode & 0o7777, 0o700);
  assert.equal(fs.lstatSync(lock).size, Buffer.byteLength(result.wire));
  assert.equal(result.epoch, false); assert.equal(result.genesis, false);
}));

test("hostile idle input invokes no traps/ports and does not consume the sole attempt", () => fixture(({ home }) => {
  const result = run(home, `
    let calls=0,ports=0;const trap=()=>{calls++;throw Error("CALLER_TRAP");};
    const open=fs.openSync,spawn=childProcess.spawnSync;
    fs.openSync=(...args)=>{ports++;return open(...args);};
    childProcess.spawnSync=(...args)=>{ports++;return spawn(...args);};syncBuiltinESMExports();
    const getter={...input};Object.defineProperty(getter,"ownerClaimHash",{enumerable:true,get:trap});
    const hidden={...input};Object.defineProperty(hidden,"ownerClaimHash",{enumerable:false,value:input.ownerClaimHash});
    const invalid=[getter,hidden,new Proxy(input,{get:trap,ownKeys:trap,getPrototypeOf:trap}),
      {...input,extra:true},{...input,[Symbol()]:true},{...input,ownerClaimHash:"A".repeat(64)},
      Object.assign(Object.create(null),input),null];
    output.failures=invalid.map(value=>attempt(()=>api.acquireDashboardCutoverSerializationV2(value)));
    output.calls=calls;output.portsBeforeValid=ports;output.rootBeforeValid=fs.existsSync(root);
    const handle=api.acquireDashboardCutoverSerializationV2(input);api.assertDashboardCutoverSerializationV2(handle);
    api.releaseDashboardCutoverSerializationV2(handle);output.released=!fs.existsSync(lock);
  `);
  assert.equal(result.error, undefined, JSON.stringify(result));
  for (const error of result.failures) assert.match(error, refused);
  assert.equal(result.calls, 0); assert.equal(result.portsBeforeValid, 0);
  assert.equal(result.rootBeforeValid, false); assert.equal(result.released, true);
}));

test("successful release closes every returned original FD once with no live originals", () => fixture(({ home, lock }) => {
  const result = run(home, `
    active=true;const handle=api.acquireDashboardCutoverSerializationV2(input);
    api.releaseDashboardCutoverSerializationV2(handle);active=false;
    output.originals=originals.map(slot=>({...slot,closes:closes[slot.fd]??0,after:attempt(()=>stat(slot.fd))}));
    output.closeOrder=closeOrder;
    output.absent=!fs.existsSync(lock);
  `, `
    const open=fs.openSync,stat=fs.fstatSync,close=fs.closeSync;let active=false;const originals=[],closes={},closeOrder=[];
    fs.openSync=(target,...args)=>{const fd=open(target,...args);if(active)originals.push({fd,target});return fd;};
    fs.closeSync=fd=>{if(originals.some(slot=>slot.fd===fd)){closes[fd]=(closes[fd]??0)+1;closeOrder.push(fd);}return close(fd);};
  `);
  assert.equal(result.error, undefined, JSON.stringify(result));
  assert.ok(result.originals.length > 4);
  assert.ok(result.originals.some(slot => slot.target === lock));
  assert.equal(new Set(result.originals.map(slot => slot.fd)).size, result.originals.length);
  for (const slot of result.originals) { assert.equal(slot.closes, 1); assert.match(slot.after, /EBADF/); }
  assert.deepEqual(result.closeOrder, result.originals.map(slot => slot.fd).reverse());
  assert.equal(result.absent, true);
}));

test("a genuine canonical V2 lock survives natural holder exit and refuses the next process unchanged", () => fixture(({ home, lock }) => {
  const holder = run(home, `const handle=api.acquireDashboardCutoverSerializationV2(input);
    api.assertDashboardCutoverSerializationV2(handle);output.wire=fs.readFileSync(lock,"utf8");`);
  assert.equal(holder.error, undefined, JSON.stringify(holder));
  const record = JSON.parse(holder.wire), { lockHash, ...body } = record;
  assert.equal(body.schema, "setfarm.internal-production-dashboard-cutover-serialization-lock.v2");
  assert.equal(body.owner.pid, holder.pid);
  assert.equal(lockHash, createHash("sha256").update(canonical(body)).digest("hex"));
  assert.equal(holder.wire, canonical(record) + "\n");
  const inode = fs.lstatSync(lock).ino;
  const next = run(home, `output.refusal=attempt(()=>api.acquireDashboardCutoverSerializationV2(input));`);
  assert.equal(next.error, undefined, JSON.stringify(next));
  assert.notEqual(next.pid, holder.pid);
  assert.match(next.refusal, refused);
  assert.equal(fs.lstatSync(lock).ino, inode);
  assert.equal(fs.readFileSync(lock,"utf8"), holder.wire);
}));

for (const kind of ["malformed", "symlink"]) {
  test(`every EEXIST refuses ${kind} unchanged and forbids another acquisition`, () => fixture(({ home, root, lock }) => {
    fs.mkdirSync(root, { mode: 0o700 });
    const outside = path.join(root, "preserved-original");
    if (kind === "symlink") { fs.writeFileSync(outside, "preserved\n", { mode: 0o600 }); fs.symlinkSync(outside, lock); }
    else fs.writeFileSync(lock, "partial", { mode: 0o600 });
    const inode = fs.lstatSync(lock).ino, bytes = fs.readFileSync(lock);
    const result = run(home, `output.first=attempt(()=>api.acquireDashboardCutoverSerializationV2(input));
      output.second=attempt(()=>api.acquireDashboardCutoverSerializationV2(input));`);
    assert.equal(result.error, undefined, JSON.stringify(result));
    assert.match(result.first, refused); assert.match(result.second, refused);
    assert.equal(fs.lstatSync(lock).ino, inode); assert.deepEqual(fs.readFileSync(lock), bytes);
  }));
}

test("foreign and proxy handles refuse without burning the authentic held reservation", () => fixture(({ home }) => {
  const result = run(home, `
    const handle=api.acquireDashboardCutoverSerializationV2(input);let calls=0;
    const trap=()=>{calls++;throw Error("HANDLE_TRAP");};
    output.foreign=[Object.freeze(Object.create(null)),new Proxy(handle,{get:trap,ownKeys:trap,getPrototypeOf:trap}),null]
      .map(value=>attempt(()=>api.assertDashboardCutoverSerializationV2(value)));
    api.assertDashboardCutoverSerializationV2(handle);api.releaseDashboardCutoverSerializationV2(handle);
    output.calls=calls;output.after=attempt(()=>api.assertDashboardCutoverSerializationV2(handle));
    output.second=attempt(()=>api.acquireDashboardCutoverSerializationV2(input));output.absent=!fs.existsSync(lock);
  `);
  assert.equal(result.error, undefined, JSON.stringify(result));
  for (const error of result.foreign) assert.match(error, refused);
  assert.equal(result.calls, 0); assert.match(result.after, refused); assert.match(result.second, refused);
  assert.equal(result.absent, true);
}));

for (const drift of ["bytes", "replacement", "parent-symlink", "owner"]) {
  test(`held ${drift} drift burns reservation; release cannot unlink any later owner`, () => fixture(({ home, root, lock }) => {
    const result = run(home, `
      const handle=api.acquireDashboardCutoverSerializationV2(input);
      if(${JSON.stringify(drift)}==="bytes")fs.writeFileSync(lock,"changed");
      if(${JSON.stringify(drift)}==="replacement"){fs.renameSync(lock,lock+".retained");fs.writeFileSync(lock,"replacement",{mode:0o600});}
      if(${JSON.stringify(drift)}==="parent-symlink"){fs.renameSync(root,root+".retained");fs.symlinkSync(root+".retained",root);}
      if(${JSON.stringify(drift)}==="owner"){childProcess.spawnSync=()=>({status:1,signal:null,stdout:Buffer.alloc(0),stderr:Buffer.alloc(0)});syncBuiltinESMExports();}
      output.assertion=attempt(()=>api.assertDashboardCutoverSerializationV2(handle));
      output.release=attempt(()=>api.releaseDashboardCutoverSerializationV2(handle));
      output.reacquire=attempt(()=>api.acquireDashboardCutoverSerializationV2(input));
      output.remains=fs.existsSync(lock);
    `);
    assert.equal(result.error, undefined, JSON.stringify(result));
    assert.match(result.assertion, refused); assert.match(result.release, refused); assert.match(result.reacquire, refused);
    assert.equal(result.remains, true);
    if (drift === "replacement") assert.deepEqual(fs.readFileSync(lock), Buffer.from("replacement"));
    if (drift === "parent-symlink") assert.ok(fs.lstatSync(root).isSymbolicLink());
  }));
}

for (const fault of ["unsealed-fstat", "short-write", "readback", "file-sync", "parent-sync"]) {
  test(`setup ${fault} retains its created lock and once-drains only sealed originals`, () => fixture(({ home, root, lock }) => {
    fs.mkdirSync(root, { mode: 0o700 });
    const result = run(home, `
      active=true;output.acquire=attempt(()=>api.acquireDashboardCutoverSerializationV2(input));active=false;
      output.again=attempt(()=>api.acquireDashboardCutoverSerializationV2(input));
      output.fired=fired;output.closes=closes;output.originalLockFd=lockFd;output.originals=originals;
      output.originalAlive=attempt(()=>stat(lockFd))===null;
    `, `
      const open=fs.openSync,stat=fs.fstatSync,close=fs.closeSync,write=fs.writeFileSync,read=fs.readSync,sync=fs.fsyncSync;
      let active=false,fired=false,lockFd=null;const closes={},originals=[];const fault=${JSON.stringify(fault)};
      fs.openSync=(target,...args)=>{const fd=open(target,...args);if(active)originals.push({fd,target});if(target===lock)lockFd=fd;return fd;};
      fs.fstatSync=(fd,...args)=>{if(active&&!fired&&fault==="unsealed-fstat"&&fd===lockFd){fired=true;throw Error("FSTAT_LOST");}return stat(fd,...args);};
      fs.writeFileSync=(fd,bytes,...args)=>{if(active&&!fired&&fault==="short-write"&&fd===lockFd){fired=true;return write(fd,bytes.subarray(0,5),...args);}return write(fd,bytes,...args);};
      fs.readSync=(fd,...args)=>{if(active&&!fired&&fault==="readback"&&fd===lockFd){fired=true;throw Error("READ_LOST");}return read(fd,...args);};
      fs.fsyncSync=fd=>{if(active&&!fired&&((fault==="file-sync"&&fd===lockFd)||
        (fault==="parent-sync"&&lockFd!==null&&stat(fd).isDirectory()&&stat(fd).ino===fs.lstatSync(root).ino))){
          fired=true;sync(fd);throw Error("SYNC_RESPONSE_LOST");}return sync(fd);};
      fs.closeSync=fd=>{if(originals.some(slot=>slot.fd===fd))closes[fd]=(closes[fd]??0)+1;return close(fd);};
    `);
    assert.equal(result.error, undefined, JSON.stringify(result));
    assert.match(result.acquire, refused); assert.match(result.again, refused); assert.equal(result.fired, true);
    assert.ok(fs.lstatSync(lock).isFile());
    for (const count of Object.values(result.closes)) assert.equal(count, 1);
    for (const slot of result.originals) assert.equal(result.closes[slot.fd] ?? 0,
      fault === "unsealed-fstat" && slot.fd === result.originalLockFd ? 0 : 1);
    assert.equal(result.closes[result.originalLockFd] ?? 0, fault === "unsealed-fstat" ? 0 : 1);
    assert.equal(result.originalAlive, fault === "unsealed-fstat");
  }));
}

for (const fault of ["unlink", "parent-sync", "close"]) {
  test(`release ${fault} response loss cannot retry or claim released custody`, () => fixture(({ home, lock }) => {
    const result = run(home, `
      ledgerActive=true;const handle=api.acquireDashboardCutoverSerializationV2(input);active=true;
      output.release=attempt(()=>api.releaseDashboardCutoverSerializationV2(handle));
      output.again=attempt(()=>api.releaseDashboardCutoverSerializationV2(handle));
      output.assertion=attempt(()=>api.assertDashboardCutoverSerializationV2(handle));
      output.reacquire=attempt(()=>api.acquireDashboardCutoverSerializationV2(input));
      active=false;
      output.fired=fired;output.unlinkCalls=unlinkCalls;output.closes=closes;output.originals=originals;output.trace=trace;
    `, `
      const open=fs.openSync,unlink=fs.unlinkSync,sync=fs.fsyncSync,close=fs.closeSync,stat=fs.fstatSync;
      let active=false,ledgerActive=false,fired=false,unlinkCalls=0;const closes={},originals=[],trace=[];const fault=${JSON.stringify(fault)};
      fs.openSync=(target,...args)=>{const fd=open(target,...args);if(ledgerActive)originals.push({fd,target});return fd;};
      fs.unlinkSync=file=>{if(active)trace.push("unlink");unlinkCalls++;const value=unlink(file);if(active&&!fired&&fault==="unlink"){
        fired=true;throw Error("UNLINK_RESPONSE_LOST");}return value;};
      fs.fsyncSync=fd=>{if(active)trace.push("sync");const value=sync(fd);if(active&&!fired&&fault==="parent-sync"&&unlinkCalls===1){
        fired=true;throw Error("SYNC_RESPONSE_LOST");}return value;};
      fs.closeSync=fd=>{if(active)trace.push("close");if(originals.some(slot=>slot.fd===fd))closes[fd]=(closes[fd]??0)+1;const isFile=stat(fd).isFile();const value=close(fd);
        if(active&&!fired&&fault==="close"&&isFile){fired=true;throw Error("CLOSE_RESPONSE_LOST");}return value;};
    `);
    assert.equal(result.error, undefined, JSON.stringify(result));
    for (const error of [result.release, result.again, result.assertion, result.reacquire]) assert.match(error, refused);
    assert.equal(result.fired, true); assert.equal(result.unlinkCalls, 1);
    for (const count of Object.values(result.closes)) assert.equal(count, 1);
    for (const slot of result.originals) assert.equal(result.closes[slot.fd], 1);
    assert.deepEqual(result.trace.filter(port => port !== "close"), fault === "unlink" ? ["unlink"] : ["unlink", "sync"]);
    assert.equal(fs.existsSync(lock), false);
  }));
}

test("swallowed acquisition reentry burns before the next normal publication port", () => fixture(({ home, lock }) => {
  const result = run(home, `
    output.acquire=attempt(()=>api.acquireDashboardCutoverSerializationV2(input));
    output.again=attempt(()=>api.acquireDashboardCutoverSerializationV2(input));
    output.nested=nested;output.syncsAfterReentry=syncsAfterReentry;
  `, `
    const write=fs.writeFileSync,sync=fs.fsyncSync;let nested=null,syncsAfterReentry=0;
    fs.writeFileSync=(...args)=>{const value=write(...args);nested=attempt(()=>api.assertDashboardCutoverSerializationV2({}));return value;};
    fs.fsyncSync=fd=>{if(nested!==null)syncsAfterReentry++;return sync(fd);};
  `);
  assert.equal(result.error, undefined, JSON.stringify(result));
  assert.match(result.acquire, refused); assert.match(result.again, refused); assert.match(result.nested, refused);
  assert.equal(result.syncsAfterReentry, 0); assert.ok(fs.existsSync(lock));
}));

test("held-assertion reentry at the final actual observer command burns before later normal ports", () => fixture(({ home }) => {
  const result = run(home, `
    const handle=api.acquireDashboardCutoverSerializationV2(input);
    const spawn=childProcess.spawnSync,open=fs.openSync,sync=fs.fsyncSync,unlink=fs.unlinkSync;
    let bootCommands=0,nested=null,laterPorts=0;
    childProcess.spawnSync=(file,args,options)=>{const value=spawn(file,args,options);
      if(file==="/usr/sbin/sysctl"&&++bootCommands===2)nested=attempt(()=>api.assertDashboardCutoverSerializationV2(handle));
      return value;};
    fs.openSync=(...args)=>{if(nested!==null)laterPorts++;return open(...args);};
    fs.fsyncSync=(...args)=>{if(nested!==null)laterPorts++;return sync(...args);};
    fs.unlinkSync=(...args)=>{if(nested!==null)laterPorts++;return unlink(...args);};syncBuiltinESMExports();
    output.assertion=attempt(()=>api.assertDashboardCutoverSerializationV2(handle));
    output.release=attempt(()=>api.releaseDashboardCutoverSerializationV2(handle));
    output.nested=nested;output.laterPorts=laterPorts;output.remains=fs.existsSync(lock);
  `);
  assert.equal(result.error, undefined, JSON.stringify(result));
  assert.match(result.assertion, refused); assert.match(result.release, refused); assert.match(result.nested, refused);
  assert.equal(result.laterPorts, 0); assert.equal(result.remains, true);
}));

for (const port of ["unlink", "sync", "close"]) {
  test(`swallowed release reentry during ${port} prevents later normal release ports`, () => fixture(({ home }) => {
    const result = run(home, `
      const handle=api.acquireDashboardCutoverSerializationV2(input);
      const unlink=fs.unlinkSync,sync=fs.fsyncSync,close=fs.closeSync,stat=fs.fstatSync;
      let nested=null,fired=false,unlinkCalls=0,syncCalls=0;const closes={};
      const reenter=()=>{fired=true;nested=attempt(()=>api.releaseDashboardCutoverSerializationV2(handle));};
      fs.unlinkSync=file=>{unlinkCalls++;const value=unlink(file);if(${JSON.stringify(port)}==="unlink")reenter();return value;};
      fs.fsyncSync=fd=>{syncCalls++;const value=sync(fd);if(${JSON.stringify(port)}==="sync")reenter();return value;};
      fs.closeSync=fd=>{closes[fd]=(closes[fd]??0)+1;const file=stat(fd).isFile();const value=close(fd);
        if(!fired&&${JSON.stringify(port)}==="close"&&file)reenter();return value;};syncBuiltinESMExports();
      output.release=attempt(()=>api.releaseDashboardCutoverSerializationV2(handle));
      output.again=attempt(()=>api.releaseDashboardCutoverSerializationV2(handle));
      output.fired=fired;output.nested=nested;output.unlinkCalls=unlinkCalls;output.syncCalls=syncCalls;output.closes=closes;
    `);
    assert.equal(result.error, undefined, JSON.stringify(result));
    assert.equal(result.fired, true); assert.match(result.release, refused); assert.match(result.again, refused);
    assert.match(result.nested, refused); assert.equal(result.unlinkCalls, 1);
    assert.equal(result.syncCalls, port === "unlink" ? 0 : 1);
    for (const count of Object.values(result.closes)) assert.equal(count, 1);
  }));
}

for (const operation of ["acquire", "release"]) {
  test(`physical drift across final actual owner bracket prevents ${operation} admission`, () => fixture(({ home, lock }) => {
    const result = run(home, `
      let handle;
      if(${JSON.stringify(operation)}==="release")handle=api.acquireDashboardCutoverSerializationV2(input);
      const spawn=childProcess.spawnSync,unlink=fs.unlinkSync;let seen=0,fired=false,unlinkCalls=0;
      childProcess.spawnSync=(file,args,options)=>{const value=spawn(file,args,options);
        if(file==="/usr/sbin/sysctl"&&fs.existsSync(lock)&&++seen===${operation === "acquire" ? 2 : 4}){
          fired=true;fs.writeFileSync(lock,"drift during last owner observation");}return value;};
      fs.unlinkSync=(...args)=>{unlinkCalls++;return unlink(...args);};syncBuiltinESMExports();
      output.result=attempt(()=>${operation === "acquire" ? "api.acquireDashboardCutoverSerializationV2(input)" : "api.releaseDashboardCutoverSerializationV2(handle)"});
      output.fired=fired;output.unlinkCalls=unlinkCalls;
      output.reacquire=attempt(()=>api.acquireDashboardCutoverSerializationV2(input));
    `);
    assert.equal(result.error, undefined, JSON.stringify(result));
    assert.equal(result.fired, true); assert.match(result.result, refused); assert.match(result.reacquire, refused);
    assert.equal(result.unlinkCalls, 0); assert.ok(fs.existsSync(lock));
  }));
}

test("already-entered stale pathname unlink removes V2: assertion burns, not full-freeze success", () => fixture(({ home, root }) => {
  fs.mkdirSync(root, { mode: 0o700 });
  const result = run(home, `
    fs.writeFileSync(lock,"owned legacy fixture",{mode:0o600});
    const legacyFd=fs.openSync(lock,fs.constants.O_RDONLY|fs.constants.O_NOFOLLOW);
    const legacyFinalStat=fs.fstatSync(legacyFd); // Models V1's held original and accepted last check, not V1 admission.
    const staleUnlink=()=>fs.unlinkSync(lock);
    fs.unlinkSync(lock); // First reclaimer finishes; the second accepted call is still queued.
    const handle=api.acquireDashboardCutoverSerializationV2(input);
    output.newInode=fs.lstatSync(lock).ino!==legacyFinalStat.ino;
    staleUnlink();
    output.assertion=attempt(()=>api.assertDashboardCutoverSerializationV2(handle));
    output.release=attempt(()=>api.releaseDashboardCutoverSerializationV2(handle));
    output.reacquire=attempt(()=>api.acquireDashboardCutoverSerializationV2(input));
    output.absent=!fs.existsSync(lock);
    output.legacyUnlinked=fs.fstatSync(legacyFd).ino===legacyFinalStat.ino&&fs.fstatSync(legacyFd).nlink===0;
    fs.closeSync(legacyFd);output.legacyClosed=attempt(()=>fs.fstatSync(legacyFd));
  `);
  assert.equal(result.error, undefined, JSON.stringify(result));
  assert.equal(result.newInode, true); assert.equal(result.absent, true);
  assert.equal(result.legacyUnlinked, true); assert.match(result.legacyClosed, /EBADF/);
  assert.match(result.assertion, refused); assert.match(result.release, refused); assert.match(result.reacquire, refused);
}));
