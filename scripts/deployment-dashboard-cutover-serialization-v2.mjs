import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { types } from "node:util";
import { createHash, randomUUID } from "node:crypto";
import { observeCurrentMaintenanceOwnerV1, observeMaintenanceOwnerProcessV1 }
  from "./build-generation-maintenance-owner-observer.mjs";

// Reservation custody only: not DB ownership, stale-helper drain, or effect admission.
const handles = new WeakMap();
const vault = { slots: [], state: "idle", active: false, owner: null, wire: null, lock: null };
const CORE = ["dev", "ino", "mode", "uid", "gid", "birthtimeNs"];
const FULL = [...CORE, "size", "nlink", "mtimeNs", "ctimeNs"];
const canonical = value => value === null || typeof value !== "object" ? JSON.stringify(value)
  : Array.isArray(value) ? `[${value.map(canonical).join(",")}]`
    : `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`;
const same = (a, b, keys = CORE) => keys.every(key => a[key] === b[key]);
const fail = () => { throw Error("DASHBOARD_CUTOVER_SERIALIZATION_REFUSED"); };
function check() { if (!vault.active || vault.state === "burned") fail(); }
function port(callback) { check(); const result = callback(); check(); return result; }
function enter(state) {
  if (vault.active) { vault.state = "burned"; fail(); }
  vault.active = true;
  vault.state = state;
}
function inputSnapshot(input) {
  if (!input || typeof input !== "object" || types.isProxy(input)
    || Object.getPrototypeOf(input) !== Object.prototype) fail();
  const descriptors = Object.getOwnPropertyDescriptors(input), keys = Reflect.ownKeys(descriptors);
  if (keys.length !== 2 || keys.some(key => typeof key !== "string"
    || !["cutoverIntentHash", "ownerClaimHash"].includes(key)
    || !descriptors[key].enumerable || !("value" in descriptors[key])
    || typeof descriptors[key].value !== "string" || !/^[a-f0-9]{64}$/.test(descriptors[key].value))) fail();
  return Object.fromEntries(keys.map(key => [key, descriptors[key].value]));
}
function openOriginal(target, flags, mode, directory) {
  check();
  const fd = fs.openSync(target, flags, mode);
  // Register before any next port or check: even a swallowed reentry owns this return.
  const slot = { target, fd, directory, state: "unsealed", identity: null };
  vault.slots.push(slot);
  check();
  const stat = port(() => fs.fstatSync(fd, { bigint: true }));
  if (directory ? !stat.isDirectory() : !stat.isFile()) fail();
  slot.identity = stat; slot.state = "sealed";
  return slot;
}
function directories() {
  for (const slot of vault.slots.filter(slot => slot.directory)) {
    if (slot.state !== "sealed") fail();
    const held = port(() => fs.fstatSync(slot.fd, { bigint: true }));
    const named = port(() => fs.lstatSync(slot.target, { bigint: true }));
    if (!held.isDirectory() || !named.isDirectory() || named.isSymbolicLink()
      || !same(slot.identity, held) || !same(slot.identity, named)) fail();
  }
}
function readOriginal(slot) {
  const buffer = Buffer.alloc(65537); let length = 0;
  while (length < buffer.length) {
    const count = port(() => fs.readSync(slot.fd, buffer, length, buffer.length - length, length));
    if (!Number.isInteger(count) || count < 0 || count > buffer.length - length) fail();
    if (count === 0) break;
    length += count;
  }
  if (length < 1 || length > 65536) fail();
  return buffer.subarray(0, length);
}
function physical() {
  directories();
  const slot = vault.lock;
  if (!slot || slot.state !== "sealed" || !vault.wire || !slot.published) fail();
  const before = port(() => fs.fstatSync(slot.fd, { bigint: true }));
  const named = port(() => fs.lstatSync(slot.target, { bigint: true }));
  if (!before.isFile() || !named.isFile() || named.isSymbolicLink()
    || !same(slot.published, before, FULL) || !same(slot.published, named, FULL)) fail();
  if (!readOriginal(slot).equals(vault.wire)) fail();
  if (!same(before, port(() => fs.fstatSync(slot.fd, { bigint: true })), FULL)) fail();
  directories();
}
function owner() {
  const account = port(() => os.userInfo());
  if (account.uid !== vault.owner.uid || account.homedir !== vault.home
    || process.pid !== vault.owner.pid || process.getuid() !== vault.owner.uid) fail();
  if (port(() => observeMaintenanceOwnerProcessV1(vault.owner)).state !== "live_match") fail();
}
function closeOriginal(slot, normal) {
  if (slot.state !== "sealed") fail();
  const stat = normal ? port(() => fs.fstatSync(slot.fd, { bigint: true }))
    : fs.fstatSync(slot.fd, { bigint: true });
  if (!same(slot.identity, stat) || (slot.directory ? !stat.isDirectory() : !stat.isFile())) fail();
  if (normal) check();
  slot.state = "close-attempted";
  try { fs.closeSync(slot.fd); slot.state = "close-settled"; }
  catch { slot.state = "close-unknown"; fail(); }
  if (normal) check();
}
function burn() {
  vault.state = "burned";
  // No pathname, sync, repair or repeated close in failure cleanup.
  for (const slot of [...vault.slots].reverse()) {
    if (slot.state !== "sealed") continue;
    try { closeOriginal(slot, false); } catch { /* Retain uncertain original custody. */ }
  }
}
function lookup(handle) {
  if (vault.active) { vault.state = "burned"; fail(); }
  if (vault.state !== "held" || handles.get(handle) !== vault) fail();
}

