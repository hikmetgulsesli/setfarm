import assert from "node:assert/strict";
import fs from "node:fs";
import { test } from "node:test";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { registerHooks } from "node:module";

const transportUrl = new URL("../dashboard-cutover-process-events-v4.mjs", import.meta.url);

test("process-event transport exports fixed opaque DATA interfaces", async () => {
  assert.ok(fs.existsSync(transportUrl), "MISSING_PROCESS_EVENT_TRANSPORT_INTERFACE");
  const pythonUrl = new URL("../dashboard-cutover-process-events-v4.py", import.meta.url);
  const bytes = fs.readFileSync(pythonUrl, "utf8");
  const hook = registerHooks({ load(url, context, next) {
    if (url === pythonUrl.href) return { format: "module", source: `export default ${JSON.stringify(bytes)};`, shortCircuit: true };
    return next(url, context);
  } });
  try {
    const transport = await import(transportUrl.href);
    for (const name of ["holdDashboardCutoverProcessCandidateEventsV4", "observeHeldDashboardCutoverProcessCandidateEventsV4", "waitHeldDashboardCutoverProcessCandidateEventsV4"]) {
      assert.equal(typeof transport[name], "function", name);
      assert.equal(transport[name].length, 1, name);
    }
  } finally { hook.deregister(); }
});

// Actual Node child/pipe custody with an explicitly substituted executable.
// These originals NEVER qualify Python, private ABI, kevent or a target death.
const canonical = value => value === null || typeof value !== "object" ? JSON.stringify(value)
  : Array.isArray(value) ? `[${value.map(canonical).join(",")}]`
    : `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`;
const hash = value => createHash("sha256").update(value).digest("hex");
const limits = { authority: "conditional-target-data-only", familyClosure: "not-proven", futureEntryExclusion: "not-proven", cutoverAdmission: "not-granted" };
const generation = { pid: 77, ordinal: 1, uniqueId: "0000000000001234", parentUniqueId: "0000000000001000", idVersion: "ffffffff", originalParentVersion: "00000001", executableUuid: "01".repeat(16), executablePath: "/owned/test-target" };
const eventHex = (pid, flags, fflags, ordinal) => {
  const bytes = Buffer.alloc(32); bytes.writeBigUInt64LE(BigInt(pid), 0); bytes.writeInt16LE(-5, 8);
  bytes.writeUInt16LE(flags, 10); bytes.writeUInt32LE(fflags, 12); bytes.writeBigInt64LE(0n, 16); bytes.writeBigUInt64LE(BigInt(ordinal), 24); return bytes.toString("hex");
};
const registration = { intentHex: eventHex(77, 65, 3758096384, 1), returned: true, result: 1, errno: 0, receiptHex: eventHex(77, 16449, 3758096384, 1) };
const ready = { schema: "setfarm.dashboard-cutover-process-candidates-frame.v4", ...limits, sequence: 0, state: "READY", candidates: [generation], registrations: [registration] };
const terminal = { schema: ready.schema, ...limits, sequence: 1, state: "EXITED", candidates: [generation], events: [{ pid: 77, ordinal: 1, filter: -5, flags: 32881, fflags: 2147483648, data: 0, rawHex: eventHex(77, 32881, 2147483648, 1) }], queueClose: { attempted: true, returned: true, result: 0, errno: 0 } };

