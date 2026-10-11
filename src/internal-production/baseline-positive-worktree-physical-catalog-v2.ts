import { spawnSync } from "node:child_process";
import { constants, closeSync, fstatSync, lstatSync, openSync, readFileSync, readSync, readdirSync } from "node:fs";
import type { BigIntStats } from "node:fs";
import { userInfo } from "node:os";
import path from "node:path";
import { types } from "node:util";

import { hashCanonicalJson } from "../product-compiler/canonical-json.js";
import { resolveInternalProductionBaselineWorkspaceRootV1 } from "./baseline-workspace-authority-path-v1.js";

// Diagnostic only: no database reads, V1 receipt interpretation or cutover effects.
const SCHEMA = "setfarm.internal-production-positive-worktree-physical-catalog.v2";
const MAX_BASES = 1_024;
const MAX_DISCOVERY_CHILDREN = 1_024;
const MAX_ENTRIES = 256;
const MAX_INCIDENTAL_FILES = 256;
const NAME = /^[A-Za-z0-9._-]+$/;
const COMMAND_CAP = 1_048_576;
const COMMAND_ENV = Object.freeze({ PATH: "/usr/bin:/bin:/usr/sbin:/sbin", LANG: "C", LC_ALL: "C",
  GIT_CONFIG_NOSYSTEM: "1", GIT_CONFIG_GLOBAL: "/dev/null", GIT_NO_REPLACE_OBJECTS: "1",
  GIT_OPTIONAL_LOCKS: "0", GIT_TERMINAL_PROMPT: "0" });
const GIT_PREFIX = Object.freeze(["-c", "core.hooksPath=/dev/null", "-c", "core.fsmonitor=false"]);
let cleanupUncertain = false;

type Scope = Readonly<{ ownerHomeRoot: string; workspaceRoot: string }>;
type Zone = "retained-zone" | "runtime-zone";
type PhysicalFailureOperation = "scope-hold" | "base-discovery" | "parent-git" | "candidate-git"
  | "candidate-lsof" | "candidate-record" | "first-pass-recheck" | "between-passes" | "post-database-stability"
  | "parent-recheck" | "candidate-recheck-git" | "candidate-recheck-lsof"
  | "candidate-recheck-compare" | "result";
type Held = { root: string; descriptor: number; first: BigIntStats; compareMutation: boolean;
  gitAdminCandidateRoot: string | null };
type HeldFile = { root: string; descriptor: number; first: BigIntStats };
type PhysicalOriginalV4 = { root: string; kind: "directory" | "file" | "marker";
  intent: true; returned: boolean; descriptor: number | null };
type RetainedPhysicalV4 = {
  scope: object; owner: object; token: object; burned: boolean; returned: boolean;
  ownerReady: boolean; ownerEntered: boolean; checking: boolean; entryChecking: boolean; originals: PhysicalOriginalV4[];
  held: HeldDirectories | null; recheck: (() => void) | null; promise: Promise<unknown> | null;
  imports: Array<{ intent: true; promise: Promise<unknown> | null; value: unknown; returned: boolean }>;
  census: typeof import("./baseline-legacy-database-census-v1.js") | null;
  adapter: typeof import("../../scripts/deployment-dashboard-cutover-adapter-v2.mjs") | null;
};
let retainedPhysicalV4: RetainedPhysicalV4 | null = null;

function burnRetainedPhysicalV4(record: RetainedPhysicalV4): void {
  record.burned = true;
  record.adapter?.revokeDashboardCutoverJointTokenV4(record.token);
}

function checkRetainedPhysicalV4(record: RetainedPhysicalV4): void {
  if (retainedPhysicalV4 !== record || record.burned || !record.census || !record.adapter) fail();
  try {
    record.census.assertHeldDashboardCutoverPre32PhysicalMetadataV4(record.scope, record.owner, record.token);
    record.adapter.assertDashboardCutoverJointPhysicalTokenV4(record.token, record.owner, record.scope);
  } catch { burnRetainedPhysicalV4(record); fail(); }
}

function fail(): never { throw Error("INTERNAL_PRODUCTION_POSITIVE_WORKTREE_PHYSICAL_CATALOG_INVALID"); }

function drift(kind: "directory-descriptor" | "directory-path" | "file-descriptor" | "file-path",
  root: string): never {
  throw Error("INTERNAL_PRODUCTION_POSITIVE_WORKTREE_PHYSICAL_CATALOG_INVALID", {
    cause: Object.freeze({ kind, root }),
  });
}

function captureScope(value: unknown): Scope {
  if (value === null || typeof value !== "object" || types.isProxy(value) || Object.getPrototypeOf(value) !== Object.prototype) fail();
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const keys = Reflect.ownKeys(descriptors);
  if (keys.length !== 2 || keys.some((key) => typeof key !== "string" || !["ownerHomeRoot", "workspaceRoot"].includes(key)
    || !descriptors[key]!.enumerable || !("value" in descriptors[key]!))) fail();
  const ownerHomeRoot = descriptors.ownerHomeRoot!.value as unknown;
  const workspaceRoot = descriptors.workspaceRoot!.value as unknown;
  for (const root of [ownerHomeRoot, workspaceRoot]) {
    if (typeof root !== "string" || root === "/" || !path.posix.isAbsolute(root)
      || path.posix.normalize(root) !== root || Buffer.byteLength(root) > 1024
      || root.split("/").slice(1).some((part) => !NAME.test(part) || part === "." || part === "..")) fail();
  }
  if (workspaceRoot !== path.join(ownerHomeRoot as string, "ai", "setrox")) fail();
  return Object.freeze({ ownerHomeRoot: ownerHomeRoot as string, workspaceRoot: workspaceRoot as string });
}

function same(left: BigIntStats, right: BigIntStats, compareMutation: boolean): boolean {
  return left.isDirectory() && !left.isSymbolicLink() && right.isDirectory() && !right.isSymbolicLink()
    && left.dev === right.dev && left.ino === right.ino && left.birthtimeNs === right.birthtimeNs
    && left.mode === right.mode && left.uid === right.uid
    && (!compareMutation || (left.ctimeNs === right.ctimeNs && left.mtimeNs === right.mtimeNs));
}

function sameFile(left: BigIntStats, right: BigIntStats): boolean {
  return left.isFile() && !left.isSymbolicLink() && right.isFile() && !right.isSymbolicLink()
    && left.dev === right.dev && left.ino === right.ino && left.birthtimeNs === right.birthtimeNs
    && left.mode === right.mode && left.uid === right.uid && left.size === right.size
    && left.ctimeNs === right.ctimeNs && left.mtimeNs === right.mtimeNs;
}

