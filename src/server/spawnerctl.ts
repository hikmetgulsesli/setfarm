import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execFileSync, spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { loadRuntimeEnv } from "../runtime-config.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function getSpawnerPidFile(): string {
  return path.join(os.homedir(), ".openclaw", "setfarm", "spawner.pid");
}

export function getSpawnerLogFile(): string {
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
