import fs, { type BigIntStats } from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";

const DIRECTORY_KEYS = ["dev", "ino", "uid", "gid", "mode", "birthtimeNs"] as const;
const FILE_KEYS = [...DIRECTORY_KEYS, "nlink", "size", "mtimeNs", "ctimeNs"] as const;
const TREE_KEYS = [...DIRECTORY_KEYS, "mtimeNs", "ctimeNs"] as const;
const same = (a: BigIntStats, b: BigIntStats, keys: readonly (keyof BigIntStats)[]) => keys.every(key => a[key] === b[key]);
const hash = (bytes: string) => createHash("sha256").update(bytes).digest("hex");
let cleanupUncertain = false;
function fail(): never { throw Error("DEPLOYMENT_CUTOVER_NODE_PATH_INVALID"); }

// Read-only leaf, not admission: the owner must supply its authenticated launcher
// PATH and keep this context alive. Node/macOS/Homebrew and native loader remain
// trusted prerequisites; an executable digest is not a dynamic-library proof.
// No candidate is executed, and inspector PATH is never consulted.
export function holdDeploymentCutoverNodePathV1(launcherPath: string) {
  if (arguments.length !== 1 || cleanupUncertain || typeof launcherPath !== "string"
    || launcherPath.length > 16384 || /[\0\r\n]/.test(launcherPath)) fail();
  const entries = launcherPath.split(":");
  if (entries.length > 32 || entries.some(entry => !path.isAbsolute(entry) || path.normalize(entry) !== entry)) fail();
  type Pin = { fd: number; stat: BigIntStats; tree: boolean };
  const pins = new Map<string, Pin>();
  const links = new Map<string, { stat: BigIntStats; raw: string }>();
  const absent = new Set<string>();
  let closed = false, invalid = false;
  const close = () => {
    if (closed) return;
    closed = true;
    let uncertain = false;
    const descriptors = [...pins.values()].map(pin => pin.fd);
    while (descriptors.length) {
      const fd = descriptors.pop()!;
      try { fs.closeSync(fd); } catch { uncertain = true; cleanupUncertain = true; }
    }
    if (uncertain) fail();
  };
  try {
    const uid = process.getuid?.(), gid = process.getgid?.();
    if (uid === undefined || gid === undefined || process.geteuid?.() !== uid || process.getegid?.() !== gid) fail();
    const ownership = (stat: BigIntStats, target: string, directory: boolean) => {
      const admin = directory && process.platform === "darwin" && stat.gid === 80n
        && (target === "/opt/homebrew" || target.startsWith("/opt/homebrew/"));
      if ((stat.uid !== 0n && stat.uid !== BigInt(uid))
        || (!stat.isSymbolicLink() && (stat.mode & (admin ? 0o002n : 0o022n)) !== 0n)) fail();
    };
    const check = () => {
      if (closed || invalid || cleanupUncertain || process.getuid?.() !== uid || process.geteuid?.() !== uid
        || process.getgid?.() !== gid || process.getegid?.() !== gid) fail();
      for (const [target, pin] of pins) {
        const keys = pin.stat.isFile() ? FILE_KEYS : pin.tree ? TREE_KEYS : DIRECTORY_KEYS;
        if (!same(pin.stat, fs.fstatSync(pin.fd, { bigint: true }), keys)
          || !same(pin.stat, fs.lstatSync(target, { bigint: true }), keys)) fail();
      }
      for (const [target, link] of links) {
        if (!same(link.stat, fs.lstatSync(target, { bigint: true }), FILE_KEYS)
          || fs.readlinkSync(target) !== link.raw) fail();
      }
      for (const target of absent) {
        try { fs.lstatSync(target); fail(); } catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
      }
    };
    const directory = (target: string, stat: BigIntStats) => {
      if (pins.has(target)) return;
      if (pins.size >= 256 || !stat.isDirectory() || stat.isSymbolicLink()) fail();
      ownership(stat, target, true);
      const fd = fs.openSync(target, fs.constants.O_RDONLY | fs.constants.O_DIRECTORY | fs.constants.O_NOFOLLOW);
      pins.set(target, { fd, stat, tree: false }); check();
    };
    const resolve = (input: string): string | null => {
      let pending = input.split(path.sep).filter(Boolean), current = path.parse(input).root, traversals = 0;
      if (pending.length > 128) fail();
      directory(current, fs.lstatSync(current, { bigint: true }));
      while (pending.length) {
        check();
        const next = path.join(current, pending.shift()!);
        let stat: BigIntStats;
        try { stat = fs.lstatSync(next, { bigint: true }); }
        catch (error) {
          if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
          // Preserve the original nearest existing parent's timestamps, so a
          // temporary earlier candidate cannot be hidden by removing it again.
          pins.get(current)!.tree = true; absent.add(next); check(); return null;
        }
        if (stat.isSymbolicLink()) {
          if (++traversals > 32 || links.size >= 128) fail();
          ownership(stat, next, false);
          const raw = fs.readlinkSync(next);
          // Do not collapse interior dotdot before the kernel follows a prior
          // symlink. Leading ../ in canonical Homebrew links remains supported.
          if (!raw || raw.length > 4096 || /[\0\r\n]/.test(raw) || path.normalize(raw) !== raw || raw.endsWith(path.sep)) fail();
          const old = links.get(next);
          if (old && (!same(old.stat, stat, FILE_KEYS) || old.raw !== raw)) fail();
          links.set(next, { stat, raw }); check();
          const expanded = path.resolve(current, raw, ...pending);
          pending = expanded.split(path.sep).filter(Boolean); current = path.parse(expanded).root;
          if (pending.length > 128) fail();
          directory(current, fs.lstatSync(current, { bigint: true }));
        } else if (pending.length) {
          directory(next, stat); current = next;
        } else {
          if (!stat.isFile() || stat.nlink !== 1n || (stat.mode & 0o111n) === 0n) fail();
          ownership(stat, next, false); check(); return next;
        }
      }
      fail();
    };
    let executablePath: string | null = null, candidatePath = "";
    for (const entry of entries) {
      candidatePath = path.join(entry, "node");
      executablePath = resolve(candidatePath);
      if (executablePath !== null) break;
    }
    if (!executablePath || executablePath !== fs.realpathSync.native(process.execPath)
      || fs.realpathSync.native(candidatePath) !== executablePath
      || resolve(process.execPath) !== executablePath) fail();
    check();
    const stat = fs.lstatSync(executablePath, { bigint: true });
    if (!stat.isFile() || stat.nlink !== 1n || stat.size < 1n || stat.size > 268435456n || pins.size >= 256) fail();
    ownership(stat, executablePath, false);
    const fd = fs.openSync(executablePath, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW | fs.constants.O_NONBLOCK);
    pins.set(executablePath, { fd, stat, tree: false }); check();
    const digest = createHash("sha256"), buffer = Buffer.alloc(64 * 1024);
    let offset = 0;
    while (offset < Number(stat.size)) {
      const count = fs.readSync(fd, buffer, 0, Math.min(buffer.length, Number(stat.size) - offset), offset);
      if (!count) fail(); digest.update(buffer.subarray(0, count)); offset += count;
    }
    if (fs.readSync(fd, buffer, 0, 1, offset) !== 0) fail();
    check();
    fs.accessSync(candidatePath, fs.constants.X_OK); check();
    const observation = Object.freeze({ schema: "setfarm.internal-production-deployment-cutover-node-path.v1",
      pathHash: hash(launcherPath), candidatePath, executablePath, executableHash: digest.digest("hex"),
      executableIdentity: Object.freeze(Object.fromEntries(FILE_KEYS.map(key => [key, String(stat[key])]))),
      trustBoundary: "trusted-node-macos-homebrew-runtime" });
    const recheck = () => {
      try { check(); fs.accessSync(candidatePath, fs.constants.X_OK); check(); }
      catch { invalid = true; fail(); }
    };
    return Object.freeze({ observation, recheck, close });
  } catch { invalid = true; close(); fail(); }
}
