import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { closeSync, constants, fstatSync, lstatSync, openSync, readSync, readdirSync, realpathSync, type BigIntStats } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const LIMIT = 64 * 1024 * 1024;
const ASSET_LIMIT = 8 * 1024 * 1024;
const ASSET_ROOTS = ["workflows", "agents", "references", "skills"] as const;
const BASE_FILES = ["package.json", "package-lock.json", "tsconfig.json"] as const;
const IDENTITY_KEYS = ["dev", "ino", "mode", "nlink", "uid", "gid", "size", "mtimeNs", "ctimeNs"] as const;
const GIT_ENV = { PATH: "/usr/bin:/bin", LANG: "C", LC_ALL: "C", GIT_CONFIG_NOSYSTEM: "1",
  GIT_CONFIG_GLOBAL: "/dev/null", GIT_NO_REPLACE_OBJECTS: "1", GIT_OPTIONAL_LOCKS: "0", GIT_TERMINAL_PROMPT: "0" };
function refuse(): never { throw new Error("FRESH_INSTALLATION_SOURCE_UNAVAILABLE"); }

function git(root: string, args: string[]): string {
  const result = spawnSync("/usr/bin/git", ["-c", "core.hooksPath=/dev/null", "-c", "core.fsmonitor=false", ...args],
    { cwd: root, env: GIT_ENV, encoding: "utf8", timeout: 5000, maxBuffer: 2 * 1024 * 1024 });
  if (result.error || result.status !== 0 || result.signal || result.stderr) refuse();
  return result.stdout;
}

