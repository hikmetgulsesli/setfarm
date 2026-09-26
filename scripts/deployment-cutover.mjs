#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { types } from "node:util";
import * as nodeModule from "node:module";
const { registerHooks, isBuiltin } = nodeModule;

// Trusted fresh entry: launch with a trusted Node executable and sanitized
// environment, without preloads. In-entry checks cannot undo prior preload code.
// Diagnostic only: never acquire ownership, publish intent, or operate services.
const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const closure = ["scripts/build-generation-maintenance-journal.mjs", "scripts/build-generation-maintenance-owner-observer.mjs",
  "scripts/build-generation-retention.mjs", "scripts/deployment-cutover-owner.mjs", "scripts/deployment-cutover.mjs", "scripts/deployment-cutover-dependencies.mjs",
  "scripts/deployment-cutover-retained-profile.mjs", "scripts/deployment-cutover-retained-profile.v1.json",
  "scripts/deployment-cutover-default-context.mjs",
  "scripts/deployment-cutover-passive-home.mjs", "scripts/deployment-cutover-passive-home.py"];
const passiveSourceUrl = pathToFileURL(path.join(root, "scripts/deployment-cutover-passive-home.py")).href;
const directoryKeys = ["dev", "ino", "uid", "gid", "mode", "birthtimeNs"];
const fileKeys = [...directoryKeys, "nlink", "size", "mtimeNs", "ctimeNs"];
const fail = () => { throw Error("DEPLOYMENT_CUTOVER_BOOTSTRAP_REFUSED"); };
let refusal = { scope: "bootstrap", stage: "entry", ownerContext: null, launcherStage: null, cleanupFailed: false };
const stage = value => { refusal = { scope: "bootstrap", stage: value, ownerContext: null, launcherStage: null, cleanupFailed: false }; };
function ownerRefusal(error) {
  try {
    const descriptor = Object.getOwnPropertyDescriptor(error, "cutoverRefusal");
    if (!descriptor || !Object.hasOwn(descriptor, "value")) return null;
    const value = descriptor.value;
    if (!value || Object.getPrototypeOf(value) !== Object.prototype) return null;
    const fields = Object.getOwnPropertyDescriptors(value), keys = Reflect.ownKeys(fields);
    if (keys.length !== 5 || !["scope", "stage", "ownerContext", "launcherStage", "cleanupFailed"].every(key => keys.includes(key) && Object.hasOwn(fields[key], "value"))) return null;
    const scope = fields.scope.value, phase = fields.stage.value, ownerContext = fields.ownerContext.value,
      launcherStage = fields.launcherStage.value, cleanupFailed = fields.cleanupFailed.value;
    const checking = ["crossbind", "prequalify", "postqualify", "postcensus", "final-recheck"].includes(phase);
    if (scope !== "default-owner" || !["entry", "account", "acquire-selected", "acquire-retained", "acquire-absence", "acquire-launcher", "acquire-helper", "acquire-phase", "crossbind",
      "resolve", "prequalify", "resolution-bind", "qualify", "postqualify", "census", "postcensus", "census-shape", "final-recheck", "cleanup"].includes(phase)
      || (checking ? !["account", "selected", "retained", "absence", "launcher", "helper", "phase", "bind"].includes(ownerContext) : ownerContext !== null)
      || (typeof cleanupFailed !== "boolean" && !(cleanupFailed === null && ["acquire-selected", "acquire-retained", "acquire-absence", "acquire-launcher", "acquire-helper", "acquire-phase"].includes(phase)))
      || (launcherStage !== null && (phase !== "qualify" || !["precheck", "baseline", "transport", "waiting",
        "sampled-identity", "sampled-snapshot", "sampled-generation", "sampled-native", "sampled-bind", "sampled-postcheck",
        "identity", "pid-recheck", "measure", "measurement-bind", "settling", "idle"].includes(launcherStage)))) return null;
    return { scope, stage: phase, ownerContext, launcherStage, cleanupFailed };
  } catch { return null; }
}
function pre32FailurePhase(error) {
  try {
    if (types.isProxy(error) || Object.getPrototypeOf(error) !== Error.prototype || !Object.isFrozen(error)) return "unknown";
    const descriptors = Object.getOwnPropertyDescriptors(error), keys = Reflect.ownKeys(descriptors);
    if (keys.some(key => typeof key !== "string" || !["stack", "message", "pre32PairPhase", "pre32PhysicalPoint"].includes(key))) return "unknown";
    const message = descriptors.message, phase = descriptors.pre32PairPhase;
    if (!message || !Object.hasOwn(message, "value")
      || message.value !== "INTERNAL_PRODUCTION_POSITIVE_WORKTREE_PRE32_HOST_PAIR_INVALID"
      || !phase || !Object.hasOwn(phase, "value") || phase.enumerable || phase.configurable || phase.writable) return "unknown";
    const allowed = ["launcher-load", "launcher-acquire", "passive-qualification", "pre-physical-recheck",
      "physical-first-pass", "database-callback", "physical-second-pass", "pair-validation",
      "post-pair-recheck", "launcher-cleanup"];
    return allowed.includes(phase.value) ? phase.value : "unknown";
  } catch { return "unknown"; }
}
function activeBindingFailurePhase(error) {
  try {
    if (types.isProxy(error) || Object.getPrototypeOf(error) !== Error.prototype || !Object.isFrozen(error)) return "unknown";
    const descriptors = Object.getOwnPropertyDescriptors(error), keys = Reflect.ownKeys(descriptors);
    if (keys.some(key => typeof key !== "string" || !["stack", "message", "activeBindingPairPhase", "activeBindingPhysicalPoint"].includes(key))) return "unknown";
    const message = descriptors.message, phase = descriptors.activeBindingPairPhase;
    if (!message || !Object.hasOwn(message, "value")
      || message.value !== "INTERNAL_PRODUCTION_POSITIVE_WORKTREE_ACTIVE_BINDING_HOST_PAIR_INVALID"
      || !phase || !Object.hasOwn(phase, "value") || phase.enumerable || phase.configurable || phase.writable) return "unknown";
    const allowed = ["launcher-load", "launcher-acquire", "passive-qualification", "pre-physical-recheck",
      "physical-first-pass", "database-callback", "physical-second-pass", "pair-validation",
      "post-pair-recheck", "launcher-cleanup"];
    return allowed.includes(phase.value) ? phase.value : "unknown";
  } catch { return "unknown"; }
}
function pre32PhysicalPoint(error, phase, field = "pre32PhysicalPoint") {
  if (phase !== "physical-first-pass" && phase !== "physical-second-pass") return null;
  try {
    const descriptor = Object.getOwnPropertyDescriptor(error, field);
    if (!descriptor || !Object.hasOwn(descriptor, "value")
      || descriptor.enumerable || descriptor.configurable || descriptor.writable) return null;
    const point = descriptor.value;
    if (point === null || typeof point !== "object" || types.isProxy(point)
      || Object.getPrototypeOf(point) !== Object.prototype || !Object.isFrozen(point)) return null;
    const fields = Object.getOwnPropertyDescriptors(point), keys = Reflect.ownKeys(fields);
    if (keys.length !== 3 || keys.some(key => typeof key !== "string"
      || !["schema", "operation", "candidateOrdinal"].includes(key)
      || !fields[key].enumerable || !Object.hasOwn(fields[key], "value"))) return null;
    const operation = fields.operation.value, ordinal = fields.candidateOrdinal.value;
    const candidate = ["candidate-git", "candidate-lsof", "candidate-record", "candidate-recheck-git",
      "candidate-recheck-lsof", "candidate-recheck-compare"].includes(operation);
    const firstPass = ["scope-hold", "base-discovery", "parent-git", "candidate-git", "candidate-lsof",
      "candidate-record", "first-pass-recheck"];
    const secondPass = ["post-database-stability", "parent-recheck", "candidate-recheck-git",
      "candidate-recheck-lsof", "candidate-recheck-compare", "result"];
    if (fields.schema.value !== "setfarm.internal-production-positive-worktree-physical-refusal-point.v1"
      || !(phase === "physical-first-pass" ? firstPass : secondPass).includes(operation)
      || (candidate ? !Number.isInteger(ordinal) || ordinal < 0 || ordinal >= 256 : ordinal !== null)) return null;
    return point;
  } catch { return null; }
}
const hash = bytes => createHash("sha256").update(bytes).digest("hex");
const canonical = value => value === null || typeof value !== "object" ? JSON.stringify(value)
  : Array.isArray(value) ? `[${value.map(canonical).join(",")}]`
    : `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`;