export function acquireDashboardCutoverSerializationV2(input) {
  if (vault.active) { vault.state = "burned"; fail(); }
  if (vault.state !== "idle") fail();
  const snapshot = inputSnapshot(input);
  enter("acquiring");
  try {
    const account = port(() => os.userInfo());
    if (account.uid !== process.getuid() || !path.isAbsolute(account.homedir)) fail();
    vault.home = account.homedir;
    vault.owner = port(() => observeCurrentMaintenanceOwnerV1(randomUUID())).owner;
    let workspace = path.join(account.homedir, "ai", "setrox");
    if (process.platform === "darwin" && workspace.startsWith("/var/")) workspace = `/private${workspace}`;
    const root = path.parse(workspace).root;
    const segments = path.relative(root, workspace).split(path.sep);
    if (segments.length + 4 > 128) fail();
    const hold = target => {
      directories();
      const before = port(() => fs.lstatSync(target, { bigint: true }));
      if (!before.isDirectory() || before.isSymbolicLink()) fail();
      const slot = openOriginal(target, fs.constants.O_RDONLY | fs.constants.O_DIRECTORY | fs.constants.O_NOFOLLOW,
        undefined, true);
      if (!same(before, slot.identity)) fail();
      directories(); return slot;
    };
    hold(root);
    for (let index = 0; index < segments.length; index++) hold(path.join(root, ...segments.slice(0, index + 1)));
    const workspaceStat = vault.slots.at(-1).identity, uid = BigInt(account.uid);
    if (workspaceStat.uid !== uid || (workspaceStat.mode & 0o022n) !== 0n) fail();
    const scoped = target => {
      const slot = hold(target), stat = slot.identity;
      if (stat.uid !== uid || stat.dev !== workspaceStat.dev || (stat.mode & 0o022n) !== 0n) fail();
      return slot;
    };
    scoped(path.join(workspace, "data"));
    const baseline = scoped(path.join(workspace, "data", "internal-production-baseline"));
    const parentPath = path.join(baseline.target, "restart-authority-retirement-v1");
    let missing = false;
    try { port(() => fs.lstatSync(parentPath, { bigint: true })); }
    catch (error) { check(); if (error.code === "ENOENT") missing = true; else throw error; }
    if (missing) {
      port(() => fs.mkdirSync(parentPath, { mode: 0o700 }));
      directories(); port(() => fs.fsyncSync(baseline.fd)); directories();
    }
    vault.parent = scoped(parentPath);
    if ((vault.parent.identity.mode & 0o7777n) !== 0o700n) fail();
    directories();
    const lock = openOriginal(path.join(parentPath, "physical-service-restart-authority.transition.lock"),
      fs.constants.O_RDWR | fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_NOFOLLOW, 0o600, false);
    vault.lock = lock;
    if (lock.identity.uid !== uid || lock.identity.dev !== workspaceStat.dev
      || (lock.identity.mode & 0o7777n) !== 0o600n || lock.identity.nlink !== 1n || lock.identity.size !== 0n) fail();
    const body = { schema: "setfarm.internal-production-dashboard-cutover-serialization-lock.v2",
      purpose: "preserved-dashboard-cutover", ...snapshot, owner: vault.owner };
    const lockHash = createHash("sha256").update(canonical(body)).digest("hex");
    vault.wire = Buffer.from(canonical({ ...body, lockHash }) + "\n");
    if (vault.wire.length < 1 || vault.wire.length > 65536) fail();
    directories(); port(() => fs.writeFileSync(lock.fd, vault.wire));
    lock.published = port(() => fs.fstatSync(lock.fd, { bigint: true }));
    if (!same(lock.identity, lock.published) || lock.published.nlink !== 1n
      || lock.published.size !== BigInt(vault.wire.length)) fail();
    physical(); port(() => fs.fsyncSync(lock.fd)); physical();
    port(() => fs.fsyncSync(vault.parent.fd)); physical();
    owner(); physical();
    const handle = Object.freeze(Object.create(null));
    handles.set(handle, vault); vault.state = "held";
    return handle;
  } catch { burn(); fail(); }
  finally { vault.active = false; }
}

export function assertDashboardCutoverSerializationV2(handle) {
  lookup(handle); enter("held");
  try { physical(); owner(); physical(); }
  catch { burn(); fail(); }
  finally { vault.active = false; }
}

export function releaseDashboardCutoverSerializationV2(handle) {
  lookup(handle); enter("releasing");
  try {
    owner(); physical(); owner(); physical();
    vault.unlinkState = "attempted";
    try { port(() => fs.unlinkSync(vault.lock.target)); vault.unlinkState = "settled"; }
    catch { vault.unlinkState = "unknown"; throw Error("unlink uncertain"); }
    const unlinked = port(() => fs.fstatSync(vault.lock.fd, { bigint: true }));
    if (!same(vault.lock.published, unlinked, [...CORE, "size", "mtimeNs"]) || unlinked.nlink !== 0n) fail();
    directories();
    vault.parentSyncState = "attempted";
    try { port(() => fs.fsyncSync(vault.parent.fd)); vault.parentSyncState = "settled"; }
    catch { vault.parentSyncState = "unknown"; throw Error("parent sync uncertain"); }
    for (const slot of [...vault.slots].reverse()) closeOriginal(slot, true);
    if (vault.slots.some(slot => slot.state !== "close-settled")) fail();
    handles.delete(handle); vault.state = "released";
  } catch { burn(); fail(); }
  finally { vault.active = false; }
}
