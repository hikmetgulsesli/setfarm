import fs from "node:fs";
import path from "node:path";
import { userInfo } from "node:os";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { holdSelectedSetfarmDeploymentBuildV1 } from "./build-generation-retention.mjs";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const directoryKeys = ["dev", "ino", "uid", "gid", "mode", "birthtimeNs"];
const fileKeys = [...directoryKeys, "nlink", "size", "mtimeNs", "ctimeNs"];
const treeKeys = [...directoryKeys, "mtimeNs", "ctimeNs"];
const same = (a, b, keys) => keys.every(key => a[key] === b[key]);
const sha = bytes => createHash("sha256").update(bytes).digest("hex");
const canonical = value => value === null || typeof value !== "object" ? JSON.stringify(value)
  : Array.isArray(value) ? `[${value.map(canonical).join(",")}]`
    : `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`;
const frozen = value => { if (value && typeof value === "object") { Object.values(value).forEach(frozen); Object.freeze(value); } return value; };
let uncertain = false;
const fail = () => { throw Error("DEPLOYMENT_CUTOVER_RETAINED_PROFILE_INVALID"); };
const resolverSource = `
import fs from 'node:fs';import {createRequire} from 'node:module';import {pathToFileURL,fileURLToPath} from 'node:url';
const input=JSON.parse(fs.readFileSync(0,'utf8'));
const output=input.edges.map(([mode,parent,specifier])=>{
  const url=pathToFileURL(parent),require=createRequire(url);
  if(input.phase==='paths')return require.resolve.paths(specifier);
  try{return mode==='esm'?fileURLToPath(import.meta.resolve(specifier,url.href)):require.resolve(specifier)}
  catch(error){if((mode==='cjs'&&error.code==='MODULE_NOT_FOUND')||(mode==='esm'&&error.code==='ERR_MODULE_NOT_FOUND'))return null;throw Error('RESOLUTION_FAILED')}
});process.stdout.write(JSON.stringify(output));
`;

// The authenticated bootstrap must bind this script/profile to Git before use.
// Inventory identity only: never imports retained JS/native code, and does not
// establish effective environment, complete module resolution or effect authority.
export function observeDeploymentCutoverRetainedProfileV1() {
  if (arguments.length) fail();
  const held = holdDeploymentCutoverRetainedProfileV1();
  try { return held.observation; } finally { held.close(); }
}