function compareRoot(left: string, right: string): number {
  return Buffer.compare(Buffer.from(left), Buffer.from(right));
}

class HeldDirectories {
  private readonly entries: Held[] = [];
  private readonly files: HeldFile[] = [];
  private readonly absentFiles = new Set<string>();
  private readonly absentDirectories = new Set<string>();
  private readonly byRoot = new Map<string, Held>();
  private readonly churnedGitAdminCandidates = new Set<string>();
  private closed = false;

  constructor(private readonly ownerHomeRoot: string, private readonly workspaceRoot: string,
    private readonly retained: RetainedPhysicalV4 | null = null) {}

  private openOriginal(root: string, flags: number, kind: PhysicalOriginalV4["kind"]): number {
    if (!this.retained) return openSync(root, flags);
    checkRetainedPhysicalV4(this.retained);
    const original: PhysicalOriginalV4 = { root, kind, intent: true, returned: false, descriptor: null };
    this.retained.originals.push(original);
    original.descriptor = openSync(root, flags); original.returned = true;
    checkRetainedPhysicalV4(this.retained);
    return original.descriptor;
  }

  retainMarker(root: string, first: BigIntStats): number {
    if (!this.retained || this.closed || this.files.length >= MAX_INCIDENTAL_FILES) fail();
    const existing = this.files.find(entry => entry.root === root);
    if (existing) { if (!sameFile(existing.first, first)) fail(); this.assertStable(); return existing.descriptor; }
    const descriptor = this.openOriginal(root, constants.O_RDONLY | constants.O_NOFOLLOW, "marker");
    this.files.push({ root, descriptor, first });
    this.assertStable();
    return descriptor;
  }

  hasRetainedProfile(): boolean { return this.retained !== null; }

  observerCommandCwd(): string {
    if (!this.byRoot.has(this.workspaceRoot)) fail();
    this.assertStable();
    return this.workspaceRoot;
  }

  hold(target: string, gitAdminCandidateRoot: string | null = null): BigIntStats {
    if (this.closed || cleanupUncertain) fail();
    if (gitAdminCandidateRoot !== null && (!this.byRoot.has(gitAdminCandidateRoot)
      || path.basename(path.dirname(target)) !== "worktrees"
      || path.basename(path.dirname(path.dirname(target))) !== ".git")) fail();
    const segments = target.split(path.sep).filter(Boolean);
    if (segments.length > 128) fail();
    for (let index = 0; index <= segments.length; index += 1) {
      const root = path.join(path.parse(target).root, ...segments.slice(0, index));
      if (this.byRoot.has(root)) continue;
      const first = lstatSync(root, { bigint: true });
      if (!first.isDirectory() || first.isSymbolicLink()) fail();
      const descriptor = this.openOriginal(root, constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW, "directory");
      const entry = { root, descriptor, first,
        compareMutation: root === this.ownerHomeRoot || root.startsWith(`${this.ownerHomeRoot}/`),
        gitAdminCandidateRoot: root === target ? gitAdminCandidateRoot : null };
      this.entries.push(entry);
      this.byRoot.set(root, entry);
      if (!same(first, fstatSync(descriptor, { bigint: true }), entry.compareMutation && entry.gitAdminCandidateRoot === null)) fail();
    }
    const held = this.byRoot.get(target)!;
    if (gitAdminCandidateRoot !== null) {
      if (held.gitAdminCandidateRoot !== null && held.gitAdminCandidateRoot !== gitAdminCandidateRoot) fail();
      held.gitAdminCandidateRoot = gitAdminCandidateRoot;
    }
    this.assertStable();
    return held.first;
  }

  holdFile(target: string): void {
    if (this.closed || cleanupUncertain || this.files.length >= MAX_INCIDENTAL_FILES) fail();
    this.hold(path.dirname(target));
    const first = lstatSync(target, { bigint: true });
    if (!first.isFile() || first.isSymbolicLink()) fail();
    const descriptor = this.openOriginal(target, constants.O_RDONLY | constants.O_NOFOLLOW, "file");
    this.files.push({ root: target, descriptor, first });
    this.assertStable();
  }

  holdOptionalFile(target: string): void {
    if (this.closed || cleanupUncertain) fail();
    let parent = path.dirname(target);
    const missing: string[] = [];
    while (isMissing(parent)) {
      if (parent === "/" || missing.length >= 128) fail();
      missing.push(parent);
      parent = path.dirname(parent);
    }
    this.hold(parent);
    for (const directory of missing) this.absentDirectories.add(directory);
    if (isMissing(target)) this.absentFiles.add(target);
    else this.holdFile(target);
    if (this.absentFiles.size + this.absentDirectories.size > MAX_INCIDENTAL_FILES) fail();
    this.assertStable();
  }

  assertStable(): void {
    if (this.retained) checkRetainedPhysicalV4(this.retained);
    if (this.closed || cleanupUncertain) fail();
    for (const entry of this.entries) {
      const descriptor = fstatSync(entry.descriptor, { bigint: true });
      if (!same(entry.first, descriptor, entry.compareMutation && entry.gitAdminCandidateRoot === null))
        drift("directory-descriptor", entry.root);
      const current = lstatSync(entry.root, { bigint: true });
      if (!same(entry.first, current, entry.compareMutation && entry.gitAdminCandidateRoot === null))
        drift("directory-path", entry.root);
      if (entry.gitAdminCandidateRoot !== null && (descriptor.ctimeNs !== entry.first.ctimeNs
        || descriptor.mtimeNs !== entry.first.mtimeNs || current.ctimeNs !== entry.first.ctimeNs
        || current.mtimeNs !== entry.first.mtimeNs)) this.churnedGitAdminCandidates.add(entry.gitAdminCandidateRoot);
    }
    for (const entry of this.files) {
      if (!sameFile(entry.first, fstatSync(entry.descriptor, { bigint: true })))
        drift("file-descriptor", entry.root);
      if (!sameFile(entry.first, lstatSync(entry.root, { bigint: true })))
        drift("file-path", entry.root);
    }
    for (const directory of this.absentDirectories) if (!isMissing(directory)) fail();
    for (const file of this.absentFiles) if (!isMissing(file)) fail();
    if (this.retained) checkRetainedPhysicalV4(this.retained);
  }

  gitAdminChurnCandidateRoots(): readonly string[] {
    this.assertStable();
    return Object.freeze([...this.churnedGitAdminCandidates].sort(compareRoot));
  }

