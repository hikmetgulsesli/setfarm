import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const loadedEnvKeys = new Set<string>();

function parseEnvValue(raw: string): string {
  const value = raw.trim();
  const quote = value[0];
  if ((quote === '"' || quote === "'") && value[value.length - 1] === quote) {
    return value.slice(1, -1);
  }
  return value;
}

export function expandRuntimePath(value: string): string {
  return value
    .replace(/^\$HOME(?=\/|$)/, homedir())
    .replace(/^~(?=\/|$)/, homedir());
}

function resolvePackageRoot(): string {
  const moduleDir = dirname(fileURLToPath(import.meta.url));
  const leaf = basename(moduleDir);
  if (leaf === "src" || leaf === "dist") return dirname(moduleDir);
  return moduleDir;
}

function loadEnvFile(envDir: string, filename: string, overrideFileValues: boolean): void {
  const envPath = join(envDir, filename);
  if (!existsSync(envPath)) return;
  const lines = readFileSync(envPath, "utf-8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim().replace(/^export\s+/, "");
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = parseEnvValue(trimmed.slice(eq + 1));
    const alreadyFromProcess = process.env[key] !== undefined && !loadedEnvKeys.has(key);
    if (alreadyFromProcess) continue;
    if (!overrideFileValues && process.env[key] !== undefined) continue;
    process.env[key] = val;
    loadedEnvKeys.add(key);
  }
}

export function loadRuntimeEnv(): void {
  const explicitEnvDir = process.env.SETFARM_ENV_DIR?.trim();
  const envDirs = explicitEnvDir
    ? [expandRuntimePath(explicitEnvDir)]
    : [resolvePackageRoot(), join(homedir(), ".openclaw", "setfarm")];

  for (const envDir of envDirs) {
    loadEnvFile(envDir, ".env", false);
    loadEnvFile(envDir, ".env.local", true);
  }
}

loadRuntimeEnv();

function envPath(key: string, fallback: string): string {
  return expandRuntimePath(process.env[key] || fallback);
}

function trimUrl(value: string): string {
  return value.replace(/\/+$/, "");
}

export const runtimeConfig = {
  missionControlInternalUrl: trimUrl(process.env.MC_INTERNAL_URL || "http://127.0.0.1:3080"),
  setfarmPgUrl: (process.env.SETFARM_PG_URL || "postgresql://postgres@localhost:5432/setfarm").split(/\s+/)[0],
  projectsDir: envPath("PROJECTS_DIR", join(homedir(), "projects")),
  setfarmDir: envPath("SETFARM_DIR", join(homedir(), ".openclaw", "setfarm")),
  setfarmRepoDir: envPath("SETFARM_REPO_DIR", join(homedir(), ".openclaw", "setfarm-repo")),
  scriptsDir: envPath("SCRIPTS_DIR", join(homedir(), ".openclaw", "scripts")),
  cliPath: envPath("CLI_PATH", join(homedir(), ".local", "bin")),
};

export function missionControlApi(pathname: string): string {
  const normalizedPath = pathname.startsWith("/") ? pathname : `/${pathname}`;
  return `${runtimeConfig.missionControlInternalUrl}${normalizedPath}`;
}