// A checked hash is insufficient if JSON.stringify can later invoke an
// inherited toJSON, an array accessor, or a proxy trap on the emitted tree.
function plainFrozenTree(value, seen = new Set()) {
  if (value === null || ["string", "boolean"].includes(typeof value)) return true;
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value !== "object" || types.isProxy(value) || !Object.isFrozen(value)) return false;
  if (seen.has(value)) return true;
  seen.add(value);
  const array = Array.isArray(value);
  if (Object.getPrototypeOf(value) !== (array ? Array.prototype : Object.prototype)) return false;
  const descriptors = Object.getOwnPropertyDescriptors(value), keys = Reflect.ownKeys(descriptors);
  if (array) {
    if (keys.length !== value.length + 1 || !Object.hasOwn(descriptors, "length")
      || !Object.hasOwn(descriptors.length, "value") || descriptors.length.value !== value.length) return false;
    for (let index = 0; index < value.length; index++) {
      const descriptor = descriptors[index];
      if (!descriptor || !descriptor.enumerable || !Object.hasOwn(descriptor, "value")
        || !plainFrozenTree(descriptor.value, seen)) return false;
    }
    return true;
  }
  return keys.every(key => typeof key === "string" && descriptors[key].enumerable
    && Object.hasOwn(descriptors[key], "value") && plainFrozenTree(descriptors[key].value, seen));
}
const same = (left, right, keys) => keys.every(key => left[key] === right[key]);
const gitEnvironment = { PATH: "/usr/bin:/bin", LANG: "C", LC_ALL: "C", GIT_CONFIG_NOSYSTEM: "1", GIT_CONFIG_GLOBAL: "/dev/null",
  GIT_NO_REPLACE_OBJECTS: "1", GIT_OPTIONAL_LOCKS: "0", GIT_TERMINAL_PROMPT: "0" };