  close(): void {
    if (this.retained) { burnRetainedPhysicalV4(this.retained); fail(); }
    if (this.closed) return;
    this.closed = true;
    const errors: unknown[] = [];
    while (this.files.length > 0) {
      try { closeSync(this.files.pop()!.descriptor); }
      catch (error) { cleanupUncertain = true; errors.push(error); }
    }
    while (this.entries.length > 0) {
      try { closeSync(this.entries.pop()!.descriptor); }
      catch (error) { cleanupUncertain = true; errors.push(error); }
    }
    if (errors.length > 0) throw new AggregateError(errors, "INTERNAL_PRODUCTION_POSITIVE_WORKTREE_PHYSICAL_CATALOG_INVALID: cleanup uncertain");
  }
}

function isMissing(target: string): boolean {
  try { lstatSync(target, { bigint: true }); return false; }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return true;
    throw error;
  }
}

function children(held: HeldDirectories, root: string, incidentalFiles?: string[]): readonly string[] {
  held.hold(root);
  const names = readdirSync(root).sort((left, right) => compareRoot(left, right));
  if (names.length > MAX_DISCOVERY_CHILDREN) fail();
  const result: string[] = [];
  for (const name of names) {
    if (!NAME.test(name) || name === "." || name === "..") fail();
    const child = path.join(root, name);
    const observed = lstatSync(child, { bigint: true });
    if (observed.isSymbolicLink()) fail();
    if (observed.isFile() && incidentalFiles !== undefined) {
      held.holdFile(child);
      incidentalFiles.push(child);
      continue;
    }
    held.hold(child);
    result.push(child);
  }
  held.assertStable();
  return Object.freeze(result);
}

function command(held: HeldDirectories, executable: string, args: readonly string[]): Buffer {
  held.assertStable();
  const result = spawnSync(executable, [...args], { env: COMMAND_ENV, cwd: held.observerCommandCwd(),
    shell: false, encoding: "buffer",
    timeout: 10_000, maxBuffer: COMMAND_CAP, stdio: ["ignore", "pipe", "pipe"] });
  held.assertStable();
  const stdout = Buffer.isBuffer(result.stdout) ? result.stdout : Buffer.from(result.stdout ?? "");
  const stderr = Buffer.isBuffer(result.stderr) ? result.stderr : Buffer.from(result.stderr ?? "");
  if (result.error || result.signal || result.status !== 0 || stderr.length !== 0 || stdout.length > COMMAND_CAP) fail();
  return stdout;
}

function lsofObservation(held: HeldDirectories, root: string, excludeObserver: boolean): Readonly<{ status: number; stdout: Buffer }> {
  held.assertStable();
  const args = ["-nP", "-F0", ...(excludeObserver ? ["-p", `^${process.pid}`] : []), "+D", root];
  const result = spawnSync("/usr/sbin/lsof", args, {
    env: COMMAND_ENV, cwd: held.observerCommandCwd(), shell: false, encoding: "buffer", timeout: 10_000,
    maxBuffer: COMMAND_CAP, stdio: ["ignore", "pipe", "pipe"],
  });
  held.assertStable();
  const stdout = Buffer.isBuffer(result.stdout) ? result.stdout : Buffer.from(result.stdout ?? "");
  const stderr = Buffer.isBuffer(result.stderr) ? result.stderr : Buffer.from(result.stderr ?? "");
  if (result.error || result.signal || ![0, 1].includes(result.status ?? -1) || stderr.length !== 0
    || stdout.length > COMMAND_CAP) fail();
  return Object.freeze({ status: result.status!, stdout });
}

function parseLsofPids(stdout: Buffer): readonly number[] {
  const value = new TextDecoder("utf-8", { fatal: true }).decode(stdout);
  if (value.includes("\r") || !value.endsWith("\0\n")) fail();
  const fields = value.split("\0").map((field) => field.replace(/^\n+/, "")).filter(Boolean);
  const pids = new Set<number>();
  let currentPid: number | null = null;
  for (const field of fields) {
    if (field[0] === "p") {
      const text = field.slice(1);
      const pid = Number(text);
      if (!/^[1-9][0-9]*$/.test(text) || !Number.isSafeInteger(pid) || pids.has(pid)) fail();
      currentPid = pid;
      pids.add(pid);
    } else if (field[0] === "n" && (currentPid === null || field.length < 2)) fail();
  }
  if (pids.size === 0) fail();
  return Object.freeze([...pids].sort((left, right) => left - right));
}

function referencePids(held: HeldDirectories, root: string): readonly number[] {
  const inclusive = lsofObservation(held, root, false);
  if (inclusive.status === 0) return Object.freeze(parseLsofPids(inclusive.stdout).filter((pid) => pid !== process.pid));
  if (inclusive.stdout.length === 0) return Object.freeze([]);
  const onlyObserver = parseLsofPids(inclusive.stdout);
  if (onlyObserver.length !== 1 || onlyObserver[0] !== process.pid) {
    throw Error("INTERNAL_PRODUCTION_POSITIVE_WORKTREE_PHYSICAL_CATALOG_INVALID", {
      cause: Object.freeze({ kind: "lsof-status1-nonobserver-pids", root, observedPids: onlyObserver }),
    });
  }
  const excluded = lsofObservation(held, root, true);
  if (excluded.status !== 1 || excluded.stdout.length !== 0) fail();
  return Object.freeze([]);
}

function line(bytes: Buffer): string {
  const value = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  if (value.includes("\r") || !value.endsWith("\n") || value.slice(0, -1).includes("\n")) fail();
  return value.slice(0, -1);
}

function normalizedGitPath(value: string, base: string): string {
  const root = path.posix.resolve(base, value);
  if (!path.posix.isAbsolute(root) || root === "/" || Buffer.byteLength(root) > 1024
    || root.split("/").slice(1).some((part) => !NAME.test(part) || part === "." || part === "..")) fail();
  return root;
}

type GitWorktreeListing = Readonly<{ roots: readonly string[]; prunableRoots: readonly string[];
  locked: readonly Readonly<{ root: string; reason: string | null }>[]; barePrimaryRoot: string | null;
  headOids: readonly Readonly<{ root: string; oid: string }>[] }>;

