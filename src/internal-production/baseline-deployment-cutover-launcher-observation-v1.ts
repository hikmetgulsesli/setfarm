import fs, { type BigIntStats } from "node:fs";
import path from "node:path";
import { userInfo } from "node:os";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { hashCanonicalJson } from "../product-compiler/canonical-json.js";

const LABELS = ["com.setrox.setfarm-spawner", "com.setrox.setfarm-dashboard"] as const;
const DIRECTORY_KEYS = ["dev", "ino", "mode", "uid", "gid", "birthtimeNs"] as const;
const FILE_KEYS = [...DIRECTORY_KEYS, "size", "nlink", "mtimeNs", "ctimeNs"] as const;
const MAX_BYTES = 1024 * 1024;
let cleanupUncertain = false;
function fail(): never { throw Error("DEPLOYMENT_CUTOVER_LAUNCHER_OBSERVATION_INVALID"); }
const same = (a: BigIntStats, b: BigIntStats, keys: readonly (keyof BigIntStats)[]) => keys.every(key => a[key] === b[key]);
const digest = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");
const exact = (value: unknown, keys: readonly string[]): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
const equal = (left: unknown, right: unknown) => hashCanonicalJson(left) === hashCanonicalJson(right);
function command(executable: string, args: string[], input?: Buffer): string {
  const result = spawnSync(executable, args, { input, encoding: "buffer", timeout: 5000, maxBuffer: MAX_BYTES,
    env: { PATH: "/usr/bin:/bin:/usr/sbin:/sbin", LANG: "C", LC_ALL: "C" } });
  if (result.error || result.signal || result.status !== 0 || !Buffer.isBuffer(result.stdout)
    || !Buffer.isBuffer(result.stderr) || result.stderr.length !== 0
    || result.stdout.length > MAX_BYTES || !Buffer.from(result.stdout.toString("utf8")).equals(result.stdout)) fail();
  return result.stdout.toString("utf8");
}
function scalar(text: string, name: string): string {
  const matches = [...text.matchAll(new RegExp(`^\\t${name} = (.*)$`, "gm"))];
  if (matches.length !== 1 || !matches[0]![1]) fail(); return matches[0]![1]!;
}
function block(text: string, name: string): string[] {
  const matches = [...text.matchAll(new RegExp(`^\\t${name} = \\{\\n([\\s\\S]*?)^\\t\\}$`, "gm"))];
  if (matches.length !== 1) fail();
  const lines = matches[0]![1]!.split("\n").filter(Boolean);
  if (lines.some(line => !line.startsWith("\t\t"))) fail();
  return lines.map(line => line.slice(2));
}
function environment(text: string, name: string): Record<string, string> {
  const result: Record<string, string> = Object.create(null);
  for (const line of block(text, name)) {
    const match = /^([A-Za-z][A-Za-z0-9_]*) => (.+)$/.exec(line);
    if (!match || Object.hasOwn(result, match[1]!)) fail(); result[match[1]!] = match[2]!;
  }
  return result;
}

