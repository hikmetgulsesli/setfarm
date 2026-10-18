import { freshInstallationSelectionV1, assertFreshInstallationSelectionUnchangedV1 } from "../installation/fresh-installation-selection-v1.js";
import { prepareFreshInstallationOperationalEntryV1, assertFreshInstallationOperationalEntryV1 } from "../installation/fresh-installation-entry-v1.js";
import { freshServicePathsV1, inspectFreshServiceV1, openFreshServiceLogV1, freshServiceChildEnvironmentV1, stopFreshServiceV1, reclaimFreshServiceAfterHeldChildV1 } from "./fresh-installation-service-controls-v1.js";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execFileSync, spawn, type ChildProcess } from "node:child_process";
import { fileURLToPath } from "node:url";
import { loadRuntimeEnv } from "../runtime-config.js";
import { assertOrdinarySpawnerDeploymentCutoverAdmissionV1 } from "../internal-production/baseline-deployment-cutover-v1.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function getSpawnerPidFile(): string {
  if(selectedServiceControlV1())return freshServicePathsV1("spawner").pidFile;
  return path.join(os.homedir(), ".openclaw", "setfarm", "spawner.pid");
}

export function getSpawnerLogFile(): string {
  if(selectedServiceControlV1())return freshServicePathsV1("spawner").logFile;
  return path.join(os.homedir(), ".openclaw", "setfarm", "spawner.log");
}

function processIsRunning(pid: number): boolean {
  if (!Number.isFinite(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function listSpawnerProcessPids(): number[] {
  let output = "";
  try {
    output = execFileSync("ps", ["-axo", "pid=,command="], {
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "ignore"],
      timeout: 5000,
    });
  } catch {
    return [];
  }

  const pids = new Set<number>();
  for (const line of output.split("\n")) {
    const match = line.trim().match(/^(\d+)\s+([\s\S]+)$/);
    if (!match) continue;
    const pid = Number(match[1]);
    const command = match[2] || "";
    if (!Number.isFinite(pid) || pid === process.pid) continue;
    if (/\bnode\b[\s\S]*\/setfarm\/dist\/spawner\.js\b/.test(command) || /\/dist\/spawner\.js\b/.test(command)) {
      pids.add(pid);
    }
  }
  return [...pids].filter(processIsRunning);
}

function sleepSync(ms: number): void {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    // Atomics.wait provides a small synchronous sleep without busy spinning.
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, Math.min(100, end - Date.now()));
  }
}

export function isSpawnerRunning(): { running: true; pid: number } | { running: false } {
  if(selectedServiceControlV1())return inspectFreshServiceV1("spawner");
  const pidFile = getSpawnerPidFile();
  if (fs.existsSync(pidFile)) {
    const pid = parseInt(fs.readFileSync(pidFile, "utf-8").trim(), 10);
    if (!Number.isNaN(pid) && processIsRunning(pid)) return { running: true, pid };
    try { fs.unlinkSync(pidFile); } catch {}
  }

  const pids = listSpawnerProcessPids();
  if (pids.length > 0) {
    const pid = pids.sort((a, b) => a - b)[0];
    try {
      fs.mkdirSync(path.dirname(pidFile), { recursive: true });
      fs.writeFileSync(pidFile, String(pid));
    } catch {}
    return { running: true, pid };
  }
  return { running: false };
}

export async function startSpawner(): Promise<{ pid: number; logFile: string }> {
  if(selectedServiceControlV1())return startFreshSpawnerV1();
  assertOrdinarySpawnerDeploymentCutoverAdmissionV1();
  const status = isSpawnerRunning();
  if (status.running) {
    return { pid: status.pid, logFile: getSpawnerLogFile() };
  }

  loadRuntimeEnv();

  const logFile = getSpawnerLogFile();
  fs.mkdirSync(path.dirname(getSpawnerPidFile()), { recursive: true });

  const out = fs.openSync(logFile, "a");
  const err = fs.openSync(logFile, "a");
  const spawnerScript = path.resolve(__dirname, "..", "spawner.js");
  const repoRoot = path.resolve(__dirname, "..", "..");
  const child = spawn(process.execPath, [spawnerScript], {
    cwd: repoRoot,
    detached: true,
    stdio: ["ignore", out, err],
    env: {
      ...process.env,
      SETFARM_REPO_DIR: process.env.SETFARM_REPO_DIR || repoRoot,
    },
  });
  child.unref();

  await new Promise((resolve) => setTimeout(resolve, 1500));
  const check = isSpawnerRunning();
  if (!check.running) {
    throw new Error("Spawner failed to start. Check " + logFile);
  }
  return { pid: check.pid, logFile };
}

