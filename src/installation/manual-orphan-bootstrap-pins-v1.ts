/** Builtin-only admission. These internals are never returned by the public adapter. */
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { accessSync, closeSync, constants, fstatSync, lstatSync, openSync, readSync,
  readdirSync, realpathSync, type BigIntStats } from "node:fs";
import { userInfo } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

type SourceIdentity = Readonly<{ sha: string; treeHash: string; buildHash: string }>;
type HeldBuild = Readonly<{ observation: { buildSource: SourceIdentity }; recheck(): void; close(): void }>;
// Validate a dynamically imported holder's result without asserting unknown
// payloads into a trusted type. The executing module bytes are admitted first.
function isHeldBuild(value: unknown): value is HeldBuild {
  if (value === null || typeof value !== "object" || !("observation" in value)
    || !("recheck" in value) || typeof value.recheck !== "function"
    || !("close" in value) || typeof value.close !== "function") return false;
  const observation: unknown = value.observation;
  if (observation === null || typeof observation !== "object" || !("buildSource" in observation)) return false;
  const source: unknown = observation.buildSource;
  return source !== null && typeof source === "object"
    && "sha" in source && typeof source.sha === "string" && /^[a-f0-9]{40}$/.test(source.sha)
    && "treeHash" in source && typeof source.treeHash === "string" && /^[a-f0-9]{40}$/.test(source.treeHash)
    && "buildHash" in source && typeof source.buildHash === "string" && /^[a-f0-9]{64}$/.test(source.buildHash);
}
type Group = { row: ["esm", string, string, string]; members: string[] };
type Package = { locator: string; name: string; version: string; lockIntegrity: string;
  inventoryHash: string; fileCount: number; byteLength: number };
type Profile = { schema: string; platform: string; arch: string;
  target: { sourceSha: string; sourceTreeHash: string; outputTreeHash: string; lockSha256: string; metadata: Record<string, string> };
  packages: Package[]; targetResolution: Group[]; targetAbsences: string[];
  maintenanceObserver: { sourceClosure: { locator: string; sha256: string }[]; resolution: Group[]; absences: string[] } };
const NODE = "/opt/homebrew/Cellar/node/26.4.0/bin/node";
const NODE_HASH = "59cd4fb59cf5bc239f43d5db8c0cd8c23c22db79419612b92da3b7cf34de8553";
const TARGET_SHA = "161297ffca6adf2851918a93d492e1c9a77ce59d";
const INSTALLATION = "fdd9fe74-ccee-4673-a727-64fe57f68ad0";
const PROFILE = "src/installation/manual-orphan-target-dependencies-v1.json";
const SCRIPT = "scripts/build-generation-retention.mjs";
const SELECTED_NAMES = new Set([
  "SETFARM_INSTALLATION_DIR", "SETFARM_PG_URL", "SETFARM_TEST_PG_ADMIN_URL", "DATABASE_URL",
  "SETFARM_DIR", "SETFARM_ENV_DIR", "SETFARM_DB_PATH", "PROJECTS_DIR", "SETFARM_REPO_DIR", "SCRIPTS_DIR", "CLI_PATH",
  "SETFARM_PROJECTS_ROOT", "SETFARM_WORKSPACE_PROJECTS_ROOT", "OPENCLAW_PROJECTS_ROOT", "SETFARM_PLATFORM_ROOT",
  "SETFARM_PRODUCT_ARTIFACT_DIR", "SETFARM_CONVERGENCE_RESULT_DIR", "SETFARM_ARTIFACT_MAX_PAYLOAD_BYTES",
  "SETFARM_ARTIFACT_ROOT_QUOTA_BYTES", "SETFARM_ARTIFACT_MIN_FREE_BYTES", "SETFARM_ARTIFACT_STORE_AUTHORITY_V1",
  "OPENCLAW_STATE_DIR", "OPENCLAW_CONFIG_PATH", "SETFARM_SKIP_RUNTIME_GUARD", "SETFARM_ALLOW_DIRTY_BUILD",
]);
const directoryKeys = ["dev", "ino", "uid", "gid", "mode", "birthtimeNs"] as const;
const fileKeys = [...directoryKeys, "nlink", "size", "mtimeNs", "ctimeNs"] as const;
const treeKeys = [...directoryKeys, "mtimeNs", "ctimeNs"] as const;
let cleanupUncertain = false;
function fail(code = "MANUAL_ORPHAN_PIN_REFUSED"): never { throw new Error(code); }
const sanitize = (error: unknown, phase: string): Error => new Error(error instanceof Error
  && /^BOOTSTRAP_(?:(?:CONTEXT|M|TARGET|DEPENDENCY|ENTRY)_REFUSED|CLEANUP_UNKNOWN)$/.test(error.message) ? error.message : phase);
