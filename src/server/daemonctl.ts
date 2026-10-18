import { freshInstallationSelectionV1, assertFreshInstallationSelectionUnchangedV1 } from "../installation/fresh-installation-selection-v1.js";
import { prepareFreshInstallationOperationalEntryV1, assertFreshInstallationOperationalEntryV1 } from "../installation/fresh-installation-entry-v1.js";
import { freshServicePathsV1, inspectFreshServiceV1, openFreshServiceLogV1, freshServiceChildEnvironmentV1, stopFreshServiceV1, reclaimFreshServiceAfterHeldChildV1 } from "./fresh-installation-service-controls-v1.js";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { spawn, type ChildProcess } from "node:child_process";
import { fileURLToPath } from "node:url";
import "../runtime-config.js";
import { assertOrdinaryDashboardDeploymentCutoverAdmissionV2 } from "../internal-production/baseline-deployment-cutover-v1.js";
import { assertTask6aPreSchemaOrdinaryStartupV2 } from "../internal-production/baseline-task6a-preschema-ordinary-refusal-v2.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function getPidFile(): string {
  if(selectedServiceControlV1())return freshServicePathsV1("dashboard").pidFile;
  return path.join(os.homedir(), ".openclaw", "setfarm", "dashboard.pid");
}

export function getLogFile(): string {
  if(selectedServiceControlV1())return freshServicePathsV1("dashboard").logFile;
  return path.join(os.homedir(), ".openclaw", "setfarm", "dashboard.log");
}

export function isRunning(): { running: true; pid: number } | { running: false } {
  if(selectedServiceControlV1())return inspectFreshServiceV1("dashboard");
  const pidFile = getPidFile();
  if (!fs.existsSync(pidFile)) return { running: false };
  const pid = parseInt(fs.readFileSync(pidFile, "utf-8").trim(), 10);
  if (isNaN(pid)) return { running: false };
  try {
    process.kill(pid, 0);
    return { running: true, pid };
  } catch {
    // Stale PID file
    try { fs.unlinkSync(pidFile); } catch {}
    return { running: false };
  }
}

function waitForDashboardReady(child: ChildProcess, port: number, logFile: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const finish = (error?: Error): void => {
      clearTimeout(timer);
      child.off("message", onMessage); child.off("error", onError); child.off("exit", onExit);
      child.off("disconnect", onDisconnect);
      if (error) reject(error); else resolve();
    };
    const onError = (error: Error): void => finish(error);
    const onExit = (): void => finish(new Error("Daemon exited before listener readiness. Check " + logFile));
    const onDisconnect = (): void => finish(new Error("Daemon disconnected before listener readiness. Check " + logFile));
    const onMessage = (message: unknown): void => {
      if (message === null || typeof message !== "object" || Array.isArray(message)
        || Object.keys(message).length !== 3
        || (message as Record<string, unknown>).type !== "setfarm.dashboard.ready.v1"
        || (message as Record<string, unknown>).pid !== child.pid
        || (message as Record<string, unknown>).port !== port) {
        finish(new Error("Invalid daemon readiness message. Check " + logFile)); return;
      }
      finish();
    };
    const timer = setTimeout(() => finish(new Error("Daemon listener readiness timed out. Check " + logFile)), 30_000);
    child.on("message", onMessage); child.once("error", onError); child.once("exit", onExit);
    child.once("disconnect", onDisconnect);
  });
}

async function stopOwnedStartingChild(child: ChildProcess, pidFile: string): Promise<void> {
  if (child.pid === undefined) return;
  if (child.exitCode === null && child.signalCode === null) await new Promise<void>((resolve, reject) => {
    const finish = (error?: Error): void => {
      clearTimeout(force); clearTimeout(deadline);
      child.off("exit", onExit); child.off("error", onError);
      if (error) reject(error); else resolve();
    };
    const onExit = (): void => finish();
    const onError = (): void => { /* Only a terminal event confirms cleanup. */ };
    const force = setTimeout(() => child.kill("SIGKILL"), 2000);
    const deadline = setTimeout(() => finish(new Error("Starting daemon termination was not confirmed")), 4000);
    child.once("exit", onExit); child.on("error", onError);
    child.kill("SIGTERM");
  });
  // A forced exit cannot run the child's exit handler. Never remove a live
  // or unconfirmed child's record, or a record containing another PID.
  if (child.exitCode === null && child.signalCode === null) throw new Error("Starting daemon termination was not confirmed");
  try {
    if (fs.readFileSync(pidFile, "utf8") === String(child.pid)) fs.unlinkSync(pidFile);
  } catch {}
}