// Diagnostic only: loaded-idle launchers are not a process/zero-owner census.
// Secret-bearing parser values stay local and are never attached to errors.
export function observeDeploymentCutoverLauncherConfigurationV1() {
  if (cleanupUncertain) fail();
  const descriptors: number[] = [], pins = new Map<string, { fd: number; stat: BigIntStats }>();
  let invalid = false;
  type Entry = Readonly<{ label: string; plistPath: string; launchArguments: readonly string[];
    plistIdentity: Readonly<Record<string, string>>; plistBytesHash: string; configurationHash: string;
    state: string; activeCount: 0; loadedStateHash: string }>;
  let output: Readonly<{ schema: string; launchers: readonly Entry[]; launcherObservationHash: string }> | undefined;
  try {
    const uid = process.getuid?.(), rawHome = userInfo().homedir;
    const home = process.platform === "darwin" && rawHome.startsWith("/var/") ? `/private${rawHome}` : rawHome;
    if (uid === undefined || !path.isAbsolute(home) || path.normalize(home) !== home) fail();
    const checkPins = () => {
      for (const [target, pin] of pins) {
        const current = fs.lstatSync(target, { bigint: true });
        if (!current.isDirectory() || current.isSymbolicLink() || !same(pin.stat, current, DIRECTORY_KEYS)
          || !same(pin.stat, fs.fstatSync(pin.fd, { bigint: true }), DIRECTORY_KEYS)) fail();
      }
    };
    const directory = path.join(home, "Library", "LaunchAgents"), root = path.parse(directory).root;
    const segments = path.relative(root, directory).split(path.sep).filter(Boolean);
    if (segments.length > 128) fail();
    for (const target of [root, ...segments.map((_, index) => path.join(root, ...segments.slice(0, index + 1)))]) {
      checkPins();
      const stat = fs.lstatSync(target, { bigint: true });
      if (!stat.isDirectory() || stat.isSymbolicLink() || ((target === home || target.startsWith(`${home}${path.sep}`))
        && (stat.uid !== BigInt(uid) || (stat.mode & 0o022n) !== 0n))) fail();
      const fd = fs.openSync(target, fs.constants.O_RDONLY | fs.constants.O_DIRECTORY | fs.constants.O_NOFOLLOW);
      descriptors.push(fd); pins.set(target, { fd, stat }); checkPins();
    }
    const held = LABELS.map((label, index) => {
      checkPins(); const plistPath = path.join(directory, `${label}.plist`), stat = fs.lstatSync(plistPath, { bigint: true });
      if (!stat.isFile() || stat.isSymbolicLink() || stat.uid !== BigInt(uid) || stat.dev !== pins.get(directory)!.stat.dev
        || stat.nlink !== 1n || (stat.mode & 0o022n) !== 0n || stat.size < 1n || stat.size > BigInt(MAX_BYTES)) fail();
      const fd = fs.openSync(plistPath, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW | fs.constants.O_NONBLOCK);
      descriptors.push(fd);
      const read = () => {
        checkPins();
        if (!same(stat, fs.fstatSync(fd, { bigint: true }), FILE_KEYS) || !same(stat, fs.lstatSync(plistPath, { bigint: true }), FILE_KEYS)) fail();
        const buffer = Buffer.alloc(MAX_BYTES + 1);
        let count = 0;
        while (count < buffer.length) {
          const size = fs.readSync(fd, buffer, count, buffer.length - count, count);
          if (size === 0) break;
          count += size;
        }
        if (BigInt(count) !== stat.size || !same(stat, fs.fstatSync(fd, { bigint: true }), FILE_KEYS)
          || !same(stat, fs.lstatSync(plistPath, { bigint: true }), FILE_KEYS)) fail();
        checkPins(); return buffer.subarray(0, count);
      };
      const bytes = read();
      const program = path.join(home, ".local", "bin", "setfarm");
      const args = index ? [program, "dashboard", "start", "--port", "3333"] : [program, "spawner", "start"];
      const parsed: unknown = JSON.parse(command("/usr/bin/plutil", ["-convert", "json", "-o", "-", "-"], bytes));
      if (!exact(parsed, ["EnvironmentVariables", "Label", "ProgramArguments", "RunAtLoad", "StandardErrorPath", "StandardOutPath", "StartInterval"])
        || parsed.Label !== label || parsed.RunAtLoad !== true || parsed.StartInterval !== 60 || !equal(parsed.ProgramArguments, args)) fail();
      const keys = index ? ["PATH", "SETFARM_OPERATIONAL_WRITE_TOKEN", "SETFARM_PG_URL"] : ["PATH", "SETFARM_PG_URL"];
      const env = parsed.EnvironmentVariables;
      if (!exact(env, keys) || keys.some(key => typeof env[key] !== "string" || !(env[key] as string).length)) fail();
      const log = path.join(home, ".openclaw", "logs", index ? "setfarm-dashboard.watch" : "setfarm-spawner.watch");
      if (parsed.StandardOutPath !== `${log}.log` || parsed.StandardErrorPath !== `${log}.err.log`) fail();
      const project = () => {
        const text = command("/bin/launchctl", ["print", `gui/${uid}/${label}`]);
        if (!text.startsWith(`gui/${uid}/${label} = {\n`) || !text.endsWith("}\n")) fail();
        const state = scalar(text, "state");
        if ((state !== "not running" && state !== "spawn scheduled") || scalar(text, "active count") !== "0"
          || /^\tpid = /m.test(text) || scalar(text, "type") !== "LaunchAgent" || scalar(text, "path") !== plistPath
          || scalar(text, "program") !== program || !equal(block(text, "arguments"), args)
          || scalar(text, "run interval") !== "60 seconds" || !scalar(text, "properties").split(" | ").includes("runatload")) fail();
        const loaded = environment(text, "environment"), inherited = environment(text, "inherited environment"), defaults = environment(text, "default environment");
        if (!exact(loaded, [...keys, "OSLogRateLimit", "XPC_SERVICE_NAME"]) || loaded.OSLogRateLimit !== "64" || loaded.XPC_SERVICE_NAME !== label
          || keys.some(key => loaded[key] !== env[key]) || !exact(inherited, ["SETFARM_ENV_DIR", "SSH_AUTH_SOCK"])
          || inherited.SETFARM_ENV_DIR !== path.join(home, "ai", "setrox", "setfarm", "scripts")
          || !/^\/var\/run\/com\.apple\.launchd\.[A-Za-z0-9]+\/Listeners$/.test(inherited.SSH_AUTH_SOCK ?? "")
          || !exact(defaults, ["PATH"]) || defaults.PATH !== "/usr/bin:/bin:/usr/sbin:/sbin") fail();
        return { state, activeCount: 0 as const, loaded, inherited, defaults };
      };
      return { label, plistPath, stat, args, parsed, bytes, read, project };
    });
    const before = held.map(item => item.project());
    for (const item of held) if (!item.read().equals(item.bytes)) fail();
    const after = held.map(item => item.project());
    const launchers = held.map((item, index): Entry => {
      if (!equal(before[index], after[index]) || !item.read().equals(item.bytes)) fail();
      const plistIdentity = Object.freeze(Object.fromEntries(FILE_KEYS.map(key => [key, String(item.stat[key])])));
      return Object.freeze({ label: item.label, plistPath: item.plistPath, launchArguments: Object.freeze(item.args), plistIdentity,
        plistBytesHash: digest(item.bytes), configurationHash: hashCanonicalJson({ schema: "setfarm.internal-production-deployment-cutover-launcher-configuration.v1", plistPath: item.plistPath, plist: item.parsed }),
        state: before[index]!.state, activeCount: 0, loadedStateHash: hashCanonicalJson({ schema: "setfarm.internal-production-deployment-cutover-launcher-loaded-state.v1", label: item.label, projection: before[index] }) });
    });
    checkPins();
    const body = { schema: "setfarm.internal-production-deployment-cutover-launcher-observation.v1", launchers: Object.freeze(launchers) };
    output = Object.freeze({ ...body, launcherObservationHash: hashCanonicalJson(body) });
  } catch { invalid = true; }
  while (descriptors.length) {
    const fd = descriptors.pop()!;
    try { fs.closeSync(fd); } catch { cleanupUncertain = true; invalid = true; }
  }
  if (invalid || !output) fail();
  return output;
}
