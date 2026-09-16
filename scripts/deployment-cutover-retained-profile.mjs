import fs from "node:fs";
import path from "node:path";
import { userInfo } from "node:os";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { observeSelectedSetfarmDeploymentBuildV1 } from "./build-generation-retention.mjs";

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

// The authenticated bootstrap must bind this script/profile to Git before use.
// Inventory identity only: never imports retained JS/native code, and does not
// establish effective environment, complete module resolution or effect authority.
export function observeDeploymentCutoverRetainedProfileV1() {
  if (arguments.length || uncertain) fail();
  const directories = new Map(), files = [], absences = [];
  let invalid = false, result, total = 0, visitedEntries = 0;
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
    check(); const selected = observeSelectedSetfarmDeploymentBuildV1(); check();
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
    check(); const after = observeSelectedSetfarmDeploymentBuildV1(); check();
    if (canonical(after) !== canonical(selected)) fail();
    const body = { schema: "setfarm.internal-production-retained-startup-profile-observation.v1", scope: "retained-startup-byte-inventory-only",
      sourceSha: profile.sourceSha, outputTreeHash: profile.outputTreeHash, profileHash: sha(profileBytes),
      selectedDeploymentObservationHash: selected.selectedDeploymentObservationHash, installations,
      blockers: ["module-resolution-not-authenticated", "runtime-effective-environment-not-authenticated", "database-zero-owner-not-observed",
        "filesystem-phase-zero-owner-not-observed", "controller-ownership-not-acquired"] };
    result = frozen({ ...body, observationHash: sha(canonical(body)) });
  } catch { invalid = true; }
  const pins = [...directories.values()];
  while (pins.length) { const pin = pins.pop(); try { fs.closeSync(pin.fd); } catch { uncertain = true; invalid = true; } }
  if (invalid || !result) { uncertain = true; fail(); } return result;
}
