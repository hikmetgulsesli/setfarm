import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { loadRuntimeEnv } from "../runtime-config.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function getSpawnerPidFile(): string {
  return path.join(os.homedir(), ".openclaw", "setfarm", "spawner.pid");
}

export function getSpawnerLogFile(): string {
  return path.join(os.homedir(), ".openclaw", "setfarm", "spawner.log");
}

export function isSpawnerRunning(): { running: true; pid: number } | { running: false } {
  const pidFile = getSpawnerPidFile();
  if (!fs.existsSync(pidFile)) return { running: false };
  const pid = parseInt(fs.readFileSync(pidFile, "utf-8").trim(), 10);
  if (Number.isNaN(pid)) return { running: false };
  try {
    process.kill(pid, 0);
    return { running: true, pid };
  } catch {
    try { fs.unlinkSync(pidFile); } catch {}
    return { running: false };
  }
}

export async function startSpawner(): Promise<{ pid: number; logFile: string }> {
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
  const child = spawn("node", [spawnerScript], {
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
  const status = isSpawnerRunning();
  if (!status.running) return false;
  try {
    process.kill(status.pid, "SIGTERM");
  } catch {}
  try { fs.unlinkSync(getSpawnerPidFile()); } catch {}
  return true;
}

export function getSpawnerStatus(): { running: boolean; pid?: number; logFile: string } {
  const status = isSpawnerRunning();
  return status.running
    ? { running: true, pid: status.pid, logFile: getSpawnerLogFile() }
    : { running: false, logFile: getSpawnerLogFile() };
}
