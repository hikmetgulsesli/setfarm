import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { exerciseGatewayConsumer } from "./helpers/gateway-api-safe-consumer.js";

const node = "/opt/homebrew/Cellar/node/26.4.0/bin/node";
const marker = "GATEWAY_QUEUED_AFTER_CLIENT_SETTLEMENT\n";
const release = "RELEASE_AFTER_CLIENT_SETTLEMENT\n";

function backendProgram(fixture: string): string {
  return String.raw`
const fs=require('node:fs'),http=require('node:http');
const fixture=${JSON.stringify(fixture)},late=fixture+'/late';
const deadline=process.hrtime.bigint()+8_000_000_000n;
const frames=[],sockets=[],emit=row=>{frames.push(row);process.stdout.write(JSON.stringify(row)+'\n')};
const fail=message=>{process.stderr.write(String(message)+'\n');process.exit(2)};
const timer=setTimeout(()=>fail('BACKEND_DEADLINE'),8000);
let resolveQueued,input='',ended=false,queuedDone=false,serverClosed=false,responseFinished=false,responseClosed=false,requestCount=0;
const queued=new Promise(resolve=>{resolveQueued=resolve});
function finish(){if(!ended||!queuedDone||!serverClosed||(requestCount!==0&&(!responseFinished||!responseClosed))||sockets.some(row=>!row.closed))return;
 if(process.hrtime.bigint()>=deadline)fail('BACKEND_LATE_SETTLEMENT');
 emit({kind:'settled',ended,queuedDone,serverClosed,responseFinished,responseClosed,sockets,requestCount});clearTimeout(timer);
}
const server=http.createServer((request,response)=>{
 requestCount++;if(requestCount!==1||request.method!=='POST'||request.url!=='/tools/invoke'||request.headers.authorization!==undefined)
   return fail('BACKEND_REQUEST_REFUSED');
 let bytes='';request.setEncoding('utf8');request.on('data',chunk=>{bytes+=chunk;if(Buffer.byteLength(bytes)>1024)fail('BACKEND_REQUEST_BOUND')});
 request.on('error',error=>fail(error.message));
 request.on('end',()=>{
  if(bytes!==JSON.stringify({tool:'cron',args:{action:'remove',id:'owned-job'},sessionKey:'agent:main:main'}))return fail('BACKEND_BODY_REFUSED');
  emit({kind:'request-end',method:request.method,url:request.url,bytes,authorization:false});
  response.once('finish',()=>{responseFinished=true;emit({kind:'response-finish'});finish()});
  response.once('close',()=>{responseClosed=true;emit({kind:'response-close'});finish()});
  response.writeHead(200,{'Content-Type':'application/json','Connection':'close'});response.end('{"ok":true}');
  emit({kind:'ack',queuedDone,lateExists:fs.existsSync(late)});
 });
});
server.on('error',error=>fail(error.message));
server.on('connection',socket=>{const row={ordinal:sockets.length+1,closed:false};sockets.push(row);
 socket.on('error',error=>fail(error.message));socket.once('close',()=>{row.closed=true;emit({kind:'socket-close',ordinal:row.ordinal});finish()});
});
queued.then(()=>{
 if(process.hrtime.bigint()>=deadline)fail('BACKEND_QUEUED_DEADLINE');
 const bytes=Buffer.from(${JSON.stringify(marker)}),io={openIntents:1,opened:false,writeIntents:0,readIntents:0,closeIntents:0,closed:false};
 let fd;try{
  fd=fs.openSync(late,fs.constants.O_CREAT|fs.constants.O_EXCL|fs.constants.O_RDWR|fs.constants.O_NOFOLLOW,0o600);io.opened=true;
  io.writeIntents++;if(fs.writeSync(fd,bytes,0,bytes.length,0)!==bytes.length)throw Error('BACKEND_PARTIAL_WRITE');
  const read=Buffer.alloc(bytes.length);io.readIntents++;if(fs.readSync(fd,read,0,read.length,0)!==bytes.length||!read.equals(bytes))throw Error('BACKEND_READBACK');
  const stat=fs.fstatSync(fd,{bigint:true});if(!stat.isFile()||stat.nlink!==1n||(stat.mode&0o777n)!==0o600n)throw Error('BACKEND_FILE_IDENTITY');
 }finally{if(fd!==undefined){io.closeIntents++;fs.closeSync(fd);io.closed=true}}
 const stat=fs.lstatSync(late,{bigint:true});queuedDone=true;
 emit({kind:'late',bytes:bytes.toString('utf8'),io,identity:{dev:String(stat.dev),ino:String(stat.ino),uid:Number(stat.uid),mode:Number(stat.mode&0o777n)}});
 server.close(()=>{serverClosed=true;emit({kind:'server-close'});finish()});finish();
}).catch(error=>fail(error.message));
process.stdin.setEncoding('utf8');process.stdin.on('error',error=>fail(error.message));
process.stdin.on('data',chunk=>{input+=chunk;if(input.length>128)fail('BACKEND_INPUT_BOUND')});
process.stdin.once('end',()=>{
 if(input!==${JSON.stringify(release)}&&input!=='RELEASE_AFTER_FAILED_WITNESS\n')return fail('BACKEND_RELEASE_REFUSED');
 ended=true;emit({kind:'release',input});resolveQueued();finish();
});
server.listen(0,'127.0.0.1',()=>{const address=server.address();
 if(!address||typeof address==='string'||address.address!=='127.0.0.1'||[3080,3333,18789].includes(address.port))return fail('BACKEND_BIND_REFUSED');
 emit({kind:'ready',port:address.port,pid:process.pid,queued:true});
});
`;
}

