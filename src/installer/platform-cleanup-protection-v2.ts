import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// Ordinary point-in-time safety check, never actor/ownership/exclusion authority.
// Legacy loaded cleaners and mutation across await still require adapter drain.
function refuse(): never { throw Error("SETFARM_PROTECTED_BASELINE_CLEANUP_REFUSED"); }
const keys = ["dev", "ino", "mode", "uid", "gid", "birthtimeNs"] as const;
type Original = { path: string; stat: fs.BigIntStats };
type Projection = { paths: string[]; links: string[]; originals: Original[]; absent: string | null };
function components(value: unknown): string[] {
  if (typeof value !== "string" || !value || !path.isAbsolute(value) || value.includes("\0")
    || Buffer.byteLength(value, "utf8") > 16384 || Buffer.from(value, "utf8").toString("utf8") !== value) refuse();
  const parts = value.slice(path.parse(value).root.length).split(path.sep).filter(Boolean);
  if (parts.length > 128 || parts.some(part => part === "." || part === "..")) refuse();
  return parts;
}
function project(value: string): Projection {
  const pending = components(value).map(part => ({ part, fromLink: false }));
  let current = path.parse(value).root, missing: string[] = [], absent: string | null = null;
  const originals: Original[] = [{ path: current, stat: fs.lstatSync(current, { bigint: true }) }];
  const paths = [value], links: string[] = []; let steps = 0;
  while (pending.length) {
    if (++steps > 128) refuse();
    const token = pending.shift()!;
    if (token.part === ".") continue;
    if (token.part === "..") { current = path.dirname(current); continue; }
    const next = path.join(current, token.part);
    let original: fs.BigIntStats;
    try { original = fs.lstatSync(next, { bigint: true }); }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      if (token.fromLink || pending.some(item => item.fromLink)) refuse();
      missing = [token.part, ...pending.map(item => item.part)]; absent = next; break;
    }
    originals.push({ path: next, stat: original });
    if (original.isSymbolicLink()) {
      if (links.length >= 16) refuse(); links.push(next);
      const destination = fs.readlinkSync(next);
      if (!destination || destination.includes("\0") || Buffer.byteLength(destination, "utf8") > 16384
        || Buffer.from(destination, "utf8").toString("utf8") !== destination) refuse();
      const root = path.parse(destination).root;
      const parts = destination.slice(root.length).split(path.sep).filter(Boolean);
      if (parts.length + pending.length > 128) refuse();
      if (path.isAbsolute(destination)) current = root;
      pending.unshift(...parts.map(part => ({ part, fromLink: true })));
      continue;
    }
    if ((!original.isDirectory() && !original.isFile()) || (pending.length && !original.isDirectory())) refuse();
    current = next;
  }
  const realParts = components(current), root = path.parse(current).root;
  for (let index = 0; index <= realParts.length; index++) {
    const name = path.join(root, ...realParts.slice(0, index));
    const stat = fs.lstatSync(name, { bigint: true });
    if (stat.isSymbolicLink() || (index < realParts.length && !stat.isDirectory())
      || (!stat.isDirectory() && !stat.isFile()) || (missing.length && !stat.isDirectory())) refuse();
    originals.push({ path: name, stat });
  }
  paths.push(path.join(current, ...missing));
  return { paths, links, originals, absent };
}
const fold = (value: string): string => process.platform === "darwin" ? value.normalize("NFD").toLowerCase() : value;
function prefix(left: string[], right: string[]): boolean {
  return left.length <= right.length && left.every((value, index) => fold(value) === fold(right[index]));
}
function tail(base: string, target: string): string[] | null {
  const value = path.relative(base, target);
  if (path.isAbsolute(value) || value.split(path.sep).includes("..")) return null;
  return value ? value.split(path.sep) : [];
}

export function assertCleanupTargetOutsideBaselineV2(target: string): void {
  if (arguments.length !== 1) refuse();
  components(target); // No account/FS or caller traps before closed input checks.
  try {
    const account = os.userInfo(); components(account.homedir);
    const protectedPath = path.join(account.homedir, "ai", "setrox", "data", "internal-production-baseline");
    const candidate = project(target), baseline = project(protectedPath);
    let comparisons = 0;
    for (const a of candidate.originals) for (const b of baseline.originals) {
      if (!a.stat.isDirectory() || !b.stat.isDirectory() || a.stat.dev !== b.stat.dev || a.stat.ino !== b.stat.ino) continue;
      for (const aPath of candidate.paths) for (const bPath of baseline.paths) {
        if (++comparisons > 65536) refuse();
        const aTail = tail(a.path, aPath), bTail = tail(b.path, bPath);
        if (aTail && bTail && (prefix(aTail, bTail) || prefix(bTail, aTail))) refuse();
      }
      for (const aPath of candidate.paths) for (const link of baseline.links) {
        if (++comparisons > 65536) refuse();
        const aTail = tail(a.path, aPath), bTail = tail(b.path, link);
        if (aTail && bTail && prefix(aTail, bTail)) refuse();
      }
    }
    // Bind the whole observed bracket; no caller projection or ENOENT fallback
    // can replace an unknown inode. No retained-capability claim follows.
    const nowAccount = os.userInfo();
    if (["uid", "gid", "homedir", "username", "shell"].some(key => nowAccount[key as keyof typeof nowAccount] !== account[key as keyof typeof account])) refuse();
    for (const original of [...candidate.originals, ...baseline.originals]) {
      const now = fs.lstatSync(original.path, { bigint: true });
      if (!keys.every(key => now[key] === original.stat[key])) refuse();
    }
    for (const projection of [candidate, baseline]) {
      if (projection.absent === null) continue;
      try { fs.lstatSync(projection.absent, { bigint: true }); }
      catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") continue; throw error; }
      refuse();
    }
  } catch { refuse(); }
}