function gitWorktreeRoots(held: HeldDirectories, bytes: Buffer, oidWidth: 40 | 64): GitWorktreeListing {
  const value = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  if (!value.endsWith("\0")) fail();
  const records = value.slice(0, -1).split("\0\0");
  const roots: string[] = [];
  const prunableRoots: string[] = [];
  const locked: Array<Readonly<{ root: string; reason: string | null }>> = [];
  const headOids: Array<Readonly<{ root: string; oid: string }>> = [];
  const seen = new Set<string>();
  let barePrimaryRoot: string | null = null;
  for (const record of records) {
    const fields = record.split("\0").filter(Boolean);
    const bareRecord = fields.length === 2 && fields[1] === "bare";
    const annotation = fields[3];
    const prunableRecord = annotation === "prunable" || annotation?.startsWith("prunable ") === true;
    const lockedRecord = annotation === "locked" || annotation?.startsWith("locked ") === true;
    if (!fields[0]?.startsWith("worktree ") || (bareRecord && (seen.size !== 0 || barePrimaryRoot !== null))
      || (!bareRecord && (![3, 4].includes(fields.length)
        || !fields[1]?.startsWith("HEAD ") || fields[1].length !== oidWidth + 5
        || !/^[a-f0-9]+$/.test(fields[1].slice(5))
        || !(fields[2] === "detached" || fields[2]?.startsWith("branch "))
        || (fields.length === 4 && !prunableRecord && !lockedRecord)))) fail();
    if (!bareRecord && fields[2]!.startsWith("branch ")) {
      const ref = fields[2]!.slice("branch ".length);
      if (Buffer.byteLength(ref) > 1024
        || command(held, "/usr/bin/git", [...GIT_PREFIX, "check-ref-format", ref]).length !== 0) fail();
    }
    const rawRoot = fields[0]!.slice("worktree ".length);
    if (!path.posix.isAbsolute(rawRoot) || path.posix.normalize(rawRoot) !== rawRoot) fail();
    const root = normalizedGitPath(rawRoot, "/");
    if (seen.has(root)) fail();
    seen.add(root);
    if (!bareRecord) headOids.push(Object.freeze({ root, oid: fields[1]!.slice(5) }));
    if (bareRecord) {
      barePrimaryRoot = root;
      roots.push(root);
    } else if (prunableRecord) prunableRoots.push(root);
    else {
      roots.push(root);
      if (lockedRecord) locked.push(Object.freeze({ root,
        reason: annotation === "locked" ? null : annotation!.slice("locked ".length) }));
    }
  }
  if (roots.length === 0 || seen.size > MAX_ENTRIES) fail();
  return Object.freeze({ roots: Object.freeze(roots), prunableRoots: Object.freeze(prunableRoots),
    locked: Object.freeze(locked), barePrimaryRoot, headOids: Object.freeze(headOids) });
}

function objectIdWidth(format: string): 40 | 64 {
  if (format === "sha1") return 40;
  if (format === "sha256") return 64;
  fail();
}

type CandidateKind = "unresolved" | "linked-git" | "primary-git";
type Candidate = Readonly<{ root: string; zone: Zone; kind: CandidateKind; dev: string; ino: string;
  birthtimeNs: string; gitPrimaryRoot: string | null; dirty: boolean | null;
  sourceBuildProvenance: "unverified";
  referencingPids: readonly number[] }>;
type HeldRuntimePhysicalCandidate = Readonly<{ root: string; dev: string; ino: string;
  birthtimeNs: string; gitPrimaryRoot: string }>;
type HeldRuntimeSourceObservation = Readonly<{ root: string; gitPrimaryRoot: string;
  sourceSha: string; sourceTreeHash: string }>;
type WithHeldRuntimeCandidate = <T>(root: string, withinHold: (physical: HeldRuntimePhysicalCandidate,
  recheckPhysical: () => Promise<HeldRuntimePhysicalCandidate>,
  observeSource: () => Promise<HeldRuntimeSourceObservation>) => Promise<T>) => Promise<T>;

function primaryWorktreeRoots(held: HeldDirectories, root: string): GitWorktreeListing | null {
  const marker = path.join(root, ".git");
  if (isMissing(marker)) return null;
  const observed = lstatSync(marker, { bigint: true });
  if (!observed.isDirectory() || observed.isSymbolicLink()) fail();
  held.hold(marker);
  const top = line(command(held, "/usr/bin/git", [...GIT_PREFIX, "-C", root, "rev-parse", "--show-toplevel"]));
  if (top !== root) fail();
  const width = objectIdWidth(line(command(held, "/usr/bin/git", [...GIT_PREFIX, "-C", root,
    "rev-parse", "--show-object-format=storage"])));
  const roots = gitWorktreeRoots(held, command(held, "/usr/bin/git", [...GIT_PREFIX, "-C", root,
    "worktree", "list", "--porcelain", "-z"]), width);
  if (roots.roots[0] !== root) fail();
  return roots;
}