type Event = { event: string; code?: number | null; signal?: NodeJS.Signals | null; error?: string };
type Frame = Record<string, any>; // Retained fixture DATA, never a capability.

test("actual gateway deletion acknowledges while owned backend queued work remains", async () => {
  assert.equal(process.platform, "darwin");
  assert.notEqual(process.getuid?.(), 0);
  assert.equal(fs.realpathSync(process.execPath), node);
  const fixture = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-gateway-queued-ack-v4.")));
  fs.chmodSync(fixture, 0o700);
  const identity = fs.lstatSync(fixture, { bigint: true });
  const program = backendProgram(fixture), frames: Frame[] = [], events: Event[] = [];
  const ledger: Record<string, any> = { scope: "finite-controlled-backend-client-contract-only", fixture,
    identity: { dev: String(identity.dev), ino: String(identity.ino), uid: Number(identity.uid), mode: Number(identity.mode & 0o777n) },
    program, command: node, argv: ["-e", program], frames, events, phase: "created", cleanup: [] };
  fs.writeFileSync(path.join(fixture, "intent.json"), JSON.stringify(ledger), { flag: "wx", mode: 0o600 });
  let child: ChildProcessWithoutNullStreams | undefined, closed: Promise<void> | undefined;
  let stdout = "", stderr = "", pending = "", readyResolve: ((frame: Frame) => void) | undefined;
  let failure: unknown, joined = false, consumerFixture: string | undefined;
  const ready = new Promise<Frame>(resolve => { readyResolve = resolve; });
  try {
    assert.equal(identity.isDirectory(), true); assert.equal(identity.isSymbolicLink(), false);
    assert.equal(Number(identity.uid), process.getuid?.()); assert.equal(Number(identity.mode & 0o777n), 0o700);
    child = spawn(node, ["-e", program], { cwd: fixture, env: { PATH: "/usr/bin:/bin", LANG: "C", LC_ALL: "C" }, stdio: ["pipe", "pipe", "pipe"] });
    ledger.originalPid = child.pid; ledger.phase = "dispatched";
    closed = new Promise(resolve => child!.once("close", (code, signal) => {
      events.push({ event: "close", code, signal }); ledger.status = code; ledger.signal = signal; resolve();
    }));
    child.on("error", error => events.push({ event: "error", error: error.message }));
    child.on("exit", (code, signal) => events.push({ event: "exit", code, signal }));
    for (const [name, stream] of [["stdin", child.stdin], ["stdout", child.stdout], ["stderr", child.stderr]] as const) {
      stream.on("error", error => events.push({ event: name + ":error", error: error.message }));
      for (const event of name === "stdin" ? ["close"] : ["end", "close"])
        stream.on(event, () => events.push({ event: name + ":" + event }));
    }
    child.stderr.on("data", (data: Buffer) => {
      if (Buffer.byteLength(stderr) + data.length > 32768) { ledger.captureFailure = "BACKEND_STDERR_BOUND"; return; }
      stderr += data.toString("utf8");
    });
    child.stdout.on("data", (data: Buffer) => {
      if (Buffer.byteLength(stdout) + data.length > 32768) { ledger.captureFailure = "BACKEND_RAW_BOUND"; return; }
      const text = data.toString("utf8"); stdout += text; pending += text;
      let end: number;
      while ((end = pending.indexOf("\n")) >= 0) {
        const line = pending.slice(0, end); pending = pending.slice(end + 1);
        try { const frame = JSON.parse(line); frames.push(frame); if (frame.kind === "ready") readyResolve?.(frame); }
        catch (error) { ledger.captureFailure = String(error); }
      }
    });
    const selected = await Promise.race([ready, closed.then(() => { throw Error("BACKEND_CLOSED_BEFORE_READY"); })]);
    assert.equal(selected.pid, child.pid); assert.equal(selected.queued, true);
    assert.equal(Number.isInteger(selected.port), true); assert.ok(selected.port > 0 && selected.port <= 65535);
    assert.ok(![3080, 3333, 18789].includes(selected.port)); ledger.ready = selected;
    assert.equal(fs.existsSync(path.join(fixture, "late")), false);
    consumerFixture = await exerciseGatewayConsumer(String.raw`
const original=local.withDashboardCutoverLocalProducerAsyncV2('medic-uninstall',()=>api.deleteCronJob('owned-job'));
const result=await original;assert.deepEqual(result,{ok:true});assert.equal(calls.length,0);assert.equal(requests.length,1);
const js=await local.acquireDashboardCutoverLocalProducerDrainV2();local.assertDashboardCutoverLocalProducerDrainV2(js);
const child=await local.acquireDashboardCutoverLocalChildDrainV3(js);local.assertDashboardCutoverLocalChildDrainV3(child);
out.gatewayAck={result,localOriginalsReady:true,calls:calls.length,requests:requests.map(([url,options])=>({url,method:options.method,body:options.body,authorization:options.headers.Authorization!==undefined}))};
`, "", true, selected.port);
    ledger.consumerFixture = consumerFixture;
    const consumer = JSON.parse(fs.readFileSync(path.join(consumerFixture, "result.json"), "utf8"));
    ledger.consumer = consumer;
    assert.equal(consumer.status, 0); assert.equal(consumer.signal, null); assert.equal(consumer.stderr, "");
    assert.deepEqual(consumer.eof, { stdout: true, stderr: true }); assert.deepEqual(consumer.closes, consumer.eof);
    for (const event of ["exit", "close"])
      assert.deepEqual(consumer.events.find((row: Event) => row.event === event), { event, code: 0, signal: null });
    const result = JSON.parse(consumer.stdout); assert.equal(result.gatewayAck.localOriginalsReady, true);
    assert.deepEqual(result.gatewayAck.result, { ok: true });
    assert.equal(fs.existsSync(path.join(fixture, "late")), false);
    ledger.phase = "consumer-settled"; child.stdin.end(release);
    await closed; joined = true;
    assert.equal(ledger.status, 0); assert.equal(ledger.signal, null); assert.equal(stderr, "");
    assert.equal(pending, ""); assert.equal(ledger.captureFailure, undefined);
    const kinds = frames.map(frame => frame.kind);
    assert.deepEqual(kinds.filter(kind => ["ready", "request-end", "ack", "release", "late", "server-close", "settled"].includes(kind)),
      ["ready", "request-end", "ack", "release", "late", "server-close", "settled"]);
    assert.equal(frames.find(frame => frame.kind === "ack")?.queuedDone, false);
    assert.equal(frames.find(frame => frame.kind === "ack")?.lateExists, false);
    const late = frames.find(frame => frame.kind === "late");
    assert.equal(late?.bytes, marker); assert.deepEqual(late?.io, { openIntents: 1, opened: true, writeIntents: 1, readIntents: 1, closeIntents: 1, closed: true });
    assert.equal(fs.readFileSync(path.join(fixture, "late"), "utf8"), marker);
    const stat = fs.lstatSync(path.join(fixture, "late"), { bigint: true });
    assert.deepEqual(late?.identity, { dev: String(stat.dev), ino: String(stat.ino), uid: Number(stat.uid), mode: 0o600 });
    const after = fs.lstatSync(fixture, { bigint: true });
    assert.equal(after.dev, identity.dev); assert.equal(after.ino, identity.ino);
    assert.equal(Number(after.uid), Number(identity.uid)); assert.equal(Number(after.mode & 0o777n), 0o700);
    const settled = frames.find(frame => frame.kind === "settled");
    assert.equal(settled?.serverClosed, true); assert.equal(settled?.requestCount, 1);
    assert.equal(settled?.responseFinished, true); assert.equal(settled?.responseClosed, true);
    for (const kind of ["response-finish", "response-close"])
      assert.equal(frames.filter(frame => frame.kind === kind).length, 1);
    assert.deepEqual(frames.filter(frame => frame.kind === "socket-close"), [{ kind: "socket-close", ordinal: 1 }]);
    assert.equal(settled?.sockets.length, 1); assert.equal(settled?.sockets[0].closed, true);
    for (const event of ["stdin:close", "stdout:end", "stdout:close", "stderr:end", "stderr:close"])
      assert.equal(events.filter(row => row.event === event).length, 1);
    for (const event of ["exit", "close"])
      assert.deepEqual(events.find(row => row.event === event), { event, code: 0, signal: null });
    ledger.phase = "complete";
    if (process.env.SETFARM_TASK4O_LOCAL_ONLY_CLAIM === "1")
      assert.equal(fs.existsSync(path.join(fixture, "late")), false, "NAIVE_GATEWAY_ACK_EXCLUDES_QUEUED_WORK");
  } catch (error) { failure = error; ledger.phase = "failed"; ledger.failure = error instanceof Error ? error.message : String(error); throw error; }
  finally {
    if (child && !joined) {
      try { if (!child.stdin.writableEnded && !child.stdin.destroyed) child.stdin.end("RELEASE_AFTER_FAILED_WITNESS\n"); ledger.cleanup.push({ step: "original-input", state: "fulfilled" }); }
      catch (error) { ledger.cleanup.push({ step: "original-input", state: "rejected", error: String(error) }); }
      try { assert.ok(closed); await closed; joined = true; ledger.cleanup.push({ step: "original-close", state: "fulfilled" }); }
      catch (error) { ledger.cleanup.push({ step: "original-close", state: "rejected", error: String(error) }); }
    }
    ledger.terminalJoined = joined; ledger.stdout = stdout; ledger.stderr = stderr; ledger.consumerFixture = consumerFixture ?? null;
    fs.writeFileSync(path.join(fixture, "result.json"), JSON.stringify(ledger), { flag: "wx", mode: 0o600 });
    console.log(JSON.stringify({ kind: "owned-gateway-ack-case", fixture, originalPid: ledger.originalPid, status: ledger.status, signal: ledger.signal, consumerFixture }));
    if (!joined && !failure) throw Error("GATEWAY_ACK_ORIGINAL_UNSETTLED");
  }
});