export async function startDaemon(port = 3333): Promise<{ pid: number; port: number }> {
  if(selectedServiceControlV1())return startFreshDashboardDaemonV1(port);
  assertOrdinaryDashboardDeploymentCutoverAdmissionV2();
  await assertTask6aPreSchemaOrdinaryStartupV2();
  assertOrdinaryDashboardDeploymentCutoverAdmissionV2();
  const status = isRunning();
  if (status.running) {
    return { pid: status.pid, port };
  }

  const logFile = getLogFile();
  const pidFile = getPidFile();
  const pidDir = path.dirname(pidFile);
  fs.mkdirSync(pidDir, { recursive: true });

  const daemonScript = path.resolve(__dirname, "daemon.js");
  let child: ChildProcess | undefined;
  try {
    const log = fs.openSync(logFile, "a");
    try {
      child = spawn(process.execPath, [daemonScript, String(port)], {
        detached: true,
        stdio: ["ignore", log, log, "ipc"],
      });
    } finally { fs.closeSync(log); }
    await waitForDashboardReady(child, port, logFile);
    if (child.connected) child.disconnect();
    child.unref();
    return { pid: child.pid!, port };
  } catch (error) {
    if (child) await stopOwnedStartingChild(child, pidFile);
    throw error;
  }
}

export function stopDaemon(): boolean {
  if(selectedServiceControlV1())return stopFreshServiceV1("dashboard");
  const status = isRunning();
  if (!status.running) return false;
  try {
    process.kill(status.pid, "SIGTERM");
  } catch {}
  try { fs.unlinkSync(getPidFile()); } catch {}
  return true;
}

export function getDaemonStatus(): { running: boolean; pid?: number; port?: number } | null {
  const status = isRunning();
  if (!status.running) return { running: false };
  return { running: true, pid: status.pid };
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

async function startFreshDashboardDaemonV1(port:number):Promise<{pid:number;port:number}> {
  if(!Number.isSafeInteger(port)||port<1||port>65535)throw new Error("FRESH_INSTALLATION_SERVICE_PORT_INVALID");
  await prepareFreshInstallationOperationalEntryV1();assertFreshInstallationOperationalEntryV1();
  const selected=freshInstallationSelectionV1!;
  if(inspectFreshServiceV1("dashboard").running)throw new Error("FRESH_INSTALLATION_SERVICE_ALREADY_RUNNING");
  const paths=freshServicePathsV1("dashboard"),script=path.join(selected.paths.repository,"dist","server","daemon.js");
  let child:ChildProcess|undefined;
  try{
    const log=openFreshServiceLogV1("dashboard");
    let spawnFailed=false,spawnFailure:unknown;
    try{child=spawn(process.execPath,[script,String(port)],{cwd:selected.paths.repository,detached:true,stdio:["ignore",log,log,"ipc"],env:freshServiceChildEnvironmentV1()});}
    catch(error){spawnFailed=true;spawnFailure=error;throw error;}
    finally{
      try{fs.closeSync(log);}
      catch(closeError){
        if(spawnFailed)throw new AggregateError([spawnFailure,closeError],"FRESH_INSTALLATION_SERVICE_SPAWN_AND_LOG_CLOSE_FAILED");
        throw closeError;
      }
    }
    await waitFreshStartingChildReadyV1(child,"dashboard",selected.state.origin.sourceSha,port);
    await new Promise<void>(resolve=>setImmediate(resolve));
    assertFreshInstallationOperationalEntryV1();
    const actual=inspectFreshServiceV1("dashboard");
    if(!actual.running||actual.pid!==child.pid||child.exitCode!==null||child.signalCode!==null)throw new Error("FRESH_INSTALLATION_SERVICE_READY_CUSTODY_MISMATCH");
    if(child.connected)child.disconnect();child.unref();return {pid:child.pid!,port};
  }catch(error){
    if(child)try{await stopHeldFreshStartingChildV1(child,"dashboard");}catch(cleanup){throw new AggregateError([error,cleanup],"FRESH_INSTALLATION_SERVICE_START_CLEANUP_UNCONFIRMED");}
    throw error;
  }
}