function observeGitCandidate(held: HeldDirectories, root: string, base: string, zone: Zone,
  scope: Scope): Readonly<{ kind: CandidateKind; gitPrimaryRoot: string | null; dirty: boolean | null;
    listedRoots: readonly string[]; prunableRoots: readonly string[];
    locked: readonly Readonly<{ root: string; reason: string | null }>[];
    barePrimaryRoot: string | null; reason: string | null; headOid?: string }> {
  const marker = path.join(root, ".git");
  if (isMissing(marker)) return { kind: "unresolved", gitPrimaryRoot: null, dirty: null,
    listedRoots: [], prunableRoots: [], locked: [], barePrimaryRoot: null, reason: "non-git-child" };
  const markerStat = lstatSync(marker, { bigint: true });
  if (markerStat.isSymbolicLink()) fail();
  if (!markerStat.isFile() && !markerStat.isDirectory()) fail();
  let gitdirFromMarker: string | null = null;
  let markerDescriptor: number | null = null;
  try {
  if (markerStat.isDirectory()) held.hold(marker);
  else {
    if (markerStat.size < 1n || markerStat.size > 4096n) fail();
    markerDescriptor = held.hasRetainedProfile() ? held.retainMarker(marker, markerStat)
      : openSync(marker, constants.O_RDONLY | constants.O_NOFOLLOW);
    if (!sameFile(markerStat, fstatSync(markerDescriptor, { bigint: true }))) fail();
    let markerBytes: Buffer;
    if (held.hasRetainedProfile()) {
      markerBytes = Buffer.alloc(Number(markerStat.size));
      let offset = 0;
      while (offset < markerBytes.length) {
        const count = readSync(markerDescriptor, markerBytes, offset, markerBytes.length - offset, offset);
        if (!Number.isSafeInteger(count) || count <= 0 || count > markerBytes.length - offset) fail();
        offset += count;
      }
      if (readSync(markerDescriptor, Buffer.alloc(1), 0, 1, markerBytes.length) !== 0
        || !sameFile(markerStat, fstatSync(markerDescriptor, { bigint: true }))) fail();
    } else markerBytes = readFileSync(markerDescriptor);
    const match = /^gitdir: ([^\r\n]+)\n$/.exec(new TextDecoder("utf-8", { fatal: true }).decode(markerBytes));
    if (!match) fail();
    gitdirFromMarker = normalizedGitPath(match[1]!, root);
    // A bare primary uses <primary>.git/worktrees/<name>, not a regular
    // primary's .git/worktrees/<name>; it remains on the strict drift path.
    held.hold(gitdirFromMarker,
      path.basename(path.dirname(path.dirname(gitdirFromMarker))) === ".git" ? root : null);
  }
  const checkMarker = (): void => {
    if (!sameFile(markerStat, lstatSync(marker, { bigint: true })) && markerStat.isFile()) fail();
    if (markerStat.isDirectory()) held.assertStable();
    if (markerDescriptor !== null && !sameFile(markerStat, fstatSync(markerDescriptor, { bigint: true }))) fail();
  };
  const git = (args: string[]): Buffer => {
    checkMarker();
    const bytes = command(held, "/usr/bin/git", [...GIT_PREFIX, "-C", root, ...args]);
    checkMarker();
    return bytes;
  };
    const top = line(git(["rev-parse", "--show-toplevel"]));
    if (top !== root) return { kind: "unresolved", gitPrimaryRoot: null, dirty: null,
      listedRoots: [], prunableRoots: [], locked: [], barePrimaryRoot: null, reason: "git-top-level-mismatch" };
    const width = objectIdWidth(line(git(["rev-parse", "--show-object-format=storage"])));
    const listing = gitWorktreeRoots(held, git(["worktree", "list", "--porcelain", "-z"]), width);
    const listedRoots = listing.roots;
    const primary = listedRoots[0]!;
    if (!listedRoots.includes(root)) fail();
    if (listing.barePrimaryRoot !== null) return { kind: "unresolved", gitPrimaryRoot: primary,
      dirty: null, listedRoots, prunableRoots: listing.prunableRoots, locked: listing.locked,
      barePrimaryRoot: listing.barePrimaryRoot, reason: "bare-git-primary" };
    if (listing.prunableRoots.length > 0) return { kind: "unresolved", gitPrimaryRoot: primary,
      dirty: null, listedRoots, prunableRoots: listing.prunableRoots, locked: listing.locked,
      barePrimaryRoot: null,
      reason: "prunable-git-list" };
    if (listing.locked.some((entry) => isMissing(entry.root))) {
      return { kind: "unresolved", gitPrimaryRoot: primary, dirty: null, listedRoots,
        prunableRoots: [], locked: listing.locked, barePrimaryRoot: null,
        reason: "absent-locked-git-list" };
    }
    const headOid = listing.headOids.find((entry) => entry.root === root)?.oid;
    if (!headOid) fail();
    for (const listedRoot of listedRoots) held.hold(listedRoot);
    const gitdir = normalizedGitPath(line(git(["rev-parse", "--git-dir"])), root);
    const commonDir = normalizedGitPath(line(git(["rev-parse", "--git-common-dir"])), root);
    held.hold(commonDir);
    if (commonDir !== path.join(primary, ".git")
      || (root === primary ? markerStat.isFile() || gitdir !== marker : !markerStat.isFile() || gitdir !== gitdirFromMarker)) fail();
    if (zone === "retained-zone") {
      const origin = line(git(["config", "--local", "--default=__origin_missing__", "--get", "remote.origin.url"]));
      if (!["https://github.com/hikmetgulsesli/setfarm.git", "https://github.com/hikmetgulsesli/mission-control.git"].includes(origin)) {
        return { kind: "unresolved", gitPrimaryRoot: primary, dirty: null, listedRoots,
          prunableRoots: [], locked: listing.locked, barePrimaryRoot: null, reason: "untrusted-code-git" };
      }
      const fixedPrimaries = [path.join(scope.workspaceRoot, "setfarm"), path.join(scope.workspaceRoot, "mission-control")];
      const retainedPrimaryZone = [path.join(scope.workspaceRoot, ".worktrees"),
        path.join(scope.workspaceRoot, "deployments")].some((retainedBase) => primary.startsWith(`${retainedBase}/`));
      if (!fixedPrimaries.includes(primary) && !retainedPrimaryZone) {
        return { kind: "unresolved", gitPrimaryRoot: primary, dirty: null, listedRoots,
          prunableRoots: [], locked: listing.locked, barePrimaryRoot: null,
          reason: "retained-primary-mismatch" };
      }
    }
    if (zone === "runtime-zone") {
      const projectBase = path.join(scope.ownerHomeRoot, "projects");
      const expectedProject = base.startsWith(`${projectBase}/`) ? path.dirname(base) : null;
      if ((expectedProject !== null && primary !== expectedProject)
        || (expectedProject === null && !primary.startsWith(`${projectBase}/`))) {
        return { kind: "unresolved", gitPrimaryRoot: primary, dirty: null, listedRoots,
          prunableRoots: [], locked: listing.locked, barePrimaryRoot: null,
          reason: "runtime-primary-mismatch" };
      }
    }
    const dirty = git(["status", "--porcelain=v2", "--untracked-files=all"]).length !== 0;
    return { kind: root === primary ? "primary-git" : "linked-git", gitPrimaryRoot: primary,
      dirty, listedRoots, prunableRoots: [], locked: listing.locked, barePrimaryRoot: null,
      reason: null, headOid };
  } finally {
    if (markerDescriptor !== null && !held.hasRetainedProfile()) {
      try { closeSync(markerDescriptor); }
      catch { cleanupUncertain = true; fail(); }
    }
  }
}

