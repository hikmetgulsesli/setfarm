import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { basename, delimiter, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  DEFAULT_ARTIFACT_CAPACITY_LIMITS,
  normalizeArtifactCapacityLimits,
  type ArtifactCapacityLimits,
} from "./product-compiler/artifact-capacity.js";
import {
  DEFAULT_V3_SEAL_CAPACITY_LIMITS,
  normalizeV3SealCapacityLimits,
  type V3SealCapacityLimits,
} from "./execution/v3-seal-capacity.js";

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
  ensureRuntimePath();
}

function ensureRuntimePath(): void {
  const nodeDir = dirname(process.execPath);
  const existing = (process.env.PATH || "")
    .split(delimiter)
    .filter(Boolean);
  const required = [
    nodeDir,
    join(homedir(), ".local", "bin"),
    "/opt/homebrew/bin",
    "/usr/local/bin",
    "/usr/bin",
    "/bin",
    "/usr/sbin",
    "/sbin",
  ];
  const next: string[] = [];
  for (const entry of [...required, ...existing]) {
    if (!entry || next.includes(entry)) continue;
    next.push(entry);
  }
  process.env.PATH = next.join(delimiter);
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

export function resolveProductArtifactDir(
  env: NodeJS.ProcessEnv = process.env,
): string {
  const explicit = env.SETFARM_PRODUCT_ARTIFACT_DIR?.trim();
  return explicit
    ? expandRuntimePath(explicit)
    : join(runtimeConfig.setfarmDir, "product-compiler", "artifacts", "sha256");
}

export function resolveConvergenceEvalResultDir(
  env: NodeJS.ProcessEnv = process.env,
): string {
  const explicit = env.SETFARM_CONVERGENCE_RESULT_DIR?.trim();
  return explicit
    ? expandRuntimePath(explicit)
    : join(resolvePackageRoot(), ".setfarm", "evals", "results");
}

function capacityEnvInteger(
  env: NodeJS.ProcessEnv,
  key: string,
  fallback: number,
): number {
  const raw = env[key]?.trim();
  if (!raw) return fallback;
  if (!/^[0-9]+$/.test(raw)) throw new Error(`${key}_INVALID`);
  const value = Number(raw);
  if (!Number.isSafeInteger(value)) throw new Error(`${key}_INVALID`);
  return value;
}

export function resolveProductArtifactCapacity(
  env: NodeJS.ProcessEnv = process.env,
): ArtifactCapacityLimits {
  return normalizeArtifactCapacityLimits({
    maxPayloadBytes: capacityEnvInteger(
      env,
      "SETFARM_ARTIFACT_MAX_PAYLOAD_BYTES",
      DEFAULT_ARTIFACT_CAPACITY_LIMITS.maxPayloadBytes,
    ),
    rootQuotaBytes: capacityEnvInteger(
      env,
      "SETFARM_ARTIFACT_ROOT_QUOTA_BYTES",
      DEFAULT_ARTIFACT_CAPACITY_LIMITS.rootQuotaBytes,
    ),
    minFreeBytes: capacityEnvInteger(
      env,
      "SETFARM_ARTIFACT_MIN_FREE_BYTES",
      DEFAULT_ARTIFACT_CAPACITY_LIMITS.minFreeBytes,
    ),
  });
}

export function resolveV3SealCapacity(
  env: NodeJS.ProcessEnv = process.env,
): V3SealCapacityLimits {
  return normalizeV3SealCapacityLimits({
    rootQuotaBytes: capacityEnvInteger(
      env,
      "SETFARM_V3_SEAL_ROOT_QUOTA_BYTES",
      DEFAULT_V3_SEAL_CAPACITY_LIMITS.rootQuotaBytes,
    ),
    maxSealCount: capacityEnvInteger(
      env,
      "SETFARM_V3_SEAL_MAX_COUNT",
      DEFAULT_V3_SEAL_CAPACITY_LIMITS.maxSealCount,
    ),
    minFreeBytes: capacityEnvInteger(
      env,
      "SETFARM_V3_SEAL_MIN_FREE_BYTES",
      DEFAULT_V3_SEAL_CAPACITY_LIMITS.minFreeBytes,
    ),
  });
}

export function missionControlApi(pathname: string): string {
  const normalizedPath = pathname.startsWith("/") ? pathname : `/${pathname}`;
  return `${runtimeConfig.missionControlInternalUrl}${normalizedPath}`;
}
