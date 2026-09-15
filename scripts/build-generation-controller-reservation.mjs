import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

// Internal physical primitive only. A handle is not a census, durable owner
// record, or permission to stop a service or dispose of a build generation.
const identityFields = ["dev", "ino", "uid", "gid", "mode", "birthtimeNs"];
const fileFields = [...identityFields, "size", "mtimeNs", "ctimeNs", "nlink"];
const same = (a, b, keys) => keys.every(key => a[key] === b[key]);
const fail = code => { throw new Error(code); };

function observeParents(directory) {
  if (typeof directory !== "string" || !path.isAbsolute(directory) || path.normalize(directory) !== directory) {
    fail("RESERVATION_PARENT_INVALID");
  }
  const parents = [];
  for (let current = directory; ; current = path.dirname(current)) {
    const identity = fs.lstatSync(current, { bigint: true });
    if (!identity.isDirectory() || identity.isSymbolicLink() || parents.length >= 128) fail("RESERVATION_PARENT_INVALID");
    parents.push({ path: current, identity });
    if (path.dirname(current) === current) break;
  }
  const immediate = parents[0].identity;
  if (immediate.uid !== BigInt(process.getuid()) || (immediate.mode & 0o022n) !== 0n) fail("RESERVATION_PARENT_INVALID");
  return parents;
}

function assertParents(parents) {
  for (const parent of parents) {
    const current = fs.lstatSync(parent.path, { bigint: true });
    if (!current.isDirectory() || current.isSymbolicLink() || !same(current, parent.identity, identityFields)) {
      fail("RESERVATION_PARENT_CHANGED");
    }
  }
}

export function publishControllerPidReservationV1(directory) {
  const parents = observeParents(directory);
  const target = path.join(directory, "spawner.lock");
  const staging = path.join(directory, `.spawner-maintenance-${randomUUID()}.tmp`);
  const bytes = Buffer.from(`${process.pid}\n`);
  let descriptor = null, closed = false;
  const close = () => {
    if (closed) return;
    closed = true; // Never retry an uncertain close on a possibly reused slot.
    if (descriptor !== null) fs.closeSync(descriptor);
  };
  try {
    descriptor = fs.openSync(staging, fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_RDWR | fs.constants.O_NOFOLLOW, 0o600);
    const initial = fs.fstatSync(descriptor, { bigint: true });
    if (!initial.isFile() || initial.nlink !== 1n || initial.uid !== BigInt(process.getuid())) fail("RESERVATION_CHANGED");
    assertParents(parents);
    fs.writeFileSync(descriptor, bytes);
    fs.fsyncSync(descriptor);

    const check = (file, expected, links) => {
      assertParents(parents);
      const valid = stat => stat.isFile() && !stat.isSymbolicLink()
        && stat.nlink === links && stat.size === BigInt(bytes.length)
        && same(stat, expected, fileFields);
      if (!valid(fs.fstatSync(descriptor, { bigint: true })) || !valid(fs.lstatSync(file, { bigint: true }))) fail("RESERVATION_CHANGED");
      const observed = Buffer.alloc(bytes.length + 1);
      if (fs.readSync(descriptor, observed, 0, observed.length, 0) !== bytes.length || !observed.subarray(0, bytes.length).equals(bytes)) fail("RESERVATION_CHANGED");
      if (!valid(fs.fstatSync(descriptor, { bigint: true })) || !valid(fs.lstatSync(file, { bigint: true }))) fail("RESERVATION_CHANGED");
      assertParents(parents);
    };

    const populated = fs.fstatSync(descriptor, { bigint: true });
    if (!same(populated, initial, identityFields)) fail("RESERVATION_CHANGED");
    check(staging, populated, 1n);
    fs.linkSync(staging, target); // EEXIST is always refusal, never adoption.
    const linked = fs.fstatSync(descriptor, { bigint: true });
    if (!same(linked, populated, [...identityFields, "size", "mtimeNs"])) fail("RESERVATION_CHANGED");
    check(staging, linked, 2n);
    check(target, linked, 2n);
    fs.unlinkSync(staging);
    assertParents(parents);
    const directoryFd = fs.openSync(directory, fs.constants.O_RDONLY | fs.constants.O_DIRECTORY | fs.constants.O_NOFOLLOW);
    let directoryFailure = null;
    try {
      if (!same(fs.fstatSync(directoryFd, { bigint: true }), parents[0].identity, identityFields)) fail("RESERVATION_PARENT_CHANGED");
      fs.fsyncSync(directoryFd);
    } catch (error) { directoryFailure = error; }
    try { fs.closeSync(directoryFd); }
    catch (closeError) {
      if (directoryFailure !== null) throw new AggregateError([directoryFailure, closeError], "RESERVATION_DIRECTORY_CLOSE_UNCERTAIN");
      throw closeError;
    }
    if (directoryFailure !== null) throw directoryFailure;
    const finalIdentity = fs.fstatSync(descriptor, { bigint: true });
    if (!same(finalIdentity, populated, [...identityFields, "size", "mtimeNs"])) fail("RESERVATION_CHANGED");
    check(target, finalIdentity, 1n);
    return Object.freeze({
      path: target,
      pid: process.pid,
      assertStable() {
        if (closed) fail("RESERVATION_CLOSED");
        check(target, finalIdentity, 1n);
      },
      close,
    });
  } catch (error) {
    // Do not infer non-publication from failure, or remove fixed/staging evidence.
    try { close(); } catch (closeError) { throw new AggregateError([error, closeError], "RESERVATION_CLOSE_UNCERTAIN"); }
    throw error;
  }
}
