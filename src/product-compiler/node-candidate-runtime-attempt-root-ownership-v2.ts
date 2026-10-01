import {
  closeSync, constants, fchownSync, fstatSync, lstatSync,
  mkdtempSync, openSync, readdirSync, realpathSync, type BigIntStats,
} from "node:fs";
import path from "node:path";

// This creates a new root; it cannot repair or adopt an existing directory.
// The return value is an internal filesystem pin, not execution authority.
export function createNodeCandidateRuntimeAttemptRootInternalV2(prefix: string): Readonly<{
  absolutePath: string;
  device: bigint;
  inode: bigint;
}> {
  const uid = process.getuid?.();
  const gid = process.getgid?.();
  if (uid === undefined || gid === undefined
    || uid !== process.geteuid?.() || gid !== process.getegid?.()) {
    throw new Error("Candidate runtime fresh root requires ordinary POSIX ownership");
  }
  if (typeof prefix !== "string" || prefix.length === 0 || prefix.length > 4096
    || prefix.includes("\0") || !path.isAbsolute(prefix) || path.normalize(prefix) !== prefix) {
    throw new Error("Candidate runtime fresh root prefix is invalid");
  }
  const alias = mkdtempSync(prefix);
  const created = lstatSync(alias, { bigint: true });
  const root = realpathSync(alias);
  const verify = (status: BigIntStats, expectedGid: bigint): void => {
    if (!status.isDirectory() || status.isSymbolicLink()
      || status.dev !== created.dev || status.ino !== created.ino
      || status.mode !== created.mode || (status.mode & 0o7777n) !== 0o700n
      || status.uid !== created.uid || status.uid !== BigInt(uid)
      || status.gid !== expectedGid) {
      throw new Error("Candidate runtime fresh root identity or ownership changed");
    }
  };
  const verifyPaths = (expectedGid: bigint): void => {
    verify(lstatSync(alias, { bigint: true }), expectedGid);
    verify(lstatSync(root, { bigint: true }), expectedGid);
    if (realpathSync(alias) !== root || realpathSync(root) !== root
      || readdirSync(root).length !== 0) {
      throw new Error("Candidate runtime fresh root identity or empty canonical path changed");
    }
  };
  verify(created, created.gid);
  let descriptor: number | undefined;
  const errors: unknown[] = [];
  try {
    descriptor = openSync(root, constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW);
    verify(fstatSync(descriptor, { bigint: true }), created.gid);
    verifyPaths(created.gid);
    // Mutate only the held, original, newly created UID-owned directory.
    fchownSync(descriptor, uid, gid);
    verify(fstatSync(descriptor, { bigint: true }), BigInt(gid));
    verifyPaths(BigInt(gid));
  } catch (error) {
    errors.push(error);
  }
  if (descriptor !== undefined) {
    try {
      closeSync(descriptor);
    } catch (error) {
      errors.push(error);
    }
  }
  if (errors.length > 1) {
    throw new AggregateError(errors, "Candidate runtime root preparation and close failed", {
      cause: errors[0],
    });
  }
  if (errors.length === 1) throw errors[0];
  // Reuse the original pin after close; never adopt a rebound alias/root.
  verifyPaths(BigInt(gid));
  return Object.freeze({ absolutePath: root, device: created.dev, inode: created.ino });
  // Failed roots are deliberately retained: path deletion is not inode-bound.
}