const hash = (bytes: Buffer | string): string => createHash("sha256").update(bytes).digest("hex");
const same = (a: BigIntStats, b: BigIntStats, keys: readonly (keyof BigIntStats)[]): boolean => keys.every(key => a[key] === b[key]);
const physicalAccountPath = (value: string): string => process.platform === "darwin" && value.startsWith("/var/") ? `/private${value}` : value;
const locator = (value: string): boolean => typeof value === "string" && value.length < 1024 && !path.isAbsolute(value)
  && path.posix.normalize(value) === value && value.split("/").every(part => /^[A-Za-z0-9._-]+$/.test(part) && part !== "." && part !== "..");

// Same nofollow/identity, directory-listing and absence model as the retained
// profile helper. Packages retain its independent 64MiB/8192-entry budgets.
class Pins {
  private directories = new Map<string, { fd: number; stat: BigIntStats; tree: boolean }>();
  private files = new Map<string, BigIntStats>();
  private absences = new Set<string>();
  private closed = false;
  private systemGitHash: string | undefined;
  constructor(private home: string, private uid: bigint, private code: string) {}
  hold(directory: string, tree = false): BigIntStats {
    if (this.closed || cleanupUncertain || !path.isAbsolute(directory) || path.normalize(directory) !== directory) fail();
    const parts = directory.split(path.sep).filter(Boolean);
    if (parts.length > 128) fail();
    for (let index = 0; index <= parts.length; index++) {
      const target = path.join(path.parse(directory).root, ...parts.slice(0, index));
      const existing = this.directories.get(target);
      if (existing) { if (target === directory && tree) existing.tree = true; continue; }
      if (this.directories.size >= 256) fail();
      const stat = lstatSync(target, { bigint: true });
      if (!stat.isDirectory() || stat.isSymbolicLink()
        || ((target === this.home || target.startsWith(`${this.home}/`)) && (stat.uid !== this.uid || (stat.mode & 0o022n)))) fail();
      const fd = openSync(target, constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW);
      this.directories.set(target, { fd, stat, tree: target === directory && tree });
      if (!same(stat, fstatSync(fd, { bigint: true }), directoryKeys)
        || !same(stat, lstatSync(target, { bigint: true }), directoryKeys)) fail();
    }
    return this.directories.get(directory)!.stat;
  }
  read(target: string, cap = 16 * 1024 * 1024, device?: bigint, system = false): Buffer {
    this.hold(path.dirname(target));
    const before = lstatSync(target, { bigint: true });
    // Darwin's fixed root-owned /usr/bin/git is a protected system executable
    // with multiple OS hardlinks. This exception never applies to user files,
    // Node, packages or private records. Retain its exact link count and bytes.
    const systemGit = system && target === "/usr/bin/git";
    if (systemGit) {
      if (before.uid !== 0n || (before.mode & 0o7777n) !== 0o755n || before.size < 1n) fail();
      for (const ancestor of ["/", "/usr", "/usr/bin"]) {
        const identity = this.hold(ancestor);
        if (identity.uid !== 0n || (identity.mode & 0o022n)) fail();
      }
    }
    if (!before.isFile() || before.isSymbolicLink() || (systemGit ? before.nlink < 1n : before.nlink !== 1n) || (before.mode & 0o022n)
      || (before.uid !== this.uid && !(system && before.uid === 0n)) || (device !== undefined && before.dev !== device)
      || before.size < 0n || before.size > BigInt(cap)) fail();
    const previous = this.files.get(target);
    if (previous && !same(previous, before, fileKeys)) fail();
    const fd = openSync(target, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
    try {
      if (!same(before, fstatSync(fd, { bigint: true }), fileKeys)) fail();
      const bytes = Buffer.alloc(Number(before.size) + 1); let count = 0;
      while (count < bytes.length) { const n = readSync(fd, bytes, count, bytes.length - count, count); if (!n) break; count += n; }
      if (BigInt(count) !== before.size || !same(before, fstatSync(fd, { bigint: true }), fileKeys)
        || !same(before, lstatSync(target, { bigint: true }), fileKeys)) fail();
      const result = Buffer.from(bytes.subarray(0, count));
      if (systemGit) {
        const digest = hash(result);
        if (this.systemGitHash !== undefined && this.systemGitHash !== digest) fail();
        this.systemGitHash = digest;
      }
      this.files.set(target, before); return result;
    } finally {
      try { closeSync(fd); } catch { cleanupUncertain = true; fail("BOOTSTRAP_CLEANUP_UNKNOWN"); }
    }
  }
  absent(target: string): void {
    const parts = target.split(path.sep).filter(Boolean); let parent = path.parse(target).root;
    if (!path.isAbsolute(target) || path.normalize(target) !== target || parts.length > 128) fail();
    this.hold(parent);
    for (const [index, part] of parts.entries()) {
      const current = path.join(parent, part); let stat: BigIntStats;
      try { stat = lstatSync(current, { bigint: true }); }
      catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
        this.hold(parent, true); this.absences.add(current); return;
      }
      if (index === parts.length - 1 || !stat.isDirectory() || stat.isSymbolicLink()) fail();
      this.hold(current); parent = current;
    }
    fail();
  }
  check(): void {
    try { this.checkPins(); } catch (error) { throw sanitize(error, cleanupUncertain ? "BOOTSTRAP_CLEANUP_UNKNOWN" : this.code); }
  }
  private checkPins(): void {
    if (this.closed || cleanupUncertain) fail();
    for (const [target, pin] of this.directories) {
      const keys = pin.tree ? treeKeys : directoryKeys;
      if (!same(pin.stat, fstatSync(pin.fd, { bigint: true }), keys)
        || !same(pin.stat, lstatSync(target, { bigint: true }), keys)) fail();
    }
    for (const [target, stat] of this.files) if (!same(stat, lstatSync(target, { bigint: true }), fileKeys)) fail();
    if (this.systemGitHash !== undefined) this.read("/usr/bin/git", 16 * 1024 * 1024, undefined, true);
    for (const target of this.absences) {
      try { lstatSync(target); fail(); } catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
    }
  }
  close(): void {
    if (this.closed) { if (cleanupUncertain) fail("BOOTSTRAP_CLEANUP_UNKNOWN"); return; }
    this.closed = true;
    for (const pin of [...this.directories.values()].reverse()) {
      try { closeSync(pin.fd); } catch { cleanupUncertain = true; }
    }
    this.directories.clear(); this.files.clear(); this.absences.clear(); this.systemGitHash = undefined;
    if (cleanupUncertain) fail("BOOTSTRAP_CLEANUP_UNKNOWN");
  }
}

