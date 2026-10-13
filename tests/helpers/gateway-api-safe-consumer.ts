import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";

const importIndex = process.execArgv.indexOf("--import");
const loader = importIndex >= 0 ? process.execArgv[importIndex + 1]! : createRequire(import.meta.url).resolve("tsx");
const gateway = new URL("../../src/installer/gateway-api.ts", import.meta.url).href;
const logger = new URL("../../src/lib/logger.ts", import.meta.url).href;
const drain = new URL("../../src/internal-production/baseline-dashboard-cutover-local-producer-drain-v2.ts", import.meta.url).href;

/** Real full-module consumers, inert outside ports, fresh cache/env each time. */
export async function exerciseGatewayConsumer(body: string, setup = "", disabled = false,
  ownedGatewayPort?: number): Promise<string> {
  if (ownedGatewayPort !== undefined) {
    assert.equal(Number.isInteger(ownedGatewayPort), true);
    assert.ok(ownedGatewayPort > 0 && ownedGatewayPort <= 65535);
    assert.ok(![3080, 3333, 18789].includes(ownedGatewayPort));
    assert.equal(disabled, true, "OWNED_GATEWAY_CLI_FALLBACK_MUST_BE_DISABLED");
  }
  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-gateway-safe-consumer-"));
  const created = fs.lstatSync(fixture, { bigint: true });
  const fixtureIdentity = { dev: String(created.dev), ino: String(created.ino), uid: Number(created.uid), mode: Number(created.mode & 0o777n) };
  const program = `import assert from 'node:assert/strict';
import cp from 'node:child_process';import fsp from 'node:fs/promises';
import os from 'node:os';import {syncBuiltinESMExports} from 'node:module';
const out={};let ownedTimer;${ownedGatewayPort === undefined ? "" : "const ownedDeadline=process.hrtime.bigint()+8_000_000_000n;ownedTimer=setTimeout(()=>process.exit(2),8000);"}try{
const fixture=${JSON.stringify(fixture)},configured=fixture+'/openclaw',accesses=[],calls=[],requests=[],unhandled=[];
const tick=()=>new Promise(r=>setImmediate(r));
process.on('unhandledRejection',e=>unhandled.push(String(e)));
os.homedir=()=>fixture;process.env.OPENCLAW_CLI=configured;
let accessPort=async()=>{throw Error('INERT_NOT_EXECUTABLE')};
let execPort=()=>{throw Error('UNEXPECTED_EXEC_PORT')};
const originalFetch=globalThis.fetch;
let fetchPort=${ownedGatewayPort === undefined ? "async()=>new Response('',{status:404})" : `async(url,options)=>{
 assert.equal(url,'http://127.0.0.1:${ownedGatewayPort}/tools/invoke');
 assert.equal(options.method,'POST');assert.deepEqual(options.headers,{'Content-Type':'application/json'});
 assert.equal(options.body,JSON.stringify({tool:'cron',args:{action:'remove',id:'owned-job'},sessionKey:'agent:main:main'}));
 assert.equal(requests.length,1);return originalFetch(url,{...options,redirect:'error'});
}`};
const originalReadFile=fsp.readFile;
fsp.readFile=async(p,...args)=>{
 if(String(p)===fixture+'/.openclaw/openclaw.json')return ${JSON.stringify(ownedGatewayPort === undefined ? "{}" : JSON.stringify({gateway:{port:ownedGatewayPort}}))};
 return originalReadFile(p,...args);
};
fsp.access=async(p,mode)=>{accesses.push({path:String(p),mode});return accessPort(p,mode)};
for(const name of ['spawn','spawnSync','fork','exec','execSync','execFileSync'])
 cp[name]=()=>{throw Error('UNEXPECTED_SUBPROCESS_'+name)};
cp.execFile=(...args)=>{calls.push(args);return execPort(...args)};
globalThis.fetch=async(...args)=>{requests.push(args);return fetchPort(...args)};
syncBuiltinESMExports();
const {logger}=await import(${JSON.stringify(logger)});
for(const key of ['info','warn','error','debug'])logger[key]=()=>{};
${setup}
const api=await import(${JSON.stringify(gateway)}),local=await import(${JSON.stringify(drain)});
${body}
assert.deepEqual(unhandled,[]);${ownedGatewayPort === undefined ? "" : "assert.ok(process.hrtime.bigint()<ownedDeadline,'OWNED_GATEWAY_CONSUMER_DEADLINE');"}out.passed=true;
}catch(e){out.error=e.message??String(e)}process.stdout.write(JSON.stringify(out)${ownedGatewayPort === undefined ? "" : ",error=>{if(error)process.exitCode=2;clearTimeout(ownedTimer)}"});`;
  fs.writeFileSync(path.join(fixture, "intent.json"), JSON.stringify({ fixture, fixtureIdentity, program, loader }), { flag: "wx", mode: 0o600 });
  const child = spawn(process.execPath, ["--import", loader, "--input-type=module", "-e", program], {
    cwd: fixture, env: disabled ? { SETFARM_DISABLE_OPENCLAW_CLI_FALLBACK: "1" } : {},
    stdio: ["ignore", "pipe", "pipe"],
  });
  let stdout = "", stderr = "", bytes = 0, unknown: Error | undefined;
  const eof = { stdout: false, stderr: false };
  const closes = { stdout: false, stderr: false };
  const events: Array<{ event: string; code?: number | null; signal?: NodeJS.Signals | null; error?: string }> = [];
  child.on("error", error => { unknown ??= error; events.push({ event: "error", error: error.message }); });
  child.on("exit", (code, signal) => events.push({ event: "exit", code, signal }));
  for (const [stream, name] of [[child.stdout, "stdout"], [child.stderr, "stderr"]] as const) {
    stream.on("error", error => { unknown ??= error; });
    stream.on("end", () => { eof[name] = true; events.push({ event: name + ":end" }); });
    stream.on("close", () => { closes[name] = true; events.push({ event: name + ":close" }); });
    stream.on("data", (chunk: Buffer) => {
      bytes += chunk.length;
      if (bytes > 1048576) { unknown ??= Error("CAPTURE_UNKNOWN"); return; }
      if (name === "stdout") stdout += chunk; else stderr += chunk;
    });
  }
  const [status, signal] = await new Promise<[number | null, NodeJS.Signals | null]>(resolve =>
    child.on("close", (code, sig) => { events.push({ event: "close", code, signal: sig }); resolve([code, sig]); }));
  fs.writeFileSync(path.join(fixture, "result.json"), JSON.stringify({ fixture, fixtureIdentity, originalPid: child.pid, events, stdout, stderr, status, signal, eof, closes,
    unknown: unknown?.message }), { flag: "wx", mode: 0o600 });
  console.log(JSON.stringify({ fixture, status, signal, eof, closes }));
  assert.equal(unknown, undefined);
  assert.equal(signal, null);
  assert.equal(status, 0, stderr);
  assert.deepEqual(eof, { stdout: true, stderr: true });
  assert.deepEqual(closes, { stdout: true, stderr: true });
  assert.equal(stderr, "");
  const result = JSON.parse(stdout);
  assert.equal(result.error, undefined, result.error);
  assert.equal(result.passed, true);
  // Retain this owned fixture; no cleanup of user data or evidence.
  return fixture; // DATA for the retained original receipt, never an owner capability.
}
