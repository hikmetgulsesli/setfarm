import fs, { type BigIntStats } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const DIRECTORY_KEYS = ["dev", "ino", "uid", "gid", "mode", "birthtimeNs"] as const;
const FILE_KEYS = [...DIRECTORY_KEYS, "nlink", "size", "mtimeNs", "ctimeNs"] as const;
const same = (a: BigIntStats, b: BigIntStats, keys: readonly (keyof BigIntStats)[]) =>
  keys.every(key => a[key] === b[key]);
let closeUncertain = false;
function refuse(): never { throw new Error("TASK6A_ROOT_JSON_FILE_REFUSED"); }

function noAcl(target: string): void {
  // -e must produce no extra rows: @ can mask + when xattrs and ACL coexist.
  const result = spawnSync("/bin/ls", ["-ldne", target], {
    cwd: "/", env: { PATH: "/usr/bin:/bin", LANG: "C", LC_ALL: "C" },
    encoding: "utf8", timeout: 2000, maxBuffer: 16384,
  });
  if (result.error || result.signal || result.status !== 0 || result.stderr !== ""
    || !result.stdout.endsWith("\n")) refuse();
  const rows = result.stdout.slice(0, -1).split("\n");
  if (rows.length !== 1 || !/^[d-][rwx-]{9}[@.]?\s/.test(rows[0])
    || !rows[0].endsWith(` ${target}`)) refuse();
}

// Generic read-only physical evidence. NOT a production descriptor, owner,
// PostgreSQL role/grant, readiness, deployment or admission capability.
export function holdTask6aRootOwnedJsonFileV1(target: string) {
  if (arguments.length !== 1 || closeUncertain || process.platform !== "darwin"
    || typeof target !== "string" || target.length > 1024 || !path.posix.isAbsolute(target)
    || target === "/" || path.posix.normalize(target) !== target || target.endsWith("/")
    || /[\x00-\x1f\x7f]/.test(target) || target.split("/").length > 16) refuse();
  const pins: { target: string; fd: number; stat: BigIntStats }[] = [];
  let closed = false, invalid = false;
  const close = () => {
    if (closed) return;
    closed = true;
    let uncertain = false;
    while (pins.length) {
      const pin = pins.pop()!;
      try { fs.closeSync(pin.fd); } catch { uncertain = true; closeUncertain = true; }
    }
    if (uncertain) refuse();
  };
  try {
    // Absolute system binary, never PATH-selected or an environment wrapper.
    for (const systemPath of ["/", "/bin", "/bin/ls"]) {
      const stat = fs.lstatSync(systemPath, { bigint: true });
      if (stat.uid !== 0n || stat.isSymbolicLink() || (stat.mode & 0o022n) !== 0n
        || (systemPath === "/bin/ls" ? !stat.isFile() : !stat.isDirectory())) refuse();
    }
    const parent = path.posix.dirname(target);
    const ancestors = ["/"];
    let current = "/";
    for (const segment of parent.split("/").filter(Boolean)) {
      current = path.posix.join(current, segment); ancestors.push(current);
    }
    for (const ancestor of ancestors) {
      const stat = fs.lstatSync(ancestor, { bigint: true });
      if (!stat.isDirectory() || stat.isSymbolicLink() || stat.uid !== 0n
        || (stat.mode & 0o7777n) !== 0o755n) refuse();
      const fd = fs.openSync(ancestor,
        fs.constants.O_RDONLY | fs.constants.O_DIRECTORY | fs.constants.O_NOFOLLOW);
      pins.push({ target: ancestor, fd, stat });
      if (!same(stat, fs.fstatSync(fd, { bigint: true }), DIRECTORY_KEYS)) refuse();
      noAcl(ancestor);
      if (!same(stat, fs.lstatSync(ancestor, { bigint: true }), DIRECTORY_KEYS)) refuse();
    }
    const stat = fs.lstatSync(target, { bigint: true });
    if (!stat.isFile() || stat.isSymbolicLink() || stat.uid !== 0n || stat.nlink !== 1n
      || (stat.mode & 0o7777n) !== 0o444n || stat.size < 1n || stat.size > 16384n) refuse();
    const fd = fs.openSync(target, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW | fs.constants.O_NONBLOCK);
    pins.push({ target, fd, stat });
    const checkMetadata = () => {
      if (closed || invalid || closeUncertain) refuse();
      for (const pin of pins) {
        const keys = pin.stat.isFile() ? FILE_KEYS : DIRECTORY_KEYS;
        if (!same(pin.stat, fs.fstatSync(pin.fd, { bigint: true }), keys)
          || !same(pin.stat, fs.lstatSync(pin.target, { bigint: true }), keys)) refuse();
        noAcl(pin.target);
        if (!same(pin.stat, fs.fstatSync(pin.fd, { bigint: true }), keys)
          || !same(pin.stat, fs.lstatSync(pin.target, { bigint: true }), keys)) refuse();
      }
    };
    const readBytes = (): Buffer => {
      const buffer = Buffer.alloc(Number(stat.size) + 1);
      let offset = 0;
      while (offset < buffer.length) {
        const count = fs.readSync(fd, buffer, offset, buffer.length - offset, offset);
        if (!count) break;
        offset += count;
      }
      if (offset !== Number(stat.size)) refuse();
      return buffer.subarray(0, offset);
    };
    checkMetadata(); const original = Buffer.from(readBytes()); checkMetadata();
    const recheck = () => {
      try {
        checkMetadata();
        if (!readBytes().equals(original)) refuse();
        checkMetadata();
      } catch { invalid = true; close(); refuse(); }
    };
    recheck();
    return Object.freeze({ read: () => { recheck(); return Buffer.from(original); }, recheck, close });
  } catch { invalid = true; close(); refuse(); }
}