const resolverSource = `
import fs from 'node:fs';import {createRequire} from 'node:module';import {pathToFileURL,fileURLToPath} from 'node:url';
const input=JSON.parse(fs.readFileSync(0,'utf8'));
process.stdout.write(JSON.stringify(input.edges.map(([mode,parent,specifier])=>{
 const url=pathToFileURL(parent),require=createRequire(url);
 return input.phase==='paths'?require.resolve.paths(specifier):fileURLToPath(import.meta.resolve(specifier,url.href));
})));`;

function packages(pins: Pins, root: string, profile: Profile, groups: Group[], absences: string[], recheck: () => void): void {
  const device = pins.hold(root).dev;
  const lock = JSON.parse(pins.read(path.join(root, "package-lock.json"), 16 * 1024 * 1024, device).toString("utf8"));
  pins.read(path.join(root, "package.json"), 1024 * 1024, device);
  if (!Array.isArray(profile.packages) || !profile.packages.length || profile.packages.length > 16) fail();
  let total = 0, visited = 0;
  const seenPackages = new Set<string>();
  const authenticated = new Set<string>();
  for (const entry of profile.packages) {
    if (!/^node_modules\/[a-z][a-z0-9-]*$/.test(entry.locator) || seenPackages.has(entry.locator)
      || entry.locator !== `node_modules/${entry.name}` || !/^[a-f0-9]{64}$/.test(entry.inventoryHash)
      || !Number.isSafeInteger(entry.fileCount) || entry.fileCount < 1 || entry.fileCount > 2048) fail();
    seenPackages.add(entry.locator);
    if (lock.packages?.[entry.locator]?.version !== entry.version || lock.packages?.[entry.locator]?.integrity !== entry.lockIntegrity) fail();
    const members: { locator: string; byteLength: number; sha256: string }[] = [];
    const walk = (directory: string, relative: string, depth: number): void => {
      if (depth > 32 || pins.hold(directory, true).dev !== device) fail();
      const names = readdirSync(directory).sort(); if (names.length > 2048) fail();
      for (const name of names) {
        if (++visited > 8192 || !/^[A-Za-z0-9._-]+$/.test(name) || name === "node_modules") fail();
        const target = path.join(directory, name), member = relative ? `${relative}/${name}` : name;
        const stat = lstatSync(target, { bigint: true });
        if (stat.isSymbolicLink()) fail();
        if (stat.isDirectory()) walk(target, member, depth + 1);
        else {
          const bytes = pins.read(target, 16 * 1024 * 1024, device);
          total += bytes.length; if (total > 64 * 1024 * 1024) fail();
          members.push({ locator: member, byteLength: bytes.length, sha256: hash(bytes) });
          authenticated.add(`${entry.locator}/${member}`); if (members.length > 2048) fail();
        }
      }
    };
    walk(path.join(root, entry.locator), "", 0);
    members.sort((a, b) => Buffer.compare(Buffer.from(a.locator), Buffer.from(b.locator)));
    if (hash(JSON.stringify(members)) !== entry.inventoryHash || members.length !== entry.fileCount
      || members.reduce((sum, member) => sum + member.byteLength, 0) !== entry.byteLength) fail();
    const metadata = JSON.parse(pins.read(path.join(root, entry.locator, "package.json"), 1024 * 1024, device).toString("utf8"));
    if (metadata.name !== entry.name || metadata.version !== entry.version) fail();
  }
  if (!Array.isArray(groups) || groups.length < 1 || groups.length > 64) fail();
  const memberships = new Set<string>(), contexts = new Set<string>();
  for (const { row, members } of groups) {
    if (!Array.isArray(row) || row.length !== 4 || row[0] !== "esm" || !locator(row[1]) || !locator(row[3])
      || !seenPackages.has(`node_modules/${row[2]}`) || !authenticated.has(row[3])
      || !Array.isArray(members) || !members.length || !members.includes(row[1])) fail();
    const key = JSON.stringify([row[0], path.dirname(row[1]), row[2], row[3]]);
    if (contexts.has(key)) fail(); contexts.add(key);
    const directory = pins.hold(path.join(root, path.dirname(row[1])), true);
    for (const member of members) {
      if (!locator(member) || !member.startsWith("dist/") || !member.endsWith(".js") || path.dirname(member) !== path.dirname(row[1])) fail();
      const membership = `${member}:${row[2]}`;
      if (memberships.has(membership)) fail(); memberships.add(membership);
      if (pins.hold(path.dirname(path.join(root, member))).ino !== directory.ino) fail();
      pins.read(path.join(root, member), 16 * 1024 * 1024, device);
    }
  }
  for (const absent of absences) { if (!locator(absent)) fail(); pins.absent(path.join(root, absent)); }
  const run = (phase: "paths" | "resolve", accountHome: boolean): unknown[] => {
    recheck(); pins.check();
    const input = JSON.stringify({ phase, edges: groups.map(({ row }) => [row[0], path.join(root, row[1]), row[2]]) });
    if (Buffer.byteLength(input) > 1024 * 1024) fail();
    const child = spawnSync(NODE, ["--experimental-import-meta-resolve", "--input-type=module", "-e", resolverSource], {
      input, encoding: "utf8", cwd: root, shell: false, timeout: 5000, maxBuffer: 1024 * 1024,
      env: { PATH: "/usr/bin:/bin", LANG: "C", LC_ALL: "C", ...(accountHome ? { HOME: userInfo().homedir } : {}) },
    });
    recheck(); pins.check();
    if (child.error || child.signal || child.status !== 0 || child.stderr !== "" || typeof child.stdout !== "string") fail();
    const value: unknown = JSON.parse(child.stdout);
    if (!Array.isArray(value) || value.length !== groups.length) fail();
    return value;
  };
  for (const account of [false, true]) {
    for (const [index, search] of run("paths", account).entries()) {
      if (!Array.isArray(search) || !search.length || search.length > 128) fail();
      let found = false;
      for (const directory of search) {
        if (typeof directory !== "string" || !path.isAbsolute(directory) || path.normalize(directory) !== directory) fail();
        if (directory === path.join(root, "node_modules")) { found = true; break; }
        for (const suffix of ["", ".js", ".json", ".node"]) pins.absent(path.join(directory, `${groups[index]!.row[2]}${suffix}`));
      }
      if (!found) fail();
    }
    for (const [index, result] of run("resolve", account).entries()) if (result !== path.join(root, groups[index]!.row[3])) fail();
  }
  recheck(); pins.check();
}

