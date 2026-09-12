import { createHash } from "node:crypto";
import { closeSync, constants, fstatSync, lstatSync, openSync, opendirSync, readSync, realpathSync, type BigIntStats } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Shared ordinary/effective snapshot transformation. Authentication of the
// environment and host inputs remains the caller's separate responsibility.
export function normalizeRuntimePathV1(configuredPath: string, ownerHome: string, executable: string): string {
  const required = [path.dirname(executable), path.join(ownerHome, ".local", "bin"),
    "/opt/homebrew/bin", "/usr/local/bin", "/usr/bin", "/bin", "/usr/sbin", "/sbin"];
  const next: string[] = [];
  for (const entry of [...required, ...configuredPath.split(path.delimiter).filter(Boolean)]) {
    if (!entry || next.includes(entry)) continue;
    next.push(entry);
  }
  return next.join(path.delimiter);
}

type LaunchOutputCandidateV1 = Readonly<{
  rootIdentity: Readonly<{ devDecimal: string; inoDecimal: string; uid: number }>;
  sourceSha: string;
  sourceTreeHash: string;
  buildInfoBytesHash: string;
  outputTreeBytesHash: string;
  releaseManifestBytesHash: string;
}>;

function canonicalData(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalData).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${canonicalData(record[key])}`).join(",")}}`;
}

function metadata(stats: BigIntStats): string {
  return [stats.dev, stats.ino, stats.mode, stats.uid, stats.gid, stats.nlink,
    stats.size, stats.birthtimeNs, stats.mtimeNs, stats.ctimeNs].join(":");
}