function git(args, statuses = [0]) {
  const result = spawnSync("/usr/bin/git", ["-c", "core.hooksPath=/dev/null", "-c", "core.fsmonitor=false", ...args], {
    cwd: root, env: gitEnvironment, shell: false, timeout: 10000, maxBuffer: 33554432, stdio: ["ignore", "pipe", "pipe"],
  });
  if (result.error || result.signal || !statuses.includes(result.status) || result.stderr.length) fail(); return result;
}
function line(args) {
  const bytes = git(args).stdout, text = bytes.toString("utf8");
  if (!Buffer.from(text).equals(bytes) || !/^[^\r\n\0]+\n$/.test(text)) fail(); return text.slice(0, -1);
}
function sourceState() {
  const includes = git(["config", "--local", "--no-includes", "--name-only", "--get-regexp", "^include"], [1]);
  if (includes.stdout.length || line(["config", "--local", "--no-includes", "--get-all", "remote.origin.url"]) !== "https://github.com/hikmetgulsesli/setfarm.git"
    || line(["rev-parse", "--show-toplevel"]) !== root || line(["branch", "--show-current"]) !== "main"
    || git(["status", "--porcelain=v2", "--untracked-files=all"]).stdout.length) fail();
  const sha = line(["rev-parse", "--verify", "HEAD^{commit}"]), treeHash = line(["rev-parse", "--verify", "HEAD^{tree}"]);
  if (!/^[a-f0-9]{40}$/.test(sha) || !/^[a-f0-9]{40}$/.test(treeHash) || line(["rev-parse", "--verify", "refs/remotes/origin/main^{commit}"]) !== sha) fail();
  const bytes = git(["ls-tree", "-r", "-z", "--full-tree", sha]).stdout, text = bytes.toString("utf8");
  if (!Buffer.from(text).equals(bytes) || !text.endsWith("\0")) fail();
  const entries = text.slice(0, -1).split("\0").map(row => {
    const match = /^(100644|100755) blob ([a-f0-9]{40})\t([^\r\n\0]+)$/.exec(row); if (!match) fail();
    return { locator: match[3], gitMode: match[1], gitBlobHash: match[2] };
  }).sort((a, b) => Buffer.compare(Buffer.from(a.locator), Buffer.from(b.locator)));
  if (entries.length > 10000) fail();
  return { sha, treeHash, entries, buildInputSetHash: hash(canonical({ schema: "setfarm.internal-production-pinned-build-input-set.v1", sourceSha: sha, sourceTreeHash: treeHash, entries })) };
}
async function inspect() {
  if (typeof registerHooks !== "function" || process.execArgv.length || process.argv.length !== 4
    || !["inspect", "inspect-host", "inspect-database", "inspect-envfiles", "inspect-helpers", "inspect-retained-profile", "inspect-default-context", "inspect-pre32-host-pair", "inspect-pre32-host-pair-v5", "inspect-pre32-host-pair-v6", "inspect-pre32-host-pair-v7", "inspect-pre32-absence-annotation-v1", "inspect-pre32-absence-annotation-v2", "inspect-pre32-residual-absence-annotation-v3", "inspect-active-binding-host-pair-v1", "inspect-held-binding-candidates-v1"].includes(process.argv[2]) || process.argv[3] !== "--json"
    || pathToFileURL(path.resolve(process.argv[1])).href !== import.meta.url
    || Object.keys(process.env).some(key => !["PATH", "LANG", "LC_ALL", "TZ"].includes(key)
      && !(process.platform === "darwin" && key === "__CF_USER_TEXT_ENCODING"))) fail();
  const pins = [], directories = new Set(), files = new Map(), dependencyEntries = new Map(), executableFiles = new Set();
  let invalid = false, result, totalBytes = 0;
  try {
    stage("source-authentication");
    const check = () => {
      for (const pin of pins) if (!same(pin.stat, fs.fstatSync(pin.fd, { bigint: true }), directoryKeys)
        || !same(pin.stat, fs.lstatSync(pin.target, { bigint: true }), directoryKeys)) fail();
      for (const entry of files.values()) if (!same(entry.stat, fs.lstatSync(entry.target, { bigint: true }), fileKeys)) fail();
    };
    const hold = directory => {
      const segments = directory.split(path.sep).filter(Boolean); if (segments.length > 128) fail();
      for (let index = 0; index <= segments.length; index++) {
        const target = path.join(path.parse(root).root, ...segments.slice(0, index)); if (directories.has(target)) continue;
        check(); const stat = fs.lstatSync(target, { bigint: true });
        if (!stat.isDirectory() || stat.isSymbolicLink()) fail();
        const fd = fs.openSync(target, fs.constants.O_RDONLY | fs.constants.O_DIRECTORY | fs.constants.O_NOFOLLOW);
        pins.push({ target, stat, fd }); directories.add(target); check();
        if ((target === root || target.startsWith(`${root}/`)) && (stat.uid !== BigInt(process.getuid()) || (stat.mode & 0o022n))) fail();
      }
    };
    hold(root); const device = pins.at(-1).stat.dev;
    const snapshot = locator => {
      if (typeof locator !== "string" || path.posix.normalize(locator) !== locator || path.isAbsolute(locator)
        || locator.split("/").some(part => !/^[A-Za-z0-9._-]+$/.test(part) || part === ".." || part === ".")) fail();
      const target = path.join(root, locator), url = pathToFileURL(target).href;
      if (files.has(url)) { check(); return files.get(url); }
      hold(path.dirname(target)); check();
      const fd = fs.openSync(target, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW | fs.constants.O_NONBLOCK);
      let entry;
      try {
        const stat = fs.fstatSync(fd, { bigint: true });
        if (!stat.isFile() || stat.uid !== BigInt(process.getuid()) || stat.dev !== device || (stat.mode & 0o022n)
          || stat.nlink !== 1n || stat.size < 1n || stat.size > 33554432n) fail();
        const buffer = Buffer.alloc(Number(stat.size) + 1);
        let count = 0;
        while (count < buffer.length) {
          const size = fs.readSync(fd, buffer, count, buffer.length - count, count);
          if (size === 0) break;
          count += size;
        }
        if (BigInt(count) !== stat.size || !same(stat, fs.fstatSync(fd, { bigint: true }), fileKeys)
          || !same(stat, fs.lstatSync(target, { bigint: true }), fileKeys)) fail();
        totalBytes += count; if (totalBytes > 536870912) fail();
        entry = { target, stat, bytes: Buffer.from(buffer.subarray(0, count)), locator };
      } finally { fs.closeSync(fd); }
      files.set(url, entry); check(); return entry;
    };
    const initial = sourceState();
    for (const locator of [...closure, "package-lock.json"]) {
      const tracked = initial.entries.find(entry => entry.locator === locator); if (!tracked) fail();
      const observed = snapshot(locator), declared = tracked.gitMode === "100755" ? 0o755n : 0o644n;
      if ((observed.stat.mode & 0o7777n & ~declared) || !observed.bytes.equals(git(["cat-file", "blob", tracked.gitBlobHash]).stdout)) fail();
      if (closure.includes(locator) && locator.endsWith(".mjs")) executableFiles.add(pathToFileURL(observed.target).href);
    }
    // All non-builtin evaluation uses owned bytes authenticated before import.
    // Native pathname re-reading is deliberately not the source of module bytes.
    registerHooks({
      resolve(specifier, context, nextResolve) {
        if (isBuiltin(specifier)) return nextResolve(specifier, context);
        if (dependencyEntries.has(specifier)) return { url: dependencyEntries.get(specifier), shortCircuit: true };
        if (!specifier.startsWith("./") && !specifier.startsWith("../") && !specifier.startsWith("file:")) fail();
        const resolved = new URL(specifier, context.parentURL);
        if (resolved.search || resolved.hash || (!executableFiles.has(resolved.href) && resolved.href !== passiveSourceUrl)) fail();
        return { url: resolved.href, shortCircuit: true };
      },
      load(url, context, nextLoad) {
        if (isBuiltin(url)) return nextLoad(url, context);
        const entry = files.get(url); if (!entry) fail();
        if (url === passiveSourceUrl) {
          check();
          const source = entry.bytes.toString("utf8");
          if (entry.bytes.length > 131072 || !Buffer.from(source).equals(entry.bytes)) fail();
          // Data only: transport receives owned Git-authenticated bytes, never a
          // pathname to re-read or a caller-supplied source registration hook.
          return { format: "module", source: `export default ${JSON.stringify(source)};`, shortCircuit: true };
        }
        if (!executableFiles.has(url)) fail();
        check(); return { format: "module", source: Buffer.from(entry.bytes), shortCircuit: true };
      },
    });
    stage("source-build");
    const verifier = await import("./build-generation-retention.mjs");
    const sourceBuild = verifier.observeCurrentFinalizedSetfarmSourceBuildV1(); check();
    if (sourceBuild.sha !== initial.sha || sourceBuild.treeHash !== initial.treeHash) fail();
    const info = JSON.parse(snapshot("dist/BUILD_INFO.json").bytes), output = JSON.parse(snapshot("dist/PLATFORM_BUILD_OUTPUT_TREE.json").bytes),
      manifest = JSON.parse(snapshot("dist/PLATFORM_RELEASE_MANIFEST.json").bytes);
    if (!Array.isArray(output.entries) || output.entries.length > 10000) fail();
    const projection = { schema: output.schema, sourceSha: output.sourceSha, sourceTreeHash: output.sourceTreeHash, entries: output.entries };
    if (hash(canonical(projection)) !== output.outputTreeHash) fail();
    const stableBuildInfo = { schema: "setfarm.internal-production-stable-setfarm-build-info.v1", sha: info.sha, shortSha: info.shortSha,
      branch: info.branch, dirty: info.dirty, packageVersion: info.packageVersion, displayVersion: info.displayVersion };
    if (hash(canonical({ schema: "setfarm.internal-production-controller-build.v1", stableBuildInfo, buildInputSetHash: initial.buildInputSetHash,
      outputTreeHash: output.outputTreeHash, releaseManifestHash: hash(canonical(manifest)) })) !== sourceBuild.buildHash) fail();
    for (const entry of output.entries) {
      if (!entry.locator.startsWith("dist/")) fail();
      const observed = snapshot(entry.locator);
      if (hash(observed.bytes) !== entry.sha256 || observed.bytes.length !== entry.byteLength || Number(observed.stat.mode & 0o7777n) !== entry.mode) fail();
      if (/\.(?:mjs|js)$/.test(entry.locator)) executableFiles.add(pathToFileURL(observed.target).href);
    }
    if (canonical(sourceState()) !== canonical(initial) || canonical(verifier.observeCurrentFinalizedSetfarmSourceBuildV1()) !== canonical(sourceBuild)) fail();
    check();
    stage("dependencies");
    const dependencies = await import("./deployment-cutover-dependencies.mjs");
    const archives = dependencies.readCutoverDependencyArchivesV1();
    for (const dependency of archives.packages) {
      for (const member of dependency.members) {
        const observed = snapshot(member.locator);
        if (!observed.bytes.equals(member.bytes)) fail();
        // Postgres also ships CommonJS .js files in cjs/src; byte identity is
        // necessary but does not grant those members ESM execution authority.
        if (/^node_modules\/postgres\/src\/.*\.js$/.test(member.locator)
          || /^node_modules\/zod\/.*\.js$/.test(member.locator)) executableFiles.add(pathToFileURL(observed.target).href);
      }
      const entry = pathToFileURL(path.join(root, dependency.entryLocator)).href;
      if (!executableFiles.has(entry)) fail();
      dependencyEntries.set(dependency.name, entry);
    }
    check();
    stage("controller-source");
    const owner = await import("./deployment-cutover-owner.mjs");
    const authority = await owner.observeDeploymentCutoverOwnerControllerSourceV1();
    let host, envFiles, helpers, retainedProfile, defaultContext, pre32HostPair, pre32HostPairV5, pre32HostPairV6, pre32HostPairV7, pre32AbsenceAnnotationV1, pre32AbsenceAnnotationV2, pre32ResidualAbsenceAnnotationV3, activeBindingHostPairV1, heldBindingCandidatesV1;
    if (process.argv[2] === "inspect-default-context") {
      stage("default-owner-load");
      const contextModule = await import("./deployment-cutover-default-context.mjs");
      check(); stage("default-context"); defaultContext = await contextModule.observeDeploymentCutoverDefaultContextV1();
      stage("post-context"); check();
    }
    if (["inspect-pre32-host-pair", "inspect-pre32-host-pair-v5", "inspect-pre32-host-pair-v6", "inspect-pre32-host-pair-v7"].includes(process.argv[2])) {
      const v5 = process.argv[2] === "inspect-pre32-host-pair-v5";
      const v6 = process.argv[2] === "inspect-pre32-host-pair-v6";
      const v7 = process.argv[2] === "inspect-pre32-host-pair-v7";
      stage("pre32-host-pair-load");
      const pairModule = await import("../dist/internal-production/baseline-positive-worktree-host-pair-v2.js");
      check(); stage("pre32-host-pair");
      const observed = v7 ? await pairModule.observeCodeOwnedPositiveWorktreePre32HostPairV7()
        : v6 ? await pairModule.observeCodeOwnedPositiveWorktreePre32HostPairV6()
        : v5 ? await pairModule.observeCodeOwnedPositiveWorktreePre32HostPairV5()
          : await pairModule.observeCodeOwnedPositiveWorktreePre32HostPairV4();
      const descriptors = observed && Object.getOwnPropertyDescriptors(observed);
      const keys = descriptors && Reflect.ownKeys(descriptors);
      const expected = ["schema", "authority", "physicalIdentityProvenance", "heldPair", "pre32Database", "pairHash"];
      if (!Object.isFrozen(observed) || !keys || keys.length !== expected.length
        || keys.some(key => typeof key !== "string" || !expected.includes(key)
          || !descriptors[key].enumerable || !Object.hasOwn(descriptors[key], "value"))) fail();
      const fields = Object.fromEntries(expected.map(key => [key, descriptors[key].value]));
      if (fields.schema !== (v7 ? "setfarm.internal-production-pre32-physical-database-pair.v7"
        : v6 ? "setfarm.internal-production-pre32-physical-database-pair.v6"
        : v5 ? "setfarm.internal-production-pre32-physical-database-pair.v5"
          : "setfarm.internal-production-pre32-physical-database-pair.v4")
        || fields.authority !== "diagnostic-only" || fields.physicalIdentityProvenance !== "unverified"
        || !Object.isFrozen(fields.heldPair) || !Object.isFrozen(fields.pre32Database)
        || (v7 && (fields.pre32Database.schema !== "setfarm.internal-production-pre32-active-binding-snapshot.v7"
          || fields.pre32Database.authority !== "diagnostic-only"
          || fields.pre32Database.tableLockScope !== "fixed-pre32-legacy-superset"
          || fields.pre32Database.journalIdentity !== "source-ordinal-name-checksum-state-1-through-31"
          || fields.pre32Database.lockState !== "released-at-return"))
        || typeof fields.pairHash !== "string" || !/^[a-f0-9]{64}$/.test(fields.pairHash)
        || hash(canonical({ schema: fields.schema, authority: fields.authority,
          physicalIdentityProvenance: fields.physicalIdentityProvenance,
          heldPair: fields.heldPair, pre32Database: fields.pre32Database })) !== fields.pairHash) fail();
      if (v7) pre32HostPairV7 = observed;
      else if (v6) pre32HostPairV6 = observed;
      else if (v5) pre32HostPairV5 = observed;
      else pre32HostPair = observed;
      stage("post-pre32-host-pair"); check();
    }
    if (process.argv[2] === "inspect-active-binding-host-pair-v1") {
      stage("active-binding-host-pair-load");
      const pairModule = await import("../dist/internal-production/baseline-positive-worktree-host-pair-v2.js");
      check(); stage("active-binding-host-pair");
      const observed = await pairModule.observeCodeOwnedPositiveWorktreeActiveBindingHostPairV1();
      const descriptors = observed && Object.getOwnPropertyDescriptors(observed);
      const keys = descriptors && Reflect.ownKeys(descriptors);
      const expected = ["schema", "authority", "physicalIdentityProvenance", "heldPair", "activeBindingDatabase", "pairHash"];
      if (!Object.isFrozen(observed) || !keys || keys.length !== expected.length
        || keys.some(key => typeof key !== "string" || !expected.includes(key)
          || !descriptors[key].enumerable || !Object.hasOwn(descriptors[key], "value"))) fail();
      const fields = Object.fromEntries(expected.map(key => [key, descriptors[key].value]));
      if (fields.schema !== "setfarm.internal-production-active-binding-physical-database-pair.v1"
        || fields.authority !== "diagnostic-only" || fields.physicalIdentityProvenance !== "unverified"
        || !Object.isFrozen(fields.heldPair) || !Object.isFrozen(fields.activeBindingDatabase)
        || typeof fields.pairHash !== "string" || !/^[a-f0-9]{64}$/.test(fields.pairHash)
        || hash(canonical({ schema: fields.schema, authority: fields.authority,
          physicalIdentityProvenance: fields.physicalIdentityProvenance,
          heldPair: fields.heldPair, activeBindingDatabase: fields.activeBindingDatabase })) !== fields.pairHash) fail();
      activeBindingHostPairV1 = observed;
      stage("post-active-binding-host-pair"); check();
    }
    if (process.argv[2] === "inspect-held-binding-candidates-v1") {
      stage("active-binding-host-pair-load");
      const pairModule = await import("../dist/internal-production/baseline-positive-worktree-host-pair-v2.js");
      check(); stage("active-binding-host-pair");
      const observed = await pairModule.observeCodeOwnedPositiveWorktreeHeldBindingCandidatesV1();
      const descriptors = observed && Object.getOwnPropertyDescriptors(observed);
      const keys = descriptors && Reflect.ownKeys(descriptors);
      const expected = ["schema", "authority", "physicalIdentityProvenance",
        "heldActiveBindingPair", "joinedCandidates", "pairHash"];
      if (!Object.isFrozen(observed) || !keys || keys.length !== expected.length
        || keys.some(key => typeof key !== "string" || !expected.includes(key)
          || !descriptors[key].enumerable || !Object.hasOwn(descriptors[key], "value"))) fail();
      const fields = Object.fromEntries(expected.map(key => [key, descriptors[key].value]));
      const held = fields.heldActiveBindingPair, joined = fields.joinedCandidates;
      const joinedDescriptors = joined && Object.getOwnPropertyDescriptors(joined);
      const joinedKeys = joinedDescriptors && Reflect.ownKeys(joinedDescriptors);
      const joinedExpected = ["schema", "authority", "physicalIdentityProvenance", "receiptStatus",
        "candidates", "unresolvedAttemptIds", "unresolvedSessionIds", "projectionHash"];
      if (fields.schema !== "setfarm.internal-production-held-binding-physical-database-pair.v1"
        || fields.authority !== "diagnostic-only" || fields.physicalIdentityProvenance !== "unverified"
        || !Object.isFrozen(held) || held.schema !== "setfarm.internal-production-active-binding-physical-database-pair.v1"
        || held.authority !== "diagnostic-only" || held.physicalIdentityProvenance !== "unverified"
        || !Object.isFrozen(joined) || !joinedKeys || joinedKeys.length !== joinedExpected.length
        || joinedKeys.some(key => typeof key !== "string" || !joinedExpected.includes(key)
          || !joinedDescriptors[key].enumerable || !Object.hasOwn(joinedDescriptors[key], "value"))
        || joined.schema !== "setfarm.internal-production-held-binding-candidates.v1"
        || joined.authority !== "diagnostic-only" || joined.physicalIdentityProvenance !== "unverified"
        || joined.receiptStatus !== "required-unpublished"
        || !Object.isFrozen(joined.candidates) || !Object.isFrozen(joined.unresolvedAttemptIds)
        || !Object.isFrozen(joined.unresolvedSessionIds)
        || typeof joined.projectionHash !== "string" || !/^[a-f0-9]{64}$/.test(joined.projectionHash)
        || hash(canonical({ schema: joined.schema, authority: joined.authority,
          physicalIdentityProvenance: joined.physicalIdentityProvenance,
          receiptStatus: joined.receiptStatus, candidates: joined.candidates,
          unresolvedAttemptIds: joined.unresolvedAttemptIds,
          unresolvedSessionIds: joined.unresolvedSessionIds })) !== joined.projectionHash
        || typeof fields.pairHash !== "string" || !/^[a-f0-9]{64}$/.test(fields.pairHash)
        || hash(canonical({ schema: fields.schema, authority: fields.authority,
          physicalIdentityProvenance: fields.physicalIdentityProvenance,
          heldActiveBindingPair: held, joinedCandidates: joined })) !== fields.pairHash) fail();
      heldBindingCandidatesV1 = observed;
      stage("post-active-binding-host-pair"); check();
    }
    if (process.argv[2] === "inspect-pre32-absence-annotation-v1") {
      stage("pre32-absence-annotation-load");
      const annotationModule = await import("../dist/internal-production/baseline-positive-worktree-pre32-absence-annotation-v1.js");
      check(); stage("pre32-absence-annotation");
      const observed = await annotationModule.observeCodeOwnedPositiveWorktreePre32AbsenceAnnotationV1();
      const descriptors = observed && Object.getOwnPropertyDescriptors(observed);
      const keys = descriptors && Reflect.ownKeys(descriptors);
      const expected = ["schema", "authority", "physicalIdentityProvenance", "sourcePair", "witness",
        "witnessedBlockers", "remainingBlockers", "annotationHash"];
      if (!Object.isFrozen(observed) || !keys || keys.length !== expected.length
        || keys.some(key => typeof key !== "string" || !expected.includes(key)
          || !descriptors[key].enumerable || !Object.hasOwn(descriptors[key], "value"))) fail();
      const fields = Object.fromEntries(expected.map(key => [key, descriptors[key].value]));
      const pair = fields.sourcePair, witness = fields.witness;
      if (fields.schema !== "setfarm.internal-production-pre32-absent-git-record-annotation.v1"
        || fields.authority !== "diagnostic-only" || fields.physicalIdentityProvenance !== "unverified"
        || !Object.isFrozen(pair) || pair.schema !== "setfarm.internal-production-pre32-physical-database-pair.v6"
        || pair.authority !== "diagnostic-only" || pair.physicalIdentityProvenance !== "unverified"
        || !Object.isFrozen(pair.heldPair) || !Object.isFrozen(pair.pre32Database)
        || typeof pair.pairHash !== "string" || !/^[a-f0-9]{64}$/.test(pair.pairHash)
        || hash(canonical({ schema: pair.schema, authority: pair.authority,
          physicalIdentityProvenance: pair.physicalIdentityProvenance,
          heldPair: pair.heldPair, pre32Database: pair.pre32Database })) !== pair.pairHash
        || !Object.isFrozen(witness) || witness.schema !== "setfarm.internal-production-prunable-absence-witness.v3"
        || witness.authority !== "diagnostic-only" || witness.temporalScope !== "v2-bracketed-two-pass"
        || witness.hostPair !== pair.heldPair
        || witness.sourcePairHash !== pair.heldPair.pairHash
        || witness.sourceCatalogHash !== pair.heldPair.physicalCatalog.catalogHash
        || !Array.isArray(witness.witnesses) || !Object.isFrozen(witness.witnesses)
        || typeof witness.witnessHash !== "string" || !/^[a-f0-9]{64}$/.test(witness.witnessHash)
        || hash(canonical({ schema: witness.schema, authority: witness.authority,
          temporalScope: witness.temporalScope, sourcePairHash: witness.sourcePairHash,
          sourceCatalogHash: witness.sourceCatalogHash, hostPair: witness.hostPair,
          witnesses: witness.witnesses, unwitnessedPrunableCount: witness.unwitnessedPrunableCount })) !== witness.witnessHash
        || !Object.isFrozen(fields.witnessedBlockers) || !Array.isArray(fields.witnessedBlockers)
        || !Object.isFrozen(fields.remainingBlockers) || !Array.isArray(fields.remainingBlockers)
        || typeof fields.annotationHash !== "string" || !/^[a-f0-9]{64}$/.test(fields.annotationHash)
        || hash(canonical({ schema: fields.schema, authority: fields.authority,
          physicalIdentityProvenance: fields.physicalIdentityProvenance,
          sourcePair: pair, witness, witnessedBlockers: fields.witnessedBlockers,
          remainingBlockers: fields.remainingBlockers })) !== fields.annotationHash) fail();
      const original = pair.heldPair.physicalCatalog.blockers;
      const roots = new Set(witness.witnesses.map(entry => entry.root));
      if (!Array.isArray(original) || !Object.isFrozen(original) || roots.size !== witness.witnesses.length
        || fields.witnessedBlockers.length + fields.remainingBlockers.length !== original.length) fail();
      let witnessedIndex = 0, remainingIndex = 0;
      for (const blocker of original) {
        if (blocker.reason === "prunable-git-worktree" && roots.has(blocker.root)) {
          if (fields.witnessedBlockers[witnessedIndex++] !== blocker) fail();
        } else if (fields.remainingBlockers[remainingIndex++] !== blocker) fail();
      }
      pre32AbsenceAnnotationV1 = observed;
      stage("post-pre32-absence-annotation"); check();
    }
    if (["inspect-pre32-absence-annotation-v2", "inspect-pre32-residual-absence-annotation-v3"].includes(process.argv[2])) {
      const v3 = process.argv[2] === "inspect-pre32-residual-absence-annotation-v3";
      stage("pre32-absence-annotation-load");
      const annotationModule = await import(v3
        ? "../dist/internal-production/baseline-positive-worktree-pre32-residual-absence-annotation-v3.js"
        : "../dist/internal-production/baseline-positive-worktree-pre32-absence-annotation-v2.js");
      check(); stage("pre32-absence-annotation");
      const result = v3
        ? await annotationModule.observeCodeOwnedPositiveWorktreePre32ResidualAbsenceAnnotationV3()
        : await annotationModule.observeCodeOwnedPositiveWorktreePre32AbsenceAnnotationV2();
      let wrapper;
      if (v3) {
        const expectedWrapper = ["schema", "authority", "physicalIdentityProvenance", "temporalScope",
          "sourceAnnotation", "boundedAbsenceBlockers", "otherResidualBlockers", "annotationHash"];
        const wrapperDescriptors = result && !types.isProxy(result) && Object.getOwnPropertyDescriptors(result);
        const wrapperKeys = wrapperDescriptors && Reflect.ownKeys(wrapperDescriptors);
        if (!Object.isFrozen(result) || Object.getPrototypeOf(result) !== Object.prototype
          || !wrapperKeys || wrapperKeys.length !== expectedWrapper.length
          || wrapperKeys.some(key => typeof key !== "string" || !expectedWrapper.includes(key)
            || !wrapperDescriptors[key].enumerable || !Object.hasOwn(wrapperDescriptors[key], "value"))) fail();
        wrapper = Object.fromEntries(expectedWrapper.map(key => [key, wrapperDescriptors[key].value]));
      }
      const observed = v3 ? wrapper.sourceAnnotation : result;
      const descriptors = observed && Object.getOwnPropertyDescriptors(observed);
      const keys = descriptors && Reflect.ownKeys(descriptors);
      const expected = ["schema", "authority", "physicalIdentityProvenance", "sourcePair", "witness",
        "witnessedBlockers", "remainingBlockers", "annotationHash"];
      if (!Object.isFrozen(observed) || !keys || keys.length !== expected.length
        || keys.some(key => typeof key !== "string" || !expected.includes(key)
          || !descriptors[key].enumerable || !Object.hasOwn(descriptors[key], "value"))) fail();
      const fields = Object.fromEntries(expected.map(key => [key, descriptors[key].value]));
      const pair = fields.sourcePair, witness = fields.witness, database = pair?.pre32Database;
      if (fields.schema !== "setfarm.internal-production-pre32-absent-git-record-annotation.v2"
        || fields.authority !== "diagnostic-only" || fields.physicalIdentityProvenance !== "unverified"
        || !Object.isFrozen(pair) || pair.schema !== "setfarm.internal-production-pre32-physical-database-pair.v7"
        || pair.authority !== "diagnostic-only" || pair.physicalIdentityProvenance !== "unverified"
        || !Object.isFrozen(pair.heldPair) || !Object.isFrozen(database)
        || database.schema !== "setfarm.internal-production-pre32-active-binding-snapshot.v7"
        || database.authority !== "diagnostic-only"
        || database.tableLockScope !== "fixed-pre32-legacy-superset"
        || database.journalIdentity !== "source-ordinal-name-checksum-state-1-through-31"
        || database.lockState !== "released-at-return"
        || typeof database.snapshotHash !== "string" || !/^[a-f0-9]{64}$/.test(database.snapshotHash)
        || hash(canonical({ schema: database.schema, authority: database.authority,
          tableLockScope: database.tableLockScope, journalIdentity: database.journalIdentity,
          lockState: database.lockState, legacyCensus: database.legacyCensus,
          activeRows: database.activeRows, bindingRows: database.bindingRows,
          quarantinedRuntimeSessionCount: database.quarantinedRuntimeSessionCount })) !== database.snapshotHash
        || typeof pair.pairHash !== "string" || !/^[a-f0-9]{64}$/.test(pair.pairHash)
        || hash(canonical({ schema: pair.schema, authority: pair.authority,
          physicalIdentityProvenance: pair.physicalIdentityProvenance,
          heldPair: pair.heldPair, pre32Database: database })) !== pair.pairHash
        || !Object.isFrozen(witness) || witness.schema !== "setfarm.internal-production-prunable-absence-witness.v3"
        || witness.authority !== "diagnostic-only" || witness.temporalScope !== "v2-bracketed-two-pass"
        || witness.hostPair !== pair.heldPair || witness.sourcePairHash !== pair.heldPair.pairHash
        || witness.sourceCatalogHash !== pair.heldPair.physicalCatalog.catalogHash
        || !Array.isArray(witness.witnesses) || !Object.isFrozen(witness.witnesses)
        || typeof witness.witnessHash !== "string" || !/^[a-f0-9]{64}$/.test(witness.witnessHash)
        || hash(canonical({ schema: witness.schema, authority: witness.authority,
          temporalScope: witness.temporalScope, sourcePairHash: witness.sourcePairHash,
          sourceCatalogHash: witness.sourceCatalogHash, hostPair: witness.hostPair,
          witnesses: witness.witnesses, unwitnessedPrunableCount: witness.unwitnessedPrunableCount })) !== witness.witnessHash
        || !Object.isFrozen(fields.witnessedBlockers) || !Array.isArray(fields.witnessedBlockers)
        || !Object.isFrozen(fields.remainingBlockers) || !Array.isArray(fields.remainingBlockers)
        || typeof fields.annotationHash !== "string" || !/^[a-f0-9]{64}$/.test(fields.annotationHash)
        || hash(canonical({ schema: fields.schema, authority: fields.authority,
          physicalIdentityProvenance: fields.physicalIdentityProvenance,
          sourcePair: pair, witness, witnessedBlockers: fields.witnessedBlockers,
          remainingBlockers: fields.remainingBlockers })) !== fields.annotationHash) fail();
      const exactFrozen = (value, expectedKeys) => {
        if (!value || typeof value !== "object" || types.isProxy(value)
          || Object.getPrototypeOf(value) !== Object.prototype || !Object.isFrozen(value)) return false;
        const descriptors = Object.getOwnPropertyDescriptors(value), keys = Reflect.ownKeys(descriptors);
        return keys.length === expectedKeys.length && keys.every(key => typeof key === "string"
          && expectedKeys.includes(key) && descriptors[key].enumerable
          && Object.hasOwn(descriptors[key], "value"));
      };
      const census = database.legacyCensus, binding = database.bindingRows;
      const censusCounts = ["activeRunCount", "openClaimCount", "executionAttemptCount",
        "activeRuntimeSessionCount", "activeCompletionOwnerCount", "unsettledMandatoryEffectCount",
        "artifactReservationCount", "publicationBatchCount", "artifactPublicationCount",
        "terminationOwnerCount", "findingOwnerCount", "recoveryOwnerCount", "operationalDeliveryCount"];
      const inventory = census?.legacyFindingPublicationInventory;
      const bindingCounts = binding?.counts, activeCounts = database.activeRows?.counts;
      if (!exactFrozen(database, ["schema", "authority", "tableLockScope", "journalIdentity",
        "lockState", "legacyCensus", "activeRows", "bindingRows",
        "quarantinedRuntimeSessionCount", "snapshotHash"])
        || !exactFrozen(census, [...censusCounts, "legacyFindingPublicationInventory"])
        || censusCounts.some(key => census[key] !== 0)
        || !exactFrozen(inventory, ["schema", "entries", "inventoryHash"])
        || inventory.schema !== "setfarm.legacy-finding-publication-inventory.v1"
        || !Array.isArray(inventory.entries) || !Object.isFrozen(inventory.entries)
        || inventory.entries.length > 4096
        || typeof inventory.inventoryHash !== "string" || !/^[a-f0-9]{64}$/.test(inventory.inventoryHash)
        || hash(canonical({ schema: inventory.schema, entries: inventory.entries })) !== inventory.inventoryHash
        || !exactFrozen(binding, ["schema", "authority", "physicalIdentityProvenance",
          "activeAttempts", "activeSessions", "counts", "snapshotHash"])
        || binding.schema !== "setfarm.internal-production-positive-worktree-binding-rows.v1"
        || binding.authority !== "diagnostic-only" || binding.physicalIdentityProvenance !== "unverified"
        || !Array.isArray(binding.activeAttempts) || !Object.isFrozen(binding.activeAttempts)
        || !Array.isArray(binding.activeSessions) || !Object.isFrozen(binding.activeSessions)
        || !exactFrozen(bindingCounts, ["attemptCount", "sessionCount"])
        || !exactFrozen(activeCounts, ["runCount", "claimCount", "attemptCount", "sessionCount"])
        || Object.values(activeCounts).some(count => count !== 0)
        || bindingCounts.attemptCount !== 0 || bindingCounts.sessionCount !== 0
        || binding.activeAttempts.length !== 0 || binding.activeSessions.length !== 0
        || typeof binding.snapshotHash !== "string" || !/^[a-f0-9]{64}$/.test(binding.snapshotHash)
        || hash(canonical({ schema: binding.schema, authority: binding.authority,
          physicalIdentityProvenance: binding.physicalIdentityProvenance,
          activeAttempts: binding.activeAttempts, activeSessions: binding.activeSessions,
          counts: bindingCounts })) !== binding.snapshotHash
        || !Number.isSafeInteger(database.quarantinedRuntimeSessionCount)
        || database.quarantinedRuntimeSessionCount < 0
        || !exactFrozen(witness, ["schema", "authority", "temporalScope", "sourcePairHash",
          "sourceCatalogHash", "hostPair", "witnesses", "unwitnessedPrunableCount", "witnessHash"])) fail();
      let priorFinding = "";
      const runStatuses = new Map();
      for (const entry of inventory.entries) {
        if (!exactFrozen(entry, ["findingSetHash", "publicationHash", "runId", "terminalRunStatus"])
          || typeof entry.findingSetHash !== "string" || !/^[a-f0-9]{64}$/.test(entry.findingSetHash)
          || typeof entry.publicationHash !== "string" || !/^[a-f0-9]{64}$/.test(entry.publicationHash)
          || entry.findingSetHash <= priorFinding || typeof entry.runId !== "string"
          || entry.runId.length < 1 || entry.runId.length > 500
          || !["completed", "failed", "cancelled"].includes(entry.terminalRunStatus)
          || (runStatuses.has(entry.runId) && runStatuses.get(entry.runId) !== entry.terminalRunStatus)) fail();
        priorFinding = entry.findingSetHash;
        runStatuses.set(entry.runId, entry.terminalRunStatus);
      }
      const held = pair.heldPair, catalog = held.physicalCatalog, active = held.databaseSnapshot;
      if (!exactFrozen(pair, ["schema", "authority", "physicalIdentityProvenance", "heldPair", "pre32Database", "pairHash"])
        || !exactFrozen(held, ["schema", "authority", "physicalIdentityProvenance", "physicalCatalog", "databaseSnapshot", "pairHash"])
        || held.schema !== "setfarm.internal-production-positive-worktree-host-pair.v2"
        || held.authority !== "diagnostic-only" || held.physicalIdentityProvenance !== "unverified"
        || !exactFrozen(catalog, ["schema", "status", "observerPidExcluded", "entries", "absentBases",
          "incidentalFiles", "blockers", "catalogHash"])
        || catalog.schema !== "setfarm.internal-production-positive-worktree-physical-catalog.v2"
        || !["complete", "unresolved"].includes(catalog.status)
        || !Array.isArray(catalog.entries) || !Object.isFrozen(catalog.entries)
        || !Array.isArray(catalog.absentBases) || !Object.isFrozen(catalog.absentBases)
        || !Array.isArray(catalog.incidentalFiles) || !Object.isFrozen(catalog.incidentalFiles)
        || !Array.isArray(catalog.blockers) || !Object.isFrozen(catalog.blockers)
        || typeof catalog.catalogHash !== "string" || !/^[a-f0-9]{64}$/.test(catalog.catalogHash)
        || hash(canonical({ schema: catalog.schema, status: catalog.status,
          observerPidExcluded: catalog.observerPidExcluded, entries: catalog.entries,
          absentBases: catalog.absentBases, incidentalFiles: catalog.incidentalFiles,
          blockers: catalog.blockers })) !== catalog.catalogHash
        || !exactFrozen(active, ["schema", "authority", "physicalIdentityProvenance", "activeRuns",
          "openClaims", "activeAttempts", "activeSessions", "counts", "snapshotHash"])
        || active.schema !== "setfarm.internal-production-positive-worktree-active-rows.v2"
        || active.authority !== "diagnostic-only" || active.physicalIdentityProvenance !== "unverified"
        || !Array.isArray(active.activeRuns) || !Object.isFrozen(active.activeRuns) || active.activeRuns.length !== 0
        || !Array.isArray(active.openClaims) || !Object.isFrozen(active.openClaims) || active.openClaims.length !== 0
        || !Array.isArray(active.activeAttempts) || !Object.isFrozen(active.activeAttempts) || active.activeAttempts.length !== 0
        || !Array.isArray(active.activeSessions) || !Object.isFrozen(active.activeSessions) || active.activeSessions.length !== 0
        || typeof active.snapshotHash !== "string" || !/^[a-f0-9]{64}$/.test(active.snapshotHash)
        || hash(canonical({ schema: active.schema, authority: active.authority,
          physicalIdentityProvenance: active.physicalIdentityProvenance,
          activeRuns: active.activeRuns, openClaims: active.openClaims,
          activeAttempts: active.activeAttempts, activeSessions: active.activeSessions,
          counts: active.counts })) !== active.snapshotHash
        || database.activeRows !== active
        || typeof held.pairHash !== "string" || !/^[a-f0-9]{64}$/.test(held.pairHash)
        || hash(canonical({ schema: held.schema, authority: held.authority,
          physicalIdentityProvenance: held.physicalIdentityProvenance,
          physicalCatalog: catalog, databaseSnapshot: active })) !== held.pairHash) fail();
      const validRoot = value => typeof value === "string" && value !== "/" && !value.includes("\0")
        && path.posix.isAbsolute(value) && path.posix.normalize(value) === value
        && Buffer.byteLength(value) <= 4096;
      if (catalog.absentBases.length > 1024 || catalog.blockers.length > 1024) fail();
      const absent = new Set();
      for (const base of catalog.absentBases) {
        if (!validRoot(base) || absent.has(base)) fail();
        absent.add(base);
      }
      const expectedRoots = new Set();
      let unwitnessed = 0;
      for (const blocker of catalog.blockers) {
        if (!exactFrozen(blocker, ["root", "reason"]) || !validRoot(blocker.root)
          || typeof blocker.reason !== "string" || blocker.reason.length === 0
          || Buffer.byteLength(blocker.reason) > 128) fail();
        if (blocker.reason !== "prunable-git-worktree") continue;
        if (absent.has(path.posix.dirname(blocker.root))) expectedRoots.add(blocker.root);
        else unwitnessed += 1;
      }
      const witnessed = witness.witnesses;
      if (witnessed.length !== expectedRoots.size || witness.unwitnessedPrunableCount !== unwitnessed) fail();
      let previousRoot = null;
      for (const entry of witnessed) {
        if (!exactFrozen(entry, ["root", "absentBase"]) || !validRoot(entry.root)
          || !validRoot(entry.absentBase) || entry.absentBase !== path.posix.dirname(entry.root)
          || !absent.has(entry.absentBase) || !expectedRoots.has(entry.root)
          || (previousRoot !== null && Buffer.compare(Buffer.from(previousRoot), Buffer.from(entry.root)) >= 0)) fail();
        previousRoot = entry.root;
      }
      const original = catalog.blockers;
      const roots = new Set(witnessed.map(entry => entry.root));
      if (roots.size !== witnessed.length
        || fields.witnessedBlockers.length + fields.remainingBlockers.length !== original.length) fail();
      let witnessedIndex = 0, remainingIndex = 0;
      for (const blocker of original) {
        if (blocker.reason === "prunable-git-worktree" && roots.has(blocker.root)) {
          if (fields.witnessedBlockers[witnessedIndex++] !== blocker) fail();
        } else if (fields.remainingBlockers[remainingIndex++] !== blocker) fail();
      }
      if (v3) {
        const bounded = wrapper.boundedAbsenceBlockers, other = wrapper.otherResidualBlockers;
        if (wrapper.schema !== "setfarm.internal-production-pre32-residual-absence-annotation.v3"
          || wrapper.authority !== "diagnostic-only" || wrapper.physicalIdentityProvenance !== "unverified"
          || wrapper.temporalScope !== "v7-held-two-pass"
          || !Array.isArray(bounded) || !Object.isFrozen(bounded)
          || !Array.isArray(other) || !Object.isFrozen(other)
          || bounded.length + other.length !== fields.remainingBlockers.length
          || typeof wrapper.annotationHash !== "string" || !/^[a-f0-9]{64}$/.test(wrapper.annotationHash)
          || hash(canonical({ schema: wrapper.schema, authority: wrapper.authority,
            physicalIdentityProvenance: wrapper.physicalIdentityProvenance,
            temporalScope: wrapper.temporalScope, sourceAnnotation: observed,
            boundedAbsenceBlockers: bounded, otherResidualBlockers: other })) !== wrapper.annotationHash) fail();
        const ordered = (rows, value, duplicateAllowed = false) => {
          let previous = null;
          for (const row of rows) {
            const current = value(row);
            if (typeof current !== "string" || (previous !== null
              && Buffer.compare(Buffer.from(previous), Buffer.from(current)) >= (duplicateAllowed ? 1 : 0))) fail();
            previous = current;
          }
        };
        ordered(catalog.entries, row => row.root);
        ordered(catalog.blockers, row => row.root, true);
        ordered(catalog.absentBases, value => value);
        ordered(catalog.incidentalFiles, value => value);
        const entries = new Map(catalog.entries.map(entry => [entry.root, entry]));
        const homeSuffix = root => {
          const match = /^(\/(?:Users|home)\/[A-Za-z0-9._-]+)(\/.*)$/.exec(root);
          if (!match || path.posix.normalize(root) !== root
            || root.split("/").slice(1).some(part => part === "." || part === "..")) fail();
          return { home: match[1], suffix: match[2] };
        };
        const name = "[A-Za-z0-9._-]+";
        const retained = new RegExp(`^/ai/setrox/(?:(?:\\.worktrees|setfarm/\\.worktrees|mission-control/\\.worktrees|deployments)/${name})$`);
        const runtime = new RegExp(`^(?:/projects/${name}/\\.worktrees/${name}|/\\.openclaw/workspace/agent-scratch/story-worktrees/${name}|/\\.openclaw/workspaces/workflows/${name}/(?:story-worktrees/${name}|agents/${name}/story-worktrees/${name}))$`);
        const workflowAgents = new RegExp(`^/\\.openclaw/workspaces/workflows/${name}/agents$`);
        const expectedBounded = [], expectedOther = [], candidates = new Set();
        let ownerHome = null;
        for (const blocker of fields.remainingBlockers) {
          if (["non-git-child", "absent-workflow-agents-discovery-parent"].includes(blocker.reason)) {
            if (candidates.has(blocker.root)) fail();
            candidates.add(blocker.root);
          }
          if (blocker.reason === "non-git-child") {
            const entry = entries.get(blocker.root), physical = homeSuffix(blocker.root);
            if (ownerHome !== null && ownerHome !== physical.home) fail();
            ownerHome = physical.home;
            const zone = retained.test(physical.suffix) ? "retained-zone"
              : runtime.test(physical.suffix) ? "runtime-zone" : null;
            if (!entry || entry.kind !== "unresolved" || entry.gitPrimaryRoot !== null
              || entry.dirty !== null || entry.sourceBuildProvenance !== "unverified"
              || !Array.isArray(entry.referencingPids) || zone === null || entry.zone !== zone
              || catalog.absentBases.some(base => blocker.root === base || blocker.root.startsWith(`${base}/`))
              || catalog.incidentalFiles.some(file => file === blocker.root || file.startsWith(`${blocker.root}/`))) fail();
            let previousPid = 0;
            for (const pid of entry.referencingPids) {
              if (!Number.isSafeInteger(pid) || pid <= previousPid) fail();
              previousPid = pid;
            }
            (entry.referencingPids.length === 0 ? expectedBounded : expectedOther).push(blocker);
          } else if (blocker.reason === "absent-workflow-agents-discovery-parent") {
            const absentParent = homeSuffix(blocker.root);
            if (ownerHome !== null && ownerHome !== absentParent.home) fail();
            ownerHome = absentParent.home;
            if (!workflowAgents.test(absentParent.suffix)
              || [...catalog.entries.map(entry => entry.root), ...catalog.absentBases,
                ...catalog.incidentalFiles, ...catalog.blockers.filter(row => row !== blocker).map(row => row.root)]
                .some(root => root === blocker.root || root.startsWith(`${blocker.root}/`))) fail();
            expectedBounded.push(blocker);
          } else expectedOther.push(blocker);
        }
        if (bounded.length !== expectedBounded.length || other.length !== expectedOther.length
          || bounded.some((blocker, index) => blocker !== expectedBounded[index])
          || other.some((blocker, index) => blocker !== expectedOther[index])) fail();
        if (!plainFrozenTree(result)) fail();
        pre32ResidualAbsenceAnnotationV3 = result;
      } else pre32AbsenceAnnotationV2 = observed;
      stage("post-pre32-absence-annotation"); check();
    }
    if (process.argv[2] === "inspect-retained-profile") {
      const profileModule = await import("./deployment-cutover-retained-profile.mjs");
      check(); retainedProfile = profileModule.observeDeploymentCutoverRetainedProfileV1();
    }
    if (process.argv[2] === "inspect-helpers") {
      const helperModule = await import("../dist/internal-production/baseline-deployment-cutover-helper-observation-v1.js");
      check(); helpers = await helperModule.observeDeploymentCutoverHelperHistoryV1();
    }
    if (process.argv[2] === "inspect-envfiles") {
      const envModule = await import("../dist/internal-production/baseline-deployment-cutover-env-absence-v1.js");
      check(); envFiles = envModule.observeDeploymentCutoverDefaultEnvAbsenceV1();
    }
    if (["inspect-host", "inspect-database"].includes(process.argv[2])) {
      const cliModule = await import("../dist/internal-production/baseline-deployment-cutover-cli-observation-v1.js");
      const launcherModule = await import("../dist/internal-production/baseline-deployment-cutover-launcher-observation-v1.js");
      const processModule = await import("../dist/internal-production/baseline-deployment-cutover-process-observation-v1.js");
      check();
      const cli = cliModule.observeDeploymentCutoverCliLinkV1();
      const launchers = launcherModule.observeDeploymentCutoverLauncherConfigurationV1();
      const processes = processModule.observeDeploymentCutoverProcessFamiliesV1();
      const selectedDeployment = await verifier.observeSelectedSetfarmDeploymentBuildV1();
      if (canonical(selectedDeployment.cli) !== canonical(cli)) fail();
      const database = process.argv[2] === "inspect-database" ? await launcherModule.observeDeploymentCutoverLauncherDatabaseV1() : undefined;
      if (database && canonical(database.launcherObservation) !== canonical(launchers)) fail();
      if (canonical(processes) !== canonical(processModule.observeDeploymentCutoverProcessFamiliesV1())
        || canonical(launchers) !== canonical(launcherModule.observeDeploymentCutoverLauncherConfigurationV1())
        || canonical(cli) !== canonical(cliModule.observeDeploymentCutoverCliLinkV1())) fail();
      // On-disk build proof never substitutes for DB or current-owner proof.
      const blockers = [database ? "filesystem-helper-phase-zero-owner-not-observed" : "database-zero-owner-not-observed", "controller-ownership-not-acquired"];
      if (database) blockers.push("runtime-effective-environment-not-authenticated");
      if (cli.checkoutPath === root) blockers.push("cli-already-selects-new-checkout");
      if (processes.families.some(entry => entry.classification !== "dashboard-daemon")) blockers.push("non-dashboard-process-family");
      const dashboards = processes.families.filter(entry => entry.classification === "dashboard-daemon");
      if (dashboards.length !== 1 || dashboards[0].checkoutPath !== cli.checkoutPath || processes.listener?.pid !== dashboards[0].pid) {
        blockers.push("dashboard-cli-root-disagreement");
      }
      const body = { schema: "setfarm.internal-production-deployment-cutover-host-observation.v1", newCheckoutPath: root, cli, launchers, processes, selectedDeployment,
        ...(database ? { database } : {}), blockers };
      host = { ...body, hostObservationHash: hash(canonical(body)) };
    }
    stage("final-source"); check(); if (canonical(sourceState()) !== canonical(initial)) fail();
    result = { schema: "setfarm.internal-production-deployment-cutover-bootstrap-observation.v1", sourceBuild, controllerSourceHash: authority.controllerSourceHash,
      ...(host ? { host } : {}), ...(envFiles ? { envFiles } : {}), ...(helpers ? { helpers } : {}), ...(retainedProfile ? { retainedProfile } : {}),
      ...(defaultContext ? { defaultContext } : {}), ...(pre32HostPair ? { pre32HostPair } : {}),
      ...(pre32HostPairV5 ? { pre32HostPairV5 } : {}), ...(pre32HostPairV6 ? { pre32HostPairV6 } : {}),
      ...(pre32HostPairV7 ? { pre32HostPairV7 } : {}),
      ...(pre32AbsenceAnnotationV1 ? { pre32AbsenceAnnotationV1 } : {}),
      ...(pre32AbsenceAnnotationV2 ? { pre32AbsenceAnnotationV2 } : {}),
      ...(pre32ResidualAbsenceAnnotationV3 ? { pre32ResidualAbsenceAnnotationV3 } : {}),
      ...(activeBindingHostPairV1 ? { activeBindingHostPairV1 } : {}),
      ...(heldBindingCandidatesV1 ? { heldBindingCandidatesV1 } : {}) };
  } catch (error) {
    // A throwing nested observer may have acquired resources we never received.
    // Missing sanitized cleanup evidence means unknown, not successful cleanup.
    const owned = process.argv[2] === "inspect-default-context" && refusal.stage === "default-context" ? ownerRefusal(error) : null;
    const pre32 = (["inspect-pre32-host-pair", "inspect-pre32-host-pair-v5", "inspect-pre32-host-pair-v6", "inspect-pre32-host-pair-v7"].includes(process.argv[2]) && refusal.stage === "pre32-host-pair")
      || (["inspect-pre32-absence-annotation-v1", "inspect-pre32-absence-annotation-v2", "inspect-pre32-residual-absence-annotation-v3"].includes(process.argv[2]) && refusal.stage === "pre32-absence-annotation");
    const activeBinding = ["inspect-active-binding-host-pair-v1", "inspect-held-binding-candidates-v1"].includes(process.argv[2])
      && refusal.stage === "active-binding-host-pair";
    const phase = pre32 ? pre32FailurePhase(error) : null;
    const point = pre32 ? pre32PhysicalPoint(error, phase) : null;
    const activePhase = activeBinding ? activeBindingFailurePhase(error) : null;
    const activePoint = activeBinding ? pre32PhysicalPoint(error, activePhase, "activeBindingPhysicalPoint") : null;
    refusal = owned ?? { ...refusal, cleanupFailed: null,
      ...(pre32 ? { pre32FailurePhase: phase, ...(point ? { pre32PhysicalPoint: point } : {}) } : {}),
      ...(activeBinding ? { activeBindingFailurePhase: activePhase,
        ...(activePoint ? { activeBindingPhysicalPoint: activePoint } : {}) } : {}) };
    invalid = true;
  }
  while (pins.length) { const pin = pins.pop(); try { fs.closeSync(pin.fd); } catch {
    if (!invalid) stage("cleanup"); invalid = true; refusal = { ...refusal, cleanupFailed: true };
  } }
  if (invalid || !result) fail(); return result;
}
try { process.stdout.write(`${JSON.stringify(await inspect())}\n`); }
catch {
  process.stderr.write("DEPLOYMENT_CUTOVER_BOOTSTRAP_REFUSED\n");
  if (["inspect-default-context", "inspect-pre32-host-pair", "inspect-pre32-host-pair-v5", "inspect-pre32-host-pair-v6", "inspect-pre32-host-pair-v7", "inspect-pre32-absence-annotation-v1", "inspect-pre32-absence-annotation-v2", "inspect-pre32-residual-absence-annotation-v3", "inspect-active-binding-host-pair-v1", "inspect-held-binding-candidates-v1"].includes(process.argv[2])) process.stderr.write(`${JSON.stringify({ schema: "setfarm.deployment-cutover-refusal.v1", ...refusal })}\n`);
  process.exitCode = 1;
}