/** Fixed Git/byte DATA snapshot. No caller-selected root, file set or observer. */
function sourceSnapshotV1(includeCode: boolean): Readonly<{ sha: string; assets: ReadonlyMap<string, Buffer> }> {
  if (Object.keys(process.env).some(key => /^GIT_(?:DIR|WORK_TREE|INDEX_FILE|OBJECT_DIRECTORY|ALTERNATE_OBJECT_DIRECTORIES|COMMON_DIR|NAMESPACE|REPLACE_REF_BASE|CONFIG.*)$/.test(key))) refuse();
  const root = realpathSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../.."));
  if (realpathSync(git(root, ["rev-parse", "--show-toplevel"]).trim()) !== root) refuse();
  const head = git(root, ["rev-parse", "--verify", "HEAD^{commit}"]).trim();
  if (!/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(head)
    || git(root, ["status", "--porcelain=v1", "--untracked-files=all"]) !== "") refuse();
  const roots: readonly string[] = includeCode ? ["src", ...ASSET_ROOTS] : ASSET_ROOTS;
  const base: readonly string[] = includeCode ? BASE_FILES : [];
  const entries = git(root, ["ls-tree", "-r", "-z", "HEAD", "--", ...roots, ...base]).split("\0");
  if (entries.pop() !== "" || entries.length < 1 || entries.length > 10_000) refuse();
  const expected = new Map<string, { mode: string; hash: string }>();
  const expectedDirectories = new Set<string>(roots);
  for (const entry of entries) {
    const match = /^(100644|100755) blob ([a-f0-9]{40}|[a-f0-9]{64})\t([^\0\r\n]+)$/.exec(entry);
    const relative = match?.[3];
    if (!match || !relative || relative.includes("\\")
      || relative.split("/").some(part => part === "." || part === ".." || !part)
      || (!base.includes(relative) && !roots.some(name => relative.startsWith(name + "/")))
      || expected.has(relative)) refuse();
    expected.set(relative, { mode: match[1]!, hash: match[2]! });
    let parent = path.posix.dirname(relative);
    while (parent !== ".") { expectedDirectories.add(parent); parent = path.posix.dirname(parent); }
  }
  const actual: string[] = [...base];
  const directories = new Map<string, BigIntStats>();
  let count = 0;
  const walk = (relative: string, depth: number): void => {
    if (++count > 10_000 || depth > 32) refuse();
    const full = path.join(root, relative), stat = lstatSync(full, { bigint: true });
    if (stat.isSymbolicLink() || realpathSync(full) !== full) refuse();
    if (stat.isDirectory()) {
      directories.set(relative, stat);
      for (const name of readdirSync(full).sort()) walk(`${relative}/${name}`, depth + 1);
    } else if (stat.isFile()) actual.push(relative);
    else refuse();
  };
  for (const name of roots) walk(name, 0);
  if (JSON.stringify(actual.sort()) !== JSON.stringify([...expected.keys()].sort())
    || JSON.stringify([...directories.keys()].sort()) !== JSON.stringify([...expectedDirectories].sort())) refuse();
  const assets = new Map<string, Buffer>();
  let total = 0;
  for (const relative of actual) {
    const wanted = expected.get(relative)!;
    const fd = openSync(path.join(root, relative), constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
    try {
      const before = fstatSync(fd, { bigint: true });
      if (!before.isFile() || before.nlink !== 1n || before.size < 0n
        || before.size > BigInt((includeCode ? 4 : 1) * 1024 * 1024)
        || ((before.mode & 0o111n) !== 0n) !== (wanted.mode === "100755")) refuse();
      const declaredSize = Number(before.size);
      if (total + declaredSize > (includeCode ? LIMIT : ASSET_LIMIT)) refuse();
      const parts: Buffer[] = []; let amount = 0;
      while (amount < declaredSize) {
        const buffer = Buffer.alloc(Math.min(65536, declaredSize - amount)), n = readSync(fd, buffer);
        if (!n) refuse(); amount += n; total += n; parts.push(buffer.subarray(0, n));
      }
      if (readSync(fd, Buffer.alloc(1), 0, 1, declaredSize) !== 0) refuse();
      const after = fstatSync(fd, { bigint: true }), named = lstatSync(path.join(root, relative), { bigint: true });
      for (const key of IDENTITY_KEYS) if (before[key] !== after[key] || before[key] !== named[key]) refuse();
      if (BigInt(amount) !== before.size) refuse();
      const bytes = Buffer.concat(parts);
      const hash = createHash(head.length === 40 ? "sha1" : "sha256").update(`blob ${amount}\0`).update(bytes).digest("hex");
      if (hash !== wanted.hash) refuse();
      if (ASSET_ROOTS.some(name => relative.startsWith(name + "/"))) assets.set(relative, bytes);
    } finally { closeSync(fd); }
  }
  for (const [relative, before] of directories) {
    const after = lstatSync(path.join(root, relative), { bigint: true });
    for (const key of IDENTITY_KEYS) if (before[key] !== after[key]) refuse();
  }
  if (git(root, ["rev-parse", "--verify", "HEAD^{commit}"]).trim() !== head
    || git(root, ["status", "--porcelain=v1", "--untracked-files=all"]) !== "") refuse();
  return { sha: head, assets };
}

/**
 * Detached plain DATA from four fixed Git-verified asset trees. Buffers/map are
 * not authority and are not accepted back as admission input. The private asset
 * helper consumes this fixed snapshot directly, without live source rereads.
 */
export function readFreshInstallationSourceAssetsV1(expectedSourceSha: string): ReadonlyMap<string, Buffer> {
  try {
    if (typeof expectedSourceSha !== "string" || !/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(expectedSourceSha)) refuse();
    const snapshot = sourceSnapshotV1(false);
    if (snapshot.sha !== expectedSourceSha) refuse();
    return snapshot.assets;
  } catch { return refuse(); }
}

/** Source mode attests a real clean checkout; compiled mode additionally requires the actual finalized release. */
export async function captureFreshInstallationSourceShaV1(): Promise<string> {
  try {
    if (fileURLToPath(import.meta.url).endsWith(".ts")) return sourceSnapshotV1(true).sha;
    const before = sourceSnapshotV1(false);
    const release = await import("../internal-production/baseline-post-handoff-receipt-v1.js");
    const observed = release.observeCurrentInternalProductionCleanSetfarmSourceBuildV1();
    if (observed.sha !== before.sha || sourceSnapshotV1(false).sha !== before.sha) refuse();
    return observed.sha;
  } catch { return refuse(); }
}
