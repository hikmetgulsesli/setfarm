import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { applyRuntimeEnvFileV1, normalizeRuntimePathV1 } from "./internal-production/baseline-spawner-launch-environment-v1.js";
import { resolveInternalProductionColdSpawnerHelperRuntimeSnapshotV1, resolveInternalProductionColdSpawnerChildRuntimeSnapshotV1 } from "./internal-production/baseline-restart-authority-retirement-v1.js";
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
let runtimeEnvironmentModeV1: "unloaded" | "ordinary" | "cold-helper" | "cold-child" = "unloaded";
let coldHelperEffectiveEnvironmentV1: Readonly<Record<string, string>> | null = null;

function environmentIdentityV1(environment: Readonly<Record<string, string | undefined>>): string {
  return JSON.stringify(Object.keys(environment).sort().map((key) => [key, environment[key]]));
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
  applyRuntimeEnvFileV1(process.env, loadedEnvKeys, readFileSync(envPath, "utf-8"), overrideFileValues);
}

export function loadRuntimeEnv(): void {
  const refuse = (): never => { throw new Error("INTERNAL_PRODUCTION_COLD_HELPER_CONFIGURATION_INVALID"); };
  let snapshot: ReturnType<typeof resolveInternalProductionColdSpawnerHelperRuntimeSnapshotV1>;
  try { snapshot = resolveInternalProductionColdSpawnerHelperRuntimeSnapshotV1(); } catch { return refuse(); }
  const childModeKey = "SETFARM_INTERNAL_PRODUCTION_COLD_CHILD";
  let childSnapshot: ReturnType<typeof resolveInternalProductionColdSpawnerChildRuntimeSnapshotV1>;
  const refuseChild = (): never => { throw new Error("INTERNAL_PRODUCTION_COLD_CHILD_CONFIGURATION_INVALID"); };
  try { childSnapshot = resolveInternalProductionColdSpawnerChildRuntimeSnapshotV1(); } catch { return refuseChild(); }
  if (childSnapshot !== null || process.env[childModeKey] !== undefined || runtimeEnvironmentModeV1 === "cold-child") {
    if (!childSnapshot || process.env[childModeKey] !== "1" || snapshot !== null || process.env.SETFARM_INTERNAL_PRODUCTION_COLD_HELPER !== undefined
      || runtimeEnvironmentModeV1 === "ordinary" || runtimeEnvironmentModeV1 === "cold-helper") refuseChild();
    const environment = childSnapshot!.environment;
    const effective = Object.freeze({ ...environment, PATH: normalizeRuntimePathV1(environment.PATH!, homedir(), process.execPath), [childModeKey]: "1" });
    if (coldHelperEffectiveEnvironmentV1 === null) {
      for (const key of Object.keys(process.env)) delete process.env[key];
      Object.assign(process.env, effective);
      coldHelperEffectiveEnvironmentV1 = effective;
      runtimeEnvironmentModeV1 = "cold-child";
    } else if (environmentIdentityV1(effective) !== environmentIdentityV1(coldHelperEffectiveEnvironmentV1)
      || environmentIdentityV1(process.env) !== environmentIdentityV1(coldHelperEffectiveEnvironmentV1)) refuseChild();
    return;
  }
  const modeKey = "SETFARM_INTERNAL_PRODUCTION_COLD_HELPER";
  const selected = process.env[modeKey];
  if (snapshot !== null || selected !== undefined || runtimeEnvironmentModeV1 === "cold-helper") {
    if (!snapshot || selected !== "1" || runtimeEnvironmentModeV1 === "ordinary") refuse();
    const environment = snapshot!.environment;
    const effective = Object.freeze({ ...environment, PATH: normalizeRuntimePathV1(environment.PATH!, homedir(), process.execPath), [modeKey]: "1" });
    if (coldHelperEffectiveEnvironmentV1 === null) {
      for (const key of Object.keys(process.env)) delete process.env[key];
      Object.assign(process.env, effective);
      coldHelperEffectiveEnvironmentV1 = effective;
      runtimeEnvironmentModeV1 = "cold-helper";
    } else if (environmentIdentityV1(effective) !== environmentIdentityV1(coldHelperEffectiveEnvironmentV1)
      || environmentIdentityV1(process.env) !== environmentIdentityV1(coldHelperEffectiveEnvironmentV1)) refuse();
    return;
  }
  runtimeEnvironmentModeV1 = "ordinary";
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
  process.env.PATH = normalizeRuntimePathV1(process.env.PATH || "", homedir(), process.execPath);
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

export type ArtifactStorePublicationAuthorityMode =
  | "standalone"
  | "hybrid-required";

export function resolveArtifactStorePublicationAuthorityMode(
  env: NodeJS.ProcessEnv = process.env,
): ArtifactStorePublicationAuthorityMode {
  const raw = env.SETFARM_ARTIFACT_STORE_AUTHORITY_V1?.trim();
  if (!raw || raw === "disabled") return "standalone";
  if (raw === "enabled") return "hybrid-required";
  throw new Error("SETFARM_ARTIFACT_STORE_AUTHORITY_V1_INVALID");
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
