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
  return path.join(os.homedir(), ".openclaw", "setfarm", "dashboard.pid");
}

export function getLogFile(): string {
  return path.join(os.homedir(), ".openclaw", "setfarm", "dashboard.log");
}

export function isRunning(): { running: true; pid: number } | { running: false } {
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
