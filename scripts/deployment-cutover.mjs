#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
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
const hash = bytes => createHash("sha256").update(bytes).digest("hex");
const canonical = value => value === null || typeof value !== "object" ? JSON.stringify(value)
  : Array.isArray(value) ? `[${value.map(canonical).join(",")}]`
    : `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`;
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
    || !["inspect", "inspect-host", "inspect-database", "inspect-envfiles", "inspect-helpers", "inspect-retained-profile", "inspect-default-context"].includes(process.argv[2]) || process.argv[3] !== "--json"
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
    let host, envFiles, helpers, retainedProfile, defaultContext;
    if (process.argv[2] === "inspect-default-context") {
      stage("default-owner-load");
      const contextModule = await import("./deployment-cutover-default-context.mjs");
      check(); stage("default-context"); defaultContext = await contextModule.observeDeploymentCutoverDefaultContextV1();
      stage("post-context"); check();
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
      ...(defaultContext ? { defaultContext } : {}) };
  } catch (error) {
    // A throwing nested observer may have acquired resources we never received.
    // Missing sanitized cleanup evidence means unknown, not successful cleanup.
    const owned = process.argv[2] === "inspect-default-context" && refusal.stage === "default-context" ? ownerRefusal(error) : null;
    refusal = owned ?? { ...refusal, cleanupFailed: null };
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
  if (process.argv[2] === "inspect-default-context") process.stderr.write(`${JSON.stringify({ schema: "setfarm.deployment-cutover-refusal.v1", ...refusal })}\n`);
  process.exitCode = 1;
}