/** One fixed code-relative invocation, with no caller-selected roots or profile. */
export function holdManualOrphanBootstrapPinsV1() {
  if (arguments.length || cleanupUncertain) fail(cleanupUncertain ? "BOOTSTRAP_CLEANUP_UNKNOWN" : "BOOTSTRAP_CONTEXT_REFUSED");
  const modulePath = fileURLToPath(import.meta.url);
  const suffix = "/dist/installation/manual-orphan-bootstrap-pins-v1.js";
  // Refuse source/preload/incorrect argv before any filesystem or subprocess work.
  if (!modulePath.endsWith(suffix) || process.execArgv.length !== 0 || process.execPath !== NODE
    || process.argv0 !== NODE || process.argv.length !== 3 || process.argv[0] !== NODE || process.argv[2] !== "observe-bootstrap"
    || process.platform !== "darwin" || process.arch !== "arm64" || process.version !== "v26.4.0") fail("BOOTSTRAP_CONTEXT_REFUSED");
  for (const key of Object.keys(process.env)) {
    if (SELECTED_NAMES.has(key) || /^(?:NODE_|GIT_|PG|DYLD_|LD_|SETFARM_INTERNAL_PRODUCTION_|SETFARM_TEST_)/.test(key)) fail("BOOTSTRAP_CONTEXT_REFUSED");
  }
  const maintenanceRoot = modulePath.slice(0, -suffix.length);
  if (process.argv[1] !== path.join(maintenanceRoot, "dist/cli/manual-control-orphan-retirement-v1.js")
    || process.cwd() !== maintenanceRoot || path.basename(path.dirname(maintenanceRoot)) !== "releases") fail("BOOTSTRAP_CONTEXT_REFUSED");
  const account = userInfo(), home = physicalAccountPath(account.homedir), workspace = path.join(home, "ai/setrox");
  if (path.dirname(path.dirname(maintenanceRoot)) !== workspace || process.getuid?.() !== account.uid
    || (process.env.HOME !== undefined && process.env.HOME !== account.homedir)) fail("BOOTSTRAP_CONTEXT_REFUSED");
  const targetRoot = path.join(workspace, "releases/setfarm-161297ff");
  const installationDirectory = path.join(workspace, "data/installations", INSTALLATION);
  const launch = new Pins(home, BigInt(account.uid), "BOOTSTRAP_CONTEXT_REFUSED");
  const maintenance = new Pins(home, BigInt(account.uid), "BOOTSTRAP_DEPENDENCY_REFUSED");
  const target = new Pins(home, BigInt(account.uid), "BOOTSTRAP_TARGET_REFUSED");
  const targetDependencies = new Pins(home, BigInt(account.uid), "BOOTSTRAP_DEPENDENCY_REFUSED");
  let heldBuild: HeldBuild | undefined, heldTargetBuild: HeldBuild | undefined, profile: Profile, profileHash: string;
  let workspaceAnchor: { assertStable(): void; close(): void } | undefined;
  let closed = false, invalid = false, admittedM = false, admittedT = false, selected = false;
  let phase = "BOOTSTRAP_CONTEXT_REFUSED";
  const initialEnv = { ...process.env }; let effectivePath: string | undefined;
  const executablePaths = new Map<string, { identity: BigIntStats; physical: string }>();
  const environment = (): void => {
    const expected: NodeJS.ProcessEnv = { ...initialEnv, ...(effectivePath === undefined ? {} : { PATH: effectivePath }),
      ...(selected ? { SETFARM_INSTALLATION_DIR: installationDirectory } : {}) };
    const names = Object.keys(expected).sort(), actual = Object.keys(process.env).sort();
    if (JSON.stringify(names) !== JSON.stringify(actual) || names.some(key => process.env[key] !== expected[key])) fail("BOOTSTRAP_CONTEXT_REFUSED");
    if (process.cwd() !== maintenanceRoot || process.execArgv.length || process.argv.length !== 3
      || process.argv[0] !== NODE || process.argv[1] !== path.join(maintenanceRoot, "dist/cli/manual-control-orphan-retirement-v1.js")
      || process.argv[2] !== "observe-bootstrap" || process.execPath !== NODE || process.argv0 !== NODE) fail("BOOTSTRAP_CONTEXT_REFUSED");
  };
  const close = (): void => {
    if (closed) { if (cleanupUncertain) fail("BOOTSTRAP_CLEANUP_UNKNOWN"); return; }
    closed = true;
    try { heldTargetBuild?.close(); } catch { cleanupUncertain = true; }
    try { workspaceAnchor?.close(); } catch { cleanupUncertain = true; }
    try { heldBuild?.close(); } catch { cleanupUncertain = true; }
    for (const pins of [targetDependencies, target, maintenance, launch]) { try { pins.close(); } catch { cleanupUncertain = true; } }
    if (cleanupUncertain) fail("BOOTSTRAP_CLEANUP_UNKNOWN");
  };
  const check = (): void => {
    if (closed || invalid || cleanupUncertain) fail(cleanupUncertain ? "BOOTSTRAP_CLEANUP_UNKNOWN" : phase);
    try {
      environment(); launch.check();
      try { workspaceAnchor?.assertStable(); } catch { fail("BOOTSTRAP_CONTEXT_REFUSED"); }
      try { heldBuild?.recheck(); } catch { fail("BOOTSTRAP_M_REFUSED"); }
      try { heldTargetBuild?.recheck(); } catch { fail("BOOTSTRAP_TARGET_REFUSED"); }
      maintenance.check(); target.check(); targetDependencies.check();
      for (const [named, pin] of executablePaths) {
        if (!same(pin.identity, lstatSync(named, { bigint: true }), fileKeys) || realpathSync(named) !== pin.physical) fail("BOOTSTRAP_CONTEXT_REFUSED");
      }
    }
    catch (error) { invalid = true; throw error; }
  };
  const git = (args: string[]): Buffer => {
    launch.check(); environment();
    const result = spawnSync("/usr/bin/git", ["-c", "core.hooksPath=/dev/null", "-c", "core.fsmonitor=false", ...args], {
      cwd: maintenanceRoot, shell: false, timeout: 10000, maxBuffer: 16 * 1024 * 1024,
      env: { PATH: "/usr/bin:/bin", LANG: "C", LC_ALL: "C", GIT_CONFIG_NOSYSTEM: "1", GIT_CONFIG_GLOBAL: "/dev/null",
        GIT_NO_REPLACE_OBJECTS: "1", GIT_OPTIONAL_LOCKS: "0", GIT_TERMINAL_PROMPT: "0" },
    });
    launch.check(); environment();
    if (result.error || result.signal || result.status !== 0 || result.stderr.length) fail(phase);
    return result.stdout;
  };
  const executable = (name: string, configured: string): string => {
    for (const directory of configured.split(path.delimiter)) {
      if (!directory || !path.isAbsolute(directory) || path.normalize(directory) !== directory) fail("BOOTSTRAP_CONTEXT_REFUSED");
      const candidate = path.join(directory, name);
      try { accessSync(candidate, constants.X_OK); } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
        launch.absent(candidate); continue;
      }
      launch.hold(path.dirname(candidate), true);
      const identity = lstatSync(candidate, { bigint: true }), resolved = realpathSync(candidate);
      const prior = executablePaths.get(candidate);
      if (prior && (!same(prior.identity, identity, fileKeys) || prior.physical !== resolved)) fail("BOOTSTRAP_CONTEXT_REFUSED");
      executablePaths.set(candidate, { identity, physical: resolved });
      launch.read(resolved, 16 * 1024 * 1024, undefined, true);
      return resolved;
    }
    return fail("BOOTSTRAP_CONTEXT_REFUSED");
  };
  try {
    launch.hold(workspace); const device = launch.hold(maintenanceRoot).dev;
    if (maintenanceRoot === targetRoot || realpathSync(maintenanceRoot) !== maintenanceRoot || realpathSync(modulePath) !== modulePath
      || realpathSync(NODE) !== NODE || hash(launch.read(NODE, 16 * 1024 * 1024, undefined, true)) !== NODE_HASH) fail("BOOTSTRAP_CONTEXT_REFUSED");
    launch.read("/usr/bin/git", 16 * 1024 * 1024, undefined, true);
    const configuredPath = initialEnv.PATH;
    if (!configuredPath || executable("node", configuredPath) !== NODE) fail("BOOTSTRAP_CONTEXT_REFUSED");
    const initialGit = executable("git", configuredPath);
    // Pin the actual executable found in both configurations; no ambient git redirection.
    phase = "BOOTSTRAP_M_REFUSED";
    const head = git(["rev-parse", "--verify", "HEAD"]).toString("utf8").trim();
    if (!/^[a-f0-9]{40}$/.test(head) || head === TARGET_SHA || path.basename(maintenanceRoot) !== `setfarm-${head.slice(0, 8)}`
      || git(["branch", "--show-current"]).toString("utf8") !== "main\n"
      || git(["rev-parse", "--verify", "refs/remotes/origin/main"]).toString("utf8") !== `${head}\n`) fail(phase);
    const scriptBytes = launch.read(path.join(maintenanceRoot, SCRIPT), 16 * 1024 * 1024, device);
    if (!scriptBytes.equals(git(["show", `${head}:${SCRIPT}`]))) fail(phase);
    const bytes = launch.read(path.join(maintenanceRoot, PROFILE), 64 * 1024, device);
    if (!bytes.equals(git(["show", `${head}:${PROFILE}`]))) fail(phase);
    profile = JSON.parse(bytes.toString("utf8")); profileHash = hash(bytes);
    if (profile.schema !== "setfarm.manual-orphan-target-dependencies.v1" || profile.platform !== process.platform
      || profile.arch !== process.arch || profile.target.sourceSha !== TARGET_SHA) fail("BOOTSTRAP_DEPENDENCY_REFUSED");
    // The fixed retention script has only node: imports and an exact direct-entry
    // guard. Its bytes are Git-bound above; no retained selection function is called.
    return Object.freeze({ maintenanceRoot, targetRoot, installationDirectory,
      get dependencyProfileHash(): string { return profileHash; },
      async admitMaintenance(): Promise<SourceIdentity> {
        if (admittedM || admittedT || selected) fail("BOOTSTRAP_M_REFUSED");
        try {
          check();
          const script = await import(pathToFileURL(path.join(maintenanceRoot, SCRIPT)).href) as { holdCurrentFinalizedSetfarmSourceBuildV1(): HeldBuild };
          check();
          try { heldBuild = script.holdCurrentFinalizedSetfarmSourceBuildV1(); }
          catch {
            // This legacy holder has no separate acquisition-cleanup receipt.
            // An acquisition exception cannot confirm its internally held FDs closed.
            cleanupUncertain = true; fail("BOOTSTRAP_CLEANUP_UNKNOWN");
          }
          const maintenanceBuild = heldBuild;
          if (!maintenanceBuild) fail("BOOTSTRAP_M_REFUSED");
          check();
          if (maintenanceBuild.observation.buildSource.sha !== head) fail("BOOTSTRAP_M_REFUSED");
          const workspaceApi = await import(pathToFileURL(path.join(maintenanceRoot,
            "dist/internal-production/baseline-workspace-authority-path-v1.js")).href) as {
              resolveInternalProductionBaselineWorkspaceRootV1(): string;
              authenticateInternalProductionBaselineWorkspaceAnchorV1(): { assertStable(): void; close(): void };
            };
          check();
          if (physicalAccountPath(workspaceApi.resolveInternalProductionBaselineWorkspaceRootV1()) !== workspace) fail("BOOTSTRAP_CONTEXT_REFUSED");
          try { workspaceAnchor = workspaceApi.authenticateInternalProductionBaselineWorkspaceAnchorV1(); }
          catch { cleanupUncertain = true; fail("BOOTSTRAP_CLEANUP_UNKNOWN"); }
          check();
          phase = "BOOTSTRAP_DEPENDENCY_REFUSED";
          const closure = profile.maintenanceObserver.sourceClosure;
          if (!Array.isArray(closure) || closure.length !== 121 || new Set(closure.map(item => item.locator)).size !== closure.length) fail();
          for (const item of closure) {
            if (!locator(item.locator) || !item.locator.startsWith("src/") || !item.locator.endsWith(".ts")
              || hash(maintenance.read(path.join(maintenanceRoot, item.locator), 16 * 1024 * 1024, device)) !== item.sha256) fail();
          }
          if (profile.maintenanceObserver.resolution.length !== 12
            || profile.maintenanceObserver.resolution.reduce((sum, group) => sum + group.members.length, 0) !== 79) fail();
          packages(maintenance, maintenanceRoot, profile, profile.maintenanceObserver.resolution, profile.maintenanceObserver.absences, check);
          admittedM = true; phase = "BOOTSTRAP_M_REFUSED"; check();
          return maintenanceBuild.observation.buildSource;
        } catch (error) { invalid = true; throw sanitize(error, phase); }
      },
      async admitTarget(): Promise<SourceIdentity> {
        if (!admittedM || admittedT || selected) fail("BOOTSTRAP_TARGET_REFUSED");
        try {
          phase = "BOOTSTRAP_TARGET_REFUSED"; check();
          if (target.hold(targetRoot).dev !== device || realpathSync(targetRoot) !== targetRoot) fail(phase);
          for (const [name, expected] of Object.entries(profile.target.metadata)) {
            if (!["BUILD_INFO.json", "PLATFORM_BUILD_OUTPUT_TREE.json", "PLATFORM_RELEASE_MANIFEST.json"].includes(name)
              || hash(target.read(path.join(targetRoot, "dist", name), 4 * 1024 * 1024, device)) !== expected) fail(phase);
          }
          if (Object.keys(profile.target.metadata).length !== 3) fail(phase);
          const output = JSON.parse(target.read(path.join(targetRoot, "dist/PLATFORM_BUILD_OUTPUT_TREE.json"), 4 * 1024 * 1024, device).toString("utf8"));
          if (output.sourceSha !== TARGET_SHA || output.sourceTreeHash !== profile.target.sourceTreeHash
            || output.outputTreeHash !== profile.target.outputTreeHash || !Array.isArray(output.entries) || output.entries.length > 10000) fail(phase);
          let bytes = 0; const entries = new Set<string>();
          for (const entry of output.entries) {
            if (!locator(entry.locator) || !entry.locator.startsWith("dist/") || entries.has(entry.locator)) fail(phase);
            entries.add(entry.locator);
            const file = target.read(path.join(targetRoot, entry.locator), 33554432, device); bytes += file.length;
            if (bytes > 536870912 || file.length !== entry.byteLength || hash(file) !== entry.sha256
              || Number(lstatSync(path.join(targetRoot, entry.locator), { bigint: true }).mode & 0o7777n) !== entry.mode) fail(phase);
          }
          const expectedOutput = new Set([...entries, ...Object.keys(profile.target.metadata).map(name => `dist/${name}`)]);
          const actualOutput = new Set<string>(); let visited = 0;
          const walkOutput = (relative: string, depth: number): void => {
            if (depth > 64) fail(phase);
            const directory = path.join(targetRoot, relative), stat = target.hold(directory, true);
            if (stat.dev !== device || (stat.mode & 0o7777n) !== 0o755n) fail(phase);
            for (const name of readdirSync(directory)) {
              if (++visited > 10000 || !/^[A-Za-z0-9._-]+$/.test(name)) fail(phase);
              const child = `${relative}/${name}`, childStat = lstatSync(path.join(targetRoot, child), { bigint: true });
              if (childStat.isSymbolicLink()) fail(phase);
              if (childStat.isDirectory()) walkOutput(child, depth + 1);
              else if (childStat.isFile() && expectedOutput.has(child)) actualOutput.add(child);
              else fail(phase);
            }
          };
          walkOutput("dist", 0);
          if (actualOutput.size !== expectedOutput.size) fail(phase);
          if (hash(target.read(path.join(targetRoot, "package-lock.json"), 16 * 1024 * 1024, device)) !== profile.target.lockSha256) fail(phase);
          // Authenticate package scope bytes to the fixed historical Source object,
          // not merely to current installed bytes or a name/version claim.
          const rootPackage = target.read(path.join(targetRoot, "package.json"), 1024 * 1024, device);
          if (!rootPackage.equals(git(["-C", targetRoot, "show", `${TARGET_SHA}:package.json`]))) fail(phase);
          // Fixed T's builtin-only script is authenticated before evaluation. Its
          // noarg holder derives T from its own physical module, retaining the
          // complete tracked Source/build-input set as well as finalized output.
          const targetScriptBytes = target.read(path.join(targetRoot, SCRIPT), 16 * 1024 * 1024, device);
          if (git(["-C", targetRoot, "rev-parse", "--verify", `${TARGET_SHA}^{tree}`]).toString("utf8") !== `${profile.target.sourceTreeHash}\n`
            || !targetScriptBytes.equals(git(["-C", targetRoot, "show", `${TARGET_SHA}:${SCRIPT}`]))) fail(phase);
          check();
          const targetScript: unknown = await import(pathToFileURL(path.join(targetRoot, SCRIPT)).href);
          check();
          if (targetScript === null || typeof targetScript !== "object"
            || !("holdCurrentFinalizedSetfarmSourceBuildV1" in targetScript)
            || typeof targetScript.holdCurrentFinalizedSetfarmSourceBuildV1 !== "function") fail(phase);
          let targetBuild: HeldBuild;
          try {
            const acquired: unknown = targetScript.holdCurrentFinalizedSetfarmSourceBuildV1();
            if (!isHeldBuild(acquired)) {
              cleanupUncertain = true; fail("BOOTSTRAP_CLEANUP_UNKNOWN");
            }
            heldTargetBuild = acquired; // Outer cleanup owns it before further checks.
            targetBuild = acquired;
          } catch {
            // As with M, this stock holder has no acquisition-cleanup receipt.
            cleanupUncertain = true; fail("BOOTSTRAP_CLEANUP_UNKNOWN");
          }
          check();
          if (targetBuild.observation.buildSource.sha !== TARGET_SHA
            || targetBuild.observation.buildSource.treeHash !== profile.target.sourceTreeHash) fail(phase);
          // The metadata/output identity above is fixed, and this independently
          // acquired holder binds that same physical output to current T inputs.
          phase = "BOOTSTRAP_DEPENDENCY_REFUSED";
          if (profile.targetResolution.length !== 14 || profile.targetResolution.reduce((sum, group) => sum + group.members.length, 0) !== 82
            || profile.targetAbsences.length !== 29) fail();
          packages(targetDependencies, targetRoot, profile, profile.targetResolution, profile.targetAbsences, check);
          phase = "BOOTSTRAP_TARGET_REFUSED";
          if (target.hold(installationDirectory).dev !== device || realpathSync(installationDirectory) !== installationDirectory
            || (lstatSync(installationDirectory, { bigint: true }).mode & 0o7777n) !== 0o700n) fail(phase);
          // Existing record readers still validate private contents. Our independent
          // stable pins keep the exact record path identities through all awaits.
          let privateRecordBytes = 0;
          for (const name of ["planned.json", "owner-created.json", "runtime-created.json", "database-created.json", "runtime-credentials.json",
            "schema-prepared.json", "schema-committed.json", "activation-prepared.json", "activated.json"]) {
            const filename = path.join(installationDirectory, name);
            privateRecordBytes += target.read(filename, name === "runtime-credentials.json" ? 4096 : 32768, device).length;
            if (privateRecordBytes > 256 * 1024) fail(phase);
            if ((lstatSync(filename, { bigint: true }).mode & 0o7777n) !== 0o600n) fail(phase);
          }
          check(); admittedT = true;
          return targetBuild.observation.buildSource;
        } catch (error) { invalid = true; throw sanitize(error, phase); }
      },
      async selectTarget(): Promise<void> {
        if (!admittedM || !admittedT || selected) fail("BOOTSTRAP_CONTEXT_REFUSED");
        check();
        // This helper is builtin-only and already covered by the complete held M build.
        const normalizer = await import(pathToFileURL(path.join(maintenanceRoot, "dist/internal-production/baseline-spawner-launch-environment-v1.js")).href) as
          { normalizeRuntimePathV1(configured: string, home: string, executable: string): string };
        check();
        effectivePath = normalizer.normalizeRuntimePathV1(configuredPath, account.homedir, NODE);
        if (executable("node", effectivePath) !== NODE || executable("git", effectivePath) !== initialGit) fail("BOOTSTRAP_CONTEXT_REFUSED");
        process.env.PATH = effectivePath;
        process.env.SETFARM_INSTALLATION_DIR = installationDirectory;
        selected = true; check();
      },
      recheck: check,
      close,
    });
  } catch (error) {
    invalid = true;
    try { close(); } catch { fail("BOOTSTRAP_CLEANUP_UNKNOWN"); }
    if (error instanceof Error && /^BOOTSTRAP_(?:CONTEXT|M|TARGET|DEPENDENCY)_REFUSED$/.test(error.message)) throw new Error(error.message);
    fail(phase);
  }
}