async function observePhysicalCatalogV2(
  rawScope: unknown,
  betweenPasses: (firstPass: readonly Candidate[],
    withHeldRuntimeCandidate: WithHeldRuntimeCandidate) => Promise<void>,
  retained: RetainedPhysicalV4 | null = null,
) {
  const scope = captureScope(rawScope);
  if (cleanupUncertain || typeof betweenPasses !== "function") fail();
  const held = new HeldDirectories(scope.ownerHomeRoot, scope.workspaceRoot, retained);
  if (retained) retained.held = held;
  let operation: PhysicalFailureOperation = "scope-hold";
  let candidateOrdinal: number | null = null;
  try {
    const { ownerHomeRoot, workspaceRoot } = scope;
    for (const mandatory of [ownerHomeRoot, workspaceRoot, path.join(workspaceRoot, "setfarm"),
      path.join(workspaceRoot, "mission-control"), path.join(ownerHomeRoot, "projects"),
      path.join(ownerHomeRoot, ".openclaw", "workspace", "agent-scratch"),
      path.join(ownerHomeRoot, ".openclaw", "workspaces", "workflows")]) held.hold(mandatory);

    operation = "base-discovery";
    const bases = new Map<string, Zone>();
    const absentBases: string[] = [];
    const addBase = (root: string, zone: Zone): void => {
      if (bases.size + absentBases.length >= MAX_BASES || bases.has(root) || absentBases.includes(root)) fail();
      held.hold(path.dirname(root));
      if (isMissing(root)) { absentBases.push(root); return; }
      held.hold(root);
      bases.set(root, zone);
    };
    for (const root of [path.join(workspaceRoot, ".worktrees"), path.join(workspaceRoot, "setfarm", ".worktrees"),
      path.join(workspaceRoot, "mission-control", ".worktrees"), path.join(workspaceRoot, "deployments")]) addBase(root, "retained-zone");
    addBase(path.join(ownerHomeRoot, ".openclaw", "workspace", "agent-scratch", "story-worktrees"), "runtime-zone");
    const incidentalFiles: string[] = [];
    const absentAgentsParents: string[] = [];
    const projectRoots = children(held, path.join(ownerHomeRoot, "projects"), incidentalFiles);
    for (const project of projectRoots) addBase(path.join(project, ".worktrees"), "runtime-zone");
    for (const workflow of children(held, path.join(ownerHomeRoot, ".openclaw", "workspaces", "workflows"), incidentalFiles)) {
      addBase(path.join(workflow, "story-worktrees"), "runtime-zone");
      const agents = path.join(workflow, "agents");
      if (isMissing(agents)) { absentAgentsParents.push(agents); continue; }
      for (const agent of children(held, agents, incidentalFiles)) addBase(path.join(agent, "story-worktrees"), "runtime-zone");
    }

    const entries: Candidate[] = [];
    const blockers: Array<Readonly<{ root: string; reason: string }>> = absentAgentsParents.map((root) =>
      Object.freeze({ root, reason: "absent-workflow-agents-discovery-parent" }));
    const listedGroups: Array<readonly string[]> = [];
    const firstByRoot = new Map<string, Readonly<{ base: string; zone: Zone; listedHash: string;
      reason: string | null; headOid: string | null }>>();
    const parentGitLists = new Map<string, string>();
    const nonGitParents: string[] = [];
    const absentLockedRoots = new Set<string>();
    operation = "parent-git";
    for (const parent of [path.join(workspaceRoot, "setfarm"), path.join(workspaceRoot, "mission-control"), ...projectRoots]) {
      const listing = primaryWorktreeRoots(held, parent);
      if (listing !== null) {
        parentGitLists.set(parent, hashCanonicalJson(listing));
        listedGroups.push(listing.roots);
        for (const root of listing.prunableRoots) blockers.push(Object.freeze({ root, reason: "prunable-git-worktree" }));
        for (const entry of listing.locked) if (isMissing(entry.root)) {
          absentLockedRoots.add(entry.root);
          blockers.push(Object.freeze({ root: entry.root, reason: "absent-locked-git-worktree" }));
        }
      } else if (bases.has(path.join(parent, ".worktrees"))) {
        nonGitParents.push(parent);
        blockers.push(Object.freeze({ root: parent, reason: "non-git-parent" }));
      }
    }
    for (const [base, zone] of bases) {
      operation = "base-discovery";
      candidateOrdinal = null;
      for (const root of children(held, base)) {
        operation = "base-discovery";
        candidateOrdinal = null;
        if (entries.length >= MAX_ENTRIES) fail();
        candidateOrdinal = entries.length;
        operation = "candidate-git";
        const stat = held.hold(root);
        const git = observeGitCandidate(held, root, base, zone, scope);
        operation = "candidate-lsof";
        const referencingPids = referencePids(held, root);
        operation = "candidate-record";
        if (git.reason !== null) blockers.push(Object.freeze({ root, reason: git.reason }));
        for (const prunableRoot of git.prunableRoots) blockers.push(Object.freeze({ root: prunableRoot,
          reason: "prunable-git-worktree" }));
        for (const entry of git.locked) if (isMissing(entry.root)) {
          absentLockedRoots.add(entry.root);
          blockers.push(Object.freeze({ root: entry.root, reason: "absent-locked-git-worktree" }));
        }
        if (git.listedRoots.length > 0) listedGroups.push(git.listedRoots);
        firstByRoot.set(root, Object.freeze({ base, zone,
          listedHash: hashCanonicalJson({ roots: git.listedRoots, prunableRoots: git.prunableRoots,
            locked: git.locked, barePrimaryRoot: git.barePrimaryRoot }), reason: git.reason,
          headOid: git.headOid ?? null }));
        entries.push(Object.freeze({ root, zone, kind: git.kind, dev: String(stat.dev), ino: String(stat.ino),
          birthtimeNs: String(stat.birthtimeNs), gitPrimaryRoot: git.gitPrimaryRoot, dirty: git.dirty,
          sourceBuildProvenance: "unverified" as const,
          referencingPids }));
      }
    }
    candidateOrdinal = null;
    operation = "first-pass-recheck";
    const present = new Set(entries.map((entry) => entry.root));
    for (const group of listedGroups) {
      for (const listedRoot of group) {
        if (!present.has(listedRoot) && !parentGitLists.has(listedRoot) && !absentLockedRoots.has(listedRoot)) {
          blockers.push(Object.freeze({ root: listedRoot, reason: "listed-outside-scope" }));
        }
      }
    }
    held.assertStable();
    operation = "between-passes";
    const recheckEntries = (): void => {
      operation = "post-database-stability";
      held.assertStable();
      for (const root of absentBases) if (!isMissing(root)) fail();
      for (const root of absentAgentsParents) if (!isMissing(root)) fail();
      for (const root of absentLockedRoots) if (!isMissing(root)) fail();
      operation = "parent-recheck";
      for (const [parent, firstHash] of parentGitLists) {
        const fresh = primaryWorktreeRoots(held, parent);
        if (fresh === null || hashCanonicalJson(fresh) !== firstHash) fail();
      }
      for (const parent of nonGitParents) if (!isMissing(path.join(parent, ".git"))) fail();
      for (const [index, entry] of entries.entries()) {
        candidateOrdinal = index;
        operation = "candidate-recheck-git";
        const first = firstByRoot.get(entry.root)!;
        const fresh = observeGitCandidate(held, entry.root, first.base, first.zone, scope);
        operation = "candidate-recheck-lsof";
        const freshPids = referencePids(held, entry.root);
        operation = "candidate-recheck-compare";
        if (fresh.kind !== entry.kind || fresh.gitPrimaryRoot !== entry.gitPrimaryRoot
          || fresh.dirty !== entry.dirty || fresh.reason !== first.reason
          || (fresh.headOid ?? null) !== first.headOid
          || hashCanonicalJson({ roots: fresh.listedRoots, prunableRoots: fresh.prunableRoots,
            locked: fresh.locked, barePrimaryRoot: fresh.barePrimaryRoot }) !== first.listedHash
          || hashCanonicalJson(freshPids) !== hashCanonicalJson(entry.referencingPids)) fail();
      }
      candidateOrdinal = null;
    };
    if (retained) {
      retained.recheck = () => {
        if (retained.checking) { burnRetainedPhysicalV4(retained); fail(); }
        retained.checking = true;
        try {
          checkRetainedPhysicalV4(retained); recheckEntries();
          if (blockers.length !== 0 || held.gitAdminChurnCandidateRoots().length !== 0
            || entries.some(entry => entry.zone === "runtime-zone" || entry.referencingPids.length !== 0)) fail();
          held.assertStable(); checkRetainedPhysicalV4(retained);
        } catch { burnRetainedPhysicalV4(retained); fail(); }
        finally { retained.checking = false; }
      };
      retained.recheck(); // Complete first-pass/cold-zero gate BEFORE callback.
    }
    let betweenPassesOpen = true;
    let holdCalls = 0;
    let holdInFlight = false;
    let holdSettled: Promise<void> | null = null;
    let settleHold: (() => void) | null = null;
    const withHeldRuntimeCandidate: WithHeldRuntimeCandidate = async (root, withinHold) => {
      if (!betweenPassesOpen || holdInFlight || holdCalls !== 0 || typeof root !== "string"
        || typeof withinHold !== "function") fail();
      const entry = entries.find((candidate) => candidate.root === root);
      const first = firstByRoot.get(root);
      if (!entry || !first || entry.zone !== "runtime-zone" || entry.kind !== "linked-git"
        || entry.gitPrimaryRoot === null || first.reason !== null) fail();
      holdCalls += 1;
      holdInFlight = true;
      holdSettled = new Promise<void>((resolve) => { settleHold = resolve; });
      let nestedOpen = true;
      const physical = Object.freeze({ root: entry.root, dev: entry.dev, ino: entry.ino,
        birthtimeNs: entry.birthtimeNs, gitPrimaryRoot: entry.gitPrimaryRoot });
      const checkPhysical = (): HeldRuntimePhysicalCandidate => {
        if (!betweenPassesOpen || !nestedOpen || cleanupUncertain) fail();
        held.assertStable();
        const fresh = observeGitCandidate(held, root, first.base, first.zone, scope);
        if (fresh.kind !== entry.kind || fresh.gitPrimaryRoot !== entry.gitPrimaryRoot
          || fresh.dirty !== entry.dirty || fresh.reason !== first.reason
          || (fresh.headOid ?? null) !== first.headOid
          || hashCanonicalJson({ roots: fresh.listedRoots, prunableRoots: fresh.prunableRoots,
            locked: fresh.locked, barePrimaryRoot: fresh.barePrimaryRoot }) !== first.listedHash
          || held.gitAdminChurnCandidateRoots().includes(root)) fail();
        return physical;
      };
      const recheckPhysical = async (): Promise<HeldRuntimePhysicalCandidate> => checkPhysical();
      const observeSource = async (): Promise<HeldRuntimeSourceObservation> => {
        // No await inside this capability: an unawaited call cannot continue
        // issuing Git commands after the enclosing held callback settles.
        checkPhysical();
        const git = (args: readonly string[]): string => line(command(held, "/usr/bin/git",
          [...GIT_PREFIX, "-C", root, ...args]));
        const width = objectIdWidth(git(["rev-parse", "--show-object-format=storage"]));
        const sourceSha = git(["rev-parse", "--verify", "HEAD^{commit}"]);
        const sourceTreeHash = git(["rev-parse", "--verify", `${sourceSha}^{tree}`]);
        const repeatedSha = git(["rev-parse", "--verify", "HEAD^{commit}"]);
        if (sourceSha.length !== width || sourceTreeHash.length !== width
          || !/^[a-f0-9]+$/.test(sourceSha) || !/^[a-f0-9]+$/.test(sourceTreeHash)
          || repeatedSha !== sourceSha || sourceSha !== first.headOid) fail();
        checkPhysical();
        return Object.freeze({ root, gitPrimaryRoot: entry.gitPrimaryRoot!, sourceSha, sourceTreeHash });
      };
      try {
        const git = (args: readonly string[]): string => line(command(held, "/usr/bin/git",
          [...GIT_PREFIX, "-C", root, ...args]));
        // Git 2.43 can echo an unknown --show-ref-format option with status 0.
        // The repository extension is the ref backend selector; absent means files.
        if (git(["config", "--local", "--default=files", "--get", "extensions.refStorage"]) !== "files") fail();
        const gitdir = normalizedGitPath(git(["rev-parse", "--git-dir"]), root);
        const commonDir = normalizedGitPath(git(["rev-parse", "--git-common-dir"]), root);
        if (commonDir !== path.join(entry.gitPrimaryRoot, ".git")) fail();
        held.holdOptionalFile(path.join(gitdir, "HEAD"));
        held.holdOptionalFile(path.join(gitdir, "logs", "HEAD"));
        const headRef = git(["rev-parse", "--symbolic-full-name", "HEAD"]);
        if (headRef !== "HEAD") {
          const directRef = git(["symbolic-ref", "--no-recurse", "HEAD"]);
          const terminalRef = git(["symbolic-ref", "HEAD"]);
          if (headRef !== directRef || directRef !== terminalRef
            || !headRef.startsWith("refs/heads/") || Buffer.byteLength(headRef) > 1024
            || command(held, "/usr/bin/git", [...GIT_PREFIX, "check-ref-format", headRef]).length !== 0) fail();
          const refPath = path.resolve(commonDir, headRef);
          if (!refPath.startsWith(`${commonDir}/refs/`)) fail();
          held.holdOptionalFile(refPath);
          held.holdOptionalFile(path.join(commonDir, "logs", headRef));
        }
        held.holdOptionalFile(path.join(commonDir, "packed-refs"));
        await recheckPhysical();
        const result = await withinHold(physical, recheckPhysical, observeSource);
        await recheckPhysical();
        return result;
      } finally {
        nestedOpen = false;
        holdInFlight = false;
        settleHold?.();
      }
    };
    try {
      await betweenPasses(Object.freeze([...entries]), withHeldRuntimeCandidate);
      if (holdInFlight) fail();
    } finally {
      betweenPassesOpen = false;
      if (holdSettled !== null) await holdSettled;
    }
    if (retained) retained.recheck!();
    else recheckEntries();
    operation = "result";
    for (const root of held.gitAdminChurnCandidateRoots()) blockers.push(Object.freeze({ root, reason: "git-admin-entry-churn" }));
    const ordered = Object.freeze(entries.sort((left, right) => compareRoot(left.root, right.root)));
    const orderedBlockers = Object.freeze(blockers.sort((left, right) => compareRoot(left.root, right.root)));
    const body = { schema: SCHEMA, status: orderedBlockers.length === 0 ? "complete" as const : "unresolved" as const,
      observerPidExcluded: process.pid,
      entries: ordered, absentBases: Object.freeze(absentBases.sort(compareRoot)),
      incidentalFiles: Object.freeze(incidentalFiles.sort(compareRoot)), blockers: orderedBlockers };
    return Object.freeze({ ...body, catalogHash: hashCanonicalJson(body) });
  } catch (error) {
    if (error instanceof AggregateError) throw error;
    const point = Object.freeze({ schema: "setfarm.internal-production-positive-worktree-physical-refusal-point.v1",
      operation, candidateOrdinal });
    const failure = Error("INTERNAL_PRODUCTION_POSITIVE_WORKTREE_PHYSICAL_CATALOG_INVALID", { cause: error });
    Object.defineProperty(failure, "physicalFailurePoint", { value: point });
    throw Object.freeze(failure);
  } finally {
    if (!retained) held.close();
  }
}

