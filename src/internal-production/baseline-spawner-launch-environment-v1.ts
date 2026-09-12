import { createHash } from "node:crypto";
import { fstatSync, readSync, type BigIntStats } from "node:fs";

// Fixed inherited transport slot; returned bytes remain UNTRUSTED. This only
// prevents unsafe reads. No environment installation or launch is authorized.
export function readInternalProductionSpawnerUntrustedInheritedFrameV1(): Buffer {
  try {
    const before = fstatSync(3, { bigint: true });
    const uid = process.getuid?.();
    if (uid === undefined || !before.isFile() || before.uid !== BigInt(uid)
      || before.nlink !== 0n || (before.mode & 0o7777n) !== 0o600n
      || before.size < 1n || before.size > 1024n * 1024n) fail();
    const bytes = Buffer.alloc(Number(before.size));
    let offset = 0;
    while (offset < bytes.length) {
      const count = readSync(3, bytes, offset, Math.min(64 * 1024, bytes.length - offset), offset);
      if (count <= 0) fail();
      offset += count;
    }
    const identity = (stats: BigIntStats) => [stats.dev, stats.ino, stats.mode, stats.uid, stats.gid,
      stats.nlink, stats.size, stats.birthtimeNs, stats.mtimeNs, stats.ctimeNs].join(":");
    if (identity(fstatSync(3, { bigint: true })) !== identity(before)) fail();
    return bytes;
  } catch { fail(); }
}

// Pure composition only. Neither a candidate nor its digest is a launch
// capability. Physical inputs and the inherited transport must authenticate it.
export function applyRuntimeEnvFileV1(
  environment: Record<string, string | undefined>,
  loadedEnvKeys: Set<string>,
  text: string,
  overrideFileValues: boolean,
  validateEntry?: (key: string, value: string) => void,
): void {
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim().replace(/^export\s+/, "");
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const raw = trimmed.slice(eq + 1).trim();
    const quote = raw[0];
    const value = (quote === '"' || quote === "'") && raw[raw.length - 1] === quote
      ? raw.slice(1, -1) : raw;
    validateEntry?.(key, value);
    const alreadyFromProcess = environment[key] !== undefined && !loadedEnvKeys.has(key);
    if (alreadyFromProcess) continue;
    if (!overrideFileValues && environment[key] !== undefined) continue;
    environment[key] = value;
    loadedEnvKeys.add(key);
  }
}

const BASE_KEYS_V1 = Object.freeze([
  "HOME", "LANG", "LC_ALL", "PATH", "SETFARM_ENV_DIR", "SETFARM_PG_URL", "SETFARM_REPO_DIR",
]);
const MAX_FILE_BYTES_V1 = 256 * 1024;
const MAX_SNAPSHOT_BYTES_V1 = 512 * 1024;

function fail(): never { throw new Error("INTERNAL_PRODUCTION_LAUNCH_ENVIRONMENT_INVALID"); }
function hash(bytes: string | Buffer): string { return createHash("sha256").update(bytes).digest("hex"); }
function validateValue(key: string, value: unknown): asserts value is string {
  if (!/^[A-Za-z_][A-Za-z0-9_]{0,127}$/.test(key)
    || typeof value !== "string" || value.includes("\0")
    || Buffer.byteLength(value, "utf8") > 64 * 1024) fail();
}

export function projectInternalProductionSpawnerLaunchEnvironmentCandidateV1(
  base: Readonly<Record<string, string>>,
  files: readonly [Buffer | null, Buffer | null],
): Readonly<{
  environment: Readonly<Record<string, string>>;
  environmentHash: string;
  envFileContentHashes: readonly [string | null, string | null];
}> {
  if (!base || typeof base !== "object" || Array.isArray(base)
    || JSON.stringify(Object.keys(base).sort()) !== JSON.stringify(BASE_KEYS_V1)
    || !Array.isArray(files) || files.length !== 2) fail();
  const environment: Record<string, string> = Object.create(null);
  for (const key of BASE_KEYS_V1) {
    const value = base[key];
    validateValue(key, value);
    if (!value) fail();
    environment[key] = value;
  }
  const loaded = new Set<string>();
  const contentHashes: Array<string | null> = [];
  for (let ordinal = 0; ordinal < 2; ordinal++) {
    const bytes = files[ordinal];
    if (bytes === null) { contentHashes.push(null); continue; }
    if (!Buffer.isBuffer(bytes) || bytes.length > MAX_FILE_BYTES_V1) fail();
    let text: string;
    try { text = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes); }
    catch { fail(); }
    applyRuntimeEnvFileV1(environment, loaded, text, ordinal === 1, (key, value) => {
      validateValue(key, value);
      if (BASE_KEYS_V1.includes(key)
        || /^(?:NODE_|DYLD_|LD_|SETFARM_TEST_|SETFARM_INTERNAL_PRODUCTION_)/.test(key)
        || key === "SETFARM_SKIP_RUNTIME_GUARD" || key === "SETFARM_ALLOW_DIRTY_BUILD") fail();
    });
    if (Object.keys(environment).length > 1024) fail();
    contentHashes.push(hash(bytes));
  }
  const canonical = `{${Object.keys(environment).sort().map((key) => `${JSON.stringify(key)}:${JSON.stringify(environment[key])}`).join(",")}}`;
  if (Buffer.byteLength(canonical, "utf8") > MAX_SNAPSHOT_BYTES_V1) fail();
  return Object.freeze({
    environment: Object.freeze(environment),
    environmentHash: hash(`setfarm.internal-production-spawner-launch-environment-candidate.v1\n${canonical}`),
    envFileContentHashes: Object.freeze(contentHashes) as readonly [string | null, string | null],
  });
}
