import { spawnSync } from "node:child_process";
import { constants, closeSync, fstatSync, lstatSync, openSync, readFileSync, readdirSync } from "node:fs";
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
const NAME = /^[A-Za-z0-9._-]+$/;
const COMMAND_CAP = 1_048_576;
const COMMAND_ENV = Object.freeze({ PATH: "/usr/bin:/bin:/usr/sbin:/sbin", LANG: "C", LC_ALL: "C",
  GIT_CONFIG_NOSYSTEM: "1", GIT_CONFIG_GLOBAL: "/dev/null", GIT_NO_REPLACE_OBJECTS: "1",
  GIT_OPTIONAL_LOCKS: "0", GIT_TERMINAL_PROMPT: "0" });
const GIT_PREFIX = Object.freeze(["-c", "core.hooksPath=/dev/null", "-c", "core.fsmonitor=false"]);
let cleanupUncertain = false;

type Scope = Readonly<{ ownerHomeRoot: string; workspaceRoot: string }>;
type Zone = "retained-zone" | "runtime-zone";
type Held = { root: string; descriptor: number; first: BigIntStats; compareMutation: boolean };

function fail(): never { throw Error("INTERNAL_PRODUCTION_POSITIVE_WORKTREE_PHYSICAL_CATALOG_INVALID"); }

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
  private readonly byRoot = new Map<string, Held>();
  private closed = false;

  constructor(private readonly ownerHomeRoot: string, private readonly workspaceRoot: string) {}

  observerCommandCwd(): string {
    if (!this.byRoot.has(this.workspaceRoot)) fail();
    this.assertStable();
    return this.workspaceRoot;
  }

  hold(target: string): BigIntStats {
    if (this.closed || cleanupUncertain) fail();
    const segments = target.split(path.sep).filter(Boolean);
    if (segments.length > 128) fail();
    for (let index = 0; index <= segments.length; index += 1) {
      const root = path.join(path.parse(target).root, ...segments.slice(0, index));
      if (this.byRoot.has(root)) continue;
      const first = lstatSync(root, { bigint: true });
      if (!first.isDirectory() || first.isSymbolicLink()) fail();
      const descriptor = openSync(root, constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW);
      const entry = { root, descriptor, first,
        compareMutation: root === this.ownerHomeRoot || root.startsWith(`${this.ownerHomeRoot}/`) };
      this.entries.push(entry);
      this.byRoot.set(root, entry);
      if (!same(first, fstatSync(descriptor, { bigint: true }), entry.compareMutation)) fail();
    }
    this.assertStable();
    return this.byRoot.get(target)!.first;
  }

  assertStable(): void {
    if (this.closed || cleanupUncertain) fail();
    for (const entry of this.entries) {
      if (!same(entry.first, fstatSync(entry.descriptor, { bigint: true }), entry.compareMutation)
        || !same(entry.first, lstatSync(entry.root, { bigint: true }), entry.compareMutation)) fail();
    }
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    const errors: unknown[] = [];
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
  const result = spawnSync(executable, [...args], { env: COMMAND_ENV, shell: false, encoding: "buffer",
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
  if (onlyObserver.length !== 1 || onlyObserver[0] !== process.pid) fail();
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

type GitWorktreeListing = Readonly<{ roots: readonly string[]; prunableRoots: readonly string[] }>;

function gitWorktreeRoots(bytes: Buffer): GitWorktreeListing {
  const value = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  if (!value.endsWith("\0") || value.includes("\r")) fail();
  const records = value.slice(0, -1).split("\0\0");
  const roots: string[] = [];
  const prunableRoots: string[] = [];
  const seen = new Set<string>();
  for (const record of records) {
    const fields = record.split("\0").filter(Boolean);
    if (![3, 4].includes(fields.length) || !fields[0]?.startsWith("worktree ")
      || !/^HEAD [a-f0-9]{40}$/.test(fields[1]!)
      || !(fields[2] === "detached" || fields[2] === "bare" || /^branch refs\/heads\/[A-Za-z0-9._/-]+$/.test(fields[2]!))
      || (fields.length === 4 && !/^prunable [^\r\n\0]+$/.test(fields[3]!))) fail();
    const rawRoot = fields[0]!.slice("worktree ".length);
    if (!path.posix.isAbsolute(rawRoot) || path.posix.normalize(rawRoot) !== rawRoot) fail();
    const root = normalizedGitPath(rawRoot, "/");
    if (seen.has(root)) fail();
    seen.add(root);
    if (fields.length === 4) prunableRoots.push(root);
    else roots.push(root);
  }
  if (roots.length === 0 || seen.size > MAX_ENTRIES) fail();
  return Object.freeze({ roots: Object.freeze(roots), prunableRoots: Object.freeze(prunableRoots) });
}

type CandidateKind = "unresolved" | "linked-git" | "primary-git";
type Candidate = Readonly<{ root: string; zone: Zone; kind: CandidateKind; dev: string; ino: string;
  birthtimeNs: string; gitPrimaryRoot: string | null; dirty: boolean | null;
  sourceBuildProvenance: "unverified";
  referencingPids: readonly number[] }>;

function primaryWorktreeRoots(held: HeldDirectories, root: string): GitWorktreeListing | null {
  const marker = path.join(root, ".git");
  if (isMissing(marker)) return null;
  const observed = lstatSync(marker, { bigint: true });
  if (!observed.isDirectory() || observed.isSymbolicLink()) fail();
  held.hold(marker);
  const top = line(command(held, "/usr/bin/git", [...GIT_PREFIX, "-C", root, "rev-parse", "--show-toplevel"]));
  if (top !== root) fail();
  const roots = gitWorktreeRoots(command(held, "/usr/bin/git", [...GIT_PREFIX, "-C", root, "worktree", "list", "--porcelain", "-z"]));
  if (roots.roots[0] !== root) fail();
  return roots;
}

function observeGitCandidate(held: HeldDirectories, root: string, base: string, zone: Zone,
  scope: Scope): Readonly<{ kind: CandidateKind; gitPrimaryRoot: string | null; dirty: boolean | null;
    listedRoots: readonly string[]; prunableRoots: readonly string[]; reason: string | null }> {
  const marker = path.join(root, ".git");
  if (isMissing(marker)) return { kind: "unresolved", gitPrimaryRoot: null, dirty: null,
    listedRoots: [], prunableRoots: [], reason: "non-git-child" };
  const markerStat = lstatSync(marker, { bigint: true });
  if (markerStat.isSymbolicLink()) fail();
  if (!markerStat.isFile() && !markerStat.isDirectory()) fail();
  let gitdirFromMarker: string | null = null;
  let markerDescriptor: number | null = null;
  try {
  if (markerStat.isDirectory()) held.hold(marker);
  else {
    if (markerStat.size < 1n || markerStat.size > 4096n) fail();
    markerDescriptor = openSync(marker, constants.O_RDONLY | constants.O_NOFOLLOW);
    if (!sameFile(markerStat, fstatSync(markerDescriptor, { bigint: true }))) fail();
    const markerBytes = readFileSync(markerDescriptor);
    const match = /^gitdir: ([^\r\n]+)\n$/.exec(new TextDecoder("utf-8", { fatal: true }).decode(markerBytes));
    if (!match) fail();
    gitdirFromMarker = normalizedGitPath(match[1]!, root);
    held.hold(gitdirFromMarker);
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
      listedRoots: [], prunableRoots: [], reason: "git-top-level-mismatch" };
    const listing = gitWorktreeRoots(git(["worktree", "list", "--porcelain", "-z"]));
    const listedRoots = listing.roots;
    const primary = listedRoots[0]!;
    if (!listedRoots.includes(root)) fail();
    if (listing.prunableRoots.length > 0) return { kind: "unresolved", gitPrimaryRoot: primary,
      dirty: null, listedRoots, prunableRoots: listing.prunableRoots, reason: "prunable-git-list" };
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
          prunableRoots: [], reason: "untrusted-code-git" };
      }
      const fixedPrimaries = [path.join(scope.workspaceRoot, "setfarm"), path.join(scope.workspaceRoot, "mission-control")];
      const retainedPrimaryZone = [path.join(scope.workspaceRoot, ".worktrees"),
        path.join(scope.workspaceRoot, "deployments")].some((retainedBase) => primary.startsWith(`${retainedBase}/`));
      if (!fixedPrimaries.includes(primary) && !retainedPrimaryZone) {
        return { kind: "unresolved", gitPrimaryRoot: primary, dirty: null, listedRoots, prunableRoots: [],
          reason: "retained-primary-mismatch" };
      }
    }
    if (zone === "runtime-zone") {
      const projectBase = path.join(scope.ownerHomeRoot, "projects");
      const expectedProject = base.startsWith(`${projectBase}/`) ? path.dirname(base) : null;
      if ((expectedProject !== null && primary !== expectedProject)
        || (expectedProject === null && !primary.startsWith(`${projectBase}/`))) {
        return { kind: "unresolved", gitPrimaryRoot: primary, dirty: null, listedRoots, prunableRoots: [],
          reason: "runtime-primary-mismatch" };
      }
    }
    const dirty = git(["status", "--porcelain=v2", "--untracked-files=all"]).length !== 0;
    return { kind: root === primary ? "primary-git" : "linked-git", gitPrimaryRoot: primary,
      dirty, listedRoots, prunableRoots: [], reason: null };
  } finally {
    if (markerDescriptor !== null) {
      try { closeSync(markerDescriptor); }
      catch { cleanupUncertain = true; fail(); }
    }
  }
}