export async function observeHeldPositiveWorktreePhysicalCatalogV2(rawScope: unknown,
  betweenPasses: (firstPass: readonly Candidate[], withHeldRuntimeCandidate: WithHeldRuntimeCandidate) => Promise<void>
    = async () => undefined) {
  return observePhysicalCatalogV2(rawScope, betweenPasses);
}

async function retainPhysicalImportV4<T>(record: RetainedPhysicalV4, invoke: () => Promise<T>): Promise<T> {
  const occurrence = { intent: true as const, promise: null as Promise<T> | null, value: undefined as unknown, returned: false };
  record.imports.push(occurrence);
  if (retainedPhysicalV4 !== record || record.burned) fail();
  occurrence.promise = invoke();
  if (!types.isPromise(occurrence.promise)) fail();
  occurrence.value = await occurrence.promise; occurrence.returned = true;
  if (retainedPhysicalV4 !== record || record.burned) fail();
  return occurrence.value as T;
}

function physicalOriginalV4(scope: object, owner: object, token: object): RetainedPhysicalV4 {
  const record = retainedPhysicalV4;
  if (!record || record.scope !== scope || record.owner !== owner || record.token !== token) fail();
  checkRetainedPhysicalV4(record);
  return record;
}

/** Full original physical assertion, no PG query or caller-produced holder. */
export function assertHeldDashboardCutoverJointPhysicalReservationV4(scope: object, owner: object, token: object): void {
  if (retainedPhysicalV4?.checking || retainedPhysicalV4?.entryChecking) { burnRetainedPhysicalV4(retainedPhysicalV4); fail(); }
  if (arguments.length !== 3) fail();
  const record = physicalOriginalV4(scope, owner, token);
  record.entryChecking = true;
  try {
    if (!record.returned || !record.held || !record.recheck) fail();
    record.recheck(); checkRetainedPhysicalV4(record);
  } catch { burnRetainedPhysicalV4(record); fail(); }
  finally { record.entryChecking = false; }
}

