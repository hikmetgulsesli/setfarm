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
export async function exerciseGatewayConsumer(body: string, setup = "", disabled = false): Promise<void> {
  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-gateway-safe-consumer-"));
  const program = `import assert from 'node:assert/strict';
import cp from 'node:child_process';import fsp from 'node:fs/promises';
import os from 'node:os';import {syncBuiltinESMExports} from 'node:module';
const out={};try{
const fixture=${JSON.stringify(fixture)},configured=fixture+'/openclaw',accesses=[],calls=[],requests=[],unhandled=[];
const tick=()=>new Promise(r=>setImmediate(r));
process.on('unhandledRejection',e=>unhandled.push(String(e)));
os.homedir=()=>fixture;process.env.OPENCLAW_CLI=configured;
let accessPort=async()=>{throw Error('INERT_NOT_EXECUTABLE')};
let execPort=()=>{throw Error('UNEXPECTED_EXEC_PORT')};
let fetchPort=async()=>new Response('',{status:404});
const originalReadFile=fsp.readFile;
fsp.readFile=async(p,...args)=>{
 if(String(p)===fixture+'/.openclaw/openclaw.json')return '{}';
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
assert.deepEqual(unhandled,[]);out.passed=true;
}catch(e){out.error=e.message??String(e)}process.stdout.write(JSON.stringify(out));`;
  fs.writeFileSync(path.join(fixture, "intent.json"), JSON.stringify({ program, loader }), { flag: "wx", mode: 0o600 });
  const child = spawn(process.execPath, ["--import", loader, "--input-type=module", "-e", program], {
    cwd: fixture, env: disabled ? { SETFARM_DISABLE_OPENCLAW_CLI_FALLBACK: "1" } : {},
    stdio: ["ignore", "pipe", "pipe"],
  });
  let stdout = "", stderr = "", bytes = 0, unknown: Error | undefined;
  const eof = { stdout: false, stderr: false };
  const closes = { stdout: false, stderr: false };
  child.on("error", error => { unknown ??= error; });
  for (const [stream, name] of [[child.stdout, "stdout"], [child.stderr, "stderr"]] as const) {
    stream.on("error", error => { unknown ??= error; });
    stream.on("end", () => { eof[name] = true; });
    stream.on("close", () => { closes[name] = true; });
    stream.on("data", (chunk: Buffer) => {
      bytes += chunk.length;
      if (bytes > 1048576) { unknown ??= Error("CAPTURE_UNKNOWN"); return; }
      if (name === "stdout") stdout += chunk; else stderr += chunk;
    });
  }
  const [status, signal] = await new Promise<[number | null, NodeJS.Signals | null]>(resolve =>
    child.on("close", (code, sig) => resolve([code, sig])));
  fs.writeFileSync(path.join(fixture, "result.json"), JSON.stringify({ stdout, stderr, status, signal, eof, closes,
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
}