async function nodeOriginal(mode) {
  assert.ok(fs.existsSync(transportUrl), "MISSING_PROCESS_EVENT_TRANSPORT_INTERFACE");
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-process-events-v4-")));
  const put = (name, bytes) => fs.writeFileSync(path.join(root, name), bytes, { mode: 0o600 });
  put("test-source.js", fs.readFileSync(new URL(import.meta.url)));
  const pins = ["dashboard-cutover-process-events-v4.mjs", "dashboard-cutover-process-events-v4.py"].map(name => {
    const bytes = fs.readFileSync(new URL(`../${name}`, import.meta.url));
    let copied = bytes;
    if (["promise-catch-loss", "missing-eof", "missing-close", "missing-stdin-finish"].includes(mode) && name.endsWith(".mjs")) {
      const marker = "attempted = true; occurrence = o;";
      assert.equal(bytes.toString().split(marker).length - 1, 1);
      copied = Buffer.from(bytes.toString().replace(marker, marker + " globalThis.fixtureRetainedOccurrence=o;"));
      put(name + ".original", bytes);
    }
    put(name, copied);
    return { name, byteLength: bytes.length, sha256: hash(bytes), copiedHash: hash(copied), bridge: copied === bytes ? "byte-exact" : "one fixed passive private occurrence exposure; not byte-exact" };
  });
  let frames = [ready, terminal];
  if (mode === "coerced-label") frames = [ready, terminal].map(frame => ({ ...frame, candidates: [{ ...generation, uniqueId: ["0000000000000000"], idVersion: 12345678 }] }));
  if (mode === "wrong-raw-receipt") frames = [{ ...ready, registrations: [{ ...registration, receiptHex: eventHex(78, 16449, 3758096384, 1) }] }, terminal];
  if (mode === "wrong-raw-event") frames = [ready, { ...terminal, events: [{ ...terminal.events[0], rawHex: eventHex(78, 32881, 2147483648, 1) }] }];
  if (mode === "bad-sequence") frames = [{ ...ready, sequence: 1 }, terminal];
  if (mode.startsWith("multi")) {
    const other = { ...generation, pid: 88, ordinal: 2, uniqueId: "000000000000123f" };
    const candidates = [generation, other];
    frames = [{ ...ready, candidates, registrations: [registration, { ...registration, intentHex: eventHex(88, 65, 3758096384, 2), receiptHex: eventHex(88, 16449, 3758096384, 2) }] },
      { ...terminal, candidates, events: mode === "multi" ? [...terminal.events, { ...terminal.events[0], pid: 88, ordinal: 2, rawHex: eventHex(88, 32881, 2147483648, 2) }] : terminal.events }];
  }
  if (mode === "fork") frames = [ready, { ...terminal, events: [{ ...terminal.events[0], fflags: 3221225472 }] }];
  if (mode === "close-loss") frames = [ready, { ...terminal, queueClose: { attempted: true, returned: false, result: null, errno: null } }];
  if (mode === "extra") frames.push(terminal);
  if (mode === "no-terminal") frames = [ready];
  const backend = `import fs from 'node:fs';let input='';process.stdin.setEncoding('utf8');process.stdin.on('data',x=>input+=x);process.stdin.on('end',()=>{
    fs.writeFileSync(${JSON.stringify(path.join(root, "backend-input.json"))},input,{mode:0o600});
    const frames=${JSON.stringify(frames.map(canonical))};
    if(${JSON.stringify(mode)}==='overflow'){process.stdout.write('x'.repeat(40000));return;}
    if(${JSON.stringify(mode)}==='invalid-utf8'){process.stdout.write(Buffer.from([255,10]));return;}
    if(${JSON.stringify(mode)}==='no-lf'){process.stdout.write(frames[0]);return;}
    if(${JSON.stringify(mode)}==='noncanonical'){process.stdout.write(${JSON.stringify(JSON.stringify(ready))}+'\\n');return;}
    if(${JSON.stringify(mode)}==='helper-nonzero')process.exitCode=1;
    if(${JSON.stringify(mode)}==='stderr')process.stderr.write('PRIVATE_BACKEND_CAUSE');
    const begin=()=>{process.stdout.write(frames[0]+'\\n');setTimeout(()=>{for(const frame of frames.slice(1))process.stdout.write(frame+'\\n');},${mode === "lifetime-timeout" ? 300 : 25});};
    if(${JSON.stringify(mode)}==='ready-timeout')setTimeout(begin,300);else begin();
  });if(${JSON.stringify(mode)}==='reentry')setTimeout(()=>{fs.writeFileSync(${JSON.stringify(path.join(root, "backend-input.json"))},input,{mode:0o600});process.exit(0)},100);`;
  put("backend.mjs", backend);
  const preload = `import fs from 'node:fs';import cp from 'node:child_process';import {registerHooks,syncBuiltinESMExports} from 'node:module';
    const native=cp.spawn;globalThis.spawnCount=0;globalThis.spawnProof=[];globalThis.inputDispatches=0;globalThis.backendCustody={stdinFinish:false,stdinClose:false,stdoutEnd:false,stdoutClose:false,stderrEnd:false,stderrClose:false,exit:null,close:null};
    globalThis.spawnOwnedTarget=()=>native('/usr/bin/python3',['-I','-S','-B','-u','-c',"import sys,select;sys.stdout.write('TARGET_READY'+chr(10));sys.stdout.flush();ready,_,_=select.select([sys.stdin],[],[],10);received=sys.stdin.buffer.read(1) if ready else None;sys.exit(0 if ready and received==b'' else 2)"],{cwd:'/',env:{PATH:'/usr/bin:/bin',LANG:'C',LC_ALL:'C'},stdio:['pipe','pipe','pipe']});
    if(['ready-timeout','lifetime-timeout','missing-eof','missing-close','missing-stdin-finish'].includes(${JSON.stringify(mode)})){const timer=globalThis.setTimeout;globalThis.setTimeout=(callback,ms,...rest)=>timer(callback,ms===5000||ms===35000?150:ms,...rest);}
    cp.spawn=(file,args,options)=>{globalThis.spawnCount++;
      if(file!=='/usr/bin/python3'||JSON.stringify(args.slice(0,5))!==JSON.stringify(['-I','-S','-B','-u','-c'])||args[5]!==fs.readFileSync(new URL('./dashboard-cutover-process-events-v4.py',import.meta.url),'utf8')||options.cwd!=='/'||JSON.stringify(options.env)!==JSON.stringify({PATH:'/usr/bin:/bin',LANG:'C',LC_ALL:'C'}))throw Error('FIXED_CHILD_CONTRACT_MISMATCH');
      const child=${JSON.stringify(mode)}==='native'?native(file,args,options):native(process.execPath,[${JSON.stringify(path.join(root, "backend.mjs"))}],options);globalThis.actualBackend=child;
      let raw=Buffer.alloc(0);child.stdout.on('data',bytes=>{if(raw.length+bytes.length<=32768)raw=Buffer.concat([raw,bytes])});child.on('close',()=>fs.writeFileSync(${JSON.stringify(path.join(root, "backend-stdout.bin"))},raw,{mode:0o600}));
      const custody=globalThis.backendCustody;
      for(const name of ['stdin','stdout','stderr'])child[name].on('close',()=>custody[name+'Close']=true);
      child.stdin.on('finish',()=>custody.stdinFinish=true);child.stdout.on('end',()=>custody.stdoutEnd=true);child.stderr.on('end',()=>custody.stderrEnd=true);
      child.on('exit',(code,signal)=>custody.exit={code,signal});child.on('close',(code,signal)=>custody.close={code,signal});
      if(${JSON.stringify(mode)}==='deferred-eof'){
        const on=child.stdout.on.bind(child.stdout);child.stdout.on=(event,listener)=>on(event,event==='end'?(...args)=>setTimeout(()=>{globalThis.providerEofDelivered=true;listener(...args)},100):listener);
      }
      if(${JSON.stringify(mode)}==='missing-eof'){const on=child.stdout.on.bind(child.stdout);child.stdout.on=(event,listener)=>event==='end'?child.stdout:on(event,listener);}
      if(${JSON.stringify(mode)}==='missing-close'){const on=child.on.bind(child);child.on=(event,listener)=>event==='close'?child:on(event,listener);}
      if(${JSON.stringify(mode)}==='missing-stdin-finish'){const on=child.stdin.on.bind(child.stdin);child.stdin.on=(event,listener)=>event==='finish'?child.stdin:on(event,listener);}
      let deferCallback=null;
      if(${JSON.stringify(mode)}.startsWith('perm-')){
        const queued=[];globalThis.providerCallbacksDelivered=[];
        deferCallback=(label,callback)=>{queued.push({label,callback});if(queued.length===9)setTimeout(()=>{
          const mode=${JSON.stringify(mode)};
          if(mode==='perm-reverse')queued.reverse();
          else if(mode==='perm-close-first')queued.sort((a,b)=>(a.label==='childClose'?-1:0)-(b.label==='childClose'?-1:0));
          else {const prefix=mode.slice(5,-5);queued.sort((a,b)=>Number(a.label.startsWith(prefix))-Number(b.label.startsWith(prefix)));}
          for(const entry of queued){globalThis.providerCallbacksDelivered.push(entry.label);entry.callback();}
        },10)};
        const counts=new Map();
        const bind=(emitter,mapping)=>{const on=emitter.on.bind(emitter);emitter.on=(event,listener)=>{
          const label=mapping[event];if(!label||(counts.get(label)??0)>0)return on(event,listener);
          counts.set(label,1);return on(event,(...args)=>deferCallback(label,()=>listener(...args)));
        }};
        bind(child,{exit:'exit',close:'childClose'});bind(child.stdin,{finish:'stdinFinish',close:'stdinClose'});
        bind(child.stdout,{end:'stdoutEnd',close:'stdoutClose'});bind(child.stderr,{end:'stderrEnd',close:'stderrClose'});
      }
      const end=child.stdin.end.bind(child.stdin);child.stdin.end=(...args)=>{globalThis.inputDispatches++;if(deferCallback){const index=args.length-1,callback=args[index];if(typeof callback==='function')args[index]=(...values)=>deferCallback('stdinAck',()=>callback(...values));}if(${JSON.stringify(mode)}==='native')fs.writeFileSync(${JSON.stringify(path.join(root, "backend-input.json"))},args[0],{mode:0o600});return end(...args)};
      for(const method of ['kill','unref'])child[method]=()=>{throw Error('FORBIDDEN_CHILD_DISPOSAL')};
      globalThis.spawnProof.push({file,argsHash:${JSON.stringify(hash(fs.readFileSync(new URL("../dashboard-cutover-process-events-v4.py", import.meta.url))))},cwd:options.cwd,env:options.env,substitution:${JSON.stringify(mode === "native" ? "none-actual-fixed-python-owned-target-only" : "actual-node-test-child-not-python")}});
      if(globalThis.reenter)globalThis.reenter();return child;};syncBuiltinESMExports();
    registerHooks({load(url,context,next){if(url===new URL('./dashboard-cutover-process-events-v4.py',import.meta.url).href)return{format:'module',source:'export default '+JSON.stringify(fs.readFileSync(new URL(url),'utf8'))+';',shortCircuit:true};return next(url,context)}});`;
  put("preload.mjs", preload);
  const driver = `import assert from 'node:assert/strict';import fs from 'node:fs';
    import * as t from './dashboard-cutover-process-events-v4.mjs';
    const request={schema:'setfarm.dashboard-cutover-process-candidates-request.v4',candidates:[{pid:77}]};
    const mode=${JSON.stringify(mode)};let traps=0,actualOriginal=null;
    if(mode.startsWith('multi'))request.candidates=[{pid:77},{pid:88}];
    let targetCustody=null;
    let failure=null;
    try{
    if(mode==='native'){
      const target=globalThis.spawnOwnedTarget();globalThis.ownedTarget=target;request.candidates[0].pid=target.pid;
      targetCustody={pid:target.pid,stdout:'',stderr:'',stdinFinish:false,stdinClose:false,stdoutEnd:false,stdoutClose:false,stderrEnd:false,stderrClose:false,exit:null,close:null};
      for(const name of ['stdin','stdout','stderr'])target[name].on('close',()=>targetCustody[name+'Close']=true);
      target.stdin.on('finish',()=>targetCustody.stdinFinish=true);target.stdout.on('end',()=>targetCustody.stdoutEnd=true);target.stderr.on('end',()=>targetCustody.stderrEnd=true);
      target.stdout.on('data',bytes=>targetCustody.stdout+=bytes.toString());target.stderr.on('data',bytes=>targetCustody.stderr+=bytes.toString());
      target.on('exit',(code,signal)=>targetCustody.exit={code,signal});target.on('close',(code,signal)=>targetCustody.close={code,signal});
      await new Promise((resolve,reject)=>{let marker='';const expected='TARGET_READY\\n';target.stdout.on('data',bytes=>{marker+=bytes.toString();if(marker.length>expected.length||!expected.startsWith(marker))reject(Error('OWNED_TARGET_NOT_READY'));else if(marker===expected)resolve()});target.on('error',reject);target.once('close',()=>reject(Error('OWNED_TARGET_CLOSED_BEFORE_READY')))});
    }
    if(mode==='promise-catch-loss'){
      const originalCatch=Promise.prototype.catch;let armed=true;
      Promise.prototype.catch=function(...args){const observed=originalCatch.apply(this,args);if(armed){armed=false;throw Error('LOST_CATCH_RESPONSE')}return observed};
      await assert.rejects(t.holdDashboardCutoverProcessCandidateEventsV4(request));
      assert.ok(globalThis.fixtureRetainedOccurrence.readyOriginal?.promise,'KNOWN_RETURNED_PROMISE_RETAINED');assert.equal(globalThis.spawnCount,0);
    }else
    if(['promise-reentry','descriptor-reentry','timer-reentry','buffer-reentry'].includes(mode)){
      let armed=true;
      const nested=()=>{if(!armed)return;armed=false;t.holdDashboardCutoverProcessCandidateEventsV4(null).catch(()=>{});};
      if(mode==='promise-reentry'){const P=globalThis.Promise;globalThis.Promise=class extends P{constructor(executor){super(executor);nested();}};}
      if(mode==='descriptor-reentry'){const descriptors=Object.getOwnPropertyDescriptors;Object.getOwnPropertyDescriptors=value=>{if(value===request)nested();return descriptors(value)};}
      if(mode==='timer-reentry'){const timer=globalThis.setTimeout;globalThis.setTimeout=(callback,ms,...rest)=>{if(ms===5000)nested();return timer(callback,ms,...rest)};}
      if(mode==='buffer-reentry'){const alloc=Buffer.alloc;Buffer.alloc=(size,...args)=>{if(size===0)nested();return alloc(size,...args)};}
      await assert.rejects(t.holdDashboardCutoverProcessCandidateEventsV4(request));assert.equal(globalThis.spawnCount,0,'NO_SPAWN_AFTER_PREPARATION_REENTRY');
      await assert.rejects(t.holdDashboardCutoverProcessCandidateEventsV4(request));assert.equal(globalThis.spawnCount,0,'NO_REPAIR_AFTER_PREPARATION_BURN');
    }else
    if(mode==='invalid'){
      const proxy=new Proxy(request,{get(){traps++;throw Error('CALLER_TRAP')},ownKeys(){traps++;throw Error('CALLER_TRAP')},getPrototypeOf(){traps++;throw Error('CALLER_TRAP')}});
      for(const invalid of [proxy,{...request,extra:true},{...request,candidates:[{pid:77},{pid:77}]},{...request,candidates:[{get pid(){traps++;return 77}}]}])await assert.rejects(t.holdDashboardCutoverProcessCandidateEventsV4(invalid));
      assert.equal(traps,0);assert.equal(globalThis.spawnCount,0);
    }else{
      if(mode==='reentry')globalThis.reenter=()=>{t.holdDashboardCutoverProcessCandidateEventsV4(null).catch(()=>{});};
      if(mode==='publication-reentry'){const freeze=Object.freeze;let armed=true;Object.freeze=value=>{const result=freeze(value);if(armed&&Object.getPrototypeOf(value)===null&&Reflect.ownKeys(value).length===0){armed=false;t.holdDashboardCutoverProcessCandidateEventsV4(null).catch(()=>{})}return result};}
      if(mode==='reentry'){await assert.rejects(t.holdDashboardCutoverProcessCandidateEventsV4(request));assert.equal(globalThis.inputDispatches,0,'NO_INPUT_PORT_AFTER_BURN');}
      else if(['stderr','coerced-label','ready-timeout','wrong-raw-receipt','publication-reentry','overflow','invalid-utf8','no-lf','noncanonical','bad-sequence'].includes(mode)){await assert.rejects(t.holdDashboardCutoverProcessCandidateEventsV4(request));if(mode==='ready-timeout')assert.equal(globalThis.actualBackend.exitCode,null,'DRIVER_NOT_ORIGINAL_EXIT');}
      else{
        const original=await t.holdDashboardCutoverProcessCandidateEventsV4(request);
        actualOriginal=original;
        assert.equal(Object.getPrototypeOf(original),null);assert.ok(Object.isFrozen(original));assert.deepEqual(Reflect.ownKeys(original),[]);
        assert.equal(t.observeHeldDashboardCutoverProcessCandidateEventsV4(original).state,'READY');
        assert.throws(()=>t.observeHeldDashboardCutoverProcessCandidateEventsV4(Object.freeze(Object.create(null))));
        if(mode==='native')globalThis.ownedTarget.stdin.end();
        if(['good','deferred-eof','native','multi'].includes(mode)||mode.startsWith('perm-')){
          const data=await t.waitHeldDashboardCutoverProcessCandidateEventsV4(original);assert.equal(data.state,'EXITED');
          if(mode==='deferred-eof')assert.equal(globalThis.providerEofDelivered,true,'NO_SETTLEMENT_BEFORE_SAME_EOF_CALLBACK');
          if(mode.startsWith('perm-'))assert.equal(globalThis.providerCallbacksDelivered.length,9,'NO_SETTLEMENT_BEFORE_ALL_SAME_CALLBACKS');
          assert.equal(data.familyClosure,'not-proven');assert.equal(data.cutoverAdmission,'not-granted');
          await assert.rejects(t.waitHeldDashboardCutoverProcessCandidateEventsV4(original));
        }else if(['wait-reentry','observe-reentry'].includes(mode)){
          const waiting=t.waitHeldDashboardCutoverProcessCandidateEventsV4(original);
          if(mode==='wait-reentry')await assert.rejects(t.waitHeldDashboardCutoverProcessCandidateEventsV4());
          else assert.throws(()=>t.observeHeldDashboardCutoverProcessCandidateEventsV4(original));
          await assert.rejects(waiting);assert.throws(()=>t.observeHeldDashboardCutoverProcessCandidateEventsV4(original));
        }else {await assert.rejects(t.waitHeldDashboardCutoverProcessCandidateEventsV4(original));if(mode==='lifetime-timeout')assert.equal(globalThis.actualBackend.exitCode,null,'DRIVER_NOT_ORIGINAL_EXIT');}
      }
      if(globalThis.actualBackend && globalThis.backendCustody.close===null)await new Promise(resolve=>globalThis.actualBackend.once('close',resolve));
      if(['ready-timeout','lifetime-timeout'].includes(mode)){if(actualOriginal)assert.throws(()=>t.observeHeldDashboardCutoverProcessCandidateEventsV4(actualOriginal),'SAME_ORIGINAL_UNKNOWN_NOT_REPAIRED');await assert.rejects(t.holdDashboardCutoverProcessCandidateEventsV4(request));}
      if(['missing-eof','missing-close','missing-stdin-finish'].includes(mode)){
        assert.equal(globalThis.fixtureRetainedOccurrence.naturalSettled,false,'ORIGINAL_PENDING_NOT_DRIVER_SETTLEMENT');
        assert.throws(()=>t.observeHeldDashboardCutoverProcessCandidateEventsV4(actualOriginal));
      }
      assert.equal(globalThis.spawnCount,1);
    }
    }catch(error){failure=error;if(mode==='native'&&globalThis.ownedTarget&&!globalThis.ownedTarget.stdin.writableEnded)globalThis.ownedTarget.stdin.end();}
    if(globalThis.actualBackend && globalThis.backendCustody.close===null)await new Promise(resolve=>globalThis.actualBackend.once('close',resolve));
    if(targetCustody && targetCustody.close===null)await new Promise(resolve=>globalThis.ownedTarget.once('close',resolve));
    fs.writeFileSync(${JSON.stringify(path.join(root, "driver-result.json"))},JSON.stringify({mode,request,targetCustody,providerCallbacksDelivered:globalThis.providerCallbacksDelivered??null,spawnCount:globalThis.spawnCount,spawnProof:globalThis.spawnProof,inputDispatches:globalThis.inputDispatches,backendCustody:globalThis.backendCustody,traps,passed:failure===null,error:failure?.message??null})+'\\n',{mode:0o600});if(failure)throw failure;`;
  put("driver.mjs", driver);
  const child = spawn(process.execPath, ["--import", path.join(root, "preload.mjs"), path.join(root, "driver.mjs")], { cwd: root, env: { PATH: "/usr/bin:/bin", LANG: "C", LC_ALL: "C" }, stdio: ["pipe", "pipe", "pipe"] });
  const custody = { stdinFinish: false, stdinClose: false, stdoutEnd: false, stdoutClose: false, stderrEnd: false, stderrClose: false, exit: null, close: null };
  let stdout = "", stderr = "";
  child.stdin.on("finish", () => custody.stdinFinish = true); child.stdin.on("close", () => custody.stdinClose = true);
  child.stdout.on("end", () => custody.stdoutEnd = true); child.stdout.on("close", () => custody.stdoutClose = true);
  child.stderr.on("end", () => custody.stderrEnd = true); child.stderr.on("close", () => custody.stderrClose = true);
  child.stdout.on("data", bytes => stdout += bytes); child.stderr.on("data", bytes => stderr += bytes);
  child.on("exit", (code, signal) => custody.exit = { code, signal }); child.stdin.end();
  await new Promise((resolve, reject) => { child.on("error", reject); child.on("close", (code, signal) => { custody.close = { code, signal }; resolve(); }); });
  put("original.json", JSON.stringify({ mode, pins, backend, preload, driver, stdout, stderr, custody }, null, 2) + "\n");
  console.log(`PROCESS_EVENTS_NODE_ORIGINAL ${root}`);
  assert.deepEqual(custody.exit, { code: 0, signal: null }, stderr);
  assert.deepEqual(custody.close, custody.exit);
  for (const key of ["stdinFinish", "stdinClose", "stdoutEnd", "stdoutClose", "stderrEnd", "stderrClose"]) assert.equal(custody[key], true, key);
  assert.equal(stderr, "");
  const result = JSON.parse(fs.readFileSync(path.join(root, "driver-result.json"), "utf8"));
  assert.equal(result.passed, true);
  if (result.spawnCount === 1 && mode !== "reentry") {
    assert.deepEqual(result.backendCustody.exit, { code: mode === "helper-nonzero" ? 1 : 0, signal: null });
    assert.deepEqual(result.backendCustody.close, result.backendCustody.exit);
    for (const key of ["stdinFinish", "stdinClose", "stdoutEnd", "stdoutClose", "stderrEnd", "stderrClose"]) assert.equal(result.backendCustody[key], true, `backend ${key}`);
  }
  if (!["invalid", "reentry", "promise-reentry", "descriptor-reentry", "timer-reentry", "buffer-reentry", "promise-catch-loss"].includes(mode)) assert.equal(fs.readFileSync(path.join(root, "backend-input.json"), "utf8"), canonical(result.request) + "\n");
  if (mode === "native") {
    assert.deepEqual(result.targetCustody.exit, { code: 0, signal: null }); assert.deepEqual(result.targetCustody.close, result.targetCustody.exit);
    for (const key of ["stdinFinish", "stdinClose", "stdoutEnd", "stdoutClose", "stderrEnd", "stderrClose"]) assert.equal(result.targetCustody[key], true);
    const frames = fs.readFileSync(path.join(root, "backend-stdout.bin"), "utf8").trimEnd().split("\n").map(line => JSON.parse(line));
    assert.deepEqual(frames.map(frame => frame.state), ["READY", "EXITED"]);
    assert.equal(frames[0].candidates[0].pid, result.targetCustody.pid);
    assert.equal(frames[0].registrations[0].receiptHex.length, 64); assert.equal(frames[1].events[0].rawHex.length, 64);
  }
}

