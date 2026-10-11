import fs, { type BigIntStats } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { parseTask6aPostgresSocketTransportV1 } from "./task6a-postgres-socket-transport-v1.js";
import { holdTask6aProtectedPostgresDescriptorV1 } from "./task6a-protected-postgres-descriptor-v1.js";

const KEYS = ["dev", "ino", "uid", "gid", "mode", "birthtimeNs", "nlink"] as const;
const same = (a: BigIntStats, b: BigIntStats) => KEYS.every(key => a[key] === b[key]);
const validIdentity = (n: number) => Number.isSafeInteger(n) && n > 0 && n <= 4294967294;
const physicalRefused = (): never => { throw Error("TASK6A_SOCKET_PHYSICAL_REFUSED"); };
const protectedRefused = (): never => { throw Error("TASK6A_PROTECTED_POSTGRES_SOCKET_REFUSED"); };
let cleanupUncertain = false;

function noAcl(target: string, kind: "d" | "s"): void {
  for (const systemPath of ["/", "/bin", "/bin/ls"]) {
    const stat = fs.lstatSync(systemPath, { bigint: true });
    if (stat.uid !== 0n || stat.isSymbolicLink() || (stat.mode & 0o022n) !== 0n
      || (systemPath === "/bin/ls" ? !stat.isFile() : !stat.isDirectory())) physicalRefused();
  }
  const result = spawnSync("/bin/ls", ["-ldne", target], {
    cwd: "/", env: { PATH: "/usr/bin:/bin", LANG: "C", LC_ALL: "C" },
    encoding: "utf8", timeout: 2000, maxBuffer: 16384,
  });
  if (result.error || result.signal || result.status !== 0 || result.stderr !== ""
    || !result.stdout.endsWith("\n")) physicalRefused();
  const rows = result.stdout.slice(0, -1).split("\n");
  if (rows.length !== 1 || !new RegExp(`^${kind}[rwx-]{9}[@.]?\\s`).test(rows[0])
    || !rows[0].endsWith(` ${target}`)) physicalRefused();
}
function snapshot(stat: BigIntStats) {
  const values = Object.fromEntries(KEYS.map(key => [key, String(stat[key])]));
  return Object.freeze(values) as Readonly<Record<(typeof KEYS)[number], string>>;
}

// Diagnostic physical data only. Caller path does NOT authenticate ancestry,
// actual backend role/grants, schema, deployment, ownership or admission.
export function holdTask6aSocketPhysicalEvidenceV1(value: unknown, serverOsUid: number, runtimeOsGid: number) {
  try {
    if (arguments.length !== 3 || process.platform !== "darwin" || !validIdentity(serverOsUid)
      || !validIdentity(runtimeOsGid)) physicalRefused();
    const transport = parseTask6aPostgresSocketTransportV1(value);
    if (serverOsUid === transport.osUid) physicalRefused();
    const checkIdentity = () => {
      if (process.getuid?.() !== transport.osUid || process.geteuid?.() !== transport.osUid
        || process.getgid?.() !== runtimeOsGid || process.getegid?.() !== runtimeOsGid) physicalRefused();
    };
    checkIdentity();
    const directoryPath = transport.socketDirectory, socketPath = `${directoryPath}/.s.PGSQL.${transport.port}`;
    const directory = fs.lstatSync(directoryPath, { bigint: true });
    const socket = fs.lstatSync(socketPath, { bigint: true });
    const checkMetadata = (dir: BigIntStats, leaf: BigIntStats) => {
      if (!dir.isDirectory() || dir.isSymbolicLink() || dir.uid !== BigInt(serverOsUid)
        || dir.gid !== BigInt(runtimeOsGid) || (dir.mode & 0o7777n) !== 0o710n
        || !leaf.isSocket() || leaf.isSymbolicLink() || leaf.uid !== BigInt(serverOsUid)
        || (leaf.mode & 0o7777n) !== 0o777n || leaf.nlink !== 1n
        || !same(directory, dir) || !same(socket, leaf)) physicalRefused();
    };
    let closed = false, invalid = false;
    const close = () => { closed = true; };
    const recheck = () => {
      try {
        if (closed || invalid) physicalRefused();
        checkIdentity();
        checkMetadata(fs.lstatSync(directoryPath, { bigint: true }), fs.lstatSync(socketPath, { bigint: true }));
        noAcl(directoryPath, "d"); noAcl(socketPath, "s");
        checkMetadata(fs.lstatSync(directoryPath, { bigint: true }), fs.lstatSync(socketPath, { bigint: true }));
        checkIdentity();
      } catch { invalid = true; close(); physicalRefused(); }
    };
    // Search-only0710 cannot be opened O_RDONLY by the client. These are lstat
    // pins, not openat/path authority; protected composition supplies ancestry.
    recheck();
    const observation = Object.freeze({ schema: "setfarm.socket-physical-evidence.v1" as const,
      directory: snapshot(directory), socket: snapshot(socket) });
    return Object.freeze({ observe: () => { recheck(); return observation; }, recheck, close });
  } catch { physicalRefused(); }
}

