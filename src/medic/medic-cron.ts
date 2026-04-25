/**
 * Medic cron management.
 *
 * The watchdog must not run as an OpenClaw agent turn. That path consumes model
 * time, creates session transcripts, and can block gateway health checks when
 * the model stalls. Run deterministic CLI medic through a user systemd timer.
 */
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { deleteCronJob } from "../installer/gateway-api.js";
import { resolveSetfarmCli } from "../installer/paths.js";
import { readOpenClawConfig, writeOpenClawConfig } from "../installer/openclaw-config.js";

const MEDIC_CRON_NAME = "setfarm/medic";
const MEDIC_SERVICE_NAME = "setfarm-medic.service";
const MEDIC_TIMER_NAME = "setfarm-medic.timer";
const MEDIC_ENV_NAME = "setfarm-medic.env";
const execFileAsync = promisify(execFile);

function systemdEnv(): NodeJS.ProcessEnv {
  const uid = os.userInfo().uid;
  return {
    ...process.env,
    XDG_RUNTIME_DIR: `/run/user/${uid}`,
    DBUS_SESSION_BUS_ADDRESS: `unix:path=/run/user/${uid}/bus`,
  };
}

async function runSystemctl(args: string[]): Promise<void> {
  await execFileAsync("systemctl", ["--user", ...args], {
    timeout: 30_000,
    env: systemdEnv(),
  });
}

async function runSystemctlOutput(args: string[]): Promise<string> {
  const { stdout } = await execFileAsync("systemctl", ["--user", ...args], {
    timeout: 30_000,
    env: systemdEnv(),
  });
  return String(stdout);
}

function unitDir(): string {
  return path.join(os.homedir(), ".config", "systemd", "user");
}

function envFilePath(): string {
  return path.join(os.homedir(), ".openclaw", MEDIC_ENV_NAME);
}

function repoRootFromCli(cliPath: string): string {
  return path.resolve(path.dirname(cliPath), "../..");
}

function serviceBody(cliPath: string): string {
  const repoRoot = repoRootFromCli(cliPath);
  return `[Unit]
Description=Setfarm Medic watchdog
After=openclaw-gateway.service setfarm-spawner.service

[Service]
Type=oneshot
WorkingDirectory=${repoRoot}
Environment=HOME=${os.homedir()}
Environment=SETFARM_MEDIC_SYSTEMD=1
Environment=SETFARM_DISABLE_OPENCLAW_CLI_FALLBACK=1
EnvironmentFile=-${envFilePath()}
ExecStart=/usr/bin/env node ${cliPath} medic run
`;
}

function timerBody(): string {
  return `[Unit]
Description=Run Setfarm Medic every 5 minutes

[Timer]
OnBootSec=2min
OnUnitActiveSec=5min
AccuracySec=30s
Persistent=true

[Install]
WantedBy=timers.target
`;
}

async function discoverPgUrlFromSystemd(): Promise<string | undefined> {
  try {
    const env = await runSystemctlOutput(["show", "setfarm-spawner.service", "-p", "Environment", "--value"]);
    const match = env.match(/(?:^|\s)SETFARM_PG_URL=([^\s]+)/);
    if (match?.[1]) return match[1];
  } catch {
    // best-effort
  }
  return undefined;
}

async function writeMedicEnvFile(): Promise<void> {
  const pgUrl = process.env.SETFARM_PG_URL || await discoverPgUrlFromSystemd();
  if (!pgUrl) return;
  const filePath = envFilePath();
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `SETFARM_PG_URL=${pgUrl}\n`, { encoding: "utf-8", mode: 0o600 });
  await fs.chmod(filePath, 0o600);
}