export function stopSpawner(): boolean {
  if(selectedServiceControlV1())return stopFreshServiceV1("spawner");
  const pids = new Set<number>(listSpawnerProcessPids());
  const status = isSpawnerRunning();
  if (status.running) pids.add(status.pid);
  if (pids.size === 0) return false;
  for (const pid of pids) {
    try { process.kill(pid, "SIGTERM"); } catch {}
  }
  for (let i = 0; i < 30; i += 1) {
    if ([...pids].every((pid) => !processIsRunning(pid))) break;
    sleepSync(100);
  }
  for (const pid of pids) {
    if (processIsRunning(pid)) {
      try { process.kill(pid, "SIGKILL"); } catch {}
    }
  }
  try { fs.unlinkSync(getSpawnerPidFile()); } catch {}
  return true;
}

export function getSpawnerStatus(): { running: boolean; pid?: number; logFile: string } {
  const status = isSpawnerRunning();
  return status.running
    ? { running: true, pid: status.pid, logFile: getSpawnerLogFile() }
    : { running: false, logFile: getSpawnerLogFile() };
}

function selectedServiceControlV1(): boolean {
  assertFreshInstallationSelectionUnchangedV1();
  return freshInstallationSelectionV1 !== null;
}

// Private IPC component only. Custody and actual admission are checked by its caller.
function waitFreshStartingChildReadyV1(child: ChildProcess, service: "dashboard"|"spawner", sourceSha: string, port?: number): Promise<void> {
  return new Promise((resolve,reject)=>{
    let settled=false;
    const finish=(error?:Error):void=>{
      if(settled)return;settled=true;clearTimeout(timer);
      child.off("message",onMessage);child.off("error",onError);child.off("exit",onExit);child.off("disconnect",onDisconnect);
      if(error)reject(error);else resolve();
    };
    const onError=():void=>finish(new Error("FRESH_INSTALLATION_SERVICE_CHILD_ERROR"));
    const onExit=():void=>finish(new Error("FRESH_INSTALLATION_SERVICE_EXITED_BEFORE_READY"));
    const onDisconnect=():void=>finish(new Error("FRESH_INSTALLATION_SERVICE_DISCONNECTED_BEFORE_READY"));
    const onMessage=(value:unknown):void=>{
      if(!value||typeof value!=="object"||Array.isArray(value))return finish(new Error("FRESH_INSTALLATION_SERVICE_READY_INVALID"));
      const m=value as Record<string,unknown>;
      const keys=service==="dashboard"?["type","pid","sourceSha","port"]:["type","pid","sourceSha"];
      if(Object.keys(m).sort().join(",")!==keys.sort().join(",")
        ||m.type!==`setfarm.${service}.ready.v1`||!Number.isSafeInteger(child.pid)||child.pid!<=0
        ||m.pid!==child.pid||m.sourceSha!==sourceSha||(service==="dashboard"&&m.port!==port))
        return finish(new Error("FRESH_INSTALLATION_SERVICE_READY_INVALID"));
      if(child.exitCode!==null||child.signalCode!==null)return onExit();
      finish();
    };
    const timer=setTimeout(()=>finish(new Error("FRESH_INSTALLATION_SERVICE_READY_TIMED_OUT")),30_000);
    child.on("message",onMessage);child.once("error",onError);child.once("exit",onExit);child.once("disconnect",onDisconnect);
    if(child.exitCode!==null||child.signalCode!==null)onExit();
  });
}

