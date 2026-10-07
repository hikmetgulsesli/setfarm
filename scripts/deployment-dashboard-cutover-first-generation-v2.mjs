import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { types } from "node:util";
import { createHash, randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { observeCurrentMaintenanceOwnerV1, observeMaintenanceOwnerProcessV1 }
  from "./build-generation-maintenance-owner-observer.mjs";

// Custody only. The consuming adapter supplies genuine owner/build/namespace
// authority; neither two hash labels nor this private handle supply that proof.
const handles = new WeakMap();
const v = { state: "idle", active: false, slots: [], child: null, settlement: null, publicationAttempted: false };
const CORE = ["dev", "ino", "mode", "uid", "gid", "birthtimeNs"];
const FULL = [...CORE, "nlink", "size", "mtimeNs", "ctimeNs"];
const ROOT = "restart-authority-retirement-v1", LOCK = "physical-service-restart-authority.transition.lock";
const HELPER = fileURLToPath(new URL("./deployment-dashboard-cutover-atomic-root-v2.py", import.meta.url));
const HELPER_HASH = "e65e3f49ac0ee41d52c82cfe9491ff631f3180c2311ef9424ce9849256436b38";
const ENV = Object.freeze({ PATH: "/usr/bin:/bin:/usr/sbin:/sbin", LANG: "C", LC_ALL: "C", TZ: "UTC" });
const SUCCESS = Buffer.from("DASHBOARD_ATOMIC_ROOT_PUBLISHED\n");
const same = (a, b, keys = CORE) => keys.every(key => a[key] === b[key]);
const canonical = value => value === null || typeof value !== "object" ? JSON.stringify(value)
  : Array.isArray(value) ? `[${value.map(canonical).join(",")}]`
    : `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`;
const fail = () => { throw Error("DASHBOARD_FIRST_GENERATION_RESERVATION_REFUSED"); };
function burn() { v.state = "burned"; }
function check() { if (!v.active || v.state === "burned") fail(); }
function port(callback) { check(); const value = callback(); check(); return value; }
function start(state) { if (v.active) { burn(); fail(); } v.active = true; v.state = state; }
function snapshot(input) {
  if (!input || typeof input !== "object" || types.isProxy(input) || Object.getPrototypeOf(input) !== Object.prototype) fail();
  const fields = Object.getOwnPropertyDescriptors(input), keys = Reflect.ownKeys(fields);
  if (keys.length !== 2 || keys.some(key => typeof key !== "string" || !["cutoverIntentHash", "ownerClaimHash"].includes(key)
    || !fields[key].enumerable || !Object.hasOwn(fields[key], "value") || typeof fields[key].value !== "string"
    || !/^[a-f0-9]{64}$/.test(fields[key].value))) fail();
  return Object.fromEntries(keys.map(key => [key, fields[key].value]));
}
function open(target, flags, mode, directory) {
  check(); if (v.slots.length >= 128) fail();
  const fd = fs.openSync(target, flags, mode);
  const slot = { fd, target, directory, state: "unsealed", identity: null };
  v.slots.push(slot); // Register the actual returned occurrence before burn/fstat.
  check();
  const identity = port(() => fs.fstatSync(fd, { bigint: true }));
  if (directory ? !identity.isDirectory() : !identity.isFile()) fail();
  slot.identity = identity; slot.state = "sealed"; return slot;
}
function directories() {
  for (const slot of v.slots.filter(slot => slot.directory)) {
    if (slot.state !== "sealed") fail();
    for (const current of [port(() => fs.fstatSync(slot.fd, { bigint: true })),
      port(() => fs.lstatSync(slot.target, { bigint: true }))]) {
      if (!current.isDirectory() || current.isSymbolicLink() || !same(slot.identity, current)) fail();
    }
  }
}
function bytes(slot, maximum) {
  const buffer = Buffer.alloc(Math.min(maximum + 1, 1048576)), chunks = []; let size = 0;
  while (size <= maximum) {
    const count = port(() => fs.readSync(slot.fd, buffer, 0, Math.min(buffer.length, maximum + 1 - size), size));
    if (!Number.isInteger(count) || count < 0 || count > Math.min(buffer.length, maximum + 1 - size)) fail();
    if (count === 0) break;
    size += count; if (size > maximum) fail(); chunks.push(Buffer.from(buffer.subarray(0, count)));
  }
  const expectedSize = slot === v.lock ? v.publishedLock?.size : slot.identity.size;
  if (!size || BigInt(size) !== expectedSize) fail(); return Buffer.concat(chunks, size);
}
function holdFile(target, maximum, expectedHash, rootOwned) {
  const before = port(() => fs.lstatSync(target, { bigint: true }));
  if (!before.isFile() || before.isSymbolicLink() || before.size < 1n || before.size > BigInt(maximum)
    || (before.mode & 0o022n) !== 0n || before.uid !== BigInt(rootOwned ? 0 : v.account.uid)
    || (!rootOwned && before.nlink !== 1n)) fail();
  const slot = open(target, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW | fs.constants.O_NONBLOCK, undefined, false);
  if (!same(before, slot.identity, FULL)) fail();
  slot.maximum = maximum; slot.digest = createHash("sha256").update(bytes(slot, maximum)).digest("hex");
  if (expectedHash && slot.digest !== expectedHash) fail();
  return slot;
}
function inputs() {
  for (const slot of v.inputs) {
    if (slot.state !== "sealed" || !same(slot.identity, port(() => fs.fstatSync(slot.fd, { bigint: true })), FULL)
      || !same(slot.identity, port(() => fs.lstatSync(slot.target, { bigint: true })), FULL)) fail();
    if (createHash("sha256").update(bytes(slot, slot.maximum)).digest("hex") !== slot.digest) fail();
  }
}
function owner() {
  const account = port(() => os.userInfo());
  if (["uid", "gid", "homedir", "username", "shell"].some(key => account[key] !== v.account[key])
    || process.pid !== v.owner.pid || process.getuid() !== v.account.uid || process.getgid() !== v.account.gid) fail();
  if (port(() => observeMaintenanceOwnerProcessV1(v.owner)).state !== "live_match") fail();
}
function physical() {
  directories(); inputs();
  if (!v.lock || v.lock.state !== "sealed" || !v.publishedLock || !v.wire) fail();
  for (const stat of [port(() => fs.fstatSync(v.lock.fd, { bigint: true })),
    port(() => fs.lstatSync(v.lock.target, { bigint: true }))]) if (!stat.isFile() || !same(v.publishedLock, stat, FULL)) fail();
  if (!bytes(v.lock, 65536).equals(v.wire)) fail();
  directories();
}
function lookup(handle, arity) {
  if (v.active) { burn(); fail(); }
  if (arity !== 1 || v.state !== "held" || handles.get(handle) !== v) fail();
}
function absence(target) {
  let missing = false;
  try { port(() => fs.lstatSync(target, { bigint: true })); }
  catch (error) { check(); if (error.code === "ENOENT") missing = true; else throw error; }
  if (!missing) fail();
}
function registerChild(child) {
  // May run after swallowed spawn reentry: all original custody is recorded
  // before the next check. Drain is allowed after burn, never another effect.
  v.child = child;
  const result = { chunks: [], stderr: [], bytes: 0, unknown: false, stdoutEOF: false, stderrEOF: false };
  const error = () => { result.unknown = true; burn(); };
  v.settlement = new Promise(resolve => child.on("close", (status, signal) => resolve({ ...result, status, signal })));
  child.on("error", error);
  for (const [stream, name] of [[child.stdout, "stdout"], [child.stderr, "stderr"]]) {
    stream.on("error", error); stream.on("end", () => { result[`${name}EOF`] = true; });
    stream.on("data", chunk => {
      if (!Buffer.isBuffer(chunk)) { error(); return; }
      result.bytes += chunk.length;
      if (result.bytes > 16384) { error(); return; }
      (name === "stdout" ? result.chunks : result.stderr).push(Buffer.from(chunk));
    });
  }
  return v.settlement;
}

export async function acquireFirstGenerationDashboardCutoverReservationV2(input) {
  if (v.active) { burn(); fail(); }
  if (arguments.length !== 1 || v.state !== "idle") fail();
  const captured = snapshot(input); start("acquiring");
  try {
    v.account = port(() => os.userInfo());
    if (v.account.uid !== process.getuid() || v.account.gid !== process.getgid() || !path.isAbsolute(v.account.homedir)) fail();
    v.owner = port(() => observeCurrentMaintenanceOwnerV1(randomUUID())).owner;
    let workspace = path.join(v.account.homedir, "ai", "setrox");
    if (process.platform === "darwin" && workspace.startsWith("/var/")) workspace = `/private${workspace}`;
    const prefix = path.parse(workspace).root, segments = path.relative(prefix, workspace).split(path.sep);
    if (segments.length + 6 > 128) fail();
    const hold = target => {
      directories(); const before = port(() => fs.lstatSync(target, { bigint: true }));
      if (!before.isDirectory() || before.isSymbolicLink()) fail();
      const slot = open(target, fs.constants.O_RDONLY | fs.constants.O_DIRECTORY | fs.constants.O_NOFOLLOW, undefined, true);
      if (!same(before, slot.identity)) fail(); directories(); return slot;
    };
    hold(prefix); for (let n = 1; n <= segments.length; n++) hold(path.join(prefix, ...segments.slice(0, n)));
    const workspaceIdentity = v.slots.at(-1).identity;
    const scoped = target => {
      const slot = hold(target);
      if (slot.identity.uid !== BigInt(v.account.uid) || slot.identity.dev !== workspaceIdentity.dev
        || (slot.identity.mode & 0o022n) !== 0n) fail(); return slot;
    };
    if (workspaceIdentity.uid !== BigInt(v.account.uid) || (workspaceIdentity.mode & 0o022n) !== 0n) fail();
    scoped(path.join(workspace, "data")); v.parent = scoped(path.join(workspace, "data", "internal-production-baseline"));
    v.rootPath = path.join(v.parent.target, ROOT); absence(v.rootPath);
    v.inputs = [holdFile(HELPER, 65536, HELPER_HASH, false), holdFile("/usr/bin/python3", 16 * 1024 * 1024, null, true)];
    v.stageLeaf = `.dashboard-cutover-root.${randomUUID()}.stage`;
    v.stagePath = path.join(v.parent.target, v.stageLeaf);
    directories(); port(() => fs.mkdirSync(v.stagePath, { mode: 0o700 }));
    v.root = scoped(v.stagePath); if ((v.root.identity.mode & 0o7777n) !== 0o700n) fail();
    v.lock = open(path.join(v.stagePath, LOCK), fs.constants.O_RDWR | fs.constants.O_CREAT | fs.constants.O_EXCL
      | fs.constants.O_NOFOLLOW | fs.constants.O_NONBLOCK, 0o600, false);
    if (v.lock.identity.uid !== BigInt(v.account.uid) || v.lock.identity.dev !== workspaceIdentity.dev || v.lock.identity.nlink !== 1n
      || v.lock.identity.size !== 0n || (v.lock.identity.mode & 0o7777n) !== 0o600n) fail();
    const body = { schema: "setfarm.internal-production-dashboard-cutover-serialization-lock.v2",
      purpose: "preserved-dashboard-cutover", ...captured, owner: v.owner };
    v.wire = Buffer.from(canonical({ ...body, lockHash: createHash("sha256").update(canonical(body)).digest("hex") }) + "\n");
    if (v.wire.length > 65536) fail();
    port(() => fs.writeFileSync(v.lock.fd, v.wire));
    v.publishedLock = port(() => fs.fstatSync(v.lock.fd, { bigint: true }));
    if (!same(v.lock.identity, v.publishedLock) || v.publishedLock.nlink !== 1n || v.publishedLock.size !== BigInt(v.wire.length)) fail();
    physical(); port(() => fs.fsyncSync(v.lock.fd)); physical();
    port(() => fs.fsyncSync(v.root.fd)); physical(); owner(); physical();
    if (v.publicationAttempted) fail(); v.publicationAttempted = true;
    const child = spawn("/usr/bin/python3", ["-I", "-S", "-B", HELPER, v.stageLeaf],
      { cwd: "/", env: ENV, stdio: ["ignore", "pipe", "pipe", v.parent.fd] });
    const settlement = registerChild(child);
    check();
    const result = await settlement;
    check();
    if (result.unknown || result.status !== 0 || result.signal !== null || !result.stdoutEOF || !result.stderrEOF
      || result.stderr.length !== 0 || !Buffer.concat(result.chunks).equals(SUCCESS)) fail();
    // Only update the mapping of the same original stage, never its identity.
    v.root.target = v.rootPath; v.lock.target = path.join(v.rootPath, LOCK);
    physical(); absence(v.stagePath); owner(); physical();
    check(); if (v.state !== "acquiring" || v.child !== child || v.settlement !== settlement) fail();
    const handle = Object.freeze(Object.create(null)); handles.set(handle, v); v.state = "held";
    return handle;
  } catch {
    burn();
    if (v.settlement) await v.settlement; // Retain/drain original, never cancel/retry.
    fail();
  } finally { v.active = false; }
}

export function assertFirstGenerationDashboardCutoverReservationV2(handle) {
  lookup(handle, arguments.length); start("held");
  try { physical(); owner(); physical(); }
  catch { burn(); fail(); }
  finally { v.active = false; }
}

export function closeFirstGenerationDashboardCutoverReservationV2(handle) {
  lookup(handle, arguments.length); start("closing");
  try {
    physical(); owner(); physical();
    for (const slot of [...v.slots].reverse()) {
      if (slot.state !== "sealed") fail();
      slot.state = "close-observing";
      const stat = port(() => fs.fstatSync(slot.fd, { bigint: true }));
      if (!same(slot === v.lock ? v.publishedLock : slot.identity, stat, slot.directory ? CORE : FULL)) fail();
      slot.state = "close-attempted";
      fs.closeSync(slot.fd); slot.state = "close-settled"; check();
    }
    check(); handles.delete(handle); v.state = "closed";
  } catch { burn(); fail(); }
  finally { v.active = false; }
}