// Fixed descriptor + immutable ancestry + physical transport evidence only.
// No socket connection, server-role/grant/schema/readiness/owner admission.
export function holdTask6aProtectedPostgresSocketV1() {
  if (arguments.length !== 0 || process.platform !== "darwin" || cleanupUncertain) protectedRefused();
  const pins: { target: string; fd: number; stat: BigIntStats }[] = [];
  let descriptor: ReturnType<typeof holdTask6aProtectedPostgresDescriptorV1> | undefined;
  let physical: ReturnType<typeof holdTask6aSocketPhysicalEvidenceV1> | undefined;
  let closed = false, invalid = false;
  const close = () => {
    if (closed) return;
    closed = true;
    let uncertain = false;
    try { physical?.close(); } catch { uncertain = true; }
    while (pins.length) {
      try { fs.closeSync(pins.pop()!.fd); } catch { uncertain = true; }
    }
    try { descriptor?.close(); } catch { uncertain = true; }
    if (uncertain) { cleanupUncertain = true; protectedRefused(); }
  };
  try {
    const heldDescriptor = holdTask6aProtectedPostgresDescriptorV1();
    if (!heldDescriptor) throw Error("TASK6A_PROTECTED_POSTGRES_SOCKET_REFUSED");
    descriptor = heldDescriptor;
    const fixed = heldDescriptor.read();
    const parent = path.posix.dirname(fixed.transport.socketDirectory);
    const ancestors = ["/"];
    let current = "/";
    for (const segment of parent.split("/").filter(Boolean)) {
      current = path.posix.join(current, segment); ancestors.push(current);
    }
    for (const target of ancestors) {
      const stat = fs.lstatSync(target, { bigint: true });
      if (!stat.isDirectory() || stat.isSymbolicLink() || stat.uid !== 0n
        || (stat.mode & 0o7777n) !== 0o755n) protectedRefused();
      const fd = fs.openSync(target, fs.constants.O_RDONLY | fs.constants.O_DIRECTORY | fs.constants.O_NOFOLLOW);
      pins.push({ target, fd, stat });
      if (!same(stat, fs.fstatSync(fd, { bigint: true }))) protectedRefused();
      noAcl(target, "d");
      if (!same(stat, fs.lstatSync(target, { bigint: true }))) protectedRefused();
    }
    const checkParents = () => {
      if (closed || invalid || cleanupUncertain) protectedRefused();
      for (const pin of pins) {
        if (!same(pin.stat, fs.fstatSync(pin.fd, { bigint: true }))
          || !same(pin.stat, fs.lstatSync(pin.target, { bigint: true }))) protectedRefused();
        noAcl(pin.target, "d");
        if (!same(pin.stat, fs.fstatSync(pin.fd, { bigint: true }))
          || !same(pin.stat, fs.lstatSync(pin.target, { bigint: true }))) protectedRefused();
      }
    };
    heldDescriptor.recheck(); checkParents();
    physical = holdTask6aSocketPhysicalEvidenceV1(fixed.transport, fixed.serverOsUid, fixed.runtimeOsGid);
    heldDescriptor.recheck(); checkParents();
    const recheck = () => {
      try {
        checkParents(); descriptor!.recheck(); physical!.recheck();
        checkParents(); descriptor!.recheck();
      } catch { invalid = true; protectedRefused(); }
    };
    recheck();
    return Object.freeze({ read: () => {
      try {
        recheck(); const observation = physical!.observe(); recheck();
        return Object.freeze({ descriptor: fixed, physical: observation });
      } catch { invalid = true; protectedRefused(); }
    }, recheck, close });
  } catch { invalid = true; close(); protectedRefused(); }
}
