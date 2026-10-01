import * as fs from "node:fs";
import { isAbsolute, normalize } from "node:path";

// Test preparation only: never accepts an existing directory or grants authority.
export function createPrivateOutputParent(prefix, io = fs) {
  if (typeof prefix !== "string" || prefix.length === 0
    || Buffer.byteLength(prefix) > 4096 || prefix.includes("\0")
    || !isAbsolute(prefix) || normalize(prefix) !== prefix) {
    throw new Error("private output-parent prefix must be absolute and normalized");
  }
  if (typeof process.getuid !== "function" || typeof process.getgid !== "function"
    || process.getuid() !== process.geteuid() || process.getgid() !== process.getegid()) {
    throw new Error("private output-parent requires ordinary process ownership");
  }
  const uid = process.getuid();
  const gid = process.getgid();
  const alias = io.mkdtempSync(prefix);
  const created = io.lstatSync(alias, { bigint: true });
  const verify = (observed, expectedGid) => {
    if (!observed.isDirectory() || observed.isSymbolicLink()
      || observed.dev !== created.dev || observed.ino !== created.ino
      || observed.uid !== BigInt(uid) || observed.gid !== expectedGid
      || (observed.mode & 0o7777n) !== 0o700n) {
      throw new Error("private output-parent ownership, identity or metadata changed");
    }
  };
  verify(created, created.gid);
  const canonical = io.realpathSync(alias);
  const errors = [];
  let descriptor;
  const verifyCurrent = (expectedGid) => {
    verify(io.fstatSync(descriptor, { bigint: true }), expectedGid);
    verify(io.lstatSync(alias, { bigint: true }), expectedGid);
    verify(io.lstatSync(canonical, { bigint: true }), expectedGid);
    if (io.realpathSync(alias) !== canonical || io.realpathSync(canonical) !== canonical) {
      throw new Error("private output-parent canonical identity changed");
    }
  };
  try {
    descriptor = io.openSync(canonical,
      fs.constants.O_RDONLY | fs.constants.O_DIRECTORY | fs.constants.O_NOFOLLOW);
    verifyCurrent(created.gid);
    // Only our fresh, UID-owned, mode-0700 held directory is prepared.
    io.fchownSync(descriptor, uid, gid);
    verifyCurrent(BigInt(gid));
  } catch (error) {
    errors.push(error);
  }
  if (descriptor !== undefined) {
    try {
      io.closeSync(descriptor);
    } catch (error) {
      errors.push(error);
    }
  }
  if (errors.length > 1) {
    throw new AggregateError(errors, "private output-parent preparation and close failed", {
      cause: errors[0],
    });
  }
  if (errors.length === 1) throw errors[0];
  return canonical;
}