/** One authenticated entry after fresh physical and SAME binding checks. */
export function assertHeldDashboardCutoverJointPhysicalOwnerEntryV4(scope: object, owner: object, token: object): void {
  if (retainedPhysicalV4?.checking || retainedPhysicalV4?.entryChecking) { burnRetainedPhysicalV4(retainedPhysicalV4); fail(); }
  if (arguments.length !== 3) fail();
  const record = physicalOriginalV4(scope, owner, token);
  record.entryChecking = true;
  try {
    if (!record.ownerReady || record.ownerEntered || !record.recheck) fail();
    record.recheck(); checkRetainedPhysicalV4(record); record.ownerEntered = true;
  } catch { burnRetainedPhysicalV4(record); fail(); }
  finally { record.entryChecking = false; }
}

/** Fixed retained profile. Success retains originals; UNKNOWN never disposes. */
export async function runHeldDashboardCutoverJointPhysicalReservationV4(scope: object, owner: object, token: object): Promise<void> {
  if (retainedPhysicalV4) { burnRetainedPhysicalV4(retainedPhysicalV4); fail(); }
  if (arguments.length !== 3 || [scope, owner, token].some(value => value === null
    || typeof value !== "object" || types.isProxy(value))) fail();
  const record: RetainedPhysicalV4 = { scope, owner, token, burned: false, returned: false,
    ownerReady: false, ownerEntered: false, checking: false, entryChecking: false, originals: [], held: null, recheck: null,
    promise: null, imports: [], census: null, adapter: null };
  retainedPhysicalV4 = record; // BEFORE the first import or resource occurrence.
  try {
    record.census = await retainPhysicalImportV4(record, () => import("./baseline-legacy-database-census-v1.js"));
    record.census.assertHeldDashboardCutoverPre32PhysicalMetadataV4(scope, owner, token);
    record.adapter = await retainPhysicalImportV4(record, () => import("../../scripts/deployment-dashboard-cutover-adapter-v2.mjs"));
    checkRetainedPhysicalV4(record);
    record.promise = observePhysicalCatalogV2({ ownerHomeRoot: userInfo().homedir,
      workspaceRoot: resolveInternalProductionBaselineWorkspaceRootV1() }, async () => {
      checkRetainedPhysicalV4(record);
      await record.census!.assertHeldDashboardCutoverPre32ActiveBindingV4(scope, owner, token);
      checkRetainedPhysicalV4(record); record.recheck!();
      record.ownerReady = true; checkRetainedPhysicalV4(record);
      await record.adapter!.executeDashboardCutoverJointPhysicalOwnerReservationV4(token, owner, scope);
      checkRetainedPhysicalV4(record);
    }, record);
    if (!types.isPromise(record.promise)) fail();
    const result = await record.promise;
    record.returned = true;
    if ((result as { status: string }).status !== "complete") fail();
    checkRetainedPhysicalV4(record); record.recheck!();
  } catch { burnRetainedPhysicalV4(record); fail(); }
}

export async function observeCodeOwnedPositiveWorktreePhysicalCatalogV2() {
  return observeHeldPositiveWorktreePhysicalCatalogV2({
    ownerHomeRoot: userInfo().homedir,
    workspaceRoot: resolveInternalProductionBaselineWorkspaceRootV1(),
  });
}
