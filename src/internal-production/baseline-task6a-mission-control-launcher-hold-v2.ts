import fs, { type BigIntStats } from "node:fs";
import path from "node:path";
import { userInfo } from "node:os";
import { spawnSync } from "node:child_process";

import { hashCanonicalJson } from "../product-compiler/canonical-json.js";

const LABEL = "com.setrox.mission-control";
const MAX_BYTES = 1024 * 1024;
const DIRECTORY_KEYS = ["dev", "ino", "mode", "uid", "gid", "birthtimeNs"] as const;
const FILE_KEYS = [...DIRECTORY_KEYS, "size", "nlink", "mtimeNs", "ctimeNs"] as const;
const ENV_KEYS = ["CLI_PATH", "MC_HOST", "MC_INTERNAL_URL", "MC_PORT", "PATH", "PROJECTS_DIR", "PROJECTS_JSON",
  "SETFARM_DIR", "SETFARM_OPERATIONAL_WRITE_TOKEN", "SETFARM_PG_URL", "SETFARM_REPO_DIR", "SETFARM_URL"] as const;
let cleanupUncertain = false;

function fail(): never { throw Error("INTERNAL_PRODUCTION_TASK6A_MISSION_CONTROL_LAUNCHER_INVALID"); }
function same(a: BigIntStats, b: BigIntStats, keys: readonly (keyof BigIntStats)[]) {
  return keys.every(key => a[key] === b[key]);
}
function exact(value: unknown, keys: readonly string[]): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    && Object.getPrototypeOf(value) === Object.prototype
    && Reflect.ownKeys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
}
function command(executable: string, args: string[], input?: Buffer): string {
  const result = spawnSync(executable, args, { input, encoding: "buffer", timeout: 5000, maxBuffer: MAX_BYTES,
    env: { PATH: "/usr/bin:/bin:/usr/sbin:/sbin", LANG: "C", LC_ALL: "C" } });
  if (result.error || result.signal || result.status !== 0 || !Buffer.isBuffer(result.stdout)
    || !Buffer.isBuffer(result.stderr) || result.stderr.length !== 0 || result.stdout.length > MAX_BYTES
    || !Buffer.from(result.stdout.toString("utf8")).equals(result.stdout)) fail();
  return result.stdout.toString("utf8");
}
function scalar(text: string, key: string): string {
  const matches = [...text.matchAll(new RegExp(`^\\t${key} = (.*)$`, "gm"))];
  if (matches.length !== 1 || !matches[0]![1]) fail();
  return matches[0]![1]!;
}
function block(text: string, key: string): string[] {
  const matches = [...text.matchAll(new RegExp(`^\\t${key} = \\{\\n([\\s\\S]*?)^\\t\\}$`, "gm"))];
  if (matches.length !== 1) fail();
  const rows = matches[0]![1]!.split("\n").filter(Boolean);
  if (rows.some(row => !row.startsWith("\t\t"))) fail();
  return rows.map(row => row.slice(2));
}
function loadedEnvironment(text: string): Record<string, string> {
  const values: Record<string, string> = Object.create(null);
  for (const row of block(text, "environment")) {
    const match = /^([A-Za-z][A-Za-z0-9_]*) => (.+)$/.exec(row);
    if (!match || Object.hasOwn(values, match[1]!)) fail();
    values[match[1]!] = match[2]!;
  }
  return values;
}
function urlRole(raw: unknown): string {
  if (typeof raw !== "string" || !/^postgres(?:ql)?:\/\/[^/?#@\s]+@(?:localhost|127\.0\.0\.1)(?::5432)?\/setfarm$/.test(raw)) fail();
  const target = new URL(raw);
  const role = decodeURIComponent(target.username);
  if (!["postgres:", "postgresql:"].includes(target.protocol) || !/^[a-z][a-z0-9_]{0,62}$/.test(role)
    || !["localhost", "127.0.0.1"].includes(target.hostname)
    || (target.port !== "" && target.port !== "5432") || target.pathname !== "/setfarm"
    || target.search !== "" || target.hash !== "") fail();
  return role;
}

// Separate from the two-idle Setfarm launcher holder. Its private URL and
// token are retained only in this scope and never hashed into public output.
export function holdTask6aMissionControlLauncherV2() {
  if (arguments.length !== 0 || cleanupUncertain) fail();
  const descriptors: number[] = [];
  let closed = false, invalid = false;
  const close = () => {
    if (closed) return;
    closed = true;
    let uncertain = false;
    while (descriptors.length) {
      try { fs.closeSync(descriptors.pop()!); } catch { uncertain = true; cleanupUncertain = true; }
    }
    if (uncertain) fail();
  };
  try {
    const account = userInfo();
    const uid = process.getuid?.();
    const home = process.platform === "darwin" && account.homedir.startsWith("/var/")
      ? `/private${account.homedir}` : account.homedir;
    if (uid === undefined || process.geteuid?.() !== uid || uid !== account.uid
      || !path.isAbsolute(home) || path.normalize(home) !== home) fail();
    const directory = path.join(home, "Library", "LaunchAgents");
    const pinned = new Map<string, { fd: number; stat: BigIntStats }>();
    const checkPins = () => {
      for (const [target, pin] of pinned) {
        const now = fs.lstatSync(target, { bigint: true });
        if (!now.isDirectory() || now.isSymbolicLink() || !same(now, pin.stat, DIRECTORY_KEYS)
          || !same(fs.fstatSync(pin.fd, { bigint: true }), pin.stat, DIRECTORY_KEYS)) fail();
      }
    };
    const root = path.parse(directory).root;
    const segments = path.relative(root, directory).split(path.sep).filter(Boolean);
    if (segments.length > 128) fail();
    for (const target of [root, ...segments.map((_, index) => path.join(root, ...segments.slice(0, index + 1)))]) {
      checkPins();
      const stat = fs.lstatSync(target, { bigint: true });
      if (!stat.isDirectory() || stat.isSymbolicLink() || ((target === home || target.startsWith(`${home}${path.sep}`))
        && (stat.uid !== BigInt(uid) || (stat.mode & 0o022n) !== 0n))) fail();
      const fd = fs.openSync(target, fs.constants.O_RDONLY | fs.constants.O_DIRECTORY | fs.constants.O_NOFOLLOW);
      descriptors.push(fd); pinned.set(target, { fd, stat }); checkPins();
    }
    const plistPath = path.join(directory, `${LABEL}.plist`);
    const stat = fs.lstatSync(plistPath, { bigint: true });
    if (!stat.isFile() || stat.isSymbolicLink() || stat.uid !== BigInt(uid)
      || stat.dev !== pinned.get(directory)!.stat.dev || stat.nlink !== 1n
      || (stat.mode & 0o077n) !== 0n || stat.size < 1n || stat.size > BigInt(MAX_BYTES)) fail();
    const fd = fs.openSync(plistPath, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW | fs.constants.O_NONBLOCK);
    descriptors.push(fd);
    const read = () => {
      checkPins();
      if (!same(fs.fstatSync(fd, { bigint: true }), stat, FILE_KEYS)
        || !same(fs.lstatSync(plistPath, { bigint: true }), stat, FILE_KEYS)) fail();
      const buffer = Buffer.alloc(MAX_BYTES + 1);
      let count = 0;
      while (count < buffer.length) {
        const size = fs.readSync(fd, buffer, count, buffer.length - count, count);
        if (size === 0) break;
        count += size;
      }
      if (BigInt(count) !== stat.size || !same(fs.fstatSync(fd, { bigint: true }), stat, FILE_KEYS)
        || !same(fs.lstatSync(plistPath, { bigint: true }), stat, FILE_KEYS)) fail();
      checkPins();
      return buffer.subarray(0, count);
    };
    const bytes = read();
    const value: unknown = JSON.parse(command("/usr/bin/plutil", ["-convert", "json", "-o", "-", "-"], bytes));
    if (!exact(value, ["EnvironmentVariables", "KeepAlive", "Label", "ProgramArguments", "RunAtLoad",
      "StandardErrorPath", "StandardOutPath", "WorkingDirectory"])
      || value.Label !== LABEL || value.KeepAlive !== true || value.RunAtLoad !== true
      || !exact(value.EnvironmentVariables, ENV_KEYS)
      || !Array.isArray(value.ProgramArguments) || value.ProgramArguments.length !== 2) fail();
    const env = value.EnvironmentVariables;
    if (ENV_KEYS.some(key => typeof env[key] !== "string" || !(env[key] as string).length)) fail();
    const missionRoot = path.join(home, "ai", "setrox", "mission-control");
    const args = value.ProgramArguments as unknown[];
    if (typeof args[0] !== "string" || !path.isAbsolute(args[0]) || fs.realpathSync(args[0]) !== fs.realpathSync(process.execPath)
      || args[1] !== path.join(missionRoot, "dist-server", "index.js") || value.WorkingDirectory !== missionRoot
      || value.StandardOutPath !== path.join(home, ".openclaw", "logs", "mission-control.out.log")
      || value.StandardErrorPath !== path.join(home, ".openclaw", "logs", "mission-control.err.log")
      || env.MC_HOST !== "0.0.0.0" || env.MC_PORT !== "3080" || env.MC_INTERNAL_URL !== "http://127.0.0.1:3080"
      || env.SETFARM_URL !== "http://127.0.0.1:3333" || env.CLI_PATH !== path.join(home, ".local", "bin")
      || env.PROJECTS_DIR !== path.join(home, "projects")
      || env.PROJECTS_JSON !== path.join(home, "projects", "mission-control", "projects.json")
      || env.SETFARM_DIR !== path.join(home, ".openclaw", "setfarm")
      || env.SETFARM_REPO_DIR !== path.join(home, "ai", "setrox", "setfarm")
      || (env.PATH as string).split(":").some(part => !part || !path.isAbsolute(part))) fail();
    const databaseUrl = env.SETFARM_PG_URL as string;
    const databaseRole = urlRole(databaseUrl);
    const project = () => {
      const text = command("/bin/launchctl", ["print", `gui/${uid}/${LABEL}`]);
      if (!text.startsWith(`gui/${uid}/${LABEL} = {\n`) || !text.endsWith("}\n")) fail();
      const pidText = scalar(text, "pid");
      const pid = /^[1-9][0-9]*$/.test(pidText) ? Number(pidText) : NaN;
      const properties = scalar(text, "properties").split(" | ");
      if (!Number.isSafeInteger(pid) || pid <= 1 || scalar(text, "state") !== "running"
        || scalar(text, "active count") !== "1" || scalar(text, "type") !== "LaunchAgent"
        || !properties.includes("keepalive") || !properties.includes("runatload")
        || scalar(text, "path") !== plistPath || scalar(text, "program") !== args[0]
        || scalar(text, "working directory") !== missionRoot
        || scalar(text, "stdout path") !== value.StandardOutPath || scalar(text, "stderr path") !== value.StandardErrorPath
        || JSON.stringify(block(text, "arguments")) !== JSON.stringify(args)) fail();
      const loaded = loadedEnvironment(text);
      if (Object.keys(loaded).length !== ENV_KEYS.length + 2 || loaded.OSLogRateLimit !== "64"
        || loaded.XPC_SERVICE_NAME !== LABEL || ENV_KEYS.some(key => loaded[key] !== env[key])) fail();
      return { pid, state: "running" as const, activeCount: 1 as const };
    };
    const before = project();
    if (!read().equals(bytes)) fail();
    const after = project();
    if (after.pid !== before.pid || !read().equals(bytes)) fail();
    const recheck = () => {
      try {
        if (closed || invalid || cleanupUncertain || userInfo().homedir !== account.homedir
          || process.getuid?.() !== uid || process.geteuid?.() !== uid || !read().equals(bytes)) fail();
        const current = project();
        if (current.pid !== before.pid || !read().equals(bytes)) fail();
      } catch { invalid = true; fail(); }
    };
    const assertSameDatabaseUrl = (raw: string) => {
      recheck();
      if (raw !== databaseUrl) { invalid = true; fail(); }
      recheck();
      return databaseRole;
    };
    const body = Object.freeze({
      schema: "setfarm.internal-production-task6a-mission-control-launcher.v2",
      authority: "diagnostic-only" as const, cutoverAdmission: "not-granted" as const,
      physicalIdentityProvenance: "unverified" as const,
      label: LABEL, state: "running" as const, activeCount: 1 as const, databaseRole,
    });
    const observation = Object.freeze({ ...body, observationHash: hashCanonicalJson(body) });
    return Object.freeze({ observation, recheck, assertSameDatabaseUrl, close });
  } catch {
    try { close(); } catch { /* cleanupUncertain remains fail-closed */ }
    fail();
  }
}