for (const mode of ["good", "invalid", "fork", "close-loss", "extra", "no-terminal", "stderr", "reentry", "coerced-label", "promise-reentry", "descriptor-reentry", "timer-reentry", "buffer-reentry", "promise-catch-loss", "deferred-eof", "ready-timeout", "lifetime-timeout", "wrong-raw-receipt", "wrong-raw-event", "overflow", "invalid-utf8", "no-lf", "noncanonical", "bad-sequence", "publication-reentry", "wait-reentry", "observe-reentry", "missing-eof", "missing-close", "missing-stdin-finish", "helper-nonzero", "multi", "multi-missing-exit", "perm-reverse", "perm-close-first", "perm-exit-last", "perm-stdin-last", "perm-stdout-last", "perm-stderr-last"]) {
  test(`process-event Node custody ${mode} (not native qualification)`, () => nodeOriginal(mode));
}

test("process-event owned native target conditional mechanics (opt-in, not family proof)",
  { skip: process.env.SETFARM_TEST_OWNED_PROCESS_EVENTS_NATIVE !== "1" }, () => nodeOriginal("native"));

for (const mode of ["good", "registration-eintr", "wait-eintr", "close-eintr", "close-lost", "short-identity", "mixed-exit", "wrong-receipt", "deadline", "short-ready-write", "ready-flush-loss", "short-terminal-write", "terminal-flush-loss", "wrong-abi", "esrch", "wrong-uid", "traced", "in-exit", "path-change", "unique-change", "version-change", "uuid-change", "wrong-event", "duplicate-event", "queue-fd-zero", "queue-error-with-fd", "receipt-count-zero", "path-tail-workspace", "multi", "multi-duplicate-event"]) {
  test(`process-event actual Python source ${mode} with disclosed libc double`, () => {
    const sourceUrl = new URL("../dashboard-cutover-process-events-v4.py", import.meta.url);
    assert.ok(fs.existsSync(sourceUrl), "MISSING_PROCESS_EVENT_BACKEND_INTERFACE");
    const source = fs.readFileSync(sourceUrl, "utf8");
    const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-process-events-python-v4-")));
    const put = (name, bytes) => fs.writeFileSync(path.join(root, name), bytes, { mode: 0o600 });
    put("test-source.js", fs.readFileSync(new URL(import.meta.url)));
    put("original-source.py", source);
    const prefix = `import ctypes,struct,os,sys,atexit,json,time\nmode=${JSON.stringify(mode)}\ncalls=[]\nregistered=[]\nproof=${JSON.stringify(path.join(root, "calls.json"))}\n` + String.raw`
class FakeCall:
    def __init__(self,name): self.name=name
    def __call__(self,*args):
        call={'name':self.name,'returned':False,'result':None,'errno':None};calls.append(call)
        result=0;error=0
        if self.name=='kqueue':
            result=0 if mode=='queue-fd-zero' else 41
            if mode=='queue-error-with-fd': error=4
        elif self.name=='proc_pidinfo':
            pid,flavor,arg,buffer,size=args
            call.update(pid=pid,flavor=flavor,size=size)
            raw=bytearray(size)
            if flavor==17:
                raw[:16]=bytes([1])*16;struct.pack_into('=QQiiQQ',raw,16,0x1234+pid-77,0x1000,-1,1,0,0)
                result=size-1 if mode=='short-identity' else size
                identities=sum(1 for c in calls if c['name']=='proc_pidinfo' and c.get('flavor')==17)
                if mode=='esrch': result=0;error=3
                if identities==2:
                    if mode=='unique-change': struct.pack_into('=Q',raw,16,0x1235)
                    if mode=='version-change': struct.pack_into('=i',raw,32,1)
                    if mode=='uuid-change': raw[0]=2
            elif flavor==3:
                struct.pack_into('=12I',raw,0,0,2,0,pid,2,os.getuid(),os.getgid(),os.getuid(),os.getgid(),os.getuid(),os.getgid(),0)
                struct.pack_into('=QQ',raw,120,1,1);result=size
                if mode=='wrong-uid': struct.pack_into('=I',raw,20,os.getuid()+1)
                if mode=='traced': struct.pack_into('=I',raw,0,2)
                if mode=='in-exit': struct.pack_into('=I',raw,0,4)
            else: raise AssertionError('UNEXPECTED_FLAVOR')
            ctypes.memmove(buffer,bytes(raw),size);call['bytes']=raw.hex()
        elif self.name=='proc_pidpath':
            raw=b'/owned/test-target\0';ctypes.memmove(args[1],raw,len(raw));result=len(raw)-1;call['bytes']=raw.hex()
            if mode=='path-tail-workspace':
                ctypes.memmove(ctypes.addressof(args[1])+4096-len(raw),raw,len(raw));call['bytes']=ctypes.string_at(args[1],4096).hex()
            if mode=='path-change' and sum(1 for c in calls if c['name']=='proc_pidpath')==2:
                raw=b'/owned/other-path\0';ctypes.memmove(args[1],raw,len(raw));result=len(raw)-1;call['bytes']=raw.hex()
        elif self.name=='kevent':
            fd,changes,count,output,capacity,timeout=args;call.update(fd=fd,count=count,capacity=capacity)
            if count:
                raw=bytearray(ctypes.string_at(changes,32));call['intent']=raw.hex()
                registered.append(struct.unpack('=QhHIqQ',raw))
                if mode=='registration-eintr': result=-1;error=4
                else:
                    struct.pack_into('=H',raw,10,16449 if mode!='wrong-receipt' else 16448)
                    struct.pack_into('=q',raw,16,0);ctypes.memmove(output,bytes(raw),32);result=1;call['bytes']=raw.hex()
                    if mode=='receipt-count-zero': result=0
            elif mode=='wait-eintr': result=-1;error=4
            else:
                raw=struct.pack('=QhHIqQ',78 if mode=='wrong-event' else 77,-5,32881,2147483648 if mode!='mixed-exit' else 3221225472,0,1)
                ctypes.memmove(output,raw,32);result=1;call['bytes']=raw.hex()
                if mode=='duplicate-event': result=2
                if mode in ('multi','multi-duplicate-event'):
                    chosen=list(reversed(registered)) if mode=='multi' else [registered[0],registered[0]]
                    raw=b''.join(struct.pack('=QhHIqQ',row[0],-5,32881,2147483648,0,row[5]) for row in chosen)
                    ctypes.memmove(output,raw,len(raw));result=len(chosen);call['bytes']=raw.hex()
        elif self.name=='close':
            call.update(fd=args[0],descriptorConsumed=True)
            if mode=='close-lost': raise OSError('LOST_CLOSE_RESPONSE')
            if mode=='close-eintr': result=-1;error=4
        else: raise AssertionError('UNEXPECTED_CALL')
        ctypes.set_errno(error);call.update(returned=True,result=result,errno=error);return result
class FakeLibrary:
    def __init__(self):
        for name in ['kqueue','kevent','close','proc_pidinfo','proc_pidpath']: setattr(self,name,FakeCall(name))
library=FakeLibrary();ctypes.CDLL=lambda *args,**kwargs: library
atexit.register(lambda:open(proof,'w').write(json.dumps(calls,sort_keys=True)+'\n'))
if mode=='wrong-abi':
    real_sizeof=ctypes.sizeof
    ctypes.sizeof=lambda value:55 if getattr(value,'__name__',None)=='Unique' else real_sizeof(value)
if mode in ('short-ready-write','ready-flush-loss','short-terminal-write','terminal-flush-loss'):
    real_stdout=sys.stdout
    class OutputBuffer:
        writes=0
        def write(self,raw):
            self.writes+=1
            if (mode=='short-ready-write' and self.writes==1) or (mode=='short-terminal-write' and self.writes==2):
                real_stdout.buffer.write(raw[:-1]);return len(raw)-1
            return real_stdout.buffer.write(raw)
        def flush(self):
            if (mode=='ready-flush-loss' and self.writes==1) or (mode=='terminal-flush-loss' and self.writes==2): raise OSError('LOST_FLUSH_RESPONSE')
            return real_stdout.buffer.flush()
    class Output:
        buffer=OutputBuffer()
        def flush(self): pass
    sys.stdout=Output()
if mode=='deadline':
    tick=[0]
    def clock(): tick[0]+=31;return tick[0]
    time.monotonic=clock
`;
    put("prefix.py", prefix);
    const pids = mode.startsWith("multi") ? [77, 88] : [77];
    const input = canonical({ schema: "setfarm.dashboard-cutover-process-candidates-request.v4", candidates: pids.map(pid => ({ pid })) }) + "\n";
    const result = spawnSync("/usr/bin/python3", ["-I", "-S", "-B", "-u", "-c", prefix + "\n" + source], { cwd: "/", input, encoding: "utf8", timeout: 5000, maxBuffer: 65536, env: { PATH: "/usr/bin:/bin", LANG: "C", LC_ALL: "C" } });
    const calls = JSON.parse(fs.readFileSync(path.join(root, "calls.json"), "utf8"));
    put("original.json", JSON.stringify({ mode, sourceHash: hash(source), prefixHash: hash(prefix), input, calls, result: { status: result.status, signal: result.signal, error: result.error?.code ?? null, stdout: result.stdout, stderr: result.stderr }, qualification: "actual-python-source-libc-double-not-kernel" }, null, 2) + "\n");
    console.log(`PROCESS_EVENTS_PYTHON_ORIGINAL ${root}`);
    assert.equal(result.error, undefined); assert.equal(result.signal, null); assert.equal(result.stderr, "");
    const success = ["good", "queue-fd-zero", "path-tail-workspace", "multi"].includes(mode);
    assert.equal(result.status, success ? 0 : 1);
    const frames = ["short-ready-write", "short-terminal-write"].includes(mode) ? [] : result.stdout.trimEnd().split("\n").filter(Boolean).map(line => { const frame = JSON.parse(line); assert.equal(line, canonical(frame)); return frame; });
    if (success) {
      assert.equal(result.status, 0); assert.deepEqual(frames.map(x => x.state), ["READY", "EXITED"]);
      assert.equal(frames[0].candidates[0].idVersion, "ffffffff");
      assert.deepEqual(frames[0].registrations, pids.map((pid, index) => ({ intentHex: eventHex(pid, 65, 3758096384, index + 1), returned: true, result: 1, errno: 0, receiptHex: eventHex(pid, 16449, 3758096384, index + 1) })));
      assert.deepEqual(frames[1].events, pids.map((pid, index) => ({ pid, ordinal: index + 1, filter: -5, flags: 32881, fflags: 2147483648, data: 0, rawHex: eventHex(pid, 32881, 2147483648, index + 1) })));
    } else { assert.equal(result.status, 1); if (mode !== "terminal-flush-loss") assert.ok(frames.every(frame => frame.state !== "EXITED")); }
    assert.ok(calls.filter(call => call.name === "kqueue").length <= 1);
    assert.ok(calls.filter(call => call.name === "kevent" && call.count === 1).length <= pids.length);
    assert.ok(calls.filter(call => call.name === "kevent" && call.count === 0).length <= 1);
    assert.ok(calls.filter(call => call.name === "close").length <= 1);
    if (["close-eintr", "close-lost"].includes(mode)) assert.equal(calls.filter(call => call.name === "close").length, 1);
    if (["short-terminal-write", "terminal-flush-loss", "queue-fd-zero", "queue-error-with-fd"].includes(mode)) assert.equal(calls.filter(call => call.name === "close").length, 1);
    if (["short-ready-write", "ready-flush-loss"].includes(mode)) assert.equal(calls.filter(call => call.name === "kevent" && call.count === 0).length, 0);
  });
}
