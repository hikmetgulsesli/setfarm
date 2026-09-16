#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { registerHooks, isBuiltin } from "node:module";

// Trusted fresh entry: launch with a trusted Node executable and sanitized
// environment, without preloads. In-entry checks cannot undo prior preload code.
// Diagnostic only: never acquire ownership, publish intent, or operate services.
const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const closure = ["scripts/build-generation-maintenance-journal.mjs", "scripts/build-generation-maintenance-owner-observer.mjs",
  "scripts/build-generation-retention.mjs", "scripts/deployment-cutover-owner.mjs", "scripts/deployment-cutover.mjs"];
const directoryKeys = ["dev", "ino", "uid", "gid", "mode", "birthtimeNs"];
const fileKeys = [...directoryKeys, "nlink", "size", "mtimeNs", "ctimeNs"];
const fail = () => { throw Error("DEPLOYMENT_CUTOVER_BOOTSTRAP_REFUSED"); };
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
    || process.argv[2] !== "inspect" || process.argv[3] !== "--json"
    || pathToFileURL(path.resolve(process.argv[1])).href !== import.meta.url
    || Object.keys(process.env).some(key => !["PATH", "LANG", "LC_ALL", "TZ"].includes(key)
      && !(process.platform === "darwin" && key === "__CF_USER_TEXT_ENCODING"))) fail();
  const pins = [], directories = new Set(), files = new Map();
  let invalid = false, result, totalBytes = 0;
  try {
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
        const buffer = Buffer.alloc(Number(stat.size) + 1), count = fs.readSync(fd, buffer, 0, buffer.length, 0);
        if (BigInt(count) !== stat.size || !same(stat, fs.fstatSync(fd, { bigint: true }), fileKeys)
          || !same(stat, fs.lstatSync(target, { bigint: true }), fileKeys)) fail();
        totalBytes += count; if (totalBytes > 536870912) fail();
        entry = { target, stat, bytes: Buffer.from(buffer.subarray(0, count)), locator };
      } finally { fs.closeSync(fd); }
      files.set(url, entry); check(); return entry;
    };
    const initial = sourceState();
    for (const locator of closure) {
      const tracked = initial.entries.find(entry => entry.locator === locator); if (!tracked) fail();
      const observed = snapshot(locator), declared = tracked.gitMode === "100755" ? 0o755n : 0o644n;
      if ((observed.stat.mode & 0o7777n & ~declared) || !observed.bytes.equals(git(["cat-file", "blob", tracked.gitBlobHash]).stdout)) fail();
    }
    // All non-builtin evaluation uses owned bytes authenticated before import.
    // Native pathname re-reading is deliberately not the source of module bytes.
    registerHooks({
      resolve(specifier, context, nextResolve) {
        if (!isBuiltin(specifier) && !specifier.startsWith("./") && !specifier.startsWith("../") && !specifier.startsWith("file:")) fail();
        const resolved = nextResolve(specifier, context);
        if (!isBuiltin(resolved.url) && !files.has(resolved.url)) fail(); return resolved;
      },
      load(url, context, nextLoad) {
        if (isBuiltin(url)) return nextLoad(url, context);
        const entry = files.get(url); if (!entry || !/\.(?:mjs|js)$/.test(entry.locator)) fail();
        check(); return { format: "module", source: Buffer.from(entry.bytes), shortCircuit: true };
      },
    });
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
    }
    if (canonical(sourceState()) !== canonical(initial) || canonical(verifier.observeCurrentFinalizedSetfarmSourceBuildV1()) !== canonical(sourceBuild)) fail();
    check();
    const owner = await import("./deployment-cutover-owner.mjs");
    const authority = await owner.observeDeploymentCutoverOwnerControllerSourceV1();
    check(); if (canonical(sourceState()) !== canonical(initial)) fail();
    result = { schema: "setfarm.internal-production-deployment-cutover-bootstrap-observation.v1", sourceBuild, controllerSourceHash: authority.controllerSourceHash };
  } catch { invalid = true; }
  while (pins.length) { const pin = pins.pop(); try { fs.closeSync(pin.fd); } catch { invalid = true; } }
  if (invalid || !result) fail(); return result;
}
try { process.stdout.write(`${JSON.stringify(await inspect())}\n`); }
catch { process.stderr.write("DEPLOYMENT_CUTOVER_BOOTSTRAP_REFUSED\n"); process.exitCode = 1; }