// Only the actual held starting child is signaled. Spawner has no forced KILL.
async function stopHeldFreshStartingChildV1(child: ChildProcess, service: "dashboard"|"spawner"): Promise<void> {
  if(child.pid===undefined)return;
  if(child.exitCode===null&&child.signalCode===null)await new Promise<void>((resolve,reject)=>{
    let settled=false;
    const finish=(error?:Error):void=>{
      if(settled)return;settled=true;clearTimeout(deadline);if(force)clearTimeout(force);
      child.off("exit",onExit);child.off("error",onError);
      if(error)reject(error);else resolve();
    };
    const onExit=():void=>finish();
    const onError=():void=>{}; // Only terminal status confirms settlement.
    const force=service==="dashboard"?setTimeout(()=>{try{child.kill("SIGKILL");}catch{}},2_000):undefined;
    const deadline=setTimeout(()=>finish(new Error("FRESH_INSTALLATION_SERVICE_CHILD_CLEANUP_UNCONFIRMED")),service==="dashboard"?4_000:30_000);
    child.once("exit",onExit);child.on("error",onError);
    try{child.kill("SIGTERM");}catch{ /* Still await terminal confirmation. */ }
  });
  if(child.exitCode===null&&child.signalCode===null)throw new Error("FRESH_INSTALLATION_SERVICE_CHILD_CLEANUP_UNCONFIRMED");
  reclaimFreshServiceAfterHeldChildV1(service,child);
}

async function startFreshSpawnerV1():Promise<{pid:number;logFile:string}> {
  const runner=process.env.SETFARM_AGENT_RUNTIME;
  if(runner!=="codex")throw new Error("FRESH_INSTALLATION_SPAWNER_RUNNER_NOT_EXPLICIT_CODEX");
  await prepareFreshInstallationOperationalEntryV1();assertFreshInstallationOperationalEntryV1();
  if(process.env.SETFARM_AGENT_RUNTIME!==runner)throw new Error("FRESH_INSTALLATION_SPAWNER_RUNNER_CHANGED");
  const selected=freshInstallationSelectionV1!;
  if(inspectFreshServiceV1("spawner").running)throw new Error("FRESH_INSTALLATION_SERVICE_ALREADY_RUNNING");
  const paths=freshServicePathsV1("spawner"),script=path.join(selected.paths.repository,"dist","spawner.js");
  let child:ChildProcess|undefined;
  try{
    const log=openFreshServiceLogV1("spawner");
    let spawnFailed=false,spawnFailure:unknown;
    try{child=spawn(process.execPath,[script],{cwd:selected.paths.repository,detached:true,stdio:["ignore",log,log,"ipc"],env:{...freshServiceChildEnvironmentV1(),SETFARM_AGENT_RUNTIME:runner}});}
    catch(error){spawnFailed=true;spawnFailure=error;throw error;}
    finally{
      try{fs.closeSync(log);}
      catch(closeError){
        if(spawnFailed)throw new AggregateError([spawnFailure,closeError],"FRESH_INSTALLATION_SERVICE_SPAWN_AND_LOG_CLOSE_FAILED");
        throw closeError;
      }
    }
    await waitFreshStartingChildReadyV1(child,"spawner",selected.state.origin.sourceSha);
    await new Promise<void>(resolve=>setImmediate(resolve));
    assertFreshInstallationOperationalEntryV1();
    const actual=inspectFreshServiceV1("spawner");
    if(!actual.running||actual.pid!==child.pid||child.exitCode!==null||child.signalCode!==null)throw new Error("FRESH_INSTALLATION_SERVICE_READY_CUSTODY_MISMATCH");
    if(child.connected)child.disconnect();child.unref();return {pid:child.pid!,logFile:paths.logFile};
  }catch(error){
    if(child)try{await stopHeldFreshStartingChildV1(child,"spawner");}catch(cleanup){throw new AggregateError([error,cleanup],"FRESH_INSTALLATION_SERVICE_START_CLEANUP_UNCONFIRMED");}
    throw error;
  }
}