// Holds inventory and selected-build identities; complete resolution and effective
// environment remain obligations of the owning composition. Never admission.
export function holdDeploymentCutoverRetainedProfileV1() {
  if (arguments.length || uncertain) fail();
  const directories = new Map(), files = [], absences = [];
  let invalid = false, closed = false, result, selectedContext, total = 0, visitedEntries = 0, recheck = fail, resolveModules = fail;
  const close = () => {
    if (closed) return;
    closed = true;
    const pins = [...directories.values()];
    while (pins.length) { const pin = pins.pop(); try { fs.closeSync(pin.fd); } catch { uncertain = true; invalid = true; } }
    try { selectedContext?.close(); } catch { uncertain = true; invalid = true; }
    if (invalid) fail();
  };
  try {
    const uid = process.getuid?.(), home = userInfo().homedir;
    if (uid === undefined || !path.isAbsolute(home) || fs.realpathSync(home) !== home || fs.realpathSync(root) !== root) fail();
    const check = () => {
      for (const [target, pin] of directories) {
        const keys = pin.tree ? treeKeys : directoryKeys;
        if (!same(pin.stat, fs.fstatSync(pin.fd, { bigint: true }), keys)
          || !same(pin.stat, fs.lstatSync(target, { bigint: true }), keys)) fail();
      }
      for (const file of files) if (!same(file.stat, fs.lstatSync(file.target, { bigint: true }), fileKeys)) fail();
      for (const target of absences) {
        try { fs.lstatSync(target); fail(); } catch (error) { if (error.code !== "ENOENT") throw error; }
      }
    };
    const hold = (directory, tree = false) => {
      const parts = directory.split(path.sep).filter(Boolean); if (parts.length > 128) fail();
      for (let i = 0; i <= parts.length; i++) {
        const target = path.join(path.parse(directory).root, ...parts.slice(0, i));
        if (directories.has(target)) { if (tree && target === directory) directories.get(target).tree = true; continue; }
        if (directories.size >= 256) fail();
        const stat = fs.lstatSync(target, { bigint: true });
        if (!stat.isDirectory() || stat.isSymbolicLink() || ((target === home || target.startsWith(`${home}/`))
          && (stat.uid !== BigInt(uid) || (stat.mode & 0o022n)))) fail();
        const fd = fs.openSync(target, fs.constants.O_RDONLY | fs.constants.O_DIRECTORY | fs.constants.O_NOFOLLOW);
        directories.set(target, { fd, stat, tree: tree && target === directory });
        if (!same(stat, fs.fstatSync(fd, { bigint: true }), directoryKeys) || !same(stat, fs.lstatSync(target, { bigint: true }), directoryKeys)) fail();
      }
    };
    hold(root); const device = directories.get(root).stat.dev;
    const read = (target, cap) => {
      hold(path.dirname(target));
      const stat = fs.lstatSync(target, { bigint: true });
      if (!stat.isFile() || stat.isSymbolicLink() || stat.uid !== BigInt(uid) || stat.dev !== device
        || stat.nlink !== 1n || (stat.mode & 0o022n) || stat.size < 0n || stat.size > BigInt(cap)) fail();
      const fd = fs.openSync(target, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW | fs.constants.O_NONBLOCK);
      let bytes;
      try {
        if (!same(stat, fs.fstatSync(fd, { bigint: true }), fileKeys)) fail();
        const buffer = Buffer.alloc(Number(stat.size) + 1); let count = 0;
        while (count < buffer.length) { const size = fs.readSync(fd, buffer, count, buffer.length - count, count); if (!size) break; count += size; }
        if (BigInt(count) !== stat.size || !same(stat, fs.fstatSync(fd, { bigint: true }), fileKeys)
          || !same(stat, fs.lstatSync(target, { bigint: true }), fileKeys)) fail();
        total += count; if (total > 64 * 1024 * 1024) fail(); bytes = Buffer.from(buffer.subarray(0, count));
      } finally { try { fs.closeSync(fd); } catch { uncertain = true; fail(); } }
      files.push({ target, stat }); return bytes;
    };
    const profileBytes = read(path.join(root, "scripts/deployment-cutover-retained-profile.v1.json"), 64 * 1024), profile = JSON.parse(profileBytes);
    if (profile.schema !== "setfarm.internal-production-retained-startup-profile.v1"
      || profile.platform !== process.platform || profile.arch !== process.arch
      || !/^[a-f0-9]{40}$/.test(profile.sourceSha) || !/^[a-f0-9]{64}$/.test(profile.outputTreeHash)
      || !Array.isArray(profile.installations) || profile.installations.length < 1 || profile.installations.length > 16) fail();
    const locators = new Set();
    for (const entry of profile.installations) {
      if (!/^node_modules\/[a-z][a-z0-9-]*(?:\/node_modules\/[a-z][a-z0-9-]*)?$/.test(entry.locator)
        || locators.has(entry.locator) || !/^[a-f0-9]{64}$/.test(entry.inventoryHash)
        || !Number.isSafeInteger(entry.fileCount) || entry.fileCount < 1 || entry.fileCount > 2048
        || !Number.isSafeInteger(entry.byteLength) || entry.byteLength < 1 || entry.byteLength > 32 * 1024 * 1024) fail();
      locators.add(entry.locator);
    }
    check(); selectedContext = holdSelectedSetfarmDeploymentBuildV1(); const selected = selectedContext.observation; check();
    if (selected.buildSource.sha !== profile.sourceSha) fail();
    const selectedRoot = selected.cli.checkoutPath; hold(selectedRoot);
    if (directories.get(selectedRoot).stat.dev !== device) fail();
    const output = JSON.parse(read(path.join(selectedRoot, "dist/PLATFORM_BUILD_OUTPUT_TREE.json"), 4 * 1024 * 1024));
    if (output.sourceSha !== profile.sourceSha || output.outputTreeHash !== profile.outputTreeHash) fail();
    const installations = [];
    for (const entry of profile.installations) {
      const members = [], packageRoot = path.join(selectedRoot, entry.locator);
      const walk = (directory, relative = "", depth = 0) => {
        if (depth > 32) fail(); hold(directory, true);
        if (directories.get(directory).stat.dev !== device) fail();
        const names = fs.readdirSync(directory).sort(); if (names.length > 2048) fail();
        for (const name of names) {
          if (++visitedEntries > 8192) fail();
          if (!/^[A-Za-z0-9._-]+$/.test(name)) fail();
          const target = path.join(directory, name), locator = relative ? `${relative}/${name}` : name;
          if (path.basename(directory) === "node_modules" && !locators.has(`${entry.locator}/${locator}`)) fail();
          const stat = fs.lstatSync(target, { bigint: true });
          if (stat.isSymbolicLink()) fail();
          if (stat.isDirectory()) {
            const nested = `${entry.locator}/${locator}`;
            if (locators.has(nested)) { hold(target, true); continue; }
            if (name === "node_modules" && ![...locators].some(item => item.startsWith(`${nested}/`))) fail();
            walk(target, locator, depth + 1);
          } else {
            const bytes = read(target, 16 * 1024 * 1024);
            members.push({ locator, byteLength: bytes.length, sha256: sha(bytes) }); if (members.length > 2048) fail();
          }
        }
      };
      walk(packageRoot);
      members.sort((a, b) => Buffer.compare(Buffer.from(a.locator), Buffer.from(b.locator)));
      const inventoryHash = sha(JSON.stringify(members)), byteLength = members.reduce((sum, member) => sum + member.byteLength, 0);
      if (inventoryHash !== entry.inventoryHash || members.length !== entry.fileCount || byteLength !== entry.byteLength) fail();
      installations.push({ locator: entry.locator, inventoryHash, fileCount: members.length, byteLength });
      // A sibling file would take precedence over a package directory in CJS.
      hold(path.dirname(packageRoot), true);
      for (const extension of [".js", ".json", ".node"]) {
        const target = `${packageRoot}${extension}`;
        try { fs.lstatSync(target); fail(); } catch (error) { if (error.code !== "ENOENT") throw error; }
        absences.push(target);
      }
    }
    const moduleRoot = path.join(selectedRoot, "node_modules"); hold(moduleRoot, true);
    for (const name of ["bufferutil", "utf-8-validate"]) for (const extension of ["", ".js", ".json", ".node"]) {
      const target = path.join(moduleRoot, `${name}${extension}`);
      try { fs.lstatSync(target); fail(); } catch (error) { if (error.code !== "ENOENT") throw error; }
      absences.push(target);
    }
    check(); selectedContext.recheck(); check();
    const body = { schema: "setfarm.internal-production-retained-startup-profile-observation.v1", scope: "retained-startup-byte-inventory-only",
      sourceSha: profile.sourceSha, outputTreeHash: profile.outputTreeHash, profileHash: sha(profileBytes),
      selectedDeploymentObservationHash: selected.selectedDeploymentObservationHash, installations,
      blockers: ["module-resolution-not-authenticated", "runtime-effective-environment-not-authenticated", "database-zero-owner-not-observed",
        "filesystem-phase-zero-owner-not-observed", "controller-ownership-not-acquired"] };
    result = frozen({ ...body, observationHash: sha(canonical(body)) });
    recheck = () => {
      if (closed || invalid || uncertain) fail();
      try {
        check();
        selectedContext.recheck();
        check();
      } catch { invalid = true; uncertain = true; fail(); }
    };
    let resolved = false;
    resolveModules = function () {
      if (arguments.length || resolved || closed || invalid || uncertain) fail();
      resolved = true;
      try {
        recheck();
        const edges = profile.startupResolution, authenticated = new Set([
          ...files.map(file => path.relative(selectedRoot, file.target)), ...output.entries.map(entry => entry.locator),
        ]), seen = new Set();
        const locator = value => typeof value === "string" && !path.isAbsolute(value) && path.posix.normalize(value) === value
          && value.split("/").every(part => /^[A-Za-z0-9._-]+$/.test(part) && part !== "." && part !== "..");
        if (!Array.isArray(edges) || !edges.length || edges.length > 64) fail();
        for (const edge of edges) {
          if (!Array.isArray(edge) || edge.length !== 4) fail();
          const [mode, parent, specifier, target] = edge;
          if (!["esm", "cjs"].includes(mode) || !locator(parent) || !authenticated.has(parent)
            || typeof specifier !== "string" || !/^[a-z][a-z0-9-]*(?:\/[A-Za-z0-9._-]+)*$/.test(specifier)
            || specifier.split("/").some(part => part === "." || part === "..")
            || (target === null ? mode !== "cjs" : !locator(target) || !authenticated.has(target)
              || ![...locators].some(item => target.startsWith(`${item}/`) && path.basename(item) === specifier.split("/")[0]))) fail();
          const key = JSON.stringify(edge.slice(0, 3)); if (seen.has(key)) fail(); seen.add(key);
        }
        const absentCandidate = target => {
          if (!path.isAbsolute(target) || path.normalize(target) !== target) fail();
          const parts = target.split(path.sep).filter(Boolean); if (parts.length > 128) fail();
          let parent = path.parse(target).root; hold(parent);
          for (let index = 0; index < parts.length; index++) {
            const current = path.join(parent, parts[index]);
            let stat;
            try { stat = fs.lstatSync(current, { bigint: true }); }
            catch (error) {
              if (error.code !== "ENOENT") throw error;
              hold(parent, true); if (!absences.includes(current)) absences.push(current); check(); return;
            }
            if (index === parts.length - 1 || !stat.isDirectory() || stat.isSymbolicLink()) fail();
            hold(current); parent = current;
          }
          fail();
        };
        const childEdges = edges.map(([mode, parent, specifier]) => [mode, path.join(selectedRoot, parent), specifier]);
        const run = (phase, accountHome) => {
          check();
          const input = JSON.stringify({ phase, edges: childEdges }); if (Buffer.byteLength(input) > 1024 * 1024) fail();
          const child = spawnSync(process.execPath, ["--experimental-import-meta-resolve", "--input-type=module", "-e", resolverSource], {
            input, encoding: "utf8", cwd: selectedRoot, shell: false, timeout: 5000, maxBuffer: 1024 * 1024,
            env: { PATH: "/usr/bin:/bin", LANG: "C", LC_ALL: "C", ...(accountHome ? { HOME: home } : {}) },
          });
          check();
          if (child.error || child.signal || child.status !== 0 || child.stderr !== "" || typeof child.stdout !== "string") fail();
          const value = JSON.parse(child.stdout); if (!Array.isArray(value) || value.length !== edges.length) fail(); return value;
        };
        const searches = [run("paths", false), run("paths", true)];
        for (const context of searches) for (const [index, search] of context.entries()) {
          if (!Array.isArray(search) || search.length > 128 || !search.length) fail();
          const [, , specifier, target] = edges[index], name = specifier.split("/")[0];
          const installation = target === null ? null : [...locators].sort((a, b) => b.length - a.length).find(item => target.startsWith(`${item}/`));
          const stop = installation === null ? null : path.dirname(path.join(selectedRoot, installation));
          let found = stop === null;
          for (const directory of search) {
            if (typeof directory !== "string" || !path.isAbsolute(directory) || path.normalize(directory) !== directory) fail();
            if (directory === stop) { found = true; break; }
            for (const extension of ["", ".js", ".json", ".node"]) absentCandidate(path.join(directory, `${name}${extension}`));
          }
          if (!found) fail();
        }
        const contexts = [false, true].map(accountHome => {
          const targets = run("resolve", accountHome);
          for (const [index, target] of targets.entries()) {
            const expected = edges[index][3];
            if (target !== (expected === null ? null : path.join(selectedRoot, expected))) fail();
          }
          return { home: accountHome ? "account" : "absent", targets: edges.map(edge => edge[3]) };
        });
        recheck();
        const body = { schema: "setfarm.internal-production-retained-startup-resolution-observation.v1",
          scope: "reviewed-selected-startup-resolution-only", profileHash: result.profileHash,
          selectedDeploymentObservationHash: result.selectedDeploymentObservationHash, contexts };
        return frozen({ ...body, observationHash: sha(canonical(body)) });
      } catch { invalid = true; uncertain = true; fail(); }
    };
  } catch { invalid = true; }
  if (invalid || !result) { uncertain = true; close(); fail(); }
  return Object.freeze({ observation: result, recheck, resolveModules, close });
}