export async function observeHeldPositiveWorktreePhysicalCatalogV2(
  rawScope: unknown,
  betweenPasses: () => Promise<void> = async () => undefined,
) {
  const scope = captureScope(rawScope);
  if (cleanupUncertain || typeof betweenPasses !== "function") fail();
  const held = new HeldDirectories(scope.ownerHomeRoot, scope.workspaceRoot);
  try {
    const { ownerHomeRoot, workspaceRoot } = scope;
    for (const mandatory of [ownerHomeRoot, workspaceRoot, path.join(workspaceRoot, "setfarm"),
      path.join(workspaceRoot, "mission-control"), path.join(ownerHomeRoot, "projects"),
      path.join(ownerHomeRoot, ".openclaw", "workspace", "agent-scratch"),
      path.join(ownerHomeRoot, ".openclaw", "workspaces", "workflows")]) held.hold(mandatory);

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
    const projectRoots = children(held, path.join(ownerHomeRoot, "projects"), incidentalFiles);
    for (const project of projectRoots) addBase(path.join(project, ".worktrees"), "runtime-zone");
    for (const workflow of children(held, path.join(ownerHomeRoot, ".openclaw", "workspaces", "workflows"), incidentalFiles)) {
      addBase(path.join(workflow, "story-worktrees"), "runtime-zone");
      const agents = path.join(workflow, "agents");
      if (isMissing(agents)) fail();
      for (const agent of children(held, agents, incidentalFiles)) addBase(path.join(agent, "story-worktrees"), "runtime-zone");
    }

    const entries: Candidate[] = [];
    const blockers: Array<Readonly<{ root: string; reason: string }>> = [];
    const listedGroups: Array<readonly string[]> = [];
    const firstByRoot = new Map<string, Readonly<{ base: string; zone: Zone; listedHash: string; reason: string | null }>>();
    const parentGitLists = new Map<string, string>();
    const nonGitParents: string[] = [];
    for (const parent of [path.join(workspaceRoot, "setfarm"), path.join(workspaceRoot, "mission-control"), ...projectRoots]) {
      const listing = primaryWorktreeRoots(held, parent);
      if (listing !== null) {
        parentGitLists.set(parent, hashCanonicalJson(listing));
        listedGroups.push(listing.roots);
        for (const root of listing.prunableRoots) blockers.push(Object.freeze({ root, reason: "prunable-git-worktree" }));
      } else if (bases.has(path.join(parent, ".worktrees"))) {
        nonGitParents.push(parent);
        blockers.push(Object.freeze({ root: parent, reason: "non-git-parent" }));
      }
    }
    for (const [base, zone] of bases) {
      for (const root of children(held, base)) {
        if (entries.length >= MAX_ENTRIES) fail();
        const stat = held.hold(root);
        const git = observeGitCandidate(held, root, base, zone, scope);
        const referencingPids = referencePids(held, root);
        if (git.reason !== null) blockers.push(Object.freeze({ root, reason: git.reason }));
        for (const prunableRoot of git.prunableRoots) blockers.push(Object.freeze({ root: prunableRoot,
          reason: "prunable-git-worktree" }));
        if (git.listedRoots.length > 0) listedGroups.push(git.listedRoots);
        firstByRoot.set(root, Object.freeze({ base, zone,
          listedHash: hashCanonicalJson({ roots: git.listedRoots, prunableRoots: git.prunableRoots }), reason: git.reason }));
        entries.push(Object.freeze({ root, zone, kind: git.kind, dev: String(stat.dev), ino: String(stat.ino),
          birthtimeNs: String(stat.birthtimeNs), gitPrimaryRoot: git.gitPrimaryRoot, dirty: git.dirty,
          sourceBuildProvenance: "unverified" as const,
          referencingPids }));
      }
    }
    const present = new Set(entries.map((entry) => entry.root));
    for (const group of listedGroups) {
      for (const listedRoot of group) {
        if (!present.has(listedRoot) && !parentGitLists.has(listedRoot)) {
          blockers.push(Object.freeze({ root: listedRoot, reason: "listed-outside-scope" }));
        }
      }
    }
    held.assertStable();
    await betweenPasses();
    held.assertStable();
    for (const root of absentBases) if (!isMissing(root)) fail();
    for (const [parent, firstHash] of parentGitLists) {
      const fresh = primaryWorktreeRoots(held, parent);
      if (fresh === null || hashCanonicalJson(fresh) !== firstHash) fail();
    }
    for (const parent of nonGitParents) if (!isMissing(path.join(parent, ".git"))) fail();
    for (const entry of entries) {
      const first = firstByRoot.get(entry.root)!;
      const fresh = observeGitCandidate(held, entry.root, first.base, first.zone, scope);
      const freshPids = referencePids(held, entry.root);
      if (fresh.kind !== entry.kind || fresh.gitPrimaryRoot !== entry.gitPrimaryRoot
        || fresh.dirty !== entry.dirty || fresh.reason !== first.reason
        || hashCanonicalJson({ roots: fresh.listedRoots, prunableRoots: fresh.prunableRoots }) !== first.listedHash
        || hashCanonicalJson(freshPids) !== hashCanonicalJson(entry.referencingPids)) fail();
    }
    const ordered = Object.freeze(entries.sort((left, right) => compareRoot(left.root, right.root)));
    const orderedBlockers = Object.freeze(blockers.sort((left, right) => compareRoot(left.root, right.root)));
    const body = { schema: SCHEMA, status: orderedBlockers.length === 0 ? "complete" as const : "unresolved" as const,
      observerPidExcluded: process.pid,
      entries: ordered, absentBases: Object.freeze(absentBases.sort(compareRoot)),
      incidentalFiles: Object.freeze(incidentalFiles.sort(compareRoot)), blockers: orderedBlockers };
    return Object.freeze({ ...body, catalogHash: hashCanonicalJson(body) });
  } catch (error) {
    if (error instanceof AggregateError) throw error;
    throw Error("INTERNAL_PRODUCTION_POSITIVE_WORKTREE_PHYSICAL_CATALOG_INVALID", { cause: error });
  } finally {
    held.close();
  }
}

export async function observeCodeOwnedPositiveWorktreePhysicalCatalogV2() {
  return observeHeldPositiveWorktreePhysicalCatalogV2({
    ownerHomeRoot: userInfo().homedir,
    workspaceRoot: resolveInternalProductionBaselineWorkspaceRootV1(),
  });
}