// Checks current bytes against a supplied candidate; the caller must first
// authenticate that candidate through the fixed dispatch/intent/lease chain.
// Full Git/build provenance remains with the independently observing helper.
export function verifyInternalProductionSpawnerLaunchOutputCandidateV1(expected: LaunchOutputCandidateV1): void {
  const directories = new Map<string, BigIntStats>();
  const observedFiles = new Map<string, BigIntStats>();
  try {
    const keys = (value: unknown, names: readonly string[]) => {
      if (!value || typeof value !== "object" || Array.isArray(value)
        || canonicalData(Object.keys(value).sort()) !== canonicalData([...names].sort())) fail();
    };
    keys(expected, ["rootIdentity", "sourceSha", "sourceTreeHash", "buildInfoBytesHash", "outputTreeBytesHash", "releaseManifestBytesHash"]);
    keys(expected.rootIdentity, ["devDecimal", "inoDecimal", "uid"]);
    for (const value of [expected.sourceSha, expected.sourceTreeHash]) if (!/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(value)) fail();
    for (const value of [expected.buildInfoBytesHash, expected.outputTreeBytesHash, expected.releaseManifestBytesHash]) if (!/^[a-f0-9]{64}$/.test(value)) fail();
    const moduleDirectory = path.dirname(fileURLToPath(import.meta.url));
    if (path.basename(moduleDirectory) !== "internal-production" || path.basename(path.dirname(moduleDirectory)) !== "dist") fail();
    const root = path.dirname(path.dirname(moduleDirectory));
    if (realpathSync(root) !== root) fail();
    const rootStats = lstatSync(root, { bigint: true });
    const uid = process.getuid?.();
    if (uid === undefined || !rootStats.isDirectory() || rootStats.isSymbolicLink()
      || rootStats.uid !== BigInt(uid) || expected.rootIdentity.uid !== uid
      || expected.rootIdentity.devDecimal !== String(rootStats.dev) || expected.rootIdentity.inoDecimal !== String(rootStats.ino)
      || (rootStats.mode & 0o022n) !== 0n) fail();
    directories.set(root, rootStats);
    let totalBytes = 0;
    const read = (locator: string, mode: number): Buffer => {
      const target = path.join(root, locator);
      const before = lstatSync(target, { bigint: true });
      if (!before.isFile() || before.isSymbolicLink() || before.nlink !== 1n || before.uid !== BigInt(uid)
        || before.dev !== rootStats.dev || (before.mode & 0o7777n) !== BigInt(mode)
        || before.size < 0n || before.size > 33_554_432n) fail();
      totalBytes += Number(before.size);
      if (totalBytes > 536_870_912) fail();
      const fd = openSync(target, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
      try {
        if (metadata(before) !== metadata(fstatSync(fd, { bigint: true }))) fail();
        const bytes = Buffer.alloc(Number(before.size));
        let offset = 0;
        while (offset < bytes.length) {
          const count = readSync(fd, bytes, offset, Math.min(64 * 1024, bytes.length - offset), offset);
          if (count < 1) fail();
          offset += count;
        }
        if (readSync(fd, Buffer.alloc(1), 0, 1, offset) !== 0
          || metadata(before) !== metadata(fstatSync(fd, { bigint: true }))
          || metadata(before) !== metadata(lstatSync(target, { bigint: true }))) fail();
        observedFiles.set(target, before);
        return bytes;
      } finally { closeSync(fd); }
    };
    const inventory: string[] = [];
    let entryCount = 1;
    const visit = (locator: string, depth: number): void => {
      if (depth > 64) fail();
      const target = path.join(root, locator), stats = lstatSync(target, { bigint: true });
      if (!stats.isDirectory() || stats.isSymbolicLink() || stats.uid !== BigInt(uid)
        || stats.dev !== rootStats.dev || (stats.mode & 0o7777n) !== 0o755n) fail();
      directories.set(target, stats);
      const directory = opendirSync(target, { bufferSize: 1 });
      try { for (let entry = directory.readSync(); entry !== null; entry = directory.readSync()) {
        const name = entry.name;
        const child = `${locator}/${name}`;
        if (++entryCount > 10_000 || Buffer.byteLength(child, "utf8") > 1024
          || /[\\\0-\x1f\x7f-\x9f]/.test(name)) fail();
        const childStats = lstatSync(path.join(root, child), { bigint: true });
        if (childStats.isSymbolicLink()) fail();
        if (childStats.isDirectory()) visit(child, depth + 1);
        else if (childStats.isFile()) inventory.push(child);
        else fail();
      } } finally { directory.closeSync(); }
    };
    visit("dist", 0);
    const authorityFiles = ["dist/BUILD_INFO.json", "dist/PLATFORM_BUILD_OUTPUT_TREE.json", "dist/PLATFORM_RELEASE_MANIFEST.json"];
    const [infoBytes, treeBytes, manifestBytes] = authorityFiles.map((locator) => read(locator, 0o444));
    if (hash(infoBytes!) !== expected.buildInfoBytesHash || hash(treeBytes!) !== expected.outputTreeBytesHash
      || hash(manifestBytes!) !== expected.releaseManifestBytesHash) fail();
    const tree = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(treeBytes));
    keys(tree, ["schema", "sourceSha", "sourceTreeHash", "entries", "outputTreeHash"]);
    if (tree.schema !== "setfarm.platform-build-output-tree.v1" || tree.sourceSha !== expected.sourceSha
      || tree.sourceTreeHash !== expected.sourceTreeHash || !Array.isArray(tree.entries)
      || tree.entries.length < 3 || tree.entries.length > 10_000) fail();
    if (hash(canonicalData({ schema: tree.schema, sourceSha: tree.sourceSha, sourceTreeHash: tree.sourceTreeHash, entries: tree.entries })) !== tree.outputTreeHash) fail();
    const ordinary: string[] = [], folded = new Set<string>();
    for (const entry of tree.entries) {
      keys(entry, ["locator", "mode", "byteLength", "sha256"]);
      const locator = entry.locator;
      if (typeof locator !== "string" || !locator.startsWith("dist/") || Buffer.byteLength(locator, "utf8") > 1024
        || /[\\\0-\x1f\x7f-\x9f]/.test(locator) || locator.split("/").some((part: string) => !part || part === "." || part === "..")
        || entry.mode !== (locator === "dist/cli/cli.js" ? 0o755 : 0o644)
        || !Number.isSafeInteger(entry.byteLength) || entry.byteLength < 0 || entry.byteLength > 33_554_432
        || typeof entry.sha256 !== "string" || !/^[a-f0-9]{64}$/.test(entry.sha256)) fail();
      const normalized = locator.normalize("NFC").toLocaleLowerCase("en-US");
      if (folded.has(normalized)) fail();
      folded.add(normalized); ordinary.push(locator);
      const bytes = read(locator, entry.mode);
      if (bytes.length !== entry.byteLength || hash(bytes) !== entry.sha256) fail();
    }
    for (const required of ["dist/spawner.js", "dist/runtime-config.js", "dist/internal-production/baseline-spawner-launch-environment-v1.js"]) if (!ordinary.includes(required)) fail();
    const sorted = (values: string[]) => [...values].sort((a, b) => Buffer.compare(Buffer.from(a), Buffer.from(b)));
    const expectedDirectories = new Set([root, path.join(root, "dist")]);
    for (const locator of ordinary) {
      let parent = path.dirname(path.join(root, locator));
      while (parent !== root) { expectedDirectories.add(parent); parent = path.dirname(parent); }
    }
    if (canonicalData(ordinary) !== canonicalData(sorted(ordinary))
      || canonicalData(sorted(inventory)) !== canonicalData(sorted([...ordinary, ...authorityFiles]))
      || canonicalData(sorted([...directories.keys()])) !== canonicalData(sorted([...expectedDirectories]))) fail();
    for (const [target, stats] of [...directories, ...observedFiles]) {
      if (metadata(stats) !== metadata(lstatSync(target, { bigint: true }))) fail();
    }
  } catch { fail(); }
}

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
    if (metadata(fstatSync(3, { bigint: true })) !== metadata(before)) fail();
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