async function installSystemdMedicTimer(): Promise<{ ok: boolean; error?: string }> {
  try {
    const dir = unitDir();
    await fs.mkdir(dir, { recursive: true });
    const cli = resolveSetfarmCli();
    await writeMedicEnvFile();
    await fs.writeFile(path.join(dir, MEDIC_SERVICE_NAME), serviceBody(cli), "utf-8");
    await fs.writeFile(path.join(dir, MEDIC_TIMER_NAME), timerBody(), "utf-8");
    await runSystemctl(["daemon-reload"]);
    await runSystemctl(["enable", "--now", MEDIC_TIMER_NAME]);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

async function uninstallSystemdMedicTimer(): Promise<{ ok: boolean; error?: string }> {
  try {
    try { await runSystemctl(["disable", "--now", MEDIC_TIMER_NAME]); } catch {}
    await fs.rm(path.join(unitDir(), MEDIC_TIMER_NAME), { force: true });
    await fs.rm(path.join(unitDir(), MEDIC_SERVICE_NAME), { force: true });
    await runSystemctl(["daemon-reload"]);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

async function isSystemdMedicTimerInstalled(): Promise<boolean> {
  try {
    await runSystemctl(["is-enabled", "--quiet", MEDIC_TIMER_NAME]);
    return true;
  } catch {
    return false;
  }
}

async function removeMedicAgent(): Promise<void> {
  try {
    const { path: configPath, config } = await readOpenClawConfig();
    const agents = config.agents?.list ?? [];
    const idx = agents.findIndex((a: any) => a.id === "setfarm-medic");
    if (idx === -1) return;
    agents.splice(idx, 1);
    await writeOpenClawConfig(configPath, config);
  } catch {
    // best-effort
  }
}

export async function installMedicCron(): Promise<{ ok: boolean; error?: string }> {
  // Migrate away from the legacy OpenClaw agent cron if it exists.
  await removeLegacyMedicCronJob();
  await removeMedicAgent();

  return installSystemdMedicTimer();
}

export async function uninstallMedicCron(): Promise<{ ok: boolean; error?: string }> {
  const legacyResult = await removeLegacyMedicCronJob();
  await removeMedicAgent();
  const timerResult = await uninstallSystemdMedicTimer();
  if (!legacyResult.ok) return legacyResult;
  return timerResult;
}

export async function isMedicCronInstalled(): Promise<boolean> {
  if (await isSystemdMedicTimerInstalled()) return true;
  return (await findLegacyMedicCronJob()) !== null;
}

type CronJob = { id: string; name: string };
type CronFile = { jobs?: CronJob[] } | CronJob[];

function cronJobsPath(): string {
  return path.join(os.homedir(), ".openclaw", "cron", "jobs.json");
}

async function readCronFile(): Promise<{ file: CronFile; jobs: CronJob[] } | null> {
  try {
    const raw = await fs.readFile(cronJobsPath(), "utf-8");
    const file = JSON.parse(raw) as CronFile;
    const jobs = Array.isArray(file) ? file : file.jobs ?? [];
    return { file, jobs };
  } catch {
    return null;
  }
}

async function findLegacyMedicCronJob(): Promise<CronJob | null> {
  const parsed = await readCronFile();
  if (!parsed) return null;
  return parsed.jobs.find(j => j.name === MEDIC_CRON_NAME) ?? null;
}

async function removeLegacyMedicCronJob(): Promise<{ ok: boolean; error?: string }> {
  const parsed = await readCronFile();
  if (!parsed) return { ok: true };
  const job = parsed.jobs.find(j => j.name === MEDIC_CRON_NAME);
  if (!job) return { ok: true };

  try {
    const result = await deleteCronJob(job.id);
    if (result.ok) return { ok: true };
  } catch {
    // Fall back to direct storage migration below.
  }

  const remaining = parsed.jobs.filter(j => j.name !== MEDIC_CRON_NAME);
  const nextFile = Array.isArray(parsed.file) ? remaining : { ...parsed.file, jobs: remaining };
  const target = cronJobsPath();
  const tmp = `${target}.tmp-${process.pid}`;
  try {
    await fs.writeFile(tmp, `${JSON.stringify(nextFile, null, 2)}\n`, "utf-8");
    await fs.rename(tmp, target);
    return { ok: true };
  } catch (err) {
    try { await fs.rm(tmp, { force: true }); } catch {}
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
